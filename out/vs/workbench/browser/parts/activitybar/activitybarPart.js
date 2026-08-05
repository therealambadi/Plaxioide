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
import "./media/activitybarpart.css";
import "./media/activityaction.css";
import { localize, localize2 } from "../../../../nls.js";
import { ActionsOrientation } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Part } from "../../part.js";
import { ActivityBarPosition, IWorkbenchLayoutService, LayoutSettings, Parts, Position } from "../../../services/layout/browser/layoutService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ToggleSidebarPositionAction, ToggleSidebarVisibilityAction } from "../../actions/layoutActions.js";
import { IThemeService, registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { ACTIVITY_BAR_BACKGROUND, ACTIVITY_BAR_BORDER, ACTIVITY_BAR_FOREGROUND, ACTIVITY_BAR_ACTIVE_BORDER, ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_INACTIVE_FOREGROUND, ACTIVITY_BAR_ACTIVE_BACKGROUND, ACTIVITY_BAR_DRAG_AND_DROP_BORDER, ACTIVITY_BAR_ACTIVE_FOCUS_BORDER } from "../../../common/theme.js";
import { activeContrastBorder, contrastBorder, focusBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { addDisposableListener, append, EventType, isAncestor, $, clearNode } from "../../../../base/browser/dom.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { CustomMenubarControl } from "../titlebar/menubarControl.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { getMenuBarVisibility } from "../../../../platform/window/common/window.js";
import { Separator, SubmenuAction, toAction } from "../../../../base/common/actions.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { PaneCompositeBar } from "../paneCompositeBar.js";
import { GlobalCompositeBar } from "../globalCompositeBar.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { Action2, IMenuService, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IViewDescriptorService, ViewContainerLocation, ViewContainerLocationToString } from "../../../common/views.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { SwitchCompositeViewAction } from "../compositeBarActions.js";
let ActivitybarPart = class extends Part {
  constructor(paneCompositePart, instantiationService, layoutService, themeService, storageService) {
    super(Parts.ACTIVITYBAR_PART, { hasTitle: false }, themeService, storageService, layoutService);
    this.paneCompositePart = paneCompositePart;
    this.instantiationService = instantiationService;
    //#region IView
    this.minimumWidth = 48;
    this.maximumWidth = 48;
    this.minimumHeight = 0;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    //#endregion
    this.compositeBar = this._register(new MutableDisposable());
  }
  createCompositeBar() {
    return this.instantiationService.createInstance(ActivityBarCompositeBar, {
      partContainerClass: "activitybar",
      pinnedViewContainersKey: ActivitybarPart.pinnedViewContainersKey,
      placeholderViewContainersKey: ActivitybarPart.placeholderViewContainersKey,
      viewContainersWorkspaceStateKey: ActivitybarPart.viewContainersWorkspaceStateKey,
      orientation: ActionsOrientation.VERTICAL,
      icon: true,
      iconSize: 24,
      activityHoverOptions: {
        position: () => this.layoutService.getSideBarPosition() === Position.LEFT ? HoverPosition.RIGHT : HoverPosition.LEFT
      },
      preventLoopNavigation: true,
      recomputeSizes: false,
      fillExtraContextMenuActions: (actions, e) => {
      },
      compositeSize: 52,
      colors: (theme) => ({
        activeForegroundColor: theme.getColor(ACTIVITY_BAR_FOREGROUND),
        inactiveForegroundColor: theme.getColor(ACTIVITY_BAR_INACTIVE_FOREGROUND),
        activeBorderColor: theme.getColor(ACTIVITY_BAR_ACTIVE_BORDER),
        activeBackground: theme.getColor(ACTIVITY_BAR_ACTIVE_BACKGROUND),
        badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
        badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
        dragAndDropBorder: theme.getColor(ACTIVITY_BAR_DRAG_AND_DROP_BORDER),
        activeBackgroundColor: void 0,
        inactiveBackgroundColor: void 0,
        activeBorderBottomColor: void 0
      }),
      overflowActionSize: ActivitybarPart.ACTION_HEIGHT
    }, Parts.ACTIVITYBAR_PART, this.paneCompositePart, true);
  }
  createContentArea(parent) {
    this.element = parent;
    this.content = append(this.element, $(".content"));
    if (this.layoutService.isVisible(Parts.ACTIVITYBAR_PART)) {
      this.show();
    }
    return this.content;
  }
  getPinnedPaneCompositeIds() {
    return this.compositeBar.value?.getPinnedPaneCompositeIds() ?? [];
  }
  getVisiblePaneCompositeIds() {
    return this.compositeBar.value?.getVisiblePaneCompositeIds() ?? [];
  }
  getPaneCompositeIds() {
    return this.compositeBar.value?.getPaneCompositeIds() ?? [];
  }
  focus() {
    this.compositeBar.value?.focus();
  }
  updateStyles() {
    super.updateStyles();
    const container = assertIsDefined(this.getContainer());
    const background = this.getColor(ACTIVITY_BAR_BACKGROUND) || "";
    container.style.backgroundColor = background;
    const borderColor = this.getColor(ACTIVITY_BAR_BORDER) || this.getColor(contrastBorder) || "";
    container.classList.toggle("bordered", !!borderColor);
    container.style.borderColor = borderColor ? borderColor : "";
  }
  show(focus) {
    if (!this.content) {
      return;
    }
    if (!this.compositeBar.value) {
      this.compositeBar.value = this.createCompositeBar();
      this.compositeBar.value.create(this.content);
      if (this.dimension) {
        this.layout(this.dimension.width, this.dimension.height);
      }
    }
    if (focus) {
      this.focus();
    }
  }
  hide() {
    if (!this.compositeBar.value) {
      return;
    }
    this.compositeBar.clear();
    if (this.content) {
      clearNode(this.content);
    }
  }
  layout(width, height) {
    super.layout(width, height, 0, 0);
    if (!this.compositeBar.value) {
      return;
    }
    const contentAreaSize = super.layoutContents(width, height).contentSize;
    this.compositeBar.value.layout(width, contentAreaSize.height);
  }
  toJSON() {
    return {
      type: Parts.ACTIVITYBAR_PART
    };
  }
};
ActivitybarPart.ACTION_HEIGHT = 48;
ActivitybarPart.pinnedViewContainersKey = "workbench.activity.pinnedViewlets2";
ActivitybarPart.placeholderViewContainersKey = "workbench.activity.placeholderViewlets";
ActivitybarPart.viewContainersWorkspaceStateKey = "workbench.activity.viewletsWorkspaceState";
ActivitybarPart = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWorkbenchLayoutService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IStorageService)
], ActivitybarPart);
let ActivityBarCompositeBar = class extends PaneCompositeBar {
  constructor(options, part, paneCompositePart, showGlobalActivities, instantiationService, storageService, extensionService, viewDescriptorService, viewService, contextKeyService, environmentService, configurationService, menuService, layoutService) {
    super({
      ...options,
      fillExtraContextMenuActions: (actions, e) => {
        options.fillExtraContextMenuActions(actions, e);
        this.fillContextMenuActions(actions, e);
      }
    }, part, paneCompositePart, instantiationService, storageService, extensionService, viewDescriptorService, viewService, contextKeyService, environmentService, layoutService);
    this.configurationService = configurationService;
    this.menuService = menuService;
    this.keyboardNavigationDisposables = this._register(new DisposableStore());
    if (showGlobalActivities) {
      this.globalCompositeBar = this._register(instantiationService.createInstance(GlobalCompositeBar, () => this.getContextMenuActions(), (theme) => this.options.colors(theme), this.options.activityHoverOptions));
    }
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("window.menuBarVisibility")) {
        if (getMenuBarVisibility(this.configurationService) === "compact") {
          this.installMenubar();
        } else {
          this.uninstallMenubar();
        }
      }
    }));
  }
  fillContextMenuActions(actions, e) {
    const menuBarVisibility = getMenuBarVisibility(this.configurationService);
    if (menuBarVisibility === "compact" || menuBarVisibility === "hidden" || menuBarVisibility === "toggle") {
      actions.unshift(...[toAction({ id: "toggleMenuVisibility", label: localize("menu", "Menu"), checked: menuBarVisibility === "compact", run: () => this.configurationService.updateValue("window.menuBarVisibility", menuBarVisibility === "compact" ? "toggle" : "compact") }), new Separator()]);
    }
    if (menuBarVisibility === "compact" && this.menuBarContainer && e?.target) {
      if (isAncestor(e.target, this.menuBarContainer)) {
        actions.unshift(...[toAction({ id: "hideCompactMenu", label: localize("hideMenu", "Hide Menu"), run: () => this.configurationService.updateValue("window.menuBarVisibility", "toggle") }), new Separator()]);
      }
    }
    if (this.globalCompositeBar) {
      actions.push(new Separator());
      actions.push(...this.globalCompositeBar.getContextMenuActions());
    }
    actions.push(new Separator());
    actions.push(...this.getActivityBarContextMenuActions());
  }
  uninstallMenubar() {
    if (this.menuBar) {
      this.menuBar.dispose();
      this.menuBar = void 0;
    }
    if (this.menuBarContainer) {
      this.menuBarContainer.remove();
      this.menuBarContainer = void 0;
    }
  }
  installMenubar() {
    if (this.menuBar) {
      return;
    }
    this.menuBarContainer = $(".menubar");
    const content = assertIsDefined(this.element);
    content.prepend(this.menuBarContainer);
    this.menuBar = this._register(this.instantiationService.createInstance(CustomMenubarControl));
    this.menuBar.create(this.menuBarContainer);
  }
  registerKeyboardNavigationListeners() {
    this.keyboardNavigationDisposables.clear();
    if (this.menuBarContainer) {
      this.keyboardNavigationDisposables.add(addDisposableListener(this.menuBarContainer, EventType.KEY_DOWN, (e) => {
        const kbEvent = new StandardKeyboardEvent(e);
        if (kbEvent.equals(KeyCode.DownArrow) || kbEvent.equals(KeyCode.RightArrow)) {
          this.focus();
        }
      }));
    }
    if (this.compositeBarContainer) {
      this.keyboardNavigationDisposables.add(addDisposableListener(this.compositeBarContainer, EventType.KEY_DOWN, (e) => {
        const kbEvent = new StandardKeyboardEvent(e);
        if (kbEvent.equals(KeyCode.DownArrow) || kbEvent.equals(KeyCode.RightArrow)) {
          this.globalCompositeBar?.focus();
        } else if (kbEvent.equals(KeyCode.UpArrow) || kbEvent.equals(KeyCode.LeftArrow)) {
          this.menuBar?.toggleFocus();
        }
      }));
    }
    if (this.globalCompositeBar) {
      this.keyboardNavigationDisposables.add(addDisposableListener(this.globalCompositeBar.element, EventType.KEY_DOWN, (e) => {
        const kbEvent = new StandardKeyboardEvent(e);
        if (kbEvent.equals(KeyCode.UpArrow) || kbEvent.equals(KeyCode.LeftArrow)) {
          this.focus(this.getVisiblePaneCompositeIds().length - 1);
        }
      }));
    }
  }
  create(parent) {
    this.element = parent;
    if (getMenuBarVisibility(this.configurationService) === "compact") {
      this.installMenubar();
    }
    this.compositeBarContainer = super.create(this.element);
    if (this.globalCompositeBar) {
      this.globalCompositeBar.create(this.element);
    }
    this.registerKeyboardNavigationListeners();
    return this.compositeBarContainer;
  }
  layout(width, height) {
    if (this.menuBarContainer) {
      if (this.options.orientation === ActionsOrientation.VERTICAL) {
        height -= this.menuBarContainer.clientHeight;
      } else {
        width -= this.menuBarContainer.clientWidth;
      }
    }
    if (this.globalCompositeBar) {
      if (this.options.orientation === ActionsOrientation.VERTICAL) {
        height -= this.globalCompositeBar.size() * ActivitybarPart.ACTION_HEIGHT;
      } else {
        width -= this.globalCompositeBar.element.clientWidth;
      }
    }
    super.layout(width, height);
  }
  getActivityBarContextMenuActions() {
    const actions = [
      toAction({ id: ToggleSidebarPositionAction.ID, label: ToggleSidebarPositionAction.getLabel(this.layoutService), run: () => this.instantiationService.invokeFunction((accessor) => new ToggleSidebarPositionAction().run(accessor)) })
    ];
    if (this.part === Parts.SIDEBAR_PART) {
      actions.push(toAction({ id: ToggleSidebarVisibilityAction.ID, label: ToggleSidebarVisibilityAction.LABEL, run: () => this.instantiationService.invokeFunction((accessor) => new ToggleSidebarVisibilityAction().run(accessor)) }));
    }
    return actions;
  }
};
ActivityBarCompositeBar = __decorateClass([
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, IViewDescriptorService),
  __decorateParam(8, IViewsService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IWorkbenchEnvironmentService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IMenuService),
  __decorateParam(13, IWorkbenchLayoutService)
], ActivityBarCompositeBar);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.activityBarLocation.default",
      title: {
        ...localize2("positionActivityBarDefault", "Move Activity Bar to Side"),
        mnemonicTitle: localize({ key: "miDefaultActivityBar", comment: ["&& denotes a mnemonic"] }, "&&Default")
      },
      shortTitle: localize("default", "Default"),
      category: Categories.View,
      toggled: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.DEFAULT),
      menu: [{
        id: MenuId.ActivityBarPositionMenu,
        order: 1
      }, {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.notEquals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.DEFAULT)
      }]
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, ActivityBarPosition.DEFAULT);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.activityBarLocation.top",
      title: {
        ...localize2("positionActivityBarTop", "Move Activity Bar to Top"),
        mnemonicTitle: localize({ key: "miTopActivityBar", comment: ["&& denotes a mnemonic"] }, "&&Top")
      },
      shortTitle: localize("top", "Top"),
      category: Categories.View,
      toggled: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.TOP),
      menu: [{
        id: MenuId.ActivityBarPositionMenu,
        order: 2
      }, {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.notEquals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.TOP)
      }]
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, ActivityBarPosition.TOP);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.activityBarLocation.bottom",
      title: {
        ...localize2("positionActivityBarBottom", "Move Activity Bar to Bottom"),
        mnemonicTitle: localize({ key: "miBottomActivityBar", comment: ["&& denotes a mnemonic"] }, "&&Bottom")
      },
      shortTitle: localize("bottom", "Bottom"),
      category: Categories.View,
      toggled: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.BOTTOM),
      menu: [{
        id: MenuId.ActivityBarPositionMenu,
        order: 3
      }, {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.notEquals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.BOTTOM)
      }]
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, ActivityBarPosition.BOTTOM);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.activityBarLocation.hide",
      title: {
        ...localize2("hideActivityBar", "Hide Activity Bar"),
        mnemonicTitle: localize({ key: "miHideActivityBar", comment: ["&& denotes a mnemonic"] }, "&&Hidden")
      },
      shortTitle: localize("hide", "Hidden"),
      category: Categories.View,
      toggled: ContextKeyExpr.equals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.HIDDEN),
      menu: [{
        id: MenuId.ActivityBarPositionMenu,
        order: 4
      }, {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.notEquals(`config.${LayoutSettings.ACTIVITY_BAR_LOCATION}`, ActivityBarPosition.HIDDEN)
      }]
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, ActivityBarPosition.HIDDEN);
  }
});
// Activity Bar Position menu removed for Plaxio (locked to top)
registerAction2(class extends SwitchCompositeViewAction {
  constructor() {
    super({
      id: "workbench.action.previousSideBarView",
      title: localize2("previousSideBarView", "Previous Primary Side Bar View"),
      category: Categories.View,
      f1: true
    }, ViewContainerLocation.Sidebar, -1);
  }
});
registerAction2(class extends SwitchCompositeViewAction {
  constructor() {
    super({
      id: "workbench.action.nextSideBarView",
      title: localize2("nextSideBarView", "Next Primary Side Bar View"),
      category: Categories.View,
      f1: true
    }, ViewContainerLocation.Sidebar, 1);
  }
});
registerAction2(
  class FocusActivityBarAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.focusActivityBar",
        title: localize2("focusActivityBar", "Focus Activity Bar"),
        category: Categories.View,
        f1: true
      });
    }
    async run(accessor) {
      const layoutService = accessor.get(IWorkbenchLayoutService);
      layoutService.focusPart(Parts.ACTIVITYBAR_PART);
    }
  }
);
registerThemingParticipant((theme, collector) => {
  const activityBarActiveBorderColor = theme.getColor(ACTIVITY_BAR_ACTIVE_BORDER);
  if (activityBarActiveBorderColor) {
    collector.addRule(`
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked .active-item-indicator:before {
				border-left-color: ${activityBarActiveBorderColor};
			}
		`);
  }
  const activityBarActiveFocusBorderColor = theme.getColor(ACTIVITY_BAR_ACTIVE_FOCUS_BORDER);
  if (activityBarActiveFocusBorderColor) {
    collector.addRule(`
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked:focus::before {
				visibility: hidden;
			}

			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked:focus .active-item-indicator:before {
				visibility: visible;
				border-left-color: ${activityBarActiveFocusBorderColor};
			}
		`);
  }
  const activityBarActiveBackgroundColor = theme.getColor(ACTIVITY_BAR_ACTIVE_BACKGROUND);
  if (activityBarActiveBackgroundColor) {
    collector.addRule(`
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked .active-item-indicator {
				z-index: 0;
				background-color: ${activityBarActiveBackgroundColor};
			}
		`);
  }
  const outline = theme.getColor(activeContrastBorder);
  if (outline) {
    collector.addRule(`
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item .action-label::before{
				padding: 6px;
			}

			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.active .action-label::before,
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.active:hover .action-label::before,
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked .action-label::before,
			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item.checked:hover .action-label::before {
				outline: 1px solid ${outline};
			}

			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item:hover .action-label::before {
				outline: 1px dashed ${outline};
			}

			.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item:focus .active-item-indicator:before {
				border-left-color: ${outline};
			}
		`);
  } else {
    const focusBorderColor = theme.getColor(focusBorder);
    if (focusBorderColor) {
      collector.addRule(`
				.monaco-workbench .activitybar > .content :not(.monaco-menu) > .monaco-action-bar .action-item:focus .active-item-indicator::before {
						border-left-color: ${focusBorderColor};
					}
				`);
    }
  }
});
export {
  ActivityBarCompositeBar,
  ActivitybarPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9hY3Rpdml0eWJhci9hY3Rpdml0eWJhclBhcnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvYWN0aXZpdHliYXJwYXJ0LmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvYWN0aXZpdHlhY3Rpb24uY3NzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uc09yaWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgUGFydCB9IGZyb20gJy4uLy4uL3BhcnQuanMnO1xuaW1wb3J0IHsgQWN0aXZpdHlCYXJQb3NpdGlvbiwgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIExheW91dFNldHRpbmdzLCBQYXJ0cywgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBUb2dnbGVTaWRlYmFyUG9zaXRpb25BY3Rpb24sIFRvZ2dsZVNpZGViYXJWaXNpYmlsaXR5QWN0aW9uIH0gZnJvbSAnLi4vLi4vYWN0aW9ucy9sYXlvdXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UsIElDb2xvclRoZW1lLCByZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQUNUSVZJVFlfQkFSX0JBQ0tHUk9VTkQsIEFDVElWSVRZX0JBUl9CT1JERVIsIEFDVElWSVRZX0JBUl9GT1JFR1JPVU5ELCBBQ1RJVklUWV9CQVJfQUNUSVZFX0JPUkRFUiwgQUNUSVZJVFlfQkFSX0JBREdFX0JBQ0tHUk9VTkQsIEFDVElWSVRZX0JBUl9CQURHRV9GT1JFR1JPVU5ELCBBQ1RJVklUWV9CQVJfSU5BQ1RJVkVfRk9SRUdST1VORCwgQUNUSVZJVFlfQkFSX0FDVElWRV9CQUNLR1JPVU5ELCBBQ1RJVklUWV9CQVJfRFJBR19BTkRfRFJPUF9CT1JERVIsIEFDVElWSVRZX0JBUl9BQ1RJVkVfRk9DVVNfQk9SREVSIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IGFjdGl2ZUNvbnRyYXN0Qm9yZGVyLCBjb250cmFzdEJvcmRlciwgZm9jdXNCb3JkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGFwcGVuZCwgRXZlbnRUeXBlLCBpc0FuY2VzdG9yLCAkLCBjbGVhck5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGFzc2VydElzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IEN1c3RvbU1lbnViYXJDb250cm9sIH0gZnJvbSAnLi4vdGl0bGViYXIvbWVudWJhckNvbnRyb2wuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRNZW51QmFyVmlzaWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IElBY3Rpb24sIFNlcGFyYXRvciwgU3VibWVudUFjdGlvbiwgdG9BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBIb3ZlclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IEdlc3R1cmVFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci90b3VjaC5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZVBhcnQgfSBmcm9tICcuLi9wYW5lQ29tcG9zaXRlUGFydC5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZUJhck9wdGlvbnMsIFBhbmVDb21wb3NpdGVCYXIgfSBmcm9tICcuLi9wYW5lQ29tcG9zaXRlQmFyLmpzJztcbmltcG9ydCB7IEdsb2JhbENvbXBvc2l0ZUJhciB9IGZyb20gJy4uL2dsb2JhbENvbXBvc2l0ZUJhci5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIElNZW51U2VydmljZSwgTWVudUlkLCBNZW51UmVnaXN0cnksIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBnZXRDb250ZXh0TWVudUFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLCBWaWV3Q29udGFpbmVyTG9jYXRpb25Ub1N0cmluZyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgU3dpdGNoQ29tcG9zaXRlVmlld0FjdGlvbiB9IGZyb20gJy4uL2NvbXBvc2l0ZUJhckFjdGlvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgQWN0aXZpdHliYXJQYXJ0IGV4dGVuZHMgUGFydCB7XG5cblx0c3RhdGljIHJlYWRvbmx5IEFDVElPTl9IRUlHSFQgPSA0ODtcblxuXHRzdGF0aWMgcmVhZG9ubHkgcGlubmVkVmlld0NvbnRhaW5lcnNLZXkgPSAnd29ya2JlbmNoLmFjdGl2aXR5LnBpbm5lZFZpZXdsZXRzMic7XG5cdHN0YXRpYyByZWFkb25seSBwbGFjZWhvbGRlclZpZXdDb250YWluZXJzS2V5ID0gJ3dvcmtiZW5jaC5hY3Rpdml0eS5wbGFjZWhvbGRlclZpZXdsZXRzJztcblx0c3RhdGljIHJlYWRvbmx5IHZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVLZXkgPSAnd29ya2JlbmNoLmFjdGl2aXR5LnZpZXdsZXRzV29ya3NwYWNlU3RhdGUnO1xuXG5cdC8vI3JlZ2lvbiBJVmlld1xuXG5cdHJlYWRvbmx5IG1pbmltdW1XaWR0aDogbnVtYmVyID0gNDg7XG5cdHJlYWRvbmx5IG1heGltdW1XaWR0aDogbnVtYmVyID0gNDg7XG5cdHJlYWRvbmx5IG1pbmltdW1IZWlnaHQ6IG51bWJlciA9IDA7XG5cdHJlYWRvbmx5IG1heGltdW1IZWlnaHQ6IG51bWJlciA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbXBvc2l0ZUJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxQYW5lQ29tcG9zaXRlQmFyPigpKTtcblx0cHJpdmF0ZSBjb250ZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHBhbmVDb21wb3NpdGVQYXJ0OiBJUGFuZUNvbXBvc2l0ZVBhcnQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFBhcnRzLkFDVElWSVRZQkFSX1BBUlQsIHsgaGFzVGl0bGU6IGZhbHNlIH0sIHRoZW1lU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIGxheW91dFNlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVDb21wb3NpdGVCYXIoKTogUGFuZUNvbXBvc2l0ZUJhciB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQWN0aXZpdHlCYXJDb21wb3NpdGVCYXIsIHtcblx0XHRcdHBhcnRDb250YWluZXJDbGFzczogJ2FjdGl2aXR5YmFyJyxcblx0XHRcdHBpbm5lZFZpZXdDb250YWluZXJzS2V5OiBBY3Rpdml0eWJhclBhcnQucGlubmVkVmlld0NvbnRhaW5lcnNLZXksXG5cdFx0XHRwbGFjZWhvbGRlclZpZXdDb250YWluZXJzS2V5OiBBY3Rpdml0eWJhclBhcnQucGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyc0tleSxcblx0XHRcdHZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVLZXk6IEFjdGl2aXR5YmFyUGFydC52aWV3Q29udGFpbmVyc1dvcmtzcGFjZVN0YXRlS2V5LFxuXHRcdFx0b3JpZW50YXRpb246IEFjdGlvbnNPcmllbnRhdGlvbi5WRVJUSUNBTCxcblx0XHRcdGljb246IHRydWUsXG5cdFx0XHRpY29uU2l6ZTogMjQsXG5cdFx0XHRhY3Rpdml0eUhvdmVyT3B0aW9uczoge1xuXHRcdFx0XHRwb3NpdGlvbjogKCkgPT4gdGhpcy5sYXlvdXRTZXJ2aWNlLmdldFNpZGVCYXJQb3NpdGlvbigpID09PSBQb3NpdGlvbi5MRUZUID8gSG92ZXJQb3NpdGlvbi5SSUdIVCA6IEhvdmVyUG9zaXRpb24uTEVGVCxcblx0XHRcdH0sXG5cdFx0XHRwcmV2ZW50TG9vcE5hdmlnYXRpb246IHRydWUsXG5cdFx0XHRyZWNvbXB1dGVTaXplczogZmFsc2UsXG5cdFx0XHRmaWxsRXh0cmFDb250ZXh0TWVudUFjdGlvbnM6IChhY3Rpb25zLCBlPzogTW91c2VFdmVudCB8IEdlc3R1cmVFdmVudCkgPT4geyB9LFxuXHRcdFx0Y29tcG9zaXRlU2l6ZTogNTIsXG5cdFx0XHRjb2xvcnM6ICh0aGVtZTogSUNvbG9yVGhlbWUpID0+ICh7XG5cdFx0XHRcdGFjdGl2ZUZvcmVncm91bmRDb2xvcjogdGhlbWUuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX0ZPUkVHUk9VTkQpLFxuXHRcdFx0XHRpbmFjdGl2ZUZvcmVncm91bmRDb2xvcjogdGhlbWUuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX0lOQUNUSVZFX0ZPUkVHUk9VTkQpLFxuXHRcdFx0XHRhY3RpdmVCb3JkZXJDb2xvcjogdGhlbWUuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX0FDVElWRV9CT1JERVIpLFxuXHRcdFx0XHRhY3RpdmVCYWNrZ3JvdW5kOiB0aGVtZS5nZXRDb2xvcihBQ1RJVklUWV9CQVJfQUNUSVZFX0JBQ0tHUk9VTkQpLFxuXHRcdFx0XHRiYWRnZUJhY2tncm91bmQ6IHRoZW1lLmdldENvbG9yKEFDVElWSVRZX0JBUl9CQURHRV9CQUNLR1JPVU5EKSxcblx0XHRcdFx0YmFkZ2VGb3JlZ3JvdW5kOiB0aGVtZS5nZXRDb2xvcihBQ1RJVklUWV9CQVJfQkFER0VfRk9SRUdST1VORCksXG5cdFx0XHRcdGRyYWdBbmREcm9wQm9yZGVyOiB0aGVtZS5nZXRDb2xvcihBQ1RJVklUWV9CQVJfRFJBR19BTkRfRFJPUF9CT1JERVIpLFxuXHRcdFx0XHRhY3RpdmVCYWNrZ3JvdW5kQ29sb3I6IHVuZGVmaW5lZCwgaW5hY3RpdmVCYWNrZ3JvdW5kQ29sb3I6IHVuZGVmaW5lZCwgYWN0aXZlQm9yZGVyQm90dG9tQ29sb3I6IHVuZGVmaW5lZCxcblx0XHRcdH0pLFxuXHRcdFx0b3ZlcmZsb3dBY3Rpb25TaXplOiBBY3Rpdml0eWJhclBhcnQuQUNUSU9OX0hFSUdIVCxcblx0XHR9LCBQYXJ0cy5BQ1RJVklUWUJBUl9QQVJULCB0aGlzLnBhbmVDb21wb3NpdGVQYXJ0LCB0cnVlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVDb250ZW50QXJlYShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuXHRcdHRoaXMuZWxlbWVudCA9IHBhcmVudDtcblx0XHR0aGlzLmNvbnRlbnQgPSBhcHBlbmQodGhpcy5lbGVtZW50LCAkKCcuY29udGVudCcpKTtcblxuXHRcdGlmICh0aGlzLmxheW91dFNlcnZpY2UuaXNWaXNpYmxlKFBhcnRzLkFDVElWSVRZQkFSX1BBUlQpKSB7XG5cdFx0XHR0aGlzLnNob3coKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5jb250ZW50O1xuXHR9XG5cblx0Z2V0UGlubmVkUGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuY29tcG9zaXRlQmFyLnZhbHVlPy5nZXRQaW5uZWRQYW5lQ29tcG9zaXRlSWRzKCkgPz8gW107XG5cdH1cblxuXHRnZXRWaXNpYmxlUGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuY29tcG9zaXRlQmFyLnZhbHVlPy5nZXRWaXNpYmxlUGFuZUNvbXBvc2l0ZUlkcygpID8/IFtdO1xuXHR9XG5cblx0Z2V0UGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuY29tcG9zaXRlQmFyLnZhbHVlPy5nZXRQYW5lQ29tcG9zaXRlSWRzKCkgPz8gW107XG5cdH1cblxuXHRmb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLmNvbXBvc2l0ZUJhci52YWx1ZT8uZm9jdXMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZVN0eWxlcygpOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVTdHlsZXMoKTtcblxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLmdldENvbnRhaW5lcigpKTtcblx0XHRjb25zdCBiYWNrZ3JvdW5kID0gdGhpcy5nZXRDb2xvcihBQ1RJVklUWV9CQVJfQkFDS0dST1VORCkgfHwgJyc7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGJhY2tncm91bmQ7XG5cblx0XHRjb25zdCBib3JkZXJDb2xvciA9IHRoaXMuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX0JPUkRFUikgfHwgdGhpcy5nZXRDb2xvcihjb250cmFzdEJvcmRlcikgfHwgJyc7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2JvcmRlcmVkJywgISFib3JkZXJDb2xvcik7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmJvcmRlckNvbG9yID0gYm9yZGVyQ29sb3IgPyBib3JkZXJDb2xvciA6ICcnO1xuXHR9XG5cblx0c2hvdyhmb2N1cz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuY29udGVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5jb21wb3NpdGVCYXIudmFsdWUpIHtcblx0XHRcdHRoaXMuY29tcG9zaXRlQmFyLnZhbHVlID0gdGhpcy5jcmVhdGVDb21wb3NpdGVCYXIoKTtcblx0XHRcdHRoaXMuY29tcG9zaXRlQmFyLnZhbHVlLmNyZWF0ZSh0aGlzLmNvbnRlbnQpO1xuXG5cdFx0XHRpZiAodGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdFx0dGhpcy5sYXlvdXQodGhpcy5kaW1lbnNpb24ud2lkdGgsIHRoaXMuZGltZW5zaW9uLmhlaWdodCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHR0aGlzLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0aGlkZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuY29tcG9zaXRlQmFyLnZhbHVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jb21wb3NpdGVCYXIuY2xlYXIoKTtcblxuXHRcdGlmICh0aGlzLmNvbnRlbnQpIHtcblx0XHRcdGNsZWFyTm9kZSh0aGlzLmNvbnRlbnQpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGxheW91dCh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHN1cGVyLmxheW91dCh3aWR0aCwgaGVpZ2h0LCAwLCAwKTtcblxuXHRcdGlmICghdGhpcy5jb21wb3NpdGVCYXIudmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBMYXlvdXQgY29udGVudHNcblx0XHRjb25zdCBjb250ZW50QXJlYVNpemUgPSBzdXBlci5sYXlvdXRDb250ZW50cyh3aWR0aCwgaGVpZ2h0KS5jb250ZW50U2l6ZTtcblxuXHRcdC8vIExheW91dCBjb21wb3NpdGUgYmFyXG5cdFx0dGhpcy5jb21wb3NpdGVCYXIudmFsdWUubGF5b3V0KHdpZHRoLCBjb250ZW50QXJlYVNpemUuaGVpZ2h0KTtcblx0fVxuXG5cdHRvSlNPTigpOiBvYmplY3Qge1xuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlOiBQYXJ0cy5BQ1RJVklUWUJBUl9QQVJUXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQWN0aXZpdHlCYXJDb21wb3NpdGVCYXIgZXh0ZW5kcyBQYW5lQ29tcG9zaXRlQmFyIHtcblxuXHRwcml2YXRlIGVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgbWVudUJhcjogQ3VzdG9tTWVudWJhckNvbnRyb2wgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbWVudUJhckNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY29tcG9zaXRlQmFyQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBnbG9iYWxDb21wb3NpdGVCYXI6IEdsb2JhbENvbXBvc2l0ZUJhciB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGtleWJvYXJkTmF2aWdhdGlvbkRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJUGFuZUNvbXBvc2l0ZUJhck9wdGlvbnMsXG5cdFx0cGFydDogUGFydHMsXG5cdFx0cGFuZUNvbXBvc2l0ZVBhcnQ6IElQYW5lQ29tcG9zaXRlUGFydCxcblx0XHRzaG93R2xvYmFsQWN0aXZpdGllczogYm9vbGVhbixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElWaWV3c1NlcnZpY2Ugdmlld1NlcnZpY2U6IElWaWV3c1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRmaWxsRXh0cmFDb250ZXh0TWVudUFjdGlvbnM6IChhY3Rpb25zLCBlKSA9PiB7XG5cdFx0XHRcdG9wdGlvbnMuZmlsbEV4dHJhQ29udGV4dE1lbnVBY3Rpb25zKGFjdGlvbnMsIGUpO1xuXHRcdFx0XHR0aGlzLmZpbGxDb250ZXh0TWVudUFjdGlvbnMoYWN0aW9ucywgZSk7XG5cdFx0XHR9XG5cdFx0fSwgcGFydCwgcGFuZUNvbXBvc2l0ZVBhcnQsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgZXh0ZW5zaW9uU2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCB2aWV3U2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgbGF5b3V0U2VydmljZSk7XG5cblx0XHRpZiAoc2hvd0dsb2JhbEFjdGl2aXRpZXMpIHtcblx0XHRcdHRoaXMuZ2xvYmFsQ29tcG9zaXRlQmFyID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoR2xvYmFsQ29tcG9zaXRlQmFyLCAoKSA9PiB0aGlzLmdldENvbnRleHRNZW51QWN0aW9ucygpLCAodGhlbWU6IElDb2xvclRoZW1lKSA9PiB0aGlzLm9wdGlvbnMuY29sb3JzKHRoZW1lKSwgdGhpcy5vcHRpb25zLmFjdGl2aXR5SG92ZXJPcHRpb25zKSk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVnaXN0ZXIgZm9yIGNvbmZpZ3VyYXRpb24gY2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3dpbmRvdy5tZW51QmFyVmlzaWJpbGl0eScpKSB7XG5cdFx0XHRcdGlmIChnZXRNZW51QmFyVmlzaWJpbGl0eSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSA9PT0gJ2NvbXBhY3QnKSB7XG5cdFx0XHRcdFx0dGhpcy5pbnN0YWxsTWVudWJhcigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMudW5pbnN0YWxsTWVudWJhcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWxsQ29udGV4dE1lbnVBY3Rpb25zKGFjdGlvbnM6IElBY3Rpb25bXSwgZT86IE1vdXNlRXZlbnQgfCBHZXN0dXJlRXZlbnQpIHtcblx0XHQvLyBNZW51XG5cdFx0Y29uc3QgbWVudUJhclZpc2liaWxpdHkgPSBnZXRNZW51QmFyVmlzaWJpbGl0eSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRpZiAobWVudUJhclZpc2liaWxpdHkgPT09ICdjb21wYWN0JyB8fCBtZW51QmFyVmlzaWJpbGl0eSA9PT0gJ2hpZGRlbicgfHwgbWVudUJhclZpc2liaWxpdHkgPT09ICd0b2dnbGUnKSB7XG5cdFx0XHRhY3Rpb25zLnVuc2hpZnQoLi4uW3RvQWN0aW9uKHsgaWQ6ICd0b2dnbGVNZW51VmlzaWJpbGl0eScsIGxhYmVsOiBsb2NhbGl6ZSgnbWVudScsIFwiTWVudVwiKSwgY2hlY2tlZDogbWVudUJhclZpc2liaWxpdHkgPT09ICdjb21wYWN0JywgcnVuOiAoKSA9PiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKCd3aW5kb3cubWVudUJhclZpc2liaWxpdHknLCBtZW51QmFyVmlzaWJpbGl0eSA9PT0gJ2NvbXBhY3QnID8gJ3RvZ2dsZScgOiAnY29tcGFjdCcpIH0pLCBuZXcgU2VwYXJhdG9yKCldKTtcblx0XHR9XG5cblx0XHRpZiAobWVudUJhclZpc2liaWxpdHkgPT09ICdjb21wYWN0JyAmJiB0aGlzLm1lbnVCYXJDb250YWluZXIgJiYgZT8udGFyZ2V0KSB7XG5cdFx0XHRpZiAoaXNBbmNlc3RvcihlLnRhcmdldCBhcyBOb2RlLCB0aGlzLm1lbnVCYXJDb250YWluZXIpKSB7XG5cdFx0XHRcdGFjdGlvbnMudW5zaGlmdCguLi5bdG9BY3Rpb24oeyBpZDogJ2hpZGVDb21wYWN0TWVudScsIGxhYmVsOiBsb2NhbGl6ZSgnaGlkZU1lbnUnLCBcIkhpZGUgTWVudVwiKSwgcnVuOiAoKSA9PiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKCd3aW5kb3cubWVudUJhclZpc2liaWxpdHknLCAndG9nZ2xlJykgfSksIG5ldyBTZXBhcmF0b3IoKV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEdsb2JhbCBDb21wb3NpdGUgQmFyXG5cdFx0aWYgKHRoaXMuZ2xvYmFsQ29tcG9zaXRlQmFyKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0XHRcdGFjdGlvbnMucHVzaCguLi50aGlzLmdsb2JhbENvbXBvc2l0ZUJhci5nZXRDb250ZXh0TWVudUFjdGlvbnMoKSk7XG5cdFx0fVxuXHRcdGFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdGFjdGlvbnMucHVzaCguLi50aGlzLmdldEFjdGl2aXR5QmFyQ29udGV4dE1lbnVBY3Rpb25zKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1bmluc3RhbGxNZW51YmFyKCkge1xuXHRcdGlmICh0aGlzLm1lbnVCYXIpIHtcblx0XHRcdHRoaXMubWVudUJhci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLm1lbnVCYXIgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMubWVudUJhckNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5tZW51QmFyQ29udGFpbmVyLnJlbW92ZSgpO1xuXHRcdFx0dGhpcy5tZW51QmFyQ29udGFpbmVyID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaW5zdGFsbE1lbnViYXIoKSB7XG5cdFx0aWYgKHRoaXMubWVudUJhcikge1xuXHRcdFx0cmV0dXJuOyAvLyBwcmV2ZW50IG1lbnUgYmFyIGZyb20gaW5zdGFsbGluZyB0d2ljZSAjMTEwNzIwXG5cdFx0fVxuXG5cdFx0dGhpcy5tZW51QmFyQ29udGFpbmVyID0gJCgnLm1lbnViYXInKTtcblxuXHRcdGNvbnN0IGNvbnRlbnQgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5lbGVtZW50KTtcblx0XHRjb250ZW50LnByZXBlbmQodGhpcy5tZW51QmFyQ29udGFpbmVyKTtcblxuXHRcdC8vIE1lbnViYXI6IGluc3RhbGwgYSBjdXN0b20gbWVudSBiYXIgZGVwZW5kaW5nIG9uIGNvbmZpZ3VyYXRpb25cblx0XHR0aGlzLm1lbnVCYXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEN1c3RvbU1lbnViYXJDb250cm9sKSk7XG5cdFx0dGhpcy5tZW51QmFyLmNyZWF0ZSh0aGlzLm1lbnVCYXJDb250YWluZXIpO1xuXG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyS2V5Ym9hcmROYXZpZ2F0aW9uTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMua2V5Ym9hcmROYXZpZ2F0aW9uRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdC8vIFVwL0Rvd24gb3IgTGVmdC9SaWdodCBhcnJvdyBvbiBjb21wYWN0IG1lbnVcblx0XHRpZiAodGhpcy5tZW51QmFyQ29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLmtleWJvYXJkTmF2aWdhdGlvbkRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5tZW51QmFyQ29udGFpbmVyLCBFdmVudFR5cGUuS0VZX0RPV04sIGUgPT4ge1xuXHRcdFx0XHRjb25zdCBrYkV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdFx0aWYgKGtiRXZlbnQuZXF1YWxzKEtleUNvZGUuRG93bkFycm93KSB8fCBrYkV2ZW50LmVxdWFscyhLZXlDb2RlLlJpZ2h0QXJyb3cpKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0Ly8gVXAvRG93biBvbiBBY3Rpdml0eSBJY29uc1xuXHRcdGlmICh0aGlzLmNvbXBvc2l0ZUJhckNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5rZXlib2FyZE5hdmlnYXRpb25EaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuY29tcG9zaXRlQmFyQ29udGFpbmVyLCBFdmVudFR5cGUuS0VZX0RPV04sIGUgPT4ge1xuXHRcdFx0XHRjb25zdCBrYkV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdFx0aWYgKGtiRXZlbnQuZXF1YWxzKEtleUNvZGUuRG93bkFycm93KSB8fCBrYkV2ZW50LmVxdWFscyhLZXlDb2RlLlJpZ2h0QXJyb3cpKSB7XG5cdFx0XHRcdFx0dGhpcy5nbG9iYWxDb21wb3NpdGVCYXI/LmZvY3VzKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoa2JFdmVudC5lcXVhbHMoS2V5Q29kZS5VcEFycm93KSB8fCBrYkV2ZW50LmVxdWFscyhLZXlDb2RlLkxlZnRBcnJvdykpIHtcblx0XHRcdFx0XHR0aGlzLm1lbnVCYXI/LnRvZ2dsZUZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvLyBVcCBhcnJvdyBvbiBnbG9iYWwgaWNvbnNcblx0XHRpZiAodGhpcy5nbG9iYWxDb21wb3NpdGVCYXIpIHtcblx0XHRcdHRoaXMua2V5Ym9hcmROYXZpZ2F0aW9uRGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmdsb2JhbENvbXBvc2l0ZUJhci5lbGVtZW50LCBFdmVudFR5cGUuS0VZX0RPV04sIGUgPT4ge1xuXHRcdFx0XHRjb25zdCBrYkV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdFx0aWYgKGtiRXZlbnQuZXF1YWxzKEtleUNvZGUuVXBBcnJvdykgfHwga2JFdmVudC5lcXVhbHMoS2V5Q29kZS5MZWZ0QXJyb3cpKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2N1cyh0aGlzLmdldFZpc2libGVQYW5lQ29tcG9zaXRlSWRzKCkubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBjcmVhdGUocGFyZW50OiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcblx0XHR0aGlzLmVsZW1lbnQgPSBwYXJlbnQ7XG5cblx0XHQvLyBJbnN0YWxsIG1lbnViYXIgaWYgY29tcGFjdFxuXHRcdGlmIChnZXRNZW51QmFyVmlzaWJpbGl0eSh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSA9PT0gJ2NvbXBhY3QnKSB7XG5cdFx0XHR0aGlzLmluc3RhbGxNZW51YmFyKCk7XG5cdFx0fVxuXG5cdFx0Ly8gVmlldyBDb250YWluZXJzIGFjdGlvbiBiYXJcblx0XHR0aGlzLmNvbXBvc2l0ZUJhckNvbnRhaW5lciA9IHN1cGVyLmNyZWF0ZSh0aGlzLmVsZW1lbnQpO1xuXG5cdFx0Ly8gR2xvYmFsIGFjdGlvbiBiYXJcblx0XHRpZiAodGhpcy5nbG9iYWxDb21wb3NpdGVCYXIpIHtcblx0XHRcdHRoaXMuZ2xvYmFsQ29tcG9zaXRlQmFyLmNyZWF0ZSh0aGlzLmVsZW1lbnQpO1xuXHRcdH1cblxuXHRcdC8vIEtleWJvYXJkIE5hdmlnYXRpb25cblx0XHR0aGlzLnJlZ2lzdGVyS2V5Ym9hcmROYXZpZ2F0aW9uTGlzdGVuZXJzKCk7XG5cblx0XHRyZXR1cm4gdGhpcy5jb21wb3NpdGVCYXJDb250YWluZXI7XG5cdH1cblxuXHRvdmVycmlkZSBsYXlvdXQod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5tZW51QmFyQ29udGFpbmVyKSB7XG5cdFx0XHRpZiAodGhpcy5vcHRpb25zLm9yaWVudGF0aW9uID09PSBBY3Rpb25zT3JpZW50YXRpb24uVkVSVElDQUwpIHtcblx0XHRcdFx0aGVpZ2h0IC09IHRoaXMubWVudUJhckNvbnRhaW5lci5jbGllbnRIZWlnaHQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR3aWR0aCAtPSB0aGlzLm1lbnVCYXJDb250YWluZXIuY2xpZW50V2lkdGg7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0aGlzLmdsb2JhbENvbXBvc2l0ZUJhcikge1xuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5vcmllbnRhdGlvbiA9PT0gQWN0aW9uc09yaWVudGF0aW9uLlZFUlRJQ0FMKSB7XG5cdFx0XHRcdGhlaWdodCAtPSAodGhpcy5nbG9iYWxDb21wb3NpdGVCYXIuc2l6ZSgpICogQWN0aXZpdHliYXJQYXJ0LkFDVElPTl9IRUlHSFQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0d2lkdGggLT0gdGhpcy5nbG9iYWxDb21wb3NpdGVCYXIuZWxlbWVudC5jbGllbnRXaWR0aDtcblx0XHRcdH1cblx0XHR9XG5cdFx0c3VwZXIubGF5b3V0KHdpZHRoLCBoZWlnaHQpO1xuXHR9XG5cblx0Z2V0QWN0aXZpdHlCYXJDb250ZXh0TWVudUFjdGlvbnMoKTogSUFjdGlvbltdIHtcblx0XHRjb25zdCBhY3Rpdml0eUJhclBvc2l0aW9uTWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLkFjdGl2aXR5QmFyUG9zaXRpb25NZW51LCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlLCByZW5kZXJTaG9ydFRpdGxlOiB0cnVlIH0pO1xuXHRcdGNvbnN0IHBvc2l0aW9uQWN0aW9ucyA9IGdldENvbnRleHRNZW51QWN0aW9ucyhhY3Rpdml0eUJhclBvc2l0aW9uTWVudSkuc2Vjb25kYXJ5O1xuXHRcdGNvbnN0IGFjdGlvbnMgPSBbXG5cdFx0XHRuZXcgU3VibWVudUFjdGlvbignd29ya2JlbmNoLmFjdGlvbi5wYW5lbC5wb3NpdGlvbicsIGxvY2FsaXplKCdhY3Rpdml0eSBiYXIgcG9zaXRpb24nLCBcIkFjdGl2aXR5IEJhciBQb3NpdGlvblwiKSwgcG9zaXRpb25BY3Rpb25zKSxcblx0XHRcdHRvQWN0aW9uKHsgaWQ6IFRvZ2dsZVNpZGViYXJQb3NpdGlvbkFjdGlvbi5JRCwgbGFiZWw6IFRvZ2dsZVNpZGViYXJQb3NpdGlvbkFjdGlvbi5nZXRMYWJlbCh0aGlzLmxheW91dFNlcnZpY2UpLCBydW46ICgpID0+IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gbmV3IFRvZ2dsZVNpZGViYXJQb3NpdGlvbkFjdGlvbigpLnJ1bihhY2Nlc3NvcikpIH0pLFxuXHRcdF07XG5cblx0XHRpZiAodGhpcy5wYXJ0ID09PSBQYXJ0cy5TSURFQkFSX1BBUlQpIHtcblx0XHRcdGFjdGlvbnMucHVzaCh0b0FjdGlvbih7IGlkOiBUb2dnbGVTaWRlYmFyVmlzaWJpbGl0eUFjdGlvbi5JRCwgbGFiZWw6IFRvZ2dsZVNpZGViYXJWaXNpYmlsaXR5QWN0aW9uLkxBQkVMLCBydW46ICgpID0+IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gbmV3IFRvZ2dsZVNpZGViYXJWaXNpYmlsaXR5QWN0aW9uKCkucnVuKGFjY2Vzc29yKSkgfSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBhY3Rpb25zO1xuXHR9XG5cbn1cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5hY3Rpdml0eUJhckxvY2F0aW9uLmRlZmF1bHQnLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCdwb3NpdGlvbkFjdGl2aXR5QmFyRGVmYXVsdCcsICdNb3ZlIEFjdGl2aXR5IEJhciB0byBTaWRlJyksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlEZWZhdWx0QWN0aXZpdHlCYXInLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZEZWZhdWx0XCIpLFxuXHRcdFx0fSxcblx0XHRcdHNob3J0VGl0bGU6IGxvY2FsaXplKCdkZWZhdWx0JywgXCJEZWZhdWx0XCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7TGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OfWAsIEFjdGl2aXR5QmFyUG9zaXRpb24uREVGQVVMVCksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkFjdGl2aXR5QmFyUG9zaXRpb25NZW51LFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoYGNvbmZpZy4ke0xheW91dFNldHRpbmdzLkFDVElWSVRZX0JBUl9MT0NBVElPTn1gLCBBY3Rpdml0eUJhclBvc2l0aW9uLkRFRkFVTFQpLFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKExheW91dFNldHRpbmdzLkFDVElWSVRZX0JBUl9MT0NBVElPTiwgQWN0aXZpdHlCYXJQb3NpdGlvbi5ERUZBVUxUKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uYWN0aXZpdHlCYXJMb2NhdGlvbi50b3AnLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCdwb3NpdGlvbkFjdGl2aXR5QmFyVG9wJywgJ01vdmUgQWN0aXZpdHkgQmFyIHRvIFRvcCcpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pVG9wQWN0aXZpdHlCYXInLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZUb3BcIiksXG5cdFx0XHR9LFxuXHRcdFx0c2hvcnRUaXRsZTogbG9jYWxpemUoJ3RvcCcsIFwiVG9wXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7TGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OfWAsIEFjdGl2aXR5QmFyUG9zaXRpb24uVE9QKSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQWN0aXZpdHlCYXJQb3NpdGlvbk1lbnUsXG5cdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm5vdEVxdWFscyhgY29uZmlnLiR7TGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OfWAsIEFjdGl2aXR5QmFyUG9zaXRpb24uVE9QKSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04sIEFjdGl2aXR5QmFyUG9zaXRpb24uVE9QKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uYWN0aXZpdHlCYXJMb2NhdGlvbi5ib3R0b20nLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCdwb3NpdGlvbkFjdGl2aXR5QmFyQm90dG9tJywgJ01vdmUgQWN0aXZpdHkgQmFyIHRvIEJvdHRvbScpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pQm90dG9tQWN0aXZpdHlCYXInLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZCb3R0b21cIiksXG5cdFx0XHR9LFxuXHRcdFx0c2hvcnRUaXRsZTogbG9jYWxpemUoJ2JvdHRvbScsIFwiQm90dG9tXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7TGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OfWAsIEFjdGl2aXR5QmFyUG9zaXRpb24uQk9UVE9NKSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQWN0aXZpdHlCYXJQb3NpdGlvbk1lbnUsXG5cdFx0XHRcdG9yZGVyOiAzXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm5vdEVxdWFscyhgY29uZmlnLiR7TGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OfWAsIEFjdGl2aXR5QmFyUG9zaXRpb24uQk9UVE9NKSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04sIEFjdGl2aXR5QmFyUG9zaXRpb24uQk9UVE9NKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uYWN0aXZpdHlCYXJMb2NhdGlvbi5oaWRlJyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLmxvY2FsaXplMignaGlkZUFjdGl2aXR5QmFyJywgJ0hpZGUgQWN0aXZpdHkgQmFyJyksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlIaWRlQWN0aXZpdHlCYXInLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZIaWRkZW5cIiksXG5cdFx0XHR9LFxuXHRcdFx0c2hvcnRUaXRsZTogbG9jYWxpemUoJ2hpZGUnLCBcIkhpZGRlblwiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHR0b2dnbGVkOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke0xheW91dFNldHRpbmdzLkFDVElWSVRZX0JBUl9MT0NBVElPTn1gLCBBY3Rpdml0eUJhclBvc2l0aW9uLkhJRERFTiksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkFjdGl2aXR5QmFyUG9zaXRpb25NZW51LFxuXHRcdFx0XHRvcmRlcjogNFxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoYGNvbmZpZy4ke0xheW91dFNldHRpbmdzLkFDVElWSVRZX0JBUl9MT0NBVElPTn1gLCBBY3Rpdml0eUJhclBvc2l0aW9uLkhJRERFTiksXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoTGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OLCBBY3Rpdml0eUJhclBvc2l0aW9uLkhJRERFTik7XG5cdH1cbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJBcHBlYXJhbmNlTWVudSwge1xuXHRzdWJtZW51OiBNZW51SWQuQWN0aXZpdHlCYXJQb3NpdGlvbk1lbnUsXG5cdHRpdGxlOiBsb2NhbGl6ZSgncG9zaXRpb25BY3Rpdml0dUJhcicsIFwiQWN0aXZpdHkgQmFyIFBvc2l0aW9uXCIpLFxuXHRncm91cDogJzNfd29ya2JlbmNoX2xheW91dF9tb3ZlJyxcblx0b3JkZXI6IDJcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlZpZXdDb250YWluZXJUaXRsZUNvbnRleHQsIHtcblx0c3VibWVudTogTWVudUlkLkFjdGl2aXR5QmFyUG9zaXRpb25NZW51LFxuXHR0aXRsZTogbG9jYWxpemUoJ3Bvc2l0aW9uQWN0aXZpdHVCYXInLCBcIkFjdGl2aXR5IEJhciBQb3NpdGlvblwiKSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoXG5cdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3Q29udGFpbmVyTG9jYXRpb24nLCBWaWV3Q29udGFpbmVyTG9jYXRpb25Ub1N0cmluZyhWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcikpLFxuXHRcdENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lckxvY2F0aW9uJywgVmlld0NvbnRhaW5lckxvY2F0aW9uVG9TdHJpbmcoVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcikpXG5cdCksXG5cdGdyb3VwOiAnM193b3JrYmVuY2hfbGF5b3V0X21vdmUnLFxuXHRvcmRlcjogMVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFN3aXRjaENvbXBvc2l0ZVZpZXdBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ucHJldmlvdXNTaWRlQmFyVmlldycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdwcmV2aW91c1NpZGVCYXJWaWV3JywgJ1ByZXZpb3VzIFByaW1hcnkgU2lkZSBCYXIgVmlldycpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIC0xKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFN3aXRjaENvbXBvc2l0ZVZpZXdBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubmV4dFNpZGVCYXJWaWV3Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ25leHRTaWRlQmFyVmlldycsICdOZXh0IFByaW1hcnkgU2lkZSBCYXIgVmlldycpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIDEpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKFxuXHRjbGFzcyBGb2N1c0FjdGl2aXR5QmFyQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0FjdGl2aXR5QmFyJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignZm9jdXNBY3Rpdml0eUJhcicsICdGb2N1cyBBY3Rpdml0eSBCYXInKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0Y29uc3QgbGF5b3V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSk7XG5cdFx0XHRsYXlvdXRTZXJ2aWNlLmZvY3VzUGFydChQYXJ0cy5BQ1RJVklUWUJBUl9QQVJUKTtcblx0XHR9XG5cdH0pO1xuXG5yZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCgodGhlbWUsIGNvbGxlY3RvcikgPT4ge1xuXG5cdGNvbnN0IGFjdGl2aXR5QmFyQWN0aXZlQm9yZGVyQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihBQ1RJVklUWV9CQVJfQUNUSVZFX0JPUkRFUik7XG5cdGlmIChhY3Rpdml0eUJhckFjdGl2ZUJvcmRlckNvbG9yKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmFjdGl2aXR5YmFyID4gLmNvbnRlbnQgOm5vdCgubW9uYWNvLW1lbnUpID4gLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbS5jaGVja2VkIC5hY3RpdmUtaXRlbS1pbmRpY2F0b3I6YmVmb3JlIHtcblx0XHRcdFx0Ym9yZGVyLWxlZnQtY29sb3I6ICR7YWN0aXZpdHlCYXJBY3RpdmVCb3JkZXJDb2xvcn07XG5cdFx0XHR9XG5cdFx0YCk7XG5cdH1cblxuXHRjb25zdCBhY3Rpdml0eUJhckFjdGl2ZUZvY3VzQm9yZGVyQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihBQ1RJVklUWV9CQVJfQUNUSVZFX0ZPQ1VTX0JPUkRFUik7XG5cdGlmIChhY3Rpdml0eUJhckFjdGl2ZUZvY3VzQm9yZGVyQ29sb3IpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgXG5cdFx0XHQubW9uYWNvLXdvcmtiZW5jaCAuYWN0aXZpdHliYXIgPiAuY29udGVudCA6bm90KC5tb25hY28tbWVudSkgPiAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1pdGVtLmNoZWNrZWQ6Zm9jdXM6OmJlZm9yZSB7XG5cdFx0XHRcdHZpc2liaWxpdHk6IGhpZGRlbjtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmFjdGl2aXR5YmFyID4gLmNvbnRlbnQgOm5vdCgubW9uYWNvLW1lbnUpID4gLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbS5jaGVja2VkOmZvY3VzIC5hY3RpdmUtaXRlbS1pbmRpY2F0b3I6YmVmb3JlIHtcblx0XHRcdFx0dmlzaWJpbGl0eTogdmlzaWJsZTtcblx0XHRcdFx0Ym9yZGVyLWxlZnQtY29sb3I6ICR7YWN0aXZpdHlCYXJBY3RpdmVGb2N1c0JvcmRlckNvbG9yfTtcblx0XHRcdH1cblx0XHRgKTtcblx0fVxuXG5cdGNvbnN0IGFjdGl2aXR5QmFyQWN0aXZlQmFja2dyb3VuZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX0FDVElWRV9CQUNLR1JPVU5EKTtcblx0aWYgKGFjdGl2aXR5QmFyQWN0aXZlQmFja2dyb3VuZENvbG9yKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmFjdGl2aXR5YmFyID4gLmNvbnRlbnQgOm5vdCgubW9uYWNvLW1lbnUpID4gLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbS5jaGVja2VkIC5hY3RpdmUtaXRlbS1pbmRpY2F0b3Ige1xuXHRcdFx0XHR6LWluZGV4OiAwO1xuXHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiAke2FjdGl2aXR5QmFyQWN0aXZlQmFja2dyb3VuZENvbG9yfTtcblx0XHRcdH1cblx0XHRgKTtcblx0fVxuXG5cdC8vIFN0eWxpbmcgd2l0aCBPdXRsaW5lIGNvbG9yIChlLmcuIGhpZ2ggY29udHJhc3QgdGhlbWUpXG5cdGNvbnN0IG91dGxpbmUgPSB0aGVtZS5nZXRDb2xvcihhY3RpdmVDb250cmFzdEJvcmRlcik7XG5cdGlmIChvdXRsaW5lKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmFjdGl2aXR5YmFyID4gLmNvbnRlbnQgOm5vdCgubW9uYWNvLW1lbnUpID4gLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbSAuYWN0aW9uLWxhYmVsOjpiZWZvcmV7XG5cdFx0XHRcdHBhZGRpbmc6IDZweDtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmFjdGl2aXR5YmFyID4gLmNvbnRlbnQgOm5vdCgubW9uYWNvLW1lbnUpID4gLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbS5hY3RpdmUgLmFjdGlvbi1sYWJlbDo6YmVmb3JlLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmFjdGl2aXR5YmFyID4gLmNvbnRlbnQgOm5vdCgubW9uYWNvLW1lbnUpID4gLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbS5hY3RpdmU6aG92ZXIgLmFjdGlvbi1sYWJlbDo6YmVmb3JlLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmFjdGl2aXR5YmFyID4gLmNvbnRlbnQgOm5vdCgubW9uYWNvLW1lbnUpID4gLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbS5jaGVja2VkIC5hY3Rpb24tbGFiZWw6OmJlZm9yZSxcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5hY3Rpdml0eWJhciA+IC5jb250ZW50IDpub3QoLm1vbmFjby1tZW51KSA+IC5tb25hY28tYWN0aW9uLWJhciAuYWN0aW9uLWl0ZW0uY2hlY2tlZDpob3ZlciAuYWN0aW9uLWxhYmVsOjpiZWZvcmUge1xuXHRcdFx0XHRvdXRsaW5lOiAxcHggc29saWQgJHtvdXRsaW5lfTtcblx0XHRcdH1cblxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmFjdGl2aXR5YmFyID4gLmNvbnRlbnQgOm5vdCgubW9uYWNvLW1lbnUpID4gLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbTpob3ZlciAuYWN0aW9uLWxhYmVsOjpiZWZvcmUge1xuXHRcdFx0XHRvdXRsaW5lOiAxcHggZGFzaGVkICR7b3V0bGluZX07XG5cdFx0XHR9XG5cblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5hY3Rpdml0eWJhciA+IC5jb250ZW50IDpub3QoLm1vbmFjby1tZW51KSA+IC5tb25hY28tYWN0aW9uLWJhciAuYWN0aW9uLWl0ZW06Zm9jdXMgLmFjdGl2ZS1pdGVtLWluZGljYXRvcjpiZWZvcmUge1xuXHRcdFx0XHRib3JkZXItbGVmdC1jb2xvcjogJHtvdXRsaW5lfTtcblx0XHRcdH1cblx0XHRgKTtcblx0fVxuXG5cdC8vIFN0eWxpbmcgd2l0aG91dCBvdXRsaW5lIGNvbG9yXG5cdGVsc2Uge1xuXHRcdGNvbnN0IGZvY3VzQm9yZGVyQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihmb2N1c0JvcmRlcik7XG5cdFx0aWYgKGZvY3VzQm9yZGVyQ29sb3IpIHtcblx0XHRcdGNvbGxlY3Rvci5hZGRSdWxlKGBcblx0XHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmFjdGl2aXR5YmFyID4gLmNvbnRlbnQgOm5vdCgubW9uYWNvLW1lbnUpID4gLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbTpmb2N1cyAuYWN0aXZlLWl0ZW0taW5kaWNhdG9yOjpiZWZvcmUge1xuXHRcdFx0XHRcdFx0Ym9yZGVyLWxlZnQtY29sb3I6ICR7Zm9jdXNCb3JkZXJDb2xvcn07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRgKTtcblx0XHR9XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsT0FBTztBQUNQLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxZQUFZO0FBQ3JCLFNBQVMscUJBQXFCLHlCQUF5QixnQkFBZ0IsT0FBTyxnQkFBZ0I7QUFDOUYsU0FBUyw2QkFBK0M7QUFDeEQsU0FBUyxpQkFBaUIseUJBQXlCO0FBQ25ELFNBQVMsNkJBQTZCLHFDQUFxQztBQUMzRSxTQUFTLGVBQTRCLGtDQUFrQztBQUN2RSxTQUFTLHlCQUF5QixxQkFBcUIseUJBQXlCLDRCQUE0QiwrQkFBK0IsK0JBQStCLGtDQUFrQyxnQ0FBZ0MsbUNBQW1DLHdDQUF3QztBQUN2VCxTQUFTLHNCQUFzQixnQkFBZ0IsbUJBQW1CO0FBQ2xFLFNBQVMsdUJBQXVCLFFBQVEsV0FBVyxZQUFZLEdBQUcsaUJBQWlCO0FBQ25GLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQWtCLFdBQVcsZUFBZSxnQkFBZ0I7QUFDNUQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMscUJBQXFCO0FBRzlCLFNBQW1DLHdCQUF3QjtBQUMzRCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFNBQVMsY0FBYyxRQUFRLGNBQWMsdUJBQXVCO0FBQzdFLFNBQVMsZ0JBQWdCLDBCQUEwQjtBQUNuRCxTQUFTLGtCQUFrQjtBQUMz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
