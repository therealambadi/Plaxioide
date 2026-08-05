import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../base/common/lifecycle.js";
import { Emitter } from "../../base/common/event.js";
import { EventType, addDisposableListener, getClientArea, position, size, isAncestorUsingFlowTo, computeScreenAwareSize, getActiveDocument, getWindows, getActiveWindow, isActiveDocument, getWindow, getWindowId, getActiveElement, Dimension } from "../../base/browser/dom.js";
import { onDidChangeFullscreen, isFullscreen, isWCOEnabled } from "../../base/browser/browser.js";
import { IWorkingCopyBackupService } from "../services/workingCopy/common/workingCopyBackup.js";
import { isWindows, isLinux, isMacintosh, isWeb, isIOS } from "../../base/common/platform.js";
import { EditorInputCapabilities, isResourceEditorInput, pathsToEditors } from "../common/editor.js";
import { SidebarPart } from "./parts/sidebar/sidebarPart.js";
import { PanelPart } from "./parts/panel/panelPart.js";
import { Position, Parts, PanelOpensMaximizedOptions, positionFromString, positionToString, panelOpensMaximizedFromString, ActivityBarPosition, LayoutSettings, ZenModeSettings, EditorActionsLocation, shouldShowCustomTitleBar, isHorizontal, isMultiWindowPart } from "../services/layout/browser/layoutService.js";
import { isTemporaryWorkspace, IWorkspaceContextService, WorkbenchState } from "../../platform/workspace/common/workspace.js";
import { IStorageService, StorageScope, StorageTarget } from "../../platform/storage/common/storage.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { ITitleService } from "../services/title/browser/titleService.js";
import { StartupKind, ILifecycleService } from "../services/lifecycle/common/lifecycle.js";
import { getMenuBarVisibility, hasNativeTitlebar, hasCustomTitlebar, TitleBarSetting, CustomTitleBarVisibility, useWindowControlsOverlay, DEFAULT_WINDOW_SIZE } from "../../platform/window/common/window.js";
import { IHostService } from "../services/host/browser/host.js";
import { IBrowserWorkbenchEnvironmentService } from "../services/environment/browser/environmentService.js";
import { IEditorService } from "../services/editor/common/editorService.js";
import { GroupOrientation, GroupsOrder, IEditorGroupsService } from "../services/editor/common/editorGroupsService.js";
import { SerializableGrid, Orientation, Direction, Sizing } from "../../base/browser/ui/grid/grid.js";
import { Part } from "./part.js";
import { IStatusbarService } from "../services/statusbar/browser/statusbar.js";
import { IFileService } from "../../platform/files/common/files.js";
import { isCodeEditor } from "../../editor/browser/editorBrowser.js";
import { coalesce } from "../../base/common/arrays.js";
import { assertIsDefined } from "../../base/common/types.js";
import { INotificationService, NotificationsFilter } from "../../platform/notification/common/notification.js";
import { IThemeService } from "../../platform/theme/common/themeService.js";
import { WINDOW_ACTIVE_BORDER, WINDOW_INACTIVE_BORDER } from "../common/theme.js";
import { URI } from "../../base/common/uri.js";
import { IViewDescriptorService, ViewContainerLocation } from "../common/views.js";
import { DiffEditorInput } from "../common/editor/diffEditorInput.js";
import { mark } from "../../base/common/performance.js";
import { IExtensionService } from "../services/extensions/common/extensions.js";
import { ILogService } from "../../platform/log/common/log.js";
import { DeferredPromise, Promises } from "../../base/common/async.js";
import { IBannerService } from "../services/banner/browser/bannerService.js";
import { IPaneCompositePartService } from "../services/panecomposite/browser/panecomposite.js";
import { AuxiliaryBarPart } from "./parts/auxiliarybar/auxiliaryBarPart.js";
import { ITelemetryService } from "../../platform/telemetry/common/telemetry.js";
import { IAuxiliaryWindowService } from "../services/auxiliaryWindow/browser/auxiliaryWindowService.js";
import { mainWindow } from "../../base/browser/window.js";
var LayoutClasses = /* @__PURE__ */ ((LayoutClasses2) => {
  LayoutClasses2["SIDEBAR_HIDDEN"] = "nosidebar";
  LayoutClasses2["MAIN_EDITOR_AREA_HIDDEN"] = "nomaineditorarea";
  LayoutClasses2["PANEL_HIDDEN"] = "nopanel";
  LayoutClasses2["AUXILIARYBAR_HIDDEN"] = "noauxiliarybar";
  LayoutClasses2["STATUSBAR_HIDDEN"] = "nostatusbar";
  LayoutClasses2["FULLSCREEN"] = "fullscreen";
  LayoutClasses2["MAXIMIZED"] = "maximized";
  LayoutClasses2["WINDOW_BORDER"] = "border";
  return LayoutClasses2;
})(LayoutClasses || {});
const COMMAND_CENTER_SETTINGS = [
  "chat.commandCenter.enabled",
  "workbench.navigationControl.enabled",
  "workbench.experimental.share.enabled"
];
const TITLE_BAR_SETTINGS = [
  LayoutSettings.ACTIVITY_BAR_LOCATION,
  LayoutSettings.COMMAND_CENTER,
  ...COMMAND_CENTER_SETTINGS,
  LayoutSettings.EDITOR_ACTIONS_LOCATION,
  LayoutSettings.LAYOUT_ACTIONS,
  "window.menuBarVisibility",
  TitleBarSetting.TITLE_BAR_STYLE,
  TitleBarSetting.CUSTOM_TITLE_BAR_VISIBILITY
];
const DEFAULT_WINDOW_DIMENSIONS = new Dimension(DEFAULT_WINDOW_SIZE.width, DEFAULT_WINDOW_SIZE.height);
class Layout extends Disposable {
  constructor(parent) {
    super();
    this.parent = parent;
    //#region Events
    this._onDidChangeZenMode = this._register(new Emitter());
    this.onDidChangeZenMode = this._onDidChangeZenMode.event;
    this._onDidChangeMainEditorCenteredLayout = this._register(new Emitter());
    this.onDidChangeMainEditorCenteredLayout = this._onDidChangeMainEditorCenteredLayout.event;
    this._onDidChangePanelAlignment = this._register(new Emitter());
    this.onDidChangePanelAlignment = this._onDidChangePanelAlignment.event;
    this._onDidChangeWindowMaximized = this._register(new Emitter());
    this.onDidChangeWindowMaximized = this._onDidChangeWindowMaximized.event;
    this._onDidChangePanelPosition = this._register(new Emitter());
    this.onDidChangePanelPosition = this._onDidChangePanelPosition.event;
    this._onDidChangePartVisibility = this._register(new Emitter());
    this.onDidChangePartVisibility = this._onDidChangePartVisibility.event;
    this._onDidChangeNotificationsVisibility = this._register(new Emitter());
    this.onDidChangeNotificationsVisibility = this._onDidChangeNotificationsVisibility.event;
    this._onDidLayoutMainContainer = this._register(new Emitter());
    this.onDidLayoutMainContainer = this._onDidLayoutMainContainer.event;
    this._onDidLayoutActiveContainer = this._register(new Emitter());
    this.onDidLayoutActiveContainer = this._onDidLayoutActiveContainer.event;
    this._onDidLayoutContainer = this._register(new Emitter());
    this.onDidLayoutContainer = this._onDidLayoutContainer.event;
    this._onDidAddContainer = this._register(new Emitter());
    this.onDidAddContainer = this._onDidAddContainer.event;
    this._onDidChangeActiveContainer = this._register(new Emitter());
    this.onDidChangeActiveContainer = this._onDidChangeActiveContainer.event;
    //#endregion
    //#region Properties
    this.mainContainer = document.createElement("div");
    this.containerStylesLoaded = /* @__PURE__ */ new Map();
    //#endregion
    this.parts = /* @__PURE__ */ new Map();
    this.initialized = false;
    this.disposed = false;
    this._openedDefaultEditors = false;
    this.whenReadyPromise = new DeferredPromise();
    this.whenReady = this.whenReadyPromise.p;
    this.whenRestoredPromise = new DeferredPromise();
    this.whenRestored = this.whenRestoredPromise.p;
    this.restored = false;
  }
  get activeContainer() {
    return this.getContainerFromDocument(getActiveDocument());
  }
  get containers() {
    const containers = [];
    for (const { window } of getWindows()) {
      containers.push(this.getContainerFromDocument(window.document));
    }
    return containers;
  }
  getContainerFromDocument(targetDocument) {
    if (targetDocument === this.mainContainer.ownerDocument) {
      return this.mainContainer;
    } else {
      return targetDocument.body.getElementsByClassName("monaco-workbench")[0];
    }
  }
  whenContainerStylesLoaded(window) {
    return this.containerStylesLoaded.get(window.vscodeWindowId);
  }
  get mainContainerDimension() {
    return this._mainContainerDimension;
  }
  get activeContainerDimension() {
    return this.getContainerDimension(this.activeContainer);
  }
  getContainerDimension(container) {
    if (container === this.mainContainer) {
      return this.mainContainerDimension;
    } else {
      return getClientArea(container);
    }
  }
  get mainContainerOffset() {
    return this.computeContainerOffset(mainWindow);
  }
  get activeContainerOffset() {
    return this.computeContainerOffset(getWindow(this.activeContainer));
  }
  computeContainerOffset(targetWindow) {
    let top = 0;
    let quickPickTop = 0;
    if (this.isVisible(Parts.BANNER_PART)) {
      top = this.getPart(Parts.BANNER_PART).maximumHeight;
      quickPickTop = top;
    }
    const titlebarVisible = this.isVisible(Parts.TITLEBAR_PART, targetWindow);
    if (titlebarVisible) {
      top += this.getPart(Parts.TITLEBAR_PART).maximumHeight;
      quickPickTop = top;
    }
    const isCommandCenterVisible = titlebarVisible && this.configurationService.getValue(LayoutSettings.COMMAND_CENTER) !== false;
    if (isCommandCenterVisible) {
      quickPickTop = 6;
    }
    return { top, quickPickTop };
  }
  initLayout(accessor) {
    this.environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
    this.configurationService = accessor.get(IConfigurationService);
    this.hostService = accessor.get(IHostService);
    this.contextService = accessor.get(IWorkspaceContextService);
    this.storageService = accessor.get(IStorageService);
    this.workingCopyBackupService = accessor.get(IWorkingCopyBackupService);
    this.themeService = accessor.get(IThemeService);
    this.extensionService = accessor.get(IExtensionService);
    this.logService = accessor.get(ILogService);
    this.telemetryService = accessor.get(ITelemetryService);
    this.auxiliaryWindowService = accessor.get(IAuxiliaryWindowService);
    this.editorService = accessor.get(IEditorService);
    this.mainPartEditorService = this.editorService.createScoped("main", this._store);
    this.editorGroupService = accessor.get(IEditorGroupsService);
    this.paneCompositeService = accessor.get(IPaneCompositePartService);
    this.viewDescriptorService = accessor.get(IViewDescriptorService);
    this.titleService = accessor.get(ITitleService);
    this.notificationService = accessor.get(INotificationService);
    this.statusBarService = accessor.get(IStatusbarService);
    accessor.get(IBannerService);
    this.registerLayoutListeners();
    this.initLayoutState(accessor.get(ILifecycleService), accessor.get(IFileService));
  }
  registerLayoutListeners() {
    const showEditorIfHidden = () => {
      if (!this.isVisible(Parts.EDITOR_PART, mainWindow)) {
        this.toggleMaximizedPanel();
      }
    };
    this.editorGroupService.whenRestored.then(() => {
      this._register(this.mainPartEditorService.onDidVisibleEditorsChange(showEditorIfHidden));
      this._register(this.editorGroupService.mainPart.onDidActivateGroup(showEditorIfHidden));
      this._register(this.mainPartEditorService.onDidActiveEditorChange(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED))));
    });
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if ([
        ...TITLE_BAR_SETTINGS,
        "workbench.sideBar.location" /* SIDEBAR_POSITION */,
        "workbench.statusBar.visible" /* STATUSBAR_VISIBLE */
      ].some((setting) => e.affectsConfiguration(setting))) {
        const shareEnabled = e.affectsConfiguration("workbench.experimental.share.enabled") && this.configurationService.getValue("workbench.experimental.share.enabled");
        const navigationControlEnabled = e.affectsConfiguration("workbench.navigationControl.enabled") && this.configurationService.getValue("workbench.navigationControl.enabled");
        if (shareEnabled || navigationControlEnabled) {
          if (this.configurationService.getValue(LayoutSettings.COMMAND_CENTER) === false) {
            this.configurationService.updateValue(LayoutSettings.COMMAND_CENTER, true);
            return;
          }
        }
        const editorActionsMovedToTitlebar = e.affectsConfiguration(LayoutSettings.EDITOR_ACTIONS_LOCATION) && this.configurationService.getValue(LayoutSettings.EDITOR_ACTIONS_LOCATION) === EditorActionsLocation.TITLEBAR;
        const commandCenterEnabled = e.affectsConfiguration(LayoutSettings.COMMAND_CENTER) && this.configurationService.getValue(LayoutSettings.COMMAND_CENTER);
        const layoutControlsEnabled = e.affectsConfiguration(LayoutSettings.LAYOUT_ACTIONS) && this.configurationService.getValue(LayoutSettings.LAYOUT_ACTIONS);
        const activityBarMovedToTopOrBottom = e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION) && [ActivityBarPosition.TOP, ActivityBarPosition.BOTTOM].includes(this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION));
        if (activityBarMovedToTopOrBottom || editorActionsMovedToTitlebar || commandCenterEnabled || layoutControlsEnabled) {
          if (this.configurationService.getValue(TitleBarSetting.CUSTOM_TITLE_BAR_VISIBILITY) === CustomTitleBarVisibility.NEVER) {
            this.configurationService.updateValue(TitleBarSetting.CUSTOM_TITLE_BAR_VISIBILITY, CustomTitleBarVisibility.AUTO);
            return;
          }
        }
        this.doUpdateLayoutConfiguration();
      }
    }));
    this._register(onDidChangeFullscreen((windowId) => this.onFullscreenChanged(windowId)));
    this._register(this.editorGroupService.mainPart.onDidAddGroup(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED))));
    this._register(this.editorGroupService.mainPart.onDidRemoveGroup(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED))));
    this._register(this.editorGroupService.mainPart.onDidChangeGroupMaximized(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED))));
    this._register(addDisposableListener(this.mainContainer, EventType.SCROLL, () => this.mainContainer.scrollTop = 0));
    const showingCustomMenu = (isWindows || isLinux || isWeb) && !hasNativeTitlebar(this.configurationService);
    if (showingCustomMenu) {
      this._register(this.titleService.onMenubarVisibilityChange((visible) => this.onMenubarToggled(visible)));
    }
    this._register(this.themeService.onDidColorThemeChange(() => this.updateWindowsBorder()));
    this._register(this.hostService.onDidChangeFocus((focused) => this.onWindowFocusChanged(focused)));
    this._register(this.hostService.onDidChangeActiveWindow(() => this.onActiveWindowChanged()));
    if (isWeb && typeof navigator.windowControlsOverlay === "object") {
      this._register(addDisposableListener(navigator.windowControlsOverlay, "geometrychange", () => this.onDidChangeWCO()));
    }
    this._register(this.auxiliaryWindowService.onDidOpenAuxiliaryWindow(({ window, disposables }) => {
      const windowId = window.window.vscodeWindowId;
      this.containerStylesLoaded.set(windowId, window.whenStylesHaveLoaded);
      window.whenStylesHaveLoaded.then(() => this.containerStylesLoaded.delete(windowId));
      disposables.add(toDisposable(() => this.containerStylesLoaded.delete(windowId)));
      const eventDisposables = disposables.add(new DisposableStore());
      this._onDidAddContainer.fire({ container: window.container, disposables: eventDisposables });
      disposables.add(window.onDidLayout((dimension) => this.handleContainerDidLayout(window.container, dimension)));
    }));
  }
  onMenubarToggled(visible) {
    if (visible !== this.state.runtime.menuBar.toggled) {
      this.state.runtime.menuBar.toggled = visible;
      const menuBarVisibility = getMenuBarVisibility(this.configurationService);
      if (isWeb && menuBarVisibility === "toggle") {
        this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled));
      } else if (this.state.runtime.mainWindowFullscreen && (menuBarVisibility === "toggle" || menuBarVisibility === "classic")) {
        this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled));
      }
      this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
    }
  }
  handleContainerDidLayout(container, dimension) {
    if (container === this.mainContainer) {
      this._onDidLayoutMainContainer.fire(dimension);
    }
    if (isActiveDocument(container)) {
      this._onDidLayoutActiveContainer.fire(dimension);
    }
    this._onDidLayoutContainer.fire({ container, dimension });
  }
  onFullscreenChanged(windowId) {
    if (windowId !== mainWindow.vscodeWindowId) {
      return;
    }
    this.state.runtime.mainWindowFullscreen = isFullscreen(mainWindow);
    if (this.state.runtime.mainWindowFullscreen) {
      this.mainContainer.classList.add("fullscreen" /* FULLSCREEN */);
    } else {
      this.mainContainer.classList.remove("fullscreen" /* FULLSCREEN */);
      const zenModeExitInfo = this.stateModel.getRuntimeValue(LayoutStateKeys.ZEN_MODE_EXIT_INFO);
      if (zenModeExitInfo.transitionedToFullScreen && this.isZenModeActive()) {
        this.toggleZenMode();
      }
    }
    this.workbenchGrid.edgeSnapping = this.state.runtime.mainWindowFullscreen;
    if (hasCustomTitlebar(this.configurationService)) {
      this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled));
      this.updateWindowsBorder(true);
    }
  }
  onActiveWindowChanged() {
    const activeContainerId = this.getActiveContainerId();
    if (this.state.runtime.activeContainerId !== activeContainerId) {
      this.state.runtime.activeContainerId = activeContainerId;
      this.updateWindowsBorder();
      this._onDidChangeActiveContainer.fire();
    }
  }
  onWindowFocusChanged(hasFocus) {
    if (this.state.runtime.hasFocus !== hasFocus) {
      this.state.runtime.hasFocus = hasFocus;
      this.updateWindowsBorder();
    }
  }
  getActiveContainerId() {
    const activeContainer = this.activeContainer;
    return getWindow(activeContainer).vscodeWindowId;
  }
  doUpdateLayoutConfiguration(skipLayout) {
    this.updateCustomTitleBarVisibility();
    this.updateMenubarVisibility(!!skipLayout);
    this.editorGroupService.whenRestored.then(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED), skipLayout));
  }
  setSideBarPosition(position2) {
    const activityBar = this.getPart(Parts.ACTIVITYBAR_PART);
    const sideBar = this.getPart(Parts.SIDEBAR_PART);
    const auxiliaryBar = this.getPart(Parts.AUXILIARYBAR_PART);
    const newPositionValue = position2 === Position.LEFT ? "left" : "right";
    const oldPositionValue = position2 === Position.RIGHT ? "left" : "right";
    const panelAlignment = this.getPanelAlignment();
    const panelPosition = this.getPanelPosition();
    this.stateModel.setRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON, position2);
    const activityBarContainer = assertIsDefined(activityBar.getContainer());
    const sideBarContainer = assertIsDefined(sideBar.getContainer());
    const auxiliaryBarContainer = assertIsDefined(auxiliaryBar.getContainer());
    activityBarContainer.classList.remove(oldPositionValue);
    sideBarContainer.classList.remove(oldPositionValue);
    activityBarContainer.classList.add(newPositionValue);
    sideBarContainer.classList.add(newPositionValue);
    auxiliaryBarContainer.classList.remove(newPositionValue);
    auxiliaryBarContainer.classList.add(oldPositionValue);
    activityBar.updateStyles();
    sideBar.updateStyles();
    auxiliaryBar.updateStyles();
    this.adjustPartPositions(position2, panelAlignment, panelPosition);
  }
  updateWindowsBorder(skipLayout = false) {
    if (isWeb || isWindows || // not working well with zooming (border often not visible)
    (isWindows || isLinux) && useWindowControlsOverlay(this.configurationService) || hasNativeTitlebar(this.configurationService)) {
      return;
    }
    const theme = this.themeService.getColorTheme();
    const activeBorder = theme.getColor(WINDOW_ACTIVE_BORDER);
    const inactiveBorder = theme.getColor(WINDOW_INACTIVE_BORDER);
    const didHaveMainWindowBorder = this.hasMainWindowBorder();
    for (const container of this.containers) {
      const isMainContainer = container === this.mainContainer;
      const isActiveContainer = this.activeContainer === container;
      let windowBorder = false;
      if (!this.state.runtime.mainWindowFullscreen && (activeBorder || inactiveBorder)) {
        windowBorder = true;
        const borderColor = isActiveContainer && this.state.runtime.hasFocus ? activeBorder : inactiveBorder ?? activeBorder;
        container.style.setProperty("--window-border-color", borderColor?.toString() ?? "transparent");
      }
      if (isMainContainer) {
        this.state.runtime.mainWindowBorder = windowBorder;
      }
      container.classList.toggle("border" /* WINDOW_BORDER */, windowBorder);
    }
    if (!skipLayout && didHaveMainWindowBorder !== this.hasMainWindowBorder()) {
      this.layout();
    }
  }
  initLayoutState(lifecycleService, fileService) {
    this._mainContainerDimension = getClientArea(this.parent, DEFAULT_WINDOW_DIMENSIONS);
    this.stateModel = new LayoutStateModel(this.storageService, this.configurationService, this.contextService);
    this.stateModel.load(this._mainContainerDimension);
    if (this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN) && this.stateModel.getRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN)) {
      this.stateModel.setRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN, false);
    }
    this._register(this.stateModel.onDidChangeState((change) => {
      if (change.key === LayoutStateKeys.ACTIVITYBAR_HIDDEN) {
        this.setActivityBarHidden(change.value);
      }
      if (change.key === LayoutStateKeys.STATUSBAR_HIDDEN) {
        this.setStatusBarHidden(change.value);
      }
      if (change.key === LayoutStateKeys.SIDEBAR_POSITON) {
        this.setSideBarPosition(change.value);
      }
      if (change.key === LayoutStateKeys.PANEL_POSITION) {
        this.setPanelPosition(change.value);
      }
      if (change.key === LayoutStateKeys.PANEL_ALIGNMENT) {
        this.setPanelAlignment(change.value);
      }
      this.doUpdateLayoutConfiguration();
    }));
    const initialEditorsState = this.getInitialEditorsState();
    if (initialEditorsState) {
      this.logService.trace("Initial editor state", initialEditorsState);
    }
    const initialLayoutState = {
      layout: {
        editors: initialEditorsState?.layout
      },
      editor: {
        restoreEditors: this.shouldRestoreEditors(this.contextService, initialEditorsState),
        editorsToOpen: this.resolveEditorsToOpen(fileService, initialEditorsState)
      },
      views: {
        defaults: this.getDefaultLayoutViews(this.environmentService, this.storageService),
        containerToRestore: {}
      }
    };
    const layoutRuntimeState = {
      activeContainerId: this.getActiveContainerId(),
      mainWindowFullscreen: isFullscreen(mainWindow),
      hasFocus: this.hostService.hasFocus,
      maximized: /* @__PURE__ */ new Set(),
      mainWindowBorder: false,
      menuBar: {
        toggled: false
      },
      zenMode: {
        transitionDisposables: new DisposableMap()
      }
    };
    this.state = {
      initialization: initialLayoutState,
      runtime: layoutRuntimeState
    };
    if (this.isVisible(Parts.SIDEBAR_PART)) {
      let viewContainerToRestore;
      if (!this.environmentService.isBuilt || lifecycleService.startupKind === StartupKind.ReloadedWindow || this.environmentService.isExtensionDevelopment && !this.environmentService.extensionTestsLocationURI) {
        viewContainerToRestore = this.storageService.get(SidebarPart.activeViewletSettingsKey, StorageScope.WORKSPACE, this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Sidebar)?.id);
      } else {
        viewContainerToRestore = this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Sidebar)?.id;
      }
      if (viewContainerToRestore) {
        this.state.initialization.views.containerToRestore.sideBar = viewContainerToRestore;
      } else {
        this.stateModel.setRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN, true);
      }
    }
    if (this.isVisible(Parts.PANEL_PART)) {
      const viewContainerToRestore = this.storageService.get(PanelPart.activePanelSettingsKey, StorageScope.WORKSPACE, this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Panel)?.id);
      if (viewContainerToRestore) {
        this.state.initialization.views.containerToRestore.panel = viewContainerToRestore;
      } else {
        this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_HIDDEN, true);
      }
    }
    if (this.isVisible(Parts.AUXILIARYBAR_PART)) {
      const viewContainerToRestore = this.storageService.get(AuxiliaryBarPart.activeViewSettingsKey, StorageScope.WORKSPACE, this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.AuxiliaryBar)?.id);
      if (viewContainerToRestore) {
        this.state.initialization.views.containerToRestore.auxiliaryBar = viewContainerToRestore;
      } else {
        this.stateModel.setRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN, true);
      }
    }
    this.updateWindowsBorder(true);
  }
  getDefaultLayoutViews(environmentService, storageService) {
    const defaultLayout = environmentService.options?.defaultLayout;
    if (!defaultLayout) {
      return void 0;
    }
    if (!defaultLayout.force && !storageService.isNew(StorageScope.WORKSPACE)) {
      return void 0;
    }
    const { views } = defaultLayout;
    if (views?.length) {
      return views.map((view) => view.id);
    }
    return void 0;
  }
  shouldRestoreEditors(contextService, initialEditorsState) {
    if (isTemporaryWorkspace(contextService.getWorkspace())) {
      return false;
    }
    const forceRestoreEditors = this.configurationService.getValue("window.restoreWindows") === "preserve";
    return !!forceRestoreEditors || initialEditorsState === void 0;
  }
  willRestoreEditors() {
    return this.state.initialization.editor.restoreEditors;
  }
  async resolveEditorsToOpen(fileService, initialEditorsState) {
    if (initialEditorsState) {
      const filesToMerge = coalesce(await pathsToEditors(initialEditorsState.filesToMerge, fileService, this.logService));
      if (filesToMerge.length === 4 && isResourceEditorInput(filesToMerge[0]) && isResourceEditorInput(filesToMerge[1]) && isResourceEditorInput(filesToMerge[2]) && isResourceEditorInput(filesToMerge[3])) {
        return [{
          editor: {
            input1: { resource: filesToMerge[0].resource },
            input2: { resource: filesToMerge[1].resource },
            base: { resource: filesToMerge[2].resource },
            result: { resource: filesToMerge[3].resource },
            options: { pinned: true }
          }
        }];
      }
      const filesToDiff = coalesce(await pathsToEditors(initialEditorsState.filesToDiff, fileService, this.logService));
      if (filesToDiff.length === 2) {
        return [{
          editor: {
            original: { resource: filesToDiff[0].resource },
            modified: { resource: filesToDiff[1].resource },
            options: { pinned: true }
          }
        }];
      }
      const filesToOpenOrCreate = [];
      const resolvedFilesToOpenOrCreate = await pathsToEditors(initialEditorsState.filesToOpenOrCreate, fileService, this.logService);
      for (let i = 0; i < resolvedFilesToOpenOrCreate.length; i++) {
        const resolvedFileToOpenOrCreate = resolvedFilesToOpenOrCreate[i];
        if (resolvedFileToOpenOrCreate) {
          filesToOpenOrCreate.push({
            editor: resolvedFileToOpenOrCreate,
            viewColumn: initialEditorsState.filesToOpenOrCreate?.[i].viewColumn
            // take over `viewColumn` from initial state
          });
        }
      }
      return filesToOpenOrCreate;
    } else if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY && this.configurationService.getValue("workbench.startupEditor") === "newUntitledFile") {
      if (this.editorGroupService.hasRestorableState) {
        return [];
      }
      const hasBackups = await this.workingCopyBackupService.hasBackups();
      if (hasBackups) {
        return [];
      }
      return [{
        editor: { resource: void 0 }
        // open empty untitled file
      }];
    }
    return [];
  }
  get openedDefaultEditors() {
    return this._openedDefaultEditors;
  }
  getInitialEditorsState() {
    const defaultLayout = this.environmentService.options?.defaultLayout;
    if ((defaultLayout?.editors?.length || defaultLayout?.layout?.editors) && (defaultLayout.force || this.storageService.isNew(StorageScope.WORKSPACE))) {
      this._openedDefaultEditors = true;
      return {
        layout: defaultLayout.layout?.editors,
        filesToOpenOrCreate: defaultLayout?.editors?.map((editor) => {
          return {
            viewColumn: editor.viewColumn,
            fileUri: URI.revive(editor.uri),
            openOnlyIfExists: editor.openOnlyIfExists,
            options: editor.options
          };
        })
      };
    }
    const { filesToOpenOrCreate, filesToDiff, filesToMerge } = this.environmentService;
    if (filesToOpenOrCreate || filesToDiff || filesToMerge) {
      return { filesToOpenOrCreate, filesToDiff, filesToMerge };
    }
    return void 0;
  }
  isRestored() {
    return this.restored;
  }
  restoreParts() {
    const layoutReadyPromises = [];
    const layoutRestoredPromises = [];
    layoutReadyPromises.push((async () => {
      mark("code/willRestoreEditors");
      await this.editorGroupService.whenReady;
      mark("code/restoreEditors/editorGroupsReady");
      if (this.state.initialization.layout?.editors) {
        this.editorGroupService.mainPart.applyLayout(this.state.initialization.layout.editors);
      }
      const editors = await this.state.initialization.editor.editorsToOpen;
      mark("code/restoreEditors/editorsToOpenResolved");
      let openEditorsPromise = void 0;
      if (editors.length) {
        const editorGroupsInVisualOrder = this.editorGroupService.mainPart.getGroups(GroupsOrder.GRID_APPEARANCE);
        const mapEditorsToGroup = /* @__PURE__ */ new Map();
        for (const editor of editors) {
          const group = editorGroupsInVisualOrder[(editor.viewColumn ?? 1) - 1];
          let editorsByGroup = mapEditorsToGroup.get(group.id);
          if (!editorsByGroup) {
            editorsByGroup = /* @__PURE__ */ new Set();
            mapEditorsToGroup.set(group.id, editorsByGroup);
          }
          editorsByGroup.add(editor.editor);
        }
        openEditorsPromise = Promise.all(Array.from(mapEditorsToGroup).map(async ([groupId, editors2]) => {
          try {
            await this.editorService.openEditors(Array.from(editors2), groupId, { validateTrust: true });
          } catch (error) {
            this.logService.error(error);
          }
        }));
      }
      layoutRestoredPromises.push(
        Promise.all([
          openEditorsPromise?.finally(() => mark("code/restoreEditors/editorsOpened")),
          this.editorGroupService.whenRestored.finally(() => mark("code/restoreEditors/editorGroupsRestored"))
        ]).finally(() => {
          mark("code/didRestoreEditors");
        })
      );
    })());
    const restoreDefaultViewsPromise = (async () => {
      if (this.state.initialization.views.defaults?.length) {
        mark("code/willOpenDefaultViews");
        const locationsRestored = [];
        const tryOpenView = (view) => {
          const location = this.viewDescriptorService.getViewLocationById(view.id);
          if (location !== null) {
            const container = this.viewDescriptorService.getViewContainerByViewId(view.id);
            if (container) {
              if (view.order >= (locationsRestored?.[location]?.order ?? 0)) {
                locationsRestored[location] = { id: container.id, order: view.order };
              }
              const containerModel = this.viewDescriptorService.getViewContainerModel(container);
              containerModel.setCollapsed(view.id, false);
              containerModel.setVisible(view.id, true);
              return true;
            }
          }
          return false;
        };
        const defaultViews = [...this.state.initialization.views.defaults].reverse().map((v, index) => ({ id: v, order: index }));
        let i = defaultViews.length;
        while (i) {
          i--;
          if (tryOpenView(defaultViews[i])) {
            defaultViews.splice(i, 1);
          }
        }
        if (defaultViews.length) {
          await this.extensionService.whenInstalledExtensionsRegistered();
          let i2 = defaultViews.length;
          while (i2) {
            i2--;
            if (tryOpenView(defaultViews[i2])) {
              defaultViews.splice(i2, 1);
            }
          }
        }
        if (locationsRestored[ViewContainerLocation.Sidebar]) {
          this.state.initialization.views.containerToRestore.sideBar = locationsRestored[ViewContainerLocation.Sidebar].id;
        }
        if (locationsRestored[ViewContainerLocation.Panel]) {
          this.state.initialization.views.containerToRestore.panel = locationsRestored[ViewContainerLocation.Panel].id;
        }
        if (locationsRestored[ViewContainerLocation.AuxiliaryBar]) {
          this.state.initialization.views.containerToRestore.auxiliaryBar = locationsRestored[ViewContainerLocation.AuxiliaryBar].id;
        }
        mark("code/didOpenDefaultViews");
      }
    })();
    layoutReadyPromises.push(restoreDefaultViewsPromise);
    layoutReadyPromises.push((async () => {
      await restoreDefaultViewsPromise;
      if (!this.state.initialization.views.containerToRestore.sideBar) {
        return;
      }
      mark("code/willRestoreViewlet");
      const viewlet = await this.paneCompositeService.openPaneComposite(this.state.initialization.views.containerToRestore.sideBar, ViewContainerLocation.Sidebar);
      if (!viewlet) {
        await this.paneCompositeService.openPaneComposite(this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Sidebar)?.id, ViewContainerLocation.Sidebar);
      }
      mark("code/didRestoreViewlet");
    })());
    layoutReadyPromises.push((async () => {
      await restoreDefaultViewsPromise;
      if (!this.state.initialization.views.containerToRestore.panel) {
        return;
      }
      mark("code/willRestorePanel");
      const panel = await this.paneCompositeService.openPaneComposite(this.state.initialization.views.containerToRestore.panel, ViewContainerLocation.Panel);
      if (!panel) {
        await this.paneCompositeService.openPaneComposite(this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Panel)?.id, ViewContainerLocation.Panel);
      }
      mark("code/didRestorePanel");
    })());
    layoutReadyPromises.push((async () => {
      await restoreDefaultViewsPromise;
      if (!this.state.initialization.views.containerToRestore.auxiliaryBar) {
        return;
      }
      mark("code/willRestoreAuxiliaryBar");
      const viewlet = await this.paneCompositeService.openPaneComposite(this.state.initialization.views.containerToRestore.auxiliaryBar, ViewContainerLocation.AuxiliaryBar);
      if (!viewlet) {
        await this.paneCompositeService.openPaneComposite(this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.AuxiliaryBar)?.id, ViewContainerLocation.AuxiliaryBar);
      }
      mark("code/didRestoreAuxiliaryBar");
    })());
    const zenModeWasActive = this.isZenModeActive();
    const restoreZenMode = getZenModeConfiguration(this.configurationService).restore;
    if (zenModeWasActive) {
      this.setZenModeActive(!restoreZenMode);
      this.toggleZenMode(false, true);
    }
    if (this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED)) {
      this.centerMainEditorLayout(true, true);
    }
    Promises.settled(layoutReadyPromises).finally(() => {
      this.whenReadyPromise.complete();
      Promises.settled(layoutRestoredPromises).finally(() => {
        this.restored = true;
        this.whenRestoredPromise.complete();
      });
    });
  }
  registerPart(part) {
    const id = part.getId();
    this.parts.set(id, part);
    return toDisposable(() => this.parts.delete(id));
  }
  getPart(key) {
    const part = this.parts.get(key);
    if (!part) {
      throw new Error(`Unknown part ${key}`);
    }
    return part;
  }
  registerNotifications(delegate) {
    this._register(delegate.onDidChangeNotificationsVisibility((visible) => this._onDidChangeNotificationsVisibility.fire(visible)));
  }
  hasFocus(part) {
    const container = this.getContainer(getActiveWindow(), part);
    if (!container) {
      return false;
    }
    const activeElement = getActiveElement();
    if (!activeElement) {
      return false;
    }
    return isAncestorUsingFlowTo(activeElement, container);
  }
  _getFocusedPart() {
    for (const part of this.parts.keys()) {
      if (this.hasFocus(part)) {
        return part;
      }
    }
    return void 0;
  }
  focusPart(part, targetWindow = mainWindow) {
    const container = this.getContainer(targetWindow, part) ?? this.mainContainer;
    switch (part) {
      case Parts.EDITOR_PART:
        this.editorGroupService.getPart(container).activeGroup.focus();
        break;
      case Parts.PANEL_PART: {
        this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)?.focus();
        break;
      }
      case Parts.SIDEBAR_PART: {
        this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar)?.focus();
        break;
      }
      case Parts.AUXILIARYBAR_PART: {
        this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)?.focus();
        break;
      }
      case Parts.ACTIVITYBAR_PART:
        this.getPart(Parts.SIDEBAR_PART).focusActivityBar();
        break;
      case Parts.STATUSBAR_PART:
        this.statusBarService.getPart(container).focus();
        break;
      default: {
        container?.focus();
      }
    }
  }
  getContainer(targetWindow, part) {
    if (typeof part === "undefined") {
      return this.getContainerFromDocument(targetWindow.document);
    }
    if (targetWindow === mainWindow) {
      return this.getPart(part).getContainer();
    }
    let partCandidate;
    if (part === Parts.EDITOR_PART) {
      partCandidate = this.editorGroupService.getPart(this.getContainerFromDocument(targetWindow.document));
    } else if (part === Parts.STATUSBAR_PART) {
      partCandidate = this.statusBarService.getPart(this.getContainerFromDocument(targetWindow.document));
    } else if (part === Parts.TITLEBAR_PART) {
      partCandidate = this.titleService.getPart(this.getContainerFromDocument(targetWindow.document));
    }
    if (partCandidate instanceof Part) {
      return partCandidate.getContainer();
    }
    return void 0;
  }
  isVisible(part, targetWindow = mainWindow) {
    if (targetWindow !== mainWindow && part === Parts.EDITOR_PART) {
      return true;
    }
    if (this.initialized) {
      switch (part) {
        case Parts.TITLEBAR_PART:
          return this.workbenchGrid.isViewVisible(this.titleBarPartView);
        case Parts.SIDEBAR_PART:
          return !this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN);
        case Parts.PANEL_PART:
          return !this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN);
        case Parts.AUXILIARYBAR_PART:
          return !this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN);
        case Parts.STATUSBAR_PART:
          return !this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN);
        case Parts.ACTIVITYBAR_PART:
          return !this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN);
        case Parts.EDITOR_PART:
          return !this.stateModel.getRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN);
        case Parts.BANNER_PART:
          return this.workbenchGrid.isViewVisible(this.bannerPartView);
        default:
          return false;
      }
    }
    switch (part) {
      case Parts.TITLEBAR_PART:
        return shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled);
      case Parts.SIDEBAR_PART:
        return !this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN);
      case Parts.PANEL_PART:
        return !this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN);
      case Parts.AUXILIARYBAR_PART:
        return !this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN);
      case Parts.STATUSBAR_PART:
        return !this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN);
      case Parts.ACTIVITYBAR_PART:
        return !this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN);
      case Parts.EDITOR_PART:
        return !this.stateModel.getRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN);
      default:
        return false;
    }
  }
  shouldShowBannerFirst() {
    return isWeb && !isWCOEnabled();
  }
  focus() {
    if (this.isPanelMaximized() && this.mainContainer === this.activeContainer) {
      this.focusPart(Parts.PANEL_PART);
    } else {
      this.focusPart(Parts.EDITOR_PART, getWindow(this.activeContainer));
    }
  }
  focusPanelOrEditor() {
    const activePanel = this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
    if ((this.hasFocus(Parts.PANEL_PART) || !this.isVisible(Parts.EDITOR_PART)) && activePanel) {
      activePanel.focus();
    } else {
      this.focus();
    }
  }
  getMaximumEditorDimensions(container) {
    const targetWindow = getWindow(container);
    const containerDimension = this.getContainerDimension(container);
    if (container === this.mainContainer) {
      const isPanelHorizontal = isHorizontal(this.getPanelPosition());
      const takenWidth = (this.isVisible(Parts.ACTIVITYBAR_PART) ? this.activityBarPartView.minimumWidth : 0) + (this.isVisible(Parts.SIDEBAR_PART) ? this.sideBarPartView.minimumWidth : 0) + (this.isVisible(Parts.PANEL_PART) && !isPanelHorizontal ? this.panelPartView.minimumWidth : 0) + (this.isVisible(Parts.AUXILIARYBAR_PART) ? this.auxiliaryBarPartView.minimumWidth : 0);
      const takenHeight = (this.isVisible(Parts.TITLEBAR_PART, targetWindow) ? this.titleBarPartView.minimumHeight : 0) + (this.isVisible(Parts.STATUSBAR_PART, targetWindow) ? this.statusBarPartView.minimumHeight : 0) + (this.isVisible(Parts.PANEL_PART) && isPanelHorizontal ? this.panelPartView.minimumHeight : 0);
      const availableWidth = containerDimension.width - takenWidth;
      const availableHeight = containerDimension.height - takenHeight;
      return { width: availableWidth, height: availableHeight };
    } else {
      const takenHeight = (this.isVisible(Parts.TITLEBAR_PART, targetWindow) ? this.titleBarPartView.minimumHeight : 0) + (this.isVisible(Parts.STATUSBAR_PART, targetWindow) ? this.statusBarPartView.minimumHeight : 0);
      return { width: containerDimension.width, height: containerDimension.height - takenHeight };
    }
  }
  isZenModeActive() {
    return this.stateModel.getRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE);
  }
  setZenModeActive(active) {
    this.stateModel.setRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE, active);
  }
  toggleZenMode(skipLayout, restoring = false) {
    const focusedPartPreTransition = this._getFocusedPart();
    this.setZenModeActive(!this.isZenModeActive());
    this.state.runtime.zenMode.transitionDisposables.clearAndDisposeAll();
    const setLineNumbers = (lineNumbers) => {
      for (const editor of this.mainPartEditorService.visibleTextEditorControls) {
        if (!lineNumbers && isCodeEditor(editor) && editor.hasModel()) {
          const model = editor.getModel();
          lineNumbers = this.configurationService.getValue("editor.lineNumbers", { resource: model.uri, overrideIdentifier: model.getLanguageId() });
        }
        if (!lineNumbers) {
          lineNumbers = this.configurationService.getValue("editor.lineNumbers");
        }
        editor.updateOptions({ lineNumbers });
      }
    };
    let toggleMainWindowFullScreen = false;
    const config = getZenModeConfiguration(this.configurationService);
    const zenModeExitInfo = this.stateModel.getRuntimeValue(LayoutStateKeys.ZEN_MODE_EXIT_INFO);
    if (this.isZenModeActive()) {
      toggleMainWindowFullScreen = !this.state.runtime.mainWindowFullscreen && config.fullScreen && !isIOS;
      if (!restoring) {
        zenModeExitInfo.transitionedToFullScreen = toggleMainWindowFullScreen;
        zenModeExitInfo.transitionedToCenteredEditorLayout = !this.isMainEditorLayoutCentered() && config.centerLayout;
        zenModeExitInfo.handleNotificationsDoNotDisturbMode = this.notificationService.getFilter() === NotificationsFilter.OFF;
        zenModeExitInfo.wasVisible.sideBar = this.isVisible(Parts.SIDEBAR_PART);
        zenModeExitInfo.wasVisible.panel = this.isVisible(Parts.PANEL_PART);
        zenModeExitInfo.wasVisible.auxiliaryBar = this.isVisible(Parts.AUXILIARYBAR_PART);
        this.stateModel.setRuntimeValue(LayoutStateKeys.ZEN_MODE_EXIT_INFO, zenModeExitInfo);
      }
      this.setPanelHidden(true, true);
      this.setAuxiliaryBarHidden(true, true);
      this.setSideBarHidden(true, true);
      if (config.hideActivityBar) {
        this.setActivityBarHidden(true, true);
      }
      if (config.hideStatusBar) {
        this.setStatusBarHidden(true, true);
      }
      if (config.hideLineNumbers) {
        setLineNumbers("off");
        this.state.runtime.zenMode.transitionDisposables.set(ZenModeSettings.HIDE_LINENUMBERS, this.mainPartEditorService.onDidVisibleEditorsChange(() => setLineNumbers("off")));
      }
      if (config.showTabs !== this.editorGroupService.partOptions.showTabs) {
        this.state.runtime.zenMode.transitionDisposables.set(ZenModeSettings.SHOW_TABS, this.editorGroupService.mainPart.enforcePartOptions({ showTabs: config.showTabs }));
      }
      if (config.silentNotifications && zenModeExitInfo.handleNotificationsDoNotDisturbMode) {
        this.notificationService.setFilter(NotificationsFilter.ERROR);
      }
      if (config.centerLayout) {
        this.centerMainEditorLayout(true, true);
      }
      this.state.runtime.zenMode.transitionDisposables.set("configurationChange", this.configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(ZenModeSettings.HIDE_ACTIVITYBAR)) {
          const zenModeHideActivityBar = this.configurationService.getValue(ZenModeSettings.HIDE_ACTIVITYBAR);
          this.setActivityBarHidden(zenModeHideActivityBar, true);
        }
        if (e.affectsConfiguration(ZenModeSettings.HIDE_STATUSBAR)) {
          const zenModeHideStatusBar = this.configurationService.getValue(ZenModeSettings.HIDE_STATUSBAR);
          this.setStatusBarHidden(zenModeHideStatusBar, true);
        }
        if (e.affectsConfiguration(ZenModeSettings.CENTER_LAYOUT)) {
          const zenModeCenterLayout = this.configurationService.getValue(ZenModeSettings.CENTER_LAYOUT);
          this.centerMainEditorLayout(zenModeCenterLayout, true);
        }
        if (e.affectsConfiguration(ZenModeSettings.SHOW_TABS)) {
          const zenModeShowTabs = this.configurationService.getValue(ZenModeSettings.SHOW_TABS) ?? "multiple";
          this.state.runtime.zenMode.transitionDisposables.set(ZenModeSettings.SHOW_TABS, this.editorGroupService.mainPart.enforcePartOptions({ showTabs: zenModeShowTabs }));
        }
        if (e.affectsConfiguration(ZenModeSettings.SILENT_NOTIFICATIONS)) {
          const zenModeSilentNotifications = !!this.configurationService.getValue(ZenModeSettings.SILENT_NOTIFICATIONS);
          if (zenModeExitInfo.handleNotificationsDoNotDisturbMode) {
            this.notificationService.setFilter(zenModeSilentNotifications ? NotificationsFilter.ERROR : NotificationsFilter.OFF);
          }
        }
        if (e.affectsConfiguration(ZenModeSettings.HIDE_LINENUMBERS)) {
          const lineNumbersType = this.configurationService.getValue(ZenModeSettings.HIDE_LINENUMBERS) ? "off" : void 0;
          setLineNumbers(lineNumbersType);
          this.state.runtime.zenMode.transitionDisposables.set(ZenModeSettings.HIDE_LINENUMBERS, this.mainPartEditorService.onDidVisibleEditorsChange(() => setLineNumbers(lineNumbersType)));
        }
      }));
    } else {
      if (zenModeExitInfo.wasVisible.panel) {
        this.setPanelHidden(false, true);
      }
      if (zenModeExitInfo.wasVisible.auxiliaryBar) {
        this.setAuxiliaryBarHidden(false, true);
      }
      if (zenModeExitInfo.wasVisible.sideBar) {
        this.setSideBarHidden(false, true);
      }
      if (!this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN, true)) {
        this.setActivityBarHidden(false, true);
      }
      if (!this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN, true)) {
        this.setStatusBarHidden(false, true);
      }
      if (zenModeExitInfo.transitionedToCenteredEditorLayout) {
        this.centerMainEditorLayout(false, true);
      }
      if (zenModeExitInfo.handleNotificationsDoNotDisturbMode) {
        this.notificationService.setFilter(NotificationsFilter.OFF);
      }
      setLineNumbers();
      toggleMainWindowFullScreen = zenModeExitInfo.transitionedToFullScreen && this.state.runtime.mainWindowFullscreen;
    }
    if (!skipLayout) {
      this.layout();
    }
    if (toggleMainWindowFullScreen) {
      this.hostService.toggleFullScreen(mainWindow);
    }
    if (focusedPartPreTransition && this.isVisible(focusedPartPreTransition, getWindow(this.activeContainer))) {
      if (isMultiWindowPart(focusedPartPreTransition)) {
        this.focusPart(focusedPartPreTransition, getWindow(this.activeContainer));
      } else {
        this.focusPart(focusedPartPreTransition);
      }
    } else {
      this.focus();
    }
    this._onDidChangeZenMode.fire(this.isZenModeActive());
  }
  setStatusBarHidden(hidden, skipLayout) {
    this.stateModel.setRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN, hidden);
    if (hidden) {
      this.mainContainer.classList.add("nostatusbar" /* STATUSBAR_HIDDEN */);
    } else {
      this.mainContainer.classList.remove("nostatusbar" /* STATUSBAR_HIDDEN */);
    }
    this.workbenchGrid.setViewVisible(this.statusBarPartView, !hidden);
  }
  createWorkbenchLayout() {
    const titleBar = this.getPart(Parts.TITLEBAR_PART);
    const bannerPart = this.getPart(Parts.BANNER_PART);
    const editorPart = this.getPart(Parts.EDITOR_PART);
    const activityBar = this.getPart(Parts.ACTIVITYBAR_PART);
    const panelPart = this.getPart(Parts.PANEL_PART);
    const auxiliaryBarPart = this.getPart(Parts.AUXILIARYBAR_PART);
    const sideBar = this.getPart(Parts.SIDEBAR_PART);
    const statusBar = this.getPart(Parts.STATUSBAR_PART);
    this.titleBarPartView = titleBar;
    this.bannerPartView = bannerPart;
    this.sideBarPartView = sideBar;
    this.activityBarPartView = activityBar;
    this.editorPartView = editorPart;
    this.panelPartView = panelPart;
    this.auxiliaryBarPartView = auxiliaryBarPart;
    this.statusBarPartView = statusBar;
    const viewMap = {
      [Parts.ACTIVITYBAR_PART]: this.activityBarPartView,
      [Parts.BANNER_PART]: this.bannerPartView,
      [Parts.TITLEBAR_PART]: this.titleBarPartView,
      [Parts.EDITOR_PART]: this.editorPartView,
      [Parts.PANEL_PART]: this.panelPartView,
      [Parts.SIDEBAR_PART]: this.sideBarPartView,
      [Parts.STATUSBAR_PART]: this.statusBarPartView,
      [Parts.AUXILIARYBAR_PART]: this.auxiliaryBarPartView
    };
    const fromJSON = ({ type }) => viewMap[type];
    const workbenchGrid = SerializableGrid.deserialize(
      this.createGridDescriptor(),
      { fromJSON },
      { proportionalLayout: false }
    );
    this.mainContainer.prepend(workbenchGrid.element);
    this.mainContainer.setAttribute("role", "application");
    this.workbenchGrid = workbenchGrid;
    this.workbenchGrid.edgeSnapping = this.state.runtime.mainWindowFullscreen;
    for (const part of [titleBar, editorPart, activityBar, panelPart, sideBar, statusBar, auxiliaryBarPart, bannerPart]) {
      this._register(part.onDidVisibilityChange((visible) => {
        if (part === sideBar) {
          this.setSideBarHidden(!visible, true);
        } else if (part === panelPart) {
          this.setPanelHidden(!visible, true);
        } else if (part === auxiliaryBarPart) {
          this.setAuxiliaryBarHidden(!visible, true);
        } else if (part === editorPart) {
          this.setEditorHidden(!visible, true);
        }
        this._onDidChangePartVisibility.fire();
        this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
      }));
    }
    this._register(this.storageService.onWillSaveState((e) => {
      const sideBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN) ? this.workbenchGrid.getViewCachedVisibleSize(this.sideBarPartView) : this.workbenchGrid.getViewSize(this.sideBarPartView).width;
      this.stateModel.setInitializationValue(LayoutStateKeys.SIDEBAR_SIZE, sideBarSize);
      const panelSize = this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN) ? this.workbenchGrid.getViewCachedVisibleSize(this.panelPartView) : isHorizontal(this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_POSITION)) ? this.workbenchGrid.getViewSize(this.panelPartView).height : this.workbenchGrid.getViewSize(this.panelPartView).width;
      this.stateModel.setInitializationValue(LayoutStateKeys.PANEL_SIZE, panelSize);
      const auxiliaryBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN) ? this.workbenchGrid.getViewCachedVisibleSize(this.auxiliaryBarPartView) : this.workbenchGrid.getViewSize(this.auxiliaryBarPartView).width;
      this.stateModel.setInitializationValue(LayoutStateKeys.AUXILIARYBAR_SIZE, auxiliaryBarSize);
      this.stateModel.save(true, true);
    }));
  }
  layout() {
    if (!this.disposed) {
      this._mainContainerDimension = getClientArea(
        this.state.runtime.mainWindowFullscreen ? mainWindow.document.body : (
          // in fullscreen mode, make sure to use <body> element because
          this.parent
        ),
        // in that case the workbench will span the entire site
        DEFAULT_WINDOW_DIMENSIONS
        // running with fallback to ensure no error is thrown (https://github.com/microsoft/vscode/issues/240242)
      );
      this.logService.trace(`Layout#layout, height: ${this._mainContainerDimension.height}, width: ${this._mainContainerDimension.width}`);
      position(this.mainContainer, 0, 0, 0, 0, "relative");
      size(this.mainContainer, this._mainContainerDimension.width, this._mainContainerDimension.height);
      this.workbenchGrid.layout(this._mainContainerDimension.width, this._mainContainerDimension.height);
      this.initialized = true;
      this.handleContainerDidLayout(this.mainContainer, this._mainContainerDimension);
    }
  }
  isMainEditorLayoutCentered() {
    return this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED);
  }
  centerMainEditorLayout(active, skipLayout) {
    this.stateModel.setRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED, active);
    const mainVisibleEditors = coalesce(this.editorGroupService.mainPart.groups.map((group) => group.activeEditor));
    const isEditorComplex = mainVisibleEditors.some((editor) => {
      if (editor instanceof DiffEditorInput) {
        return this.configurationService.getValue("diffEditor.renderSideBySide");
      }
      if (editor?.hasCapability(EditorInputCapabilities.MultipleEditors)) {
        return true;
      }
      return false;
    });
    const layout = this.editorGroupService.getLayout();
    let hasMoreThanOneColumn = false;
    if (layout.orientation === GroupOrientation.HORIZONTAL) {
      hasMoreThanOneColumn = layout.groups.length > 1;
    } else {
      hasMoreThanOneColumn = layout.groups.some((group) => group.groups && group.groups.length > 1);
    }
    const isCenteredLayoutAutoResizing = this.configurationService.getValue("workbench.editor.centeredLayoutAutoResize");
    if (isCenteredLayoutAutoResizing && (hasMoreThanOneColumn && !this.editorGroupService.mainPart.hasMaximizedGroup() || isEditorComplex)) {
      active = false;
    }
    if (this.editorGroupService.mainPart.isLayoutCentered() !== active) {
      this.editorGroupService.mainPart.centerLayout(active);
      if (!skipLayout) {
        this.layout();
      }
    }
    this._onDidChangeMainEditorCenteredLayout.fire(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED));
  }
  getSize(part) {
    return this.workbenchGrid.getViewSize(this.getPart(part));
  }
  setSize(part, size2) {
    this.workbenchGrid.resizeView(this.getPart(part), size2);
  }
  resizePart(part, sizeChangeWidth, sizeChangeHeight) {
    const sizeChangePxWidth = Math.sign(sizeChangeWidth) * computeScreenAwareSize(getActiveWindow(), Math.abs(sizeChangeWidth));
    const sizeChangePxHeight = Math.sign(sizeChangeHeight) * computeScreenAwareSize(getActiveWindow(), Math.abs(sizeChangeHeight));
    let viewSize;
    switch (part) {
      case Parts.SIDEBAR_PART:
        viewSize = this.workbenchGrid.getViewSize(this.sideBarPartView);
        this.workbenchGrid.resizeView(
          this.sideBarPartView,
          {
            width: viewSize.width + sizeChangePxWidth,
            height: viewSize.height
          }
        );
        break;
      case Parts.PANEL_PART:
        viewSize = this.workbenchGrid.getViewSize(this.panelPartView);
        this.workbenchGrid.resizeView(
          this.panelPartView,
          {
            width: viewSize.width + (isHorizontal(this.getPanelPosition()) ? 0 : sizeChangePxWidth),
            height: viewSize.height + (isHorizontal(this.getPanelPosition()) ? sizeChangePxHeight : 0)
          }
        );
        break;
      case Parts.AUXILIARYBAR_PART:
        viewSize = this.workbenchGrid.getViewSize(this.auxiliaryBarPartView);
        this.workbenchGrid.resizeView(
          this.auxiliaryBarPartView,
          {
            width: viewSize.width + sizeChangePxWidth,
            height: viewSize.height
          }
        );
        break;
      case Parts.EDITOR_PART:
        viewSize = this.workbenchGrid.getViewSize(this.editorPartView);
        if (this.editorGroupService.mainPart.count === 1) {
          this.workbenchGrid.resizeView(
            this.editorPartView,
            {
              width: viewSize.width + sizeChangePxWidth,
              height: viewSize.height + sizeChangePxHeight
            }
          );
        } else {
          const activeGroup = this.editorGroupService.mainPart.activeGroup;
          const { width, height } = this.editorGroupService.mainPart.getSize(activeGroup);
          this.editorGroupService.mainPart.setSize(activeGroup, { width: width + sizeChangePxWidth, height: height + sizeChangePxHeight });
          const { width: newWidth, height: newHeight } = this.editorGroupService.mainPart.getSize(activeGroup);
          if (sizeChangePxHeight && height === newHeight || sizeChangePxWidth && width === newWidth) {
            this.workbenchGrid.resizeView(
              this.editorPartView,
              {
                width: viewSize.width + (sizeChangePxWidth && width === newWidth ? sizeChangePxWidth : 0),
                height: viewSize.height + (sizeChangePxHeight && height === newHeight ? sizeChangePxHeight : 0)
              }
            );
          }
        }
        break;
      default:
        return;
    }
  }
  setActivityBarHidden(hidden, skipLayout) {
    this.stateModel.setRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN, true);
    this.workbenchGrid.setViewVisible(this.activityBarPartView, false);
  }
  setBannerHidden(hidden) {
    this.workbenchGrid.setViewVisible(this.bannerPartView, !hidden);
  }
  setEditorHidden(hidden, skipLayout) {
    this.stateModel.setRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN, hidden);
    if (hidden) {
      this.mainContainer.classList.add("nomaineditorarea" /* MAIN_EDITOR_AREA_HIDDEN */);
    } else {
      this.mainContainer.classList.remove("nomaineditorarea" /* MAIN_EDITOR_AREA_HIDDEN */);
    }
    this.workbenchGrid.setViewVisible(this.editorPartView, !hidden);
    if (hidden && !this.isVisible(Parts.PANEL_PART)) {
      this.setPanelHidden(false, true);
    }
  }
  getLayoutClasses() {
    return coalesce([
      !this.isVisible(Parts.SIDEBAR_PART) ? "nosidebar" /* SIDEBAR_HIDDEN */ : void 0,
      !this.isVisible(Parts.EDITOR_PART, mainWindow) ? "nomaineditorarea" /* MAIN_EDITOR_AREA_HIDDEN */ : void 0,
      !this.isVisible(Parts.PANEL_PART) ? "nopanel" /* PANEL_HIDDEN */ : void 0,
      !this.isVisible(Parts.AUXILIARYBAR_PART) ? "noauxiliarybar" /* AUXILIARYBAR_HIDDEN */ : void 0,
      !this.isVisible(Parts.STATUSBAR_PART) ? "nostatusbar" /* STATUSBAR_HIDDEN */ : void 0,
      this.state.runtime.mainWindowFullscreen ? "fullscreen" /* FULLSCREEN */ : void 0
    ]);
  }
  setSideBarHidden(hidden, skipLayout) {
    this.stateModel.setRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN, hidden);
    if (hidden) {
      this.mainContainer.classList.add("nosidebar" /* SIDEBAR_HIDDEN */);
    } else {
      this.mainContainer.classList.remove("nosidebar" /* SIDEBAR_HIDDEN */);
    }
    if (hidden && this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar)) {
      this.paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Sidebar);
      this.focusPanelOrEditor();
    } else if (!hidden && !this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Sidebar)) {
      const viewletToOpen = this.paneCompositeService.getLastActivePaneCompositeId(ViewContainerLocation.Sidebar);
      if (viewletToOpen) {
        const viewlet = this.paneCompositeService.openPaneComposite(viewletToOpen, ViewContainerLocation.Sidebar, true);
        if (!viewlet) {
          this.paneCompositeService.openPaneComposite(this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Sidebar)?.id, ViewContainerLocation.Sidebar, true);
        }
      }
    }
    this.workbenchGrid.setViewVisible(this.sideBarPartView, !hidden);
  }
  hasViews(id) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(id);
    if (!viewContainer) {
      return false;
    }
    const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
    if (!viewContainerModel) {
      return false;
    }
    return viewContainerModel.activeViewDescriptors.length >= 1;
  }
  adjustPartPositions(sideBarPosition, panelAlignment, panelPosition) {
    const isPanelVertical = !isHorizontal(panelPosition);
    const sideBarSiblingToEditor = isPanelVertical || !(panelAlignment === "center" || sideBarPosition === Position.LEFT && panelAlignment === "right" || sideBarPosition === Position.RIGHT && panelAlignment === "left");
    const auxiliaryBarSiblingToEditor = isPanelVertical || !(panelAlignment === "center" || sideBarPosition === Position.RIGHT && panelAlignment === "right" || sideBarPosition === Position.LEFT && panelAlignment === "left");
    const preMovePanelWidth = !this.isVisible(Parts.PANEL_PART) ? Sizing.Invisible(this.workbenchGrid.getViewCachedVisibleSize(this.panelPartView) ?? this.panelPartView.minimumWidth) : this.workbenchGrid.getViewSize(this.panelPartView).width;
    const preMovePanelHeight = !this.isVisible(Parts.PANEL_PART) ? Sizing.Invisible(this.workbenchGrid.getViewCachedVisibleSize(this.panelPartView) ?? this.panelPartView.minimumHeight) : this.workbenchGrid.getViewSize(this.panelPartView).height;
    const preMoveSideBarSize = !this.isVisible(Parts.SIDEBAR_PART) ? Sizing.Invisible(this.workbenchGrid.getViewCachedVisibleSize(this.sideBarPartView) ?? this.sideBarPartView.minimumWidth) : this.workbenchGrid.getViewSize(this.sideBarPartView).width;
    const preMoveAuxiliaryBarSize = !this.isVisible(Parts.AUXILIARYBAR_PART) ? Sizing.Invisible(this.workbenchGrid.getViewCachedVisibleSize(this.auxiliaryBarPartView) ?? this.auxiliaryBarPartView.minimumWidth) : this.workbenchGrid.getViewSize(this.auxiliaryBarPartView).width;
    const focusedPart = [Parts.PANEL_PART, Parts.SIDEBAR_PART, Parts.AUXILIARYBAR_PART].find((part) => this.hasFocus(part));
    if (sideBarPosition === Position.LEFT) {
      this.workbenchGrid.moveViewTo(this.activityBarPartView, [2, 0]);
      this.workbenchGrid.moveView(this.sideBarPartView, preMoveSideBarSize, sideBarSiblingToEditor ? this.editorPartView : this.activityBarPartView, sideBarSiblingToEditor ? Direction.Left : Direction.Right);
      if (auxiliaryBarSiblingToEditor) {
        this.workbenchGrid.moveView(this.auxiliaryBarPartView, preMoveAuxiliaryBarSize, this.editorPartView, Direction.Right);
      } else {
        this.workbenchGrid.moveViewTo(this.auxiliaryBarPartView, [2, -1]);
      }
    } else {
      this.workbenchGrid.moveViewTo(this.activityBarPartView, [2, -1]);
      this.workbenchGrid.moveView(this.sideBarPartView, preMoveSideBarSize, sideBarSiblingToEditor ? this.editorPartView : this.activityBarPartView, sideBarSiblingToEditor ? Direction.Right : Direction.Left);
      if (auxiliaryBarSiblingToEditor) {
        this.workbenchGrid.moveView(this.auxiliaryBarPartView, preMoveAuxiliaryBarSize, this.editorPartView, Direction.Left);
      } else {
        this.workbenchGrid.moveViewTo(this.auxiliaryBarPartView, [2, 0]);
      }
    }
    if (focusedPart) {
      this.focusPart(focusedPart);
    }
    if (isPanelVertical) {
      this.workbenchGrid.moveView(this.panelPartView, preMovePanelWidth, this.editorPartView, panelPosition === Position.LEFT ? Direction.Left : Direction.Right);
      this.workbenchGrid.resizeView(this.panelPartView, {
        height: preMovePanelHeight,
        width: preMovePanelWidth
      });
    }
    if (this.isVisible(Parts.SIDEBAR_PART)) {
      this.workbenchGrid.resizeView(this.sideBarPartView, {
        height: this.workbenchGrid.getViewSize(this.sideBarPartView).height,
        width: preMoveSideBarSize
      });
    }
    if (this.isVisible(Parts.AUXILIARYBAR_PART)) {
      this.workbenchGrid.resizeView(this.auxiliaryBarPartView, {
        height: this.workbenchGrid.getViewSize(this.auxiliaryBarPartView).height,
        width: preMoveAuxiliaryBarSize
      });
    }
  }
  setPanelAlignment(alignment, skipLayout) {
    if (!isHorizontal(this.getPanelPosition())) {
      this.setPanelPosition(Position.BOTTOM);
    }
    if (alignment !== "center" && this.isPanelMaximized()) {
      this.toggleMaximizedPanel();
    }
    this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_ALIGNMENT, alignment);
    this.adjustPartPositions(this.getSideBarPosition(), alignment, this.getPanelPosition());
    this._onDidChangePanelAlignment.fire(alignment);
  }
  setPanelHidden(hidden, skipLayout) {
    if (!this.workbenchGrid) {
      return;
    }
    const wasHidden = !this.isVisible(Parts.PANEL_PART);
    this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_HIDDEN, hidden);
    const isPanelMaximized = this.isPanelMaximized();
    const panelOpensMaximized = this.panelOpensMaximized();
    if (hidden) {
      this.mainContainer.classList.add("nopanel" /* PANEL_HIDDEN */);
    } else {
      this.mainContainer.classList.remove("nopanel" /* PANEL_HIDDEN */);
    }
    let focusEditor = false;
    if (hidden && this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)) {
      this.paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Panel);
      focusEditor = isIOS ? false : true;
    } else if (!hidden && !this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)) {
      let panelToOpen = this.paneCompositeService.getLastActivePaneCompositeId(ViewContainerLocation.Panel);
      if (!panelToOpen || !this.hasViews(panelToOpen)) {
        panelToOpen = this.viewDescriptorService.getViewContainersByLocation(ViewContainerLocation.Panel).find((viewContainer) => this.hasViews(viewContainer.id))?.id;
      }
      if (panelToOpen) {
        const focus = !skipLayout;
        const panel = this.paneCompositeService.openPaneComposite(panelToOpen, ViewContainerLocation.Panel, focus);
        if (!panel) {
          this.paneCompositeService.openPaneComposite(this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.Panel)?.id, ViewContainerLocation.Panel, focus);
        }
      }
    }
    if (hidden && isPanelMaximized) {
      this.toggleMaximizedPanel();
    }
    if (wasHidden === hidden) {
      return;
    }
    this.workbenchGrid.setViewVisible(this.panelPartView, !hidden);
    if (!hidden) {
      if (!skipLayout && isPanelMaximized !== panelOpensMaximized) {
        this.toggleMaximizedPanel();
      }
    } else {
      this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED, isPanelMaximized);
    }
    if (focusEditor) {
      this.editorGroupService.mainPart.activeGroup.focus();
    }
  }
  toggleMaximizedPanel() {
    const size2 = this.workbenchGrid.getViewSize(this.panelPartView);
    const panelPosition = this.getPanelPosition();
    const isMaximized = this.isPanelMaximized();
    if (!isMaximized) {
      if (this.isVisible(Parts.PANEL_PART)) {
        if (isHorizontal(panelPosition)) {
          this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT, size2.height);
        } else {
          this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH, size2.width);
        }
      }
      this.setEditorHidden(true);
    } else {
      this.setEditorHidden(false);
      this.workbenchGrid.resizeView(this.panelPartView, {
        width: isHorizontal(panelPosition) ? size2.width : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH),
        height: isHorizontal(panelPosition) ? this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT) : size2.height
      });
    }
    this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED, !isMaximized);
  }
  panelOpensMaximized() {
    if (this.getPanelAlignment() !== "center" && isHorizontal(this.getPanelPosition())) {
      return false;
    }
    const panelOpensMaximized = panelOpensMaximizedFromString(this.configurationService.getValue("workbench.panel.opensMaximized" /* PANEL_OPENS_MAXIMIZED */));
    const panelLastIsMaximized = this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED);
    return panelOpensMaximized === PanelOpensMaximizedOptions.ALWAYS || panelOpensMaximized === PanelOpensMaximizedOptions.REMEMBER_LAST && panelLastIsMaximized;
  }
  setAuxiliaryBarHidden(hidden, skipLayout) {
    this.stateModel.setRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN, hidden);
    if (hidden) {
      this.mainContainer.classList.add("noauxiliarybar" /* AUXILIARYBAR_HIDDEN */);
    } else {
      this.mainContainer.classList.remove("noauxiliarybar" /* AUXILIARYBAR_HIDDEN */);
    }
    if (hidden && this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)) {
      this.paneCompositeService.hideActivePaneComposite(ViewContainerLocation.AuxiliaryBar);
      this.focusPanelOrEditor();
    } else if (!hidden && !this.paneCompositeService.getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)) {
      let viewletToOpen = this.paneCompositeService.getLastActivePaneCompositeId(ViewContainerLocation.AuxiliaryBar);
      if (!viewletToOpen || !this.hasViews(viewletToOpen)) {
        viewletToOpen = this.viewDescriptorService.getViewContainersByLocation(ViewContainerLocation.AuxiliaryBar).find((viewContainer) => this.hasViews(viewContainer.id))?.id;
      }
      if (viewletToOpen) {
        const focus = !skipLayout;
        const viewlet = this.paneCompositeService.openPaneComposite(viewletToOpen, ViewContainerLocation.AuxiliaryBar, focus);
        if (!viewlet) {
          this.paneCompositeService.openPaneComposite(this.viewDescriptorService.getDefaultViewContainer(ViewContainerLocation.AuxiliaryBar)?.id, ViewContainerLocation.AuxiliaryBar, focus);
        }
      }
    }
    this.workbenchGrid.setViewVisible(this.auxiliaryBarPartView, !hidden);
  }
  setPartHidden(hidden, part, targetWindow = mainWindow) {
    switch (part) {
      case Parts.ACTIVITYBAR_PART:
        return this.setActivityBarHidden(hidden);
      case Parts.SIDEBAR_PART:
        return this.setSideBarHidden(hidden);
      case Parts.EDITOR_PART:
        return this.setEditorHidden(hidden);
      case Parts.BANNER_PART:
        return this.setBannerHidden(hidden);
      case Parts.AUXILIARYBAR_PART:
        return this.setAuxiliaryBarHidden(hidden);
      case Parts.PANEL_PART:
        return this.setPanelHidden(hidden);
    }
  }
  hasMainWindowBorder() {
    return this.state.runtime.mainWindowBorder;
  }
  getMainWindowBorderRadius() {
    return this.state.runtime.mainWindowBorder && isMacintosh ? "10px" : void 0;
  }
  isPanelMaximized() {
    return (this.getPanelAlignment() === "center" || !isHorizontal(this.getPanelPosition())) && !this.isVisible(Parts.EDITOR_PART, mainWindow);
  }
  getSideBarPosition() {
    return this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON);
  }
  getPanelAlignment() {
    return this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_ALIGNMENT);
  }
  updateMenubarVisibility(skipLayout) {
    const shouldShowTitleBar = shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled);
    if (!skipLayout && this.workbenchGrid && shouldShowTitleBar !== this.isVisible(Parts.TITLEBAR_PART, mainWindow)) {
      this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowTitleBar);
    }
  }
  updateCustomTitleBarVisibility() {
    const shouldShowTitleBar = shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled);
    const titlebarVisible = this.isVisible(Parts.TITLEBAR_PART);
    if (shouldShowTitleBar !== titlebarVisible) {
      this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowTitleBar);
    }
  }
  toggleMenuBar() {
    let currentVisibilityValue = getMenuBarVisibility(this.configurationService);
    if (typeof currentVisibilityValue !== "string") {
      currentVisibilityValue = "classic";
    }
    let newVisibilityValue;
    if (currentVisibilityValue === "visible" || currentVisibilityValue === "classic") {
      newVisibilityValue = hasNativeTitlebar(this.configurationService) ? "toggle" : "compact";
    } else {
      newVisibilityValue = "classic";
    }
    this.configurationService.updateValue("window.menuBarVisibility", newVisibilityValue);
  }
  getPanelPosition() {
    return this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_POSITION);
  }
  setPanelPosition(position2) {
    if (!this.isVisible(Parts.PANEL_PART)) {
      this.setPanelHidden(false);
    }
    const panelPart = this.getPart(Parts.PANEL_PART);
    const oldPositionValue = positionToString(this.getPanelPosition());
    const newPositionValue = positionToString(position2);
    const panelContainer = assertIsDefined(panelPart.getContainer());
    panelContainer.classList.remove(oldPositionValue);
    panelContainer.classList.add(newPositionValue);
    panelPart.updateStyles();
    const size2 = this.workbenchGrid.getViewSize(this.panelPartView);
    const sideBarSize = this.workbenchGrid.getViewSize(this.sideBarPartView);
    const auxiliaryBarSize = this.workbenchGrid.getViewSize(this.auxiliaryBarPartView);
    let editorHidden = !this.isVisible(Parts.EDITOR_PART, mainWindow);
    if (newPositionValue !== oldPositionValue && !editorHidden) {
      if (isHorizontal(position2)) {
        this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH, size2.width);
      } else if (isHorizontal(positionFromString(oldPositionValue))) {
        this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT, size2.height);
      }
    }
    if (isHorizontal(position2) && this.getPanelAlignment() !== "center" && editorHidden) {
      this.toggleMaximizedPanel();
      editorHidden = false;
    }
    this.stateModel.setRuntimeValue(LayoutStateKeys.PANEL_POSITION, position2);
    const sideBarVisible = this.isVisible(Parts.SIDEBAR_PART);
    const auxiliaryBarVisible = this.isVisible(Parts.AUXILIARYBAR_PART);
    const hadFocus = this.hasFocus(Parts.PANEL_PART);
    if (position2 === Position.BOTTOM) {
      this.workbenchGrid.moveView(this.panelPartView, editorHidden ? size2.height : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT), this.editorPartView, Direction.Down);
    } else if (position2 === Position.TOP) {
      this.workbenchGrid.moveView(this.panelPartView, editorHidden ? size2.height : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_HEIGHT), this.editorPartView, Direction.Up);
    } else if (position2 === Position.RIGHT) {
      this.workbenchGrid.moveView(this.panelPartView, editorHidden ? size2.width : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH), this.editorPartView, Direction.Right);
    } else {
      this.workbenchGrid.moveView(this.panelPartView, editorHidden ? size2.width : this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_LAST_NON_MAXIMIZED_WIDTH), this.editorPartView, Direction.Left);
    }
    if (hadFocus) {
      this.focusPart(Parts.PANEL_PART);
    }
    this.workbenchGrid.resizeView(this.sideBarPartView, sideBarSize);
    if (!sideBarVisible) {
      this.setSideBarHidden(true);
    }
    this.workbenchGrid.resizeView(this.auxiliaryBarPartView, auxiliaryBarSize);
    if (!auxiliaryBarVisible) {
      this.setAuxiliaryBarHidden(true);
    }
    if (isHorizontal(position2)) {
      this.adjustPartPositions(this.getSideBarPosition(), this.getPanelAlignment(), position2);
    }
    this._onDidChangePanelPosition.fire(newPositionValue);
  }
  isWindowMaximized(targetWindow) {
    return this.state.runtime.maximized.has(getWindowId(targetWindow));
  }
  updateWindowMaximizedState(targetWindow, maximized) {
    this.mainContainer.classList.toggle("maximized" /* MAXIMIZED */, maximized);
    const targetWindowId = getWindowId(targetWindow);
    if (maximized === this.state.runtime.maximized.has(targetWindowId)) {
      return;
    }
    if (maximized) {
      this.state.runtime.maximized.add(targetWindowId);
    } else {
      this.state.runtime.maximized.delete(targetWindowId);
    }
    this.updateWindowsBorder();
    this._onDidChangeWindowMaximized.fire({ windowId: targetWindowId, maximized });
  }
  getVisibleNeighborPart(part, direction) {
    if (!this.workbenchGrid) {
      return void 0;
    }
    if (!this.isVisible(part, mainWindow)) {
      return void 0;
    }
    const neighborViews = this.workbenchGrid.getNeighborViews(this.getPart(part), direction, false);
    if (!neighborViews) {
      return void 0;
    }
    for (const neighborView of neighborViews) {
      const neighborPart = [Parts.ACTIVITYBAR_PART, Parts.EDITOR_PART, Parts.PANEL_PART, Parts.AUXILIARYBAR_PART, Parts.SIDEBAR_PART, Parts.STATUSBAR_PART, Parts.TITLEBAR_PART].find((partId) => this.getPart(partId) === neighborView && this.isVisible(partId, mainWindow));
      if (neighborPart !== void 0) {
        return neighborPart;
      }
    }
    return void 0;
  }
  onDidChangeWCO() {
    const bannerFirst = this.workbenchGrid.getNeighborViews(this.titleBarPartView, Direction.Up, false).length > 0;
    const shouldBannerBeFirst = this.shouldShowBannerFirst();
    if (bannerFirst !== shouldBannerBeFirst) {
      this.workbenchGrid.moveView(this.bannerPartView, Sizing.Distribute, this.titleBarPartView, shouldBannerBeFirst ? Direction.Up : Direction.Down);
    }
    this.workbenchGrid.setViewVisible(this.titleBarPartView, shouldShowCustomTitleBar(this.configurationService, mainWindow, this.state.runtime.menuBar.toggled));
  }
  arrangeEditorNodes(nodes, availableHeight, availableWidth) {
    if (!nodes.sideBar && !nodes.auxiliaryBar) {
      nodes.editor.size = availableHeight;
      return nodes.editor;
    }
    const result = [nodes.editor];
    nodes.editor.size = availableWidth;
    if (nodes.sideBar) {
      if (this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON) === Position.LEFT) {
        result.splice(0, 0, nodes.sideBar);
      } else {
        result.push(nodes.sideBar);
      }
      nodes.editor.size -= this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN) ? 0 : nodes.sideBar.size;
    }
    if (nodes.auxiliaryBar) {
      if (this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON) === Position.RIGHT) {
        result.splice(0, 0, nodes.auxiliaryBar);
      } else {
        result.push(nodes.auxiliaryBar);
      }
      nodes.editor.size -= this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN) ? 0 : nodes.auxiliaryBar.size;
    }
    return {
      type: "branch",
      data: result,
      size: availableHeight
    };
  }
  arrangeMiddleSectionNodes(nodes, availableWidth, availableHeight) {
    const activityBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN) ? 0 : nodes.activityBar.size;
    const sideBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN) ? 0 : nodes.sideBar.size;
    const auxiliaryBarSize = this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN) ? 0 : nodes.auxiliaryBar.size;
    const panelSize = this.stateModel.getInitializationValue(LayoutStateKeys.PANEL_SIZE) ? 0 : nodes.panel.size;
    const panelPostion = this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_POSITION);
    const sideBarPosition = this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON);
    const result = [];
    if (!isHorizontal(panelPostion)) {
      result.push(nodes.editor);
      nodes.editor.size = availableWidth - activityBarSize - sideBarSize - panelSize - auxiliaryBarSize;
      if (panelPostion === Position.RIGHT) {
        result.push(nodes.panel);
      } else {
        result.splice(0, 0, nodes.panel);
      }
      if (sideBarPosition === Position.LEFT) {
        result.push(nodes.auxiliaryBar);
        result.splice(0, 0, nodes.sideBar);
        result.splice(0, 0, nodes.activityBar);
      } else {
        result.splice(0, 0, nodes.auxiliaryBar);
        result.push(nodes.sideBar);
        result.push(nodes.activityBar);
      }
    } else {
      const panelAlignment = this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_ALIGNMENT);
      const sideBarNextToEditor = !(panelAlignment === "center" || sideBarPosition === Position.LEFT && panelAlignment === "right" || sideBarPosition === Position.RIGHT && panelAlignment === "left");
      const auxiliaryBarNextToEditor = !(panelAlignment === "center" || sideBarPosition === Position.RIGHT && panelAlignment === "right" || sideBarPosition === Position.LEFT && panelAlignment === "left");
      const editorSectionWidth = availableWidth - activityBarSize - (sideBarNextToEditor ? 0 : sideBarSize) - (auxiliaryBarNextToEditor ? 0 : auxiliaryBarSize);
      const editorNodes = this.arrangeEditorNodes({
        editor: nodes.editor,
        sideBar: sideBarNextToEditor ? nodes.sideBar : void 0,
        auxiliaryBar: auxiliaryBarNextToEditor ? nodes.auxiliaryBar : void 0
      }, availableHeight - panelSize, editorSectionWidth);
      result.push({
        type: "branch",
        data: panelPostion === Position.BOTTOM ? [editorNodes, nodes.panel] : [nodes.panel, editorNodes],
        size: editorSectionWidth
      });
      if (!sideBarNextToEditor) {
        if (sideBarPosition === Position.LEFT) {
          result.splice(0, 0, nodes.sideBar);
        } else {
          result.push(nodes.sideBar);
        }
      }
      if (!auxiliaryBarNextToEditor) {
        if (sideBarPosition === Position.RIGHT) {
          result.splice(0, 0, nodes.auxiliaryBar);
        } else {
          result.push(nodes.auxiliaryBar);
        }
      }
      if (sideBarPosition === Position.LEFT) {
        result.splice(0, 0, nodes.activityBar);
      } else {
        result.push(nodes.activityBar);
      }
    }
    return result;
  }
  createGridDescriptor() {
    const { width, height } = this._mainContainerDimension;
    const sideBarSize = this.stateModel.getInitializationValue(LayoutStateKeys.SIDEBAR_SIZE);
    const auxiliaryBarPartSize = this.stateModel.getInitializationValue(LayoutStateKeys.AUXILIARYBAR_SIZE);
    const panelSize = this.stateModel.getInitializationValue(LayoutStateKeys.PANEL_SIZE);
    const titleBarHeight = this.titleBarPartView.minimumHeight;
    const bannerHeight = this.bannerPartView.minimumHeight;
    const statusBarHeight = this.statusBarPartView.minimumHeight;
    const activityBarWidth = this.activityBarPartView.minimumWidth;
    const middleSectionHeight = height - titleBarHeight - statusBarHeight;
    const titleAndBanner = [
      {
        type: "leaf",
        data: { type: Parts.TITLEBAR_PART },
        size: titleBarHeight,
        visible: this.isVisible(Parts.TITLEBAR_PART, mainWindow)
      },
      {
        type: "leaf",
        data: { type: Parts.BANNER_PART },
        size: bannerHeight,
        visible: false
      }
    ];
    const activityBarNode = {
      type: "leaf",
      data: { type: Parts.ACTIVITYBAR_PART },
      size: activityBarWidth,
      visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN)
    };
    const sideBarNode = {
      type: "leaf",
      data: { type: Parts.SIDEBAR_PART },
      size: sideBarSize,
      visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN)
    };
    const auxiliaryBarNode = {
      type: "leaf",
      data: { type: Parts.AUXILIARYBAR_PART },
      size: auxiliaryBarPartSize,
      visible: this.isVisible(Parts.AUXILIARYBAR_PART)
    };
    const editorNode = {
      type: "leaf",
      data: { type: Parts.EDITOR_PART },
      size: 0,
      // Update based on sibling sizes
      visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.EDITOR_HIDDEN)
    };
    const panelNode = {
      type: "leaf",
      data: { type: Parts.PANEL_PART },
      size: panelSize,
      visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN)
    };
    const middleSection = this.arrangeMiddleSectionNodes({
      activityBar: activityBarNode,
      auxiliaryBar: auxiliaryBarNode,
      editor: editorNode,
      panel: panelNode,
      sideBar: sideBarNode
    }, width, middleSectionHeight);
    const result = {
      root: {
        type: "branch",
        size: width,
        data: [
          ...this.shouldShowBannerFirst() ? titleAndBanner.reverse() : titleAndBanner,
          {
            type: "branch",
            data: middleSection,
            size: middleSectionHeight
          },
          {
            type: "leaf",
            data: { type: Parts.STATUSBAR_PART },
            size: statusBarHeight,
            visible: !this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN)
          }
        ]
      },
      orientation: Orientation.VERTICAL,
      width,
      height
    };
    const layoutDescriptor = {
      activityBarVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.ACTIVITYBAR_HIDDEN),
      sideBarVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN),
      auxiliaryBarVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.AUXILIARYBAR_HIDDEN),
      panelVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN),
      statusbarVisible: !this.stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN),
      sideBarPosition: positionToString(this.stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_POSITON)),
      panelPosition: positionToString(this.stateModel.getRuntimeValue(LayoutStateKeys.PANEL_POSITION))
    };
    this.telemetryService.publicLog2("startupLayout", layoutDescriptor);
    return result;
  }
  dispose() {
    super.dispose();
    this.disposed = true;
  }
}
function getZenModeConfiguration(configurationService) {
  return configurationService.getValue("zenMode" /* ZEN_MODE_CONFIG */);
}
class WorkbenchLayoutStateKey {
  constructor(name, scope, target, defaultValue) {
    this.name = name;
    this.scope = scope;
    this.target = target;
    this.defaultValue = defaultValue;
  }
}
class RuntimeStateKey extends WorkbenchLayoutStateKey {
  constructor(name, scope, target, defaultValue, zenModeIgnore) {
    super(name, scope, target, defaultValue);
    this.zenModeIgnore = zenModeIgnore;
    this.runtime = true;
  }
}
class InitializationStateKey extends WorkbenchLayoutStateKey {
  constructor() {
    super(...arguments);
    this.runtime = false;
  }
}
const LayoutStateKeys = {
  // Editor
  MAIN_EDITOR_CENTERED: new RuntimeStateKey("editor.centered", StorageScope.WORKSPACE, StorageTarget.MACHINE, false),
  // Zen Mode
  ZEN_MODE_ACTIVE: new RuntimeStateKey("zenMode.active", StorageScope.WORKSPACE, StorageTarget.MACHINE, false),
  ZEN_MODE_EXIT_INFO: new RuntimeStateKey("zenMode.exitInfo", StorageScope.WORKSPACE, StorageTarget.MACHINE, {
    transitionedToCenteredEditorLayout: false,
    transitionedToFullScreen: false,
    handleNotificationsDoNotDisturbMode: false,
    wasVisible: {
      auxiliaryBar: false,
      panel: false,
      sideBar: false
    }
  }),
  // Part Sizing
  SIDEBAR_SIZE: new InitializationStateKey("sideBar.size", StorageScope.PROFILE, StorageTarget.MACHINE, 200),
  AUXILIARYBAR_SIZE: new InitializationStateKey("auxiliaryBar.size", StorageScope.PROFILE, StorageTarget.MACHINE, 800),
  // Void changed this from 200 to 800
  PANEL_SIZE: new InitializationStateKey("panel.size", StorageScope.PROFILE, StorageTarget.MACHINE, 300),
  PANEL_LAST_NON_MAXIMIZED_HEIGHT: new RuntimeStateKey("panel.lastNonMaximizedHeight", StorageScope.PROFILE, StorageTarget.MACHINE, 300),
  PANEL_LAST_NON_MAXIMIZED_WIDTH: new RuntimeStateKey("panel.lastNonMaximizedWidth", StorageScope.PROFILE, StorageTarget.MACHINE, 300),
  PANEL_WAS_LAST_MAXIMIZED: new RuntimeStateKey("panel.wasLastMaximized", StorageScope.WORKSPACE, StorageTarget.MACHINE, false),
  // Part Positions
  SIDEBAR_POSITON: new RuntimeStateKey("sideBar.position", StorageScope.WORKSPACE, StorageTarget.MACHINE, Position.LEFT),
  PANEL_POSITION: new RuntimeStateKey("panel.position", StorageScope.WORKSPACE, StorageTarget.MACHINE, Position.BOTTOM),
  PANEL_ALIGNMENT: new RuntimeStateKey("panel.alignment", StorageScope.PROFILE, StorageTarget.USER, "center"),
  // Part Visibility
  ACTIVITYBAR_HIDDEN: new RuntimeStateKey("activityBar.hidden", StorageScope.WORKSPACE, StorageTarget.MACHINE, false, true),
  SIDEBAR_HIDDEN: new RuntimeStateKey("sideBar.hidden", StorageScope.WORKSPACE, StorageTarget.MACHINE, false),
  EDITOR_HIDDEN: new RuntimeStateKey("editor.hidden", StorageScope.WORKSPACE, StorageTarget.MACHINE, false),
  PANEL_HIDDEN: new RuntimeStateKey("panel.hidden", StorageScope.WORKSPACE, StorageTarget.MACHINE, true),
  AUXILIARYBAR_HIDDEN: new RuntimeStateKey("auxiliaryBar.hidden", StorageScope.WORKSPACE, StorageTarget.MACHINE, true),
  STATUSBAR_HIDDEN: new RuntimeStateKey("statusBar.hidden", StorageScope.WORKSPACE, StorageTarget.MACHINE, false, true)
};
var WorkbenchLayoutSettings = /* @__PURE__ */ ((WorkbenchLayoutSettings2) => {
  WorkbenchLayoutSettings2["PANEL_POSITION"] = "workbench.panel.defaultLocation";
  WorkbenchLayoutSettings2["PANEL_OPENS_MAXIMIZED"] = "workbench.panel.opensMaximized";
  WorkbenchLayoutSettings2["ZEN_MODE_CONFIG"] = "zenMode";
  WorkbenchLayoutSettings2["EDITOR_CENTERED_LAYOUT_AUTO_RESIZE"] = "workbench.editor.centeredLayoutAutoResize";
  return WorkbenchLayoutSettings2;
})(WorkbenchLayoutSettings || {});
var LegacyWorkbenchLayoutSettings = /* @__PURE__ */ ((LegacyWorkbenchLayoutSettings2) => {
  LegacyWorkbenchLayoutSettings2["STATUSBAR_VISIBLE"] = "workbench.statusBar.visible";
  LegacyWorkbenchLayoutSettings2["SIDEBAR_POSITION"] = "workbench.sideBar.location";
  return LegacyWorkbenchLayoutSettings2;
})(LegacyWorkbenchLayoutSettings || {});
const _LayoutStateModel = class _LayoutStateModel extends Disposable {
  constructor(storageService, configurationService, contextService) {
    super();
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.contextService = contextService;
    this._onDidChangeState = this._register(new Emitter());
    this.onDidChangeState = this._onDidChangeState.event;
    this.stateCache = /* @__PURE__ */ new Map();
    this._register(this.configurationService.onDidChangeConfiguration((configurationChange) => this.updateStateFromLegacySettings(configurationChange)));
  }
  updateStateFromLegacySettings(configurationChangeEvent) {
    if (configurationChangeEvent.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION)) {
      this.setRuntimeValueAndFire(LayoutStateKeys.ACTIVITYBAR_HIDDEN, this.isActivityBarHidden());
    }
    if (configurationChangeEvent.affectsConfiguration("workbench.statusBar.visible" /* STATUSBAR_VISIBLE */)) {
      this.setRuntimeValueAndFire(LayoutStateKeys.STATUSBAR_HIDDEN, !this.configurationService.getValue("workbench.statusBar.visible" /* STATUSBAR_VISIBLE */));
    }
    if (configurationChangeEvent.affectsConfiguration("workbench.sideBar.location" /* SIDEBAR_POSITION */)) {
      this.setRuntimeValueAndFire(LayoutStateKeys.SIDEBAR_POSITON, positionFromString(this.configurationService.getValue("workbench.sideBar.location" /* SIDEBAR_POSITION */) ?? "left"));
    }
  }
  updateLegacySettingsFromState(key, value) {
    const isZenMode = this.getRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE);
    if (key.zenModeIgnore && isZenMode) {
      return;
    }
    if (key === LayoutStateKeys.ACTIVITYBAR_HIDDEN) {
      // Plaxio: activity bar column is always hidden; location stays "top"
    } else if (key === LayoutStateKeys.STATUSBAR_HIDDEN) {
      this.configurationService.updateValue("workbench.statusBar.visible" /* STATUSBAR_VISIBLE */, !value);
    } else if (key === LayoutStateKeys.SIDEBAR_POSITON) {
      this.configurationService.updateValue("workbench.sideBar.location" /* SIDEBAR_POSITION */, positionToString(value));
    }
  }
  load(mainContainerDimension) {
    let key;
    for (key in LayoutStateKeys) {
      const stateKey = LayoutStateKeys[key];
      const value = this.loadKeyFromStorage(stateKey);
      if (value !== void 0) {
        this.stateCache.set(stateKey.name, value);
      }
    }
    this.stateCache.set(LayoutStateKeys.ACTIVITYBAR_HIDDEN.name, this.isActivityBarHidden());
    this.stateCache.set(LayoutStateKeys.STATUSBAR_HIDDEN.name, !this.configurationService.getValue("workbench.statusBar.visible" /* STATUSBAR_VISIBLE */));
    this.stateCache.set(LayoutStateKeys.SIDEBAR_POSITON.name, positionFromString(this.configurationService.getValue("workbench.sideBar.location" /* SIDEBAR_POSITION */) ?? "left"));
    LayoutStateKeys.PANEL_POSITION.defaultValue = positionFromString(this.configurationService.getValue("workbench.panel.defaultLocation" /* PANEL_POSITION */) ?? "bottom");
    LayoutStateKeys.SIDEBAR_SIZE.defaultValue = Math.min(300, mainContainerDimension.width / 4);
    LayoutStateKeys.AUXILIARYBAR_SIZE.defaultValue = Math.min(300, mainContainerDimension.width / 4);
    LayoutStateKeys.PANEL_SIZE.defaultValue = this.stateCache.get(LayoutStateKeys.PANEL_POSITION.name) ?? isHorizontal(LayoutStateKeys.PANEL_POSITION.defaultValue) ? mainContainerDimension.height / 3 : mainContainerDimension.width / 4;
    LayoutStateKeys.SIDEBAR_HIDDEN.defaultValue = this.contextService.getWorkbenchState() === WorkbenchState.EMPTY;
    for (key in LayoutStateKeys) {
      const stateKey = LayoutStateKeys[key];
      if (this.stateCache.get(stateKey.name) === void 0) {
        this.stateCache.set(stateKey.name, stateKey.defaultValue);
      }
    }
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, void 0, this._store)((storageChangeEvent) => {
      let key2;
      for (key2 in LayoutStateKeys) {
        const stateKey = LayoutStateKeys[key2];
        if (stateKey instanceof RuntimeStateKey && stateKey.scope === StorageScope.PROFILE && stateKey.target === StorageTarget.USER) {
          if (`${_LayoutStateModel.STORAGE_PREFIX}${stateKey.name}` === storageChangeEvent.key) {
            const value = this.loadKeyFromStorage(stateKey) ?? stateKey.defaultValue;
            if (this.stateCache.get(stateKey.name) !== value) {
              this.stateCache.set(stateKey.name, value);
              this._onDidChangeState.fire({ key: stateKey, value });
            }
          }
        }
      }
    }));
  }
  save(workspace, global) {
    let key;
    const isZenMode = this.getRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE);
    for (key in LayoutStateKeys) {
      const stateKey = LayoutStateKeys[key];
      if (workspace && stateKey.scope === StorageScope.WORKSPACE || global && stateKey.scope === StorageScope.PROFILE) {
        if (isZenMode && stateKey instanceof RuntimeStateKey && stateKey.zenModeIgnore) {
          continue;
        }
        this.saveKeyToStorage(stateKey);
      }
    }
  }
  getInitializationValue(key) {
    return this.stateCache.get(key.name);
  }
  setInitializationValue(key, value) {
    this.stateCache.set(key.name, value);
  }
  getRuntimeValue(key, fallbackToSetting) {
    if (fallbackToSetting) {
      switch (key) {
        case LayoutStateKeys.ACTIVITYBAR_HIDDEN:
          this.stateCache.set(key.name, this.isActivityBarHidden());
          break;
        case LayoutStateKeys.STATUSBAR_HIDDEN:
          this.stateCache.set(key.name, !this.configurationService.getValue("workbench.statusBar.visible" /* STATUSBAR_VISIBLE */));
          break;
        case LayoutStateKeys.SIDEBAR_POSITON:
          this.stateCache.set(key.name, this.configurationService.getValue("workbench.sideBar.location" /* SIDEBAR_POSITION */) ?? "left");
          break;
      }
    }
    return this.stateCache.get(key.name);
  }
  setRuntimeValue(key, value) {
    this.stateCache.set(key.name, value);
    const isZenMode = this.getRuntimeValue(LayoutStateKeys.ZEN_MODE_ACTIVE);
    if (key.scope === StorageScope.PROFILE) {
      if (!isZenMode || !key.zenModeIgnore) {
        this.saveKeyToStorage(key);
        this.updateLegacySettingsFromState(key, value);
      }
    }
  }
  isActivityBarHidden() {
    return true;
  }
  setRuntimeValueAndFire(key, value) {
    const previousValue = this.stateCache.get(key.name);
    if (previousValue === value) {
      return;
    }
    this.setRuntimeValue(key, value);
    this._onDidChangeState.fire({ key, value });
  }
  saveKeyToStorage(key) {
    const value = this.stateCache.get(key.name);
    this.storageService.store(`${_LayoutStateModel.STORAGE_PREFIX}${key.name}`, typeof value === "object" ? JSON.stringify(value) : value, key.scope, key.target);
  }
  loadKeyFromStorage(key) {
    let value = this.storageService.get(`${_LayoutStateModel.STORAGE_PREFIX}${key.name}`, key.scope);
    if (value !== void 0) {
      switch (typeof key.defaultValue) {
        case "boolean":
          value = value === "true";
          break;
        case "number":
          value = parseInt(value);
          break;
        case "object":
          value = JSON.parse(value);
          break;
      }
    }
    return value;
  }
};
_LayoutStateModel.STORAGE_PREFIX = "workbench.";
let LayoutStateModel = _LayoutStateModel;
export {
  Layout,
  TITLE_BAR_SETTINGS
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9sYXlvdXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBFdmVudFR5cGUsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgZ2V0Q2xpZW50QXJlYSwgcG9zaXRpb24sIHNpemUsIElEaW1lbnNpb24sIGlzQW5jZXN0b3JVc2luZ0Zsb3dUbywgY29tcHV0ZVNjcmVlbkF3YXJlU2l6ZSwgZ2V0QWN0aXZlRG9jdW1lbnQsIGdldFdpbmRvd3MsIGdldEFjdGl2ZVdpbmRvdywgaXNBY3RpdmVEb2N1bWVudCwgZ2V0V2luZG93LCBnZXRXaW5kb3dJZCwgZ2V0QWN0aXZlRWxlbWVudCwgRGltZW5zaW9uIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBvbkRpZENoYW5nZUZ1bGxzY3JlZW4sIGlzRnVsbHNjcmVlbiwgaXNXQ09FbmFibGVkIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL2Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi93b3JraW5nQ29weUJhY2t1cC5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MsIGlzTGludXgsIGlzTWFjaW50b3NoLCBpc1dlYiwgaXNJT1MgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgR3JvdXBJZGVudGlmaWVyLCBpc1Jlc291cmNlRWRpdG9ySW5wdXQsIElVbnR5cGVkRWRpdG9ySW5wdXQsIHBhdGhzVG9FZGl0b3JzIH0gZnJvbSAnLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBTaWRlYmFyUGFydCB9IGZyb20gJy4vcGFydHMvc2lkZWJhci9zaWRlYmFyUGFydC5qcyc7XG5pbXBvcnQgeyBQYW5lbFBhcnQgfSBmcm9tICcuL3BhcnRzL3BhbmVsL3BhbmVsUGFydC5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiwgUGFydHMsIFBhbmVsT3BlbnNNYXhpbWl6ZWRPcHRpb25zLCBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgcG9zaXRpb25Gcm9tU3RyaW5nLCBwb3NpdGlvblRvU3RyaW5nLCBwYW5lbE9wZW5zTWF4aW1pemVkRnJvbVN0cmluZywgUGFuZWxBbGlnbm1lbnQsIEFjdGl2aXR5QmFyUG9zaXRpb24sIExheW91dFNldHRpbmdzLCBNVUxUSV9XSU5ET1dfUEFSVFMsIFNJTkdMRV9XSU5ET1dfUEFSVFMsIFplbk1vZGVTZXR0aW5ncywgRWRpdG9yVGFic01vZGUsIEVkaXRvckFjdGlvbnNMb2NhdGlvbiwgc2hvdWxkU2hvd0N1c3RvbVRpdGxlQmFyLCBpc0hvcml6b250YWwsIGlzTXVsdGlXaW5kb3dQYXJ0IH0gZnJvbSAnLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc1RlbXBvcmFyeVdvcmtzcGFjZSwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElUaXRsZVNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy90aXRsZS9icm93c2VyL3RpdGxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTdGFydHVwS2luZCwgSUxpZmVjeWNsZVNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBnZXRNZW51QmFyVmlzaWJpbGl0eSwgSVBhdGgsIGhhc05hdGl2ZVRpdGxlYmFyLCBoYXNDdXN0b21UaXRsZWJhciwgVGl0bGVCYXJTZXR0aW5nLCBDdXN0b21UaXRsZUJhclZpc2liaWxpdHksIHVzZVdpbmRvd0NvbnRyb2xzT3ZlcmxheSwgREVGQVVMVF9XSU5ET1dfU0laRSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvZW52aXJvbm1lbnQvYnJvd3Nlci9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yR3JvdXBMYXlvdXQsIEdyb3VwT3JpZW50YXRpb24sIEdyb3Vwc09yZGVyLCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJpYWxpemFibGVHcmlkLCBJU2VyaWFsaXphYmxlVmlldywgSVNlcmlhbGl6ZWRHcmlkLCBPcmllbnRhdGlvbiwgSVNlcmlhbGl6ZWROb2RlLCBJU2VyaWFsaXplZExlYWZOb2RlLCBEaXJlY3Rpb24sIElWaWV3U2l6ZSwgU2l6aW5nIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL3VpL2dyaWQvZ3JpZC5qcyc7XG5pbXBvcnQgeyBQYXJ0IH0gZnJvbSAnLi9wYXJ0LmpzJztcbmltcG9ydCB7IElTdGF0dXNiYXJTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvc3RhdHVzYmFyL2Jyb3dzZXIvc3RhdHVzYmFyLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBpc0NvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGFzc2VydElzRGVmaW5lZCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBOb3RpZmljYXRpb25zRmlsdGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgV0lORE9XX0FDVElWRV9CT1JERVIsIFdJTkRPV19JTkFDVElWRV9CT1JERVIgfSBmcm9tICcuLi9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgTGluZU51bWJlcnNUeXBlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JJbnB1dCB9IGZyb20gJy4uL2NvbW1vbi9lZGl0b3IvZGlmZkVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IG1hcmsgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIFByb21pc2VzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSUJhbm5lclNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9iYW5uZXIvYnJvd3Nlci9iYW5uZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9wYW5lY29tcG9zaXRlL2Jyb3dzZXIvcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBBdXhpbGlhcnlCYXJQYXJ0IH0gZnJvbSAnLi9wYXJ0cy9hdXhpbGlhcnliYXIvYXV4aWxpYXJ5QmFyUGFydC5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElBdXhpbGlhcnlXaW5kb3dTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvYXV4aWxpYXJ5V2luZG93L2Jyb3dzZXIvYXV4aWxpYXJ5V2luZG93U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb2RlV2luZG93LCBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5cbi8vI3JlZ2lvbiBMYXlvdXQgSW1wbGVtZW50YXRpb25cblxuaW50ZXJmYWNlIElMYXlvdXRSdW50aW1lU3RhdGUge1xuXHRhY3RpdmVDb250YWluZXJJZDogbnVtYmVyO1xuXHRtYWluV2luZG93RnVsbHNjcmVlbjogYm9vbGVhbjtcblx0cmVhZG9ubHkgbWF4aW1pemVkOiBTZXQ8bnVtYmVyPjtcblx0aGFzRm9jdXM6IGJvb2xlYW47XG5cdG1haW5XaW5kb3dCb3JkZXI6IGJvb2xlYW47XG5cdHJlYWRvbmx5IG1lbnVCYXI6IHtcblx0XHR0b2dnbGVkOiBib29sZWFuO1xuXHR9O1xuXHRyZWFkb25seSB6ZW5Nb2RlOiB7XG5cdFx0cmVhZG9ubHkgdHJhbnNpdGlvbkRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlTWFwPHN0cmluZywgSURpc3Bvc2FibGU+O1xuXHR9O1xufVxuXG5pbnRlcmZhY2UgSUVkaXRvclRvT3BlbiB7XG5cdHJlYWRvbmx5IGVkaXRvcjogSVVudHlwZWRFZGl0b3JJbnB1dDtcblx0cmVhZG9ubHkgdmlld0NvbHVtbj86IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElMYXlvdXRJbml0aWFsaXphdGlvblN0YXRlIHtcblx0cmVhZG9ubHkgdmlld3M6IHtcblx0XHRyZWFkb25seSBkZWZhdWx0czogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG5cdFx0cmVhZG9ubHkgY29udGFpbmVyVG9SZXN0b3JlOiB7XG5cdFx0XHRzaWRlQmFyPzogc3RyaW5nO1xuXHRcdFx0cGFuZWw/OiBzdHJpbmc7XG5cdFx0XHRhdXhpbGlhcnlCYXI/OiBzdHJpbmc7XG5cdFx0fTtcblx0fTtcblx0cmVhZG9ubHkgZWRpdG9yOiB7XG5cdFx0cmVhZG9ubHkgcmVzdG9yZUVkaXRvcnM6IGJvb2xlYW47XG5cdFx0cmVhZG9ubHkgZWRpdG9yc1RvT3BlbjogUHJvbWlzZTxJRWRpdG9yVG9PcGVuW10+O1xuXHR9O1xuXHRyZWFkb25seSBsYXlvdXQ/OiB7XG5cdFx0cmVhZG9ubHkgZWRpdG9ycz86IEVkaXRvckdyb3VwTGF5b3V0O1xuXHR9O1xufVxuXG5pbnRlcmZhY2UgSUxheW91dFN0YXRlIHtcblx0cmVhZG9ubHkgcnVudGltZTogSUxheW91dFJ1bnRpbWVTdGF0ZTtcblx0cmVhZG9ubHkgaW5pdGlhbGl6YXRpb246IElMYXlvdXRJbml0aWFsaXphdGlvblN0YXRlO1xufVxuXG5lbnVtIExheW91dENsYXNzZXMge1xuXHRTSURFQkFSX0hJRERFTiA9ICdub3NpZGViYXInLFxuXHRNQUlOX0VESVRPUl9BUkVBX0hJRERFTiA9ICdub21haW5lZGl0b3JhcmVhJyxcblx0UEFORUxfSElEREVOID0gJ25vcGFuZWwnLFxuXHRBVVhJTElBUllCQVJfSElEREVOID0gJ25vYXV4aWxpYXJ5YmFyJyxcblx0U1RBVFVTQkFSX0hJRERFTiA9ICdub3N0YXR1c2JhcicsXG5cdEZVTExTQ1JFRU4gPSAnZnVsbHNjcmVlbicsXG5cdE1BWElNSVpFRCA9ICdtYXhpbWl6ZWQnLFxuXHRXSU5ET1dfQk9SREVSID0gJ2JvcmRlcidcbn1cblxuaW50ZXJmYWNlIElQYXRoVG9PcGVuIGV4dGVuZHMgSVBhdGgge1xuXHRyZWFkb25seSB2aWV3Q29sdW1uPzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSUluaXRpYWxFZGl0b3JzU3RhdGUge1xuXHRyZWFkb25seSBmaWxlc1RvT3Blbk9yQ3JlYXRlPzogSVBhdGhUb09wZW5bXTtcblx0cmVhZG9ubHkgZmlsZXNUb0RpZmY/OiBJUGF0aFRvT3BlbltdO1xuXHRyZWFkb25seSBmaWxlc1RvTWVyZ2U/OiBJUGF0aFRvT3BlbltdO1xuXG5cdHJlYWRvbmx5IGxheW91dD86IEVkaXRvckdyb3VwTGF5b3V0O1xufVxuXG5jb25zdCBDT01NQU5EX0NFTlRFUl9TRVRUSU5HUyA9IFtcblx0J2NoYXQuY29tbWFuZENlbnRlci5lbmFibGVkJyxcblx0J3dvcmtiZW5jaC5uYXZpZ2F0aW9uQ29udHJvbC5lbmFibGVkJyxcblx0J3dvcmtiZW5jaC5leHBlcmltZW50YWwuc2hhcmUuZW5hYmxlZCcsXG5dO1xuXG5leHBvcnQgY29uc3QgVElUTEVfQkFSX1NFVFRJTkdTID0gW1xuXHRMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04sXG5cdExheW91dFNldHRpbmdzLkNPTU1BTkRfQ0VOVEVSLFxuXHQuLi5DT01NQU5EX0NFTlRFUl9TRVRUSU5HUyxcblx0TGF5b3V0U2V0dGluZ3MuRURJVE9SX0FDVElPTlNfTE9DQVRJT04sXG5cdExheW91dFNldHRpbmdzLkxBWU9VVF9BQ1RJT05TLFxuXHQnd2luZG93Lm1lbnVCYXJWaXNpYmlsaXR5Jyxcblx0VGl0bGVCYXJTZXR0aW5nLlRJVExFX0JBUl9TVFlMRSxcblx0VGl0bGVCYXJTZXR0aW5nLkNVU1RPTV9USVRMRV9CQVJfVklTSUJJTElUWSxcbl07XG5cbmNvbnN0IERFRkFVTFRfV0lORE9XX0RJTUVOU0lPTlMgPSBuZXcgRGltZW5zaW9uKERFRkFVTFRfV0lORE9XX1NJWkUud2lkdGgsIERFRkFVTFRfV0lORE9XX1NJWkUuaGVpZ2h0KTtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIExheW91dCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Ly8jcmVnaW9uIEV2ZW50c1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlWmVuTW9kZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVplbk1vZGUgPSB0aGlzLl9vbkRpZENoYW5nZVplbk1vZGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VNYWluRWRpdG9yQ2VudGVyZWRMYXlvdXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VNYWluRWRpdG9yQ2VudGVyZWRMYXlvdXQgPSB0aGlzLl9vbkRpZENoYW5nZU1haW5FZGl0b3JDZW50ZXJlZExheW91dC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVBhbmVsQWxpZ25tZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8UGFuZWxBbGlnbm1lbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVBhbmVsQWxpZ25tZW50ID0gdGhpcy5fb25EaWRDaGFuZ2VQYW5lbEFsaWdubWVudC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVdpbmRvd01heGltaXplZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgd2luZG93SWQ6IG51bWJlcjsgbWF4aW1pemVkOiBib29sZWFuIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVdpbmRvd01heGltaXplZCA9IHRoaXMuX29uRGlkQ2hhbmdlV2luZG93TWF4aW1pemVkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUGFuZWxQb3NpdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUGFuZWxQb3NpdGlvbiA9IHRoaXMuX29uRGlkQ2hhbmdlUGFuZWxQb3NpdGlvbi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVBhcnRWaXNpYmlsaXR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUGFydFZpc2liaWxpdHkgPSB0aGlzLl9vbkRpZENoYW5nZVBhcnRWaXNpYmlsaXR5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTm90aWZpY2F0aW9uc1Zpc2liaWxpdHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VOb3RpZmljYXRpb25zVmlzaWJpbGl0eSA9IHRoaXMuX29uRGlkQ2hhbmdlTm90aWZpY2F0aW9uc1Zpc2liaWxpdHkuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRMYXlvdXRNYWluQ29udGFpbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SURpbWVuc2lvbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTGF5b3V0TWFpbkNvbnRhaW5lciA9IHRoaXMuX29uRGlkTGF5b3V0TWFpbkNvbnRhaW5lci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZExheW91dEFjdGl2ZUNvbnRhaW5lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElEaW1lbnNpb24+KCkpO1xuXHRyZWFkb25seSBvbkRpZExheW91dEFjdGl2ZUNvbnRhaW5lciA9IHRoaXMuX29uRGlkTGF5b3V0QWN0aXZlQ29udGFpbmVyLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkTGF5b3V0Q29udGFpbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBjb250YWluZXI6IEhUTUxFbGVtZW50OyBkaW1lbnNpb246IElEaW1lbnNpb24gfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTGF5b3V0Q29udGFpbmVyID0gdGhpcy5fb25EaWRMYXlvdXRDb250YWluZXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRBZGRDb250YWluZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQWRkQ29udGFpbmVyID0gdGhpcy5fb25EaWRBZGRDb250YWluZXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVDb250YWluZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVDb250YWluZXIgPSB0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZUNvbnRhaW5lci5ldmVudDtcblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gUHJvcGVydGllc1xuXG5cdHJlYWRvbmx5IG1haW5Db250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0Z2V0IGFjdGl2ZUNvbnRhaW5lcigpIHsgcmV0dXJuIHRoaXMuZ2V0Q29udGFpbmVyRnJvbURvY3VtZW50KGdldEFjdGl2ZURvY3VtZW50KCkpOyB9XG5cdGdldCBjb250YWluZXJzKCk6IEl0ZXJhYmxlPEhUTUxFbGVtZW50PiB7XG5cdFx0Y29uc3QgY29udGFpbmVyczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgeyB3aW5kb3cgfSBvZiBnZXRXaW5kb3dzKCkpIHtcblx0XHRcdGNvbnRhaW5lcnMucHVzaCh0aGlzLmdldENvbnRhaW5lckZyb21Eb2N1bWVudCh3aW5kb3cuZG9jdW1lbnQpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY29udGFpbmVycztcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29udGFpbmVyRnJvbURvY3VtZW50KHRhcmdldERvY3VtZW50OiBEb2N1bWVudCk6IEhUTUxFbGVtZW50IHtcblx0XHRpZiAodGFyZ2V0RG9jdW1lbnQgPT09IHRoaXMubWFpbkNvbnRhaW5lci5vd25lckRvY3VtZW50KSB7XG5cdFx0XHQvLyBtYWluIHdpbmRvd1xuXHRcdFx0cmV0dXJuIHRoaXMubWFpbkNvbnRhaW5lcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gYXV4aWxpYXJ5IHdpbmRvd1xuXHRcdFx0cmV0dXJuIHRhcmdldERvY3VtZW50LmJvZHkuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnbW9uYWNvLXdvcmtiZW5jaCcpWzBdIGFzIEhUTUxFbGVtZW50O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyU3R5bGVzTG9hZGVkID0gbmV3IE1hcDxudW1iZXIgLyogd2luZG93IElEICovLCBQcm9taXNlPHZvaWQ+PigpO1xuXHR3aGVuQ29udGFpbmVyU3R5bGVzTG9hZGVkKHdpbmRvdzogQ29kZVdpbmRvdyk6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNvbnRhaW5lclN0eWxlc0xvYWRlZC5nZXQod2luZG93LnZzY29kZVdpbmRvd0lkKTtcblx0fVxuXG5cdHByaXZhdGUgX21haW5Db250YWluZXJEaW1lbnNpb24hOiBJRGltZW5zaW9uO1xuXHRnZXQgbWFpbkNvbnRhaW5lckRpbWVuc2lvbigpOiBJRGltZW5zaW9uIHsgcmV0dXJuIHRoaXMuX21haW5Db250YWluZXJEaW1lbnNpb247IH1cblxuXHRnZXQgYWN0aXZlQ29udGFpbmVyRGltZW5zaW9uKCk6IElEaW1lbnNpb24ge1xuXHRcdHJldHVybiB0aGlzLmdldENvbnRhaW5lckRpbWVuc2lvbih0aGlzLmFjdGl2ZUNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIGdldENvbnRhaW5lckRpbWVuc2lvbihjb250YWluZXI6IEhUTUxFbGVtZW50KTogSURpbWVuc2lvbiB7XG5cdFx0aWYgKGNvbnRhaW5lciA9PT0gdGhpcy5tYWluQ29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tYWluQ29udGFpbmVyRGltZW5zaW9uOyAvLyBtYWluIHdpbmRvd1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZ2V0Q2xpZW50QXJlYShjb250YWluZXIpOyBcdC8vIGF1eGlsaWFyeSB3aW5kb3dcblx0XHR9XG5cdH1cblxuXHRnZXQgbWFpbkNvbnRhaW5lck9mZnNldCgpIHtcblx0XHRyZXR1cm4gdGhpcy5jb21wdXRlQ29udGFpbmVyT2Zmc2V0KG1haW5XaW5kb3cpO1xuXHR9XG5cblx0Z2V0IGFjdGl2ZUNvbnRhaW5lck9mZnNldCgpIHtcblx0XHRyZXR1cm4gdGhpcy5jb21wdXRlQ29udGFpbmVyT2Zmc2V0KGdldFdpbmRvdyh0aGlzLmFjdGl2ZUNvbnRhaW5lcikpO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wdXRlQ29udGFpbmVyT2Zmc2V0KHRhcmdldFdpbmRvdzogV2luZG93KSB7XG5cdFx0bGV0IHRvcCA9IDA7XG5cdFx0bGV0IHF1aWNrUGlja1RvcCA9IDA7XG5cblx0XHRpZiAodGhpcy5pc1Zpc2libGUoUGFydHMuQkFOTkVSX1BBUlQpKSB7XG5cdFx0XHR0b3AgPSB0aGlzLmdldFBhcnQoUGFydHMuQkFOTkVSX1BBUlQpLm1heGltdW1IZWlnaHQ7XG5cdFx0XHRxdWlja1BpY2tUb3AgPSB0b3A7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGl0bGViYXJWaXNpYmxlID0gdGhpcy5pc1Zpc2libGUoUGFydHMuVElUTEVCQVJfUEFSVCwgdGFyZ2V0V2luZG93KTtcblx0XHRpZiAodGl0bGViYXJWaXNpYmxlKSB7XG5cdFx0XHR0b3AgKz0gdGhpcy5nZXRQYXJ0KFBhcnRzLlRJVExFQkFSX1BBUlQpLm1heGltdW1IZWlnaHQ7XG5cdFx0XHRxdWlja1BpY2tUb3AgPSB0b3A7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNDb21tYW5kQ2VudGVyVmlzaWJsZSA9IHRpdGxlYmFyVmlzaWJsZSAmJiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KExheW91dFNldHRpbmdzLkNPTU1BTkRfQ0VOVEVSKSAhPT0gZmFsc2U7XG5cdFx0aWYgKGlzQ29tbWFuZENlbnRlclZpc2libGUpIHtcblx0XHRcdC8vIElmIHRoZSBjb21tYW5kIGNlbnRlciBpcyB2aXNpYmxlIHRoZW4gdGhlIHF1aWNraW5wdXRcblx0XHRcdC8vIHNob3VsZCBnbyBvdmVyIHRoZSB0aXRsZSBiYXIgYW5kIHRoZSBiYW5uZXJcblx0XHRcdHF1aWNrUGlja1RvcCA9IDY7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgdG9wLCBxdWlja1BpY2tUb3AgfTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgcmVhZG9ubHkgcGFydHMgPSBuZXcgTWFwPHN0cmluZywgUGFydD4oKTtcblxuXHRwcml2YXRlIGluaXRpYWxpemVkID0gZmFsc2U7XG5cdHByaXZhdGUgd29ya2JlbmNoR3JpZCE6IFNlcmlhbGl6YWJsZUdyaWQ8SVNlcmlhbGl6YWJsZVZpZXc+O1xuXG5cdHByaXZhdGUgdGl0bGVCYXJQYXJ0VmlldyE6IElTZXJpYWxpemFibGVWaWV3O1xuXHRwcml2YXRlIGJhbm5lclBhcnRWaWV3ITogSVNlcmlhbGl6YWJsZVZpZXc7XG5cdHByaXZhdGUgYWN0aXZpdHlCYXJQYXJ0VmlldyE6IElTZXJpYWxpemFibGVWaWV3O1xuXHRwcml2YXRlIHNpZGVCYXJQYXJ0VmlldyE6IElTZXJpYWxpemFibGVWaWV3O1xuXHRwcml2YXRlIHBhbmVsUGFydFZpZXchOiBJU2VyaWFsaXphYmxlVmlldztcblx0cHJpdmF0ZSBhdXhpbGlhcnlCYXJQYXJ0VmlldyE6IElTZXJpYWxpemFibGVWaWV3O1xuXHRwcml2YXRlIGVkaXRvclBhcnRWaWV3ITogSVNlcmlhbGl6YWJsZVZpZXc7XG5cdHByaXZhdGUgc3RhdHVzQmFyUGFydFZpZXchOiBJU2VyaWFsaXphYmxlVmlldztcblxuXHRwcml2YXRlIGVudmlyb25tZW50U2VydmljZSE6IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlO1xuXHRwcml2YXRlIGV4dGVuc2lvblNlcnZpY2UhOiBJRXh0ZW5zaW9uU2VydmljZTtcblx0cHJpdmF0ZSBjb25maWd1cmF0aW9uU2VydmljZSE6IElDb25maWd1cmF0aW9uU2VydmljZTtcblx0cHJpdmF0ZSBzdG9yYWdlU2VydmljZSE6IElTdG9yYWdlU2VydmljZTtcblx0cHJpdmF0ZSBob3N0U2VydmljZSE6IElIb3N0U2VydmljZTtcblx0cHJpdmF0ZSBlZGl0b3JTZXJ2aWNlITogSUVkaXRvclNlcnZpY2U7XG5cdHByaXZhdGUgbWFpblBhcnRFZGl0b3JTZXJ2aWNlITogSUVkaXRvclNlcnZpY2U7XG5cdHByaXZhdGUgZWRpdG9yR3JvdXBTZXJ2aWNlITogSUVkaXRvckdyb3Vwc1NlcnZpY2U7XG5cdHByaXZhdGUgcGFuZUNvbXBvc2l0ZVNlcnZpY2UhOiBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlO1xuXHRwcml2YXRlIHRpdGxlU2VydmljZSE6IElUaXRsZVNlcnZpY2U7XG5cdHByaXZhdGUgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlITogSVZpZXdEZXNjcmlwdG9yU2VydmljZTtcblx0cHJpdmF0ZSBjb250ZXh0U2VydmljZSE6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZTtcblx0cHJpdmF0ZSB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2UhOiBJV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlO1xuXHRwcml2YXRlIG5vdGlmaWNhdGlvblNlcnZpY2UhOiBJTm90aWZpY2F0aW9uU2VydmljZTtcblx0cHJpdmF0ZSB0aGVtZVNlcnZpY2UhOiBJVGhlbWVTZXJ2aWNlO1xuXHRwcml2YXRlIHN0YXR1c0JhclNlcnZpY2UhOiBJU3RhdHVzYmFyU2VydmljZTtcblx0cHJpdmF0ZSBsb2dTZXJ2aWNlITogSUxvZ1NlcnZpY2U7XG5cdHByaXZhdGUgdGVsZW1ldHJ5U2VydmljZSE6IElUZWxlbWV0cnlTZXJ2aWNlO1xuXHRwcml2YXRlIGF1eGlsaWFyeVdpbmRvd1NlcnZpY2UhOiBJQXV4aWxpYXJ5V2luZG93U2VydmljZTtcblxuXHRwcml2YXRlIHN0YXRlITogSUxheW91dFN0YXRlO1xuXHRwcml2YXRlIHN0YXRlTW9kZWwhOiBMYXlvdXRTdGF0ZU1vZGVsO1xuXG5cdHByaXZhdGUgZGlzcG9zZWQgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgcGFyZW50OiBIVE1MRWxlbWVudFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGluaXRMYXlvdXQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblxuXHRcdC8vIFNlcnZpY2VzXG5cdFx0dGhpcy5lbnZpcm9ubWVudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLmhvc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIb3N0U2VydmljZSk7XG5cdFx0dGhpcy5jb250ZXh0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UpO1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHR0aGlzLndvcmtpbmdDb3B5QmFja3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlKTtcblx0XHR0aGlzLnRoZW1lU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGhlbWVTZXJ2aWNlKTtcblx0XHR0aGlzLmV4dGVuc2lvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvblNlcnZpY2UpO1xuXHRcdHRoaXMubG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJTG9nU2VydmljZSk7XG5cdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZWxlbWV0cnlTZXJ2aWNlKTtcblx0XHR0aGlzLmF1eGlsaWFyeVdpbmRvd1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUF1eGlsaWFyeVdpbmRvd1NlcnZpY2UpO1xuXG5cdFx0Ly8gUGFydHNcblx0XHR0aGlzLmVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdHRoaXMubWFpblBhcnRFZGl0b3JTZXJ2aWNlID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmNyZWF0ZVNjb3BlZCgnbWFpbicsIHRoaXMuX3N0b3JlKTtcblx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0dGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlKTtcblx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblx0XHR0aGlzLnRpdGxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGl0bGVTZXJ2aWNlKTtcblx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuc3RhdHVzQmFyU2VydmljZSA9IGFjY2Vzc29yLmdldChJU3RhdHVzYmFyU2VydmljZSk7XG5cdFx0YWNjZXNzb3IuZ2V0KElCYW5uZXJTZXJ2aWNlKTtcblxuXHRcdC8vIExpc3RlbmVyc1xuXHRcdHRoaXMucmVnaXN0ZXJMYXlvdXRMaXN0ZW5lcnMoKTtcblxuXHRcdC8vIFN0YXRlXG5cdFx0dGhpcy5pbml0TGF5b3V0U3RhdGUoYWNjZXNzb3IuZ2V0KElMaWZlY3ljbGVTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckxheW91dExpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIFJlc3RvcmUgZWRpdG9yIGlmIGhpZGRlblxuXHRcdGNvbnN0IHNob3dFZGl0b3JJZkhpZGRlbiA9ICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5pc1Zpc2libGUoUGFydHMuRURJVE9SX1BBUlQsIG1haW5XaW5kb3cpKSB7XG5cdFx0XHRcdHRoaXMudG9nZ2xlTWF4aW1pemVkUGFuZWwoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gV2FpdCB0byByZWdpc3RlciB0aGVzZSBsaXN0ZW5lcnMgYWZ0ZXIgdGhlIGVkaXRvciBncm91cCBzZXJ2aWNlXG5cdFx0Ly8gaXMgcmVhZHkgdG8gYXZvaWQgY29uZmxpY3RzIG9uIHN0YXJ0dXBcblx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS53aGVuUmVzdG9yZWQudGhlbigoKSA9PiB7XG5cblx0XHRcdC8vIFJlc3RvcmUgbWFpbiBlZGl0b3IgcGFydCBvbiBhbnkgZWRpdG9yIGNoYW5nZSBpbiBtYWluIHBhcnRcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubWFpblBhcnRFZGl0b3JTZXJ2aWNlLm9uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2Uoc2hvd0VkaXRvcklmSGlkZGVuKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvckdyb3VwU2VydmljZS5tYWluUGFydC5vbkRpZEFjdGl2YXRlR3JvdXAoc2hvd0VkaXRvcklmSGlkZGVuKSk7XG5cblx0XHRcdC8vIFJldmFsaWRhdGUgY2VudGVyIGxheW91dCB3aGVuIGFjdGl2ZSBlZGl0b3IgY2hhbmdlczogZGlmZiBlZGl0b3IgcXVpdHMgY2VudGVyZWQgbW9kZS5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubWFpblBhcnRFZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCgpID0+IHRoaXMuY2VudGVyTWFpbkVkaXRvckxheW91dCh0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5NQUlOX0VESVRPUl9DRU5URVJFRCkpKSk7XG5cdFx0fSk7XG5cblx0XHQvLyBDb25maWd1cmF0aW9uIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZSkgPT4ge1xuXHRcdFx0aWYgKFtcblx0XHRcdFx0Li4uVElUTEVfQkFSX1NFVFRJTkdTLFxuXHRcdFx0XHRMZWdhY3lXb3JrYmVuY2hMYXlvdXRTZXR0aW5ncy5TSURFQkFSX1BPU0lUSU9OLFxuXHRcdFx0XHRMZWdhY3lXb3JrYmVuY2hMYXlvdXRTZXR0aW5ncy5TVEFUVVNCQVJfVklTSUJMRSxcblx0XHRcdF0uc29tZShzZXR0aW5nID0+IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oc2V0dGluZykpKSB7XG5cdFx0XHRcdC8vIFNob3cgQ29tbWFuZCBDZW50ZXIgaWYgY29tbWFuZCBjZW50ZXIgYWN0aW9ucyBlbmFibGVkXG5cdFx0XHRcdGNvbnN0IHNoYXJlRW5hYmxlZCA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaC5leHBlcmltZW50YWwuc2hhcmUuZW5hYmxlZCcpICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ3dvcmtiZW5jaC5leHBlcmltZW50YWwuc2hhcmUuZW5hYmxlZCcpO1xuXHRcdFx0XHRjb25zdCBuYXZpZ2F0aW9uQ29udHJvbEVuYWJsZWQgPSBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCd3b3JrYmVuY2gubmF2aWdhdGlvbkNvbnRyb2wuZW5hYmxlZCcpICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ3dvcmtiZW5jaC5uYXZpZ2F0aW9uQ29udHJvbC5lbmFibGVkJyk7XG5cblx0XHRcdFx0Ly8gQ3VycmVudGx5IG5vdCBzdXBwb3J0ZWQgZm9yIFwiY2hhdC5jb21tYW5kQ2VudGVyLmVuYWJsZWRcIiBhcyB3ZVxuXHRcdFx0XHQvLyBwcm9ncmFtYXRpY2FsbHkgc2V0IHRoaXMgZHVyaW5nIHNldHVwIGFuZCBjb3VsZCBsZWFkIHRvIHVud2FudGVkIHRpdGxlYmFyIGFwcGVhcmluZ1xuXHRcdFx0XHQvLyBjb25zdCBjaGF0Q29udHJvbHNFbmFibGVkID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbignY2hhdC5jb21tYW5kQ2VudGVyLmVuYWJsZWQnKSAmJiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdjaGF0LmNvbW1hbmRDZW50ZXIuZW5hYmxlZCcpO1xuXG5cdFx0XHRcdGlmIChzaGFyZUVuYWJsZWQgfHwgbmF2aWdhdGlvbkNvbnRyb2xFbmFibGVkKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTGF5b3V0U2V0dGluZ3MuQ09NTUFORF9DRU5URVIpID09PSBmYWxzZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShMYXlvdXRTZXR0aW5ncy5DT01NQU5EX0NFTlRFUiwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRyZXR1cm47IC8vIG9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbiB3aWxsIGJlIHRyaWdnZXJlZCBhZ2FpblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFNob3cgQ3VzdG9tIFRpdGxlQmFyIGlmIGFjdGlvbnMgZW5hYmxlZCBpbiAob3IgbW92ZWQgdG8pIHRoZSB0aXRsZWJhclxuXHRcdFx0XHRjb25zdCBlZGl0b3JBY3Rpb25zTW92ZWRUb1RpdGxlYmFyID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihMYXlvdXRTZXR0aW5ncy5FRElUT1JfQUNUSU9OU19MT0NBVElPTikgJiYgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxFZGl0b3JBY3Rpb25zTG9jYXRpb24+KExheW91dFNldHRpbmdzLkVESVRPUl9BQ1RJT05TX0xPQ0FUSU9OKSA9PT0gRWRpdG9yQWN0aW9uc0xvY2F0aW9uLlRJVExFQkFSO1xuXHRcdFx0XHRjb25zdCBjb21tYW5kQ2VudGVyRW5hYmxlZCA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTGF5b3V0U2V0dGluZ3MuQ09NTUFORF9DRU5URVIpICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTGF5b3V0U2V0dGluZ3MuQ09NTUFORF9DRU5URVIpO1xuXHRcdFx0XHRjb25zdCBsYXlvdXRDb250cm9sc0VuYWJsZWQgPSBlLmFmZmVjdHNDb25maWd1cmF0aW9uKExheW91dFNldHRpbmdzLkxBWU9VVF9BQ1RJT05TKSAmJiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KExheW91dFNldHRpbmdzLkxBWU9VVF9BQ1RJT05TKTtcblx0XHRcdFx0Y29uc3QgYWN0aXZpdHlCYXJNb3ZlZFRvVG9wT3JCb3R0b20gPSBlLmFmZmVjdHNDb25maWd1cmF0aW9uKExheW91dFNldHRpbmdzLkFDVElWSVRZX0JBUl9MT0NBVElPTikgJiYgW0FjdGl2aXR5QmFyUG9zaXRpb24uVE9QLCBBY3Rpdml0eUJhclBvc2l0aW9uLkJPVFRPTV0uaW5jbHVkZXModGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxBY3Rpdml0eUJhclBvc2l0aW9uPihMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04pKTtcblxuXHRcdFx0XHRpZiAoYWN0aXZpdHlCYXJNb3ZlZFRvVG9wT3JCb3R0b20gfHwgZWRpdG9yQWN0aW9uc01vdmVkVG9UaXRsZWJhciB8fCBjb21tYW5kQ2VudGVyRW5hYmxlZCB8fCBsYXlvdXRDb250cm9sc0VuYWJsZWQpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxDdXN0b21UaXRsZUJhclZpc2liaWxpdHk+KFRpdGxlQmFyU2V0dGluZy5DVVNUT01fVElUTEVfQkFSX1ZJU0lCSUxJVFkpID09PSBDdXN0b21UaXRsZUJhclZpc2liaWxpdHkuTkVWRVIpIHtcblx0XHRcdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoVGl0bGVCYXJTZXR0aW5nLkNVU1RPTV9USVRMRV9CQVJfVklTSUJJTElUWSwgQ3VzdG9tVGl0bGVCYXJWaXNpYmlsaXR5LkFVVE8pO1xuXHRcdFx0XHRcdFx0cmV0dXJuOyAvLyBvbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24gd2lsbCBiZSB0cmlnZ2VyZWQgYWdhaW5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmRvVXBkYXRlTGF5b3V0Q29uZmlndXJhdGlvbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIEZ1bGxzY3JlZW4gY2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG9uRGlkQ2hhbmdlRnVsbHNjcmVlbih3aW5kb3dJZCA9PiB0aGlzLm9uRnVsbHNjcmVlbkNoYW5nZWQod2luZG93SWQpKSk7XG5cblx0XHQvLyBHcm91cCBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JHcm91cFNlcnZpY2UubWFpblBhcnQub25EaWRBZGRHcm91cCgoKSA9PiB0aGlzLmNlbnRlck1haW5FZGl0b3JMYXlvdXQodGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuTUFJTl9FRElUT1JfQ0VOVEVSRUQpKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0Lm9uRGlkUmVtb3ZlR3JvdXAoKCkgPT4gdGhpcy5jZW50ZXJNYWluRWRpdG9yTGF5b3V0KHRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLk1BSU5fRURJVE9SX0NFTlRFUkVEKSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvckdyb3VwU2VydmljZS5tYWluUGFydC5vbkRpZENoYW5nZUdyb3VwTWF4aW1pemVkKCgpID0+IHRoaXMuY2VudGVyTWFpbkVkaXRvckxheW91dCh0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5NQUlOX0VESVRPUl9DRU5URVJFRCkpKSk7XG5cblx0XHQvLyBQcmV2ZW50IHdvcmtiZW5jaCBmcm9tIHNjcm9sbGluZyAjNTU0NTZcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5tYWluQ29udGFpbmVyLCBFdmVudFR5cGUuU0NST0xMLCAoKSA9PiB0aGlzLm1haW5Db250YWluZXIuc2Nyb2xsVG9wID0gMCkpO1xuXG5cdFx0Ly8gTWVudWJhciB2aXNpYmlsaXR5IGNoYW5nZXNcblx0XHRjb25zdCBzaG93aW5nQ3VzdG9tTWVudSA9IChpc1dpbmRvd3MgfHwgaXNMaW51eCB8fCBpc1dlYikgJiYgIWhhc05hdGl2ZVRpdGxlYmFyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGlmIChzaG93aW5nQ3VzdG9tTWVudSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50aXRsZVNlcnZpY2Uub25NZW51YmFyVmlzaWJpbGl0eUNoYW5nZSh2aXNpYmxlID0+IHRoaXMub25NZW51YmFyVG9nZ2xlZCh2aXNpYmxlKSkpO1xuXHRcdH1cblxuXHRcdC8vIFRoZW1lIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoKCkgPT4gdGhpcy51cGRhdGVXaW5kb3dzQm9yZGVyKCkpKTtcblxuXHRcdC8vIFdpbmRvdyBhY3RpdmUgLyBmb2N1cyBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ob3N0U2VydmljZS5vbkRpZENoYW5nZUZvY3VzKGZvY3VzZWQgPT4gdGhpcy5vbldpbmRvd0ZvY3VzQ2hhbmdlZChmb2N1c2VkKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG9zdFNlcnZpY2Uub25EaWRDaGFuZ2VBY3RpdmVXaW5kb3coKCkgPT4gdGhpcy5vbkFjdGl2ZVdpbmRvd0NoYW5nZWQoKSkpO1xuXG5cdFx0Ly8gV0NPIGNoYW5nZXNcblx0XHRpZiAoaXNXZWIgJiYgdHlwZW9mIChuYXZpZ2F0b3IgYXMgYW55KS53aW5kb3dDb250cm9sc092ZXJsYXkgPT09ICdvYmplY3QnKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIoKG5hdmlnYXRvciBhcyBhbnkpLndpbmRvd0NvbnRyb2xzT3ZlcmxheSwgJ2dlb21ldHJ5Y2hhbmdlJywgKCkgPT4gdGhpcy5vbkRpZENoYW5nZVdDTygpKSk7XG5cdFx0fVxuXG5cdFx0Ly8gQXV4aWxpYXJ5IHdpbmRvd3Ncblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmF1eGlsaWFyeVdpbmRvd1NlcnZpY2Uub25EaWRPcGVuQXV4aWxpYXJ5V2luZG93KCh7IHdpbmRvdywgZGlzcG9zYWJsZXMgfSkgPT4ge1xuXHRcdFx0Y29uc3Qgd2luZG93SWQgPSB3aW5kb3cud2luZG93LnZzY29kZVdpbmRvd0lkO1xuXHRcdFx0dGhpcy5jb250YWluZXJTdHlsZXNMb2FkZWQuc2V0KHdpbmRvd0lkLCB3aW5kb3cud2hlblN0eWxlc0hhdmVMb2FkZWQpO1xuXHRcdFx0d2luZG93LndoZW5TdHlsZXNIYXZlTG9hZGVkLnRoZW4oKCkgPT4gdGhpcy5jb250YWluZXJTdHlsZXNMb2FkZWQuZGVsZXRlKHdpbmRvd0lkKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuY29udGFpbmVyU3R5bGVzTG9hZGVkLmRlbGV0ZSh3aW5kb3dJZCkpKTtcblxuXHRcdFx0Y29uc3QgZXZlbnREaXNwb3NhYmxlcyA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdFx0dGhpcy5fb25EaWRBZGRDb250YWluZXIuZmlyZSh7IGNvbnRhaW5lcjogd2luZG93LmNvbnRhaW5lciwgZGlzcG9zYWJsZXM6IGV2ZW50RGlzcG9zYWJsZXMgfSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh3aW5kb3cub25EaWRMYXlvdXQoZGltZW5zaW9uID0+IHRoaXMuaGFuZGxlQ29udGFpbmVyRGlkTGF5b3V0KHdpbmRvdy5jb250YWluZXIsIGRpbWVuc2lvbikpKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIG9uTWVudWJhclRvZ2dsZWQodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh2aXNpYmxlICE9PSB0aGlzLnN0YXRlLnJ1bnRpbWUubWVudUJhci50b2dnbGVkKSB7XG5cdFx0XHR0aGlzLnN0YXRlLnJ1bnRpbWUubWVudUJhci50b2dnbGVkID0gdmlzaWJsZTtcblxuXHRcdFx0Y29uc3QgbWVudUJhclZpc2liaWxpdHkgPSBnZXRNZW51QmFyVmlzaWJpbGl0eSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdFx0Ly8gVGhlIG1lbnUgYmFyIHRvZ2dsZXMgdGhlIHRpdGxlIGJhciBpbiB3ZWIgYmVjYXVzZSBpdCBkb2VzIG5vdCBuZWVkIHRvIGJlIHNob3duIGZvciB3aW5kb3cgY29udHJvbHMgb25seVxuXHRcdFx0aWYgKGlzV2ViICYmIG1lbnVCYXJWaXNpYmlsaXR5ID09PSAndG9nZ2xlJykge1xuXHRcdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQuc2V0Vmlld1Zpc2libGUodGhpcy50aXRsZUJhclBhcnRWaWV3LCBzaG91bGRTaG93Q3VzdG9tVGl0bGVCYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgbWFpbldpbmRvdywgdGhpcy5zdGF0ZS5ydW50aW1lLm1lbnVCYXIudG9nZ2xlZCkpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUaGUgbWVudSBiYXIgdG9nZ2xlcyB0aGUgdGl0bGUgYmFyIGluIGZ1bGwgc2NyZWVuIGZvciB0b2dnbGUgYW5kIGNsYXNzaWMgc2V0dGluZ3Ncblx0XHRcdGVsc2UgaWYgKHRoaXMuc3RhdGUucnVudGltZS5tYWluV2luZG93RnVsbHNjcmVlbiAmJiAobWVudUJhclZpc2liaWxpdHkgPT09ICd0b2dnbGUnIHx8IG1lbnVCYXJWaXNpYmlsaXR5ID09PSAnY2xhc3NpYycpKSB7XG5cdFx0XHRcdHRoaXMud29ya2JlbmNoR3JpZC5zZXRWaWV3VmlzaWJsZSh0aGlzLnRpdGxlQmFyUGFydFZpZXcsIHNob3VsZFNob3dDdXN0b21UaXRsZUJhcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBtYWluV2luZG93LCB0aGlzLnN0YXRlLnJ1bnRpbWUubWVudUJhci50b2dnbGVkKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1vdmUgbGF5b3V0IGNhbGwgdG8gYW55IHRpbWUgdGhlIG1lbnViYXJcblx0XHRcdC8vIGlzIHRvZ2dsZWQgdG8gdXBkYXRlIGNvbnN1bWVycyBvZiBvZmZzZXRcblx0XHRcdC8vIHNlZSBpc3N1ZSAjMTE1MjY3XG5cdFx0XHR0aGlzLmhhbmRsZUNvbnRhaW5lckRpZExheW91dCh0aGlzLm1haW5Db250YWluZXIsIHRoaXMuX21haW5Db250YWluZXJEaW1lbnNpb24pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQ29udGFpbmVyRGlkTGF5b3V0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGRpbWVuc2lvbjogSURpbWVuc2lvbik6IHZvaWQge1xuXHRcdGlmIChjb250YWluZXIgPT09IHRoaXMubWFpbkNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fb25EaWRMYXlvdXRNYWluQ29udGFpbmVyLmZpcmUoZGltZW5zaW9uKTtcblx0XHR9XG5cblx0XHRpZiAoaXNBY3RpdmVEb2N1bWVudChjb250YWluZXIpKSB7XG5cdFx0XHR0aGlzLl9vbkRpZExheW91dEFjdGl2ZUNvbnRhaW5lci5maXJlKGRpbWVuc2lvbik7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRMYXlvdXRDb250YWluZXIuZmlyZSh7IGNvbnRhaW5lciwgZGltZW5zaW9uIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkZ1bGxzY3JlZW5DaGFuZ2VkKHdpbmRvd0lkOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAod2luZG93SWQgIT09IG1haW5XaW5kb3cudnNjb2RlV2luZG93SWQpIHtcblx0XHRcdHJldHVybjsgLy8gaWdub3JlIGFsbCBidXQgbWFpbiB3aW5kb3dcblx0XHR9XG5cblx0XHR0aGlzLnN0YXRlLnJ1bnRpbWUubWFpbldpbmRvd0Z1bGxzY3JlZW4gPSBpc0Z1bGxzY3JlZW4obWFpbldpbmRvdyk7XG5cblx0XHQvLyBBcHBseSBhcyBDU1MgY2xhc3Ncblx0XHRpZiAodGhpcy5zdGF0ZS5ydW50aW1lLm1haW5XaW5kb3dGdWxsc2NyZWVuKSB7XG5cdFx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LmFkZChMYXlvdXRDbGFzc2VzLkZVTExTQ1JFRU4pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShMYXlvdXRDbGFzc2VzLkZVTExTQ1JFRU4pO1xuXG5cdFx0XHRjb25zdCB6ZW5Nb2RlRXhpdEluZm8gPSB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5aRU5fTU9ERV9FWElUX0lORk8pO1xuXHRcdFx0aWYgKHplbk1vZGVFeGl0SW5mby50cmFuc2l0aW9uZWRUb0Z1bGxTY3JlZW4gJiYgdGhpcy5pc1plbk1vZGVBY3RpdmUoKSkge1xuXHRcdFx0XHR0aGlzLnRvZ2dsZVplbk1vZGUoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDaGFuZ2UgZWRnZSBzbmFwcGluZyBhY2NvcmRpbmdseVxuXHRcdHRoaXMud29ya2JlbmNoR3JpZC5lZGdlU25hcHBpbmcgPSB0aGlzLnN0YXRlLnJ1bnRpbWUubWFpbldpbmRvd0Z1bGxzY3JlZW47XG5cblx0XHQvLyBDaGFuZ2luZyBmdWxsc2NyZWVuIHN0YXRlIG9mIHRoZSBtYWluIHdpbmRvdyBoYXMgYW4gaW1wYWN0XG5cdFx0Ly8gb24gY3VzdG9tIHRpdGxlIGJhciB2aXNpYmlsaXR5LCBzbyB3ZSBuZWVkIHRvIHVwZGF0ZVxuXHRcdGlmIChoYXNDdXN0b21UaXRsZWJhcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSkge1xuXG5cdFx0XHQvLyBQcm9wYWdhdGUgdG8gZ3JpZFxuXHRcdFx0dGhpcy53b3JrYmVuY2hHcmlkLnNldFZpZXdWaXNpYmxlKHRoaXMudGl0bGVCYXJQYXJ0Vmlldywgc2hvdWxkU2hvd0N1c3RvbVRpdGxlQmFyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIG1haW5XaW5kb3csIHRoaXMuc3RhdGUucnVudGltZS5tZW51QmFyLnRvZ2dsZWQpKTtcblxuXHRcdFx0dGhpcy51cGRhdGVXaW5kb3dzQm9yZGVyKHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25BY3RpdmVXaW5kb3dDaGFuZ2VkKCk6IHZvaWQge1xuXHRcdGNvbnN0IGFjdGl2ZUNvbnRhaW5lcklkID0gdGhpcy5nZXRBY3RpdmVDb250YWluZXJJZCgpO1xuXHRcdGlmICh0aGlzLnN0YXRlLnJ1bnRpbWUuYWN0aXZlQ29udGFpbmVySWQgIT09IGFjdGl2ZUNvbnRhaW5lcklkKSB7XG5cdFx0XHR0aGlzLnN0YXRlLnJ1bnRpbWUuYWN0aXZlQ29udGFpbmVySWQgPSBhY3RpdmVDb250YWluZXJJZDtcblxuXHRcdFx0Ly8gSW5kaWNhdGUgYWN0aXZlIHdpbmRvdyBib3JkZXJcblx0XHRcdHRoaXMudXBkYXRlV2luZG93c0JvcmRlcigpO1xuXG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZUNvbnRhaW5lci5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbldpbmRvd0ZvY3VzQ2hhbmdlZChoYXNGb2N1czogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLnN0YXRlLnJ1bnRpbWUuaGFzRm9jdXMgIT09IGhhc0ZvY3VzKSB7XG5cdFx0XHR0aGlzLnN0YXRlLnJ1bnRpbWUuaGFzRm9jdXMgPSBoYXNGb2N1cztcblx0XHRcdHRoaXMudXBkYXRlV2luZG93c0JvcmRlcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0QWN0aXZlQ29udGFpbmVySWQoKTogbnVtYmVyIHtcblx0XHRjb25zdCBhY3RpdmVDb250YWluZXIgPSB0aGlzLmFjdGl2ZUNvbnRhaW5lcjtcblxuXHRcdHJldHVybiBnZXRXaW5kb3coYWN0aXZlQ29udGFpbmVyKS52c2NvZGVXaW5kb3dJZDtcblx0fVxuXG5cdHByaXZhdGUgZG9VcGRhdGVMYXlvdXRDb25maWd1cmF0aW9uKHNraXBMYXlvdXQ/OiBib29sZWFuKTogdm9pZCB7XG5cblx0XHQvLyBDdXN0b20gVGl0bGViYXIgdmlzaWJpbGl0eSB3aXRoIG5hdGl2ZSB0aXRsZWJhclxuXHRcdHRoaXMudXBkYXRlQ3VzdG9tVGl0bGVCYXJWaXNpYmlsaXR5KCk7XG5cblx0XHQvLyBNZW51YmFyIHZpc2liaWxpdHlcblx0XHR0aGlzLnVwZGF0ZU1lbnViYXJWaXNpYmlsaXR5KCEhc2tpcExheW91dCk7XG5cblx0XHQvLyBDZW50ZXJlZCBMYXlvdXRcblx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS53aGVuUmVzdG9yZWQudGhlbigoKSA9PiB0aGlzLmNlbnRlck1haW5FZGl0b3JMYXlvdXQodGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuTUFJTl9FRElUT1JfQ0VOVEVSRUQpLCBza2lwTGF5b3V0KSk7XG5cdH1cblxuXHRwcml2YXRlIHNldFNpZGVCYXJQb3NpdGlvbihwb3NpdGlvbjogUG9zaXRpb24pOiB2b2lkIHtcblx0XHRjb25zdCBhY3Rpdml0eUJhciA9IHRoaXMuZ2V0UGFydChQYXJ0cy5BQ1RJVklUWUJBUl9QQVJUKTtcblx0XHRjb25zdCBzaWRlQmFyID0gdGhpcy5nZXRQYXJ0KFBhcnRzLlNJREVCQVJfUEFSVCk7XG5cdFx0Y29uc3QgYXV4aWxpYXJ5QmFyID0gdGhpcy5nZXRQYXJ0KFBhcnRzLkFVWElMSUFSWUJBUl9QQVJUKTtcblx0XHRjb25zdCBuZXdQb3NpdGlvblZhbHVlID0gKHBvc2l0aW9uID09PSBQb3NpdGlvbi5MRUZUKSA/ICdsZWZ0JyA6ICdyaWdodCc7XG5cdFx0Y29uc3Qgb2xkUG9zaXRpb25WYWx1ZSA9IChwb3NpdGlvbiA9PT0gUG9zaXRpb24uUklHSFQpID8gJ2xlZnQnIDogJ3JpZ2h0Jztcblx0XHRjb25zdCBwYW5lbEFsaWdubWVudCA9IHRoaXMuZ2V0UGFuZWxBbGlnbm1lbnQoKTtcblx0XHRjb25zdCBwYW5lbFBvc2l0aW9uID0gdGhpcy5nZXRQYW5lbFBvc2l0aW9uKCk7XG5cblx0XHR0aGlzLnN0YXRlTW9kZWwuc2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5TSURFQkFSX1BPU0lUT04sIHBvc2l0aW9uKTtcblxuXHRcdC8vIEFkanVzdCBDU1Ncblx0XHRjb25zdCBhY3Rpdml0eUJhckNvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZChhY3Rpdml0eUJhci5nZXRDb250YWluZXIoKSk7XG5cdFx0Y29uc3Qgc2lkZUJhckNvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZChzaWRlQmFyLmdldENvbnRhaW5lcigpKTtcblx0XHRjb25zdCBhdXhpbGlhcnlCYXJDb250YWluZXIgPSBhc3NlcnRJc0RlZmluZWQoYXV4aWxpYXJ5QmFyLmdldENvbnRhaW5lcigpKTtcblx0XHRhY3Rpdml0eUJhckNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKG9sZFBvc2l0aW9uVmFsdWUpO1xuXHRcdHNpZGVCYXJDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShvbGRQb3NpdGlvblZhbHVlKTtcblx0XHRhY3Rpdml0eUJhckNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKG5ld1Bvc2l0aW9uVmFsdWUpO1xuXHRcdHNpZGVCYXJDb250YWluZXIuY2xhc3NMaXN0LmFkZChuZXdQb3NpdGlvblZhbHVlKTtcblxuXHRcdC8vIEF1eGlsaWFyeSBCYXIgaGFzIG9wcG9zaXRlIHZhbHVlc1xuXHRcdGF1eGlsaWFyeUJhckNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKG5ld1Bvc2l0aW9uVmFsdWUpO1xuXHRcdGF1eGlsaWFyeUJhckNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKG9sZFBvc2l0aW9uVmFsdWUpO1xuXG5cdFx0Ly8gVXBkYXRlIFN0eWxlc1xuXHRcdGFjdGl2aXR5QmFyLnVwZGF0ZVN0eWxlcygpO1xuXHRcdHNpZGVCYXIudXBkYXRlU3R5bGVzKCk7XG5cdFx0YXV4aWxpYXJ5QmFyLnVwZGF0ZVN0eWxlcygpO1xuXG5cdFx0Ly8gTW92ZSBhY3Rpdml0eSBiYXIgYW5kIHNpZGUgYmFyc1xuXHRcdHRoaXMuYWRqdXN0UGFydFBvc2l0aW9ucyhwb3NpdGlvbiwgcGFuZWxBbGlnbm1lbnQsIHBhbmVsUG9zaXRpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVXaW5kb3dzQm9yZGVyKHNraXBMYXlvdXQgPSBmYWxzZSkge1xuXHRcdGlmIChcblx0XHRcdGlzV2ViIHx8XG5cdFx0XHRpc1dpbmRvd3MgfHwgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIG5vdCB3b3JraW5nIHdlbGwgd2l0aCB6b29taW5nIChib3JkZXIgb2Z0ZW4gbm90IHZpc2libGUpXG5cdFx0XHQoXG5cdFx0XHRcdChpc1dpbmRvd3MgfHwgaXNMaW51eCkgJiZcblx0XHRcdFx0dXNlV2luZG93Q29udHJvbHNPdmVybGF5KHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpXHQvLyBXaW5kb3dzL0xpbnV4OiBub3Qgd29ya2luZyB3aXRoIFdDTyAoYm9yZGVyIGNhbm5vdCBkcmF3IG92ZXIgdGhlIG92ZXJsYXkpXG5cdFx0XHQpIHx8XG5cdFx0XHRoYXNOYXRpdmVUaXRsZWJhcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRoZW1lID0gdGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpO1xuXG5cdFx0Y29uc3QgYWN0aXZlQm9yZGVyID0gdGhlbWUuZ2V0Q29sb3IoV0lORE9XX0FDVElWRV9CT1JERVIpO1xuXHRcdGNvbnN0IGluYWN0aXZlQm9yZGVyID0gdGhlbWUuZ2V0Q29sb3IoV0lORE9XX0lOQUNUSVZFX0JPUkRFUik7XG5cblx0XHRjb25zdCBkaWRIYXZlTWFpbldpbmRvd0JvcmRlciA9IHRoaXMuaGFzTWFpbldpbmRvd0JvcmRlcigpO1xuXG5cdFx0Zm9yIChjb25zdCBjb250YWluZXIgb2YgdGhpcy5jb250YWluZXJzKSB7XG5cdFx0XHRjb25zdCBpc01haW5Db250YWluZXIgPSBjb250YWluZXIgPT09IHRoaXMubWFpbkNvbnRhaW5lcjtcblx0XHRcdGNvbnN0IGlzQWN0aXZlQ29udGFpbmVyID0gdGhpcy5hY3RpdmVDb250YWluZXIgPT09IGNvbnRhaW5lcjtcblxuXHRcdFx0bGV0IHdpbmRvd0JvcmRlciA9IGZhbHNlO1xuXHRcdFx0aWYgKCF0aGlzLnN0YXRlLnJ1bnRpbWUubWFpbldpbmRvd0Z1bGxzY3JlZW4gJiYgKGFjdGl2ZUJvcmRlciB8fCBpbmFjdGl2ZUJvcmRlcikpIHtcblx0XHRcdFx0d2luZG93Qm9yZGVyID0gdHJ1ZTtcblxuXHRcdFx0XHQvLyBJZiB0aGUgaW5hY3RpdmUgY29sb3IgaXMgbWlzc2luZywgZmFsbGJhY2sgdG8gdGhlIGFjdGl2ZSBvbmVcblx0XHRcdFx0Y29uc3QgYm9yZGVyQ29sb3IgPSBpc0FjdGl2ZUNvbnRhaW5lciAmJiB0aGlzLnN0YXRlLnJ1bnRpbWUuaGFzRm9jdXMgPyBhY3RpdmVCb3JkZXIgOiBpbmFjdGl2ZUJvcmRlciA/PyBhY3RpdmVCb3JkZXI7XG5cdFx0XHRcdGNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eSgnLS13aW5kb3ctYm9yZGVyLWNvbG9yJywgYm9yZGVyQ29sb3I/LnRvU3RyaW5nKCkgPz8gJ3RyYW5zcGFyZW50Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpc01haW5Db250YWluZXIpIHtcblx0XHRcdFx0dGhpcy5zdGF0ZS5ydW50aW1lLm1haW5XaW5kb3dCb3JkZXIgPSB3aW5kb3dCb3JkZXI7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKExheW91dENsYXNzZXMuV0lORE9XX0JPUkRFUiwgd2luZG93Qm9yZGVyKTtcblx0XHR9XG5cblx0XHRpZiAoIXNraXBMYXlvdXQgJiYgZGlkSGF2ZU1haW5XaW5kb3dCb3JkZXIgIT09IHRoaXMuaGFzTWFpbldpbmRvd0JvcmRlcigpKSB7XG5cdFx0XHR0aGlzLmxheW91dCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaW5pdExheW91dFN0YXRlKGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLCBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlKTogdm9pZCB7XG5cdFx0dGhpcy5fbWFpbkNvbnRhaW5lckRpbWVuc2lvbiA9IGdldENsaWVudEFyZWEodGhpcy5wYXJlbnQsIERFRkFVTFRfV0lORE9XX0RJTUVOU0lPTlMpOyAvLyBydW5uaW5nIHdpdGggZmFsbGJhY2sgdG8gZW5zdXJlIG5vIGVycm9yIGlzIHRocm93biAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI0MDI0MilcblxuXHRcdHRoaXMuc3RhdGVNb2RlbCA9IG5ldyBMYXlvdXRTdGF0ZU1vZGVsKHRoaXMuc3RvcmFnZVNlcnZpY2UsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMuY29udGV4dFNlcnZpY2UpO1xuXHRcdHRoaXMuc3RhdGVNb2RlbC5sb2FkKHRoaXMuX21haW5Db250YWluZXJEaW1lbnNpb24pO1xuXG5cdFx0Ly8gQm90aCBlZGl0b3IgYW5kIHBhbmVsIHNob3VsZCBub3QgYmUgaGlkZGVuIG9uIHN0YXJ0dXBcblx0XHRpZiAodGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfSElEREVOKSAmJiB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5FRElUT1JfSElEREVOKSkge1xuXHRcdFx0dGhpcy5zdGF0ZU1vZGVsLnNldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuRURJVE9SX0hJRERFTiwgZmFsc2UpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc3RhdGVNb2RlbC5vbkRpZENoYW5nZVN0YXRlKGNoYW5nZSA9PiB7XG5cdFx0XHRpZiAoY2hhbmdlLmtleSA9PT0gTGF5b3V0U3RhdGVLZXlzLkFDVElWSVRZQkFSX0hJRERFTikge1xuXHRcdFx0XHR0aGlzLnNldEFjdGl2aXR5QmFySGlkZGVuKGNoYW5nZS52YWx1ZSBhcyBib29sZWFuKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNoYW5nZS5rZXkgPT09IExheW91dFN0YXRlS2V5cy5TVEFUVVNCQVJfSElEREVOKSB7XG5cdFx0XHRcdHRoaXMuc2V0U3RhdHVzQmFySGlkZGVuKGNoYW5nZS52YWx1ZSBhcyBib29sZWFuKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNoYW5nZS5rZXkgPT09IExheW91dFN0YXRlS2V5cy5TSURFQkFSX1BPU0lUT04pIHtcblx0XHRcdFx0dGhpcy5zZXRTaWRlQmFyUG9zaXRpb24oY2hhbmdlLnZhbHVlIGFzIFBvc2l0aW9uKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNoYW5nZS5rZXkgPT09IExheW91dFN0YXRlS2V5cy5QQU5FTF9QT1NJVElPTikge1xuXHRcdFx0XHR0aGlzLnNldFBhbmVsUG9zaXRpb24oY2hhbmdlLnZhbHVlIGFzIFBvc2l0aW9uKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNoYW5nZS5rZXkgPT09IExheW91dFN0YXRlS2V5cy5QQU5FTF9BTElHTk1FTlQpIHtcblx0XHRcdFx0dGhpcy5zZXRQYW5lbEFsaWdubWVudChjaGFuZ2UudmFsdWUgYXMgUGFuZWxBbGlnbm1lbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmRvVXBkYXRlTGF5b3V0Q29uZmlndXJhdGlvbigpO1xuXHRcdH0pKTtcblxuXHRcdC8vIExheW91dCBJbml0aWFsaXphdGlvbiBTdGF0ZVxuXHRcdGNvbnN0IGluaXRpYWxFZGl0b3JzU3RhdGUgPSB0aGlzLmdldEluaXRpYWxFZGl0b3JzU3RhdGUoKTtcblx0XHRpZiAoaW5pdGlhbEVkaXRvcnNTdGF0ZSkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdJbml0aWFsIGVkaXRvciBzdGF0ZScsIGluaXRpYWxFZGl0b3JzU3RhdGUpO1xuXHRcdH1cblx0XHRjb25zdCBpbml0aWFsTGF5b3V0U3RhdGU6IElMYXlvdXRJbml0aWFsaXphdGlvblN0YXRlID0ge1xuXHRcdFx0bGF5b3V0OiB7XG5cdFx0XHRcdGVkaXRvcnM6IGluaXRpYWxFZGl0b3JzU3RhdGU/LmxheW91dFxuXHRcdFx0fSxcblx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRyZXN0b3JlRWRpdG9yczogdGhpcy5zaG91bGRSZXN0b3JlRWRpdG9ycyh0aGlzLmNvbnRleHRTZXJ2aWNlLCBpbml0aWFsRWRpdG9yc1N0YXRlKSxcblx0XHRcdFx0ZWRpdG9yc1RvT3BlbjogdGhpcy5yZXNvbHZlRWRpdG9yc1RvT3BlbihmaWxlU2VydmljZSwgaW5pdGlhbEVkaXRvcnNTdGF0ZSksXG5cdFx0XHR9LFxuXHRcdFx0dmlld3M6IHtcblx0XHRcdFx0ZGVmYXVsdHM6IHRoaXMuZ2V0RGVmYXVsdExheW91dFZpZXdzKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLCB0aGlzLnN0b3JhZ2VTZXJ2aWNlKSxcblx0XHRcdFx0Y29udGFpbmVyVG9SZXN0b3JlOiB7fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBMYXlvdXQgUnVudGltZSBTdGF0ZVxuXHRcdGNvbnN0IGxheW91dFJ1bnRpbWVTdGF0ZTogSUxheW91dFJ1bnRpbWVTdGF0ZSA9IHtcblx0XHRcdGFjdGl2ZUNvbnRhaW5lcklkOiB0aGlzLmdldEFjdGl2ZUNvbnRhaW5lcklkKCksXG5cdFx0XHRtYWluV2luZG93RnVsbHNjcmVlbjogaXNGdWxsc2NyZWVuKG1haW5XaW5kb3cpLFxuXHRcdFx0aGFzRm9jdXM6IHRoaXMuaG9zdFNlcnZpY2UuaGFzRm9jdXMsXG5cdFx0XHRtYXhpbWl6ZWQ6IG5ldyBTZXQ8bnVtYmVyPigpLFxuXHRcdFx0bWFpbldpbmRvd0JvcmRlcjogZmFsc2UsXG5cdFx0XHRtZW51QmFyOiB7XG5cdFx0XHRcdHRvZ2dsZWQ6IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdHplbk1vZGU6IHtcblx0XHRcdFx0dHJhbnNpdGlvbkRpc3Bvc2FibGVzOiBuZXcgRGlzcG9zYWJsZU1hcCgpLFxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLnN0YXRlID0ge1xuXHRcdFx0aW5pdGlhbGl6YXRpb246IGluaXRpYWxMYXlvdXRTdGF0ZSxcblx0XHRcdHJ1bnRpbWU6IGxheW91dFJ1bnRpbWVTdGF0ZSxcblx0XHR9O1xuXG5cdFx0Ly8gU2lkZWJhciBWaWV3IENvbnRhaW5lciBUbyBSZXN0b3JlXG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKFBhcnRzLlNJREVCQVJfUEFSVCkpIHtcblxuXHRcdFx0Ly8gT25seSByZXN0b3JlIGxhc3Qgdmlld2xldCBpZiB3aW5kb3cgd2FzIHJlbG9hZGVkIG9yIHdlIGFyZSBpbiBkZXZlbG9wbWVudCBtb2RlXG5cdFx0XHRsZXQgdmlld0NvbnRhaW5lclRvUmVzdG9yZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQhdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuaXNCdWlsdCB8fFxuXHRcdFx0XHRsaWZlY3ljbGVTZXJ2aWNlLnN0YXJ0dXBLaW5kID09PSBTdGFydHVwS2luZC5SZWxvYWRlZFdpbmRvdyB8fFxuXHRcdFx0XHR0aGlzLmVudmlyb25tZW50U2VydmljZS5pc0V4dGVuc2lvbkRldmVsb3BtZW50ICYmICF0aGlzLmVudmlyb25tZW50U2VydmljZS5leHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJXG5cdFx0XHQpIHtcblx0XHRcdFx0dmlld0NvbnRhaW5lclRvUmVzdG9yZSA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KFNpZGViYXJQYXJ0LmFjdGl2ZVZpZXdsZXRTZXR0aW5nc0tleSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpPy5pZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2aWV3Q29udGFpbmVyVG9SZXN0b3JlID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpPy5pZDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHZpZXdDb250YWluZXJUb1Jlc3RvcmUpIHtcblx0XHRcdFx0dGhpcy5zdGF0ZS5pbml0aWFsaXphdGlvbi52aWV3cy5jb250YWluZXJUb1Jlc3RvcmUuc2lkZUJhciA9IHZpZXdDb250YWluZXJUb1Jlc3RvcmU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnN0YXRlTW9kZWwuc2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5TSURFQkFSX0hJRERFTiwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUGFuZWwgVmlldyBDb250YWluZXIgVG8gUmVzdG9yZVxuXHRcdGlmICh0aGlzLmlzVmlzaWJsZShQYXJ0cy5QQU5FTF9QQVJUKSkge1xuXHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lclRvUmVzdG9yZSA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KFBhbmVsUGFydC5hY3RpdmVQYW5lbFNldHRpbmdzS2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXREZWZhdWx0Vmlld0NvbnRhaW5lcihWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpPy5pZCk7XG5cblx0XHRcdGlmICh2aWV3Q29udGFpbmVyVG9SZXN0b3JlKSB7XG5cdFx0XHRcdHRoaXMuc3RhdGUuaW5pdGlhbGl6YXRpb24udmlld3MuY29udGFpbmVyVG9SZXN0b3JlLnBhbmVsID0gdmlld0NvbnRhaW5lclRvUmVzdG9yZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX0hJRERFTiwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQXV4aWxpYXJ5IFZpZXcgdG8gcmVzdG9yZVxuXHRcdGlmICh0aGlzLmlzVmlzaWJsZShQYXJ0cy5BVVhJTElBUllCQVJfUEFSVCkpIHtcblx0XHRcdGNvbnN0IHZpZXdDb250YWluZXJUb1Jlc3RvcmUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChBdXhpbGlhcnlCYXJQYXJ0LmFjdGl2ZVZpZXdTZXR0aW5nc0tleSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIoVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcik/LmlkKTtcblx0XHRcdGlmICh2aWV3Q29udGFpbmVyVG9SZXN0b3JlKSB7XG5cdFx0XHRcdHRoaXMuc3RhdGUuaW5pdGlhbGl6YXRpb24udmlld3MuY29udGFpbmVyVG9SZXN0b3JlLmF1eGlsaWFyeUJhciA9IHZpZXdDb250YWluZXJUb1Jlc3RvcmU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnN0YXRlTW9kZWwuc2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5BVVhJTElBUllCQVJfSElEREVOLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBXaW5kb3cgYm9yZGVyXG5cdFx0dGhpcy51cGRhdGVXaW5kb3dzQm9yZGVyKHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREZWZhdWx0TGF5b3V0Vmlld3MoZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSwgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSk6IHN0cmluZ1tdIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBkZWZhdWx0TGF5b3V0ID0gZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/LmRlZmF1bHRMYXlvdXQ7XG5cdFx0aWYgKCFkZWZhdWx0TGF5b3V0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICghZGVmYXVsdExheW91dC5mb3JjZSAmJiAhc3RvcmFnZVNlcnZpY2UuaXNOZXcoU3RvcmFnZVNjb3BlLldPUktTUEFDRSkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyB2aWV3cyB9ID0gZGVmYXVsdExheW91dDtcblx0XHRpZiAodmlld3M/Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHZpZXdzLm1hcCh2aWV3ID0+IHZpZXcuaWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZFJlc3RvcmVFZGl0b3JzKGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIGluaXRpYWxFZGl0b3JzU3RhdGU6IElJbml0aWFsRWRpdG9yc1N0YXRlIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG5cblx0XHQvLyBSZXN0b3JlIGVkaXRvcnMgYmFzZWQgb24gYSBzZXQgb2YgcnVsZXM6XG5cdFx0Ly8gLSBuZXZlciB3aGVuIHJ1bm5pbmcgb24gdGVtcG9yYXJ5IHdvcmtzcGFjZVxuXHRcdC8vIC0gbm90IHdoZW4gd2UgaGF2ZSBmaWxlcyB0byBvcGVuLCB1bmxlc3M6XG5cdFx0Ly8gLSBhbHdheXMgd2hlbiBgd2luZG93LnJlc3RvcmVXaW5kb3dzOiBwcmVzZXJ2ZWBcblxuXHRcdGlmIChpc1RlbXBvcmFyeVdvcmtzcGFjZShjb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBmb3JjZVJlc3RvcmVFZGl0b3JzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KCd3aW5kb3cucmVzdG9yZVdpbmRvd3MnKSA9PT0gJ3ByZXNlcnZlJztcblx0XHRyZXR1cm4gISFmb3JjZVJlc3RvcmVFZGl0b3JzIHx8IGluaXRpYWxFZGl0b3JzU3RhdGUgPT09IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByb3RlY3RlZCB3aWxsUmVzdG9yZUVkaXRvcnMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuc3RhdGUuaW5pdGlhbGl6YXRpb24uZWRpdG9yLnJlc3RvcmVFZGl0b3JzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlRWRpdG9yc1RvT3BlbihmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLCBpbml0aWFsRWRpdG9yc1N0YXRlOiBJSW5pdGlhbEVkaXRvcnNTdGF0ZSB8IHVuZGVmaW5lZCk6IFByb21pc2U8SUVkaXRvclRvT3BlbltdPiB7XG5cdFx0aWYgKGluaXRpYWxFZGl0b3JzU3RhdGUpIHtcblxuXHRcdFx0Ly8gTWVyZ2UgZWRpdG9yIChzaW5nbGUpXG5cdFx0XHRjb25zdCBmaWxlc1RvTWVyZ2UgPSBjb2FsZXNjZShhd2FpdCBwYXRoc1RvRWRpdG9ycyhpbml0aWFsRWRpdG9yc1N0YXRlLmZpbGVzVG9NZXJnZSwgZmlsZVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSkpO1xuXHRcdFx0aWYgKGZpbGVzVG9NZXJnZS5sZW5ndGggPT09IDQgJiYgaXNSZXNvdXJjZUVkaXRvcklucHV0KGZpbGVzVG9NZXJnZVswXSkgJiYgaXNSZXNvdXJjZUVkaXRvcklucHV0KGZpbGVzVG9NZXJnZVsxXSkgJiYgaXNSZXNvdXJjZUVkaXRvcklucHV0KGZpbGVzVG9NZXJnZVsyXSkgJiYgaXNSZXNvdXJjZUVkaXRvcklucHV0KGZpbGVzVG9NZXJnZVszXSkpIHtcblx0XHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdFx0XHRpbnB1dDE6IHsgcmVzb3VyY2U6IGZpbGVzVG9NZXJnZVswXS5yZXNvdXJjZSB9LFxuXHRcdFx0XHRcdFx0aW5wdXQyOiB7IHJlc291cmNlOiBmaWxlc1RvTWVyZ2VbMV0ucmVzb3VyY2UgfSxcblx0XHRcdFx0XHRcdGJhc2U6IHsgcmVzb3VyY2U6IGZpbGVzVG9NZXJnZVsyXS5yZXNvdXJjZSB9LFxuXHRcdFx0XHRcdFx0cmVzdWx0OiB7IHJlc291cmNlOiBmaWxlc1RvTWVyZ2VbM10ucmVzb3VyY2UgfSxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBEaWZmIGVkaXRvciAoc2luZ2xlKVxuXHRcdFx0Y29uc3QgZmlsZXNUb0RpZmYgPSBjb2FsZXNjZShhd2FpdCBwYXRoc1RvRWRpdG9ycyhpbml0aWFsRWRpdG9yc1N0YXRlLmZpbGVzVG9EaWZmLCBmaWxlU2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlKSk7XG5cdFx0XHRpZiAoZmlsZXNUb0RpZmYubGVuZ3RoID09PSAyKSB7XG5cdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdGVkaXRvcjoge1xuXHRcdFx0XHRcdFx0b3JpZ2luYWw6IHsgcmVzb3VyY2U6IGZpbGVzVG9EaWZmWzBdLnJlc291cmNlIH0sXG5cdFx0XHRcdFx0XHRtb2RpZmllZDogeyByZXNvdXJjZTogZmlsZXNUb0RpZmZbMV0ucmVzb3VyY2UgfSxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBOb3JtYWwgZWRpdG9yIChtdWx0aXBsZSlcblx0XHRcdGNvbnN0IGZpbGVzVG9PcGVuT3JDcmVhdGU6IElFZGl0b3JUb09wZW5bXSA9IFtdO1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRGaWxlc1RvT3Blbk9yQ3JlYXRlID0gYXdhaXQgcGF0aHNUb0VkaXRvcnMoaW5pdGlhbEVkaXRvcnNTdGF0ZS5maWxlc1RvT3Blbk9yQ3JlYXRlLCBmaWxlU2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcmVzb2x2ZWRGaWxlc1RvT3Blbk9yQ3JlYXRlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IHJlc29sdmVkRmlsZVRvT3Blbk9yQ3JlYXRlID0gcmVzb2x2ZWRGaWxlc1RvT3Blbk9yQ3JlYXRlW2ldO1xuXHRcdFx0XHRpZiAocmVzb2x2ZWRGaWxlVG9PcGVuT3JDcmVhdGUpIHtcblx0XHRcdFx0XHRmaWxlc1RvT3Blbk9yQ3JlYXRlLnB1c2goe1xuXHRcdFx0XHRcdFx0ZWRpdG9yOiByZXNvbHZlZEZpbGVUb09wZW5PckNyZWF0ZSxcblx0XHRcdFx0XHRcdHZpZXdDb2x1bW46IGluaXRpYWxFZGl0b3JzU3RhdGUuZmlsZXNUb09wZW5PckNyZWF0ZT8uW2ldLnZpZXdDb2x1bW4gLy8gdGFrZSBvdmVyIGB2aWV3Q29sdW1uYCBmcm9tIGluaXRpYWwgc3RhdGVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmlsZXNUb09wZW5PckNyZWF0ZTtcblx0XHR9XG5cblx0XHQvLyBFbXB0eSB3b3JrYmVuY2ggY29uZmlndXJlZCB0byBvcGVuIHVudGl0bGVkIGZpbGUgaWYgZW1wdHlcblx0XHRlbHNlIGlmICh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3dvcmtiZW5jaC5zdGFydHVwRWRpdG9yJykgPT09ICduZXdVbnRpdGxlZEZpbGUnKSB7XG5cdFx0XHRpZiAodGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuaGFzUmVzdG9yYWJsZVN0YXRlKSB7XG5cdFx0XHRcdHJldHVybiBbXTsgLy8gZG8gbm90IG9wZW4gYW55IGVtcHR5IHVudGl0bGVkIGZpbGUgaWYgd2UgcmVzdG9yZWQgZ3JvdXBzL2VkaXRvcnMgZnJvbSBwcmV2aW91cyBzZXNzaW9uXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGhhc0JhY2t1cHMgPSBhd2FpdCB0aGlzLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5oYXNCYWNrdXBzKCk7XG5cdFx0XHRpZiAoaGFzQmFja3Vwcykge1xuXHRcdFx0XHRyZXR1cm4gW107IC8vIGRvIG5vdCBvcGVuIGFueSBlbXB0eSB1bnRpdGxlZCBmaWxlIGlmIHdlIGhhdmUgYmFja3VwcyB0byByZXN0b3JlXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRlZGl0b3I6IHsgcmVzb3VyY2U6IHVuZGVmaW5lZCB9IC8vIG9wZW4gZW1wdHkgdW50aXRsZWQgZmlsZVxuXHRcdFx0fV07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0cHJpdmF0ZSBfb3BlbmVkRGVmYXVsdEVkaXRvcnM6IGJvb2xlYW4gPSBmYWxzZTtcblx0Z2V0IG9wZW5lZERlZmF1bHRFZGl0b3JzKCkgeyByZXR1cm4gdGhpcy5fb3BlbmVkRGVmYXVsdEVkaXRvcnM7IH1cblxuXHRwcml2YXRlIGdldEluaXRpYWxFZGl0b3JzU3RhdGUoKTogSUluaXRpYWxFZGl0b3JzU3RhdGUgfCB1bmRlZmluZWQge1xuXG5cdFx0Ly8gQ2hlY2sgZm9yIGVkaXRvcnMgLyBlZGl0b3IgbGF5b3V0IGZyb20gYGRlZmF1bHRMYXlvdXRgIG9wdGlvbnMgZmlyc3Rcblx0XHRjb25zdCBkZWZhdWx0TGF5b3V0ID0gdGhpcy5lbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8uZGVmYXVsdExheW91dDtcblx0XHRpZiAoKGRlZmF1bHRMYXlvdXQ/LmVkaXRvcnM/Lmxlbmd0aCB8fCBkZWZhdWx0TGF5b3V0Py5sYXlvdXQ/LmVkaXRvcnMpICYmIChkZWZhdWx0TGF5b3V0LmZvcmNlIHx8IHRoaXMuc3RvcmFnZVNlcnZpY2UuaXNOZXcoU3RvcmFnZVNjb3BlLldPUktTUEFDRSkpKSB7XG5cdFx0XHR0aGlzLl9vcGVuZWREZWZhdWx0RWRpdG9ycyA9IHRydWU7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxheW91dDogZGVmYXVsdExheW91dC5sYXlvdXQ/LmVkaXRvcnMsXG5cdFx0XHRcdGZpbGVzVG9PcGVuT3JDcmVhdGU6IGRlZmF1bHRMYXlvdXQ/LmVkaXRvcnM/Lm1hcChlZGl0b3IgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHR2aWV3Q29sdW1uOiBlZGl0b3Iudmlld0NvbHVtbixcblx0XHRcdFx0XHRcdGZpbGVVcmk6IFVSSS5yZXZpdmUoZWRpdG9yLnVyaSksXG5cdFx0XHRcdFx0XHRvcGVuT25seUlmRXhpc3RzOiBlZGl0b3Iub3Blbk9ubHlJZkV4aXN0cyxcblx0XHRcdFx0XHRcdG9wdGlvbnM6IGVkaXRvci5vcHRpb25zXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSlcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gVGhlbiBjaGVjayBmb3IgZmlsZXMgdG8gb3BlbiwgY3JlYXRlIG9yIGRpZmYvbWVyZ2UgZnJvbSBtYWluIHNpZGVcblx0XHRjb25zdCB7IGZpbGVzVG9PcGVuT3JDcmVhdGUsIGZpbGVzVG9EaWZmLCBmaWxlc1RvTWVyZ2UgfSA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlO1xuXHRcdGlmIChmaWxlc1RvT3Blbk9yQ3JlYXRlIHx8IGZpbGVzVG9EaWZmIHx8IGZpbGVzVG9NZXJnZSkge1xuXHRcdFx0cmV0dXJuIHsgZmlsZXNUb09wZW5PckNyZWF0ZSwgZmlsZXNUb0RpZmYsIGZpbGVzVG9NZXJnZSB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHdoZW5SZWFkeVByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdHByb3RlY3RlZCByZWFkb25seSB3aGVuUmVhZHkgPSB0aGlzLndoZW5SZWFkeVByb21pc2UucDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHdoZW5SZXN0b3JlZFByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IHdoZW5SZXN0b3JlZCA9IHRoaXMud2hlblJlc3RvcmVkUHJvbWlzZS5wO1xuXHRwcml2YXRlIHJlc3RvcmVkID0gZmFsc2U7XG5cblx0aXNSZXN0b3JlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5yZXN0b3JlZDtcblx0fVxuXG5cdHByb3RlY3RlZCByZXN0b3JlUGFydHMoKTogdm9pZCB7XG5cblx0XHQvLyBkaXN0aW5ndWlzaCBsb25nIHJ1bm5pbmcgcmVzdG9yZSBvcGVyYXRpb25zIHRoYXRcblx0XHQvLyBhcmUgcmVxdWlyZWQgZm9yIHRoZSBsYXlvdXQgdG8gYmUgcmVhZHkgZnJvbSB0aG9zZVxuXHRcdC8vIHRoYXQgYXJlIG5lZWRlZCB0byBzaWduYWwgcmVzdG9yaW5nIGlzIGRvbmVcblx0XHRjb25zdCBsYXlvdXRSZWFkeVByb21pc2VzOiBQcm9taXNlPHVua25vd24+W10gPSBbXTtcblx0XHRjb25zdCBsYXlvdXRSZXN0b3JlZFByb21pc2VzOiBQcm9taXNlPHVua25vd24+W10gPSBbXTtcblxuXHRcdC8vIFJlc3RvcmUgZWRpdG9yc1xuXHRcdGxheW91dFJlYWR5UHJvbWlzZXMucHVzaCgoYXN5bmMgKCkgPT4ge1xuXHRcdFx0bWFyaygnY29kZS93aWxsUmVzdG9yZUVkaXRvcnMnKTtcblxuXHRcdFx0Ly8gZmlyc3QgZW5zdXJlIHRoZSBlZGl0b3IgcGFydCBpcyByZWFkeVxuXHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uud2hlblJlYWR5O1xuXHRcdFx0bWFyaygnY29kZS9yZXN0b3JlRWRpdG9ycy9lZGl0b3JHcm91cHNSZWFkeScpO1xuXG5cdFx0XHQvLyBhcHBseSBlZGl0b3IgbGF5b3V0IGlmIGFueVxuXHRcdFx0aWYgKHRoaXMuc3RhdGUuaW5pdGlhbGl6YXRpb24ubGF5b3V0Py5lZGl0b3JzKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0LmFwcGx5TGF5b3V0KHRoaXMuc3RhdGUuaW5pdGlhbGl6YXRpb24ubGF5b3V0LmVkaXRvcnMpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB0aGVuIHNlZSBmb3IgZWRpdG9ycyB0byBvcGVuIGFzIGluc3RydWN0ZWRcblx0XHRcdC8vIGl0IGlzIGltcG9ydGFudCB0aGF0IHdlIHRyaWdnZXIgdGhpcyBmcm9tXG5cdFx0XHQvLyB0aGUgb3ZlcmFsbCByZXN0b3JlIGZsb3cgdG8gcmVkdWNlIHBvc3NpYmxlXG5cdFx0XHQvLyBmbGlja2VyIG9uIHN0YXJ0dXA6IHdlIHdhbnQgYW55IGVkaXRvciB0b1xuXHRcdFx0Ly8gb3BlbiB0byBnZXQgYSBjaGFuY2UgdG8gb3BlbiBmaXJzdCBiZWZvcmVcblx0XHRcdC8vIHNpZ25hbGluZyB0aGF0IGxheW91dCBpcyByZXN0b3JlZCwgYnV0IHdlIGRvXG5cdFx0XHQvLyBub3QgbmVlZCB0byBhd2FpdCB0aGUgZWRpdG9ycyBmcm9tIGhhdmluZ1xuXHRcdFx0Ly8gZnVsbHkgbG9hZGVkLlxuXG5cdFx0XHRjb25zdCBlZGl0b3JzID0gYXdhaXQgdGhpcy5zdGF0ZS5pbml0aWFsaXphdGlvbi5lZGl0b3IuZWRpdG9yc1RvT3Blbjtcblx0XHRcdG1hcmsoJ2NvZGUvcmVzdG9yZUVkaXRvcnMvZWRpdG9yc1RvT3BlblJlc29sdmVkJyk7XG5cblx0XHRcdGxldCBvcGVuRWRpdG9yc1Byb21pc2U6IFByb21pc2U8dW5rbm93bj4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoZWRpdG9ycy5sZW5ndGgpIHtcblxuXHRcdFx0XHQvLyB3ZSBoYXZlIHRvIG1hcCBlZGl0b3JzIHRvIHRoZWlyIGdyb3VwcyBhcyBpbnN0cnVjdGVkXG5cdFx0XHRcdC8vIGJ5IHRoZSBpbnB1dC4gdGhpcyBpcyBpbXBvcnRhbnQgdG8gZW5zdXJlIHRoYXQgd2Ugb3BlblxuXHRcdFx0XHQvLyB0aGUgZWRpdG9ycyBpbiB0aGUgZ3JvdXBzIHRoZXkgYmVsb25nIHRvLlxuXG5cdFx0XHRcdGNvbnN0IGVkaXRvckdyb3Vwc0luVmlzdWFsT3JkZXIgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5tYWluUGFydC5nZXRHcm91cHMoR3JvdXBzT3JkZXIuR1JJRF9BUFBFQVJBTkNFKTtcblx0XHRcdFx0Y29uc3QgbWFwRWRpdG9yc1RvR3JvdXAgPSBuZXcgTWFwPEdyb3VwSWRlbnRpZmllciwgU2V0PElVbnR5cGVkRWRpdG9ySW5wdXQ+PigpO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIGVkaXRvcnMpIHtcblx0XHRcdFx0XHRjb25zdCBncm91cCA9IGVkaXRvckdyb3Vwc0luVmlzdWFsT3JkZXJbKGVkaXRvci52aWV3Q29sdW1uID8/IDEpIC0gMV07IC8vIHZpZXdDb2x1bW4gaXMgaW5kZXgrMSBiYXNlZFxuXG5cdFx0XHRcdFx0bGV0IGVkaXRvcnNCeUdyb3VwID0gbWFwRWRpdG9yc1RvR3JvdXAuZ2V0KGdyb3VwLmlkKTtcblx0XHRcdFx0XHRpZiAoIWVkaXRvcnNCeUdyb3VwKSB7XG5cdFx0XHRcdFx0XHRlZGl0b3JzQnlHcm91cCA9IG5ldyBTZXQ8SVVudHlwZWRFZGl0b3JJbnB1dD4oKTtcblx0XHRcdFx0XHRcdG1hcEVkaXRvcnNUb0dyb3VwLnNldChncm91cC5pZCwgZWRpdG9yc0J5R3JvdXApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGVkaXRvcnNCeUdyb3VwLmFkZChlZGl0b3IuZWRpdG9yKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG9wZW5FZGl0b3JzUHJvbWlzZSA9IFByb21pc2UuYWxsKEFycmF5LmZyb20obWFwRWRpdG9yc1RvR3JvdXApLm1hcChhc3luYyAoW2dyb3VwSWQsIGVkaXRvcnNdKSA9PiB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9ycyhBcnJheS5mcm9tKGVkaXRvcnMpLCBncm91cElkLCB7IHZhbGlkYXRlVHJ1c3Q6IHRydWUgfSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGRvIG5vdCBibG9jayB0aGUgb3ZlcmFsbCBsYXlvdXQgcmVhZHkgZmxvdyBmcm9tIHBvdGVudGlhbGx5XG5cdFx0XHQvLyBzbG93IGVkaXRvcnMgdG8gcmVzb2x2ZSBvbiBzdGFydHVwXG5cdFx0XHRsYXlvdXRSZXN0b3JlZFByb21pc2VzLnB1c2goXG5cdFx0XHRcdFByb21pc2UuYWxsKFtcblx0XHRcdFx0XHRvcGVuRWRpdG9yc1Byb21pc2U/LmZpbmFsbHkoKCkgPT4gbWFyaygnY29kZS9yZXN0b3JlRWRpdG9ycy9lZGl0b3JzT3BlbmVkJykpLFxuXHRcdFx0XHRcdHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLndoZW5SZXN0b3JlZC5maW5hbGx5KCgpID0+IG1hcmsoJ2NvZGUvcmVzdG9yZUVkaXRvcnMvZWRpdG9yR3JvdXBzUmVzdG9yZWQnKSlcblx0XHRcdFx0XSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdFx0Ly8gdGhlIGBjb2RlL2RpZFJlc3RvcmVFZGl0b3JzYCBwZXJmIG1hcmsgaXMgc3BlY2lmaWNhbGx5XG5cdFx0XHRcdFx0Ly8gZm9yIHdoZW4gdmlzaWJsZSBlZGl0b3JzIGhhdmUgcmVzb2x2ZWQsIHNvIHdlIG9ubHkgbWFya1xuXHRcdFx0XHRcdC8vIGlmIHdoZW4gZWRpdG9yIGdyb3VwIHNlcnZpY2UgaGFzIHJlc3RvcmVkLlxuXHRcdFx0XHRcdG1hcmsoJ2NvZGUvZGlkUmVzdG9yZUVkaXRvcnMnKTtcblx0XHRcdFx0fSlcblx0XHRcdCk7XG5cdFx0fSkoKSk7XG5cblx0XHQvLyBSZXN0b3JlIGRlZmF1bHQgdmlld3MgKG9ubHkgd2hlbiBgSURlZmF1bHRMYXlvdXRgIGlzIHByb3ZpZGVkKVxuXHRcdGNvbnN0IHJlc3RvcmVEZWZhdWx0Vmlld3NQcm9taXNlID0gKGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLnN0YXRlLmluaXRpYWxpemF0aW9uLnZpZXdzLmRlZmF1bHRzPy5sZW5ndGgpIHtcblx0XHRcdFx0bWFyaygnY29kZS93aWxsT3BlbkRlZmF1bHRWaWV3cycpO1xuXG5cdFx0XHRcdGNvbnN0IGxvY2F0aW9uc1Jlc3RvcmVkOiB7IGlkOiBzdHJpbmc7IG9yZGVyOiBudW1iZXIgfVtdID0gW107XG5cblx0XHRcdFx0Y29uc3QgdHJ5T3BlblZpZXcgPSAodmlldzogeyBpZDogc3RyaW5nOyBvcmRlcjogbnVtYmVyIH0pOiBib29sZWFuID0+IHtcblx0XHRcdFx0XHRjb25zdCBsb2NhdGlvbiA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdMb2NhdGlvbkJ5SWQodmlldy5pZCk7XG5cdFx0XHRcdFx0aWYgKGxvY2F0aW9uICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodmlldy5pZCk7XG5cdFx0XHRcdFx0XHRpZiAoY29udGFpbmVyKSB7XG5cdFx0XHRcdFx0XHRcdGlmICh2aWV3Lm9yZGVyID49IChsb2NhdGlvbnNSZXN0b3JlZD8uW2xvY2F0aW9uXT8ub3JkZXIgPz8gMCkpIHtcblx0XHRcdFx0XHRcdFx0XHRsb2NhdGlvbnNSZXN0b3JlZFtsb2NhdGlvbl0gPSB7IGlkOiBjb250YWluZXIuaWQsIG9yZGVyOiB2aWV3Lm9yZGVyIH07XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRjb25zdCBjb250YWluZXJNb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXHRcdFx0XHRcdFx0XHRjb250YWluZXJNb2RlbC5zZXRDb2xsYXBzZWQodmlldy5pZCwgZmFsc2UpO1xuXHRcdFx0XHRcdFx0XHRjb250YWluZXJNb2RlbC5zZXRWaXNpYmxlKHZpZXcuaWQsIHRydWUpO1xuXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRjb25zdCBkZWZhdWx0Vmlld3MgPSBbLi4udGhpcy5zdGF0ZS5pbml0aWFsaXphdGlvbi52aWV3cy5kZWZhdWx0c10ucmV2ZXJzZSgpLm1hcCgodiwgaW5kZXgpID0+ICh7IGlkOiB2LCBvcmRlcjogaW5kZXggfSkpO1xuXG5cdFx0XHRcdGxldCBpID0gZGVmYXVsdFZpZXdzLmxlbmd0aDtcblx0XHRcdFx0d2hpbGUgKGkpIHtcblx0XHRcdFx0XHRpLS07XG5cdFx0XHRcdFx0aWYgKHRyeU9wZW5WaWV3KGRlZmF1bHRWaWV3c1tpXSkpIHtcblx0XHRcdFx0XHRcdGRlZmF1bHRWaWV3cy5zcGxpY2UoaSwgMSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSWYgd2Ugc3RpbGwgaGF2ZSB2aWV3cyBsZWZ0IG92ZXIsIHdhaXQgdW50aWwgYWxsIGV4dGVuc2lvbnMgaGF2ZSBiZWVuIHJlZ2lzdGVyZWQgYW5kIHRyeSBhZ2FpblxuXHRcdFx0XHRpZiAoZGVmYXVsdFZpZXdzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKTtcblxuXHRcdFx0XHRcdGxldCBpID0gZGVmYXVsdFZpZXdzLmxlbmd0aDtcblx0XHRcdFx0XHR3aGlsZSAoaSkge1xuXHRcdFx0XHRcdFx0aS0tO1xuXHRcdFx0XHRcdFx0aWYgKHRyeU9wZW5WaWV3KGRlZmF1bHRWaWV3c1tpXSkpIHtcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdFZpZXdzLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJZiB3ZSBvcGVuZWQgYSB2aWV3IGluIHRoZSBzaWRlYmFyLCBzdG9wIGFueSByZXN0b3JlIHRoZXJlXG5cdFx0XHRcdGlmIChsb2NhdGlvbnNSZXN0b3JlZFtWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcl0pIHtcblx0XHRcdFx0XHR0aGlzLnN0YXRlLmluaXRpYWxpemF0aW9uLnZpZXdzLmNvbnRhaW5lclRvUmVzdG9yZS5zaWRlQmFyID0gbG9jYXRpb25zUmVzdG9yZWRbVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXJdLmlkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSWYgd2Ugb3BlbmVkIGEgdmlldyBpbiB0aGUgcGFuZWwsIHN0b3AgYW55IHJlc3RvcmUgdGhlcmVcblx0XHRcdFx0aWYgKGxvY2F0aW9uc1Jlc3RvcmVkW1ZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbF0pIHtcblx0XHRcdFx0XHR0aGlzLnN0YXRlLmluaXRpYWxpemF0aW9uLnZpZXdzLmNvbnRhaW5lclRvUmVzdG9yZS5wYW5lbCA9IGxvY2F0aW9uc1Jlc3RvcmVkW1ZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbF0uaWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBJZiB3ZSBvcGVuZWQgYSB2aWV3IGluIHRoZSBhdXhpbGlhcnkgYmFyLCBzdG9wIGFueSByZXN0b3JlIHRoZXJlXG5cdFx0XHRcdGlmIChsb2NhdGlvbnNSZXN0b3JlZFtWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyXSkge1xuXHRcdFx0XHRcdHRoaXMuc3RhdGUuaW5pdGlhbGl6YXRpb24udmlld3MuY29udGFpbmVyVG9SZXN0b3JlLmF1eGlsaWFyeUJhciA9IGxvY2F0aW9uc1Jlc3RvcmVkW1ZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXJdLmlkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bWFyaygnY29kZS9kaWRPcGVuRGVmYXVsdFZpZXdzJyk7XG5cdFx0XHR9XG5cdFx0fSkoKTtcblx0XHRsYXlvdXRSZWFkeVByb21pc2VzLnB1c2gocmVzdG9yZURlZmF1bHRWaWV3c1Byb21pc2UpO1xuXG5cdFx0Ly8gUmVzdG9yZSBTaWRlYmFyXG5cdFx0bGF5b3V0UmVhZHlQcm9taXNlcy5wdXNoKChhc3luYyAoKSA9PiB7XG5cblx0XHRcdC8vIFJlc3RvcmluZyB2aWV3cyBjb3VsZCBtZWFuIHRoYXQgc2lkZWJhciBhbHJlYWR5XG5cdFx0XHQvLyByZXN0b3JlZCwgYXMgc3VjaCB3ZSBuZWVkIHRvIHRlc3QgYWdhaW5cblx0XHRcdGF3YWl0IHJlc3RvcmVEZWZhdWx0Vmlld3NQcm9taXNlO1xuXHRcdFx0aWYgKCF0aGlzLnN0YXRlLmluaXRpYWxpemF0aW9uLnZpZXdzLmNvbnRhaW5lclRvUmVzdG9yZS5zaWRlQmFyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bWFyaygnY29kZS93aWxsUmVzdG9yZVZpZXdsZXQnKTtcblxuXHRcdFx0Y29uc3Qgdmlld2xldCA9IGF3YWl0IHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2Uub3BlblBhbmVDb21wb3NpdGUodGhpcy5zdGF0ZS5pbml0aWFsaXphdGlvbi52aWV3cy5jb250YWluZXJUb1Jlc3RvcmUuc2lkZUJhciwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdFx0aWYgKCF2aWV3bGV0KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2Uub3BlblBhbmVDb21wb3NpdGUodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpPy5pZCwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpOyAvLyBmYWxsYmFjayB0byBkZWZhdWx0IHZpZXdsZXQgYXMgbmVlZGVkXG5cdFx0XHR9XG5cblx0XHRcdG1hcmsoJ2NvZGUvZGlkUmVzdG9yZVZpZXdsZXQnKTtcblx0XHR9KSgpKTtcblxuXHRcdC8vIFJlc3RvcmUgUGFuZWxcblx0XHRsYXlvdXRSZWFkeVByb21pc2VzLnB1c2goKGFzeW5jICgpID0+IHtcblxuXHRcdFx0Ly8gUmVzdG9yaW5nIHZpZXdzIGNvdWxkIG1lYW4gdGhhdCBwYW5lbCBhbHJlYWR5XG5cdFx0XHQvLyByZXN0b3JlZCwgYXMgc3VjaCB3ZSBuZWVkIHRvIHRlc3QgYWdhaW5cblx0XHRcdGF3YWl0IHJlc3RvcmVEZWZhdWx0Vmlld3NQcm9taXNlO1xuXHRcdFx0aWYgKCF0aGlzLnN0YXRlLmluaXRpYWxpemF0aW9uLnZpZXdzLmNvbnRhaW5lclRvUmVzdG9yZS5wYW5lbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdG1hcmsoJ2NvZGUvd2lsbFJlc3RvcmVQYW5lbCcpO1xuXG5cdFx0XHRjb25zdCBwYW5lbCA9IGF3YWl0IHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2Uub3BlblBhbmVDb21wb3NpdGUodGhpcy5zdGF0ZS5pbml0aWFsaXphdGlvbi52aWV3cy5jb250YWluZXJUb1Jlc3RvcmUucGFuZWwsIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk7XG5cdFx0XHRpZiAoIXBhbmVsKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2Uub3BlblBhbmVDb21wb3NpdGUodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIoVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKT8uaWQsIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk7IC8vIGZhbGxiYWNrIHRvIGRlZmF1bHQgcGFuZWwgYXMgbmVlZGVkXG5cdFx0XHR9XG5cblx0XHRcdG1hcmsoJ2NvZGUvZGlkUmVzdG9yZVBhbmVsJyk7XG5cdFx0fSkoKSk7XG5cblx0XHQvLyBSZXN0b3JlIEF1eGlsaWFyeSBCYXJcblx0XHRsYXlvdXRSZWFkeVByb21pc2VzLnB1c2goKGFzeW5jICgpID0+IHtcblxuXHRcdFx0Ly8gUmVzdG9yaW5nIHZpZXdzIGNvdWxkIG1lYW4gdGhhdCBhdXhiYXIgYWxyZWFkeVxuXHRcdFx0Ly8gcmVzdG9yZWQsIGFzIHN1Y2ggd2UgbmVlZCB0byB0ZXN0IGFnYWluXG5cdFx0XHRhd2FpdCByZXN0b3JlRGVmYXVsdFZpZXdzUHJvbWlzZTtcblx0XHRcdGlmICghdGhpcy5zdGF0ZS5pbml0aWFsaXphdGlvbi52aWV3cy5jb250YWluZXJUb1Jlc3RvcmUuYXV4aWxpYXJ5QmFyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bWFyaygnY29kZS93aWxsUmVzdG9yZUF1eGlsaWFyeUJhcicpO1xuXG5cdFx0XHRjb25zdCB2aWV3bGV0ID0gYXdhaXQgdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZSh0aGlzLnN0YXRlLmluaXRpYWxpemF0aW9uLnZpZXdzLmNvbnRhaW5lclRvUmVzdG9yZS5hdXhpbGlhcnlCYXIsIFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIpO1xuXHRcdFx0aWYgKCF2aWV3bGV0KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2Uub3BlblBhbmVDb21wb3NpdGUodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIoVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcik/LmlkLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKTsgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCB2aWV3bGV0IGFzIG5lZWRlZFxuXHRcdFx0fVxuXG5cdFx0XHRtYXJrKCdjb2RlL2RpZFJlc3RvcmVBdXhpbGlhcnlCYXInKTtcblx0XHR9KSgpKTtcblxuXHRcdC8vIFJlc3RvcmUgWmVuIE1vZGVcblx0XHRjb25zdCB6ZW5Nb2RlV2FzQWN0aXZlID0gdGhpcy5pc1plbk1vZGVBY3RpdmUoKTtcblx0XHRjb25zdCByZXN0b3JlWmVuTW9kZSA9IGdldFplbk1vZGVDb25maWd1cmF0aW9uKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpLnJlc3RvcmU7XG5cblx0XHRpZiAoemVuTW9kZVdhc0FjdGl2ZSkge1xuXHRcdFx0dGhpcy5zZXRaZW5Nb2RlQWN0aXZlKCFyZXN0b3JlWmVuTW9kZSk7XG5cdFx0XHR0aGlzLnRvZ2dsZVplbk1vZGUoZmFsc2UsIHRydWUpO1xuXHRcdH1cblxuXHRcdC8vIFJlc3RvcmUgTWFpbiBFZGl0b3IgQ2VudGVyIE1vZGVcblx0XHRpZiAodGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuTUFJTl9FRElUT1JfQ0VOVEVSRUQpKSB7XG5cdFx0XHR0aGlzLmNlbnRlck1haW5FZGl0b3JMYXlvdXQodHJ1ZSwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0Ly8gQXdhaXQgZm9yIHByb21pc2VzIHRoYXQgd2UgcmVjb3JkZWQgdG8gdXBkYXRlXG5cdFx0Ly8gb3VyIHJlYWR5IGFuZCByZXN0b3JlZCBzdGF0ZXMgcHJvcGVybHkuXG5cdFx0UHJvbWlzZXMuc2V0dGxlZChsYXlvdXRSZWFkeVByb21pc2VzKS5maW5hbGx5KCgpID0+IHtcblx0XHRcdHRoaXMud2hlblJlYWR5UHJvbWlzZS5jb21wbGV0ZSgpO1xuXG5cdFx0XHRQcm9taXNlcy5zZXR0bGVkKGxheW91dFJlc3RvcmVkUHJvbWlzZXMpLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnJlc3RvcmVkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy53aGVuUmVzdG9yZWRQcm9taXNlLmNvbXBsZXRlKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHJlZ2lzdGVyUGFydChwYXJ0OiBQYXJ0KTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGlkID0gcGFydC5nZXRJZCgpO1xuXHRcdHRoaXMucGFydHMuc2V0KGlkLCBwYXJ0KTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5wYXJ0cy5kZWxldGUoaWQpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRQYXJ0KGtleTogUGFydHMpOiBQYXJ0IHtcblx0XHRjb25zdCBwYXJ0ID0gdGhpcy5wYXJ0cy5nZXQoa2V5KTtcblx0XHRpZiAoIXBhcnQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biBwYXJ0ICR7a2V5fWApO1xuXHRcdH1cblxuXHRcdHJldHVybiBwYXJ0O1xuXHR9XG5cblx0cmVnaXN0ZXJOb3RpZmljYXRpb25zKGRlbGVnYXRlOiB7IG9uRGlkQ2hhbmdlTm90aWZpY2F0aW9uc1Zpc2liaWxpdHk6IEV2ZW50PGJvb2xlYW4+IH0pOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RlcihkZWxlZ2F0ZS5vbkRpZENoYW5nZU5vdGlmaWNhdGlvbnNWaXNpYmlsaXR5KHZpc2libGUgPT4gdGhpcy5fb25EaWRDaGFuZ2VOb3RpZmljYXRpb25zVmlzaWJpbGl0eS5maXJlKHZpc2libGUpKSk7XG5cdH1cblxuXHRoYXNGb2N1cyhwYXJ0OiBQYXJ0cyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuZ2V0Q29udGFpbmVyKGdldEFjdGl2ZVdpbmRvdygpLCBwYXJ0KTtcblx0XHRpZiAoIWNvbnRhaW5lcikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZUVsZW1lbnQgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cdFx0aWYgKCFhY3RpdmVFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGlzQW5jZXN0b3JVc2luZ0Zsb3dUbyhhY3RpdmVFbGVtZW50LCBjb250YWluZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Rm9jdXNlZFBhcnQoKTogUGFydHMgfCB1bmRlZmluZWQge1xuXHRcdGZvciAoY29uc3QgcGFydCBvZiB0aGlzLnBhcnRzLmtleXMoKSkge1xuXHRcdFx0aWYgKHRoaXMuaGFzRm9jdXMocGFydCBhcyBQYXJ0cykpIHtcblx0XHRcdFx0cmV0dXJuIHBhcnQgYXMgUGFydHM7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGZvY3VzUGFydChwYXJ0OiBNVUxUSV9XSU5ET1dfUEFSVFMsIHRhcmdldFdpbmRvdzogV2luZG93KTogdm9pZDtcblx0Zm9jdXNQYXJ0KHBhcnQ6IFNJTkdMRV9XSU5ET1dfUEFSVFMpOiB2b2lkO1xuXHRmb2N1c1BhcnQocGFydDogUGFydHMsIHRhcmdldFdpbmRvdzogV2luZG93ID0gbWFpbldpbmRvdyk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuZ2V0Q29udGFpbmVyKHRhcmdldFdpbmRvdywgcGFydCkgPz8gdGhpcy5tYWluQ29udGFpbmVyO1xuXG5cdFx0c3dpdGNoIChwYXJ0KSB7XG5cdFx0XHRjYXNlIFBhcnRzLkVESVRPUl9QQVJUOlxuXHRcdFx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS5nZXRQYXJ0KGNvbnRhaW5lcikuYWN0aXZlR3JvdXAuZm9jdXMoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFBhcnRzLlBBTkVMX1BBUlQ6IHtcblx0XHRcdFx0dGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk/LmZvY3VzKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBQYXJ0cy5TSURFQkFSX1BBUlQ6IHtcblx0XHRcdFx0dGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKT8uZm9jdXMoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFBhcnRzLkFVWElMSUFSWUJBUl9QQVJUOiB7XG5cdFx0XHRcdHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZShWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKT8uZm9jdXMoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFBhcnRzLkFDVElWSVRZQkFSX1BBUlQ6XG5cdFx0XHRcdCh0aGlzLmdldFBhcnQoUGFydHMuU0lERUJBUl9QQVJUKSBhcyBTaWRlYmFyUGFydCkuZm9jdXNBY3Rpdml0eUJhcigpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUGFydHMuU1RBVFVTQkFSX1BBUlQ6XG5cdFx0XHRcdHRoaXMuc3RhdHVzQmFyU2VydmljZS5nZXRQYXJ0KGNvbnRhaW5lcikuZm9jdXMoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdGNvbnRhaW5lcj8uZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRDb250YWluZXIodGFyZ2V0V2luZG93OiBXaW5kb3cpOiBIVE1MRWxlbWVudDtcblx0Z2V0Q29udGFpbmVyKHRhcmdldFdpbmRvdzogV2luZG93LCBwYXJ0OiBQYXJ0cyk6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRnZXRDb250YWluZXIodGFyZ2V0V2luZG93OiBXaW5kb3csIHBhcnQ/OiBQYXJ0cyk6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodHlwZW9mIHBhcnQgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRDb250YWluZXJGcm9tRG9jdW1lbnQodGFyZ2V0V2luZG93LmRvY3VtZW50KTtcblx0XHR9XG5cblx0XHRpZiAodGFyZ2V0V2luZG93ID09PSBtYWluV2luZG93KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRQYXJ0KHBhcnQpLmdldENvbnRhaW5lcigpO1xuXHRcdH1cblxuXHRcdC8vIE9ubHkgc29tZSBwYXJ0cyBhcmUgc3VwcG9ydGVkIGZvciBhdXhpbGlhcnkgd2luZG93c1xuXHRcdGxldCBwYXJ0Q2FuZGlkYXRlOiB1bmtub3duO1xuXHRcdGlmIChwYXJ0ID09PSBQYXJ0cy5FRElUT1JfUEFSVCkge1xuXHRcdFx0cGFydENhbmRpZGF0ZSA9IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdldFBhcnQodGhpcy5nZXRDb250YWluZXJGcm9tRG9jdW1lbnQodGFyZ2V0V2luZG93LmRvY3VtZW50KSk7XG5cdFx0fSBlbHNlIGlmIChwYXJ0ID09PSBQYXJ0cy5TVEFUVVNCQVJfUEFSVCkge1xuXHRcdFx0cGFydENhbmRpZGF0ZSA9IHRoaXMuc3RhdHVzQmFyU2VydmljZS5nZXRQYXJ0KHRoaXMuZ2V0Q29udGFpbmVyRnJvbURvY3VtZW50KHRhcmdldFdpbmRvdy5kb2N1bWVudCkpO1xuXHRcdH0gZWxzZSBpZiAocGFydCA9PT0gUGFydHMuVElUTEVCQVJfUEFSVCkge1xuXHRcdFx0cGFydENhbmRpZGF0ZSA9IHRoaXMudGl0bGVTZXJ2aWNlLmdldFBhcnQodGhpcy5nZXRDb250YWluZXJGcm9tRG9jdW1lbnQodGFyZ2V0V2luZG93LmRvY3VtZW50KSk7XG5cdFx0fVxuXG5cdFx0aWYgKHBhcnRDYW5kaWRhdGUgaW5zdGFuY2VvZiBQYXJ0KSB7XG5cdFx0XHRyZXR1cm4gcGFydENhbmRpZGF0ZS5nZXRDb250YWluZXIoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0aXNWaXNpYmxlKHBhcnQ6IE1VTFRJX1dJTkRPV19QQVJUUywgdGFyZ2V0V2luZG93OiBXaW5kb3cpOiBib29sZWFuO1xuXHRpc1Zpc2libGUocGFydDogU0lOR0xFX1dJTkRPV19QQVJUUyk6IGJvb2xlYW47XG5cdGlzVmlzaWJsZShwYXJ0OiBQYXJ0cywgdGFyZ2V0V2luZG93PzogV2luZG93KTogYm9vbGVhbjtcblx0aXNWaXNpYmxlKHBhcnQ6IFBhcnRzLCB0YXJnZXRXaW5kb3c6IFdpbmRvdyA9IG1haW5XaW5kb3cpOiBib29sZWFuIHtcblx0XHRpZiAodGFyZ2V0V2luZG93ICE9PSBtYWluV2luZG93ICYmIHBhcnQgPT09IFBhcnRzLkVESVRPUl9QQVJUKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gY2Fubm90IGhpZGUgZWRpdG9yIHBhcnQgaW4gYXV4aWxpYXJ5IHdpbmRvd3Ncblx0XHR9XG5cblx0XHRpZiAodGhpcy5pbml0aWFsaXplZCkge1xuXHRcdFx0c3dpdGNoIChwYXJ0KSB7XG5cdFx0XHRcdGNhc2UgUGFydHMuVElUTEVCQVJfUEFSVDpcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy53b3JrYmVuY2hHcmlkLmlzVmlld1Zpc2libGUodGhpcy50aXRsZUJhclBhcnRWaWV3KTtcblx0XHRcdFx0Y2FzZSBQYXJ0cy5TSURFQkFSX1BBUlQ6XG5cdFx0XHRcdFx0cmV0dXJuICF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5TSURFQkFSX0hJRERFTik7XG5cdFx0XHRcdGNhc2UgUGFydHMuUEFORUxfUEFSVDpcblx0XHRcdFx0XHRyZXR1cm4gIXRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX0hJRERFTik7XG5cdFx0XHRcdGNhc2UgUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQ6XG5cdFx0XHRcdFx0cmV0dXJuICF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5BVVhJTElBUllCQVJfSElEREVOKTtcblx0XHRcdFx0Y2FzZSBQYXJ0cy5TVEFUVVNCQVJfUEFSVDpcblx0XHRcdFx0XHRyZXR1cm4gIXRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlNUQVRVU0JBUl9ISURERU4pO1xuXHRcdFx0XHRjYXNlIFBhcnRzLkFDVElWSVRZQkFSX1BBUlQ6XG5cdFx0XHRcdFx0cmV0dXJuICF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5BQ1RJVklUWUJBUl9ISURERU4pO1xuXHRcdFx0XHRjYXNlIFBhcnRzLkVESVRPUl9QQVJUOlxuXHRcdFx0XHRcdHJldHVybiAhdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuRURJVE9SX0hJRERFTik7XG5cdFx0XHRcdGNhc2UgUGFydHMuQkFOTkVSX1BBUlQ6XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMud29ya2JlbmNoR3JpZC5pc1ZpZXdWaXNpYmxlKHRoaXMuYmFubmVyUGFydFZpZXcpO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTsgLy8gYW55IG90aGVyIHBhcnQgY2Fubm90IGJlIGhpZGRlblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHN3aXRjaCAocGFydCkge1xuXHRcdFx0Y2FzZSBQYXJ0cy5USVRMRUJBUl9QQVJUOlxuXHRcdFx0XHRyZXR1cm4gc2hvdWxkU2hvd0N1c3RvbVRpdGxlQmFyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIG1haW5XaW5kb3csIHRoaXMuc3RhdGUucnVudGltZS5tZW51QmFyLnRvZ2dsZWQpO1xuXHRcdFx0Y2FzZSBQYXJ0cy5TSURFQkFSX1BBUlQ6XG5cdFx0XHRcdHJldHVybiAhdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9ISURERU4pO1xuXHRcdFx0Y2FzZSBQYXJ0cy5QQU5FTF9QQVJUOlxuXHRcdFx0XHRyZXR1cm4gIXRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX0hJRERFTik7XG5cdFx0XHRjYXNlIFBhcnRzLkFVWElMSUFSWUJBUl9QQVJUOlxuXHRcdFx0XHRyZXR1cm4gIXRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLkFVWElMSUFSWUJBUl9ISURERU4pO1xuXHRcdFx0Y2FzZSBQYXJ0cy5TVEFUVVNCQVJfUEFSVDpcblx0XHRcdFx0cmV0dXJuICF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5TVEFUVVNCQVJfSElEREVOKTtcblx0XHRcdGNhc2UgUGFydHMuQUNUSVZJVFlCQVJfUEFSVDpcblx0XHRcdFx0cmV0dXJuICF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5BQ1RJVklUWUJBUl9ISURERU4pO1xuXHRcdFx0Y2FzZSBQYXJ0cy5FRElUT1JfUEFSVDpcblx0XHRcdFx0cmV0dXJuICF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5FRElUT1JfSElEREVOKTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBmYWxzZTsgLy8gYW55IG90aGVyIHBhcnQgY2Fubm90IGJlIGhpZGRlblxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkU2hvd0Jhbm5lckZpcnN0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBpc1dlYiAmJiAhaXNXQ09FbmFibGVkKCk7XG5cdH1cblxuXHRmb2N1cygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pc1BhbmVsTWF4aW1pemVkKCkgJiYgdGhpcy5tYWluQ29udGFpbmVyID09PSB0aGlzLmFjdGl2ZUNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5mb2N1c1BhcnQoUGFydHMuUEFORUxfUEFSVCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZm9jdXNQYXJ0KFBhcnRzLkVESVRPUl9QQVJULCBnZXRXaW5kb3codGhpcy5hY3RpdmVDb250YWluZXIpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzUGFuZWxPckVkaXRvcigpOiB2b2lkIHtcblx0XHRjb25zdCBhY3RpdmVQYW5lbCA9IHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZShWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpO1xuXHRcdGlmICgodGhpcy5oYXNGb2N1cyhQYXJ0cy5QQU5FTF9QQVJUKSB8fCAhdGhpcy5pc1Zpc2libGUoUGFydHMuRURJVE9SX1BBUlQpKSAmJiBhY3RpdmVQYW5lbCkge1xuXHRcdFx0YWN0aXZlUGFuZWwuZm9jdXMoKTsgLy8gcHJlZmVyIHBhbmVsIGlmIGl0IGhhcyBmb2N1cyBvciBlZGl0b3IgaXMgaGlkZGVuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZm9jdXMoKTsgLy8gb3RoZXJ3aXNlIGZvY3VzIGVkaXRvclxuXHRcdH1cblx0fVxuXG5cdGdldE1heGltdW1FZGl0b3JEaW1lbnNpb25zKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJRGltZW5zaW9uIHtcblx0XHRjb25zdCB0YXJnZXRXaW5kb3cgPSBnZXRXaW5kb3coY29udGFpbmVyKTtcblx0XHRjb25zdCBjb250YWluZXJEaW1lbnNpb24gPSB0aGlzLmdldENvbnRhaW5lckRpbWVuc2lvbihjb250YWluZXIpO1xuXG5cdFx0aWYgKGNvbnRhaW5lciA9PT0gdGhpcy5tYWluQ29udGFpbmVyKSB7XG5cdFx0XHRjb25zdCBpc1BhbmVsSG9yaXpvbnRhbCA9IGlzSG9yaXpvbnRhbCh0aGlzLmdldFBhbmVsUG9zaXRpb24oKSk7XG5cdFx0XHRjb25zdCB0YWtlbldpZHRoID1cblx0XHRcdFx0KHRoaXMuaXNWaXNpYmxlKFBhcnRzLkFDVElWSVRZQkFSX1BBUlQpID8gdGhpcy5hY3Rpdml0eUJhclBhcnRWaWV3Lm1pbmltdW1XaWR0aCA6IDApICtcblx0XHRcdFx0KHRoaXMuaXNWaXNpYmxlKFBhcnRzLlNJREVCQVJfUEFSVCkgPyB0aGlzLnNpZGVCYXJQYXJ0Vmlldy5taW5pbXVtV2lkdGggOiAwKSArXG5cdFx0XHRcdCh0aGlzLmlzVmlzaWJsZShQYXJ0cy5QQU5FTF9QQVJUKSAmJiAhaXNQYW5lbEhvcml6b250YWwgPyB0aGlzLnBhbmVsUGFydFZpZXcubWluaW11bVdpZHRoIDogMCkgK1xuXHRcdFx0XHQodGhpcy5pc1Zpc2libGUoUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQpID8gdGhpcy5hdXhpbGlhcnlCYXJQYXJ0Vmlldy5taW5pbXVtV2lkdGggOiAwKTtcblxuXHRcdFx0Y29uc3QgdGFrZW5IZWlnaHQgPVxuXHRcdFx0XHQodGhpcy5pc1Zpc2libGUoUGFydHMuVElUTEVCQVJfUEFSVCwgdGFyZ2V0V2luZG93KSA/IHRoaXMudGl0bGVCYXJQYXJ0Vmlldy5taW5pbXVtSGVpZ2h0IDogMCkgK1xuXHRcdFx0XHQodGhpcy5pc1Zpc2libGUoUGFydHMuU1RBVFVTQkFSX1BBUlQsIHRhcmdldFdpbmRvdykgPyB0aGlzLnN0YXR1c0JhclBhcnRWaWV3Lm1pbmltdW1IZWlnaHQgOiAwKSArXG5cdFx0XHRcdCh0aGlzLmlzVmlzaWJsZShQYXJ0cy5QQU5FTF9QQVJUKSAmJiBpc1BhbmVsSG9yaXpvbnRhbCA/IHRoaXMucGFuZWxQYXJ0Vmlldy5taW5pbXVtSGVpZ2h0IDogMCk7XG5cblx0XHRcdGNvbnN0IGF2YWlsYWJsZVdpZHRoID0gY29udGFpbmVyRGltZW5zaW9uLndpZHRoIC0gdGFrZW5XaWR0aDtcblx0XHRcdGNvbnN0IGF2YWlsYWJsZUhlaWdodCA9IGNvbnRhaW5lckRpbWVuc2lvbi5oZWlnaHQgLSB0YWtlbkhlaWdodDtcblxuXHRcdFx0cmV0dXJuIHsgd2lkdGg6IGF2YWlsYWJsZVdpZHRoLCBoZWlnaHQ6IGF2YWlsYWJsZUhlaWdodCB9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB0YWtlbkhlaWdodCA9XG5cdFx0XHRcdCh0aGlzLmlzVmlzaWJsZShQYXJ0cy5USVRMRUJBUl9QQVJULCB0YXJnZXRXaW5kb3cpID8gdGhpcy50aXRsZUJhclBhcnRWaWV3Lm1pbmltdW1IZWlnaHQgOiAwKSArXG5cdFx0XHRcdCh0aGlzLmlzVmlzaWJsZShQYXJ0cy5TVEFUVVNCQVJfUEFSVCwgdGFyZ2V0V2luZG93KSA/IHRoaXMuc3RhdHVzQmFyUGFydFZpZXcubWluaW11bUhlaWdodCA6IDApO1xuXG5cdFx0XHRyZXR1cm4geyB3aWR0aDogY29udGFpbmVyRGltZW5zaW9uLndpZHRoLCBoZWlnaHQ6IGNvbnRhaW5lckRpbWVuc2lvbi5oZWlnaHQgLSB0YWtlbkhlaWdodCB9O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaXNaZW5Nb2RlQWN0aXZlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5aRU5fTU9ERV9BQ1RJVkUpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRaZW5Nb2RlQWN0aXZlKGFjdGl2ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlpFTl9NT0RFX0FDVElWRSwgYWN0aXZlKTtcblx0fVxuXG5cdHRvZ2dsZVplbk1vZGUoc2tpcExheW91dD86IGJvb2xlYW4sIHJlc3RvcmluZyA9IGZhbHNlKTogdm9pZCB7XG5cdFx0Y29uc3QgZm9jdXNlZFBhcnRQcmVUcmFuc2l0aW9uID0gdGhpcy5fZ2V0Rm9jdXNlZFBhcnQoKTtcblxuXHRcdHRoaXMuc2V0WmVuTW9kZUFjdGl2ZSghdGhpcy5pc1plbk1vZGVBY3RpdmUoKSk7XG5cdFx0dGhpcy5zdGF0ZS5ydW50aW1lLnplbk1vZGUudHJhbnNpdGlvbkRpc3Bvc2FibGVzLmNsZWFyQW5kRGlzcG9zZUFsbCgpO1xuXG5cdFx0Y29uc3Qgc2V0TGluZU51bWJlcnMgPSAobGluZU51bWJlcnM/OiBMaW5lTnVtYmVyc1R5cGUpID0+IHtcblx0XHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIHRoaXMubWFpblBhcnRFZGl0b3JTZXJ2aWNlLnZpc2libGVUZXh0RWRpdG9yQ29udHJvbHMpIHtcblxuXHRcdFx0XHQvLyBUbyBwcm9wZXJseSByZXNldCBsaW5lIG51bWJlcnMgd2UgbmVlZCB0byByZWFkIHRoZSBjb25maWd1cmF0aW9uIGZvciBlYWNoIGVkaXRvciByZXNwZWN0aW5nIGl0J3MgdXJpLlxuXHRcdFx0XHRpZiAoIWxpbmVOdW1iZXJzICYmIGlzQ29kZUVkaXRvcihlZGl0b3IpICYmIGVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdFx0XHRsaW5lTnVtYmVycyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2VkaXRvci5saW5lTnVtYmVycycsIHsgcmVzb3VyY2U6IG1vZGVsLnVyaSwgb3ZlcnJpZGVJZGVudGlmaWVyOiBtb2RlbC5nZXRMYW5ndWFnZUlkKCkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFsaW5lTnVtYmVycykge1xuXHRcdFx0XHRcdGxpbmVOdW1iZXJzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZWRpdG9yLmxpbmVOdW1iZXJzJyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlZGl0b3IudXBkYXRlT3B0aW9ucyh7IGxpbmVOdW1iZXJzIH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBDaGVjayBpZiB6ZW4gbW9kZSB0cmFuc2l0aW9uZWQgdG8gZnVsbCBzY3JlZW4gYW5kIGlmIG5vdyB3ZSBhcmUgb3V0IG9mIHplbiBtb2RlXG5cdFx0Ly8gLT4gd2UgbmVlZCB0byBnbyBvdXQgb2YgZnVsbCBzY3JlZW4gKHNhbWUgZ29lcyBmb3IgdGhlIGNlbnRlcmVkIGVkaXRvciBsYXlvdXQpXG5cdFx0bGV0IHRvZ2dsZU1haW5XaW5kb3dGdWxsU2NyZWVuID0gZmFsc2U7XG5cdFx0Y29uc3QgY29uZmlnID0gZ2V0WmVuTW9kZUNvbmZpZ3VyYXRpb24odGhpcy5jb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgemVuTW9kZUV4aXRJbmZvID0gdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuWkVOX01PREVfRVhJVF9JTkZPKTtcblxuXHRcdC8vIFplbiBNb2RlIEFjdGl2ZVxuXHRcdGlmICh0aGlzLmlzWmVuTW9kZUFjdGl2ZSgpKSB7XG5cblx0XHRcdHRvZ2dsZU1haW5XaW5kb3dGdWxsU2NyZWVuID0gIXRoaXMuc3RhdGUucnVudGltZS5tYWluV2luZG93RnVsbHNjcmVlbiAmJiBjb25maWcuZnVsbFNjcmVlbiAmJiAhaXNJT1M7XG5cblx0XHRcdGlmICghcmVzdG9yaW5nKSB7XG5cdFx0XHRcdHplbk1vZGVFeGl0SW5mby50cmFuc2l0aW9uZWRUb0Z1bGxTY3JlZW4gPSB0b2dnbGVNYWluV2luZG93RnVsbFNjcmVlbjtcblx0XHRcdFx0emVuTW9kZUV4aXRJbmZvLnRyYW5zaXRpb25lZFRvQ2VudGVyZWRFZGl0b3JMYXlvdXQgPSAhdGhpcy5pc01haW5FZGl0b3JMYXlvdXRDZW50ZXJlZCgpICYmIGNvbmZpZy5jZW50ZXJMYXlvdXQ7XG5cdFx0XHRcdHplbk1vZGVFeGl0SW5mby5oYW5kbGVOb3RpZmljYXRpb25zRG9Ob3REaXN0dXJiTW9kZSA9IHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5nZXRGaWx0ZXIoKSA9PT0gTm90aWZpY2F0aW9uc0ZpbHRlci5PRkY7XG5cdFx0XHRcdHplbk1vZGVFeGl0SW5mby53YXNWaXNpYmxlLnNpZGVCYXIgPSB0aGlzLmlzVmlzaWJsZShQYXJ0cy5TSURFQkFSX1BBUlQpO1xuXHRcdFx0XHR6ZW5Nb2RlRXhpdEluZm8ud2FzVmlzaWJsZS5wYW5lbCA9IHRoaXMuaXNWaXNpYmxlKFBhcnRzLlBBTkVMX1BBUlQpO1xuXHRcdFx0XHR6ZW5Nb2RlRXhpdEluZm8ud2FzVmlzaWJsZS5hdXhpbGlhcnlCYXIgPSB0aGlzLmlzVmlzaWJsZShQYXJ0cy5BVVhJTElBUllCQVJfUEFSVCk7XG5cdFx0XHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlpFTl9NT0RFX0VYSVRfSU5GTywgemVuTW9kZUV4aXRJbmZvKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5zZXRQYW5lbEhpZGRlbih0cnVlLCB0cnVlKTtcblx0XHRcdHRoaXMuc2V0QXV4aWxpYXJ5QmFySGlkZGVuKHRydWUsIHRydWUpO1xuXHRcdFx0dGhpcy5zZXRTaWRlQmFySGlkZGVuKHRydWUsIHRydWUpO1xuXG5cdFx0XHRpZiAoY29uZmlnLmhpZGVBY3Rpdml0eUJhcikge1xuXHRcdFx0XHR0aGlzLnNldEFjdGl2aXR5QmFySGlkZGVuKHRydWUsIHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY29uZmlnLmhpZGVTdGF0dXNCYXIpIHtcblx0XHRcdFx0dGhpcy5zZXRTdGF0dXNCYXJIaWRkZW4odHJ1ZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjb25maWcuaGlkZUxpbmVOdW1iZXJzKSB7XG5cdFx0XHRcdHNldExpbmVOdW1iZXJzKCdvZmYnKTtcblx0XHRcdFx0dGhpcy5zdGF0ZS5ydW50aW1lLnplbk1vZGUudHJhbnNpdGlvbkRpc3Bvc2FibGVzLnNldChaZW5Nb2RlU2V0dGluZ3MuSElERV9MSU5FTlVNQkVSUywgdGhpcy5tYWluUGFydEVkaXRvclNlcnZpY2Uub25EaWRWaXNpYmxlRWRpdG9yc0NoYW5nZSgoKSA9PiBzZXRMaW5lTnVtYmVycygnb2ZmJykpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNvbmZpZy5zaG93VGFicyAhPT0gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UucGFydE9wdGlvbnMuc2hvd1RhYnMpIHtcblx0XHRcdFx0dGhpcy5zdGF0ZS5ydW50aW1lLnplbk1vZGUudHJhbnNpdGlvbkRpc3Bvc2FibGVzLnNldChaZW5Nb2RlU2V0dGluZ3MuU0hPV19UQUJTLCB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5tYWluUGFydC5lbmZvcmNlUGFydE9wdGlvbnMoeyBzaG93VGFiczogY29uZmlnLnNob3dUYWJzIH0pKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNvbmZpZy5zaWxlbnROb3RpZmljYXRpb25zICYmIHplbk1vZGVFeGl0SW5mby5oYW5kbGVOb3RpZmljYXRpb25zRG9Ob3REaXN0dXJiTW9kZSkge1xuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uuc2V0RmlsdGVyKE5vdGlmaWNhdGlvbnNGaWx0ZXIuRVJST1IpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY29uZmlnLmNlbnRlckxheW91dCkge1xuXHRcdFx0XHR0aGlzLmNlbnRlck1haW5FZGl0b3JMYXlvdXQodHJ1ZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFplbiBNb2RlIENvbmZpZ3VyYXRpb24gQ2hhbmdlc1xuXHRcdFx0dGhpcy5zdGF0ZS5ydW50aW1lLnplbk1vZGUudHJhbnNpdGlvbkRpc3Bvc2FibGVzLnNldCgnY29uZmlndXJhdGlvbkNoYW5nZScsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0XHQvLyBBY3Rpdml0eSBCYXJcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oWmVuTW9kZVNldHRpbmdzLkhJREVfQUNUSVZJVFlCQVIpKSB7XG5cdFx0XHRcdFx0Y29uc3QgemVuTW9kZUhpZGVBY3Rpdml0eUJhciA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oWmVuTW9kZVNldHRpbmdzLkhJREVfQUNUSVZJVFlCQVIpO1xuXHRcdFx0XHRcdHRoaXMuc2V0QWN0aXZpdHlCYXJIaWRkZW4oemVuTW9kZUhpZGVBY3Rpdml0eUJhciwgdHJ1ZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTdGF0dXMgQmFyXG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFplbk1vZGVTZXR0aW5ncy5ISURFX1NUQVRVU0JBUikpIHtcblx0XHRcdFx0XHRjb25zdCB6ZW5Nb2RlSGlkZVN0YXR1c0JhciA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oWmVuTW9kZVNldHRpbmdzLkhJREVfU1RBVFVTQkFSKTtcblx0XHRcdFx0XHR0aGlzLnNldFN0YXR1c0JhckhpZGRlbih6ZW5Nb2RlSGlkZVN0YXR1c0JhciwgdHJ1ZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBDZW50ZXIgTGF5b3V0XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFplbk1vZGVTZXR0aW5ncy5DRU5URVJfTEFZT1VUKSkge1xuXHRcdFx0XHRcdGNvbnN0IHplbk1vZGVDZW50ZXJMYXlvdXQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KFplbk1vZGVTZXR0aW5ncy5DRU5URVJfTEFZT1VUKTtcblx0XHRcdFx0XHR0aGlzLmNlbnRlck1haW5FZGl0b3JMYXlvdXQoemVuTW9kZUNlbnRlckxheW91dCwgdHJ1ZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTaG93IFRhYnNcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oWmVuTW9kZVNldHRpbmdzLlNIT1dfVEFCUykpIHtcblx0XHRcdFx0XHRjb25zdCB6ZW5Nb2RlU2hvd1RhYnMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPEVkaXRvclRhYnNNb2RlIHwgdW5kZWZpbmVkPihaZW5Nb2RlU2V0dGluZ3MuU0hPV19UQUJTKSA/PyAnbXVsdGlwbGUnO1xuXHRcdFx0XHRcdHRoaXMuc3RhdGUucnVudGltZS56ZW5Nb2RlLnRyYW5zaXRpb25EaXNwb3NhYmxlcy5zZXQoWmVuTW9kZVNldHRpbmdzLlNIT1dfVEFCUywgdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UubWFpblBhcnQuZW5mb3JjZVBhcnRPcHRpb25zKHsgc2hvd1RhYnM6IHplbk1vZGVTaG93VGFicyB9KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBOb3RpZmljYXRpb25zXG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFplbk1vZGVTZXR0aW5ncy5TSUxFTlRfTk9USUZJQ0FUSU9OUykpIHtcblx0XHRcdFx0XHRjb25zdCB6ZW5Nb2RlU2lsZW50Tm90aWZpY2F0aW9ucyA9ICEhdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShaZW5Nb2RlU2V0dGluZ3MuU0lMRU5UX05PVElGSUNBVElPTlMpO1xuXHRcdFx0XHRcdGlmICh6ZW5Nb2RlRXhpdEluZm8uaGFuZGxlTm90aWZpY2F0aW9uc0RvTm90RGlzdHVyYk1vZGUpIHtcblx0XHRcdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5zZXRGaWx0ZXIoemVuTW9kZVNpbGVudE5vdGlmaWNhdGlvbnMgPyBOb3RpZmljYXRpb25zRmlsdGVyLkVSUk9SIDogTm90aWZpY2F0aW9uc0ZpbHRlci5PRkYpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIENlbnRlciBMYXlvdXRcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oWmVuTW9kZVNldHRpbmdzLkhJREVfTElORU5VTUJFUlMpKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGluZU51bWJlcnNUeXBlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihaZW5Nb2RlU2V0dGluZ3MuSElERV9MSU5FTlVNQkVSUykgPyAnb2ZmJyA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRzZXRMaW5lTnVtYmVycyhsaW5lTnVtYmVyc1R5cGUpO1xuXHRcdFx0XHRcdHRoaXMuc3RhdGUucnVudGltZS56ZW5Nb2RlLnRyYW5zaXRpb25EaXNwb3NhYmxlcy5zZXQoWmVuTW9kZVNldHRpbmdzLkhJREVfTElORU5VTUJFUlMsIHRoaXMubWFpblBhcnRFZGl0b3JTZXJ2aWNlLm9uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2UoKCkgPT4gc2V0TGluZU51bWJlcnMobGluZU51bWJlcnNUeXBlKSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0Ly8gWmVuIE1vZGUgSW5hY3RpdmVcblx0XHRlbHNlIHtcblx0XHRcdGlmICh6ZW5Nb2RlRXhpdEluZm8ud2FzVmlzaWJsZS5wYW5lbCkge1xuXHRcdFx0XHR0aGlzLnNldFBhbmVsSGlkZGVuKGZhbHNlLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHplbk1vZGVFeGl0SW5mby53YXNWaXNpYmxlLmF1eGlsaWFyeUJhcikge1xuXHRcdFx0XHR0aGlzLnNldEF1eGlsaWFyeUJhckhpZGRlbihmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh6ZW5Nb2RlRXhpdEluZm8ud2FzVmlzaWJsZS5zaWRlQmFyKSB7XG5cdFx0XHRcdHRoaXMuc2V0U2lkZUJhckhpZGRlbihmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuQUNUSVZJVFlCQVJfSElEREVOLCB0cnVlKSkge1xuXHRcdFx0XHR0aGlzLnNldEFjdGl2aXR5QmFySGlkZGVuKGZhbHNlLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5TVEFUVVNCQVJfSElEREVOLCB0cnVlKSkge1xuXHRcdFx0XHR0aGlzLnNldFN0YXR1c0JhckhpZGRlbihmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh6ZW5Nb2RlRXhpdEluZm8udHJhbnNpdGlvbmVkVG9DZW50ZXJlZEVkaXRvckxheW91dCkge1xuXHRcdFx0XHR0aGlzLmNlbnRlck1haW5FZGl0b3JMYXlvdXQoZmFsc2UsIHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoemVuTW9kZUV4aXRJbmZvLmhhbmRsZU5vdGlmaWNhdGlvbnNEb05vdERpc3R1cmJNb2RlKSB7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5zZXRGaWx0ZXIoTm90aWZpY2F0aW9uc0ZpbHRlci5PRkYpO1xuXHRcdFx0fVxuXG5cdFx0XHRzZXRMaW5lTnVtYmVycygpO1xuXG5cdFx0XHR0b2dnbGVNYWluV2luZG93RnVsbFNjcmVlbiA9IHplbk1vZGVFeGl0SW5mby50cmFuc2l0aW9uZWRUb0Z1bGxTY3JlZW4gJiYgdGhpcy5zdGF0ZS5ydW50aW1lLm1haW5XaW5kb3dGdWxsc2NyZWVuO1xuXHRcdH1cblxuXHRcdGlmICghc2tpcExheW91dCkge1xuXHRcdFx0dGhpcy5sYXlvdXQoKTtcblx0XHR9XG5cblx0XHRpZiAodG9nZ2xlTWFpbldpbmRvd0Z1bGxTY3JlZW4pIHtcblx0XHRcdHRoaXMuaG9zdFNlcnZpY2UudG9nZ2xlRnVsbFNjcmVlbihtYWluV2luZG93KTtcblx0XHR9XG5cblx0XHQvLyByZXN0b3JlIGZvY3VzIGlmIHBhcnQgaXMgc3RpbGwgdmlzaWJsZSwgb3RoZXJ3aXNlIGZhbGxiYWNrIHRvIGVkaXRvclxuXHRcdGlmIChmb2N1c2VkUGFydFByZVRyYW5zaXRpb24gJiYgdGhpcy5pc1Zpc2libGUoZm9jdXNlZFBhcnRQcmVUcmFuc2l0aW9uLCBnZXRXaW5kb3codGhpcy5hY3RpdmVDb250YWluZXIpKSkge1xuXHRcdFx0aWYgKGlzTXVsdGlXaW5kb3dQYXJ0KGZvY3VzZWRQYXJ0UHJlVHJhbnNpdGlvbikpIHtcblx0XHRcdFx0dGhpcy5mb2N1c1BhcnQoZm9jdXNlZFBhcnRQcmVUcmFuc2l0aW9uLCBnZXRXaW5kb3codGhpcy5hY3RpdmVDb250YWluZXIpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZm9jdXNQYXJ0KGZvY3VzZWRQYXJ0UHJlVHJhbnNpdGlvbik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHR9XG5cblx0XHQvLyBFdmVudFxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlWmVuTW9kZS5maXJlKHRoaXMuaXNaZW5Nb2RlQWN0aXZlKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRTdGF0dXNCYXJIaWRkZW4oaGlkZGVuOiBib29sZWFuLCBza2lwTGF5b3V0PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlNUQVRVU0JBUl9ISURERU4sIGhpZGRlbik7XG5cblx0XHQvLyBBZGp1c3QgQ1NTXG5cdFx0aWYgKGhpZGRlbikge1xuXHRcdFx0dGhpcy5tYWluQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoTGF5b3V0Q2xhc3Nlcy5TVEFUVVNCQVJfSElEREVOKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5tYWluQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoTGF5b3V0Q2xhc3Nlcy5TVEFUVVNCQVJfSElEREVOKTtcblx0XHR9XG5cblx0XHQvLyBQcm9wYWdhdGUgdG8gZ3JpZFxuXHRcdHRoaXMud29ya2JlbmNoR3JpZC5zZXRWaWV3VmlzaWJsZSh0aGlzLnN0YXR1c0JhclBhcnRWaWV3LCAhaGlkZGVuKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVXb3JrYmVuY2hMYXlvdXQoKTogdm9pZCB7XG5cdFx0Y29uc3QgdGl0bGVCYXIgPSB0aGlzLmdldFBhcnQoUGFydHMuVElUTEVCQVJfUEFSVCk7XG5cdFx0Y29uc3QgYmFubmVyUGFydCA9IHRoaXMuZ2V0UGFydChQYXJ0cy5CQU5ORVJfUEFSVCk7XG5cdFx0Y29uc3QgZWRpdG9yUGFydCA9IHRoaXMuZ2V0UGFydChQYXJ0cy5FRElUT1JfUEFSVCk7XG5cdFx0Y29uc3QgYWN0aXZpdHlCYXIgPSB0aGlzLmdldFBhcnQoUGFydHMuQUNUSVZJVFlCQVJfUEFSVCk7XG5cdFx0Y29uc3QgcGFuZWxQYXJ0ID0gdGhpcy5nZXRQYXJ0KFBhcnRzLlBBTkVMX1BBUlQpO1xuXHRcdGNvbnN0IGF1eGlsaWFyeUJhclBhcnQgPSB0aGlzLmdldFBhcnQoUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQpO1xuXHRcdGNvbnN0IHNpZGVCYXIgPSB0aGlzLmdldFBhcnQoUGFydHMuU0lERUJBUl9QQVJUKTtcblx0XHRjb25zdCBzdGF0dXNCYXIgPSB0aGlzLmdldFBhcnQoUGFydHMuU1RBVFVTQkFSX1BBUlQpO1xuXG5cdFx0Ly8gVmlldyByZWZlcmVuY2VzIGZvciBhbGwgcGFydHNcblx0XHR0aGlzLnRpdGxlQmFyUGFydFZpZXcgPSB0aXRsZUJhcjtcblx0XHR0aGlzLmJhbm5lclBhcnRWaWV3ID0gYmFubmVyUGFydDtcblx0XHR0aGlzLnNpZGVCYXJQYXJ0VmlldyA9IHNpZGVCYXI7XG5cdFx0dGhpcy5hY3Rpdml0eUJhclBhcnRWaWV3ID0gYWN0aXZpdHlCYXI7XG5cdFx0dGhpcy5lZGl0b3JQYXJ0VmlldyA9IGVkaXRvclBhcnQ7XG5cdFx0dGhpcy5wYW5lbFBhcnRWaWV3ID0gcGFuZWxQYXJ0O1xuXHRcdHRoaXMuYXV4aWxpYXJ5QmFyUGFydFZpZXcgPSBhdXhpbGlhcnlCYXJQYXJ0O1xuXHRcdHRoaXMuc3RhdHVzQmFyUGFydFZpZXcgPSBzdGF0dXNCYXI7XG5cblx0XHRjb25zdCB2aWV3TWFwID0ge1xuXHRcdFx0W1BhcnRzLkFDVElWSVRZQkFSX1BBUlRdOiB0aGlzLmFjdGl2aXR5QmFyUGFydFZpZXcsXG5cdFx0XHRbUGFydHMuQkFOTkVSX1BBUlRdOiB0aGlzLmJhbm5lclBhcnRWaWV3LFxuXHRcdFx0W1BhcnRzLlRJVExFQkFSX1BBUlRdOiB0aGlzLnRpdGxlQmFyUGFydFZpZXcsXG5cdFx0XHRbUGFydHMuRURJVE9SX1BBUlRdOiB0aGlzLmVkaXRvclBhcnRWaWV3LFxuXHRcdFx0W1BhcnRzLlBBTkVMX1BBUlRdOiB0aGlzLnBhbmVsUGFydFZpZXcsXG5cdFx0XHRbUGFydHMuU0lERUJBUl9QQVJUXTogdGhpcy5zaWRlQmFyUGFydFZpZXcsXG5cdFx0XHRbUGFydHMuU1RBVFVTQkFSX1BBUlRdOiB0aGlzLnN0YXR1c0JhclBhcnRWaWV3LFxuXHRcdFx0W1BhcnRzLkFVWElMSUFSWUJBUl9QQVJUXTogdGhpcy5hdXhpbGlhcnlCYXJQYXJ0Vmlld1xuXHRcdH07XG5cblx0XHRjb25zdCBmcm9tSlNPTiA9ICh7IHR5cGUgfTogeyB0eXBlOiBQYXJ0cyB9KSA9PiB2aWV3TWFwW3R5cGVdO1xuXHRcdGNvbnN0IHdvcmtiZW5jaEdyaWQgPSBTZXJpYWxpemFibGVHcmlkLmRlc2VyaWFsaXplKFxuXHRcdFx0dGhpcy5jcmVhdGVHcmlkRGVzY3JpcHRvcigpLFxuXHRcdFx0eyBmcm9tSlNPTiB9LFxuXHRcdFx0eyBwcm9wb3J0aW9uYWxMYXlvdXQ6IGZhbHNlIH1cblx0XHQpO1xuXG5cdFx0dGhpcy5tYWluQ29udGFpbmVyLnByZXBlbmQod29ya2JlbmNoR3JpZC5lbGVtZW50KTtcblx0XHR0aGlzLm1haW5Db250YWluZXIuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2FwcGxpY2F0aW9uJyk7XG5cdFx0dGhpcy53b3JrYmVuY2hHcmlkID0gd29ya2JlbmNoR3JpZDtcblx0XHR0aGlzLndvcmtiZW5jaEdyaWQuZWRnZVNuYXBwaW5nID0gdGhpcy5zdGF0ZS5ydW50aW1lLm1haW5XaW5kb3dGdWxsc2NyZWVuO1xuXG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIFt0aXRsZUJhciwgZWRpdG9yUGFydCwgYWN0aXZpdHlCYXIsIHBhbmVsUGFydCwgc2lkZUJhciwgc3RhdHVzQmFyLCBhdXhpbGlhcnlCYXJQYXJ0LCBiYW5uZXJQYXJ0XSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocGFydC5vbkRpZFZpc2liaWxpdHlDaGFuZ2UoKHZpc2libGUpID0+IHtcblx0XHRcdFx0aWYgKHBhcnQgPT09IHNpZGVCYXIpIHtcblx0XHRcdFx0XHR0aGlzLnNldFNpZGVCYXJIaWRkZW4oIXZpc2libGUsIHRydWUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHBhcnQgPT09IHBhbmVsUGFydCkge1xuXHRcdFx0XHRcdHRoaXMuc2V0UGFuZWxIaWRkZW4oIXZpc2libGUsIHRydWUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHBhcnQgPT09IGF1eGlsaWFyeUJhclBhcnQpIHtcblx0XHRcdFx0XHR0aGlzLnNldEF1eGlsaWFyeUJhckhpZGRlbighdmlzaWJsZSwgdHJ1ZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAocGFydCA9PT0gZWRpdG9yUGFydCkge1xuXHRcdFx0XHRcdHRoaXMuc2V0RWRpdG9ySGlkZGVuKCF2aXNpYmxlLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVBhcnRWaXNpYmlsaXR5LmZpcmUoKTtcblx0XHRcdFx0dGhpcy5oYW5kbGVDb250YWluZXJEaWRMYXlvdXQodGhpcy5tYWluQ29udGFpbmVyLCB0aGlzLl9tYWluQ29udGFpbmVyRGltZW5zaW9uKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uV2lsbFNhdmVTdGF0ZShlID0+IHtcblxuXHRcdFx0Ly8gU2lkZSBCYXIgU2l6ZVxuXHRcdFx0Y29uc3Qgc2lkZUJhclNpemUgPSB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5TSURFQkFSX0hJRERFTilcblx0XHRcdFx0PyB0aGlzLndvcmtiZW5jaEdyaWQuZ2V0Vmlld0NhY2hlZFZpc2libGVTaXplKHRoaXMuc2lkZUJhclBhcnRWaWV3KVxuXHRcdFx0XHQ6IHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLnNpZGVCYXJQYXJ0Vmlldykud2lkdGg7XG5cdFx0XHR0aGlzLnN0YXRlTW9kZWwuc2V0SW5pdGlhbGl6YXRpb25WYWx1ZShMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9TSVpFLCBzaWRlQmFyU2l6ZSBhcyBudW1iZXIpO1xuXG5cdFx0XHQvLyBQYW5lbCBTaXplXG5cdFx0XHRjb25zdCBwYW5lbFNpemUgPSB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5QQU5FTF9ISURERU4pXG5cdFx0XHRcdD8gdGhpcy53b3JrYmVuY2hHcmlkLmdldFZpZXdDYWNoZWRWaXNpYmxlU2l6ZSh0aGlzLnBhbmVsUGFydFZpZXcpXG5cdFx0XHRcdDogaXNIb3Jpem9udGFsKHRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX1BPU0lUSU9OKSlcblx0XHRcdFx0XHQ/IHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLnBhbmVsUGFydFZpZXcpLmhlaWdodFxuXHRcdFx0XHRcdDogdGhpcy53b3JrYmVuY2hHcmlkLmdldFZpZXdTaXplKHRoaXMucGFuZWxQYXJ0Vmlldykud2lkdGg7XG5cdFx0XHR0aGlzLnN0YXRlTW9kZWwuc2V0SW5pdGlhbGl6YXRpb25WYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfU0laRSwgcGFuZWxTaXplIGFzIG51bWJlcik7XG5cblx0XHRcdC8vIEF1eGlsaWFyeSBCYXIgU2l6ZVxuXHRcdFx0Y29uc3QgYXV4aWxpYXJ5QmFyU2l6ZSA9IHRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLkFVWElMSUFSWUJBUl9ISURERU4pXG5cdFx0XHRcdD8gdGhpcy53b3JrYmVuY2hHcmlkLmdldFZpZXdDYWNoZWRWaXNpYmxlU2l6ZSh0aGlzLmF1eGlsaWFyeUJhclBhcnRWaWV3KVxuXHRcdFx0XHQ6IHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLmF1eGlsaWFyeUJhclBhcnRWaWV3KS53aWR0aDtcblx0XHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRJbml0aWFsaXphdGlvblZhbHVlKExheW91dFN0YXRlS2V5cy5BVVhJTElBUllCQVJfU0laRSwgYXV4aWxpYXJ5QmFyU2l6ZSBhcyBudW1iZXIpO1xuXG5cdFx0XHR0aGlzLnN0YXRlTW9kZWwuc2F2ZSh0cnVlLCB0cnVlKTtcblx0XHR9KSk7XG5cdH1cblxuXHRsYXlvdXQoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmRpc3Bvc2VkKSB7XG5cdFx0XHR0aGlzLl9tYWluQ29udGFpbmVyRGltZW5zaW9uID0gZ2V0Q2xpZW50QXJlYSh0aGlzLnN0YXRlLnJ1bnRpbWUubWFpbldpbmRvd0Z1bGxzY3JlZW4gP1xuXHRcdFx0XHRtYWluV2luZG93LmRvY3VtZW50LmJvZHkgOiBcdC8vIGluIGZ1bGxzY3JlZW4gbW9kZSwgbWFrZSBzdXJlIHRvIHVzZSA8Ym9keT4gZWxlbWVudCBiZWNhdXNlXG5cdFx0XHRcdHRoaXMucGFyZW50LFx0XHRcdFx0Ly8gaW4gdGhhdCBjYXNlIHRoZSB3b3JrYmVuY2ggd2lsbCBzcGFuIHRoZSBlbnRpcmUgc2l0ZVxuXHRcdFx0XHRERUZBVUxUX1dJTkRPV19ESU1FTlNJT05TXHQvLyBydW5uaW5nIHdpdGggZmFsbGJhY2sgdG8gZW5zdXJlIG5vIGVycm9yIGlzIHRocm93biAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI0MDI0Milcblx0XHRcdCk7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYExheW91dCNsYXlvdXQsIGhlaWdodDogJHt0aGlzLl9tYWluQ29udGFpbmVyRGltZW5zaW9uLmhlaWdodH0sIHdpZHRoOiAke3RoaXMuX21haW5Db250YWluZXJEaW1lbnNpb24ud2lkdGh9YCk7XG5cblx0XHRcdHBvc2l0aW9uKHRoaXMubWFpbkNvbnRhaW5lciwgMCwgMCwgMCwgMCwgJ3JlbGF0aXZlJyk7XG5cdFx0XHRzaXplKHRoaXMubWFpbkNvbnRhaW5lciwgdGhpcy5fbWFpbkNvbnRhaW5lckRpbWVuc2lvbi53aWR0aCwgdGhpcy5fbWFpbkNvbnRhaW5lckRpbWVuc2lvbi5oZWlnaHQpO1xuXG5cdFx0XHQvLyBMYXlvdXQgdGhlIGdyaWQgd2lkZ2V0XG5cdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQubGF5b3V0KHRoaXMuX21haW5Db250YWluZXJEaW1lbnNpb24ud2lkdGgsIHRoaXMuX21haW5Db250YWluZXJEaW1lbnNpb24uaGVpZ2h0KTtcblx0XHRcdHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG5cdFx0XHQvLyBFbWl0IGFzIGV2ZW50XG5cdFx0XHR0aGlzLmhhbmRsZUNvbnRhaW5lckRpZExheW91dCh0aGlzLm1haW5Db250YWluZXIsIHRoaXMuX21haW5Db250YWluZXJEaW1lbnNpb24pO1xuXHRcdH1cblx0fVxuXG5cdGlzTWFpbkVkaXRvckxheW91dENlbnRlcmVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5NQUlOX0VESVRPUl9DRU5URVJFRCk7XG5cdH1cblxuXHRjZW50ZXJNYWluRWRpdG9yTGF5b3V0KGFjdGl2ZTogYm9vbGVhbiwgc2tpcExheW91dD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnN0YXRlTW9kZWwuc2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5NQUlOX0VESVRPUl9DRU5URVJFRCwgYWN0aXZlKTtcblxuXHRcdGNvbnN0IG1haW5WaXNpYmxlRWRpdG9ycyA9IGNvYWxlc2NlKHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0Lmdyb3Vwcy5tYXAoZ3JvdXAgPT4gZ3JvdXAuYWN0aXZlRWRpdG9yKSk7XG5cdFx0Y29uc3QgaXNFZGl0b3JDb21wbGV4ID0gbWFpblZpc2libGVFZGl0b3JzLnNvbWUoZWRpdG9yID0+IHtcblx0XHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBEaWZmRWRpdG9ySW5wdXQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2RpZmZFZGl0b3IucmVuZGVyU2lkZUJ5U2lkZScpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZWRpdG9yPy5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLk11bHRpcGxlRWRpdG9ycykpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGxheW91dCA9IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdldExheW91dCgpO1xuXHRcdGxldCBoYXNNb3JlVGhhbk9uZUNvbHVtbiA9IGZhbHNlO1xuXHRcdGlmIChsYXlvdXQub3JpZW50YXRpb24gPT09IEdyb3VwT3JpZW50YXRpb24uSE9SSVpPTlRBTCkge1xuXHRcdFx0aGFzTW9yZVRoYW5PbmVDb2x1bW4gPSBsYXlvdXQuZ3JvdXBzLmxlbmd0aCA+IDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGhhc01vcmVUaGFuT25lQ29sdW1uID0gbGF5b3V0Lmdyb3Vwcy5zb21lKGdyb3VwID0+IGdyb3VwLmdyb3VwcyAmJiBncm91cC5ncm91cHMubGVuZ3RoID4gMSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNDZW50ZXJlZExheW91dEF1dG9SZXNpemluZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3dvcmtiZW5jaC5lZGl0b3IuY2VudGVyZWRMYXlvdXRBdXRvUmVzaXplJyk7XG5cdFx0aWYgKFxuXHRcdFx0aXNDZW50ZXJlZExheW91dEF1dG9SZXNpemluZyAmJlxuXHRcdFx0KChoYXNNb3JlVGhhbk9uZUNvbHVtbiAmJiAhdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UubWFpblBhcnQuaGFzTWF4aW1pemVkR3JvdXAoKSkgfHwgaXNFZGl0b3JDb21wbGV4KVxuXHRcdCkge1xuXHRcdFx0YWN0aXZlID0gZmFsc2U7IC8vIGRpc2FibGUgY2VudGVyZWQgbGF5b3V0IGZvciBjb21wbGV4IGVkaXRvcnMgb3Igd2hlbiB0aGVyZSBpcyBtb3JlIHRoYW4gb25lIGdyb3VwXG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0LmlzTGF5b3V0Q2VudGVyZWQoKSAhPT0gYWN0aXZlKSB7XG5cdFx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS5tYWluUGFydC5jZW50ZXJMYXlvdXQoYWN0aXZlKTtcblxuXHRcdFx0aWYgKCFza2lwTGF5b3V0KSB7XG5cdFx0XHRcdHRoaXMubGF5b3V0KCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VNYWluRWRpdG9yQ2VudGVyZWRMYXlvdXQuZmlyZSh0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5NQUlOX0VESVRPUl9DRU5URVJFRCkpO1xuXHR9XG5cblx0Z2V0U2l6ZShwYXJ0OiBQYXJ0cyk6IElWaWV3U2l6ZSB7XG5cdFx0cmV0dXJuIHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLmdldFBhcnQocGFydCkpO1xuXHR9XG5cblx0c2V0U2l6ZShwYXJ0OiBQYXJ0cywgc2l6ZTogSVZpZXdTaXplKTogdm9pZCB7XG5cdFx0dGhpcy53b3JrYmVuY2hHcmlkLnJlc2l6ZVZpZXcodGhpcy5nZXRQYXJ0KHBhcnQpLCBzaXplKTtcblx0fVxuXG5cdHJlc2l6ZVBhcnQocGFydDogUGFydHMsIHNpemVDaGFuZ2VXaWR0aDogbnVtYmVyLCBzaXplQ2hhbmdlSGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBzaXplQ2hhbmdlUHhXaWR0aCA9IE1hdGguc2lnbihzaXplQ2hhbmdlV2lkdGgpICogY29tcHV0ZVNjcmVlbkF3YXJlU2l6ZShnZXRBY3RpdmVXaW5kb3coKSwgTWF0aC5hYnMoc2l6ZUNoYW5nZVdpZHRoKSk7XG5cdFx0Y29uc3Qgc2l6ZUNoYW5nZVB4SGVpZ2h0ID0gTWF0aC5zaWduKHNpemVDaGFuZ2VIZWlnaHQpICogY29tcHV0ZVNjcmVlbkF3YXJlU2l6ZShnZXRBY3RpdmVXaW5kb3coKSwgTWF0aC5hYnMoc2l6ZUNoYW5nZUhlaWdodCkpO1xuXG5cdFx0bGV0IHZpZXdTaXplOiBJVmlld1NpemU7XG5cblx0XHRzd2l0Y2ggKHBhcnQpIHtcblx0XHRcdGNhc2UgUGFydHMuU0lERUJBUl9QQVJUOlxuXHRcdFx0XHR2aWV3U2l6ZSA9IHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLnNpZGVCYXJQYXJ0Vmlldyk7XG5cdFx0XHRcdHRoaXMud29ya2JlbmNoR3JpZC5yZXNpemVWaWV3KHRoaXMuc2lkZUJhclBhcnRWaWV3LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHdpZHRoOiB2aWV3U2l6ZS53aWR0aCArIHNpemVDaGFuZ2VQeFdpZHRoLFxuXHRcdFx0XHRcdFx0aGVpZ2h0OiB2aWV3U2l6ZS5oZWlnaHRcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUGFydHMuUEFORUxfUEFSVDpcblx0XHRcdFx0dmlld1NpemUgPSB0aGlzLndvcmtiZW5jaEdyaWQuZ2V0Vmlld1NpemUodGhpcy5wYW5lbFBhcnRWaWV3KTtcblxuXHRcdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQucmVzaXplVmlldyh0aGlzLnBhbmVsUGFydFZpZXcsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0d2lkdGg6IHZpZXdTaXplLndpZHRoICsgKGlzSG9yaXpvbnRhbCh0aGlzLmdldFBhbmVsUG9zaXRpb24oKSkgPyAwIDogc2l6ZUNoYW5nZVB4V2lkdGgpLFxuXHRcdFx0XHRcdFx0aGVpZ2h0OiB2aWV3U2l6ZS5oZWlnaHQgKyAoaXNIb3Jpem9udGFsKHRoaXMuZ2V0UGFuZWxQb3NpdGlvbigpKSA/IHNpemVDaGFuZ2VQeEhlaWdodCA6IDApXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFBhcnRzLkFVWElMSUFSWUJBUl9QQVJUOlxuXHRcdFx0XHR2aWV3U2l6ZSA9IHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLmF1eGlsaWFyeUJhclBhcnRWaWV3KTtcblx0XHRcdFx0dGhpcy53b3JrYmVuY2hHcmlkLnJlc2l6ZVZpZXcodGhpcy5hdXhpbGlhcnlCYXJQYXJ0Vmlldyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR3aWR0aDogdmlld1NpemUud2lkdGggKyBzaXplQ2hhbmdlUHhXaWR0aCxcblx0XHRcdFx0XHRcdGhlaWdodDogdmlld1NpemUuaGVpZ2h0XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBQYXJ0cy5FRElUT1JfUEFSVDpcblx0XHRcdFx0dmlld1NpemUgPSB0aGlzLndvcmtiZW5jaEdyaWQuZ2V0Vmlld1NpemUodGhpcy5lZGl0b3JQYXJ0Vmlldyk7XG5cblx0XHRcdFx0Ly8gU2luZ2xlIEVkaXRvciBHcm91cFxuXHRcdFx0XHRpZiAodGhpcy5lZGl0b3JHcm91cFNlcnZpY2UubWFpblBhcnQuY291bnQgPT09IDEpIHtcblx0XHRcdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQucmVzaXplVmlldyh0aGlzLmVkaXRvclBhcnRWaWV3LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHR3aWR0aDogdmlld1NpemUud2lkdGggKyBzaXplQ2hhbmdlUHhXaWR0aCxcblx0XHRcdFx0XHRcdFx0aGVpZ2h0OiB2aWV3U2l6ZS5oZWlnaHQgKyBzaXplQ2hhbmdlUHhIZWlnaHRcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGFjdGl2ZUdyb3VwID0gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UubWFpblBhcnQuYWN0aXZlR3JvdXA7XG5cblx0XHRcdFx0XHRjb25zdCB7IHdpZHRoLCBoZWlnaHQgfSA9IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0LmdldFNpemUoYWN0aXZlR3JvdXApO1xuXHRcdFx0XHRcdHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0LnNldFNpemUoYWN0aXZlR3JvdXAsIHsgd2lkdGg6IHdpZHRoICsgc2l6ZUNoYW5nZVB4V2lkdGgsIGhlaWdodDogaGVpZ2h0ICsgc2l6ZUNoYW5nZVB4SGVpZ2h0IH0pO1xuXG5cdFx0XHRcdFx0Ly8gQWZ0ZXIgcmVzaXppbmcgdGhlIGVkaXRvciBncm91cFxuXHRcdFx0XHRcdC8vIGlmIGl0IGRvZXMgbm90IGNoYW5nZSBpbiBlaXRoZXIgZGlyZWN0aW9uXG5cdFx0XHRcdFx0Ly8gdHJ5IHJlc2l6aW5nIHRoZSBmdWxsIGVkaXRvciBwYXJ0XG5cdFx0XHRcdFx0Y29uc3QgeyB3aWR0aDogbmV3V2lkdGgsIGhlaWdodDogbmV3SGVpZ2h0IH0gPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5tYWluUGFydC5nZXRTaXplKGFjdGl2ZUdyb3VwKTtcblx0XHRcdFx0XHRpZiAoKHNpemVDaGFuZ2VQeEhlaWdodCAmJiBoZWlnaHQgPT09IG5ld0hlaWdodCkgfHwgKHNpemVDaGFuZ2VQeFdpZHRoICYmIHdpZHRoID09PSBuZXdXaWR0aCkpIHtcblx0XHRcdFx0XHRcdHRoaXMud29ya2JlbmNoR3JpZC5yZXNpemVWaWV3KHRoaXMuZWRpdG9yUGFydFZpZXcsXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHR3aWR0aDogdmlld1NpemUud2lkdGggKyAoc2l6ZUNoYW5nZVB4V2lkdGggJiYgd2lkdGggPT09IG5ld1dpZHRoID8gc2l6ZUNoYW5nZVB4V2lkdGggOiAwKSxcblx0XHRcdFx0XHRcdFx0XHRoZWlnaHQ6IHZpZXdTaXplLmhlaWdodCArIChzaXplQ2hhbmdlUHhIZWlnaHQgJiYgaGVpZ2h0ID09PSBuZXdIZWlnaHQgPyBzaXplQ2hhbmdlUHhIZWlnaHQgOiAwKVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybjsgLy8gQ2Fubm90IHJlc2l6ZSBvdGhlciBwYXJ0c1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2V0QWN0aXZpdHlCYXJIaWRkZW4oaGlkZGVuOiBib29sZWFuLCBza2lwTGF5b3V0PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLkFDVElWSVRZQkFSX0hJRERFTiwgaGlkZGVuKTtcblx0XHR0aGlzLndvcmtiZW5jaEdyaWQuc2V0Vmlld1Zpc2libGUodGhpcy5hY3Rpdml0eUJhclBhcnRWaWV3LCAhaGlkZGVuKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0QmFubmVySGlkZGVuKGhpZGRlbjogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMud29ya2JlbmNoR3JpZC5zZXRWaWV3VmlzaWJsZSh0aGlzLmJhbm5lclBhcnRWaWV3LCAhaGlkZGVuKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0RWRpdG9ySGlkZGVuKGhpZGRlbjogYm9vbGVhbiwgc2tpcExheW91dD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnN0YXRlTW9kZWwuc2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5FRElUT1JfSElEREVOLCBoaWRkZW4pO1xuXG5cdFx0Ly8gQWRqdXN0IENTU1xuXHRcdGlmIChoaWRkZW4pIHtcblx0XHRcdHRoaXMubWFpbkNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKExheW91dENsYXNzZXMuTUFJTl9FRElUT1JfQVJFQV9ISURERU4pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShMYXlvdXRDbGFzc2VzLk1BSU5fRURJVE9SX0FSRUFfSElEREVOKTtcblx0XHR9XG5cblx0XHQvLyBQcm9wYWdhdGUgdG8gZ3JpZFxuXHRcdHRoaXMud29ya2JlbmNoR3JpZC5zZXRWaWV3VmlzaWJsZSh0aGlzLmVkaXRvclBhcnRWaWV3LCAhaGlkZGVuKTtcblxuXHRcdC8vIFRoZSBlZGl0b3IgYW5kIHBhbmVsIGNhbm5vdCBiZSBoaWRkZW4gYXQgdGhlIHNhbWUgdGltZVxuXHRcdGlmIChoaWRkZW4gJiYgIXRoaXMuaXNWaXNpYmxlKFBhcnRzLlBBTkVMX1BBUlQpKSB7XG5cdFx0XHR0aGlzLnNldFBhbmVsSGlkZGVuKGZhbHNlLCB0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRnZXRMYXlvdXRDbGFzc2VzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gY29hbGVzY2UoW1xuXHRcdFx0IXRoaXMuaXNWaXNpYmxlKFBhcnRzLlNJREVCQVJfUEFSVCkgPyBMYXlvdXRDbGFzc2VzLlNJREVCQVJfSElEREVOIDogdW5kZWZpbmVkLFxuXHRcdFx0IXRoaXMuaXNWaXNpYmxlKFBhcnRzLkVESVRPUl9QQVJULCBtYWluV2luZG93KSA/IExheW91dENsYXNzZXMuTUFJTl9FRElUT1JfQVJFQV9ISURERU4gOiB1bmRlZmluZWQsXG5cdFx0XHQhdGhpcy5pc1Zpc2libGUoUGFydHMuUEFORUxfUEFSVCkgPyBMYXlvdXRDbGFzc2VzLlBBTkVMX0hJRERFTiA6IHVuZGVmaW5lZCxcblx0XHRcdCF0aGlzLmlzVmlzaWJsZShQYXJ0cy5BVVhJTElBUllCQVJfUEFSVCkgPyBMYXlvdXRDbGFzc2VzLkFVWElMSUFSWUJBUl9ISURERU4gOiB1bmRlZmluZWQsXG5cdFx0XHQhdGhpcy5pc1Zpc2libGUoUGFydHMuU1RBVFVTQkFSX1BBUlQpID8gTGF5b3V0Q2xhc3Nlcy5TVEFUVVNCQVJfSElEREVOIDogdW5kZWZpbmVkLFxuXHRcdFx0dGhpcy5zdGF0ZS5ydW50aW1lLm1haW5XaW5kb3dGdWxsc2NyZWVuID8gTGF5b3V0Q2xhc3Nlcy5GVUxMU0NSRUVOIDogdW5kZWZpbmVkXG5cdFx0XSk7XG5cdH1cblxuXHRwcml2YXRlIHNldFNpZGVCYXJIaWRkZW4oaGlkZGVuOiBib29sZWFuLCBza2lwTGF5b3V0PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlNJREVCQVJfSElEREVOLCBoaWRkZW4pO1xuXG5cdFx0Ly8gQWRqdXN0IENTU1xuXHRcdGlmIChoaWRkZW4pIHtcblx0XHRcdHRoaXMubWFpbkNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKExheW91dENsYXNzZXMuU0lERUJBUl9ISURERU4pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShMYXlvdXRDbGFzc2VzLlNJREVCQVJfSElEREVOKTtcblx0XHR9XG5cblx0XHQvLyBJZiBzaWRlYmFyIGJlY29tZXMgaGlkZGVuLCBhbHNvIGhpZGUgdGhlIGN1cnJlbnQgYWN0aXZlIFZpZXdsZXQgaWYgYW55XG5cdFx0aWYgKGhpZGRlbiAmJiB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpKSB7XG5cdFx0XHR0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmhpZGVBY3RpdmVQYW5lQ29tcG9zaXRlKFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRcdHRoaXMuZm9jdXNQYW5lbE9yRWRpdG9yKCk7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgc2lkZWJhciBiZWNvbWVzIHZpc2libGUsIHNob3cgbGFzdCBhY3RpdmUgVmlld2xldCBvciBkZWZhdWx0IHZpZXdsZXRcblx0XHRlbHNlIGlmICghaGlkZGVuICYmICF0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpKSB7XG5cdFx0XHRjb25zdCB2aWV3bGV0VG9PcGVuID0gdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5nZXRMYXN0QWN0aXZlUGFuZUNvbXBvc2l0ZUlkKFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKTtcblx0XHRcdGlmICh2aWV3bGV0VG9PcGVuKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdsZXQgPSB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLm9wZW5QYW5lQ29tcG9zaXRlKHZpZXdsZXRUb09wZW4sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLCB0cnVlKTtcblx0XHRcdFx0aWYgKCF2aWV3bGV0KSB7XG5cdFx0XHRcdFx0dGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZSh0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXREZWZhdWx0Vmlld0NvbnRhaW5lcihWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik/LmlkLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhciwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBQcm9wYWdhdGUgdG8gZ3JpZFxuXHRcdHRoaXMud29ya2JlbmNoR3JpZC5zZXRWaWV3VmlzaWJsZSh0aGlzLnNpZGVCYXJQYXJ0VmlldywgIWhpZGRlbik7XG5cdH1cblxuXHRwcml2YXRlIGhhc1ZpZXdzKGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5SWQoaWQpO1xuXHRcdGlmICghdmlld0NvbnRhaW5lcikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdDb250YWluZXJNb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbCh2aWV3Q29udGFpbmVyKTtcblx0XHRpZiAoIXZpZXdDb250YWluZXJNb2RlbCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB2aWV3Q29udGFpbmVyTW9kZWwuYWN0aXZlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCA+PSAxO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGp1c3RQYXJ0UG9zaXRpb25zKHNpZGVCYXJQb3NpdGlvbjogUG9zaXRpb24sIHBhbmVsQWxpZ25tZW50OiBQYW5lbEFsaWdubWVudCwgcGFuZWxQb3NpdGlvbjogUG9zaXRpb24pOiB2b2lkIHtcblxuXHRcdC8vIE1vdmUgYWN0aXZpdHkgYmFyIGFuZCBzaWRlIGJhcnNcblx0XHRjb25zdCBpc1BhbmVsVmVydGljYWwgPSAhaXNIb3Jpem9udGFsKHBhbmVsUG9zaXRpb24pO1xuXHRcdGNvbnN0IHNpZGVCYXJTaWJsaW5nVG9FZGl0b3IgPSBpc1BhbmVsVmVydGljYWwgfHwgIShwYW5lbEFsaWdubWVudCA9PT0gJ2NlbnRlcicgfHwgKHNpZGVCYXJQb3NpdGlvbiA9PT0gUG9zaXRpb24uTEVGVCAmJiBwYW5lbEFsaWdubWVudCA9PT0gJ3JpZ2h0JykgfHwgKHNpZGVCYXJQb3NpdGlvbiA9PT0gUG9zaXRpb24uUklHSFQgJiYgcGFuZWxBbGlnbm1lbnQgPT09ICdsZWZ0JykpO1xuXHRcdGNvbnN0IGF1eGlsaWFyeUJhclNpYmxpbmdUb0VkaXRvciA9IGlzUGFuZWxWZXJ0aWNhbCB8fCAhKHBhbmVsQWxpZ25tZW50ID09PSAnY2VudGVyJyB8fCAoc2lkZUJhclBvc2l0aW9uID09PSBQb3NpdGlvbi5SSUdIVCAmJiBwYW5lbEFsaWdubWVudCA9PT0gJ3JpZ2h0JykgfHwgKHNpZGVCYXJQb3NpdGlvbiA9PT0gUG9zaXRpb24uTEVGVCAmJiBwYW5lbEFsaWdubWVudCA9PT0gJ2xlZnQnKSk7XG5cdFx0Y29uc3QgcHJlTW92ZVBhbmVsV2lkdGggPSAhdGhpcy5pc1Zpc2libGUoUGFydHMuUEFORUxfUEFSVCkgPyBTaXppbmcuSW52aXNpYmxlKHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3Q2FjaGVkVmlzaWJsZVNpemUodGhpcy5wYW5lbFBhcnRWaWV3KSA/PyB0aGlzLnBhbmVsUGFydFZpZXcubWluaW11bVdpZHRoKSA6IHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLnBhbmVsUGFydFZpZXcpLndpZHRoO1xuXHRcdGNvbnN0IHByZU1vdmVQYW5lbEhlaWdodCA9ICF0aGlzLmlzVmlzaWJsZShQYXJ0cy5QQU5FTF9QQVJUKSA/IFNpemluZy5JbnZpc2libGUodGhpcy53b3JrYmVuY2hHcmlkLmdldFZpZXdDYWNoZWRWaXNpYmxlU2l6ZSh0aGlzLnBhbmVsUGFydFZpZXcpID8/IHRoaXMucGFuZWxQYXJ0Vmlldy5taW5pbXVtSGVpZ2h0KSA6IHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLnBhbmVsUGFydFZpZXcpLmhlaWdodDtcblx0XHRjb25zdCBwcmVNb3ZlU2lkZUJhclNpemUgPSAhdGhpcy5pc1Zpc2libGUoUGFydHMuU0lERUJBUl9QQVJUKSA/IFNpemluZy5JbnZpc2libGUodGhpcy53b3JrYmVuY2hHcmlkLmdldFZpZXdDYWNoZWRWaXNpYmxlU2l6ZSh0aGlzLnNpZGVCYXJQYXJ0VmlldykgPz8gdGhpcy5zaWRlQmFyUGFydFZpZXcubWluaW11bVdpZHRoKSA6IHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLnNpZGVCYXJQYXJ0Vmlldykud2lkdGg7XG5cdFx0Y29uc3QgcHJlTW92ZUF1eGlsaWFyeUJhclNpemUgPSAhdGhpcy5pc1Zpc2libGUoUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQpID8gU2l6aW5nLkludmlzaWJsZSh0aGlzLndvcmtiZW5jaEdyaWQuZ2V0Vmlld0NhY2hlZFZpc2libGVTaXplKHRoaXMuYXV4aWxpYXJ5QmFyUGFydFZpZXcpID8/IHRoaXMuYXV4aWxpYXJ5QmFyUGFydFZpZXcubWluaW11bVdpZHRoKSA6IHRoaXMud29ya2JlbmNoR3JpZC5nZXRWaWV3U2l6ZSh0aGlzLmF1eGlsaWFyeUJhclBhcnRWaWV3KS53aWR0aDtcblxuXHRcdGNvbnN0IGZvY3VzZWRQYXJ0ID0gW1BhcnRzLlBBTkVMX1BBUlQsIFBhcnRzLlNJREVCQVJfUEFSVCwgUGFydHMuQVVYSUxJQVJZQkFSX1BBUlRdLmZpbmQocGFydCA9PiB0aGlzLmhhc0ZvY3VzKHBhcnQpKSBhcyBTSU5HTEVfV0lORE9XX1BBUlRTIHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKHNpZGVCYXJQb3NpdGlvbiA9PT0gUG9zaXRpb24uTEVGVCkge1xuXHRcdFx0dGhpcy53b3JrYmVuY2hHcmlkLm1vdmVWaWV3VG8odGhpcy5hY3Rpdml0eUJhclBhcnRWaWV3LCBbMiwgMF0pO1xuXHRcdFx0dGhpcy53b3JrYmVuY2hHcmlkLm1vdmVWaWV3KHRoaXMuc2lkZUJhclBhcnRWaWV3LCBwcmVNb3ZlU2lkZUJhclNpemUsIHNpZGVCYXJTaWJsaW5nVG9FZGl0b3IgPyB0aGlzLmVkaXRvclBhcnRWaWV3IDogdGhpcy5hY3Rpdml0eUJhclBhcnRWaWV3LCBzaWRlQmFyU2libGluZ1RvRWRpdG9yID8gRGlyZWN0aW9uLkxlZnQgOiBEaXJlY3Rpb24uUmlnaHQpO1xuXHRcdFx0aWYgKGF1eGlsaWFyeUJhclNpYmxpbmdUb0VkaXRvcikge1xuXHRcdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQubW92ZVZpZXcodGhpcy5hdXhpbGlhcnlCYXJQYXJ0VmlldywgcHJlTW92ZUF1eGlsaWFyeUJhclNpemUsIHRoaXMuZWRpdG9yUGFydFZpZXcsIERpcmVjdGlvbi5SaWdodCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQubW92ZVZpZXdUbyh0aGlzLmF1eGlsaWFyeUJhclBhcnRWaWV3LCBbMiwgLTFdKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy53b3JrYmVuY2hHcmlkLm1vdmVWaWV3VG8odGhpcy5hY3Rpdml0eUJhclBhcnRWaWV3LCBbMiwgLTFdKTtcblx0XHRcdHRoaXMud29ya2JlbmNoR3JpZC5tb3ZlVmlldyh0aGlzLnNpZGVCYXJQYXJ0VmlldywgcHJlTW92ZVNpZGVCYXJTaXplLCBzaWRlQmFyU2libGluZ1RvRWRpdG9yID8gdGhpcy5lZGl0b3JQYXJ0VmlldyA6IHRoaXMuYWN0aXZpdHlCYXJQYXJ0Vmlldywgc2lkZUJhclNpYmxpbmdUb0VkaXRvciA/IERpcmVjdGlvbi5SaWdodCA6IERpcmVjdGlvbi5MZWZ0KTtcblx0XHRcdGlmIChhdXhpbGlhcnlCYXJTaWJsaW5nVG9FZGl0b3IpIHtcblx0XHRcdFx0dGhpcy53b3JrYmVuY2hHcmlkLm1vdmVWaWV3KHRoaXMuYXV4aWxpYXJ5QmFyUGFydFZpZXcsIHByZU1vdmVBdXhpbGlhcnlCYXJTaXplLCB0aGlzLmVkaXRvclBhcnRWaWV3LCBEaXJlY3Rpb24uTGVmdCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQubW92ZVZpZXdUbyh0aGlzLmF1eGlsaWFyeUJhclBhcnRWaWV3LCBbMiwgMF0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE1haW50YWluIGZvY3VzIGFmdGVyIG1vdmluZyBwYXJ0c1xuXHRcdGlmIChmb2N1c2VkUGFydCkge1xuXHRcdFx0dGhpcy5mb2N1c1BhcnQoZm9jdXNlZFBhcnQpO1xuXHRcdH1cblxuXHRcdC8vIFdlIG1vdmVkIGFsbCB0aGUgc2lkZSBwYXJ0cyBiYXNlZCBvbiB0aGUgZWRpdG9yIGFuZCBpZ25vcmVkIHRoZSBwYW5lbFxuXHRcdC8vIE5vdywgd2UgbmVlZCB0byBwdXQgdGhlIHBhbmVsIGJhY2sgaW4gdGhlIHJpZ2h0IHBvc2l0aW9uIHdoZW4gaXQgaXMgbmV4dCB0byB0aGUgZWRpdG9yXG5cdFx0aWYgKGlzUGFuZWxWZXJ0aWNhbCkge1xuXHRcdFx0dGhpcy53b3JrYmVuY2hHcmlkLm1vdmVWaWV3KHRoaXMucGFuZWxQYXJ0VmlldywgcHJlTW92ZVBhbmVsV2lkdGgsIHRoaXMuZWRpdG9yUGFydFZpZXcsIHBhbmVsUG9zaXRpb24gPT09IFBvc2l0aW9uLkxFRlQgPyBEaXJlY3Rpb24uTGVmdCA6IERpcmVjdGlvbi5SaWdodCk7XG5cdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQucmVzaXplVmlldyh0aGlzLnBhbmVsUGFydFZpZXcsIHtcblx0XHRcdFx0aGVpZ2h0OiBwcmVNb3ZlUGFuZWxIZWlnaHQgYXMgbnVtYmVyLFxuXHRcdFx0XHR3aWR0aDogcHJlTW92ZVBhbmVsV2lkdGggYXMgbnVtYmVyXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBNb3Zpbmcgdmlld3MgaW4gdGhlIGdyaWQgY2FuIGNhdXNlIHRoZW0gdG8gcmUtZGlzdHJpYnV0ZSBzaXppbmcgdW5uZWNlc3NhcmlseVxuXHRcdC8vIFJlc2l6ZSB2aXNpYmxlIHBhcnRzIHRvIHRoZSB3aWR0aCB0aGV5IHdlcmUgYmVmb3JlIHRoZSBvcGVyYXRpb25cblx0XHRpZiAodGhpcy5pc1Zpc2libGUoUGFydHMuU0lERUJBUl9QQVJUKSkge1xuXHRcdFx0dGhpcy53b3JrYmVuY2hHcmlkLnJlc2l6ZVZpZXcodGhpcy5zaWRlQmFyUGFydFZpZXcsIHtcblx0XHRcdFx0aGVpZ2h0OiB0aGlzLndvcmtiZW5jaEdyaWQuZ2V0Vmlld1NpemUodGhpcy5zaWRlQmFyUGFydFZpZXcpLmhlaWdodCxcblx0XHRcdFx0d2lkdGg6IHByZU1vdmVTaWRlQmFyU2l6ZSBhcyBudW1iZXJcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzVmlzaWJsZShQYXJ0cy5BVVhJTElBUllCQVJfUEFSVCkpIHtcblx0XHRcdHRoaXMud29ya2JlbmNoR3JpZC5yZXNpemVWaWV3KHRoaXMuYXV4aWxpYXJ5QmFyUGFydFZpZXcsIHtcblx0XHRcdFx0aGVpZ2h0OiB0aGlzLndvcmtiZW5jaEdyaWQuZ2V0Vmlld1NpemUodGhpcy5hdXhpbGlhcnlCYXJQYXJ0VmlldykuaGVpZ2h0LFxuXHRcdFx0XHR3aWR0aDogcHJlTW92ZUF1eGlsaWFyeUJhclNpemUgYXMgbnVtYmVyXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRzZXRQYW5lbEFsaWdubWVudChhbGlnbm1lbnQ6IFBhbmVsQWxpZ25tZW50LCBza2lwTGF5b3V0PzogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0Ly8gUGFuZWwgYWxpZ25tZW50IG9ubHkgYXBwbGllcyB0byBhIHBhbmVsIGluIHRoZSB0b3AvYm90dG9tIHBvc2l0aW9uXG5cdFx0aWYgKCFpc0hvcml6b250YWwodGhpcy5nZXRQYW5lbFBvc2l0aW9uKCkpKSB7XG5cdFx0XHR0aGlzLnNldFBhbmVsUG9zaXRpb24oUG9zaXRpb24uQk9UVE9NKTtcblx0XHR9XG5cblx0XHQvLyB0aGUgd29ya2JlbmNoIGdyaWQgY3VycmVudGx5IHByZXZlbnRzIHVzIGZyb20gc3VwcG9ydGluZyBwYW5lbCBtYXhpbWl6YXRpb24gd2l0aCBub24tY2VudGVyIHBhbmVsIGFsaWdubWVudFxuXHRcdGlmIChhbGlnbm1lbnQgIT09ICdjZW50ZXInICYmIHRoaXMuaXNQYW5lbE1heGltaXplZCgpKSB7XG5cdFx0XHR0aGlzLnRvZ2dsZU1heGltaXplZFBhbmVsKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zdGF0ZU1vZGVsLnNldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfQUxJR05NRU5ULCBhbGlnbm1lbnQpO1xuXG5cdFx0dGhpcy5hZGp1c3RQYXJ0UG9zaXRpb25zKHRoaXMuZ2V0U2lkZUJhclBvc2l0aW9uKCksIGFsaWdubWVudCwgdGhpcy5nZXRQYW5lbFBvc2l0aW9uKCkpO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VQYW5lbEFsaWdubWVudC5maXJlKGFsaWdubWVudCk7XG5cdH1cblxuXHRwcml2YXRlIHNldFBhbmVsSGlkZGVuKGhpZGRlbjogYm9vbGVhbiwgc2tpcExheW91dD86IGJvb2xlYW4pOiB2b2lkIHtcblxuXHRcdC8vIFJldHVybiBpZiBub3QgaW5pdGlhbGl6ZWQgZnVsbHkgIzEwNTQ4MFxuXHRcdGlmICghdGhpcy53b3JrYmVuY2hHcmlkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2FzSGlkZGVuID0gIXRoaXMuaXNWaXNpYmxlKFBhcnRzLlBBTkVMX1BBUlQpO1xuXG5cdFx0dGhpcy5zdGF0ZU1vZGVsLnNldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfSElEREVOLCBoaWRkZW4pO1xuXG5cdFx0Y29uc3QgaXNQYW5lbE1heGltaXplZCA9IHRoaXMuaXNQYW5lbE1heGltaXplZCgpO1xuXHRcdGNvbnN0IHBhbmVsT3BlbnNNYXhpbWl6ZWQgPSB0aGlzLnBhbmVsT3BlbnNNYXhpbWl6ZWQoKTtcblxuXHRcdC8vIEFkanVzdCBDU1Ncblx0XHRpZiAoaGlkZGVuKSB7XG5cdFx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LmFkZChMYXlvdXRDbGFzc2VzLlBBTkVMX0hJRERFTik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubWFpbkNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKExheW91dENsYXNzZXMuUEFORUxfSElEREVOKTtcblx0XHR9XG5cblx0XHQvLyBJZiBwYW5lbCBwYXJ0IGJlY29tZXMgaGlkZGVuLCBhbHNvIGhpZGUgdGhlIGN1cnJlbnQgYWN0aXZlIHBhbmVsIGlmIGFueVxuXHRcdGxldCBmb2N1c0VkaXRvciA9IGZhbHNlO1xuXHRcdGlmIChoaWRkZW4gJiYgdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCkpIHtcblx0XHRcdHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2UuaGlkZUFjdGl2ZVBhbmVDb21wb3NpdGUoVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKTtcblx0XHRcdGZvY3VzRWRpdG9yID0gaXNJT1MgPyBmYWxzZSA6IHRydWU7IC8vIERvIG5vdCBhdXRvIGZvY3VzIG9uIGlvcyAjMTI3ODMyXG5cdFx0fVxuXG5cdFx0Ly8gSWYgcGFuZWwgcGFydCBiZWNvbWVzIHZpc2libGUsIHNob3cgbGFzdCBhY3RpdmUgcGFuZWwgb3IgZGVmYXVsdCBwYW5lbFxuXHRcdGVsc2UgaWYgKCFoaWRkZW4gJiYgIXRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZShWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpKSB7XG5cdFx0XHRsZXQgcGFuZWxUb09wZW46IHN0cmluZyB8IHVuZGVmaW5lZCA9IHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0TGFzdEFjdGl2ZVBhbmVDb21wb3NpdGVJZChWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpO1xuXG5cdFx0XHQvLyB2ZXJpZnkgdGhhdCB0aGUgcGFuZWwgd2UgdHJ5IHRvIG9wZW4gaGFzIHZpZXdzIGJlZm9yZSB3ZSBkZWZhdWx0IHRvIGl0XG5cdFx0XHQvLyBvdGhlcndpc2UgZmFsbCBiYWNrIHRvIGFueSB2aWV3IHRoYXQgaGFzIHZpZXdzIHN0aWxsIHJlZnMgIzExMTQ2M1xuXHRcdFx0aWYgKCFwYW5lbFRvT3BlbiB8fCAhdGhpcy5oYXNWaWV3cyhwYW5lbFRvT3BlbikpIHtcblx0XHRcdFx0cGFuZWxUb09wZW4gPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZVxuXHRcdFx0XHRcdC5nZXRWaWV3Q29udGFpbmVyc0J5TG9jYXRpb24oVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKVxuXHRcdFx0XHRcdC5maW5kKHZpZXdDb250YWluZXIgPT4gdGhpcy5oYXNWaWV3cyh2aWV3Q29udGFpbmVyLmlkKSk/LmlkO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocGFuZWxUb09wZW4pIHtcblx0XHRcdFx0Y29uc3QgZm9jdXMgPSAhc2tpcExheW91dDtcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLm9wZW5QYW5lQ29tcG9zaXRlKHBhbmVsVG9PcGVuLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsIGZvY3VzKTtcblx0XHRcdFx0aWYgKCFwYW5lbCkge1xuXHRcdFx0XHRcdHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2Uub3BlblBhbmVDb21wb3NpdGUodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIoVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKT8uaWQsIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCwgZm9jdXMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSWYgbWF4aW1pemVkIGFuZCBpbiBwcm9jZXNzIG9mIGhpZGluZywgdW5tYXhpbWl6ZSBiZWZvcmUgaGlkaW5nIHRvIGFsbG93IGNhY2hpbmcgb2Ygbm9uLW1heGltaXplZCBzaXplXG5cdFx0aWYgKGhpZGRlbiAmJiBpc1BhbmVsTWF4aW1pemVkKSB7XG5cdFx0XHR0aGlzLnRvZ2dsZU1heGltaXplZFBhbmVsKCk7XG5cdFx0fVxuXG5cdFx0Ly8gRG9uJ3QgcHJvY2VlZCBpZiB3ZSBoYXZlIGFscmVhZHkgZG9uZSB0aGlzIGJlZm9yZVxuXHRcdGlmICh3YXNIaWRkZW4gPT09IGhpZGRlbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFByb3BhZ2F0ZSBsYXlvdXQgY2hhbmdlcyB0byBncmlkXG5cdFx0dGhpcy53b3JrYmVuY2hHcmlkLnNldFZpZXdWaXNpYmxlKHRoaXMucGFuZWxQYXJ0VmlldywgIWhpZGRlbik7XG5cblx0XHQvLyBJZiBpbiBwcm9jZXNzIG9mIHNob3dpbmcsIHRvZ2dsZSB3aGV0aGVyIG9yIG5vdCBwYW5lbCBpcyBtYXhpbWl6ZWRcblx0XHRpZiAoIWhpZGRlbikge1xuXHRcdFx0aWYgKCFza2lwTGF5b3V0ICYmIGlzUGFuZWxNYXhpbWl6ZWQgIT09IHBhbmVsT3BlbnNNYXhpbWl6ZWQpIHtcblx0XHRcdFx0dGhpcy50b2dnbGVNYXhpbWl6ZWRQYW5lbCgpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBJZiBpbiBwcm9jZXNzIG9mIGhpZGluZywgcmVtZW1iZXIgd2hldGhlciB0aGUgcGFuZWwgaXMgbWF4aW1pemVkIG9yIG5vdFxuXHRcdFx0dGhpcy5zdGF0ZU1vZGVsLnNldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfV0FTX0xBU1RfTUFYSU1JWkVELCBpc1BhbmVsTWF4aW1pemVkKTtcblx0XHR9XG5cblx0XHRpZiAoZm9jdXNFZGl0b3IpIHtcblx0XHRcdHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0LmFjdGl2ZUdyb3VwLmZvY3VzKCk7IC8vIFBhc3MgZm9jdXMgdG8gZWRpdG9yIGdyb3VwIGlmIHBhbmVsIHBhcnQgaXMgbm93IGhpZGRlblxuXHRcdH1cblx0fVxuXG5cdHRvZ2dsZU1heGltaXplZFBhbmVsKCk6IHZvaWQge1xuXHRcdGNvbnN0IHNpemUgPSB0aGlzLndvcmtiZW5jaEdyaWQuZ2V0Vmlld1NpemUodGhpcy5wYW5lbFBhcnRWaWV3KTtcblx0XHRjb25zdCBwYW5lbFBvc2l0aW9uID0gdGhpcy5nZXRQYW5lbFBvc2l0aW9uKCk7XG5cdFx0Y29uc3QgaXNNYXhpbWl6ZWQgPSB0aGlzLmlzUGFuZWxNYXhpbWl6ZWQoKTtcblx0XHRpZiAoIWlzTWF4aW1pemVkKSB7XG5cdFx0XHRpZiAodGhpcy5pc1Zpc2libGUoUGFydHMuUEFORUxfUEFSVCkpIHtcblx0XHRcdFx0aWYgKGlzSG9yaXpvbnRhbChwYW5lbFBvc2l0aW9uKSkge1xuXHRcdFx0XHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX0xBU1RfTk9OX01BWElNSVpFRF9IRUlHSFQsIHNpemUuaGVpZ2h0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnN0YXRlTW9kZWwuc2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5QQU5FTF9MQVNUX05PTl9NQVhJTUlaRURfV0lEVEgsIHNpemUud2lkdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc2V0RWRpdG9ySGlkZGVuKHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNldEVkaXRvckhpZGRlbihmYWxzZSk7XG5cdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQucmVzaXplVmlldyh0aGlzLnBhbmVsUGFydFZpZXcsIHtcblx0XHRcdFx0d2lkdGg6IGlzSG9yaXpvbnRhbChwYW5lbFBvc2l0aW9uKSA/IHNpemUud2lkdGggOiB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5QQU5FTF9MQVNUX05PTl9NQVhJTUlaRURfV0lEVEgpLFxuXHRcdFx0XHRoZWlnaHQ6IGlzSG9yaXpvbnRhbChwYW5lbFBvc2l0aW9uKSA/IHRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX0xBU1RfTk9OX01BWElNSVpFRF9IRUlHSFQpIDogc2l6ZS5oZWlnaHRcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX1dBU19MQVNUX01BWElNSVpFRCwgIWlzTWF4aW1pemVkKTtcblx0fVxuXG5cdHByaXZhdGUgcGFuZWxPcGVuc01heGltaXplZCgpOiBib29sZWFuIHtcblxuXHRcdC8vIFRoZSB3b3JrYmVuY2ggZ3JpZCBjdXJyZW50bHkgcHJldmVudHMgdXMgZnJvbSBzdXBwb3J0aW5nIHBhbmVsIG1heGltaXphdGlvbiB3aXRoIG5vbi1jZW50ZXIgcGFuZWwgYWxpZ25tZW50XG5cdFx0aWYgKHRoaXMuZ2V0UGFuZWxBbGlnbm1lbnQoKSAhPT0gJ2NlbnRlcicgJiYgaXNIb3Jpem9udGFsKHRoaXMuZ2V0UGFuZWxQb3NpdGlvbigpKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBhbmVsT3BlbnNNYXhpbWl6ZWQgPSBwYW5lbE9wZW5zTWF4aW1pemVkRnJvbVN0cmluZyh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oV29ya2JlbmNoTGF5b3V0U2V0dGluZ3MuUEFORUxfT1BFTlNfTUFYSU1JWkVEKSk7XG5cdFx0Y29uc3QgcGFuZWxMYXN0SXNNYXhpbWl6ZWQgPSB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5QQU5FTF9XQVNfTEFTVF9NQVhJTUlaRUQpO1xuXG5cdFx0cmV0dXJuIHBhbmVsT3BlbnNNYXhpbWl6ZWQgPT09IFBhbmVsT3BlbnNNYXhpbWl6ZWRPcHRpb25zLkFMV0FZUyB8fCAocGFuZWxPcGVuc01heGltaXplZCA9PT0gUGFuZWxPcGVuc01heGltaXplZE9wdGlvbnMuUkVNRU1CRVJfTEFTVCAmJiBwYW5lbExhc3RJc01heGltaXplZCk7XG5cdH1cblxuXHRwcml2YXRlIHNldEF1eGlsaWFyeUJhckhpZGRlbihoaWRkZW46IGJvb2xlYW4sIHNraXBMYXlvdXQ/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5zdGF0ZU1vZGVsLnNldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuQVVYSUxJQVJZQkFSX0hJRERFTiwgaGlkZGVuKTtcblxuXHRcdC8vIEFkanVzdCBDU1Ncblx0XHRpZiAoaGlkZGVuKSB7XG5cdFx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LmFkZChMYXlvdXRDbGFzc2VzLkFVWElMSUFSWUJBUl9ISURERU4pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShMYXlvdXRDbGFzc2VzLkFVWElMSUFSWUJBUl9ISURERU4pO1xuXHRcdH1cblxuXHRcdC8vIElmIGF1eGlsaWFyeSBiYXIgYmVjb21lcyBoaWRkZW4sIGFsc28gaGlkZSB0aGUgY3VycmVudCBhY3RpdmUgcGFuZSBjb21wb3NpdGUgaWYgYW55XG5cdFx0aWYgKGhpZGRlbiAmJiB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUoVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcikpIHtcblx0XHRcdHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2UuaGlkZUFjdGl2ZVBhbmVDb21wb3NpdGUoVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcik7XG5cdFx0XHR0aGlzLmZvY3VzUGFuZWxPckVkaXRvcigpO1xuXHRcdH1cblxuXHRcdC8vIElmIGF1eGlsaWFyeSBiYXIgYmVjb21lcyB2aXNpYmxlLCBzaG93IGxhc3QgYWN0aXZlIHBhbmUgY29tcG9zaXRlIG9yIGRlZmF1bHQgcGFuZSBjb21wb3NpdGVcblx0XHRlbHNlIGlmICghaGlkZGVuICYmICF0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUoVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcikpIHtcblx0XHRcdGxldCB2aWV3bGV0VG9PcGVuOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldExhc3RBY3RpdmVQYW5lQ29tcG9zaXRlSWQoVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcik7XG5cblx0XHRcdC8vIHZlcmlmeSB0aGF0IHRoZSB2aWV3bGV0IHdlIHRyeSB0byBvcGVuIGhhcyB2aWV3cyBiZWZvcmUgd2UgZGVmYXVsdCB0byBpdFxuXHRcdFx0Ly8gb3RoZXJ3aXNlIGZhbGwgYmFjayB0byBhbnkgdmlldyB0aGF0IGhhcyB2aWV3cyBzdGlsbCByZWZzICMxMTE0NjNcblx0XHRcdGlmICghdmlld2xldFRvT3BlbiB8fCAhdGhpcy5oYXNWaWV3cyh2aWV3bGV0VG9PcGVuKSkge1xuXHRcdFx0XHR2aWV3bGV0VG9PcGVuID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2Vcblx0XHRcdFx0XHQuZ2V0Vmlld0NvbnRhaW5lcnNCeUxvY2F0aW9uKFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIpXG5cdFx0XHRcdFx0LmZpbmQodmlld0NvbnRhaW5lciA9PiB0aGlzLmhhc1ZpZXdzKHZpZXdDb250YWluZXIuaWQpKT8uaWQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh2aWV3bGV0VG9PcGVuKSB7XG5cdFx0XHRcdGNvbnN0IGZvY3VzID0gIXNraXBMYXlvdXQ7XG5cdFx0XHRcdGNvbnN0IHZpZXdsZXQgPSB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLm9wZW5QYW5lQ29tcG9zaXRlKHZpZXdsZXRUb09wZW4sIFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIsIGZvY3VzKTtcblx0XHRcdFx0aWYgKCF2aWV3bGV0KSB7XG5cdFx0XHRcdFx0dGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZSh0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXREZWZhdWx0Vmlld0NvbnRhaW5lcihWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKT8uaWQsIFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIsIGZvY3VzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFByb3BhZ2F0ZSB0byBncmlkXG5cdFx0dGhpcy53b3JrYmVuY2hHcmlkLnNldFZpZXdWaXNpYmxlKHRoaXMuYXV4aWxpYXJ5QmFyUGFydFZpZXcsICFoaWRkZW4pO1xuXHR9XG5cblx0c2V0UGFydEhpZGRlbihoaWRkZW46IGJvb2xlYW4sIHBhcnQ6IEV4Y2x1ZGU8U0lOR0xFX1dJTkRPV19QQVJUUywgUGFydHMuU1RBVFVTQkFSX1BBUlQgfCBQYXJ0cy5USVRMRUJBUl9QQVJUPik6IHZvaWQ7XG5cdHNldFBhcnRIaWRkZW4oaGlkZGVuOiBib29sZWFuLCBwYXJ0OiBFeGNsdWRlPE1VTFRJX1dJTkRPV19QQVJUUywgUGFydHMuU1RBVFVTQkFSX1BBUlQgfCBQYXJ0cy5USVRMRUJBUl9QQVJUPiwgdGFyZ2V0V2luZG93OiBXaW5kb3cpOiB2b2lkO1xuXHRzZXRQYXJ0SGlkZGVuKGhpZGRlbjogYm9vbGVhbiwgcGFydDogUGFydHMsIHRhcmdldFdpbmRvdzogV2luZG93ID0gbWFpbldpbmRvdyk6IHZvaWQge1xuXHRcdHN3aXRjaCAocGFydCkge1xuXHRcdFx0Y2FzZSBQYXJ0cy5BQ1RJVklUWUJBUl9QQVJUOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRBY3Rpdml0eUJhckhpZGRlbihoaWRkZW4pO1xuXHRcdFx0Y2FzZSBQYXJ0cy5TSURFQkFSX1BBUlQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLnNldFNpZGVCYXJIaWRkZW4oaGlkZGVuKTtcblx0XHRcdGNhc2UgUGFydHMuRURJVE9SX1BBUlQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLnNldEVkaXRvckhpZGRlbihoaWRkZW4pO1xuXHRcdFx0Y2FzZSBQYXJ0cy5CQU5ORVJfUEFSVDpcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0QmFubmVySGlkZGVuKGhpZGRlbik7XG5cdFx0XHRjYXNlIFBhcnRzLkFVWElMSUFSWUJBUl9QQVJUOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRBdXhpbGlhcnlCYXJIaWRkZW4oaGlkZGVuKTtcblx0XHRcdGNhc2UgUGFydHMuUEFORUxfUEFSVDpcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UGFuZWxIaWRkZW4oaGlkZGVuKTtcblx0XHR9XG5cdH1cblxuXHRoYXNNYWluV2luZG93Qm9yZGVyKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnN0YXRlLnJ1bnRpbWUubWFpbldpbmRvd0JvcmRlcjtcblx0fVxuXG5cdGdldE1haW5XaW5kb3dCb3JkZXJSYWRpdXMoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0ZS5ydW50aW1lLm1haW5XaW5kb3dCb3JkZXIgJiYgaXNNYWNpbnRvc2ggPyAnMTBweCcgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRpc1BhbmVsTWF4aW1pemVkKCk6IGJvb2xlYW4ge1xuXHRcdC8vIHRoZSB3b3JrYmVuY2ggZ3JpZCBjdXJyZW50bHkgcHJldmVudHMgdXMgZnJvbSBzdXBwb3J0aW5nIHBhbmVsIG1heGltaXphdGlvbiB3aXRoIG5vbi1jZW50ZXIgcGFuZWwgYWxpZ25tZW50XG5cdFx0cmV0dXJuICh0aGlzLmdldFBhbmVsQWxpZ25tZW50KCkgPT09ICdjZW50ZXInIHx8ICFpc0hvcml6b250YWwodGhpcy5nZXRQYW5lbFBvc2l0aW9uKCkpKSAmJiAhdGhpcy5pc1Zpc2libGUoUGFydHMuRURJVE9SX1BBUlQsIG1haW5XaW5kb3cpO1xuXHR9XG5cblx0Z2V0U2lkZUJhclBvc2l0aW9uKCk6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9QT1NJVE9OKTtcblx0fVxuXG5cdGdldFBhbmVsQWxpZ25tZW50KCk6IFBhbmVsQWxpZ25tZW50IHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfQUxJR05NRU5UKTtcblx0fVxuXG5cdHVwZGF0ZU1lbnViYXJWaXNpYmlsaXR5KHNraXBMYXlvdXQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBzaG91bGRTaG93VGl0bGVCYXIgPSBzaG91bGRTaG93Q3VzdG9tVGl0bGVCYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgbWFpbldpbmRvdywgdGhpcy5zdGF0ZS5ydW50aW1lLm1lbnVCYXIudG9nZ2xlZCk7XG5cdFx0aWYgKCFza2lwTGF5b3V0ICYmIHRoaXMud29ya2JlbmNoR3JpZCAmJiBzaG91bGRTaG93VGl0bGVCYXIgIT09IHRoaXMuaXNWaXNpYmxlKFBhcnRzLlRJVExFQkFSX1BBUlQsIG1haW5XaW5kb3cpKSB7XG5cdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQuc2V0Vmlld1Zpc2libGUodGhpcy50aXRsZUJhclBhcnRWaWV3LCBzaG91bGRTaG93VGl0bGVCYXIpO1xuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZUN1c3RvbVRpdGxlQmFyVmlzaWJpbGl0eSgpOiB2b2lkIHtcblx0XHRjb25zdCBzaG91bGRTaG93VGl0bGVCYXIgPSBzaG91bGRTaG93Q3VzdG9tVGl0bGVCYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgbWFpbldpbmRvdywgdGhpcy5zdGF0ZS5ydW50aW1lLm1lbnVCYXIudG9nZ2xlZCk7XG5cdFx0Y29uc3QgdGl0bGViYXJWaXNpYmxlID0gdGhpcy5pc1Zpc2libGUoUGFydHMuVElUTEVCQVJfUEFSVCk7XG5cdFx0aWYgKHNob3VsZFNob3dUaXRsZUJhciAhPT0gdGl0bGViYXJWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQuc2V0Vmlld1Zpc2libGUodGhpcy50aXRsZUJhclBhcnRWaWV3LCBzaG91bGRTaG93VGl0bGVCYXIpO1xuXHRcdH1cblx0fVxuXG5cdHRvZ2dsZU1lbnVCYXIoKTogdm9pZCB7XG5cdFx0bGV0IGN1cnJlbnRWaXNpYmlsaXR5VmFsdWUgPSBnZXRNZW51QmFyVmlzaWJpbGl0eSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRpZiAodHlwZW9mIGN1cnJlbnRWaXNpYmlsaXR5VmFsdWUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjdXJyZW50VmlzaWJpbGl0eVZhbHVlID0gJ2NsYXNzaWMnO1xuXHRcdH1cblxuXHRcdGxldCBuZXdWaXNpYmlsaXR5VmFsdWU6IHN0cmluZztcblx0XHRpZiAoY3VycmVudFZpc2liaWxpdHlWYWx1ZSA9PT0gJ3Zpc2libGUnIHx8IGN1cnJlbnRWaXNpYmlsaXR5VmFsdWUgPT09ICdjbGFzc2ljJykge1xuXHRcdFx0bmV3VmlzaWJpbGl0eVZhbHVlID0gaGFzTmF0aXZlVGl0bGViYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkgPyAndG9nZ2xlJyA6ICdjb21wYWN0Jztcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3VmlzaWJpbGl0eVZhbHVlID0gJ2NsYXNzaWMnO1xuXHRcdH1cblxuXHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ3dpbmRvdy5tZW51QmFyVmlzaWJpbGl0eScsIG5ld1Zpc2liaWxpdHlWYWx1ZSk7XG5cdH1cblxuXHRnZXRQYW5lbFBvc2l0aW9uKCk6IFBvc2l0aW9uIHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfUE9TSVRJT04pO1xuXHR9XG5cblx0c2V0UGFuZWxQb3NpdGlvbihwb3NpdGlvbjogUG9zaXRpb24pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaXNWaXNpYmxlKFBhcnRzLlBBTkVMX1BBUlQpKSB7XG5cdFx0XHR0aGlzLnNldFBhbmVsSGlkZGVuKGZhbHNlKTtcblx0XHR9XG5cblx0XHRjb25zdCBwYW5lbFBhcnQgPSB0aGlzLmdldFBhcnQoUGFydHMuUEFORUxfUEFSVCk7XG5cdFx0Y29uc3Qgb2xkUG9zaXRpb25WYWx1ZSA9IHBvc2l0aW9uVG9TdHJpbmcodGhpcy5nZXRQYW5lbFBvc2l0aW9uKCkpO1xuXHRcdGNvbnN0IG5ld1Bvc2l0aW9uVmFsdWUgPSBwb3NpdGlvblRvU3RyaW5nKHBvc2l0aW9uKTtcblxuXHRcdC8vIEFkanVzdCBDU1Ncblx0XHRjb25zdCBwYW5lbENvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZChwYW5lbFBhcnQuZ2V0Q29udGFpbmVyKCkpO1xuXHRcdHBhbmVsQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUob2xkUG9zaXRpb25WYWx1ZSk7XG5cdFx0cGFuZWxDb250YWluZXIuY2xhc3NMaXN0LmFkZChuZXdQb3NpdGlvblZhbHVlKTtcblxuXHRcdC8vIFVwZGF0ZSBTdHlsZXNcblx0XHRwYW5lbFBhcnQudXBkYXRlU3R5bGVzKCk7XG5cblx0XHQvLyBMYXlvdXRcblx0XHRjb25zdCBzaXplID0gdGhpcy53b3JrYmVuY2hHcmlkLmdldFZpZXdTaXplKHRoaXMucGFuZWxQYXJ0Vmlldyk7XG5cdFx0Y29uc3Qgc2lkZUJhclNpemUgPSB0aGlzLndvcmtiZW5jaEdyaWQuZ2V0Vmlld1NpemUodGhpcy5zaWRlQmFyUGFydFZpZXcpO1xuXHRcdGNvbnN0IGF1eGlsaWFyeUJhclNpemUgPSB0aGlzLndvcmtiZW5jaEdyaWQuZ2V0Vmlld1NpemUodGhpcy5hdXhpbGlhcnlCYXJQYXJ0Vmlldyk7XG5cblx0XHRsZXQgZWRpdG9ySGlkZGVuID0gIXRoaXMuaXNWaXNpYmxlKFBhcnRzLkVESVRPUl9QQVJULCBtYWluV2luZG93KTtcblxuXHRcdC8vIFNhdmUgbGFzdCBub24tbWF4aW1pemVkIHNpemUgZm9yIHBhbmVsIGJlZm9yZSBtb3ZlXG5cdFx0aWYgKG5ld1Bvc2l0aW9uVmFsdWUgIT09IG9sZFBvc2l0aW9uVmFsdWUgJiYgIWVkaXRvckhpZGRlbikge1xuXG5cdFx0XHQvLyBTYXZlIHRoZSBjdXJyZW50IHNpemUgb2YgdGhlIHBhbmVsIGZvciB0aGUgbmV3IG9ydGhvZ29uYWwgZGlyZWN0aW9uXG5cdFx0XHQvLyBJZiBtb3ZpbmcgZG93biwgc2F2ZSB0aGUgd2lkdGggb2YgdGhlIHBhbmVsXG5cdFx0XHQvLyBPdGhlcndpc2UsIHNhdmUgdGhlIGhlaWdodCBvZiB0aGUgcGFuZWxcblx0XHRcdGlmIChpc0hvcml6b250YWwocG9zaXRpb24pKSB7XG5cdFx0XHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX0xBU1RfTk9OX01BWElNSVpFRF9XSURUSCwgc2l6ZS53aWR0aCk7XG5cdFx0XHR9IGVsc2UgaWYgKGlzSG9yaXpvbnRhbChwb3NpdGlvbkZyb21TdHJpbmcob2xkUG9zaXRpb25WYWx1ZSkpKSB7XG5cdFx0XHRcdHRoaXMuc3RhdGVNb2RlbC5zZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX0xBU1RfTk9OX01BWElNSVpFRF9IRUlHSFQsIHNpemUuaGVpZ2h0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaXNIb3Jpem9udGFsKHBvc2l0aW9uKSAmJiB0aGlzLmdldFBhbmVsQWxpZ25tZW50KCkgIT09ICdjZW50ZXInICYmIGVkaXRvckhpZGRlbikge1xuXHRcdFx0dGhpcy50b2dnbGVNYXhpbWl6ZWRQYW5lbCgpO1xuXHRcdFx0ZWRpdG9ySGlkZGVuID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5zdGF0ZU1vZGVsLnNldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfUE9TSVRJT04sIHBvc2l0aW9uKTtcblxuXHRcdGNvbnN0IHNpZGVCYXJWaXNpYmxlID0gdGhpcy5pc1Zpc2libGUoUGFydHMuU0lERUJBUl9QQVJUKTtcblx0XHRjb25zdCBhdXhpbGlhcnlCYXJWaXNpYmxlID0gdGhpcy5pc1Zpc2libGUoUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQpO1xuXG5cdFx0Y29uc3QgaGFkRm9jdXMgPSB0aGlzLmhhc0ZvY3VzKFBhcnRzLlBBTkVMX1BBUlQpO1xuXG5cdFx0aWYgKHBvc2l0aW9uID09PSBQb3NpdGlvbi5CT1RUT00pIHtcblx0XHRcdHRoaXMud29ya2JlbmNoR3JpZC5tb3ZlVmlldyh0aGlzLnBhbmVsUGFydFZpZXcsIGVkaXRvckhpZGRlbiA/IHNpemUuaGVpZ2h0IDogdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfTEFTVF9OT05fTUFYSU1JWkVEX0hFSUdIVCksIHRoaXMuZWRpdG9yUGFydFZpZXcsIERpcmVjdGlvbi5Eb3duKTtcblx0XHR9IGVsc2UgaWYgKHBvc2l0aW9uID09PSBQb3NpdGlvbi5UT1ApIHtcblx0XHRcdHRoaXMud29ya2JlbmNoR3JpZC5tb3ZlVmlldyh0aGlzLnBhbmVsUGFydFZpZXcsIGVkaXRvckhpZGRlbiA/IHNpemUuaGVpZ2h0IDogdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfTEFTVF9OT05fTUFYSU1JWkVEX0hFSUdIVCksIHRoaXMuZWRpdG9yUGFydFZpZXcsIERpcmVjdGlvbi5VcCk7XG5cdFx0fSBlbHNlIGlmIChwb3NpdGlvbiA9PT0gUG9zaXRpb24uUklHSFQpIHtcblx0XHRcdHRoaXMud29ya2JlbmNoR3JpZC5tb3ZlVmlldyh0aGlzLnBhbmVsUGFydFZpZXcsIGVkaXRvckhpZGRlbiA/IHNpemUud2lkdGggOiB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5QQU5FTF9MQVNUX05PTl9NQVhJTUlaRURfV0lEVEgpLCB0aGlzLmVkaXRvclBhcnRWaWV3LCBEaXJlY3Rpb24uUmlnaHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQubW92ZVZpZXcodGhpcy5wYW5lbFBhcnRWaWV3LCBlZGl0b3JIaWRkZW4gPyBzaXplLndpZHRoIDogdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfTEFTVF9OT05fTUFYSU1JWkVEX1dJRFRIKSwgdGhpcy5lZGl0b3JQYXJ0VmlldywgRGlyZWN0aW9uLkxlZnQpO1xuXHRcdH1cblxuXHRcdGlmIChoYWRGb2N1cykge1xuXHRcdFx0dGhpcy5mb2N1c1BhcnQoUGFydHMuUEFORUxfUEFSVCk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVzZXQgc2lkZWJhciB0byBvcmlnaW5hbCBzaXplIGJlZm9yZSBzaGlmdGluZyB0aGUgcGFuZWxcblx0XHR0aGlzLndvcmtiZW5jaEdyaWQucmVzaXplVmlldyh0aGlzLnNpZGVCYXJQYXJ0Vmlldywgc2lkZUJhclNpemUpO1xuXHRcdGlmICghc2lkZUJhclZpc2libGUpIHtcblx0XHRcdHRoaXMuc2V0U2lkZUJhckhpZGRlbih0cnVlKTtcblx0XHR9XG5cblx0XHR0aGlzLndvcmtiZW5jaEdyaWQucmVzaXplVmlldyh0aGlzLmF1eGlsaWFyeUJhclBhcnRWaWV3LCBhdXhpbGlhcnlCYXJTaXplKTtcblx0XHRpZiAoIWF1eGlsaWFyeUJhclZpc2libGUpIHtcblx0XHRcdHRoaXMuc2V0QXV4aWxpYXJ5QmFySGlkZGVuKHRydWUpO1xuXHRcdH1cblxuXHRcdGlmIChpc0hvcml6b250YWwocG9zaXRpb24pKSB7XG5cdFx0XHR0aGlzLmFkanVzdFBhcnRQb3NpdGlvbnModGhpcy5nZXRTaWRlQmFyUG9zaXRpb24oKSwgdGhpcy5nZXRQYW5lbEFsaWdubWVudCgpLCBwb3NpdGlvbik7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VQYW5lbFBvc2l0aW9uLmZpcmUobmV3UG9zaXRpb25WYWx1ZSk7XG5cdH1cblxuXHRpc1dpbmRvd01heGltaXplZCh0YXJnZXRXaW5kb3c6IFdpbmRvdyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnN0YXRlLnJ1bnRpbWUubWF4aW1pemVkLmhhcyhnZXRXaW5kb3dJZCh0YXJnZXRXaW5kb3cpKTtcblx0fVxuXG5cdHVwZGF0ZVdpbmRvd01heGltaXplZFN0YXRlKHRhcmdldFdpbmRvdzogV2luZG93LCBtYXhpbWl6ZWQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZShMYXlvdXRDbGFzc2VzLk1BWElNSVpFRCwgbWF4aW1pemVkKTtcblxuXHRcdGNvbnN0IHRhcmdldFdpbmRvd0lkID0gZ2V0V2luZG93SWQodGFyZ2V0V2luZG93KTtcblx0XHRpZiAobWF4aW1pemVkID09PSB0aGlzLnN0YXRlLnJ1bnRpbWUubWF4aW1pemVkLmhhcyh0YXJnZXRXaW5kb3dJZCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAobWF4aW1pemVkKSB7XG5cdFx0XHR0aGlzLnN0YXRlLnJ1bnRpbWUubWF4aW1pemVkLmFkZCh0YXJnZXRXaW5kb3dJZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3RhdGUucnVudGltZS5tYXhpbWl6ZWQuZGVsZXRlKHRhcmdldFdpbmRvd0lkKTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZVdpbmRvd3NCb3JkZXIoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVdpbmRvd01heGltaXplZC5maXJlKHsgd2luZG93SWQ6IHRhcmdldFdpbmRvd0lkLCBtYXhpbWl6ZWQgfSk7XG5cdH1cblxuXHRnZXRWaXNpYmxlTmVpZ2hib3JQYXJ0KHBhcnQ6IFBhcnRzLCBkaXJlY3Rpb246IERpcmVjdGlvbik6IFBhcnRzIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMud29ya2JlbmNoR3JpZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuaXNWaXNpYmxlKHBhcnQsIG1haW5XaW5kb3cpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5laWdoYm9yVmlld3MgPSB0aGlzLndvcmtiZW5jaEdyaWQuZ2V0TmVpZ2hib3JWaWV3cyh0aGlzLmdldFBhcnQocGFydCksIGRpcmVjdGlvbiwgZmFsc2UpO1xuXG5cdFx0aWYgKCFuZWlnaGJvclZpZXdzKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgbmVpZ2hib3JWaWV3IG9mIG5laWdoYm9yVmlld3MpIHtcblx0XHRcdGNvbnN0IG5laWdoYm9yUGFydCA9XG5cdFx0XHRcdFtQYXJ0cy5BQ1RJVklUWUJBUl9QQVJULCBQYXJ0cy5FRElUT1JfUEFSVCwgUGFydHMuUEFORUxfUEFSVCwgUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQsIFBhcnRzLlNJREVCQVJfUEFSVCwgUGFydHMuU1RBVFVTQkFSX1BBUlQsIFBhcnRzLlRJVExFQkFSX1BBUlRdXG5cdFx0XHRcdFx0LmZpbmQocGFydElkID0+IHRoaXMuZ2V0UGFydChwYXJ0SWQpID09PSBuZWlnaGJvclZpZXcgJiYgdGhpcy5pc1Zpc2libGUocGFydElkLCBtYWluV2luZG93KSk7XG5cblx0XHRcdGlmIChuZWlnaGJvclBhcnQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXR1cm4gbmVpZ2hib3JQYXJ0O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlV0NPKCk6IHZvaWQge1xuXHRcdGNvbnN0IGJhbm5lckZpcnN0ID0gdGhpcy53b3JrYmVuY2hHcmlkLmdldE5laWdoYm9yVmlld3ModGhpcy50aXRsZUJhclBhcnRWaWV3LCBEaXJlY3Rpb24uVXAsIGZhbHNlKS5sZW5ndGggPiAwO1xuXHRcdGNvbnN0IHNob3VsZEJhbm5lckJlRmlyc3QgPSB0aGlzLnNob3VsZFNob3dCYW5uZXJGaXJzdCgpO1xuXG5cdFx0aWYgKGJhbm5lckZpcnN0ICE9PSBzaG91bGRCYW5uZXJCZUZpcnN0KSB7XG5cdFx0XHR0aGlzLndvcmtiZW5jaEdyaWQubW92ZVZpZXcodGhpcy5iYW5uZXJQYXJ0VmlldywgU2l6aW5nLkRpc3RyaWJ1dGUsIHRoaXMudGl0bGVCYXJQYXJ0Vmlldywgc2hvdWxkQmFubmVyQmVGaXJzdCA/IERpcmVjdGlvbi5VcCA6IERpcmVjdGlvbi5Eb3duKTtcblx0XHR9XG5cblx0XHR0aGlzLndvcmtiZW5jaEdyaWQuc2V0Vmlld1Zpc2libGUodGhpcy50aXRsZUJhclBhcnRWaWV3LCBzaG91bGRTaG93Q3VzdG9tVGl0bGVCYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgbWFpbldpbmRvdywgdGhpcy5zdGF0ZS5ydW50aW1lLm1lbnVCYXIudG9nZ2xlZCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhcnJhbmdlRWRpdG9yTm9kZXMobm9kZXM6IHsgZWRpdG9yOiBJU2VyaWFsaXplZE5vZGU7IHNpZGVCYXI/OiBJU2VyaWFsaXplZE5vZGU7IGF1eGlsaWFyeUJhcj86IElTZXJpYWxpemVkTm9kZSB9LCBhdmFpbGFibGVIZWlnaHQ6IG51bWJlciwgYXZhaWxhYmxlV2lkdGg6IG51bWJlcik6IElTZXJpYWxpemVkTm9kZSB7XG5cdFx0aWYgKCFub2Rlcy5zaWRlQmFyICYmICFub2Rlcy5hdXhpbGlhcnlCYXIpIHtcblx0XHRcdG5vZGVzLmVkaXRvci5zaXplID0gYXZhaWxhYmxlSGVpZ2h0O1xuXHRcdFx0cmV0dXJuIG5vZGVzLmVkaXRvcjtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBbbm9kZXMuZWRpdG9yXTtcblx0XHRub2Rlcy5lZGl0b3Iuc2l6ZSA9IGF2YWlsYWJsZVdpZHRoO1xuXHRcdGlmIChub2Rlcy5zaWRlQmFyKSB7XG5cdFx0XHRpZiAodGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9QT1NJVE9OKSA9PT0gUG9zaXRpb24uTEVGVCkge1xuXHRcdFx0XHRyZXN1bHQuc3BsaWNlKDAsIDAsIG5vZGVzLnNpZGVCYXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gobm9kZXMuc2lkZUJhcik7XG5cdFx0XHR9XG5cblx0XHRcdG5vZGVzLmVkaXRvci5zaXplIC09IHRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlNJREVCQVJfSElEREVOKSA/IDAgOiBub2Rlcy5zaWRlQmFyLnNpemU7XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGVzLmF1eGlsaWFyeUJhcikge1xuXHRcdFx0aWYgKHRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlNJREVCQVJfUE9TSVRPTikgPT09IFBvc2l0aW9uLlJJR0hUKSB7XG5cdFx0XHRcdHJlc3VsdC5zcGxpY2UoMCwgMCwgbm9kZXMuYXV4aWxpYXJ5QmFyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKG5vZGVzLmF1eGlsaWFyeUJhcik7XG5cdFx0XHR9XG5cblx0XHRcdG5vZGVzLmVkaXRvci5zaXplIC09IHRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLkFVWElMSUFSWUJBUl9ISURERU4pID8gMCA6IG5vZGVzLmF1eGlsaWFyeUJhci5zaXplO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdGRhdGE6IHJlc3VsdCxcblx0XHRcdHNpemU6IGF2YWlsYWJsZUhlaWdodFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFycmFuZ2VNaWRkbGVTZWN0aW9uTm9kZXMobm9kZXM6IHsgZWRpdG9yOiBJU2VyaWFsaXplZE5vZGU7IHBhbmVsOiBJU2VyaWFsaXplZE5vZGU7IGFjdGl2aXR5QmFyOiBJU2VyaWFsaXplZE5vZGU7IHNpZGVCYXI6IElTZXJpYWxpemVkTm9kZTsgYXV4aWxpYXJ5QmFyOiBJU2VyaWFsaXplZE5vZGUgfSwgYXZhaWxhYmxlV2lkdGg6IG51bWJlciwgYXZhaWxhYmxlSGVpZ2h0OiBudW1iZXIpOiBJU2VyaWFsaXplZE5vZGVbXSB7XG5cdFx0Y29uc3QgYWN0aXZpdHlCYXJTaXplID0gdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuQUNUSVZJVFlCQVJfSElEREVOKSA/IDAgOiBub2Rlcy5hY3Rpdml0eUJhci5zaXplO1xuXHRcdGNvbnN0IHNpZGVCYXJTaXplID0gdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9ISURERU4pID8gMCA6IG5vZGVzLnNpZGVCYXIuc2l6ZTtcblx0XHRjb25zdCBhdXhpbGlhcnlCYXJTaXplID0gdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuQVVYSUxJQVJZQkFSX0hJRERFTikgPyAwIDogbm9kZXMuYXV4aWxpYXJ5QmFyLnNpemU7XG5cdFx0Y29uc3QgcGFuZWxTaXplID0gdGhpcy5zdGF0ZU1vZGVsLmdldEluaXRpYWxpemF0aW9uVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX1NJWkUpID8gMCA6IG5vZGVzLnBhbmVsLnNpemU7XG5cblx0XHRjb25zdCBwYW5lbFBvc3Rpb24gPSB0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5QQU5FTF9QT1NJVElPTik7XG5cdFx0Y29uc3Qgc2lkZUJhclBvc2l0aW9uID0gdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9QT1NJVE9OKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IFtdIGFzIElTZXJpYWxpemVkTm9kZVtdO1xuXHRcdGlmICghaXNIb3Jpem9udGFsKHBhbmVsUG9zdGlvbikpIHtcblx0XHRcdHJlc3VsdC5wdXNoKG5vZGVzLmVkaXRvcik7XG5cdFx0XHRub2Rlcy5lZGl0b3Iuc2l6ZSA9IGF2YWlsYWJsZVdpZHRoIC0gYWN0aXZpdHlCYXJTaXplIC0gc2lkZUJhclNpemUgLSBwYW5lbFNpemUgLSBhdXhpbGlhcnlCYXJTaXplO1xuXHRcdFx0aWYgKHBhbmVsUG9zdGlvbiA9PT0gUG9zaXRpb24uUklHSFQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gobm9kZXMucGFuZWwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnNwbGljZSgwLCAwLCBub2Rlcy5wYW5lbCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzaWRlQmFyUG9zaXRpb24gPT09IFBvc2l0aW9uLkxFRlQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gobm9kZXMuYXV4aWxpYXJ5QmFyKTtcblx0XHRcdFx0cmVzdWx0LnNwbGljZSgwLCAwLCBub2Rlcy5zaWRlQmFyKTtcblx0XHRcdFx0cmVzdWx0LnNwbGljZSgwLCAwLCBub2Rlcy5hY3Rpdml0eUJhcik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQuc3BsaWNlKDAsIDAsIG5vZGVzLmF1eGlsaWFyeUJhcik7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKG5vZGVzLnNpZGVCYXIpO1xuXHRcdFx0XHRyZXN1bHQucHVzaChub2Rlcy5hY3Rpdml0eUJhcik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHBhbmVsQWxpZ25tZW50ID0gdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfQUxJR05NRU5UKTtcblx0XHRcdGNvbnN0IHNpZGVCYXJOZXh0VG9FZGl0b3IgPSAhKHBhbmVsQWxpZ25tZW50ID09PSAnY2VudGVyJyB8fCAoc2lkZUJhclBvc2l0aW9uID09PSBQb3NpdGlvbi5MRUZUICYmIHBhbmVsQWxpZ25tZW50ID09PSAncmlnaHQnKSB8fCAoc2lkZUJhclBvc2l0aW9uID09PSBQb3NpdGlvbi5SSUdIVCAmJiBwYW5lbEFsaWdubWVudCA9PT0gJ2xlZnQnKSk7XG5cdFx0XHRjb25zdCBhdXhpbGlhcnlCYXJOZXh0VG9FZGl0b3IgPSAhKHBhbmVsQWxpZ25tZW50ID09PSAnY2VudGVyJyB8fCAoc2lkZUJhclBvc2l0aW9uID09PSBQb3NpdGlvbi5SSUdIVCAmJiBwYW5lbEFsaWdubWVudCA9PT0gJ3JpZ2h0JykgfHwgKHNpZGVCYXJQb3NpdGlvbiA9PT0gUG9zaXRpb24uTEVGVCAmJiBwYW5lbEFsaWdubWVudCA9PT0gJ2xlZnQnKSk7XG5cblx0XHRcdGNvbnN0IGVkaXRvclNlY3Rpb25XaWR0aCA9IGF2YWlsYWJsZVdpZHRoIC0gYWN0aXZpdHlCYXJTaXplIC0gKHNpZGVCYXJOZXh0VG9FZGl0b3IgPyAwIDogc2lkZUJhclNpemUpIC0gKGF1eGlsaWFyeUJhck5leHRUb0VkaXRvciA/IDAgOiBhdXhpbGlhcnlCYXJTaXplKTtcblxuXHRcdFx0Y29uc3QgZWRpdG9yTm9kZXMgPSB0aGlzLmFycmFuZ2VFZGl0b3JOb2Rlcyh7XG5cdFx0XHRcdGVkaXRvcjogbm9kZXMuZWRpdG9yLFxuXHRcdFx0XHRzaWRlQmFyOiBzaWRlQmFyTmV4dFRvRWRpdG9yID8gbm9kZXMuc2lkZUJhciA6IHVuZGVmaW5lZCxcblx0XHRcdFx0YXV4aWxpYXJ5QmFyOiBhdXhpbGlhcnlCYXJOZXh0VG9FZGl0b3IgPyBub2Rlcy5hdXhpbGlhcnlCYXIgOiB1bmRlZmluZWRcblx0XHRcdH0sIGF2YWlsYWJsZUhlaWdodCAtIHBhbmVsU2l6ZSwgZWRpdG9yU2VjdGlvbldpZHRoKTtcblxuXHRcdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0XHR0eXBlOiAnYnJhbmNoJyxcblx0XHRcdFx0ZGF0YTogcGFuZWxQb3N0aW9uID09PSBQb3NpdGlvbi5CT1RUT00gPyBbZWRpdG9yTm9kZXMsIG5vZGVzLnBhbmVsXSA6IFtub2Rlcy5wYW5lbCwgZWRpdG9yTm9kZXNdLFxuXHRcdFx0XHRzaXplOiBlZGl0b3JTZWN0aW9uV2lkdGhcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIXNpZGVCYXJOZXh0VG9FZGl0b3IpIHtcblx0XHRcdFx0aWYgKHNpZGVCYXJQb3NpdGlvbiA9PT0gUG9zaXRpb24uTEVGVCkge1xuXHRcdFx0XHRcdHJlc3VsdC5zcGxpY2UoMCwgMCwgbm9kZXMuc2lkZUJhcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2gobm9kZXMuc2lkZUJhcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFhdXhpbGlhcnlCYXJOZXh0VG9FZGl0b3IpIHtcblx0XHRcdFx0aWYgKHNpZGVCYXJQb3NpdGlvbiA9PT0gUG9zaXRpb24uUklHSFQpIHtcblx0XHRcdFx0XHRyZXN1bHQuc3BsaWNlKDAsIDAsIG5vZGVzLmF1eGlsaWFyeUJhcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2gobm9kZXMuYXV4aWxpYXJ5QmFyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc2lkZUJhclBvc2l0aW9uID09PSBQb3NpdGlvbi5MRUZUKSB7XG5cdFx0XHRcdHJlc3VsdC5zcGxpY2UoMCwgMCwgbm9kZXMuYWN0aXZpdHlCYXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gobm9kZXMuYWN0aXZpdHlCYXIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUdyaWREZXNjcmlwdG9yKCk6IElTZXJpYWxpemVkR3JpZCB7XG5cdFx0Y29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSB0aGlzLl9tYWluQ29udGFpbmVyRGltZW5zaW9uITtcblx0XHRjb25zdCBzaWRlQmFyU2l6ZSA9IHRoaXMuc3RhdGVNb2RlbC5nZXRJbml0aWFsaXphdGlvblZhbHVlKExheW91dFN0YXRlS2V5cy5TSURFQkFSX1NJWkUpO1xuXHRcdGNvbnN0IGF1eGlsaWFyeUJhclBhcnRTaXplID0gdGhpcy5zdGF0ZU1vZGVsLmdldEluaXRpYWxpemF0aW9uVmFsdWUoTGF5b3V0U3RhdGVLZXlzLkFVWElMSUFSWUJBUl9TSVpFKTtcblx0XHRjb25zdCBwYW5lbFNpemUgPSB0aGlzLnN0YXRlTW9kZWwuZ2V0SW5pdGlhbGl6YXRpb25WYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfU0laRSk7XG5cblx0XHRjb25zdCB0aXRsZUJhckhlaWdodCA9IHRoaXMudGl0bGVCYXJQYXJ0Vmlldy5taW5pbXVtSGVpZ2h0O1xuXHRcdGNvbnN0IGJhbm5lckhlaWdodCA9IHRoaXMuYmFubmVyUGFydFZpZXcubWluaW11bUhlaWdodDtcblx0XHRjb25zdCBzdGF0dXNCYXJIZWlnaHQgPSB0aGlzLnN0YXR1c0JhclBhcnRWaWV3Lm1pbmltdW1IZWlnaHQ7XG5cdFx0Y29uc3QgYWN0aXZpdHlCYXJXaWR0aCA9IHRoaXMuYWN0aXZpdHlCYXJQYXJ0Vmlldy5taW5pbXVtV2lkdGg7XG5cdFx0Y29uc3QgbWlkZGxlU2VjdGlvbkhlaWdodCA9IGhlaWdodCAtIHRpdGxlQmFySGVpZ2h0IC0gc3RhdHVzQmFySGVpZ2h0O1xuXG5cdFx0Y29uc3QgdGl0bGVBbmRCYW5uZXI6IElTZXJpYWxpemVkTm9kZVtdID0gW1xuXHRcdFx0e1xuXHRcdFx0XHR0eXBlOiAnbGVhZicsXG5cdFx0XHRcdGRhdGE6IHsgdHlwZTogUGFydHMuVElUTEVCQVJfUEFSVCB9LFxuXHRcdFx0XHRzaXplOiB0aXRsZUJhckhlaWdodCxcblx0XHRcdFx0dmlzaWJsZTogdGhpcy5pc1Zpc2libGUoUGFydHMuVElUTEVCQVJfUEFSVCwgbWFpbldpbmRvdylcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdHR5cGU6ICdsZWFmJyxcblx0XHRcdFx0ZGF0YTogeyB0eXBlOiBQYXJ0cy5CQU5ORVJfUEFSVCB9LFxuXHRcdFx0XHRzaXplOiBiYW5uZXJIZWlnaHQsXG5cdFx0XHRcdHZpc2libGU6IGZhbHNlXG5cdFx0XHR9XG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdGl2aXR5QmFyTm9kZTogSVNlcmlhbGl6ZWRMZWFmTm9kZSA9IHtcblx0XHRcdHR5cGU6ICdsZWFmJyxcblx0XHRcdGRhdGE6IHsgdHlwZTogUGFydHMuQUNUSVZJVFlCQVJfUEFSVCB9LFxuXHRcdFx0c2l6ZTogYWN0aXZpdHlCYXJXaWR0aCxcblx0XHRcdHZpc2libGU6ICF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5BQ1RJVklUWUJBUl9ISURERU4pXG5cdFx0fTtcblxuXHRcdGNvbnN0IHNpZGVCYXJOb2RlOiBJU2VyaWFsaXplZExlYWZOb2RlID0ge1xuXHRcdFx0dHlwZTogJ2xlYWYnLFxuXHRcdFx0ZGF0YTogeyB0eXBlOiBQYXJ0cy5TSURFQkFSX1BBUlQgfSxcblx0XHRcdHNpemU6IHNpZGVCYXJTaXplLFxuXHRcdFx0dmlzaWJsZTogIXRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlNJREVCQVJfSElEREVOKVxuXHRcdH07XG5cblx0XHRjb25zdCBhdXhpbGlhcnlCYXJOb2RlOiBJU2VyaWFsaXplZExlYWZOb2RlID0ge1xuXHRcdFx0dHlwZTogJ2xlYWYnLFxuXHRcdFx0ZGF0YTogeyB0eXBlOiBQYXJ0cy5BVVhJTElBUllCQVJfUEFSVCB9LFxuXHRcdFx0c2l6ZTogYXV4aWxpYXJ5QmFyUGFydFNpemUsXG5cdFx0XHR2aXNpYmxlOiB0aGlzLmlzVmlzaWJsZShQYXJ0cy5BVVhJTElBUllCQVJfUEFSVClcblx0XHR9O1xuXG5cdFx0Y29uc3QgZWRpdG9yTm9kZTogSVNlcmlhbGl6ZWRMZWFmTm9kZSA9IHtcblx0XHRcdHR5cGU6ICdsZWFmJyxcblx0XHRcdGRhdGE6IHsgdHlwZTogUGFydHMuRURJVE9SX1BBUlQgfSxcblx0XHRcdHNpemU6IDAsIC8vIFVwZGF0ZSBiYXNlZCBvbiBzaWJsaW5nIHNpemVzXG5cdFx0XHR2aXNpYmxlOiAhdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuRURJVE9SX0hJRERFTilcblx0XHR9O1xuXG5cdFx0Y29uc3QgcGFuZWxOb2RlOiBJU2VyaWFsaXplZExlYWZOb2RlID0ge1xuXHRcdFx0dHlwZTogJ2xlYWYnLFxuXHRcdFx0ZGF0YTogeyB0eXBlOiBQYXJ0cy5QQU5FTF9QQVJUIH0sXG5cdFx0XHRzaXplOiBwYW5lbFNpemUsXG5cdFx0XHR2aXNpYmxlOiAhdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuUEFORUxfSElEREVOKVxuXHRcdH07XG5cblx0XHRjb25zdCBtaWRkbGVTZWN0aW9uOiBJU2VyaWFsaXplZE5vZGVbXSA9IHRoaXMuYXJyYW5nZU1pZGRsZVNlY3Rpb25Ob2Rlcyh7XG5cdFx0XHRhY3Rpdml0eUJhcjogYWN0aXZpdHlCYXJOb2RlLFxuXHRcdFx0YXV4aWxpYXJ5QmFyOiBhdXhpbGlhcnlCYXJOb2RlLFxuXHRcdFx0ZWRpdG9yOiBlZGl0b3JOb2RlLFxuXHRcdFx0cGFuZWw6IHBhbmVsTm9kZSxcblx0XHRcdHNpZGVCYXI6IHNpZGVCYXJOb2RlXG5cdFx0fSwgd2lkdGgsIG1pZGRsZVNlY3Rpb25IZWlnaHQpO1xuXG5cdFx0Y29uc3QgcmVzdWx0OiBJU2VyaWFsaXplZEdyaWQgPSB7XG5cdFx0XHRyb290OiB7XG5cdFx0XHRcdHR5cGU6ICdicmFuY2gnLFxuXHRcdFx0XHRzaXplOiB3aWR0aCxcblx0XHRcdFx0ZGF0YTogW1xuXHRcdFx0XHRcdC4uLih0aGlzLnNob3VsZFNob3dCYW5uZXJGaXJzdCgpID8gdGl0bGVBbmRCYW5uZXIucmV2ZXJzZSgpIDogdGl0bGVBbmRCYW5uZXIpLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdicmFuY2gnLFxuXHRcdFx0XHRcdFx0ZGF0YTogbWlkZGxlU2VjdGlvbixcblx0XHRcdFx0XHRcdHNpemU6IG1pZGRsZVNlY3Rpb25IZWlnaHRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdsZWFmJyxcblx0XHRcdFx0XHRcdGRhdGE6IHsgdHlwZTogUGFydHMuU1RBVFVTQkFSX1BBUlQgfSxcblx0XHRcdFx0XHRcdHNpemU6IHN0YXR1c0JhckhlaWdodCxcblx0XHRcdFx0XHRcdHZpc2libGU6ICF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5TVEFUVVNCQVJfSElEREVOKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbi5WRVJUSUNBTCxcblx0XHRcdHdpZHRoLFxuXHRcdFx0aGVpZ2h0XG5cdFx0fTtcblxuXHRcdHR5cGUgU3RhcnR1cExheW91dEV2ZW50ID0ge1xuXHRcdFx0YWN0aXZpdHlCYXJWaXNpYmxlOiBib29sZWFuO1xuXHRcdFx0c2lkZUJhclZpc2libGU6IGJvb2xlYW47XG5cdFx0XHRhdXhpbGlhcnlCYXJWaXNpYmxlOiBib29sZWFuO1xuXHRcdFx0cGFuZWxWaXNpYmxlOiBib29sZWFuO1xuXHRcdFx0c3RhdHVzYmFyVmlzaWJsZTogYm9vbGVhbjtcblx0XHRcdHNpZGVCYXJQb3NpdGlvbjogc3RyaW5nO1xuXHRcdFx0cGFuZWxQb3NpdGlvbjogc3RyaW5nO1xuXHRcdH07XG5cblx0XHR0eXBlIFN0YXJ0dXBMYXlvdXRFdmVudENsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdiZW5pYmVuaic7XG5cdFx0XHRjb21tZW50OiAnSW5mb3JtYXRpb24gYWJvdXQgdGhlIGxheW91dCBvZiB0aGUgd29ya2JlbmNoIGR1cmluZyBzdGF0dXAnO1xuXHRcdFx0YWN0aXZpdHlCYXJWaXNpYmxlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciBvciB0aGUgbm90IHRoZSBhY3Rpdml0eSBiYXIgaXMgdmlzaWJsZScgfTtcblx0XHRcdHNpZGVCYXJWaXNpYmxlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciBvciB0aGUgbm90IHRoZSBwcmltYXJ5IHNpZGUgYmFyIGlzIHZpc2libGUnIH07XG5cdFx0XHRhdXhpbGlhcnlCYXJWaXNpYmxlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciBvciB0aGUgbm90IHRoZSBWb2lkIHNpZGUgYmFyIGlzIHZpc2libGUnIH07XG5cdFx0XHRwYW5lbFZpc2libGU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIG9yIHRoZSBub3QgdGhlIHBhbmVsIGlzIHZpc2libGUnIH07XG5cdFx0XHRzdGF0dXNiYXJWaXNpYmxlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciBvciB0aGUgbm90IHRoZSBzdGF0dXMgYmFyIGlzIHZpc2libGUnIH07XG5cdFx0XHRzaWRlQmFyUG9zaXRpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIHRoZSBwcmltYXJ5IHNpZGUgYmFyIGlzIG9uIHRoZSBsZWZ0IG9yIHJpZ2h0JyB9O1xuXHRcdFx0cGFuZWxQb3NpdGlvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgdGhlIHBhbmVsIGlzIG9uIHRoZSB0b3AsIGJvdHRvbSwgbGVmdCwgb3IgcmlnaHQnIH07XG5cdFx0fTtcblxuXHRcdGNvbnN0IGxheW91dERlc2NyaXB0b3I6IFN0YXJ0dXBMYXlvdXRFdmVudCA9IHtcblx0XHRcdGFjdGl2aXR5QmFyVmlzaWJsZTogIXRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLkFDVElWSVRZQkFSX0hJRERFTiksXG5cdFx0XHRzaWRlQmFyVmlzaWJsZTogIXRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlNJREVCQVJfSElEREVOKSxcblx0XHRcdGF1eGlsaWFyeUJhclZpc2libGU6ICF0aGlzLnN0YXRlTW9kZWwuZ2V0UnVudGltZVZhbHVlKExheW91dFN0YXRlS2V5cy5BVVhJTElBUllCQVJfSElEREVOKSxcblx0XHRcdHBhbmVsVmlzaWJsZTogIXRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX0hJRERFTiksXG5cdFx0XHRzdGF0dXNiYXJWaXNpYmxlOiAhdGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuU1RBVFVTQkFSX0hJRERFTiksXG5cdFx0XHRzaWRlQmFyUG9zaXRpb246IHBvc2l0aW9uVG9TdHJpbmcodGhpcy5zdGF0ZU1vZGVsLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9QT1NJVE9OKSksXG5cdFx0XHRwYW5lbFBvc2l0aW9uOiBwb3NpdGlvblRvU3RyaW5nKHRoaXMuc3RhdGVNb2RlbC5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlBBTkVMX1BPU0lUSU9OKSksXG5cdFx0fTtcblxuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFN0YXJ0dXBMYXlvdXRFdmVudCwgU3RhcnR1cExheW91dEV2ZW50Q2xhc3NpZmljYXRpb24+KCdzdGFydHVwTGF5b3V0JywgbGF5b3V0RGVzY3JpcHRvcik7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLmRpc3Bvc2VkID0gdHJ1ZTtcblx0fVxufVxuXG50eXBlIFplbk1vZGVDb25maWd1cmF0aW9uID0ge1xuXHRjZW50ZXJMYXlvdXQ6IGJvb2xlYW47XG5cdGZ1bGxTY3JlZW46IGJvb2xlYW47XG5cdGhpZGVBY3Rpdml0eUJhcjogYm9vbGVhbjtcblx0aGlkZUxpbmVOdW1iZXJzOiBib29sZWFuO1xuXHRoaWRlU3RhdHVzQmFyOiBib29sZWFuO1xuXHRzaG93VGFiczogJ211bHRpcGxlJyB8ICdzaW5nbGUnIHwgJ25vbmUnO1xuXHRyZXN0b3JlOiBib29sZWFuO1xuXHRzaWxlbnROb3RpZmljYXRpb25zOiBib29sZWFuO1xufTtcblxuZnVuY3Rpb24gZ2V0WmVuTW9kZUNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSk6IFplbk1vZGVDb25maWd1cmF0aW9uIHtcblx0cmV0dXJuIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPFplbk1vZGVDb25maWd1cmF0aW9uPihXb3JrYmVuY2hMYXlvdXRTZXR0aW5ncy5aRU5fTU9ERV9DT05GSUcpO1xufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIExheW91dCBTdGF0ZSBNb2RlbFxuXG5pbnRlcmZhY2UgSVdvcmtiZW5jaExheW91dFN0YXRlS2V5IHtcblx0cmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuXHRyZWFkb25seSBydW50aW1lOiBib29sZWFuO1xuXHRyZWFkb25seSBkZWZhdWx0VmFsdWU6IHVua25vd247XG5cdHJlYWRvbmx5IHNjb3BlOiBTdG9yYWdlU2NvcGU7XG5cdHJlYWRvbmx5IHRhcmdldDogU3RvcmFnZVRhcmdldDtcblx0cmVhZG9ubHkgemVuTW9kZUlnbm9yZT86IGJvb2xlYW47XG59XG5cbnR5cGUgU3RvcmFnZUtleVR5cGUgPSBzdHJpbmcgfCBib29sZWFuIHwgbnVtYmVyIHwgb2JqZWN0O1xuXG5hYnN0cmFjdCBjbGFzcyBXb3JrYmVuY2hMYXlvdXRTdGF0ZUtleTxUIGV4dGVuZHMgU3RvcmFnZUtleVR5cGU+IGltcGxlbWVudHMgSVdvcmtiZW5jaExheW91dFN0YXRlS2V5IHtcblxuXHRhYnN0cmFjdCByZWFkb25seSBydW50aW1lOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IG5hbWU6IHN0cmluZywgcmVhZG9ubHkgc2NvcGU6IFN0b3JhZ2VTY29wZSwgcmVhZG9ubHkgdGFyZ2V0OiBTdG9yYWdlVGFyZ2V0LCBwdWJsaWMgZGVmYXVsdFZhbHVlOiBUKSB7IH1cbn1cblxuY2xhc3MgUnVudGltZVN0YXRlS2V5PFQgZXh0ZW5kcyBTdG9yYWdlS2V5VHlwZT4gZXh0ZW5kcyBXb3JrYmVuY2hMYXlvdXRTdGF0ZUtleTxUPiB7XG5cblx0cmVhZG9ubHkgcnVudGltZSA9IHRydWU7XG5cblx0Y29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBzY29wZTogU3RvcmFnZVNjb3BlLCB0YXJnZXQ6IFN0b3JhZ2VUYXJnZXQsIGRlZmF1bHRWYWx1ZTogVCwgcmVhZG9ubHkgemVuTW9kZUlnbm9yZT86IGJvb2xlYW4pIHtcblx0XHRzdXBlcihuYW1lLCBzY29wZSwgdGFyZ2V0LCBkZWZhdWx0VmFsdWUpO1xuXHR9XG59XG5cbmNsYXNzIEluaXRpYWxpemF0aW9uU3RhdGVLZXk8VCBleHRlbmRzIFN0b3JhZ2VLZXlUeXBlPiBleHRlbmRzIFdvcmtiZW5jaExheW91dFN0YXRlS2V5PFQ+IHtcblx0cmVhZG9ubHkgcnVudGltZSA9IGZhbHNlO1xufVxuXG5jb25zdCBMYXlvdXRTdGF0ZUtleXMgPSB7XG5cblx0Ly8gRWRpdG9yXG5cdE1BSU5fRURJVE9SX0NFTlRFUkVEOiBuZXcgUnVudGltZVN0YXRlS2V5PGJvb2xlYW4+KCdlZGl0b3IuY2VudGVyZWQnLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsIGZhbHNlKSxcblxuXHQvLyBaZW4gTW9kZVxuXHRaRU5fTU9ERV9BQ1RJVkU6IG5ldyBSdW50aW1lU3RhdGVLZXk8Ym9vbGVhbj4oJ3plbk1vZGUuYWN0aXZlJywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FLCBmYWxzZSksXG5cdFpFTl9NT0RFX0VYSVRfSU5GTzogbmV3IFJ1bnRpbWVTdGF0ZUtleSgnemVuTW9kZS5leGl0SW5mbycsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSwge1xuXHRcdHRyYW5zaXRpb25lZFRvQ2VudGVyZWRFZGl0b3JMYXlvdXQ6IGZhbHNlLFxuXHRcdHRyYW5zaXRpb25lZFRvRnVsbFNjcmVlbjogZmFsc2UsXG5cdFx0aGFuZGxlTm90aWZpY2F0aW9uc0RvTm90RGlzdHVyYk1vZGU6IGZhbHNlLFxuXHRcdHdhc1Zpc2libGU6IHtcblx0XHRcdGF1eGlsaWFyeUJhcjogZmFsc2UsXG5cdFx0XHRwYW5lbDogZmFsc2UsXG5cdFx0XHRzaWRlQmFyOiBmYWxzZSxcblx0XHR9LFxuXHR9KSxcblxuXHQvLyBQYXJ0IFNpemluZ1xuXHRTSURFQkFSX1NJWkU6IG5ldyBJbml0aWFsaXphdGlvblN0YXRlS2V5PG51bWJlcj4oJ3NpZGVCYXIuc2l6ZScsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsIDIwMCksXG5cdEFVWElMSUFSWUJBUl9TSVpFOiBuZXcgSW5pdGlhbGl6YXRpb25TdGF0ZUtleTxudW1iZXI+KCdhdXhpbGlhcnlCYXIuc2l6ZScsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsIDgwMCksIC8vIFZvaWQgY2hhbmdlZCB0aGlzIGZyb20gMjAwIHRvIDgwMFxuXHRQQU5FTF9TSVpFOiBuZXcgSW5pdGlhbGl6YXRpb25TdGF0ZUtleTxudW1iZXI+KCdwYW5lbC5zaXplJywgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSwgMzAwKSxcblxuXHRQQU5FTF9MQVNUX05PTl9NQVhJTUlaRURfSEVJR0hUOiBuZXcgUnVudGltZVN0YXRlS2V5PG51bWJlcj4oJ3BhbmVsLmxhc3ROb25NYXhpbWl6ZWRIZWlnaHQnLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FLCAzMDApLFxuXHRQQU5FTF9MQVNUX05PTl9NQVhJTUlaRURfV0lEVEg6IG5ldyBSdW50aW1lU3RhdGVLZXk8bnVtYmVyPigncGFuZWwubGFzdE5vbk1heGltaXplZFdpZHRoJywgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSwgMzAwKSxcblx0UEFORUxfV0FTX0xBU1RfTUFYSU1JWkVEOiBuZXcgUnVudGltZVN0YXRlS2V5PGJvb2xlYW4+KCdwYW5lbC53YXNMYXN0TWF4aW1pemVkJywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FLCBmYWxzZSksXG5cblx0Ly8gUGFydCBQb3NpdGlvbnNcblx0U0lERUJBUl9QT1NJVE9OOiBuZXcgUnVudGltZVN0YXRlS2V5PFBvc2l0aW9uPignc2lkZUJhci5wb3NpdGlvbicsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSwgUG9zaXRpb24uTEVGVCksXG5cdFBBTkVMX1BPU0lUSU9OOiBuZXcgUnVudGltZVN0YXRlS2V5PFBvc2l0aW9uPigncGFuZWwucG9zaXRpb24nLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsIFBvc2l0aW9uLkJPVFRPTSksXG5cdFBBTkVMX0FMSUdOTUVOVDogbmV3IFJ1bnRpbWVTdGF0ZUtleTxQYW5lbEFsaWdubWVudD4oJ3BhbmVsLmFsaWdubWVudCcsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIsICdjZW50ZXInKSxcblxuXHQvLyBQYXJ0IFZpc2liaWxpdHlcblx0QUNUSVZJVFlCQVJfSElEREVOOiBuZXcgUnVudGltZVN0YXRlS2V5PGJvb2xlYW4+KCdhY3Rpdml0eUJhci5oaWRkZW4nLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsIGZhbHNlLCB0cnVlKSxcblx0U0lERUJBUl9ISURERU46IG5ldyBSdW50aW1lU3RhdGVLZXk8Ym9vbGVhbj4oJ3NpZGVCYXIuaGlkZGVuJywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FLCBmYWxzZSksXG5cdEVESVRPUl9ISURERU46IG5ldyBSdW50aW1lU3RhdGVLZXk8Ym9vbGVhbj4oJ2VkaXRvci5oaWRkZW4nLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsIGZhbHNlKSxcblx0UEFORUxfSElEREVOOiBuZXcgUnVudGltZVN0YXRlS2V5PGJvb2xlYW4+KCdwYW5lbC5oaWRkZW4nLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsIHRydWUpLFxuXHRBVVhJTElBUllCQVJfSElEREVOOiBuZXcgUnVudGltZVN0YXRlS2V5PGJvb2xlYW4+KCdhdXhpbGlhcnlCYXIuaGlkZGVuJywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FLCB0cnVlKSxcblx0U1RBVFVTQkFSX0hJRERFTjogbmV3IFJ1bnRpbWVTdGF0ZUtleTxib29sZWFuPignc3RhdHVzQmFyLmhpZGRlbicsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSwgZmFsc2UsIHRydWUpXG5cbn0gYXMgY29uc3Q7XG5cbmludGVyZmFjZSBJTGF5b3V0U3RhdGVDaGFuZ2VFdmVudDxUIGV4dGVuZHMgU3RvcmFnZUtleVR5cGU+IHtcblx0cmVhZG9ubHkga2V5OiBSdW50aW1lU3RhdGVLZXk8VD47XG5cdHJlYWRvbmx5IHZhbHVlOiBUO1xufVxuXG5lbnVtIFdvcmtiZW5jaExheW91dFNldHRpbmdzIHtcblx0UEFORUxfUE9TSVRJT04gPSAnd29ya2JlbmNoLnBhbmVsLmRlZmF1bHRMb2NhdGlvbicsXG5cdFBBTkVMX09QRU5TX01BWElNSVpFRCA9ICd3b3JrYmVuY2gucGFuZWwub3BlbnNNYXhpbWl6ZWQnLFxuXHRaRU5fTU9ERV9DT05GSUcgPSAnemVuTW9kZScsXG5cdEVESVRPUl9DRU5URVJFRF9MQVlPVVRfQVVUT19SRVNJWkUgPSAnd29ya2JlbmNoLmVkaXRvci5jZW50ZXJlZExheW91dEF1dG9SZXNpemUnLFxufVxuXG5lbnVtIExlZ2FjeVdvcmtiZW5jaExheW91dFNldHRpbmdzIHtcblx0U1RBVFVTQkFSX1ZJU0lCTEUgPSAnd29ya2JlbmNoLnN0YXR1c0Jhci52aXNpYmxlJywgLy8gRGVwcmVjYXRlZCB0byBVSSBTdGF0ZVxuXHRTSURFQkFSX1BPU0lUSU9OID0gJ3dvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uJywgLy8gRGVwcmVjYXRlZCB0byBVSSBTdGF0ZVxufVxuXG5jbGFzcyBMYXlvdXRTdGF0ZU1vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFNUT1JBR0VfUFJFRklYID0gJ3dvcmtiZW5jaC4nO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU3RhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTGF5b3V0U3RhdGVDaGFuZ2VFdmVudDxTdG9yYWdlS2V5VHlwZT4+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVN0YXRlID0gdGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHN0YXRlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgdW5rbm93bj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbkNoYW5nZSA9PiB0aGlzLnVwZGF0ZVN0YXRlRnJvbUxlZ2FjeVNldHRpbmdzKGNvbmZpZ3VyYXRpb25DaGFuZ2UpKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVN0YXRlRnJvbUxlZ2FjeVNldHRpbmdzKGNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudDogSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdGlmIChjb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OKSkge1xuXHRcdFx0dGhpcy5zZXRSdW50aW1lVmFsdWVBbmRGaXJlKExheW91dFN0YXRlS2V5cy5BQ1RJVklUWUJBUl9ISURERU4sIHRoaXMuaXNBY3Rpdml0eUJhckhpZGRlbigpKTtcblx0XHR9XG5cblx0XHRpZiAoY29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LmFmZmVjdHNDb25maWd1cmF0aW9uKExlZ2FjeVdvcmtiZW5jaExheW91dFNldHRpbmdzLlNUQVRVU0JBUl9WSVNJQkxFKSkge1xuXHRcdFx0dGhpcy5zZXRSdW50aW1lVmFsdWVBbmRGaXJlKExheW91dFN0YXRlS2V5cy5TVEFUVVNCQVJfSElEREVOLCAhdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShMZWdhY3lXb3JrYmVuY2hMYXlvdXRTZXR0aW5ncy5TVEFUVVNCQVJfVklTSUJMRSkpO1xuXHRcdH1cblxuXHRcdGlmIChjb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTGVnYWN5V29ya2JlbmNoTGF5b3V0U2V0dGluZ3MuU0lERUJBUl9QT1NJVElPTikpIHtcblx0XHRcdHRoaXMuc2V0UnVudGltZVZhbHVlQW5kRmlyZShMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9QT1NJVE9OLCBwb3NpdGlvbkZyb21TdHJpbmcodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShMZWdhY3lXb3JrYmVuY2hMYXlvdXRTZXR0aW5ncy5TSURFQkFSX1BPU0lUSU9OKSA/PyAnbGVmdCcpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUxlZ2FjeVNldHRpbmdzRnJvbVN0YXRlPFQgZXh0ZW5kcyBTdG9yYWdlS2V5VHlwZT4oa2V5OiBSdW50aW1lU3RhdGVLZXk8VD4sIHZhbHVlOiBUKTogdm9pZCB7XG5cdFx0Y29uc3QgaXNaZW5Nb2RlID0gdGhpcy5nZXRSdW50aW1lVmFsdWUoTGF5b3V0U3RhdGVLZXlzLlpFTl9NT0RFX0FDVElWRSk7XG5cdFx0aWYgKGtleS56ZW5Nb2RlSWdub3JlICYmIGlzWmVuTW9kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChrZXkgPT09IExheW91dFN0YXRlS2V5cy5BQ1RJVklUWUJBUl9ISURERU4pIHtcblx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoTGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OLCB2YWx1ZSA/IEFjdGl2aXR5QmFyUG9zaXRpb24uSElEREVOIDogdW5kZWZpbmVkKTtcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gTGF5b3V0U3RhdGVLZXlzLlNUQVRVU0JBUl9ISURERU4pIHtcblx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoTGVnYWN5V29ya2JlbmNoTGF5b3V0U2V0dGluZ3MuU1RBVFVTQkFSX1ZJU0lCTEUsICF2YWx1ZSk7XG5cdFx0fSBlbHNlIGlmIChrZXkgPT09IExheW91dFN0YXRlS2V5cy5TSURFQkFSX1BPU0lUT04pIHtcblx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoTGVnYWN5V29ya2JlbmNoTGF5b3V0U2V0dGluZ3MuU0lERUJBUl9QT1NJVElPTiwgcG9zaXRpb25Ub1N0cmluZyh2YWx1ZSBhcyBQb3NpdGlvbikpO1xuXHRcdH1cblx0fVxuXG5cdGxvYWQobWFpbkNvbnRhaW5lckRpbWVuc2lvbjogSURpbWVuc2lvbik6IHZvaWQge1xuXHRcdGxldCBrZXk6IGtleW9mIHR5cGVvZiBMYXlvdXRTdGF0ZUtleXM7XG5cblx0XHQvLyBMb2FkIHN0b3JlZCB2YWx1ZXMgZm9yIGFsbCBrZXlzXG5cdFx0Zm9yIChrZXkgaW4gTGF5b3V0U3RhdGVLZXlzKSB7XG5cdFx0XHRjb25zdCBzdGF0ZUtleSA9IExheW91dFN0YXRlS2V5c1trZXldIGFzIFdvcmtiZW5jaExheW91dFN0YXRlS2V5PFN0b3JhZ2VLZXlUeXBlPjtcblx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy5sb2FkS2V5RnJvbVN0b3JhZ2Uoc3RhdGVLZXkpO1xuXG5cdFx0XHRpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLnN0YXRlQ2FjaGUuc2V0KHN0YXRlS2V5Lm5hbWUsIHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBcHBseSBsZWdhY3kgc2V0dGluZ3Ncblx0XHR0aGlzLnN0YXRlQ2FjaGUuc2V0KExheW91dFN0YXRlS2V5cy5BQ1RJVklUWUJBUl9ISURERU4ubmFtZSwgdGhpcy5pc0FjdGl2aXR5QmFySGlkZGVuKCkpO1xuXHRcdHRoaXMuc3RhdGVDYWNoZS5zZXQoTGF5b3V0U3RhdGVLZXlzLlNUQVRVU0JBUl9ISURERU4ubmFtZSwgIXRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoTGVnYWN5V29ya2JlbmNoTGF5b3V0U2V0dGluZ3MuU1RBVFVTQkFSX1ZJU0lCTEUpKTtcblx0XHR0aGlzLnN0YXRlQ2FjaGUuc2V0KExheW91dFN0YXRlS2V5cy5TSURFQkFSX1BPU0lUT04ubmFtZSwgcG9zaXRpb25Gcm9tU3RyaW5nKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoTGVnYWN5V29ya2JlbmNoTGF5b3V0U2V0dGluZ3MuU0lERUJBUl9QT1NJVElPTikgPz8gJ2xlZnQnKSk7XG5cblx0XHQvLyBTZXQgZHluYW1pYyBkZWZhdWx0czogcGFydCBzaXppbmcgYW5kIHNpZGUgYmFyIHZpc2liaWxpdHlcblx0XHRMYXlvdXRTdGF0ZUtleXMuUEFORUxfUE9TSVRJT04uZGVmYXVsdFZhbHVlID0gcG9zaXRpb25Gcm9tU3RyaW5nKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoV29ya2JlbmNoTGF5b3V0U2V0dGluZ3MuUEFORUxfUE9TSVRJT04pID8/ICdib3R0b20nKTtcblx0XHRMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9TSVpFLmRlZmF1bHRWYWx1ZSA9IE1hdGgubWluKDMwMCwgbWFpbkNvbnRhaW5lckRpbWVuc2lvbi53aWR0aCAvIDQpO1xuXHRcdExheW91dFN0YXRlS2V5cy5BVVhJTElBUllCQVJfU0laRS5kZWZhdWx0VmFsdWUgPSBNYXRoLm1pbigzMDAsIG1haW5Db250YWluZXJEaW1lbnNpb24ud2lkdGggLyA0KTtcblx0XHRMYXlvdXRTdGF0ZUtleXMuUEFORUxfU0laRS5kZWZhdWx0VmFsdWUgPSAodGhpcy5zdGF0ZUNhY2hlLmdldChMYXlvdXRTdGF0ZUtleXMuUEFORUxfUE9TSVRJT04ubmFtZSkgPz8gaXNIb3Jpem9udGFsKExheW91dFN0YXRlS2V5cy5QQU5FTF9QT1NJVElPTi5kZWZhdWx0VmFsdWUpKSA/IG1haW5Db250YWluZXJEaW1lbnNpb24uaGVpZ2h0IC8gMyA6IG1haW5Db250YWluZXJEaW1lbnNpb24ud2lkdGggLyA0O1xuXHRcdExheW91dFN0YXRlS2V5cy5TSURFQkFSX0hJRERFTi5kZWZhdWx0VmFsdWUgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZO1xuXG5cdFx0Ly8gQXBwbHkgYWxsIGRlZmF1bHRzXG5cdFx0Zm9yIChrZXkgaW4gTGF5b3V0U3RhdGVLZXlzKSB7XG5cdFx0XHRjb25zdCBzdGF0ZUtleSA9IExheW91dFN0YXRlS2V5c1trZXldO1xuXHRcdFx0aWYgKHRoaXMuc3RhdGVDYWNoZS5nZXQoc3RhdGVLZXkubmFtZSkgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLnN0YXRlQ2FjaGUuc2V0KHN0YXRlS2V5Lm5hbWUsIHN0YXRlS2V5LmRlZmF1bHRWYWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmVnaXN0ZXIgZm9yIHJ1bnRpbWUga2V5IGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLlBST0ZJTEUsIHVuZGVmaW5lZCwgdGhpcy5fc3RvcmUpKHN0b3JhZ2VDaGFuZ2VFdmVudCA9PiB7XG5cdFx0XHRsZXQga2V5OiBrZXlvZiB0eXBlb2YgTGF5b3V0U3RhdGVLZXlzO1xuXHRcdFx0Zm9yIChrZXkgaW4gTGF5b3V0U3RhdGVLZXlzKSB7XG5cdFx0XHRcdGNvbnN0IHN0YXRlS2V5ID0gTGF5b3V0U3RhdGVLZXlzW2tleV0gYXMgV29ya2JlbmNoTGF5b3V0U3RhdGVLZXk8U3RvcmFnZUtleVR5cGU+O1xuXHRcdFx0XHRpZiAoc3RhdGVLZXkgaW5zdGFuY2VvZiBSdW50aW1lU3RhdGVLZXkgJiYgc3RhdGVLZXkuc2NvcGUgPT09IFN0b3JhZ2VTY29wZS5QUk9GSUxFICYmIHN0YXRlS2V5LnRhcmdldCA9PT0gU3RvcmFnZVRhcmdldC5VU0VSKSB7XG5cdFx0XHRcdFx0aWYgKGAke0xheW91dFN0YXRlTW9kZWwuU1RPUkFHRV9QUkVGSVh9JHtzdGF0ZUtleS5uYW1lfWAgPT09IHN0b3JhZ2VDaGFuZ2VFdmVudC5rZXkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy5sb2FkS2V5RnJvbVN0b3JhZ2Uoc3RhdGVLZXkpID8/IHN0YXRlS2V5LmRlZmF1bHRWYWx1ZTtcblx0XHRcdFx0XHRcdGlmICh0aGlzLnN0YXRlQ2FjaGUuZ2V0KHN0YXRlS2V5Lm5hbWUpICE9PSB2YWx1ZSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnN0YXRlQ2FjaGUuc2V0KHN0YXRlS2V5Lm5hbWUsIHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsga2V5OiBzdGF0ZUtleSwgdmFsdWUgfSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0c2F2ZSh3b3Jrc3BhY2U6IGJvb2xlYW4sIGdsb2JhbDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGxldCBrZXk6IGtleW9mIHR5cGVvZiBMYXlvdXRTdGF0ZUtleXM7XG5cblx0XHRjb25zdCBpc1plbk1vZGUgPSB0aGlzLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuWkVOX01PREVfQUNUSVZFKTtcblxuXHRcdGZvciAoa2V5IGluIExheW91dFN0YXRlS2V5cykge1xuXHRcdFx0Y29uc3Qgc3RhdGVLZXkgPSBMYXlvdXRTdGF0ZUtleXNba2V5XSBhcyBXb3JrYmVuY2hMYXlvdXRTdGF0ZUtleTxTdG9yYWdlS2V5VHlwZT47XG5cdFx0XHRpZiAoKHdvcmtzcGFjZSAmJiBzdGF0ZUtleS5zY29wZSA9PT0gU3RvcmFnZVNjb3BlLldPUktTUEFDRSkgfHxcblx0XHRcdFx0KGdsb2JhbCAmJiBzdGF0ZUtleS5zY29wZSA9PT0gU3RvcmFnZVNjb3BlLlBST0ZJTEUpKSB7XG5cdFx0XHRcdGlmIChpc1plbk1vZGUgJiYgc3RhdGVLZXkgaW5zdGFuY2VvZiBSdW50aW1lU3RhdGVLZXkgJiYgc3RhdGVLZXkuemVuTW9kZUlnbm9yZSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlOyAvLyBEb24ndCB3cml0ZSBvdXQgc3BlY2lmaWMga2V5cyB3aGlsZSBpbiB6ZW4gbW9kZVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5zYXZlS2V5VG9TdG9yYWdlKHN0YXRlS2V5KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRJbml0aWFsaXphdGlvblZhbHVlPFQgZXh0ZW5kcyBTdG9yYWdlS2V5VHlwZT4oa2V5OiBJbml0aWFsaXphdGlvblN0YXRlS2V5PFQ+KTogVCB7XG5cdFx0cmV0dXJuIHRoaXMuc3RhdGVDYWNoZS5nZXQoa2V5Lm5hbWUpIGFzIFQ7XG5cdH1cblxuXHRzZXRJbml0aWFsaXphdGlvblZhbHVlPFQgZXh0ZW5kcyBTdG9yYWdlS2V5VHlwZT4oa2V5OiBJbml0aWFsaXphdGlvblN0YXRlS2V5PFQ+LCB2YWx1ZTogVCk6IHZvaWQge1xuXHRcdHRoaXMuc3RhdGVDYWNoZS5zZXQoa2V5Lm5hbWUsIHZhbHVlKTtcblx0fVxuXG5cdGdldFJ1bnRpbWVWYWx1ZTxUIGV4dGVuZHMgU3RvcmFnZUtleVR5cGU+KGtleTogUnVudGltZVN0YXRlS2V5PFQ+LCBmYWxsYmFja1RvU2V0dGluZz86IGJvb2xlYW4pOiBUIHtcblx0XHRpZiAoZmFsbGJhY2tUb1NldHRpbmcpIHtcblx0XHRcdHN3aXRjaCAoa2V5KSB7XG5cdFx0XHRcdGNhc2UgTGF5b3V0U3RhdGVLZXlzLkFDVElWSVRZQkFSX0hJRERFTjpcblx0XHRcdFx0XHR0aGlzLnN0YXRlQ2FjaGUuc2V0KGtleS5uYW1lLCB0aGlzLmlzQWN0aXZpdHlCYXJIaWRkZW4oKSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgTGF5b3V0U3RhdGVLZXlzLlNUQVRVU0JBUl9ISURERU46XG5cdFx0XHRcdFx0dGhpcy5zdGF0ZUNhY2hlLnNldChrZXkubmFtZSwgIXRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoTGVnYWN5V29ya2JlbmNoTGF5b3V0U2V0dGluZ3MuU1RBVFVTQkFSX1ZJU0lCTEUpKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBMYXlvdXRTdGF0ZUtleXMuU0lERUJBUl9QT1NJVE9OOlxuXHRcdFx0XHRcdHRoaXMuc3RhdGVDYWNoZS5zZXQoa2V5Lm5hbWUsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoTGVnYWN5V29ya2JlbmNoTGF5b3V0U2V0dGluZ3MuU0lERUJBUl9QT1NJVElPTikgPz8gJ2xlZnQnKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zdGF0ZUNhY2hlLmdldChrZXkubmFtZSkgYXMgVDtcblx0fVxuXG5cdHNldFJ1bnRpbWVWYWx1ZTxUIGV4dGVuZHMgU3RvcmFnZUtleVR5cGU+KGtleTogUnVudGltZVN0YXRlS2V5PFQ+LCB2YWx1ZTogVCk6IHZvaWQge1xuXHRcdHRoaXMuc3RhdGVDYWNoZS5zZXQoa2V5Lm5hbWUsIHZhbHVlKTtcblx0XHRjb25zdCBpc1plbk1vZGUgPSB0aGlzLmdldFJ1bnRpbWVWYWx1ZShMYXlvdXRTdGF0ZUtleXMuWkVOX01PREVfQUNUSVZFKTtcblxuXHRcdGlmIChrZXkuc2NvcGUgPT09IFN0b3JhZ2VTY29wZS5QUk9GSUxFKSB7XG5cdFx0XHRpZiAoIWlzWmVuTW9kZSB8fCAha2V5Lnplbk1vZGVJZ25vcmUpIHtcblx0XHRcdFx0dGhpcy5zYXZlS2V5VG9TdG9yYWdlPFQ+KGtleSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlTGVnYWN5U2V0dGluZ3NGcm9tU3RhdGUoa2V5LCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpc0FjdGl2aXR5QmFySGlkZGVuKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG9sZFZhbHVlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuIHwgdW5kZWZpbmVkPignd29ya2JlbmNoLmFjdGl2aXR5QmFyLnZpc2libGUnKTtcblx0XHRpZiAob2xkVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuICFvbGRWYWx1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04pICE9PSBBY3Rpdml0eUJhclBvc2l0aW9uLkRFRkFVTFQ7XG5cdH1cblxuXHRwcml2YXRlIHNldFJ1bnRpbWVWYWx1ZUFuZEZpcmU8VCBleHRlbmRzIFN0b3JhZ2VLZXlUeXBlPihrZXk6IFJ1bnRpbWVTdGF0ZUtleTxUPiwgdmFsdWU6IFQpOiB2b2lkIHtcblx0XHRjb25zdCBwcmV2aW91c1ZhbHVlID0gdGhpcy5zdGF0ZUNhY2hlLmdldChrZXkubmFtZSk7XG5cdFx0aWYgKHByZXZpb3VzVmFsdWUgPT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRSdW50aW1lVmFsdWUoa2V5LCB2YWx1ZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHsga2V5LCB2YWx1ZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgc2F2ZUtleVRvU3RvcmFnZTxUIGV4dGVuZHMgU3RvcmFnZUtleVR5cGU+KGtleTogV29ya2JlbmNoTGF5b3V0U3RhdGVLZXk8VD4pOiB2b2lkIHtcblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuc3RhdGVDYWNoZS5nZXQoa2V5Lm5hbWUpIGFzIFQ7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShgJHtMYXlvdXRTdGF0ZU1vZGVsLlNUT1JBR0VfUFJFRklYfSR7a2V5Lm5hbWV9YCwgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IEpTT04uc3RyaW5naWZ5KHZhbHVlKSA6IHZhbHVlLCBrZXkuc2NvcGUsIGtleS50YXJnZXQpO1xuXHR9XG5cblx0cHJpdmF0ZSBsb2FkS2V5RnJvbVN0b3JhZ2U8VCBleHRlbmRzIFN0b3JhZ2VLZXlUeXBlPihrZXk6IFdvcmtiZW5jaExheW91dFN0YXRlS2V5PFQ+KTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IHZhbHVlOiBhbnkgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChgJHtMYXlvdXRTdGF0ZU1vZGVsLlNUT1JBR0VfUFJFRklYfSR7a2V5Lm5hbWV9YCwga2V5LnNjb3BlKTtcblxuXHRcdGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRzd2l0Y2ggKHR5cGVvZiBrZXkuZGVmYXVsdFZhbHVlKSB7XG5cdFx0XHRcdGNhc2UgJ2Jvb2xlYW4nOiB2YWx1ZSA9IHZhbHVlID09PSAndHJ1ZSc7IGJyZWFrO1xuXHRcdFx0XHRjYXNlICdudW1iZXInOiB2YWx1ZSA9IHBhcnNlSW50KHZhbHVlKTsgYnJlYWs7XG5cdFx0XHRcdGNhc2UgJ29iamVjdCc6IHZhbHVlID0gSlNPTi5wYXJzZSh2YWx1ZSk7IGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB2YWx1ZSBhcyBUIHwgdW5kZWZpbmVkO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxZQUFZLGVBQWUsaUJBQThCLG9CQUFvQjtBQUN0RixT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LElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSxzQkFBK0I7QUFDdEMsVUFBTSxXQUFXLEtBQUsscUJBQXFCLFNBQThCLCtCQUErQjtBQUN4RyxRQUFJLGFBQWEsUUFBVztBQUMzQixhQUFPLENBQUM7QUFBQSxJQUNUO0FBRUEsV0FBTyxLQUFLLHFCQUFxQixTQUFTLGVBQWUscUJBQXFCLE1BQU0sb0JBQW9CO0FBQUEsRUFDekc7QUFBQSxFQUVRLHVCQUFpRCxLQUF5QixPQUFnQjtBQUNqRyxVQUFNLGdCQUFnQixLQUFLLFdBQVcsSUFBSSxJQUFJLElBQUk7QUFDbEQsUUFBSSxrQkFBa0IsT0FBTztBQUM1QjtBQUFBLElBQ0Q7QUFFQSxTQUFLLGdCQUFnQixLQUFLLEtBQUs7QUFDL0IsU0FBSyxrQkFBa0IsS0FBSyxFQUFFLEtBQUssTUFBTSxDQUFDO0FBQUEsRUFDM0M7QUFBQSxFQUVRLGlCQUEyQyxLQUF1QztBQUN6RixVQUFNLFFBQVEsS0FBSyxXQUFXLElBQUksSUFBSSxJQUFJO0FBQzFDLFNBQUssZUFBZSxNQUFNLEdBQUcsa0JBQWlCLGNBQWMsR0FBRyxJQUFJLElBQUksSUFBSSxPQUFPLFVBQVUsV0FBVyxLQUFLLFVBQVUsS0FBSyxJQUFJLE9BQU8sSUFBSSxPQUFPLElBQUksTUFBTTtBQUFBLEVBQzVKO0FBQUEsRUFFUSxtQkFBNkMsS0FBZ0Q7QUFDcEcsUUFBSSxRQUFhLEtBQUssZUFBZSxJQUFJLEdBQUcsa0JBQWlCLGNBQWMsR0FBRyxJQUFJLElBQUksSUFBSSxJQUFJLEtBQUs7QUFFbkcsUUFBSSxVQUFVLFFBQVc7QUFDeEIsY0FBUSxPQUFPLElBQUksY0FBYztBQUFBLFFBQ2hDLEtBQUs7QUFBVyxrQkFBUSxVQUFVO0FBQVE7QUFBQSxRQUMxQyxLQUFLO0FBQVUsa0JBQVEsU0FBUyxLQUFLO0FBQUc7QUFBQSxRQUN4QyxLQUFLO0FBQVUsa0JBQVEsS0FBSyxNQUFNLEtBQUs7QUFBRztBQUFBLE1BQzNDO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFoTU0sa0JBRVcsaUJBQWlCO0FBRmxDLElBQU0sbUJBQU47IiwKICAibmFtZXMiOiBbIkxheW91dENsYXNzZXMiLCAicG9zaXRpb24iLCAiZWRpdG9ycyIsICJpIiwgInNpemUiLCAiV29ya2JlbmNoTGF5b3V0U2V0dGluZ3MiLCAiTGVnYWN5V29ya2JlbmNoTGF5b3V0U2V0dGluZ3MiLCAia2V5Il0KfQo=
