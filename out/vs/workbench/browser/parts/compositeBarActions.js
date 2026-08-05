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
import { localize } from "../../../nls.js";
import { Action, Separator } from "../../../base/common/actions.js";
import { $, addDisposableListener, append, clearNode, EventHelper, EventType, getDomNodePagePosition, hide, show } from "../../../base/browser/dom.js";
import { ICommandService } from "../../../platform/commands/common/commands.js";
import { toDisposable, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { NumberBadge, ProgressBadge, IconBadge } from "../../services/activity/common/activity.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { DelayedDragHandler } from "../../../base/browser/dnd.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { CompositeDragAndDropObserver, toggleDropEffect } from "../dnd.js";
import { BaseActionViewItem } from "../../../base/browser/ui/actionbar/actionViewItems.js";
import { Codicon } from "../../../base/common/codicons.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { badgeBackground, badgeForeground, contrastBorder } from "../../../platform/theme/common/colorRegistry.js";
import { Action2 } from "../../../platform/actions/common/actions.js";
import { IPaneCompositePartService } from "../../services/panecomposite/browser/panecomposite.js";
import { createConfigureKeybindingAction } from "../../../platform/actions/common/menuService.js";
class CompositeBarAction extends Action {
  constructor(item) {
    super(item.id, item.name, item.classNames?.join(" "), true);
    this.item = item;
    this._onDidChangeCompositeBarActionItem = this._register(new Emitter());
    this.onDidChangeCompositeBarActionItem = this._onDidChangeCompositeBarActionItem.event;
    this._onDidChangeActivity = this._register(new Emitter());
    this.onDidChangeActivity = this._onDidChangeActivity.event;
    this._activities = [];
  }
  get compositeBarActionItem() {
    return this.item;
  }
  set compositeBarActionItem(item) {
    this._label = item.name;
    this.item = item;
    this._onDidChangeCompositeBarActionItem.fire(this);
  }
  get activities() {
    return this._activities;
  }
  set activities(activities) {
    this._activities = activities;
    this._onDidChangeActivity.fire(activities);
  }
  activate() {
    if (!this.checked) {
      this._setChecked(true);
    }
  }
  deactivate() {
    if (this.checked) {
      this._setChecked(false);
    }
  }
}
let CompositeBarActionViewItem = class extends BaseActionViewItem {
  constructor(action, options, badgesEnabled, themeService, hoverService, configurationService, keybindingService) {
    super(null, action, options);
    this.badgesEnabled = badgesEnabled;
    this.themeService = themeService;
    this.hoverService = hoverService;
    this.configurationService = configurationService;
    this.keybindingService = keybindingService;
    this.badgeDisposable = this._register(new MutableDisposable());
    this.options = options;
    this._register(this.themeService.onDidColorThemeChange(this.onThemeChange, this));
    this._register(action.onDidChangeCompositeBarActionItem(() => this.update()));
    this._register(Event.filter(keybindingService.onDidUpdateKeybindings, () => this.keybindingLabel !== this.computeKeybindingLabel())(() => this.updateTitle()));
    this._register(action.onDidChangeActivity(() => this.updateActivity()));
  }
  get compositeBarActionItem() {
    return this._action.compositeBarActionItem;
  }
  updateStyles() {
    const theme = this.themeService.getColorTheme();
    const colors = this.options.colors(theme);
    if (this.label) {
      if (this.options.icon) {
        const foreground = this._action.checked ? colors.activeForegroundColor : colors.inactiveForegroundColor;
        if (this.compositeBarActionItem.iconUrl) {
          this.label.style.backgroundColor = foreground ? foreground.toString() : "";
          this.label.style.color = "";
        } else {
          this.label.style.color = foreground ? foreground.toString() : "";
          this.label.style.backgroundColor = "";
        }
      } else {
        const foreground = this._action.checked ? colors.activeForegroundColor : colors.inactiveForegroundColor;
        const borderBottomColor = this._action.checked ? colors.activeBorderBottomColor : null;
        this.label.style.color = foreground ? foreground.toString() : "";
        this.label.style.borderBottomColor = borderBottomColor ? borderBottomColor.toString() : "";
      }
      this.container.style.setProperty("--insert-border-color", colors.dragAndDropBorder ? colors.dragAndDropBorder.toString() : "");
    }
    if (this.badgeContent) {
      const badgeStyles = this.getActivities()[0]?.badge.getColors(theme);
      const badgeFg = badgeStyles?.badgeForeground ?? colors.badgeForeground ?? theme.getColor(badgeForeground);
      const badgeBg = badgeStyles?.badgeBackground ?? colors.badgeBackground ?? theme.getColor(badgeBackground);
      const contrastBorderColor = badgeStyles?.badgeBorder ?? theme.getColor(contrastBorder);
      this.badgeContent.style.color = badgeFg ? badgeFg.toString() : "";
      this.badgeContent.style.backgroundColor = badgeBg ? badgeBg.toString() : "";
      this.badgeContent.style.borderStyle = contrastBorderColor && !this.options.compact ? "solid" : "";
      this.badgeContent.style.borderWidth = contrastBorderColor ? "1px" : "";
      this.badgeContent.style.borderColor = contrastBorderColor ? contrastBorderColor.toString() : "";
    }
  }
  render(container) {
    super.render(container);
    this.container = container;
    if (this.options.icon) {
      this.container.classList.add("icon");
    }
    if (this.options.hasPopup) {
      this.container.setAttribute("role", "button");
      this.container.setAttribute("aria-haspopup", "true");
    } else {
      this.container.setAttribute("role", "tab");
    }
    this._register(addDisposableListener(this.container, EventType.MOUSE_DOWN, () => {
      this.container.classList.add("clicked");
    }));
    this._register(addDisposableListener(this.container, EventType.MOUSE_UP, () => {
      if (this.mouseUpTimeout) {
        clearTimeout(this.mouseUpTimeout);
      }
      this.mouseUpTimeout = setTimeout(() => {
        this.container.classList.remove("clicked");
      }, 800);
    }));
    this._register(this.hoverService.setupDelayedHover(this.container, () => ({
      content: this.computeTitle(),
      position: {
        hoverPosition: this.options.hoverOptions.position()
      },
      persistence: {
        hideOnKeyDown: true
      },
      appearance: {
        showPointer: true,
        compact: true
      }
    }), { groupId: "composite-bar-actions" }));
    this.label = append(container, $("a"));
    this.badge = append(container, $(".badge"));
    this.badgeContent = append(this.badge, $(".badge-content"));
    append(container, $(".active-item-indicator"));
    hide(this.badge);
    this.update();
    this.updateStyles();
    this.updateTitle();
  }
  onThemeChange(theme) {
    this.updateStyles();
  }
  update() {
    this.updateLabel();
    this.updateActivity();
    this.updateTitle();
    this.updateStyles();
  }
  getActivities() {
    if (this._action instanceof CompositeBarAction) {
      return this._action.activities;
    }
    return [];
  }
  updateActivity() {
    if (!this.badge || !this.badgeContent || !(this._action instanceof CompositeBarAction)) {
      return;
    }
    const { badges, type } = this.getVisibleBadges(this.getActivities());
    this.badgeDisposable.value = new DisposableStore();
    clearNode(this.badgeContent);
    hide(this.badge);
    const shouldRenderBadges = this.badgesEnabled(this.compositeBarActionItem.id);
    if (badges.length > 0 && shouldRenderBadges) {
      const classes = [];
      if (this.options.compact) {
        classes.push("compact");
      }
      if (type === "progress") {
        show(this.badge);
        classes.push("progress-badge");
      } else if (type === "number") {
        const total = badges.reduce((r, b) => r + (b instanceof NumberBadge ? b.number : 0), 0);
        if (total > 0) {
          let badgeNumber = total.toString();
          if (total > 999) {
            const noOfThousands = total / 1e3;
            const floor = Math.floor(noOfThousands);
            badgeNumber = noOfThousands > floor ? `${floor}K+` : `${noOfThousands}K`;
          }
          if (this.options.compact && badgeNumber.length >= 3) {
            classes.push("compact-content");
          }
          this.badgeContent.textContent = badgeNumber;
          show(this.badge);
        }
      } else if (type === "icon") {
        classes.push("icon-badge");
        const badgeContentClassess = ["icon-overlay", ...ThemeIcon.asClassNameArray(badges[0].icon)];
        this.badgeContent.classList.add(...badgeContentClassess);
        this.badgeDisposable.value.add(toDisposable(() => this.badgeContent?.classList.remove(...badgeContentClassess)));
        show(this.badge);
      }
      if (classes.length) {
        this.badge.classList.add(...classes);
        this.badgeDisposable.value.add(toDisposable(() => this.badge.classList.remove(...classes)));
      }
    }
    this.updateTitle();
    this.updateStyles();
  }
  getVisibleBadges(activities) {
    const progressBadges = activities.filter((activity) => activity.badge instanceof ProgressBadge).map((activity) => activity.badge);
    if (progressBadges.length > 0) {
      return { badges: progressBadges, type: "progress" };
    }
    const iconBadges = activities.filter((activity) => activity.badge instanceof IconBadge).map((activity) => activity.badge);
    if (iconBadges.length > 0) {
      return { badges: iconBadges, type: "icon" };
    }
    const numberBadges = activities.filter((activity) => activity.badge instanceof NumberBadge).map((activity) => activity.badge);
    if (numberBadges.length > 0) {
      return { badges: numberBadges, type: "number" };
    }
    return { badges: [], type: void 0 };
  }
  updateLabel() {
    this.label.className = "action-label";
    if (this.compositeBarActionItem.classNames) {
      this.label.classList.add(...this.compositeBarActionItem.classNames);
    }
    if (!this.options.icon) {
      this.label.textContent = this.action.label;
    }
  }
  updateTitle() {
    const title = this.computeTitle();
    [this.label, this.badge, this.container].forEach((element) => {
      if (element) {
        element.setAttribute("aria-label", title);
        element.setAttribute("title", "");
        element.removeAttribute("title");
      }
    });
  }
  computeTitle() {
    this.keybindingLabel = this.computeKeybindingLabel();
    let title = this.keybindingLabel ? localize("titleKeybinding", "{0} ({1})", this.compositeBarActionItem.name, this.keybindingLabel) : this.compositeBarActionItem.name;
    const badges = this.getVisibleBadges(this.action.activities).badges;
    for (const badge of badges) {
      const description = badge.getDescription();
      if (!description) {
        continue;
      }
      title = `${title} - ${badge.getDescription()}`;
    }
    return title;
  }
  computeKeybindingLabel() {
    const keybinding = this.compositeBarActionItem.keybindingId ? this.keybindingService.lookupKeybinding(this.compositeBarActionItem.keybindingId) : null;
    return keybinding?.getLabel();
  }
  dispose() {
    super.dispose();
    if (this.mouseUpTimeout) {
      clearTimeout(this.mouseUpTimeout);
    }
    this.badge.remove();
  }
};
CompositeBarActionViewItem = __decorateClass([
  __decorateParam(3, IThemeService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IKeybindingService)
], CompositeBarActionViewItem);
class CompositeOverflowActivityAction extends CompositeBarAction {
  constructor(showMenu) {
    super({
      id: "additionalComposites.action",
      name: localize("additionalViews", "Additional Views"),
      classNames: ThemeIcon.asClassNameArray(Codicon.more)
    });
    this.showMenu = showMenu;
  }
  async run() {
    this.showMenu();
  }
}
let CompositeOverflowActivityActionViewItem = class extends CompositeBarActionViewItem {
  constructor(action, getOverflowingComposites, getActiveCompositeId, getBadge, getCompositeOpenAction, colors, hoverOptions, contextMenuService, themeService, hoverService, configurationService, keybindingService) {
    super(action, { icon: true, colors, hasPopup: true, hoverOptions }, () => true, themeService, hoverService, configurationService, keybindingService);
    this.getOverflowingComposites = getOverflowingComposites;
    this.getActiveCompositeId = getActiveCompositeId;
    this.getBadge = getBadge;
    this.getCompositeOpenAction = getCompositeOpenAction;
    this.contextMenuService = contextMenuService;
  }
  showMenu() {
    this.contextMenuService.showContextMenu({
      getAnchor: () => this.container,
      getActions: () => this.getActions(),
      getCheckedActionsRepresentation: () => "radio"
    });
  }
  getActions() {
    return this.getOverflowingComposites().map((composite) => {
      const action = this.getCompositeOpenAction(composite.id);
      action.checked = this.getActiveCompositeId() === action.id;
      const badge = this.getBadge(composite.id);
      let suffix;
      if (badge instanceof NumberBadge) {
        suffix = badge.number;
      }
      if (suffix) {
        action.label = localize("numberBadge", "{0} ({1})", composite.name, suffix);
      } else {
        action.label = composite.name || "";
      }
      return action;
    });
  }
};
CompositeOverflowActivityActionViewItem = __decorateClass([
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IKeybindingService)
], CompositeOverflowActivityActionViewItem);
let CompositeActionViewItem = class extends CompositeBarActionViewItem {
  constructor(options, compositeActivityAction, toggleCompositePinnedAction, toggleCompositeBadgeAction, compositeContextMenuActionsProvider, contextMenuActionsProvider, dndHandler, compositeBar, contextMenuService, keybindingService, instantiationService, themeService, hoverService, configurationService, commandService) {
    super(
      compositeActivityAction,
      options,
      compositeBar.areBadgesEnabled.bind(compositeBar),
      themeService,
      hoverService,
      configurationService,
      keybindingService
    );
    this.toggleCompositePinnedAction = toggleCompositePinnedAction;
    this.toggleCompositeBadgeAction = toggleCompositeBadgeAction;
    this.compositeContextMenuActionsProvider = compositeContextMenuActionsProvider;
    this.contextMenuActionsProvider = contextMenuActionsProvider;
    this.dndHandler = dndHandler;
    this.compositeBar = compositeBar;
    this.contextMenuService = contextMenuService;
    this.commandService = commandService;
  }
  render(container) {
    super.render(container);
    this.updateChecked();
    this.updateEnabled();
    this._register(addDisposableListener(this.container, EventType.CONTEXT_MENU, (e) => {
      EventHelper.stop(e, true);
      this.showContextMenu(container);
    }));
    let insertDropBefore = void 0;
    this._register(CompositeDragAndDropObserver.INSTANCE.registerDraggable(this.container, () => {
      return { type: "composite", id: this.compositeBarActionItem.id };
    }, {
      onDragOver: (e) => {
        const isValidMove = e.dragAndDropData.getData().id !== this.compositeBarActionItem.id && this.dndHandler.onDragOver(e.dragAndDropData, this.compositeBarActionItem.id, e.eventData);
        toggleDropEffect(e.eventData.dataTransfer, "move", isValidMove);
        insertDropBefore = this.updateFromDragging(container, isValidMove, e.eventData);
      },
      onDragLeave: (e) => {
        insertDropBefore = this.updateFromDragging(container, false, e.eventData);
      },
      onDragEnd: (e) => {
        insertDropBefore = this.updateFromDragging(container, false, e.eventData);
      },
      onDrop: (e) => {
        EventHelper.stop(e.eventData, true);
        this.dndHandler.drop(e.dragAndDropData, this.compositeBarActionItem.id, e.eventData, insertDropBefore);
        insertDropBefore = this.updateFromDragging(container, false, e.eventData);
      },
      onDragStart: (e) => {
        if (e.dragAndDropData.getData().id !== this.compositeBarActionItem.id) {
          return;
        }
        if (e.eventData.dataTransfer) {
          e.eventData.dataTransfer.effectAllowed = "move";
        }
        this.blur();
      }
    }));
    [this.badge, this.label].forEach((element) => this._register(new DelayedDragHandler(element, () => {
      if (!this.action.checked) {
        this.action.run();
      }
    })));
    this.updateStyles();
  }
  updateFromDragging(element, showFeedback, event) {
    const rect = element.getBoundingClientRect();
    const posX = event.clientX;
    const posY = event.clientY;
    const height = rect.bottom - rect.top;
    const width = rect.right - rect.left;
    const forceTop = posY <= rect.top + height * 0.4;
    const forceBottom = posY > rect.bottom - height * 0.4;
    const preferTop = posY <= rect.top + height * 0.5;
    const forceLeft = posX <= rect.left + width * 0.4;
    const forceRight = posX > rect.right - width * 0.4;
    const preferLeft = posX <= rect.left + width * 0.5;
    const classes = element.classList;
    const lastClasses = {
      vertical: classes.contains("top") ? "top" : classes.contains("bottom") ? "bottom" : void 0,
      horizontal: classes.contains("left") ? "left" : classes.contains("right") ? "right" : void 0
    };
    const top = forceTop || preferTop && !lastClasses.vertical || !forceBottom && lastClasses.vertical === "top";
    const bottom = forceBottom || !preferTop && !lastClasses.vertical || !forceTop && lastClasses.vertical === "bottom";
    const left = forceLeft || preferLeft && !lastClasses.horizontal || !forceRight && lastClasses.horizontal === "left";
    const right = forceRight || !preferLeft && !lastClasses.horizontal || !forceLeft && lastClasses.horizontal === "right";
    element.classList.toggle("top", showFeedback && top);
    element.classList.toggle("bottom", showFeedback && bottom);
    element.classList.toggle("left", showFeedback && left);
    element.classList.toggle("right", showFeedback && right);
    if (!showFeedback) {
      return void 0;
    }
    return { verticallyBefore: top, horizontallyBefore: left };
  }
  showContextMenu(container) {
    const actions = [];
    if (this.compositeBarActionItem.keybindingId) {
      actions.push(createConfigureKeybindingAction(this.commandService, this.keybindingService, this.compositeBarActionItem.keybindingId));
    }
    actions.push(this.toggleCompositePinnedAction, this.toggleCompositeBadgeAction);
    const compositeContextMenuActions = this.compositeContextMenuActionsProvider(this.compositeBarActionItem.id);
    if (compositeContextMenuActions.length) {
      actions.push(...compositeContextMenuActions);
    }
    const isPinned = this.compositeBar.isPinned(this.compositeBarActionItem.id);
    if (isPinned) {
      this.toggleCompositePinnedAction.label = localize("hide", "Hide '{0}'", this.compositeBarActionItem.name);
      this.toggleCompositePinnedAction.checked = false;
      this.toggleCompositePinnedAction.enabled = this.compositeBar.getPinnedCompositeIds().length > 1;
    } else {
      this.toggleCompositePinnedAction.label = localize("keep", "Keep '{0}'", this.compositeBarActionItem.name);
      this.toggleCompositePinnedAction.enabled = true;
    }
    const isBadgeEnabled = this.compositeBar.areBadgesEnabled(this.compositeBarActionItem.id);
    if (isBadgeEnabled) {
      this.toggleCompositeBadgeAction.label = localize("hideBadge", "Hide Badge");
    } else {
      this.toggleCompositeBadgeAction.label = localize("showBadge", "Show Badge");
    }
    const otherActions = this.contextMenuActionsProvider();
    if (otherActions.length) {
      actions.push(new Separator());
      actions.push(...otherActions);
    }
    const elementPosition = getDomNodePagePosition(container);
    const anchor = {
      x: Math.floor(elementPosition.left + elementPosition.width / 2),
      y: elementPosition.top + elementPosition.height
    };
    this.contextMenuService.showContextMenu({
      getAnchor: () => anchor,
      getActions: () => actions,
      getActionsContext: () => this.compositeBarActionItem.id
    });
  }
  updateChecked() {
    if (this.action.checked) {
      this.container.classList.add("checked");
      this.container.setAttribute("aria-label", this.getTooltip() ?? this.container.title);
      this.container.setAttribute("aria-expanded", "true");
      this.container.setAttribute("aria-selected", "true");
    } else {
      this.container.classList.remove("checked");
      this.container.setAttribute("aria-label", this.getTooltip() ?? this.container.title);
      this.container.setAttribute("aria-expanded", "false");
      this.container.setAttribute("aria-selected", "false");
    }
    this.updateStyles();
  }
  updateEnabled() {
    if (!this.element) {
      return;
    }
    if (this.action.enabled) {
      this.element.classList.remove("disabled");
    } else {
      this.element.classList.add("disabled");
    }
  }
  dispose() {
    super.dispose();
    this.label.remove();
  }
};
CompositeActionViewItem = __decorateClass([
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IThemeService),
  __decorateParam(12, IHoverService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, ICommandService)
], CompositeActionViewItem);
class ToggleCompositePinnedAction extends Action {
  constructor(activity, compositeBar) {
    super("show.toggleCompositePinned", activity ? activity.name : localize("toggle", "Toggle View Pinned"));
    this.activity = activity;
    this.compositeBar = compositeBar;
    this.checked = !!this.activity && this.compositeBar.isPinned(this.activity.id);
  }
  async run(context) {
    const id = this.activity ? this.activity.id : context;
    if (this.compositeBar.isPinned(id)) {
      this.compositeBar.unpin(id);
    } else {
      this.compositeBar.pin(id);
    }
  }
}
class ToggleCompositeBadgeAction extends Action {
  constructor(compositeBarActionItem, compositeBar) {
    super("show.toggleCompositeBadge", compositeBarActionItem ? compositeBarActionItem.name : localize("toggleBadge", "Toggle View Badge"));
    this.compositeBarActionItem = compositeBarActionItem;
    this.compositeBar = compositeBar;
    this.checked = false;
  }
  async run(context) {
    const id = this.compositeBarActionItem ? this.compositeBarActionItem.id : context;
    this.compositeBar.toggleBadgeEnablement(id);
  }
}
class SwitchCompositeViewAction extends Action2 {
  constructor(desc, location, offset) {
    super(desc);
    this.location = location;
    this.offset = offset;
  }
  async run(accessor) {
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    const activeComposite = paneCompositeService.getActivePaneComposite(this.location);
    if (!activeComposite) {
      return;
    }
    let targetCompositeId;
    const visibleCompositeIds = paneCompositeService.getVisiblePaneCompositeIds(this.location);
    for (let i = 0; i < visibleCompositeIds.length; i++) {
      if (visibleCompositeIds[i] === activeComposite.getId()) {
        targetCompositeId = visibleCompositeIds[(i + visibleCompositeIds.length + this.offset) % visibleCompositeIds.length];
        break;
      }
    }
    if (typeof targetCompositeId !== "undefined") {
      await paneCompositeService.openPaneComposite(targetCompositeId, this.location, true);
    }
  }
}
export {
  CompositeActionViewItem,
  CompositeBarAction,
  CompositeBarActionViewItem,
  CompositeOverflowActivityAction,
  CompositeOverflowActivityActionViewItem,
  SwitchCompositeViewAction,
  ToggleCompositeBadgeAction,
  ToggleCompositePinnedAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9jb21wb3NpdGVCYXJBY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uLCBJQWN0aW9uLCBTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7ICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgYXBwZW5kLCBjbGVhck5vZGUsIEV2ZW50SGVscGVyLCBFdmVudFR5cGUsIGdldERvbU5vZGVQYWdlUG9zaXRpb24sIGhpZGUsIHNob3cgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyB0b0Rpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSwgSUNvbG9yVGhlbWUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE51bWJlckJhZGdlLCBJQmFkZ2UsIElBY3Rpdml0eSwgUHJvZ3Jlc3NCYWRnZSwgSWNvbkJhZGdlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYWN0aXZpdHkvY29tbW9uL2FjdGl2aXR5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgRGVsYXllZERyYWdIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgQ29tcG9zaXRlRHJhZ0FuZERyb3BPYnNlcnZlciwgSUNvbXBvc2l0ZURyYWdBbmREcm9wLCBCZWZvcmUyRCwgdG9nZ2xlRHJvcEVmZmVjdCB9IGZyb20gJy4uL2RuZC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEJhc2VBY3Rpb25WaWV3SXRlbSwgSUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBIb3ZlclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBiYWRnZUJhY2tncm91bmQsIGJhZGdlRm9yZWdyb3VuZCwgY29udHJhc3RCb3JkZXIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBJQWN0aW9uMk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvcGFuZWNvbXBvc2l0ZS9icm93c2VyL3BhbmVjb21wb3NpdGUuanMnO1xuaW1wb3J0IHsgY3JlYXRlQ29uZmlndXJlS2V5YmluZGluZ0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL21lbnVTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJQ29tcG9zaXRlQmFyIHtcblxuXHQvKipcblx0ICogVW5waW5zIGEgY29tcG9zaXRlIGZyb20gdGhlIGNvbXBvc2l0ZSBiYXIuXG5cdCAqL1xuXHR1bnBpbihjb21wb3NpdGVJZDogc3RyaW5nKTogdm9pZDtcblxuXHQvKipcblx0ICogUGluIGEgY29tcG9zaXRlIGluc2lkZSB0aGUgY29tcG9zaXRlIGJhci5cblx0ICovXG5cdHBpbihjb21wb3NpdGVJZDogc3RyaW5nKTogdm9pZDtcblxuXHQvKipcblx0ICogRmluZCBvdXQgaWYgYSBjb21wb3NpdGUgaXMgcGlubmVkIGluIHRoZSBjb21wb3NpdGUgYmFyLlxuXHQgKi9cblx0aXNQaW5uZWQoY29tcG9zaXRlSWQ6IHN0cmluZyk6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIEdldCBwaW5uZWQgY29tcG9zaXRlIGlkcyBpbiB0aGUgY29tcG9zaXRlIGJhci5cblx0ICovXG5cdGdldFBpbm5lZENvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXTtcblxuXHQvKipcblx0ICogUmV0dXJucyBpZiBiYWRnZXMgYXJlIGVuYWJsZWQgZm9yIHRoYXQgc3BlY2lmaWVkIGNvbXBvc2l0ZS5cblx0ICogQHBhcmFtIGNvbXBvc2l0ZUlkIFRoZSBpZCBvZiB0aGUgY29tcG9zaXRlIHRvIGNoZWNrXG5cdCAqL1xuXHRhcmVCYWRnZXNFbmFibGVkKGNvbXBvc2l0ZUlkOiBzdHJpbmcpOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBUb2dnbGVzIHdoZXRoZXIgb3Igbm90IGJhZGdlcyBhcmUgc2hvd24gb24gdGhhdCBwYXJ0aWN1bGFyIGNvbXBvc2l0ZS5cblx0ICogQHBhcmFtIGNvbXBvc2l0ZUlkIFRoZSBjb21wb3NpdGUgdG8gdG9nZ2xlIGJhZGdlIGVuYWJsZW1lbnQgZm9yXG5cdCAqL1xuXHR0b2dnbGVCYWRnZUVuYWJsZW1lbnQoY29tcG9zaXRlSWQ6IHN0cmluZyk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIFJlb3JkZXIgY29tcG9zaXRlIG9yZGVyaW5nIGJ5IG1vdmluZyBhIGNvbXBvc2l0ZSB0byB0aGUgbG9jYXRpb24gb2YgYW5vdGhlciBjb21wb3NpdGUuXG5cdCAqL1xuXHRtb3ZlKGNvbXBvc2l0ZUlkOiBzdHJpbmcsIHRvY29tcG9zaXRlSWQ6IHN0cmluZyk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0ge1xuXHRpZDogc3RyaW5nO1xuXHRuYW1lOiBzdHJpbmc7XG5cdGtleWJpbmRpbmdJZD86IHN0cmluZztcblx0Y2xhc3NOYW1lcz86IHN0cmluZ1tdO1xuXHRpY29uVXJsPzogVVJJO1xufVxuXG5leHBvcnQgY2xhc3MgQ29tcG9zaXRlQmFyQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDb21wb3NpdGVCYXJBY3Rpb24+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0gPSB0aGlzLl9vbkRpZENoYW5nZUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3Rpdml0eSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElBY3Rpdml0eVtdPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3Rpdml0eSA9IHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZpdHkuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfYWN0aXZpdGllczogSUFjdGl2aXR5W10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGl0ZW06IElDb21wb3NpdGVCYXJBY3Rpb25JdGVtKSB7XG5cdFx0c3VwZXIoaXRlbS5pZCwgaXRlbS5uYW1lLCBpdGVtLmNsYXNzTmFtZXM/LmpvaW4oJyAnKSwgdHJ1ZSk7XG5cdH1cblxuXHRnZXQgY29tcG9zaXRlQmFyQWN0aW9uSXRlbSgpOiBJQ29tcG9zaXRlQmFyQWN0aW9uSXRlbSB7XG5cdFx0cmV0dXJuIHRoaXMuaXRlbTtcblx0fVxuXG5cdHNldCBjb21wb3NpdGVCYXJBY3Rpb25JdGVtKGl0ZW06IElDb21wb3NpdGVCYXJBY3Rpb25JdGVtKSB7XG5cdFx0dGhpcy5fbGFiZWwgPSBpdGVtLm5hbWU7XG5cdFx0dGhpcy5pdGVtID0gaXRlbTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0uZmlyZSh0aGlzKTtcblx0fVxuXG5cdGdldCBhY3Rpdml0aWVzKCk6IElBY3Rpdml0eVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0aXZpdGllcztcblx0fVxuXG5cdHNldCBhY3Rpdml0aWVzKGFjdGl2aXRpZXM6IElBY3Rpdml0eVtdKSB7XG5cdFx0dGhpcy5fYWN0aXZpdGllcyA9IGFjdGl2aXRpZXM7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3Rpdml0eS5maXJlKGFjdGl2aXRpZXMpO1xuXHR9XG5cblx0YWN0aXZhdGUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmNoZWNrZWQpIHtcblx0XHRcdHRoaXMuX3NldENoZWNrZWQodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0ZGVhY3RpdmF0ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jaGVja2VkKSB7XG5cdFx0XHR0aGlzLl9zZXRDaGVja2VkKGZhbHNlKTtcblx0XHR9XG5cdH1cblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21wb3NpdGVCYXJDb2xvcnMge1xuXHRyZWFkb25seSBhY3RpdmVCYWNrZ3JvdW5kQ29sb3I/OiBDb2xvcjtcblx0cmVhZG9ubHkgaW5hY3RpdmVCYWNrZ3JvdW5kQ29sb3I/OiBDb2xvcjtcblx0cmVhZG9ubHkgYWN0aXZlQm9yZGVyQ29sb3I/OiBDb2xvcjtcblx0cmVhZG9ubHkgYWN0aXZlQmFja2dyb3VuZD86IENvbG9yO1xuXHRyZWFkb25seSBhY3RpdmVCb3JkZXJCb3R0b21Db2xvcj86IENvbG9yO1xuXHRyZWFkb25seSBhY3RpdmVGb3JlZ3JvdW5kQ29sb3I/OiBDb2xvcjtcblx0cmVhZG9ubHkgaW5hY3RpdmVGb3JlZ3JvdW5kQ29sb3I/OiBDb2xvcjtcblx0cmVhZG9ubHkgYmFkZ2VCYWNrZ3JvdW5kPzogQ29sb3I7XG5cdHJlYWRvbmx5IGJhZGdlRm9yZWdyb3VuZD86IENvbG9yO1xuXHRyZWFkb25seSBkcmFnQW5kRHJvcEJvcmRlcj86IENvbG9yO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBY3Rpdml0eUhvdmVyT3B0aW9ucyB7XG5cdHJlYWRvbmx5IHBvc2l0aW9uOiAoKSA9PiBIb3ZlclBvc2l0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21wb3NpdGVCYXJBY3Rpb25WaWV3SXRlbU9wdGlvbnMgZXh0ZW5kcyBJQWN0aW9uVmlld0l0ZW1PcHRpb25zIHtcblx0cmVhZG9ubHkgaWNvbj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNvbG9yczogKHRoZW1lOiBJQ29sb3JUaGVtZSkgPT4gSUNvbXBvc2l0ZUJhckNvbG9ycztcblxuXHRyZWFkb25seSBob3Zlck9wdGlvbnM6IElBY3Rpdml0eUhvdmVyT3B0aW9ucztcblx0cmVhZG9ubHkgaGFzUG9wdXA/OiBib29sZWFuO1xuXHRyZWFkb25seSBjb21wYWN0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIENvbXBvc2l0ZUJhckFjdGlvblZpZXdJdGVtIGV4dGVuZHMgQmFzZUFjdGlvblZpZXdJdGVtIHtcblxuXHRwcm90ZWN0ZWQgY29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByb3RlY3RlZCBsYWJlbCE6IEhUTUxFbGVtZW50O1xuXHRwcm90ZWN0ZWQgYmFkZ2UhOiBIVE1MRWxlbWVudDtcblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlYWRvbmx5IG9wdGlvbnM6IElDb21wb3NpdGVCYXJBY3Rpb25WaWV3SXRlbU9wdGlvbnM7XG5cblx0cHJpdmF0ZSBiYWRnZUNvbnRlbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IGJhZGdlRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxEaXNwb3NhYmxlU3RvcmU+KCkpO1xuXHRwcml2YXRlIG1vdXNlVXBUaW1lb3V0OiBhbnk7XG5cdHByaXZhdGUga2V5YmluZGluZ0xhYmVsOiBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFjdGlvbjogQ29tcG9zaXRlQmFyQWN0aW9uLFxuXHRcdG9wdGlvbnM6IElDb21wb3NpdGVCYXJBY3Rpb25WaWV3SXRlbU9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBiYWRnZXNFbmFibGVkOiAoY29tcG9zaXRlSWQ6IHN0cmluZykgPT4gYm9vbGVhbixcblx0XHRASVRoZW1lU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIobnVsbCwgYWN0aW9uLCBvcHRpb25zKTtcblxuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UodGhpcy5vblRoZW1lQ2hhbmdlLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWN0aW9uLm9uRGlkQ2hhbmdlQ29tcG9zaXRlQmFyQWN0aW9uSXRlbSgoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZmlsdGVyKGtleWJpbmRpbmdTZXJ2aWNlLm9uRGlkVXBkYXRlS2V5YmluZGluZ3MsICgpID0+IHRoaXMua2V5YmluZGluZ0xhYmVsICE9PSB0aGlzLmNvbXB1dGVLZXliaW5kaW5nTGFiZWwoKSkoKCkgPT4gdGhpcy51cGRhdGVUaXRsZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWN0aW9uLm9uRGlkQ2hhbmdlQWN0aXZpdHkoKCkgPT4gdGhpcy51cGRhdGVBY3Rpdml0eSgpKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IGNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0oKTogSUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0ge1xuXHRcdHJldHVybiAodGhpcy5fYWN0aW9uIGFzIENvbXBvc2l0ZUJhckFjdGlvbikuY29tcG9zaXRlQmFyQWN0aW9uSXRlbTtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGVTdHlsZXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhlbWUgPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cdFx0Y29uc3QgY29sb3JzID0gdGhpcy5vcHRpb25zLmNvbG9ycyh0aGVtZSk7XG5cblx0XHRpZiAodGhpcy5sYWJlbCkge1xuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5pY29uKSB7XG5cdFx0XHRcdGNvbnN0IGZvcmVncm91bmQgPSB0aGlzLl9hY3Rpb24uY2hlY2tlZCA/IGNvbG9ycy5hY3RpdmVGb3JlZ3JvdW5kQ29sb3IgOiBjb2xvcnMuaW5hY3RpdmVGb3JlZ3JvdW5kQ29sb3I7XG5cdFx0XHRcdGlmICh0aGlzLmNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0uaWNvblVybCkge1xuXHRcdFx0XHRcdC8vIEFwcGx5IGJhY2tncm91bmQgY29sb3IgdG8gYWN0aXZpdHkgYmFyIGl0ZW0gcHJvdmlkZWQgd2l0aCBpY29uVXJsc1xuXHRcdFx0XHRcdHRoaXMubGFiZWwuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gZm9yZWdyb3VuZCA/IGZvcmVncm91bmQudG9TdHJpbmcoKSA6ICcnO1xuXHRcdFx0XHRcdHRoaXMubGFiZWwuc3R5bGUuY29sb3IgPSAnJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBBcHBseSBmb3JlZ3JvdW5kIGNvbG9yIHRvIGFjdGl2aXR5IGJhciBpdGVtcyBwcm92aWRlZCB3aXRoIGNvZGljb25zXG5cdFx0XHRcdFx0dGhpcy5sYWJlbC5zdHlsZS5jb2xvciA9IGZvcmVncm91bmQgPyBmb3JlZ3JvdW5kLnRvU3RyaW5nKCkgOiAnJztcblx0XHRcdFx0XHR0aGlzLmxhYmVsLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcnO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBmb3JlZ3JvdW5kID0gdGhpcy5fYWN0aW9uLmNoZWNrZWQgPyBjb2xvcnMuYWN0aXZlRm9yZWdyb3VuZENvbG9yIDogY29sb3JzLmluYWN0aXZlRm9yZWdyb3VuZENvbG9yO1xuXHRcdFx0XHRjb25zdCBib3JkZXJCb3R0b21Db2xvciA9IHRoaXMuX2FjdGlvbi5jaGVja2VkID8gY29sb3JzLmFjdGl2ZUJvcmRlckJvdHRvbUNvbG9yIDogbnVsbDtcblx0XHRcdFx0dGhpcy5sYWJlbC5zdHlsZS5jb2xvciA9IGZvcmVncm91bmQgPyBmb3JlZ3JvdW5kLnRvU3RyaW5nKCkgOiAnJztcblx0XHRcdFx0dGhpcy5sYWJlbC5zdHlsZS5ib3JkZXJCb3R0b21Db2xvciA9IGJvcmRlckJvdHRvbUNvbG9yID8gYm9yZGVyQm90dG9tQ29sb3IudG9TdHJpbmcoKSA6ICcnO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1pbnNlcnQtYm9yZGVyLWNvbG9yJywgY29sb3JzLmRyYWdBbmREcm9wQm9yZGVyID8gY29sb3JzLmRyYWdBbmREcm9wQm9yZGVyLnRvU3RyaW5nKCkgOiAnJyk7XG5cdFx0fVxuXG5cdFx0Ly8gQmFkZ2Vcblx0XHRpZiAodGhpcy5iYWRnZUNvbnRlbnQpIHtcblx0XHRcdGNvbnN0IGJhZGdlU3R5bGVzID0gdGhpcy5nZXRBY3Rpdml0aWVzKClbMF0/LmJhZGdlLmdldENvbG9ycyh0aGVtZSk7XG5cdFx0XHRjb25zdCBiYWRnZUZnID0gYmFkZ2VTdHlsZXM/LmJhZGdlRm9yZWdyb3VuZCA/PyBjb2xvcnMuYmFkZ2VGb3JlZ3JvdW5kID8/IHRoZW1lLmdldENvbG9yKGJhZGdlRm9yZWdyb3VuZCk7XG5cdFx0XHRjb25zdCBiYWRnZUJnID0gYmFkZ2VTdHlsZXM/LmJhZGdlQmFja2dyb3VuZCA/PyBjb2xvcnMuYmFkZ2VCYWNrZ3JvdW5kID8/IHRoZW1lLmdldENvbG9yKGJhZGdlQmFja2dyb3VuZCk7XG5cdFx0XHRjb25zdCBjb250cmFzdEJvcmRlckNvbG9yID0gYmFkZ2VTdHlsZXM/LmJhZGdlQm9yZGVyID8/IHRoZW1lLmdldENvbG9yKGNvbnRyYXN0Qm9yZGVyKTtcblxuXHRcdFx0dGhpcy5iYWRnZUNvbnRlbnQuc3R5bGUuY29sb3IgPSBiYWRnZUZnID8gYmFkZ2VGZy50b1N0cmluZygpIDogJyc7XG5cdFx0XHR0aGlzLmJhZGdlQ29udGVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBiYWRnZUJnID8gYmFkZ2VCZy50b1N0cmluZygpIDogJyc7XG5cblx0XHRcdHRoaXMuYmFkZ2VDb250ZW50LnN0eWxlLmJvcmRlclN0eWxlID0gY29udHJhc3RCb3JkZXJDb2xvciAmJiAhdGhpcy5vcHRpb25zLmNvbXBhY3QgPyAnc29saWQnIDogJyc7XG5cdFx0XHR0aGlzLmJhZGdlQ29udGVudC5zdHlsZS5ib3JkZXJXaWR0aCA9IGNvbnRyYXN0Qm9yZGVyQ29sb3IgPyAnMXB4JyA6ICcnO1xuXHRcdFx0dGhpcy5iYWRnZUNvbnRlbnQuc3R5bGUuYm9yZGVyQ29sb3IgPSBjb250cmFzdEJvcmRlckNvbG9yID8gY29udHJhc3RCb3JkZXJDb2xvci50b1N0cmluZygpIDogJyc7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblxuXHRcdHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuaWNvbikge1xuXHRcdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LmFkZCgnaWNvbicpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLm9wdGlvbnMuaGFzUG9wdXApIHtcblx0XHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgncm9sZScsICdidXR0b24nKTtcblx0XHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1oYXNwb3B1cCcsICd0cnVlJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgncm9sZScsICd0YWInKTtcblx0XHR9XG5cblx0XHQvLyBUcnkgaGFyZCB0byBwcmV2ZW50IGtleWJvYXJkIG9ubHkgZm9jdXMgZmVlZGJhY2sgd2hlbiB1c2luZyBtb3VzZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmNvbnRhaW5lciwgRXZlbnRUeXBlLk1PVVNFX0RPV04sICgpID0+IHtcblx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2NsaWNrZWQnKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIEV2ZW50VHlwZS5NT1VTRV9VUCwgKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMubW91c2VVcFRpbWVvdXQpIHtcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMubW91c2VVcFRpbWVvdXQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm1vdXNlVXBUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2NsaWNrZWQnKTtcblx0XHRcdH0sIDgwMCk7IC8vIGRlbGF5ZWQgdG8gcHJldmVudCBmb2N1cyBmZWVkYmFjayBmcm9tIHNob3dpbmcgb24gbW91c2UgdXBcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cERlbGF5ZWRIb3Zlcih0aGlzLmNvbnRhaW5lciwgKCkgPT4gKHtcblx0XHRcdGNvbnRlbnQ6IHRoaXMuY29tcHV0ZVRpdGxlKCksXG5cdFx0XHRwb3NpdGlvbjoge1xuXHRcdFx0XHRob3ZlclBvc2l0aW9uOiB0aGlzLm9wdGlvbnMuaG92ZXJPcHRpb25zLnBvc2l0aW9uKCksXG5cdFx0XHR9LFxuXHRcdFx0cGVyc2lzdGVuY2U6IHtcblx0XHRcdFx0aGlkZU9uS2V5RG93bjogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRhcHBlYXJhbmNlOiB7XG5cdFx0XHRcdHNob3dQb2ludGVyOiB0cnVlLFxuXHRcdFx0XHRjb21wYWN0OiB0cnVlLFxuXHRcdFx0fVxuXHRcdH0pLCB7IGdyb3VwSWQ6ICdjb21wb3NpdGUtYmFyLWFjdGlvbnMnIH0pKTtcblxuXHRcdC8vIExhYmVsXG5cdFx0dGhpcy5sYWJlbCA9IGFwcGVuZChjb250YWluZXIsICQoJ2EnKSk7XG5cblx0XHQvLyBCYWRnZVxuXHRcdHRoaXMuYmFkZ2UgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcuYmFkZ2UnKSk7XG5cdFx0dGhpcy5iYWRnZUNvbnRlbnQgPSBhcHBlbmQodGhpcy5iYWRnZSwgJCgnLmJhZGdlLWNvbnRlbnQnKSk7XG5cblx0XHQvLyBwYW5lIGNvbXBvc2l0ZSBiYXIgYWN0aXZlIGJvcmRlciArIGJhY2tncm91bmRcblx0XHRhcHBlbmQoY29udGFpbmVyLCAkKCcuYWN0aXZlLWl0ZW0taW5kaWNhdG9yJykpO1xuXG5cdFx0aGlkZSh0aGlzLmJhZGdlKTtcblxuXHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0XHR0aGlzLnVwZGF0ZVRpdGxlKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uVGhlbWVDaGFuZ2UodGhlbWU6IElDb2xvclRoZW1lKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVMYWJlbCgpO1xuXHRcdHRoaXMudXBkYXRlQWN0aXZpdHkoKTtcblx0XHR0aGlzLnVwZGF0ZVRpdGxlKCk7XG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWN0aXZpdGllcygpOiBJQWN0aXZpdHlbXSB7XG5cdFx0aWYgKHRoaXMuX2FjdGlvbiBpbnN0YW5jZW9mIENvbXBvc2l0ZUJhckFjdGlvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FjdGlvbi5hY3Rpdml0aWVzO1xuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlQWN0aXZpdHkoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmJhZGdlIHx8ICF0aGlzLmJhZGdlQ29udGVudCB8fCAhKHRoaXMuX2FjdGlvbiBpbnN0YW5jZW9mIENvbXBvc2l0ZUJhckFjdGlvbikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB7IGJhZGdlcywgdHlwZSB9ID0gdGhpcy5nZXRWaXNpYmxlQmFkZ2VzKHRoaXMuZ2V0QWN0aXZpdGllcygpKTtcblxuXHRcdHRoaXMuYmFkZ2VEaXNwb3NhYmxlLnZhbHVlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y2xlYXJOb2RlKHRoaXMuYmFkZ2VDb250ZW50KTtcblx0XHRoaWRlKHRoaXMuYmFkZ2UpO1xuXG5cdFx0Y29uc3Qgc2hvdWxkUmVuZGVyQmFkZ2VzID0gdGhpcy5iYWRnZXNFbmFibGVkKHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCk7XG5cblx0XHRpZiAoYmFkZ2VzLmxlbmd0aCA+IDAgJiYgc2hvdWxkUmVuZGVyQmFkZ2VzKSB7XG5cblx0XHRcdGNvbnN0IGNsYXNzZXM6IHN0cmluZ1tdID0gW107XG5cblx0XHRcdGlmICh0aGlzLm9wdGlvbnMuY29tcGFjdCkge1xuXHRcdFx0XHRjbGFzc2VzLnB1c2goJ2NvbXBhY3QnKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUHJvZ3Jlc3Ncblx0XHRcdGlmICh0eXBlID09PSAncHJvZ3Jlc3MnKSB7XG5cdFx0XHRcdHNob3codGhpcy5iYWRnZSk7XG5cdFx0XHRcdGNsYXNzZXMucHVzaCgncHJvZ3Jlc3MtYmFkZ2UnKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTnVtYmVyXG5cdFx0XHRlbHNlIGlmICh0eXBlID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRjb25zdCB0b3RhbCA9IGJhZGdlcy5yZWR1Y2UoKHIsIGIpID0+IHIgKyAoYiBpbnN0YW5jZW9mIE51bWJlckJhZGdlID8gYi5udW1iZXIgOiAwKSwgMCk7XG5cdFx0XHRcdGlmICh0b3RhbCA+IDApIHtcblx0XHRcdFx0XHRsZXQgYmFkZ2VOdW1iZXIgPSB0b3RhbC50b1N0cmluZygpO1xuXHRcdFx0XHRcdGlmICh0b3RhbCA+IDk5OSkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgbm9PZlRob3VzYW5kcyA9IHRvdGFsIC8gMTAwMDtcblx0XHRcdFx0XHRcdGNvbnN0IGZsb29yID0gTWF0aC5mbG9vcihub09mVGhvdXNhbmRzKTtcblx0XHRcdFx0XHRcdGJhZGdlTnVtYmVyID0gbm9PZlRob3VzYW5kcyA+IGZsb29yID8gYCR7Zmxvb3J9SytgIDogYCR7bm9PZlRob3VzYW5kc31LYDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRoaXMub3B0aW9ucy5jb21wYWN0ICYmIGJhZGdlTnVtYmVyLmxlbmd0aCA+PSAzKSB7XG5cdFx0XHRcdFx0XHRjbGFzc2VzLnB1c2goJ2NvbXBhY3QtY29udGVudCcpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLmJhZGdlQ29udGVudC50ZXh0Q29udGVudCA9IGJhZGdlTnVtYmVyO1xuXHRcdFx0XHRcdHNob3codGhpcy5iYWRnZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSWNvblxuXHRcdFx0ZWxzZSBpZiAodHlwZSA9PT0gJ2ljb24nKSB7XG5cdFx0XHRcdGNsYXNzZXMucHVzaCgnaWNvbi1iYWRnZScpO1xuXHRcdFx0XHRjb25zdCBiYWRnZUNvbnRlbnRDbGFzc2VzcyA9IFsnaWNvbi1vdmVybGF5JywgLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoKGJhZGdlc1swXSBhcyBJY29uQmFkZ2UpLmljb24pXTtcblx0XHRcdFx0dGhpcy5iYWRnZUNvbnRlbnQuY2xhc3NMaXN0LmFkZCguLi5iYWRnZUNvbnRlbnRDbGFzc2Vzcyk7XG5cdFx0XHRcdHRoaXMuYmFkZ2VEaXNwb3NhYmxlLnZhbHVlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5iYWRnZUNvbnRlbnQ/LmNsYXNzTGlzdC5yZW1vdmUoLi4uYmFkZ2VDb250ZW50Q2xhc3Nlc3MpKSk7XG5cdFx0XHRcdHNob3codGhpcy5iYWRnZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjbGFzc2VzLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLmJhZGdlLmNsYXNzTGlzdC5hZGQoLi4uY2xhc3Nlcyk7XG5cdFx0XHRcdHRoaXMuYmFkZ2VEaXNwb3NhYmxlLnZhbHVlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5iYWRnZS5jbGFzc0xpc3QucmVtb3ZlKC4uLmNsYXNzZXMpKSk7XG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZVRpdGxlKCk7XG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VmlzaWJsZUJhZGdlcyhhY3Rpdml0aWVzOiBJQWN0aXZpdHlbXSk6IHsgYmFkZ2VzOiBJQmFkZ2VbXTsgdHlwZTogJ3Byb2dyZXNzJyB8ICdpY29uJyB8ICdudW1iZXInIHwgdW5kZWZpbmVkIH0ge1xuXHRcdGNvbnN0IHByb2dyZXNzQmFkZ2VzID0gYWN0aXZpdGllcy5maWx0ZXIoYWN0aXZpdHkgPT4gYWN0aXZpdHkuYmFkZ2UgaW5zdGFuY2VvZiBQcm9ncmVzc0JhZGdlKS5tYXAoYWN0aXZpdHkgPT4gYWN0aXZpdHkuYmFkZ2UpO1xuXHRcdGlmIChwcm9ncmVzc0JhZGdlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm4geyBiYWRnZXM6IHByb2dyZXNzQmFkZ2VzLCB0eXBlOiAncHJvZ3Jlc3MnIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgaWNvbkJhZGdlcyA9IGFjdGl2aXRpZXMuZmlsdGVyKGFjdGl2aXR5ID0+IGFjdGl2aXR5LmJhZGdlIGluc3RhbmNlb2YgSWNvbkJhZGdlKS5tYXAoYWN0aXZpdHkgPT4gYWN0aXZpdHkuYmFkZ2UpO1xuXHRcdGlmIChpY29uQmFkZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybiB7IGJhZGdlczogaWNvbkJhZGdlcywgdHlwZTogJ2ljb24nIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgbnVtYmVyQmFkZ2VzID0gYWN0aXZpdGllcy5maWx0ZXIoYWN0aXZpdHkgPT4gYWN0aXZpdHkuYmFkZ2UgaW5zdGFuY2VvZiBOdW1iZXJCYWRnZSkubWFwKGFjdGl2aXR5ID0+IGFjdGl2aXR5LmJhZGdlKTtcblx0XHRpZiAobnVtYmVyQmFkZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybiB7IGJhZGdlczogbnVtYmVyQmFkZ2VzLCB0eXBlOiAnbnVtYmVyJyB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGJhZGdlczogW10sIHR5cGU6IHVuZGVmaW5lZCB9O1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUxhYmVsKCk6IHZvaWQge1xuXHRcdHRoaXMubGFiZWwuY2xhc3NOYW1lID0gJ2FjdGlvbi1sYWJlbCc7XG5cblx0XHRpZiAodGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtLmNsYXNzTmFtZXMpIHtcblx0XHRcdHRoaXMubGFiZWwuY2xhc3NMaXN0LmFkZCguLi50aGlzLmNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0uY2xhc3NOYW1lcyk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMuaWNvbikge1xuXHRcdFx0dGhpcy5sYWJlbC50ZXh0Q29udGVudCA9IHRoaXMuYWN0aW9uLmxhYmVsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVGl0bGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgdGl0bGUgPSB0aGlzLmNvbXB1dGVUaXRsZSgpO1xuXHRcdFt0aGlzLmxhYmVsLCB0aGlzLmJhZGdlLCB0aGlzLmNvbnRhaW5lcl0uZm9yRWFjaChlbGVtZW50ID0+IHtcblx0XHRcdGlmIChlbGVtZW50KSB7XG5cdFx0XHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgdGl0bGUpO1xuXHRcdFx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnJyk7XG5cdFx0XHRcdGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCd0aXRsZScpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNvbXB1dGVUaXRsZSgpOiBzdHJpbmcge1xuXHRcdHRoaXMua2V5YmluZGluZ0xhYmVsID0gdGhpcy5jb21wdXRlS2V5YmluZGluZ0xhYmVsKCk7XG5cdFx0bGV0IHRpdGxlID0gdGhpcy5rZXliaW5kaW5nTGFiZWwgPyBsb2NhbGl6ZSgndGl0bGVLZXliaW5kaW5nJywgXCJ7MH0gKHsxfSlcIiwgdGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtLm5hbWUsIHRoaXMua2V5YmluZGluZ0xhYmVsKSA6IHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5uYW1lO1xuXG5cdFx0Y29uc3QgYmFkZ2VzID0gdGhpcy5nZXRWaXNpYmxlQmFkZ2VzKCh0aGlzLmFjdGlvbiBhcyBDb21wb3NpdGVCYXJBY3Rpb24pLmFjdGl2aXRpZXMpLmJhZGdlcztcblx0XHRmb3IgKGNvbnN0IGJhZGdlIG9mIGJhZGdlcykge1xuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb24gPSBiYWRnZS5nZXREZXNjcmlwdGlvbigpO1xuXHRcdFx0aWYgKCFkZXNjcmlwdGlvbikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHRpdGxlID0gYCR7dGl0bGV9IC0gJHtiYWRnZS5nZXREZXNjcmlwdGlvbigpfWA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRpdGxlO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wdXRlS2V5YmluZGluZ0xhYmVsKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB8IG51bGwge1xuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLmNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0ua2V5YmluZGluZ0lkID8gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5rZXliaW5kaW5nSWQpIDogbnVsbDtcblxuXHRcdHJldHVybiBrZXliaW5kaW5nPy5nZXRMYWJlbCgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHRpZiAodGhpcy5tb3VzZVVwVGltZW91dCkge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMubW91c2VVcFRpbWVvdXQpO1xuXHRcdH1cblxuXHRcdHRoaXMuYmFkZ2UucmVtb3ZlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbXBvc2l0ZU92ZXJmbG93QWN0aXZpdHlBY3Rpb24gZXh0ZW5kcyBDb21wb3NpdGVCYXJBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgc2hvd01lbnU6ICgpID0+IHZvaWRcblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdhZGRpdGlvbmFsQ29tcG9zaXRlcy5hY3Rpb24nLFxuXHRcdFx0bmFtZTogbG9jYWxpemUoJ2FkZGl0aW9uYWxWaWV3cycsIFwiQWRkaXRpb25hbCBWaWV3c1wiKSxcblx0XHRcdGNsYXNzTmFtZXM6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24ubW9yZSlcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnNob3dNZW51KCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbXBvc2l0ZU92ZXJmbG93QWN0aXZpdHlBY3Rpb25WaWV3SXRlbSBleHRlbmRzIENvbXBvc2l0ZUJhckFjdGlvblZpZXdJdGVtIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRhY3Rpb246IENvbXBvc2l0ZUJhckFjdGlvbixcblx0XHRwcml2YXRlIGdldE92ZXJmbG93aW5nQ29tcG9zaXRlczogKCkgPT4geyBpZDogc3RyaW5nOyBuYW1lPzogc3RyaW5nIH1bXSxcblx0XHRwcml2YXRlIGdldEFjdGl2ZUNvbXBvc2l0ZUlkOiAoKSA9PiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBnZXRCYWRnZTogKGNvbXBvc2l0ZUlkOiBzdHJpbmcpID0+IElCYWRnZSxcblx0XHRwcml2YXRlIGdldENvbXBvc2l0ZU9wZW5BY3Rpb246IChjb21wb3NpdGVJZDogc3RyaW5nKSA9PiBJQWN0aW9uLFxuXHRcdGNvbG9yczogKHRoZW1lOiBJQ29sb3JUaGVtZSkgPT4gSUNvbXBvc2l0ZUJhckNvbG9ycyxcblx0XHRob3Zlck9wdGlvbnM6IElBY3Rpdml0eUhvdmVyT3B0aW9ucyxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGFjdGlvbiwgeyBpY29uOiB0cnVlLCBjb2xvcnMsIGhhc1BvcHVwOiB0cnVlLCBob3Zlck9wdGlvbnMgfSwgKCkgPT4gdHJ1ZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSk7XG5cdH1cblxuXHRzaG93TWVudSgpOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiB0aGlzLmNvbnRhaW5lcixcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHRoaXMuZ2V0QWN0aW9ucygpLFxuXHRcdFx0Z2V0Q2hlY2tlZEFjdGlvbnNSZXByZXNlbnRhdGlvbjogKCkgPT4gJ3JhZGlvJyxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWN0aW9ucygpOiBJQWN0aW9uW10ge1xuXHRcdHJldHVybiB0aGlzLmdldE92ZXJmbG93aW5nQ29tcG9zaXRlcygpLm1hcChjb21wb3NpdGUgPT4ge1xuXHRcdFx0Y29uc3QgYWN0aW9uID0gdGhpcy5nZXRDb21wb3NpdGVPcGVuQWN0aW9uKGNvbXBvc2l0ZS5pZCk7XG5cdFx0XHRhY3Rpb24uY2hlY2tlZCA9IHRoaXMuZ2V0QWN0aXZlQ29tcG9zaXRlSWQoKSA9PT0gYWN0aW9uLmlkO1xuXG5cdFx0XHRjb25zdCBiYWRnZSA9IHRoaXMuZ2V0QmFkZ2UoY29tcG9zaXRlLmlkKTtcblx0XHRcdGxldCBzdWZmaXg6IHN0cmluZyB8IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChiYWRnZSBpbnN0YW5jZW9mIE51bWJlckJhZGdlKSB7XG5cdFx0XHRcdHN1ZmZpeCA9IGJhZGdlLm51bWJlcjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN1ZmZpeCkge1xuXHRcdFx0XHRhY3Rpb24ubGFiZWwgPSBsb2NhbGl6ZSgnbnVtYmVyQmFkZ2UnLCBcInswfSAoezF9KVwiLCBjb21wb3NpdGUubmFtZSwgc3VmZml4KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFjdGlvbi5sYWJlbCA9IGNvbXBvc2l0ZS5uYW1lIHx8ICcnO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gYWN0aW9uO1xuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wb3NpdGVBY3Rpb25WaWV3SXRlbSBleHRlbmRzIENvbXBvc2l0ZUJhckFjdGlvblZpZXdJdGVtIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJQ29tcG9zaXRlQmFyQWN0aW9uVmlld0l0ZW1PcHRpb25zLFxuXHRcdGNvbXBvc2l0ZUFjdGl2aXR5QWN0aW9uOiBDb21wb3NpdGVCYXJBY3Rpb24sXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0b2dnbGVDb21wb3NpdGVQaW5uZWRBY3Rpb246IElBY3Rpb24sXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0b2dnbGVDb21wb3NpdGVCYWRnZUFjdGlvbjogSUFjdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbXBvc2l0ZUNvbnRleHRNZW51QWN0aW9uc1Byb3ZpZGVyOiAoY29tcG9zaXRlSWQ6IHN0cmluZykgPT4gSUFjdGlvbltdLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVBY3Rpb25zUHJvdmlkZXI6ICgpID0+IElBY3Rpb25bXSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRuZEhhbmRsZXI6IElDb21wb3NpdGVEcmFnQW5kRHJvcCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbXBvc2l0ZUJhcjogSUNvbXBvc2l0ZUJhcixcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0Y29tcG9zaXRlQWN0aXZpdHlBY3Rpb24sXG5cdFx0XHRvcHRpb25zLFxuXHRcdFx0Y29tcG9zaXRlQmFyLmFyZUJhZGdlc0VuYWJsZWQuYmluZChjb21wb3NpdGVCYXIpLFxuXHRcdFx0dGhlbWVTZXJ2aWNlLFxuXHRcdFx0aG92ZXJTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRrZXliaW5kaW5nU2VydmljZVxuXHRcdCk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlcihjb250YWluZXIpO1xuXG5cdFx0dGhpcy51cGRhdGVDaGVja2VkKCk7XG5cdFx0dGhpcy51cGRhdGVFbmFibGVkKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIEV2ZW50VHlwZS5DT05URVhUX01FTlUsIGUgPT4ge1xuXHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblxuXHRcdFx0dGhpcy5zaG93Q29udGV4dE1lbnUoY29udGFpbmVyKTtcblx0XHR9KSk7XG5cblx0XHQvLyBBbGxvdyB0byBkcmFnXG5cdFx0bGV0IGluc2VydERyb3BCZWZvcmU6IEJlZm9yZTJEIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKENvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXIuSU5TVEFOQ0UucmVnaXN0ZXJEcmFnZ2FibGUodGhpcy5jb250YWluZXIsICgpID0+IHsgcmV0dXJuIHsgdHlwZTogJ2NvbXBvc2l0ZScsIGlkOiB0aGlzLmNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0uaWQgfTsgfSwge1xuXHRcdFx0b25EcmFnT3ZlcjogZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGlzVmFsaWRNb3ZlID0gZS5kcmFnQW5kRHJvcERhdGEuZ2V0RGF0YSgpLmlkICE9PSB0aGlzLmNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0uaWQgJiYgdGhpcy5kbmRIYW5kbGVyLm9uRHJhZ092ZXIoZS5kcmFnQW5kRHJvcERhdGEsIHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCwgZS5ldmVudERhdGEpO1xuXHRcdFx0XHR0b2dnbGVEcm9wRWZmZWN0KGUuZXZlbnREYXRhLmRhdGFUcmFuc2ZlciwgJ21vdmUnLCBpc1ZhbGlkTW92ZSk7XG5cdFx0XHRcdGluc2VydERyb3BCZWZvcmUgPSB0aGlzLnVwZGF0ZUZyb21EcmFnZ2luZyhjb250YWluZXIsIGlzVmFsaWRNb3ZlLCBlLmV2ZW50RGF0YSk7XG5cdFx0XHR9LFxuXHRcdFx0b25EcmFnTGVhdmU6IGUgPT4ge1xuXHRcdFx0XHRpbnNlcnREcm9wQmVmb3JlID0gdGhpcy51cGRhdGVGcm9tRHJhZ2dpbmcoY29udGFpbmVyLCBmYWxzZSwgZS5ldmVudERhdGEpO1xuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ0VuZDogZSA9PiB7XG5cdFx0XHRcdGluc2VydERyb3BCZWZvcmUgPSB0aGlzLnVwZGF0ZUZyb21EcmFnZ2luZyhjb250YWluZXIsIGZhbHNlLCBlLmV2ZW50RGF0YSk7XG5cdFx0XHR9LFxuXHRcdFx0b25Ecm9wOiBlID0+IHtcblx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLmV2ZW50RGF0YSwgdHJ1ZSk7XG5cdFx0XHRcdHRoaXMuZG5kSGFuZGxlci5kcm9wKGUuZHJhZ0FuZERyb3BEYXRhLCB0aGlzLmNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0uaWQsIGUuZXZlbnREYXRhLCBpbnNlcnREcm9wQmVmb3JlKTtcblx0XHRcdFx0aW5zZXJ0RHJvcEJlZm9yZSA9IHRoaXMudXBkYXRlRnJvbURyYWdnaW5nKGNvbnRhaW5lciwgZmFsc2UsIGUuZXZlbnREYXRhKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRyYWdTdGFydDogZSA9PiB7XG5cdFx0XHRcdGlmIChlLmRyYWdBbmREcm9wRGF0YS5nZXREYXRhKCkuaWQgIT09IHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChlLmV2ZW50RGF0YS5kYXRhVHJhbnNmZXIpIHtcblx0XHRcdFx0XHRlLmV2ZW50RGF0YS5kYXRhVHJhbnNmZXIuZWZmZWN0QWxsb3dlZCA9ICdtb3ZlJztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuYmx1cigpOyAvLyBSZW1vdmUgZm9jdXMgaW5kaWNhdG9yIHdoZW4gZHJhZ2dpbmdcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBBY3RpdmF0ZSBvbiBkcmFnIG92ZXIgdG8gcmV2ZWFsIHRhcmdldHNcblx0XHRbdGhpcy5iYWRnZSwgdGhpcy5sYWJlbF0uZm9yRWFjaChlbGVtZW50ID0+IHRoaXMuX3JlZ2lzdGVyKG5ldyBEZWxheWVkRHJhZ0hhbmRsZXIoZWxlbWVudCwgKCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLmFjdGlvbi5jaGVja2VkKSB7XG5cdFx0XHRcdHRoaXMuYWN0aW9uLnJ1bigpO1xuXHRcdFx0fVxuXHRcdH0pKSk7XG5cblx0XHR0aGlzLnVwZGF0ZVN0eWxlcygpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVGcm9tRHJhZ2dpbmcoZWxlbWVudDogSFRNTEVsZW1lbnQsIHNob3dGZWVkYmFjazogYm9vbGVhbiwgZXZlbnQ6IERyYWdFdmVudCk6IEJlZm9yZTJEIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRjb25zdCBwb3NYID0gZXZlbnQuY2xpZW50WDtcblx0XHRjb25zdCBwb3NZID0gZXZlbnQuY2xpZW50WTtcblx0XHRjb25zdCBoZWlnaHQgPSByZWN0LmJvdHRvbSAtIHJlY3QudG9wO1xuXHRcdGNvbnN0IHdpZHRoID0gcmVjdC5yaWdodCAtIHJlY3QubGVmdDtcblxuXHRcdGNvbnN0IGZvcmNlVG9wID0gcG9zWSA8PSByZWN0LnRvcCArIGhlaWdodCAqIDAuNDtcblx0XHRjb25zdCBmb3JjZUJvdHRvbSA9IHBvc1kgPiByZWN0LmJvdHRvbSAtIGhlaWdodCAqIDAuNDtcblx0XHRjb25zdCBwcmVmZXJUb3AgPSBwb3NZIDw9IHJlY3QudG9wICsgaGVpZ2h0ICogMC41O1xuXG5cdFx0Y29uc3QgZm9yY2VMZWZ0ID0gcG9zWCA8PSByZWN0LmxlZnQgKyB3aWR0aCAqIDAuNDtcblx0XHRjb25zdCBmb3JjZVJpZ2h0ID0gcG9zWCA+IHJlY3QucmlnaHQgLSB3aWR0aCAqIDAuNDtcblx0XHRjb25zdCBwcmVmZXJMZWZ0ID0gcG9zWCA8PSByZWN0LmxlZnQgKyB3aWR0aCAqIDAuNTtcblxuXHRcdGNvbnN0IGNsYXNzZXMgPSBlbGVtZW50LmNsYXNzTGlzdDtcblx0XHRjb25zdCBsYXN0Q2xhc3NlcyA9IHtcblx0XHRcdHZlcnRpY2FsOiBjbGFzc2VzLmNvbnRhaW5zKCd0b3AnKSA/ICd0b3AnIDogKGNsYXNzZXMuY29udGFpbnMoJ2JvdHRvbScpID8gJ2JvdHRvbScgOiB1bmRlZmluZWQpLFxuXHRcdFx0aG9yaXpvbnRhbDogY2xhc3Nlcy5jb250YWlucygnbGVmdCcpID8gJ2xlZnQnIDogKGNsYXNzZXMuY29udGFpbnMoJ3JpZ2h0JykgPyAncmlnaHQnIDogdW5kZWZpbmVkKVxuXHRcdH07XG5cblx0XHRjb25zdCB0b3AgPSBmb3JjZVRvcCB8fCAocHJlZmVyVG9wICYmICFsYXN0Q2xhc3Nlcy52ZXJ0aWNhbCkgfHwgKCFmb3JjZUJvdHRvbSAmJiBsYXN0Q2xhc3Nlcy52ZXJ0aWNhbCA9PT0gJ3RvcCcpO1xuXHRcdGNvbnN0IGJvdHRvbSA9IGZvcmNlQm90dG9tIHx8ICghcHJlZmVyVG9wICYmICFsYXN0Q2xhc3Nlcy52ZXJ0aWNhbCkgfHwgKCFmb3JjZVRvcCAmJiBsYXN0Q2xhc3Nlcy52ZXJ0aWNhbCA9PT0gJ2JvdHRvbScpO1xuXHRcdGNvbnN0IGxlZnQgPSBmb3JjZUxlZnQgfHwgKHByZWZlckxlZnQgJiYgIWxhc3RDbGFzc2VzLmhvcml6b250YWwpIHx8ICghZm9yY2VSaWdodCAmJiBsYXN0Q2xhc3Nlcy5ob3Jpem9udGFsID09PSAnbGVmdCcpO1xuXHRcdGNvbnN0IHJpZ2h0ID0gZm9yY2VSaWdodCB8fCAoIXByZWZlckxlZnQgJiYgIWxhc3RDbGFzc2VzLmhvcml6b250YWwpIHx8ICghZm9yY2VMZWZ0ICYmIGxhc3RDbGFzc2VzLmhvcml6b250YWwgPT09ICdyaWdodCcpO1xuXG5cdFx0ZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCd0b3AnLCBzaG93RmVlZGJhY2sgJiYgdG9wKTtcblx0XHRlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2JvdHRvbScsIHNob3dGZWVkYmFjayAmJiBib3R0b20pO1xuXHRcdGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnbGVmdCcsIHNob3dGZWVkYmFjayAmJiBsZWZ0KTtcblx0XHRlbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ3JpZ2h0Jywgc2hvd0ZlZWRiYWNrICYmIHJpZ2h0KTtcblxuXHRcdGlmICghc2hvd0ZlZWRiYWNrKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IHZlcnRpY2FsbHlCZWZvcmU6IHRvcCwgaG9yaXpvbnRhbGx5QmVmb3JlOiBsZWZ0IH07XG5cdH1cblxuXHRwcml2YXRlIHNob3dDb250ZXh0TWVudShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cblx0XHRpZiAodGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtLmtleWJpbmRpbmdJZCkge1xuXHRcdFx0YWN0aW9ucy5wdXNoKGNyZWF0ZUNvbmZpZ3VyZUtleWJpbmRpbmdBY3Rpb24odGhpcy5jb21tYW5kU2VydmljZSwgdGhpcy5rZXliaW5kaW5nU2VydmljZSwgdGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtLmtleWJpbmRpbmdJZCkpO1xuXHRcdH1cblxuXHRcdGFjdGlvbnMucHVzaCh0aGlzLnRvZ2dsZUNvbXBvc2l0ZVBpbm5lZEFjdGlvbiwgdGhpcy50b2dnbGVDb21wb3NpdGVCYWRnZUFjdGlvbik7XG5cblx0XHRjb25zdCBjb21wb3NpdGVDb250ZXh0TWVudUFjdGlvbnMgPSB0aGlzLmNvbXBvc2l0ZUNvbnRleHRNZW51QWN0aW9uc1Byb3ZpZGVyKHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCk7XG5cdFx0aWYgKGNvbXBvc2l0ZUNvbnRleHRNZW51QWN0aW9ucy5sZW5ndGgpIHtcblx0XHRcdGFjdGlvbnMucHVzaCguLi5jb21wb3NpdGVDb250ZXh0TWVudUFjdGlvbnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzUGlubmVkID0gdGhpcy5jb21wb3NpdGVCYXIuaXNQaW5uZWQodGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtLmlkKTtcblx0XHRpZiAoaXNQaW5uZWQpIHtcblx0XHRcdHRoaXMudG9nZ2xlQ29tcG9zaXRlUGlubmVkQWN0aW9uLmxhYmVsID0gbG9jYWxpemUoJ2hpZGUnLCBcIkhpZGUgJ3swfSdcIiwgdGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtLm5hbWUpO1xuXHRcdFx0dGhpcy50b2dnbGVDb21wb3NpdGVQaW5uZWRBY3Rpb24uY2hlY2tlZCA9IGZhbHNlO1xuXHRcdFx0dGhpcy50b2dnbGVDb21wb3NpdGVQaW5uZWRBY3Rpb24uZW5hYmxlZCA9IHRoaXMuY29tcG9zaXRlQmFyLmdldFBpbm5lZENvbXBvc2l0ZUlkcygpLmxlbmd0aCA+IDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudG9nZ2xlQ29tcG9zaXRlUGlubmVkQWN0aW9uLmxhYmVsID0gbG9jYWxpemUoJ2tlZXAnLCBcIktlZXAgJ3swfSdcIiwgdGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtLm5hbWUpO1xuXHRcdFx0dGhpcy50b2dnbGVDb21wb3NpdGVQaW5uZWRBY3Rpb24uZW5hYmxlZCA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNCYWRnZUVuYWJsZWQgPSB0aGlzLmNvbXBvc2l0ZUJhci5hcmVCYWRnZXNFbmFibGVkKHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCk7XG5cdFx0aWYgKGlzQmFkZ2VFbmFibGVkKSB7XG5cdFx0XHR0aGlzLnRvZ2dsZUNvbXBvc2l0ZUJhZGdlQWN0aW9uLmxhYmVsID0gbG9jYWxpemUoJ2hpZGVCYWRnZScsIFwiSGlkZSBCYWRnZVwiKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50b2dnbGVDb21wb3NpdGVCYWRnZUFjdGlvbi5sYWJlbCA9IGxvY2FsaXplKCdzaG93QmFkZ2UnLCBcIlNob3cgQmFkZ2VcIik7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3RoZXJBY3Rpb25zID0gdGhpcy5jb250ZXh0TWVudUFjdGlvbnNQcm92aWRlcigpO1xuXHRcdGlmIChvdGhlckFjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0XHRcdGFjdGlvbnMucHVzaCguLi5vdGhlckFjdGlvbnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVsZW1lbnRQb3NpdGlvbiA9IGdldERvbU5vZGVQYWdlUG9zaXRpb24oY29udGFpbmVyKTtcblx0XHRjb25zdCBhbmNob3IgPSB7XG5cdFx0XHR4OiBNYXRoLmZsb29yKGVsZW1lbnRQb3NpdGlvbi5sZWZ0ICsgKGVsZW1lbnRQb3NpdGlvbi53aWR0aCAvIDIpKSxcblx0XHRcdHk6IGVsZW1lbnRQb3NpdGlvbi50b3AgKyBlbGVtZW50UG9zaXRpb24uaGVpZ2h0XG5cdFx0fTtcblxuXHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IGFuY2hvcixcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnMsXG5cdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCkgPT4gdGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtLmlkXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlQ2hlY2tlZCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5hY3Rpb24uY2hlY2tlZCkge1xuXHRcdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LmFkZCgnY2hlY2tlZCcpO1xuXHRcdFx0dGhpcy5jb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgdGhpcy5nZXRUb29sdGlwKCkgPz8gdGhpcy5jb250YWluZXIudGl0bGUpO1xuXHRcdFx0dGhpcy5jb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcblx0XHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2NoZWNrZWQnKTtcblx0XHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRoaXMuZ2V0VG9vbHRpcCgpID8/IHRoaXMuY29udGFpbmVyLnRpdGxlKTtcblx0XHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xuXHRcdFx0dGhpcy5jb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVFbmFibGVkKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5lbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuYWN0aW9uLmVuYWJsZWQpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdkaXNhYmxlZCcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZGlzYWJsZWQnKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMubGFiZWwucmVtb3ZlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRvZ2dsZUNvbXBvc2l0ZVBpbm5lZEFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBhY3Rpdml0eTogSUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0gfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBjb21wb3NpdGVCYXI6IElDb21wb3NpdGVCYXJcblx0KSB7XG5cdFx0c3VwZXIoJ3Nob3cudG9nZ2xlQ29tcG9zaXRlUGlubmVkJywgYWN0aXZpdHkgPyBhY3Rpdml0eS5uYW1lIDogbG9jYWxpemUoJ3RvZ2dsZScsIFwiVG9nZ2xlIFZpZXcgUGlubmVkXCIpKTtcblxuXHRcdHRoaXMuY2hlY2tlZCA9ICEhdGhpcy5hY3Rpdml0eSAmJiB0aGlzLmNvbXBvc2l0ZUJhci5pc1Bpbm5lZCh0aGlzLmFjdGl2aXR5LmlkKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihjb250ZXh0OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpZCA9IHRoaXMuYWN0aXZpdHkgPyB0aGlzLmFjdGl2aXR5LmlkIDogY29udGV4dDtcblxuXHRcdGlmICh0aGlzLmNvbXBvc2l0ZUJhci5pc1Bpbm5lZChpZCkpIHtcblx0XHRcdHRoaXMuY29tcG9zaXRlQmFyLnVucGluKGlkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jb21wb3NpdGVCYXIucGluKGlkKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRvZ2dsZUNvbXBvc2l0ZUJhZGdlQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBjb21wb3NpdGVCYXJBY3Rpb25JdGVtOiBJQ29tcG9zaXRlQmFyQWN0aW9uSXRlbSB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIGNvbXBvc2l0ZUJhcjogSUNvbXBvc2l0ZUJhclxuXHQpIHtcblx0XHRzdXBlcignc2hvdy50b2dnbGVDb21wb3NpdGVCYWRnZScsIGNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0gPyBjb21wb3NpdGVCYXJBY3Rpb25JdGVtLm5hbWUgOiBsb2NhbGl6ZSgndG9nZ2xlQmFkZ2UnLCBcIlRvZ2dsZSBWaWV3IEJhZGdlXCIpKTtcblxuXHRcdHRoaXMuY2hlY2tlZCA9IGZhbHNlO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGNvbnRleHQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGlkID0gdGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtID8gdGhpcy5jb21wb3NpdGVCYXJBY3Rpb25JdGVtLmlkIDogY29udGV4dDtcblx0XHR0aGlzLmNvbXBvc2l0ZUJhci50b2dnbGVCYWRnZUVuYWJsZW1lbnQoaWQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTd2l0Y2hDb21wb3NpdGVWaWV3QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb2Zmc2V0OiBudW1iZXJcblx0KSB7XG5cdFx0c3VwZXIoZGVzYyk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwYW5lQ29tcG9zaXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGFjdGl2ZUNvbXBvc2l0ZSA9IHBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUodGhpcy5sb2NhdGlvbik7XG5cdFx0aWYgKCFhY3RpdmVDb21wb3NpdGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgdGFyZ2V0Q29tcG9zaXRlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IHZpc2libGVDb21wb3NpdGVJZHMgPSBwYW5lQ29tcG9zaXRlU2VydmljZS5nZXRWaXNpYmxlUGFuZUNvbXBvc2l0ZUlkcyh0aGlzLmxvY2F0aW9uKTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHZpc2libGVDb21wb3NpdGVJZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICh2aXNpYmxlQ29tcG9zaXRlSWRzW2ldID09PSBhY3RpdmVDb21wb3NpdGUuZ2V0SWQoKSkge1xuXHRcdFx0XHR0YXJnZXRDb21wb3NpdGVJZCA9IHZpc2libGVDb21wb3NpdGVJZHNbKGkgKyB2aXNpYmxlQ29tcG9zaXRlSWRzLmxlbmd0aCArIHRoaXMub2Zmc2V0KSAlIHZpc2libGVDb21wb3NpdGVJZHMubGVuZ3RoXTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiB0YXJnZXRDb21wb3NpdGVJZCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGF3YWl0IHBhbmVDb21wb3NpdGVTZXJ2aWNlLm9wZW5QYW5lQ29tcG9zaXRlKHRhcmdldENvbXBvc2l0ZUlkLCB0aGlzLmxvY2F0aW9uLCB0cnVlKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxRQUFpQixpQkFBaUI7QUFDM0MsU0FBUyxHQUFHLHVCQUF1QixRQUFRLFdBQVcsYUFBYSxXQUFXLHdCQUF3QixNQUFNLFlBQVk7QUFDeEgsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxjQUFjLGlCQUFpQix5QkFBeUI7QUFDakUsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxxQkFBa0M7QUFDM0MsU0FBUyxhQUFnQyxlQUFlLGlCQUFpQjtBQUN6RSxTQUFTLDZCQUErQztBQUN4RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLDhCQUErRCx3QkFBd0I7QUFFaEcsU0FBUywwQkFBa0Q7QUFDM0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBR3RDLFNBQVMsaUJBQWlCLGlCQUFpQixzQkFBc0I7QUFDakUsU0FBUyxlQUFnQztBQUV6QyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLHVDQUF1QztBQWtEekMsTUFBTSwyQkFBMkIsT0FBTztBQUFBLEVBVTlDLFlBQW9CLE1BQStCO0FBQ2xELFVBQU0sS0FBSyxJQUFJLEtBQUssTUFBTSxLQUFLLFlBQVksS0FBSyxHQUFHLEdBQUcsSUFBSTtBQUR2QztBQVJwQixTQUFpQixxQ0FBcUMsS0FBSyxVQUFVLElBQUksUUFBNEIsQ0FBQztBQUN0RyxTQUFTLG9DQUFvQyxLQUFLLG1DQUFtQztBQUVyRixTQUFpQix1QkFBdUIsS0FBSyxVQUFVLElBQUksUUFBcUIsQ0FBQztBQUNqRixTQUFTLHNCQUFzQixLQUFLLHFCQUFxQjtBQUV6RCxTQUFRLGNBQTJCLENBQUM7QUFBQSxFQUlwQztBQUFB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
