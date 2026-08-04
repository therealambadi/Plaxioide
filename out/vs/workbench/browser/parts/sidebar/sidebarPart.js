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
import "./media/sidebarpart.css";
import "./sidebarActions.js";
import { ActivityBarPosition, IWorkbenchLayoutService, LayoutSettings, Parts, Position as SideBarPosition } from "../../../services/layout/browser/layoutService.js";
import { SidebarFocusContext, ActiveViewletContext } from "../../../common/contextkeys.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { contrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { SIDE_BAR_TITLE_FOREGROUND, SIDE_BAR_TITLE_BORDER, SIDE_BAR_BACKGROUND, SIDE_BAR_FOREGROUND, SIDE_BAR_BORDER, SIDE_BAR_DRAG_AND_DROP_BACKGROUND, ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND, ACTIVITY_BAR_TOP_FOREGROUND, ACTIVITY_BAR_TOP_ACTIVE_BORDER, ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND, ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER } from "../../../common/theme.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { LayoutPriority } from "../../../../base/browser/ui/grid/grid.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { AbstractPaneCompositePart, CompositeBarPosition } from "../paneCompositePart.js";
import { ActivityBarCompositeBar, ActivitybarPart } from "../activitybar/activitybarPart.js";
import { ActionsOrientation } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Action2, IMenuService, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Separator } from "../../../../base/common/actions.js";
import { ToggleActivityBarVisibilityActionId } from "../../actions/layoutActions.js";
import { localize2 } from "../../../../nls.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
let SidebarPart = class extends AbstractPaneCompositePart {
  //#endregion
  constructor(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, configurationService, menuService) {
    super(
      Parts.SIDEBAR_PART,
      { hasTitle: false, borderWidth: () => this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder) ? 1 : 0 },
      SidebarPart.activeViewletSettingsKey,
      ActiveViewletContext.bindTo(contextKeyService),
      SidebarFocusContext.bindTo(contextKeyService),
      "sideBar",
      "viewlet",
      SIDE_BAR_TITLE_FOREGROUND,
      SIDE_BAR_TITLE_BORDER,
      notificationService,
      storageService,
      contextMenuService,
      layoutService,
      keybindingService,
      hoverService,
      instantiationService,
      themeService,
      viewDescriptorService,
      contextKeyService,
      extensionService,
      menuService
    );
    this.configurationService = configurationService;
    //#region IView
    this.minimumWidth = 170;
    this.maximumWidth = Number.POSITIVE_INFINITY;
    this.minimumHeight = 0;
    this.maximumHeight = Number.POSITIVE_INFINITY;
    this.priority = LayoutPriority.Low;
    this.activityBarPart = this._register(this.instantiationService.createInstance(ActivitybarPart, this));
    this.rememberActivityBarVisiblePosition();
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION)) {
        this.onDidChangeActivityBarLocation();
      }
    }));
    this.registerActions();
    // PLC: when the active composite changes, re-run layout to show/hide Library panel
    this._register(this.onDidPaneCompositeOpen((e) => {
      if (this._plcLastWidth) {
        this.layout(this._plcLastWidth, this._plcLastHeight, this._plcLastTop, this._plcLastLeft);
      }
    }));
  }
  get snap() {
    return true;
  }
  get preferredWidth() {
    const viewlet = this.getActivePaneComposite();
    if (!viewlet) {
      return;
    }
    const width = viewlet.getOptimalWidth();
    if (typeof width !== "number") {
      return;
    }
    return Math.max(width, 300);
  }
  onDidChangeActivityBarLocation() {
    this.activityBarPart.hide();
    this.updateCompositeBar();
    const id = this.getActiveComposite()?.getId();
    if (id) {
      this.onTitleAreaUpdate(id);
    }
    if (this.shouldShowActivityBar()) {
      this.activityBarPart.show();
    }
    this.rememberActivityBarVisiblePosition();
  }
  updateStyles() {
    super.updateStyles();
    const container = assertIsDefined(this.getContainer());
    container.style.backgroundColor = this.getColor(SIDE_BAR_BACKGROUND) || "";
    container.style.color = this.getColor(SIDE_BAR_FOREGROUND) || "";
    const borderColor = this.getColor(SIDE_BAR_BORDER) || this.getColor(contrastBorder);
    const isPositionLeft = this.layoutService.getSideBarPosition() === SideBarPosition.LEFT;
    container.style.borderRightWidth = borderColor && isPositionLeft ? "1px" : "";
    container.style.borderRightStyle = borderColor && isPositionLeft ? "solid" : "";
    container.style.borderRightColor = isPositionLeft ? borderColor || "" : "";
    container.style.borderLeftWidth = borderColor && !isPositionLeft ? "1px" : "";
    container.style.borderLeftStyle = borderColor && !isPositionLeft ? "solid" : "";
    container.style.borderLeftColor = !isPositionLeft ? borderColor || "" : "";
    container.style.outlineColor = this.getColor(SIDE_BAR_DRAG_AND_DROP_BACKGROUND) ?? "";
  }
  layout(width, height, top, left) {
    if (!this.layoutService.isVisible(Parts.SIDEBAR_PART)) {
      return;
    }
    this._plcLastWidth = width;
    this._plcLastHeight = height;
    this._plcLastTop = top;
    this._plcLastLeft = left;
    const activeId = this.getActiveComposite()?.getId();
    const isExplorer = activeId === "workbench.view.explorer";

    super.layout(width, height, top, left);

    if (false && isExplorer && this._plcLibraryPanel) {
      const splitRatio = this._plcSplitRatio || 0.55;
      const sashH = 4;
      const contentArea = this.getContentArea();
      if (!contentArea) return;
      const fullH = parseInt(contentArea.style.height) || contentArea.getBoundingClientRect().height;
      const topH = Math.max(80, Math.floor(fullH * splitRatio));
      const bottomH = Math.max(80, fullH - topH - sashH);

      // Constrain explorer viewlet
      const explorerEl = contentArea.querySelector("#workbench\\.view\\.explorer");
      if (explorerEl) {
        explorerEl.style.height = topH + "px";
        explorerEl.style.maxHeight = topH + "px";
        explorerEl.style.overflow = "hidden";
      }

      // Re-layout composite with reduced height
      const composite = this.getActivePaneComposite();
      if (composite) {
        try { composite.layout({ width, height: topH }); } catch {}
      }

      if (this._plcSash) {
        this._plcSash.style.top = topH + "px";
        this._plcSash.style.display = "block";
      }
      this._plcLibraryPanel.style.top = (topH + sashH) + "px";
      this._plcLibraryPanel.style.height = bottomH + "px";
      this._plcLibraryPanel.style.display = "flex";
    } else {
      if (this._plcSash) this._plcSash.style.display = "none";
      if (this._plcLibraryPanel) this._plcLibraryPanel.style.display = "none";
      const contentArea = this.getContentArea();
      if (contentArea) {
        const explorerEl = contentArea.querySelector("#workbench\\.view\\.explorer");
        if (explorerEl) {
          explorerEl.style.height = "";
          explorerEl.style.maxHeight = "";
          explorerEl.style.overflow = "";
        }
      }
    }
  }
  _plcInitLibrary() {
    const contentArea = this.getContentArea();
    if (!contentArea) return;
    contentArea.style.position = "relative";
    contentArea.style.overflow = "hidden";

    // Sash
    const sash = document.createElement("div");
    sash.style.cssText = "position:absolute;left:0;width:100%;height:4px;cursor:ns-resize;background:transparent;z-index:100;transition:background 0.1s;display:none;";
    sash.addEventListener("mouseenter", () => { sash.style.background = "var(--vscode-sash-hoverBorder,var(--vscode-focusBorder,#007fd4))"; });
    sash.addEventListener("mouseleave", () => { if (!this._plcDragging) sash.style.background = "transparent"; });
    contentArea.appendChild(sash);
    this._plcSash = sash;

    // Library panel
    const panel = document.createElement("div");
    panel.style.cssText = "position:absolute;left:0;width:100%;display:none;flex-direction:column;overflow:hidden;background:var(--vscode-sideBar-background);";
    contentArea.appendChild(panel);
    this._plcLibraryPanel = panel;
    this._plcSplitRatio = 0.55;
    this._plcDragging = false;

    // Content (React mount)
    const content = document.createElement("div");
    content.style.cssText = "flex:1 1 0;overflow:hidden;display:flex;flex-direction:column;";
    panel.appendChild(content);

    // React mount will be handled by plcExplorerPanel.js which finds this element by id
    content.id = "plc-library-mount-point";

    // Sash drag
    sash.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this._plcDragging = true;
      const startY = e.clientY;
      const startRatio = this._plcSplitRatio;
      sash.style.background = "var(--vscode-sash-hoverBorder,var(--vscode-focusBorder,#007fd4))";
      const onMove = (e2) => {
        const contentArea = this.getContentArea();
        const fullH = contentArea ? contentArea.getBoundingClientRect().height : 600;
        const delta = e2.clientY - startY;
        this._plcSplitRatio = Math.max(0.15, Math.min(0.85, startRatio + delta / fullH));
        if (this._plcLastWidth) {
          this.layout(this._plcLastWidth, this._plcLastHeight, this._plcLastTop, this._plcLastLeft);
        }
      };
      const onUp = () => {
        this._plcDragging = false;
        sash.style.background = "transparent";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }
  getTitleAreaDropDownAnchorAlignment() {
    return this.layoutService.getSideBarPosition() === SideBarPosition.LEFT ? AnchorAlignment.LEFT : AnchorAlignment.RIGHT;
  }
  createCompositeBar() {
    return this.instantiationService.createInstance(ActivityBarCompositeBar, this.getCompositeBarOptions(), this.partId, this, false);
  }
  getCompositeBarOptions() {
    return {
      partContainerClass: "sidebar",
      pinnedViewContainersKey: ActivitybarPart.pinnedViewContainersKey,
      placeholderViewContainersKey: ActivitybarPart.placeholderViewContainersKey,
      viewContainersWorkspaceStateKey: ActivitybarPart.viewContainersWorkspaceStateKey,
      icon: true,
      orientation: ActionsOrientation.HORIZONTAL,
      recomputeSizes: true,
      activityHoverOptions: {
        position: () => this.getCompositeBarPosition() === CompositeBarPosition.BOTTOM ? HoverPosition.ABOVE : HoverPosition.BELOW
      },
      fillExtraContextMenuActions: (actions) => {
        if (this.getCompositeBarPosition() === CompositeBarPosition.TITLE) {
          const viewsSubmenuAction = this.getViewsSubmenuAction();
          if (viewsSubmenuAction) {
            actions.push(new Separator());
            actions.push(viewsSubmenuAction);
          }
        }
      },
      compositeSize: 0,
      iconSize: 16,
      overflowActionSize: 30,
      colors: (theme) => ({
        activeBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
        inactiveBackgroundColor: theme.getColor(SIDE_BAR_BACKGROUND),
        activeBorderBottomColor: theme.getColor(ACTIVITY_BAR_TOP_ACTIVE_BORDER),
        activeForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_FOREGROUND),
        inactiveForegroundColor: theme.getColor(ACTIVITY_BAR_TOP_INACTIVE_FOREGROUND),
        badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
        badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND),
        dragAndDropBorder: theme.getColor(ACTIVITY_BAR_TOP_DRAG_AND_DROP_BORDER)
      }),
      compact: true
    };
  }
  shouldShowCompositeBar() {
    return true;
  }
  shouldShowActivityBar() {
    return false;
  }
  getCompositeBarPosition() {
    const activityBarPosition = this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION);
    switch (activityBarPosition) {
      case ActivityBarPosition.TOP:
        return CompositeBarPosition.TOP;
      case ActivityBarPosition.BOTTOM:
        return CompositeBarPosition.BOTTOM;
      case ActivityBarPosition.HIDDEN:
      case ActivityBarPosition.DEFAULT:
      // noop
      default:
        return CompositeBarPosition.TITLE;
    }
  }
  rememberActivityBarVisiblePosition() {
    const activityBarPosition = this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION);
    if (activityBarPosition !== ActivityBarPosition.HIDDEN) {
      this.storageService.store(LayoutSettings.ACTIVITY_BAR_LOCATION, activityBarPosition, StorageScope.PROFILE, StorageTarget.USER);
    }
  }
  getRememberedActivityBarVisiblePosition() {
    const activityBarPosition = this.storageService.get(LayoutSettings.ACTIVITY_BAR_LOCATION, StorageScope.PROFILE);
    switch (activityBarPosition) {
      case ActivityBarPosition.TOP:
        return ActivityBarPosition.TOP;
      case ActivityBarPosition.BOTTOM:
        return ActivityBarPosition.BOTTOM;
      default:
        return ActivityBarPosition.DEFAULT;
    }
  }
  getPinnedPaneCompositeIds() {
    return this.shouldShowCompositeBar() ? super.getPinnedPaneCompositeIds() : this.activityBarPart.getPinnedPaneCompositeIds();
  }
  getVisiblePaneCompositeIds() {
    return this.shouldShowCompositeBar() ? super.getVisiblePaneCompositeIds() : this.activityBarPart.getVisiblePaneCompositeIds();
  }
  getPaneCompositeIds() {
    return this.shouldShowCompositeBar() ? super.getPaneCompositeIds() : this.activityBarPart.getPaneCompositeIds();
  }
  async focusActivityBar() {
    if (this.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION) === ActivityBarPosition.HIDDEN) {
      await this.configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, this.getRememberedActivityBarVisiblePosition());
      this.onDidChangeActivityBarLocation();
    }
    if (this.shouldShowCompositeBar()) {
      this.focusCompositeBar();
    } else {
      if (!this.layoutService.isVisible(Parts.ACTIVITYBAR_PART)) {
        this.layoutService.setPartHidden(false, Parts.ACTIVITYBAR_PART);
      }
      this.activityBarPart.show(true);
    }
  }
  registerActions() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: ToggleActivityBarVisibilityActionId,
          title: localize2("toggleActivityBar", "Toggle Activity Bar Visibility")
        });
      }
      run() {
        const value = that.configurationService.getValue(LayoutSettings.ACTIVITY_BAR_LOCATION) === ActivityBarPosition.HIDDEN ? that.getRememberedActivityBarVisiblePosition() : ActivityBarPosition.HIDDEN;
        return that.configurationService.updateValue(LayoutSettings.ACTIVITY_BAR_LOCATION, value);
      }
    }));
  }
  toJSON() {
    return {
      type: Parts.SIDEBAR_PART
    };
  }
};
SidebarPart.activeViewletSettingsKey = "workbench.sidebar.activeviewletid";
SidebarPart = __decorateClass([
  __decorateParam(0, INotificationService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IWorkbenchLayoutService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IViewDescriptorService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IExtensionService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IMenuService)
], SidebarPart);
export {
  SidebarPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9zaWRlYmFyL3NpZGViYXJQYXJ0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL3NpZGViYXJwYXJ0LmNzcyc7XG5pbXBvcnQgJy4vc2lkZWJhckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgQWN0aXZpdHlCYXJQb3NpdGlvbiwgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIExheW91dFNldHRpbmdzLCBQYXJ0cywgUG9zaXRpb24gYXMgU2lkZUJhclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTaWRlYmFyRm9jdXNDb250ZXh0LCBBY3RpdmVWaWV3bGV0Q29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNvbnRyYXN0Qm9yZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgU0lERV9CQVJfVElUTEVfRk9SRUdST1VORCwgU0lERV9CQVJfVElUTEVfQk9SREVSLCBTSURFX0JBUl9CQUNLR1JPVU5ELCBTSURFX0JBUl9GT1JFR1JPVU5ELCBTSURFX0JBUl9CT1JERVIsIFNJREVfQkFSX0RSQUdfQU5EX0RST1BfQkFDS0dST1VORCwgQUNUSVZJVFlfQkFSX0JBREdFX0JBQ0tHUk9VTkQsIEFDVElWSVRZX0JBUl9CQURHRV9GT1JFR1JPVU5ELCBBQ1RJVklUWV9CQVJfVE9QX0ZPUkVHUk9VTkQsIEFDVElWSVRZX0JBUl9UT1BfQUNUSVZFX0JPUkRFUiwgQUNUSVZJVFlfQkFSX1RPUF9JTkFDVElWRV9GT1JFR1JPVU5ELCBBQ1RJVklUWV9CQVJfVE9QX0RSQUdfQU5EX0RST1BfQk9SREVSIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBBbmNob3JBbGlnbm1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IExheW91dFByaW9yaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2dyaWQvZ3JpZC5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IEFic3RyYWN0UGFuZUNvbXBvc2l0ZVBhcnQsIENvbXBvc2l0ZUJhclBvc2l0aW9uIH0gZnJvbSAnLi4vcGFuZUNvbXBvc2l0ZVBhcnQuanMnO1xuaW1wb3J0IHsgQWN0aXZpdHlCYXJDb21wb3NpdGVCYXIsIEFjdGl2aXR5YmFyUGFydCB9IGZyb20gJy4uL2FjdGl2aXR5YmFyL2FjdGl2aXR5YmFyUGFydC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25zT3JpZW50YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBIb3ZlclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlQmFyT3B0aW9ucyB9IGZyb20gJy4uL3BhbmVDb21wb3NpdGVCYXIuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBJTWVudVNlcnZpY2UsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBUb2dnbGVBY3Rpdml0eUJhclZpc2liaWxpdHlBY3Rpb25JZCB9IGZyb20gJy4uLy4uL2FjdGlvbnMvbGF5b3V0QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuXG5leHBvcnQgY2xhc3MgU2lkZWJhclBhcnQgZXh0ZW5kcyBBYnN0cmFjdFBhbmVDb21wb3NpdGVQYXJ0IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgYWN0aXZlVmlld2xldFNldHRpbmdzS2V5ID0gJ3dvcmtiZW5jaC5zaWRlYmFyLmFjdGl2ZXZpZXdsZXRpZCc7XG5cblx0Ly8jcmVnaW9uIElWaWV3XG5cblx0cmVhZG9ubHkgbWluaW11bVdpZHRoOiBudW1iZXIgPSAxNzA7XG5cdHJlYWRvbmx5IG1heGltdW1XaWR0aDogbnVtYmVyID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXHRyZWFkb25seSBtaW5pbXVtSGVpZ2h0OiBudW1iZXIgPSAwO1xuXHRyZWFkb25seSBtYXhpbXVtSGVpZ2h0OiBudW1iZXIgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cdG92ZXJyaWRlIGdldCBzbmFwKCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXG5cdHJlYWRvbmx5IHByaW9yaXR5OiBMYXlvdXRQcmlvcml0eSA9IExheW91dFByaW9yaXR5LkxvdztcblxuXHRnZXQgcHJlZmVycmVkV2lkdGgoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB2aWV3bGV0ID0gdGhpcy5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKCk7XG5cblx0XHRpZiAoIXZpZXdsZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB3aWR0aCA9IHZpZXdsZXQuZ2V0T3B0aW1hbFdpZHRoKCk7XG5cdFx0aWYgKHR5cGVvZiB3aWR0aCAhPT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gTWF0aC5tYXgod2lkdGgsIDMwMCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGl2aXR5QmFyUGFydCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQWN0aXZpdHliYXJQYXJ0LCB0aGlzKSk7XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0UGFydHMuU0lERUJBUl9QQVJULFxuXHRcdFx0eyBoYXNUaXRsZTogdHJ1ZSwgYm9yZGVyV2lkdGg6ICgpID0+ICh0aGlzLmdldENvbG9yKFNJREVfQkFSX0JPUkRFUikgfHwgdGhpcy5nZXRDb2xvcihjb250cmFzdEJvcmRlcikpID8gMSA6IDAgfSxcblx0XHRcdFNpZGViYXJQYXJ0LmFjdGl2ZVZpZXdsZXRTZXR0aW5nc0tleSxcblx0XHRcdEFjdGl2ZVZpZXdsZXRDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSksXG5cdFx0XHRTaWRlYmFyRm9jdXNDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSksXG5cdFx0XHQnc2lkZUJhcicsXG5cdFx0XHQndmlld2xldCcsXG5cdFx0XHRTSURFX0JBUl9USVRMRV9GT1JFR1JPVU5ELFxuXHRcdFx0U0lERV9CQVJfVElUTEVfQk9SREVSLFxuXHRcdFx0bm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRcdHN0b3JhZ2VTZXJ2aWNlLFxuXHRcdFx0Y29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0bGF5b3V0U2VydmljZSxcblx0XHRcdGtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdFx0aG92ZXJTZXJ2aWNlLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHR0aGVtZVNlcnZpY2UsXG5cdFx0XHR2aWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0XHRjb250ZXh0S2V5U2VydmljZSxcblx0XHRcdGV4dGVuc2lvblNlcnZpY2UsXG5cdFx0XHRtZW51U2VydmljZSxcblx0XHQpO1xuXG5cdFx0dGhpcy5yZW1lbWJlckFjdGl2aXR5QmFyVmlzaWJsZVBvc2l0aW9uKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OKSkge1xuXHRcdFx0XHR0aGlzLm9uRGlkQ2hhbmdlQWN0aXZpdHlCYXJMb2NhdGlvbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJBY3Rpb25zKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlQWN0aXZpdHlCYXJMb2NhdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLmFjdGl2aXR5QmFyUGFydC5oaWRlKCk7XG5cblx0XHR0aGlzLnVwZGF0ZUNvbXBvc2l0ZUJhcigpO1xuXG5cdFx0Y29uc3QgaWQgPSB0aGlzLmdldEFjdGl2ZUNvbXBvc2l0ZSgpPy5nZXRJZCgpO1xuXHRcdGlmIChpZCkge1xuXHRcdFx0dGhpcy5vblRpdGxlQXJlYVVwZGF0ZShpZCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2hvdWxkU2hvd0FjdGl2aXR5QmFyKCkpIHtcblx0XHRcdHRoaXMuYWN0aXZpdHlCYXJQYXJ0LnNob3coKTtcblx0XHR9XG5cblx0XHR0aGlzLnJlbWVtYmVyQWN0aXZpdHlCYXJWaXNpYmxlUG9zaXRpb24oKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZVN0eWxlcygpOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVTdHlsZXMoKTtcblxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLmdldENvbnRhaW5lcigpKTtcblxuXHRcdGNvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSB0aGlzLmdldENvbG9yKFNJREVfQkFSX0JBQ0tHUk9VTkQpIHx8ICcnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5jb2xvciA9IHRoaXMuZ2V0Q29sb3IoU0lERV9CQVJfRk9SRUdST1VORCkgfHwgJyc7XG5cblx0XHRjb25zdCBib3JkZXJDb2xvciA9IHRoaXMuZ2V0Q29sb3IoU0lERV9CQVJfQk9SREVSKSB8fCB0aGlzLmdldENvbG9yKGNvbnRyYXN0Qm9yZGVyKTtcblx0XHRjb25zdCBpc1Bvc2l0aW9uTGVmdCA9IHRoaXMubGF5b3V0U2VydmljZS5nZXRTaWRlQmFyUG9zaXRpb24oKSA9PT0gU2lkZUJhclBvc2l0aW9uLkxFRlQ7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmJvcmRlclJpZ2h0V2lkdGggPSBib3JkZXJDb2xvciAmJiBpc1Bvc2l0aW9uTGVmdCA/ICcxcHgnIDogJyc7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmJvcmRlclJpZ2h0U3R5bGUgPSBib3JkZXJDb2xvciAmJiBpc1Bvc2l0aW9uTGVmdCA/ICdzb2xpZCcgOiAnJztcblx0XHRjb250YWluZXIuc3R5bGUuYm9yZGVyUmlnaHRDb2xvciA9IGlzUG9zaXRpb25MZWZ0ID8gYm9yZGVyQ29sb3IgfHwgJycgOiAnJztcblx0XHRjb250YWluZXIuc3R5bGUuYm9yZGVyTGVmdFdpZHRoID0gYm9yZGVyQ29sb3IgJiYgIWlzUG9zaXRpb25MZWZ0ID8gJzFweCcgOiAnJztcblx0XHRjb250YWluZXIuc3R5bGUuYm9yZGVyTGVmdFN0eWxlID0gYm9yZGVyQ29sb3IgJiYgIWlzUG9zaXRpb25MZWZ0ID8gJ3NvbGlkJyA6ICcnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5ib3JkZXJMZWZ0Q29sb3IgPSAhaXNQb3NpdGlvbkxlZnQgPyBib3JkZXJDb2xvciB8fCAnJyA6ICcnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5vdXRsaW5lQ29sb3IgPSB0aGlzLmdldENvbG9yKFNJREVfQkFSX0RSQUdfQU5EX0RST1BfQkFDS0dST1VORCkgPz8gJyc7XG5cdH1cblxuXHRvdmVycmlkZSBsYXlvdXQod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHRvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubGF5b3V0U2VydmljZS5pc1Zpc2libGUoUGFydHMuU0lERUJBUl9QQVJUKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN1cGVyLmxheW91dCh3aWR0aCwgaGVpZ2h0LCB0b3AsIGxlZnQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldFRpdGxlQXJlYURyb3BEb3duQW5jaG9yQWxpZ25tZW50KCk6IEFuY2hvckFsaWdubWVudCB7XG5cdFx0cmV0dXJuIHRoaXMubGF5b3V0U2VydmljZS5nZXRTaWRlQmFyUG9zaXRpb24oKSA9PT0gU2lkZUJhclBvc2l0aW9uLkxFRlQgPyBBbmNob3JBbGlnbm1lbnQuTEVGVCA6IEFuY2hvckFsaWdubWVudC5SSUdIVDtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVDb21wb3NpdGVCYXIoKTogQWN0aXZpdHlCYXJDb21wb3NpdGVCYXIge1xuXHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEFjdGl2aXR5QmFyQ29tcG9zaXRlQmFyLCB0aGlzLmdldENvbXBvc2l0ZUJhck9wdGlvbnMoKSwgdGhpcy5wYXJ0SWQsIHRoaXMsIGZhbHNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRDb21wb3NpdGVCYXJPcHRpb25zKCk6IElQYW5lQ29tcG9zaXRlQmFyT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHBhcnRDb250YWluZXJDbGFzczogJ3NpZGViYXInLFxuXHRcdFx0cGlubmVkVmlld0NvbnRhaW5lcnNLZXk6IEFjdGl2aXR5YmFyUGFydC5waW5uZWRWaWV3Q29udGFpbmVyc0tleSxcblx0XHRcdHBsYWNlaG9sZGVyVmlld0NvbnRhaW5lcnNLZXk6IEFjdGl2aXR5YmFyUGFydC5wbGFjZWhvbGRlclZpZXdDb250YWluZXJzS2V5LFxuXHRcdFx0dmlld0NvbnRhaW5lcnNXb3Jrc3BhY2VTdGF0ZUtleTogQWN0aXZpdHliYXJQYXJ0LnZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVLZXksXG5cdFx0XHRpY29uOiB0cnVlLFxuXHRcdFx0b3JpZW50YXRpb246IEFjdGlvbnNPcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuXHRcdFx0cmVjb21wdXRlU2l6ZXM6IHRydWUsXG5cdFx0XHRhY3Rpdml0eUhvdmVyT3B0aW9uczoge1xuXHRcdFx0XHRwb3NpdGlvbjogKCkgPT4gdGhpcy5nZXRDb21wb3NpdGVCYXJQb3NpdGlvbigpID09PSBDb21wb3NpdGVCYXJQb3NpdGlvbi5CT1RUT00gPyBIb3ZlclBvc2l0aW9uLkFCT1ZFIDogSG92ZXJQb3NpdGlvbi5CRUxPVyxcblx0XHRcdH0sXG5cdFx0XHRmaWxsRXh0cmFDb250ZXh0TWVudUFjdGlvbnM6IGFjdGlvbnMgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5nZXRDb21wb3NpdGVCYXJQb3NpdGlvbigpID09PSBDb21wb3NpdGVCYXJQb3NpdGlvbi5USVRMRSkge1xuXHRcdFx0XHRcdGNvbnN0IHZpZXdzU3VibWVudUFjdGlvbiA9IHRoaXMuZ2V0Vmlld3NTdWJtZW51QWN0aW9uKCk7XG5cdFx0XHRcdFx0aWYgKHZpZXdzU3VibWVudUFjdGlvbikge1xuXHRcdFx0XHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHRcdFx0XHRhY3Rpb25zLnB1c2godmlld3NTdWJtZW51QWN0aW9uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRjb21wb3NpdGVTaXplOiAwLFxuXHRcdFx0aWNvblNpemU6IDE2LFxuXHRcdFx0b3ZlcmZsb3dBY3Rpb25TaXplOiAzMCxcblx0XHRcdGNvbG9yczogdGhlbWUgPT4gKHtcblx0XHRcdFx0YWN0aXZlQmFja2dyb3VuZENvbG9yOiB0aGVtZS5nZXRDb2xvcihTSURFX0JBUl9CQUNLR1JPVU5EKSxcblx0XHRcdFx0aW5hY3RpdmVCYWNrZ3JvdW5kQ29sb3I6IHRoZW1lLmdldENvbG9yKFNJREVfQkFSX0JBQ0tHUk9VTkQpLFxuXHRcdFx0XHRhY3RpdmVCb3JkZXJCb3R0b21Db2xvcjogdGhlbWUuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX1RPUF9BQ1RJVkVfQk9SREVSKSxcblx0XHRcdFx0YWN0aXZlRm9yZWdyb3VuZENvbG9yOiB0aGVtZS5nZXRDb2xvcihBQ1RJVklUWV9CQVJfVE9QX0ZPUkVHUk9VTkQpLFxuXHRcdFx0XHRpbmFjdGl2ZUZvcmVncm91bmRDb2xvcjogdGhlbWUuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX1RPUF9JTkFDVElWRV9GT1JFR1JPVU5EKSxcblx0XHRcdFx0YmFkZ2VCYWNrZ3JvdW5kOiB0aGVtZS5nZXRDb2xvcihBQ1RJVklUWV9CQVJfQkFER0VfQkFDS0dST1VORCksXG5cdFx0XHRcdGJhZGdlRm9yZWdyb3VuZDogdGhlbWUuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX0JBREdFX0ZPUkVHUk9VTkQpLFxuXHRcdFx0XHRkcmFnQW5kRHJvcEJvcmRlcjogdGhlbWUuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX1RPUF9EUkFHX0FORF9EUk9QX0JPUkRFUilcblx0XHRcdH0pLFxuXHRcdFx0Y29tcGFjdDogdHJ1ZVxuXHRcdH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgc2hvdWxkU2hvd0NvbXBvc2l0ZUJhcigpOiBib29sZWFuIHtcblx0XHRjb25zdCBhY3Rpdml0eUJhclBvc2l0aW9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxBY3Rpdml0eUJhclBvc2l0aW9uPihMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04pO1xuXHRcdHJldHVybiBhY3Rpdml0eUJhclBvc2l0aW9uID09PSBBY3Rpdml0eUJhclBvc2l0aW9uLlRPUCB8fCBhY3Rpdml0eUJhclBvc2l0aW9uID09PSBBY3Rpdml0eUJhclBvc2l0aW9uLkJPVFRPTTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkU2hvd0FjdGl2aXR5QmFyKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLnNob3VsZFNob3dDb21wb3NpdGVCYXIoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKExheW91dFNldHRpbmdzLkFDVElWSVRZX0JBUl9MT0NBVElPTikgIT09IEFjdGl2aXR5QmFyUG9zaXRpb24uSElEREVOO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldENvbXBvc2l0ZUJhclBvc2l0aW9uKCk6IENvbXBvc2l0ZUJhclBvc2l0aW9uIHtcblx0XHRjb25zdCBhY3Rpdml0eUJhclBvc2l0aW9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxBY3Rpdml0eUJhclBvc2l0aW9uPihMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04pO1xuXHRcdHN3aXRjaCAoYWN0aXZpdHlCYXJQb3NpdGlvbikge1xuXHRcdFx0Y2FzZSBBY3Rpdml0eUJhclBvc2l0aW9uLlRPUDogcmV0dXJuIENvbXBvc2l0ZUJhclBvc2l0aW9uLlRPUDtcblx0XHRcdGNhc2UgQWN0aXZpdHlCYXJQb3NpdGlvbi5CT1RUT006IHJldHVybiBDb21wb3NpdGVCYXJQb3NpdGlvbi5CT1RUT007XG5cdFx0XHRjYXNlIEFjdGl2aXR5QmFyUG9zaXRpb24uSElEREVOOlxuXHRcdFx0Y2FzZSBBY3Rpdml0eUJhclBvc2l0aW9uLkRFRkFVTFQ6IC8vIG5vb3Bcblx0XHRcdGRlZmF1bHQ6IHJldHVybiBDb21wb3NpdGVCYXJQb3NpdGlvbi5USVRMRTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbWVtYmVyQWN0aXZpdHlCYXJWaXNpYmxlUG9zaXRpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aXZpdHlCYXJQb3NpdGlvbiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPihMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04pO1xuXHRcdGlmIChhY3Rpdml0eUJhclBvc2l0aW9uICE9PSBBY3Rpdml0eUJhclBvc2l0aW9uLkhJRERFTikge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04sIGFjdGl2aXR5QmFyUG9zaXRpb24sIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0UmVtZW1iZXJlZEFjdGl2aXR5QmFyVmlzaWJsZVBvc2l0aW9uKCk6IEFjdGl2aXR5QmFyUG9zaXRpb24ge1xuXHRcdGNvbnN0IGFjdGl2aXR5QmFyUG9zaXRpb24gPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04sIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0XHRzd2l0Y2ggKGFjdGl2aXR5QmFyUG9zaXRpb24pIHtcblx0XHRcdGNhc2UgQWN0aXZpdHlCYXJQb3NpdGlvbi5UT1A6IHJldHVybiBBY3Rpdml0eUJhclBvc2l0aW9uLlRPUDtcblx0XHRcdGNhc2UgQWN0aXZpdHlCYXJQb3NpdGlvbi5CT1RUT006IHJldHVybiBBY3Rpdml0eUJhclBvc2l0aW9uLkJPVFRPTTtcblx0XHRcdGRlZmF1bHQ6IHJldHVybiBBY3Rpdml0eUJhclBvc2l0aW9uLkRFRkFVTFQ7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0UGlubmVkUGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuc2hvdWxkU2hvd0NvbXBvc2l0ZUJhcigpID8gc3VwZXIuZ2V0UGlubmVkUGFuZUNvbXBvc2l0ZUlkcygpIDogdGhpcy5hY3Rpdml0eUJhclBhcnQuZ2V0UGlubmVkUGFuZUNvbXBvc2l0ZUlkcygpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0VmlzaWJsZVBhbmVDb21wb3NpdGVJZHMoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLnNob3VsZFNob3dDb21wb3NpdGVCYXIoKSA/IHN1cGVyLmdldFZpc2libGVQYW5lQ29tcG9zaXRlSWRzKCkgOiB0aGlzLmFjdGl2aXR5QmFyUGFydC5nZXRWaXNpYmxlUGFuZUNvbXBvc2l0ZUlkcygpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0UGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuc2hvdWxkU2hvd0NvbXBvc2l0ZUJhcigpID8gc3VwZXIuZ2V0UGFuZUNvbXBvc2l0ZUlkcygpIDogdGhpcy5hY3Rpdml0eUJhclBhcnQuZ2V0UGFuZUNvbXBvc2l0ZUlkcygpO1xuXHR9XG5cblx0YXN5bmMgZm9jdXNBY3Rpdml0eUJhcigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04pID09PSBBY3Rpdml0eUJhclBvc2l0aW9uLkhJRERFTikge1xuXHRcdFx0YXdhaXQgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04sIHRoaXMuZ2V0UmVtZW1iZXJlZEFjdGl2aXR5QmFyVmlzaWJsZVBvc2l0aW9uKCkpO1xuXG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlQWN0aXZpdHlCYXJMb2NhdGlvbigpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNob3VsZFNob3dDb21wb3NpdGVCYXIoKSkge1xuXHRcdFx0dGhpcy5mb2N1c0NvbXBvc2l0ZUJhcigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoIXRoaXMubGF5b3V0U2VydmljZS5pc1Zpc2libGUoUGFydHMuQUNUSVZJVFlCQVJfUEFSVCkpIHtcblx0XHRcdFx0dGhpcy5sYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4oZmFsc2UsIFBhcnRzLkFDVElWSVRZQkFSX1BBUlQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmFjdGl2aXR5QmFyUGFydC5zaG93KHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJBY3Rpb25zKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogVG9nZ2xlQWN0aXZpdHlCYXJWaXNpYmlsaXR5QWN0aW9uSWQsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigndG9nZ2xlQWN0aXZpdHlCYXInLCBcIlRvZ2dsZSBBY3Rpdml0eSBCYXIgVmlzaWJpbGl0eVwiKSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gdGhhdC5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShMYXlvdXRTZXR0aW5ncy5BQ1RJVklUWV9CQVJfTE9DQVRJT04pID09PSBBY3Rpdml0eUJhclBvc2l0aW9uLkhJRERFTiA/IHRoYXQuZ2V0UmVtZW1iZXJlZEFjdGl2aXR5QmFyVmlzaWJsZVBvc2l0aW9uKCkgOiBBY3Rpdml0eUJhclBvc2l0aW9uLkhJRERFTjtcblx0XHRcdFx0cmV0dXJuIHRoYXQuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoTGF5b3V0U2V0dGluZ3MuQUNUSVZJVFlfQkFSX0xPQ0FUSU9OLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0dG9KU09OKCk6IG9iamVjdCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6IFBhcnRzLlNJREVCQVJfUEFSVFxuXHRcdH07XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLE9BQU87QUFDUCxTQUFTLHFCQUFxQix5QkFBeUIsZ0JBQWdCLE9BQU8sWUFBWSx1QkFBdUI7QUFDakgsU0FBUyxxQkFBcUIsNEJBQTRCO0FBQzFELFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCLHVCQUF1QixxQkFBcUIscUJBQXFCLGlCQUFpQixtQ0FBbUMsK0JBQStCLCtCQUErQiw2QkFBNkIsZ0NBQWdDLHNDQUFzQyw2Q0FBNkM7QUFDdlcsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUywyQkFBMkIsNEJBQTRCO0FBQ2hFLFNBQVMseUJBQXlCLHVCQUF1QjtBQUN6RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHFCQUFxQjtBQUU5QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLFNBQVMsY0FBYyx1QkFBdUI7QUFDdkQsU0FBUyxpQkFB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
