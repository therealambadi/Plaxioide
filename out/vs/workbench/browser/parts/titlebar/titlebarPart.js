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
import "./media/titlebarpart.css";
import { localize, localize2 } from "../../../../nls.js";
import { MultiWindowParts, Part } from "../../part.js";
import { getWCOTitlebarAreaRect, getZoomFactor, isWCOEnabled } from "../../../../base/browser/browser.js";
import { getTitleBarStyle, getMenuBarVisibility, hasCustomTitlebar, hasNativeTitlebar, DEFAULT_CUSTOM_TITLEBAR_HEIGHT, getWindowControlsStyle, WindowControlsStyle } from "../../../../platform/window/common/window.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { TITLE_BAR_ACTIVE_BACKGROUND, TITLE_BAR_ACTIVE_FOREGROUND, TITLE_BAR_INACTIVE_FOREGROUND, TITLE_BAR_INACTIVE_BACKGROUND, TITLE_BAR_BORDER, WORKBENCH_BACKGROUND } from "../../../common/theme.js";
import { isMacintosh, isWindows, isLinux, isWeb, isNative, platformLocale } from "../../../../base/common/platform.js";
import { Color } from "../../../../base/common/color.js";
import { EventType, EventHelper, Dimension, append, $, addDisposableListener, prepend, reset, getWindow, getWindowId, isAncestor, getActiveDocument, isHTMLElement } from "../../../../base/browser/dom.js";
import { CustomMenubarControl } from "./menubarControl.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { Parts, IWorkbenchLayoutService, ActivityBarPosition, LayoutSettings, EditorActionsLocation, EditorTabsMode } from "../../../services/layout/browser/layoutService.js";
import { createActionViewItem, fillInActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { WindowTitle } from "./windowTitle.js";
import { CommandCenterControl } from "./commandCenterControl.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { ACCOUNTS_ACTIVITY_ID, GLOBAL_ACTIVITY_ID } from "../../../common/activity.js";
import { AccountsActivityActionViewItem, isAccountsActionVisible, SimpleAccountActivityActionViewItem, SimpleGlobalActivityActionViewItem } from "../globalCompositeBar.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { Action, ActionRunner } from "../../../../base/common/actions.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ActionsOrientation, prepareActions } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { EDITOR_CORE_NAVIGATION_COMMANDS } from "../editor/editorCommands.js";
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { EditorPane } from "../editor/editorPane.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { EditorCommandsContextActionRunner } from "../editor/editorTabsControl.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { ACCOUNTS_ACTIVITY_TILE_ACTION, GLOBAL_ACTIVITY_TITLE_ACTION } from "./titlebarActions.js";
import { createInstantHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { safeIntl } from "../../../../base/common/date.js";
import { TitleBarVisibleContext } from "../../../common/contextkeys.js";
let BrowserTitleService = class extends MultiWindowParts {
  constructor(instantiationService, storageService, themeService) {
    super("workbench.titleService", themeService, storageService);
    this.instantiationService = instantiationService;
    this.properties = void 0;
    this.variables = /* @__PURE__ */ new Map();
    this.mainPart = this._register(this.createMainTitlebarPart());
    this.onMenubarVisibilityChange = this.mainPart.onMenubarVisibilityChange;
    this._register(this.registerPart(this.mainPart));
    this.registerActions();
    this.registerAPICommands();
  }
  createMainTitlebarPart() {
    return this.instantiationService.createInstance(MainBrowserTitlebarPart);
  }
  registerActions() {
    const that = this;
    this._register(registerAction2(class FocusTitleBar extends Action2 {
      constructor() {
        super({
          id: `workbench.action.focusTitleBar`,
          title: localize2("focusTitleBar", "Focus Title Bar"),
          category: Categories.View,
          f1: true,
          precondition: TitleBarVisibleContext
        });
      }
      run() {
        that.getPartByDocument(getActiveDocument())?.focus();
      }
    }));
  }
  registerAPICommands() {
    this._register(CommandsRegistry.registerCommand({
      id: "registerWindowTitleVariable",
      handler: (accessor, name, contextKey) => {
        this.registerVariables([{ name, contextKey }]);
      },
      metadata: {
        description: "Registers a new title variable",
        args: [
          { name: "name", schema: { type: "string" }, description: "The name of the variable to register" },
          { name: "contextKey", schema: { type: "string" }, description: "The context key to use for the value of the variable" }
        ]
      }
    }));
  }
  //#region Auxiliary Titlebar Parts
  createAuxiliaryTitlebarPart(container, editorGroupsContainer) {
    const titlebarPartContainer = $(".part.titlebar", { role: "none" });
    titlebarPartContainer.style.position = "relative";
    container.insertBefore(titlebarPartContainer, container.firstChild);
    const disposables = new DisposableStore();
    const titlebarPart = this.doCreateAuxiliaryTitlebarPart(titlebarPartContainer, editorGroupsContainer);
    disposables.add(this.registerPart(titlebarPart));
    disposables.add(Event.runAndSubscribe(titlebarPart.onDidChange, () => titlebarPartContainer.style.height = `${titlebarPart.height}px`));
    titlebarPart.create(titlebarPartContainer);
    if (this.properties) {
      titlebarPart.updateProperties(this.properties);
    }
    if (this.variables.size) {
      titlebarPart.registerVariables(Array.from(this.variables.values()));
    }
    Event.once(titlebarPart.onWillDispose)(() => disposables.dispose());
    return titlebarPart;
  }
  doCreateAuxiliaryTitlebarPart(container, editorGroupsContainer) {
    return this.instantiationService.createInstance(AuxiliaryBrowserTitlebarPart, container, editorGroupsContainer, this.mainPart);
  }
  updateProperties(properties) {
    this.properties = properties;
    for (const part of this.parts) {
      part.updateProperties(properties);
    }
  }
  registerVariables(variables) {
    const newVariables = [];
    for (const variable of variables) {
      if (!this.variables.has(variable.name)) {
        this.variables.set(variable.name, variable);
        newVariables.push(variable);
      }
    }
    for (const part of this.parts) {
      part.registerVariables(newVariables);
    }
  }
  //#endregion
};
BrowserTitleService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IThemeService)
], BrowserTitleService);
let BrowserTitlebarPart = class extends Part {
  constructor(id, targetWindow, editorGroupsContainer, contextMenuService, configurationService, environmentService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, editorGroupService, editorService, menuService, keybindingService) {
    super(id, { hasTitle: false }, themeService, storageService, layoutService);
    this.contextMenuService = contextMenuService;
    this.configurationService = configurationService;
    this.environmentService = environmentService;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.contextKeyService = contextKeyService;
    this.hostService = hostService;
    this.editorGroupService = editorGroupService;
    this.menuService = menuService;
    this.keybindingService = keybindingService;
    //#region IView
    this.minimumWidth = 0;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    //#endregion
    //#region Events
    this._onMenubarVisibilityChange = this._register(new Emitter());
    this.onMenubarVisibilityChange = this._onMenubarVisibilityChange.event;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this.actionToolBarDisposable = this._register(new DisposableStore());
    this.editorActionsChangeDisposable = this._register(new DisposableStore());
    this.hasGlobalToolbarEntries = false;
    this.globalToolbarMenuDisposables = this._register(new DisposableStore());
    this.editorToolbarMenuDisposables = this._register(new DisposableStore());
    this.layoutToolbarMenuDisposables = this._register(new DisposableStore());
    this.activityToolbarDisposables = this._register(new DisposableStore());
    this.titleDisposables = this._register(new DisposableStore());
    this.isInactive = false;
    this.titleBarStyle = getTitleBarStyle(this.configurationService);
    this.globalToolbarMenu = this._register(this.menuService.createMenu(MenuId.TitleBar, this.contextKeyService));
    this.isAuxiliary = editorGroupsContainer !== "main";
    this.editorService = editorService.createScoped(editorGroupsContainer, this._store);
    this.editorGroupsContainer = editorGroupsContainer === "main" ? editorGroupService.mainPart : editorGroupsContainer;
    this.windowTitle = this._register(instantiationService.createInstance(WindowTitle, targetWindow, editorGroupsContainer));
    this.hoverDelegate = this._register(createInstantHoverDelegate());
    this.registerListeners(getWindowId(targetWindow));
  }
  get minimumHeight() {
    const wcoEnabled = isWeb && isWCOEnabled();
    let value = this.isCommandCenterVisible || wcoEnabled ? DEFAULT_CUSTOM_TITLEBAR_HEIGHT : 30;
    if (wcoEnabled) {
      value = Math.max(value, getWCOTitlebarAreaRect(getWindow(this.element))?.height ?? 0);
    }
    return value / (this.preventZoom ? getZoomFactor(getWindow(this.element)) : 1);
  }
  get maximumHeight() {
    return this.minimumHeight;
  }
  registerListeners(targetWindowId) {
    this._register(this.hostService.onDidChangeFocus((focused) => focused ? this.onFocus() : this.onBlur()));
    this._register(this.hostService.onDidChangeActiveWindow((windowId) => windowId === targetWindowId ? this.onFocus() : this.onBlur()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationChanged(e)));
    this._register(this.editorGroupService.onDidChangeEditorPartOptions((e) => this.onEditorPartConfigurationChange(e)));
  }
  onBlur() {
    this.isInactive = true;
    this.updateStyles();
  }
  onFocus() {
    this.isInactive = false;
    this.updateStyles();
  }
  onEditorPartConfigurationChange({ oldPartOptions, newPartOptions }) {
    if (oldPartOptions.editorActionsLocation !== newPartOptions.editorActionsLocation || oldPartOptions.showTabs !== newPartOptions.showTabs) {
      if (hasCustomTitlebar(this.configurationService, this.titleBarStyle) && this.actionToolBar) {
        this.createActionToolBar();
        this.createActionToolBarMenus({ editorActions: true });
        this._onDidChange.fire(void 0);
      }
    }
  }
  onConfigurationChanged(event) {
    if (!this.isAuxiliary && !hasNativeTitlebar(this.configurationService, this.titleBarStyle) && (!isMacintosh || isWeb)) {
      if (event.affectsConfiguration("window.menuBarVisibility")) {
        if (this.currentMenubarVisibility === "compact") {
          this.uninstallMenubar();
        } else {
          this.installMenubar();
        }
      }
    }
    if (hasCustomTitlebar(this.configurationService, this.titleBarStyle) && this.actionToolBar) {
      const affectsLayoutControl = event.affectsConfiguration(LayoutSettings.LAYOUT_ACTIONS);
      const affectsActivityControl = event.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION);
      if (affectsLayoutControl || affectsActivityControl) {
        this.createActionToolBarMenus({ layoutActions: affectsLayoutControl, activityActions: affectsActivityControl });
        this._onDidChange.fire(void 0);
      }
    }
    if (event.affectsConfiguration(LayoutSettings.COMMAND_CENTER)) {
      this.createTitle();
      this._onDidChange.fire(void 0);
    }
  }
  installMenubar() {
    if (this.menubar) {
      return;
    }
    this.customMenubar = this._register(this.instantiationService.createInstance(CustomMenubarControl));
    this.menubar = append(this.leftContent, $("div.menubar"));
    this.menubar.setAttribute("role", "menubar");
    this._register(this.customMenubar.onVisibilityChange((e) => this.onMenubarVisibilityChanged(e)));
    this.customMenubar.create(this.menubar);
  }
  uninstallMenubar() {
    this.customMenubar?.dispose();
    this.customMenubar = void 0;
    this.menubar?.remove();
    this.menubar = void 0;
    this.onMenubarVisibilityChanged(false);
  }
  onMenubarVisibilityChanged(visible) {
    if (isWeb || isWindows || isLinux) {
      if (this.lastLayoutDimensions) {
        this.layout(this.lastLayoutDimensions.width, this.lastLayoutDimensions.height);
      }
      this._onMenubarVisibilityChange.fire(visible);
    }
  }
  updateProperties(properties) {
    this.windowTitle.updateProperties(properties);
  }
  registerVariables(variables) {
    this.windowTitle.registerVariables(variables);
  }
  createContentArea(parent) {
    this.element = parent;
    this.rootContainer = append(parent, $(".titlebar-container"));
    this.leftContent = append(this.rootContainer, $(".titlebar-left"));
    this.centerContent = append(this.rootContainer, $(".titlebar-center"));
    this.rightContent = append(this.rootContainer, $(".titlebar-right"));
    this.navToolBarElement = append(this.leftContent, $("div.titlebar-nav-container"));
    const sidebarToggle = append(this.navToolBarElement, $("div.codicon.codicon-layout-sidebar-left.plc-sidebar-toggle"));
    sidebarToggle.title = localize("toggleSidebar", "Toggle Primary Side Bar");
    sidebarToggle.setAttribute("role", "button");
    this._register(addDisposableListener(sidebarToggle, EventType.CLICK, (e) => {
      EventHelper.stop(e, true);
      this.instantiationService.invokeFunction((accessor) => accessor.get(ICommandService).executeCommand("workbench.action.toggleSidebarVisibility"));
    }));
    this.navToolBar = this._register(this.instantiationService.createInstance(WorkbenchToolBar, this.navToolBarElement, {
      orientation: ActionsOrientation.HORIZONTAL,
      ariaLabel: localize("ariaLabelTitleNav", "Navigation actions"),
      getKeyBinding: (action) => this.getKeybinding(action),
      telemetrySource: "titlePart",
      actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
      hoverDelegate: this.hoverDelegate
    }));
    const runNavCommand = (id) => () => this.instantiationService.invokeFunction((accessor) => accessor.get(ICommandService).executeCommand(id));
    this.navToolBar.setActions([
      new Action("workbench.action.navigateBack", localize("navigateBack", "Go Back"), "codicon codicon-arrow-left", true, runNavCommand("workbench.action.navigateBack")),
      new Action("workbench.action.navigateForward", localize("navigateForward", "Go Forward"), "codicon codicon-arrow-right", true, runNavCommand("workbench.action.navigateForward"))
    ]);
    if ((isWindows || isLinux) && !hasNativeTitlebar(this.configurationService, this.titleBarStyle)) {
      this.appIcon = prepend(this.leftContent, $("a.window-appicon"));
    }
    this.dragRegion = prepend(this.rootContainer, $("div.titlebar-drag-region"));
    if (!this.isAuxiliary && !hasNativeTitlebar(this.configurationService, this.titleBarStyle) && (!isMacintosh || isWeb) && this.currentMenubarVisibility !== "compact") {
      this.installMenubar();
    }
    this.title = append(this.centerContent, $("div.window-title"));
    this.createTitle();
    if (hasCustomTitlebar(this.configurationService, this.titleBarStyle)) {
      this.actionToolBarElement = append(this.rightContent, $("div.action-toolbar-container"));
      this.createActionToolBar();
      this.createActionToolBarMenus();
    }
    if (!hasNativeTitlebar(this.configurationService, this.titleBarStyle)) {
      let primaryWindowControlsLocation = isMacintosh ? "left" : "right";
      if (isMacintosh && isNative) {
        const localeInfo = safeIntl.Locale(platformLocale);
        if (localeInfo?.textInfo?.direction === "rtl") {
          primaryWindowControlsLocation = "right";
        }
      }
      if (isMacintosh && isNative && primaryWindowControlsLocation === "left") {
      } else if (getWindowControlsStyle(this.configurationService) === WindowControlsStyle.HIDDEN) {
      } else {
        this.windowControlsContainer = append(primaryWindowControlsLocation === "left" ? this.leftContent : this.rightContent, $("div.window-controls-container"));
        if (isWeb) {
          append(primaryWindowControlsLocation === "left" ? this.rightContent : this.leftContent, $("div.window-controls-container"));
        }
        if (isWCOEnabled()) {
          this.windowControlsContainer.classList.add("wco-enabled");
        }
      }
    }
    {
      this._register(addDisposableListener(this.rootContainer, EventType.CONTEXT_MENU, (e) => {
        EventHelper.stop(e);
        let targetMenu;
        if (isMacintosh && isHTMLElement(e.target) && isAncestor(e.target, this.title)) {
          targetMenu = MenuId.TitleBarTitleContext;
        } else {
          targetMenu = MenuId.TitleBarContext;
        }
        this.onContextMenu(e, targetMenu);
      }));
      if (isMacintosh) {
        this._register(addDisposableListener(
          this.title,
          EventType.MOUSE_DOWN,
          (e) => {
            if (e.metaKey) {
              EventHelper.stop(
                e,
                true
                /* stop bubbling to prevent command center from opening */
              );
              this.onContextMenu(e, MenuId.TitleBarTitleContext);
            }
          },
          true
          /* capture phase to prevent command center from opening */
        ));
      }
    }
    this.updateStyles();
    return this.element;
  }
  createTitle() {
    this.titleDisposables.clear();
    if (!this.isCommandCenterVisible) {
      this.title.innerText = this.windowTitle.value;
      this.titleDisposables.add(this.windowTitle.onDidChange(() => {
        this.title.innerText = this.windowTitle.value;
        if (this.lastLayoutDimensions) {
          this.updateLayout(this.lastLayoutDimensions);
        }
      }));
    } else {
      const commandCenter = this.instantiationService.createInstance(CommandCenterControl, this.windowTitle, this.hoverDelegate);
      reset(this.title, commandCenter.element);
      this.titleDisposables.add(commandCenter);
    }
  }
  actionViewItemProvider(action, options) {
    if (!this.isAuxiliary) {
      if (action.id === GLOBAL_ACTIVITY_ID) {
        return this.instantiationService.createInstance(SimpleGlobalActivityActionViewItem, { position: () => HoverPosition.BELOW }, options);
      }
      if (action.id === ACCOUNTS_ACTIVITY_ID) {
        return this.instantiationService.createInstance(SimpleAccountActivityActionViewItem, { position: () => HoverPosition.BELOW }, options);
      }
    }
    const activeEditorPane = this.editorGroupsContainer.activeGroup?.activeEditorPane;
    if (activeEditorPane && activeEditorPane instanceof EditorPane) {
      const result = activeEditorPane.getActionViewItem(action, options);
      if (result) {
        return result;
      }
    }
    return createActionViewItem(this.instantiationService, action, { ...options, menuAsChild: false });
  }
  getKeybinding(action) {
    const editorPaneAwareContextKeyService = this.editorGroupsContainer.activeGroup?.activeEditorPane?.scopedContextKeyService ?? this.contextKeyService;
    return this.keybindingService.lookupKeybinding(action.id, editorPaneAwareContextKeyService);
  }
  createActionToolBar() {
    this.actionToolBarDisposable.clear();
    this.actionToolBar = this.actionToolBarDisposable.add(this.instantiationService.createInstance(WorkbenchToolBar, this.actionToolBarElement, {
      contextMenu: MenuId.TitleBarContext,
      orientation: ActionsOrientation.HORIZONTAL,
      ariaLabel: localize("ariaLabelTitleActions", "Title actions"),
      getKeyBinding: (action) => this.getKeybinding(action),
      overflowBehavior: { maxItems: 9, exempted: [ACCOUNTS_ACTIVITY_ID, GLOBAL_ACTIVITY_ID, ...EDITOR_CORE_NAVIGATION_COMMANDS] },
      anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
      telemetrySource: "titlePart",
      highlightToggledItems: this.editorActionsEnabled,
      // Only show toggled state for editor actions (Layout actions are not shown as toggled)
      actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
      hoverDelegate: this.hoverDelegate
    }));
    if (this.editorActionsEnabled) {
      this.actionToolBarDisposable.add(this.editorGroupsContainer.onDidChangeActiveGroup(() => this.createActionToolBarMenus({ editorActions: true })));
    }
  }
  createActionToolBarMenus(update = true) {
    if (update === true) {
      update = { editorActions: true, layoutActions: true, activityActions: true };
    }
    const updateToolBarActions = () => {
      const actions = { primary: [], secondary: [] };
      if (this.editorActionsEnabled) {
        this.editorActionsChangeDisposable.clear();
        const activeGroup = this.editorGroupsContainer.activeGroup;
        if (activeGroup) {
          const editorActions = activeGroup.createEditorActions(this.editorActionsChangeDisposable);
          actions.primary.push(...editorActions.actions.primary);
          actions.secondary.push(...editorActions.actions.secondary);
          this.editorActionsChangeDisposable.add(editorActions.onDidChange(() => updateToolBarActions()));
        }
      }
      const globalToolbarActions = this.globalToolbarMenu.getActions();
      this.hasGlobalToolbarEntries = globalToolbarActions.length > 0;
      fillInActionBarActions(
        globalToolbarActions,
        actions
      );
      if (this.layoutToolbarMenu) {
        fillInActionBarActions(
          this.layoutToolbarMenu.getActions(),
          actions,
          () => !this.editorActionsEnabled
          // Layout Actions in overflow menu when editor actions enabled in title bar
        );
      }
      if (this.activityActionsEnabled) {
        if (isAccountsActionVisible(this.storageService)) {
          actions.primary.push(ACCOUNTS_ACTIVITY_TILE_ACTION);
        }
        actions.primary.push(GLOBAL_ACTIVITY_TITLE_ACTION);
      }
      this.actionToolBar.setActions(prepareActions(actions.primary), prepareActions(actions.secondary));
    };
    if (update.editorActions) {
      this.editorToolbarMenuDisposables.clear();
      if (this.editorActionsEnabled && this.editorService.activeEditor !== void 0) {
        const context = { groupId: this.editorGroupsContainer.activeGroup.id };
        this.actionToolBar.actionRunner = this.editorToolbarMenuDisposables.add(new EditorCommandsContextActionRunner(context));
        this.actionToolBar.context = context;
      } else {
        this.actionToolBar.actionRunner = this.editorToolbarMenuDisposables.add(new ActionRunner());
        this.actionToolBar.context = void 0;
      }
    }
    if (update.layoutActions) {
      this.layoutToolbarMenuDisposables.clear();
      if (this.layoutControlEnabled) {
        this.layoutToolbarMenu = this.menuService.createMenu(MenuId.LayoutControlMenu, this.contextKeyService);
        this.layoutToolbarMenuDisposables.add(this.layoutToolbarMenu);
        this.layoutToolbarMenuDisposables.add(this.layoutToolbarMenu.onDidChange(() => updateToolBarActions()));
      } else {
        this.layoutToolbarMenu = void 0;
      }
    }
    this.globalToolbarMenuDisposables.clear();
    this.globalToolbarMenuDisposables.add(this.globalToolbarMenu.onDidChange(() => updateToolBarActions()));
    if (update.activityActions) {
      this.activityToolbarDisposables.clear();
      if (this.activityActionsEnabled) {
        this.activityToolbarDisposables.add(this.storageService.onDidChangeValue(StorageScope.PROFILE, AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY, this._store)(() => updateToolBarActions()));
      }
    }
    updateToolBarActions();
  }
  updateStyles() {
    super.updateStyles();
    if (this.element) {
      if (this.isInactive) {
        this.element.classList.add("inactive");
      } else {
        this.element.classList.remove("inactive");
      }
      const titleBackground = this.getColor(this.isInactive ? TITLE_BAR_INACTIVE_BACKGROUND : TITLE_BAR_ACTIVE_BACKGROUND, (color, theme) => {
        return color.isOpaque() ? color : color.makeOpaque(WORKBENCH_BACKGROUND(theme));
      }) || "";
      this.element.style.backgroundColor = titleBackground;
      if (this.appIconBadge) {
        this.appIconBadge.style.backgroundColor = titleBackground;
      }
      if (titleBackground && Color.fromHex(titleBackground).isLighter()) {
        this.element.classList.add("light");
      } else {
        this.element.classList.remove("light");
      }
      const titleForeground = this.getColor(this.isInactive ? TITLE_BAR_INACTIVE_FOREGROUND : TITLE_BAR_ACTIVE_FOREGROUND);
      this.element.style.color = titleForeground || "";
      const titleBorder = this.getColor(TITLE_BAR_BORDER);
      this.element.style.borderBottom = titleBorder ? `1px solid ${titleBorder}` : "";
    }
  }
  onContextMenu(e, menuId) {
    const event = new StandardMouseEvent(getWindow(this.element), e);
    this.contextMenuService.showContextMenu({
      getAnchor: () => event,
      menuId,
      contextKeyService: this.contextKeyService,
      domForShadowRoot: isMacintosh && isNative ? event.target : void 0
    });
  }
  get currentMenubarVisibility() {
    if (this.isAuxiliary) {
      return "hidden";
    }
    return getMenuBarVisibility(this.configurationService);
  }
  get layoutControlEnabled() {
    return !this.isAuxiliary && this.configurationService.getValue(LayoutSettings.LAYOUT_ACTIONS) !== false;
  }
  get isCommandCenterVisible() {
    return this.configurationService.getValue(LayoutSettings.COMMAND_CENTER) !== false;
  }
  get editorActionsEnabled() {
    return this.editorGroupService.partOptions.editorActionsLocation === EditorActionsLocation.TITLEBAR || this.editorGroupService.partOptions.editorActionsLocation === EditorActionsLocation.DEFAULT && this.editorGroupService.partOptions.showTabs === EditorTabsMode.NONE;
  }
  get activityActionsEnabled() {
    const activityBarPosition = this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION);
    return !this.isAuxiliary && (activityBarPosition === ActivityBarPosition.TOP || activityBarPosition === ActivityBarPosition.BOTTOM);
  }
  get hasZoomableElements() {
    const hasMenubar = !(this.currentMenubarVisibility === "hidden" || this.currentMenubarVisibility === "compact" || !isWeb && isMacintosh);
    const hasCommandCenter = this.isCommandCenterVisible;
    const hasToolBarActions = this.hasGlobalToolbarEntries || this.layoutControlEnabled || this.editorActionsEnabled || this.activityActionsEnabled;
    return hasMenubar || hasCommandCenter || hasToolBarActions;
  }
  get preventZoom() {
    return getZoomFactor(getWindow(this.element)) < 1 || !this.hasZoomableElements;
  }
  layout(width, height) {
    this.updateLayout(new Dimension(width, height));
    super.layoutContents(width, height);
  }
  updateLayout(dimension) {
    this.lastLayoutDimensions = dimension;
    if (hasCustomTitlebar(this.configurationService, this.titleBarStyle)) {
      const zoomFactor = getZoomFactor(getWindow(this.element));
      this.element.style.setProperty("--zoom-factor", zoomFactor.toString());
      this.rootContainer.classList.toggle("counter-zoom", this.preventZoom);
      if (this.customMenubar) {
        const menubarDimension = new Dimension(0, dimension.height);
        this.customMenubar.layout(menubarDimension);
      }
    }
  }
  focus() {
    if (this.customMenubar) {
      this.customMenubar.toggleFocus();
    } else {
      this.element.querySelector('[tabindex]:not([tabindex="-1"])')?.focus();
    }
  }
  toJSON() {
    return {
      type: Parts.TITLEBAR_PART
    };
  }
  dispose() {
    this._onWillDispose.fire();
    super.dispose();
  }
};
BrowserTitlebarPart = __decorateClass([
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IBrowserWorkbenchEnvironmentService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, IWorkbenchLayoutService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IHostService),
  __decorateParam(12, IEditorGroupsService),
  __decorateParam(13, IEditorService),
  __decorateParam(14, IMenuService),
  __decorateParam(15, IKeybindingService)
], BrowserTitlebarPart);
let MainBrowserTitlebarPart = class extends BrowserTitlebarPart {
  constructor(contextMenuService, configurationService, environmentService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, editorGroupService, editorService, menuService, keybindingService) {
    super(Parts.TITLEBAR_PART, mainWindow, "main", contextMenuService, configurationService, environmentService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, editorGroupService, editorService, menuService, keybindingService);
  }
};
MainBrowserTitlebarPart = __decorateClass([
  __decorateParam(0, IContextMenuService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IBrowserWorkbenchEnvironmentService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IWorkbenchLayoutService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IHostService),
  __decorateParam(9, IEditorGroupsService),
  __decorateParam(10, IEditorService),
  __decorateParam(11, IMenuService),
  __decorateParam(12, IKeybindingService)
], MainBrowserTitlebarPart);
let AuxiliaryBrowserTitlebarPart = class extends BrowserTitlebarPart {
  constructor(container, editorGroupsContainer, mainTitlebar, contextMenuService, configurationService, environmentService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, editorGroupService, editorService, menuService, keybindingService) {
    const id = AuxiliaryBrowserTitlebarPart.COUNTER++;
    super(`workbench.parts.auxiliaryTitle.${id}`, getWindow(container), editorGroupsContainer, contextMenuService, configurationService, environmentService, instantiationService, themeService, storageService, layoutService, contextKeyService, hostService, editorGroupService, editorService, menuService, keybindingService);
    this.container = container;
    this.mainTitlebar = mainTitlebar;
  }
  get height() {
    return this.minimumHeight;
  }
  get preventZoom() {
    return getZoomFactor(getWindow(this.element)) < 1 || !this.mainTitlebar.hasZoomableElements;
  }
};
AuxiliaryBrowserTitlebarPart.COUNTER = 1;
AuxiliaryBrowserTitlebarPart = __decorateClass([
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IBrowserWorkbenchEnvironmentService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, IWorkbenchLayoutService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IHostService),
  __decorateParam(12, IEditorGroupsService),
  __decorateParam(13, IEditorService),
  __decorateParam(14, IMenuService),
  __decorateParam(15, IKeybindingService)
], AuxiliaryBrowserTitlebarPart);
export {
  AuxiliaryBrowserTitlebarPart,
  BrowserTitleService,
  BrowserTitlebarPart,
  MainBrowserTitlebarPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy90aXRsZWJhci90aXRsZWJhclBhcnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvdGl0bGViYXJwYXJ0LmNzcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IE11bHRpV2luZG93UGFydHMsIFBhcnQgfSBmcm9tICcuLi8uLi9wYXJ0LmpzJztcbmltcG9ydCB7IElUaXRsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90aXRsZS9icm93c2VyL3RpdGxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRXQ09UaXRsZWJhckFyZWFSZWN0LCBnZXRab29tRmFjdG9yLCBpc1dDT0VuYWJsZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvYnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBNZW51QmFyVmlzaWJpbGl0eSwgZ2V0VGl0bGVCYXJTdHlsZSwgZ2V0TWVudUJhclZpc2liaWxpdHksIGhhc0N1c3RvbVRpdGxlYmFyLCBoYXNOYXRpdmVUaXRsZWJhciwgREVGQVVMVF9DVVNUT01fVElUTEVCQVJfSEVJR0hULCBnZXRXaW5kb3dDb250cm9sc1N0eWxlLCBXaW5kb3dDb250cm9sc1N0eWxlLCBUaXRsZWJhclN0eWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvYnJvd3Nlci9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVElUTEVfQkFSX0FDVElWRV9CQUNLR1JPVU5ELCBUSVRMRV9CQVJfQUNUSVZFX0ZPUkVHUk9VTkQsIFRJVExFX0JBUl9JTkFDVElWRV9GT1JFR1JPVU5ELCBUSVRMRV9CQVJfSU5BQ1RJVkVfQkFDS0dST1VORCwgVElUTEVfQkFSX0JPUkRFUiwgV09SS0JFTkNIX0JBQ0tHUk9VTkQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2luZG93cywgaXNMaW51eCwgaXNXZWIsIGlzTmF0aXZlLCBwbGF0Zm9ybUxvY2FsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgRXZlbnRUeXBlLCBFdmVudEhlbHBlciwgRGltZW5zaW9uLCBhcHBlbmQsICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgcHJlcGVuZCwgcmVzZXQsIGdldFdpbmRvdywgZ2V0V2luZG93SWQsIGlzQW5jZXN0b3IsIGdldEFjdGl2ZURvY3VtZW50LCBpc0hUTUxFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBDdXN0b21NZW51YmFyQ29udHJvbCB9IGZyb20gJy4vbWVudWJhckNvbnRyb2wuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBQYXJ0cywgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIEFjdGl2aXR5QmFyUG9zaXRpb24sIExheW91dFNldHRpbmdzLCBFZGl0b3JBY3Rpb25zTG9jYXRpb24sIEVkaXRvclRhYnNNb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVBY3Rpb25WaWV3SXRlbSwgZmlsbEluQWN0aW9uQmFyQWN0aW9ucyBhcyBmaWxsSW5BY3Rpb25CYXJBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIElNZW51LCBJTWVudVNlcnZpY2UsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IFdpbmRvd1RpdGxlIH0gZnJvbSAnLi93aW5kb3dUaXRsZS5qcyc7XG5pbXBvcnQgeyBDb21tYW5kQ2VudGVyQ29udHJvbCB9IGZyb20gJy4vY29tbWFuZENlbnRlckNvbnRyb2wuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgQUNDT1VOVFNfQUNUSVZJVFlfSUQsIEdMT0JBTF9BQ1RJVklUWV9JRCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9hY3Rpdml0eS5qcyc7XG5pbXBvcnQgeyBBY2NvdW50c0FjdGl2aXR5QWN0aW9uVmlld0l0ZW0sIGlzQWNjb3VudHNBY3Rpb25WaXNpYmxlLCBTaW1wbGVBY2NvdW50QWN0aXZpdHlBY3Rpb25WaWV3SXRlbSwgU2ltcGxlR2xvYmFsQWN0aXZpdHlBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uL2dsb2JhbENvbXBvc2l0ZUJhci5qcyc7XG5pbXBvcnQgeyBIb3ZlclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNDb250YWluZXIsIElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFjdGlvblJ1bm5lciwgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWN0aW9uc09yaWVudGF0aW9uLCBJQWN0aW9uVmlld0l0ZW0sIHByZXBhcmVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgRURJVE9SX0NPUkVfTkFWSUdBVElPTl9DT01NQU5EUyB9IGZyb20gJy4uL2VkaXRvci9lZGl0b3JDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBBbmNob3JBbGlnbm1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4uL2VkaXRvci9lZGl0b3JQYW5lLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ3MuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29tbWFuZHNDb250ZXh0QWN0aW9uUnVubmVyIH0gZnJvbSAnLi4vZWRpdG9yL2VkaXRvclRhYnNDb250cm9sLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb21tYW5kc0NvbnRleHQsIElFZGl0b3JQYXJ0T3B0aW9uc0NoYW5nZUV2ZW50LCBJVG9vbGJhckFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IENvZGVXaW5kb3csIG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IEFDQ09VTlRTX0FDVElWSVRZX1RJTEVfQUNUSU9OLCBHTE9CQUxfQUNUSVZJVFlfVElUTEVfQUNUSU9OIH0gZnJvbSAnLi90aXRsZWJhckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVZpZXcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZ3JpZC9ncmlkLmpzJztcbmltcG9ydCB7IGNyZWF0ZUluc3RhbnRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IElCYXNlQWN0aW9uVmlld0l0ZW1PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZS5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IHNhZmVJbnRsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGF0ZS5qcyc7XG5pbXBvcnQgeyBUaXRsZUJhclZpc2libGVDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJVGl0bGVWYXJpYWJsZSB7XG5cdHJlYWRvbmx5IG5hbWU6IHN0cmluZztcblx0cmVhZG9ubHkgY29udGV4dEtleTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUaXRsZVByb3BlcnRpZXMge1xuXHRpc1B1cmU/OiBib29sZWFuO1xuXHRpc0FkbWluPzogYm9vbGVhbjtcblx0cHJlZml4Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUaXRsZWJhclBhcnQgZXh0ZW5kcyBJRGlzcG9zYWJsZSB7XG5cblx0LyoqXG5cdCAqIEFuIGV2ZW50IHdoZW4gdGhlIG1lbnViYXIgdmlzaWJpbGl0eSBjaGFuZ2VzLlxuXHQgKi9cblx0cmVhZG9ubHkgb25NZW51YmFyVmlzaWJpbGl0eUNoYW5nZTogRXZlbnQ8Ym9vbGVhbj47XG5cblx0LyoqXG5cdCAqIFVwZGF0ZSBzb21lIGVudmlyb25tZW50YWwgdGl0bGUgcHJvcGVydGllcy5cblx0ICovXG5cdHVwZGF0ZVByb3BlcnRpZXMocHJvcGVydGllczogSVRpdGxlUHJvcGVydGllcyk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEFkZHMgdmFyaWFibGVzIHRvIGJlIHN1cHBvcnRlZCBpbiB0aGUgd2luZG93IHRpdGxlLlxuXHQgKi9cblx0cmVnaXN0ZXJWYXJpYWJsZXModmFyaWFibGVzOiBJVGl0bGVWYXJpYWJsZVtdKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIEJyb3dzZXJUaXRsZVNlcnZpY2UgZXh0ZW5kcyBNdWx0aVdpbmRvd1BhcnRzPEJyb3dzZXJUaXRsZWJhclBhcnQ+IGltcGxlbWVudHMgSVRpdGxlU2VydmljZSB7XG5cblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cmVhZG9ubHkgbWFpblBhcnQ6IEJyb3dzZXJUaXRsZWJhclBhcnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCd3b3JrYmVuY2gudGl0bGVTZXJ2aWNlJywgdGhlbWVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cblx0XHR0aGlzLm1haW5QYXJ0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5jcmVhdGVNYWluVGl0bGViYXJQYXJ0KCkpO1xuXHRcdHRoaXMub25NZW51YmFyVmlzaWJpbGl0eUNoYW5nZSA9IHRoaXMubWFpblBhcnQub25NZW51YmFyVmlzaWJpbGl0eUNoYW5nZTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlZ2lzdGVyUGFydCh0aGlzLm1haW5QYXJ0KSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyQWN0aW9ucygpO1xuXHRcdHRoaXMucmVnaXN0ZXJBUElDb21tYW5kcygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZU1haW5UaXRsZWJhclBhcnQoKTogQnJvd3NlclRpdGxlYmFyUGFydCB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFpbkJyb3dzZXJUaXRsZWJhclBhcnQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckFjdGlvbnMoKTogdm9pZCB7XG5cblx0XHQvLyBGb2N1cyBhY3Rpb25cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgRm9jdXNUaXRsZUJhciBleHRlbmRzIEFjdGlvbjIge1xuXG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbi5mb2N1c1RpdGxlQmFyYCxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdmb2N1c1RpdGxlQmFyJywgJ0ZvY3VzIFRpdGxlIEJhcicpLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdFx0cHJlY29uZGl0aW9uOiBUaXRsZUJhclZpc2libGVDb250ZXh0XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRydW4oKTogdm9pZCB7XG5cdFx0XHRcdHRoYXQuZ2V0UGFydEJ5RG9jdW1lbnQoZ2V0QWN0aXZlRG9jdW1lbnQoKSk/LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckFQSUNvbW1hbmRzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0XHRcdGlkOiAncmVnaXN0ZXJXaW5kb3dUaXRsZVZhcmlhYmxlJyxcblx0XHRcdGhhbmRsZXI6IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgbmFtZTogc3RyaW5nLCBjb250ZXh0S2V5OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0dGhpcy5yZWdpc3RlclZhcmlhYmxlcyhbeyBuYW1lLCBjb250ZXh0S2V5IH1dKTtcblx0XHRcdH0sXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ1JlZ2lzdGVycyBhIG5ldyB0aXRsZSB2YXJpYWJsZScsXG5cdFx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0XHR7IG5hbWU6ICduYW1lJywgc2NoZW1hOiB7IHR5cGU6ICdzdHJpbmcnIH0sIGRlc2NyaXB0aW9uOiAnVGhlIG5hbWUgb2YgdGhlIHZhcmlhYmxlIHRvIHJlZ2lzdGVyJyB9LFxuXHRcdFx0XHRcdHsgbmFtZTogJ2NvbnRleHRLZXknLCBzY2hlbWE6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246ICdUaGUgY29udGV4dCBrZXkgdG8gdXNlIGZvciB0aGUgdmFsdWUgb2YgdGhlIHZhcmlhYmxlJyB9XG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQvLyNyZWdpb24gQXV4aWxpYXJ5IFRpdGxlYmFyIFBhcnRzXG5cblx0Y3JlYXRlQXV4aWxpYXJ5VGl0bGViYXJQYXJ0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGVkaXRvckdyb3Vwc0NvbnRhaW5lcjogSUVkaXRvckdyb3Vwc0NvbnRhaW5lcik6IElBdXhpbGlhcnlUaXRsZWJhclBhcnQge1xuXHRcdGNvbnN0IHRpdGxlYmFyUGFydENvbnRhaW5lciA9ICQoJy5wYXJ0LnRpdGxlYmFyJywgeyByb2xlOiAnbm9uZScgfSk7XG5cdFx0dGl0bGViYXJQYXJ0Q29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcblx0XHRjb250YWluZXIuaW5zZXJ0QmVmb3JlKHRpdGxlYmFyUGFydENvbnRhaW5lciwgY29udGFpbmVyLmZpcnN0Q2hpbGQpOyAvLyBlbnN1cmUgd2UgYXJlIGZpcnN0IGVsZW1lbnRcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y29uc3QgdGl0bGViYXJQYXJ0ID0gdGhpcy5kb0NyZWF0ZUF1eGlsaWFyeVRpdGxlYmFyUGFydCh0aXRsZWJhclBhcnRDb250YWluZXIsIGVkaXRvckdyb3Vwc0NvbnRhaW5lcik7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMucmVnaXN0ZXJQYXJ0KHRpdGxlYmFyUGFydCkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKEV2ZW50LnJ1bkFuZFN1YnNjcmliZSh0aXRsZWJhclBhcnQub25EaWRDaGFuZ2UsICgpID0+IHRpdGxlYmFyUGFydENvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0aXRsZWJhclBhcnQuaGVpZ2h0fXB4YCkpO1xuXHRcdHRpdGxlYmFyUGFydC5jcmVhdGUodGl0bGViYXJQYXJ0Q29udGFpbmVyKTtcblxuXHRcdGlmICh0aGlzLnByb3BlcnRpZXMpIHtcblx0XHRcdHRpdGxlYmFyUGFydC51cGRhdGVQcm9wZXJ0aWVzKHRoaXMucHJvcGVydGllcyk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudmFyaWFibGVzLnNpemUpIHtcblx0XHRcdHRpdGxlYmFyUGFydC5yZWdpc3RlclZhcmlhYmxlcyhBcnJheS5mcm9tKHRoaXMudmFyaWFibGVzLnZhbHVlcygpKSk7XG5cdFx0fVxuXG5cdFx0RXZlbnQub25jZSh0aXRsZWJhclBhcnQub25XaWxsRGlzcG9zZSkoKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpKTtcblxuXHRcdHJldHVybiB0aXRsZWJhclBhcnQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZG9DcmVhdGVBdXhpbGlhcnlUaXRsZWJhclBhcnQoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZWRpdG9yR3JvdXBzQ29udGFpbmVyOiBJRWRpdG9yR3JvdXBzQ29udGFpbmVyKTogQnJvd3NlclRpdGxlYmFyUGFydCAmIElBdXhpbGlhcnlUaXRsZWJhclBhcnQge1xuXHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEF1eGlsaWFyeUJyb3dzZXJUaXRsZWJhclBhcnQsIGNvbnRhaW5lciwgZWRpdG9yR3JvdXBzQ29udGFpbmVyLCB0aGlzLm1haW5QYXJ0KTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cblx0Ly8jcmVnaW9uIFNlcnZpY2UgSW1wbGVtZW50YXRpb25cblxuXHRyZWFkb25seSBvbk1lbnViYXJWaXNpYmlsaXR5Q2hhbmdlOiBFdmVudDxib29sZWFuPjtcblxuXHRwcml2YXRlIHByb3BlcnRpZXM6IElUaXRsZVByb3BlcnRpZXMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0dXBkYXRlUHJvcGVydGllcyhwcm9wZXJ0aWVzOiBJVGl0bGVQcm9wZXJ0aWVzKTogdm9pZCB7XG5cdFx0dGhpcy5wcm9wZXJ0aWVzID0gcHJvcGVydGllcztcblxuXHRcdGZvciAoY29uc3QgcGFydCBvZiB0aGlzLnBhcnRzKSB7XG5cdFx0XHRwYXJ0LnVwZGF0ZVByb3BlcnRpZXMocHJvcGVydGllcyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSB2YXJpYWJsZXMgPSBuZXcgTWFwPHN0cmluZywgSVRpdGxlVmFyaWFibGU+KCk7XG5cblx0cmVnaXN0ZXJWYXJpYWJsZXModmFyaWFibGVzOiBJVGl0bGVWYXJpYWJsZVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV3VmFyaWFibGVzOiBJVGl0bGVWYXJpYWJsZVtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IHZhcmlhYmxlIG9mIHZhcmlhYmxlcykge1xuXHRcdFx0aWYgKCF0aGlzLnZhcmlhYmxlcy5oYXModmFyaWFibGUubmFtZSkpIHtcblx0XHRcdFx0dGhpcy52YXJpYWJsZXMuc2V0KHZhcmlhYmxlLm5hbWUsIHZhcmlhYmxlKTtcblx0XHRcdFx0bmV3VmFyaWFibGVzLnB1c2godmFyaWFibGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgcGFydCBvZiB0aGlzLnBhcnRzKSB7XG5cdFx0XHRwYXJ0LnJlZ2lzdGVyVmFyaWFibGVzKG5ld1ZhcmlhYmxlcyk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG59XG5cbmV4cG9ydCBjbGFzcyBCcm93c2VyVGl0bGViYXJQYXJ0IGV4dGVuZHMgUGFydCBpbXBsZW1lbnRzIElUaXRsZWJhclBhcnQge1xuXG5cdC8vI3JlZ2lvbiBJVmlld1xuXG5cdHJlYWRvbmx5IG1pbmltdW1XaWR0aDogbnVtYmVyID0gMDtcblx0cmVhZG9ubHkgbWF4aW11bVdpZHRoOiBudW1iZXIgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cblx0Z2V0IG1pbmltdW1IZWlnaHQoKTogbnVtYmVyIHtcblx0XHRjb25zdCB3Y29FbmFibGVkID0gaXNXZWIgJiYgaXNXQ09FbmFibGVkKCk7XG5cdFx0bGV0IHZhbHVlID0gdGhpcy5pc0NvbW1hbmRDZW50ZXJWaXNpYmxlIHx8IHdjb0VuYWJsZWQgPyBERUZBVUxUX0NVU1RPTV9USVRMRUJBUl9IRUlHSFQgOiAzMDtcblx0XHRpZiAod2NvRW5hYmxlZCkge1xuXHRcdFx0dmFsdWUgPSBNYXRoLm1heCh2YWx1ZSwgZ2V0V0NPVGl0bGViYXJBcmVhUmVjdChnZXRXaW5kb3codGhpcy5lbGVtZW50KSk/LmhlaWdodCA/PyAwKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdmFsdWUgLyAodGhpcy5wcmV2ZW50Wm9vbSA/IGdldFpvb21GYWN0b3IoZ2V0V2luZG93KHRoaXMuZWxlbWVudCkpIDogMSk7XG5cdH1cblxuXHRnZXQgbWF4aW11bUhlaWdodCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5taW5pbXVtSGVpZ2h0OyB9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEV2ZW50c1xuXG5cdHByaXZhdGUgX29uTWVudWJhclZpc2liaWxpdHlDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cmVhZG9ubHkgb25NZW51YmFyVmlzaWJpbGl0eUNoYW5nZSA9IHRoaXMuX29uTWVudWJhclZpc2liaWxpdHlDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxEaXNwb3NlID0gdGhpcy5fb25XaWxsRGlzcG9zZS5ldmVudDtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcm90ZWN0ZWQgcm9vdENvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgd2luZG93Q29udHJvbHNDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdHByb3RlY3RlZCBkcmFnUmVnaW9uOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB0aXRsZSE6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgbGVmdENvbnRlbnQhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBjZW50ZXJDb250ZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmlnaHRDb250ZW50ITogSFRNTEVsZW1lbnQ7XG5cblx0cHJvdGVjdGVkIGN1c3RvbU1lbnViYXI6IEN1c3RvbU1lbnViYXJDb250cm9sIHwgdW5kZWZpbmVkO1xuXHRwcm90ZWN0ZWQgYXBwSWNvbjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYXBwSWNvbkJhZGdlOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIG1lbnViYXI/OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBsYXN0TGF5b3V0RGltZW5zaW9uczogRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgYWN0aW9uVG9vbEJhciE6IFdvcmtiZW5jaFRvb2xCYXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0aW9uVG9vbEJhckRpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvckFjdGlvbnNDaGFuZ2VEaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBhY3Rpb25Ub29sQmFyRWxlbWVudCE6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgZ2xvYmFsVG9vbGJhck1lbnU6IElNZW51O1xuXHRwcml2YXRlIGhhc0dsb2JhbFRvb2xiYXJFbnRyaWVzID0gZmFsc2U7XG5cdHByaXZhdGUgbGF5b3V0VG9vbGJhck1lbnU6IElNZW51IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZ2xvYmFsVG9vbGJhck1lbnVEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yVG9vbGJhck1lbnVEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgbGF5b3V0VG9vbGJhck1lbnVEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0aXZpdHlUb29sYmFyRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGU7XG5cblx0cHJpdmF0ZSByZWFkb25seSB0aXRsZURpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSB0aXRsZUJhclN0eWxlOiBUaXRsZWJhclN0eWxlO1xuXG5cdHByaXZhdGUgaXNJbmFjdGl2ZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IGlzQXV4aWxpYXJ5OiBib29sZWFuO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgd2luZG93VGl0bGU6IFdpbmRvd1RpdGxlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBzQ29udGFpbmVyOiBJRWRpdG9yR3JvdXBzQ29udGFpbmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0dGFyZ2V0V2luZG93OiBDb2RlV2luZG93LFxuXHRcdGVkaXRvckdyb3Vwc0NvbnRhaW5lcjogSUVkaXRvckdyb3Vwc0NvbnRhaW5lciB8ICdtYWluJyxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoaWQsIHsgaGFzVGl0bGU6IGZhbHNlIH0sIHRoZW1lU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIGxheW91dFNlcnZpY2UpO1xuXG5cdFx0dGhpcy50aXRsZUJhclN0eWxlID0gZ2V0VGl0bGVCYXJTdHlsZSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR0aGlzLmdsb2JhbFRvb2xiYXJNZW51ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5tZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5UaXRsZUJhciwgdGhpcy5jb250ZXh0S2V5U2VydmljZSkpO1xuXG5cdFx0dGhpcy5pc0F1eGlsaWFyeSA9IGVkaXRvckdyb3Vwc0NvbnRhaW5lciAhPT0gJ21haW4nO1xuXHRcdHRoaXMuZWRpdG9yU2VydmljZSA9IGVkaXRvclNlcnZpY2UuY3JlYXRlU2NvcGVkKGVkaXRvckdyb3Vwc0NvbnRhaW5lciwgdGhpcy5fc3RvcmUpO1xuXHRcdHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyID0gZWRpdG9yR3JvdXBzQ29udGFpbmVyID09PSAnbWFpbicgPyBlZGl0b3JHcm91cFNlcnZpY2UubWFpblBhcnQgOiBlZGl0b3JHcm91cHNDb250YWluZXI7XG5cblx0XHR0aGlzLndpbmRvd1RpdGxlID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV2luZG93VGl0bGUsIHRhcmdldFdpbmRvdywgZWRpdG9yR3JvdXBzQ29udGFpbmVyKSk7XG5cblx0XHR0aGlzLmhvdmVyRGVsZWdhdGUgPSB0aGlzLl9yZWdpc3RlcihjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSgpKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoZ2V0V2luZG93SWQodGFyZ2V0V2luZG93KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKHRhcmdldFdpbmRvd0lkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvc3RTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9jdXMoZm9jdXNlZCA9PiBmb2N1c2VkID8gdGhpcy5vbkZvY3VzKCkgOiB0aGlzLm9uQmx1cigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ob3N0U2VydmljZS5vbkRpZENoYW5nZUFjdGl2ZVdpbmRvdyh3aW5kb3dJZCA9PiB3aW5kb3dJZCA9PT0gdGFyZ2V0V2luZG93SWQgPyB0aGlzLm9uRm9jdXMoKSA6IHRoaXMub25CbHVyKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHRoaXMub25Db25maWd1cmF0aW9uQ2hhbmdlZChlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm9uRGlkQ2hhbmdlRWRpdG9yUGFydE9wdGlvbnMoZSA9PiB0aGlzLm9uRWRpdG9yUGFydENvbmZpZ3VyYXRpb25DaGFuZ2UoZSkpKTtcblx0fVxuXG5cdHByaXZhdGUgb25CbHVyKCk6IHZvaWQge1xuXHRcdHRoaXMuaXNJbmFjdGl2ZSA9IHRydWU7XG5cblx0XHR0aGlzLnVwZGF0ZVN0eWxlcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuaXNJbmFjdGl2ZSA9IGZhbHNlO1xuXG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgb25FZGl0b3JQYXJ0Q29uZmlndXJhdGlvbkNoYW5nZSh7IG9sZFBhcnRPcHRpb25zLCBuZXdQYXJ0T3B0aW9ucyB9OiBJRWRpdG9yUGFydE9wdGlvbnNDaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdGlmIChcblx0XHRcdG9sZFBhcnRPcHRpb25zLmVkaXRvckFjdGlvbnNMb2NhdGlvbiAhPT0gbmV3UGFydE9wdGlvbnMuZWRpdG9yQWN0aW9uc0xvY2F0aW9uIHx8XG5cdFx0XHRvbGRQYXJ0T3B0aW9ucy5zaG93VGFicyAhPT0gbmV3UGFydE9wdGlvbnMuc2hvd1RhYnNcblx0XHQpIHtcblx0XHRcdGlmIChoYXNDdXN0b21UaXRsZWJhcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLnRpdGxlQmFyU3R5bGUpICYmIHRoaXMuYWN0aW9uVG9vbEJhcikge1xuXHRcdFx0XHR0aGlzLmNyZWF0ZUFjdGlvblRvb2xCYXIoKTtcblx0XHRcdFx0dGhpcy5jcmVhdGVBY3Rpb25Ub29sQmFyTWVudXMoeyBlZGl0b3JBY3Rpb25zOiB0cnVlIH0pO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG9uQ29uZmlndXJhdGlvbkNoYW5nZWQoZXZlbnQ6IElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblxuXHRcdC8vIEN1c3RvbSBtZW51IGJhciAoZGlzYWJsZWQgaWYgYXV4aWxpYXJ5KVxuXHRcdGlmICghdGhpcy5pc0F1eGlsaWFyeSAmJiAhaGFzTmF0aXZlVGl0bGViYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy50aXRsZUJhclN0eWxlKSAmJiAoIWlzTWFjaW50b3NoIHx8IGlzV2ViKSkge1xuXHRcdFx0aWYgKGV2ZW50LmFmZmVjdHNDb25maWd1cmF0aW9uKCd3aW5kb3cubWVudUJhclZpc2liaWxpdHknKSkge1xuXHRcdFx0XHRpZiAodGhpcy5jdXJyZW50TWVudWJhclZpc2liaWxpdHkgPT09ICdjb21wYWN0Jykge1xuXHRcdFx0XHRcdHRoaXMudW5pbnN0YWxsTWVudWJhcigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuaW5zdGFsbE1lbnViYXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFjdGlvbnNcblx0XHRpZiAoaGFzQ3VzdG9tVGl0bGViYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy50aXRsZUJhclN0eWxlKSAmJiB0aGlzLmFjdGlvblRvb2xCYXIpIHtcblx0XHRcdGNvbnN0IGFmZmVjdHNMYXlvdXRDb250cm9sID0gZXZlbnQuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTGF5b3V0U2V0dGluZ3MuTEFZT1VUX0FDVElPTlMpO1xuXHRcdFx0Y29uc3QgYWZmZWN0c0FjdGl2aXR5Q29udHJvbCA9IGV2ZW50LmFmZmVjdHNDb25maWd1cmF0aW9uKExheW91dFNldHRpbmdzLkFDVElWSVRZX0JBUl9MT0NBVElPTik7XG5cblx0XHRcdGlmIChhZmZlY3RzTGF5b3V0Q29udHJvbCB8fCBhZmZlY3RzQWN0aXZpdHlDb250cm9sKSB7XG5cdFx0XHRcdHRoaXMuY3JlYXRlQWN0aW9uVG9vbEJhck1lbnVzKHsgbGF5b3V0QWN0aW9uczogYWZmZWN0c0xheW91dENvbnRyb2wsIGFjdGl2aXR5QWN0aW9uczogYWZmZWN0c0FjdGl2aXR5Q29udHJvbCB9KTtcblxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ29tbWFuZCBDZW50ZXJcblx0XHRpZiAoZXZlbnQuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTGF5b3V0U2V0dGluZ3MuQ09NTUFORF9DRU5URVIpKSB7XG5cdFx0XHR0aGlzLmNyZWF0ZVRpdGxlKCk7XG5cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgaW5zdGFsbE1lbnViYXIoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubWVudWJhcikge1xuXHRcdFx0cmV0dXJuOyAvLyBJZiB0aGUgbWVudWJhciBpcyBhbHJlYWR5IGluc3RhbGxlZCwgc2tpcFxuXHRcdH1cblxuXHRcdHRoaXMuY3VzdG9tTWVudWJhciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ3VzdG9tTWVudWJhckNvbnRyb2wpKTtcblxuXHRcdHRoaXMubWVudWJhciA9IGFwcGVuZCh0aGlzLmxlZnRDb250ZW50LCAkKCdkaXYubWVudWJhcicpKTtcblx0XHR0aGlzLm1lbnViYXIuc2V0QXR0cmlidXRlKCdyb2xlJywgJ21lbnViYXInKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3VzdG9tTWVudWJhci5vblZpc2liaWxpdHlDaGFuZ2UoZSA9PiB0aGlzLm9uTWVudWJhclZpc2liaWxpdHlDaGFuZ2VkKGUpKSk7XG5cblx0XHR0aGlzLmN1c3RvbU1lbnViYXIuY3JlYXRlKHRoaXMubWVudWJhcik7XG5cdH1cblxuXHRwcml2YXRlIHVuaW5zdGFsbE1lbnViYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5jdXN0b21NZW51YmFyPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5jdXN0b21NZW51YmFyID0gdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5tZW51YmFyPy5yZW1vdmUoKTtcblx0XHR0aGlzLm1lbnViYXIgPSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLm9uTWVudWJhclZpc2liaWxpdHlDaGFuZ2VkKGZhbHNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvbk1lbnViYXJWaXNpYmlsaXR5Q2hhbmdlZCh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKGlzV2ViIHx8IGlzV2luZG93cyB8fCBpc0xpbnV4KSB7XG5cdFx0XHRpZiAodGhpcy5sYXN0TGF5b3V0RGltZW5zaW9ucykge1xuXHRcdFx0XHR0aGlzLmxheW91dCh0aGlzLmxhc3RMYXlvdXREaW1lbnNpb25zLndpZHRoLCB0aGlzLmxhc3RMYXlvdXREaW1lbnNpb25zLmhlaWdodCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX29uTWVudWJhclZpc2liaWxpdHlDaGFuZ2UuZmlyZSh2aXNpYmxlKTtcblx0XHR9XG5cdH1cblxuXHR1cGRhdGVQcm9wZXJ0aWVzKHByb3BlcnRpZXM6IElUaXRsZVByb3BlcnRpZXMpOiB2b2lkIHtcblx0XHR0aGlzLndpbmRvd1RpdGxlLnVwZGF0ZVByb3BlcnRpZXMocHJvcGVydGllcyk7XG5cdH1cblxuXHRyZWdpc3RlclZhcmlhYmxlcyh2YXJpYWJsZXM6IElUaXRsZVZhcmlhYmxlW10pOiB2b2lkIHtcblx0XHR0aGlzLndpbmRvd1RpdGxlLnJlZ2lzdGVyVmFyaWFibGVzKHZhcmlhYmxlcyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlQ29udGVudEFyZWEocGFyZW50OiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcblx0XHR0aGlzLmVsZW1lbnQgPSBwYXJlbnQ7XG5cdFx0dGhpcy5yb290Q29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLnRpdGxlYmFyLWNvbnRhaW5lcicpKTtcblxuXHRcdHRoaXMubGVmdENvbnRlbnQgPSBhcHBlbmQodGhpcy5yb290Q29udGFpbmVyLCAkKCcudGl0bGViYXItbGVmdCcpKTtcblx0XHR0aGlzLmNlbnRlckNvbnRlbnQgPSBhcHBlbmQodGhpcy5yb290Q29udGFpbmVyLCAkKCcudGl0bGViYXItY2VudGVyJykpO1xuXHRcdHRoaXMucmlnaHRDb250ZW50ID0gYXBwZW5kKHRoaXMucm9vdENvbnRhaW5lciwgJCgnLnRpdGxlYmFyLXJpZ2h0JykpO1xuXG5cdFx0Ly8gQXBwIEljb24gKFdpbmRvd3MsIExpbnV4KVxuXHRcdGlmICgoaXNXaW5kb3dzIHx8IGlzTGludXgpICYmICFoYXNOYXRpdmVUaXRsZWJhcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLnRpdGxlQmFyU3R5bGUpKSB7XG5cdFx0XHR0aGlzLmFwcEljb24gPSBwcmVwZW5kKHRoaXMubGVmdENvbnRlbnQsICQoJ2Eud2luZG93LWFwcGljb24nKSk7XG5cdFx0fVxuXG5cdFx0Ly8gRHJhZ2dhYmxlIHJlZ2lvbiB0aGF0IHdlIGNhbiBtYW5pcHVsYXRlIGZvciAjNTI1MjJcblx0XHR0aGlzLmRyYWdSZWdpb24gPSBwcmVwZW5kKHRoaXMucm9vdENvbnRhaW5lciwgJCgnZGl2LnRpdGxlYmFyLWRyYWctcmVnaW9uJykpO1xuXG5cdFx0Ly8gTWVudWJhcjogaW5zdGFsbCBhIGN1c3RvbSBtZW51IGJhciBkZXBlbmRpbmcgb24gY29uZmlndXJhdGlvblxuXHRcdGlmIChcblx0XHRcdCF0aGlzLmlzQXV4aWxpYXJ5ICYmXG5cdFx0XHQhaGFzTmF0aXZlVGl0bGViYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy50aXRsZUJhclN0eWxlKSAmJlxuXHRcdFx0KCFpc01hY2ludG9zaCB8fCBpc1dlYikgJiZcblx0XHRcdHRoaXMuY3VycmVudE1lbnViYXJWaXNpYmlsaXR5ICE9PSAnY29tcGFjdCdcblx0XHQpIHtcblx0XHRcdHRoaXMuaW5zdGFsbE1lbnViYXIoKTtcblx0XHR9XG5cblx0XHQvLyBUaXRsZVxuXHRcdHRoaXMudGl0bGUgPSBhcHBlbmQodGhpcy5jZW50ZXJDb250ZW50LCAkKCdkaXYud2luZG93LXRpdGxlJykpO1xuXHRcdHRoaXMuY3JlYXRlVGl0bGUoKTtcblxuXHRcdC8vIENyZWF0ZSBUb29sYmFyIEFjdGlvbnNcblx0XHRpZiAoaGFzQ3VzdG9tVGl0bGViYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy50aXRsZUJhclN0eWxlKSkge1xuXHRcdFx0dGhpcy5hY3Rpb25Ub29sQmFyRWxlbWVudCA9IGFwcGVuZCh0aGlzLnJpZ2h0Q29udGVudCwgJCgnZGl2LmFjdGlvbi10b29sYmFyLWNvbnRhaW5lcicpKTtcblx0XHRcdHRoaXMuY3JlYXRlQWN0aW9uVG9vbEJhcigpO1xuXHRcdFx0dGhpcy5jcmVhdGVBY3Rpb25Ub29sQmFyTWVudXMoKTtcblx0XHR9XG5cblx0XHQvLyBXaW5kb3cgQ29udHJvbHMgQ29udGFpbmVyXG5cdFx0aWYgKCFoYXNOYXRpdmVUaXRsZWJhcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLnRpdGxlQmFyU3R5bGUpKSB7XG5cdFx0XHRsZXQgcHJpbWFyeVdpbmRvd0NvbnRyb2xzTG9jYXRpb24gPSBpc01hY2ludG9zaCA/ICdsZWZ0JyA6ICdyaWdodCc7XG5cdFx0XHRpZiAoaXNNYWNpbnRvc2ggJiYgaXNOYXRpdmUpIHtcblxuXHRcdFx0XHQvLyBDaGVjayBpZiB0aGUgbG9jYWxlIGlzIFJUTCwgbWFjT1Mgd2lsbCBtb3ZlIHRyYWZmaWMgbGlnaHRzIGluIFJUTCBsb2NhbGVzXG5cdFx0XHRcdC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0ludGwvTG9jYWxlL3RleHRJbmZvXG5cblx0XHRcdFx0Y29uc3QgbG9jYWxlSW5mbyA9IHNhZmVJbnRsLkxvY2FsZShwbGF0Zm9ybUxvY2FsZSkgYXMgYW55O1xuXHRcdFx0XHRpZiAobG9jYWxlSW5mbz8udGV4dEluZm8/LmRpcmVjdGlvbiA9PT0gJ3J0bCcpIHtcblx0XHRcdFx0XHRwcmltYXJ5V2luZG93Q29udHJvbHNMb2NhdGlvbiA9ICdyaWdodCc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGlzTWFjaW50b3NoICYmIGlzTmF0aXZlICYmIHByaW1hcnlXaW5kb3dDb250cm9sc0xvY2F0aW9uID09PSAnbGVmdCcpIHtcblx0XHRcdFx0Ly8gbWFjT1MgbmF0aXZlOiBjb250cm9scyBhcmUgb24gdGhlIGxlZnQgYW5kIHRoZSBjb250YWluZXIgaXMgbm90IG5lZWRlZCB0byBtYWtlIHJvb21cblx0XHRcdFx0Ly8gZm9yIHNvbWV0aGluZywgZXhjZXB0IGZvciB3ZWIgd2hlcmUgYSBjdXN0b20gbWVudSBiZWluZyBzdXBwb3J0ZWQpLiBub3QgcHV0dGluZyB0aGVcblx0XHRcdFx0Ly8gY29udGFpbmVyIGhlbHBzIHdpdGggYWxsb3dpbmcgdG8gbW92ZSB0aGUgd2luZG93IHdoZW4gY2xpY2tpbmcgdmVyeSBjbG9zZSB0byB0aGVcblx0XHRcdFx0Ly8gd2luZG93IGNvbnRyb2wgYnV0dG9ucy5cblx0XHRcdH0gZWxzZSBpZiAoZ2V0V2luZG93Q29udHJvbHNTdHlsZSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSA9PT0gV2luZG93Q29udHJvbHNTdHlsZS5ISURERU4pIHtcblx0XHRcdFx0Ly8gTGludXgvV2luZG93czogY29udHJvbHMgYXJlIGV4cGxpY2l0bHkgZGlzYWJsZWRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMud2luZG93Q29udHJvbHNDb250YWluZXIgPSBhcHBlbmQocHJpbWFyeVdpbmRvd0NvbnRyb2xzTG9jYXRpb24gPT09ICdsZWZ0JyA/IHRoaXMubGVmdENvbnRlbnQgOiB0aGlzLnJpZ2h0Q29udGVudCwgJCgnZGl2LndpbmRvdy1jb250cm9scy1jb250YWluZXInKSk7XG5cdFx0XHRcdGlmIChpc1dlYikge1xuXHRcdFx0XHRcdC8vIFdlYjogaXRzIHBvc3NpYmxlIHRvIGhhdmUgY29udHJvbCBvdmVybGF5cyBvbiBib3RoIHNpZGVzLCBmb3IgZXhhbXBsZSBvbiBtYWNPU1xuXHRcdFx0XHRcdC8vIHdpdGggd2luZG93IGNvbnRyb2xzIG9uIHRoZSBsZWZ0IGFuZCBQV0EgY29udHJvbHMgb24gdGhlIHJpZ2h0LlxuXHRcdFx0XHRcdGFwcGVuZChwcmltYXJ5V2luZG93Q29udHJvbHNMb2NhdGlvbiA9PT0gJ2xlZnQnID8gdGhpcy5yaWdodENvbnRlbnQgOiB0aGlzLmxlZnRDb250ZW50LCAkKCdkaXYud2luZG93LWNvbnRyb2xzLWNvbnRhaW5lcicpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpc1dDT0VuYWJsZWQoKSkge1xuXHRcdFx0XHRcdHRoaXMud2luZG93Q29udHJvbHNDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnd2NvLWVuYWJsZWQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENvbnRleHQgbWVudSBvdmVyIHRpdGxlIGJhcjogZGVwZW5kaW5nIG9uIHRoZSBPUyBhbmQgdGhlIGxvY2F0aW9uIG9mIHRoZSBjbGljayB0aGlzIHdpbGwgZWl0aGVyIGJlXG5cdFx0Ly8gdGhlIG92ZXJhbGwgY29udGV4dCBtZW51IGZvciB0aGUgZW50aXJlIHRpdGxlIGJhciBvciBhIHNwZWNpZmljIHRpdGxlIGNvbnRleHQgbWVudS5cblx0XHQvLyBXaW5kb3dzIC8gTGludXg6IHdlIG9ubHkgc3VwcG9ydCB0aGUgb3ZlcmFsbCBjb250ZXh0IG1lbnUgb24gdGhlIHRpdGxlIGJhclxuXHRcdC8vIG1hY09TOiB3ZSBzdXBwb3J0IGJvdGggdGhlIG92ZXJhbGwgY29udGV4dCBtZW51IGFuZCB0aGUgdGl0bGUgY29udGV4dCBtZW51LlxuXHRcdC8vICAgICAgICBpbiBhZGRpdGlvbiwgd2UgYWxsb3cgQ21kK2NsaWNrIHRvIGJyaW5nIHVwIHRoZSB0aXRsZSBjb250ZXh0IG1lbnUuXG5cdFx0e1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMucm9vdENvbnRhaW5lciwgRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgZSA9PiB7XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSk7XG5cblx0XHRcdFx0bGV0IHRhcmdldE1lbnU6IE1lbnVJZDtcblx0XHRcdFx0aWYgKGlzTWFjaW50b3NoICYmIGlzSFRNTEVsZW1lbnQoZS50YXJnZXQpICYmIGlzQW5jZXN0b3IoZS50YXJnZXQsIHRoaXMudGl0bGUpKSB7XG5cdFx0XHRcdFx0dGFyZ2V0TWVudSA9IE1lbnVJZC5UaXRsZUJhclRpdGxlQ29udGV4dDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0YXJnZXRNZW51ID0gTWVudUlkLlRpdGxlQmFyQ29udGV4dDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMub25Db250ZXh0TWVudShlLCB0YXJnZXRNZW51KTtcblx0XHRcdH0pKTtcblxuXHRcdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnRpdGxlLCBFdmVudFR5cGUuTU9VU0VfRE9XTiwgZSA9PiB7XG5cdFx0XHRcdFx0aWYgKGUubWV0YUtleSkge1xuXHRcdFx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlIC8qIHN0b3AgYnViYmxpbmcgdG8gcHJldmVudCBjb21tYW5kIGNlbnRlciBmcm9tIG9wZW5pbmcgKi8pO1xuXG5cdFx0XHRcdFx0XHR0aGlzLm9uQ29udGV4dE1lbnUoZSwgTWVudUlkLlRpdGxlQmFyVGl0bGVDb250ZXh0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIHRydWUgLyogY2FwdHVyZSBwaGFzZSB0byBwcmV2ZW50IGNvbW1hbmQgY2VudGVyIGZyb20gb3BlbmluZyAqLykpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlU3R5bGVzKCk7XG5cblx0XHRyZXR1cm4gdGhpcy5lbGVtZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUaXRsZSgpOiB2b2lkIHtcblx0XHR0aGlzLnRpdGxlRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdC8vIFRleHQgVGl0bGVcblx0XHRpZiAoIXRoaXMuaXNDb21tYW5kQ2VudGVyVmlzaWJsZSkge1xuXHRcdFx0dGhpcy50aXRsZS5pbm5lclRleHQgPSB0aGlzLndpbmRvd1RpdGxlLnZhbHVlO1xuXHRcdFx0dGhpcy50aXRsZURpc3Bvc2FibGVzLmFkZCh0aGlzLndpbmRvd1RpdGxlLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdFx0dGhpcy50aXRsZS5pbm5lclRleHQgPSB0aGlzLndpbmRvd1RpdGxlLnZhbHVlO1xuXHRcdFx0XHQvLyBsYXlvdXQgbWVudWJhciBhbmQgb3RoZXIgcmVuZGVyaW5ncyBpbiB0aGUgdGl0bGViYXJcblx0XHRcdFx0aWYgKHRoaXMubGFzdExheW91dERpbWVuc2lvbnMpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUxheW91dCh0aGlzLmxhc3RMYXlvdXREaW1lbnNpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIE1lbnUgVGl0bGVcblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IGNvbW1hbmRDZW50ZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbW1hbmRDZW50ZXJDb250cm9sLCB0aGlzLndpbmRvd1RpdGxlLCB0aGlzLmhvdmVyRGVsZWdhdGUpO1xuXHRcdFx0cmVzZXQodGhpcy50aXRsZSwgY29tbWFuZENlbnRlci5lbGVtZW50KTtcblx0XHRcdHRoaXMudGl0bGVEaXNwb3NhYmxlcy5hZGQoY29tbWFuZENlbnRlcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhY3Rpb25WaWV3SXRlbVByb3ZpZGVyKGFjdGlvbjogSUFjdGlvbiwgb3B0aW9uczogSUJhc2VBY3Rpb25WaWV3SXRlbU9wdGlvbnMpOiBJQWN0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQge1xuXG5cdFx0Ly8gLS0tIEFjdGl2aXR5IEFjdGlvbnNcblx0XHRpZiAoIXRoaXMuaXNBdXhpbGlhcnkpIHtcblx0XHRcdGlmIChhY3Rpb24uaWQgPT09IEdMT0JBTF9BQ1RJVklUWV9JRCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTaW1wbGVHbG9iYWxBY3Rpdml0eUFjdGlvblZpZXdJdGVtLCB7IHBvc2l0aW9uOiAoKSA9PiBIb3ZlclBvc2l0aW9uLkJFTE9XIH0sIG9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gQUNDT1VOVFNfQUNUSVZJVFlfSUQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2ltcGxlQWNjb3VudEFjdGl2aXR5QWN0aW9uVmlld0l0ZW0sIHsgcG9zaXRpb246ICgpID0+IEhvdmVyUG9zaXRpb24uQkVMT1cgfSwgb3B0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gLS0tIEVkaXRvciBBY3Rpb25zXG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmFjdGl2ZUdyb3VwPy5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lICYmIGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBFZGl0b3JQYW5lKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhY3RpdmVFZGl0b3JQYW5lLmdldEFjdGlvblZpZXdJdGVtKGFjdGlvbiwgb3B0aW9ucyk7XG5cblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDaGVjayBleHRlbnNpb25zXG5cdFx0cmV0dXJuIGNyZWF0ZUFjdGlvblZpZXdJdGVtKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBtZW51QXNDaGlsZDogZmFsc2UgfSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEtleWJpbmRpbmcoYWN0aW9uOiBJQWN0aW9uKTogUmVzb2x2ZWRLZXliaW5kaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBlZGl0b3JQYW5lQXdhcmVDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmFjdGl2ZUdyb3VwPy5hY3RpdmVFZGl0b3JQYW5lPy5zY29wZWRDb250ZXh0S2V5U2VydmljZSA/PyB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlO1xuXG5cdFx0cmV0dXJuIHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhhY3Rpb24uaWQsIGVkaXRvclBhbmVBd2FyZUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQWN0aW9uVG9vbEJhcigpIHtcblxuXHRcdC8vIENyZWF0ZXMgdGhlIGFjdGlvbiB0b29sIGJhci4gRGVwZW5kcyBvbiB0aGUgY29uZmlndXJhdGlvbiBvZiB0aGUgdGl0bGUgYmFyIG1lbnVzXG5cdFx0Ly8gUmVxdWlyZXMgdG8gYmUgcmVjcmVhdGVkIHdoZW5ldmVyIGVkaXRvciBhY3Rpb25zIGVuYWJsZW1lbnQgY2hhbmdlc1xuXG5cdFx0dGhpcy5hY3Rpb25Ub29sQmFyRGlzcG9zYWJsZS5jbGVhcigpO1xuXG5cdFx0dGhpcy5hY3Rpb25Ub29sQmFyID0gdGhpcy5hY3Rpb25Ub29sQmFyRGlzcG9zYWJsZS5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUb29sQmFyLCB0aGlzLmFjdGlvblRvb2xCYXJFbGVtZW50LCB7XG5cdFx0XHRjb250ZXh0TWVudTogTWVudUlkLlRpdGxlQmFyQ29udGV4dCxcblx0XHRcdG9yaWVudGF0aW9uOiBBY3Rpb25zT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcblx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoJ2FyaWFMYWJlbFRpdGxlQWN0aW9ucycsIFwiVGl0bGUgYWN0aW9uc1wiKSxcblx0XHRcdGdldEtleUJpbmRpbmc6IGFjdGlvbiA9PiB0aGlzLmdldEtleWJpbmRpbmcoYWN0aW9uKSxcblx0XHRcdG92ZXJmbG93QmVoYXZpb3I6IHsgbWF4SXRlbXM6IDksIGV4ZW1wdGVkOiBbQUNDT1VOVFNfQUNUSVZJVFlfSUQsIEdMT0JBTF9BQ1RJVklUWV9JRCwgLi4uRURJVE9SX0NPUkVfTkFWSUdBVElPTl9DT01NQU5EU10gfSxcblx0XHRcdGFuY2hvckFsaWdubWVudFByb3ZpZGVyOiAoKSA9PiBBbmNob3JBbGlnbm1lbnQuUklHSFQsXG5cdFx0XHR0ZWxlbWV0cnlTb3VyY2U6ICd0aXRsZVBhcnQnLFxuXHRcdFx0aGlnaGxpZ2h0VG9nZ2xlZEl0ZW1zOiB0aGlzLmVkaXRvckFjdGlvbnNFbmFibGVkLCAvLyBPbmx5IHNob3cgdG9nZ2xlZCBzdGF0ZSBmb3IgZWRpdG9yIGFjdGlvbnMgKExheW91dCBhY3Rpb25zIGFyZSBub3Qgc2hvd24gYXMgdG9nZ2xlZClcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHRoaXMuYWN0aW9uVmlld0l0ZW1Qcm92aWRlcihhY3Rpb24sIG9wdGlvbnMpLFxuXHRcdFx0aG92ZXJEZWxlZ2F0ZTogdGhpcy5ob3ZlckRlbGVnYXRlXG5cdFx0fSkpO1xuXG5cdFx0aWYgKHRoaXMuZWRpdG9yQWN0aW9uc0VuYWJsZWQpIHtcblx0XHRcdHRoaXMuYWN0aW9uVG9vbEJhckRpc3Bvc2FibGUuYWRkKHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLm9uRGlkQ2hhbmdlQWN0aXZlR3JvdXAoKCkgPT4gdGhpcy5jcmVhdGVBY3Rpb25Ub29sQmFyTWVudXMoeyBlZGl0b3JBY3Rpb25zOiB0cnVlIH0pKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVBY3Rpb25Ub29sQmFyTWVudXModXBkYXRlOiB0cnVlIHwgeyBlZGl0b3JBY3Rpb25zPzogYm9vbGVhbjsgbGF5b3V0QWN0aW9ucz86IGJvb2xlYW47IGFjdGl2aXR5QWN0aW9ucz86IGJvb2xlYW4gfSA9IHRydWUpIHtcblx0XHRpZiAodXBkYXRlID09PSB0cnVlKSB7XG5cdFx0XHR1cGRhdGUgPSB7IGVkaXRvckFjdGlvbnM6IHRydWUsIGxheW91dEFjdGlvbnM6IHRydWUsIGFjdGl2aXR5QWN0aW9uczogdHJ1ZSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHVwZGF0ZVRvb2xCYXJBY3Rpb25zID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgYWN0aW9uczogSVRvb2xiYXJBY3Rpb25zID0geyBwcmltYXJ5OiBbXSwgc2Vjb25kYXJ5OiBbXSB9O1xuXG5cdFx0XHQvLyAtLS0gRWRpdG9yIEFjdGlvbnNcblx0XHRcdGlmICh0aGlzLmVkaXRvckFjdGlvbnNFbmFibGVkKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yQWN0aW9uc0NoYW5nZURpc3Bvc2FibGUuY2xlYXIoKTtcblxuXHRcdFx0XHRjb25zdCBhY3RpdmVHcm91cCA9IHRoaXMuZWRpdG9yR3JvdXBzQ29udGFpbmVyLmFjdGl2ZUdyb3VwO1xuXHRcdFx0XHRpZiAoYWN0aXZlR3JvdXApIHtcblx0XHRcdFx0XHRjb25zdCBlZGl0b3JBY3Rpb25zID0gYWN0aXZlR3JvdXAuY3JlYXRlRWRpdG9yQWN0aW9ucyh0aGlzLmVkaXRvckFjdGlvbnNDaGFuZ2VEaXNwb3NhYmxlKTtcblxuXHRcdFx0XHRcdGFjdGlvbnMucHJpbWFyeS5wdXNoKC4uLmVkaXRvckFjdGlvbnMuYWN0aW9ucy5wcmltYXJ5KTtcblx0XHRcdFx0XHRhY3Rpb25zLnNlY29uZGFyeS5wdXNoKC4uLmVkaXRvckFjdGlvbnMuYWN0aW9ucy5zZWNvbmRhcnkpO1xuXG5cdFx0XHRcdFx0dGhpcy5lZGl0b3JBY3Rpb25zQ2hhbmdlRGlzcG9zYWJsZS5hZGQoZWRpdG9yQWN0aW9ucy5vbkRpZENoYW5nZSgoKSA9PiB1cGRhdGVUb29sQmFyQWN0aW9ucygpKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gLS0tIEdsb2JhbCBBY3Rpb25zXG5cdFx0XHRjb25zdCBnbG9iYWxUb29sYmFyQWN0aW9ucyA9IHRoaXMuZ2xvYmFsVG9vbGJhck1lbnUuZ2V0QWN0aW9ucygpO1xuXHRcdFx0dGhpcy5oYXNHbG9iYWxUb29sYmFyRW50cmllcyA9IGdsb2JhbFRvb2xiYXJBY3Rpb25zLmxlbmd0aCA+IDA7XG5cdFx0XHRmaWxsSW5BY3Rpb25CYXJBY3Rpb25zKFxuXHRcdFx0XHRnbG9iYWxUb29sYmFyQWN0aW9ucyxcblx0XHRcdFx0YWN0aW9uc1xuXHRcdFx0KTtcblxuXHRcdFx0Ly8gLS0tIExheW91dCBBY3Rpb25zXG5cdFx0XHRpZiAodGhpcy5sYXlvdXRUb29sYmFyTWVudSkge1xuXHRcdFx0XHRmaWxsSW5BY3Rpb25CYXJBY3Rpb25zKFxuXHRcdFx0XHRcdHRoaXMubGF5b3V0VG9vbGJhck1lbnUuZ2V0QWN0aW9ucygpLFxuXHRcdFx0XHRcdGFjdGlvbnMsXG5cdFx0XHRcdFx0KCkgPT4gIXRoaXMuZWRpdG9yQWN0aW9uc0VuYWJsZWQgLy8gTGF5b3V0IEFjdGlvbnMgaW4gb3ZlcmZsb3cgbWVudSB3aGVuIGVkaXRvciBhY3Rpb25zIGVuYWJsZWQgaW4gdGl0bGUgYmFyXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIC0tLSBBY3Rpdml0eSBBY3Rpb25zIChhbHdheXMgYXQgdGhlIGVuZClcblx0XHRcdGlmICh0aGlzLmFjdGl2aXR5QWN0aW9uc0VuYWJsZWQpIHtcblx0XHRcdFx0aWYgKGlzQWNjb3VudHNBY3Rpb25WaXNpYmxlKHRoaXMuc3RvcmFnZVNlcnZpY2UpKSB7XG5cdFx0XHRcdFx0YWN0aW9ucy5wcmltYXJ5LnB1c2goQUNDT1VOVFNfQUNUSVZJVFlfVElMRV9BQ1RJT04pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YWN0aW9ucy5wcmltYXJ5LnB1c2goR0xPQkFMX0FDVElWSVRZX1RJVExFX0FDVElPTik7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuYWN0aW9uVG9vbEJhci5zZXRBY3Rpb25zKHByZXBhcmVBY3Rpb25zKGFjdGlvbnMucHJpbWFyeSksIHByZXBhcmVBY3Rpb25zKGFjdGlvbnMuc2Vjb25kYXJ5KSk7XG5cdFx0fTtcblxuXHRcdC8vIENyZWF0ZS9VcGRhdGUgdGhlIG1lbnVzIHdoaWNoIHNob3VsZCBiZSBpbiB0aGUgdGl0bGUgdG9vbCBiYXJcblxuXHRcdGlmICh1cGRhdGUuZWRpdG9yQWN0aW9ucykge1xuXHRcdFx0dGhpcy5lZGl0b3JUb29sYmFyTWVudURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRcdC8vIFRoZSBlZGl0b3IgdG9vbGJhciBtZW51IGlzIGhhbmRsZWQgYnkgdGhlIGVkaXRvciBncm91cCBzbyB3ZSBkbyBub3QgbmVlZCB0byBtYW5hZ2UgaXQgaGVyZS5cblx0XHRcdC8vIEhvd2V2ZXIsIGRlcGVuZGluZyBvbiB0aGUgYWN0aXZlIGVkaXRvciwgd2UgbmVlZCB0byB1cGRhdGUgdGhlIGNvbnRleHQgYW5kIGFjdGlvbiBydW5uZXIgb2YgdGhlIHRvb2xiYXIgbWVudS5cblx0XHRcdGlmICh0aGlzLmVkaXRvckFjdGlvbnNFbmFibGVkICYmIHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb25zdCBjb250ZXh0OiBJRWRpdG9yQ29tbWFuZHNDb250ZXh0ID0geyBncm91cElkOiB0aGlzLmVkaXRvckdyb3Vwc0NvbnRhaW5lci5hY3RpdmVHcm91cC5pZCB9O1xuXG5cdFx0XHRcdHRoaXMuYWN0aW9uVG9vbEJhci5hY3Rpb25SdW5uZXIgPSB0aGlzLmVkaXRvclRvb2xiYXJNZW51RGlzcG9zYWJsZXMuYWRkKG5ldyBFZGl0b3JDb21tYW5kc0NvbnRleHRBY3Rpb25SdW5uZXIoY29udGV4dCkpO1xuXHRcdFx0XHR0aGlzLmFjdGlvblRvb2xCYXIuY29udGV4dCA9IGNvbnRleHQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmFjdGlvblRvb2xCYXIuYWN0aW9uUnVubmVyID0gdGhpcy5lZGl0b3JUb29sYmFyTWVudURpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uUnVubmVyKCkpO1xuXHRcdFx0XHR0aGlzLmFjdGlvblRvb2xCYXIuY29udGV4dCA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodXBkYXRlLmxheW91dEFjdGlvbnMpIHtcblx0XHRcdHRoaXMubGF5b3V0VG9vbGJhck1lbnVEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0XHRpZiAodGhpcy5sYXlvdXRDb250cm9sRW5hYmxlZCkge1xuXHRcdFx0XHR0aGlzLmxheW91dFRvb2xiYXJNZW51ID0gdGhpcy5tZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5MYXlvdXRDb250cm9sTWVudSwgdGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRcdFx0dGhpcy5sYXlvdXRUb29sYmFyTWVudURpc3Bvc2FibGVzLmFkZCh0aGlzLmxheW91dFRvb2xiYXJNZW51KTtcblx0XHRcdFx0dGhpcy5sYXlvdXRUb29sYmFyTWVudURpc3Bvc2FibGVzLmFkZCh0aGlzLmxheW91dFRvb2xiYXJNZW51Lm9uRGlkQ2hhbmdlKCgpID0+IHVwZGF0ZVRvb2xCYXJBY3Rpb25zKCkpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubGF5b3V0VG9vbGJhck1lbnUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5nbG9iYWxUb29sYmFyTWVudURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5nbG9iYWxUb29sYmFyTWVudURpc3Bvc2FibGVzLmFkZCh0aGlzLmdsb2JhbFRvb2xiYXJNZW51Lm9uRGlkQ2hhbmdlKCgpID0+IHVwZGF0ZVRvb2xCYXJBY3Rpb25zKCkpKTtcblxuXHRcdGlmICh1cGRhdGUuYWN0aXZpdHlBY3Rpb25zKSB7XG5cdFx0XHR0aGlzLmFjdGl2aXR5VG9vbGJhckRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRpZiAodGhpcy5hY3Rpdml0eUFjdGlvbnNFbmFibGVkKSB7XG5cdFx0XHRcdHRoaXMuYWN0aXZpdHlUb29sYmFyRGlzcG9zYWJsZXMuYWRkKHRoaXMuc3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VWYWx1ZShTdG9yYWdlU2NvcGUuUFJPRklMRSwgQWNjb3VudHNBY3Rpdml0eUFjdGlvblZpZXdJdGVtLkFDQ09VTlRTX1ZJU0lCSUxJVFlfUFJFRkVSRU5DRV9LRVksIHRoaXMuX3N0b3JlKSgoKSA9PiB1cGRhdGVUb29sQmFyQWN0aW9ucygpKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dXBkYXRlVG9vbEJhckFjdGlvbnMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZVN0eWxlcygpOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVTdHlsZXMoKTtcblxuXHRcdC8vIFBhcnQgY29udGFpbmVyXG5cdFx0aWYgKHRoaXMuZWxlbWVudCkge1xuXHRcdFx0aWYgKHRoaXMuaXNJbmFjdGl2ZSkge1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnaW5hY3RpdmUnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdpbmFjdGl2ZScpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0aXRsZUJhY2tncm91bmQgPSB0aGlzLmdldENvbG9yKHRoaXMuaXNJbmFjdGl2ZSA/IFRJVExFX0JBUl9JTkFDVElWRV9CQUNLR1JPVU5EIDogVElUTEVfQkFSX0FDVElWRV9CQUNLR1JPVU5ELCAoY29sb3IsIHRoZW1lKSA9PiB7XG5cdFx0XHRcdC8vIExDRCBSZW5kZXJpbmcgU3VwcG9ydDogdGhlIHRpdGxlIGJhciBwYXJ0IGlzIGEgZGVmaW5pbmcgaXRzIG93biBHUFUgbGF5ZXIuXG5cdFx0XHRcdC8vIFRvIGJlbmVmaXQgZnJvbSBMQ0QgZm9udCByZW5kZXJpbmcsIHdlIG11c3QgZW5zdXJlIHRoYXQgd2UgYWx3YXlzIHNldCBhblxuXHRcdFx0XHQvLyBvcGFxdWUgYmFja2dyb3VuZCBjb2xvci4gQXMgc3VjaCwgd2UgY29tcHV0ZSBhbiBvcGFxdWUgY29sb3IgZ2l2ZW4gd2Uga25vd1xuXHRcdFx0XHQvLyB0aGUgYmFja2dyb3VuZCBjb2xvciBpcyB0aGUgd29ya2JlbmNoIGJhY2tncm91bmQuXG5cdFx0XHRcdHJldHVybiBjb2xvci5pc09wYXF1ZSgpID8gY29sb3IgOiBjb2xvci5tYWtlT3BhcXVlKFdPUktCRU5DSF9CQUNLR1JPVU5EKHRoZW1lKSk7XG5cdFx0XHR9KSB8fCAnJztcblx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSB0aXRsZUJhY2tncm91bmQ7XG5cblx0XHRcdGlmICh0aGlzLmFwcEljb25CYWRnZSkge1xuXHRcdFx0XHR0aGlzLmFwcEljb25CYWRnZS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSB0aXRsZUJhY2tncm91bmQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aXRsZUJhY2tncm91bmQgJiYgQ29sb3IuZnJvbUhleCh0aXRsZUJhY2tncm91bmQpLmlzTGlnaHRlcigpKSB7XG5cdFx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdsaWdodCcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2xpZ2h0Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRpdGxlRm9yZWdyb3VuZCA9IHRoaXMuZ2V0Q29sb3IodGhpcy5pc0luYWN0aXZlID8gVElUTEVfQkFSX0lOQUNUSVZFX0ZPUkVHUk9VTkQgOiBUSVRMRV9CQVJfQUNUSVZFX0ZPUkVHUk9VTkQpO1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLmNvbG9yID0gdGl0bGVGb3JlZ3JvdW5kIHx8ICcnO1xuXG5cdFx0XHRjb25zdCB0aXRsZUJvcmRlciA9IHRoaXMuZ2V0Q29sb3IoVElUTEVfQkFSX0JPUkRFUik7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYm9yZGVyQm90dG9tID0gdGl0bGVCb3JkZXIgPyBgMXB4IHNvbGlkICR7dGl0bGVCb3JkZXJ9YCA6ICcnO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvbkNvbnRleHRNZW51KGU6IE1vdXNlRXZlbnQsIG1lbnVJZDogTWVudUlkKTogdm9pZCB7XG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KGdldFdpbmRvdyh0aGlzLmVsZW1lbnQpLCBlKTtcblxuXHRcdC8vIFNob3cgaXRcblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBldmVudCxcblx0XHRcdG1lbnVJZCxcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlOiB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0ZG9tRm9yU2hhZG93Um9vdDogaXNNYWNpbnRvc2ggJiYgaXNOYXRpdmUgPyBldmVudC50YXJnZXQgOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXQgY3VycmVudE1lbnViYXJWaXNpYmlsaXR5KCk6IE1lbnVCYXJWaXNpYmlsaXR5IHtcblx0XHRpZiAodGhpcy5pc0F1eGlsaWFyeSkge1xuXHRcdFx0cmV0dXJuICdoaWRkZW4nO1xuXHRcdH1cblxuXHRcdHJldHVybiBnZXRNZW51QmFyVmlzaWJpbGl0eSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGxheW91dENvbnRyb2xFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdGhpcy5pc0F1eGlsaWFyeSAmJiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KExheW91dFNldHRpbmdzLkxBWU9VVF9BQ1RJT05TKSAhPT0gZmFsc2U7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IGlzQ29tbWFuZENlbnRlclZpc2libGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTGF5b3V0U2V0dGluZ3MuQ09NTUFORF9DRU5URVIpICE9PSBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGVkaXRvckFjdGlvbnNFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5wYXJ0T3B0aW9ucy5lZGl0b3JBY3Rpb25zTG9jYXRpb24gPT09IEVkaXRvckFjdGlvbnNMb2NhdGlvbi5USVRMRUJBUiB8fFxuXHRcdFx0KFxuXHRcdFx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS5wYXJ0T3B0aW9ucy5lZGl0b3JBY3Rpb25zTG9jYXRpb24gPT09IEVkaXRvckFjdGlvbnNMb2NhdGlvbi5ERUZBVUxUICYmXG5cdFx0XHRcdHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLnBhcnRPcHRpb25zLnNob3dUYWJzID09PSBFZGl0b3JUYWJzTW9kZS5OT05FXG5cdFx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgYWN0aXZpdHlBY3Rpb25zRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBhY3Rpdml0eUJhclBvc2l0aW9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxBY3Rpdml0eUJhclBvc2l0aW9uPihMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04pO1xuXHRcdHJldHVybiAhdGhpcy5pc0F1eGlsaWFyeSAmJiAoYWN0aXZpdHlCYXJQb3NpdGlvbiA9PT0gQWN0aXZpdHlCYXJQb3NpdGlvbi5UT1AgfHwgYWN0aXZpdHlCYXJQb3NpdGlvbiA9PT0gQWN0aXZpdHlCYXJQb3NpdGlvbi5CT1RUT00pO1xuXHR9XG5cblx0Z2V0IGhhc1pvb21hYmxlRWxlbWVudHMoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgaGFzTWVudWJhciA9ICEodGhpcy5jdXJyZW50TWVudWJhclZpc2liaWxpdHkgPT09ICdoaWRkZW4nIHx8IHRoaXMuY3VycmVudE1lbnViYXJWaXNpYmlsaXR5ID09PSAnY29tcGFjdCcgfHwgKCFpc1dlYiAmJiBpc01hY2ludG9zaCkpO1xuXHRcdGNvbnN0IGhhc0NvbW1hbmRDZW50ZXIgPSB0aGlzLmlzQ29tbWFuZENlbnRlclZpc2libGU7XG5cdFx0Y29uc3QgaGFzVG9vbEJhckFjdGlvbnMgPSB0aGlzLmhhc0dsb2JhbFRvb2xiYXJFbnRyaWVzIHx8IHRoaXMubGF5b3V0Q29udHJvbEVuYWJsZWQgfHwgdGhpcy5lZGl0b3JBY3Rpb25zRW5hYmxlZCB8fCB0aGlzLmFjdGl2aXR5QWN0aW9uc0VuYWJsZWQ7XG5cdFx0cmV0dXJuIGhhc01lbnViYXIgfHwgaGFzQ29tbWFuZENlbnRlciB8fCBoYXNUb29sQmFyQWN0aW9ucztcblx0fVxuXG5cdGdldCBwcmV2ZW50Wm9vbSgpOiBib29sZWFuIHtcblx0XHQvLyBQcmV2ZW50IHpvb21pbmcgYmVoYXZpb3IgaWYgYW55IG9mIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXHRcdC8vIDEuIFNocmlua2luZyBiZWxvdyB0aGUgd2luZG93IGNvbnRyb2wgc2l6ZSAoem9vbSA8IDEpXG5cdFx0Ly8gMi4gTm8gY3VzdG9tIGl0ZW1zIGFyZSBwcmVzZW50IGluIHRoZSB0aXRsZSBiYXJcblxuXHRcdHJldHVybiBnZXRab29tRmFjdG9yKGdldFdpbmRvdyh0aGlzLmVsZW1lbnQpKSA8IDEgfHwgIXRoaXMuaGFzWm9vbWFibGVFbGVtZW50cztcblx0fVxuXG5cdG92ZXJyaWRlIGxheW91dCh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlTGF5b3V0KG5ldyBEaW1lbnNpb24od2lkdGgsIGhlaWdodCkpO1xuXG5cdFx0c3VwZXIubGF5b3V0Q29udGVudHMod2lkdGgsIGhlaWdodCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUxheW91dChkaW1lbnNpb246IERpbWVuc2lvbik6IHZvaWQge1xuXHRcdHRoaXMubGFzdExheW91dERpbWVuc2lvbnMgPSBkaW1lbnNpb247XG5cblx0XHRpZiAoaGFzQ3VzdG9tVGl0bGViYXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy50aXRsZUJhclN0eWxlKSkge1xuXHRcdFx0Y29uc3Qgem9vbUZhY3RvciA9IGdldFpvb21GYWN0b3IoZ2V0V2luZG93KHRoaXMuZWxlbWVudCkpO1xuXG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoJy0tem9vbS1mYWN0b3InLCB6b29tRmFjdG9yLnRvU3RyaW5nKCkpO1xuXHRcdFx0dGhpcy5yb290Q29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2NvdW50ZXItem9vbScsIHRoaXMucHJldmVudFpvb20pO1xuXG5cdFx0XHRpZiAodGhpcy5jdXN0b21NZW51YmFyKSB7XG5cdFx0XHRcdGNvbnN0IG1lbnViYXJEaW1lbnNpb24gPSBuZXcgRGltZW5zaW9uKDAsIGRpbWVuc2lvbi5oZWlnaHQpO1xuXHRcdFx0XHR0aGlzLmN1c3RvbU1lbnViYXIubGF5b3V0KG1lbnViYXJEaW1lbnNpb24pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGZvY3VzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmN1c3RvbU1lbnViYXIpIHtcblx0XHRcdHRoaXMuY3VzdG9tTWVudWJhci50b2dnbGVGb2N1cygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQodGhpcy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ1t0YWJpbmRleF06bm90KFt0YWJpbmRleD1cIi0xXCJdKScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0dG9KU09OKCk6IG9iamVjdCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6IFBhcnRzLlRJVExFQkFSX1BBUlRcblx0XHR9O1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9vbldpbGxEaXNwb3NlLmZpcmUoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTWFpbkJyb3dzZXJUaXRsZWJhclBhcnQgZXh0ZW5kcyBCcm93c2VyVGl0bGViYXJQYXJ0IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihQYXJ0cy5USVRMRUJBUl9QQVJULCBtYWluV2luZG93LCAnbWFpbicsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIHRoZW1lU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIGxheW91dFNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCBob3N0U2VydmljZSwgZWRpdG9yR3JvdXBTZXJ2aWNlLCBlZGl0b3JTZXJ2aWNlLCBtZW51U2VydmljZSwga2V5YmluZGluZ1NlcnZpY2UpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUF1eGlsaWFyeVRpdGxlYmFyUGFydCBleHRlbmRzIElUaXRsZWJhclBhcnQsIElWaWV3IHtcblx0cmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgaGVpZ2h0OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBBdXhpbGlhcnlCcm93c2VyVGl0bGViYXJQYXJ0IGV4dGVuZHMgQnJvd3NlclRpdGxlYmFyUGFydCBpbXBsZW1lbnRzIElBdXhpbGlhcnlUaXRsZWJhclBhcnQge1xuXG5cdHByaXZhdGUgc3RhdGljIENPVU5URVIgPSAxO1xuXG5cdGdldCBoZWlnaHQoKSB7IHJldHVybiB0aGlzLm1pbmltdW1IZWlnaHQ7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGVkaXRvckdyb3Vwc0NvbnRhaW5lcjogSUVkaXRvckdyb3Vwc0NvbnRhaW5lcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1haW5UaXRsZWJhcjogQnJvd3NlclRpdGxlYmFyUGFydCxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBpZCA9IEF1eGlsaWFyeUJyb3dzZXJUaXRsZWJhclBhcnQuQ09VTlRFUisrO1xuXHRcdHN1cGVyKGB3b3JrYmVuY2gucGFydHMuYXV4aWxpYXJ5VGl0bGUuJHtpZH1gLCBnZXRXaW5kb3coY29udGFpbmVyKSwgZWRpdG9yR3JvdXBzQ29udGFpbmVyLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlLCBsYXlvdXRTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgaG9zdFNlcnZpY2UsIGVkaXRvckdyb3VwU2VydmljZSwgZWRpdG9yU2VydmljZSwgbWVudVNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldCBwcmV2ZW50Wm9vbSgpOiBib29sZWFuIHtcblxuXHRcdC8vIFByZXZlbnQgem9vbWluZyBiZWhhdmlvciBpZiBhbnkgb2YgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cdFx0Ly8gMS4gU2hyaW5raW5nIGJlbG93IHRoZSB3aW5kb3cgY29udHJvbCBzaXplICh6b29tIDwgMSlcblx0XHQvLyAyLiBObyBjdXN0b20gaXRlbXMgYXJlIHByZXNlbnQgaW4gdGhlIG1haW4gdGl0bGUgYmFyXG5cdFx0Ly8gVGhlIGF1eGlsaWFyeSB0aXRsZSBiYXIgbmV2ZXIgY29udGFpbnMgYW55IHpvb21hYmxlIGl0ZW1zIGl0c2VsZixcblx0XHQvLyBidXQgd2Ugd2FudCB0byBtYXRjaCB0aGUgYmVoYXZpb3Igb2YgdGhlIG1haW4gdGl0bGUgYmFyLlxuXG5cdFx0cmV0dXJuIGdldFpvb21GYWN0b3IoZ2V0V2luZG93KHRoaXMuZWxlbWVudCkpIDwgMSB8fCAhdGhpcy5tYWluVGl0bGViYXIuaGFzWm9vbWFibGVFbGVtZW50cztcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLGtCQUFrQixZQUFZO0FBRXZDLFNBQVMsd0JBQXdCLGVBQWUsb0JBQW9CO0FBQ3BFLFNBQTRCLGtCQUFrQixzQkFBc0IsbUJBQW1CLG1CQUFtQixnQ0FBZ0Msd0JBQXdCLDJCQUEwQztBQUM1TSxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUF3RDtBQUNqRSxTQUFTLHVCQUFvQztBQUM3QyxTQUFTLDJDQUEyQztBQUNwRCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDZCQUE2Qiw2QkFBNkIsK0JBQStCLCtCQUErQixrQkFBa0IsNEJBQTRCO0FBQy9LLFNBQVMsYUFBYSxXQUFXLFNBQVMsT0FBTyxVQUFVLHNCQUFzQjtBQUNqRixTQUFTLGFBQWE7QUFDdEIsU0FBUyxXQUFXLGFBQWEsV0FBVyxRQUFRLEdBQUcsdUJBQXVCLFNBQVMsT0FBTyxXQUFXLGFBQWEsWUFBWSxtQkFBbUIscUJBQXFCO0FBQzFLLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsaUJBQWlCLG9CQUFvQjtBQUM5QyxTQUFTLE9B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
