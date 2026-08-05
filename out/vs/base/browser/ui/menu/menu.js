import { isFirefox } from "../../browser.js";
import { EventType as TouchEventType, Gesture } from "../../touch.js";
import { $, addDisposableListener, append, clearNode, Dimension, EventHelper, EventType, getActiveElement, getWindow, isAncestor, isInShadowDOM } from "../../dom.js";
import { createStyleSheet } from "../../domStylesheets.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { StandardMouseEvent } from "../../mouseEvent.js";
import { ActionBar, ActionsOrientation } from "../actionbar/actionbar.js";
import { ActionViewItem, BaseActionViewItem } from "../actionbar/actionViewItems.js";
import { layout, LayoutAnchorPosition } from "../contextview/contextview.js";
import { DomScrollableElement } from "../scrollbar/scrollableElement.js";
import { EmptySubmenuAction, Separator, SubmenuAction } from "../../../common/actions.js";
import { RunOnceScheduler } from "../../../common/async.js";
import { Codicon } from "../../../common/codicons.js";
import { getCodiconFontCharacters } from "../../../common/codiconsUtil.js";
import { ThemeIcon } from "../../../common/themables.js";
import { stripIcons } from "../../../common/iconLabels.js";
import { KeyCode } from "../../../common/keyCodes.js";
import { DisposableStore } from "../../../common/lifecycle.js";
import { isLinux, isMacintosh } from "../../../common/platform.js";
import { ScrollbarVisibility } from "../../../common/scrollable.js";
import * as strings from "../../../common/strings.js";
const MENU_MNEMONIC_REGEX = /\(&([^\s&])\)|(^|[^&])&([^\s&])/;
const MENU_ESCAPED_MNEMONIC_REGEX = /(&amp;)?(&amp;)([^\s&])/g;
var HorizontalDirection = /* @__PURE__ */ ((HorizontalDirection2) => {
  HorizontalDirection2[HorizontalDirection2["Right"] = 0] = "Right";
  HorizontalDirection2[HorizontalDirection2["Left"] = 1] = "Left";
  return HorizontalDirection2;
})(HorizontalDirection || {});
var VerticalDirection = /* @__PURE__ */ ((VerticalDirection2) => {
  VerticalDirection2[VerticalDirection2["Above"] = 0] = "Above";
  VerticalDirection2[VerticalDirection2["Below"] = 1] = "Below";
  return VerticalDirection2;
})(VerticalDirection || {});
const unthemedMenuStyles = {
  shadowColor: void 0,
  borderColor: void 0,
  foregroundColor: void 0,
  backgroundColor: void 0,
  selectionForegroundColor: void 0,
  selectionBackgroundColor: void 0,
  selectionBorderColor: void 0,
  separatorColor: void 0,
  scrollbarShadow: void 0,
  scrollbarSliderBackground: void 0,
  scrollbarSliderHoverBackground: void 0,
  scrollbarSliderActiveBackground: void 0
};
class Menu extends ActionBar {
  constructor(container, actions, options, menuStyles) {
    container.classList.add("monaco-menu-container");
    container.setAttribute("role", "presentation");
    const menuElement = document.createElement("div");
    menuElement.classList.add("monaco-menu");
    menuElement.setAttribute("role", "presentation");
    super(menuElement, {
      orientation: ActionsOrientation.VERTICAL,
      actionViewItemProvider: (action) => this.doGetActionViewItem(action, options, parentData),
      context: options.context,
      actionRunner: options.actionRunner,
      ariaLabel: options.ariaLabel,
      ariaRole: "menu",
      focusOnlyEnabledItems: true,
      triggerKeys: { keys: [KeyCode.Enter, ...isMacintosh || isLinux ? [KeyCode.Space] : []], keyDown: true }
    });
    this.menuStyles = menuStyles;
    this.menuElement = menuElement;
    this.actionsList.tabIndex = 0;
    this.initializeOrUpdateStyleSheet(container, menuStyles);
    this._register(Gesture.addTarget(menuElement));
    this._register(addDisposableListener(menuElement, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Tab)) {
        e.preventDefault();
      }
    }));
    if (options.enableMnemonics) {
      this._register(addDisposableListener(menuElement, EventType.KEY_DOWN, (e) => {
        const key = e.key.toLocaleLowerCase();
        if (this.mnemonics.has(key)) {
          EventHelper.stop(e, true);
          const actions2 = this.mnemonics.get(key);
          if (actions2.length === 1) {
            if (actions2[0] instanceof SubmenuMenuActionViewItem && actions2[0].container) {
              this.focusItemByElement(actions2[0].container);
            }
            actions2[0].onClick(e);
          }
          if (actions2.length > 1) {
            const action = actions2.shift();
            if (action && action.container) {
              this.focusItemByElement(action.container);
              actions2.push(action);
            }
            this.mnemonics.set(key, actions2);
          }
        }
      }));
    }
    if (isLinux) {
      this._register(addDisposableListener(menuElement, EventType.KEY_DOWN, (e) => {
        const event = new StandardKeyboardEvent(e);
        if (event.equals(KeyCode.Home) || event.equals(KeyCode.PageUp)) {
          this.focusedItem = this.viewItems.length - 1;
          this.focusNext();
          EventHelper.stop(e, true);
        } else if (event.equals(KeyCode.End) || event.equals(KeyCode.PageDown)) {
          this.focusedItem = 0;
          this.focusPrevious();
          EventHelper.stop(e, true);
        }
      }));
    }
    this._register(addDisposableListener(this.domNode, EventType.MOUSE_OUT, (e) => {
      const relatedTarget = e.relatedTarget;
      if (!isAncestor(relatedTarget, this.domNode)) {
        this.focusedItem = void 0;
        this.updateFocus();
        e.stopPropagation();
      }
    }));
    this._register(addDisposableListener(this.actionsList, EventType.MOUSE_OVER, (e) => {
      let target = e.target;
      if (!target || !isAncestor(target, this.actionsList) || target === this.actionsList) {
        return;
      }
      while (target.parentElement !== this.actionsList && target.parentElement !== null) {
        target = target.parentElement;
      }
      if (target.classList.contains("action-item")) {
        const lastFocusedItem = this.focusedItem;
        this.setFocusedItem(target);
        if (lastFocusedItem !== this.focusedItem) {
          this.updateFocus();
        }
      }
    }));
    this._register(Gesture.addTarget(this.actionsList));
    this._register(addDisposableListener(this.actionsList, TouchEventType.Tap, (e) => {
      let target = e.initialTarget;
      if (!target || !isAncestor(target, this.actionsList) || target === this.actionsList) {
        return;
      }
      while (target.parentElement !== this.actionsList && target.parentElement !== null) {
        target = target.parentElement;
      }
      if (target.classList.contains("action-item")) {
        const lastFocusedItem = this.focusedItem;
        this.setFocusedItem(target);
        if (lastFocusedItem !== this.focusedItem) {
          this.updateFocus();
        }
      }
    }));
    const parentData = {
      parent: this
    };
    this.mnemonics = /* @__PURE__ */ new Map();
    this.scrollableElement = this._register(new DomScrollableElement(menuElement, {
      alwaysConsumeMouseWheel: true,
      horizontal: ScrollbarVisibility.Hidden,
      vertical: ScrollbarVisibility.Visible,
      verticalScrollbarSize: 7,
      handleMouseWheel: true,
      useShadows: true
    }));
    const scrollElement = this.scrollableElement.getDomNode();
    scrollElement.style.position = "";
    this.styleScrollElement(scrollElement, menuStyles);
    this._register(addDisposableListener(menuElement, TouchEventType.Change, (e) => {
      EventHelper.stop(e, true);
      const scrollTop = this.scrollableElement.getScrollPosition().scrollTop;
      this.scrollableElement.setScrollPosition({ scrollTop: scrollTop - e.translationY });
    }));
    this._register(addDisposableListener(scrollElement, EventType.MOUSE_UP, (e) => {
      e.preventDefault();
    }));
    const window = getWindow(container);
    menuElement.style.maxHeight = `${Math.max(10, window.innerHeight - container.getBoundingClientRect().top - 35)}px`;
    actions = actions.filter((a, idx) => {
      if (options.submenuIds?.has(a.id)) {
        console.warn(`Found submenu cycle: ${a.id}`);
        return false;
      }
      if (a instanceof Separator) {
        if (idx === actions.length - 1 || idx === 0) {
          return false;
        }
        const prevAction = actions[idx - 1];
        if (prevAction instanceof Separator) {
          return false;
        }
      }
      return true;
    });
    this.push(actions, { icon: true, label: true, isMenu: true });
    container.appendChild(this.scrollableElement.getDomNode());
    this.scrollableElement.scanDomNode();
    this.viewItems.filter((item) => !(item instanceof MenuSeparatorActionViewItem)).forEach((item, index, array) => {
      item.updatePositionInSet(index + 1, array.length);
    });
  }
  initializeOrUpdateStyleSheet(container, style) {
    if (!this.styleSheet) {
      if (isInShadowDOM(container)) {
        this.styleSheet = createStyleSheet(container);
      } else {
        if (!Menu.globalStyleSheet) {
          Menu.globalStyleSheet = createStyleSheet();
        }
        this.styleSheet = Menu.globalStyleSheet;
      }
    }
    this.styleSheet.textContent = getMenuWidgetCSS(style, isInShadowDOM(container));
  }
  styleScrollElement(scrollElement, style) {
    const fgColor = style.foregroundColor ?? "";
    const bgColor = style.backgroundColor ?? "";
    const border = style.borderColor ? `1px solid ${style.borderColor}` : "";
    const borderRadius = "5px";
    const shadow = style.shadowColor ? `0 2px 8px ${style.shadowColor}` : "";
    scrollElement.style.outline = border;
    scrollElement.style.borderRadius = borderRadius;
    scrollElement.style.color = fgColor;
    scrollElement.style.backgroundColor = bgColor;
    scrollElement.style.boxShadow = shadow;
  }
  getContainer() {
    return this.scrollableElement.getDomNode();
  }
  get onScroll() {
    return this.scrollableElement.onScroll;
  }
  get scrollOffset() {
    return this.menuElement.scrollTop;
  }
  trigger(index) {
    if (index <= this.viewItems.length && index >= 0) {
      const item = this.viewItems[index];
      if (item instanceof SubmenuMenuActionViewItem) {
        super.focus(index);
        item.open(true);
      } else if (item instanceof BaseMenuActionViewItem) {
        super.run(item._action, item._context);
      } else {
        return;
      }
    }
  }
  focusItemByElement(element) {
    const lastFocusedItem = this.focusedItem;
    this.setFocusedItem(element);
    if (lastFocusedItem !== this.focusedItem) {
      this.updateFocus();
    }
  }
  setFocusedItem(element) {
    for (let i = 0; i < this.actionsList.children.length; i++) {
      const elem = this.actionsList.children[i];
      if (element === elem) {
        this.focusedItem = i;
        break;
      }
    }
  }
  updateFocus(fromRight) {
    super.updateFocus(fromRight, true, true);
    if (typeof this.focusedItem !== "undefined") {
      this.scrollableElement.setScrollPosition({
        scrollTop: Math.round(this.menuElement.scrollTop)
      });
    }
  }
  doGetActionViewItem(action, options, parentData) {
    if (action instanceof Separator) {
      return new MenuSeparatorActionViewItem(options.context, action, { icon: true }, this.menuStyles);
    } else if (action instanceof SubmenuAction) {
      const menuActionViewItem = new SubmenuMenuActionViewItem(action, action.actions, parentData, { ...options, submenuIds: /* @__PURE__ */ new Set([...options.submenuIds || [], action.id]) }, this.menuStyles);
      if (options.enableMnemonics) {
        const mnemonic = menuActionViewItem.getMnemonic();
        if (mnemonic && menuActionViewItem.isEnabled()) {
          let actionViewItems = [];
          if (this.mnemonics.has(mnemonic)) {
            actionViewItems = this.mnemonics.get(mnemonic);
          }
          actionViewItems.push(menuActionViewItem);
          this.mnemonics.set(mnemonic, actionViewItems);
        }
      }
      return menuActionViewItem;
    } else {
      const menuItemOptions = { enableMnemonics: options.enableMnemonics, useEventAsContext: options.useEventAsContext };
      if (options.getKeyBinding) {
        const keybinding = options.getKeyBinding(action);
        if (keybinding) {
          const keybindingLabel = keybinding.getLabel();
          if (keybindingLabel) {
            menuItemOptions.keybinding = keybindingLabel;
          }
        }
      }
      const menuActionViewItem = new BaseMenuActionViewItem(options.context, action, menuItemOptions, this.menuStyles);
      if (options.enableMnemonics) {
        const mnemonic = menuActionViewItem.getMnemonic();
        if (mnemonic && menuActionViewItem.isEnabled()) {
          let actionViewItems = [];
          if (this.mnemonics.has(mnemonic)) {
            actionViewItems = this.mnemonics.get(mnemonic);
          }
          actionViewItems.push(menuActionViewItem);
          this.mnemonics.set(mnemonic, actionViewItems);
        }
      }
      return menuActionViewItem;
    }
  }
}
class BaseMenuActionViewItem extends BaseActionViewItem {
  constructor(ctx, action, options, menuStyle) {
    options.isMenu = true;
    super(action, action, options);
    this.menuStyle = menuStyle;
    this.options = options;
    this.options.icon = options.icon !== void 0 ? options.icon : false;
    this.options.label = options.label !== void 0 ? options.label : true;
    this.cssClass = "";
    if (this.options.label && options.enableMnemonics) {
      const label = this.action.label;
      if (label) {
        const matches = MENU_MNEMONIC_REGEX.exec(label);
        if (matches) {
          this.mnemonic = (!!matches[1] ? matches[1] : matches[3]).toLocaleLowerCase();
        }
      }
    }
    this.runOnceToEnableMouseUp = new RunOnceScheduler(() => {
      if (!this.element) {
        return;
      }
      this._register(addDisposableListener(this.element, EventType.MOUSE_UP, (e) => {
        EventHelper.stop(e, true);
        if (isFirefox) {
          const mouseEvent = new StandardMouseEvent(getWindow(this.element), e);
          if (mouseEvent.rightButton) {
            return;
          }
          this.onClick(e);
        } else {
          setTimeout(() => {
            this.onClick(e);
          }, 0);
        }
      }));
      this._register(addDisposableListener(this.element, EventType.CONTEXT_MENU, (e) => {
        EventHelper.stop(e, true);
      }));
    }, 100);
    this._register(this.runOnceToEnableMouseUp);
  }
  render(container) {
    super.render(container);
    if (!this.element) {
      return;
    }
    this.container = container;
    this.item = append(this.element, $("a.action-menu-item"));
    if (this._action.id === Separator.ID) {
      this.item.setAttribute("role", "presentation");
    } else {
      this.item.setAttribute("role", "menuitem");
      if (this.mnemonic) {
        this.item.setAttribute("aria-keyshortcuts", `${this.mnemonic}`);
      }
    }
    this.check = append(this.item, $("span.menu-item-check" + ThemeIcon.asCSSSelector(Codicon.menuSelection)));
    this.check.setAttribute("role", "none");
    this.label = append(this.item, $("span.action-label"));
    if (this.options.label && this.options.keybinding) {
      append(this.item, $("span.keybinding")).textContent = this.options.keybinding;
    }
    this.runOnceToEnableMouseUp.schedule();
    this.updateClass();
    this.updateLabel();
    this.updateTooltip();
    this.updateEnabled();
    this.updateChecked();
    this.applyStyle();
  }
  blur() {
    super.blur();
    this.applyStyle();
  }
  focus() {
    super.focus();
    this.item?.focus();
    this.applyStyle();
  }
  updatePositionInSet(pos, setSize) {
    if (this.item) {
      this.item.setAttribute("aria-posinset", `${pos}`);
      this.item.setAttribute("aria-setsize", `${setSize}`);
    }
  }
  updateLabel() {
    if (!this.label) {
      return;
    }
    if (this.options.label) {
      clearNode(this.label);
      let label = stripIcons(this.action.label);
      if (label) {
        const cleanLabel = cleanMnemonic(label);
        if (!this.options.enableMnemonics) {
          label = cleanLabel;
        }
        this.label.setAttribute("aria-label", cleanLabel.replace(/&&/g, "&"));
        const matches = MENU_MNEMONIC_REGEX.exec(label);
        if (matches) {
          label = strings.escape(label);
          MENU_ESCAPED_MNEMONIC_REGEX.lastIndex = 0;
          let escMatch = MENU_ESCAPED_MNEMONIC_REGEX.exec(label);
          while (escMatch && escMatch[1]) {
            escMatch = MENU_ESCAPED_MNEMONIC_REGEX.exec(label);
          }
          const replaceDoubleEscapes = (str) => str.replace(/&amp;&amp;/g, "&amp;");
          if (escMatch) {
            this.label.append(
              strings.ltrim(replaceDoubleEscapes(label.substr(0, escMatch.index)), " "),
              $(
                "u",
                { "aria-hidden": "true" },
                escMatch[3]
              ),
              strings.rtrim(replaceDoubleEscapes(label.substr(escMatch.index + escMatch[0].length)), " ")
            );
          } else {
            this.label.innerText = replaceDoubleEscapes(label).trim();
          }
          this.item?.setAttribute("aria-keyshortcuts", (!!matches[1] ? matches[1] : matches[3]).toLocaleLowerCase());
        } else {
          this.label.innerText = label.replace(/&&/g, "&").trim();
        }
      }
    }
  }
  updateTooltip() {
  }
  updateClass() {
    if (this.cssClass && this.item) {
      this.item.classList.remove(...this.cssClass.split(" "));
    }
    if (this.options.icon && this.label) {
      this.cssClass = this.action.class || "";
      this.label.classList.add("icon");
      if (this.cssClass) {
        this.label.classList.add(...this.cssClass.split(" "));
      }
      this.updateEnabled();
    } else if (this.label) {
      this.label.classList.remove("icon");
    }
  }
  updateEnabled() {
    if (this.action.enabled) {
      if (this.element) {
        this.element.classList.remove("disabled");
        this.element.removeAttribute("aria-disabled");
      }
      if (this.item) {
        this.item.classList.remove("disabled");
        this.item.removeAttribute("aria-disabled");
        this.item.tabIndex = 0;
      }
    } else {
      if (this.element) {
        this.element.classList.add("disabled");
        this.element.setAttribute("aria-disabled", "true");
      }
      if (this.item) {
        this.item.classList.add("disabled");
        this.item.setAttribute("aria-disabled", "true");
      }
    }
  }
  updateChecked() {
    if (!this.item) {
      return;
    }
    const checked = this.action.checked;
    this.item.classList.toggle("checked", !!checked);
    if (checked !== void 0) {
      this.item.setAttribute("role", "menuitemcheckbox");
      this.item.setAttribute("aria-checked", checked ? "true" : "false");
    } else {
      this.item.setAttribute("role", "menuitem");
      this.item.setAttribute("aria-checked", "");
    }
  }
  getMnemonic() {
    return this.mnemonic;
  }
  applyStyle() {
    const isSelected = this.element && this.element.classList.contains("focused");
    const fgColor = isSelected && this.menuStyle.selectionForegroundColor ? this.menuStyle.selectionForegroundColor : this.menuStyle.foregroundColor;
    const bgColor = isSelected && this.menuStyle.selectionBackgroundColor ? this.menuStyle.selectionBackgroundColor : void 0;
    const outline = isSelected && this.menuStyle.selectionBorderColor ? `1px solid ${this.menuStyle.selectionBorderColor}` : "";
    const outlineOffset = isSelected && this.menuStyle.selectionBorderColor ? `-1px` : "";
    if (this.item) {
      this.item.style.color = fgColor ?? "";
      this.item.style.backgroundColor = bgColor ?? "";
      this.item.style.outline = outline;
      this.item.style.outlineOffset = outlineOffset;
    }
    if (this.check) {
      this.check.style.color = fgColor ?? "";
    }
  }
}
class SubmenuMenuActionViewItem extends BaseMenuActionViewItem {
  constructor(action, submenuActions, parentData, submenuOptions, menuStyles) {
    super(action, action, submenuOptions, menuStyles);
    this.submenuActions = submenuActions;
    this.parentData = parentData;
    this.submenuOptions = submenuOptions;
    this.mysubmenu = null;
    this.submenuDisposables = this._register(new DisposableStore());
    this.mouseOver = false;
    this.expandDirection = submenuOptions && submenuOptions.expandDirection !== void 0 ? submenuOptions.expandDirection : { horizontal: 0 /* Right */, vertical: 1 /* Below */ };
    this.showScheduler = new RunOnceScheduler(() => {
      if (this.mouseOver) {
        this.cleanupExistingSubmenu(false);
        this.createSubmenu(false);
      }
    }, 250);
    this.hideScheduler = new RunOnceScheduler(() => {
      if (this.element && (!isAncestor(getActiveElement(), this.element) && this.parentData.submenu === this.mysubmenu)) {
        this.parentData.parent.focus(false);
        this.cleanupExistingSubmenu(true);
      }
    }, 750);
  }
  render(container) {
    super.render(container);
    if (!this.element) {
      return;
    }
    if (this.item) {
      this.item.classList.add("monaco-submenu-item");
      this.item.tabIndex = 0;
      this.item.setAttribute("aria-haspopup", "true");
      this.updateAriaExpanded("false");
      this.submenuIndicator = append(this.item, $("span.submenu-indicator" + ThemeIcon.asCSSSelector(Codicon.menuSubmenu)));
      this.submenuIndicator.setAttribute("aria-hidden", "true");
    }
    this._register(addDisposableListener(this.element, EventType.KEY_UP, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.RightArrow) || event.equals(KeyCode.Enter)) {
        EventHelper.stop(e, true);
        this.createSubmenu(true);
      }
    }));
    this._register(addDisposableListener(this.element, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (getActiveElement() === this.item) {
        if (event.equals(KeyCode.RightArrow) || event.equals(KeyCode.Enter)) {
          EventHelper.stop(e, true);
        }
      }
    }));
    this._register(addDisposableListener(this.element, EventType.MOUSE_OVER, (e) => {
      if (!this.mouseOver) {
        this.mouseOver = true;
        this.showScheduler.schedule();
      }
    }));
    this._register(addDisposableListener(this.element, EventType.MOUSE_LEAVE, (e) => {
      this.mouseOver = false;
    }));
    this._register(addDisposableListener(this.element, EventType.FOCUS_OUT, (e) => {
      if (this.element && !isAncestor(getActiveElement(), this.element)) {
        this.hideScheduler.schedule();
      }
    }));
    this._register(this.parentData.parent.onScroll(() => {
      if (this.parentData.submenu === this.mysubmenu) {
        this.parentData.parent.focus(false);
        this.cleanupExistingSubmenu(true);
      }
    }));
  }
  updateEnabled() {
  }
  open(selectFirst) {
    this.cleanupExistingSubmenu(false);
    this.createSubmenu(selectFirst);
  }
  onClick(e) {
    EventHelper.stop(e, true);
    this.cleanupExistingSubmenu(false);
    this.createSubmenu(true);
  }
  cleanupExistingSubmenu(force) {
    if (this.parentData.submenu && (force || this.parentData.submenu !== this.mysubmenu)) {
      try {
        this.parentData.submenu.dispose();
      } catch {
      }
      this.parentData.submenu = void 0;
      this.updateAriaExpanded("false");
      if (this.submenuContainer) {
        this.submenuDisposables.clear();
        this.submenuContainer = void 0;
      }
    }
  }
  calculateSubmenuMenuLayout(windowDimensions, submenu, entry, expandDirection) {
    const ret = { top: 0, left: 0 };
    ret.left = layout(windowDimensions.width, submenu.width, { position: expandDirection.horizontal === 0 /* Right */ ? LayoutAnchorPosition.Before : LayoutAnchorPosition.After, offset: entry.left, size: entry.width });
    if (ret.left >= entry.left && ret.left < entry.left + entry.width) {
      if (entry.left + 10 + submenu.width <= windowDimensions.width) {
        ret.left = entry.left + 10;
      }
      entry.top += 10;
      entry.height = 0;
    }
    ret.top = layout(windowDimensions.height, submenu.height, { position: LayoutAnchorPosition.Before, offset: entry.top, size: 0 });
    if (ret.top + submenu.height === entry.top && ret.top + entry.height + submenu.height <= windowDimensions.height) {
      ret.top += entry.height;
    }
    return ret;
  }
  createSubmenu(selectFirstItem = true) {
    if (!this.element) {
      return;
    }
    if (!this.parentData.submenu) {
      this.updateAriaExpanded("true");
      this.submenuContainer = append(this.element, $("div.monaco-submenu"));
      this.submenuContainer.classList.add("menubar-menu-items-holder", "context-view");
      const computedStyles = getWindow(this.parentData.parent.domNode).getComputedStyle(this.parentData.parent.domNode);
      const paddingTop = parseFloat(computedStyles.paddingTop || "0") || 0;
      this.submenuContainer.style.position = "fixed";
      this.submenuContainer.style.top = "0";
      this.submenuContainer.style.left = "0";
      this.parentData.submenu = new Menu(this.submenuContainer, this.submenuActions.length ? this.submenuActions : [new EmptySubmenuAction()], this.submenuOptions, this.menuStyle);
      const entryBox = this.element.getBoundingClientRect();
      const entryBoxUpdated = {
        top: entryBox.top - paddingTop,
        left: entryBox.left,
        height: entryBox.height + 2 * paddingTop,
        width: entryBox.width
      };
      const viewBox = this.submenuContainer.getBoundingClientRect();
      const window = getWindow(this.element);
      const { top, left } = this.calculateSubmenuMenuLayout(new Dimension(window.innerWidth, window.innerHeight), Dimension.lift(viewBox), entryBoxUpdated, this.expandDirection);
      this.submenuContainer.style.left = `${left - viewBox.left}px`;
      this.submenuContainer.style.top = `${top - viewBox.top}px`;
      this.submenuDisposables.add(addDisposableListener(this.submenuContainer, EventType.KEY_UP, (e) => {
        const event = new StandardKeyboardEvent(e);
        if (event.equals(KeyCode.LeftArrow)) {
          EventHelper.stop(e, true);
          this.parentData.parent.focus();
          this.cleanupExistingSubmenu(true);
        }
      }));
      this.submenuDisposables.add(addDisposableListener(this.submenuContainer, EventType.KEY_DOWN, (e) => {
        const event = new StandardKeyboardEvent(e);
        if (event.equals(KeyCode.LeftArrow)) {
          EventHelper.stop(e, true);
        }
      }));
      this.submenuDisposables.add(this.parentData.submenu.onDidCancel(() => {
        this.parentData.parent.focus();
        this.cleanupExistingSubmenu(true);
      }));
      this.parentData.submenu.focus(selectFirstItem);
      this.mysubmenu = this.parentData.submenu;
    } else {
      this.parentData.submenu.focus(false);
    }
  }
  updateAriaExpanded(value) {
    if (this.item) {
      this.item?.setAttribute("aria-expanded", value);
    }
  }
  applyStyle() {
    super.applyStyle();
    const isSelected = this.element && this.element.classList.contains("focused");
    const fgColor = isSelected && this.menuStyle.selectionForegroundColor ? this.menuStyle.selectionForegroundColor : this.menuStyle.foregroundColor;
    if (this.submenuIndicator) {
      this.submenuIndicator.style.color = fgColor ?? "";
    }
  }
  dispose() {
    super.dispose();
    this.hideScheduler.dispose();
    if (this.mysubmenu) {
      this.mysubmenu.dispose();
      this.mysubmenu = null;
    }
    if (this.submenuContainer) {
      this.submenuContainer = void 0;
    }
  }
}
class MenuSeparatorActionViewItem extends ActionViewItem {
  constructor(context, action, options, menuStyles) {
    super(context, action, options);
    this.menuStyles = menuStyles;
  }
  render(container) {
    super.render(container);
    if (this.label) {
      this.label.style.borderBottomColor = this.menuStyles.separatorColor ? `${this.menuStyles.separatorColor}` : "";
    }
  }
}
function cleanMnemonic(label) {
  const regex = MENU_MNEMONIC_REGEX;
  const matches = regex.exec(label);
  if (!matches) {
    return label;
  }
  const mnemonicInText = !matches[1];
  return label.replace(regex, mnemonicInText ? "$2$3" : "").trim();
}
function formatRule(c) {
  const fontCharacter = getCodiconFontCharacters()[c.id];
  return `.codicon-${c.id}:before { content: '\\${fontCharacter.toString(16)}'; }`;
}
function getMenuWidgetCSS(style, isForShadowDom) {
  let result = (
    /* css */
    `
.monaco-menu {
	font-size: 13px;
	border-radius: 5px;
	min-width: 160px;
}

${formatRule(Codicon.menuSelection)}
${formatRule(Codicon.menuSubmenu)}

.monaco-menu .monaco-action-bar {
	text-align: right;
	overflow: hidden;
	white-space: nowrap;
}

.monaco-menu .monaco-action-bar .actions-container {
	display: flex;
	margin: 0 auto;
	padding: 0;
	width: 100%;
	justify-content: flex-end;
}

.monaco-menu .monaco-action-bar.vertical .actions-container {
	display: inline-block;
}

.monaco-menu .monaco-action-bar.reverse .actions-container {
	flex-direction: row-reverse;
}

.monaco-menu .monaco-action-bar .action-item {
	cursor: pointer;
	display: inline-block;
	transition: transform 50ms ease;
	position: relative;  /* DO NOT REMOVE - this is the key to preventing the ghosting icon bug in Chrome 42 */
}

.monaco-menu .monaco-action-bar .action-item.disabled {
	cursor: default;
}

.monaco-menu .monaco-action-bar .action-item .icon,
.monaco-menu .monaco-action-bar .action-item .codicon {
	display: inline-block;
}

.monaco-menu .monaco-action-bar .action-item .codicon {
	display: flex;
	align-items: center;
}

.monaco-menu .monaco-action-bar .action-label {
	font-size: 11px;
	margin-right: 4px;
}

.monaco-menu .monaco-action-bar .action-item.disabled .action-label,
.monaco-menu .monaco-action-bar .action-item.disabled .action-label:hover {
	color: var(--vscode-disabledForeground);
}

/* Vertical actions */

.monaco-menu .monaco-action-bar.vertical {
	text-align: left;
}

.monaco-menu .monaco-action-bar.vertical .action-item {
	display: block;
}

.monaco-menu .monaco-action-bar.vertical .action-label.separator {
	display: block;
	border-bottom: 1px solid var(--vscode-menu-separatorBackground);
	padding-top: 1px;
	padding: 30px;
}

.monaco-menu .secondary-actions .monaco-action-bar .action-label {
	margin-left: 6px;
}

/* Action Items */
.monaco-menu .monaco-action-bar .action-item.select-container {
	overflow: hidden; /* somehow the dropdown overflows its container, we prevent it here to not push */
	flex: 1;
	max-width: 170px;
	min-width: 60px;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 10px;
}

.monaco-menu .monaco-action-bar.vertical {
	margin-left: 0;
	overflow: visible;
}

.monaco-menu .monaco-action-bar.vertical .actions-container {
	display: block;
}

.monaco-menu .monaco-action-bar.vertical .action-item {
	padding: 0;
	transform: none;
	display: flex;
}

.monaco-menu .monaco-action-bar.vertical .action-item.active {
	transform: none;
}

.monaco-menu .monaco-action-bar.vertical .action-menu-item {
	flex: 1 1 auto;
	display: flex;
	height: 2em;
	align-items: center;
	position: relative;
	margin: 0 4px;
	border-radius: 4px;
}

.monaco-menu .monaco-action-bar.vertical .action-menu-item:hover .keybinding,
.monaco-menu .monaco-action-bar.vertical .action-menu-item:focus .keybinding {
	opacity: unset;
}

.monaco-menu .monaco-action-bar.vertical .action-label {
	flex: 1 1 auto;
	text-decoration: none;
	padding: 0 1em;
	background: none;
	font-size: 12px;
	line-height: 1;
}

.monaco-menu .monaco-action-bar.vertical .keybinding,
.monaco-menu .monaco-action-bar.vertical .submenu-indicator {
	display: inline-block;
	flex: 2 1 auto;
	padding: 0 1em;
	text-align: right;
	font-size: 12px;
	line-height: 1;
	opacity: 0.7;
}

.monaco-menu .monaco-action-bar.vertical .submenu-indicator {
	height: 100%;
}

.monaco-menu .monaco-action-bar.vertical .submenu-indicator.codicon {
	font-size: 16px !important;
	display: flex;
	align-items: center;
}

.monaco-menu .monaco-action-bar.vertical .submenu-indicator.codicon::before {
	margin-left: auto;
	margin-right: -20px;
}

.monaco-menu .monaco-action-bar.vertical .action-item.disabled .keybinding,
.monaco-menu .monaco-action-bar.vertical .action-item.disabled .submenu-indicator {
	opacity: 0.4;
}

.monaco-menu .monaco-action-bar.vertical .action-label:not(.separator) {
	display: inline-block;
	box-sizing: border-box;
	margin: 0;
}

.monaco-menu .monaco-action-bar.vertical .action-item {
	position: static;
	overflow: visible;
}

.monaco-menu .monaco-action-bar.vertical .action-item .monaco-submenu {
	position: absolute;
}

.monaco-menu .monaco-action-bar.vertical .action-label.separator {
	width: 100%;
	height: 0px !important;
	opacity: 1;
}

.monaco-menu .monaco-action-bar.vertical .action-label.separator.text {
	padding: 0.7em 1em 0.1em 1em;
	font-weight: bold;
	opacity: 1;
}

.monaco-menu .monaco-action-bar.vertical .action-label:hover {
	color: inherit;
}

.monaco-menu .monaco-action-bar.vertical .menu-item-check {
	position: absolute;
	visibility: hidden;
	width: 1em;
	height: 100%;
}

.monaco-menu .monaco-action-bar.vertical .action-menu-item.checked .menu-item-check {
	visibility: visible;
	display: flex;
	align-items: center;
	justify-content: center;
}

/* Context Menu */

.context-view.monaco-menu-container {
	outline: 0;
	border: none;
	animation: fadeIn 0.083s linear;
	-webkit-app-region: no-drag;
}

.context-view.monaco-menu-container :focus,
.context-view.monaco-menu-container .monaco-action-bar.vertical:focus,
.context-view.monaco-menu-container .monaco-action-bar.vertical :focus {
	outline: 0;
}

.hc-black .context-view.monaco-menu-container,
.hc-light .context-view.monaco-menu-container,
:host-context(.hc-black) .context-view.monaco-menu-container,
:host-context(.hc-light) .context-view.monaco-menu-container {
	box-shadow: none;
}

.hc-black .monaco-menu .monaco-action-bar.vertical .action-item.focused,
.hc-light .monaco-menu .monaco-action-bar.vertical .action-item.focused,
:host-context(.hc-black) .monaco-menu .monaco-action-bar.vertical .action-item.focused,
:host-context(.hc-light) .monaco-menu .monaco-action-bar.vertical .action-item.focused {
	background: none;
}

/* Vertical Action Bar Styles */

.monaco-menu .monaco-action-bar.vertical {
	padding: 4px 0;
}

.monaco-menu .monaco-action-bar.vertical .action-menu-item {
	height: 2em;
}

.monaco-menu .monaco-action-bar.vertical .action-label:not(.separator),
.monaco-menu .monaco-action-bar.vertical .keybinding {
	font-size: inherit;
	padding: 0 2em;
	max-height: 100%;
}

.monaco-menu .monaco-action-bar.vertical .menu-item-check {
	font-size: inherit;
	width: 2em;
}

.monaco-menu .monaco-action-bar.vertical .action-label.separator {
	font-size: inherit;
	margin: 5px 0 !important;
	padding: 0;
	border-radius: 0;
}

.linux .monaco-menu .monaco-action-bar.vertical .action-label.separator,
:host-context(.linux) .monaco-menu .monaco-action-bar.vertical .action-label.separator {
	margin-left: 0;
	margin-right: 0;
}

.monaco-menu .monaco-action-bar.vertical .submenu-indicator {
	font-size: 60%;
	padding: 0 1.8em;
}

.linux .monaco-menu .monaco-action-bar.vertical .submenu-indicator,
:host-context(.linux) .monaco-menu .monaco-action-bar.vertical .submenu-indicator {
	height: 100%;
	mask-size: 10px 10px;
	-webkit-mask-size: 10px 10px;
}

.monaco-menu .action-item {
	cursor: default;
}`
  );
  if (isForShadowDom) {
    result += `
			/* Arrows */
			.monaco-scrollable-element > .scrollbar > .scra {
				cursor: pointer;
				font-size: 11px !important;
			}

			.monaco-scrollable-element > .visible {
				opacity: 1;

				/* Background rule added for IE9 - to allow clicks on dom node */
				background:rgba(0,0,0,0);

				transition: opacity 100ms linear;
			}
			.monaco-scrollable-element > .invisible {
				opacity: 0;
				pointer-events: none;
			}
			.monaco-scrollable-element > .invisible.fade {
				transition: opacity 800ms linear;
			}

			/* Scrollable Content Inset Shadow */
			.monaco-scrollable-element > .shadow {
				position: absolute;
				display: none;
			}
			.monaco-scrollable-element > .shadow.top {
				display: block;
				top: 0;
				left: 3px;
				height: 3px;
				width: 100%;
			}
			.monaco-scrollable-element > .shadow.left {
				display: block;
				top: 3px;
				left: 0;
				height: 100%;
				width: 3px;
			}
			.monaco-scrollable-element > .shadow.top-left-corner {
				display: block;
				top: 0;
				left: 0;
				height: 3px;
				width: 3px;
			}
			/* Fix for https://github.com/microsoft/vscode/issues/103170 */
			.monaco-menu .action-item .monaco-submenu {
				z-index: 1;
			}
		`;
    const scrollbarShadowColor = style.scrollbarShadow;
    if (scrollbarShadowColor) {
      result += `
				.monaco-scrollable-element > .shadow.top {
					box-shadow: ${scrollbarShadowColor} 0 6px 6px -6px inset;
				}

				.monaco-scrollable-element > .shadow.left {
					box-shadow: ${scrollbarShadowColor} 6px 0 6px -6px inset;
				}

				.monaco-scrollable-element > .shadow.top.left {
					box-shadow: ${scrollbarShadowColor} 6px 6px 6px -6px inset;
				}
			`;
    }
    const scrollbarSliderBackgroundColor = style.scrollbarSliderBackground;
    if (scrollbarSliderBackgroundColor) {
      result += `
				.monaco-scrollable-element > .scrollbar > .slider {
					background: ${scrollbarSliderBackgroundColor};
				}
			`;
    }
    const scrollbarSliderHoverBackgroundColor = style.scrollbarSliderHoverBackground;
    if (scrollbarSliderHoverBackgroundColor) {
      result += `
				.monaco-scrollable-element > .scrollbar > .slider:hover {
					background: ${scrollbarSliderHoverBackgroundColor};
				}
			`;
    }
    const scrollbarSliderActiveBackgroundColor = style.scrollbarSliderActiveBackground;
    if (scrollbarSliderActiveBackgroundColor) {
      result += `
				.monaco-scrollable-element > .scrollbar > .slider.active {
					background: ${scrollbarSliderActiveBackgroundColor};
				}
			`;
    }
  }
  return result;
}
export {
  HorizontalDirection,
  MENU_ESCAPED_MNEMONIC_REGEX,
  MENU_MNEMONIC_REGEX,
  Menu,
  VerticalDirection,
  cleanMnemonic,
  formatRule,
  unthemedMenuStyles
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvbWVudS9tZW51LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgaXNGaXJlZm94IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFdmVudFR5cGUgYXMgVG91Y2hFdmVudFR5cGUsIEdlc3R1cmUgfSBmcm9tICcuLi8uLi90b3VjaC5qcyc7XG5pbXBvcnQgeyAkLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGFwcGVuZCwgY2xlYXJOb2RlLCBEaW1lbnNpb24sIEV2ZW50SGVscGVyLCBFdmVudExpa2UsIEV2ZW50VHlwZSwgZ2V0QWN0aXZlRWxlbWVudCwgZ2V0V2luZG93LCBJRG9tTm9kZVBhZ2VQb3NpdGlvbiwgaXNBbmNlc3RvciwgaXNJblNoYWRvd0RPTSB9IGZyb20gJy4uLy4uL2RvbS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTdHlsZVNoZWV0IH0gZnJvbSAnLi4vLi4vZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4va2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciwgQWN0aW9uc09yaWVudGF0aW9uLCBJQWN0aW9uVmlld0l0ZW1Qcm92aWRlciB9IGZyb20gJy4uL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgQWN0aW9uVmlld0l0ZW0sIEJhc2VBY3Rpb25WaWV3SXRlbSwgSUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgQW5jaG9yQWxpZ25tZW50LCBsYXlvdXQsIExheW91dEFuY2hvclBvc2l0aW9uIH0gZnJvbSAnLi4vY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgRG9tU2Nyb2xsYWJsZUVsZW1lbnQgfSBmcm9tICcuLi9zY3JvbGxiYXIvc2Nyb2xsYWJsZUVsZW1lbnQuanMnO1xuaW1wb3J0IHsgRW1wdHlTdWJtZW51QWN0aW9uLCBJQWN0aW9uLCBJQWN0aW9uUnVubmVyLCBTZXBhcmF0b3IsIFN1Ym1lbnVBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgZ2V0Q29kaWNvbkZvbnRDaGFyYWN0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvZGljb25zVXRpbC5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IHN0cmlwSWNvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IFJlc29sdmVkS2V5YmluZGluZyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzTGludXgsIGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFNjcm9sbGJhclZpc2liaWxpdHksIFNjcm9sbEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Njcm9sbGFibGUuanMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi9jb21tb24vc3RyaW5ncy5qcyc7XG5cbmV4cG9ydCBjb25zdCBNRU5VX01ORU1PTklDX1JFR0VYID0gL1xcKCYoW15cXHMmXSlcXCl8KF58W14mXSkmKFteXFxzJl0pLztcbmV4cG9ydCBjb25zdCBNRU5VX0VTQ0FQRURfTU5FTU9OSUNfUkVHRVggPSAvKCZhbXA7KT8oJmFtcDspKFteXFxzJl0pL2c7XG5cblxuXG5leHBvcnQgZW51bSBIb3Jpem9udGFsRGlyZWN0aW9uIHtcblx0UmlnaHQsXG5cdExlZnRcbn1cblxuZXhwb3J0IGVudW0gVmVydGljYWxEaXJlY3Rpb24ge1xuXHRBYm92ZSxcblx0QmVsb3dcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWVudURpcmVjdGlvbiB7XG5cdGhvcml6b250YWw6IEhvcml6b250YWxEaXJlY3Rpb247XG5cdHZlcnRpY2FsOiBWZXJ0aWNhbERpcmVjdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWVudU9wdGlvbnMge1xuXHRjb250ZXh0PzogdW5rbm93bjtcblx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcj86IElBY3Rpb25WaWV3SXRlbVByb3ZpZGVyO1xuXHRhY3Rpb25SdW5uZXI/OiBJQWN0aW9uUnVubmVyO1xuXHRnZXRLZXlCaW5kaW5nPzogKGFjdGlvbjogSUFjdGlvbikgPT4gUmVzb2x2ZWRLZXliaW5kaW5nIHwgdW5kZWZpbmVkO1xuXHRhcmlhTGFiZWw/OiBzdHJpbmc7XG5cdGVuYWJsZU1uZW1vbmljcz86IGJvb2xlYW47XG5cdGFuY2hvckFsaWdubWVudD86IEFuY2hvckFsaWdubWVudDtcblx0ZXhwYW5kRGlyZWN0aW9uPzogSU1lbnVEaXJlY3Rpb247XG5cdHVzZUV2ZW50QXNDb250ZXh0PzogYm9vbGVhbjtcblx0c3VibWVudUlkcz86IFNldDxzdHJpbmc+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNZW51U3R5bGVzIHtcblx0c2hhZG93Q29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Ym9yZGVyQ29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Zm9yZWdyb3VuZENvbG9yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGJhY2tncm91bmRDb2xvcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRzZWxlY3Rpb25Gb3JlZ3JvdW5kQ29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0c2VsZWN0aW9uQmFja2dyb3VuZENvbG9yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHNlbGVjdGlvbkJvcmRlckNvbG9yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHNlcGFyYXRvckNvbG9yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHNjcm9sbGJhclNoYWRvdzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRzY3JvbGxiYXJTbGlkZXJCYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHNjcm9sbGJhclNsaWRlckhvdmVyQmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRzY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBjb25zdCB1bnRoZW1lZE1lbnVTdHlsZXM6IElNZW51U3R5bGVzID0ge1xuXHRzaGFkb3dDb2xvcjogdW5kZWZpbmVkLFxuXHRib3JkZXJDb2xvcjogdW5kZWZpbmVkLFxuXHRmb3JlZ3JvdW5kQ29sb3I6IHVuZGVmaW5lZCxcblx0YmFja2dyb3VuZENvbG9yOiB1bmRlZmluZWQsXG5cdHNlbGVjdGlvbkZvcmVncm91bmRDb2xvcjogdW5kZWZpbmVkLFxuXHRzZWxlY3Rpb25CYWNrZ3JvdW5kQ29sb3I6IHVuZGVmaW5lZCxcblx0c2VsZWN0aW9uQm9yZGVyQ29sb3I6IHVuZGVmaW5lZCxcblx0c2VwYXJhdG9yQ29sb3I6IHVuZGVmaW5lZCxcblx0c2Nyb2xsYmFyU2hhZG93OiB1bmRlZmluZWQsXG5cdHNjcm9sbGJhclNsaWRlckJhY2tncm91bmQ6IHVuZGVmaW5lZCxcblx0c2Nyb2xsYmFyU2xpZGVySG92ZXJCYWNrZ3JvdW5kOiB1bmRlZmluZWQsXG5cdHNjcm9sbGJhclNsaWRlckFjdGl2ZUJhY2tncm91bmQ6IHVuZGVmaW5lZFxufTtcblxuaW50ZXJmYWNlIElTdWJNZW51RGF0YSB7XG5cdHBhcmVudDogTWVudTtcblx0c3VibWVudT86IE1lbnU7XG59XG5cbmV4cG9ydCBjbGFzcyBNZW51IGV4dGVuZHMgQWN0aW9uQmFyIHtcblx0cHJpdmF0ZSBtbmVtb25pY3M6IE1hcDxzdHJpbmcsIEFycmF5PEJhc2VNZW51QWN0aW9uVmlld0l0ZW0+Pjtcblx0cHJpdmF0ZSBzY3JvbGxhYmxlRWxlbWVudDogRG9tU2Nyb2xsYWJsZUVsZW1lbnQ7XG5cdHByaXZhdGUgbWVudUVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRzdGF0aWMgZ2xvYmFsU3R5bGVTaGVldDogSFRNTFN0eWxlRWxlbWVudDtcblx0cHJvdGVjdGVkIHN0eWxlU2hlZXQ6IEhUTUxTdHlsZUVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgYWN0aW9uczogUmVhZG9ubHlBcnJheTxJQWN0aW9uPiwgb3B0aW9uczogSU1lbnVPcHRpb25zLCBwcml2YXRlIHJlYWRvbmx5IG1lbnVTdHlsZXM6IElNZW51U3R5bGVzKSB7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21vbmFjby1tZW51LWNvbnRhaW5lcicpO1xuXHRcdGNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAncHJlc2VudGF0aW9uJyk7XG5cdFx0Y29uc3QgbWVudUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRtZW51RWxlbWVudC5jbGFzc0xpc3QuYWRkKCdtb25hY28tbWVudScpO1xuXHRcdG1lbnVFbGVtZW50LnNldEF0dHJpYnV0ZSgncm9sZScsICdwcmVzZW50YXRpb24nKTtcblxuXHRcdHN1cGVyKG1lbnVFbGVtZW50LCB7XG5cdFx0XHRvcmllbnRhdGlvbjogQWN0aW9uc09yaWVudGF0aW9uLlZFUlRJQ0FMLFxuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogYWN0aW9uID0+IHRoaXMuZG9HZXRBY3Rpb25WaWV3SXRlbShhY3Rpb24sIG9wdGlvbnMsIHBhcmVudERhdGEpLFxuXHRcdFx0Y29udGV4dDogb3B0aW9ucy5jb250ZXh0LFxuXHRcdFx0YWN0aW9uUnVubmVyOiBvcHRpb25zLmFjdGlvblJ1bm5lcixcblx0XHRcdGFyaWFMYWJlbDogb3B0aW9ucy5hcmlhTGFiZWwsXG5cdFx0XHRhcmlhUm9sZTogJ21lbnUnLFxuXHRcdFx0Zm9jdXNPbmx5RW5hYmxlZEl0ZW1zOiB0cnVlLFxuXHRcdFx0dHJpZ2dlcktleXM6IHsga2V5czogW0tleUNvZGUuRW50ZXIsIC4uLihpc01hY2ludG9zaCB8fCBpc0xpbnV4ID8gW0tleUNvZGUuU3BhY2VdIDogW10pXSwga2V5RG93bjogdHJ1ZSB9XG5cdFx0fSk7XG5cblx0XHR0aGlzLm1lbnVFbGVtZW50ID0gbWVudUVsZW1lbnQ7XG5cblx0XHR0aGlzLmFjdGlvbnNMaXN0LnRhYkluZGV4ID0gMDtcblxuXHRcdHRoaXMuaW5pdGlhbGl6ZU9yVXBkYXRlU3R5bGVTaGVldChjb250YWluZXIsIG1lbnVTdHlsZXMpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoR2VzdHVyZS5hZGRUYXJnZXQobWVudUVsZW1lbnQpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihtZW51RWxlbWVudCwgRXZlbnRUeXBlLktFWV9ET1dOLCAoZSkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXG5cdFx0XHQvLyBTdG9wIHRhYiBuYXZpZ2F0aW9uIG9mIG1lbnVzXG5cdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuVGFiKSkge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKG9wdGlvbnMuZW5hYmxlTW5lbW9uaWNzKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIobWVudUVsZW1lbnQsIEV2ZW50VHlwZS5LRVlfRE9XTiwgKGUpID0+IHtcblx0XHRcdFx0Y29uc3Qga2V5ID0gZS5rZXkudG9Mb2NhbGVMb3dlckNhc2UoKTtcblx0XHRcdFx0aWYgKHRoaXMubW5lbW9uaWNzLmhhcyhrZXkpKSB7XG5cdFx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblx0XHRcdFx0XHRjb25zdCBhY3Rpb25zID0gdGhpcy5tbmVtb25pY3MuZ2V0KGtleSkhO1xuXG5cdFx0XHRcdFx0aWYgKGFjdGlvbnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0XHRpZiAoYWN0aW9uc1swXSBpbnN0YW5jZW9mIFN1Ym1lbnVNZW51QWN0aW9uVmlld0l0ZW0gJiYgYWN0aW9uc1swXS5jb250YWluZXIpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5mb2N1c0l0ZW1CeUVsZW1lbnQoYWN0aW9uc1swXS5jb250YWluZXIpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRhY3Rpb25zWzBdLm9uQ2xpY2soZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGFjdGlvbnMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgYWN0aW9uID0gYWN0aW9ucy5zaGlmdCgpO1xuXHRcdFx0XHRcdFx0aWYgKGFjdGlvbiAmJiBhY3Rpb24uY29udGFpbmVyKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZm9jdXNJdGVtQnlFbGVtZW50KGFjdGlvbi5jb250YWluZXIpO1xuXHRcdFx0XHRcdFx0XHRhY3Rpb25zLnB1c2goYWN0aW9uKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dGhpcy5tbmVtb25pY3Muc2V0KGtleSwgYWN0aW9ucyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0aWYgKGlzTGludXgpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihtZW51RWxlbWVudCwgRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXG5cdFx0XHRcdGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5Ib21lKSB8fCBldmVudC5lcXVhbHMoS2V5Q29kZS5QYWdlVXApKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c2VkSXRlbSA9IHRoaXMudmlld0l0ZW1zLmxlbmd0aCAtIDE7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c05leHQoKTtcblx0XHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLkVuZCkgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuUGFnZURvd24pKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c2VkSXRlbSA9IDA7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c1ByZXZpb3VzKCk7XG5cdFx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmRvbU5vZGUsIEV2ZW50VHlwZS5NT1VTRV9PVVQsIGUgPT4ge1xuXHRcdFx0Y29uc3QgcmVsYXRlZFRhcmdldCA9IGUucmVsYXRlZFRhcmdldCBhcyBIVE1MRWxlbWVudDtcblx0XHRcdGlmICghaXNBbmNlc3RvcihyZWxhdGVkVGFyZ2V0LCB0aGlzLmRvbU5vZGUpKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXNlZEl0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMudXBkYXRlRm9jdXMoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5hY3Rpb25zTGlzdCwgRXZlbnRUeXBlLk1PVVNFX09WRVIsIGUgPT4ge1xuXHRcdFx0bGV0IHRhcmdldCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuXHRcdFx0aWYgKCF0YXJnZXQgfHwgIWlzQW5jZXN0b3IodGFyZ2V0LCB0aGlzLmFjdGlvbnNMaXN0KSB8fCB0YXJnZXQgPT09IHRoaXMuYWN0aW9uc0xpc3QpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR3aGlsZSAodGFyZ2V0LnBhcmVudEVsZW1lbnQgIT09IHRoaXMuYWN0aW9uc0xpc3QgJiYgdGFyZ2V0LnBhcmVudEVsZW1lbnQgIT09IG51bGwpIHtcblx0XHRcdFx0dGFyZ2V0ID0gdGFyZ2V0LnBhcmVudEVsZW1lbnQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCdhY3Rpb24taXRlbScpKSB7XG5cdFx0XHRcdGNvbnN0IGxhc3RGb2N1c2VkSXRlbSA9IHRoaXMuZm9jdXNlZEl0ZW07XG5cdFx0XHRcdHRoaXMuc2V0Rm9jdXNlZEl0ZW0odGFyZ2V0KTtcblxuXHRcdFx0XHRpZiAobGFzdEZvY3VzZWRJdGVtICE9PSB0aGlzLmZvY3VzZWRJdGVtKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVGb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gU3VwcG9ydCB0b3VjaCBvbiBhY3Rpb25zIGxpc3QgdG8gZm9jdXMgaXRlbXMgKG5lZWRlZCBmb3Igc3VibWVudXMpXG5cdFx0dGhpcy5fcmVnaXN0ZXIoR2VzdHVyZS5hZGRUYXJnZXQodGhpcy5hY3Rpb25zTGlzdCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmFjdGlvbnNMaXN0LCBUb3VjaEV2ZW50VHlwZS5UYXAsIGUgPT4ge1xuXHRcdFx0bGV0IHRhcmdldCA9IGUuaW5pdGlhbFRhcmdldCBhcyBIVE1MRWxlbWVudDtcblx0XHRcdGlmICghdGFyZ2V0IHx8ICFpc0FuY2VzdG9yKHRhcmdldCwgdGhpcy5hY3Rpb25zTGlzdCkgfHwgdGFyZ2V0ID09PSB0aGlzLmFjdGlvbnNMaXN0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0d2hpbGUgKHRhcmdldC5wYXJlbnRFbGVtZW50ICE9PSB0aGlzLmFjdGlvbnNMaXN0ICYmIHRhcmdldC5wYXJlbnRFbGVtZW50ICE9PSBudWxsKSB7XG5cdFx0XHRcdHRhcmdldCA9IHRhcmdldC5wYXJlbnRFbGVtZW50O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnYWN0aW9uLWl0ZW0nKSkge1xuXHRcdFx0XHRjb25zdCBsYXN0Rm9jdXNlZEl0ZW0gPSB0aGlzLmZvY3VzZWRJdGVtO1xuXHRcdFx0XHR0aGlzLnNldEZvY3VzZWRJdGVtKHRhcmdldCk7XG5cblx0XHRcdFx0aWYgKGxhc3RGb2N1c2VkSXRlbSAhPT0gdGhpcy5mb2N1c2VkSXRlbSkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlRm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXG5cdFx0Y29uc3QgcGFyZW50RGF0YTogSVN1Yk1lbnVEYXRhID0ge1xuXHRcdFx0cGFyZW50OiB0aGlzXG5cdFx0fTtcblxuXHRcdHRoaXMubW5lbW9uaWNzID0gbmV3IE1hcDxzdHJpbmcsIEFycmF5PEJhc2VNZW51QWN0aW9uVmlld0l0ZW0+PigpO1xuXG5cdFx0Ly8gU2Nyb2xsIExvZ2ljXG5cdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEb21TY3JvbGxhYmxlRWxlbWVudChtZW51RWxlbWVudCwge1xuXHRcdFx0YWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IHRydWUsXG5cdFx0XHRob3Jpem9udGFsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkhpZGRlbixcblx0XHRcdHZlcnRpY2FsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LlZpc2libGUsXG5cdFx0XHR2ZXJ0aWNhbFNjcm9sbGJhclNpemU6IDcsXG5cdFx0XHRoYW5kbGVNb3VzZVdoZWVsOiB0cnVlLFxuXHRcdFx0dXNlU2hhZG93czogdHJ1ZVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHNjcm9sbEVsZW1lbnQgPSB0aGlzLnNjcm9sbGFibGVFbGVtZW50LmdldERvbU5vZGUoKTtcblx0XHRzY3JvbGxFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJyc7XG5cblx0XHR0aGlzLnN0eWxlU2Nyb2xsRWxlbWVudChzY3JvbGxFbGVtZW50LCBtZW51U3R5bGVzKTtcblxuXHRcdC8vIFN1cHBvcnQgc2Nyb2xsIG9uIG1lbnUgZHJhZ1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihtZW51RWxlbWVudCwgVG91Y2hFdmVudFR5cGUuQ2hhbmdlLCBlID0+IHtcblx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7XG5cblx0XHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0U2Nyb2xsUG9zaXRpb24oKS5zY3JvbGxUb3A7XG5cdFx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsVG9wOiBzY3JvbGxUb3AgLSBlLnRyYW5zbGF0aW9uWSB9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIoc2Nyb2xsRWxlbWVudCwgRXZlbnRUeXBlLk1PVVNFX1VQLCBlID0+IHtcblx0XHRcdC8vIEFic29yYiBjbGlja3MgaW4gbWVudSBkZWFkIHNwYWNlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy82MzU3NVxuXHRcdFx0Ly8gV2UgZG8gdGhpcyBvbiB0aGUgc2Nyb2xsIGVsZW1lbnQgc28gdGhlIHNjcm9sbCBiYXIgZG9lc24ndCBkaXNtaXNzIHRoZSBtZW51IGVpdGhlclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHdpbmRvdyA9IGdldFdpbmRvdyhjb250YWluZXIpO1xuXHRcdG1lbnVFbGVtZW50LnN0eWxlLm1heEhlaWdodCA9IGAke01hdGgubWF4KDEwLCB3aW5kb3cuaW5uZXJIZWlnaHQgLSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wIC0gMzUpfXB4YDtcblxuXHRcdGFjdGlvbnMgPSBhY3Rpb25zLmZpbHRlcigoYSwgaWR4KSA9PiB7XG5cdFx0XHRpZiAob3B0aW9ucy5zdWJtZW51SWRzPy5oYXMoYS5pZCkpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBGb3VuZCBzdWJtZW51IGN5Y2xlOiAke2EuaWR9YCk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRmlsdGVyIG91dCBjb25zZWN1dGl2ZSBvciB1c2VsZXNzIHNlcGFyYXRvcnNcblx0XHRcdGlmIChhIGluc3RhbmNlb2YgU2VwYXJhdG9yKSB7XG5cdFx0XHRcdGlmIChpZHggPT09IGFjdGlvbnMubGVuZ3RoIC0gMSB8fCBpZHggPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBwcmV2QWN0aW9uID0gYWN0aW9uc1tpZHggLSAxXTtcblx0XHRcdFx0aWYgKHByZXZBY3Rpb24gaW5zdGFuY2VvZiBTZXBhcmF0b3IpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cblx0XHR0aGlzLnB1c2goYWN0aW9ucywgeyBpY29uOiB0cnVlLCBsYWJlbDogdHJ1ZSwgaXNNZW51OiB0cnVlIH0pO1xuXG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNjYW5Eb21Ob2RlKCk7XG5cblx0XHR0aGlzLnZpZXdJdGVtcy5maWx0ZXIoaXRlbSA9PiAhKGl0ZW0gaW5zdGFuY2VvZiBNZW51U2VwYXJhdG9yQWN0aW9uVmlld0l0ZW0pKS5mb3JFYWNoKChpdGVtLCBpbmRleCwgYXJyYXkpID0+IHtcblx0XHRcdChpdGVtIGFzIEJhc2VNZW51QWN0aW9uVmlld0l0ZW0pLnVwZGF0ZVBvc2l0aW9uSW5TZXQoaW5kZXggKyAxLCBhcnJheS5sZW5ndGgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBpbml0aWFsaXplT3JVcGRhdGVTdHlsZVNoZWV0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHN0eWxlOiBJTWVudVN0eWxlcyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5zdHlsZVNoZWV0KSB7XG5cdFx0XHRpZiAoaXNJblNoYWRvd0RPTShjb250YWluZXIpKSB7XG5cdFx0XHRcdHRoaXMuc3R5bGVTaGVldCA9IGNyZWF0ZVN0eWxlU2hlZXQoY29udGFpbmVyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICghTWVudS5nbG9iYWxTdHlsZVNoZWV0KSB7XG5cdFx0XHRcdFx0TWVudS5nbG9iYWxTdHlsZVNoZWV0ID0gY3JlYXRlU3R5bGVTaGVldCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuc3R5bGVTaGVldCA9IE1lbnUuZ2xvYmFsU3R5bGVTaGVldDtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5zdHlsZVNoZWV0LnRleHRDb250ZW50ID0gZ2V0TWVudVdpZGdldENTUyhzdHlsZSwgaXNJblNoYWRvd0RPTShjb250YWluZXIpKTtcblx0fVxuXG5cdHByaXZhdGUgc3R5bGVTY3JvbGxFbGVtZW50KHNjcm9sbEVsZW1lbnQ6IEhUTUxFbGVtZW50LCBzdHlsZTogSU1lbnVTdHlsZXMpOiB2b2lkIHtcblxuXHRcdGNvbnN0IGZnQ29sb3IgPSBzdHlsZS5mb3JlZ3JvdW5kQ29sb3IgPz8gJyc7XG5cdFx0Y29uc3QgYmdDb2xvciA9IHN0eWxlLmJhY2tncm91bmRDb2xvciA/PyAnJztcblx0XHRjb25zdCBib3JkZXIgPSBzdHlsZS5ib3JkZXJDb2xvciA/IGAxcHggc29saWQgJHtzdHlsZS5ib3JkZXJDb2xvcn1gIDogJyc7XG5cdFx0Y29uc3QgYm9yZGVyUmFkaXVzID0gJzVweCc7XG5cdFx0Y29uc3Qgc2hhZG93ID0gc3R5bGUuc2hhZG93Q29sb3IgPyBgMCAycHggOHB4ICR7c3R5bGUuc2hhZG93Q29sb3J9YCA6ICcnO1xuXG5cdFx0c2Nyb2xsRWxlbWVudC5zdHlsZS5vdXRsaW5lID0gYm9yZGVyO1xuXHRcdHNjcm9sbEVsZW1lbnQuc3R5bGUuYm9yZGVyUmFkaXVzID0gYm9yZGVyUmFkaXVzO1xuXHRcdHNjcm9sbEVsZW1lbnQuc3R5bGUuY29sb3IgPSBmZ0NvbG9yO1xuXHRcdHNjcm9sbEVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYmdDb2xvcjtcblx0XHRzY3JvbGxFbGVtZW50LnN0eWxlLmJveFNoYWRvdyA9IHNoYWRvdztcblx0fVxuXG5cdG92ZXJyaWRlIGdldENvbnRhaW5lcigpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0RG9tTm9kZSgpO1xuXHR9XG5cblx0Z2V0IG9uU2Nyb2xsKCk6IEV2ZW50PFNjcm9sbEV2ZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQub25TY3JvbGw7XG5cdH1cblxuXHRnZXQgc2Nyb2xsT2Zmc2V0KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubWVudUVsZW1lbnQuc2Nyb2xsVG9wO1xuXHR9XG5cblx0dHJpZ2dlcihpbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKGluZGV4IDw9IHRoaXMudmlld0l0ZW1zLmxlbmd0aCAmJiBpbmRleCA+PSAwKSB7XG5cdFx0XHRjb25zdCBpdGVtID0gdGhpcy52aWV3SXRlbXNbaW5kZXhdO1xuXHRcdFx0aWYgKGl0ZW0gaW5zdGFuY2VvZiBTdWJtZW51TWVudUFjdGlvblZpZXdJdGVtKSB7XG5cdFx0XHRcdHN1cGVyLmZvY3VzKGluZGV4KTtcblx0XHRcdFx0aXRlbS5vcGVuKHRydWUpO1xuXHRcdFx0fSBlbHNlIGlmIChpdGVtIGluc3RhbmNlb2YgQmFzZU1lbnVBY3Rpb25WaWV3SXRlbSkge1xuXHRcdFx0XHRzdXBlci5ydW4oaXRlbS5fYWN0aW9uLCBpdGVtLl9jb250ZXh0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzSXRlbUJ5RWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IGxhc3RGb2N1c2VkSXRlbSA9IHRoaXMuZm9jdXNlZEl0ZW07XG5cdFx0dGhpcy5zZXRGb2N1c2VkSXRlbShlbGVtZW50KTtcblxuXHRcdGlmIChsYXN0Rm9jdXNlZEl0ZW0gIT09IHRoaXMuZm9jdXNlZEl0ZW0pIHtcblx0XHRcdHRoaXMudXBkYXRlRm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldEZvY3VzZWRJdGVtKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFjdGlvbnNMaXN0LmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBlbGVtID0gdGhpcy5hY3Rpb25zTGlzdC5jaGlsZHJlbltpXTtcblx0XHRcdGlmIChlbGVtZW50ID09PSBlbGVtKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXNlZEl0ZW0gPSBpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlRm9jdXMoZnJvbVJpZ2h0PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHN1cGVyLnVwZGF0ZUZvY3VzKGZyb21SaWdodCwgdHJ1ZSwgdHJ1ZSk7XG5cblx0XHRpZiAodHlwZW9mIHRoaXMuZm9jdXNlZEl0ZW0gIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHQvLyBXb3JrYXJvdW5kIGZvciAjODAwNDcgY2F1c2VkIGJ5IGFuIGlzc3VlIGluIGNocm9taXVtXG5cdFx0XHQvLyBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD00MTQyODNcblx0XHRcdC8vIFdoZW4gdGhhdCdzIGZpeGVkLCBqdXN0IGNhbGwgdGhpcy5zY3JvbGxhYmxlRWxlbWVudC5zY2FuRG9tTm9kZSgpXG5cdFx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbFBvc2l0aW9uKHtcblx0XHRcdFx0c2Nyb2xsVG9wOiBNYXRoLnJvdW5kKHRoaXMubWVudUVsZW1lbnQuc2Nyb2xsVG9wKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkb0dldEFjdGlvblZpZXdJdGVtKGFjdGlvbjogSUFjdGlvbiwgb3B0aW9uczogSU1lbnVPcHRpb25zLCBwYXJlbnREYXRhOiBJU3ViTWVudURhdGEpOiBCYXNlQWN0aW9uVmlld0l0ZW0ge1xuXHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBTZXBhcmF0b3IpIHtcblx0XHRcdHJldHVybiBuZXcgTWVudVNlcGFyYXRvckFjdGlvblZpZXdJdGVtKG9wdGlvbnMuY29udGV4dCwgYWN0aW9uLCB7IGljb246IHRydWUgfSwgdGhpcy5tZW51U3R5bGVzKTtcblx0XHR9IGVsc2UgaWYgKGFjdGlvbiBpbnN0YW5jZW9mIFN1Ym1lbnVBY3Rpb24pIHtcblx0XHRcdGNvbnN0IG1lbnVBY3Rpb25WaWV3SXRlbSA9IG5ldyBTdWJtZW51TWVudUFjdGlvblZpZXdJdGVtKGFjdGlvbiwgYWN0aW9uLmFjdGlvbnMsIHBhcmVudERhdGEsIHsgLi4ub3B0aW9ucywgc3VibWVudUlkczogbmV3IFNldChbLi4uKG9wdGlvbnMuc3VibWVudUlkcyB8fCBbXSksIGFjdGlvbi5pZF0pIH0sIHRoaXMubWVudVN0eWxlcyk7XG5cblx0XHRcdGlmIChvcHRpb25zLmVuYWJsZU1uZW1vbmljcykge1xuXHRcdFx0XHRjb25zdCBtbmVtb25pYyA9IG1lbnVBY3Rpb25WaWV3SXRlbS5nZXRNbmVtb25pYygpO1xuXHRcdFx0XHRpZiAobW5lbW9uaWMgJiYgbWVudUFjdGlvblZpZXdJdGVtLmlzRW5hYmxlZCgpKSB7XG5cdFx0XHRcdFx0bGV0IGFjdGlvblZpZXdJdGVtczogQmFzZU1lbnVBY3Rpb25WaWV3SXRlbVtdID0gW107XG5cdFx0XHRcdFx0aWYgKHRoaXMubW5lbW9uaWNzLmhhcyhtbmVtb25pYykpIHtcblx0XHRcdFx0XHRcdGFjdGlvblZpZXdJdGVtcyA9IHRoaXMubW5lbW9uaWNzLmdldChtbmVtb25pYykhO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGFjdGlvblZpZXdJdGVtcy5wdXNoKG1lbnVBY3Rpb25WaWV3SXRlbSk7XG5cblx0XHRcdFx0XHR0aGlzLm1uZW1vbmljcy5zZXQobW5lbW9uaWMsIGFjdGlvblZpZXdJdGVtcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG1lbnVBY3Rpb25WaWV3SXRlbTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbWVudUl0ZW1PcHRpb25zOiBJTWVudUl0ZW1PcHRpb25zID0geyBlbmFibGVNbmVtb25pY3M6IG9wdGlvbnMuZW5hYmxlTW5lbW9uaWNzLCB1c2VFdmVudEFzQ29udGV4dDogb3B0aW9ucy51c2VFdmVudEFzQ29udGV4dCB9O1xuXHRcdFx0aWYgKG9wdGlvbnMuZ2V0S2V5QmluZGluZykge1xuXHRcdFx0XHRjb25zdCBrZXliaW5kaW5nID0gb3B0aW9ucy5nZXRLZXlCaW5kaW5nKGFjdGlvbik7XG5cdFx0XHRcdGlmIChrZXliaW5kaW5nKSB7XG5cdFx0XHRcdFx0Y29uc3Qga2V5YmluZGluZ0xhYmVsID0ga2V5YmluZGluZy5nZXRMYWJlbCgpO1xuXG5cdFx0XHRcdFx0aWYgKGtleWJpbmRpbmdMYWJlbCkge1xuXHRcdFx0XHRcdFx0bWVudUl0ZW1PcHRpb25zLmtleWJpbmRpbmcgPSBrZXliaW5kaW5nTGFiZWw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1lbnVBY3Rpb25WaWV3SXRlbSA9IG5ldyBCYXNlTWVudUFjdGlvblZpZXdJdGVtKG9wdGlvbnMuY29udGV4dCwgYWN0aW9uLCBtZW51SXRlbU9wdGlvbnMsIHRoaXMubWVudVN0eWxlcyk7XG5cblx0XHRcdGlmIChvcHRpb25zLmVuYWJsZU1uZW1vbmljcykge1xuXHRcdFx0XHRjb25zdCBtbmVtb25pYyA9IG1lbnVBY3Rpb25WaWV3SXRlbS5nZXRNbmVtb25pYygpO1xuXHRcdFx0XHRpZiAobW5lbW9uaWMgJiYgbWVudUFjdGlvblZpZXdJdGVtLmlzRW5hYmxlZCgpKSB7XG5cdFx0XHRcdFx0bGV0IGFjdGlvblZpZXdJdGVtczogQmFzZU1lbnVBY3Rpb25WaWV3SXRlbVtdID0gW107XG5cdFx0XHRcdFx0aWYgKHRoaXMubW5lbW9uaWNzLmhhcyhtbmVtb25pYykpIHtcblx0XHRcdFx0XHRcdGFjdGlvblZpZXdJdGVtcyA9IHRoaXMubW5lbW9uaWNzLmdldChtbmVtb25pYykhO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGFjdGlvblZpZXdJdGVtcy5wdXNoKG1lbnVBY3Rpb25WaWV3SXRlbSk7XG5cblx0XHRcdFx0XHR0aGlzLm1uZW1vbmljcy5zZXQobW5lbW9uaWMsIGFjdGlvblZpZXdJdGVtcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG1lbnVBY3Rpb25WaWV3SXRlbTtcblx0XHR9XG5cdH1cbn1cblxuaW50ZXJmYWNlIElNZW51SXRlbU9wdGlvbnMgZXh0ZW5kcyBJQWN0aW9uVmlld0l0ZW1PcHRpb25zIHtcblx0ZW5hYmxlTW5lbW9uaWNzPzogYm9vbGVhbjtcbn1cblxuY2xhc3MgQmFzZU1lbnVBY3Rpb25WaWV3SXRlbSBleHRlbmRzIEJhc2VBY3Rpb25WaWV3SXRlbSB7XG5cblx0cHVibGljIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIG9wdGlvbnM6IElNZW51SXRlbU9wdGlvbnM7XG5cdHByb3RlY3RlZCBpdGVtOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJ1bk9uY2VUb0VuYWJsZU1vdXNlVXA6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cdHByaXZhdGUgbGFiZWw6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNoZWNrOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBtbmVtb25pYzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNzc0NsYXNzOiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IoY3R4OiB1bmtub3duLCBhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElNZW51SXRlbU9wdGlvbnMsIHByb3RlY3RlZCByZWFkb25seSBtZW51U3R5bGU6IElNZW51U3R5bGVzKSB7XG5cdFx0b3B0aW9ucy5pc01lbnUgPSB0cnVlO1xuXHRcdHN1cGVyKGFjdGlvbiwgYWN0aW9uLCBvcHRpb25zKTtcblxuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0dGhpcy5vcHRpb25zLmljb24gPSBvcHRpb25zLmljb24gIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuaWNvbiA6IGZhbHNlO1xuXHRcdHRoaXMub3B0aW9ucy5sYWJlbCA9IG9wdGlvbnMubGFiZWwgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubGFiZWwgOiB0cnVlO1xuXHRcdHRoaXMuY3NzQ2xhc3MgPSAnJztcblxuXHRcdC8vIFNldCBtbmVtb25pY1xuXHRcdGlmICh0aGlzLm9wdGlvbnMubGFiZWwgJiYgb3B0aW9ucy5lbmFibGVNbmVtb25pY3MpIHtcblx0XHRcdGNvbnN0IGxhYmVsID0gdGhpcy5hY3Rpb24ubGFiZWw7XG5cdFx0XHRpZiAobGFiZWwpIHtcblx0XHRcdFx0Y29uc3QgbWF0Y2hlcyA9IE1FTlVfTU5FTU9OSUNfUkVHRVguZXhlYyhsYWJlbCk7XG5cdFx0XHRcdGlmIChtYXRjaGVzKSB7XG5cdFx0XHRcdFx0dGhpcy5tbmVtb25pYyA9ICghIW1hdGNoZXNbMV0gPyBtYXRjaGVzWzFdIDogbWF0Y2hlc1szXSkudG9Mb2NhbGVMb3dlckNhc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFkZCBtb3VzZSB1cCBsaXN0ZW5lciBsYXRlciB0byBhdm9pZCBhY2NpZGVudGFsIGNsaWNrc1xuXHRcdHRoaXMucnVuT25jZVRvRW5hYmxlTW91c2VVcCA9IG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdGlmICghdGhpcy5lbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZWxlbWVudCwgRXZlbnRUeXBlLk1PVVNFX1VQLCBlID0+IHtcblx0XHRcdFx0Ly8gcmVtb3ZlZCBkZWZhdWx0IHByZXZlbnRpb24gYXMgaXQgY29uZmxpY3RzXG5cdFx0XHRcdC8vIHdpdGggQmFzZUFjdGlvblZpZXdJdGVtICMxMDE1Mzdcblx0XHRcdFx0Ly8gYWRkIGJhY2sgaWYgaXNzdWVzIGFyaXNlIGFuZCBsaW5rIG5ldyBpc3N1ZVxuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXG5cdFx0XHRcdC8vIFNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9BZGQtb25zL1dlYkV4dGVuc2lvbnMvSW50ZXJhY3Rfd2l0aF90aGVfY2xpcGJvYXJkXG5cdFx0XHRcdC8vID4gV3JpdGluZyB0byB0aGUgY2xpcGJvYXJkXG5cdFx0XHRcdC8vID4gWW91IGNhbiB1c2UgdGhlIFwiY3V0XCIgYW5kIFwiY29weVwiIGNvbW1hbmRzIHdpdGhvdXQgYW55IHNwZWNpYWxcblx0XHRcdFx0Ly8gcGVybWlzc2lvbiBpZiB5b3UgYXJlIHVzaW5nIHRoZW0gaW4gYSBzaG9ydC1saXZlZCBldmVudCBoYW5kbGVyXG5cdFx0XHRcdC8vIGZvciBhIHVzZXIgYWN0aW9uIChmb3IgZXhhbXBsZSwgYSBjbGljayBoYW5kbGVyKS5cblxuXHRcdFx0XHQvLyA9PiB0byBnZXQgdGhlIENvcHkgYW5kIFBhc3RlIGNvbnRleHQgbWVudSBhY3Rpb25zIHdvcmtpbmcgb24gRmlyZWZveCxcblx0XHRcdFx0Ly8gdGhlcmUgc2hvdWxkIGJlIG5vIHRpbWVvdXQgaGVyZVxuXHRcdFx0XHRpZiAoaXNGaXJlZm94KSB7XG5cdFx0XHRcdFx0Y29uc3QgbW91c2VFdmVudCA9IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZ2V0V2luZG93KHRoaXMuZWxlbWVudCksIGUpO1xuXG5cdFx0XHRcdFx0Ly8gQWxsb3dpbmcgcmlnaHQgY2xpY2sgdG8gdHJpZ2dlciB0aGUgZXZlbnQgY2F1c2VzIHRoZSBpc3N1ZSBkZXNjcmliZWQgYmVsb3csXG5cdFx0XHRcdFx0Ly8gYnV0IHNpbmNlIHRoZSBzb2x1dGlvbiBiZWxvdyBkb2VzIG5vdCB3b3JrIGluIEZGLCB3ZSBtdXN0IGRpc2FibGUgcmlnaHQgY2xpY2tcblx0XHRcdFx0XHRpZiAobW91c2VFdmVudC5yaWdodEJ1dHRvbikge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMub25DbGljayhlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEluIGFsbCBvdGhlciBjYXNlcywgc2V0IHRpbWVvdXQgdG8gYWxsb3cgY29udGV4dCBtZW51IGNhbmNlbGxhdGlvbiB0byB0cmlnZ2VyXG5cdFx0XHRcdC8vIG90aGVyd2lzZSB0aGUgYWN0aW9uIHdpbGwgZGVzdHJveSB0aGUgbWVudSBhbmQgYSBzZWNvbmQgY29udGV4dCBtZW51XG5cdFx0XHRcdC8vIHdpbGwgc3RpbGwgdHJpZ2dlciBmb3IgcmlnaHQgY2xpY2suXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5vbkNsaWNrKGUpO1xuXHRcdFx0XHRcdH0sIDApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5DT05URVhUX01FTlUsIGUgPT4ge1xuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0fSkpO1xuXHRcdH0sIDEwMCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJ1bk9uY2VUb0VuYWJsZU1vdXNlVXApO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblxuXHRcdGlmICghdGhpcy5lbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG5cblx0XHR0aGlzLml0ZW0gPSBhcHBlbmQodGhpcy5lbGVtZW50LCAkKCdhLmFjdGlvbi1tZW51LWl0ZW0nKSk7XG5cdFx0aWYgKHRoaXMuX2FjdGlvbi5pZCA9PT0gU2VwYXJhdG9yLklEKSB7XG5cdFx0XHQvLyBBIHNlcGFyYXRvciBpcyBhIHByZXNlbnRhdGlvbiBpdGVtXG5cdFx0XHR0aGlzLml0ZW0uc2V0QXR0cmlidXRlKCdyb2xlJywgJ3ByZXNlbnRhdGlvbicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLml0ZW0uc2V0QXR0cmlidXRlKCdyb2xlJywgJ21lbnVpdGVtJyk7XG5cdFx0XHRpZiAodGhpcy5tbmVtb25pYykge1xuXHRcdFx0XHR0aGlzLml0ZW0uc2V0QXR0cmlidXRlKCdhcmlhLWtleXNob3J0Y3V0cycsIGAke3RoaXMubW5lbW9uaWN9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5jaGVjayA9IGFwcGVuZCh0aGlzLml0ZW0sICQoJ3NwYW4ubWVudS1pdGVtLWNoZWNrJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKENvZGljb24ubWVudVNlbGVjdGlvbikpKTtcblx0XHR0aGlzLmNoZWNrLnNldEF0dHJpYnV0ZSgncm9sZScsICdub25lJyk7XG5cblx0XHR0aGlzLmxhYmVsID0gYXBwZW5kKHRoaXMuaXRlbSwgJCgnc3Bhbi5hY3Rpb24tbGFiZWwnKSk7XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLmxhYmVsICYmIHRoaXMub3B0aW9ucy5rZXliaW5kaW5nKSB7XG5cdFx0XHRhcHBlbmQodGhpcy5pdGVtLCAkKCdzcGFuLmtleWJpbmRpbmcnKSkudGV4dENvbnRlbnQgPSB0aGlzLm9wdGlvbnMua2V5YmluZGluZztcblx0XHR9XG5cblx0XHQvLyBBZGRzIG1vdXNlIHVwIGxpc3RlbmVyIHRvIGFjdHVhbGx5IHJ1biB0aGUgYWN0aW9uXG5cdFx0dGhpcy5ydW5PbmNlVG9FbmFibGVNb3VzZVVwLnNjaGVkdWxlKCk7XG5cblx0XHR0aGlzLnVwZGF0ZUNsYXNzKCk7XG5cdFx0dGhpcy51cGRhdGVMYWJlbCgpO1xuXHRcdHRoaXMudXBkYXRlVG9vbHRpcCgpO1xuXHRcdHRoaXMudXBkYXRlRW5hYmxlZCgpO1xuXHRcdHRoaXMudXBkYXRlQ2hlY2tlZCgpO1xuXG5cdFx0dGhpcy5hcHBseVN0eWxlKCk7XG5cdH1cblxuXHRvdmVycmlkZSBibHVyKCk6IHZvaWQge1xuXHRcdHN1cGVyLmJsdXIoKTtcblx0XHR0aGlzLmFwcGx5U3R5bGUoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cblx0XHR0aGlzLml0ZW0/LmZvY3VzKCk7XG5cblx0XHR0aGlzLmFwcGx5U3R5bGUoKTtcblx0fVxuXG5cdHVwZGF0ZVBvc2l0aW9uSW5TZXQocG9zOiBudW1iZXIsIHNldFNpemU6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLml0ZW0pIHtcblx0XHRcdHRoaXMuaXRlbS5zZXRBdHRyaWJ1dGUoJ2FyaWEtcG9zaW5zZXQnLCBgJHtwb3N9YCk7XG5cdFx0XHR0aGlzLml0ZW0uc2V0QXR0cmlidXRlKCdhcmlhLXNldHNpemUnLCBgJHtzZXRTaXplfWApO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVMYWJlbCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubGFiZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5vcHRpb25zLmxhYmVsKSB7XG5cdFx0XHRjbGVhck5vZGUodGhpcy5sYWJlbCk7XG5cblx0XHRcdGxldCBsYWJlbCA9IHN0cmlwSWNvbnModGhpcy5hY3Rpb24ubGFiZWwpO1xuXHRcdFx0aWYgKGxhYmVsKSB7XG5cdFx0XHRcdGNvbnN0IGNsZWFuTGFiZWwgPSBjbGVhbk1uZW1vbmljKGxhYmVsKTtcblx0XHRcdFx0aWYgKCF0aGlzLm9wdGlvbnMuZW5hYmxlTW5lbW9uaWNzKSB7XG5cdFx0XHRcdFx0bGFiZWwgPSBjbGVhbkxhYmVsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5sYWJlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBjbGVhbkxhYmVsLnJlcGxhY2UoLyYmL2csICcmJykpO1xuXG5cdFx0XHRcdGNvbnN0IG1hdGNoZXMgPSBNRU5VX01ORU1PTklDX1JFR0VYLmV4ZWMobGFiZWwpO1xuXG5cdFx0XHRcdGlmIChtYXRjaGVzKSB7XG5cdFx0XHRcdFx0bGFiZWwgPSBzdHJpbmdzLmVzY2FwZShsYWJlbCk7XG5cblx0XHRcdFx0XHQvLyBUaGlzIGlzIGdsb2JhbCwgcmVzZXQgaXRcblx0XHRcdFx0XHRNRU5VX0VTQ0FQRURfTU5FTU9OSUNfUkVHRVgubGFzdEluZGV4ID0gMDtcblx0XHRcdFx0XHRsZXQgZXNjTWF0Y2ggPSBNRU5VX0VTQ0FQRURfTU5FTU9OSUNfUkVHRVguZXhlYyhsYWJlbCk7XG5cblx0XHRcdFx0XHQvLyBXZSBjYW4ndCB1c2UgbmVnYXRpdmUgbG9va2JlaGluZCBzbyBpZiB3ZSBtYXRjaCBvdXIgbmVnYXRpdmUgYW5kIHNraXBcblx0XHRcdFx0XHR3aGlsZSAoZXNjTWF0Y2ggJiYgZXNjTWF0Y2hbMV0pIHtcblx0XHRcdFx0XHRcdGVzY01hdGNoID0gTUVOVV9FU0NBUEVEX01ORU1PTklDX1JFR0VYLmV4ZWMobGFiZWwpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHJlcGxhY2VEb3VibGVFc2NhcGVzID0gKHN0cjogc3RyaW5nKSA9PiBzdHIucmVwbGFjZSgvJmFtcDsmYW1wOy9nLCAnJmFtcDsnKTtcblxuXHRcdFx0XHRcdGlmIChlc2NNYXRjaCkge1xuXHRcdFx0XHRcdFx0dGhpcy5sYWJlbC5hcHBlbmQoXG5cdFx0XHRcdFx0XHRcdHN0cmluZ3MubHRyaW0ocmVwbGFjZURvdWJsZUVzY2FwZXMobGFiZWwuc3Vic3RyKDAsIGVzY01hdGNoLmluZGV4KSksICcgJyksXG5cdFx0XHRcdFx0XHRcdCQoJ3UnLCB7ICdhcmlhLWhpZGRlbic6ICd0cnVlJyB9LFxuXHRcdFx0XHRcdFx0XHRcdGVzY01hdGNoWzNdKSxcblx0XHRcdFx0XHRcdFx0c3RyaW5ncy5ydHJpbShyZXBsYWNlRG91YmxlRXNjYXBlcyhsYWJlbC5zdWJzdHIoZXNjTWF0Y2guaW5kZXggKyBlc2NNYXRjaFswXS5sZW5ndGgpKSwgJyAnKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMubGFiZWwuaW5uZXJUZXh0ID0gcmVwbGFjZURvdWJsZUVzY2FwZXMobGFiZWwpLnRyaW0oKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLml0ZW0/LnNldEF0dHJpYnV0ZSgnYXJpYS1rZXlzaG9ydGN1dHMnLCAoISFtYXRjaGVzWzFdID8gbWF0Y2hlc1sxXSA6IG1hdGNoZXNbM10pLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMubGFiZWwuaW5uZXJUZXh0ID0gbGFiZWwucmVwbGFjZSgvJiYvZywgJyYnKS50cmltKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlVG9vbHRpcCgpOiB2b2lkIHtcblx0XHQvLyBtZW51cyBzaG91bGQgZnVuY3Rpb24gbGlrZSBuYXRpdmUgbWVudXMgYW5kIHRoZXkgZG8gbm90IGhhdmUgdG9vbHRpcHNcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVDbGFzcygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jc3NDbGFzcyAmJiB0aGlzLml0ZW0pIHtcblx0XHRcdHRoaXMuaXRlbS5jbGFzc0xpc3QucmVtb3ZlKC4uLnRoaXMuY3NzQ2xhc3Muc3BsaXQoJyAnKSk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLm9wdGlvbnMuaWNvbiAmJiB0aGlzLmxhYmVsKSB7XG5cdFx0XHR0aGlzLmNzc0NsYXNzID0gdGhpcy5hY3Rpb24uY2xhc3MgfHwgJyc7XG5cdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5hZGQoJ2ljb24nKTtcblx0XHRcdGlmICh0aGlzLmNzc0NsYXNzKSB7XG5cdFx0XHRcdHRoaXMubGFiZWwuY2xhc3NMaXN0LmFkZCguLi50aGlzLmNzc0NsYXNzLnNwbGl0KCcgJykpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGVFbmFibGVkKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmxhYmVsKSB7XG5cdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5yZW1vdmUoJ2ljb24nKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlRW5hYmxlZCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5hY3Rpb24uZW5hYmxlZCkge1xuXHRcdFx0aWYgKHRoaXMuZWxlbWVudCkge1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZGlzYWJsZWQnKTtcblx0XHRcdFx0dGhpcy5lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5pdGVtKSB7XG5cdFx0XHRcdHRoaXMuaXRlbS5jbGFzc0xpc3QucmVtb3ZlKCdkaXNhYmxlZCcpO1xuXHRcdFx0XHR0aGlzLml0ZW0ucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyk7XG5cdFx0XHRcdHRoaXMuaXRlbS50YWJJbmRleCA9IDA7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLmVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2Rpc2FibGVkJyk7XG5cdFx0XHRcdHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5pdGVtKSB7XG5cdFx0XHRcdHRoaXMuaXRlbS5jbGFzc0xpc3QuYWRkKCdkaXNhYmxlZCcpO1xuXHRcdFx0XHR0aGlzLml0ZW0uc2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJywgJ3RydWUnKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlQ2hlY2tlZCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaXRlbSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNoZWNrZWQgPSB0aGlzLmFjdGlvbi5jaGVja2VkO1xuXHRcdHRoaXMuaXRlbS5jbGFzc0xpc3QudG9nZ2xlKCdjaGVja2VkJywgISFjaGVja2VkKTtcblx0XHRpZiAoY2hlY2tlZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLml0ZW0uc2V0QXR0cmlidXRlKCdyb2xlJywgJ21lbnVpdGVtY2hlY2tib3gnKTtcblx0XHRcdHRoaXMuaXRlbS5zZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcsIGNoZWNrZWQgPyAndHJ1ZScgOiAnZmFsc2UnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5pdGVtLnNldEF0dHJpYnV0ZSgncm9sZScsICdtZW51aXRlbScpO1xuXHRcdFx0dGhpcy5pdGVtLnNldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJywgJycpO1xuXHRcdH1cblx0fVxuXG5cdGdldE1uZW1vbmljKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMubW5lbW9uaWM7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXBwbHlTdHlsZSgpOiB2b2lkIHtcblx0XHRjb25zdCBpc1NlbGVjdGVkID0gdGhpcy5lbGVtZW50ICYmIHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ2ZvY3VzZWQnKTtcblx0XHRjb25zdCBmZ0NvbG9yID0gaXNTZWxlY3RlZCAmJiB0aGlzLm1lbnVTdHlsZS5zZWxlY3Rpb25Gb3JlZ3JvdW5kQ29sb3IgPyB0aGlzLm1lbnVTdHlsZS5zZWxlY3Rpb25Gb3JlZ3JvdW5kQ29sb3IgOiB0aGlzLm1lbnVTdHlsZS5mb3JlZ3JvdW5kQ29sb3I7XG5cdFx0Y29uc3QgYmdDb2xvciA9IGlzU2VsZWN0ZWQgJiYgdGhpcy5tZW51U3R5bGUuc2VsZWN0aW9uQmFja2dyb3VuZENvbG9yID8gdGhpcy5tZW51U3R5bGUuc2VsZWN0aW9uQmFja2dyb3VuZENvbG9yIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG91dGxpbmUgPSBpc1NlbGVjdGVkICYmIHRoaXMubWVudVN0eWxlLnNlbGVjdGlvbkJvcmRlckNvbG9yID8gYDFweCBzb2xpZCAke3RoaXMubWVudVN0eWxlLnNlbGVjdGlvbkJvcmRlckNvbG9yfWAgOiAnJztcblx0XHRjb25zdCBvdXRsaW5lT2Zmc2V0ID0gaXNTZWxlY3RlZCAmJiB0aGlzLm1lbnVTdHlsZS5zZWxlY3Rpb25Cb3JkZXJDb2xvciA/IGAtMXB4YCA6ICcnO1xuXG5cdFx0aWYgKHRoaXMuaXRlbSkge1xuXHRcdFx0dGhpcy5pdGVtLnN0eWxlLmNvbG9yID0gZmdDb2xvciA/PyAnJztcblx0XHRcdHRoaXMuaXRlbS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBiZ0NvbG9yID8/ICcnO1xuXHRcdFx0dGhpcy5pdGVtLnN0eWxlLm91dGxpbmUgPSBvdXRsaW5lO1xuXHRcdFx0dGhpcy5pdGVtLnN0eWxlLm91dGxpbmVPZmZzZXQgPSBvdXRsaW5lT2Zmc2V0O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKSB7XG5cdFx0XHR0aGlzLmNoZWNrLnN0eWxlLmNvbG9yID0gZmdDb2xvciA/PyAnJztcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgU3VibWVudU1lbnVBY3Rpb25WaWV3SXRlbSBleHRlbmRzIEJhc2VNZW51QWN0aW9uVmlld0l0ZW0ge1xuXHRwcml2YXRlIG15c3VibWVudTogTWVudSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHN1Ym1lbnVDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHN1Ym1lbnVJbmRpY2F0b3I6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IHN1Ym1lbnVEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgbW91c2VPdmVyOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgc2hvd1NjaGVkdWxlcjogUnVuT25jZVNjaGVkdWxlcjtcblx0cHJpdmF0ZSBoaWRlU2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIGV4cGFuZERpcmVjdGlvbjogSU1lbnVEaXJlY3Rpb247XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0YWN0aW9uOiBJQWN0aW9uLFxuXHRcdHByaXZhdGUgc3VibWVudUFjdGlvbnM6IFJlYWRvbmx5QXJyYXk8SUFjdGlvbj4sXG5cdFx0cHJpdmF0ZSBwYXJlbnREYXRhOiBJU3ViTWVudURhdGEsXG5cdFx0cHJpdmF0ZSBzdWJtZW51T3B0aW9uczogSU1lbnVPcHRpb25zLFxuXHRcdG1lbnVTdHlsZXM6IElNZW51U3R5bGVzXG5cdCkge1xuXHRcdHN1cGVyKGFjdGlvbiwgYWN0aW9uLCBzdWJtZW51T3B0aW9ucywgbWVudVN0eWxlcyk7XG5cblx0XHR0aGlzLmV4cGFuZERpcmVjdGlvbiA9IHN1Ym1lbnVPcHRpb25zICYmIHN1Ym1lbnVPcHRpb25zLmV4cGFuZERpcmVjdGlvbiAhPT0gdW5kZWZpbmVkID8gc3VibWVudU9wdGlvbnMuZXhwYW5kRGlyZWN0aW9uIDogeyBob3Jpem9udGFsOiBIb3Jpem9udGFsRGlyZWN0aW9uLlJpZ2h0LCB2ZXJ0aWNhbDogVmVydGljYWxEaXJlY3Rpb24uQmVsb3cgfTtcblxuXHRcdHRoaXMuc2hvd1NjaGVkdWxlciA9IG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLm1vdXNlT3Zlcikge1xuXHRcdFx0XHR0aGlzLmNsZWFudXBFeGlzdGluZ1N1Ym1lbnUoZmFsc2UpO1xuXHRcdFx0XHR0aGlzLmNyZWF0ZVN1Ym1lbnUoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0sIDI1MCk7XG5cblx0XHR0aGlzLmhpZGVTY2hlZHVsZXIgPSBuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5lbGVtZW50ICYmICghaXNBbmNlc3RvcihnZXRBY3RpdmVFbGVtZW50KCksIHRoaXMuZWxlbWVudCkgJiYgdGhpcy5wYXJlbnREYXRhLnN1Ym1lbnUgPT09IHRoaXMubXlzdWJtZW51KSkge1xuXHRcdFx0XHR0aGlzLnBhcmVudERhdGEucGFyZW50LmZvY3VzKGZhbHNlKTtcblx0XHRcdFx0dGhpcy5jbGVhbnVwRXhpc3RpbmdTdWJtZW51KHRydWUpO1xuXHRcdFx0fVxuXHRcdH0sIDc1MCk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlcihjb250YWluZXIpO1xuXG5cdFx0aWYgKCF0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pdGVtKSB7XG5cdFx0XHR0aGlzLml0ZW0uY2xhc3NMaXN0LmFkZCgnbW9uYWNvLXN1Ym1lbnUtaXRlbScpO1xuXHRcdFx0dGhpcy5pdGVtLnRhYkluZGV4ID0gMDtcblx0XHRcdHRoaXMuaXRlbS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGFzcG9wdXAnLCAndHJ1ZScpO1xuXHRcdFx0dGhpcy51cGRhdGVBcmlhRXhwYW5kZWQoJ2ZhbHNlJyk7XG5cdFx0XHR0aGlzLnN1Ym1lbnVJbmRpY2F0b3IgPSBhcHBlbmQodGhpcy5pdGVtLCAkKCdzcGFuLnN1Ym1lbnUtaW5kaWNhdG9yJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKENvZGljb24ubWVudVN1Ym1lbnUpKSk7XG5cdFx0XHR0aGlzLnN1Ym1lbnVJbmRpY2F0b3Iuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZWxlbWVudCwgRXZlbnRUeXBlLktFWV9VUCwgZSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuUmlnaHRBcnJvdykgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuRW50ZXIpKSB7XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7XG5cblx0XHRcdFx0dGhpcy5jcmVhdGVTdWJtZW51KHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5LRVlfRE9XTiwgZSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cblx0XHRcdGlmIChnZXRBY3RpdmVFbGVtZW50KCkgPT09IHRoaXMuaXRlbSkge1xuXHRcdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuUmlnaHRBcnJvdykgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuRW50ZXIpKSB7XG5cdFx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5NT1VTRV9PVkVSLCBlID0+IHtcblx0XHRcdGlmICghdGhpcy5tb3VzZU92ZXIpIHtcblx0XHRcdFx0dGhpcy5tb3VzZU92ZXIgPSB0cnVlO1xuXG5cdFx0XHRcdHRoaXMuc2hvd1NjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5NT1VTRV9MRUFWRSwgZSA9PiB7XG5cdFx0XHR0aGlzLm1vdXNlT3ZlciA9IGZhbHNlO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5GT0NVU19PVVQsIGUgPT4ge1xuXHRcdFx0aWYgKHRoaXMuZWxlbWVudCAmJiAhaXNBbmNlc3RvcihnZXRBY3RpdmVFbGVtZW50KCksIHRoaXMuZWxlbWVudCkpIHtcblx0XHRcdFx0dGhpcy5oaWRlU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5wYXJlbnREYXRhLnBhcmVudC5vblNjcm9sbCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5wYXJlbnREYXRhLnN1Ym1lbnUgPT09IHRoaXMubXlzdWJtZW51KSB7XG5cdFx0XHRcdHRoaXMucGFyZW50RGF0YS5wYXJlbnQuZm9jdXMoZmFsc2UpO1xuXHRcdFx0XHR0aGlzLmNsZWFudXBFeGlzdGluZ1N1Ym1lbnUodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUVuYWJsZWQoKTogdm9pZCB7XG5cdFx0Ly8gb3ZlcnJpZGUgb24gc3VibWVudSBlbnRyeVxuXHRcdC8vIG5hdGl2ZSBtZW51cyBkbyBub3Qgb2JzZXJ2ZSBlbmFibGVtZW50IG9uIHN1bWJlbnVzXG5cdFx0Ly8gd2UgbWltaWMgdGhhdCBiZWhhdmlvclxuXHR9XG5cblx0b3BlbihzZWxlY3RGaXJzdD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmNsZWFudXBFeGlzdGluZ1N1Ym1lbnUoZmFsc2UpO1xuXHRcdHRoaXMuY3JlYXRlU3VibWVudShzZWxlY3RGaXJzdCk7XG5cdH1cblxuXHRvdmVycmlkZSBvbkNsaWNrKGU6IEV2ZW50TGlrZSk6IHZvaWQge1xuXHRcdC8vIHN0b3AgY2xpY2tpbmcgZnJvbSB0cnlpbmcgdG8gcnVuIGFuIGFjdGlvblxuXHRcdEV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7XG5cblx0XHR0aGlzLmNsZWFudXBFeGlzdGluZ1N1Ym1lbnUoZmFsc2UpO1xuXHRcdHRoaXMuY3JlYXRlU3VibWVudSh0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYW51cEV4aXN0aW5nU3VibWVudShmb3JjZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLnBhcmVudERhdGEuc3VibWVudSAmJiAoZm9yY2UgfHwgKHRoaXMucGFyZW50RGF0YS5zdWJtZW51ICE9PSB0aGlzLm15c3VibWVudSkpKSB7XG5cblx0XHRcdC8vIGRpc3Bvc2FsIG1heSB0aHJvdyBpZiB0aGUgc3VibWVudSBoYXMgYWxyZWFkeSBiZWVuIHJlbW92ZWRcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMucGFyZW50RGF0YS5zdWJtZW51LmRpc3Bvc2UoKTtcblx0XHRcdH0gY2F0Y2ggeyB9XG5cblx0XHRcdHRoaXMucGFyZW50RGF0YS5zdWJtZW51ID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy51cGRhdGVBcmlhRXhwYW5kZWQoJ2ZhbHNlJyk7XG5cdFx0XHRpZiAodGhpcy5zdWJtZW51Q29udGFpbmVyKSB7XG5cdFx0XHRcdHRoaXMuc3VibWVudURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMuc3VibWVudUNvbnRhaW5lciA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNhbGN1bGF0ZVN1Ym1lbnVNZW51TGF5b3V0KHdpbmRvd0RpbWVuc2lvbnM6IERpbWVuc2lvbiwgc3VibWVudTogRGltZW5zaW9uLCBlbnRyeTogSURvbU5vZGVQYWdlUG9zaXRpb24sIGV4cGFuZERpcmVjdGlvbjogSU1lbnVEaXJlY3Rpb24pOiB7IHRvcDogbnVtYmVyOyBsZWZ0OiBudW1iZXIgfSB7XG5cdFx0Y29uc3QgcmV0ID0geyB0b3A6IDAsIGxlZnQ6IDAgfTtcblxuXHRcdC8vIFN0YXJ0IHdpdGggaG9yaXpvbnRhbFxuXHRcdHJldC5sZWZ0ID0gbGF5b3V0KHdpbmRvd0RpbWVuc2lvbnMud2lkdGgsIHN1Ym1lbnUud2lkdGgsIHsgcG9zaXRpb246IGV4cGFuZERpcmVjdGlvbi5ob3Jpem9udGFsID09PSBIb3Jpem9udGFsRGlyZWN0aW9uLlJpZ2h0ID8gTGF5b3V0QW5jaG9yUG9zaXRpb24uQmVmb3JlIDogTGF5b3V0QW5jaG9yUG9zaXRpb24uQWZ0ZXIsIG9mZnNldDogZW50cnkubGVmdCwgc2l6ZTogZW50cnkud2lkdGggfSk7XG5cblx0XHQvLyBXZSBkb24ndCBoYXZlIGVub3VnaCByb29tIHRvIGxheW91dCB0aGUgbWVudSBmdWxseSwgc28gd2UgYXJlIG92ZXJsYXBwaW5nIHRoZSBtZW51XG5cdFx0aWYgKHJldC5sZWZ0ID49IGVudHJ5LmxlZnQgJiYgcmV0LmxlZnQgPCBlbnRyeS5sZWZ0ICsgZW50cnkud2lkdGgpIHtcblx0XHRcdGlmIChlbnRyeS5sZWZ0ICsgMTAgKyBzdWJtZW51LndpZHRoIDw9IHdpbmRvd0RpbWVuc2lvbnMud2lkdGgpIHtcblx0XHRcdFx0cmV0LmxlZnQgPSBlbnRyeS5sZWZ0ICsgMTA7XG5cdFx0XHR9XG5cblx0XHRcdGVudHJ5LnRvcCArPSAxMDtcblx0XHRcdGVudHJ5LmhlaWdodCA9IDA7XG5cdFx0fVxuXG5cdFx0Ly8gTm93IHRoYXQgd2UgaGF2ZSBhIGhvcml6b250YWwgcG9zaXRpb24sIHRyeSBsYXlvdXQgdmVydGljYWxseVxuXHRcdHJldC50b3AgPSBsYXlvdXQod2luZG93RGltZW5zaW9ucy5oZWlnaHQsIHN1Ym1lbnUuaGVpZ2h0LCB7IHBvc2l0aW9uOiBMYXlvdXRBbmNob3JQb3NpdGlvbi5CZWZvcmUsIG9mZnNldDogZW50cnkudG9wLCBzaXplOiAwIH0pO1xuXG5cdFx0Ly8gV2UgZGlkbid0IGhhdmUgZW5vdWdoIHJvb20gYmVsb3csIGJ1dCB3ZSBkaWQgYWJvdmUsIHNvIHdlIHNoaWZ0IGRvd24gdG8gYWxpZ24gdGhlIG1lbnVcblx0XHRpZiAocmV0LnRvcCArIHN1Ym1lbnUuaGVpZ2h0ID09PSBlbnRyeS50b3AgJiYgcmV0LnRvcCArIGVudHJ5LmhlaWdodCArIHN1Ym1lbnUuaGVpZ2h0IDw9IHdpbmRvd0RpbWVuc2lvbnMuaGVpZ2h0KSB7XG5cdFx0XHRyZXQudG9wICs9IGVudHJ5LmhlaWdodDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVTdWJtZW51KHNlbGVjdEZpcnN0SXRlbSA9IHRydWUpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5wYXJlbnREYXRhLnN1Ym1lbnUpIHtcblx0XHRcdHRoaXMudXBkYXRlQXJpYUV4cGFuZGVkKCd0cnVlJyk7XG5cdFx0XHR0aGlzLnN1Ym1lbnVDb250YWluZXIgPSBhcHBlbmQodGhpcy5lbGVtZW50LCAkKCdkaXYubW9uYWNvLXN1Ym1lbnUnKSk7XG5cdFx0XHR0aGlzLnN1Ym1lbnVDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbWVudWJhci1tZW51LWl0ZW1zLWhvbGRlcicsICdjb250ZXh0LXZpZXcnKTtcblxuXHRcdFx0Ly8gU2V0IHRoZSB0b3AgdmFsdWUgb2YgdGhlIG1lbnUgY29udGFpbmVyIGJlZm9yZSBjb25zdHJ1Y3Rpb25cblx0XHRcdC8vIFRoaXMgYWxsb3dzIHRoZSBtZW51IGNvbnN0cnVjdG9yIHRvIGNhbGN1bGF0ZSB0aGUgcHJvcGVyIG1heCBoZWlnaHRcblx0XHRcdGNvbnN0IGNvbXB1dGVkU3R5bGVzID0gZ2V0V2luZG93KHRoaXMucGFyZW50RGF0YS5wYXJlbnQuZG9tTm9kZSkuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLnBhcmVudERhdGEucGFyZW50LmRvbU5vZGUpO1xuXHRcdFx0Y29uc3QgcGFkZGluZ1RvcCA9IHBhcnNlRmxvYXQoY29tcHV0ZWRTdHlsZXMucGFkZGluZ1RvcCB8fCAnMCcpIHx8IDA7XG5cdFx0XHR0aGlzLnN1Ym1lbnVDb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAnZml4ZWQnO1xuXHRcdFx0dGhpcy5zdWJtZW51Q29udGFpbmVyLnN0eWxlLnRvcCA9ICcwJztcblx0XHRcdHRoaXMuc3VibWVudUNvbnRhaW5lci5zdHlsZS5sZWZ0ID0gJzAnO1xuXG5cdFx0XHR0aGlzLnBhcmVudERhdGEuc3VibWVudSA9IG5ldyBNZW51KHRoaXMuc3VibWVudUNvbnRhaW5lciwgdGhpcy5zdWJtZW51QWN0aW9ucy5sZW5ndGggPyB0aGlzLnN1Ym1lbnVBY3Rpb25zIDogW25ldyBFbXB0eVN1Ym1lbnVBY3Rpb24oKV0sIHRoaXMuc3VibWVudU9wdGlvbnMsIHRoaXMubWVudVN0eWxlKTtcblxuXHRcdFx0Ly8gbGF5b3V0IHN1Ym1lbnVcblx0XHRcdGNvbnN0IGVudHJ5Qm94ID0gdGhpcy5lbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0Y29uc3QgZW50cnlCb3hVcGRhdGVkID0ge1xuXHRcdFx0XHR0b3A6IGVudHJ5Qm94LnRvcCAtIHBhZGRpbmdUb3AsXG5cdFx0XHRcdGxlZnQ6IGVudHJ5Qm94LmxlZnQsXG5cdFx0XHRcdGhlaWdodDogZW50cnlCb3guaGVpZ2h0ICsgMiAqIHBhZGRpbmdUb3AsXG5cdFx0XHRcdHdpZHRoOiBlbnRyeUJveC53aWR0aFxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3Qgdmlld0JveCA9IHRoaXMuc3VibWVudUNvbnRhaW5lci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuXHRcdFx0Y29uc3Qgd2luZG93ID0gZ2V0V2luZG93KHRoaXMuZWxlbWVudCk7XG5cdFx0XHRjb25zdCB7IHRvcCwgbGVmdCB9ID0gdGhpcy5jYWxjdWxhdGVTdWJtZW51TWVudUxheW91dChuZXcgRGltZW5zaW9uKHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQpLCBEaW1lbnNpb24ubGlmdCh2aWV3Qm94KSwgZW50cnlCb3hVcGRhdGVkLCB0aGlzLmV4cGFuZERpcmVjdGlvbik7XG5cdFx0XHQvLyBzdWJ0cmFjdCBvZmZzZXRzIGNhdXNlZCBieSB0cmFuc2Zvcm0gcGFyZW50XG5cdFx0XHR0aGlzLnN1Ym1lbnVDb250YWluZXIuc3R5bGUubGVmdCA9IGAke2xlZnQgLSB2aWV3Qm94LmxlZnR9cHhgO1xuXHRcdFx0dGhpcy5zdWJtZW51Q29udGFpbmVyLnN0eWxlLnRvcCA9IGAke3RvcCAtIHZpZXdCb3gudG9wfXB4YDtcblxuXHRcdFx0dGhpcy5zdWJtZW51RGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnN1Ym1lbnVDb250YWluZXIsIEV2ZW50VHlwZS5LRVlfVVAsIGUgPT4ge1xuXHRcdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRcdGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5MZWZ0QXJyb3cpKSB7XG5cdFx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblxuXHRcdFx0XHRcdHRoaXMucGFyZW50RGF0YS5wYXJlbnQuZm9jdXMoKTtcblxuXHRcdFx0XHRcdHRoaXMuY2xlYW51cEV4aXN0aW5nU3VibWVudSh0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLnN1Ym1lbnVEaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuc3VibWVudUNvbnRhaW5lciwgRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuTGVmdEFycm93KSkge1xuXHRcdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXG5cdFx0XHR0aGlzLnN1Ym1lbnVEaXNwb3NhYmxlcy5hZGQodGhpcy5wYXJlbnREYXRhLnN1Ym1lbnUub25EaWRDYW5jZWwoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnBhcmVudERhdGEucGFyZW50LmZvY3VzKCk7XG5cblx0XHRcdFx0dGhpcy5jbGVhbnVwRXhpc3RpbmdTdWJtZW51KHRydWUpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLnBhcmVudERhdGEuc3VibWVudS5mb2N1cyhzZWxlY3RGaXJzdEl0ZW0pO1xuXG5cdFx0XHR0aGlzLm15c3VibWVudSA9IHRoaXMucGFyZW50RGF0YS5zdWJtZW51O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnBhcmVudERhdGEuc3VibWVudS5mb2N1cyhmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVBcmlhRXhwYW5kZWQodmFsdWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLml0ZW0pIHtcblx0XHRcdHRoaXMuaXRlbT8uc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgdmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhcHBseVN0eWxlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmFwcGx5U3R5bGUoKTtcblxuXHRcdGNvbnN0IGlzU2VsZWN0ZWQgPSB0aGlzLmVsZW1lbnQgJiYgdGhpcy5lbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnZm9jdXNlZCcpO1xuXHRcdGNvbnN0IGZnQ29sb3IgPSBpc1NlbGVjdGVkICYmIHRoaXMubWVudVN0eWxlLnNlbGVjdGlvbkZvcmVncm91bmRDb2xvciA/IHRoaXMubWVudVN0eWxlLnNlbGVjdGlvbkZvcmVncm91bmRDb2xvciA6IHRoaXMubWVudVN0eWxlLmZvcmVncm91bmRDb2xvcjtcblxuXHRcdGlmICh0aGlzLnN1Ym1lbnVJbmRpY2F0b3IpIHtcblx0XHRcdHRoaXMuc3VibWVudUluZGljYXRvci5zdHlsZS5jb2xvciA9IGZnQ29sb3IgPz8gJyc7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLmhpZGVTY2hlZHVsZXIuZGlzcG9zZSgpO1xuXG5cdFx0aWYgKHRoaXMubXlzdWJtZW51KSB7XG5cdFx0XHR0aGlzLm15c3VibWVudS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLm15c3VibWVudSA9IG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc3VibWVudUNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5zdWJtZW51Q29udGFpbmVyID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBNZW51U2VwYXJhdG9yQWN0aW9uVmlld0l0ZW0gZXh0ZW5kcyBBY3Rpb25WaWV3SXRlbSB7XG5cdGNvbnN0cnVjdG9yKGNvbnRleHQ6IHVua25vd24sIGFjdGlvbjogSUFjdGlvbiwgb3B0aW9uczogSUFjdGlvblZpZXdJdGVtT3B0aW9ucywgcHJpdmF0ZSByZWFkb25seSBtZW51U3R5bGVzOiBJTWVudVN0eWxlcykge1xuXHRcdHN1cGVyKGNvbnRleHQsIGFjdGlvbiwgb3B0aW9ucyk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlcihjb250YWluZXIpO1xuXHRcdGlmICh0aGlzLmxhYmVsKSB7XG5cdFx0XHR0aGlzLmxhYmVsLnN0eWxlLmJvcmRlckJvdHRvbUNvbG9yID0gdGhpcy5tZW51U3R5bGVzLnNlcGFyYXRvckNvbG9yID8gYCR7dGhpcy5tZW51U3R5bGVzLnNlcGFyYXRvckNvbG9yfWAgOiAnJztcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsZWFuTW5lbW9uaWMobGFiZWw6IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IHJlZ2V4ID0gTUVOVV9NTkVNT05JQ19SRUdFWDtcblxuXHRjb25zdCBtYXRjaGVzID0gcmVnZXguZXhlYyhsYWJlbCk7XG5cdGlmICghbWF0Y2hlcykge1xuXHRcdHJldHVybiBsYWJlbDtcblx0fVxuXG5cdGNvbnN0IG1uZW1vbmljSW5UZXh0ID0gIW1hdGNoZXNbMV07XG5cblx0cmV0dXJuIGxhYmVsLnJlcGxhY2UocmVnZXgsIG1uZW1vbmljSW5UZXh0ID8gJyQyJDMnIDogJycpLnRyaW0oKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFJ1bGUoYzogVGhlbWVJY29uKSB7XG5cdGNvbnN0IGZvbnRDaGFyYWN0ZXIgPSBnZXRDb2RpY29uRm9udENoYXJhY3RlcnMoKVtjLmlkXTtcblx0cmV0dXJuIGAuY29kaWNvbi0ke2MuaWR9OmJlZm9yZSB7IGNvbnRlbnQ6ICdcXFxcJHtmb250Q2hhcmFjdGVyLnRvU3RyaW5nKDE2KX0nOyB9YDtcbn1cblxuZnVuY3Rpb24gZ2V0TWVudVdpZGdldENTUyhzdHlsZTogSU1lbnVTdHlsZXMsIGlzRm9yU2hhZG93RG9tOiBib29sZWFuKTogc3RyaW5nIHtcblx0bGV0IHJlc3VsdCA9IC8qIGNzcyAqL2Bcbi5tb25hY28tbWVudSB7XG5cdGZvbnQtc2l6ZTogMTNweDtcblx0Ym9yZGVyLXJhZGl1czogNXB4O1xuXHRtaW4td2lkdGg6IDE2MHB4O1xufVxuXG4ke2Zvcm1hdFJ1bGUoQ29kaWNvbi5tZW51U2VsZWN0aW9uKX1cbiR7Zm9ybWF0UnVsZShDb2RpY29uLm1lbnVTdWJtZW51KX1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhciB7XG5cdHRleHQtYWxpZ246IHJpZ2h0O1xuXHRvdmVyZmxvdzogaGlkZGVuO1xuXHR3aGl0ZS1zcGFjZTogbm93cmFwO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb25zLWNvbnRhaW5lciB7XG5cdGRpc3BsYXk6IGZsZXg7XG5cdG1hcmdpbjogMCBhdXRvO1xuXHRwYWRkaW5nOiAwO1xuXHR3aWR0aDogMTAwJTtcblx0anVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9ucy1jb250YWluZXIge1xuXHRkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG59XG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIucmV2ZXJzZSAuYWN0aW9ucy1jb250YWluZXIge1xuXHRmbGV4LWRpcmVjdGlvbjogcm93LXJldmVyc2U7XG59XG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1pdGVtIHtcblx0Y3Vyc29yOiBwb2ludGVyO1xuXHRkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG5cdHRyYW5zaXRpb246IHRyYW5zZm9ybSA1MG1zIGVhc2U7XG5cdHBvc2l0aW9uOiByZWxhdGl2ZTsgIC8qIERPIE5PVCBSRU1PVkUgLSB0aGlzIGlzIHRoZSBrZXkgdG8gcHJldmVudGluZyB0aGUgZ2hvc3RpbmcgaWNvbiBidWcgaW4gQ2hyb21lIDQyICovXG59XG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1pdGVtLmRpc2FibGVkIHtcblx0Y3Vyc29yOiBkZWZhdWx0O1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbSAuaWNvbixcbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1pdGVtIC5jb2RpY29uIHtcblx0ZGlzcGxheTogaW5saW5lLWJsb2NrO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbSAuY29kaWNvbiB7XG5cdGRpc3BsYXk6IGZsZXg7XG5cdGFsaWduLWl0ZW1zOiBjZW50ZXI7XG59XG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1sYWJlbCB7XG5cdGZvbnQtc2l6ZTogMTFweDtcblx0bWFyZ2luLXJpZ2h0OiA0cHg7XG59XG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1pdGVtLmRpc2FibGVkIC5hY3Rpb24tbGFiZWwsXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24taXRlbS5kaXNhYmxlZCAuYWN0aW9uLWxhYmVsOmhvdmVyIHtcblx0Y29sb3I6IHZhcigtLXZzY29kZS1kaXNhYmxlZEZvcmVncm91bmQpO1xufVxuXG4vKiBWZXJ0aWNhbCBhY3Rpb25zICovXG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwge1xuXHR0ZXh0LWFsaWduOiBsZWZ0O1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24taXRlbSB7XG5cdGRpc3BsYXk6IGJsb2NrO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24tbGFiZWwuc2VwYXJhdG9yIHtcblx0ZGlzcGxheTogYmxvY2s7XG5cdGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS12c2NvZGUtbWVudS1zZXBhcmF0b3JCYWNrZ3JvdW5kKTtcblx0cGFkZGluZy10b3A6IDFweDtcblx0cGFkZGluZzogMzBweDtcbn1cblxuLm1vbmFjby1tZW51IC5zZWNvbmRhcnktYWN0aW9ucyAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1sYWJlbCB7XG5cdG1hcmdpbi1sZWZ0OiA2cHg7XG59XG5cbi8qIEFjdGlvbiBJdGVtcyAqL1xuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhciAuYWN0aW9uLWl0ZW0uc2VsZWN0LWNvbnRhaW5lciB7XG5cdG92ZXJmbG93OiBoaWRkZW47IC8qIHNvbWVob3cgdGhlIGRyb3Bkb3duIG92ZXJmbG93cyBpdHMgY29udGFpbmVyLCB3ZSBwcmV2ZW50IGl0IGhlcmUgdG8gbm90IHB1c2ggKi9cblx0ZmxleDogMTtcblx0bWF4LXdpZHRoOiAxNzBweDtcblx0bWluLXdpZHRoOiA2MHB4O1xuXHRkaXNwbGF5OiBmbGV4O1xuXHRhbGlnbi1pdGVtczogY2VudGVyO1xuXHRqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcblx0bWFyZ2luLXJpZ2h0OiAxMHB4O1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIHtcblx0bWFyZ2luLWxlZnQ6IDA7XG5cdG92ZXJmbG93OiB2aXNpYmxlO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb25zLWNvbnRhaW5lciB7XG5cdGRpc3BsYXk6IGJsb2NrO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24taXRlbSB7XG5cdHBhZGRpbmc6IDA7XG5cdHRyYW5zZm9ybTogbm9uZTtcblx0ZGlzcGxheTogZmxleDtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLWl0ZW0uYWN0aXZlIHtcblx0dHJhbnNmb3JtOiBub25lO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24tbWVudS1pdGVtIHtcblx0ZmxleDogMSAxIGF1dG87XG5cdGRpc3BsYXk6IGZsZXg7XG5cdGhlaWdodDogMmVtO1xuXHRhbGlnbi1pdGVtczogY2VudGVyO1xuXHRwb3NpdGlvbjogcmVsYXRpdmU7XG5cdG1hcmdpbjogMCA0cHg7XG5cdGJvcmRlci1yYWRpdXM6IDRweDtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLW1lbnUtaXRlbTpob3ZlciAua2V5YmluZGluZyxcbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwgLmFjdGlvbi1tZW51LWl0ZW06Zm9jdXMgLmtleWJpbmRpbmcge1xuXHRvcGFjaXR5OiB1bnNldDtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLWxhYmVsIHtcblx0ZmxleDogMSAxIGF1dG87XG5cdHRleHQtZGVjb3JhdGlvbjogbm9uZTtcblx0cGFkZGluZzogMCAxZW07XG5cdGJhY2tncm91bmQ6IG5vbmU7XG5cdGZvbnQtc2l6ZTogMTJweDtcblx0bGluZS1oZWlnaHQ6IDE7XG59XG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwgLmtleWJpbmRpbmcsXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5zdWJtZW51LWluZGljYXRvciB7XG5cdGRpc3BsYXk6IGlubGluZS1ibG9jaztcblx0ZmxleDogMiAxIGF1dG87XG5cdHBhZGRpbmc6IDAgMWVtO1xuXHR0ZXh0LWFsaWduOiByaWdodDtcblx0Zm9udC1zaXplOiAxMnB4O1xuXHRsaW5lLWhlaWdodDogMTtcblx0b3BhY2l0eTogMC43O1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5zdWJtZW51LWluZGljYXRvciB7XG5cdGhlaWdodDogMTAwJTtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuc3VibWVudS1pbmRpY2F0b3IuY29kaWNvbiB7XG5cdGZvbnQtc2l6ZTogMTZweCAhaW1wb3J0YW50O1xuXHRkaXNwbGF5OiBmbGV4O1xuXHRhbGlnbi1pdGVtczogY2VudGVyO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5zdWJtZW51LWluZGljYXRvci5jb2RpY29uOjpiZWZvcmUge1xuXHRtYXJnaW4tbGVmdDogYXV0bztcblx0bWFyZ2luLXJpZ2h0OiAtMjBweDtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLWl0ZW0uZGlzYWJsZWQgLmtleWJpbmRpbmcsXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24taXRlbS5kaXNhYmxlZCAuc3VibWVudS1pbmRpY2F0b3Ige1xuXHRvcGFjaXR5OiAwLjQ7XG59XG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwgLmFjdGlvbi1sYWJlbDpub3QoLnNlcGFyYXRvcikge1xuXHRkaXNwbGF5OiBpbmxpbmUtYmxvY2s7XG5cdGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG5cdG1hcmdpbjogMDtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLWl0ZW0ge1xuXHRwb3NpdGlvbjogc3RhdGljO1xuXHRvdmVyZmxvdzogdmlzaWJsZTtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLWl0ZW0gLm1vbmFjby1zdWJtZW51IHtcblx0cG9zaXRpb246IGFic29sdXRlO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24tbGFiZWwuc2VwYXJhdG9yIHtcblx0d2lkdGg6IDEwMCU7XG5cdGhlaWdodDogMHB4ICFpbXBvcnRhbnQ7XG5cdG9wYWNpdHk6IDE7XG59XG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwgLmFjdGlvbi1sYWJlbC5zZXBhcmF0b3IudGV4dCB7XG5cdHBhZGRpbmc6IDAuN2VtIDFlbSAwLjFlbSAxZW07XG5cdGZvbnQtd2VpZ2h0OiBib2xkO1xuXHRvcGFjaXR5OiAxO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24tbGFiZWw6aG92ZXIge1xuXHRjb2xvcjogaW5oZXJpdDtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAubWVudS1pdGVtLWNoZWNrIHtcblx0cG9zaXRpb246IGFic29sdXRlO1xuXHR2aXNpYmlsaXR5OiBoaWRkZW47XG5cdHdpZHRoOiAxZW07XG5cdGhlaWdodDogMTAwJTtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLW1lbnUtaXRlbS5jaGVja2VkIC5tZW51LWl0ZW0tY2hlY2sge1xuXHR2aXNpYmlsaXR5OiB2aXNpYmxlO1xuXHRkaXNwbGF5OiBmbGV4O1xuXHRhbGlnbi1pdGVtczogY2VudGVyO1xuXHRqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbn1cblxuLyogQ29udGV4dCBNZW51ICovXG5cbi5jb250ZXh0LXZpZXcubW9uYWNvLW1lbnUtY29udGFpbmVyIHtcblx0b3V0bGluZTogMDtcblx0Ym9yZGVyOiBub25lO1xuXHRhbmltYXRpb246IGZhZGVJbiAwLjA4M3MgbGluZWFyO1xuXHQtd2Via2l0LWFwcC1yZWdpb246IG5vLWRyYWc7XG59XG5cbi5jb250ZXh0LXZpZXcubW9uYWNvLW1lbnUtY29udGFpbmVyIDpmb2N1cyxcbi5jb250ZXh0LXZpZXcubW9uYWNvLW1lbnUtY29udGFpbmVyIC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbDpmb2N1cyxcbi5jb250ZXh0LXZpZXcubW9uYWNvLW1lbnUtY29udGFpbmVyIC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCA6Zm9jdXMge1xuXHRvdXRsaW5lOiAwO1xufVxuXG4uaGMtYmxhY2sgLmNvbnRleHQtdmlldy5tb25hY28tbWVudS1jb250YWluZXIsXG4uaGMtbGlnaHQgLmNvbnRleHQtdmlldy5tb25hY28tbWVudS1jb250YWluZXIsXG46aG9zdC1jb250ZXh0KC5oYy1ibGFjaykgLmNvbnRleHQtdmlldy5tb25hY28tbWVudS1jb250YWluZXIsXG46aG9zdC1jb250ZXh0KC5oYy1saWdodCkgLmNvbnRleHQtdmlldy5tb25hY28tbWVudS1jb250YWluZXIge1xuXHRib3gtc2hhZG93OiBub25lO1xufVxuXG4uaGMtYmxhY2sgLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLWl0ZW0uZm9jdXNlZCxcbi5oYy1saWdodCAubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24taXRlbS5mb2N1c2VkLFxuOmhvc3QtY29udGV4dCguaGMtYmxhY2spIC5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwgLmFjdGlvbi1pdGVtLmZvY3VzZWQsXG46aG9zdC1jb250ZXh0KC5oYy1saWdodCkgLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLWl0ZW0uZm9jdXNlZCB7XG5cdGJhY2tncm91bmQ6IG5vbmU7XG59XG5cbi8qIFZlcnRpY2FsIEFjdGlvbiBCYXIgU3R5bGVzICovXG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwge1xuXHRwYWRkaW5nOiA0cHggMDtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLW1lbnUtaXRlbSB7XG5cdGhlaWdodDogMmVtO1xufVxuXG4ubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24tbGFiZWw6bm90KC5zZXBhcmF0b3IpLFxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAua2V5YmluZGluZyB7XG5cdGZvbnQtc2l6ZTogaW5oZXJpdDtcblx0cGFkZGluZzogMCAyZW07XG5cdG1heC1oZWlnaHQ6IDEwMCU7XG59XG5cbi5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwgLm1lbnUtaXRlbS1jaGVjayB7XG5cdGZvbnQtc2l6ZTogaW5oZXJpdDtcblx0d2lkdGg6IDJlbTtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLWxhYmVsLnNlcGFyYXRvciB7XG5cdGZvbnQtc2l6ZTogaW5oZXJpdDtcblx0bWFyZ2luOiA1cHggMCAhaW1wb3J0YW50O1xuXHRwYWRkaW5nOiAwO1xuXHRib3JkZXItcmFkaXVzOiAwO1xufVxuXG4ubGludXggLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuYWN0aW9uLWxhYmVsLnNlcGFyYXRvcixcbjpob3N0LWNvbnRleHQoLmxpbnV4KSAubW9uYWNvLW1lbnUgLm1vbmFjby1hY3Rpb24tYmFyLnZlcnRpY2FsIC5hY3Rpb24tbGFiZWwuc2VwYXJhdG9yIHtcblx0bWFyZ2luLWxlZnQ6IDA7XG5cdG1hcmdpbi1yaWdodDogMDtcbn1cblxuLm1vbmFjby1tZW51IC5tb25hY28tYWN0aW9uLWJhci52ZXJ0aWNhbCAuc3VibWVudS1pbmRpY2F0b3Ige1xuXHRmb250LXNpemU6IDYwJTtcblx0cGFkZGluZzogMCAxLjhlbTtcbn1cblxuLmxpbnV4IC5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwgLnN1Ym1lbnUtaW5kaWNhdG9yLFxuOmhvc3QtY29udGV4dCgubGludXgpIC5tb25hY28tbWVudSAubW9uYWNvLWFjdGlvbi1iYXIudmVydGljYWwgLnN1Ym1lbnUtaW5kaWNhdG9yIHtcblx0aGVpZ2h0OiAxMDAlO1xuXHRtYXNrLXNpemU6IDEwcHggMTBweDtcblx0LXdlYmtpdC1tYXNrLXNpemU6IDEwcHggMTBweDtcbn1cblxuLm1vbmFjby1tZW51IC5hY3Rpb24taXRlbSB7XG5cdGN1cnNvcjogZGVmYXVsdDtcbn1gO1xuXG5cdGlmIChpc0ZvclNoYWRvd0RvbSkge1xuXHRcdC8vIE9ubHkgZGVmaW5lIHNjcm9sbGJhciBzdHlsZXMgd2hlbiB1c2VkIGluc2lkZSBzaGFkb3cgZG9tLFxuXHRcdC8vIG90aGVyd2lzZSBsZWF2ZSB0aGVpciBzdHlsaW5nIHRvIHRoZSBnbG9iYWwgd29ya2JlbmNoIHN0eWxpbmcuXG5cdFx0cmVzdWx0ICs9IGBcblx0XHRcdC8qIEFycm93cyAqL1xuXHRcdFx0Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAuc2Nyb2xsYmFyID4gLnNjcmEge1xuXHRcdFx0XHRjdXJzb3I6IHBvaW50ZXI7XG5cdFx0XHRcdGZvbnQtc2l6ZTogMTFweCAhaW1wb3J0YW50O1xuXHRcdFx0fVxuXG5cdFx0XHQubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC52aXNpYmxlIHtcblx0XHRcdFx0b3BhY2l0eTogMTtcblxuXHRcdFx0XHQvKiBCYWNrZ3JvdW5kIHJ1bGUgYWRkZWQgZm9yIElFOSAtIHRvIGFsbG93IGNsaWNrcyBvbiBkb20gbm9kZSAqL1xuXHRcdFx0XHRiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsMCk7XG5cblx0XHRcdFx0dHJhbnNpdGlvbjogb3BhY2l0eSAxMDBtcyBsaW5lYXI7XG5cdFx0XHR9XG5cdFx0XHQubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5pbnZpc2libGUge1xuXHRcdFx0XHRvcGFjaXR5OiAwO1xuXHRcdFx0XHRwb2ludGVyLWV2ZW50czogbm9uZTtcblx0XHRcdH1cblx0XHRcdC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLmludmlzaWJsZS5mYWRlIHtcblx0XHRcdFx0dHJhbnNpdGlvbjogb3BhY2l0eSA4MDBtcyBsaW5lYXI7XG5cdFx0XHR9XG5cblx0XHRcdC8qIFNjcm9sbGFibGUgQ29udGVudCBJbnNldCBTaGFkb3cgKi9cblx0XHRcdC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLnNoYWRvdyB7XG5cdFx0XHRcdHBvc2l0aW9uOiBhYnNvbHV0ZTtcblx0XHRcdFx0ZGlzcGxheTogbm9uZTtcblx0XHRcdH1cblx0XHRcdC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLnNoYWRvdy50b3Age1xuXHRcdFx0XHRkaXNwbGF5OiBibG9jaztcblx0XHRcdFx0dG9wOiAwO1xuXHRcdFx0XHRsZWZ0OiAzcHg7XG5cdFx0XHRcdGhlaWdodDogM3B4O1xuXHRcdFx0XHR3aWR0aDogMTAwJTtcblx0XHRcdH1cblx0XHRcdC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLnNoYWRvdy5sZWZ0IHtcblx0XHRcdFx0ZGlzcGxheTogYmxvY2s7XG5cdFx0XHRcdHRvcDogM3B4O1xuXHRcdFx0XHRsZWZ0OiAwO1xuXHRcdFx0XHRoZWlnaHQ6IDEwMCU7XG5cdFx0XHRcdHdpZHRoOiAzcHg7XG5cdFx0XHR9XG5cdFx0XHQubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5zaGFkb3cudG9wLWxlZnQtY29ybmVyIHtcblx0XHRcdFx0ZGlzcGxheTogYmxvY2s7XG5cdFx0XHRcdHRvcDogMDtcblx0XHRcdFx0bGVmdDogMDtcblx0XHRcdFx0aGVpZ2h0OiAzcHg7XG5cdFx0XHRcdHdpZHRoOiAzcHg7XG5cdFx0XHR9XG5cdFx0XHQvKiBGaXggZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDMxNzAgKi9cblx0XHRcdC5tb25hY28tbWVudSAuYWN0aW9uLWl0ZW0gLm1vbmFjby1zdWJtZW51IHtcblx0XHRcdFx0ei1pbmRleDogMTtcblx0XHRcdH1cblx0XHRgO1xuXG5cdFx0Ly8gU2Nyb2xsYmFyc1xuXHRcdGNvbnN0IHNjcm9sbGJhclNoYWRvd0NvbG9yID0gc3R5bGUuc2Nyb2xsYmFyU2hhZG93O1xuXHRcdGlmIChzY3JvbGxiYXJTaGFkb3dDb2xvcikge1xuXHRcdFx0cmVzdWx0ICs9IGBcblx0XHRcdFx0Lm1vbmFjby1zY3JvbGxhYmxlLWVsZW1lbnQgPiAuc2hhZG93LnRvcCB7XG5cdFx0XHRcdFx0Ym94LXNoYWRvdzogJHtzY3JvbGxiYXJTaGFkb3dDb2xvcn0gMCA2cHggNnB4IC02cHggaW5zZXQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5zaGFkb3cubGVmdCB7XG5cdFx0XHRcdFx0Ym94LXNoYWRvdzogJHtzY3JvbGxiYXJTaGFkb3dDb2xvcn0gNnB4IDAgNnB4IC02cHggaW5zZXQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5zaGFkb3cudG9wLmxlZnQge1xuXHRcdFx0XHRcdGJveC1zaGFkb3c6ICR7c2Nyb2xsYmFyU2hhZG93Q29sb3J9IDZweCA2cHggNnB4IC02cHggaW5zZXQ7XG5cdFx0XHRcdH1cblx0XHRcdGA7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Nyb2xsYmFyU2xpZGVyQmFja2dyb3VuZENvbG9yID0gc3R5bGUuc2Nyb2xsYmFyU2xpZGVyQmFja2dyb3VuZDtcblx0XHRpZiAoc2Nyb2xsYmFyU2xpZGVyQmFja2dyb3VuZENvbG9yKSB7XG5cdFx0XHRyZXN1bHQgKz0gYFxuXHRcdFx0XHQubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5zY3JvbGxiYXIgPiAuc2xpZGVyIHtcblx0XHRcdFx0XHRiYWNrZ3JvdW5kOiAke3Njcm9sbGJhclNsaWRlckJhY2tncm91bmRDb2xvcn07XG5cdFx0XHRcdH1cblx0XHRcdGA7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Nyb2xsYmFyU2xpZGVySG92ZXJCYWNrZ3JvdW5kQ29sb3IgPSBzdHlsZS5zY3JvbGxiYXJTbGlkZXJIb3ZlckJhY2tncm91bmQ7XG5cdFx0aWYgKHNjcm9sbGJhclNsaWRlckhvdmVyQmFja2dyb3VuZENvbG9yKSB7XG5cdFx0XHRyZXN1bHQgKz0gYFxuXHRcdFx0XHQubW9uYWNvLXNjcm9sbGFibGUtZWxlbWVudCA+IC5zY3JvbGxiYXIgPiAuc2xpZGVyOmhvdmVyIHtcblx0XHRcdFx0XHRiYWNrZ3JvdW5kOiAke3Njcm9sbGJhclNsaWRlckhvdmVyQmFja2dyb3VuZENvbG9yfTtcblx0XHRcdFx0fVxuXHRcdFx0YDtcblx0XHR9XG5cblx0XHRjb25zdCBzY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kQ29sb3IgPSBzdHlsZS5zY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kO1xuXHRcdGlmIChzY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kQ29sb3IpIHtcblx0XHRcdHJlc3VsdCArPSBgXG5cdFx0XHRcdC5tb25hY28tc2Nyb2xsYWJsZS1lbGVtZW50ID4gLnNjcm9sbGJhciA+IC5zbGlkZXIuYWN0aXZlIHtcblx0XHRcdFx0XHRiYWNrZ3JvdW5kOiAke3Njcm9sbGJhclNsaWRlckFjdGl2ZUJhY2tncm91bmRDb2xvcn07XG5cdFx0XHRcdH1cblx0XHRcdGA7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsYUFBYSxnQkFBZ0IsZUFBZTtBQUNyRCxTQUFTLEdBQUcsdUJBQXVCLFFBQVEsV0FBVyxXQUFXLGFBQXdCLFdBQVcsa0JBQWtCLFdBQWlDLFlBQVkscUJBQXFCO0FBQ3hMLFNBQVMs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QUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBK1JoQyxNQUFJLGdCQUFnQjtBQUduQixjQUFVO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQXdEVixVQUFNLHVCQUF1QixNQUFNO0FBQ25DLFFBQUksc0JBQXNCO0FBQ3pCLGdCQUFVO0FBQUE7QUFBQSxtQkFFTSxvQkFBb0I7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFJcEIsb0JBQW9CO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBSXBCLG9CQUFvQjtBQUFBO0FBQUE7QUFBQSxJQUdyQztBQUVBLFVBQU0saUNBQWlDLE1BQU07QUFDN0MsUUFBSSxnQ0FBZ0M7QUFDbkMsZ0JBQVU7QUFBQTtBQUFBLG1CQUVNLDhCQUE4QjtBQUFBO0FBQUE7QUFBQSxJQUcvQztBQUVBLFVBQU0sc0NBQXNDLE1BQU07QUFDbEQsUUFBSSxxQ0FBcUM7QUFDeEMsZ0JBQVU7QUFBQTtBQUFBLG1CQUVNLG1DQUFtQztBQUFBO0FBQUE7QUFBQSxJQUdwRDtBQUVBLFVBQU0sdUNBQXVDLE1BQU07QUFDbkQsUUFBSSxzQ0FBc0M7QUFDekMsZ0JBQVU7QUFBQTtBQUFBLG1CQUVNLG9DQUFvQztBQUFBO0FBQUE7QUFBQSxJQUdyRDtBQUFBLEVBQ0Q7QUFFQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbIkhvcml6b250YWxEaXJlY3Rpb24iLCAiVmVydGljYWxEaXJlY3Rpb24iLCAiYWN0aW9ucyJdCn0K
