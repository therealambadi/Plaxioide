import { createRequire as __createRequire } from "node:module";
const __require = __createRequire(import.meta.url);
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
import { app, protocol, session, systemPreferences } from "electron";
import { addUNCHostToAllowlist, disableUNCAccessRestrictions } from "../../base/node/unc.js";
import { validatedIpcMain } from "../../base/parts/ipc/electron-main/ipcMain.js";
import { hostname, release } from "os";
import { VSBuffer } from "../../base/common/buffer.js";
import { toErrorMessage } from "../../base/common/errorMessage.js";
import { Event } from "../../base/common/event.js";
import { parse } from "../../base/common/jsonc.js";
import { getPathLabel } from "../../base/common/labels.js";
import { Disposable, DisposableStore } from "../../base/common/lifecycle.js";
import { Schemas, VSCODE_AUTHORITY } from "../../base/common/network.js";
import { join, posix } from "../../base/common/path.js";
import { isLinux, isLinuxSnap, isMacintosh, isWindows, OS } from "../../base/common/platform.js";
import { assertType } from "../../base/common/types.js";
import { URI } from "../../base/common/uri.js";
import { generateUuid } from "../../base/common/uuid.js";
import { registerContextMenuListener } from "../../base/parts/contextmenu/electron-main/contextmenu.js";
import { getDelayedChannel, ProxyChannel, StaticRouter } from "../../base/parts/ipc/common/ipc.js";
import { Server as ElectronIPCServer } from "../../base/parts/ipc/electron-main/ipc.electron.js";
import { Client as MessagePortClient } from "../../base/parts/ipc/electron-main/ipc.mp.js";
import { IProxyAuthService, ProxyAuthService } from "../../platform/native/electron-main/auth.js";
import { localize } from "../../nls.js";
import { IBackupMainService } from "../../platform/backup/electron-main/backup.js";
import { BackupMainService } from "../../platform/backup/electron-main/backupMainService.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { ElectronExtensionHostDebugBroadcastChannel } from "../../platform/debug/electron-main/extensionHostDebugIpc.js";
import { IDiagnosticsService } from "../../platform/diagnostics/common/diagnostics.js";
import { DiagnosticsMainService, IDiagnosticsMainService } from "../../platform/diagnostics/electron-main/diagnosticsMainService.js";
import { DialogMainService, IDialogMainService } from "../../platform/dialogs/electron-main/dialogMainService.js";
import { IEncryptionMainService } from "../../platform/encryption/common/encryptionService.js";
import { EncryptionMainService } from "../../platform/encryption/electron-main/encryptionMainService.js";
import { IEnvironmentMainService } from "../../platform/environment/electron-main/environmentMainService.js";
import { isLaunchedFromCli } from "../../platform/environment/node/argvHelper.js";
import { getResolvedShellEnv } from "../../platform/shell/node/shellEnv.js";
import { IExtensionHostStarter, ipcExtensionHostStarterChannelName } from "../../platform/extensions/common/extensionHostStarter.js";
import { ExtensionHostStarter } from "../../platform/extensions/electron-main/extensionHostStarter.js";
import { IExternalTerminalMainService } from "../../platform/externalTerminal/electron-main/externalTerminal.js";
import { LinuxExternalTerminalService, MacExternalTerminalService, WindowsExternalTerminalService } from "../../platform/externalTerminal/node/externalTerminalService.js";
import { LOCAL_FILE_SYSTEM_CHANNEL_NAME } from "../../platform/files/common/diskFileSystemProviderClient.js";
import { IFileService } from "../../platform/files/common/files.js";
import { DiskFileSystemProviderChannel } from "../../platform/files/electron-main/diskFileSystemProviderServer.js";
import { DiskFileSystemProvider } from "../../platform/files/node/diskFileSystemProvider.js";
import { SyncDescriptor } from "../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../platform/instantiation/common/serviceCollection.js";
import { IProcessMainService } from "../../platform/process/common/process.js";
import { ProcessMainService } from "../../platform/process/electron-main/processMainService.js";
import { IKeyboardLayoutMainService, KeyboardLayoutMainService } from "../../platform/keyboardLayout/electron-main/keyboardLayoutMainService.js";
import { ILaunchMainService, LaunchMainService } from "../../platform/launch/electron-main/launchMainService.js";
import { ILifecycleMainService, LifecycleMainPhase, ShutdownReason } from "../../platform/lifecycle/electron-main/lifecycleMainService.js";
import { ILoggerService, ILogService } from "../../platform/log/common/log.js";
import { IMenubarMainService, MenubarMainService } from "../../platform/menubar/electron-main/menubarMainService.js";
import { INativeHostMainService, NativeHostMainService } from "../../platform/native/electron-main/nativeHostMainService.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { getRemoteAuthority } from "../../platform/remote/common/remoteHosts.js";
import { SharedProcess } from "../../platform/sharedProcess/electron-main/sharedProcess.js";
import { ISignService } from "../../platform/sign/common/sign.js";
import { IStateService } from "../../platform/state/node/state.js";
import { StorageDatabaseChannel } from "../../platform/storage/electron-main/storageIpc.js";
import { ApplicationStorageMainService, IApplicationStorageMainService, IStorageMainService, StorageMainService } from "../../platform/storage/electron-main/storageMainService.js";
import { resolveCommonProperties } from "../../platform/telemetry/common/commonProperties.js";
import { ITelemetryService, TelemetryLevel } from "../../platform/telemetry/common/telemetry.js";
import { TelemetryAppenderClient } from "../../platform/telemetry/common/telemetryIpc.js";
import { TelemetryService } from "../../platform/telemetry/common/telemetryService.js";
import { getPiiPathsFromEnvironment, getTelemetryLevel, isInternalTelemetry, NullTelemetryService, supportsTelemetry } from "../../platform/telemetry/common/telemetryUtils.js";
import { IUpdateService } from "../../platform/update/common/update.js";
import { UpdateChannel } from "../../platform/update/common/updateIpc.js";
import { DarwinUpdateService } from "../../platform/update/electron-main/updateService.darwin.js";
import { LinuxUpdateService } from "../../platform/update/electron-main/updateService.linux.js";
import { SnapUpdateService } from "../../platform/update/electron-main/updateService.snap.js";
import { Win32UpdateService } from "../../platform/update/electron-main/updateService.win32.js";
import { IURLService } from "../../platform/url/common/url.js";
import { URLHandlerChannelClient, URLHandlerRouter } from "../../platform/url/common/urlIpc.js";
import { NativeURLService } from "../../platform/url/common/urlService.js";
import { ElectronURLListener } from "../../platform/url/electron-main/electronUrlListener.js";
import { IWebviewManagerService } from "../../platform/webview/common/webviewManagerService.js";
import { WebviewMainService } from "../../platform/webview/electron-main/webviewMainService.js";
import { isFolderToOpen, isWorkspaceToOpen } from "../../platform/window/common/window.js";
import { getAllWindowsExcludingOffscreen, IWindowsMainService, OpenContext } from "../../platform/windows/electron-main/windows.js";
import { WindowsMainService } from "../../platform/windows/electron-main/windowsMainService.js";
import { ActiveWindowManager } from "../../platform/windows/node/windowTracker.js";
import { hasWorkspaceFileExtension } from "../../platform/workspace/common/workspace.js";
import { IWorkspacesService } from "../../platform/workspaces/common/workspaces.js";
import { IWorkspacesHistoryMainService, WorkspacesHistoryMainService } from "../../platform/workspaces/electron-main/workspacesHistoryMainService.js";
import { WorkspacesMainService } from "../../platform/workspaces/electron-main/workspacesMainService.js";
import { IWorkspacesManagementMainService, WorkspacesManagementMainService } from "../../platform/workspaces/electron-main/workspacesManagementMainService.js";
import { IPolicyService } from "../../platform/policy/common/policy.js";
import { PolicyChannel } from "../../platform/policy/common/policyIpc.js";
import { IUserDataProfilesMainService } from "../../platform/userDataProfile/electron-main/userDataProfile.js";
import { IExtensionsProfileScannerService } from "../../platform/extensionManagement/common/extensionsProfileScannerService.js";
import { IExtensionsScannerService } from "../../platform/extensionManagement/common/extensionsScannerService.js";
import { ExtensionsScannerService } from "../../platform/extensionManagement/node/extensionsScannerService.js";
import { UserDataProfilesHandler } from "../../platform/userDataProfile/electron-main/userDataProfilesHandler.js";
import { ProfileStorageChangesListenerChannel } from "../../platform/userDataProfile/electron-main/userDataProfileStorageIpc.js";
import { Promises, RunOnceScheduler, runWhenGlobalIdle } from "../../base/common/async.js";
import { resolveMachineId, resolveSqmId, resolvedevDeviceId, validatedevDeviceId } from "../../platform/telemetry/electron-main/telemetryUtils.js";
import { ExtensionsProfileScannerService } from "../../platform/extensionManagement/node/extensionsProfileScannerService.js";
import { LoggerChannel } from "../../platform/log/electron-main/logIpc.js";
import { ILoggerMainService } from "../../platform/log/electron-main/loggerService.js";
import { IUtilityProcessWorkerMainService, UtilityProcessWorkerMainService } from "../../platform/utilityProcess/electron-main/utilityProcessWorkerMainService.js";
import { ipcUtilityProcessWorkerChannelName } from "../../platform/utilityProcess/common/utilityProcessWorkerService.js";
import { ILocalPtyService, LocalReconnectConstants, TerminalIpcChannels, TerminalSettingId } from "../../platform/terminal/common/terminal.js";
import { ElectronPtyHostStarter } from "../../platform/terminal/electron-main/electronPtyHostStarter.js";
import { PtyHostService } from "../../platform/terminal/node/ptyHostService.js";
import { NODE_REMOTE_RESOURCE_CHANNEL_NAME, NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, NodeRemoteResourceRouter } from "../../platform/remote/common/electronRemoteResources.js";
import { Lazy } from "../../base/common/lazy.js";
import { IAuxiliaryWindowsMainService } from "../../platform/auxiliaryWindow/electron-main/auxiliaryWindows.js";
import { AuxiliaryWindowsMainService } from "../../platform/auxiliaryWindow/electron-main/auxiliaryWindowsMainService.js";
import { normalizeNFC } from "../../base/common/normalization.js";
import { ICSSDevelopmentService, CSSDevelopmentService } from "../../platform/cssDev/node/cssDevService.js";
import { INativeMcpDiscoveryHelperService, NativeMcpDiscoveryHelperChannelName } from "../../platform/mcp/common/nativeMcpDiscoveryHelper.js";
import { NativeMcpDiscoveryHelperService } from "../../platform/mcp/node/nativeMcpDiscoveryHelperService.js";
import { IWebContentExtractorService } from "../../platform/webContentExtractor/common/webContentExtractor.js";
import { NativeWebContentExtractorService } from "../../platform/webContentExtractor/electron-main/webContentExtractorService.js";
import ErrorTelemetry from "../../platform/telemetry/electron-main/errorTelemetry.js";
import { IMetricsService } from "../../workbench/contrib/void/common/metricsService.js";
import { IVoidUpdateService } from "../../workbench/contrib/void/common/voidUpdateService.js";
import { MetricsMainService } from "../../workbench/contrib/void/electron-main/metricsMainService.js";
import { VoidMainUpdateService } from "../../workbench/contrib/void/electron-main/voidUpdateMainService.js";
import { LLMMessageChannel } from "../../workbench/contrib/void/electron-main/sendLLMMessageChannel.js";
import { VoidSCMService } from "../../workbench/contrib/void/electron-main/voidSCMMainService.js";
import { IVoidSCMService } from "../../workbench/contrib/void/common/voidSCMTypes.js";
import { MCPChannel } from "../../workbench/contrib/void/electron-main/mcpChannel.js";
let CodeApplication = class extends Disposable {
  constructor(mainProcessNodeIpcServer, userEnv, mainInstantiationService, logService, loggerService, environmentMainService, lifecycleMainService, configurationService, stateService, fileService, productService, userDataProfilesMainService) {
    super();
    this.mainProcessNodeIpcServer = mainProcessNodeIpcServer;
    this.userEnv = userEnv;
    this.mainInstantiationService = mainInstantiationService;
    this.logService = logService;
    this.loggerService = loggerService;
    this.environmentMainService = environmentMainService;
    this.lifecycleMainService = lifecycleMainService;
    this.configurationService = configurationService;
    this.stateService = stateService;
    this.fileService = fileService;
    this.productService = productService;
    this.userDataProfilesMainService = userDataProfilesMainService;
    this._fuxaChild = undefined;
    this._fuxaShuttingDown = false;
    this.configureSession();
    this.registerListeners();
  }
  configureSession() {
    const isUrlFromWindow = (requestingUrl) => requestingUrl?.startsWith(`${Schemas.vscodeFileResource}://${VSCODE_AUTHORITY}`);
    const isUrlFromWebview = (requestingUrl) => requestingUrl?.startsWith(`${Schemas.vscodeWebview}://`);
    const allowedPermissionsInWebview = /* @__PURE__ */ new Set([
      "clipboard-read",
      "clipboard-sanitized-write",
      // TODO(deepak1556): Should be removed once migration is complete
      // https://github.com/microsoft/vscode/issues/239228
      "deprecated-sync-clipboard-read"
    ]);
    const allowedPermissionsInCore = /* @__PURE__ */ new Set([
      "media",
      "local-fonts",
      // TODO(deepak1556): Should be removed once migration is complete
      // https://github.com/microsoft/vscode/issues/239228
      "deprecated-sync-clipboard-read"
    ]);
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
      if (isUrlFromWebview(details.requestingUrl)) {
        return callback(allowedPermissionsInWebview.has(permission));
      }
      if (isUrlFromWindow(details.requestingUrl)) {
        return callback(allowedPermissionsInCore.has(permission));
      }
      return callback(false);
    });
    session.defaultSession.setPermissionCheckHandler((_webContents, permission, _origin, details) => {
      if (isUrlFromWebview(details.requestingUrl)) {
        return allowedPermissionsInWebview.has(permission);
      }
      if (isUrlFromWindow(details.requestingUrl)) {
        return allowedPermissionsInCore.has(permission);
      }
      return false;
    });
    const supportedSvgSchemes = /* @__PURE__ */ new Set([Schemas.file, Schemas.vscodeFileResource, Schemas.vscodeRemoteResource, Schemas.vscodeManagedRemoteResource, "devtools"]);
    const isSafeFrame = (requestFrame) => {
      for (let frame = requestFrame; frame; frame = frame.parent) {
        if (frame.url.startsWith(`${Schemas.vscodeWebview}://`)) {
          return true;
        }
      }
      return false;
    };
    const isSvgRequestFromSafeContext = (details) => {
      if (details.resourceType === "xhr") return true;
      if (isSafeFrame(details.frame)) return true;
      // Allow SVG requests that originate from the FUXA HMI iframe (http://127.0.0.1:1881)
      for (let frame = details.frame; frame; frame = frame.parent) {
        if (frame.url && frame.url.startsWith("http://127.0.0.1:1881")) return true;
      }
      return false;
    };
    const isAllowedVsCodeFileRequest = (details) => {
      const frame = details.frame;
      if (!frame || !this.windowsMainService) {
        return false;
      }
      const windows = getAllWindowsExcludingOffscreen();
      for (const window of windows) {
        if (frame.processId === window.webContents.mainFrame.processId) {
          return true;
        }
      }
      return false;
    };
    const isAllowedWebviewRequest = (uri, details) => {
      if (uri.path !== "/index.html") {
        return true;
      }
      const frame = details.frame;
      if (!frame || !this.windowsMainService) {
        return false;
      }
      for (const window of this.windowsMainService.getWindows()) {
        if (window.win) {
          if (frame.processId === window.win.webContents.mainFrame.processId) {
            return true;
          }
        }
      }
      return false;
    };
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const uri = URI.parse(details.url);
      if (uri.scheme === Schemas.vscodeWebview) {
        if (!isAllowedWebviewRequest(uri, details)) {
          this.logService.error("Blocked vscode-webview request", details.url);
          return callback({ cancel: true });
        }
      }
      if (uri.scheme === Schemas.vscodeFileResource) {
        if (!isAllowedVsCodeFileRequest(details)) {
          this.logService.error("Blocked vscode-file request", details.url);
          return callback({ cancel: true });
        }
      }
      if (uri.path.endsWith(".svg")) {
        const isSafeResourceUrl = supportedSvgSchemes.has(uri.scheme);
        if (!isSafeResourceUrl) {
          return callback({ cancel: !isSvgRequestFromSafeContext(details) });
        }
      }
      return callback({ cancel: false });
    });
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders;
      const contentTypes = responseHeaders["content-type"] || responseHeaders["Content-Type"];
      if (contentTypes && Array.isArray(contentTypes)) {
        const uri = URI.parse(details.url);
        if (uri.path.endsWith(".svg")) {
          if (supportedSvgSchemes.has(uri.scheme)) {
            responseHeaders["Content-Type"] = ["image/svg+xml"];
            return callback({ cancel: false, responseHeaders });
          }
        }
        if (!uri.path.endsWith(Schemas.vscodeRemoteResource) && contentTypes.some((contentType) => contentType.toLowerCase().includes("image/svg"))) {
          return callback({ cancel: !isSvgRequestFromSafeContext(details) });
        }
      }
      return callback({ cancel: false });
    });
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (details.url.startsWith("https://vscode.download.prss.microsoft.com/")) {
        const responseHeaders = details.responseHeaders ?? /* @__PURE__ */ Object.create(null);
        if (responseHeaders["Access-Control-Allow-Origin"] === void 0) {
          responseHeaders["Access-Control-Allow-Origin"] = ["*"];
          return callback({ cancel: false, responseHeaders });
        }
      }
      return callback({ cancel: false });
    });
    const defaultSession = session.defaultSession;
    if (typeof defaultSession.setCodeCachePath === "function" && this.environmentMainService.codeCachePath) {
      defaultSession.setCodeCachePath(join(this.environmentMainService.codeCachePath, "chrome"));
    }
    if (isWindows) {
      if (this.configurationService.getValue("security.restrictUNCAccess") === false) {
        disableUNCAccessRestrictions();
      } else {
        addUNCHostToAllowlist(this.configurationService.getValue("security.allowedUNCHosts"));
      }
    }
  }
  registerListeners() {
    Event.once(this.lifecycleMainService.onWillShutdown)(() => this.dispose());
    registerContextMenuListener();
    app.on("accessibility-support-changed", (event, accessibilitySupportEnabled) => {
      this.windowsMainService?.sendToAll("vscode:accessibilitySupportChanged", accessibilitySupportEnabled);
    });
    app.on("activate", async (event, hasVisibleWindows) => {
      this.logService.trace("app#activate");
      if (!hasVisibleWindows) {
        await this.windowsMainService?.openEmptyWindow({ context: OpenContext.DOCK });
      }
    });
    app.on("web-contents-created", (event, contents) => {
      if (contents?.opener?.url.startsWith(`${Schemas.vscodeFileResource}://${VSCODE_AUTHORITY}/`)) {
        this.logService.trace('[aux window]  app.on("web-contents-created"): Registering auxiliary window');
        this.auxiliaryWindowsMainService?.registerWindow(contents);
      }
      contents.on("will-navigate", (event2) => {
        this.logService.error("webContents#will-navigate: Prevented webcontent navigation");
        event2.preventDefault();
      });
      contents.setWindowOpenHandler((details) => {
        if (details.url === "about:blank") {
          this.logService.trace("[aux window] webContents#setWindowOpenHandler: Allowing auxiliary window to open on about:blank");
          return {
            action: "allow",
            overrideBrowserWindowOptions: this.auxiliaryWindowsMainService?.createWindow(details)
          };
        } else {
          this.logService.trace(`webContents#setWindowOpenHandler: Prevented opening window with URL ${details.url}}`);
          this.nativeHostMainService?.openExternal(void 0, details.url);
          return { action: "deny" };
        }
      });
    });
    let macOpenFileURIs = [];
    let runningTimeout = void 0;
    app.on("open-file", (event, path) => {
      path = normalizeNFC(path);
      this.logService.trace("app#open-file: ", path);
      event.preventDefault();
      macOpenFileURIs.push(hasWorkspaceFileExtension(path) ? { workspaceUri: URI.file(path) } : { fileUri: URI.file(path) });
      if (runningTimeout !== void 0) {
        clearTimeout(runningTimeout);
        runningTimeout = void 0;
      }
      runningTimeout = setTimeout(async () => {
        await this.windowsMainService?.open({
          context: OpenContext.DOCK,
          cli: this.environmentMainService.args,
          urisToOpen: macOpenFileURIs,
          gotoLineMode: false,
          preferNewWindow: true
          /* dropping on the dock or opening from finder prefers to open in a new window */
        });
        macOpenFileURIs = [];
        runningTimeout = void 0;
      }, 100);
    });
    app.on("new-window-for-tab", async () => {
      await this.windowsMainService?.openEmptyWindow({ context: OpenContext.DESKTOP });
    });
    validatedIpcMain.handle("vscode:fetchShellEnv", (event) => {
      const window = this.windowsMainService?.getWindowByWebContents(event.sender);
      let args;
      let env;
      if (window?.config) {
        args = window.config;
        env = { ...process.env, ...window.config.userEnv };
      } else {
        args = this.environmentMainService.args;
        env = process.env;
      }
      return this.resolveShellEnvironment(args, env, false);
    });
    validatedIpcMain.on("vscode:toggleDevTools", (event) => event.sender.toggleDevTools());
    validatedIpcMain.on("vscode:openDevTools", (event) => event.sender.openDevTools());
    validatedIpcMain.on("vscode:reloadWindow", (event) => event.sender.reload());
    validatedIpcMain.handle("vscode:notifyZoomLevel", async (event, zoomLevel) => {
      const window = this.windowsMainService?.getWindowByWebContents(event.sender);
      if (window) {
        window.notifyZoomLevel(zoomLevel);
      }
    });
  }
  _killPortOccupant() {
    const { execSync } = __require("child_process");
    try {
      if (process.platform === "win32") {
        const output = execSync("netstat -ano | findstr :1881 | findstr LISTENING", { encoding: "utf-8" });
        const pids = new Set(output.trim().split("\n").map(line => line.trim().split(/\s+/).pop()).filter(Boolean));
        for (const pid of pids) {
          try { execSync(`taskkill /PID ${pid} /F`); } catch { }
        }
      } else {
        execSync("lsof -ti :1881 | xargs kill -9");
      }
    } catch { }
  }
  startFuxaServer() {
    const path = __require("path");
    const { spawn } = __require("child_process");
    const fs = __require("fs");
    const fuxaServerPath = path.join(this.environmentMainService.appRoot, "vendor", "fuxa-server");
    const fuxaMain = path.join(fuxaServerPath, "main.js");
    const userDir = path.join(this.environmentMainService.userDataPath, "fuxa-data");
    const logService = this.logService;

    Event.once(this.lifecycleMainService.onWillShutdown)(() => {
      this._fuxaShuttingDown = true;
      if (this._fuxaChild) {
        this._fuxaChild.kill("SIGTERM");
        setTimeout(() => { if (this._fuxaChild) { this._fuxaChild.kill("SIGKILL"); } }, 2000);
      }
    });

    const doSpawn = (attempt, backoffMs) => {
      if (this._fuxaShuttingDown) return;
      try {
        fs.mkdirSync(path.join(userDir, "_appdata"), { recursive: true });
        logService.info(`[FUXA] Starting server (attempt ${attempt})...`);
        const child = spawn(process.execPath, [fuxaMain, "--userDir", userDir], {
          cwd: fuxaServerPath,
          env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", uiHost: "127.0.0.1", LSUIElement: "1" },
          stdio: ["ignore", "pipe", "pipe"]
        });
        this._fuxaChild = child;
        child.stdout.on("data", (data) => logService.info(`[FUXA] ${data.toString().trim()}`));
        child.stderr.on("data", (data) => logService.warn(`[FUXA] ${data.toString().trim()}`));
        child.on("error", (err) => logService.error(`[FUXA] process error: ${err.message}`));
        child.on("exit", (code) => {
          logService.info(`[FUXA] process exited with code ${code}`);
          this._fuxaChild = undefined;
          if (this._fuxaShuttingDown || code === 0) return;
          if (attempt < 3) {
            logService.info(`[FUXA] Crash detected (code ${code}) — restarting in ${backoffMs}ms...`);
            this._killPortOccupant();
            setTimeout(() => doSpawn(attempt + 1, backoffMs * 2), backoffMs);
          } else {
            logService.error("[FUXA] Gave up after 3 failed attempts");
          }
        });
      } catch (err) {
        logService.error(`[FUXA] Failed to start server: ${err.message}`);
      }
    };

    this._killPortOccupant();
    setTimeout(() => doSpawn(1, 1000), 500);
  }
  startVerificationService() {
    const path = __require("path");
    const fs = __require("fs");
    const os = __require("os");
    const { spawn, execSync } = __require("child_process");
    const logService = this.logService;
    const appRoot = this.environmentMainService.appRoot;

    const ESBMC_VERSION = "v8.4";
    const RELEASE_BASE = `https://github.com/esbmc/esbmc/releases/download/${ESBMC_VERSION}`;

    const getUserDataDir = () => {
      if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Plaxio", "esbmc");
      if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Plaxio", "esbmc");
      return path.join(os.homedir(), ".config", "plaxio", "esbmc");
    };

    const findBinaryInDir = (dir) => {
      const binaryName = process.platform === "win32" ? "esbmc.exe" : "esbmc";
      const direct = path.join(dir, binaryName);
      if (fs.existsSync(direct)) return direct;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const nested = path.join(dir, entry.name, binaryName);
            if (fs.existsSync(nested)) return nested;
            const binNested = path.join(dir, entry.name, "bin", binaryName);
            if (fs.existsSync(binNested)) return binNested;
          }
        }
      } catch {}
      return null;
    };

    let _cachedBinaryPath = null;

    const findBinary = () => {
      if (_cachedBinaryPath && fs.existsSync(_cachedBinaryPath)) return _cachedBinaryPath;
      const bundledPaths = [
        path.join(appRoot, "vendor", "esbmc-plcplus", "esbmc"),
        path.join(appRoot, "vendor", "esbmc-plcplus", "esbmc.exe"),
      ];
      if (process.resourcesPath) {
        bundledPaths.push(
          path.join(process.resourcesPath, "vendor", "esbmc-plcplus", "esbmc"),
          path.join(process.resourcesPath, "vendor", "esbmc-plcplus", "esbmc.exe")
        );
      }
      for (const p of bundledPaths) {
        if (fs.existsSync(p)) { _cachedBinaryPath = p; return p; }
      }
      const userDir = getUserDataDir();
      if (fs.existsSync(userDir)) {
        const found = findBinaryInDir(userDir);
        if (found) { _cachedBinaryPath = found; return found; }
      }
      const names = process.platform === "win32" ? ["esbmc-plcplus.exe", "esbmc.exe"] : ["esbmc-plcplus", "esbmc"];
      for (const name of names) {
        try {
          const whichCmd = process.platform === "win32" ? `where ${name}` : `which ${name}`;
          const result = execSync(whichCmd, { encoding: "utf-8", timeout: 5000, stdio: "pipe" }).trim().split("\n")[0];
          if (result && fs.existsSync(result)) { _cachedBinaryPath = result; return result; }
        } catch {}
      }
      return null;
    };

    function discoverEngine() {
      const binaryPath = findBinary();
      if (binaryPath) {
        let version = "installed";
        try { version = execSync(`"${binaryPath}" --version 2>&1`, { encoding: "utf-8", timeout: 5000 }).trim().split("\n")[0]; } catch {}
        return { available: true, mode: "native", binaryPath, version, downloadable: false };
      }
      return { available: false, mode: null, binaryPath: "", version: "", downloadable: true };
    }

    let _downloading = false;

    async function downloadEngine() {
      if (_downloading) throw new Error("Download already in progress");
      _downloading = true;
      const https = __require("https");
      const http = __require("http");

      const getPlatformUrl = () => {
        if (process.platform === "darwin") return `${RELEASE_BASE}/esbmc-macos.zip`;
        if (process.platform === "win32") return `${RELEASE_BASE}/esbmc-windows.zip`;
        return `${RELEASE_BASE}/esbmc-linux.zip`;
      };

      const followRedirects = (url) => new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === "https:" ? https : http;
        lib.get(url, { headers: { "User-Agent": "Plaxio-IDE" } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            followRedirects(res.headers.location).then(resolve, reject);
          } else { resolve(res); }
        }).on("error", reject);
      });

      try {
        const userDir = getUserDataDir();
        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

        const archiveName = process.platform === "win32" ? "esbmc-windows.zip" : process.platform === "darwin" ? "esbmc-macos.zip" : "esbmc-linux.zip";
        const archivePath = path.join(userDir, archiveName);

        logService.info(`[Verify] Downloading ESBMC from ${getPlatformUrl()}`);
        const res = await followRedirects(getPlatformUrl());
        if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);

        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(archivePath);
          res.pipe(file);
          file.on("finish", () => { file.close(); resolve(); });
          file.on("error", reject);
          res.on("error", reject);
        });

        logService.info("[Verify] Extracting ESBMC archive...");
        const extractDir = path.join(userDir, "extracted");
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
        fs.mkdirSync(extractDir, { recursive: true });

        if (process.platform === "win32") {
          execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`, { timeout: 120000, stdio: "pipe" });
        } else {
          execSync(`unzip -o "${archivePath}" -d "${extractDir}"`, { timeout: 120000, stdio: "pipe" });
        }

        const foundBinary = findBinaryInDir(extractDir);
        if (!foundBinary) throw new Error("ESBMC binary not found in archive");

        const finalPath = path.join(userDir, process.platform === "win32" ? "esbmc.exe" : "esbmc");
        fs.copyFileSync(foundBinary, finalPath);
        if (process.platform !== "win32") fs.chmodSync(finalPath, 0o755);

        // Bundle dylibs on macOS
        if (process.platform === "darwin") {
          const libDir = path.join(userDir, "lib");
          if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
          const extractedLibDir = path.join(extractDir, "lib");
          if (fs.existsSync(extractedLibDir)) {
            for (const f of fs.readdirSync(extractedLibDir).filter(n => n.endsWith(".dylib"))) {
              fs.copyFileSync(path.join(extractedLibDir, f), path.join(libDir, f));
            }
          }
          try {
            const otoolOut = execSync(`otool -L "${finalPath}"`, { encoding: "utf-8", timeout: 10000 });
            const brewLibs = otoolOut.split("\n").map(l => l.trim().split(" ")[0]).filter(l => l.includes("/opt/homebrew") || l.includes("/usr/local"));
            for (const lib of brewLibs) {
              const bn = path.basename(lib);
              if (fs.existsSync(path.join(libDir, bn))) {
                try { execSync(`install_name_tool -change "${lib}" "@loader_path/lib/${bn}" "${finalPath}"`, { stdio: "pipe" }); } catch {}
              }
            }
            try { execSync(`codesign --force --sign - "${finalPath}"`, { stdio: "pipe" }); } catch {}
            for (const f of fs.readdirSync(libDir).filter(n => n.endsWith(".dylib"))) {
              try { execSync(`codesign --force --sign - "${path.join(libDir, f)}"`, { stdio: "pipe" }); } catch {}
            }
          } catch (e) { logService.warn("[Verify] dylib bundling partial:", e.message); }
        }

        try { fs.unlinkSync(archivePath); } catch {}
        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}

        _cachedBinaryPath = finalPath;
        let version = "installed";
        try { version = execSync(`"${finalPath}" --version 2>&1`, { encoding: "utf-8", timeout: 10000 }).trim().split("\n")[0]; } catch {}

        logService.info(`[Verify] ESBMC installed: ${finalPath} (${version})`);
        return { available: true, mode: "native", binaryPath: finalPath, version, downloadable: false };
      } finally {
        _downloading = false;
      }
    }

    const _activeProcesses = new Map();

    function spawnAsync(command, args, timeoutMs, runId) {
      return new Promise((resolve) => {
        let stdout = "", stderr = "", timedOut = false;
        let proc;
        const spawnEnv = { ...process.env, LANG: "C" };
        const libDir = path.join(path.dirname(command), "lib");
        if (process.platform === "darwin" && fs.existsSync(libDir)) { spawnEnv.DYLD_LIBRARY_PATH = libDir + (process.env.DYLD_LIBRARY_PATH ? ":" + process.env.DYLD_LIBRARY_PATH : ""); }
        try { proc = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], env: spawnEnv }); }
        catch (err) { resolve({ stdout: "", stderr: `Spawn error: ${err.message}`, exitCode: -1 }); return; }
        _activeProcesses.set(runId, proc);
        proc.stdout && proc.stdout.on("data", (d) => { stdout += d.toString(); });
        proc.stderr && proc.stderr.on("data", (d) => { stderr += d.toString(); });
        const timer = setTimeout(() => {
          timedOut = true;
          try { proc.kill("SIGTERM"); } catch {}
          setTimeout(() => { try { if (!proc.killed) proc.kill("SIGKILL"); } catch {} }, 2000);
        }, timeoutMs);
        proc.on("close", (code) => {
          clearTimeout(timer);
          _activeProcesses.delete(runId);
          resolve({ stdout, stderr: timedOut ? stderr + "\nTimed out" : stderr, exitCode: timedOut ? 137 : (code ?? -1) });
        });
        proc.on("error", (err) => {
          clearTimeout(timer);
          _activeProcesses.delete(runId);
          resolve({ stdout, stderr: `Process error: ${err.message}`, exitCode: -1 });
        });
      });
    }

    validatedIpcMain.handle("vscode:plaxio-verify-check-engine", async (_event) => {
      const result = discoverEngine();
      logService.info(`[Verify] engine check: available=${result.available} mode=${result.mode} path=${result.binaryPath}`);
      return result;
    });

    validatedIpcMain.handle("vscode:plaxio-verify-run", async (_event, config) => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plaxio-verify-"));
      const stFilePath = path.join(tmpDir, "program.st");
      try {
        fs.writeFileSync(stFilePath, config.instrumentedST, "utf-8");
        const startTime = Date.now();
        let result;
        if (config.mode === "docker") {
          result = await spawnAsync("docker", [
            "run", "--rm", "-v", `${tmpDir}:/work`, "-w", "/work",
            config.binaryPath, "esbmc", "program.st",
            "--k-induction", "--k-step", String(config.kInductionDepth),
            "--timeout", String(Math.floor(config.timeoutMs / 1000)), 
          ], config.timeoutMs, config.runId);
        } else {
          result = await spawnAsync(config.binaryPath, [
            stFilePath, "--k-induction", "--k-step", String(config.kInductionDepth),
            "--timeout", String(Math.floor(config.timeoutMs / 1000)), 
          ], config.timeoutMs, config.runId);
        }
        const timeMs = Date.now() - startTime;
        return { runId: config.runId, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, timeMs, propertyIds: config.propertyIds };
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        _activeProcesses.delete(config.runId);
      }
    });

    validatedIpcMain.handle("vscode:plaxio-verify-cancel", async (_event, { runId }) => {
      const proc = _activeProcesses.get(runId);
      if (proc) {
        try { proc.kill("SIGTERM"); } catch {}
        setTimeout(() => { try { if (!proc.killed) proc.kill("SIGKILL"); } catch {} }, 3000);
        _activeProcesses.delete(runId);
      }
    });

    validatedIpcMain.handle("vscode:plaxio-verify-download-engine", async (_event) => {
      logService.info("[Verify] Download engine requested");
      return downloadEngine();
    });

    logService.info("[Verify] IPC handlers registered (vscode:plaxio-verify-*)");
  }
  async startup() {
    this.logService.debug("Starting VS Code");
    this.logService.debug(`from: ${this.environmentMainService.appRoot}`);
    this.logService.debug("args:", this.environmentMainService.args);
    const win32AppUserModelId = this.productService.win32AppUserModelId;
    if (isWindows && win32AppUserModelId) {
      app.setAppUserModelId(win32AppUserModelId);
    }
    try {
      if (isMacintosh && this.configurationService.getValue("window.nativeTabs") === true && !systemPreferences.getUserDefault("NSUseImprovedLayoutPass", "boolean")) {
        systemPreferences.setUserDefault("NSUseImprovedLayoutPass", "boolean", true);
      }
    } catch (error) {
      this.logService.error(error);
    }
    const mainProcessElectronServer = new ElectronIPCServer();
    Event.once(this.lifecycleMainService.onWillShutdown)((e) => {
      if (e.reason === ShutdownReason.KILL) {
        mainProcessElectronServer.dispose();
      }
    });
    this.logService.trace("Resolving machine identifier...");
    const [machineId, sqmId, devDeviceId] = await Promise.all([
      resolveMachineId(this.stateService, this.logService),
      resolveSqmId(this.stateService, this.logService),
      resolvedevDeviceId(this.stateService, this.logService)
    ]);
    this.logService.trace(`Resolved machine identifier: ${machineId}`);
    const { sharedProcessReady, sharedProcessClient } = this.setupSharedProcess(machineId, sqmId, devDeviceId);
    const appInstantiationService = await this.initServices(machineId, sqmId, devDeviceId, sharedProcessReady);
    appInstantiationService.invokeFunction((accessor) => this._register(new ErrorTelemetry(accessor.get(ILogService), accessor.get(ITelemetryService))));
    appInstantiationService.invokeFunction((accessor) => accessor.get(IProxyAuthService));
    this._register(appInstantiationService.createInstance(UserDataProfilesHandler));
    appInstantiationService.invokeFunction((accessor) => this.initChannels(accessor, mainProcessElectronServer, sharedProcessClient));
    this.startFuxaServer();
    this.startVerificationService();
    const initialProtocolUrls = await appInstantiationService.invokeFunction((accessor) => this.setupProtocolUrlHandlers(accessor, mainProcessElectronServer));
    this.setupManagedRemoteResourceUrlHandler(mainProcessElectronServer);
    this.lifecycleMainService.phase = LifecycleMainPhase.Ready;
    await appInstantiationService.invokeFunction((accessor) => this.openFirstWindow(accessor, initialProtocolUrls));
    this.lifecycleMainService.phase = LifecycleMainPhase.AfterWindowOpen;
    this.afterWindowOpen();
    const eventuallyPhaseScheduler = this._register(new RunOnceScheduler(() => {
      this._register(runWhenGlobalIdle(() => {
        this.lifecycleMainService.phase = LifecycleMainPhase.Eventually;
        this.eventuallyAfterWindowOpen();
      }, 2500));
    }, 2500));
    eventuallyPhaseScheduler.schedule();
  }
  async setupProtocolUrlHandlers(accessor, mainProcessElectronServer) {
    const windowsMainService = this.windowsMainService = accessor.get(IWindowsMainService);
    const urlService = accessor.get(IURLService);
    const nativeHostMainService = this.nativeHostMainService = accessor.get(INativeHostMainService);
    const dialogMainService = accessor.get(IDialogMainService);
    const app2 = this;
    urlService.registerHandler({
      async handleURL(uri, options) {
        return app2.handleProtocolUrl(windowsMainService, dialogMainService, urlService, uri, options);
      }
    });
    const activeWindowManager = this._register(new ActiveWindowManager({
      onDidOpenMainWindow: nativeHostMainService.onDidOpenMainWindow,
      onDidFocusMainWindow: nativeHostMainService.onDidFocusMainWindow,
      getActiveWindowId: () => nativeHostMainService.getActiveWindowId(-1)
    }));
    const activeWindowRouter = new StaticRouter((ctx) => activeWindowManager.getActiveClientId().then((id) => ctx === id));
    const urlHandlerRouter = new URLHandlerRouter(activeWindowRouter, this.logService);
    const urlHandlerChannel = mainProcessElectronServer.getChannel("urlHandler", urlHandlerRouter);
    urlService.registerHandler(new URLHandlerChannelClient(urlHandlerChannel));
    const initialProtocolUrls = await this.resolveInitialProtocolUrls(windowsMainService, dialogMainService);
    this._register(new ElectronURLListener(initialProtocolUrls?.urls, urlService, windowsMainService, this.environmentMainService, this.productService, this.logService));
    return initialProtocolUrls;
  }
  setupManagedRemoteResourceUrlHandler(mainProcessElectronServer) {
    const notFound = () => ({ statusCode: 404, data: "Not found" });
    const remoteResourceChannel = new Lazy(() => mainProcessElectronServer.getChannel(
      NODE_REMOTE_RESOURCE_CHANNEL_NAME,
      new NodeRemoteResourceRouter()
    ));
    protocol.registerBufferProtocol(Schemas.vscodeManagedRemoteResource, (request, callback) => {
      const url = URI.parse(request.url);
      if (!url.authority.startsWith("window:")) {
        return callback(notFound());
      }
      remoteResourceChannel.value.call(NODE_REMOTE_RESOURCE_IPC_METHOD_NAME, [url]).then(
        (r) => callback({ ...r, data: Buffer.from(r.body, "base64") }),
        (err) => {
          this.logService.warn("error dispatching remote resource call", err);
          callback({ statusCode: 500, data: String(err) });
        }
      );
    });
  }
  async resolveInitialProtocolUrls(windowsMainService, dialogMainService) {
    const protocolUrlsFromCommandLine = this.environmentMainService.args["open-url"] ? this.environmentMainService.args._urls || [] : [];
    if (protocolUrlsFromCommandLine.length > 0) {
      this.logService.trace("app#resolveInitialProtocolUrls() protocol urls from command line:", protocolUrlsFromCommandLine);
    }
    const protocolUrlsFromEvent = global.getOpenUrls() || [];
    if (protocolUrlsFromEvent.length > 0) {
      this.logService.trace(`app#resolveInitialProtocolUrls() protocol urls from macOS 'open-url' event:`, protocolUrlsFromEvent);
    }
    if (protocolUrlsFromCommandLine.length + protocolUrlsFromEvent.length === 0) {
      return void 0;
    }
    const protocolUrls = [
      ...protocolUrlsFromCommandLine,
      ...protocolUrlsFromEvent
    ].map((url) => {
      try {
        return { uri: URI.parse(url), originalUrl: url };
      } catch {
        this.logService.trace("app#resolveInitialProtocolUrls() protocol url failed to parse:", url);
        return void 0;
      }
    });
    const openables = [];
    const urls = [];
    for (const protocolUrl of protocolUrls) {
      if (!protocolUrl) {
        continue;
      }
      const windowOpenable = this.getWindowOpenableFromProtocolUrl(protocolUrl.uri);
      if (windowOpenable) {
        if (await this.shouldBlockOpenable(windowOpenable, windowsMainService, dialogMainService)) {
          this.logService.trace("app#resolveInitialProtocolUrls() protocol url was blocked:", protocolUrl.uri.toString(true));
          continue;
        } else {
          this.logService.trace("app#resolveInitialProtocolUrls() protocol url will be handled as window to open:", protocolUrl.uri.toString(true), windowOpenable);
          openables.push(windowOpenable);
        }
      } else {
        this.logService.trace("app#resolveInitialProtocolUrls() protocol url will be passed to active window for handling:", protocolUrl.uri.toString(true));
        urls.push(protocolUrl);
      }
    }
    return { urls, openables };
  }
  async shouldBlockOpenable(openable, windowsMainService, dialogMainService) {
    let openableUri;
    let message;
    if (isWorkspaceToOpen(openable)) {
      openableUri = openable.workspaceUri;
      message = localize("confirmOpenMessageWorkspace", "An external application wants to open '{0}' in {1}. Do you want to open this workspace file?", openableUri.scheme === Schemas.file ? getPathLabel(openableUri, { os: OS, tildify: this.environmentMainService }) : openableUri.toString(true), this.productService.nameShort);
    } else if (isFolderToOpen(openable)) {
      openableUri = openable.folderUri;
      message = localize("confirmOpenMessageFolder", "An external application wants to open '{0}' in {1}. Do you want to open this folder?", openableUri.scheme === Schemas.file ? getPathLabel(openableUri, { os: OS, tildify: this.environmentMainService }) : openableUri.toString(true), this.productService.nameShort);
    } else {
      openableUri = openable.fileUri;
      message = localize("confirmOpenMessageFileOrFolder", "An external application wants to open '{0}' in {1}. Do you want to open this file or folder?", openableUri.scheme === Schemas.file ? getPathLabel(openableUri, { os: OS, tildify: this.environmentMainService }) : openableUri.toString(true), this.productService.nameShort);
    }
    if (openableUri.scheme !== Schemas.file && openableUri.scheme !== Schemas.vscodeRemote) {
      return false;
    }
    const askForConfirmation = this.configurationService.getValue(CodeApplication.SECURITY_PROTOCOL_HANDLING_CONFIRMATION_SETTING_KEY[openableUri.scheme]);
    if (askForConfirmation === false) {
      return false;
    }
    const { response, checkboxChecked } = await dialogMainService.showMessageBox({
      type: "warning",
      buttons: [
        localize({ key: "open", comment: ["&& denotes a mnemonic"] }, "&&Yes"),
        localize({ key: "cancel", comment: ["&& denotes a mnemonic"] }, "&&No")
      ],
      message,
      detail: localize("confirmOpenDetail", "If you did not initiate this request, it may represent an attempted attack on your system. Unless you took an explicit action to initiate this request, you should press 'No'"),
      checkboxLabel: openableUri.scheme === Schemas.file ? localize("doNotAskAgainLocal", "Allow opening local paths without asking") : localize("doNotAskAgainRemote", "Allow opening remote paths without asking"),
      cancelId: 1
    });
    if (response !== 0) {
      return true;
    }
    if (checkboxChecked) {
      const request = { channel: "vscode:disablePromptForProtocolHandling", args: openableUri.scheme === Schemas.file ? "local" : "remote" };
      windowsMainService.sendToFocused(request.channel, request.args);
      windowsMainService.sendToOpeningWindow(request.channel, request.args);
    }
    return false;
  }
  getWindowOpenableFromProtocolUrl(uri) {
    if (!uri.path) {
      return void 0;
    }
    if (uri.authority === Schemas.file) {
      const fileUri = URI.file(uri.fsPath);
      if (hasWorkspaceFileExtension(fileUri)) {
        return { workspaceUri: fileUri };
      }
      return { fileUri };
    } else if (uri.authority === Schemas.vscodeRemote) {
      const secondSlash = uri.path.indexOf(
        posix.sep,
        1
        /* skip over the leading slash */
      );
      let authority;
      let path;
      if (secondSlash !== -1) {
        authority = uri.path.substring(1, secondSlash);
        path = uri.path.substring(secondSlash);
      } else {
        authority = uri.path.substring(1);
        path = "/";
      }
      let query = uri.query;
      const params = new URLSearchParams(uri.query);
      if (params.get("windowId") === "_blank") {
        params.delete("windowId");
        query = params.toString();
      }
      const remoteUri = URI.from({ scheme: Schemas.vscodeRemote, authority, path, query, fragment: uri.fragment });
      if (hasWorkspaceFileExtension(path)) {
        return { workspaceUri: remoteUri };
      }
      if (/:[\d]+$/.test(path)) {
        return { fileUri: remoteUri };
      }
      return { folderUri: remoteUri };
    }
    return void 0;
  }
  async handleProtocolUrl(windowsMainService, dialogMainService, urlService, uri, options) {
    this.logService.trace("app#handleProtocolUrl():", uri.toString(true), options);
    if (uri.scheme === this.productService.urlProtocol && uri.path === "workspace") {
      uri = uri.with({
        authority: "file",
        path: URI.parse(uri.query).path,
        query: ""
      });
    }
    let shouldOpenInNewWindow = false;
    const params = new URLSearchParams(uri.query);
    if (params.get("windowId") === "_blank") {
      this.logService.trace(`app#handleProtocolUrl() found 'windowId=_blank' as parameter, setting shouldOpenInNewWindow=true:`, uri.toString(true));
      params.delete("windowId");
      uri = uri.with({ query: params.toString() });
      shouldOpenInNewWindow = true;
    } else if (isMacintosh && windowsMainService.getWindowCount() === 0) {
      this.logService.trace(`app#handleProtocolUrl() running on macOS with no window open, setting shouldOpenInNewWindow=true:`, uri.toString(true));
      shouldOpenInNewWindow = true;
    }
    const continueOn = params.get("continueOn");
    if (continueOn !== null) {
      this.logService.trace(`app#handleProtocolUrl() found 'continueOn' as parameter:`, uri.toString(true));
      params.delete("continueOn");
      uri = uri.with({ query: params.toString() });
      this.environmentMainService.continueOn = continueOn ?? void 0;
    }
    const windowOpenableFromProtocolUrl = this.getWindowOpenableFromProtocolUrl(uri);
    if (windowOpenableFromProtocolUrl) {
      if (await this.shouldBlockOpenable(windowOpenableFromProtocolUrl, windowsMainService, dialogMainService)) {
        this.logService.trace("app#handleProtocolUrl() protocol url was blocked:", uri.toString(true));
        return true;
      } else {
        this.logService.trace("app#handleProtocolUrl() opening protocol url as window:", windowOpenableFromProtocolUrl, uri.toString(true));
        const window = (await windowsMainService.open({
          context: OpenContext.LINK,
          cli: { ...this.environmentMainService.args },
          urisToOpen: [windowOpenableFromProtocolUrl],
          forceNewWindow: shouldOpenInNewWindow,
          gotoLineMode: true
          // remoteAuthority: will be determined based on windowOpenableFromProtocolUrl
        })).at(0);
        window?.focus();
        return true;
      }
    }
    if (shouldOpenInNewWindow) {
      this.logService.trace("app#handleProtocolUrl() opening empty window and passing in protocol url:", uri.toString(true));
      const window = (await windowsMainService.open({
        context: OpenContext.LINK,
        cli: { ...this.environmentMainService.args },
        forceNewWindow: true,
        forceEmpty: true,
        gotoLineMode: true,
        remoteAuthority: getRemoteAuthority(uri)
      })).at(0);
      await window?.ready();
      return urlService.open(uri, options);
    }
    this.logService.trace("app#handleProtocolUrl(): not handled", uri.toString(true), options);
    return false;
  }
  setupSharedProcess(machineId, sqmId, devDeviceId) {
    const sharedProcess = this._register(this.mainInstantiationService.createInstance(SharedProcess, machineId, sqmId, devDeviceId));
    this._register(sharedProcess.onDidCrash(() => this.windowsMainService?.sendToFocused("vscode:reportSharedProcessCrash")));
    const sharedProcessClient = (async () => {
      this.logService.trace("Main->SharedProcess#connect");
      const port = await sharedProcess.connect();
      this.logService.trace("Main->SharedProcess#connect: connection established");
      return new MessagePortClient(port, "main");
    })();
    const sharedProcessReady = (async () => {
      await sharedProcess.whenReady();
      return sharedProcessClient;
    })();
    return { sharedProcessReady, sharedProcessClient };
  }
  async initServices(machineId, sqmId, devDeviceId, sharedProcessReady) {
    const services = new ServiceCollection();
    switch (process.platform) {
      case "win32":
        services.set(IUpdateService, new SyncDescriptor(Win32UpdateService));
        break;
      case "linux":
        if (isLinuxSnap) {
          services.set(IUpdateService, new SyncDescriptor(SnapUpdateService, [process.env["SNAP"], process.env["SNAP_REVISION"]]));
        } else {
          services.set(IUpdateService, new SyncDescriptor(LinuxUpdateService));
        }
        break;
      case "darwin":
        services.set(IUpdateService, new SyncDescriptor(DarwinUpdateService));
        break;
    }
    services.set(IWindowsMainService, new SyncDescriptor(WindowsMainService, [machineId, sqmId, devDeviceId, this.userEnv], false));
    services.set(IAuxiliaryWindowsMainService, new SyncDescriptor(AuxiliaryWindowsMainService, void 0, false));
    const dialogMainService = new DialogMainService(this.logService, this.productService);
    services.set(IDialogMainService, dialogMainService);
    services.set(ILaunchMainService, new SyncDescriptor(
      LaunchMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IDiagnosticsMainService, new SyncDescriptor(
      DiagnosticsMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IDiagnosticsService, ProxyChannel.toService(getDelayedChannel(sharedProcessReady.then((client) => client.getChannel("diagnostics")))));
    services.set(IProcessMainService, new SyncDescriptor(ProcessMainService, [this.userEnv]));
    services.set(IEncryptionMainService, new SyncDescriptor(EncryptionMainService));
    services.set(IKeyboardLayoutMainService, new SyncDescriptor(KeyboardLayoutMainService));
    services.set(INativeHostMainService, new SyncDescriptor(
      NativeHostMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IWebContentExtractorService, new SyncDescriptor(
      NativeWebContentExtractorService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IWebviewManagerService, new SyncDescriptor(WebviewMainService));
    services.set(IMenubarMainService, new SyncDescriptor(MenubarMainService));
    services.set(IExtensionHostStarter, new SyncDescriptor(ExtensionHostStarter));
    services.set(IStorageMainService, new SyncDescriptor(StorageMainService));
    services.set(IApplicationStorageMainService, new SyncDescriptor(ApplicationStorageMainService));
    const ptyHostStarter = new ElectronPtyHostStarter({
      graceTime: LocalReconnectConstants.GraceTime,
      shortGraceTime: LocalReconnectConstants.ShortGraceTime,
      scrollback: this.configurationService.getValue(TerminalSettingId.PersistentSessionScrollback) ?? 100
    }, this.configurationService, this.environmentMainService, this.lifecycleMainService, this.logService);
    const ptyHostService = new PtyHostService(
      ptyHostStarter,
      this.configurationService,
      this.logService,
      this.loggerService
    );
    services.set(ILocalPtyService, ptyHostService);
    if (isWindows) {
      services.set(IExternalTerminalMainService, new SyncDescriptor(WindowsExternalTerminalService));
    } else if (isMacintosh) {
      services.set(IExternalTerminalMainService, new SyncDescriptor(MacExternalTerminalService));
    } else if (isLinux) {
      services.set(IExternalTerminalMainService, new SyncDescriptor(LinuxExternalTerminalService));
    }
    const backupMainService = new BackupMainService(this.environmentMainService, this.configurationService, this.logService, this.stateService);
    services.set(IBackupMainService, backupMainService);
    const workspacesManagementMainService = new WorkspacesManagementMainService(this.environmentMainService, this.logService, this.userDataProfilesMainService, backupMainService, dialogMainService);
    services.set(IWorkspacesManagementMainService, workspacesManagementMainService);
    services.set(IWorkspacesService, new SyncDescriptor(
      WorkspacesMainService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(IWorkspacesHistoryMainService, new SyncDescriptor(WorkspacesHistoryMainService, void 0, false));
    services.set(IURLService, new SyncDescriptor(
      NativeURLService,
      void 0,
      false
      /* proxied to other processes */
    ));
    if (supportsTelemetry(this.productService, this.environmentMainService)) {
      const isInternal = isInternalTelemetry(this.productService, this.configurationService);
      const channel = getDelayedChannel(sharedProcessReady.then((client) => client.getChannel("telemetryAppender")));
      const appender = new TelemetryAppenderClient(channel);
      const commonProperties = resolveCommonProperties(release(), hostname(), process.arch, this.productService.commit, this.productService.version, machineId, sqmId, devDeviceId, isInternal);
      const piiPaths = getPiiPathsFromEnvironment(this.environmentMainService);
      const config = { appenders: [appender], commonProperties, piiPaths, sendErrorTelemetry: true };
      services.set(ITelemetryService, new SyncDescriptor(TelemetryService, [config], false));
    } else {
      services.set(ITelemetryService, NullTelemetryService);
    }
    services.set(IMetricsService, new SyncDescriptor(MetricsMainService, void 0, false));
    services.set(IVoidUpdateService, new SyncDescriptor(VoidMainUpdateService, void 0, false));
    services.set(IVoidSCMService, new SyncDescriptor(VoidSCMService, void 0, false));
    services.set(IExtensionsProfileScannerService, new SyncDescriptor(ExtensionsProfileScannerService, void 0, true));
    services.set(IExtensionsScannerService, new SyncDescriptor(ExtensionsScannerService, void 0, true));
    services.set(IUtilityProcessWorkerMainService, new SyncDescriptor(UtilityProcessWorkerMainService, void 0, true));
    services.set(IProxyAuthService, new SyncDescriptor(ProxyAuthService));
    services.set(INativeMcpDiscoveryHelperService, new SyncDescriptor(NativeMcpDiscoveryHelperService));
    services.set(ICSSDevelopmentService, new SyncDescriptor(CSSDevelopmentService, void 0, true));
    await Promises.settled([
      backupMainService.initialize(),
      workspacesManagementMainService.initialize()
    ]);
    return this.mainInstantiationService.createChild(services);
  }
  initChannels(accessor, mainProcessElectronServer, sharedProcessClient) {
    const disposables = this._register(new DisposableStore());
    const launchChannel = ProxyChannel.fromService(accessor.get(ILaunchMainService), disposables, { disableMarshalling: true });
    this.mainProcessNodeIpcServer.registerChannel("launch", launchChannel);
    const diagnosticsChannel = ProxyChannel.fromService(accessor.get(IDiagnosticsMainService), disposables, { disableMarshalling: true });
    this.mainProcessNodeIpcServer.registerChannel("diagnostics", diagnosticsChannel);
    const policyChannel = disposables.add(new PolicyChannel(accessor.get(IPolicyService)));
    mainProcessElectronServer.registerChannel("policy", policyChannel);
    sharedProcessClient.then((client) => client.registerChannel("policy", policyChannel));
    const diskFileSystemProvider = this.fileService.getProvider(Schemas.file);
    assertType(diskFileSystemProvider instanceof DiskFileSystemProvider);
    const fileSystemProviderChannel = disposables.add(new DiskFileSystemProviderChannel(diskFileSystemProvider, this.logService, this.environmentMainService));
    mainProcessElectronServer.registerChannel(LOCAL_FILE_SYSTEM_CHANNEL_NAME, fileSystemProviderChannel);
    sharedProcessClient.then((client) => client.registerChannel(LOCAL_FILE_SYSTEM_CHANNEL_NAME, fileSystemProviderChannel));
    const userDataProfilesService = ProxyChannel.fromService(accessor.get(IUserDataProfilesMainService), disposables);
    mainProcessElectronServer.registerChannel("userDataProfiles", userDataProfilesService);
    sharedProcessClient.then((client) => client.registerChannel("userDataProfiles", userDataProfilesService));
    const updateChannel = new UpdateChannel(accessor.get(IUpdateService));
    mainProcessElectronServer.registerChannel("update", updateChannel);
    const processChannel = ProxyChannel.fromService(accessor.get(IProcessMainService), disposables);
    mainProcessElectronServer.registerChannel("process", processChannel);
    const encryptionChannel = ProxyChannel.fromService(accessor.get(IEncryptionMainService), disposables);
    mainProcessElectronServer.registerChannel("encryption", encryptionChannel);
    const signChannel = ProxyChannel.fromService(accessor.get(ISignService), disposables);
    mainProcessElectronServer.registerChannel("sign", signChannel);
    const keyboardLayoutChannel = ProxyChannel.fromService(accessor.get(IKeyboardLayoutMainService), disposables);
    mainProcessElectronServer.registerChannel("keyboardLayout", keyboardLayoutChannel);
    this.nativeHostMainService = accessor.get(INativeHostMainService);
    const nativeHostChannel = ProxyChannel.fromService(this.nativeHostMainService, disposables);
    mainProcessElectronServer.registerChannel("nativeHost", nativeHostChannel);
    sharedProcessClient.then((client) => client.registerChannel("nativeHost", nativeHostChannel));
    const webContentExtractorChannel = ProxyChannel.fromService(accessor.get(IWebContentExtractorService), disposables);
    mainProcessElectronServer.registerChannel("webContentExtractor", webContentExtractorChannel);
    const workspacesChannel = ProxyChannel.fromService(accessor.get(IWorkspacesService), disposables);
    mainProcessElectronServer.registerChannel("workspaces", workspacesChannel);
    const menubarChannel = ProxyChannel.fromService(accessor.get(IMenubarMainService), disposables);
    mainProcessElectronServer.registerChannel("menubar", menubarChannel);
    const urlChannel = ProxyChannel.fromService(accessor.get(IURLService), disposables);
    mainProcessElectronServer.registerChannel("url", urlChannel);
    const webviewChannel = ProxyChannel.fromService(accessor.get(IWebviewManagerService), disposables);
    mainProcessElectronServer.registerChannel("webview", webviewChannel);
    const storageChannel = disposables.add(new StorageDatabaseChannel(this.logService, accessor.get(IStorageMainService)));
    mainProcessElectronServer.registerChannel("storage", storageChannel);
    sharedProcessClient.then((client) => client.registerChannel("storage", storageChannel));
    const profileStorageListener = disposables.add(new ProfileStorageChangesListenerChannel(accessor.get(IStorageMainService), accessor.get(IUserDataProfilesMainService), this.logService));
    sharedProcessClient.then((client) => client.registerChannel("profileStorageListener", profileStorageListener));
    const ptyHostChannel = ProxyChannel.fromService(accessor.get(ILocalPtyService), disposables);
    mainProcessElectronServer.registerChannel(TerminalIpcChannels.LocalPty, ptyHostChannel);
    const externalTerminalChannel = ProxyChannel.fromService(accessor.get(IExternalTerminalMainService), disposables);
    mainProcessElectronServer.registerChannel("externalTerminal", externalTerminalChannel);
    const mcpDiscoveryChannel = ProxyChannel.fromService(accessor.get(INativeMcpDiscoveryHelperService), disposables);
    mainProcessElectronServer.registerChannel(NativeMcpDiscoveryHelperChannelName, mcpDiscoveryChannel);
    const loggerChannel = new LoggerChannel(accessor.get(ILoggerMainService));
    mainProcessElectronServer.registerChannel("logger", loggerChannel);
    sharedProcessClient.then((client) => client.registerChannel("logger", loggerChannel));
    const metricsChannel = ProxyChannel.fromService(accessor.get(IMetricsService), disposables);
    mainProcessElectronServer.registerChannel("void-channel-metrics", metricsChannel);
    const voidUpdatesChannel = ProxyChannel.fromService(accessor.get(IVoidUpdateService), disposables);
    mainProcessElectronServer.registerChannel("void-channel-update", voidUpdatesChannel);
    const sendLLMMessageChannel = new LLMMessageChannel(accessor.get(IMetricsService));
    mainProcessElectronServer.registerChannel("void-channel-llmMessage", sendLLMMessageChannel);
    const voidSCMChannel = ProxyChannel.fromService(accessor.get(IVoidSCMService), disposables);
    mainProcessElectronServer.registerChannel("void-channel-scm", voidSCMChannel);
    const mcpChannel = new MCPChannel();
    mainProcessElectronServer.registerChannel("void-channel-mcp", mcpChannel);
    const electronExtensionHostDebugBroadcastChannel = new ElectronExtensionHostDebugBroadcastChannel(accessor.get(IWindowsMainService));
    mainProcessElectronServer.registerChannel("extensionhostdebugservice", electronExtensionHostDebugBroadcastChannel);
    const extensionHostStarterChannel = ProxyChannel.fromService(accessor.get(IExtensionHostStarter), disposables);
    mainProcessElectronServer.registerChannel(ipcExtensionHostStarterChannelName, extensionHostStarterChannel);
    const utilityProcessWorkerChannel = ProxyChannel.fromService(accessor.get(IUtilityProcessWorkerMainService), disposables);
    mainProcessElectronServer.registerChannel(ipcUtilityProcessWorkerChannelName, utilityProcessWorkerChannel);
  }
  async openFirstWindow(accessor, initialProtocolUrls) {
    const windowsMainService = this.windowsMainService = accessor.get(IWindowsMainService);
    this.auxiliaryWindowsMainService = accessor.get(IAuxiliaryWindowsMainService);
    const context = isLaunchedFromCli(process.env) ? OpenContext.CLI : OpenContext.DESKTOP;
    const args = this.environmentMainService.args;
    if (initialProtocolUrls) {
      if (initialProtocolUrls.openables.length > 0) {
        return windowsMainService.open({
          context,
          cli: args,
          urisToOpen: initialProtocolUrls.openables,
          gotoLineMode: true,
          initialStartup: true
          // remoteAuthority: will be determined based on openables
        });
      }
      if (initialProtocolUrls.urls.length > 0) {
        for (const protocolUrl of initialProtocolUrls.urls) {
          const params = new URLSearchParams(protocolUrl.uri.query);
          if (params.get("windowId") === "_blank") {
            params.delete("windowId");
            protocolUrl.originalUrl = protocolUrl.uri.toString(true);
            protocolUrl.uri = protocolUrl.uri.with({ query: params.toString() });
            return windowsMainService.open({
              context,
              cli: args,
              forceNewWindow: true,
              forceEmpty: true,
              gotoLineMode: true,
              initialStartup: true
              // remoteAuthority: will be determined based on openables
            });
          }
        }
      }
    }
    const macOpenFiles = global.macOpenFiles;
    const hasCliArgs = args._.length;
    const hasFolderURIs = !!args["folder-uri"];
    const hasFileURIs = !!args["file-uri"];
    const noRecentEntry = args["skip-add-to-recently-opened"] === true;
    const waitMarkerFileURI = args.wait && args.waitMarkerFilePath ? URI.file(args.waitMarkerFilePath) : void 0;
    const remoteAuthority = args.remote || void 0;
    const forceProfile = args.profile;
    const forceTempProfile = args["profile-temp"];
    if (!hasCliArgs && !hasFolderURIs && !hasFileURIs) {
      if (args["new-window"] || forceProfile || forceTempProfile) {
        return windowsMainService.open({
          context,
          cli: args,
          forceNewWindow: true,
          forceEmpty: true,
          noRecentEntry,
          waitMarkerFileURI,
          initialStartup: true,
          remoteAuthority,
          forceProfile,
          forceTempProfile
        });
      }
      if (macOpenFiles.length) {
        return windowsMainService.open({
          context: OpenContext.DOCK,
          cli: args,
          urisToOpen: macOpenFiles.map((path) => {
            path = normalizeNFC(path);
            return hasWorkspaceFileExtension(path) ? { workspaceUri: URI.file(path) } : { fileUri: URI.file(path) };
          }),
          noRecentEntry,
          waitMarkerFileURI,
          initialStartup: true
          // remoteAuthority: will be determined based on macOpenFiles
        });
      }
    }
    return windowsMainService.open({
      context,
      cli: args,
      forceNewWindow: args["new-window"],
      diffMode: args.diff,
      mergeMode: args.merge,
      noRecentEntry,
      waitMarkerFileURI,
      gotoLineMode: args.goto,
      initialStartup: true,
      remoteAuthority,
      forceProfile,
      forceTempProfile
    });
  }
  afterWindowOpen() {
    this.installMutex();
    protocol.registerHttpProtocol(Schemas.vscodeRemoteResource, (request, callback) => {
      callback({
        url: request.url.replace(/^vscode-remote-resource:/, "http:"),
        method: request.method
      });
    });
    this.resolveShellEnvironment(this.environmentMainService.args, process.env, true);
    this.updateCrashReporterEnablement();
    if (isMacintosh && app.runningUnderARM64Translation) {
      this.windowsMainService?.sendToFocused("vscode:showTranslatedBuildWarning");
    }
  }
  async installMutex() {
    const win32MutexName = this.productService.win32MutexName;
    if (isWindows && win32MutexName) {
      try {
        const WindowsMutex = await import("@vscode/windows-mutex");
        const mutex = new WindowsMutex.Mutex(win32MutexName);
        Event.once(this.lifecycleMainService.onWillShutdown)(() => mutex.release());
      } catch (error) {
        this.logService.error(error);
      }
    }
  }
  async resolveShellEnvironment(args, env, notifyOnError) {
    try {
      return await getResolvedShellEnv(this.configurationService, this.logService, args, env);
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      if (notifyOnError) {
        this.windowsMainService?.sendToFocused("vscode:showResolveShellEnvError", errorMessage);
      } else {
        this.logService.error(errorMessage);
      }
    }
    return {};
  }
  async updateCrashReporterEnablement() {
    try {
      const argvContent = await this.fileService.readFile(this.environmentMainService.argvResource);
      const argvString = argvContent.value.toString();
      const argvJSON = parse(argvString);
      const telemetryLevel = getTelemetryLevel(this.configurationService);
      const enableCrashReporter = telemetryLevel >= TelemetryLevel.CRASH;
      if (argvJSON["enable-crash-reporter"] === void 0) {
        const additionalArgvContent = [
          "",
          "	// Allows to disable crash reporting.",
          "	// Should restart the app if the value is changed.",
          `	"enable-crash-reporter": ${enableCrashReporter},`,
          "",
          "	// Unique id used for correlating crash reports sent from this instance.",
          "	// Do not edit this value.",
          `	"crash-reporter-id": "${generateUuid()}"`,
          "}"
        ];
        const newArgvString = argvString.substring(0, argvString.length - 2).concat(",\n", additionalArgvContent.join("\n"));
        await this.fileService.writeFile(this.environmentMainService.argvResource, VSBuffer.fromString(newArgvString));
      } else {
        const newArgvString = argvString.replace(/"enable-crash-reporter": .*,/, `"enable-crash-reporter": ${enableCrashReporter},`);
        if (newArgvString !== argvString) {
          await this.fileService.writeFile(this.environmentMainService.argvResource, VSBuffer.fromString(newArgvString));
        }
      }
    } catch (error) {
      this.logService.error(error);
      this.windowsMainService?.sendToFocused("vscode:showArgvParseWarning");
    }
  }
  eventuallyAfterWindowOpen() {
    validatedevDeviceId(this.stateService, this.logService);
  }
};
CodeApplication.SECURITY_PROTOCOL_HANDLING_CONFIRMATION_SETTING_KEY = {
  [Schemas.file]: "security.promptForLocalFileProtocolHandling",
  [Schemas.vscodeRemote]: "security.promptForRemoteFileProtocolHandling"
};
CodeApplication = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILogService),
  __decorateParam(4, ILoggerService),
  __decorateParam(5, IEnvironmentMainService),
  __decorateParam(6, ILifecycleMainService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IStateService),
  __decorateParam(9, IFileService),
  __decorateParam(10, IProductService),
  __decorateParam(11, IUserDataProfilesMainService)
], CodeApplication);
export {
  CodeApplication
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLW1haW4vYXBwLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYXBwLCBwcm90b2NvbCwgc2Vzc2lvbiwgU2Vzc2lvbiwgc3lzdGVtUHJlZmVyZW5jZXMsIFdlYkZyYW1lTWFpbiB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCB7IGFkZFVOQ0hvc3RUb0FsbG93bGlzdCwgZGlzYWJsZVVOQ0FjY2Vzc1Jlc3RyaWN0aW9ucyB9IGZyb20gJy4uLy4uL2Jhc2Uvbm9kZS91bmMuanMnO1xuaW1wb3J0IHsgdmFsaWRhdGVkSXBjTWFpbiB9IGZyb20gJy4uLy4uL2Jhc2UvcGFydHMvaXBjL2VsZWN0cm9uLW1haW4vaXBjTWFpbi5qcyc7XG5pbXBvcnQgeyBob3N0bmFtZSwgcmVsZWFzZSB9IGZyb20gJ29zJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9qc29uYy5qcyc7XG5pbXBvcnQgeyBnZXRQYXRoTGFiZWwgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMsIFZTQ09ERV9BVVRIT1JJVFkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGpvaW4sIHBvc2l4IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBJUHJvY2Vzc0Vudmlyb25tZW50LCBpc0xpbnV4LCBpc0xpbnV4U25hcCwgaXNNYWNpbnRvc2gsIGlzV2luZG93cywgT1MgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJDb250ZXh0TWVudUxpc3RlbmVyIH0gZnJvbSAnLi4vLi4vYmFzZS9wYXJ0cy9jb250ZXh0bWVudS9lbGVjdHJvbi1tYWluL2NvbnRleHRtZW51LmpzJztcbmltcG9ydCB7IGdldERlbGF5ZWRDaGFubmVsLCBQcm94eUNoYW5uZWwsIFN0YXRpY1JvdXRlciB9IGZyb20gJy4uLy4uL2Jhc2UvcGFydHMvaXBjL2NvbW1vbi9pcGMuanMnO1xuaW1wb3J0IHsgU2VydmVyIGFzIEVsZWN0cm9uSVBDU2VydmVyIH0gZnJvbSAnLi4vLi4vYmFzZS9wYXJ0cy9pcGMvZWxlY3Ryb24tbWFpbi9pcGMuZWxlY3Ryb24uanMnO1xuaW1wb3J0IHsgQ2xpZW50IGFzIE1lc3NhZ2VQb3J0Q2xpZW50IH0gZnJvbSAnLi4vLi4vYmFzZS9wYXJ0cy9pcGMvZWxlY3Ryb24tbWFpbi9pcGMubXAuanMnO1xuaW1wb3J0IHsgU2VydmVyIGFzIE5vZGVJUENTZXJ2ZXIgfSBmcm9tICcuLi8uLi9iYXNlL3BhcnRzL2lwYy9ub2RlL2lwYy5uZXQuanMnO1xuaW1wb3J0IHsgSVByb3h5QXV0aFNlcnZpY2UsIFByb3h5QXV0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9uYXRpdmUvZWxlY3Ryb24tbWFpbi9hdXRoLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElCYWNrdXBNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2JhY2t1cC9lbGVjdHJvbi1tYWluL2JhY2t1cC5qcyc7XG5pbXBvcnQgeyBCYWNrdXBNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2JhY2t1cC9lbGVjdHJvbi1tYWluL2JhY2t1cE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRWxlY3Ryb25FeHRlbnNpb25Ib3N0RGVidWdCcm9hZGNhc3RDaGFubmVsIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZGVidWcvZWxlY3Ryb24tbWFpbi9leHRlbnNpb25Ib3N0RGVidWdJcGMuanMnO1xuaW1wb3J0IHsgSURpYWdub3N0aWNzU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2RpYWdub3N0aWNzL2NvbW1vbi9kaWFnbm9zdGljcy5qcyc7XG5pbXBvcnQgeyBEaWFnbm9zdGljc01haW5TZXJ2aWNlLCBJRGlhZ25vc3RpY3NNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2RpYWdub3N0aWNzL2VsZWN0cm9uLW1haW4vZGlhZ25vc3RpY3NNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEaWFsb2dNYWluU2VydmljZSwgSURpYWxvZ01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9lbGVjdHJvbi1tYWluL2RpYWxvZ01haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFbmNyeXB0aW9uTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lbmNyeXB0aW9uL2NvbW1vbi9lbmNyeXB0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFbmNyeXB0aW9uTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lbmNyeXB0aW9uL2VsZWN0cm9uLW1haW4vZW5jcnlwdGlvbk1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5hdGl2ZVBhcnNlZEFyZ3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vYXJndi5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2VsZWN0cm9uLW1haW4vZW52aXJvbm1lbnRNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc0xhdW5jaGVkRnJvbUNsaSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L25vZGUvYXJndkhlbHBlci5qcyc7XG5pbXBvcnQgeyBnZXRSZXNvbHZlZFNoZWxsRW52IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vc2hlbGwvbm9kZS9zaGVsbEVudi5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uSG9zdFN0YXJ0ZXIsIGlwY0V4dGVuc2lvbkhvc3RTdGFydGVyQ2hhbm5lbE5hbWUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25Ib3N0U3RhcnRlci5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25Ib3N0U3RhcnRlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvZWxlY3Ryb24tbWFpbi9leHRlbnNpb25Ib3N0U3RhcnRlci5qcyc7XG5pbXBvcnQgeyBJRXh0ZXJuYWxUZXJtaW5hbE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZXh0ZXJuYWxUZXJtaW5hbC9lbGVjdHJvbi1tYWluL2V4dGVybmFsVGVybWluYWwuanMnO1xuaW1wb3J0IHsgTGludXhFeHRlcm5hbFRlcm1pbmFsU2VydmljZSwgTWFjRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UsIFdpbmRvd3NFeHRlcm5hbFRlcm1pbmFsU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2V4dGVybmFsVGVybWluYWwvbm9kZS9leHRlcm5hbFRlcm1pbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBMT0NBTF9GSUxFX1NZU1RFTV9DSEFOTkVMX05BTUUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZGlza0ZpbGVTeXN0ZW1Qcm92aWRlckNsaWVudC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgRGlza0ZpbGVTeXN0ZW1Qcm92aWRlckNoYW5uZWwgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9maWxlcy9lbGVjdHJvbi1tYWluL2Rpc2tGaWxlU3lzdGVtUHJvdmlkZXJTZXJ2ZXIuanMnO1xuaW1wb3J0IHsgRGlza0ZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2ZpbGVzL25vZGUvZGlza0ZpbGVTeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJUHJvY2Vzc01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcHJvY2Vzcy9jb21tb24vcHJvY2Vzcy5qcyc7XG5pbXBvcnQgeyBQcm9jZXNzTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9wcm9jZXNzL2VsZWN0cm9uLW1haW4vcHJvY2Vzc01haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElLZXlib2FyZExheW91dE1haW5TZXJ2aWNlLCBLZXlib2FyZExheW91dE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0va2V5Ym9hcmRMYXlvdXQvZWxlY3Ryb24tbWFpbi9rZXlib2FyZExheW91dE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMYXVuY2hNYWluU2VydmljZSwgTGF1bmNoTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sYXVuY2gvZWxlY3Ryb24tbWFpbi9sYXVuY2hNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlTWFpblNlcnZpY2UsIExpZmVjeWNsZU1haW5QaGFzZSwgU2h1dGRvd25SZWFzb24gfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9saWZlY3ljbGUvZWxlY3Ryb24tbWFpbi9saWZlY3ljbGVNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nZ2VyU2VydmljZSwgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTWVudWJhck1haW5TZXJ2aWNlLCBNZW51YmFyTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9tZW51YmFyL2VsZWN0cm9uLW1haW4vbWVudWJhck1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOYXRpdmVIb3N0TWFpblNlcnZpY2UsIE5hdGl2ZUhvc3RNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL25hdGl2ZS9lbGVjdHJvbi1tYWluL25hdGl2ZUhvc3RNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRSZW1vdGVBdXRob3JpdHkgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUhvc3RzLmpzJztcbmltcG9ydCB7IFNoYXJlZFByb2Nlc3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9zaGFyZWRQcm9jZXNzL2VsZWN0cm9uLW1haW4vc2hhcmVkUHJvY2Vzcy5qcyc7XG5pbXBvcnQgeyBJU2lnblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9zaWduL2NvbW1vbi9zaWduLmpzJztcbmltcG9ydCB7IElTdGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9zdGF0ZS9ub2RlL3N0YXRlLmpzJztcbmltcG9ydCB7IFN0b3JhZ2VEYXRhYmFzZUNoYW5uZWwgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2VsZWN0cm9uLW1haW4vc3RvcmFnZUlwYy5qcyc7XG5pbXBvcnQgeyBBcHBsaWNhdGlvblN0b3JhZ2VNYWluU2VydmljZSwgSUFwcGxpY2F0aW9uU3RvcmFnZU1haW5TZXJ2aWNlLCBJU3RvcmFnZU1haW5TZXJ2aWNlLCBTdG9yYWdlTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2VsZWN0cm9uLW1haW4vc3RvcmFnZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IHJlc29sdmVDb21tb25Qcm9wZXJ0aWVzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi9jb21tb25Qcm9wZXJ0aWVzLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlLCBUZWxlbWV0cnlMZXZlbCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IFRlbGVtZXRyeUFwcGVuZGVyQ2xpZW50IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlJcGMuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2VDb25maWcsIFRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0UGlpUGF0aHNGcm9tRW52aXJvbm1lbnQsIGdldFRlbGVtZXRyeUxldmVsLCBpc0ludGVybmFsVGVsZW1ldHJ5LCBOdWxsVGVsZW1ldHJ5U2VydmljZSwgc3VwcG9ydHNUZWxlbWV0cnkgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IElVcGRhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdXBkYXRlL2NvbW1vbi91cGRhdGUuanMnO1xuaW1wb3J0IHsgVXBkYXRlQ2hhbm5lbCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3VwZGF0ZS9jb21tb24vdXBkYXRlSXBjLmpzJztcbmltcG9ydCB7IERhcndpblVwZGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS91cGRhdGUvZWxlY3Ryb24tbWFpbi91cGRhdGVTZXJ2aWNlLmRhcndpbi5qcyc7XG5pbXBvcnQgeyBMaW51eFVwZGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS91cGRhdGUvZWxlY3Ryb24tbWFpbi91cGRhdGVTZXJ2aWNlLmxpbnV4LmpzJztcbmltcG9ydCB7IFNuYXBVcGRhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdXBkYXRlL2VsZWN0cm9uLW1haW4vdXBkYXRlU2VydmljZS5zbmFwLmpzJztcbmltcG9ydCB7IFdpbjMyVXBkYXRlU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3VwZGF0ZS9lbGVjdHJvbi1tYWluL3VwZGF0ZVNlcnZpY2Uud2luMzIuanMnO1xuaW1wb3J0IHsgSU9wZW5VUkxPcHRpb25zLCBJVVJMU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3VybC9jb21tb24vdXJsLmpzJztcbmltcG9ydCB7IFVSTEhhbmRsZXJDaGFubmVsQ2xpZW50LCBVUkxIYW5kbGVyUm91dGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdXJsL2NvbW1vbi91cmxJcGMuanMnO1xuaW1wb3J0IHsgTmF0aXZlVVJMU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3VybC9jb21tb24vdXJsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFbGVjdHJvblVSTExpc3RlbmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdXJsL2VsZWN0cm9uLW1haW4vZWxlY3Ryb25VcmxMaXN0ZW5lci5qcyc7XG5pbXBvcnQgeyBJV2Vidmlld01hbmFnZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vd2Vidmlldy9jb21tb24vd2Vidmlld01hbmFnZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFdlYnZpZXdNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dlYnZpZXcvZWxlY3Ryb24tbWFpbi93ZWJ2aWV3TWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNGb2xkZXJUb09wZW4sIGlzV29ya3NwYWNlVG9PcGVuLCBJV2luZG93T3BlbmFibGUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS93aW5kb3cvY29tbW9uL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBnZXRBbGxXaW5kb3dzRXhjbHVkaW5nT2Zmc2NyZWVuLCBJV2luZG93c01haW5TZXJ2aWNlLCBPcGVuQ29udGV4dCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dpbmRvd3MvZWxlY3Ryb24tbWFpbi93aW5kb3dzLmpzJztcbmltcG9ydCB7IElDb2RlV2luZG93IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vd2luZG93L2VsZWN0cm9uLW1haW4vd2luZG93LmpzJztcbmltcG9ydCB7IFdpbmRvd3NNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dpbmRvd3MvZWxlY3Ryb24tbWFpbi93aW5kb3dzTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWN0aXZlV2luZG93TWFuYWdlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dpbmRvd3Mvbm9kZS93aW5kb3dUcmFja2VyLmpzJztcbmltcG9ydCB7IGhhc1dvcmtzcGFjZUZpbGVFeHRlbnNpb24gfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlLCBXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlcy9lbGVjdHJvbi1tYWluL3dvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlc01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlcy9lbGVjdHJvbi1tYWluL3dvcmtzcGFjZXNNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZSwgV29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZXMvZWxlY3Ryb24tbWFpbi93b3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQb2xpY3lTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcG9saWN5L2NvbW1vbi9wb2xpY3kuanMnO1xuaW1wb3J0IHsgUG9saWN5Q2hhbm5lbCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3BvbGljeS9jb21tb24vcG9saWN5SXBjLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvZWxlY3Ryb24tbWFpbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25zUHJvZmlsZVNjYW5uZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25zU2Nhbm5lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9ub2RlL2V4dGVuc2lvbnNTY2FubmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVByb2ZpbGVzSGFuZGxlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9lbGVjdHJvbi1tYWluL3VzZXJEYXRhUHJvZmlsZXNIYW5kbGVyLmpzJztcbmltcG9ydCB7IFByb2ZpbGVTdG9yYWdlQ2hhbmdlc0xpc3RlbmVyQ2hhbm5lbCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9lbGVjdHJvbi1tYWluL3VzZXJEYXRhUHJvZmlsZVN0b3JhZ2VJcGMuanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMsIFJ1bk9uY2VTY2hlZHVsZXIsIHJ1bldoZW5HbG9iYWxJZGxlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZU1hY2hpbmVJZCwgcmVzb2x2ZVNxbUlkLCByZXNvbHZlZGV2RGV2aWNlSWQsIHZhbGlkYXRlZGV2RGV2aWNlSWQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvZWxlY3Ryb24tbWFpbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUHJvZmlsZVNjYW5uZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9ub2RlL2V4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTG9nZ2VyQ2hhbm5lbCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xvZy9lbGVjdHJvbi1tYWluL2xvZ0lwYy5qcyc7XG5pbXBvcnQgeyBJTG9nZ2VyTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sb2cvZWxlY3Ryb24tbWFpbi9sb2dnZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElJbml0aWFsUHJvdG9jb2xVcmxzLCBJUHJvdG9jb2xVcmwgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS91cmwvZWxlY3Ryb24tbWFpbi91cmwuanMnO1xuaW1wb3J0IHsgSVV0aWxpdHlQcm9jZXNzV29ya2VyTWFpblNlcnZpY2UsIFV0aWxpdHlQcm9jZXNzV29ya2VyTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS91dGlsaXR5UHJvY2Vzcy9lbGVjdHJvbi1tYWluL3V0aWxpdHlQcm9jZXNzV29ya2VyTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXBjVXRpbGl0eVByb2Nlc3NXb3JrZXJDaGFubmVsTmFtZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3V0aWxpdHlQcm9jZXNzL2NvbW1vbi91dGlsaXR5UHJvY2Vzc1dvcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvY2FsUHR5U2VydmljZSwgTG9jYWxSZWNvbm5lY3RDb25zdGFudHMsIFRlcm1pbmFsSXBjQ2hhbm5lbHMsIFRlcm1pbmFsU2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IEVsZWN0cm9uUHR5SG9zdFN0YXJ0ZXIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9lbGVjdHJvbi1tYWluL2VsZWN0cm9uUHR5SG9zdFN0YXJ0ZXIuanMnO1xuaW1wb3J0IHsgUHR5SG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3B0eUhvc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5PREVfUkVNT1RFX1JFU09VUkNFX0NIQU5ORUxfTkFNRSwgTk9ERV9SRU1PVEVfUkVTT1VSQ0VfSVBDX01FVEhPRF9OQU1FLCBOb2RlUmVtb3RlUmVzb3VyY2VSZXNwb25zZSwgTm9kZVJlbW90ZVJlc291cmNlUm91dGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9lbGVjdHJvblJlbW90ZVJlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGF6eS5qcyc7XG5pbXBvcnQgeyBJQXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vYXV4aWxpYXJ5V2luZG93L2VsZWN0cm9uLW1haW4vYXV4aWxpYXJ5V2luZG93cy5qcyc7XG5pbXBvcnQgeyBBdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9hdXhpbGlhcnlXaW5kb3cvZWxlY3Ryb24tbWFpbi9hdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplTkZDIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbm9ybWFsaXphdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ1NTRGV2ZWxvcG1lbnRTZXJ2aWNlLCBDU1NEZXZlbG9wbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jc3NEZXYvbm9kZS9jc3NEZXZTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJTZXJ2aWNlLCBOYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJDaGFubmVsTmFtZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL21jcC9jb21tb24vbmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyLmpzJztcbmltcG9ydCB7IE5hdGl2ZU1jcERpc2NvdmVyeUhlbHBlclNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9tY3Avbm9kZS9uYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXZWJDb250ZW50RXh0cmFjdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dlYkNvbnRlbnRFeHRyYWN0b3IvY29tbW9uL3dlYkNvbnRlbnRFeHRyYWN0b3IuanMnO1xuaW1wb3J0IHsgTmF0aXZlV2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS93ZWJDb250ZW50RXh0cmFjdG9yL2VsZWN0cm9uLW1haW4vd2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2UuanMnO1xuaW1wb3J0IEVycm9yVGVsZW1ldHJ5IGZyb20gJy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9lbGVjdHJvbi1tYWluL2Vycm9yVGVsZW1ldHJ5LmpzJztcblxuLy8gaW4gdGhlb3J5IHRoaXMgaXMgbm90IGFsbG93ZWRcbi8vIGlnbm9yZSB0aGUgZXNsaW50IGVycm9ycyBiZWxvd1xuaW1wb3J0IHsgSU1ldHJpY3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd29ya2JlbmNoL2NvbnRyaWIvdm9pZC9jb21tb24vbWV0cmljc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZvaWRVcGRhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd29ya2JlbmNoL2NvbnRyaWIvdm9pZC9jb21tb24vdm9pZFVwZGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTWV0cmljc01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd29ya2JlbmNoL2NvbnRyaWIvdm9pZC9lbGVjdHJvbi1tYWluL21ldHJpY3NNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBWb2lkTWFpblVwZGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi93b3JrYmVuY2gvY29udHJpYi92b2lkL2VsZWN0cm9uLW1haW4vdm9pZFVwZGF0ZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IExMTU1lc3NhZ2VDaGFubmVsIH0gZnJvbSAnLi4vLi4vd29ya2JlbmNoL2NvbnRyaWIvdm9pZC9lbGVjdHJvbi1tYWluL3NlbmRMTE1NZXNzYWdlQ2hhbm5lbC5qcyc7XG5pbXBvcnQgeyBWb2lkU0NNU2VydmljZSB9IGZyb20gJy4uLy4uL3dvcmtiZW5jaC9jb250cmliL3ZvaWQvZWxlY3Ryb24tbWFpbi92b2lkU0NNTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZvaWRTQ01TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd29ya2JlbmNoL2NvbnRyaWIvdm9pZC9jb21tb24vdm9pZFNDTVR5cGVzLmpzJztcbmltcG9ydCB7IE1DUENoYW5uZWwgfSBmcm9tICcuLi8uLi93b3JrYmVuY2gvY29udHJpYi92b2lkL2VsZWN0cm9uLW1haW4vbWNwQ2hhbm5lbC5qcyc7XG4vKipcbiAqIFRoZSBtYWluIFZTIENvZGUgYXBwbGljYXRpb24uIFRoZXJlIHdpbGwgb25seSBldmVyIGJlIG9uZSBpbnN0YW5jZSxcbiAqIGV2ZW4gaWYgdGhlIHVzZXIgc3RhcnRzIG1hbnkgaW5zdGFuY2VzIChlLmcuIGZyb20gdGhlIGNvbW1hbmQgbGluZSkuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb2RlQXBwbGljYXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBTRUNVUklUWV9QUk9UT0NPTF9IQU5ETElOR19DT05GSVJNQVRJT05fU0VUVElOR19LRVkgPSB7XG5cdFx0W1NjaGVtYXMuZmlsZV06ICdzZWN1cml0eS5wcm9tcHRGb3JMb2NhbEZpbGVQcm90b2NvbEhhbmRsaW5nJyBhcyBjb25zdCxcblx0XHRbU2NoZW1hcy52c2NvZGVSZW1vdGVdOiAnc2VjdXJpdHkucHJvbXB0Rm9yUmVtb3RlRmlsZVByb3RvY29sSGFuZGxpbmcnIGFzIGNvbnN0XG5cdH07XG5cblx0cHJpdmF0ZSB3aW5kb3dzTWFpblNlcnZpY2U6IElXaW5kb3dzTWFpblNlcnZpY2UgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlOiBJQXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIG5hdGl2ZUhvc3RNYWluU2VydmljZTogSU5hdGl2ZUhvc3RNYWluU2VydmljZSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1haW5Qcm9jZXNzTm9kZUlwY1NlcnZlcjogTm9kZUlQQ1NlcnZlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHVzZXJFbnY6IElQcm9jZXNzRW52aXJvbm1lbnQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1haW5JbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJTG9nZ2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50TWFpblNlcnZpY2U6IElFbnZpcm9ubWVudE1haW5TZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsaWZlY3ljbGVNYWluU2VydmljZTogSUxpZmVjeWNsZU1haW5TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RhdGVTZXJ2aWNlOiBJU3RhdGVTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNvbmZpZ3VyZVNlc3Npb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIGNvbmZpZ3VyZVNlc3Npb24oKTogdm9pZCB7XG5cblx0XHQvLyNyZWdpb24gU2VjdXJpdHkgcmVsYXRlZCBtZWFzdXJlcyAoaHR0cHM6Ly9lbGVjdHJvbmpzLm9yZy9kb2NzL3R1dG9yaWFsL3NlY3VyaXR5KVxuXHRcdC8vXG5cdFx0Ly8gISEhIERPIE5PVCBDSEFOR0Ugd2l0aG91dCBjb25zdWx0aW5nIHRoZSBkb2N1bWVudGF0aW9uICEhIVxuXHRcdC8vXG5cblx0XHRjb25zdCBpc1VybEZyb21XaW5kb3cgPSAocmVxdWVzdGluZ1VybD86IHN0cmluZyB8IHVuZGVmaW5lZCkgPT4gcmVxdWVzdGluZ1VybD8uc3RhcnRzV2l0aChgJHtTY2hlbWFzLnZzY29kZUZpbGVSZXNvdXJjZX06Ly8ke1ZTQ09ERV9BVVRIT1JJVFl9YCk7XG5cdFx0Y29uc3QgaXNVcmxGcm9tV2VidmlldyA9IChyZXF1ZXN0aW5nVXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHJlcXVlc3RpbmdVcmw/LnN0YXJ0c1dpdGgoYCR7U2NoZW1hcy52c2NvZGVXZWJ2aWV3fTovL2ApO1xuXG5cdFx0Y29uc3QgYWxsb3dlZFBlcm1pc3Npb25zSW5XZWJ2aWV3ID0gbmV3IFNldChbXG5cdFx0XHQnY2xpcGJvYXJkLXJlYWQnLFxuXHRcdFx0J2NsaXBib2FyZC1zYW5pdGl6ZWQtd3JpdGUnLFxuXHRcdFx0Ly8gVE9ETyhkZWVwYWsxNTU2KTogU2hvdWxkIGJlIHJlbW92ZWQgb25jZSBtaWdyYXRpb24gaXMgY29tcGxldGVcblx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMzkyMjhcblx0XHRcdCdkZXByZWNhdGVkLXN5bmMtY2xpcGJvYXJkLXJlYWQnLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgYWxsb3dlZFBlcm1pc3Npb25zSW5Db3JlID0gbmV3IFNldChbXG5cdFx0XHQnbWVkaWEnLFxuXHRcdFx0J2xvY2FsLWZvbnRzJyxcblx0XHRcdC8vIFRPRE8oZGVlcGFrMTU1Nik6IFNob3VsZCBiZSByZW1vdmVkIG9uY2UgbWlncmF0aW9uIGlzIGNvbXBsZXRlXG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjM5MjI4XG5cdFx0XHQnZGVwcmVjYXRlZC1zeW5jLWNsaXBib2FyZC1yZWFkJyxcblx0XHRdKTtcblxuXHRcdHNlc3Npb24uZGVmYXVsdFNlc3Npb24uc2V0UGVybWlzc2lvblJlcXVlc3RIYW5kbGVyKChfd2ViQ29udGVudHMsIHBlcm1pc3Npb24sIGNhbGxiYWNrLCBkZXRhaWxzKSA9PiB7XG5cdFx0XHRpZiAoaXNVcmxGcm9tV2VidmlldyhkZXRhaWxzLnJlcXVlc3RpbmdVcmwpKSB7XG5cdFx0XHRcdHJldHVybiBjYWxsYmFjayhhbGxvd2VkUGVybWlzc2lvbnNJbldlYnZpZXcuaGFzKHBlcm1pc3Npb24pKTtcblx0XHRcdH1cblx0XHRcdGlmIChpc1VybEZyb21XaW5kb3coZGV0YWlscy5yZXF1ZXN0aW5nVXJsKSkge1xuXHRcdFx0XHRyZXR1cm4gY2FsbGJhY2soYWxsb3dlZFBlcm1pc3Npb25zSW5Db3JlLmhhcyhwZXJtaXNzaW9uKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gY2FsbGJhY2soZmFsc2UpO1xuXHRcdH0pO1xuXG5cdFx0c2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi5zZXRQZXJtaXNzaW9uQ2hlY2tIYW5kbGVyKChfd2ViQ29udGVudHMsIHBlcm1pc3Npb24sIF9vcmlnaW4sIGRldGFpbHMpID0+IHtcblx0XHRcdGlmIChpc1VybEZyb21XZWJ2aWV3KGRldGFpbHMucmVxdWVzdGluZ1VybCkpIHtcblx0XHRcdFx0cmV0dXJuIGFsbG93ZWRQZXJtaXNzaW9uc0luV2Vidmlldy5oYXMocGVybWlzc2lvbik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaXNVcmxGcm9tV2luZG93KGRldGFpbHMucmVxdWVzdGluZ1VybCkpIHtcblx0XHRcdFx0cmV0dXJuIGFsbG93ZWRQZXJtaXNzaW9uc0luQ29yZS5oYXMocGVybWlzc2lvbik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cblx0XHQvLyNlbmRyZWdpb25cblxuXHRcdC8vI3JlZ2lvbiBSZXF1ZXN0IGZpbHRlcmluZ1xuXG5cdFx0Ly8gQmxvY2sgYWxsIFNWRyByZXF1ZXN0cyBmcm9tIHVuc3VwcG9ydGVkIG9yaWdpbnNcblx0XHRjb25zdCBzdXBwb3J0ZWRTdmdTY2hlbWVzID0gbmV3IFNldChbU2NoZW1hcy5maWxlLCBTY2hlbWFzLnZzY29kZUZpbGVSZXNvdXJjZSwgU2NoZW1hcy52c2NvZGVSZW1vdGVSZXNvdXJjZSwgU2NoZW1hcy52c2NvZGVNYW5hZ2VkUmVtb3RlUmVzb3VyY2UsICdkZXZ0b29scyddKTtcblxuXHRcdC8vIEJ1dCBhbGxvdyB0aGVtIGlmIHRoZXkgYXJlIG1hZGUgZnJvbSBpbnNpZGUgYW4gd2Vidmlld1xuXHRcdGNvbnN0IGlzU2FmZUZyYW1lID0gKHJlcXVlc3RGcmFtZTogV2ViRnJhbWVNYWluIHwgbnVsbCB8IHVuZGVmaW5lZCk6IGJvb2xlYW4gPT4ge1xuXHRcdFx0Zm9yIChsZXQgZnJhbWU6IFdlYkZyYW1lTWFpbiB8IG51bGwgfCB1bmRlZmluZWQgPSByZXF1ZXN0RnJhbWU7IGZyYW1lOyBmcmFtZSA9IGZyYW1lLnBhcmVudCkge1xuXHRcdFx0XHRpZiAoZnJhbWUudXJsLnN0YXJ0c1dpdGgoYCR7U2NoZW1hcy52c2NvZGVXZWJ2aWV3fTovL2ApKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgaXNTdmdSZXF1ZXN0RnJvbVNhZmVDb250ZXh0ID0gKGRldGFpbHM6IEVsZWN0cm9uLk9uQmVmb3JlUmVxdWVzdExpc3RlbmVyRGV0YWlscyB8IEVsZWN0cm9uLk9uSGVhZGVyc1JlY2VpdmVkTGlzdGVuZXJEZXRhaWxzKTogYm9vbGVhbiA9PiB7XG5cdFx0XHRyZXR1cm4gZGV0YWlscy5yZXNvdXJjZVR5cGUgPT09ICd4aHInIHx8IGlzU2FmZUZyYW1lKGRldGFpbHMuZnJhbWUpO1xuXHRcdH07XG5cblx0XHRjb25zdCBpc0FsbG93ZWRWc0NvZGVGaWxlUmVxdWVzdCA9IChkZXRhaWxzOiBFbGVjdHJvbi5PbkJlZm9yZVJlcXVlc3RMaXN0ZW5lckRldGFpbHMpID0+IHtcblx0XHRcdGNvbnN0IGZyYW1lID0gZGV0YWlscy5mcmFtZTtcblx0XHRcdGlmICghZnJhbWUgfHwgIXRoaXMud2luZG93c01haW5TZXJ2aWNlKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2hlY2sgdG8gc2VlIGlmIHRoZSByZXF1ZXN0IGNvbWVzIGZyb20gb25lIG9mIHRoZSBtYWluIHdpbmRvd3MgKG9yIHNoYXJlZCBwcm9jZXNzKSBhbmQgbm90IGZyb20gZW1iZWRkZWQgY29udGVudFxuXHRcdFx0Y29uc3Qgd2luZG93cyA9IGdldEFsbFdpbmRvd3NFeGNsdWRpbmdPZmZzY3JlZW4oKTtcblx0XHRcdGZvciAoY29uc3Qgd2luZG93IG9mIHdpbmRvd3MpIHtcblx0XHRcdFx0aWYgKGZyYW1lLnByb2Nlc3NJZCA9PT0gd2luZG93LndlYkNvbnRlbnRzLm1haW5GcmFtZS5wcm9jZXNzSWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGlzQWxsb3dlZFdlYnZpZXdSZXF1ZXN0ID0gKHVyaTogVVJJLCBkZXRhaWxzOiBFbGVjdHJvbi5PbkJlZm9yZVJlcXVlc3RMaXN0ZW5lckRldGFpbHMpOiBib29sZWFuID0+IHtcblx0XHRcdGlmICh1cmkucGF0aCAhPT0gJy9pbmRleC5odG1sJykge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gT25seSByZXN0cmljdCB0b3AgbGV2ZWwgcGFnZSBvZiB3ZWJ2aWV3czogaW5kZXguaHRtbFxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmcmFtZSA9IGRldGFpbHMuZnJhbWU7XG5cdFx0XHRpZiAoIWZyYW1lIHx8ICF0aGlzLndpbmRvd3NNYWluU2VydmljZSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENoZWNrIHRvIHNlZSBpZiB0aGUgcmVxdWVzdCBjb21lcyBmcm9tIG9uZSBvZiB0aGUgbWFpbiBlZGl0b3Igd2luZG93cy5cblx0XHRcdGZvciAoY29uc3Qgd2luZG93IG9mIHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd3MoKSkge1xuXHRcdFx0XHRpZiAod2luZG93Lndpbikge1xuXHRcdFx0XHRcdGlmIChmcmFtZS5wcm9jZXNzSWQgPT09IHdpbmRvdy53aW4ud2ViQ29udGVudHMubWFpbkZyYW1lLnByb2Nlc3NJZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9O1xuXG5cdFx0c2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbi53ZWJSZXF1ZXN0Lm9uQmVmb3JlUmVxdWVzdCgoZGV0YWlscywgY2FsbGJhY2spID0+IHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShkZXRhaWxzLnVybCk7XG5cdFx0XHRpZiAodXJpLnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVXZWJ2aWV3KSB7XG5cdFx0XHRcdGlmICghaXNBbGxvd2VkV2Vidmlld1JlcXVlc3QodXJpLCBkZXRhaWxzKSkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignQmxvY2tlZCB2c2NvZGUtd2VidmlldyByZXF1ZXN0JywgZGV0YWlscy51cmwpO1xuXHRcdFx0XHRcdHJldHVybiBjYWxsYmFjayh7IGNhbmNlbDogdHJ1ZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodXJpLnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVGaWxlUmVzb3VyY2UpIHtcblx0XHRcdFx0aWYgKCFpc0FsbG93ZWRWc0NvZGVGaWxlUmVxdWVzdChkZXRhaWxzKSkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignQmxvY2tlZCB2c2NvZGUtZmlsZSByZXF1ZXN0JywgZGV0YWlscy51cmwpO1xuXHRcdFx0XHRcdHJldHVybiBjYWxsYmFjayh7IGNhbmNlbDogdHJ1ZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBCbG9jayBtb3N0IHN2Z3Ncblx0XHRcdGlmICh1cmkucGF0aC5lbmRzV2l0aCgnLnN2ZycpKSB7XG5cdFx0XHRcdGNvbnN0IGlzU2FmZVJlc291cmNlVXJsID0gc3VwcG9ydGVkU3ZnU2NoZW1lcy5oYXModXJpLnNjaGVtZSk7XG5cdFx0XHRcdGlmICghaXNTYWZlUmVzb3VyY2VVcmwpIHtcblx0XHRcdFx0XHRyZXR1cm4gY2FsbGJhY2soeyBjYW5jZWw6ICFpc1N2Z1JlcXVlc3RGcm9tU2FmZUNvbnRleHQoZGV0YWlscykgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNhbGxiYWNrKHsgY2FuY2VsOiBmYWxzZSB9KTtcblx0XHR9KTtcblxuXHRcdC8vIENvbmZpZ3VyZSBTVkcgaGVhZGVyIGNvbnRlbnQgdHlwZSBwcm9wZXJseVxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85NzU2NFxuXHRcdHNlc3Npb24uZGVmYXVsdFNlc3Npb24ud2ViUmVxdWVzdC5vbkhlYWRlcnNSZWNlaXZlZCgoZGV0YWlscywgY2FsbGJhY2spID0+IHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlSGVhZGVycyA9IGRldGFpbHMucmVzcG9uc2VIZWFkZXJzIGFzIFJlY29yZDxzdHJpbmcsIChzdHJpbmcpIHwgKHN0cmluZ1tdKT47XG5cdFx0XHRjb25zdCBjb250ZW50VHlwZXMgPSAocmVzcG9uc2VIZWFkZXJzWydjb250ZW50LXR5cGUnXSB8fCByZXNwb25zZUhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddKTtcblxuXHRcdFx0aWYgKGNvbnRlbnRUeXBlcyAmJiBBcnJheS5pc0FycmF5KGNvbnRlbnRUeXBlcykpIHtcblx0XHRcdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKGRldGFpbHMudXJsKTtcblx0XHRcdFx0aWYgKHVyaS5wYXRoLmVuZHNXaXRoKCcuc3ZnJykpIHtcblx0XHRcdFx0XHRpZiAoc3VwcG9ydGVkU3ZnU2NoZW1lcy5oYXModXJpLnNjaGVtZSkpIHtcblx0XHRcdFx0XHRcdHJlc3BvbnNlSGVhZGVyc1snQ29udGVudC1UeXBlJ10gPSBbJ2ltYWdlL3N2Zyt4bWwnXTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIGNhbGxiYWNrKHsgY2FuY2VsOiBmYWxzZSwgcmVzcG9uc2VIZWFkZXJzIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIHJlbW90ZSBleHRlbnNpb24gc2NoZW1lcyBoYXZlIHRoZSBmb2xsb3dpbmcgZm9ybWF0XG5cdFx0XHRcdC8vIGh0dHA6Ly8xMjcuMC4wLjE6PHBvcnQ+L3ZzY29kZS1yZW1vdGUtcmVzb3VyY2U/cGF0aD1cblx0XHRcdFx0aWYgKCF1cmkucGF0aC5lbmRzV2l0aChTY2hlbWFzLnZzY29kZVJlbW90ZVJlc291cmNlKSAmJiBjb250ZW50VHlwZXMuc29tZShjb250ZW50VHlwZSA9PiBjb250ZW50VHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdpbWFnZS9zdmcnKSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gY2FsbGJhY2soeyBjYW5jZWw6ICFpc1N2Z1JlcXVlc3RGcm9tU2FmZUNvbnRleHQoZGV0YWlscykgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNhbGxiYWNrKHsgY2FuY2VsOiBmYWxzZSB9KTtcblx0XHR9KTtcblxuXHRcdC8vI2VuZHJlZ2lvblxuXG5cdFx0Ly8jcmVnaW9uIEFsbG93IENPUlMgZm9yIHRoZSBQUlNTIENETlxuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUtcmVtb3RlLXJlbGVhc2UvaXNzdWVzLzkyNDZcblx0XHRzZXNzaW9uLmRlZmF1bHRTZXNzaW9uLndlYlJlcXVlc3Qub25IZWFkZXJzUmVjZWl2ZWQoKGRldGFpbHMsIGNhbGxiYWNrKSA9PiB7XG5cdFx0XHRpZiAoZGV0YWlscy51cmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly92c2NvZGUuZG93bmxvYWQucHJzcy5taWNyb3NvZnQuY29tLycpKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3BvbnNlSGVhZGVycyA9IGRldGFpbHMucmVzcG9uc2VIZWFkZXJzID8/IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cblx0XHRcdFx0aWYgKHJlc3BvbnNlSGVhZGVyc1snQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJ10gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJlc3BvbnNlSGVhZGVyc1snQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJ10gPSBbJyonXTtcblx0XHRcdFx0XHRyZXR1cm4gY2FsbGJhY2soeyBjYW5jZWw6IGZhbHNlLCByZXNwb25zZUhlYWRlcnMgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNhbGxiYWNrKHsgY2FuY2VsOiBmYWxzZSB9KTtcblx0XHR9KTtcblxuXHRcdC8vI2VuZHJlZ2lvblxuXG5cdFx0Ly8jcmVnaW9uIENvZGUgQ2FjaGVcblxuXHRcdHR5cGUgU2Vzc2lvbldpdGhDb2RlQ2FjaGVQYXRoU3VwcG9ydCA9IFNlc3Npb24gJiB7XG5cdFx0XHQvKipcblx0XHRcdCAqIFNldHMgY29kZSBjYWNoZSBkaXJlY3RvcnkuIEJ5IGRlZmF1bHQsIHRoZSBkaXJlY3Rvcnkgd2lsbCBiZSBgQ29kZSBDYWNoZWAgdW5kZXJcblx0XHRcdCAqIHRoZSByZXNwZWN0aXZlIHVzZXIgZGF0YSBmb2xkZXIuXG5cdFx0XHQgKi9cblx0XHRcdHNldENvZGVDYWNoZVBhdGg/KHBhdGg6IHN0cmluZyk6IHZvaWQ7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGRlZmF1bHRTZXNzaW9uID0gc2Vzc2lvbi5kZWZhdWx0U2Vzc2lvbiBhcyB1bmtub3duIGFzIFNlc3Npb25XaXRoQ29kZUNhY2hlUGF0aFN1cHBvcnQ7XG5cdFx0aWYgKHR5cGVvZiBkZWZhdWx0U2Vzc2lvbi5zZXRDb2RlQ2FjaGVQYXRoID09PSAnZnVuY3Rpb24nICYmIHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5jb2RlQ2FjaGVQYXRoKSB7XG5cdFx0XHQvLyBNYWtlIHN1cmUgdG8gcGFydGl0aW9uIENocm9tZSdzIGNvZGUgY2FjaGUgZm9sZGVyXG5cdFx0XHQvLyBpbiB0aGUgc2FtZSB3YXkgYXMgb3VyIGNvZGUgY2FjaGUgcGF0aCB0byBoZWxwXG5cdFx0XHQvLyBpbnZhbGlkYXRlIGNhY2hlcyB0aGF0IHdlIGtub3cgYXJlIGludmFsaWRcblx0XHRcdC8vIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTIwNjU1KVxuXHRcdFx0ZGVmYXVsdFNlc3Npb24uc2V0Q29kZUNhY2hlUGF0aChqb2luKHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5jb2RlQ2FjaGVQYXRoLCAnY2hyb21lJykpO1xuXHRcdH1cblxuXHRcdC8vI2VuZHJlZ2lvblxuXG5cdFx0Ly8jcmVnaW9uIFVOQyBIb3N0IEFsbG93bGlzdCAoV2luZG93cylcblxuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdzZWN1cml0eS5yZXN0cmljdFVOQ0FjY2VzcycpID09PSBmYWxzZSkge1xuXHRcdFx0XHRkaXNhYmxlVU5DQWNjZXNzUmVzdHJpY3Rpb25zKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhZGRVTkNIb3N0VG9BbGxvd2xpc3QodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnc2VjdXJpdHkuYWxsb3dlZFVOQ0hvc3RzJykpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vI2VuZHJlZ2lvblxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIERpc3Bvc2Ugb24gc2h1dGRvd25cblx0XHRFdmVudC5vbmNlKHRoaXMubGlmZWN5Y2xlTWFpblNlcnZpY2Uub25XaWxsU2h1dGRvd24pKCgpID0+IHRoaXMuZGlzcG9zZSgpKTtcblxuXHRcdC8vIENvbnRleHRtZW51IHZpYSBJUEMgc3VwcG9ydFxuXHRcdHJlZ2lzdGVyQ29udGV4dE1lbnVMaXN0ZW5lcigpO1xuXG5cdFx0Ly8gQWNjZXNzaWJpbGl0eSBjaGFuZ2UgZXZlbnRcblx0XHRhcHAub24oJ2FjY2Vzc2liaWxpdHktc3VwcG9ydC1jaGFuZ2VkJywgKGV2ZW50LCBhY2Nlc3NpYmlsaXR5U3VwcG9ydEVuYWJsZWQpID0+IHtcblx0XHRcdHRoaXMud2luZG93c01haW5TZXJ2aWNlPy5zZW5kVG9BbGwoJ3ZzY29kZTphY2Nlc3NpYmlsaXR5U3VwcG9ydENoYW5nZWQnLCBhY2Nlc3NpYmlsaXR5U3VwcG9ydEVuYWJsZWQpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gbWFjT1MgZG9jayBhY3RpdmF0ZVxuXHRcdGFwcC5vbignYWN0aXZhdGUnLCBhc3luYyAoZXZlbnQsIGhhc1Zpc2libGVXaW5kb3dzKSA9PiB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ2FwcCNhY3RpdmF0ZScpO1xuXG5cdFx0XHQvLyBNYWMgb25seSBldmVudDogb3BlbiBuZXcgd2luZG93IHdoZW4gd2UgZ2V0IGFjdGl2YXRlZFxuXHRcdFx0aWYgKCFoYXNWaXNpYmxlV2luZG93cykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLndpbmRvd3NNYWluU2VydmljZT8ub3BlbkVtcHR5V2luZG93KHsgY29udGV4dDogT3BlbkNvbnRleHQuRE9DSyB9KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vI3JlZ2lvbiBTZWN1cml0eSByZWxhdGVkIG1lYXN1cmVzIChodHRwczovL2VsZWN0cm9uanMub3JnL2RvY3MvdHV0b3JpYWwvc2VjdXJpdHkpXG5cdFx0Ly9cblx0XHQvLyAhISEgRE8gTk9UIENIQU5HRSB3aXRob3V0IGNvbnN1bHRpbmcgdGhlIGRvY3VtZW50YXRpb24gISEhXG5cdFx0Ly9cblx0XHRhcHAub24oJ3dlYi1jb250ZW50cy1jcmVhdGVkJywgKGV2ZW50LCBjb250ZW50cykgPT4ge1xuXG5cdFx0XHQvLyBBdXhpbGlhcnkgV2luZG93OiBkZWxlZ2F0ZSB0byBgQXV4aWxpYXJ5V2luZG93YCBjbGFzc1xuXHRcdFx0aWYgKGNvbnRlbnRzPy5vcGVuZXI/LnVybC5zdGFydHNXaXRoKGAke1NjaGVtYXMudnNjb2RlRmlsZVJlc291cmNlfTovLyR7VlNDT0RFX0FVVEhPUklUWX0vYCkpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdbYXV4IHdpbmRvd10gIGFwcC5vbihcIndlYi1jb250ZW50cy1jcmVhdGVkXCIpOiBSZWdpc3RlcmluZyBhdXhpbGlhcnkgd2luZG93Jyk7XG5cblx0XHRcdFx0dGhpcy5hdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2U/LnJlZ2lzdGVyV2luZG93KGNvbnRlbnRzKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQmxvY2sgYW55IGluLXBhZ2UgbmF2aWdhdGlvblxuXHRcdFx0Y29udGVudHMub24oJ3dpbGwtbmF2aWdhdGUnLCBldmVudCA9PiB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignd2ViQ29udGVudHMjd2lsbC1uYXZpZ2F0ZTogUHJldmVudGVkIHdlYmNvbnRlbnQgbmF2aWdhdGlvbicpO1xuXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gQWxsIFdpbmRvd3M6IG9ubHkgYWxsb3cgYWJvdXQ6YmxhbmsgYXV4aWxpYXJ5IHdpbmRvd3MgdG8gb3BlblxuXHRcdFx0Ly8gRm9yIGFsbCBvdGhlciBVUkxzLCBkZWxlZ2F0ZSB0byB0aGUgT1MuXG5cdFx0XHRjb250ZW50cy5zZXRXaW5kb3dPcGVuSGFuZGxlcihkZXRhaWxzID0+IHtcblxuXHRcdFx0XHQvLyBhYm91dDpibGFuayB3aW5kb3dzIGNhbiBvcGVuIGFzIHdpbmRvdyB3aXRobyBvdXIgZGVmYXVsdCBvcHRpb25zXG5cdFx0XHRcdGlmIChkZXRhaWxzLnVybCA9PT0gJ2Fib3V0OmJsYW5rJykge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnW2F1eCB3aW5kb3ddIHdlYkNvbnRlbnRzI3NldFdpbmRvd09wZW5IYW5kbGVyOiBBbGxvd2luZyBhdXhpbGlhcnkgd2luZG93IHRvIG9wZW4gb24gYWJvdXQ6YmxhbmsnKTtcblxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRhY3Rpb246ICdhbGxvdycsXG5cdFx0XHRcdFx0XHRvdmVycmlkZUJyb3dzZXJXaW5kb3dPcHRpb25zOiB0aGlzLmF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZT8uY3JlYXRlV2luZG93KGRldGFpbHMpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEFueSBvdGhlciBVUkw6IGRlbGVnYXRlIHRvIE9TXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgd2ViQ29udGVudHMjc2V0V2luZG93T3BlbkhhbmRsZXI6IFByZXZlbnRlZCBvcGVuaW5nIHdpbmRvdyB3aXRoIFVSTCAke2RldGFpbHMudXJsfX1gKTtcblxuXHRcdFx0XHRcdHRoaXMubmF0aXZlSG9zdE1haW5TZXJ2aWNlPy5vcGVuRXh0ZXJuYWwodW5kZWZpbmVkLCBkZXRhaWxzLnVybCk7XG5cblx0XHRcdFx0XHRyZXR1cm4geyBhY3Rpb246ICdkZW55JyB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdC8vI2VuZHJlZ2lvblxuXG5cdFx0bGV0IG1hY09wZW5GaWxlVVJJczogSVdpbmRvd09wZW5hYmxlW10gPSBbXTtcblx0XHRsZXQgcnVubmluZ1RpbWVvdXQ6IE5vZGVKUy5UaW1lb3V0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGFwcC5vbignb3Blbi1maWxlJywgKGV2ZW50LCBwYXRoKSA9PiB7XG5cdFx0XHRwYXRoID0gbm9ybWFsaXplTkZDKHBhdGgpOyAvLyBtYWNPUyBvbmx5OiBub3JtYWxpemUgcGF0aHMgdG8gTkZDIGZvcm1cblxuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdhcHAjb3Blbi1maWxlOiAnLCBwYXRoKTtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdC8vIEtlZXAgaW4gYXJyYXkgYmVjYXVzZSBtb3JlIG1pZ2h0IGNvbWUhXG5cdFx0XHRtYWNPcGVuRmlsZVVSSXMucHVzaChoYXNXb3Jrc3BhY2VGaWxlRXh0ZW5zaW9uKHBhdGgpID8geyB3b3Jrc3BhY2VVcmk6IFVSSS5maWxlKHBhdGgpIH0gOiB7IGZpbGVVcmk6IFVSSS5maWxlKHBhdGgpIH0pO1xuXG5cdFx0XHQvLyBDbGVhciBwcmV2aW91cyBoYW5kbGVyIGlmIGFueVxuXHRcdFx0aWYgKHJ1bm5pbmdUaW1lb3V0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KHJ1bm5pbmdUaW1lb3V0KTtcblx0XHRcdFx0cnVubmluZ1RpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEhhbmRsZSBwYXRocyBkZWxheWVkIGluIGNhc2UgbW9yZSBhcmUgY29taW5nIVxuXHRcdFx0cnVubmluZ1RpbWVvdXQgPSBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy53aW5kb3dzTWFpblNlcnZpY2U/Lm9wZW4oe1xuXHRcdFx0XHRcdGNvbnRleHQ6IE9wZW5Db250ZXh0LkRPQ0sgLyogY2FuIGFsc28gYmUgb3BlbmluZyBmcm9tIGZpbmRlciB3aGlsZSBhcHAgaXMgcnVubmluZyAqLyxcblx0XHRcdFx0XHRjbGk6IHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmdzLFxuXHRcdFx0XHRcdHVyaXNUb09wZW46IG1hY09wZW5GaWxlVVJJcyxcblx0XHRcdFx0XHRnb3RvTGluZU1vZGU6IGZhbHNlLFxuXHRcdFx0XHRcdHByZWZlck5ld1dpbmRvdzogdHJ1ZSAvKiBkcm9wcGluZyBvbiB0aGUgZG9jayBvciBvcGVuaW5nIGZyb20gZmluZGVyIHByZWZlcnMgdG8gb3BlbiBpbiBhIG5ldyB3aW5kb3cgKi9cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0bWFjT3BlbkZpbGVVUklzID0gW107XG5cdFx0XHRcdHJ1bm5pbmdUaW1lb3V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0fSwgMTAwKTtcblx0XHR9KTtcblxuXHRcdGFwcC5vbignbmV3LXdpbmRvdy1mb3ItdGFiJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgdGhpcy53aW5kb3dzTWFpblNlcnZpY2U/Lm9wZW5FbXB0eVdpbmRvdyh7IGNvbnRleHQ6IE9wZW5Db250ZXh0LkRFU0tUT1AgfSk7IC8vbWFjT1MgbmF0aXZlIHRhYiBcIitcIiBidXR0b25cblx0XHR9KTtcblxuXHRcdC8vI3JlZ2lvbiBCb290c3RyYXAgSVBDIEhhbmRsZXJzXG5cblx0XHR2YWxpZGF0ZWRJcGNNYWluLmhhbmRsZSgndnNjb2RlOmZldGNoU2hlbGxFbnYnLCBldmVudCA9PiB7XG5cblx0XHRcdC8vIFByZWZlciB0byB1c2UgdGhlIGFyZ3MgYW5kIGVudiBmcm9tIHRoZSB0YXJnZXQgd2luZG93XG5cdFx0XHQvLyB3aGVuIHJlc29sdmluZyB0aGUgc2hlbGwgZW52LiBJdCBpcyBwb3NzaWJsZSB0aGF0XG5cdFx0XHQvLyBhIGZpcnN0IHdpbmRvdyB3YXMgb3BlbmVkIGZyb20gdGhlIFVJIGJ1dCBhIHNlY29uZFxuXHRcdFx0Ly8gZnJvbSB0aGUgQ0xJIGFuZCB0aGF0IGhhcyBpbXBsaWNhdGlvbnMgZm9yIHdoZXRoZXIgdG9cblx0XHRcdC8vIHJlc29sdmUgdGhlIHNoZWxsIGVudmlyb25tZW50IG9yIG5vdC5cblx0XHRcdC8vXG5cdFx0XHQvLyBXaW5kb3cgY2FuIGJlIHVuZGVmaW5lZCBmb3IgZS5nLiB0aGUgc2hhcmVkIHByb2Nlc3Ncblx0XHRcdC8vIHRoYXQgaXMgbm90IHBhcnQgb2Ygb3VyIHdpbmRvd3MgcmVnaXN0cnkhXG5cdFx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd3NNYWluU2VydmljZT8uZ2V0V2luZG93QnlXZWJDb250ZW50cyhldmVudC5zZW5kZXIpOyAvLyBOb3RlOiB0aGlzIGNhbiBiZSBgdW5kZWZpbmVkYCBmb3IgdGhlIHNoYXJlZCBwcm9jZXNzXG5cdFx0XHRsZXQgYXJnczogTmF0aXZlUGFyc2VkQXJncztcblx0XHRcdGxldCBlbnY6IElQcm9jZXNzRW52aXJvbm1lbnQ7XG5cdFx0XHRpZiAod2luZG93Py5jb25maWcpIHtcblx0XHRcdFx0YXJncyA9IHdpbmRvdy5jb25maWc7XG5cdFx0XHRcdGVudiA9IHsgLi4ucHJvY2Vzcy5lbnYsIC4uLndpbmRvdy5jb25maWcudXNlckVudiB9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXJncyA9IHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmdzO1xuXHRcdFx0XHRlbnYgPSBwcm9jZXNzLmVudjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVzb2x2ZSBzaGVsbCBlbnZcblx0XHRcdHJldHVybiB0aGlzLnJlc29sdmVTaGVsbEVudmlyb25tZW50KGFyZ3MsIGVudiwgZmFsc2UpO1xuXHRcdH0pO1xuXG5cdFx0dmFsaWRhdGVkSXBjTWFpbi5vbigndnNjb2RlOnRvZ2dsZURldlRvb2xzJywgZXZlbnQgPT4gZXZlbnQuc2VuZGVyLnRvZ2dsZURldlRvb2xzKCkpO1xuXHRcdHZhbGlkYXRlZElwY01haW4ub24oJ3ZzY29kZTpvcGVuRGV2VG9vbHMnLCBldmVudCA9PiBldmVudC5zZW5kZXIub3BlbkRldlRvb2xzKCkpO1xuXG5cdFx0dmFsaWRhdGVkSXBjTWFpbi5vbigndnNjb2RlOnJlbG9hZFdpbmRvdycsIGV2ZW50ID0+IGV2ZW50LnNlbmRlci5yZWxvYWQoKSk7XG5cblx0XHR2YWxpZGF0ZWRJcGNNYWluLmhhbmRsZSgndnNjb2RlOm5vdGlmeVpvb21MZXZlbCcsIGFzeW5jIChldmVudCwgem9vbUxldmVsOiBudW1iZXIgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdGNvbnN0IHdpbmRvdyA9IHRoaXMud2luZG93c01haW5TZXJ2aWNlPy5nZXRXaW5kb3dCeVdlYkNvbnRlbnRzKGV2ZW50LnNlbmRlcik7XG5cdFx0XHRpZiAod2luZG93KSB7XG5cdFx0XHRcdHdpbmRvdy5ub3RpZnlab29tTGV2ZWwoem9vbUxldmVsKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vI2VuZHJlZ2lvblxuXHR9XG5cblx0cHJpdmF0ZSBzdGFydEZ1eGFTZXJ2ZXIoKTogdm9pZCB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzXG5cdFx0XHRjb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpIGFzIHR5cGVvZiBpbXBvcnQoJ3BhdGgnKTtcblx0XHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzXG5cdFx0XHRjb25zdCB7IHNwYXduIH0gPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJykgYXMgdHlwZW9mIGltcG9ydCgnY2hpbGRfcHJvY2VzcycpO1xuXHRcdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHNcblx0XHRcdGNvbnN0IGZzID0gcmVxdWlyZSgnZnMnKSBhcyB0eXBlb2YgaW1wb3J0KCdmcycpO1xuXHRcdFx0Y29uc3QgZnV4YVNlcnZlclBhdGggPSBwYXRoLmpvaW4odGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFwcFJvb3QsICd2ZW5kb3InLCAnZnV4YS1zZXJ2ZXInKTtcblx0XHRcdGNvbnN0IGZ1eGFNYWluID0gcGF0aC5qb2luKGZ1eGFTZXJ2ZXJQYXRoLCAnbWFpbi5qcycpO1xuXHRcdFx0Y29uc3QgdXNlckRpciA9IHBhdGguam9pbih0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UudXNlckRhdGFQYXRoLCAnZnV4YS1kYXRhJyk7XG5cdFx0XHRmcy5ta2RpclN5bmMocGF0aC5qb2luKHVzZXJEaXIsICdfYXBwZGF0YScpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblx0XHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSB0aGlzLmxvZ1NlcnZpY2U7XG5cdFx0XHRsb2dTZXJ2aWNlLmluZm8oJ1tGVVhBXSBTdGFydGluZyBzZXJ2ZXIuLi4nKTtcblx0XHRcdGNvbnN0IGNoaWxkID0gc3Bhd24ocHJvY2Vzcy5leGVjUGF0aCwgW2Z1eGFNYWluLCAnLS11c2VyRGlyJywgdXNlckRpcl0sIHtcblx0XHRcdFx0Y3dkOiBmdXhhU2VydmVyUGF0aCxcblx0XHRcdFx0ZW52OiB7IC4uLnByb2Nlc3MuZW52LCBFTEVDVFJPTl9SVU5fQVNfTk9ERTogJzEnIH0sXG5cdFx0XHRcdHN0ZGlvOiBbJ2lnbm9yZScsICdwaXBlJywgJ3BpcGUnXSxcblx0XHRcdH0pO1xuXHRcdFx0Y2hpbGQuc3Rkb3V0IS5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IGxvZ1NlcnZpY2UuaW5mbyhgW0ZVWEFdICR7ZGF0YS50b1N0cmluZygpLnRyaW0oKX1gKSk7XG5cdFx0XHRjaGlsZC5zdGRlcnIhLm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4gbG9nU2VydmljZS53YXJuKGBbRlVYQV0gJHtkYXRhLnRvU3RyaW5nKCkudHJpbSgpfWApKTtcblx0XHRcdGNoaWxkLm9uKCdlcnJvcicsIChlcnI6IEVycm9yKSA9PiBsb2dTZXJ2aWNlLmVycm9yKGBbRlVYQV0gcHJvY2VzcyBlcnJvcjogJHtlcnIubWVzc2FnZX1gKSk7XG5cdFx0XHRjaGlsZC5vbignZXhpdCcsIChjb2RlOiBudW1iZXIpID0+IGxvZ1NlcnZpY2UuaW5mbyhgW0ZVWEFdIHByb2Nlc3MgZXhpdGVkIHdpdGggY29kZSAke2NvZGV9YCkpO1xuXHRcdH0gY2F0Y2ggKGVycjogYW55KSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFtGVVhBXSBGYWlsZWQgdG8gc3RhcnQgc2VydmVyOiAke2Vyci5tZXNzYWdlfWApO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHN0YXJ0dXAoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKCdTdGFydGluZyBWUyBDb2RlJyk7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKGBmcm9tOiAke3RoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcHBSb290fWApO1xuXHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZygnYXJnczonLCB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXJncyk7XG5cblx0XHQvLyBNYWtlIHN1cmUgd2UgYXNzb2NpYXRlIHRoZSBwcm9ncmFtIHdpdGggdGhlIGFwcCB1c2VyIG1vZGVsIGlkXG5cdFx0Ly8gVGhpcyB3aWxsIGhlbHAgV2luZG93cyB0byBhc3NvY2lhdGUgdGhlIHJ1bm5pbmcgcHJvZ3JhbSB3aXRoXG5cdFx0Ly8gYW55IHNob3J0Y3V0IHRoYXQgaXMgcGlubmVkIHRvIHRoZSB0YXNrYmFyIGFuZCBwcmV2ZW50IHNob3dpbmdcblx0XHQvLyB0d28gaWNvbnMgaW4gdGhlIHRhc2tiYXIgZm9yIHRoZSBzYW1lIGFwcC5cblx0XHRjb25zdCB3aW4zMkFwcFVzZXJNb2RlbElkID0gdGhpcy5wcm9kdWN0U2VydmljZS53aW4zMkFwcFVzZXJNb2RlbElkO1xuXHRcdGlmIChpc1dpbmRvd3MgJiYgd2luMzJBcHBVc2VyTW9kZWxJZCkge1xuXHRcdFx0YXBwLnNldEFwcFVzZXJNb2RlbElkKHdpbjMyQXBwVXNlck1vZGVsSWQpO1xuXHRcdH1cblxuXHRcdC8vIEZpeCBuYXRpdmUgdGFicyBvbiBtYWNPUyAxMC4xM1xuXHRcdC8vIG1hY09TIGVuYWJsZXMgYSBjb21wYXRpYmlsaXR5IHBhdGNoIGZvciBhbnkgYnVuZGxlIElEIGJlZ2lubmluZyB3aXRoXG5cdFx0Ly8gXCJjb20ubWljcm9zb2Z0LlwiLCB3aGljaCBicmVha3MgbmF0aXZlIHRhYnMgZm9yIFZTIENvZGUgd2hlbiB1c2luZyB0aGlzXG5cdFx0Ly8gaWRlbnRpZmllciAoZnJvbSB0aGUgb2ZmaWNpYWwgYnVpbGQpLlxuXHRcdC8vIEV4cGxpY2l0bHkgb3B0IG91dCBvZiB0aGUgcGF0Y2ggaGVyZSBiZWZvcmUgY3JlYXRpbmcgYW55IHdpbmRvd3MuXG5cdFx0Ly8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMzUzNjEjaXNzdWVjb21tZW50LTM5OTc5NDA4NVxuXHRcdHRyeSB7XG5cdFx0XHRpZiAoaXNNYWNpbnRvc2ggJiYgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnd2luZG93Lm5hdGl2ZVRhYnMnKSA9PT0gdHJ1ZSAmJiAhc3lzdGVtUHJlZmVyZW5jZXMuZ2V0VXNlckRlZmF1bHQoJ05TVXNlSW1wcm92ZWRMYXlvdXRQYXNzJywgJ2Jvb2xlYW4nKSkge1xuXHRcdFx0XHRzeXN0ZW1QcmVmZXJlbmNlcy5zZXRVc2VyRGVmYXVsdCgnTlNVc2VJbXByb3ZlZExheW91dFBhc3MnLCAnYm9vbGVhbicsIHRydWUgYXMgYW55KTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIHByb2Nlc3Mgc2VydmVyIChlbGVjdHJvbiBJUEMgYmFzZWQpXG5cdFx0Y29uc3QgbWFpblByb2Nlc3NFbGVjdHJvblNlcnZlciA9IG5ldyBFbGVjdHJvbklQQ1NlcnZlcigpO1xuXHRcdEV2ZW50Lm9uY2UodGhpcy5saWZlY3ljbGVNYWluU2VydmljZS5vbldpbGxTaHV0ZG93bikoZSA9PiB7XG5cdFx0XHRpZiAoZS5yZWFzb24gPT09IFNodXRkb3duUmVhc29uLktJTEwpIHtcblx0XHRcdFx0Ly8gV2hlbiB3ZSBnbyBkb3duIGFibm9ybWFsbHksIG1ha2Ugc3VyZSB0byBmcmVlIHVwXG5cdFx0XHRcdC8vIGFueSBJUEMgd2UgYWNjZXB0IGZyb20gb3RoZXIgd2luZG93cyB0byByZWR1Y2Vcblx0XHRcdFx0Ly8gdGhlIGNoYW5jZSBvZiBkb2luZyB3b3JrIGFmdGVyIHdlIGdvIGRvd24uIEtpbGxcblx0XHRcdFx0Ly8gaXMgc3BlY2lhbCBpbiB0aGF0IGl0IGRvZXMgbm90IG9yZGVybHkgc2h1dGRvd25cblx0XHRcdFx0Ly8gd2luZG93cy5cblx0XHRcdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBSZXNvbHZlIHVuaXF1ZSBtYWNoaW5lIElEXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdSZXNvbHZpbmcgbWFjaGluZSBpZGVudGlmaWVyLi4uJyk7XG5cdFx0Y29uc3QgW21hY2hpbmVJZCwgc3FtSWQsIGRldkRldmljZUlkXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdHJlc29sdmVNYWNoaW5lSWQodGhpcy5zdGF0ZVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSksXG5cdFx0XHRyZXNvbHZlU3FtSWQodGhpcy5zdGF0ZVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSksXG5cdFx0XHRyZXNvbHZlZGV2RGV2aWNlSWQodGhpcy5zdGF0ZVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSlcblx0XHRdKTtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFJlc29sdmVkIG1hY2hpbmUgaWRlbnRpZmllcjogJHttYWNoaW5lSWR9YCk7XG5cblx0XHQvLyBTaGFyZWQgcHJvY2Vzc1xuXHRcdGNvbnN0IHsgc2hhcmVkUHJvY2Vzc1JlYWR5LCBzaGFyZWRQcm9jZXNzQ2xpZW50IH0gPSB0aGlzLnNldHVwU2hhcmVkUHJvY2VzcyhtYWNoaW5lSWQsIHNxbUlkLCBkZXZEZXZpY2VJZCk7XG5cblx0XHQvLyBTZXJ2aWNlc1xuXHRcdGNvbnN0IGFwcEluc3RhbnRpYXRpb25TZXJ2aWNlID0gYXdhaXQgdGhpcy5pbml0U2VydmljZXMobWFjaGluZUlkLCBzcW1JZCwgZGV2RGV2aWNlSWQsIHNoYXJlZFByb2Nlc3NSZWFkeSk7XG5cblx0XHQvLyBFcnJvciB0ZWxlbWV0cnlcblx0XHRhcHBJbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB0aGlzLl9yZWdpc3RlcihuZXcgRXJyb3JUZWxlbWV0cnkoYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElUZWxlbWV0cnlTZXJ2aWNlKSkpKTtcblxuXHRcdC8vIEF1dGggSGFuZGxlclxuXHRcdGFwcEluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGFjY2Vzc29yLmdldChJUHJveHlBdXRoU2VydmljZSkpO1xuXG5cdFx0Ly8gVHJhbnNpZW50IHByb2ZpbGVzIGhhbmRsZXJcblx0XHR0aGlzLl9yZWdpc3RlcihhcHBJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVc2VyRGF0YVByb2ZpbGVzSGFuZGxlcikpO1xuXG5cdFx0Ly8gSW5pdCBDaGFubmVsc1xuXHRcdGFwcEluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHRoaXMuaW5pdENoYW5uZWxzKGFjY2Vzc29yLCBtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLCBzaGFyZWRQcm9jZXNzQ2xpZW50KSk7XG5cblx0XHQvLyBTdGFydCBGVVhBIHNlcnZlciAoUExDIEhNSS9TQ0FEQSBzaW11bGF0aW9uIGVuZ2luZSBvbiBwb3J0IDE4ODEpXG5cdFx0dGhpcy5zdGFydEZ1eGFTZXJ2ZXIoKTtcblxuXHRcdC8vIFNldHVwIFByb3RvY29sIFVSTCBIYW5kbGVyc1xuXHRcdGNvbnN0IGluaXRpYWxQcm90b2NvbFVybHMgPSBhd2FpdCBhcHBJbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB0aGlzLnNldHVwUHJvdG9jb2xVcmxIYW5kbGVycyhhY2Nlc3NvciwgbWFpblByb2Nlc3NFbGVjdHJvblNlcnZlcikpO1xuXG5cdFx0Ly8gU2V0dXAgdnNjb2RlLXJlbW90ZS1yZXNvdXJjZSBwcm90b2NvbCBoYW5kbGVyXG5cdFx0dGhpcy5zZXR1cE1hbmFnZWRSZW1vdGVSZXNvdXJjZVVybEhhbmRsZXIobWFpblByb2Nlc3NFbGVjdHJvblNlcnZlcik7XG5cblx0XHQvLyBTaWduYWwgcGhhc2U6IHJlYWR5IC0gYmVmb3JlIG9wZW5pbmcgZmlyc3Qgd2luZG93XG5cdFx0dGhpcy5saWZlY3ljbGVNYWluU2VydmljZS5waGFzZSA9IExpZmVjeWNsZU1haW5QaGFzZS5SZWFkeTtcblxuXHRcdC8vIE9wZW4gV2luZG93c1xuXHRcdGF3YWl0IGFwcEluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHRoaXMub3BlbkZpcnN0V2luZG93KGFjY2Vzc29yLCBpbml0aWFsUHJvdG9jb2xVcmxzKSk7XG5cblx0XHQvLyBTaWduYWwgcGhhc2U6IGFmdGVyIHdpbmRvdyBvcGVuXG5cdFx0dGhpcy5saWZlY3ljbGVNYWluU2VydmljZS5waGFzZSA9IExpZmVjeWNsZU1haW5QaGFzZS5BZnRlcldpbmRvd09wZW47XG5cblx0XHQvLyBQb3N0IE9wZW4gV2luZG93cyBUYXNrc1xuXHRcdHRoaXMuYWZ0ZXJXaW5kb3dPcGVuKCk7XG5cblx0XHQvLyBTZXQgbGlmZWN5Y2xlIHBoYXNlIHRvIGBFdmVudHVhbGx5YCBhZnRlciBhIHNob3J0IGRlbGF5IGFuZCB3aGVuIGlkbGUgKG1pbiAyLjVzZWMsIG1heCA1c2VjKVxuXHRcdGNvbnN0IGV2ZW50dWFsbHlQaGFzZVNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHJ1bldoZW5HbG9iYWxJZGxlKCgpID0+IHtcblxuXHRcdFx0XHQvLyBTaWduYWwgcGhhc2U6IGV2ZW50dWFsbHlcblx0XHRcdFx0dGhpcy5saWZlY3ljbGVNYWluU2VydmljZS5waGFzZSA9IExpZmVjeWNsZU1haW5QaGFzZS5FdmVudHVhbGx5O1xuXG5cdFx0XHRcdC8vIEV2ZW50dWFsbHkgUG9zdCBPcGVuIFdpbmRvdyBUYXNrc1xuXHRcdFx0XHR0aGlzLmV2ZW50dWFsbHlBZnRlcldpbmRvd09wZW4oKTtcblx0XHRcdH0sIDI1MDApKTtcblx0XHR9LCAyNTAwKSk7XG5cdFx0ZXZlbnR1YWxseVBoYXNlU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNldHVwUHJvdG9jb2xVcmxIYW5kbGVycyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgbWFpblByb2Nlc3NFbGVjdHJvblNlcnZlcjogRWxlY3Ryb25JUENTZXJ2ZXIpOiBQcm9taXNlPElJbml0aWFsUHJvdG9jb2xVcmxzIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgd2luZG93c01haW5TZXJ2aWNlID0gdGhpcy53aW5kb3dzTWFpblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdpbmRvd3NNYWluU2VydmljZSk7XG5cdFx0Y29uc3QgdXJsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVVJMU2VydmljZSk7XG5cdFx0Y29uc3QgbmF0aXZlSG9zdE1haW5TZXJ2aWNlID0gdGhpcy5uYXRpdmVIb3N0TWFpblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5hdGl2ZUhvc3RNYWluU2VydmljZSk7XG5cdFx0Y29uc3QgZGlhbG9nTWFpblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ01haW5TZXJ2aWNlKTtcblxuXHRcdC8vIEluc3RhbGwgVVJMIGhhbmRsZXJzIHRoYXQgZGVhbCB3aXRoIHByb3RvY2wgVVJMcyBlaXRoZXJcblx0XHQvLyBmcm9tIHRoaXMgcHJvY2VzcyBieSBvcGVuaW5nIHdpbmRvd3MgYW5kL29yIGJ5IGZvcndhcmRpbmdcblx0XHQvLyB0aGUgVVJMcyBpbnRvIGEgd2luZG93IHByb2Nlc3MgdG8gYmUgaGFuZGxlZCB0aGVyZS5cblxuXHRcdGNvbnN0IGFwcCA9IHRoaXM7XG5cdFx0dXJsU2VydmljZS5yZWdpc3RlckhhbmRsZXIoe1xuXHRcdFx0YXN5bmMgaGFuZGxlVVJMKHVyaTogVVJJLCBvcHRpb25zPzogSU9wZW5VUkxPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0XHRcdHJldHVybiBhcHAuaGFuZGxlUHJvdG9jb2xVcmwod2luZG93c01haW5TZXJ2aWNlLCBkaWFsb2dNYWluU2VydmljZSwgdXJsU2VydmljZSwgdXJpLCBvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGFjdGl2ZVdpbmRvd01hbmFnZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aXZlV2luZG93TWFuYWdlcih7XG5cdFx0XHRvbkRpZE9wZW5NYWluV2luZG93OiBuYXRpdmVIb3N0TWFpblNlcnZpY2Uub25EaWRPcGVuTWFpbldpbmRvdyxcblx0XHRcdG9uRGlkRm9jdXNNYWluV2luZG93OiBuYXRpdmVIb3N0TWFpblNlcnZpY2Uub25EaWRGb2N1c01haW5XaW5kb3csXG5cdFx0XHRnZXRBY3RpdmVXaW5kb3dJZDogKCkgPT4gbmF0aXZlSG9zdE1haW5TZXJ2aWNlLmdldEFjdGl2ZVdpbmRvd0lkKC0xKVxuXHRcdH0pKTtcblx0XHRjb25zdCBhY3RpdmVXaW5kb3dSb3V0ZXIgPSBuZXcgU3RhdGljUm91dGVyKGN0eCA9PiBhY3RpdmVXaW5kb3dNYW5hZ2VyLmdldEFjdGl2ZUNsaWVudElkKCkudGhlbihpZCA9PiBjdHggPT09IGlkKSk7XG5cdFx0Y29uc3QgdXJsSGFuZGxlclJvdXRlciA9IG5ldyBVUkxIYW5kbGVyUm91dGVyKGFjdGl2ZVdpbmRvd1JvdXRlciwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRjb25zdCB1cmxIYW5kbGVyQ2hhbm5lbCA9IG1haW5Qcm9jZXNzRWxlY3Ryb25TZXJ2ZXIuZ2V0Q2hhbm5lbCgndXJsSGFuZGxlcicsIHVybEhhbmRsZXJSb3V0ZXIpO1xuXHRcdHVybFNlcnZpY2UucmVnaXN0ZXJIYW5kbGVyKG5ldyBVUkxIYW5kbGVyQ2hhbm5lbENsaWVudCh1cmxIYW5kbGVyQ2hhbm5lbCkpO1xuXG5cdFx0Y29uc3QgaW5pdGlhbFByb3RvY29sVXJscyA9IGF3YWl0IHRoaXMucmVzb2x2ZUluaXRpYWxQcm90b2NvbFVybHMod2luZG93c01haW5TZXJ2aWNlLCBkaWFsb2dNYWluU2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobmV3IEVsZWN0cm9uVVJMTGlzdGVuZXIoaW5pdGlhbFByb3RvY29sVXJscz8udXJscywgdXJsU2VydmljZSwgd2luZG93c01haW5TZXJ2aWNlLCB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UsIHRoaXMucHJvZHVjdFNlcnZpY2UsIHRoaXMubG9nU2VydmljZSkpO1xuXG5cdFx0cmV0dXJuIGluaXRpYWxQcm90b2NvbFVybHM7XG5cdH1cblxuXHRwcml2YXRlIHNldHVwTWFuYWdlZFJlbW90ZVJlc291cmNlVXJsSGFuZGxlcihtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyOiBFbGVjdHJvbklQQ1NlcnZlcikge1xuXHRcdGNvbnN0IG5vdEZvdW5kID0gKCk6IEVsZWN0cm9uLlByb3RvY29sUmVzcG9uc2UgPT4gKHsgc3RhdHVzQ29kZTogNDA0LCBkYXRhOiAnTm90IGZvdW5kJyB9KTtcblx0XHRjb25zdCByZW1vdGVSZXNvdXJjZUNoYW5uZWwgPSBuZXcgTGF6eSgoKSA9PiBtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLmdldENoYW5uZWwoXG5cdFx0XHROT0RFX1JFTU9URV9SRVNPVVJDRV9DSEFOTkVMX05BTUUsXG5cdFx0XHRuZXcgTm9kZVJlbW90ZVJlc291cmNlUm91dGVyKCksXG5cdFx0KSk7XG5cblx0XHRwcm90b2NvbC5yZWdpc3RlckJ1ZmZlclByb3RvY29sKFNjaGVtYXMudnNjb2RlTWFuYWdlZFJlbW90ZVJlc291cmNlLCAocmVxdWVzdCwgY2FsbGJhY2spID0+IHtcblx0XHRcdGNvbnN0IHVybCA9IFVSSS5wYXJzZShyZXF1ZXN0LnVybCk7XG5cdFx0XHRpZiAoIXVybC5hdXRob3JpdHkuc3RhcnRzV2l0aCgnd2luZG93OicpKSB7XG5cdFx0XHRcdHJldHVybiBjYWxsYmFjayhub3RGb3VuZCgpKTtcblx0XHRcdH1cblxuXHRcdFx0cmVtb3RlUmVzb3VyY2VDaGFubmVsLnZhbHVlLmNhbGw8Tm9kZVJlbW90ZVJlc291cmNlUmVzcG9uc2U+KE5PREVfUkVNT1RFX1JFU09VUkNFX0lQQ19NRVRIT0RfTkFNRSwgW3VybF0pLnRoZW4oXG5cdFx0XHRcdHIgPT4gY2FsbGJhY2soeyAuLi5yLCBkYXRhOiBCdWZmZXIuZnJvbShyLmJvZHksICdiYXNlNjQnKSB9KSxcblx0XHRcdFx0ZXJyID0+IHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybignZXJyb3IgZGlzcGF0Y2hpbmcgcmVtb3RlIHJlc291cmNlIGNhbGwnLCBlcnIpO1xuXHRcdFx0XHRcdGNhbGxiYWNrKHsgc3RhdHVzQ29kZTogNTAwLCBkYXRhOiBTdHJpbmcoZXJyKSB9KTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlc29sdmVJbml0aWFsUHJvdG9jb2xVcmxzKHdpbmRvd3NNYWluU2VydmljZTogSVdpbmRvd3NNYWluU2VydmljZSwgZGlhbG9nTWFpblNlcnZpY2U6IElEaWFsb2dNYWluU2VydmljZSk6IFByb21pc2U8SUluaXRpYWxQcm90b2NvbFVybHMgfCB1bmRlZmluZWQ+IHtcblxuXHRcdC8qKlxuXHRcdCAqIFByb3RvY29sIFVSTCBoYW5kbGluZyBvbiBzdGFydHVwIGlzIGNvbXBsZXgsIHJlZmVyIHRvXG5cdFx0ICoge0BsaW5rIElJbml0aWFsUHJvdG9jb2xVcmxzfSBmb3IgYW4gZXhwbGFpbmVyLlxuXHRcdCAqL1xuXG5cdFx0Ly8gV2luZG93cy9MaW51eDogcHJvdG9jb2wgaGFuZGxlciBpbnZva2VzIENMSSB3aXRoIC0tb3Blbi11cmxcblx0XHRjb25zdCBwcm90b2NvbFVybHNGcm9tQ29tbWFuZExpbmUgPSB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXJnc1snb3Blbi11cmwnXSA/IHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmdzLl91cmxzIHx8IFtdIDogW107XG5cdFx0aWYgKHByb3RvY29sVXJsc0Zyb21Db21tYW5kTGluZS5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ2FwcCNyZXNvbHZlSW5pdGlhbFByb3RvY29sVXJscygpIHByb3RvY29sIHVybHMgZnJvbSBjb21tYW5kIGxpbmU6JywgcHJvdG9jb2xVcmxzRnJvbUNvbW1hbmRMaW5lKTtcblx0XHR9XG5cblx0XHQvLyBtYWNPUzogb3Blbi11cmwgZXZlbnRzIHRoYXQgd2VyZSByZWNlaXZlZCBiZWZvcmUgdGhlIGFwcCBpcyByZWFkeVxuXHRcdGNvbnN0IHByb3RvY29sVXJsc0Zyb21FdmVudCA9ICgoPGFueT5nbG9iYWwpLmdldE9wZW5VcmxzKCkgfHwgW10pIGFzIHN0cmluZ1tdO1xuXHRcdGlmIChwcm90b2NvbFVybHNGcm9tRXZlbnQubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBhcHAjcmVzb2x2ZUluaXRpYWxQcm90b2NvbFVybHMoKSBwcm90b2NvbCB1cmxzIGZyb20gbWFjT1MgJ29wZW4tdXJsJyBldmVudDpgLCBwcm90b2NvbFVybHNGcm9tRXZlbnQpO1xuXHRcdH1cblxuXHRcdGlmIChwcm90b2NvbFVybHNGcm9tQ29tbWFuZExpbmUubGVuZ3RoICsgcHJvdG9jb2xVcmxzRnJvbUV2ZW50Lmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBwcm90b2NvbFVybHMgPSBbXG5cdFx0XHQuLi5wcm90b2NvbFVybHNGcm9tQ29tbWFuZExpbmUsXG5cdFx0XHQuLi5wcm90b2NvbFVybHNGcm9tRXZlbnRcblx0XHRdLm1hcCh1cmwgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIHsgdXJpOiBVUkkucGFyc2UodXJsKSwgb3JpZ2luYWxVcmw6IHVybCB9O1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnYXBwI3Jlc29sdmVJbml0aWFsUHJvdG9jb2xVcmxzKCkgcHJvdG9jb2wgdXJsIGZhaWxlZCB0byBwYXJzZTonLCB1cmwpO1xuXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBvcGVuYWJsZXM6IElXaW5kb3dPcGVuYWJsZVtdID0gW107XG5cdFx0Y29uc3QgdXJsczogSVByb3RvY29sVXJsW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHByb3RvY29sVXJsIG9mIHByb3RvY29sVXJscykge1xuXHRcdFx0aWYgKCFwcm90b2NvbFVybCkge1xuXHRcdFx0XHRjb250aW51ZTsgLy8gaW52YWxpZFxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB3aW5kb3dPcGVuYWJsZSA9IHRoaXMuZ2V0V2luZG93T3BlbmFibGVGcm9tUHJvdG9jb2xVcmwocHJvdG9jb2xVcmwudXJpKTtcblx0XHRcdGlmICh3aW5kb3dPcGVuYWJsZSkge1xuXHRcdFx0XHRpZiAoYXdhaXQgdGhpcy5zaG91bGRCbG9ja09wZW5hYmxlKHdpbmRvd09wZW5hYmxlLCB3aW5kb3dzTWFpblNlcnZpY2UsIGRpYWxvZ01haW5TZXJ2aWNlKSkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnYXBwI3Jlc29sdmVJbml0aWFsUHJvdG9jb2xVcmxzKCkgcHJvdG9jb2wgdXJsIHdhcyBibG9ja2VkOicsIHByb3RvY29sVXJsLnVyaS50b1N0cmluZyh0cnVlKSk7XG5cblx0XHRcdFx0XHRjb250aW51ZTsgLy8gYmxvY2tlZFxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnYXBwI3Jlc29sdmVJbml0aWFsUHJvdG9jb2xVcmxzKCkgcHJvdG9jb2wgdXJsIHdpbGwgYmUgaGFuZGxlZCBhcyB3aW5kb3cgdG8gb3BlbjonLCBwcm90b2NvbFVybC51cmkudG9TdHJpbmcodHJ1ZSksIHdpbmRvd09wZW5hYmxlKTtcblxuXHRcdFx0XHRcdG9wZW5hYmxlcy5wdXNoKHdpbmRvd09wZW5hYmxlKTsgLy8gaGFuZGxlZCBhcyB3aW5kb3cgdG8gb3BlblxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ2FwcCNyZXNvbHZlSW5pdGlhbFByb3RvY29sVXJscygpIHByb3RvY29sIHVybCB3aWxsIGJlIHBhc3NlZCB0byBhY3RpdmUgd2luZG93IGZvciBoYW5kbGluZzonLCBwcm90b2NvbFVybC51cmkudG9TdHJpbmcodHJ1ZSkpO1xuXG5cdFx0XHRcdHVybHMucHVzaChwcm90b2NvbFVybCk7IC8vIGhhbmRsZWQgd2l0aGluIGFjdGl2ZSB3aW5kb3dcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyB1cmxzLCBvcGVuYWJsZXMgfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2hvdWxkQmxvY2tPcGVuYWJsZShvcGVuYWJsZTogSVdpbmRvd09wZW5hYmxlLCB3aW5kb3dzTWFpblNlcnZpY2U6IElXaW5kb3dzTWFpblNlcnZpY2UsIGRpYWxvZ01haW5TZXJ2aWNlOiBJRGlhbG9nTWFpblNlcnZpY2UpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRsZXQgb3BlbmFibGVVcmk6IFVSSTtcblx0XHRsZXQgbWVzc2FnZTogc3RyaW5nO1xuXHRcdGlmIChpc1dvcmtzcGFjZVRvT3BlbihvcGVuYWJsZSkpIHtcblx0XHRcdG9wZW5hYmxlVXJpID0gb3BlbmFibGUud29ya3NwYWNlVXJpO1xuXHRcdFx0bWVzc2FnZSA9IGxvY2FsaXplKCdjb25maXJtT3Blbk1lc3NhZ2VXb3Jrc3BhY2UnLCBcIkFuIGV4dGVybmFsIGFwcGxpY2F0aW9uIHdhbnRzIHRvIG9wZW4gJ3swfScgaW4gezF9LiBEbyB5b3Ugd2FudCB0byBvcGVuIHRoaXMgd29ya3NwYWNlIGZpbGU/XCIsIG9wZW5hYmxlVXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlID8gZ2V0UGF0aExhYmVsKG9wZW5hYmxlVXJpLCB7IG9zOiBPUywgdGlsZGlmeTogdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlIH0pIDogb3BlbmFibGVVcmkudG9TdHJpbmcodHJ1ZSksIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZVNob3J0KTtcblx0XHR9IGVsc2UgaWYgKGlzRm9sZGVyVG9PcGVuKG9wZW5hYmxlKSkge1xuXHRcdFx0b3BlbmFibGVVcmkgPSBvcGVuYWJsZS5mb2xkZXJVcmk7XG5cdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoJ2NvbmZpcm1PcGVuTWVzc2FnZUZvbGRlcicsIFwiQW4gZXh0ZXJuYWwgYXBwbGljYXRpb24gd2FudHMgdG8gb3BlbiAnezB9JyBpbiB7MX0uIERvIHlvdSB3YW50IHRvIG9wZW4gdGhpcyBmb2xkZXI/XCIsIG9wZW5hYmxlVXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlID8gZ2V0UGF0aExhYmVsKG9wZW5hYmxlVXJpLCB7IG9zOiBPUywgdGlsZGlmeTogdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlIH0pIDogb3BlbmFibGVVcmkudG9TdHJpbmcodHJ1ZSksIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZVNob3J0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3BlbmFibGVVcmkgPSBvcGVuYWJsZS5maWxlVXJpO1xuXHRcdFx0bWVzc2FnZSA9IGxvY2FsaXplKCdjb25maXJtT3Blbk1lc3NhZ2VGaWxlT3JGb2xkZXInLCBcIkFuIGV4dGVybmFsIGFwcGxpY2F0aW9uIHdhbnRzIHRvIG9wZW4gJ3swfScgaW4gezF9LiBEbyB5b3Ugd2FudCB0byBvcGVuIHRoaXMgZmlsZSBvciBmb2xkZXI/XCIsIG9wZW5hYmxlVXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlID8gZ2V0UGF0aExhYmVsKG9wZW5hYmxlVXJpLCB7IG9zOiBPUywgdGlsZGlmeTogdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlIH0pIDogb3BlbmFibGVVcmkudG9TdHJpbmcodHJ1ZSksIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZVNob3J0KTtcblx0XHR9XG5cblx0XHRpZiAob3BlbmFibGVVcmkuc2NoZW1lICE9PSBTY2hlbWFzLmZpbGUgJiYgb3BlbmFibGVVcmkuc2NoZW1lICE9PSBTY2hlbWFzLnZzY29kZVJlbW90ZSkge1xuXG5cdFx0XHQvLyAhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhXG5cdFx0XHQvL1xuXHRcdFx0Ly8gTk9URTogd2UgY3VycmVudGx5IG9ubHkgYXNrIGZvciBjb25maXJtYXRpb24gZm9yIGBmaWxlYCBhbmQgYHZzY29kZS1yZW1vdGVgXG5cdFx0XHQvLyBhdXRob3JpdGllcyBoZXJlLiBUaGVyZSBpcyBhbiBhZGRpdGlvbmFsIGNvbmZpcm1hdGlvbiBmb3IgYGV4dGVuc2lvbi5pZGBcblx0XHRcdC8vIGF1dGhvcml0aWVzIGZyb20gd2l0aGluIHRoZSB3aW5kb3cuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gSUYgWU9VIEFSRSBQTEFOTklORyBPTiBBRERJTkcgQU5PVEhFUiBBVVRIT1JJVFkgSEVSRSwgTUFLRSBTVVJFIFRPIEFMU09cblx0XHRcdC8vIEFERCBJVCBUTyBUSEUgQ09ORklSTUFUSU9OIENPREUgQkVMT1cgT1IgSU5TSURFIFRIRSBXSU5ET1chXG5cdFx0XHQvL1xuXHRcdFx0Ly8gISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIVxuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXNrRm9yQ29uZmlybWF0aW9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTx1bmtub3duPihDb2RlQXBwbGljYXRpb24uU0VDVVJJVFlfUFJPVE9DT0xfSEFORExJTkdfQ09ORklSTUFUSU9OX1NFVFRJTkdfS0VZW29wZW5hYmxlVXJpLnNjaGVtZV0pO1xuXHRcdGlmIChhc2tGb3JDb25maXJtYXRpb24gPT09IGZhbHNlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIG5vdCBibG9ja2VkIHZpYSBzZXR0aW5nc1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgcmVzcG9uc2UsIGNoZWNrYm94Q2hlY2tlZCB9ID0gYXdhaXQgZGlhbG9nTWFpblNlcnZpY2Uuc2hvd01lc3NhZ2VCb3goe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0YnV0dG9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSh7IGtleTogJ29wZW4nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZZZXNcIiksXG5cdFx0XHRcdGxvY2FsaXplKHsga2V5OiAnY2FuY2VsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmTm9cIilcblx0XHRcdF0sXG5cdFx0XHRtZXNzYWdlLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnY29uZmlybU9wZW5EZXRhaWwnLCBcIklmIHlvdSBkaWQgbm90IGluaXRpYXRlIHRoaXMgcmVxdWVzdCwgaXQgbWF5IHJlcHJlc2VudCBhbiBhdHRlbXB0ZWQgYXR0YWNrIG9uIHlvdXIgc3lzdGVtLiBVbmxlc3MgeW91IHRvb2sgYW4gZXhwbGljaXQgYWN0aW9uIHRvIGluaXRpYXRlIHRoaXMgcmVxdWVzdCwgeW91IHNob3VsZCBwcmVzcyAnTm8nXCIpLFxuXHRcdFx0Y2hlY2tib3hMYWJlbDogb3BlbmFibGVVcmkuc2NoZW1lID09PSBTY2hlbWFzLmZpbGUgPyBsb2NhbGl6ZSgnZG9Ob3RBc2tBZ2FpbkxvY2FsJywgXCJBbGxvdyBvcGVuaW5nIGxvY2FsIHBhdGhzIHdpdGhvdXQgYXNraW5nXCIpIDogbG9jYWxpemUoJ2RvTm90QXNrQWdhaW5SZW1vdGUnLCBcIkFsbG93IG9wZW5pbmcgcmVtb3RlIHBhdGhzIHdpdGhvdXQgYXNraW5nXCIpLFxuXHRcdFx0Y2FuY2VsSWQ6IDFcblx0XHR9KTtcblxuXHRcdGlmIChyZXNwb25zZSAhPT0gMCkge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIGJsb2NrZWQgYnkgdXNlciBjaG9pY2Vcblx0XHR9XG5cblx0XHRpZiAoY2hlY2tib3hDaGVja2VkKSB7XG5cdFx0XHQvLyBEdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE5NTQzNiwgd2UgY2FuIG9ubHlcblx0XHRcdC8vIHVwZGF0ZSBzZXR0aW5ncyBmcm9tIHdpdGhpbiBhIHdpbmRvdy4gQnV0IHdlIGRvIG5vdCBrbm93IGlmIGEgd2luZG93XG5cdFx0XHQvLyBpcyBhYm91dCB0byBvcGVuIG9yIGNhbiBhbHJlYWR5IGhhbmRsZSB0aGUgcmVxdWVzdCwgc28gd2UgaGF2ZSB0byBzZW5kXG5cdFx0XHQvLyB0byBhbnkgY3VycmVudCB3aW5kb3cgYW5kIGFueSBuZXdseSBvcGVuaW5nIHdpbmRvdy5cblx0XHRcdGNvbnN0IHJlcXVlc3QgPSB7IGNoYW5uZWw6ICd2c2NvZGU6ZGlzYWJsZVByb21wdEZvclByb3RvY29sSGFuZGxpbmcnLCBhcmdzOiBvcGVuYWJsZVVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSA/ICdsb2NhbCcgOiAncmVtb3RlJyB9O1xuXHRcdFx0d2luZG93c01haW5TZXJ2aWNlLnNlbmRUb0ZvY3VzZWQocmVxdWVzdC5jaGFubmVsLCByZXF1ZXN0LmFyZ3MpO1xuXHRcdFx0d2luZG93c01haW5TZXJ2aWNlLnNlbmRUb09wZW5pbmdXaW5kb3cocmVxdWVzdC5jaGFubmVsLCByZXF1ZXN0LmFyZ3MpO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTsgLy8gbm90IGJsb2NrZWQgYnkgdXNlciBjaG9pY2Vcblx0fVxuXG5cdHByaXZhdGUgZ2V0V2luZG93T3BlbmFibGVGcm9tUHJvdG9jb2xVcmwodXJpOiBVUkkpOiBJV2luZG93T3BlbmFibGUgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdXJpLnBhdGgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gRmlsZSBwYXRoXG5cdFx0aWYgKHVyaS5hdXRob3JpdHkgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0Y29uc3QgZmlsZVVyaSA9IFVSSS5maWxlKHVyaS5mc1BhdGgpO1xuXG5cdFx0XHRpZiAoaGFzV29ya3NwYWNlRmlsZUV4dGVuc2lvbihmaWxlVXJpKSkge1xuXHRcdFx0XHRyZXR1cm4geyB3b3Jrc3BhY2VVcmk6IGZpbGVVcmkgfTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHsgZmlsZVVyaSB9O1xuXHRcdH1cblxuXHRcdC8vIFJlbW90ZSBwYXRoXG5cdFx0ZWxzZSBpZiAodXJpLmF1dGhvcml0eSA9PT0gU2NoZW1hcy52c2NvZGVSZW1vdGUpIHtcblxuXHRcdFx0Ly8gRXhhbXBsZSBjb252ZXJzaW9uOlxuXHRcdFx0Ly8gRnJvbTogdnNjb2RlOi8vdnNjb2RlLXJlbW90ZS93c2wrdWJ1bnR1L21udC9jL0dpdERldmVsb3BtZW50L21vbmFjb1xuXHRcdFx0Ly8gICBUbzogdnNjb2RlLXJlbW90ZTovL3dzbCt1YnVudHUvbW50L2MvR2l0RGV2ZWxvcG1lbnQvbW9uYWNvXG5cblx0XHRcdGNvbnN0IHNlY29uZFNsYXNoID0gdXJpLnBhdGguaW5kZXhPZihwb3NpeC5zZXAsIDEgLyogc2tpcCBvdmVyIHRoZSBsZWFkaW5nIHNsYXNoICovKTtcblx0XHRcdGxldCBhdXRob3JpdHk6IHN0cmluZztcblx0XHRcdGxldCBwYXRoOiBzdHJpbmc7XG5cdFx0XHRpZiAoc2Vjb25kU2xhc2ggIT09IC0xKSB7XG5cdFx0XHRcdGF1dGhvcml0eSA9IHVyaS5wYXRoLnN1YnN0cmluZygxLCBzZWNvbmRTbGFzaCk7XG5cdFx0XHRcdHBhdGggPSB1cmkucGF0aC5zdWJzdHJpbmcoc2Vjb25kU2xhc2gpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXV0aG9yaXR5ID0gdXJpLnBhdGguc3Vic3RyaW5nKDEpO1xuXHRcdFx0XHRwYXRoID0gJy8nO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgcXVlcnkgPSB1cmkucXVlcnk7XG5cdFx0XHRjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHVyaS5xdWVyeSk7XG5cdFx0XHRpZiAocGFyYW1zLmdldCgnd2luZG93SWQnKSA9PT0gJ19ibGFuaycpIHtcblx0XHRcdFx0Ly8gTWFrZSBzdXJlIHRvIHVuc2V0IGFueSBgd2luZG93SWQ9X2JsYW5rYCBoZXJlXG5cdFx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xOTE5MDJcblx0XHRcdFx0cGFyYW1zLmRlbGV0ZSgnd2luZG93SWQnKTtcblx0XHRcdFx0cXVlcnkgPSBwYXJhbXMudG9TdHJpbmcoKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVtb3RlVXJpID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudnNjb2RlUmVtb3RlLCBhdXRob3JpdHksIHBhdGgsIHF1ZXJ5LCBmcmFnbWVudDogdXJpLmZyYWdtZW50IH0pO1xuXG5cdFx0XHRpZiAoaGFzV29ya3NwYWNlRmlsZUV4dGVuc2lvbihwYXRoKSkge1xuXHRcdFx0XHRyZXR1cm4geyB3b3Jrc3BhY2VVcmk6IHJlbW90ZVVyaSB9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoLzpbXFxkXSskLy50ZXN0KHBhdGgpKSB7XG5cdFx0XHRcdC8vIHBhdGggd2l0aCA6bGluZTpjb2x1bW4gc3ludGF4XG5cdFx0XHRcdHJldHVybiB7IGZpbGVVcmk6IHJlbW90ZVVyaSB9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4geyBmb2xkZXJVcmk6IHJlbW90ZVVyaSB9O1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVQcm90b2NvbFVybCh3aW5kb3dzTWFpblNlcnZpY2U6IElXaW5kb3dzTWFpblNlcnZpY2UsIGRpYWxvZ01haW5TZXJ2aWNlOiBJRGlhbG9nTWFpblNlcnZpY2UsIHVybFNlcnZpY2U6IElVUkxTZXJ2aWNlLCB1cmk6IFVSSSwgb3B0aW9ucz86IElPcGVuVVJMT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnYXBwI2hhbmRsZVByb3RvY29sVXJsKCk6JywgdXJpLnRvU3RyaW5nKHRydWUpLCBvcHRpb25zKTtcblxuXHRcdC8vIFN1cHBvcnQgJ3dvcmtzcGFjZScgVVJMcyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEyNDI2Mylcblx0XHRpZiAodXJpLnNjaGVtZSA9PT0gdGhpcy5wcm9kdWN0U2VydmljZS51cmxQcm90b2NvbCAmJiB1cmkucGF0aCA9PT0gJ3dvcmtzcGFjZScpIHtcblx0XHRcdHVyaSA9IHVyaS53aXRoKHtcblx0XHRcdFx0YXV0aG9yaXR5OiAnZmlsZScsXG5cdFx0XHRcdHBhdGg6IFVSSS5wYXJzZSh1cmkucXVlcnkpLnBhdGgsXG5cdFx0XHRcdHF1ZXJ5OiAnJ1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0bGV0IHNob3VsZE9wZW5Jbk5ld1dpbmRvdyA9IGZhbHNlO1xuXG5cdFx0Ly8gV2Ugc2hvdWxkIGhhbmRsZSB0aGUgVVJJIGluIGEgbmV3IHdpbmRvdyBpZiB0aGUgVVJMIGNvbnRhaW5zIGB3aW5kb3dJZD1fYmxhbmtgXG5cdFx0Y29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh1cmkucXVlcnkpO1xuXHRcdGlmIChwYXJhbXMuZ2V0KCd3aW5kb3dJZCcpID09PSAnX2JsYW5rJykge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBhcHAjaGFuZGxlUHJvdG9jb2xVcmwoKSBmb3VuZCAnd2luZG93SWQ9X2JsYW5rJyBhcyBwYXJhbWV0ZXIsIHNldHRpbmcgc2hvdWxkT3BlbkluTmV3V2luZG93PXRydWU6YCwgdXJpLnRvU3RyaW5nKHRydWUpKTtcblxuXHRcdFx0cGFyYW1zLmRlbGV0ZSgnd2luZG93SWQnKTtcblx0XHRcdHVyaSA9IHVyaS53aXRoKHsgcXVlcnk6IHBhcmFtcy50b1N0cmluZygpIH0pO1xuXG5cdFx0XHRzaG91bGRPcGVuSW5OZXdXaW5kb3cgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIG9yIGlmIG5vIHdpbmRvdyBpcyBvcGVuIChtYWNPUyBvbmx5KVxuXHRcdGVsc2UgaWYgKGlzTWFjaW50b3NoICYmIHdpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dDb3VudCgpID09PSAwKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYGFwcCNoYW5kbGVQcm90b2NvbFVybCgpIHJ1bm5pbmcgb24gbWFjT1Mgd2l0aCBubyB3aW5kb3cgb3Blbiwgc2V0dGluZyBzaG91bGRPcGVuSW5OZXdXaW5kb3c9dHJ1ZTpgLCB1cmkudG9TdHJpbmcodHJ1ZSkpO1xuXG5cdFx0XHRzaG91bGRPcGVuSW5OZXdXaW5kb3cgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIFBhc3MgYWxvbmcgd2hldGhlciB0aGUgYXBwbGljYXRpb24gaXMgYmVpbmcgb3BlbmVkIHZpYSBhIENvbnRpbnVlIE9uIGZsb3dcblx0XHRjb25zdCBjb250aW51ZU9uID0gcGFyYW1zLmdldCgnY29udGludWVPbicpO1xuXHRcdGlmIChjb250aW51ZU9uICE9PSBudWxsKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYGFwcCNoYW5kbGVQcm90b2NvbFVybCgpIGZvdW5kICdjb250aW51ZU9uJyBhcyBwYXJhbWV0ZXI6YCwgdXJpLnRvU3RyaW5nKHRydWUpKTtcblxuXHRcdFx0cGFyYW1zLmRlbGV0ZSgnY29udGludWVPbicpO1xuXHRcdFx0dXJpID0gdXJpLndpdGgoeyBxdWVyeTogcGFyYW1zLnRvU3RyaW5nKCkgfSk7XG5cblx0XHRcdHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5jb250aW51ZU9uID0gY29udGludWVPbiA/PyB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgaWYgdGhlIHByb3RvY29sIFVSTCBpcyBhIHdpbmRvdyBvcGVuYWJsZSB0byBvcGVuLi4uXG5cdFx0Y29uc3Qgd2luZG93T3BlbmFibGVGcm9tUHJvdG9jb2xVcmwgPSB0aGlzLmdldFdpbmRvd09wZW5hYmxlRnJvbVByb3RvY29sVXJsKHVyaSk7XG5cdFx0aWYgKHdpbmRvd09wZW5hYmxlRnJvbVByb3RvY29sVXJsKSB7XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5zaG91bGRCbG9ja09wZW5hYmxlKHdpbmRvd09wZW5hYmxlRnJvbVByb3RvY29sVXJsLCB3aW5kb3dzTWFpblNlcnZpY2UsIGRpYWxvZ01haW5TZXJ2aWNlKSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ2FwcCNoYW5kbGVQcm90b2NvbFVybCgpIHByb3RvY29sIHVybCB3YXMgYmxvY2tlZDonLCB1cmkudG9TdHJpbmcodHJ1ZSkpO1xuXG5cdFx0XHRcdHJldHVybiB0cnVlOyAvLyBJZiBvcGVuYWJsZSBzaG91bGQgYmUgYmxvY2tlZCwgYmVoYXZlIGFzIGlmIGl0J3MgaGFuZGxlZFxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdhcHAjaGFuZGxlUHJvdG9jb2xVcmwoKSBvcGVuaW5nIHByb3RvY29sIHVybCBhcyB3aW5kb3c6Jywgd2luZG93T3BlbmFibGVGcm9tUHJvdG9jb2xVcmwsIHVyaS50b1N0cmluZyh0cnVlKSk7XG5cblx0XHRcdFx0Y29uc3Qgd2luZG93ID0gKGF3YWl0IHdpbmRvd3NNYWluU2VydmljZS5vcGVuKHtcblx0XHRcdFx0XHRjb250ZXh0OiBPcGVuQ29udGV4dC5MSU5LLFxuXHRcdFx0XHRcdGNsaTogeyAuLi50aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXJncyB9LFxuXHRcdFx0XHRcdHVyaXNUb09wZW46IFt3aW5kb3dPcGVuYWJsZUZyb21Qcm90b2NvbFVybF0sXG5cdFx0XHRcdFx0Zm9yY2VOZXdXaW5kb3c6IHNob3VsZE9wZW5Jbk5ld1dpbmRvdyxcblx0XHRcdFx0XHRnb3RvTGluZU1vZGU6IHRydWVcblx0XHRcdFx0XHQvLyByZW1vdGVBdXRob3JpdHk6IHdpbGwgYmUgZGV0ZXJtaW5lZCBiYXNlZCBvbiB3aW5kb3dPcGVuYWJsZUZyb21Qcm90b2NvbFVybFxuXHRcdFx0XHR9KSkuYXQoMCk7XG5cblx0XHRcdFx0d2luZG93Py5mb2N1cygpOyAvLyB0aGlzIHNob3VsZCBoZWxwIGVuc3VyaW5nIHRoYXQgdGhlIHJpZ2h0IHdpbmRvdyBnZXRzIGZvY3VzIHdoZW4gbXVsdGlwbGUgYXJlIG9wZW5lZFxuXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIC4uLm9yIGlmIHdlIHNob3VsZCBvcGVuIGluIGEgbmV3IHdpbmRvdyBhbmQgdGhlbiBoYW5kbGUgaXQgd2l0aGluIHRoYXQgd2luZG93XG5cdFx0aWYgKHNob3VsZE9wZW5Jbk5ld1dpbmRvdykge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdhcHAjaGFuZGxlUHJvdG9jb2xVcmwoKSBvcGVuaW5nIGVtcHR5IHdpbmRvdyBhbmQgcGFzc2luZyBpbiBwcm90b2NvbCB1cmw6JywgdXJpLnRvU3RyaW5nKHRydWUpKTtcblxuXHRcdFx0Y29uc3Qgd2luZG93ID0gKGF3YWl0IHdpbmRvd3NNYWluU2VydmljZS5vcGVuKHtcblx0XHRcdFx0Y29udGV4dDogT3BlbkNvbnRleHQuTElOSyxcblx0XHRcdFx0Y2xpOiB7IC4uLnRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmdzIH0sXG5cdFx0XHRcdGZvcmNlTmV3V2luZG93OiB0cnVlLFxuXHRcdFx0XHRmb3JjZUVtcHR5OiB0cnVlLFxuXHRcdFx0XHRnb3RvTGluZU1vZGU6IHRydWUsXG5cdFx0XHRcdHJlbW90ZUF1dGhvcml0eTogZ2V0UmVtb3RlQXV0aG9yaXR5KHVyaSlcblx0XHRcdH0pKS5hdCgwKTtcblxuXHRcdFx0YXdhaXQgd2luZG93Py5yZWFkeSgpO1xuXG5cdFx0XHRyZXR1cm4gdXJsU2VydmljZS5vcGVuKHVyaSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdhcHAjaGFuZGxlUHJvdG9jb2xVcmwoKTogbm90IGhhbmRsZWQnLCB1cmkudG9TdHJpbmcodHJ1ZSksIG9wdGlvbnMpO1xuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXR1cFNoYXJlZFByb2Nlc3MobWFjaGluZUlkOiBzdHJpbmcsIHNxbUlkOiBzdHJpbmcsIGRldkRldmljZUlkOiBzdHJpbmcpOiB7IHNoYXJlZFByb2Nlc3NSZWFkeTogUHJvbWlzZTxNZXNzYWdlUG9ydENsaWVudD47IHNoYXJlZFByb2Nlc3NDbGllbnQ6IFByb21pc2U8TWVzc2FnZVBvcnRDbGllbnQ+IH0ge1xuXHRcdGNvbnN0IHNoYXJlZFByb2Nlc3MgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLm1haW5JbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTaGFyZWRQcm9jZXNzLCBtYWNoaW5lSWQsIHNxbUlkLCBkZXZEZXZpY2VJZCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2hhcmVkUHJvY2Vzcy5vbkRpZENyYXNoKCgpID0+IHRoaXMud2luZG93c01haW5TZXJ2aWNlPy5zZW5kVG9Gb2N1c2VkKCd2c2NvZGU6cmVwb3J0U2hhcmVkUHJvY2Vzc0NyYXNoJykpKTtcblxuXHRcdGNvbnN0IHNoYXJlZFByb2Nlc3NDbGllbnQgPSAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdNYWluLT5TaGFyZWRQcm9jZXNzI2Nvbm5lY3QnKTtcblxuXHRcdFx0Y29uc3QgcG9ydCA9IGF3YWl0IHNoYXJlZFByb2Nlc3MuY29ubmVjdCgpO1xuXG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ01haW4tPlNoYXJlZFByb2Nlc3MjY29ubmVjdDogY29ubmVjdGlvbiBlc3RhYmxpc2hlZCcpO1xuXG5cdFx0XHRyZXR1cm4gbmV3IE1lc3NhZ2VQb3J0Q2xpZW50KHBvcnQsICdtYWluJyk7XG5cdFx0fSkoKTtcblxuXHRcdGNvbnN0IHNoYXJlZFByb2Nlc3NSZWFkeSA9IChhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCBzaGFyZWRQcm9jZXNzLndoZW5SZWFkeSgpO1xuXG5cdFx0XHRyZXR1cm4gc2hhcmVkUHJvY2Vzc0NsaWVudDtcblx0XHR9KSgpO1xuXG5cdFx0cmV0dXJuIHsgc2hhcmVkUHJvY2Vzc1JlYWR5LCBzaGFyZWRQcm9jZXNzQ2xpZW50IH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluaXRTZXJ2aWNlcyhtYWNoaW5lSWQ6IHN0cmluZywgc3FtSWQ6IHN0cmluZywgZGV2RGV2aWNlSWQ6IHN0cmluZywgc2hhcmVkUHJvY2Vzc1JlYWR5OiBQcm9taXNlPE1lc3NhZ2VQb3J0Q2xpZW50Pik6IFByb21pc2U8SUluc3RhbnRpYXRpb25TZXJ2aWNlPiB7XG5cdFx0Y29uc3Qgc2VydmljZXMgPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblxuXHRcdC8vIFVwZGF0ZVxuXHRcdHN3aXRjaCAocHJvY2Vzcy5wbGF0Zm9ybSkge1xuXHRcdFx0Y2FzZSAnd2luMzInOlxuXHRcdFx0XHRzZXJ2aWNlcy5zZXQoSVVwZGF0ZVNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihXaW4zMlVwZGF0ZVNlcnZpY2UpKTtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ2xpbnV4Jzpcblx0XHRcdFx0aWYgKGlzTGludXhTbmFwKSB7XG5cdFx0XHRcdFx0c2VydmljZXMuc2V0KElVcGRhdGVTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoU25hcFVwZGF0ZVNlcnZpY2UsIFtwcm9jZXNzLmVudlsnU05BUCddLCBwcm9jZXNzLmVudlsnU05BUF9SRVZJU0lPTiddXSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNlcnZpY2VzLnNldChJVXBkYXRlU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKExpbnV4VXBkYXRlU2VydmljZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdkYXJ3aW4nOlxuXHRcdFx0XHRzZXJ2aWNlcy5zZXQoSVVwZGF0ZVNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihEYXJ3aW5VcGRhdGVTZXJ2aWNlKSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdC8vIFdpbmRvd3Ncblx0XHRzZXJ2aWNlcy5zZXQoSVdpbmRvd3NNYWluU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKFdpbmRvd3NNYWluU2VydmljZSwgW21hY2hpbmVJZCwgc3FtSWQsIGRldkRldmljZUlkLCB0aGlzLnVzZXJFbnZdLCBmYWxzZSkpO1xuXHRcdHNlcnZpY2VzLnNldChJQXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoQXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlLCB1bmRlZmluZWQsIGZhbHNlKSk7XG5cblx0XHQvLyBEaWFsb2dzXG5cdFx0Y29uc3QgZGlhbG9nTWFpblNlcnZpY2UgPSBuZXcgRGlhbG9nTWFpblNlcnZpY2UodGhpcy5sb2dTZXJ2aWNlLCB0aGlzLnByb2R1Y3RTZXJ2aWNlKTtcblx0XHRzZXJ2aWNlcy5zZXQoSURpYWxvZ01haW5TZXJ2aWNlLCBkaWFsb2dNYWluU2VydmljZSk7XG5cblx0XHQvLyBMYXVuY2hcblx0XHRzZXJ2aWNlcy5zZXQoSUxhdW5jaE1haW5TZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTGF1bmNoTWFpblNlcnZpY2UsIHVuZGVmaW5lZCwgZmFsc2UgLyogcHJveGllZCB0byBvdGhlciBwcm9jZXNzZXMgKi8pKTtcblxuXHRcdC8vIERpYWdub3N0aWNzXG5cdFx0c2VydmljZXMuc2V0KElEaWFnbm9zdGljc01haW5TZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoRGlhZ25vc3RpY3NNYWluU2VydmljZSwgdW5kZWZpbmVkLCBmYWxzZSAvKiBwcm94aWVkIHRvIG90aGVyIHByb2Nlc3NlcyAqLykpO1xuXHRcdHNlcnZpY2VzLnNldChJRGlhZ25vc3RpY3NTZXJ2aWNlLCBQcm94eUNoYW5uZWwudG9TZXJ2aWNlKGdldERlbGF5ZWRDaGFubmVsKHNoYXJlZFByb2Nlc3NSZWFkeS50aGVuKGNsaWVudCA9PiBjbGllbnQuZ2V0Q2hhbm5lbCgnZGlhZ25vc3RpY3MnKSkpKSk7XG5cblx0XHQvLyBQcm9jZXNzXG5cdFx0c2VydmljZXMuc2V0KElQcm9jZXNzTWFpblNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihQcm9jZXNzTWFpblNlcnZpY2UsIFt0aGlzLnVzZXJFbnZdKSk7XG5cblx0XHQvLyBFbmNyeXB0aW9uXG5cdFx0c2VydmljZXMuc2V0KElFbmNyeXB0aW9uTWFpblNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihFbmNyeXB0aW9uTWFpblNlcnZpY2UpKTtcblxuXHRcdC8vIEtleWJvYXJkIExheW91dFxuXHRcdHNlcnZpY2VzLnNldChJS2V5Ym9hcmRMYXlvdXRNYWluU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKEtleWJvYXJkTGF5b3V0TWFpblNlcnZpY2UpKTtcblxuXHRcdC8vIE5hdGl2ZSBIb3N0XG5cdFx0c2VydmljZXMuc2V0KElOYXRpdmVIb3N0TWFpblNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihOYXRpdmVIb3N0TWFpblNlcnZpY2UsIHVuZGVmaW5lZCwgZmFsc2UgLyogcHJveGllZCB0byBvdGhlciBwcm9jZXNzZXMgKi8pKTtcblxuXHRcdC8vIFdlYiBDb250ZW50cyBFeHRyYWN0b3Jcblx0XHRzZXJ2aWNlcy5zZXQoSVdlYkNvbnRlbnRFeHRyYWN0b3JTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTmF0aXZlV2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2UsIHVuZGVmaW5lZCwgZmFsc2UgLyogcHJveGllZCB0byBvdGhlciBwcm9jZXNzZXMgKi8pKTtcblxuXHRcdC8vIFdlYnZpZXcgTWFuYWdlclxuXHRcdHNlcnZpY2VzLnNldChJV2Vidmlld01hbmFnZXJTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoV2Vidmlld01haW5TZXJ2aWNlKSk7XG5cblx0XHQvLyBNZW51YmFyXG5cdFx0c2VydmljZXMuc2V0KElNZW51YmFyTWFpblNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihNZW51YmFyTWFpblNlcnZpY2UpKTtcblxuXHRcdC8vIEV4dGVuc2lvbiBIb3N0IFN0YXJ0ZXJcblx0XHRzZXJ2aWNlcy5zZXQoSUV4dGVuc2lvbkhvc3RTdGFydGVyLCBuZXcgU3luY0Rlc2NyaXB0b3IoRXh0ZW5zaW9uSG9zdFN0YXJ0ZXIpKTtcblxuXHRcdC8vIFN0b3JhZ2Vcblx0XHRzZXJ2aWNlcy5zZXQoSVN0b3JhZ2VNYWluU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKFN0b3JhZ2VNYWluU2VydmljZSkpO1xuXHRcdHNlcnZpY2VzLnNldChJQXBwbGljYXRpb25TdG9yYWdlTWFpblNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihBcHBsaWNhdGlvblN0b3JhZ2VNYWluU2VydmljZSkpO1xuXG5cdFx0Ly8gVGVybWluYWxcblx0XHRjb25zdCBwdHlIb3N0U3RhcnRlciA9IG5ldyBFbGVjdHJvblB0eUhvc3RTdGFydGVyKHtcblx0XHRcdGdyYWNlVGltZTogTG9jYWxSZWNvbm5lY3RDb25zdGFudHMuR3JhY2VUaW1lLFxuXHRcdFx0c2hvcnRHcmFjZVRpbWU6IExvY2FsUmVjb25uZWN0Q29uc3RhbnRzLlNob3J0R3JhY2VUaW1lLFxuXHRcdFx0c2Nyb2xsYmFjazogdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KFRlcm1pbmFsU2V0dGluZ0lkLlBlcnNpc3RlbnRTZXNzaW9uU2Nyb2xsYmFjaykgPz8gMTAwXG5cdFx0fSwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLCB0aGlzLmxpZmVjeWNsZU1haW5TZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IHB0eUhvc3RTZXJ2aWNlID0gbmV3IFB0eUhvc3RTZXJ2aWNlKFxuXHRcdFx0cHR5SG9zdFN0YXJ0ZXIsXG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLFxuXHRcdFx0dGhpcy5sb2dnZXJTZXJ2aWNlXG5cdFx0KTtcblx0XHRzZXJ2aWNlcy5zZXQoSUxvY2FsUHR5U2VydmljZSwgcHR5SG9zdFNlcnZpY2UpO1xuXG5cdFx0Ly8gRXh0ZXJuYWwgdGVybWluYWxcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRzZXJ2aWNlcy5zZXQoSUV4dGVybmFsVGVybWluYWxNYWluU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKFdpbmRvd3NFeHRlcm5hbFRlcm1pbmFsU2VydmljZSkpO1xuXHRcdH0gZWxzZSBpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdHNlcnZpY2VzLnNldChJRXh0ZXJuYWxUZXJtaW5hbE1haW5TZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTWFjRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UpKTtcblx0XHR9IGVsc2UgaWYgKGlzTGludXgpIHtcblx0XHRcdHNlcnZpY2VzLnNldChJRXh0ZXJuYWxUZXJtaW5hbE1haW5TZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTGludXhFeHRlcm5hbFRlcm1pbmFsU2VydmljZSkpO1xuXHRcdH1cblxuXHRcdC8vIEJhY2t1cHNcblx0XHRjb25zdCBiYWNrdXBNYWluU2VydmljZSA9IG5ldyBCYWNrdXBNYWluU2VydmljZSh0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMubG9nU2VydmljZSwgdGhpcy5zdGF0ZVNlcnZpY2UpO1xuXHRcdHNlcnZpY2VzLnNldChJQmFja3VwTWFpblNlcnZpY2UsIGJhY2t1cE1haW5TZXJ2aWNlKTtcblxuXHRcdC8vIFdvcmtzcGFjZXNcblx0XHRjb25zdCB3b3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlID0gbmV3IFdvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UodGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UsIHRoaXMudXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlLCBiYWNrdXBNYWluU2VydmljZSwgZGlhbG9nTWFpblNlcnZpY2UpO1xuXHRcdHNlcnZpY2VzLnNldChJV29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZSwgd29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZSk7XG5cdFx0c2VydmljZXMuc2V0KElXb3Jrc3BhY2VzU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKFdvcmtzcGFjZXNNYWluU2VydmljZSwgdW5kZWZpbmVkLCBmYWxzZSAvKiBwcm94aWVkIHRvIG90aGVyIHByb2Nlc3NlcyAqLykpO1xuXHRcdHNlcnZpY2VzLnNldChJV29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKFdvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UsIHVuZGVmaW5lZCwgZmFsc2UpKTtcblxuXHRcdC8vIFVSTCBoYW5kbGluZ1xuXHRcdHNlcnZpY2VzLnNldChJVVJMU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKE5hdGl2ZVVSTFNlcnZpY2UsIHVuZGVmaW5lZCwgZmFsc2UgLyogcHJveGllZCB0byBvdGhlciBwcm9jZXNzZXMgKi8pKTtcblxuXHRcdC8vIFRlbGVtZXRyeVxuXHRcdGlmIChzdXBwb3J0c1RlbGVtZXRyeSh0aGlzLnByb2R1Y3RTZXJ2aWNlLCB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UpKSB7XG5cdFx0XHRjb25zdCBpc0ludGVybmFsID0gaXNJbnRlcm5hbFRlbGVtZXRyeSh0aGlzLnByb2R1Y3RTZXJ2aWNlLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGNoYW5uZWwgPSBnZXREZWxheWVkQ2hhbm5lbChzaGFyZWRQcm9jZXNzUmVhZHkudGhlbihjbGllbnQgPT4gY2xpZW50LmdldENoYW5uZWwoJ3RlbGVtZXRyeUFwcGVuZGVyJykpKTtcblx0XHRcdGNvbnN0IGFwcGVuZGVyID0gbmV3IFRlbGVtZXRyeUFwcGVuZGVyQ2xpZW50KGNoYW5uZWwpO1xuXHRcdFx0Y29uc3QgY29tbW9uUHJvcGVydGllcyA9IHJlc29sdmVDb21tb25Qcm9wZXJ0aWVzKHJlbGVhc2UoKSwgaG9zdG5hbWUoKSwgcHJvY2Vzcy5hcmNoLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLmNvbW1pdCwgdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLCBtYWNoaW5lSWQsIHNxbUlkLCBkZXZEZXZpY2VJZCwgaXNJbnRlcm5hbCk7XG5cdFx0XHRjb25zdCBwaWlQYXRocyA9IGdldFBpaVBhdGhzRnJvbUVudmlyb25tZW50KHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZSk7XG5cdFx0XHRjb25zdCBjb25maWc6IElUZWxlbWV0cnlTZXJ2aWNlQ29uZmlnID0geyBhcHBlbmRlcnM6IFthcHBlbmRlcl0sIGNvbW1vblByb3BlcnRpZXMsIHBpaVBhdGhzLCBzZW5kRXJyb3JUZWxlbWV0cnk6IHRydWUgfTtcblxuXHRcdFx0c2VydmljZXMuc2V0KElUZWxlbWV0cnlTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoVGVsZW1ldHJ5U2VydmljZSwgW2NvbmZpZ10sIGZhbHNlKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNlcnZpY2VzLnNldChJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXHRcdH1cblxuXHRcdC8vIFZvaWQgbWFpbiBwcm9jZXNzIHNlcnZpY2VzIChyZXF1aXJlZCBmb3Igc2VydmljZXMgd2l0aCBhIGNoYW5uZWwgZm9yIGNvbW0gYmV0d2VlbiBicm93c2VyIGFuZCBlbGVjdHJvbi1tYWluIChub2RlKSlcblx0XHRzZXJ2aWNlcy5zZXQoSU1ldHJpY3NTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTWV0cmljc01haW5TZXJ2aWNlLCB1bmRlZmluZWQsIGZhbHNlKSk7XG5cdFx0c2VydmljZXMuc2V0KElWb2lkVXBkYXRlU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKFZvaWRNYWluVXBkYXRlU2VydmljZSwgdW5kZWZpbmVkLCBmYWxzZSkpO1xuXHRcdHNlcnZpY2VzLnNldChJVm9pZFNDTVNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihWb2lkU0NNU2VydmljZSwgdW5kZWZpbmVkLCBmYWxzZSkpO1xuXG5cdFx0Ly8gRGVmYXVsdCBFeHRlbnNpb25zIFByb2ZpbGUgSW5pdFxuXHRcdHNlcnZpY2VzLnNldChJRXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKEV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UsIHVuZGVmaW5lZCwgdHJ1ZSkpO1xuXHRcdHNlcnZpY2VzLnNldChJRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLCB1bmRlZmluZWQsIHRydWUpKTtcblxuXHRcdC8vIFV0aWxpdHkgUHJvY2VzcyBXb3JrZXJcblx0XHRzZXJ2aWNlcy5zZXQoSVV0aWxpdHlQcm9jZXNzV29ya2VyTWFpblNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihVdGlsaXR5UHJvY2Vzc1dvcmtlck1haW5TZXJ2aWNlLCB1bmRlZmluZWQsIHRydWUpKTtcblxuXHRcdC8vIFByb3h5IEF1dGhcblx0XHRzZXJ2aWNlcy5zZXQoSVByb3h5QXV0aFNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihQcm94eUF1dGhTZXJ2aWNlKSk7XG5cblx0XHQvLyBNQ1Bcblx0XHRzZXJ2aWNlcy5zZXQoSU5hdGl2ZU1jcERpc2NvdmVyeUhlbHBlclNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihOYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJTZXJ2aWNlKSk7XG5cblxuXHRcdC8vIERldiBPbmx5OiBDU1Mgc2VydmljZSAoZm9yIEVTTSlcblx0XHRzZXJ2aWNlcy5zZXQoSUNTU0RldmVsb3BtZW50U2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKENTU0RldmVsb3BtZW50U2VydmljZSwgdW5kZWZpbmVkLCB0cnVlKSk7XG5cblx0XHQvLyBJbml0IHNlcnZpY2VzIHRoYXQgcmVxdWlyZSBpdFxuXHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoW1xuXHRcdFx0YmFja3VwTWFpblNlcnZpY2UuaW5pdGlhbGl6ZSgpLFxuXHRcdFx0d29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZS5pbml0aWFsaXplKClcblx0XHRdKTtcblxuXHRcdHJldHVybiB0aGlzLm1haW5JbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChzZXJ2aWNlcyk7XG5cdH1cblxuXHRwcml2YXRlIGluaXRDaGFubmVscyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgbWFpblByb2Nlc3NFbGVjdHJvblNlcnZlcjogRWxlY3Ryb25JUENTZXJ2ZXIsIHNoYXJlZFByb2Nlc3NDbGllbnQ6IFByb21pc2U8TWVzc2FnZVBvcnRDbGllbnQ+KTogdm9pZCB7XG5cblx0XHQvLyBDaGFubmVscyByZWdpc3RlcmVkIHRvIG5vZGUuanMgYXJlIGV4cG9zZWQgdG8gc2Vjb25kIGluc3RhbmNlc1xuXHRcdC8vIGxhdW5jaGluZyBiZWNhdXNlIHRoYXQgaXMgdGhlIG9ubHkgd2F5IHRoZSBzZWNvbmQgaW5zdGFuY2Vcblx0XHQvLyBjYW4gdGFsayB0byB0aGUgZmlyc3QgaW5zdGFuY2UuIEVsZWN0cm9uIElQQyBkb2VzIG5vdCB3b3JrXG5cdFx0Ly8gYWNyb3NzIGFwcHMgdW50aWwgYHJlcXVlc3RTaW5nbGVJbnN0YW5jZWAgQVBJcyBhcmUgYWRvcHRlZC5cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRcdGNvbnN0IGxhdW5jaENoYW5uZWwgPSBQcm94eUNoYW5uZWwuZnJvbVNlcnZpY2UoYWNjZXNzb3IuZ2V0KElMYXVuY2hNYWluU2VydmljZSksIGRpc3Bvc2FibGVzLCB7IGRpc2FibGVNYXJzaGFsbGluZzogdHJ1ZSB9KTtcblx0XHR0aGlzLm1haW5Qcm9jZXNzTm9kZUlwY1NlcnZlci5yZWdpc3RlckNoYW5uZWwoJ2xhdW5jaCcsIGxhdW5jaENoYW5uZWwpO1xuXG5cdFx0Y29uc3QgZGlhZ25vc3RpY3NDaGFubmVsID0gUHJveHlDaGFubmVsLmZyb21TZXJ2aWNlKGFjY2Vzc29yLmdldChJRGlhZ25vc3RpY3NNYWluU2VydmljZSksIGRpc3Bvc2FibGVzLCB7IGRpc2FibGVNYXJzaGFsbGluZzogdHJ1ZSB9KTtcblx0XHR0aGlzLm1haW5Qcm9jZXNzTm9kZUlwY1NlcnZlci5yZWdpc3RlckNoYW5uZWwoJ2RpYWdub3N0aWNzJywgZGlhZ25vc3RpY3NDaGFubmVsKTtcblxuXHRcdC8vIFBvbGljaWVzIChtYWluICYgc2hhcmVkIHByb2Nlc3MpXG5cdFx0Y29uc3QgcG9saWN5Q2hhbm5lbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgUG9saWN5Q2hhbm5lbChhY2Nlc3Nvci5nZXQoSVBvbGljeVNlcnZpY2UpKSk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoJ3BvbGljeScsIHBvbGljeUNoYW5uZWwpO1xuXHRcdHNoYXJlZFByb2Nlc3NDbGllbnQudGhlbihjbGllbnQgPT4gY2xpZW50LnJlZ2lzdGVyQ2hhbm5lbCgncG9saWN5JywgcG9saWN5Q2hhbm5lbCkpO1xuXG5cdFx0Ly8gTG9jYWwgRmlsZXNcblx0XHRjb25zdCBkaXNrRmlsZVN5c3RlbVByb3ZpZGVyID0gdGhpcy5maWxlU2VydmljZS5nZXRQcm92aWRlcihTY2hlbWFzLmZpbGUpO1xuXHRcdGFzc2VydFR5cGUoZGlza0ZpbGVTeXN0ZW1Qcm92aWRlciBpbnN0YW5jZW9mIERpc2tGaWxlU3lzdGVtUHJvdmlkZXIpO1xuXHRcdGNvbnN0IGZpbGVTeXN0ZW1Qcm92aWRlckNoYW5uZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERpc2tGaWxlU3lzdGVtUHJvdmlkZXJDaGFubmVsKGRpc2tGaWxlU3lzdGVtUHJvdmlkZXIsIHRoaXMubG9nU2VydmljZSwgdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlKSk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoTE9DQUxfRklMRV9TWVNURU1fQ0hBTk5FTF9OQU1FLCBmaWxlU3lzdGVtUHJvdmlkZXJDaGFubmVsKTtcblx0XHRzaGFyZWRQcm9jZXNzQ2xpZW50LnRoZW4oY2xpZW50ID0+IGNsaWVudC5yZWdpc3RlckNoYW5uZWwoTE9DQUxfRklMRV9TWVNURU1fQ0hBTk5FTF9OQU1FLCBmaWxlU3lzdGVtUHJvdmlkZXJDaGFubmVsKSk7XG5cblx0XHQvLyBVc2VyIERhdGEgUHJvZmlsZXNcblx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShhY2Nlc3Nvci5nZXQoSVVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZSksIGRpc3Bvc2FibGVzKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbCgndXNlckRhdGFQcm9maWxlcycsIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKTtcblx0XHRzaGFyZWRQcm9jZXNzQ2xpZW50LnRoZW4oY2xpZW50ID0+IGNsaWVudC5yZWdpc3RlckNoYW5uZWwoJ3VzZXJEYXRhUHJvZmlsZXMnLCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSkpO1xuXG5cdFx0Ly8gVXBkYXRlXG5cdFx0Y29uc3QgdXBkYXRlQ2hhbm5lbCA9IG5ldyBVcGRhdGVDaGFubmVsKGFjY2Vzc29yLmdldChJVXBkYXRlU2VydmljZSkpO1xuXHRcdG1haW5Qcm9jZXNzRWxlY3Ryb25TZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKCd1cGRhdGUnLCB1cGRhdGVDaGFubmVsKTtcblxuXHRcdC8vIFByb2Nlc3Ncblx0XHRjb25zdCBwcm9jZXNzQ2hhbm5lbCA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShhY2Nlc3Nvci5nZXQoSVByb2Nlc3NNYWluU2VydmljZSksIGRpc3Bvc2FibGVzKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbCgncHJvY2VzcycsIHByb2Nlc3NDaGFubmVsKTtcblxuXHRcdC8vIEVuY3J5cHRpb25cblx0XHRjb25zdCBlbmNyeXB0aW9uQ2hhbm5lbCA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShhY2Nlc3Nvci5nZXQoSUVuY3J5cHRpb25NYWluU2VydmljZSksIGRpc3Bvc2FibGVzKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbCgnZW5jcnlwdGlvbicsIGVuY3J5cHRpb25DaGFubmVsKTtcblxuXHRcdC8vIFNpZ25pbmdcblx0XHRjb25zdCBzaWduQ2hhbm5lbCA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShhY2Nlc3Nvci5nZXQoSVNpZ25TZXJ2aWNlKSwgZGlzcG9zYWJsZXMpO1xuXHRcdG1haW5Qcm9jZXNzRWxlY3Ryb25TZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKCdzaWduJywgc2lnbkNoYW5uZWwpO1xuXG5cdFx0Ly8gS2V5Ym9hcmQgTGF5b3V0XG5cdFx0Y29uc3Qga2V5Ym9hcmRMYXlvdXRDaGFubmVsID0gUHJveHlDaGFubmVsLmZyb21TZXJ2aWNlKGFjY2Vzc29yLmdldChJS2V5Ym9hcmRMYXlvdXRNYWluU2VydmljZSksIGRpc3Bvc2FibGVzKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbCgna2V5Ym9hcmRMYXlvdXQnLCBrZXlib2FyZExheW91dENoYW5uZWwpO1xuXG5cdFx0Ly8gTmF0aXZlIGhvc3QgKG1haW4gJiBzaGFyZWQgcHJvY2Vzcylcblx0XHR0aGlzLm5hdGl2ZUhvc3RNYWluU2VydmljZSA9IGFjY2Vzc29yLmdldChJTmF0aXZlSG9zdE1haW5TZXJ2aWNlKTtcblx0XHRjb25zdCBuYXRpdmVIb3N0Q2hhbm5lbCA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZSh0aGlzLm5hdGl2ZUhvc3RNYWluU2VydmljZSwgZGlzcG9zYWJsZXMpO1xuXHRcdG1haW5Qcm9jZXNzRWxlY3Ryb25TZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKCduYXRpdmVIb3N0JywgbmF0aXZlSG9zdENoYW5uZWwpO1xuXHRcdHNoYXJlZFByb2Nlc3NDbGllbnQudGhlbihjbGllbnQgPT4gY2xpZW50LnJlZ2lzdGVyQ2hhbm5lbCgnbmF0aXZlSG9zdCcsIG5hdGl2ZUhvc3RDaGFubmVsKSk7XG5cblx0XHQvLyBXZWIgQ29udGVudCBFeHRyYWN0b3Jcblx0XHRjb25zdCB3ZWJDb250ZW50RXh0cmFjdG9yQ2hhbm5lbCA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShhY2Nlc3Nvci5nZXQoSVdlYkNvbnRlbnRFeHRyYWN0b3JTZXJ2aWNlKSwgZGlzcG9zYWJsZXMpO1xuXHRcdG1haW5Qcm9jZXNzRWxlY3Ryb25TZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKCd3ZWJDb250ZW50RXh0cmFjdG9yJywgd2ViQ29udGVudEV4dHJhY3RvckNoYW5uZWwpO1xuXG5cdFx0Ly8gV29ya3NwYWNlc1xuXHRcdGNvbnN0IHdvcmtzcGFjZXNDaGFubmVsID0gUHJveHlDaGFubmVsLmZyb21TZXJ2aWNlKGFjY2Vzc29yLmdldChJV29ya3NwYWNlc1NlcnZpY2UpLCBkaXNwb3NhYmxlcyk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoJ3dvcmtzcGFjZXMnLCB3b3Jrc3BhY2VzQ2hhbm5lbCk7XG5cblx0XHQvLyBNZW51YmFyXG5cdFx0Y29uc3QgbWVudWJhckNoYW5uZWwgPSBQcm94eUNoYW5uZWwuZnJvbVNlcnZpY2UoYWNjZXNzb3IuZ2V0KElNZW51YmFyTWFpblNlcnZpY2UpLCBkaXNwb3NhYmxlcyk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoJ21lbnViYXInLCBtZW51YmFyQ2hhbm5lbCk7XG5cblx0XHQvLyBVUkwgaGFuZGxpbmdcblx0XHRjb25zdCB1cmxDaGFubmVsID0gUHJveHlDaGFubmVsLmZyb21TZXJ2aWNlKGFjY2Vzc29yLmdldChJVVJMU2VydmljZSksIGRpc3Bvc2FibGVzKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbCgndXJsJywgdXJsQ2hhbm5lbCk7XG5cblx0XHQvLyBXZWJ2aWV3IE1hbmFnZXJcblx0XHRjb25zdCB3ZWJ2aWV3Q2hhbm5lbCA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShhY2Nlc3Nvci5nZXQoSVdlYnZpZXdNYW5hZ2VyU2VydmljZSksIGRpc3Bvc2FibGVzKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbCgnd2VidmlldycsIHdlYnZpZXdDaGFubmVsKTtcblxuXHRcdC8vIFN0b3JhZ2UgKG1haW4gJiBzaGFyZWQgcHJvY2Vzcylcblx0XHRjb25zdCBzdG9yYWdlQ2hhbm5lbCA9IGRpc3Bvc2FibGVzLmFkZCgobmV3IFN0b3JhZ2VEYXRhYmFzZUNoYW5uZWwodGhpcy5sb2dTZXJ2aWNlLCBhY2Nlc3Nvci5nZXQoSVN0b3JhZ2VNYWluU2VydmljZSkpKSk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoJ3N0b3JhZ2UnLCBzdG9yYWdlQ2hhbm5lbCk7XG5cdFx0c2hhcmVkUHJvY2Vzc0NsaWVudC50aGVuKGNsaWVudCA9PiBjbGllbnQucmVnaXN0ZXJDaGFubmVsKCdzdG9yYWdlJywgc3RvcmFnZUNoYW5uZWwpKTtcblxuXHRcdC8vIFByb2ZpbGUgU3RvcmFnZSBDaGFuZ2VzIExpc3RlbmVyIChzaGFyZWQgcHJvY2Vzcylcblx0XHRjb25zdCBwcm9maWxlU3RvcmFnZUxpc3RlbmVyID0gZGlzcG9zYWJsZXMuYWRkKChuZXcgUHJvZmlsZVN0b3JhZ2VDaGFuZ2VzTGlzdGVuZXJDaGFubmVsKGFjY2Vzc29yLmdldChJU3RvcmFnZU1haW5TZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UpLCB0aGlzLmxvZ1NlcnZpY2UpKSk7XG5cdFx0c2hhcmVkUHJvY2Vzc0NsaWVudC50aGVuKGNsaWVudCA9PiBjbGllbnQucmVnaXN0ZXJDaGFubmVsKCdwcm9maWxlU3RvcmFnZUxpc3RlbmVyJywgcHJvZmlsZVN0b3JhZ2VMaXN0ZW5lcikpO1xuXG5cdFx0Ly8gVGVybWluYWxcblx0XHRjb25zdCBwdHlIb3N0Q2hhbm5lbCA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShhY2Nlc3Nvci5nZXQoSUxvY2FsUHR5U2VydmljZSksIGRpc3Bvc2FibGVzKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbChUZXJtaW5hbElwY0NoYW5uZWxzLkxvY2FsUHR5LCBwdHlIb3N0Q2hhbm5lbCk7XG5cblx0XHQvLyBFeHRlcm5hbCBUZXJtaW5hbFxuXHRcdGNvbnN0IGV4dGVybmFsVGVybWluYWxDaGFubmVsID0gUHJveHlDaGFubmVsLmZyb21TZXJ2aWNlKGFjY2Vzc29yLmdldChJRXh0ZXJuYWxUZXJtaW5hbE1haW5TZXJ2aWNlKSwgZGlzcG9zYWJsZXMpO1xuXHRcdG1haW5Qcm9jZXNzRWxlY3Ryb25TZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKCdleHRlcm5hbFRlcm1pbmFsJywgZXh0ZXJuYWxUZXJtaW5hbENoYW5uZWwpO1xuXG5cdFx0Ly8gTUNQXG5cdFx0Y29uc3QgbWNwRGlzY292ZXJ5Q2hhbm5lbCA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShhY2Nlc3Nvci5nZXQoSU5hdGl2ZU1jcERpc2NvdmVyeUhlbHBlclNlcnZpY2UpLCBkaXNwb3NhYmxlcyk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoTmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyQ2hhbm5lbE5hbWUsIG1jcERpc2NvdmVyeUNoYW5uZWwpO1xuXG5cdFx0Ly8gTG9nZ2VyXG5cdFx0Y29uc3QgbG9nZ2VyQ2hhbm5lbCA9IG5ldyBMb2dnZXJDaGFubmVsKGFjY2Vzc29yLmdldChJTG9nZ2VyTWFpblNlcnZpY2UpLCk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoJ2xvZ2dlcicsIGxvZ2dlckNoYW5uZWwpO1xuXHRcdHNoYXJlZFByb2Nlc3NDbGllbnQudGhlbihjbGllbnQgPT4gY2xpZW50LnJlZ2lzdGVyQ2hhbm5lbCgnbG9nZ2VyJywgbG9nZ2VyQ2hhbm5lbCkpO1xuXG5cdFx0Ly8gVm9pZCAtIHVzZSBsb2dnZXJDaGFubmVsIGFzIHJlZmVyZW5jZVxuXHRcdGNvbnN0IG1ldHJpY3NDaGFubmVsID0gUHJveHlDaGFubmVsLmZyb21TZXJ2aWNlKGFjY2Vzc29yLmdldChJTWV0cmljc1NlcnZpY2UpLCBkaXNwb3NhYmxlcyk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoJ3ZvaWQtY2hhbm5lbC1tZXRyaWNzJywgbWV0cmljc0NoYW5uZWwpO1xuXG5cdFx0Y29uc3Qgdm9pZFVwZGF0ZXNDaGFubmVsID0gUHJveHlDaGFubmVsLmZyb21TZXJ2aWNlKGFjY2Vzc29yLmdldChJVm9pZFVwZGF0ZVNlcnZpY2UpLCBkaXNwb3NhYmxlcyk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoJ3ZvaWQtY2hhbm5lbC11cGRhdGUnLCB2b2lkVXBkYXRlc0NoYW5uZWwpO1xuXG5cdFx0Y29uc3Qgc2VuZExMTU1lc3NhZ2VDaGFubmVsID0gbmV3IExMTU1lc3NhZ2VDaGFubmVsKGFjY2Vzc29yLmdldChJTWV0cmljc1NlcnZpY2UpKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbCgndm9pZC1jaGFubmVsLWxsbU1lc3NhZ2UnLCBzZW5kTExNTWVzc2FnZUNoYW5uZWwpO1xuXG5cdFx0Ly8gVm9pZCBhZGRlZCB0aGlzXG5cdFx0Y29uc3Qgdm9pZFNDTUNoYW5uZWwgPSBQcm94eUNoYW5uZWwuZnJvbVNlcnZpY2UoYWNjZXNzb3IuZ2V0KElWb2lkU0NNU2VydmljZSksIGRpc3Bvc2FibGVzKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbCgndm9pZC1jaGFubmVsLXNjbScsIHZvaWRTQ01DaGFubmVsKTtcblxuXHRcdC8vIFZvaWQgYWRkZWQgdGhpc1xuXHRcdGNvbnN0IG1jcENoYW5uZWwgPSBuZXcgTUNQQ2hhbm5lbCgpO1xuXHRcdG1haW5Qcm9jZXNzRWxlY3Ryb25TZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKCd2b2lkLWNoYW5uZWwtbWNwJywgbWNwQ2hhbm5lbCk7XG5cblx0XHQvLyBFeHRlbnNpb24gSG9zdCBEZWJ1ZyBCcm9hZGNhc3Rpbmdcblx0XHRjb25zdCBlbGVjdHJvbkV4dGVuc2lvbkhvc3REZWJ1Z0Jyb2FkY2FzdENoYW5uZWwgPSBuZXcgRWxlY3Ryb25FeHRlbnNpb25Ib3N0RGVidWdCcm9hZGNhc3RDaGFubmVsKGFjY2Vzc29yLmdldChJV2luZG93c01haW5TZXJ2aWNlKSk7XG5cdFx0bWFpblByb2Nlc3NFbGVjdHJvblNlcnZlci5yZWdpc3RlckNoYW5uZWwoJ2V4dGVuc2lvbmhvc3RkZWJ1Z3NlcnZpY2UnLCBlbGVjdHJvbkV4dGVuc2lvbkhvc3REZWJ1Z0Jyb2FkY2FzdENoYW5uZWwpO1xuXG5cdFx0Ly8gRXh0ZW5zaW9uIEhvc3QgU3RhcnRlclxuXHRcdGNvbnN0IGV4dGVuc2lvbkhvc3RTdGFydGVyQ2hhbm5lbCA9IFByb3h5Q2hhbm5lbC5mcm9tU2VydmljZShhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbkhvc3RTdGFydGVyKSwgZGlzcG9zYWJsZXMpO1xuXHRcdG1haW5Qcm9jZXNzRWxlY3Ryb25TZXJ2ZXIucmVnaXN0ZXJDaGFubmVsKGlwY0V4dGVuc2lvbkhvc3RTdGFydGVyQ2hhbm5lbE5hbWUsIGV4dGVuc2lvbkhvc3RTdGFydGVyQ2hhbm5lbCk7XG5cblx0XHQvLyBVdGlsaXR5IFByb2Nlc3MgV29ya2VyXG5cdFx0Y29uc3QgdXRpbGl0eVByb2Nlc3NXb3JrZXJDaGFubmVsID0gUHJveHlDaGFubmVsLmZyb21TZXJ2aWNlKGFjY2Vzc29yLmdldChJVXRpbGl0eVByb2Nlc3NXb3JrZXJNYWluU2VydmljZSksIGRpc3Bvc2FibGVzKTtcblx0XHRtYWluUHJvY2Vzc0VsZWN0cm9uU2VydmVyLnJlZ2lzdGVyQ2hhbm5lbChpcGNVdGlsaXR5UHJvY2Vzc1dvcmtlckNoYW5uZWxOYW1lLCB1dGlsaXR5UHJvY2Vzc1dvcmtlckNoYW5uZWwpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuRmlyc3RXaW5kb3coYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGluaXRpYWxQcm90b2NvbFVybHM6IElJbml0aWFsUHJvdG9jb2xVcmxzIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJQ29kZVdpbmRvd1tdPiB7XG5cdFx0Y29uc3Qgd2luZG93c01haW5TZXJ2aWNlID0gdGhpcy53aW5kb3dzTWFpblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdpbmRvd3NNYWluU2VydmljZSk7XG5cdFx0dGhpcy5hdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZSk7XG5cblx0XHRjb25zdCBjb250ZXh0ID0gaXNMYXVuY2hlZEZyb21DbGkocHJvY2Vzcy5lbnYpID8gT3BlbkNvbnRleHQuQ0xJIDogT3BlbkNvbnRleHQuREVTS1RPUDtcblx0XHRjb25zdCBhcmdzID0gdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFyZ3M7XG5cblx0XHQvLyBGaXJzdCBjaGVjayBmb3Igd2luZG93cyBmcm9tIHByb3RvY29sIGxpbmtzIHRvIG9wZW5cblx0XHRpZiAoaW5pdGlhbFByb3RvY29sVXJscykge1xuXG5cdFx0XHQvLyBPcGVuYWJsZXMgY2FuIG9wZW4gYXMgd2luZG93cyBkaXJlY3RseVxuXHRcdFx0aWYgKGluaXRpYWxQcm90b2NvbFVybHMub3BlbmFibGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cmV0dXJuIHdpbmRvd3NNYWluU2VydmljZS5vcGVuKHtcblx0XHRcdFx0XHRjb250ZXh0LFxuXHRcdFx0XHRcdGNsaTogYXJncyxcblx0XHRcdFx0XHR1cmlzVG9PcGVuOiBpbml0aWFsUHJvdG9jb2xVcmxzLm9wZW5hYmxlcyxcblx0XHRcdFx0XHRnb3RvTGluZU1vZGU6IHRydWUsXG5cdFx0XHRcdFx0aW5pdGlhbFN0YXJ0dXA6IHRydWVcblx0XHRcdFx0XHQvLyByZW1vdGVBdXRob3JpdHk6IHdpbGwgYmUgZGV0ZXJtaW5lZCBiYXNlZCBvbiBvcGVuYWJsZXNcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFByb3RvY29sIGxpbmtzIHdpdGggYHdpbmRvd0lkPV9ibGFua2Agb24gc3RhcnR1cFxuXHRcdFx0Ly8gc2hvdWxkIGJlIGhhbmRsZWQgaW4gYSBzcGVjaWFsIHdheTpcblx0XHRcdC8vIFdlIHRha2UgdGhlIGZpcnN0IG9uZSBvZiB0aGVzZSBhbmQgb3BlbiBhbiBlbXB0eVxuXHRcdFx0Ly8gd2luZG93IGZvciBpdC4gVGhpcyBlbnN1cmVzIHdlIGFyZSBub3QgcmVzdG9yaW5nXG5cdFx0XHQvLyBhbGwgd2luZG93cyBvZiB0aGUgcHJldmlvdXMgc2Vzc2lvbi5cblx0XHRcdC8vIElmIHRoZXJlIGFyZSBhbnkgbW9yZSBVUkxzIGxpa2UgdGhlc2UsIHRoZXkgd2lsbFxuXHRcdFx0Ly8gYmUgaGFuZGxlZCBmcm9tIHRoZSBVUkwgbGlzdGVuZXJzIGluc3RhbGxlZCBsYXRlci5cblxuXHRcdFx0aWYgKGluaXRpYWxQcm90b2NvbFVybHMudXJscy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgcHJvdG9jb2xVcmwgb2YgaW5pdGlhbFByb3RvY29sVXJscy51cmxzKSB7XG5cdFx0XHRcdFx0Y29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhwcm90b2NvbFVybC51cmkucXVlcnkpO1xuXHRcdFx0XHRcdGlmIChwYXJhbXMuZ2V0KCd3aW5kb3dJZCcpID09PSAnX2JsYW5rJykge1xuXG5cdFx0XHRcdFx0XHQvLyBJdCBpcyBpbXBvcnRhbnQgaGVyZSB0aGF0IHdlIHJlbW92ZSBgd2luZG93SWQ9X2JsYW5rYCBmcm9tXG5cdFx0XHRcdFx0XHQvLyB0aGlzIFVSTCBiZWNhdXNlIGhlcmUgd2Ugb3BlbiBhbiBlbXB0eSB3aW5kb3cgZm9yIGl0LlxuXG5cdFx0XHRcdFx0XHRwYXJhbXMuZGVsZXRlKCd3aW5kb3dJZCcpO1xuXHRcdFx0XHRcdFx0cHJvdG9jb2xVcmwub3JpZ2luYWxVcmwgPSBwcm90b2NvbFVybC51cmkudG9TdHJpbmcodHJ1ZSk7XG5cdFx0XHRcdFx0XHRwcm90b2NvbFVybC51cmkgPSBwcm90b2NvbFVybC51cmkud2l0aCh7IHF1ZXJ5OiBwYXJhbXMudG9TdHJpbmcoKSB9KTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIHdpbmRvd3NNYWluU2VydmljZS5vcGVuKHtcblx0XHRcdFx0XHRcdFx0Y29udGV4dCxcblx0XHRcdFx0XHRcdFx0Y2xpOiBhcmdzLFxuXHRcdFx0XHRcdFx0XHRmb3JjZU5ld1dpbmRvdzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0Zm9yY2VFbXB0eTogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0Z290b0xpbmVNb2RlOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRpbml0aWFsU3RhcnR1cDogdHJ1ZVxuXHRcdFx0XHRcdFx0XHQvLyByZW1vdGVBdXRob3JpdHk6IHdpbGwgYmUgZGV0ZXJtaW5lZCBiYXNlZCBvbiBvcGVuYWJsZXNcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG1hY09wZW5GaWxlczogc3RyaW5nW10gPSAoPGFueT5nbG9iYWwpLm1hY09wZW5GaWxlcztcblx0XHRjb25zdCBoYXNDbGlBcmdzID0gYXJncy5fLmxlbmd0aDtcblx0XHRjb25zdCBoYXNGb2xkZXJVUklzID0gISFhcmdzWydmb2xkZXItdXJpJ107XG5cdFx0Y29uc3QgaGFzRmlsZVVSSXMgPSAhIWFyZ3NbJ2ZpbGUtdXJpJ107XG5cdFx0Y29uc3Qgbm9SZWNlbnRFbnRyeSA9IGFyZ3NbJ3NraXAtYWRkLXRvLXJlY2VudGx5LW9wZW5lZCddID09PSB0cnVlO1xuXHRcdGNvbnN0IHdhaXRNYXJrZXJGaWxlVVJJID0gYXJncy53YWl0ICYmIGFyZ3Mud2FpdE1hcmtlckZpbGVQYXRoID8gVVJJLmZpbGUoYXJncy53YWl0TWFya2VyRmlsZVBhdGgpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IGFyZ3MucmVtb3RlIHx8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBmb3JjZVByb2ZpbGUgPSBhcmdzLnByb2ZpbGU7XG5cdFx0Y29uc3QgZm9yY2VUZW1wUHJvZmlsZSA9IGFyZ3NbJ3Byb2ZpbGUtdGVtcCddO1xuXG5cdFx0Ly8gU3RhcnRlZCB3aXRob3V0IGZpbGUvZm9sZGVyIGFyZ3VtZW50c1xuXHRcdGlmICghaGFzQ2xpQXJncyAmJiAhaGFzRm9sZGVyVVJJcyAmJiAhaGFzRmlsZVVSSXMpIHtcblxuXHRcdFx0Ly8gRm9yY2UgbmV3IHdpbmRvd1xuXHRcdFx0aWYgKGFyZ3NbJ25ldy13aW5kb3cnXSB8fCBmb3JjZVByb2ZpbGUgfHwgZm9yY2VUZW1wUHJvZmlsZSkge1xuXHRcdFx0XHRyZXR1cm4gd2luZG93c01haW5TZXJ2aWNlLm9wZW4oe1xuXHRcdFx0XHRcdGNvbnRleHQsXG5cdFx0XHRcdFx0Y2xpOiBhcmdzLFxuXHRcdFx0XHRcdGZvcmNlTmV3V2luZG93OiB0cnVlLFxuXHRcdFx0XHRcdGZvcmNlRW1wdHk6IHRydWUsXG5cdFx0XHRcdFx0bm9SZWNlbnRFbnRyeSxcblx0XHRcdFx0XHR3YWl0TWFya2VyRmlsZVVSSSxcblx0XHRcdFx0XHRpbml0aWFsU3RhcnR1cDogdHJ1ZSxcblx0XHRcdFx0XHRyZW1vdGVBdXRob3JpdHksXG5cdFx0XHRcdFx0Zm9yY2VQcm9maWxlLFxuXHRcdFx0XHRcdGZvcmNlVGVtcFByb2ZpbGVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIG1hYzogb3Blbi1maWxlIGV2ZW50IHJlY2VpdmVkIG9uIHN0YXJ0dXBcblx0XHRcdGlmIChtYWNPcGVuRmlsZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiB3aW5kb3dzTWFpblNlcnZpY2Uub3Blbih7XG5cdFx0XHRcdFx0Y29udGV4dDogT3BlbkNvbnRleHQuRE9DSyxcblx0XHRcdFx0XHRjbGk6IGFyZ3MsXG5cdFx0XHRcdFx0dXJpc1RvT3BlbjogbWFjT3BlbkZpbGVzLm1hcChwYXRoID0+IHtcblx0XHRcdFx0XHRcdHBhdGggPSBub3JtYWxpemVORkMocGF0aCk7IC8vIG1hY09TIG9ubHk6IG5vcm1hbGl6ZSBwYXRocyB0byBORkMgZm9ybVxuXG5cdFx0XHRcdFx0XHRyZXR1cm4gKGhhc1dvcmtzcGFjZUZpbGVFeHRlbnNpb24ocGF0aCkgPyB7IHdvcmtzcGFjZVVyaTogVVJJLmZpbGUocGF0aCkgfSA6IHsgZmlsZVVyaTogVVJJLmZpbGUocGF0aCkgfSk7XG5cdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0bm9SZWNlbnRFbnRyeSxcblx0XHRcdFx0XHR3YWl0TWFya2VyRmlsZVVSSSxcblx0XHRcdFx0XHRpbml0aWFsU3RhcnR1cDogdHJ1ZSxcblx0XHRcdFx0XHQvLyByZW1vdGVBdXRob3JpdHk6IHdpbGwgYmUgZGV0ZXJtaW5lZCBiYXNlZCBvbiBtYWNPcGVuRmlsZXNcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gZGVmYXVsdDogcmVhZCBwYXRocyBmcm9tIGNsaVxuXHRcdHJldHVybiB3aW5kb3dzTWFpblNlcnZpY2Uub3Blbih7XG5cdFx0XHRjb250ZXh0LFxuXHRcdFx0Y2xpOiBhcmdzLFxuXHRcdFx0Zm9yY2VOZXdXaW5kb3c6IGFyZ3NbJ25ldy13aW5kb3cnXSxcblx0XHRcdGRpZmZNb2RlOiBhcmdzLmRpZmYsXG5cdFx0XHRtZXJnZU1vZGU6IGFyZ3MubWVyZ2UsXG5cdFx0XHRub1JlY2VudEVudHJ5LFxuXHRcdFx0d2FpdE1hcmtlckZpbGVVUkksXG5cdFx0XHRnb3RvTGluZU1vZGU6IGFyZ3MuZ290byxcblx0XHRcdGluaXRpYWxTdGFydHVwOiB0cnVlLFxuXHRcdFx0cmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0Zm9yY2VQcm9maWxlLFxuXHRcdFx0Zm9yY2VUZW1wUHJvZmlsZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhZnRlcldpbmRvd09wZW4oKTogdm9pZCB7XG5cblx0XHQvLyBXaW5kb3dzOiBtdXRleFxuXHRcdHRoaXMuaW5zdGFsbE11dGV4KCk7XG5cblx0XHQvLyBSZW1vdGUgQXV0aG9yaXRpZXNcblx0XHRwcm90b2NvbC5yZWdpc3Rlckh0dHBQcm90b2NvbChTY2hlbWFzLnZzY29kZVJlbW90ZVJlc291cmNlLCAocmVxdWVzdCwgY2FsbGJhY2spID0+IHtcblx0XHRcdGNhbGxiYWNrKHtcblx0XHRcdFx0dXJsOiByZXF1ZXN0LnVybC5yZXBsYWNlKC9ednNjb2RlLXJlbW90ZS1yZXNvdXJjZTovLCAnaHR0cDonKSxcblx0XHRcdFx0bWV0aG9kOiByZXF1ZXN0Lm1ldGhvZFxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHQvLyBTdGFydCB0byBmZXRjaCBzaGVsbCBlbnZpcm9ubWVudCAoaWYgbmVlZGVkKSBhZnRlciB3aW5kb3cgaGFzIG9wZW5lZFxuXHRcdC8vIFNpbmNlIHRoaXMgb3BlcmF0aW9uIGNhbiB0YWtlIGEgbG9uZyB0aW1lLCB3ZSB3YW50IHRvIHdhcm0gaXQgdXAgd2hpbGVcblx0XHQvLyB0aGUgd2luZG93IGlzIG9wZW5pbmcuXG5cdFx0Ly8gV2UgYWxzbyBzaG93IGFuIGVycm9yIHRvIHRoZSB1c2VyIGluIGNhc2UgdGhpcyBmYWlscy5cblx0XHR0aGlzLnJlc29sdmVTaGVsbEVudmlyb25tZW50KHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmdzLCBwcm9jZXNzLmVudiwgdHJ1ZSk7XG5cblx0XHQvLyBDcmFzaCByZXBvcnRlclxuXHRcdHRoaXMudXBkYXRlQ3Jhc2hSZXBvcnRlckVuYWJsZW1lbnQoKTtcblxuXHRcdC8vIG1hY09TOiByb3NldHRhIHRyYW5zbGF0aW9uIHdhcm5pbmdcblx0XHRpZiAoaXNNYWNpbnRvc2ggJiYgYXBwLnJ1bm5pbmdVbmRlckFSTTY0VHJhbnNsYXRpb24pIHtcblx0XHRcdHRoaXMud2luZG93c01haW5TZXJ2aWNlPy5zZW5kVG9Gb2N1c2VkKCd2c2NvZGU6c2hvd1RyYW5zbGF0ZWRCdWlsZFdhcm5pbmcnKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluc3RhbGxNdXRleCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3aW4zMk11dGV4TmFtZSA9IHRoaXMucHJvZHVjdFNlcnZpY2Uud2luMzJNdXRleE5hbWU7XG5cdFx0aWYgKGlzV2luZG93cyAmJiB3aW4zMk11dGV4TmFtZSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgV2luZG93c011dGV4ID0gYXdhaXQgaW1wb3J0KCdAdnNjb2RlL3dpbmRvd3MtbXV0ZXgnKTtcblx0XHRcdFx0Y29uc3QgbXV0ZXggPSBuZXcgV2luZG93c011dGV4Lk11dGV4KHdpbjMyTXV0ZXhOYW1lKTtcblx0XHRcdFx0RXZlbnQub25jZSh0aGlzLmxpZmVjeWNsZU1haW5TZXJ2aWNlLm9uV2lsbFNodXRkb3duKSgoKSA9PiBtdXRleC5yZWxlYXNlKCkpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlc29sdmVTaGVsbEVudmlyb25tZW50KGFyZ3M6IE5hdGl2ZVBhcnNlZEFyZ3MsIGVudjogSVByb2Nlc3NFbnZpcm9ubWVudCwgbm90aWZ5T25FcnJvcjogYm9vbGVhbik6IFByb21pc2U8dHlwZW9mIHByb2Nlc3MuZW52PiB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCBnZXRSZXNvbHZlZFNoZWxsRW52KHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMubG9nU2VydmljZSwgYXJncywgZW52KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gdG9FcnJvck1lc3NhZ2UoZXJyb3IpO1xuXHRcdFx0aWYgKG5vdGlmeU9uRXJyb3IpIHtcblx0XHRcdFx0dGhpcy53aW5kb3dzTWFpblNlcnZpY2U/LnNlbmRUb0ZvY3VzZWQoJ3ZzY29kZTpzaG93UmVzb2x2ZVNoZWxsRW52RXJyb3InLCBlcnJvck1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yTWVzc2FnZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHt9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVDcmFzaFJlcG9ydGVyRW5hYmxlbWVudCgpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIElmIGVuYWJsZS1jcmFzaC1yZXBvcnRlciBhcmd2IGlzIHVuZGVmaW5lZCB0aGVuIHRoaXMgaXMgYSBmcmVzaCBzdGFydCxcblx0XHQvLyBiYXNlZCBvbiBgdGVsZW1ldHJ5LmVuYWJsZUNyYXNocmVwb3J0ZXJgIHNldHRpbmdzLCBnZW5lcmF0ZSBhIFVVSUQgd2hpY2hcblx0XHQvLyB3aWxsIGJlIHVzZWQgYXMgY3Jhc2ggcmVwb3J0ZXIgaWQgYW5kIGFsc28gdXBkYXRlIHRoZSBqc29uIGZpbGUuXG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYXJndkNvbnRlbnQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmd2UmVzb3VyY2UpO1xuXHRcdFx0Y29uc3QgYXJndlN0cmluZyA9IGFyZ3ZDb250ZW50LnZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0XHRjb25zdCBhcmd2SlNPTiA9IHBhcnNlPHsgJ2VuYWJsZS1jcmFzaC1yZXBvcnRlcic/OiBib29sZWFuIH0+KGFyZ3ZTdHJpbmcpO1xuXHRcdFx0Y29uc3QgdGVsZW1ldHJ5TGV2ZWwgPSBnZXRUZWxlbWV0cnlMZXZlbCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVuYWJsZUNyYXNoUmVwb3J0ZXIgPSB0ZWxlbWV0cnlMZXZlbCA+PSBUZWxlbWV0cnlMZXZlbC5DUkFTSDtcblxuXHRcdFx0Ly8gSW5pdGlhbCBzdGFydHVwXG5cdFx0XHRpZiAoYXJndkpTT05bJ2VuYWJsZS1jcmFzaC1yZXBvcnRlciddID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29uc3QgYWRkaXRpb25hbEFyZ3ZDb250ZW50ID0gW1xuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdCdcdC8vIEFsbG93cyB0byBkaXNhYmxlIGNyYXNoIHJlcG9ydGluZy4nLFxuXHRcdFx0XHRcdCdcdC8vIFNob3VsZCByZXN0YXJ0IHRoZSBhcHAgaWYgdGhlIHZhbHVlIGlzIGNoYW5nZWQuJyxcblx0XHRcdFx0XHRgXHRcImVuYWJsZS1jcmFzaC1yZXBvcnRlclwiOiAke2VuYWJsZUNyYXNoUmVwb3J0ZXJ9LGAsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0J1x0Ly8gVW5pcXVlIGlkIHVzZWQgZm9yIGNvcnJlbGF0aW5nIGNyYXNoIHJlcG9ydHMgc2VudCBmcm9tIHRoaXMgaW5zdGFuY2UuJyxcblx0XHRcdFx0XHQnXHQvLyBEbyBub3QgZWRpdCB0aGlzIHZhbHVlLicsXG5cdFx0XHRcdFx0YFx0XCJjcmFzaC1yZXBvcnRlci1pZFwiOiBcIiR7Z2VuZXJhdGVVdWlkKCl9XCJgLFxuXHRcdFx0XHRcdCd9J1xuXHRcdFx0XHRdO1xuXHRcdFx0XHRjb25zdCBuZXdBcmd2U3RyaW5nID0gYXJndlN0cmluZy5zdWJzdHJpbmcoMCwgYXJndlN0cmluZy5sZW5ndGggLSAyKS5jb25jYXQoJyxcXG4nLCBhZGRpdGlvbmFsQXJndkNvbnRlbnQuam9pbignXFxuJykpO1xuXG5cdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmd2UmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcobmV3QXJndlN0cmluZykpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTdWJzZXF1ZW50IHN0YXJ0dXA6IHVwZGF0ZSBjcmFzaCByZXBvcnRlciB2YWx1ZSBpZiBjaGFuZ2VkXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc3QgbmV3QXJndlN0cmluZyA9IGFyZ3ZTdHJpbmcucmVwbGFjZSgvXCJlbmFibGUtY3Jhc2gtcmVwb3J0ZXJcIjogLiosLywgYFwiZW5hYmxlLWNyYXNoLXJlcG9ydGVyXCI6ICR7ZW5hYmxlQ3Jhc2hSZXBvcnRlcn0sYCk7XG5cdFx0XHRcdGlmIChuZXdBcmd2U3RyaW5nICE9PSBhcmd2U3RyaW5nKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUodGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFyZ3ZSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhuZXdBcmd2U3RyaW5nKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblxuXHRcdFx0Ly8gSW5mb3JtIHRoZSB1c2VyIHZpYSBub3RpZmljYXRpb25cblx0XHRcdHRoaXMud2luZG93c01haW5TZXJ2aWNlPy5zZW5kVG9Gb2N1c2VkKCd2c2NvZGU6c2hvd0FyZ3ZQYXJzZVdhcm5pbmcnKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGV2ZW50dWFsbHlBZnRlcldpbmRvd09wZW4oKTogdm9pZCB7XG5cblx0XHQvLyBWYWxpZGF0ZSBEZXZpY2UgSUQgaXMgdXAgdG8gZGF0ZSAoZGVsYXkgdGhpcyBhcyBpdCBoYXMgc2hvd24gc2lnbmlmaWNhbnQgcGVyZiBpbXBhY3QpXG5cdFx0Ly8gUmVmczogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIzNDA2NFxuXHRcdHZhbGlkYXRlZGV2RGV2aWNlSWQodGhpcy5zdGF0ZVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxLQUFLLFVBQVUsU0FBa0IseUJBQXVDO0FBQ2pGLFNBQVMsdUJBQXVCLG9DQUFvQztBQUNwRSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLFVBQVUsZUFBZTtBQUNsQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGFBQWE7QUFDdEIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyxTQUFTLHdCQUF3QjtBQUMxQyxTQUFTLE1BQU0sYUFBYTtBQUM1QixTQUE4QixTQUFTLGFBQWEsYUFBYSxXQUFXLFVBQVU7QUFDdEYsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsbUJBQW1CLGNBQWMsb0JBQW9CO0FBQzlELFNBQVMsVUFBVSx5QkFBeUI7QUFDNUMsU0FBUyxVQUFVLHlCQUF5QjtBQUU1QyxTQUFTLG1CQUFtQix3QkFBd0I7QUFDcEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxrREFBa0Q7QUFDM0QsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx3QkFBd0IsK0JBQStCO0FBQ2hFLFNBQVMsbUJBQW1CLDBCQUEwQjtBQUN0RCxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHVCQUF1QiwwQ0FBMEM7QUFDMUUsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyw4QkFBOEIsNEJBQTRCLHNDQUFzQztBQUN6RyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHFDQUFxQztBQUM5QyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDZCQUErQztBQUN4RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDRCQUE0QixpQ0FBaUM7QUFDdEUsU0FBUyxvQkFBb0IseUJBQXlCO0FBQ3RELFNBQVMsdUJBQXVCLG9CQUFvQixzQkFBc0I7QUFDMUUsU0FBUyxnQkFBZ0IsbUJBQW1CO0FBQzVDLFNBQVMscUJBQXFCLDBCQUEwQjtBQUN4RCxTQUFTLHdCQUF3Qiw2QkFBNkI7QUFDOUQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUywrQkFBK0IsZ0NBQWdDLHFCQUFxQiwwQkFBMEI7QUFDdkgsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxtQkFBbUIsc0JBQXNCO0FBQ2xELFNBQVMsK0JBQStCO0FBQ3hDLFNBQWtDLHdCQUF3QjtBQUMxRCxTQUFTLDRCQUE0QixtQkFBbUIscUJBQXFCLHNCQUFzQix5QkFBeUI7QUFDNUgsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBMEIsbUJBQW1CO0FBQzdDLFNBQVMseUJBQXlCLHdCQUF3QjtBQUMxRCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGdCQUFnQix5QkFBMEM7QUFDbkUsU0FBUyxpQ0FBaUMscUJBQXFCLG1CQUFtQjtBQUVsRixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLCtCQUErQixvQ0FBb0M7QUFDNUUsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxrQ0FBa0MsdUNBQXVDO0FBQ2xGLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsNENBQTRDO0FBQ3JELFNBQVMsVUFBVSxrQkFBa0IseUJBQXlCO0FBQzlELFNBQVMsa0JBQWtCLGNBQWMsb0JBQW9CLDJCQUEyQjtBQUN4RixTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLGtDQUFrQyx1Q0FBdUM7QUFDbEYsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyxrQkFBa0IseUJBQXlCLHFCQUFxQix5QkFBeUI7QUFDbEcsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxtQ0FBbUMsc0NBQWtFLGdDQUFnQztBQUM5SSxTQUFTLFlBQVk7QUFDckIsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx3QkFBd0IsNkJBQTZCO0FBQzlELFNBQVMsa0NBQWtDLDJDQUEyQztBQUN0RixTQUFTLHVDQUF1QztBQUNoRCxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLHdDQUF3QztBQUNqRCxPQUFPLG9CQUFvQjtBQUkzQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGtCQUFrQjtBQUtwQixJQUFNLGtCQUFOLGNBQThCLFdBQVc7QUFBQSxFQVcvQyxZQUNrQiwwQkFDQSxTQUN1QiwwQkFDVixZQUNHLGVBQ1Msd0JBQ0Ysc0JBQ0Esc0JBQ1IsY0FDRCxhQUNHLGdCQUNhLDZCQUM5QztBQUNELFVBQU07QUFiVztBQUNBO0FBQ3VCO0FBQ1Y7QUFDRztBQUNTO0FBQ0Y7QUFDQTtBQUNSO0FBQ0Q7QUFDRztBQUNhO0FBSS9DLFNBQUssaUJBQWlCO0FBQ3RCLFNBQUssa0JBQWtCO0FBQUEsRUFDeEI7QUFBQSxFQUVRLG1CQUF5QjtBQU9oQyxVQUFNLGtCQUFrQixDQUFDLGtCQUF1QyxlQUFlLFdBQVcsR0FBRyxRQUFRLGtCQUFrQixNQUFNLGdCQUFnQixFQUFFO0FBQy9JLFVBQU0sbUJBQW1CLENBQUMsa0JBQXNDLGVBQWUsV0FBVyxHQUFHLFFBQVEsYUFBYSxLQUFLO0FBRXZILFVBQU0sOEJBQThCLG9CQUFJLElBQUk7QUFBQSxNQUMzQztBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUEsTUFHQTtBQUFBLElBQ0QsQ0FBQztBQUVELFVBQU0sMkJBQTJCLG9CQUFJLElBQUk7QUFBQSxNQUN4QztBQUFBLE1BQ0E7QUFBQTtBQUFBO0FBQUEsTUFHQTtBQUFBLElBQ0QsQ0FBQztBQUVELFlBQVEsZUFBZSw0QkFBNEIsQ0FBQyxjQUFjLFlBQVksVUFBVSxZQUFZO0FBQ25HLFVBQUksaUJBQWlCLFFBQVEsYUFBYSxHQUFHO0FBQzVDLGVBQU8sU0FBUyw0QkFBNEIsSUFBSSxVQUFVLENBQUM7QUFBQSxNQUM1RDtBQUNBLFVBQUksZ0JBQWdCLFFBQVEsYUFBYSxHQUFHO0FBQzNDLGVBQU8sU0FBUyx5QkFBeUIsSUFBSSxVQUFVLENBQUM7QUFBQSxNQUN6RDtBQUNBLGFBQU8sU0FBUyxLQUFLO0FBQUEsSUFDdEIsQ0FBQztBQUVELFlBQVEsZUFBZSwwQkFBMEIsQ0FBQyxjQUFjLFlBQVksU0FBUyxZQUFZO0FBQ2hHLFVBQUksaUJBQWlCLFFBQVEsYUFBYSxHQUFHO0FBQzVDLGVBQU8sNEJBQTRCLElBQUksVUFBVTtBQUFBLE1BQ2xEO0FBQ0EsVUFBSSxnQkFBZ0IsUUFBUSxhQUFhLEdBQUc7QUFDM0MsZUFBTyx5QkFBeUIsSUFBSSxVQUFVO0FBQUEsTUFDL0M7QUFDQSxhQUFPO0FBQUEsSUFDUixDQUFDO0FBT0QsVUFBTSxzQkFBc0Isb0JBQUksSUFBSSxDQUFDLFFBQVEsTUFBTSxRQUFRLG9CQUFvQixRQUFRLHNCQUFzQixRQUFRLDZCQUE2QixVQUFVLENBQUM7QUFHN0osVUFBTSxjQUFjLENBQUMsaUJBQTJEO0FBQy9FLGVBQVMsUUFBeUMsY0FBYyxPQUFPLFFBQVEsTUFBTSxRQUFRO0FBQzVGLFlBQUksTUFBTSxJQUFJLFdBQVcsR0FBRyxRQUFRLGFBQWEsS0FBSyxHQUFHO0FBQ3hELGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sOEJBQThCLENBQUMsWUFBMEc7QUFDOUksYUFBTyxRQUFRLGlCQUFpQixTQUFTLFlBQVksUUFBUSxLQUFLO0FBQUEsSUFDbkU7QUFFQSxVQUFNLDZCQUE2QixDQUFDLFlBQXFEO0FBQ3hGLFlBQU0sUUFBUSxRQUFRO0FBQ3RCLFVBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxvQkFBb0I7QUFDdkMsZUFBTztBQUFBLE1BQ1I7QUFHQSxZQUFNLFVBQVUsZ0NBQWdDO0FBQ2hELGlCQUFXLFVBQVUsU0FBUztBQUM3QixZQUFJLE1BQU0sY0FBYyxPQUFPLFlBQVksVUFBVSxXQUFXO0FBQy9ELGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFFQSxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sMEJBQTBCLENBQUMsS0FBVSxZQUE4RDtBQUN4RyxVQUFJLElBQUksU0FBUyxlQUFlO0FBQy9CLGVBQU87QUFBQSxNQUNSO0FBRUEsWUFBTSxRQUFRLFFBQVE7QUFDdEIsVUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLG9CQUFvQjtBQUN2QyxlQUFPO0FBQUEsTUFDUjtBQUdBLGlCQUFXLFVBQVUsS0FBSyxtQkFBbUIsV0FBVyxHQUFHO0FBQzFELFlBQUksT0FBTyxLQUFLO0FBQ2YsY0FBSSxNQUFNLGNBQWMsT0FBTyxJQUFJLFlBQVksVUFBVSxXQUFXO0FBQ25FLG1CQUFPO0FBQUEsVUFDUjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsYUFBTztBQUFBLElBQ1I7QUFFQSxZQUFRLGVBQWUsV0FBVyxnQkFBZ0IsQ0FBQyxTQUFTLGFBQWE7QUFDeEUsWUFBTSxNQUFNLElBQUksTUFBTSxRQUFRLEdBQUc7QUFDakMsVUFBSSxJQUFJLFdBQVcsUUFBUSxlQUFlO0FBQ3pDLFlBQUksQ0FBQyx3QkFBd0IsS0FBSyxPQUFPLEdBQUc7QUFDM0MsZUFBSyxXQUFXLE1BQU0sa0NBQWtDLFFBQVEsR0FBRztBQUNuRSxpQkFBTyxTQUFTLEVBQUUsUUFBUSxLQUFLLENBQUM7QUFBQSxRQUNqQztBQUFBLE1BQ0Q7QUFFQSxVQUFJLElBQUksV0FBVyxRQUFRLG9CQUFvQjtBQUM5QyxZQUFJLENBQUMsMkJBQTJCLE9BQU8sR0FBRztBQUN6QyxlQUFLLFdBQVcsTUFBTSwrQkFBK0IsUUFBUSxHQUFHO0FBQ2hFLGlCQUFPLFNBQVMsRUFBRSxRQUFRLEtBQUssQ0FBQztBQUFBLFFBQ2pDO0FBQUEsTUFDRDtBQUdBLFVBQUksSUFBSSxLQUFLLFNBQVMsTUFBTSxHQUFHO0FBQzlCLGNBQU0sb0JBQW9CLG9CQUFvQixJQUFJLElBQUksTUFBTTtBQUM1RCxZQUFJLENBQUMsbUJBQW1CO0FBQ3ZCLGlCQUFPLFNBQVMsRUFBRSxRQUFRLENBQUMsNEJBQTRCLE9BQU8sRUFBRSxDQUFDO0FBQUEsUUFDbEU7QUFBQSxNQUNEO0FBRUEsYUFBTyxTQUFTLEVBQUUsUUFBUSxNQUFNLENBQUM7QUFBQSxJQUNsQyxDQUFDO0FBSUQsWUFBUSxlQUFlLFdBQVcsa0JBQWtCLENBQUMsU0FBUyxhQUFhO0FBQzFFLFlBQU0sa0JBQWtCLFFBQVE7QUFDaEMsWUFBTSxlQUFnQixnQkFBZ0IsY0FBYyxLQUFLLGdCQUFnQixjQUFjO0FBRXZGLFVBQUksZ0JBQWdCLE1BQU0sUUFBUSxZQUFZLEdBQUc7QUFDaEQsY0FBTSxNQUFNLElBQUksTUFBTSxRQUFRLEdBQUc7QUFDakMsWUFBSSxJQUFJLEtBQUssU0FBUyxNQUFNLEdBQUc7QUFDOUIsY0FBSSxvQkFBb0IsSUFBSSxJQUFJLE1BQU0sR0FBRztBQUN4Qyw0QkFBZ0IsY0FBYyxJQUFJLENBQUMsZUFBZTtBQUVsRCxtQkFBTyxTQUFTLEVBQUUsUUFBUSxPQUFPLGdCQUFnQixDQUFDO0FBQUEsVUFDbkQ7QUFBQSxRQUNEO0FBSUEsWUFBSSxDQUFDLElBQUksS0FBSyxTQUFTLFFBQVEsb0JBQW9CLEtBQUssYUFBYSxLQUFLLGlCQUFlLFlBQVksWUFBWSxFQUFFLFNBQVMsV0FBVyxDQUFDLEdBQUc7QUFDMUksaUJBQU8sU0FBUyxFQUFFLFFBQVEsQ0FBQyw0QkFBNEIsT0FBTyxFQUFFLENBQUM7QUFBQSxRQUNsRTtBQUFBLE1BQ0Q7QUFFQSxhQUFPLFNBQVMsRUFBRSxRQUFRLE1BQU0sQ0FBQztBQUFBLElBQ2xDLENBQUM7QUFPRCxZQUFRLGVBQWUsV0FBVyxrQkFBa0IsQ0FBQyxTQUFTLGFBQWE7QUFDMUUsVUFBSSxRQUFRLElBQUksV0FBVyw2Q0FBNkMsR0FBRztBQUMxRSxjQUFNLGtCQUFrQixRQUFRLG1CQUFtQix1QkFBTyxPQUFPLElBQUk7QUFFckUsWUFBSSxnQkFBZ0IsNkJBQTZCLE1BQU0sUUFBVztBQUNqRSwwQkFBZ0IsNkJBQTZCLElBQUksQ0FBQyxHQUFHO0FBQ3JELGlCQUFPLFNBQVMsRUFBRSxRQUFRLE9BQU8sZ0JBQWdCLENBQUM7QUFBQSxRQUNuRDtBQUFBLE1BQ0Q7QUFFQSxhQUFPLFNBQVMsRUFBRSxRQUFRLE1BQU0sQ0FBQztBQUFBLElBQ2xDLENBQUM7QUFjRCxVQUFNLGlCQUFpQixRQUFRO0FBQy9CLFFBQUksT0FBTyxlQUFlLHFCQUFxQixjQUFjLEtBQUssdUJBQXVCLGVBQWU7QUFLdkcscUJBQWUsaUJBQWlCLEtBQUssS0FBSyx1QkFBdUIsZUFBZSxRQUFRLENBQUM7QUFBQSxJQUMxRjtBQU1BLFFBQUksV0FBVztBQUNkLFVBQUksS0FBSyxxQkFBcUIsU0FBUyw0QkFBNEIsTUFBTSxPQUFPO0FBQy9FLHFDQUE2QjtBQUFBLE1BQzlCLE9BQU87QUFDTiw4QkFBc0IsS0FBSyxxQkFBcUIsU0FBUywwQkFBMEIsQ0FBQztBQUFBLE1BQ3JGO0FBQUEsSUFDRDtBQUFBLEVBR0Q7QUFBQSxFQUVRLG9CQUEwQjtBQUdqQyxVQUFNLEtBQUssS0FBSyxxQkFBcUIsY0FBYyxFQUFFLE1BQU0sS0FBSyxRQUFRLENBQUM7QUFHekUsZ0NBQTRCO0FBRzVCLFFBQUksR0FBRyxpQ0FBaUMsQ0FBQyxPQUFPLGdDQUFnQztBQUMvRSxXQUFLLG9CQUFvQixVQUFVLHNDQUFzQywyQkFBMkI7QUFBQSxJQUNyRyxDQUFDO0FBR0QsUUFBSSxHQUFHLFlBQVksT0FBTyxPQUFPLHNCQUFzQjtBQUN0RCxXQUFLLFdBQVcsTUFBTSxjQUFjO0FBR3BDLFVBQUksQ0FBQyxtQkFBbUI7QUFDdkIsY0FBTSxLQUFLLG9CQUFvQixnQkFBZ0IsRUFBRSxTQUFTLFlBQVksS0FBSyxDQUFDO0FBQUEsTUFDN0U7QUFBQSxJQUNELENBQUM7QUFNRCxRQUFJLEdBQUcsd0JBQXdCLENBQUMsT0FBTyxhQUFhO0FBR25ELFVBQUksVUFBVSxRQUFRLElBQUksV0FBVyxHQUFHLFFBQVEsa0JBQWtCLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRztBQUM3RixhQUFLLFdBQVcsTUFBTSw0RUFBNEU7QUFFbEcsYUFBSyw2QkFBNkIsZUFBZSxRQUFRO0FBQUEsTUFDMUQ7QUFHQSxlQUFTLEdBQUcsaUJBQWlCLENBQUFBLFdBQVM7QUFDckMsYUFBSyxXQUFXLE1BQU0sNERBQTREO0FBRWxGLFFBQUFBLE9BQU0sZUFBZTtBQUFBLE1BQ3RCLENBQUM7QUFJRCxlQUFTLHFCQUFxQixhQUFXO0FBR3hDLFlBQUksUUFBUSxRQUFRLGVBQWU7QUFDbEMsZUFBSyxXQUFXLE1BQU0saUdBQWlHO0FBRXZILGlCQUFPO0FBQUEsWUFDTixRQUFRO0FBQUEsWUFDUiw4QkFBOEIsS0FBSyw2QkFBNkIsYUFBYSxPQUFPO0FBQUEsVUFDckY7QUFBQSxRQUNELE9BR0s7QUFDSixlQUFLLFdBQVcsTUFBTSx1RUFBdUUsUUFBUSxHQUFHLEdBQUc7QUFFM0csZUFBSyx1QkFBdUIsYUFBYSxRQUFXLFFBQVEsR0FBRztBQUUvRCxpQkFBTyxFQUFFLFFBQVEsT0FBTztBQUFBLFFBQ3pCO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBSUQsUUFBSSxrQkFBcUMsQ0FBQztBQUMxQyxRQUFJLGlCQUE2QztBQUNqRCxRQUFJLEdBQUcsYUFBYSxDQUFDLE9BQU8sU0FBUztBQUNwQyxhQUFPLGFBQWEsSUFBSTtBQUV4QixXQUFLLFdBQVcsTUFBTSxtQkFBbUIsSUFBSTtBQUM3QyxZQUFNLGVBQWU7QUFHckIsc0JBQWdCLEtBQUssMEJBQTBCLElBQUksSUFBSSxFQUFFLGNBQWMsSUFBSSxLQUFLLElBQUksRUFBRSxJQUFJLEVBQUUsU0FBUyxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7QUFHckgsVUFBSSxtQkFBbUIsUUFBVztBQUNqQyxxQkFBYSxjQUFjO0FBQzNCLHlCQUFpQjtBQUFBLE1BQ2xCO0FBR0EsdUJBQWlCLFdBQVcsWUFBWTtBQUN2QyxjQUFNLEtBQUssb0JBQW9CLEtBQUs7QUFBQSxVQUNuQyxTQUFTLFlBQVk7QUFBQSxVQUNyQixLQUFLLEtBQUssdUJBQXVCO0FBQUEsVUFDakMsWUFBWTtBQUFBLFVBQ1osY0FBYztBQUFBLFVBQ2QsaUJBQWlCO0FBQUE7QUFBQSxRQUNsQixDQUFDO0FBRUQsMEJBQWtCLENBQUM7QUFDbkIseUJBQWlCO0FBQUEsTUFDbEIsR0FBRyxHQUFHO0FBQUEsSUFDUCxDQUFDO0FBRUQsUUFBSSxHQUFHLHNCQUFzQixZQUFZO0FBQ3hDLFlBQU0sS0FBSyxvQkFBb0IsZ0JBQWdCLEVBQUUsU0FBUyxZQUFZLFFBQVEsQ0FBQztBQUFBLElBQ2hGLENBQUM7QUFJRCxxQkFBaUIsT0FBTyx3QkFBd0IsV0FBUztBQVV4RCxZQUFNLFNBQVMsS0FBSyxvQkFBb0IsdUJBQXVCLE1BQU0sTUFBTTtBQUMzRSxVQUFJO0FBQ0osVUFBSTtBQUNKLFVBQUksUUFBUSxRQUFRO0FBQ25CLGVBQU8sT0FBTztBQUNkLGNBQU0sRUFBRSxHQUFHLFFBQVEsS0FBSyxHQUFHLE9BQU8sT0FBTyxRQUFRO0FBQUEsTUFDbEQsT0FBTztBQUNOLGVBQU8sS0FBSyx1QkFBdUI7QUFDbkMsY0FBTSxRQUFRO0FBQUEsTUFDZjtBQUdBLGFBQU8sS0FBSyx3QkFBd0IsTUFBTSxLQUFLLEtBQUs7QUFBQSxJQUNyRCxDQUFDO0FBRUQscUJBQWlCLEdBQUcseUJBQXlCLFdBQVMsTUFBTSxPQUFPLGVBQWUsQ0FBQztBQUNuRixxQkFBaUIsR0FBRyx1QkFBdUIsV0FBUyxNQUFNLE9BQU8sYUFBYSxDQUFDO0FBRS9FLHFCQUFpQixHQUFHLHVCQUF1QixXQUFTLE1BQU0sT0FBTyxPQUFPLENBQUM7QUFFekUscUJBQWlCLE9BQU8sMEJBQTBCLE9BQU8sT0FBTyxjQUFrQztBQUNqRyxZQUFNLFNBQVMsS0FBSyxvQkFBb0IsdUJBQXVCLE1BQU0sTUFBTTtBQUMzRSxVQUFJLFFBQVE7QUFDWCxlQUFPLGdCQUFnQixTQUFTO0FBQUEsTUFDakM7QUFBQSxJQUNELENBQUM7QUFBQSxFQUdGO0FBQUEsRUFFUSxrQkFBd0I7QUFDL0IsUUFBSTtBQUVILFlBQU0sT0FBTyxRQUFRLE1BQU07QUFFM0IsWUFBTSxFQUFFLE1BQU0sSUFBSSxRQUFRLGVBQWU7QUFFekMsWUFBTSxLQUFLLFFBQVEsSUFBSTtBQUN2QixZQUFNLGlCQUFpQixLQUFLLEtBQUssS0FBSyx1QkFBdUIsU0FBUyxVQUFVLGFBQWE7QUFDN0YsWUFBTSxXQUFXLEtBQUssS0FBSyxnQkFBZ0IsU0FBUztBQUNwRCxZQUFNLFVBQVUsS0FBSyxLQUFLLEtBQUssdUJBQXVCLGNBQWMsV0FBVztBQUMvRSxTQUFHLFVBQVUsS0FBSyxLQUFLLFNBQVMsVUFBVSxHQUFHLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFDaEUsWUFBTSxhQUFhLEtBQUs7QUFDeEIsaUJBQVcsS0FBSywyQkFBMkI7QUFDM0MsWUFBTSxRQUFRLE1BQU0sUUFBUSxVQUFVLENBQUMsVUFBVSxhQUFhLE9BQU8sR0FBRztBQUFBLFFBQ3ZFLEtBQUs7QUFBQSxRQUNMLEtBQUssRUFBRSxHQUFHLFFBQVEsS0FBSyxzQkFBc0IsSUFBSTtBQUFBLFFBQ2pELE9BQU8sQ0FBQyxVQUFVLFFBQVEsTUFBTTtBQUFBLE1BQ2pDLENBQUM7QUFDRCxZQUFNLE9BQVEsR0FBRyxRQUFRLENBQUMsU0FBaUIsV0FBVyxLQUFLLFVBQVUsS0FBSyxTQUFTLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUM5RixZQUFNLE9BQVEsR0FBRyxRQUFRLENBQUMsU0FBaUIsV0FBVyxLQUFLLFVBQVUsS0FBSyxTQUFTLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztBQUM5RixZQUFNLEdBQUcsU0FBUyxDQUFDLFFBQWUsV0FBVyxNQUFNLHlCQUF5QixJQUFJLE9BQU8sRUFBRSxDQUFDO0FBQzFGLFlBQU0sR0FBRyxRQUFRLENBQUMsU0FBaUIsV0FBVyxLQUFLLG1DQUFtQyxJQUFJLEVBQUUsQ0FBQztBQUFBLElBQzlGLFNBQVMsS0FBVTtBQUNsQixXQUFLLFdBQVcsTUFBTSxrQ0FBa0MsSUFBSSxPQUFPLEVBQUU7QUFBQSxJQUN0RTtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sVUFBeUI7QUFDOUIsU0FBSyxXQUFXLE1BQU0sa0JBQWtCO0FBQ3hDLFNBQUssV0FBVyxNQUFNLFNBQVMsS0FBSyx1QkFBdUIsT0FBTyxFQUFFO0FBQ3BFLFNBQUssV0FBVyxNQUFNLFNBQVMsS0FBSyx1QkFBdUIsSUFBSTtBQU0vRCxVQUFNLHNCQUFzQixLQUFLLGVBQWU7QUFDaEQsUUFBSSxhQUFhLHFCQUFxQjtBQUNyQyxVQUFJLGtCQUFrQixtQkFBbUI7QUFBQSxJQUMxQztBQVFBLFFBQUk7QUFDSCxVQUFJLGVBQWUsS0FBSyxxQkFBcUIsU0FBUyxtQkFBbUIsTUFBTSxRQUFRLENBQUMsa0JBQWtCLGVBQWUsMkJBQTJCLFNBQVMsR0FBRztBQUMvSiwwQkFBa0IsZUFBZSwyQkFBMkIsV0FBVyxJQUFXO0FBQUEsTUFDbkY7QUFBQSxJQUNELFNBQVMsT0FBTztBQUNmLFdBQUssV0FBVyxNQUFNLEtBQUs7QUFBQSxJQUM1QjtBQUdBLFVBQU0sNEJBQTRCLElBQUksa0JBQWtCO0FBQ3hELFVBQU0sS0FBSyxLQUFLLHFCQUFxQixjQUFjLEVBQUUsT0FBSztBQUN6RCxVQUFJLEVBQUUsV0FBVyxlQUFlLE1BQU07QUFNckMsa0NBQTBCLFFBQVE7QUFBQSxNQUNuQztBQUFBLElBQ0QsQ0FBQztBQUdELFNBQUssV0FBVyxNQUFNLGlDQUFpQztBQUN2RCxVQUFNLENBQUMsV0FBVyxPQUFPLFdBQVcsSUFBSSxNQUFNLFFBQVEsSUFBSTtBQUFBLE1BQ3pELGlCQUFpQixLQUFLLGNBQWMsS0FBSyxVQUFVO0FBQUEsTUFDbkQsYUFBYSxLQUFLLGNBQWMsS0FBSyxVQUFVO0FBQUEsTUFDL0MsbUJBQW1CLEtBQUssY0FBYyxLQUFLLFVBQVU7QUFBQSxJQUN0RCxDQUFDO0FBQ0QsU0FBSyxXQUFXLE1BQU0sZ0NBQWdDLFNBQVMsRUFBRTtBQUdqRSxVQUFNLEVBQUUsb0JBQW9CLG9CQUFvQixJQUFJLEtBQUssbUJBQW1CLFdBQVcsT0FBTyxXQUFXO0FBR3pHLFVBQU0sMEJBQTBCLE1BQU0sS0FBSyxhQUFhLFdBQVcsT0FBTyxhQUFhLGtCQUFrQjtBQUd6Ryw0QkFBd0IsZUFBZSxjQUFZLEtBQUssVUFBVSxJQUFJLGVBQWUsU0FBUyxJQUFJLFdBQVcsR0FBRyxTQUFTLElBQUksaUJBQWlCLENBQUMsQ0FBQyxDQUFDO0FBR2pKLDRCQUF3QixlQUFlLGNBQVksU0FBUyxJQUFJLGlCQUFpQixDQUFDO0FBR2xGLFNBQUssVUFBVSx3QkFBd0IsZUFBZSx1QkFBdUIsQ0FBQztBQUc5RSw0QkFBd0IsZUFBZSxjQUFZLEtBQUssYUFBYSxVQUFVLDJCQUEyQixtQkFBbUIsQ0FBQztBQUc5SCxTQUFLLGdCQUFnQjtBQUdyQixVQUFNLHNCQUFzQixNQUFNLHdCQUF3QixlQUFlLGNBQVksS0FBSyx5QkFBeUIsVUFBVSx5QkFBeUIsQ0FBQztBQUd2SixTQUFLLHFDQUFxQyx5QkFBeUI7QUFHbkUsU0FBSyxxQkFBcUIsUUFBUSxtQkFBbUI7QUFHckQsVUFBTSx3QkFBd0IsZUFBZSxjQUFZLEtBQUssZ0JBQWdCLFVBQVUsbUJBQW1CLENBQUM7QUFHNUcsU0FBSyxxQkFBcUIsUUFBUSxtQkFBbUI7QUFHckQsU0FBSyxnQkFBZ0I7QUFHckIsVUFBTSwyQkFBMkIsS0FBSyxVQUFVLElBQUksaUJBQWlCLE1BQU07QUFDMUUsV0FBSyxVQUFVLGtCQUFrQixNQUFNO0FBR3RDLGFBQUsscUJBQXFCLFFBQVEsbUJBQW1CO0FBR3JELGFBQUssMEJBQTBCO0FBQUEsTUFDaEMsR0FBRyxJQUFJLENBQUM7QUFBQSxJQUNULEdBQUcsSUFBSSxDQUFDO0FBQ1IsNkJBQXlCLFNBQVM7QUFBQSxFQUNuQztBQUFBLEVBRUEsTUFBYyx5QkFBeUIsVUFBNEIsMkJBQXlGO0FBQzNKLFVBQU0scUJBQXFCLEtBQUsscUJBQXFCLFNBQVMsSUFBSSxtQkFBbUI7QUFDckYsVUFBTSxhQUFhLFNBQVMsSUFBSSxXQUFXO0FBQzNDLFVBQU0sd0JBQXdCLEtBQUssd0JBQXdCLFNBQVMsSUFBSSxzQkFBc0I7QUFDOUYsVUFBTSxvQkFBb0IsU0FBUyxJQUFJLGtCQUFrQjtBQU16RCxVQUFNQyxPQUFNO0FBQ1osZUFBVyxnQkFBZ0I7QUFBQSxNQUMxQixNQUFNLFVBQVUsS0FBVSxTQUE2QztBQUN0RSxlQUFPQSxLQUFJLGtCQUFrQixvQkFBb0IsbUJBQW1CLFlBQVksS0FBSyxPQUFPO0FBQUEsTUFDN0Y7QUFBQSxJQUNELENBQUM7QUFFRCxVQUFNLHNCQUFzQixLQUFLLFVBQVUsSUFBSSxvQkFBb0I7QUFBQSxNQUNsRSxxQkFBcUIsc0JBQXNCO0FBQUEsTUFDM0Msc0JBQXNCLHNCQUFzQjtBQUFBLE1BQzVDLG1CQUFtQixNQUFNLHNCQUFzQixrQkFBa0IsRUFBRTtBQUFBLElBQ3BFLENBQUMsQ0FBQztBQUNGLFVBQU0scUJBQXFCLElBQUksYUFBYSxTQUFPLG9CQUFvQixrQkFBa0IsRUFBRSxLQUFLLFFBQU0sUUFBUSxFQUFFLENBQUM7QUFDakgsVUFBTSxtQkFBbUIsSUFBSSxpQkFBaUIsb0JBQW9CLEtBQUssVUFBVTtBQUNqRixVQUFNLG9CQUFvQiwwQkFBMEIsV0FBVyxjQUFjLGdCQUFnQjtBQUM3RixlQUFXLGdCQUFnQixJQUFJLHdCQUF3QixpQkFBaUIsQ0FBQztBQUV6RSxVQUFNLHNCQUFzQixNQUFNLEtBQUssMkJBQTJCLG9CQUFvQixpQkFBaUI7QUFDdkcsU0FBSyxVQUFVLElBQUksb0JBQW9CLHFCQUFxQixNQUFNLFlBQVksb0JBQW9CLEtBQUssd0JBQXdCLEtBQUssZ0JBQWdCLEtBQUssVUFBVSxDQUFDO0FBRXBLLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxxQ0FBcUMsMkJBQThDO0FBQzFGLFVBQU0sV0FBVyxPQUFrQyxFQUFFLFlBQVksS0FBSyxNQUFNLFlBQVk7QUFDeEYsVUFBTSx3QkFBd0IsSUFBSSxLQUFLLE1BQU0sMEJBQTBCO0FBQUEsTUFDdEU7QUFBQSxNQUNBLElBQUkseUJBQXlCO0FBQUEsSUFDOUIsQ0FBQztBQUVELGFBQVMsdUJBQXVCLFFBQVEsNkJBQTZCLENBQUMsU0FBUyxhQUFhO0FBQzNGLFlBQU0sTUFBTSxJQUFJLE1BQU0sUUFBUSxHQUFHO0FBQ2pDLFVBQUksQ0FBQyxJQUFJLFVBQVUsV0FBVyxTQUFTLEdBQUc7QUFDekMsZUFBTyxTQUFTLFNBQVMsQ0FBQztBQUFBLE1BQzNCO0FBRUEsNEJBQXNCLE1BQU0sS0FBaUMsc0NBQXNDLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFBQSxRQUN6RyxPQUFLLFNBQVMsRUFBRSxHQUFHLEdBQUcsTUFBTSxPQUFPLEtBQUssRUFBRSxNQUFNLFFBQVEsRUFBRSxDQUFDO0FBQUEsUUFDM0QsU0FBTztBQUNOLGVBQUssV0FBVyxLQUFLLDBDQUEwQyxHQUFHO0FBQ2xFLG1CQUFTLEVBQUUsWUFBWSxLQUFLLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQztBQUFBLFFBQ2hEO0FBQUEsTUFBQztBQUFBLElBQ0gsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWMsMkJBQTJCLG9CQUF5QyxtQkFBa0Y7QUFRbkssVUFBTSw4QkFBOEIsS0FBSyx1QkFBdUIsS0FBSyxVQUFVLElBQUksS0FBSyx1QkFBdUIsS0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDO0FBQ25JLFFBQUksNEJBQTRCLFNBQVMsR0FBRztBQUMzQyxXQUFLLFdBQVcsTUFBTSxxRUFBcUUsMkJBQTJCO0FBQUEsSUFDdkg7QUFHQSxVQUFNLHdCQUErQixPQUFRLFlBQVksS0FBSyxDQUFDO0FBQy9ELFFBQUksc0JBQXNCLFNBQVMsR0FBRztBQUNyQyxXQUFLLFdBQVcsTUFBTSwrRUFBK0UscUJBQXFCO0FBQUEsSUFDM0g7QUFFQSxRQUFJLDRCQUE0QixTQUFTLHNCQUFzQixXQUFXLEdBQUc7QUFDNUUsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGVBQWU7QUFBQSxNQUNwQixHQUFHO0FBQUEsTUFDSCxHQUFHO0FBQUEsSUFDSixFQUFFLElBQUksU0FBTztBQUNaLFVBQUk7QUFDSCxlQUFPLEVBQUUsS0FBSyxJQUFJLE1BQU0sR0FBRyxHQUFHLGFBQWEsSUFBSTtBQUFBLE1BQ2hELFFBQVE7QUFDUCxhQUFLLFdBQVcsTUFBTSxrRUFBa0UsR0FBRztBQUUzRixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsQ0FBQztBQUVELFVBQU0sWUFBK0IsQ0FBQztBQUN0QyxVQUFNLE9BQXVCLENBQUM7QUFDOUIsZUFBVyxlQUFlLGNBQWM7QUFDdkMsVUFBSSxDQUFDLGFBQWE7QUFDakI7QUFBQSxNQUNEO0FBRUEsWUFBTSxpQkFBaUIsS0FBSyxpQ0FBaUMsWUFBWSxHQUFHO0FBQzVFLFVBQUksZ0JBQWdCO0FBQ25CLFlBQUksTUFBTSxLQUFLLG9CQUFvQixnQkFBZ0Isb0JBQW9CLGlCQUFpQixHQUFHO0FBQzFGLGVBQUssV0FBVyxNQUFNLDhEQUE4RCxZQUFZLElBQUksU0FBUyxJQUFJLENBQUM7QUFFbEg7QUFBQSxRQUNELE9BQU87QUFDTixlQUFLLFdBQVcsTUFBTSxvRkFBb0YsWUFBWSxJQUFJLFNBQVMsSUFBSSxHQUFHLGNBQWM7QUFFeEosb0JBQVUsS0FBSyxjQUFjO0FBQUEsUUFDOUI7QUFBQSxNQUNELE9BQU87QUFDTixhQUFLLFdBQVcsTUFBTSwrRkFBK0YsWUFBWSxJQUFJLFNBQVMsSUFBSSxDQUFDO0FBRW5KLGFBQUssS0FBSyxXQUFXO0FBQUEsTUFDdEI7QUFBQSxJQUNEO0FBRUEsV0FBTyxFQUFFLE1BQU0sVUFBVTtBQUFBLEVBQzFCO0FBQUEsRUFFQSxNQUFjLG9CQUFvQixVQUEyQixvQkFBeUMsbUJBQXlEO0FBQzlKLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSSxrQkFBa0IsUUFBUSxHQUFHO0FBQ2hDLG9CQUFjLFNBQVM7QUFDdkIsZ0JBQVUsU0FBUywrQkFBK0IsZ0dBQWdHLFlBQVksV0FBVyxRQUFRLE9BQU8sYUFBYSxhQUFhLEVBQUUsSUFBSSxJQUFJLFNBQVMsS0FBSyx1QkFBdUIsQ0FBQyxJQUFJLFlBQVksU0FBUyxJQUFJLEdBQUcsS0FBSyxlQUFlLFNBQVM7QUFBQSxJQUNoVSxXQUFXLGVBQWUsUUFBUSxHQUFHO0FBQ3BDLG9CQUFjLFNBQVM7QUFDdkIsZ0JBQVUsU0FBUyw0QkFBNEIsd0ZBQXdGLFlBQVksV0FBVyxRQUFRLE9BQU8sYUFBYSxhQUFhLEVBQUUsSUFBSSxJQUFJLFNBQVMsS0FBSyx1QkFBdUIsQ0FBQyxJQUFJLFlBQVksU0FBUyxJQUFJLEdBQUcsS0FBSyxlQUFlLFNBQVM7QUFBQSxJQUNyVCxPQUFPO0FBQ04sb0JBQWMsU0FBUztBQUN2QixnQkFBVSxTQUFTLGtDQUFrQyxnR0FBZ0csWUFBWSxXQUFXLFFBQVEsT0FBTyxhQUFhLGFBQWEsRUFBRSxJQUFJLElBQUksU0FBUyxLQUFLLHVCQUF1QixDQUFDLElBQUksWUFBWSxTQUFTLElBQUksR0FBRyxLQUFLLGVBQWUsU0FBUztBQUFBLElBQ25VO0FBRUEsUUFBSSxZQUFZLFdBQVcsUUFBUSxRQUFRLFlBQVksV0FBVyxRQUFRLGNBQWM7QUFhdkYsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLHFCQUFxQixLQUFLLHFCQUFxQixTQUFrQixnQkFBZ0Isb0RBQW9ELFlBQVksTUFBTSxDQUFDO0FBQzlKLFFBQUksdUJBQXVCLE9BQU87QUFDakMsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLEVBQUUsVUFBVSxnQkFBZ0IsSUFBSSxNQUFNLGtCQUFrQixlQUFlO0FBQUEsTUFDNUUsTUFBTTtBQUFBLE1BQ04sU0FBUztBQUFBLFFBQ1IsU0FBUyxFQUFFLEtBQUssUUFBUSxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxPQUFPO0FBQUEsUUFDckUsU0FBUyxFQUFFLEtBQUssVUFBVSxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxNQUFNO0FBQUEsTUFDdkU7QUFBQSxNQUNBO0FBQUEsTUFDQSxRQUFRLFNBQVMscUJBQXFCLCtLQUErSztBQUFBLE1BQ3JOLGVBQWUsWUFBWSxXQUFXLFFBQVEsT0FBTyxTQUFTLHNCQUFzQiwwQ0FBMEMsSUFBSSxTQUFTLHVCQUF1QiwyQ0FBMkM7QUFBQSxNQUM3TSxVQUFVO0FBQUEsSUFDWCxDQUFDO0FBRUQsUUFBSSxhQUFhLEdBQUc7QUFDbkIsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLGlCQUFpQjtBQUtwQixZQUFNLFVBQVUsRUFBRSxTQUFTLDJDQUEyQyxNQUFNLFlBQVksV0FBVyxRQUFRLE9BQU8sVUFBVSxTQUFTO0FBQ3JJLHlCQUFtQixjQUFjLFFBQVEsU0FBUyxRQUFRLElBQUk7QUFDOUQseUJBQW1CLG9CQUFvQixRQUFRLFNBQVMsUUFBUSxJQUFJO0FBQUEsSUFDckU7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsaUNBQWlDLEtBQXVDO0FBQy9FLFFBQUksQ0FBQyxJQUFJLE1BQU07QUFDZCxhQUFPO0FBQUEsSUFDUjtBQUdBLFFBQUksSUFBSSxjQUFjLFFBQVEsTUFBTTtBQUNuQyxZQUFNLFVBQVUsSUFBSSxLQUFLLElBQUksTUFBTTtBQUVuQyxVQUFJLDBCQUEwQixPQUFPLEdBQUc7QUFDdkMsZUFBTyxFQUFFLGNBQWMsUUFBUTtBQUFBLE1BQ2hDO0FBRUEsYUFBTyxFQUFFLFFBQVE7QUFBQSxJQUNsQixXQUdTLElBQUksY0FBYyxRQUFRLGNBQWM7QUFNaEQsWUFBTSxjQUFjLElBQUksS0FBSztBQUFBLFFBQVEsTUFBTTtBQUFBLFFBQUs7QUFBQTtBQUFBLE1BQW1DO0FBQ25GLFVBQUk7QUFDSixVQUFJO0FBQ0osVUFBSSxnQkFBZ0IsSUFBSTtBQUN2QixvQkFBWSxJQUFJLEtBQUssVUFBVSxHQUFHLFdBQVc7QUFDN0MsZUFBTyxJQUFJLEtBQUssVUFBVSxXQUFXO0FBQUEsTUFDdEMsT0FBTztBQUNOLG9CQUFZLElBQUksS0FBSyxVQUFVLENBQUM7QUFDaEMsZUFBTztBQUFBLE1BQ1I7QUFFQSxVQUFJLFFBQVEsSUFBSTtBQUNoQixZQUFNLFNBQVMsSUFBSSxnQkFBZ0IsSUFBSSxLQUFLO0FBQzVDLFVBQUksT0FBTyxJQUFJLFVBQVUsTUFBTSxVQUFVO0FBR3hDLGVBQU8sT0FBTyxVQUFVO0FBQ3hCLGdCQUFRLE9BQU8sU0FBUztBQUFBLE1BQ3pCO0FBRUEsWUFBTSxZQUFZLElBQUksS0FBSyxFQUFFLFFBQVEsUUFBUSxjQUFjLFdBQVcsTUFBTSxPQUFPLFVBQVUsSUFBSSxTQUFTLENBQUM7QUFFM0csVUFBSSwwQkFBMEIsSUFBSSxHQUFHO0FBQ3BDLGVBQU8sRUFBRSxjQUFjLFVBQVU7QUFBQSxNQUNsQztBQUVBLFVBQUksVUFBVSxLQUFLLElBQUksR0FBRztBQUV6QixlQUFPLEVBQUUsU0FBUyxVQUFVO0FBQUEsTUFDN0I7QUFFQSxhQUFPLEVBQUUsV0FBVyxVQUFVO0FBQUEsSUFDL0I7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYyxrQkFBa0Isb0JBQXlDLG1CQUF1QyxZQUF5QixLQUFVLFNBQTZDO0FBQy9MLFNBQUssV0FBVyxNQUFNLDRCQUE0QixJQUFJLFNBQVMsSUFBSSxHQUFHLE9BQU87QUFHN0UsUUFBSSxJQUFJLFdBQVcsS0FBSyxlQUFlLGVBQWUsSUFBSSxTQUFTLGFBQWE7QUFDL0UsWUFBTSxJQUFJLEtBQUs7QUFBQSxRQUNkLFdBQVc7QUFBQSxRQUNYLE1BQU0sSUFBSSxNQUFNLElBQUksS0FBSyxFQUFFO0FBQUEsUUFDM0IsT0FBTztBQUFBLE1BQ1IsQ0FBQztBQUFBLElBQ0Y7QUFFQSxRQUFJLHdCQUF3QjtBQUc1QixVQUFNLFNBQVMsSUFBSSxnQkFBZ0IsSUFBSSxLQUFLO0FBQzVDLFFBQUksT0FBTyxJQUFJLFVBQVUsTUFBTSxVQUFVO0FBQ3hDLFdBQUssV0FBVyxNQUFNLHFHQUFxRyxJQUFJLFNBQVMsSUFBSSxDQUFDO0FBRTdJLGFBQU8sT0FBTyxVQUFVO0FBQ3hCLFlBQU0sSUFBSSxLQUFLLEVBQUUsT0FBTyxPQUFPLFNBQVMsRUFBRSxDQUFDO0FBRTNDLDhCQUF3QjtBQUFBLElBQ3pCLFdBR1MsZUFBZSxtQkFBbUIsZUFBZSxNQUFNLEdBQUc7QUFDbEUsV0FBSyxXQUFXLE1BQU0scUdBQXFHLElBQUksU0FBUyxJQUFJLENBQUM7QUFFN0ksOEJBQXdCO0FBQUEsSUFDekI7QUFHQSxVQUFNLGFBQWEsT0FBTyxJQUFJLFlBQVk7QUFDMUMsUUFBSSxlQUFlLE1BQU07QUFDeEIsV0FBSyxXQUFXLE1BQU0sNERBQTRELElBQUksU0FBUyxJQUFJLENBQUM7QUFFcEcsYUFBTyxPQUFPLFlBQVk7QUFDMUIsWUFBTSxJQUFJLEtBQUssRUFBRSxPQUFPLE9BQU8sU0FBUyxFQUFFLENBQUM7QUFFM0MsV0FBSyx1QkFBdUIsYUFBYSxjQUFjO0FBQUEsSUFDeEQ7QUFHQSxVQUFNLGdDQUFnQyxLQUFLLGlDQUFpQyxHQUFHO0FBQy9FLFFBQUksK0JBQStCO0FBQ2xDLFVBQUksTUFBTSxLQUFLLG9CQUFvQiwrQkFBK0Isb0JBQW9CLGlCQUFpQixHQUFHO0FBQ3pHLGFBQUssV0FBVyxNQUFNLHFEQUFxRCxJQUFJLFNBQVMsSUFBSSxDQUFDO0FBRTdGLGVBQU87QUFBQSxNQUNSLE9BQU87QUFDTixhQUFLLFdBQVcsTUFBTSwyREFBMkQsK0JBQStCLElBQUksU0FBUyxJQUFJLENBQUM7QUFFbEksY0FBTSxVQUFVLE1BQU0sbUJBQW1CLEtBQUs7QUFBQSxVQUM3QyxTQUFTLFlBQVk7QUFBQSxVQUNyQixLQUFLLEVBQUUsR0FBRyxLQUFLLHVCQUF1QixLQUFLO0FBQUEsVUFDM0MsWUFBWSxDQUFDLDZCQUE2QjtBQUFBLFVBQzFDLGdCQUFnQjtBQUFBLFVBQ2hCLGNBQWM7QUFBQTtBQUFBLFFBRWYsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUVSLGdCQUFRLE1BQU07QUFFZCxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFHQSxRQUFJLHVCQUF1QjtBQUMxQixXQUFLLFdBQVcsTUFBTSw2RUFBNkUsSUFBSSxTQUFTLElBQUksQ0FBQztBQUVySCxZQUFNLFVBQVUsTUFBTSxtQkFBbUIsS0FBSztBQUFBLFFBQzdDLFNBQVMsWUFBWTtBQUFBLFFBQ3JCLEtBQUssRUFBRSxHQUFHLEtBQUssdUJBQXVCLEtBQUs7QUFBQSxRQUMzQyxnQkFBZ0I7QUFBQSxRQUNoQixZQUFZO0FBQUEsUUFDWixjQUFjO0FBQUEsUUFDZCxpQkFBaUIsbUJBQW1CLEdBQUc7QUFBQSxNQUN4QyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBRVIsWUFBTSxRQUFRLE1BQU07QUFFcEIsYUFBTyxXQUFXLEtBQUssS0FBSyxPQUFPO0FBQUEsSUFDcEM7QUFFQSxTQUFLLFdBQVcsTUFBTSx3Q0FBd0MsSUFBSSxTQUFTLElBQUksR0FBRyxPQUFPO0FBRXpGLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxtQkFBbUIsV0FBbUIsT0FBZSxhQUEwSDtBQUN0TCxVQUFNLGdCQUFnQixLQUFLLFVBQVUsS0FBSyx5QkFBeUIsZUFBZSxlQUFlLFdBQVcsT0FBTyxXQUFXLENBQUM7QUFFL0gsU0FBSyxVQUFVLGNBQWMsV0FBVyxNQUFNLEtBQUssb0JBQW9CLGNBQWMsaUNBQWlDLENBQUMsQ0FBQztBQUV4SCxVQUFNLHVCQUF1QixZQUFZO0FBQ3hDLFdBQUssV0FBVyxNQUFNLDZCQUE2QjtBQUVuRCxZQUFNLE9BQU8sTUFBTSxjQUFjLFFBQVE7QUFFekMsV0FBSyxXQUFXLE1BQU0scURBQXFEO0FBRTNFLGFBQU8sSUFBSSxrQkFBa0IsTUFBTSxNQUFNO0FBQUEsSUFDMUMsR0FBRztBQUVILFVBQU0sc0JBQXNCLFlBQVk7QUFDdkMsWUFBTSxjQUFjLFVBQVU7QUFFOUIsYUFBTztBQUFBLElBQ1IsR0FBRztBQUVILFdBQU8sRUFBRSxvQkFBb0Isb0JBQW9CO0FBQUEsRUFDbEQ7QUFBQSxFQUVBLE1BQWMsYUFBYSxXQUFtQixPQUFlLGFBQXFCLG9CQUFnRjtBQUNqSyxVQUFNLFdBQVcsSUFBSSxrQkFBa0I7QUFHdkMsWUFBUSxRQUFRLFVBQVU7QUFBQSxNQUN6QixLQUFLO0FBQ0osaUJBQVMsSUFBSSxnQkFBZ0IsSUFBSSxlQUFlLGtCQUFrQixDQUFDO0FBQ25FO0FBQUEsTUFFRCxLQUFLO0FBQ0osWUFBSSxhQUFhO0FBQ2hCLG1CQUFTLElBQUksZ0JBQWdCLElBQUksZUFBZSxtQkFBbUIsQ0FBQyxRQUFRLElBQUksTUFBTSxHQUFHLFFBQVEsSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDO0FBQUEsUUFDeEgsT0FBTztBQUNOLG1CQUFTLElBQUksZ0JBQWdCLElBQUksZUFBZSxrQkFBa0IsQ0FBQztBQUFBLFFBQ3BFO0FBQ0E7QUFBQSxNQUVELEtBQUs7QUFDSixpQkFBUyxJQUFJLGdCQUFnQixJQUFJLGVBQWUsbUJBQW1CLENBQUM7QUFDcEU7QUFBQSxJQUNGO0FBR0EsYUFBUyxJQUFJLHFCQUFxQixJQUFJLGVBQWUsb0JBQW9CLENBQUMsV0FBVyxPQUFPLGFBQWEsS0FBSyxPQUFPLEdBQUcsS0FBSyxDQUFDO0FBQzlILGFBQVMsSUFBSSw4QkFBOEIsSUFBSSxlQUFlLDZCQUE2QixRQUFXLEtBQUssQ0FBQztBQUc1RyxVQUFNLG9CQUFvQixJQUFJLGtCQUFrQixLQUFLLFlBQVksS0FBSyxjQUFjO0FBQ3BGLGFBQVMsSUFBSSxvQkFBb0IsaUJBQWlCO0FBR2xELGFBQVMsSUFBSSxvQkFBb0IsSUFBSTtBQUFBLE1BQWU7QUFBQSxNQUFtQjtBQUFBLE1BQVc7QUFBQTtBQUFBLElBQXNDLENBQUM7QUFHekgsYUFBUyxJQUFJLHlCQUF5QixJQUFJO0FBQUEsTUFBZTtBQUFBLE1BQXdCO0FBQUEsTUFBVztBQUFBO0FBQUEsSUFBc0MsQ0FBQztBQUNuSSxhQUFTLElBQUkscUJBQXFCLGFBQWEsVUFBVSxrQkFBa0IsbUJBQW1CLEtBQUssWUFBVSxPQUFPLFdBQVcsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBR2hKLGFBQVMsSUFBSSxxQkFBcUIsSUFBSSxlQUFlLG9CQUFvQixDQUFDLEtBQUssT0FBTyxDQUFDLENBQUM7QUFHeEYsYUFBUyxJQUFJLHdCQUF3QixJQUFJLGVBQWUscUJBQXFCLENBQUM7QUFHOUUsYUFBUyxJQUFJLDRCQUE0QixJQUFJLGVBQWUseUJBQXlCLENBQUM7QUFHdEYsYUFBUyxJQUFJLHdCQUF3QixJQUFJO0FBQUEsTUFBZTtBQUFBLE1BQXVCO0FBQUEsTUFBVztBQUFBO0FBQUEsSUFBc0MsQ0FBQztBQUdqSSxhQUFTLElBQUksNkJBQTZCLElBQUk7QUFBQSxNQUFlO0FBQUEsTUFBa0M7QUFBQSxNQUFXO0FBQUE7QUFBQSxJQUFzQyxDQUFDO0FBR2pKLGFBQVMsSUFBSSx3QkFBd0IsSUFBSSxlQUFlLGtCQUFrQixDQUFDO0FBRzNFLGFBQVMsSUFBSSxxQkFBcUIsSUFBSSxlQUFlLGtCQUFrQixDQUFDO0FBR3hFLGFBQVMsSUFBSSx1QkFBdUIsSUFBSSxlQUFlLG9CQUFvQixDQUFDO0FBRzVFLGFBQVMsSUFBSSxxQkFBcUIsSUFBSSxlQUFlLGtCQUFrQixDQUFDO0FBQ3hFLGFBQVMsSUFBSSxnQ0FBZ0MsSUFBSSxlQUFlLDZCQUE2QixDQUFDO0FBRzlGLFVBQU0saUJBQWlCLElBQUksdUJBQXVCO0FBQUEsTUFDakQsV0FBVyx3QkFBd0I7QUFBQSxNQUNuQyxnQkFBZ0Isd0JBQXdCO0FBQUEsTUFDeEMsWUFBWSxLQUFLLHFCQUFxQixTQUFpQixrQkFBa0IsMkJBQTJCLEtBQUs7QUFBQSxJQUMxRyxHQUFHLEtBQUssc0JBQXNCLEtBQUssd0JBQXdCLEtBQUssc0JBQXNCLEtBQUssVUFBVTtBQUNyRyxVQUFNLGlCQUFpQixJQUFJO0FBQUEsTUFDMUI7QUFBQSxNQUNBLEtBQUs7QUFBQSxNQUNMLEtBQUs7QUFBQSxNQUNMLEtBQUs7QUFBQSxJQUNOO0FBQ0EsYUFBUyxJQUFJLGtCQUFrQixjQUFjO0FBRzdDLFFBQUksV0FBVztBQUNkLGVBQVMsSUFBSSw4QkFBOEIsSUFBSSxlQUFlLDhCQUE4QixDQUFDO0FBQUEsSUFDOUYsV0FBVyxhQUFhO0FBQ3ZCLGVBQVMsSUFBSSw4QkFBOEIsSUFBSSxlQUFlLDBCQUEwQixDQUFDO0FBQUEsSUFDMUYsV0FBVyxTQUFTO0FBQ25CLGVBQVMsSUFBSSw4QkFBOEIsSUFBSSxlQUFlLDRCQUE0QixDQUFDO0FBQUEsSUFDNUY7QUFHQSxVQUFNLG9CQUFvQixJQUFJLGtCQUFrQixLQUFLLHdCQUF3QixLQUFLLHNCQUFzQixLQUFLLFlBQVksS0FBSyxZQUFZO0FBQzFJLGFBQVMsSUFBSSxvQkFBb0IsaUJBQWlCO0FBR2xELFVBQU0sa0NBQWtDLElBQUksZ0NBQWdDLEtBQUssd0JBQXdCLEtBQUssWUFBWSxLQUFLLDZCQUE2QixtQkFBbUIsaUJBQWlCO0FBQ2hNLGFBQVMsSUFBSSxrQ0FBa0MsK0JBQStCO0FBQzlFLGFBQVMsSUFBSSxvQkFBb0IsSUFBSTtBQUFBLE1BQWU7QUFBQSxNQUF1QjtBQUFBLE1BQVc7QUFBQTtBQUFBLElBQXNDLENBQUM7QUFDN0gsYUFBUyxJQUFJLCtCQUErQixJQUFJLGVBQWUsOEJBQThCLFFBQVcsS0FBSyxDQUFDO0FBRzlHLGFBQVMsSUFBSSxhQUFhLElBQUk7QUFBQSxNQUFlO0FBQUEsTUFBa0I7QUFBQSxNQUFXO0FBQUE7QUFBQSxJQUFzQyxDQUFDO0FBR2pILFFBQUksa0JBQWtCLEtBQUssZ0JBQWdCLEtBQUssc0JBQXNCLEdBQUc7QUFDeEUsWUFBTSxhQUFhLG9CQUFvQixLQUFLLGdCQUFnQixLQUFLLG9CQUFvQjtBQUNyRixZQUFNLFVBQVUsa0JBQWtCLG1CQUFtQixLQUFLLFlBQVUsT0FBTyxXQUFXLG1CQUFtQixDQUFDLENBQUM7QUFDM0csWUFBTSxXQUFXLElBQUksd0JBQXdCLE9BQU87QUFDcEQsWUFBTSxtQkFBbUIsd0JBQXdCLFFBQVEsR0FBRyxTQUFTLEdBQUcsUUFBUSxNQUFNLEtBQUssZUFBZSxRQUFRLEtBQUssZUFBZSxTQUFTLFdBQVcsT0FBTyxhQUFhLFVBQVU7QUFDeEwsWUFBTSxXQUFXLDJCQUEyQixLQUFLLHNCQUFzQjtBQUN2RSxZQUFNLFNBQWtDLEVBQUUsV0FBVyxDQUFDLFFBQVEsR0FBRyxrQkFBa0IsVUFBVSxvQkFBb0IsS0FBSztBQUV0SCxlQUFTLElBQUksbUJBQW1CLElBQUksZUFBZSxrQkFBa0IsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0FBQUEsSUFDdEYsT0FBTztBQUNOLGVBQVMsSUFBSSxtQkFBbUIsb0JBQW9CO0FBQUEsSUFDckQ7QUFHQSxhQUFTLElBQUksaUJBQWlCLElBQUksZUFBZSxvQkFBb0IsUUFBVyxLQUFLLENBQUM7QUFDdEYsYUFBUyxJQUFJLG9CQUFvQixJQUFJLGVBQWUsdUJBQXVCLFFBQVcsS0FBSyxDQUFDO0FBQzVGLGFBQVMsSUFBSSxpQkFBaUIsSUFBSSxlQUFlLGdCQUFnQixRQUFXLEtBQUssQ0FBQztBQUdsRixhQUFTLElBQUksa0NBQWtDLElBQUksZUFBZSxpQ0FBaUMsUUFBVyxJQUFJLENBQUM7QUFDbkgsYUFBUyxJQUFJLDJCQUEyQixJQUFJLGVBQWUsMEJBQTBCLFFBQVcsSUFBSSxDQUFDO0FBR3JHLGFBQVMsSUFBSSxrQ0FBa0MsSUFBSSxlQUFlLGlDQUFpQyxRQUFXLElBQUksQ0FBQztBQUduSCxhQUFTLElBQUksbUJBQW1CLElBQUksZUFBZSxnQkFBZ0IsQ0FBQztBQUdwRSxhQUFTLElBQUksa0NBQWtDLElBQUksZUFBZSwrQkFBK0IsQ0FBQztBQUlsRyxhQUFTLElBQUksd0JBQXdCLElBQUksZUFBZSx1QkFBdUIsUUFBVyxJQUFJLENBQUM7QUFHL0YsVUFBTSxTQUFTLFFBQVE7QUFBQSxNQUN0QixrQkFBa0IsV0FBVztBQUFBLE1BQzdCLGdDQUFnQyxXQUFXO0FBQUEsSUFDNUMsQ0FBQztBQUVELFdBQU8sS0FBSyx5QkFBeUIsWUFBWSxRQUFRO0FBQUEsRUFDMUQ7QUFBQSxFQUVRLGFBQWEsVUFBNEIsMkJBQThDLHFCQUF1RDtBQU9ySixVQUFNLGNBQWMsS0FBSyxVQUFVLElBQUksZ0JBQWdCLENBQUM7QUFFeEQsVUFBTSxnQkFBZ0IsYUFBYSxZQUFZLFNBQVMsSUFBSSxrQkFBa0IsR0FBRyxhQUFhLEVBQUUsb0JBQW9CLEtBQUssQ0FBQztBQUMxSCxTQUFLLHlCQUF5QixnQkFBZ0IsVUFBVSxhQUFhO0FBRXJFLFVBQU0scUJBQXFCLGFBQWEsWUFBWSxTQUFTLElBQUksdUJBQXVCLEdBQUcsYUFBYSxFQUFFLG9CQUFvQixLQUFLLENBQUM7QUFDcEksU0FBSyx5QkFBeUIsZ0JBQWdCLGVBQWUsa0JBQWtCO0FBRy9FLFVBQU0sZ0JBQWdCLFlBQVksSUFBSSxJQUFJLGNBQWMsU0FBUyxJQUFJLGNBQWMsQ0FBQyxDQUFDO0FBQ3JGLDhCQUEwQixnQkFBZ0IsVUFBVSxhQUFhO0FBQ2pFLHdCQUFvQixLQUFLLFlBQVUsT0FBTyxnQkFBZ0IsVUFBVSxhQUFhLENBQUM7QUFHbEYsVUFBTSx5QkFBeUIsS0FBSyxZQUFZLFlBQVksUUFBUSxJQUFJO0FBQ3hFLGVBQVcsa0NBQWtDLHNCQUFzQjtBQUNuRSxVQUFNLDRCQUE0QixZQUFZLElBQUksSUFBSSw4QkFBOEIsd0JBQXdCLEtBQUssWUFBWSxLQUFLLHNCQUFzQixDQUFDO0FBQ3pKLDhCQUEwQixnQkFBZ0IsZ0NBQWdDLHlCQUF5QjtBQUNuRyx3QkFBb0IsS0FBSyxZQUFVLE9BQU8sZ0JBQWdCLGdDQUFnQyx5QkFBeUIsQ0FBQztBQUdwSCxVQUFNLDBCQUEwQixhQUFhLFlBQVksU0FBUyxJQUFJLDRCQUE0QixHQUFHLFdBQVc7QUFDaEgsOEJBQTBCLGdCQUFnQixvQkFBb0IsdUJBQXVCO0FBQ3JGLHdCQUFvQixLQUFLLFlBQVUsT0FBTyxnQkFBZ0Isb0JBQW9CLHVCQUF1QixDQUFDO0FBR3RHLFVBQU0sZ0JBQWdCLElBQUksY0FBYyxTQUFTLElBQUksY0FBYyxDQUFDO0FBQ3BFLDhCQUEwQixnQkFBZ0IsVUFBVSxhQUFhO0FBR2pFLFVBQU0saUJBQWlCLGFBQWEsWUFBWSxTQUFTLElBQUksbUJBQW1CLEdBQUcsV0FBVztBQUM5Riw4QkFBMEIsZ0JBQWdCLFdBQVcsY0FBYztBQUduRSxVQUFNLG9CQUFvQixhQUFhLFlBQVksU0FBUyxJQUFJLHNCQUFzQixHQUFHLFdBQVc7QUFDcEcsOEJBQTBCLGdCQUFnQixjQUFjLGlCQUFpQjtBQUd6RSxVQUFNLGNBQWMsYUFBYSxZQUFZLFNBQVMsSUFBSSxZQUFZLEdBQUcsV0FBVztBQUNwRiw4QkFBMEIsZ0JBQWdCLFFBQVEsV0FBVztBQUc3RCxVQUFNLHdCQUF3QixhQUFhLFlBQVksU0FBUyxJQUFJLDBCQUEwQixHQUFHLFdBQVc7QUFDNUcsOEJBQTBCLGdCQUFnQixrQkFBa0IscUJBQXFCO0FBR2pGLFNBQUssd0JBQXdCLFNBQVMsSUFBSSxzQkFBc0I7QUFDaEUsVUFBTSxvQkFBb0IsYUFBYSxZQUFZLEtBQUssdUJBQXVCLFdBQVc7QUFDMUYsOEJBQTBCLGdCQUFnQixjQUFjLGlCQUFpQjtBQUN6RSx3QkFBb0IsS0FBSyxZQUFVLE9BQU8sZ0JBQWdCLGNBQWMsaUJBQWlCLENBQUM7QUFHMUYsVUFBTSw2QkFBNkIsYUFBYSxZQUFZLFNBQVMsSUFBSSwyQkFBMkIsR0FBRyxXQUFXO0FBQ2xILDhCQUEwQixnQkFBZ0IsdUJBQXVCLDBCQUEwQjtBQUczRixVQUFNLG9CQUFvQixhQUFhLFlBQVksU0FBUyxJQUFJLGtCQUFrQixHQUFHLFdBQVc7QUFDaEcsOEJBQTBCLGdCQUFnQixjQUFjLGlCQUFpQjtBQUd6RSxVQUFNLGlCQUFpQixhQUFhLFlBQVksU0FBUyxJQUFJLG1CQUFtQixHQUFHLFdBQVc7QUFDOUYsOEJBQTBCLGdCQUFnQixXQUFXLGNBQWM7QUFHbkUsVUFBTSxhQUFhLGFBQWEsWUFBWSxTQUFTLElBQUksV0FBVyxHQUFHLFdBQVc7QUFDbEYsOEJBQTBCLGdCQUFnQixPQUFPLFVBQVU7QUFHM0QsVUFBTSxpQkFBaUIsYUFBYSxZQUFZLFNBQVMsSUFBSSxzQkFBc0IsR0FBRyxXQUFXO0FBQ2pHLDhCQUEwQixnQkFBZ0IsV0FBVyxjQUFjO0FBR25FLFVBQU0saUJBQWlCLFlBQVksSUFBSyxJQUFJLHVCQUF1QixLQUFLLFlBQVksU0FBUyxJQUFJLG1CQUFtQixDQUFDLENBQUU7QUFDdkgsOEJBQTBCLGdCQUFnQixXQUFXLGNBQWM7QUFDbkUsd0JBQW9CLEtBQUssWUFBVSxPQUFPLGdCQUFnQixXQUFXLGNBQWMsQ0FBQztBQUdwRixVQUFNLHlCQUF5QixZQUFZLElBQUssSUFBSSxxQ0FBcUMsU0FBUyxJQUFJLG1CQUFtQixHQUFHLFNBQVMsSUFBSSw0QkFBNEIsR0FBRyxLQUFLLFVBQVUsQ0FBRTtBQUN6TCx3QkFBb0IsS0FBSyxZQUFVLE9BQU8sZ0JBQWdCLDBCQUEwQixzQkFBc0IsQ0FBQztBQUczRyxVQUFNLGlCQUFpQixhQUFhLFlBQVksU0FBUyxJQUFJLGdCQUFnQixHQUFHLFdBQVc7QUFDM0YsOEJBQTBCLGdCQUFnQixvQkFBb0IsVUFBVSxjQUFjO0FBR3RGLFVBQU0sMEJBQTBCLGFBQWEsWUFBWSxTQUFTLElBQUksNEJBQTRCLEdBQUcsV0FBVztBQUNoSCw4QkFBMEIsZ0JBQWdCLG9CQUFvQix1QkFBdUI7QUFHckYsVUFBTSxzQkFBc0IsYUFBYSxZQUFZLFNBQVMsSUFBSSxnQ0FBZ0MsR0FBRyxXQUFXO0FBQ2hILDhCQUEwQixnQkFBZ0IscUNBQXFDLG1CQUFtQjtBQUdsRyxVQUFNLGdCQUFnQixJQUFJLGNBQWMsU0FBUyxJQUFJLGtCQUFrQixDQUFFO0FBQ3pFLDhCQUEwQixnQkFBZ0IsVUFBVSxhQUFhO0FBQ2pFLHdCQUFvQixLQUFLLFlBQVUsT0FBTyxnQkFBZ0IsVUFBVSxhQUFhLENBQUM7QUFHbEYsVUFBTSxpQkFBaUIsYUFBYSxZQUFZLFNBQVMsSUFBSSxlQUFlLEdBQUcsV0FBVztBQUMxRiw4QkFBMEIsZ0JBQWdCLHdCQUF3QixjQUFjO0FBRWhGLFVBQU0scUJBQXFCLGFBQWEsWUFBWSxTQUFTLElBQUksa0JBQWtCLEdBQUcsV0FBVztBQUNqRyw4QkFBMEIsZ0JBQWdCLHVCQUF1QixrQkFBa0I7QUFFbkYsVUFBTSx3QkFBd0IsSUFBSSxrQkFBa0IsU0FBUyxJQUFJLGVBQWUsQ0FBQztBQUNqRiw4QkFBMEIsZ0JBQWdCLDJCQUEyQixxQkFBcUI7QUFHMUYsVUFBTSxpQkFBaUIsYUFBYSxZQUFZLFNBQVMsSUFBSSxlQUFlLEdBQUcsV0FBVztBQUMxRiw4QkFBMEIsZ0JBQWdCLG9CQUFvQixjQUFjO0FBRzVFLFVBQU0sYUFBYSxJQUFJLFdBQVc7QUFDbEMsOEJBQTBCLGdCQUFnQixvQkFBb0IsVUFBVTtBQUd4RSxVQUFNLDZDQUE2QyxJQUFJLDJDQUEyQyxTQUFTLElBQUksbUJBQW1CLENBQUM7QUFDbkksOEJBQTBCLGdCQUFnQiw2QkFBNkIsMENBQTBDO0FBR2pILFVBQU0sOEJBQThCLGFBQWEsWUFBWSxTQUFTLElBQUkscUJBQXFCLEdBQUcsV0FBVztBQUM3Ryw4QkFBMEIsZ0JBQWdCLG9DQUFvQywyQkFBMkI7QUFHekcsVUFBTSw4QkFBOEIsYUFBYSxZQUFZLFNBQVMsSUFBSSxnQ0FBZ0MsR0FBRyxXQUFXO0FBQ3hILDhCQUEwQixnQkFBZ0Isb0NBQW9DLDJCQUEyQjtBQUFBLEVBQzFHO0FBQUEsRUFFQSxNQUFjLGdCQUFnQixVQUE0QixxQkFBK0U7QUFDeEksVUFBTSxxQkFBcUIsS0FBSyxxQkFBcUIsU0FBUyxJQUFJLG1CQUFtQjtBQUNyRixTQUFLLDhCQUE4QixTQUFTLElBQUksNEJBQTRCO0FBRTVFLFVBQU0sVUFBVSxrQkFBa0IsUUFBUSxHQUFHLElBQUksWUFBWSxNQUFNLFlBQVk7QUFDL0UsVUFBTSxPQUFPLEtBQUssdUJBQXVCO0FBR3pDLFFBQUkscUJBQXFCO0FBR3hCLFVBQUksb0JBQW9CLFVBQVUsU0FBUyxHQUFHO0FBQzdDLGVBQU8sbUJBQW1CLEtBQUs7QUFBQSxVQUM5QjtBQUFBLFVBQ0EsS0FBSztBQUFBLFVBQ0wsWUFBWSxvQkFBb0I7QUFBQSxVQUNoQyxjQUFjO0FBQUEsVUFDZCxnQkFBZ0I7QUFBQTtBQUFBLFFBRWpCLENBQUM7QUFBQSxNQUNGO0FBVUEsVUFBSSxvQkFBb0IsS0FBSyxTQUFTLEdBQUc7QUFDeEMsbUJBQVcsZUFBZSxvQkFBb0IsTUFBTTtBQUNuRCxnQkFBTSxTQUFTLElBQUksZ0JBQWdCLFlBQVksSUFBSSxLQUFLO0FBQ3hELGNBQUksT0FBTyxJQUFJLFVBQVUsTUFBTSxVQUFVO0FBS3hDLG1CQUFPLE9BQU8sVUFBVTtBQUN4Qix3QkFBWSxjQUFjLFlBQVksSUFBSSxTQUFTLElBQUk7QUFDdkQsd0JBQVksTUFBTSxZQUFZLElBQUksS0FBSyxFQUFFLE9BQU8sT0FBTyxTQUFTLEVBQUUsQ0FBQztBQUVuRSxtQkFBTyxtQkFBbUIsS0FBSztBQUFBLGNBQzlCO0FBQUEsY0FDQSxLQUFLO0FBQUEsY0FDTCxnQkFBZ0I7QUFBQSxjQUNoQixZQUFZO0FBQUEsY0FDWixjQUFjO0FBQUEsY0FDZCxnQkFBZ0I7QUFBQTtBQUFBLFlBRWpCLENBQUM7QUFBQSxVQUNGO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsVUFBTSxlQUErQixPQUFRO0FBQzdDLFVBQU0sYUFBYSxLQUFLLEVBQUU7QUFDMUIsVUFBTSxnQkFBZ0IsQ0FBQyxDQUFDLEtBQUssWUFBWTtBQUN6QyxVQUFNLGNBQWMsQ0FBQyxDQUFDLEtBQUssVUFBVTtBQUNyQyxVQUFNLGdCQUFnQixLQUFLLDZCQUE2QixNQUFNO0FBQzlELFVBQU0sb0JBQW9CLEtBQUssUUFBUSxLQUFLLHFCQUFxQixJQUFJLEtBQUssS0FBSyxrQkFBa0IsSUFBSTtBQUNyRyxVQUFNLGtCQUFrQixLQUFLLFVBQVU7QUFDdkMsVUFBTSxlQUFlLEtBQUs7QUFDMUIsVUFBTSxtQkFBbUIsS0FBSyxjQUFjO0FBRzVDLFFBQUksQ0FBQyxjQUFjLENBQUMsaUJBQWlCLENBQUMsYUFBYTtBQUdsRCxVQUFJLEtBQUssWUFBWSxLQUFLLGdCQUFnQixrQkFBa0I7QUFDM0QsZUFBTyxtQkFBbUIsS0FBSztBQUFBLFVBQzlCO0FBQUEsVUFDQSxLQUFLO0FBQUEsVUFDTCxnQkFBZ0I7QUFBQSxVQUNoQixZQUFZO0FBQUEsVUFDWjtBQUFBLFVBQ0E7QUFBQSxVQUNBLGdCQUFnQjtBQUFBLFVBQ2hCO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBR0EsVUFBSSxhQUFhLFFBQVE7QUFDeEIsZUFBTyxtQkFBbUIsS0FBSztBQUFBLFVBQzlCLFNBQVMsWUFBWTtBQUFBLFVBQ3JCLEtBQUs7QUFBQSxVQUNMLFlBQVksYUFBYSxJQUFJLFVBQVE7QUFDcEMsbUJBQU8sYUFBYSxJQUFJO0FBRXhCLG1CQUFRLDBCQUEwQixJQUFJLElBQUksRUFBRSxjQUFjLElBQUksS0FBSyxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsSUFBSSxLQUFLLElBQUksRUFBRTtBQUFBLFVBQ3hHLENBQUM7QUFBQSxVQUNEO0FBQUEsVUFDQTtBQUFBLFVBQ0EsZ0JBQWdCO0FBQUE7QUFBQSxRQUVqQixDQUFDO0FBQUEsTUFDRjtBQUFBLElBQ0Q7QUFHQSxXQUFPLG1CQUFtQixLQUFLO0FBQUEsTUFDOUI7QUFBQSxNQUNBLEtBQUs7QUFBQSxNQUNMLGdCQUFnQixLQUFLLFlBQVk7QUFBQSxNQUNqQyxVQUFVLEtBQUs7QUFBQSxNQUNmLFdBQVcsS0FBSztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLE1BQ0EsY0FBYyxLQUFLO0FBQUEsTUFDbkIsZ0JBQWdCO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLGtCQUF3QjtBQUcvQixTQUFLLGFBQWE7QUFHbEIsYUFBUyxxQkFBcUIsUUFBUSxzQkFBc0IsQ0FBQyxTQUFTLGFBQWE7QUFDbEYsZUFBUztBQUFBLFFBQ1IsS0FBSyxRQUFRLElBQUksUUFBUSw0QkFBNEIsT0FBTztBQUFBLFFBQzVELFFBQVEsUUFBUTtBQUFBLE1BQ2pCLENBQUM7QUFBQSxJQUNGLENBQUM7QUFNRCxTQUFLLHdCQUF3QixLQUFLLHVCQUF1QixNQUFNLFFBQVEsS0FBSyxJQUFJO0FBR2hGLFNBQUssOEJBQThCO0FBR25DLFFBQUksZUFBZSxJQUFJLDhCQUE4QjtBQUNwRCxXQUFLLG9CQUFvQixjQUFjLG1DQUFtQztBQUFBLElBQzNFO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyxlQUE4QjtBQUMzQyxVQUFNLGlCQUFpQixLQUFLLGVBQWU7QUFDM0MsUUFBSSxhQUFhLGdCQUFnQjtBQUNoQyxVQUFJO0FBQ0gsY0FBTSxlQUFlLE1BQU0sT0FBTyx1QkFBdUI7QUFDekQsY0FBTSxRQUFRLElBQUksYUFBYSxNQUFNLGNBQWM7QUFDbkQsY0FBTSxLQUFLLEtBQUsscUJBQXFCLGNBQWMsRUFBRSxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQUEsTUFDM0UsU0FBUyxPQUFPO0FBQ2YsYUFBSyxXQUFXLE1BQU0sS0FBSztBQUFBLE1BQzVCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsd0JBQXdCLE1BQXdCLEtBQTBCLGVBQXFEO0FBQzVJLFFBQUk7QUFDSCxhQUFPLE1BQU0sb0JBQW9CLEtBQUssc0JBQXNCLEtBQUssWUFBWSxNQUFNLEdBQUc7QUFBQSxJQUN2RixTQUFTLE9BQU87QUFDZixZQUFNLGVBQWUsZUFBZSxLQUFLO0FBQ3pDLFVBQUksZUFBZTtBQUNsQixhQUFLLG9CQUFvQixjQUFjLG1DQUFtQyxZQUFZO0FBQUEsTUFDdkYsT0FBTztBQUNOLGFBQUssV0FBVyxNQUFNLFlBQVk7QUFBQSxNQUNuQztBQUFBLElBQ0Q7QUFFQSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBQUEsRUFFQSxNQUFjLGdDQUErQztBQU01RCxRQUFJO0FBQ0gsWUFBTSxjQUFjLE1BQU0sS0FBSyxZQUFZLFNBQVMsS0FBSyx1QkFBdUIsWUFBWTtBQUM1RixZQUFNLGFBQWEsWUFBWSxNQUFNLFNBQVM7QUFDOUMsWUFBTSxXQUFXLE1BQTZDLFVBQVU7QUFDeEUsWUFBTSxpQkFBaUIsa0JBQWtCLEtBQUssb0JBQW9CO0FBQ2xFLFlBQU0sc0JBQXNCLGtCQUFrQixlQUFlO0FBRzdELFVBQUksU0FBUyx1QkFBdUIsTUFBTSxRQUFXO0FBQ3BELGNBQU0sd0JBQXdCO0FBQUEsVUFDN0I7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0EsNkJBQTZCLG1CQUFtQjtBQUFBLFVBQ2hEO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBLDBCQUEwQixhQUFhLENBQUM7QUFBQSxVQUN4QztBQUFBLFFBQ0Q7QUFDQSxjQUFNLGdCQUFnQixXQUFXLFVBQVUsR0FBRyxXQUFXLFNBQVMsQ0FBQyxFQUFFLE9BQU8sT0FBTyxzQkFBc0IsS0FBSyxJQUFJLENBQUM7QUFFbkgsY0FBTSxLQUFLLFlBQVksVUFBVSxLQUFLLHVCQUF1QixjQUFjLFNBQVMsV0FBVyxhQUFhLENBQUM7QUFBQSxNQUM5RyxPQUdLO0FBQ0osY0FBTSxnQkFBZ0IsV0FBVyxRQUFRLGdDQUFnQyw0QkFBNEIsbUJBQW1CLEdBQUc7QUFDM0gsWUFBSSxrQkFBa0IsWUFBWTtBQUNqQyxnQkFBTSxLQUFLLFlBQVksVUFBVSxLQUFLLHVCQUF1QixjQUFjLFNBQVMsV0FBVyxhQUFhLENBQUM7QUFBQSxRQUM5RztBQUFBLE1BQ0Q7QUFBQSxJQUNELFNBQVMsT0FBTztBQUNmLFdBQUssV0FBVyxNQUFNLEtBQUs7QUFHM0IsV0FBSyxvQkFBb0IsY0FBYyw2QkFBNkI7QUFBQSxJQUNyRTtBQUFBLEVBQ0Q7QUFBQSxFQUVRLDRCQUFrQztBQUl6Qyx3QkFBb0IsS0FBSyxjQUFjLEtBQUssVUFBVTtBQUFBLEVBQ3ZEO0FBQ0Q7QUE3MkNhLGdCQUVZLHNEQUFzRDtBQUFBLEVBQzdFLENBQUMsUUFBUSxJQUFJLEdBQUc7QUFBQSxFQUNoQixDQUFDLFFBQVEsWUFBWSxHQUFHO0FBQ3pCO0FBTFksa0JBQU47QUFBQSxFQWNKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0F2QlU7IiwKICAibmFtZXMiOiBbImV2ZW50IiwgImFwcCJdCn0K
