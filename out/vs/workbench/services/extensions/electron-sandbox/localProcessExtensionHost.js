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
import { timeout } from "../../../../base/common/async.js";
import { encodeBase64, VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import * as objects from "../../../../base/common/objects.js";
import * as platform from "../../../../base/common/platform.js";
import { removeDangerousEnvVariables } from "../../../../base/common/processes.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { BufferedEmitter } from "../../../../base/parts/ipc/common/ipc.net.js";
import { acquirePort } from "../../../../base/parts/ipc/electron-sandbox/ipc.mp.js";
import * as nls from "../../../../nls.js";
import { IExtensionHostDebugService } from "../../../../platform/debug/common/extensionHostDebug.js";
import { IExtensionHostStarter } from "../../../../platform/extensions/common/extensionHostStarter.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService, ILoggerService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { isLoggingOnly } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IWorkspaceContextService, WorkbenchState, isUntitledWorkspace } from "../../../../platform/workspace/common/workspace.js";
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-sandbox/environmentService.js";
import { IShellEnvironmentService } from "../../environment/electron-sandbox/shellEnvironmentService.js";
import { MessagePortExtHostConnection, writeExtHostConnection } from "../common/extensionHostEnv.js";
import { MessageType, NativeLogMarkers, UIKind, isMessageOfType } from "../common/extensionHostProtocol.js";
import { ExtensionHostStartup } from "../common/extensions.js";
import { IHostService } from "../../host/browser/host.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { parseExtensionDevOptions } from "../common/extensionDevOptions.js";
class ExtensionHostProcess {
  constructor(id, _extensionHostStarter) {
    this._extensionHostStarter = _extensionHostStarter;
    this._id = id;
  }
  get onStdout() {
    return this._extensionHostStarter.onDynamicStdout(this._id);
  }
  get onStderr() {
    return this._extensionHostStarter.onDynamicStderr(this._id);
  }
  get onMessage() {
    return this._extensionHostStarter.onDynamicMessage(this._id);
  }
  get onExit() {
    return this._extensionHostStarter.onDynamicExit(this._id);
  }
  start(opts) {
    return this._extensionHostStarter.start(this._id, opts);
  }
  enableInspectPort() {
    return this._extensionHostStarter.enableInspectPort(this._id);
  }
  kill() {
    return this._extensionHostStarter.kill(this._id);
  }
}
let NativeLocalProcessExtensionHost = class {
  constructor(runningLocation, startup, _initDataProvider, _contextService, _notificationService, _nativeHostService, _lifecycleService, _environmentService, _userDataProfilesService, _telemetryService, _logService, _loggerService, _labelService, _extensionHostDebugService, _hostService, _productService, _shellEnvironmentService, _extensionHostStarter) {
    this.runningLocation = runningLocation;
    this.startup = startup;
    this._initDataProvider = _initDataProvider;
    this._contextService = _contextService;
    this._notificationService = _notificationService;
    this._nativeHostService = _nativeHostService;
    this._lifecycleService = _lifecycleService;
    this._environmentService = _environmentService;
    this._userDataProfilesService = _userDataProfilesService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this._loggerService = _loggerService;
    this._labelService = _labelService;
    this._extensionHostDebugService = _extensionHostDebugService;
    this._hostService = _hostService;
    this._productService = _productService;
    this._shellEnvironmentService = _shellEnvironmentService;
    this._extensionHostStarter = _extensionHostStarter;
    this.pid = null;
    this.remoteAuthority = null;
    this.extensions = null;
    this._onExit = new Emitter();
    this.onExit = this._onExit.event;
    this._onDidSetInspectPort = new Emitter();
    this._toDispose = new DisposableStore();
    const devOpts = parseExtensionDevOptions(this._environmentService);
    this._isExtensionDevHost = devOpts.isExtensionDevHost;
    this._isExtensionDevDebug = devOpts.isExtensionDevDebug;
    this._isExtensionDevDebugBrk = devOpts.isExtensionDevDebugBrk;
    this._isExtensionDevTestFromCli = devOpts.isExtensionDevTestFromCli;
    this._terminating = false;
    this._inspectListener = null;
    this._extensionHostProcess = null;
    this._messageProtocol = null;
    this._toDispose.add(this._onExit);
    this._toDispose.add(this._lifecycleService.onWillShutdown((e) => this._onWillShutdown(e)));
    this._toDispose.add(this._extensionHostDebugService.onClose((event) => {
      if (this._isExtensionDevHost && this._environmentService.debugExtensionHost.debugId === event.sessionId) {
        this._nativeHostService.closeWindow();
      }
    }));
    this._toDispose.add(this._extensionHostDebugService.onReload((event) => {
      if (this._isExtensionDevHost && this._environmentService.debugExtensionHost.debugId === event.sessionId) {
        this._hostService.reload();
      }
    }));
  }
  dispose() {
    if (this._terminating) {
      return;
    }
    this._terminating = true;
    this._toDispose.dispose();
  }
  start() {
    if (this._terminating) {
      throw new CancellationError();
    }
    if (!this._messageProtocol) {
      this._messageProtocol = this._start();
    }
    return this._messageProtocol;
  }
  async _start() {
    const [extensionHostCreationResult, portNumber, processEnv] = await Promise.all([
      this._extensionHostStarter.createExtensionHost(),
      this._tryFindDebugPort(),
      this._shellEnvironmentService.getShellEnv()
    ]);
    this._extensionHostProcess = new ExtensionHostProcess(extensionHostCreationResult.id, this._extensionHostStarter);
    const env = objects.mixin(processEnv, {
      VSCODE_ESM_ENTRYPOINT: "vs/workbench/api/node/extensionHostProcess",
      VSCODE_HANDLES_UNCAUGHT_ERRORS: true
    });
    if (this._environmentService.debugExtensionHost.env) {
      objects.mixin(env, this._environmentService.debugExtensionHost.env);
    }
    removeDangerousEnvVariables(env);
    if (this._isExtensionDevHost) {
      delete env["VSCODE_CODE_CACHE_PATH"];
    }
    const opts = {
      responseWindowId: this._nativeHostService.windowId,
      responseChannel: "vscode:startExtensionHostMessagePortResult",
      responseNonce: generateUuid(),
      env,
      // We only detach the extension host on windows. Linux and Mac orphan by default
      // and detach under Linux and Mac create another process group.
      // We detach because we have noticed that when the renderer exits, its child processes
      // (i.e. extension host) are taken down in a brutal fashion by the OS
      detached: !!platform.isWindows,
      execArgv: void 0,
      silent: true
    };
    const inspectHost = "127.0.0.1";
    if (portNumber !== 0) {
      opts.execArgv = [
        "--nolazy",
        (this._isExtensionDevDebugBrk ? "--inspect-brk=" : "--inspect=") + `${inspectHost}:${portNumber}`
      ];
    } else {
      opts.execArgv = ["--inspect-port=0"];
    }
    if (this._environmentService.extensionTestsLocationURI) {
      opts.execArgv.unshift("--expose-gc");
    }
    if (this._environmentService.args["prof-v8-extensions"]) {
      opts.execArgv.unshift("--prof");
    }
    opts.execArgv.unshift("--dns-result-order=ipv4first");
    const onStdout = this._handleProcessOutputStream(this._extensionHostProcess.onStdout, this._toDispose);
    const onStderr = this._handleProcessOutputStream(this._extensionHostProcess.onStderr, this._toDispose);
    const onOutput = Event.any(
      Event.map(onStdout.event, (o) => ({ data: `%c${o}`, format: [""] })),
      Event.map(onStderr.event, (o) => ({ data: `%c${o}`, format: ["color: red"] }))
    );
    const onDebouncedOutput = Event.debounce(onOutput, (r, o) => {
      return r ? { data: r.data + o.data, format: [...r.format, ...o.format] } : { data: o.data, format: o.format };
    }, 100);
    this._toDispose.add(onDebouncedOutput((output) => {
      const inspectorUrlMatch = output.data && output.data.match(/ws:\/\/([^\s]+):(\d+)\/[^\s]+/);
      if (inspectorUrlMatch) {
        const [, host, port] = inspectorUrlMatch;
        if (!this._environmentService.isBuilt && !this._isExtensionDevTestFromCli) {
          console.log(`%c[Extension Host] %cdebugger inspector at devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=${inspectorUrlMatch[1]}`, "color: blue", "color:");
        }
        if (!this._inspectListener) {
          this._inspectListener = { host, port: Number(port) };
          this._onDidSetInspectPort.fire();
        }
      } else {
        if (!this._isExtensionDevTestFromCli) {
          console.group("Extension Host");
          console.log(output.data, ...output.format);
          console.groupEnd();
        }
      }
    }));
    this._toDispose.add(this._extensionHostProcess.onExit(({ code, signal }) => this._onExtHostProcessExit(code, signal)));
    if (portNumber) {
      if (this._isExtensionDevHost && this._isExtensionDevDebug && this._environmentService.debugExtensionHost.debugId) {
        this._extensionHostDebugService.attachSession(this._environmentService.debugExtensionHost.debugId, portNumber);
      }
      this._inspectListener = { port: portNumber, host: inspectHost };
      this._onDidSetInspectPort.fire();
    }
    let startupTimeoutHandle;
    if (!this._environmentService.isBuilt && !this._environmentService.remoteAuthority || this._isExtensionDevHost) {
      startupTimeoutHandle = setTimeout(() => {
        this._logService.error(`[LocalProcessExtensionHost]: Extension host did not start in 10 seconds (debugBrk: ${this._isExtensionDevDebugBrk})`);
        const msg = this._isExtensionDevDebugBrk ? nls.localize("extensionHost.startupFailDebug", "Extension host did not start in 10 seconds, it might be stopped on the first line and needs a debugger to continue.") : nls.localize("extensionHost.startupFail", "Extension host did not start in 10 seconds, that might be a problem.");
        this._notificationService.prompt(
          Severity.Warning,
          msg,
          [{
            label: nls.localize("reloadWindow", "Reload Window"),
            run: () => this._hostService.reload()
          }],
          {
            sticky: true,
            priority: NotificationPriority.URGENT
          }
        );
      }, 1e4);
    }
    const protocol = await this._establishProtocol(this._extensionHostProcess, opts);
    await this._performHandshake(protocol);
    clearTimeout(startupTimeoutHandle);
    return protocol;
  }
  /**
   * Find a free port if extension host debugging is enabled.
   */
  async _tryFindDebugPort() {
    if (typeof this._environmentService.debugExtensionHost.port !== "number") {
      return 0;
    }
    const expected = this._environmentService.debugExtensionHost.port;
    const port = await this._nativeHostService.findFreePort(
      expected,
      10,
      5e3,
      2048
      /* skip 2048 ports between attempts */
    );
    if (!this._isExtensionDevTestFromCli) {
      if (!port) {
        console.warn("%c[Extension Host] %cCould not find a free port for debugging", "color: blue", "color:");
      } else {
        if (port !== expected) {
          console.warn(`%c[Extension Host] %cProvided debugging port ${expected} is not free, using ${port} instead.`, "color: blue", "color:");
        }
        if (this._isExtensionDevDebugBrk) {
          console.warn(`%c[Extension Host] %cSTOPPED on first line for debugging on port ${port}`, "color: blue", "color:");
        } else {
          console.info(`%c[Extension Host] %cdebugger listening on port ${port}`, "color: blue", "color:");
        }
      }
    }
    return port || 0;
  }
  _establishProtocol(extensionHostProcess, opts) {
    writeExtHostConnection(new MessagePortExtHostConnection(), opts.env);
    const portPromise = acquirePort(void 0, opts.responseChannel, opts.responseNonce);
    return new Promise((resolve, reject) => {
      const handle = setTimeout(() => {
        reject("The local extension host took longer than 60s to connect.");
      }, 60 * 1e3);
      portPromise.then((port) => {
        this._toDispose.add(toDisposable(() => {
          port.close();
        }));
        clearTimeout(handle);
        const onMessage = new BufferedEmitter();
        port.onmessage = (e) => {
          if (e.data) {
            onMessage.fire(VSBuffer.wrap(e.data));
          }
        };
        port.start();
        resolve({
          onMessage: onMessage.event,
          send: (message) => port.postMessage(message.buffer)
        });
      });
      const sw = StopWatch.create(false);
      extensionHostProcess.start(opts).then(({ pid }) => {
        if (pid) {
          this.pid = pid;
        }
        this._logService.info(`Started local extension host with pid ${pid}.`);
        const duration = sw.elapsed();
        if (platform.isCI) {
          this._logService.info(`IExtensionHostStarter.start() took ${duration} ms.`);
        }
      }, (err) => {
        reject(err);
      });
    });
  }
  _performHandshake(protocol) {
    return new Promise((resolve, reject) => {
      let timeoutHandle;
      const installTimeoutCheck = () => {
        timeoutHandle = setTimeout(() => {
          reject("The local extension host took longer than 60s to send its ready message.");
        }, 60 * 1e3);
      };
      const uninstallTimeoutCheck = () => {
        clearTimeout(timeoutHandle);
      };
      installTimeoutCheck();
      const disposable = protocol.onMessage((msg) => {
        if (isMessageOfType(msg, MessageType.Ready)) {
          uninstallTimeoutCheck();
          this._createExtHostInitData().then((data) => {
            installTimeoutCheck();
            protocol.send(VSBuffer.fromString(JSON.stringify(data)));
          });
          return;
        }
        if (isMessageOfType(msg, MessageType.Initialized)) {
          uninstallTimeoutCheck();
          disposable.dispose();
          resolve();
          return;
        }
        console.error(`received unexpected message during handshake phase from the extension host: `, msg);
      });
    });
  }
  async _createExtHostInitData() {
    const initData = await this._initDataProvider.getInitData();
    this.extensions = initData.extensions;
    const workspace = this._contextService.getWorkspace();
    return {
      commit: this._productService.commit,
      version: this._productService.version,
      quality: this._productService.quality,
      parentPid: 0,
      environment: {
        isExtensionDevelopmentDebug: this._isExtensionDevDebug,
        appRoot: this._environmentService.appRoot ? URI.file(this._environmentService.appRoot) : void 0,
        appName: this._productService.nameLong,
        appHost: this._productService.embedderIdentifier || "desktop",
        appUriScheme: this._productService.urlProtocol,
        isExtensionTelemetryLoggingOnly: isLoggingOnly(this._productService, this._environmentService),
        appLanguage: platform.language,
        extensionDevelopmentLocationURI: this._environmentService.extensionDevelopmentLocationURI,
        extensionTestsLocationURI: this._environmentService.extensionTestsLocationURI,
        globalStorageHome: this._userDataProfilesService.defaultProfile.globalStorageHome,
        workspaceStorageHome: this._environmentService.workspaceStorageHome,
        extensionLogLevel: this._environmentService.extensionLogLevel
      },
      workspace: this._contextService.getWorkbenchState() === WorkbenchState.EMPTY ? void 0 : {
        configuration: workspace.configuration ?? void 0,
        id: workspace.id,
        name: this._labelService.getWorkspaceLabel(workspace),
        isUntitled: workspace.configuration ? isUntitledWorkspace(workspace.configuration, this._environmentService) : false,
        transient: workspace.transient
      },
      remote: {
        authority: this._environmentService.remoteAuthority,
        connectionData: null,
        isRemote: false
      },
      consoleForward: {
        includeStack: !this._isExtensionDevTestFromCli && (this._isExtensionDevHost || !this._environmentService.isBuilt || this._productService.quality !== "stable" || this._environmentService.verbose),
        logNative: !this._isExtensionDevTestFromCli && this._isExtensionDevHost
      },
      extensions: this.extensions.toSnapshot(),
      telemetryInfo: {
        sessionId: this._telemetryService.sessionId,
        machineId: this._telemetryService.machineId,
        sqmId: this._telemetryService.sqmId,
        devDeviceId: this._telemetryService.devDeviceId,
        firstSessionDate: this._telemetryService.firstSessionDate,
        msftInternal: this._telemetryService.msftInternal
      },
      logLevel: this._logService.getLevel(),
      loggers: [...this._loggerService.getRegisteredLoggers()],
      logsLocation: this._environmentService.extHostLogsPath,
      autoStart: this.startup === ExtensionHostStartup.EagerAutoStart,
      uiKind: UIKind.Desktop,
      handle: this._environmentService.window.handle ? encodeBase64(this._environmentService.window.handle) : void 0
    };
  }
  _onExtHostProcessExit(code, signal) {
    if (this._terminating) {
      return;
    }
    this._onExit.fire([code, signal]);
  }
  _handleProcessOutputStream(stream, store) {
    let last = "";
    let isOmitting = false;
    const event = new Emitter();
    stream((chunk) => {
      last += chunk;
      const lines = last.split(/\r?\n/g);
      last = lines.pop();
      if (last.length > 1e4) {
        lines.push(last);
        last = "";
      }
      for (const line of lines) {
        if (isOmitting) {
          if (line === NativeLogMarkers.End) {
            isOmitting = false;
          }
        } else if (line === NativeLogMarkers.Start) {
          isOmitting = true;
        } else if (line.length) {
          event.fire(line + "\n");
        }
      }
    }, void 0, store);
    return event;
  }
  async enableInspectPort() {
    if (!!this._inspectListener) {
      return true;
    }
    if (!this._extensionHostProcess) {
      return false;
    }
    const result = await this._extensionHostProcess.enableInspectPort();
    if (!result) {
      return false;
    }
    await Promise.race([Event.toPromise(this._onDidSetInspectPort.event), timeout(1e3)]);
    return !!this._inspectListener;
  }
  getInspectPort() {
    return this._inspectListener ?? void 0;
  }
  _onWillShutdown(event) {
    if (this._isExtensionDevHost && !this._isExtensionDevTestFromCli && !this._isExtensionDevDebug && this._environmentService.debugExtensionHost.debugId) {
      this._extensionHostDebugService.terminateSession(this._environmentService.debugExtensionHost.debugId);
      event.join(timeout(
        100
        /* wait a bit for IPC to get delivered */
      ), { id: "join.extensionDevelopment", label: nls.localize("join.extensionDevelopment", "Terminating extension debug session") });
    }
  }
};
NativeLocalProcessExtensionHost = __decorateClass([
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, INativeHostService),
  __decorateParam(6, ILifecycleService),
  __decorateParam(7, INativeWorkbenchEnvironmentService),
  __decorateParam(8, IUserDataProfilesService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, ILogService),
  __decorateParam(11, ILoggerService),
  __decorateParam(12, ILabelService),
  __decorateParam(13, IExtensionHostDebugService),
  __decorateParam(14, IHostService),
  __decorateParam(15, IProductService),
  __decorateParam(16, IShellEnvironmentService),
  __decorateParam(17, IExtensionHostStarter)
], NativeLocalProcessExtensionHost);
export {
  ExtensionHostProcess,
  NativeLocalProcessExtensionHost
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9lbGVjdHJvbi1zYW5kYm94L2xvY2FsUHJvY2Vzc0V4dGVuc2lvbkhvc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZW5jb2RlQmFzZTY0LCBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIG9iamVjdHMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyByZW1vdmVEYW5nZXJvdXNFbnZWYXJpYWJsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzZXMuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElNZXNzYWdlUGFzc2luZ1Byb3RvY29sIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQgeyBCdWZmZXJlZEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLm5ldC5qcyc7XG5pbXBvcnQgeyBhY3F1aXJlUG9ydCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvcGFydHMvaXBjL2VsZWN0cm9uLXNhbmRib3gvaXBjLm1wLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkhvc3REZWJ1Z1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kZWJ1Zy9jb21tb24vZXh0ZW5zaW9uSG9zdERlYnVnLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25Ib3N0UHJvY2Vzc09wdGlvbnMsIElFeHRlbnNpb25Ib3N0U3RhcnRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbkhvc3RTdGFydGVyLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIElMb2dnZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIE5vdGlmaWNhdGlvblByaW9yaXR5LCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgaXNMb2dnaW5nT25seSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5VXRpbHMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3JrYmVuY2hTdGF0ZSwgaXNVbnRpdGxlZFdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9lbGVjdHJvbi1zYW5kYm94L2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU2hlbGxFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9lbGVjdHJvbi1zYW5kYm94L3NoZWxsRW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1lc3NhZ2VQb3J0RXh0SG9zdENvbm5lY3Rpb24sIHdyaXRlRXh0SG9zdENvbm5lY3Rpb24gfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uSG9zdEVudi5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uSG9zdEluaXREYXRhLCBNZXNzYWdlVHlwZSwgTmF0aXZlTG9nTWFya2VycywgVUlLaW5kLCBpc01lc3NhZ2VPZlR5cGUgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uSG9zdFByb3RvY29sLmpzJztcbmltcG9ydCB7IExvY2FsUHJvY2Vzc1J1bm5pbmdMb2NhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25SdW5uaW5nTG9jYXRpb24uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSG9zdEV4dGVuc2lvbnMsIEV4dGVuc2lvbkhvc3RTdGFydHVwLCBJRXh0ZW5zaW9uSG9zdCB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlLCBXaWxsU2h1dGRvd25FdmVudCB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHBhcnNlRXh0ZW5zaW9uRGV2T3B0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25EZXZPcHRpb25zLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJTG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdEluaXREYXRhIHtcblx0cmVhZG9ubHkgZXh0ZW5zaW9uczogRXh0ZW5zaW9uSG9zdEV4dGVuc2lvbnM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxvY2FsUHJvY2Vzc0V4dGVuc2lvbkhvc3REYXRhUHJvdmlkZXIge1xuXHRnZXRJbml0RGF0YSgpOiBQcm9taXNlPElMb2NhbFByb2Nlc3NFeHRlbnNpb25Ib3N0SW5pdERhdGE+O1xufVxuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uSG9zdFByb2Nlc3Mge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2lkOiBzdHJpbmc7XG5cblx0cHVibGljIGdldCBvblN0ZG91dCgpOiBFdmVudDxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fZXh0ZW5zaW9uSG9zdFN0YXJ0ZXIub25EeW5hbWljU3Rkb3V0KHRoaXMuX2lkKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgb25TdGRlcnIoKTogRXZlbnQ8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2V4dGVuc2lvbkhvc3RTdGFydGVyLm9uRHluYW1pY1N0ZGVycih0aGlzLl9pZCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uTWVzc2FnZSgpOiBFdmVudDxhbnk+IHtcblx0XHRyZXR1cm4gdGhpcy5fZXh0ZW5zaW9uSG9zdFN0YXJ0ZXIub25EeW5hbWljTWVzc2FnZSh0aGlzLl9pZCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uRXhpdCgpOiBFdmVudDx7IGNvZGU6IG51bWJlcjsgc2lnbmFsOiBzdHJpbmcgfT4ge1xuXHRcdHJldHVybiB0aGlzLl9leHRlbnNpb25Ib3N0U3RhcnRlci5vbkR5bmFtaWNFeGl0KHRoaXMuX2lkKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uSG9zdFN0YXJ0ZXI6IElFeHRlbnNpb25Ib3N0U3RhcnRlcixcblx0KSB7XG5cdFx0dGhpcy5faWQgPSBpZDtcblx0fVxuXG5cdHB1YmxpYyBzdGFydChvcHRzOiBJRXh0ZW5zaW9uSG9zdFByb2Nlc3NPcHRpb25zKTogUHJvbWlzZTx7IHBpZDogbnVtYmVyIHwgdW5kZWZpbmVkIH0+IHtcblx0XHRyZXR1cm4gdGhpcy5fZXh0ZW5zaW9uSG9zdFN0YXJ0ZXIuc3RhcnQodGhpcy5faWQsIG9wdHMpO1xuXHR9XG5cblx0cHVibGljIGVuYWJsZUluc3BlY3RQb3J0KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0aGlzLl9leHRlbnNpb25Ib3N0U3RhcnRlci5lbmFibGVJbnNwZWN0UG9ydCh0aGlzLl9pZCk7XG5cdH1cblxuXHRwdWJsaWMga2lsbCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fZXh0ZW5zaW9uSG9zdFN0YXJ0ZXIua2lsbCh0aGlzLl9pZCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5hdGl2ZUxvY2FsUHJvY2Vzc0V4dGVuc2lvbkhvc3QgaW1wbGVtZW50cyBJRXh0ZW5zaW9uSG9zdCB7XG5cblx0cHVibGljIHBpZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdHB1YmxpYyByZWFkb25seSByZW1vdGVBdXRob3JpdHkgPSBudWxsO1xuXHRwdWJsaWMgZXh0ZW5zaW9uczogRXh0ZW5zaW9uSG9zdEV4dGVuc2lvbnMgfCBudWxsID0gbnVsbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkV4aXQ6IEVtaXR0ZXI8W251bWJlciwgc3RyaW5nXT4gPSBuZXcgRW1pdHRlcjxbbnVtYmVyLCBzdHJpbmddPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25FeGl0OiBFdmVudDxbbnVtYmVyLCBzdHJpbmddPiA9IHRoaXMuX29uRXhpdC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNldEluc3BlY3RQb3J0ID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF90b0Rpc3Bvc2UgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaXNFeHRlbnNpb25EZXZIb3N0OiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pc0V4dGVuc2lvbkRldkRlYnVnOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pc0V4dGVuc2lvbkRldkRlYnVnQnJrOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pc0V4dGVuc2lvbkRldlRlc3RGcm9tQ2xpOiBib29sZWFuO1xuXG5cdC8vIFN0YXRlXG5cdHByaXZhdGUgX3Rlcm1pbmF0aW5nOiBib29sZWFuO1xuXG5cdC8vIFJlc291cmNlcywgaW4gb3JkZXIgdGhleSBnZXQgYWNxdWlyZWQvY3JlYXRlZCB3aGVuIC5zdGFydCgpIGlzIGNhbGxlZDpcblx0cHJpdmF0ZSBfaW5zcGVjdExpc3RlbmVyOiB7IHBvcnQ6IG51bWJlcjsgaG9zdDogc3RyaW5nIH0gfCBudWxsO1xuXHRwcml2YXRlIF9leHRlbnNpb25Ib3N0UHJvY2VzczogRXh0ZW5zaW9uSG9zdFByb2Nlc3MgfCBudWxsO1xuXHRwcml2YXRlIF9tZXNzYWdlUHJvdG9jb2w6IFByb21pc2U8SU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2w+IHwgbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgcnVubmluZ0xvY2F0aW9uOiBMb2NhbFByb2Nlc3NSdW5uaW5nTG9jYXRpb24sXG5cdFx0cHVibGljIHJlYWRvbmx5IHN0YXJ0dXA6IEV4dGVuc2lvbkhvc3RTdGFydHVwLkVhZ2VyQXV0b1N0YXJ0IHwgRXh0ZW5zaW9uSG9zdFN0YXJ0dXAuRWFnZXJNYW51YWxTdGFydCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pbml0RGF0YVByb3ZpZGVyOiBJTG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdERhdGFQcm92aWRlcixcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJTmF0aXZlSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbmF0aXZlSG9zdFNlcnZpY2U6IElOYXRpdmVIb3N0U2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJTG9nZ2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dnZXJTZXJ2aWNlOiBJTG9nZ2VyU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25Ib3N0RGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbkhvc3REZWJ1Z1NlcnZpY2U6IElFeHRlbnNpb25Ib3N0RGVidWdTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElTaGVsbEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zaGVsbEVudmlyb25tZW50U2VydmljZTogSVNoZWxsRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uSG9zdFN0YXJ0ZXIgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uSG9zdFN0YXJ0ZXI6IElFeHRlbnNpb25Ib3N0U3RhcnRlcixcblx0KSB7XG5cdFx0Y29uc3QgZGV2T3B0cyA9IHBhcnNlRXh0ZW5zaW9uRGV2T3B0aW9ucyh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdHRoaXMuX2lzRXh0ZW5zaW9uRGV2SG9zdCA9IGRldk9wdHMuaXNFeHRlbnNpb25EZXZIb3N0O1xuXHRcdHRoaXMuX2lzRXh0ZW5zaW9uRGV2RGVidWcgPSBkZXZPcHRzLmlzRXh0ZW5zaW9uRGV2RGVidWc7XG5cdFx0dGhpcy5faXNFeHRlbnNpb25EZXZEZWJ1Z0JyayA9IGRldk9wdHMuaXNFeHRlbnNpb25EZXZEZWJ1Z0Jyaztcblx0XHR0aGlzLl9pc0V4dGVuc2lvbkRldlRlc3RGcm9tQ2xpID0gZGV2T3B0cy5pc0V4dGVuc2lvbkRldlRlc3RGcm9tQ2xpO1xuXG5cdFx0dGhpcy5fdGVybWluYXRpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMuX2luc3BlY3RMaXN0ZW5lciA9IG51bGw7XG5cdFx0dGhpcy5fZXh0ZW5zaW9uSG9zdFByb2Nlc3MgPSBudWxsO1xuXHRcdHRoaXMuX21lc3NhZ2VQcm90b2NvbCA9IG51bGw7XG5cblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuX29uRXhpdCk7XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh0aGlzLl9saWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKGUgPT4gdGhpcy5fb25XaWxsU2h1dGRvd24oZSkpKTtcblx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRoaXMuX2V4dGVuc2lvbkhvc3REZWJ1Z1NlcnZpY2Uub25DbG9zZShldmVudCA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNFeHRlbnNpb25EZXZIb3N0ICYmIHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5kZWJ1Z0V4dGVuc2lvbkhvc3QuZGVidWdJZCA9PT0gZXZlbnQuc2Vzc2lvbklkKSB7XG5cdFx0XHRcdHRoaXMuX25hdGl2ZUhvc3RTZXJ2aWNlLmNsb3NlV2luZG93KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3RvRGlzcG9zZS5hZGQodGhpcy5fZXh0ZW5zaW9uSG9zdERlYnVnU2VydmljZS5vblJlbG9hZChldmVudCA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNFeHRlbnNpb25EZXZIb3N0ICYmIHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5kZWJ1Z0V4dGVuc2lvbkhvc3QuZGVidWdJZCA9PT0gZXZlbnQuc2Vzc2lvbklkKSB7XG5cdFx0XHRcdHRoaXMuX2hvc3RTZXJ2aWNlLnJlbG9hZCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl90ZXJtaW5hdGluZykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl90ZXJtaW5hdGluZyA9IHRydWU7XG5cblx0XHR0aGlzLl90b0Rpc3Bvc2UuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHVibGljIHN0YXJ0KCk6IFByb21pc2U8SU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2w+IHtcblx0XHRpZiAodGhpcy5fdGVybWluYXRpbmcpIHtcblx0XHRcdC8vIC50ZXJtaW5hdGUoKSB3YXMgY2FsbGVkXG5cdFx0XHR0aHJvdyBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX21lc3NhZ2VQcm90b2NvbCkge1xuXHRcdFx0dGhpcy5fbWVzc2FnZVByb3RvY29sID0gdGhpcy5fc3RhcnQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fbWVzc2FnZVByb3RvY29sO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc3RhcnQoKTogUHJvbWlzZTxJTWVzc2FnZVBhc3NpbmdQcm90b2NvbD4ge1xuXHRcdGNvbnN0IFtleHRlbnNpb25Ib3N0Q3JlYXRpb25SZXN1bHQsIHBvcnROdW1iZXIsIHByb2Nlc3NFbnZdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0dGhpcy5fZXh0ZW5zaW9uSG9zdFN0YXJ0ZXIuY3JlYXRlRXh0ZW5zaW9uSG9zdCgpLFxuXHRcdFx0dGhpcy5fdHJ5RmluZERlYnVnUG9ydCgpLFxuXHRcdFx0dGhpcy5fc2hlbGxFbnZpcm9ubWVudFNlcnZpY2UuZ2V0U2hlbGxFbnYoKSxcblx0XHRdKTtcblxuXHRcdHRoaXMuX2V4dGVuc2lvbkhvc3RQcm9jZXNzID0gbmV3IEV4dGVuc2lvbkhvc3RQcm9jZXNzKGV4dGVuc2lvbkhvc3RDcmVhdGlvblJlc3VsdC5pZCwgdGhpcy5fZXh0ZW5zaW9uSG9zdFN0YXJ0ZXIpO1xuXG5cdFx0Y29uc3QgZW52ID0gb2JqZWN0cy5taXhpbihwcm9jZXNzRW52LCB7XG5cdFx0XHRWU0NPREVfRVNNX0VOVFJZUE9JTlQ6ICd2cy93b3JrYmVuY2gvYXBpL25vZGUvZXh0ZW5zaW9uSG9zdFByb2Nlc3MnLFxuXHRcdFx0VlNDT0RFX0hBTkRMRVNfVU5DQVVHSFRfRVJST1JTOiB0cnVlXG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmRlYnVnRXh0ZW5zaW9uSG9zdC5lbnYpIHtcblx0XHRcdG9iamVjdHMubWl4aW4oZW52LCB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZGVidWdFeHRlbnNpb25Ib3N0LmVudik7XG5cdFx0fVxuXG5cdFx0cmVtb3ZlRGFuZ2Vyb3VzRW52VmFyaWFibGVzKGVudik7XG5cblx0XHRpZiAodGhpcy5faXNFeHRlbnNpb25EZXZIb3N0KSB7XG5cdFx0XHQvLyBVbnNldCBgVlNDT0RFX0NPREVfQ0FDSEVfUEFUSGAgd2hlbiBkZXZlbG9waW5nIGV4dGVuc2lvbnMgYmVjYXVzZSBpdCBtaWdodFxuXHRcdFx0Ly8gYmUgdGhhdCBkZXBlbmRlbmNpZXMsIHRoYXQgb3RoZXJ3aXNlIHdvdWxkIGJlIGNhY2hlZCwgZ2V0IG1vZGlmaWVkLlxuXHRcdFx0ZGVsZXRlIGVudlsnVlNDT0RFX0NPREVfQ0FDSEVfUEFUSCddO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wdHM6IElFeHRlbnNpb25Ib3N0UHJvY2Vzc09wdGlvbnMgPSB7XG5cdFx0XHRyZXNwb25zZVdpbmRvd0lkOiB0aGlzLl9uYXRpdmVIb3N0U2VydmljZS53aW5kb3dJZCxcblx0XHRcdHJlc3BvbnNlQ2hhbm5lbDogJ3ZzY29kZTpzdGFydEV4dGVuc2lvbkhvc3RNZXNzYWdlUG9ydFJlc3VsdCcsXG5cdFx0XHRyZXNwb25zZU5vbmNlOiBnZW5lcmF0ZVV1aWQoKSxcblx0XHRcdGVudixcblx0XHRcdC8vIFdlIG9ubHkgZGV0YWNoIHRoZSBleHRlbnNpb24gaG9zdCBvbiB3aW5kb3dzLiBMaW51eCBhbmQgTWFjIG9ycGhhbiBieSBkZWZhdWx0XG5cdFx0XHQvLyBhbmQgZGV0YWNoIHVuZGVyIExpbnV4IGFuZCBNYWMgY3JlYXRlIGFub3RoZXIgcHJvY2VzcyBncm91cC5cblx0XHRcdC8vIFdlIGRldGFjaCBiZWNhdXNlIHdlIGhhdmUgbm90aWNlZCB0aGF0IHdoZW4gdGhlIHJlbmRlcmVyIGV4aXRzLCBpdHMgY2hpbGQgcHJvY2Vzc2VzXG5cdFx0XHQvLyAoaS5lLiBleHRlbnNpb24gaG9zdCkgYXJlIHRha2VuIGRvd24gaW4gYSBicnV0YWwgZmFzaGlvbiBieSB0aGUgT1Ncblx0XHRcdGRldGFjaGVkOiAhIXBsYXRmb3JtLmlzV2luZG93cyxcblx0XHRcdGV4ZWNBcmd2OiB1bmRlZmluZWQgYXMgc3RyaW5nW10gfCB1bmRlZmluZWQsXG5cdFx0XHRzaWxlbnQ6IHRydWVcblx0XHR9O1xuXG5cdFx0Y29uc3QgaW5zcGVjdEhvc3QgPSAnMTI3LjAuMC4xJztcblx0XHRpZiAocG9ydE51bWJlciAhPT0gMCkge1xuXHRcdFx0b3B0cy5leGVjQXJndiA9IFtcblx0XHRcdFx0Jy0tbm9sYXp5Jyxcblx0XHRcdFx0KHRoaXMuX2lzRXh0ZW5zaW9uRGV2RGVidWdCcmsgPyAnLS1pbnNwZWN0LWJyaz0nIDogJy0taW5zcGVjdD0nKSArIGAke2luc3BlY3RIb3N0fToke3BvcnROdW1iZXJ9YFxuXHRcdFx0XTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3B0cy5leGVjQXJndiA9IFsnLS1pbnNwZWN0LXBvcnQ9MCddO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSkge1xuXHRcdFx0b3B0cy5leGVjQXJndi51bnNoaWZ0KCctLWV4cG9zZS1nYycpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1sncHJvZi12OC1leHRlbnNpb25zJ10pIHtcblx0XHRcdG9wdHMuZXhlY0FyZ3YudW5zaGlmdCgnLS1wcm9mJyk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVmcyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTg5ODA1XG5cdFx0b3B0cy5leGVjQXJndi51bnNoaWZ0KCctLWRucy1yZXN1bHQtb3JkZXI9aXB2NGZpcnN0Jyk7XG5cblx0XHQvLyBDYXRjaCBhbGwgb3V0cHV0IGNvbWluZyBmcm9tIHRoZSBleHRlbnNpb24gaG9zdCBwcm9jZXNzXG5cdFx0dHlwZSBPdXRwdXQgPSB7IGRhdGE6IHN0cmluZzsgZm9ybWF0OiBzdHJpbmdbXSB9O1xuXHRcdGNvbnN0IG9uU3Rkb3V0ID0gdGhpcy5faGFuZGxlUHJvY2Vzc091dHB1dFN0cmVhbSh0aGlzLl9leHRlbnNpb25Ib3N0UHJvY2Vzcy5vblN0ZG91dCwgdGhpcy5fdG9EaXNwb3NlKTtcblx0XHRjb25zdCBvblN0ZGVyciA9IHRoaXMuX2hhbmRsZVByb2Nlc3NPdXRwdXRTdHJlYW0odGhpcy5fZXh0ZW5zaW9uSG9zdFByb2Nlc3Mub25TdGRlcnIsIHRoaXMuX3RvRGlzcG9zZSk7XG5cdFx0Y29uc3Qgb25PdXRwdXQgPSBFdmVudC5hbnkoXG5cdFx0XHRFdmVudC5tYXAob25TdGRvdXQuZXZlbnQsIG8gPT4gKHsgZGF0YTogYCVjJHtvfWAsIGZvcm1hdDogWycnXSB9KSksXG5cdFx0XHRFdmVudC5tYXAob25TdGRlcnIuZXZlbnQsIG8gPT4gKHsgZGF0YTogYCVjJHtvfWAsIGZvcm1hdDogWydjb2xvcjogcmVkJ10gfSkpXG5cdFx0KTtcblxuXHRcdC8vIERlYm91bmNlIGFsbCBvdXRwdXQsIHNvIHdlIGNhbiByZW5kZXIgaXQgaW4gdGhlIENocm9tZSBjb25zb2xlIGFzIGEgZ3JvdXBcblx0XHRjb25zdCBvbkRlYm91bmNlZE91dHB1dCA9IEV2ZW50LmRlYm91bmNlPE91dHB1dD4ob25PdXRwdXQsIChyLCBvKSA9PiB7XG5cdFx0XHRyZXR1cm4gclxuXHRcdFx0XHQ/IHsgZGF0YTogci5kYXRhICsgby5kYXRhLCBmb3JtYXQ6IFsuLi5yLmZvcm1hdCwgLi4uby5mb3JtYXRdIH1cblx0XHRcdFx0OiB7IGRhdGE6IG8uZGF0YSwgZm9ybWF0OiBvLmZvcm1hdCB9O1xuXHRcdH0sIDEwMCk7XG5cblx0XHQvLyBQcmludCBvdXQgZXh0ZW5zaW9uIGhvc3Qgb3V0cHV0XG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZChvbkRlYm91bmNlZE91dHB1dChvdXRwdXQgPT4ge1xuXHRcdFx0Y29uc3QgaW5zcGVjdG9yVXJsTWF0Y2ggPSBvdXRwdXQuZGF0YSAmJiBvdXRwdXQuZGF0YS5tYXRjaCgvd3M6XFwvXFwvKFteXFxzXSspOihcXGQrKVxcL1teXFxzXSsvKTtcblx0XHRcdGlmIChpbnNwZWN0b3JVcmxNYXRjaCkge1xuXHRcdFx0XHRjb25zdCBbLCBob3N0LCBwb3J0XSA9IGluc3BlY3RvclVybE1hdGNoO1xuXHRcdFx0XHRpZiAoIXRoaXMuX2Vudmlyb25tZW50U2VydmljZS5pc0J1aWx0ICYmICF0aGlzLl9pc0V4dGVuc2lvbkRldlRlc3RGcm9tQ2xpKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coYCVjW0V4dGVuc2lvbiBIb3N0XSAlY2RlYnVnZ2VyIGluc3BlY3RvciBhdCBkZXZ0b29sczovL2RldnRvb2xzL2J1bmRsZWQvaW5zcGVjdG9yLmh0bWw/ZXhwZXJpbWVudHM9dHJ1ZSZ2OG9ubHk9dHJ1ZSZ3cz0ke2luc3BlY3RvclVybE1hdGNoWzFdfWAsICdjb2xvcjogYmx1ZScsICdjb2xvcjonKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXRoaXMuX2luc3BlY3RMaXN0ZW5lcikge1xuXHRcdFx0XHRcdHRoaXMuX2luc3BlY3RMaXN0ZW5lciA9IHsgaG9zdCwgcG9ydDogTnVtYmVyKHBvcnQpIH07XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRTZXRJbnNwZWN0UG9ydC5maXJlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICghdGhpcy5faXNFeHRlbnNpb25EZXZUZXN0RnJvbUNsaSkge1xuXHRcdFx0XHRcdGNvbnNvbGUuZ3JvdXAoJ0V4dGVuc2lvbiBIb3N0Jyk7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2cob3V0cHV0LmRhdGEsIC4uLm91dHB1dC5mb3JtYXQpO1xuXHRcdFx0XHRcdGNvbnNvbGUuZ3JvdXBFbmQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIExpZmVjeWNsZVxuXG5cdFx0dGhpcy5fdG9EaXNwb3NlLmFkZCh0aGlzLl9leHRlbnNpb25Ib3N0UHJvY2Vzcy5vbkV4aXQoKHsgY29kZSwgc2lnbmFsIH0pID0+IHRoaXMuX29uRXh0SG9zdFByb2Nlc3NFeGl0KGNvZGUsIHNpZ25hbCkpKTtcblxuXHRcdC8vIE5vdGlmeSBkZWJ1Z2dlciB0aGF0IHdlIGFyZSByZWFkeSB0byBhdHRhY2ggdG8gdGhlIHByb2Nlc3MgaWYgd2UgcnVuIGEgZGV2ZWxvcG1lbnQgZXh0ZW5zaW9uXG5cdFx0aWYgKHBvcnROdW1iZXIpIHtcblx0XHRcdGlmICh0aGlzLl9pc0V4dGVuc2lvbkRldkhvc3QgJiYgdGhpcy5faXNFeHRlbnNpb25EZXZEZWJ1ZyAmJiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZGVidWdFeHRlbnNpb25Ib3N0LmRlYnVnSWQpIHtcblx0XHRcdFx0dGhpcy5fZXh0ZW5zaW9uSG9zdERlYnVnU2VydmljZS5hdHRhY2hTZXNzaW9uKHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5kZWJ1Z0V4dGVuc2lvbkhvc3QuZGVidWdJZCwgcG9ydE51bWJlcik7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9pbnNwZWN0TGlzdGVuZXIgPSB7IHBvcnQ6IHBvcnROdW1iZXIsIGhvc3Q6IGluc3BlY3RIb3N0IH07XG5cdFx0XHR0aGlzLl9vbkRpZFNldEluc3BlY3RQb3J0LmZpcmUoKTtcblx0XHR9XG5cblx0XHQvLyBIZWxwIGluIGNhc2Ugd2UgZmFpbCB0byBzdGFydCBpdFxuXHRcdGxldCBzdGFydHVwVGltZW91dEhhbmRsZTogYW55O1xuXHRcdGlmICghdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmlzQnVpbHQgJiYgIXRoaXMuX2Vudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHkgfHwgdGhpcy5faXNFeHRlbnNpb25EZXZIb3N0KSB7XG5cdFx0XHRzdGFydHVwVGltZW91dEhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBbTG9jYWxQcm9jZXNzRXh0ZW5zaW9uSG9zdF06IEV4dGVuc2lvbiBob3N0IGRpZCBub3Qgc3RhcnQgaW4gMTAgc2Vjb25kcyAoZGVidWdCcms6ICR7dGhpcy5faXNFeHRlbnNpb25EZXZEZWJ1Z0Jya30pYCk7XG5cblx0XHRcdFx0Y29uc3QgbXNnID0gdGhpcy5faXNFeHRlbnNpb25EZXZEZWJ1Z0Jya1xuXHRcdFx0XHRcdD8gbmxzLmxvY2FsaXplKCdleHRlbnNpb25Ib3N0LnN0YXJ0dXBGYWlsRGVidWcnLCBcIkV4dGVuc2lvbiBob3N0IGRpZCBub3Qgc3RhcnQgaW4gMTAgc2Vjb25kcywgaXQgbWlnaHQgYmUgc3RvcHBlZCBvbiB0aGUgZmlyc3QgbGluZSBhbmQgbmVlZHMgYSBkZWJ1Z2dlciB0byBjb250aW51ZS5cIilcblx0XHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uSG9zdC5zdGFydHVwRmFpbCcsIFwiRXh0ZW5zaW9uIGhvc3QgZGlkIG5vdCBzdGFydCBpbiAxMCBzZWNvbmRzLCB0aGF0IG1pZ2h0IGJlIGEgcHJvYmxlbS5cIik7XG5cblx0XHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoU2V2ZXJpdHkuV2FybmluZywgbXNnLFxuXHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdyZWxvYWRXaW5kb3cnLCBcIlJlbG9hZCBXaW5kb3dcIiksXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMuX2hvc3RTZXJ2aWNlLnJlbG9hZCgpXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c3RpY2t5OiB0cnVlLFxuXHRcdFx0XHRcdFx0cHJpb3JpdHk6IE5vdGlmaWNhdGlvblByaW9yaXR5LlVSR0VOVFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KTtcblx0XHRcdH0sIDEwMDAwKTtcblx0XHR9XG5cblx0XHQvLyBJbml0aWFsaXplIGV4dGVuc2lvbiBob3N0IHByb2Nlc3Mgd2l0aCBoYW5kIHNoYWtlc1xuXHRcdGNvbnN0IHByb3RvY29sID0gYXdhaXQgdGhpcy5fZXN0YWJsaXNoUHJvdG9jb2wodGhpcy5fZXh0ZW5zaW9uSG9zdFByb2Nlc3MsIG9wdHMpO1xuXHRcdGF3YWl0IHRoaXMuX3BlcmZvcm1IYW5kc2hha2UocHJvdG9jb2wpO1xuXHRcdGNsZWFyVGltZW91dChzdGFydHVwVGltZW91dEhhbmRsZSk7XG5cdFx0cmV0dXJuIHByb3RvY29sO1xuXHR9XG5cblx0LyoqXG5cdCAqIEZpbmQgYSBmcmVlIHBvcnQgaWYgZXh0ZW5zaW9uIGhvc3QgZGVidWdnaW5nIGlzIGVuYWJsZWQuXG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIF90cnlGaW5kRGVidWdQb3J0KCk6IFByb21pc2U8bnVtYmVyPiB7XG5cblx0XHRpZiAodHlwZW9mIHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5kZWJ1Z0V4dGVuc2lvbkhvc3QucG9ydCAhPT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmRlYnVnRXh0ZW5zaW9uSG9zdC5wb3J0O1xuXHRcdGNvbnN0IHBvcnQgPSBhd2FpdCB0aGlzLl9uYXRpdmVIb3N0U2VydmljZS5maW5kRnJlZVBvcnQoZXhwZWN0ZWQsIDEwIC8qIHRyeSAxMCBwb3J0cyAqLywgNTAwMCAvKiB0cnkgdXAgdG8gNSBzZWNvbmRzICovLCAyMDQ4IC8qIHNraXAgMjA0OCBwb3J0cyBiZXR3ZWVuIGF0dGVtcHRzICovKTtcblxuXHRcdGlmICghdGhpcy5faXNFeHRlbnNpb25EZXZUZXN0RnJvbUNsaSkge1xuXHRcdFx0aWYgKCFwb3J0KSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybignJWNbRXh0ZW5zaW9uIEhvc3RdICVjQ291bGQgbm90IGZpbmQgYSBmcmVlIHBvcnQgZm9yIGRlYnVnZ2luZycsICdjb2xvcjogYmx1ZScsICdjb2xvcjonKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChwb3J0ICE9PSBleHBlY3RlZCkge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgJWNbRXh0ZW5zaW9uIEhvc3RdICVjUHJvdmlkZWQgZGVidWdnaW5nIHBvcnQgJHtleHBlY3RlZH0gaXMgbm90IGZyZWUsIHVzaW5nICR7cG9ydH0gaW5zdGVhZC5gLCAnY29sb3I6IGJsdWUnLCAnY29sb3I6Jyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuX2lzRXh0ZW5zaW9uRGV2RGVidWdCcmspIHtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oYCVjW0V4dGVuc2lvbiBIb3N0XSAlY1NUT1BQRUQgb24gZmlyc3QgbGluZSBmb3IgZGVidWdnaW5nIG9uIHBvcnQgJHtwb3J0fWAsICdjb2xvcjogYmx1ZScsICdjb2xvcjonKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zb2xlLmluZm8oYCVjW0V4dGVuc2lvbiBIb3N0XSAlY2RlYnVnZ2VyIGxpc3RlbmluZyBvbiBwb3J0ICR7cG9ydH1gLCAnY29sb3I6IGJsdWUnLCAnY29sb3I6Jyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcG9ydCB8fCAwO1xuXHR9XG5cblx0cHJpdmF0ZSBfZXN0YWJsaXNoUHJvdG9jb2woZXh0ZW5zaW9uSG9zdFByb2Nlc3M6IEV4dGVuc2lvbkhvc3RQcm9jZXNzLCBvcHRzOiBJRXh0ZW5zaW9uSG9zdFByb2Nlc3NPcHRpb25zKTogUHJvbWlzZTxJTWVzc2FnZVBhc3NpbmdQcm90b2NvbD4ge1xuXG5cdFx0d3JpdGVFeHRIb3N0Q29ubmVjdGlvbihuZXcgTWVzc2FnZVBvcnRFeHRIb3N0Q29ubmVjdGlvbigpLCBvcHRzLmVudik7XG5cblx0XHQvLyBHZXQgcmVhZHkgdG8gYWNxdWlyZSB0aGUgbWVzc2FnZSBwb3J0IGZyb20gdGhlIHNoYXJlZCBwcm9jZXNzIHdvcmtlclxuXHRcdGNvbnN0IHBvcnRQcm9taXNlID0gYWNxdWlyZVBvcnQodW5kZWZpbmVkIC8qIHdlIHRyaWdnZXIgdGhlIHJlcXVlc3QgdmlhIHNlcnZpY2UgY2FsbCEgKi8sIG9wdHMucmVzcG9uc2VDaGFubmVsLCBvcHRzLnJlc3BvbnNlTm9uY2UpO1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPElNZXNzYWdlUGFzc2luZ1Byb3RvY29sPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblx0XHRcdGNvbnN0IGhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRyZWplY3QoJ1RoZSBsb2NhbCBleHRlbnNpb24gaG9zdCB0b29rIGxvbmdlciB0aGFuIDYwcyB0byBjb25uZWN0LicpO1xuXHRcdFx0fSwgNjAgKiAxMDAwKTtcblxuXHRcdFx0cG9ydFByb21pc2UudGhlbigocG9ydCkgPT4ge1xuXHRcdFx0XHR0aGlzLl90b0Rpc3Bvc2UuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdFx0Ly8gQ2xvc2UgdGhlIG1lc3NhZ2UgcG9ydCB3aGVuIHRoZSBleHRlbnNpb24gaG9zdCBpcyBkaXNwb3NlZFxuXHRcdFx0XHRcdHBvcnQuY2xvc2UoKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRjbGVhclRpbWVvdXQoaGFuZGxlKTtcblxuXHRcdFx0XHRjb25zdCBvbk1lc3NhZ2UgPSBuZXcgQnVmZmVyZWRFbWl0dGVyPFZTQnVmZmVyPigpO1xuXHRcdFx0XHRwb3J0Lm9ubWVzc2FnZSA9ICgoZSkgPT4ge1xuXHRcdFx0XHRcdGlmIChlLmRhdGEpIHtcblx0XHRcdFx0XHRcdG9uTWVzc2FnZS5maXJlKFZTQnVmZmVyLndyYXAoZS5kYXRhKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0cG9ydC5zdGFydCgpO1xuXG5cdFx0XHRcdHJlc29sdmUoe1xuXHRcdFx0XHRcdG9uTWVzc2FnZTogb25NZXNzYWdlLmV2ZW50LFxuXHRcdFx0XHRcdHNlbmQ6IG1lc3NhZ2UgPT4gcG9ydC5wb3N0TWVzc2FnZShtZXNzYWdlLmJ1ZmZlciksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIE5vdyB0aGF0IHRoZSBtZXNzYWdlIHBvcnQgbGlzdGVuZXIgaXMgaW5zdGFsbGVkLCBzdGFydCB0aGUgZXh0IGhvc3QgcHJvY2Vzc1xuXHRcdFx0Y29uc3Qgc3cgPSBTdG9wV2F0Y2guY3JlYXRlKGZhbHNlKTtcblx0XHRcdGV4dGVuc2lvbkhvc3RQcm9jZXNzLnN0YXJ0KG9wdHMpLnRoZW4oKHsgcGlkIH0pID0+IHtcblx0XHRcdFx0aWYgKHBpZCkge1xuXHRcdFx0XHRcdHRoaXMucGlkID0gcGlkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgU3RhcnRlZCBsb2NhbCBleHRlbnNpb24gaG9zdCB3aXRoIHBpZCAke3BpZH0uYCk7XG5cdFx0XHRcdGNvbnN0IGR1cmF0aW9uID0gc3cuZWxhcHNlZCgpO1xuXHRcdFx0XHRpZiAocGxhdGZvcm0uaXNDSSkge1xuXHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgSUV4dGVuc2lvbkhvc3RTdGFydGVyLnN0YXJ0KCkgdG9vayAke2R1cmF0aW9ufSBtcy5gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgKGVycikgPT4ge1xuXHRcdFx0XHQvLyBTdGFydGluZyB0aGUgZXh0IGhvc3QgcHJvY2VzcyByZXN1bHRlZCBpbiBhbiBlcnJvclxuXHRcdFx0XHRyZWplY3QoZXJyKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcGVyZm9ybUhhbmRzaGFrZShwcm90b2NvbDogSU1lc3NhZ2VQYXNzaW5nUHJvdG9jb2wpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyAxKSB3YWl0IGZvciB0aGUgaW5jb21pbmcgYHJlYWR5YCBldmVudCBhbmQgc2VuZCB0aGUgaW5pdGlhbGl6YXRpb24gZGF0YS5cblx0XHQvLyAyKSB3YWl0IGZvciB0aGUgaW5jb21pbmcgYGluaXRpYWxpemVkYCBldmVudC5cblx0XHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG5cdFx0XHRsZXQgdGltZW91dEhhbmRsZTogYW55O1xuXHRcdFx0Y29uc3QgaW5zdGFsbFRpbWVvdXRDaGVjayA9ICgpID0+IHtcblx0XHRcdFx0dGltZW91dEhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdHJlamVjdCgnVGhlIGxvY2FsIGV4dGVuc2lvbiBob3N0IHRvb2sgbG9uZ2VyIHRoYW4gNjBzIHRvIHNlbmQgaXRzIHJlYWR5IG1lc3NhZ2UuJyk7XG5cdFx0XHRcdH0sIDYwICogMTAwMCk7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgdW5pbnN0YWxsVGltZW91dENoZWNrID0gKCkgPT4ge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQodGltZW91dEhhbmRsZSk7XG5cdFx0XHR9O1xuXG5cdFx0XHQvLyBXYWl0IDYwcyBmb3IgdGhlIHJlYWR5IG1lc3NhZ2Vcblx0XHRcdGluc3RhbGxUaW1lb3V0Q2hlY2soKTtcblxuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHByb3RvY29sLm9uTWVzc2FnZShtc2cgPT4ge1xuXG5cdFx0XHRcdGlmIChpc01lc3NhZ2VPZlR5cGUobXNnLCBNZXNzYWdlVHlwZS5SZWFkeSkpIHtcblxuXHRcdFx0XHRcdC8vIDEpIEV4dGVuc2lvbiBIb3N0IGlzIHJlYWR5IHRvIHJlY2VpdmUgbWVzc2FnZXMsIGluaXRpYWxpemUgaXRcblx0XHRcdFx0XHR1bmluc3RhbGxUaW1lb3V0Q2hlY2soKTtcblxuXHRcdFx0XHRcdHRoaXMuX2NyZWF0ZUV4dEhvc3RJbml0RGF0YSgpLnRoZW4oZGF0YSA9PiB7XG5cblx0XHRcdFx0XHRcdC8vIFdhaXQgNjBzIGZvciB0aGUgaW5pdGlhbGl6ZWQgbWVzc2FnZVxuXHRcdFx0XHRcdFx0aW5zdGFsbFRpbWVvdXRDaGVjaygpO1xuXG5cdFx0XHRcdFx0XHRwcm90b2NvbC5zZW5kKFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoZGF0YSkpKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaXNNZXNzYWdlT2ZUeXBlKG1zZywgTWVzc2FnZVR5cGUuSW5pdGlhbGl6ZWQpKSB7XG5cblx0XHRcdFx0XHQvLyAyKSBFeHRlbnNpb24gSG9zdCBpcyBpbml0aWFsaXplZFxuXHRcdFx0XHRcdHVuaW5zdGFsbFRpbWVvdXRDaGVjaygpO1xuXG5cdFx0XHRcdFx0Ly8gc3RvcCBsaXN0ZW5pbmcgZm9yIG1lc3NhZ2VzIGhlcmVcblx0XHRcdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblxuXHRcdFx0XHRcdC8vIHJlbGVhc2UgdGhpcyBwcm9taXNlXG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoYHJlY2VpdmVkIHVuZXhwZWN0ZWQgbWVzc2FnZSBkdXJpbmcgaGFuZHNoYWtlIHBoYXNlIGZyb20gdGhlIGV4dGVuc2lvbiBob3N0OiBgLCBtc2cpO1xuXHRcdFx0fSk7XG5cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NyZWF0ZUV4dEhvc3RJbml0RGF0YSgpOiBQcm9taXNlPElFeHRlbnNpb25Ib3N0SW5pdERhdGE+IHtcblx0XHRjb25zdCBpbml0RGF0YSA9IGF3YWl0IHRoaXMuX2luaXREYXRhUHJvdmlkZXIuZ2V0SW5pdERhdGEoKTtcblx0XHR0aGlzLmV4dGVuc2lvbnMgPSBpbml0RGF0YS5leHRlbnNpb25zO1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRjb21taXQ6IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLmNvbW1pdCxcblx0XHRcdHZlcnNpb246IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLnZlcnNpb24sXG5cdFx0XHRxdWFsaXR5OiB0aGlzLl9wcm9kdWN0U2VydmljZS5xdWFsaXR5LFxuXHRcdFx0cGFyZW50UGlkOiAwLFxuXHRcdFx0ZW52aXJvbm1lbnQ6IHtcblx0XHRcdFx0aXNFeHRlbnNpb25EZXZlbG9wbWVudERlYnVnOiB0aGlzLl9pc0V4dGVuc2lvbkRldkRlYnVnLFxuXHRcdFx0XHRhcHBSb290OiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXBwUm9vdCA/IFVSSS5maWxlKHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5hcHBSb290KSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0YXBwTmFtZTogdGhpcy5fcHJvZHVjdFNlcnZpY2UubmFtZUxvbmcsXG5cdFx0XHRcdGFwcEhvc3Q6IHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLmVtYmVkZGVySWRlbnRpZmllciB8fCAnZGVza3RvcCcsXG5cdFx0XHRcdGFwcFVyaVNjaGVtZTogdGhpcy5fcHJvZHVjdFNlcnZpY2UudXJsUHJvdG9jb2wsXG5cdFx0XHRcdGlzRXh0ZW5zaW9uVGVsZW1ldHJ5TG9nZ2luZ09ubHk6IGlzTG9nZ2luZ09ubHkodGhpcy5fcHJvZHVjdFNlcnZpY2UsIHRoaXMuX2Vudmlyb25tZW50U2VydmljZSksXG5cdFx0XHRcdGFwcExhbmd1YWdlOiBwbGF0Zm9ybS5sYW5ndWFnZSxcblx0XHRcdFx0ZXh0ZW5zaW9uRGV2ZWxvcG1lbnRMb2NhdGlvblVSSTogdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25VUkksXG5cdFx0XHRcdGV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkk6IHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5leHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJLFxuXHRcdFx0XHRnbG9iYWxTdG9yYWdlSG9tZTogdGhpcy5fdXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuZ2xvYmFsU3RvcmFnZUhvbWUsXG5cdFx0XHRcdHdvcmtzcGFjZVN0b3JhZ2VIb21lOiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2Uud29ya3NwYWNlU3RvcmFnZUhvbWUsXG5cdFx0XHRcdGV4dGVuc2lvbkxvZ0xldmVsOiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uTG9nTGV2ZWxcblx0XHRcdH0sXG5cdFx0XHR3b3Jrc3BhY2U6IHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZID8gdW5kZWZpbmVkIDoge1xuXHRcdFx0XHRjb25maWd1cmF0aW9uOiB3b3Jrc3BhY2UuY29uZmlndXJhdGlvbiA/PyB1bmRlZmluZWQsXG5cdFx0XHRcdGlkOiB3b3Jrc3BhY2UuaWQsXG5cdFx0XHRcdG5hbWU6IHRoaXMuX2xhYmVsU2VydmljZS5nZXRXb3Jrc3BhY2VMYWJlbCh3b3Jrc3BhY2UpLFxuXHRcdFx0XHRpc1VudGl0bGVkOiB3b3Jrc3BhY2UuY29uZmlndXJhdGlvbiA/IGlzVW50aXRsZWRXb3Jrc3BhY2Uod29ya3NwYWNlLmNvbmZpZ3VyYXRpb24sIHRoaXMuX2Vudmlyb25tZW50U2VydmljZSkgOiBmYWxzZSxcblx0XHRcdFx0dHJhbnNpZW50OiB3b3Jrc3BhY2UudHJhbnNpZW50XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3RlOiB7XG5cdFx0XHRcdGF1dGhvcml0eTogdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSxcblx0XHRcdFx0Y29ubmVjdGlvbkRhdGE6IG51bGwsXG5cdFx0XHRcdGlzUmVtb3RlOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdGNvbnNvbGVGb3J3YXJkOiB7XG5cdFx0XHRcdGluY2x1ZGVTdGFjazogIXRoaXMuX2lzRXh0ZW5zaW9uRGV2VGVzdEZyb21DbGkgJiYgKHRoaXMuX2lzRXh0ZW5zaW9uRGV2SG9zdCB8fCAhdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmlzQnVpbHQgfHwgdGhpcy5fcHJvZHVjdFNlcnZpY2UucXVhbGl0eSAhPT0gJ3N0YWJsZScgfHwgdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLnZlcmJvc2UpLFxuXHRcdFx0XHRsb2dOYXRpdmU6ICF0aGlzLl9pc0V4dGVuc2lvbkRldlRlc3RGcm9tQ2xpICYmIHRoaXMuX2lzRXh0ZW5zaW9uRGV2SG9zdFxuXHRcdFx0fSxcblx0XHRcdGV4dGVuc2lvbnM6IHRoaXMuZXh0ZW5zaW9ucy50b1NuYXBzaG90KCksXG5cdFx0XHR0ZWxlbWV0cnlJbmZvOiB7XG5cdFx0XHRcdHNlc3Npb25JZDogdGhpcy5fdGVsZW1ldHJ5U2VydmljZS5zZXNzaW9uSWQsXG5cdFx0XHRcdG1hY2hpbmVJZDogdGhpcy5fdGVsZW1ldHJ5U2VydmljZS5tYWNoaW5lSWQsXG5cdFx0XHRcdHNxbUlkOiB0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnNxbUlkLFxuXHRcdFx0XHRkZXZEZXZpY2VJZDogdGhpcy5fdGVsZW1ldHJ5U2VydmljZS5kZXZEZXZpY2VJZCxcblx0XHRcdFx0Zmlyc3RTZXNzaW9uRGF0ZTogdGhpcy5fdGVsZW1ldHJ5U2VydmljZS5maXJzdFNlc3Npb25EYXRlLFxuXHRcdFx0XHRtc2Z0SW50ZXJuYWw6IHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UubXNmdEludGVybmFsXG5cdFx0XHR9LFxuXHRcdFx0bG9nTGV2ZWw6IHRoaXMuX2xvZ1NlcnZpY2UuZ2V0TGV2ZWwoKSxcblx0XHRcdGxvZ2dlcnM6IFsuLi50aGlzLl9sb2dnZXJTZXJ2aWNlLmdldFJlZ2lzdGVyZWRMb2dnZXJzKCldLFxuXHRcdFx0bG9nc0xvY2F0aW9uOiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZXh0SG9zdExvZ3NQYXRoLFxuXHRcdFx0YXV0b1N0YXJ0OiAodGhpcy5zdGFydHVwID09PSBFeHRlbnNpb25Ib3N0U3RhcnR1cC5FYWdlckF1dG9TdGFydCksXG5cdFx0XHR1aUtpbmQ6IFVJS2luZC5EZXNrdG9wLFxuXHRcdFx0aGFuZGxlOiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2Uud2luZG93LmhhbmRsZSA/IGVuY29kZUJhc2U2NCh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2Uud2luZG93LmhhbmRsZSkgOiB1bmRlZmluZWRcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfb25FeHRIb3N0UHJvY2Vzc0V4aXQoY29kZTogbnVtYmVyLCBzaWduYWw6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl90ZXJtaW5hdGluZykge1xuXHRcdFx0Ly8gRXhwZWN0ZWQgdGVybWluYXRpb24gcGF0aCAod2UgYXNrZWQgdGhlIHByb2Nlc3MgdG8gdGVybWluYXRlKVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRXhpdC5maXJlKFtjb2RlLCBzaWduYWxdKTtcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZVByb2Nlc3NPdXRwdXRTdHJlYW0oc3RyZWFtOiBFdmVudDxzdHJpbmc+LCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKSB7XG5cdFx0bGV0IGxhc3QgPSAnJztcblx0XHRsZXQgaXNPbWl0dGluZyA9IGZhbHNlO1xuXHRcdGNvbnN0IGV2ZW50ID0gbmV3IEVtaXR0ZXI8c3RyaW5nPigpO1xuXHRcdHN0cmVhbSgoY2h1bmspID0+IHtcblx0XHRcdC8vIG5vdCBhIGZhbmN5IGFwcHJvYWNoLCBidXQgdGhpcyBpcyB0aGUgc2FtZSBhcHByb2FjaCB1c2VkIGJ5IHRoZSBzcGxpdDJcblx0XHRcdC8vIG1vZHVsZSB3aGljaCBpcyB3ZWxsLW9wdGltaXplZCAoaHR0cHM6Ly9naXRodWIuY29tL21jb2xsaW5hL3NwbGl0Milcblx0XHRcdGxhc3QgKz0gY2h1bms7XG5cdFx0XHRjb25zdCBsaW5lcyA9IGxhc3Quc3BsaXQoL1xccj9cXG4vZyk7XG5cdFx0XHRsYXN0ID0gbGluZXMucG9wKCkhO1xuXG5cdFx0XHQvLyBwcm90ZWN0ZWQgYWdhaW5zdCBhbiBleHRlbnNpb24gc3BhbW1pbmcgYW5kIGxlYWtpbmcgbWVtb3J5IGlmIG5vIG5ldyBsaW5lIGlzIHdyaXR0ZW4uXG5cdFx0XHRpZiAobGFzdC5sZW5ndGggPiAxMF8wMDApIHtcblx0XHRcdFx0bGluZXMucHVzaChsYXN0KTtcblx0XHRcdFx0bGFzdCA9ICcnO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcblx0XHRcdFx0aWYgKGlzT21pdHRpbmcpIHtcblx0XHRcdFx0XHRpZiAobGluZSA9PT0gTmF0aXZlTG9nTWFya2Vycy5FbmQpIHtcblx0XHRcdFx0XHRcdGlzT21pdHRpbmcgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAobGluZSA9PT0gTmF0aXZlTG9nTWFya2Vycy5TdGFydCkge1xuXHRcdFx0XHRcdGlzT21pdHRpbmcgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGxpbmUubGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZXZlbnQuZmlyZShsaW5lICsgJ1xcbicpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSwgdW5kZWZpbmVkLCBzdG9yZSk7XG5cblx0XHRyZXR1cm4gZXZlbnQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgZW5hYmxlSW5zcGVjdFBvcnQoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKCEhdGhpcy5faW5zcGVjdExpc3RlbmVyKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2V4dGVuc2lvbkhvc3RQcm9jZXNzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fZXh0ZW5zaW9uSG9zdFByb2Nlc3MuZW5hYmxlSW5zcGVjdFBvcnQoKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGF3YWl0IFByb21pc2UucmFjZShbRXZlbnQudG9Qcm9taXNlKHRoaXMuX29uRGlkU2V0SW5zcGVjdFBvcnQuZXZlbnQpLCB0aW1lb3V0KDEwMDApXSk7XG5cdFx0cmV0dXJuICEhdGhpcy5faW5zcGVjdExpc3RlbmVyO1xuXHR9XG5cblx0cHVibGljIGdldEluc3BlY3RQb3J0KCk6IHsgcG9ydDogbnVtYmVyOyBob3N0OiBzdHJpbmcgfSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2luc3BlY3RMaXN0ZW5lciA/PyB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9vbldpbGxTaHV0ZG93bihldmVudDogV2lsbFNodXRkb3duRXZlbnQpOiB2b2lkIHtcblx0XHQvLyBJZiB0aGUgZXh0ZW5zaW9uIGRldmVsb3BtZW50IGhvc3Qgd2FzIHN0YXJ0ZWQgd2l0aG91dCBkZWJ1Z2dlciBhdHRhY2hlZCB3ZSBuZWVkXG5cdFx0Ly8gdG8gY29tbXVuaWNhdGUgdGhpcyBiYWNrIHRvIHRoZSBtYWluIHNpZGUgdG8gdGVybWluYXRlIHRoZSBkZWJ1ZyBzZXNzaW9uXG5cdFx0aWYgKHRoaXMuX2lzRXh0ZW5zaW9uRGV2SG9zdCAmJiAhdGhpcy5faXNFeHRlbnNpb25EZXZUZXN0RnJvbUNsaSAmJiAhdGhpcy5faXNFeHRlbnNpb25EZXZEZWJ1ZyAmJiB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZGVidWdFeHRlbnNpb25Ib3N0LmRlYnVnSWQpIHtcblx0XHRcdHRoaXMuX2V4dGVuc2lvbkhvc3REZWJ1Z1NlcnZpY2UudGVybWluYXRlU2Vzc2lvbih0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuZGVidWdFeHRlbnNpb25Ib3N0LmRlYnVnSWQpO1xuXHRcdFx0ZXZlbnQuam9pbih0aW1lb3V0KDEwMCAvKiB3YWl0IGEgYml0IGZvciBJUEMgdG8gZ2V0IGRlbGl2ZXJlZCAqLyksIHsgaWQ6ICdqb2luLmV4dGVuc2lvbkRldmVsb3BtZW50JywgbGFiZWw6IG5scy5sb2NhbGl6ZSgnam9pbi5leHRlbnNpb25EZXZlbG9wbWVudCcsIFwiVGVybWluYXRpbmcgZXh0ZW5zaW9uIGRlYnVnIHNlc3Npb25cIikgfSk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLGNBQWMsZ0JBQWdCO0FBQ3ZDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsaUJBQWlCLG9CQUFvQjtBQUM5QyxZQUFZLGFBQWE7QUFDekIsWUFBWSxjQUFjO0FBQzFCLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQjtBQUU3QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQjtBQUM1QixZQUFZLFNBQVM7QUFDckIsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBdUMsNkJBQTZCO0FBQ3BFLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsYUFBYSxzQkFB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
