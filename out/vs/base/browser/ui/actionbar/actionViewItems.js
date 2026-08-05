import { isFirefox } from "../../browser.js";
import { DataTransfers } from "../../dnd.js";
import { addDisposableListener, EventHelper, EventType } from "../../dom.js";
import { EventType as TouchEventType, Gesture } from "../../touch.js";
import { getDefaultHoverDelegate } from "../hover/hoverDelegateFactory.js";
import { SelectBox } from "../selectBox/selectBox.js";
import { Action, ActionRunner, Separator } from "../../../common/actions.js";
import { Disposable } from "../../../common/lifecycle.js";
import * as platform from "../../../common/platform.js";
import * as types from "../../../common/types.js";
import "./actionbar.css";
import * as nls from "../../../../nls.js";
import { getBaseLayerHoverDelegate } from "../hover/hoverDelegate2.js";
class BaseActionViewItem extends Disposable {
  constructor(context, action, options = {}) {
    super();
    this.options = options;
    this._context = context || this;
    this._action = action;
    if (action instanceof Action) {
      this._register(action.onDidChange((event) => {
        if (!this.element) {
          return;
        }
        this.handleActionChangeEvent(event);
      }));
    }
  }
  get action() {
    return this._action;
  }
  handleActionChangeEvent(event) {
    if (event.enabled !== void 0) {
      this.updateEnabled();
    }
    if (event.checked !== void 0) {
      this.updateChecked();
    }
    if (event.class !== void 0) {
      this.updateClass();
    }
    if (event.label !== void 0) {
      this.updateLabel();
      this.updateTooltip();
    }
    if (event.tooltip !== void 0) {
      this.updateTooltip();
    }
  }
  get actionRunner() {
    if (!this._actionRunner) {
      this._actionRunner = this._register(new ActionRunner());
    }
    return this._actionRunner;
  }
  set actionRunner(actionRunner) {
    this._actionRunner = actionRunner;
  }
  isEnabled() {
    return this._action.enabled;
  }
  setActionContext(newContext) {
    this._context = newContext;
  }
  render(container) {
    const element = this.element = container;
    this._register(Gesture.addTarget(container));
    const enableDragging = this.options && this.options.draggable;
    if (enableDragging) {
      container.draggable = true;
      if (isFirefox) {
        this._register(addDisposableListener(container, EventType.DRAG_START, (e) => e.dataTransfer?.setData(DataTransfers.TEXT, this._action.label)));
      }
    }
    this._register(addDisposableListener(element, TouchEventType.Tap, (e) => this.onClick(e, true)));
    this._register(addDisposableListener(element, EventType.MOUSE_DOWN, (e) => {
      if (!enableDragging) {
        EventHelper.stop(e, true);
      }
      if (this._action.enabled && e.button === 0) {
        element.classList.add("active");
      }
    }));
    if (platform.isMacintosh) {
      this._register(addDisposableListener(element, EventType.CONTEXT_MENU, (e) => {
        if (e.button === 0 && e.ctrlKey === true) {
          this.onClick(e);
        }
      }));
    }
    this._register(addDisposableListener(element, EventType.CLICK, (e) => {
      EventHelper.stop(e, true);
      if (!(this.options && this.options.isMenu)) {
        this.onClick(e);
      }
    }));
    this._register(addDisposableListener(element, EventType.DBLCLICK, (e) => {
      EventHelper.stop(e, true);
    }));
    [EventType.MOUSE_UP, EventType.MOUSE_OUT].forEach((event) => {
      this._register(addDisposableListener(element, event, (e) => {
        EventHelper.stop(e);
        element.classList.remove("active");
      }));
    });
  }
  onClick(event, preserveFocus = false) {
    EventHelper.stop(event, true);
    const context = types.isUndefinedOrNull(this._context) ? this.options?.useEventAsContext ? event : { preserveFocus } : this._context;
    this.actionRunner.run(this._action, context);
  }
  // Only set the tabIndex on the element once it is about to get focused
  // That way this element wont be a tab stop when it is not needed #106441
  focus() {
    if (this.element) {
      this.element.tabIndex = 0;
      this.element.focus();
      this.element.classList.add("focused");
    }
  }
  isFocused() {
    return !!this.element?.classList.contains("focused");
  }
  blur() {
    if (this.element) {
      this.element.blur();
      this.element.tabIndex = -1;
      this.element.classList.remove("focused");
    }
  }
  setFocusable(focusable) {
    if (this.element) {
      this.element.tabIndex = focusable ? 0 : -1;
    }
  }
  get trapsArrowNavigation() {
    return false;
  }
  updateEnabled() {
  }
  updateLabel() {
  }
  getClass() {
    return this.action.class;
  }
  getTooltip() {
    return this.action.tooltip;
  }
  updateTooltip() {
    if (!this.element) {
      return;
    }
    const title = this.getTooltip() ?? "";
    this.updateAriaLabel();
    if (this.options.hoverDelegate?.showNativeHover) {
      this.element.title = title;
    } else {
      if (!this.customHover && title !== "") {
        const hoverDelegate = this.options.hoverDelegate ?? getDefaultHoverDelegate("element");
        this.customHover = this._store.add(getBaseLayerHoverDelegate().setupManagedHover(hoverDelegate, this.element, title));
      } else if (this.customHover) {
        this.customHover.update(title);
      }
    }
  }
  updateAriaLabel() {
    if (this.element) {
      const title = this.getTooltip() ?? "";
      this.element.setAttribute("aria-label", title);
    }
  }
  updateClass() {
  }
  updateChecked() {
  }
  dispose() {
    if (this.element) {
      this.element.remove();
      this.element = void 0;
    }
    this._context = void 0;
    super.dispose();
  }
}
class ActionViewItem extends BaseActionViewItem {
  constructor(context, action, options) {
    super(context, action, options);
    this.options = options;
    this.options.icon = options.icon !== void 0 ? options.icon : false;
    this.options.label = options.label !== void 0 ? options.label : true;
    this.cssClass = "";
  }
  render(container) {
    super.render(container);
    types.assertType(this.element);
    const label = document.createElement("a");
    label.classList.add("action-label");
    label.setAttribute("role", this.getDefaultAriaRole());
    this.label = label;
    this.element.appendChild(label);
    if (this.options.label && this.options.keybinding && !this.options.keybindingNotRenderedWithLabel) {
      const kbLabel = document.createElement("span");
      kbLabel.classList.add("keybinding");
      kbLabel.textContent = this.options.keybinding;
      this.element.appendChild(kbLabel);
    }
    this.updateClass();
    this.updateLabel();
    this.updateTooltip();
    this.updateEnabled();
    this.updateChecked();
  }
  getDefaultAriaRole() {
    if (this._action.id === Separator.ID) {
      return "presentation";
    } else {
      if (this.options.isMenu) {
        return "menuitem";
      } else if (this.options.isTabList) {
        return "tab";
      } else {
        return "button";
      }
    }
  }
  // Only set the tabIndex on the element once it is about to get focused
  // That way this element wont be a tab stop when it is not needed #106441
  focus() {
    if (this.label) {
      this.label.tabIndex = 0;
      this.label.focus();
    }
  }
  isFocused() {
    return !!this.label && this.label?.tabIndex === 0;
  }
  blur() {
    if (this.label) {
      this.label.tabIndex = -1;
    }
  }
  setFocusable(focusable) {
    if (this.label) {
      this.label.tabIndex = focusable ? 0 : -1;
    }
  }
  updateLabel() {
    if (this.options.label && this.label) {
      this.label.textContent = this.action.label;
    }
  }
  getTooltip() {
    let title = null;
    if (this.action.tooltip) {
      title = this.action.tooltip;
    } else if (this.action.label) {
      title = this.action.label;
      if (this.options.keybinding) {
        title = nls.localize({ key: "titleLabel", comment: ["action title", "action keybinding"] }, "{0} ({1})", title, this.options.keybinding);
      }
    }
    return title ?? void 0;
  }
  updateClass() {
    if (this.cssClass && this.label) {
      this.label.classList.remove(...this.cssClass.split(" "));
    }
    if (this.options.icon) {
      this.cssClass = this.getClass();
      if (this.label) {
        this.label.classList.add("codicon");
        if (this.cssClass) {
          this.label.classList.add(...this.cssClass.split(" "));
        }
      }
      this.updateEnabled();
    } else {
      this.label?.classList.remove("codicon");
    }
  }
  updateEnabled() {
    if (this.action.enabled) {
      if (this.label) {
        this.label.removeAttribute("aria-disabled");
        this.label.classList.remove("disabled");
      }
      this.element?.classList.remove("disabled");
    } else {
      if (this.label) {
        this.label.setAttribute("aria-disabled", "true");
        this.label.classList.add("disabled");
      }
      this.element?.classList.add("disabled");
    }
  }
  updateAriaLabel() {
    if (this.label) {
      const title = this.getTooltip() ?? "";
      this.label.setAttribute("aria-label", title);
    }
  }
  updateChecked() {
    if (this.label) {
      if (this.action.checked !== void 0) {
        this.label.classList.toggle("checked", this.action.checked);
        if (this.options.isTabList) {
          this.label.setAttribute("aria-selected", this.action.checked ? "true" : "false");
        } else {
          this.label.setAttribute("aria-checked", this.action.checked ? "true" : "false");
          this.label.setAttribute("role", "checkbox");
        }
      } else {
        this.label.classList.remove("checked");
        this.label.removeAttribute(this.options.isTabList ? "aria-selected" : "aria-checked");
        this.label.setAttribute("role", this.getDefaultAriaRole());
      }
    }
  }
}
class SelectActionViewItem extends BaseActionViewItem {
  constructor(ctx, action, options, selected, contextViewProvider, styles, selectBoxOptions) {
    super(ctx, action);
    this.selectBox = new SelectBox(options, selected, contextViewProvider, styles, selectBoxOptions);
    this.selectBox.setFocusable(false);
    this._register(this.selectBox);
    this.registerListeners();
  }
  setOptions(options, selected) {
    this.selectBox.setOptions(options, selected);
  }
  select(index) {
    this.selectBox.select(index);
  }
  registerListeners() {
    this._register(this.selectBox.onDidSelect((e) => this.runAction(e.selected, e.index)));
  }
  runAction(option, index) {
    this.actionRunner.run(this._action, this.getActionContext(option, index));
  }
  getActionContext(option, index) {
    return option;
  }
  setFocusable(focusable) {
    this.selectBox.setFocusable(focusable);
  }
  focus() {
    this.selectBox?.focus();
  }
  blur() {
    this.selectBox?.blur();
  }
  render(container) {
    this.selectBox.render(container);
  }
}
export {
  ActionViewItem,
  BaseActionViewItem,
  SelectActionViewItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGlzRmlyZWZveCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVycyB9IGZyb20gJy4uLy4uL2RuZC5qcyc7XG5pbXBvcnQgeyBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIEV2ZW50SGVscGVyLCBFdmVudExpa2UsIEV2ZW50VHlwZSB9IGZyb20gJy4uLy4uL2RvbS5qcyc7XG5pbXBvcnQgeyBFdmVudFR5cGUgYXMgVG91Y2hFdmVudFR5cGUsIEdlc3R1cmUgfSBmcm9tICcuLi8uLi90b3VjaC5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dFZpZXdQcm92aWRlciB9IGZyb20gJy4uL2NvbnRleHR2aWV3L2NvbnRleHR2aWV3LmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi9ob3Zlci9ob3ZlckRlbGVnYXRlLmpzJztcbmltcG9ydCB7IElTZWxlY3RCb3hPcHRpb25zLCBJU2VsZWN0Qm94U3R5bGVzLCBJU2VsZWN0T3B0aW9uSXRlbSwgU2VsZWN0Qm94IH0gZnJvbSAnLi4vc2VsZWN0Qm94L3NlbGVjdEJveC5qcyc7XG5pbXBvcnQgeyBJVG9nZ2xlU3R5bGVzIH0gZnJvbSAnLi4vdG9nZ2xlL3RvZ2dsZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIEFjdGlvblJ1bm5lciwgSUFjdGlvbiwgSUFjdGlvbkNoYW5nZUV2ZW50LCBJQWN0aW9uUnVubmVyLCBTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0ICogYXMgdHlwZXMgZnJvbSAnLi4vLi4vLi4vY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCAnLi9hY3Rpb25iYXIuY3NzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHR5cGUgeyBJTWFuYWdlZEhvdmVyIH0gZnJvbSAnLi4vaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgZ2V0QmFzZUxheWVySG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uL2hvdmVyL2hvdmVyRGVsZWdhdGUyLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJQmFzZUFjdGlvblZpZXdJdGVtT3B0aW9ucyB7XG5cdGRyYWdnYWJsZT86IGJvb2xlYW47XG5cdGlzTWVudT86IGJvb2xlYW47XG5cdGlzVGFiTGlzdD86IGJvb2xlYW47XG5cdHVzZUV2ZW50QXNDb250ZXh0PzogYm9vbGVhbjtcblx0aG92ZXJEZWxlZ2F0ZT86IElIb3ZlckRlbGVnYXRlO1xufVxuXG5leHBvcnQgY2xhc3MgQmFzZUFjdGlvblZpZXdJdGVtIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElBY3Rpb25WaWV3SXRlbSB7XG5cblx0ZWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0X2NvbnRleHQ6IHVua25vd247XG5cdHJlYWRvbmx5IF9hY3Rpb246IElBY3Rpb247XG5cblx0cHJpdmF0ZSBjdXN0b21Ib3Zlcj86IElNYW5hZ2VkSG92ZXI7XG5cblx0Z2V0IGFjdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWN0aW9uUnVubmVyOiBJQWN0aW9uUnVubmVyIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRleHQ6IHVua25vd24sIGFjdGlvbjogSUFjdGlvbiwgcHJvdGVjdGVkIG9wdGlvbnM6IElCYXNlQWN0aW9uVmlld0l0ZW1PcHRpb25zID0ge30pIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fY29udGV4dCA9IGNvbnRleHQgfHwgdGhpcztcblx0XHR0aGlzLl9hY3Rpb24gPSBhY3Rpb247XG5cblx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgQWN0aW9uKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhY3Rpb24ub25EaWRDaGFuZ2UoZXZlbnQgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuZWxlbWVudCkge1xuXHRcdFx0XHRcdC8vIHdlIGhhdmUgbm90IGJlZW4gcmVuZGVyZWQgeWV0LCBzbyB0aGVyZVxuXHRcdFx0XHRcdC8vIGlzIG5vIHBvaW50IGluIHVwZGF0aW5nIHRoZSBVSVxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuaGFuZGxlQWN0aW9uQ2hhbmdlRXZlbnQoZXZlbnQpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQWN0aW9uQ2hhbmdlRXZlbnQoZXZlbnQ6IElBY3Rpb25DaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdGlmIChldmVudC5lbmFibGVkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMudXBkYXRlRW5hYmxlZCgpO1xuXHRcdH1cblxuXHRcdGlmIChldmVudC5jaGVja2VkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMudXBkYXRlQ2hlY2tlZCgpO1xuXHRcdH1cblxuXHRcdGlmIChldmVudC5jbGFzcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUNsYXNzKCk7XG5cdFx0fVxuXG5cdFx0aWYgKGV2ZW50LmxhYmVsICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMudXBkYXRlTGFiZWwoKTtcblx0XHRcdHRoaXMudXBkYXRlVG9vbHRpcCgpO1xuXHRcdH1cblxuXHRcdGlmIChldmVudC50b29sdGlwICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMudXBkYXRlVG9vbHRpcCgpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBhY3Rpb25SdW5uZXIoKTogSUFjdGlvblJ1bm5lciB7XG5cdFx0aWYgKCF0aGlzLl9hY3Rpb25SdW5uZXIpIHtcblx0XHRcdHRoaXMuX2FjdGlvblJ1bm5lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25SdW5uZXIoKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2FjdGlvblJ1bm5lcjtcblx0fVxuXG5cdHNldCBhY3Rpb25SdW5uZXIoYWN0aW9uUnVubmVyOiBJQWN0aW9uUnVubmVyKSB7XG5cdFx0dGhpcy5fYWN0aW9uUnVubmVyID0gYWN0aW9uUnVubmVyO1xuXHR9XG5cblx0aXNFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9hY3Rpb24uZW5hYmxlZDtcblx0fVxuXG5cdHNldEFjdGlvbkNvbnRleHQobmV3Q29udGV4dDogdW5rbm93bik6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRleHQgPSBuZXdDb250ZXh0O1xuXHR9XG5cblx0cmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50ID0gY29udGFpbmVyO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEdlc3R1cmUuYWRkVGFyZ2V0KGNvbnRhaW5lcikpO1xuXG5cdFx0Y29uc3QgZW5hYmxlRHJhZ2dpbmcgPSB0aGlzLm9wdGlvbnMgJiYgdGhpcy5vcHRpb25zLmRyYWdnYWJsZTtcblx0XHRpZiAoZW5hYmxlRHJhZ2dpbmcpIHtcblx0XHRcdGNvbnRhaW5lci5kcmFnZ2FibGUgPSB0cnVlO1xuXG5cdFx0XHRpZiAoaXNGaXJlZm94KSB7XG5cdFx0XHRcdC8vIEZpcmVmb3g6IHJlcXVpcmVzIHRvIHNldCBhIHRleHQgZGF0YSB0cmFuc2ZlciB0byBnZXQgZ29pbmdcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNvbnRhaW5lciwgRXZlbnRUeXBlLkRSQUdfU1RBUlQsIGUgPT4gZS5kYXRhVHJhbnNmZXI/LnNldERhdGEoRGF0YVRyYW5zZmVycy5URVhULCB0aGlzLl9hY3Rpb24ubGFiZWwpKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIFRvdWNoRXZlbnRUeXBlLlRhcCwgZSA9PiB0aGlzLm9uQ2xpY2soZSwgdHJ1ZSkpKTsgLy8gUHJlc2VydmUgZm9jdXMgb24gdGFwICMxMjU0NzBcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50LCBFdmVudFR5cGUuTU9VU0VfRE9XTiwgZSA9PiB7XG5cdFx0XHRpZiAoIWVuYWJsZURyYWdnaW5nKSB7XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7IC8vIGRvIG5vdCBydW4gd2hlbiBkcmFnZ2luZyBpcyBvbiBiZWNhdXNlIHRoYXQgd291bGQgZGlzYWJsZSBpdFxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fYWN0aW9uLmVuYWJsZWQgJiYgZS5idXR0b24gPT09IDApIHtcblx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRpZiAocGxhdGZvcm0uaXNNYWNpbnRvc2gpIHtcblx0XHRcdC8vIG1hY09TOiBhbGxvdyB0byB0cmlnZ2VyIHRoZSBidXR0b24gd2hlbiBob2xkaW5nIEN0cmwra2V5IGFuZCBwcmVzc2luZyB0aGVcblx0XHRcdC8vIG1haW4gbW91c2UgYnV0dG9uLiBUaGlzIGlzIGZvciBzY2VuYXJpb3Mgd2hlcmUgZS5nLiBzb21lIGludGVyYWN0aW9uIGZvcmNlc1xuXHRcdFx0Ly8gdGhlIEN0cmwra2V5IHRvIGJlIHByZXNzZWQgYW5kIGhvbGQgYnV0IHRoZSB1c2VyIHN0aWxsIHdhbnRzIHRvIGludGVyYWN0XG5cdFx0XHQvLyB3aXRoIHRoZSBhY3Rpb25zIChmb3IgZXhhbXBsZSBxdWljayBhY2Nlc3MgaW4gcXVpY2sgbmF2aWdhdGlvbiBtb2RlKS5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50LCBFdmVudFR5cGUuQ09OVEVYVF9NRU5VLCBlID0+IHtcblx0XHRcdFx0aWYgKGUuYnV0dG9uID09PSAwICYmIGUuY3RybEtleSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRcdHRoaXMub25DbGljayhlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50LCBFdmVudFR5cGUuQ0xJQ0ssIGUgPT4ge1xuXHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblxuXHRcdFx0Ly8gbWVudXMgZG8gbm90IHVzZSB0aGUgY2xpY2sgZXZlbnRcblx0XHRcdGlmICghKHRoaXMub3B0aW9ucyAmJiB0aGlzLm9wdGlvbnMuaXNNZW51KSkge1xuXHRcdFx0XHR0aGlzLm9uQ2xpY2soZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIEV2ZW50VHlwZS5EQkxDTElDSywgZSA9PiB7XG5cdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdH0pKTtcblxuXHRcdFtFdmVudFR5cGUuTU9VU0VfVVAsIEV2ZW50VHlwZS5NT1VTRV9PVVRdLmZvckVhY2goZXZlbnQgPT4ge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIGV2ZW50LCBlID0+IHtcblx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlKTtcblx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKTtcblx0XHRcdH0pKTtcblx0XHR9KTtcblx0fVxuXG5cdG9uQ2xpY2soZXZlbnQ6IEV2ZW50TGlrZSwgcHJlc2VydmVGb2N1cyA9IGZhbHNlKTogdm9pZCB7XG5cdFx0RXZlbnRIZWxwZXIuc3RvcChldmVudCwgdHJ1ZSk7XG5cblx0XHRjb25zdCBjb250ZXh0ID0gdHlwZXMuaXNVbmRlZmluZWRPck51bGwodGhpcy5fY29udGV4dCkgPyB0aGlzLm9wdGlvbnM/LnVzZUV2ZW50QXNDb250ZXh0ID8gZXZlbnQgOiB7IHByZXNlcnZlRm9jdXMgfSA6IHRoaXMuX2NvbnRleHQ7XG5cdFx0dGhpcy5hY3Rpb25SdW5uZXIucnVuKHRoaXMuX2FjdGlvbiwgY29udGV4dCk7XG5cdH1cblxuXHQvLyBPbmx5IHNldCB0aGUgdGFiSW5kZXggb24gdGhlIGVsZW1lbnQgb25jZSBpdCBpcyBhYm91dCB0byBnZXQgZm9jdXNlZFxuXHQvLyBUaGF0IHdheSB0aGlzIGVsZW1lbnQgd29udCBiZSBhIHRhYiBzdG9wIHdoZW4gaXQgaXMgbm90IG5lZWRlZCAjMTA2NDQxXG5cdGZvY3VzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHRoaXMuZWxlbWVudC50YWJJbmRleCA9IDA7XG5cdFx0XHR0aGlzLmVsZW1lbnQuZm9jdXMoKTtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdmb2N1c2VkJyk7XG5cdFx0fVxuXHR9XG5cblx0aXNGb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuZWxlbWVudD8uY2xhc3NMaXN0LmNvbnRhaW5zKCdmb2N1c2VkJyk7XG5cdH1cblxuXHRibHVyKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5ibHVyKCk7XG5cdFx0XHR0aGlzLmVsZW1lbnQudGFiSW5kZXggPSAtMTtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdmb2N1c2VkJyk7XG5cdFx0fVxuXHR9XG5cblx0c2V0Rm9jdXNhYmxlKGZvY3VzYWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHRoaXMuZWxlbWVudC50YWJJbmRleCA9IGZvY3VzYWJsZSA/IDAgOiAtMTtcblx0XHR9XG5cdH1cblxuXHRnZXQgdHJhcHNBcnJvd05hdmlnYXRpb24oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIHVwZGF0ZUVuYWJsZWQoKTogdm9pZCB7XG5cdFx0Ly8gaW1wbGVtZW50IGluIHN1YmNsYXNzXG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlTGFiZWwoKTogdm9pZCB7XG5cdFx0Ly8gaW1wbGVtZW50IGluIHN1YmNsYXNzXG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0Q2xhc3MoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5hY3Rpb24uY2xhc3M7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0VG9vbHRpcCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmFjdGlvbi50b29sdGlwO1xuXHR9XG5cblx0cHJvdGVjdGVkIHVwZGF0ZVRvb2x0aXAoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgdGl0bGUgPSB0aGlzLmdldFRvb2x0aXAoKSA/PyAnJztcblx0XHR0aGlzLnVwZGF0ZUFyaWFMYWJlbCgpO1xuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5ob3ZlckRlbGVnYXRlPy5zaG93TmF0aXZlSG92ZXIpIHtcblx0XHRcdC8qIFdoaWxlIGN1c3RvbSBob3ZlciBpcyBub3QgaW5zaWRlIGN1c3RvbSBob3ZlciAqL1xuXHRcdFx0dGhpcy5lbGVtZW50LnRpdGxlID0gdGl0bGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICghdGhpcy5jdXN0b21Ib3ZlciAmJiB0aXRsZSAhPT0gJycpIHtcblx0XHRcdFx0Y29uc3QgaG92ZXJEZWxlZ2F0ZSA9IHRoaXMub3B0aW9ucy5ob3ZlckRlbGVnYXRlID8/IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdlbGVtZW50Jyk7XG5cdFx0XHRcdHRoaXMuY3VzdG9tSG92ZXIgPSB0aGlzLl9zdG9yZS5hZGQoZ2V0QmFzZUxheWVySG92ZXJEZWxlZ2F0ZSgpLnNldHVwTWFuYWdlZEhvdmVyKGhvdmVyRGVsZWdhdGUsIHRoaXMuZWxlbWVudCwgdGl0bGUpKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5jdXN0b21Ib3Zlcikge1xuXHRcdFx0XHR0aGlzLmN1c3RvbUhvdmVyLnVwZGF0ZSh0aXRsZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIHVwZGF0ZUFyaWFMYWJlbCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5lbGVtZW50KSB7XG5cdFx0XHRjb25zdCB0aXRsZSA9IHRoaXMuZ2V0VG9vbHRpcCgpID8/ICcnO1xuXHRcdFx0dGhpcy5lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRpdGxlKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlQ2xhc3MoKTogdm9pZCB7XG5cdFx0Ly8gaW1wbGVtZW50IGluIHN1YmNsYXNzXG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlQ2hlY2tlZCgpOiB2b2lkIHtcblx0XHQvLyBpbXBsZW1lbnQgaW4gc3ViY2xhc3Ncblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZWxlbWVudCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnJlbW92ZSgpO1xuXHRcdFx0dGhpcy5lbGVtZW50ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl9jb250ZXh0ID0gdW5kZWZpbmVkO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBY3Rpb25WaWV3SXRlbU9wdGlvbnMgZXh0ZW5kcyBJQmFzZUFjdGlvblZpZXdJdGVtT3B0aW9ucyB7XG5cdGljb24/OiBib29sZWFuO1xuXHRsYWJlbD86IGJvb2xlYW47XG5cdGtleWJpbmRpbmc/OiBzdHJpbmcgfCBudWxsO1xuXHRrZXliaW5kaW5nTm90UmVuZGVyZWRXaXRoTGFiZWw/OiBib29sZWFuO1xuXHR0b2dnbGVTdHlsZXM/OiBJVG9nZ2xlU3R5bGVzO1xufVxuXG5leHBvcnQgY2xhc3MgQWN0aW9uVmlld0l0ZW0gZXh0ZW5kcyBCYXNlQWN0aW9uVmlld0l0ZW0ge1xuXG5cdHByb3RlY3RlZCBsYWJlbDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByb3RlY3RlZCBvdmVycmlkZSBvcHRpb25zOiBJQWN0aW9uVmlld0l0ZW1PcHRpb25zO1xuXG5cdHByaXZhdGUgY3NzQ2xhc3M/OiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IoY29udGV4dDogdW5rbm93biwgYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zOiBJQWN0aW9uVmlld0l0ZW1PcHRpb25zKSB7XG5cdFx0c3VwZXIoY29udGV4dCwgYWN0aW9uLCBvcHRpb25zKTtcblxuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0dGhpcy5vcHRpb25zLmljb24gPSBvcHRpb25zLmljb24gIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuaWNvbiA6IGZhbHNlO1xuXHRcdHRoaXMub3B0aW9ucy5sYWJlbCA9IG9wdGlvbnMubGFiZWwgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubGFiZWwgOiB0cnVlO1xuXHRcdHRoaXMuY3NzQ2xhc3MgPSAnJztcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cdFx0dHlwZXMuYXNzZXJ0VHlwZSh0aGlzLmVsZW1lbnQpO1xuXG5cdFx0Y29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG5cdFx0bGFiZWwuY2xhc3NMaXN0LmFkZCgnYWN0aW9uLWxhYmVsJyk7XG5cdFx0bGFiZWwuc2V0QXR0cmlidXRlKCdyb2xlJywgdGhpcy5nZXREZWZhdWx0QXJpYVJvbGUoKSk7XG5cblx0XHR0aGlzLmxhYmVsID0gbGFiZWw7XG5cdFx0dGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKGxhYmVsKTtcblxuXHRcdGlmICh0aGlzLm9wdGlvbnMubGFiZWwgJiYgdGhpcy5vcHRpb25zLmtleWJpbmRpbmcgJiYgIXRoaXMub3B0aW9ucy5rZXliaW5kaW5nTm90UmVuZGVyZWRXaXRoTGFiZWwpIHtcblx0XHRcdGNvbnN0IGtiTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0XHRrYkxhYmVsLmNsYXNzTGlzdC5hZGQoJ2tleWJpbmRpbmcnKTtcblx0XHRcdGtiTGFiZWwudGV4dENvbnRlbnQgPSB0aGlzLm9wdGlvbnMua2V5YmluZGluZztcblx0XHRcdHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChrYkxhYmVsKTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZUNsYXNzKCk7XG5cdFx0dGhpcy51cGRhdGVMYWJlbCgpO1xuXHRcdHRoaXMudXBkYXRlVG9vbHRpcCgpO1xuXHRcdHRoaXMudXBkYXRlRW5hYmxlZCgpO1xuXHRcdHRoaXMudXBkYXRlQ2hlY2tlZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREZWZhdWx0QXJpYVJvbGUoKTogJ3ByZXNlbnRhdGlvbicgfCAnbWVudWl0ZW0nIHwgJ3RhYicgfCAnYnV0dG9uJyB7XG5cdFx0aWYgKHRoaXMuX2FjdGlvbi5pZCA9PT0gU2VwYXJhdG9yLklEKSB7XG5cdFx0XHRyZXR1cm4gJ3ByZXNlbnRhdGlvbic7IC8vIEEgc2VwYXJhdG9yIGlzIGEgcHJlc2VudGF0aW9uIGl0ZW1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5pc01lbnUpIHtcblx0XHRcdFx0cmV0dXJuICdtZW51aXRlbSc7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5pc1RhYkxpc3QpIHtcblx0XHRcdFx0cmV0dXJuICd0YWInO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuICdidXR0b24nO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIE9ubHkgc2V0IHRoZSB0YWJJbmRleCBvbiB0aGUgZWxlbWVudCBvbmNlIGl0IGlzIGFib3V0IHRvIGdldCBmb2N1c2VkXG5cdC8vIFRoYXQgd2F5IHRoaXMgZWxlbWVudCB3b250IGJlIGEgdGFiIHN0b3Agd2hlbiBpdCBpcyBub3QgbmVlZGVkICMxMDY0NDFcblx0b3ZlcnJpZGUgZm9jdXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubGFiZWwpIHtcblx0XHRcdHRoaXMubGFiZWwudGFiSW5kZXggPSAwO1xuXHRcdFx0dGhpcy5sYWJlbC5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGlzRm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLmxhYmVsICYmIHRoaXMubGFiZWw/LnRhYkluZGV4ID09PSAwO1xuXHR9XG5cblx0b3ZlcnJpZGUgYmx1cigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5sYWJlbCkge1xuXHRcdFx0dGhpcy5sYWJlbC50YWJJbmRleCA9IC0xO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIHNldEZvY3VzYWJsZShmb2N1c2FibGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5sYWJlbCkge1xuXHRcdFx0dGhpcy5sYWJlbC50YWJJbmRleCA9IGZvY3VzYWJsZSA/IDAgOiAtMTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlTGFiZWwoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5sYWJlbCAmJiB0aGlzLmxhYmVsKSB7XG5cdFx0XHR0aGlzLmxhYmVsLnRleHRDb250ZW50ID0gdGhpcy5hY3Rpb24ubGFiZWw7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldFRvb2x0aXAoKSB7XG5cdFx0bGV0IHRpdGxlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuXHRcdGlmICh0aGlzLmFjdGlvbi50b29sdGlwKSB7XG5cdFx0XHR0aXRsZSA9IHRoaXMuYWN0aW9uLnRvb2x0aXA7XG5cblx0XHR9IGVsc2UgaWYgKHRoaXMuYWN0aW9uLmxhYmVsKSB7XG5cdFx0XHR0aXRsZSA9IHRoaXMuYWN0aW9uLmxhYmVsO1xuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5rZXliaW5kaW5nKSB7XG5cdFx0XHRcdHRpdGxlID0gbmxzLmxvY2FsaXplKHsga2V5OiAndGl0bGVMYWJlbCcsIGNvbW1lbnQ6IFsnYWN0aW9uIHRpdGxlJywgJ2FjdGlvbiBrZXliaW5kaW5nJ10gfSwgXCJ7MH0gKHsxfSlcIiwgdGl0bGUsIHRoaXMub3B0aW9ucy5rZXliaW5kaW5nKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRpdGxlID8/IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVDbGFzcygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jc3NDbGFzcyAmJiB0aGlzLmxhYmVsKSB7XG5cdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoLi4udGhpcy5jc3NDbGFzcy5zcGxpdCgnICcpKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5pY29uKSB7XG5cdFx0XHR0aGlzLmNzc0NsYXNzID0gdGhpcy5nZXRDbGFzcygpO1xuXG5cdFx0XHRpZiAodGhpcy5sYWJlbCkge1xuXHRcdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5hZGQoJ2NvZGljb24nKTtcblx0XHRcdFx0aWYgKHRoaXMuY3NzQ2xhc3MpIHtcblx0XHRcdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5hZGQoLi4udGhpcy5jc3NDbGFzcy5zcGxpdCgnICcpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnVwZGF0ZUVuYWJsZWQoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sYWJlbD8uY2xhc3NMaXN0LnJlbW92ZSgnY29kaWNvbicpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVFbmFibGVkKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmFjdGlvbi5lbmFibGVkKSB7XG5cdFx0XHRpZiAodGhpcy5sYWJlbCkge1xuXHRcdFx0XHR0aGlzLmxhYmVsLnJlbW92ZUF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpO1xuXHRcdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoJ2Rpc2FibGVkJyk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuZWxlbWVudD8uY2xhc3NMaXN0LnJlbW92ZSgnZGlzYWJsZWQnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMubGFiZWwpIHtcblx0XHRcdFx0dGhpcy5sYWJlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScpO1xuXHRcdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5hZGQoJ2Rpc2FibGVkJyk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuZWxlbWVudD8uY2xhc3NMaXN0LmFkZCgnZGlzYWJsZWQnKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlQXJpYUxhYmVsKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmxhYmVsKSB7XG5cdFx0XHRjb25zdCB0aXRsZSA9IHRoaXMuZ2V0VG9vbHRpcCgpID8/ICcnO1xuXHRcdFx0dGhpcy5sYWJlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCB0aXRsZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUNoZWNrZWQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubGFiZWwpIHtcblx0XHRcdGlmICh0aGlzLmFjdGlvbi5jaGVja2VkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5sYWJlbC5jbGFzc0xpc3QudG9nZ2xlKCdjaGVja2VkJywgdGhpcy5hY3Rpb24uY2hlY2tlZCk7XG5cdFx0XHRcdGlmICh0aGlzLm9wdGlvbnMuaXNUYWJMaXN0KSB7XG5cdFx0XHRcdFx0dGhpcy5sYWJlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnLCB0aGlzLmFjdGlvbi5jaGVja2VkID8gJ3RydWUnIDogJ2ZhbHNlJyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5sYWJlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcsIHRoaXMuYWN0aW9uLmNoZWNrZWQgPyAndHJ1ZScgOiAnZmFsc2UnKTtcblx0XHRcdFx0XHR0aGlzLmxhYmVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdjaGVja2JveCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoJ2NoZWNrZWQnKTtcblx0XHRcdFx0dGhpcy5sYWJlbC5yZW1vdmVBdHRyaWJ1dGUodGhpcy5vcHRpb25zLmlzVGFiTGlzdCA/ICdhcmlhLXNlbGVjdGVkJyA6ICdhcmlhLWNoZWNrZWQnKTtcblx0XHRcdFx0dGhpcy5sYWJlbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCB0aGlzLmdldERlZmF1bHRBcmlhUm9sZSgpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNlbGVjdEFjdGlvblZpZXdJdGVtPFQgPSBzdHJpbmc+IGV4dGVuZHMgQmFzZUFjdGlvblZpZXdJdGVtIHtcblx0cHJvdGVjdGVkIHNlbGVjdEJveDogU2VsZWN0Qm94O1xuXG5cdGNvbnN0cnVjdG9yKGN0eDogdW5rbm93biwgYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zOiBJU2VsZWN0T3B0aW9uSXRlbVtdLCBzZWxlY3RlZDogbnVtYmVyLCBjb250ZXh0Vmlld1Byb3ZpZGVyOiBJQ29udGV4dFZpZXdQcm92aWRlciwgc3R5bGVzOiBJU2VsZWN0Qm94U3R5bGVzLCBzZWxlY3RCb3hPcHRpb25zPzogSVNlbGVjdEJveE9wdGlvbnMpIHtcblx0XHRzdXBlcihjdHgsIGFjdGlvbik7XG5cblx0XHR0aGlzLnNlbGVjdEJveCA9IG5ldyBTZWxlY3RCb3gob3B0aW9ucywgc2VsZWN0ZWQsIGNvbnRleHRWaWV3UHJvdmlkZXIsIHN0eWxlcywgc2VsZWN0Qm94T3B0aW9ucyk7XG5cdFx0dGhpcy5zZWxlY3RCb3guc2V0Rm9jdXNhYmxlKGZhbHNlKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VsZWN0Qm94KTtcblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRzZXRPcHRpb25zKG9wdGlvbnM6IElTZWxlY3RPcHRpb25JdGVtW10sIHNlbGVjdGVkPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5zZWxlY3RCb3guc2V0T3B0aW9ucyhvcHRpb25zLCBzZWxlY3RlZCk7XG5cdH1cblxuXHRzZWxlY3QoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuc2VsZWN0Qm94LnNlbGVjdChpbmRleCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VsZWN0Qm94Lm9uRGlkU2VsZWN0KGUgPT4gdGhpcy5ydW5BY3Rpb24oZS5zZWxlY3RlZCwgZS5pbmRleCkpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBydW5BY3Rpb24ob3B0aW9uOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLmFjdGlvblJ1bm5lci5ydW4odGhpcy5fYWN0aW9uLCB0aGlzLmdldEFjdGlvbkNvbnRleHQob3B0aW9uLCBpbmRleCkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEFjdGlvbkNvbnRleHQob3B0aW9uOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpOiBUIHwgc3RyaW5nIHtcblx0XHRyZXR1cm4gb3B0aW9uO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0Rm9jdXNhYmxlKGZvY3VzYWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuc2VsZWN0Qm94LnNldEZvY3VzYWJsZShmb2N1c2FibGUpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5zZWxlY3RCb3g/LmZvY3VzKCk7XG5cdH1cblxuXHRvdmVycmlkZSBibHVyKCk6IHZvaWQge1xuXHRcdHRoaXMuc2VsZWN0Qm94Py5ibHVyKCk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuc2VsZWN0Qm94LnJlbmRlcihjb250YWluZXIpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QixhQUF3QixpQkFBaUI7QUFDekUsU0FBUyxhQUFhLGdCQUFnQixlQUFlO0FBR3JELFNBQVMsK0JBQStCO0FBRXhDLFNBQWlFLGlCQUFpQjtBQUVsRixTQUFTLFFBQVEsY0FBMEQsaUJBQWlCO0FBQzVGLFNBQVMsa0JBQWtCO0FBQzNCLFlBQVksY0FBYztBQUMxQixZQUFZLFdBQVc7QUFDdkIsT0FBTztBQUNQLFlBQVksU0FBUztBQUVyQixTQUFTLGlDQUFpQztB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
