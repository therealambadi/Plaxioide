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
import * as fs from "fs";
import { exec } from "child_process";
import { timeout } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import * as path from "../../../base/common/path.js";
import { isLinux, isMacintosh, isWindows } from "../../../base/common/platform.js";
import { findExecutable } from "../../../base/node/processes.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { ILogService, LogLevel } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { FlowControlConstants, ProcessPropertyType, PosixShellType, GeneralShellType } from "../common/terminal.js";
import { ChildProcessMonitor } from "./childProcessMonitor.js";
import { getShellIntegrationInjection, getWindowsBuildNumber } from "./terminalEnvironment.js";
import { WindowsShellHelper } from "./windowsShellHelper.js";
import { spawn } from "node-pty";
import { chunkInput } from "../common/terminalProcess.js";
var ShutdownConstants = /* @__PURE__ */ ((ShutdownConstants2) => {
  ShutdownConstants2[ShutdownConstants2["DataFlushTimeout"] = 250] = "DataFlushTimeout";
  ShutdownConstants2[ShutdownConstants2["MaximumShutdownTime"] = 5e3] = "MaximumShutdownTime";
  return ShutdownConstants2;
})(ShutdownConstants || {});
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["KillSpawnThrottleInterval"] = 250] = "KillSpawnThrottleInterval";
  Constants2[Constants2["KillSpawnSpacingDuration"] = 50] = "KillSpawnSpacingDuration";
  Constants2[Constants2["WriteInterval"] = 5] = "WriteInterval";
  return Constants2;
})(Constants || {});
const posixShellTypeMap = /* @__PURE__ */ new Map([
  ["bash", PosixShellType.Bash],
  ["csh", PosixShellType.Csh],
  ["fish", PosixShellType.Fish],
  ["ksh", PosixShellType.Ksh],
  ["sh", PosixShellType.Sh],
  ["zsh", PosixShellType.Zsh]
]);
const generalShellTypeMap = /* @__PURE__ */ new Map([
  ["pwsh", GeneralShellType.PowerShell],
  ["powershell", GeneralShellType.PowerShell],
  ["python", GeneralShellType.Python],
  ["julia", GeneralShellType.Julia],
  ["nu", GeneralShellType.NuShell],
  ["node", GeneralShellType.Node]
]);
let TerminalProcess = class extends Disposable {
  constructor(shellLaunchConfig, cwd, cols, rows, env, _executableEnv, _options, _logService, _productService) {
    super();
    this.shellLaunchConfig = shellLaunchConfig;
    this._executableEnv = _executableEnv;
    this._options = _options;
    this._logService = _logService;
    this._productService = _productService;
    this.id = 0;
    this.shouldPersist = false;
    this._properties = {
      cwd: "",
      initialCwd: "",
      fixedDimensions: { cols: void 0, rows: void 0 },
      title: "",
      shellType: void 0,
      hasChildProcesses: true,
      resolvedShellLaunchConfig: {},
      overrideDimensions: void 0,
      failedShellIntegrationActivation: false,
      usedShellIntegrationInjection: void 0
    };
    this._currentTitle = "";
    this._titleInterval = null;
    this._writeQueue = [];
    this._isPtyPaused = false;
    this._unacknowledgedCharCount = 0;
    this._onProcessData = this._register(new Emitter());
    this.onProcessData = this._onProcessData.event;
    this._onProcessReady = this._register(new Emitter());
    this.onProcessReady = this._onProcessReady.event;
    this._onDidChangeProperty = this._register(new Emitter());
    this.onDidChangeProperty = this._onDidChangeProperty.event;
    this._onProcessExit = this._register(new Emitter());
    this.onProcessExit = this._onProcessExit.event;
    let name;
    if (isWindows) {
      name = path.basename(this.shellLaunchConfig.executable || "");
    } else {
      name = "xterm-256color";
    }
    this._initialCwd = cwd;
    this._properties[ProcessPropertyType.InitialCwd] = this._initialCwd;
    this._properties[ProcessPropertyType.Cwd] = this._initialCwd;
    const useConpty = this._options.windowsEnableConpty && process.platform === "win32" && getWindowsBuildNumber() >= 18309;
    const useConptyDll = useConpty && this._options.windowsUseConptyDll;
    this._ptyOptions = {
      name,
      cwd,
      // TODO: When node-pty is updated this cast can be removed
      env,
      cols,
      rows,
      useConpty,
      useConptyDll,
      // This option will force conpty to not redraw the whole viewport on launch
      conptyInheritCursor: useConpty && !!shellLaunchConfig.initialText
    };
    if (isWindows) {
      if (useConpty && cols === 0 && rows === 0 && this.shellLaunchConfig.executable?.endsWith("Git\\bin\\bash.exe")) {
        this._delayedResizer = new DelayedResizer();
        this._register(this._delayedResizer.onTrigger((dimensions) => {
          this._delayedResizer?.dispose();
          this._delayedResizer = void 0;
          if (dimensions.cols && dimensions.rows) {
            this.resize(dimensions.cols, dimensions.rows);
          }
        }));
      }
      this.onProcessReady((e) => {
        this._windowsShellHelper = this._register(new WindowsShellHelper(e.pid));
        this._register(this._windowsShellHelper.onShellTypeChanged((e2) => this._onDidChangeProperty.fire({ type: ProcessPropertyType.ShellType, value: e2 })));
        this._register(this._windowsShellHelper.onShellNameChanged((e2) => this._onDidChangeProperty.fire({ type: ProcessPropertyType.Title, value: e2 })));
      });
    }
    this._register(toDisposable(() => {
      if (this._titleInterval) {
        clearInterval(this._titleInterval);
        this._titleInterval = null;
      }
    }));
  }
  get exitMessage() {
    return this._exitMessage;
  }
  get currentTitle() {
    return this._windowsShellHelper?.shellTitle || this._currentTitle;
  }
  get shellType() {
    return isWindows ? this._windowsShellHelper?.shellType : posixShellTypeMap.get(this._currentTitle) || generalShellTypeMap.get(this._currentTitle);
  }
  get hasChildProcesses() {
    return this._childProcessMonitor?.hasChildProcesses || false;
  }
  async start() {
    const results = await Promise.all([this._validateCwd(), this._validateExecutable()]);
    const firstError = results.find((r) => r !== void 0);
    if (firstError) {
      return firstError;
    }
    let injection;
    if (this._options.shellIntegration.enabled) {
      injection = await getShellIntegrationInjection(this.shellLaunchConfig, this._options, this._ptyOptions.env, this._logService, this._productService);
      if (injection) {
        this._onDidChangeProperty.fire({ type: ProcessPropertyType.UsedShellIntegrationInjection, value: true });
        if (injection.envMixin) {
          for (const [key, value] of Object.entries(injection.envMixin)) {
            this._ptyOptions.env ||= {};
            this._ptyOptions.env[key] = value;
          }
        }
        if (injection.filesToCopy) {
          for (const f of injection.filesToCopy) {
            try {
              await fs.promises.mkdir(path.dirname(f.dest), { recursive: true });
              await fs.promises.copyFile(f.source, f.dest);
            } catch {
            }
          }
        }
      } else {
        this._onDidChangeProperty.fire({ type: ProcessPropertyType.FailedShellIntegrationActivation, value: true });
      }
    }
    try {
      await this.setupPtyProcess(this.shellLaunchConfig, this._ptyOptions, injection);
      if (injection?.newArgs) {
        return { injectedArgs: injection.newArgs };
      }
      return void 0;
    } catch (err) {
      this._logService.trace("node-pty.node-pty.IPty#spawn native exception", err);
      return { message: `A native exception occurred during launch (${err.message})` };
    }
  }
  async _validateCwd() {
    try {
      const result = await fs.promises.stat(this._initialCwd);
      if (!result.isDirectory()) {
        return { message: localize("launchFail.cwdNotDirectory", 'Starting directory (cwd) "{0}" is not a directory', this._initialCwd.toString()) };
      }
    } catch (err) {
      if (err?.code === "ENOENT") {
        return { message: localize("launchFail.cwdDoesNotExist", 'Starting directory (cwd) "{0}" does not exist', this._initialCwd.toString()) };
      }
    }
    this._onDidChangeProperty.fire({ type: ProcessPropertyType.InitialCwd, value: this._initialCwd });
    return void 0;
  }
  async _validateExecutable() {
    const slc = this.shellLaunchConfig;
    if (!slc.executable) {
      throw new Error("IShellLaunchConfig.executable not set");
    }
    const cwd = slc.cwd instanceof URI ? slc.cwd.path : slc.cwd;
    const envPaths = slc.env && slc.env.PATH ? slc.env.PATH.split(path.delimiter) : void 0;
    const executable = await findExecutable(slc.executable, cwd, envPaths, this._executableEnv);
    if (!executable) {
      return { message: localize("launchFail.executableDoesNotExist", 'Path to shell executable "{0}" does not exist', slc.executable) };
    }
    try {
      const result = await fs.promises.stat(executable);
      if (!result.isFile() && !result.isSymbolicLink()) {
        return { message: localize("launchFail.executableIsNotFileOrSymlink", 'Path to shell executable "{0}" is not a file or a symlink', slc.executable) };
      }
      slc.executable = executable;
    } catch (err) {
      if (err?.code === "EACCES") {
      } else {
        throw err;
      }
    }
    return void 0;
  }
  async setupPtyProcess(shellLaunchConfig, options, shellIntegrationInjection) {
    const args = shellIntegrationInjection?.newArgs || shellLaunchConfig.args || [];
    await this._throttleKillSpawn();
    this._logService.trace("node-pty.IPty#spawn", shellLaunchConfig.executable, args, options);
    const ptyProcess = spawn(shellLaunchConfig.executable, args, options);
    this._ptyProcess = ptyProcess;
    this._childProcessMonitor = this._register(new ChildProcessMonitor(ptyProcess.pid, this._logService));
    this._childProcessMonitor.onDidChangeHasChildProcesses((value) => this._onDidChangeProperty.fire({ type: ProcessPropertyType.HasChildProcesses, value }));
    this._processStartupComplete = new Promise((c) => {
      this.onProcessReady(() => c());
    });
    ptyProcess.onData((data) => {
      this._unacknowledgedCharCount += data.length;
      if (!this._isPtyPaused && this._unacknowledgedCharCount > FlowControlConstants.HighWatermarkChars) {
        this._logService.trace(`Flow control: Pause (${this._unacknowledgedCharCount} > ${FlowControlConstants.HighWatermarkChars})`);
        this._isPtyPaused = true;
        ptyProcess.pause();
      }
      this._logService.trace("node-pty.IPty#onData", data);
      this._onProcessData.fire(data);
      if (this._closeTimeout) {
        this._queueProcessExit();
      }
      this._windowsShellHelper?.checkShell();
      this._childProcessMonitor?.handleOutput();
    });
    ptyProcess.onExit((e) => {
      this._exitCode = e.exitCode;
      this._queueProcessExit();
    });
    this._sendProcessId(ptyProcess.pid);
    this._setupTitlePolling(ptyProcess);
  }
  _setupTitlePolling(ptyProcess) {
    setTimeout(() => this._sendProcessTitle(ptyProcess));
    if (!isWindows) {
      this._titleInterval = setInterval(() => {
        if (this._currentTitle !== ptyProcess.process) {
          this._sendProcessTitle(ptyProcess);
        }
      }, 200);
    }
  }
  // Allow any trailing data events to be sent before the exit event is sent.
  // See https://github.com/Tyriar/node-pty/issues/72
  _queueProcessExit() {
    if (this._logService.getLevel() === LogLevel.Trace) {
      this._logService.trace("TerminalProcess#_queueProcessExit", new Error().stack?.replace(/^Error/, ""));
    }
    if (this._closeTimeout) {
      clearTimeout(this._closeTimeout);
    }
    this._closeTimeout = setTimeout(() => {
      this._closeTimeout = void 0;
      this._kill();
    }, 250 /* DataFlushTimeout */);
  }
  async _kill() {
    await this._processStartupComplete;
    if (this._store.isDisposed) {
      return;
    }
    try {
      if (this._ptyProcess) {
        await this._throttleKillSpawn();
        this._logService.trace("node-pty.IPty#kill");
        this._ptyProcess.kill();
      }
    } catch (ex) {
    }
    this._onProcessExit.fire(this._exitCode || 0);
    this.dispose();
  }
  async _throttleKillSpawn() {
    if (!isWindows || !("useConpty" in this._ptyOptions) || !this._ptyOptions.useConpty) {
      return;
    }
    if (this._ptyOptions.useConptyDll) {
      return;
    }
    while (Date.now() - TerminalProcess._lastKillOrStart < 250 /* KillSpawnThrottleInterval */) {
      this._logService.trace("Throttling kill/spawn call");
      await timeout(250 /* KillSpawnThrottleInterval */ - (Date.now() - TerminalProcess._lastKillOrStart) + 50 /* KillSpawnSpacingDuration */);
    }
    TerminalProcess._lastKillOrStart = Date.now();
  }
  _sendProcessId(pid) {
    this._onProcessReady.fire({
      pid,
      cwd: this._initialCwd,
      windowsPty: this.getWindowsPty()
    });
  }
  _sendProcessTitle(ptyProcess) {
    if (this._store.isDisposed) {
      return;
    }
    this._currentTitle = ptyProcess.process ?? "";
    this._onDidChangeProperty.fire({ type: ProcessPropertyType.Title, value: this._currentTitle });
    let sanitizedTitle = this.currentTitle.replace(/ \(figterm\)$/g, "");
    if (!isWindows) {
      sanitizedTitle = path.basename(sanitizedTitle);
    }
    if (sanitizedTitle.toLowerCase().startsWith("python")) {
      this._onDidChangeProperty.fire({ type: ProcessPropertyType.ShellType, value: GeneralShellType.Python });
    } else if (sanitizedTitle.toLowerCase().startsWith("julia")) {
      this._onDidChangeProperty.fire({ type: ProcessPropertyType.ShellType, value: GeneralShellType.Julia });
    } else {
      const shellTypeValue = posixShellTypeMap.get(sanitizedTitle) || generalShellTypeMap.get(sanitizedTitle);
      this._onDidChangeProperty.fire({ type: ProcessPropertyType.ShellType, value: shellTypeValue });
    }
  }
  shutdown(immediate) {
    if (this._logService.getLevel() === LogLevel.Trace) {
      this._logService.trace("TerminalProcess#shutdown", new Error().stack?.replace(/^Error/, ""));
    }
    if (immediate && !isWindows) {
      this._kill();
    } else {
      if (!this._closeTimeout && !this._store.isDisposed) {
        this._queueProcessExit();
        setTimeout(() => {
          if (this._closeTimeout && !this._store.isDisposed) {
            this._closeTimeout = void 0;
            this._kill();
          }
        }, 5e3 /* MaximumShutdownTime */);
      }
    }
  }
  input(data, isBinary = false) {
    if (this._store.isDisposed || !this._ptyProcess) {
      return;
    }
    this._writeQueue.push(...chunkInput(data).map((e) => {
      return { isBinary, data: e };
    }));
    this._startWrite();
  }
  async processBinary(data) {
    this.input(data, true);
  }
  async refreshProperty(type) {
    switch (type) {
      case ProcessPropertyType.Cwd: {
        const newCwd = await this.getCwd();
        if (newCwd !== this._properties.cwd) {
          this._properties.cwd = newCwd;
          this._onDidChangeProperty.fire({ type: ProcessPropertyType.Cwd, value: this._properties.cwd });
        }
        return newCwd;
      }
      case ProcessPropertyType.InitialCwd: {
        const initialCwd = await this.getInitialCwd();
        if (initialCwd !== this._properties.initialCwd) {
          this._properties.initialCwd = initialCwd;
          this._onDidChangeProperty.fire({ type: ProcessPropertyType.InitialCwd, value: this._properties.initialCwd });
        }
        return initialCwd;
      }
      case ProcessPropertyType.Title:
        return this.currentTitle;
      default:
        return this.shellType;
    }
  }
  async updateProperty(type, value) {
    if (type === ProcessPropertyType.FixedDimensions) {
      this._properties.fixedDimensions = value;
    }
  }
  _startWrite() {
    if (this._writeTimeout !== void 0 || this._writeQueue.length === 0) {
      return;
    }
    this._doWrite();
    if (this._writeQueue.length === 0) {
      this._writeTimeout = void 0;
      return;
    }
    this._writeTimeout = setTimeout(() => {
      this._writeTimeout = void 0;
      this._startWrite();
    }, 5 /* WriteInterval */);
  }
  _doWrite() {
    const object = this._writeQueue.shift();
    this._logService.trace("node-pty.IPty#write", object.data);
    if (object.isBinary) {
      this._ptyProcess.write(Buffer.from(object.data, "binary"));
    } else {
      this._ptyProcess.write(object.data);
    }
    this._childProcessMonitor?.handleInput();
  }
  resize(cols, rows) {
    if (this._store.isDisposed) {
      return;
    }
    if (typeof cols !== "number" || typeof rows !== "number" || isNaN(cols) || isNaN(rows)) {
      return;
    }
    if (this._ptyProcess) {
      cols = Math.max(cols, 1);
      rows = Math.max(rows, 1);
      if (this._delayedResizer) {
        this._delayedResizer.cols = cols;
        this._delayedResizer.rows = rows;
        return;
      }
      this._logService.trace("node-pty.IPty#resize", cols, rows);
      try {
        this._ptyProcess.resize(cols, rows);
      } catch (e) {
        this._logService.trace("node-pty.IPty#resize exception " + e.message);
        if (this._exitCode !== void 0 && e.message !== "ioctl(2) failed, EBADF" && e.message !== "Cannot resize a pty that has already exited") {
          throw e;
        }
      }
    }
  }
  clearBuffer() {
    this._ptyProcess?.clear();
  }
  acknowledgeDataEvent(charCount) {
    this._unacknowledgedCharCount = Math.max(this._unacknowledgedCharCount - charCount, 0);
    this._logService.trace(`Flow control: Ack ${charCount} chars (unacknowledged: ${this._unacknowledgedCharCount})`);
    if (this._isPtyPaused && this._unacknowledgedCharCount < FlowControlConstants.LowWatermarkChars) {
      this._logService.trace(`Flow control: Resume (${this._unacknowledgedCharCount} < ${FlowControlConstants.LowWatermarkChars})`);
      this._ptyProcess?.resume();
      this._isPtyPaused = false;
    }
  }
  clearUnacknowledgedChars() {
    this._unacknowledgedCharCount = 0;
    this._logService.trace(`Flow control: Cleared all unacknowledged chars, forcing resume`);
    if (this._isPtyPaused) {
      this._ptyProcess?.resume();
      this._isPtyPaused = false;
    }
  }
  async setUnicodeVersion(version) {
  }
  getInitialCwd() {
    return Promise.resolve(this._initialCwd);
  }
  async getCwd() {
    if (isMacintosh) {
      return new Promise((resolve) => {
        if (!this._ptyProcess) {
          resolve(this._initialCwd);
          return;
        }
        this._logService.trace("node-pty.IPty#pid");
        exec("lsof -OPln -p " + this._ptyProcess.pid + " | grep cwd", { env: { ...process.env, LANG: "en_US.UTF-8" } }, (error, stdout, stderr) => {
          if (!error && stdout !== "") {
            resolve(stdout.substring(stdout.indexOf("/"), stdout.length - 1));
          } else {
            this._logService.error("lsof did not run successfully, it may not be on the $PATH?", error, stdout, stderr);
            resolve(this._initialCwd);
          }
        });
      });
    }
    if (isLinux) {
      if (!this._ptyProcess) {
        return this._initialCwd;
      }
      this._logService.trace("node-pty.IPty#pid");
      try {
        return await fs.promises.readlink(`/proc/${this._ptyProcess.pid}/cwd`);
      } catch (error) {
        return this._initialCwd;
      }
    }
    return this._initialCwd;
  }
  getWindowsPty() {
    return isWindows ? {
      backend: "useConpty" in this._ptyOptions && this._ptyOptions.useConpty ? "conpty" : "winpty",
      buildNumber: getWindowsBuildNumber()
    } : void 0;
  }
};
TerminalProcess._lastKillOrStart = 0;
TerminalProcess = __decorateClass([
  __decorateParam(7, ILogService),
  __decorateParam(8, IProductService)
], TerminalProcess);
class DelayedResizer extends Disposable {
  constructor() {
    super();
    this._onTrigger = this._register(new Emitter());
    this._timeout = setTimeout(() => {
      this._onTrigger.fire({ rows: this.rows, cols: this.cols });
    }, 1e3);
    this._register(toDisposable(() => clearTimeout(this._timeout)));
  }
  get onTrigger() {
    return this._onTrigger.event;
  }
}
export {
  TerminalProcess
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3Rlcm1pbmFsUHJvY2Vzcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NFbnZpcm9ubWVudCwgaXNMaW51eCwgaXNNYWNpbnRvc2gsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGZpbmRFeGVjdXRhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3Byb2Nlc3Nlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIExvZ0xldmVsIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRmxvd0NvbnRyb2xDb25zdGFudHMsIElTaGVsbExhdW5jaENvbmZpZywgSVRlcm1pbmFsQ2hpbGRQcm9jZXNzLCBJVGVybWluYWxMYXVuY2hFcnJvciwgSVByb2Nlc3NQcm9wZXJ0eSwgSVByb2Nlc3NQcm9wZXJ0eU1hcCBhcyBJUHJvY2Vzc1Byb3BlcnR5TWFwLCBQcm9jZXNzUHJvcGVydHlUeXBlLCBUZXJtaW5hbFNoZWxsVHlwZSwgSVByb2Nlc3NSZWFkeUV2ZW50LCBJVGVybWluYWxQcm9jZXNzT3B0aW9ucywgUG9zaXhTaGVsbFR5cGUsIElQcm9jZXNzUmVhZHlXaW5kb3dzUHR5LCBHZW5lcmFsU2hlbGxUeXBlIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IENoaWxkUHJvY2Vzc01vbml0b3IgfSBmcm9tICcuL2NoaWxkUHJvY2Vzc01vbml0b3IuanMnO1xuaW1wb3J0IHsgZ2V0U2hlbGxJbnRlZ3JhdGlvbkluamVjdGlvbiwgZ2V0V2luZG93c0J1aWxkTnVtYmVyLCBJU2hlbGxJbnRlZ3JhdGlvbkNvbmZpZ0luamVjdGlvbiB9IGZyb20gJy4vdGVybWluYWxFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBXaW5kb3dzU2hlbGxIZWxwZXIgfSBmcm9tICcuL3dpbmRvd3NTaGVsbEhlbHBlci5qcyc7XG5pbXBvcnQgeyBJUHR5LCBJUHR5Rm9ya09wdGlvbnMsIElXaW5kb3dzUHR5Rm9ya09wdGlvbnMsIHNwYXduIH0gZnJvbSAnbm9kZS1wdHknO1xuaW1wb3J0IHsgY2h1bmtJbnB1dCB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbFByb2Nlc3MuanMnO1xuXG5jb25zdCBlbnVtIFNodXRkb3duQ29uc3RhbnRzIHtcblx0LyoqXG5cdCAqIFRoZSBhbW91bnQgb2YgbXMgdGhhdCBtdXN0IHBhc3MgYmV0d2VlbiBkYXRhIGV2ZW50cyBhZnRlciBleGl0IGlzIHF1ZXVlZCBiZWZvcmUgdGhlIGFjdHVhbFxuXHQgKiBraWxsIGNhbGwgaXMgdHJpZ2dlcmVkLiBUaGlzIGRhdGEgZmx1c2ggbWVjaGFuaXNtIHdvcmtzIGFyb3VuZCBhbiBbaXNzdWUgaW4gbm9kZS1wdHldWzFdXG5cdCAqIHdoZXJlIG5vdCBhbGwgZGF0YSBpcyBmbHVzaGVkIHdoaWNoIGNhdXNlcyBwcm9ibGVtcyBmb3IgdGFzayBwcm9ibGVtIG1hdGNoZXJzLiBBZGRpdGlvbmFsbHlcblx0ICogb24gV2luZG93cyB1bmRlciBjb25wdHksIGtpbGxpbmcgYSBwcm9jZXNzIHdoaWxlIGRhdGEgaXMgYmVpbmcgb3V0cHV0IHdpbGwgY2F1c2UgdGhlIFtjb25ob3N0XG5cdCAqIGZsdXNoIHRvIGhhbmcgdGhlIHB0eSBob3N0XVsyXSBiZWNhdXNlIFtjb25ob3N0IHNob3VsZCBiZSBob3N0ZWQgb24gYW5vdGhlciB0aHJlYWRdWzNdLlxuXHQgKlxuXHQgKiBbMV06IGh0dHBzOi8vZ2l0aHViLmNvbS9UeXJpYXIvbm9kZS1wdHkvaXNzdWVzLzcyXG5cdCAqIFsyXTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzcxOTY2XG5cdCAqIFszXTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9ub2RlLXB0eS9wdWxsLzQxNVxuXHQgKi9cblx0RGF0YUZsdXNoVGltZW91dCA9IDI1MCxcblx0LyoqXG5cdCAqIFRoZSBtYXhpbXVtIG1zIHRvIGFsbG93IGFmdGVyIGRpc3Bvc2UgaXMgY2FsbGVkIGJlY2F1c2UgZm9yY2VmdWxseSBraWxsaW5nIHRoZSBwcm9jZXNzLlxuXHQgKi9cblx0TWF4aW11bVNodXRkb3duVGltZSA9IDUwMDBcbn1cblxuY29uc3QgZW51bSBDb25zdGFudHMge1xuXHQvKipcblx0ICogVGhlIG1pbmltdW0gZHVyYXRpb24gYmV0d2VlbiBraWxsIGFuZCBzcGF3biBjYWxscyBvbiBXaW5kb3dzL2NvbnB0eSBhcyBhIG1pdGlnYXRpb24gZm9yIGFcblx0ICogaGFuZyBpc3N1ZS4gU2VlOlxuXHQgKiAtIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy83MTk2NlxuXHQgKiAtIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTc5NTZcblx0ICogLSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTIxMzM2XG5cdCAqL1xuXHRLaWxsU3Bhd25UaHJvdHRsZUludGVydmFsID0gMjUwLFxuXHQvKipcblx0ICogVGhlIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgd2hlbiBhIGNhbGwgaXMgdGhyb3R0bGVkIGJleW9uZCB0aGUgZXhhY3QgYW1vdW50LCB0aGlzIGlzIHVzZWQgdG9cblx0ICogdHJ5IHByZXZlbnQgZWFybHkgdGltZW91dHMgY2F1c2luZyBhIGtpbGwvc3Bhd24gY2FsbCB0byBoYXBwZW4gYXQgZG91YmxlIHRoZSByZWd1bGFyXG5cdCAqIGludGVydmFsLlxuXHQgKi9cblx0S2lsbFNwYXduU3BhY2luZ0R1cmF0aW9uID0gNTAsXG5cdC8qKlxuXHQgKiBIb3cgbG9uZyB0byB3YWl0IGJldHdlZW4gY2h1bmsgd3JpdGVzLlxuXHQgKi9cblx0V3JpdGVJbnRlcnZhbCA9IDUsXG59XG5cbmludGVyZmFjZSBJV3JpdGVPYmplY3Qge1xuXHRkYXRhOiBzdHJpbmc7XG5cdGlzQmluYXJ5OiBib29sZWFuO1xufVxuXG5jb25zdCBwb3NpeFNoZWxsVHlwZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBQb3NpeFNoZWxsVHlwZT4oW1xuXHRbJ2Jhc2gnLCBQb3NpeFNoZWxsVHlwZS5CYXNoXSxcblx0Wydjc2gnLCBQb3NpeFNoZWxsVHlwZS5Dc2hdLFxuXHRbJ2Zpc2gnLCBQb3NpeFNoZWxsVHlwZS5GaXNoXSxcblx0Wydrc2gnLCBQb3NpeFNoZWxsVHlwZS5Lc2hdLFxuXHRbJ3NoJywgUG9zaXhTaGVsbFR5cGUuU2hdLFxuXHRbJ3pzaCcsIFBvc2l4U2hlbGxUeXBlLlpzaF1cbl0pO1xuXG5jb25zdCBnZW5lcmFsU2hlbGxUeXBlTWFwID0gbmV3IE1hcDxzdHJpbmcsIEdlbmVyYWxTaGVsbFR5cGU+KFtcblx0Wydwd3NoJywgR2VuZXJhbFNoZWxsVHlwZS5Qb3dlclNoZWxsXSxcblx0Wydwb3dlcnNoZWxsJywgR2VuZXJhbFNoZWxsVHlwZS5Qb3dlclNoZWxsXSxcblx0WydweXRob24nLCBHZW5lcmFsU2hlbGxUeXBlLlB5dGhvbl0sXG5cdFsnanVsaWEnLCBHZW5lcmFsU2hlbGxUeXBlLkp1bGlhXSxcblx0WydudScsIEdlbmVyYWxTaGVsbFR5cGUuTnVTaGVsbF0sXG5cdFsnbm9kZScsIEdlbmVyYWxTaGVsbFR5cGUuTm9kZV0sXG5cbl0pO1xuZXhwb3J0IGNsYXNzIFRlcm1pbmFsUHJvY2VzcyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGVybWluYWxDaGlsZFByb2Nlc3Mge1xuXHRyZWFkb25seSBpZCA9IDA7XG5cdHJlYWRvbmx5IHNob3VsZFBlcnNpc3QgPSBmYWxzZTtcblxuXHRwcml2YXRlIF9wcm9wZXJ0aWVzOiBJUHJvY2Vzc1Byb3BlcnR5TWFwID0ge1xuXHRcdGN3ZDogJycsXG5cdFx0aW5pdGlhbEN3ZDogJycsXG5cdFx0Zml4ZWREaW1lbnNpb25zOiB7IGNvbHM6IHVuZGVmaW5lZCwgcm93czogdW5kZWZpbmVkIH0sXG5cdFx0dGl0bGU6ICcnLFxuXHRcdHNoZWxsVHlwZTogdW5kZWZpbmVkLFxuXHRcdGhhc0NoaWxkUHJvY2Vzc2VzOiB0cnVlLFxuXHRcdHJlc29sdmVkU2hlbGxMYXVuY2hDb25maWc6IHt9LFxuXHRcdG92ZXJyaWRlRGltZW5zaW9uczogdW5kZWZpbmVkLFxuXHRcdGZhaWxlZFNoZWxsSW50ZWdyYXRpb25BY3RpdmF0aW9uOiBmYWxzZSxcblx0XHR1c2VkU2hlbGxJbnRlZ3JhdGlvbkluamVjdGlvbjogdW5kZWZpbmVkXG5cdH07XG5cdHByaXZhdGUgc3RhdGljIF9sYXN0S2lsbE9yU3RhcnQgPSAwO1xuXHRwcml2YXRlIF9leGl0Q29kZTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9leGl0TWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jbG9zZVRpbWVvdXQ6IGFueTtcblx0cHJpdmF0ZSBfcHR5UHJvY2VzczogSVB0eSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY3VycmVudFRpdGxlOiBzdHJpbmcgPSAnJztcblx0cHJpdmF0ZSBfcHJvY2Vzc1N0YXJ0dXBDb21wbGV0ZTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfd2luZG93c1NoZWxsSGVscGVyOiBXaW5kb3dzU2hlbGxIZWxwZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2NoaWxkUHJvY2Vzc01vbml0b3I6IENoaWxkUHJvY2Vzc01vbml0b3IgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3RpdGxlSW50ZXJ2YWw6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX3dyaXRlUXVldWU6IElXcml0ZU9iamVjdFtdID0gW107XG5cdHByaXZhdGUgX3dyaXRlVGltZW91dDogTm9kZUpTLlRpbWVvdXQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2RlbGF5ZWRSZXNpemVyOiBEZWxheWVkUmVzaXplciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5pdGlhbEN3ZDogc3RyaW5nO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wdHlPcHRpb25zOiBJUHR5Rm9ya09wdGlvbnMgfCBJV2luZG93c1B0eUZvcmtPcHRpb25zO1xuXG5cdHByaXZhdGUgX2lzUHR5UGF1c2VkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX3VuYWNrbm93bGVkZ2VkQ2hhckNvdW50OiBudW1iZXIgPSAwO1xuXHRnZXQgZXhpdE1lc3NhZ2UoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2V4aXRNZXNzYWdlOyB9XG5cblx0Z2V0IGN1cnJlbnRUaXRsZSgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5fd2luZG93c1NoZWxsSGVscGVyPy5zaGVsbFRpdGxlIHx8IHRoaXMuX2N1cnJlbnRUaXRsZTsgfVxuXHRnZXQgc2hlbGxUeXBlKCk6IFRlcm1pbmFsU2hlbGxUeXBlIHwgdW5kZWZpbmVkIHsgcmV0dXJuIGlzV2luZG93cyA/IHRoaXMuX3dpbmRvd3NTaGVsbEhlbHBlcj8uc2hlbGxUeXBlIDogcG9zaXhTaGVsbFR5cGVNYXAuZ2V0KHRoaXMuX2N1cnJlbnRUaXRsZSkgfHwgZ2VuZXJhbFNoZWxsVHlwZU1hcC5nZXQodGhpcy5fY3VycmVudFRpdGxlKTsgfVxuXHRnZXQgaGFzQ2hpbGRQcm9jZXNzZXMoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9jaGlsZFByb2Nlc3NNb25pdG9yPy5oYXNDaGlsZFByb2Nlc3NlcyB8fCBmYWxzZTsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc0RhdGEgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NEYXRhID0gdGhpcy5fb25Qcm9jZXNzRGF0YS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25Qcm9jZXNzUmVhZHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUHJvY2Vzc1JlYWR5RXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NSZWFkeSA9IHRoaXMuX29uUHJvY2Vzc1JlYWR5LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVByb3BlcnR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVByb2Nlc3NQcm9wZXJ0eTxhbnk+PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VQcm9wZXJ0eSA9IHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc0V4aXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NFeGl0ID0gdGhpcy5fb25Qcm9jZXNzRXhpdC5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBzaGVsbExhdW5jaENvbmZpZzogSVNoZWxsTGF1bmNoQ29uZmlnLFxuXHRcdGN3ZDogc3RyaW5nLFxuXHRcdGNvbHM6IG51bWJlcixcblx0XHRyb3dzOiBudW1iZXIsXG5cdFx0ZW52OiBJUHJvY2Vzc0Vudmlyb25tZW50LFxuXHRcdC8qKlxuXHRcdCAqIGVudmlyb25tZW50IHVzZWQgZm9yIGBmaW5kRXhlY3V0YWJsZWBcblx0XHQgKi9cblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leGVjdXRhYmxlRW52OiBJUHJvY2Vzc0Vudmlyb25tZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IElUZXJtaW5hbFByb2Nlc3NPcHRpb25zLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRsZXQgbmFtZTogc3RyaW5nO1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdG5hbWUgPSBwYXRoLmJhc2VuYW1lKHRoaXMuc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSB8fCAnJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFVzaW5nICd4dGVybS0yNTZjb2xvcicgaGVyZSBoZWxwcyBlbnN1cmUgdGhhdCB0aGUgbWFqb3JpdHkgb2YgTGludXggZGlzdHJpYnV0aW9ucyB3aWxsIHVzZSBhXG5cdFx0XHQvLyBjb2xvciBwcm9tcHQgYXMgZGVmaW5lZCBpbiB0aGUgZGVmYXVsdCB+Ly5iYXNocmMgZmlsZS5cblx0XHRcdG5hbWUgPSAneHRlcm0tMjU2Y29sb3InO1xuXHRcdH1cblx0XHR0aGlzLl9pbml0aWFsQ3dkID0gY3dkO1xuXHRcdHRoaXMuX3Byb3BlcnRpZXNbUHJvY2Vzc1Byb3BlcnR5VHlwZS5Jbml0aWFsQ3dkXSA9IHRoaXMuX2luaXRpYWxDd2Q7XG5cdFx0dGhpcy5fcHJvcGVydGllc1tQcm9jZXNzUHJvcGVydHlUeXBlLkN3ZF0gPSB0aGlzLl9pbml0aWFsQ3dkO1xuXHRcdGNvbnN0IHVzZUNvbnB0eSA9IHRoaXMuX29wdGlvbnMud2luZG93c0VuYWJsZUNvbnB0eSAmJiBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInICYmIGdldFdpbmRvd3NCdWlsZE51bWJlcigpID49IDE4MzA5O1xuXHRcdGNvbnN0IHVzZUNvbnB0eURsbCA9IHVzZUNvbnB0eSAmJiB0aGlzLl9vcHRpb25zLndpbmRvd3NVc2VDb25wdHlEbGw7XG5cdFx0dGhpcy5fcHR5T3B0aW9ucyA9IHtcblx0XHRcdG5hbWUsXG5cdFx0XHRjd2QsXG5cdFx0XHQvLyBUT0RPOiBXaGVuIG5vZGUtcHR5IGlzIHVwZGF0ZWQgdGhpcyBjYXN0IGNhbiBiZSByZW1vdmVkXG5cdFx0XHRlbnY6IGVudiBhcyB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9LFxuXHRcdFx0Y29scyxcblx0XHRcdHJvd3MsXG5cdFx0XHR1c2VDb25wdHksXG5cdFx0XHR1c2VDb25wdHlEbGwsXG5cdFx0XHQvLyBUaGlzIG9wdGlvbiB3aWxsIGZvcmNlIGNvbnB0eSB0byBub3QgcmVkcmF3IHRoZSB3aG9sZSB2aWV3cG9ydCBvbiBsYXVuY2hcblx0XHRcdGNvbnB0eUluaGVyaXRDdXJzb3I6IHVzZUNvbnB0eSAmJiAhIXNoZWxsTGF1bmNoQ29uZmlnLmluaXRpYWxUZXh0XG5cdFx0fTtcblx0XHQvLyBEZWxheSByZXNpemVzIHRvIGF2b2lkIGNvbnB0eSBub3QgcmVzcGVjdGluZyB2ZXJ5IGVhcmx5IHJlc2l6ZSBjYWxsc1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGlmICh1c2VDb25wdHkgJiYgY29scyA9PT0gMCAmJiByb3dzID09PSAwICYmIHRoaXMuc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZT8uZW5kc1dpdGgoJ0dpdFxcXFxiaW5cXFxcYmFzaC5leGUnKSkge1xuXHRcdFx0XHR0aGlzLl9kZWxheWVkUmVzaXplciA9IG5ldyBEZWxheWVkUmVzaXplcigpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kZWxheWVkUmVzaXplci5vblRyaWdnZXIoZGltZW5zaW9ucyA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fZGVsYXllZFJlc2l6ZXI/LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR0aGlzLl9kZWxheWVkUmVzaXplciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRpZiAoZGltZW5zaW9ucy5jb2xzICYmIGRpbWVuc2lvbnMucm93cykge1xuXHRcdFx0XHRcdFx0dGhpcy5yZXNpemUoZGltZW5zaW9ucy5jb2xzLCBkaW1lbnNpb25zLnJvd3MpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gV2luZG93c1NoZWxsSGVscGVyIGlzIHVzZWQgdG8gZmV0Y2ggdGhlIHByb2Nlc3MgdGl0bGUgYW5kIHNoZWxsIHR5cGVcblx0XHRcdHRoaXMub25Qcm9jZXNzUmVhZHkoZSA9PiB7XG5cdFx0XHRcdHRoaXMuX3dpbmRvd3NTaGVsbEhlbHBlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBXaW5kb3dzU2hlbGxIZWxwZXIoZS5waWQpKTtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fd2luZG93c1NoZWxsSGVscGVyLm9uU2hlbGxUeXBlQ2hhbmdlZChlID0+IHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZmlyZSh7IHR5cGU6IFByb2Nlc3NQcm9wZXJ0eVR5cGUuU2hlbGxUeXBlLCB2YWx1ZTogZSB9KSkpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl93aW5kb3dzU2hlbGxIZWxwZXIub25TaGVsbE5hbWVDaGFuZ2VkKGUgPT4gdGhpcy5fb25EaWRDaGFuZ2VQcm9wZXJ0eS5maXJlKHsgdHlwZTogUHJvY2Vzc1Byb3BlcnR5VHlwZS5UaXRsZSwgdmFsdWU6IGUgfSkpKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3RpdGxlSW50ZXJ2YWwpIHtcblx0XHRcdFx0Y2xlYXJJbnRlcnZhbCh0aGlzLl90aXRsZUludGVydmFsKTtcblx0XHRcdFx0dGhpcy5fdGl0bGVJbnRlcnZhbCA9IG51bGw7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0YXN5bmMgc3RhcnQoKTogUHJvbWlzZTxJVGVybWluYWxMYXVuY2hFcnJvciB8IHsgaW5qZWN0ZWRBcmdzOiBzdHJpbmdbXSB9IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLl92YWxpZGF0ZUN3ZCgpLCB0aGlzLl92YWxpZGF0ZUV4ZWN1dGFibGUoKV0pO1xuXHRcdGNvbnN0IGZpcnN0RXJyb3IgPSByZXN1bHRzLmZpbmQociA9PiByICE9PSB1bmRlZmluZWQpO1xuXHRcdGlmIChmaXJzdEVycm9yKSB7XG5cdFx0XHRyZXR1cm4gZmlyc3RFcnJvcjtcblx0XHR9XG5cblx0XHRsZXQgaW5qZWN0aW9uOiBJU2hlbGxJbnRlZ3JhdGlvbkNvbmZpZ0luamVjdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5fb3B0aW9ucy5zaGVsbEludGVncmF0aW9uLmVuYWJsZWQpIHtcblx0XHRcdGluamVjdGlvbiA9IGF3YWl0IGdldFNoZWxsSW50ZWdyYXRpb25JbmplY3Rpb24odGhpcy5zaGVsbExhdW5jaENvbmZpZywgdGhpcy5fb3B0aW9ucywgdGhpcy5fcHR5T3B0aW9ucy5lbnYsIHRoaXMuX2xvZ1NlcnZpY2UsIHRoaXMuX3Byb2R1Y3RTZXJ2aWNlKTtcblx0XHRcdGlmIChpbmplY3Rpb24pIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VQcm9wZXJ0eS5maXJlKHsgdHlwZTogUHJvY2Vzc1Byb3BlcnR5VHlwZS5Vc2VkU2hlbGxJbnRlZ3JhdGlvbkluamVjdGlvbiwgdmFsdWU6IHRydWUgfSk7XG5cdFx0XHRcdGlmIChpbmplY3Rpb24uZW52TWl4aW4pIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhpbmplY3Rpb24uZW52TWl4aW4pKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9wdHlPcHRpb25zLmVudiB8fD0ge307XG5cdFx0XHRcdFx0XHR0aGlzLl9wdHlPcHRpb25zLmVudltrZXldID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChpbmplY3Rpb24uZmlsZXNUb0NvcHkpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGYgb2YgaW5qZWN0aW9uLmZpbGVzVG9Db3B5KSB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihwYXRoLmRpcm5hbWUoZi5kZXN0KSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IGZzLnByb21pc2VzLmNvcHlGaWxlKGYuc291cmNlLCBmLmRlc3QpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdFx0XHRcdC8vIFN3YWxsb3cgZXJyb3IsIHRoaXMgc2hvdWxkIG9ubHkgaGFwcGVuIHdoZW4gbXVsdGlwbGUgdXNlcnMgYXJlIG9uIHRoZSBzYW1lXG5cdFx0XHRcdFx0XHRcdC8vIG1hY2hpbmUuIFNpbmNlIHRoZSBzaGVsbCBpbnRlZ3JhdGlvbiBzY3JpcHRzIHJhcmVseSBjaGFuZ2UsIHBsdXMgdGhlIG90aGVyIHVzZXJcblx0XHRcdFx0XHRcdFx0Ly8gc2hvdWxkIGJlIHVzaW5nIHRoZSBzYW1lIHZlcnNpb24gb2YgdGhlIHNlcnZlciBpbiB0aGlzIGNhc2UsIGFzc3VtZSB0aGUgc2NyaXB0IGlzXG5cdFx0XHRcdFx0XHRcdC8vIGZpbmUgaWYgY29weSBmYWlscyBhbmQgc3dhbGxvdyB0aGUgZXJyb3IuXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVByb3BlcnR5LmZpcmUoeyB0eXBlOiBQcm9jZXNzUHJvcGVydHlUeXBlLkZhaWxlZFNoZWxsSW50ZWdyYXRpb25BY3RpdmF0aW9uLCB2YWx1ZTogdHJ1ZSB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5zZXR1cFB0eVByb2Nlc3ModGhpcy5zaGVsbExhdW5jaENvbmZpZywgdGhpcy5fcHR5T3B0aW9ucywgaW5qZWN0aW9uKTtcblx0XHRcdGlmIChpbmplY3Rpb24/Lm5ld0FyZ3MpIHtcblx0XHRcdFx0cmV0dXJuIHsgaW5qZWN0ZWRBcmdzOiBpbmplY3Rpb24ubmV3QXJncyB9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ25vZGUtcHR5Lm5vZGUtcHR5LklQdHkjc3Bhd24gbmF0aXZlIGV4Y2VwdGlvbicsIGVycik7XG5cdFx0XHRyZXR1cm4geyBtZXNzYWdlOiBgQSBuYXRpdmUgZXhjZXB0aW9uIG9jY3VycmVkIGR1cmluZyBsYXVuY2ggKCR7ZXJyLm1lc3NhZ2V9KWAgfTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF92YWxpZGF0ZUN3ZCgpOiBQcm9taXNlPHVuZGVmaW5lZCB8IElUZXJtaW5hbExhdW5jaEVycm9yPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZzLnByb21pc2VzLnN0YXQodGhpcy5faW5pdGlhbEN3ZCk7XG5cdFx0XHRpZiAoIXJlc3VsdC5pc0RpcmVjdG9yeSgpKSB7XG5cdFx0XHRcdHJldHVybiB7IG1lc3NhZ2U6IGxvY2FsaXplKCdsYXVuY2hGYWlsLmN3ZE5vdERpcmVjdG9yeScsIFwiU3RhcnRpbmcgZGlyZWN0b3J5IChjd2QpIFxcXCJ7MH1cXFwiIGlzIG5vdCBhIGRpcmVjdG9yeVwiLCB0aGlzLl9pbml0aWFsQ3dkLnRvU3RyaW5nKCkpIH07XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRpZiAoZXJyPy5jb2RlID09PSAnRU5PRU5UJykge1xuXHRcdFx0XHRyZXR1cm4geyBtZXNzYWdlOiBsb2NhbGl6ZSgnbGF1bmNoRmFpbC5jd2REb2VzTm90RXhpc3QnLCBcIlN0YXJ0aW5nIGRpcmVjdG9yeSAoY3dkKSBcXFwiezB9XFxcIiBkb2VzIG5vdCBleGlzdFwiLCB0aGlzLl9pbml0aWFsQ3dkLnRvU3RyaW5nKCkpIH07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZmlyZSh7IHR5cGU6IFByb2Nlc3NQcm9wZXJ0eVR5cGUuSW5pdGlhbEN3ZCwgdmFsdWU6IHRoaXMuX2luaXRpYWxDd2QgfSk7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3ZhbGlkYXRlRXhlY3V0YWJsZSgpOiBQcm9taXNlPHVuZGVmaW5lZCB8IElUZXJtaW5hbExhdW5jaEVycm9yPiB7XG5cdFx0Y29uc3Qgc2xjID0gdGhpcy5zaGVsbExhdW5jaENvbmZpZztcblx0XHRpZiAoIXNsYy5leGVjdXRhYmxlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0lTaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlIG5vdCBzZXQnKTtcblx0XHR9XG5cblx0XHRjb25zdCBjd2QgPSBzbGMuY3dkIGluc3RhbmNlb2YgVVJJID8gc2xjLmN3ZC5wYXRoIDogc2xjLmN3ZDtcblx0XHRjb25zdCBlbnZQYXRoczogc3RyaW5nW10gfCB1bmRlZmluZWQgPSAoc2xjLmVudiAmJiBzbGMuZW52LlBBVEgpID8gc2xjLmVudi5QQVRILnNwbGl0KHBhdGguZGVsaW1pdGVyKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBleGVjdXRhYmxlID0gYXdhaXQgZmluZEV4ZWN1dGFibGUoc2xjLmV4ZWN1dGFibGUsIGN3ZCwgZW52UGF0aHMsIHRoaXMuX2V4ZWN1dGFibGVFbnYpO1xuXHRcdGlmICghZXhlY3V0YWJsZSkge1xuXHRcdFx0cmV0dXJuIHsgbWVzc2FnZTogbG9jYWxpemUoJ2xhdW5jaEZhaWwuZXhlY3V0YWJsZURvZXNOb3RFeGlzdCcsIFwiUGF0aCB0byBzaGVsbCBleGVjdXRhYmxlIFxcXCJ7MH1cXFwiIGRvZXMgbm90IGV4aXN0XCIsIHNsYy5leGVjdXRhYmxlKSB9O1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBmcy5wcm9taXNlcy5zdGF0KGV4ZWN1dGFibGUpO1xuXHRcdFx0aWYgKCFyZXN1bHQuaXNGaWxlKCkgJiYgIXJlc3VsdC5pc1N5bWJvbGljTGluaygpKSB7XG5cdFx0XHRcdHJldHVybiB7IG1lc3NhZ2U6IGxvY2FsaXplKCdsYXVuY2hGYWlsLmV4ZWN1dGFibGVJc05vdEZpbGVPclN5bWxpbmsnLCBcIlBhdGggdG8gc2hlbGwgZXhlY3V0YWJsZSBcXFwiezB9XFxcIiBpcyBub3QgYSBmaWxlIG9yIGEgc3ltbGlua1wiLCBzbGMuZXhlY3V0YWJsZSkgfTtcblx0XHRcdH1cblx0XHRcdC8vIFNldCB0aGUgZXhlY3V0YWJsZSBleHBsaWNpdGx5IGhlcmUgc28gdGhhdCBub2RlLXB0eSBkb2Vzbid0IG5lZWQgdG8gc2VhcmNoIHRoZVxuXHRcdFx0Ly8gJFBBVEggdG9vLlxuXHRcdFx0c2xjLmV4ZWN1dGFibGUgPSBleGVjdXRhYmxlO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0aWYgKGVycj8uY29kZSA9PT0gJ0VBQ0NFUycpIHtcblx0XHRcdFx0Ly8gU3dhbGxvd1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZXR1cFB0eVByb2Nlc3MoXG5cdFx0c2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyxcblx0XHRvcHRpb25zOiBJUHR5Rm9ya09wdGlvbnMsXG5cdFx0c2hlbGxJbnRlZ3JhdGlvbkluamVjdGlvbjogSVNoZWxsSW50ZWdyYXRpb25Db25maWdJbmplY3Rpb24gfCB1bmRlZmluZWRcblx0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgYXJncyA9IHNoZWxsSW50ZWdyYXRpb25JbmplY3Rpb24/Lm5ld0FyZ3MgfHwgc2hlbGxMYXVuY2hDb25maWcuYXJncyB8fCBbXTtcblx0XHRhd2FpdCB0aGlzLl90aHJvdHRsZUtpbGxTcGF3bigpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ25vZGUtcHR5LklQdHkjc3Bhd24nLCBzaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlLCBhcmdzLCBvcHRpb25zKTtcblx0XHRjb25zdCBwdHlQcm9jZXNzID0gc3Bhd24oc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSEsIGFyZ3MsIG9wdGlvbnMpO1xuXHRcdHRoaXMuX3B0eVByb2Nlc3MgPSBwdHlQcm9jZXNzO1xuXHRcdHRoaXMuX2NoaWxkUHJvY2Vzc01vbml0b3IgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ2hpbGRQcm9jZXNzTW9uaXRvcihwdHlQcm9jZXNzLnBpZCwgdGhpcy5fbG9nU2VydmljZSkpO1xuXHRcdHRoaXMuX2NoaWxkUHJvY2Vzc01vbml0b3Iub25EaWRDaGFuZ2VIYXNDaGlsZFByb2Nlc3Nlcyh2YWx1ZSA9PiB0aGlzLl9vbkRpZENoYW5nZVByb3BlcnR5LmZpcmUoeyB0eXBlOiBQcm9jZXNzUHJvcGVydHlUeXBlLkhhc0NoaWxkUHJvY2Vzc2VzLCB2YWx1ZSB9KSk7XG5cdFx0dGhpcy5fcHJvY2Vzc1N0YXJ0dXBDb21wbGV0ZSA9IG5ldyBQcm9taXNlPHZvaWQ+KGMgPT4ge1xuXHRcdFx0dGhpcy5vblByb2Nlc3NSZWFkeSgoKSA9PiBjKCkpO1xuXHRcdH0pO1xuXHRcdHB0eVByb2Nlc3Mub25EYXRhKGRhdGEgPT4ge1xuXHRcdFx0Ly8gSGFuZGxlIGZsb3cgY29udHJvbFxuXHRcdFx0dGhpcy5fdW5hY2tub3dsZWRnZWRDaGFyQ291bnQgKz0gZGF0YS5sZW5ndGg7XG5cdFx0XHRpZiAoIXRoaXMuX2lzUHR5UGF1c2VkICYmIHRoaXMuX3VuYWNrbm93bGVkZ2VkQ2hhckNvdW50ID4gRmxvd0NvbnRyb2xDb25zdGFudHMuSGlnaFdhdGVybWFya0NoYXJzKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYEZsb3cgY29udHJvbDogUGF1c2UgKCR7dGhpcy5fdW5hY2tub3dsZWRnZWRDaGFyQ291bnR9ID4gJHtGbG93Q29udHJvbENvbnN0YW50cy5IaWdoV2F0ZXJtYXJrQ2hhcnN9KWApO1xuXHRcdFx0XHR0aGlzLl9pc1B0eVBhdXNlZCA9IHRydWU7XG5cdFx0XHRcdHB0eVByb2Nlc3MucGF1c2UoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVmaXJlIHRoZSBkYXRhIGV2ZW50XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdub2RlLXB0eS5JUHR5I29uRGF0YScsIGRhdGEpO1xuXHRcdFx0dGhpcy5fb25Qcm9jZXNzRGF0YS5maXJlKGRhdGEpO1xuXHRcdFx0aWYgKHRoaXMuX2Nsb3NlVGltZW91dCkge1xuXHRcdFx0XHR0aGlzLl9xdWV1ZVByb2Nlc3NFeGl0KCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl93aW5kb3dzU2hlbGxIZWxwZXI/LmNoZWNrU2hlbGwoKTtcblx0XHRcdHRoaXMuX2NoaWxkUHJvY2Vzc01vbml0b3I/LmhhbmRsZU91dHB1dCgpO1xuXHRcdH0pO1xuXHRcdHB0eVByb2Nlc3Mub25FeGl0KGUgPT4ge1xuXHRcdFx0dGhpcy5fZXhpdENvZGUgPSBlLmV4aXRDb2RlO1xuXHRcdFx0dGhpcy5fcXVldWVQcm9jZXNzRXhpdCgpO1xuXHRcdH0pO1xuXHRcdHRoaXMuX3NlbmRQcm9jZXNzSWQocHR5UHJvY2Vzcy5waWQpO1xuXHRcdHRoaXMuX3NldHVwVGl0bGVQb2xsaW5nKHB0eVByb2Nlc3MpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0dXBUaXRsZVBvbGxpbmcocHR5UHJvY2VzczogSVB0eSkge1xuXHRcdC8vIFNlbmQgaW5pdGlhbCB0aW1lb3V0IGFzeW5jIHRvIGdpdmUgZXZlbnQgbGlzdGVuZXJzIGEgY2hhbmNlIHRvIGluaXRcblx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3NlbmRQcm9jZXNzVGl0bGUocHR5UHJvY2VzcykpO1xuXHRcdC8vIFNldHVwIHBvbGxpbmcgZm9yIG5vbi1XaW5kb3dzLCBmb3IgV2luZG93cyBgcHJvY2Vzc2AgZG9lc24ndCBjaGFuZ2Vcblx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0dGhpcy5fdGl0bGVJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRUaXRsZSAhPT0gcHR5UHJvY2Vzcy5wcm9jZXNzKSB7XG5cdFx0XHRcdFx0dGhpcy5fc2VuZFByb2Nlc3NUaXRsZShwdHlQcm9jZXNzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMjAwKTtcblx0XHR9XG5cdH1cblxuXHQvLyBBbGxvdyBhbnkgdHJhaWxpbmcgZGF0YSBldmVudHMgdG8gYmUgc2VudCBiZWZvcmUgdGhlIGV4aXQgZXZlbnQgaXMgc2VudC5cblx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9UeXJpYXIvbm9kZS1wdHkvaXNzdWVzLzcyXG5cdHByaXZhdGUgX3F1ZXVlUHJvY2Vzc0V4aXQoKSB7XG5cdFx0aWYgKHRoaXMuX2xvZ1NlcnZpY2UuZ2V0TGV2ZWwoKSA9PT0gTG9nTGV2ZWwuVHJhY2UpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1Rlcm1pbmFsUHJvY2VzcyNfcXVldWVQcm9jZXNzRXhpdCcsIG5ldyBFcnJvcigpLnN0YWNrPy5yZXBsYWNlKC9eRXJyb3IvLCAnJykpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fY2xvc2VUaW1lb3V0KSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5fY2xvc2VUaW1lb3V0KTtcblx0XHR9XG5cdFx0dGhpcy5fY2xvc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jbG9zZVRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLl9raWxsKCk7XG5cdFx0fSwgU2h1dGRvd25Db25zdGFudHMuRGF0YUZsdXNoVGltZW91dCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9raWxsKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIFdhaXQgdG8ga2lsbCB0byBwcm9jZXNzIHVudGlsIHRoZSBzdGFydCB1cCBjb2RlIGhhcyBydW4uIFRoaXMgcHJldmVudHMgdXMgZnJvbSBmaXJpbmcgYSBwcm9jZXNzIGV4aXQgYmVmb3JlIGFcblx0XHQvLyBwcm9jZXNzIHN0YXJ0LlxuXHRcdGF3YWl0IHRoaXMuX3Byb2Nlc3NTdGFydHVwQ29tcGxldGU7XG5cdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gQXR0ZW1wdCB0byBraWxsIHRoZSBwdHksIGl0IG1heSBoYXZlIGFscmVhZHkgYmVlbiBraWxsZWQgYXQgdGhpc1xuXHRcdC8vIHBvaW50IGJ1dCB3ZSB3YW50IHRvIG1ha2Ugc3VyZVxuXHRcdHRyeSB7XG5cdFx0XHRpZiAodGhpcy5fcHR5UHJvY2Vzcykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl90aHJvdHRsZUtpbGxTcGF3bigpO1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdub2RlLXB0eS5JUHR5I2tpbGwnKTtcblx0XHRcdFx0dGhpcy5fcHR5UHJvY2Vzcy5raWxsKCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXgpIHtcblx0XHRcdC8vIFN3YWxsb3csIHRoZSBwdHkgaGFzIGFscmVhZHkgYmVlbiBraWxsZWRcblx0XHR9XG5cdFx0dGhpcy5fb25Qcm9jZXNzRXhpdC5maXJlKHRoaXMuX2V4aXRDb2RlIHx8IDApO1xuXHRcdHRoaXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfdGhyb3R0bGVLaWxsU3Bhd24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gT25seSB0aHJvdHRsZSBvbiBXaW5kb3dzL2NvbnB0eVxuXHRcdGlmICghaXNXaW5kb3dzIHx8ICEoJ3VzZUNvbnB0eScgaW4gdGhpcy5fcHR5T3B0aW9ucykgfHwgIXRoaXMuX3B0eU9wdGlvbnMudXNlQ29ucHR5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIERvbid0IHRocm90dGxlIHdoZW4gdXNpbmcgY29ucHR5LmRsbCBhcyBpdCBzZWVtcyB0byBoYXZlIGJlZW4gZml4ZWQgaW4gbGF0ZXIgdmVyc2lvbnNcblx0XHRpZiAodGhpcy5fcHR5T3B0aW9ucy51c2VDb25wdHlEbGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gVXNlIGEgbG9vcCB0byBlbnN1cmUgbXVsdGlwbGUgY2FsbHMgaW4gYSBzaW5nbGUgaW50ZXJ2YWwgc3BhY2Ugb3V0XG5cdFx0d2hpbGUgKERhdGUubm93KCkgLSBUZXJtaW5hbFByb2Nlc3MuX2xhc3RLaWxsT3JTdGFydCA8IENvbnN0YW50cy5LaWxsU3Bhd25UaHJvdHRsZUludGVydmFsKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdUaHJvdHRsaW5nIGtpbGwvc3Bhd24gY2FsbCcpO1xuXHRcdFx0YXdhaXQgdGltZW91dChDb25zdGFudHMuS2lsbFNwYXduVGhyb3R0bGVJbnRlcnZhbCAtIChEYXRlLm5vdygpIC0gVGVybWluYWxQcm9jZXNzLl9sYXN0S2lsbE9yU3RhcnQpICsgQ29uc3RhbnRzLktpbGxTcGF3blNwYWNpbmdEdXJhdGlvbik7XG5cdFx0fVxuXHRcdFRlcm1pbmFsUHJvY2Vzcy5fbGFzdEtpbGxPclN0YXJ0ID0gRGF0ZS5ub3coKTtcblx0fVxuXG5cdHByaXZhdGUgX3NlbmRQcm9jZXNzSWQocGlkOiBudW1iZXIpIHtcblx0XHR0aGlzLl9vblByb2Nlc3NSZWFkeS5maXJlKHtcblx0XHRcdHBpZCxcblx0XHRcdGN3ZDogdGhpcy5faW5pdGlhbEN3ZCxcblx0XHRcdHdpbmRvd3NQdHk6IHRoaXMuZ2V0V2luZG93c1B0eSgpXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZW5kUHJvY2Vzc1RpdGxlKHB0eVByb2Nlc3M6IElQdHkpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBIQUNLOiBUaGUgbm9kZS1wdHkgQVBJIGNhbiByZXR1cm4gdW5kZWZpbmVkIHNvbWVob3cgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIyMjMyM1xuXHRcdHRoaXMuX2N1cnJlbnRUaXRsZSA9IChwdHlQcm9jZXNzLnByb2Nlc3MgPz8gJycpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZmlyZSh7IHR5cGU6IFByb2Nlc3NQcm9wZXJ0eVR5cGUuVGl0bGUsIHZhbHVlOiB0aGlzLl9jdXJyZW50VGl0bGUgfSk7XG5cdFx0Ly8gSWYgZmlnIGlzIGluc3RhbGxlZCBpdCBtYXkgY2hhbmdlIHRoZSB0aXRsZSBvZiB0aGUgcHJvY2Vzc1xuXHRcdGxldCBzYW5pdGl6ZWRUaXRsZSA9IHRoaXMuY3VycmVudFRpdGxlLnJlcGxhY2UoLyBcXChmaWd0ZXJtXFwpJC9nLCAnJyk7XG5cdFx0Ly8gRW5zdXJlIGFueSBwcmVmaXhlZCBwYXRoIGlzIHJlbW92ZWQgc28gdGhhdCB0aGUgZXhlY3V0YWJsZSBuYW1lIHNpbmNlIHdlIHVzZSB0aGlzIHRvXG5cdFx0Ly8gZGV0ZWN0IHRoZSBzaGVsbCB0eXBlXG5cdFx0aWYgKCFpc1dpbmRvd3MpIHtcblx0XHRcdHNhbml0aXplZFRpdGxlID0gcGF0aC5iYXNlbmFtZShzYW5pdGl6ZWRUaXRsZSk7XG5cdFx0fVxuXG5cdFx0aWYgKHNhbml0aXplZFRpdGxlLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aCgncHl0aG9uJykpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZmlyZSh7IHR5cGU6IFByb2Nlc3NQcm9wZXJ0eVR5cGUuU2hlbGxUeXBlLCB2YWx1ZTogR2VuZXJhbFNoZWxsVHlwZS5QeXRob24gfSk7XG5cdFx0fSBlbHNlIGlmIChzYW5pdGl6ZWRUaXRsZS50b0xvd2VyQ2FzZSgpLnN0YXJ0c1dpdGgoJ2p1bGlhJykpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZmlyZSh7IHR5cGU6IFByb2Nlc3NQcm9wZXJ0eVR5cGUuU2hlbGxUeXBlLCB2YWx1ZTogR2VuZXJhbFNoZWxsVHlwZS5KdWxpYSB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3Qgc2hlbGxUeXBlVmFsdWUgPSBwb3NpeFNoZWxsVHlwZU1hcC5nZXQoc2FuaXRpemVkVGl0bGUpIHx8IGdlbmVyYWxTaGVsbFR5cGVNYXAuZ2V0KHNhbml0aXplZFRpdGxlKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvcGVydHkuZmlyZSh7IHR5cGU6IFByb2Nlc3NQcm9wZXJ0eVR5cGUuU2hlbGxUeXBlLCB2YWx1ZTogc2hlbGxUeXBlVmFsdWUgfSk7XG5cdFx0fVxuXHR9XG5cblx0c2h1dGRvd24oaW1tZWRpYXRlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2xvZ1NlcnZpY2UuZ2V0TGV2ZWwoKSA9PT0gTG9nTGV2ZWwuVHJhY2UpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1Rlcm1pbmFsUHJvY2VzcyNzaHV0ZG93bicsIG5ldyBFcnJvcigpLnN0YWNrPy5yZXBsYWNlKC9eRXJyb3IvLCAnJykpO1xuXHRcdH1cblx0XHQvLyBkb24ndCBmb3JjZSBpbW1lZGlhdGUgZGlzcG9zYWwgb2YgdGhlIHRlcm1pbmFsIHByb2Nlc3NlcyBvbiBXaW5kb3dzIGFzIGFuIGFkZGl0aW9uYWxcblx0XHQvLyBtaXRpZ2F0aW9uIGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNzE5NjYgd2hpY2ggY2F1c2VzIHRoZSBwdHkgaG9zdFxuXHRcdC8vIHRvIGJlY29tZSB1bnJlc3BvbnNpdmUsIGRpc2Nvbm5lY3RpbmcgYWxsIHRlcm1pbmFscyBhY3Jvc3MgYWxsIHdpbmRvd3MuXG5cdFx0aWYgKGltbWVkaWF0ZSAmJiAhaXNXaW5kb3dzKSB7XG5cdFx0XHR0aGlzLl9raWxsKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICghdGhpcy5fY2xvc2VUaW1lb3V0ICYmICF0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHRoaXMuX3F1ZXVlUHJvY2Vzc0V4aXQoKTtcblx0XHRcdFx0Ly8gQWxsb3cgYSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIGZvciB0aGUgcHJvY2VzcyB0byBleGl0LCBvdGhlcndpc2UgZm9yY2Uga2lsbCBpdFxuXHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRpZiAodGhpcy5fY2xvc2VUaW1lb3V0ICYmICF0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9jbG9zZVRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHR0aGlzLl9raWxsKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCBTaHV0ZG93bkNvbnN0YW50cy5NYXhpbXVtU2h1dGRvd25UaW1lKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpbnB1dChkYXRhOiBzdHJpbmcsIGlzQmluYXJ5OiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCB8fCAhdGhpcy5fcHR5UHJvY2Vzcykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl93cml0ZVF1ZXVlLnB1c2goLi4uY2h1bmtJbnB1dChkYXRhKS5tYXAoZSA9PiB7XG5cdFx0XHRyZXR1cm4geyBpc0JpbmFyeSwgZGF0YTogZSB9O1xuXHRcdH0pKTtcblx0XHR0aGlzLl9zdGFydFdyaXRlKCk7XG5cdH1cblxuXHRhc3luYyBwcm9jZXNzQmluYXJ5KGRhdGE6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuaW5wdXQoZGF0YSwgdHJ1ZSk7XG5cdH1cblxuXHRhc3luYyByZWZyZXNoUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KHR5cGU6IFQpOiBQcm9taXNlPElQcm9jZXNzUHJvcGVydHlNYXBbVF0+IHtcblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdGNhc2UgUHJvY2Vzc1Byb3BlcnR5VHlwZS5Dd2Q6IHtcblx0XHRcdFx0Y29uc3QgbmV3Q3dkID0gYXdhaXQgdGhpcy5nZXRDd2QoKTtcblx0XHRcdFx0aWYgKG5ld0N3ZCAhPT0gdGhpcy5fcHJvcGVydGllcy5jd2QpIHtcblx0XHRcdFx0XHR0aGlzLl9wcm9wZXJ0aWVzLmN3ZCA9IG5ld0N3ZDtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVByb3BlcnR5LmZpcmUoeyB0eXBlOiBQcm9jZXNzUHJvcGVydHlUeXBlLkN3ZCwgdmFsdWU6IHRoaXMuX3Byb3BlcnRpZXMuY3dkIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBuZXdDd2QgYXMgSVByb2Nlc3NQcm9wZXJ0eU1hcFtUXTtcblx0XHRcdH1cblx0XHRcdGNhc2UgUHJvY2Vzc1Byb3BlcnR5VHlwZS5Jbml0aWFsQ3dkOiB7XG5cdFx0XHRcdGNvbnN0IGluaXRpYWxDd2QgPSBhd2FpdCB0aGlzLmdldEluaXRpYWxDd2QoKTtcblx0XHRcdFx0aWYgKGluaXRpYWxDd2QgIT09IHRoaXMuX3Byb3BlcnRpZXMuaW5pdGlhbEN3ZCkge1xuXHRcdFx0XHRcdHRoaXMuX3Byb3BlcnRpZXMuaW5pdGlhbEN3ZCA9IGluaXRpYWxDd2Q7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VQcm9wZXJ0eS5maXJlKHsgdHlwZTogUHJvY2Vzc1Byb3BlcnR5VHlwZS5Jbml0aWFsQ3dkLCB2YWx1ZTogdGhpcy5fcHJvcGVydGllcy5pbml0aWFsQ3dkIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBpbml0aWFsQ3dkIGFzIElQcm9jZXNzUHJvcGVydHlNYXBbVF07XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFByb2Nlc3NQcm9wZXJ0eVR5cGUuVGl0bGU6XG5cdFx0XHRcdHJldHVybiB0aGlzLmN1cnJlbnRUaXRsZSBhcyBJUHJvY2Vzc1Byb3BlcnR5TWFwW1RdO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2hlbGxUeXBlIGFzIElQcm9jZXNzUHJvcGVydHlNYXBbVF07XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgdXBkYXRlUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KHR5cGU6IFQsIHZhbHVlOiBJUHJvY2Vzc1Byb3BlcnR5TWFwW1RdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHR5cGUgPT09IFByb2Nlc3NQcm9wZXJ0eVR5cGUuRml4ZWREaW1lbnNpb25zKSB7XG5cdFx0XHR0aGlzLl9wcm9wZXJ0aWVzLmZpeGVkRGltZW5zaW9ucyA9IHZhbHVlIGFzIElQcm9jZXNzUHJvcGVydHlNYXBbUHJvY2Vzc1Byb3BlcnR5VHlwZS5GaXhlZERpbWVuc2lvbnNdO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3N0YXJ0V3JpdGUoKTogdm9pZCB7XG5cdFx0Ly8gRG9uJ3Qgd3JpdGUgaWYgaXQncyBhbHJlYWR5IHF1ZXVlZCBvZiBpcyB0aGVyZSBpcyBub3RoaW5nIHRvIHdyaXRlXG5cdFx0aWYgKHRoaXMuX3dyaXRlVGltZW91dCAhPT0gdW5kZWZpbmVkIHx8IHRoaXMuX3dyaXRlUXVldWUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZG9Xcml0ZSgpO1xuXG5cdFx0Ly8gRG9uJ3QgcXVldWUgbW9yZSB3cml0ZXMgaWYgdGhlIHF1ZXVlIGlzIGVtcHR5XG5cdFx0aWYgKHRoaXMuX3dyaXRlUXVldWUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLl93cml0ZVRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gUXVldWUgdGhlIG5leHQgd3JpdGVcblx0XHR0aGlzLl93cml0ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuX3dyaXRlVGltZW91dCA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3N0YXJ0V3JpdGUoKTtcblx0XHR9LCBDb25zdGFudHMuV3JpdGVJbnRlcnZhbCk7XG5cdH1cblxuXHRwcml2YXRlIF9kb1dyaXRlKCk6IHZvaWQge1xuXHRcdGNvbnN0IG9iamVjdCA9IHRoaXMuX3dyaXRlUXVldWUuc2hpZnQoKSE7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnbm9kZS1wdHkuSVB0eSN3cml0ZScsIG9iamVjdC5kYXRhKTtcblx0XHRpZiAob2JqZWN0LmlzQmluYXJ5KSB7XG5cdFx0XHR0aGlzLl9wdHlQcm9jZXNzIS53cml0ZShCdWZmZXIuZnJvbShvYmplY3QuZGF0YSwgJ2JpbmFyeScpIGFzIGFueSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3B0eVByb2Nlc3MhLndyaXRlKG9iamVjdC5kYXRhKTtcblx0XHR9XG5cdFx0dGhpcy5fY2hpbGRQcm9jZXNzTW9uaXRvcj8uaGFuZGxlSW5wdXQoKTtcblx0fVxuXG5cdHJlc2l6ZShjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgY29scyAhPT0gJ251bWJlcicgfHwgdHlwZW9mIHJvd3MgIT09ICdudW1iZXInIHx8IGlzTmFOKGNvbHMpIHx8IGlzTmFOKHJvd3MpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIEVuc3VyZSB0aGF0IGNvbHMgYW5kIHJvd3MgYXJlIGFsd2F5cyA+PSAxLCB0aGlzIHByZXZlbnRzIGEgbmF0aXZlXG5cdFx0Ly8gZXhjZXB0aW9uIGluIHdpbnB0eS5cblx0XHRpZiAodGhpcy5fcHR5UHJvY2Vzcykge1xuXHRcdFx0Y29scyA9IE1hdGgubWF4KGNvbHMsIDEpO1xuXHRcdFx0cm93cyA9IE1hdGgubWF4KHJvd3MsIDEpO1xuXG5cdFx0XHQvLyBEZWxheSByZXNpemUgaWYgbmVlZGVkXG5cdFx0XHRpZiAodGhpcy5fZGVsYXllZFJlc2l6ZXIpIHtcblx0XHRcdFx0dGhpcy5fZGVsYXllZFJlc2l6ZXIuY29scyA9IGNvbHM7XG5cdFx0XHRcdHRoaXMuX2RlbGF5ZWRSZXNpemVyLnJvd3MgPSByb3dzO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ25vZGUtcHR5LklQdHkjcmVzaXplJywgY29scywgcm93cyk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLl9wdHlQcm9jZXNzLnJlc2l6ZShjb2xzLCByb3dzKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Ly8gU3dhbGxvdyBlcnJvciBpZiB0aGUgcHR5IGhhcyBhbHJlYWR5IGV4aXRlZFxuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdub2RlLXB0eS5JUHR5I3Jlc2l6ZSBleGNlcHRpb24gJyArIGUubWVzc2FnZSk7XG5cdFx0XHRcdGlmICh0aGlzLl9leGl0Q29kZSAhPT0gdW5kZWZpbmVkICYmXG5cdFx0XHRcdFx0ZS5tZXNzYWdlICE9PSAnaW9jdGwoMikgZmFpbGVkLCBFQkFERicgJiZcblx0XHRcdFx0XHRlLm1lc3NhZ2UgIT09ICdDYW5ub3QgcmVzaXplIGEgcHR5IHRoYXQgaGFzIGFscmVhZHkgZXhpdGVkJykge1xuXHRcdFx0XHRcdHRocm93IGU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRjbGVhckJ1ZmZlcigpOiB2b2lkIHtcblx0XHR0aGlzLl9wdHlQcm9jZXNzPy5jbGVhcigpO1xuXHR9XG5cblx0YWNrbm93bGVkZ2VEYXRhRXZlbnQoY2hhckNvdW50OiBudW1iZXIpOiB2b2lkIHtcblx0XHQvLyBQcmV2ZW50IGxvd2VyIHRoYW4gMCB0byBoZWFsIGZyb20gZXJyb3JzXG5cdFx0dGhpcy5fdW5hY2tub3dsZWRnZWRDaGFyQ291bnQgPSBNYXRoLm1heCh0aGlzLl91bmFja25vd2xlZGdlZENoYXJDb3VudCAtIGNoYXJDb3VudCwgMCk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgRmxvdyBjb250cm9sOiBBY2sgJHtjaGFyQ291bnR9IGNoYXJzICh1bmFja25vd2xlZGdlZDogJHt0aGlzLl91bmFja25vd2xlZGdlZENoYXJDb3VudH0pYCk7XG5cdFx0aWYgKHRoaXMuX2lzUHR5UGF1c2VkICYmIHRoaXMuX3VuYWNrbm93bGVkZ2VkQ2hhckNvdW50IDwgRmxvd0NvbnRyb2xDb25zdGFudHMuTG93V2F0ZXJtYXJrQ2hhcnMpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYEZsb3cgY29udHJvbDogUmVzdW1lICgke3RoaXMuX3VuYWNrbm93bGVkZ2VkQ2hhckNvdW50fSA8ICR7Rmxvd0NvbnRyb2xDb25zdGFudHMuTG93V2F0ZXJtYXJrQ2hhcnN9KWApO1xuXHRcdFx0dGhpcy5fcHR5UHJvY2Vzcz8ucmVzdW1lKCk7XG5cdFx0XHR0aGlzLl9pc1B0eVBhdXNlZCA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGNsZWFyVW5hY2tub3dsZWRnZWRDaGFycygpOiB2b2lkIHtcblx0XHR0aGlzLl91bmFja25vd2xlZGdlZENoYXJDb3VudCA9IDA7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgRmxvdyBjb250cm9sOiBDbGVhcmVkIGFsbCB1bmFja25vd2xlZGdlZCBjaGFycywgZm9yY2luZyByZXN1bWVgKTtcblx0XHRpZiAodGhpcy5faXNQdHlQYXVzZWQpIHtcblx0XHRcdHRoaXMuX3B0eVByb2Nlc3M/LnJlc3VtZSgpO1xuXHRcdFx0dGhpcy5faXNQdHlQYXVzZWQgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzZXRVbmljb2RlVmVyc2lvbih2ZXJzaW9uOiAnNicgfCAnMTEnKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gTm8tb3Bcblx0fVxuXG5cdGdldEluaXRpYWxDd2QoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2luaXRpYWxDd2QpO1xuXHR9XG5cblx0YXN5bmMgZ2V0Q3dkKCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHQvLyBGcm9tIEJpZyBTdXIgKGRhcndpbiB2MjApIHRoZXJlIGlzIGEgc3Bhd24gYmxvY2tpbmcgdGhyZWFkIGlzc3VlIG9uIEVsZWN0cm9uLFxuXHRcdFx0Ly8gdGhpcyBpcyBmaXhlZCBpbiBWUyBDb2RlJ3MgaW50ZXJuYWwgRWxlY3Ryb24uXG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vTWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTA1NDQ2XG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPihyZXNvbHZlID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLl9wdHlQcm9jZXNzKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSh0aGlzLl9pbml0aWFsQ3dkKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnbm9kZS1wdHkuSVB0eSNwaWQnKTtcblx0XHRcdFx0ZXhlYygnbHNvZiAtT1BsbiAtcCAnICsgdGhpcy5fcHR5UHJvY2Vzcy5waWQgKyAnIHwgZ3JlcCBjd2QnLCB7IGVudjogeyAuLi5wcm9jZXNzLmVudiwgTEFORzogJ2VuX1VTLlVURi04JyB9IH0sIChlcnJvciwgc3Rkb3V0LCBzdGRlcnIpID0+IHtcblx0XHRcdFx0XHRpZiAoIWVycm9yICYmIHN0ZG91dCAhPT0gJycpIHtcblx0XHRcdFx0XHRcdHJlc29sdmUoc3Rkb3V0LnN1YnN0cmluZyhzdGRvdXQuaW5kZXhPZignLycpLCBzdGRvdXQubGVuZ3RoIC0gMSkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKCdsc29mIGRpZCBub3QgcnVuIHN1Y2Nlc3NmdWxseSwgaXQgbWF5IG5vdCBiZSBvbiB0aGUgJFBBVEg/JywgZXJyb3IsIHN0ZG91dCwgc3RkZXJyKTtcblx0XHRcdFx0XHRcdHJlc29sdmUodGhpcy5faW5pdGlhbEN3ZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChpc0xpbnV4KSB7XG5cdFx0XHRpZiAoIXRoaXMuX3B0eVByb2Nlc3MpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2luaXRpYWxDd2Q7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdub2RlLXB0eS5JUHR5I3BpZCcpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIGF3YWl0IGZzLnByb21pc2VzLnJlYWRsaW5rKGAvcHJvYy8ke3RoaXMuX3B0eVByb2Nlc3MucGlkfS9jd2RgKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9pbml0aWFsQ3dkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9pbml0aWFsQ3dkO1xuXHR9XG5cblx0Z2V0V2luZG93c1B0eSgpOiBJUHJvY2Vzc1JlYWR5V2luZG93c1B0eSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGlzV2luZG93cyA/IHtcblx0XHRcdGJhY2tlbmQ6ICd1c2VDb25wdHknIGluIHRoaXMuX3B0eU9wdGlvbnMgJiYgdGhpcy5fcHR5T3B0aW9ucy51c2VDb25wdHkgPyAnY29ucHR5JyA6ICd3aW5wdHknLFxuXHRcdFx0YnVpbGROdW1iZXI6IGdldFdpbmRvd3NCdWlsZE51bWJlcigpXG5cdFx0fSA6IHVuZGVmaW5lZDtcblx0fVxufVxuXG4vKipcbiAqIFRyYWNrcyB0aGUgbGF0ZXN0IHJlc2l6ZSBldmVudCB0byBiZSB0cmlnZ2VyIGF0IGEgbGF0ZXIgcG9pbnQuXG4gKi9cbmNsYXNzIERlbGF5ZWRSZXNpemVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHJvd3M6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0Y29sczogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF90aW1lb3V0OiBOb2RlSlMuVGltZW91dDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblRyaWdnZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IHJvd3M/OiBudW1iZXI7IGNvbHM/OiBudW1iZXIgfT4oKSk7XG5cdGdldCBvblRyaWdnZXIoKTogRXZlbnQ8eyByb3dzPzogbnVtYmVyOyBjb2xzPzogbnVtYmVyIH0+IHsgcmV0dXJuIHRoaXMuX29uVHJpZ2dlci5ldmVudDsgfVxuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fb25UcmlnZ2VyLmZpcmUoeyByb3dzOiB0aGlzLnJvd3MsIGNvbHM6IHRoaXMuY29scyB9KTtcblx0XHR9LCAxMDAwKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gY2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVvdXQpKSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxRQUFRO0FBQ3BCLFNBQVMsWUFBWTtB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
