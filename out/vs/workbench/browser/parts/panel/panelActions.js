var _a;
import "./media/panelpart.css";
import { localize, localize2 } from "../../../../nls.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { MenuId, MenuRegistry, registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { isHorizontal, IWorkbenchLayoutService, Parts, Position, positionToString } from "../../../services/layout/browser/layoutService.js";
import { PanelAlignmentContext, PanelMaximizedContext, PanelPositionContext, PanelVisibleContext } from "../../../common/contextkeys.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { ViewContainerLocation, IViewDescriptorService } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { SwitchCompositeViewAction } from "../compositeBarActions.js";
const maximizeIcon = registerIcon("panel-maximize", Codicon.chevronUp, localize("maximizeIcon", "Icon to maximize a panel."));
const restoreIcon = registerIcon("panel-restore", Codicon.chevronDown, localize("restoreIcon", "Icon to restore a panel."));
const closeIcon = registerIcon("panel-close", Codicon.close, localize("closeIcon", "Icon to close a panel."));
const panelIcon = registerIcon("panel-layout-icon", Codicon.layoutPanel, localize("togglePanelOffIcon", "Icon to toggle the panel off when it is on."));
const panelOffIcon = registerIcon("panel-layout-icon-off", Codicon.layoutPanelOff, localize("togglePanelOnIcon", "Icon to toggle the panel on when it is off."));
const _TogglePanelAction = class _TogglePanelAction extends Action2 {
  constructor() {
    super({
      id: _TogglePanelAction.ID,
      title: _TogglePanelAction.LABEL,
      toggled: {
        condition: PanelVisibleContext,
        title: localize("closePanel", "Hide Panel"),
        icon: closeIcon,
        mnemonicTitle: localize({ key: "toggle panel mnemonic", comment: ["&& denotes a mnemonic"] }, "&&Panel")
      },
      icon: closeIcon,
      // Ensures no flickering when using toggled.icon
      f1: true,
      category: Categories.View,
      metadata: {
        description: localize("openAndClosePanel", "Open/Show and Close/Hide Panel")
      },
      keybinding: { primary: KeyMod.CtrlCmd | KeyCode.KeyJ, weight: KeybindingWeight.WorkbenchContrib },
      menu: [
        {
          id: MenuId.MenubarAppearanceMenu,
          group: "2_workbench_layout",
          order: 5
        },
        {
          id: MenuId.LayoutControlMenuSubmenu,
          group: "0_workbench_layout",
          order: 4
        },
        {
          id: MenuId.PanelTitle,
          group: "navigation",
          order: 2
        }
      ]
    });
  }
  async run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    layoutService.setPartHidden(layoutService.isVisible(Parts.PANEL_PART), Parts.PANEL_PART);
  }
};
_TogglePanelAction.ID = "workbench.action.togglePanel";
_TogglePanelAction.LABEL = localize2("togglePanelVisibility", "Toggle Panel Visibility");
let TogglePanelAction = _TogglePanelAction;
registerAction2(TogglePanelAction);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.closePanel",
      title: localize2("closePanel", "Hide Panel"),
      category: Categories.View,
      precondition: PanelVisibleContext,
      f1: true
    });
  }
  run(accessor) {
    accessor.get(IWorkbenchLayoutService).setPartHidden(true, Parts.PANEL_PART);
  }
});
registerAction2((_a = class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.focusPanel",
      title: localize2("focusPanel", "Focus into Panel"),
      category: Categories.View,
      f1: true
    });
  }
  async run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    if (!layoutService.isVisible(Parts.PANEL_PART)) {
      layoutService.setPartHidden(false, Parts.PANEL_PART);
    }
    const panel = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
    panel?.focus();
  }
}, _a.ID = "workbench.action.focusPanel", _a.LABEL = localize("focusPanel", "Focus into Panel"), _a));
const PositionPanelActionId = {
  LEFT: "workbench.action.positionPanelLeft",
  RIGHT: "workbench.action.positionPanelRight",
  BOTTOM: "workbench.action.positionPanelBottom",
  TOP: "workbench.action.positionPanelTop"
};
const AlignPanelActionId = {
  LEFT: "workbench.action.alignPanelLeft",
  RIGHT: "workbench.action.alignPanelRight",
  CENTER: "workbench.action.alignPanelCenter",
  JUSTIFY: "workbench.action.alignPanelJustify"
};
function createPanelActionConfig(id, title, shortLabel, value, when) {
  return {
    id,
    title,
    shortLabel,
    value,
    when
  };
}
function createPositionPanelActionConfig(id, title, shortLabel, position) {
  return createPanelActionConfig(id, title, shortLabel, position, PanelPositionContext.notEqualsTo(positionToString(position)));
}
function createAlignmentPanelActionConfig(id, title, shortLabel, alignment) {
  return createPanelActionConfig(id, title, shortLabel, alignment, PanelAlignmentContext.notEqualsTo(alignment));
}
const PositionPanelActionConfigs = [
  createPositionPanelActionConfig(PositionPanelActionId.TOP, localize2("positionPanelTop", "Move Panel To Top"), localize("positionPanelTopShort", "Top"), Position.TOP),
  createPositionPanelActionConfig(PositionPanelActionId.LEFT, localize2("positionPanelLeft", "Move Panel Left"), localize("positionPanelLeftShort", "Left"), Position.LEFT),
  createPositionPanelActionConfig(PositionPanelActionId.RIGHT, localize2("positionPanelRight", "Move Panel Right"), localize("positionPanelRightShort", "Right"), Position.RIGHT),
  createPositionPanelActionConfig(PositionPanelActionId.BOTTOM, localize2("positionPanelBottom", "Move Panel To Bottom"), localize("positionPanelBottomShort", "Bottom"), Position.BOTTOM)
];
const AlignPanelActionConfigs = [
  createAlignmentPanelActionConfig(AlignPanelActionId.LEFT, localize2("alignPanelLeft", "Set Panel Alignment to Left"), localize("alignPanelLeftShort", "Left"), "left"),
  createAlignmentPanelActionConfig(AlignPanelActionId.RIGHT, localize2("alignPanelRight", "Set Panel Alignment to Right"), localize("alignPanelRightShort", "Right"), "right"),
  createAlignmentPanelActionConfig(AlignPanelActionId.CENTER, localize2("alignPanelCenter", "Set Panel Alignment to Center"), localize("alignPanelCenterShort", "Center"), "center"),
  createAlignmentPanelActionConfig(AlignPanelActionId.JUSTIFY, localize2("alignPanelJustify", "Set Panel Alignment to Justify"), localize("alignPanelJustifyShort", "Justify"), "justify")
];
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
  submenu: MenuId.PanelPositionMenu,
  title: localize("positionPanel", "Panel Position"),
  group: "3_workbench_layout_move",
  order: 4
});
PositionPanelActionConfigs.forEach((positionPanelAction, index) => {
  const { id, title, shortLabel, value, when } = positionPanelAction;
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id,
        title,
        category: Categories.View,
        f1: true
      });
    }
    run(accessor) {
      const layoutService = accessor.get(IWorkbenchLayoutService);
      layoutService.setPanelPosition(value === void 0 ? Position.BOTTOM : value);
    }
  });
  MenuRegistry.appendMenuItem(MenuId.PanelPositionMenu, {
    command: {
      id,
      title: shortLabel,
      toggled: when.negate()
    },
    order: 5 + index
  });
});
MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
  submenu: MenuId.PanelAlignmentMenu,
  title: localize("alignPanel", "Align Panel"),
  group: "3_workbench_layout_move",
  order: 5
});
AlignPanelActionConfigs.forEach((alignPanelAction) => {
  const { id, title, shortLabel, value, when } = alignPanelAction;
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id,
        title,
        category: Categories.View,
        toggled: when.negate(),
        f1: true
      });
    }
    run(accessor) {
      const layoutService = accessor.get(IWorkbenchLayoutService);
      layoutService.setPanelAlignment(value === void 0 ? "center" : value);
    }
  });
  MenuRegistry.appendMenuItem(MenuId.PanelAlignmentMenu, {
    command: {
      id,
      title: shortLabel,
      toggled: when.negate()
    },
    order: 5
  });
});
registerAction2(class extends SwitchCompositeViewAction {
  constructor() {
    super({
      id: "workbench.action.previousPanelView",
      title: localize2("previousPanelView", "Previous Panel View"),
      category: Categories.View,
      f1: true
    }, ViewContainerLocation.Panel, -1);
  }
});
registerAction2(class extends SwitchCompositeViewAction {
  constructor() {
    super({
      id: "workbench.action.nextPanelView",
      title: localize2("nextPanelView", "Next Panel View"),
      category: Categories.View,
      f1: true
    }, ViewContainerLocation.Panel, 1);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.toggleMaximizedPanel",
      title: localize2("toggleMaximizedPanel", "Toggle Maximized Panel"),
      tooltip: localize("maximizePanel", "Maximize Panel Size"),
      category: Categories.View,
      f1: true,
      icon: maximizeIcon,
      // This is being rotated in CSS depending on the panel position
      // the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
      precondition: ContextKeyExpr.or(PanelAlignmentContext.isEqualTo("center"), ContextKeyExpr.and(PanelPositionContext.notEqualsTo("bottom"), PanelPositionContext.notEqualsTo("top"))),
      toggled: { condition: PanelMaximizedContext, icon: restoreIcon, tooltip: localize("minimizePanel", "Restore Panel Size") },
      menu: [{
        id: MenuId.PanelTitle,
        group: "navigation",
        order: 1,
        // the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
        when: ContextKeyExpr.or(PanelAlignmentContext.isEqualTo("center"), ContextKeyExpr.and(PanelPositionContext.notEqualsTo("bottom"), PanelPositionContext.notEqualsTo("top")))
      }]
    });
  }
  run(accessor) {
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const notificationService = accessor.get(INotificationService);
    if (layoutService.getPanelAlignment() !== "center" && isHorizontal(layoutService.getPanelPosition())) {
      notificationService.warn(localize("panelMaxNotSupported", "Maximizing the panel is only supported when it is center aligned."));
      return;
    }
    if (!layoutService.isVisible(Parts.PANEL_PART)) {
      layoutService.setPartHidden(false, Parts.PANEL_PART);
      if (!layoutService.isPanelMaximized()) {
        layoutService.toggleMaximizedPanel();
      }
    } else {
      layoutService.toggleMaximizedPanel();
    }
  }
});
MenuRegistry.appendMenuItems([
  {
    id: MenuId.LayoutControlMenu,
    item: {
      group: "2_pane_toggles",
      command: {
        id: TogglePanelAction.ID,
        title: localize("togglePanel", "Toggle Panel"),
        icon: panelOffIcon,
        toggled: { condition: PanelVisibleContext, icon: panelIcon }
      },
      when: ContextKeyExpr.or(ContextKeyExpr.equals("config.workbench.layoutControl.type", "toggles"), ContextKeyExpr.equals("config.workbench.layoutControl.type", "both")),
      order: 1
    }
  }
]);
class MoveViewsBetweenPanelsAction extends Action2 {
  constructor(source, destination, desc) {
    super(desc);
    this.source = source;
    this.destination = destination;
  }
  run(accessor, ...args) {
    const viewDescriptorService = accessor.get(IViewDescriptorService);
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const viewsService = accessor.get(IViewsService);
    const srcContainers = viewDescriptorService.getViewContainersByLocation(this.source);
    const destContainers = viewDescriptorService.getViewContainersByLocation(this.destination);
    if (srcContainers.length) {
      const activeViewContainer = viewsService.getVisibleViewContainer(this.source);
      srcContainers.forEach((viewContainer) => viewDescriptorService.moveViewContainerToLocation(viewContainer, this.destination, void 0, this.desc.id));
      layoutService.setPartHidden(false, this.destination === ViewContainerLocation.Panel ? Parts.PANEL_PART : Parts.AUXILIARYBAR_PART);
      if (activeViewContainer && destContainers.length === 0) {
        viewsService.openViewContainer(activeViewContainer.id, true);
      }
    }
  }
}
const _MovePanelToSidePanelAction = class _MovePanelToSidePanelAction extends MoveViewsBetweenPanelsAction {
  constructor() {
    super(ViewContainerLocation.Panel, ViewContainerLocation.AuxiliaryBar, {
      id: _MovePanelToSidePanelAction.ID,
      title: localize2("movePanelToSecondarySideBar", "Move Panel Views To Void Side Bar"),
      category: Categories.View,
      f1: false
    });
  }
};
_MovePanelToSidePanelAction.ID = "workbench.action.movePanelToSidePanel";
let MovePanelToSidePanelAction = _MovePanelToSidePanelAction;
const _MovePanelToSecondarySideBarAction = class _MovePanelToSecondarySideBarAction extends MoveViewsBetweenPanelsAction {
  constructor() {
    super(ViewContainerLocation.Panel, ViewContainerLocation.AuxiliaryBar, {
      id: _MovePanelToSecondarySideBarAction.ID,
      title: localize2("movePanelToSecondarySideBar", "Move Panel Views To Void Side Bar"),
      category: Categories.View,
      f1: true
    });
  }
};
_MovePanelToSecondarySideBarAction.ID = "workbench.action.movePanelToSecondarySideBar";
let MovePanelToSecondarySideBarAction = _MovePanelToSecondarySideBarAction;
registerAction2(MovePanelToSidePanelAction);
registerAction2(MovePanelToSecondarySideBarAction);
const _MoveSidePanelToPanelAction = class _MoveSidePanelToPanelAction extends MoveViewsBetweenPanelsAction {
  constructor() {
    super(ViewContainerLocation.AuxiliaryBar, ViewContainerLocation.Panel, {
      id: _MoveSidePanelToPanelAction.ID,
      title: localize2("moveSidePanelToPanel", "Move Void Side Bar Views To Panel"),
      category: Categories.View,
      f1: false
    });
  }
};
_MoveSidePanelToPanelAction.ID = "workbench.action.moveSidePanelToPanel";
let MoveSidePanelToPanelAction = _MoveSidePanelToPanelAction;
const _MoveSecondarySideBarToPanelAction = class _MoveSecondarySideBarToPanelAction extends MoveViewsBetweenPanelsAction {
  constructor() {
    super(ViewContainerLocation.AuxiliaryBar, ViewContainerLocation.Panel, {
      id: _MoveSecondarySideBarToPanelAction.ID,
      title: localize2("moveSidePanelToPanel", "Move Void Side Bar Views To Panel"),
      category: Categories.View,
      f1: true
    });
  }
};
_MoveSecondarySideBarToPanelAction.ID = "workbench.action.moveSecondarySideBarToPanel";
let MoveSecondarySideBarToPanelAction = _MoveSecondarySideBarToPanelAction;
registerAction2(MoveSidePanelToPanelAction);
registerAction2(MoveSecondarySideBarToPanelAction);
export {
  MovePanelToSecondarySideBarAction,
  MoveSecondarySideBarToPanelAction,
  TogglePanelAction,
  closeIcon
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9wYW5lbC9wYW5lbEFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvcGFuZWxwYXJ0LmNzcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEtleU1vZCwgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgTWVudVJlZ2lzdHJ5LCByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIsIElBY3Rpb24yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBpc0hvcml6b250YWwsIElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCBQYW5lbEFsaWdubWVudCwgUGFydHMsIFBvc2l0aW9uLCBwb3NpdGlvblRvU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBQYW5lbEFsaWdubWVudENvbnRleHQsIFBhbmVsTWF4aW1pemVkQ29udGV4dCwgUGFuZWxQb3NpdGlvbkNvbnRleHQsIFBhbmVsVmlzaWJsZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIENvbnRleHRLZXlFeHByZXNzaW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGFpbmVyTG9jYXRpb24sIElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhbmVjb21wb3NpdGUvYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRBY3Rpb25UaXRsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFN3aXRjaENvbXBvc2l0ZVZpZXdBY3Rpb24gfSBmcm9tICcuLi9jb21wb3NpdGVCYXJBY3Rpb25zLmpzJztcblxuY29uc3QgbWF4aW1pemVJY29uID0gcmVnaXN0ZXJJY29uKCdwYW5lbC1tYXhpbWl6ZScsIENvZGljb24uY2hldnJvblVwLCBsb2NhbGl6ZSgnbWF4aW1pemVJY29uJywgJ0ljb24gdG8gbWF4aW1pemUgYSBwYW5lbC4nKSk7XG5jb25zdCByZXN0b3JlSWNvbiA9IHJlZ2lzdGVySWNvbigncGFuZWwtcmVzdG9yZScsIENvZGljb24uY2hldnJvbkRvd24sIGxvY2FsaXplKCdyZXN0b3JlSWNvbicsICdJY29uIHRvIHJlc3RvcmUgYSBwYW5lbC4nKSk7XG5leHBvcnQgY29uc3QgY2xvc2VJY29uID0gcmVnaXN0ZXJJY29uKCdwYW5lbC1jbG9zZScsIENvZGljb24uY2xvc2UsIGxvY2FsaXplKCdjbG9zZUljb24nLCAnSWNvbiB0byBjbG9zZSBhIHBhbmVsLicpKTtcbmNvbnN0IHBhbmVsSWNvbiA9IHJlZ2lzdGVySWNvbigncGFuZWwtbGF5b3V0LWljb24nLCBDb2RpY29uLmxheW91dFBhbmVsLCBsb2NhbGl6ZSgndG9nZ2xlUGFuZWxPZmZJY29uJywgJ0ljb24gdG8gdG9nZ2xlIHRoZSBwYW5lbCBvZmYgd2hlbiBpdCBpcyBvbi4nKSk7XG5jb25zdCBwYW5lbE9mZkljb24gPSByZWdpc3Rlckljb24oJ3BhbmVsLWxheW91dC1pY29uLW9mZicsIENvZGljb24ubGF5b3V0UGFuZWxPZmYsIGxvY2FsaXplKCd0b2dnbGVQYW5lbE9uSWNvbicsICdJY29uIHRvIHRvZ2dsZSB0aGUgcGFuZWwgb24gd2hlbiBpdCBpcyBvZmYuJykpO1xuXG5leHBvcnQgY2xhc3MgVG9nZ2xlUGFuZWxBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVQYW5lbCc7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplMigndG9nZ2xlUGFuZWxWaXNpYmlsaXR5JywgXCJUb2dnbGUgUGFuZWwgVmlzaWJpbGl0eVwiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVG9nZ2xlUGFuZWxBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogVG9nZ2xlUGFuZWxBY3Rpb24uTEFCRUwsXG5cdFx0XHR0b2dnbGVkOiB7XG5cdFx0XHRcdGNvbmRpdGlvbjogUGFuZWxWaXNpYmxlQ29udGV4dCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjbG9zZVBhbmVsJywgJ0hpZGUgUGFuZWwnKSxcblx0XHRcdFx0aWNvbjogY2xvc2VJY29uLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ3RvZ2dsZSBwYW5lbCBtbmVtb25pYycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlBhbmVsXCIpLFxuXHRcdFx0fSxcblx0XHRcdGljb246IGNsb3NlSWNvbiwgLy8gRW5zdXJlcyBubyBmbGlja2VyaW5nIHdoZW4gdXNpbmcgdG9nZ2xlZC5pY29uXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ29wZW5BbmRDbG9zZVBhbmVsJywgJ09wZW4vU2hvdyBhbmQgQ2xvc2UvSGlkZSBQYW5lbCcpLFxuXHRcdFx0fSxcblx0XHRcdGtleWJpbmRpbmc6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUosIHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliIH0sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJBcHBlYXJhbmNlTWVudSxcblx0XHRcdFx0XHRncm91cDogJzJfd29ya2JlbmNoX2xheW91dCcsXG5cdFx0XHRcdFx0b3JkZXI6IDVcblx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTGF5b3V0Q29udHJvbE1lbnVTdWJtZW51LFxuXHRcdFx0XHRcdGdyb3VwOiAnMF93b3JrYmVuY2hfbGF5b3V0Jyxcblx0XHRcdFx0XHRvcmRlcjogNFxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5QYW5lbFRpdGxlLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbGF5b3V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSk7XG5cdFx0bGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKGxheW91dFNlcnZpY2UuaXNWaXNpYmxlKFBhcnRzLlBBTkVMX1BBUlQpLCBQYXJ0cy5QQU5FTF9QQVJUKTtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoVG9nZ2xlUGFuZWxBY3Rpb24pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNsb3NlUGFuZWwnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2xvc2VQYW5lbCcsICdIaWRlIFBhbmVsJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBQYW5lbFZpc2libGVDb250ZXh0LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0YWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKS5zZXRQYXJ0SGlkZGVuKHRydWUsIFBhcnRzLlBBTkVMX1BBUlQpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZm9jdXNQYW5lbCc7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCdmb2N1c1BhbmVsJywgXCJGb2N1cyBpbnRvIFBhbmVsXCIpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c1BhbmVsJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ZvY3VzUGFuZWwnLCBcIkZvY3VzIGludG8gUGFuZWxcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBwYW5lQ29tcG9zaXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlKTtcblxuXHRcdC8vIFNob3cgcGFuZWxcblx0XHRpZiAoIWxheW91dFNlcnZpY2UuaXNWaXNpYmxlKFBhcnRzLlBBTkVMX1BBUlQpKSB7XG5cdFx0XHRsYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4oZmFsc2UsIFBhcnRzLlBBTkVMX1BBUlQpO1xuXHRcdH1cblxuXHRcdC8vIEZvY3VzIGludG8gYWN0aXZlIHBhbmVsXG5cdFx0Y29uc3QgcGFuZWwgPSBwYW5lQ29tcG9zaXRlU2VydmljZS5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk7XG5cdFx0cGFuZWw/LmZvY3VzKCk7XG5cdH1cbn0pO1xuXG5jb25zdCBQb3NpdGlvblBhbmVsQWN0aW9uSWQgPSB7XG5cdExFRlQ6ICd3b3JrYmVuY2guYWN0aW9uLnBvc2l0aW9uUGFuZWxMZWZ0Jyxcblx0UklHSFQ6ICd3b3JrYmVuY2guYWN0aW9uLnBvc2l0aW9uUGFuZWxSaWdodCcsXG5cdEJPVFRPTTogJ3dvcmtiZW5jaC5hY3Rpb24ucG9zaXRpb25QYW5lbEJvdHRvbScsXG5cdFRPUDogJ3dvcmtiZW5jaC5hY3Rpb24ucG9zaXRpb25QYW5lbFRvcCdcbn07XG5cbmNvbnN0IEFsaWduUGFuZWxBY3Rpb25JZCA9IHtcblx0TEVGVDogJ3dvcmtiZW5jaC5hY3Rpb24uYWxpZ25QYW5lbExlZnQnLFxuXHRSSUdIVDogJ3dvcmtiZW5jaC5hY3Rpb24uYWxpZ25QYW5lbFJpZ2h0Jyxcblx0Q0VOVEVSOiAnd29ya2JlbmNoLmFjdGlvbi5hbGlnblBhbmVsQ2VudGVyJyxcblx0SlVTVElGWTogJ3dvcmtiZW5jaC5hY3Rpb24uYWxpZ25QYW5lbEp1c3RpZnknLFxufTtcblxuaW50ZXJmYWNlIFBhbmVsQWN0aW9uQ29uZmlnPFQ+IHtcblx0aWQ6IHN0cmluZztcblx0d2hlbjogQ29udGV4dEtleUV4cHJlc3Npb247XG5cdHRpdGxlOiBJQ29tbWFuZEFjdGlvblRpdGxlO1xuXHRzaG9ydExhYmVsOiBzdHJpbmc7XG5cdHZhbHVlOiBUO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQYW5lbEFjdGlvbkNvbmZpZzxUPihpZDogc3RyaW5nLCB0aXRsZTogSUNvbW1hbmRBY3Rpb25UaXRsZSwgc2hvcnRMYWJlbDogc3RyaW5nLCB2YWx1ZTogVCwgd2hlbjogQ29udGV4dEtleUV4cHJlc3Npb24pOiBQYW5lbEFjdGlvbkNvbmZpZzxUPiB7XG5cdHJldHVybiB7XG5cdFx0aWQsXG5cdFx0dGl0bGUsXG5cdFx0c2hvcnRMYWJlbCxcblx0XHR2YWx1ZSxcblx0XHR3aGVuLFxuXHR9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQb3NpdGlvblBhbmVsQWN0aW9uQ29uZmlnKGlkOiBzdHJpbmcsIHRpdGxlOiBJQ29tbWFuZEFjdGlvblRpdGxlLCBzaG9ydExhYmVsOiBzdHJpbmcsIHBvc2l0aW9uOiBQb3NpdGlvbik6IFBhbmVsQWN0aW9uQ29uZmlnPFBvc2l0aW9uPiB7XG5cdHJldHVybiBjcmVhdGVQYW5lbEFjdGlvbkNvbmZpZzxQb3NpdGlvbj4oaWQsIHRpdGxlLCBzaG9ydExhYmVsLCBwb3NpdGlvbiwgUGFuZWxQb3NpdGlvbkNvbnRleHQubm90RXF1YWxzVG8ocG9zaXRpb25Ub1N0cmluZyhwb3NpdGlvbikpKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQWxpZ25tZW50UGFuZWxBY3Rpb25Db25maWcoaWQ6IHN0cmluZywgdGl0bGU6IElDb21tYW5kQWN0aW9uVGl0bGUsIHNob3J0TGFiZWw6IHN0cmluZywgYWxpZ25tZW50OiBQYW5lbEFsaWdubWVudCk6IFBhbmVsQWN0aW9uQ29uZmlnPFBhbmVsQWxpZ25tZW50PiB7XG5cdHJldHVybiBjcmVhdGVQYW5lbEFjdGlvbkNvbmZpZzxQYW5lbEFsaWdubWVudD4oaWQsIHRpdGxlLCBzaG9ydExhYmVsLCBhbGlnbm1lbnQsIFBhbmVsQWxpZ25tZW50Q29udGV4dC5ub3RFcXVhbHNUbyhhbGlnbm1lbnQpKTtcbn1cblxuXG5jb25zdCBQb3NpdGlvblBhbmVsQWN0aW9uQ29uZmlnczogUGFuZWxBY3Rpb25Db25maWc8UG9zaXRpb24+W10gPSBbXG5cdGNyZWF0ZVBvc2l0aW9uUGFuZWxBY3Rpb25Db25maWcoUG9zaXRpb25QYW5lbEFjdGlvbklkLlRPUCwgbG9jYWxpemUyKCdwb3NpdGlvblBhbmVsVG9wJywgXCJNb3ZlIFBhbmVsIFRvIFRvcFwiKSwgbG9jYWxpemUoJ3Bvc2l0aW9uUGFuZWxUb3BTaG9ydCcsIFwiVG9wXCIpLCBQb3NpdGlvbi5UT1ApLFxuXHRjcmVhdGVQb3NpdGlvblBhbmVsQWN0aW9uQ29uZmlnKFBvc2l0aW9uUGFuZWxBY3Rpb25JZC5MRUZULCBsb2NhbGl6ZTIoJ3Bvc2l0aW9uUGFuZWxMZWZ0JywgXCJNb3ZlIFBhbmVsIExlZnRcIiksIGxvY2FsaXplKCdwb3NpdGlvblBhbmVsTGVmdFNob3J0JywgXCJMZWZ0XCIpLCBQb3NpdGlvbi5MRUZUKSxcblx0Y3JlYXRlUG9zaXRpb25QYW5lbEFjdGlvbkNvbmZpZyhQb3NpdGlvblBhbmVsQWN0aW9uSWQuUklHSFQsIGxvY2FsaXplMigncG9zaXRpb25QYW5lbFJpZ2h0JywgXCJNb3ZlIFBhbmVsIFJpZ2h0XCIpLCBsb2NhbGl6ZSgncG9zaXRpb25QYW5lbFJpZ2h0U2hvcnQnLCBcIlJpZ2h0XCIpLCBQb3NpdGlvbi5SSUdIVCksXG5cdGNyZWF0ZVBvc2l0aW9uUGFuZWxBY3Rpb25Db25maWcoUG9zaXRpb25QYW5lbEFjdGlvbklkLkJPVFRPTSwgbG9jYWxpemUyKCdwb3NpdGlvblBhbmVsQm90dG9tJywgXCJNb3ZlIFBhbmVsIFRvIEJvdHRvbVwiKSwgbG9jYWxpemUoJ3Bvc2l0aW9uUGFuZWxCb3R0b21TaG9ydCcsIFwiQm90dG9tXCIpLCBQb3NpdGlvbi5CT1RUT00pLFxuXTtcblxuXG5jb25zdCBBbGlnblBhbmVsQWN0aW9uQ29uZmlnczogUGFuZWxBY3Rpb25Db25maWc8UGFuZWxBbGlnbm1lbnQ+W10gPSBbXG5cdGNyZWF0ZUFsaWdubWVudFBhbmVsQWN0aW9uQ29uZmlnKEFsaWduUGFuZWxBY3Rpb25JZC5MRUZULCBsb2NhbGl6ZTIoJ2FsaWduUGFuZWxMZWZ0JywgXCJTZXQgUGFuZWwgQWxpZ25tZW50IHRvIExlZnRcIiksIGxvY2FsaXplKCdhbGlnblBhbmVsTGVmdFNob3J0JywgXCJMZWZ0XCIpLCAnbGVmdCcpLFxuXHRjcmVhdGVBbGlnbm1lbnRQYW5lbEFjdGlvbkNvbmZpZyhBbGlnblBhbmVsQWN0aW9uSWQuUklHSFQsIGxvY2FsaXplMignYWxpZ25QYW5lbFJpZ2h0JywgXCJTZXQgUGFuZWwgQWxpZ25tZW50IHRvIFJpZ2h0XCIpLCBsb2NhbGl6ZSgnYWxpZ25QYW5lbFJpZ2h0U2hvcnQnLCBcIlJpZ2h0XCIpLCAncmlnaHQnKSxcblx0Y3JlYXRlQWxpZ25tZW50UGFuZWxBY3Rpb25Db25maWcoQWxpZ25QYW5lbEFjdGlvbklkLkNFTlRFUiwgbG9jYWxpemUyKCdhbGlnblBhbmVsQ2VudGVyJywgXCJTZXQgUGFuZWwgQWxpZ25tZW50IHRvIENlbnRlclwiKSwgbG9jYWxpemUoJ2FsaWduUGFuZWxDZW50ZXJTaG9ydCcsIFwiQ2VudGVyXCIpLCAnY2VudGVyJyksXG5cdGNyZWF0ZUFsaWdubWVudFBhbmVsQWN0aW9uQ29uZmlnKEFsaWduUGFuZWxBY3Rpb25JZC5KVVNUSUZZLCBsb2NhbGl6ZTIoJ2FsaWduUGFuZWxKdXN0aWZ5JywgXCJTZXQgUGFuZWwgQWxpZ25tZW50IHRvIEp1c3RpZnlcIiksIGxvY2FsaXplKCdhbGlnblBhbmVsSnVzdGlmeVNob3J0JywgXCJKdXN0aWZ5XCIpLCAnanVzdGlmeScpLFxuXTtcblxuXG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckFwcGVhcmFuY2VNZW51LCB7XG5cdHN1Ym1lbnU6IE1lbnVJZC5QYW5lbFBvc2l0aW9uTWVudSxcblx0dGl0bGU6IGxvY2FsaXplKCdwb3NpdGlvblBhbmVsJywgXCJQYW5lbCBQb3NpdGlvblwiKSxcblx0Z3JvdXA6ICczX3dvcmtiZW5jaF9sYXlvdXRfbW92ZScsXG5cdG9yZGVyOiA0XG59KTtcblxuUG9zaXRpb25QYW5lbEFjdGlvbkNvbmZpZ3MuZm9yRWFjaCgocG9zaXRpb25QYW5lbEFjdGlvbiwgaW5kZXgpID0+IHtcblx0Y29uc3QgeyBpZCwgdGl0bGUsIHNob3J0TGFiZWwsIHZhbHVlLCB3aGVuIH0gPSBwb3NpdGlvblBhbmVsQWN0aW9uO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZCxcblx0XHRcdFx0dGl0bGUsXG5cdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRcdGYxOiB0cnVlXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKTtcblx0XHRcdGxheW91dFNlcnZpY2Uuc2V0UGFuZWxQb3NpdGlvbih2YWx1ZSA9PT0gdW5kZWZpbmVkID8gUG9zaXRpb24uQk9UVE9NIDogdmFsdWUpO1xuXHRcdH1cblx0fSk7XG5cblx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5QYW5lbFBvc2l0aW9uTWVudSwge1xuXHRcdGNvbW1hbmQ6IHtcblx0XHRcdGlkLFxuXHRcdFx0dGl0bGU6IHNob3J0TGFiZWwsXG5cdFx0XHR0b2dnbGVkOiB3aGVuLm5lZ2F0ZSgpXG5cdFx0fSxcblx0XHRvcmRlcjogNSArIGluZGV4XG5cdH0pO1xufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckFwcGVhcmFuY2VNZW51LCB7XG5cdHN1Ym1lbnU6IE1lbnVJZC5QYW5lbEFsaWdubWVudE1lbnUsXG5cdHRpdGxlOiBsb2NhbGl6ZSgnYWxpZ25QYW5lbCcsIFwiQWxpZ24gUGFuZWxcIiksXG5cdGdyb3VwOiAnM193b3JrYmVuY2hfbGF5b3V0X21vdmUnLFxuXHRvcmRlcjogNVxufSk7XG5cbkFsaWduUGFuZWxBY3Rpb25Db25maWdzLmZvckVhY2goYWxpZ25QYW5lbEFjdGlvbiA9PiB7XG5cdGNvbnN0IHsgaWQsIHRpdGxlLCBzaG9ydExhYmVsLCB2YWx1ZSwgd2hlbiB9ID0gYWxpZ25QYW5lbEFjdGlvbjtcblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkLFxuXHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdFx0dG9nZ2xlZDogd2hlbi5uZWdhdGUoKSxcblx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGxheW91dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaExheW91dFNlcnZpY2UpO1xuXHRcdFx0bGF5b3V0U2VydmljZS5zZXRQYW5lbEFsaWdubWVudCh2YWx1ZSA9PT0gdW5kZWZpbmVkID8gJ2NlbnRlcicgOiB2YWx1ZSk7XG5cdFx0fVxuXHR9KTtcblxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlBhbmVsQWxpZ25tZW50TWVudSwge1xuXHRcdGNvbW1hbmQ6IHtcblx0XHRcdGlkLFxuXHRcdFx0dGl0bGU6IHNob3J0TGFiZWwsXG5cdFx0XHR0b2dnbGVkOiB3aGVuLm5lZ2F0ZSgpXG5cdFx0fSxcblx0XHRvcmRlcjogNVxuXHR9KTtcbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBTd2l0Y2hDb21wb3NpdGVWaWV3QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnByZXZpb3VzUGFuZWxWaWV3Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3ByZXZpb3VzUGFuZWxWaWV3JywgXCJQcmV2aW91cyBQYW5lbCBWaWV3XCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsLCAtMSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBTd2l0Y2hDb21wb3NpdGVWaWV3QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm5leHRQYW5lbFZpZXcnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbmV4dFBhbmVsVmlldycsIFwiTmV4dCBQYW5lbCBWaWV3XCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsLCAxKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udG9nZ2xlTWF4aW1pemVkUGFuZWwnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlTWF4aW1pemVkUGFuZWwnLCAnVG9nZ2xlIE1heGltaXplZCBQYW5lbCcpLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ21heGltaXplUGFuZWwnLCBcIk1heGltaXplIFBhbmVsIFNpemVcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRpY29uOiBtYXhpbWl6ZUljb24sIC8vIFRoaXMgaXMgYmVpbmcgcm90YXRlZCBpbiBDU1MgZGVwZW5kaW5nIG9uIHRoZSBwYW5lbCBwb3NpdGlvblxuXHRcdFx0Ly8gdGhlIHdvcmtiZW5jaCBncmlkIGN1cnJlbnRseSBwcmV2ZW50cyB1cyBmcm9tIHN1cHBvcnRpbmcgcGFuZWwgbWF4aW1pemF0aW9uIHdpdGggbm9uLWNlbnRlciBwYW5lbCBhbGlnbm1lbnRcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoUGFuZWxBbGlnbm1lbnRDb250ZXh0LmlzRXF1YWxUbygnY2VudGVyJyksIENvbnRleHRLZXlFeHByLmFuZChQYW5lbFBvc2l0aW9uQ29udGV4dC5ub3RFcXVhbHNUbygnYm90dG9tJyksIFBhbmVsUG9zaXRpb25Db250ZXh0Lm5vdEVxdWFsc1RvKCd0b3AnKSkpLFxuXHRcdFx0dG9nZ2xlZDogeyBjb25kaXRpb246IFBhbmVsTWF4aW1pemVkQ29udGV4dCwgaWNvbjogcmVzdG9yZUljb24sIHRvb2x0aXA6IGxvY2FsaXplKCdtaW5pbWl6ZVBhbmVsJywgXCJSZXN0b3JlIFBhbmVsIFNpemVcIikgfSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuUGFuZWxUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdC8vIHRoZSB3b3JrYmVuY2ggZ3JpZCBjdXJyZW50bHkgcHJldmVudHMgdXMgZnJvbSBzdXBwb3J0aW5nIHBhbmVsIG1heGltaXphdGlvbiB3aXRoIG5vbi1jZW50ZXIgcGFuZWwgYWxpZ25tZW50XG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm9yKFBhbmVsQWxpZ25tZW50Q29udGV4dC5pc0VxdWFsVG8oJ2NlbnRlcicpLCBDb250ZXh0S2V5RXhwci5hbmQoUGFuZWxQb3NpdGlvbkNvbnRleHQubm90RXF1YWxzVG8oJ2JvdHRvbScpLCBQYW5lbFBvc2l0aW9uQ29udGV4dC5ub3RFcXVhbHNUbygndG9wJykpKVxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKTtcblx0XHRpZiAobGF5b3V0U2VydmljZS5nZXRQYW5lbEFsaWdubWVudCgpICE9PSAnY2VudGVyJyAmJiBpc0hvcml6b250YWwobGF5b3V0U2VydmljZS5nZXRQYW5lbFBvc2l0aW9uKCkpKSB7XG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLndhcm4obG9jYWxpemUoJ3BhbmVsTWF4Tm90U3VwcG9ydGVkJywgXCJNYXhpbWl6aW5nIHRoZSBwYW5lbCBpcyBvbmx5IHN1cHBvcnRlZCB3aGVuIGl0IGlzIGNlbnRlciBhbGlnbmVkLlwiKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCFsYXlvdXRTZXJ2aWNlLmlzVmlzaWJsZShQYXJ0cy5QQU5FTF9QQVJUKSkge1xuXHRcdFx0bGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKGZhbHNlLCBQYXJ0cy5QQU5FTF9QQVJUKTtcblx0XHRcdC8vIElmIHRoZSBwYW5lbCBpcyBub3QgYWxyZWFkeSBtYXhpbWl6ZWQsIG1heGltaXplIGl0XG5cdFx0XHRpZiAoIWxheW91dFNlcnZpY2UuaXNQYW5lbE1heGltaXplZCgpKSB7XG5cdFx0XHRcdGxheW91dFNlcnZpY2UudG9nZ2xlTWF4aW1pemVkUGFuZWwoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRsYXlvdXRTZXJ2aWNlLnRvZ2dsZU1heGltaXplZFBhbmVsKCk7XG5cdFx0fVxuXHR9XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtcyhbXG5cdHtcblx0XHRpZDogTWVudUlkLkxheW91dENvbnRyb2xNZW51LFxuXHRcdGl0ZW06IHtcblx0XHRcdGdyb3VwOiAnMl9wYW5lX3RvZ2dsZXMnLFxuXHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRpZDogVG9nZ2xlUGFuZWxBY3Rpb24uSUQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgndG9nZ2xlUGFuZWwnLCBcIlRvZ2dsZSBQYW5lbFwiKSxcblx0XHRcdFx0aWNvbjogcGFuZWxPZmZJY29uLFxuXHRcdFx0XHR0b2dnbGVkOiB7IGNvbmRpdGlvbjogUGFuZWxWaXNpYmxlQ29udGV4dCwgaWNvbjogcGFuZWxJY29uIH1cblx0XHRcdH0sXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy53b3JrYmVuY2gubGF5b3V0Q29udHJvbC50eXBlJywgJ3RvZ2dsZXMnKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcud29ya2JlbmNoLmxheW91dENvbnRyb2wudHlwZScsICdib3RoJykpLFxuXHRcdFx0b3JkZXI6IDFcblx0XHR9XG5cdH1cbl0pO1xuXG5jbGFzcyBNb3ZlVmlld3NCZXR3ZWVuUGFuZWxzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgc291cmNlOiBWaWV3Q29udGFpbmVyTG9jYXRpb24sIHByaXZhdGUgcmVhZG9ubHkgZGVzdGluYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiwgZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPikge1xuXHRcdHN1cGVyKGRlc2MpO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cblx0XHRjb25zdCBzcmNDb250YWluZXJzID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJzQnlMb2NhdGlvbih0aGlzLnNvdXJjZSk7XG5cdFx0Y29uc3QgZGVzdENvbnRhaW5lcnMgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lcnNCeUxvY2F0aW9uKHRoaXMuZGVzdGluYXRpb24pO1xuXG5cdFx0aWYgKHNyY0NvbnRhaW5lcnMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBhY3RpdmVWaWV3Q29udGFpbmVyID0gdmlld3NTZXJ2aWNlLmdldFZpc2libGVWaWV3Q29udGFpbmVyKHRoaXMuc291cmNlKTtcblxuXHRcdFx0c3JjQ29udGFpbmVycy5mb3JFYWNoKHZpZXdDb250YWluZXIgPT4gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3Q29udGFpbmVyVG9Mb2NhdGlvbih2aWV3Q29udGFpbmVyLCB0aGlzLmRlc3RpbmF0aW9uLCB1bmRlZmluZWQsIHRoaXMuZGVzYy5pZCkpO1xuXHRcdFx0bGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKGZhbHNlLCB0aGlzLmRlc3RpbmF0aW9uID09PSBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwgPyBQYXJ0cy5QQU5FTF9QQVJUIDogUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQpO1xuXG5cdFx0XHRpZiAoYWN0aXZlVmlld0NvbnRhaW5lciAmJiBkZXN0Q29udGFpbmVycy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0dmlld3NTZXJ2aWNlLm9wZW5WaWV3Q29udGFpbmVyKGFjdGl2ZVZpZXdDb250YWluZXIuaWQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG4vLyAtLS0gTW92ZSBQYW5lbCBWaWV3cyBUbyBWb2lkIFNpZGUgQmFyXG5cbmNsYXNzIE1vdmVQYW5lbFRvU2lkZVBhbmVsQWN0aW9uIGV4dGVuZHMgTW92ZVZpZXdzQmV0d2VlblBhbmVsc0FjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVQYW5lbFRvU2lkZVBhbmVsJztcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyLCB7XG5cdFx0XHRpZDogTW92ZVBhbmVsVG9TaWRlUGFuZWxBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtb3ZlUGFuZWxUb1NlY29uZGFyeVNpZGVCYXInLCBcIk1vdmUgUGFuZWwgVmlld3MgVG8gVm9pZCBTaWRlIEJhclwiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRmMTogZmFsc2Vcblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTW92ZVBhbmVsVG9TZWNvbmRhcnlTaWRlQmFyQWN0aW9uIGV4dGVuZHMgTW92ZVZpZXdzQmV0d2VlblBhbmVsc0FjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVQYW5lbFRvU2Vjb25kYXJ5U2lkZUJhcic7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCwgVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhciwge1xuXHRcdFx0aWQ6IE1vdmVQYW5lbFRvU2Vjb25kYXJ5U2lkZUJhckFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVQYW5lbFRvU2Vjb25kYXJ5U2lkZUJhcicsIFwiTW92ZSBQYW5lbCBWaWV3cyBUbyBWb2lkIFNpZGUgQmFyXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuVmlldyxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKE1vdmVQYW5lbFRvU2lkZVBhbmVsQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihNb3ZlUGFuZWxUb1NlY29uZGFyeVNpZGVCYXJBY3Rpb24pO1xuXG4vLyAtLS0gTW92ZSBWb2lkIFNpZGUgQmFyIFZpZXdzIFRvIFBhbmVsXG5cbmNsYXNzIE1vdmVTaWRlUGFuZWxUb1BhbmVsQWN0aW9uIGV4dGVuZHMgTW92ZVZpZXdzQmV0d2VlblBhbmVsc0FjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLm1vdmVTaWRlUGFuZWxUb1BhbmVsJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsIHtcblx0XHRcdGlkOiBNb3ZlU2lkZVBhbmVsVG9QYW5lbEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVTaWRlUGFuZWxUb1BhbmVsJywgXCJNb3ZlIFZvaWQgU2lkZSBCYXIgVmlld3MgVG8gUGFuZWxcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IGZhbHNlXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vdmVTZWNvbmRhcnlTaWRlQmFyVG9QYW5lbEFjdGlvbiBleHRlbmRzIE1vdmVWaWV3c0JldHdlZW5QYW5lbHNBY3Rpb24ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5tb3ZlU2Vjb25kYXJ5U2lkZUJhclRvUGFuZWwnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIsIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCwge1xuXHRcdFx0aWQ6IE1vdmVTZWNvbmRhcnlTaWRlQmFyVG9QYW5lbEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21vdmVTaWRlUGFuZWxUb1BhbmVsJywgXCJNb3ZlIFZvaWQgU2lkZSBCYXIgVmlld3MgVG8gUGFuZWxcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxufVxucmVnaXN0ZXJBY3Rpb24yKE1vdmVTaWRlUGFuZWxUb1BhbmVsQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihNb3ZlU2Vjb25kYXJ5U2lkZUJhclRvUGFuZWxBY3Rpb24pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUE7QUFLQSxPQUFPO0FBQ1AsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLFFBQVEsZUFBZTtBQUNoQyxTQUFTLFFBQVEsY0FBYyxpQkFBaUIsZUFBZ0M7QUFDaEYsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxjQUFjLHlCQUF5QyxPQUFPLFVBQVUsd0JBQXdCO0FBQ3pHLFNBQVMsdUJBQXVCLHVCQUF1QixzQkFBc0IsMkJBQTJCO0FBQ3hHLFNBQVMsc0JBQTRDO0FBQ3JELFNBQVMsZUFBZTtBQUN4QixTQUFTLG9CQUFvQjtBQUU3QixTQUFTLHVCQUF1Qiw4QkFBOEI7QUFDOUQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyw0QkFBNEI7QUFFckMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxpQ0FBaUM7QUFFMUMsTUFBTSxlQUFlLGFBQWEsa0JBQWtCLFFBQVEsV0FBVyxTQUFTLGdCQUFnQiwyQkFBMkIsQ0FBQztBQUM1SCxNQUFNLGNBQWMsYUFBYSxpQkFBaUIsUUFBUSxhQUFhLFNBQVMsZUFBZSwwQkFBMEIsQ0FBQztBQUNuSCxNQUFNLFlBQVksYUFBYSxlQUFlLFFBQVEsT0FBTyxTQUFTLGFBQWEsd0JBQXdCLENBQUM7QUFDbkgsTUFBTSxZQUFZLGFBQWEscUJBQXFCLFFBQVEsYUFBYSxTQUFTLHNCQUFzQiw2Q0FBNkMsQ0FBQztBQUN0SixNQUFNLGVBQWUsYUFBYSx5QkFBeUIsUUFBUSxnQkFBZ0IsU0FBUyxxQkFBcUIsNkNBQTZDLENBQUM7QUFFeEosTUFBTSxxQkFBTixNQUFNLDJCQUEwQixRQUFRO0FBQUEsRUFLOUMsY0FBYztBQUNi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
