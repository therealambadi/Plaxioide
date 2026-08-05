import { localize, localize2 } from "../../../nls.js";
import { MenuId, MenuRegistry, registerAction2, Action2 } from "../../../platform/actions/common/actions.js";
import { Categories } from "../../../platform/action/common/actionCommonCategories.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { EditorActionsLocation, EditorTabsMode, IWorkbenchLayoutService, LayoutSettings, Parts, Position, ZenModeSettings, positionToString } from "../../services/layout/browser/layoutService.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { KeyMod, KeyCode, KeyChord } from "../../../base/common/keyCodes.js";
import { isWindows, isLinux, isWeb, isMacintosh, isNative } from "../../../base/common/platform.js";
import { IsMacNativeContext } from "../../../platform/contextkey/common/contextkeys.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../platform/keybinding/common/keybindingsRegistry.js";
import { ContextKeyExpr, IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { IViewDescriptorService, ViewContainerLocation, ViewContainerLocationToString } from "../../common/views.js";
import { IViewsService } from "../../services/views/common/viewsService.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { IPaneCompositePartService } from "../../services/panecomposite/browser/panecomposite.js";
import { ToggleAuxiliaryBarAction } from "../parts/auxiliarybar/auxiliaryBarActions.js";
import { TogglePanelAction } from "../parts/panel/panelActions.js";
import { ICommandService } from "../../../platform/commands/common/commands.js";
import { AuxiliaryBarVisibleContext, PanelAlignmentContext, PanelVisibleContext, SideBarVisibleContext, FocusedViewContext, InEditorZenModeContext, IsMainEditorCenteredLayoutContext, MainEditorAreaVisibleContext, IsMainWindowFullscreenContext, PanelPositionContext, IsAuxiliaryWindowFocusedContext, TitleBarStyleContext } from "../../common/contextkeys.js";
import { Codicon } from "../../../base/common/codicons.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { registerIcon } from "../../../platform/theme/common/iconRegistry.js";
import { mainWindow } from "../../../base/browser/window.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { TitlebarStyle } from "../../../platform/window/common/window.js";
import { IPreferencesService } from "../../services/preferences/common/preferences.js";
import { QuickInputAlignmentContextKey } from "../../../platform/quickinput/browser/quickInput.js";
import { IEditorGroupsService } from "../../services/editor/common/editorGroupsService.js";
const menubarIcon = registerIcon("menuBar", Codicon.layoutMenubar, localize("menuBarIcon", "Represents the menu bar"));
const activityBarLeftIcon = registerIcon("activity-bar-left", Codicon.layoutActivitybarLeft, localize("activityBarLeft", "Represents the activity bar in the left position"));
const activityBarRightIcon = registerIcon("activity-bar-right", Codicon.layoutActivitybarRight, localize("activityBarRight", "Represents the activity bar in the right position"));
const panelLeftIcon = registerIcon("panel-left", Codicon.layoutSidebarLeft, localize("panelLeft", "Represents a side bar in the left position"));
const panelLeftOffIcon = registerIcon("panel-left-off", Codicon.layoutSidebarLeftOff, localize("panelLeftOff", "Represents a side bar in the left position toggled off"));
const panelRightIcon = registerIcon("panel-right", Codicon.layoutSidebarRight, localize("panelRight", "Represents side bar in the right position"));
const panelRightOffIcon = registerIcon("panel-right-off", Codicon.layoutSidebarRightOff, localize("panelRightOff", "Represents side bar in the right position toggled off"));
const panelIcon = registerIcon("panel-bottom", Codicon.layoutPanel, localize("panelBottom", "Represents the bottom panel"));
const statusBarIcon = registerIcon("statusBar", Codicon.layoutStatusbar, localize("statusBarIcon", "Represents the status bar"));
const panelAlignmentLeftIcon = registerIcon("panel-align-left", Codicon.layoutPanelLeft, localize("panelBottomLeft", "Represents the bottom panel alignment set to the left"));
const panelAlignmentRightIcon = registerIcon("panel-align-right", Codicon.layoutPanelRight, localize("panelBottomRight", "Represents the bottom panel alignment set to the right"));
const panelAlignmentCenterIcon = registerIcon("panel-align-center", Codicon.layoutPanelCenter, localize("panelBottomCenter", "Represents the bottom panel alignment set to the center"));
const panelAlignmentJustifyIcon = registerIcon("panel-align-justify", Codicon.layoutPanelJustify, localize("panelBottomJustify", "Represents the bottom panel alignment set to justified"));
const quickInputAlignmentTopIcon = registerIcon("quickInputAlignmentTop", Codicon.arrowUp, localize("quickInputAlignmentTop", "Represents quick input alignment set to the top"));
const quickInputAlignmentCenterIcon = registerIcon("quickInputAlignmentCenter", Codicon.circle, localize("quickInputAlignmentCenter", "Represents quick input alignment set to the center"));
const fullscreenIcon = registerIcon("fullscreen", Codicon.screenFull, localize("fullScreenIcon", "Represents full screen"));
const centerLayoutIcon = registerIcon("centerLayoutIcon", Codicon.layoutCentered, localize("centerLayoutIcon", "Represents centered layout mode"));
const zenModeIcon = registerIcon("zenMode", Codicon.target, localize("zenModeIcon", "Represents zen mode"));
const ToggleActivityBarVisibilityActionId = "workbench.action.toggleActivityBarVisibility";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleCenteredLayout",
      title: {
        ...localize2("toggleCenteredLayout", "Toggle Centered Layout"),
        mnemonicTitle: localize({ key: "miToggleCenteredLayout", comment: ["&& denotes a mnemonic"] }, "&&Centered Layout")
      },
      precondition: IsAuxiliaryWindowFocusedContext.toNegated(),
      category: Categories.View,
      f1: true,
      toggled: IsMainEditorCenteredLayoutContext,
      menu: [{
        id: MenuId.MenubarAppearanceMenu,
        group: "1_toggle_view",
        order: 3
      }]
    });
  }
  run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    layoutService.centerMainEditorLayout(!layoutService.isMainEditorLayoutCentered());
    editorGroupService.activeGroup.focus();
  }
});
const sidebarPositionConfigurationKey = "workbench.sideBar.location";
class MoveSidebarPositionAction extends Action2 {
  constructor(id, title, position) {
    super({
      id,
      title,
      f1: false
    });
    this.position = position;
  }
  async run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const configurationService = accessor.get(IConfigurationService);
    const position = layoutService.getSideBarPosition();
    if (position !== this.position) {
      return configurationService.updateValue(sidebarPositionConfigurationKey, positionToString(this.position));
    }
  }
}
const _MoveSidebarRightAction = class _MoveSidebarRightAction extends MoveSidebarPositionAction {
  constructor() {
    super(_MoveSidebarRightAction.ID, localize2("moveSidebarRight", "Move Primary Side Bar Right"), Position.RIGHT);
  }
};
_MoveSidebarRightAction.ID = "workbench.action.moveSideBarRight";
let MoveSidebarRightAction = _MoveSidebarRightAction;
const _MoveSidebarLeftAction = class _MoveSidebarLeftAction extends MoveSidebarPositionAction {
  constructor() {
    super(_MoveSidebarLeftAction.ID, localize2("moveSidebarLeft", "Move Primary Side Bar Left"), Position.LEFT);
  }
};
_MoveSidebarLeftAction.ID = "workbench.action.moveSideBarLeft";
let MoveSidebarLeftAction = _MoveSidebarLeftAction;
registerAction2(MoveSidebarRightAction);
registerAction2(MoveSidebarLeftAction);
const _ToggleSidebarPositionAction = class _ToggleSidebarPositionAction extends Action2 {
  static getLabel(layoutService) {
    return layoutService.getSideBarPosition() === Position.LEFT ? localize("moveSidebarRight", "Move Primary Side Bar Right") : localize("moveSidebarLeft", "Move Primary Side Bar Left");
  }
  constructor() {
    super({
      id: _ToggleSidebarPositionAction.ID,
      title: localize2("toggleSidebarPosition", "Toggle Primary Side Bar Position"),
      category: Categories.View,
      f1: true
    });
  }
  run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const configurationService = accessor.get(IConfigurationService);
    const position = layoutService.getSideBarPosition();
    const newPositionValue = position === Position.LEFT ? "right" : "left";
    return configurationService.updateValue(sidebarPositionConfigurationKey, newPositionValue);
  }
};
_ToggleSidebarPositionAction.ID = "workbench.action.toggleSidebarPosition";
_ToggleSidebarPositionAction.LABEL = localize("toggleSidebarPosition", "Toggle Primary Side Bar Position");
let ToggleSidebarPositionAction = _ToggleSidebarPositionAction;
registerAction2(ToggleSidebarPositionAction);
const configureLayoutIcon = registerIcon("configure-layout-icon", Codicon.layout, localize("cofigureLayoutIcon", "Icon represents workbench layout configuration."));
MenuRegistry.appendMenuItem(MenuId.LayoutControlMenu, {
  submenu: MenuId.LayoutControlMenuSubmenu,
  title: localize("configureLayout", "Configure Layout"),
  icon: configureLayoutIcon,
  group: "1_workbench_layout",
  when: ContextKeyExpr.equals("config.workbench.layoutControl.type", "menu")
});
MenuRegistry.appendMenuItems([{
  id: MenuId.ViewContainerTitleContext,
  item: {
    group: "3_workbench_layout_move",
    command: {
      id: ToggleSidebarPositionAction.ID,
      title: localize("move side bar right", "Move Primary Side Bar Right")
    },
    when: ContextKeyExpr.and(ContextKeyExpr.notEquals("config.workbench.sideBar.location", "right"), ContextKeyExpr.equals("viewContainerLocation", ViewContainerLocationToString(ViewContainerLocation.Sidebar))),
    order: 1
  }
}, {
  id: MenuId.ViewContainerTitleContext,
  item: {
    group: "3_workbench_layout_move",
    command: {
      id: ToggleSidebarPositionAction.ID,
      title: localize("move sidebar left", "Move Primary Side Bar Left")
    },
    when: ContextKeyExpr.and(ContextKeyExpr.equals("config.workbench.sideBar.location", "right"), ContextKeyExpr.equals("viewContainerLocation", ViewContainerLocationToString(ViewContainerLocation.Sidebar))),
    order: 1
  }
}, {
  id: MenuId.ViewContainerTitleContext,
  item: {
    group: "3_workbench_layout_move",
    command: {
      id: ToggleSidebarPositionAction.ID,
      title: localize("move second sidebar left", "Move Void Side Bar Left")
    },
    when: ContextKeyExpr.and(ContextKeyExpr.notEquals("config.workbench.sideBar.location", "right"), ContextKeyExpr.equals("viewContainerLocation", ViewContainerLocationToString(ViewContainerLocation.AuxiliaryBar))),
    order: 1
  }
}, {
  id: MenuId.ViewContainerTitleContext,
  item: {
    group: "3_workbench_layout_move",
    command: {
      id: ToggleSidebarPositionAction.ID,
      title: localize("move second sidebar right", "Move Void Side Bar Right")
    },
    when: ContextKeyExpr.and(ContextKeyExpr.equals("config.workbench.sideBar.location", "right"), ContextKeyExpr.equals("viewContainerLocation", ViewContainerLocationToString(ViewContainerLocation.AuxiliaryBar))),
    order: 1
  }
}]);
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
  group: "3_workbench_layout_move",
  command: {
    id: ToggleSidebarPositionAction.ID,
    title: localize({ key: "miMoveSidebarRight", comment: ["&& denotes a mnemonic"] }, "&&Move Primary Side Bar Right")
  },
  when: ContextKeyExpr.notEquals("config.workbench.sideBar.location", "right"),
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
  group: "3_workbench_layout_move",
  command: {
    id: ToggleSidebarPositionAction.ID,
    title: localize({ key: "miMoveSidebarLeft", comment: ["&& denotes a mnemonic"] }, "&&Move Primary Side Bar Left")
  },
  when: ContextKeyExpr.equals("config.workbench.sideBar.location", "right"),
  order: 2
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleEditorVisibility",
      title: {
        ...localize2("toggleEditor", "Toggle Editor Area Visibility"),
        mnemonicTitle: localize({ key: "miShowEditorArea", comment: ["&& denotes a mnemonic"] }, "Show &&Editor Area")
      },
      category: Categories.View,
      f1: true,
      toggled: MainEditorAreaVisibleContext,
      // the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
      precondition: ContextKeyExpr.and(IsAuxiliaryWindowFocusedContext.toNegated(), ContextKeyExpr.or(PanelAlignmentContext.isEqualTo("center"), PanelPositionContext.notEqualsTo("bottom")))
    });
  }
  run(accessor) {
    accessor.get(IWorkbenchLayoutService).toggleMaximizedPanel();
  }
});
MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
  group: "2_appearance",
  title: localize({ key: "miAppearance", comment: ["&& denotes a mnemonic"] }, "&&Appearance"),
  submenu: MenuId.MenubarAppearanceMenu,
  order: 1
});
const _ToggleSidebarVisibilityAction = class _ToggleSidebarVisibilityAction extends Action2 {
  constructor() {
    super({
      id: _ToggleSidebarVisibilityAction.ID,
      title: localize2("toggleSidebar", "Toggle Primary Side Bar Visibility"),
      toggled: {
        condition: SideBarVisibleContext,
        title: localize("primary sidebar", "Primary Side Bar"),
        mnemonicTitle: localize({ key: "primary sidebar mnemonic", comment: ["&& denotes a mnemonic"] }, "&&Primary Side Bar")
      },
      metadata: {
        description: localize("openAndCloseSidebar", "Open/Show and Close/Hide Sidebar")
      },
      category: Categories.View,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyB
      },
      menu: [
        {
          id: MenuId.LayoutControlMenuSubmenu,
          group: "0_workbench_layout",
          order: 0
        },
        {
          id: MenuId.MenubarAppearanceMenu,
          group: "2_workbench_layout",
          order: 1
        }
      ]
    });
  }
  run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    layoutService.setPartHidden(layoutService.isVisible(Parts.SIDEBAR_PART), Parts.SIDEBAR_PART);
  }
};
_ToggleSidebarVisibilityAction.ID = "workbench.action.toggleSidebarVisibility";
_ToggleSidebarVisibilityAction.LABEL = localize("compositePart.hideSideBarLabel", "Hide Primary Side Bar");
let ToggleSidebarVisibilityAction = _ToggleSidebarVisibilityAction;
registerAction2(ToggleSidebarVisibilityAction);
MenuRegistry.appendMenuItems([
  {
    id: MenuId.ViewContainerTitleContext,
    item: {
      group: "3_workbench_layout_move",
      command: {
        id: ToggleSidebarVisibilityAction.ID,
        title: localize("compositePart.hideSideBarLabel", "Hide Primary Side Bar")
      },
      when: ContextKeyExpr.and(SideBarVisibleContext, ContextKeyExpr.equals("viewContainerLocation", ViewContainerLocationToString(ViewContainerLocation.Sidebar))),
      order: 2
    }
  },
  {
    id: MenuId.LayoutControlMenu,
    item: {
      group: "2_pane_toggles",
      command: {
        id: ToggleSidebarVisibilityAction.ID,
        title: localize("toggleSideBar", "Toggle Primary Side Bar"),
        icon: panelLeftOffIcon,
        toggled: { condition: SideBarVisibleContext, icon: panelLeftIcon }
      },
      when: ContextKeyExpr.and(ContextKeyExpr.or(ContextKeyExpr.equals("config.workbench.layoutControl.type", "toggles"), ContextKeyExpr.equals("config.workbench.layoutControl.type", "both")), ContextKeyExpr.equals("config.workbench.sideBar.location", "left")),
      order: 0
    }
  },
  {
    id: MenuId.LayoutControlMenu,
    item: {
      group: "2_pane_toggles",
      command: {
        id: ToggleSidebarVisibilityAction.ID,
        title: localize("toggleSideBar", "Toggle Primary Side Bar"),
        icon: panelRightOffIcon,
        toggled: { condition: SideBarVisibleContext, icon: panelRightIcon }
      },
      when: ContextKeyExpr.and(ContextKeyExpr.or(ContextKeyExpr.equals("config.workbench.layoutControl.type", "toggles"), ContextKeyExpr.equals("config.workbench.layoutControl.type", "both")), ContextKeyExpr.equals("config.workbench.sideBar.location", "right")),
      order: 2
    }
  }
]);
const _ToggleStatusbarVisibilityAction = class _ToggleStatusbarVisibilityAction extends Action2 {
  constructor() {
    super({
      id: _ToggleStatusbarVisibilityAction.ID,
      title: {
        ...localize2("toggleStatusbar", "Toggle Status Bar Visibility"),
        mnemonicTitle: localize({ key: "miStatusbar", comment: ["&& denotes a mnemonic"] }, "S&&tatus Bar")
      },
      category: Categories.View,
      f1: true,
      toggled: ContextKeyExpr.equals("config.workbench.statusBar.visible", true),
      menu: [{
        id: MenuId.MenubarAppearanceMenu,
        group: "2_workbench_layout",
        order: 3
      }]
    });
  }
  run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const configurationService = accessor.get(IConfigurationService);
    const visibility = layoutService.isVisible(Parts.STATUSBAR_PART, mainWindow);
    const newVisibilityValue = !visibility;
    return configurationService.updateValue(_ToggleStatusbarVisibilityAction.statusbarVisibleKey, newVisibilityValue);
  }
};
_ToggleStatusbarVisibilityAction.ID = "workbench.action.toggleStatusbarVisibility";
_ToggleStatusbarVisibilityAction.statusbarVisibleKey = "workbench.statusBar.visible";
let ToggleStatusbarVisibilityAction = _ToggleStatusbarVisibilityAction;
registerAction2(ToggleStatusbarVisibilityAction);
class AbstractSetShowTabsAction extends Action2 {
  constructor(settingName, value, title, id, precondition, description) {
    super({
      id,
      title,
      category: Categories.View,
      precondition,
      metadata: description ? { description } : void 0,
      f1: true
    });
    this.settingName = settingName;
    this.value = value;
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    return configurationService.updateValue(this.settingName, this.value);
  }
}
const _HideEditorTabsAction = class _HideEditorTabsAction extends AbstractSetShowTabsAction {
  constructor() {
    const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.NONE).negate(), InEditorZenModeContext.negate());
    const title = localize2("hideEditorTabs", "Hide Editor Tabs");
    super(LayoutSettings.EDITOR_TABS_MODE, EditorTabsMode.NONE, title, _HideEditorTabsAction.ID, precondition, localize2("hideEditorTabsDescription", "Hide Tab Bar"));
  }
};
_HideEditorTabsAction.ID = "workbench.action.hideEditorTabs";
let HideEditorTabsAction = _HideEditorTabsAction;
const _ZenHideEditorTabsAction = class _ZenHideEditorTabsAction extends AbstractSetShowTabsAction {
  constructor() {
    const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${ZenModeSettings.SHOW_TABS}`, EditorTabsMode.NONE).negate(), InEditorZenModeContext);
    const title = localize2("hideEditorTabsZenMode", "Hide Editor Tabs in Zen Mode");
    super(ZenModeSettings.SHOW_TABS, EditorTabsMode.NONE, title, _ZenHideEditorTabsAction.ID, precondition, localize2("hideEditorTabsZenModeDescription", "Hide Tab Bar in Zen Mode"));
  }
};
_ZenHideEditorTabsAction.ID = "workbench.action.zenHideEditorTabs";
let ZenHideEditorTabsAction = _ZenHideEditorTabsAction;
const _ShowMultipleEditorTabsAction = class _ShowMultipleEditorTabsAction extends AbstractSetShowTabsAction {
  constructor() {
    const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.MULTIPLE).negate(), InEditorZenModeContext.negate());
    const title = localize2("showMultipleEditorTabs", "Show Multiple Editor Tabs");
    super(LayoutSettings.EDITOR_TABS_MODE, EditorTabsMode.MULTIPLE, title, _ShowMultipleEditorTabsAction.ID, precondition, localize2("showMultipleEditorTabsDescription", "Show Tab Bar with multiple tabs"));
  }
};
_ShowMultipleEditorTabsAction.ID = "workbench.action.showMultipleEditorTabs";
let ShowMultipleEditorTabsAction = _ShowMultipleEditorTabsAction;
const _ZenShowMultipleEditorTabsAction = class _ZenShowMultipleEditorTabsAction extends AbstractSetShowTabsAction {
  constructor() {
    const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${ZenModeSettings.SHOW_TABS}`, EditorTabsMode.MULTIPLE).negate(), InEditorZenModeContext);
    const title = localize2("showMultipleEditorTabsZenMode", "Show Multiple Editor Tabs in Zen Mode");
    super(ZenModeSettings.SHOW_TABS, EditorTabsMode.MULTIPLE, title, _ZenShowMultipleEditorTabsAction.ID, precondition, localize2("showMultipleEditorTabsZenModeDescription", "Show Tab Bar in Zen Mode"));
  }
};
_ZenShowMultipleEditorTabsAction.ID = "workbench.action.zenShowMultipleEditorTabs";
let ZenShowMultipleEditorTabsAction = _ZenShowMultipleEditorTabsAction;
const _ShowSingleEditorTabAction = class _ShowSingleEditorTabAction extends AbstractSetShowTabsAction {
  constructor() {
    const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.SINGLE).negate(), InEditorZenModeContext.negate());
    const title = localize2("showSingleEditorTab", "Show Single Editor Tab");
    super(LayoutSettings.EDITOR_TABS_MODE, EditorTabsMode.SINGLE, title, _ShowSingleEditorTabAction.ID, precondition, localize2("showSingleEditorTabDescription", "Show Tab Bar with one Tab"));
  }
};
_ShowSingleEditorTabAction.ID = "workbench.action.showEditorTab";
let ShowSingleEditorTabAction = _ShowSingleEditorTabAction;
const _ZenShowSingleEditorTabAction = class _ZenShowSingleEditorTabAction extends AbstractSetShowTabsAction {
  constructor() {
    const precondition = ContextKeyExpr.and(ContextKeyExpr.equals(`config.${ZenModeSettings.SHOW_TABS}`, EditorTabsMode.SINGLE).negate(), InEditorZenModeContext);
    const title = localize2("showSingleEditorTabZenMode", "Show Single Editor Tab in Zen Mode");
    super(ZenModeSettings.SHOW_TABS, EditorTabsMode.SINGLE, title, _ZenShowSingleEditorTabAction.ID, precondition, localize2("showSingleEditorTabZenModeDescription", "Show Tab Bar in Zen Mode with one Tab"));
  }
};
_ZenShowSingleEditorTabAction.ID = "workbench.action.zenShowEditorTab";
let ZenShowSingleEditorTabAction = _ZenShowSingleEditorTabAction;
registerAction2(HideEditorTabsAction);
registerAction2(ZenHideEditorTabsAction);
registerAction2(ShowMultipleEditorTabsAction);
registerAction2(ZenShowMultipleEditorTabsAction);
registerAction2(ShowSingleEditorTabAction);
registerAction2(ZenShowSingleEditorTabAction);
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
  submenu: MenuId.EditorTabsBarShowTabsSubmenu,
  title: localize("tabBar", "Tab Bar"),
  group: "3_workbench_layout_move",
  order: 10,
  when: InEditorZenModeContext.negate()
});
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
  submenu: MenuId.EditorTabsBarShowTabsZenModeSubmenu,
  title: localize("tabBar", "Tab Bar"),
  group: "3_workbench_layout_move",
  order: 10,
  when: InEditorZenModeContext
});
const _EditorActionsTitleBarAction = class _EditorActionsTitleBarAction extends Action2 {
  constructor() {
    super({
      id: _EditorActionsTitleBarAction.ID,
      title: localize2("moveEditorActionsToTitleBar", "Move Editor Actions to Title Bar"),
      category: Categories.View,
      precondition: ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.TITLEBAR).negate(),
      metadata: { description: localize2("moveEditorActionsToTitleBarDescription", "Move Editor Actions from the tab bar to the title bar") },
      f1: true
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    return configurationService.updateValue(LayoutSettings.EDITOR_ACTIONS_LOCATION, EditorActionsLocation.TITLEBAR);
  }
};
_EditorActionsTitleBarAction.ID = "workbench.action.editorActionsTitleBar";
let EditorActionsTitleBarAction = _EditorActionsTitleBarAction;
registerAction2(EditorActionsTitleBarAction);
const _EditorActionsDefaultAction = class _EditorActionsDefaultAction extends Action2 {
  constructor() {
    super({
      id: _EditorActionsDefaultAction.ID,
      title: localize2("moveEditorActionsToTabBar", "Move Editor Actions to Tab Bar"),
      category: Categories.View,
      precondition: ContextKeyExpr.and(
        ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.DEFAULT).negate(),
        ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.NONE).negate()
      ),
      metadata: { description: localize2("moveEditorActionsToTabBarDescription", "Move Editor Actions from the title bar to the tab bar") },
      f1: true
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    return configurationService.updateValue(LayoutSettings.EDITOR_ACTIONS_LOCATION, EditorActionsLocation.DEFAULT);
  }
};
_EditorActionsDefaultAction.ID = "workbench.action.editorActionsDefault";
let EditorActionsDefaultAction = _EditorActionsDefaultAction;
registerAction2(EditorActionsDefaultAction);
const _HideEditorActionsAction = class _HideEditorActionsAction extends Action2 {
  constructor() {
    super({
      id: _HideEditorActionsAction.ID,
      title: localize2("hideEditorActons", "Hide Editor Actions"),
      category: Categories.View,
      precondition: ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.HIDDEN).negate(),
      metadata: { description: localize2("hideEditorActonsDescription", "Hide Editor Actions in the tab and title bar") },
      f1: true
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    return configurationService.updateValue(LayoutSettings.EDITOR_ACTIONS_LOCATION, EditorActionsLocation.HIDDEN);
  }
};
_HideEditorActionsAction.ID = "workbench.action.hideEditorActions";
let HideEditorActionsAction = _HideEditorActionsAction;
registerAction2(HideEditorActionsAction);
const _ShowEditorActionsAction = class _ShowEditorActionsAction extends Action2 {
  constructor() {
    super({
      id: _ShowEditorActionsAction.ID,
      title: localize2("showEditorActons", "Show Editor Actions"),
      category: Categories.View,
      precondition: ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_ACTIONS_LOCATION}`, EditorActionsLocation.HIDDEN),
      metadata: { description: localize2("showEditorActonsDescription", "Make Editor Actions visible.") },
      f1: true
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    return configurationService.updateValue(LayoutSettings.EDITOR_ACTIONS_LOCATION, EditorActionsLocation.DEFAULT);
  }
};
_ShowEditorActionsAction.ID = "workbench.action.showEditorActions";
let ShowEditorActionsAction = _ShowEditorActionsAction;
registerAction2(ShowEditorActionsAction);
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
  submenu: MenuId.EditorActionsPositionSubmenu,
  title: localize("editorActionsPosition", "Editor Actions Position"),
  group: "3_workbench_layout_move",
  order: 11
});
const _ConfigureEditorTabsAction = class _ConfigureEditorTabsAction extends Action2 {
  constructor() {
    super({
      id: _ConfigureEditorTabsAction.ID,
      title: localize2("configureTabs", "Configure Tabs"),
      category: Categories.View
    });
  }
  run(accessor) {
    const preferencesService = accessor.get(IPreferencesService);
    preferencesService.openSettings({ jsonEditor: false, query: "workbench.editor tab" });
  }
};
_ConfigureEditorTabsAction.ID = "workbench.action.configureEditorTabs";
let ConfigureEditorTabsAction = _ConfigureEditorTabsAction;
registerAction2(ConfigureEditorTabsAction);
const _ConfigureEditorAction = class _ConfigureEditorAction extends Action2 {
  constructor() {
    super({
      id: _ConfigureEditorAction.ID,
      title: localize2("configureEditors", "Configure Editors"),
      category: Categories.View
    });
  }
  run(accessor) {
    const preferencesService = accessor.get(IPreferencesService);
    preferencesService.openSettings({ jsonEditor: false, query: "workbench.editor" });
  }
};
_ConfigureEditorAction.ID = "workbench.action.configureEditor";
let ConfigureEditorAction = _ConfigureEditorAction;
registerAction2(ConfigureEditorAction);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleSeparatePinnedEditorTabs",
      title: localize2("toggleSeparatePinnedEditorTabs", "Separate Pinned Editor Tabs"),
      category: Categories.View,
      precondition: ContextKeyExpr.equals(`config.${LayoutSettings.EDITOR_TABS_MODE}`, EditorTabsMode.MULTIPLE),
      metadata: { description: localize2("toggleSeparatePinnedEditorTabsDescription", "Toggle whether pinned editor tabs are shown on a separate row above unpinned tabs.") },
      f1: true
    });
  }
  run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    const oldettingValue = configurationService.getValue("workbench.editor.pinnedTabsOnSeparateRow");
    const newSettingValue = !oldettingValue;
    return configurationService.updateValue("workbench.editor.pinnedTabsOnSeparateRow", newSettingValue);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleZenMode",
      title: {
        ...localize2("toggleZenMode", "Toggle Zen Mode"),
        mnemonicTitle: localize({ key: "miToggleZenMode", comment: ["&& denotes a mnemonic"] }, "Zen Mode")
      },
      precondition: IsAuxiliaryWindowFocusedContext.toNegated(),
      category: Categories.View,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyZ)
      },
      toggled: InEditorZenModeContext,
      menu: [{
        id: MenuId.MenubarAppearanceMenu,
        group: "1_toggle_view",
        order: 2
      }]
    });
  }
  run(accessor) {
    return accessor.get(IWorkbenchLayoutService).toggleZenMode();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "workbench.action.exitZenMode",
  weight: KeybindingWeight.EditorContrib - 1e3,
  handler(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const contextKeyService = accessor.get(IContextKeyService);
    if (InEditorZenModeContext.getValue(contextKeyService)) {
      layoutService.toggleZenMode();
    }
  },
  when: InEditorZenModeContext,
  primary: KeyChord(KeyCode.Escape, KeyCode.Escape)
});
if (isWindows || isLinux || isWeb) {
  registerAction2(class ToggleMenubarAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.toggleMenuBar",
        title: {
          ...localize2("toggleMenuBar", "Toggle Menu Bar"),
          mnemonicTitle: localize({ key: "miMenuBar", comment: ["&& denotes a mnemonic"] }, "Menu &&Bar")
        },
        category: Categories.View,
        f1: true,
        toggled: ContextKeyExpr.and(IsMacNativeContext.toNegated(), ContextKeyExpr.notEquals("config.window.menuBarVisibility", "hidden"), ContextKeyExpr.notEquals("config.window.menuBarVisibility", "toggle"), ContextKeyExpr.notEquals("config.window.menuBarVisibility", "compact")),
        menu: [{
          id: MenuId.MenubarAppearanceMenu,
          group: "2_workbench_layout",
          order: 0
        }]
      });
    }
    run(accessor) {
      return accessor.get(IWorkbenchLayoutService).toggleMenuBar();
    }
  });
  for (const menuId of [MenuId.TitleBarContext, MenuId.TitleBarTitleContext]) {
    MenuRegistry.appendMenuItem(menuId, {
      command: {
        id: "workbench.action.toggleMenuBar",
        title: localize("miMenuBarNoMnemonic", "Menu Bar"),
        toggled: ContextKeyExpr.and(IsMacNativeContext.toNegated(), ContextKeyExpr.notEquals("config.window.menuBarVisibility", "hidden"), ContextKeyExpr.notEquals("config.window.menuBarVisibility", "toggle"), ContextKeyExpr.notEquals("config.window.menuBarVisibility", "compact"))
      },
      when: ContextKeyExpr.and(IsAuxiliaryWindowFocusedContext.toNegated(), ContextKeyExpr.notEquals(TitleBarStyleContext.key, TitlebarStyle.NATIVE), IsMainWindowFullscreenContext.negate()),
      group: "2_config",
      order: 0
    });
  }
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.resetViewLocations",
      title: localize2("resetViewLocations", "Reset View Locations"),
      category: Categories.View,
      f1: true
    });
  }
  run(accessor) {
    return accessor.get(IViewDescriptorService).reset();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.moveView",
      title: localize2("moveView", "Move View"),
      category: Categories.View,
      f1: true
    });
  }
  async run(accessor) {
    const viewDescriptorService = accessor.get(IViewDescriptorService);
    const instantiationService = accessor.get(IInstantiationService);
    const quickInputService = accessor.get(IQuickInputService);
    const contextKeyService = accessor.get(IContextKeyService);
    const paneCompositePartService = accessor.get(IPaneCompositePartService);
    const focusedViewId = FocusedViewContext.getValue(contextKeyService);
    let viewId;
    if (focusedViewId && viewDescriptorService.getViewDescriptorById(focusedViewId)?.canMoveView) {
      viewId = focusedViewId;
    }
    try {
      viewId = await this.getView(quickInputService, viewDescriptorService, paneCompositePartService, viewId);
      if (!viewId) {
        return;
      }
      const moveFocusedViewAction = new MoveFocusedViewAction();
      instantiationService.invokeFunction((accessor2) => moveFocusedViewAction.run(accessor2, viewId));
    } catch {
    }
  }
  getViewItems(viewDescriptorService, paneCompositePartService) {
    const results = [];
    const viewlets = paneCompositePartService.getVisiblePaneCompositeIds(ViewContainerLocation.Sidebar);
    viewlets.forEach((viewletId) => {
      const container = viewDescriptorService.getViewContainerById(viewletId);
      const containerModel = viewDescriptorService.getViewContainerModel(container);
      let hasAddedView = false;
      containerModel.visibleViewDescriptors.forEach((viewDescriptor) => {
        if (viewDescriptor.canMoveView) {
          if (!hasAddedView) {
            results.push({
              type: "separator",
              label: localize("sidebarContainer", "Side Bar / {0}", containerModel.title)
            });
            hasAddedView = true;
          }
          results.push({
            id: viewDescriptor.id,
            label: viewDescriptor.name.value
          });
        }
      });
    });
    const panels = paneCompositePartService.getPinnedPaneCompositeIds(ViewContainerLocation.Panel);
    panels.forEach((panel) => {
      const container = viewDescriptorService.getViewContainerById(panel);
      const containerModel = viewDescriptorService.getViewContainerModel(container);
      let hasAddedView = false;
      containerModel.visibleViewDescriptors.forEach((viewDescriptor) => {
        if (viewDescriptor.canMoveView) {
          if (!hasAddedView) {
            results.push({
              type: "separator",
              label: localize("panelContainer", "Panel / {0}", containerModel.title)
            });
            hasAddedView = true;
          }
          results.push({
            id: viewDescriptor.id,
            label: viewDescriptor.name.value
          });
        }
      });
    });
    const sidePanels = paneCompositePartService.getPinnedPaneCompositeIds(ViewContainerLocation.AuxiliaryBar);
    sidePanels.forEach((panel) => {
      const container = viewDescriptorService.getViewContainerById(panel);
      const containerModel = viewDescriptorService.getViewContainerModel(container);
      let hasAddedView = false;
      containerModel.visibleViewDescriptors.forEach((viewDescriptor) => {
        if (viewDescriptor.canMoveView) {
          if (!hasAddedView) {
            results.push({
              type: "separator",
              label: localize("secondarySideBarContainer", "Void Side Bar / {0}", containerModel.title)
            });
            hasAddedView = true;
          }
          results.push({
            id: viewDescriptor.id,
            label: viewDescriptor.name.value
          });
        }
      });
    });
    return results;
  }
  async getView(quickInputService, viewDescriptorService, paneCompositePartService, viewId) {
    const disposables = new DisposableStore();
    const quickPick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
    quickPick.placeholder = localize("moveFocusedView.selectView", "Select a View to Move");
    quickPick.items = this.getViewItems(viewDescriptorService, paneCompositePartService);
    quickPick.selectedItems = quickPick.items.filter((item) => item.id === viewId);
    return new Promise((resolve, reject) => {
      disposables.add(quickPick.onDidAccept(() => {
        const viewId2 = quickPick.selectedItems[0];
        if (viewId2.id) {
          resolve(viewId2.id);
        } else {
          reject();
        }
        quickPick.hide();
      }));
      disposables.add(quickPick.onDidHide(() => {
        disposables.dispose();
        reject();
      }));
      quickPick.show();
    });
  }
});
class MoveFocusedViewAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.moveFocusedView",
      title: localize2("moveFocusedView", "Move Focused View"),
      category: Categories.View,
      precondition: FocusedViewContext.notEqualsTo(""),
      f1: true
    });
  }
  run(accessor, viewId) {
    const viewDescriptorService = accessor.get(IViewDescriptorService);
    const viewsService = accessor.get(IViewsService);
    const quickInputService = accessor.get(IQuickInputService);
    const contextKeyService = accessor.get(IContextKeyService);
    const dialogService = accessor.get(IDialogService);
    const paneCompositePartService = accessor.get(IPaneCompositePartService);
    const focusedViewId = viewId || FocusedViewContext.getValue(contextKeyService);
    if (focusedViewId === void 0 || focusedViewId.trim() === "") {
      dialogService.error(localize("moveFocusedView.error.noFocusedView", "There is no view currently focused."));
      return;
    }
    const viewDescriptor = viewDescriptorService.getViewDescriptorById(focusedViewId);
    if (!viewDescriptor || !viewDescriptor.canMoveView) {
      dialogService.error(localize("moveFocusedView.error.nonMovableView", "The currently focused view is not movable."));
      return;
    }
    const disposables = new DisposableStore();
    const quickPick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
    quickPick.placeholder = localize("moveFocusedView.selectDestination", "Select a Destination for the View");
    quickPick.title = localize({ key: "moveFocusedView.title", comment: ["{0} indicates the title of the view the user has selected to move."] }, "View: Move {0}", viewDescriptor.name.value);
    const items = [];
    const currentContainer = viewDescriptorService.getViewContainerByViewId(focusedViewId);
    const currentLocation = viewDescriptorService.getViewLocationById(focusedViewId);
    const isViewSolo = viewDescriptorService.getViewContainerModel(currentContainer).allViewDescriptors.length === 1;
    if (!(isViewSolo && currentLocation === ViewContainerLocation.Panel)) {
      items.push({
        id: "_.panel.newcontainer",
        label: localize({ key: "moveFocusedView.newContainerInPanel", comment: ["Creates a new top-level tab in the panel."] }, "New Panel Entry")
      });
    }
    if (!(isViewSolo && currentLocation === ViewContainerLocation.Sidebar)) {
      items.push({
        id: "_.sidebar.newcontainer",
        label: localize("moveFocusedView.newContainerInSidebar", "New Side Bar Entry")
      });
    }
    if (!(isViewSolo && currentLocation === ViewContainerLocation.AuxiliaryBar)) {
      items.push({
        id: "_.auxiliarybar.newcontainer",
        label: localize("moveFocusedView.newContainerInSidePanel", "New Void Side Bar Entry")
      });
    }
    items.push({
      type: "separator",
      label: localize("sidebar", "Side Bar")
    });
    const pinnedViewlets = paneCompositePartService.getVisiblePaneCompositeIds(ViewContainerLocation.Sidebar);
    items.push(...pinnedViewlets.filter((viewletId) => {
      if (viewletId === viewDescriptorService.getViewContainerByViewId(focusedViewId).id) {
        return false;
      }
      return !viewDescriptorService.getViewContainerById(viewletId).rejectAddedViews;
    }).map((viewletId) => {
      return {
        id: viewletId,
        label: viewDescriptorService.getViewContainerModel(viewDescriptorService.getViewContainerById(viewletId)).title
      };
    }));
    items.push({
      type: "separator",
      label: localize("panel", "Panel")
    });
    const pinnedPanels = paneCompositePartService.getPinnedPaneCompositeIds(ViewContainerLocation.Panel);
    items.push(...pinnedPanels.filter((panel) => {
      if (panel === viewDescriptorService.getViewContainerByViewId(focusedViewId).id) {
        return false;
      }
      return !viewDescriptorService.getViewContainerById(panel).rejectAddedViews;
    }).map((panel) => {
      return {
        id: panel,
        label: viewDescriptorService.getViewContainerModel(viewDescriptorService.getViewContainerById(panel)).title
      };
    }));
    items.push({
      type: "separator",
      label: localize("secondarySideBar", "Void Side Bar")
    });
    const pinnedAuxPanels = paneCompositePartService.getPinnedPaneCompositeIds(ViewContainerLocation.AuxiliaryBar);
    items.push(...pinnedAuxPanels.filter((panel) => {
      if (panel === viewDescriptorService.getViewContainerByViewId(focusedViewId).id) {
        return false;
      }
      return !viewDescriptorService.getViewContainerById(panel).rejectAddedViews;
    }).map((panel) => {
      return {
        id: panel,
        label: viewDescriptorService.getViewContainerModel(viewDescriptorService.getViewContainerById(panel)).title
      };
    }));
    quickPick.items = items;
    disposables.add(quickPick.onDidAccept(() => {
      const destination = quickPick.selectedItems[0];
      if (destination.id === "_.panel.newcontainer") {
        viewDescriptorService.moveViewToLocation(viewDescriptor, ViewContainerLocation.Panel, this.desc.id);
        viewsService.openView(focusedViewId, true);
      } else if (destination.id === "_.sidebar.newcontainer") {
        viewDescriptorService.moveViewToLocation(viewDescriptor, ViewContainerLocation.Sidebar, this.desc.id);
        viewsService.openView(focusedViewId, true);
      } else if (destination.id === "_.auxiliarybar.newcontainer") {
        viewDescriptorService.moveViewToLocation(viewDescriptor, ViewContainerLocation.AuxiliaryBar, this.desc.id);
        viewsService.openView(focusedViewId, true);
      } else if (destination.id) {
        viewDescriptorService.moveViewsToContainer([viewDescriptor], viewDescriptorService.getViewContainerById(destination.id), void 0, this.desc.id);
        viewsService.openView(focusedViewId, true);
      }
      quickPick.hide();
    }));
    disposables.add(quickPick.onDidHide(() => disposables.dispose()));
    quickPick.show();
  }
}
registerAction2(MoveFocusedViewAction);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.resetFocusedViewLocation",
      title: localize2("resetFocusedViewLocation", "Reset Focused View Location"),
      category: Categories.View,
      f1: true,
      precondition: FocusedViewContext.notEqualsTo("")
    });
  }
  run(accessor) {
    const viewDescriptorService = accessor.get(IViewDescriptorService);
    const contextKeyService = accessor.get(IContextKeyService);
    const dialogService = accessor.get(IDialogService);
    const viewsService = accessor.get(IViewsService);
    const focusedViewId = FocusedViewContext.getValue(contextKeyService);
    let viewDescriptor = null;
    if (focusedViewId !== void 0 && focusedViewId.trim() !== "") {
      viewDescriptor = viewDescriptorService.getViewDescriptorById(focusedViewId);
    }
    if (!viewDescriptor) {
      dialogService.error(localize("resetFocusedView.error.noFocusedView", "There is no view currently focused."));
      return;
    }
    const defaultContainer = viewDescriptorService.getDefaultContainerById(viewDescriptor.id);
    if (!defaultContainer || defaultContainer === viewDescriptorService.getViewContainerByViewId(viewDescriptor.id)) {
      return;
    }
    viewDescriptorService.moveViewsToContainer([viewDescriptor], defaultContainer, void 0, this.desc.id);
    viewsService.openView(viewDescriptor.id, true);
  }
});
class BaseResizeViewAction extends Action2 {
  // This is a css pixel size
  resizePart(widthChange, heightChange, layoutService, partToResize) {
    let part;
    if (partToResize === void 0) {
      const isEditorFocus = layoutService.hasFocus(Parts.EDITOR_PART);
      const isSidebarFocus = layoutService.hasFocus(Parts.SIDEBAR_PART);
      const isPanelFocus = layoutService.hasFocus(Parts.PANEL_PART);
      const isAuxiliaryBarFocus = layoutService.hasFocus(Parts.AUXILIARYBAR_PART);
      if (isSidebarFocus) {
        part = Parts.SIDEBAR_PART;
      } else if (isPanelFocus) {
        part = Parts.PANEL_PART;
      } else if (isEditorFocus) {
        part = Parts.EDITOR_PART;
      } else if (isAuxiliaryBarFocus) {
        part = Parts.AUXILIARYBAR_PART;
      }
    } else {
      part = partToResize;
    }
    if (part) {
      layoutService.resizePart(part, widthChange, heightChange);
    }
  }
}
BaseResizeViewAction.RESIZE_INCREMENT = 60;
class IncreaseViewSizeAction extends BaseResizeViewAction {
  constructor() {
    super({
      id: "workbench.action.increaseViewSize",
      title: localize2("increaseViewSize", "Increase Current View Size"),
      f1: true,
      precondition: IsAuxiliaryWindowFocusedContext.toNegated()
    });
  }
  run(accessor) {
    this.resizePart(BaseResizeViewAction.RESIZE_INCREMENT, BaseResizeViewAction.RESIZE_INCREMENT, accessor.get(IWorkbenchLayoutService));
  }
}
class IncreaseViewWidthAction extends BaseResizeViewAction {
  constructor() {
    super({
      id: "workbench.action.increaseViewWidth",
      title: localize2("increaseEditorWidth", "Increase Editor Width"),
      f1: true,
      precondition: IsAuxiliaryWindowFocusedContext.toNegated()
    });
  }
  run(accessor) {
    this.resizePart(BaseResizeViewAction.RESIZE_INCREMENT, 0, accessor.get(IWorkbenchLayoutService), Parts.EDITOR_PART);
  }
}
class IncreaseViewHeightAction extends BaseResizeViewAction {
  constructor() {
    super({
      id: "workbench.action.increaseViewHeight",
      title: localize2("increaseEditorHeight", "Increase Editor Height"),
      f1: true,
      precondition: IsAuxiliaryWindowFocusedContext.toNegated()
    });
  }
  run(accessor) {
    this.resizePart(0, BaseResizeViewAction.RESIZE_INCREMENT, accessor.get(IWorkbenchLayoutService), Parts.EDITOR_PART);
  }
}
class DecreaseViewSizeAction extends BaseResizeViewAction {
  constructor() {
    super({
      id: "workbench.action.decreaseViewSize",
      title: localize2("decreaseViewSize", "Decrease Current View Size"),
      f1: true,
      precondition: IsAuxiliaryWindowFocusedContext.toNegated()
    });
  }
  run(accessor) {
    this.resizePart(-BaseResizeViewAction.RESIZE_INCREMENT, -BaseResizeViewAction.RESIZE_INCREMENT, accessor.get(IWorkbenchLayoutService));
  }
}
class DecreaseViewWidthAction extends BaseResizeViewAction {
  constructor() {
    super({
      id: "workbench.action.decreaseViewWidth",
      title: localize2("decreaseEditorWidth", "Decrease Editor Width"),
      f1: true,
      precondition: IsAuxiliaryWindowFocusedContext.toNegated()
    });
  }
  run(accessor) {
    this.resizePart(-BaseResizeViewAction.RESIZE_INCREMENT, 0, accessor.get(IWorkbenchLayoutService), Parts.EDITOR_PART);
  }
}
class DecreaseViewHeightAction extends BaseResizeViewAction {
  constructor() {
    super({
      id: "workbench.action.decreaseViewHeight",
      title: localize2("decreaseEditorHeight", "Decrease Editor Height"),
      f1: true,
      precondition: IsAuxiliaryWindowFocusedContext.toNegated()
    });
  }
  run(accessor) {
    this.resizePart(0, -BaseResizeViewAction.RESIZE_INCREMENT, accessor.get(IWorkbenchLayoutService), Parts.EDITOR_PART);
  }
}
registerAction2(IncreaseViewSizeAction);
registerAction2(IncreaseViewWidthAction);
registerAction2(IncreaseViewHeightAction);
registerAction2(DecreaseViewSizeAction);
registerAction2(DecreaseViewWidthAction);
registerAction2(DecreaseViewHeightAction);
registerAction2(class AlignQuickInputTopAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.alignQuickInputTop",
      title: localize2("alignQuickInputTop", "Align Quick Input Top"),
      f1: false
    });
  }
  run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    quickInputService.setAlignment("top");
  }
});
registerAction2(class AlignQuickInputCenterAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.alignQuickInputCenter",
      title: localize2("alignQuickInputCenter", "Align Quick Input Center"),
      f1: false
    });
  }
  run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    quickInputService.setAlignment("center");
  }
});
function isContextualLayoutVisualIcon(icon) {
  return icon.iconA !== void 0;
}
const CreateToggleLayoutItem = (id, active, label, visualIcon) => {
  return {
    id,
    active,
    label,
    visualIcon,
    activeIcon: Codicon.eye,
    inactiveIcon: Codicon.eyeClosed,
    activeAriaLabel: localize("selectToHide", "Select to Hide"),
    inactiveAriaLabel: localize("selectToShow", "Select to Show"),
    useButtons: true
  };
};
const CreateOptionLayoutItem = (id, active, label, visualIcon) => {
  return {
    id,
    active,
    label,
    visualIcon,
    activeIcon: Codicon.check,
    activeAriaLabel: localize("active", "Active"),
    useButtons: false
  };
};
const MenuBarToggledContext = ContextKeyExpr.and(IsMacNativeContext.toNegated(), ContextKeyExpr.notEquals("config.window.menuBarVisibility", "hidden"), ContextKeyExpr.notEquals("config.window.menuBarVisibility", "toggle"), ContextKeyExpr.notEquals("config.window.menuBarVisibility", "compact"));
const ToggleVisibilityActions = [];
if (!isMacintosh || !isNative) {
  ToggleVisibilityActions.push(CreateToggleLayoutItem("workbench.action.toggleMenuBar", MenuBarToggledContext, localize("menuBar", "Menu Bar"), menubarIcon));
}
ToggleVisibilityActions.push(...[
  CreateToggleLayoutItem(ToggleActivityBarVisibilityActionId, ContextKeyExpr.notEquals("config.workbench.activityBar.location", "hidden"), localize("activityBar", "Activity Bar"), { whenA: ContextKeyExpr.equals("config.workbench.sideBar.location", "left"), iconA: activityBarLeftIcon, iconB: activityBarRightIcon }),
  CreateToggleLayoutItem(ToggleSidebarVisibilityAction.ID, SideBarVisibleContext, localize("sideBar", "Primary Side Bar"), { whenA: ContextKeyExpr.equals("config.workbench.sideBar.location", "left"), iconA: panelLeftIcon, iconB: panelRightIcon }),
  CreateToggleLayoutItem(ToggleAuxiliaryBarAction.ID, AuxiliaryBarVisibleContext, localize("secondarySideBar", "Void Side Bar"), { whenA: ContextKeyExpr.equals("config.workbench.sideBar.location", "left"), iconA: panelRightIcon, iconB: panelLeftIcon }),
  CreateToggleLayoutItem(TogglePanelAction.ID, PanelVisibleContext, localize("panel", "Panel"), panelIcon),
  CreateToggleLayoutItem(ToggleStatusbarVisibilityAction.ID, ContextKeyExpr.equals("config.workbench.statusBar.visible", true), localize("statusBar", "Status Bar"), statusBarIcon)
]);
const MoveSideBarActions = [
  CreateOptionLayoutItem(MoveSidebarLeftAction.ID, ContextKeyExpr.equals("config.workbench.sideBar.location", "left"), localize("leftSideBar", "Left"), panelLeftIcon),
  CreateOptionLayoutItem(MoveSidebarRightAction.ID, ContextKeyExpr.equals("config.workbench.sideBar.location", "right"), localize("rightSideBar", "Right"), panelRightIcon)
];
const AlignPanelActions = [
  CreateOptionLayoutItem("workbench.action.alignPanelLeft", PanelAlignmentContext.isEqualTo("left"), localize("leftPanel", "Left"), panelAlignmentLeftIcon),
  CreateOptionLayoutItem("workbench.action.alignPanelRight", PanelAlignmentContext.isEqualTo("right"), localize("rightPanel", "Right"), panelAlignmentRightIcon),
  CreateOptionLayoutItem("workbench.action.alignPanelCenter", PanelAlignmentContext.isEqualTo("center"), localize("centerPanel", "Center"), panelAlignmentCenterIcon),
  CreateOptionLayoutItem("workbench.action.alignPanelJustify", PanelAlignmentContext.isEqualTo("justify"), localize("justifyPanel", "Justify"), panelAlignmentJustifyIcon)
];
const QuickInputActions = [
  CreateOptionLayoutItem("workbench.action.alignQuickInputTop", QuickInputAlignmentContextKey.isEqualTo("top"), localize("top", "Top"), quickInputAlignmentTopIcon),
  CreateOptionLayoutItem("workbench.action.alignQuickInputCenter", QuickInputAlignmentContextKey.isEqualTo("center"), localize("center", "Center"), quickInputAlignmentCenterIcon)
];
const MiscLayoutOptions = [
  CreateOptionLayoutItem("workbench.action.toggleFullScreen", IsMainWindowFullscreenContext, localize("fullscreen", "Full Screen"), fullscreenIcon),
  CreateOptionLayoutItem("workbench.action.toggleZenMode", InEditorZenModeContext, localize("zenMode", "Zen Mode"), zenModeIcon),
  CreateOptionLayoutItem("workbench.action.toggleCenteredLayout", IsMainEditorCenteredLayoutContext, localize("centeredLayout", "Centered Layout"), centerLayoutIcon)
];
const LayoutContextKeySet = /* @__PURE__ */ new Set();
for (const { active } of [...ToggleVisibilityActions, ...MoveSideBarActions, ...AlignPanelActions, ...QuickInputActions, ...MiscLayoutOptions]) {
  for (const key of active.keys()) {
    LayoutContextKeySet.add(key);
  }
}
registerAction2(class CustomizeLayoutAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.customizeLayout",
      title: localize2("customizeLayout", "Customize Layout..."),
      f1: true,
      icon: configureLayoutIcon,
      menu: [
        {
          id: MenuId.LayoutControlMenuSubmenu,
          group: "z_end"
        },
        {
          id: MenuId.LayoutControlMenu,
          when: ContextKeyExpr.equals("config.workbench.layoutControl.type", "both"),
          group: "1_layout"
        }
      ]
    });
  }
  getItems(contextKeyService, keybindingService) {
    const toQuickPickItem = (item) => {
      const toggled = item.active.evaluate(contextKeyService.getContext(null));
      let label = item.useButtons ? item.label : item.label + (toggled && item.activeIcon ? ` $(${item.activeIcon.id})` : !toggled && item.inactiveIcon ? ` $(${item.inactiveIcon.id})` : "");
      const ariaLabel = item.label + (toggled && item.activeAriaLabel ? ` (${item.activeAriaLabel})` : !toggled && item.inactiveAriaLabel ? ` (${item.inactiveAriaLabel})` : "");
      if (item.visualIcon) {
        let icon2 = item.visualIcon;
        if (isContextualLayoutVisualIcon(icon2)) {
          const useIconA = icon2.whenA.evaluate(contextKeyService.getContext(null));
          icon2 = useIconA ? icon2.iconA : icon2.iconB;
        }
        label = `$(${icon2.id}) ${label}`;
      }
      const icon = toggled ? item.activeIcon : item.inactiveIcon;
      return {
        type: "item",
        id: item.id,
        label,
        ariaLabel,
        keybinding: keybindingService.lookupKeybinding(item.id, contextKeyService),
        buttons: !item.useButtons ? void 0 : [
          {
            alwaysVisible: false,
            tooltip: ariaLabel,
            iconClass: icon ? ThemeIcon.asClassName(icon) : void 0
          }
        ]
      };
    };
    return [
      {
        type: "separator",
        label: localize("toggleVisibility", "Visibility")
      },
      ...ToggleVisibilityActions.map(toQuickPickItem),
      {
        type: "separator",
        label: localize("sideBarPosition", "Primary Side Bar Position")
      },
      ...MoveSideBarActions.map(toQuickPickItem),
      {
        type: "separator",
        label: localize("panelAlignment", "Panel Alignment")
      },
      ...AlignPanelActions.map(toQuickPickItem),
      {
        type: "separator",
        label: localize("quickOpen", "Quick Input Position")
      },
      ...QuickInputActions.map(toQuickPickItem),
      {
        type: "separator",
        label: localize("layoutModes", "Modes")
      },
      ...MiscLayoutOptions.map(toQuickPickItem)
    ];
  }
  run(accessor) {
    if (this._currentQuickPick) {
      this._currentQuickPick.hide();
      return;
    }
    const configurationService = accessor.get(IConfigurationService);
    const contextKeyService = accessor.get(IContextKeyService);
    const commandService = accessor.get(ICommandService);
    const quickInputService = accessor.get(IQuickInputService);
    const keybindingService = accessor.get(IKeybindingService);
    const disposables = new DisposableStore();
    const quickPick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
    this._currentQuickPick = quickPick;
    quickPick.items = this.getItems(contextKeyService, keybindingService);
    quickPick.ignoreFocusOut = true;
    quickPick.hideInput = true;
    quickPick.title = localize("customizeLayoutQuickPickTitle", "Customize Layout");
    const closeButton = {
      alwaysVisible: true,
      iconClass: ThemeIcon.asClassName(Codicon.close),
      tooltip: localize("close", "Close")
    };
    const resetButton = {
      alwaysVisible: true,
      iconClass: ThemeIcon.asClassName(Codicon.discard),
      tooltip: localize("restore defaults", "Restore Defaults")
    };
    quickPick.buttons = [
      resetButton,
      closeButton
    ];
    let selectedItem = void 0;
    disposables.add(contextKeyService.onDidChangeContext((changeEvent) => {
      if (changeEvent.affectsSome(LayoutContextKeySet)) {
        quickPick.items = this.getItems(contextKeyService, keybindingService);
        if (selectedItem) {
          quickPick.activeItems = quickPick.items.filter((item) => item.id === selectedItem?.id);
        }
        setTimeout(() => quickInputService.focus(), 0);
      }
    }));
    disposables.add(quickPick.onDidAccept((event) => {
      if (quickPick.selectedItems.length) {
        selectedItem = quickPick.selectedItems[0];
        commandService.executeCommand(selectedItem.id);
      }
    }));
    disposables.add(quickPick.onDidTriggerItemButton((event) => {
      if (event.item) {
        selectedItem = event.item;
        commandService.executeCommand(selectedItem.id);
      }
    }));
    disposables.add(quickPick.onDidTriggerButton((button) => {
      if (button === closeButton) {
        quickPick.hide();
      } else if (button === resetButton) {
        const resetSetting = (id) => {
          const config = configurationService.inspect(id);
          configurationService.updateValue(id, config.defaultValue);
        };
        resetSetting("workbench.activityBar.location");
        resetSetting("workbench.sideBar.location");
        resetSetting("workbench.statusBar.visible");
        resetSetting("workbench.panel.defaultLocation");
        if (!isMacintosh || !isNative) {
          resetSetting("window.menuBarVisibility");
        }
        commandService.executeCommand("workbench.action.alignPanelCenter");
        commandService.executeCommand("workbench.action.alignQuickInputTop");
      }
    }));
    disposables.add(quickPick.onDidHide(() => {
      quickPick.dispose();
    }));
    disposables.add(quickPick.onDispose(() => {
      this._currentQuickPick = void 0;
      disposables.dispose();
    }));
    quickPick.show();
  }
});
export {
  ConfigureEditorAction,
  ConfigureEditorTabsAction,
  EditorActionsDefaultAction,
  EditorActionsTitleBarAction,
  HideEditorActionsAction,
  HideEditorTabsAction,
  ShowEditorActionsAction,
  ShowMultipleEditorTabsAction,
  ShowSingleEditorTabAction,
  ToggleActivityBarVisibilityActionId,
  ToggleSidebarPositionAction,
  ToggleSidebarVisibilityAction,
  ToggleStatusbarVisibilityAction,
  ZenHideEditorTabsAction,
  ZenShowMultipleEditorTabsAction,
  ZenShowSingleEditorTabAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9hY3Rpb25zL2xheW91dEFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJTG9jYWxpemVkU3RyaW5nLCBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgTWVudVJlZ2lzdHJ5LCByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb25zTG9jYXRpb24sIEVkaXRvclRhYnNNb2RlLCBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgTGF5b3V0U2V0dGluZ3MsIFBhcnRzLCBQb3NpdGlvbiwgWmVuTW9kZVNldHRpbmdzLCBwb3NpdGlvblRvU3RyaW5nIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yLCBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleU1vZCwgS2V5Q29kZSwgS2V5Q2hvcmQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MsIGlzTGludXgsIGlzV2ViLCBpc01hY2ludG9zaCwgaXNOYXRpdmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJc01hY05hdGl2ZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nc1JlZ2lzdHJ5LCBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgQ29udGV4dEtleUV4cHJlc3Npb24sIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLCBJVmlld0Rlc2NyaXB0b3IsIFZpZXdDb250YWluZXJMb2NhdGlvblRvU3RyaW5nIH0gZnJvbSAnLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFF1aWNrUGlja0l0ZW0sIElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0sIElRdWlja1BpY2tTZXBhcmF0b3IsIElRdWlja1BpY2sgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvcGFuZWNvbXBvc2l0ZS9icm93c2VyL3BhbmVjb21wb3NpdGUuanMnO1xuaW1wb3J0IHsgVG9nZ2xlQXV4aWxpYXJ5QmFyQWN0aW9uIH0gZnJvbSAnLi4vcGFydHMvYXV4aWxpYXJ5YmFyL2F1eGlsaWFyeUJhckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgVG9nZ2xlUGFuZWxBY3Rpb24gfSBmcm9tICcuLi9wYXJ0cy9wYW5lbC9wYW5lbEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IEF1eGlsaWFyeUJhclZpc2libGVDb250ZXh0LCBQYW5lbEFsaWdubWVudENvbnRleHQsIFBhbmVsVmlzaWJsZUNvbnRleHQsIFNpZGVCYXJWaXNpYmxlQ29udGV4dCwgRm9jdXNlZFZpZXdDb250ZXh0LCBJbkVkaXRvclplbk1vZGVDb250ZXh0LCBJc01haW5FZGl0b3JDZW50ZXJlZExheW91dENvbnRleHQsIE1haW5FZGl0b3JBcmVhVmlzaWJsZUNvbnRleHQsIElzTWFpbldpbmRvd0Z1bGxzY3JlZW5Db250ZXh0LCBQYW5lbFBvc2l0aW9uQ29udGV4dCwgSXNBdXhpbGlhcnlXaW5kb3dGb2N1c2VkQ29udGV4dCwgVGl0bGVCYXJTdHlsZUNvbnRleHQgfSBmcm9tICcuLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZEFjdGlvblRpdGxlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb24uanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBUaXRsZWJhclN0eWxlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBRdWlja0lucHV0QWxpZ25tZW50Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvYnJvd3Nlci9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcblxuLy8gUmVnaXN0ZXIgSWNvbnNcbmNvbnN0IG1lbnViYXJJY29uID0gcmVnaXN0ZXJJY29uKCdtZW51QmFyJywgQ29kaWNvbi5sYXlvdXRNZW51YmFyLCBsb2NhbGl6ZSgnbWVudUJhckljb24nLCBcIlJlcHJlc2VudHMgdGhlIG1lbnUgYmFyXCIpKTtcbmNvbnN0IGFjdGl2aXR5QmFyTGVmdEljb24gPSByZWdpc3Rlckljb24oJ2FjdGl2aXR5LWJhci1sZWZ0JywgQ29kaWNvbi5sYXlvdXRBY3Rpdml0eWJhckxlZnQsIGxvY2FsaXplKCdhY3Rpdml0eUJhckxlZnQnLCBcIlJlcHJlc2VudHMgdGhlIGFjdGl2aXR5IGJhciBpbiB0aGUgbGVmdCBwb3NpdGlvblwiKSk7XG5jb25zdCBhY3Rpdml0eUJhclJpZ2h0SWNvbiA9IHJlZ2lzdGVySWNvbignYWN0aXZpdHktYmFyLXJpZ2h0JywgQ29kaWNvbi5sYXlvdXRBY3Rpdml0eWJhclJpZ2h0LCBsb2NhbGl6ZSgnYWN0aXZpdHlCYXJSaWdodCcsIFwiUmVwcmVzZW50cyB0aGUgYWN0aXZpdHkgYmFyIGluIHRoZSByaWdodCBwb3NpdGlvblwiKSk7XG5jb25zdCBwYW5lbExlZnRJY29uID0gcmVnaXN0ZXJJY29uKCdwYW5lbC1sZWZ0JywgQ29kaWNvbi5sYXlvdXRTaWRlYmFyTGVmdCwgbG9jYWxpemUoJ3BhbmVsTGVmdCcsIFwiUmVwcmVzZW50cyBhIHNpZGUgYmFyIGluIHRoZSBsZWZ0IHBvc2l0aW9uXCIpKTtcbmNvbnN0IHBhbmVsTGVmdE9mZkljb24gPSByZWdpc3Rlckljb24oJ3BhbmVsLWxlZnQtb2ZmJywgQ29kaWNvbi5sYXlvdXRTaWRlYmFyTGVmdE9mZiwgbG9jYWxpemUoJ3BhbmVsTGVmdE9mZicsIFwiUmVwcmVzZW50cyBhIHNpZGUgYmFyIGluIHRoZSBsZWZ0IHBvc2l0aW9uIHRvZ2dsZWQgb2ZmXCIpKTtcbmNvbnN0IHBhbmVsUmlnaHRJY29uID0gcmVnaXN0ZXJJY29uKCdwYW5lbC1yaWdodCcsIENvZGljb24ubGF5b3V0U2lkZWJhclJpZ2h0LCBsb2NhbGl6ZSgncGFuZWxSaWdodCcsIFwiUmVwcmVzZW50cyBzaWRlIGJhciBpbiB0aGUgcmlnaHQgcG9zaXRpb25cIikpO1xuY29uc3QgcGFuZWxSaWdodE9mZkljb24gPSByZWdpc3Rlckljb24oJ3BhbmVsLXJpZ2h0LW9mZicsIENvZGljb24ubGF5b3V0U2lkZWJhclJpZ2h0T2ZmLCBsb2NhbGl6ZSgncGFuZWxSaWdodE9mZicsIFwiUmVwcmVzZW50cyBzaWRlIGJhciBpbiB0aGUgcmlnaHQgcG9zaXRpb24gdG9nZ2xlZCBvZmZcIikpO1xuY29uc3QgcGFuZWxJY29uID0gcmVnaXN0ZXJJY29uKCdwYW5lbC1ib3R0b20nLCBDb2RpY29uLmxheW91dFBhbmVsLCBsb2NhbGl6ZSgncGFuZWxCb3R0b20nLCBcIlJlcHJlc2VudHMgdGhlIGJvdHRvbSBwYW5lbFwiKSk7XG5jb25zdCBzdGF0dXNCYXJJY29uID0gcmVnaXN0ZXJJY29uKCdzdGF0dXNCYXInLCBDb2RpY29uLmxheW91dFN0YXR1c2JhciwgbG9jYWxpemUoJ3N0YXR1c0Jhckljb24nLCBcIlJlcHJlc2VudHMgdGhlIHN0YXR1cyBiYXJcIikpO1xuXG5jb25zdCBwYW5lbEFsaWdubWVudExlZnRJY29uID0gcmVnaXN0ZXJJY29uKCdwYW5lbC1hbGlnbi1sZWZ0JywgQ29kaWNvbi5sYXlvdXRQYW5lbExlZnQsIGxvY2FsaXplKCdwYW5lbEJvdHRvbUxlZnQnLCBcIlJlcHJlc2VudHMgdGhlIGJvdHRvbSBwYW5lbCBhbGlnbm1lbnQgc2V0IHRvIHRoZSBsZWZ0XCIpKTtcbmNvbnN0IHBhbmVsQWxpZ25tZW50UmlnaHRJY29uID0gcmVnaXN0ZXJJY29uKCdwYW5lbC1hbGlnbi1yaWdodCcsIENvZGljb24ubGF5b3V0UGFuZWxSaWdodCwgbG9jYWxpemUoJ3BhbmVsQm90dG9tUmlnaHQnLCBcIlJlcHJlc2VudHMgdGhlIGJvdHRvbSBwYW5lbCBhbGlnbm1lbnQgc2V0IHRvIHRoZSByaWdodFwiKSk7XG5jb25zdCBwYW5lbEFsaWdubWVudENlbnRlckljb24gPSByZWdpc3Rlckljb24oJ3BhbmVsLWFsaWduLWNlbnRlcicsIENvZGljb24ubGF5b3V0UGFuZWxDZW50ZXIsIGxvY2FsaXplKCdwYW5lbEJvdHRvbUNlbnRlcicsIFwiUmVwcmVzZW50cyB0aGUgYm90dG9tIHBhbmVsIGFsaWdubWVudCBzZXQgdG8gdGhlIGNlbnRlclwiKSk7XG5jb25zdCBwYW5lbEFsaWdubWVudEp1c3RpZnlJY29uID0gcmVnaXN0ZXJJY29uKCdwYW5lbC1hbGlnbi1qdXN0aWZ5JywgQ29kaWNvbi5sYXlvdXRQYW5lbEp1c3RpZnksIGxvY2FsaXplKCdwYW5lbEJvdHRvbUp1c3RpZnknLCBcIlJlcHJlc2VudHMgdGhlIGJvdHRvbSBwYW5lbCBhbGlnbm1lbnQgc2V0IHRvIGp1c3RpZmllZFwiKSk7XG5cbmNvbnN0IHF1aWNrSW5wdXRBbGlnbm1lbnRUb3BJY29uID0gcmVnaXN0ZXJJY29uKCdxdWlja0lucHV0QWxpZ25tZW50VG9wJywgQ29kaWNvbi5hcnJvd1VwLCBsb2NhbGl6ZSgncXVpY2tJbnB1dEFsaWdubWVudFRvcCcsIFwiUmVwcmVzZW50cyBxdWljayBpbnB1dCBhbGlnbm1lbnQgc2V0IHRvIHRoZSB0b3BcIikpO1xuY29uc3QgcXVpY2tJbnB1dEFsaWdubWVudENlbnRlckljb24gPSByZWdpc3Rlckljb24oJ3F1aWNrSW5wdXRBbGlnbm1lbnRDZW50ZXInLCBDb2RpY29uLmNpcmNsZSwgbG9jYWxpemUoJ3F1aWNrSW5wdXRBbGlnbm1lbnRDZW50ZXInLCBcIlJlcHJlc2VudHMgcXVpY2sgaW5wdXQgYWxpZ25tZW50IHNldCB0byB0aGUgY2VudGVyXCIpKTtcblxuY29uc3QgZnVsbHNjcmVlbkljb24gPSByZWdpc3Rlckljb24oJ2Z1bGxzY3JlZW4nLCBDb2RpY29uLnNjcmVlbkZ1bGwsIGxvY2FsaXplKCdmdWxsU2NyZWVuSWNvbicsIFwiUmVwcmVzZW50cyBmdWxsIHNjcmVlblwiKSk7XG5jb25zdCBjZW50ZXJMYXlvdXRJY29uID0gcmVnaXN0ZXJJY29uKCdjZW50ZXJMYXlvdXRJY29uJywgQ29kaWNvbi5sYXlvdXRDZW50ZXJlZCwgbG9jYWxpemUoJ2NlbnRlckxheW91dEljb24nLCBcIlJlcHJlc2VudHMgY2VudGVyZWQgbGF5b3V0IG1vZGVcIikpO1xuY29uc3QgemVuTW9kZUljb24gPSByZWdpc3Rlckljb24oJ3plbk1vZGUnLCBDb2RpY29uLnRhcmdldCwgbG9jYWxpemUoJ3plbk1vZGVJY29uJywgXCJSZXByZXNlbnRzIHplbiBtb2RlXCIpKTtcblxuZXhwb3J0IGNvbnN0IFRvZ2dsZUFjdGl2aXR5QmFyVmlzaWJpbGl0eUFjdGlvbklkID0gJ3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlQWN0aXZpdHlCYXJWaXNpYmlsaXR5JztcblxuLy8gLS0tIFRvZ2dsZSBDZW50ZXJlZCBMYXlvdXRcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZUNlbnRlcmVkTGF5b3V0Jyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLmxvY2FsaXplMigndG9nZ2xlQ2VudGVyZWRMYXlvdXQnLCBcIlRvZ2dsZSBDZW50ZXJlZCBMYXlvdXRcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlUb2dnbGVDZW50ZXJlZExheW91dCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkNlbnRlcmVkIExheW91dFwiKSxcblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IElzQXV4aWxpYXJ5V2luZG93Rm9jdXNlZENvbnRleHQudG9OZWdhdGVkKCksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR0b2dnbGVkOiBJc01haW5FZGl0b3JDZW50ZXJlZExheW91dENvbnRleHQsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJBcHBlYXJhbmNlTWVudSxcblx0XHRcdFx0Z3JvdXA6ICcxX3RvZ2dsZV92aWV3Jyxcblx0XHRcdFx0b3JkZXI6IDNcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXG5cdFx0bGF5b3V0U2VydmljZS5jZW50ZXJNYWluRWRpdG9yTGF5b3V0KCFsYXlvdXRTZXJ2aWNlLmlzTWFpbkVkaXRvckxheW91dENlbnRlcmVkKCkpO1xuXHRcdGVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cC5mb2N1cygpO1xuXHR9XG59KTtcblxuLy8gLS0tIFNldCBTaWRlYmFyIFBvc2l0aW9uXG5jb25zdCBzaWRlYmFyUG9zaXRpb25Db25maWd1cmF0aW9uS2V5ID0gJ3dvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uJztcblxuY2xhc3MgTW92ZVNpZGViYXJQb3NpdGlvbkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcihpZDogc3RyaW5nLCB0aXRsZTogSUNvbW1hbmRBY3Rpb25UaXRsZSwgcHJpdmF0ZSByZWFkb25seSBwb3NpdGlvbjogUG9zaXRpb24pIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZCxcblx0XHRcdHRpdGxlLFxuXHRcdFx0ZjE6IGZhbHNlXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSBsYXlvdXRTZXJ2aWNlLmdldFNpZGVCYXJQb3NpdGlvbigpO1xuXHRcdGlmIChwb3NpdGlvbiAhPT0gdGhpcy5wb3NpdGlvbikge1xuXHRcdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKHNpZGViYXJQb3NpdGlvbkNvbmZpZ3VyYXRpb25LZXksIHBvc2l0aW9uVG9TdHJpbmcodGhpcy5wb3NpdGlvbikpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBNb3ZlU2lkZWJhclJpZ2h0QWN0aW9uIGV4dGVuZHMgTW92ZVNpZGViYXJQb3NpdGlvbkFjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVTaWRlQmFyUmlnaHQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKE1vdmVTaWRlYmFyUmlnaHRBY3Rpb24uSUQsIGxvY2FsaXplMignbW92ZVNpZGViYXJSaWdodCcsIFwiTW92ZSBQcmltYXJ5IFNpZGUgQmFyIFJpZ2h0XCIpLCBQb3NpdGlvbi5SSUdIVCk7XG5cdH1cbn1cblxuY2xhc3MgTW92ZVNpZGViYXJMZWZ0QWN0aW9uIGV4dGVuZHMgTW92ZVNpZGViYXJQb3NpdGlvbkFjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVTaWRlQmFyTGVmdCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoTW92ZVNpZGViYXJMZWZ0QWN0aW9uLklELCBsb2NhbGl6ZTIoJ21vdmVTaWRlYmFyTGVmdCcsIFwiTW92ZSBQcmltYXJ5IFNpZGUgQmFyIExlZnRcIiksIFBvc2l0aW9uLkxFRlQpO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihNb3ZlU2lkZWJhclJpZ2h0QWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihNb3ZlU2lkZWJhckxlZnRBY3Rpb24pO1xuXG4vLyAtLS0gVG9nZ2xlIFNpZGViYXIgUG9zaXRpb25cblxuZXhwb3J0IGNsYXNzIFRvZ2dsZVNpZGViYXJQb3NpdGlvbkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZVNpZGViYXJQb3NpdGlvbic7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCd0b2dnbGVTaWRlYmFyUG9zaXRpb24nLCBcIlRvZ2dsZSBQcmltYXJ5IFNpZGUgQmFyIFBvc2l0aW9uXCIpO1xuXG5cdHN0YXRpYyBnZXRMYWJlbChsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxheW91dFNlcnZpY2UuZ2V0U2lkZUJhclBvc2l0aW9uKCkgPT09IFBvc2l0aW9uLkxFRlQgPyBsb2NhbGl6ZSgnbW92ZVNpZGViYXJSaWdodCcsIFwiTW92ZSBQcmltYXJ5IFNpZGUgQmFyIFJpZ2h0XCIpIDogbG9jYWxpemUoJ21vdmVTaWRlYmFyTGVmdCcsIFwiTW92ZSBQcmltYXJ5IFNpZGUgQmFyIExlZnRcIik7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVG9nZ2xlU2lkZWJhclBvc2l0aW9uQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlU2lkZWJhclBvc2l0aW9uJywgXCJUb2dnbGUgUHJpbWFyeSBTaWRlIEJhciBQb3NpdGlvblwiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbGF5b3V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHBvc2l0aW9uID0gbGF5b3V0U2VydmljZS5nZXRTaWRlQmFyUG9zaXRpb24oKTtcblx0XHRjb25zdCBuZXdQb3NpdGlvblZhbHVlID0gKHBvc2l0aW9uID09PSBQb3NpdGlvbi5MRUZUKSA/ICdyaWdodCcgOiAnbGVmdCc7XG5cblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoc2lkZWJhclBvc2l0aW9uQ29uZmlndXJhdGlvbktleSwgbmV3UG9zaXRpb25WYWx1ZSk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKFRvZ2dsZVNpZGViYXJQb3NpdGlvbkFjdGlvbik7XG5cbmNvbnN0IGNvbmZpZ3VyZUxheW91dEljb24gPSByZWdpc3Rlckljb24oJ2NvbmZpZ3VyZS1sYXlvdXQtaWNvbicsIENvZGljb24ubGF5b3V0LCBsb2NhbGl6ZSgnY29maWd1cmVMYXlvdXRJY29uJywgJ0ljb24gcmVwcmVzZW50cyB3b3JrYmVuY2ggbGF5b3V0IGNvbmZpZ3VyYXRpb24uJykpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5MYXlvdXRDb250cm9sTWVudSwge1xuXHRzdWJtZW51OiBNZW51SWQuTGF5b3V0Q29udHJvbE1lbnVTdWJtZW51LFxuXHR0aXRsZTogbG9jYWxpemUoJ2NvbmZpZ3VyZUxheW91dCcsIFwiQ29uZmlndXJlIExheW91dFwiKSxcblx0aWNvbjogY29uZmlndXJlTGF5b3V0SWNvbixcblx0Z3JvdXA6ICcxX3dvcmtiZW5jaF9sYXlvdXQnLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2gubGF5b3V0Q29udHJvbC50eXBlJywgJ21lbnUnKVxufSk7XG5cblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtcyhbe1xuXHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZUNvbnRleHQsXG5cdGl0ZW06IHtcblx0XHRncm91cDogJzNfd29ya2JlbmNoX2xheW91dF9tb3ZlJyxcblx0XHRjb21tYW5kOiB7XG5cdFx0XHRpZDogVG9nZ2xlU2lkZWJhclBvc2l0aW9uQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdtb3ZlIHNpZGUgYmFyIHJpZ2h0JywgXCJNb3ZlIFByaW1hcnkgU2lkZSBCYXIgUmlnaHRcIilcblx0XHR9LFxuXHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2guc2lkZUJhci5sb2NhdGlvbicsICdyaWdodCcpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXJMb2NhdGlvbicsIFZpZXdDb250YWluZXJMb2NhdGlvblRvU3RyaW5nKFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKSkpLFxuXHRcdG9yZGVyOiAxXG5cdH1cbn0sIHtcblx0aWQ6IE1lbnVJZC5WaWV3Q29udGFpbmVyVGl0bGVDb250ZXh0LFxuXHRpdGVtOiB7XG5cdFx0Z3JvdXA6ICczX3dvcmtiZW5jaF9sYXlvdXRfbW92ZScsXG5cdFx0Y29tbWFuZDoge1xuXHRcdFx0aWQ6IFRvZ2dsZVNpZGViYXJQb3NpdGlvbkFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbW92ZSBzaWRlYmFyIGxlZnQnLCBcIk1vdmUgUHJpbWFyeSBTaWRlIEJhciBMZWZ0XCIpXG5cdFx0fSxcblx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLnNpZGVCYXIubG9jYXRpb24nLCAncmlnaHQnKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3Q29udGFpbmVyTG9jYXRpb24nLCBWaWV3Q29udGFpbmVyTG9jYXRpb25Ub1N0cmluZyhWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcikpKSxcblx0XHRvcmRlcjogMVxuXHR9XG59LCB7XG5cdGlkOiBNZW51SWQuVmlld0NvbnRhaW5lclRpdGxlQ29udGV4dCxcblx0aXRlbToge1xuXHRcdGdyb3VwOiAnM193b3JrYmVuY2hfbGF5b3V0X21vdmUnLFxuXHRcdGNvbW1hbmQ6IHtcblx0XHRcdGlkOiBUb2dnbGVTaWRlYmFyUG9zaXRpb25BY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ21vdmUgc2Vjb25kIHNpZGViYXIgbGVmdCcsIFwiTW92ZSBWb2lkIFNpZGUgQmFyIExlZnRcIilcblx0XHR9LFxuXHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2guc2lkZUJhci5sb2NhdGlvbicsICdyaWdodCcpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXJMb2NhdGlvbicsIFZpZXdDb250YWluZXJMb2NhdGlvblRvU3RyaW5nKFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIpKSksXG5cdFx0b3JkZXI6IDFcblx0fVxufSwge1xuXHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZUNvbnRleHQsXG5cdGl0ZW06IHtcblx0XHRncm91cDogJzNfd29ya2JlbmNoX2xheW91dF9tb3ZlJyxcblx0XHRjb21tYW5kOiB7XG5cdFx0XHRpZDogVG9nZ2xlU2lkZWJhclBvc2l0aW9uQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdtb3ZlIHNlY29uZCBzaWRlYmFyIHJpZ2h0JywgXCJNb3ZlIFZvaWQgU2lkZSBCYXIgUmlnaHRcIilcblx0XHR9LFxuXHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2guc2lkZUJhci5sb2NhdGlvbicsICdyaWdodCcpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXJMb2NhdGlvbicsIFZpZXdDb250YWluZXJMb2NhdGlvblRvU3RyaW5nKFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIpKSksXG5cdFx0b3JkZXI6IDFcblx0fVxufV0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJBcHBlYXJhbmNlTWVudSwge1xuXHRncm91cDogJzNfd29ya2JlbmNoX2xheW91dF9tb3ZlJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBUb2dnbGVTaWRlYmFyUG9zaXRpb25BY3Rpb24uSUQsXG5cdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlNb3ZlU2lkZWJhclJpZ2h0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmTW92ZSBQcmltYXJ5IFNpZGUgQmFyIFJpZ2h0XCIpXG5cdH0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLndvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uJywgJ3JpZ2h0JyksXG5cdG9yZGVyOiAyXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyQXBwZWFyYW5jZU1lbnUsIHtcblx0Z3JvdXA6ICczX3dvcmtiZW5jaF9sYXlvdXRfbW92ZScsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogVG9nZ2xlU2lkZWJhclBvc2l0aW9uQWN0aW9uLklELFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pTW92ZVNpZGViYXJMZWZ0JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmTW92ZSBQcmltYXJ5IFNpZGUgQmFyIExlZnRcIilcblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLnNpZGVCYXIubG9jYXRpb24nLCAncmlnaHQnKSxcblx0b3JkZXI6IDJcbn0pO1xuXG4vLyAtLS0gVG9nZ2xlIEVkaXRvciBWaXNpYmlsaXR5XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVFZGl0b3JWaXNpYmlsaXR5Jyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdC4uLmxvY2FsaXplMigndG9nZ2xlRWRpdG9yJywgXCJUb2dnbGUgRWRpdG9yIEFyZWEgVmlzaWJpbGl0eVwiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVNob3dFZGl0b3JBcmVhJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIlNob3cgJiZFZGl0b3IgQXJlYVwiKSxcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR0b2dnbGVkOiBNYWluRWRpdG9yQXJlYVZpc2libGVDb250ZXh0LFxuXHRcdFx0Ly8gdGhlIHdvcmtiZW5jaCBncmlkIGN1cnJlbnRseSBwcmV2ZW50cyB1cyBmcm9tIHN1cHBvcnRpbmcgcGFuZWwgbWF4aW1pemF0aW9uIHdpdGggbm9uLWNlbnRlciBwYW5lbCBhbGlnbm1lbnRcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKElzQXV4aWxpYXJ5V2luZG93Rm9jdXNlZENvbnRleHQudG9OZWdhdGVkKCksIENvbnRleHRLZXlFeHByLm9yKFBhbmVsQWxpZ25tZW50Q29udGV4dC5pc0VxdWFsVG8oJ2NlbnRlcicpLCBQYW5lbFBvc2l0aW9uQ29udGV4dC5ub3RFcXVhbHNUbygnYm90dG9tJykpKVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0YWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKS50b2dnbGVNYXhpbWl6ZWRQYW5lbCgpO1xuXHR9XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyVmlld01lbnUsIHtcblx0Z3JvdXA6ICcyX2FwcGVhcmFuY2UnLFxuXHR0aXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaUFwcGVhcmFuY2UnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZBcHBlYXJhbmNlXCIpLFxuXHRzdWJtZW51OiBNZW51SWQuTWVudWJhckFwcGVhcmFuY2VNZW51LFxuXHRvcmRlcjogMVxufSk7XG5cbi8vIFRvZ2dsZSBTaWRlYmFyIFZpc2liaWxpdHlcblxuZXhwb3J0IGNsYXNzIFRvZ2dsZVNpZGViYXJWaXNpYmlsaXR5QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlU2lkZWJhclZpc2liaWxpdHknO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBsb2NhbGl6ZSgnY29tcG9zaXRlUGFydC5oaWRlU2lkZUJhckxhYmVsJywgXCJIaWRlIFByaW1hcnkgU2lkZSBCYXJcIik7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRvZ2dsZVNpZGViYXJWaXNpYmlsaXR5QWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlU2lkZWJhcicsICdUb2dnbGUgUHJpbWFyeSBTaWRlIEJhciBWaXNpYmlsaXR5JyksXG5cdFx0XHR0b2dnbGVkOiB7XG5cdFx0XHRcdGNvbmRpdGlvbjogU2lkZUJhclZpc2libGVDb250ZXh0LFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3ByaW1hcnkgc2lkZWJhcicsIFwiUHJpbWFyeSBTaWRlIEJhclwiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdwcmltYXJ5IHNpZGViYXIgbW5lbW9uaWMnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZQcmltYXJ5IFNpZGUgQmFyXCIpLFxuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnb3BlbkFuZENsb3NlU2lkZWJhcicsICdPcGVuL1Nob3cgYW5kIENsb3NlL0hpZGUgU2lkZWJhcicpLFxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlCXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5MYXlvdXRDb250cm9sTWVudVN1Ym1lbnUsXG5cdFx0XHRcdFx0Z3JvdXA6ICcwX3dvcmtiZW5jaF9sYXlvdXQnLFxuXHRcdFx0XHRcdG9yZGVyOiAwXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJBcHBlYXJhbmNlTWVudSxcblx0XHRcdFx0XHRncm91cDogJzJfd29ya2JlbmNoX2xheW91dCcsXG5cdFx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgbGF5b3V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSk7XG5cblx0XHRsYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4obGF5b3V0U2VydmljZS5pc1Zpc2libGUoUGFydHMuU0lERUJBUl9QQVJUKSwgUGFydHMuU0lERUJBUl9QQVJUKTtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoVG9nZ2xlU2lkZWJhclZpc2liaWxpdHlBY3Rpb24pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW1zKFtcblx0e1xuXHRcdGlkOiBNZW51SWQuVmlld0NvbnRhaW5lclRpdGxlQ29udGV4dCxcblx0XHRpdGVtOiB7XG5cdFx0XHRncm91cDogJzNfd29ya2JlbmNoX2xheW91dF9tb3ZlJyxcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQ6IFRvZ2dsZVNpZGViYXJWaXNpYmlsaXR5QWN0aW9uLklELFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NvbXBvc2l0ZVBhcnQuaGlkZVNpZGVCYXJMYWJlbCcsIFwiSGlkZSBQcmltYXJ5IFNpZGUgQmFyXCIpLFxuXHRcdFx0fSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChTaWRlQmFyVmlzaWJsZUNvbnRleHQsIENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lckxvY2F0aW9uJywgVmlld0NvbnRhaW5lckxvY2F0aW9uVG9TdHJpbmcoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpKSksXG5cdFx0XHRvcmRlcjogMlxuXHRcdH1cblx0fSwge1xuXHRcdGlkOiBNZW51SWQuTGF5b3V0Q29udHJvbE1lbnUsXG5cdFx0aXRlbToge1xuXHRcdFx0Z3JvdXA6ICcyX3BhbmVfdG9nZ2xlcycsXG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiBUb2dnbGVTaWRlYmFyVmlzaWJpbGl0eUFjdGlvbi5JRCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd0b2dnbGVTaWRlQmFyJywgXCJUb2dnbGUgUHJpbWFyeSBTaWRlIEJhclwiKSxcblx0XHRcdFx0aWNvbjogcGFuZWxMZWZ0T2ZmSWNvbixcblx0XHRcdFx0dG9nZ2xlZDogeyBjb25kaXRpb246IFNpZGVCYXJWaXNpYmxlQ29udGV4dCwgaWNvbjogcGFuZWxMZWZ0SWNvbiB9XG5cdFx0XHR9LFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLm9yKENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLndvcmtiZW5jaC5sYXlvdXRDb250cm9sLnR5cGUnLCAndG9nZ2xlcycpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2gubGF5b3V0Q29udHJvbC50eXBlJywgJ2JvdGgnKSksIENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLndvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uJywgJ2xlZnQnKSksXG5cdFx0XHRvcmRlcjogMFxuXHRcdH1cblx0fSwge1xuXHRcdGlkOiBNZW51SWQuTGF5b3V0Q29udHJvbE1lbnUsXG5cdFx0aXRlbToge1xuXHRcdFx0Z3JvdXA6ICcyX3BhbmVfdG9nZ2xlcycsXG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiBUb2dnbGVTaWRlYmFyVmlzaWJpbGl0eUFjdGlvbi5JRCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd0b2dnbGVTaWRlQmFyJywgXCJUb2dnbGUgUHJpbWFyeSBTaWRlIEJhclwiKSxcblx0XHRcdFx0aWNvbjogcGFuZWxSaWdodE9mZkljb24sXG5cdFx0XHRcdHRvZ2dsZWQ6IHsgY29uZGl0aW9uOiBTaWRlQmFyVmlzaWJsZUNvbnRleHQsIGljb246IHBhbmVsUmlnaHRJY29uIH1cblx0XHRcdH0sXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIub3IoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLmxheW91dENvbnRyb2wudHlwZScsICd0b2dnbGVzJyksIENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLndvcmtiZW5jaC5sYXlvdXRDb250cm9sLnR5cGUnLCAnYm90aCcpKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLnNpZGVCYXIubG9jYXRpb24nLCAncmlnaHQnKSksXG5cdFx0XHRvcmRlcjogMlxuXHRcdH1cblx0fVxuXSk7XG5cbi8vIC0tLSBUb2dnbGUgU3RhdHVzYmFyIFZpc2liaWxpdHlcblxuZXhwb3J0IGNsYXNzIFRvZ2dsZVN0YXR1c2JhclZpc2liaWxpdHlBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVTdGF0dXNiYXJWaXNpYmlsaXR5JztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBzdGF0dXNiYXJWaXNpYmxlS2V5ID0gJ3dvcmtiZW5jaC5zdGF0dXNCYXIudmlzaWJsZSc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRvZ2dsZVN0YXR1c2JhclZpc2liaWxpdHlBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ3RvZ2dsZVN0YXR1c2JhcicsIFwiVG9nZ2xlIFN0YXR1cyBCYXIgVmlzaWJpbGl0eVwiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVN0YXR1c2JhcicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJTJiZ0YXR1cyBCYXJcIiksXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0dG9nZ2xlZDogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLnN0YXR1c0Jhci52aXNpYmxlJywgdHJ1ZSksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJBcHBlYXJhbmNlTWVudSxcblx0XHRcdFx0Z3JvdXA6ICcyX3dvcmtiZW5jaF9sYXlvdXQnLFxuXHRcdFx0XHRvcmRlcjogM1xuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGxheW91dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaExheW91dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCB2aXNpYmlsaXR5ID0gbGF5b3V0U2VydmljZS5pc1Zpc2libGUoUGFydHMuU1RBVFVTQkFSX1BBUlQsIG1haW5XaW5kb3cpO1xuXHRcdGNvbnN0IG5ld1Zpc2liaWxpdHlWYWx1ZSA9ICF2aXNpYmlsaXR5O1xuXG5cdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKFRvZ2dsZVN0YXR1c2JhclZpc2liaWxpdHlBY3Rpb24uc3RhdHVzYmFyVmlzaWJsZUtleSwgbmV3VmlzaWJpbGl0eVZhbHVlKTtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoVG9nZ2xlU3RhdHVzYmFyVmlzaWJpbGl0eUFjdGlvbik7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0gRWRpdG9yIFRhYnMgTGF5b3V0IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmFic3RyYWN0IGNsYXNzIEFic3RyYWN0U2V0U2hvd1RhYnNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHNldHRpbmdOYW1lOiBzdHJpbmcsIHByaXZhdGUgcmVhZG9ubHkgdmFsdWU6IHN0cmluZywgdGl0bGU6IElDb21tYW5kQWN0aW9uVGl0bGUsIGlkOiBzdHJpbmcsIHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHJlc3Npb24sIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCBJTG9jYWxpemVkU3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQsXG5cdFx0XHR0aXRsZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRwcmVjb25kaXRpb24sXG5cdFx0XHRtZXRhZGF0YTogZGVzY3JpcHRpb24gPyB7IGRlc2NyaXB0aW9uIH0gOiB1bmRlZmluZWQsXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUodGhpcy5zZXR0aW5nTmFtZSwgdGhpcy52YWx1ZSk7XG5cdH1cbn1cblxuLy8gLS0tIEhpZGUgRWRpdG9yIFRhYnNcblxuZXhwb3J0IGNsYXNzIEhpZGVFZGl0b3JUYWJzQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RTZXRTaG93VGFic0FjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uaGlkZUVkaXRvclRhYnMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IHByZWNvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke0xheW91dFNldHRpbmdzLkVESVRPUl9UQUJTX01PREV9YCwgRWRpdG9yVGFic01vZGUuTk9ORSkubmVnYXRlKCksIEluRWRpdG9yWmVuTW9kZUNvbnRleHQubmVnYXRlKCkpITtcblx0XHRjb25zdCB0aXRsZSA9IGxvY2FsaXplMignaGlkZUVkaXRvclRhYnMnLCAnSGlkZSBFZGl0b3IgVGFicycpO1xuXHRcdHN1cGVyKExheW91dFNldHRpbmdzLkVESVRPUl9UQUJTX01PREUsIEVkaXRvclRhYnNNb2RlLk5PTkUsIHRpdGxlLCBIaWRlRWRpdG9yVGFic0FjdGlvbi5JRCwgcHJlY29uZGl0aW9uLCBsb2NhbGl6ZTIoJ2hpZGVFZGl0b3JUYWJzRGVzY3JpcHRpb24nLCBcIkhpZGUgVGFiIEJhclwiKSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFplbkhpZGVFZGl0b3JUYWJzQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RTZXRTaG93VGFic0FjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uemVuSGlkZUVkaXRvclRhYnMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IHByZWNvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke1plbk1vZGVTZXR0aW5ncy5TSE9XX1RBQlN9YCwgRWRpdG9yVGFic01vZGUuTk9ORSkubmVnYXRlKCksIEluRWRpdG9yWmVuTW9kZUNvbnRleHQpITtcblx0XHRjb25zdCB0aXRsZSA9IGxvY2FsaXplMignaGlkZUVkaXRvclRhYnNaZW5Nb2RlJywgJ0hpZGUgRWRpdG9yIFRhYnMgaW4gWmVuIE1vZGUnKTtcblx0XHRzdXBlcihaZW5Nb2RlU2V0dGluZ3MuU0hPV19UQUJTLCBFZGl0b3JUYWJzTW9kZS5OT05FLCB0aXRsZSwgWmVuSGlkZUVkaXRvclRhYnNBY3Rpb24uSUQsIHByZWNvbmRpdGlvbiwgbG9jYWxpemUyKCdoaWRlRWRpdG9yVGFic1plbk1vZGVEZXNjcmlwdGlvbicsIFwiSGlkZSBUYWIgQmFyIGluIFplbiBNb2RlXCIpKTtcblx0fVxufVxuXG4vLyAtLS0gU2hvdyBNdWx0aXBsZSBFZGl0b3IgVGFic1xuXG5leHBvcnQgY2xhc3MgU2hvd011bHRpcGxlRWRpdG9yVGFic0FjdGlvbiBleHRlbmRzIEFic3RyYWN0U2V0U2hvd1RhYnNBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLnNob3dNdWx0aXBsZUVkaXRvclRhYnMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IHByZWNvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke0xheW91dFNldHRpbmdzLkVESVRPUl9UQUJTX01PREV9YCwgRWRpdG9yVGFic01vZGUuTVVMVElQTEUpLm5lZ2F0ZSgpLCBJbkVkaXRvclplbk1vZGVDb250ZXh0Lm5lZ2F0ZSgpKSE7XG5cdFx0Y29uc3QgdGl0bGUgPSBsb2NhbGl6ZTIoJ3Nob3dNdWx0aXBsZUVkaXRvclRhYnMnLCAnU2hvdyBNdWx0aXBsZSBFZGl0b3IgVGFicycpO1xuXG5cdFx0c3VwZXIoTGF5b3V0U2V0dGluZ3MuRURJVE9SX1RBQlNfTU9ERSwgRWRpdG9yVGFic01vZGUuTVVMVElQTEUsIHRpdGxlLCBTaG93TXVsdGlwbGVFZGl0b3JUYWJzQWN0aW9uLklELCBwcmVjb25kaXRpb24sIGxvY2FsaXplMignc2hvd011bHRpcGxlRWRpdG9yVGFic0Rlc2NyaXB0aW9uJywgXCJTaG93IFRhYiBCYXIgd2l0aCBtdWx0aXBsZSB0YWJzXCIpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgWmVuU2hvd011bHRpcGxlRWRpdG9yVGFic0FjdGlvbiBleHRlbmRzIEFic3RyYWN0U2V0U2hvd1RhYnNBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLnplblNob3dNdWx0aXBsZUVkaXRvclRhYnMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IHByZWNvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke1plbk1vZGVTZXR0aW5ncy5TSE9XX1RBQlN9YCwgRWRpdG9yVGFic01vZGUuTVVMVElQTEUpLm5lZ2F0ZSgpLCBJbkVkaXRvclplbk1vZGVDb250ZXh0KSE7XG5cdFx0Y29uc3QgdGl0bGUgPSBsb2NhbGl6ZTIoJ3Nob3dNdWx0aXBsZUVkaXRvclRhYnNaZW5Nb2RlJywgJ1Nob3cgTXVsdGlwbGUgRWRpdG9yIFRhYnMgaW4gWmVuIE1vZGUnKTtcblxuXHRcdHN1cGVyKFplbk1vZGVTZXR0aW5ncy5TSE9XX1RBQlMsIEVkaXRvclRhYnNNb2RlLk1VTFRJUExFLCB0aXRsZSwgWmVuU2hvd011bHRpcGxlRWRpdG9yVGFic0FjdGlvbi5JRCwgcHJlY29uZGl0aW9uLCBsb2NhbGl6ZTIoJ3Nob3dNdWx0aXBsZUVkaXRvclRhYnNaZW5Nb2RlRGVzY3JpcHRpb24nLCBcIlNob3cgVGFiIEJhciBpbiBaZW4gTW9kZVwiKSk7XG5cdH1cbn1cblxuLy8gLS0tIFNob3cgU2luZ2xlIEVkaXRvciBUYWJcblxuZXhwb3J0IGNsYXNzIFNob3dTaW5nbGVFZGl0b3JUYWJBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdFNldFNob3dUYWJzQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5zaG93RWRpdG9yVGFiJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBwcmVjb25kaXRpb24gPSBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKGBjb25maWcuJHtMYXlvdXRTZXR0aW5ncy5FRElUT1JfVEFCU19NT0RFfWAsIEVkaXRvclRhYnNNb2RlLlNJTkdMRSkubmVnYXRlKCksIEluRWRpdG9yWmVuTW9kZUNvbnRleHQubmVnYXRlKCkpITtcblx0XHRjb25zdCB0aXRsZSA9IGxvY2FsaXplMignc2hvd1NpbmdsZUVkaXRvclRhYicsICdTaG93IFNpbmdsZSBFZGl0b3IgVGFiJyk7XG5cblx0XHRzdXBlcihMYXlvdXRTZXR0aW5ncy5FRElUT1JfVEFCU19NT0RFLCBFZGl0b3JUYWJzTW9kZS5TSU5HTEUsIHRpdGxlLCBTaG93U2luZ2xlRWRpdG9yVGFiQWN0aW9uLklELCBwcmVjb25kaXRpb24sIGxvY2FsaXplMignc2hvd1NpbmdsZUVkaXRvclRhYkRlc2NyaXB0aW9uJywgXCJTaG93IFRhYiBCYXIgd2l0aCBvbmUgVGFiXCIpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgWmVuU2hvd1NpbmdsZUVkaXRvclRhYkFjdGlvbiBleHRlbmRzIEFic3RyYWN0U2V0U2hvd1RhYnNBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLnplblNob3dFZGl0b3JUYWInO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IHByZWNvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke1plbk1vZGVTZXR0aW5ncy5TSE9XX1RBQlN9YCwgRWRpdG9yVGFic01vZGUuU0lOR0xFKS5uZWdhdGUoKSwgSW5FZGl0b3JaZW5Nb2RlQ29udGV4dCkhO1xuXHRcdGNvbnN0IHRpdGxlID0gbG9jYWxpemUyKCdzaG93U2luZ2xlRWRpdG9yVGFiWmVuTW9kZScsICdTaG93IFNpbmdsZSBFZGl0b3IgVGFiIGluIFplbiBNb2RlJyk7XG5cblx0XHRzdXBlcihaZW5Nb2RlU2V0dGluZ3MuU0hPV19UQUJTLCBFZGl0b3JUYWJzTW9kZS5TSU5HTEUsIHRpdGxlLCBaZW5TaG93U2luZ2xlRWRpdG9yVGFiQWN0aW9uLklELCBwcmVjb25kaXRpb24sIGxvY2FsaXplMignc2hvd1NpbmdsZUVkaXRvclRhYlplbk1vZGVEZXNjcmlwdGlvbicsIFwiU2hvdyBUYWIgQmFyIGluIFplbiBNb2RlIHdpdGggb25lIFRhYlwiKSk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKEhpZGVFZGl0b3JUYWJzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihaZW5IaWRlRWRpdG9yVGFic0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoU2hvd011bHRpcGxlRWRpdG9yVGFic0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoWmVuU2hvd011bHRpcGxlRWRpdG9yVGFic0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoU2hvd1NpbmdsZUVkaXRvclRhYkFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoWmVuU2hvd1NpbmdsZUVkaXRvclRhYkFjdGlvbik7XG5cbi8vIC0tLSBUYWIgQmFyIFN1Ym1lbnUgaW4gVmlldyBBcHBlYXJhbmNlIE1lbnVcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyQXBwZWFyYW5jZU1lbnUsIHtcblx0c3VibWVudTogTWVudUlkLkVkaXRvclRhYnNCYXJTaG93VGFic1N1Ym1lbnUsXG5cdHRpdGxlOiBsb2NhbGl6ZSgndGFiQmFyJywgXCJUYWIgQmFyXCIpLFxuXHRncm91cDogJzNfd29ya2JlbmNoX2xheW91dF9tb3ZlJyxcblx0b3JkZXI6IDEwLFxuXHR3aGVuOiBJbkVkaXRvclplbk1vZGVDb250ZXh0Lm5lZ2F0ZSgpXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyQXBwZWFyYW5jZU1lbnUsIHtcblx0c3VibWVudTogTWVudUlkLkVkaXRvclRhYnNCYXJTaG93VGFic1plbk1vZGVTdWJtZW51LFxuXHR0aXRsZTogbG9jYWxpemUoJ3RhYkJhcicsIFwiVGFiIEJhclwiKSxcblx0Z3JvdXA6ICczX3dvcmtiZW5jaF9sYXlvdXRfbW92ZScsXG5cdG9yZGVyOiAxMCxcblx0d2hlbjogSW5FZGl0b3JaZW5Nb2RlQ29udGV4dFxufSk7XG5cbi8vIC0tLSBTaG93IEVkaXRvciBBY3Rpb25zIGluIFRpdGxlIEJhclxuXG5leHBvcnQgY2xhc3MgRWRpdG9yQWN0aW9uc1RpdGxlQmFyQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZWRpdG9yQWN0aW9uc1RpdGxlQmFyJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRWRpdG9yQWN0aW9uc1RpdGxlQmFyQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbW92ZUVkaXRvckFjdGlvbnNUb1RpdGxlQmFyJywgXCJNb3ZlIEVkaXRvciBBY3Rpb25zIHRvIFRpdGxlIEJhclwiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7TGF5b3V0U2V0dGluZ3MuRURJVE9SX0FDVElPTlNfTE9DQVRJT059YCwgRWRpdG9yQWN0aW9uc0xvY2F0aW9uLlRJVExFQkFSKS5uZWdhdGUoKSxcblx0XHRcdG1ldGFkYXRhOiB7IGRlc2NyaXB0aW9uOiBsb2NhbGl6ZTIoJ21vdmVFZGl0b3JBY3Rpb25zVG9UaXRsZUJhckRlc2NyaXB0aW9uJywgXCJNb3ZlIEVkaXRvciBBY3Rpb25zIGZyb20gdGhlIHRhYiBiYXIgdG8gdGhlIHRpdGxlIGJhclwiKSB9LFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKExheW91dFNldHRpbmdzLkVESVRPUl9BQ1RJT05TX0xPQ0FUSU9OLCBFZGl0b3JBY3Rpb25zTG9jYXRpb24uVElUTEVCQVIpO1xuXHR9XG59XG5yZWdpc3RlckFjdGlvbjIoRWRpdG9yQWN0aW9uc1RpdGxlQmFyQWN0aW9uKTtcblxuLy8gLS0tIEVkaXRvciBBY3Rpb25zIERlZmF1bHQgUG9zaXRpb25cblxuZXhwb3J0IGNsYXNzIEVkaXRvckFjdGlvbnNEZWZhdWx0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZWRpdG9yQWN0aW9uc0RlZmF1bHQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBFZGl0b3JBY3Rpb25zRGVmYXVsdEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVFZGl0b3JBY3Rpb25zVG9UYWJCYXInLCBcIk1vdmUgRWRpdG9yIEFjdGlvbnMgdG8gVGFiIEJhclwiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKGBjb25maWcuJHtMYXlvdXRTZXR0aW5ncy5FRElUT1JfQUNUSU9OU19MT0NBVElPTn1gLCBFZGl0b3JBY3Rpb25zTG9jYXRpb24uREVGQVVMVCkubmVnYXRlKCksXG5cdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7TGF5b3V0U2V0dGluZ3MuRURJVE9SX1RBQlNfTU9ERX1gLCBFZGl0b3JUYWJzTW9kZS5OT05FKS5uZWdhdGUoKSxcblx0XHRcdCksXG5cdFx0XHRtZXRhZGF0YTogeyBkZXNjcmlwdGlvbjogbG9jYWxpemUyKCdtb3ZlRWRpdG9yQWN0aW9uc1RvVGFiQmFyRGVzY3JpcHRpb24nLCBcIk1vdmUgRWRpdG9yIEFjdGlvbnMgZnJvbSB0aGUgdGl0bGUgYmFyIHRvIHRoZSB0YWIgYmFyXCIpIH0sXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoTGF5b3V0U2V0dGluZ3MuRURJVE9SX0FDVElPTlNfTE9DQVRJT04sIEVkaXRvckFjdGlvbnNMb2NhdGlvbi5ERUZBVUxUKTtcblx0fVxufVxucmVnaXN0ZXJBY3Rpb24yKEVkaXRvckFjdGlvbnNEZWZhdWx0QWN0aW9uKTtcblxuLy8gLS0tIEhpZGUgRWRpdG9yIEFjdGlvbnNcblxuZXhwb3J0IGNsYXNzIEhpZGVFZGl0b3JBY3Rpb25zQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uaGlkZUVkaXRvckFjdGlvbnMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBIaWRlRWRpdG9yQWN0aW9uc0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2hpZGVFZGl0b3JBY3RvbnMnLCBcIkhpZGUgRWRpdG9yIEFjdGlvbnNcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke0xheW91dFNldHRpbmdzLkVESVRPUl9BQ1RJT05TX0xPQ0FUSU9OfWAsIEVkaXRvckFjdGlvbnNMb2NhdGlvbi5ISURERU4pLm5lZ2F0ZSgpLFxuXHRcdFx0bWV0YWRhdGE6IHsgZGVzY3JpcHRpb246IGxvY2FsaXplMignaGlkZUVkaXRvckFjdG9uc0Rlc2NyaXB0aW9uJywgXCJIaWRlIEVkaXRvciBBY3Rpb25zIGluIHRoZSB0YWIgYW5kIHRpdGxlIGJhclwiKSB9LFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKExheW91dFNldHRpbmdzLkVESVRPUl9BQ1RJT05TX0xPQ0FUSU9OLCBFZGl0b3JBY3Rpb25zTG9jYXRpb24uSElEREVOKTtcblx0fVxufVxucmVnaXN0ZXJBY3Rpb24yKEhpZGVFZGl0b3JBY3Rpb25zQWN0aW9uKTtcblxuLy8gLS0tIEhpZGUgRWRpdG9yIEFjdGlvbnNcblxuZXhwb3J0IGNsYXNzIFNob3dFZGl0b3JBY3Rpb25zQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uc2hvd0VkaXRvckFjdGlvbnMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTaG93RWRpdG9yQWN0aW9uc0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Nob3dFZGl0b3JBY3RvbnMnLCBcIlNob3cgRWRpdG9yIEFjdGlvbnNcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke0xheW91dFNldHRpbmdzLkVESVRPUl9BQ1RJT05TX0xPQ0FUSU9OfWAsIEVkaXRvckFjdGlvbnNMb2NhdGlvbi5ISURERU4pLFxuXHRcdFx0bWV0YWRhdGE6IHsgZGVzY3JpcHRpb246IGxvY2FsaXplMignc2hvd0VkaXRvckFjdG9uc0Rlc2NyaXB0aW9uJywgXCJNYWtlIEVkaXRvciBBY3Rpb25zIHZpc2libGUuXCIpIH0sXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoTGF5b3V0U2V0dGluZ3MuRURJVE9SX0FDVElPTlNfTE9DQVRJT04sIEVkaXRvckFjdGlvbnNMb2NhdGlvbi5ERUZBVUxUKTtcblx0fVxufVxucmVnaXN0ZXJBY3Rpb24yKFNob3dFZGl0b3JBY3Rpb25zQWN0aW9uKTtcblxuLy8gLS0tIEVkaXRvciBBY3Rpb25zIFBvc2l0aW9uIFN1Ym1lbnUgaW4gVmlldyBBcHBlYXJhbmNlIE1lbnVcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyQXBwZWFyYW5jZU1lbnUsIHtcblx0c3VibWVudTogTWVudUlkLkVkaXRvckFjdGlvbnNQb3NpdGlvblN1Ym1lbnUsXG5cdHRpdGxlOiBsb2NhbGl6ZSgnZWRpdG9yQWN0aW9uc1Bvc2l0aW9uJywgXCJFZGl0b3IgQWN0aW9ucyBQb3NpdGlvblwiKSxcblx0Z3JvdXA6ICczX3dvcmtiZW5jaF9sYXlvdXRfbW92ZScsXG5cdG9yZGVyOiAxMVxufSk7XG5cbi8vIC0tLSBDb25maWd1cmUgVGFicyBMYXlvdXRcblxuZXhwb3J0IGNsYXNzIENvbmZpZ3VyZUVkaXRvclRhYnNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jb25maWd1cmVFZGl0b3JUYWJzJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uZmlndXJlRWRpdG9yVGFic0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NvbmZpZ3VyZVRhYnMnLCBcIkNvbmZpZ3VyZSBUYWJzXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IHByZWZlcmVuY2VzU2VydmljZSA9IGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKTtcblx0XHRwcmVmZXJlbmNlc1NlcnZpY2Uub3BlblNldHRpbmdzKHsganNvbkVkaXRvcjogZmFsc2UsIHF1ZXJ5OiAnd29ya2JlbmNoLmVkaXRvciB0YWInIH0pO1xuXHR9XG59XG5yZWdpc3RlckFjdGlvbjIoQ29uZmlndXJlRWRpdG9yVGFic0FjdGlvbik7XG5cbi8vIC0tLSBDb25maWd1cmUgRWRpdG9yXG5cbmV4cG9ydCBjbGFzcyBDb25maWd1cmVFZGl0b3JBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jb25maWd1cmVFZGl0b3InO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb25maWd1cmVFZGl0b3JBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjb25maWd1cmVFZGl0b3JzJywgXCJDb25maWd1cmUgRWRpdG9yc1wiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBwcmVmZXJlbmNlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSk7XG5cdFx0cHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5TZXR0aW5ncyh7IGpzb25FZGl0b3I6IGZhbHNlLCBxdWVyeTogJ3dvcmtiZW5jaC5lZGl0b3InIH0pO1xuXHR9XG59XG5yZWdpc3RlckFjdGlvbjIoQ29uZmlndXJlRWRpdG9yQWN0aW9uKTtcblxuLy8gLS0tIFRvZ2dsZSBQaW5uZWQgVGFicyBPbiBTZXBhcmF0ZSBSb3dcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZVNlcGFyYXRlUGlubmVkRWRpdG9yVGFicycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd0b2dnbGVTZXBhcmF0ZVBpbm5lZEVkaXRvclRhYnMnLCBcIlNlcGFyYXRlIFBpbm5lZCBFZGl0b3IgVGFic1wiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7TGF5b3V0U2V0dGluZ3MuRURJVE9SX1RBQlNfTU9ERX1gLCBFZGl0b3JUYWJzTW9kZS5NVUxUSVBMRSksXG5cdFx0XHRtZXRhZGF0YTogeyBkZXNjcmlwdGlvbjogbG9jYWxpemUyKCd0b2dnbGVTZXBhcmF0ZVBpbm5lZEVkaXRvclRhYnNEZXNjcmlwdGlvbicsIFwiVG9nZ2xlIHdoZXRoZXIgcGlubmVkIGVkaXRvciB0YWJzIGFyZSBzaG93biBvbiBhIHNlcGFyYXRlIHJvdyBhYm92ZSB1bnBpbm5lZCB0YWJzLlwiKSB9LFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBvbGRldHRpbmdWYWx1ZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oJ3dvcmtiZW5jaC5lZGl0b3IucGlubmVkVGFic09uU2VwYXJhdGVSb3cnKTtcblx0XHRjb25zdCBuZXdTZXR0aW5nVmFsdWUgPSAhb2xkZXR0aW5nVmFsdWU7XG5cblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ3dvcmtiZW5jaC5lZGl0b3IucGlubmVkVGFic09uU2VwYXJhdGVSb3cnLCBuZXdTZXR0aW5nVmFsdWUpO1xuXHR9XG59KTtcblxuLy8gLS0tIFRvZ2dsZSBaZW4gTW9kZVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlWmVuTW9kZScsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ3RvZ2dsZVplbk1vZGUnLCBcIlRvZ2dsZSBaZW4gTW9kZVwiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVRvZ2dsZVplbk1vZGUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiWmVuIE1vZGVcIiksXG5cdFx0XHR9LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBJc0F1eGlsaWFyeVdpbmRvd0ZvY3VzZWRDb250ZXh0LnRvTmVnYXRlZCgpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleUNvZGUuS2V5Wilcblx0XHRcdH0sXG5cdFx0XHR0b2dnbGVkOiBJbkVkaXRvclplbk1vZGVDb250ZXh0LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyQXBwZWFyYW5jZU1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnMV90b2dnbGVfdmlldycsXG5cdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSkudG9nZ2xlWmVuTW9kZSgpO1xuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5leGl0WmVuTW9kZScsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliIC0gMTAwMCxcblx0aGFuZGxlcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGxheW91dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaExheW91dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0aWYgKEluRWRpdG9yWmVuTW9kZUNvbnRleHQuZ2V0VmFsdWUoY29udGV4dEtleVNlcnZpY2UpKSB7XG5cdFx0XHRsYXlvdXRTZXJ2aWNlLnRvZ2dsZVplbk1vZGUoKTtcblx0XHR9XG5cdH0sXG5cdHdoZW46IEluRWRpdG9yWmVuTW9kZUNvbnRleHQsXG5cdHByaW1hcnk6IEtleUNob3JkKEtleUNvZGUuRXNjYXBlLCBLZXlDb2RlLkVzY2FwZSlcbn0pO1xuXG4vLyAtLS0gVG9nZ2xlIE1lbnUgQmFyXG5cbmlmIChpc1dpbmRvd3MgfHwgaXNMaW51eCB8fCBpc1dlYikge1xuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgVG9nZ2xlTWVudWJhckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVNZW51QmFyJyxcblx0XHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ3RvZ2dsZU1lbnVCYXInLCBcIlRvZ2dsZSBNZW51IEJhclwiKSxcblx0XHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pTWVudUJhcicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJNZW51ICYmQmFyXCIpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0dG9nZ2xlZDogQ29udGV4dEtleUV4cHIuYW5kKElzTWFjTmF0aXZlQ29udGV4dC50b05lZ2F0ZWQoKSwgQ29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjb25maWcud2luZG93Lm1lbnVCYXJWaXNpYmlsaXR5JywgJ2hpZGRlbicpLCBDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2NvbmZpZy53aW5kb3cubWVudUJhclZpc2liaWxpdHknLCAndG9nZ2xlJyksIENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLndpbmRvdy5tZW51QmFyVmlzaWJpbGl0eScsICdjb21wYWN0JykpLFxuXHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTWVudWJhckFwcGVhcmFuY2VNZW51LFxuXHRcdFx0XHRcdGdyb3VwOiAnMl93b3JrYmVuY2hfbGF5b3V0Jyxcblx0XHRcdFx0XHRvcmRlcjogMFxuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKS50b2dnbGVNZW51QmFyKCk7XG5cdFx0fVxuXHR9KTtcblxuXHQvLyBBZGQgc2VwYXJhdGVseSB0byB0aXRsZSBiYXIgY29udGV4dCBtZW51IHNvIHdlIGNhbiB1c2UgYSBkaWZmZXJlbnQgdGl0bGVcblx0Zm9yIChjb25zdCBtZW51SWQgb2YgW01lbnVJZC5UaXRsZUJhckNvbnRleHQsIE1lbnVJZC5UaXRsZUJhclRpdGxlQ29udGV4dF0pIHtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0obWVudUlkLCB7XG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVNZW51QmFyJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdtaU1lbnVCYXJOb01uZW1vbmljJywgXCJNZW51IEJhclwiKSxcblx0XHRcdFx0dG9nZ2xlZDogQ29udGV4dEtleUV4cHIuYW5kKElzTWFjTmF0aXZlQ29udGV4dC50b05lZ2F0ZWQoKSwgQ29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjb25maWcud2luZG93Lm1lbnVCYXJWaXNpYmlsaXR5JywgJ2hpZGRlbicpLCBDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2NvbmZpZy53aW5kb3cubWVudUJhclZpc2liaWxpdHknLCAndG9nZ2xlJyksIENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLndpbmRvdy5tZW51QmFyVmlzaWJpbGl0eScsICdjb21wYWN0JykpXG5cdFx0XHR9LFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKElzQXV4aWxpYXJ5V2luZG93Rm9jdXNlZENvbnRleHQudG9OZWdhdGVkKCksIENvbnRleHRLZXlFeHByLm5vdEVxdWFscyhUaXRsZUJhclN0eWxlQ29udGV4dC5rZXksIFRpdGxlYmFyU3R5bGUuTkFUSVZFKSwgSXNNYWluV2luZG93RnVsbHNjcmVlbkNvbnRleHQubmVnYXRlKCkpLFxuXHRcdFx0Z3JvdXA6ICcyX2NvbmZpZycsXG5cdFx0XHRvcmRlcjogMFxuXHRcdH0pO1xuXHR9XG59XG5cbi8vIC0tLSBSZXNldCBWaWV3IExvY2F0aW9uc1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ucmVzZXRWaWV3TG9jYXRpb25zJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Jlc2V0Vmlld0xvY2F0aW9ucycsIFwiUmVzZXQgVmlldyBMb2NhdGlvbnNcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVZpZXdEZXNjcmlwdG9yU2VydmljZSkucmVzZXQoKTtcblx0fVxufSk7XG5cbi8vIC0tLSBNb3ZlIFZpZXdcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVWaWV3Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVWaWV3JywgXCJNb3ZlIFZpZXdcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCBwYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSk7XG5cblx0XHRjb25zdCBmb2N1c2VkVmlld0lkID0gRm9jdXNlZFZpZXdDb250ZXh0LmdldFZhbHVlKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRsZXQgdmlld0lkOiBzdHJpbmc7XG5cblx0XHRpZiAoZm9jdXNlZFZpZXdJZCAmJiB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKGZvY3VzZWRWaWV3SWQpPy5jYW5Nb3ZlVmlldykge1xuXHRcdFx0dmlld0lkID0gZm9jdXNlZFZpZXdJZDtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0dmlld0lkID0gYXdhaXQgdGhpcy5nZXRWaWV3KHF1aWNrSW5wdXRTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIHBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSwgdmlld0lkISk7XG5cdFx0XHRpZiAoIXZpZXdJZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1vdmVGb2N1c2VkVmlld0FjdGlvbiA9IG5ldyBNb3ZlRm9jdXNlZFZpZXdBY3Rpb24oKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IG1vdmVGb2N1c2VkVmlld0FjdGlvbi5ydW4oYWNjZXNzb3IsIHZpZXdJZCkpO1xuXHRcdH0gY2F0Y2ggeyB9XG5cdH1cblxuXHRwcml2YXRlIGdldFZpZXdJdGVtcyh2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIHBhbmVDb21wb3NpdGVQYXJ0U2VydmljZTogSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSk6IEFycmF5PFF1aWNrUGlja0l0ZW0+IHtcblx0XHRjb25zdCByZXN1bHRzOiBBcnJheTxRdWlja1BpY2tJdGVtPiA9IFtdO1xuXG5cdFx0Y29uc3Qgdmlld2xldHMgPSBwYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UuZ2V0VmlzaWJsZVBhbmVDb21wb3NpdGVJZHMoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdHZpZXdsZXRzLmZvckVhY2godmlld2xldElkID0+IHtcblx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZCh2aWV3bGV0SWQpITtcblx0XHRcdGNvbnN0IGNvbnRhaW5lck1vZGVsID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXG5cdFx0XHRsZXQgaGFzQWRkZWRWaWV3ID0gZmFsc2U7XG5cdFx0XHRjb250YWluZXJNb2RlbC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmZvckVhY2godmlld0Rlc2NyaXB0b3IgPT4ge1xuXHRcdFx0XHRpZiAodmlld0Rlc2NyaXB0b3IuY2FuTW92ZVZpZXcpIHtcblx0XHRcdFx0XHRpZiAoIWhhc0FkZGVkVmlldykge1xuXHRcdFx0XHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2lkZWJhckNvbnRhaW5lcicsIFwiU2lkZSBCYXIgLyB7MH1cIiwgY29udGFpbmVyTW9kZWwudGl0bGUpXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGhhc0FkZGVkVmlldyA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRcdGlkOiB2aWV3RGVzY3JpcHRvci5pZCxcblx0XHRcdFx0XHRcdGxhYmVsOiB2aWV3RGVzY3JpcHRvci5uYW1lLnZhbHVlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcGFuZWxzID0gcGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlLmdldFBpbm5lZFBhbmVDb21wb3NpdGVJZHMoVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKTtcblx0XHRwYW5lbHMuZm9yRWFjaChwYW5lbCA9PiB7XG5cdFx0XHRjb25zdCBjb250YWluZXIgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5SWQocGFuZWwpITtcblx0XHRcdGNvbnN0IGNvbnRhaW5lck1vZGVsID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXG5cdFx0XHRsZXQgaGFzQWRkZWRWaWV3ID0gZmFsc2U7XG5cdFx0XHRjb250YWluZXJNb2RlbC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmZvckVhY2godmlld0Rlc2NyaXB0b3IgPT4ge1xuXHRcdFx0XHRpZiAodmlld0Rlc2NyaXB0b3IuY2FuTW92ZVZpZXcpIHtcblx0XHRcdFx0XHRpZiAoIWhhc0FkZGVkVmlldykge1xuXHRcdFx0XHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncGFuZWxDb250YWluZXInLCBcIlBhbmVsIC8gezB9XCIsIGNvbnRhaW5lck1vZGVsLnRpdGxlKVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRoYXNBZGRlZFZpZXcgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJlc3VsdHMucHVzaCh7XG5cdFx0XHRcdFx0XHRpZDogdmlld0Rlc2NyaXB0b3IuaWQsXG5cdFx0XHRcdFx0XHRsYWJlbDogdmlld0Rlc2NyaXB0b3IubmFtZS52YWx1ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXG5cdFx0Y29uc3Qgc2lkZVBhbmVscyA9IHBhbmVDb21wb3NpdGVQYXJ0U2VydmljZS5nZXRQaW5uZWRQYW5lQ29tcG9zaXRlSWRzKFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIpO1xuXHRcdHNpZGVQYW5lbHMuZm9yRWFjaChwYW5lbCA9PiB7XG5cdFx0XHRjb25zdCBjb250YWluZXIgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5SWQocGFuZWwpITtcblx0XHRcdGNvbnN0IGNvbnRhaW5lck1vZGVsID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXG5cdFx0XHRsZXQgaGFzQWRkZWRWaWV3ID0gZmFsc2U7XG5cdFx0XHRjb250YWluZXJNb2RlbC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmZvckVhY2godmlld0Rlc2NyaXB0b3IgPT4ge1xuXHRcdFx0XHRpZiAodmlld0Rlc2NyaXB0b3IuY2FuTW92ZVZpZXcpIHtcblx0XHRcdFx0XHRpZiAoIWhhc0FkZGVkVmlldykge1xuXHRcdFx0XHRcdFx0cmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2Vjb25kYXJ5U2lkZUJhckNvbnRhaW5lcicsIFwiVm9pZCBTaWRlIEJhciAvIHswfVwiLCBjb250YWluZXJNb2RlbC50aXRsZSlcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0aGFzQWRkZWRWaWV3ID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXN1bHRzLnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6IHZpZXdEZXNjcmlwdG9yLmlkLFxuXHRcdFx0XHRcdFx0bGFiZWw6IHZpZXdEZXNjcmlwdG9yLm5hbWUudmFsdWVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0cztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0VmlldyhxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIHBhbmVDb21wb3NpdGVQYXJ0U2VydmljZTogSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSwgdmlld0lkPzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBxdWlja1BpY2sgPSBkaXNwb3NhYmxlcy5hZGQocXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrKHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9KSk7XG5cdFx0cXVpY2tQaWNrLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ21vdmVGb2N1c2VkVmlldy5zZWxlY3RWaWV3JywgXCJTZWxlY3QgYSBWaWV3IHRvIE1vdmVcIik7XG5cdFx0cXVpY2tQaWNrLml0ZW1zID0gdGhpcy5nZXRWaWV3SXRlbXModmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBwYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UpO1xuXHRcdHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zID0gcXVpY2tQaWNrLml0ZW1zLmZpbHRlcihpdGVtID0+IChpdGVtIGFzIElRdWlja1BpY2tJdGVtKS5pZCA9PT0gdmlld0lkKSBhcyBJUXVpY2tQaWNrSXRlbVtdO1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB2aWV3SWQgPSBxdWlja1BpY2suc2VsZWN0ZWRJdGVtc1swXTtcblx0XHRcdFx0aWYgKHZpZXdJZC5pZCkge1xuXHRcdFx0XHRcdHJlc29sdmUodmlld0lkLmlkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZWplY3QoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRyZWplY3QoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0cXVpY2tQaWNrLnNob3coKTtcblx0XHR9KTtcblx0fVxufSk7XG5cbi8vIC0tLSBNb3ZlIEZvY3VzZWQgVmlld1xuXG5jbGFzcyBNb3ZlRm9jdXNlZFZpZXdBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubW92ZUZvY3VzZWRWaWV3Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVGb2N1c2VkVmlldycsIFwiTW92ZSBGb2N1c2VkIFZpZXdcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBGb2N1c2VkVmlld0NvbnRleHQubm90RXF1YWxzVG8oJycpLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgdmlld0lkPzogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3RGVzY3JpcHRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0Y29uc3QgcGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZm9jdXNlZFZpZXdJZCA9IHZpZXdJZCB8fCBGb2N1c2VkVmlld0NvbnRleHQuZ2V0VmFsdWUoY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0aWYgKGZvY3VzZWRWaWV3SWQgPT09IHVuZGVmaW5lZCB8fCBmb2N1c2VkVmlld0lkLnRyaW0oKSA9PT0gJycpIHtcblx0XHRcdGRpYWxvZ1NlcnZpY2UuZXJyb3IobG9jYWxpemUoJ21vdmVGb2N1c2VkVmlldy5lcnJvci5ub0ZvY3VzZWRWaWV3JywgXCJUaGVyZSBpcyBubyB2aWV3IGN1cnJlbnRseSBmb2N1c2VkLlwiKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3IgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKGZvY3VzZWRWaWV3SWQpO1xuXHRcdGlmICghdmlld0Rlc2NyaXB0b3IgfHwgIXZpZXdEZXNjcmlwdG9yLmNhbk1vdmVWaWV3KSB7XG5cdFx0XHRkaWFsb2dTZXJ2aWNlLmVycm9yKGxvY2FsaXplKCdtb3ZlRm9jdXNlZFZpZXcuZXJyb3Iubm9uTW92YWJsZVZpZXcnLCBcIlRoZSBjdXJyZW50bHkgZm9jdXNlZCB2aWV3IGlzIG5vdCBtb3ZhYmxlLlwiKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcXVpY2tQaWNrID0gZGlzcG9zYWJsZXMuYWRkKHF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljayh7IHVzZVNlcGFyYXRvcnM6IHRydWUgfSkpO1xuXHRcdHF1aWNrUGljay5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdtb3ZlRm9jdXNlZFZpZXcuc2VsZWN0RGVzdGluYXRpb24nLCBcIlNlbGVjdCBhIERlc3RpbmF0aW9uIGZvciB0aGUgVmlld1wiKTtcblx0XHRxdWlja1BpY2sudGl0bGUgPSBsb2NhbGl6ZSh7IGtleTogJ21vdmVGb2N1c2VkVmlldy50aXRsZScsIGNvbW1lbnQ6IFsnezB9IGluZGljYXRlcyB0aGUgdGl0bGUgb2YgdGhlIHZpZXcgdGhlIHVzZXIgaGFzIHNlbGVjdGVkIHRvIG1vdmUuJ10gfSwgXCJWaWV3OiBNb3ZlIHswfVwiLCB2aWV3RGVzY3JpcHRvci5uYW1lLnZhbHVlKTtcblxuXHRcdGNvbnN0IGl0ZW1zOiBBcnJheTxJUXVpY2tQaWNrSXRlbSB8IElRdWlja1BpY2tTZXBhcmF0b3I+ID0gW107XG5cdFx0Y29uc3QgY3VycmVudENvbnRhaW5lciA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQoZm9jdXNlZFZpZXdJZCkhO1xuXHRcdGNvbnN0IGN1cnJlbnRMb2NhdGlvbiA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3TG9jYXRpb25CeUlkKGZvY3VzZWRWaWV3SWQpITtcblx0XHRjb25zdCBpc1ZpZXdTb2xvID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjdXJyZW50Q29udGFpbmVyKS5hbGxWaWV3RGVzY3JpcHRvcnMubGVuZ3RoID09PSAxO1xuXG5cdFx0aWYgKCEoaXNWaWV3U29sbyAmJiBjdXJyZW50TG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCkpIHtcblx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRpZDogJ18ucGFuZWwubmV3Y29udGFpbmVyJyxcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnbW92ZUZvY3VzZWRWaWV3Lm5ld0NvbnRhaW5lckluUGFuZWwnLCBjb21tZW50OiBbJ0NyZWF0ZXMgYSBuZXcgdG9wLWxldmVsIHRhYiBpbiB0aGUgcGFuZWwuJ10gfSwgXCJOZXcgUGFuZWwgRW50cnlcIiksXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoIShpc1ZpZXdTb2xvICYmIGN1cnJlbnRMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpKSB7XG5cdFx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdFx0aWQ6ICdfLnNpZGViYXIubmV3Y29udGFpbmVyJyxcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdtb3ZlRm9jdXNlZFZpZXcubmV3Q29udGFpbmVySW5TaWRlYmFyJywgXCJOZXcgU2lkZSBCYXIgRW50cnlcIilcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmICghKGlzVmlld1NvbG8gJiYgY3VycmVudExvY2F0aW9uID09PSBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKSkge1xuXHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdGlkOiAnXy5hdXhpbGlhcnliYXIubmV3Y29udGFpbmVyJyxcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdtb3ZlRm9jdXNlZFZpZXcubmV3Q29udGFpbmVySW5TaWRlUGFuZWwnLCBcIk5ldyBWb2lkIFNpZGUgQmFyIEVudHJ5XCIpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdHR5cGU6ICdzZXBhcmF0b3InLFxuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzaWRlYmFyJywgXCJTaWRlIEJhclwiKVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcGlubmVkVmlld2xldHMgPSBwYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UuZ2V0VmlzaWJsZVBhbmVDb21wb3NpdGVJZHMoVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXHRcdGl0ZW1zLnB1c2goLi4ucGlubmVkVmlld2xldHNcblx0XHRcdC5maWx0ZXIodmlld2xldElkID0+IHtcblx0XHRcdFx0aWYgKHZpZXdsZXRJZCA9PT0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeVZpZXdJZChmb2N1c2VkVmlld0lkKSEuaWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gIXZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZCh2aWV3bGV0SWQpIS5yZWplY3RBZGRlZFZpZXdzO1xuXHRcdFx0fSlcblx0XHRcdC5tYXAodmlld2xldElkID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZDogdmlld2xldElkLFxuXHRcdFx0XHRcdGxhYmVsOiB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZCh2aWV3bGV0SWQpISkhLnRpdGxlXG5cdFx0XHRcdH07XG5cdFx0XHR9KSk7XG5cblx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdHR5cGU6ICdzZXBhcmF0b3InLFxuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdwYW5lbCcsIFwiUGFuZWxcIilcblx0XHR9KTtcblxuXHRcdGNvbnN0IHBpbm5lZFBhbmVscyA9IHBhbmVDb21wb3NpdGVQYXJ0U2VydmljZS5nZXRQaW5uZWRQYW5lQ29tcG9zaXRlSWRzKFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk7XG5cdFx0aXRlbXMucHVzaCguLi5waW5uZWRQYW5lbHNcblx0XHRcdC5maWx0ZXIocGFuZWwgPT4ge1xuXHRcdFx0XHRpZiAocGFuZWwgPT09IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQoZm9jdXNlZFZpZXdJZCkhLmlkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuICF2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5SWQocGFuZWwpIS5yZWplY3RBZGRlZFZpZXdzO1xuXHRcdFx0fSlcblx0XHRcdC5tYXAocGFuZWwgPT4ge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGlkOiBwYW5lbCxcblx0XHRcdFx0XHRsYWJlbDogdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbCh2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5SWQocGFuZWwpISkhLnRpdGxlXG5cdFx0XHRcdH07XG5cdFx0XHR9KSk7XG5cblx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdHR5cGU6ICdzZXBhcmF0b3InLFxuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzZWNvbmRhcnlTaWRlQmFyJywgXCJWb2lkIFNpZGUgQmFyXCIpXG5cdFx0fSk7XG5cblx0XHRjb25zdCBwaW5uZWRBdXhQYW5lbHMgPSBwYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UuZ2V0UGlubmVkUGFuZUNvbXBvc2l0ZUlkcyhWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKTtcblx0XHRpdGVtcy5wdXNoKC4uLnBpbm5lZEF1eFBhbmVsc1xuXHRcdFx0LmZpbHRlcihwYW5lbCA9PiB7XG5cdFx0XHRcdGlmIChwYW5lbCA9PT0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeVZpZXdJZChmb2N1c2VkVmlld0lkKSEuaWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gIXZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChwYW5lbCkhLnJlamVjdEFkZGVkVmlld3M7XG5cdFx0XHR9KVxuXHRcdFx0Lm1hcChwYW5lbCA9PiB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aWQ6IHBhbmVsLFxuXHRcdFx0XHRcdGxhYmVsOiB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChwYW5lbCkhKSEudGl0bGVcblx0XHRcdFx0fTtcblx0XHRcdH0pKTtcblxuXHRcdHF1aWNrUGljay5pdGVtcyA9IGl0ZW1zO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEFjY2VwdCgoKSA9PiB7XG5cdFx0XHRjb25zdCBkZXN0aW5hdGlvbiA9IHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zWzBdO1xuXG5cdFx0XHRpZiAoZGVzdGluYXRpb24uaWQgPT09ICdfLnBhbmVsLm5ld2NvbnRhaW5lcicpIHtcblx0XHRcdFx0dmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3VG9Mb2NhdGlvbih2aWV3RGVzY3JpcHRvciwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsLCB0aGlzLmRlc2MuaWQpO1xuXHRcdFx0XHR2aWV3c1NlcnZpY2Uub3BlblZpZXcoZm9jdXNlZFZpZXdJZCwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2UgaWYgKGRlc3RpbmF0aW9uLmlkID09PSAnXy5zaWRlYmFyLm5ld2NvbnRhaW5lcicpIHtcblx0XHRcdFx0dmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3VG9Mb2NhdGlvbih2aWV3RGVzY3JpcHRvciwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIHRoaXMuZGVzYy5pZCk7XG5cdFx0XHRcdHZpZXdzU2VydmljZS5vcGVuVmlldyhmb2N1c2VkVmlld0lkLCB0cnVlKTtcblx0XHRcdH0gZWxzZSBpZiAoZGVzdGluYXRpb24uaWQgPT09ICdfLmF1eGlsaWFyeWJhci5uZXdjb250YWluZXInKSB7XG5cdFx0XHRcdHZpZXdEZXNjcmlwdG9yU2VydmljZS5tb3ZlVmlld1RvTG9jYXRpb24odmlld0Rlc2NyaXB0b3IsIFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIsIHRoaXMuZGVzYy5pZCk7XG5cdFx0XHRcdHZpZXdzU2VydmljZS5vcGVuVmlldyhmb2N1c2VkVmlld0lkLCB0cnVlKTtcblx0XHRcdH0gZWxzZSBpZiAoZGVzdGluYXRpb24uaWQpIHtcblx0XHRcdFx0dmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3c1RvQ29udGFpbmVyKFt2aWV3RGVzY3JpcHRvcl0sIHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChkZXN0aW5hdGlvbi5pZCkhLCB1bmRlZmluZWQsIHRoaXMuZGVzYy5pZCk7XG5cdFx0XHRcdHZpZXdzU2VydmljZS5vcGVuVmlldyhmb2N1c2VkVmlld0lkLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0cXVpY2tQaWNrLmhpZGUoKTtcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkSGlkZSgoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpKTtcblxuXHRcdHF1aWNrUGljay5zaG93KCk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKE1vdmVGb2N1c2VkVmlld0FjdGlvbik7XG5cbi8vIC0tLSBSZXNldCBGb2N1c2VkIFZpZXcgTG9jYXRpb25cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnJlc2V0Rm9jdXNlZFZpZXdMb2NhdGlvbicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdyZXNldEZvY3VzZWRWaWV3TG9jYXRpb24nLCBcIlJlc2V0IEZvY3VzZWQgVmlldyBMb2NhdGlvblwiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogRm9jdXNlZFZpZXdDb250ZXh0Lm5vdEVxdWFsc1RvKCcnKVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3RGVzY3JpcHRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZm9jdXNlZFZpZXdJZCA9IEZvY3VzZWRWaWV3Q29udGV4dC5nZXRWYWx1ZShjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRsZXQgdmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciB8IG51bGwgPSBudWxsO1xuXHRcdGlmIChmb2N1c2VkVmlld0lkICE9PSB1bmRlZmluZWQgJiYgZm9jdXNlZFZpZXdJZC50cmltKCkgIT09ICcnKSB7XG5cdFx0XHR2aWV3RGVzY3JpcHRvciA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3RGVzY3JpcHRvckJ5SWQoZm9jdXNlZFZpZXdJZCk7XG5cdFx0fVxuXG5cdFx0aWYgKCF2aWV3RGVzY3JpcHRvcikge1xuXHRcdFx0ZGlhbG9nU2VydmljZS5lcnJvcihsb2NhbGl6ZSgncmVzZXRGb2N1c2VkVmlldy5lcnJvci5ub0ZvY3VzZWRWaWV3JywgXCJUaGVyZSBpcyBubyB2aWV3IGN1cnJlbnRseSBmb2N1c2VkLlwiKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVmYXVsdENvbnRhaW5lciA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXREZWZhdWx0Q29udGFpbmVyQnlJZCh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0aWYgKCFkZWZhdWx0Q29udGFpbmVyIHx8IGRlZmF1bHRDb250YWluZXIgPT09IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodmlld0Rlc2NyaXB0b3IuaWQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3c1RvQ29udGFpbmVyKFt2aWV3RGVzY3JpcHRvcl0sIGRlZmF1bHRDb250YWluZXIsIHVuZGVmaW5lZCwgdGhpcy5kZXNjLmlkKTtcblx0XHR2aWV3c1NlcnZpY2Uub3BlblZpZXcodmlld0Rlc2NyaXB0b3IuaWQsIHRydWUpO1xuXHR9XG59KTtcblxuLy8gLS0tIFJlc2l6ZSBWaWV3XG5cbmFic3RyYWN0IGNsYXNzIEJhc2VSZXNpemVWaWV3QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0cHJvdGVjdGVkIHN0YXRpYyByZWFkb25seSBSRVNJWkVfSU5DUkVNRU5UID0gNjA7IC8vIFRoaXMgaXMgYSBjc3MgcGl4ZWwgc2l6ZVxuXG5cdHByb3RlY3RlZCByZXNpemVQYXJ0KHdpZHRoQ2hhbmdlOiBudW1iZXIsIGhlaWdodENoYW5nZTogbnVtYmVyLCBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgcGFydFRvUmVzaXplPzogUGFydHMpOiB2b2lkIHtcblxuXHRcdGxldCBwYXJ0OiBQYXJ0cyB8IHVuZGVmaW5lZDtcblx0XHRpZiAocGFydFRvUmVzaXplID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IGlzRWRpdG9yRm9jdXMgPSBsYXlvdXRTZXJ2aWNlLmhhc0ZvY3VzKFBhcnRzLkVESVRPUl9QQVJUKTtcblx0XHRcdGNvbnN0IGlzU2lkZWJhckZvY3VzID0gbGF5b3V0U2VydmljZS5oYXNGb2N1cyhQYXJ0cy5TSURFQkFSX1BBUlQpO1xuXHRcdFx0Y29uc3QgaXNQYW5lbEZvY3VzID0gbGF5b3V0U2VydmljZS5oYXNGb2N1cyhQYXJ0cy5QQU5FTF9QQVJUKTtcblx0XHRcdGNvbnN0IGlzQXV4aWxpYXJ5QmFyRm9jdXMgPSBsYXlvdXRTZXJ2aWNlLmhhc0ZvY3VzKFBhcnRzLkFVWElMSUFSWUJBUl9QQVJUKTtcblxuXHRcdFx0aWYgKGlzU2lkZWJhckZvY3VzKSB7XG5cdFx0XHRcdHBhcnQgPSBQYXJ0cy5TSURFQkFSX1BBUlQ7XG5cdFx0XHR9IGVsc2UgaWYgKGlzUGFuZWxGb2N1cykge1xuXHRcdFx0XHRwYXJ0ID0gUGFydHMuUEFORUxfUEFSVDtcblx0XHRcdH0gZWxzZSBpZiAoaXNFZGl0b3JGb2N1cykge1xuXHRcdFx0XHRwYXJ0ID0gUGFydHMuRURJVE9SX1BBUlQ7XG5cdFx0XHR9IGVsc2UgaWYgKGlzQXV4aWxpYXJ5QmFyRm9jdXMpIHtcblx0XHRcdFx0cGFydCA9IFBhcnRzLkFVWElMSUFSWUJBUl9QQVJUO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRwYXJ0ID0gcGFydFRvUmVzaXplO1xuXHRcdH1cblxuXHRcdGlmIChwYXJ0KSB7XG5cdFx0XHRsYXlvdXRTZXJ2aWNlLnJlc2l6ZVBhcnQocGFydCwgd2lkdGhDaGFuZ2UsIGhlaWdodENoYW5nZSk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIEluY3JlYXNlVmlld1NpemVBY3Rpb24gZXh0ZW5kcyBCYXNlUmVzaXplVmlld0FjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmluY3JlYXNlVmlld1NpemUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW5jcmVhc2VWaWV3U2l6ZScsICdJbmNyZWFzZSBDdXJyZW50IFZpZXcgU2l6ZScpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IElzQXV4aWxpYXJ5V2luZG93Rm9jdXNlZENvbnRleHQudG9OZWdhdGVkKClcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdHRoaXMucmVzaXplUGFydChCYXNlUmVzaXplVmlld0FjdGlvbi5SRVNJWkVfSU5DUkVNRU5ULCBCYXNlUmVzaXplVmlld0FjdGlvbi5SRVNJWkVfSU5DUkVNRU5ULCBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaExheW91dFNlcnZpY2UpKTtcblx0fVxufVxuXG5jbGFzcyBJbmNyZWFzZVZpZXdXaWR0aEFjdGlvbiBleHRlbmRzIEJhc2VSZXNpemVWaWV3QWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uaW5jcmVhc2VWaWV3V2lkdGgnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW5jcmVhc2VFZGl0b3JXaWR0aCcsICdJbmNyZWFzZSBFZGl0b3IgV2lkdGgnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBJc0F1eGlsaWFyeVdpbmRvd0ZvY3VzZWRDb250ZXh0LnRvTmVnYXRlZCgpXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHR0aGlzLnJlc2l6ZVBhcnQoQmFzZVJlc2l6ZVZpZXdBY3Rpb24uUkVTSVpFX0lOQ1JFTUVOVCwgMCwgYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKSwgUGFydHMuRURJVE9SX1BBUlQpO1xuXHR9XG59XG5cbmNsYXNzIEluY3JlYXNlVmlld0hlaWdodEFjdGlvbiBleHRlbmRzIEJhc2VSZXNpemVWaWV3QWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uaW5jcmVhc2VWaWV3SGVpZ2h0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2luY3JlYXNlRWRpdG9ySGVpZ2h0JywgJ0luY3JlYXNlIEVkaXRvciBIZWlnaHQnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBJc0F1eGlsaWFyeVdpbmRvd0ZvY3VzZWRDb250ZXh0LnRvTmVnYXRlZCgpXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHR0aGlzLnJlc2l6ZVBhcnQoMCwgQmFzZVJlc2l6ZVZpZXdBY3Rpb24uUkVTSVpFX0lOQ1JFTUVOVCwgYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKSwgUGFydHMuRURJVE9SX1BBUlQpO1xuXHR9XG59XG5cbmNsYXNzIERlY3JlYXNlVmlld1NpemVBY3Rpb24gZXh0ZW5kcyBCYXNlUmVzaXplVmlld0FjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmRlY3JlYXNlVmlld1NpemUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZGVjcmVhc2VWaWV3U2l6ZScsICdEZWNyZWFzZSBDdXJyZW50IFZpZXcgU2l6ZScpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IElzQXV4aWxpYXJ5V2luZG93Rm9jdXNlZENvbnRleHQudG9OZWdhdGVkKClcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdHRoaXMucmVzaXplUGFydCgtQmFzZVJlc2l6ZVZpZXdBY3Rpb24uUkVTSVpFX0lOQ1JFTUVOVCwgLUJhc2VSZXNpemVWaWV3QWN0aW9uLlJFU0laRV9JTkNSRU1FTlQsIGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSkpO1xuXHR9XG59XG5cbmNsYXNzIERlY3JlYXNlVmlld1dpZHRoQWN0aW9uIGV4dGVuZHMgQmFzZVJlc2l6ZVZpZXdBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZGVjcmVhc2VWaWV3V2lkdGgnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZGVjcmVhc2VFZGl0b3JXaWR0aCcsICdEZWNyZWFzZSBFZGl0b3IgV2lkdGgnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBJc0F1eGlsaWFyeVdpbmRvd0ZvY3VzZWRDb250ZXh0LnRvTmVnYXRlZCgpXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHR0aGlzLnJlc2l6ZVBhcnQoLUJhc2VSZXNpemVWaWV3QWN0aW9uLlJFU0laRV9JTkNSRU1FTlQsIDAsIGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSksIFBhcnRzLkVESVRPUl9QQVJUKTtcblx0fVxufVxuXG5jbGFzcyBEZWNyZWFzZVZpZXdIZWlnaHRBY3Rpb24gZXh0ZW5kcyBCYXNlUmVzaXplVmlld0FjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmRlY3JlYXNlVmlld0hlaWdodCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdkZWNyZWFzZUVkaXRvckhlaWdodCcsICdEZWNyZWFzZSBFZGl0b3IgSGVpZ2h0JyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogSXNBdXhpbGlhcnlXaW5kb3dGb2N1c2VkQ29udGV4dC50b05lZ2F0ZWQoKVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0dGhpcy5yZXNpemVQYXJ0KDAsIC1CYXNlUmVzaXplVmlld0FjdGlvbi5SRVNJWkVfSU5DUkVNRU5ULCBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaExheW91dFNlcnZpY2UpLCBQYXJ0cy5FRElUT1JfUEFSVCk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKEluY3JlYXNlVmlld1NpemVBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKEluY3JlYXNlVmlld1dpZHRoQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihJbmNyZWFzZVZpZXdIZWlnaHRBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoRGVjcmVhc2VWaWV3U2l6ZUFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRGVjcmVhc2VWaWV3V2lkdGhBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKERlY3JlYXNlVmlld0hlaWdodEFjdGlvbik7XG5cbi8vI3JlZ2lvbiBRdWljayBJbnB1dCBBbGlnbm1lbnQgQWN0aW9uc1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgQWxpZ25RdWlja0lucHV0VG9wQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmFsaWduUXVpY2tJbnB1dFRvcCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdhbGlnblF1aWNrSW5wdXRUb3AnLCAnQWxpZ24gUXVpY2sgSW5wdXQgVG9wJyksXG5cdFx0XHRmMTogZmFsc2Vcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0cXVpY2tJbnB1dFNlcnZpY2Uuc2V0QWxpZ25tZW50KCd0b3AnKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBBbGlnblF1aWNrSW5wdXRDZW50ZXJBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uYWxpZ25RdWlja0lucHV0Q2VudGVyJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2FsaWduUXVpY2tJbnB1dENlbnRlcicsICdBbGlnbiBRdWljayBJbnB1dCBDZW50ZXInKSxcblx0XHRcdGYxOiBmYWxzZVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRxdWlja0lucHV0U2VydmljZS5zZXRBbGlnbm1lbnQoJ2NlbnRlcicpO1xuXHR9XG59KTtcblxuLy8jZW5kcmVnaW9uXG5cbnR5cGUgQ29udGV4dHVhbExheW91dFZpc3VhbEljb24gPSB7IGljb25BOiBUaGVtZUljb247IGljb25COiBUaGVtZUljb247IHdoZW5BOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB9O1xudHlwZSBMYXlvdXRWaXN1YWxJY29uID0gVGhlbWVJY29uIHwgQ29udGV4dHVhbExheW91dFZpc3VhbEljb247XG5cbmZ1bmN0aW9uIGlzQ29udGV4dHVhbExheW91dFZpc3VhbEljb24oaWNvbjogTGF5b3V0VmlzdWFsSWNvbik6IGljb24gaXMgQ29udGV4dHVhbExheW91dFZpc3VhbEljb24ge1xuXHRyZXR1cm4gKGljb24gYXMgQ29udGV4dHVhbExheW91dFZpc3VhbEljb24pLmljb25BICE9PSB1bmRlZmluZWQ7XG59XG5cbmludGVyZmFjZSBDdXN0b21pemVMYXlvdXRJdGVtIHtcblx0aWQ6IHN0cmluZztcblx0YWN0aXZlOiBDb250ZXh0S2V5RXhwcmVzc2lvbjtcblx0bGFiZWw6IHN0cmluZztcblx0YWN0aXZlSWNvbjogVGhlbWVJY29uO1xuXHR2aXN1YWxJY29uPzogTGF5b3V0VmlzdWFsSWNvbjtcblx0YWN0aXZlQXJpYUxhYmVsOiBzdHJpbmc7XG5cdGluYWN0aXZlSWNvbj86IFRoZW1lSWNvbjtcblx0aW5hY3RpdmVBcmlhTGFiZWw/OiBzdHJpbmc7XG5cdHVzZUJ1dHRvbnM6IGJvb2xlYW47XG59XG5cbmNvbnN0IENyZWF0ZVRvZ2dsZUxheW91dEl0ZW0gPSAoaWQ6IHN0cmluZywgYWN0aXZlOiBDb250ZXh0S2V5RXhwcmVzc2lvbiwgbGFiZWw6IHN0cmluZywgdmlzdWFsSWNvbj86IExheW91dFZpc3VhbEljb24pOiBDdXN0b21pemVMYXlvdXRJdGVtID0+IHtcblx0cmV0dXJuIHtcblx0XHRpZCxcblx0XHRhY3RpdmUsXG5cdFx0bGFiZWwsXG5cdFx0dmlzdWFsSWNvbixcblx0XHRhY3RpdmVJY29uOiBDb2RpY29uLmV5ZSxcblx0XHRpbmFjdGl2ZUljb246IENvZGljb24uZXllQ2xvc2VkLFxuXHRcdGFjdGl2ZUFyaWFMYWJlbDogbG9jYWxpemUoJ3NlbGVjdFRvSGlkZScsIFwiU2VsZWN0IHRvIEhpZGVcIiksXG5cdFx0aW5hY3RpdmVBcmlhTGFiZWw6IGxvY2FsaXplKCdzZWxlY3RUb1Nob3cnLCBcIlNlbGVjdCB0byBTaG93XCIpLFxuXHRcdHVzZUJ1dHRvbnM6IHRydWUsXG5cdH07XG59O1xuXG5jb25zdCBDcmVhdGVPcHRpb25MYXlvdXRJdGVtID0gKGlkOiBzdHJpbmcsIGFjdGl2ZTogQ29udGV4dEtleUV4cHJlc3Npb24sIGxhYmVsOiBzdHJpbmcsIHZpc3VhbEljb24/OiBMYXlvdXRWaXN1YWxJY29uKTogQ3VzdG9taXplTGF5b3V0SXRlbSA9PiB7XG5cdHJldHVybiB7XG5cdFx0aWQsXG5cdFx0YWN0aXZlLFxuXHRcdGxhYmVsLFxuXHRcdHZpc3VhbEljb24sXG5cdFx0YWN0aXZlSWNvbjogQ29kaWNvbi5jaGVjayxcblx0XHRhY3RpdmVBcmlhTGFiZWw6IGxvY2FsaXplKCdhY3RpdmUnLCBcIkFjdGl2ZVwiKSxcblx0XHR1c2VCdXR0b25zOiBmYWxzZVxuXHR9O1xufTtcblxuY29uc3QgTWVudUJhclRvZ2dsZWRDb250ZXh0ID0gQ29udGV4dEtleUV4cHIuYW5kKElzTWFjTmF0aXZlQ29udGV4dC50b05lZ2F0ZWQoKSwgQ29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjb25maWcud2luZG93Lm1lbnVCYXJWaXNpYmlsaXR5JywgJ2hpZGRlbicpLCBDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2NvbmZpZy53aW5kb3cubWVudUJhclZpc2liaWxpdHknLCAndG9nZ2xlJyksIENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLndpbmRvdy5tZW51QmFyVmlzaWJpbGl0eScsICdjb21wYWN0JykpIGFzIENvbnRleHRLZXlFeHByZXNzaW9uO1xuY29uc3QgVG9nZ2xlVmlzaWJpbGl0eUFjdGlvbnM6IEN1c3RvbWl6ZUxheW91dEl0ZW1bXSA9IFtdO1xuaWYgKCFpc01hY2ludG9zaCB8fCAhaXNOYXRpdmUpIHtcblx0VG9nZ2xlVmlzaWJpbGl0eUFjdGlvbnMucHVzaChDcmVhdGVUb2dnbGVMYXlvdXRJdGVtKCd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZU1lbnVCYXInLCBNZW51QmFyVG9nZ2xlZENvbnRleHQsIGxvY2FsaXplKCdtZW51QmFyJywgXCJNZW51IEJhclwiKSwgbWVudWJhckljb24pKTtcbn1cblxuVG9nZ2xlVmlzaWJpbGl0eUFjdGlvbnMucHVzaCguLi5bXG5cdENyZWF0ZVRvZ2dsZUxheW91dEl0ZW0oVG9nZ2xlQWN0aXZpdHlCYXJWaXNpYmlsaXR5QWN0aW9uSWQsIENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLndvcmtiZW5jaC5hY3Rpdml0eUJhci5sb2NhdGlvbicsICdoaWRkZW4nKSwgbG9jYWxpemUoJ2FjdGl2aXR5QmFyJywgXCJBY3Rpdml0eSBCYXJcIiksIHsgd2hlbkE6IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLndvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uJywgJ2xlZnQnKSwgaWNvbkE6IGFjdGl2aXR5QmFyTGVmdEljb24sIGljb25COiBhY3Rpdml0eUJhclJpZ2h0SWNvbiB9KSxcblx0Q3JlYXRlVG9nZ2xlTGF5b3V0SXRlbShUb2dnbGVTaWRlYmFyVmlzaWJpbGl0eUFjdGlvbi5JRCwgU2lkZUJhclZpc2libGVDb250ZXh0LCBsb2NhbGl6ZSgnc2lkZUJhcicsIFwiUHJpbWFyeSBTaWRlIEJhclwiKSwgeyB3aGVuQTogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLnNpZGVCYXIubG9jYXRpb24nLCAnbGVmdCcpLCBpY29uQTogcGFuZWxMZWZ0SWNvbiwgaWNvbkI6IHBhbmVsUmlnaHRJY29uIH0pLFxuXHRDcmVhdGVUb2dnbGVMYXlvdXRJdGVtKFRvZ2dsZUF1eGlsaWFyeUJhckFjdGlvbi5JRCwgQXV4aWxpYXJ5QmFyVmlzaWJsZUNvbnRleHQsIGxvY2FsaXplKCdzZWNvbmRhcnlTaWRlQmFyJywgXCJWb2lkIFNpZGUgQmFyXCIpLCB7IHdoZW5BOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2guc2lkZUJhci5sb2NhdGlvbicsICdsZWZ0JyksIGljb25BOiBwYW5lbFJpZ2h0SWNvbiwgaWNvbkI6IHBhbmVsTGVmdEljb24gfSksXG5cdENyZWF0ZVRvZ2dsZUxheW91dEl0ZW0oVG9nZ2xlUGFuZWxBY3Rpb24uSUQsIFBhbmVsVmlzaWJsZUNvbnRleHQsIGxvY2FsaXplKCdwYW5lbCcsIFwiUGFuZWxcIiksIHBhbmVsSWNvbiksXG5cdENyZWF0ZVRvZ2dsZUxheW91dEl0ZW0oVG9nZ2xlU3RhdHVzYmFyVmlzaWJpbGl0eUFjdGlvbi5JRCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLnN0YXR1c0Jhci52aXNpYmxlJywgdHJ1ZSksIGxvY2FsaXplKCdzdGF0dXNCYXInLCBcIlN0YXR1cyBCYXJcIiksIHN0YXR1c0Jhckljb24pLFxuXSk7XG5cbmNvbnN0IE1vdmVTaWRlQmFyQWN0aW9uczogQ3VzdG9taXplTGF5b3V0SXRlbVtdID0gW1xuXHRDcmVhdGVPcHRpb25MYXlvdXRJdGVtKE1vdmVTaWRlYmFyTGVmdEFjdGlvbi5JRCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLnNpZGVCYXIubG9jYXRpb24nLCAnbGVmdCcpLCBsb2NhbGl6ZSgnbGVmdFNpZGVCYXInLCBcIkxlZnRcIiksIHBhbmVsTGVmdEljb24pLFxuXHRDcmVhdGVPcHRpb25MYXlvdXRJdGVtKE1vdmVTaWRlYmFyUmlnaHRBY3Rpb24uSUQsIENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLndvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uJywgJ3JpZ2h0JyksIGxvY2FsaXplKCdyaWdodFNpZGVCYXInLCBcIlJpZ2h0XCIpLCBwYW5lbFJpZ2h0SWNvbiksXG5dO1xuXG5jb25zdCBBbGlnblBhbmVsQWN0aW9uczogQ3VzdG9taXplTGF5b3V0SXRlbVtdID0gW1xuXHRDcmVhdGVPcHRpb25MYXlvdXRJdGVtKCd3b3JrYmVuY2guYWN0aW9uLmFsaWduUGFuZWxMZWZ0JywgUGFuZWxBbGlnbm1lbnRDb250ZXh0LmlzRXF1YWxUbygnbGVmdCcpLCBsb2NhbGl6ZSgnbGVmdFBhbmVsJywgXCJMZWZ0XCIpLCBwYW5lbEFsaWdubWVudExlZnRJY29uKSxcblx0Q3JlYXRlT3B0aW9uTGF5b3V0SXRlbSgnd29ya2JlbmNoLmFjdGlvbi5hbGlnblBhbmVsUmlnaHQnLCBQYW5lbEFsaWdubWVudENvbnRleHQuaXNFcXVhbFRvKCdyaWdodCcpLCBsb2NhbGl6ZSgncmlnaHRQYW5lbCcsIFwiUmlnaHRcIiksIHBhbmVsQWxpZ25tZW50UmlnaHRJY29uKSxcblx0Q3JlYXRlT3B0aW9uTGF5b3V0SXRlbSgnd29ya2JlbmNoLmFjdGlvbi5hbGlnblBhbmVsQ2VudGVyJywgUGFuZWxBbGlnbm1lbnRDb250ZXh0LmlzRXF1YWxUbygnY2VudGVyJyksIGxvY2FsaXplKCdjZW50ZXJQYW5lbCcsIFwiQ2VudGVyXCIpLCBwYW5lbEFsaWdubWVudENlbnRlckljb24pLFxuXHRDcmVhdGVPcHRpb25MYXlvdXRJdGVtKCd3b3JrYmVuY2guYWN0aW9uLmFsaWduUGFuZWxKdXN0aWZ5JywgUGFuZWxBbGlnbm1lbnRDb250ZXh0LmlzRXF1YWxUbygnanVzdGlmeScpLCBsb2NhbGl6ZSgnanVzdGlmeVBhbmVsJywgXCJKdXN0aWZ5XCIpLCBwYW5lbEFsaWdubWVudEp1c3RpZnlJY29uKSxcbl07XG5cbmNvbnN0IFF1aWNrSW5wdXRBY3Rpb25zOiBDdXN0b21pemVMYXlvdXRJdGVtW10gPSBbXG5cdENyZWF0ZU9wdGlvbkxheW91dEl0ZW0oJ3dvcmtiZW5jaC5hY3Rpb24uYWxpZ25RdWlja0lucHV0VG9wJywgUXVpY2tJbnB1dEFsaWdubWVudENvbnRleHRLZXkuaXNFcXVhbFRvKCd0b3AnKSwgbG9jYWxpemUoJ3RvcCcsIFwiVG9wXCIpLCBxdWlja0lucHV0QWxpZ25tZW50VG9wSWNvbiksXG5cdENyZWF0ZU9wdGlvbkxheW91dEl0ZW0oJ3dvcmtiZW5jaC5hY3Rpb24uYWxpZ25RdWlja0lucHV0Q2VudGVyJywgUXVpY2tJbnB1dEFsaWdubWVudENvbnRleHRLZXkuaXNFcXVhbFRvKCdjZW50ZXInKSwgbG9jYWxpemUoJ2NlbnRlcicsIFwiQ2VudGVyXCIpLCBxdWlja0lucHV0QWxpZ25tZW50Q2VudGVySWNvbiksXG5dO1xuXG5jb25zdCBNaXNjTGF5b3V0T3B0aW9uczogQ3VzdG9taXplTGF5b3V0SXRlbVtdID0gW1xuXHRDcmVhdGVPcHRpb25MYXlvdXRJdGVtKCd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZUZ1bGxTY3JlZW4nLCBJc01haW5XaW5kb3dGdWxsc2NyZWVuQ29udGV4dCwgbG9jYWxpemUoJ2Z1bGxzY3JlZW4nLCBcIkZ1bGwgU2NyZWVuXCIpLCBmdWxsc2NyZWVuSWNvbiksXG5cdENyZWF0ZU9wdGlvbkxheW91dEl0ZW0oJ3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlWmVuTW9kZScsIEluRWRpdG9yWmVuTW9kZUNvbnRleHQsIGxvY2FsaXplKCd6ZW5Nb2RlJywgXCJaZW4gTW9kZVwiKSwgemVuTW9kZUljb24pLFxuXHRDcmVhdGVPcHRpb25MYXlvdXRJdGVtKCd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZUNlbnRlcmVkTGF5b3V0JywgSXNNYWluRWRpdG9yQ2VudGVyZWRMYXlvdXRDb250ZXh0LCBsb2NhbGl6ZSgnY2VudGVyZWRMYXlvdXQnLCBcIkNlbnRlcmVkIExheW91dFwiKSwgY2VudGVyTGF5b3V0SWNvbiksXG5dO1xuXG5jb25zdCBMYXlvdXRDb250ZXh0S2V5U2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5mb3IgKGNvbnN0IHsgYWN0aXZlIH0gb2YgWy4uLlRvZ2dsZVZpc2liaWxpdHlBY3Rpb25zLCAuLi5Nb3ZlU2lkZUJhckFjdGlvbnMsIC4uLkFsaWduUGFuZWxBY3Rpb25zLCAuLi5RdWlja0lucHV0QWN0aW9ucywgLi4uTWlzY0xheW91dE9wdGlvbnNdKSB7XG5cdGZvciAoY29uc3Qga2V5IG9mIGFjdGl2ZS5rZXlzKCkpIHtcblx0XHRMYXlvdXRDb250ZXh0S2V5U2V0LmFkZChrZXkpO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDdXN0b21pemVMYXlvdXRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRwcml2YXRlIF9jdXJyZW50UXVpY2tQaWNrPzogSVF1aWNrUGljazxJUXVpY2tQaWNrSXRlbSwgeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0+O1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jdXN0b21pemVMYXlvdXQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignY3VzdG9taXplTGF5b3V0JywgXCJDdXN0b21pemUgTGF5b3V0Li4uXCIpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRpY29uOiBjb25maWd1cmVMYXlvdXRJY29uLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5MYXlvdXRDb250cm9sTWVudVN1Ym1lbnUsXG5cdFx0XHRcdFx0Z3JvdXA6ICd6X2VuZCcsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkxheW91dENvbnRyb2xNZW51LFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLndvcmtiZW5jaC5sYXlvdXRDb250cm9sLnR5cGUnLCAnYm90aCcpLFxuXHRcdFx0XHRcdGdyb3VwOiAnMV9sYXlvdXQnXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdGdldEl0ZW1zKGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UpOiBRdWlja1BpY2tJdGVtW10ge1xuXHRcdGNvbnN0IHRvUXVpY2tQaWNrSXRlbSA9IChpdGVtOiBDdXN0b21pemVMYXlvdXRJdGVtKTogSVF1aWNrUGlja0l0ZW0gPT4ge1xuXHRcdFx0Y29uc3QgdG9nZ2xlZCA9IGl0ZW0uYWN0aXZlLmV2YWx1YXRlKGNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHQobnVsbCkpO1xuXHRcdFx0bGV0IGxhYmVsID0gaXRlbS51c2VCdXR0b25zID9cblx0XHRcdFx0aXRlbS5sYWJlbCA6XG5cdFx0XHRcdGl0ZW0ubGFiZWwgKyAodG9nZ2xlZCAmJiBpdGVtLmFjdGl2ZUljb24gPyBgICQoJHtpdGVtLmFjdGl2ZUljb24uaWR9KWAgOiAoIXRvZ2dsZWQgJiYgaXRlbS5pbmFjdGl2ZUljb24gPyBgICQoJHtpdGVtLmluYWN0aXZlSWNvbi5pZH0pYCA6ICcnKSk7XG5cdFx0XHRjb25zdCBhcmlhTGFiZWwgPVxuXHRcdFx0XHRpdGVtLmxhYmVsICsgKHRvZ2dsZWQgJiYgaXRlbS5hY3RpdmVBcmlhTGFiZWwgPyBgICgke2l0ZW0uYWN0aXZlQXJpYUxhYmVsfSlgIDogKCF0b2dnbGVkICYmIGl0ZW0uaW5hY3RpdmVBcmlhTGFiZWwgPyBgICgke2l0ZW0uaW5hY3RpdmVBcmlhTGFiZWx9KWAgOiAnJykpO1xuXG5cdFx0XHRpZiAoaXRlbS52aXN1YWxJY29uKSB7XG5cdFx0XHRcdGxldCBpY29uID0gaXRlbS52aXN1YWxJY29uO1xuXHRcdFx0XHRpZiAoaXNDb250ZXh0dWFsTGF5b3V0VmlzdWFsSWNvbihpY29uKSkge1xuXHRcdFx0XHRcdGNvbnN0IHVzZUljb25BID0gaWNvbi53aGVuQS5ldmFsdWF0ZShjb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0KG51bGwpKTtcblx0XHRcdFx0XHRpY29uID0gdXNlSWNvbkEgPyBpY29uLmljb25BIDogaWNvbi5pY29uQjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxhYmVsID0gYCQoJHtpY29uLmlkfSkgJHtsYWJlbH1gO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpY29uID0gdG9nZ2xlZCA/IGl0ZW0uYWN0aXZlSWNvbiA6IGl0ZW0uaW5hY3RpdmVJY29uO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiAnaXRlbScsXG5cdFx0XHRcdGlkOiBpdGVtLmlkLFxuXHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0YXJpYUxhYmVsLFxuXHRcdFx0XHRrZXliaW5kaW5nOiBrZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGl0ZW0uaWQsIGNvbnRleHRLZXlTZXJ2aWNlKSxcblx0XHRcdFx0YnV0dG9uczogIWl0ZW0udXNlQnV0dG9ucyA/IHVuZGVmaW5lZCA6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRhbHdheXNWaXNpYmxlOiBmYWxzZSxcblx0XHRcdFx0XHRcdHRvb2x0aXA6IGFyaWFMYWJlbCxcblx0XHRcdFx0XHRcdGljb25DbGFzczogaWNvbiA/IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShpY29uKSA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblx0XHR9O1xuXHRcdHJldHVybiBbXG5cdFx0XHR7XG5cdFx0XHRcdHR5cGU6ICdzZXBhcmF0b3InLFxuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3RvZ2dsZVZpc2liaWxpdHknLCBcIlZpc2liaWxpdHlcIilcblx0XHRcdH0sXG5cdFx0XHQuLi5Ub2dnbGVWaXNpYmlsaXR5QWN0aW9ucy5tYXAodG9RdWlja1BpY2tJdGVtKSxcblx0XHRcdHtcblx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2lkZUJhclBvc2l0aW9uJywgXCJQcmltYXJ5IFNpZGUgQmFyIFBvc2l0aW9uXCIpXG5cdFx0XHR9LFxuXHRcdFx0Li4uTW92ZVNpZGVCYXJBY3Rpb25zLm1hcCh0b1F1aWNrUGlja0l0ZW0pLFxuXHRcdFx0e1xuXHRcdFx0XHR0eXBlOiAnc2VwYXJhdG9yJyxcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdwYW5lbEFsaWdubWVudCcsIFwiUGFuZWwgQWxpZ25tZW50XCIpXG5cdFx0XHR9LFxuXHRcdFx0Li4uQWxpZ25QYW5lbEFjdGlvbnMubWFwKHRvUXVpY2tQaWNrSXRlbSksXG5cdFx0XHR7XG5cdFx0XHRcdHR5cGU6ICdzZXBhcmF0b3InLFxuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3F1aWNrT3BlbicsIFwiUXVpY2sgSW5wdXQgUG9zaXRpb25cIilcblx0XHRcdH0sXG5cdFx0XHQuLi5RdWlja0lucHV0QWN0aW9ucy5tYXAodG9RdWlja1BpY2tJdGVtKSxcblx0XHRcdHtcblx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbGF5b3V0TW9kZXMnLCBcIk1vZGVzXCIpLFxuXHRcdFx0fSxcblx0XHRcdC4uLk1pc2NMYXlvdXRPcHRpb25zLm1hcCh0b1F1aWNrUGlja0l0ZW0pLFxuXHRcdF07XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fY3VycmVudFF1aWNrUGljaykge1xuXHRcdFx0dGhpcy5fY3VycmVudFF1aWNrUGljay5oaWRlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBrZXliaW5kaW5nU2VydmljZSA9IGFjY2Vzc29yLmdldChJS2V5YmluZGluZ1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBxdWlja1BpY2sgPSBkaXNwb3NhYmxlcy5hZGQocXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrKHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9KSk7XG5cblx0XHR0aGlzLl9jdXJyZW50UXVpY2tQaWNrID0gcXVpY2tQaWNrO1xuXHRcdHF1aWNrUGljay5pdGVtcyA9IHRoaXMuZ2V0SXRlbXMoY29udGV4dEtleVNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlKTtcblx0XHRxdWlja1BpY2suaWdub3JlRm9jdXNPdXQgPSB0cnVlO1xuXHRcdHF1aWNrUGljay5oaWRlSW5wdXQgPSB0cnVlO1xuXHRcdHF1aWNrUGljay50aXRsZSA9IGxvY2FsaXplKCdjdXN0b21pemVMYXlvdXRRdWlja1BpY2tUaXRsZScsIFwiQ3VzdG9taXplIExheW91dFwiKTtcblxuXHRcdGNvbnN0IGNsb3NlQnV0dG9uID0ge1xuXHRcdFx0YWx3YXlzVmlzaWJsZTogdHJ1ZSxcblx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uY2xvc2UpLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2Nsb3NlJywgXCJDbG9zZVwiKVxuXHRcdH07XG5cblx0XHRjb25zdCByZXNldEJ1dHRvbiA9IHtcblx0XHRcdGFsd2F5c1Zpc2libGU6IHRydWUsXG5cdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmRpc2NhcmQpLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3Jlc3RvcmUgZGVmYXVsdHMnLCBcIlJlc3RvcmUgRGVmYXVsdHNcIilcblx0XHR9O1xuXG5cdFx0cXVpY2tQaWNrLmJ1dHRvbnMgPSBbXG5cdFx0XHRyZXNldEJ1dHRvbixcblx0XHRcdGNsb3NlQnV0dG9uXG5cdFx0XTtcblxuXHRcdGxldCBzZWxlY3RlZEl0ZW06IEN1c3RvbWl6ZUxheW91dEl0ZW0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGNvbnRleHRLZXlTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGV4dChjaGFuZ2VFdmVudCA9PiB7XG5cdFx0XHRpZiAoY2hhbmdlRXZlbnQuYWZmZWN0c1NvbWUoTGF5b3V0Q29udGV4dEtleVNldCkpIHtcblx0XHRcdFx0cXVpY2tQaWNrLml0ZW1zID0gdGhpcy5nZXRJdGVtcyhjb250ZXh0S2V5U2VydmljZSwga2V5YmluZGluZ1NlcnZpY2UpO1xuXHRcdFx0XHRpZiAoc2VsZWN0ZWRJdGVtKSB7XG5cdFx0XHRcdFx0cXVpY2tQaWNrLmFjdGl2ZUl0ZW1zID0gcXVpY2tQaWNrLml0ZW1zLmZpbHRlcihpdGVtID0+IChpdGVtIGFzIEN1c3RvbWl6ZUxheW91dEl0ZW0pLmlkID09PSBzZWxlY3RlZEl0ZW0/LmlkKSBhcyBJUXVpY2tQaWNrSXRlbVtdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiBxdWlja0lucHV0U2VydmljZS5mb2N1cygpLCAwKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkQWNjZXB0KGV2ZW50ID0+IHtcblx0XHRcdGlmIChxdWlja1BpY2suc2VsZWN0ZWRJdGVtcy5sZW5ndGgpIHtcblx0XHRcdFx0c2VsZWN0ZWRJdGVtID0gcXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF0gYXMgQ3VzdG9taXplTGF5b3V0SXRlbTtcblx0XHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoc2VsZWN0ZWRJdGVtLmlkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkVHJpZ2dlckl0ZW1CdXR0b24oZXZlbnQgPT4ge1xuXHRcdFx0aWYgKGV2ZW50Lml0ZW0pIHtcblx0XHRcdFx0c2VsZWN0ZWRJdGVtID0gZXZlbnQuaXRlbSBhcyBDdXN0b21pemVMYXlvdXRJdGVtO1xuXHRcdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChzZWxlY3RlZEl0ZW0uaWQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRUcmlnZ2VyQnV0dG9uKChidXR0b24pID0+IHtcblx0XHRcdGlmIChidXR0b24gPT09IGNsb3NlQnV0dG9uKSB7XG5cdFx0XHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0XHR9IGVsc2UgaWYgKGJ1dHRvbiA9PT0gcmVzZXRCdXR0b24pIHtcblxuXHRcdFx0XHRjb25zdCByZXNldFNldHRpbmcgPSAoaWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGNvbmZpZyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3QoaWQpO1xuXHRcdFx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGlkLCBjb25maWcuZGVmYXVsdFZhbHVlKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvLyBSZXNldCBhbGwgbGF5b3V0IG9wdGlvbnNcblx0XHRcdFx0cmVzZXRTZXR0aW5nKCd3b3JrYmVuY2guYWN0aXZpdHlCYXIubG9jYXRpb24nKTtcblx0XHRcdFx0cmVzZXRTZXR0aW5nKCd3b3JrYmVuY2guc2lkZUJhci5sb2NhdGlvbicpO1xuXHRcdFx0XHRyZXNldFNldHRpbmcoJ3dvcmtiZW5jaC5zdGF0dXNCYXIudmlzaWJsZScpO1xuXHRcdFx0XHRyZXNldFNldHRpbmcoJ3dvcmtiZW5jaC5wYW5lbC5kZWZhdWx0TG9jYXRpb24nKTtcblxuXHRcdFx0XHRpZiAoIWlzTWFjaW50b3NoIHx8ICFpc05hdGl2ZSkge1xuXHRcdFx0XHRcdHJlc2V0U2V0dGluZygnd2luZG93Lm1lbnVCYXJWaXNpYmlsaXR5Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5hbGlnblBhbmVsQ2VudGVyJyk7XG5cdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLmFsaWduUXVpY2tJbnB1dFRvcCcpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdHF1aWNrUGljay5kaXNwb3NlKCk7XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fY3VycmVudFF1aWNrUGljayA9IHVuZGVmaW5lZDtcblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9KSk7XG5cblx0XHRxdWlja1BpY2suc2hvdygpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQTJCLFVBQVUsaUJBQWlCO0FBQ3RELFNBQVMsUUFBUSxjQUFjLGlCQUFpQixlQUFlO0FBQy9ELFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsNkJBQTZCO0FBQ3RDLFNB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
