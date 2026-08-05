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
import { app, BrowserWindow, clipboard, Menu, powerMonitor, screen, shell, webContents } from "electron";
import { arch, cpus, freemem, loadavg, platform, release, totalmem, type } from "os";
import { promisify } from "util";
import { memoize } from "../../../base/common/decorators.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { matchesSomeScheme, Schemas } from "../../../base/common/network.js";
import { dirname, join, posix, resolve, win32 } from "../../../base/common/path.js";
import { isLinux, isMacintosh, isWindows } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import { realpath } from "../../../base/node/extpath.js";
import { virtualMachineHint } from "../../../base/node/id.js";
import { Promises, SymlinkSupport } from "../../../base/node/pfs.js";
import { findFreePort } from "../../../base/node/ports.js";
import { localize } from "../../../nls.js";
import { IDialogMainService } from "../../dialogs/electron-main/dialogMainService.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { IThemeMainService } from "../../theme/electron-main/themeMainService.js";
import { defaultWindowState } from "../../window/electron-main/window.js";
import { defaultBrowserWindowOptions, IWindowsMainService, OpenContext } from "../../windows/electron-main/windows.js";
import { isWorkspaceIdentifier, toWorkspaceIdentifier } from "../../workspace/common/workspace.js";
import { IWorkspacesManagementMainService } from "../../workspaces/electron-main/workspacesManagementMainService.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { hasWSLFeatureInstalled } from "../../remote/node/wsl.js";
import { WindowProfiler } from "../../profiling/electron-main/windowProfiling.js";
import { IAuxiliaryWindowsMainService } from "../../auxiliaryWindow/electron-main/auxiliaryWindows.js";
import { CancellationError } from "../../../base/common/errors.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IProxyAuthService } from "./auth.js";
import { IRequestService } from "../../request/common/request.js";
import { randomPath } from "../../../base/common/extpath.js";
const INativeHostMainService = createDecorator("nativeHostMainService");
let NativeHostMainService = class extends Disposable {
  constructor(windowsMainService, auxiliaryWindowsMainService, dialogMainService, lifecycleMainService, environmentMainService, logService, productService, themeMainService, workspacesManagementMainService, configurationService, requestService, proxyAuthService, instantiationService) {
    super();
    this.windowsMainService = windowsMainService;
    this.auxiliaryWindowsMainService = auxiliaryWindowsMainService;
    this.dialogMainService = dialogMainService;
    this.lifecycleMainService = lifecycleMainService;
    this.environmentMainService = environmentMainService;
    this.logService = logService;
    this.productService = productService;
    this.themeMainService = themeMainService;
    this.workspacesManagementMainService = workspacesManagementMainService;
    this.configurationService = configurationService;
    this.requestService = requestService;
    this.proxyAuthService = proxyAuthService;
    this.instantiationService = instantiationService;
    this._onDidChangePassword = this._register(new Emitter());
    this.onDidChangePassword = this._onDidChangePassword.event;
    {
      this.onDidOpenMainWindow = Event.map(this.windowsMainService.onDidOpenWindow, (window) => window.id);
      this.onDidTriggerWindowSystemContextMenu = Event.any(
        Event.map(this.windowsMainService.onDidTriggerSystemContextMenu, ({ window, x, y }) => ({ windowId: window.id, x, y })),
        Event.map(this.auxiliaryWindowsMainService.onDidTriggerSystemContextMenu, ({ window, x, y }) => ({ windowId: window.id, x, y }))
      );
      this.onDidMaximizeWindow = Event.any(
        Event.map(this.windowsMainService.onDidMaximizeWindow, (window) => window.id),
        Event.map(this.auxiliaryWindowsMainService.onDidMaximizeWindow, (window) => window.id)
      );
      this.onDidUnmaximizeWindow = Event.any(
        Event.map(this.windowsMainService.onDidUnmaximizeWindow, (window) => window.id),
        Event.map(this.auxiliaryWindowsMainService.onDidUnmaximizeWindow, (window) => window.id)
      );
      this.onDidChangeWindowFullScreen = Event.any(
        Event.map(this.windowsMainService.onDidChangeFullScreen, (e) => ({ windowId: e.window.id, fullscreen: e.fullscreen })),
        Event.map(this.auxiliaryWindowsMainService.onDidChangeFullScreen, (e) => ({ windowId: e.window.id, fullscreen: e.fullscreen }))
      );
      this.onDidBlurMainWindow = Event.filter(Event.fromNodeEventEmitter(app, "browser-window-blur", (event, window) => window.id), (windowId) => !!this.windowsMainService.getWindowById(windowId));
      this.onDidFocusMainWindow = Event.any(
        Event.map(Event.filter(Event.map(this.windowsMainService.onDidChangeWindowsCount, () => this.windowsMainService.getLastActiveWindow()), (window) => !!window), (window) => window.id),
        Event.filter(Event.fromNodeEventEmitter(app, "browser-window-focus", (event, window) => window.id), (windowId) => !!this.windowsMainService.getWindowById(windowId))
      );
      this.onDidBlurMainOrAuxiliaryWindow = Event.any(
        this.onDidBlurMainWindow,
        Event.map(Event.filter(Event.fromNodeEventEmitter(app, "browser-window-blur", (event, window) => this.auxiliaryWindowsMainService.getWindowByWebContents(window.webContents)), (window) => !!window), (window) => window.id)
      );
      this.onDidFocusMainOrAuxiliaryWindow = Event.any(
        this.onDidFocusMainWindow,
        Event.map(Event.filter(Event.fromNodeEventEmitter(app, "browser-window-focus", (event, window) => this.auxiliaryWindowsMainService.getWindowByWebContents(window.webContents)), (window) => !!window), (window) => window.id)
      );
      this.onDidResumeOS = Event.fromNodeEventEmitter(powerMonitor, "resume");
      this.onDidChangeColorScheme = this.themeMainService.onDidChangeColorScheme;
      this.onDidChangeDisplay = Event.debounce(Event.any(
        Event.filter(Event.fromNodeEventEmitter(screen, "display-metrics-changed", (event, display, changedMetrics) => changedMetrics), (changedMetrics) => {
          return !(Array.isArray(changedMetrics) && changedMetrics.length === 1 && changedMetrics[0] === "workArea");
        }),
        Event.fromNodeEventEmitter(screen, "display-added"),
        Event.fromNodeEventEmitter(screen, "display-removed")
      ), () => {
      }, 100);
    }
  }
  //#region Properties
  get windowId() {
    throw new Error("Not implemented in electron-main");
  }
  async getWindows(windowId, options) {
    const mainWindows = this.windowsMainService.getWindows().map((window) => ({
      id: window.id,
      workspace: window.openedWorkspace ?? toWorkspaceIdentifier(window.backupPath, window.isExtensionDevelopmentHost),
      title: window.win?.getTitle() ?? "",
      filename: window.getRepresentedFilename(),
      dirty: window.isDocumentEdited()
    }));
    const auxiliaryWindows = [];
    if (options.includeAuxiliaryWindows) {
      auxiliaryWindows.push(...this.auxiliaryWindowsMainService.getWindows().map((window) => ({
        id: window.id,
        parentId: window.parentId,
        title: window.win?.getTitle() ?? "",
        filename: window.getRepresentedFilename()
      })));
    }
    return [...mainWindows, ...auxiliaryWindows];
  }
  async getWindowCount(windowId) {
    return this.windowsMainService.getWindowCount();
  }
  async getActiveWindowId(windowId) {
    const activeWindow = this.windowsMainService.getFocusedWindow() || this.windowsMainService.getLastActiveWindow();
    if (activeWindow) {
      return activeWindow.id;
    }
    return void 0;
  }
  async getActiveWindowPosition() {
    const activeWindow = this.windowsMainService.getFocusedWindow() || this.windowsMainService.getLastActiveWindow();
    if (activeWindow) {
      return activeWindow.getBounds();
    }
    return void 0;
  }
  async getNativeWindowHandle(fallbackWindowId, windowId) {
    const window = this.windowById(windowId, fallbackWindowId);
    if (window?.win) {
      return VSBuffer.wrap(window.win.getNativeWindowHandle());
    }
    return void 0;
  }
  openWindow(windowId, arg1, arg2) {
    if (Array.isArray(arg1)) {
      return this.doOpenWindow(windowId, arg1, arg2);
    }
    return this.doOpenEmptyWindow(windowId, arg1);
  }
  async doOpenWindow(windowId, toOpen, options = /* @__PURE__ */ Object.create(null)) {
    if (toOpen.length > 0) {
      await this.windowsMainService.open({
        context: OpenContext.API,
        contextWindowId: windowId,
        urisToOpen: toOpen,
        cli: this.environmentMainService.args,
        forceNewWindow: options.forceNewWindow,
        forceReuseWindow: options.forceReuseWindow,
        preferNewWindow: options.preferNewWindow,
        diffMode: options.diffMode,
        mergeMode: options.mergeMode,
        addMode: options.addMode,
        removeMode: options.removeMode,
        gotoLineMode: options.gotoLineMode,
        noRecentEntry: options.noRecentEntry,
        waitMarkerFileURI: options.waitMarkerFileURI,
        remoteAuthority: options.remoteAuthority || void 0,
        forceProfile: options.forceProfile,
        forceTempProfile: options.forceTempProfile
      });
    }
  }
  async doOpenEmptyWindow(windowId, options) {
    await this.windowsMainService.openEmptyWindow({
      context: OpenContext.API,
      contextWindowId: windowId
    }, options);
  }
  async isFullScreen(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return window?.isFullScreen ?? false;
  }
  async toggleFullScreen(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.toggleFullScreen();
  }
  async getCursorScreenPoint(windowId) {
    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    return { point, display: display.bounds };
  }
  async isMaximized(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return window?.win?.isMaximized() ?? false;
  }
  async maximizeWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.maximize();
  }
  async unmaximizeWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.unmaximize();
  }
  async minimizeWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.minimize();
  }
  async moveWindowTop(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.moveTop();
  }
  async positionWindow(windowId, position, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    if (window?.win) {
      if (window.win.isFullScreen()) {
        const fullscreenLeftFuture = Event.toPromise(Event.once(Event.fromNodeEventEmitter(window.win, "leave-full-screen")));
        window.win.setFullScreen(false);
        await fullscreenLeftFuture;
      }
      window.win.setBounds(position);
    }
  }
  async updateWindowControls(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.updateWindowControls(options);
  }
  async focusWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.focus({ force: options?.force ?? false });
  }
  async setMinimumSize(windowId, width, height) {
    const window = this.codeWindowById(windowId);
    if (window?.win) {
      const [windowWidth, windowHeight] = window.win.getSize();
      const [minWindowWidth, minWindowHeight] = window.win.getMinimumSize();
      const [newMinWindowWidth, newMinWindowHeight] = [width ?? minWindowWidth, height ?? minWindowHeight];
      const [newWindowWidth, newWindowHeight] = [Math.max(windowWidth, newMinWindowWidth), Math.max(windowHeight, newMinWindowHeight)];
      if (minWindowWidth !== newMinWindowWidth || minWindowHeight !== newMinWindowHeight) {
        window.win.setMinimumSize(newMinWindowWidth, newMinWindowHeight);
      }
      if (windowWidth !== newWindowWidth || windowHeight !== newWindowHeight) {
        window.win.setSize(newWindowWidth, newWindowHeight);
      }
    }
  }
  async saveWindowSplash(windowId, splash) {
    const window = this.codeWindowById(windowId);
    this.themeMainService.saveWindowSplash(windowId, window?.openedWorkspace, splash);
  }
  //#endregion
  //#region macOS Shell Command
  async installShellCommand(windowId) {
    const { source, target } = await this.getShellCommandLink();
    try {
      const { symbolicLink } = await SymlinkSupport.stat(source);
      if (symbolicLink && !symbolicLink.dangling) {
        const linkTargetRealPath = await realpath(source);
        if (target === linkTargetRealPath) {
          return;
        }
      }
      await fs.promises.unlink(source);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    try {
      await fs.promises.symlink(target, source);
    } catch (error) {
      if (error.code !== "EACCES" && error.code !== "ENOENT") {
        throw error;
      }
      const { response } = await this.showMessageBox(windowId, {
        type: "info",
        message: localize("warnEscalation", "{0} will now prompt with 'osascript' for Administrator privileges to install the shell command.", this.productService.nameShort),
        buttons: [
          localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
          localize("cancel", "Cancel")
        ]
      });
      if (response === 1) {
        throw new CancellationError();
      }
      try {
        const command = `osascript -e "do shell script \\"mkdir -p /usr/local/bin && ln -sf '${target}' '${source}'\\" with administrator privileges"`;
        await promisify(exec)(command);
      } catch (error2) {
        throw new Error(localize("cantCreateBinFolder", "Unable to install the shell command '{0}'.", source));
      }
    }
  }
  async uninstallShellCommand(windowId) {
    const { source } = await this.getShellCommandLink();
    try {
      await fs.promises.unlink(source);
    } catch (error) {
      switch (error.code) {
        case "EACCES": {
          const { response } = await this.showMessageBox(windowId, {
            type: "info",
            message: localize("warnEscalationUninstall", "{0} will now prompt with 'osascript' for Administrator privileges to uninstall the shell command.", this.productService.nameShort),
            buttons: [
              localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
              localize("cancel", "Cancel")
            ]
          });
          if (response === 1) {
            throw new CancellationError();
          }
          try {
            const command = `osascript -e "do shell script \\"rm '${source}'\\" with administrator privileges"`;
            await promisify(exec)(command);
          } catch (error2) {
            throw new Error(localize("cantUninstall", "Unable to uninstall the shell command '{0}'.", source));
          }
          break;
        }
        case "ENOENT":
          break;
        // ignore file not found
        default:
          throw error;
      }
    }
  }
  async getShellCommandLink() {
    const target = resolve(this.environmentMainService.appRoot, "bin", "code");
    const source = `/usr/local/bin/${this.productService.applicationName}`;
    const sourceExists = await Promises.exists(target);
    if (!sourceExists) {
      throw new Error(localize("sourceMissing", "Unable to find shell script in '{0}'", target));
    }
    return { source, target };
  }
  //#endregion
  //#region Dialog
  async showMessageBox(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return this.dialogMainService.showMessageBox(options, window?.win ?? void 0);
  }
  async showSaveDialog(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return this.dialogMainService.showSaveDialog(options, window?.win ?? void 0);
  }
  async showOpenDialog(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return this.dialogMainService.showOpenDialog(options, window?.win ?? void 0);
  }
  async pickFileFolderAndOpen(windowId, options) {
    const paths = await this.dialogMainService.pickFileFolder(options);
    if (paths) {
      await this.doOpenPicked(await Promise.all(paths.map(async (path) => await SymlinkSupport.existsDirectory(path) ? { folderUri: URI.file(path) } : { fileUri: URI.file(path) })), options, windowId);
    }
  }
  async pickFolderAndOpen(windowId, options) {
    const paths = await this.dialogMainService.pickFolder(options);
    if (paths) {
      await this.doOpenPicked(paths.map((path) => ({ folderUri: URI.file(path) })), options, windowId);
    }
  }
  async pickFileAndOpen(windowId, options) {
    const paths = await this.dialogMainService.pickFile(options);
    if (paths) {
      await this.doOpenPicked(paths.map((path) => ({ fileUri: URI.file(path) })), options, windowId);
    }
  }
  async pickWorkspaceAndOpen(windowId, options) {
    const paths = await this.dialogMainService.pickWorkspace(options);
    if (paths) {
      await this.doOpenPicked(paths.map((path) => ({ workspaceUri: URI.file(path) })), options, windowId);
    }
  }
  async doOpenPicked(openable, options, windowId) {
    await this.windowsMainService.open({
      context: OpenContext.DIALOG,
      contextWindowId: windowId,
      cli: this.environmentMainService.args,
      urisToOpen: openable,
      forceNewWindow: options.forceNewWindow
      /* remoteAuthority will be determined based on openable */
    });
  }
  //#endregion
  //#region OS
  async showItemInFolder(windowId, path) {
    shell.showItemInFolder(path);
  }
  async setRepresentedFilename(windowId, path, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.setRepresentedFilename(path);
  }
  async setDocumentEdited(windowId, edited, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.setDocumentEdited(edited);
  }
  async openExternal(windowId, url, defaultApplication) {
    this.environmentMainService.unsetSnapExportedVariables();
    try {
      if (matchesSomeScheme(url, Schemas.http, Schemas.https)) {
        this.openExternalBrowser(url, defaultApplication);
      } else {
        shell.openExternal(url);
      }
    } finally {
      this.environmentMainService.restoreSnapExportedVariables();
    }
    return true;
  }
  async openExternalBrowser(url, defaultApplication) {
    const configuredBrowser = defaultApplication ?? this.configurationService.getValue("workbench.externalBrowser");
    if (!configuredBrowser) {
      return shell.openExternal(url);
    }
    if (configuredBrowser.includes(posix.sep) || configuredBrowser.includes(win32.sep)) {
      const browserPathExists = await Promises.exists(configuredBrowser);
      if (!browserPathExists) {
        this.logService.error(`Configured external browser path does not exist: ${configuredBrowser}`);
        return shell.openExternal(url);
      }
    }
    try {
      const { default: open } = await import("open");
      const res = await open(url, {
        app: {
          // Use `open.apps` helper to allow cross-platform browser
          // aliases to be looked up properly. Fallback to the
          // configured value if not found.
          name: Object.hasOwn(open.apps, configuredBrowser) ? open.apps[configuredBrowser] : configuredBrowser
        }
      });
      if (!isWindows) {
        res.stderr?.once("data", (data) => {
          this.logService.error(`Error openening external URL '${url}' using browser '${configuredBrowser}': ${data.toString()}`);
          return shell.openExternal(url);
        });
      }
    } catch (error) {
      this.logService.error(`Unable to open external URL '${url}' using browser '${configuredBrowser}' due to ${error}.`);
      return shell.openExternal(url);
    }
  }
  moveItemToTrash(windowId, fullPath) {
    return shell.trashItem(fullPath);
  }
  async isAdmin() {
    let isAdmin;
    if (isWindows) {
      isAdmin = (await import("native-is-elevated")).default();
    } else {
      isAdmin = process.getuid?.() === 0;
    }
    return isAdmin;
  }
  async writeElevated(windowId, source, target, options) {
    const sudoPrompt = await import("@vscode/sudo-prompt");
    const argsFile = randomPath(this.environmentMainService.userDataPath, "code-elevated");
    await Promises.writeFile(argsFile, JSON.stringify({ source: source.fsPath, target: target.fsPath }));
    try {
      await new Promise((resolve2, reject) => {
        const sudoCommand = [`"${this.cliPath}"`];
        if (options?.unlock) {
          sudoCommand.push("--file-chmod");
        }
        sudoCommand.push("--file-write", `"${argsFile}"`);
        const promptOptions = {
          name: this.productService.nameLong.replace("-", ""),
          icns: isMacintosh && this.environmentMainService.isBuilt ? join(dirname(this.environmentMainService.appRoot), `${this.productService.nameShort}.icns`) : void 0
        };
        this.logService.trace(`[sudo-prompt] running command: ${sudoCommand.join(" ")}`);
        sudoPrompt.exec(sudoCommand.join(" "), promptOptions, (error, stdout, stderr) => {
          if (stdout) {
            this.logService.trace(`[sudo-prompt] received stdout: ${stdout}`);
          }
          if (stderr) {
            this.logService.error(`[sudo-prompt] received stderr: ${stderr}`);
          }
          if (error) {
            reject(error);
          } else {
            resolve2(void 0);
          }
        });
      });
    } finally {
      await fs.promises.unlink(argsFile);
    }
  }
  async isRunningUnderARM64Translation() {
    if (isLinux || isWindows) {
      return false;
    }
    return app.runningUnderARM64Translation;
  }
  get cliPath() {
    if (isWindows) {
      if (this.environmentMainService.isBuilt) {
        return join(dirname(process.execPath), "bin", `${this.productService.applicationName}.cmd`);
      }
      return join(this.environmentMainService.appRoot, "scripts", "code-cli.bat");
    }
    if (isLinux) {
      if (this.environmentMainService.isBuilt) {
        return join(dirname(process.execPath), "bin", `${this.productService.applicationName}`);
      }
      return join(this.environmentMainService.appRoot, "scripts", "code-cli.sh");
    }
    if (this.environmentMainService.isBuilt) {
      return join(this.environmentMainService.appRoot, "bin", "code");
    }
    return join(this.environmentMainService.appRoot, "scripts", "code-cli.sh");
  }
  async getOSStatistics() {
    return {
      totalmem: totalmem(),
      freemem: freemem(),
      loadavg: loadavg()
    };
  }
  async getOSProperties() {
    return {
      arch: arch(),
      platform: platform(),
      release: release(),
      type: type(),
      cpus: cpus()
    };
  }
  async getOSVirtualMachineHint() {
    return virtualMachineHint.value();
  }
  async getOSColorScheme() {
    return this.themeMainService.getColorScheme();
  }
  // WSL
  async hasWSLFeatureInstalled() {
    return isWindows && hasWSLFeatureInstalled();
  }
  //#endregion
  //#region Screenshots
  async getScreenshot(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    const captured = await window?.win?.webContents.capturePage();
    return captured?.toJPEG(95);
  }
  //#endregion
  //#region Process
  async getProcessId(windowId) {
    const window = this.windowById(void 0, windowId);
    return window?.win?.webContents.getOSProcessId();
  }
  async killProcess(windowId, pid, code) {
    process.kill(pid, code);
  }
  //#endregion
  //#region Clipboard
  async readClipboardText(windowId, type2) {
    return clipboard.readText(type2);
  }
  async readImage() {
    return clipboard.readImage().toPNG();
  }
  async writeClipboardText(windowId, text, type2) {
    return clipboard.writeText(text, type2);
  }
  async readClipboardFindText(windowId) {
    return clipboard.readFindText();
  }
  async writeClipboardFindText(windowId, text) {
    return clipboard.writeFindText(text);
  }
  async writeClipboardBuffer(windowId, format, buffer, type2) {
    return clipboard.writeBuffer(format, Buffer.from(buffer.buffer), type2);
  }
  async readClipboardBuffer(windowId, format) {
    return VSBuffer.wrap(clipboard.readBuffer(format));
  }
  async hasClipboard(windowId, format, type2) {
    return clipboard.has(format, type2);
  }
  //#endregion
  //#region macOS Touchbar
  async newWindowTab() {
    await this.windowsMainService.open({
      context: OpenContext.API,
      cli: this.environmentMainService.args,
      forceNewTabbedWindow: true,
      forceEmpty: true,
      remoteAuthority: this.environmentMainService.args.remote || void 0
    });
  }
  async showPreviousWindowTab() {
    Menu.sendActionToFirstResponder("selectPreviousTab:");
  }
  async showNextWindowTab() {
    Menu.sendActionToFirstResponder("selectNextTab:");
  }
  async moveWindowTabToNewWindow() {
    Menu.sendActionToFirstResponder("moveTabToNewWindow:");
  }
  async mergeAllWindowTabs() {
    Menu.sendActionToFirstResponder("mergeAllWindows:");
  }
  async toggleWindowTabsBar() {
    Menu.sendActionToFirstResponder("toggleTabBar:");
  }
  async updateTouchBar(windowId, items) {
    const window = this.codeWindowById(windowId);
    window?.updateTouchBar(items);
  }
  //#endregion
  //#region Lifecycle
  async notifyReady(windowId) {
    const window = this.codeWindowById(windowId);
    window?.setReady();
  }
  async relaunch(windowId, options) {
    return this.lifecycleMainService.relaunch(options);
  }
  async reload(windowId, options) {
    const window = this.codeWindowById(windowId);
    if (window) {
      if (isWorkspaceIdentifier(window.openedWorkspace)) {
        const configPath = window.openedWorkspace.configPath;
        if (configPath.scheme === Schemas.file) {
          const workspace = await this.workspacesManagementMainService.resolveLocalWorkspace(configPath);
          if (workspace?.transient) {
            return this.openWindow(window.id, { forceReuseWindow: true });
          }
        }
      }
      return this.lifecycleMainService.reload(window, options?.disableExtensions !== void 0 ? { _: [], "disable-extensions": options.disableExtensions } : void 0);
    }
  }
  async closeWindow(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    return window?.win?.close();
  }
  async quit(windowId) {
    const window = this.windowsMainService.getLastActiveWindow();
    if (window?.isExtensionDevelopmentHost && this.windowsMainService.getWindowCount() > 1 && window.win) {
      window.win.close();
    } else {
      this.lifecycleMainService.quit();
    }
  }
  async exit(windowId, code) {
    await this.lifecycleMainService.kill(code);
  }
  //#endregion
  //#region Connectivity
  async resolveProxy(windowId, url) {
    const window = this.codeWindowById(windowId);
    const session = window?.win?.webContents?.session;
    return session?.resolveProxy(url);
  }
  async lookupAuthorization(_windowId, authInfo) {
    return this.proxyAuthService.lookupAuthorization(authInfo);
  }
  async lookupKerberosAuthorization(_windowId, url) {
    return this.requestService.lookupKerberosAuthorization(url);
  }
  async loadCertificates(_windowId) {
    return this.requestService.loadCertificates();
  }
  findFreePort(windowId, startPort, giveUpAfter, timeout, stride = 1) {
    return findFreePort(startPort, giveUpAfter, timeout, stride);
  }
  async openDevTools(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.webContents.openDevTools(options?.mode ? { mode: options.mode, activate: options.activate } : void 0);
  }
  async toggleDevTools(windowId, options) {
    const window = this.windowById(options?.targetWindowId, windowId);
    window?.win?.webContents.toggleDevTools();
  }
  async openGPUInfoWindow(windowId) {
    const parentWindow = this.codeWindowById(windowId);
    if (!parentWindow) {
      return;
    }
    if (typeof this.gpuInfoWindowId !== "number") {
      const options = this.instantiationService.invokeFunction(defaultBrowserWindowOptions, defaultWindowState(), { forceNativeTitlebar: true });
      options.backgroundColor = void 0;
      const gpuInfoWindow = new BrowserWindow(options);
      gpuInfoWindow.setMenuBarVisibility(false);
      gpuInfoWindow.loadURL("chrome://gpu");
      gpuInfoWindow.once("ready-to-show", () => gpuInfoWindow.show());
      gpuInfoWindow.once("close", () => this.gpuInfoWindowId = void 0);
      parentWindow.win?.on("close", () => {
        if (this.gpuInfoWindowId) {
          BrowserWindow.fromId(this.gpuInfoWindowId)?.close();
          this.gpuInfoWindowId = void 0;
        }
      });
      this.gpuInfoWindowId = gpuInfoWindow.id;
    }
    if (typeof this.gpuInfoWindowId === "number") {
      const window = BrowserWindow.fromId(this.gpuInfoWindowId);
      if (window?.isMinimized()) {
        window?.restore();
      }
      window?.focus();
    }
  }
  //#endregion
  // #region Performance
  async profileRenderer(windowId, session, duration) {
    const window = this.codeWindowById(windowId);
    if (!window || !window.win) {
      throw new Error();
    }
    const profiler = new WindowProfiler(window.win, session, this.logService);
    const result = await profiler.inspect(duration);
    return result;
  }
  // #endregion
  //#region Registry (windows)
  async windowsGetStringRegKey(windowId, hive, path, name) {
    if (!isWindows) {
      return void 0;
    }
    const Registry = await import("@vscode/windows-registry");
    try {
      return Registry.GetStringRegKey(hive, path, name);
    } catch {
      return void 0;
    }
  }
  //#endregion
  windowById(windowId, fallbackCodeWindowId) {
    return this.codeWindowById(windowId) ?? this.auxiliaryWindowById(windowId) ?? this.codeWindowById(fallbackCodeWindowId);
  }
  codeWindowById(windowId) {
    if (typeof windowId !== "number") {
      return void 0;
    }
    return this.windowsMainService.getWindowById(windowId);
  }
  auxiliaryWindowById(windowId) {
    if (typeof windowId !== "number") {
      return void 0;
    }
    const contents = webContents.fromId(windowId);
    if (!contents) {
      return void 0;
    }
    return this.auxiliaryWindowsMainService.getWindowByWebContents(contents);
  }
};
__decorateClass([
  memoize
], NativeHostMainService.prototype, "cliPath", 1);
NativeHostMainService = __decorateClass([
  __decorateParam(0, IWindowsMainService),
  __decorateParam(1, IAuxiliaryWindowsMainService),
  __decorateParam(2, IDialogMainService),
  __decorateParam(3, ILifecycleMainService),
  __decorateParam(4, IEnvironmentMainService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IThemeMainService),
  __decorateParam(8, IWorkspacesManagementMainService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IRequestService),
  __decorateParam(11, IProxyAuthService),
  __decorateParam(12, IInstantiationService)
], NativeHostMainService);
export {
  INativeHostMainService,
  NativeHostMainService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9uYXRpdmUvZWxlY3Ryb24tbWFpbi9uYXRpdmVIb3N0TWFpblNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIGNsaXBib2FyZCwgRGlzcGxheSwgTWVudSwgTWVzc2FnZUJveE9wdGlvbnMsIE1lc3NhZ2VCb3hSZXR1cm5WYWx1ZSwgT3BlbkRldlRvb2xzT3B0aW9ucywgT3BlbkRpYWxvZ09wdGlvbnMsIE9wZW5EaWFsb2dSZXR1cm5WYWx1ZSwgcG93ZXJNb25pdG9yLCBTYXZlRGlhbG9nT3B0aW9ucywgU2F2ZURpYWxvZ1JldHVyblZhbHVlLCBzY3JlZW4sIHNoZWxsLCB3ZWJDb250ZW50cyB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCB7IGFyY2gsIGNwdXMsIGZyZWVtZW0sIGxvYWRhdmcsIHBsYXRmb3JtLCByZWxlYXNlLCB0b3RhbG1lbSwgdHlwZSB9IGZyb20gJ29zJztcbmltcG9ydCB7IHByb21pc2lmeSB9IGZyb20gJ3V0aWwnO1xuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG1hdGNoZXNTb21lU2NoZW1lLCBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lLCBqb2luLCBwb3NpeCwgcmVzb2x2ZSwgd2luMzIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGlzTGludXgsIGlzTWFjaW50b3NoLCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBBZGRGaXJzdFBhcmFtZXRlclRvRnVuY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IHJlYWxwYXRoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgdmlydHVhbE1hY2hpbmVIaW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL2lkLmpzJztcbmltcG9ydCB7IFByb21pc2VzLCBTeW1saW5rU3VwcG9ydCB9IGZyb20gJy4uLy4uLy4uL2Jhc2Uvbm9kZS9wZnMuanMnO1xuaW1wb3J0IHsgZmluZEZyZWVQb3J0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3BvcnRzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElTZXJpYWxpemFibGVDb21tYW5kQWN0aW9uIH0gZnJvbSAnLi4vLi4vYWN0aW9uL2NvbW1vbi9hY3Rpb24uanMnO1xuaW1wb3J0IHsgSU5hdGl2ZU9wZW5EaWFsb2dPcHRpb25zIH0gZnJvbSAnLi4vLi4vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9kaWFsb2dzL2VsZWN0cm9uLW1haW4vZGlhbG9nTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50TWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9lbGVjdHJvbi1tYWluL2Vudmlyb25tZW50TWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yLCBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVNYWluU2VydmljZSwgSVJlbGF1bmNoT3B0aW9ucyB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9lbGVjdHJvbi1tYWluL2xpZmVjeWNsZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUNvbW1vbk5hdGl2ZUhvc3RTZXJ2aWNlLCBJTmF0aXZlSG9zdE9wdGlvbnMsIElPU1Byb3BlcnRpZXMsIElPU1N0YXRpc3RpY3MgfSBmcm9tICcuLi9jb21tb24vbmF0aXZlLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQYXJ0c1NwbGFzaCB9IGZyb20gJy4uLy4uL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRoZW1lTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi90aGVtZS9lbGVjdHJvbi1tYWluL3RoZW1lTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZGVmYXVsdFdpbmRvd1N0YXRlLCBJQ29kZVdpbmRvdyB9IGZyb20gJy4uLy4uL3dpbmRvdy9lbGVjdHJvbi1tYWluL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJQ29sb3JTY2hlbWUsIElPcGVuZWRBdXhpbGlhcnlXaW5kb3csIElPcGVuZWRNYWluV2luZG93LCBJT3BlbkVtcHR5V2luZG93T3B0aW9ucywgSU9wZW5XaW5kb3dPcHRpb25zLCBJUG9pbnQsIElSZWN0YW5nbGUsIElXaW5kb3dPcGVuYWJsZSB9IGZyb20gJy4uLy4uL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IGRlZmF1bHRCcm93c2VyV2luZG93T3B0aW9ucywgSVdpbmRvd3NNYWluU2VydmljZSwgT3BlbkNvbnRleHQgfSBmcm9tICcuLi8uLi93aW5kb3dzL2VsZWN0cm9uLW1haW4vd2luZG93cy5qcyc7XG5pbXBvcnQgeyBpc1dvcmtzcGFjZUlkZW50aWZpZXIsIHRvV29ya3NwYWNlSWRlbnRpZmllciB9IGZyb20gJy4uLy4uL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlcy9lbGVjdHJvbi1tYWluL3dvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgaGFzV1NMRmVhdHVyZUluc3RhbGxlZCB9IGZyb20gJy4uLy4uL3JlbW90ZS9ub2RlL3dzbC5qcyc7XG5pbXBvcnQgeyBXaW5kb3dQcm9maWxlciB9IGZyb20gJy4uLy4uL3Byb2ZpbGluZy9lbGVjdHJvbi1tYWluL3dpbmRvd1Byb2ZpbGluZy5qcyc7XG5pbXBvcnQgeyBJVjhQcm9maWxlIH0gZnJvbSAnLi4vLi4vcHJvZmlsaW5nL2NvbW1vbi9wcm9maWxpbmcuanMnO1xuaW1wb3J0IHsgSUF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2F1eGlsaWFyeVdpbmRvdy9lbGVjdHJvbi1tYWluL2F1eGlsaWFyeVdpbmRvd3MuanMnO1xuaW1wb3J0IHsgSUF1eGlsaWFyeVdpbmRvdyB9IGZyb20gJy4uLy4uL2F1eGlsaWFyeVdpbmRvdy9lbGVjdHJvbi1tYWluL2F1eGlsaWFyeVdpbmRvdy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElQcm94eUF1dGhTZXJ2aWNlIH0gZnJvbSAnLi9hdXRoLmpzJztcbmltcG9ydCB7IEF1dGhJbmZvLCBDcmVkZW50aWFscywgSVJlcXVlc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcmVxdWVzdC9jb21tb24vcmVxdWVzdC5qcyc7XG5pbXBvcnQgeyByYW5kb21QYXRoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5hdGl2ZUhvc3RNYWluU2VydmljZSBleHRlbmRzIEFkZEZpcnN0UGFyYW1ldGVyVG9GdW5jdGlvbnM8SUNvbW1vbk5hdGl2ZUhvc3RTZXJ2aWNlLCBQcm9taXNlPHVua25vd24+IC8qIG9ubHkgbWV0aG9kcywgbm90IGV2ZW50cyAqLywgbnVtYmVyIHwgdW5kZWZpbmVkIC8qIHdpbmRvdyBJRCAqLz4geyB9XG5cbmV4cG9ydCBjb25zdCBJTmF0aXZlSG9zdE1haW5TZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElOYXRpdmVIb3N0TWFpblNlcnZpY2U+KCduYXRpdmVIb3N0TWFpblNlcnZpY2UnKTtcblxuZXhwb3J0IGNsYXNzIE5hdGl2ZUhvc3RNYWluU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTmF0aXZlSG9zdE1haW5TZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdpbmRvd3NNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdpbmRvd3NNYWluU2VydmljZTogSVdpbmRvd3NNYWluU2VydmljZSxcblx0XHRASUF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZTogSUF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZSxcblx0XHRASURpYWxvZ01haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nTWFpblNlcnZpY2U6IElEaWFsb2dNYWluU2VydmljZSxcblx0XHRASUxpZmVjeWNsZU1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlTWFpblNlcnZpY2U6IElMaWZlY3ljbGVNYWluU2VydmljZSxcblx0XHRASUVudmlyb25tZW50TWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudE1haW5TZXJ2aWNlOiBJRW52aXJvbm1lbnRNYWluU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVRoZW1lTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0aGVtZU1haW5TZXJ2aWNlOiBJVGhlbWVNYWluU2VydmljZSxcblx0XHRASVdvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlOiBJV29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVJlcXVlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdFNlcnZpY2U6IElSZXF1ZXN0U2VydmljZSxcblx0XHRASVByb3h5QXV0aFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm94eUF1dGhTZXJ2aWNlOiBJUHJveHlBdXRoU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gRXZlbnRzXG5cdFx0e1xuXHRcdFx0dGhpcy5vbkRpZE9wZW5NYWluV2luZG93ID0gRXZlbnQubWFwKHRoaXMud2luZG93c01haW5TZXJ2aWNlLm9uRGlkT3BlbldpbmRvdywgd2luZG93ID0+IHdpbmRvdy5pZCk7XG5cblx0XHRcdHRoaXMub25EaWRUcmlnZ2VyV2luZG93U3lzdGVtQ29udGV4dE1lbnUgPSBFdmVudC5hbnkoXG5cdFx0XHRcdEV2ZW50Lm1hcCh0aGlzLndpbmRvd3NNYWluU2VydmljZS5vbkRpZFRyaWdnZXJTeXN0ZW1Db250ZXh0TWVudSwgKHsgd2luZG93LCB4LCB5IH0pID0+ICh7IHdpbmRvd0lkOiB3aW5kb3cuaWQsIHgsIHkgfSkpLFxuXHRcdFx0XHRFdmVudC5tYXAodGhpcy5hdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2Uub25EaWRUcmlnZ2VyU3lzdGVtQ29udGV4dE1lbnUsICh7IHdpbmRvdywgeCwgeSB9KSA9PiAoeyB3aW5kb3dJZDogd2luZG93LmlkLCB4LCB5IH0pKVxuXHRcdFx0KTtcblxuXHRcdFx0dGhpcy5vbkRpZE1heGltaXplV2luZG93ID0gRXZlbnQuYW55KFxuXHRcdFx0XHRFdmVudC5tYXAodGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub25EaWRNYXhpbWl6ZVdpbmRvdywgd2luZG93ID0+IHdpbmRvdy5pZCksXG5cdFx0XHRcdEV2ZW50Lm1hcCh0aGlzLmF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZS5vbkRpZE1heGltaXplV2luZG93LCB3aW5kb3cgPT4gd2luZG93LmlkKVxuXHRcdFx0KTtcblx0XHRcdHRoaXMub25EaWRVbm1heGltaXplV2luZG93ID0gRXZlbnQuYW55KFxuXHRcdFx0XHRFdmVudC5tYXAodGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub25EaWRVbm1heGltaXplV2luZG93LCB3aW5kb3cgPT4gd2luZG93LmlkKSxcblx0XHRcdFx0RXZlbnQubWFwKHRoaXMuYXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlLm9uRGlkVW5tYXhpbWl6ZVdpbmRvdywgd2luZG93ID0+IHdpbmRvdy5pZClcblx0XHRcdCk7XG5cblx0XHRcdHRoaXMub25EaWRDaGFuZ2VXaW5kb3dGdWxsU2NyZWVuID0gRXZlbnQuYW55KFxuXHRcdFx0XHRFdmVudC5tYXAodGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub25EaWRDaGFuZ2VGdWxsU2NyZWVuLCBlID0+ICh7IHdpbmRvd0lkOiBlLndpbmRvdy5pZCwgZnVsbHNjcmVlbjogZS5mdWxsc2NyZWVuIH0pKSxcblx0XHRcdFx0RXZlbnQubWFwKHRoaXMuYXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlLm9uRGlkQ2hhbmdlRnVsbFNjcmVlbiwgZSA9PiAoeyB3aW5kb3dJZDogZS53aW5kb3cuaWQsIGZ1bGxzY3JlZW46IGUuZnVsbHNjcmVlbiB9KSlcblx0XHRcdCk7XG5cblx0XHRcdHRoaXMub25EaWRCbHVyTWFpbldpbmRvdyA9IEV2ZW50LmZpbHRlcihFdmVudC5mcm9tTm9kZUV2ZW50RW1pdHRlcihhcHAsICdicm93c2VyLXdpbmRvdy1ibHVyJywgKGV2ZW50LCB3aW5kb3c6IEJyb3dzZXJXaW5kb3cpID0+IHdpbmRvdy5pZCksIHdpbmRvd0lkID0+ICEhdGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0V2luZG93QnlJZCh3aW5kb3dJZCkpO1xuXHRcdFx0dGhpcy5vbkRpZEZvY3VzTWFpbldpbmRvdyA9IEV2ZW50LmFueShcblx0XHRcdFx0RXZlbnQubWFwKEV2ZW50LmZpbHRlcihFdmVudC5tYXAodGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub25EaWRDaGFuZ2VXaW5kb3dzQ291bnQsICgpID0+IHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldExhc3RBY3RpdmVXaW5kb3coKSksIHdpbmRvdyA9PiAhIXdpbmRvdyksIHdpbmRvdyA9PiB3aW5kb3chLmlkKSxcblx0XHRcdFx0RXZlbnQuZmlsdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKGFwcCwgJ2Jyb3dzZXItd2luZG93LWZvY3VzJywgKGV2ZW50LCB3aW5kb3c6IEJyb3dzZXJXaW5kb3cpID0+IHdpbmRvdy5pZCksIHdpbmRvd0lkID0+ICEhdGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0V2luZG93QnlJZCh3aW5kb3dJZCkpXG5cdFx0XHQpO1xuXG5cdFx0XHR0aGlzLm9uRGlkQmx1ck1haW5PckF1eGlsaWFyeVdpbmRvdyA9IEV2ZW50LmFueShcblx0XHRcdFx0dGhpcy5vbkRpZEJsdXJNYWluV2luZG93LFxuXHRcdFx0XHRFdmVudC5tYXAoRXZlbnQuZmlsdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKGFwcCwgJ2Jyb3dzZXItd2luZG93LWJsdXInLCAoZXZlbnQsIHdpbmRvdzogQnJvd3NlcldpbmRvdykgPT4gdGhpcy5hdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2UuZ2V0V2luZG93QnlXZWJDb250ZW50cyh3aW5kb3cud2ViQ29udGVudHMpKSwgd2luZG93ID0+ICEhd2luZG93KSwgd2luZG93ID0+IHdpbmRvdyEuaWQpXG5cdFx0XHQpO1xuXHRcdFx0dGhpcy5vbkRpZEZvY3VzTWFpbk9yQXV4aWxpYXJ5V2luZG93ID0gRXZlbnQuYW55KFxuXHRcdFx0XHR0aGlzLm9uRGlkRm9jdXNNYWluV2luZG93LFxuXHRcdFx0XHRFdmVudC5tYXAoRXZlbnQuZmlsdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKGFwcCwgJ2Jyb3dzZXItd2luZG93LWZvY3VzJywgKGV2ZW50LCB3aW5kb3c6IEJyb3dzZXJXaW5kb3cpID0+IHRoaXMuYXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0J5V2ViQ29udGVudHMod2luZG93LndlYkNvbnRlbnRzKSksIHdpbmRvdyA9PiAhIXdpbmRvdyksIHdpbmRvdyA9PiB3aW5kb3chLmlkKVxuXHRcdFx0KTtcblxuXHRcdFx0dGhpcy5vbkRpZFJlc3VtZU9TID0gRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXIocG93ZXJNb25pdG9yLCAncmVzdW1lJyk7XG5cblx0XHRcdHRoaXMub25EaWRDaGFuZ2VDb2xvclNjaGVtZSA9IHRoaXMudGhlbWVNYWluU2VydmljZS5vbkRpZENoYW5nZUNvbG9yU2NoZW1lO1xuXG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlRGlzcGxheSA9IEV2ZW50LmRlYm91bmNlKEV2ZW50LmFueShcblx0XHRcdFx0RXZlbnQuZmlsdGVyKEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKHNjcmVlbiwgJ2Rpc3BsYXktbWV0cmljcy1jaGFuZ2VkJywgKGV2ZW50OiBFbGVjdHJvbi5FdmVudCwgZGlzcGxheTogRGlzcGxheSwgY2hhbmdlZE1ldHJpY3M/OiBzdHJpbmdbXSkgPT4gY2hhbmdlZE1ldHJpY3MpLCBjaGFuZ2VkTWV0cmljcyA9PiB7XG5cdFx0XHRcdFx0Ly8gRWxlY3Ryb24gd2lsbCBlbWl0ICdkaXNwbGF5LW1ldHJpY3MtY2hhbmdlZCcgZXZlbnRzIGV2ZW4gd2hlbiBhY3R1YWxseVxuXHRcdFx0XHRcdC8vIGdvaW5nIGZ1bGxzY3JlZW4sIGJlY2F1c2UgdGhlIGRvY2sgaGlkZXMuIEhvd2V2ZXIsIHdlIGRvIG5vdCB3YW50IHRvXG5cdFx0XHRcdFx0Ly8gcmVhY3Qgb24gdGhpcyBldmVudCBhcyB0aGVyZSBpcyBubyBjaGFuZ2UgaW4gZGlzcGxheSBib3VuZHMuXG5cdFx0XHRcdFx0cmV0dXJuICEoQXJyYXkuaXNBcnJheShjaGFuZ2VkTWV0cmljcykgJiYgY2hhbmdlZE1ldHJpY3MubGVuZ3RoID09PSAxICYmIGNoYW5nZWRNZXRyaWNzWzBdID09PSAnd29ya0FyZWEnKTtcblx0XHRcdFx0fSksXG5cdFx0XHRcdEV2ZW50LmZyb21Ob2RlRXZlbnRFbWl0dGVyKHNjcmVlbiwgJ2Rpc3BsYXktYWRkZWQnKSxcblx0XHRcdFx0RXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXIoc2NyZWVuLCAnZGlzcGxheS1yZW1vdmVkJylcblx0XHRcdCksICgpID0+IHsgfSwgMTAwKTtcblx0XHR9XG5cdH1cblxuXG5cdC8vI3JlZ2lvbiBQcm9wZXJ0aWVzXG5cblx0Z2V0IHdpbmRvd0lkKCk6IG5ldmVyIHsgdGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQgaW4gZWxlY3Ryb24tbWFpbicpOyB9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblxuXHQvLyNyZWdpb24gRXZlbnRzXG5cblx0cmVhZG9ubHkgb25EaWRPcGVuTWFpbldpbmRvdzogRXZlbnQ8bnVtYmVyPjtcblxuXHRyZWFkb25seSBvbkRpZFRyaWdnZXJXaW5kb3dTeXN0ZW1Db250ZXh0TWVudTogRXZlbnQ8eyB3aW5kb3dJZDogbnVtYmVyOyB4OiBudW1iZXI7IHk6IG51bWJlciB9PjtcblxuXHRyZWFkb25seSBvbkRpZE1heGltaXplV2luZG93OiBFdmVudDxudW1iZXI+O1xuXHRyZWFkb25seSBvbkRpZFVubWF4aW1pemVXaW5kb3c6IEV2ZW50PG51bWJlcj47XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VXaW5kb3dGdWxsU2NyZWVuOiBFdmVudDx7IHJlYWRvbmx5IHdpbmRvd0lkOiBudW1iZXI7IHJlYWRvbmx5IGZ1bGxzY3JlZW46IGJvb2xlYW4gfT47XG5cblx0cmVhZG9ubHkgb25EaWRCbHVyTWFpbldpbmRvdzogRXZlbnQ8bnVtYmVyPjtcblx0cmVhZG9ubHkgb25EaWRGb2N1c01haW5XaW5kb3c6IEV2ZW50PG51bWJlcj47XG5cblx0cmVhZG9ubHkgb25EaWRCbHVyTWFpbk9yQXV4aWxpYXJ5V2luZG93OiBFdmVudDxudW1iZXI+O1xuXHRyZWFkb25seSBvbkRpZEZvY3VzTWFpbk9yQXV4aWxpYXJ5V2luZG93OiBFdmVudDxudW1iZXI+O1xuXG5cdHJlYWRvbmx5IG9uRGlkUmVzdW1lT1M6IEV2ZW50PHZvaWQ+O1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29sb3JTY2hlbWU6IEV2ZW50PElDb2xvclNjaGVtZT47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VQYXNzd29yZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgYWNjb3VudDogc3RyaW5nOyBzZXJ2aWNlOiBzdHJpbmcgfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUGFzc3dvcmQgPSB0aGlzLl9vbkRpZENoYW5nZVBhc3N3b3JkLmV2ZW50O1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRGlzcGxheTogRXZlbnQ8dm9pZD47XG5cblx0Ly8jZW5kcmVnaW9uXG5cblxuXHQvLyNyZWdpb24gV2luZG93XG5cblx0Z2V0V2luZG93cyh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zOiB7IGluY2x1ZGVBdXhpbGlhcnlXaW5kb3dzOiB0cnVlIH0pOiBQcm9taXNlPEFycmF5PElPcGVuZWRNYWluV2luZG93IHwgSU9wZW5lZEF1eGlsaWFyeVdpbmRvdz4+O1xuXHRnZXRXaW5kb3dzKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIG9wdGlvbnM6IHsgaW5jbHVkZUF1eGlsaWFyeVdpbmRvd3M6IGZhbHNlIH0pOiBQcm9taXNlPEFycmF5PElPcGVuZWRNYWluV2luZG93Pj47XG5cdGFzeW5jIGdldFdpbmRvd3Mod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgb3B0aW9uczogeyBpbmNsdWRlQXV4aWxpYXJ5V2luZG93czogYm9vbGVhbiB9KTogUHJvbWlzZTxBcnJheTxJT3BlbmVkTWFpbldpbmRvdyB8IElPcGVuZWRBdXhpbGlhcnlXaW5kb3c+PiB7XG5cdFx0Y29uc3QgbWFpbldpbmRvd3MgPSB0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dzKCkubWFwKHdpbmRvdyA9PiAoe1xuXHRcdFx0aWQ6IHdpbmRvdy5pZCxcblx0XHRcdHdvcmtzcGFjZTogd2luZG93Lm9wZW5lZFdvcmtzcGFjZSA/PyB0b1dvcmtzcGFjZUlkZW50aWZpZXIod2luZG93LmJhY2t1cFBhdGgsIHdpbmRvdy5pc0V4dGVuc2lvbkRldmVsb3BtZW50SG9zdCksXG5cdFx0XHR0aXRsZTogd2luZG93Lndpbj8uZ2V0VGl0bGUoKSA/PyAnJyxcblx0XHRcdGZpbGVuYW1lOiB3aW5kb3cuZ2V0UmVwcmVzZW50ZWRGaWxlbmFtZSgpLFxuXHRcdFx0ZGlydHk6IHdpbmRvdy5pc0RvY3VtZW50RWRpdGVkKClcblx0XHR9KSk7XG5cblx0XHRjb25zdCBhdXhpbGlhcnlXaW5kb3dzID0gW107XG5cdFx0aWYgKG9wdGlvbnMuaW5jbHVkZUF1eGlsaWFyeVdpbmRvd3MpIHtcblx0XHRcdGF1eGlsaWFyeVdpbmRvd3MucHVzaCguLi50aGlzLmF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dzKCkubWFwKHdpbmRvdyA9PiAoe1xuXHRcdFx0XHRpZDogd2luZG93LmlkLFxuXHRcdFx0XHRwYXJlbnRJZDogd2luZG93LnBhcmVudElkLFxuXHRcdFx0XHR0aXRsZTogd2luZG93Lndpbj8uZ2V0VGl0bGUoKSA/PyAnJyxcblx0XHRcdFx0ZmlsZW5hbWU6IHdpbmRvdy5nZXRSZXByZXNlbnRlZEZpbGVuYW1lKClcblx0XHRcdH0pKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFsuLi5tYWluV2luZG93cywgLi4uYXV4aWxpYXJ5V2luZG93c107XG5cdH1cblxuXHRhc3luYyBnZXRXaW5kb3dDb3VudCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxudW1iZXI+IHtcblx0XHRyZXR1cm4gdGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0V2luZG93Q291bnQoKTtcblx0fVxuXG5cdGFzeW5jIGdldEFjdGl2ZVdpbmRvd0lkKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQpOiBQcm9taXNlPG51bWJlciB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGFjdGl2ZVdpbmRvdyA9IHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldEZvY3VzZWRXaW5kb3coKSB8fCB0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRMYXN0QWN0aXZlV2luZG93KCk7XG5cdFx0aWYgKGFjdGl2ZVdpbmRvdykge1xuXHRcdFx0cmV0dXJuIGFjdGl2ZVdpbmRvdy5pZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0YXN5bmMgZ2V0QWN0aXZlV2luZG93UG9zaXRpb24oKTogUHJvbWlzZTxJUmVjdGFuZ2xlIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gdGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0Rm9jdXNlZFdpbmRvdygpIHx8IHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldExhc3RBY3RpdmVXaW5kb3coKTtcblx0XHRpZiAoYWN0aXZlV2luZG93KSB7XG5cdFx0XHRyZXR1cm4gYWN0aXZlV2luZG93LmdldEJvdW5kcygpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0YXN5bmMgZ2V0TmF0aXZlV2luZG93SGFuZGxlKGZhbGxiYWNrV2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgd2luZG93SWQ6IG51bWJlcik6IFByb21pc2U8VlNCdWZmZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd0J5SWQod2luZG93SWQsIGZhbGxiYWNrV2luZG93SWQpO1xuXHRcdGlmICh3aW5kb3c/Lndpbikge1xuXHRcdFx0cmV0dXJuIFZTQnVmZmVyLndyYXAod2luZG93Lndpbi5nZXROYXRpdmVXaW5kb3dIYW5kbGUoKSk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRvcGVuV2luZG93KHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIG9wdGlvbnM/OiBJT3BlbkVtcHR5V2luZG93T3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdG9wZW5XaW5kb3cod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgdG9PcGVuOiBJV2luZG93T3BlbmFibGVbXSwgb3B0aW9ucz86IElPcGVuV2luZG93T3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdG9wZW5XaW5kb3cod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgYXJnMT86IElPcGVuRW1wdHlXaW5kb3dPcHRpb25zIHwgSVdpbmRvd09wZW5hYmxlW10sIGFyZzI/OiBJT3BlbldpbmRvd09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShhcmcxKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9PcGVuV2luZG93KHdpbmRvd0lkLCBhcmcxLCBhcmcyKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5kb09wZW5FbXB0eVdpbmRvdyh3aW5kb3dJZCwgYXJnMSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvT3BlbldpbmRvdyh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCB0b09wZW46IElXaW5kb3dPcGVuYWJsZVtdLCBvcHRpb25zOiBJT3BlbldpbmRvd09wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRvT3Blbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRhd2FpdCB0aGlzLndpbmRvd3NNYWluU2VydmljZS5vcGVuKHtcblx0XHRcdFx0Y29udGV4dDogT3BlbkNvbnRleHQuQVBJLFxuXHRcdFx0XHRjb250ZXh0V2luZG93SWQ6IHdpbmRvd0lkLFxuXHRcdFx0XHR1cmlzVG9PcGVuOiB0b09wZW4sXG5cdFx0XHRcdGNsaTogdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFyZ3MsXG5cdFx0XHRcdGZvcmNlTmV3V2luZG93OiBvcHRpb25zLmZvcmNlTmV3V2luZG93LFxuXHRcdFx0XHRmb3JjZVJldXNlV2luZG93OiBvcHRpb25zLmZvcmNlUmV1c2VXaW5kb3csXG5cdFx0XHRcdHByZWZlck5ld1dpbmRvdzogb3B0aW9ucy5wcmVmZXJOZXdXaW5kb3csXG5cdFx0XHRcdGRpZmZNb2RlOiBvcHRpb25zLmRpZmZNb2RlLFxuXHRcdFx0XHRtZXJnZU1vZGU6IG9wdGlvbnMubWVyZ2VNb2RlLFxuXHRcdFx0XHRhZGRNb2RlOiBvcHRpb25zLmFkZE1vZGUsXG5cdFx0XHRcdHJlbW92ZU1vZGU6IG9wdGlvbnMucmVtb3ZlTW9kZSxcblx0XHRcdFx0Z290b0xpbmVNb2RlOiBvcHRpb25zLmdvdG9MaW5lTW9kZSxcblx0XHRcdFx0bm9SZWNlbnRFbnRyeTogb3B0aW9ucy5ub1JlY2VudEVudHJ5LFxuXHRcdFx0XHR3YWl0TWFya2VyRmlsZVVSSTogb3B0aW9ucy53YWl0TWFya2VyRmlsZVVSSSxcblx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBvcHRpb25zLnJlbW90ZUF1dGhvcml0eSB8fCB1bmRlZmluZWQsXG5cdFx0XHRcdGZvcmNlUHJvZmlsZTogb3B0aW9ucy5mb3JjZVByb2ZpbGUsXG5cdFx0XHRcdGZvcmNlVGVtcFByb2ZpbGU6IG9wdGlvbnMuZm9yY2VUZW1wUHJvZmlsZSxcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9PcGVuRW1wdHlXaW5kb3cod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgb3B0aW9ucz86IElPcGVuRW1wdHlXaW5kb3dPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub3BlbkVtcHR5V2luZG93KHtcblx0XHRcdGNvbnRleHQ6IE9wZW5Db250ZXh0LkFQSSxcblx0XHRcdGNvbnRleHRXaW5kb3dJZDogd2luZG93SWRcblx0XHR9LCBvcHRpb25zKTtcblx0fVxuXG5cdGFzeW5jIGlzRnVsbFNjcmVlbih3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogSU5hdGl2ZUhvc3RPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy53aW5kb3dCeUlkKG9wdGlvbnM/LnRhcmdldFdpbmRvd0lkLCB3aW5kb3dJZCk7XG5cdFx0cmV0dXJuIHdpbmRvdz8uaXNGdWxsU2NyZWVuID8/IGZhbHNlO1xuXHR9XG5cblx0YXN5bmMgdG9nZ2xlRnVsbFNjcmVlbih3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogSU5hdGl2ZUhvc3RPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy53aW5kb3dCeUlkKG9wdGlvbnM/LnRhcmdldFdpbmRvd0lkLCB3aW5kb3dJZCk7XG5cdFx0d2luZG93Py50b2dnbGVGdWxsU2NyZWVuKCk7XG5cdH1cblxuXHRhc3luYyBnZXRDdXJzb3JTY3JlZW5Qb2ludCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx7IHJlYWRvbmx5IHBvaW50OiBJUG9pbnQ7IHJlYWRvbmx5IGRpc3BsYXk6IElSZWN0YW5nbGUgfT4ge1xuXHRcdGNvbnN0IHBvaW50ID0gc2NyZWVuLmdldEN1cnNvclNjcmVlblBvaW50KCk7XG5cdFx0Y29uc3QgZGlzcGxheSA9IHNjcmVlbi5nZXREaXNwbGF5TmVhcmVzdFBvaW50KHBvaW50KTtcblxuXHRcdHJldHVybiB7IHBvaW50LCBkaXNwbGF5OiBkaXNwbGF5LmJvdW5kcyB9O1xuXHR9XG5cblx0YXN5bmMgaXNNYXhpbWl6ZWQod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgb3B0aW9ucz86IElOYXRpdmVIb3N0T3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHdpbmRvdyA9IHRoaXMud2luZG93QnlJZChvcHRpb25zPy50YXJnZXRXaW5kb3dJZCwgd2luZG93SWQpO1xuXHRcdHJldHVybiB3aW5kb3c/Lndpbj8uaXNNYXhpbWl6ZWQoKSA/PyBmYWxzZTtcblx0fVxuXG5cdGFzeW5jIG1heGltaXplV2luZG93KHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIG9wdGlvbnM/OiBJTmF0aXZlSG9zdE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd0J5SWQob3B0aW9ucz8udGFyZ2V0V2luZG93SWQsIHdpbmRvd0lkKTtcblx0XHR3aW5kb3c/Lndpbj8ubWF4aW1pemUoKTtcblx0fVxuXG5cdGFzeW5jIHVubWF4aW1pemVXaW5kb3cod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgb3B0aW9ucz86IElOYXRpdmVIb3N0T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdpbmRvdyA9IHRoaXMud2luZG93QnlJZChvcHRpb25zPy50YXJnZXRXaW5kb3dJZCwgd2luZG93SWQpO1xuXHRcdHdpbmRvdz8ud2luPy51bm1heGltaXplKCk7XG5cdH1cblxuXHRhc3luYyBtaW5pbWl6ZVdpbmRvdyh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogSU5hdGl2ZUhvc3RPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy53aW5kb3dCeUlkKG9wdGlvbnM/LnRhcmdldFdpbmRvd0lkLCB3aW5kb3dJZCk7XG5cdFx0d2luZG93Py53aW4/Lm1pbmltaXplKCk7XG5cdH1cblxuXHRhc3luYyBtb3ZlV2luZG93VG9wKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIG9wdGlvbnM/OiBJTmF0aXZlSG9zdE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd0J5SWQob3B0aW9ucz8udGFyZ2V0V2luZG93SWQsIHdpbmRvd0lkKTtcblx0XHR3aW5kb3c/Lndpbj8ubW92ZVRvcCgpO1xuXHR9XG5cblx0YXN5bmMgcG9zaXRpb25XaW5kb3cod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgcG9zaXRpb246IElSZWN0YW5nbGUsIG9wdGlvbnM/OiBJTmF0aXZlSG9zdE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd0J5SWQob3B0aW9ucz8udGFyZ2V0V2luZG93SWQsIHdpbmRvd0lkKTtcblx0XHRpZiAod2luZG93Py53aW4pIHtcblx0XHRcdGlmICh3aW5kb3cud2luLmlzRnVsbFNjcmVlbigpKSB7XG5cdFx0XHRcdGNvbnN0IGZ1bGxzY3JlZW5MZWZ0RnV0dXJlID0gRXZlbnQudG9Qcm9taXNlKEV2ZW50Lm9uY2UoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXIod2luZG93LndpbiwgJ2xlYXZlLWZ1bGwtc2NyZWVuJykpKTtcblx0XHRcdFx0d2luZG93Lndpbi5zZXRGdWxsU2NyZWVuKGZhbHNlKTtcblx0XHRcdFx0YXdhaXQgZnVsbHNjcmVlbkxlZnRGdXR1cmU7XG5cdFx0XHR9XG5cblx0XHRcdHdpbmRvdy53aW4uc2V0Qm91bmRzKHBvc2l0aW9uKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyB1cGRhdGVXaW5kb3dDb250cm9scyh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zOiBJTmF0aXZlSG9zdE9wdGlvbnMgJiB7IGhlaWdodD86IG51bWJlcjsgYmFja2dyb3VuZENvbG9yPzogc3RyaW5nOyBmb3JlZ3JvdW5kQ29sb3I/OiBzdHJpbmcgfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdpbmRvdyA9IHRoaXMud2luZG93QnlJZChvcHRpb25zPy50YXJnZXRXaW5kb3dJZCwgd2luZG93SWQpO1xuXHRcdHdpbmRvdz8udXBkYXRlV2luZG93Q29udHJvbHMob3B0aW9ucyk7XG5cdH1cblxuXHRhc3luYyBmb2N1c1dpbmRvdyh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogSU5hdGl2ZUhvc3RPcHRpb25zICYgeyBmb3JjZT86IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdpbmRvdyA9IHRoaXMud2luZG93QnlJZChvcHRpb25zPy50YXJnZXRXaW5kb3dJZCwgd2luZG93SWQpO1xuXHRcdHdpbmRvdz8uZm9jdXMoeyBmb3JjZTogb3B0aW9ucz8uZm9yY2UgPz8gZmFsc2UgfSk7XG5cdH1cblxuXHRhc3luYyBzZXRNaW5pbXVtU2l6ZSh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCB3aWR0aDogbnVtYmVyIHwgdW5kZWZpbmVkLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdpbmRvdyA9IHRoaXMuY29kZVdpbmRvd0J5SWQod2luZG93SWQpO1xuXHRcdGlmICh3aW5kb3c/Lndpbikge1xuXHRcdFx0Y29uc3QgW3dpbmRvd1dpZHRoLCB3aW5kb3dIZWlnaHRdID0gd2luZG93Lndpbi5nZXRTaXplKCk7XG5cdFx0XHRjb25zdCBbbWluV2luZG93V2lkdGgsIG1pbldpbmRvd0hlaWdodF0gPSB3aW5kb3cud2luLmdldE1pbmltdW1TaXplKCk7XG5cdFx0XHRjb25zdCBbbmV3TWluV2luZG93V2lkdGgsIG5ld01pbldpbmRvd0hlaWdodF0gPSBbd2lkdGggPz8gbWluV2luZG93V2lkdGgsIGhlaWdodCA/PyBtaW5XaW5kb3dIZWlnaHRdO1xuXHRcdFx0Y29uc3QgW25ld1dpbmRvd1dpZHRoLCBuZXdXaW5kb3dIZWlnaHRdID0gW01hdGgubWF4KHdpbmRvd1dpZHRoLCBuZXdNaW5XaW5kb3dXaWR0aCksIE1hdGgubWF4KHdpbmRvd0hlaWdodCwgbmV3TWluV2luZG93SGVpZ2h0KV07XG5cblx0XHRcdGlmIChtaW5XaW5kb3dXaWR0aCAhPT0gbmV3TWluV2luZG93V2lkdGggfHwgbWluV2luZG93SGVpZ2h0ICE9PSBuZXdNaW5XaW5kb3dIZWlnaHQpIHtcblx0XHRcdFx0d2luZG93Lndpbi5zZXRNaW5pbXVtU2l6ZShuZXdNaW5XaW5kb3dXaWR0aCwgbmV3TWluV2luZG93SGVpZ2h0KTtcblx0XHRcdH1cblx0XHRcdGlmICh3aW5kb3dXaWR0aCAhPT0gbmV3V2luZG93V2lkdGggfHwgd2luZG93SGVpZ2h0ICE9PSBuZXdXaW5kb3dIZWlnaHQpIHtcblx0XHRcdFx0d2luZG93Lndpbi5zZXRTaXplKG5ld1dpbmRvd1dpZHRoLCBuZXdXaW5kb3dIZWlnaHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNhdmVXaW5kb3dTcGxhc2god2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgc3BsYXNoOiBJUGFydHNTcGxhc2gpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLmNvZGVXaW5kb3dCeUlkKHdpbmRvd0lkKTtcblxuXHRcdHRoaXMudGhlbWVNYWluU2VydmljZS5zYXZlV2luZG93U3BsYXNoKHdpbmRvd0lkLCB3aW5kb3c/Lm9wZW5lZFdvcmtzcGFjZSwgc3BsYXNoKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cblx0Ly8jcmVnaW9uIG1hY09TIFNoZWxsIENvbW1hbmRcblxuXHRhc3luYyBpbnN0YWxsU2hlbGxDb21tYW5kKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB7IHNvdXJjZSwgdGFyZ2V0IH0gPSBhd2FpdCB0aGlzLmdldFNoZWxsQ29tbWFuZExpbmsoKTtcblxuXHRcdC8vIE9ubHkgaW5zdGFsbCB1bmxlc3MgYWxyZWFkeSBleGlzdGluZ1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB7IHN5bWJvbGljTGluayB9ID0gYXdhaXQgU3ltbGlua1N1cHBvcnQuc3RhdChzb3VyY2UpO1xuXHRcdFx0aWYgKHN5bWJvbGljTGluayAmJiAhc3ltYm9saWNMaW5rLmRhbmdsaW5nKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmtUYXJnZXRSZWFsUGF0aCA9IGF3YWl0IHJlYWxwYXRoKHNvdXJjZSk7XG5cdFx0XHRcdGlmICh0YXJnZXQgPT09IGxpbmtUYXJnZXRSZWFsUGF0aCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBEaWZmZXJlbnQgc291cmNlLCBkZWxldGUgaXQgZmlyc3Rcblx0XHRcdGF3YWl0IGZzLnByb21pc2VzLnVubGluayhzb3VyY2UpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAoZXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcpIHtcblx0XHRcdFx0dGhyb3cgZXJyb3I7IC8vIHRocm93IG9uIGFueSBlcnJvciBidXQgZmlsZSBub3QgZm91bmRcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgZnMucHJvbWlzZXMuc3ltbGluayh0YXJnZXQsIHNvdXJjZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmIChlcnJvci5jb2RlICE9PSAnRUFDQ0VTJyAmJiBlcnJvci5jb2RlICE9PSAnRU5PRU5UJykge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgeyByZXNwb25zZSB9ID0gYXdhaXQgdGhpcy5zaG93TWVzc2FnZUJveCh3aW5kb3dJZCwge1xuXHRcdFx0XHR0eXBlOiAnaW5mbycsXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd3YXJuRXNjYWxhdGlvbicsIFwiezB9IHdpbGwgbm93IHByb21wdCB3aXRoICdvc2FzY3JpcHQnIGZvciBBZG1pbmlzdHJhdG9yIHByaXZpbGVnZXMgdG8gaW5zdGFsbCB0aGUgc2hlbGwgY29tbWFuZC5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lU2hvcnQpLFxuXHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICdvaycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk9LXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCdjYW5jZWwnLCBcIkNhbmNlbFwiKVxuXHRcdFx0XHRdXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHJlc3BvbnNlID09PSAxIC8qIENhbmNlbCAqLykge1xuXHRcdFx0XHR0aHJvdyBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IGBvc2FzY3JpcHQgLWUgXCJkbyBzaGVsbCBzY3JpcHQgXFxcXFwibWtkaXIgLXAgL3Vzci9sb2NhbC9iaW4gJiYgbG4gLXNmIFxcJyR7dGFyZ2V0fVxcJyBcXCcke3NvdXJjZX1cXCdcXFxcXCIgd2l0aCBhZG1pbmlzdHJhdG9yIHByaXZpbGVnZXNcImA7XG5cdFx0XHRcdGF3YWl0IHByb21pc2lmeShleGVjKShjb21tYW5kKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnY2FudENyZWF0ZUJpbkZvbGRlcicsIFwiVW5hYmxlIHRvIGluc3RhbGwgdGhlIHNoZWxsIGNvbW1hbmQgJ3swfScuXCIsIHNvdXJjZSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHVuaW5zdGFsbFNoZWxsQ29tbWFuZCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgeyBzb3VyY2UgfSA9IGF3YWl0IHRoaXMuZ2V0U2hlbGxDb21tYW5kTGluaygpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IGZzLnByb21pc2VzLnVubGluayhzb3VyY2UpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRzd2l0Y2ggKGVycm9yLmNvZGUpIHtcblx0XHRcdFx0Y2FzZSAnRUFDQ0VTJzoge1xuXHRcdFx0XHRcdGNvbnN0IHsgcmVzcG9uc2UgfSA9IGF3YWl0IHRoaXMuc2hvd01lc3NhZ2VCb3god2luZG93SWQsIHtcblx0XHRcdFx0XHRcdHR5cGU6ICdpbmZvJyxcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd3YXJuRXNjYWxhdGlvblVuaW5zdGFsbCcsIFwiezB9IHdpbGwgbm93IHByb21wdCB3aXRoICdvc2FzY3JpcHQnIGZvciBBZG1pbmlzdHJhdG9yIHByaXZpbGVnZXMgdG8gdW5pbnN0YWxsIHRoZSBzaGVsbCBjb21tYW5kLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydCksXG5cdFx0XHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0XHRcdGxvY2FsaXplKHsga2V5OiAnb2snLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZPS1wiKSxcblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2NhbmNlbCcsIFwiQ2FuY2VsXCIpXG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRpZiAocmVzcG9uc2UgPT09IDEgLyogQ2FuY2VsICovKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0Y29uc3QgY29tbWFuZCA9IGBvc2FzY3JpcHQgLWUgXCJkbyBzaGVsbCBzY3JpcHQgXFxcXFwicm0gXFwnJHtzb3VyY2V9XFwnXFxcXFwiIHdpdGggYWRtaW5pc3RyYXRvciBwcml2aWxlZ2VzXCJgO1xuXHRcdFx0XHRcdFx0YXdhaXQgcHJvbWlzaWZ5KGV4ZWMpKGNvbW1hbmQpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ2NhbnRVbmluc3RhbGwnLCBcIlVuYWJsZSB0byB1bmluc3RhbGwgdGhlIHNoZWxsIGNvbW1hbmQgJ3swfScuXCIsIHNvdXJjZSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdFTk9FTlQnOlxuXHRcdFx0XHRcdGJyZWFrOyAvLyBpZ25vcmUgZmlsZSBub3QgZm91bmRcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFNoZWxsQ29tbWFuZExpbmsoKTogUHJvbWlzZTx7IHJlYWRvbmx5IHNvdXJjZTogc3RyaW5nOyByZWFkb25seSB0YXJnZXQ6IHN0cmluZyB9PiB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gcmVzb2x2ZSh0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXBwUm9vdCwgJ2JpbicsICdjb2RlJyk7XG5cdFx0Y29uc3Qgc291cmNlID0gYC91c3IvbG9jYWwvYmluLyR7dGhpcy5wcm9kdWN0U2VydmljZS5hcHBsaWNhdGlvbk5hbWV9YDtcblxuXHRcdC8vIEVuc3VyZSBzb3VyY2UgZXhpc3RzXG5cdFx0Y29uc3Qgc291cmNlRXhpc3RzID0gYXdhaXQgUHJvbWlzZXMuZXhpc3RzKHRhcmdldCk7XG5cdFx0aWYgKCFzb3VyY2VFeGlzdHMpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnc291cmNlTWlzc2luZycsIFwiVW5hYmxlIHRvIGZpbmQgc2hlbGwgc2NyaXB0IGluICd7MH0nXCIsIHRhcmdldCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IHNvdXJjZSwgdGFyZ2V0IH07XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gRGlhbG9nXG5cblx0YXN5bmMgc2hvd01lc3NhZ2VCb3god2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgb3B0aW9uczogTWVzc2FnZUJveE9wdGlvbnMgJiBJTmF0aXZlSG9zdE9wdGlvbnMpOiBQcm9taXNlPE1lc3NhZ2VCb3hSZXR1cm5WYWx1ZT4ge1xuXHRcdGNvbnN0IHdpbmRvdyA9IHRoaXMud2luZG93QnlJZChvcHRpb25zPy50YXJnZXRXaW5kb3dJZCwgd2luZG93SWQpO1xuXHRcdHJldHVybiB0aGlzLmRpYWxvZ01haW5TZXJ2aWNlLnNob3dNZXNzYWdlQm94KG9wdGlvbnMsIHdpbmRvdz8ud2luID8/IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRhc3luYyBzaG93U2F2ZURpYWxvZyh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zOiBTYXZlRGlhbG9nT3B0aW9ucyAmIElOYXRpdmVIb3N0T3B0aW9ucyk6IFByb21pc2U8U2F2ZURpYWxvZ1JldHVyblZhbHVlPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy53aW5kb3dCeUlkKG9wdGlvbnM/LnRhcmdldFdpbmRvd0lkLCB3aW5kb3dJZCk7XG5cdFx0cmV0dXJuIHRoaXMuZGlhbG9nTWFpblNlcnZpY2Uuc2hvd1NhdmVEaWFsb2cob3B0aW9ucywgd2luZG93Py53aW4gPz8gdW5kZWZpbmVkKTtcblx0fVxuXG5cdGFzeW5jIHNob3dPcGVuRGlhbG9nKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIG9wdGlvbnM6IE9wZW5EaWFsb2dPcHRpb25zICYgSU5hdGl2ZUhvc3RPcHRpb25zKTogUHJvbWlzZTxPcGVuRGlhbG9nUmV0dXJuVmFsdWU+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd0J5SWQob3B0aW9ucz8udGFyZ2V0V2luZG93SWQsIHdpbmRvd0lkKTtcblx0XHRyZXR1cm4gdGhpcy5kaWFsb2dNYWluU2VydmljZS5zaG93T3BlbkRpYWxvZyhvcHRpb25zLCB3aW5kb3c/LndpbiA/PyB1bmRlZmluZWQpO1xuXHR9XG5cblx0YXN5bmMgcGlja0ZpbGVGb2xkZXJBbmRPcGVuKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIG9wdGlvbnM6IElOYXRpdmVPcGVuRGlhbG9nT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHBhdGhzID0gYXdhaXQgdGhpcy5kaWFsb2dNYWluU2VydmljZS5waWNrRmlsZUZvbGRlcihvcHRpb25zKTtcblx0XHRpZiAocGF0aHMpIHtcblx0XHRcdGF3YWl0IHRoaXMuZG9PcGVuUGlja2VkKGF3YWl0IFByb21pc2UuYWxsKHBhdGhzLm1hcChhc3luYyBwYXRoID0+IChhd2FpdCBTeW1saW5rU3VwcG9ydC5leGlzdHNEaXJlY3RvcnkocGF0aCkpID8geyBmb2xkZXJVcmk6IFVSSS5maWxlKHBhdGgpIH0gOiB7IGZpbGVVcmk6IFVSSS5maWxlKHBhdGgpIH0pKSwgb3B0aW9ucywgd2luZG93SWQpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHBpY2tGb2xkZXJBbmRPcGVuKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIG9wdGlvbnM6IElOYXRpdmVPcGVuRGlhbG9nT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHBhdGhzID0gYXdhaXQgdGhpcy5kaWFsb2dNYWluU2VydmljZS5waWNrRm9sZGVyKG9wdGlvbnMpO1xuXHRcdGlmIChwYXRocykge1xuXHRcdFx0YXdhaXQgdGhpcy5kb09wZW5QaWNrZWQocGF0aHMubWFwKHBhdGggPT4gKHsgZm9sZGVyVXJpOiBVUkkuZmlsZShwYXRoKSB9KSksIG9wdGlvbnMsIHdpbmRvd0lkKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBwaWNrRmlsZUFuZE9wZW4od2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgb3B0aW9uczogSU5hdGl2ZU9wZW5EaWFsb2dPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcGF0aHMgPSBhd2FpdCB0aGlzLmRpYWxvZ01haW5TZXJ2aWNlLnBpY2tGaWxlKG9wdGlvbnMpO1xuXHRcdGlmIChwYXRocykge1xuXHRcdFx0YXdhaXQgdGhpcy5kb09wZW5QaWNrZWQocGF0aHMubWFwKHBhdGggPT4gKHsgZmlsZVVyaTogVVJJLmZpbGUocGF0aCkgfSkpLCBvcHRpb25zLCB3aW5kb3dJZCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcGlja1dvcmtzcGFjZUFuZE9wZW4od2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgb3B0aW9uczogSU5hdGl2ZU9wZW5EaWFsb2dPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcGF0aHMgPSBhd2FpdCB0aGlzLmRpYWxvZ01haW5TZXJ2aWNlLnBpY2tXb3Jrc3BhY2Uob3B0aW9ucyk7XG5cdFx0aWYgKHBhdGhzKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRvT3BlblBpY2tlZChwYXRocy5tYXAocGF0aCA9PiAoeyB3b3Jrc3BhY2VVcmk6IFVSSS5maWxlKHBhdGgpIH0pKSwgb3B0aW9ucywgd2luZG93SWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9PcGVuUGlja2VkKG9wZW5hYmxlOiBJV2luZG93T3BlbmFibGVbXSwgb3B0aW9uczogSU5hdGl2ZU9wZW5EaWFsb2dPcHRpb25zLCB3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub3Blbih7XG5cdFx0XHRjb250ZXh0OiBPcGVuQ29udGV4dC5ESUFMT0csXG5cdFx0XHRjb250ZXh0V2luZG93SWQ6IHdpbmRvd0lkLFxuXHRcdFx0Y2xpOiB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXJncyxcblx0XHRcdHVyaXNUb09wZW46IG9wZW5hYmxlLFxuXHRcdFx0Zm9yY2VOZXdXaW5kb3c6IG9wdGlvbnMuZm9yY2VOZXdXaW5kb3csXG5cdFx0XHQvKiByZW1vdGVBdXRob3JpdHkgd2lsbCBiZSBkZXRlcm1pbmVkIGJhc2VkIG9uIG9wZW5hYmxlICovXG5cdFx0fSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXG5cdC8vI3JlZ2lvbiBPU1xuXG5cdGFzeW5jIHNob3dJdGVtSW5Gb2xkZXIod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgcGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0c2hlbGwuc2hvd0l0ZW1JbkZvbGRlcihwYXRoKTtcblx0fVxuXG5cdGFzeW5jIHNldFJlcHJlc2VudGVkRmlsZW5hbWUod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgcGF0aDogc3RyaW5nLCBvcHRpb25zPzogSU5hdGl2ZUhvc3RPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy53aW5kb3dCeUlkKG9wdGlvbnM/LnRhcmdldFdpbmRvd0lkLCB3aW5kb3dJZCk7XG5cdFx0d2luZG93Py5zZXRSZXByZXNlbnRlZEZpbGVuYW1lKHBhdGgpO1xuXHR9XG5cblx0YXN5bmMgc2V0RG9jdW1lbnRFZGl0ZWQod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgZWRpdGVkOiBib29sZWFuLCBvcHRpb25zPzogSU5hdGl2ZUhvc3RPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy53aW5kb3dCeUlkKG9wdGlvbnM/LnRhcmdldFdpbmRvd0lkLCB3aW5kb3dJZCk7XG5cdFx0d2luZG93Py5zZXREb2N1bWVudEVkaXRlZChlZGl0ZWQpO1xuXHR9XG5cblx0YXN5bmMgb3BlbkV4dGVybmFsKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIHVybDogc3RyaW5nLCBkZWZhdWx0QXBwbGljYXRpb24/OiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHR0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UudW5zZXRTbmFwRXhwb3J0ZWRWYXJpYWJsZXMoKTtcblx0XHR0cnkge1xuXHRcdFx0aWYgKG1hdGNoZXNTb21lU2NoZW1lKHVybCwgU2NoZW1hcy5odHRwLCBTY2hlbWFzLmh0dHBzKSkge1xuXHRcdFx0XHR0aGlzLm9wZW5FeHRlcm5hbEJyb3dzZXIodXJsLCBkZWZhdWx0QXBwbGljYXRpb24pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2hlbGwub3BlbkV4dGVybmFsKHVybCk7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5yZXN0b3JlU25hcEV4cG9ydGVkVmFyaWFibGVzKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW5FeHRlcm5hbEJyb3dzZXIodXJsOiBzdHJpbmcsIGRlZmF1bHRBcHBsaWNhdGlvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyZWRCcm93c2VyID0gZGVmYXVsdEFwcGxpY2F0aW9uID8/IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPignd29ya2JlbmNoLmV4dGVybmFsQnJvd3NlcicpO1xuXHRcdGlmICghY29uZmlndXJlZEJyb3dzZXIpIHtcblx0XHRcdHJldHVybiBzaGVsbC5vcGVuRXh0ZXJuYWwodXJsKTtcblx0XHR9XG5cblx0XHRpZiAoY29uZmlndXJlZEJyb3dzZXIuaW5jbHVkZXMocG9zaXguc2VwKSB8fCBjb25maWd1cmVkQnJvd3Nlci5pbmNsdWRlcyh3aW4zMi5zZXApKSB7XG5cdFx0XHRjb25zdCBicm93c2VyUGF0aEV4aXN0cyA9IGF3YWl0IFByb21pc2VzLmV4aXN0cyhjb25maWd1cmVkQnJvd3Nlcik7XG5cdFx0XHRpZiAoIWJyb3dzZXJQYXRoRXhpc3RzKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgQ29uZmlndXJlZCBleHRlcm5hbCBicm93c2VyIHBhdGggZG9lcyBub3QgZXhpc3Q6ICR7Y29uZmlndXJlZEJyb3dzZXJ9YCk7XG5cdFx0XHRcdHJldHVybiBzaGVsbC5vcGVuRXh0ZXJuYWwodXJsKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgeyBkZWZhdWx0OiBvcGVuIH0gPSBhd2FpdCBpbXBvcnQoJ29wZW4nKTtcblx0XHRcdGNvbnN0IHJlcyA9IGF3YWl0IG9wZW4odXJsLCB7XG5cdFx0XHRcdGFwcDoge1xuXHRcdFx0XHRcdC8vIFVzZSBgb3Blbi5hcHBzYCBoZWxwZXIgdG8gYWxsb3cgY3Jvc3MtcGxhdGZvcm0gYnJvd3NlclxuXHRcdFx0XHRcdC8vIGFsaWFzZXMgdG8gYmUgbG9va2VkIHVwIHByb3Blcmx5LiBGYWxsYmFjayB0byB0aGVcblx0XHRcdFx0XHQvLyBjb25maWd1cmVkIHZhbHVlIGlmIG5vdCBmb3VuZC5cblx0XHRcdFx0XHRuYW1lOiBPYmplY3QuaGFzT3duKG9wZW4uYXBwcywgY29uZmlndXJlZEJyb3dzZXIpID8gb3Blbi5hcHBzWyhjb25maWd1cmVkQnJvd3NlciBhcyBrZXlvZiB0eXBlb2Ygb3BlblsnYXBwcyddKV0gOiBjb25maWd1cmVkQnJvd3NlclxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCFpc1dpbmRvd3MpIHtcblx0XHRcdFx0Ly8gT24gTGludXgvbWFjT1MsIGxpc3RlbiB0byBzdGRlcnIgYW5kIHRyZWF0IHRoYXQgYXMgZmFpbHVyZVxuXHRcdFx0XHQvLyBmb3Igb3BlbmluZyB0aGUgYnJvd3NlciB0byBmYWxsYmFjayB0byB0aGUgZGVmYXVsdC5cblx0XHRcdFx0Ly8gT24gV2luZG93cywgdW5mb3J0dW5hdGVseSBQb3dlclNoZWxsIHNlZW1zIHRvIGFsd2F5cyB3cml0ZVxuXHRcdFx0XHQvLyB0byBzdGRlcnIgc28gd2UgY2Fubm90IHVzZSBpdCB0aGVyZVxuXHRcdFx0XHQvLyAoc2VlIGFsc28gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIzMDYzNilcblx0XHRcdFx0cmVzLnN0ZGVycj8ub25jZSgnZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIG9wZW5lbmluZyBleHRlcm5hbCBVUkwgJyR7dXJsfScgdXNpbmcgYnJvd3NlciAnJHtjb25maWd1cmVkQnJvd3Nlcn0nOiAke2RhdGEudG9TdHJpbmcoKX1gKTtcblx0XHRcdFx0XHRyZXR1cm4gc2hlbGwub3BlbkV4dGVybmFsKHVybCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFVuYWJsZSB0byBvcGVuIGV4dGVybmFsIFVSTCAnJHt1cmx9JyB1c2luZyBicm93c2VyICcke2NvbmZpZ3VyZWRCcm93c2VyfScgZHVlIHRvICR7ZXJyb3J9LmApO1xuXHRcdFx0cmV0dXJuIHNoZWxsLm9wZW5FeHRlcm5hbCh1cmwpO1xuXHRcdH1cblx0fVxuXG5cdG1vdmVJdGVtVG9UcmFzaCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBmdWxsUGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHNoZWxsLnRyYXNoSXRlbShmdWxsUGF0aCk7XG5cdH1cblxuXHRhc3luYyBpc0FkbWluKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGxldCBpc0FkbWluOiBib29sZWFuO1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGlzQWRtaW4gPSAoYXdhaXQgaW1wb3J0KCduYXRpdmUtaXMtZWxldmF0ZWQnKSkuZGVmYXVsdCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpc0FkbWluID0gcHJvY2Vzcy5nZXR1aWQ/LigpID09PSAwO1xuXHRcdH1cblxuXHRcdHJldHVybiBpc0FkbWluO1xuXHR9XG5cblx0YXN5bmMgd3JpdGVFbGV2YXRlZCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkksIG9wdGlvbnM/OiB7IHVubG9jaz86IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHN1ZG9Qcm9tcHQgPSBhd2FpdCBpbXBvcnQoJ0B2c2NvZGUvc3Vkby1wcm9tcHQnKTtcblxuXHRcdGNvbnN0IGFyZ3NGaWxlID0gcmFuZG9tUGF0aCh0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UudXNlckRhdGFQYXRoLCAnY29kZS1lbGV2YXRlZCcpO1xuXHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShhcmdzRmlsZSwgSlNPTi5zdHJpbmdpZnkoeyBzb3VyY2U6IHNvdXJjZS5mc1BhdGgsIHRhcmdldDogdGFyZ2V0LmZzUGF0aCB9KSk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRjb25zdCBzdWRvQ29tbWFuZDogc3RyaW5nW10gPSBbYFwiJHt0aGlzLmNsaVBhdGh9XCJgXTtcblx0XHRcdFx0aWYgKG9wdGlvbnM/LnVubG9jaykge1xuXHRcdFx0XHRcdHN1ZG9Db21tYW5kLnB1c2goJy0tZmlsZS1jaG1vZCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3Vkb0NvbW1hbmQucHVzaCgnLS1maWxlLXdyaXRlJywgYFwiJHthcmdzRmlsZX1cImApO1xuXG5cdFx0XHRcdGNvbnN0IHByb21wdE9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0bmFtZTogdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZy5yZXBsYWNlKCctJywgJycpLFxuXHRcdFx0XHRcdGljbnM6IChpc01hY2ludG9zaCAmJiB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuaXNCdWlsdCkgPyBqb2luKGRpcm5hbWUodGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFwcFJvb3QpLCBgJHt0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydH0uaWNuc2ApIDogdW5kZWZpbmVkXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbc3Vkby1wcm9tcHRdIHJ1bm5pbmcgY29tbWFuZDogJHtzdWRvQ29tbWFuZC5qb2luKCcgJyl9YCk7XG5cblx0XHRcdFx0c3Vkb1Byb21wdC5leGVjKHN1ZG9Db21tYW5kLmpvaW4oJyAnKSwgcHJvbXB0T3B0aW9ucywgKGVycm9yPywgc3Rkb3V0Pywgc3RkZXJyPykgPT4ge1xuXHRcdFx0XHRcdGlmIChzdGRvdXQpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW3N1ZG8tcHJvbXB0XSByZWNlaXZlZCBzdGRvdXQ6ICR7c3Rkb3V0fWApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChzdGRlcnIpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgW3N1ZG8tcHJvbXB0XSByZWNlaXZlZCBzdGRlcnI6ICR7c3RkZXJyfWApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChlcnJvcikge1xuXHRcdFx0XHRcdFx0cmVqZWN0KGVycm9yKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YXdhaXQgZnMucHJvbWlzZXMudW5saW5rKGFyZ3NGaWxlKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBpc1J1bm5pbmdVbmRlckFSTTY0VHJhbnNsYXRpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKGlzTGludXggfHwgaXNXaW5kb3dzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFwcC5ydW5uaW5nVW5kZXJBUk02NFRyYW5zbGF0aW9uO1xuXHR9XG5cblx0QG1lbW9pemVcblx0cHJpdmF0ZSBnZXQgY2xpUGF0aCgpOiBzdHJpbmcge1xuXG5cdFx0Ly8gV2luZG93c1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGlmICh0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuaXNCdWlsdCkge1xuXHRcdFx0XHRyZXR1cm4gam9pbihkaXJuYW1lKHByb2Nlc3MuZXhlY1BhdGgpLCAnYmluJywgYCR7dGhpcy5wcm9kdWN0U2VydmljZS5hcHBsaWNhdGlvbk5hbWV9LmNtZGApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gam9pbih0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXBwUm9vdCwgJ3NjcmlwdHMnLCAnY29kZS1jbGkuYmF0Jyk7XG5cdFx0fVxuXG5cdFx0Ly8gTGludXhcblx0XHRpZiAoaXNMaW51eCkge1xuXHRcdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5pc0J1aWx0KSB7XG5cdFx0XHRcdHJldHVybiBqb2luKGRpcm5hbWUocHJvY2Vzcy5leGVjUGF0aCksICdiaW4nLCBgJHt0aGlzLnByb2R1Y3RTZXJ2aWNlLmFwcGxpY2F0aW9uTmFtZX1gKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGpvaW4odGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFwcFJvb3QsICdzY3JpcHRzJywgJ2NvZGUtY2xpLnNoJyk7XG5cdFx0fVxuXG5cdFx0Ly8gbWFjT1Ncblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmlzQnVpbHQpIHtcblx0XHRcdHJldHVybiBqb2luKHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcHBSb290LCAnYmluJywgJ2NvZGUnKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gam9pbih0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXBwUm9vdCwgJ3NjcmlwdHMnLCAnY29kZS1jbGkuc2gnKTtcblx0fVxuXG5cdGFzeW5jIGdldE9TU3RhdGlzdGljcygpOiBQcm9taXNlPElPU1N0YXRpc3RpY3M+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dG90YWxtZW06IHRvdGFsbWVtKCksXG5cdFx0XHRmcmVlbWVtOiBmcmVlbWVtKCksXG5cdFx0XHRsb2FkYXZnOiBsb2FkYXZnKClcblx0XHR9O1xuXHR9XG5cblx0YXN5bmMgZ2V0T1NQcm9wZXJ0aWVzKCk6IFByb21pc2U8SU9TUHJvcGVydGllcz4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRhcmNoOiBhcmNoKCksXG5cdFx0XHRwbGF0Zm9ybTogcGxhdGZvcm0oKSxcblx0XHRcdHJlbGVhc2U6IHJlbGVhc2UoKSxcblx0XHRcdHR5cGU6IHR5cGUoKSxcblx0XHRcdGNwdXM6IGNwdXMoKVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBnZXRPU1ZpcnR1YWxNYWNoaW5lSGludCgpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdHJldHVybiB2aXJ0dWFsTWFjaGluZUhpbnQudmFsdWUoKTtcblx0fVxuXG5cdGFzeW5jIGdldE9TQ29sb3JTY2hlbWUoKTogUHJvbWlzZTxJQ29sb3JTY2hlbWU+IHtcblx0XHRyZXR1cm4gdGhpcy50aGVtZU1haW5TZXJ2aWNlLmdldENvbG9yU2NoZW1lKCk7XG5cdH1cblxuXHQvLyBXU0xcblx0YXN5bmMgaGFzV1NMRmVhdHVyZUluc3RhbGxlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gaXNXaW5kb3dzICYmIGhhc1dTTEZlYXR1cmVJbnN0YWxsZWQoKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cblx0Ly8jcmVnaW9uIFNjcmVlbnNob3RzXG5cblx0YXN5bmMgZ2V0U2NyZWVuc2hvdCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogSU5hdGl2ZUhvc3RPcHRpb25zKTogUHJvbWlzZTxBcnJheUJ1ZmZlckxpa2UgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd0J5SWQob3B0aW9ucz8udGFyZ2V0V2luZG93SWQsIHdpbmRvd0lkKTtcblx0XHRjb25zdCBjYXB0dXJlZCA9IGF3YWl0IHdpbmRvdz8ud2luPy53ZWJDb250ZW50cy5jYXB0dXJlUGFnZSgpO1xuXG5cdFx0cmV0dXJuIGNhcHR1cmVkPy50b0pQRUcoOTUpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblxuXHQvLyNyZWdpb24gUHJvY2Vzc1xuXG5cdGFzeW5jIGdldFByb2Nlc3NJZCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxudW1iZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd0J5SWQodW5kZWZpbmVkLCB3aW5kb3dJZCk7XG5cdFx0cmV0dXJuIHdpbmRvdz8ud2luPy53ZWJDb250ZW50cy5nZXRPU1Byb2Nlc3NJZCgpO1xuXHR9XG5cblx0YXN5bmMga2lsbFByb2Nlc3Mod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgcGlkOiBudW1iZXIsIGNvZGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHByb2Nlc3Mua2lsbChwaWQsIGNvZGUpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblxuXHQvLyNyZWdpb24gQ2xpcGJvYXJkXG5cblx0YXN5bmMgcmVhZENsaXBib2FyZFRleHQod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgdHlwZT86ICdzZWxlY3Rpb24nIHwgJ2NsaXBib2FyZCcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiBjbGlwYm9hcmQucmVhZFRleHQodHlwZSk7XG5cdH1cblxuXHRhc3luYyByZWFkSW1hZ2UoKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG5cdFx0cmV0dXJuIGNsaXBib2FyZC5yZWFkSW1hZ2UoKS50b1BORygpO1xuXHR9XG5cblx0YXN5bmMgd3JpdGVDbGlwYm9hcmRUZXh0KHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIHRleHQ6IHN0cmluZywgdHlwZT86ICdzZWxlY3Rpb24nIHwgJ2NsaXBib2FyZCcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0LCB0eXBlKTtcblx0fVxuXG5cdGFzeW5jIHJlYWRDbGlwYm9hcmRGaW5kVGV4dCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIGNsaXBib2FyZC5yZWFkRmluZFRleHQoKTtcblx0fVxuXG5cdGFzeW5jIHdyaXRlQ2xpcGJvYXJkRmluZFRleHQod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgdGV4dDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIGNsaXBib2FyZC53cml0ZUZpbmRUZXh0KHRleHQpO1xuXHR9XG5cblx0YXN5bmMgd3JpdGVDbGlwYm9hcmRCdWZmZXIod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgZm9ybWF0OiBzdHJpbmcsIGJ1ZmZlcjogVlNCdWZmZXIsIHR5cGU/OiAnc2VsZWN0aW9uJyB8ICdjbGlwYm9hcmQnKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIGNsaXBib2FyZC53cml0ZUJ1ZmZlcihmb3JtYXQsIEJ1ZmZlci5mcm9tKGJ1ZmZlci5idWZmZXIpLCB0eXBlKTtcblx0fVxuXG5cdGFzeW5jIHJlYWRDbGlwYm9hcmRCdWZmZXIod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgZm9ybWF0OiBzdHJpbmcpOiBQcm9taXNlPFZTQnVmZmVyPiB7XG5cdFx0cmV0dXJuIFZTQnVmZmVyLndyYXAoY2xpcGJvYXJkLnJlYWRCdWZmZXIoZm9ybWF0KSk7XG5cdH1cblxuXHRhc3luYyBoYXNDbGlwYm9hcmQod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgZm9ybWF0OiBzdHJpbmcsIHR5cGU/OiAnc2VsZWN0aW9uJyB8ICdjbGlwYm9hcmQnKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIGNsaXBib2FyZC5oYXMoZm9ybWF0LCB0eXBlKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cblx0Ly8jcmVnaW9uIG1hY09TIFRvdWNoYmFyXG5cblx0YXN5bmMgbmV3V2luZG93VGFiKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMud2luZG93c01haW5TZXJ2aWNlLm9wZW4oe1xuXHRcdFx0Y29udGV4dDogT3BlbkNvbnRleHQuQVBJLFxuXHRcdFx0Y2xpOiB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXJncyxcblx0XHRcdGZvcmNlTmV3VGFiYmVkV2luZG93OiB0cnVlLFxuXHRcdFx0Zm9yY2VFbXB0eTogdHJ1ZSxcblx0XHRcdHJlbW90ZUF1dGhvcml0eTogdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFyZ3MucmVtb3RlIHx8IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgc2hvd1ByZXZpb3VzV2luZG93VGFiKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdE1lbnUuc2VuZEFjdGlvblRvRmlyc3RSZXNwb25kZXIoJ3NlbGVjdFByZXZpb3VzVGFiOicpO1xuXHR9XG5cblx0YXN5bmMgc2hvd05leHRXaW5kb3dUYWIoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0TWVudS5zZW5kQWN0aW9uVG9GaXJzdFJlc3BvbmRlcignc2VsZWN0TmV4dFRhYjonKTtcblx0fVxuXG5cdGFzeW5jIG1vdmVXaW5kb3dUYWJUb05ld1dpbmRvdygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRNZW51LnNlbmRBY3Rpb25Ub0ZpcnN0UmVzcG9uZGVyKCdtb3ZlVGFiVG9OZXdXaW5kb3c6Jyk7XG5cdH1cblxuXHRhc3luYyBtZXJnZUFsbFdpbmRvd1RhYnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0TWVudS5zZW5kQWN0aW9uVG9GaXJzdFJlc3BvbmRlcignbWVyZ2VBbGxXaW5kb3dzOicpO1xuXHR9XG5cblx0YXN5bmMgdG9nZ2xlV2luZG93VGFic0JhcigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRNZW51LnNlbmRBY3Rpb25Ub0ZpcnN0UmVzcG9uZGVyKCd0b2dnbGVUYWJCYXI6Jyk7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVUb3VjaEJhcih3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBpdGVtczogSVNlcmlhbGl6YWJsZUNvbW1hbmRBY3Rpb25bXVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy5jb2RlV2luZG93QnlJZCh3aW5kb3dJZCk7XG5cdFx0d2luZG93Py51cGRhdGVUb3VjaEJhcihpdGVtcyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXG5cdC8vI3JlZ2lvbiBMaWZlY3ljbGVcblxuXHRhc3luYyBub3RpZnlSZWFkeSh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy5jb2RlV2luZG93QnlJZCh3aW5kb3dJZCk7XG5cdFx0d2luZG93Py5zZXRSZWFkeSgpO1xuXHR9XG5cblx0YXN5bmMgcmVsYXVuY2god2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgb3B0aW9ucz86IElSZWxhdW5jaE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5saWZlY3ljbGVNYWluU2VydmljZS5yZWxhdW5jaChvcHRpb25zKTtcblx0fVxuXG5cdGFzeW5jIHJlbG9hZCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogeyBkaXNhYmxlRXh0ZW5zaW9ucz86IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdpbmRvdyA9IHRoaXMuY29kZVdpbmRvd0J5SWQod2luZG93SWQpO1xuXHRcdGlmICh3aW5kb3cpIHtcblxuXHRcdFx0Ly8gU3BlY2lhbCBjYXNlOiBzdXBwb3J0IGB0cmFuc2llbnRgIHdvcmtzcGFjZXMgYnkgcHJldmVudGluZ1xuXHRcdFx0Ly8gdGhlIHJlbG9hZCBhbmQgcmF0aGVyIGdvIGJhY2sgdG8gYW4gZW1wdHkgd2luZG93LiBUcmFuc2llbnRcblx0XHRcdC8vIHdvcmtzcGFjZXMgc2hvdWxkIG5ldmVyIHJlc3RvcmUsIGV2ZW4gd2hlbiB0aGUgdXNlciB3YW50c1xuXHRcdFx0Ly8gdG8gcmVsb2FkLlxuXHRcdFx0Ly8gRm9yOiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTE5Njk1XG5cdFx0XHRpZiAoaXNXb3Jrc3BhY2VJZGVudGlmaWVyKHdpbmRvdy5vcGVuZWRXb3Jrc3BhY2UpKSB7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZ1BhdGggPSB3aW5kb3cub3BlbmVkV29ya3NwYWNlLmNvbmZpZ1BhdGg7XG5cdFx0XHRcdGlmIChjb25maWdQYXRoLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgdGhpcy53b3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlLnJlc29sdmVMb2NhbFdvcmtzcGFjZShjb25maWdQYXRoKTtcblx0XHRcdFx0XHRpZiAod29ya3NwYWNlPy50cmFuc2llbnQpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLm9wZW5XaW5kb3cod2luZG93LmlkLCB7IGZvcmNlUmV1c2VXaW5kb3c6IHRydWUgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFByb2NlZWQgbm9ybWFsbHkgdG8gcmVsb2FkIHRoZSB3aW5kb3dcblx0XHRcdHJldHVybiB0aGlzLmxpZmVjeWNsZU1haW5TZXJ2aWNlLnJlbG9hZCh3aW5kb3csIG9wdGlvbnM/LmRpc2FibGVFeHRlbnNpb25zICE9PSB1bmRlZmluZWQgPyB7IF86IFtdLCAnZGlzYWJsZS1leHRlbnNpb25zJzogb3B0aW9ucy5kaXNhYmxlRXh0ZW5zaW9ucyB9IDogdW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBjbG9zZVdpbmRvdyh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogSU5hdGl2ZUhvc3RPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy53aW5kb3dCeUlkKG9wdGlvbnM/LnRhcmdldFdpbmRvd0lkLCB3aW5kb3dJZCk7XG5cdFx0cmV0dXJuIHdpbmRvdz8ud2luPy5jbG9zZSgpO1xuXHR9XG5cblx0YXN5bmMgcXVpdCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBJZiB0aGUgdXNlciBzZWxlY3RlZCB0byBleGl0IGZyb20gYW4gZXh0ZW5zaW9uIGRldmVsb3BtZW50IGhvc3Qgd2luZG93LCBkbyBub3QgcXVpdCwgYnV0IGp1c3Rcblx0XHQvLyBjbG9zZSB0aGUgd2luZG93IHVubGVzcyB0aGlzIGlzIHRoZSBsYXN0IHdpbmRvdyB0aGF0IGlzIG9wZW5lZC5cblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRMYXN0QWN0aXZlV2luZG93KCk7XG5cdFx0aWYgKHdpbmRvdz8uaXNFeHRlbnNpb25EZXZlbG9wbWVudEhvc3QgJiYgdGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0V2luZG93Q291bnQoKSA+IDEgJiYgd2luZG93Lndpbikge1xuXHRcdFx0d2luZG93Lndpbi5jbG9zZSgpO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZTogbm9ybWFsIHF1aXRcblx0XHRlbHNlIHtcblx0XHRcdHRoaXMubGlmZWN5Y2xlTWFpblNlcnZpY2UucXVpdCgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGV4aXQod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgY29kZTogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5saWZlY3ljbGVNYWluU2VydmljZS5raWxsKGNvZGUpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblxuXHQvLyNyZWdpb24gQ29ubmVjdGl2aXR5XG5cblx0YXN5bmMgcmVzb2x2ZVByb3h5KHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLmNvZGVXaW5kb3dCeUlkKHdpbmRvd0lkKTtcblx0XHRjb25zdCBzZXNzaW9uID0gd2luZG93Py53aW4/LndlYkNvbnRlbnRzPy5zZXNzaW9uO1xuXG5cdFx0cmV0dXJuIHNlc3Npb24/LnJlc29sdmVQcm94eSh1cmwpO1xuXHR9XG5cblx0YXN5bmMgbG9va3VwQXV0aG9yaXphdGlvbihfd2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgYXV0aEluZm86IEF1dGhJbmZvKTogUHJvbWlzZTxDcmVkZW50aWFscyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLnByb3h5QXV0aFNlcnZpY2UubG9va3VwQXV0aG9yaXphdGlvbihhdXRoSW5mbyk7XG5cdH1cblxuXHRhc3luYyBsb29rdXBLZXJiZXJvc0F1dGhvcml6YXRpb24oX3dpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0U2VydmljZS5sb29rdXBLZXJiZXJvc0F1dGhvcml6YXRpb24odXJsKTtcblx0fVxuXG5cdGFzeW5jIGxvYWRDZXJ0aWZpY2F0ZXMoX3dpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG5cdFx0cmV0dXJuIHRoaXMucmVxdWVzdFNlcnZpY2UubG9hZENlcnRpZmljYXRlcygpO1xuXHR9XG5cblx0ZmluZEZyZWVQb3J0KHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIHN0YXJ0UG9ydDogbnVtYmVyLCBnaXZlVXBBZnRlcjogbnVtYmVyLCB0aW1lb3V0OiBudW1iZXIsIHN0cmlkZSA9IDEpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdHJldHVybiBmaW5kRnJlZVBvcnQoc3RhcnRQb3J0LCBnaXZlVXBBZnRlciwgdGltZW91dCwgc3RyaWRlKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cblx0Ly8jcmVnaW9uIERldmVsb3BtZW50XG5cblx0cHJpdmF0ZSBncHVJbmZvV2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRhc3luYyBvcGVuRGV2VG9vbHMod2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCwgb3B0aW9ucz86IFBhcnRpYWw8T3BlbkRldlRvb2xzT3B0aW9ucz4gJiBJTmF0aXZlSG9zdE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLndpbmRvd0J5SWQob3B0aW9ucz8udGFyZ2V0V2luZG93SWQsIHdpbmRvd0lkKTtcblx0XHR3aW5kb3c/Lndpbj8ud2ViQ29udGVudHMub3BlbkRldlRvb2xzKG9wdGlvbnM/Lm1vZGUgPyB7IG1vZGU6IG9wdGlvbnMubW9kZSwgYWN0aXZhdGU6IG9wdGlvbnMuYWN0aXZhdGUgfSA6IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRhc3luYyB0b2dnbGVEZXZUb29scyh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogSU5hdGl2ZUhvc3RPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy53aW5kb3dCeUlkKG9wdGlvbnM/LnRhcmdldFdpbmRvd0lkLCB3aW5kb3dJZCk7XG5cdFx0d2luZG93Py53aW4/LndlYkNvbnRlbnRzLnRvZ2dsZURldlRvb2xzKCk7XG5cdH1cblxuXHRhc3luYyBvcGVuR1BVSW5mb1dpbmRvdyh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcGFyZW50V2luZG93ID0gdGhpcy5jb2RlV2luZG93QnlJZCh3aW5kb3dJZCk7XG5cdFx0aWYgKCFwYXJlbnRXaW5kb3cpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHRoaXMuZ3B1SW5mb1dpbmRvd0lkICE9PSAnbnVtYmVyJykge1xuXHRcdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZGVmYXVsdEJyb3dzZXJXaW5kb3dPcHRpb25zLCBkZWZhdWx0V2luZG93U3RhdGUoKSwgeyBmb3JjZU5hdGl2ZVRpdGxlYmFyOiB0cnVlIH0pO1xuXHRcdFx0b3B0aW9ucy5iYWNrZ3JvdW5kQ29sb3IgPSB1bmRlZmluZWQ7XG5cblx0XHRcdGNvbnN0IGdwdUluZm9XaW5kb3cgPSBuZXcgQnJvd3NlcldpbmRvdyhvcHRpb25zKTtcblx0XHRcdGdwdUluZm9XaW5kb3cuc2V0TWVudUJhclZpc2liaWxpdHkoZmFsc2UpO1xuXHRcdFx0Z3B1SW5mb1dpbmRvdy5sb2FkVVJMKCdjaHJvbWU6Ly9ncHUnKTtcblxuXHRcdFx0Z3B1SW5mb1dpbmRvdy5vbmNlKCdyZWFkeS10by1zaG93JywgKCkgPT4gZ3B1SW5mb1dpbmRvdy5zaG93KCkpO1xuXHRcdFx0Z3B1SW5mb1dpbmRvdy5vbmNlKCdjbG9zZScsICgpID0+IHRoaXMuZ3B1SW5mb1dpbmRvd0lkID0gdW5kZWZpbmVkKTtcblxuXHRcdFx0cGFyZW50V2luZG93Lndpbj8ub24oJ2Nsb3NlJywgKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5ncHVJbmZvV2luZG93SWQpIHtcblx0XHRcdFx0XHRCcm93c2VyV2luZG93LmZyb21JZCh0aGlzLmdwdUluZm9XaW5kb3dJZCk/LmNsb3NlKCk7XG5cdFx0XHRcdFx0dGhpcy5ncHVJbmZvV2luZG93SWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmdwdUluZm9XaW5kb3dJZCA9IGdwdUluZm9XaW5kb3cuaWQ7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiB0aGlzLmdwdUluZm9XaW5kb3dJZCA9PT0gJ251bWJlcicpIHtcblx0XHRcdGNvbnN0IHdpbmRvdyA9IEJyb3dzZXJXaW5kb3cuZnJvbUlkKHRoaXMuZ3B1SW5mb1dpbmRvd0lkKTtcblx0XHRcdGlmICh3aW5kb3c/LmlzTWluaW1pemVkKCkpIHtcblx0XHRcdFx0d2luZG93Py5yZXN0b3JlKCk7XG5cdFx0XHR9XG5cdFx0XHR3aW5kb3c/LmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8gI3JlZ2lvbiBQZXJmb3JtYW5jZVxuXG5cdGFzeW5jIHByb2ZpbGVSZW5kZXJlcih3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBzZXNzaW9uOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIpOiBQcm9taXNlPElWOFByb2ZpbGU+IHtcblx0XHRjb25zdCB3aW5kb3cgPSB0aGlzLmNvZGVXaW5kb3dCeUlkKHdpbmRvd0lkKTtcblx0XHRpZiAoIXdpbmRvdyB8fCAhd2luZG93Lndpbikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvZmlsZXIgPSBuZXcgV2luZG93UHJvZmlsZXIod2luZG93Lndpbiwgc2Vzc2lvbiwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm9maWxlci5pbnNwZWN0KGR1cmF0aW9uKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0Ly8gI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBSZWdpc3RyeSAod2luZG93cylcblxuXHRhc3luYyB3aW5kb3dzR2V0U3RyaW5nUmVnS2V5KHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQsIGhpdmU6ICdIS0VZX0NVUlJFTlRfVVNFUicgfCAnSEtFWV9MT0NBTF9NQUNISU5FJyB8ICdIS0VZX0NMQVNTRVNfUk9PVCcgfCAnSEtFWV9VU0VSUycgfCAnSEtFWV9DVVJSRU5UX0NPTkZJRycsIHBhdGg6IHN0cmluZywgbmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBSZWdpc3RyeSA9IGF3YWl0IGltcG9ydCgnQHZzY29kZS93aW5kb3dzLXJlZ2lzdHJ5Jyk7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBSZWdpc3RyeS5HZXRTdHJpbmdSZWdLZXkoaGl2ZSwgcGF0aCwgbmFtZSk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgd2luZG93QnlJZCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBmYWxsYmFja0NvZGVXaW5kb3dJZD86IG51bWJlcik6IElDb2RlV2luZG93IHwgSUF1eGlsaWFyeVdpbmRvdyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuY29kZVdpbmRvd0J5SWQod2luZG93SWQpID8/IHRoaXMuYXV4aWxpYXJ5V2luZG93QnlJZCh3aW5kb3dJZCkgPz8gdGhpcy5jb2RlV2luZG93QnlJZChmYWxsYmFja0NvZGVXaW5kb3dJZCk7XG5cdH1cblxuXHRwcml2YXRlIGNvZGVXaW5kb3dCeUlkKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQpOiBJQ29kZVdpbmRvdyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHR5cGVvZiB3aW5kb3dJZCAhPT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0J5SWQod2luZG93SWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhdXhpbGlhcnlXaW5kb3dCeUlkKHdpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQpOiBJQXV4aWxpYXJ5V2luZG93IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodHlwZW9mIHdpbmRvd0lkICE9PSAnbnVtYmVyJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZW50cyA9IHdlYkNvbnRlbnRzLmZyb21JZCh3aW5kb3dJZCk7XG5cdFx0aWYgKCFjb250ZW50cykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5hdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2UuZ2V0V2luZG93QnlXZWJDb250ZW50cyhjb250ZW50cyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxRQUFRO0FBQ3BCLFNBQVMsWUFBWTtBQUNyQixTQUFTLEtBQUssZUFBZSxX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QXVEO0FBQzdFLFFBQUksT0FBTyxhQUFhLFVBQVU7QUFDakMsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLEtBQUssbUJBQW1CLGNBQWMsUUFBUTtBQUFBLEVBQ3REO0FBQUEsRUFFUSxvQkFBb0IsVUFBNEQ7QUFDdkYsUUFBSSxPQUFPLGFBQWEsVUFBVTtBQUNqQyxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sV0FBVyxZQUFZLE9BQU8sUUFBUTtBQUM1QyxRQUFJLENBQUMsVUFBVTtBQUNkLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLDRCQUE0Qix1QkFBdUIsUUFBUTtBQUFBLEVBQ3hFO0FBQ0Q7QUEzV2E7QUFBQSxFQURYO0FBQUEsR0ExbEJXLHNCQTJsQkE7QUEzbEJBLHdCQUFOO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBakJVOyIsCiAgIm5hbWVzIjogWyJlcnJvciIsICJyZXNvbHZlIiwgInR5cGUiXQp9Cg==
