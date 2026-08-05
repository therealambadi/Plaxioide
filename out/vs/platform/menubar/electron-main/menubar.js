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
import { app, BrowserWindow, Menu, MenuItem } from "electron";
import { RunOnceScheduler } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { mnemonicMenuLabel } from "../../../base/common/labels.js";
import { isMacintosh, language } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import * as nls from "../../../nls.js";
import { IAuxiliaryWindowsMainService } from "../../auxiliaryWindow/electron-main/auxiliaryWindows.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { isMenubarMenuItemAction, isMenubarMenuItemRecentAction, isMenubarMenuItemSeparator, isMenubarMenuItemSubmenu } from "../common/menubar.js";
import { INativeHostMainService } from "../../native/electron-main/nativeHostMainService.js";
import { IProductService } from "../../product/common/productService.js";
import { IStateService } from "../../state/node/state.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUpdateService, StateType } from "../../update/common/update.js";
import { hasNativeTitlebar } from "../../window/common/window.js";
import { IWindowsMainService, OpenContext } from "../../windows/electron-main/windows.js";
import { IWorkspacesHistoryMainService } from "../../workspaces/electron-main/workspacesHistoryMainService.js";
import { Disposable } from "../../../base/common/lifecycle.js";
const telemetryFrom = "menu";
let Menubar = class extends Disposable {
  constructor(updateService, configurationService, windowsMainService, environmentMainService, telemetryService, workspacesHistoryMainService, stateService, lifecycleMainService, logService, nativeHostMainService, productService, auxiliaryWindowsMainService) {
    super();
    this.updateService = updateService;
    this.configurationService = configurationService;
    this.windowsMainService = windowsMainService;
    this.environmentMainService = environmentMainService;
    this.telemetryService = telemetryService;
    this.workspacesHistoryMainService = workspacesHistoryMainService;
    this.stateService = stateService;
    this.lifecycleMainService = lifecycleMainService;
    this.logService = logService;
    this.nativeHostMainService = nativeHostMainService;
    this.productService = productService;
    this.auxiliaryWindowsMainService = auxiliaryWindowsMainService;
    this.fallbackMenuHandlers = /* @__PURE__ */ Object.create(null);
    this.menuUpdater = new RunOnceScheduler(() => this.doUpdateMenu(), 0);
    this.menuGC = new RunOnceScheduler(() => {
      this.oldMenus = [];
    }, 1e4);
    this.menubarMenus = /* @__PURE__ */ Object.create(null);
    this.keybindings = /* @__PURE__ */ Object.create(null);
    if (isMacintosh || hasNativeTitlebar(configurationService)) {
      this.restoreCachedMenubarData();
    }
    this.addFallbackHandlers();
    this.closedLastWindow = false;
    this.noActiveMainWindow = false;
    this.oldMenus = [];
    this.install();
    this.registerListeners();
  }
  restoreCachedMenubarData() {
    const menubarData = this.stateService.getItem(Menubar.lastKnownMenubarStorageKey);
    if (menubarData) {
      if (menubarData.menus) {
        this.menubarMenus = menubarData.menus;
      }
      if (menubarData.keybindings) {
        this.keybindings = menubarData.keybindings;
      }
    }
  }
  addFallbackHandlers() {
    this.fallbackMenuHandlers["workbench.action.files.newUntitledFile"] = (menuItem, win, event) => {
      if (!this.runActionInRenderer({ type: "commandId", commandId: "workbench.action.files.newUntitledFile" })) {
        this.windowsMainService.openEmptyWindow({ context: OpenContext.MENU, contextWindowId: win?.id });
      }
    };
    this.fallbackMenuHandlers["workbench.action.newWindow"] = (menuItem, win, event) => this.windowsMainService.openEmptyWindow({ context: OpenContext.MENU, contextWindowId: win?.id });
    this.fallbackMenuHandlers["workbench.action.files.openFileFolder"] = (menuItem, win, event) => this.nativeHostMainService.pickFileFolderAndOpen(void 0, { forceNewWindow: this.isOptionClick(event), telemetryExtraData: { from: telemetryFrom } });
    this.fallbackMenuHandlers["workbench.action.files.openFolder"] = (menuItem, win, event) => this.nativeHostMainService.pickFolderAndOpen(void 0, { forceNewWindow: this.isOptionClick(event), telemetryExtraData: { from: telemetryFrom } });
    this.fallbackMenuHandlers["workbench.action.openWorkspace"] = (menuItem, win, event) => this.nativeHostMainService.pickWorkspaceAndOpen(void 0, { forceNewWindow: this.isOptionClick(event), telemetryExtraData: { from: telemetryFrom } });
    this.fallbackMenuHandlers["workbench.action.clearRecentFiles"] = () => this.workspacesHistoryMainService.clearRecentlyOpened({
      confirm: true
      /* ask for confirmation */
    });
    const youTubeUrl = this.productService.youTubeUrl;
    if (youTubeUrl) {
      this.fallbackMenuHandlers["workbench.action.openYouTubeUrl"] = () => this.openUrl(youTubeUrl, "openYouTubeUrl");
    }
    const requestFeatureUrl = this.productService.requestFeatureUrl;
    if (requestFeatureUrl) {
      this.fallbackMenuHandlers["workbench.action.openRequestFeatureUrl"] = () => this.openUrl(requestFeatureUrl, "openUserVoiceUrl");
    }
    const reportIssueUrl = this.productService.reportIssueUrl;
    if (reportIssueUrl) {
      this.fallbackMenuHandlers["workbench.action.openIssueReporter"] = () => this.openUrl(reportIssueUrl, "openReportIssues");
    }
    const licenseUrl = this.productService.licenseUrl;
    if (licenseUrl) {
      this.fallbackMenuHandlers["workbench.action.openLicenseUrl"] = () => {
        if (language) {
          const queryArgChar = licenseUrl.indexOf("?") > 0 ? "&" : "?";
          this.openUrl(`${licenseUrl}${queryArgChar}lang=${language}`, "openLicenseUrl");
        } else {
          this.openUrl(licenseUrl, "openLicenseUrl");
        }
      };
    }
    const privacyStatementUrl = this.productService.privacyStatementUrl;
    if (privacyStatementUrl && licenseUrl) {
      this.fallbackMenuHandlers["workbench.action.openPrivacyStatementUrl"] = () => {
        this.openUrl(privacyStatementUrl, "openPrivacyStatement");
      };
    }
  }
  registerListeners() {
    this._register(this.lifecycleMainService.onWillShutdown(() => this.willShutdown = true));
    this._register(this.windowsMainService.onDidChangeWindowsCount((e) => this.onDidChangeWindowsCount(e)));
    this._register(this.nativeHostMainService.onDidBlurMainWindow(() => this.onDidChangeWindowFocus()));
    this._register(this.nativeHostMainService.onDidFocusMainWindow(() => this.onDidChangeWindowFocus()));
  }
  get currentEnableMenuBarMnemonics() {
    const enableMenuBarMnemonics = this.configurationService.getValue("window.enableMenuBarMnemonics");
    if (typeof enableMenuBarMnemonics !== "boolean") {
      return true;
    }
    return enableMenuBarMnemonics;
  }
  get currentEnableNativeTabs() {
    if (!isMacintosh) {
      return false;
    }
    const enableNativeTabs = this.configurationService.getValue("window.nativeTabs");
    if (typeof enableNativeTabs !== "boolean") {
      return false;
    }
    return enableNativeTabs;
  }
  updateMenu(menubarData, windowId) {
    this.menubarMenus = menubarData.menus;
    this.keybindings = menubarData.keybindings;
    this.stateService.setItem(Menubar.lastKnownMenubarStorageKey, menubarData);
    this.scheduleUpdateMenu();
  }
  scheduleUpdateMenu() {
    this.menuUpdater.schedule();
  }
  doUpdateMenu() {
    if (!this.willShutdown) {
      setTimeout(
        () => {
          if (!this.willShutdown) {
            this.install();
          }
        },
        10
        /* delay this because there is an issue with updating a menu when it is open */
      );
    }
  }
  onDidChangeWindowsCount(e) {
    if (!isMacintosh) {
      return;
    }
    if (e.oldCount === 0 && e.newCount > 0 || e.oldCount > 0 && e.newCount === 0) {
      this.closedLastWindow = e.newCount === 0;
      this.scheduleUpdateMenu();
    }
  }
  onDidChangeWindowFocus() {
    if (!isMacintosh) {
      return;
    }
    const focusedWindow = BrowserWindow.getFocusedWindow();
    this.noActiveMainWindow = !focusedWindow || !!this.auxiliaryWindowsMainService.getWindowByWebContents(focusedWindow.webContents);
    this.scheduleUpdateMenu();
  }
  install() {
    const oldMenu = Menu.getApplicationMenu();
    if (oldMenu) {
      this.oldMenus.push(oldMenu);
    }
    if (Object.keys(this.menubarMenus).length === 0) {
      this.doSetApplicationMenu(isMacintosh ? new Menu() : null);
      return;
    }
    const menubar = new Menu();
    let macApplicationMenuItem;
    if (isMacintosh) {
      const applicationMenu = new Menu();
      macApplicationMenuItem = new MenuItem({ label: this.productService.nameShort, submenu: applicationMenu });
      this.setMacApplicationMenu(applicationMenu);
      menubar.append(macApplicationMenuItem);
    }
    if (isMacintosh && !this.appMenuInstalled) {
      this.appMenuInstalled = true;
      const dockMenu = new Menu();
      dockMenu.append(new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "miNewWindow", comment: ["&& denotes a mnemonic"] }, "New &&Window")), click: () => this.windowsMainService.openEmptyWindow({ context: OpenContext.DOCK }) }));
      app.dock.setMenu(dockMenu);
    }
    if (this.shouldDrawMenu("File")) {
      const fileMenu = new Menu();
      const fileMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mFile", comment: ["&& denotes a mnemonic"] }, "&&File")), submenu: fileMenu });
      this.setMenuById(fileMenu, "File");
      menubar.append(fileMenuItem);
    }
    if (this.shouldDrawMenu("Edit")) {
      const editMenu = new Menu();
      const editMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mEdit", comment: ["&& denotes a mnemonic"] }, "&&Edit")), submenu: editMenu });
      this.setMenuById(editMenu, "Edit");
      menubar.append(editMenuItem);
    }
    if (this.shouldDrawMenu("Selection")) {
      const selectionMenu = new Menu();
      const selectionMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mSelection", comment: ["&& denotes a mnemonic"] }, "&&Selection")), submenu: selectionMenu });
      this.setMenuById(selectionMenu, "Selection");
      menubar.append(selectionMenuItem);
    }
    if (this.shouldDrawMenu("View")) {
      const viewMenu = new Menu();
      const viewMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mView", comment: ["&& denotes a mnemonic"] }, "&&View")), submenu: viewMenu });
      this.setMenuById(viewMenu, "View");
      menubar.append(viewMenuItem);
    }
    if (this.shouldDrawMenu("Go")) {
      const gotoMenu = new Menu();
      const gotoMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mGoto", comment: ["&& denotes a mnemonic"] }, "&&Go")), submenu: gotoMenu });
      this.setMenuById(gotoMenu, "Go");
      menubar.append(gotoMenuItem);
    }
    if (this.shouldDrawMenu("Run")) {
      const debugMenu = new Menu();
      const debugMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mRun", comment: ["&& denotes a mnemonic"] }, "&&Run")), submenu: debugMenu });
      this.setMenuById(debugMenu, "Run");
      menubar.append(debugMenuItem);
    }
    if (this.shouldDrawMenu("Terminal")) {
      const terminalMenu = new Menu();
      const terminalMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mTerminal", comment: ["&& denotes a mnemonic"] }, "&&Terminal")), submenu: terminalMenu });
      this.setMenuById(terminalMenu, "Terminal");
      menubar.append(terminalMenuItem);
    }
    let macWindowMenuItem;
    if (this.shouldDrawMenu("Window")) {
      const windowMenu = new Menu();
      macWindowMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize("mWindow", "Window")), submenu: windowMenu, role: "window" });
      this.setMacWindowMenu(windowMenu);
    }
    if (macWindowMenuItem) {
      menubar.append(macWindowMenuItem);
    }
    if (this.shouldDrawMenu("Help")) {
      const helpMenu = new Menu();
      const helpMenuItem = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "mHelp", comment: ["&& denotes a mnemonic"] }, "&&Help")), submenu: helpMenu, role: "help" });
      this.setMenuById(helpMenu, "Help");
      menubar.append(helpMenuItem);
    }
    if (menubar.items && menubar.items.length > 0) {
      this.doSetApplicationMenu(menubar);
    } else {
      this.doSetApplicationMenu(null);
    }
    this.menuGC.schedule();
  }
  doSetApplicationMenu(menu) {
    Menu.setApplicationMenu(menu);
    if (menu) {
      for (const window of this.auxiliaryWindowsMainService.getWindows()) {
        window.win?.setMenu(null);
      }
    }
  }
  setMacApplicationMenu(macApplicationMenu) {
    const about = this.createMenuItem(nls.localize("mAbout", "About {0}", this.productService.nameLong), "workbench.action.showAboutDialog");
    const checkForUpdates = this.getUpdateMenuItems();
    let preferences;
    if (this.shouldDrawMenu("Preferences")) {
      const preferencesMenu = new Menu();
      this.setMenuById(preferencesMenu, "Preferences");
      preferences = new MenuItem({ label: this.mnemonicLabel(nls.localize({ key: "miPreferences", comment: ["&& denotes a mnemonic"] }, "&&Preferences")), submenu: preferencesMenu });
    }
    const servicesMenu = new Menu();
    const services = new MenuItem({ label: nls.localize("mServices", "Services"), role: "services", submenu: servicesMenu });
    const hide = new MenuItem({ label: nls.localize("mHide", "Hide {0}", this.productService.nameLong), role: "hide", accelerator: "Command+H" });
    const hideOthers = new MenuItem({ label: nls.localize("mHideOthers", "Hide Others"), role: "hideOthers", accelerator: "Command+Alt+H" });
    const showAll = new MenuItem({ label: nls.localize("mShowAll", "Show All"), role: "unhide" });
    const quit = new MenuItem(this.likeAction("workbench.action.quit", {
      label: nls.localize("miQuit", "Quit {0}", this.productService.nameLong),
      click: async (item, window, event) => {
        const lastActiveWindow = this.windowsMainService.getLastActiveWindow();
        if (this.windowsMainService.getWindowCount() === 0 || // allow to quit when no more windows are open
        !!BrowserWindow.getFocusedWindow() || // allow to quit when window has focus (fix for https://github.com/microsoft/vscode/issues/39191)
        lastActiveWindow?.win?.isMinimized()) {
          const confirmed = await this.confirmBeforeQuit(event);
          if (confirmed) {
            this.nativeHostMainService.quit(void 0);
          }
        }
      }
    }));
    const actions = [about];
    actions.push(...checkForUpdates);
    if (preferences) {
      actions.push(...[
        __separator__(),
        preferences
      ]);
    }
    actions.push(...[
      __separator__(),
      services,
      __separator__(),
      hide,
      hideOthers,
      showAll,
      __separator__(),
      quit
    ]);
    actions.forEach((i) => macApplicationMenu.append(i));
  }
  async confirmBeforeQuit(event) {
    if (this.windowsMainService.getWindowCount() === 0) {
      return true;
    }
    const confirmBeforeClose = this.configurationService.getValue("window.confirmBeforeClose");
    if (confirmBeforeClose === "always" || confirmBeforeClose === "keyboardOnly" && this.isKeyboardEvent(event)) {
      const { response } = await this.nativeHostMainService.showMessageBox(this.windowsMainService.getFocusedWindow()?.id, {
        type: "question",
        buttons: [
          nls.localize({ key: "quit", comment: ["&& denotes a mnemonic"] }, "&&Quit"),
          nls.localize("cancel", "Cancel")
        ],
        message: nls.localize("quitMessage", "Are you sure you want to quit?")
      });
      return response === 0;
    }
    return true;
  }
  shouldDrawMenu(menuId) {
    if (!isMacintosh && !hasNativeTitlebar(this.configurationService)) {
      return false;
    }
    switch (menuId) {
      case "File":
      case "Help":
        if (isMacintosh) {
          return this.windowsMainService.getWindowCount() === 0 && this.closedLastWindow || this.windowsMainService.getWindowCount() > 0 && this.noActiveMainWindow || !!this.menubarMenus && !!this.menubarMenus[menuId];
        }
      case "Window":
        if (isMacintosh) {
          return this.windowsMainService.getWindowCount() === 0 && this.closedLastWindow || this.windowsMainService.getWindowCount() > 0 && this.noActiveMainWindow || !!this.menubarMenus;
        }
      default:
        return this.windowsMainService.getWindowCount() > 0 && (!!this.menubarMenus && !!this.menubarMenus[menuId]);
    }
  }
  setMenu(menu, items) {
    items.forEach((item) => {
      if (isMenubarMenuItemSeparator(item)) {
        menu.append(__separator__());
      } else if (isMenubarMenuItemSubmenu(item)) {
        const submenu = new Menu();
        const submenuItem = new MenuItem({ label: this.mnemonicLabel(item.label), submenu });
        this.setMenu(submenu, item.submenu.items);
        menu.append(submenuItem);
      } else if (isMenubarMenuItemRecentAction(item)) {
        menu.append(this.createOpenRecentMenuItem(item));
      } else if (isMenubarMenuItemAction(item)) {
        if (item.id === "workbench.action.showAboutDialog") {
          this.insertCheckForUpdatesItems(menu);
        }
        if (isMacintosh) {
          if (this.windowsMainService.getWindowCount() === 0 && this.closedLastWindow || this.windowsMainService.getWindowCount() > 0 && this.noActiveMainWindow) {
            if (this.fallbackMenuHandlers[item.id]) {
              menu.append(new MenuItem(this.likeAction(item.id, { label: this.mnemonicLabel(item.label), click: this.fallbackMenuHandlers[item.id] })));
            } else {
              menu.append(this.createMenuItem(item.label, item.id, false, item.checked));
            }
          } else {
            menu.append(this.createMenuItem(item.label, item.id, item.enabled === false ? false : true, !!item.checked));
          }
        } else {
          menu.append(this.createMenuItem(item.label, item.id, item.enabled === false ? false : true, !!item.checked));
        }
      }
    });
  }
  setMenuById(menu, menuId) {
    if (this.menubarMenus && this.menubarMenus[menuId]) {
      this.setMenu(menu, this.menubarMenus[menuId].items);
    }
  }
  insertCheckForUpdatesItems(menu) {
    const updateItems = this.getUpdateMenuItems();
    if (updateItems.length) {
      updateItems.forEach((i) => menu.append(i));
      menu.append(__separator__());
    }
  }
  createOpenRecentMenuItem(item) {
    const revivedUri = URI.revive(item.uri);
    const commandId = item.id;
    const openable = commandId === "openRecentFile" ? { fileUri: revivedUri } : commandId === "openRecentWorkspace" ? { workspaceUri: revivedUri } : { folderUri: revivedUri };
    return new MenuItem(this.likeAction(commandId, {
      label: item.label,
      click: async (menuItem, win, event) => {
        const openInNewWindow = this.isOptionClick(event);
        const success = (await this.windowsMainService.open({
          context: OpenContext.MENU,
          cli: this.environmentMainService.args,
          urisToOpen: [openable],
          forceNewWindow: openInNewWindow,
          gotoLineMode: false,
          remoteAuthority: item.remoteAuthority
        })).length > 0;
        if (!success) {
          await this.workspacesHistoryMainService.removeRecentlyOpened([revivedUri]);
        }
      }
    }, false));
  }
  isOptionClick(event) {
    return !!(event && (!isMacintosh && (event.ctrlKey || event.shiftKey) || isMacintosh && (event.metaKey || event.altKey)));
  }
  isKeyboardEvent(event) {
    return !!(event.triggeredByAccelerator || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey);
  }
  createRoleMenuItem(label, commandId, role) {
    const options = {
      label: this.mnemonicLabel(label),
      role,
      enabled: true
    };
    return new MenuItem(this.withKeybinding(commandId, options));
  }
  setMacWindowMenu(macWindowMenu) {
    const minimize = new MenuItem({ label: nls.localize("mMinimize", "Minimize"), role: "minimize", accelerator: "Command+M", enabled: this.windowsMainService.getWindowCount() > 0 });
    const zoom = new MenuItem({ label: nls.localize("mZoom", "Zoom"), role: "zoom", enabled: this.windowsMainService.getWindowCount() > 0 });
    const bringAllToFront = new MenuItem({ label: nls.localize("mBringToFront", "Bring All to Front"), role: "front", enabled: this.windowsMainService.getWindowCount() > 0 });
    const switchWindow = this.createMenuItem(nls.localize({ key: "miSwitchWindow", comment: ["&& denotes a mnemonic"] }, "Switch &&Window..."), "workbench.action.switchWindow");
    const nativeTabMenuItems = [];
    if (this.currentEnableNativeTabs) {
      nativeTabMenuItems.push(__separator__());
      nativeTabMenuItems.push(this.createMenuItem(nls.localize("mNewTab", "New Tab"), "workbench.action.newWindowTab"));
      nativeTabMenuItems.push(this.createRoleMenuItem(nls.localize("mShowPreviousTab", "Show Previous Tab"), "workbench.action.showPreviousWindowTab", "selectPreviousTab"));
      nativeTabMenuItems.push(this.createRoleMenuItem(nls.localize("mShowNextTab", "Show Next Tab"), "workbench.action.showNextWindowTab", "selectNextTab"));
      nativeTabMenuItems.push(this.createRoleMenuItem(nls.localize("mMoveTabToNewWindow", "Move Tab to New Window"), "workbench.action.moveWindowTabToNewWindow", "moveTabToNewWindow"));
      nativeTabMenuItems.push(this.createRoleMenuItem(nls.localize("mMergeAllWindows", "Merge All Windows"), "workbench.action.mergeAllWindowTabs", "mergeAllWindows"));
    }
    [
      minimize,
      zoom,
      __separator__(),
      switchWindow,
      ...nativeTabMenuItems,
      __separator__(),
      bringAllToFront
    ].forEach((item) => macWindowMenu.append(item));
  }
  getUpdateMenuItems() {
    const state = this.updateService.state;
    switch (state.type) {
      case StateType.Idle:
        return [new MenuItem({
          label: this.mnemonicLabel(nls.localize("miCheckForUpdates", "Check for &&Updates...")),
          click: () => setTimeout(() => {
            this.reportMenuActionTelemetry("CheckForUpdate");
            this.updateService.checkForUpdates(true);
          }, 0)
        })];
      case StateType.CheckingForUpdates:
        return [new MenuItem({ label: nls.localize("miCheckingForUpdates", "Checking for Updates..."), enabled: false })];
      case StateType.AvailableForDownload:
        return [new MenuItem({
          label: this.mnemonicLabel(nls.localize("miDownloadUpdate", "D&&ownload Available Update")),
          click: () => {
            this.updateService.downloadUpdate();
          }
        })];
      case StateType.Downloading:
        return [new MenuItem({ label: nls.localize("miDownloadingUpdate", "Downloading Update..."), enabled: false })];
      case StateType.Downloaded:
        return isMacintosh ? [] : [new MenuItem({
          label: this.mnemonicLabel(nls.localize("miInstallUpdate", "Install &&Update...")),
          click: () => {
            this.reportMenuActionTelemetry("InstallUpdate");
            this.updateService.applyUpdate();
          }
        })];
      case StateType.Updating:
        return [new MenuItem({ label: nls.localize("miInstallingUpdate", "Installing Update..."), enabled: false })];
      case StateType.Ready:
        return [new MenuItem({
          label: this.mnemonicLabel(nls.localize("miRestartToUpdate", "Restart to &&Update")),
          click: () => {
            this.reportMenuActionTelemetry("RestartToUpdate");
            this.updateService.quitAndInstall();
          }
        })];
      default:
        return [];
    }
  }
  createMenuItem(arg1, arg2, arg3, arg4) {
    const label = this.mnemonicLabel(arg1);
    const click = typeof arg2 === "function" ? arg2 : (menuItem, win, event) => {
      const userSettingsLabel = menuItem ? menuItem.userSettingsLabel : null;
      let commandId2 = arg2;
      if (Array.isArray(arg2)) {
        commandId2 = this.isOptionClick(event) ? arg2[1] : arg2[0];
      }
      if (userSettingsLabel && event.triggeredByAccelerator) {
        this.runActionInRenderer({ type: "keybinding", userSettingsLabel });
      } else {
        this.runActionInRenderer({ type: "commandId", commandId: commandId2 });
      }
    };
    const enabled = typeof arg3 === "boolean" ? arg3 : this.windowsMainService.getWindowCount() > 0;
    const checked = typeof arg4 === "boolean" ? arg4 : false;
    const options = {
      label,
      click,
      enabled
    };
    if (checked) {
      options.type = "checkbox";
      options.checked = checked;
    }
    let commandId;
    if (typeof arg2 === "string") {
      commandId = arg2;
    } else if (Array.isArray(arg2)) {
      commandId = arg2[0];
    }
    if (isMacintosh) {
      if (commandId === "editor.action.clipboardCutAction") {
        options.role = "cut";
      } else if (commandId === "editor.action.clipboardCopyAction") {
        options.role = "copy";
      } else if (commandId === "editor.action.clipboardPasteAction") {
        options.role = "paste";
      }
      if (commandId === "undo") {
        options.click = this.makeContextAwareClickHandler(click, {
          inDevTools: (devTools) => devTools.undo(),
          inNoWindow: () => Menu.sendActionToFirstResponder("undo:")
        });
      } else if (commandId === "redo") {
        options.click = this.makeContextAwareClickHandler(click, {
          inDevTools: (devTools) => devTools.redo(),
          inNoWindow: () => Menu.sendActionToFirstResponder("redo:")
        });
      } else if (commandId === "editor.action.selectAll") {
        options.click = this.makeContextAwareClickHandler(click, {
          inDevTools: (devTools) => devTools.selectAll(),
          inNoWindow: () => Menu.sendActionToFirstResponder("selectAll:")
        });
      }
    }
    return new MenuItem(this.withKeybinding(commandId, options));
  }
  makeContextAwareClickHandler(click, contextSpecificHandlers) {
    return (menuItem, win, event) => {
      const activeWindow = BrowserWindow.getFocusedWindow();
      if (!activeWindow) {
        return contextSpecificHandlers.inNoWindow();
      }
      if (activeWindow.webContents.isDevToolsFocused() && activeWindow.webContents.devToolsWebContents) {
        return contextSpecificHandlers.inDevTools(activeWindow.webContents.devToolsWebContents);
      }
      click(menuItem, win || activeWindow, event);
    };
  }
  runActionInRenderer(invocation) {
    let activeBrowserWindow = BrowserWindow.getFocusedWindow();
    if (activeBrowserWindow) {
      const auxiliaryWindowCandidate = this.auxiliaryWindowsMainService.getWindowByWebContents(activeBrowserWindow.webContents);
      if (auxiliaryWindowCandidate) {
        activeBrowserWindow = this.windowsMainService.getWindowById(auxiliaryWindowCandidate.parentId)?.win ?? null;
      }
    }
    if (!activeBrowserWindow) {
      const lastActiveWindow = this.windowsMainService.getLastActiveWindow();
      if (lastActiveWindow?.win?.isMinimized()) {
        activeBrowserWindow = lastActiveWindow.win;
      }
    }
    const activeWindow = activeBrowserWindow ? this.windowsMainService.getWindowById(activeBrowserWindow.id) : void 0;
    if (activeWindow) {
      this.logService.trace("menubar#runActionInRenderer", invocation);
      if (isMacintosh && !this.environmentMainService.isBuilt && !activeWindow.isReady) {
        if (invocation.type === "commandId" && invocation.commandId === "workbench.action.toggleDevTools" || invocation.type !== "commandId" && invocation.userSettingsLabel === "alt+cmd+i") {
          return false;
        }
      }
      if (invocation.type === "commandId") {
        const runActionPayload = { id: invocation.commandId, from: "menu" };
        activeWindow.sendWhenReady("vscode:runAction", CancellationToken.None, runActionPayload);
      } else {
        const runKeybindingPayload = { userSettingsLabel: invocation.userSettingsLabel };
        activeWindow.sendWhenReady("vscode:runKeybinding", CancellationToken.None, runKeybindingPayload);
      }
      return true;
    } else {
      this.logService.trace("menubar#runActionInRenderer: no active window found", invocation);
      return false;
    }
  }
  withKeybinding(commandId, options) {
    const binding = typeof commandId === "string" ? this.keybindings[commandId] : void 0;
    if (binding?.label) {
      if (binding.isNative !== false) {
        options.accelerator = binding.label;
        options.userSettingsLabel = binding.userSettingsLabel;
      } else if (typeof options.label === "string") {
        const bindingIndex = options.label.indexOf("[");
        if (bindingIndex >= 0) {
          options.label = `${options.label.substr(0, bindingIndex)} [${binding.label}]`;
        } else {
          options.label = `${options.label} [${binding.label}]`;
        }
      }
    } else {
      options.accelerator = void 0;
    }
    return options;
  }
  likeAction(commandId, options, setAccelerator = !options.accelerator) {
    if (setAccelerator) {
      options = this.withKeybinding(commandId, options);
    }
    const originalClick = options.click;
    options.click = (item, window, event) => {
      this.reportMenuActionTelemetry(commandId);
      originalClick?.(item, window, event);
    };
    return options;
  }
  openUrl(url, id) {
    this.nativeHostMainService.openExternal(void 0, url);
    this.reportMenuActionTelemetry(id);
  }
  reportMenuActionTelemetry(id) {
    this.telemetryService.publicLog2("workbenchActionExecuted", { id, from: telemetryFrom });
  }
  mnemonicLabel(label) {
    return mnemonicMenuLabel(label, !this.currentEnableMenuBarMnemonics);
  }
};
Menubar.lastKnownMenubarStorageKey = "lastKnownMenubarData";
Menubar = __decorateClass([
  __decorateParam(0, IUpdateService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWindowsMainService),
  __decorateParam(3, IEnvironmentMainService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IWorkspacesHistoryMainService),
  __decorateParam(6, IStateService),
  __decorateParam(7, ILifecycleMainService),
  __decorateParam(8, ILogService),
  __decorateParam(9, INativeHostMainService),
  __decorateParam(10, IProductService),
  __decorateParam(11, IAuxiliaryWindowsMainService)
], Menubar);
function __separator__() {
  return new MenuItem({ type: "separator" });
}
export {
  Menubar
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9tZW51YmFyL2VsZWN0cm9uLW1haW4vbWVudWJhci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGFwcCwgQnJvd3NlcldpbmRvdywgQmFzZVdpbmRvdywgS2V5Ym9hcmRFdmVudCwgTWVudSwgTWVudUl0ZW0sIE1lbnVJdGVtQ29uc3RydWN0b3JPcHRpb25zLCBXZWJDb250ZW50cyB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCB7IFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24sIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBtbmVtb25pY01lbnVMYWJlbCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCwgbGFuZ3VhZ2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYXV4aWxpYXJ5V2luZG93L2VsZWN0cm9uLW1haW4vYXV4aWxpYXJ5V2luZG93cy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvZWxlY3Ryb24tbWFpbi9lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9lbGVjdHJvbi1tYWluL2xpZmVjeWNsZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU1lbnViYXJEYXRhLCBJTWVudWJhcktleWJpbmRpbmcsIElNZW51YmFyTWVudSwgSU1lbnViYXJNZW51UmVjZW50SXRlbUFjdGlvbiwgaXNNZW51YmFyTWVudUl0ZW1BY3Rpb24sIGlzTWVudWJhck1lbnVJdGVtUmVjZW50QWN0aW9uLCBpc01lbnViYXJNZW51SXRlbVNlcGFyYXRvciwgaXNNZW51YmFyTWVudUl0ZW1TdWJtZW51LCBNZW51YmFyTWVudUl0ZW0gfSBmcm9tICcuLi9jb21tb24vbWVudWJhci5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlSG9zdE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbmF0aXZlL2VsZWN0cm9uLW1haW4vbmF0aXZlSG9zdE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zdGF0ZS9ub2RlL3N0YXRlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVVwZGF0ZVNlcnZpY2UsIFN0YXRlVHlwZSB9IGZyb20gJy4uLy4uL3VwZGF0ZS9jb21tb24vdXBkYXRlLmpzJztcbmltcG9ydCB7IElOYXRpdmVSdW5BY3Rpb25JbldpbmRvd1JlcXVlc3QsIElOYXRpdmVSdW5LZXliaW5kaW5nSW5XaW5kb3dSZXF1ZXN0LCBJV2luZG93T3BlbmFibGUsIGhhc05hdGl2ZVRpdGxlYmFyIH0gZnJvbSAnLi4vLi4vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSVdpbmRvd3NDb3VudENoYW5nZWRFdmVudCwgSVdpbmRvd3NNYWluU2VydmljZSwgT3BlbkNvbnRleHQgfSBmcm9tICcuLi8uLi93aW5kb3dzL2VsZWN0cm9uLW1haW4vd2luZG93cy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3dvcmtzcGFjZXMvZWxlY3Ryb24tbWFpbi93b3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5jb25zdCB0ZWxlbWV0cnlGcm9tID0gJ21lbnUnO1xuXG5pbnRlcmZhY2UgSU1lbnVJdGVtQ2xpY2tIYW5kbGVyIHtcblx0aW5EZXZUb29sczogKGNvbnRlbnRzOiBXZWJDb250ZW50cykgPT4gdm9pZDtcblx0aW5Ob1dpbmRvdzogKCkgPT4gdm9pZDtcbn1cblxudHlwZSBJTWVudUl0ZW1JbnZvY2F0aW9uID0gKFxuXHR7IHR5cGU6ICdjb21tYW5kSWQnOyBjb21tYW5kSWQ6IHN0cmluZyB9XG5cdHwgeyB0eXBlOiAna2V5YmluZGluZyc7IHVzZXJTZXR0aW5nc0xhYmVsOiBzdHJpbmcgfVxuKTtcblxuaW50ZXJmYWNlIElNZW51SXRlbVdpdGhLZXliaW5kaW5nIHtcblx0dXNlclNldHRpbmdzTGFiZWw/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBNZW51YmFyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgbGFzdEtub3duTWVudWJhclN0b3JhZ2VLZXkgPSAnbGFzdEtub3duTWVudWJhckRhdGEnO1xuXG5cdHByaXZhdGUgd2lsbFNodXRkb3duOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGFwcE1lbnVJbnN0YWxsZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY2xvc2VkTGFzdFdpbmRvdzogYm9vbGVhbjtcblx0cHJpdmF0ZSBub0FjdGl2ZU1haW5XaW5kb3c6IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBtZW51VXBkYXRlcjogUnVuT25jZVNjaGVkdWxlcjtcblx0cHJpdmF0ZSBtZW51R0M6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cblx0Ly8gQXJyYXkgdG8ga2VlcCBtZW51cyBhcm91bmQgc28gdGhhdCBHQyBkb2Vzbid0IGNhdXNlIGNyYXNoIGFzIGV4cGxhaW5lZCBpbiAjNTUzNDdcblx0Ly8gVE9ET0BzYmF0dGVuIFJlbW92ZSB0aGlzIHdoZW4gZml4ZWQgdXBzdHJlYW0gYnkgRWxlY3Ryb25cblx0cHJpdmF0ZSBvbGRNZW51czogTWVudVtdO1xuXG5cdHByaXZhdGUgbWVudWJhck1lbnVzOiB7IFtpZDogc3RyaW5nXTogSU1lbnViYXJNZW51IH07XG5cblx0cHJpdmF0ZSBrZXliaW5kaW5nczogeyBbY29tbWFuZElkOiBzdHJpbmddOiBJTWVudWJhcktleWJpbmRpbmcgfTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGZhbGxiYWNrTWVudUhhbmRsZXJzOiB7IFtpZDogc3RyaW5nXTogKG1lbnVJdGVtOiBNZW51SXRlbSwgYnJvd3NlcldpbmRvdzogQmFzZVdpbmRvdyB8IHVuZGVmaW5lZCwgZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHZvaWQgfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVcGRhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXBkYXRlU2VydmljZTogSVVwZGF0ZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXaW5kb3dzTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3aW5kb3dzTWFpblNlcnZpY2U6IElXaW5kb3dzTWFpblNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRNYWluU2VydmljZTogSUVudmlyb25tZW50TWFpblNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZTogSVdvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UsXG5cdFx0QElTdGF0ZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdGF0ZVNlcnZpY2U6IElTdGF0ZVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZU1haW5TZXJ2aWNlOiBJTGlmZWN5Y2xlTWFpblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0TWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBuYXRpdmVIb3N0TWFpblNlcnZpY2U6IElOYXRpdmVIb3N0TWFpblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElBdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2U6IElBdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMubWVudVVwZGF0ZXIgPSBuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmRvVXBkYXRlTWVudSgpLCAwKTtcblxuXHRcdHRoaXMubWVudUdDID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4geyB0aGlzLm9sZE1lbnVzID0gW107IH0sIDEwMDAwKTtcblxuXHRcdHRoaXMubWVudWJhck1lbnVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLmtleWJpbmRpbmdzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRcdGlmIChpc01hY2ludG9zaCB8fCBoYXNOYXRpdmVUaXRsZWJhcihjb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdHRoaXMucmVzdG9yZUNhY2hlZE1lbnViYXJEYXRhKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5hZGRGYWxsYmFja0hhbmRsZXJzKCk7XG5cblx0XHR0aGlzLmNsb3NlZExhc3RXaW5kb3cgPSBmYWxzZTtcblx0XHR0aGlzLm5vQWN0aXZlTWFpbldpbmRvdyA9IGZhbHNlO1xuXG5cdFx0dGhpcy5vbGRNZW51cyA9IFtdO1xuXG5cdFx0dGhpcy5pbnN0YWxsKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlc3RvcmVDYWNoZWRNZW51YmFyRGF0YSgpIHtcblx0XHRjb25zdCBtZW51YmFyRGF0YSA9IHRoaXMuc3RhdGVTZXJ2aWNlLmdldEl0ZW08SU1lbnViYXJEYXRhPihNZW51YmFyLmxhc3RLbm93bk1lbnViYXJTdG9yYWdlS2V5KTtcblx0XHRpZiAobWVudWJhckRhdGEpIHtcblx0XHRcdGlmIChtZW51YmFyRGF0YS5tZW51cykge1xuXHRcdFx0XHR0aGlzLm1lbnViYXJNZW51cyA9IG1lbnViYXJEYXRhLm1lbnVzO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobWVudWJhckRhdGEua2V5YmluZGluZ3MpIHtcblx0XHRcdFx0dGhpcy5rZXliaW5kaW5ncyA9IG1lbnViYXJEYXRhLmtleWJpbmRpbmdzO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYWRkRmFsbGJhY2tIYW5kbGVycygpOiB2b2lkIHtcblxuXHRcdC8vIEZpbGUgTWVudSBJdGVtc1xuXHRcdHRoaXMuZmFsbGJhY2tNZW51SGFuZGxlcnNbJ3dvcmtiZW5jaC5hY3Rpb24uZmlsZXMubmV3VW50aXRsZWRGaWxlJ10gPSAobWVudUl0ZW0sIHdpbiwgZXZlbnQpID0+IHtcblx0XHRcdGlmICghdGhpcy5ydW5BY3Rpb25JblJlbmRlcmVyKHsgdHlwZTogJ2NvbW1hbmRJZCcsIGNvbW1hbmRJZDogJ3dvcmtiZW5jaC5hY3Rpb24uZmlsZXMubmV3VW50aXRsZWRGaWxlJyB9KSkgeyAvLyB0aGlzIGlzIG9uZSBvZiB0aGUgZmV3IHN1cHBvcnRlZCBhY3Rpb25zIHdoZW4gYXV4IHdpbmRvdyBoYXMgZm9jdXNcblx0XHRcdFx0dGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub3BlbkVtcHR5V2luZG93KHsgY29udGV4dDogT3BlbkNvbnRleHQuTUVOVSwgY29udGV4dFdpbmRvd0lkOiB3aW4/LmlkIH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5mYWxsYmFja01lbnVIYW5kbGVyc1snd29ya2JlbmNoLmFjdGlvbi5uZXdXaW5kb3cnXSA9IChtZW51SXRlbSwgd2luLCBldmVudCkgPT4gdGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub3BlbkVtcHR5V2luZG93KHsgY29udGV4dDogT3BlbkNvbnRleHQuTUVOVSwgY29udGV4dFdpbmRvd0lkOiB3aW4/LmlkIH0pO1xuXHRcdHRoaXMuZmFsbGJhY2tNZW51SGFuZGxlcnNbJ3dvcmtiZW5jaC5hY3Rpb24uZmlsZXMub3BlbkZpbGVGb2xkZXInXSA9IChtZW51SXRlbSwgd2luLCBldmVudCkgPT4gdGhpcy5uYXRpdmVIb3N0TWFpblNlcnZpY2UucGlja0ZpbGVGb2xkZXJBbmRPcGVuKHVuZGVmaW5lZCwgeyBmb3JjZU5ld1dpbmRvdzogdGhpcy5pc09wdGlvbkNsaWNrKGV2ZW50KSwgdGVsZW1ldHJ5RXh0cmFEYXRhOiB7IGZyb206IHRlbGVtZXRyeUZyb20gfSB9KTtcblx0XHR0aGlzLmZhbGxiYWNrTWVudUhhbmRsZXJzWyd3b3JrYmVuY2guYWN0aW9uLmZpbGVzLm9wZW5Gb2xkZXInXSA9IChtZW51SXRlbSwgd2luLCBldmVudCkgPT4gdGhpcy5uYXRpdmVIb3N0TWFpblNlcnZpY2UucGlja0ZvbGRlckFuZE9wZW4odW5kZWZpbmVkLCB7IGZvcmNlTmV3V2luZG93OiB0aGlzLmlzT3B0aW9uQ2xpY2soZXZlbnQpLCB0ZWxlbWV0cnlFeHRyYURhdGE6IHsgZnJvbTogdGVsZW1ldHJ5RnJvbSB9IH0pO1xuXHRcdHRoaXMuZmFsbGJhY2tNZW51SGFuZGxlcnNbJ3dvcmtiZW5jaC5hY3Rpb24ub3BlbldvcmtzcGFjZSddID0gKG1lbnVJdGVtLCB3aW4sIGV2ZW50KSA9PiB0aGlzLm5hdGl2ZUhvc3RNYWluU2VydmljZS5waWNrV29ya3NwYWNlQW5kT3Blbih1bmRlZmluZWQsIHsgZm9yY2VOZXdXaW5kb3c6IHRoaXMuaXNPcHRpb25DbGljayhldmVudCksIHRlbGVtZXRyeUV4dHJhRGF0YTogeyBmcm9tOiB0ZWxlbWV0cnlGcm9tIH0gfSk7XG5cblx0XHQvLyBSZWNlbnQgTWVudSBJdGVtc1xuXHRcdHRoaXMuZmFsbGJhY2tNZW51SGFuZGxlcnNbJ3dvcmtiZW5jaC5hY3Rpb24uY2xlYXJSZWNlbnRGaWxlcyddID0gKCkgPT4gdGhpcy53b3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlLmNsZWFyUmVjZW50bHlPcGVuZWQoeyBjb25maXJtOiB0cnVlIC8qIGFzayBmb3IgY29uZmlybWF0aW9uICovIH0pO1xuXG5cdFx0Ly8gSGVscCBNZW51IEl0ZW1zXG5cdFx0Y29uc3QgeW91VHViZVVybCA9IHRoaXMucHJvZHVjdFNlcnZpY2UueW91VHViZVVybDtcblx0XHRpZiAoeW91VHViZVVybCkge1xuXHRcdFx0dGhpcy5mYWxsYmFja01lbnVIYW5kbGVyc1snd29ya2JlbmNoLmFjdGlvbi5vcGVuWW91VHViZVVybCddID0gKCkgPT4gdGhpcy5vcGVuVXJsKHlvdVR1YmVVcmwsICdvcGVuWW91VHViZVVybCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlcXVlc3RGZWF0dXJlVXJsID0gdGhpcy5wcm9kdWN0U2VydmljZS5yZXF1ZXN0RmVhdHVyZVVybDtcblx0XHRpZiAocmVxdWVzdEZlYXR1cmVVcmwpIHtcblx0XHRcdHRoaXMuZmFsbGJhY2tNZW51SGFuZGxlcnNbJ3dvcmtiZW5jaC5hY3Rpb24ub3BlblJlcXVlc3RGZWF0dXJlVXJsJ10gPSAoKSA9PiB0aGlzLm9wZW5VcmwocmVxdWVzdEZlYXR1cmVVcmwsICdvcGVuVXNlclZvaWNlVXJsJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVwb3J0SXNzdWVVcmwgPSB0aGlzLnByb2R1Y3RTZXJ2aWNlLnJlcG9ydElzc3VlVXJsO1xuXHRcdGlmIChyZXBvcnRJc3N1ZVVybCkge1xuXHRcdFx0dGhpcy5mYWxsYmFja01lbnVIYW5kbGVyc1snd29ya2JlbmNoLmFjdGlvbi5vcGVuSXNzdWVSZXBvcnRlciddID0gKCkgPT4gdGhpcy5vcGVuVXJsKHJlcG9ydElzc3VlVXJsLCAnb3BlblJlcG9ydElzc3VlcycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpY2Vuc2VVcmwgPSB0aGlzLnByb2R1Y3RTZXJ2aWNlLmxpY2Vuc2VVcmw7XG5cdFx0aWYgKGxpY2Vuc2VVcmwpIHtcblx0XHRcdHRoaXMuZmFsbGJhY2tNZW51SGFuZGxlcnNbJ3dvcmtiZW5jaC5hY3Rpb24ub3BlbkxpY2Vuc2VVcmwnXSA9ICgpID0+IHtcblx0XHRcdFx0aWYgKGxhbmd1YWdlKSB7XG5cdFx0XHRcdFx0Y29uc3QgcXVlcnlBcmdDaGFyID0gbGljZW5zZVVybC5pbmRleE9mKCc/JykgPiAwID8gJyYnIDogJz8nO1xuXHRcdFx0XHRcdHRoaXMub3BlblVybChgJHtsaWNlbnNlVXJsfSR7cXVlcnlBcmdDaGFyfWxhbmc9JHtsYW5ndWFnZX1gLCAnb3BlbkxpY2Vuc2VVcmwnKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLm9wZW5VcmwobGljZW5zZVVybCwgJ29wZW5MaWNlbnNlVXJsJyk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJpdmFjeVN0YXRlbWVudFVybCA9IHRoaXMucHJvZHVjdFNlcnZpY2UucHJpdmFjeVN0YXRlbWVudFVybDtcblx0XHRpZiAocHJpdmFjeVN0YXRlbWVudFVybCAmJiBsaWNlbnNlVXJsKSB7XG5cdFx0XHR0aGlzLmZhbGxiYWNrTWVudUhhbmRsZXJzWyd3b3JrYmVuY2guYWN0aW9uLm9wZW5Qcml2YWN5U3RhdGVtZW50VXJsJ10gPSAoKSA9PiB7XG5cdFx0XHRcdHRoaXMub3BlblVybChwcml2YWN5U3RhdGVtZW50VXJsLCAnb3BlblByaXZhY3lTdGF0ZW1lbnQnKTtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIEtlZXAgZmxhZyB3aGVuIGFwcCBxdWl0c1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlmZWN5Y2xlTWFpblNlcnZpY2Uub25XaWxsU2h1dGRvd24oKCkgPT4gdGhpcy53aWxsU2h1dGRvd24gPSB0cnVlKSk7XG5cblx0XHQvLyBMaXN0ZW4gdG8gc29tZSBldmVudHMgZnJvbSB3aW5kb3cgc2VydmljZSB0byB1cGRhdGUgbWVudVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud2luZG93c01haW5TZXJ2aWNlLm9uRGlkQ2hhbmdlV2luZG93c0NvdW50KGUgPT4gdGhpcy5vbkRpZENoYW5nZVdpbmRvd3NDb3VudChlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubmF0aXZlSG9zdE1haW5TZXJ2aWNlLm9uRGlkQmx1ck1haW5XaW5kb3coKCkgPT4gdGhpcy5vbkRpZENoYW5nZVdpbmRvd0ZvY3VzKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm5hdGl2ZUhvc3RNYWluU2VydmljZS5vbkRpZEZvY3VzTWFpbldpbmRvdygoKSA9PiB0aGlzLm9uRGlkQ2hhbmdlV2luZG93Rm9jdXMoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgY3VycmVudEVuYWJsZU1lbnVCYXJNbmVtb25pY3MoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZW5hYmxlTWVudUJhck1uZW1vbmljcyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3dpbmRvdy5lbmFibGVNZW51QmFyTW5lbW9uaWNzJyk7XG5cdFx0aWYgKHR5cGVvZiBlbmFibGVNZW51QmFyTW5lbW9uaWNzICE9PSAnYm9vbGVhbicpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBlbmFibGVNZW51QmFyTW5lbW9uaWNzO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgY3VycmVudEVuYWJsZU5hdGl2ZVRhYnMoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFpc01hY2ludG9zaCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVuYWJsZU5hdGl2ZVRhYnMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCd3aW5kb3cubmF0aXZlVGFicycpO1xuXHRcdGlmICh0eXBlb2YgZW5hYmxlTmF0aXZlVGFicyAhPT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBlbmFibGVOYXRpdmVUYWJzO1xuXHR9XG5cblx0dXBkYXRlTWVudShtZW51YmFyRGF0YTogSU1lbnViYXJEYXRhLCB3aW5kb3dJZDogbnVtYmVyKSB7XG5cdFx0dGhpcy5tZW51YmFyTWVudXMgPSBtZW51YmFyRGF0YS5tZW51cztcblx0XHR0aGlzLmtleWJpbmRpbmdzID0gbWVudWJhckRhdGEua2V5YmluZGluZ3M7XG5cblx0XHQvLyBTYXZlIG9mZiBuZXcgbWVudSBhbmQga2V5YmluZGluZ3Ncblx0XHR0aGlzLnN0YXRlU2VydmljZS5zZXRJdGVtKE1lbnViYXIubGFzdEtub3duTWVudWJhclN0b3JhZ2VLZXksIG1lbnViYXJEYXRhKTtcblxuXHRcdHRoaXMuc2NoZWR1bGVVcGRhdGVNZW51KCk7XG5cdH1cblxuXG5cdHByaXZhdGUgc2NoZWR1bGVVcGRhdGVNZW51KCk6IHZvaWQge1xuXHRcdHRoaXMubWVudVVwZGF0ZXIuc2NoZWR1bGUoKTsgLy8gYnVmZmVyIG11bHRpcGxlIGF0dGVtcHRzIHRvIHVwZGF0ZSB0aGUgbWVudVxuXHR9XG5cblx0cHJpdmF0ZSBkb1VwZGF0ZU1lbnUoKTogdm9pZCB7XG5cblx0XHQvLyBEdWUgdG8gbGltaXRhdGlvbnMgaW4gRWxlY3Ryb24sIGl0IGlzIG5vdCBwb3NzaWJsZSB0byB1cGRhdGUgbWVudSBpdGVtcyBkeW5hbWljYWxseS4gVGhlIHN1Z2dlc3RlZFxuXHRcdC8vIHdvcmthcm91bmQgZnJvbSBFbGVjdHJvbiBpcyB0byBzZXQgdGhlIGFwcGxpY2F0aW9uIG1lbnUgYWdhaW4uXG5cdFx0Ly8gU2VlIGFsc28gaHR0cHM6Ly9naXRodWIuY29tL2VsZWN0cm9uL2VsZWN0cm9uL2lzc3Vlcy84NDZcblx0XHQvL1xuXHRcdC8vIFJ1biBkZWxheWVkIHRvIHByZXZlbnQgdXBkYXRpbmcgbWVudSB3aGlsZSBpdCBpcyBvcGVuXG5cdFx0aWYgKCF0aGlzLndpbGxTaHV0ZG93bikge1xuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy53aWxsU2h1dGRvd24pIHtcblx0XHRcdFx0XHR0aGlzLmluc3RhbGwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMTAgLyogZGVsYXkgdGhpcyBiZWNhdXNlIHRoZXJlIGlzIGFuIGlzc3VlIHdpdGggdXBkYXRpbmcgYSBtZW51IHdoZW4gaXQgaXMgb3BlbiAqLyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZVdpbmRvd3NDb3VudChlOiBJV2luZG93c0NvdW50Q2hhbmdlZEV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCFpc01hY2ludG9zaCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBtZW51IGlmIHdpbmRvdyBjb3VudCBnb2VzIGZyb20gTiA+IDAgb3IgMCA+IE4gdG8gdXBkYXRlIG1lbnUgaXRlbSBlbmFibGVtZW50XG5cdFx0aWYgKChlLm9sZENvdW50ID09PSAwICYmIGUubmV3Q291bnQgPiAwKSB8fCAoZS5vbGRDb3VudCA+IDAgJiYgZS5uZXdDb3VudCA9PT0gMCkpIHtcblx0XHRcdHRoaXMuY2xvc2VkTGFzdFdpbmRvdyA9IGUubmV3Q291bnQgPT09IDA7XG5cdFx0XHR0aGlzLnNjaGVkdWxlVXBkYXRlTWVudSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VXaW5kb3dGb2N1cygpOiB2b2lkIHtcblx0XHRpZiAoIWlzTWFjaW50b3NoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9jdXNlZFdpbmRvdyA9IEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpO1xuXHRcdHRoaXMubm9BY3RpdmVNYWluV2luZG93ID0gIWZvY3VzZWRXaW5kb3cgfHwgISF0aGlzLmF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dCeVdlYkNvbnRlbnRzKGZvY3VzZWRXaW5kb3cud2ViQ29udGVudHMpO1xuXHRcdHRoaXMuc2NoZWR1bGVVcGRhdGVNZW51KCk7XG5cdH1cblxuXHRwcml2YXRlIGluc3RhbGwoKTogdm9pZCB7XG5cdFx0Ly8gU3RvcmUgb2xkIG1lbnUgaW4gb3VyIGFycmF5IHRvIGF2b2lkIEdDIHRvIGNvbGxlY3QgdGhlIG1lbnUgYW5kIGNyYXNoLiBTZWUgIzU1MzQ3XG5cdFx0Ly8gVE9ET0BzYmF0dGVuIFJlbW92ZSB0aGlzIHdoZW4gZml4ZWQgdXBzdHJlYW0gYnkgRWxlY3Ryb25cblx0XHRjb25zdCBvbGRNZW51ID0gTWVudS5nZXRBcHBsaWNhdGlvbk1lbnUoKTtcblx0XHRpZiAob2xkTWVudSkge1xuXHRcdFx0dGhpcy5vbGRNZW51cy5wdXNoKG9sZE1lbnUpO1xuXHRcdH1cblxuXHRcdC8vIElmIHdlIGRvbid0IGhhdmUgYSBtZW51IHlldCwgc2V0IGl0IHRvIG51bGwgdG8gYXZvaWQgdGhlIGVsZWN0cm9uIG1lbnUuXG5cdFx0Ly8gVGhpcyBzaG91bGQgb25seSBoYXBwZW4gb24gdGhlIGZpcnN0IGxhdW5jaCBldmVyXG5cdFx0aWYgKE9iamVjdC5rZXlzKHRoaXMubWVudWJhck1lbnVzKS5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMuZG9TZXRBcHBsaWNhdGlvbk1lbnUoaXNNYWNpbnRvc2ggPyBuZXcgTWVudSgpIDogbnVsbCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gTWVudXNcblx0XHRjb25zdCBtZW51YmFyID0gbmV3IE1lbnUoKTtcblxuXHRcdC8vIE1hYzogQXBwbGljYXRpb25cblx0XHRsZXQgbWFjQXBwbGljYXRpb25NZW51SXRlbTogTWVudUl0ZW07XG5cdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRjb25zdCBhcHBsaWNhdGlvbk1lbnUgPSBuZXcgTWVudSgpO1xuXHRcdFx0bWFjQXBwbGljYXRpb25NZW51SXRlbSA9IG5ldyBNZW51SXRlbSh7IGxhYmVsOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydCwgc3VibWVudTogYXBwbGljYXRpb25NZW51IH0pO1xuXHRcdFx0dGhpcy5zZXRNYWNBcHBsaWNhdGlvbk1lbnUoYXBwbGljYXRpb25NZW51KTtcblx0XHRcdG1lbnViYXIuYXBwZW5kKG1hY0FwcGxpY2F0aW9uTWVudUl0ZW0pO1xuXHRcdH1cblxuXHRcdC8vIE1hYzogRG9ja1xuXHRcdGlmIChpc01hY2ludG9zaCAmJiAhdGhpcy5hcHBNZW51SW5zdGFsbGVkKSB7XG5cdFx0XHR0aGlzLmFwcE1lbnVJbnN0YWxsZWQgPSB0cnVlO1xuXG5cdFx0XHRjb25zdCBkb2NrTWVudSA9IG5ldyBNZW51KCk7XG5cdFx0XHRkb2NrTWVudS5hcHBlbmQobmV3IE1lbnVJdGVtKHsgbGFiZWw6IHRoaXMubW5lbW9uaWNMYWJlbChubHMubG9jYWxpemUoeyBrZXk6ICdtaU5ld1dpbmRvdycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJOZXcgJiZXaW5kb3dcIikpLCBjbGljazogKCkgPT4gdGhpcy53aW5kb3dzTWFpblNlcnZpY2Uub3BlbkVtcHR5V2luZG93KHsgY29udGV4dDogT3BlbkNvbnRleHQuRE9DSyB9KSB9KSk7XG5cblx0XHRcdGFwcC5kb2NrLnNldE1lbnUoZG9ja01lbnUpO1xuXHRcdH1cblxuXHRcdC8vIEZpbGVcblx0XHRpZiAodGhpcy5zaG91bGREcmF3TWVudSgnRmlsZScpKSB7XG5cdFx0XHRjb25zdCBmaWxlTWVudSA9IG5ldyBNZW51KCk7XG5cdFx0XHRjb25zdCBmaWxlTWVudUl0ZW0gPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogdGhpcy5tbmVtb25pY0xhYmVsKG5scy5sb2NhbGl6ZSh7IGtleTogJ21GaWxlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmRmlsZVwiKSksIHN1Ym1lbnU6IGZpbGVNZW51IH0pO1xuXHRcdFx0dGhpcy5zZXRNZW51QnlJZChmaWxlTWVudSwgJ0ZpbGUnKTtcblx0XHRcdG1lbnViYXIuYXBwZW5kKGZpbGVNZW51SXRlbSk7XG5cdFx0fVxuXG5cdFx0Ly8gRWRpdFxuXHRcdGlmICh0aGlzLnNob3VsZERyYXdNZW51KCdFZGl0JykpIHtcblx0XHRcdGNvbnN0IGVkaXRNZW51ID0gbmV3IE1lbnUoKTtcblx0XHRcdGNvbnN0IGVkaXRNZW51SXRlbSA9IG5ldyBNZW51SXRlbSh7IGxhYmVsOiB0aGlzLm1uZW1vbmljTGFiZWwobmxzLmxvY2FsaXplKHsga2V5OiAnbUVkaXQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZFZGl0XCIpKSwgc3VibWVudTogZWRpdE1lbnUgfSk7XG5cdFx0XHR0aGlzLnNldE1lbnVCeUlkKGVkaXRNZW51LCAnRWRpdCcpO1xuXHRcdFx0bWVudWJhci5hcHBlbmQoZWRpdE1lbnVJdGVtKTtcblx0XHR9XG5cblx0XHQvLyBTZWxlY3Rpb25cblx0XHRpZiAodGhpcy5zaG91bGREcmF3TWVudSgnU2VsZWN0aW9uJykpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbk1lbnUgPSBuZXcgTWVudSgpO1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uTWVudUl0ZW0gPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogdGhpcy5tbmVtb25pY0xhYmVsKG5scy5sb2NhbGl6ZSh7IGtleTogJ21TZWxlY3Rpb24nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZTZWxlY3Rpb25cIikpLCBzdWJtZW51OiBzZWxlY3Rpb25NZW51IH0pO1xuXHRcdFx0dGhpcy5zZXRNZW51QnlJZChzZWxlY3Rpb25NZW51LCAnU2VsZWN0aW9uJyk7XG5cdFx0XHRtZW51YmFyLmFwcGVuZChzZWxlY3Rpb25NZW51SXRlbSk7XG5cdFx0fVxuXG5cdFx0Ly8gVmlld1xuXHRcdGlmICh0aGlzLnNob3VsZERyYXdNZW51KCdWaWV3JykpIHtcblx0XHRcdGNvbnN0IHZpZXdNZW51ID0gbmV3IE1lbnUoKTtcblx0XHRcdGNvbnN0IHZpZXdNZW51SXRlbSA9IG5ldyBNZW51SXRlbSh7IGxhYmVsOiB0aGlzLm1uZW1vbmljTGFiZWwobmxzLmxvY2FsaXplKHsga2V5OiAnbVZpZXcnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZWaWV3XCIpKSwgc3VibWVudTogdmlld01lbnUgfSk7XG5cdFx0XHR0aGlzLnNldE1lbnVCeUlkKHZpZXdNZW51LCAnVmlldycpO1xuXHRcdFx0bWVudWJhci5hcHBlbmQodmlld01lbnVJdGVtKTtcblx0XHR9XG5cblx0XHQvLyBHb1xuXHRcdGlmICh0aGlzLnNob3VsZERyYXdNZW51KCdHbycpKSB7XG5cdFx0XHRjb25zdCBnb3RvTWVudSA9IG5ldyBNZW51KCk7XG5cdFx0XHRjb25zdCBnb3RvTWVudUl0ZW0gPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogdGhpcy5tbmVtb25pY0xhYmVsKG5scy5sb2NhbGl6ZSh7IGtleTogJ21Hb3RvJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmR29cIikpLCBzdWJtZW51OiBnb3RvTWVudSB9KTtcblx0XHRcdHRoaXMuc2V0TWVudUJ5SWQoZ290b01lbnUsICdHbycpO1xuXHRcdFx0bWVudWJhci5hcHBlbmQoZ290b01lbnVJdGVtKTtcblx0XHR9XG5cblx0XHQvLyBEZWJ1Z1xuXHRcdGlmICh0aGlzLnNob3VsZERyYXdNZW51KCdSdW4nKSkge1xuXHRcdFx0Y29uc3QgZGVidWdNZW51ID0gbmV3IE1lbnUoKTtcblx0XHRcdGNvbnN0IGRlYnVnTWVudUl0ZW0gPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogdGhpcy5tbmVtb25pY0xhYmVsKG5scy5sb2NhbGl6ZSh7IGtleTogJ21SdW4nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSdW5cIikpLCBzdWJtZW51OiBkZWJ1Z01lbnUgfSk7XG5cdFx0XHR0aGlzLnNldE1lbnVCeUlkKGRlYnVnTWVudSwgJ1J1bicpO1xuXHRcdFx0bWVudWJhci5hcHBlbmQoZGVidWdNZW51SXRlbSk7XG5cdFx0fVxuXG5cdFx0Ly8gVGVybWluYWxcblx0XHRpZiAodGhpcy5zaG91bGREcmF3TWVudSgnVGVybWluYWwnKSkge1xuXHRcdFx0Y29uc3QgdGVybWluYWxNZW51ID0gbmV3IE1lbnUoKTtcblx0XHRcdGNvbnN0IHRlcm1pbmFsTWVudUl0ZW0gPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogdGhpcy5tbmVtb25pY0xhYmVsKG5scy5sb2NhbGl6ZSh7IGtleTogJ21UZXJtaW5hbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlRlcm1pbmFsXCIpKSwgc3VibWVudTogdGVybWluYWxNZW51IH0pO1xuXHRcdFx0dGhpcy5zZXRNZW51QnlJZCh0ZXJtaW5hbE1lbnUsICdUZXJtaW5hbCcpO1xuXHRcdFx0bWVudWJhci5hcHBlbmQodGVybWluYWxNZW51SXRlbSk7XG5cdFx0fVxuXG5cdFx0Ly8gTWFjOiBXaW5kb3dcblx0XHRsZXQgbWFjV2luZG93TWVudUl0ZW06IE1lbnVJdGVtIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLnNob3VsZERyYXdNZW51KCdXaW5kb3cnKSkge1xuXHRcdFx0Y29uc3Qgd2luZG93TWVudSA9IG5ldyBNZW51KCk7XG5cdFx0XHRtYWNXaW5kb3dNZW51SXRlbSA9IG5ldyBNZW51SXRlbSh7IGxhYmVsOiB0aGlzLm1uZW1vbmljTGFiZWwobmxzLmxvY2FsaXplKCdtV2luZG93JywgXCJXaW5kb3dcIikpLCBzdWJtZW51OiB3aW5kb3dNZW51LCByb2xlOiAnd2luZG93JyB9KTtcblx0XHRcdHRoaXMuc2V0TWFjV2luZG93TWVudSh3aW5kb3dNZW51KTtcblx0XHR9XG5cblx0XHRpZiAobWFjV2luZG93TWVudUl0ZW0pIHtcblx0XHRcdG1lbnViYXIuYXBwZW5kKG1hY1dpbmRvd01lbnVJdGVtKTtcblx0XHR9XG5cblx0XHQvLyBIZWxwXG5cdFx0aWYgKHRoaXMuc2hvdWxkRHJhd01lbnUoJ0hlbHAnKSkge1xuXHRcdFx0Y29uc3QgaGVscE1lbnUgPSBuZXcgTWVudSgpO1xuXHRcdFx0Y29uc3QgaGVscE1lbnVJdGVtID0gbmV3IE1lbnVJdGVtKHsgbGFiZWw6IHRoaXMubW5lbW9uaWNMYWJlbChubHMubG9jYWxpemUoeyBrZXk6ICdtSGVscCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkhlbHBcIikpLCBzdWJtZW51OiBoZWxwTWVudSwgcm9sZTogJ2hlbHAnIH0pO1xuXHRcdFx0dGhpcy5zZXRNZW51QnlJZChoZWxwTWVudSwgJ0hlbHAnKTtcblx0XHRcdG1lbnViYXIuYXBwZW5kKGhlbHBNZW51SXRlbSk7XG5cdFx0fVxuXG5cdFx0aWYgKG1lbnViYXIuaXRlbXMgJiYgbWVudWJhci5pdGVtcy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLmRvU2V0QXBwbGljYXRpb25NZW51KG1lbnViYXIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRvU2V0QXBwbGljYXRpb25NZW51KG51bGwpO1xuXHRcdH1cblxuXHRcdC8vIERpc3Bvc2Ugb2Ygb2xkZXIgbWVudXMgYWZ0ZXIgc29tZSB0aW1lXG5cdFx0dGhpcy5tZW51R0Muc2NoZWR1bGUoKTtcblx0fVxuXG5cdHByaXZhdGUgZG9TZXRBcHBsaWNhdGlvbk1lbnUobWVudTogKE1lbnUpIHwgKG51bGwpKTogdm9pZCB7XG5cblx0XHQvLyBTZXR0aW5nIHRoZSBhcHBsaWNhdGlvbiBtZW51IHNldHMgaXQgdG8gYWxsIG9wZW5lZCB3aW5kb3dzLFxuXHRcdC8vIGJ1dCB3ZSBjdXJyZW50bHkgZG8gbm90IHN1cHBvcnQgYSBtZW51IGluIGF1eGlsaWFyeSB3aW5kb3dzLFxuXHRcdC8vIHNvIHdlIG5lZWQgdG8gdW5zZXQgaXQgdGhlcmUuXG5cdFx0Ly9cblx0XHQvLyBUaGlzIGlzIGEgYml0IHVnbHkgYnV0IGBzZXRBcHBsaWNhdGlvbk1lbnUoKWAgaGFzIHNvbWUgbmljZVxuXHRcdC8vIGJlaGF2aW91ciB3ZSB3YW50OlxuXHRcdC8vIC0gb24gbWFjT1MgaXQgaXMgcmVxdWlyZWQgYmVjYXVzZSBtZW51cyBhcmUgYXBwbGljYXRpb24gc2V0XG5cdFx0Ly8gLSB3ZSB1c2UgYGdldEFwcGxpY2F0aW9uTWVudSgpYCB0byBhY2Nlc3MgdGhlIGN1cnJlbnQgc3RhdGVcblx0XHQvLyAtIG5ldyB3aW5kb3dzIGltbWVkaWF0ZWx5IGdldCB0aGUgc2FtZSBtZW51IHdoZW4gb3BlbmluZ1xuXHRcdC8vICAgcmVkdWNpbmcgb3ZlcmFsbCBmbGlja2VyIGZvciB0aGVzZVxuXG5cdFx0TWVudS5zZXRBcHBsaWNhdGlvbk1lbnUobWVudSk7XG5cblx0XHRpZiAobWVudSkge1xuXHRcdFx0Zm9yIChjb25zdCB3aW5kb3cgb2YgdGhpcy5hdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2UuZ2V0V2luZG93cygpKSB7XG5cdFx0XHRcdHdpbmRvdy53aW4/LnNldE1lbnUobnVsbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXRNYWNBcHBsaWNhdGlvbk1lbnUobWFjQXBwbGljYXRpb25NZW51OiBNZW51KTogdm9pZCB7XG5cdFx0Y29uc3QgYWJvdXQgPSB0aGlzLmNyZWF0ZU1lbnVJdGVtKG5scy5sb2NhbGl6ZSgnbUFib3V0JywgXCJBYm91dCB7MH1cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyksICd3b3JrYmVuY2guYWN0aW9uLnNob3dBYm91dERpYWxvZycpO1xuXHRcdGNvbnN0IGNoZWNrRm9yVXBkYXRlcyA9IHRoaXMuZ2V0VXBkYXRlTWVudUl0ZW1zKCk7XG5cblx0XHRsZXQgcHJlZmVyZW5jZXM7XG5cdFx0aWYgKHRoaXMuc2hvdWxkRHJhd01lbnUoJ1ByZWZlcmVuY2VzJykpIHtcblx0XHRcdGNvbnN0IHByZWZlcmVuY2VzTWVudSA9IG5ldyBNZW51KCk7XG5cdFx0XHR0aGlzLnNldE1lbnVCeUlkKHByZWZlcmVuY2VzTWVudSwgJ1ByZWZlcmVuY2VzJyk7XG5cdFx0XHRwcmVmZXJlbmNlcyA9IG5ldyBNZW51SXRlbSh7IGxhYmVsOiB0aGlzLm1uZW1vbmljTGFiZWwobmxzLmxvY2FsaXplKHsga2V5OiAnbWlQcmVmZXJlbmNlcycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlByZWZlcmVuY2VzXCIpKSwgc3VibWVudTogcHJlZmVyZW5jZXNNZW51IH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlcnZpY2VzTWVudSA9IG5ldyBNZW51KCk7XG5cdFx0Y29uc3Qgc2VydmljZXMgPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogbmxzLmxvY2FsaXplKCdtU2VydmljZXMnLCBcIlNlcnZpY2VzXCIpLCByb2xlOiAnc2VydmljZXMnLCBzdWJtZW51OiBzZXJ2aWNlc01lbnUgfSk7XG5cdFx0Y29uc3QgaGlkZSA9IG5ldyBNZW51SXRlbSh7IGxhYmVsOiBubHMubG9jYWxpemUoJ21IaWRlJywgXCJIaWRlIHswfVwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSwgcm9sZTogJ2hpZGUnLCBhY2NlbGVyYXRvcjogJ0NvbW1hbmQrSCcgfSk7XG5cdFx0Y29uc3QgaGlkZU90aGVycyA9IG5ldyBNZW51SXRlbSh7IGxhYmVsOiBubHMubG9jYWxpemUoJ21IaWRlT3RoZXJzJywgXCJIaWRlIE90aGVyc1wiKSwgcm9sZTogJ2hpZGVPdGhlcnMnLCBhY2NlbGVyYXRvcjogJ0NvbW1hbmQrQWx0K0gnIH0pO1xuXHRcdGNvbnN0IHNob3dBbGwgPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogbmxzLmxvY2FsaXplKCdtU2hvd0FsbCcsIFwiU2hvdyBBbGxcIiksIHJvbGU6ICd1bmhpZGUnIH0pO1xuXHRcdGNvbnN0IHF1aXQgPSBuZXcgTWVudUl0ZW0odGhpcy5saWtlQWN0aW9uKCd3b3JrYmVuY2guYWN0aW9uLnF1aXQnLCB7XG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdtaVF1aXQnLCBcIlF1aXQgezB9XCIsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcpLCBjbGljazogYXN5bmMgKGl0ZW0sIHdpbmRvdywgZXZlbnQpID0+IHtcblx0XHRcdFx0Y29uc3QgbGFzdEFjdGl2ZVdpbmRvdyA9IHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldExhc3RBY3RpdmVXaW5kb3coKTtcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0NvdW50KCkgPT09IDAgfHwgXHQvLyBhbGxvdyB0byBxdWl0IHdoZW4gbm8gbW9yZSB3aW5kb3dzIGFyZSBvcGVuXG5cdFx0XHRcdFx0ISFCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKSB8fFx0XHRcdFx0Ly8gYWxsb3cgdG8gcXVpdCB3aGVuIHdpbmRvdyBoYXMgZm9jdXMgKGZpeCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzM5MTkxKVxuXHRcdFx0XHRcdGxhc3RBY3RpdmVXaW5kb3c/Lndpbj8uaXNNaW5pbWl6ZWQoKVx0XHRcdFx0Ly8gYWxsb3cgdG8gcXVpdCB3aGVuIHdpbmRvdyBoYXMgbm8gZm9jdXMgYnV0IGlzIG1pbmltaXplZCAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzYzMDAwKVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRjb25zdCBjb25maXJtZWQgPSBhd2FpdCB0aGlzLmNvbmZpcm1CZWZvcmVRdWl0KGV2ZW50KTtcblx0XHRcdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm5hdGl2ZUhvc3RNYWluU2VydmljZS5xdWl0KHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgYWN0aW9ucyA9IFthYm91dF07XG5cdFx0YWN0aW9ucy5wdXNoKC4uLmNoZWNrRm9yVXBkYXRlcyk7XG5cblx0XHRpZiAocHJlZmVyZW5jZXMpIHtcblx0XHRcdGFjdGlvbnMucHVzaCguLi5bXG5cdFx0XHRcdF9fc2VwYXJhdG9yX18oKSxcblx0XHRcdFx0cHJlZmVyZW5jZXNcblx0XHRcdF0pO1xuXHRcdH1cblxuXHRcdGFjdGlvbnMucHVzaCguLi5bXG5cdFx0XHRfX3NlcGFyYXRvcl9fKCksXG5cdFx0XHRzZXJ2aWNlcyxcblx0XHRcdF9fc2VwYXJhdG9yX18oKSxcblx0XHRcdGhpZGUsXG5cdFx0XHRoaWRlT3RoZXJzLFxuXHRcdFx0c2hvd0FsbCxcblx0XHRcdF9fc2VwYXJhdG9yX18oKSxcblx0XHRcdHF1aXRcblx0XHRdKTtcblxuXHRcdGFjdGlvbnMuZm9yRWFjaChpID0+IG1hY0FwcGxpY2F0aW9uTWVudS5hcHBlbmQoaSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjb25maXJtQmVmb3JlUXVpdChldmVudDogS2V5Ym9hcmRFdmVudCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICh0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dDb3VudCgpID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gbmV2ZXIgY29uZmlybSB3aGVuIG5vIHdpbmRvd3MgYXJlIG9wZW5lZFxuXHRcdH1cblxuXHRcdGNvbnN0IGNvbmZpcm1CZWZvcmVDbG9zZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J2Fsd2F5cycgfCAnbmV2ZXInIHwgJ2tleWJvYXJkT25seSc+KCd3aW5kb3cuY29uZmlybUJlZm9yZUNsb3NlJyk7XG5cdFx0aWYgKGNvbmZpcm1CZWZvcmVDbG9zZSA9PT0gJ2Fsd2F5cycgfHwgKGNvbmZpcm1CZWZvcmVDbG9zZSA9PT0gJ2tleWJvYXJkT25seScgJiYgdGhpcy5pc0tleWJvYXJkRXZlbnQoZXZlbnQpKSkge1xuXHRcdFx0Y29uc3QgeyByZXNwb25zZSB9ID0gYXdhaXQgdGhpcy5uYXRpdmVIb3N0TWFpblNlcnZpY2Uuc2hvd01lc3NhZ2VCb3godGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0Rm9jdXNlZFdpbmRvdygpPy5pZCwge1xuXHRcdFx0XHR0eXBlOiAncXVlc3Rpb24nLFxuXHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0bmxzLmxvY2FsaXplKHsga2V5OiAncXVpdCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlF1aXRcIiksXG5cdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdjYW5jZWwnLCBcIkNhbmNlbFwiKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3F1aXRNZXNzYWdlJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gcXVpdD9cIilcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gcmVzcG9uc2UgPT09IDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZERyYXdNZW51KG1lbnVJZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0Ly8gV2UgbmVlZCB0byBkcmF3IGFuIGVtcHR5IG1lbnUgdG8gb3ZlcnJpZGUgdGhlIGVsZWN0cm9uIGRlZmF1bHRcblx0XHRpZiAoIWlzTWFjaW50b3NoICYmICFoYXNOYXRpdmVUaXRsZWJhcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAobWVudUlkKSB7XG5cdFx0XHRjYXNlICdGaWxlJzpcblx0XHRcdGNhc2UgJ0hlbHAnOlxuXHRcdFx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdFx0XHRyZXR1cm4gKHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0NvdW50KCkgPT09IDAgJiYgdGhpcy5jbG9zZWRMYXN0V2luZG93KSB8fCAodGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0V2luZG93Q291bnQoKSA+IDAgJiYgdGhpcy5ub0FjdGl2ZU1haW5XaW5kb3cpIHx8ICghIXRoaXMubWVudWJhck1lbnVzICYmICEhdGhpcy5tZW51YmFyTWVudXNbbWVudUlkXSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0Y2FzZSAnV2luZG93Jzpcblx0XHRcdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdFx0cmV0dXJuICh0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dDb3VudCgpID09PSAwICYmIHRoaXMuY2xvc2VkTGFzdFdpbmRvdykgfHwgKHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0NvdW50KCkgPiAwICYmIHRoaXMubm9BY3RpdmVNYWluV2luZG93KSB8fCAhIXRoaXMubWVudWJhck1lbnVzO1xuXHRcdFx0XHR9XG5cblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dDb3VudCgpID4gMCAmJiAoISF0aGlzLm1lbnViYXJNZW51cyAmJiAhIXRoaXMubWVudWJhck1lbnVzW21lbnVJZF0pO1xuXHRcdH1cblx0fVxuXG5cblx0cHJpdmF0ZSBzZXRNZW51KG1lbnU6IE1lbnUsIGl0ZW1zOiBBcnJheTxNZW51YmFyTWVudUl0ZW0+KSB7XG5cdFx0aXRlbXMuZm9yRWFjaCgoaXRlbTogTWVudWJhck1lbnVJdGVtKSA9PiB7XG5cdFx0XHRpZiAoaXNNZW51YmFyTWVudUl0ZW1TZXBhcmF0b3IoaXRlbSkpIHtcblx0XHRcdFx0bWVudS5hcHBlbmQoX19zZXBhcmF0b3JfXygpKTtcblx0XHRcdH0gZWxzZSBpZiAoaXNNZW51YmFyTWVudUl0ZW1TdWJtZW51KGl0ZW0pKSB7XG5cdFx0XHRcdGNvbnN0IHN1Ym1lbnUgPSBuZXcgTWVudSgpO1xuXHRcdFx0XHRjb25zdCBzdWJtZW51SXRlbSA9IG5ldyBNZW51SXRlbSh7IGxhYmVsOiB0aGlzLm1uZW1vbmljTGFiZWwoaXRlbS5sYWJlbCksIHN1Ym1lbnUgfSk7XG5cdFx0XHRcdHRoaXMuc2V0TWVudShzdWJtZW51LCBpdGVtLnN1Ym1lbnUuaXRlbXMpO1xuXHRcdFx0XHRtZW51LmFwcGVuZChzdWJtZW51SXRlbSk7XG5cdFx0XHR9IGVsc2UgaWYgKGlzTWVudWJhck1lbnVJdGVtUmVjZW50QWN0aW9uKGl0ZW0pKSB7XG5cdFx0XHRcdG1lbnUuYXBwZW5kKHRoaXMuY3JlYXRlT3BlblJlY2VudE1lbnVJdGVtKGl0ZW0pKTtcblx0XHRcdH0gZWxzZSBpZiAoaXNNZW51YmFyTWVudUl0ZW1BY3Rpb24oaXRlbSkpIHtcblx0XHRcdFx0aWYgKGl0ZW0uaWQgPT09ICd3b3JrYmVuY2guYWN0aW9uLnNob3dBYm91dERpYWxvZycpIHtcblx0XHRcdFx0XHR0aGlzLmluc2VydENoZWNrRm9yVXBkYXRlc0l0ZW1zKG1lbnUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdFx0aWYgKCh0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dDb3VudCgpID09PSAwICYmIHRoaXMuY2xvc2VkTGFzdFdpbmRvdykgfHxcblx0XHRcdFx0XHRcdCh0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dDb3VudCgpID4gMCAmJiB0aGlzLm5vQWN0aXZlTWFpbldpbmRvdykpIHtcblx0XHRcdFx0XHRcdC8vIEluIHRoZSBmYWxsYmFjayBzY2VuYXJpbywgd2UgYXJlIGVpdGhlciBkaXNhYmxlZCBvciB1c2luZyBhIGZhbGxiYWNrIGhhbmRsZXJcblx0XHRcdFx0XHRcdGlmICh0aGlzLmZhbGxiYWNrTWVudUhhbmRsZXJzW2l0ZW0uaWRdKSB7XG5cdFx0XHRcdFx0XHRcdG1lbnUuYXBwZW5kKG5ldyBNZW51SXRlbSh0aGlzLmxpa2VBY3Rpb24oaXRlbS5pZCwgeyBsYWJlbDogdGhpcy5tbmVtb25pY0xhYmVsKGl0ZW0ubGFiZWwpLCBjbGljazogdGhpcy5mYWxsYmFja01lbnVIYW5kbGVyc1tpdGVtLmlkXSB9KSkpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0bWVudS5hcHBlbmQodGhpcy5jcmVhdGVNZW51SXRlbShpdGVtLmxhYmVsLCBpdGVtLmlkLCBmYWxzZSwgaXRlbS5jaGVja2VkKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdG1lbnUuYXBwZW5kKHRoaXMuY3JlYXRlTWVudUl0ZW0oaXRlbS5sYWJlbCwgaXRlbS5pZCwgaXRlbS5lbmFibGVkID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZSwgISFpdGVtLmNoZWNrZWQpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWVudS5hcHBlbmQodGhpcy5jcmVhdGVNZW51SXRlbShpdGVtLmxhYmVsLCBpdGVtLmlkLCBpdGVtLmVuYWJsZWQgPT09IGZhbHNlID8gZmFsc2UgOiB0cnVlLCAhIWl0ZW0uY2hlY2tlZCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHNldE1lbnVCeUlkKG1lbnU6IE1lbnUsIG1lbnVJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubWVudWJhck1lbnVzICYmIHRoaXMubWVudWJhck1lbnVzW21lbnVJZF0pIHtcblx0XHRcdHRoaXMuc2V0TWVudShtZW51LCB0aGlzLm1lbnViYXJNZW51c1ttZW51SWRdLml0ZW1zKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGluc2VydENoZWNrRm9yVXBkYXRlc0l0ZW1zKG1lbnU6IE1lbnUpIHtcblx0XHRjb25zdCB1cGRhdGVJdGVtcyA9IHRoaXMuZ2V0VXBkYXRlTWVudUl0ZW1zKCk7XG5cdFx0aWYgKHVwZGF0ZUl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0dXBkYXRlSXRlbXMuZm9yRWFjaChpID0+IG1lbnUuYXBwZW5kKGkpKTtcblx0XHRcdG1lbnUuYXBwZW5kKF9fc2VwYXJhdG9yX18oKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVPcGVuUmVjZW50TWVudUl0ZW0oaXRlbTogSU1lbnViYXJNZW51UmVjZW50SXRlbUFjdGlvbik6IE1lbnVJdGVtIHtcblx0XHRjb25zdCByZXZpdmVkVXJpID0gVVJJLnJldml2ZShpdGVtLnVyaSk7XG5cdFx0Y29uc3QgY29tbWFuZElkID0gaXRlbS5pZDtcblx0XHRjb25zdCBvcGVuYWJsZTogSVdpbmRvd09wZW5hYmxlID1cblx0XHRcdChjb21tYW5kSWQgPT09ICdvcGVuUmVjZW50RmlsZScpID8geyBmaWxlVXJpOiByZXZpdmVkVXJpIH0gOlxuXHRcdFx0XHQoY29tbWFuZElkID09PSAnb3BlblJlY2VudFdvcmtzcGFjZScpID8geyB3b3Jrc3BhY2VVcmk6IHJldml2ZWRVcmkgfSA6IHsgZm9sZGVyVXJpOiByZXZpdmVkVXJpIH07XG5cblx0XHRyZXR1cm4gbmV3IE1lbnVJdGVtKHRoaXMubGlrZUFjdGlvbihjb21tYW5kSWQsIHtcblx0XHRcdGxhYmVsOiBpdGVtLmxhYmVsLFxuXHRcdFx0Y2xpY2s6IGFzeW5jIChtZW51SXRlbSwgd2luLCBldmVudCkgPT4ge1xuXHRcdFx0XHRjb25zdCBvcGVuSW5OZXdXaW5kb3cgPSB0aGlzLmlzT3B0aW9uQ2xpY2soZXZlbnQpO1xuXHRcdFx0XHRjb25zdCBzdWNjZXNzID0gKGF3YWl0IHRoaXMud2luZG93c01haW5TZXJ2aWNlLm9wZW4oe1xuXHRcdFx0XHRcdGNvbnRleHQ6IE9wZW5Db250ZXh0Lk1FTlUsXG5cdFx0XHRcdFx0Y2xpOiB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXJncyxcblx0XHRcdFx0XHR1cmlzVG9PcGVuOiBbb3BlbmFibGVdLFxuXHRcdFx0XHRcdGZvcmNlTmV3V2luZG93OiBvcGVuSW5OZXdXaW5kb3csXG5cdFx0XHRcdFx0Z290b0xpbmVNb2RlOiBmYWxzZSxcblx0XHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IGl0ZW0ucmVtb3RlQXV0aG9yaXR5XG5cdFx0XHRcdH0pKS5sZW5ndGggPiAwO1xuXG5cdFx0XHRcdGlmICghc3VjY2Vzcykge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMud29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZS5yZW1vdmVSZWNlbnRseU9wZW5lZChbcmV2aXZlZFVyaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSwgZmFsc2UpKTtcblx0fVxuXG5cdHByaXZhdGUgaXNPcHRpb25DbGljayhldmVudDogS2V5Ym9hcmRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIShldmVudCAmJiAoKCFpc01hY2ludG9zaCAmJiAoZXZlbnQuY3RybEtleSB8fCBldmVudC5zaGlmdEtleSkpIHx8IChpc01hY2ludG9zaCAmJiAoZXZlbnQubWV0YUtleSB8fCBldmVudC5hbHRLZXkpKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0tleWJvYXJkRXZlbnQoZXZlbnQ6IEtleWJvYXJkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISEoZXZlbnQudHJpZ2dlcmVkQnlBY2NlbGVyYXRvciB8fCBldmVudC5hbHRLZXkgfHwgZXZlbnQuY3RybEtleSB8fCBldmVudC5tZXRhS2V5IHx8IGV2ZW50LnNoaWZ0S2V5KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUm9sZU1lbnVJdGVtKGxhYmVsOiBzdHJpbmcsIGNvbW1hbmRJZDogc3RyaW5nLCByb2xlOiBhbnkpOiBNZW51SXRlbSB7XG5cdFx0Y29uc3Qgb3B0aW9uczogTWVudUl0ZW1Db25zdHJ1Y3Rvck9wdGlvbnMgPSB7XG5cdFx0XHRsYWJlbDogdGhpcy5tbmVtb25pY0xhYmVsKGxhYmVsKSxcblx0XHRcdHJvbGUsXG5cdFx0XHRlbmFibGVkOiB0cnVlXG5cdFx0fTtcblxuXHRcdHJldHVybiBuZXcgTWVudUl0ZW0odGhpcy53aXRoS2V5YmluZGluZyhjb21tYW5kSWQsIG9wdGlvbnMpKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0TWFjV2luZG93TWVudShtYWNXaW5kb3dNZW51OiBNZW51KTogdm9pZCB7XG5cdFx0Y29uc3QgbWluaW1pemUgPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogbmxzLmxvY2FsaXplKCdtTWluaW1pemUnLCBcIk1pbmltaXplXCIpLCByb2xlOiAnbWluaW1pemUnLCBhY2NlbGVyYXRvcjogJ0NvbW1hbmQrTScsIGVuYWJsZWQ6IHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0NvdW50KCkgPiAwIH0pO1xuXHRcdGNvbnN0IHpvb20gPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogbmxzLmxvY2FsaXplKCdtWm9vbScsIFwiWm9vbVwiKSwgcm9sZTogJ3pvb20nLCBlbmFibGVkOiB0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dDb3VudCgpID4gMCB9KTtcblx0XHRjb25zdCBicmluZ0FsbFRvRnJvbnQgPSBuZXcgTWVudUl0ZW0oeyBsYWJlbDogbmxzLmxvY2FsaXplKCdtQnJpbmdUb0Zyb250JywgXCJCcmluZyBBbGwgdG8gRnJvbnRcIiksIHJvbGU6ICdmcm9udCcsIGVuYWJsZWQ6IHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0NvdW50KCkgPiAwIH0pO1xuXHRcdGNvbnN0IHN3aXRjaFdpbmRvdyA9IHRoaXMuY3JlYXRlTWVudUl0ZW0obmxzLmxvY2FsaXplKHsga2V5OiAnbWlTd2l0Y2hXaW5kb3cnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiU3dpdGNoICYmV2luZG93Li4uXCIpLCAnd29ya2JlbmNoLmFjdGlvbi5zd2l0Y2hXaW5kb3cnKTtcblxuXHRcdGNvbnN0IG5hdGl2ZVRhYk1lbnVJdGVtczogTWVudUl0ZW1bXSA9IFtdO1xuXHRcdGlmICh0aGlzLmN1cnJlbnRFbmFibGVOYXRpdmVUYWJzKSB7XG5cdFx0XHRuYXRpdmVUYWJNZW51SXRlbXMucHVzaChfX3NlcGFyYXRvcl9fKCkpO1xuXG5cdFx0XHRuYXRpdmVUYWJNZW51SXRlbXMucHVzaCh0aGlzLmNyZWF0ZU1lbnVJdGVtKG5scy5sb2NhbGl6ZSgnbU5ld1RhYicsIFwiTmV3IFRhYlwiKSwgJ3dvcmtiZW5jaC5hY3Rpb24ubmV3V2luZG93VGFiJykpO1xuXG5cdFx0XHRuYXRpdmVUYWJNZW51SXRlbXMucHVzaCh0aGlzLmNyZWF0ZVJvbGVNZW51SXRlbShubHMubG9jYWxpemUoJ21TaG93UHJldmlvdXNUYWInLCBcIlNob3cgUHJldmlvdXMgVGFiXCIpLCAnd29ya2JlbmNoLmFjdGlvbi5zaG93UHJldmlvdXNXaW5kb3dUYWInLCAnc2VsZWN0UHJldmlvdXNUYWInKSk7XG5cdFx0XHRuYXRpdmVUYWJNZW51SXRlbXMucHVzaCh0aGlzLmNyZWF0ZVJvbGVNZW51SXRlbShubHMubG9jYWxpemUoJ21TaG93TmV4dFRhYicsIFwiU2hvdyBOZXh0IFRhYlwiKSwgJ3dvcmtiZW5jaC5hY3Rpb24uc2hvd05leHRXaW5kb3dUYWInLCAnc2VsZWN0TmV4dFRhYicpKTtcblx0XHRcdG5hdGl2ZVRhYk1lbnVJdGVtcy5wdXNoKHRoaXMuY3JlYXRlUm9sZU1lbnVJdGVtKG5scy5sb2NhbGl6ZSgnbU1vdmVUYWJUb05ld1dpbmRvdycsIFwiTW92ZSBUYWIgdG8gTmV3IFdpbmRvd1wiKSwgJ3dvcmtiZW5jaC5hY3Rpb24ubW92ZVdpbmRvd1RhYlRvTmV3V2luZG93JywgJ21vdmVUYWJUb05ld1dpbmRvdycpKTtcblx0XHRcdG5hdGl2ZVRhYk1lbnVJdGVtcy5wdXNoKHRoaXMuY3JlYXRlUm9sZU1lbnVJdGVtKG5scy5sb2NhbGl6ZSgnbU1lcmdlQWxsV2luZG93cycsIFwiTWVyZ2UgQWxsIFdpbmRvd3NcIiksICd3b3JrYmVuY2guYWN0aW9uLm1lcmdlQWxsV2luZG93VGFicycsICdtZXJnZUFsbFdpbmRvd3MnKSk7XG5cdFx0fVxuXG5cdFx0W1xuXHRcdFx0bWluaW1pemUsXG5cdFx0XHR6b29tLFxuXHRcdFx0X19zZXBhcmF0b3JfXygpLFxuXHRcdFx0c3dpdGNoV2luZG93LFxuXHRcdFx0Li4ubmF0aXZlVGFiTWVudUl0ZW1zLFxuXHRcdFx0X19zZXBhcmF0b3JfXygpLFxuXHRcdFx0YnJpbmdBbGxUb0Zyb250XG5cdFx0XS5mb3JFYWNoKGl0ZW0gPT4gbWFjV2luZG93TWVudS5hcHBlbmQoaXRlbSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRVcGRhdGVNZW51SXRlbXMoKTogTWVudUl0ZW1bXSB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLnVwZGF0ZVNlcnZpY2Uuc3RhdGU7XG5cblx0XHRzd2l0Y2ggKHN0YXRlLnR5cGUpIHtcblx0XHRcdGNhc2UgU3RhdGVUeXBlLklkbGU6XG5cdFx0XHRcdHJldHVybiBbbmV3IE1lbnVJdGVtKHtcblx0XHRcdFx0XHRsYWJlbDogdGhpcy5tbmVtb25pY0xhYmVsKG5scy5sb2NhbGl6ZSgnbWlDaGVja0ZvclVwZGF0ZXMnLCBcIkNoZWNrIGZvciAmJlVwZGF0ZXMuLi5cIikpLCBjbGljazogKCkgPT4gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnJlcG9ydE1lbnVBY3Rpb25UZWxlbWV0cnkoJ0NoZWNrRm9yVXBkYXRlJyk7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVNlcnZpY2UuY2hlY2tGb3JVcGRhdGVzKHRydWUpO1xuXHRcdFx0XHRcdH0sIDApXG5cdFx0XHRcdH0pXTtcblxuXHRcdFx0Y2FzZSBTdGF0ZVR5cGUuQ2hlY2tpbmdGb3JVcGRhdGVzOlxuXHRcdFx0XHRyZXR1cm4gW25ldyBNZW51SXRlbSh7IGxhYmVsOiBubHMubG9jYWxpemUoJ21pQ2hlY2tpbmdGb3JVcGRhdGVzJywgXCJDaGVja2luZyBmb3IgVXBkYXRlcy4uLlwiKSwgZW5hYmxlZDogZmFsc2UgfSldO1xuXG5cdFx0XHRjYXNlIFN0YXRlVHlwZS5BdmFpbGFibGVGb3JEb3dubG9hZDpcblx0XHRcdFx0cmV0dXJuIFtuZXcgTWVudUl0ZW0oe1xuXHRcdFx0XHRcdGxhYmVsOiB0aGlzLm1uZW1vbmljTGFiZWwobmxzLmxvY2FsaXplKCdtaURvd25sb2FkVXBkYXRlJywgXCJEJiZvd25sb2FkIEF2YWlsYWJsZSBVcGRhdGVcIikpLCBjbGljazogKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVTZXJ2aWNlLmRvd25sb2FkVXBkYXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KV07XG5cblx0XHRcdGNhc2UgU3RhdGVUeXBlLkRvd25sb2FkaW5nOlxuXHRcdFx0XHRyZXR1cm4gW25ldyBNZW51SXRlbSh7IGxhYmVsOiBubHMubG9jYWxpemUoJ21pRG93bmxvYWRpbmdVcGRhdGUnLCBcIkRvd25sb2FkaW5nIFVwZGF0ZS4uLlwiKSwgZW5hYmxlZDogZmFsc2UgfSldO1xuXG5cdFx0XHRjYXNlIFN0YXRlVHlwZS5Eb3dubG9hZGVkOlxuXHRcdFx0XHRyZXR1cm4gaXNNYWNpbnRvc2ggPyBbXSA6IFtuZXcgTWVudUl0ZW0oe1xuXHRcdFx0XHRcdGxhYmVsOiB0aGlzLm1uZW1vbmljTGFiZWwobmxzLmxvY2FsaXplKCdtaUluc3RhbGxVcGRhdGUnLCBcIkluc3RhbGwgJiZVcGRhdGUuLi5cIikpLCBjbGljazogKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5yZXBvcnRNZW51QWN0aW9uVGVsZW1ldHJ5KCdJbnN0YWxsVXBkYXRlJyk7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZVNlcnZpY2UuYXBwbHlVcGRhdGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXTtcblxuXHRcdFx0Y2FzZSBTdGF0ZVR5cGUuVXBkYXRpbmc6XG5cdFx0XHRcdHJldHVybiBbbmV3IE1lbnVJdGVtKHsgbGFiZWw6IG5scy5sb2NhbGl6ZSgnbWlJbnN0YWxsaW5nVXBkYXRlJywgXCJJbnN0YWxsaW5nIFVwZGF0ZS4uLlwiKSwgZW5hYmxlZDogZmFsc2UgfSldO1xuXG5cdFx0XHRjYXNlIFN0YXRlVHlwZS5SZWFkeTpcblx0XHRcdFx0cmV0dXJuIFtuZXcgTWVudUl0ZW0oe1xuXHRcdFx0XHRcdGxhYmVsOiB0aGlzLm1uZW1vbmljTGFiZWwobmxzLmxvY2FsaXplKCdtaVJlc3RhcnRUb1VwZGF0ZScsIFwiUmVzdGFydCB0byAmJlVwZGF0ZVwiKSksIGNsaWNrOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnJlcG9ydE1lbnVBY3Rpb25UZWxlbWV0cnkoJ1Jlc3RhcnRUb1VwZGF0ZScpO1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVTZXJ2aWNlLnF1aXRBbmRJbnN0YWxsKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KV07XG5cblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZU1lbnVJdGVtKGxhYmVsOiBzdHJpbmcsIGNvbW1hbmRJZDogc3RyaW5nIHwgc3RyaW5nW10sIGVuYWJsZWQ/OiBib29sZWFuLCBjaGVja2VkPzogYm9vbGVhbik6IE1lbnVJdGVtO1xuXHRwcml2YXRlIGNyZWF0ZU1lbnVJdGVtKGxhYmVsOiBzdHJpbmcsIGNsaWNrOiAoKSA9PiB2b2lkLCBlbmFibGVkPzogYm9vbGVhbiwgY2hlY2tlZD86IGJvb2xlYW4pOiBNZW51SXRlbTtcblx0cHJpdmF0ZSBjcmVhdGVNZW51SXRlbShhcmcxOiBzdHJpbmcsIGFyZzI6IGFueSwgYXJnMz86IGJvb2xlYW4sIGFyZzQ/OiBib29sZWFuKTogTWVudUl0ZW0ge1xuXHRcdGNvbnN0IGxhYmVsID0gdGhpcy5tbmVtb25pY0xhYmVsKGFyZzEpO1xuXHRcdGNvbnN0IGNsaWNrOiAoKSA9PiB2b2lkID0gKHR5cGVvZiBhcmcyID09PSAnZnVuY3Rpb24nKSA/IGFyZzIgOiAobWVudUl0ZW06IE1lbnVJdGVtICYgSU1lbnVJdGVtV2l0aEtleWJpbmRpbmcsIHdpbjogQnJvd3NlcldpbmRvdywgZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IHVzZXJTZXR0aW5nc0xhYmVsID0gbWVudUl0ZW0gPyBtZW51SXRlbS51c2VyU2V0dGluZ3NMYWJlbCA6IG51bGw7XG5cdFx0XHRsZXQgY29tbWFuZElkID0gYXJnMjtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGFyZzIpKSB7XG5cdFx0XHRcdGNvbW1hbmRJZCA9IHRoaXMuaXNPcHRpb25DbGljayhldmVudCkgPyBhcmcyWzFdIDogYXJnMlswXTsgLy8gc3VwcG9ydCBhbHRlcm5hdGl2ZSBhY3Rpb24gaWYgd2UgZ290IG11bHRpcGxlIGFjdGlvbiBJZHMgYW5kIHRoZSBvcHRpb24ga2V5IHdhcyBwcmVzc2VkIHdoaWxlIGludm9raW5nXG5cdFx0XHR9XG5cblx0XHRcdGlmICh1c2VyU2V0dGluZ3NMYWJlbCAmJiBldmVudC50cmlnZ2VyZWRCeUFjY2VsZXJhdG9yKSB7XG5cdFx0XHRcdHRoaXMucnVuQWN0aW9uSW5SZW5kZXJlcih7IHR5cGU6ICdrZXliaW5kaW5nJywgdXNlclNldHRpbmdzTGFiZWwgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnJ1bkFjdGlvbkluUmVuZGVyZXIoeyB0eXBlOiAnY29tbWFuZElkJywgY29tbWFuZElkIH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgZW5hYmxlZCA9IHR5cGVvZiBhcmczID09PSAnYm9vbGVhbicgPyBhcmczIDogdGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0V2luZG93Q291bnQoKSA+IDA7XG5cdFx0Y29uc3QgY2hlY2tlZCA9IHR5cGVvZiBhcmc0ID09PSAnYm9vbGVhbicgPyBhcmc0IDogZmFsc2U7XG5cblx0XHRjb25zdCBvcHRpb25zOiBNZW51SXRlbUNvbnN0cnVjdG9yT3B0aW9ucyA9IHtcblx0XHRcdGxhYmVsLFxuXHRcdFx0Y2xpY2ssXG5cdFx0XHRlbmFibGVkXG5cdFx0fTtcblxuXHRcdGlmIChjaGVja2VkKSB7XG5cdFx0XHRvcHRpb25zLnR5cGUgPSAnY2hlY2tib3gnO1xuXHRcdFx0b3B0aW9ucy5jaGVja2VkID0gY2hlY2tlZDtcblx0XHR9XG5cblx0XHRsZXQgY29tbWFuZElkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHR5cGVvZiBhcmcyID09PSAnc3RyaW5nJykge1xuXHRcdFx0Y29tbWFuZElkID0gYXJnMjtcblx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYXJnMikpIHtcblx0XHRcdGNvbW1hbmRJZCA9IGFyZzJbMF07XG5cdFx0fVxuXG5cdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cblx0XHRcdC8vIEFkZCByb2xlIGZvciBzcGVjaWFsIGNhc2UgbWVudSBpdGVtc1xuXHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ2VkaXRvci5hY3Rpb24uY2xpcGJvYXJkQ3V0QWN0aW9uJykge1xuXHRcdFx0XHRvcHRpb25zLnJvbGUgPSAnY3V0Jztcblx0XHRcdH0gZWxzZSBpZiAoY29tbWFuZElkID09PSAnZWRpdG9yLmFjdGlvbi5jbGlwYm9hcmRDb3B5QWN0aW9uJykge1xuXHRcdFx0XHRvcHRpb25zLnJvbGUgPSAnY29weSc7XG5cdFx0XHR9IGVsc2UgaWYgKGNvbW1hbmRJZCA9PT0gJ2VkaXRvci5hY3Rpb24uY2xpcGJvYXJkUGFzdGVBY3Rpb24nKSB7XG5cdFx0XHRcdG9wdGlvbnMucm9sZSA9ICdwYXN0ZSc7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFkZCBjb250ZXh0IGF3YXJlIGNsaWNrIGhhbmRsZXJzIGZvciBzcGVjaWFsIGNhc2UgbWVudSBpdGVtc1xuXHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ3VuZG8nKSB7XG5cdFx0XHRcdG9wdGlvbnMuY2xpY2sgPSB0aGlzLm1ha2VDb250ZXh0QXdhcmVDbGlja0hhbmRsZXIoY2xpY2ssIHtcblx0XHRcdFx0XHRpbkRldlRvb2xzOiBkZXZUb29scyA9PiBkZXZUb29scy51bmRvKCksXG5cdFx0XHRcdFx0aW5Ob1dpbmRvdzogKCkgPT4gTWVudS5zZW5kQWN0aW9uVG9GaXJzdFJlc3BvbmRlcigndW5kbzonKVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSBpZiAoY29tbWFuZElkID09PSAncmVkbycpIHtcblx0XHRcdFx0b3B0aW9ucy5jbGljayA9IHRoaXMubWFrZUNvbnRleHRBd2FyZUNsaWNrSGFuZGxlcihjbGljaywge1xuXHRcdFx0XHRcdGluRGV2VG9vbHM6IGRldlRvb2xzID0+IGRldlRvb2xzLnJlZG8oKSxcblx0XHRcdFx0XHRpbk5vV2luZG93OiAoKSA9PiBNZW51LnNlbmRBY3Rpb25Ub0ZpcnN0UmVzcG9uZGVyKCdyZWRvOicpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmIChjb21tYW5kSWQgPT09ICdlZGl0b3IuYWN0aW9uLnNlbGVjdEFsbCcpIHtcblx0XHRcdFx0b3B0aW9ucy5jbGljayA9IHRoaXMubWFrZUNvbnRleHRBd2FyZUNsaWNrSGFuZGxlcihjbGljaywge1xuXHRcdFx0XHRcdGluRGV2VG9vbHM6IGRldlRvb2xzID0+IGRldlRvb2xzLnNlbGVjdEFsbCgpLFxuXHRcdFx0XHRcdGluTm9XaW5kb3c6ICgpID0+IE1lbnUuc2VuZEFjdGlvblRvRmlyc3RSZXNwb25kZXIoJ3NlbGVjdEFsbDonKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IE1lbnVJdGVtKHRoaXMud2l0aEtleWJpbmRpbmcoY29tbWFuZElkLCBvcHRpb25zKSk7XG5cdH1cblxuXHRwcml2YXRlIG1ha2VDb250ZXh0QXdhcmVDbGlja0hhbmRsZXIoY2xpY2s6IChtZW51SXRlbTogTWVudUl0ZW0sIHdpbjogQmFzZVdpbmRvdywgZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHZvaWQsIGNvbnRleHRTcGVjaWZpY0hhbmRsZXJzOiBJTWVudUl0ZW1DbGlja0hhbmRsZXIpOiAobWVudUl0ZW06IE1lbnVJdGVtLCB3aW46IEJhc2VXaW5kb3cgfCB1bmRlZmluZWQsIGV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB2b2lkIHtcblx0XHRyZXR1cm4gKG1lbnVJdGVtOiBNZW51SXRlbSwgd2luOiBCYXNlV2luZG93IHwgdW5kZWZpbmVkLCBldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXG5cdFx0XHQvLyBObyBBY3RpdmUgV2luZG93XG5cdFx0XHRjb25zdCBhY3RpdmVXaW5kb3cgPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTtcblx0XHRcdGlmICghYWN0aXZlV2luZG93KSB7XG5cdFx0XHRcdHJldHVybiBjb250ZXh0U3BlY2lmaWNIYW5kbGVycy5pbk5vV2luZG93KCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIERldlRvb2xzIGZvY3VzZWRcblx0XHRcdGlmIChhY3RpdmVXaW5kb3cud2ViQ29udGVudHMuaXNEZXZUb29sc0ZvY3VzZWQoKSAmJlxuXHRcdFx0XHRhY3RpdmVXaW5kb3cud2ViQ29udGVudHMuZGV2VG9vbHNXZWJDb250ZW50cykge1xuXHRcdFx0XHRyZXR1cm4gY29udGV4dFNwZWNpZmljSGFuZGxlcnMuaW5EZXZUb29scyhhY3RpdmVXaW5kb3cud2ViQ29udGVudHMuZGV2VG9vbHNXZWJDb250ZW50cyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZpbmFsbHkgZXhlY3V0ZSBjb21tYW5kIGluIFdpbmRvd1xuXHRcdFx0Y2xpY2sobWVudUl0ZW0sIHdpbiB8fCBhY3RpdmVXaW5kb3csIGV2ZW50KTtcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBydW5BY3Rpb25JblJlbmRlcmVyKGludm9jYXRpb246IElNZW51SXRlbUludm9jYXRpb24pOiBib29sZWFuIHtcblxuXHRcdC8vIFdlIHdhbnQgdG8gc3VwcG9ydCBhdXhpbGlsYXJ5IHdpbmRvd3MgdGhhdCBtYXkgaGF2ZSBmb2N1cyBieVxuXHRcdC8vIHJldHVybmluZyB0aGVpciBwYXJlbnQgd2luZG93cyBhcyB0YXJnZXQgdG8gc3VwcG9ydCBydW5uaW5nXG5cdFx0Ly8gYWN0aW9ucyB2aWEgdGhlIG1haW4gd2luZG93LlxuXHRcdGxldCBhY3RpdmVCcm93c2VyV2luZG93ID0gQnJvd3NlcldpbmRvdy5nZXRGb2N1c2VkV2luZG93KCk7XG5cdFx0aWYgKGFjdGl2ZUJyb3dzZXJXaW5kb3cpIHtcblx0XHRcdGNvbnN0IGF1eGlsaWFyeVdpbmRvd0NhbmRpZGF0ZSA9IHRoaXMuYXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0J5V2ViQ29udGVudHMoYWN0aXZlQnJvd3NlcldpbmRvdy53ZWJDb250ZW50cyk7XG5cdFx0XHRpZiAoYXV4aWxpYXJ5V2luZG93Q2FuZGlkYXRlKSB7XG5cdFx0XHRcdGFjdGl2ZUJyb3dzZXJXaW5kb3cgPSB0aGlzLndpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dCeUlkKGF1eGlsaWFyeVdpbmRvd0NhbmRpZGF0ZS5wYXJlbnRJZCk/LndpbiA/PyBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFdlIG1ha2Ugc3VyZSB0byBub3QgcnVuIGFjdGlvbnMgd2hlbiB0aGUgd2luZG93IGhhcyBubyBmb2N1cywgdGhpcyBoZWxwc1xuXHRcdC8vIGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjU5MDcgYW5kIHNwZWNpZmljYWxseSBmb3Jcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTE5Mjhcblx0XHQvLyBTdGlsbCBhbGxvdyB0byBydW4gd2hlbiB0aGUgbGFzdCBhY3RpdmUgd2luZG93IGlzIG1pbmltaXplZCB0aG91Z2ggZm9yXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzYzMDAwXG5cdFx0aWYgKCFhY3RpdmVCcm93c2VyV2luZG93KSB7XG5cdFx0XHRjb25zdCBsYXN0QWN0aXZlV2luZG93ID0gdGhpcy53aW5kb3dzTWFpblNlcnZpY2UuZ2V0TGFzdEFjdGl2ZVdpbmRvdygpO1xuXHRcdFx0aWYgKGxhc3RBY3RpdmVXaW5kb3c/Lndpbj8uaXNNaW5pbWl6ZWQoKSkge1xuXHRcdFx0XHRhY3RpdmVCcm93c2VyV2luZG93ID0gbGFzdEFjdGl2ZVdpbmRvdy53aW47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gYWN0aXZlQnJvd3NlcldpbmRvdyA/IHRoaXMud2luZG93c01haW5TZXJ2aWNlLmdldFdpbmRvd0J5SWQoYWN0aXZlQnJvd3NlcldpbmRvdy5pZCkgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKGFjdGl2ZVdpbmRvdykge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdtZW51YmFyI3J1bkFjdGlvbkluUmVuZGVyZXInLCBpbnZvY2F0aW9uKTtcblxuXHRcdFx0aWYgKGlzTWFjaW50b3NoICYmICF0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuaXNCdWlsdCAmJiAhYWN0aXZlV2luZG93LmlzUmVhZHkpIHtcblx0XHRcdFx0aWYgKChpbnZvY2F0aW9uLnR5cGUgPT09ICdjb21tYW5kSWQnICYmIGludm9jYXRpb24uY29tbWFuZElkID09PSAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVEZXZUb29scycpIHx8IChpbnZvY2F0aW9uLnR5cGUgIT09ICdjb21tYW5kSWQnICYmIGludm9jYXRpb24udXNlclNldHRpbmdzTGFiZWwgPT09ICdhbHQrY21kK2knKSkge1xuXHRcdFx0XHRcdC8vIHByZXZlbnQgdGhpcyBhY3Rpb24gZnJvbSBydW5uaW5nIHR3aWNlIG9uIG1hY09TIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNjI3MTkpXG5cdFx0XHRcdFx0Ly8gd2UgYWxyZWFkeSByZWdpc3RlciBhIGtleWJpbmRpbmcgaW4gYm9vdHN0cmFwLXdpbmRvdy5qcyBmb3Igb3BlbmluZyBkZXZlbG9wZXIgdG9vbHMgaW4gY2FzZSBzb21ldGhpbmdcblx0XHRcdFx0XHQvLyBnb2VzIHdyb25nIGFuZCB0aGF0IGtleWJpbmRpbmcgaXMgb25seSByZW1vdmVkIHdoZW4gdGhlIGFwcGxpY2F0aW9uIGhhcyBsb2FkZWQgKD0gd2luZG93IHJlYWR5KS5cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGludm9jYXRpb24udHlwZSA9PT0gJ2NvbW1hbmRJZCcpIHtcblx0XHRcdFx0Y29uc3QgcnVuQWN0aW9uUGF5bG9hZDogSU5hdGl2ZVJ1bkFjdGlvbkluV2luZG93UmVxdWVzdCA9IHsgaWQ6IGludm9jYXRpb24uY29tbWFuZElkLCBmcm9tOiAnbWVudScgfTtcblx0XHRcdFx0YWN0aXZlV2luZG93LnNlbmRXaGVuUmVhZHkoJ3ZzY29kZTpydW5BY3Rpb24nLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lLCBydW5BY3Rpb25QYXlsb2FkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHJ1bktleWJpbmRpbmdQYXlsb2FkOiBJTmF0aXZlUnVuS2V5YmluZGluZ0luV2luZG93UmVxdWVzdCA9IHsgdXNlclNldHRpbmdzTGFiZWw6IGludm9jYXRpb24udXNlclNldHRpbmdzTGFiZWwgfTtcblx0XHRcdFx0YWN0aXZlV2luZG93LnNlbmRXaGVuUmVhZHkoJ3ZzY29kZTpydW5LZXliaW5kaW5nJywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSwgcnVuS2V5YmluZGluZ1BheWxvYWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdtZW51YmFyI3J1bkFjdGlvbkluUmVuZGVyZXI6IG5vIGFjdGl2ZSB3aW5kb3cgZm91bmQnLCBpbnZvY2F0aW9uKTtcblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgd2l0aEtleWJpbmRpbmcoY29tbWFuZElkOiBzdHJpbmcgfCB1bmRlZmluZWQsIG9wdGlvbnM6IE1lbnVJdGVtQ29uc3RydWN0b3JPcHRpb25zICYgSU1lbnVJdGVtV2l0aEtleWJpbmRpbmcpOiBNZW51SXRlbUNvbnN0cnVjdG9yT3B0aW9ucyB7XG5cdFx0Y29uc3QgYmluZGluZyA9IHR5cGVvZiBjb21tYW5kSWQgPT09ICdzdHJpbmcnID8gdGhpcy5rZXliaW5kaW5nc1tjb21tYW5kSWRdIDogdW5kZWZpbmVkO1xuXG5cdFx0Ly8gQXBwbHkgYmluZGluZyBpZiB0aGVyZSBpcyBvbmVcblx0XHRpZiAoYmluZGluZz8ubGFiZWwpIHtcblxuXHRcdFx0Ly8gaWYgdGhlIGJpbmRpbmcgaXMgbmF0aXZlLCB3ZSBjYW4ganVzdCBhcHBseSBpdFxuXHRcdFx0aWYgKGJpbmRpbmcuaXNOYXRpdmUgIT09IGZhbHNlKSB7XG5cdFx0XHRcdG9wdGlvbnMuYWNjZWxlcmF0b3IgPSBiaW5kaW5nLmxhYmVsO1xuXHRcdFx0XHRvcHRpb25zLnVzZXJTZXR0aW5nc0xhYmVsID0gYmluZGluZy51c2VyU2V0dGluZ3NMYWJlbDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdGhlIGtleWJpbmRpbmcgaXMgbm90IG5hdGl2ZSBzbyB3ZSBjYW5ub3Qgc2hvdyBpdCBhcyBwYXJ0IG9mIHRoZSBhY2NlbGVyYXRvciBvZlxuXHRcdFx0Ly8gdGhlIG1lbnUgaXRlbS4gd2UgZmFsbGJhY2sgdG8gYSBkaWZmZXJlbnQgc3RyYXRlZ3kgc28gdGhhdCB3ZSBhbHdheXMgZGlzcGxheSBpdFxuXHRcdFx0ZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMubGFiZWwgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbnN0IGJpbmRpbmdJbmRleCA9IG9wdGlvbnMubGFiZWwuaW5kZXhPZignWycpO1xuXHRcdFx0XHRpZiAoYmluZGluZ0luZGV4ID49IDApIHtcblx0XHRcdFx0XHRvcHRpb25zLmxhYmVsID0gYCR7b3B0aW9ucy5sYWJlbC5zdWJzdHIoMCwgYmluZGluZ0luZGV4KX0gWyR7YmluZGluZy5sYWJlbH1dYDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRvcHRpb25zLmxhYmVsID0gYCR7b3B0aW9ucy5sYWJlbH0gWyR7YmluZGluZy5sYWJlbH1dYDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVuc2V0IGJpbmRpbmdzIGlmIHRoZXJlIGlzIG5vbmVcblx0XHRlbHNlIHtcblx0XHRcdG9wdGlvbnMuYWNjZWxlcmF0b3IgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9wdGlvbnM7XG5cdH1cblxuXHRwcml2YXRlIGxpa2VBY3Rpb24oY29tbWFuZElkOiBzdHJpbmcsIG9wdGlvbnM6IE1lbnVJdGVtQ29uc3RydWN0b3JPcHRpb25zLCBzZXRBY2NlbGVyYXRvciA9ICFvcHRpb25zLmFjY2VsZXJhdG9yKTogTWVudUl0ZW1Db25zdHJ1Y3Rvck9wdGlvbnMge1xuXHRcdGlmIChzZXRBY2NlbGVyYXRvcikge1xuXHRcdFx0b3B0aW9ucyA9IHRoaXMud2l0aEtleWJpbmRpbmcoY29tbWFuZElkLCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRjb25zdCBvcmlnaW5hbENsaWNrID0gb3B0aW9ucy5jbGljaztcblx0XHRvcHRpb25zLmNsaWNrID0gKGl0ZW0sIHdpbmRvdywgZXZlbnQpID0+IHtcblx0XHRcdHRoaXMucmVwb3J0TWVudUFjdGlvblRlbGVtZXRyeShjb21tYW5kSWQpO1xuXHRcdFx0b3JpZ2luYWxDbGljaz8uKGl0ZW0sIHdpbmRvdywgZXZlbnQpO1xuXHRcdH07XG5cblx0XHRyZXR1cm4gb3B0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgb3BlblVybCh1cmw6IHN0cmluZywgaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMubmF0aXZlSG9zdE1haW5TZXJ2aWNlLm9wZW5FeHRlcm5hbCh1bmRlZmluZWQsIHVybCk7XG5cdFx0dGhpcy5yZXBvcnRNZW51QWN0aW9uVGVsZW1ldHJ5KGlkKTtcblx0fVxuXG5cdHByaXZhdGUgcmVwb3J0TWVudUFjdGlvblRlbGVtZXRyeShpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8V29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbj4oJ3dvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkJywgeyBpZCwgZnJvbTogdGVsZW1ldHJ5RnJvbSB9KTtcblx0fVxuXG5cdHByaXZhdGUgbW5lbW9uaWNMYWJlbChsYWJlbDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbW5lbW9uaWNNZW51TGFiZWwobGFiZWwsICF0aGlzLmN1cnJlbnRFbmFibGVNZW51QmFyTW5lbW9uaWNzKTtcblx0fVxufVxuXG5mdW5jdGlvbiBfX3NlcGFyYXRvcl9fKCk6IE1lbnVJdGVtIHtcblx0cmV0dXJuIG5ldyBNZW51SXRlbSh7IHR5cGU6ICdzZXBhcmF0b3InIH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLEtBQUssZUFBMEMsTUFBTSxnQkFBeUQ7QUFFdkgsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxhQUFhLGdCQUFnQjtBQUN0QyxTQUFTLFdBQVc7QUFDcEIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQXVGLHlCQUF5QiwrQkFBK0IsNEJBQTRCLGdDQUFpRDtBQUM1TixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQixpQkFBaUI7QUFDMUMsU0FBZ0cseUJBQXlCO0FBQ3pILFNBQW9DLHFCQUFxQixtQkFBbUI7QUFDNUUsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxrQkFBa0I7QUFFM0IsTUFBTSxnQkFBZ0I7QUFnQmYsSUFBTSxVQUFOLGNBQXNCLFdBQVc7QUFBQSxFQXNCdkMsWUFDa0MsZUFDTyxzQkFDRixvQkFDSSx3QkFDTixrQkFDWSw4QkFDaEIsY0FDUSxzQkFDVixZQUNXLHVCQUNQLGdCQUNhLDZCQUM5QztBQUNELFVBQU07QUFiMkI7QUFDTztBQUNGO0FBQ0k7QUFDTjtBQUNZO0FBQ2hCO0FBQ1E7QUFDVjtBQUNXO0FBQ1A7QUFDYTtBQWRoRCxTQUFpQix1QkFBb0ksdUJBQU8sT0FBTyxJQUFJO0FBa0J0SyxTQUFLLGNBQWMsSUFBSSxpQkFBaUIsTUFBTSxLQUFLLGFBQWEsR0FBRyxDQUFDO0FBRXBFLFNBQUssU0FBUyxJQUFJLGlCQUFpQixNQUFNO0FBQUUsV0FBSyxXQUFXLENBQUM7QUFBQSxJQUFHLEdBQUcsR0FBSztBQUV2RSxTQUFLLGVBQWUsdUJBQU8sT0FBTyxJQUFJO0FBQ3RDLFNBQUssY0FBYyx1QkFBTyxPQUFPLElBQUk7QUFFckMsUUFBSSxlQUFlLGtCQUFrQixvQkFBb0IsR0FBRztBQUMzRCxXQUFLLHlCQUF5QjtBQUFBLElBQy9CO0FBRUEsU0FBSyxvQkFBb0I7QUFFekIsU0FBSyxtQkFBbUI7QUFDeEIsU0FBSyxxQkFBcUI7QUFFMUIsU0FBSyxXQUFXLENBQUM7QUFFakIsU0FBSyxRQUFRO0FBRWIsU0FBSyxrQkFBa0I7QUFBQSxFQUN4QjtBQUFBLEVBRVEsMkJBQTJCO0FBQ2xDLFVBQU0sY0FBYyxLQUFLLGFBQWEsUUFBc0IsUUFBUSwwQkFBMEI7QUFDOUYsUUFBSSxhQUFhO0FBQ2hCLFVBQUksWUFBWSxPQUFPO0FBQ3RCLGFBQUssZUFBZSxZQUFZO0FBQUEsTUFDakM7QUFFQSxVQUFJLFlBQVksYUFBYTtBQUM1QixhQUFLLGNBQWMsWUFBWTtBQUFBLE1BQ2hDO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHNCQUE0QjtBQUduQyxTQUFLLHFCQUFxQix3Q0FBd0MsSUFBSSxDQUFDLFVBQVUsS0FBSyxVQUFVO0FBQy9GLFVBQUksQ0FBQyxLQUFLLG9CQUFvQixFQUFFLE1BQU0sYUFBYSxXQUFXLHlDQUF5QyxDQUFDLEdBQUc7QUFDMUcsYUFBSyxtQkFBbUIsZ0JBQWdCLEVBQUUsU0FBUyxZQUFZLE1BQU0saUJBQWlCLEtBQUssR0FBRyxDQUFDO0FBQUEsTUFDaEc7QUFBQSxJQUNEO0FBQ0EsU0FBSyxxQkFBcUIsNEJBQTRCLElBQUksQ0FBQyxVQUFVLEtBQUssVUFBVSxLQUFLLG1CQUFtQixnQkFBZ0IsRUFBRSxTQUFTLFlBQVksTUFBTSxpQkFBaUIsS0FBSyxHQUFHLENBQUM7QUFDbkwsU0FBSyxxQkFBcUIsdUNBQXVDLElBQUksQ0FBQyxVQUFVLEtBQUssVUFBVSxLQUFLLHNCQUFzQixzQkFBc0IsUUFBVyxFQUFFLGdCQUFnQixLQUFLLGNBQWMsS0FBSyxHQUFHLG9CQUFvQixFQUFFLE1BQU0sY0FBYyxFQUFFLENBQUM7QUFDclAsU0FBSyxxQkFBcUIsbUNBQW1DLElBQUksQ0FBQyxVQUFVLEtBQUssVUFBVSxLQUFLLHNCQUFzQixrQkFBa0IsUUFBVyxFQUFFLGdCQUFnQixLQUFLLGNBQWMsS0FBSyxHQUFHLG9CQUFvQixFQUFFLE1BQU0sY0FBYyxFQUFFLENBQUM7QUFDN08sU0FBSyxxQkFBcUIsZ0NBQWdDLElBQUksQ0FBQyxVQUFVLEtBQUssVUFBVSxLQUFLLHNCQUFzQixxQkFBcUIsUUFBVyxFQUFFLGdCQUFnQixLQUFLLGNBQWMsS0FBSyxHQUFHLG9CQUFvQixFQUFFLE1BQU0sY0FBYyxFQUFFLENBQUM7QUFHN08sU0FBSyxxQkFBcUIsbUNBQW1DLElBQUksTUFBTSxLQUFLLDZCQUE2QixvQkFBb0I7QUFBQSxNQUFFLFNBQVM7QUFBQTtBQUFBLElBQWdDLENBQUM7QUFHekssVUFBTSxhQUFhLEtBQUssZUFBZTtBQUN2QyxRQUFJLFlBQVk7QUFDZixXQUFLLHFCQUFxQixpQ0FBaUMsSUFBSSxNQUFNLEtBQUssUUFBUSxZQUFZLGdCQUFnQjtBQUFBLElBQy9HO0FBRUEsVUFBTSxvQkFBb0IsS0FBSyxlQUFlO0FBQzlDLFFBQUksbUJBQW1CO0FBQ3RCLFdBQUsscUJBQXFCLHdDQUF3QyxJQUFJLE1BQU0sS0FBSyxRQUFRLG1CQUFtQixrQkFBa0I7QUFBQSxJQUMvSDtBQUVBLFVBQU0saUJBQWlCLEtBQUssZUFBZTtBQUMzQyxRQUFJLGdCQUFnQjtBQUNuQixXQUFLLHFCQUFxQixvQ0FBb0MsSUFBSSxNQUFNLEtBQUssUUFBUSxnQkFBZ0Isa0JBQWtCO0FBQUEsSUFDeEg7QUFFQSxVQUFNLGFBQWEsS0FBSyxlQUFlO0FBQ3ZDLFFBQUksWUFBWTtBQUNmLFdBQUsscUJBQXFCLGlDQUFpQyxJQUFJLE1BQU07QUFDcEUsWUFBSSxVQUFVO0FBQ2IsZ0JBQU0sZUFBZSxXQUFXLFFBQVEsR0FBRyxJQUFJLElBQUksTUFBTTtBQUN6RCxlQUFLLFFBQVEsR0FBRyxVQUFVLEdBQUcsWUFBWSxRQUFRLFFBQVEsSUFBSSxnQkFBZ0I7QUFBQSxRQUM5RSxPQUFPO0FBQ04sZUFBSyxRQUFRLFlBQVksZ0JBQWdCO0FBQUEsUUFDMUM7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFVBQU0sc0JBQXNCLEtBQUssZUFBZTtBQUNoRCxRQUFJLHVCQUF1QixZQUFZO0FBQ3RDLFdBQUsscUJBQXFCLDBDQUEwQyxJQUFJLE1BQU07QUFDN0UsYUFBSyxRQUFRLHFCQUFxQixzQkFBc0I7QUFBQSxNQUN6RDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSxvQkFBMEI7QUFHakMsU0FBSyxVQUFVLEtBQUsscUJBQXFCLGVBQWUsTUFBTSxLQUFLLGVBQWUsSUFBSSxDQUFDO0FBR3ZGLFNBQUssVUFBVSxLQUFLLG1CQUFtQix3QkFBd0IsT0FBSyxLQUFLLHdCQUF3QixDQUFDLENBQUMsQ0FBQztBQUNwRyxTQUFLLFVBQVUsS0FBSyxzQkFBc0Isb0JBQW9CLE1BQU0sS0FBSyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ2xHLFNBQUssVUFBVSxLQUFLLHNCQUFzQixxQkFBcUIsTUFBTSxLQUFLLHVCQUF1QixDQUFDLENBQUM7QUFBQSxFQUNwRztBQUFBLEVBRUEsSUFBWSxnQ0FBeUM7QUFDcEQsVUFBTSx5QkFBeUIsS0FBSyxxQkFBcUIsU0FBUywrQkFBK0I7QUFDakcsUUFBSSxPQUFPLDJCQUEyQixXQUFXO0FBQ2hELGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLElBQVksMEJBQW1DO0FBQzlDLFFBQUksQ0FBQyxhQUFhO0FBQ2pCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxtQkFBbUIsS0FBSyxxQkFBcUIsU0FBUyxtQkFBbUI7QUFDL0UsUUFBSSxPQUFPLHFCQUFxQixXQUFXO0FBQzFDLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLFdBQVcsYUFBMkIsVUFBa0I7QUFDdkQsU0FBSyxlQUFlLFlBQVk7QUFDaEMsU0FBSyxjQUFjLFlBQVk7QUFHL0IsU0FBSyxhQUFhLFFBQVEsUUFBUSw0QkFBNEIsV0FBVztBQUV6RSxTQUFLLG1CQUFtQjtBQUFBLEVBQ3pCO0FBQUEsRUFHUSxxQkFBMkI7QUFDbEMsU0FBSyxZQUFZLFNBQVM7QUFBQSxFQUMzQjtBQUFBLEVBRVEsZUFBcUI7QUFPNUIsUUFBSSxDQUFDLEtBQUssY0FBYztBQUN2QjtBQUFBLFFBQVcsTUFBTTtBQUNoQixjQUFJLENBQUMsS0FBSyxjQUFjO0FBQ3ZCLGlCQUFLLFFBQVE7QUFBQSxVQUNkO0FBQUEsUUFDRDtBQUFBLFFBQUc7QUFBQTtBQUFBLE1BQWtGO0FBQUEsSUFDdEY7QUFBQSxFQUNEO0FBQUEsRUFFUSx3QkFBd0IsR0FBb0M7QUFDbkUsUUFBSSxDQUFDLGFBQWE7QUFDakI7QUFBQSxJQUNEO0FBR0EsUUFBSyxFQUFFLGFBQWEsS0FBSyxFQUFFLFdBQVcsS0FBTyxFQUFFLFdBQVcsS0FBSyxFQUFFLGFBQWEsR0FBSTtBQUNqRixXQUFLLG1CQUFtQixFQUFFLGFBQWE7QUFDdkMsV0FBSyxtQkFBbUI7QUFBQSxJQUN6QjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHlCQUErQjtBQUN0QyxRQUFJLENBQUMsYUFBYTtBQUNqQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLGdCQUFnQixjQUFjLGlCQUFpQjtBQUNyRCxTQUFLLHFCQUFxQixDQUFDLGlCQUFpQixDQUFDLENBQUMsS0FBSyw0QkFBNEIsdUJBQXVCLGNBQWMsV0FBVztBQUMvSCxTQUFLLG1CQUFtQjtBQUFBLEVBQ3pCO0FBQUEsRUFFUSxVQUFnQjtBQUd2QixVQUFNLFVBQVUsS0FBSyxtQkFBbUI7QUFDeEMsUUFBSSxTQUFTO0FBQ1osV0FBSyxTQUFTLEtBQUssT0FBTztBQUFBLElBQzNCO0FBSUEsUUFBSSxPQUFPLEtBQUssS0FBSyxZQUFZLEVBQUUsV0FBVyxHQUFHO0FBQ2hELFdBQUsscUJBQXFCLGNBQWMsSUFBSSxLQUFLLElBQUksSUFBSTtBQUN6RDtBQUFBLElBQ0Q7QUFHQSxVQUFNLFVBQVUsSUFBSSxLQUFLO0FBR3pCLFFBQUk7QUFDSixRQUFJLGFBQWE7QUFDaEIsWUFBTSxrQkFBa0IsSUFBSSxLQUFLO0FBQ2pDLCtCQUF5QixJQUFJLFNBQVMsRUFBRSxPQUFPLEtBQUssZUFBZSxXQUFXLFNBQVMsZ0JBQWdCLENBQUM7QUFDeEcsV0FBSyxzQkFBc0IsZUFBZTtBQUMxQyxjQUFRLE9BQU8sc0JBQXNCO0FBQUEsSUFDdEM7QUFHQSxRQUFJLGVBQWUsQ0FBQyxLQUFLLGtCQUFrQjtBQUMxQyxXQUFLLG1CQUFtQjtBQUV4QixZQUFNLFdBQVcsSUFBSSxLQUFLO0FBQzFCLGVBQVMsT0FBTyxJQUFJLFNBQVMsRUFBRSxPQUFPLEtBQUssY0FBYyxJQUFJLFNBQVMsRUFBRSxLQUFLLGVBQWUsU0FBUyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsY0FBYyxDQUFDLEdBQUcsT0FBTyxNQUFNLEtBQUssbUJBQW1CLGdCQUFnQixFQUFFLFNBQVMsWUFBWSxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7QUFFMU8sVUFBSSxLQUFLLFFBQVEsUUFBUTtBQUFBLElBQzFCO0FBR0EsUUFBSSxLQUFLLGVBQWUsTUFBTSxHQUFHO0FBQ2hDLFlBQU0sV0FBVyxJQUFJLEtBQUs7QUFDMUIsWUFBTSxlQUFlLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSyxjQUFjLElBQUksU0FBUyxFQUFFLEtBQUssU0FBUyxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxRQUFRLENBQUMsR0FBRyxTQUFTLFNBQVMsQ0FBQztBQUNoSyxXQUFLLFlBQVksVUFBVSxNQUFNO0FBQ2pDLGNBQVEsT0FBTyxZQUFZO0FBQUEsSUFDNUI7QUFHQSxRQUFJLEtBQUssZUFBZSxNQUFNLEdBQUc7QUFDaEMsWUFBTSxXQUFXLElBQUksS0FBSztBQUMxQixZQUFNLGVBQWUsSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLGNBQWMsSUFBSSxTQUFTLEVBQUUsS0FBSyxTQUFTLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLFFBQVEsQ0FBQyxHQUFHLFNBQVMsU0FBUyxDQUFDO0FBQ2hLLFdBQUssWUFBWSxVQUFVLE1BQU07QUFDakMsY0FBUSxPQUFPLFlBQVk7QUFBQSxJQUM1QjtBQUdBLFFBQUksS0FBSyxlQUFlLFdBQVcsR0FBRztBQUNyQyxZQUFNLGdCQUFnQixJQUFJLEtBQUs7QUFDL0IsWUFBTSxvQkFBb0IsSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLGNBQWMsSUFBSSxTQUFTLEVBQUUsS0FBSyxjQUFjLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLGFBQWEsQ0FBQyxHQUFHLFNBQVMsY0FBYyxDQUFDO0FBQ3BMLFdBQUssWUFBWSxlQUFlLFdBQVc7QUFDM0MsY0FBUSxPQUFPLGlCQUFpQjtBQUFBLElBQ2pDO0FBR0EsUUFBSSxLQUFLLGVBQWUsTUFBTSxHQUFHO0FBQ2hDLFlBQU0sV0FBVyxJQUFJLEtBQUs7QUFDMUIsWUFBTSxlQUFlLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSyxjQUFjLElBQUksU0FBUyxFQUFFLEtBQUssU0FBUyxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxRQUFRLENBQUMsR0FBRyxTQUFTLFNBQVMsQ0FBQztBQUNoSyxXQUFLLFlBQVksVUFBVSxNQUFNO0FBQ2pDLGNBQVEsT0FBTyxZQUFZO0FBQUEsSUFDNUI7QUFHQSxRQUFJLEtBQUssZUFBZSxJQUFJLEdBQUc7QUFDOUIsWUFBTSxXQUFXLElBQUksS0FBSztBQUMxQixZQUFNLGVBQWUsSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLGNBQWMsSUFBSSxTQUFTLEVBQUUsS0FBSyxTQUFTLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLE1BQU0sQ0FBQyxHQUFHLFNBQVMsU0FBUyxDQUFDO0FBQzlKLFdBQUssWUFBWSxVQUFVLElBQUk7QUFDL0IsY0FBUSxPQUFPLFlBQVk7QUFBQSxJQUM1QjtBQUdBLFFBQUksS0FBSyxlQUFlLEtBQUssR0FBRztBQUMvQixZQUFNLFlBQVksSUFBSSxLQUFLO0FBQzNCLFlBQU0sZ0JBQWdCLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSyxjQUFjLElBQUksU0FBUyxFQUFFLEtBQUssUUFBUSxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxPQUFPLENBQUMsR0FBRyxTQUFTLFVBQVUsQ0FBQztBQUNoSyxXQUFLLFlBQVksV0FBVyxLQUFLO0FBQ2pDLGNBQVEsT0FBTyxhQUFhO0FBQUEsSUFDN0I7QUFHQSxRQUFJLEtBQUssZUFBZSxVQUFVLEdBQUc7QUFDcEMsWUFBTSxlQUFlLElBQUksS0FBSztBQUM5QixZQUFNLG1CQUFtQixJQUFJLFNBQVMsRUFBRSxPQUFPLEtBQUssY0FBYyxJQUFJLFNBQVMsRUFBRSxLQUFLLGFBQWEsU0FBUyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsWUFBWSxDQUFDLEdBQUcsU0FBUyxhQUFhLENBQUM7QUFDaEwsV0FBSyxZQUFZLGNBQWMsVUFBVTtBQUN6QyxjQUFRLE9BQU8sZ0JBQWdCO0FBQUEsSUFDaEM7QUFHQSxRQUFJO0FBQ0osUUFBSSxLQUFLLGVBQWUsUUFBUSxHQUFHO0FBQ2xDLFlBQU0sYUFBYSxJQUFJLEtBQUs7QUFDNUIsMEJBQW9CLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSyxjQUFjLElBQUksU0FBUyxXQUFXLFFBQVEsQ0FBQyxHQUFHLFNBQVMsWUFBWSxNQUFNLFNBQVMsQ0FBQztBQUN0SSxXQUFLLGlCQUFpQixVQUFVO0FBQUEsSUFDakM7QUFFQSxRQUFJLG1CQUFtQjtBQUN0QixjQUFRLE9BQU8saUJBQWlCO0FBQUEsSUFDakM7QUFHQSxRQUFJLEtBQUssZUFBZSxNQUFNLEdBQUc7QUFDaEMsWUFBTSxXQUFXLElBQUksS0FBSztBQUMxQixZQUFNLGVBQWUsSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLGNBQWMsSUFBSSxTQUFTLEVBQUUsS0FBSyxTQUFTLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLFFBQVEsQ0FBQyxHQUFHLFNBQVMsVUFBVSxNQUFNLE9BQU8sQ0FBQztBQUM5SyxXQUFLLFlBQVksVUFBVSxNQUFNO0FBQ2pDLGNBQVEsT0FBTyxZQUFZO0FBQUEsSUFDNUI7QUFFQSxRQUFJLFFBQVEsU0FBUyxRQUFRLE1BQU0sU0FBUyxHQUFHO0FBQzlDLFdBQUsscUJBQXFCLE9BQU87QUFBQSxJQUNsQyxPQUFPO0FBQ04sV0FBSyxxQkFBcUIsSUFBSTtBQUFBLElBQy9CO0FBR0EsU0FBSyxPQUFPLFNBQVM7QUFBQSxFQUN0QjtBQUFBLEVBRVEscUJBQXFCLE1BQTZCO0FBYXpELFNBQUssbUJBQW1CLElBQUk7QUFFNUIsUUFBSSxNQUFNO0FBQ1QsaUJBQVcsVUFBVSxLQUFLLDRCQUE0QixXQUFXLEdBQUc7QUFDbkUsZUFBTyxLQUFLLFFBQVEsSUFBSTtBQUFBLE1BQ3pCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHNCQUFzQixvQkFBZ0M7QUFDN0QsVUFBTSxRQUFRLEtBQUssZUFBZSxJQUFJLFNBQVMsVUFBVSxhQUFhLEtBQUssZUFBZSxRQUFRLEdBQUcsa0NBQWtDO0FBQ3ZJLFVBQU0sa0JBQWtCLEtBQUssbUJBQW1CO0FBRWhELFFBQUk7QUFDSixRQUFJLEtBQUssZUFBZSxhQUFhLEdBQUc7QUFDdkMsWUFBTSxrQkFBa0IsSUFBSSxLQUFLO0FBQ2pDLFdBQUssWUFBWSxpQkFBaUIsYUFBYTtBQUMvQyxvQkFBYyxJQUFJLFNBQVMsRUFBRSxPQUFPLEtBQUssY0FBYyxJQUFJLFNBQVMsRUFBRSxLQUFLLGlCQUFpQixTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxlQUFlLENBQUMsR0FBRyxTQUFTLGdCQUFnQixDQUFDO0FBQUEsSUFDaEw7QUFFQSxVQUFNLGVBQWUsSUFBSSxLQUFLO0FBQzlCLFVBQU0sV0FBVyxJQUFJLFNBQVMsRUFBRSxPQUFPLElBQUksU0FBUyxhQUFhLFVBQVUsR0FBRyxNQUFNLFlBQVksU0FBUyxhQUFhLENBQUM7QUFDdkgsVUFBTSxPQUFPLElBQUksU0FBUyxFQUFFLE9BQU8sSUFBSSxTQUFTLFNBQVMsWUFBWSxLQUFLLGVBQWUsUUFBUSxHQUFHLE1BQU0sUUFBUSxhQUFhLFlBQVksQ0FBQztBQUM1SSxVQUFNLGFBQWEsSUFBSSxTQUFTLEVBQUUsT0FBTyxJQUFJLFNBQVMsZUFBZSxhQUFhLEdBQUcsTUFBTSxjQUFjLGFBQWEsZ0JBQWdCLENBQUM7QUFDdkksVUFBTSxVQUFVLElBQUksU0FBUyxFQUFFLE9BQU8sSUFBSSxTQUFTLFlBQVksVUFBVSxHQUFHLE1BQU0sU0FBUyxDQUFDO0FBQzVGLFVBQU0sT0FBTyxJQUFJLFNBQVMsS0FBSyxXQUFXLHlCQUF5QjtBQUFBLE1BQ2xFLE9BQU8sSUFBSSxTQUFTLFVBQVUsWUFBWSxLQUFLLGVBQWUsUUFBUTtBQUFBLE1BQUcsT0FBTyxPQUFPLE1BQU0sUUFBUSxVQUFVO0FBQzlHLGNBQU0sbUJBQW1CLEtBQUssbUJBQW1CLG9CQUFvQjtBQUNyRSxZQUNDLEtBQUssbUJBQW1CLGVBQWUsTUFBTTtBQUFBLFFBQzdDLENBQUMsQ0FBQyxjQUFjLGlCQUFpQjtBQUFBLFFBQ2pDLGtCQUFrQixLQUFLLFlBQVksR0FDbEM7QUFDRCxnQkFBTSxZQUFZLE1BQU0sS0FBSyxrQkFBa0IsS0FBSztBQUNwRCxjQUFJLFdBQVc7QUFDZCxpQkFBSyxzQkFBc0IsS0FBSyxNQUFTO0FBQUEsVUFDMUM7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxVQUFVLENBQUMsS0FBSztBQUN0QixZQUFRLEtBQUssR0FBRyxlQUFlO0FBRS9CLFFBQUksYUFBYTtBQUNoQixjQUFRLEtBQUssR0FBRztBQUFBLFFBQ2YsY0FBYztBQUFBLFFBQ2Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBRUEsWUFBUSxLQUFLLEdBQUc7QUFBQSxNQUNmLGNBQWM7QUFBQSxNQUNkO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZDtBQUFBLElBQ0QsQ0FBQztBQUVELFlBQVEsUUFBUSxPQUFLLG1CQUFtQixPQUFPLENBQUMsQ0FBQztBQUFBLEVBQ2xEO0FBQUEsRUFFQSxNQUFjLGtCQUFrQixPQUF3QztBQUN2RSxRQUFJLEtBQUssbUJBQW1CLGVBQWUsTUFBTSxHQUFHO0FBQ25ELGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxxQkFBcUIsS0FBSyxxQkFBcUIsU0FBOEMsMkJBQTJCO0FBQzlILFFBQUksdUJBQXVCLFlBQWEsdUJBQXVCLGtCQUFrQixLQUFLLGdCQUFnQixLQUFLLEdBQUk7QUFDOUcsWUFBTSxFQUFFLFNBQVMsSUFBSSxNQUFNLEtBQUssc0JBQXNCLGVBQWUsS0FBSyxtQkFBbUIsaUJBQWlCLEdBQUcsSUFBSTtBQUFBLFFBQ3BILE1BQU07QUFBQSxRQUNOLFNBQVM7QUFBQSxVQUNSLElBQUksU0FBUyxFQUFFLEtBQUssUUFBUSxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxRQUFRO0FBQUEsVUFDMUUsSUFBSSxTQUFTLFVBQVUsUUFBUTtBQUFBLFFBQ2hDO0FBQUEsUUFDQSxTQUFTLElBQUksU0FBUyxlQUFlLGdDQUFnQztBQUFBLE1BQ3RFLENBQUM7QUFFRCxhQUFPLGFBQWE7QUFBQSxJQUNyQjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxlQUFlLFFBQXlCO0FBRS9DLFFBQUksQ0FBQyxlQUFlLENBQUMsa0JBQWtCLEtBQUssb0JBQW9CLEdBQUc7QUFDbEUsYUFBTztBQUFBLElBQ1I7QUFFQSxZQUFRLFFBQVE7QUFBQSxNQUNmLEtBQUs7QUFBQSxNQUNMLEtBQUs7QUFDSixZQUFJLGFBQWE7QUFDaEIsaUJBQVEsS0FBSyxtQkFBbUIsZUFBZSxNQUFNLEtBQUssS0FBSyxvQkFBc0IsS0FBSyxtQkFBbUIsZUFBZSxJQUFJLEtBQUssS0FBSyxzQkFBd0IsQ0FBQyxDQUFDLEtBQUssZ0JBQWdCLENBQUMsQ0FBQyxLQUFLLGFBQWEsTUFBTTtBQUFBLFFBQ3BOO0FBQUEsTUFFRCxLQUFLO0FBQ0osWUFBSSxhQUFhO0FBQ2hCLGlCQUFRLEtBQUssbUJBQW1CLGVBQWUsTUFBTSxLQUFLLEtBQUssb0JBQXNCLEtBQUssbUJBQW1CLGVBQWUsSUFBSSxLQUFLLEtBQUssc0JBQXVCLENBQUMsQ0FBQyxLQUFLO0FBQUEsUUFDeks7QUFBQSxNQUVEO0FBQ0MsZUFBTyxLQUFLLG1CQUFtQixlQUFlLElBQUksTUFBTSxDQUFDLENBQUMsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDLEtBQUssYUFBYSxNQUFNO0FBQUEsSUFDM0c7QUFBQSxFQUNEO0FBQUEsRUFHUSxRQUFRLE1BQVksT0FBK0I7QUFDMUQsVUFBTSxRQUFRLENBQUMsU0FBMEI7QUFDeEMsVUFBSSwyQkFBMkIsSUFBSSxHQUFHO0FBQ3JDLGFBQUssT0FBTyxjQUFjLENBQUM7QUFBQSxNQUM1QixXQUFXLHlCQUF5QixJQUFJLEdBQUc7QUFDMUMsY0FBTSxVQUFVLElBQUksS0FBSztBQUN6QixjQUFNLGNBQWMsSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLGNBQWMsS0FBSyxLQUFLLEdBQUcsUUFBUSxDQUFDO0FBQ25GLGFBQUssUUFBUSxTQUFTLEtBQUssUUFBUSxLQUFLO0FBQ3hDLGFBQUssT0FBTyxXQUFXO0FBQUEsTUFDeEIsV0FBVyw4QkFBOEIsSUFBSSxHQUFHO0FBQy9DLGFBQUssT0FBTyxLQUFLLHlCQUF5QixJQUFJLENBQUM7QUFBQSxNQUNoRCxXQUFXLHdCQUF3QixJQUFJLEdBQUc7QUFDekMsWUFBSSxLQUFLLE9BQU8sb0NBQW9DO0FBQ25ELGVBQUssMkJBQTJCLElBQUk7QUFBQSxRQUNyQztBQUVBLFlBQUksYUFBYTtBQUNoQixjQUFLLEtBQUssbUJBQW1CLGVBQWUsTUFBTSxLQUFLLEtBQUssb0JBQzFELEtBQUssbUJBQW1CLGVBQWUsSUFBSSxLQUFLLEtBQUssb0JBQXFCO0FBRTNFLGdCQUFJLEtBQUsscUJBQXFCLEtBQUssRUFBRSxHQUFHO0FBQ3ZDLG1CQUFLLE9BQU8sSUFBSSxTQUFTLEtBQUssV0FBVyxLQUFLLElBQUksRUFBRSxPQUFPLEtBQUssY0FBYyxLQUFLLEtBQUssR0FBRyxPQUFPLEtBQUsscUJBQXFCLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQUEsWUFDekksT0FBTztBQUNOLG1CQUFLLE9BQU8sS0FBSyxlQUFlLEtBQUssT0FBTyxLQUFLLElBQUksT0FBTyxLQUFLLE9BQU8sQ0FBQztBQUFBLFlBQzFFO0FBQUEsVUFDRCxPQUFPO0FBQ04saUJBQUssT0FBTyxLQUFLLGVBQWUsS0FBSyxPQUFPLEtBQUssSUFBSSxLQUFLLFlBQVksUUFBUSxRQUFRLE1BQU0sQ0FBQyxDQUFDLEtBQUssT0FBTyxDQUFDO0FBQUEsVUFDNUc7QUFBQSxRQUNELE9BQU87QUFDTixlQUFLLE9BQU8sS0FBSyxlQUFlLEtBQUssT0FBTyxLQUFLLElBQUksS0FBSyxZQUFZLFFBQVEsUUFBUSxNQUFNLENBQUMsQ0FBQyxLQUFLLE9BQU8sQ0FBQztBQUFBLFFBQzVHO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLFlBQVksTUFBWSxRQUFzQjtBQUNyRCxRQUFJLEtBQUssZ0JBQWdCLEtBQUssYUFBYSxNQUFNLEdBQUc7QUFDbkQsV0FBSyxRQUFRLE1BQU0sS0FBSyxhQUFhLE1BQU0sRUFBRSxLQUFLO0FBQUEsSUFDbkQ7QUFBQSxFQUNEO0FBQUEsRUFFUSwyQkFBMkIsTUFBWTtBQUM5QyxVQUFNLGNBQWMsS0FBSyxtQkFBbUI7QUFDNUMsUUFBSSxZQUFZLFFBQVE7QUFDdkIsa0JBQVksUUFBUSxPQUFLLEtBQUssT0FBTyxDQUFDLENBQUM7QUFDdkMsV0FBSyxPQUFPLGNBQWMsQ0FBQztBQUFBLElBQzVCO0FBQUEsRUFDRDtBQUFBLEVBRVEseUJBQXlCLE1BQThDO0FBQzlFLFVBQU0sYUFBYSxJQUFJLE9BQU8sS0FBSyxHQUFHO0FBQ3RDLFVBQU0sWUFBWSxLQUFLO0FBQ3ZCLFVBQU0sV0FDSixjQUFjLG1CQUFvQixFQUFFLFNBQVMsV0FBVyxJQUN2RCxjQUFjLHdCQUF5QixFQUFFLGNBQWMsV0FBVyxJQUFJLEVBQUUsV0FBVyxXQUFXO0FBRWpHLFdBQU8sSUFBSSxTQUFTLEtBQUssV0FBVyxXQUFXO0FBQUEsTUFDOUMsT0FBTyxLQUFLO0FBQUEsTUFDWixPQUFPLE9BQU8sVUFBVSxLQUFLLFVBQVU7QUFDdEMsY0FBTSxrQkFBa0IsS0FBSyxjQUFjLEtBQUs7QUFDaEQsY0FBTSxXQUFXLE1BQU0sS0FBSyxtQkFBbUIsS0FBSztBQUFBLFVBQ25ELFNBQVMsWUFBWTtBQUFBLFVBQ3JCLEtBQUssS0FBSyx1QkFBdUI7QUFBQSxVQUNqQyxZQUFZLENBQUMsUUFBUTtBQUFBLFVBQ3JCLGdCQUFnQjtBQUFBLFVBQ2hCLGNBQWM7QUFBQSxVQUNkLGlCQUFpQixLQUFLO0FBQUEsUUFDdkIsQ0FBQyxHQUFHLFNBQVM7QUFFYixZQUFJLENBQUMsU0FBUztBQUNiLGdCQUFNLEtBQUssNkJBQTZCLHFCQUFxQixDQUFDLFVBQVUsQ0FBQztBQUFBLFFBQzFFO0FBQUEsTUFDRDtBQUFBLElBQ0QsR0FBRyxLQUFLLENBQUM7QUFBQSxFQUNWO0FBQUEsRUFFUSxjQUFjLE9BQStCO0FBQ3BELFdBQU8sQ0FBQyxFQUFFLFVBQVcsQ0FBQyxnQkFBZ0IsTUFBTSxXQUFXLE1BQU0sYUFBZSxnQkFBZ0IsTUFBTSxXQUFXLE1BQU07QUFBQSxFQUNwSDtBQUFBLEVBRVEsZ0JBQWdCLE9BQStCO0FBQ3RELFdBQU8sQ0FBQyxFQUFFLE1BQU0sMEJBQTBCLE1BQU0sVUFBVSxNQUFNLFdBQVcsTUFBTSxXQUFXLE1BQU07QUFBQSxFQUNuRztBQUFBLEVBRVEsbUJBQW1CLE9BQWUsV0FBbUIsTUFBcUI7QUFDakYsVUFBTSxVQUFzQztBQUFBLE1BQzNDLE9BQU8sS0FBSyxjQUFjLEtBQUs7QUFBQSxNQUMvQjtBQUFBLE1BQ0EsU0FBUztBQUFBLElBQ1Y7QUFFQSxXQUFPLElBQUksU0FBUyxLQUFLLGVBQWUsV0FBVyxPQUFPLENBQUM7QUFBQSxFQUM1RDtBQUFBLEVBRVEsaUJBQWlCLGVBQTJCO0FBQ25ELFVBQU0sV0FBVyxJQUFJLFNBQVMsRUFBRSxPQUFPLElBQUksU0FBUyxhQUFhLFVBQVUsR0FBRyxNQUFNLFlBQVksYUFBYSxhQUFhLFNBQVMsS0FBSyxtQkFBbUIsZUFBZSxJQUFJLEVBQUUsQ0FBQztBQUNqTCxVQUFNLE9BQU8sSUFBSSxTQUFTLEVBQUUsT0FBTyxJQUFJLFNBQVMsU0FBUyxNQUFNLEdBQUcsTUFBTSxRQUFRLFNBQVMsS0FBSyxtQkFBbUIsZUFBZSxJQUFJLEVBQUUsQ0FBQztBQUN2SSxVQUFNLGtCQUFrQixJQUFJLFNBQVMsRUFBRSxPQUFPLElBQUksU0FBUyxpQkFBaUIsb0JBQW9CLEdBQUcsTUFBTSxTQUFTLFNBQVMsS0FBSyxtQkFBbUIsZUFBZSxJQUFJLEVBQUUsQ0FBQztBQUN6SyxVQUFNLGVBQWUsS0FBSyxlQUFlLElBQUksU0FBUyxFQUFFLEtBQUssa0JBQWtCLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLG9CQUFvQixHQUFHLCtCQUErQjtBQUUzSyxVQUFNLHFCQUFpQyxDQUFDO0FBQ3hDLFFBQUksS0FBSyx5QkFBeUI7QUFDakMseUJBQW1CLEtBQUssY0FBYyxDQUFDO0FBRXZDLHlCQUFtQixLQUFLLEtBQUssZUFBZSxJQUFJLFNBQVMsV0FBVyxTQUFTLEdBQUcsK0JBQStCLENBQUM7QUFFaEgseUJBQW1CLEtBQUssS0FBSyxtQkFBbUIsSUFBSSxTQUFTLG9CQUFvQixtQkFBbUIsR0FBRywwQ0FBMEMsbUJBQW1CLENBQUM7QUFDcksseUJBQW1CLEtBQUssS0FBSyxtQkFBbUIsSUFBSSxTQUFTLGdCQUFnQixlQUFlLEdBQUcsc0NBQXNDLGVBQWUsQ0FBQztBQUNySix5QkFBbUIsS0FBSyxLQUFLLG1CQUFtQixJQUFJLFNBQVMsdUJBQXVCLHdCQUF3QixHQUFHLDZDQUE2QyxvQkFBb0IsQ0FBQztBQUNqTCx5QkFBbUIsS0FBSyxLQUFLLG1CQUFtQixJQUFJLFNBQVMsb0JBQW9CLG1CQUFtQixHQUFHLHVDQUF1QyxpQkFBaUIsQ0FBQztBQUFBLElBQ2pLO0FBRUE7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLE1BQ0EsY0FBYztBQUFBLE1BQ2Q7QUFBQSxNQUNBLEdBQUc7QUFBQSxNQUNILGNBQWM7QUFBQSxNQUNkO0FBQUEsSUFDRCxFQUFFLFFBQVEsVUFBUSxjQUFjLE9BQU8sSUFBSSxDQUFDO0FBQUEsRUFDN0M7QUFBQSxFQUVRLHFCQUFpQztBQUN4QyxVQUFNLFFBQVEsS0FBSyxjQUFjO0FBRWpDLFlBQVEsTUFBTSxNQUFNO0FBQUEsTUFDbkIsS0FBSyxVQUFVO0FBQ2QsZUFBTyxDQUFDLElBQUksU0FBUztBQUFBLFVBQ3BCLE9BQU8sS0FBSyxjQUFjLElBQUksU0FBUyxxQkFBcUIsd0JBQXdCLENBQUM7QUFBQSxVQUFHLE9BQU8sTUFBTSxXQUFXLE1BQU07QUFDckgsaUJBQUssMEJBQTBCLGdCQUFnQjtBQUMvQyxpQkFBSyxjQUFjLGdCQUFnQixJQUFJO0FBQUEsVUFDeEMsR0FBRyxDQUFDO0FBQUEsUUFDTCxDQUFDLENBQUM7QUFBQSxNQUVILEtBQUssVUFBVTtBQUNkLGVBQU8sQ0FBQyxJQUFJLFNBQVMsRUFBRSxPQUFPLElBQUksU0FBUyx3QkFBd0IseUJBQXlCLEdBQUcsU0FBUyxNQUFNLENBQUMsQ0FBQztBQUFBLE1BRWpILEtBQUssVUFBVTtBQUNkLGVBQU8sQ0FBQyxJQUFJLFNBQVM7QUFBQSxVQUNwQixPQUFPLEtBQUssY0FBYyxJQUFJLFNBQVMsb0JBQW9CLDZCQUE2QixDQUFDO0FBQUEsVUFBRyxPQUFPLE1BQU07QUFDeEcsaUJBQUssY0FBYyxlQUFlO0FBQUEsVUFDbkM7QUFBQSxRQUNELENBQUMsQ0FBQztBQUFBLE1BRUgsS0FBSyxVQUFVO0FBQ2QsZUFBTyxDQUFDLElBQUksU0FBUyxFQUFFLE9BQU8sSUFBSSxTQUFTLHVCQUF1Qix1QkFBdUIsR0FBRyxTQUFTLE1BQU0sQ0FBQyxDQUFDO0FBQUEsTUFFOUcsS0FBSyxVQUFVO0FBQ2QsZUFBTyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksU0FBUztBQUFBLFVBQ3ZDLE9BQU8sS0FBSyxjQUFjLElBQUksU0FBUyxtQkFBbUIscUJBQXFCLENBQUM7QUFBQSxVQUFHLE9BQU8sTUFBTTtBQUMvRixpQkFBSywwQkFBMEIsZUFBZTtBQUM5QyxpQkFBSyxjQUFjLFlBQVk7QUFBQSxVQUNoQztBQUFBLFFBQ0QsQ0FBQyxDQUFDO0FBQUEsTUFFSCxLQUFLLFVBQVU7QUFDZCxlQUFPLENBQUMsSUFBSSxTQUFTLEVBQUUsT0FBTyxJQUFJLFNBQVMsc0JBQXNCLHNCQUFzQixHQUFHLFNBQVMsTUFBTSxDQUFDLENBQUM7QUFBQSxNQUU1RyxLQUFLLFVBQVU7QUFDZCxlQUFPLENBQUMsSUFBSSxTQUFTO0FBQUEsVUFDcEIsT0FBTyxLQUFLLGNBQWMsSUFBSSxTQUFTLHFCQUFxQixxQkFBcUIsQ0FBQztBQUFBLFVBQUcsT0FBTyxNQUFNO0FBQ2pHLGlCQUFLLDBCQUEwQixpQkFBaUI7QUFDaEQsaUJBQUssY0FBYyxlQUFlO0FBQUEsVUFDbkM7QUFBQSxRQUNELENBQUMsQ0FBQztBQUFBLE1BRUg7QUFDQyxlQUFPLENBQUM7QUFBQSxJQUNWO0FBQUEsRUFDRDtBQUFBLEVBSVEsZUFBZSxNQUFjLE1BQVcsTUFBZ0IsTUFBMEI7QUFDekYsVUFBTSxRQUFRLEtBQUssY0FBYyxJQUFJO0FBQ3JDLFVBQU0sUUFBcUIsT0FBTyxTQUFTLGFBQWMsT0FBTyxDQUFDLFVBQThDLEtBQW9CLFVBQXlCO0FBQzNKLFlBQU0sb0JBQW9CLFdBQVcsU0FBUyxvQkFBb0I7QUFDbEUsVUFBSUEsYUFBWTtBQUNoQixVQUFJLE1BQU0sUUFBUSxJQUFJLEdBQUc7QUFDeEIsUUFBQUEsYUFBWSxLQUFLLGNBQWMsS0FBSyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUFBLE1BQ3pEO0FBRUEsVUFBSSxxQkFBcUIsTUFBTSx3QkFBd0I7QUFDdEQsYUFBSyxvQkFBb0IsRUFBRSxNQUFNLGNBQWMsa0JBQWtCLENBQUM7QUFBQSxNQUNuRSxPQUFPO0FBQ04sYUFBSyxvQkFBb0IsRUFBRSxNQUFNLGFBQWEsV0FBQUEsV0FBVSxDQUFDO0FBQUEsTUFDMUQ7QUFBQSxJQUNEO0FBQ0EsVUFBTSxVQUFVLE9BQU8sU0FBUyxZQUFZLE9BQU8sS0FBSyxtQkFBbUIsZUFBZSxJQUFJO0FBQzlGLFVBQU0sVUFBVSxPQUFPLFNBQVMsWUFBWSxPQUFPO0FBRW5ELFVBQU0sVUFBc0M7QUFBQSxNQUMzQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBLFFBQUksU0FBUztBQUNaLGNBQVEsT0FBTztBQUNmLGNBQVEsVUFBVTtBQUFBLElBQ25CO0FBRUEsUUFBSTtBQUNKLFFBQUksT0FBTyxTQUFTLFVBQVU7QUFDN0Isa0JBQVk7QUFBQSxJQUNiLFdBQVcsTUFBTSxRQUFRLElBQUksR0FBRztBQUMvQixrQkFBWSxLQUFLLENBQUM7QUFBQSxJQUNuQjtBQUVBLFFBQUksYUFBYTtBQUdoQixVQUFJLGNBQWMsb0NBQW9DO0FBQ3JELGdCQUFRLE9BQU87QUFBQSxNQUNoQixXQUFXLGNBQWMscUNBQXFDO0FBQzdELGdCQUFRLE9BQU87QUFBQSxNQUNoQixXQUFXLGNBQWMsc0NBQXNDO0FBQzlELGdCQUFRLE9BQU87QUFBQSxNQUNoQjtBQUdBLFVBQUksY0FBYyxRQUFRO0FBQ3pCLGdCQUFRLFFBQVEsS0FBSyw2QkFBNkIsT0FBTztBQUFBLFVBQ3hELFlBQVksY0FBWSxTQUFTLEtBQUs7QUFBQSxVQUN0QyxZQUFZLE1BQU0sS0FBSywyQkFBMkIsT0FBTztBQUFBLFFBQzFELENBQUM7QUFBQSxNQUNGLFdBQVcsY0FBYyxRQUFRO0FBQ2hDLGdCQUFRLFFBQVEsS0FBSyw2QkFBNkIsT0FBTztBQUFBLFVBQ3hELFlBQVksY0FBWSxTQUFTLEtBQUs7QUFBQSxVQUN0QyxZQUFZLE1BQU0sS0FBSywyQkFBMkIsT0FBTztBQUFBLFFBQzFELENBQUM7QUFBQSxNQUNGLFdBQVcsY0FBYywyQkFBMkI7QUFDbkQsZ0JBQVEsUUFBUSxLQUFLLDZCQUE2QixPQUFPO0FBQUEsVUFDeEQsWUFBWSxjQUFZLFNBQVMsVUFBVTtBQUFBLFVBQzNDLFlBQVksTUFBTSxLQUFLLDJCQUEyQixZQUFZO0FBQUEsUUFDL0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBRUEsV0FBTyxJQUFJLFNBQVMsS0FBSyxlQUFlLFdBQVcsT0FBTyxDQUFDO0FBQUEsRUFDNUQ7QUFBQSxFQUVRLDZCQUE2QixPQUE0RSx5QkFBaUk7QUFDalAsV0FBTyxDQUFDLFVBQW9CLEtBQTZCLFVBQXlCO0FBR2pGLFlBQU0sZUFBZSxjQUFjLGlCQUFpQjtBQUNwRCxVQUFJLENBQUMsY0FBYztBQUNsQixlQUFPLHdCQUF3QixXQUFXO0FBQUEsTUFDM0M7QUFHQSxVQUFJLGFBQWEsWUFBWSxrQkFBa0IsS0FDOUMsYUFBYSxZQUFZLHFCQUFxQjtBQUM5QyxlQUFPLHdCQUF3QixXQUFXLGFBQWEsWUFBWSxtQkFBbUI7QUFBQSxNQUN2RjtBQUdBLFlBQU0sVUFBVSxPQUFPLGNBQWMsS0FBSztBQUFBLElBQzNDO0FBQUEsRUFDRDtBQUFBLEVBRVEsb0JBQW9CLFlBQTBDO0FBS3JFLFFBQUksc0JBQXNCLGNBQWMsaUJBQWlCO0FBQ3pELFFBQUkscUJBQXFCO0FBQ3hCLFlBQU0sMkJBQTJCLEtBQUssNEJBQTRCLHVCQUF1QixvQkFBb0IsV0FBVztBQUN4SCxVQUFJLDBCQUEwQjtBQUM3Qiw4QkFBc0IsS0FBSyxtQkFBbUIsY0FBYyx5QkFBeUIsUUFBUSxHQUFHLE9BQU87QUFBQSxNQUN4RztBQUFBLElBQ0Q7QUFPQSxRQUFJLENBQUMscUJBQXFCO0FBQ3pCLFlBQU0sbUJBQW1CLEtBQUssbUJBQW1CLG9CQUFvQjtBQUNyRSxVQUFJLGtCQUFrQixLQUFLLFlBQVksR0FBRztBQUN6Qyw4QkFBc0IsaUJBQWlCO0FBQUEsTUFDeEM7QUFBQSxJQUNEO0FBRUEsVUFBTSxlQUFlLHNCQUFzQixLQUFLLG1CQUFtQixjQUFjLG9CQUFvQixFQUFFLElBQUk7QUFDM0csUUFBSSxjQUFjO0FBQ2pCLFdBQUssV0FBVyxNQUFNLCtCQUErQixVQUFVO0FBRS9ELFVBQUksZUFBZSxDQUFDLEtBQUssdUJBQXVCLFdBQVcsQ0FBQyxhQUFhLFNBQVM7QUFDakYsWUFBSyxXQUFXLFNBQVMsZUFBZSxXQUFXLGNBQWMscUNBQXVDLFdBQVcsU0FBUyxlQUFlLFdBQVcsc0JBQXNCLGFBQWM7QUFJekwsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUVBLFVBQUksV0FBVyxTQUFTLGFBQWE7QUFDcEMsY0FBTSxtQkFBb0QsRUFBRSxJQUFJLFdBQVcsV0FBVyxNQUFNLE9BQU87QUFDbkcscUJBQWEsY0FBYyxvQkFBb0Isa0JBQWtCLE1BQU0sZ0JBQWdCO0FBQUEsTUFDeEYsT0FBTztBQUNOLGNBQU0sdUJBQTRELEVBQUUsbUJBQW1CLFdBQVcsa0JBQWtCO0FBQ3BILHFCQUFhLGNBQWMsd0JBQXdCLGtCQUFrQixNQUFNLG9CQUFvQjtBQUFBLE1BQ2hHO0FBRUEsYUFBTztBQUFBLElBQ1IsT0FBTztBQUNOLFdBQUssV0FBVyxNQUFNLHVEQUF1RCxVQUFVO0FBRXZGLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUFBLEVBRVEsZUFBZSxXQUErQixTQUEyRjtBQUNoSixVQUFNLFVBQVUsT0FBTyxjQUFjLFdBQVcsS0FBSyxZQUFZLFNBQVMsSUFBSTtBQUc5RSxRQUFJLFNBQVMsT0FBTztBQUduQixVQUFJLFFBQVEsYUFBYSxPQUFPO0FBQy9CLGdCQUFRLGNBQWMsUUFBUTtBQUM5QixnQkFBUSxvQkFBb0IsUUFBUTtBQUFBLE1BQ3JDLFdBSVMsT0FBTyxRQUFRLFVBQVUsVUFBVTtBQUMzQyxjQUFNLGVBQWUsUUFBUSxNQUFNLFFBQVEsR0FBRztBQUM5QyxZQUFJLGdCQUFnQixHQUFHO0FBQ3RCLGtCQUFRLFFBQVEsR0FBRyxRQUFRLE1BQU0sT0FBTyxHQUFHLFlBQVksQ0FBQyxLQUFLLFFBQVEsS0FBSztBQUFBLFFBQzNFLE9BQU87QUFDTixrQkFBUSxRQUFRLEdBQUcsUUFBUSxLQUFLLEtBQUssUUFBUSxLQUFLO0FBQUEsUUFDbkQ7QUFBQSxNQUNEO0FBQUEsSUFDRCxPQUdLO0FBQ0osY0FBUSxjQUFjO0FBQUEsSUFDdkI7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsV0FBVyxXQUFtQixTQUFxQyxpQkFBaUIsQ0FBQyxRQUFRLGFBQXlDO0FBQzdJLFFBQUksZ0JBQWdCO0FBQ25CLGdCQUFVLEtBQUssZUFBZSxXQUFXLE9BQU87QUFBQSxJQUNqRDtBQUVBLFVBQU0sZ0JBQWdCLFFBQVE7QUFDOUIsWUFBUSxRQUFRLENBQUMsTUFBTSxRQUFRLFVBQVU7QUFDeEMsV0FBSywwQkFBMEIsU0FBUztBQUN4QyxzQkFBZ0IsTUFBTSxRQUFRLEtBQUs7QUFBQSxJQUNwQztBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxRQUFRLEtBQWEsSUFBa0I7QUFDOUMsU0FBSyxzQkFBc0IsYUFBYSxRQUFXLEdBQUc7QUFDdEQsU0FBSywwQkFBMEIsRUFBRTtBQUFBLEVBQ2xDO0FBQUEsRUFFUSwwQkFBMEIsSUFBa0I7QUFDbkQsU0FBSyxpQkFBaUIsV0FBZ0YsMkJBQTJCLEVBQUUsSUFBSSxNQUFNLGNBQWMsQ0FBQztBQUFBLEVBQzdKO0FBQUEsRUFFUSxjQUFjLE9BQXVCO0FBQzVDLFdBQU8sa0JBQWtCLE9BQU8sQ0FBQyxLQUFLLDZCQUE2QjtBQUFBLEVBQ3BFO0FBQ0Q7QUFqMEJhLFFBRVksNkJBQTZCO0FBRnpDLFVBQU47QUFBQSxFQXVCSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FsQ1U7QUFtMEJiLFNBQVMsZ0JBQTBCO0FBQ2xDLFNBQU8sSUFBSSxTQUFTLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDMUM7IiwKICAibmFtZXMiOiBbImNvbW1hbmRJZCJdCn0K
