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
import * as dom from "../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { PixelRatio } from "../../../../base/browser/pixelRatio.js";
import { ActionBar, ActionsOrientation } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Action } from "../../../../base/common/actions.js";
import * as arrays from "../../../../base/common/arrays.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import * as errors from "../../../../base/common/errors.js";
import { DisposableStore, dispose, markAsSingleton, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Platform, platform } from "../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { createActionViewItem, getFlatActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { widgetBorder, widgetShadow } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { getWindowControlsStyle, WindowControlsStyle } from "../../../../platform/window/common/window.js";
import { EditorTabsMode, IWorkbenchLayoutService, LayoutSettings, Parts } from "../../../services/layout/browser/layoutService.js";
import { CONTEXT_DEBUG_STATE, CONTEXT_FOCUSED_SESSION_IS_ATTACH, CONTEXT_FOCUSED_SESSION_IS_NO_DEBUG, CONTEXT_IN_DEBUG_MODE, CONTEXT_MULTI_SESSION_DEBUG, CONTEXT_STEP_BACK_SUPPORTED, CONTEXT_SUSPEND_DEBUGGEE_SUPPORTED, CONTEXT_TERMINATE_DEBUGGEE_SUPPORTED, IDebugService, State, VIEWLET_ID } from "../common/debug.js";
import { FocusSessionActionViewItem } from "./debugActionViewItems.js";
import { debugToolBarBackground, debugToolBarBorder } from "./debugColors.js";
import { CONTINUE_ID, CONTINUE_LABEL, DISCONNECT_AND_SUSPEND_ID, DISCONNECT_AND_SUSPEND_LABEL, DISCONNECT_ID, DISCONNECT_LABEL, FOCUS_SESSION_ID, FOCUS_SESSION_LABEL, PAUSE_ID, PAUSE_LABEL, RESTART_LABEL, RESTART_SESSION_ID, REVERSE_CONTINUE_ID, STEP_BACK_ID, STEP_INTO_ID, STEP_INTO_LABEL, STEP_OUT_ID, STEP_OUT_LABEL, STEP_OVER_ID, STEP_OVER_LABEL, STOP_ID, STOP_LABEL } from "./debugCommands.js";
import * as icons from "./debugIcons.js";
import "./media/debugToolBar.css";
const DEBUG_TOOLBAR_POSITION_KEY = "debug.actionswidgetposition";
const DEBUG_TOOLBAR_Y_KEY = "debug.actionswidgety";
let DebugToolBar = class extends Themable {
  constructor(notificationService, telemetryService, debugService, layoutService, storageService, configurationService, themeService, instantiationService, menuService, contextKeyService) {
    super(themeService);
    this.notificationService = notificationService;
    this.telemetryService = telemetryService;
    this.debugService = debugService;
    this.layoutService = layoutService;
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.isVisible = false;
    this.isBuilt = false;
    this.stopActionViewItemDisposables = this._register(new DisposableStore());
    /** coordinate of the debug toolbar per aux window */
    this.auxWindowCoordinates = /* @__PURE__ */ new WeakMap();
    this.trackPixelRatioListener = this._register(new MutableDisposable());
    this.$el = dom.$("div.debug-toolbar");
    const customWindowControls = getWindowControlsStyle(this.configurationService) === WindowControlsStyle.CUSTOM;
    const controlsOnLeft = customWindowControls && platform === Platform.Mac;
    const controlsOnRight = customWindowControls && (platform === Platform.Windows || platform === Platform.Linux);
    this.$el.style.transform = `translate(
			min(
				max(${controlsOnLeft ? "60px" : "0px"}, calc(-50% + (100vw * var(--x-position)))),
				calc(100vw - 100% - ${controlsOnRight ? "100px" : "0px"})
			),
			var(--y-position)
		)`;
    this.dragArea = dom.append(this.$el, dom.$("div.drag-area" + ThemeIcon.asCSSSelector(icons.debugGripper)));
    const actionBarContainer = dom.append(this.$el, dom.$("div.action-bar-container"));
    this.debugToolBarMenu = menuService.createMenu(MenuId.DebugToolBar, contextKeyService);
    this._register(this.debugToolBarMenu);
    this.activeActions = [];
    this.actionBar = this._register(new ActionBar(actionBarContainer, {
      orientation: ActionsOrientation.HORIZONTAL,
      actionViewItemProvider: (action, options) => {
        if (action.id === FOCUS_SESSION_ID) {
          return this.instantiationService.createInstance(FocusSessionActionViewItem, action, void 0);
        } else if (action.id === STOP_ID || action.id === DISCONNECT_ID) {
          this.stopActionViewItemDisposables.clear();
          const item = this.instantiationService.invokeFunction((accessor) => createDisconnectMenuItemAction(action, this.stopActionViewItemDisposables, accessor, { hoverDelegate: options.hoverDelegate }));
          if (item) {
            return item;
          }
        }
        return createActionViewItem(this.instantiationService, action, options);
      }
    }));
    this.updateScheduler = this._register(new RunOnceScheduler(() => {
      const state = this.debugService.state;
      const toolBarLocation = this.configurationService.getValue("debug").toolBarLocation;
      if (state === State.Inactive || toolBarLocation !== "floating" || this.debugService.getModel().getSessions().every((s) => s.suppressDebugToolbar) || state === State.Initializing && this.debugService.initializingOptions?.suppressDebugToolbar) {
        return this.hide();
      }
      const actions = getFlatActionBarActions(this.debugToolBarMenu.getActions({ shouldForwardArgs: true }));
      if (!arrays.equals(actions, this.activeActions, (first, second) => first.id === second.id && first.enabled === second.enabled)) {
        this.actionBar.clear();
        this.actionBar.push(actions, { icon: true, label: false });
        this.activeActions = actions;
      }
      this.show();
    }, 20));
    this.updateStyles();
    this.registerListeners();
    this.hide();
  }
  registerListeners() {
    this._register(this.debugService.onDidChangeState(() => this.updateScheduler.schedule()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("debug.toolBarLocation")) {
        this.updateScheduler.schedule();
      }
      if (e.affectsConfiguration(LayoutSettings.EDITOR_TABS_MODE) || e.affectsConfiguration(LayoutSettings.COMMAND_CENTER)) {
        this._yRange = void 0;
        this.setCoordinates();
      }
    }));
    this._register(this.debugToolBarMenu.onDidChange(() => this.updateScheduler.schedule()));
    this._register(this.actionBar.actionRunner.onDidRun((e) => {
      if (e.error && !errors.isCancellationError(e.error)) {
        this.notificationService.warn(e.error);
      }
      this.telemetryService.publicLog2("workbenchActionExecuted", { id: e.action.id, from: "debugActionsWidget" });
    }));
    this._register(dom.addDisposableGenericMouseUpListener(this.dragArea, (event) => {
      const mouseClickEvent = new StandardMouseEvent(dom.getWindow(this.dragArea), event);
      if (mouseClickEvent.detail === 2) {
        this.setCoordinates(0.5, this.yDefault);
        this.storePosition();
      }
    }));
    this._register(dom.addDisposableGenericMouseDownListener(this.dragArea, (e) => {
      this.dragArea.classList.add("dragged");
      const activeWindow = dom.getWindow(this.layoutService.activeContainer);
      const originEvent = new StandardMouseEvent(activeWindow, e);
      const originX = this.computeCurrentXPercent();
      const originY = this.getCurrentYPosition();
      const mouseMoveListener = dom.addDisposableGenericMouseMoveListener(activeWindow, (e2) => {
        const mouseMoveEvent = new StandardMouseEvent(activeWindow, e2);
        mouseMoveEvent.preventDefault();
        this.setCoordinates(
          originX + (mouseMoveEvent.posx - originEvent.posx) / activeWindow.innerWidth,
          originY + mouseMoveEvent.posy - originEvent.posy
        );
      });
      const mouseUpListener = dom.addDisposableGenericMouseUpListener(activeWindow, (e2) => {
        this.storePosition();
        this.dragArea.classList.remove("dragged");
        mouseMoveListener.dispose();
        mouseUpListener.dispose();
      });
    }));
    this._register(this.layoutService.onDidChangePartVisibility(() => this.setCoordinates()));
    this._register(this.layoutService.onDidChangeActiveContainer(async () => {
      this._yRange = void 0;
      await this.layoutService.whenContainerStylesLoaded(dom.getWindow(this.layoutService.activeContainer));
      if (this.isBuilt) {
        this.doShowInActiveContainer();
        this.setCoordinates();
      }
    }));
  }
  /**
   * Computes the x percent position at which the toolbar is currently displayed.
   */
  computeCurrentXPercent() {
    const { left, width } = this.$el.getBoundingClientRect();
    return (left + width / 2) / dom.getWindow(this.$el).innerWidth;
  }
  /**
   * Gets the x position set in the style of the toolbar. This may not be its
   * actual position on screen depending on toolbar locations.
   */
  getCurrentXPercent() {
    return Number(this.$el.style.getPropertyValue("--x-position"));
  }
  /** Gets the y position set in the style of the toolbar */
  getCurrentYPosition() {
    return parseInt(this.$el.style.getPropertyValue("--y-position"));
  }
  storePosition() {
    const activeWindow = dom.getWindow(this.layoutService.activeContainer);
    const isMainWindow = this.layoutService.activeContainer === this.layoutService.mainContainer;
    const x = this.getCurrentXPercent();
    const y = this.getCurrentYPosition();
    if (isMainWindow) {
      this.storageService.store(DEBUG_TOOLBAR_POSITION_KEY, x, StorageScope.PROFILE, StorageTarget.MACHINE);
      this.storageService.store(DEBUG_TOOLBAR_Y_KEY, y, StorageScope.PROFILE, StorageTarget.MACHINE);
    } else {
      this.auxWindowCoordinates.set(activeWindow, { x, y });
    }
  }
  updateStyles() {
    super.updateStyles();
    if (this.$el) {
      this.$el.style.backgroundColor = this.getColor(debugToolBarBackground) || "";
      const widgetShadowColor = this.getColor(widgetShadow);
      this.$el.style.boxShadow = widgetShadowColor ? `0 0 8px 2px ${widgetShadowColor}` : "";
      const contrastBorderColor = this.getColor(widgetBorder);
      const borderColor = this.getColor(debugToolBarBorder);
      if (contrastBorderColor) {
        this.$el.style.border = `1px solid ${contrastBorderColor}`;
      } else {
        this.$el.style.border = borderColor ? `solid ${borderColor}` : "none";
        this.$el.style.border = "1px 0";
      }
    }
  }
  /** Gets the stored X position of the middle of the toolbar based on the current window width */
  getStoredXPosition() {
    const currentWindow = dom.getWindow(this.layoutService.activeContainer);
    const isMainWindow = currentWindow === mainWindow;
    const storedPercentage = isMainWindow ? Number(this.storageService.get(DEBUG_TOOLBAR_POSITION_KEY, StorageScope.PROFILE)) : this.auxWindowCoordinates.get(currentWindow)?.x;
    return storedPercentage !== void 0 && !isNaN(storedPercentage) ? storedPercentage : 0.5;
  }
  getStoredYPosition() {
    const currentWindow = dom.getWindow(this.layoutService.activeContainer);
    const isMainWindow = currentWindow === mainWindow;
    const storedY = isMainWindow ? this.storageService.getNumber(DEBUG_TOOLBAR_Y_KEY, StorageScope.PROFILE) : this.auxWindowCoordinates.get(currentWindow)?.y;
    return storedY ?? this.yDefault;
  }
  setCoordinates(x, y) {
    if (!this.isVisible) {
      return;
    }
    x ??= this.getStoredXPosition();
    y ??= this.getStoredYPosition();
    const [yMin, yMax] = this.yRange;
    y = Math.max(yMin, Math.min(y, yMax));
    this.$el.style.setProperty("--x-position", `${x}`);
    this.$el.style.setProperty("--y-position", `${y}px`);
  }
  get yDefault() {
    return this.layoutService.mainContainerOffset.top;
  }
  get yRange() {
    if (!this._yRange) {
      const isTitleBarVisible = this.layoutService.isVisible(Parts.TITLEBAR_PART, dom.getWindow(this.layoutService.activeContainer));
      const yMin = isTitleBarVisible ? 0 : this.layoutService.mainContainerOffset.top;
      let yMax = 0;
      if (isTitleBarVisible) {
        if (this.configurationService.getValue(LayoutSettings.COMMAND_CENTER) === true) {
          yMax += 35;
        } else {
          yMax += 28;
        }
      }
      if (this.configurationService.getValue(LayoutSettings.EDITOR_TABS_MODE) !== EditorTabsMode.NONE) {
        yMax += 35;
      }
      this._yRange = [yMin, yMax];
    }
    return this._yRange;
  }
  show() {
    if (this.isVisible) {
      this.setCoordinates();
      return;
    }
    if (!this.isBuilt) {
      this.isBuilt = true;
      this.doShowInActiveContainer();
    }
    this.isVisible = true;
    dom.show(this.$el);
    this.setCoordinates();
  }
  doShowInActiveContainer() {
    this.layoutService.activeContainer.appendChild(this.$el);
    this.trackPixelRatioListener.value = PixelRatio.getInstance(dom.getWindow(this.$el)).onDidChange(
      () => this.setCoordinates()
    );
  }
  hide() {
    this.isVisible = false;
    dom.hide(this.$el);
  }
  dispose() {
    super.dispose();
    this.$el?.remove();
  }
};
DebugToolBar = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IDebugService),
  __decorateParam(3, IWorkbenchLayoutService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IContextKeyService)
], DebugToolBar);
function createDisconnectMenuItemAction(action, disposables, accessor, options) {
  const menuService = accessor.get(IMenuService);
  const contextKeyService = accessor.get(IContextKeyService);
  const instantiationService = accessor.get(IInstantiationService);
  const menu = menuService.getMenuActions(MenuId.DebugToolBarStop, contextKeyService, { shouldForwardArgs: true });
  const secondary = getFlatActionBarActions(menu);
  if (!secondary.length) {
    return void 0;
  }
  const dropdownAction = disposables.add(new Action("notebook.moreRunActions", localize("notebook.moreRunActionsLabel", "More..."), "codicon-chevron-down", true));
  const item = instantiationService.createInstance(
    DropdownWithPrimaryActionViewItem,
    action,
    dropdownAction,
    secondary,
    "debug-stop-actions",
    options
  );
  return item;
}
const debugViewTitleItems = [];
const registerDebugToolBarItem = (id, title, order, icon, when, precondition, alt) => {
  MenuRegistry.appendMenuItem(MenuId.DebugToolBar, {
    group: "navigation",
    when,
    order,
    command: {
      id,
      title,
      icon,
      precondition
    },
    alt
  });
  debugViewTitleItems.push(MenuRegistry.appendMenuItem(MenuId.ViewContainerTitle, {
    group: "navigation",
    when: ContextKeyExpr.and(when, ContextKeyExpr.equals("viewContainer", VIEWLET_ID), CONTEXT_DEBUG_STATE.notEqualsTo("inactive"), ContextKeyExpr.equals("config.debug.toolBarLocation", "docked")),
    order,
    command: {
      id,
      title,
      icon,
      precondition
    }
  }));
};
markAsSingleton(MenuRegistry.onDidChangeMenu((e) => {
  if (e.has(MenuId.DebugToolBar)) {
    dispose(debugViewTitleItems);
    const items = MenuRegistry.getMenuItems(MenuId.DebugToolBar);
    for (const i of items) {
      debugViewTitleItems.push(MenuRegistry.appendMenuItem(MenuId.ViewContainerTitle, {
        ...i,
        when: ContextKeyExpr.and(i.when, ContextKeyExpr.equals("viewContainer", VIEWLET_ID), CONTEXT_DEBUG_STATE.notEqualsTo("inactive"), ContextKeyExpr.equals("config.debug.toolBarLocation", "docked"))
      }));
    }
  }
}));
const CONTEXT_TOOLBAR_COMMAND_CENTER = ContextKeyExpr.equals("config.debug.toolBarLocation", "commandCenter");
MenuRegistry.appendMenuItem(MenuId.CommandCenterCenter, {
  submenu: MenuId.DebugToolBar,
  title: "Debug",
  icon: Codicon.debug,
  order: 1,
  when: ContextKeyExpr.and(CONTEXT_IN_DEBUG_MODE, CONTEXT_TOOLBAR_COMMAND_CENTER)
});
registerDebugToolBarItem(CONTINUE_ID, CONTINUE_LABEL, 10, icons.debugContinue, CONTEXT_DEBUG_STATE.isEqualTo("stopped"));
registerDebugToolBarItem(PAUSE_ID, PAUSE_LABEL, 10, icons.debugPause, CONTEXT_DEBUG_STATE.notEqualsTo("stopped"), ContextKeyExpr.and(CONTEXT_DEBUG_STATE.isEqualTo("running"), CONTEXT_FOCUSED_SESSION_IS_NO_DEBUG.toNegated()));
registerDebugToolBarItem(STOP_ID, STOP_LABEL, 70, icons.debugStop, CONTEXT_FOCUSED_SESSION_IS_ATTACH.toNegated(), void 0, { id: DISCONNECT_ID, title: DISCONNECT_LABEL, icon: icons.debugDisconnect, precondition: ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH.toNegated(), CONTEXT_TERMINATE_DEBUGGEE_SUPPORTED) });
registerDebugToolBarItem(DISCONNECT_ID, DISCONNECT_LABEL, 70, icons.debugDisconnect, CONTEXT_FOCUSED_SESSION_IS_ATTACH, void 0, { id: STOP_ID, title: STOP_LABEL, icon: icons.debugStop, precondition: ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH, CONTEXT_TERMINATE_DEBUGGEE_SUPPORTED) });
registerDebugToolBarItem(STEP_OVER_ID, STEP_OVER_LABEL, 20, icons.debugStepOver, void 0, CONTEXT_DEBUG_STATE.isEqualTo("stopped"));
registerDebugToolBarItem(STEP_INTO_ID, STEP_INTO_LABEL, 30, icons.debugStepInto, void 0, CONTEXT_DEBUG_STATE.isEqualTo("stopped"));
registerDebugToolBarItem(STEP_OUT_ID, STEP_OUT_LABEL, 40, icons.debugStepOut, void 0, CONTEXT_DEBUG_STATE.isEqualTo("stopped"));
registerDebugToolBarItem(RESTART_SESSION_ID, RESTART_LABEL, 60, icons.debugRestart);
registerDebugToolBarItem(STEP_BACK_ID, localize("stepBackDebug", "Step Back"), 50, icons.debugStepBack, CONTEXT_STEP_BACK_SUPPORTED, CONTEXT_DEBUG_STATE.isEqualTo("stopped"));
registerDebugToolBarItem(REVERSE_CONTINUE_ID, localize("reverseContinue", "Reverse"), 55, icons.debugReverseContinue, CONTEXT_STEP_BACK_SUPPORTED, CONTEXT_DEBUG_STATE.isEqualTo("stopped"));
registerDebugToolBarItem(FOCUS_SESSION_ID, FOCUS_SESSION_LABEL, 100, Codicon.listTree, ContextKeyExpr.and(CONTEXT_MULTI_SESSION_DEBUG, CONTEXT_TOOLBAR_COMMAND_CENTER.negate()));
MenuRegistry.appendMenuItem(MenuId.DebugToolBarStop, {
  group: "navigation",
  when: ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH.toNegated(), CONTEXT_TERMINATE_DEBUGGEE_SUPPORTED),
  order: 0,
  command: {
    id: DISCONNECT_ID,
    title: DISCONNECT_LABEL,
    icon: icons.debugDisconnect
  }
});
MenuRegistry.appendMenuItem(MenuId.DebugToolBarStop, {
  group: "navigation",
  when: ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH, CONTEXT_TERMINATE_DEBUGGEE_SUPPORTED),
  order: 0,
  command: {
    id: STOP_ID,
    title: STOP_LABEL,
    icon: icons.debugStop
  }
});
MenuRegistry.appendMenuItem(MenuId.DebugToolBarStop, {
  group: "navigation",
  when: ContextKeyExpr.or(
    ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH.toNegated(), CONTEXT_SUSPEND_DEBUGGEE_SUPPORTED, CONTEXT_TERMINATE_DEBUGGEE_SUPPORTED),
    ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH, CONTEXT_SUSPEND_DEBUGGEE_SUPPORTED)
  ),
  order: 0,
  command: {
    id: DISCONNECT_AND_SUSPEND_ID,
    title: DISCONNECT_AND_SUSPEND_LABEL,
    icon: icons.debugDisconnect
  }
});
export {
  DebugToolBar,
  createDisconnectMenuItemAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnVG9vbEJhci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IFBpeGVsUmF0aW8gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvcGl4ZWxSYXRpby5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIsIEFjdGlvbnNPcmllbnRhdGlvbiwgSUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgSUJhc2VBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBDb2RlV2luZG93LCBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIElSdW5FdmVudCwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbiwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0ICogYXMgYXJyYXlzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCAqIGFzIGVycm9ycyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgbWFya0FzU2luZ2xldG9uLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBQbGF0Zm9ybSwgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb21tYW5kQWN0aW9uLCBJQ29tbWFuZEFjdGlvblRpdGxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb24uanMnO1xuaW1wb3J0IHsgRHJvcGRvd25XaXRoUHJpbWFyeUFjdGlvblZpZXdJdGVtLCBJRHJvcGRvd25XaXRoUHJpbWFyeUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9kcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgY3JlYXRlQWN0aW9uVmlld0l0ZW0sIGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElNZW51LCBJTWVudVNlcnZpY2UsIE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24sIE1lbnVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgQ29udGV4dEtleUV4cHJlc3Npb24sIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IHdpZGdldEJvcmRlciwgd2lkZ2V0U2hhZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSwgVGhlbWFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldFdpbmRvd0NvbnRyb2xzU3R5bGUsIFdpbmRvd0NvbnRyb2xzU3R5bGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93aW5kb3cvY29tbW9uL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yVGFic01vZGUsIElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCBMYXlvdXRTZXR0aW5ncywgUGFydHMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENPTlRFWFRfREVCVUdfU1RBVEUsIENPTlRFWFRfRk9DVVNFRF9TRVNTSU9OX0lTX0FUVEFDSCwgQ09OVEVYVF9GT0NVU0VEX1NFU1NJT05fSVNfTk9fREVCVUcsIENPTlRFWFRfSU5fREVCVUdfTU9ERSwgQ09OVEVYVF9NVUxUSV9TRVNTSU9OX0RFQlVHLCBDT05URVhUX1NURVBfQkFDS19TVVBQT1JURUQsIENPTlRFWFRfU1VTUEVORF9ERUJVR0dFRV9TVVBQT1JURUQsIENPTlRFWFRfVEVSTUlOQVRFX0RFQlVHR0VFX1NVUFBPUlRFRCwgSURlYnVnQ29uZmlndXJhdGlvbiwgSURlYnVnU2VydmljZSwgU3RhdGUsIFZJRVdMRVRfSUQgfSBmcm9tICcuLi9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgRm9jdXNTZXNzaW9uQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuL2RlYnVnQWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IGRlYnVnVG9vbEJhckJhY2tncm91bmQsIGRlYnVnVG9vbEJhckJvcmRlciB9IGZyb20gJy4vZGVidWdDb2xvcnMuanMnO1xuaW1wb3J0IHsgQ09OVElOVUVfSUQsIENPTlRJTlVFX0xBQkVMLCBESVNDT05ORUNUX0FORF9TVVNQRU5EX0lELCBESVNDT05ORUNUX0FORF9TVVNQRU5EX0xBQkVMLCBESVNDT05ORUNUX0lELCBESVNDT05ORUNUX0xBQkVMLCBGT0NVU19TRVNTSU9OX0lELCBGT0NVU19TRVNTSU9OX0xBQkVMLCBQQVVTRV9JRCwgUEFVU0VfTEFCRUwsIFJFU1RBUlRfTEFCRUwsIFJFU1RBUlRfU0VTU0lPTl9JRCwgUkVWRVJTRV9DT05USU5VRV9JRCwgU1RFUF9CQUNLX0lELCBTVEVQX0lOVE9fSUQsIFNURVBfSU5UT19MQUJFTCwgU1RFUF9PVVRfSUQsIFNURVBfT1VUX0xBQkVMLCBTVEVQX09WRVJfSUQsIFNURVBfT1ZFUl9MQUJFTCwgU1RPUF9JRCwgU1RPUF9MQUJFTCB9IGZyb20gJy4vZGVidWdDb21tYW5kcy5qcyc7XG5pbXBvcnQgKiBhcyBpY29ucyBmcm9tICcuL2RlYnVnSWNvbnMuanMnO1xuaW1wb3J0ICcuL21lZGlhL2RlYnVnVG9vbEJhci5jc3MnO1xuXG5jb25zdCBERUJVR19UT09MQkFSX1BPU0lUSU9OX0tFWSA9ICdkZWJ1Zy5hY3Rpb25zd2lkZ2V0cG9zaXRpb24nO1xuY29uc3QgREVCVUdfVE9PTEJBUl9ZX0tFWSA9ICdkZWJ1Zy5hY3Rpb25zd2lkZ2V0eSc7XG5cbmV4cG9ydCBjbGFzcyBEZWJ1Z1Rvb2xCYXIgZXh0ZW5kcyBUaGVtYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgJGVsOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBkcmFnQXJlYTogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgYWN0aW9uQmFyOiBBY3Rpb25CYXI7XG5cdHByaXZhdGUgYWN0aXZlQWN0aW9uczogSUFjdGlvbltdO1xuXHRwcml2YXRlIHVwZGF0ZVNjaGVkdWxlcjogUnVuT25jZVNjaGVkdWxlcjtcblx0cHJpdmF0ZSBkZWJ1Z1Rvb2xCYXJNZW51OiBJTWVudTtcblxuXHRwcml2YXRlIGlzVmlzaWJsZSA9IGZhbHNlO1xuXHRwcml2YXRlIGlzQnVpbHQgPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHN0b3BBY3Rpb25WaWV3SXRlbURpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0LyoqIGNvb3JkaW5hdGUgb2YgdGhlIGRlYnVnIHRvb2xiYXIgcGVyIGF1eCB3aW5kb3cgKi9cblx0cHJpdmF0ZSByZWFkb25seSBhdXhXaW5kb3dDb29yZGluYXRlcyA9IG5ldyBXZWFrTWFwPENvZGVXaW5kb3csIHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfCB1bmRlZmluZWQgfT4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHRyYWNrUGl4ZWxSYXRpb0xpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcih0aGVtZVNlcnZpY2UpO1xuXG5cdFx0dGhpcy4kZWwgPSBkb20uJCgnZGl2LmRlYnVnLXRvb2xiYXInKTtcblxuXHRcdC8vIE5vdGU6IGNoYW5nZXMgdG8gdGhpcyBzZXR0aW5nIHJlcXVpcmUgYSByZXN0YXJ0LCBzbyBubyBuZWVkIHRvIGxpc3RlbiB0byBpdC5cblx0XHRjb25zdCBjdXN0b21XaW5kb3dDb250cm9scyA9IGdldFdpbmRvd0NvbnRyb2xzU3R5bGUodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkgPT09IFdpbmRvd0NvbnRyb2xzU3R5bGUuQ1VTVE9NO1xuXG5cdFx0Ly8gRG8gbm90IGFsbG93IHRoZSB3aWRnZXQgdG8gb3ZlcmZsb3cgb3IgdW5kZXJmbG93IHdpbmRvdyBjb250cm9scy5cblx0XHQvLyBVc2UgQ1NTIGNhbGN1bGF0aW9ucyB0byBhdm9pZCBoYXZpbmcgdG8gZm9yY2UgbGF5b3V0IHdpdGggYC5jbGllbnRXaWR0aGBcblx0XHRjb25zdCBjb250cm9sc09uTGVmdCA9IGN1c3RvbVdpbmRvd0NvbnRyb2xzICYmIHBsYXRmb3JtID09PSBQbGF0Zm9ybS5NYWM7XG5cdFx0Y29uc3QgY29udHJvbHNPblJpZ2h0ID0gY3VzdG9tV2luZG93Q29udHJvbHMgJiYgKHBsYXRmb3JtID09PSBQbGF0Zm9ybS5XaW5kb3dzIHx8IHBsYXRmb3JtID09PSBQbGF0Zm9ybS5MaW51eCk7XG5cdFx0dGhpcy4kZWwuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZShcblx0XHRcdG1pbihcblx0XHRcdFx0bWF4KCR7Y29udHJvbHNPbkxlZnQgPyAnNjBweCcgOiAnMHB4J30sIGNhbGMoLTUwJSArICgxMDB2dyAqIHZhcigtLXgtcG9zaXRpb24pKSkpLFxuXHRcdFx0XHRjYWxjKDEwMHZ3IC0gMTAwJSAtICR7Y29udHJvbHNPblJpZ2h0ID8gJzEwMHB4JyA6ICcwcHgnfSlcblx0XHRcdCksXG5cdFx0XHR2YXIoLS15LXBvc2l0aW9uKVxuXHRcdClgO1xuXG5cdFx0dGhpcy5kcmFnQXJlYSA9IGRvbS5hcHBlbmQodGhpcy4kZWwsIGRvbS4kKCdkaXYuZHJhZy1hcmVhJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnR3JpcHBlcikpKTtcblxuXHRcdGNvbnN0IGFjdGlvbkJhckNvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhpcy4kZWwsIGRvbS4kKCdkaXYuYWN0aW9uLWJhci1jb250YWluZXInKSk7XG5cdFx0dGhpcy5kZWJ1Z1Rvb2xCYXJNZW51ID0gbWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuRGVidWdUb29sQmFyLCBjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWJ1Z1Rvb2xCYXJNZW51KTtcblxuXHRcdHRoaXMuYWN0aXZlQWN0aW9ucyA9IFtdO1xuXHRcdHRoaXMuYWN0aW9uQmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcihhY3Rpb25CYXJDb250YWluZXIsIHtcblx0XHRcdG9yaWVudGF0aW9uOiBBY3Rpb25zT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElCYXNlQWN0aW9uVmlld0l0ZW1PcHRpb25zKSA9PiB7XG5cdFx0XHRcdGlmIChhY3Rpb24uaWQgPT09IEZPQ1VTX1NFU1NJT05fSUQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGb2N1c1Nlc3Npb25BY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGFjdGlvbi5pZCA9PT0gU1RPUF9JRCB8fCBhY3Rpb24uaWQgPT09IERJU0NPTk5FQ1RfSUQpIHtcblx0XHRcdFx0XHR0aGlzLnN0b3BBY3Rpb25WaWV3SXRlbURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gY3JlYXRlRGlzY29ubmVjdE1lbnVJdGVtQWN0aW9uKGFjdGlvbiBhcyBNZW51SXRlbUFjdGlvbiwgdGhpcy5zdG9wQWN0aW9uVmlld0l0ZW1EaXNwb3NhYmxlcywgYWNjZXNzb3IsIHsgaG92ZXJEZWxlZ2F0ZTogb3B0aW9ucy5ob3ZlckRlbGVnYXRlIH0pKTtcblx0XHRcdFx0XHRpZiAoaXRlbSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGNyZWF0ZUFjdGlvblZpZXdJdGVtKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIGFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy51cGRhdGVTY2hlZHVsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuZGVidWdTZXJ2aWNlLnN0YXRlO1xuXHRcdFx0Y29uc3QgdG9vbEJhckxvY2F0aW9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKS50b29sQmFyTG9jYXRpb247XG5cdFx0XHRpZiAoXG5cdFx0XHRcdHN0YXRlID09PSBTdGF0ZS5JbmFjdGl2ZSB8fFxuXHRcdFx0XHR0b29sQmFyTG9jYXRpb24gIT09ICdmbG9hdGluZycgfHxcblx0XHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRTZXNzaW9ucygpLmV2ZXJ5KHMgPT4gcy5zdXBwcmVzc0RlYnVnVG9vbGJhcikgfHxcblx0XHRcdFx0KHN0YXRlID09PSBTdGF0ZS5Jbml0aWFsaXppbmcgJiYgdGhpcy5kZWJ1Z1NlcnZpY2UuaW5pdGlhbGl6aW5nT3B0aW9ucz8uc3VwcHJlc3NEZWJ1Z1Rvb2xiYXIpXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaGlkZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhY3Rpb25zID0gZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnModGhpcy5kZWJ1Z1Rvb2xCYXJNZW51LmdldEFjdGlvbnMoeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KSk7XG5cdFx0XHRpZiAoIWFycmF5cy5lcXVhbHMoYWN0aW9ucywgdGhpcy5hY3RpdmVBY3Rpb25zLCAoZmlyc3QsIHNlY29uZCkgPT4gZmlyc3QuaWQgPT09IHNlY29uZC5pZCAmJiBmaXJzdC5lbmFibGVkID09PSBzZWNvbmQuZW5hYmxlZCkpIHtcblx0XHRcdFx0dGhpcy5hY3Rpb25CYXIuY2xlYXIoKTtcblx0XHRcdFx0dGhpcy5hY3Rpb25CYXIucHVzaChhY3Rpb25zLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0XHRcdFx0dGhpcy5hY3RpdmVBY3Rpb25zID0gYWN0aW9ucztcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5zaG93KCk7XG5cdFx0fSwgMjApKTtcblxuXHRcdHRoaXMudXBkYXRlU3R5bGVzKCk7XG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHRcdHRoaXMuaGlkZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlYnVnU2VydmljZS5vbkRpZENoYW5nZVN0YXRlKCgpID0+IHRoaXMudXBkYXRlU2NoZWR1bGVyLnNjaGVkdWxlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdkZWJ1Zy50b29sQmFyTG9jYXRpb24nKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVNjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTGF5b3V0U2V0dGluZ3MuRURJVE9SX1RBQlNfTU9ERSkgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihMYXlvdXRTZXR0aW5ncy5DT01NQU5EX0NFTlRFUikpIHtcblx0XHRcdFx0dGhpcy5feVJhbmdlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLnNldENvb3JkaW5hdGVzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZGVidWdUb29sQmFyTWVudS5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnVwZGF0ZVNjaGVkdWxlci5zY2hlZHVsZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5hY3Rpb25CYXIuYWN0aW9uUnVubmVyLm9uRGlkUnVuKChlOiBJUnVuRXZlbnQpID0+IHtcblx0XHRcdC8vIGNoZWNrIGZvciBlcnJvclxuXHRcdFx0aWYgKGUuZXJyb3IgJiYgIWVycm9ycy5pc0NhbmNlbGxhdGlvbkVycm9yKGUuZXJyb3IpKSB7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS53YXJuKGUuZXJyb3IpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBsb2cgaW4gdGVsZW1ldHJ5XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiBlLmFjdGlvbi5pZCwgZnJvbTogJ2RlYnVnQWN0aW9uc1dpZGdldCcgfSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVHZW5lcmljTW91c2VVcExpc3RlbmVyKHRoaXMuZHJhZ0FyZWEsIChldmVudDogTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgbW91c2VDbGlja0V2ZW50ID0gbmV3IFN0YW5kYXJkTW91c2VFdmVudChkb20uZ2V0V2luZG93KHRoaXMuZHJhZ0FyZWEpLCBldmVudCk7XG5cdFx0XHRpZiAobW91c2VDbGlja0V2ZW50LmRldGFpbCA9PT0gMikge1xuXHRcdFx0XHQvLyBkb3VibGUgY2xpY2sgb24gZGVidWcgYmFyIGNlbnRlcnMgaXQgYWdhaW4gIzgyNTBcblx0XHRcdFx0dGhpcy5zZXRDb29yZGluYXRlcygwLjUsIHRoaXMueURlZmF1bHQpO1xuXHRcdFx0XHR0aGlzLnN0b3JlUG9zaXRpb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUdlbmVyaWNNb3VzZURvd25MaXN0ZW5lcih0aGlzLmRyYWdBcmVhLCAoZTogTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0dGhpcy5kcmFnQXJlYS5jbGFzc0xpc3QuYWRkKCdkcmFnZ2VkJyk7XG5cdFx0XHRjb25zdCBhY3RpdmVXaW5kb3cgPSBkb20uZ2V0V2luZG93KHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXIpO1xuXHRcdFx0Y29uc3Qgb3JpZ2luRXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KGFjdGl2ZVdpbmRvdywgZSk7XG5cblx0XHRcdGNvbnN0IG9yaWdpblggPSB0aGlzLmNvbXB1dGVDdXJyZW50WFBlcmNlbnQoKTtcblx0XHRcdGNvbnN0IG9yaWdpblkgPSB0aGlzLmdldEN1cnJlbnRZUG9zaXRpb24oKTtcblxuXHRcdFx0Y29uc3QgbW91c2VNb3ZlTGlzdGVuZXIgPSBkb20uYWRkRGlzcG9zYWJsZUdlbmVyaWNNb3VzZU1vdmVMaXN0ZW5lcihhY3RpdmVXaW5kb3csIChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1vdXNlTW92ZUV2ZW50ID0gbmV3IFN0YW5kYXJkTW91c2VFdmVudChhY3RpdmVXaW5kb3csIGUpO1xuXHRcdFx0XHQvLyBQcmV2ZW50IGRlZmF1bHQgdG8gc3RvcCBlZGl0b3Igc2VsZWN0aW5nIHRleHQgIzg1MjRcblx0XHRcdFx0bW91c2VNb3ZlRXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dGhpcy5zZXRDb29yZGluYXRlcyhcblx0XHRcdFx0XHRvcmlnaW5YICsgKG1vdXNlTW92ZUV2ZW50LnBvc3ggLSBvcmlnaW5FdmVudC5wb3N4KSAvIGFjdGl2ZVdpbmRvdy5pbm5lcldpZHRoLFxuXHRcdFx0XHRcdG9yaWdpblkgKyBtb3VzZU1vdmVFdmVudC5wb3N5IC0gb3JpZ2luRXZlbnQucG9zeSxcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBtb3VzZVVwTGlzdGVuZXIgPSBkb20uYWRkRGlzcG9zYWJsZUdlbmVyaWNNb3VzZVVwTGlzdGVuZXIoYWN0aXZlV2luZG93LCAoZTogTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0XHR0aGlzLnN0b3JlUG9zaXRpb24oKTtcblx0XHRcdFx0dGhpcy5kcmFnQXJlYS5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnZ2VkJyk7XG5cblx0XHRcdFx0bW91c2VNb3ZlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRtb3VzZVVwTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5sYXlvdXRTZXJ2aWNlLm9uRGlkQ2hhbmdlUGFydFZpc2liaWxpdHkoKCkgPT4gdGhpcy5zZXRDb29yZGluYXRlcygpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxheW91dFNlcnZpY2Uub25EaWRDaGFuZ2VBY3RpdmVDb250YWluZXIoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5feVJhbmdlID0gdW5kZWZpbmVkO1xuXG5cdFx0XHQvLyBub3RlOiB3ZSBpbnRlbnRpb25hbGx5IGRvbid0IGtlZXAgdGhlIGFjdGl2ZUNvbnRhaW5lciBiZWZvcmUgdGhlXG5cdFx0XHQvLyBgYXdhaXRgIGNsYXVzZSB0byBhdm9pZCBhbnkgcmFjZXMgZHVlIHRvIHF1aWNrbHkgc3dpdGNoaW5nIHdpbmRvd3MuXG5cdFx0XHRhd2FpdCB0aGlzLmxheW91dFNlcnZpY2Uud2hlbkNvbnRhaW5lclN0eWxlc0xvYWRlZChkb20uZ2V0V2luZG93KHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXIpKTtcblx0XHRcdGlmICh0aGlzLmlzQnVpbHQpIHtcblx0XHRcdFx0dGhpcy5kb1Nob3dJbkFjdGl2ZUNvbnRhaW5lcigpO1xuXHRcdFx0XHR0aGlzLnNldENvb3JkaW5hdGVzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbXB1dGVzIHRoZSB4IHBlcmNlbnQgcG9zaXRpb24gYXQgd2hpY2ggdGhlIHRvb2xiYXIgaXMgY3VycmVudGx5IGRpc3BsYXllZC5cblx0ICovXG5cdHByaXZhdGUgY29tcHV0ZUN1cnJlbnRYUGVyY2VudCgpOiBudW1iZXIge1xuXHRcdGNvbnN0IHsgbGVmdCwgd2lkdGggfSA9IHRoaXMuJGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdHJldHVybiAobGVmdCArIHdpZHRoIC8gMikgLyBkb20uZ2V0V2luZG93KHRoaXMuJGVsKS5pbm5lcldpZHRoO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIHggcG9zaXRpb24gc2V0IGluIHRoZSBzdHlsZSBvZiB0aGUgdG9vbGJhci4gVGhpcyBtYXkgbm90IGJlIGl0c1xuXHQgKiBhY3R1YWwgcG9zaXRpb24gb24gc2NyZWVuIGRlcGVuZGluZyBvbiB0b29sYmFyIGxvY2F0aW9ucy5cblx0ICovXG5cdHByaXZhdGUgZ2V0Q3VycmVudFhQZXJjZW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIE51bWJlcih0aGlzLiRlbC5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCctLXgtcG9zaXRpb24nKSk7XG5cdH1cblxuXHQvKiogR2V0cyB0aGUgeSBwb3NpdGlvbiBzZXQgaW4gdGhlIHN0eWxlIG9mIHRoZSB0b29sYmFyICovXG5cdHByaXZhdGUgZ2V0Q3VycmVudFlQb3NpdGlvbigpOiBudW1iZXIge1xuXHRcdHJldHVybiBwYXJzZUludCh0aGlzLiRlbC5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCctLXktcG9zaXRpb24nKSk7XG5cdH1cblxuXHRwcml2YXRlIHN0b3JlUG9zaXRpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gZG9tLmdldFdpbmRvdyh0aGlzLmxheW91dFNlcnZpY2UuYWN0aXZlQ29udGFpbmVyKTtcblx0XHRjb25zdCBpc01haW5XaW5kb3cgPSB0aGlzLmxheW91dFNlcnZpY2UuYWN0aXZlQ29udGFpbmVyID09PSB0aGlzLmxheW91dFNlcnZpY2UubWFpbkNvbnRhaW5lcjtcblxuXHRcdGNvbnN0IHggPSB0aGlzLmdldEN1cnJlbnRYUGVyY2VudCgpO1xuXHRcdGNvbnN0IHkgPSB0aGlzLmdldEN1cnJlbnRZUG9zaXRpb24oKTtcblx0XHRpZiAoaXNNYWluV2luZG93KSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKERFQlVHX1RPT0xCQVJfUE9TSVRJT05fS0VZLCB4LCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoREVCVUdfVE9PTEJBUl9ZX0tFWSwgeSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuYXV4V2luZG93Q29vcmRpbmF0ZXMuc2V0KGFjdGl2ZVdpbmRvdywgeyB4LCB5IH0pO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZVN0eWxlcygpOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVTdHlsZXMoKTtcblxuXHRcdGlmICh0aGlzLiRlbCkge1xuXHRcdFx0dGhpcy4kZWwuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdGhpcy5nZXRDb2xvcihkZWJ1Z1Rvb2xCYXJCYWNrZ3JvdW5kKSB8fCAnJztcblxuXHRcdFx0Y29uc3Qgd2lkZ2V0U2hhZG93Q29sb3IgPSB0aGlzLmdldENvbG9yKHdpZGdldFNoYWRvdyk7XG5cdFx0XHR0aGlzLiRlbC5zdHlsZS5ib3hTaGFkb3cgPSB3aWRnZXRTaGFkb3dDb2xvciA/IGAwIDAgOHB4IDJweCAke3dpZGdldFNoYWRvd0NvbG9yfWAgOiAnJztcblxuXHRcdFx0Y29uc3QgY29udHJhc3RCb3JkZXJDb2xvciA9IHRoaXMuZ2V0Q29sb3Iod2lkZ2V0Qm9yZGVyKTtcblx0XHRcdGNvbnN0IGJvcmRlckNvbG9yID0gdGhpcy5nZXRDb2xvcihkZWJ1Z1Rvb2xCYXJCb3JkZXIpO1xuXG5cdFx0XHRpZiAoY29udHJhc3RCb3JkZXJDb2xvcikge1xuXHRcdFx0XHR0aGlzLiRlbC5zdHlsZS5ib3JkZXIgPSBgMXB4IHNvbGlkICR7Y29udHJhc3RCb3JkZXJDb2xvcn1gO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy4kZWwuc3R5bGUuYm9yZGVyID0gYm9yZGVyQ29sb3IgPyBgc29saWQgJHtib3JkZXJDb2xvcn1gIDogJ25vbmUnO1xuXHRcdFx0XHR0aGlzLiRlbC5zdHlsZS5ib3JkZXIgPSAnMXB4IDAnO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKiBHZXRzIHRoZSBzdG9yZWQgWCBwb3NpdGlvbiBvZiB0aGUgbWlkZGxlIG9mIHRoZSB0b29sYmFyIGJhc2VkIG9uIHRoZSBjdXJyZW50IHdpbmRvdyB3aWR0aCAqL1xuXHRwcml2YXRlIGdldFN0b3JlZFhQb3NpdGlvbigpIHtcblx0XHRjb25zdCBjdXJyZW50V2luZG93ID0gZG9tLmdldFdpbmRvdyh0aGlzLmxheW91dFNlcnZpY2UuYWN0aXZlQ29udGFpbmVyKTtcblx0XHRjb25zdCBpc01haW5XaW5kb3cgPSBjdXJyZW50V2luZG93ID09PSBtYWluV2luZG93O1xuXHRcdGNvbnN0IHN0b3JlZFBlcmNlbnRhZ2UgPSBpc01haW5XaW5kb3dcblx0XHRcdD8gTnVtYmVyKHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KERFQlVHX1RPT0xCQVJfUE9TSVRJT05fS0VZLCBTdG9yYWdlU2NvcGUuUFJPRklMRSkpXG5cdFx0XHQ6IHRoaXMuYXV4V2luZG93Q29vcmRpbmF0ZXMuZ2V0KGN1cnJlbnRXaW5kb3cpPy54O1xuXHRcdHJldHVybiBzdG9yZWRQZXJjZW50YWdlICE9PSB1bmRlZmluZWQgJiYgIWlzTmFOKHN0b3JlZFBlcmNlbnRhZ2UpID8gc3RvcmVkUGVyY2VudGFnZSA6IDAuNTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U3RvcmVkWVBvc2l0aW9uKCkge1xuXHRcdGNvbnN0IGN1cnJlbnRXaW5kb3cgPSBkb20uZ2V0V2luZG93KHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXIpO1xuXHRcdGNvbnN0IGlzTWFpbldpbmRvdyA9IGN1cnJlbnRXaW5kb3cgPT09IG1haW5XaW5kb3c7XG5cdFx0Y29uc3Qgc3RvcmVkWSA9IGlzTWFpbldpbmRvd1xuXHRcdFx0PyB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE51bWJlcihERUJVR19UT09MQkFSX1lfS0VZLCBTdG9yYWdlU2NvcGUuUFJPRklMRSlcblx0XHRcdDogdGhpcy5hdXhXaW5kb3dDb29yZGluYXRlcy5nZXQoY3VycmVudFdpbmRvdyk/Lnk7XG5cdFx0cmV0dXJuIHN0b3JlZFkgPz8gdGhpcy55RGVmYXVsdDtcblx0fVxuXG5cdHByaXZhdGUgc2V0Q29vcmRpbmF0ZXMoeD86IG51bWJlciwgeT86IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5pc1Zpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR4ID8/PSB0aGlzLmdldFN0b3JlZFhQb3NpdGlvbigpO1xuXHRcdHkgPz89IHRoaXMuZ2V0U3RvcmVkWVBvc2l0aW9uKCk7XG5cblx0XHRjb25zdCBbeU1pbiwgeU1heF0gPSB0aGlzLnlSYW5nZTtcblx0XHR5ID0gTWF0aC5tYXgoeU1pbiwgTWF0aC5taW4oeSwgeU1heCkpO1xuXHRcdHRoaXMuJGVsLnN0eWxlLnNldFByb3BlcnR5KCctLXgtcG9zaXRpb24nLCBgJHt4fWApO1xuXHRcdHRoaXMuJGVsLnN0eWxlLnNldFByb3BlcnR5KCctLXktcG9zaXRpb24nLCBgJHt5fXB4YCk7XG5cdH1cblxuXHRwcml2YXRlIGdldCB5RGVmYXVsdCgpIHtcblx0XHRyZXR1cm4gdGhpcy5sYXlvdXRTZXJ2aWNlLm1haW5Db250YWluZXJPZmZzZXQudG9wO1xuXHR9XG5cblx0cHJpdmF0ZSBfeVJhbmdlOiBbbnVtYmVyLCBudW1iZXJdIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCB5UmFuZ2UoKTogW251bWJlciwgbnVtYmVyXSB7XG5cdFx0aWYgKCF0aGlzLl95UmFuZ2UpIHtcblx0XHRcdGNvbnN0IGlzVGl0bGVCYXJWaXNpYmxlID0gdGhpcy5sYXlvdXRTZXJ2aWNlLmlzVmlzaWJsZShQYXJ0cy5USVRMRUJBUl9QQVJULCBkb20uZ2V0V2luZG93KHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXIpKTtcblx0XHRcdGNvbnN0IHlNaW4gPSBpc1RpdGxlQmFyVmlzaWJsZSA/IDAgOiB0aGlzLmxheW91dFNlcnZpY2UubWFpbkNvbnRhaW5lck9mZnNldC50b3A7XG5cdFx0XHRsZXQgeU1heCA9IDA7XG5cblx0XHRcdGlmIChpc1RpdGxlQmFyVmlzaWJsZSkge1xuXHRcdFx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShMYXlvdXRTZXR0aW5ncy5DT01NQU5EX0NFTlRFUikgPT09IHRydWUpIHtcblx0XHRcdFx0XHR5TWF4ICs9IDM1O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHlNYXggKz0gMjg7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoTGF5b3V0U2V0dGluZ3MuRURJVE9SX1RBQlNfTU9ERSkgIT09IEVkaXRvclRhYnNNb2RlLk5PTkUpIHtcblx0XHRcdFx0eU1heCArPSAzNTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3lSYW5nZSA9IFt5TWluLCB5TWF4XTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3lSYW5nZTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pc1Zpc2libGUpIHtcblx0XHRcdHRoaXMuc2V0Q29vcmRpbmF0ZXMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLmlzQnVpbHQpIHtcblx0XHRcdHRoaXMuaXNCdWlsdCA9IHRydWU7XG5cdFx0XHR0aGlzLmRvU2hvd0luQWN0aXZlQ29udGFpbmVyKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5pc1Zpc2libGUgPSB0cnVlO1xuXHRcdGRvbS5zaG93KHRoaXMuJGVsKTtcblx0XHR0aGlzLnNldENvb3JkaW5hdGVzKCk7XG5cdH1cblxuXHRwcml2YXRlIGRvU2hvd0luQWN0aXZlQ29udGFpbmVyKCk6IHZvaWQge1xuXHRcdHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy4kZWwpO1xuXHRcdHRoaXMudHJhY2tQaXhlbFJhdGlvTGlzdGVuZXIudmFsdWUgPSBQaXhlbFJhdGlvLmdldEluc3RhbmNlKGRvbS5nZXRXaW5kb3codGhpcy4kZWwpKS5vbkRpZENoYW5nZShcblx0XHRcdCgpID0+IHRoaXMuc2V0Q29vcmRpbmF0ZXMoKVxuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIGhpZGUoKTogdm9pZCB7XG5cdFx0dGhpcy5pc1Zpc2libGUgPSBmYWxzZTtcblx0XHRkb20uaGlkZSh0aGlzLiRlbCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuJGVsPy5yZW1vdmUoKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRGlzY29ubmVjdE1lbnVJdGVtQWN0aW9uKGFjdGlvbjogTWVudUl0ZW1BY3Rpb24sIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUsIGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBvcHRpb25zOiBJRHJvcGRvd25XaXRoUHJpbWFyeUFjdGlvblZpZXdJdGVtT3B0aW9ucyk6IElBY3Rpb25WaWV3SXRlbSB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IG1lbnVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElNZW51U2VydmljZSk7XG5cdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cblx0Y29uc3QgbWVudSA9IG1lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKE1lbnVJZC5EZWJ1Z1Rvb2xCYXJTdG9wLCBjb250ZXh0S2V5U2VydmljZSwgeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KTtcblx0Y29uc3Qgc2Vjb25kYXJ5ID0gZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnMobWVudSk7XG5cblx0aWYgKCFzZWNvbmRhcnkubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGNvbnN0IGRyb3Bkb3duQWN0aW9uID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBBY3Rpb24oJ25vdGVib29rLm1vcmVSdW5BY3Rpb25zJywgbG9jYWxpemUoJ25vdGVib29rLm1vcmVSdW5BY3Rpb25zTGFiZWwnLCBcIk1vcmUuLi5cIiksICdjb2RpY29uLWNoZXZyb24tZG93bicsIHRydWUpKTtcblx0Y29uc3QgaXRlbSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERyb3Bkb3duV2l0aFByaW1hcnlBY3Rpb25WaWV3SXRlbSxcblx0XHRhY3Rpb24gYXMgTWVudUl0ZW1BY3Rpb24sXG5cdFx0ZHJvcGRvd25BY3Rpb24sXG5cdFx0c2Vjb25kYXJ5LFxuXHRcdCdkZWJ1Zy1zdG9wLWFjdGlvbnMnLFxuXHRcdG9wdGlvbnMpO1xuXHRyZXR1cm4gaXRlbTtcbn1cblxuLy8gRGVidWcgdG9vbGJhclxuXG5jb25zdCBkZWJ1Z1ZpZXdUaXRsZUl0ZW1zOiBJRGlzcG9zYWJsZVtdID0gW107XG5jb25zdCByZWdpc3RlckRlYnVnVG9vbEJhckl0ZW0gPSAoaWQ6IHN0cmluZywgdGl0bGU6IHN0cmluZyB8IElDb21tYW5kQWN0aW9uVGl0bGUsIG9yZGVyOiBudW1iZXIsIGljb24/OiB7IGxpZ2h0PzogVVJJOyBkYXJrPzogVVJJIH0gfCBUaGVtZUljb24sIHdoZW4/OiBDb250ZXh0S2V5RXhwcmVzc2lvbiwgcHJlY29uZGl0aW9uPzogQ29udGV4dEtleUV4cHJlc3Npb24sIGFsdD86IElDb21tYW5kQWN0aW9uKSA9PiB7XG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRGVidWdUb29sQmFyLCB7XG5cdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHR3aGVuLFxuXHRcdG9yZGVyLFxuXHRcdGNvbW1hbmQ6IHtcblx0XHRcdGlkLFxuXHRcdFx0dGl0bGUsXG5cdFx0XHRpY29uLFxuXHRcdFx0cHJlY29uZGl0aW9uXG5cdFx0fSxcblx0XHRhbHRcblx0fSk7XG5cblx0Ly8gUmVnaXN0ZXIgYWN0aW9ucyBpbiBkZWJ1ZyB2aWV3bGV0IHdoZW4gdG9vbGJhciBpcyBkb2NrZWRcblx0ZGVidWdWaWV3VGl0bGVJdGVtcy5wdXNoKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVmlld0NvbnRhaW5lclRpdGxlLCB7XG5cdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQod2hlbiwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3Q29udGFpbmVyJywgVklFV0xFVF9JRCksIENPTlRFWFRfREVCVUdfU1RBVEUubm90RXF1YWxzVG8oJ2luYWN0aXZlJyksIENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLmRlYnVnLnRvb2xCYXJMb2NhdGlvbicsICdkb2NrZWQnKSksXG5cdFx0b3JkZXIsXG5cdFx0Y29tbWFuZDoge1xuXHRcdFx0aWQsXG5cdFx0XHR0aXRsZSxcblx0XHRcdGljb24sXG5cdFx0XHRwcmVjb25kaXRpb25cblx0XHR9XG5cdH0pKTtcbn07XG5cbm1hcmtBc1NpbmdsZXRvbihNZW51UmVnaXN0cnkub25EaWRDaGFuZ2VNZW51KGUgPT4ge1xuXHQvLyBJbiBjYXNlIHRoZSBkZWJ1ZyB0b29sYmFyIGlzIGRvY2tlZCB3ZSBuZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSBkb2NrZWQgdG9vbGJhciBoYXMgdGhlIHVwIHRvIGRhdGUgY29tbWFuZHMgcmVnaXN0ZXJlZCAjMTE1OTQ1XG5cdGlmIChlLmhhcyhNZW51SWQuRGVidWdUb29sQmFyKSkge1xuXHRcdGRpc3Bvc2UoZGVidWdWaWV3VGl0bGVJdGVtcyk7XG5cdFx0Y29uc3QgaXRlbXMgPSBNZW51UmVnaXN0cnkuZ2V0TWVudUl0ZW1zKE1lbnVJZC5EZWJ1Z1Rvb2xCYXIpO1xuXHRcdGZvciAoY29uc3QgaSBvZiBpdGVtcykge1xuXHRcdFx0ZGVidWdWaWV3VGl0bGVJdGVtcy5wdXNoKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVmlld0NvbnRhaW5lclRpdGxlLCB7XG5cdFx0XHRcdC4uLmksXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChpLndoZW4sIENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lcicsIFZJRVdMRVRfSUQpLCBDT05URVhUX0RFQlVHX1NUQVRFLm5vdEVxdWFsc1RvKCdpbmFjdGl2ZScpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy5kZWJ1Zy50b29sQmFyTG9jYXRpb24nLCAnZG9ja2VkJykpXG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG59KSk7XG5cblxuY29uc3QgQ09OVEVYVF9UT09MQkFSX0NPTU1BTkRfQ0VOVEVSID0gQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcuZGVidWcudG9vbEJhckxvY2F0aW9uJywgJ2NvbW1hbmRDZW50ZXInKTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kQ2VudGVyQ2VudGVyLCB7XG5cdHN1Ym1lbnU6IE1lbnVJZC5EZWJ1Z1Rvb2xCYXIsXG5cdHRpdGxlOiAnRGVidWcnLFxuXHRpY29uOiBDb2RpY29uLmRlYnVnLFxuXHRvcmRlcjogMSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfSU5fREVCVUdfTU9ERSwgQ09OVEVYVF9UT09MQkFSX0NPTU1BTkRfQ0VOVEVSKVxufSk7XG5cbnJlZ2lzdGVyRGVidWdUb29sQmFySXRlbShDT05USU5VRV9JRCwgQ09OVElOVUVfTEFCRUwsIDEwLCBpY29ucy5kZWJ1Z0NvbnRpbnVlLCBDT05URVhUX0RFQlVHX1NUQVRFLmlzRXF1YWxUbygnc3RvcHBlZCcpKTtcbnJlZ2lzdGVyRGVidWdUb29sQmFySXRlbShQQVVTRV9JRCwgUEFVU0VfTEFCRUwsIDEwLCBpY29ucy5kZWJ1Z1BhdXNlLCBDT05URVhUX0RFQlVHX1NUQVRFLm5vdEVxdWFsc1RvKCdzdG9wcGVkJyksIENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0RFQlVHX1NUQVRFLmlzRXF1YWxUbygncnVubmluZycpLCBDT05URVhUX0ZPQ1VTRURfU0VTU0lPTl9JU19OT19ERUJVRy50b05lZ2F0ZWQoKSkpO1xucmVnaXN0ZXJEZWJ1Z1Rvb2xCYXJJdGVtKFNUT1BfSUQsIFNUT1BfTEFCRUwsIDcwLCBpY29ucy5kZWJ1Z1N0b3AsIENPTlRFWFRfRk9DVVNFRF9TRVNTSU9OX0lTX0FUVEFDSC50b05lZ2F0ZWQoKSwgdW5kZWZpbmVkLCB7IGlkOiBESVNDT05ORUNUX0lELCB0aXRsZTogRElTQ09OTkVDVF9MQUJFTCwgaWNvbjogaWNvbnMuZGVidWdEaXNjb25uZWN0LCBwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0ZPQ1VTRURfU0VTU0lPTl9JU19BVFRBQ0gudG9OZWdhdGVkKCksIENPTlRFWFRfVEVSTUlOQVRFX0RFQlVHR0VFX1NVUFBPUlRFRCksIH0pO1xucmVnaXN0ZXJEZWJ1Z1Rvb2xCYXJJdGVtKERJU0NPTk5FQ1RfSUQsIERJU0NPTk5FQ1RfTEFCRUwsIDcwLCBpY29ucy5kZWJ1Z0Rpc2Nvbm5lY3QsIENPTlRFWFRfRk9DVVNFRF9TRVNTSU9OX0lTX0FUVEFDSCwgdW5kZWZpbmVkLCB7IGlkOiBTVE9QX0lELCB0aXRsZTogU1RPUF9MQUJFTCwgaWNvbjogaWNvbnMuZGVidWdTdG9wLCBwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0ZPQ1VTRURfU0VTU0lPTl9JU19BVFRBQ0gsIENPTlRFWFRfVEVSTUlOQVRFX0RFQlVHR0VFX1NVUFBPUlRFRCksIH0pO1xucmVnaXN0ZXJEZWJ1Z1Rvb2xCYXJJdGVtKFNURVBfT1ZFUl9JRCwgU1RFUF9PVkVSX0xBQkVMLCAyMCwgaWNvbnMuZGVidWdTdGVwT3ZlciwgdW5kZWZpbmVkLCBDT05URVhUX0RFQlVHX1NUQVRFLmlzRXF1YWxUbygnc3RvcHBlZCcpKTtcbnJlZ2lzdGVyRGVidWdUb29sQmFySXRlbShTVEVQX0lOVE9fSUQsIFNURVBfSU5UT19MQUJFTCwgMzAsIGljb25zLmRlYnVnU3RlcEludG8sIHVuZGVmaW5lZCwgQ09OVEVYVF9ERUJVR19TVEFURS5pc0VxdWFsVG8oJ3N0b3BwZWQnKSk7XG5yZWdpc3RlckRlYnVnVG9vbEJhckl0ZW0oU1RFUF9PVVRfSUQsIFNURVBfT1VUX0xBQkVMLCA0MCwgaWNvbnMuZGVidWdTdGVwT3V0LCB1bmRlZmluZWQsIENPTlRFWFRfREVCVUdfU1RBVEUuaXNFcXVhbFRvKCdzdG9wcGVkJykpO1xucmVnaXN0ZXJEZWJ1Z1Rvb2xCYXJJdGVtKFJFU1RBUlRfU0VTU0lPTl9JRCwgUkVTVEFSVF9MQUJFTCwgNjAsIGljb25zLmRlYnVnUmVzdGFydCk7XG5yZWdpc3RlckRlYnVnVG9vbEJhckl0ZW0oU1RFUF9CQUNLX0lELCBsb2NhbGl6ZSgnc3RlcEJhY2tEZWJ1ZycsIFwiU3RlcCBCYWNrXCIpLCA1MCwgaWNvbnMuZGVidWdTdGVwQmFjaywgQ09OVEVYVF9TVEVQX0JBQ0tfU1VQUE9SVEVELCBDT05URVhUX0RFQlVHX1NUQVRFLmlzRXF1YWxUbygnc3RvcHBlZCcpKTtcbnJlZ2lzdGVyRGVidWdUb29sQmFySXRlbShSRVZFUlNFX0NPTlRJTlVFX0lELCBsb2NhbGl6ZSgncmV2ZXJzZUNvbnRpbnVlJywgXCJSZXZlcnNlXCIpLCA1NSwgaWNvbnMuZGVidWdSZXZlcnNlQ29udGludWUsIENPTlRFWFRfU1RFUF9CQUNLX1NVUFBPUlRFRCwgQ09OVEVYVF9ERUJVR19TVEFURS5pc0VxdWFsVG8oJ3N0b3BwZWQnKSk7XG5yZWdpc3RlckRlYnVnVG9vbEJhckl0ZW0oRk9DVVNfU0VTU0lPTl9JRCwgRk9DVVNfU0VTU0lPTl9MQUJFTCwgMTAwLCBDb2RpY29uLmxpc3RUcmVlLCBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9NVUxUSV9TRVNTSU9OX0RFQlVHLCBDT05URVhUX1RPT0xCQVJfQ09NTUFORF9DRU5URVIubmVnYXRlKCkpKTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5EZWJ1Z1Rvb2xCYXJTdG9wLCB7XG5cdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0ZPQ1VTRURfU0VTU0lPTl9JU19BVFRBQ0gudG9OZWdhdGVkKCksIENPTlRFWFRfVEVSTUlOQVRFX0RFQlVHR0VFX1NVUFBPUlRFRCksXG5cdG9yZGVyOiAwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IERJU0NPTk5FQ1RfSUQsXG5cdFx0dGl0bGU6IERJU0NPTk5FQ1RfTEFCRUwsXG5cdFx0aWNvbjogaWNvbnMuZGVidWdEaXNjb25uZWN0XG5cdH1cbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkRlYnVnVG9vbEJhclN0b3AsIHtcblx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfRk9DVVNFRF9TRVNTSU9OX0lTX0FUVEFDSCwgQ09OVEVYVF9URVJNSU5BVEVfREVCVUdHRUVfU1VQUE9SVEVEKSxcblx0b3JkZXI6IDAsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogU1RPUF9JRCxcblx0XHR0aXRsZTogU1RPUF9MQUJFTCxcblx0XHRpY29uOiBpY29ucy5kZWJ1Z1N0b3Bcblx0fVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRGVidWdUb29sQmFyU3RvcCwge1xuXHRncm91cDogJ25hdmlnYXRpb24nLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihcblx0XHRDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9GT0NVU0VEX1NFU1NJT05fSVNfQVRUQUNILnRvTmVnYXRlZCgpLCBDT05URVhUX1NVU1BFTkRfREVCVUdHRUVfU1VQUE9SVEVELCBDT05URVhUX1RFUk1JTkFURV9ERUJVR0dFRV9TVVBQT1JURUQpLFxuXHRcdENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0ZPQ1VTRURfU0VTU0lPTl9JU19BVFRBQ0gsIENPTlRFWFRfU1VTUEVORF9ERUJVR0dFRV9TVVBQT1JURUQpLFxuXHQpLFxuXHRvcmRlcjogMCxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBESVNDT05ORUNUX0FORF9TVVNQRU5EX0lELFxuXHRcdHRpdGxlOiBESVNDT05ORUNUX0FORF9TVVNQRU5EX0xBQkVMLFxuXHRcdGljb246IGljb25zLmRlYnVnRGlzY29ubmVjdFxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBVywwQkFBMkM7QUFFL0QsU0FBcUIsa0JBQWtCO0FBQ3ZDLFNBQVMsY0FBdUc7QUFDaEgsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZUFBZTtBQUN4QixZQUFZLFlBQVk7QUFDeEIsU0FBUyxpQkFBaUIsU0FBc0IsaUJBQWlCLHlCQUF5QjtBQUMxRixTQUFTLFVBQVUsZ0JBQWdCO0FBQ25DLFNBQVMsaUJBQWlCO0FBRzFCLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMseUNBQW9GO0FBQzdGLFNBQVMsc0JBQXNCLCtCQUErQjtBQUM5RCxTQUFnQixjQUFjLFFBQXdCLG9CQUFvQjtBQUMxRSxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFzQywwQkFBMEI7QUFDekUsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw0QkFBNEI7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
