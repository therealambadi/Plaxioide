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
import "./media/menubarControl.css";
import { localize, localize2 } from "../../../../nls.js";
import { IMenuService, MenuId, SubmenuItemAction, registerAction2, Action2, MenuItemAction, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { getMenuBarVisibility, hasNativeTitlebar, TitleBarSetting } from "../../../../platform/window/common/window.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { Action, SubmenuAction, Separator, ActionRunner, toAction } from "../../../../base/common/actions.js";
import { addDisposableListener, Dimension, EventType } from "../../../../base/browser/dom.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { isMacintosh, isWeb, isIOS, isNative } from "../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { isRecentFolder, isRecentWorkspace, IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { IUpdateService, StateType } from "../../../../platform/update/common/update.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { MenuBar } from "../../../../base/browser/ui/menu/menubar.js";
import { HorizontalDirection, VerticalDirection } from "../../../../base/browser/ui/menu/menu.js";
import { mnemonicMenuLabel, unmnemonicLabel } from "../../../../base/common/labels.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { isFullscreen, onDidChangeFullscreen } from "../../../../base/browser/browser.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { BrowserFeatures } from "../../../../base/browser/canIUse.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IsMacNativeContext, IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { OpenRecentAction } from "../../actions/windowActions.js";
import { isICommandActionToggleInfo } from "../../../../platform/action/common/action.js";
import { getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { defaultMenuStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { ActivityBarPosition } from "../../../services/layout/browser/layoutService.js";
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
  submenu: MenuId.MenubarFileMenu,
  title: {
    value: "File",
    original: "File",
    mnemonicTitle: localize({ key: "mFile", comment: ["&& denotes a mnemonic"] }, "&&File")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
  submenu: MenuId.MenubarEditMenu,
  title: {
    value: "Edit",
    original: "Edit",
    mnemonicTitle: localize({ key: "mEdit", comment: ["&& denotes a mnemonic"] }, "&&Edit")
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
  submenu: MenuId.MenubarSelectionMenu,
  title: {
    value: "Selection",
    original: "Selection",
    mnemonicTitle: localize({ key: "mSelection", comment: ["&& denotes a mnemonic"] }, "&&Selection")
  },
  order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
  submenu: MenuId.MenubarViewMenu,
  title: {
    value: "View",
    original: "View",
    mnemonicTitle: localize({ key: "mView", comment: ["&& denotes a mnemonic"] }, "&&View")
  },
  order: 4
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
  submenu: MenuId.MenubarGoMenu,
  title: {
    value: "Go",
    original: "Go",
    mnemonicTitle: localize({ key: "mGoto", comment: ["&& denotes a mnemonic"] }, "&&Go")
  },
  order: 5
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
  submenu: MenuId.MenubarTerminalMenu,
  title: {
    value: "Terminal",
    original: "Terminal",
    mnemonicTitle: localize({ key: "mTerminal", comment: ["&& denotes a mnemonic"] }, "&&Terminal")
  },
  order: 7
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
  submenu: MenuId.MenubarHelpMenu,
  title: {
    value: "Help",
    original: "Help",
    mnemonicTitle: localize({ key: "mHelp", comment: ["&& denotes a mnemonic"] }, "&&Help")
  },
  order: 8
});
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
  submenu: MenuId.MenubarPreferencesMenu,
  title: {
    value: "Preferences",
    original: "Preferences",
    mnemonicTitle: localize({ key: "mPreferences", comment: ["&& denotes a mnemonic"] }, "Preferences")
  },
  when: IsMacNativeContext,
  order: 9
});
const _MenubarControl = class _MenubarControl extends Disposable {
  constructor(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, hostService, commandService) {
    super();
    this.menuService = menuService;
    this.workspacesService = workspacesService;
    this.contextKeyService = contextKeyService;
    this.keybindingService = keybindingService;
    this.configurationService = configurationService;
    this.labelService = labelService;
    this.updateService = updateService;
    this.storageService = storageService;
    this.notificationService = notificationService;
    this.preferencesService = preferencesService;
    this.environmentService = environmentService;
    this.accessibilityService = accessibilityService;
    this.hostService = hostService;
    this.commandService = commandService;
    this.keys = [
      "window.menuBarVisibility",
      "window.enableMenuBarMnemonics",
      "window.customMenuBarAltFocus",
      "workbench.sideBar.location",
      "window.nativeTabs"
    ];
    this.menus = {};
    this.topLevelTitles = {};
    this.recentlyOpened = { files: [], workspaces: [] };
    this.mainMenu = this._register(this.menuService.createMenu(MenuId.MenubarMainMenu, this.contextKeyService));
    this.mainMenuDisposables = this._register(new DisposableStore());
    this.setupMainMenu();
    this.menuUpdater = this._register(new RunOnceScheduler(() => this.doUpdateMenubar(false), 200));
    this.notifyUserOfCustomMenubarAccessibility();
  }
  registerListeners() {
    this._register(this.hostService.onDidChangeFocus((e) => this.onDidChangeWindowFocus(e)));
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
    this._register(this.updateService.onStateChange(() => this.onUpdateStateChange()));
    this._register(this.workspacesService.onDidChangeRecentlyOpened(() => {
      this.onDidChangeRecentlyOpened();
    }));
    this._register(this.keybindingService.onDidUpdateKeybindings(() => this.updateMenubar()));
    this._register(this.labelService.onDidChangeFormatters(() => {
      this.onDidChangeRecentlyOpened();
    }));
    this._register(this.mainMenu.onDidChange(() => {
      this.setupMainMenu();
      this.doUpdateMenubar(true);
    }));
  }
  setupMainMenu() {
    this.mainMenuDisposables.clear();
    this.menus = {};
    this.topLevelTitles = {};
    const [, mainMenuActions] = this.mainMenu.getActions()[0];
    for (const mainMenuAction of mainMenuActions) {
      if (mainMenuAction instanceof SubmenuItemAction && typeof mainMenuAction.item.title !== "string") {
        this.menus[mainMenuAction.item.title.original] = this.mainMenuDisposables.add(this.menuService.createMenu(mainMenuAction.item.submenu, this.contextKeyService, { emitEventsForSubmenuChanges: true }));
        this.topLevelTitles[mainMenuAction.item.title.original] = mainMenuAction.item.title.mnemonicTitle ?? mainMenuAction.item.title.value;
      }
    }
  }
  updateMenubar() {
    this.menuUpdater.schedule();
  }
  calculateActionLabel(action) {
    const label = action.label;
    switch (action.id) {
      default:
        break;
    }
    return label;
  }
  onUpdateStateChange() {
    this.updateMenubar();
  }
  onUpdateKeybindings() {
    this.updateMenubar();
  }
  getOpenRecentActions() {
    if (!this.recentlyOpened) {
      return [];
    }
    const { workspaces, files } = this.recentlyOpened;
    const result = [];
    if (workspaces.length > 0) {
      for (let i = 0; i < _MenubarControl.MAX_MENU_RECENT_ENTRIES && i < workspaces.length; i++) {
        result.push(this.createOpenRecentMenuAction(workspaces[i]));
      }
      result.push(new Separator());
    }
    if (files.length > 0) {
      for (let i = 0; i < _MenubarControl.MAX_MENU_RECENT_ENTRIES && i < files.length; i++) {
        result.push(this.createOpenRecentMenuAction(files[i]));
      }
      result.push(new Separator());
    }
    return result;
  }
  onDidChangeWindowFocus(hasFocus) {
    if (hasFocus) {
      this.onDidChangeRecentlyOpened();
    }
  }
  onConfigurationUpdated(event) {
    if (this.keys.some((key) => event.affectsConfiguration(key))) {
      this.updateMenubar();
    }
    if (event.affectsConfiguration("editor.accessibilitySupport")) {
      this.notifyUserOfCustomMenubarAccessibility();
    }
    if (event.affectsConfiguration("window.menuBarVisibility")) {
      this.onDidChangeRecentlyOpened();
    }
  }
  get menubarHidden() {
    return isMacintosh && isNative ? false : getMenuBarVisibility(this.configurationService) === "hidden";
  }
  onDidChangeRecentlyOpened() {
    if (!this.menubarHidden) {
      this.workspacesService.getRecentlyOpened().then((recentlyOpened) => {
        this.recentlyOpened = recentlyOpened;
        this.updateMenubar();
      });
    }
  }
  createOpenRecentMenuAction(recent) {
    let label;
    let uri;
    let commandId;
    let openable;
    const remoteAuthority = recent.remoteAuthority;
    if (isRecentFolder(recent)) {
      uri = recent.folderUri;
      label = recent.label || this.labelService.getWorkspaceLabel(uri, { verbose: Verbosity.LONG });
      commandId = "openRecentFolder";
      openable = { folderUri: uri };
    } else if (isRecentWorkspace(recent)) {
      uri = recent.workspace.configPath;
      label = recent.label || this.labelService.getWorkspaceLabel(recent.workspace, { verbose: Verbosity.LONG });
      commandId = "openRecentWorkspace";
      openable = { workspaceUri: uri };
    } else {
      uri = recent.fileUri;
      label = recent.label || this.labelService.getUriLabel(uri, { appendWorkspaceSuffix: true });
      commandId = "openRecentFile";
      openable = { fileUri: uri };
    }
    const ret = toAction({
      id: commandId,
      label: unmnemonicLabel(label),
      run: (browserEvent) => {
        const openInNewWindow = browserEvent && (!isMacintosh && (browserEvent.ctrlKey || browserEvent.shiftKey) || isMacintosh && (browserEvent.metaKey || browserEvent.altKey));
        return this.hostService.openWindow([openable], {
          forceNewWindow: !!openInNewWindow,
          remoteAuthority: remoteAuthority || null
          // local window if remoteAuthority is not set or can not be deducted from the openable
        });
      }
    });
    return Object.assign(ret, { uri, remoteAuthority });
  }
  notifyUserOfCustomMenubarAccessibility() {
    if (isWeb || isMacintosh) {
      return;
    }
    const hasBeenNotified = this.storageService.getBoolean("menubar/accessibleMenubarNotified", StorageScope.APPLICATION, false);
    const usingCustomMenubar = !hasNativeTitlebar(this.configurationService);
    if (hasBeenNotified || usingCustomMenubar || !this.accessibilityService.isScreenReaderOptimized()) {
      return;
    }
    const message = localize("menubar.customTitlebarAccessibilityNotification", "Accessibility support is enabled for you. For the most accessible experience, we recommend the custom title bar style.");
    this.notificationService.prompt(Severity.Info, message, [
      {
        label: localize("goToSetting", "Open Settings"),
        run: () => {
          return this.preferencesService.openUserSettings({ query: TitleBarSetting.TITLE_BAR_STYLE });
        }
      }
    ]);
    this.storageService.store("menubar/accessibleMenubarNotified", true, StorageScope.APPLICATION, StorageTarget.USER);
  }
};
_MenubarControl.MAX_MENU_RECENT_ENTRIES = 10;
let MenubarControl = _MenubarControl;
let focusMenuBarEmitter = void 0;
function enableFocusMenuBarAction() {
  if (!focusMenuBarEmitter) {
    focusMenuBarEmitter = new Emitter();
    registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.actions.menubar.focus`,
          title: localize2("focusMenu", "Focus Application Menu"),
          keybinding: {
            primary: KeyMod.Alt | KeyCode.F10,
            weight: KeybindingWeight.WorkbenchContrib,
            when: IsWebContext
          },
          f1: true
        });
      }
      async run() {
        focusMenuBarEmitter?.fire();
      }
    });
  }
  return focusMenuBarEmitter;
}
let CustomMenubarControl = class extends MenubarControl {
  constructor(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, telemetryService, hostService, commandService) {
    super(menuService, workspacesService, contextKeyService, keybindingService, configurationService, labelService, updateService, storageService, notificationService, preferencesService, environmentService, accessibilityService, hostService, commandService);
    this.telemetryService = telemetryService;
    this.alwaysOnMnemonics = false;
    this.focusInsideMenubar = false;
    this.pendingFirstTimeUpdate = false;
    this.visible = true;
    this.webNavigationMenu = this._register(this.menuService.createMenu(MenuId.MenubarHomeMenu, this.contextKeyService));
    this.reinstallDisposables = this._register(new DisposableStore());
    this.updateActionsDisposables = this._register(new DisposableStore());
    this._onVisibilityChange = this._register(new Emitter());
    this._onFocusStateChange = this._register(new Emitter());
    this.actionRunner = this._register(new ActionRunner());
    this.actionRunner.onDidRun((e) => {
      this.telemetryService.publicLog2("workbenchActionExecuted", { id: e.action.id, from: "menu" });
    });
    this.workspacesService.getRecentlyOpened().then((recentlyOpened) => {
      this.recentlyOpened = recentlyOpened;
    });
    this.registerListeners();
  }
  doUpdateMenubar(firstTime) {
    if (!this.focusInsideMenubar) {
      this.setupCustomMenubar(firstTime);
    }
    if (firstTime) {
      this.pendingFirstTimeUpdate = true;
    }
  }
  getUpdateAction() {
    const state = this.updateService.state;
    switch (state.type) {
      case StateType.Idle:
        return new Action("update.check", localize({ key: "checkForUpdates", comment: ["&& denotes a mnemonic"] }, "Check for &&Updates..."), void 0, true, () => this.updateService.checkForUpdates(true));
      case StateType.CheckingForUpdates:
        return new Action("update.checking", localize("checkingForUpdates", "Checking for Updates..."), void 0, false);
      case StateType.AvailableForDownload:
        return new Action("update.downloadNow", localize({ key: "download now", comment: ["&& denotes a mnemonic"] }, "D&&ownload Update"), void 0, true, () => this.updateService.downloadUpdate());
      case StateType.Downloading:
        return new Action("update.downloading", localize("DownloadingUpdate", "Downloading Update..."), void 0, false);
      case StateType.Downloaded:
        return isMacintosh ? null : new Action("update.install", localize({ key: "installUpdate...", comment: ["&& denotes a mnemonic"] }, "Install &&Update..."), void 0, true, () => this.updateService.applyUpdate());
      case StateType.Updating:
        return new Action("update.updating", localize("installingUpdate", "Installing Update..."), void 0, false);
      case StateType.Ready:
        return new Action("update.restart", localize({ key: "restartToUpdate", comment: ["&& denotes a mnemonic"] }, "Restart to &&Update"), void 0, true, () => this.updateService.quitAndInstall());
      default:
        return null;
    }
  }
  get currentMenubarVisibility() {
    return getMenuBarVisibility(this.configurationService);
  }
  get currentDisableMenuBarAltFocus() {
    const settingValue = this.configurationService.getValue("window.customMenuBarAltFocus");
    let disableMenuBarAltBehavior = false;
    if (typeof settingValue === "boolean") {
      disableMenuBarAltBehavior = !settingValue;
    }
    return disableMenuBarAltBehavior;
  }
  insertActionsBefore(nextAction, target) {
    switch (nextAction.id) {
      case OpenRecentAction.ID:
        target.push(...this.getOpenRecentActions());
        break;
      case "workbench.action.showAboutDialog":
        if (!isMacintosh && !isWeb) {
          const updateAction = this.getUpdateAction();
          if (updateAction) {
            updateAction.label = mnemonicMenuLabel(updateAction.label);
            target.push(updateAction);
            target.push(new Separator());
          }
        }
        break;
      default:
        break;
    }
  }
  get currentEnableMenuBarMnemonics() {
    let enableMenuBarMnemonics = this.configurationService.getValue("window.enableMenuBarMnemonics");
    if (typeof enableMenuBarMnemonics !== "boolean") {
      enableMenuBarMnemonics = true;
    }
    return enableMenuBarMnemonics && (!isWeb || isFullscreen(mainWindow));
  }
  get currentCompactMenuMode() {
    if (this.currentMenubarVisibility !== "compact") {
      return void 0;
    }
    const currentSidebarLocation = this.configurationService.getValue("workbench.sideBar.location");
    const horizontalDirection = currentSidebarLocation === "right" ? HorizontalDirection.Left : HorizontalDirection.Right;
    const activityBarLocation = this.configurationService.getValue("workbench.activityBar.location");
    const verticalDirection = activityBarLocation === ActivityBarPosition.BOTTOM ? VerticalDirection.Above : VerticalDirection.Below;
    return { horizontal: horizontalDirection, vertical: verticalDirection };
  }
  onDidVisibilityChange(visible) {
    this.visible = visible;
    this.onDidChangeRecentlyOpened();
    this._onVisibilityChange.fire(visible);
  }
  toActionsArray(menu) {
    return getFlatContextMenuActions(menu.getActions({ shouldForwardArgs: true }));
  }
  setupCustomMenubar(firstTime) {
    if (!this.container) {
      return;
    }
    if (firstTime) {
      if (this.menubar) {
        this.reinstallDisposables.clear();
      }
      this.menubar = this.reinstallDisposables.add(new MenuBar(this.container, this.getMenuBarOptions(), defaultMenuStyles));
      this.accessibilityService.alwaysUnderlineAccessKeys().then((val) => {
        this.alwaysOnMnemonics = val;
        this.menubar?.update(this.getMenuBarOptions());
      });
      this.reinstallDisposables.add(this.menubar.onFocusStateChange((focused) => {
        this._onFocusStateChange.fire(focused);
        if (!focused) {
          if (this.pendingFirstTimeUpdate) {
            this.setupCustomMenubar(true);
            this.pendingFirstTimeUpdate = false;
          } else {
            this.updateMenubar();
          }
          this.focusInsideMenubar = false;
        }
      }));
      this.reinstallDisposables.add(this.menubar.onVisibilityChange((e) => this.onDidVisibilityChange(e)));
      this.reinstallDisposables.add(addDisposableListener(this.container, EventType.FOCUS_IN, () => {
        this.focusInsideMenubar = true;
      }));
      this.reinstallDisposables.add(addDisposableListener(this.container, EventType.FOCUS_OUT, () => {
        this.focusInsideMenubar = false;
      }));
      if (this.menubar.isVisible) {
        this.onDidVisibilityChange(true);
      }
    } else {
      this.menubar?.update(this.getMenuBarOptions());
    }
    const updateActions = (menuActions, target, topLevelTitle, store) => {
      target.splice(0);
      for (const menuItem of menuActions) {
        this.insertActionsBefore(menuItem, target);
        if (menuItem instanceof Separator) {
          target.push(menuItem);
        } else if (menuItem instanceof SubmenuItemAction || menuItem instanceof MenuItemAction) {
          let title = typeof menuItem.item.title === "string" ? menuItem.item.title : menuItem.item.title.mnemonicTitle ?? menuItem.item.title.value;
          if (menuItem instanceof SubmenuItemAction) {
            const submenuActions = [];
            updateActions(menuItem.actions, submenuActions, topLevelTitle, store);
            if (submenuActions.length > 0) {
              target.push(new SubmenuAction(menuItem.id, mnemonicMenuLabel(title), submenuActions));
            }
          } else {
            if (isICommandActionToggleInfo(menuItem.item.toggled)) {
              title = menuItem.item.toggled.mnemonicTitle ?? menuItem.item.toggled.title ?? title;
            }
            const newAction = store.add(new Action(menuItem.id, mnemonicMenuLabel(title), menuItem.class, menuItem.enabled, () => this.commandService.executeCommand(menuItem.id)));
            newAction.tooltip = menuItem.tooltip;
            newAction.checked = menuItem.checked;
            target.push(newAction);
          }
        }
      }
      if (topLevelTitle === "File" && this.currentCompactMenuMode === void 0) {
        const webActions = this.getWebNavigationActions();
        if (webActions.length) {
          target.push(...webActions);
        }
      }
    };
    for (const title of Object.keys(this.topLevelTitles)) {
      const menu = this.menus[title];
      if (firstTime && menu) {
        const menuChangedDisposable = this.reinstallDisposables.add(new DisposableStore());
        this.reinstallDisposables.add(menu.onDidChange(() => {
          if (!this.focusInsideMenubar) {
            const actions2 = [];
            menuChangedDisposable.clear();
            updateActions(this.toActionsArray(menu), actions2, title, menuChangedDisposable);
            this.menubar?.updateMenu({ actions: actions2, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
          }
        }));
        if (menu === this.menus.File) {
          const webMenuChangedDisposable = this.reinstallDisposables.add(new DisposableStore());
          this.reinstallDisposables.add(this.webNavigationMenu.onDidChange(() => {
            if (!this.focusInsideMenubar) {
              const actions2 = [];
              webMenuChangedDisposable.clear();
              updateActions(this.toActionsArray(menu), actions2, title, webMenuChangedDisposable);
              this.menubar?.updateMenu({ actions: actions2, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
            }
          }));
        }
      }
      const actions = [];
      if (menu) {
        this.updateActionsDisposables.clear();
        updateActions(this.toActionsArray(menu), actions, title, this.updateActionsDisposables);
      }
      if (this.menubar) {
        if (!firstTime) {
          this.menubar.updateMenu({ actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
        } else {
          this.menubar.push({ actions, label: mnemonicMenuLabel(this.topLevelTitles[title]) });
        }
      }
    }
  }
  getWebNavigationActions() {
    if (!isWeb) {
      return [];
    }
    const webNavigationActions = [];
    for (const groups of this.webNavigationMenu.getActions()) {
      const [, actions] = groups;
      for (const action of actions) {
        if (action instanceof MenuItemAction) {
          const title = typeof action.item.title === "string" ? action.item.title : action.item.title.mnemonicTitle ?? action.item.title.value;
          webNavigationActions.push(new Action(action.id, mnemonicMenuLabel(title), action.class, action.enabled, async (event) => {
            this.commandService.executeCommand(action.id, event);
          }));
        }
      }
      webNavigationActions.push(new Separator());
    }
    if (webNavigationActions.length) {
      webNavigationActions.pop();
    }
    return webNavigationActions;
  }
  getMenuBarOptions() {
    return {
      enableMnemonics: this.currentEnableMenuBarMnemonics,
      disableAltFocus: this.currentDisableMenuBarAltFocus,
      visibility: this.currentMenubarVisibility,
      actionRunner: this.actionRunner,
      getKeybinding: (action) => this.keybindingService.lookupKeybinding(action.id),
      alwaysOnMnemonics: this.alwaysOnMnemonics,
      compactMode: this.currentCompactMenuMode,
      getCompactMenuActions: () => {
        if (!isWeb) {
          return [];
        }
        return this.getWebNavigationActions();
      }
    };
  }
  onDidChangeWindowFocus(hasFocus) {
    if (!this.visible) {
      return;
    }
    super.onDidChangeWindowFocus(hasFocus);
    if (this.container) {
      if (hasFocus) {
        this.container.classList.remove("inactive");
      } else {
        this.container.classList.add("inactive");
        this.menubar?.blur();
      }
    }
  }
  onUpdateStateChange() {
    if (!this.visible) {
      return;
    }
    super.onUpdateStateChange();
  }
  onDidChangeRecentlyOpened() {
    if (!this.visible) {
      return;
    }
    super.onDidChangeRecentlyOpened();
  }
  onUpdateKeybindings() {
    if (!this.visible) {
      return;
    }
    super.onUpdateKeybindings();
  }
  registerListeners() {
    super.registerListeners();
    this._register(addDisposableListener(mainWindow, EventType.RESIZE, () => {
      if (this.menubar && !(isIOS && BrowserFeatures.pointerEvents)) {
        this.menubar.blur();
      }
    }));
    if (isWeb) {
      this._register(onDidChangeFullscreen((windowId) => {
        if (windowId === mainWindow.vscodeWindowId) {
          this.updateMenubar();
        }
      }));
      this._register(this.webNavigationMenu.onDidChange(() => this.updateMenubar()));
      this._register(enableFocusMenuBarAction().event(() => this.menubar?.toggleFocus()));
    }
  }
  get onVisibilityChange() {
    return this._onVisibilityChange.event;
  }
  get onFocusStateChange() {
    return this._onFocusStateChange.event;
  }
  getMenubarItemsDimensions() {
    if (this.menubar) {
      return new Dimension(this.menubar.getWidth(), this.menubar.getHeight());
    }
    return new Dimension(0, 0);
  }
  create(parent) {
    this.container = parent;
    if (this.container) {
      this.doUpdateMenubar(true);
    }
    return this.container;
  }
  layout(dimension) {
    this.menubar?.update(this.getMenuBarOptions());
  }
  toggleFocus() {
    this.menubar?.toggleFocus();
  }
};
CustomMenubarControl = __decorateClass([
  __decorateParam(0, IMenuService),
  __decorateParam(1, IWorkspacesService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IUpdateService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, IPreferencesService),
  __decorateParam(10, IWorkbenchEnvironmentService),
  __decorateParam(11, IAccessibilityService),
  __decorateParam(12, ITelemetryService),
  __decorateParam(13, IHostService),
  __decorateParam(14, ICommandService)
], CustomMenubarControl);
export {
  CustomMenubarControl,
  MenubarControl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy90aXRsZWJhci9tZW51YmFyQ29udHJvbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9tZW51YmFyQ29udHJvbC5jc3MnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCwgSU1lbnUsIFN1Ym1lbnVJdGVtQWN0aW9uLCByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIsIE1lbnVJdGVtQWN0aW9uLCBNZW51UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IE1lbnVCYXJWaXNpYmlsaXR5LCBJV2luZG93T3BlbmFibGUsIGdldE1lbnVCYXJWaXNpYmlsaXR5LCBoYXNOYXRpdmVUaXRsZWJhciwgVGl0bGVCYXJTZXR0aW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBBY3Rpb24sIFN1Ym1lbnVBY3Rpb24sIFNlcGFyYXRvciwgSUFjdGlvblJ1bm5lciwgQWN0aW9uUnVubmVyLCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uLCB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBEaW1lbnNpb24sIEV2ZW50VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCwgaXNXZWIsIGlzSU9TLCBpc05hdGl2ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSwgSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVJlY2VudGx5T3BlbmVkLCBpc1JlY2VudEZvbGRlciwgSVJlY2VudCwgaXNSZWNlbnRXb3Jrc3BhY2UsIElXb3Jrc3BhY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlLCBWZXJib3NpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSVVwZGF0ZVNlcnZpY2UsIFN0YXRlVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VwZGF0ZS9jb21tb24vdXBkYXRlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUHJlZmVyZW5jZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1lbnVCYXIsIElNZW51QmFyT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9tZW51L21lbnViYXIuanMnO1xuaW1wb3J0IHsgSG9yaXpvbnRhbERpcmVjdGlvbiwgSU1lbnVEaXJlY3Rpb24sIFZlcnRpY2FsRGlyZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL21lbnUvbWVudS5qcyc7XG5pbXBvcnQgeyBtbmVtb25pY01lbnVMYWJlbCwgdW5tbmVtb25pY0xhYmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGFiZWxzLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgaXNGdWxsc2NyZWVuLCBvbkRpZENoYW5nZUZ1bGxzY3JlZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvYnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBCcm93c2VyRmVhdHVyZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY2FuSVVzZS5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJc01hY05hdGl2ZUNvbnRleHQsIElzV2ViQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IE9wZW5SZWNlbnRBY3Rpb24gfSBmcm9tICcuLi8uLi9hY3Rpb25zL3dpbmRvd0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgaXNJQ29tbWFuZEFjdGlvblRvZ2dsZUluZm8gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IGRlZmF1bHRNZW51U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IEFjdGl2aXR5QmFyUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcblxuZXhwb3J0IHR5cGUgSU9wZW5SZWNlbnRBY3Rpb24gPSBJQWN0aW9uICYgeyB1cmk6IFVSSTsgcmVtb3RlQXV0aG9yaXR5Pzogc3RyaW5nIH07XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhck1haW5NZW51LCB7XG5cdHN1Ym1lbnU6IE1lbnVJZC5NZW51YmFyRmlsZU1lbnUsXG5cdHRpdGxlOiB7XG5cdFx0dmFsdWU6ICdGaWxlJyxcblx0XHRvcmlnaW5hbDogJ0ZpbGUnLFxuXHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbUZpbGUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZGaWxlXCIpLFxuXHR9LFxuXHRvcmRlcjogMVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhck1haW5NZW51LCB7XG5cdHN1Ym1lbnU6IE1lbnVJZC5NZW51YmFyRWRpdE1lbnUsXG5cdHRpdGxlOiB7XG5cdFx0dmFsdWU6ICdFZGl0Jyxcblx0XHRvcmlnaW5hbDogJ0VkaXQnLFxuXHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbUVkaXQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZFZGl0XCIpXG5cdH0sXG5cdG9yZGVyOiAyXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyTWFpbk1lbnUsIHtcblx0c3VibWVudTogTWVudUlkLk1lbnViYXJTZWxlY3Rpb25NZW51LFxuXHR0aXRsZToge1xuXHRcdHZhbHVlOiAnU2VsZWN0aW9uJyxcblx0XHRvcmlnaW5hbDogJ1NlbGVjdGlvbicsXG5cdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtU2VsZWN0aW9uJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU2VsZWN0aW9uXCIpXG5cdH0sXG5cdG9yZGVyOiAzXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyTWFpbk1lbnUsIHtcblx0c3VibWVudTogTWVudUlkLk1lbnViYXJWaWV3TWVudSxcblx0dGl0bGU6IHtcblx0XHR2YWx1ZTogJ1ZpZXcnLFxuXHRcdG9yaWdpbmFsOiAnVmlldycsXG5cdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtVmlldycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlZpZXdcIilcblx0fSxcblx0b3JkZXI6IDRcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJNYWluTWVudSwge1xuXHRzdWJtZW51OiBNZW51SWQuTWVudWJhckdvTWVudSxcblx0dGl0bGU6IHtcblx0XHR2YWx1ZTogJ0dvJyxcblx0XHRvcmlnaW5hbDogJ0dvJyxcblx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21Hb3RvJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmR29cIilcblx0fSxcblx0b3JkZXI6IDVcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJNYWluTWVudSwge1xuXHRzdWJtZW51OiBNZW51SWQuTWVudWJhclRlcm1pbmFsTWVudSxcblx0dGl0bGU6IHtcblx0XHR2YWx1ZTogJ1Rlcm1pbmFsJyxcblx0XHRvcmlnaW5hbDogJ1Rlcm1pbmFsJyxcblx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21UZXJtaW5hbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlRlcm1pbmFsXCIpXG5cdH0sXG5cdG9yZGVyOiA3XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyTWFpbk1lbnUsIHtcblx0c3VibWVudTogTWVudUlkLk1lbnViYXJIZWxwTWVudSxcblx0dGl0bGU6IHtcblx0XHR2YWx1ZTogJ0hlbHAnLFxuXHRcdG9yaWdpbmFsOiAnSGVscCcsXG5cdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtSGVscCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkhlbHBcIilcblx0fSxcblx0b3JkZXI6IDhcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJNYWluTWVudSwge1xuXHRzdWJtZW51OiBNZW51SWQuTWVudWJhclByZWZlcmVuY2VzTWVudSxcblx0dGl0bGU6IHtcblx0XHR2YWx1ZTogJ1ByZWZlcmVuY2VzJyxcblx0XHRvcmlnaW5hbDogJ1ByZWZlcmVuY2VzJyxcblx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21QcmVmZXJlbmNlcycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJQcmVmZXJlbmNlc1wiKVxuXHR9LFxuXHR3aGVuOiBJc01hY05hdGl2ZUNvbnRleHQsXG5cdG9yZGVyOiA5XG59KTtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIE1lbnViYXJDb250cm9sIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJvdGVjdGVkIGtleXMgPSBbXG5cdFx0J3dpbmRvdy5tZW51QmFyVmlzaWJpbGl0eScsXG5cdFx0J3dpbmRvdy5lbmFibGVNZW51QmFyTW5lbW9uaWNzJyxcblx0XHQnd2luZG93LmN1c3RvbU1lbnVCYXJBbHRGb2N1cycsXG5cdFx0J3dvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uJyxcblx0XHQnd2luZG93Lm5hdGl2ZVRhYnMnXG5cdF07XG5cblx0cHJvdGVjdGVkIG1haW5NZW51OiBJTWVudTtcblx0cHJvdGVjdGVkIG1lbnVzOiB7XG5cdFx0W2luZGV4OiBzdHJpbmddOiBJTWVudSB8IHVuZGVmaW5lZDtcblx0fSA9IHt9O1xuXG5cdHByb3RlY3RlZCB0b3BMZXZlbFRpdGxlczogeyBbbWVudTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgbWFpbk1lbnVEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXG5cdHByb3RlY3RlZCByZWNlbnRseU9wZW5lZDogSVJlY2VudGx5T3BlbmVkID0geyBmaWxlczogW10sIHdvcmtzcGFjZXM6IFtdIH07XG5cblx0cHJvdGVjdGVkIG1lbnVVcGRhdGVyOiBSdW5PbmNlU2NoZWR1bGVyO1xuXG5cdHByb3RlY3RlZCBzdGF0aWMgcmVhZG9ubHkgTUFYX01FTlVfUkVDRU5UX0VOVFJJRVMgPSAxMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgd29ya3NwYWNlc1NlcnZpY2U6IElXb3Jrc3BhY2VzU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSB1cGRhdGVTZXJ2aWNlOiBJVXBkYXRlU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHByZWZlcmVuY2VzU2VydmljZTogSVByZWZlcmVuY2VzU2VydmljZSxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBhY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlXG5cdCkge1xuXG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMubWFpbk1lbnUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLk1lbnViYXJNYWluTWVudSwgdGhpcy5jb250ZXh0S2V5U2VydmljZSkpO1xuXHRcdHRoaXMubWFpbk1lbnVEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0XHR0aGlzLnNldHVwTWFpbk1lbnUoKTtcblxuXHRcdHRoaXMubWVudVVwZGF0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmRvVXBkYXRlTWVudWJhcihmYWxzZSksIDIwMCkpO1xuXG5cdFx0dGhpcy5ub3RpZnlVc2VyT2ZDdXN0b21NZW51YmFyQWNjZXNzaWJpbGl0eSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGRvVXBkYXRlTWVudWJhcihmaXJzdFRpbWU6IGJvb2xlYW4pOiB2b2lkO1xuXG5cdHByb3RlY3RlZCByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHQvLyBMaXN0ZW4gZm9yIHdpbmRvdyBmb2N1cyBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ob3N0U2VydmljZS5vbkRpZENoYW5nZUZvY3VzKGUgPT4gdGhpcy5vbkRpZENoYW5nZVdpbmRvd0ZvY3VzKGUpKSk7XG5cblx0XHQvLyBVcGRhdGUgd2hlbiBjb25maWcgY2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4gdGhpcy5vbkNvbmZpZ3VyYXRpb25VcGRhdGVkKGUpKSk7XG5cblx0XHQvLyBMaXN0ZW4gdG8gdXBkYXRlIHNlcnZpY2Vcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnVwZGF0ZVNlcnZpY2Uub25TdGF0ZUNoYW5nZSgoKSA9PiB0aGlzLm9uVXBkYXRlU3RhdGVDaGFuZ2UoKSkpO1xuXG5cdFx0Ly8gTGlzdGVuIGZvciBjaGFuZ2VzIGluIHJlY2VudGx5IG9wZW5lZCBtZW51XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3Jrc3BhY2VzU2VydmljZS5vbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkKCgpID0+IHsgdGhpcy5vbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkKCk7IH0pKTtcblxuXHRcdC8vIExpc3RlbiB0byBrZXliaW5kaW5ncyBjaGFuZ2Vcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLm9uRGlkVXBkYXRlS2V5YmluZGluZ3MoKCkgPT4gdGhpcy51cGRhdGVNZW51YmFyKCkpKTtcblxuXHRcdC8vIFVwZGF0ZSByZWNlbnQgbWVudSBpdGVtcyBvbiBmb3JtYXR0ZXIgcmVnaXN0cmF0aW9uXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5sYWJlbFNlcnZpY2Uub25EaWRDaGFuZ2VGb3JtYXR0ZXJzKCgpID0+IHsgdGhpcy5vbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkKCk7IH0pKTtcblxuXHRcdC8vIExpc3RlbiBmb3IgY2hhbmdlcyBvbiB0aGUgbWFpbiBtZW51XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tYWluTWVudS5vbkRpZENoYW5nZSgoKSA9PiB7IHRoaXMuc2V0dXBNYWluTWVudSgpOyB0aGlzLmRvVXBkYXRlTWVudWJhcih0cnVlKTsgfSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHNldHVwTWFpbk1lbnUoKTogdm9pZCB7XG5cdFx0dGhpcy5tYWluTWVudURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5tZW51cyA9IHt9O1xuXHRcdHRoaXMudG9wTGV2ZWxUaXRsZXMgPSB7fTtcblxuXHRcdGNvbnN0IFssIG1haW5NZW51QWN0aW9uc10gPSB0aGlzLm1haW5NZW51LmdldEFjdGlvbnMoKVswXTtcblx0XHRmb3IgKGNvbnN0IG1haW5NZW51QWN0aW9uIG9mIG1haW5NZW51QWN0aW9ucykge1xuXHRcdFx0aWYgKG1haW5NZW51QWN0aW9uIGluc3RhbmNlb2YgU3VibWVudUl0ZW1BY3Rpb24gJiYgdHlwZW9mIG1haW5NZW51QWN0aW9uLml0ZW0udGl0bGUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHRoaXMubWVudXNbbWFpbk1lbnVBY3Rpb24uaXRlbS50aXRsZS5vcmlnaW5hbF0gPSB0aGlzLm1haW5NZW51RGlzcG9zYWJsZXMuYWRkKHRoaXMubWVudVNlcnZpY2UuY3JlYXRlTWVudShtYWluTWVudUFjdGlvbi5pdGVtLnN1Ym1lbnUsIHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHsgZW1pdEV2ZW50c0ZvclN1Ym1lbnVDaGFuZ2VzOiB0cnVlIH0pKTtcblx0XHRcdFx0dGhpcy50b3BMZXZlbFRpdGxlc1ttYWluTWVudUFjdGlvbi5pdGVtLnRpdGxlLm9yaWdpbmFsXSA9IG1haW5NZW51QWN0aW9uLml0ZW0udGl0bGUubW5lbW9uaWNUaXRsZSA/PyBtYWluTWVudUFjdGlvbi5pdGVtLnRpdGxlLnZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGVNZW51YmFyKCk6IHZvaWQge1xuXHRcdHRoaXMubWVudVVwZGF0ZXIuc2NoZWR1bGUoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjYWxjdWxhdGVBY3Rpb25MYWJlbChhY3Rpb246IHsgaWQ6IHN0cmluZzsgbGFiZWw6IHN0cmluZyB9KTogc3RyaW5nIHtcblx0XHRjb25zdCBsYWJlbCA9IGFjdGlvbi5sYWJlbDtcblx0XHRzd2l0Y2ggKGFjdGlvbi5pZCkge1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxhYmVsO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uVXBkYXRlU3RhdGVDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVNZW51YmFyKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb25VcGRhdGVLZXliaW5kaW5ncygpOiB2b2lkIHtcblx0XHR0aGlzLnVwZGF0ZU1lbnViYXIoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRPcGVuUmVjZW50QWN0aW9ucygpOiAoU2VwYXJhdG9yIHwgSU9wZW5SZWNlbnRBY3Rpb24pW10ge1xuXHRcdGlmICghdGhpcy5yZWNlbnRseU9wZW5lZCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgd29ya3NwYWNlcywgZmlsZXMgfSA9IHRoaXMucmVjZW50bHlPcGVuZWQ7XG5cblx0XHRjb25zdCByZXN1bHQgPSBbXTtcblxuXHRcdGlmICh3b3Jrc3BhY2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgTWVudWJhckNvbnRyb2wuTUFYX01FTlVfUkVDRU5UX0VOVFJJRVMgJiYgaSA8IHdvcmtzcGFjZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0cmVzdWx0LnB1c2godGhpcy5jcmVhdGVPcGVuUmVjZW50TWVudUFjdGlvbih3b3Jrc3BhY2VzW2ldKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJlc3VsdC5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgTWVudWJhckNvbnRyb2wuTUFYX01FTlVfUkVDRU5UX0VOVFJJRVMgJiYgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHRoaXMuY3JlYXRlT3BlblJlY2VudE1lbnVBY3Rpb24oZmlsZXNbaV0pKTtcblx0XHRcdH1cblxuXHRcdFx0cmVzdWx0LnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRGlkQ2hhbmdlV2luZG93Rm9jdXMoaGFzRm9jdXM6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHQvLyBXaGVuIHdlIHJlZ2FpbiBmb2N1cywgdXBkYXRlIHRoZSByZWNlbnQgbWVudSBpdGVtc1xuXHRcdGlmIChoYXNGb2N1cykge1xuXHRcdFx0dGhpcy5vbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbmZpZ3VyYXRpb25VcGRhdGVkKGV2ZW50OiBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMua2V5cy5zb21lKGtleSA9PiBldmVudC5hZmZlY3RzQ29uZmlndXJhdGlvbihrZXkpKSkge1xuXHRcdFx0dGhpcy51cGRhdGVNZW51YmFyKCk7XG5cdFx0fVxuXG5cdFx0aWYgKGV2ZW50LmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuYWNjZXNzaWJpbGl0eVN1cHBvcnQnKSkge1xuXHRcdFx0dGhpcy5ub3RpZnlVc2VyT2ZDdXN0b21NZW51YmFyQWNjZXNzaWJpbGl0eSgpO1xuXHRcdH1cblxuXHRcdC8vIFNpbmNlIHdlIHRyeSBub3QgdXBkYXRlIHdoZW4gaGlkZGVuLCB3ZSBzaG91bGRcblx0XHQvLyB0cnkgdG8gdXBkYXRlIHRoZSByZWNlbnRseSBvcGVuZWQgbGlzdCBvbiB2aXNpYmlsaXR5IGNoYW5nZXNcblx0XHRpZiAoZXZlbnQuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3dpbmRvdy5tZW51QmFyVmlzaWJpbGl0eScpKSB7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlUmVjZW50bHlPcGVuZWQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldCBtZW51YmFySGlkZGVuKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBpc01hY2ludG9zaCAmJiBpc05hdGl2ZSA/IGZhbHNlIDogZ2V0TWVudUJhclZpc2liaWxpdHkodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkgPT09ICdoaWRkZW4nO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRGlkQ2hhbmdlUmVjZW50bHlPcGVuZWQoKTogdm9pZCB7XG5cblx0XHQvLyBEbyBub3QgdXBkYXRlIHJlY2VudGx5IG9wZW5lZCB3aGVuIHRoZSBtZW51YmFyIGlzIGhpZGRlbiAjMTA4NzEyXG5cdFx0aWYgKCF0aGlzLm1lbnViYXJIaWRkZW4pIHtcblx0XHRcdHRoaXMud29ya3NwYWNlc1NlcnZpY2UuZ2V0UmVjZW50bHlPcGVuZWQoKS50aGVuKHJlY2VudGx5T3BlbmVkID0+IHtcblx0XHRcdFx0dGhpcy5yZWNlbnRseU9wZW5lZCA9IHJlY2VudGx5T3BlbmVkO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZU1lbnViYXIoKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlT3BlblJlY2VudE1lbnVBY3Rpb24ocmVjZW50OiBJUmVjZW50KTogSU9wZW5SZWNlbnRBY3Rpb24ge1xuXG5cdFx0bGV0IGxhYmVsOiBzdHJpbmc7XG5cdFx0bGV0IHVyaTogVVJJO1xuXHRcdGxldCBjb21tYW5kSWQ6IHN0cmluZztcblx0XHRsZXQgb3BlbmFibGU6IElXaW5kb3dPcGVuYWJsZTtcblx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSByZWNlbnQucmVtb3RlQXV0aG9yaXR5O1xuXG5cdFx0aWYgKGlzUmVjZW50Rm9sZGVyKHJlY2VudCkpIHtcblx0XHRcdHVyaSA9IHJlY2VudC5mb2xkZXJVcmk7XG5cdFx0XHRsYWJlbCA9IHJlY2VudC5sYWJlbCB8fCB0aGlzLmxhYmVsU2VydmljZS5nZXRXb3Jrc3BhY2VMYWJlbCh1cmksIHsgdmVyYm9zZTogVmVyYm9zaXR5LkxPTkcgfSk7XG5cdFx0XHRjb21tYW5kSWQgPSAnb3BlblJlY2VudEZvbGRlcic7XG5cdFx0XHRvcGVuYWJsZSA9IHsgZm9sZGVyVXJpOiB1cmkgfTtcblx0XHR9IGVsc2UgaWYgKGlzUmVjZW50V29ya3NwYWNlKHJlY2VudCkpIHtcblx0XHRcdHVyaSA9IHJlY2VudC53b3Jrc3BhY2UuY29uZmlnUGF0aDtcblx0XHRcdGxhYmVsID0gcmVjZW50LmxhYmVsIHx8IHRoaXMubGFiZWxTZXJ2aWNlLmdldFdvcmtzcGFjZUxhYmVsKHJlY2VudC53b3Jrc3BhY2UsIHsgdmVyYm9zZTogVmVyYm9zaXR5LkxPTkcgfSk7XG5cdFx0XHRjb21tYW5kSWQgPSAnb3BlblJlY2VudFdvcmtzcGFjZSc7XG5cdFx0XHRvcGVuYWJsZSA9IHsgd29ya3NwYWNlVXJpOiB1cmkgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dXJpID0gcmVjZW50LmZpbGVVcmk7XG5cdFx0XHRsYWJlbCA9IHJlY2VudC5sYWJlbCB8fCB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh1cmksIHsgYXBwZW5kV29ya3NwYWNlU3VmZml4OiB0cnVlIH0pO1xuXHRcdFx0Y29tbWFuZElkID0gJ29wZW5SZWNlbnRGaWxlJztcblx0XHRcdG9wZW5hYmxlID0geyBmaWxlVXJpOiB1cmkgfTtcblx0XHR9XG5cblx0XHRjb25zdCByZXQgPSB0b0FjdGlvbih7XG5cdFx0XHRpZDogY29tbWFuZElkLCBsYWJlbDogdW5tbmVtb25pY0xhYmVsKGxhYmVsKSwgcnVuOiAoYnJvd3NlckV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRcdGNvbnN0IG9wZW5Jbk5ld1dpbmRvdyA9IGJyb3dzZXJFdmVudCAmJiAoKCFpc01hY2ludG9zaCAmJiAoYnJvd3NlckV2ZW50LmN0cmxLZXkgfHwgYnJvd3NlckV2ZW50LnNoaWZ0S2V5KSkgfHwgKGlzTWFjaW50b3NoICYmIChicm93c2VyRXZlbnQubWV0YUtleSB8fCBicm93c2VyRXZlbnQuYWx0S2V5KSkpO1xuXG5cdFx0XHRcdHJldHVybiB0aGlzLmhvc3RTZXJ2aWNlLm9wZW5XaW5kb3coW29wZW5hYmxlXSwge1xuXHRcdFx0XHRcdGZvcmNlTmV3V2luZG93OiAhIW9wZW5Jbk5ld1dpbmRvdyxcblx0XHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IHJlbW90ZUF1dGhvcml0eSB8fCBudWxsIC8vIGxvY2FsIHdpbmRvdyBpZiByZW1vdGVBdXRob3JpdHkgaXMgbm90IHNldCBvciBjYW4gbm90IGJlIGRlZHVjdGVkIGZyb20gdGhlIG9wZW5hYmxlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24ocmV0LCB7IHVyaSwgcmVtb3RlQXV0aG9yaXR5IH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBub3RpZnlVc2VyT2ZDdXN0b21NZW51YmFyQWNjZXNzaWJpbGl0eSgpOiB2b2lkIHtcblx0XHRpZiAoaXNXZWIgfHwgaXNNYWNpbnRvc2gpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNCZWVuTm90aWZpZWQgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oJ21lbnViYXIvYWNjZXNzaWJsZU1lbnViYXJOb3RpZmllZCcsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgZmFsc2UpO1xuXHRcdGNvbnN0IHVzaW5nQ3VzdG9tTWVudWJhciA9ICFoYXNOYXRpdmVUaXRsZWJhcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdGlmIChoYXNCZWVuTm90aWZpZWQgfHwgdXNpbmdDdXN0b21NZW51YmFyIHx8ICF0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLmlzU2NyZWVuUmVhZGVyT3B0aW1pemVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlID0gbG9jYWxpemUoJ21lbnViYXIuY3VzdG9tVGl0bGViYXJBY2Nlc3NpYmlsaXR5Tm90aWZpY2F0aW9uJywgXCJBY2Nlc3NpYmlsaXR5IHN1cHBvcnQgaXMgZW5hYmxlZCBmb3IgeW91LiBGb3IgdGhlIG1vc3QgYWNjZXNzaWJsZSBleHBlcmllbmNlLCB3ZSByZWNvbW1lbmQgdGhlIGN1c3RvbSB0aXRsZSBiYXIgc3R5bGUuXCIpO1xuXHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoU2V2ZXJpdHkuSW5mbywgbWVzc2FnZSwgW1xuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2dvVG9TZXR0aW5nJywgXCJPcGVuIFNldHRpbmdzXCIpLFxuXHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3BlblVzZXJTZXR0aW5ncyh7IHF1ZXJ5OiBUaXRsZUJhclNldHRpbmcuVElUTEVfQkFSX1NUWUxFIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XSk7XG5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKCdtZW51YmFyL2FjY2Vzc2libGVNZW51YmFyTm90aWZpZWQnLCB0cnVlLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdH1cbn1cblxuLy8gVGhpcyBpcyBhIGJpdCBjb21wbGV4IGR1ZSB0byB0aGUgaXNzdWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIwNTgzNlxubGV0IGZvY3VzTWVudUJhckVtaXR0ZXI6IEVtaXR0ZXI8dm9pZD4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5mdW5jdGlvbiBlbmFibGVGb2N1c01lbnVCYXJBY3Rpb24oKTogRW1pdHRlcjx2b2lkPiB7XG5cdGlmICghZm9jdXNNZW51QmFyRW1pdHRlcikge1xuXHRcdGZvY3VzTWVudUJhckVtaXR0ZXIgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXG5cdFx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMubWVudWJhci5mb2N1c2AsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignZm9jdXNNZW51JywgJ0ZvY3VzIEFwcGxpY2F0aW9uIE1lbnUnKSxcblx0XHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5GMTAsXG5cdFx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHRcdHdoZW46IElzV2ViQ29udGV4dFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Zm9jdXNNZW51QmFyRW1pdHRlcj8uZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIGZvY3VzTWVudUJhckVtaXR0ZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBDdXN0b21NZW51YmFyQ29udHJvbCBleHRlbmRzIE1lbnViYXJDb250cm9sIHtcblx0cHJpdmF0ZSBtZW51YmFyOiBNZW51QmFyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYWx3YXlzT25NbmVtb25pY3M6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBmb2N1c0luc2lkZU1lbnViYXI6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBwZW5kaW5nRmlyc3RUaW1lVXBkYXRlOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgdmlzaWJsZTogYm9vbGVhbiA9IHRydWU7XG5cdHByaXZhdGUgYWN0aW9uUnVubmVyOiBJQWN0aW9uUnVubmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IHdlYk5hdmlnYXRpb25NZW51ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5tZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5NZW51YmFySG9tZU1lbnUsIHRoaXMuY29udGV4dEtleVNlcnZpY2UpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblZpc2liaWxpdHlDaGFuZ2U6IEVtaXR0ZXI8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRm9jdXNTdGF0ZUNoYW5nZTogRW1pdHRlcjxib29sZWFuPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VzU2VydmljZSB3b3Jrc3BhY2VzU2VydmljZTogSVdvcmtzcGFjZXNTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASVVwZGF0ZVNlcnZpY2UgdXBkYXRlU2VydmljZTogSVVwZGF0ZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKG1lbnVTZXJ2aWNlLCB3b3Jrc3BhY2VzU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgbGFiZWxTZXJ2aWNlLCB1cGRhdGVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZSwgcHJlZmVyZW5jZXNTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UsIGFjY2Vzc2liaWxpdHlTZXJ2aWNlLCBob3N0U2VydmljZSwgY29tbWFuZFNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fb25WaXNpYmlsaXR5Q2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdFx0dGhpcy5fb25Gb2N1c1N0YXRlQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cblx0XHR0aGlzLmFjdGlvblJ1bm5lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25SdW5uZXIoKSk7XG5cdFx0dGhpcy5hY3Rpb25SdW5uZXIub25EaWRSdW4oZSA9PiB7XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiBlLmFjdGlvbi5pZCwgZnJvbTogJ21lbnUnIH0pO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy53b3Jrc3BhY2VzU2VydmljZS5nZXRSZWNlbnRseU9wZW5lZCgpLnRoZW4oKHJlY2VudGx5T3BlbmVkKSA9PiB7XG5cdFx0XHR0aGlzLnJlY2VudGx5T3BlbmVkID0gcmVjZW50bHlPcGVuZWQ7XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZG9VcGRhdGVNZW51YmFyKGZpcnN0VGltZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5mb2N1c0luc2lkZU1lbnViYXIpIHtcblx0XHRcdHRoaXMuc2V0dXBDdXN0b21NZW51YmFyKGZpcnN0VGltZSk7XG5cdFx0fVxuXG5cdFx0aWYgKGZpcnN0VGltZSkge1xuXHRcdFx0dGhpcy5wZW5kaW5nRmlyc3RUaW1lVXBkYXRlID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFVwZGF0ZUFjdGlvbigpOiBJQWN0aW9uIHwgbnVsbCB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLnVwZGF0ZVNlcnZpY2Uuc3RhdGU7XG5cblx0XHRzd2l0Y2ggKHN0YXRlLnR5cGUpIHtcblx0XHRcdGNhc2UgU3RhdGVUeXBlLklkbGU6XG5cdFx0XHRcdHJldHVybiBuZXcgQWN0aW9uKCd1cGRhdGUuY2hlY2snLCBsb2NhbGl6ZSh7IGtleTogJ2NoZWNrRm9yVXBkYXRlcycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJDaGVjayBmb3IgJiZVcGRhdGVzLi4uXCIpLCB1bmRlZmluZWQsIHRydWUsICgpID0+XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTZXJ2aWNlLmNoZWNrRm9yVXBkYXRlcyh0cnVlKSk7XG5cblx0XHRcdGNhc2UgU3RhdGVUeXBlLkNoZWNraW5nRm9yVXBkYXRlczpcblx0XHRcdFx0cmV0dXJuIG5ldyBBY3Rpb24oJ3VwZGF0ZS5jaGVja2luZycsIGxvY2FsaXplKCdjaGVja2luZ0ZvclVwZGF0ZXMnLCBcIkNoZWNraW5nIGZvciBVcGRhdGVzLi4uXCIpLCB1bmRlZmluZWQsIGZhbHNlKTtcblxuXHRcdFx0Y2FzZSBTdGF0ZVR5cGUuQXZhaWxhYmxlRm9yRG93bmxvYWQ6XG5cdFx0XHRcdHJldHVybiBuZXcgQWN0aW9uKCd1cGRhdGUuZG93bmxvYWROb3cnLCBsb2NhbGl6ZSh7IGtleTogJ2Rvd25sb2FkIG5vdycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJEJiZvd25sb2FkIFVwZGF0ZVwiKSwgdW5kZWZpbmVkLCB0cnVlLCAoKSA9PlxuXHRcdFx0XHRcdHRoaXMudXBkYXRlU2VydmljZS5kb3dubG9hZFVwZGF0ZSgpKTtcblxuXHRcdFx0Y2FzZSBTdGF0ZVR5cGUuRG93bmxvYWRpbmc6XG5cdFx0XHRcdHJldHVybiBuZXcgQWN0aW9uKCd1cGRhdGUuZG93bmxvYWRpbmcnLCBsb2NhbGl6ZSgnRG93bmxvYWRpbmdVcGRhdGUnLCBcIkRvd25sb2FkaW5nIFVwZGF0ZS4uLlwiKSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cblx0XHRcdGNhc2UgU3RhdGVUeXBlLkRvd25sb2FkZWQ6XG5cdFx0XHRcdHJldHVybiBpc01hY2ludG9zaCA/IG51bGwgOiBuZXcgQWN0aW9uKCd1cGRhdGUuaW5zdGFsbCcsIGxvY2FsaXplKHsga2V5OiAnaW5zdGFsbFVwZGF0ZS4uLicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJJbnN0YWxsICYmVXBkYXRlLi4uXCIpLCB1bmRlZmluZWQsIHRydWUsICgpID0+XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTZXJ2aWNlLmFwcGx5VXBkYXRlKCkpO1xuXG5cdFx0XHRjYXNlIFN0YXRlVHlwZS5VcGRhdGluZzpcblx0XHRcdFx0cmV0dXJuIG5ldyBBY3Rpb24oJ3VwZGF0ZS51cGRhdGluZycsIGxvY2FsaXplKCdpbnN0YWxsaW5nVXBkYXRlJywgXCJJbnN0YWxsaW5nIFVwZGF0ZS4uLlwiKSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cblx0XHRcdGNhc2UgU3RhdGVUeXBlLlJlYWR5OlxuXHRcdFx0XHRyZXR1cm4gbmV3IEFjdGlvbigndXBkYXRlLnJlc3RhcnQnLCBsb2NhbGl6ZSh7IGtleTogJ3Jlc3RhcnRUb1VwZGF0ZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJSZXN0YXJ0IHRvICYmVXBkYXRlXCIpLCB1bmRlZmluZWQsIHRydWUsICgpID0+XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTZXJ2aWNlLnF1aXRBbmRJbnN0YWxsKCkpO1xuXG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldCBjdXJyZW50TWVudWJhclZpc2liaWxpdHkoKTogTWVudUJhclZpc2liaWxpdHkge1xuXHRcdHJldHVybiBnZXRNZW51QmFyVmlzaWJpbGl0eSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGN1cnJlbnREaXNhYmxlTWVudUJhckFsdEZvY3VzKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHNldHRpbmdWYWx1ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ3dpbmRvdy5jdXN0b21NZW51QmFyQWx0Rm9jdXMnKTtcblxuXHRcdGxldCBkaXNhYmxlTWVudUJhckFsdEJlaGF2aW9yID0gZmFsc2U7XG5cdFx0aWYgKHR5cGVvZiBzZXR0aW5nVmFsdWUgPT09ICdib29sZWFuJykge1xuXHRcdFx0ZGlzYWJsZU1lbnVCYXJBbHRCZWhhdmlvciA9ICFzZXR0aW5nVmFsdWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRpc2FibGVNZW51QmFyQWx0QmVoYXZpb3I7XG5cdH1cblxuXHRwcml2YXRlIGluc2VydEFjdGlvbnNCZWZvcmUobmV4dEFjdGlvbjogSUFjdGlvbiwgdGFyZ2V0OiBJQWN0aW9uW10pOiB2b2lkIHtcblx0XHRzd2l0Y2ggKG5leHRBY3Rpb24uaWQpIHtcblx0XHRcdGNhc2UgT3BlblJlY2VudEFjdGlvbi5JRDpcblx0XHRcdFx0dGFyZ2V0LnB1c2goLi4udGhpcy5nZXRPcGVuUmVjZW50QWN0aW9ucygpKTtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ3dvcmtiZW5jaC5hY3Rpb24uc2hvd0Fib3V0RGlhbG9nJzpcblx0XHRcdFx0aWYgKCFpc01hY2ludG9zaCAmJiAhaXNXZWIpIHtcblx0XHRcdFx0XHRjb25zdCB1cGRhdGVBY3Rpb24gPSB0aGlzLmdldFVwZGF0ZUFjdGlvbigpO1xuXHRcdFx0XHRcdGlmICh1cGRhdGVBY3Rpb24pIHtcblx0XHRcdFx0XHRcdHVwZGF0ZUFjdGlvbi5sYWJlbCA9IG1uZW1vbmljTWVudUxhYmVsKHVwZGF0ZUFjdGlvbi5sYWJlbCk7XG5cdFx0XHRcdFx0XHR0YXJnZXQucHVzaCh1cGRhdGVBY3Rpb24pO1xuXHRcdFx0XHRcdFx0dGFyZ2V0LnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXQgY3VycmVudEVuYWJsZU1lbnVCYXJNbmVtb25pY3MoKTogYm9vbGVhbiB7XG5cdFx0bGV0IGVuYWJsZU1lbnVCYXJNbmVtb25pY3MgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCd3aW5kb3cuZW5hYmxlTWVudUJhck1uZW1vbmljcycpO1xuXHRcdGlmICh0eXBlb2YgZW5hYmxlTWVudUJhck1uZW1vbmljcyAhPT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRlbmFibGVNZW51QmFyTW5lbW9uaWNzID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZW5hYmxlTWVudUJhck1uZW1vbmljcyAmJiAoIWlzV2ViIHx8IGlzRnVsbHNjcmVlbihtYWluV2luZG93KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBjdXJyZW50Q29tcGFjdE1lbnVNb2RlKCk6IElNZW51RGlyZWN0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5jdXJyZW50TWVudWJhclZpc2liaWxpdHkgIT09ICdjb21wYWN0Jykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBNZW51IGJhciBsaXZlcyBpbiBhY3Rpdml0eSBiYXIgYW5kIHNob3VsZCBmbG93IGJhc2VkIG9uIGl0cyBsb2NhdGlvblxuXHRcdGNvbnN0IGN1cnJlbnRTaWRlYmFyTG9jYXRpb24gPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oJ3dvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uJyk7XG5cdFx0Y29uc3QgaG9yaXpvbnRhbERpcmVjdGlvbiA9IGN1cnJlbnRTaWRlYmFyTG9jYXRpb24gPT09ICdyaWdodCcgPyBIb3Jpem9udGFsRGlyZWN0aW9uLkxlZnQgOiBIb3Jpem9udGFsRGlyZWN0aW9uLlJpZ2h0O1xuXG5cdFx0Y29uc3QgYWN0aXZpdHlCYXJMb2NhdGlvbiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPignd29ya2JlbmNoLmFjdGl2aXR5QmFyLmxvY2F0aW9uJyk7XG5cdFx0Y29uc3QgdmVydGljYWxEaXJlY3Rpb24gPSBhY3Rpdml0eUJhckxvY2F0aW9uID09PSBBY3Rpdml0eUJhclBvc2l0aW9uLkJPVFRPTSA/IFZlcnRpY2FsRGlyZWN0aW9uLkFib3ZlIDogVmVydGljYWxEaXJlY3Rpb24uQmVsb3c7XG5cblx0XHRyZXR1cm4geyBob3Jpem9udGFsOiBob3Jpem9udGFsRGlyZWN0aW9uLCB2ZXJ0aWNhbDogdmVydGljYWxEaXJlY3Rpb24gfTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRWaXNpYmlsaXR5Q2hhbmdlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnZpc2libGUgPSB2aXNpYmxlO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VSZWNlbnRseU9wZW5lZCgpO1xuXHRcdHRoaXMuX29uVmlzaWJpbGl0eUNoYW5nZS5maXJlKHZpc2libGUpO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0FjdGlvbnNBcnJheShtZW51OiBJTWVudSk6IElBY3Rpb25bXSB7XG5cdFx0cmV0dXJuIGdldEZsYXRDb250ZXh0TWVudUFjdGlvbnMobWVudS5nZXRBY3Rpb25zKHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSByZWluc3RhbGxEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdXBkYXRlQWN0aW9uc0Rpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBzZXR1cEN1c3RvbU1lbnViYXIoZmlyc3RUaW1lOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Ly8gSWYgdGhlcmUgaXMgbm8gY29udGFpbmVyLCB3ZSBjYW5ub3Qgc2V0dXAgdGhlIG1lbnViYXJcblx0XHRpZiAoIXRoaXMuY29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGZpcnN0VGltZSkge1xuXHRcdFx0Ly8gUmVzZXQgYW5kIGNyZWF0ZSBuZXcgbWVudWJhclxuXHRcdFx0aWYgKHRoaXMubWVudWJhcikge1xuXHRcdFx0XHR0aGlzLnJlaW5zdGFsbERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMubWVudWJhciA9IHRoaXMucmVpbnN0YWxsRGlzcG9zYWJsZXMuYWRkKG5ldyBNZW51QmFyKHRoaXMuY29udGFpbmVyLCB0aGlzLmdldE1lbnVCYXJPcHRpb25zKCksIGRlZmF1bHRNZW51U3R5bGVzKSk7XG5cblx0XHRcdHRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2UuYWx3YXlzVW5kZXJsaW5lQWNjZXNzS2V5cygpLnRoZW4odmFsID0+IHtcblx0XHRcdFx0dGhpcy5hbHdheXNPbk1uZW1vbmljcyA9IHZhbDtcblx0XHRcdFx0dGhpcy5tZW51YmFyPy51cGRhdGUodGhpcy5nZXRNZW51QmFyT3B0aW9ucygpKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLnJlaW5zdGFsbERpc3Bvc2FibGVzLmFkZCh0aGlzLm1lbnViYXIub25Gb2N1c1N0YXRlQ2hhbmdlKGZvY3VzZWQgPT4ge1xuXHRcdFx0XHR0aGlzLl9vbkZvY3VzU3RhdGVDaGFuZ2UuZmlyZShmb2N1c2VkKTtcblxuXHRcdFx0XHQvLyBXaGVuIHRoZSBtZW51YmFyIGxvc2VzIGZvY3VzLCB1cGRhdGUgaXQgdG8gY2xlYXIgYW55IHBlbmRpbmcgdXBkYXRlc1xuXHRcdFx0XHRpZiAoIWZvY3VzZWQpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5wZW5kaW5nRmlyc3RUaW1lVXBkYXRlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNldHVwQ3VzdG9tTWVudWJhcih0cnVlKTtcblx0XHRcdFx0XHRcdHRoaXMucGVuZGluZ0ZpcnN0VGltZVVwZGF0ZSA9IGZhbHNlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLnVwZGF0ZU1lbnViYXIoKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLmZvY3VzSW5zaWRlTWVudWJhciA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRoaXMucmVpbnN0YWxsRGlzcG9zYWJsZXMuYWRkKHRoaXMubWVudWJhci5vblZpc2liaWxpdHlDaGFuZ2UoZSA9PiB0aGlzLm9uRGlkVmlzaWJpbGl0eUNoYW5nZShlKSkpO1xuXG5cdFx0XHQvLyBCZWZvcmUgd2UgZm9jdXMgdGhlIG1lbnViYXIsIHN0b3AgdXBkYXRlcyB0byBpdCBzbyB0aGF0IGZvY3VzLXJlbGF0ZWQgY29udGV4dCBrZXlzIHdpbGwgd29ya1xuXHRcdFx0dGhpcy5yZWluc3RhbGxEaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuY29udGFpbmVyLCBFdmVudFR5cGUuRk9DVVNfSU4sICgpID0+IHtcblx0XHRcdFx0dGhpcy5mb2N1c0luc2lkZU1lbnViYXIgPSB0cnVlO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLnJlaW5zdGFsbERpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIEV2ZW50VHlwZS5GT0NVU19PVVQsICgpID0+IHtcblx0XHRcdFx0dGhpcy5mb2N1c0luc2lkZU1lbnViYXIgPSBmYWxzZTtcblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gRmlyZSB2aXNpYmlsaXR5IGNoYW5nZSBmb3IgdGhlIGZpcnN0IGluc3RhbGwgaWYgbWVudSBpcyBzaG93blxuXHRcdFx0aWYgKHRoaXMubWVudWJhci5pc1Zpc2libGUpIHtcblx0XHRcdFx0dGhpcy5vbkRpZFZpc2liaWxpdHlDaGFuZ2UodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubWVudWJhcj8udXBkYXRlKHRoaXMuZ2V0TWVudUJhck9wdGlvbnMoKSk7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHRoZSBtZW51IGFjdGlvbnNcblx0XHRjb25zdCB1cGRhdGVBY3Rpb25zID0gKG1lbnVBY3Rpb25zOiByZWFkb25seSBJQWN0aW9uW10sIHRhcmdldDogSUFjdGlvbltdLCB0b3BMZXZlbFRpdGxlOiBzdHJpbmcsIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpID0+IHtcblx0XHRcdHRhcmdldC5zcGxpY2UoMCk7XG5cblx0XHRcdGZvciAoY29uc3QgbWVudUl0ZW0gb2YgbWVudUFjdGlvbnMpIHtcblx0XHRcdFx0dGhpcy5pbnNlcnRBY3Rpb25zQmVmb3JlKG1lbnVJdGVtLCB0YXJnZXQpO1xuXG5cdFx0XHRcdGlmIChtZW51SXRlbSBpbnN0YW5jZW9mIFNlcGFyYXRvcikge1xuXHRcdFx0XHRcdHRhcmdldC5wdXNoKG1lbnVJdGVtKTtcblx0XHRcdFx0fSBlbHNlIGlmIChtZW51SXRlbSBpbnN0YW5jZW9mIFN1Ym1lbnVJdGVtQWN0aW9uIHx8IG1lbnVJdGVtIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0XHQvLyB1c2UgbW5lbW9uaWNUaXRsZSB3aGVuZXZlciBwb3NzaWJsZVxuXHRcdFx0XHRcdGxldCB0aXRsZSA9IHR5cGVvZiBtZW51SXRlbS5pdGVtLnRpdGxlID09PSAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0PyBtZW51SXRlbS5pdGVtLnRpdGxlXG5cdFx0XHRcdFx0XHQ6IG1lbnVJdGVtLml0ZW0udGl0bGUubW5lbW9uaWNUaXRsZSA/PyBtZW51SXRlbS5pdGVtLnRpdGxlLnZhbHVlO1xuXG5cdFx0XHRcdFx0aWYgKG1lbnVJdGVtIGluc3RhbmNlb2YgU3VibWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0XHRcdGNvbnN0IHN1Ym1lbnVBY3Rpb25zOiBTdWJtZW51QWN0aW9uW10gPSBbXTtcblx0XHRcdFx0XHRcdHVwZGF0ZUFjdGlvbnMobWVudUl0ZW0uYWN0aW9ucywgc3VibWVudUFjdGlvbnMsIHRvcExldmVsVGl0bGUsIHN0b3JlKTtcblxuXHRcdFx0XHRcdFx0aWYgKHN1Ym1lbnVBY3Rpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdFx0dGFyZ2V0LnB1c2gobmV3IFN1Ym1lbnVBY3Rpb24obWVudUl0ZW0uaWQsIG1uZW1vbmljTWVudUxhYmVsKHRpdGxlKSwgc3VibWVudUFjdGlvbnMpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWYgKGlzSUNvbW1hbmRBY3Rpb25Ub2dnbGVJbmZvKG1lbnVJdGVtLml0ZW0udG9nZ2xlZCkpIHtcblx0XHRcdFx0XHRcdFx0dGl0bGUgPSBtZW51SXRlbS5pdGVtLnRvZ2dsZWQubW5lbW9uaWNUaXRsZSA/PyBtZW51SXRlbS5pdGVtLnRvZ2dsZWQudGl0bGUgPz8gdGl0bGU7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNvbnN0IG5ld0FjdGlvbiA9IHN0b3JlLmFkZChuZXcgQWN0aW9uKG1lbnVJdGVtLmlkLCBtbmVtb25pY01lbnVMYWJlbCh0aXRsZSksIG1lbnVJdGVtLmNsYXNzLCBtZW51SXRlbS5lbmFibGVkLCAoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKG1lbnVJdGVtLmlkKSkpO1xuXHRcdFx0XHRcdFx0bmV3QWN0aW9uLnRvb2x0aXAgPSBtZW51SXRlbS50b29sdGlwO1xuXHRcdFx0XHRcdFx0bmV3QWN0aW9uLmNoZWNrZWQgPSBtZW51SXRlbS5jaGVja2VkO1xuXHRcdFx0XHRcdFx0dGFyZ2V0LnB1c2gobmV3QWN0aW9uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXG5cdFx0XHQvLyBBcHBlbmQgd2ViIG5hdmlnYXRpb24gbWVudSBpdGVtcyB0byB0aGUgZmlsZSBtZW51IHdoZW4gbm90IGNvbXBhY3Rcblx0XHRcdGlmICh0b3BMZXZlbFRpdGxlID09PSAnRmlsZScgJiYgdGhpcy5jdXJyZW50Q29tcGFjdE1lbnVNb2RlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29uc3Qgd2ViQWN0aW9ucyA9IHRoaXMuZ2V0V2ViTmF2aWdhdGlvbkFjdGlvbnMoKTtcblx0XHRcdFx0aWYgKHdlYkFjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGFyZ2V0LnB1c2goLi4ud2ViQWN0aW9ucyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Zm9yIChjb25zdCB0aXRsZSBvZiBPYmplY3Qua2V5cyh0aGlzLnRvcExldmVsVGl0bGVzKSkge1xuXHRcdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudXNbdGl0bGVdO1xuXHRcdFx0aWYgKGZpcnN0VGltZSAmJiBtZW51KSB7XG5cdFx0XHRcdGNvbnN0IG1lbnVDaGFuZ2VkRGlzcG9zYWJsZSA9IHRoaXMucmVpbnN0YWxsRGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0XHRcdHRoaXMucmVpbnN0YWxsRGlzcG9zYWJsZXMuYWRkKG1lbnUub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHRcdGlmICghdGhpcy5mb2N1c0luc2lkZU1lbnViYXIpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRcdFx0XHRcdFx0bWVudUNoYW5nZWREaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0XHRcdFx0XHR1cGRhdGVBY3Rpb25zKHRoaXMudG9BY3Rpb25zQXJyYXkobWVudSksIGFjdGlvbnMsIHRpdGxlLCBtZW51Q2hhbmdlZERpc3Bvc2FibGUpO1xuXHRcdFx0XHRcdFx0dGhpcy5tZW51YmFyPy51cGRhdGVNZW51KHsgYWN0aW9ucywgbGFiZWw6IG1uZW1vbmljTWVudUxhYmVsKHRoaXMudG9wTGV2ZWxUaXRsZXNbdGl0bGVdKSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHQvLyBGb3IgdGhlIGZpbGUgbWVudSwgd2UgbmVlZCB0byB1cGRhdGUgaWYgdGhlIHdlYiBuYXYgbWVudSB1cGRhdGVzIGFzIHdlbGxcblx0XHRcdFx0aWYgKG1lbnUgPT09IHRoaXMubWVudXMuRmlsZSkge1xuXHRcdFx0XHRcdGNvbnN0IHdlYk1lbnVDaGFuZ2VkRGlzcG9zYWJsZSA9IHRoaXMucmVpbnN0YWxsRGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0XHRcdFx0dGhpcy5yZWluc3RhbGxEaXNwb3NhYmxlcy5hZGQodGhpcy53ZWJOYXZpZ2F0aW9uTWVudS5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMuZm9jdXNJbnNpZGVNZW51YmFyKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRcdFx0XHRcdFx0XHR3ZWJNZW51Q2hhbmdlZERpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRcdFx0XHRcdFx0dXBkYXRlQWN0aW9ucyh0aGlzLnRvQWN0aW9uc0FycmF5KG1lbnUpLCBhY3Rpb25zLCB0aXRsZSwgd2ViTWVudUNoYW5nZWREaXNwb3NhYmxlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5tZW51YmFyPy51cGRhdGVNZW51KHsgYWN0aW9ucywgbGFiZWw6IG1uZW1vbmljTWVudUxhYmVsKHRoaXMudG9wTGV2ZWxUaXRsZXNbdGl0bGVdKSB9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0XHRpZiAobWVudSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUFjdGlvbnNEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0XHR1cGRhdGVBY3Rpb25zKHRoaXMudG9BY3Rpb25zQXJyYXkobWVudSksIGFjdGlvbnMsIHRpdGxlLCB0aGlzLnVwZGF0ZUFjdGlvbnNEaXNwb3NhYmxlcyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLm1lbnViYXIpIHtcblx0XHRcdFx0aWYgKCFmaXJzdFRpbWUpIHtcblx0XHRcdFx0XHR0aGlzLm1lbnViYXIudXBkYXRlTWVudSh7IGFjdGlvbnMsIGxhYmVsOiBtbmVtb25pY01lbnVMYWJlbCh0aGlzLnRvcExldmVsVGl0bGVzW3RpdGxlXSkgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5tZW51YmFyLnB1c2goeyBhY3Rpb25zLCBsYWJlbDogbW5lbW9uaWNNZW51TGFiZWwodGhpcy50b3BMZXZlbFRpdGxlc1t0aXRsZV0pIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRXZWJOYXZpZ2F0aW9uQWN0aW9ucygpOiBJQWN0aW9uW10ge1xuXHRcdGlmICghaXNXZWIpIHtcblx0XHRcdHJldHVybiBbXTsgLy8gb25seSBmb3Igd2ViXG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2ViTmF2aWdhdGlvbkFjdGlvbnMgPSBbXTtcblx0XHRmb3IgKGNvbnN0IGdyb3VwcyBvZiB0aGlzLndlYk5hdmlnYXRpb25NZW51LmdldEFjdGlvbnMoKSkge1xuXHRcdFx0Y29uc3QgWywgYWN0aW9uc10gPSBncm91cHM7XG5cdFx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBhY3Rpb25zKSB7XG5cdFx0XHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikge1xuXHRcdFx0XHRcdGNvbnN0IHRpdGxlID0gdHlwZW9mIGFjdGlvbi5pdGVtLnRpdGxlID09PSAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0PyBhY3Rpb24uaXRlbS50aXRsZVxuXHRcdFx0XHRcdFx0OiBhY3Rpb24uaXRlbS50aXRsZS5tbmVtb25pY1RpdGxlID8/IGFjdGlvbi5pdGVtLnRpdGxlLnZhbHVlO1xuXHRcdFx0XHRcdHdlYk5hdmlnYXRpb25BY3Rpb25zLnB1c2gobmV3IEFjdGlvbihhY3Rpb24uaWQsIG1uZW1vbmljTWVudUxhYmVsKHRpdGxlKSwgYWN0aW9uLmNsYXNzLCBhY3Rpb24uZW5hYmxlZCwgYXN5bmMgKGV2ZW50PzogYW55KSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGFjdGlvbi5pZCwgZXZlbnQpO1xuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR3ZWJOYXZpZ2F0aW9uQWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHdlYk5hdmlnYXRpb25BY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0d2ViTmF2aWdhdGlvbkFjdGlvbnMucG9wKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHdlYk5hdmlnYXRpb25BY3Rpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRNZW51QmFyT3B0aW9ucygpOiBJTWVudUJhck9wdGlvbnMge1xuXHRcdHJldHVybiB7XG5cdFx0XHRlbmFibGVNbmVtb25pY3M6IHRoaXMuY3VycmVudEVuYWJsZU1lbnVCYXJNbmVtb25pY3MsXG5cdFx0XHRkaXNhYmxlQWx0Rm9jdXM6IHRoaXMuY3VycmVudERpc2FibGVNZW51QmFyQWx0Rm9jdXMsXG5cdFx0XHR2aXNpYmlsaXR5OiB0aGlzLmN1cnJlbnRNZW51YmFyVmlzaWJpbGl0eSxcblx0XHRcdGFjdGlvblJ1bm5lcjogdGhpcy5hY3Rpb25SdW5uZXIsXG5cdFx0XHRnZXRLZXliaW5kaW5nOiAoYWN0aW9uKSA9PiB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKSxcblx0XHRcdGFsd2F5c09uTW5lbW9uaWNzOiB0aGlzLmFsd2F5c09uTW5lbW9uaWNzLFxuXHRcdFx0Y29tcGFjdE1vZGU6IHRoaXMuY3VycmVudENvbXBhY3RNZW51TW9kZSxcblx0XHRcdGdldENvbXBhY3RNZW51QWN0aW9uczogKCkgPT4ge1xuXHRcdFx0XHRpZiAoIWlzV2ViKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtdOyAvLyBvbmx5IGZvciB3ZWJcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFdlYk5hdmlnYXRpb25BY3Rpb25zKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvbkRpZENoYW5nZVdpbmRvd0ZvY3VzKGhhc0ZvY3VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnZpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzdXBlci5vbkRpZENoYW5nZVdpbmRvd0ZvY3VzKGhhc0ZvY3VzKTtcblxuXHRcdGlmICh0aGlzLmNvbnRhaW5lcikge1xuXHRcdFx0aWYgKGhhc0ZvY3VzKSB7XG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2luYWN0aXZlJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdpbmFjdGl2ZScpO1xuXHRcdFx0XHR0aGlzLm1lbnViYXI/LmJsdXIoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgb25VcGRhdGVTdGF0ZUNoYW5nZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMudmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN1cGVyLm9uVXBkYXRlU3RhdGVDaGFuZ2UoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy52aXNpYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3VwZXIub25EaWRDaGFuZ2VSZWNlbnRseU9wZW5lZCgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIG9uVXBkYXRlS2V5YmluZGluZ3MoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnZpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzdXBlci5vblVwZGF0ZUtleWJpbmRpbmdzKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0c3VwZXIucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihtYWluV2luZG93LCBFdmVudFR5cGUuUkVTSVpFLCAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5tZW51YmFyICYmICEoaXNJT1MgJiYgQnJvd3NlckZlYXR1cmVzLnBvaW50ZXJFdmVudHMpKSB7XG5cdFx0XHRcdHRoaXMubWVudWJhci5ibHVyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gTW5lbW9uaWNzIHJlcXVpcmUgZnVsbHNjcmVlbiBpbiB3ZWJcblx0XHRpZiAoaXNXZWIpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKG9uRGlkQ2hhbmdlRnVsbHNjcmVlbih3aW5kb3dJZCA9PiB7XG5cdFx0XHRcdGlmICh3aW5kb3dJZCA9PT0gbWFpbldpbmRvdy52c2NvZGVXaW5kb3dJZCkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlTWVudWJhcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndlYk5hdmlnYXRpb25NZW51Lm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlTWVudWJhcigpKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihlbmFibGVGb2N1c01lbnVCYXJBY3Rpb24oKS5ldmVudCgoKSA9PiB0aGlzLm1lbnViYXI/LnRvZ2dsZUZvY3VzKCkpKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgb25WaXNpYmlsaXR5Q2hhbmdlKCk6IEV2ZW50PGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25WaXNpYmlsaXR5Q2hhbmdlLmV2ZW50O1xuXHR9XG5cblx0Z2V0IG9uRm9jdXNTdGF0ZUNoYW5nZSgpOiBFdmVudDxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRm9jdXNTdGF0ZUNoYW5nZS5ldmVudDtcblx0fVxuXG5cdGdldE1lbnViYXJJdGVtc0RpbWVuc2lvbnMoKTogRGltZW5zaW9uIHtcblx0XHRpZiAodGhpcy5tZW51YmFyKSB7XG5cdFx0XHRyZXR1cm4gbmV3IERpbWVuc2lvbih0aGlzLm1lbnViYXIuZ2V0V2lkdGgoKSwgdGhpcy5tZW51YmFyLmdldEhlaWdodCgpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IERpbWVuc2lvbigwLCAwKTtcblx0fVxuXG5cdGNyZWF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuXHRcdHRoaXMuY29udGFpbmVyID0gcGFyZW50O1xuXG5cdFx0Ly8gQnVpbGQgdGhlIG1lbnViYXJcblx0XHRpZiAodGhpcy5jb250YWluZXIpIHtcblx0XHRcdHRoaXMuZG9VcGRhdGVNZW51YmFyKHRydWUpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNvbnRhaW5lcjtcblx0fVxuXG5cdGxheW91dChkaW1lbnNpb246IERpbWVuc2lvbikge1xuXHRcdHRoaXMubWVudWJhcj8udXBkYXRlKHRoaXMuZ2V0TWVudUJhck9wdGlvbnMoKSk7XG5cdH1cblxuXHR0b2dnbGVGb2N1cygpIHtcblx0XHR0aGlzLm1lbnViYXI/LnRvZ2dsZUZvY3VzKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxjQUFjLFFBQWUsbUJBQW1CLGlCQUFpQixTQUFTLGdC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
