import * as DOM from "../../dom.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { ActionViewItem, BaseActionViewItem } from "./actionViewItems.js";
import { createInstantHoverDelegate } from "../hover/hoverDelegateFactory.js";
import { ActionRunner, Separator } from "../../../common/actions.js";
import { Emitter } from "../../../common/event.js";
import { KeyCode, KeyMod } from "../../../common/keyCodes.js";
import { Disposable, DisposableMap, DisposableStore, dispose } from "../../../common/lifecycle.js";
import * as types from "../../../common/types.js";
import "./actionbar.css";
var ActionsOrientation = /* @__PURE__ */ ((ActionsOrientation2) => {
  ActionsOrientation2[ActionsOrientation2["HORIZONTAL"] = 0] = "HORIZONTAL";
  ActionsOrientation2[ActionsOrientation2["VERTICAL"] = 1] = "VERTICAL";
  return ActionsOrientation2;
})(ActionsOrientation || {});
class ActionBar extends Disposable {
  constructor(container, options = {}) {
    super();
    this._actionRunnerDisposables = this._register(new DisposableStore());
    this.viewItemDisposables = this._register(new DisposableMap());
    // Trigger Key Tracking
    this.triggerKeyDown = false;
    this.focusable = true;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._onDidCancel = this._register(new Emitter({ onWillAddFirstListener: () => this.cancelHasListener = true }));
    this.onDidCancel = this._onDidCancel.event;
    this.cancelHasListener = false;
    this._onDidRun = this._register(new Emitter());
    this.onDidRun = this._onDidRun.event;
    this._onWillRun = this._register(new Emitter());
    this.onWillRun = this._onWillRun.event;
    this.options = options;
    this._context = options.context ?? null;
    this._orientation = this.options.orientation ?? 0 /* HORIZONTAL */;
    this._triggerKeys = {
      keyDown: this.options.triggerKeys?.keyDown ?? false,
      keys: this.options.triggerKeys?.keys ?? [KeyCode.Enter, KeyCode.Space]
    };
    this._hoverDelegate = options.hoverDelegate ?? this._register(createInstantHoverDelegate());
    if (this.options.actionRunner) {
      this._actionRunner = this.options.actionRunner;
    } else {
      this._actionRunner = new ActionRunner();
      this._actionRunnerDisposables.add(this._actionRunner);
    }
    this._actionRunnerDisposables.add(this._actionRunner.onDidRun((e) => this._onDidRun.fire(e)));
    this._actionRunnerDisposables.add(this._actionRunner.onWillRun((e) => this._onWillRun.fire(e)));
    this.viewItems = [];
    this.focusedItem = void 0;
    this.domNode = document.createElement("div");
    this.domNode.className = "monaco-action-bar";
    let previousKeys;
    let nextKeys;
    switch (this._orientation) {
      case 0 /* HORIZONTAL */:
        previousKeys = [KeyCode.LeftArrow];
        nextKeys = [KeyCode.RightArrow];
        break;
      case 1 /* VERTICAL */:
        previousKeys = [KeyCode.UpArrow];
        nextKeys = [KeyCode.DownArrow];
        this.domNode.className += " vertical";
        break;
    }
    this._register(DOM.addDisposableListener(this.domNode, DOM.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      let eventHandled = true;
      const focusedItem = typeof this.focusedItem === "number" ? this.viewItems[this.focusedItem] : void 0;
      if (previousKeys && (event.equals(previousKeys[0]) || event.equals(previousKeys[1]))) {
        eventHandled = this.focusPrevious();
      } else if (nextKeys && (event.equals(nextKeys[0]) || event.equals(nextKeys[1]))) {
        eventHandled = this.focusNext();
      } else if (event.equals(KeyCode.Escape) && this.cancelHasListener) {
        this._onDidCancel.fire();
      } else if (event.equals(KeyCode.Home)) {
        eventHandled = this.focusFirst();
      } else if (event.equals(KeyCode.End)) {
        eventHandled = this.focusLast();
      } else if (event.equals(KeyCode.Tab) && focusedItem instanceof BaseActionViewItem && focusedItem.trapsArrowNavigation) {
        eventHandled = this.focusNext(void 0, true);
      } else if (this.isTriggerKeyEvent(event)) {
        if (this._triggerKeys.keyDown) {
          this.doTrigger(event);
        } else {
          this.triggerKeyDown = true;
        }
      } else {
        eventHandled = false;
      }
      if (eventHandled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }));
    this._register(DOM.addDisposableListener(this.domNode, DOM.EventType.KEY_UP, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (this.isTriggerKeyEvent(event)) {
        if (!this._triggerKeys.keyDown && this.triggerKeyDown) {
          this.triggerKeyDown = false;
          this.doTrigger(event);
        }
        event.preventDefault();
        event.stopPropagation();
      } else if (event.equals(KeyCode.Tab) || event.equals(KeyMod.Shift | KeyCode.Tab) || event.equals(KeyCode.UpArrow) || event.equals(KeyCode.DownArrow) || event.equals(KeyCode.LeftArrow) || event.equals(KeyCode.RightArrow)) {
        this.updateFocusedItem();
      }
    }));
    this.focusTracker = this._register(DOM.trackFocus(this.domNode));
    this._register(this.focusTracker.onDidBlur(() => {
      if (DOM.getActiveElement() === this.domNode || !DOM.isAncestor(DOM.getActiveElement(), this.domNode)) {
        this._onDidBlur.fire();
        this.previouslyFocusedItem = this.focusedItem;
        this.focusedItem = void 0;
        this.triggerKeyDown = false;
      }
    }));
    this._register(this.focusTracker.onDidFocus(() => this.updateFocusedItem()));
    this.actionsList = document.createElement("ul");
    this.actionsList.className = "actions-container";
    if (this.options.highlightToggledItems) {
      this.actionsList.classList.add("highlight-toggled");
    }
    this.actionsList.setAttribute("role", this.options.ariaRole || "toolbar");
    if (this.options.ariaLabel) {
      this.actionsList.setAttribute("aria-label", this.options.ariaLabel);
    }
    this.domNode.appendChild(this.actionsList);
    container.appendChild(this.domNode);
  }
  refreshRole() {
    if (this.length() >= 1) {
      this.actionsList.setAttribute("role", this.options.ariaRole || "toolbar");
    } else {
      this.actionsList.setAttribute("role", "presentation");
    }
  }
  setAriaLabel(label) {
    if (label) {
      this.actionsList.setAttribute("aria-label", label);
    } else {
      this.actionsList.removeAttribute("aria-label");
    }
  }
  // Some action bars should not be focusable at times
  // When an action bar is not focusable make sure to make all the elements inside it not focusable
  // When an action bar is focusable again, make sure the first item can be focused
  setFocusable(focusable) {
    this.focusable = focusable;
    if (this.focusable) {
      const firstEnabled = this.viewItems.find((vi) => vi instanceof BaseActionViewItem && vi.isEnabled());
      if (firstEnabled instanceof BaseActionViewItem) {
        firstEnabled.setFocusable(true);
      }
    } else {
      this.viewItems.forEach((vi) => {
        if (vi instanceof BaseActionViewItem) {
          vi.setFocusable(false);
        }
      });
    }
  }
  isTriggerKeyEvent(event) {
    let ret = false;
    this._triggerKeys.keys.forEach((keyCode) => {
      ret = ret || event.equals(keyCode);
    });
    return ret;
  }
  updateFocusedItem() {
    for (let i = 0; i < this.actionsList.children.length; i++) {
      const elem = this.actionsList.children[i];
      if (DOM.isAncestor(DOM.getActiveElement(), elem)) {
        this.focusedItem = i;
        this.viewItems[this.focusedItem]?.showHover?.();
        break;
      }
    }
  }
  get context() {
    return this._context;
  }
  set context(context) {
    this._context = context;
    this.viewItems.forEach((i) => i.setActionContext(context));
  }
  get actionRunner() {
    return this._actionRunner;
  }
  set actionRunner(actionRunner) {
    this._actionRunner = actionRunner;
    this._actionRunnerDisposables.clear();
    this._actionRunnerDisposables.add(this._actionRunner.onDidRun((e) => this._onDidRun.fire(e)));
    this._actionRunnerDisposables.add(this._actionRunner.onWillRun((e) => this._onWillRun.fire(e)));
    this.viewItems.forEach((item) => item.actionRunner = actionRunner);
  }
  getContainer() {
    return this.domNode;
  }
  hasAction(action) {
    return this.viewItems.findIndex((candidate) => candidate.action.id === action.id) !== -1;
  }
  getAction(indexOrElement) {
    if (typeof indexOrElement === "number") {
      return this.viewItems[indexOrElement]?.action;
    }
    if (DOM.isHTMLElement(indexOrElement)) {
      while (indexOrElement.parentElement !== this.actionsList) {
        if (!indexOrElement.parentElement) {
          return void 0;
        }
        indexOrElement = indexOrElement.parentElement;
      }
      for (let i = 0; i < this.actionsList.childNodes.length; i++) {
        if (this.actionsList.childNodes[i] === indexOrElement) {
          return this.viewItems[i].action;
        }
      }
    }
    return void 0;
  }
  push(arg, options = {}) {
    const actions = Array.isArray(arg) ? arg : [arg];
    let index = types.isNumber(options.index) ? options.index : null;
    actions.forEach((action) => {
      const actionViewItemElement = document.createElement("li");
      actionViewItemElement.className = "action-item";
      actionViewItemElement.setAttribute("role", "presentation");
      let item;
      const viewItemOptions = { hoverDelegate: this._hoverDelegate, ...options, isTabList: this.options.ariaRole === "tablist" };
      if (this.options.actionViewItemProvider) {
        item = this.options.actionViewItemProvider(action, viewItemOptions);
      }
      if (!item) {
        item = new ActionViewItem(this.context, action, viewItemOptions);
      }
      if (!this.options.allowContextMenu) {
        this.viewItemDisposables.set(item, DOM.addDisposableListener(actionViewItemElement, DOM.EventType.CONTEXT_MENU, (e) => {
          DOM.EventHelper.stop(e, true);
        }));
      }
      item.actionRunner = this._actionRunner;
      item.setActionContext(this.context);
      item.render(actionViewItemElement);
      if (this.focusable && item instanceof BaseActionViewItem && this.viewItems.length === 0) {
        item.setFocusable(true);
      }
      if (index === null || index < 0 || index >= this.actionsList.children.length) {
        this.actionsList.appendChild(actionViewItemElement);
        this.viewItems.push(item);
      } else {
        this.actionsList.insertBefore(actionViewItemElement, this.actionsList.children[index]);
        this.viewItems.splice(index, 0, item);
        index++;
      }
    });
    if (typeof this.focusedItem === "number") {
      this.focus(this.focusedItem);
    }
    this.refreshRole();
  }
  getWidth(index) {
    if (index >= 0 && index < this.actionsList.children.length) {
      const item = this.actionsList.children.item(index);
      if (item) {
        return item.clientWidth;
      }
    }
    return 0;
  }
  getHeight(index) {
    if (index >= 0 && index < this.actionsList.children.length) {
      const item = this.actionsList.children.item(index);
      if (item) {
        return item.clientHeight;
      }
    }
    return 0;
  }
  pull(index) {
    if (index >= 0 && index < this.viewItems.length) {
      this.actionsList.childNodes[index].remove();
      this.viewItemDisposables.deleteAndDispose(this.viewItems[index]);
      dispose(this.viewItems.splice(index, 1));
      this.refreshRole();
    }
  }
  clear() {
    if (this.isEmpty()) {
      return;
    }
    this.viewItems = dispose(this.viewItems);
    this.viewItemDisposables.clearAndDisposeAll();
    DOM.clearNode(this.actionsList);
    this.refreshRole();
  }
  length() {
    return this.viewItems.length;
  }
  isEmpty() {
    return this.viewItems.length === 0;
  }
  focus(arg) {
    let selectFirst = false;
    let index = void 0;
    if (arg === void 0) {
      selectFirst = true;
    } else if (typeof arg === "number") {
      index = arg;
    } else if (typeof arg === "boolean") {
      selectFirst = arg;
    }
    if (selectFirst && typeof this.focusedItem === "undefined") {
      const firstEnabled = this.viewItems.findIndex((item) => item.isEnabled());
      this.focusedItem = firstEnabled === -1 ? void 0 : firstEnabled;
      this.updateFocus(void 0, void 0, true);
    } else {
      if (index !== void 0) {
        this.focusedItem = index;
      }
      this.updateFocus(void 0, void 0, true);
    }
  }
  focusFirst() {
    this.focusedItem = this.length() - 1;
    return this.focusNext(true);
  }
  focusLast() {
    this.focusedItem = 0;
    return this.focusPrevious(true);
  }
  focusNext(forceLoop, forceFocus) {
    if (typeof this.focusedItem === "undefined") {
      this.focusedItem = this.viewItems.length - 1;
    } else if (this.viewItems.length <= 1) {
      return false;
    }
    const startIndex = this.focusedItem;
    let item;
    do {
      if (!forceLoop && this.options.preventLoopNavigation && this.focusedItem + 1 >= this.viewItems.length) {
        this.focusedItem = startIndex;
        return false;
      }
      this.focusedItem = (this.focusedItem + 1) % this.viewItems.length;
      item = this.viewItems[this.focusedItem];
    } while (this.focusedItem !== startIndex && (this.options.focusOnlyEnabledItems && !item.isEnabled() || item.action.id === Separator.ID));
    this.updateFocus(void 0, void 0, forceFocus);
    return true;
  }
  focusPrevious(forceLoop) {
    if (typeof this.focusedItem === "undefined") {
      this.focusedItem = 0;
    } else if (this.viewItems.length <= 1) {
      return false;
    }
    const startIndex = this.focusedItem;
    let item;
    do {
      this.focusedItem = this.focusedItem - 1;
      if (this.focusedItem < 0) {
        if (!forceLoop && this.options.preventLoopNavigation) {
          this.focusedItem = startIndex;
          return false;
        }
        this.focusedItem = this.viewItems.length - 1;
      }
      item = this.viewItems[this.focusedItem];
    } while (this.focusedItem !== startIndex && (this.options.focusOnlyEnabledItems && !item.isEnabled() || item.action.id === Separator.ID));
    this.updateFocus(true);
    return true;
  }
  updateFocus(fromRight, preventScroll, forceFocus = false) {
    if (typeof this.focusedItem === "undefined") {
      this.actionsList.focus({ preventScroll });
    }
    if (this.previouslyFocusedItem !== void 0 && this.previouslyFocusedItem !== this.focusedItem) {
      this.viewItems[this.previouslyFocusedItem]?.blur();
    }
    const actionViewItem = this.focusedItem !== void 0 ? this.viewItems[this.focusedItem] : void 0;
    if (actionViewItem) {
      let focusItem = true;
      if (!types.isFunction(actionViewItem.focus)) {
        focusItem = false;
      }
      if (this.options.focusOnlyEnabledItems && types.isFunction(actionViewItem.isEnabled) && !actionViewItem.isEnabled()) {
        focusItem = false;
      }
      if (actionViewItem.action.id === Separator.ID) {
        focusItem = false;
      }
      if (!focusItem) {
        this.actionsList.focus({ preventScroll });
        this.previouslyFocusedItem = void 0;
      } else if (forceFocus || this.previouslyFocusedItem !== this.focusedItem) {
        actionViewItem.focus(fromRight);
        this.previouslyFocusedItem = this.focusedItem;
      }
      if (focusItem) {
        actionViewItem.showHover?.();
      }
    }
  }
  doTrigger(event) {
    if (typeof this.focusedItem === "undefined") {
      return;
    }
    const actionViewItem = this.viewItems[this.focusedItem];
    if (actionViewItem instanceof BaseActionViewItem) {
      const context = actionViewItem._context === null || actionViewItem._context === void 0 ? event : actionViewItem._context;
      this.run(actionViewItem._action, context);
    }
  }
  async run(action, context) {
    await this._actionRunner.run(action, context);
  }
  dispose() {
    this._context = void 0;
    this.viewItems = dispose(this.viewItems);
    this.getContainer().remove();
    super.dispose();
  }
}
function prepareActions(actions) {
  if (!actions.length) {
    return actions;
  }
  let firstIndexOfAction = -1;
  for (let i = 0; i < actions.length; i++) {
    if (actions[i].id === Separator.ID) {
      continue;
    }
    firstIndexOfAction = i;
    break;
  }
  if (firstIndexOfAction === -1) {
    return [];
  }
  actions = actions.slice(firstIndexOfAction);
  for (let h = actions.length - 1; h >= 0; h--) {
    const isSeparator = actions[h].id === Separator.ID;
    if (isSeparator) {
      actions.splice(h, 1);
    } else {
      break;
    }
  }
  let foundAction = false;
  for (let k = actions.length - 1; k >= 0; k--) {
    const isSeparator = actions[k].id === Separator.ID;
    if (isSeparator && !foundAction) {
      actions.splice(k, 1);
    } else if (!isSeparator) {
      foundAction = true;
    } else if (isSeparator) {
      foundAction = false;
    }
  }
  return actions;
}
export {
  ActionBar,
  ActionsOrientation,
  prepareActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi9kb20uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4va2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25WaWV3SXRlbSwgQmFzZUFjdGlvblZpZXdJdGVtLCBJQWN0aW9uVmlld0l0ZW1PcHRpb25zIH0gZnJvbSAnLi9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgY3JlYXRlSW5zdGFudEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uL2hvdmVyL2hvdmVyRGVsZWdhdGUuanMnO1xuaW1wb3J0IHsgQWN0aW9uUnVubmVyLCBJQWN0aW9uLCBJQWN0aW9uUnVubmVyLCBJUnVuRXZlbnQsIFNlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHR5cGVzIGZyb20gJy4uLy4uLy4uL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgJy4vYWN0aW9uYmFyLmNzcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUFjdGlvblZpZXdJdGVtIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRhY3Rpb246IElBY3Rpb247XG5cdGFjdGlvblJ1bm5lcjogSUFjdGlvblJ1bm5lcjtcblx0c2V0QWN0aW9uQ29udGV4dChjb250ZXh0OiB1bmtub3duKTogdm9pZDtcblx0cmVuZGVyKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogdm9pZDtcblx0aXNFbmFibGVkKCk6IGJvb2xlYW47XG5cdGZvY3VzKGZyb21SaWdodD86IGJvb2xlYW4pOiB2b2lkOyAvLyBUT0RPQGlzaWRvcm4gd2hhdCBpcyB0aGlzP1xuXHRibHVyKCk6IHZvaWQ7XG5cdHNob3dIb3Zlcj8oKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQWN0aW9uVmlld0l0ZW1Qcm92aWRlciB7XG5cdChhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMpOiBJQWN0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEFjdGlvbnNPcmllbnRhdGlvbiB7XG5cdEhPUklaT05UQUwsXG5cdFZFUlRJQ0FMLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFjdGlvblRyaWdnZXIge1xuXHRrZXlzPzogS2V5Q29kZVtdO1xuXHRrZXlEb3duOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBY3Rpb25CYXJPcHRpb25zIHtcblx0cmVhZG9ubHkgb3JpZW50YXRpb24/OiBBY3Rpb25zT3JpZW50YXRpb247XG5cdHJlYWRvbmx5IGNvbnRleHQ/OiB1bmtub3duO1xuXHRyZWFkb25seSBhY3Rpb25WaWV3SXRlbVByb3ZpZGVyPzogSUFjdGlvblZpZXdJdGVtUHJvdmlkZXI7XG5cdHJlYWRvbmx5IGFjdGlvblJ1bm5lcj86IElBY3Rpb25SdW5uZXI7XG5cdHJlYWRvbmx5IGFyaWFMYWJlbD86IHN0cmluZztcblx0cmVhZG9ubHkgYXJpYVJvbGU/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHRyaWdnZXJLZXlzPzogQWN0aW9uVHJpZ2dlcjtcblx0cmVhZG9ubHkgYWxsb3dDb250ZXh0TWVudT86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHByZXZlbnRMb29wTmF2aWdhdGlvbj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGZvY3VzT25seUVuYWJsZWRJdGVtcz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGhvdmVyRGVsZWdhdGU/OiBJSG92ZXJEZWxlZ2F0ZTtcblx0LyoqXG5cdCAqIElmIHRydWUsIHRvZ2dsZWQgcHJpbWFyeSBpdGVtcyBhcmUgaGlnaGxpZ2h0ZWQgd2l0aCBhIGJhY2tncm91bmQgY29sb3IuXG5cdCAqIFNvbWUgYWN0aW9uIGJhcnMgZXhjbHVzaXZlbHkgdXNlIGljb24gc3RhdGVzLCB3ZSBkb24ndCB3YW50IHRvIGVuYWJsZSB0aGlzIGZvciB0aGVtLlxuXHQgKiBUaHVzLCB0aGlzIGlzIG9wdC1pbi5cblx0ICovXG5cdHJlYWRvbmx5IGhpZ2hsaWdodFRvZ2dsZWRJdGVtcz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUFjdGlvbk9wdGlvbnMgZXh0ZW5kcyBJQWN0aW9uVmlld0l0ZW1PcHRpb25zIHtcblx0aW5kZXg/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBBY3Rpb25CYXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUFjdGlvblJ1bm5lciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBJQWN0aW9uQmFyT3B0aW9ucztcblx0cHJpdmF0ZSByZWFkb25seSBfaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGU7XG5cblx0cHJpdmF0ZSBfYWN0aW9uUnVubmVyOiBJQWN0aW9uUnVubmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3Rpb25SdW5uZXJEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgX2NvbnRleHQ6IHVua25vd247XG5cdHByaXZhdGUgcmVhZG9ubHkgX29yaWVudGF0aW9uOiBBY3Rpb25zT3JpZW50YXRpb247XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RyaWdnZXJLZXlzOiB7XG5cdFx0a2V5czogS2V5Q29kZVtdO1xuXHRcdGtleURvd246IGJvb2xlYW47XG5cdH07XG5cblx0Ly8gVmlldyBJdGVtc1xuXHR2aWV3SXRlbXM6IElBY3Rpb25WaWV3SXRlbVtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdJdGVtRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcDxJQWN0aW9uVmlld0l0ZW0+KCkpO1xuXHRwcml2YXRlIHByZXZpb3VzbHlGb2N1c2VkSXRlbT86IG51bWJlcjtcblx0cHJvdGVjdGVkIGZvY3VzZWRJdGVtPzogbnVtYmVyO1xuXHRwcml2YXRlIGZvY3VzVHJhY2tlcjogRE9NLklGb2N1c1RyYWNrZXI7XG5cblx0Ly8gVHJpZ2dlciBLZXkgVHJhY2tpbmdcblx0cHJpdmF0ZSB0cmlnZ2VyS2V5RG93bjogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHByaXZhdGUgZm9jdXNhYmxlOiBib29sZWFuID0gdHJ1ZTtcblxuXHQvLyBFbGVtZW50c1xuXHRkb21Ob2RlOiBIVE1MRWxlbWVudDtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IGFjdGlvbnNMaXN0OiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEJsdXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRCbHVyID0gdGhpcy5fb25EaWRCbHVyLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2FuY2VsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oeyBvbldpbGxBZGRGaXJzdExpc3RlbmVyOiAoKSA9PiB0aGlzLmNhbmNlbEhhc0xpc3RlbmVyID0gdHJ1ZSB9KSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2FuY2VsID0gdGhpcy5fb25EaWRDYW5jZWwuZXZlbnQ7XG5cdHByaXZhdGUgY2FuY2VsSGFzTGlzdGVuZXIgPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJ1biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElSdW5FdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUnVuID0gdGhpcy5fb25EaWRSdW4uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsUnVuID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVJ1bkV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25XaWxsUnVuID0gdGhpcy5fb25XaWxsUnVuLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG9wdGlvbnM6IElBY3Rpb25CYXJPcHRpb25zID0ge30pIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLl9jb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0ID8/IG51bGw7XG5cdFx0dGhpcy5fb3JpZW50YXRpb24gPSB0aGlzLm9wdGlvbnMub3JpZW50YXRpb24gPz8gQWN0aW9uc09yaWVudGF0aW9uLkhPUklaT05UQUw7XG5cdFx0dGhpcy5fdHJpZ2dlcktleXMgPSB7XG5cdFx0XHRrZXlEb3duOiB0aGlzLm9wdGlvbnMudHJpZ2dlcktleXM/LmtleURvd24gPz8gZmFsc2UsXG5cdFx0XHRrZXlzOiB0aGlzLm9wdGlvbnMudHJpZ2dlcktleXM/LmtleXMgPz8gW0tleUNvZGUuRW50ZXIsIEtleUNvZGUuU3BhY2VdXG5cdFx0fTtcblxuXHRcdHRoaXMuX2hvdmVyRGVsZWdhdGUgPSBvcHRpb25zLmhvdmVyRGVsZWdhdGUgPz8gdGhpcy5fcmVnaXN0ZXIoY3JlYXRlSW5zdGFudEhvdmVyRGVsZWdhdGUoKSk7XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLmFjdGlvblJ1bm5lcikge1xuXHRcdFx0dGhpcy5fYWN0aW9uUnVubmVyID0gdGhpcy5vcHRpb25zLmFjdGlvblJ1bm5lcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fYWN0aW9uUnVubmVyID0gbmV3IEFjdGlvblJ1bm5lcigpO1xuXHRcdFx0dGhpcy5fYWN0aW9uUnVubmVyRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2FjdGlvblJ1bm5lcik7XG5cdFx0fVxuXG5cdFx0dGhpcy5fYWN0aW9uUnVubmVyRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2FjdGlvblJ1bm5lci5vbkRpZFJ1bihlID0+IHRoaXMuX29uRGlkUnVuLmZpcmUoZSkpKTtcblx0XHR0aGlzLl9hY3Rpb25SdW5uZXJEaXNwb3NhYmxlcy5hZGQodGhpcy5fYWN0aW9uUnVubmVyLm9uV2lsbFJ1bihlID0+IHRoaXMuX29uV2lsbFJ1bi5maXJlKGUpKSk7XG5cblx0XHR0aGlzLnZpZXdJdGVtcyA9IFtdO1xuXHRcdHRoaXMuZm9jdXNlZEl0ZW0gPSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLmRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NOYW1lID0gJ21vbmFjby1hY3Rpb24tYmFyJztcblxuXHRcdGxldCBwcmV2aW91c0tleXM6IEtleUNvZGVbXTtcblx0XHRsZXQgbmV4dEtleXM6IEtleUNvZGVbXTtcblxuXHRcdHN3aXRjaCAodGhpcy5fb3JpZW50YXRpb24pIHtcblx0XHRcdGNhc2UgQWN0aW9uc09yaWVudGF0aW9uLkhPUklaT05UQUw6XG5cdFx0XHRcdHByZXZpb3VzS2V5cyA9IFtLZXlDb2RlLkxlZnRBcnJvd107XG5cdFx0XHRcdG5leHRLZXlzID0gW0tleUNvZGUuUmlnaHRBcnJvd107XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBBY3Rpb25zT3JpZW50YXRpb24uVkVSVElDQUw6XG5cdFx0XHRcdHByZXZpb3VzS2V5cyA9IFtLZXlDb2RlLlVwQXJyb3ddO1xuXHRcdFx0XHRuZXh0S2V5cyA9IFtLZXlDb2RlLkRvd25BcnJvd107XG5cdFx0XHRcdHRoaXMuZG9tTm9kZS5jbGFzc05hbWUgKz0gJyB2ZXJ0aWNhbCc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLCBET00uRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGxldCBldmVudEhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0Y29uc3QgZm9jdXNlZEl0ZW0gPSB0eXBlb2YgdGhpcy5mb2N1c2VkSXRlbSA9PT0gJ251bWJlcicgPyB0aGlzLnZpZXdJdGVtc1t0aGlzLmZvY3VzZWRJdGVtXSA6IHVuZGVmaW5lZDtcblxuXHRcdFx0aWYgKHByZXZpb3VzS2V5cyAmJiAoZXZlbnQuZXF1YWxzKHByZXZpb3VzS2V5c1swXSkgfHwgZXZlbnQuZXF1YWxzKHByZXZpb3VzS2V5c1sxXSkpKSB7XG5cdFx0XHRcdGV2ZW50SGFuZGxlZCA9IHRoaXMuZm9jdXNQcmV2aW91cygpO1xuXHRcdFx0fSBlbHNlIGlmIChuZXh0S2V5cyAmJiAoZXZlbnQuZXF1YWxzKG5leHRLZXlzWzBdKSB8fCBldmVudC5lcXVhbHMobmV4dEtleXNbMV0pKSkge1xuXHRcdFx0XHRldmVudEhhbmRsZWQgPSB0aGlzLmZvY3VzTmV4dCgpO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpICYmIHRoaXMuY2FuY2VsSGFzTGlzdGVuZXIpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDYW5jZWwuZmlyZSgpO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5Ib21lKSkge1xuXHRcdFx0XHRldmVudEhhbmRsZWQgPSB0aGlzLmZvY3VzRmlyc3QoKTtcblx0XHRcdH0gZWxzZSBpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuRW5kKSkge1xuXHRcdFx0XHRldmVudEhhbmRsZWQgPSB0aGlzLmZvY3VzTGFzdCgpO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5UYWIpICYmIGZvY3VzZWRJdGVtIGluc3RhbmNlb2YgQmFzZUFjdGlvblZpZXdJdGVtICYmIGZvY3VzZWRJdGVtLnRyYXBzQXJyb3dOYXZpZ2F0aW9uKSB7XG5cdFx0XHRcdC8vIFRhYiwgc28gZm9yY2libHkgZm9jdXMgbmV4dCAjMjE5MTk5XG5cdFx0XHRcdGV2ZW50SGFuZGxlZCA9IHRoaXMuZm9jdXNOZXh0KHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuaXNUcmlnZ2VyS2V5RXZlbnQoZXZlbnQpKSB7XG5cdFx0XHRcdC8vIFN0YXlpbmcgb3V0IG9mIHRoZSBlbHNlIGJyYW5jaCBldmVuIGlmIG5vdCB0cmlnZ2VyZWRcblx0XHRcdFx0aWYgKHRoaXMuX3RyaWdnZXJLZXlzLmtleURvd24pIHtcblx0XHRcdFx0XHR0aGlzLmRvVHJpZ2dlcihldmVudCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy50cmlnZ2VyS2V5RG93biA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGV2ZW50SGFuZGxlZCA9IGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZXZlbnRIYW5kbGVkKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLCBET00uRXZlbnRUeXBlLktFWV9VUCwgZSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cblx0XHRcdC8vIFJ1biBhY3Rpb24gb24gRW50ZXIvU3BhY2Vcblx0XHRcdGlmICh0aGlzLmlzVHJpZ2dlcktleUV2ZW50KGV2ZW50KSkge1xuXHRcdFx0XHRpZiAoIXRoaXMuX3RyaWdnZXJLZXlzLmtleURvd24gJiYgdGhpcy50cmlnZ2VyS2V5RG93bikge1xuXHRcdFx0XHRcdHRoaXMudHJpZ2dlcktleURvd24gPSBmYWxzZTtcblx0XHRcdFx0XHR0aGlzLmRvVHJpZ2dlcihldmVudCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVjb21wdXRlIGZvY3VzZWQgaXRlbVxuXHRcdFx0ZWxzZSBpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuVGFiKSB8fCBldmVudC5lcXVhbHMoS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5UYWIpIHx8IGV2ZW50LmVxdWFscyhLZXlDb2RlLlVwQXJyb3cpIHx8IGV2ZW50LmVxdWFscyhLZXlDb2RlLkRvd25BcnJvdykgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuTGVmdEFycm93KSB8fCBldmVudC5lcXVhbHMoS2V5Q29kZS5SaWdodEFycm93KSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUZvY3VzZWRJdGVtKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5mb2N1c1RyYWNrZXIgPSB0aGlzLl9yZWdpc3RlcihET00udHJhY2tGb2N1cyh0aGlzLmRvbU5vZGUpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4ge1xuXHRcdFx0aWYgKERPTS5nZXRBY3RpdmVFbGVtZW50KCkgPT09IHRoaXMuZG9tTm9kZSB8fCAhRE9NLmlzQW5jZXN0b3IoRE9NLmdldEFjdGl2ZUVsZW1lbnQoKSwgdGhpcy5kb21Ob2RlKSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZEJsdXIuZmlyZSgpO1xuXHRcdFx0XHR0aGlzLnByZXZpb3VzbHlGb2N1c2VkSXRlbSA9IHRoaXMuZm9jdXNlZEl0ZW07XG5cdFx0XHRcdHRoaXMuZm9jdXNlZEl0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMudHJpZ2dlcktleURvd24gPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHRoaXMudXBkYXRlRm9jdXNlZEl0ZW0oKSkpO1xuXG5cdFx0dGhpcy5hY3Rpb25zTGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3VsJyk7XG5cdFx0dGhpcy5hY3Rpb25zTGlzdC5jbGFzc05hbWUgPSAnYWN0aW9ucy1jb250YWluZXInO1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuaGlnaGxpZ2h0VG9nZ2xlZEl0ZW1zKSB7XG5cdFx0XHR0aGlzLmFjdGlvbnNMaXN0LmNsYXNzTGlzdC5hZGQoJ2hpZ2hsaWdodC10b2dnbGVkJyk7XG5cdFx0fVxuXHRcdHRoaXMuYWN0aW9uc0xpc3Quc2V0QXR0cmlidXRlKCdyb2xlJywgdGhpcy5vcHRpb25zLmFyaWFSb2xlIHx8ICd0b29sYmFyJyk7XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLmFyaWFMYWJlbCkge1xuXHRcdFx0dGhpcy5hY3Rpb25zTGlzdC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCB0aGlzLm9wdGlvbnMuYXJpYUxhYmVsKTtcblx0XHR9XG5cblx0XHR0aGlzLmRvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5hY3Rpb25zTGlzdCk7XG5cblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5kb21Ob2RlKTtcblx0fVxuXG5cdHByaXZhdGUgcmVmcmVzaFJvbGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubGVuZ3RoKCkgPj0gMSkge1xuXHRcdFx0dGhpcy5hY3Rpb25zTGlzdC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCB0aGlzLm9wdGlvbnMuYXJpYVJvbGUgfHwgJ3Rvb2xiYXInKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5hY3Rpb25zTGlzdC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAncHJlc2VudGF0aW9uJyk7XG5cdFx0fVxuXHR9XG5cblx0c2V0QXJpYUxhYmVsKGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAobGFiZWwpIHtcblx0XHRcdHRoaXMuYWN0aW9uc0xpc3Quc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgbGFiZWwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmFjdGlvbnNMaXN0LnJlbW92ZUF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpO1xuXHRcdH1cblx0fVxuXG5cdC8vIFNvbWUgYWN0aW9uIGJhcnMgc2hvdWxkIG5vdCBiZSBmb2N1c2FibGUgYXQgdGltZXNcblx0Ly8gV2hlbiBhbiBhY3Rpb24gYmFyIGlzIG5vdCBmb2N1c2FibGUgbWFrZSBzdXJlIHRvIG1ha2UgYWxsIHRoZSBlbGVtZW50cyBpbnNpZGUgaXQgbm90IGZvY3VzYWJsZVxuXHQvLyBXaGVuIGFuIGFjdGlvbiBiYXIgaXMgZm9jdXNhYmxlIGFnYWluLCBtYWtlIHN1cmUgdGhlIGZpcnN0IGl0ZW0gY2FuIGJlIGZvY3VzZWRcblx0c2V0Rm9jdXNhYmxlKGZvY3VzYWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuZm9jdXNhYmxlID0gZm9jdXNhYmxlO1xuXHRcdGlmICh0aGlzLmZvY3VzYWJsZSkge1xuXHRcdFx0Y29uc3QgZmlyc3RFbmFibGVkID0gdGhpcy52aWV3SXRlbXMuZmluZCh2aSA9PiB2aSBpbnN0YW5jZW9mIEJhc2VBY3Rpb25WaWV3SXRlbSAmJiB2aS5pc0VuYWJsZWQoKSk7XG5cdFx0XHRpZiAoZmlyc3RFbmFibGVkIGluc3RhbmNlb2YgQmFzZUFjdGlvblZpZXdJdGVtKSB7XG5cdFx0XHRcdGZpcnN0RW5hYmxlZC5zZXRGb2N1c2FibGUodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudmlld0l0ZW1zLmZvckVhY2godmkgPT4ge1xuXHRcdFx0XHRpZiAodmkgaW5zdGFuY2VvZiBCYXNlQWN0aW9uVmlld0l0ZW0pIHtcblx0XHRcdFx0XHR2aS5zZXRGb2N1c2FibGUoZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGlzVHJpZ2dlcktleUV2ZW50KGV2ZW50OiBTdGFuZGFyZEtleWJvYXJkRXZlbnQpOiBib29sZWFuIHtcblx0XHRsZXQgcmV0ID0gZmFsc2U7XG5cdFx0dGhpcy5fdHJpZ2dlcktleXMua2V5cy5mb3JFYWNoKGtleUNvZGUgPT4ge1xuXHRcdFx0cmV0ID0gcmV0IHx8IGV2ZW50LmVxdWFscyhrZXlDb2RlKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUZvY3VzZWRJdGVtKCk6IHZvaWQge1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hY3Rpb25zTGlzdC5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgZWxlbSA9IHRoaXMuYWN0aW9uc0xpc3QuY2hpbGRyZW5baV07XG5cdFx0XHRpZiAoRE9NLmlzQW5jZXN0b3IoRE9NLmdldEFjdGl2ZUVsZW1lbnQoKSwgZWxlbSkpIHtcblx0XHRcdFx0dGhpcy5mb2N1c2VkSXRlbSA9IGk7XG5cdFx0XHRcdHRoaXMudmlld0l0ZW1zW3RoaXMuZm9jdXNlZEl0ZW1dPy5zaG93SG92ZXI/LigpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXQgY29udGV4dCgpOiB1bmtub3duIHtcblx0XHRyZXR1cm4gdGhpcy5fY29udGV4dDtcblx0fVxuXG5cdHNldCBjb250ZXh0KGNvbnRleHQ6IHVua25vd24pIHtcblx0XHR0aGlzLl9jb250ZXh0ID0gY29udGV4dDtcblx0XHR0aGlzLnZpZXdJdGVtcy5mb3JFYWNoKGkgPT4gaS5zZXRBY3Rpb25Db250ZXh0KGNvbnRleHQpKTtcblx0fVxuXG5cdGdldCBhY3Rpb25SdW5uZXIoKTogSUFjdGlvblJ1bm5lciB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdGlvblJ1bm5lcjtcblx0fVxuXG5cdHNldCBhY3Rpb25SdW5uZXIoYWN0aW9uUnVubmVyOiBJQWN0aW9uUnVubmVyKSB7XG5cdFx0dGhpcy5fYWN0aW9uUnVubmVyID0gYWN0aW9uUnVubmVyO1xuXG5cdFx0Ly8gd2hlbiBzZXR0aW5nIGEgbmV3IGBJQWN0aW9uUnVubmVyYCBtYWtlIHN1cmUgdG8gZGlzcG9zZSBvbGQgbGlzdGVuZXJzIGFuZFxuXHRcdC8vIHN0YXJ0IHRvIGZvcndhcmQgZXZlbnRzIGZyb20gdGhlIG5ldyBsaXN0ZW5lclxuXHRcdHRoaXMuX2FjdGlvblJ1bm5lckRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fYWN0aW9uUnVubmVyRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2FjdGlvblJ1bm5lci5vbkRpZFJ1bihlID0+IHRoaXMuX29uRGlkUnVuLmZpcmUoZSkpKTtcblx0XHR0aGlzLl9hY3Rpb25SdW5uZXJEaXNwb3NhYmxlcy5hZGQodGhpcy5fYWN0aW9uUnVubmVyLm9uV2lsbFJ1bihlID0+IHRoaXMuX29uV2lsbFJ1bi5maXJlKGUpKSk7XG5cdFx0dGhpcy52aWV3SXRlbXMuZm9yRWFjaChpdGVtID0+IGl0ZW0uYWN0aW9uUnVubmVyID0gYWN0aW9uUnVubmVyKTtcblx0fVxuXG5cdGdldENvbnRhaW5lcigpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuZG9tTm9kZTtcblx0fVxuXG5cdGhhc0FjdGlvbihhY3Rpb246IElBY3Rpb24pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3SXRlbXMuZmluZEluZGV4KGNhbmRpZGF0ZSA9PiBjYW5kaWRhdGUuYWN0aW9uLmlkID09PSBhY3Rpb24uaWQpICE9PSAtMTtcblx0fVxuXG5cdGdldEFjdGlvbihpbmRleE9yRWxlbWVudDogbnVtYmVyIHwgSFRNTEVsZW1lbnQpOiBJQWN0aW9uIHwgdW5kZWZpbmVkIHtcblxuXHRcdC8vIGJ5IGluZGV4XG5cdFx0aWYgKHR5cGVvZiBpbmRleE9yRWxlbWVudCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiB0aGlzLnZpZXdJdGVtc1tpbmRleE9yRWxlbWVudF0/LmFjdGlvbjtcblx0XHR9XG5cblx0XHQvLyBieSBlbGVtZW50XG5cdFx0aWYgKERPTS5pc0hUTUxFbGVtZW50KGluZGV4T3JFbGVtZW50KSkge1xuXHRcdFx0d2hpbGUgKGluZGV4T3JFbGVtZW50LnBhcmVudEVsZW1lbnQgIT09IHRoaXMuYWN0aW9uc0xpc3QpIHtcblx0XHRcdFx0aWYgKCFpbmRleE9yRWxlbWVudC5wYXJlbnRFbGVtZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbmRleE9yRWxlbWVudCA9IGluZGV4T3JFbGVtZW50LnBhcmVudEVsZW1lbnQ7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYWN0aW9uc0xpc3QuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodGhpcy5hY3Rpb25zTGlzdC5jaGlsZE5vZGVzW2ldID09PSBpbmRleE9yRWxlbWVudCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnZpZXdJdGVtc1tpXS5hY3Rpb247XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVzaChhcmc6IElBY3Rpb24gfCBSZWFkb25seUFycmF5PElBY3Rpb24+LCBvcHRpb25zOiBJQWN0aW9uT3B0aW9ucyA9IHt9KTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aW9uczogUmVhZG9ubHlBcnJheTxJQWN0aW9uPiA9IEFycmF5LmlzQXJyYXkoYXJnKSA/IGFyZyA6IFthcmddO1xuXG5cdFx0bGV0IGluZGV4ID0gdHlwZXMuaXNOdW1iZXIob3B0aW9ucy5pbmRleCkgPyBvcHRpb25zLmluZGV4IDogbnVsbDtcblxuXHRcdGFjdGlvbnMuZm9yRWFjaCgoYWN0aW9uOiBJQWN0aW9uKSA9PiB7XG5cdFx0XHRjb25zdCBhY3Rpb25WaWV3SXRlbUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1FbGVtZW50LmNsYXNzTmFtZSA9ICdhY3Rpb24taXRlbSc7XG5cdFx0XHRhY3Rpb25WaWV3SXRlbUVsZW1lbnQuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3ByZXNlbnRhdGlvbicpO1xuXG5cdFx0XHRsZXQgaXRlbTogSUFjdGlvblZpZXdJdGVtIHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRjb25zdCB2aWV3SXRlbU9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMgPSB7IGhvdmVyRGVsZWdhdGU6IHRoaXMuX2hvdmVyRGVsZWdhdGUsIC4uLm9wdGlvbnMsIGlzVGFiTGlzdDogdGhpcy5vcHRpb25zLmFyaWFSb2xlID09PSAndGFibGlzdCcgfTtcblx0XHRcdGlmICh0aGlzLm9wdGlvbnMuYWN0aW9uVmlld0l0ZW1Qcm92aWRlcikge1xuXHRcdFx0XHRpdGVtID0gdGhpcy5vcHRpb25zLmFjdGlvblZpZXdJdGVtUHJvdmlkZXIoYWN0aW9uLCB2aWV3SXRlbU9wdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdFx0aXRlbSA9IG5ldyBBY3Rpb25WaWV3SXRlbSh0aGlzLmNvbnRleHQsIGFjdGlvbiwgdmlld0l0ZW1PcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUHJldmVudCBuYXRpdmUgY29udGV4dCBtZW51IG9uIGFjdGlvbnNcblx0XHRcdGlmICghdGhpcy5vcHRpb25zLmFsbG93Q29udGV4dE1lbnUpIHtcblx0XHRcdFx0dGhpcy52aWV3SXRlbURpc3Bvc2FibGVzLnNldChpdGVtLCBET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGFjdGlvblZpZXdJdGVtRWxlbWVudCwgRE9NLkV2ZW50VHlwZS5DT05URVhUX01FTlUsIChlOiBET00uRXZlbnRMaWtlKSA9PiB7XG5cdFx0XHRcdFx0RE9NLkV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblxuXHRcdFx0aXRlbS5hY3Rpb25SdW5uZXIgPSB0aGlzLl9hY3Rpb25SdW5uZXI7XG5cdFx0XHRpdGVtLnNldEFjdGlvbkNvbnRleHQodGhpcy5jb250ZXh0KTtcblx0XHRcdGl0ZW0ucmVuZGVyKGFjdGlvblZpZXdJdGVtRWxlbWVudCk7XG5cblx0XHRcdGlmICh0aGlzLmZvY3VzYWJsZSAmJiBpdGVtIGluc3RhbmNlb2YgQmFzZUFjdGlvblZpZXdJdGVtICYmIHRoaXMudmlld0l0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHQvLyBXZSBuZWVkIHRvIGFsbG93IGZvciB0aGUgZmlyc3QgZW5hYmxlZCBpdGVtIHRvIGJlIGZvY3VzZWQgb24gdXNpbmcgdGFiIG5hdmlnYXRpb24gIzEwNjQ0MVxuXHRcdFx0XHRpdGVtLnNldEZvY3VzYWJsZSh0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluZGV4ID09PSBudWxsIHx8IGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLmFjdGlvbnNMaXN0LmNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLmFjdGlvbnNMaXN0LmFwcGVuZENoaWxkKGFjdGlvblZpZXdJdGVtRWxlbWVudCk7XG5cdFx0XHRcdHRoaXMudmlld0l0ZW1zLnB1c2goaXRlbSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmFjdGlvbnNMaXN0Lmluc2VydEJlZm9yZShhY3Rpb25WaWV3SXRlbUVsZW1lbnQsIHRoaXMuYWN0aW9uc0xpc3QuY2hpbGRyZW5baW5kZXhdKTtcblx0XHRcdFx0dGhpcy52aWV3SXRlbXMuc3BsaWNlKGluZGV4LCAwLCBpdGVtKTtcblx0XHRcdFx0aW5kZXgrKztcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZiAodHlwZW9mIHRoaXMuZm9jdXNlZEl0ZW0gPT09ICdudW1iZXInKSB7XG5cdFx0XHQvLyBBZnRlciBhIGNsZWFyIGFjdGlvbnMgbWlnaHQgYmUgcmUtYWRkZWQgdG8gc2ltcGx5IHRvZ2dsZSBzb21lIGFjdGlvbnMuIFdlIHNob3VsZCBwcmVzZXJ2ZSBmb2N1cyAjOTcxMjhcblx0XHRcdHRoaXMuZm9jdXModGhpcy5mb2N1c2VkSXRlbSk7XG5cdFx0fVxuXHRcdHRoaXMucmVmcmVzaFJvbGUoKTtcblx0fVxuXG5cdGdldFdpZHRoKGluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGlmIChpbmRleCA+PSAwICYmIGluZGV4IDwgdGhpcy5hY3Rpb25zTGlzdC5jaGlsZHJlbi5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLmFjdGlvbnNMaXN0LmNoaWxkcmVuLml0ZW0oaW5kZXgpO1xuXHRcdFx0aWYgKGl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIGl0ZW0uY2xpZW50V2lkdGg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRnZXRIZWlnaHQoaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKGluZGV4ID49IDAgJiYgaW5kZXggPCB0aGlzLmFjdGlvbnNMaXN0LmNoaWxkcmVuLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuYWN0aW9uc0xpc3QuY2hpbGRyZW4uaXRlbShpbmRleCk7XG5cdFx0XHRpZiAoaXRlbSkge1xuXHRcdFx0XHRyZXR1cm4gaXRlbS5jbGllbnRIZWlnaHQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRwdWxsKGluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoaW5kZXggPj0gMCAmJiBpbmRleCA8IHRoaXMudmlld0l0ZW1zLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5hY3Rpb25zTGlzdC5jaGlsZE5vZGVzW2luZGV4XS5yZW1vdmUoKTtcblx0XHRcdHRoaXMudmlld0l0ZW1EaXNwb3NhYmxlcy5kZWxldGVBbmREaXNwb3NlKHRoaXMudmlld0l0ZW1zW2luZGV4XSk7XG5cdFx0XHRkaXNwb3NlKHRoaXMudmlld0l0ZW1zLnNwbGljZShpbmRleCwgMSkpO1xuXHRcdFx0dGhpcy5yZWZyZXNoUm9sZSgpO1xuXHRcdH1cblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzRW1wdHkoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudmlld0l0ZW1zID0gZGlzcG9zZSh0aGlzLnZpZXdJdGVtcyk7XG5cdFx0dGhpcy52aWV3SXRlbURpc3Bvc2FibGVzLmNsZWFyQW5kRGlzcG9zZUFsbCgpO1xuXHRcdERPTS5jbGVhck5vZGUodGhpcy5hY3Rpb25zTGlzdCk7XG5cdFx0dGhpcy5yZWZyZXNoUm9sZSgpO1xuXHR9XG5cblx0bGVuZ3RoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudmlld0l0ZW1zLmxlbmd0aDtcblx0fVxuXG5cdGlzRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMudmlld0l0ZW1zLmxlbmd0aCA9PT0gMDtcblx0fVxuXG5cdGZvY3VzKGluZGV4PzogbnVtYmVyKTogdm9pZDtcblx0Zm9jdXMoc2VsZWN0Rmlyc3Q/OiBib29sZWFuKTogdm9pZDtcblx0Zm9jdXMoYXJnPzogbnVtYmVyIHwgYm9vbGVhbik6IHZvaWQge1xuXHRcdGxldCBzZWxlY3RGaXJzdDogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdGxldCBpbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmIChhcmcgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0c2VsZWN0Rmlyc3QgPSB0cnVlO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcblx0XHRcdGluZGV4ID0gYXJnO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRzZWxlY3RGaXJzdCA9IGFyZztcblx0XHR9XG5cblx0XHRpZiAoc2VsZWN0Rmlyc3QgJiYgdHlwZW9mIHRoaXMuZm9jdXNlZEl0ZW0gPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRjb25zdCBmaXJzdEVuYWJsZWQgPSB0aGlzLnZpZXdJdGVtcy5maW5kSW5kZXgoaXRlbSA9PiBpdGVtLmlzRW5hYmxlZCgpKTtcblx0XHRcdC8vIEZvY3VzIHRoZSBmaXJzdCBlbmFibGVkIGl0ZW1cblx0XHRcdHRoaXMuZm9jdXNlZEl0ZW0gPSBmaXJzdEVuYWJsZWQgPT09IC0xID8gdW5kZWZpbmVkIDogZmlyc3RFbmFibGVkO1xuXHRcdFx0dGhpcy51cGRhdGVGb2N1cyh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChpbmRleCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXNlZEl0ZW0gPSBpbmRleDtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy51cGRhdGVGb2N1cyh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBmb2N1c0ZpcnN0KCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuZm9jdXNlZEl0ZW0gPSB0aGlzLmxlbmd0aCgpIC0gMTtcblx0XHRyZXR1cm4gdGhpcy5mb2N1c05leHQodHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzTGFzdCgpOiBib29sZWFuIHtcblx0XHR0aGlzLmZvY3VzZWRJdGVtID0gMDtcblx0XHRyZXR1cm4gdGhpcy5mb2N1c1ByZXZpb3VzKHRydWUpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGZvY3VzTmV4dChmb3JjZUxvb3A/OiBib29sZWFuLCBmb3JjZUZvY3VzPzogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5mb2N1c2VkSXRlbSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHRoaXMuZm9jdXNlZEl0ZW0gPSB0aGlzLnZpZXdJdGVtcy5sZW5ndGggLSAxO1xuXHRcdH0gZWxzZSBpZiAodGhpcy52aWV3SXRlbXMubGVuZ3RoIDw9IDEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydEluZGV4ID0gdGhpcy5mb2N1c2VkSXRlbTtcblx0XHRsZXQgaXRlbTogSUFjdGlvblZpZXdJdGVtO1xuXHRcdGRvIHtcblxuXHRcdFx0aWYgKCFmb3JjZUxvb3AgJiYgdGhpcy5vcHRpb25zLnByZXZlbnRMb29wTmF2aWdhdGlvbiAmJiB0aGlzLmZvY3VzZWRJdGVtICsgMSA+PSB0aGlzLnZpZXdJdGVtcy5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5mb2N1c2VkSXRlbSA9IHN0YXJ0SW5kZXg7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5mb2N1c2VkSXRlbSA9ICh0aGlzLmZvY3VzZWRJdGVtICsgMSkgJSB0aGlzLnZpZXdJdGVtcy5sZW5ndGg7XG5cdFx0XHRpdGVtID0gdGhpcy52aWV3SXRlbXNbdGhpcy5mb2N1c2VkSXRlbV07XG5cdFx0fSB3aGlsZSAodGhpcy5mb2N1c2VkSXRlbSAhPT0gc3RhcnRJbmRleCAmJiAoKHRoaXMub3B0aW9ucy5mb2N1c09ubHlFbmFibGVkSXRlbXMgJiYgIWl0ZW0uaXNFbmFibGVkKCkpIHx8IGl0ZW0uYWN0aW9uLmlkID09PSBTZXBhcmF0b3IuSUQpKTtcblxuXHRcdHRoaXMudXBkYXRlRm9jdXModW5kZWZpbmVkLCB1bmRlZmluZWQsIGZvcmNlRm9jdXMpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGZvY3VzUHJldmlvdXMoZm9yY2VMb29wPzogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5mb2N1c2VkSXRlbSA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHRoaXMuZm9jdXNlZEl0ZW0gPSAwO1xuXHRcdH0gZWxzZSBpZiAodGhpcy52aWV3SXRlbXMubGVuZ3RoIDw9IDEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydEluZGV4ID0gdGhpcy5mb2N1c2VkSXRlbTtcblx0XHRsZXQgaXRlbTogSUFjdGlvblZpZXdJdGVtO1xuXG5cdFx0ZG8ge1xuXHRcdFx0dGhpcy5mb2N1c2VkSXRlbSA9IHRoaXMuZm9jdXNlZEl0ZW0gLSAxO1xuXHRcdFx0aWYgKHRoaXMuZm9jdXNlZEl0ZW0gPCAwKSB7XG5cdFx0XHRcdGlmICghZm9yY2VMb29wICYmIHRoaXMub3B0aW9ucy5wcmV2ZW50TG9vcE5hdmlnYXRpb24pIHtcblx0XHRcdFx0XHR0aGlzLmZvY3VzZWRJdGVtID0gc3RhcnRJbmRleDtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmZvY3VzZWRJdGVtID0gdGhpcy52aWV3SXRlbXMubGVuZ3RoIC0gMTtcblx0XHRcdH1cblx0XHRcdGl0ZW0gPSB0aGlzLnZpZXdJdGVtc1t0aGlzLmZvY3VzZWRJdGVtXTtcblx0XHR9IHdoaWxlICh0aGlzLmZvY3VzZWRJdGVtICE9PSBzdGFydEluZGV4ICYmICgodGhpcy5vcHRpb25zLmZvY3VzT25seUVuYWJsZWRJdGVtcyAmJiAhaXRlbS5pc0VuYWJsZWQoKSkgfHwgaXRlbS5hY3Rpb24uaWQgPT09IFNlcGFyYXRvci5JRCkpO1xuXG5cblx0XHR0aGlzLnVwZGF0ZUZvY3VzKHRydWUpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIHVwZGF0ZUZvY3VzKGZyb21SaWdodD86IGJvb2xlYW4sIHByZXZlbnRTY3JvbGw/OiBib29sZWFuLCBmb3JjZUZvY3VzOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuZm9jdXNlZEl0ZW0gPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aGlzLmFjdGlvbnNMaXN0LmZvY3VzKHsgcHJldmVudFNjcm9sbCB9KTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5wcmV2aW91c2x5Rm9jdXNlZEl0ZW0gIT09IHVuZGVmaW5lZCAmJiB0aGlzLnByZXZpb3VzbHlGb2N1c2VkSXRlbSAhPT0gdGhpcy5mb2N1c2VkSXRlbSkge1xuXHRcdFx0dGhpcy52aWV3SXRlbXNbdGhpcy5wcmV2aW91c2x5Rm9jdXNlZEl0ZW1dPy5ibHVyKCk7XG5cdFx0fVxuXHRcdGNvbnN0IGFjdGlvblZpZXdJdGVtID0gdGhpcy5mb2N1c2VkSXRlbSAhPT0gdW5kZWZpbmVkID8gdGhpcy52aWV3SXRlbXNbdGhpcy5mb2N1c2VkSXRlbV0gOiB1bmRlZmluZWQ7XG5cdFx0aWYgKGFjdGlvblZpZXdJdGVtKSB7XG5cdFx0XHRsZXQgZm9jdXNJdGVtID0gdHJ1ZTtcblxuXHRcdFx0aWYgKCF0eXBlcy5pc0Z1bmN0aW9uKGFjdGlvblZpZXdJdGVtLmZvY3VzKSkge1xuXHRcdFx0XHRmb2N1c0l0ZW0gPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMub3B0aW9ucy5mb2N1c09ubHlFbmFibGVkSXRlbXMgJiYgdHlwZXMuaXNGdW5jdGlvbihhY3Rpb25WaWV3SXRlbS5pc0VuYWJsZWQpICYmICFhY3Rpb25WaWV3SXRlbS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0XHRmb2N1c0l0ZW0gPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFjdGlvblZpZXdJdGVtLmFjdGlvbi5pZCA9PT0gU2VwYXJhdG9yLklEKSB7XG5cdFx0XHRcdGZvY3VzSXRlbSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFmb2N1c0l0ZW0pIHtcblx0XHRcdFx0dGhpcy5hY3Rpb25zTGlzdC5mb2N1cyh7IHByZXZlbnRTY3JvbGwgfSk7XG5cdFx0XHRcdHRoaXMucHJldmlvdXNseUZvY3VzZWRJdGVtID0gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIGlmIChmb3JjZUZvY3VzIHx8IHRoaXMucHJldmlvdXNseUZvY3VzZWRJdGVtICE9PSB0aGlzLmZvY3VzZWRJdGVtKSB7XG5cdFx0XHRcdGFjdGlvblZpZXdJdGVtLmZvY3VzKGZyb21SaWdodCk7XG5cdFx0XHRcdHRoaXMucHJldmlvdXNseUZvY3VzZWRJdGVtID0gdGhpcy5mb2N1c2VkSXRlbTtcblx0XHRcdH1cblx0XHRcdGlmIChmb2N1c0l0ZW0pIHtcblx0XHRcdFx0YWN0aW9uVmlld0l0ZW0uc2hvd0hvdmVyPy4oKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRvVHJpZ2dlcihldmVudDogU3RhbmRhcmRLZXlib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLmZvY3VzZWRJdGVtID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuOyAvL25vdGhpbmcgdG8gZm9jdXNcblx0XHR9XG5cblx0XHQvLyB0cmlnZ2VyIGFjdGlvblxuXHRcdGNvbnN0IGFjdGlvblZpZXdJdGVtID0gdGhpcy52aWV3SXRlbXNbdGhpcy5mb2N1c2VkSXRlbV07XG5cdFx0aWYgKGFjdGlvblZpZXdJdGVtIGluc3RhbmNlb2YgQmFzZUFjdGlvblZpZXdJdGVtKSB7XG5cdFx0XHRjb25zdCBjb250ZXh0ID0gKGFjdGlvblZpZXdJdGVtLl9jb250ZXh0ID09PSBudWxsIHx8IGFjdGlvblZpZXdJdGVtLl9jb250ZXh0ID09PSB1bmRlZmluZWQpID8gZXZlbnQgOiBhY3Rpb25WaWV3SXRlbS5fY29udGV4dDtcblx0XHRcdHRoaXMucnVuKGFjdGlvblZpZXdJdGVtLl9hY3Rpb24sIGNvbnRleHQpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJ1bihhY3Rpb246IElBY3Rpb24sIGNvbnRleHQ/OiB1bmtub3duKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fYWN0aW9uUnVubmVyLnJ1bihhY3Rpb24sIGNvbnRleHQpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZXh0ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMudmlld0l0ZW1zID0gZGlzcG9zZSh0aGlzLnZpZXdJdGVtcyk7XG5cdFx0dGhpcy5nZXRDb250YWluZXIoKS5yZW1vdmUoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZXBhcmVBY3Rpb25zKGFjdGlvbnM6IElBY3Rpb25bXSk6IElBY3Rpb25bXSB7XG5cdGlmICghYWN0aW9ucy5sZW5ndGgpIHtcblx0XHRyZXR1cm4gYWN0aW9ucztcblx0fVxuXG5cdC8vIENsZWFuIHVwIGxlYWRpbmcgc2VwYXJhdG9yc1xuXHRsZXQgZmlyc3RJbmRleE9mQWN0aW9uID0gLTE7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgYWN0aW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdGlmIChhY3Rpb25zW2ldLmlkID09PSBTZXBhcmF0b3IuSUQpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGZpcnN0SW5kZXhPZkFjdGlvbiA9IGk7XG5cdFx0YnJlYWs7XG5cdH1cblxuXHRpZiAoZmlyc3RJbmRleE9mQWN0aW9uID09PSAtMSkge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdGFjdGlvbnMgPSBhY3Rpb25zLnNsaWNlKGZpcnN0SW5kZXhPZkFjdGlvbik7XG5cblx0Ly8gQ2xlYW4gdXAgdHJhaWxpbmcgc2VwYXJhdG9yc1xuXHRmb3IgKGxldCBoID0gYWN0aW9ucy5sZW5ndGggLSAxOyBoID49IDA7IGgtLSkge1xuXHRcdGNvbnN0IGlzU2VwYXJhdG9yID0gYWN0aW9uc1toXS5pZCA9PT0gU2VwYXJhdG9yLklEO1xuXHRcdGlmIChpc1NlcGFyYXRvcikge1xuXHRcdFx0YWN0aW9ucy5zcGxpY2UoaCwgMSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdC8vIENsZWFuIHVwIHNlcGFyYXRvciBkdXBsaWNhdGVzXG5cdGxldCBmb3VuZEFjdGlvbiA9IGZhbHNlO1xuXHRmb3IgKGxldCBrID0gYWN0aW9ucy5sZW5ndGggLSAxOyBrID49IDA7IGstLSkge1xuXHRcdGNvbnN0IGlzU2VwYXJhdG9yID0gYWN0aW9uc1trXS5pZCA9PT0gU2VwYXJhdG9yLklEO1xuXHRcdGlmIChpc1NlcGFyYXRvciAmJiAhZm91bmRBY3Rpb24pIHtcblx0XHRcdGFjdGlvbnMuc3BsaWNlKGssIDEpO1xuXHRcdH0gZWxzZSBpZiAoIWlzU2VwYXJhdG9yKSB7XG5cdFx0XHRmb3VuZEFjdGlvbiA9IHRydWU7XG5cdFx0fSBlbHNlIGlmIChpc1NlcGFyYXRvcikge1xuXHRcdFx0Zm91bmRBY3Rpb24gPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gYWN0aW9ucztcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQiwwQkFBa0Q7QUFDM0UsU0FBUyxrQ0FBa0M7QUFFM0MsU0FBUyxjQUFpRCxpQkFBaUI7QUFDM0UsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsWUFBWSxlQUFlLGlCQUFpQixlQUE0QjtBQUNqRixZQUFZLFdBQVc7QUFDdkIsT0FBTztBQWlCQSxJQUFXLHFCQUFYLGtCQUFXQSx3QkFBWDtBQUNOLEVBQUFBLHdDQUFBO0FBQ0EsRUFBQUEsd0NBQUE7QUFGaUIsU0FBQUE7QUFBQSxHQUFBO0FBa0NYLE1BQU0sa0JBQWtCLFdBQW9DO0FBQUEsRUEyQ2xFLFlBQVksV0FBd0IsVUFBNkIsQ0FBQyxHQUFHO0FBQ3BFLFVBQU07QUF0Q1AsU0FBaUIsMkJBQTJCLEtBQUssVUFBVSxJQUFJLGdCQUFnQixDQUFDO0FBVWhGLFNBQWlCLHNC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
