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
import "./media/notificationsToasts.css";
import { localize } from "../../../../nls.js";
import { NotificationChangeType, NotificationViewItemContentChangeKind } from "../../../common/notifications.js";
import { dispose, toDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { addDisposableListener, EventType, Dimension, scheduleAtNextAnimationFrame, isAncestorOfActiveElement, getWindow, $ } from "../../../../base/browser/dom.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { NotificationsList } from "./notificationsList.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { NOTIFICATIONS_TOAST_BORDER, NOTIFICATIONS_BACKGROUND } from "../../../common/theme.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { widgetShadow } from "../../../../platform/theme/common/colorRegistry.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { Severity, NotificationsFilter, NotificationPriority } from "../../../../platform/notification/common/notification.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IntervalCounter } from "../../../../base/common/async.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { NotificationsToastsVisibleContext } from "../../../common/contextkeys.js";
import { mainWindow } from "../../../../base/browser/window.js";
var ToastVisibility = /* @__PURE__ */ ((ToastVisibility2) => {
  ToastVisibility2[ToastVisibility2["HIDDEN_OR_VISIBLE"] = 0] = "HIDDEN_OR_VISIBLE";
  ToastVisibility2[ToastVisibility2["HIDDEN"] = 1] = "HIDDEN";
  ToastVisibility2[ToastVisibility2["VISIBLE"] = 2] = "VISIBLE";
  return ToastVisibility2;
})(ToastVisibility || {});
let NotificationsToasts = class extends Themable {
  constructor(container, model, instantiationService, layoutService, themeService, editorGroupService, contextKeyService, lifecycleService, hostService) {
    super(themeService);
    this.container = container;
    this.model = model;
    this.instantiationService = instantiationService;
    this.layoutService = layoutService;
    this.editorGroupService = editorGroupService;
    this.lifecycleService = lifecycleService;
    this.hostService = hostService;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._isVisible = false;
    this.mapNotificationToToast = /* @__PURE__ */ new Map();
    this.mapNotificationToDisposable = /* @__PURE__ */ new Map();
    this.addedToastsIntervalCounter = new IntervalCounter(NotificationsToasts.SPAM_PROTECTION.interval);
    this.notificationsToastsVisibleContextKey = NotificationsToastsVisibleContext.bindTo(contextKeyService);
    this.registerListeners();
  }
  get isVisible() {
    return !!this._isVisible;
  }
  registerListeners() {
    this._register(this.layoutService.onDidLayoutMainContainer((dimension) => this.layout(Dimension.lift(dimension))));
    this.lifecycleService.when(LifecyclePhase.Restored).then(() => {
      this.model.notifications.forEach((notification) => this.addToast(notification));
      this._register(this.model.onDidChangeNotification((e) => this.onDidChangeNotification(e)));
    });
    this._register(this.model.onDidChangeFilter(({ global, sources }) => {
      if (global === NotificationsFilter.ERROR) {
        this.hide();
      } else if (sources) {
        for (const [notification] of this.mapNotificationToToast) {
          if (typeof notification.sourceId === "string" && sources.get(notification.sourceId) === NotificationsFilter.ERROR && notification.severity !== Severity.Error && notification.priority !== NotificationPriority.URGENT) {
            this.removeToast(notification);
          }
        }
      }
    }));
  }
  onDidChangeNotification(e) {
    switch (e.kind) {
      case NotificationChangeType.ADD:
        return this.addToast(e.item);
      case NotificationChangeType.REMOVE:
        return this.removeToast(e.item);
    }
  }
  addToast(item) {
    if (this.isNotificationsCenterVisible) {
      return;
    }
    if (item.priority === NotificationPriority.SILENT) {
      return;
    }
    if (this.addedToastsIntervalCounter.increment() > NotificationsToasts.SPAM_PROTECTION.limit) {
      return;
    }
    const itemDisposables = new DisposableStore();
    this.mapNotificationToDisposable.set(item, itemDisposables);
    itemDisposables.add(scheduleAtNextAnimationFrame(getWindow(this.container), () => this.doAddToast(item, itemDisposables)));
  }
  doAddToast(item, itemDisposables) {
    let notificationsToastsContainer = this.notificationsToastsContainer;
    if (!notificationsToastsContainer) {
      notificationsToastsContainer = this.notificationsToastsContainer = $(".notifications-toasts");
      this.container.appendChild(notificationsToastsContainer);
    }
    notificationsToastsContainer.classList.add("visible");
    const notificationToastContainer = $(".notification-toast-container");
    const firstToast = notificationsToastsContainer.firstChild;
    if (firstToast) {
      notificationsToastsContainer.insertBefore(notificationToastContainer, firstToast);
    } else {
      notificationsToastsContainer.appendChild(notificationToastContainer);
    }
    const notificationToast = $(".notification-toast");
    notificationToastContainer.appendChild(notificationToast);
    const notificationList = this.instantiationService.createInstance(NotificationsList, notificationToast, {
      verticalScrollMode: ScrollbarVisibility.Hidden,
      widgetAriaLabel: (() => {
        if (!item.source) {
          return localize("notificationAriaLabel", "{0}, notification", item.message.raw);
        }
        return localize("notificationWithSourceAriaLabel", "{0}, source: {1}, notification", item.message.raw, item.source);
      })()
    });
    itemDisposables.add(notificationList);
    const toast = { item, list: notificationList, container: notificationToastContainer, toast: notificationToast };
    this.mapNotificationToToast.set(item, toast);
    itemDisposables.add(toDisposable(() => this.updateToastVisibility(toast, false)));
    notificationList.show();
    const maxDimensions = this.computeMaxDimensions();
    this.layoutLists(maxDimensions.width);
    notificationList.updateNotificationsList(0, 0, [item]);
    this.layoutContainer(maxDimensions.height);
    itemDisposables.add(item.onDidChangeExpansion(() => {
      notificationList.updateNotificationsList(0, 1, [item]);
    }));
    itemDisposables.add(item.onDidChangeContent((e) => {
      switch (e.kind) {
        case NotificationViewItemContentChangeKind.ACTIONS:
          notificationList.updateNotificationsList(0, 1, [item]);
          break;
        case NotificationViewItemContentChangeKind.MESSAGE:
          if (item.expanded) {
            notificationList.updateNotificationHeight(item);
          }
          break;
      }
    }));
    Event.once(item.onDidClose)(() => {
      this.removeToast(item);
    });
    this.purgeNotification(item, notificationToastContainer, notificationList, itemDisposables);
    this.updateStyles();
    this.notificationsToastsVisibleContextKey.set(true);
    notificationToast.classList.add("notification-fade-in");
    itemDisposables.add(addDisposableListener(notificationToast, "transitionend", () => {
      notificationToast.classList.remove("notification-fade-in");
      notificationToast.classList.add("notification-fade-in-done");
    }));
    item.updateVisibility(true);
    if (!this._isVisible) {
      this._isVisible = true;
      this._onDidChangeVisibility.fire();
    }
  }
  purgeNotification(item, notificationToastContainer, notificationList, disposables) {
    let isMouseOverToast = false;
    disposables.add(addDisposableListener(notificationToastContainer, EventType.MOUSE_OVER, () => isMouseOverToast = true));
    disposables.add(addDisposableListener(notificationToastContainer, EventType.MOUSE_OUT, () => isMouseOverToast = false));
    let purgeTimeoutHandle;
    let listener;
    const hideAfterTimeout = () => {
      purgeTimeoutHandle = setTimeout(() => {
        if (!this.hostService.hasFocus) {
          if (!listener) {
            listener = this.hostService.onDidChangeFocus((focus) => {
              if (focus) {
                hideAfterTimeout();
              }
            });
            disposables.add(listener);
          }
        } else if (item.sticky || // never hide sticky notifications
        notificationList.hasFocus() || // never hide notifications with focus
        isMouseOverToast) {
          hideAfterTimeout();
        } else {
          this.removeToast(item);
        }
      }, NotificationsToasts.PURGE_TIMEOUT[item.severity]);
    };
    hideAfterTimeout();
    disposables.add(toDisposable(() => clearTimeout(purgeTimeoutHandle)));
  }
  removeToast(item) {
    let focusEditor = false;
    const notificationToast = this.mapNotificationToToast.get(item);
    if (notificationToast) {
      const toastHasDOMFocus = isAncestorOfActiveElement(notificationToast.container);
      if (toastHasDOMFocus) {
        focusEditor = !(this.focusNext() || this.focusPrevious());
      }
      this.mapNotificationToToast.delete(item);
    }
    const notificationDisposables = this.mapNotificationToDisposable.get(item);
    if (notificationDisposables) {
      dispose(notificationDisposables);
      this.mapNotificationToDisposable.delete(item);
    }
    if (this.mapNotificationToToast.size > 0) {
      this.layout(this.workbenchDimensions);
    } else {
      this.doHide();
      if (focusEditor) {
        this.editorGroupService.activeGroup.focus();
      }
    }
  }
  removeToasts() {
    this.mapNotificationToToast.clear();
    this.mapNotificationToDisposable.forEach((disposable) => dispose(disposable));
    this.mapNotificationToDisposable.clear();
    this.doHide();
  }
  doHide() {
    this.notificationsToastsContainer?.classList.remove("visible");
    this.notificationsToastsVisibleContextKey.set(false);
    if (this._isVisible) {
      this._isVisible = false;
      this._onDidChangeVisibility.fire();
    }
  }
  hide() {
    const focusEditor = this.notificationsToastsContainer ? isAncestorOfActiveElement(this.notificationsToastsContainer) : false;
    this.removeToasts();
    if (focusEditor) {
      this.editorGroupService.activeGroup.focus();
    }
  }
  focus() {
    const toasts = this.getToasts(2 /* VISIBLE */);
    if (toasts.length > 0) {
      toasts[0].list.focusFirst();
      return true;
    }
    return false;
  }
  focusNext() {
    const toasts = this.getToasts(2 /* VISIBLE */);
    for (let i = 0; i < toasts.length; i++) {
      const toast = toasts[i];
      if (toast.list.hasFocus()) {
        const nextToast = toasts[i + 1];
        if (nextToast) {
          nextToast.list.focusFirst();
          return true;
        }
        break;
      }
    }
    return false;
  }
  focusPrevious() {
    const toasts = this.getToasts(2 /* VISIBLE */);
    for (let i = 0; i < toasts.length; i++) {
      const toast = toasts[i];
      if (toast.list.hasFocus()) {
        const previousToast = toasts[i - 1];
        if (previousToast) {
          previousToast.list.focusFirst();
          return true;
        }
        break;
      }
    }
    return false;
  }
  focusFirst() {
    const toast = this.getToasts(2 /* VISIBLE */)[0];
    if (toast) {
      toast.list.focusFirst();
      return true;
    }
    return false;
  }
  focusLast() {
    const toasts = this.getToasts(2 /* VISIBLE */);
    if (toasts.length > 0) {
      toasts[toasts.length - 1].list.focusFirst();
      return true;
    }
    return false;
  }
  update(isCenterVisible) {
    if (this.isNotificationsCenterVisible !== isCenterVisible) {
      this.isNotificationsCenterVisible = isCenterVisible;
      if (this.isNotificationsCenterVisible) {
        this.removeToasts();
      }
    }
  }
  updateStyles() {
    this.mapNotificationToToast.forEach(({ toast }) => {
      const backgroundColor = this.getColor(NOTIFICATIONS_BACKGROUND);
      toast.style.background = backgroundColor ? backgroundColor : "";
      const widgetShadowColor = this.getColor(widgetShadow);
      toast.style.boxShadow = widgetShadowColor ? `0 0 8px 2px ${widgetShadowColor}` : "";
      const borderColor = this.getColor(NOTIFICATIONS_TOAST_BORDER);
      toast.style.border = borderColor ? `1px solid ${borderColor}` : "";
    });
  }
  getToasts(state) {
    const notificationToasts = [];
    this.mapNotificationToToast.forEach((toast) => {
      switch (state) {
        case 0 /* HIDDEN_OR_VISIBLE */:
          notificationToasts.push(toast);
          break;
        case 1 /* HIDDEN */:
          if (!this.isToastInDOM(toast)) {
            notificationToasts.push(toast);
          }
          break;
        case 2 /* VISIBLE */:
          if (this.isToastInDOM(toast)) {
            notificationToasts.push(toast);
          }
          break;
      }
    });
    return notificationToasts.reverse();
  }
  layout(dimension) {
    this.workbenchDimensions = dimension;
    const maxDimensions = this.computeMaxDimensions();
    if (maxDimensions.height) {
      this.layoutContainer(maxDimensions.height);
    }
    this.layoutLists(maxDimensions.width);
  }
  computeMaxDimensions() {
    const maxWidth = NotificationsToasts.MAX_WIDTH;
    let availableWidth = maxWidth;
    let availableHeight;
    if (this.workbenchDimensions) {
      availableWidth = this.workbenchDimensions.width;
      availableWidth -= 2 * 8;
      availableHeight = this.workbenchDimensions.height;
      if (this.layoutService.isVisible(Parts.STATUSBAR_PART, mainWindow)) {
        availableHeight -= 22;
      }
      if (this.layoutService.isVisible(Parts.TITLEBAR_PART, mainWindow)) {
        availableHeight -= 22;
      }
      availableHeight -= 2 * 12;
    }
    availableHeight = typeof availableHeight === "number" ? Math.round(availableHeight * 0.618) : 0;
    return new Dimension(Math.min(maxWidth, availableWidth), availableHeight);
  }
  layoutLists(width) {
    this.mapNotificationToToast.forEach(({ list }) => list.layout(width));
  }
  layoutContainer(heightToGive) {
    let visibleToasts = 0;
    for (const toast of this.getToasts(0 /* HIDDEN_OR_VISIBLE */)) {
      toast.container.style.opacity = "0";
      this.updateToastVisibility(toast, true);
      heightToGive -= toast.container.offsetHeight;
      let makeVisible = false;
      if (visibleToasts === NotificationsToasts.MAX_NOTIFICATIONS) {
        makeVisible = false;
      } else if (heightToGive >= 0) {
        makeVisible = true;
      }
      this.updateToastVisibility(toast, makeVisible);
      toast.container.style.opacity = "";
      if (makeVisible) {
        visibleToasts++;
      }
    }
  }
  updateToastVisibility(toast, visible) {
    if (this.isToastInDOM(toast) === visible) {
      return;
    }
    const notificationsToastsContainer = assertIsDefined(this.notificationsToastsContainer);
    if (visible) {
      notificationsToastsContainer.appendChild(toast.container);
    } else {
      toast.container.remove();
    }
    toast.item.updateVisibility(visible);
  }
  isToastInDOM(toast) {
    return !!toast.container.parentElement;
  }
};
NotificationsToasts.MAX_WIDTH = 450;
NotificationsToasts.MAX_NOTIFICATIONS = 3;
NotificationsToasts.PURGE_TIMEOUT = {
  [Severity.Info]: 15e3,
  [Severity.Warning]: 18e3,
  [Severity.Error]: 2e4
};
NotificationsToasts.SPAM_PROTECTION = {
  // Count for the number of notifications over 800ms...
  interval: 800,
  // ...and ensure we are not showing more than MAX_NOTIFICATIONS
  limit: NotificationsToasts.MAX_NOTIFICATIONS
};
NotificationsToasts = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IWorkbenchLayoutService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IEditorGroupsService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, ILifecycleService),
  __decorateParam(8, IHostService)
], NotificationsToasts);
export {
  NotificationsToasts
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9ub3RpZmljYXRpb25zL25vdGlmaWNhdGlvbnNUb2FzdHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvbm90aWZpY2F0aW9uc1RvYXN0cy5jc3MnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvbnNNb2RlbCwgTm90aWZpY2F0aW9uQ2hhbmdlVHlwZSwgSU5vdGlmaWNhdGlvbkNoYW5nZUV2ZW50LCBJTm90aWZpY2F0aW9uVmlld0l0ZW0sIE5vdGlmaWNhdGlvblZpZXdJdGVtQ29udGVudENoYW5nZUtpbmQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90aWZpY2F0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSwgdG9EaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBFdmVudFR5cGUsIERpbWVuc2lvbiwgc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZSwgaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudCwgZ2V0V2luZG93LCAkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IE5vdGlmaWNhdGlvbnNMaXN0IH0gZnJvbSAnLi9ub3RpZmljYXRpb25zTGlzdC5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCBQYXJ0cyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTk9USUZJQ0FUSU9OU19UT0FTVF9CT1JERVIsIE5PVElGSUNBVElPTlNfQkFDS0dST1VORCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlLCBUaGVtYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgd2lkZ2V0U2hhZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvbnNUb2FzdENvbnRyb2xsZXIgfSBmcm9tICcuL25vdGlmaWNhdGlvbnNDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBTZXZlcml0eSwgTm90aWZpY2F0aW9uc0ZpbHRlciwgTm90aWZpY2F0aW9uUHJpb3JpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBTY3JvbGxiYXJWaXNpYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSwgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJbnRlcnZhbENvdW50ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBOb3RpZmljYXRpb25zVG9hc3RzVmlzaWJsZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuXG5pbnRlcmZhY2UgSU5vdGlmaWNhdGlvblRvYXN0IHtcblx0cmVhZG9ubHkgaXRlbTogSU5vdGlmaWNhdGlvblZpZXdJdGVtO1xuXHRyZWFkb25seSBsaXN0OiBOb3RpZmljYXRpb25zTGlzdDtcblx0cmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgdG9hc3Q6IEhUTUxFbGVtZW50O1xufVxuXG5lbnVtIFRvYXN0VmlzaWJpbGl0eSB7XG5cdEhJRERFTl9PUl9WSVNJQkxFLFxuXHRISURERU4sXG5cdFZJU0lCTEVcbn1cblxuZXhwb3J0IGNsYXNzIE5vdGlmaWNhdGlvbnNUb2FzdHMgZXh0ZW5kcyBUaGVtYWJsZSBpbXBsZW1lbnRzIElOb3RpZmljYXRpb25zVG9hc3RDb250cm9sbGVyIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNQVhfV0lEVEggPSA0NTA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE1BWF9OT1RJRklDQVRJT05TID0gMztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBQVVJHRV9USU1FT1VUOiB7IFtzZXZlcml0eTogbnVtYmVyXTogbnVtYmVyIH0gPSB7XG5cdFx0W1NldmVyaXR5LkluZm9dOiAxNTAwMCxcblx0XHRbU2V2ZXJpdHkuV2FybmluZ106IDE4MDAwLFxuXHRcdFtTZXZlcml0eS5FcnJvcl06IDIwMDAwXG5cdH07XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgU1BBTV9QUk9URUNUSU9OID0ge1xuXHRcdC8vIENvdW50IGZvciB0aGUgbnVtYmVyIG9mIG5vdGlmaWNhdGlvbnMgb3ZlciA4MDBtcy4uLlxuXHRcdGludGVydmFsOiA4MDAsXG5cdFx0Ly8gLi4uYW5kIGVuc3VyZSB3ZSBhcmUgbm90IHNob3dpbmcgbW9yZSB0aGFuIE1BWF9OT1RJRklDQVRJT05TXG5cdFx0bGltaXQ6IHRoaXMuTUFYX05PVElGSUNBVElPTlNcblx0fTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpc2liaWxpdHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gdGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmV2ZW50O1xuXG5cdHByaXZhdGUgX2lzVmlzaWJsZSA9IGZhbHNlO1xuXHRnZXQgaXNWaXNpYmxlKCk6IGJvb2xlYW4geyByZXR1cm4gISF0aGlzLl9pc1Zpc2libGU7IH1cblxuXHRwcml2YXRlIG5vdGlmaWNhdGlvbnNUb2FzdHNDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHdvcmtiZW5jaERpbWVuc2lvbnM6IERpbWVuc2lvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBpc05vdGlmaWNhdGlvbnNDZW50ZXJWaXNpYmxlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbWFwTm90aWZpY2F0aW9uVG9Ub2FzdCA9IG5ldyBNYXA8SU5vdGlmaWNhdGlvblZpZXdJdGVtLCBJTm90aWZpY2F0aW9uVG9hc3Q+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgbWFwTm90aWZpY2F0aW9uVG9EaXNwb3NhYmxlID0gbmV3IE1hcDxJTm90aWZpY2F0aW9uVmlld0l0ZW0sIElEaXNwb3NhYmxlPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uc1RvYXN0c1Zpc2libGVDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGFkZGVkVG9hc3RzSW50ZXJ2YWxDb3VudGVyID0gbmV3IEludGVydmFsQ291bnRlcihOb3RpZmljYXRpb25zVG9hc3RzLlNQQU1fUFJPVEVDVElPTi5pbnRlcnZhbCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbW9kZWw6IElOb3RpZmljYXRpb25zTW9kZWwsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKHRoZW1lU2VydmljZSk7XG5cblx0XHR0aGlzLm5vdGlmaWNhdGlvbnNUb2FzdHNWaXNpYmxlQ29udGV4dEtleSA9IE5vdGlmaWNhdGlvbnNUb2FzdHNWaXNpYmxlQ29udGV4dC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIExheW91dFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGF5b3V0U2VydmljZS5vbkRpZExheW91dE1haW5Db250YWluZXIoZGltZW5zaW9uID0+IHRoaXMubGF5b3V0KERpbWVuc2lvbi5saWZ0KGRpbWVuc2lvbikpKSk7XG5cblx0XHQvLyBEZWxheSBzb21lIHRhc2tzIHVudGlsIGFmdGVyIHdlIGhhdmUgcmVzdG9yZWRcblx0XHQvLyB0byByZWR1Y2UgVUkgcHJlc3N1cmUgZnJvbSB0aGUgc3RhcnR1cCBwaGFzZVxuXHRcdHRoaXMubGlmZWN5Y2xlU2VydmljZS53aGVuKExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKS50aGVuKCgpID0+IHtcblxuXHRcdFx0Ly8gU2hvdyB0b2FzdCBmb3IgaW5pdGlhbCBub3RpZmljYXRpb25zIGlmIGFueVxuXHRcdFx0dGhpcy5tb2RlbC5ub3RpZmljYXRpb25zLmZvckVhY2gobm90aWZpY2F0aW9uID0+IHRoaXMuYWRkVG9hc3Qobm90aWZpY2F0aW9uKSk7XG5cblx0XHRcdC8vIFVwZGF0ZSB0b2FzdHMgb24gbm90aWZpY2F0aW9uIGNoYW5nZXNcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kZWwub25EaWRDaGFuZ2VOb3RpZmljYXRpb24oZSA9PiB0aGlzLm9uRGlkQ2hhbmdlTm90aWZpY2F0aW9uKGUpKSk7XG5cdFx0fSk7XG5cblx0XHQvLyBGaWx0ZXJcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsLm9uRGlkQ2hhbmdlRmlsdGVyKCh7IGdsb2JhbCwgc291cmNlcyB9KSA9PiB7XG5cdFx0XHRpZiAoZ2xvYmFsID09PSBOb3RpZmljYXRpb25zRmlsdGVyLkVSUk9SKSB7XG5cdFx0XHRcdHRoaXMuaGlkZSgpO1xuXHRcdFx0fSBlbHNlIGlmIChzb3VyY2VzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgW25vdGlmaWNhdGlvbl0gb2YgdGhpcy5tYXBOb3RpZmljYXRpb25Ub1RvYXN0KSB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBub3RpZmljYXRpb24uc291cmNlSWQgPT09ICdzdHJpbmcnICYmIHNvdXJjZXMuZ2V0KG5vdGlmaWNhdGlvbi5zb3VyY2VJZCkgPT09IE5vdGlmaWNhdGlvbnNGaWx0ZXIuRVJST1IgJiYgbm90aWZpY2F0aW9uLnNldmVyaXR5ICE9PSBTZXZlcml0eS5FcnJvciAmJiBub3RpZmljYXRpb24ucHJpb3JpdHkgIT09IE5vdGlmaWNhdGlvblByaW9yaXR5LlVSR0VOVCkge1xuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVUb2FzdChub3RpZmljYXRpb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VOb3RpZmljYXRpb24oZTogSU5vdGlmaWNhdGlvbkNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0c3dpdGNoIChlLmtpbmQpIHtcblx0XHRcdGNhc2UgTm90aWZpY2F0aW9uQ2hhbmdlVHlwZS5BREQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLmFkZFRvYXN0KGUuaXRlbSk7XG5cdFx0XHRjYXNlIE5vdGlmaWNhdGlvbkNoYW5nZVR5cGUuUkVNT1ZFOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5yZW1vdmVUb2FzdChlLml0ZW0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYWRkVG9hc3QoaXRlbTogSU5vdGlmaWNhdGlvblZpZXdJdGVtKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNOb3RpZmljYXRpb25zQ2VudGVyVmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuOyAvLyBkbyBub3Qgc2hvdyB0b2FzdHMgd2hpbGUgbm90aWZpY2F0aW9uIGNlbnRlciBpcyB2aXNpYmxlXG5cdFx0fVxuXG5cdFx0aWYgKGl0ZW0ucHJpb3JpdHkgPT09IE5vdGlmaWNhdGlvblByaW9yaXR5LlNJTEVOVCkge1xuXHRcdFx0cmV0dXJuOyAvLyBkbyBub3Qgc2hvdyB0b2FzdHMgZm9yIHNpbGVuY2VkIG5vdGlmaWNhdGlvbnNcblx0XHR9XG5cblx0XHQvLyBPcHRpbWl6YXRpb246IGl0IGlzIHBvc3NpYmxlIHRoYXQgYSBsb3Qgb2Ygbm90aWZpY2F0aW9ucyBhcmUgYmVpbmdcblx0XHQvLyBhZGRlZCBpbiBhIHZlcnkgc2hvcnQgdGltZS4gVG8gcHJldmVudCB0aGlzIGtpbmQgb2Ygc3BhbSwgd2UgcHJvdGVjdFxuXHRcdC8vIGFnYWluc3Qgc2hvd2luZyB0b28gbWFueSBub3RpZmljYXRpb25zIGF0IG9uY2UuIFNpbmNlIHRoZXkgY2FuIGFsd2F5c1xuXHRcdC8vIGJlIGFjY2Vzc2VkIGZyb20gdGhlIG5vdGlmaWNhdGlvbiBjZW50ZXIsIGEgdXNlciBjYW4gYWx3YXlzIGdldCB0b1xuXHRcdC8vIHRoZW0gbGF0ZXIgb24uXG5cdFx0Ly8gKHNlZSBhbHNvIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDc5MzUpXG5cdFx0aWYgKHRoaXMuYWRkZWRUb2FzdHNJbnRlcnZhbENvdW50ZXIuaW5jcmVtZW50KCkgPiBOb3RpZmljYXRpb25zVG9hc3RzLlNQQU1fUFJPVEVDVElPTi5saW1pdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIE9wdGltaXphdGlvbjogc2hvd2luZyBhIG5vdGlmaWNhdGlvbiB0b2FzdCBjYW4gYmUgZXhwZW5zaXZlXG5cdFx0Ly8gYmVjYXVzZSBvZiB0aGUgYXNzb2NpYXRlZCBhbmltYXRpb24uIElmIHRoZSByZW5kZXJlciBpcyBidXN5XG5cdFx0Ly8gZG9pbmcgYWN0dWFsIHdvcmssIHRoZSBhbmltYXRpb24gY2FuIGNhdXNlIGEgbG90IG9mIHNsb3dkb3duXG5cdFx0Ly8gQXMgc3VjaCB3ZSB1c2UgYHNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWVgIHRvIHB1c2ggb3V0XG5cdFx0Ly8gdGhlIHRvYXN0IHVudGlsIHRoZSByZW5kZXJlciBoYXMgdGltZSB0byBwcm9jZXNzIGl0LlxuXHRcdC8vIChzZWUgYWxzbyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTA3OTM1KVxuXHRcdGNvbnN0IGl0ZW1EaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0aGlzLm1hcE5vdGlmaWNhdGlvblRvRGlzcG9zYWJsZS5zZXQoaXRlbSwgaXRlbURpc3Bvc2FibGVzKTtcblx0XHRpdGVtRGlzcG9zYWJsZXMuYWRkKHNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoZ2V0V2luZG93KHRoaXMuY29udGFpbmVyKSwgKCkgPT4gdGhpcy5kb0FkZFRvYXN0KGl0ZW0sIGl0ZW1EaXNwb3NhYmxlcykpKTtcblx0fVxuXG5cdHByaXZhdGUgZG9BZGRUb2FzdChpdGVtOiBJTm90aWZpY2F0aW9uVmlld0l0ZW0sIGl0ZW1EaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogdm9pZCB7XG5cblx0XHQvLyBMYXppbHkgY3JlYXRlIHRvYXN0cyBjb250YWluZXJzXG5cdFx0bGV0IG5vdGlmaWNhdGlvbnNUb2FzdHNDb250YWluZXIgPSB0aGlzLm5vdGlmaWNhdGlvbnNUb2FzdHNDb250YWluZXI7XG5cdFx0aWYgKCFub3RpZmljYXRpb25zVG9hc3RzQ29udGFpbmVyKSB7XG5cdFx0XHRub3RpZmljYXRpb25zVG9hc3RzQ29udGFpbmVyID0gdGhpcy5ub3RpZmljYXRpb25zVG9hc3RzQ29udGFpbmVyID0gJCgnLm5vdGlmaWNhdGlvbnMtdG9hc3RzJyk7XG5cblx0XHRcdHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKG5vdGlmaWNhdGlvbnNUb2FzdHNDb250YWluZXIpO1xuXHRcdH1cblxuXHRcdC8vIE1ha2UgVmlzaWJsZVxuXHRcdG5vdGlmaWNhdGlvbnNUb2FzdHNDb250YWluZXIuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuXG5cdFx0Ly8gQ29udGFpbmVyXG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uVG9hc3RDb250YWluZXIgPSAkKCcubm90aWZpY2F0aW9uLXRvYXN0LWNvbnRhaW5lcicpO1xuXG5cdFx0Y29uc3QgZmlyc3RUb2FzdCA9IG5vdGlmaWNhdGlvbnNUb2FzdHNDb250YWluZXIuZmlyc3RDaGlsZDtcblx0XHRpZiAoZmlyc3RUb2FzdCkge1xuXHRcdFx0bm90aWZpY2F0aW9uc1RvYXN0c0NvbnRhaW5lci5pbnNlcnRCZWZvcmUobm90aWZpY2F0aW9uVG9hc3RDb250YWluZXIsIGZpcnN0VG9hc3QpOyAvLyBhbHdheXMgZmlyc3Rcblx0XHR9IGVsc2Uge1xuXHRcdFx0bm90aWZpY2F0aW9uc1RvYXN0c0NvbnRhaW5lci5hcHBlbmRDaGlsZChub3RpZmljYXRpb25Ub2FzdENvbnRhaW5lcik7XG5cdFx0fVxuXG5cdFx0Ly8gVG9hc3Rcblx0XHRjb25zdCBub3RpZmljYXRpb25Ub2FzdCA9ICQoJy5ub3RpZmljYXRpb24tdG9hc3QnKTtcblx0XHRub3RpZmljYXRpb25Ub2FzdENvbnRhaW5lci5hcHBlbmRDaGlsZChub3RpZmljYXRpb25Ub2FzdCk7XG5cblx0XHQvLyBDcmVhdGUgdG9hc3Qgd2l0aCBpdGVtIGFuZCBzaG93XG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uTGlzdCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90aWZpY2F0aW9uc0xpc3QsIG5vdGlmaWNhdGlvblRvYXN0LCB7XG5cdFx0XHR2ZXJ0aWNhbFNjcm9sbE1vZGU6IFNjcm9sbGJhclZpc2liaWxpdHkuSGlkZGVuLFxuXHRcdFx0d2lkZ2V0QXJpYUxhYmVsOiAoKCkgPT4ge1xuXG5cdFx0XHRcdGlmICghaXRlbS5zb3VyY2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ25vdGlmaWNhdGlvbkFyaWFMYWJlbCcsIFwiezB9LCBub3RpZmljYXRpb25cIiwgaXRlbS5tZXNzYWdlLnJhdyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdub3RpZmljYXRpb25XaXRoU291cmNlQXJpYUxhYmVsJywgXCJ7MH0sIHNvdXJjZTogezF9LCBub3RpZmljYXRpb25cIiwgaXRlbS5tZXNzYWdlLnJhdywgaXRlbS5zb3VyY2UpO1xuXHRcdFx0fSkoKVxuXHRcdH0pO1xuXHRcdGl0ZW1EaXNwb3NhYmxlcy5hZGQobm90aWZpY2F0aW9uTGlzdCk7XG5cblx0XHRjb25zdCB0b2FzdDogSU5vdGlmaWNhdGlvblRvYXN0ID0geyBpdGVtLCBsaXN0OiBub3RpZmljYXRpb25MaXN0LCBjb250YWluZXI6IG5vdGlmaWNhdGlvblRvYXN0Q29udGFpbmVyLCB0b2FzdDogbm90aWZpY2F0aW9uVG9hc3QgfTtcblx0XHR0aGlzLm1hcE5vdGlmaWNhdGlvblRvVG9hc3Quc2V0KGl0ZW0sIHRvYXN0KTtcblxuXHRcdC8vIFdoZW4gZGlzcG9zZWQsIHJlbW92ZSBhcyB2aXNpYmxlXG5cdFx0aXRlbURpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy51cGRhdGVUb2FzdFZpc2liaWxpdHkodG9hc3QsIGZhbHNlKSkpO1xuXG5cdFx0Ly8gTWFrZSB2aXNpYmxlXG5cdFx0bm90aWZpY2F0aW9uTGlzdC5zaG93KCk7XG5cblx0XHQvLyBMYXlvdXQgbGlzdHNcblx0XHRjb25zdCBtYXhEaW1lbnNpb25zID0gdGhpcy5jb21wdXRlTWF4RGltZW5zaW9ucygpO1xuXHRcdHRoaXMubGF5b3V0TGlzdHMobWF4RGltZW5zaW9ucy53aWR0aCk7XG5cblx0XHQvLyBTaG93IG5vdGlmaWNhdGlvblxuXHRcdG5vdGlmaWNhdGlvbkxpc3QudXBkYXRlTm90aWZpY2F0aW9uc0xpc3QoMCwgMCwgW2l0ZW1dKTtcblxuXHRcdC8vIExheW91dCBjb250YWluZXI6IG9ubHkgYWZ0ZXIgd2Ugc2hvdyB0aGUgbm90aWZpY2F0aW9uIHRvIGVuc3VyZSB0aGF0XG5cdFx0Ly8gdGhlIGhlaWdodCBjb21wdXRhdGlvbiB0YWtlcyB0aGUgY29udGVudCBvZiBpdCBpbnRvIGFjY291bnQhXG5cdFx0dGhpcy5sYXlvdXRDb250YWluZXIobWF4RGltZW5zaW9ucy5oZWlnaHQpO1xuXG5cdFx0Ly8gUmUtZHJhdyBlbnRpcmUgaXRlbSB3aGVuIGV4cGFuc2lvbiBjaGFuZ2VzIHRvIHJldmVhbCBvciBoaWRlIGRldGFpbHNcblx0XHRpdGVtRGlzcG9zYWJsZXMuYWRkKGl0ZW0ub25EaWRDaGFuZ2VFeHBhbnNpb24oKCkgPT4ge1xuXHRcdFx0bm90aWZpY2F0aW9uTGlzdC51cGRhdGVOb3RpZmljYXRpb25zTGlzdCgwLCAxLCBbaXRlbV0pO1xuXHRcdH0pKTtcblxuXHRcdC8vIEhhbmRsZSBjb250ZW50IGNoYW5nZXNcblx0XHQvLyAtIGFjdGlvbnM6IHJlLWRyYXcgdG8gcHJvcGVybHkgc2hvdyB0aGVtXG5cdFx0Ly8gLSBtZXNzYWdlOiB1cGRhdGUgbm90aWZpY2F0aW9uIGhlaWdodCB1bmxlc3MgY29sbGFwc2VkXG5cdFx0aXRlbURpc3Bvc2FibGVzLmFkZChpdGVtLm9uRGlkQ2hhbmdlQ29udGVudChlID0+IHtcblx0XHRcdHN3aXRjaCAoZS5raW5kKSB7XG5cdFx0XHRcdGNhc2UgTm90aWZpY2F0aW9uVmlld0l0ZW1Db250ZW50Q2hhbmdlS2luZC5BQ1RJT05TOlxuXHRcdFx0XHRcdG5vdGlmaWNhdGlvbkxpc3QudXBkYXRlTm90aWZpY2F0aW9uc0xpc3QoMCwgMSwgW2l0ZW1dKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBOb3RpZmljYXRpb25WaWV3SXRlbUNvbnRlbnRDaGFuZ2VLaW5kLk1FU1NBR0U6XG5cdFx0XHRcdFx0aWYgKGl0ZW0uZXhwYW5kZWQpIHtcblx0XHRcdFx0XHRcdG5vdGlmaWNhdGlvbkxpc3QudXBkYXRlTm90aWZpY2F0aW9uSGVpZ2h0KGl0ZW0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBSZW1vdmUgd2hlbiBpdGVtIGdldHMgY2xvc2VkXG5cdFx0RXZlbnQub25jZShpdGVtLm9uRGlkQ2xvc2UpKCgpID0+IHtcblx0XHRcdHRoaXMucmVtb3ZlVG9hc3QoaXRlbSk7XG5cdFx0fSk7XG5cblx0XHQvLyBBdXRvbWF0aWNhbGx5IHB1cmdlIG5vbi1zdGlja3kgbm90aWZpY2F0aW9uc1xuXHRcdHRoaXMucHVyZ2VOb3RpZmljYXRpb24oaXRlbSwgbm90aWZpY2F0aW9uVG9hc3RDb250YWluZXIsIG5vdGlmaWNhdGlvbkxpc3QsIGl0ZW1EaXNwb3NhYmxlcyk7XG5cblx0XHQvLyBUaGVtaW5nXG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblxuXHRcdC8vIENvbnRleHQgS2V5XG5cdFx0dGhpcy5ub3RpZmljYXRpb25zVG9hc3RzVmlzaWJsZUNvbnRleHRLZXkuc2V0KHRydWUpO1xuXG5cdFx0Ly8gQW5pbWF0ZSBpblxuXHRcdG5vdGlmaWNhdGlvblRvYXN0LmNsYXNzTGlzdC5hZGQoJ25vdGlmaWNhdGlvbi1mYWRlLWluJyk7XG5cdFx0aXRlbURpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIobm90aWZpY2F0aW9uVG9hc3QsICd0cmFuc2l0aW9uZW5kJywgKCkgPT4ge1xuXHRcdFx0bm90aWZpY2F0aW9uVG9hc3QuY2xhc3NMaXN0LnJlbW92ZSgnbm90aWZpY2F0aW9uLWZhZGUtaW4nKTtcblx0XHRcdG5vdGlmaWNhdGlvblRvYXN0LmNsYXNzTGlzdC5hZGQoJ25vdGlmaWNhdGlvbi1mYWRlLWluLWRvbmUnKTtcblx0XHR9KSk7XG5cblx0XHQvLyBNYXJrIGFzIHZpc2libGVcblx0XHRpdGVtLnVwZGF0ZVZpc2liaWxpdHkodHJ1ZSk7XG5cblx0XHQvLyBFdmVudHNcblx0XHRpZiAoIXRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0dGhpcy5faXNWaXNpYmxlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBwdXJnZU5vdGlmaWNhdGlvbihpdGVtOiBJTm90aWZpY2F0aW9uVmlld0l0ZW0sIG5vdGlmaWNhdGlvblRvYXN0Q29udGFpbmVyOiBIVE1MRWxlbWVudCwgbm90aWZpY2F0aW9uTGlzdDogTm90aWZpY2F0aW9uc0xpc3QsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiB2b2lkIHtcblxuXHRcdC8vIFRyYWNrIG1vdXNlIG92ZXIgaXRlbVxuXHRcdGxldCBpc01vdXNlT3ZlclRvYXN0ID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihub3RpZmljYXRpb25Ub2FzdENvbnRhaW5lciwgRXZlbnRUeXBlLk1PVVNFX09WRVIsICgpID0+IGlzTW91c2VPdmVyVG9hc3QgPSB0cnVlKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihub3RpZmljYXRpb25Ub2FzdENvbnRhaW5lciwgRXZlbnRUeXBlLk1PVVNFX09VVCwgKCkgPT4gaXNNb3VzZU92ZXJUb2FzdCA9IGZhbHNlKSk7XG5cblx0XHQvLyBJbnN0YWxsIFRpbWVycyB0byBQdXJnZSBOb3RpZmljYXRpb25cblx0XHRsZXQgcHVyZ2VUaW1lb3V0SGFuZGxlOiBhbnk7XG5cdFx0bGV0IGxpc3RlbmVyOiBJRGlzcG9zYWJsZTtcblxuXHRcdGNvbnN0IGhpZGVBZnRlclRpbWVvdXQgPSAoKSA9PiB7XG5cblx0XHRcdHB1cmdlVGltZW91dEhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXG5cdFx0XHRcdC8vIElmIHRoZSB3aW5kb3cgZG9lcyBub3QgaGF2ZSBmb2N1cywgd2Ugd2FpdCBmb3IgdGhlIHdpbmRvdyB0byBnYWluIGZvY3VzXG5cdFx0XHRcdC8vIGFnYWluIGJlZm9yZSB0cmlnZ2VyaW5nIHRoZSB0aW1lb3V0IGFnYWluLiBUaGlzIHByZXZlbnRzIGFuIGlzc3VlIHdoZXJlXG5cdFx0XHRcdC8vIGZvY3Vzc2luZyB0aGUgd2luZG93IGNvdWxkIGltbWVkaWF0ZWx5IGhpZGUgdGhlIG5vdGlmaWNhdGlvbiBiZWNhdXNlIHRoZVxuXHRcdFx0XHQvLyB0aW1lb3V0IHdhcyB0cmlnZ2VyZWQgYWdhaW4uXG5cdFx0XHRcdGlmICghdGhpcy5ob3N0U2VydmljZS5oYXNGb2N1cykge1xuXHRcdFx0XHRcdGlmICghbGlzdGVuZXIpIHtcblx0XHRcdFx0XHRcdGxpc3RlbmVyID0gdGhpcy5ob3N0U2VydmljZS5vbkRpZENoYW5nZUZvY3VzKGZvY3VzID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKGZvY3VzKSB7XG5cdFx0XHRcdFx0XHRcdFx0aGlkZUFmdGVyVGltZW91dCgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChsaXN0ZW5lcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gT3RoZXJ3aXNlLi4uXG5cdFx0XHRcdGVsc2UgaWYgKFxuXHRcdFx0XHRcdGl0ZW0uc3RpY2t5IHx8XHRcdFx0XHRcdFx0XHRcdC8vIG5ldmVyIGhpZGUgc3RpY2t5IG5vdGlmaWNhdGlvbnNcblx0XHRcdFx0XHRub3RpZmljYXRpb25MaXN0Lmhhc0ZvY3VzKCkgfHxcdFx0XHRcdC8vIG5ldmVyIGhpZGUgbm90aWZpY2F0aW9ucyB3aXRoIGZvY3VzXG5cdFx0XHRcdFx0aXNNb3VzZU92ZXJUb2FzdFx0XHRcdFx0XHRcdFx0Ly8gbmV2ZXIgaGlkZSBub3RpZmljYXRpb25zIHVuZGVyIG1vdXNlXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdGhpZGVBZnRlclRpbWVvdXQoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnJlbW92ZVRvYXN0KGl0ZW0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBOb3RpZmljYXRpb25zVG9hc3RzLlBVUkdFX1RJTUVPVVRbaXRlbS5zZXZlcml0eV0pO1xuXHRcdH07XG5cblx0XHRoaWRlQWZ0ZXJUaW1lb3V0KCk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGNsZWFyVGltZW91dChwdXJnZVRpbWVvdXRIYW5kbGUpKSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZVRvYXN0KGl0ZW06IElOb3RpZmljYXRpb25WaWV3SXRlbSk6IHZvaWQge1xuXHRcdGxldCBmb2N1c0VkaXRvciA9IGZhbHNlO1xuXG5cdFx0Ly8gVUlcblx0XHRjb25zdCBub3RpZmljYXRpb25Ub2FzdCA9IHRoaXMubWFwTm90aWZpY2F0aW9uVG9Ub2FzdC5nZXQoaXRlbSk7XG5cdFx0aWYgKG5vdGlmaWNhdGlvblRvYXN0KSB7XG5cdFx0XHRjb25zdCB0b2FzdEhhc0RPTUZvY3VzID0gaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudChub3RpZmljYXRpb25Ub2FzdC5jb250YWluZXIpO1xuXHRcdFx0aWYgKHRvYXN0SGFzRE9NRm9jdXMpIHtcblx0XHRcdFx0Zm9jdXNFZGl0b3IgPSAhKHRoaXMuZm9jdXNOZXh0KCkgfHwgdGhpcy5mb2N1c1ByZXZpb3VzKCkpOyAvLyBmb2N1cyBuZXh0IGlmIGFueSwgb3RoZXJ3aXNlIGZvY3VzIGVkaXRvclxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm1hcE5vdGlmaWNhdGlvblRvVG9hc3QuZGVsZXRlKGl0ZW0pO1xuXHRcdH1cblxuXHRcdC8vIERpc3Bvc2FibGVzXG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uRGlzcG9zYWJsZXMgPSB0aGlzLm1hcE5vdGlmaWNhdGlvblRvRGlzcG9zYWJsZS5nZXQoaXRlbSk7XG5cdFx0aWYgKG5vdGlmaWNhdGlvbkRpc3Bvc2FibGVzKSB7XG5cdFx0XHRkaXNwb3NlKG5vdGlmaWNhdGlvbkRpc3Bvc2FibGVzKTtcblxuXHRcdFx0dGhpcy5tYXBOb3RpZmljYXRpb25Ub0Rpc3Bvc2FibGUuZGVsZXRlKGl0ZW0pO1xuXHRcdH1cblxuXHRcdC8vIExheW91dCBpZiB3ZSBzdGlsbCBoYXZlIHRvYXN0c1xuXHRcdGlmICh0aGlzLm1hcE5vdGlmaWNhdGlvblRvVG9hc3Quc2l6ZSA+IDApIHtcblx0XHRcdHRoaXMubGF5b3V0KHRoaXMud29ya2JlbmNoRGltZW5zaW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlIGhpZGUgaWYgbm8gbW9yZSB0b2FzdHMgdG8gc2hvd1xuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy5kb0hpZGUoKTtcblxuXHRcdFx0Ly8gTW92ZSBmb2N1cyBiYWNrIHRvIGVkaXRvciBncm91cCBhcyBuZWVkZWRcblx0XHRcdGlmIChmb2N1c0VkaXRvcikge1xuXHRcdFx0XHR0aGlzLmVkaXRvckdyb3VwU2VydmljZS5hY3RpdmVHcm91cC5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlVG9hc3RzKCk6IHZvaWQge1xuXG5cdFx0Ly8gVG9hc3Rcblx0XHR0aGlzLm1hcE5vdGlmaWNhdGlvblRvVG9hc3QuY2xlYXIoKTtcblxuXHRcdC8vIERpc3Bvc2FibGVzXG5cdFx0dGhpcy5tYXBOb3RpZmljYXRpb25Ub0Rpc3Bvc2FibGUuZm9yRWFjaChkaXNwb3NhYmxlID0+IGRpc3Bvc2UoZGlzcG9zYWJsZSkpO1xuXHRcdHRoaXMubWFwTm90aWZpY2F0aW9uVG9EaXNwb3NhYmxlLmNsZWFyKCk7XG5cblx0XHR0aGlzLmRvSGlkZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0hpZGUoKTogdm9pZCB7XG5cdFx0dGhpcy5ub3RpZmljYXRpb25zVG9hc3RzQ29udGFpbmVyPy5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG5cblx0XHQvLyBDb250ZXh0IEtleVxuXHRcdHRoaXMubm90aWZpY2F0aW9uc1RvYXN0c1Zpc2libGVDb250ZXh0S2V5LnNldChmYWxzZSk7XG5cblx0XHQvLyBFdmVudHNcblx0XHRpZiAodGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLl9pc1Zpc2libGUgPSBmYWxzZTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0aGlkZSgpOiB2b2lkIHtcblx0XHRjb25zdCBmb2N1c0VkaXRvciA9IHRoaXMubm90aWZpY2F0aW9uc1RvYXN0c0NvbnRhaW5lciA/IGlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQodGhpcy5ub3RpZmljYXRpb25zVG9hc3RzQ29udGFpbmVyKSA6IGZhbHNlO1xuXG5cdFx0dGhpcy5yZW1vdmVUb2FzdHMoKTtcblxuXHRcdGlmIChmb2N1c0VkaXRvcikge1xuXHRcdFx0dGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRmb2N1cygpOiBib29sZWFuIHtcblx0XHRjb25zdCB0b2FzdHMgPSB0aGlzLmdldFRvYXN0cyhUb2FzdFZpc2liaWxpdHkuVklTSUJMRSk7XG5cdFx0aWYgKHRvYXN0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0b2FzdHNbMF0ubGlzdC5mb2N1c0ZpcnN0KCk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGZvY3VzTmV4dCgpOiBib29sZWFuIHtcblx0XHRjb25zdCB0b2FzdHMgPSB0aGlzLmdldFRvYXN0cyhUb2FzdFZpc2liaWxpdHkuVklTSUJMRSk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0b2FzdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHRvYXN0ID0gdG9hc3RzW2ldO1xuXHRcdFx0aWYgKHRvYXN0Lmxpc3QuaGFzRm9jdXMoKSkge1xuXHRcdFx0XHRjb25zdCBuZXh0VG9hc3QgPSB0b2FzdHNbaSArIDFdO1xuXHRcdFx0XHRpZiAobmV4dFRvYXN0KSB7XG5cdFx0XHRcdFx0bmV4dFRvYXN0Lmxpc3QuZm9jdXNGaXJzdCgpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRmb2N1c1ByZXZpb3VzKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHRvYXN0cyA9IHRoaXMuZ2V0VG9hc3RzKFRvYXN0VmlzaWJpbGl0eS5WSVNJQkxFKTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRvYXN0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgdG9hc3QgPSB0b2FzdHNbaV07XG5cdFx0XHRpZiAodG9hc3QubGlzdC5oYXNGb2N1cygpKSB7XG5cdFx0XHRcdGNvbnN0IHByZXZpb3VzVG9hc3QgPSB0b2FzdHNbaSAtIDFdO1xuXHRcdFx0XHRpZiAocHJldmlvdXNUb2FzdCkge1xuXHRcdFx0XHRcdHByZXZpb3VzVG9hc3QubGlzdC5mb2N1c0ZpcnN0KCk7XG5cblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGZvY3VzRmlyc3QoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgdG9hc3QgPSB0aGlzLmdldFRvYXN0cyhUb2FzdFZpc2liaWxpdHkuVklTSUJMRSlbMF07XG5cdFx0aWYgKHRvYXN0KSB7XG5cdFx0XHR0b2FzdC5saXN0LmZvY3VzRmlyc3QoKTtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Zm9jdXNMYXN0KCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHRvYXN0cyA9IHRoaXMuZ2V0VG9hc3RzKFRvYXN0VmlzaWJpbGl0eS5WSVNJQkxFKTtcblx0XHRpZiAodG9hc3RzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRvYXN0c1t0b2FzdHMubGVuZ3RoIC0gMV0ubGlzdC5mb2N1c0ZpcnN0KCk7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHVwZGF0ZShpc0NlbnRlclZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pc05vdGlmaWNhdGlvbnNDZW50ZXJWaXNpYmxlICE9PSBpc0NlbnRlclZpc2libGUpIHtcblx0XHRcdHRoaXMuaXNOb3RpZmljYXRpb25zQ2VudGVyVmlzaWJsZSA9IGlzQ2VudGVyVmlzaWJsZTtcblxuXHRcdFx0Ly8gSGlkZSBhbGwgdG9hc3RzIHdoZW4gdGhlIG5vdGlmaWNhdGlvbmNlbnRlciBnZXRzIHZpc2libGVcblx0XHRcdGlmICh0aGlzLmlzTm90aWZpY2F0aW9uc0NlbnRlclZpc2libGUpIHtcblx0XHRcdFx0dGhpcy5yZW1vdmVUb2FzdHMoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSB1cGRhdGVTdHlsZXMoKTogdm9pZCB7XG5cdFx0dGhpcy5tYXBOb3RpZmljYXRpb25Ub1RvYXN0LmZvckVhY2goKHsgdG9hc3QgfSkgPT4ge1xuXHRcdFx0Y29uc3QgYmFja2dyb3VuZENvbG9yID0gdGhpcy5nZXRDb2xvcihOT1RJRklDQVRJT05TX0JBQ0tHUk9VTkQpO1xuXHRcdFx0dG9hc3Quc3R5bGUuYmFja2dyb3VuZCA9IGJhY2tncm91bmRDb2xvciA/IGJhY2tncm91bmRDb2xvciA6ICcnO1xuXG5cdFx0XHRjb25zdCB3aWRnZXRTaGFkb3dDb2xvciA9IHRoaXMuZ2V0Q29sb3Iod2lkZ2V0U2hhZG93KTtcblx0XHRcdHRvYXN0LnN0eWxlLmJveFNoYWRvdyA9IHdpZGdldFNoYWRvd0NvbG9yID8gYDAgMCA4cHggMnB4ICR7d2lkZ2V0U2hhZG93Q29sb3J9YCA6ICcnO1xuXG5cdFx0XHRjb25zdCBib3JkZXJDb2xvciA9IHRoaXMuZ2V0Q29sb3IoTk9USUZJQ0FUSU9OU19UT0FTVF9CT1JERVIpO1xuXHRcdFx0dG9hc3Quc3R5bGUuYm9yZGVyID0gYm9yZGVyQ29sb3IgPyBgMXB4IHNvbGlkICR7Ym9yZGVyQ29sb3J9YCA6ICcnO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRUb2FzdHMoc3RhdGU6IFRvYXN0VmlzaWJpbGl0eSk6IElOb3RpZmljYXRpb25Ub2FzdFtdIHtcblx0XHRjb25zdCBub3RpZmljYXRpb25Ub2FzdHM6IElOb3RpZmljYXRpb25Ub2FzdFtdID0gW107XG5cblx0XHR0aGlzLm1hcE5vdGlmaWNhdGlvblRvVG9hc3QuZm9yRWFjaCh0b2FzdCA9PiB7XG5cdFx0XHRzd2l0Y2ggKHN0YXRlKSB7XG5cdFx0XHRcdGNhc2UgVG9hc3RWaXNpYmlsaXR5LkhJRERFTl9PUl9WSVNJQkxFOlxuXHRcdFx0XHRcdG5vdGlmaWNhdGlvblRvYXN0cy5wdXNoKHRvYXN0KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBUb2FzdFZpc2liaWxpdHkuSElEREVOOlxuXHRcdFx0XHRcdGlmICghdGhpcy5pc1RvYXN0SW5ET00odG9hc3QpKSB7XG5cdFx0XHRcdFx0XHRub3RpZmljYXRpb25Ub2FzdHMucHVzaCh0b2FzdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFRvYXN0VmlzaWJpbGl0eS5WSVNJQkxFOlxuXHRcdFx0XHRcdGlmICh0aGlzLmlzVG9hc3RJbkRPTSh0b2FzdCkpIHtcblx0XHRcdFx0XHRcdG5vdGlmaWNhdGlvblRvYXN0cy5wdXNoKHRvYXN0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gbm90aWZpY2F0aW9uVG9hc3RzLnJldmVyc2UoKTsgLy8gZnJvbSBuZXdlc3QgdG8gb2xkZXN0XG5cdH1cblxuXHRsYXlvdXQoZGltZW5zaW9uOiBEaW1lbnNpb24gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLndvcmtiZW5jaERpbWVuc2lvbnMgPSBkaW1lbnNpb247XG5cblx0XHRjb25zdCBtYXhEaW1lbnNpb25zID0gdGhpcy5jb21wdXRlTWF4RGltZW5zaW9ucygpO1xuXG5cdFx0Ly8gSGlkZSB0b2FzdHMgdGhhdCBleGNlZWQgaGVpZ2h0XG5cdFx0aWYgKG1heERpbWVuc2lvbnMuaGVpZ2h0KSB7XG5cdFx0XHR0aGlzLmxheW91dENvbnRhaW5lcihtYXhEaW1lbnNpb25zLmhlaWdodCk7XG5cdFx0fVxuXG5cdFx0Ly8gTGF5b3V0IGFsbCBsaXN0cyBvZiB0b2FzdHNcblx0XHR0aGlzLmxheW91dExpc3RzKG1heERpbWVuc2lvbnMud2lkdGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wdXRlTWF4RGltZW5zaW9ucygpOiBEaW1lbnNpb24ge1xuXHRcdGNvbnN0IG1heFdpZHRoID0gTm90aWZpY2F0aW9uc1RvYXN0cy5NQVhfV0lEVEg7XG5cblx0XHRsZXQgYXZhaWxhYmxlV2lkdGggPSBtYXhXaWR0aDtcblx0XHRsZXQgYXZhaWxhYmxlSGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0XHRpZiAodGhpcy53b3JrYmVuY2hEaW1lbnNpb25zKSB7XG5cblx0XHRcdC8vIE1ha2Ugc3VyZSBub3RpZmljYXRpb25zIGFyZSBub3QgZXhjZWRpbmcgYXZhaWxhYmxlIHdpZHRoXG5cdFx0XHRhdmFpbGFibGVXaWR0aCA9IHRoaXMud29ya2JlbmNoRGltZW5zaW9ucy53aWR0aDtcblx0XHRcdGF2YWlsYWJsZVdpZHRoIC09ICgyICogOCk7IC8vIGFkanVzdCBmb3IgcGFkZGluZ3MgbGVmdCBhbmQgcmlnaHRcblxuXHRcdFx0Ly8gTWFrZSBzdXJlIG5vdGlmaWNhdGlvbnMgYXJlIG5vdCBleGNlZWRpbmcgYXZhaWxhYmxlIGhlaWdodFxuXHRcdFx0YXZhaWxhYmxlSGVpZ2h0ID0gdGhpcy53b3JrYmVuY2hEaW1lbnNpb25zLmhlaWdodDtcblx0XHRcdGlmICh0aGlzLmxheW91dFNlcnZpY2UuaXNWaXNpYmxlKFBhcnRzLlNUQVRVU0JBUl9QQVJULCBtYWluV2luZG93KSkge1xuXHRcdFx0XHRhdmFpbGFibGVIZWlnaHQgLT0gMjI7IC8vIGFkanVzdCBmb3Igc3RhdHVzIGJhclxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5sYXlvdXRTZXJ2aWNlLmlzVmlzaWJsZShQYXJ0cy5USVRMRUJBUl9QQVJULCBtYWluV2luZG93KSkge1xuXHRcdFx0XHRhdmFpbGFibGVIZWlnaHQgLT0gMjI7IC8vIGFkanVzdCBmb3IgdGl0bGUgYmFyXG5cdFx0XHR9XG5cblx0XHRcdGF2YWlsYWJsZUhlaWdodCAtPSAoMiAqIDEyKTsgLy8gYWRqdXN0IGZvciBwYWRkaW5ncyB0b3AgYW5kIGJvdHRvbVxuXHRcdH1cblxuXHRcdGF2YWlsYWJsZUhlaWdodCA9IHR5cGVvZiBhdmFpbGFibGVIZWlnaHQgPT09ICdudW1iZXInXG5cdFx0XHQ/IE1hdGgucm91bmQoYXZhaWxhYmxlSGVpZ2h0ICogMC42MTgpIC8vIHRyeSB0byBub3QgY292ZXIgdGhlIGZ1bGwgaGVpZ2h0IGZvciBzdGFja2VkIHRvYXN0c1xuXHRcdFx0OiAwO1xuXG5cdFx0cmV0dXJuIG5ldyBEaW1lbnNpb24oTWF0aC5taW4obWF4V2lkdGgsIGF2YWlsYWJsZVdpZHRoKSwgYXZhaWxhYmxlSGVpZ2h0KTtcblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0TGlzdHMod2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMubWFwTm90aWZpY2F0aW9uVG9Ub2FzdC5mb3JFYWNoKCh7IGxpc3QgfSkgPT4gbGlzdC5sYXlvdXQod2lkdGgpKTtcblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0Q29udGFpbmVyKGhlaWdodFRvR2l2ZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0bGV0IHZpc2libGVUb2FzdHMgPSAwO1xuXHRcdGZvciAoY29uc3QgdG9hc3Qgb2YgdGhpcy5nZXRUb2FzdHMoVG9hc3RWaXNpYmlsaXR5LkhJRERFTl9PUl9WSVNJQkxFKSkge1xuXG5cdFx0XHQvLyBJbiBvcmRlciB0byBtZWFzdXJlIHRoZSBjbGllbnQgaGVpZ2h0LCB0aGUgZWxlbWVudCBjYW5ub3QgaGF2ZSBkaXNwbGF5OiBub25lXG5cdFx0XHR0b2FzdC5jb250YWluZXIuc3R5bGUub3BhY2l0eSA9ICcwJztcblx0XHRcdHRoaXMudXBkYXRlVG9hc3RWaXNpYmlsaXR5KHRvYXN0LCB0cnVlKTtcblxuXHRcdFx0aGVpZ2h0VG9HaXZlIC09IHRvYXN0LmNvbnRhaW5lci5vZmZzZXRIZWlnaHQ7XG5cblx0XHRcdGxldCBtYWtlVmlzaWJsZSA9IGZhbHNlO1xuXHRcdFx0aWYgKHZpc2libGVUb2FzdHMgPT09IE5vdGlmaWNhdGlvbnNUb2FzdHMuTUFYX05PVElGSUNBVElPTlMpIHtcblx0XHRcdFx0bWFrZVZpc2libGUgPSBmYWxzZTsgLy8gbmV2ZXIgc2hvdyBtb3JlIHRoYW4gTUFYX05PVElGSUNBVElPTlNcblx0XHRcdH0gZWxzZSBpZiAoaGVpZ2h0VG9HaXZlID49IDApIHtcblx0XHRcdFx0bWFrZVZpc2libGUgPSB0cnVlOyAvLyBoaWRlIHRvYXN0IGlmIGF2YWlsYWJsZSBoZWlnaHQgaXMgdG9vIGxpdHRsZVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBIaWRlIG9yIHNob3cgdG9hc3QgYmFzZWQgb24gY29udGV4dFxuXHRcdFx0dGhpcy51cGRhdGVUb2FzdFZpc2liaWxpdHkodG9hc3QsIG1ha2VWaXNpYmxlKTtcblx0XHRcdHRvYXN0LmNvbnRhaW5lci5zdHlsZS5vcGFjaXR5ID0gJyc7XG5cblx0XHRcdGlmIChtYWtlVmlzaWJsZSkge1xuXHRcdFx0XHR2aXNpYmxlVG9hc3RzKys7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVUb2FzdFZpc2liaWxpdHkodG9hc3Q6IElOb3RpZmljYXRpb25Ub2FzdCwgdmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzVG9hc3RJbkRPTSh0b2FzdCkgPT09IHZpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgdmlzaWJpbGl0eSBpbiBET01cblx0XHRjb25zdCBub3RpZmljYXRpb25zVG9hc3RzQ29udGFpbmVyID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMubm90aWZpY2F0aW9uc1RvYXN0c0NvbnRhaW5lcik7XG5cdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdG5vdGlmaWNhdGlvbnNUb2FzdHNDb250YWluZXIuYXBwZW5kQ2hpbGQodG9hc3QuY29udGFpbmVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dG9hc3QuY29udGFpbmVyLnJlbW92ZSgpO1xuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSB2aXNpYmlsaXR5IGluIG1vZGVsXG5cdFx0dG9hc3QuaXRlbS51cGRhdGVWaXNpYmlsaXR5KHZpc2libGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1RvYXN0SW5ET00odG9hc3Q6IElOb3RpZmljYXRpb25Ub2FzdCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRvYXN0LmNvbnRhaW5lci5wYXJlbnRFbGVtZW50O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFTLGdCQUFnQjtBQUN6QixTQUE4Qix3QkFBeUUsNkNBQTZDO0FBQ3BKLFNBQXNCLFNBQVMs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
