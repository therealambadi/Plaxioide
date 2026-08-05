import { NoOpNotification, Severity, NotificationsFilter, NotificationPriority, isNotificationSource } from "../../platform/notification/common/notification.js";
import { toErrorMessage, isErrorWithActions } from "../../base/common/errorMessage.js";
import { Event, Emitter } from "../../base/common/event.js";
import { Disposable, toDisposable } from "../../base/common/lifecycle.js";
import { isCancellationError } from "../../base/common/errors.js";
import { Action } from "../../base/common/actions.js";
import { equals } from "../../base/common/arrays.js";
import { parseLinkedText } from "../../base/common/linkedText.js";
import { mapsStrictEqualIgnoreOrder } from "../../base/common/map.js";
var NotificationChangeType = /* @__PURE__ */ ((NotificationChangeType2) => {
  NotificationChangeType2[NotificationChangeType2["ADD"] = 0] = "ADD";
  NotificationChangeType2[NotificationChangeType2["CHANGE"] = 1] = "CHANGE";
  NotificationChangeType2[NotificationChangeType2["EXPAND_COLLAPSE"] = 2] = "EXPAND_COLLAPSE";
  NotificationChangeType2[NotificationChangeType2["REMOVE"] = 3] = "REMOVE";
  return NotificationChangeType2;
})(NotificationChangeType || {});
var StatusMessageChangeType = /* @__PURE__ */ ((StatusMessageChangeType2) => {
  StatusMessageChangeType2[StatusMessageChangeType2["ADD"] = 0] = "ADD";
  StatusMessageChangeType2[StatusMessageChangeType2["REMOVE"] = 1] = "REMOVE";
  return StatusMessageChangeType2;
})(StatusMessageChangeType || {});
class NotificationHandle extends Disposable {
  constructor(item, onClose) {
    super();
    this.item = item;
    this.onClose = onClose;
    this._onDidClose = this._register(new Emitter());
    this.onDidClose = this._onDidClose.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.item.onDidChangeVisibility((visible) => this._onDidChangeVisibility.fire(visible)));
    Event.once(this.item.onDidClose)(() => {
      this._onDidClose.fire();
      this.dispose();
    });
  }
  get progress() {
    return this.item.progress;
  }
  updateSeverity(severity) {
    this.item.updateSeverity(severity);
  }
  updateMessage(message) {
    this.item.updateMessage(message);
  }
  updateActions(actions) {
    this.item.updateActions(actions);
  }
  close() {
    this.onClose(this.item);
    this.dispose();
  }
}
const _NotificationsModel = class _NotificationsModel extends Disposable {
  constructor() {
    super(...arguments);
    this._onDidChangeNotification = this._register(new Emitter());
    this.onDidChangeNotification = this._onDidChangeNotification.event;
    this._onDidChangeStatusMessage = this._register(new Emitter());
    this.onDidChangeStatusMessage = this._onDidChangeStatusMessage.event;
    this._onDidChangeFilter = this._register(new Emitter());
    this.onDidChangeFilter = this._onDidChangeFilter.event;
    this._notifications = [];
    this.filter = {
      global: NotificationsFilter.OFF,
      sources: /* @__PURE__ */ new Map()
    };
  }
  get notifications() {
    return this._notifications;
  }
  get statusMessage() {
    return this._statusMessage;
  }
  setFilter(filter) {
    let globalChanged = false;
    if (typeof filter.global === "number") {
      globalChanged = this.filter.global !== filter.global;
      this.filter.global = filter.global;
    }
    let sourcesChanged = false;
    if (filter.sources) {
      sourcesChanged = !mapsStrictEqualIgnoreOrder(this.filter.sources, filter.sources);
      this.filter.sources = filter.sources;
    }
    if (globalChanged || sourcesChanged) {
      this._onDidChangeFilter.fire({
        global: globalChanged ? filter.global : void 0,
        sources: sourcesChanged ? filter.sources : void 0
      });
    }
  }
  addNotification(notification) {
    const item = this.createViewItem(notification);
    if (!item) {
      return _NotificationsModel.NO_OP_NOTIFICATION;
    }
    const duplicate = this.findNotification(item);
    duplicate?.close();
    this._notifications.splice(0, 0, item);
    this._onDidChangeNotification.fire({ item, index: 0, kind: 0 /* ADD */ });
    return new NotificationHandle(item, (item2) => this.onClose(item2));
  }
  onClose(item) {
    const liveItem = this.findNotification(item);
    if (liveItem && liveItem !== item) {
      liveItem.close();
    } else {
      item.close();
    }
  }
  findNotification(item) {
    return this._notifications.find((notification) => notification.equals(item));
  }
  createViewItem(notification) {
    const item = NotificationViewItem.create(notification, this.filter);
    if (!item) {
      return void 0;
    }
    const fireNotificationChangeEvent = (kind, detail) => {
      const index = this._notifications.indexOf(item);
      if (index >= 0) {
        this._onDidChangeNotification.fire({ item, index, kind, detail });
      }
    };
    const itemExpansionChangeListener = item.onDidChangeExpansion(() => fireNotificationChangeEvent(2 /* EXPAND_COLLAPSE */));
    const itemContentChangeListener = item.onDidChangeContent((e) => fireNotificationChangeEvent(1 /* CHANGE */, e.kind));
    Event.once(item.onDidClose)(() => {
      itemExpansionChangeListener.dispose();
      itemContentChangeListener.dispose();
      const index = this._notifications.indexOf(item);
      if (index >= 0) {
        this._notifications.splice(index, 1);
        this._onDidChangeNotification.fire({ item, index, kind: 3 /* REMOVE */ });
      }
    });
    return item;
  }
  showStatusMessage(message, options) {
    const item = StatusMessageViewItem.create(message, options);
    if (!item) {
      return Disposable.None;
    }
    this._statusMessage = item;
    this._onDidChangeStatusMessage.fire({ kind: 0 /* ADD */, item });
    return toDisposable(() => {
      if (this._statusMessage === item) {
        this._statusMessage = void 0;
        this._onDidChangeStatusMessage.fire({ kind: 1 /* REMOVE */, item });
      }
    });
  }
};
_NotificationsModel.NO_OP_NOTIFICATION = new NoOpNotification();
let NotificationsModel = _NotificationsModel;
function isNotificationViewItem(obj) {
  return obj instanceof NotificationViewItem;
}
var NotificationViewItemContentChangeKind = /* @__PURE__ */ ((NotificationViewItemContentChangeKind2) => {
  NotificationViewItemContentChangeKind2[NotificationViewItemContentChangeKind2["SEVERITY"] = 0] = "SEVERITY";
  NotificationViewItemContentChangeKind2[NotificationViewItemContentChangeKind2["MESSAGE"] = 1] = "MESSAGE";
  NotificationViewItemContentChangeKind2[NotificationViewItemContentChangeKind2["ACTIONS"] = 2] = "ACTIONS";
  NotificationViewItemContentChangeKind2[NotificationViewItemContentChangeKind2["PROGRESS"] = 3] = "PROGRESS";
  return NotificationViewItemContentChangeKind2;
})(NotificationViewItemContentChangeKind || {});
class NotificationViewItemProgress extends Disposable {
  constructor() {
    super();
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._state = /* @__PURE__ */ Object.create(null);
  }
  get state() {
    return this._state;
  }
  infinite() {
    if (this._state.infinite) {
      return;
    }
    this._state.infinite = true;
    this._state.total = void 0;
    this._state.worked = void 0;
    this._state.done = void 0;
    this._onDidChange.fire();
  }
  done() {
    if (this._state.done) {
      return;
    }
    this._state.done = true;
    this._state.infinite = void 0;
    this._state.total = void 0;
    this._state.worked = void 0;
    this._onDidChange.fire();
  }
  total(value) {
    if (this._state.total === value) {
      return;
    }
    this._state.total = value;
    this._state.infinite = void 0;
    this._state.done = void 0;
    this._onDidChange.fire();
  }
  worked(value) {
    if (typeof this._state.worked === "number") {
      this._state.worked += value;
    } else {
      this._state.worked = value;
    }
    this._state.infinite = void 0;
    this._state.done = void 0;
    this._onDidChange.fire();
  }
}
const _NotificationViewItem = class _NotificationViewItem extends Disposable {
  constructor(id, _severity, _sticky, _priority, _message, _source, progress, actions) {
    super();
    this.id = id;
    this._severity = _severity;
    this._sticky = _sticky;
    this._priority = _priority;
    this._message = _message;
    this._source = _source;
    this._visible = false;
    this._onDidChangeExpansion = this._register(new Emitter());
    this.onDidChangeExpansion = this._onDidChangeExpansion.event;
    this._onDidClose = this._register(new Emitter());
    this.onDidClose = this._onDidClose.event;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    if (progress) {
      this.setProgress(progress);
    }
    this.setActions(actions);
  }
  static create(notification, filter) {
    if (!notification || !notification.message || isCancellationError(notification.message)) {
      return void 0;
    }
    let severity;
    if (typeof notification.severity === "number") {
      severity = notification.severity;
    } else {
      severity = Severity.Info;
    }
    const message = _NotificationViewItem.parseNotificationMessage(notification.message);
    if (!message) {
      return void 0;
    }
    let actions;
    if (notification.actions) {
      actions = notification.actions;
    } else if (isErrorWithActions(notification.message)) {
      actions = { primary: notification.message.actions };
    }
    let priority = notification.priority ?? NotificationPriority.DEFAULT;
    if (priority === NotificationPriority.DEFAULT && severity !== Severity.Error) {
      if (filter.global === NotificationsFilter.ERROR) {
        priority = NotificationPriority.SILENT;
      } else if (isNotificationSource(notification.source) && filter.sources.get(notification.source.id) === NotificationsFilter.ERROR) {
        priority = NotificationPriority.SILENT;
      }
    }
    return new _NotificationViewItem(notification.id, severity, notification.sticky, priority, message, notification.source, notification.progress, actions);
  }
  static parseNotificationMessage(input) {
    let message;
    if (input instanceof Error) {
      message = toErrorMessage(input, false);
    } else if (typeof input === "string") {
      message = input;
    }
    if (!message) {
      return void 0;
    }
    const raw = message;
    if (message.length > _NotificationViewItem.MAX_MESSAGE_LENGTH) {
      message = `${message.substr(0, _NotificationViewItem.MAX_MESSAGE_LENGTH)}...`;
    }
    message = message.replace(/(\r\n|\n|\r)/gm, " ").trim();
    const linkedText = parseLinkedText(message);
    return { raw, linkedText, original: input };
  }
  setProgress(progress) {
    if (progress.infinite) {
      this.progress.infinite();
    } else if (progress.total) {
      this.progress.total(progress.total);
      if (progress.worked) {
        this.progress.worked(progress.worked);
      }
    }
  }
  setActions(actions = { primary: [], secondary: [] }) {
    this._actions = {
      primary: Array.isArray(actions.primary) ? actions.primary : [],
      secondary: Array.isArray(actions.secondary) ? actions.secondary : []
    };
    this._expanded = actions.primary && actions.primary.length > 0;
  }
  get canCollapse() {
    return !this.hasActions;
  }
  get expanded() {
    return !!this._expanded;
  }
  get severity() {
    return this._severity;
  }
  get sticky() {
    if (this._sticky) {
      return true;
    }
    const hasActions = this.hasActions;
    if (hasActions && this._severity === Severity.Error || // notification errors with actions are sticky
    !hasActions && this._expanded || // notifications that got expanded are sticky
    this._progress && !this._progress.state.done) {
      return true;
    }
    return false;
  }
  get priority() {
    return this._priority;
  }
  get hasActions() {
    if (!this._actions) {
      return false;
    }
    if (!this._actions.primary) {
      return false;
    }
    return this._actions.primary.length > 0;
  }
  get hasProgress() {
    return !!this._progress;
  }
  get progress() {
    if (!this._progress) {
      this._progress = this._register(new NotificationViewItemProgress());
      this._register(this._progress.onDidChange(() => this._onDidChangeContent.fire({ kind: 3 /* PROGRESS */ })));
    }
    return this._progress;
  }
  get message() {
    return this._message;
  }
  get source() {
    return typeof this._source === "string" ? this._source : this._source ? this._source.label : void 0;
  }
  get sourceId() {
    return this._source && typeof this._source !== "string" && "id" in this._source ? this._source.id : void 0;
  }
  get actions() {
    return this._actions;
  }
  get visible() {
    return this._visible;
  }
  updateSeverity(severity) {
    if (severity === this._severity) {
      return;
    }
    this._severity = severity;
    this._onDidChangeContent.fire({ kind: 0 /* SEVERITY */ });
  }
  updateMessage(input) {
    const message = _NotificationViewItem.parseNotificationMessage(input);
    if (!message || message.raw === this._message.raw) {
      return;
    }
    this._message = message;
    this._onDidChangeContent.fire({ kind: 1 /* MESSAGE */ });
  }
  updateActions(actions) {
    this.setActions(actions);
    this._onDidChangeContent.fire({ kind: 2 /* ACTIONS */ });
  }
  updateVisibility(visible) {
    if (this._visible !== visible) {
      this._visible = visible;
      this._onDidChangeVisibility.fire(visible);
    }
  }
  expand() {
    if (this._expanded || !this.canCollapse) {
      return;
    }
    this._expanded = true;
    this._onDidChangeExpansion.fire();
  }
  collapse(skipEvents) {
    if (!this._expanded || !this.canCollapse) {
      return;
    }
    this._expanded = false;
    if (!skipEvents) {
      this._onDidChangeExpansion.fire();
    }
  }
  toggle() {
    if (this._expanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }
  close() {
    this._onDidClose.fire();
    this.dispose();
  }
  equals(other) {
    if (this.hasProgress || other.hasProgress) {
      return false;
    }
    if (typeof this.id === "string" || typeof other.id === "string") {
      return this.id === other.id;
    }
    if (typeof this._source === "object") {
      if (this._source.label !== other.source || this._source.id !== other.sourceId) {
        return false;
      }
    } else if (this._source !== other.source) {
      return false;
    }
    if (this._message.raw !== other.message.raw) {
      return false;
    }
    const primaryActions = this._actions && this._actions.primary || [];
    const otherPrimaryActions = other.actions && other.actions.primary || [];
    return equals(primaryActions, otherPrimaryActions, (action, otherAction) => action.id + action.label === otherAction.id + otherAction.label);
  }
};
_NotificationViewItem.MAX_MESSAGE_LENGTH = 1e3;
let NotificationViewItem = _NotificationViewItem;
class ChoiceAction extends Action {
  constructor(id, choice) {
    super(id, choice.label, void 0, true, async () => {
      choice.run();
      this._onDidRun.fire();
    });
    this._onDidRun = this._register(new Emitter());
    this.onDidRun = this._onDidRun.event;
    this._keepOpen = !!choice.keepOpen;
    this._menu = !choice.isSecondary && choice.menu ? choice.menu.map((c, index) => new ChoiceAction(`${id}.${index}`, c)) : void 0;
  }
  get menu() {
    return this._menu;
  }
  get keepOpen() {
    return this._keepOpen;
  }
}
class StatusMessageViewItem {
  static create(notification, options) {
    if (!notification || isCancellationError(notification)) {
      return void 0;
    }
    let message;
    if (notification instanceof Error) {
      message = toErrorMessage(notification, false);
    } else if (typeof notification === "string") {
      message = notification;
    }
    if (!message) {
      return void 0;
    }
    return { message, options };
  }
}
export {
  ChoiceAction,
  NotificationChangeType,
  NotificationHandle,
  NotificationViewItem,
  NotificationViewItemContentChangeKind,
  NotificationViewItemProgress,
  NotificationsModel,
  StatusMessageChangeType,
  isNotificationViewItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29tbW9uL25vdGlmaWNhdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uLCBJTm90aWZpY2F0aW9uSGFuZGxlLCBJTm90aWZpY2F0aW9uQWN0aW9ucywgSU5vdGlmaWNhdGlvblByb2dyZXNzLCBOb09wTm90aWZpY2F0aW9uLCBTZXZlcml0eSwgTm90aWZpY2F0aW9uTWVzc2FnZSwgSVByb21wdENob2ljZSwgSVN0YXR1c01lc3NhZ2VPcHRpb25zLCBOb3RpZmljYXRpb25zRmlsdGVyLCBJTm90aWZpY2F0aW9uUHJvZ3Jlc3NQcm9wZXJ0aWVzLCBJUHJvbXB0Q2hvaWNlV2l0aE1lbnUsIE5vdGlmaWNhdGlvblByaW9yaXR5LCBJTm90aWZpY2F0aW9uU291cmNlLCBpc05vdGlmaWNhdGlvblNvdXJjZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlLCBpc0Vycm9yV2l0aEFjdGlvbnMgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgcGFyc2VMaW5rZWRUZXh0LCBMaW5rZWRUZXh0IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlua2VkVGV4dC5qcyc7XG5pbXBvcnQgeyBtYXBzU3RyaWN0RXF1YWxJZ25vcmVPcmRlciB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGlmaWNhdGlvbnNNb2RlbCB7XG5cblx0Ly8jcmVnaW9uIE5vdGlmaWNhdGlvbnMgYXMgVG9hc3RzL0NlbnRlclxuXG5cdHJlYWRvbmx5IG5vdGlmaWNhdGlvbnM6IElOb3RpZmljYXRpb25WaWV3SXRlbVtdO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTm90aWZpY2F0aW9uOiBFdmVudDxJTm90aWZpY2F0aW9uQ2hhbmdlRXZlbnQ+O1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZpbHRlcjogRXZlbnQ8UGFydGlhbDxJTm90aWZpY2F0aW9uc0ZpbHRlcj4+O1xuXG5cdGFkZE5vdGlmaWNhdGlvbihub3RpZmljYXRpb246IElOb3RpZmljYXRpb24pOiBJTm90aWZpY2F0aW9uSGFuZGxlO1xuXG5cdHNldEZpbHRlcihmaWx0ZXI6IFBhcnRpYWw8SU5vdGlmaWNhdGlvbnNGaWx0ZXI+KTogdm9pZDtcblxuXHQvLyNlbmRyZWdpb25cblxuXG5cdC8vI3JlZ2lvbiBOb3RpZmljYXRpb25zIGFzIFN0YXR1c1xuXG5cdHJlYWRvbmx5IHN0YXR1c01lc3NhZ2U6IElTdGF0dXNNZXNzYWdlVmlld0l0ZW0gfCB1bmRlZmluZWQ7XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTdGF0dXNNZXNzYWdlOiBFdmVudDxJU3RhdHVzTWVzc2FnZUNoYW5nZUV2ZW50PjtcblxuXHRzaG93U3RhdHVzTWVzc2FnZShtZXNzYWdlOiBOb3RpZmljYXRpb25NZXNzYWdlLCBvcHRpb25zPzogSVN0YXR1c01lc3NhZ2VPcHRpb25zKTogSURpc3Bvc2FibGU7XG5cblx0Ly8jZW5kcmVnaW9uXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIE5vdGlmaWNhdGlvbkNoYW5nZVR5cGUge1xuXG5cdC8qKlxuXHQgKiBBIG5vdGlmaWNhdGlvbiB3YXMgYWRkZWQuXG5cdCAqL1xuXHRBREQsXG5cblx0LyoqXG5cdCAqIEEgbm90aWZpY2F0aW9uIGNoYW5nZWQuIENoZWNrIGBkZXRhaWxgIHByb3BlcnR5XG5cdCAqIG9uIHRoZSBldmVudCBmb3IgYWRkaXRpb25hbCBpbmZvcm1hdGlvbi5cblx0ICovXG5cdENIQU5HRSxcblxuXHQvKipcblx0ICogQSBub3RpZmljYXRpb24gZXhwYW5kZWQgb3IgY29sbGFwc2VkLlxuXHQgKi9cblx0RVhQQU5EX0NPTExBUFNFLFxuXG5cdC8qKlxuXHQgKiBBIG5vdGlmaWNhdGlvbiB3YXMgcmVtb3ZlZC5cblx0ICovXG5cdFJFTU9WRVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RpZmljYXRpb25DaGFuZ2VFdmVudCB7XG5cblx0LyoqXG5cdCAqIFRoZSBpbmRleCB0aGlzIG5vdGlmaWNhdGlvbiBoYXMgaW4gdGhlIGxpc3Qgb2Ygbm90aWZpY2F0aW9ucy5cblx0ICovXG5cdGluZGV4OiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFRoZSBub3RpZmljYXRpb24gdGhpcyBjaGFuZ2UgaXMgYWJvdXQuXG5cdCAqL1xuXHRpdGVtOiBJTm90aWZpY2F0aW9uVmlld0l0ZW07XG5cblx0LyoqXG5cdCAqIFRoZSBraW5kIG9mIG5vdGlmaWNhdGlvbiBjaGFuZ2UuXG5cdCAqL1xuXHRraW5kOiBOb3RpZmljYXRpb25DaGFuZ2VUeXBlO1xuXG5cdC8qKlxuXHQgKiBBZGRpdGlvbmFsIGRldGFpbCBhYm91dCB0aGUgaXRlbSBjaGFuZ2UuIE9ubHkgYXBwbGllcyB0b1xuXHQgKiBgTm90aWZpY2F0aW9uQ2hhbmdlVHlwZS5DSEFOR0VgLlxuXHQgKi9cblx0ZGV0YWlsPzogTm90aWZpY2F0aW9uVmlld0l0ZW1Db250ZW50Q2hhbmdlS2luZDtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gU3RhdHVzTWVzc2FnZUNoYW5nZVR5cGUge1xuXHRBREQsXG5cdFJFTU9WRVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTdGF0dXNNZXNzYWdlVmlld0l0ZW0ge1xuXHRtZXNzYWdlOiBzdHJpbmc7XG5cdG9wdGlvbnM/OiBJU3RhdHVzTWVzc2FnZU9wdGlvbnM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0YXR1c01lc3NhZ2VDaGFuZ2VFdmVudCB7XG5cblx0LyoqXG5cdCAqIFRoZSBzdGF0dXMgbWVzc2FnZSBpdGVtIHRoaXMgY2hhbmdlIGlzIGFib3V0LlxuXHQgKi9cblx0aXRlbTogSVN0YXR1c01lc3NhZ2VWaWV3SXRlbTtcblxuXHQvKipcblx0ICogVGhlIGtpbmQgb2Ygc3RhdHVzIG1lc3NhZ2UgY2hhbmdlLlxuXHQgKi9cblx0a2luZDogU3RhdHVzTWVzc2FnZUNoYW5nZVR5cGU7XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RpZmljYXRpb25IYW5kbGUgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU5vdGlmaWNhdGlvbkhhbmRsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsb3NlID0gdGhpcy5fb25EaWRDbG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpc2liaWxpdHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gdGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgaXRlbTogSU5vdGlmaWNhdGlvblZpZXdJdGVtLCBwcml2YXRlIHJlYWRvbmx5IG9uQ2xvc2U6IChpdGVtOiBJTm90aWZpY2F0aW9uVmlld0l0ZW0pID0+IHZvaWQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIFZpc2liaWxpdHlcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLml0ZW0ub25EaWRDaGFuZ2VWaXNpYmlsaXR5KHZpc2libGUgPT4gdGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmZpcmUodmlzaWJsZSkpKTtcblxuXHRcdC8vIENsb3Npbmdcblx0XHRFdmVudC5vbmNlKHRoaXMuaXRlbS5vbkRpZENsb3NlKSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENsb3NlLmZpcmUoKTtcblxuXHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXQgcHJvZ3Jlc3MoKTogSU5vdGlmaWNhdGlvblByb2dyZXNzIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtLnByb2dyZXNzO1xuXHR9XG5cblx0dXBkYXRlU2V2ZXJpdHkoc2V2ZXJpdHk6IFNldmVyaXR5KTogdm9pZCB7XG5cdFx0dGhpcy5pdGVtLnVwZGF0ZVNldmVyaXR5KHNldmVyaXR5KTtcblx0fVxuXG5cdHVwZGF0ZU1lc3NhZ2UobWVzc2FnZTogTm90aWZpY2F0aW9uTWVzc2FnZSk6IHZvaWQge1xuXHRcdHRoaXMuaXRlbS51cGRhdGVNZXNzYWdlKG1lc3NhZ2UpO1xuXHR9XG5cblx0dXBkYXRlQWN0aW9ucyhhY3Rpb25zPzogSU5vdGlmaWNhdGlvbkFjdGlvbnMpOiB2b2lkIHtcblx0XHR0aGlzLml0ZW0udXBkYXRlQWN0aW9ucyhhY3Rpb25zKTtcblx0fVxuXG5cdGNsb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMub25DbG9zZSh0aGlzLml0ZW0pO1xuXG5cdFx0dGhpcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm90aWZpY2F0aW9uc0ZpbHRlciB7XG5cdHJlYWRvbmx5IGdsb2JhbDogTm90aWZpY2F0aW9uc0ZpbHRlcjtcblx0cmVhZG9ubHkgc291cmNlczogTWFwPHN0cmluZywgTm90aWZpY2F0aW9uc0ZpbHRlcj47XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RpZmljYXRpb25zTW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU5vdGlmaWNhdGlvbnNNb2RlbCB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTk9fT1BfTk9USUZJQ0FUSU9OID0gbmV3IE5vT3BOb3RpZmljYXRpb24oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZU5vdGlmaWNhdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElOb3RpZmljYXRpb25DaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTm90aWZpY2F0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VOb3RpZmljYXRpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTdGF0dXNNZXNzYWdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVN0YXR1c01lc3NhZ2VDaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU3RhdHVzTWVzc2FnZSA9IHRoaXMuX29uRGlkQ2hhbmdlU3RhdHVzTWVzc2FnZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUZpbHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFBhcnRpYWw8SU5vdGlmaWNhdGlvbnNGaWx0ZXI+PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGaWx0ZXIgPSB0aGlzLl9vbkRpZENoYW5nZUZpbHRlci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ub3RpZmljYXRpb25zOiBJTm90aWZpY2F0aW9uVmlld0l0ZW1bXSA9IFtdO1xuXHRnZXQgbm90aWZpY2F0aW9ucygpOiBJTm90aWZpY2F0aW9uVmlld0l0ZW1bXSB7IHJldHVybiB0aGlzLl9ub3RpZmljYXRpb25zOyB9XG5cblx0cHJpdmF0ZSBfc3RhdHVzTWVzc2FnZTogSVN0YXR1c01lc3NhZ2VWaWV3SXRlbSB8IHVuZGVmaW5lZDtcblx0Z2V0IHN0YXR1c01lc3NhZ2UoKTogSVN0YXR1c01lc3NhZ2VWaWV3SXRlbSB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9zdGF0dXNNZXNzYWdlOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBmaWx0ZXIgPSB7XG5cdFx0Z2xvYmFsOiBOb3RpZmljYXRpb25zRmlsdGVyLk9GRixcblx0XHRzb3VyY2VzOiBuZXcgTWFwPHN0cmluZywgTm90aWZpY2F0aW9uc0ZpbHRlcj4oKVxuXHR9O1xuXG5cdHNldEZpbHRlcihmaWx0ZXI6IFBhcnRpYWw8SU5vdGlmaWNhdGlvbnNGaWx0ZXI+KTogdm9pZCB7XG5cdFx0bGV0IGdsb2JhbENoYW5nZWQgPSBmYWxzZTtcblx0XHRpZiAodHlwZW9mIGZpbHRlci5nbG9iYWwgPT09ICdudW1iZXInKSB7XG5cdFx0XHRnbG9iYWxDaGFuZ2VkID0gdGhpcy5maWx0ZXIuZ2xvYmFsICE9PSBmaWx0ZXIuZ2xvYmFsO1xuXHRcdFx0dGhpcy5maWx0ZXIuZ2xvYmFsID0gZmlsdGVyLmdsb2JhbDtcblx0XHR9XG5cblx0XHRsZXQgc291cmNlc0NoYW5nZWQgPSBmYWxzZTtcblx0XHRpZiAoZmlsdGVyLnNvdXJjZXMpIHtcblx0XHRcdHNvdXJjZXNDaGFuZ2VkID0gIW1hcHNTdHJpY3RFcXVhbElnbm9yZU9yZGVyKHRoaXMuZmlsdGVyLnNvdXJjZXMsIGZpbHRlci5zb3VyY2VzKTtcblx0XHRcdHRoaXMuZmlsdGVyLnNvdXJjZXMgPSBmaWx0ZXIuc291cmNlcztcblx0XHR9XG5cblx0XHRpZiAoZ2xvYmFsQ2hhbmdlZCB8fCBzb3VyY2VzQ2hhbmdlZCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VGaWx0ZXIuZmlyZSh7XG5cdFx0XHRcdGdsb2JhbDogZ2xvYmFsQ2hhbmdlZCA/IGZpbHRlci5nbG9iYWwgOiB1bmRlZmluZWQsXG5cdFx0XHRcdHNvdXJjZXM6IHNvdXJjZXNDaGFuZ2VkID8gZmlsdGVyLnNvdXJjZXMgOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdGFkZE5vdGlmaWNhdGlvbihub3RpZmljYXRpb246IElOb3RpZmljYXRpb24pOiBJTm90aWZpY2F0aW9uSGFuZGxlIHtcblx0XHRjb25zdCBpdGVtID0gdGhpcy5jcmVhdGVWaWV3SXRlbShub3RpZmljYXRpb24pO1xuXHRcdGlmICghaXRlbSkge1xuXHRcdFx0cmV0dXJuIE5vdGlmaWNhdGlvbnNNb2RlbC5OT19PUF9OT1RJRklDQVRJT047IC8vIHJldHVybiBlYXJseSBpZiB0aGlzIGlzIGEgbm8tb3Bcblx0XHR9XG5cblx0XHQvLyBEZWR1cGxpY2F0ZVxuXHRcdGNvbnN0IGR1cGxpY2F0ZSA9IHRoaXMuZmluZE5vdGlmaWNhdGlvbihpdGVtKTtcblx0XHRkdXBsaWNhdGU/LmNsb3NlKCk7XG5cblx0XHQvLyBBZGQgdG8gbGlzdCBhcyBmaXJzdCBlbnRyeVxuXHRcdHRoaXMuX25vdGlmaWNhdGlvbnMuc3BsaWNlKDAsIDAsIGl0ZW0pO1xuXG5cdFx0Ly8gRXZlbnRzXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VOb3RpZmljYXRpb24uZmlyZSh7IGl0ZW0sIGluZGV4OiAwLCBraW5kOiBOb3RpZmljYXRpb25DaGFuZ2VUeXBlLkFERCB9KTtcblxuXHRcdC8vIFdyYXAgaW50byBoYW5kbGVcblx0XHRyZXR1cm4gbmV3IE5vdGlmaWNhdGlvbkhhbmRsZShpdGVtLCBpdGVtID0+IHRoaXMub25DbG9zZShpdGVtKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uQ2xvc2UoaXRlbTogSU5vdGlmaWNhdGlvblZpZXdJdGVtKTogdm9pZCB7XG5cdFx0Y29uc3QgbGl2ZUl0ZW0gPSB0aGlzLmZpbmROb3RpZmljYXRpb24oaXRlbSk7XG5cdFx0aWYgKGxpdmVJdGVtICYmIGxpdmVJdGVtICE9PSBpdGVtKSB7XG5cdFx0XHRsaXZlSXRlbS5jbG9zZSgpOyAvLyBpdGVtIGNvdWxkIGhhdmUgYmVlbiByZXBsYWNlZCB3aXRoIGFub3RoZXIgb25lLCBtYWtlIHN1cmUgdG8gY2xvc2UgdGhlIGxpdmUgaXRlbVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpdGVtLmNsb3NlKCk7IC8vIG90aGVyd2lzZSBqdXN0IGNsb3NlIHRoZSBpdGVtIHRoYXQgd2FzIHBhc3NlZCBpblxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZmluZE5vdGlmaWNhdGlvbihpdGVtOiBJTm90aWZpY2F0aW9uVmlld0l0ZW0pOiBJTm90aWZpY2F0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9ub3RpZmljYXRpb25zLmZpbmQobm90aWZpY2F0aW9uID0+IG5vdGlmaWNhdGlvbi5lcXVhbHMoaXRlbSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVWaWV3SXRlbShub3RpZmljYXRpb246IElOb3RpZmljYXRpb24pOiBJTm90aWZpY2F0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGl0ZW0gPSBOb3RpZmljYXRpb25WaWV3SXRlbS5jcmVhdGUobm90aWZpY2F0aW9uLCB0aGlzLmZpbHRlcik7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIEl0ZW0gRXZlbnRzXG5cdFx0Y29uc3QgZmlyZU5vdGlmaWNhdGlvbkNoYW5nZUV2ZW50ID0gKGtpbmQ6IE5vdGlmaWNhdGlvbkNoYW5nZVR5cGUsIGRldGFpbD86IE5vdGlmaWNhdGlvblZpZXdJdGVtQ29udGVudENoYW5nZUtpbmQpID0+IHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fbm90aWZpY2F0aW9ucy5pbmRleE9mKGl0ZW0pO1xuXHRcdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VOb3RpZmljYXRpb24uZmlyZSh7IGl0ZW0sIGluZGV4LCBraW5kLCBkZXRhaWwgfSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGl0ZW1FeHBhbnNpb25DaGFuZ2VMaXN0ZW5lciA9IGl0ZW0ub25EaWRDaGFuZ2VFeHBhbnNpb24oKCkgPT4gZmlyZU5vdGlmaWNhdGlvbkNoYW5nZUV2ZW50KE5vdGlmaWNhdGlvbkNoYW5nZVR5cGUuRVhQQU5EX0NPTExBUFNFKSk7XG5cdFx0Y29uc3QgaXRlbUNvbnRlbnRDaGFuZ2VMaXN0ZW5lciA9IGl0ZW0ub25EaWRDaGFuZ2VDb250ZW50KGUgPT4gZmlyZU5vdGlmaWNhdGlvbkNoYW5nZUV2ZW50KE5vdGlmaWNhdGlvbkNoYW5nZVR5cGUuQ0hBTkdFLCBlLmtpbmQpKTtcblxuXHRcdEV2ZW50Lm9uY2UoaXRlbS5vbkRpZENsb3NlKSgoKSA9PiB7XG5cdFx0XHRpdGVtRXhwYW5zaW9uQ2hhbmdlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0aXRlbUNvbnRlbnRDaGFuZ2VMaXN0ZW5lci5kaXNwb3NlKCk7XG5cblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fbm90aWZpY2F0aW9ucy5pbmRleE9mKGl0ZW0pO1xuXHRcdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdFx0dGhpcy5fbm90aWZpY2F0aW9ucy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZU5vdGlmaWNhdGlvbi5maXJlKHsgaXRlbSwgaW5kZXgsIGtpbmQ6IE5vdGlmaWNhdGlvbkNoYW5nZVR5cGUuUkVNT1ZFIH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGl0ZW07XG5cdH1cblxuXHRzaG93U3RhdHVzTWVzc2FnZShtZXNzYWdlOiBOb3RpZmljYXRpb25NZXNzYWdlLCBvcHRpb25zPzogSVN0YXR1c01lc3NhZ2VPcHRpb25zKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGl0ZW0gPSBTdGF0dXNNZXNzYWdlVmlld0l0ZW0uY3JlYXRlKG1lc3NhZ2UsIG9wdGlvbnMpO1xuXHRcdGlmICghaXRlbSkge1xuXHRcdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0XHR9XG5cblx0XHQvLyBSZW1lbWJlciBhcyBjdXJyZW50IHN0YXR1cyBtZXNzYWdlIGFuZCBmaXJlIGV2ZW50c1xuXHRcdHRoaXMuX3N0YXR1c01lc3NhZ2UgPSBpdGVtO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdHVzTWVzc2FnZS5maXJlKHsga2luZDogU3RhdHVzTWVzc2FnZUNoYW5nZVR5cGUuQURELCBpdGVtIH0pO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cblx0XHRcdC8vIE9ubHkgcmVzZXQgc3RhdHVzIG1lc3NhZ2UgaWYgdGhlIGl0ZW0gaXMgc3RpbGwgdGhlIG9uZSB3ZSBoYWQgcmVtZW1iZXJlZFxuXHRcdFx0aWYgKHRoaXMuX3N0YXR1c01lc3NhZ2UgPT09IGl0ZW0pIHtcblx0XHRcdFx0dGhpcy5fc3RhdHVzTWVzc2FnZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0dXNNZXNzYWdlLmZpcmUoeyBraW5kOiBTdGF0dXNNZXNzYWdlQ2hhbmdlVHlwZS5SRU1PVkUsIGl0ZW0gfSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm90aWZpY2F0aW9uVmlld0l0ZW0ge1xuXHRyZWFkb25seSBpZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBzZXZlcml0eTogU2V2ZXJpdHk7XG5cdHJlYWRvbmx5IHN0aWNreTogYm9vbGVhbjtcblx0cmVhZG9ubHkgcHJpb3JpdHk6IE5vdGlmaWNhdGlvblByaW9yaXR5O1xuXHRyZWFkb25seSBtZXNzYWdlOiBJTm90aWZpY2F0aW9uTWVzc2FnZTtcblx0cmVhZG9ubHkgc291cmNlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHNvdXJjZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGFjdGlvbnM6IElOb3RpZmljYXRpb25BY3Rpb25zIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBwcm9ncmVzczogSU5vdGlmaWNhdGlvblZpZXdJdGVtUHJvZ3Jlc3M7XG5cblx0cmVhZG9ubHkgZXhwYW5kZWQ6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHZpc2libGU6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNhbkNvbGxhcHNlOiBib29sZWFuO1xuXHRyZWFkb25seSBoYXNQcm9ncmVzczogYm9vbGVhbjtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUV4cGFuc2lvbjogRXZlbnQ8dm9pZD47XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eTogRXZlbnQ8Ym9vbGVhbj47XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29udGVudDogRXZlbnQ8SU5vdGlmaWNhdGlvblZpZXdJdGVtQ29udGVudENoYW5nZUV2ZW50Pjtcblx0cmVhZG9ubHkgb25EaWRDbG9zZTogRXZlbnQ8dm9pZD47XG5cblx0ZXhwYW5kKCk6IHZvaWQ7XG5cdGNvbGxhcHNlKHNraXBFdmVudHM/OiBib29sZWFuKTogdm9pZDtcblx0dG9nZ2xlKCk6IHZvaWQ7XG5cblx0dXBkYXRlU2V2ZXJpdHkoc2V2ZXJpdHk6IFNldmVyaXR5KTogdm9pZDtcblx0dXBkYXRlTWVzc2FnZShtZXNzYWdlOiBOb3RpZmljYXRpb25NZXNzYWdlKTogdm9pZDtcblx0dXBkYXRlQWN0aW9ucyhhY3Rpb25zPzogSU5vdGlmaWNhdGlvbkFjdGlvbnMpOiB2b2lkO1xuXG5cdHVwZGF0ZVZpc2liaWxpdHkodmlzaWJsZTogYm9vbGVhbik6IHZvaWQ7XG5cblx0Y2xvc2UoKTogdm9pZDtcblxuXHRlcXVhbHMoaXRlbTogSU5vdGlmaWNhdGlvblZpZXdJdGVtKTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTm90aWZpY2F0aW9uVmlld0l0ZW0ob2JqOiB1bmtub3duKTogb2JqIGlzIElOb3RpZmljYXRpb25WaWV3SXRlbSB7XG5cdHJldHVybiBvYmogaW5zdGFuY2VvZiBOb3RpZmljYXRpb25WaWV3SXRlbTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gTm90aWZpY2F0aW9uVmlld0l0ZW1Db250ZW50Q2hhbmdlS2luZCB7XG5cdFNFVkVSSVRZLFxuXHRNRVNTQUdFLFxuXHRBQ1RJT05TLFxuXHRQUk9HUkVTU1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RpZmljYXRpb25WaWV3SXRlbUNvbnRlbnRDaGFuZ2VFdmVudCB7XG5cdGtpbmQ6IE5vdGlmaWNhdGlvblZpZXdJdGVtQ29udGVudENoYW5nZUtpbmQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGlmaWNhdGlvblZpZXdJdGVtUHJvZ3Jlc3NTdGF0ZSB7XG5cdGluZmluaXRlPzogYm9vbGVhbjtcblx0dG90YWw/OiBudW1iZXI7XG5cdHdvcmtlZD86IG51bWJlcjtcblx0ZG9uZT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGlmaWNhdGlvblZpZXdJdGVtUHJvZ3Jlc3MgZXh0ZW5kcyBJTm90aWZpY2F0aW9uUHJvZ3Jlc3Mge1xuXHRyZWFkb25seSBzdGF0ZTogSU5vdGlmaWNhdGlvblZpZXdJdGVtUHJvZ3Jlc3NTdGF0ZTtcblxuXHRkaXNwb3NlKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RpZmljYXRpb25WaWV3SXRlbVByb2dyZXNzIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElOb3RpZmljYXRpb25WaWV3SXRlbVByb2dyZXNzIHtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RhdGU6IElOb3RpZmljYXRpb25WaWV3SXRlbVByb2dyZXNzU3RhdGU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fc3RhdGUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHR9XG5cblx0Z2V0IHN0YXRlKCk6IElOb3RpZmljYXRpb25WaWV3SXRlbVByb2dyZXNzU3RhdGUge1xuXHRcdHJldHVybiB0aGlzLl9zdGF0ZTtcblx0fVxuXG5cdGluZmluaXRlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zdGF0ZS5pbmZpbml0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3N0YXRlLmluZmluaXRlID0gdHJ1ZTtcblxuXHRcdHRoaXMuX3N0YXRlLnRvdGFsID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3N0YXRlLndvcmtlZCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9zdGF0ZS5kb25lID0gdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHR9XG5cblx0ZG9uZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdGUuZG9uZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3N0YXRlLmRvbmUgPSB0cnVlO1xuXG5cdFx0dGhpcy5fc3RhdGUuaW5maW5pdGUgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fc3RhdGUudG90YWwgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fc3RhdGUud29ya2VkID0gdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHR9XG5cblx0dG90YWwodmFsdWU6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zdGF0ZS50b3RhbCA9PT0gdmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9zdGF0ZS50b3RhbCA9IHZhbHVlO1xuXG5cdFx0dGhpcy5fc3RhdGUuaW5maW5pdGUgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fc3RhdGUuZG9uZSA9IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdHdvcmtlZCh2YWx1ZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLl9zdGF0ZS53b3JrZWQgPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZS53b3JrZWQgKz0gdmFsdWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3N0YXRlLndvcmtlZCA9IHZhbHVlO1xuXHRcdH1cblxuXHRcdHRoaXMuX3N0YXRlLmluZmluaXRlID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3N0YXRlLmRvbmUgPSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWVzc2FnZUxpbmsge1xuXHRocmVmOiBzdHJpbmc7XG5cdG5hbWU6IHN0cmluZztcblx0dGl0bGU6IHN0cmluZztcblx0b2Zmc2V0OiBudW1iZXI7XG5cdGxlbmd0aDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElOb3RpZmljYXRpb25NZXNzYWdlIHtcblx0cmF3OiBzdHJpbmc7XG5cdG9yaWdpbmFsOiBOb3RpZmljYXRpb25NZXNzYWdlO1xuXHRsaW5rZWRUZXh0OiBMaW5rZWRUZXh0O1xufVxuXG5leHBvcnQgY2xhc3MgTm90aWZpY2F0aW9uVmlld0l0ZW0gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU5vdGlmaWNhdGlvblZpZXdJdGVtIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNQVhfTUVTU0FHRV9MRU5HVEggPSAxMDAwO1xuXG5cdHByaXZhdGUgX2V4cGFuZGVkOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF92aXNpYmxlOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBfYWN0aW9uczogSU5vdGlmaWNhdGlvbkFjdGlvbnMgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Byb2dyZXNzOiBOb3RpZmljYXRpb25WaWV3SXRlbVByb2dyZXNzIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRXhwYW5zaW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRXhwYW5zaW9uID0gdGhpcy5fb25EaWRDaGFuZ2VFeHBhbnNpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENsb3NlID0gdGhpcy5fb25EaWRDbG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJTm90aWZpY2F0aW9uVmlld0l0ZW1Db250ZW50Q2hhbmdlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbnRlbnQgPSB0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eSA9IHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudDtcblxuXHRzdGF0aWMgY3JlYXRlKG5vdGlmaWNhdGlvbjogSU5vdGlmaWNhdGlvbiwgZmlsdGVyOiBJTm90aWZpY2F0aW9uc0ZpbHRlcik6IElOb3RpZmljYXRpb25WaWV3SXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFub3RpZmljYXRpb24gfHwgIW5vdGlmaWNhdGlvbi5tZXNzYWdlIHx8IGlzQ2FuY2VsbGF0aW9uRXJyb3Iobm90aWZpY2F0aW9uLm1lc3NhZ2UpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyB3ZSBuZWVkIGEgbWVzc2FnZSB0byBzaG93XG5cdFx0fVxuXG5cdFx0bGV0IHNldmVyaXR5OiBTZXZlcml0eTtcblx0XHRpZiAodHlwZW9mIG5vdGlmaWNhdGlvbi5zZXZlcml0eSA9PT0gJ251bWJlcicpIHtcblx0XHRcdHNldmVyaXR5ID0gbm90aWZpY2F0aW9uLnNldmVyaXR5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZXZlcml0eSA9IFNldmVyaXR5LkluZm87XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWVzc2FnZSA9IE5vdGlmaWNhdGlvblZpZXdJdGVtLnBhcnNlTm90aWZpY2F0aW9uTWVzc2FnZShub3RpZmljYXRpb24ubWVzc2FnZSk7XG5cdFx0aWYgKCFtZXNzYWdlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyB3ZSBuZWVkIGEgbWVzc2FnZSB0byBzaG93XG5cdFx0fVxuXG5cdFx0bGV0IGFjdGlvbnM6IElOb3RpZmljYXRpb25BY3Rpb25zIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChub3RpZmljYXRpb24uYWN0aW9ucykge1xuXHRcdFx0YWN0aW9ucyA9IG5vdGlmaWNhdGlvbi5hY3Rpb25zO1xuXHRcdH0gZWxzZSBpZiAoaXNFcnJvcldpdGhBY3Rpb25zKG5vdGlmaWNhdGlvbi5tZXNzYWdlKSkge1xuXHRcdFx0YWN0aW9ucyA9IHsgcHJpbWFyeTogbm90aWZpY2F0aW9uLm1lc3NhZ2UuYWN0aW9ucyB9O1xuXHRcdH1cblxuXHRcdGxldCBwcmlvcml0eSA9IG5vdGlmaWNhdGlvbi5wcmlvcml0eSA/PyBOb3RpZmljYXRpb25Qcmlvcml0eS5ERUZBVUxUO1xuXHRcdGlmIChwcmlvcml0eSA9PT0gTm90aWZpY2F0aW9uUHJpb3JpdHkuREVGQVVMVCAmJiBzZXZlcml0eSAhPT0gU2V2ZXJpdHkuRXJyb3IpIHtcblx0XHRcdGlmIChmaWx0ZXIuZ2xvYmFsID09PSBOb3RpZmljYXRpb25zRmlsdGVyLkVSUk9SKSB7XG5cdFx0XHRcdHByaW9yaXR5ID0gTm90aWZpY2F0aW9uUHJpb3JpdHkuU0lMRU5UOyAvLyBmaWx0ZXJlZCBnbG9iYWxseVxuXHRcdFx0fSBlbHNlIGlmIChpc05vdGlmaWNhdGlvblNvdXJjZShub3RpZmljYXRpb24uc291cmNlKSAmJiBmaWx0ZXIuc291cmNlcy5nZXQobm90aWZpY2F0aW9uLnNvdXJjZS5pZCkgPT09IE5vdGlmaWNhdGlvbnNGaWx0ZXIuRVJST1IpIHtcblx0XHRcdFx0cHJpb3JpdHkgPSBOb3RpZmljYXRpb25Qcmlvcml0eS5TSUxFTlQ7IC8vIGZpbHRlcmVkIGJ5IHNvdXJjZVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgTm90aWZpY2F0aW9uVmlld0l0ZW0obm90aWZpY2F0aW9uLmlkLCBzZXZlcml0eSwgbm90aWZpY2F0aW9uLnN0aWNreSwgcHJpb3JpdHksIG1lc3NhZ2UsIG5vdGlmaWNhdGlvbi5zb3VyY2UsIG5vdGlmaWNhdGlvbi5wcm9ncmVzcywgYWN0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBwYXJzZU5vdGlmaWNhdGlvbk1lc3NhZ2UoaW5wdXQ6IE5vdGlmaWNhdGlvbk1lc3NhZ2UpOiBJTm90aWZpY2F0aW9uTWVzc2FnZSB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IG1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBFcnJvcikge1xuXHRcdFx0bWVzc2FnZSA9IHRvRXJyb3JNZXNzYWdlKGlucHV0LCBmYWxzZSk7XG5cdFx0fSBlbHNlIGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRtZXNzYWdlID0gaW5wdXQ7XG5cdFx0fVxuXG5cdFx0aWYgKCFtZXNzYWdlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyB3ZSBuZWVkIGEgbWVzc2FnZSB0byBzaG93XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmF3ID0gbWVzc2FnZTtcblxuXHRcdC8vIE1ha2Ugc3VyZSBtZXNzYWdlIGlzIGluIHRoZSBsaW1pdHNcblx0XHRpZiAobWVzc2FnZS5sZW5ndGggPiBOb3RpZmljYXRpb25WaWV3SXRlbS5NQVhfTUVTU0FHRV9MRU5HVEgpIHtcblx0XHRcdG1lc3NhZ2UgPSBgJHttZXNzYWdlLnN1YnN0cigwLCBOb3RpZmljYXRpb25WaWV3SXRlbS5NQVhfTUVTU0FHRV9MRU5HVEgpfS4uLmA7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIG5ld2xpbmVzIGZyb20gbWVzc2FnZXMgYXMgd2UgZG8gbm90IHN1cHBvcnQgdGhhdCBhbmQgaXQgbWFrZXMgbGluayBwYXJzaW5nIGhhcmRcblx0XHRtZXNzYWdlID0gbWVzc2FnZS5yZXBsYWNlKC8oXFxyXFxufFxcbnxcXHIpL2dtLCAnICcpLnRyaW0oKTtcblxuXHRcdC8vIFBhcnNlIExpbmtzXG5cdFx0Y29uc3QgbGlua2VkVGV4dCA9IHBhcnNlTGlua2VkVGV4dChtZXNzYWdlKTtcblxuXHRcdHJldHVybiB7IHJhdywgbGlua2VkVGV4dCwgb3JpZ2luYWw6IGlucHV0IH07XG5cdH1cblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGlkOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBfc2V2ZXJpdHk6IFNldmVyaXR5LFxuXHRcdHByaXZhdGUgX3N0aWNreTogYm9vbGVhbiB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIF9wcmlvcml0eTogTm90aWZpY2F0aW9uUHJpb3JpdHksXG5cdFx0cHJpdmF0ZSBfbWVzc2FnZTogSU5vdGlmaWNhdGlvbk1lc3NhZ2UsXG5cdFx0cHJpdmF0ZSBfc291cmNlOiBzdHJpbmcgfCBJTm90aWZpY2F0aW9uU291cmNlIHwgdW5kZWZpbmVkLFxuXHRcdHByb2dyZXNzOiBJTm90aWZpY2F0aW9uUHJvZ3Jlc3NQcm9wZXJ0aWVzIHwgdW5kZWZpbmVkLFxuXHRcdGFjdGlvbnM/OiBJTm90aWZpY2F0aW9uQWN0aW9uc1xuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0aWYgKHByb2dyZXNzKSB7XG5cdFx0XHR0aGlzLnNldFByb2dyZXNzKHByb2dyZXNzKTtcblx0XHR9XG5cblx0XHR0aGlzLnNldEFjdGlvbnMoYWN0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIHNldFByb2dyZXNzKHByb2dyZXNzOiBJTm90aWZpY2F0aW9uUHJvZ3Jlc3NQcm9wZXJ0aWVzKTogdm9pZCB7XG5cdFx0aWYgKHByb2dyZXNzLmluZmluaXRlKSB7XG5cdFx0XHR0aGlzLnByb2dyZXNzLmluZmluaXRlKCk7XG5cdFx0fSBlbHNlIGlmIChwcm9ncmVzcy50b3RhbCkge1xuXHRcdFx0dGhpcy5wcm9ncmVzcy50b3RhbChwcm9ncmVzcy50b3RhbCk7XG5cblx0XHRcdGlmIChwcm9ncmVzcy53b3JrZWQpIHtcblx0XHRcdFx0dGhpcy5wcm9ncmVzcy53b3JrZWQocHJvZ3Jlc3Mud29ya2VkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldEFjdGlvbnMoYWN0aW9uczogSU5vdGlmaWNhdGlvbkFjdGlvbnMgPSB7IHByaW1hcnk6IFtdLCBzZWNvbmRhcnk6IFtdIH0pOiB2b2lkIHtcblx0XHR0aGlzLl9hY3Rpb25zID0ge1xuXHRcdFx0cHJpbWFyeTogQXJyYXkuaXNBcnJheShhY3Rpb25zLnByaW1hcnkpID8gYWN0aW9ucy5wcmltYXJ5IDogW10sXG5cdFx0XHRzZWNvbmRhcnk6IEFycmF5LmlzQXJyYXkoYWN0aW9ucy5zZWNvbmRhcnkpID8gYWN0aW9ucy5zZWNvbmRhcnkgOiBbXVxuXHRcdH07XG5cblx0XHR0aGlzLl9leHBhbmRlZCA9IGFjdGlvbnMucHJpbWFyeSAmJiBhY3Rpb25zLnByaW1hcnkubGVuZ3RoID4gMDtcblx0fVxuXG5cdGdldCBjYW5Db2xsYXBzZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMuaGFzQWN0aW9ucztcblx0fVxuXG5cdGdldCBleHBhbmRlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLl9leHBhbmRlZDtcblx0fVxuXG5cdGdldCBzZXZlcml0eSgpOiBTZXZlcml0eSB7XG5cdFx0cmV0dXJuIHRoaXMuX3NldmVyaXR5O1xuXHR9XG5cblx0Z2V0IHN0aWNreSgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fc3RpY2t5KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gZXhwbGljaXRseSBzdGlja3lcblx0XHR9XG5cblx0XHRjb25zdCBoYXNBY3Rpb25zID0gdGhpcy5oYXNBY3Rpb25zO1xuXHRcdGlmIChcblx0XHRcdChoYXNBY3Rpb25zICYmIHRoaXMuX3NldmVyaXR5ID09PSBTZXZlcml0eS5FcnJvcikgfHwgLy8gbm90aWZpY2F0aW9uIGVycm9ycyB3aXRoIGFjdGlvbnMgYXJlIHN0aWNreVxuXHRcdFx0KCFoYXNBY3Rpb25zICYmIHRoaXMuX2V4cGFuZGVkKSB8fFx0XHRcdFx0XHQgLy8gbm90aWZpY2F0aW9ucyB0aGF0IGdvdCBleHBhbmRlZCBhcmUgc3RpY2t5XG5cdFx0XHQodGhpcy5fcHJvZ3Jlc3MgJiYgIXRoaXMuX3Byb2dyZXNzLnN0YXRlLmRvbmUpXHRcdCAvLyBub3RpZmljYXRpb25zIHdpdGggcnVubmluZyBwcm9ncmVzcyBhcmUgc3RpY2t5XG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7IC8vIG5vdCBzdGlja3lcblx0fVxuXG5cdGdldCBwcmlvcml0eSgpOiBOb3RpZmljYXRpb25Qcmlvcml0eSB7XG5cdFx0cmV0dXJuIHRoaXMuX3ByaW9yaXR5O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgaGFzQWN0aW9ucygpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX2FjdGlvbnMpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2FjdGlvbnMucHJpbWFyeSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9hY3Rpb25zLnByaW1hcnkubGVuZ3RoID4gMDtcblx0fVxuXG5cdGdldCBoYXNQcm9ncmVzcygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLl9wcm9ncmVzcztcblx0fVxuXG5cdGdldCBwcm9ncmVzcygpOiBJTm90aWZpY2F0aW9uVmlld0l0ZW1Qcm9ncmVzcyB7XG5cdFx0aWYgKCF0aGlzLl9wcm9ncmVzcykge1xuXHRcdFx0dGhpcy5fcHJvZ3Jlc3MgPSB0aGlzLl9yZWdpc3RlcihuZXcgTm90aWZpY2F0aW9uVmlld0l0ZW1Qcm9ncmVzcygpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Byb2dyZXNzLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5maXJlKHsga2luZDogTm90aWZpY2F0aW9uVmlld0l0ZW1Db250ZW50Q2hhbmdlS2luZC5QUk9HUkVTUyB9KSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9wcm9ncmVzcztcblx0fVxuXG5cdGdldCBtZXNzYWdlKCk6IElOb3RpZmljYXRpb25NZXNzYWdlIHtcblx0XHRyZXR1cm4gdGhpcy5fbWVzc2FnZTtcblx0fVxuXG5cdGdldCBzb3VyY2UoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdHlwZW9mIHRoaXMuX3NvdXJjZSA9PT0gJ3N0cmluZycgPyB0aGlzLl9zb3VyY2UgOiAodGhpcy5fc291cmNlID8gdGhpcy5fc291cmNlLmxhYmVsIDogdW5kZWZpbmVkKTtcblx0fVxuXG5cdGdldCBzb3VyY2VJZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiAodGhpcy5fc291cmNlICYmIHR5cGVvZiB0aGlzLl9zb3VyY2UgIT09ICdzdHJpbmcnICYmICdpZCcgaW4gdGhpcy5fc291cmNlKSA/IHRoaXMuX3NvdXJjZS5pZCA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldCBhY3Rpb25zKCk6IElOb3RpZmljYXRpb25BY3Rpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0aW9ucztcblx0fVxuXG5cdGdldCB2aXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl92aXNpYmxlO1xuXHR9XG5cblx0dXBkYXRlU2V2ZXJpdHkoc2V2ZXJpdHk6IFNldmVyaXR5KTogdm9pZCB7XG5cdFx0aWYgKHNldmVyaXR5ID09PSB0aGlzLl9zZXZlcml0eSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3NldmVyaXR5ID0gc2V2ZXJpdHk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmZpcmUoeyBraW5kOiBOb3RpZmljYXRpb25WaWV3SXRlbUNvbnRlbnRDaGFuZ2VLaW5kLlNFVkVSSVRZIH0pO1xuXHR9XG5cblx0dXBkYXRlTWVzc2FnZShpbnB1dDogTm90aWZpY2F0aW9uTWVzc2FnZSk6IHZvaWQge1xuXHRcdGNvbnN0IG1lc3NhZ2UgPSBOb3RpZmljYXRpb25WaWV3SXRlbS5wYXJzZU5vdGlmaWNhdGlvbk1lc3NhZ2UoaW5wdXQpO1xuXHRcdGlmICghbWVzc2FnZSB8fCBtZXNzYWdlLnJhdyA9PT0gdGhpcy5fbWVzc2FnZS5yYXcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9tZXNzYWdlID0gbWVzc2FnZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnQuZmlyZSh7IGtpbmQ6IE5vdGlmaWNhdGlvblZpZXdJdGVtQ29udGVudENoYW5nZUtpbmQuTUVTU0FHRSB9KTtcblx0fVxuXG5cdHVwZGF0ZUFjdGlvbnMoYWN0aW9ucz86IElOb3RpZmljYXRpb25BY3Rpb25zKTogdm9pZCB7XG5cdFx0dGhpcy5zZXRBY3Rpb25zKGFjdGlvbnMpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5maXJlKHsga2luZDogTm90aWZpY2F0aW9uVmlld0l0ZW1Db250ZW50Q2hhbmdlS2luZC5BQ1RJT05TIH0pO1xuXHR9XG5cblx0dXBkYXRlVmlzaWJpbGl0eSh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3Zpc2libGUgIT09IHZpc2libGUpIHtcblx0XHRcdHRoaXMuX3Zpc2libGUgPSB2aXNpYmxlO1xuXG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZpc2liaWxpdHkuZmlyZSh2aXNpYmxlKTtcblx0XHR9XG5cdH1cblxuXHRleHBhbmQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2V4cGFuZGVkIHx8ICF0aGlzLmNhbkNvbGxhcHNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZXhwYW5kZWQgPSB0cnVlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRXhwYW5zaW9uLmZpcmUoKTtcblx0fVxuXG5cdGNvbGxhcHNlKHNraXBFdmVudHM/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9leHBhbmRlZCB8fCAhdGhpcy5jYW5Db2xsYXBzZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2V4cGFuZGVkID0gZmFsc2U7XG5cblx0XHRpZiAoIXNraXBFdmVudHMpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRXhwYW5zaW9uLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHR0b2dnbGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2V4cGFuZGVkKSB7XG5cdFx0XHR0aGlzLmNvbGxhcHNlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZXhwYW5kKCk7XG5cdFx0fVxuXHR9XG5cblx0Y2xvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRDbG9zZS5maXJlKCk7XG5cblx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGVxdWFscyhvdGhlcjogSU5vdGlmaWNhdGlvblZpZXdJdGVtKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuaGFzUHJvZ3Jlc3MgfHwgb3RoZXIuaGFzUHJvZ3Jlc3MpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHRoaXMuaWQgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBvdGhlci5pZCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB0aGlzLmlkID09PSBvdGhlci5pZDtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHRoaXMuX3NvdXJjZSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdGlmICh0aGlzLl9zb3VyY2UubGFiZWwgIT09IG90aGVyLnNvdXJjZSB8fCB0aGlzLl9zb3VyY2UuaWQgIT09IG90aGVyLnNvdXJjZUlkKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHRoaXMuX3NvdXJjZSAhPT0gb3RoZXIuc291cmNlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX21lc3NhZ2UucmF3ICE9PSBvdGhlci5tZXNzYWdlLnJhdykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByaW1hcnlBY3Rpb25zID0gKHRoaXMuX2FjdGlvbnMgJiYgdGhpcy5fYWN0aW9ucy5wcmltYXJ5KSB8fCBbXTtcblx0XHRjb25zdCBvdGhlclByaW1hcnlBY3Rpb25zID0gKG90aGVyLmFjdGlvbnMgJiYgb3RoZXIuYWN0aW9ucy5wcmltYXJ5KSB8fCBbXTtcblx0XHRyZXR1cm4gZXF1YWxzKHByaW1hcnlBY3Rpb25zLCBvdGhlclByaW1hcnlBY3Rpb25zLCAoYWN0aW9uLCBvdGhlckFjdGlvbikgPT4gKGFjdGlvbi5pZCArIGFjdGlvbi5sYWJlbCkgPT09IChvdGhlckFjdGlvbi5pZCArIG90aGVyQWN0aW9uLmxhYmVsKSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENob2ljZUFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSdW4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRSdW4gPSB0aGlzLl9vbkRpZFJ1bi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9rZWVwT3BlbjogYm9vbGVhbjtcblx0cHJpdmF0ZSByZWFkb25seSBfbWVudTogQ2hvaWNlQWN0aW9uW10gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoaWQ6IHN0cmluZywgY2hvaWNlOiBJUHJvbXB0Q2hvaWNlKSB7XG5cdFx0c3VwZXIoaWQsIGNob2ljZS5sYWJlbCwgdW5kZWZpbmVkLCB0cnVlLCBhc3luYyAoKSA9PiB7XG5cblx0XHRcdC8vIFBhc3MgdG8gcnVubmVyXG5cdFx0XHRjaG9pY2UucnVuKCk7XG5cblx0XHRcdC8vIEVtaXQgRXZlbnRcblx0XHRcdHRoaXMuX29uRGlkUnVuLmZpcmUoKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX2tlZXBPcGVuID0gISFjaG9pY2Uua2VlcE9wZW47XG5cdFx0dGhpcy5fbWVudSA9ICFjaG9pY2UuaXNTZWNvbmRhcnkgJiYgKDxJUHJvbXB0Q2hvaWNlV2l0aE1lbnU+Y2hvaWNlKS5tZW51ID8gKDxJUHJvbXB0Q2hvaWNlV2l0aE1lbnU+Y2hvaWNlKS5tZW51Lm1hcCgoYywgaW5kZXgpID0+IG5ldyBDaG9pY2VBY3Rpb24oYCR7aWR9LiR7aW5kZXh9YCwgYykpIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IG1lbnUoKTogQ2hvaWNlQWN0aW9uW10gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9tZW51O1xuXHR9XG5cblx0Z2V0IGtlZXBPcGVuKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9rZWVwT3Blbjtcblx0fVxufVxuXG5jbGFzcyBTdGF0dXNNZXNzYWdlVmlld0l0ZW0ge1xuXG5cdHN0YXRpYyBjcmVhdGUobm90aWZpY2F0aW9uOiBOb3RpZmljYXRpb25NZXNzYWdlLCBvcHRpb25zPzogSVN0YXR1c01lc3NhZ2VPcHRpb25zKTogSVN0YXR1c01lc3NhZ2VWaWV3SXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFub3RpZmljYXRpb24gfHwgaXNDYW5jZWxsYXRpb25FcnJvcihub3RpZmljYXRpb24pKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyB3ZSBuZWVkIGEgbWVzc2FnZSB0byBzaG93XG5cdFx0fVxuXG5cdFx0bGV0IG1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAobm90aWZpY2F0aW9uIGluc3RhbmNlb2YgRXJyb3IpIHtcblx0XHRcdG1lc3NhZ2UgPSB0b0Vycm9yTWVzc2FnZShub3RpZmljYXRpb24sIGZhbHNlKTtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiBub3RpZmljYXRpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRtZXNzYWdlID0gbm90aWZpY2F0aW9uO1xuXHRcdH1cblxuXHRcdGlmICghbWVzc2FnZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDsgLy8gd2UgbmVlZCBhIG1lc3NhZ2UgdG8gc2hvd1xuXHRcdH1cblxuXHRcdHJldHVybiB7IG1lc3NhZ2UsIG9wdGlvbnMgfTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBMEYsa0JBQWtCLFVBQXFFLHFCQUE2RSxzQkFBMkMsNEJBQTRCO0FBQ3JVLFNBQVMsZ0JBQWdCLDBCQUEwQjtBQUNuRCxTQUFTLE9BQU8sZUFBZTtBQUMvQixTQUFTLFlBQXlCLG9CQUFvQjtBQUN0RCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsdUJBQW1DO0FBQzVDLFNBQVMsa0NBQWtDO0FBNkJwQyxJQUFXLHlCQUFYLGtCQUFXQSw0QkFBWDtBQUtOLEVBQUFBLGdEQUFBO0FBTUEsRUFBQUEsZ0RBQUE7QUFLQSxFQUFBQSxnREFBQTtBQUtBLEVBQUFBLGdEQUFBO0FBckJpQixTQUFBQTtBQUFBLEdBQUE7QUFnRFgsSUFBVywwQkFBWCxrQkFBV0MsNkJBQVg7QUFDTixFQUFBQSxrREFBQTtBQUNBLEVBQUFBLGtEQUFBO0FBRmlCLFNBQUFBO0FBQUEsR0FBQTtBQXVCWCxNQUFNLDJCQUEyQixXQUEwQztBQUFBLEVBUWpGLFlBQTZCLE1BQThDLFNBQWdEO0FBQzFILFVBQU07QUFEc0I7QUFBOEM7QUFOM0UsU0FBaUIsY0FBYyxLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDakUsU0FBUyxhQUFhLEtBQUssWUFBWTtBQUV2QyxTQUFpQix5QkFBeUIsS0FBSyxVQUFVLElBQUksUUFBaUIsQ0FBQztBQUMvRSxTQUFTLHdCQUF3QixLQUFLLHVCQUF1QjtBQUs1RCxTQUFLLGtCQUFrQjtBQUFBLEVBQ3hCO0FBQUEsRUFFUSxvQkFBMEI7QUFHakMsU0FBSyxVQUFVLEtBQUssS0FBSyxzQkFBc0IsYUFBVyxLQUFLLHVCQUF1QixLQUFLLE9BQU8sQ0FBQyxDQUFDO0FBR3BHLFVBQU0sS0FBSyxLQUFLLEtBQUssVUFBVSxFQUFFLE1BQU07QUFDdEMsV0FBSyxZQUFZLEtBQUs7QUFFdEIsV0FBSyxRQUFRO0FBQUEsSUFDZCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsSUFBSSxXQUFrQztBQUNyQyxXQUFPLEtBQUssS0FBSztBQUFBLEVBQ2xCO0FBQUEsRUFFQSxlQUFlLFVBQTBCO0FBQ3hDLFNBQUssS0FBSyxlQUFlLFFBQVE7QUFBQSxFQUNsQztBQUFBLEVBRUEsY0FBYyxTQUFvQztBQUNqRCxTQUFLLEtBQUssY0FBYyxPQUFPO0FBQUEsRUFDaEM7QUFBQSxFQUVBLGNBQWMsU0FBc0M7QUFDbkQsU0FBSyxLQUFLLGNBQWMsT0FBTztBQUFBLEVBQ2hDO0FBQUEsRUFFQSxRQUFjO0FBQ2IsU0FBSyxRQUFRLEtBQUssSUFBSTtBQUV0QixTQUFLLFFBQVE7QUFBQSxFQUNkO0FBQ0Q7QUFPTyxNQUFNLHNCQUFOLE1BQU0sNEJBQTJCLFdBQTBDO0FBQUEsRUFBM0U7QUFBQTtBQUlOLFNBQWlCLDJCQUEyQixLQUFLLFVBQVUsSUFBSSxRQUFrQyxDQUFDO0FBQ2xHLFNBQVMsMEJBQTBCLEtBQUsseUJBQXlCO0FBRWpFLFNBQWlCLDRCQUE0QixLQUFLLFVBQVUsSUFBSSxRQUFtQyxDQUFDO0FBQ3BHLFNBQVMsMkJBQTJCLEtBQUssMEJBQTBCO0FBRW5FLFNBQWlCLHFCQUFxQixLQUFLLFVBQVUsSUFBSSxRQUF1QyxDQUFDO0FBQ2pHLFNBQVMsb0JBQW9CLEtBQUssbUJBQW1CO0FBRXJELFNBQWlCLGlCQUEwQyxDQUFDO0FBTTVELFNBQWlCLFNBQVM7QUFBQSxNQUN6QixRQUFRLG9CQUFvQjtBQUFBLE1BQzVCLFNBQVMsb0JBQUksSUFBaUM7QUFBQSxJQUMvQztBQUFBO0FBQUEsRUFSQSxJQUFJLGdCQUF5QztBQUFFLFdBQU8sS0FBSztBQUFBLEVBQWdCO0FBQUEsRUFHM0UsSUFBSSxnQkFBb0Q7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFnQjtBQUFBLEVBT3RGLFVBQVUsUUFBNkM7QUFDdEQsUUFBSSxnQkFBZ0I7QUFDcEIsUUFBSSxPQUFPLE9BQU8sV0FBVyxVQUFVO0FBQ3RDLHNCQUFnQixLQUFLLE9BQU8sV0FBVyxPQUFPO0FBQzlDLFdBQUssT0FBTyxTQUFTLE9BQU87QUFBQSxJQUM3QjtBQUVBLFFBQUksaUJBQWlCO0FBQ3JCLFFBQUksT0FBTyxTQUFTO0FBQ25CLHVCQUFpQixDQUFDLDJCQUEyQixLQUFLLE9BQU8sU0FBUyxPQUFPLE9BQU87QUFDaEYsV0FBSyxPQUFPLFVBQVUsT0FBTztBQUFBLElBQzlCO0FBRUEsUUFBSSxpQkFBaUIsZ0JBQWdCO0FBQ3BDLFdBQUssbUJBQW1CLEtBQUs7QUFBQSxRQUM1QixRQUFRLGdCQUFnQixPQUFPLFNBQVM7QUFBQSxRQUN4QyxTQUFTLGlCQUFpQixPQUFPLFVBQVU7QUFBQSxNQUM1QyxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLGdCQUFnQixjQUFrRDtBQUNqRSxVQUFNLE9BQU8sS0FBSyxlQUFlLFlBQVk7QUFDN0MsUUFBSSxDQUFDLE1BQU07QUFDVixhQUFPLG9CQUFtQjtBQUFBLElBQzNCO0FBR0EsVUFBTSxZQUFZLEtBQUssaUJBQWlCLElBQUk7QUFDNUMsZUFBVyxNQUFNO0FBR2pCLFNBQUssZUFBZSxPQUFPLEdBQUcsR0FBRyxJQUFJO0FBR3JDLFNBQUsseUJBQXlCLEtBQUssRUFBRSxNQUFNLE9BQU8sR0FBRyxNQUFNLFlBQTJCLENBQUM7QUFHdkYsV0FBTyxJQUFJLG1CQUFtQixNQUFNLENBQUFDLFVBQVEsS0FBSyxRQUFRQSxLQUFJLENBQUM7QUFBQSxFQUMvRDtBQUFBLEVBRVEsUUFBUSxNQUFtQztBQUNsRCxVQUFNLFdBQVcsS0FBSyxpQkFBaUIsSUFBSTtBQUMzQyxRQUFJLFlBQVksYUFBYSxNQUFNO0FBQ2xDLGVBQVMsTUFBTTtBQUFBLElBQ2hCLE9BQU87QUFDTixXQUFLLE1BQU07QUFBQSxJQUNaO0FBQUEsRUFDRDtBQUFBLEVBRVEsaUJBQWlCLE1BQWdFO0FBQ3hGLFdBQU8sS0FBSyxlQUFlLEtBQUssa0JBQWdCLGFBQWEsT0FBTyxJQUFJLENBQUM7QUFBQSxFQUMxRTtBQUFBLEVBRVEsZUFBZSxjQUFnRTtBQUN0RixVQUFNLE9BQU8scUJBQXFCLE9BQU8sY0FBYyxLQUFLLE1BQU07QUFDbEUsUUFBSSxDQUFDLE1BQU07QUFDVixhQUFPO0FBQUEsSUFDUjtBQUdBLFVBQU0sOEJBQThCLENBQUMsTUFBOEIsV0FBbUQ7QUFDckgsWUFBTSxRQUFRLEtBQUssZUFBZSxRQUFRLElBQUk7QUFDOUMsVUFBSSxTQUFTLEdBQUc7QUFDZixhQUFLLHlCQUF5QixLQUFLLEVBQUUsTUFBTSxPQUFPLE1BQU0sT0FBTyxDQUFDO0FBQUEsTUFDakU7QUFBQSxJQUNEO0FBRUEsVUFBTSw4QkFBOEIsS0FBSyxxQkFBcUIsTUFBTSw0QkFBNEIsdUJBQXNDLENBQUM7QUFDdkksVUFBTSw0QkFBNEIsS0FBSyxtQkFBbUIsT0FBSyw0QkFBNEIsZ0JBQStCLEVBQUUsSUFBSSxDQUFDO0FBRWpJLFVBQU0sS0FBSyxLQUFLLFVBQVUsRUFBRSxNQUFNO0FBQ2pDLGtDQUE0QixRQUFRO0FBQ3BDLGdDQUEwQixRQUFRO0FBRWxDLFlBQU0sUUFBUSxLQUFLLGVBQWUsUUFBUSxJQUFJO0FBQzlDLFVBQUksU0FBUyxHQUFHO0FBQ2YsYUFBSyxlQUFlLE9BQU8sT0FBTyxDQUFDO0FBQ25DLGFBQUsseUJBQXlCLEtBQUssRUFBRSxNQUFNLE9BQU8sTUFBTSxlQUE4QixDQUFDO0FBQUEsTUFDeEY7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsa0JBQWtCLFNBQThCLFNBQThDO0FBQzdGLFVBQU0sT0FBTyxzQkFBc0IsT0FBTyxTQUFTLE9BQU87QUFDMUQsUUFBSSxDQUFDLE1BQU07QUFDVixhQUFPLFdBQVc7QUFBQSxJQUNuQjtBQUdBLFNBQUssaUJBQWlCO0FBQ3RCLFNBQUssMEJBQTBCLEtBQUssRUFBRSxNQUFNLGFBQTZCLEtBQUssQ0FBQztBQUUvRSxXQUFPLGFBQWEsTUFBTTtBQUd6QixVQUFJLEtBQUssbUJBQW1CLE1BQU07QUFDakMsYUFBSyxpQkFBaUI7QUFDdEIsYUFBSywwQkFBMEIsS0FBSyxFQUFFLE1BQU0sZ0JBQWdDLEtBQUssQ0FBQztBQUFBLE1BQ25GO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUNEO0FBaElhLG9CQUVZLHFCQUFxQixJQUFJLGlCQUFpQjtBQUY1RCxJQUFNLHFCQUFOO0FBc0tBLFNBQVMsdUJBQXVCLEtBQTRDO0FBQ2xGLFNBQU8sZUFBZTtBQUN2QjtBQUVPLElBQVcsd0NBQVgsa0JBQVdDLDJDQUFYO0FBQ04sRUFBQUEsOEVBQUE7QUFDQSxFQUFBQSw4RUFBQTtBQUNBLEVBQUFBLDhFQUFBO0FBQ0EsRUFBQUEsOEVBQUE7QUFKaUIsU0FBQUE7QUFBQSxHQUFBO0FBd0JYLE1BQU0scUNBQXFDLFdBQW9EO0FBQUEsRUFNckcsY0FBYztBQUNiLFVBQU07QUFKUCxTQUFpQixlQUFlLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUNsRSxTQUFTLGNBQWMsS0FBSyxhQUFhO0FBS3hDLFNBQUssU0FBUyx1QkFBTyxPQUFPLElBQUk7QUFBQSxFQUNqQztBQUFBLEVBRUEsSUFBSSxRQUE0QztBQUMvQyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxXQUFpQjtBQUNoQixRQUFJLEtBQUssT0FBTyxVQUFVO0FBQ3pCO0FBQUEsSUFDRDtBQUVBLFNBQUssT0FBTyxXQUFXO0FBRXZCLFNBQUssT0FBTyxRQUFRO0FBQ3BCLFNBQUssT0FBTyxTQUFTO0FBQ3JCLFNBQUssT0FBTyxPQUFPO0FBRW5CLFNBQUssYUFBYSxLQUFLO0FBQUEsRUFDeEI7QUFBQSxFQUVBLE9BQWE7QUFDWixRQUFJLEtBQUssT0FBTyxNQUFNO0FBQ3JCO0FBQUEsSUFDRDtBQUVBLFNBQUssT0FBTyxPQUFPO0FBRW5CLFNBQUssT0FBTyxXQUFXO0FBQ3ZCLFNBQUssT0FBTyxRQUFRO0FBQ3BCLFNBQUssT0FBTyxTQUFTO0FBRXJCLFNBQUssYUFBYSxLQUFLO0FBQUEsRUFDeEI7QUFBQSxFQUVBLE1BQU0sT0FBcUI7QUFDMUIsUUFBSSxLQUFLLE9BQU8sVUFBVSxPQUFPO0FBQ2hDO0FBQUEsSUFDRDtBQUVBLFNBQUssT0FBTyxRQUFRO0FBRXBCLFNBQUssT0FBTyxXQUFXO0FBQ3ZCLFNBQUssT0FBTyxPQUFPO0FBRW5CLFNBQUssYUFBYSxLQUFLO0FBQUEsRUFDeEI7QUFBQSxFQUVBLE9BQU8sT0FBcUI7QUFDM0IsUUFBSSxPQUFPLEtBQUssT0FBTyxXQUFXLFVBQVU7QUFDM0MsV0FBSyxPQUFPLFVBQVU7QUFBQSxJQUN2QixPQUFPO0FBQ04sV0FBSyxPQUFPLFNBQVM7QUFBQSxJQUN0QjtBQUVBLFNBQUssT0FBTyxXQUFXO0FBQ3ZCLFNBQUssT0FBTyxPQUFPO0FBRW5CLFNBQUssYUFBYSxLQUFLO0FBQUEsRUFDeEI7QUFDRDtBQWdCTyxNQUFNLHdCQUFOLE1BQU0sOEJBQTZCLFdBQTRDO0FBQUEsRUFzRjdFLFlBQ0UsSUFDRCxXQUNBLFNBQ0EsV0FDQSxVQUNBLFNBQ1IsVUFDQSxTQUNDO0FBQ0QsVUFBTTtBQVRHO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXZGVCxTQUFRLFdBQW9CO0FBSzVCLFNBQWlCLHdCQUF3QixLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDM0UsU0FBUyx1QkFBdUIsS0FBSyxzQkFBc0I7QUFFM0QsU0FBaUIsY0FBYyxLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDakUsU0FBUyxhQUFhLEtBQUssWUFBWTtBQUV2QyxTQUFpQixzQkFBc0IsS0FBSyxVQUFVLElBQUksUUFBaUQsQ0FBQztBQUM1RyxTQUFTLHFCQUFxQixLQUFLLG9CQUFvQjtBQUV2RCxTQUFpQix5QkFBeUIsS0FBSyxVQUFVLElBQUksUUFBaUIsQ0FBQztBQUMvRSxTQUFTLHdCQUF3QixLQUFLLHVCQUF1QjtBQThFNUQsUUFBSSxVQUFVO0FBQ2IsV0FBSyxZQUFZLFFBQVE7QUFBQSxJQUMxQjtBQUVBLFNBQUssV0FBVyxPQUFPO0FBQUEsRUFDeEI7QUFBQSxFQWpGQSxPQUFPLE9BQU8sY0FBNkIsUUFBaUU7QUFDM0csUUFBSSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsV0FBVyxvQkFBb0IsYUFBYSxPQUFPLEdBQUc7QUFDeEYsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJO0FBQ0osUUFBSSxPQUFPLGFBQWEsYUFBYSxVQUFVO0FBQzlDLGlCQUFXLGFBQWE7QUFBQSxJQUN6QixPQUFPO0FBQ04saUJBQVcsU0FBUztBQUFBLElBQ3JCO0FBRUEsVUFBTSxVQUFVLHNCQUFxQix5QkFBeUIsYUFBYSxPQUFPO0FBQ2xGLFFBQUksQ0FBQyxTQUFTO0FBQ2IsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJO0FBQ0osUUFBSSxhQUFhLFNBQVM7QUFDekIsZ0JBQVUsYUFBYTtBQUFBLElBQ3hCLFdBQVcsbUJBQW1CLGFBQWEsT0FBTyxHQUFHO0FBQ3BELGdCQUFVLEVBQUUsU0FBUyxhQUFhLFFBQVEsUUFBUTtBQUFBLElBQ25EO0FBRUEsUUFBSSxXQUFXLGFBQWEsWUFBWSxxQkFBcUI7QUFDN0QsUUFBSSxhQUFhLHFCQUFxQixXQUFXLGFBQWEsU0FBUyxPQUFPO0FBQzdFLFVBQUksT0FBTyxXQUFXLG9CQUFvQixPQUFPO0FBQ2hELG1CQUFXLHFCQUFxQjtBQUFBLE1BQ2pDLFdBQVcscUJBQXFCLGFBQWEsTUFBTSxLQUFLLE9BQU8sUUFBUSxJQUFJLGFBQWEsT0FBTyxFQUFFLE1BQU0sb0JBQW9CLE9BQU87QUFDakksbUJBQVcscUJBQXFCO0FBQUEsTUFDakM7QUFBQSxJQUNEO0FBRUEsV0FBTyxJQUFJLHNCQUFxQixhQUFhLElBQUksVUFBVSxhQUFhLFFBQVEsVUFBVSxTQUFTLGFBQWEsUUFBUSxhQUFhLFVBQVUsT0FBTztBQUFBLEVBQ3ZKO0FBQUEsRUFFQSxPQUFlLHlCQUF5QixPQUE4RDtBQUNyRyxRQUFJO0FBQ0osUUFBSSxpQkFBaUIsT0FBTztBQUMzQixnQkFBVSxlQUFlLE9BQU8sS0FBSztBQUFBLElBQ3RDLFdBQVcsT0FBTyxVQUFVLFVBQVU7QUFDckMsZ0JBQVU7QUFBQSxJQUNYO0FBRUEsUUFBSSxDQUFDLFNBQVM7QUFDYixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sTUFBTTtBQUdaLFFBQUksUUFBUSxTQUFTLHNCQUFxQixvQkFBb0I7QUFDN0QsZ0JBQVUsR0FBRyxRQUFRLE9BQU8sR0FBRyxzQkFBcUIsa0JBQWtCLENBQUM7QUFBQSxJQUN4RTtBQUdBLGNBQVUsUUFBUSxRQUFRLGtCQUFrQixHQUFHLEVBQUUsS0FBSztBQUd0RCxVQUFNLGFBQWEsZ0JBQWdCLE9BQU87QUFFMUMsV0FBTyxFQUFFLEtBQUssWUFBWSxVQUFVLE1BQU07QUFBQSxFQUMzQztBQUFBLEVBcUJRLFlBQVksVUFBaUQ7QUFDcEUsUUFBSSxTQUFTLFVBQVU7QUFDdEIsV0FBSyxTQUFTLFNBQVM7QUFBQSxJQUN4QixXQUFXLFNBQVMsT0FBTztBQUMxQixXQUFLLFNBQVMsTUFBTSxTQUFTLEtBQUs7QUFFbEMsVUFBSSxTQUFTLFFBQVE7QUFDcEIsYUFBSyxTQUFTLE9BQU8sU0FBUyxNQUFNO0FBQUEsTUFDckM7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVEsV0FBVyxVQUFnQyxFQUFFLFNBQVMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxFQUFFLEdBQVM7QUFDeEYsU0FBSyxXQUFXO0FBQUEsTUFDZixTQUFTLE1BQU0sUUFBUSxRQUFRLE9BQU8sSUFBSSxRQUFRLFVBQVUsQ0FBQztBQUFBLE1BQzdELFdBQVcsTUFBTSxRQUFRLFFBQVEsU0FBUyxJQUFJLFFBQVEsWUFBWSxDQUFDO0FBQUEsSUFDcEU7QUFFQSxTQUFLLFlBQVksUUFBUSxXQUFXLFFBQVEsUUFBUSxTQUFTO0FBQUEsRUFDOUQ7QUFBQSxFQUVBLElBQUksY0FBdUI7QUFDMUIsV0FBTyxDQUFDLEtBQUs7QUFBQSxFQUNkO0FBQUEsRUFFQSxJQUFJLFdBQW9CO0FBQ3ZCLFdBQU8sQ0FBQyxDQUFDLEtBQUs7QUFBQSxFQUNmO0FBQUEsRUFFQSxJQUFJLFdBQXFCO0FBQ3hCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLElBQUksU0FBa0I7QUFDckIsUUFBSSxLQUFLLFNBQVM7QUFDakIsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGFBQWEsS0FBSztBQUN4QixRQUNFLGNBQWMsS0FBSyxjQUFjLFNBQVM7QUFBQSxJQUMxQyxDQUFDLGNBQWMsS0FBSztBQUFBLElBQ3BCLEtBQUssYUFBYSxDQUFDLEtBQUssVUFBVSxNQUFNLE1BQ3hDO0FBQ0QsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsSUFBSSxXQUFpQztBQUNwQyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFZLGFBQXNCO0FBQ2pDLFFBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkIsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLENBQUMsS0FBSyxTQUFTLFNBQVM7QUFDM0IsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLEtBQUssU0FBUyxRQUFRLFNBQVM7QUFBQSxFQUN2QztBQUFBLEVBRUEsSUFBSSxjQUF1QjtBQUMxQixXQUFPLENBQUMsQ0FBQyxLQUFLO0FBQUEsRUFDZjtBQUFBLEVBRUEsSUFBSSxXQUEwQztBQUM3QyxRQUFJLENBQUMsS0FBSyxXQUFXO0FBQ3BCLFdBQUssWUFBWSxLQUFLLFVBQVUsSUFBSSw2QkFBNkIsQ0FBQztBQUNsRSxXQUFLLFVBQVUsS0FBSyxVQUFVLFlBQVksTUFBTSxLQUFLLG9CQUFvQixLQUFLLEVBQUUsTUFBTSxpQkFBK0MsQ0FBQyxDQUFDLENBQUM7QUFBQSxJQUN6STtBQUVBLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLElBQUksVUFBZ0M7QUFDbkMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSxTQUE2QjtBQUNoQyxXQUFPLE9BQU8sS0FBSyxZQUFZLFdBQVcsS0FBSyxVQUFXLEtBQUssVUFBVSxLQUFLLFFBQVEsUUFBUTtBQUFBLEVBQy9GO0FBQUEsRUFFQSxJQUFJLFdBQStCO0FBQ2xDLFdBQVEsS0FBSyxXQUFXLE9BQU8sS0FBSyxZQUFZLFlBQVksUUFBUSxLQUFLLFVBQVcsS0FBSyxRQUFRLEtBQUs7QUFBQSxFQUN2RztBQUFBLEVBRUEsSUFBSSxVQUE0QztBQUMvQyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLFVBQW1CO0FBQ3RCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLGVBQWUsVUFBMEI7QUFDeEMsUUFBSSxhQUFhLEtBQUssV0FBVztBQUNoQztBQUFBLElBQ0Q7QUFFQSxTQUFLLFlBQVk7QUFDakIsU0FBSyxvQkFBb0IsS0FBSyxFQUFFLE1BQU0saUJBQStDLENBQUM7QUFBQSxFQUN2RjtBQUFBLEVBRUEsY0FBYyxPQUFrQztBQUMvQyxVQUFNLFVBQVUsc0JBQXFCLHlCQUF5QixLQUFLO0FBQ25FLFFBQUksQ0FBQyxXQUFXLFFBQVEsUUFBUSxLQUFLLFNBQVMsS0FBSztBQUNsRDtBQUFBLElBQ0Q7QUFFQSxTQUFLLFdBQVc7QUFDaEIsU0FBSyxvQkFBb0IsS0FBSyxFQUFFLE1BQU0sZ0JBQThDLENBQUM7QUFBQSxFQUN0RjtBQUFBLEVBRUEsY0FBYyxTQUFzQztBQUNuRCxTQUFLLFdBQVcsT0FBTztBQUN2QixTQUFLLG9CQUFvQixLQUFLLEVBQUUsTUFBTSxnQkFBOEMsQ0FBQztBQUFBLEVBQ3RGO0FBQUEsRUFFQSxpQkFBaUIsU0FBd0I7QUFDeEMsUUFBSSxLQUFLLGFBQWEsU0FBUztBQUM5QixXQUFLLFdBQVc7QUFFaEIsV0FBSyx1QkFBdUIsS0FBSyxPQUFPO0FBQUEsSUFDekM7QUFBQSxFQUNEO0FBQUEsRUFFQSxTQUFlO0FBQ2QsUUFBSSxLQUFLLGFBQWEsQ0FBQyxLQUFLLGFBQWE7QUFDeEM7QUFBQSxJQUNEO0FBRUEsU0FBSyxZQUFZO0FBQ2pCLFNBQUssc0JBQXNCLEtBQUs7QUFBQSxFQUNqQztBQUFBLEVBRUEsU0FBUyxZQUE0QjtBQUNwQyxRQUFJLENBQUMsS0FBSyxhQUFhLENBQUMsS0FBSyxhQUFhO0FBQ3pDO0FBQUEsSUFDRDtBQUVBLFNBQUssWUFBWTtBQUVqQixRQUFJLENBQUMsWUFBWTtBQUNoQixXQUFLLHNCQUFzQixLQUFLO0FBQUEsSUFDakM7QUFBQSxFQUNEO0FBQUEsRUFFQSxTQUFlO0FBQ2QsUUFBSSxLQUFLLFdBQVc7QUFDbkIsV0FBSyxTQUFTO0FBQUEsSUFDZixPQUFPO0FBQ04sV0FBSyxPQUFPO0FBQUEsSUFDYjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFFBQWM7QUFDYixTQUFLLFlBQVksS0FBSztBQUV0QixTQUFLLFFBQVE7QUFBQSxFQUNkO0FBQUEsRUFFQSxPQUFPLE9BQXVDO0FBQzdDLFFBQUksS0FBSyxlQUFlLE1BQU0sYUFBYTtBQUMxQyxhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksT0FBTyxLQUFLLE9BQU8sWUFBWSxPQUFPLE1BQU0sT0FBTyxVQUFVO0FBQ2hFLGFBQU8sS0FBSyxPQUFPLE1BQU07QUFBQSxJQUMxQjtBQUVBLFFBQUksT0FBTyxLQUFLLFlBQVksVUFBVTtBQUNyQyxVQUFJLEtBQUssUUFBUSxVQUFVLE1BQU0sVUFBVSxLQUFLLFFBQVEsT0FBTyxNQUFNLFVBQVU7QUFDOUUsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNELFdBQVcsS0FBSyxZQUFZLE1BQU0sUUFBUTtBQUN6QyxhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksS0FBSyxTQUFTLFFBQVEsTUFBTSxRQUFRLEtBQUs7QUFDNUMsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGlCQUFrQixLQUFLLFlBQVksS0FBSyxTQUFTLFdBQVksQ0FBQztBQUNwRSxVQUFNLHNCQUF1QixNQUFNLFdBQVcsTUFBTSxRQUFRLFdBQVksQ0FBQztBQUN6RSxXQUFPLE9BQU8sZ0JBQWdCLHFCQUFxQixDQUFDLFFBQVEsZ0JBQWlCLE9BQU8sS0FBSyxPQUFPLFVBQVksWUFBWSxLQUFLLFlBQVksS0FBTTtBQUFBLEVBQ2hKO0FBQ0Q7QUF4U2Esc0JBRVkscUJBQXFCO0FBRnZDLElBQU0sdUJBQU47QUEwU0EsTUFBTSxxQkFBcUIsT0FBTztBQUFBLEVBUXhDLFlBQVksSUFBWSxRQUF1QjtBQUM5QyxVQUFNLElBQUksT0FBTyxPQUFPLFFBQVcsTUFBTSxZQUFZO0FBR3BELGFBQU8sSUFBSTtBQUdYLFdBQUssVUFBVSxLQUFLO0FBQUEsSUFDckIsQ0FBQztBQWRGLFNBQWlCLFlBQVksS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQy9ELFNBQVMsV0FBVyxLQUFLLFVBQVU7QUFlbEMsU0FBSyxZQUFZLENBQUMsQ0FBQyxPQUFPO0FBQzFCLFNBQUssUUFBUSxDQUFDLE9BQU8sZUFBdUMsT0FBUSxPQUErQixPQUFRLEtBQUssSUFBSSxDQUFDLEdBQUcsVUFBVSxJQUFJLGFBQWEsR0FBRyxFQUFFLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQyxJQUFJO0FBQUEsRUFDNUs7QUFBQSxFQUVBLElBQUksT0FBbUM7QUFDdEMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSxXQUFvQjtBQUN2QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQ0Q7QUFFQSxNQUFNLHNCQUFzQjtBQUFBLEVBRTNCLE9BQU8sT0FBTyxjQUFtQyxTQUFxRTtBQUNySCxRQUFJLENBQUMsZ0JBQWdCLG9CQUFvQixZQUFZLEdBQUc7QUFDdkQsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJO0FBQ0osUUFBSSx3QkFBd0IsT0FBTztBQUNsQyxnQkFBVSxlQUFlLGNBQWMsS0FBSztBQUFBLElBQzdDLFdBQVcsT0FBTyxpQkFBaUIsVUFBVTtBQUM1QyxnQkFBVTtBQUFBLElBQ1g7QUFFQSxRQUFJLENBQUMsU0FBUztBQUNiLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxFQUFFLFNBQVMsUUFBUTtBQUFBLEVBQzNCO0FBQ0Q7IiwKICAibmFtZXMiOiBbIk5vdGlmaWNhdGlvbkNoYW5nZVR5cGUiLCAiU3RhdHVzTWVzc2FnZUNoYW5nZVR5cGUiLCAiaXRlbSIsICJOb3RpZmljYXRpb25WaWV3SXRlbUNvbnRlbnRDaGFuZ2VLaW5kIl0KfQo=
