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
import "./media/notificationsCenter.css";
import "./media/notificationsActions.css";
import { NOTIFICATIONS_CENTER_HEADER_FOREGROUND, NOTIFICATIONS_CENTER_HEADER_BACKGROUND, NOTIFICATIONS_CENTER_BORDER } from "../../../common/theme.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { NotificationChangeType, NotificationViewItemContentChangeKind } from "../../../common/notifications.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { Emitter } from "../../../../base/common/event.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { NotificationActionRunner } from "./notificationsCommands.js";
import { NotificationsList } from "./notificationsList.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { $, Dimension, isAncestorOfActiveElement } from "../../../../base/browser/dom.js";
import { widgetShadow } from "../../../../platform/theme/common/colorRegistry.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { localize } from "../../../../nls.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ClearAllNotificationsAction, ConfigureDoNotDisturbAction, ToggleDoNotDisturbBySourceAction, HideNotificationsCenterAction, ToggleDoNotDisturbAction } from "./notificationsActions.js";
import { Separator, toAction } from "../../../../base/common/actions.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { assertAllDefined, assertIsDefined } from "../../../../base/common/types.js";
import { NotificationsCenterVisibleContext } from "../../../common/contextkeys.js";
import { INotificationService, NotificationsFilter } from "../../../../platform/notification/common/notification.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
let NotificationsCenter = class extends Themable {
  constructor(container, model, themeService, instantiationService, layoutService, contextKeyService, editorGroupService, keybindingService, notificationService, accessibilitySignalService, contextMenuService) {
    super(themeService);
    this.container = container;
    this.model = model;
    this.instantiationService = instantiationService;
    this.layoutService = layoutService;
    this.editorGroupService = editorGroupService;
    this.keybindingService = keybindingService;
    this.notificationService = notificationService;
    this.accessibilitySignalService = accessibilitySignalService;
    this.contextMenuService = contextMenuService;
    // maximum number of notification sources to show in configure dropdown
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this.notificationsCenterVisibleContextKey = NotificationsCenterVisibleContext.bindTo(contextKeyService);
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.model.onDidChangeNotification((e) => this.onDidChangeNotification(e)));
    this._register(this.layoutService.onDidLayoutMainContainer((dimension) => this.layout(Dimension.lift(dimension))));
    this._register(this.notificationService.onDidChangeFilter(() => this.onDidChangeFilter()));
  }
  onDidChangeFilter() {
    if (this.notificationService.getFilter() === NotificationsFilter.ERROR) {
      this.hide();
    }
  }
  get isVisible() {
    return !!this._isVisible;
  }
  show() {
    if (this._isVisible) {
      const notificationsList2 = assertIsDefined(this.notificationsList);
      notificationsList2.show();
      notificationsList2.focusFirst();
      return;
    }
    if (!this.notificationsCenterContainer) {
      this.create();
    }
    this.updateTitle();
    const [notificationsList, notificationsCenterContainer] = assertAllDefined(this.notificationsList, this.notificationsCenterContainer);
    this._isVisible = true;
    notificationsCenterContainer.classList.add("visible");
    notificationsList.show();
    this.layout(this.workbenchDimensions);
    notificationsList.updateNotificationsList(0, 0, this.model.notifications);
    notificationsList.focusFirst();
    this.updateStyles();
    this.model.notifications.forEach((notification) => notification.updateVisibility(true));
    this.notificationsCenterVisibleContextKey.set(true);
    this._onDidChangeVisibility.fire();
  }
  updateTitle() {
    const [notificationsCenterTitle, clearAllAction] = assertAllDefined(this.notificationsCenterTitle, this.clearAllAction);
    if (this.model.notifications.length === 0) {
      notificationsCenterTitle.textContent = localize("notificationsEmpty", "No new notifications");
      clearAllAction.enabled = false;
    } else {
      notificationsCenterTitle.textContent = localize("notifications", "Notifications");
      clearAllAction.enabled = this.model.notifications.some((notification) => !notification.hasProgress);
    }
  }
  create() {
    this.notificationsCenterContainer = $(".notifications-center");
    this.notificationsCenterHeader = $(".notifications-center-header");
    this.notificationsCenterContainer.appendChild(this.notificationsCenterHeader);
    this.notificationsCenterTitle = $("span.notifications-center-header-title");
    this.notificationsCenterHeader.appendChild(this.notificationsCenterTitle);
    const toolbarContainer = $(".notifications-center-header-toolbar");
    this.notificationsCenterHeader.appendChild(toolbarContainer);
    const actionRunner = this._register(this.instantiationService.createInstance(NotificationActionRunner));
    const that = this;
    const notificationsToolBar = this._register(new ActionBar(toolbarContainer, {
      ariaLabel: localize("notificationsToolbar", "Notification Center Actions"),
      actionRunner,
      actionViewItemProvider: (action, options) => {
        if (action.id === ConfigureDoNotDisturbAction.ID) {
          return this._register(this.instantiationService.createInstance(DropdownMenuActionViewItem, action, {
            getActions() {
              const actions = [toAction({
                id: ToggleDoNotDisturbAction.ID,
                label: that.notificationService.getFilter() === NotificationsFilter.OFF ? localize("turnOnNotifications", "Enable Do Not Disturb Mode") : localize("turnOffNotifications", "Disable Do Not Disturb Mode"),
                run: () => that.notificationService.setFilter(that.notificationService.getFilter() === NotificationsFilter.OFF ? NotificationsFilter.ERROR : NotificationsFilter.OFF)
              })];
              const sortedFilters = that.notificationService.getFilters().sort((a, b) => a.label.localeCompare(b.label));
              for (const source of sortedFilters.slice(0, NotificationsCenter.MAX_NOTIFICATION_SOURCES)) {
                if (actions.length === 1) {
                  actions.push(new Separator());
                }
                actions.push(toAction({
                  id: `${ToggleDoNotDisturbAction.ID}.${source.id}`,
                  label: source.label,
                  checked: source.filter !== NotificationsFilter.ERROR,
                  run: () => that.notificationService.setFilter({
                    ...source,
                    filter: source.filter === NotificationsFilter.ERROR ? NotificationsFilter.OFF : NotificationsFilter.ERROR
                  })
                }));
              }
              if (sortedFilters.length > NotificationsCenter.MAX_NOTIFICATION_SOURCES) {
                actions.push(new Separator());
                actions.push(that._register(that.instantiationService.createInstance(ToggleDoNotDisturbBySourceAction, ToggleDoNotDisturbBySourceAction.ID, localize("moreSources", "More\u2026"))));
              }
              return actions;
            }
          }, this.contextMenuService, {
            ...options,
            actionRunner,
            classNames: action.class,
            keybindingProvider: (action2) => this.keybindingService.lookupKeybinding(action2.id)
          }));
        }
        return void 0;
      }
    }));
    this.clearAllAction = this._register(this.instantiationService.createInstance(ClearAllNotificationsAction, ClearAllNotificationsAction.ID, ClearAllNotificationsAction.LABEL));
    notificationsToolBar.push(this.clearAllAction, { icon: true, label: false, keybinding: this.getKeybindingLabel(this.clearAllAction) });
    this.configureDoNotDisturbAction = this._register(this.instantiationService.createInstance(ConfigureDoNotDisturbAction, ConfigureDoNotDisturbAction.ID, ConfigureDoNotDisturbAction.LABEL));
    notificationsToolBar.push(this.configureDoNotDisturbAction, { icon: true, label: false });
    const hideAllAction = this._register(this.instantiationService.createInstance(HideNotificationsCenterAction, HideNotificationsCenterAction.ID, HideNotificationsCenterAction.LABEL));
    notificationsToolBar.push(hideAllAction, { icon: true, label: false, keybinding: this.getKeybindingLabel(hideAllAction) });
    this.notificationsList = this.instantiationService.createInstance(NotificationsList, this.notificationsCenterContainer, {
      widgetAriaLabel: localize("notificationsCenterWidgetAriaLabel", "Notifications Center")
    });
    this.container.appendChild(this.notificationsCenterContainer);
  }
  getKeybindingLabel(action) {
    const keybinding = this.keybindingService.lookupKeybinding(action.id);
    return keybinding ? keybinding.getLabel() : null;
  }
  onDidChangeNotification(e) {
    if (!this._isVisible) {
      return;
    }
    let focusEditor = false;
    const [notificationsList, notificationsCenterContainer] = assertAllDefined(this.notificationsList, this.notificationsCenterContainer);
    switch (e.kind) {
      case NotificationChangeType.ADD:
        notificationsList.updateNotificationsList(e.index, 0, [e.item]);
        e.item.updateVisibility(true);
        break;
      case NotificationChangeType.CHANGE:
        switch (e.detail) {
          case NotificationViewItemContentChangeKind.ACTIONS:
            notificationsList.updateNotificationsList(e.index, 1, [e.item]);
            break;
          case NotificationViewItemContentChangeKind.MESSAGE:
            if (e.item.expanded) {
              notificationsList.updateNotificationHeight(e.item);
            }
            break;
        }
        break;
      case NotificationChangeType.EXPAND_COLLAPSE:
        notificationsList.updateNotificationsList(e.index, 1, [e.item]);
        break;
      case NotificationChangeType.REMOVE:
        focusEditor = isAncestorOfActiveElement(notificationsCenterContainer);
        notificationsList.updateNotificationsList(e.index, 1);
        e.item.updateVisibility(false);
        break;
    }
    this.updateTitle();
    if (this.model.notifications.length === 0) {
      this.hide();
      if (focusEditor) {
        this.editorGroupService.activeGroup.focus();
      }
    }
  }
  hide() {
    if (!this._isVisible || !this.notificationsCenterContainer || !this.notificationsList) {
      return;
    }
    const focusEditor = isAncestorOfActiveElement(this.notificationsCenterContainer);
    this._isVisible = false;
    this.notificationsCenterContainer.classList.remove("visible");
    this.notificationsList.hide();
    this.model.notifications.forEach((notification) => notification.updateVisibility(false));
    this.notificationsCenterVisibleContextKey.set(false);
    this._onDidChangeVisibility.fire();
    if (focusEditor) {
      this.editorGroupService.activeGroup.focus();
    }
  }
  updateStyles() {
    if (this.notificationsCenterContainer && this.notificationsCenterHeader) {
      const widgetShadowColor = this.getColor(widgetShadow);
      this.notificationsCenterContainer.style.boxShadow = widgetShadowColor ? `0 0 8px 2px ${widgetShadowColor}` : "";
      const borderColor = this.getColor(NOTIFICATIONS_CENTER_BORDER);
      this.notificationsCenterContainer.style.border = borderColor ? `1px solid ${borderColor}` : "";
      const headerForeground = this.getColor(NOTIFICATIONS_CENTER_HEADER_FOREGROUND);
      this.notificationsCenterHeader.style.color = headerForeground ?? "";
      const headerBackground = this.getColor(NOTIFICATIONS_CENTER_HEADER_BACKGROUND);
      this.notificationsCenterHeader.style.background = headerBackground ?? "";
    }
  }
  layout(dimension) {
    this.workbenchDimensions = dimension;
    if (this._isVisible && this.notificationsCenterContainer) {
      const maxWidth = NotificationsCenter.MAX_DIMENSIONS.width;
      const maxHeight = NotificationsCenter.MAX_DIMENSIONS.height;
      let availableWidth = maxWidth;
      let availableHeight = maxHeight;
      if (this.workbenchDimensions) {
        availableWidth = this.workbenchDimensions.width;
        availableWidth -= 2 * 8;
        availableHeight = this.workbenchDimensions.height - 35;
        if (this.layoutService.isVisible(Parts.STATUSBAR_PART, mainWindow)) {
          availableHeight -= 22;
        }
        if (this.layoutService.isVisible(Parts.TITLEBAR_PART, mainWindow)) {
          availableHeight -= 22;
        }
        availableHeight -= 2 * 12;
      }
      const notificationsList = assertIsDefined(this.notificationsList);
      notificationsList.layout(Math.min(maxWidth, availableWidth), Math.min(maxHeight, availableHeight));
    }
  }
  clearAll() {
    this.hide();
    for (const notification of [...this.model.notifications]) {
      if (!notification.hasProgress) {
        notification.close();
      }
      this.accessibilitySignalService.playSignal(AccessibilitySignal.clear);
    }
  }
};
NotificationsCenter.MAX_DIMENSIONS = new Dimension(450, 400);
NotificationsCenter.MAX_NOTIFICATION_SOURCES = 10;
NotificationsCenter = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IWorkbenchLayoutService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IEditorGroupsService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, IAccessibilitySignalService),
  __decorateParam(10, IContextMenuService)
], NotificationsCenter);
export {
  NotificationsCenter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9ub3RpZmljYXRpb25zL25vdGlmaWNhdGlvbnNDZW50ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvbm90aWZpY2F0aW9uc0NlbnRlci5jc3MnO1xuaW1wb3J0ICcuL21lZGlhL25vdGlmaWNhdGlvbnNBY3Rpb25zLmNzcyc7XG5pbXBvcnQgeyBOT1RJRklDQVRJT05TX0NFTlRFUl9IRUFERVJfRk9SRUdST1VORCwgTk9USUZJQ0FUSU9OU19DRU5URVJfSEVBREVSX0JBQ0tHUk9VTkQsIE5PVElGSUNBVElPTlNfQ0VOVEVSX0JPUkRFUiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlLCBUaGVtYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvbnNNb2RlbCwgSU5vdGlmaWNhdGlvbkNoYW5nZUV2ZW50LCBOb3RpZmljYXRpb25DaGFuZ2VUeXBlLCBOb3RpZmljYXRpb25WaWV3SXRlbUNvbnRlbnRDaGFuZ2VLaW5kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGlmaWNhdGlvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIFBhcnRzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uc0NlbnRlckNvbnRyb2xsZXIsIE5vdGlmaWNhdGlvbkFjdGlvblJ1bm5lciB9IGZyb20gJy4vbm90aWZpY2F0aW9uc0NvbW1hbmRzLmpzJztcbmltcG9ydCB7IE5vdGlmaWNhdGlvbnNMaXN0IH0gZnJvbSAnLi9ub3RpZmljYXRpb25zTGlzdC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7ICQsIERpbWVuc2lvbiwgaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgd2lkZ2V0U2hhZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgQ2xlYXJBbGxOb3RpZmljYXRpb25zQWN0aW9uLCBDb25maWd1cmVEb05vdERpc3R1cmJBY3Rpb24sIFRvZ2dsZURvTm90RGlzdHVyYkJ5U291cmNlQWN0aW9uLCBIaWRlTm90aWZpY2F0aW9uc0NlbnRlckFjdGlvbiwgVG9nZ2xlRG9Ob3REaXN0dXJiQWN0aW9uIH0gZnJvbSAnLi9ub3RpZmljYXRpb25zQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBTZXBhcmF0b3IsIHRvQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IGFzc2VydEFsbERlZmluZWQsIGFzc2VydElzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IE5vdGlmaWNhdGlvbnNDZW50ZXJWaXNpYmxlQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgTm90aWZpY2F0aW9uc0ZpbHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IERyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2Ryb3Bkb3duL2Ryb3Bkb3duQWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIE5vdGlmaWNhdGlvbnNDZW50ZXIgZXh0ZW5kcyBUaGVtYWJsZSBpbXBsZW1lbnRzIElOb3RpZmljYXRpb25zQ2VudGVyQ29udHJvbGxlciB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTUFYX0RJTUVOU0lPTlMgPSBuZXcgRGltZW5zaW9uKDQ1MCwgNDAwKTtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNQVhfTk9USUZJQ0FUSU9OX1NPVVJDRVMgPSAxMDsgLy8gbWF4aW11bSBudW1iZXIgb2Ygbm90aWZpY2F0aW9uIHNvdXJjZXMgdG8gc2hvdyBpbiBjb25maWd1cmUgZHJvcGRvd25cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpc2liaWxpdHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gdGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmV2ZW50O1xuXG5cdHByaXZhdGUgbm90aWZpY2F0aW9uc0NlbnRlckNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbm90aWZpY2F0aW9uc0NlbnRlckhlYWRlcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbm90aWZpY2F0aW9uc0NlbnRlclRpdGxlOiBIVE1MU3BhbkVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbm90aWZpY2F0aW9uc0xpc3Q6IE5vdGlmaWNhdGlvbnNMaXN0IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9pc1Zpc2libGU6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgd29ya2JlbmNoRGltZW5zaW9uczogRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvbnNDZW50ZXJWaXNpYmxlQ29udGV4dEtleTtcblx0cHJpdmF0ZSBjbGVhckFsbEFjdGlvbjogQ2xlYXJBbGxOb3RpZmljYXRpb25zQWN0aW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvbmZpZ3VyZURvTm90RGlzdHVyYkFjdGlvbjogQ29uZmlndXJlRG9Ob3REaXN0dXJiQWN0aW9uIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsOiBJTm90aWZpY2F0aW9uc01vZGVsLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcih0aGVtZVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5ub3RpZmljYXRpb25zQ2VudGVyVmlzaWJsZUNvbnRleHRLZXkgPSBOb3RpZmljYXRpb25zQ2VudGVyVmlzaWJsZUNvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tb2RlbC5vbkRpZENoYW5nZU5vdGlmaWNhdGlvbihlID0+IHRoaXMub25EaWRDaGFuZ2VOb3RpZmljYXRpb24oZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxheW91dFNlcnZpY2Uub25EaWRMYXlvdXRNYWluQ29udGFpbmVyKGRpbWVuc2lvbiA9PiB0aGlzLmxheW91dChEaW1lbnNpb24ubGlmdChkaW1lbnNpb24pKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5vbkRpZENoYW5nZUZpbHRlcigoKSA9PiB0aGlzLm9uRGlkQ2hhbmdlRmlsdGVyKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VGaWx0ZXIoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5nZXRGaWx0ZXIoKSA9PT0gTm90aWZpY2F0aW9uc0ZpbHRlci5FUlJPUikge1xuXHRcdFx0dGhpcy5oaWRlKCk7IC8vIGhpZGUgdGhlIG5vdGlmaWNhdGlvbiBjZW50ZXIgd2hlbiB3ZSBoYXZlIGEgZXJyb3IgZmlsdGVyIGVuYWJsZWRcblx0XHR9XG5cdH1cblxuXHRnZXQgaXNWaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuX2lzVmlzaWJsZTtcblx0fVxuXG5cdHNob3coKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uc0xpc3QgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5ub3RpZmljYXRpb25zTGlzdCk7XG5cblx0XHRcdC8vIE1ha2UgdmlzaWJsZVxuXHRcdFx0bm90aWZpY2F0aW9uc0xpc3Quc2hvdygpO1xuXG5cdFx0XHQvLyBGb2N1cyBmaXJzdFxuXHRcdFx0bm90aWZpY2F0aW9uc0xpc3QuZm9jdXNGaXJzdCgpO1xuXG5cdFx0XHRyZXR1cm47IC8vIGFscmVhZHkgdmlzaWJsZVxuXHRcdH1cblxuXHRcdC8vIExhemlseSBjcmVhdGUgaWYgc2hvd2luZyBmb3IgdGhlIGZpcnN0IHRpbWVcblx0XHRpZiAoIXRoaXMubm90aWZpY2F0aW9uc0NlbnRlckNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5jcmVhdGUoKTtcblx0XHR9XG5cblx0XHQvLyBUaXRsZVxuXHRcdHRoaXMudXBkYXRlVGl0bGUoKTtcblxuXHRcdC8vIE1ha2UgdmlzaWJsZVxuXHRcdGNvbnN0IFtub3RpZmljYXRpb25zTGlzdCwgbm90aWZpY2F0aW9uc0NlbnRlckNvbnRhaW5lcl0gPSBhc3NlcnRBbGxEZWZpbmVkKHRoaXMubm90aWZpY2F0aW9uc0xpc3QsIHRoaXMubm90aWZpY2F0aW9uc0NlbnRlckNvbnRhaW5lcik7XG5cdFx0dGhpcy5faXNWaXNpYmxlID0gdHJ1ZTtcblx0XHRub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcblx0XHRub3RpZmljYXRpb25zTGlzdC5zaG93KCk7XG5cblx0XHQvLyBMYXlvdXRcblx0XHR0aGlzLmxheW91dCh0aGlzLndvcmtiZW5jaERpbWVuc2lvbnMpO1xuXG5cdFx0Ly8gU2hvdyBhbGwgbm90aWZpY2F0aW9ucyB0aGF0IGFyZSBwcmVzZW50IG5vd1xuXHRcdG5vdGlmaWNhdGlvbnNMaXN0LnVwZGF0ZU5vdGlmaWNhdGlvbnNMaXN0KDAsIDAsIHRoaXMubW9kZWwubm90aWZpY2F0aW9ucyk7XG5cblx0XHQvLyBGb2N1cyBmaXJzdFxuXHRcdG5vdGlmaWNhdGlvbnNMaXN0LmZvY3VzRmlyc3QoKTtcblxuXHRcdC8vIFRoZW1pbmdcblx0XHR0aGlzLnVwZGF0ZVN0eWxlcygpO1xuXG5cdFx0Ly8gTWFyayBhcyB2aXNpYmxlXG5cdFx0dGhpcy5tb2RlbC5ub3RpZmljYXRpb25zLmZvckVhY2gobm90aWZpY2F0aW9uID0+IG5vdGlmaWNhdGlvbi51cGRhdGVWaXNpYmlsaXR5KHRydWUpKTtcblxuXHRcdC8vIENvbnRleHQgS2V5XG5cdFx0dGhpcy5ub3RpZmljYXRpb25zQ2VudGVyVmlzaWJsZUNvbnRleHRLZXkuc2V0KHRydWUpO1xuXG5cdFx0Ly8gRXZlbnRcblx0XHR0aGlzLl9vbkRpZENoYW5nZVZpc2liaWxpdHkuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVUaXRsZSgpOiB2b2lkIHtcblx0XHRjb25zdCBbbm90aWZpY2F0aW9uc0NlbnRlclRpdGxlLCBjbGVhckFsbEFjdGlvbl0gPSBhc3NlcnRBbGxEZWZpbmVkKHRoaXMubm90aWZpY2F0aW9uc0NlbnRlclRpdGxlLCB0aGlzLmNsZWFyQWxsQWN0aW9uKTtcblxuXHRcdGlmICh0aGlzLm1vZGVsLm5vdGlmaWNhdGlvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRub3RpZmljYXRpb25zQ2VudGVyVGl0bGUudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnbm90aWZpY2F0aW9uc0VtcHR5JywgXCJObyBuZXcgbm90aWZpY2F0aW9uc1wiKTtcblx0XHRcdGNsZWFyQWxsQWN0aW9uLmVuYWJsZWQgPSBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bm90aWZpY2F0aW9uc0NlbnRlclRpdGxlLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ25vdGlmaWNhdGlvbnMnLCBcIk5vdGlmaWNhdGlvbnNcIik7XG5cdFx0XHRjbGVhckFsbEFjdGlvbi5lbmFibGVkID0gdGhpcy5tb2RlbC5ub3RpZmljYXRpb25zLnNvbWUobm90aWZpY2F0aW9uID0+ICFub3RpZmljYXRpb24uaGFzUHJvZ3Jlc3MpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlKCk6IHZvaWQge1xuXG5cdFx0Ly8gQ29udGFpbmVyXG5cdFx0dGhpcy5ub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyID0gJCgnLm5vdGlmaWNhdGlvbnMtY2VudGVyJyk7XG5cblx0XHQvLyBIZWFkZXJcblx0XHR0aGlzLm5vdGlmaWNhdGlvbnNDZW50ZXJIZWFkZXIgPSAkKCcubm90aWZpY2F0aW9ucy1jZW50ZXItaGVhZGVyJyk7XG5cdFx0dGhpcy5ub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMubm90aWZpY2F0aW9uc0NlbnRlckhlYWRlcik7XG5cblx0XHQvLyBIZWFkZXIgVGl0bGVcblx0XHR0aGlzLm5vdGlmaWNhdGlvbnNDZW50ZXJUaXRsZSA9ICQoJ3NwYW4ubm90aWZpY2F0aW9ucy1jZW50ZXItaGVhZGVyLXRpdGxlJyk7XG5cdFx0dGhpcy5ub3RpZmljYXRpb25zQ2VudGVySGVhZGVyLmFwcGVuZENoaWxkKHRoaXMubm90aWZpY2F0aW9uc0NlbnRlclRpdGxlKTtcblxuXHRcdC8vIEhlYWRlciBUb29sYmFyXG5cdFx0Y29uc3QgdG9vbGJhckNvbnRhaW5lciA9ICQoJy5ub3RpZmljYXRpb25zLWNlbnRlci1oZWFkZXItdG9vbGJhcicpO1xuXHRcdHRoaXMubm90aWZpY2F0aW9uc0NlbnRlckhlYWRlci5hcHBlbmRDaGlsZCh0b29sYmFyQ29udGFpbmVyKTtcblxuXHRcdGNvbnN0IGFjdGlvblJ1bm5lciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90aWZpY2F0aW9uQWN0aW9uUnVubmVyKSk7XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCBub3RpZmljYXRpb25zVG9vbEJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25CYXIodG9vbGJhckNvbnRhaW5lciwge1xuXHRcdFx0YXJpYUxhYmVsOiBsb2NhbGl6ZSgnbm90aWZpY2F0aW9uc1Rvb2xiYXInLCBcIk5vdGlmaWNhdGlvbiBDZW50ZXIgQWN0aW9uc1wiKSxcblx0XHRcdGFjdGlvblJ1bm5lcixcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gQ29uZmlndXJlRG9Ob3REaXN0dXJiQWN0aW9uLklEKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW0sIGFjdGlvbiwge1xuXHRcdFx0XHRcdFx0Z2V0QWN0aW9ucygpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgYWN0aW9ucyA9IFt0b0FjdGlvbih7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6IFRvZ2dsZURvTm90RGlzdHVyYkFjdGlvbi5JRCxcblx0XHRcdFx0XHRcdFx0XHRsYWJlbDogdGhhdC5ub3RpZmljYXRpb25TZXJ2aWNlLmdldEZpbHRlcigpID09PSBOb3RpZmljYXRpb25zRmlsdGVyLk9GRiA/IGxvY2FsaXplKCd0dXJuT25Ob3RpZmljYXRpb25zJywgXCJFbmFibGUgRG8gTm90IERpc3R1cmIgTW9kZVwiKSA6IGxvY2FsaXplKCd0dXJuT2ZmTm90aWZpY2F0aW9ucycsIFwiRGlzYWJsZSBEbyBOb3QgRGlzdHVyYiBNb2RlXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhhdC5ub3RpZmljYXRpb25TZXJ2aWNlLnNldEZpbHRlcih0aGF0Lm5vdGlmaWNhdGlvblNlcnZpY2UuZ2V0RmlsdGVyKCkgPT09IE5vdGlmaWNhdGlvbnNGaWx0ZXIuT0ZGID8gTm90aWZpY2F0aW9uc0ZpbHRlci5FUlJPUiA6IE5vdGlmaWNhdGlvbnNGaWx0ZXIuT0ZGKVxuXHRcdFx0XHRcdFx0XHR9KV07XG5cblx0XHRcdFx0XHRcdFx0Y29uc3Qgc29ydGVkRmlsdGVycyA9IHRoYXQubm90aWZpY2F0aW9uU2VydmljZS5nZXRGaWx0ZXJzKCkuc29ydCgoYSwgYikgPT4gYS5sYWJlbC5sb2NhbGVDb21wYXJlKGIubGFiZWwpKTtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBzb3VyY2Ugb2Ygc29ydGVkRmlsdGVycy5zbGljZSgwLCBOb3RpZmljYXRpb25zQ2VudGVyLk1BWF9OT1RJRklDQVRJT05fU09VUkNFUykpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYWN0aW9ucy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdGFjdGlvbnMucHVzaCh0b0FjdGlvbih7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZDogYCR7VG9nZ2xlRG9Ob3REaXN0dXJiQWN0aW9uLklEfS4ke3NvdXJjZS5pZH1gLFxuXHRcdFx0XHRcdFx0XHRcdFx0bGFiZWw6IHNvdXJjZS5sYWJlbCxcblx0XHRcdFx0XHRcdFx0XHRcdGNoZWNrZWQ6IHNvdXJjZS5maWx0ZXIgIT09IE5vdGlmaWNhdGlvbnNGaWx0ZXIuRVJST1IsXG5cdFx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHRoYXQubm90aWZpY2F0aW9uU2VydmljZS5zZXRGaWx0ZXIoe1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQuLi5zb3VyY2UsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGZpbHRlcjogc291cmNlLmZpbHRlciA9PT0gTm90aWZpY2F0aW9uc0ZpbHRlci5FUlJPUiA/IE5vdGlmaWNhdGlvbnNGaWx0ZXIuT0ZGIDogTm90aWZpY2F0aW9uc0ZpbHRlci5FUlJPUlxuXHRcdFx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRpZiAoc29ydGVkRmlsdGVycy5sZW5ndGggPiBOb3RpZmljYXRpb25zQ2VudGVyLk1BWF9OT1RJRklDQVRJT05fU09VUkNFUykge1xuXHRcdFx0XHRcdFx0XHRcdGFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdFx0XHRcdFx0XHRcdGFjdGlvbnMucHVzaCh0aGF0Ll9yZWdpc3Rlcih0aGF0Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRvZ2dsZURvTm90RGlzdHVyYkJ5U291cmNlQWN0aW9uLCBUb2dnbGVEb05vdERpc3R1cmJCeVNvdXJjZUFjdGlvbi5JRCwgbG9jYWxpemUoJ21vcmVTb3VyY2VzJywgXCJNb3JlXHUyMDI2XCIpKSkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGFjdGlvbnM7XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0sIHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLCB7XG5cdFx0XHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRcdFx0YWN0aW9uUnVubmVyLFxuXHRcdFx0XHRcdFx0Y2xhc3NOYW1lczogYWN0aW9uLmNsYXNzLFxuXHRcdFx0XHRcdFx0a2V5YmluZGluZ1Byb3ZpZGVyOiBhY3Rpb24gPT4gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjdGlvbi5pZClcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuY2xlYXJBbGxBY3Rpb24gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENsZWFyQWxsTm90aWZpY2F0aW9uc0FjdGlvbiwgQ2xlYXJBbGxOb3RpZmljYXRpb25zQWN0aW9uLklELCBDbGVhckFsbE5vdGlmaWNhdGlvbnNBY3Rpb24uTEFCRUwpKTtcblx0XHRub3RpZmljYXRpb25zVG9vbEJhci5wdXNoKHRoaXMuY2xlYXJBbGxBY3Rpb24sIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlLCBrZXliaW5kaW5nOiB0aGlzLmdldEtleWJpbmRpbmdMYWJlbCh0aGlzLmNsZWFyQWxsQWN0aW9uKSB9KTtcblxuXHRcdHRoaXMuY29uZmlndXJlRG9Ob3REaXN0dXJiQWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb25maWd1cmVEb05vdERpc3R1cmJBY3Rpb24sIENvbmZpZ3VyZURvTm90RGlzdHVyYkFjdGlvbi5JRCwgQ29uZmlndXJlRG9Ob3REaXN0dXJiQWN0aW9uLkxBQkVMKSk7XG5cdFx0bm90aWZpY2F0aW9uc1Rvb2xCYXIucHVzaCh0aGlzLmNvbmZpZ3VyZURvTm90RGlzdHVyYkFjdGlvbiwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cblx0XHRjb25zdCBoaWRlQWxsQWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShIaWRlTm90aWZpY2F0aW9uc0NlbnRlckFjdGlvbiwgSGlkZU5vdGlmaWNhdGlvbnNDZW50ZXJBY3Rpb24uSUQsIEhpZGVOb3RpZmljYXRpb25zQ2VudGVyQWN0aW9uLkxBQkVMKSk7XG5cdFx0bm90aWZpY2F0aW9uc1Rvb2xCYXIucHVzaChoaWRlQWxsQWN0aW9uLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSwga2V5YmluZGluZzogdGhpcy5nZXRLZXliaW5kaW5nTGFiZWwoaGlkZUFsbEFjdGlvbikgfSk7XG5cblx0XHQvLyBOb3RpZmljYXRpb25zIExpc3Rcblx0XHR0aGlzLm5vdGlmaWNhdGlvbnNMaXN0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RpZmljYXRpb25zTGlzdCwgdGhpcy5ub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyLCB7XG5cdFx0XHR3aWRnZXRBcmlhTGFiZWw6IGxvY2FsaXplKCdub3RpZmljYXRpb25zQ2VudGVyV2lkZ2V0QXJpYUxhYmVsJywgXCJOb3RpZmljYXRpb25zIENlbnRlclwiKVxuXHRcdH0pO1xuXHRcdHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMubm90aWZpY2F0aW9uc0NlbnRlckNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIGdldEtleWJpbmRpbmdMYWJlbChhY3Rpb246IElBY3Rpb24pOiBzdHJpbmcgfCBudWxsIHtcblx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjdGlvbi5pZCk7XG5cblx0XHRyZXR1cm4ga2V5YmluZGluZyA/IGtleWJpbmRpbmcuZ2V0TGFiZWwoKSA6IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlTm90aWZpY2F0aW9uKGU6IElOb3RpZmljYXRpb25DaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHRyZXR1cm47IC8vIG9ubHkgaWYgdmlzaWJsZVxuXHRcdH1cblxuXHRcdGxldCBmb2N1c0VkaXRvciA9IGZhbHNlO1xuXG5cdFx0Ly8gVXBkYXRlIG5vdGlmaWNhdGlvbnMgbGlzdCBiYXNlZCBvbiBldmVudCBraW5kXG5cdFx0Y29uc3QgW25vdGlmaWNhdGlvbnNMaXN0LCBub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyXSA9IGFzc2VydEFsbERlZmluZWQodGhpcy5ub3RpZmljYXRpb25zTGlzdCwgdGhpcy5ub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyKTtcblx0XHRzd2l0Y2ggKGUua2luZCkge1xuXHRcdFx0Y2FzZSBOb3RpZmljYXRpb25DaGFuZ2VUeXBlLkFERDpcblx0XHRcdFx0bm90aWZpY2F0aW9uc0xpc3QudXBkYXRlTm90aWZpY2F0aW9uc0xpc3QoZS5pbmRleCwgMCwgW2UuaXRlbV0pO1xuXHRcdFx0XHRlLml0ZW0udXBkYXRlVmlzaWJpbGl0eSh0cnVlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIE5vdGlmaWNhdGlvbkNoYW5nZVR5cGUuQ0hBTkdFOlxuXHRcdFx0XHQvLyBIYW5kbGUgY29udGVudCBjaGFuZ2VzXG5cdFx0XHRcdC8vIC0gYWN0aW9uczogcmUtZHJhdyB0byBwcm9wZXJseSBzaG93IHRoZW1cblx0XHRcdFx0Ly8gLSBtZXNzYWdlOiB1cGRhdGUgbm90aWZpY2F0aW9uIGhlaWdodCB1bmxlc3MgY29sbGFwc2VkXG5cdFx0XHRcdHN3aXRjaCAoZS5kZXRhaWwpIHtcblx0XHRcdFx0XHRjYXNlIE5vdGlmaWNhdGlvblZpZXdJdGVtQ29udGVudENoYW5nZUtpbmQuQUNUSU9OUzpcblx0XHRcdFx0XHRcdG5vdGlmaWNhdGlvbnNMaXN0LnVwZGF0ZU5vdGlmaWNhdGlvbnNMaXN0KGUuaW5kZXgsIDEsIFtlLml0ZW1dKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgTm90aWZpY2F0aW9uVmlld0l0ZW1Db250ZW50Q2hhbmdlS2luZC5NRVNTQUdFOlxuXHRcdFx0XHRcdFx0aWYgKGUuaXRlbS5leHBhbmRlZCkge1xuXHRcdFx0XHRcdFx0XHRub3RpZmljYXRpb25zTGlzdC51cGRhdGVOb3RpZmljYXRpb25IZWlnaHQoZS5pdGVtKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBOb3RpZmljYXRpb25DaGFuZ2VUeXBlLkVYUEFORF9DT0xMQVBTRTpcblx0XHRcdFx0Ly8gUmUtZHJhdyBlbnRpcmUgaXRlbSB3aGVuIGV4cGFuc2lvbiBjaGFuZ2VzIHRvIHJldmVhbCBvciBoaWRlIGRldGFpbHNcblx0XHRcdFx0bm90aWZpY2F0aW9uc0xpc3QudXBkYXRlTm90aWZpY2F0aW9uc0xpc3QoZS5pbmRleCwgMSwgW2UuaXRlbV0pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgTm90aWZpY2F0aW9uQ2hhbmdlVHlwZS5SRU1PVkU6XG5cdFx0XHRcdGZvY3VzRWRpdG9yID0gaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudChub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyKTtcblx0XHRcdFx0bm90aWZpY2F0aW9uc0xpc3QudXBkYXRlTm90aWZpY2F0aW9uc0xpc3QoZS5pbmRleCwgMSk7XG5cdFx0XHRcdGUuaXRlbS51cGRhdGVWaXNpYmlsaXR5KGZhbHNlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHRpdGxlXG5cdFx0dGhpcy51cGRhdGVUaXRsZSgpO1xuXG5cdFx0Ly8gSGlkZSBpZiBubyBtb3JlIG5vdGlmaWNhdGlvbnMgdG8gc2hvd1xuXHRcdGlmICh0aGlzLm1vZGVsLm5vdGlmaWNhdGlvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLmhpZGUoKTtcblxuXHRcdFx0Ly8gUmVzdG9yZSBmb2N1cyB0byBlZGl0b3IgZ3JvdXAgaWYgd2UgaGFkIGZvY3VzXG5cdFx0XHRpZiAoZm9jdXNFZGl0b3IpIHtcblx0XHRcdFx0dGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRoaWRlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faXNWaXNpYmxlIHx8ICF0aGlzLm5vdGlmaWNhdGlvbnNDZW50ZXJDb250YWluZXIgfHwgIXRoaXMubm90aWZpY2F0aW9uc0xpc3QpIHtcblx0XHRcdHJldHVybjsgLy8gYWxyZWFkeSBoaWRkZW5cblx0XHR9XG5cblx0XHRjb25zdCBmb2N1c0VkaXRvciA9IGlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQodGhpcy5ub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyKTtcblxuXHRcdC8vIEhpZGVcblx0XHR0aGlzLl9pc1Zpc2libGUgPSBmYWxzZTtcblx0XHR0aGlzLm5vdGlmaWNhdGlvbnNDZW50ZXJDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuXHRcdHRoaXMubm90aWZpY2F0aW9uc0xpc3QuaGlkZSgpO1xuXG5cdFx0Ly8gTWFyayBhcyBoaWRkZW5cblx0XHR0aGlzLm1vZGVsLm5vdGlmaWNhdGlvbnMuZm9yRWFjaChub3RpZmljYXRpb24gPT4gbm90aWZpY2F0aW9uLnVwZGF0ZVZpc2liaWxpdHkoZmFsc2UpKTtcblxuXHRcdC8vIENvbnRleHQgS2V5XG5cdFx0dGhpcy5ub3RpZmljYXRpb25zQ2VudGVyVmlzaWJsZUNvbnRleHRLZXkuc2V0KGZhbHNlKTtcblxuXHRcdC8vIEV2ZW50XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmZpcmUoKTtcblxuXHRcdC8vIFJlc3RvcmUgZm9jdXMgdG8gZWRpdG9yIGdyb3VwIGlmIHdlIGhhZCBmb2N1c1xuXHRcdGlmIChmb2N1c0VkaXRvcikge1xuXHRcdFx0dGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSB1cGRhdGVTdHlsZXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubm90aWZpY2F0aW9uc0NlbnRlckNvbnRhaW5lciAmJiB0aGlzLm5vdGlmaWNhdGlvbnNDZW50ZXJIZWFkZXIpIHtcblx0XHRcdGNvbnN0IHdpZGdldFNoYWRvd0NvbG9yID0gdGhpcy5nZXRDb2xvcih3aWRnZXRTaGFkb3cpO1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyLnN0eWxlLmJveFNoYWRvdyA9IHdpZGdldFNoYWRvd0NvbG9yID8gYDAgMCA4cHggMnB4ICR7d2lkZ2V0U2hhZG93Q29sb3J9YCA6ICcnO1xuXG5cdFx0XHRjb25zdCBib3JkZXJDb2xvciA9IHRoaXMuZ2V0Q29sb3IoTk9USUZJQ0FUSU9OU19DRU5URVJfQk9SREVSKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uc0NlbnRlckNvbnRhaW5lci5zdHlsZS5ib3JkZXIgPSBib3JkZXJDb2xvciA/IGAxcHggc29saWQgJHtib3JkZXJDb2xvcn1gIDogJyc7XG5cblx0XHRcdGNvbnN0IGhlYWRlckZvcmVncm91bmQgPSB0aGlzLmdldENvbG9yKE5PVElGSUNBVElPTlNfQ0VOVEVSX0hFQURFUl9GT1JFR1JPVU5EKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uc0NlbnRlckhlYWRlci5zdHlsZS5jb2xvciA9IGhlYWRlckZvcmVncm91bmQgPz8gJyc7XG5cblx0XHRcdGNvbnN0IGhlYWRlckJhY2tncm91bmQgPSB0aGlzLmdldENvbG9yKE5PVElGSUNBVElPTlNfQ0VOVEVSX0hFQURFUl9CQUNLR1JPVU5EKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uc0NlbnRlckhlYWRlci5zdHlsZS5iYWNrZ3JvdW5kID0gaGVhZGVyQmFja2dyb3VuZCA/PyAnJztcblxuXHRcdH1cblx0fVxuXG5cdGxheW91dChkaW1lbnNpb246IERpbWVuc2lvbiB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMud29ya2JlbmNoRGltZW5zaW9ucyA9IGRpbWVuc2lvbjtcblxuXHRcdGlmICh0aGlzLl9pc1Zpc2libGUgJiYgdGhpcy5ub3RpZmljYXRpb25zQ2VudGVyQ29udGFpbmVyKSB7XG5cdFx0XHRjb25zdCBtYXhXaWR0aCA9IE5vdGlmaWNhdGlvbnNDZW50ZXIuTUFYX0RJTUVOU0lPTlMud2lkdGg7XG5cdFx0XHRjb25zdCBtYXhIZWlnaHQgPSBOb3RpZmljYXRpb25zQ2VudGVyLk1BWF9ESU1FTlNJT05TLmhlaWdodDtcblxuXHRcdFx0bGV0IGF2YWlsYWJsZVdpZHRoID0gbWF4V2lkdGg7XG5cdFx0XHRsZXQgYXZhaWxhYmxlSGVpZ2h0ID0gbWF4SGVpZ2h0O1xuXG5cdFx0XHRpZiAodGhpcy53b3JrYmVuY2hEaW1lbnNpb25zKSB7XG5cblx0XHRcdFx0Ly8gTWFrZSBzdXJlIG5vdGlmaWNhdGlvbnMgYXJlIG5vdCBleGNlZGluZyBhdmFpbGFibGUgd2lkdGhcblx0XHRcdFx0YXZhaWxhYmxlV2lkdGggPSB0aGlzLndvcmtiZW5jaERpbWVuc2lvbnMud2lkdGg7XG5cdFx0XHRcdGF2YWlsYWJsZVdpZHRoIC09ICgyICogOCk7IC8vIGFkanVzdCBmb3IgcGFkZGluZ3MgbGVmdCBhbmQgcmlnaHRcblxuXHRcdFx0XHQvLyBNYWtlIHN1cmUgbm90aWZpY2F0aW9ucyBhcmUgbm90IGV4Y2VlZGluZyBhdmFpbGFibGUgaGVpZ2h0XG5cdFx0XHRcdGF2YWlsYWJsZUhlaWdodCA9IHRoaXMud29ya2JlbmNoRGltZW5zaW9ucy5oZWlnaHQgLSAzNSAvKiBoZWFkZXIgKi87XG5cdFx0XHRcdGlmICh0aGlzLmxheW91dFNlcnZpY2UuaXNWaXNpYmxlKFBhcnRzLlNUQVRVU0JBUl9QQVJULCBtYWluV2luZG93KSkge1xuXHRcdFx0XHRcdGF2YWlsYWJsZUhlaWdodCAtPSAyMjsgLy8gYWRqdXN0IGZvciBzdGF0dXMgYmFyXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5sYXlvdXRTZXJ2aWNlLmlzVmlzaWJsZShQYXJ0cy5USVRMRUJBUl9QQVJULCBtYWluV2luZG93KSkge1xuXHRcdFx0XHRcdGF2YWlsYWJsZUhlaWdodCAtPSAyMjsgLy8gYWRqdXN0IGZvciB0aXRsZSBiYXJcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGF2YWlsYWJsZUhlaWdodCAtPSAoMiAqIDEyKTsgLy8gYWRqdXN0IGZvciBwYWRkaW5ncyB0b3AgYW5kIGJvdHRvbVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBBcHBseSB0byBsaXN0XG5cdFx0XHRjb25zdCBub3RpZmljYXRpb25zTGlzdCA9IGFzc2VydElzRGVmaW5lZCh0aGlzLm5vdGlmaWNhdGlvbnNMaXN0KTtcblx0XHRcdG5vdGlmaWNhdGlvbnNMaXN0LmxheW91dChNYXRoLm1pbihtYXhXaWR0aCwgYXZhaWxhYmxlV2lkdGgpLCBNYXRoLm1pbihtYXhIZWlnaHQsIGF2YWlsYWJsZUhlaWdodCkpO1xuXHRcdH1cblx0fVxuXG5cdGNsZWFyQWxsKCk6IHZvaWQge1xuXG5cdFx0Ly8gSGlkZSBub3RpZmljYXRpb25zIGNlbnRlciBmaXJzdFxuXHRcdHRoaXMuaGlkZSgpO1xuXG5cdFx0Ly8gQ2xvc2UgYWxsXG5cdFx0Zm9yIChjb25zdCBub3RpZmljYXRpb24gb2YgWy4uLnRoaXMubW9kZWwubm90aWZpY2F0aW9uc10gLyogY29weSBhcnJheSBzaW5jZSB3ZSBtb2RpZnkgaXQgZnJvbSBjbG9zaW5nICovKSB7XG5cdFx0XHRpZiAoIW5vdGlmaWNhdGlvbi5oYXNQcm9ncmVzcykge1xuXHRcdFx0XHRub3RpZmljYXRpb24uY2xvc2UoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmNsZWFyKTtcblx0XHR9XG5cdH1cbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsT0FBTztBQUNQLFNBQVMsd0NBQXdDLHdDQUF3QyxtQ0FBbUM7QUFDNUgsU0FBUyxlQUFlLGdCQUFnQjtBQUN4QyxTQUF3RCx3QkFBd0IsNkNBQTZDO0FBQzdILFNBQVMseUJBQXlCLGFBQWE7QUFDL0MsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQXlDLGdDQUFnQztBQUN6RSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLEdBQUcsV0FB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QUFBLFFBQ3BCO0FBRUEsMkJBQW9CLElBQUk7QUFBQSxNQUN6QjtBQUdBLFlBQU0sb0JBQW9CLGdCQUFnQixLQUFLLGlCQUFpQjtBQUNoRSx3QkFBa0IsT0FBTyxLQUFLLElBQUksVUFBVSxjQUFjLEdBQUcsS0FBSyxJQUFJLFdBQVcsZUFBZSxDQUFDO0FBQUEsSUFDbEc7QUFBQSxFQUNEO0FBQUEsRUFFQSxXQUFpQjtBQUdoQixTQUFLLEtBQUs7QUFHVixlQUFXLGdCQUFnQixDQUFDLEdBQUcsS0FBSyxNQUFNLGFBQWEsR0FBb0Q7QUFDMUcsVUFBSSxDQUFDLGFBQWEsYUFBYTtBQUM5QixxQkFBYSxNQUFNO0FBQUEsTUFDcEI7QUFDQSxXQUFLLDJCQUEyQixXQUFXLG9CQUFvQixLQUFLO0FBQUEsSUFDckU7QUFBQSxFQUNEO0FBQ0Q7QUFqV2Esb0JBRVksaUJBQWlCLElBQUksVUFBVSxLQUFLLEdBQUc7QUFGbkQsb0JBSVksMkJBQTJCO0FBSnZDLHNCQUFOO0FBQUEsRUFzQko7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBOUJVOyIsCiAgIm5hbWVzIjogWyJub3RpZmljYXRpb25zTGlzdCIsICJhY3Rpb24iXQp9Cg==
