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
import electron from "electron";
import { DeferredPromise, RunOnceScheduler, timeout, Delayer } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { FileAccess, Schemas } from "../../../base/common/network.js";
import { getMarks, mark } from "../../../base/common/performance.js";
import { isBigSurOrNewer, isMacintosh, isWindows } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { release } from "os";
import { IBackupMainService } from "../../backup/electron-main/backup.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IDialogMainService } from "../../dialogs/electron-main/dialogMainService.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { isLaunchedFromCli } from "../../environment/node/argvHelper.js";
import { IFileService } from "../../files/common/files.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { IProtocolMainService } from "../../protocol/electron-main/protocol.js";
import { resolveMarketplaceHeaders } from "../../externalServices/common/marketplace.js";
import { IApplicationStorageMainService, IStorageMainService } from "../../storage/electron-main/storageMainService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { IThemeMainService } from "../../theme/electron-main/themeMainService.js";
import { getMenuBarVisibility, hasNativeTitlebar, useNativeFullScreen, useWindowControlsOverlay, DEFAULT_CUSTOM_TITLEBAR_HEIGHT, TitlebarStyle } from "../../window/common/window.js";
import { defaultBrowserWindowOptions, getAllWindowsExcludingOffscreen, IWindowsMainService, OpenContext, WindowStateValidator } from "./windows.js";
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, toWorkspaceIdentifier } from "../../workspace/common/workspace.js";
import { IWorkspacesManagementMainService } from "../../workspaces/electron-main/workspacesManagementMainService.js";
import { WindowMode, WindowError, LoadReason, defaultWindowState } from "../../window/electron-main/window.js";
import { IPolicyService } from "../../policy/common/policy.js";
import { IStateService } from "../../state/node/state.js";
import { IUserDataProfilesMainService } from "../../userDataProfile/electron-main/userDataProfile.js";
import { ILoggerMainService } from "../../log/electron-main/loggerService.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { errorHandler } from "../../../base/common/errors.js";
var ReadyState = /* @__PURE__ */ ((ReadyState2) => {
  ReadyState2[ReadyState2["NONE"] = 0] = "NONE";
  ReadyState2[ReadyState2["NAVIGATING"] = 1] = "NAVIGATING";
  ReadyState2[ReadyState2["READY"] = 2] = "READY";
  return ReadyState2;
})(ReadyState || {});
const _BaseWindow = class _BaseWindow extends Disposable {
  constructor(configurationService, stateService, environmentMainService, logService) {
    super();
    this.configurationService = configurationService;
    this.stateService = stateService;
    this.environmentMainService = environmentMainService;
    this.logService = logService;
    //#region Events
    this._onDidClose = this._register(new Emitter());
    this.onDidClose = this._onDidClose.event;
    this._onDidMaximize = this._register(new Emitter());
    this.onDidMaximize = this._onDidMaximize.event;
    this._onDidUnmaximize = this._register(new Emitter());
    this.onDidUnmaximize = this._onDidUnmaximize.event;
    this._onDidTriggerSystemContextMenu = this._register(new Emitter());
    this.onDidTriggerSystemContextMenu = this._onDidTriggerSystemContextMenu.event;
    this._onDidEnterFullScreen = this._register(new Emitter());
    this.onDidEnterFullScreen = this._onDidEnterFullScreen.event;
    this._onDidLeaveFullScreen = this._register(new Emitter());
    this.onDidLeaveFullScreen = this._onDidLeaveFullScreen.event;
    this._lastFocusTime = Date.now();
    this._win = null;
    //#endregion
    //#region Fullscreen
    this.transientIsNativeFullScreen = void 0;
    this.joinNativeFullScreenTransition = void 0;
  }
  // window is shown on creation so take current time
  get lastFocusTime() {
    return this._lastFocusTime;
  }
  get win() {
    return this._win;
  }
  setWin(win, options) {
    this._win = win;
    this._register(Event.fromNodeEventEmitter(win, "maximize")(() => this._onDidMaximize.fire()));
    this._register(Event.fromNodeEventEmitter(win, "unmaximize")(() => this._onDidUnmaximize.fire()));
    this._register(Event.fromNodeEventEmitter(win, "closed")(() => {
      this._onDidClose.fire();
      this.dispose();
    }));
    this._register(Event.fromNodeEventEmitter(win, "focus")(() => {
      this._lastFocusTime = Date.now();
    }));
    this._register(Event.fromNodeEventEmitter(this._win, "enter-full-screen")(() => this._onDidEnterFullScreen.fire()));
    this._register(Event.fromNodeEventEmitter(this._win, "leave-full-screen")(() => this._onDidLeaveFullScreen.fire()));
    const useCustomTitleStyle = !hasNativeTitlebar(
      this.configurationService,
      options?.titleBarStyle === "hidden" ? TitlebarStyle.CUSTOM : void 0
      /* unknown */
    );
    if (isMacintosh && useCustomTitleStyle) {
      win.setSheetOffset(isBigSurOrNewer(release()) ? 28 : 22);
    }
    if (useCustomTitleStyle && useWindowControlsOverlay(this.configurationService)) {
      const cachedWindowControlHeight = this.stateService.getItem(_BaseWindow.windowControlHeightStateStorageKey);
      if (cachedWindowControlHeight) {
        this.updateWindowControls({ height: cachedWindowControlHeight });
      } else {
        this.updateWindowControls({ height: DEFAULT_CUSTOM_TITLEBAR_HEIGHT });
      }
    }
    if (isWindows && useCustomTitleStyle) {
      const WM_INITMENU = 278;
      win.hookWindowMessage(WM_INITMENU, () => {
        const [x, y] = win.getPosition();
        const cursorPos = electron.screen.getCursorScreenPoint();
        const cx = cursorPos.x - x;
        const cy = cursorPos.y - y;
        const shouldTriggerDefaultSystemContextMenu = () => {
          if (cx > 30 && cy >= 0 && cy <= Math.max(win.getBounds().height * 0.15, 35)) {
            return false;
          }
          return true;
        };
        if (!shouldTriggerDefaultSystemContextMenu()) {
          win.setEnabled(false);
          win.setEnabled(true);
          this._onDidTriggerSystemContextMenu.fire({ x: cx, y: cy });
        }
        return 0;
      });
    }
    if (this.environmentMainService.args["open-devtools"] === true) {
      win.webContents.openDevTools();
    }
    if (isMacintosh) {
      this._register(this.onDidEnterFullScreen(() => {
        this.joinNativeFullScreenTransition?.complete(true);
      }));
      this._register(this.onDidLeaveFullScreen(() => {
        this.joinNativeFullScreenTransition?.complete(true);
      }));
    }
  }
  applyState(state, hasMultipleDisplays = electron.screen.getAllDisplays().length > 0) {
    const windowSettings = this.configurationService.getValue("window");
    const useNativeTabs = isMacintosh && windowSettings?.nativeTabs === true;
    if ((isMacintosh || isWindows) && hasMultipleDisplays && (!useNativeTabs || getAllWindowsExcludingOffscreen().length === 1)) {
      if ([state.width, state.height, state.x, state.y].every((value) => typeof value === "number")) {
        this._win?.setBounds({
          width: state.width,
          height: state.height,
          x: state.x,
          y: state.y
        });
      }
    }
    if (state.mode === WindowMode.Maximized || state.mode === WindowMode.Fullscreen) {
      this._win?.maximize();
      if (state.mode === WindowMode.Fullscreen) {
        this.setFullScreen(true, true);
      }
      this._win?.show();
    }
  }
  setRepresentedFilename(filename) {
    if (isMacintosh) {
      this.win?.setRepresentedFilename(filename);
    } else {
      this.representedFilename = filename;
    }
  }
  getRepresentedFilename() {
    if (isMacintosh) {
      return this.win?.getRepresentedFilename();
    }
    return this.representedFilename;
  }
  setDocumentEdited(edited) {
    if (isMacintosh) {
      this.win?.setDocumentEdited(edited);
    }
    this.documentEdited = edited;
  }
  isDocumentEdited() {
    if (isMacintosh) {
      return Boolean(this.win?.isDocumentEdited());
    }
    return !!this.documentEdited;
  }
  focus(options) {
    if (isMacintosh && options?.force) {
      electron.app.focus({ steal: true });
    }
    const win = this.win;
    if (!win) {
      return;
    }
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
  }
  updateWindowControls(options) {
    const win = this.win;
    if (!win) {
      return;
    }
    if (options.height) {
      this.stateService.setItem(CodeWindow.windowControlHeightStateStorageKey, options.height);
    }
    if (!isMacintosh && useWindowControlsOverlay(this.configurationService)) {
      win.setTitleBarOverlay({
        color: options.backgroundColor?.trim() === "" ? void 0 : options.backgroundColor,
        symbolColor: options.foregroundColor?.trim() === "" ? void 0 : options.foregroundColor,
        height: options.height ? options.height - 1 : void 0
        // account for window border
      });
    } else if (isMacintosh && options.height !== void 0) {
      const offset = Math.floor((options.height - 16) / 2);
      if (!offset) {
        win.setWindowButtonPosition(null);
      } else {
        win.setWindowButtonPosition({ x: offset + 1, y: offset });
      }
    }
  }
  toggleFullScreen() {
    this.setFullScreen(!this.isFullScreen, false);
  }
  setFullScreen(fullscreen, fromRestore) {
    if (useNativeFullScreen(this.configurationService)) {
      this.setNativeFullScreen(fullscreen, fromRestore);
    } else {
      this.setSimpleFullScreen(fullscreen);
    }
  }
  get isFullScreen() {
    if (isMacintosh && typeof this.transientIsNativeFullScreen === "boolean") {
      return this.transientIsNativeFullScreen;
    }
    const win = this.win;
    const isFullScreen = win?.isFullScreen();
    const isSimpleFullScreen = win?.isSimpleFullScreen();
    return Boolean(isFullScreen || isSimpleFullScreen);
  }
  setNativeFullScreen(fullscreen, fromRestore) {
    const win = this.win;
    if (win?.isSimpleFullScreen()) {
      win?.setSimpleFullScreen(false);
    }
    this.doSetNativeFullScreen(fullscreen, fromRestore);
  }
  doSetNativeFullScreen(fullscreen, fromRestore) {
    if (isMacintosh) {
      this.transientIsNativeFullScreen = fullscreen;
      const joinNativeFullScreenTransition = this.joinNativeFullScreenTransition = new DeferredPromise();
      (async () => {
        const transitioned = await Promise.race([
          joinNativeFullScreenTransition.p,
          timeout(1e4).then(() => false)
        ]);
        if (this.joinNativeFullScreenTransition !== joinNativeFullScreenTransition) {
          return;
        }
        this.transientIsNativeFullScreen = void 0;
        this.joinNativeFullScreenTransition = void 0;
        if (!transitioned && fullscreen && fromRestore && this.win && !this.win.isFullScreen()) {
          this.logService.warn("window: native macOS fullscreen transition did not happen within 10s from restoring");
          this._onDidLeaveFullScreen.fire();
        }
      })();
    }
    const win = this.win;
    win?.setFullScreen(fullscreen);
  }
  setSimpleFullScreen(fullscreen) {
    const win = this.win;
    if (win?.isFullScreen()) {
      this.doSetNativeFullScreen(false, false);
    }
    win?.setSimpleFullScreen(fullscreen);
    win?.webContents.focus();
  }
  dispose() {
    super.dispose();
    this._win = null;
  }
};
//#region Window Control Overlays
_BaseWindow.windowControlHeightStateStorageKey = "windowControlHeight";
let BaseWindow = _BaseWindow;
let CodeWindow = class extends BaseWindow {
  constructor(config, logService, loggerMainService, environmentMainService, policyService, userDataProfilesService, fileService, applicationStorageMainService, storageMainService, configurationService, themeMainService, workspacesManagementMainService, backupMainService, telemetryService, dialogMainService, lifecycleMainService, productService, protocolMainService, windowsMainService, stateService, instantiationService) {
    super(configurationService, stateService, environmentMainService, logService);
    this.loggerMainService = loggerMainService;
    this.policyService = policyService;
    this.userDataProfilesService = userDataProfilesService;
    this.fileService = fileService;
    this.applicationStorageMainService = applicationStorageMainService;
    this.storageMainService = storageMainService;
    this.themeMainService = themeMainService;
    this.workspacesManagementMainService = workspacesManagementMainService;
    this.backupMainService = backupMainService;
    this.telemetryService = telemetryService;
    this.dialogMainService = dialogMainService;
    this.lifecycleMainService = lifecycleMainService;
    this.productService = productService;
    this.windowsMainService = windowsMainService;
    //#region Events
    this._onWillLoad = this._register(new Emitter());
    this.onWillLoad = this._onWillLoad.event;
    this._onDidSignalReady = this._register(new Emitter());
    this.onDidSignalReady = this._onDidSignalReady.event;
    this._onDidDestroy = this._register(new Emitter());
    this.onDidDestroy = this._onDidDestroy.event;
    this.whenReadyCallbacks = [];
    this.touchBarGroups = [];
    this.currentHttpProxy = void 0;
    this.currentNoProxy = void 0;
    this.customZoomLevel = void 0;
    this.wasLoaded = false;
    this.readyState = 0 /* NONE */;
    {
      this.configObjectUrl = this._register(protocolMainService.createIPCObjectUrl());
      const [state, hasMultipleDisplays] = this.restoreWindowState(config.state);
      this.windowState = state;
      this.logService.trace("window#ctor: using window state", state);
      const options = instantiationService.invokeFunction(defaultBrowserWindowOptions, this.windowState, void 0, {
        preload: FileAccess.asFileUri("vs/base/parts/sandbox/electron-sandbox/preload.js").fsPath,
        additionalArguments: [`--vscode-window-config=${this.configObjectUrl.resource.toString()}`],
        v8CacheOptions: this.environmentMainService.useCodeCache ? "bypassHeatCheck" : "none"
      });
      mark("code/willCreateCodeBrowserWindow");
      this._win = new electron.BrowserWindow(options);
      mark("code/didCreateCodeBrowserWindow");
      this._id = this._win.id;
      this.setWin(this._win, options);
      this.applyState(this.windowState, hasMultipleDisplays);
      this._lastFocusTime = Date.now();
    }
    let sampleInterval = parseInt(this.environmentMainService.args["unresponsive-sample-interval"] || "1000");
    let samplePeriod = parseInt(this.environmentMainService.args["unresponsive-sample-period"] || "15000");
    if (sampleInterval <= 0 || samplePeriod <= 0 || sampleInterval > samplePeriod) {
      this.logService.warn(`Invalid unresponsive sample interval (${sampleInterval}ms) or period (${samplePeriod}ms), using defaults.`);
      sampleInterval = 1e3;
      samplePeriod = 15e3;
    }
    this.jsCallStackMap = /* @__PURE__ */ new Map();
    this.jsCallStackEffectiveSampleCount = Math.round(sampleInterval / samplePeriod);
    this.jsCallStackCollector = this._register(new Delayer(sampleInterval));
    this.jsCallStackCollectorStopScheduler = this._register(new RunOnceScheduler(() => {
      this.stopCollectingJScallStacks();
    }, samplePeriod));
    this.onConfigurationUpdated();
    this.createTouchBar();
    this.registerListeners();
  }
  get id() {
    return this._id;
  }
  get backupPath() {
    return this._config?.backupPath;
  }
  get openedWorkspace() {
    return this._config?.workspace;
  }
  get profile() {
    if (!this.config) {
      return void 0;
    }
    const profile = this.userDataProfilesService.profiles.find((profile2) => profile2.id === this.config?.profiles.profile.id);
    if (this.isExtensionDevelopmentHost && profile) {
      return profile;
    }
    return this.userDataProfilesService.getProfileForWorkspace(this.config.workspace ?? toWorkspaceIdentifier(this.backupPath, this.isExtensionDevelopmentHost)) ?? this.userDataProfilesService.defaultProfile;
  }
  get remoteAuthority() {
    return this._config?.remoteAuthority;
  }
  get config() {
    return this._config;
  }
  get isExtensionDevelopmentHost() {
    return !!this._config?.extensionDevelopmentPath;
  }
  get isExtensionTestHost() {
    return !!this._config?.extensionTestsPath;
  }
  get isExtensionDevelopmentTestFromCli() {
    return this.isExtensionDevelopmentHost && this.isExtensionTestHost && !this._config?.debugId;
  }
  setReady() {
    this.logService.trace(`window#load: window reported ready (id: ${this._id})`);
    this.readyState = 2 /* READY */;
    while (this.whenReadyCallbacks.length) {
      this.whenReadyCallbacks.pop()(this);
    }
    this._onDidSignalReady.fire();
  }
  ready() {
    return new Promise((resolve) => {
      if (this.isReady) {
        return resolve(this);
      }
      this.whenReadyCallbacks.push(resolve);
    });
  }
  get isReady() {
    return this.readyState === 2 /* READY */;
  }
  get whenClosedOrLoaded() {
    return new Promise((resolve) => {
      function handle() {
        closeListener.dispose();
        loadListener.dispose();
        resolve();
      }
      const closeListener = this.onDidClose(() => handle());
      const loadListener = this.onWillLoad(() => handle());
    });
  }
  registerListeners() {
    this._register(Event.fromNodeEventEmitter(this._win, "unresponsive")(() => this.onWindowError(WindowError.UNRESPONSIVE)));
    this._register(Event.fromNodeEventEmitter(this._win, "responsive")(() => this.onWindowError(WindowError.RESPONSIVE)));
    this._register(Event.fromNodeEventEmitter(this._win.webContents, "render-process-gone", (event, details) => details)((details) => this.onWindowError(WindowError.PROCESS_GONE, { ...details })));
    this._register(Event.fromNodeEventEmitter(this._win.webContents, "did-fail-load", (event, exitCode, reason) => ({ exitCode, reason }))(({ exitCode, reason }) => this.onWindowError(WindowError.LOAD, { reason, exitCode })));
    this._register(Event.fromNodeEventEmitter(this._win.webContents, "will-prevent-unload")((event) => event.preventDefault()));
    this._register(Event.fromNodeEventEmitter(this._win.webContents, "did-finish-load")(() => {
      if (this.pendingLoadConfig) {
        this._config = this.pendingLoadConfig;
        this.pendingLoadConfig = void 0;
      }
    }));
    this._register(this.onDidMaximize(() => {
      if (this._config) {
        this._config.maximized = true;
      }
    }));
    this._register(this.onDidUnmaximize(() => {
      if (this._config) {
        this._config.maximized = false;
      }
    }));
    this._register(this.onDidEnterFullScreen(() => {
      this.sendWhenReady("vscode:enterFullScreen", CancellationToken.None);
    }));
    this._register(this.onDidLeaveFullScreen(() => {
      this.sendWhenReady("vscode:leaveFullScreen", CancellationToken.None);
    }));
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
    this._register(this.workspacesManagementMainService.onDidDeleteUntitledWorkspace((e) => this.onDidDeleteUntitledWorkspace(e)));
    const urls = ["https://marketplace.visualstudio.com/*", "https://*.vsassets.io/*"];
    this._win.webContents.session.webRequest.onBeforeSendHeaders({ urls }, async (details, cb) => {
      const headers = await this.getMarketplaceHeaders();
      cb({ cancel: false, requestHeaders: Object.assign(details.requestHeaders, headers) });
    });
  }
  getMarketplaceHeaders() {
    if (!this.marketplaceHeadersPromise) {
      this.marketplaceHeadersPromise = resolveMarketplaceHeaders(
        this.productService.version,
        this.productService,
        this.environmentMainService,
        this.configurationService,
        this.fileService,
        this.applicationStorageMainService,
        this.telemetryService
      );
    }
    return this.marketplaceHeadersPromise;
  }
  async onWindowError(type, details) {
    switch (type) {
      case WindowError.PROCESS_GONE:
        this.logService.error(`CodeWindow: renderer process gone (reason: ${details?.reason || "<unknown>"}, code: ${details?.exitCode || "<unknown>"})`);
        break;
      case WindowError.UNRESPONSIVE:
        this.logService.error("CodeWindow: detected unresponsive");
        break;
      case WindowError.RESPONSIVE:
        this.logService.error("CodeWindow: recovered from unresponsive");
        break;
      case WindowError.LOAD:
        this.logService.error(`CodeWindow: failed to load (reason: ${details?.reason || "<unknown>"}, code: ${details?.exitCode || "<unknown>"})`);
        break;
    }
    this.telemetryService.publicLog2("windowerror", {
      type,
      reason: details?.reason,
      code: details?.exitCode
    });
    switch (type) {
      case WindowError.UNRESPONSIVE:
      case WindowError.PROCESS_GONE:
        if (this.isExtensionDevelopmentTestFromCli) {
          this.lifecycleMainService.kill(1);
          return;
        }
        if (this.environmentMainService.args["enable-smoke-test-driver"]) {
          await this.destroyWindow(false, false);
          this.lifecycleMainService.quit();
          return;
        }
        if (type === WindowError.UNRESPONSIVE) {
          if (this.isExtensionDevelopmentHost || this.isExtensionTestHost || this._win && this._win.webContents && this._win.webContents.isDevToolsOpened()) {
            return;
          }
          this.jsCallStackCollector.trigger(() => this.startCollectingJScallStacks());
          this.jsCallStackCollectorStopScheduler.schedule();
          const { response, checkboxChecked } = await this.dialogMainService.showMessageBox({
            type: "warning",
            buttons: [
              localize({ key: "reopen", comment: ["&& denotes a mnemonic"] }, "&&Reopen"),
              localize({ key: "close", comment: ["&& denotes a mnemonic"] }, "&&Close"),
              localize({ key: "wait", comment: ["&& denotes a mnemonic"] }, "&&Keep Waiting")
            ],
            message: localize("appStalled", "The window is not responding"),
            detail: localize("appStalledDetail", "You can reopen or close the window or keep waiting."),
            checkboxLabel: this._config?.workspace ? localize("doNotRestoreEditors", "Don't restore editors") : void 0
          }, this._win);
          if (response !== 2) {
            const reopen = response === 0;
            this.stopCollectingJScallStacks();
            await this.destroyWindow(reopen, checkboxChecked);
          }
        } else if (type === WindowError.PROCESS_GONE) {
          let message;
          if (!details) {
            message = localize("appGone", "The window terminated unexpectedly");
          } else {
            message = localize("appGoneDetails", "The window terminated unexpectedly (reason: '{0}', code: '{1}')", details.reason, details.exitCode ?? "<unknown>");
          }
          const { response, checkboxChecked } = await this.dialogMainService.showMessageBox({
            type: "warning",
            buttons: [
              this._config?.workspace ? localize({ key: "reopen", comment: ["&& denotes a mnemonic"] }, "&&Reopen") : localize({ key: "newWindow", comment: ["&& denotes a mnemonic"] }, "&&New Window"),
              localize({ key: "close", comment: ["&& denotes a mnemonic"] }, "&&Close")
            ],
            message,
            detail: this._config?.workspace ? localize("appGoneDetailWorkspace", "We are sorry for the inconvenience. You can reopen the window to continue where you left off.") : localize("appGoneDetailEmptyWindow", "We are sorry for the inconvenience. You can open a new empty window to start again."),
            checkboxLabel: this._config?.workspace ? localize("doNotRestoreEditors", "Don't restore editors") : void 0
          }, this._win);
          const reopen = response === 0;
          await this.destroyWindow(reopen, checkboxChecked);
        }
        break;
      case WindowError.RESPONSIVE:
        this.stopCollectingJScallStacks();
        break;
    }
  }
  async destroyWindow(reopen, skipRestoreEditors) {
    const workspace = this._config?.workspace;
    if (skipRestoreEditors && workspace) {
      try {
        const workspaceStorage = this.storageMainService.workspaceStorage(workspace);
        await workspaceStorage.init();
        workspaceStorage.delete("memento/workbench.parts.editor");
        await workspaceStorage.close();
      } catch (error) {
        this.logService.error(error);
      }
    }
    this._onDidDestroy.fire();
    try {
      if (reopen && this._config) {
        let uriToOpen = void 0;
        let forceEmpty = void 0;
        if (isSingleFolderWorkspaceIdentifier(workspace)) {
          uriToOpen = { folderUri: workspace.uri };
        } else if (isWorkspaceIdentifier(workspace)) {
          uriToOpen = { workspaceUri: workspace.configPath };
        } else {
          forceEmpty = true;
        }
        const window = (await this.windowsMainService.open({
          context: OpenContext.API,
          userEnv: this._config.userEnv,
          cli: {
            ...this.environmentMainService.args,
            _: []
            // we pass in the workspace to open explicitly via `urisToOpen`
          },
          urisToOpen: uriToOpen ? [uriToOpen] : void 0,
          forceEmpty,
          forceNewWindow: true,
          remoteAuthority: this.remoteAuthority
        })).at(0);
        window?.focus();
      }
    } finally {
      this._win?.destroy();
    }
  }
  onDidDeleteUntitledWorkspace(workspace) {
    if (this._config?.workspace?.id === workspace.id) {
      this._config.workspace = void 0;
    }
  }
  onConfigurationUpdated(e) {
    if (!e || e.affectsConfiguration("window.menuBarVisibility")) {
      const newMenuBarVisibility = this.getMenuBarVisibility();
      if (newMenuBarVisibility !== this.currentMenuBarVisibility) {
        this.currentMenuBarVisibility = newMenuBarVisibility;
        this.setMenuBarVisibility(newMenuBarVisibility);
      }
    }
    if (!e || e.affectsConfiguration("http.proxy") || e.affectsConfiguration("http.noProxy")) {
      const inspect = this.configurationService.inspect("http.proxy");
      let newHttpProxy = (inspect.userLocalValue || "").trim() || (process.env["https_proxy"] || process.env["HTTPS_PROXY"] || process.env["http_proxy"] || process.env["HTTP_PROXY"] || "").trim() || void 0;
      if (newHttpProxy?.indexOf("@") !== -1) {
        const uri = URI.parse(newHttpProxy);
        const i = uri.authority.indexOf("@");
        if (i !== -1) {
          newHttpProxy = uri.with({ authority: uri.authority.substring(i + 1) }).toString();
        }
      }
      if (newHttpProxy?.endsWith("/")) {
        newHttpProxy = newHttpProxy.substr(0, newHttpProxy.length - 1);
      }
      const newNoProxy = (this.configurationService.getValue("http.noProxy") || []).map((item) => item.trim()).join(",") || (process.env["no_proxy"] || process.env["NO_PROXY"] || "").trim() || void 0;
      if ((newHttpProxy || "").indexOf("@") === -1 && (newHttpProxy !== this.currentHttpProxy || newNoProxy !== this.currentNoProxy)) {
        this.currentHttpProxy = newHttpProxy;
        this.currentNoProxy = newNoProxy;
        const proxyRules = newHttpProxy || "";
        const proxyBypassRules = newNoProxy ? `${newNoProxy},<local>` : "<local>";
        this.logService.trace(`Setting proxy to '${proxyRules}', bypassing '${proxyBypassRules}'`);
        this._win.webContents.session.setProxy({ proxyRules, proxyBypassRules, pacScript: "" });
        electron.app.setProxy({ proxyRules, proxyBypassRules, pacScript: "" });
      }
    }
  }
  addTabbedWindow(window) {
    if (isMacintosh && window.win) {
      this._win.addTabbedWindow(window.win);
    }
  }
  load(configuration, options = /* @__PURE__ */ Object.create(null)) {
    this.logService.trace(`window#load: attempt to load window (id: ${this._id})`);
    if (this.isDocumentEdited()) {
      if (!options.isReload || !this.backupMainService.isHotExitEnabled()) {
        this.setDocumentEdited(false);
      }
    }
    if (!options.isReload) {
      if (this.getRepresentedFilename()) {
        this.setRepresentedFilename("");
      }
      this._win.setTitle(this.productService.nameLong);
    }
    this.updateConfiguration(configuration, options);
    if (this.readyState === 0 /* NONE */) {
      this._config = configuration;
    } else {
      this.pendingLoadConfig = configuration;
    }
    this.readyState = 1 /* NAVIGATING */;
    this._win.loadURL(FileAccess.asBrowserUri(`vs/code/electron-sandbox/workbench/workbench${this.environmentMainService.isBuilt ? "" : "-dev"}.html`).toString(true));
    const wasLoaded = this.wasLoaded;
    this.wasLoaded = true;
    if (!this.environmentMainService.isBuilt && !this.environmentMainService.extensionTestsLocationURI) {
      this._register(new RunOnceScheduler(() => {
        if (this._win && !this._win.isVisible() && !this._win.isMinimized()) {
          this._win.show();
          this.focus({ force: true });
          this._win.webContents.openDevTools();
        }
      }, 1e4)).schedule();
    }
    this._onWillLoad.fire({ workspace: configuration.workspace, reason: options.isReload ? LoadReason.RELOAD : wasLoaded ? LoadReason.LOAD : LoadReason.INITIAL });
  }
  updateConfiguration(configuration, options) {
    const currentUserEnv = (this._config ?? this.pendingLoadConfig)?.userEnv;
    if (currentUserEnv) {
      const shouldPreserveLaunchCliEnvironment = isLaunchedFromCli(currentUserEnv) && !isLaunchedFromCli(configuration.userEnv);
      const shouldPreserveDebugEnvironmnet = this.isExtensionDevelopmentHost;
      if (shouldPreserveLaunchCliEnvironment || shouldPreserveDebugEnvironmnet) {
        configuration.userEnv = { ...currentUserEnv, ...configuration.userEnv };
      }
    }
    if (process.env["CHROME_CRASHPAD_PIPE_NAME"]) {
      Object.assign(configuration.userEnv, {
        CHROME_CRASHPAD_PIPE_NAME: process.env["CHROME_CRASHPAD_PIPE_NAME"]
      });
    }
    if (options.disableExtensions !== void 0) {
      configuration["disable-extensions"] = options.disableExtensions;
    }
    try {
      configuration.handle = VSBuffer.wrap(this._win.getNativeWindowHandle());
    } catch (error) {
      this.logService.error(`Error getting native window handle: ${error}`);
    }
    configuration.fullscreen = this.isFullScreen;
    configuration.maximized = this._win.isMaximized();
    configuration.partsSplash = this.themeMainService.getWindowSplash(configuration.workspace);
    configuration.zoomLevel = this.getZoomLevel();
    configuration.isCustomZoomLevel = typeof this.customZoomLevel === "number";
    if (configuration.isCustomZoomLevel && configuration.partsSplash) {
      configuration.partsSplash.zoomLevel = configuration.zoomLevel;
    }
    mark("code/willOpenNewWindow");
    configuration.perfMarks = getMarks();
    this.configObjectUrl.update(configuration);
  }
  async reload(cli) {
    const configuration = Object.assign({}, this._config);
    configuration.workspace = await this.validateWorkspaceBeforeReload(configuration);
    delete configuration.filesToOpenOrCreate;
    delete configuration.filesToDiff;
    delete configuration.filesToMerge;
    delete configuration.filesToWait;
    if (this.isExtensionDevelopmentHost && cli) {
      configuration.verbose = cli.verbose;
      configuration.debugId = cli.debugId;
      configuration.extensionEnvironment = cli.extensionEnvironment;
      configuration["inspect-extensions"] = cli["inspect-extensions"];
      configuration["inspect-brk-extensions"] = cli["inspect-brk-extensions"];
      configuration["extensions-dir"] = cli["extensions-dir"];
    }
    configuration.accessibilitySupport = electron.app.isAccessibilitySupportEnabled();
    configuration.isInitialStartup = false;
    configuration.policiesData = this.policyService.serialize();
    configuration.continueOn = this.environmentMainService.continueOn;
    configuration.profiles = {
      all: this.userDataProfilesService.profiles,
      profile: this.profile || this.userDataProfilesService.defaultProfile,
      home: this.userDataProfilesService.profilesHome
    };
    configuration.logLevel = this.loggerMainService.getLogLevel();
    configuration.loggers = this.loggerMainService.getGlobalLoggers();
    this.load(configuration, { isReload: true, disableExtensions: cli?.["disable-extensions"] });
  }
  async validateWorkspaceBeforeReload(configuration) {
    if (isWorkspaceIdentifier(configuration.workspace)) {
      const configPath = configuration.workspace.configPath;
      if (configPath.scheme === Schemas.file) {
        const workspaceExists = await this.fileService.exists(configPath);
        if (!workspaceExists) {
          return void 0;
        }
      }
    } else if (isSingleFolderWorkspaceIdentifier(configuration.workspace)) {
      const uri = configuration.workspace.uri;
      if (uri.scheme === Schemas.file) {
        const folderExists = await this.fileService.exists(uri);
        if (!folderExists) {
          return void 0;
        }
      }
    }
    return configuration.workspace;
  }
  serializeWindowState() {
    if (!this._win) {
      return defaultWindowState();
    }
    if (this.isFullScreen) {
      let display;
      try {
        display = electron.screen.getDisplayMatching(this.getBounds());
      } catch (error) {
      }
      const defaultState = defaultWindowState();
      return {
        mode: WindowMode.Fullscreen,
        display: display ? display.id : void 0,
        // Still carry over window dimensions from previous sessions
        // if we can compute it in fullscreen state.
        // does not seem possible in all cases on Linux for example
        // (https://github.com/microsoft/vscode/issues/58218) so we
        // fallback to the defaults in that case.
        width: this.windowState.width || defaultState.width,
        height: this.windowState.height || defaultState.height,
        x: this.windowState.x || 0,
        y: this.windowState.y || 0,
        zoomLevel: this.customZoomLevel
      };
    }
    const state = /* @__PURE__ */ Object.create(null);
    let mode;
    if (!isMacintosh && this._win.isMaximized()) {
      mode = WindowMode.Maximized;
    } else {
      mode = WindowMode.Normal;
    }
    if (mode === WindowMode.Maximized) {
      state.mode = WindowMode.Maximized;
    } else {
      state.mode = WindowMode.Normal;
    }
    if (mode === WindowMode.Normal || mode === WindowMode.Maximized) {
      let bounds;
      if (mode === WindowMode.Normal) {
        bounds = this.getBounds();
      } else {
        bounds = this._win.getNormalBounds();
      }
      state.x = bounds.x;
      state.y = bounds.y;
      state.width = bounds.width;
      state.height = bounds.height;
    }
    state.zoomLevel = this.customZoomLevel;
    return state;
  }
  restoreWindowState(state) {
    mark("code/willRestoreCodeWindowState");
    let hasMultipleDisplays = false;
    if (state) {
      this.customZoomLevel = state.zoomLevel;
      try {
        const displays = electron.screen.getAllDisplays();
        hasMultipleDisplays = displays.length > 1;
        state = WindowStateValidator.validateWindowState(this.logService, state, displays);
      } catch (err) {
        this.logService.warn(`Unexpected error validating window state: ${err}
${err.stack}`);
      }
    }
    mark("code/didRestoreCodeWindowState");
    return [state || defaultWindowState(), hasMultipleDisplays];
  }
  getBounds() {
    const [x, y] = this._win.getPosition();
    const [width, height] = this._win.getSize();
    return { x, y, width, height };
  }
  setFullScreen(fullscreen, fromRestore) {
    super.setFullScreen(fullscreen, fromRestore);
    this.sendWhenReady(fullscreen ? "vscode:enterFullScreen" : "vscode:leaveFullScreen", CancellationToken.None);
    if (this.currentMenuBarVisibility) {
      this.setMenuBarVisibility(this.currentMenuBarVisibility, false);
    }
  }
  getMenuBarVisibility() {
    let menuBarVisibility = getMenuBarVisibility(this.configurationService);
    if (["visible", "toggle", "hidden"].indexOf(menuBarVisibility) < 0) {
      menuBarVisibility = "classic";
    }
    return menuBarVisibility;
  }
  setMenuBarVisibility(visibility, notify = true) {
    if (isMacintosh) {
      return;
    }
    if (visibility === "toggle") {
      if (notify) {
        this.send("vscode:showInfoMessage", localize("hiddenMenuBar", "You can still access the menu bar by pressing the Alt-key."));
      }
    }
    if (visibility === "hidden") {
      setTimeout(() => {
        this.doSetMenuBarVisibility(visibility);
      });
    } else {
      this.doSetMenuBarVisibility(visibility);
    }
  }
  doSetMenuBarVisibility(visibility) {
    const isFullscreen = this.isFullScreen;
    switch (visibility) {
      case "classic":
        this._win.setMenuBarVisibility(!isFullscreen);
        this._win.autoHideMenuBar = isFullscreen;
        break;
      case "visible":
        this._win.setMenuBarVisibility(true);
        this._win.autoHideMenuBar = false;
        break;
      case "toggle":
        this._win.setMenuBarVisibility(false);
        this._win.autoHideMenuBar = true;
        break;
      case "hidden":
        this._win.setMenuBarVisibility(false);
        this._win.autoHideMenuBar = false;
        break;
    }
  }
  notifyZoomLevel(zoomLevel) {
    this.customZoomLevel = zoomLevel;
  }
  getZoomLevel() {
    if (typeof this.customZoomLevel === "number") {
      return this.customZoomLevel;
    }
    const windowSettings = this.configurationService.getValue("window");
    return windowSettings?.zoomLevel;
  }
  close() {
    this._win?.close();
  }
  sendWhenReady(channel, token, ...args) {
    if (this.isReady) {
      this.send(channel, ...args);
    } else {
      this.ready().then(() => {
        if (!token.isCancellationRequested) {
          this.send(channel, ...args);
        }
      });
    }
  }
  send(channel, ...args) {
    if (this._win) {
      if (this._win.isDestroyed() || this._win.webContents.isDestroyed()) {
        this.logService.warn(`Sending IPC message to channel '${channel}' for window that is destroyed`);
        return;
      }
      try {
        this._win.webContents.send(channel, ...args);
      } catch (error) {
        this.logService.warn(`Error sending IPC message to channel '${channel}' of window ${this._id}: ${toErrorMessage(error)}`);
      }
    }
  }
  updateTouchBar(groups) {
    if (!isMacintosh) {
      return;
    }
    this.touchBarGroups.forEach((touchBarGroup, index) => {
      const commands = groups[index];
      touchBarGroup.segments = this.createTouchBarGroupSegments(commands);
    });
  }
  createTouchBar() {
    if (!isMacintosh) {
      return;
    }
    for (let i = 0; i < 10; i++) {
      const groupTouchBar = this.createTouchBarGroup();
      this.touchBarGroups.push(groupTouchBar);
    }
    this._win.setTouchBar(new electron.TouchBar({ items: this.touchBarGroups }));
  }
  createTouchBarGroup(items = []) {
    const segments = this.createTouchBarGroupSegments(items);
    const control = new electron.TouchBar.TouchBarSegmentedControl({
      segments,
      mode: "buttons",
      segmentStyle: "automatic",
      change: (selectedIndex) => {
        this.sendWhenReady("vscode:runAction", CancellationToken.None, { id: control.segments[selectedIndex].id, from: "touchbar" });
      }
    });
    return control;
  }
  createTouchBarGroupSegments(items = []) {
    const segments = items.map((item) => {
      let icon;
      if (item.icon && !ThemeIcon.isThemeIcon(item.icon) && item.icon?.dark?.scheme === Schemas.file) {
        icon = electron.nativeImage.createFromPath(URI.revive(item.icon.dark).fsPath);
        if (icon.isEmpty()) {
          icon = void 0;
        }
      }
      let title;
      if (typeof item.title === "string") {
        title = item.title;
      } else {
        title = item.title.value;
      }
      return {
        id: item.id,
        label: !icon ? title : void 0,
        icon
      };
    });
    return segments;
  }
  async startCollectingJScallStacks() {
    if (!this.jsCallStackCollector.isTriggered()) {
      const stack = await this._win.webContents.mainFrame.collectJavaScriptCallStack();
      if (stack) {
        const count = this.jsCallStackMap.get(stack) || 0;
        this.jsCallStackMap.set(stack, count + 1);
      }
      this.jsCallStackCollector.trigger(() => this.startCollectingJScallStacks());
    }
  }
  stopCollectingJScallStacks() {
    this.jsCallStackCollectorStopScheduler.cancel();
    this.jsCallStackCollector.cancel();
    if (this.jsCallStackMap.size) {
      let logMessage = `CodeWindow unresponsive samples:
`;
      let samples = 0;
      const sortedEntries = Array.from(this.jsCallStackMap.entries()).sort((a, b) => b[1] - a[1]);
      for (const [stack, count] of sortedEntries) {
        samples += count;
        if (Math.round(count * 100 / this.jsCallStackEffectiveSampleCount) > 20) {
          const fakeError = new UnresponsiveError(stack, this.id, this.win?.webContents.getOSProcessId());
          errorHandler.onUnexpectedError(fakeError);
        }
        logMessage += `<${count}> ${stack}
`;
      }
      logMessage += `Total Samples: ${samples}
`;
      logMessage += "For full overview of the unresponsive period, capture cpu profile via https://aka.ms/vscode-tracing-cpu-profile";
      this.logService.error(logMessage);
    }
    this.jsCallStackMap.clear();
  }
  matches(webContents) {
    return this._win?.webContents.id === webContents.id;
  }
  dispose() {
    super.dispose();
    this.loggerMainService.deregisterLoggers(this.id);
  }
};
CodeWindow = __decorateClass([
  __decorateParam(1, ILogService),
  __decorateParam(2, ILoggerMainService),
  __decorateParam(3, IEnvironmentMainService),
  __decorateParam(4, IPolicyService),
  __decorateParam(5, IUserDataProfilesMainService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IApplicationStorageMainService),
  __decorateParam(8, IStorageMainService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IThemeMainService),
  __decorateParam(11, IWorkspacesManagementMainService),
  __decorateParam(12, IBackupMainService),
  __decorateParam(13, ITelemetryService),
  __decorateParam(14, IDialogMainService),
  __decorateParam(15, ILifecycleMainService),
  __decorateParam(16, IProductService),
  __decorateParam(17, IProtocolMainService),
  __decorateParam(18, IWindowsMainService),
  __decorateParam(19, IStateService),
  __decorateParam(20, IInstantiationService)
], CodeWindow);
class UnresponsiveError extends Error {
  constructor(sample, windowId, pid = 0) {
    const stackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 0;
    super(`UnresponsiveSampleError: from window with ID ${windowId} belonging to process with pid ${pid}`);
    Error.stackTraceLimit = stackTraceLimit;
    this.name = "UnresponsiveSampleError";
    this.stack = sample;
  }
}
export {
  BaseWindow,
  CodeWindow
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS93aW5kb3dzL2VsZWN0cm9uLW1haW4vd2luZG93SW1wbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBlbGVjdHJvbiwgeyBCcm93c2VyV2luZG93Q29uc3RydWN0b3JPcHRpb25zIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlLCBSdW5PbmNlU2NoZWR1bGVyLCB0aW1lb3V0LCBEZWxheWVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MsIFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGdldE1hcmtzLCBtYXJrIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgaXNCaWdTdXJPck5ld2VyLCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IHJlbGVhc2UgfSBmcm9tICdvcyc7XG5pbXBvcnQgeyBJU2VyaWFsaXphYmxlQ29tbWFuZEFjdGlvbiB9IGZyb20gJy4uLy4uL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IElCYWNrdXBNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2JhY2t1cC9lbGVjdHJvbi1tYWluL2JhY2t1cC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElEaWFsb2dNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2RpYWxvZ3MvZWxlY3Ryb24tbWFpbi9kaWFsb2dNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOYXRpdmVQYXJzZWRBcmdzIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvY29tbW9uL2FyZ3YuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50TWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9lbGVjdHJvbi1tYWluL2Vudmlyb25tZW50TWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNMYXVuY2hlZEZyb21DbGkgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9ub2RlL2FyZ3ZIZWxwZXIuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9lbGVjdHJvbi1tYWluL2xpZmVjeWNsZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUlQQ09iamVjdFVybCwgSVByb3RvY29sTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wcm90b2NvbC9lbGVjdHJvbi1tYWluL3Byb3RvY29sLmpzJztcbmltcG9ydCB7IHJlc29sdmVNYXJrZXRwbGFjZUhlYWRlcnMgfSBmcm9tICcuLi8uLi9leHRlcm5hbFNlcnZpY2VzL2NvbW1vbi9tYXJrZXRwbGFjZS5qcyc7XG5pbXBvcnQgeyBJQXBwbGljYXRpb25TdG9yYWdlTWFpblNlcnZpY2UsIElTdG9yYWdlTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9zdG9yYWdlL2VsZWN0cm9uLW1haW4vc3RvcmFnZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElUaGVtZU1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGhlbWUvZWxlY3Ryb24tbWFpbi90aGVtZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldE1lbnVCYXJWaXNpYmlsaXR5LCBJRm9sZGVyVG9PcGVuLCBJTmF0aXZlV2luZG93Q29uZmlndXJhdGlvbiwgSVdpbmRvd1NldHRpbmdzLCBJV29ya3NwYWNlVG9PcGVuLCBNZW51QmFyVmlzaWJpbGl0eSwgaGFzTmF0aXZlVGl0bGViYXIsIHVzZU5hdGl2ZUZ1bGxTY3JlZW4sIHVzZVdpbmRvd0NvbnRyb2xzT3ZlcmxheSwgREVGQVVMVF9DVVNUT01fVElUTEVCQVJfSEVJR0hULCBUaXRsZWJhclN0eWxlIH0gZnJvbSAnLi4vLi4vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgZGVmYXVsdEJyb3dzZXJXaW5kb3dPcHRpb25zLCBnZXRBbGxXaW5kb3dzRXhjbHVkaW5nT2Zmc2NyZWVuLCBJV2luZG93c01haW5TZXJ2aWNlLCBPcGVuQ29udGV4dCwgV2luZG93U3RhdGVWYWxpZGF0b3IgfSBmcm9tICcuL3dpbmRvd3MuanMnO1xuaW1wb3J0IHsgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIsIElXb3Jrc3BhY2VJZGVudGlmaWVyLCBpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIsIGlzV29ya3NwYWNlSWRlbnRpZmllciwgdG9Xb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi93b3Jrc3BhY2VzL2VsZWN0cm9uLW1haW4vd29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV2luZG93U3RhdGUsIElDb2RlV2luZG93LCBJTG9hZEV2ZW50LCBXaW5kb3dNb2RlLCBXaW5kb3dFcnJvciwgTG9hZFJlYXNvbiwgZGVmYXVsdFdpbmRvd1N0YXRlLCBJQmFzZVdpbmRvdyB9IGZyb20gJy4uLy4uL3dpbmRvdy9lbGVjdHJvbi1tYWluL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJUG9saWN5U2VydmljZSB9IGZyb20gJy4uLy4uL3BvbGljeS9jb21tb24vcG9saWN5LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGUgfSBmcm9tICcuLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc3RhdGUvbm9kZS9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2VsZWN0cm9uLW1haW4vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IElMb2dnZXJNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZy9lbGVjdHJvbi1tYWluL2xvZ2dlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBlcnJvckhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElXaW5kb3dDcmVhdGlvbk9wdGlvbnMge1xuXHRyZWFkb25seSBzdGF0ZTogSVdpbmRvd1N0YXRlO1xuXHRyZWFkb25seSBleHRlbnNpb25EZXZlbG9wbWVudFBhdGg/OiBzdHJpbmdbXTtcblx0cmVhZG9ubHkgaXNFeHRlbnNpb25UZXN0SG9zdD86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJVG91Y2hCYXJTZWdtZW50IGV4dGVuZHMgZWxlY3Ryb24uU2VnbWVudGVkQ29udHJvbFNlZ21lbnQge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSUxvYWRPcHRpb25zIHtcblx0cmVhZG9ubHkgaXNSZWxvYWQ/OiBib29sZWFuO1xuXHRyZWFkb25seSBkaXNhYmxlRXh0ZW5zaW9ucz86IGJvb2xlYW47XG59XG5cbmNvbnN0IGVudW0gUmVhZHlTdGF0ZSB7XG5cblx0LyoqXG5cdCAqIFRoaXMgd2luZG93IGhhcyBub3QgbG9hZGVkIGFueXRoaW5nIHlldFxuXHQgKiBhbmQgdGhpcyBpcyB0aGUgaW5pdGlhbCBzdGF0ZSBvZiBldmVyeVxuXHQgKiB3aW5kb3cuXG5cdCAqL1xuXHROT05FLFxuXG5cdC8qKlxuXHQgKiBUaGlzIHdpbmRvdyBpcyBuYXZpZ2F0aW5nLCBlaXRoZXIgZm9yIHRoZVxuXHQgKiBmaXJzdCB0aW1lIG9yIHN1YnNlcXVlbnQgdGltZXMuXG5cdCAqL1xuXHROQVZJR0FUSU5HLFxuXG5cdC8qKlxuXHQgKiBUaGlzIHdpbmRvdyBoYXMgZmluaXNoZWQgbG9hZGluZyBhbmQgaXMgcmVhZHlcblx0ICogdG8gZm9yd2FyZCBJUEMgcmVxdWVzdHMgdG8gdGhlIHdlYiBjb250ZW50cy5cblx0ICovXG5cdFJFQURZXG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlV2luZG93IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElCYXNlV2luZG93IHtcblxuXHQvLyNyZWdpb24gRXZlbnRzXG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsb3NlID0gdGhpcy5fb25EaWRDbG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZE1heGltaXplID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTWF4aW1pemUgPSB0aGlzLl9vbkRpZE1heGltaXplLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkVW5tYXhpbWl6ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFVubWF4aW1pemUgPSB0aGlzLl9vbkRpZFVubWF4aW1pemUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRUcmlnZ2VyU3lzdGVtQ29udGV4dE1lbnUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZFRyaWdnZXJTeXN0ZW1Db250ZXh0TWVudSA9IHRoaXMuX29uRGlkVHJpZ2dlclN5c3RlbUNvbnRleHRNZW51LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRW50ZXJGdWxsU2NyZWVuID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRW50ZXJGdWxsU2NyZWVuID0gdGhpcy5fb25EaWRFbnRlckZ1bGxTY3JlZW4uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRMZWF2ZUZ1bGxTY3JlZW4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRMZWF2ZUZ1bGxTY3JlZW4gPSB0aGlzLl9vbkRpZExlYXZlRnVsbFNjcmVlbi5ldmVudDtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRhYnN0cmFjdCByZWFkb25seSBpZDogbnVtYmVyO1xuXG5cdHByb3RlY3RlZCBfbGFzdEZvY3VzVGltZSA9IERhdGUubm93KCk7IC8vIHdpbmRvdyBpcyBzaG93biBvbiBjcmVhdGlvbiBzbyB0YWtlIGN1cnJlbnQgdGltZVxuXHRnZXQgbGFzdEZvY3VzVGltZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5fbGFzdEZvY3VzVGltZTsgfVxuXG5cdHByb3RlY3RlZCBfd2luOiBlbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgbnVsbCA9IG51bGw7XG5cdGdldCB3aW4oKSB7IHJldHVybiB0aGlzLl93aW47IH1cblx0cHJvdGVjdGVkIHNldFdpbih3aW46IGVsZWN0cm9uLkJyb3dzZXJXaW5kb3csIG9wdGlvbnM/OiBCcm93c2VyV2luZG93Q29uc3RydWN0b3JPcHRpb25zKTogdm9pZCB7XG5cdFx0dGhpcy5fd2luID0gd2luO1xuXG5cdFx0Ly8gV2luZG93IEV2ZW50c1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKHdpbiwgJ21heGltaXplJykoKCkgPT4gdGhpcy5fb25EaWRNYXhpbWl6ZS5maXJlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcih3aW4sICd1bm1heGltaXplJykoKCkgPT4gdGhpcy5fb25EaWRVbm1heGltaXplLmZpcmUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKHdpbiwgJ2Nsb3NlZCcpKCgpID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ2xvc2UuZmlyZSgpO1xuXG5cdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXIod2luLCAnZm9jdXMnKSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9sYXN0Rm9jdXNUaW1lID0gRGF0ZS5ub3coKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXIodGhpcy5fd2luLCAnZW50ZXItZnVsbC1zY3JlZW4nKSgoKSA9PiB0aGlzLl9vbkRpZEVudGVyRnVsbFNjcmVlbi5maXJlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcih0aGlzLl93aW4sICdsZWF2ZS1mdWxsLXNjcmVlbicpKCgpID0+IHRoaXMuX29uRGlkTGVhdmVGdWxsU2NyZWVuLmZpcmUoKSkpO1xuXG5cdFx0Ly8gU2hlZXQgT2Zmc2V0c1xuXHRcdGNvbnN0IHVzZUN1c3RvbVRpdGxlU3R5bGUgPSAhaGFzTmF0aXZlVGl0bGViYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgb3B0aW9ucz8udGl0bGVCYXJTdHlsZSA9PT0gJ2hpZGRlbicgPyBUaXRsZWJhclN0eWxlLkNVU1RPTSA6IHVuZGVmaW5lZCAvKiB1bmtub3duICovKTtcblx0XHRpZiAoaXNNYWNpbnRvc2ggJiYgdXNlQ3VzdG9tVGl0bGVTdHlsZSkge1xuXHRcdFx0d2luLnNldFNoZWV0T2Zmc2V0KGlzQmlnU3VyT3JOZXdlcihyZWxlYXNlKCkpID8gMjggOiAyMik7IC8vIG9mZnNldCBkaWFsb2dzIGJ5IHRoZSBoZWlnaHQgb2YgdGhlIGN1c3RvbSB0aXRsZSBiYXIgaWYgd2UgaGF2ZSBhbnlcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgdGhlIHdpbmRvdyBjb250cm9scyBpbW1lZGlhdGVseSBiYXNlZCBvbiBjYWNoZWQgb3IgZGVmYXVsdCB2YWx1ZXNcblx0XHRpZiAodXNlQ3VzdG9tVGl0bGVTdHlsZSAmJiB1c2VXaW5kb3dDb250cm9sc092ZXJsYXkodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdGNvbnN0IGNhY2hlZFdpbmRvd0NvbnRyb2xIZWlnaHQgPSB0aGlzLnN0YXRlU2VydmljZS5nZXRJdGVtPG51bWJlcj4oKEJhc2VXaW5kb3cud2luZG93Q29udHJvbEhlaWdodFN0YXRlU3RvcmFnZUtleSkpO1xuXHRcdFx0aWYgKGNhY2hlZFdpbmRvd0NvbnRyb2xIZWlnaHQpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVXaW5kb3dDb250cm9scyh7IGhlaWdodDogY2FjaGVkV2luZG93Q29udHJvbEhlaWdodCB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlV2luZG93Q29udHJvbHMoeyBoZWlnaHQ6IERFRkFVTFRfQ1VTVE9NX1RJVExFQkFSX0hFSUdIVCB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBXaW5kb3dzIEN1c3RvbSBTeXN0ZW0gQ29udGV4dCBNZW51XG5cdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvMjQ4OTNcblx0XHQvL1xuXHRcdC8vIFRoZSBwdXJwb3NlIG9mIHRoaXMgaXMgdG8gYWxsb3cgZm9yIHRoZSBjb250ZXh0IG1lbnUgaW4gdGhlIFdpbmRvd3MgVGl0bGUgQmFyXG5cdFx0Ly9cblx0XHQvLyBDdXJyZW50bHksIGFsbCBtb3VzZSBldmVudHMgaW4gdGhlIHRpdGxlIGJhciBhcmUgY2FwdHVyZWQgYnkgdGhlIE9TXG5cdFx0Ly8gdGh1cyB3ZSBuZWVkIHRvIGNhcHR1cmUgdGhlbSBoZXJlIHdpdGggYSB3aW5kb3cgaG9vayBzcGVjaWZpYyB0byBXaW5kb3dzXG5cdFx0Ly8gYW5kIHRoZW4gZm9yd2FyZCB0aGVtIHRvIHRoZSBjb3JyZWN0IHdpbmRvdy5cblx0XHRpZiAoaXNXaW5kb3dzICYmIHVzZUN1c3RvbVRpdGxlU3R5bGUpIHtcblx0XHRcdGNvbnN0IFdNX0lOSVRNRU5VID0gMHgwMTE2OyAvLyBodHRwczovL2RvY3MubWljcm9zb2Z0LmNvbS9lbi11cy93aW5kb3dzL3dpbjMyL21lbnVyYy93bS1pbml0bWVudVxuXG5cdFx0XHQvLyBUaGlzIHNldHMgdXAgYSBsaXN0ZW5lciBmb3IgdGhlIHdpbmRvdyBob29rLiBUaGlzIGlzIGEgV2luZG93cy1vbmx5IEFQSSBwcm92aWRlZCBieSBlbGVjdHJvbi5cblx0XHRcdHdpbi5ob29rV2luZG93TWVzc2FnZShXTV9JTklUTUVOVSwgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBbeCwgeV0gPSB3aW4uZ2V0UG9zaXRpb24oKTtcblx0XHRcdFx0Y29uc3QgY3Vyc29yUG9zID0gZWxlY3Ryb24uc2NyZWVuLmdldEN1cnNvclNjcmVlblBvaW50KCk7XG5cdFx0XHRcdGNvbnN0IGN4ID0gY3Vyc29yUG9zLnggLSB4O1xuXHRcdFx0XHRjb25zdCBjeSA9IGN1cnNvclBvcy55IC0geTtcblxuXHRcdFx0XHQvLyBJbiBzb21lIGNhc2VzLCBzaG93IHRoZSBkZWZhdWx0IHN5c3RlbSBjb250ZXh0IG1lbnVcblx0XHRcdFx0Ly8gMSkgVGhlIG1vdXNlIHBvc2l0aW9uIGlzIG5vdCB3aXRoaW4gdGhlIHRpdGxlIGJhclxuXHRcdFx0XHQvLyAyKSBUaGUgbW91c2UgcG9zaXRpb24gaXMgd2l0aGluIHRoZSB0aXRsZSBiYXIsIGJ1dCBvdmVyIHRoZSBhcHAgaWNvblxuXHRcdFx0XHQvLyBXZSBkbyBub3Qga25vdyB0aGUgZXhhY3QgdGl0bGUgYmFyIGhlaWdodCBidXQgd2UgbWFrZSBhbiBlc3RpbWF0ZSBiYXNlZCBvbiB3aW5kb3cgaGVpZ2h0XG5cdFx0XHRcdGNvbnN0IHNob3VsZFRyaWdnZXJEZWZhdWx0U3lzdGVtQ29udGV4dE1lbnUgPSAoKSA9PiB7XG5cdFx0XHRcdFx0Ly8gVXNlIHRoZSBjdXN0b20gY29udGV4dCBtZW51IHdoZW4gb3ZlciB0aGUgdGl0bGUgYmFyLCBidXQgbm90IG92ZXIgdGhlIGFwcCBpY29uXG5cdFx0XHRcdFx0Ly8gVGhlIGFwcCBpY29uIGlzIGVzdGltYXRlZCB0byBiZSAzMHB4IHdpZGVcblx0XHRcdFx0XHQvLyBUaGUgdGl0bGUgYmFyIGlzIGVzdGltYXRlZCB0byBiZSB0aGUgbWF4IG9mIDM1cHggYW5kIDE1JSBvZiB0aGUgd2luZG93IGhlaWdodFxuXHRcdFx0XHRcdGlmIChjeCA+IDMwICYmIGN5ID49IDAgJiYgY3kgPD0gTWF0aC5tYXgod2luLmdldEJvdW5kcygpLmhlaWdodCAqIDAuMTUsIDM1KSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGlmICghc2hvdWxkVHJpZ2dlckRlZmF1bHRTeXN0ZW1Db250ZXh0TWVudSgpKSB7XG5cblx0XHRcdFx0XHQvLyBUaGlzIGlzIG5lY2Vzc2FyeSB0byBtYWtlIHN1cmUgdGhlIG5hdGl2ZSBzeXN0ZW0gY29udGV4dCBtZW51IGRvZXMgbm90IHNob3cgdXAuXG5cdFx0XHRcdFx0d2luLnNldEVuYWJsZWQoZmFsc2UpO1xuXHRcdFx0XHRcdHdpbi5zZXRFbmFibGVkKHRydWUpO1xuXG5cdFx0XHRcdFx0dGhpcy5fb25EaWRUcmlnZ2VyU3lzdGVtQ29udGV4dE1lbnUuZmlyZSh7IHg6IGN4LCB5OiBjeSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gT3BlbiBkZXZ0b29scyBpZiBpbnN0cnVjdGVkIGZyb20gY29tbWFuZCBsaW5lIGFyZ3Ncblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFyZ3NbJ29wZW4tZGV2dG9vbHMnXSA9PT0gdHJ1ZSkge1xuXHRcdFx0d2luLndlYkNvbnRlbnRzLm9wZW5EZXZUb29scygpO1xuXHRcdH1cblxuXHRcdC8vIG1hY09TOiBXaW5kb3cgRnVsbHNjcmVlbiBUcmFuc2l0aW9uc1xuXHRcdGlmIChpc01hY2ludG9zaCkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZEVudGVyRnVsbFNjcmVlbigoKSA9PiB7XG5cdFx0XHRcdHRoaXMuam9pbk5hdGl2ZUZ1bGxTY3JlZW5UcmFuc2l0aW9uPy5jb21wbGV0ZSh0cnVlKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZExlYXZlRnVsbFNjcmVlbigoKSA9PiB7XG5cdFx0XHRcdHRoaXMuam9pbk5hdGl2ZUZ1bGxTY3JlZW5UcmFuc2l0aW9uPy5jb21wbGV0ZSh0cnVlKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgc3RhdGVTZXJ2aWNlOiBJU3RhdGVTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBlbnZpcm9ubWVudE1haW5TZXJ2aWNlOiBJRW52aXJvbm1lbnRNYWluU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhcHBseVN0YXRlKHN0YXRlOiBJV2luZG93U3RhdGUsIGhhc011bHRpcGxlRGlzcGxheXMgPSBlbGVjdHJvbi5zY3JlZW4uZ2V0QWxsRGlzcGxheXMoKS5sZW5ndGggPiAwKTogdm9pZCB7XG5cblx0XHQvLyBUT0RPQGVsZWN0cm9uIChFbGVjdHJvbiA0IHJlZ3Jlc3Npb24pOiB3aGVuIHJ1bm5pbmcgb24gbXVsdGlwbGUgZGlzcGxheXMgd2hlcmUgdGhlIHRhcmdldCBkaXNwbGF5XG5cdFx0Ly8gdG8gb3BlbiB0aGUgd2luZG93IGhhcyBhIGxhcmdlciByZXNvbHV0aW9uIHRoYW4gdGhlIHByaW1hcnkgZGlzcGxheSwgdGhlIHdpbmRvdyB3aWxsIG5vdCBzaXplXG5cdFx0Ly8gY29ycmVjdGx5IHVubGVzcyB3ZSBzZXQgdGhlIGJvdW5kcyBhZ2FpbiAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzc0ODcyKVxuXHRcdC8vXG5cdFx0Ly8gRXh0ZW5kZWQgdG8gY292ZXIgV2luZG93cyBhcyB3ZWxsIGFzIE1hYyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE0NjQ5OSlcblx0XHQvL1xuXHRcdC8vIEhvd2V2ZXIsIHdoZW4gcnVubmluZyB3aXRoIG5hdGl2ZSB0YWJzIHdpdGggbXVsdGlwbGUgd2luZG93cyB3ZSBjYW5ub3QgdXNlIHRoaXMgd29ya2Fyb3VuZFxuXHRcdC8vIGJlY2F1c2UgdGhlcmUgaXMgYSBwb3RlbnRpYWwgdGhhdCB0aGUgbmV3IHdpbmRvdyB3aWxsIGJlIGFkZGVkIGFzIG5hdGl2ZSB0YWIgaW5zdGVhZCBvZiBiZWluZ1xuXHRcdC8vIGEgd2luZG93IG9uIGl0cyBvd24uIEluIHRoYXQgY2FzZSBjYWxsaW5nIHNldEJvdW5kcygpIHdvdWxkIGNhdXNlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy83NTgzMFxuXG5cdFx0Y29uc3Qgd2luZG93U2V0dGluZ3MgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElXaW5kb3dTZXR0aW5ncyB8IHVuZGVmaW5lZD4oJ3dpbmRvdycpO1xuXHRcdGNvbnN0IHVzZU5hdGl2ZVRhYnMgPSBpc01hY2ludG9zaCAmJiB3aW5kb3dTZXR0aW5ncz8ubmF0aXZlVGFicyA9PT0gdHJ1ZTtcblx0XHRpZiAoKGlzTWFjaW50b3NoIHx8IGlzV2luZG93cykgJiYgaGFzTXVsdGlwbGVEaXNwbGF5cyAmJiAoIXVzZU5hdGl2ZVRhYnMgfHwgZ2V0QWxsV2luZG93c0V4Y2x1ZGluZ09mZnNjcmVlbigpLmxlbmd0aCA9PT0gMSkpIHtcblx0XHRcdGlmIChbc3RhdGUud2lkdGgsIHN0YXRlLmhlaWdodCwgc3RhdGUueCwgc3RhdGUueV0uZXZlcnkodmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykpIHtcblx0XHRcdFx0dGhpcy5fd2luPy5zZXRCb3VuZHMoe1xuXHRcdFx0XHRcdHdpZHRoOiBzdGF0ZS53aWR0aCxcblx0XHRcdFx0XHRoZWlnaHQ6IHN0YXRlLmhlaWdodCxcblx0XHRcdFx0XHR4OiBzdGF0ZS54LFxuXHRcdFx0XHRcdHk6IHN0YXRlLnlcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHN0YXRlLm1vZGUgPT09IFdpbmRvd01vZGUuTWF4aW1pemVkIHx8IHN0YXRlLm1vZGUgPT09IFdpbmRvd01vZGUuRnVsbHNjcmVlbikge1xuXG5cdFx0XHQvLyB0aGlzIGNhbGwgbWF5IG9yIG1heSBub3Qgc2hvdyB0aGUgd2luZG93LCBkZXBlbmRzXG5cdFx0XHQvLyBvbiB0aGUgcGxhdGZvcm06IGN1cnJlbnRseSBvbiBXaW5kb3dzIGFuZCBMaW51eCB3aWxsXG5cdFx0XHQvLyBzaG93IHRoZSB3aW5kb3cgYXMgYWN0aXZlLiBUbyBiZSBvbiB0aGUgc2FmZSBzaWRlLFxuXHRcdFx0Ly8gd2Ugc2hvdyB0aGUgd2luZG93IGF0IHRoZSBlbmQgb2YgdGhpcyBibG9jay5cblx0XHRcdHRoaXMuX3dpbj8ubWF4aW1pemUoKTtcblxuXHRcdFx0aWYgKHN0YXRlLm1vZGUgPT09IFdpbmRvd01vZGUuRnVsbHNjcmVlbikge1xuXHRcdFx0XHR0aGlzLnNldEZ1bGxTY3JlZW4odHJ1ZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHRvIHJlZHVjZSBmbGlja2VyIGZyb20gdGhlIGRlZmF1bHQgd2luZG93IHNpemVcblx0XHRcdC8vIHRvIG1heGltaXplIG9yIGZ1bGxzY3JlZW4sIHdlIG9ubHkgc2hvdyBhZnRlclxuXHRcdFx0dGhpcy5fd2luPy5zaG93KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZXByZXNlbnRlZEZpbGVuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0c2V0UmVwcmVzZW50ZWRGaWxlbmFtZShmaWxlbmFtZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHR0aGlzLndpbj8uc2V0UmVwcmVzZW50ZWRGaWxlbmFtZShmaWxlbmFtZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVwcmVzZW50ZWRGaWxlbmFtZSA9IGZpbGVuYW1lO1xuXHRcdH1cblx0fVxuXG5cdGdldFJlcHJlc2VudGVkRmlsZW5hbWUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdHJldHVybiB0aGlzLndpbj8uZ2V0UmVwcmVzZW50ZWRGaWxlbmFtZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnJlcHJlc2VudGVkRmlsZW5hbWU7XG5cdH1cblxuXHRwcml2YXRlIGRvY3VtZW50RWRpdGVkOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG5cdHNldERvY3VtZW50RWRpdGVkKGVkaXRlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChpc01hY2ludG9zaCkge1xuXHRcdFx0dGhpcy53aW4/LnNldERvY3VtZW50RWRpdGVkKGVkaXRlZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5kb2N1bWVudEVkaXRlZCA9IGVkaXRlZDtcblx0fVxuXG5cdGlzRG9jdW1lbnRFZGl0ZWQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRyZXR1cm4gQm9vbGVhbih0aGlzLndpbj8uaXNEb2N1bWVudEVkaXRlZCgpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gISF0aGlzLmRvY3VtZW50RWRpdGVkO1xuXHR9XG5cblx0Zm9jdXMob3B0aW9ucz86IHsgZm9yY2U6IGJvb2xlYW4gfSk6IHZvaWQge1xuXHRcdGlmIChpc01hY2ludG9zaCAmJiBvcHRpb25zPy5mb3JjZSkge1xuXHRcdFx0ZWxlY3Ryb24uYXBwLmZvY3VzKHsgc3RlYWw6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2luID0gdGhpcy53aW47XG5cdFx0aWYgKCF3aW4pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAod2luLmlzTWluaW1pemVkKCkpIHtcblx0XHRcdHdpbi5yZXN0b3JlKCk7XG5cdFx0fVxuXG5cdFx0d2luLmZvY3VzKCk7XG5cdH1cblxuXHQvLyNyZWdpb24gV2luZG93IENvbnRyb2wgT3ZlcmxheXNcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSB3aW5kb3dDb250cm9sSGVpZ2h0U3RhdGVTdG9yYWdlS2V5ID0gJ3dpbmRvd0NvbnRyb2xIZWlnaHQnO1xuXG5cdHVwZGF0ZVdpbmRvd0NvbnRyb2xzKG9wdGlvbnM6IHsgaGVpZ2h0PzogbnVtYmVyOyBiYWNrZ3JvdW5kQ29sb3I/OiBzdHJpbmc7IGZvcmVncm91bmRDb2xvcj86IHN0cmluZyB9KTogdm9pZCB7XG5cdFx0Y29uc3Qgd2luID0gdGhpcy53aW47XG5cdFx0aWYgKCF3aW4pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBDYWNoZSB0aGUgaGVpZ2h0IGZvciBzcGVlZHMgbG9va3VwcyBvbiBzdGFydHVwXG5cdFx0aWYgKG9wdGlvbnMuaGVpZ2h0KSB7XG5cdFx0XHR0aGlzLnN0YXRlU2VydmljZS5zZXRJdGVtKChDb2RlV2luZG93LndpbmRvd0NvbnRyb2xIZWlnaHRTdGF0ZVN0b3JhZ2VLZXkpLCBvcHRpb25zLmhlaWdodCk7XG5cdFx0fVxuXG5cdFx0Ly8gV2luZG93cy9MaW51eDogdXBkYXRlIHdpbmRvdyBjb250cm9scyB2aWEgc2V0VGl0bGVCYXJPdmVybGF5KClcblx0XHRpZiAoIWlzTWFjaW50b3NoICYmIHVzZVdpbmRvd0NvbnRyb2xzT3ZlcmxheSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSkge1xuXHRcdFx0d2luLnNldFRpdGxlQmFyT3ZlcmxheSh7XG5cdFx0XHRcdGNvbG9yOiBvcHRpb25zLmJhY2tncm91bmRDb2xvcj8udHJpbSgpID09PSAnJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuYmFja2dyb3VuZENvbG9yLFxuXHRcdFx0XHRzeW1ib2xDb2xvcjogb3B0aW9ucy5mb3JlZ3JvdW5kQ29sb3I/LnRyaW0oKSA9PT0gJycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZvcmVncm91bmRDb2xvcixcblx0XHRcdFx0aGVpZ2h0OiBvcHRpb25zLmhlaWdodCA/IG9wdGlvbnMuaGVpZ2h0IC0gMSA6IHVuZGVmaW5lZCAvLyBhY2NvdW50IGZvciB3aW5kb3cgYm9yZGVyXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBtYWNPUzogdXBkYXRlIHdpbmRvdyBjb250cm9scyB2aWEgc2V0V2luZG93QnV0dG9uUG9zaXRpb24oKVxuXHRcdGVsc2UgaWYgKGlzTWFjaW50b3NoICYmIG9wdGlvbnMuaGVpZ2h0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vIFRoZSB0cmFmZmljIGxpZ2h0cyBoYXZlIGEgaGVpZ2h0IG9mIDEycHguIFRoZXJlJ3MgYW4gaW52aXNpYmxlIG1hcmdpblxuXHRcdFx0Ly8gb2YgMnB4IGF0IHRoZSB0b3AgYW5kIGJvdHRvbSwgYW5kIDFweCBvbiB0aGUgbGVmdCBhbmQgcmlnaHQuIFRoZXJlZm9yZSxcblx0XHRcdC8vIHRoZSBoZWlnaHQgZm9yIGNlbnRlcmluZyBpcyAxMnB4ICsgMiAqIDJweCA9IDE2cHguIFdoZW4gdGhlIHBvc2l0aW9uXG5cdFx0XHQvLyBpcyBzZXQsIHRoZSBob3Jpem9udGFsIG1hcmdpbiBpcyBvZmZzZXQgdG8gZW5zdXJlIHRoZSBkaXN0YW5jZSBiZXR3ZWVuXG5cdFx0XHQvLyB0aGUgdHJhZmZpYyBsaWdodHMgYW5kIHRoZSB3aW5kb3cgZnJhbWUgaXMgZXF1YWwgaW4gYm90aCBkaXJlY3Rpb25zLlxuXHRcdFx0Y29uc3Qgb2Zmc2V0ID0gTWF0aC5mbG9vcigob3B0aW9ucy5oZWlnaHQgLSAxNikgLyAyKTtcblx0XHRcdGlmICghb2Zmc2V0KSB7XG5cdFx0XHRcdHdpbi5zZXRXaW5kb3dCdXR0b25Qb3NpdGlvbihudWxsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHdpbi5zZXRXaW5kb3dCdXR0b25Qb3NpdGlvbih7IHg6IG9mZnNldCArIDEsIHk6IG9mZnNldCB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gRnVsbHNjcmVlblxuXG5cdHByaXZhdGUgdHJhbnNpZW50SXNOYXRpdmVGdWxsU2NyZWVuOiBib29sZWFuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGpvaW5OYXRpdmVGdWxsU2NyZWVuVHJhbnNpdGlvbjogRGVmZXJyZWRQcm9taXNlPGJvb2xlYW4+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHRvZ2dsZUZ1bGxTY3JlZW4oKTogdm9pZCB7XG5cdFx0dGhpcy5zZXRGdWxsU2NyZWVuKCF0aGlzLmlzRnVsbFNjcmVlbiwgZmFsc2UpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHNldEZ1bGxTY3JlZW4oZnVsbHNjcmVlbjogYm9vbGVhbiwgZnJvbVJlc3RvcmU6IGJvb2xlYW4pOiB2b2lkIHtcblxuXHRcdC8vIFNldCBmdWxsc2NyZWVuIHN0YXRlXG5cdFx0aWYgKHVzZU5hdGl2ZUZ1bGxTY3JlZW4odGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdHRoaXMuc2V0TmF0aXZlRnVsbFNjcmVlbihmdWxsc2NyZWVuLCBmcm9tUmVzdG9yZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2V0U2ltcGxlRnVsbFNjcmVlbihmdWxsc2NyZWVuKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgaXNGdWxsU2NyZWVuKCk6IGJvb2xlYW4ge1xuXHRcdGlmIChpc01hY2ludG9zaCAmJiB0eXBlb2YgdGhpcy50cmFuc2llbnRJc05hdGl2ZUZ1bGxTY3JlZW4gPT09ICdib29sZWFuJykge1xuXHRcdFx0cmV0dXJuIHRoaXMudHJhbnNpZW50SXNOYXRpdmVGdWxsU2NyZWVuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdpbiA9IHRoaXMud2luO1xuXHRcdGNvbnN0IGlzRnVsbFNjcmVlbiA9IHdpbj8uaXNGdWxsU2NyZWVuKCk7XG5cdFx0Y29uc3QgaXNTaW1wbGVGdWxsU2NyZWVuID0gd2luPy5pc1NpbXBsZUZ1bGxTY3JlZW4oKTtcblxuXHRcdHJldHVybiBCb29sZWFuKGlzRnVsbFNjcmVlbiB8fCBpc1NpbXBsZUZ1bGxTY3JlZW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXROYXRpdmVGdWxsU2NyZWVuKGZ1bGxzY3JlZW46IGJvb2xlYW4sIGZyb21SZXN0b3JlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3Qgd2luID0gdGhpcy53aW47XG5cdFx0aWYgKHdpbj8uaXNTaW1wbGVGdWxsU2NyZWVuKCkpIHtcblx0XHRcdHdpbj8uc2V0U2ltcGxlRnVsbFNjcmVlbihmYWxzZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5kb1NldE5hdGl2ZUZ1bGxTY3JlZW4oZnVsbHNjcmVlbiwgZnJvbVJlc3RvcmUpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1NldE5hdGl2ZUZ1bGxTY3JlZW4oZnVsbHNjcmVlbjogYm9vbGVhbiwgZnJvbVJlc3RvcmU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblxuXHRcdFx0Ly8gbWFjT1M6IEVsZWN0cm9uIHdpbmRvd3MgcmVwb3J0IGBmYWxzZWAgZm9yIGBpc0Z1bGxTY3JlZW4oKWAgZm9yIGFzIGxvbmdcblx0XHRcdC8vIGFzIHRoZSBmdWxsc2NyZWVuIHRyYW5zaXRpb24gYW5pbWF0aW9uIHRha2VzIHBsYWNlLiBBcyBzdWNoLCB3ZSBuZWVkIHRvXG5cdFx0XHQvLyBsaXN0ZW4gdG8gdGhlIHRyYW5zaXRpb24gZXZlbnRzIGFuZCBjYXJyeSBhcm91bmQgYW4gaW50ZXJtZWRpYXRlIHN0YXRlXG5cdFx0XHQvLyBmb3Iga25vd2luZyBpZiB3ZSBhcmUgaW4gZnVsbHNjcmVlbiBvciBub3Rcblx0XHRcdC8vIFJlZnM6IGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvMzUzNjBcblxuXHRcdFx0dGhpcy50cmFuc2llbnRJc05hdGl2ZUZ1bGxTY3JlZW4gPSBmdWxsc2NyZWVuO1xuXG5cdFx0XHRjb25zdCBqb2luTmF0aXZlRnVsbFNjcmVlblRyYW5zaXRpb24gPSB0aGlzLmpvaW5OYXRpdmVGdWxsU2NyZWVuVHJhbnNpdGlvbiA9IG5ldyBEZWZlcnJlZFByb21pc2U8Ym9vbGVhbj4oKTtcblx0XHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHRyYW5zaXRpb25lZCA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHRcdFx0am9pbk5hdGl2ZUZ1bGxTY3JlZW5UcmFuc2l0aW9uLnAsXG5cdFx0XHRcdFx0dGltZW91dCgxMDAwMCkudGhlbigoKSA9PiBmYWxzZSlcblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0aWYgKHRoaXMuam9pbk5hdGl2ZUZ1bGxTY3JlZW5UcmFuc2l0aW9uICE9PSBqb2luTmF0aXZlRnVsbFNjcmVlblRyYW5zaXRpb24pIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIGFub3RoZXIgdHJhbnNpdGlvbiB3YXMgcmVxdWVzdGVkIGxhdGVyXG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnRyYW5zaWVudElzTmF0aXZlRnVsbFNjcmVlbiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5qb2luTmF0aXZlRnVsbFNjcmVlblRyYW5zaXRpb24gPSB1bmRlZmluZWQ7XG5cblx0XHRcdFx0Ly8gVGhlcmUgaXMgb25lIGludGVyZXN0aW5nIGdvdGNoYSBvbiBtYWNPUzogd2hlbiB5b3UgYXJlIG9wZW5pbmcgYSBuZXdcblx0XHRcdFx0Ly8gd2luZG93IGZyb20gYSBmdWxsc2NyZWVuIHdpbmRvdywgdGhhdCBuZXcgd2luZG93IHdpbGwgaW1tZWRpYXRlbHlcblx0XHRcdFx0Ly8gb3BlbiBmdWxsc2NyZWVuIGFuZCBlbWl0IHRoZSBgZW50ZXItZnVsbC1zY3JlZW5gIGV2ZW50IGV2ZW4gYmVmb3JlIHdlXG5cdFx0XHRcdC8vIHJlYWNoIHRoaXMgbWV0aG9kLiBJbiB0aGF0IGNhc2UsIHdlIGFjdHVhbGx5IHdpbGwgdGltZW91dCBhZnRlciAxMHNcblx0XHRcdFx0Ly8gZm9yIGRldGVjdGluZyB0aGUgdHJhbnNpdGlvbiBhbmQgYXMgc3VjaCBpdCBpcyBpbXBvcnRhbnQgdGhhdCB3ZSBvbmx5XG5cdFx0XHRcdC8vIHNpZ25hbCB0byBsZWF2ZSBmdWxsc2NyZWVuIGlmIHRoZSB3aW5kb3cgcmVwb3J0cyBhcyBub3QgYmVpbmcgaW4gZnVsbHNjcmVlbi5cblxuXHRcdFx0XHRpZiAoIXRyYW5zaXRpb25lZCAmJiBmdWxsc2NyZWVuICYmIGZyb21SZXN0b3JlICYmIHRoaXMud2luICYmICF0aGlzLndpbi5pc0Z1bGxTY3JlZW4oKSkge1xuXG5cdFx0XHRcdFx0Ly8gV2UgaGF2ZSBzZWVuIHJlcXVlc3RzIGZvciBmdWxsc2NyZWVuIGZhaWxpbmcgZXZlbnR1YWxseSBhZnRlciBzb21lXG5cdFx0XHRcdFx0Ly8gdGltZSwgZm9yIGV4YW1wbGUgd2hlbiBhbiBPUyB1cGRhdGUgd2FzIHBlcmZvcm1lZCBhbmQgd2luZG93cyByZXN0b3JlLlxuXHRcdFx0XHRcdC8vIEluIHRob3NlIGNhc2VzIGEgdXNlciB3b3VsZCBmaW5kIGEgd2luZG93IHRoYXQgaXMgbm90IGluIGZ1bGxzY3JlZW5cblx0XHRcdFx0XHQvLyBidXQgYWxzbyBkb2VzIG5vdCBzaG93IGFueSBjdXN0b20gdGl0bGViYXIgKGFuZCB0aHVzIHdpbmRvdyBjb250cm9scylcblx0XHRcdFx0XHQvLyBiZWNhdXNlIHdlIHRoaW5rIHRoZSB3aW5kb3cgaXMgaW4gZnVsbHNjcmVlbi5cblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdC8vIEFzIGEgd29ya2Fyb3VuZCBpbiB0aGF0IGNhc2Ugd2UgZW1pdCBhIHdhcm5pbmcgYW5kIGxlYXZlIGZ1bGxzY3JlZW5cblx0XHRcdFx0XHQvLyBzbyB0aGF0IGF0IGxlYXN0IHRoZSB3aW5kb3cgY29udHJvbHMgYXJlIGJhY2suXG5cblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2Fybignd2luZG93OiBuYXRpdmUgbWFjT1MgZnVsbHNjcmVlbiB0cmFuc2l0aW9uIGRpZCBub3QgaGFwcGVuIHdpdGhpbiAxMHMgZnJvbSByZXN0b3JpbmcnKTtcblxuXHRcdFx0XHRcdHRoaXMuX29uRGlkTGVhdmVGdWxsU2NyZWVuLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkoKTtcblx0XHR9XG5cblx0XHRjb25zdCB3aW4gPSB0aGlzLndpbjtcblx0XHR3aW4/LnNldEZ1bGxTY3JlZW4oZnVsbHNjcmVlbik7XG5cdH1cblxuXHRwcml2YXRlIHNldFNpbXBsZUZ1bGxTY3JlZW4oZnVsbHNjcmVlbjogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IHdpbiA9IHRoaXMud2luO1xuXHRcdGlmICh3aW4/LmlzRnVsbFNjcmVlbigpKSB7XG5cdFx0XHR0aGlzLmRvU2V0TmF0aXZlRnVsbFNjcmVlbihmYWxzZSwgZmFsc2UpO1xuXHRcdH1cblxuXHRcdHdpbj8uc2V0U2ltcGxlRnVsbFNjcmVlbihmdWxsc2NyZWVuKTtcblx0XHR3aW4/LndlYkNvbnRlbnRzLmZvY3VzKCk7IC8vIHdvcmthcm91bmQgaXNzdWUgd2hlcmUgZm9jdXMgaXMgbm90IGdvaW5nIGludG8gd2luZG93XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRhYnN0cmFjdCBtYXRjaGVzKHdlYkNvbnRlbnRzOiBlbGVjdHJvbi5XZWJDb250ZW50cyk6IGJvb2xlYW47XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLl93aW4gPSBudWxsITsgLy8gSW1wb3J0YW50IHRvIGRlcmVmZXJlbmNlIHRoZSB3aW5kb3cgb2JqZWN0IHRvIGFsbG93IGZvciBHQ1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb2RlV2luZG93IGV4dGVuZHMgQmFzZVdpbmRvdyBpbXBsZW1lbnRzIElDb2RlV2luZG93IHtcblxuXHQvLyNyZWdpb24gRXZlbnRzXG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsTG9hZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElMb2FkRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxMb2FkID0gdGhpcy5fb25XaWxsTG9hZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNpZ25hbFJlYWR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU2lnbmFsUmVhZHkgPSB0aGlzLl9vbkRpZFNpZ25hbFJlYWR5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGVzdHJveSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZERlc3Ryb3kgPSB0aGlzLl9vbkRpZERlc3Ryb3kuZXZlbnQ7XG5cblx0Ly8jZW5kcmVnaW9uXG5cblxuXHQvLyNyZWdpb24gUHJvcGVydGllc1xuXG5cdHByaXZhdGUgX2lkOiBudW1iZXI7XG5cdGdldCBpZCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5faWQ7IH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX3dpbjogZWxlY3Ryb24uQnJvd3NlcldpbmRvdztcblxuXHRnZXQgYmFja3VwUGF0aCgpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fY29uZmlnPy5iYWNrdXBQYXRoOyB9XG5cblx0Z2V0IG9wZW5lZFdvcmtzcGFjZSgpOiBJV29ya3NwYWNlSWRlbnRpZmllciB8IElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2NvbmZpZz8ud29ya3NwYWNlOyB9XG5cblx0Z2V0IHByb2ZpbGUoKTogSVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLmNvbmZpZykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBwcm9maWxlID0gdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcy5maW5kKHByb2ZpbGUgPT4gcHJvZmlsZS5pZCA9PT0gdGhpcy5jb25maWc/LnByb2ZpbGVzLnByb2ZpbGUuaWQpO1xuXHRcdGlmICh0aGlzLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnRIb3N0ICYmIHByb2ZpbGUpIHtcblx0XHRcdHJldHVybiBwcm9maWxlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmdldFByb2ZpbGVGb3JXb3Jrc3BhY2UodGhpcy5jb25maWcud29ya3NwYWNlID8/IHRvV29ya3NwYWNlSWRlbnRpZmllcih0aGlzLmJhY2t1cFBhdGgsIHRoaXMuaXNFeHRlbnNpb25EZXZlbG9wbWVudEhvc3QpKSA/PyB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlO1xuXHR9XG5cblx0Z2V0IHJlbW90ZUF1dGhvcml0eSgpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fY29uZmlnPy5yZW1vdGVBdXRob3JpdHk7IH1cblxuXHRwcml2YXRlIF9jb25maWc6IElOYXRpdmVXaW5kb3dDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkO1xuXHRnZXQgY29uZmlnKCk6IElOYXRpdmVXaW5kb3dDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2NvbmZpZzsgfVxuXG5cdGdldCBpc0V4dGVuc2lvbkRldmVsb3BtZW50SG9zdCgpOiBib29sZWFuIHsgcmV0dXJuICEhKHRoaXMuX2NvbmZpZz8uZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoKTsgfVxuXG5cdGdldCBpc0V4dGVuc2lvblRlc3RIb3N0KCk6IGJvb2xlYW4geyByZXR1cm4gISEodGhpcy5fY29uZmlnPy5leHRlbnNpb25UZXN0c1BhdGgpOyB9XG5cblx0Z2V0IGlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnRUZXN0RnJvbUNsaSgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuaXNFeHRlbnNpb25EZXZlbG9wbWVudEhvc3QgJiYgdGhpcy5pc0V4dGVuc2lvblRlc3RIb3N0ICYmICF0aGlzLl9jb25maWc/LmRlYnVnSWQ7IH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcml2YXRlIHJlYWRvbmx5IHdpbmRvd1N0YXRlOiBJV2luZG93U3RhdGU7XG5cdHByaXZhdGUgY3VycmVudE1lbnVCYXJWaXNpYmlsaXR5OiBNZW51QmFyVmlzaWJpbGl0eSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHdoZW5SZWFkeUNhbGxiYWNrczogeyAod2luZG93OiBJQ29kZVdpbmRvdyk6IHZvaWQgfVtdID0gW107XG5cblx0cHJpdmF0ZSByZWFkb25seSB0b3VjaEJhckdyb3VwczogZWxlY3Ryb24uVG91Y2hCYXJTZWdtZW50ZWRDb250cm9sW10gPSBbXTtcblxuXHRwcml2YXRlIGN1cnJlbnRIdHRwUHJveHk6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjdXJyZW50Tm9Qcm94eTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgY3VzdG9tWm9vbUxldmVsOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb25maWdPYmplY3RVcmw6IElJUENPYmplY3RVcmw8SU5hdGl2ZVdpbmRvd0NvbmZpZ3VyYXRpb24+O1xuXHRwcml2YXRlIHBlbmRpbmdMb2FkQ29uZmlnOiBJTmF0aXZlV2luZG93Q29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB3YXNMb2FkZWQgPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGpzQ2FsbFN0YWNrTWFwOiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGpzQ2FsbFN0YWNrRWZmZWN0aXZlU2FtcGxlQ291bnQ6IG51bWJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBqc0NhbGxTdGFja0NvbGxlY3RvcjogRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSByZWFkb25seSBqc0NhbGxTdGFja0NvbGxlY3RvclN0b3BTY2hlZHVsZXI6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29uZmlnOiBJV2luZG93Q3JlYXRpb25PcHRpb25zLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUxvZ2dlck1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nZ2VyTWFpblNlcnZpY2U6IElMb2dnZXJNYWluU2VydmljZSxcblx0XHRASUVudmlyb25tZW50TWFpblNlcnZpY2UgZW52aXJvbm1lbnRNYWluU2VydmljZTogSUVudmlyb25tZW50TWFpblNlcnZpY2UsXG5cdFx0QElQb2xpY3lTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcG9saWN5U2VydmljZTogSVBvbGljeVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUFwcGxpY2F0aW9uU3RvcmFnZU1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYXBwbGljYXRpb25TdG9yYWdlTWFpblNlcnZpY2U6IElBcHBsaWNhdGlvblN0b3JhZ2VNYWluU2VydmljZSxcblx0XHRASVN0b3JhZ2VNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VNYWluU2VydmljZTogSVN0b3JhZ2VNYWluU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZU1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGhlbWVNYWluU2VydmljZTogSVRoZW1lTWFpblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZTogSVdvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UsXG5cdFx0QElCYWNrdXBNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGJhY2t1cE1haW5TZXJ2aWNlOiBJQmFja3VwTWFpblNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElEaWFsb2dNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ01haW5TZXJ2aWNlOiBJRGlhbG9nTWFpblNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZU1haW5TZXJ2aWNlOiBJTGlmZWN5Y2xlTWFpblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElQcm90b2NvbE1haW5TZXJ2aWNlIHByb3RvY29sTWFpblNlcnZpY2U6IElQcm90b2NvbE1haW5TZXJ2aWNlLFxuXHRcdEBJV2luZG93c01haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd2luZG93c01haW5TZXJ2aWNlOiBJV2luZG93c01haW5TZXJ2aWNlLFxuXHRcdEBJU3RhdGVTZXJ2aWNlIHN0YXRlU2VydmljZTogSVN0YXRlU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoY29uZmlndXJhdGlvblNlcnZpY2UsIHN0YXRlU2VydmljZSwgZW52aXJvbm1lbnRNYWluU2VydmljZSwgbG9nU2VydmljZSk7XG5cblx0XHQvLyNyZWdpb24gY3JlYXRlIGJyb3dzZXIgd2luZG93XG5cdFx0e1xuXHRcdFx0dGhpcy5jb25maWdPYmplY3RVcmwgPSB0aGlzLl9yZWdpc3Rlcihwcm90b2NvbE1haW5TZXJ2aWNlLmNyZWF0ZUlQQ09iamVjdFVybDxJTmF0aXZlV2luZG93Q29uZmlndXJhdGlvbj4oKSk7XG5cblx0XHRcdC8vIExvYWQgd2luZG93IHN0YXRlXG5cdFx0XHRjb25zdCBbc3RhdGUsIGhhc011bHRpcGxlRGlzcGxheXNdID0gdGhpcy5yZXN0b3JlV2luZG93U3RhdGUoY29uZmlnLnN0YXRlKTtcblx0XHRcdHRoaXMud2luZG93U3RhdGUgPSBzdGF0ZTtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnd2luZG93I2N0b3I6IHVzaW5nIHdpbmRvdyBzdGF0ZScsIHN0YXRlKTtcblxuXHRcdFx0Y29uc3Qgb3B0aW9ucyA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGRlZmF1bHRCcm93c2VyV2luZG93T3B0aW9ucywgdGhpcy53aW5kb3dTdGF0ZSwgdW5kZWZpbmVkLCB7XG5cdFx0XHRcdHByZWxvYWQ6IEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy9iYXNlL3BhcnRzL3NhbmRib3gvZWxlY3Ryb24tc2FuZGJveC9wcmVsb2FkLmpzJykuZnNQYXRoLFxuXHRcdFx0XHRhZGRpdGlvbmFsQXJndW1lbnRzOiBbYC0tdnNjb2RlLXdpbmRvdy1jb25maWc9JHt0aGlzLmNvbmZpZ09iamVjdFVybC5yZXNvdXJjZS50b1N0cmluZygpfWBdLFxuXHRcdFx0XHR2OENhY2hlT3B0aW9uczogdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLnVzZUNvZGVDYWNoZSA/ICdieXBhc3NIZWF0Q2hlY2snIDogJ25vbmUnLFxuXHRcdFx0fSk7XG5cblx0XHRcdC8vIENyZWF0ZSB0aGUgYnJvd3NlciB3aW5kb3dcblx0XHRcdG1hcmsoJ2NvZGUvd2lsbENyZWF0ZUNvZGVCcm93c2VyV2luZG93Jyk7XG5cdFx0XHR0aGlzLl93aW4gPSBuZXcgZWxlY3Ryb24uQnJvd3NlcldpbmRvdyhvcHRpb25zKTtcblx0XHRcdG1hcmsoJ2NvZGUvZGlkQ3JlYXRlQ29kZUJyb3dzZXJXaW5kb3cnKTtcblxuXHRcdFx0dGhpcy5faWQgPSB0aGlzLl93aW4uaWQ7XG5cdFx0XHR0aGlzLnNldFdpbih0aGlzLl93aW4sIG9wdGlvbnMpO1xuXG5cdFx0XHQvLyBBcHBseSBzb21lIHN0YXRlIGFmdGVyIHdpbmRvdyBjcmVhdGlvblxuXHRcdFx0dGhpcy5hcHBseVN0YXRlKHRoaXMud2luZG93U3RhdGUsIGhhc011bHRpcGxlRGlzcGxheXMpO1xuXG5cdFx0XHR0aGlzLl9sYXN0Rm9jdXNUaW1lID0gRGF0ZS5ub3coKTsgLy8gc2luY2Ugd2Ugc2hvdyBkaXJlY3RseSwgd2UgbmVlZCB0byBzZXQgdGhlIGxhc3QgZm9jdXMgdGltZSB0b29cblx0XHR9XG5cdFx0Ly8jZW5kcmVnaW9uXG5cblx0XHQvLyNyZWdpb24gSlMgQ2FsbHN0YWNrIENvbGxlY3RvclxuXG5cdFx0bGV0IHNhbXBsZUludGVydmFsID0gcGFyc2VJbnQodGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFyZ3NbJ3VucmVzcG9uc2l2ZS1zYW1wbGUtaW50ZXJ2YWwnXSB8fCAnMTAwMCcpO1xuXHRcdGxldCBzYW1wbGVQZXJpb2QgPSBwYXJzZUludCh0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXJnc1sndW5yZXNwb25zaXZlLXNhbXBsZS1wZXJpb2QnXSB8fCAnMTUwMDAnKTtcblx0XHRpZiAoc2FtcGxlSW50ZXJ2YWwgPD0gMCB8fCBzYW1wbGVQZXJpb2QgPD0gMCB8fCBzYW1wbGVJbnRlcnZhbCA+IHNhbXBsZVBlcmlvZCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oYEludmFsaWQgdW5yZXNwb25zaXZlIHNhbXBsZSBpbnRlcnZhbCAoJHtzYW1wbGVJbnRlcnZhbH1tcykgb3IgcGVyaW9kICgke3NhbXBsZVBlcmlvZH1tcyksIHVzaW5nIGRlZmF1bHRzLmApO1xuXHRcdFx0c2FtcGxlSW50ZXJ2YWwgPSAxMDAwO1xuXHRcdFx0c2FtcGxlUGVyaW9kID0gMTUwMDA7XG5cdFx0fVxuXG5cdFx0dGhpcy5qc0NhbGxTdGFja01hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cdFx0dGhpcy5qc0NhbGxTdGFja0VmZmVjdGl2ZVNhbXBsZUNvdW50ID0gTWF0aC5yb3VuZChzYW1wbGVJbnRlcnZhbCAvIHNhbXBsZVBlcmlvZCk7XG5cdFx0dGhpcy5qc0NhbGxTdGFja0NvbGxlY3RvciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEZWxheWVyPHZvaWQ+KHNhbXBsZUludGVydmFsKSk7XG5cdFx0dGhpcy5qc0NhbGxTdGFja0NvbGxlY3RvclN0b3BTY2hlZHVsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHR0aGlzLnN0b3BDb2xsZWN0aW5nSlNjYWxsU3RhY2tzKCk7IC8vIFN0b3AgY29sbGVjdGluZyBhZnRlciAxNXMgbWF4XG5cdFx0fSwgc2FtcGxlUGVyaW9kKSk7XG5cblx0XHQvLyNlbmRyZWdpb25cblxuXHRcdC8vIHJlc3BlY3QgY29uZmlndXJlZCBtZW51IGJhciB2aXNpYmlsaXR5XG5cdFx0dGhpcy5vbkNvbmZpZ3VyYXRpb25VcGRhdGVkKCk7XG5cblx0XHQvLyBtYWNPUzogdG91Y2ggYmFyIHN1cHBvcnRcblx0XHR0aGlzLmNyZWF0ZVRvdWNoQmFyKCk7XG5cblx0XHQvLyBFdmVudGluZ1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZHlTdGF0ZSA9IFJlYWR5U3RhdGUuTk9ORTtcblxuXHRzZXRSZWFkeSgpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYHdpbmRvdyNsb2FkOiB3aW5kb3cgcmVwb3J0ZWQgcmVhZHkgKGlkOiAke3RoaXMuX2lkfSlgKTtcblxuXHRcdHRoaXMucmVhZHlTdGF0ZSA9IFJlYWR5U3RhdGUuUkVBRFk7XG5cblx0XHQvLyBpbmZvcm0gYWxsIHdhaXRpbmcgcHJvbWlzZXMgdGhhdCB3ZSBhcmUgcmVhZHkgbm93XG5cdFx0d2hpbGUgKHRoaXMud2hlblJlYWR5Q2FsbGJhY2tzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy53aGVuUmVhZHlDYWxsYmFja3MucG9wKCkhKHRoaXMpO1xuXHRcdH1cblxuXHRcdC8vIEV2ZW50c1xuXHRcdHRoaXMuX29uRGlkU2lnbmFsUmVhZHkuZmlyZSgpO1xuXHR9XG5cblx0cmVhZHkoKTogUHJvbWlzZTxJQ29kZVdpbmRvdz4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxJQ29kZVdpbmRvdz4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1JlYWR5KSB7XG5cdFx0XHRcdHJldHVybiByZXNvbHZlKHRoaXMpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBvdGhlcndpc2Uga2VlcCBhbmQgY2FsbCBsYXRlciB3aGVuIHdlIGFyZSByZWFkeVxuXHRcdFx0dGhpcy53aGVuUmVhZHlDYWxsYmFja3MucHVzaChyZXNvbHZlKTtcblx0XHR9KTtcblx0fVxuXG5cdGdldCBpc1JlYWR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnJlYWR5U3RhdGUgPT09IFJlYWR5U3RhdGUuUkVBRFk7XG5cdH1cblxuXHRnZXQgd2hlbkNsb3NlZE9yTG9hZGVkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblxuXHRcdFx0ZnVuY3Rpb24gaGFuZGxlKCkge1xuXHRcdFx0XHRjbG9zZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0bG9hZExpc3RlbmVyLmRpc3Bvc2UoKTtcblxuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNsb3NlTGlzdGVuZXIgPSB0aGlzLm9uRGlkQ2xvc2UoKCkgPT4gaGFuZGxlKCkpO1xuXHRcdFx0Y29uc3QgbG9hZExpc3RlbmVyID0gdGhpcy5vbldpbGxMb2FkKCgpID0+IGhhbmRsZSgpKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cblx0XHQvLyBXaW5kb3cgZXJyb3IgY29uZGl0aW9ucyB0byBoYW5kbGVcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcih0aGlzLl93aW4sICd1bnJlc3BvbnNpdmUnKSgoKSA9PiB0aGlzLm9uV2luZG93RXJyb3IoV2luZG93RXJyb3IuVU5SRVNQT05TSVZFKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKHRoaXMuX3dpbiwgJ3Jlc3BvbnNpdmUnKSgoKSA9PiB0aGlzLm9uV2luZG93RXJyb3IoV2luZG93RXJyb3IuUkVTUE9OU0lWRSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcih0aGlzLl93aW4ud2ViQ29udGVudHMsICdyZW5kZXItcHJvY2Vzcy1nb25lJywgKGV2ZW50LCBkZXRhaWxzKSA9PiBkZXRhaWxzKShkZXRhaWxzID0+IHRoaXMub25XaW5kb3dFcnJvcihXaW5kb3dFcnJvci5QUk9DRVNTX0dPTkUsIHsgLi4uZGV0YWlscyB9KSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKHRoaXMuX3dpbi53ZWJDb250ZW50cywgJ2RpZC1mYWlsLWxvYWQnLCAoZXZlbnQsIGV4aXRDb2RlLCByZWFzb24pID0+ICh7IGV4aXRDb2RlLCByZWFzb24gfSkpKCh7IGV4aXRDb2RlLCByZWFzb24gfSkgPT4gdGhpcy5vbldpbmRvd0Vycm9yKFdpbmRvd0Vycm9yLkxPQUQsIHsgcmVhc29uLCBleGl0Q29kZSB9KSkpO1xuXG5cdFx0Ly8gUHJldmVudCB3aW5kb3dzL2lmcmFtZXMgZnJvbSBibG9ja2luZyB0aGUgdW5sb2FkXG5cdFx0Ly8gdGhyb3VnaCBET00gZXZlbnRzLiBXZSBoYXZlIG91ciBvd24gbG9naWMgZm9yXG5cdFx0Ly8gdW5sb2FkaW5nIGEgd2luZG93IHRoYXQgc2hvdWxkIG5vdCBiZSBjb25mdXNlZFxuXHRcdC8vIHdpdGggdGhlIERPTSB3YXkuXG5cdFx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMjI3MzYpXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXI8ZWxlY3Ryb24uRXZlbnQ+KHRoaXMuX3dpbi53ZWJDb250ZW50cywgJ3dpbGwtcHJldmVudC11bmxvYWQnKShldmVudCA9PiBldmVudC5wcmV2ZW50RGVmYXVsdCgpKSk7XG5cblx0XHQvLyBSZW1lbWJlciB0aGF0IHdlIGxvYWRlZFxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKHRoaXMuX3dpbi53ZWJDb250ZW50cywgJ2RpZC1maW5pc2gtbG9hZCcpKCgpID0+IHtcblxuXHRcdFx0Ly8gQXNzb2NpYXRlIHByb3BlcnRpZXMgZnJvbSB0aGUgbG9hZCByZXF1ZXN0IGlmIHByb3ZpZGVkXG5cdFx0XHRpZiAodGhpcy5wZW5kaW5nTG9hZENvbmZpZykge1xuXHRcdFx0XHR0aGlzLl9jb25maWcgPSB0aGlzLnBlbmRpbmdMb2FkQ29uZmlnO1xuXG5cdFx0XHRcdHRoaXMucGVuZGluZ0xvYWRDb25maWcgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gV2luZG93IChVbilNYXhpbWl6ZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRNYXhpbWl6ZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fY29uZmlnKSB7XG5cdFx0XHRcdHRoaXMuX2NvbmZpZy5tYXhpbWl6ZWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRVbm1heGltaXplKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9jb25maWcpIHtcblx0XHRcdFx0dGhpcy5fY29uZmlnLm1heGltaXplZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIFdpbmRvdyBGdWxsc2NyZWVuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZEVudGVyRnVsbFNjcmVlbigoKSA9PiB7XG5cdFx0XHR0aGlzLnNlbmRXaGVuUmVhZHkoJ3ZzY29kZTplbnRlckZ1bGxTY3JlZW4nLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkTGVhdmVGdWxsU2NyZWVuKCgpID0+IHtcblx0XHRcdHRoaXMuc2VuZFdoZW5SZWFkeSgndnNjb2RlOmxlYXZlRnVsbFNjcmVlbicsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdH0pKTtcblxuXHRcdC8vIEhhbmRsZSBjb25maWd1cmF0aW9uIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHRoaXMub25Db25maWd1cmF0aW9uVXBkYXRlZChlKSkpO1xuXG5cdFx0Ly8gSGFuZGxlIFdvcmtzcGFjZSBldmVudHNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2Uub25EaWREZWxldGVVbnRpdGxlZFdvcmtzcGFjZShlID0+IHRoaXMub25EaWREZWxldGVVbnRpdGxlZFdvcmtzcGFjZShlKSkpO1xuXG5cdFx0Ly8gSW5qZWN0IGhlYWRlcnMgd2hlbiByZXF1ZXN0cyBhcmUgaW5jb21pbmdcblx0XHRjb25zdCB1cmxzID0gWydodHRwczovL21hcmtldHBsYWNlLnZpc3VhbHN0dWRpby5jb20vKicsICdodHRwczovLyoudnNhc3NldHMuaW8vKiddO1xuXHRcdHRoaXMuX3dpbi53ZWJDb250ZW50cy5zZXNzaW9uLndlYlJlcXVlc3Qub25CZWZvcmVTZW5kSGVhZGVycyh7IHVybHMgfSwgYXN5bmMgKGRldGFpbHMsIGNiKSA9PiB7XG5cdFx0XHRjb25zdCBoZWFkZXJzID0gYXdhaXQgdGhpcy5nZXRNYXJrZXRwbGFjZUhlYWRlcnMoKTtcblxuXHRcdFx0Y2IoeyBjYW5jZWw6IGZhbHNlLCByZXF1ZXN0SGVhZGVyczogT2JqZWN0LmFzc2lnbihkZXRhaWxzLnJlcXVlc3RIZWFkZXJzLCBoZWFkZXJzKSB9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgbWFya2V0cGxhY2VIZWFkZXJzUHJvbWlzZTogUHJvbWlzZTxvYmplY3Q+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldE1hcmtldHBsYWNlSGVhZGVycygpOiBQcm9taXNlPG9iamVjdD4ge1xuXHRcdGlmICghdGhpcy5tYXJrZXRwbGFjZUhlYWRlcnNQcm9taXNlKSB7XG5cdFx0XHR0aGlzLm1hcmtldHBsYWNlSGVhZGVyc1Byb21pc2UgPSByZXNvbHZlTWFya2V0cGxhY2VIZWFkZXJzKFxuXHRcdFx0XHR0aGlzLnByb2R1Y3RTZXJ2aWNlLnZlcnNpb24sXG5cdFx0XHRcdHRoaXMucHJvZHVjdFNlcnZpY2UsXG5cdFx0XHRcdHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZSxcblx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdFx0dGhpcy5maWxlU2VydmljZSxcblx0XHRcdFx0dGhpcy5hcHBsaWNhdGlvblN0b3JhZ2VNYWluU2VydmljZSxcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5tYXJrZXRwbGFjZUhlYWRlcnNQcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbldpbmRvd0Vycm9yKGVycm9yOiBXaW5kb3dFcnJvci5VTlJFU1BPTlNJVkUpOiBQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIGFzeW5jIG9uV2luZG93RXJyb3IoZXJyb3I6IFdpbmRvd0Vycm9yLlJFU1BPTlNJVkUpOiBQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIGFzeW5jIG9uV2luZG93RXJyb3IoZXJyb3I6IFdpbmRvd0Vycm9yLlBST0NFU1NfR09ORSwgZGV0YWlsczogeyByZWFzb246IHN0cmluZzsgZXhpdENvZGU6IG51bWJlciB9KTogUHJvbWlzZTx2b2lkPjtcblx0cHJpdmF0ZSBhc3luYyBvbldpbmRvd0Vycm9yKGVycm9yOiBXaW5kb3dFcnJvci5MT0FELCBkZXRhaWxzOiB7IHJlYXNvbjogc3RyaW5nOyBleGl0Q29kZTogbnVtYmVyIH0pOiBQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIGFzeW5jIG9uV2luZG93RXJyb3IodHlwZTogV2luZG93RXJyb3IsIGRldGFpbHM/OiB7IHJlYXNvbj86IHN0cmluZzsgZXhpdENvZGU/OiBudW1iZXIgfSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRjYXNlIFdpbmRvd0Vycm9yLlBST0NFU1NfR09ORTpcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBDb2RlV2luZG93OiByZW5kZXJlciBwcm9jZXNzIGdvbmUgKHJlYXNvbjogJHtkZXRhaWxzPy5yZWFzb24gfHwgJzx1bmtub3duPid9LCBjb2RlOiAke2RldGFpbHM/LmV4aXRDb2RlIHx8ICc8dW5rbm93bj4nfSlgKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFdpbmRvd0Vycm9yLlVOUkVTUE9OU0lWRTpcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdDb2RlV2luZG93OiBkZXRlY3RlZCB1bnJlc3BvbnNpdmUnKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFdpbmRvd0Vycm9yLlJFU1BPTlNJVkU6XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignQ29kZVdpbmRvdzogcmVjb3ZlcmVkIGZyb20gdW5yZXNwb25zaXZlJyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBXaW5kb3dFcnJvci5MT0FEOlxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYENvZGVXaW5kb3c6IGZhaWxlZCB0byBsb2FkIChyZWFzb246ICR7ZGV0YWlscz8ucmVhc29uIHx8ICc8dW5rbm93bj4nfSwgY29kZTogJHtkZXRhaWxzPy5leGl0Q29kZSB8fCAnPHVua25vd24+J30pYCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdC8vIFRlbGVtZXRyeVxuXHRcdHR5cGUgV2luZG93RXJyb3JDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdHR5cGU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgdHlwZSBvZiB3aW5kb3cgZXJyb3IgdG8gdW5kZXJzdGFuZCB0aGUgbmF0dXJlIG9mIHRoZSBlcnJvciBiZXR0ZXIuJyB9O1xuXHRcdFx0cmVhc29uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHJlYXNvbiBvZiB0aGUgd2luZG93IGVycm9yIHRvIHVuZGVyc3RhbmQgdGhlIG5hdHVyZSBvZiB0aGUgZXJyb3IgYmV0dGVyLicgfTtcblx0XHRcdGNvZGU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgZXhpdCBjb2RlIG9mIHRoZSB3aW5kb3cgcHJvY2VzcyB0byB1bmRlcnN0YW5kIHRoZSBuYXR1cmUgb2YgdGhlIGVycm9yIGJldHRlcicgfTtcblx0XHRcdG93bmVyOiAnYnBhc2Vybyc7XG5cdFx0XHRjb21tZW50OiAnUHJvdmlkZXMgaW5zaWdodCBpbnRvIHJlYXNvbnMgdGhlIHZzY29kZSB3aW5kb3cgaGFkIGFuIGVycm9yLic7XG5cdFx0fTtcblx0XHR0eXBlIFdpbmRvd0Vycm9yRXZlbnQgPSB7XG5cdFx0XHR0eXBlOiBXaW5kb3dFcnJvcjtcblx0XHRcdHJlYXNvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29kZTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdH07XG5cdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8V2luZG93RXJyb3JFdmVudCwgV2luZG93RXJyb3JDbGFzc2lmaWNhdGlvbj4oJ3dpbmRvd2Vycm9yJywge1xuXHRcdFx0dHlwZSxcblx0XHRcdHJlYXNvbjogZGV0YWlscz8ucmVhc29uLFxuXHRcdFx0Y29kZTogZGV0YWlscz8uZXhpdENvZGVcblx0XHR9KTtcblxuXHRcdC8vIEluZm9ybSBVc2VyIGlmIG5vbi1yZWNvdmVyYWJsZVxuXHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0Y2FzZSBXaW5kb3dFcnJvci5VTlJFU1BPTlNJVkU6XG5cdFx0XHRjYXNlIFdpbmRvd0Vycm9yLlBST0NFU1NfR09ORTpcblxuXHRcdFx0XHQvLyBJZiB3ZSBydW4gZXh0ZW5zaW9uIHRlc3RzIGZyb20gQ0xJLCB3ZSB3YW50IHRvIHNpZ25hbFxuXHRcdFx0XHQvLyBiYWNrIHRoaXMgc3RhdGUgdG8gdGhlIHRlc3QgcnVubmVyIGJ5IGV4aXRpbmcgd2l0aCBhXG5cdFx0XHRcdC8vIG5vbi16ZXJvIGV4aXQgY29kZS5cblx0XHRcdFx0aWYgKHRoaXMuaXNFeHRlbnNpb25EZXZlbG9wbWVudFRlc3RGcm9tQ2xpKSB7XG5cdFx0XHRcdFx0dGhpcy5saWZlY3ljbGVNYWluU2VydmljZS5raWxsKDEpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIElmIHdlIHJ1biBzbW9rZSB0ZXN0cywgd2FudCB0byBwcm9jZWVkIHdpdGggYW4gb3JkZXJseVxuXHRcdFx0XHQvLyBzaHV0ZG93biBhcyBtdWNoIGFzIHBvc3NpYmxlIGJ5IGRlc3Ryb3lpbmcgdGhlIHdpbmRvd1xuXHRcdFx0XHQvLyBhbmQgdGhlbiBjYWxsaW5nIHRoZSBub3JtYWwgYHF1aXRgIHJvdXRpbmUuXG5cdFx0XHRcdGlmICh0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXJnc1snZW5hYmxlLXNtb2tlLXRlc3QtZHJpdmVyJ10pIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRlc3Ryb3lXaW5kb3coZmFsc2UsIGZhbHNlKTtcblx0XHRcdFx0XHR0aGlzLmxpZmVjeWNsZU1haW5TZXJ2aWNlLnF1aXQoKTsgLy8gc3RpbGwgYWxsb3cgZm9yIGFuIG9yZGVybHkgc2h1dGRvd25cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBVbnJlc3BvbnNpdmVcblx0XHRcdFx0aWYgKHR5cGUgPT09IFdpbmRvd0Vycm9yLlVOUkVTUE9OU0lWRSkge1xuXHRcdFx0XHRcdGlmICh0aGlzLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnRIb3N0IHx8IHRoaXMuaXNFeHRlbnNpb25UZXN0SG9zdCB8fCAodGhpcy5fd2luICYmIHRoaXMuX3dpbi53ZWJDb250ZW50cyAmJiB0aGlzLl93aW4ud2ViQ29udGVudHMuaXNEZXZUb29sc09wZW5lZCgpKSkge1xuXHRcdFx0XHRcdFx0Ly8gVE9ET0BlbGVjdHJvbiBXb3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNTY5OTRcblx0XHRcdFx0XHRcdC8vIEluIGNlcnRhaW4gY2FzZXMgdGhlIHdpbmRvdyBjYW4gcmVwb3J0IHVucmVzcG9uc2l2ZW5lc3MgYmVjYXVzZSBhIGJyZWFrcG9pbnQgd2FzIGhpdFxuXHRcdFx0XHRcdFx0Ly8gYW5kIHRoZSBwcm9jZXNzIGlzIHN0b3BwZWQgZXhlY3V0aW5nLiBUaGUgbW9zdCB0eXBpY2FsIGNhc2VzIGFyZTpcblx0XHRcdFx0XHRcdC8vIC0gZGV2dG9vbHMgYXJlIG9wZW5lZCBhbmQgZGVidWdnaW5nIGhhcHBlbnNcblx0XHRcdFx0XHRcdC8vIC0gd2luZG93IGlzIGFuIGV4dGVuc2lvbnMgZGV2ZWxvcG1lbnQgaG9zdCB0aGF0IGlzIGJlaW5nIGRlYnVnZ2VkXG5cdFx0XHRcdFx0XHQvLyAtIHdpbmRvdyBpcyBhbiBleHRlbnNpb24gdGVzdCBkZXZlbG9wbWVudCBob3N0IHRoYXQgaXMgYmVpbmcgZGVidWdnZWRcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBJbnRlcnJ1cHQgVjggYW5kIGNvbGxlY3QgSmF2YVNjcmlwdCBzdGFja1xuXHRcdFx0XHRcdHRoaXMuanNDYWxsU3RhY2tDb2xsZWN0b3IudHJpZ2dlcigoKSA9PiB0aGlzLnN0YXJ0Q29sbGVjdGluZ0pTY2FsbFN0YWNrcygpKTtcblx0XHRcdFx0XHQvLyBTdGFjayBjb2xsZWN0aW9uIHdpbGwgc3RvcCB1bmRlciBhbnkgb2YgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxuXHRcdFx0XHRcdC8vIC0gVGhlIHdpbmRvdyBiZWNvbWVzIHJlc3BvbnNpdmUgYWdhaW5cblx0XHRcdFx0XHQvLyAtIFRoZSB3aW5kb3cgaXMgZGVzdHJveWVkIGktZSByZW9wZW4gb3IgY2xvc2VkXG5cdFx0XHRcdFx0Ly8gLSBzYW1wbGluZyBwZXJpb2QgaXMgY29tcGxldGUsIGRlZmF1bHQgaXMgMTVzXG5cdFx0XHRcdFx0dGhpcy5qc0NhbGxTdGFja0NvbGxlY3RvclN0b3BTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblxuXHRcdFx0XHRcdC8vIFNob3cgRGlhbG9nXG5cdFx0XHRcdFx0Y29uc3QgeyByZXNwb25zZSwgY2hlY2tib3hDaGVja2VkIH0gPSBhd2FpdCB0aGlzLmRpYWxvZ01haW5TZXJ2aWNlLnNob3dNZXNzYWdlQm94KHtcblx0XHRcdFx0XHRcdHR5cGU6ICd3YXJuaW5nJyxcblx0XHRcdFx0XHRcdGJ1dHRvbnM6IFtcblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICdyZW9wZW4nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZW9wZW5cIiksXG5cdFx0XHRcdFx0XHRcdGxvY2FsaXplKHsga2V5OiAnY2xvc2UnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDbG9zZVwiKSxcblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICd3YWl0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmS2VlcCBXYWl0aW5nXCIpXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2FwcFN0YWxsZWQnLCBcIlRoZSB3aW5kb3cgaXMgbm90IHJlc3BvbmRpbmdcIiksXG5cdFx0XHRcdFx0XHRkZXRhaWw6IGxvY2FsaXplKCdhcHBTdGFsbGVkRGV0YWlsJywgXCJZb3UgY2FuIHJlb3BlbiBvciBjbG9zZSB0aGUgd2luZG93IG9yIGtlZXAgd2FpdGluZy5cIiksXG5cdFx0XHRcdFx0XHRjaGVja2JveExhYmVsOiB0aGlzLl9jb25maWc/LndvcmtzcGFjZSA/IGxvY2FsaXplKCdkb05vdFJlc3RvcmVFZGl0b3JzJywgXCJEb24ndCByZXN0b3JlIGVkaXRvcnNcIikgOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LCB0aGlzLl93aW4pO1xuXG5cdFx0XHRcdFx0Ly8gSGFuZGxlIGNob2ljZVxuXHRcdFx0XHRcdGlmIChyZXNwb25zZSAhPT0gMiAvKiBrZWVwIHdhaXRpbmcgKi8pIHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlb3BlbiA9IHJlc3BvbnNlID09PSAwO1xuXHRcdFx0XHRcdFx0dGhpcy5zdG9wQ29sbGVjdGluZ0pTY2FsbFN0YWNrcygpO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5kZXN0cm95V2luZG93KHJlb3BlbiwgY2hlY2tib3hDaGVja2VkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBQcm9jZXNzIGdvbmVcblx0XHRcdFx0ZWxzZSBpZiAodHlwZSA9PT0gV2luZG93RXJyb3IuUFJPQ0VTU19HT05FKSB7XG5cdFx0XHRcdFx0bGV0IG1lc3NhZ2U6IHN0cmluZztcblx0XHRcdFx0XHRpZiAoIWRldGFpbHMpIHtcblx0XHRcdFx0XHRcdG1lc3NhZ2UgPSBsb2NhbGl6ZSgnYXBwR29uZScsIFwiVGhlIHdpbmRvdyB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseVwiKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bWVzc2FnZSA9IGxvY2FsaXplKCdhcHBHb25lRGV0YWlscycsIFwiVGhlIHdpbmRvdyB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseSAocmVhc29uOiAnezB9JywgY29kZTogJ3sxfScpXCIsIGRldGFpbHMucmVhc29uLCBkZXRhaWxzLmV4aXRDb2RlID8/ICc8dW5rbm93bj4nKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBTaG93IERpYWxvZ1xuXHRcdFx0XHRcdGNvbnN0IHsgcmVzcG9uc2UsIGNoZWNrYm94Q2hlY2tlZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dNYWluU2VydmljZS5zaG93TWVzc2FnZUJveCh7XG5cdFx0XHRcdFx0XHR0eXBlOiAnd2FybmluZycsXG5cdFx0XHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0XHRcdHRoaXMuX2NvbmZpZz8ud29ya3NwYWNlID8gbG9jYWxpemUoeyBrZXk6ICdyZW9wZW4nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZW9wZW5cIikgOiBsb2NhbGl6ZSh7IGtleTogJ25ld1dpbmRvdycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk5ldyBXaW5kb3dcIiksXG5cdFx0XHRcdFx0XHRcdGxvY2FsaXplKHsga2V5OiAnY2xvc2UnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDbG9zZVwiKVxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdFx0XHRkZXRhaWw6IHRoaXMuX2NvbmZpZz8ud29ya3NwYWNlID9cblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2FwcEdvbmVEZXRhaWxXb3Jrc3BhY2UnLCBcIldlIGFyZSBzb3JyeSBmb3IgdGhlIGluY29udmVuaWVuY2UuIFlvdSBjYW4gcmVvcGVuIHRoZSB3aW5kb3cgdG8gY29udGludWUgd2hlcmUgeW91IGxlZnQgb2ZmLlwiKSA6XG5cdFx0XHRcdFx0XHRcdGxvY2FsaXplKCdhcHBHb25lRGV0YWlsRW1wdHlXaW5kb3cnLCBcIldlIGFyZSBzb3JyeSBmb3IgdGhlIGluY29udmVuaWVuY2UuIFlvdSBjYW4gb3BlbiBhIG5ldyBlbXB0eSB3aW5kb3cgdG8gc3RhcnQgYWdhaW4uXCIpLFxuXHRcdFx0XHRcdFx0Y2hlY2tib3hMYWJlbDogdGhpcy5fY29uZmlnPy53b3Jrc3BhY2UgPyBsb2NhbGl6ZSgnZG9Ob3RSZXN0b3JlRWRpdG9ycycsIFwiRG9uJ3QgcmVzdG9yZSBlZGl0b3JzXCIpIDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSwgdGhpcy5fd2luKTtcblxuXHRcdFx0XHRcdC8vIEhhbmRsZSBjaG9pY2Vcblx0XHRcdFx0XHRjb25zdCByZW9wZW4gPSByZXNwb25zZSA9PT0gMDtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRlc3Ryb3lXaW5kb3cocmVvcGVuLCBjaGVja2JveENoZWNrZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBXaW5kb3dFcnJvci5SRVNQT05TSVZFOlxuXHRcdFx0XHR0aGlzLnN0b3BDb2xsZWN0aW5nSlNjYWxsU3RhY2tzKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZGVzdHJveVdpbmRvdyhyZW9wZW46IGJvb2xlYW4sIHNraXBSZXN0b3JlRWRpdG9yczogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMuX2NvbmZpZz8ud29ya3NwYWNlO1xuXG5cdFx0Ly8gY2hlY2sgdG8gZGlzY2FyZCBlZGl0b3Igc3RhdGUgZmlyc3Rcblx0XHRpZiAoc2tpcFJlc3RvcmVFZGl0b3JzICYmIHdvcmtzcGFjZSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlU3RvcmFnZSA9IHRoaXMuc3RvcmFnZU1haW5TZXJ2aWNlLndvcmtzcGFjZVN0b3JhZ2Uod29ya3NwYWNlKTtcblx0XHRcdFx0YXdhaXQgd29ya3NwYWNlU3RvcmFnZS5pbml0KCk7XG5cdFx0XHRcdHdvcmtzcGFjZVN0b3JhZ2UuZGVsZXRlKCdtZW1lbnRvL3dvcmtiZW5jaC5wYXJ0cy5lZGl0b3InKTtcblx0XHRcdFx0YXdhaXQgd29ya3NwYWNlU3RvcmFnZS5jbG9zZSgpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyAnY2xvc2UnIGV2ZW50IHdpbGwgbm90IGJlIGZpcmVkIG9uIGRlc3Ryb3koKSwgc28gc2lnbmFsIGNyYXNoIHZpYSBleHBsaWNpdCBldmVudFxuXHRcdHRoaXMuX29uRGlkRGVzdHJveS5maXJlKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0Ly8gYXNrIHRoZSB3aW5kb3dzIHNlcnZpY2UgdG8gb3BlbiBhIG5ldyBmcmVzaCB3aW5kb3cgaWYgc3BlY2lmaWVkXG5cdFx0XHRpZiAocmVvcGVuICYmIHRoaXMuX2NvbmZpZykge1xuXG5cdFx0XHRcdC8vIFdlIGhhdmUgdG8gcmVjb25zdHJ1Y3QgYSBvcGVuYWJsZSBmcm9tIHRoZSBjdXJyZW50IHdvcmtzcGFjZVxuXHRcdFx0XHRsZXQgdXJpVG9PcGVuOiBJV29ya3NwYWNlVG9PcGVuIHwgSUZvbGRlclRvT3BlbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0bGV0IGZvcmNlRW1wdHkgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlKSkge1xuXHRcdFx0XHRcdHVyaVRvT3BlbiA9IHsgZm9sZGVyVXJpOiB3b3Jrc3BhY2UudXJpIH07XG5cdFx0XHRcdH0gZWxzZSBpZiAoaXNXb3Jrc3BhY2VJZGVudGlmaWVyKHdvcmtzcGFjZSkpIHtcblx0XHRcdFx0XHR1cmlUb09wZW4gPSB7IHdvcmtzcGFjZVVyaTogd29ya3NwYWNlLmNvbmZpZ1BhdGggfTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmb3JjZUVtcHR5ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIERlbGVnYXRlIHRvIHdpbmRvd3Mgc2VydmljZVxuXHRcdFx0XHRjb25zdCB3aW5kb3cgPSAoYXdhaXQgdGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub3Blbih7XG5cdFx0XHRcdFx0Y29udGV4dDogT3BlbkNvbnRleHQuQVBJLFxuXHRcdFx0XHRcdHVzZXJFbnY6IHRoaXMuX2NvbmZpZy51c2VyRW52LFxuXHRcdFx0XHRcdGNsaToge1xuXHRcdFx0XHRcdFx0Li4udGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFyZ3MsXG5cdFx0XHRcdFx0XHRfOiBbXSAvLyB3ZSBwYXNzIGluIHRoZSB3b3Jrc3BhY2UgdG8gb3BlbiBleHBsaWNpdGx5IHZpYSBgdXJpc1RvT3BlbmBcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHVyaXNUb09wZW46IHVyaVRvT3BlbiA/IFt1cmlUb09wZW5dIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGZvcmNlRW1wdHksXG5cdFx0XHRcdFx0Zm9yY2VOZXdXaW5kb3c6IHRydWUsXG5cdFx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiB0aGlzLnJlbW90ZUF1dGhvcml0eVxuXHRcdFx0XHR9KSkuYXQoMCk7XG5cdFx0XHRcdHdpbmRvdz8uZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Ly8gbWFrZSBzdXJlIHRvIGRlc3Ryb3kgdGhlIHdpbmRvdyBhcyBpdHMgcmVuZGVyZXIgcHJvY2VzcyBpcyBnb25lLiBkbyB0aGlzXG5cdFx0XHQvLyBhZnRlciB0aGUgY29kZSBmb3IgcmVvcGVuaW5nIHRoZSB3aW5kb3csIHRvIHByZXZlbnQgdGhlIGVudGlyZSBhcHBsaWNhdGlvblxuXHRcdFx0Ly8gZnJvbSBxdWl0dGluZyB3aGVuIHRoZSBsYXN0IHdpbmRvdyBjbG9zZXMgYXMgYSByZXN1bHQuXG5cdFx0XHR0aGlzLl93aW4/LmRlc3Ryb3koKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkRGVsZXRlVW50aXRsZWRXb3Jrc3BhY2Uod29ya3NwYWNlOiBJV29ya3NwYWNlSWRlbnRpZmllcik6IHZvaWQge1xuXG5cdFx0Ly8gTWFrZSBzdXJlIHRvIHVwZGF0ZSBvdXIgd29ya3NwYWNlIGNvbmZpZyBpZiB3ZSBkZXRlY3QgdGhhdCBpdFxuXHRcdC8vIHdhcyBkZWxldGVkXG5cdFx0aWYgKHRoaXMuX2NvbmZpZz8ud29ya3NwYWNlPy5pZCA9PT0gd29ya3NwYWNlLmlkKSB7XG5cdFx0XHR0aGlzLl9jb25maWcud29ya3NwYWNlID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Db25maWd1cmF0aW9uVXBkYXRlZChlPzogSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCk6IHZvaWQge1xuXG5cdFx0Ly8gTWVudWJhclxuXHRcdGlmICghZSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCd3aW5kb3cubWVudUJhclZpc2liaWxpdHknKSkge1xuXHRcdFx0Y29uc3QgbmV3TWVudUJhclZpc2liaWxpdHkgPSB0aGlzLmdldE1lbnVCYXJWaXNpYmlsaXR5KCk7XG5cdFx0XHRpZiAobmV3TWVudUJhclZpc2liaWxpdHkgIT09IHRoaXMuY3VycmVudE1lbnVCYXJWaXNpYmlsaXR5KSB7XG5cdFx0XHRcdHRoaXMuY3VycmVudE1lbnVCYXJWaXNpYmlsaXR5ID0gbmV3TWVudUJhclZpc2liaWxpdHk7XG5cdFx0XHRcdHRoaXMuc2V0TWVudUJhclZpc2liaWxpdHkobmV3TWVudUJhclZpc2liaWxpdHkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFByb3h5XG5cdFx0aWYgKCFlIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2h0dHAucHJveHknKSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdodHRwLm5vUHJveHknKSkge1xuXHRcdFx0Y29uc3QgaW5zcGVjdCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDxzdHJpbmc+KCdodHRwLnByb3h5Jyk7XG5cdFx0XHRsZXQgbmV3SHR0cFByb3h5ID0gKGluc3BlY3QudXNlckxvY2FsVmFsdWUgfHwgJycpLnRyaW0oKVxuXHRcdFx0XHR8fCAocHJvY2Vzcy5lbnZbJ2h0dHBzX3Byb3h5J10gfHwgcHJvY2Vzcy5lbnZbJ0hUVFBTX1BST1hZJ10gfHwgcHJvY2Vzcy5lbnZbJ2h0dHBfcHJveHknXSB8fCBwcm9jZXNzLmVudlsnSFRUUF9QUk9YWSddIHx8ICcnKS50cmltKCkgLy8gTm90IHN0YW5kYXJkaXplZC5cblx0XHRcdFx0fHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAobmV3SHR0cFByb3h5Py5pbmRleE9mKCdAJykgIT09IC0xKSB7XG5cdFx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShuZXdIdHRwUHJveHkhKTtcblx0XHRcdFx0Y29uc3QgaSA9IHVyaS5hdXRob3JpdHkuaW5kZXhPZignQCcpO1xuXHRcdFx0XHRpZiAoaSAhPT0gLTEpIHtcblx0XHRcdFx0XHRuZXdIdHRwUHJveHkgPSB1cmkud2l0aCh7IGF1dGhvcml0eTogdXJpLmF1dGhvcml0eS5zdWJzdHJpbmcoaSArIDEpIH0pXG5cdFx0XHRcdFx0XHQudG9TdHJpbmcoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG5ld0h0dHBQcm94eT8uZW5kc1dpdGgoJy8nKSkge1xuXHRcdFx0XHRuZXdIdHRwUHJveHkgPSBuZXdIdHRwUHJveHkuc3Vic3RyKDAsIG5ld0h0dHBQcm94eS5sZW5ndGggLSAxKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV3Tm9Qcm94eSA9ICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZ1tdPignaHR0cC5ub1Byb3h5JykgfHwgW10pLm1hcCgoaXRlbSkgPT4gaXRlbS50cmltKCkpLmpvaW4oJywnKVxuXHRcdFx0XHR8fCAocHJvY2Vzcy5lbnZbJ25vX3Byb3h5J10gfHwgcHJvY2Vzcy5lbnZbJ05PX1BST1hZJ10gfHwgJycpLnRyaW0oKSB8fCB1bmRlZmluZWQ7IC8vIE5vdCBzdGFuZGFyZGl6ZWQuXG5cdFx0XHRpZiAoKG5ld0h0dHBQcm94eSB8fCAnJykuaW5kZXhPZignQCcpID09PSAtMSAmJiAobmV3SHR0cFByb3h5ICE9PSB0aGlzLmN1cnJlbnRIdHRwUHJveHkgfHwgbmV3Tm9Qcm94eSAhPT0gdGhpcy5jdXJyZW50Tm9Qcm94eSkpIHtcblx0XHRcdFx0dGhpcy5jdXJyZW50SHR0cFByb3h5ID0gbmV3SHR0cFByb3h5O1xuXHRcdFx0XHR0aGlzLmN1cnJlbnROb1Byb3h5ID0gbmV3Tm9Qcm94eTtcblxuXHRcdFx0XHRjb25zdCBwcm94eVJ1bGVzID0gbmV3SHR0cFByb3h5IHx8ICcnO1xuXHRcdFx0XHRjb25zdCBwcm94eUJ5cGFzc1J1bGVzID0gbmV3Tm9Qcm94eSA/IGAke25ld05vUHJveHl9LDxsb2NhbD5gIDogJzxsb2NhbD4nO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFNldHRpbmcgcHJveHkgdG8gJyR7cHJveHlSdWxlc30nLCBieXBhc3NpbmcgJyR7cHJveHlCeXBhc3NSdWxlc30nYCk7XG5cdFx0XHRcdHRoaXMuX3dpbi53ZWJDb250ZW50cy5zZXNzaW9uLnNldFByb3h5KHsgcHJveHlSdWxlcywgcHJveHlCeXBhc3NSdWxlcywgcGFjU2NyaXB0OiAnJyB9KTtcblx0XHRcdFx0ZWxlY3Ryb24uYXBwLnNldFByb3h5KHsgcHJveHlSdWxlcywgcHJveHlCeXBhc3NSdWxlcywgcGFjU2NyaXB0OiAnJyB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhZGRUYWJiZWRXaW5kb3cod2luZG93OiBJQ29kZVdpbmRvdyk6IHZvaWQge1xuXHRcdGlmIChpc01hY2ludG9zaCAmJiB3aW5kb3cud2luKSB7XG5cdFx0XHR0aGlzLl93aW4uYWRkVGFiYmVkV2luZG93KHdpbmRvdy53aW4pO1xuXHRcdH1cblx0fVxuXG5cdGxvYWQoY29uZmlndXJhdGlvbjogSU5hdGl2ZVdpbmRvd0NvbmZpZ3VyYXRpb24sIG9wdGlvbnM6IElMb2FkT3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCkpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYHdpbmRvdyNsb2FkOiBhdHRlbXB0IHRvIGxvYWQgd2luZG93IChpZDogJHt0aGlzLl9pZH0pYCk7XG5cblx0XHQvLyBDbGVhciBEb2N1bWVudCBFZGl0ZWQgaWYgbmVlZGVkXG5cdFx0aWYgKHRoaXMuaXNEb2N1bWVudEVkaXRlZCgpKSB7XG5cdFx0XHRpZiAoIW9wdGlvbnMuaXNSZWxvYWQgfHwgIXRoaXMuYmFja3VwTWFpblNlcnZpY2UuaXNIb3RFeGl0RW5hYmxlZCgpKSB7XG5cdFx0XHRcdHRoaXMuc2V0RG9jdW1lbnRFZGl0ZWQoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENsZWFyIFRpdGxlIGFuZCBGaWxlbmFtZSBpZiBuZWVkZWRcblx0XHRpZiAoIW9wdGlvbnMuaXNSZWxvYWQpIHtcblx0XHRcdGlmICh0aGlzLmdldFJlcHJlc2VudGVkRmlsZW5hbWUoKSkge1xuXHRcdFx0XHR0aGlzLnNldFJlcHJlc2VudGVkRmlsZW5hbWUoJycpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl93aW4uc2V0VGl0bGUodGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIGNvbmZpZ3VyYXRpb24gdmFsdWVzIGJhc2VkIG9uIG91ciB3aW5kb3cgY29udGV4dFxuXHRcdC8vIGFuZCBzZXQgaXQgaW50byB0aGUgY29uZmlnIG9iamVjdCBVUkwgZm9yIHVzYWdlLlxuXHRcdHRoaXMudXBkYXRlQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uLCBvcHRpb25zKTtcblxuXHRcdC8vIElmIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWUgdGhlIHdpbmRvdyBpcyBsb2FkZWQsIHdlIGFzc29jaWF0ZSB0aGUgcGF0aHNcblx0XHQvLyBkaXJlY3RseSB3aXRoIHRoZSB3aW5kb3cgYmVjYXVzZSB3ZSBhc3N1bWUgdGhlIGxvYWRpbmcgd2lsbCBqdXN0IHdvcmtcblx0XHRpZiAodGhpcy5yZWFkeVN0YXRlID09PSBSZWFkeVN0YXRlLk5PTkUpIHtcblx0XHRcdHRoaXMuX2NvbmZpZyA9IGNvbmZpZ3VyYXRpb247XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlLCB0aGUgd2luZG93IGlzIGN1cnJlbnRseSBzaG93aW5nIGEgZm9sZGVyIGFuZCBpZiB0aGVyZSBpcyBhblxuXHRcdC8vIHVubG9hZCBoYW5kbGVyIHByZXZlbnRpbmcgdGhlIGxvYWQsIHdlIGNhbm5vdCBqdXN0IGFzc29jaWF0ZSB0aGUgcGF0aHNcblx0XHQvLyBiZWNhdXNlIHRoZSBsb2FkaW5nIG1pZ2h0IGJlIHZldG9lZC4gSW5zdGVhZCB3ZSBhc3NvY2lhdGUgaXQgbGF0ZXIgd2hlblxuXHRcdC8vIHRoZSB3aW5kb3cgbG9hZCBldmVudCBoYXMgZmlyZWQuXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLnBlbmRpbmdMb2FkQ29uZmlnID0gY29uZmlndXJhdGlvbjtcblx0XHR9XG5cblx0XHQvLyBJbmRpY2F0ZSB3ZSBhcmUgbmF2aWd0aW5nIG5vd1xuXHRcdHRoaXMucmVhZHlTdGF0ZSA9IFJlYWR5U3RhdGUuTkFWSUdBVElORztcblxuXHRcdC8vIExvYWQgVVJMXG5cdFx0dGhpcy5fd2luLmxvYWRVUkwoRmlsZUFjY2Vzcy5hc0Jyb3dzZXJVcmkoYHZzL2NvZGUvZWxlY3Ryb24tc2FuZGJveC93b3JrYmVuY2gvd29ya2JlbmNoJHt0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuaXNCdWlsdCA/ICcnIDogJy1kZXYnfS5odG1sYCkudG9TdHJpbmcodHJ1ZSkpO1xuXG5cdFx0Ly8gUmVtZW1iZXIgdGhhdCB3ZSBkaWQgbG9hZFxuXHRcdGNvbnN0IHdhc0xvYWRlZCA9IHRoaXMud2FzTG9hZGVkO1xuXHRcdHRoaXMud2FzTG9hZGVkID0gdHJ1ZTtcblxuXHRcdC8vIE1ha2Ugd2luZG93IHZpc2libGUgaWYgaXQgZGlkIG5vdCBvcGVuIGluIE4gc2Vjb25kcyBiZWNhdXNlIHRoaXMgaW5kaWNhdGVzIGFuIGVycm9yXG5cdFx0Ly8gT25seSBkbyB0aGlzIHdoZW4gcnVubmluZyBvdXQgb2Ygc291cmNlcyBhbmQgbm90IHdoZW4gcnVubmluZyB0ZXN0c1xuXHRcdGlmICghdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmlzQnVpbHQgJiYgIXRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5leHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLl93aW4gJiYgIXRoaXMuX3dpbi5pc1Zpc2libGUoKSAmJiAhdGhpcy5fd2luLmlzTWluaW1pemVkKCkpIHtcblx0XHRcdFx0XHR0aGlzLl93aW4uc2hvdygpO1xuXHRcdFx0XHRcdHRoaXMuZm9jdXMoeyBmb3JjZTogdHJ1ZSB9KTtcblx0XHRcdFx0XHR0aGlzLl93aW4ud2ViQ29udGVudHMub3BlbkRldlRvb2xzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDEwMDAwKSkuc2NoZWR1bGUoKTtcblx0XHR9XG5cblx0XHQvLyBFdmVudFxuXHRcdHRoaXMuX29uV2lsbExvYWQuZmlyZSh7IHdvcmtzcGFjZTogY29uZmlndXJhdGlvbi53b3Jrc3BhY2UsIHJlYXNvbjogb3B0aW9ucy5pc1JlbG9hZCA/IExvYWRSZWFzb24uUkVMT0FEIDogd2FzTG9hZGVkID8gTG9hZFJlYXNvbi5MT0FEIDogTG9hZFJlYXNvbi5JTklUSUFMIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDb25maWd1cmF0aW9uKGNvbmZpZ3VyYXRpb246IElOYXRpdmVXaW5kb3dDb25maWd1cmF0aW9uLCBvcHRpb25zOiBJTG9hZE9wdGlvbnMpOiB2b2lkIHtcblxuXHRcdC8vIElmIHRoaXMgd2luZG93IHdhcyBsb2FkZWQgYmVmb3JlIGZyb20gdGhlIGNvbW1hbmQgbGluZVxuXHRcdC8vIChhcyBpbmRpY2F0ZWQgYnkgVlNDT0RFX0NMSSBlbnZpcm9ubWVudCksIG1ha2Ugc3VyZSB0b1xuXHRcdC8vIHByZXNlcnZlIHRoYXQgdXNlciBlbnZpcm9ubWVudCBpbiBzdWJzZXF1ZW50IGxvYWRzLFxuXHRcdC8vIHVubGVzcyB0aGUgbmV3IGNvbmZpZ3VyYXRpb24gY29udGV4dCB3YXMgYWxzbyBhIENMSVxuXHRcdC8vIChmb3IgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwODU3MSlcblx0XHQvLyBBbHNvLCBwcmVzZXJ2ZSB0aGUgZW52aXJvbm1lbnQgaWYgd2UncmUgbG9hZGluZyBmcm9tIGFuXG5cdFx0Ly8gZXh0ZW5zaW9uIGRldmVsb3BtZW50IGhvc3QgdGhhdCBoYWQgaXRzIGVudmlyb25tZW50IHNldFxuXHRcdC8vIChmb3IgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEyMzUwOClcblx0XHRjb25zdCBjdXJyZW50VXNlckVudiA9ICh0aGlzLl9jb25maWcgPz8gdGhpcy5wZW5kaW5nTG9hZENvbmZpZyk/LnVzZXJFbnY7XG5cdFx0aWYgKGN1cnJlbnRVc2VyRW52KSB7XG5cdFx0XHRjb25zdCBzaG91bGRQcmVzZXJ2ZUxhdW5jaENsaUVudmlyb25tZW50ID0gaXNMYXVuY2hlZEZyb21DbGkoY3VycmVudFVzZXJFbnYpICYmICFpc0xhdW5jaGVkRnJvbUNsaShjb25maWd1cmF0aW9uLnVzZXJFbnYpO1xuXHRcdFx0Y29uc3Qgc2hvdWxkUHJlc2VydmVEZWJ1Z0Vudmlyb25tbmV0ID0gdGhpcy5pc0V4dGVuc2lvbkRldmVsb3BtZW50SG9zdDtcblx0XHRcdGlmIChzaG91bGRQcmVzZXJ2ZUxhdW5jaENsaUVudmlyb25tZW50IHx8IHNob3VsZFByZXNlcnZlRGVidWdFbnZpcm9ubW5ldCkge1xuXHRcdFx0XHRjb25maWd1cmF0aW9uLnVzZXJFbnYgPSB7IC4uLmN1cnJlbnRVc2VyRW52LCAuLi5jb25maWd1cmF0aW9uLnVzZXJFbnYgfTsgLy8gc3RpbGwgYWxsb3cgdG8gb3ZlcnJpZGUgY2VydGFpbiBlbnZpcm9ubWVudCBhcyBwYXNzZWQgaW5cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJZiBuYW1lZCBwaXBlIHdhcyBpbnN0YW50aWF0ZWQgZm9yIHRoZSBjcmFzaHBhZF9oYW5kbGVyIHByb2Nlc3MsIHJldXNlIHRoZSBzYW1lXG5cdFx0Ly8gcGlwZSBmb3IgbmV3IGFwcCBpbnN0YW5jZXMgY29ubmVjdGluZyB0byB0aGUgb3JpZ2luYWwgYXBwIGluc3RhbmNlLlxuXHRcdC8vIFJlZjogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExNTg3NFxuXHRcdGlmIChwcm9jZXNzLmVudlsnQ0hST01FX0NSQVNIUEFEX1BJUEVfTkFNRSddKSB7XG5cdFx0XHRPYmplY3QuYXNzaWduKGNvbmZpZ3VyYXRpb24udXNlckVudiwge1xuXHRcdFx0XHRDSFJPTUVfQ1JBU0hQQURfUElQRV9OQU1FOiBwcm9jZXNzLmVudlsnQ0hST01FX0NSQVNIUEFEX1BJUEVfTkFNRSddXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBBZGQgZGlzYWJsZS1leHRlbnNpb25zIHRvIHRoZSBjb25maWcsIGJ1dCBkbyBub3QgcHJlc2VydmUgaXQgb24gY3VycmVudENvbmZpZyBvclxuXHRcdC8vIHBlbmRpbmdMb2FkQ29uZmlnIHNvIHRoYXQgaXQgaXMgYXBwbGllZCBvbmx5IG9uIHRoaXMgbG9hZFxuXHRcdGlmIChvcHRpb25zLmRpc2FibGVFeHRlbnNpb25zICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbmZpZ3VyYXRpb25bJ2Rpc2FibGUtZXh0ZW5zaW9ucyddID0gb3B0aW9ucy5kaXNhYmxlRXh0ZW5zaW9ucztcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgd2luZG93IHJlbGF0ZWQgcHJvcGVydGllc1xuXHRcdHRyeSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLmhhbmRsZSA9IFZTQnVmZmVyLndyYXAodGhpcy5fd2luLmdldE5hdGl2ZVdpbmRvd0hhbmRsZSgpKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBFcnJvciBnZXR0aW5nIG5hdGl2ZSB3aW5kb3cgaGFuZGxlOiAke2Vycm9yfWApO1xuXHRcdH1cblx0XHRjb25maWd1cmF0aW9uLmZ1bGxzY3JlZW4gPSB0aGlzLmlzRnVsbFNjcmVlbjtcblx0XHRjb25maWd1cmF0aW9uLm1heGltaXplZCA9IHRoaXMuX3dpbi5pc01heGltaXplZCgpO1xuXHRcdGNvbmZpZ3VyYXRpb24ucGFydHNTcGxhc2ggPSB0aGlzLnRoZW1lTWFpblNlcnZpY2UuZ2V0V2luZG93U3BsYXNoKGNvbmZpZ3VyYXRpb24ud29ya3NwYWNlKTtcblx0XHRjb25maWd1cmF0aW9uLnpvb21MZXZlbCA9IHRoaXMuZ2V0Wm9vbUxldmVsKCk7XG5cdFx0Y29uZmlndXJhdGlvbi5pc0N1c3RvbVpvb21MZXZlbCA9IHR5cGVvZiB0aGlzLmN1c3RvbVpvb21MZXZlbCA9PT0gJ251bWJlcic7XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb24uaXNDdXN0b21ab29tTGV2ZWwgJiYgY29uZmlndXJhdGlvbi5wYXJ0c1NwbGFzaCkge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5wYXJ0c1NwbGFzaC56b29tTGV2ZWwgPSBjb25maWd1cmF0aW9uLnpvb21MZXZlbDtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgd2l0aCBsYXRlc3QgcGVyZiBtYXJrc1xuXHRcdG1hcmsoJ2NvZGUvd2lsbE9wZW5OZXdXaW5kb3cnKTtcblx0XHRjb25maWd1cmF0aW9uLnBlcmZNYXJrcyA9IGdldE1hcmtzKCk7XG5cblx0XHQvLyBVcGRhdGUgaW4gY29uZmlnIG9iamVjdCBVUkwgZm9yIHVzYWdlIGluIHJlbmRlcmVyXG5cdFx0dGhpcy5jb25maWdPYmplY3RVcmwudXBkYXRlKGNvbmZpZ3VyYXRpb24pO1xuXHR9XG5cblx0YXN5bmMgcmVsb2FkKGNsaT86IE5hdGl2ZVBhcnNlZEFyZ3MpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIENvcHkgb3VyIGN1cnJlbnQgY29uZmlnIGZvciByZXVzZVxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLl9jb25maWcpO1xuXG5cdFx0Ly8gVmFsaWRhdGUgd29ya3NwYWNlXG5cdFx0Y29uZmlndXJhdGlvbi53b3Jrc3BhY2UgPSBhd2FpdCB0aGlzLnZhbGlkYXRlV29ya3NwYWNlQmVmb3JlUmVsb2FkKGNvbmZpZ3VyYXRpb24pO1xuXG5cdFx0Ly8gRGVsZXRlIHNvbWUgcHJvcGVydGllcyB3ZSBkbyBub3Qgd2FudCBkdXJpbmcgcmVsb2FkXG5cdFx0ZGVsZXRlIGNvbmZpZ3VyYXRpb24uZmlsZXNUb09wZW5PckNyZWF0ZTtcblx0XHRkZWxldGUgY29uZmlndXJhdGlvbi5maWxlc1RvRGlmZjtcblx0XHRkZWxldGUgY29uZmlndXJhdGlvbi5maWxlc1RvTWVyZ2U7XG5cdFx0ZGVsZXRlIGNvbmZpZ3VyYXRpb24uZmlsZXNUb1dhaXQ7XG5cblx0XHQvLyBTb21lIGNvbmZpZ3VyYXRpb24gdGhpbmdzIGdldCBpbmhlcml0ZWQgaWYgdGhlIHdpbmRvdyBpcyBiZWluZyByZWxvYWRlZCBhbmQgd2UgYXJlXG5cdFx0Ly8gaW4gZXh0ZW5zaW9uIGRldmVsb3BtZW50IG1vZGUuIFRoZXNlIG9wdGlvbnMgYXJlIGFsbCBkZXZlbG9wbWVudCByZWxhdGVkLlxuXHRcdGlmICh0aGlzLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnRIb3N0ICYmIGNsaSkge1xuXHRcdFx0Y29uZmlndXJhdGlvbi52ZXJib3NlID0gY2xpLnZlcmJvc2U7XG5cdFx0XHRjb25maWd1cmF0aW9uLmRlYnVnSWQgPSBjbGkuZGVidWdJZDtcblx0XHRcdGNvbmZpZ3VyYXRpb24uZXh0ZW5zaW9uRW52aXJvbm1lbnQgPSBjbGkuZXh0ZW5zaW9uRW52aXJvbm1lbnQ7XG5cdFx0XHRjb25maWd1cmF0aW9uWydpbnNwZWN0LWV4dGVuc2lvbnMnXSA9IGNsaVsnaW5zcGVjdC1leHRlbnNpb25zJ107XG5cdFx0XHRjb25maWd1cmF0aW9uWydpbnNwZWN0LWJyay1leHRlbnNpb25zJ10gPSBjbGlbJ2luc3BlY3QtYnJrLWV4dGVuc2lvbnMnXTtcblx0XHRcdGNvbmZpZ3VyYXRpb25bJ2V4dGVuc2lvbnMtZGlyJ10gPSBjbGlbJ2V4dGVuc2lvbnMtZGlyJ107XG5cdFx0fVxuXG5cdFx0Y29uZmlndXJhdGlvbi5hY2Nlc3NpYmlsaXR5U3VwcG9ydCA9IGVsZWN0cm9uLmFwcC5pc0FjY2Vzc2liaWxpdHlTdXBwb3J0RW5hYmxlZCgpO1xuXHRcdGNvbmZpZ3VyYXRpb24uaXNJbml0aWFsU3RhcnR1cCA9IGZhbHNlOyAvLyBzaW5jZSB0aGlzIGlzIGEgcmVsb2FkXG5cdFx0Y29uZmlndXJhdGlvbi5wb2xpY2llc0RhdGEgPSB0aGlzLnBvbGljeVNlcnZpY2Uuc2VyaWFsaXplKCk7IC8vIHNldCBwb2xpY2llcyBkYXRhIGFnYWluXG5cdFx0Y29uZmlndXJhdGlvbi5jb250aW51ZU9uID0gdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmNvbnRpbnVlT247XG5cdFx0Y29uZmlndXJhdGlvbi5wcm9maWxlcyA9IHtcblx0XHRcdGFsbDogdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcyxcblx0XHRcdHByb2ZpbGU6IHRoaXMucHJvZmlsZSB8fCB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLFxuXHRcdFx0aG9tZTogdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlc0hvbWVcblx0XHR9O1xuXHRcdGNvbmZpZ3VyYXRpb24ubG9nTGV2ZWwgPSB0aGlzLmxvZ2dlck1haW5TZXJ2aWNlLmdldExvZ0xldmVsKCk7XG5cdFx0Y29uZmlndXJhdGlvbi5sb2dnZXJzID0gdGhpcy5sb2dnZXJNYWluU2VydmljZS5nZXRHbG9iYWxMb2dnZXJzKCk7XG5cblx0XHQvLyBMb2FkIGNvbmZpZ1xuXHRcdHRoaXMubG9hZChjb25maWd1cmF0aW9uLCB7IGlzUmVsb2FkOiB0cnVlLCBkaXNhYmxlRXh0ZW5zaW9uczogY2xpPy5bJ2Rpc2FibGUtZXh0ZW5zaW9ucyddIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVdvcmtzcGFjZUJlZm9yZVJlbG9hZChjb25maWd1cmF0aW9uOiBJTmF0aXZlV2luZG93Q29uZmlndXJhdGlvbik6IFByb21pc2U8SVdvcmtzcGFjZUlkZW50aWZpZXIgfCBJU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllciB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Ly8gTXVsdGkgZm9sZGVyXG5cdFx0aWYgKGlzV29ya3NwYWNlSWRlbnRpZmllcihjb25maWd1cmF0aW9uLndvcmtzcGFjZSkpIHtcblx0XHRcdGNvbnN0IGNvbmZpZ1BhdGggPSBjb25maWd1cmF0aW9uLndvcmtzcGFjZS5jb25maWdQYXRoO1xuXHRcdFx0aWYgKGNvbmZpZ1BhdGguc2NoZW1lID09PSBTY2hlbWFzLmZpbGUpIHtcblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlRXhpc3RzID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHMoY29uZmlnUGF0aCk7XG5cdFx0XHRcdGlmICghd29ya3NwYWNlRXhpc3RzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNpbmdsZSBmb2xkZXJcblx0XHRlbHNlIGlmIChpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIoY29uZmlndXJhdGlvbi53b3Jrc3BhY2UpKSB7XG5cdFx0XHRjb25zdCB1cmkgPSBjb25maWd1cmF0aW9uLndvcmtzcGFjZS51cmk7XG5cdFx0XHRpZiAodXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdGNvbnN0IGZvbGRlckV4aXN0cyA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKHVyaSk7XG5cdFx0XHRcdGlmICghZm9sZGVyRXhpc3RzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFdvcmtzcGFjZSBpcyB2YWxpZFxuXHRcdHJldHVybiBjb25maWd1cmF0aW9uLndvcmtzcGFjZTtcblx0fVxuXG5cdHNlcmlhbGl6ZVdpbmRvd1N0YXRlKCk6IElXaW5kb3dTdGF0ZSB7XG5cdFx0aWYgKCF0aGlzLl93aW4pIHtcblx0XHRcdHJldHVybiBkZWZhdWx0V2luZG93U3RhdGUoKTtcblx0XHR9XG5cblx0XHQvLyBmdWxsc2NyZWVuIGdldHMgc3BlY2lhbCB0cmVhdG1lbnRcblx0XHRpZiAodGhpcy5pc0Z1bGxTY3JlZW4pIHtcblx0XHRcdGxldCBkaXNwbGF5OiBlbGVjdHJvbi5EaXNwbGF5IHwgdW5kZWZpbmVkO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0ZGlzcGxheSA9IGVsZWN0cm9uLnNjcmVlbi5nZXREaXNwbGF5TWF0Y2hpbmcodGhpcy5nZXRCb3VuZHMoKSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHQvLyBFbGVjdHJvbiBoYXMgd2VpcmQgY29uZGl0aW9ucyB1bmRlciB3aGljaCBpdCB0aHJvd3MgZXJyb3JzXG5cdFx0XHRcdC8vIGUuZy4gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwMDMzNCB3aGVuXG5cdFx0XHRcdC8vIGxhcmdlIG51bWJlcnMgYXJlIHBhc3NlZCBpblxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkZWZhdWx0U3RhdGUgPSBkZWZhdWx0V2luZG93U3RhdGUoKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bW9kZTogV2luZG93TW9kZS5GdWxsc2NyZWVuLFxuXHRcdFx0XHRkaXNwbGF5OiBkaXNwbGF5ID8gZGlzcGxheS5pZCA6IHVuZGVmaW5lZCxcblxuXHRcdFx0XHQvLyBTdGlsbCBjYXJyeSBvdmVyIHdpbmRvdyBkaW1lbnNpb25zIGZyb20gcHJldmlvdXMgc2Vzc2lvbnNcblx0XHRcdFx0Ly8gaWYgd2UgY2FuIGNvbXB1dGUgaXQgaW4gZnVsbHNjcmVlbiBzdGF0ZS5cblx0XHRcdFx0Ly8gZG9lcyBub3Qgc2VlbSBwb3NzaWJsZSBpbiBhbGwgY2FzZXMgb24gTGludXggZm9yIGV4YW1wbGVcblx0XHRcdFx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy81ODIxOCkgc28gd2Vcblx0XHRcdFx0Ly8gZmFsbGJhY2sgdG8gdGhlIGRlZmF1bHRzIGluIHRoYXQgY2FzZS5cblx0XHRcdFx0d2lkdGg6IHRoaXMud2luZG93U3RhdGUud2lkdGggfHwgZGVmYXVsdFN0YXRlLndpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IHRoaXMud2luZG93U3RhdGUuaGVpZ2h0IHx8IGRlZmF1bHRTdGF0ZS5oZWlnaHQsXG5cdFx0XHRcdHg6IHRoaXMud2luZG93U3RhdGUueCB8fCAwLFxuXHRcdFx0XHR5OiB0aGlzLndpbmRvd1N0YXRlLnkgfHwgMCxcblx0XHRcdFx0em9vbUxldmVsOiB0aGlzLmN1c3RvbVpvb21MZXZlbFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGF0ZTogSVdpbmRvd1N0YXRlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRsZXQgbW9kZTogV2luZG93TW9kZTtcblxuXHRcdC8vIGdldCB3aW5kb3cgbW9kZVxuXHRcdGlmICghaXNNYWNpbnRvc2ggJiYgdGhpcy5fd2luLmlzTWF4aW1pemVkKCkpIHtcblx0XHRcdG1vZGUgPSBXaW5kb3dNb2RlLk1heGltaXplZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bW9kZSA9IFdpbmRvd01vZGUuTm9ybWFsO1xuXHRcdH1cblxuXHRcdC8vIHdlIGRvbid0IHdhbnQgdG8gc2F2ZSBtaW5pbWl6ZWQgc3RhdGUsIG9ubHkgbWF4aW1pemVkIG9yIG5vcm1hbFxuXHRcdGlmIChtb2RlID09PSBXaW5kb3dNb2RlLk1heGltaXplZCkge1xuXHRcdFx0c3RhdGUubW9kZSA9IFdpbmRvd01vZGUuTWF4aW1pemVkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdGF0ZS5tb2RlID0gV2luZG93TW9kZS5Ob3JtYWw7XG5cdFx0fVxuXG5cdFx0Ly8gb25seSBjb25zaWRlciBub24tbWluaW1pemVkIHdpbmRvdyBzdGF0ZXNcblx0XHRpZiAobW9kZSA9PT0gV2luZG93TW9kZS5Ob3JtYWwgfHwgbW9kZSA9PT0gV2luZG93TW9kZS5NYXhpbWl6ZWQpIHtcblx0XHRcdGxldCBib3VuZHM6IGVsZWN0cm9uLlJlY3RhbmdsZTtcblx0XHRcdGlmIChtb2RlID09PSBXaW5kb3dNb2RlLk5vcm1hbCkge1xuXHRcdFx0XHRib3VuZHMgPSB0aGlzLmdldEJvdW5kcygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ym91bmRzID0gdGhpcy5fd2luLmdldE5vcm1hbEJvdW5kcygpOyAvLyBtYWtlIHN1cmUgdG8gcGVyc2lzdCB0aGUgbm9ybWFsIGJvdW5kcyB3aGVuIG1heGltaXplZCB0byBiZSBhYmxlIHRvIHJlc3RvcmUgdGhlbVxuXHRcdFx0fVxuXG5cdFx0XHRzdGF0ZS54ID0gYm91bmRzLng7XG5cdFx0XHRzdGF0ZS55ID0gYm91bmRzLnk7XG5cdFx0XHRzdGF0ZS53aWR0aCA9IGJvdW5kcy53aWR0aDtcblx0XHRcdHN0YXRlLmhlaWdodCA9IGJvdW5kcy5oZWlnaHQ7XG5cdFx0fVxuXG5cdFx0c3RhdGUuem9vbUxldmVsID0gdGhpcy5jdXN0b21ab29tTGV2ZWw7XG5cblx0XHRyZXR1cm4gc3RhdGU7XG5cdH1cblxuXHRwcml2YXRlIHJlc3RvcmVXaW5kb3dTdGF0ZShzdGF0ZT86IElXaW5kb3dTdGF0ZSk6IFtJV2luZG93U3RhdGUsIGJvb2xlYW4/IC8qIGhhcyBtdWx0aXBsZSBkaXNwbGF5cyAqL10ge1xuXHRcdG1hcmsoJ2NvZGUvd2lsbFJlc3RvcmVDb2RlV2luZG93U3RhdGUnKTtcblxuXHRcdGxldCBoYXNNdWx0aXBsZURpc3BsYXlzID0gZmFsc2U7XG5cdFx0aWYgKHN0YXRlKSB7XG5cblx0XHRcdC8vIFdpbmRvdyB6b29tXG5cdFx0XHR0aGlzLmN1c3RvbVpvb21MZXZlbCA9IHN0YXRlLnpvb21MZXZlbDtcblxuXHRcdFx0Ly8gV2luZG93IGRpbWVuc2lvbnNcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGRpc3BsYXlzID0gZWxlY3Ryb24uc2NyZWVuLmdldEFsbERpc3BsYXlzKCk7XG5cdFx0XHRcdGhhc011bHRpcGxlRGlzcGxheXMgPSBkaXNwbGF5cy5sZW5ndGggPiAxO1xuXG5cdFx0XHRcdHN0YXRlID0gV2luZG93U3RhdGVWYWxpZGF0b3IudmFsaWRhdGVXaW5kb3dTdGF0ZSh0aGlzLmxvZ1NlcnZpY2UsIHN0YXRlLCBkaXNwbGF5cyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oYFVuZXhwZWN0ZWQgZXJyb3IgdmFsaWRhdGluZyB3aW5kb3cgc3RhdGU6ICR7ZXJyfVxcbiR7ZXJyLnN0YWNrfWApOyAvLyBzb21laG93IGRpc3BsYXkgQVBJIGNhbiBiZSBwaWNreSBhYm91dCB0aGUgc3RhdGUgdG8gdmFsaWRhdGVcblx0XHRcdH1cblx0XHR9XG5cblx0XHRtYXJrKCdjb2RlL2RpZFJlc3RvcmVDb2RlV2luZG93U3RhdGUnKTtcblxuXHRcdHJldHVybiBbc3RhdGUgfHwgZGVmYXVsdFdpbmRvd1N0YXRlKCksIGhhc011bHRpcGxlRGlzcGxheXNdO1xuXHR9XG5cblx0Z2V0Qm91bmRzKCk6IGVsZWN0cm9uLlJlY3RhbmdsZSB7XG5cdFx0Y29uc3QgW3gsIHldID0gdGhpcy5fd2luLmdldFBvc2l0aW9uKCk7XG5cdFx0Y29uc3QgW3dpZHRoLCBoZWlnaHRdID0gdGhpcy5fd2luLmdldFNpemUoKTtcblxuXHRcdHJldHVybiB7IHgsIHksIHdpZHRoLCBoZWlnaHQgfTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBzZXRGdWxsU2NyZWVuKGZ1bGxzY3JlZW46IGJvb2xlYW4sIGZyb21SZXN0b3JlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0c3VwZXIuc2V0RnVsbFNjcmVlbihmdWxsc2NyZWVuLCBmcm9tUmVzdG9yZSk7XG5cblx0XHQvLyBFdmVudHNcblx0XHR0aGlzLnNlbmRXaGVuUmVhZHkoZnVsbHNjcmVlbiA/ICd2c2NvZGU6ZW50ZXJGdWxsU2NyZWVuJyA6ICd2c2NvZGU6bGVhdmVGdWxsU2NyZWVuJywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHQvLyBSZXNwZWN0IGNvbmZpZ3VyZWQgbWVudSBiYXIgdmlzaWJpbGl0eSBvciBkZWZhdWx0IHRvIHRvZ2dsZSBpZiBub3Qgc2V0XG5cdFx0aWYgKHRoaXMuY3VycmVudE1lbnVCYXJWaXNpYmlsaXR5KSB7XG5cdFx0XHR0aGlzLnNldE1lbnVCYXJWaXNpYmlsaXR5KHRoaXMuY3VycmVudE1lbnVCYXJWaXNpYmlsaXR5LCBmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRNZW51QmFyVmlzaWJpbGl0eSgpOiBNZW51QmFyVmlzaWJpbGl0eSB7XG5cdFx0bGV0IG1lbnVCYXJWaXNpYmlsaXR5ID0gZ2V0TWVudUJhclZpc2liaWxpdHkodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0aWYgKFsndmlzaWJsZScsICd0b2dnbGUnLCAnaGlkZGVuJ10uaW5kZXhPZihtZW51QmFyVmlzaWJpbGl0eSkgPCAwKSB7XG5cdFx0XHRtZW51QmFyVmlzaWJpbGl0eSA9ICdjbGFzc2ljJztcblx0XHR9XG5cblx0XHRyZXR1cm4gbWVudUJhclZpc2liaWxpdHk7XG5cdH1cblxuXHRwcml2YXRlIHNldE1lbnVCYXJWaXNpYmlsaXR5KHZpc2liaWxpdHk6IE1lbnVCYXJWaXNpYmlsaXR5LCBub3RpZnk6IGJvb2xlYW4gPSB0cnVlKTogdm9pZCB7XG5cdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRyZXR1cm47IC8vIGlnbm9yZSBmb3IgbWFjT1MgcGxhdGZvcm1cblx0XHR9XG5cblx0XHRpZiAodmlzaWJpbGl0eSA9PT0gJ3RvZ2dsZScpIHtcblx0XHRcdGlmIChub3RpZnkpIHtcblx0XHRcdFx0dGhpcy5zZW5kKCd2c2NvZGU6c2hvd0luZm9NZXNzYWdlJywgbG9jYWxpemUoJ2hpZGRlbk1lbnVCYXInLCBcIllvdSBjYW4gc3RpbGwgYWNjZXNzIHRoZSBtZW51IGJhciBieSBwcmVzc2luZyB0aGUgQWx0LWtleS5cIikpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh2aXNpYmlsaXR5ID09PSAnaGlkZGVuJykge1xuXHRcdFx0Ly8gZm9yIHNvbWUgd2VpcmQgcmVhc29uIHRoYXQgSSBoYXZlIG5vIGV4cGxhbmF0aW9uIGZvciwgdGhlIG1lbnUgYmFyIGlzIG5vdCBoaWRpbmcgd2hlbiBjYWxsaW5nXG5cdFx0XHQvLyB0aGlzIHdpdGhvdXQgdGltZW91dCAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xOTc3NykuIHRoZXJlIHNlZW1zIHRvIGJlXG5cdFx0XHQvLyBhIHRpbWluZyBpc3N1ZSB3aXRoIHVzIG9wZW5pbmcgdGhlIGZpcnN0IHdpbmRvdyBhbmQgdGhlIG1lbnUgYmFyIGdldHRpbmcgY3JlYXRlZC4gc29tZWhvdyB0aGVcblx0XHRcdC8vIGZhY3QgdGhhdCB3ZSB3YW50IHRvIGhpZGUgdGhlIG1lbnUgd2l0aG91dCBiZWluZyBhYmxlIHRvIGJyaW5nIGl0IGJhY2sgdmlhIEFsdCBrZXkgbWFrZXMgRWxlY3Ryb25cblx0XHRcdC8vIHN0aWxsIHNob3cgdGhlIG1lbnUuIFVuYWJsZSB0byByZXByb2R1Y2UgZnJvbSBhIHNpbXBsZSBIZWxsbyBXb3JsZCBhcHBsaWNhdGlvbiB0aG91Z2guLi5cblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRvU2V0TWVudUJhclZpc2liaWxpdHkodmlzaWJpbGl0eSk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kb1NldE1lbnVCYXJWaXNpYmlsaXR5KHZpc2liaWxpdHkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9TZXRNZW51QmFyVmlzaWJpbGl0eSh2aXNpYmlsaXR5OiBNZW51QmFyVmlzaWJpbGl0eSk6IHZvaWQge1xuXHRcdGNvbnN0IGlzRnVsbHNjcmVlbiA9IHRoaXMuaXNGdWxsU2NyZWVuO1xuXG5cdFx0c3dpdGNoICh2aXNpYmlsaXR5KSB7XG5cdFx0XHRjYXNlICgnY2xhc3NpYycpOlxuXHRcdFx0XHR0aGlzLl93aW4uc2V0TWVudUJhclZpc2liaWxpdHkoIWlzRnVsbHNjcmVlbik7XG5cdFx0XHRcdHRoaXMuX3dpbi5hdXRvSGlkZU1lbnVCYXIgPSBpc0Z1bGxzY3JlZW47XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICgndmlzaWJsZScpOlxuXHRcdFx0XHR0aGlzLl93aW4uc2V0TWVudUJhclZpc2liaWxpdHkodHJ1ZSk7XG5cdFx0XHRcdHRoaXMuX3dpbi5hdXRvSGlkZU1lbnVCYXIgPSBmYWxzZTtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgKCd0b2dnbGUnKTpcblx0XHRcdFx0dGhpcy5fd2luLnNldE1lbnVCYXJWaXNpYmlsaXR5KGZhbHNlKTtcblx0XHRcdFx0dGhpcy5fd2luLmF1dG9IaWRlTWVudUJhciA9IHRydWU7XG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICgnaGlkZGVuJyk6XG5cdFx0XHRcdHRoaXMuX3dpbi5zZXRNZW51QmFyVmlzaWJpbGl0eShmYWxzZSk7XG5cdFx0XHRcdHRoaXMuX3dpbi5hdXRvSGlkZU1lbnVCYXIgPSBmYWxzZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0bm90aWZ5Wm9vbUxldmVsKHpvb21MZXZlbDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5jdXN0b21ab29tTGV2ZWwgPSB6b29tTGV2ZWw7XG5cdH1cblxuXHRwcml2YXRlIGdldFpvb21MZXZlbCgpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5jdXN0b21ab29tTGV2ZWwgPT09ICdudW1iZXInKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jdXN0b21ab29tTGV2ZWw7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2luZG93U2V0dGluZ3MgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElXaW5kb3dTZXR0aW5ncyB8IHVuZGVmaW5lZD4oJ3dpbmRvdycpO1xuXHRcdHJldHVybiB3aW5kb3dTZXR0aW5ncz8uem9vbUxldmVsO1xuXHR9XG5cblx0Y2xvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fd2luPy5jbG9zZSgpO1xuXHR9XG5cblx0c2VuZFdoZW5SZWFkeShjaGFubmVsOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pc1JlYWR5KSB7XG5cdFx0XHR0aGlzLnNlbmQoY2hhbm5lbCwgLi4uYXJncyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVhZHkoKS50aGVuKCgpID0+IHtcblx0XHRcdFx0aWYgKCF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHRoaXMuc2VuZChjaGFubmVsLCAuLi5hcmdzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0c2VuZChjaGFubmVsOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3dpbikge1xuXHRcdFx0aWYgKHRoaXMuX3dpbi5pc0Rlc3Ryb3llZCgpIHx8IHRoaXMuX3dpbi53ZWJDb250ZW50cy5pc0Rlc3Ryb3llZCgpKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBTZW5kaW5nIElQQyBtZXNzYWdlIHRvIGNoYW5uZWwgJyR7Y2hhbm5lbH0nIGZvciB3aW5kb3cgdGhhdCBpcyBkZXN0cm95ZWRgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLl93aW4ud2ViQ29udGVudHMuc2VuZChjaGFubmVsLCAuLi5hcmdzKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBFcnJvciBzZW5kaW5nIElQQyBtZXNzYWdlIHRvIGNoYW5uZWwgJyR7Y2hhbm5lbH0nIG9mIHdpbmRvdyAke3RoaXMuX2lkfTogJHt0b0Vycm9yTWVzc2FnZShlcnJvcil9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlVG91Y2hCYXIoZ3JvdXBzOiBJU2VyaWFsaXphYmxlQ29tbWFuZEFjdGlvbltdW10pOiB2b2lkIHtcblx0XHRpZiAoIWlzTWFjaW50b3NoKSB7XG5cdFx0XHRyZXR1cm47IC8vIG9ubHkgc3VwcG9ydGVkIG9uIG1hY09TXG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHNlZ21lbnRzIGZvciBhbGwgZ3JvdXBzLiBTZXR0aW5nIHRoZSBzZWdtZW50cyBwcm9wZXJ0eVxuXHRcdC8vIG9mIHRoZSBncm91cCBkaXJlY3RseSBwcmV2ZW50cyB1Z2x5IGZsaWNrZXJpbmcgZnJvbSBoYXBwZW5pbmdcblx0XHR0aGlzLnRvdWNoQmFyR3JvdXBzLmZvckVhY2goKHRvdWNoQmFyR3JvdXAsIGluZGV4KSA9PiB7XG5cdFx0XHRjb25zdCBjb21tYW5kcyA9IGdyb3Vwc1tpbmRleF07XG5cdFx0XHR0b3VjaEJhckdyb3VwLnNlZ21lbnRzID0gdGhpcy5jcmVhdGVUb3VjaEJhckdyb3VwU2VnbWVudHMoY29tbWFuZHMpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUb3VjaEJhcigpOiB2b2lkIHtcblx0XHRpZiAoIWlzTWFjaW50b3NoKSB7XG5cdFx0XHRyZXR1cm47IC8vIG9ubHkgc3VwcG9ydGVkIG9uIG1hY09TXG5cdFx0fVxuXG5cdFx0Ly8gVG8gYXZvaWQgZmxpY2tlcmluZywgd2UgdHJ5IHRvIHJldXNlIHRoZSB0b3VjaCBiYXIgZ3JvdXBcblx0XHQvLyBhcyBtdWNoIGFzIHBvc3NpYmxlIGJ5IGNyZWF0aW5nIGEgbGFyZ2UgbnVtYmVyIG9mIGdyb3Vwc1xuXHRcdC8vIGZvciByZXVzaW5nIGxhdGVyLlxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgMTA7IGkrKykge1xuXHRcdFx0Y29uc3QgZ3JvdXBUb3VjaEJhciA9IHRoaXMuY3JlYXRlVG91Y2hCYXJHcm91cCgpO1xuXHRcdFx0dGhpcy50b3VjaEJhckdyb3Vwcy5wdXNoKGdyb3VwVG91Y2hCYXIpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3dpbi5zZXRUb3VjaEJhcihuZXcgZWxlY3Ryb24uVG91Y2hCYXIoeyBpdGVtczogdGhpcy50b3VjaEJhckdyb3VwcyB9KSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVRvdWNoQmFyR3JvdXAoaXRlbXM6IElTZXJpYWxpemFibGVDb21tYW5kQWN0aW9uW10gPSBbXSk6IGVsZWN0cm9uLlRvdWNoQmFyU2VnbWVudGVkQ29udHJvbCB7XG5cblx0XHQvLyBHcm91cCBTZWdtZW50c1xuXHRcdGNvbnN0IHNlZ21lbnRzID0gdGhpcy5jcmVhdGVUb3VjaEJhckdyb3VwU2VnbWVudHMoaXRlbXMpO1xuXG5cdFx0Ly8gR3JvdXAgQ29udHJvbFxuXHRcdGNvbnN0IGNvbnRyb2wgPSBuZXcgZWxlY3Ryb24uVG91Y2hCYXIuVG91Y2hCYXJTZWdtZW50ZWRDb250cm9sKHtcblx0XHRcdHNlZ21lbnRzLFxuXHRcdFx0bW9kZTogJ2J1dHRvbnMnLFxuXHRcdFx0c2VnbWVudFN0eWxlOiAnYXV0b21hdGljJyxcblx0XHRcdGNoYW5nZTogKHNlbGVjdGVkSW5kZXgpID0+IHtcblx0XHRcdFx0dGhpcy5zZW5kV2hlblJlYWR5KCd2c2NvZGU6cnVuQWN0aW9uJywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSwgeyBpZDogKGNvbnRyb2wuc2VnbWVudHNbc2VsZWN0ZWRJbmRleF0gYXMgSVRvdWNoQmFyU2VnbWVudCkuaWQsIGZyb206ICd0b3VjaGJhcicgfSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gY29udHJvbDtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVG91Y2hCYXJHcm91cFNlZ21lbnRzKGl0ZW1zOiBJU2VyaWFsaXphYmxlQ29tbWFuZEFjdGlvbltdID0gW10pOiBJVG91Y2hCYXJTZWdtZW50W10ge1xuXHRcdGNvbnN0IHNlZ21lbnRzOiBJVG91Y2hCYXJTZWdtZW50W10gPSBpdGVtcy5tYXAoaXRlbSA9PiB7XG5cdFx0XHRsZXQgaWNvbjogZWxlY3Ryb24uTmF0aXZlSW1hZ2UgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoaXRlbS5pY29uICYmICFUaGVtZUljb24uaXNUaGVtZUljb24oaXRlbS5pY29uKSAmJiBpdGVtLmljb24/LmRhcms/LnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdGljb24gPSBlbGVjdHJvbi5uYXRpdmVJbWFnZS5jcmVhdGVGcm9tUGF0aChVUkkucmV2aXZlKGl0ZW0uaWNvbi5kYXJrKS5mc1BhdGgpO1xuXHRcdFx0XHRpZiAoaWNvbi5pc0VtcHR5KCkpIHtcblx0XHRcdFx0XHRpY29uID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGxldCB0aXRsZTogc3RyaW5nO1xuXHRcdFx0aWYgKHR5cGVvZiBpdGVtLnRpdGxlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHR0aXRsZSA9IGl0ZW0udGl0bGU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aXRsZSA9IGl0ZW0udGl0bGUudmFsdWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGlkOiBpdGVtLmlkLFxuXHRcdFx0XHRsYWJlbDogIWljb24gPyB0aXRsZSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0aWNvblxuXHRcdFx0fTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBzZWdtZW50cztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3RhcnRDb2xsZWN0aW5nSlNjYWxsU3RhY2tzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5qc0NhbGxTdGFja0NvbGxlY3Rvci5pc1RyaWdnZXJlZCgpKSB7XG5cdFx0XHRjb25zdCBzdGFjayA9IGF3YWl0IHRoaXMuX3dpbi53ZWJDb250ZW50cy5tYWluRnJhbWUuY29sbGVjdEphdmFTY3JpcHRDYWxsU3RhY2soKTtcblxuXHRcdFx0Ly8gSW5jcmVtZW50IHRoZSBjb3VudCBmb3IgdGhpcyBzdGFjayB0cmFjZVxuXHRcdFx0aWYgKHN0YWNrKSB7XG5cdFx0XHRcdGNvbnN0IGNvdW50ID0gdGhpcy5qc0NhbGxTdGFja01hcC5nZXQoc3RhY2spIHx8IDA7XG5cdFx0XHRcdHRoaXMuanNDYWxsU3RhY2tNYXAuc2V0KHN0YWNrLCBjb3VudCArIDEpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmpzQ2FsbFN0YWNrQ29sbGVjdG9yLnRyaWdnZXIoKCkgPT4gdGhpcy5zdGFydENvbGxlY3RpbmdKU2NhbGxTdGFja3MoKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdG9wQ29sbGVjdGluZ0pTY2FsbFN0YWNrcygpOiB2b2lkIHtcblx0XHR0aGlzLmpzQ2FsbFN0YWNrQ29sbGVjdG9yU3RvcFNjaGVkdWxlci5jYW5jZWwoKTtcblx0XHR0aGlzLmpzQ2FsbFN0YWNrQ29sbGVjdG9yLmNhbmNlbCgpO1xuXG5cdFx0aWYgKHRoaXMuanNDYWxsU3RhY2tNYXAuc2l6ZSkge1xuXHRcdFx0bGV0IGxvZ01lc3NhZ2UgPSBgQ29kZVdpbmRvdyB1bnJlc3BvbnNpdmUgc2FtcGxlczpcXG5gO1xuXHRcdFx0bGV0IHNhbXBsZXMgPSAwO1xuXG5cdFx0XHRjb25zdCBzb3J0ZWRFbnRyaWVzID0gQXJyYXkuZnJvbSh0aGlzLmpzQ2FsbFN0YWNrTWFwLmVudHJpZXMoKSlcblx0XHRcdFx0LnNvcnQoKGEsIGIpID0+IGJbMV0gLSBhWzFdKTtcblxuXHRcdFx0Zm9yIChjb25zdCBbc3RhY2ssIGNvdW50XSBvZiBzb3J0ZWRFbnRyaWVzKSB7XG5cdFx0XHRcdHNhbXBsZXMgKz0gY291bnQ7XG5cdFx0XHRcdC8vIElmIHRoZSBzdGFjayBhcHBlYXJzIG1vcmUgdGhhbiAyMCBwZXJjZW50IG9mIHRoZSB0aW1lLCBsb2cgaXRcblx0XHRcdFx0Ly8gdG8gdGhlIGVycm9yIHRlbGVtZXRyeSBhcyBVbnJlc3BvbnNpdmVTYW1wbGVFcnJvci5cblx0XHRcdFx0aWYgKE1hdGgucm91bmQoKGNvdW50ICogMTAwKSAvIHRoaXMuanNDYWxsU3RhY2tFZmZlY3RpdmVTYW1wbGVDb3VudCkgPiAyMCkge1xuXHRcdFx0XHRcdGNvbnN0IGZha2VFcnJvciA9IG5ldyBVbnJlc3BvbnNpdmVFcnJvcihzdGFjaywgdGhpcy5pZCwgdGhpcy53aW4/LndlYkNvbnRlbnRzLmdldE9TUHJvY2Vzc0lkKCkpO1xuXHRcdFx0XHRcdGVycm9ySGFuZGxlci5vblVuZXhwZWN0ZWRFcnJvcihmYWtlRXJyb3IpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxvZ01lc3NhZ2UgKz0gYDwke2NvdW50fT4gJHtzdGFja31cXG5gO1xuXHRcdFx0fVxuXG5cdFx0XHRsb2dNZXNzYWdlICs9IGBUb3RhbCBTYW1wbGVzOiAke3NhbXBsZXN9XFxuYDtcblx0XHRcdGxvZ01lc3NhZ2UgKz0gJ0ZvciBmdWxsIG92ZXJ2aWV3IG9mIHRoZSB1bnJlc3BvbnNpdmUgcGVyaW9kLCBjYXB0dXJlIGNwdSBwcm9maWxlIHZpYSBodHRwczovL2FrYS5tcy92c2NvZGUtdHJhY2luZy1jcHUtcHJvZmlsZSc7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IobG9nTWVzc2FnZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5qc0NhbGxTdGFja01hcC5jbGVhcigpO1xuXHR9XG5cblx0bWF0Y2hlcyh3ZWJDb250ZW50czogZWxlY3Ryb24uV2ViQ29udGVudHMpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fd2luPy53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQ7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdC8vIERlcmVnaXN0ZXIgdGhlIGxvZ2dlcnMgZm9yIHRoaXMgd2luZG93XG5cdFx0dGhpcy5sb2dnZXJNYWluU2VydmljZS5kZXJlZ2lzdGVyTG9nZ2Vycyh0aGlzLmlkKTtcblx0fVxufVxuXG5jbGFzcyBVbnJlc3BvbnNpdmVFcnJvciBleHRlbmRzIEVycm9yIHtcblxuXHRjb25zdHJ1Y3RvcihzYW1wbGU6IHN0cmluZywgd2luZG93SWQ6IG51bWJlciwgcGlkOiBudW1iZXIgPSAwKSB7XG5cdFx0Ly8gU2luY2UgdGhlIHN0YWNrcyBhcmUgYXZhaWxhYmxlIHZpYSB0aGUgc2FtcGxlXG5cdFx0Ly8gd2UgY2FuIGF2b2lkIGNvbGxlY3RpbmcgdGhlbSB3aGVuIGNvbnN0cnVjdGluZyB0aGUgZXJyb3IuXG5cdFx0Y29uc3Qgc3RhY2tUcmFjZUxpbWl0ID0gRXJyb3Iuc3RhY2tUcmFjZUxpbWl0O1xuXHRcdEVycm9yLnN0YWNrVHJhY2VMaW1pdCA9IDA7XG5cdFx0c3VwZXIoYFVucmVzcG9uc2l2ZVNhbXBsZUVycm9yOiBmcm9tIHdpbmRvdyB3aXRoIElEICR7d2luZG93SWR9IGJlbG9uZ2luZyB0byBwcm9jZXNzIHdpdGggcGlkICR7cGlkfWApO1xuXHRcdEVycm9yLnN0YWNrVHJhY2VMaW1pdCA9IHN0YWNrVHJhY2VMaW1pdDtcblx0XHR0aGlzLm5hbWUgPSAnVW5yZXNwb25zaXZlU2FtcGxlRXJyb3InO1xuXHRcdHRoaXMuc3RhY2sgPSBzYW1wbGU7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTyxjQUFtRDtBQUMxRCxTQUFTLGlCQUFpQixrQkFBa0IsU0FBUyxlQUFlO0FBQ3BFLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsWUFBWSxlQUFlO0FBQ3BDLFNBQVMsVUFBVSxZQUFZO0FBQy9CLFNBQVMsaUJBQWlCLGFBQWEsaUJBQWlCO0FBQ3hELFNBQVMsV0FBVztBQUNwQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWU7QUFFeEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBb0MsNkJBQTZCO0FBQ2pFLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQXdCLDRCQUE0QjtBQUNwRCxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGdDQUFnQywyQkFBMkI7QUFDcEUsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxzQkFBdUgsbUJBQW1CLHFCQUFxQiwwQkFBMEIsZ0NBQWdDLHFCQUFxQjtBQUN2UCxTQUFTLDZCQUE2QixpQ0FB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S0FBSyxlQUFlLE1BQU07QUFDN0IsVUFBSSxhQUFhO0FBQUE7QUFDakIsVUFBSSxVQUFVO0FBRWQsWUFBTSxnQkFBZ0IsTUFBTSxLQUFLLEtBQUssZUFBZSxRQUFRLENBQUMsRUFDNUQsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUU1QixpQkFBVyxDQUFDLE9BQU8sS0FBSyxLQUFLLGVBQWU7QUFDM0MsbUJBQVc7QUFHWCxZQUFJLEtBQUssTUFBTyxRQUFRLE1BQU8sS0FBSywrQkFBK0IsSUFBSSxJQUFJO0FBQzFFLGdCQUFNLFlBQVksSUFBSSxrQkFBa0IsT0FBTyxLQUFLLElBQUksS0FBSyxLQUFLLFlBQVksZUFBZSxDQUFDO0FBQzlGLHVCQUFhLGtCQUFrQixTQUFTO0FBQUEsUUFDekM7QUFDQSxzQkFBYyxJQUFJLEtBQUssS0FBSyxLQUFLO0FBQUE7QUFBQSxNQUNsQztBQUVBLG9CQUFjLGtCQUFrQixPQUFPO0FBQUE7QUFDdkMsb0JBQWM7QUFDZCxXQUFLLFdBQVcsTUFBTSxVQUFVO0FBQUEsSUFDakM7QUFFQSxTQUFLLGVBQWUsTUFBTTtBQUFBLEVBQzNCO0FBQUEsRUFFQSxRQUFRLGFBQTRDO0FBQ25ELFdBQU8sS0FBSyxNQUFNLFlBQVksT0FBTyxZQUFZO0FBQUEsRUFDbEQ7QUFBQSxFQUVTLFVBQWdCO0FBQ3hCLFVBQU0sUUFBUTtBQUdkLFNBQUssa0JBQWtCLGtCQUFrQixLQUFLLEVBQUU7QUFBQSxFQUNqRDtBQUNEO0FBampDYSxhQUFOO0FBQUEsRUE0RUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0EvRlU7QUFtakNiLE1BQU0sMEJBQTBCLE1BQU07QUFBQSxFQUVyQyxZQUFZLFFBQWdCLFVBQWtCLE1BQWMsR0FBRztBQUc5RCxVQUFNLGtCQUFrQixNQUFNO0FBQzlCLFVBQU0sa0JBQWtCO0FBQ3hCLFVBQU0sZ0RBQWdELFFBQVEsa0NBQWtDLEdBQUcsRUFBRTtBQUNyRyxVQUFNLGtCQUFrQjtBQUN4QixTQUFLLE9BQU87QUFDWixTQUFLLFFBQVE7QUFBQSxFQUNkO0FBQ0Q7IiwKICAibmFtZXMiOiBbIlJlYWR5U3RhdGUiLCAicHJvZmlsZSJdCn0K
