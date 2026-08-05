import * as browser from "../../browser.js";
import * as DOM from "../../dom.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { StandardMouseEvent } from "../../mouseEvent.js";
import { EventType, Gesture } from "../../touch.js";
import { cleanMnemonic, HorizontalDirection, Menu, MENU_ESCAPED_MNEMONIC_REGEX, MENU_MNEMONIC_REGEX, VerticalDirection } from "./menu.js";
import { ActionRunner, Separator, SubmenuAction } from "../../../common/actions.js";
import { asArray } from "../../../common/arrays.js";
import { RunOnceScheduler } from "../../../common/async.js";
import { Codicon } from "../../../common/codicons.js";
import { ThemeIcon } from "../../../common/themables.js";
import { Emitter } from "../../../common/event.js";
import { KeyCode, KeyMod, ScanCode, ScanCodeUtils } from "../../../common/keyCodes.js";
import { Disposable, DisposableStore, dispose } from "../../../common/lifecycle.js";
import { isMacintosh } from "../../../common/platform.js";
import * as strings from "../../../common/strings.js";
import "./menubar.css";
import * as nls from "../../../../nls.js";
import { mainWindow } from "../../window.js";
const $ = DOM.$;
var MenubarState = /* @__PURE__ */ ((MenubarState2) => {
  MenubarState2[MenubarState2["HIDDEN"] = 0] = "HIDDEN";
  MenubarState2[MenubarState2["VISIBLE"] = 1] = "VISIBLE";
  MenubarState2[MenubarState2["FOCUSED"] = 2] = "FOCUSED";
  MenubarState2[MenubarState2["OPEN"] = 3] = "OPEN";
  return MenubarState2;
})(MenubarState || {});
const _MenuBar = class _MenuBar extends Disposable {
  constructor(container, options, menuStyle) {
    super();
    this.container = container;
    this.options = options;
    this.menuStyle = menuStyle;
    // Input-related
    this._mnemonicsInUse = false;
    this.openedViaKeyboard = false;
    this.awaitingAltRelease = false;
    this.ignoreNextMouseUp = false;
    this.updatePending = false;
    this.numMenusShown = 0;
    this.overflowLayoutScheduled = void 0;
    this.menuDisposables = this._register(new DisposableStore());
    this.container.setAttribute("role", "menubar");
    if (this.isCompact) {
      this.container.classList.add("compact");
    }
    this.menus = [];
    this.mnemonics = /* @__PURE__ */ new Map();
    this._focusState = 1 /* VISIBLE */;
    this._onVisibilityChange = this._register(new Emitter());
    this._onFocusStateChange = this._register(new Emitter());
    this.createOverflowMenu();
    this.menuUpdater = this._register(new RunOnceScheduler(() => this.update(), 200));
    this.actionRunner = this.options.actionRunner ?? this._register(new ActionRunner());
    this._register(this.actionRunner.onWillRun(() => {
      this.setUnfocusedState();
    }));
    this._register(DOM.ModifierKeyEmitter.getInstance().event(this.onModifierKeyToggled, this));
    this._register(DOM.addDisposableListener(this.container, DOM.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      let eventHandled = true;
      const key = !!e.key ? e.key.toLocaleLowerCase() : "";
      const tabNav = isMacintosh && !this.isCompact;
      if (event.equals(KeyCode.LeftArrow) || tabNav && event.equals(KeyCode.Tab | KeyMod.Shift)) {
        this.focusPrevious();
      } else if (event.equals(KeyCode.RightArrow) || tabNav && event.equals(KeyCode.Tab)) {
        this.focusNext();
      } else if (event.equals(KeyCode.Escape) && this.isFocused && !this.isOpen) {
        this.setUnfocusedState();
      } else if (!this.isOpen && !event.ctrlKey && this.options.enableMnemonics && this.mnemonicsInUse && this.mnemonics.has(key)) {
        const menuIndex = this.mnemonics.get(key);
        this.onMenuTriggered(menuIndex, false);
      } else {
        eventHandled = false;
      }
      if (!this.isCompact && (event.equals(KeyCode.Tab | KeyMod.Shift) || event.equals(KeyCode.Tab))) {
        event.preventDefault();
      }
      if (eventHandled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }));
    const window = DOM.getWindow(this.container);
    this._register(DOM.addDisposableListener(window, DOM.EventType.MOUSE_DOWN, () => {
      if (this.isFocused) {
        this.setUnfocusedState();
      }
    }));
    this._register(DOM.addDisposableListener(this.container, DOM.EventType.FOCUS_IN, (e) => {
      const event = e;
      if (event.relatedTarget) {
        if (!this.container.contains(event.relatedTarget)) {
          this.focusToReturn = event.relatedTarget;
        }
      }
    }));
    this._register(DOM.addDisposableListener(this.container, DOM.EventType.FOCUS_OUT, (e) => {
      const event = e;
      if (!event.relatedTarget) {
        this.setUnfocusedState();
      } else if (event.relatedTarget && !this.container.contains(event.relatedTarget)) {
        this.focusToReturn = void 0;
        this.setUnfocusedState();
      }
    }));
    this._register(DOM.addDisposableListener(window, DOM.EventType.KEY_DOWN, (e) => {
      if (!this.options.enableMnemonics || !e.altKey || e.ctrlKey || e.defaultPrevented) {
        return;
      }
      const key = e.key.toLocaleLowerCase();
      if (!this.mnemonics.has(key)) {
        return;
      }
      this.mnemonicsInUse = true;
      this.updateMnemonicVisibility(true);
      const menuIndex = this.mnemonics.get(key);
      this.onMenuTriggered(menuIndex, false);
    }));
    this.setUnfocusedState();
  }
  push(arg) {
    const menus = asArray(arg);
    menus.forEach((menuBarMenu) => {
      const menuIndex = this.menus.length;
      const cleanMenuLabel = cleanMnemonic(menuBarMenu.label);
      const mnemonicMatches = MENU_MNEMONIC_REGEX.exec(menuBarMenu.label);
      if (mnemonicMatches) {
        const mnemonic = !!mnemonicMatches[1] ? mnemonicMatches[1] : mnemonicMatches[3];
        this.registerMnemonic(this.menus.length, mnemonic);
      }
      if (this.isCompact) {
        this.menus.push(menuBarMenu);
      } else {
        const buttonElement = $("div.menubar-menu-button", { "role": "menuitem", "tabindex": -1, "aria-label": cleanMenuLabel, "aria-haspopup": true });
        const titleElement = $("div.menubar-menu-title", { "role": "none", "aria-hidden": true });
        buttonElement.appendChild(titleElement);
        this.container.insertBefore(buttonElement, this.overflowMenu.buttonElement);
        this.updateLabels(titleElement, buttonElement, menuBarMenu.label);
        this._register(DOM.addDisposableListener(buttonElement, DOM.EventType.KEY_UP, (e) => {
          const event = new StandardKeyboardEvent(e);
          let eventHandled = true;
          if ((event.equals(KeyCode.DownArrow) || event.equals(KeyCode.Enter)) && !this.isOpen) {
            this.focusedMenu = { index: menuIndex };
            this.openedViaKeyboard = true;
            this.focusState = 3 /* OPEN */;
          } else {
            eventHandled = false;
          }
          if (eventHandled) {
            event.preventDefault();
            event.stopPropagation();
          }
        }));
        this._register(Gesture.addTarget(buttonElement));
        this._register(DOM.addDisposableListener(buttonElement, EventType.Tap, (e) => {
          if (this.isOpen && this.focusedMenu && this.focusedMenu.holder && DOM.isAncestor(e.initialTarget, this.focusedMenu.holder)) {
            return;
          }
          this.ignoreNextMouseUp = false;
          this.onMenuTriggered(menuIndex, true);
          e.preventDefault();
          e.stopPropagation();
        }));
        this._register(DOM.addDisposableListener(buttonElement, DOM.EventType.MOUSE_DOWN, (e) => {
          const mouseEvent = new StandardMouseEvent(DOM.getWindow(buttonElement), e);
          if (!mouseEvent.leftButton) {
            e.preventDefault();
            return;
          }
          if (!this.isOpen) {
            this.ignoreNextMouseUp = true;
            this.onMenuTriggered(menuIndex, true);
          } else {
            this.ignoreNextMouseUp = false;
          }
          e.preventDefault();
          e.stopPropagation();
        }));
        this._register(DOM.addDisposableListener(buttonElement, DOM.EventType.MOUSE_UP, (e) => {
          if (e.defaultPrevented) {
            return;
          }
          if (!this.ignoreNextMouseUp) {
            if (this.isFocused) {
              this.onMenuTriggered(menuIndex, true);
            }
          } else {
            this.ignoreNextMouseUp = false;
          }
        }));
        this._register(DOM.addDisposableListener(buttonElement, DOM.EventType.MOUSE_ENTER, () => {
          if (this.isOpen && !this.isCurrentMenu(menuIndex)) {
            buttonElement.focus();
            this.cleanupCustomMenu();
            this.showCustomMenu(menuIndex, false);
          } else if (this.isFocused && !this.isOpen) {
            this.focusedMenu = { index: menuIndex };
            buttonElement.focus();
          }
        }));
        this.menus.push({
          label: menuBarMenu.label,
          actions: menuBarMenu.actions,
          buttonElement,
          titleElement
        });
      }
    });
  }
  createOverflowMenu() {
    const label = this.isCompact ? nls.localize("mAppMenu", "Application Menu") : nls.localize("mMore", "More");
    const buttonElement = $("div.menubar-menu-button", { "role": "menuitem", "tabindex": this.isCompact ? 0 : -1, "aria-label": label, "aria-haspopup": true });
    const titleElement = $("div.menubar-menu-title.toolbar-toggle-more" + ThemeIcon.asCSSSelector(Codicon.menuBarMore), { "role": "none", "aria-hidden": true });
    buttonElement.appendChild(titleElement);
    this.container.appendChild(buttonElement);
    buttonElement.style.visibility = "hidden";
    this._register(DOM.addDisposableListener(buttonElement, DOM.EventType.KEY_UP, (e) => {
      const event = new StandardKeyboardEvent(e);
      let eventHandled = true;
      const triggerKeys = [KeyCode.Enter];
      if (!this.isCompact) {
        triggerKeys.push(KeyCode.DownArrow);
      } else {
        triggerKeys.push(KeyCode.Space);
        if (this.options.compactMode?.horizontal === HorizontalDirection.Right) {
          triggerKeys.push(KeyCode.RightArrow);
        } else if (this.options.compactMode?.horizontal === HorizontalDirection.Left) {
          triggerKeys.push(KeyCode.LeftArrow);
        }
      }
      if (triggerKeys.some((k) => event.equals(k)) && !this.isOpen) {
        this.focusedMenu = { index: _MenuBar.OVERFLOW_INDEX };
        this.openedViaKeyboard = true;
        this.focusState = 3 /* OPEN */;
      } else {
        eventHandled = false;
      }
      if (eventHandled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }));
    this._register(Gesture.addTarget(buttonElement));
    this._register(DOM.addDisposableListener(buttonElement, EventType.Tap, (e) => {
      if (this.isOpen && this.focusedMenu && this.focusedMenu.holder && DOM.isAncestor(e.initialTarget, this.focusedMenu.holder)) {
        return;
      }
      this.ignoreNextMouseUp = false;
      this.onMenuTriggered(_MenuBar.OVERFLOW_INDEX, true);
      e.preventDefault();
      e.stopPropagation();
    }));
    this._register(DOM.addDisposableListener(buttonElement, DOM.EventType.MOUSE_DOWN, (e) => {
      const mouseEvent = new StandardMouseEvent(DOM.getWindow(buttonElement), e);
      if (!mouseEvent.leftButton) {
        e.preventDefault();
        return;
      }
      if (!this.isOpen) {
        this.ignoreNextMouseUp = true;
        this.onMenuTriggered(_MenuBar.OVERFLOW_INDEX, true);
      } else {
        this.ignoreNextMouseUp = false;
      }
      e.preventDefault();
      e.stopPropagation();
    }));
    this._register(DOM.addDisposableListener(buttonElement, DOM.EventType.MOUSE_UP, (e) => {
      if (e.defaultPrevented) {
        return;
      }
      if (!this.ignoreNextMouseUp) {
        if (this.isFocused) {
          this.onMenuTriggered(_MenuBar.OVERFLOW_INDEX, true);
        }
      } else {
        this.ignoreNextMouseUp = false;
      }
    }));
    this._register(DOM.addDisposableListener(buttonElement, DOM.EventType.MOUSE_ENTER, () => {
      if (this.isOpen && !this.isCurrentMenu(_MenuBar.OVERFLOW_INDEX)) {
        this.overflowMenu.buttonElement.focus();
        this.cleanupCustomMenu();
        this.showCustomMenu(_MenuBar.OVERFLOW_INDEX, false);
      } else if (this.isFocused && !this.isOpen) {
        this.focusedMenu = { index: _MenuBar.OVERFLOW_INDEX };
        buttonElement.focus();
      }
    }));
    this.overflowMenu = {
      buttonElement,
      titleElement,
      label: "More",
      actions: []
    };
  }
  updateMenu(menu) {
    const menuToUpdate = this.menus.filter((menuBarMenu) => menuBarMenu.label === menu.label);
    if (menuToUpdate && menuToUpdate.length) {
      menuToUpdate[0].actions = menu.actions;
    }
  }
  dispose() {
    super.dispose();
    this.menus.forEach((menuBarMenu) => {
      menuBarMenu.titleElement?.remove();
      menuBarMenu.buttonElement?.remove();
    });
    this.overflowMenu.titleElement.remove();
    this.overflowMenu.buttonElement.remove();
    dispose(this.overflowLayoutScheduled);
    this.overflowLayoutScheduled = void 0;
  }
  blur() {
    this.setUnfocusedState();
  }
  getWidth() {
    if (!this.isCompact && this.menus) {
      const left = this.menus[0].buttonElement.getBoundingClientRect().left;
      const right = this.hasOverflow ? this.overflowMenu.buttonElement.getBoundingClientRect().right : this.menus[this.menus.length - 1].buttonElement.getBoundingClientRect().right;
      return right - left;
    }
    return 0;
  }
  getHeight() {
    return this.container.clientHeight;
  }
  toggleFocus() {
    if (!this.isFocused && this.options.visibility !== "hidden") {
      this.mnemonicsInUse = true;
      this.focusedMenu = { index: this.numMenusShown > 0 ? 0 : _MenuBar.OVERFLOW_INDEX };
      this.focusState = 2 /* FOCUSED */;
    } else if (!this.isOpen) {
      this.setUnfocusedState();
    }
  }
  updateOverflowAction() {
    if (!this.menus || !this.menus.length) {
      return;
    }
    const overflowMenuOnlyClass = "overflow-menu-only";
    this.container.classList.toggle(overflowMenuOnlyClass, false);
    const sizeAvailable = this.container.offsetWidth;
    let currentSize = 0;
    let full = this.isCompact;
    const prevNumMenusShown = this.numMenusShown;
    this.numMenusShown = 0;
    const showableMenus = this.menus.filter((menu) => menu.buttonElement !== void 0 && menu.titleElement !== void 0);
    for (const menuBarMenu of showableMenus) {
      if (!full) {
        const size = menuBarMenu.buttonElement.offsetWidth;
        if (currentSize + size > sizeAvailable) {
          full = true;
        } else {
          currentSize += size;
          this.numMenusShown++;
          if (this.numMenusShown > prevNumMenusShown) {
            menuBarMenu.buttonElement.style.visibility = "visible";
          }
        }
      }
      if (full) {
        menuBarMenu.buttonElement.style.visibility = "hidden";
      }
    }
    if (this.numMenusShown - 1 <= showableMenus.length / 4) {
      for (const menuBarMenu of showableMenus) {
        menuBarMenu.buttonElement.style.visibility = "hidden";
      }
      full = true;
      this.numMenusShown = 0;
      currentSize = 0;
    }
    if (this.isCompact) {
      this.overflowMenu.actions = [];
      for (let idx = this.numMenusShown; idx < this.menus.length; idx++) {
        this.overflowMenu.actions.push(new SubmenuAction(`menubar.submenu.${this.menus[idx].label}`, this.menus[idx].label, this.menus[idx].actions || []));
      }
      const compactMenuActions = this.options.getCompactMenuActions?.();
      if (compactMenuActions && compactMenuActions.length) {
        this.overflowMenu.actions.push(new Separator());
        this.overflowMenu.actions.push(...compactMenuActions);
      }
      this.overflowMenu.buttonElement.style.visibility = "visible";
    } else if (full) {
      while (currentSize + this.overflowMenu.buttonElement.offsetWidth > sizeAvailable && this.numMenusShown > 0) {
        this.numMenusShown--;
        const size = showableMenus[this.numMenusShown].buttonElement.offsetWidth;
        showableMenus[this.numMenusShown].buttonElement.style.visibility = "hidden";
        currentSize -= size;
      }
      this.overflowMenu.actions = [];
      for (let idx = this.numMenusShown; idx < showableMenus.length; idx++) {
        this.overflowMenu.actions.push(new SubmenuAction(`menubar.submenu.${showableMenus[idx].label}`, showableMenus[idx].label, showableMenus[idx].actions || []));
      }
      if (this.overflowMenu.buttonElement.nextElementSibling !== showableMenus[this.numMenusShown].buttonElement) {
        this.overflowMenu.buttonElement.remove();
        this.container.insertBefore(this.overflowMenu.buttonElement, showableMenus[this.numMenusShown].buttonElement);
      }
      this.overflowMenu.buttonElement.style.visibility = "visible";
    } else {
      this.overflowMenu.buttonElement.remove();
      this.container.appendChild(this.overflowMenu.buttonElement);
      this.overflowMenu.buttonElement.style.visibility = "hidden";
    }
    this.container.classList.toggle(overflowMenuOnlyClass, this.numMenusShown === 0);
  }
  updateLabels(titleElement, buttonElement, label) {
    const cleanMenuLabel = cleanMnemonic(label);
    if (this.options.enableMnemonics) {
      const cleanLabel = strings.escape(label);
      MENU_ESCAPED_MNEMONIC_REGEX.lastIndex = 0;
      let escMatch = MENU_ESCAPED_MNEMONIC_REGEX.exec(cleanLabel);
      while (escMatch && escMatch[1]) {
        escMatch = MENU_ESCAPED_MNEMONIC_REGEX.exec(cleanLabel);
      }
      const replaceDoubleEscapes = (str) => str.replace(/&amp;&amp;/g, "&amp;");
      if (escMatch) {
        titleElement.innerText = "";
        titleElement.append(
          strings.ltrim(replaceDoubleEscapes(cleanLabel.substr(0, escMatch.index)), " "),
          $("mnemonic", { "aria-hidden": "true" }, escMatch[3]),
          strings.rtrim(replaceDoubleEscapes(cleanLabel.substr(escMatch.index + escMatch[0].length)), " ")
        );
      } else {
        titleElement.innerText = replaceDoubleEscapes(cleanLabel).trim();
      }
    } else {
      titleElement.innerText = cleanMenuLabel.replace(/&&/g, "&");
    }
    const mnemonicMatches = MENU_MNEMONIC_REGEX.exec(label);
    if (mnemonicMatches) {
      const mnemonic = !!mnemonicMatches[1] ? mnemonicMatches[1] : mnemonicMatches[3];
      if (this.options.enableMnemonics) {
        buttonElement.setAttribute("aria-keyshortcuts", "Alt+" + mnemonic.toLocaleLowerCase());
      } else {
        buttonElement.removeAttribute("aria-keyshortcuts");
      }
    }
  }
  update(options) {
    if (options) {
      this.options = options;
    }
    if (this.isFocused) {
      this.updatePending = true;
      return;
    }
    this.menus.forEach((menuBarMenu) => {
      if (!menuBarMenu.buttonElement || !menuBarMenu.titleElement) {
        return;
      }
      this.updateLabels(menuBarMenu.titleElement, menuBarMenu.buttonElement, menuBarMenu.label);
    });
    if (!this.overflowLayoutScheduled) {
      this.overflowLayoutScheduled = DOM.scheduleAtNextAnimationFrame(DOM.getWindow(this.container), () => {
        this.updateOverflowAction();
        this.overflowLayoutScheduled = void 0;
      });
    }
    this.setUnfocusedState();
  }
  registerMnemonic(menuIndex, mnemonic) {
    this.mnemonics.set(mnemonic.toLocaleLowerCase(), menuIndex);
  }
  hideMenubar() {
    if (this.container.style.display !== "none") {
      this.container.style.display = "none";
      this._onVisibilityChange.fire(false);
    }
  }
  showMenubar() {
    if (this.container.style.display !== "flex") {
      this.container.style.display = "flex";
      this._onVisibilityChange.fire(true);
      this.updateOverflowAction();
    }
  }
  get focusState() {
    return this._focusState;
  }
  set focusState(value) {
    if (this._focusState >= 2 /* FOCUSED */ && value < 2 /* FOCUSED */) {
      if (this.updatePending) {
        this.menuUpdater.schedule();
        this.updatePending = false;
      }
    }
    if (value === this._focusState) {
      return;
    }
    const isVisible = this.isVisible;
    const isOpen = this.isOpen;
    const isFocused = this.isFocused;
    this._focusState = value;
    switch (value) {
      case 0 /* HIDDEN */:
        if (isVisible) {
          this.hideMenubar();
        }
        if (isOpen) {
          this.cleanupCustomMenu();
        }
        if (isFocused) {
          this.focusedMenu = void 0;
          if (this.focusToReturn) {
            this.focusToReturn.focus();
            this.focusToReturn = void 0;
          }
        }
        break;
      case 1 /* VISIBLE */:
        if (!isVisible) {
          this.showMenubar();
        }
        if (isOpen) {
          this.cleanupCustomMenu();
        }
        if (isFocused) {
          if (this.focusedMenu) {
            if (this.focusedMenu.index === _MenuBar.OVERFLOW_INDEX) {
              this.overflowMenu.buttonElement.blur();
            } else {
              this.menus[this.focusedMenu.index].buttonElement?.blur();
            }
          }
          this.focusedMenu = void 0;
          if (this.focusToReturn) {
            this.focusToReturn.focus();
            this.focusToReturn = void 0;
          }
        }
        break;
      case 2 /* FOCUSED */:
        if (!isVisible) {
          this.showMenubar();
        }
        if (isOpen) {
          this.cleanupCustomMenu();
        }
        if (this.focusedMenu) {
          if (this.focusedMenu.index === 0 && this.numMenusShown === 0) {
            this.focusedMenu.index = _MenuBar.OVERFLOW_INDEX;
          }
          if (this.focusedMenu.index === _MenuBar.OVERFLOW_INDEX) {
            this.overflowMenu.buttonElement.focus();
          } else {
            this.menus[this.focusedMenu.index].buttonElement?.focus();
          }
        }
        break;
      case 3 /* OPEN */:
        if (!isVisible) {
          this.showMenubar();
        }
        if (this.focusedMenu) {
          this.cleanupCustomMenu();
          this.showCustomMenu(this.focusedMenu.index, this.openedViaKeyboard);
        }
        break;
    }
    this._focusState = value;
    this._onFocusStateChange.fire(this.focusState >= 2 /* FOCUSED */);
  }
  get isVisible() {
    return this.focusState >= 1 /* VISIBLE */;
  }
  get isFocused() {
    return this.focusState >= 2 /* FOCUSED */;
  }
  get isOpen() {
    return this.focusState >= 3 /* OPEN */;
  }
  get hasOverflow() {
    return this.isCompact || this.numMenusShown < this.menus.length;
  }
  get isCompact() {
    return this.options.compactMode !== void 0;
  }
  setUnfocusedState() {
    if (this.options.visibility === "toggle" || this.options.visibility === "hidden") {
      this.focusState = 0 /* HIDDEN */;
    } else if (this.options.visibility === "classic" && browser.isFullscreen(mainWindow)) {
      this.focusState = 0 /* HIDDEN */;
    } else {
      this.focusState = 1 /* VISIBLE */;
    }
    this.ignoreNextMouseUp = false;
    this.mnemonicsInUse = false;
    this.updateMnemonicVisibility(false);
  }
  focusPrevious() {
    if (!this.focusedMenu || this.numMenusShown === 0) {
      return;
    }
    let newFocusedIndex = (this.focusedMenu.index - 1 + this.numMenusShown) % this.numMenusShown;
    if (this.focusedMenu.index === _MenuBar.OVERFLOW_INDEX) {
      newFocusedIndex = this.numMenusShown - 1;
    } else if (this.focusedMenu.index === 0 && this.hasOverflow) {
      newFocusedIndex = _MenuBar.OVERFLOW_INDEX;
    }
    if (newFocusedIndex === this.focusedMenu.index) {
      return;
    }
    if (this.isOpen) {
      this.cleanupCustomMenu();
      this.showCustomMenu(newFocusedIndex);
    } else if (this.isFocused) {
      this.focusedMenu.index = newFocusedIndex;
      if (newFocusedIndex === _MenuBar.OVERFLOW_INDEX) {
        this.overflowMenu.buttonElement.focus();
      } else {
        this.menus[newFocusedIndex].buttonElement?.focus();
      }
    }
  }
  focusNext() {
    if (!this.focusedMenu || this.numMenusShown === 0) {
      return;
    }
    let newFocusedIndex = (this.focusedMenu.index + 1) % this.numMenusShown;
    if (this.focusedMenu.index === _MenuBar.OVERFLOW_INDEX) {
      newFocusedIndex = 0;
    } else if (this.focusedMenu.index === this.numMenusShown - 1) {
      newFocusedIndex = _MenuBar.OVERFLOW_INDEX;
    }
    if (newFocusedIndex === this.focusedMenu.index) {
      return;
    }
    if (this.isOpen) {
      this.cleanupCustomMenu();
      this.showCustomMenu(newFocusedIndex);
    } else if (this.isFocused) {
      this.focusedMenu.index = newFocusedIndex;
      if (newFocusedIndex === _MenuBar.OVERFLOW_INDEX) {
        this.overflowMenu.buttonElement.focus();
      } else {
        this.menus[newFocusedIndex].buttonElement?.focus();
      }
    }
  }
  updateMnemonicVisibility(visible) {
    if (this.menus) {
      this.menus.forEach((menuBarMenu) => {
        if (menuBarMenu.titleElement && menuBarMenu.titleElement.children.length) {
          const child = menuBarMenu.titleElement.children.item(0);
          if (child) {
            child.style.textDecoration = this.options.alwaysOnMnemonics || visible ? "underline" : "";
          }
        }
      });
    }
  }
  get mnemonicsInUse() {
    return this._mnemonicsInUse;
  }
  set mnemonicsInUse(value) {
    this._mnemonicsInUse = value;
  }
  get shouldAltKeyFocus() {
    if (isMacintosh) {
      return false;
    }
    if (!this.options.disableAltFocus) {
      return true;
    }
    if (this.options.visibility === "toggle") {
      return true;
    }
    return false;
  }
  get onVisibilityChange() {
    return this._onVisibilityChange.event;
  }
  get onFocusStateChange() {
    return this._onFocusStateChange.event;
  }
  onMenuTriggered(menuIndex, clicked) {
    if (this.isOpen) {
      if (this.isCurrentMenu(menuIndex)) {
        this.setUnfocusedState();
      } else {
        this.cleanupCustomMenu();
        this.showCustomMenu(menuIndex, this.openedViaKeyboard);
      }
    } else {
      this.focusedMenu = { index: menuIndex };
      this.openedViaKeyboard = !clicked;
      this.focusState = 3 /* OPEN */;
    }
  }
  onModifierKeyToggled(modifierKeyStatus) {
    const allModifiersReleased = !modifierKeyStatus.altKey && !modifierKeyStatus.ctrlKey && !modifierKeyStatus.shiftKey && !modifierKeyStatus.metaKey;
    if (this.options.visibility === "hidden") {
      return;
    }
    if (modifierKeyStatus.event && this.shouldAltKeyFocus) {
      if (ScanCodeUtils.toEnum(modifierKeyStatus.event.code) === ScanCode.AltLeft) {
        modifierKeyStatus.event.preventDefault();
      }
    }
    if (this.isFocused && modifierKeyStatus.lastKeyPressed === "alt" && modifierKeyStatus.altKey) {
      this.setUnfocusedState();
      this.mnemonicsInUse = false;
      this.awaitingAltRelease = true;
    }
    if (allModifiersReleased && modifierKeyStatus.lastKeyPressed === "alt" && modifierKeyStatus.lastKeyReleased === "alt") {
      if (!this.awaitingAltRelease) {
        if (!this.isFocused && this.shouldAltKeyFocus) {
          this.mnemonicsInUse = true;
          this.focusedMenu = { index: this.numMenusShown > 0 ? 0 : _MenuBar.OVERFLOW_INDEX };
          this.focusState = 2 /* FOCUSED */;
        } else if (!this.isOpen) {
          this.setUnfocusedState();
        }
      }
    }
    if (!modifierKeyStatus.altKey && modifierKeyStatus.lastKeyReleased === "alt") {
      this.awaitingAltRelease = false;
    }
    if (this.options.enableMnemonics && this.menus && !this.isOpen) {
      this.updateMnemonicVisibility(!this.awaitingAltRelease && modifierKeyStatus.altKey || this.mnemonicsInUse);
    }
  }
  isCurrentMenu(menuIndex) {
    if (!this.focusedMenu) {
      return false;
    }
    return this.focusedMenu.index === menuIndex;
  }
  cleanupCustomMenu() {
    if (this.focusedMenu) {
      if (this.focusedMenu.index === _MenuBar.OVERFLOW_INDEX) {
        this.overflowMenu.buttonElement.focus();
      } else {
        this.menus[this.focusedMenu.index].buttonElement?.focus();
      }
      if (this.focusedMenu.holder) {
        this.focusedMenu.holder.parentElement?.classList.remove("open");
        this.focusedMenu.holder.remove();
      }
      this.focusedMenu.widget?.dispose();
      this.focusedMenu = { index: this.focusedMenu.index };
    }
    this.menuDisposables.clear();
  }
  showCustomMenu(menuIndex, selectFirst = true) {
    const actualMenuIndex = menuIndex >= this.numMenusShown ? _MenuBar.OVERFLOW_INDEX : menuIndex;
    const customMenu = actualMenuIndex === _MenuBar.OVERFLOW_INDEX ? this.overflowMenu : this.menus[actualMenuIndex];
    if (!customMenu.actions || !customMenu.buttonElement || !customMenu.titleElement) {
      return;
    }
    const menuHolder = $("div.menubar-menu-items-holder", { "title": "" });
    customMenu.buttonElement.classList.add("open");
    const titleBoundingRect = customMenu.titleElement.getBoundingClientRect();
    const titleBoundingRectZoom = DOM.getDomNodeZoomLevel(customMenu.titleElement);
    if (this.options.compactMode?.horizontal === HorizontalDirection.Right) {
      menuHolder.style.left = `${titleBoundingRect.left + this.container.clientWidth}px`;
    } else if (this.options.compactMode?.horizontal === HorizontalDirection.Left) {
      const windowWidth = DOM.getWindow(this.container).innerWidth;
      menuHolder.style.right = `${windowWidth - titleBoundingRect.left}px`;
      menuHolder.style.left = "auto";
    } else {
      menuHolder.style.left = `${titleBoundingRect.left * titleBoundingRectZoom}px`;
    }
    if (this.options.compactMode?.vertical === VerticalDirection.Above) {
      menuHolder.style.top = `${titleBoundingRect.top - this.menus.length * 30 + this.container.clientHeight}px`;
    } else if (this.options.compactMode?.vertical === VerticalDirection.Below) {
      menuHolder.style.top = `${titleBoundingRect.top}px`;
    } else {
      menuHolder.style.top = `${titleBoundingRect.bottom * titleBoundingRectZoom}px`;
    }
    customMenu.buttonElement.appendChild(menuHolder);
    const menuOptions = {
      getKeyBinding: this.options.getKeybinding,
      actionRunner: this.actionRunner,
      enableMnemonics: this.options.alwaysOnMnemonics || this.mnemonicsInUse && this.options.enableMnemonics,
      ariaLabel: customMenu.buttonElement.getAttribute("aria-label") ?? void 0,
      expandDirection: this.isCompact ? this.options.compactMode : { horizontal: HorizontalDirection.Right, vertical: VerticalDirection.Below },
      useEventAsContext: true
    };
    const menuWidget = this.menuDisposables.add(new Menu(menuHolder, customMenu.actions, menuOptions, this.menuStyle));
    this.menuDisposables.add(menuWidget.onDidCancel(() => {
      this.focusState = 2 /* FOCUSED */;
    }));
    if (actualMenuIndex !== menuIndex) {
      menuWidget.trigger(menuIndex - this.numMenusShown);
    } else {
      menuWidget.focus(selectFirst);
    }
    this.focusedMenu = {
      index: actualMenuIndex,
      holder: menuHolder,
      widget: menuWidget
    };
  }
};
_MenuBar.OVERFLOW_INDEX = -1;
let MenuBar = _MenuBar;
export {
  MenuBar
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvbWVudS9tZW51YmFyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgYnJvd3NlciBmcm9tICcuLi8uLi9icm93c2VyLmpzJztcbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi9kb20uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4va2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IEV2ZW50VHlwZSwgR2VzdHVyZSwgR2VzdHVyZUV2ZW50IH0gZnJvbSAnLi4vLi4vdG91Y2guanMnO1xuaW1wb3J0IHsgY2xlYW5NbmVtb25pYywgSG9yaXpvbnRhbERpcmVjdGlvbiwgSU1lbnVEaXJlY3Rpb24sIElNZW51T3B0aW9ucywgSU1lbnVTdHlsZXMsIE1lbnUsIE1FTlVfRVNDQVBFRF9NTkVNT05JQ19SRUdFWCwgTUVOVV9NTkVNT05JQ19SRUdFWCwgVmVydGljYWxEaXJlY3Rpb24gfSBmcm9tICcuL21lbnUuanMnO1xuaW1wb3J0IHsgQWN0aW9uUnVubmVyLCBJQWN0aW9uLCBJQWN0aW9uUnVubmVyLCBTZXBhcmF0b3IsIFN1Ym1lbnVBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBhc0FycmF5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QsIFNjYW5Db2RlLCBTY2FuQ29kZVV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IFJlc29sdmVkS2V5YmluZGluZyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCAnLi9tZW51YmFyLmNzcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi93aW5kb3cuanMnO1xuXG5jb25zdCAkID0gRE9NLiQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1lbnVCYXJPcHRpb25zIHtcblx0ZW5hYmxlTW5lbW9uaWNzPzogYm9vbGVhbjtcblx0ZGlzYWJsZUFsdEZvY3VzPzogYm9vbGVhbjtcblx0dmlzaWJpbGl0eT86IHN0cmluZztcblx0Z2V0S2V5YmluZGluZz86IChhY3Rpb246IElBY3Rpb24pID0+IFJlc29sdmVkS2V5YmluZGluZyB8IHVuZGVmaW5lZDtcblx0YWx3YXlzT25NbmVtb25pY3M/OiBib29sZWFuO1xuXHRjb21wYWN0TW9kZT86IElNZW51RGlyZWN0aW9uO1xuXHRhY3Rpb25SdW5uZXI/OiBJQWN0aW9uUnVubmVyO1xuXHRnZXRDb21wYWN0TWVudUFjdGlvbnM/OiAoKSA9PiBJQWN0aW9uW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVudUJhck1lbnUge1xuXHRhY3Rpb25zOiBJQWN0aW9uW107XG5cdGxhYmVsOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBNZW51QmFyTWVudVdpdGhFbGVtZW50cyBleHRlbmRzIE1lbnVCYXJNZW51IHtcblx0dGl0bGVFbGVtZW50PzogSFRNTEVsZW1lbnQ7XG5cdGJ1dHRvbkVsZW1lbnQ/OiBIVE1MRWxlbWVudDtcbn1cblxuZW51bSBNZW51YmFyU3RhdGUge1xuXHRISURERU4sXG5cdFZJU0lCTEUsXG5cdEZPQ1VTRUQsXG5cdE9QRU5cbn1cblxuZXhwb3J0IGNsYXNzIE1lbnVCYXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgT1ZFUkZMT1dfSU5ERVg6IG51bWJlciA9IC0xO1xuXG5cdHByaXZhdGUgbWVudXM6IE1lbnVCYXJNZW51V2l0aEVsZW1lbnRzW107XG5cblx0cHJpdmF0ZSBvdmVyZmxvd01lbnUhOiBNZW51QmFyTWVudVdpdGhFbGVtZW50cyAmIHsgdGl0bGVFbGVtZW50OiBIVE1MRWxlbWVudDsgYnV0dG9uRWxlbWVudDogSFRNTEVsZW1lbnQgfTtcblxuXHRwcml2YXRlIGZvY3VzZWRNZW51OiB7XG5cdFx0aW5kZXg6IG51bWJlcjtcblx0XHRob2xkZXI/OiBIVE1MRWxlbWVudDtcblx0XHR3aWRnZXQ/OiBNZW51O1xuXHR9IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgZm9jdXNUb1JldHVybjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbWVudVVwZGF0ZXI6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cblx0Ly8gSW5wdXQtcmVsYXRlZFxuXHRwcml2YXRlIF9tbmVtb25pY3NJblVzZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIG9wZW5lZFZpYUtleWJvYXJkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgYXdhaXRpbmdBbHRSZWxlYXNlOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgaWdub3JlTmV4dE1vdXNlVXA6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBtbmVtb25pY3M6IE1hcDxzdHJpbmcsIG51bWJlcj47XG5cblx0cHJpdmF0ZSB1cGRhdGVQZW5kaW5nOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2ZvY3VzU3RhdGU6IE1lbnViYXJTdGF0ZTtcblx0cHJpdmF0ZSBhY3Rpb25SdW5uZXI6IElBY3Rpb25SdW5uZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25WaXNpYmlsaXR5Q2hhbmdlOiBFbWl0dGVyPGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkZvY3VzU3RhdGVDaGFuZ2U6IEVtaXR0ZXI8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBudW1NZW51c1Nob3duOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIG92ZXJmbG93TGF5b3V0U2NoZWR1bGVkOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1lbnVEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBjb250YWluZXI6IEhUTUxFbGVtZW50LCBwcml2YXRlIG9wdGlvbnM6IElNZW51QmFyT3B0aW9ucywgcHJpdmF0ZSBtZW51U3R5bGU6IElNZW51U3R5bGVzKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgncm9sZScsICdtZW51YmFyJyk7XG5cdFx0aWYgKHRoaXMuaXNDb21wYWN0KSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdjb21wYWN0Jyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5tZW51cyA9IFtdO1xuXHRcdHRoaXMubW5lbW9uaWNzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblxuXHRcdHRoaXMuX2ZvY3VzU3RhdGUgPSBNZW51YmFyU3RhdGUuVklTSUJMRTtcblxuXHRcdHRoaXMuX29uVmlzaWJpbGl0eUNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHRcdHRoaXMuX29uRm9jdXNTdGF0ZUNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXG5cdFx0dGhpcy5jcmVhdGVPdmVyZmxvd01lbnUoKTtcblxuXHRcdHRoaXMubWVudVVwZGF0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLnVwZGF0ZSgpLCAyMDApKTtcblxuXHRcdHRoaXMuYWN0aW9uUnVubmVyID0gdGhpcy5vcHRpb25zLmFjdGlvblJ1bm5lciA/PyB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uUnVubmVyKCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYWN0aW9uUnVubmVyLm9uV2lsbFJ1bigoKSA9PiB7XG5cdFx0XHR0aGlzLnNldFVuZm9jdXNlZFN0YXRlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLk1vZGlmaWVyS2V5RW1pdHRlci5nZXRJbnN0YW5jZSgpLmV2ZW50KHRoaXMub25Nb2RpZmllcktleVRvZ2dsZWQsIHRoaXMpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIERPTS5FdmVudFR5cGUuS0VZX0RPV04sIChlKSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSBhcyBLZXlib2FyZEV2ZW50KTtcblx0XHRcdGxldCBldmVudEhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0Y29uc3Qga2V5ID0gISFlLmtleSA/IGUua2V5LnRvTG9jYWxlTG93ZXJDYXNlKCkgOiAnJztcblxuXHRcdFx0Y29uc3QgdGFiTmF2ID0gaXNNYWNpbnRvc2ggJiYgIXRoaXMuaXNDb21wYWN0O1xuXG5cdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuTGVmdEFycm93KSB8fCAodGFiTmF2ICYmIGV2ZW50LmVxdWFscyhLZXlDb2RlLlRhYiB8IEtleU1vZC5TaGlmdCkpKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXNQcmV2aW91cygpO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5SaWdodEFycm93KSB8fCAodGFiTmF2ICYmIGV2ZW50LmVxdWFscyhLZXlDb2RlLlRhYikpKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXNOZXh0KCk7XG5cdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLkVzY2FwZSkgJiYgdGhpcy5pc0ZvY3VzZWQgJiYgIXRoaXMuaXNPcGVuKSB7XG5cdFx0XHRcdHRoaXMuc2V0VW5mb2N1c2VkU3RhdGUoKTtcblx0XHRcdH0gZWxzZSBpZiAoIXRoaXMuaXNPcGVuICYmICFldmVudC5jdHJsS2V5ICYmIHRoaXMub3B0aW9ucy5lbmFibGVNbmVtb25pY3MgJiYgdGhpcy5tbmVtb25pY3NJblVzZSAmJiB0aGlzLm1uZW1vbmljcy5oYXMoa2V5KSkge1xuXHRcdFx0XHRjb25zdCBtZW51SW5kZXggPSB0aGlzLm1uZW1vbmljcy5nZXQoa2V5KSE7XG5cdFx0XHRcdHRoaXMub25NZW51VHJpZ2dlcmVkKG1lbnVJbmRleCwgZmFsc2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZXZlbnRIYW5kbGVkID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE5ldmVyIGFsbG93IGRlZmF1bHQgdGFiIGJlaGF2aW9yIHdoZW4gbm90IGNvbXBhY3Rcblx0XHRcdGlmICghdGhpcy5pc0NvbXBhY3QgJiYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLlRhYiB8IEtleU1vZC5TaGlmdCkgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuVGFiKSkpIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV2ZW50SGFuZGxlZCkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCB3aW5kb3cgPSBET00uZ2V0V2luZG93KHRoaXMuY29udGFpbmVyKTtcblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdpbmRvdywgRE9NLkV2ZW50VHlwZS5NT1VTRV9ET1dOLCAoKSA9PiB7XG5cdFx0XHQvLyBUaGlzIG1vdXNlIGV2ZW50IGlzIG91dHNpZGUgdGhlIG1lbnViYXIgc28gaXQgY291bnRzIGFzIGEgZm9jdXMgb3V0XG5cdFx0XHRpZiAodGhpcy5pc0ZvY3VzZWQpIHtcblx0XHRcdFx0dGhpcy5zZXRVbmZvY3VzZWRTdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIERPTS5FdmVudFR5cGUuRk9DVVNfSU4sIChlKSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IGUgYXMgRm9jdXNFdmVudDtcblxuXHRcdFx0aWYgKGV2ZW50LnJlbGF0ZWRUYXJnZXQpIHtcblx0XHRcdFx0aWYgKCF0aGlzLmNvbnRhaW5lci5jb250YWlucyhldmVudC5yZWxhdGVkVGFyZ2V0IGFzIEhUTUxFbGVtZW50KSkge1xuXHRcdFx0XHRcdHRoaXMuZm9jdXNUb1JldHVybiA9IGV2ZW50LnJlbGF0ZWRUYXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuY29udGFpbmVyLCBET00uRXZlbnRUeXBlLkZPQ1VTX09VVCwgKGUpID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gZSBhcyBGb2N1c0V2ZW50O1xuXG5cdFx0XHQvLyBXZSBhcmUgbG9zaW5nIGZvY3VzIGFuZCB0aGVyZSBpcyBubyByZWxhdGVkIHRhcmdldCwgZS5nLiB3ZWJ2aWV3IGNhc2Vcblx0XHRcdGlmICghZXZlbnQucmVsYXRlZFRhcmdldCkge1xuXHRcdFx0XHR0aGlzLnNldFVuZm9jdXNlZFN0YXRlKCk7XG5cdFx0XHR9XG5cdFx0XHQvLyBXZSBhcmUgbG9zaW5nIGZvY3VzIGFuZCB0aGVyZSBpcyBhIHRhcmdldCwgcmVzZXQgZm9jdXNUb1JldHVybiB2YWx1ZSBhcyBub3QgdG8gcmVkaXJlY3Rcblx0XHRcdGVsc2UgaWYgKGV2ZW50LnJlbGF0ZWRUYXJnZXQgJiYgIXRoaXMuY29udGFpbmVyLmNvbnRhaW5zKGV2ZW50LnJlbGF0ZWRUYXJnZXQgYXMgSFRNTEVsZW1lbnQpKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXNUb1JldHVybiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5zZXRVbmZvY3VzZWRTdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LCBET00uRXZlbnRUeXBlLktFWV9ET1dOLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLm9wdGlvbnMuZW5hYmxlTW5lbW9uaWNzIHx8ICFlLmFsdEtleSB8fCBlLmN0cmxLZXkgfHwgZS5kZWZhdWx0UHJldmVudGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qga2V5ID0gZS5rZXkudG9Mb2NhbGVMb3dlckNhc2UoKTtcblx0XHRcdGlmICghdGhpcy5tbmVtb25pY3MuaGFzKGtleSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm1uZW1vbmljc0luVXNlID0gdHJ1ZTtcblx0XHRcdHRoaXMudXBkYXRlTW5lbW9uaWNWaXNpYmlsaXR5KHRydWUpO1xuXG5cdFx0XHRjb25zdCBtZW51SW5kZXggPSB0aGlzLm1uZW1vbmljcy5nZXQoa2V5KSE7XG5cdFx0XHR0aGlzLm9uTWVudVRyaWdnZXJlZChtZW51SW5kZXgsIGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLnNldFVuZm9jdXNlZFN0YXRlKCk7XG5cdH1cblxuXHRwdXNoKGFyZzogTWVudUJhck1lbnUgfCBNZW51QmFyTWVudVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgbWVudXM6IE1lbnVCYXJNZW51W10gPSBhc0FycmF5KGFyZyk7XG5cblx0XHRtZW51cy5mb3JFYWNoKChtZW51QmFyTWVudSkgPT4ge1xuXHRcdFx0Y29uc3QgbWVudUluZGV4ID0gdGhpcy5tZW51cy5sZW5ndGg7XG5cdFx0XHRjb25zdCBjbGVhbk1lbnVMYWJlbCA9IGNsZWFuTW5lbW9uaWMobWVudUJhck1lbnUubGFiZWwpO1xuXG5cdFx0XHRjb25zdCBtbmVtb25pY01hdGNoZXMgPSBNRU5VX01ORU1PTklDX1JFR0VYLmV4ZWMobWVudUJhck1lbnUubGFiZWwpO1xuXG5cdFx0XHQvLyBSZWdpc3RlciBtbmVtb25pY3Ncblx0XHRcdGlmIChtbmVtb25pY01hdGNoZXMpIHtcblx0XHRcdFx0Y29uc3QgbW5lbW9uaWMgPSAhIW1uZW1vbmljTWF0Y2hlc1sxXSA/IG1uZW1vbmljTWF0Y2hlc1sxXSA6IG1uZW1vbmljTWF0Y2hlc1szXTtcblxuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyTW5lbW9uaWModGhpcy5tZW51cy5sZW5ndGgsIG1uZW1vbmljKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuaXNDb21wYWN0KSB7XG5cdFx0XHRcdHRoaXMubWVudXMucHVzaChtZW51QmFyTWVudSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBidXR0b25FbGVtZW50ID0gJCgnZGl2Lm1lbnViYXItbWVudS1idXR0b24nLCB7ICdyb2xlJzogJ21lbnVpdGVtJywgJ3RhYmluZGV4JzogLTEsICdhcmlhLWxhYmVsJzogY2xlYW5NZW51TGFiZWwsICdhcmlhLWhhc3BvcHVwJzogdHJ1ZSB9KTtcblx0XHRcdFx0Y29uc3QgdGl0bGVFbGVtZW50ID0gJCgnZGl2Lm1lbnViYXItbWVudS10aXRsZScsIHsgJ3JvbGUnOiAnbm9uZScsICdhcmlhLWhpZGRlbic6IHRydWUgfSk7XG5cblx0XHRcdFx0YnV0dG9uRWxlbWVudC5hcHBlbmRDaGlsZCh0aXRsZUVsZW1lbnQpO1xuXHRcdFx0XHR0aGlzLmNvbnRhaW5lci5pbnNlcnRCZWZvcmUoYnV0dG9uRWxlbWVudCwgdGhpcy5vdmVyZmxvd01lbnUuYnV0dG9uRWxlbWVudCk7XG5cblx0XHRcdFx0dGhpcy51cGRhdGVMYWJlbHModGl0bGVFbGVtZW50LCBidXR0b25FbGVtZW50LCBtZW51QmFyTWVudS5sYWJlbCk7XG5cblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihidXR0b25FbGVtZW50LCBET00uRXZlbnRUeXBlLktFWV9VUCwgKGUpID0+IHtcblx0XHRcdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSBhcyBLZXlib2FyZEV2ZW50KTtcblx0XHRcdFx0XHRsZXQgZXZlbnRIYW5kbGVkID0gdHJ1ZTtcblxuXHRcdFx0XHRcdGlmICgoZXZlbnQuZXF1YWxzKEtleUNvZGUuRG93bkFycm93KSB8fCBldmVudC5lcXVhbHMoS2V5Q29kZS5FbnRlcikpICYmICF0aGlzLmlzT3Blbikge1xuXHRcdFx0XHRcdFx0dGhpcy5mb2N1c2VkTWVudSA9IHsgaW5kZXg6IG1lbnVJbmRleCB9O1xuXHRcdFx0XHRcdFx0dGhpcy5vcGVuZWRWaWFLZXlib2FyZCA9IHRydWU7XG5cdFx0XHRcdFx0XHR0aGlzLmZvY3VzU3RhdGUgPSBNZW51YmFyU3RhdGUuT1BFTjtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZXZlbnRIYW5kbGVkID0gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGV2ZW50SGFuZGxlZCkge1xuXHRcdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKEdlc3R1cmUuYWRkVGFyZ2V0KGJ1dHRvbkVsZW1lbnQpKTtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihidXR0b25FbGVtZW50LCBFdmVudFR5cGUuVGFwLCAoZTogR2VzdHVyZUV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0Ly8gSWdub3JlIHRoaXMgdG91Y2ggaWYgdGhlIG1lbnUgaXMgdG91Y2hlZFxuXHRcdFx0XHRcdGlmICh0aGlzLmlzT3BlbiAmJiB0aGlzLmZvY3VzZWRNZW51ICYmIHRoaXMuZm9jdXNlZE1lbnUuaG9sZGVyICYmIERPTS5pc0FuY2VzdG9yKGUuaW5pdGlhbFRhcmdldCBhcyBIVE1MRWxlbWVudCwgdGhpcy5mb2N1c2VkTWVudS5ob2xkZXIpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5pZ25vcmVOZXh0TW91c2VVcCA9IGZhbHNlO1xuXHRcdFx0XHRcdHRoaXMub25NZW51VHJpZ2dlcmVkKG1lbnVJbmRleCwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoYnV0dG9uRWxlbWVudCwgRE9NLkV2ZW50VHlwZS5NT1VTRV9ET1dOLCAoZTogTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0XHRcdC8vIElnbm9yZSBub24tbGVmdC1jbGlja1xuXHRcdFx0XHRcdGNvbnN0IG1vdXNlRXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KERPTS5nZXRXaW5kb3coYnV0dG9uRWxlbWVudCksIGUpO1xuXHRcdFx0XHRcdGlmICghbW91c2VFdmVudC5sZWZ0QnV0dG9uKSB7XG5cdFx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKCF0aGlzLmlzT3Blbikge1xuXHRcdFx0XHRcdFx0Ly8gT3BlbiB0aGUgbWVudSB3aXRoIG1vdXNlIGRvd24gYW5kIGlnbm9yZSB0aGUgZm9sbG93aW5nIG1vdXNlIHVwIGV2ZW50XG5cdFx0XHRcdFx0XHR0aGlzLmlnbm9yZU5leHRNb3VzZVVwID0gdHJ1ZTtcblx0XHRcdFx0XHRcdHRoaXMub25NZW51VHJpZ2dlcmVkKG1lbnVJbmRleCwgdHJ1ZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuaWdub3JlTmV4dE1vdXNlVXAgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoYnV0dG9uRWxlbWVudCwgRE9NLkV2ZW50VHlwZS5NT1VTRV9VUCwgKGUpID0+IHtcblx0XHRcdFx0XHRpZiAoZS5kZWZhdWx0UHJldmVudGVkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKCF0aGlzLmlnbm9yZU5leHRNb3VzZVVwKSB7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5pc0ZvY3VzZWQpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5vbk1lbnVUcmlnZ2VyZWQobWVudUluZGV4LCB0cnVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5pZ25vcmVOZXh0TW91c2VVcCA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoYnV0dG9uRWxlbWVudCwgRE9NLkV2ZW50VHlwZS5NT1VTRV9FTlRFUiwgKCkgPT4ge1xuXHRcdFx0XHRcdGlmICh0aGlzLmlzT3BlbiAmJiAhdGhpcy5pc0N1cnJlbnRNZW51KG1lbnVJbmRleCkpIHtcblx0XHRcdFx0XHRcdGJ1dHRvbkVsZW1lbnQuZm9jdXMoKTtcblx0XHRcdFx0XHRcdHRoaXMuY2xlYW51cEN1c3RvbU1lbnUoKTtcblx0XHRcdFx0XHRcdHRoaXMuc2hvd0N1c3RvbU1lbnUobWVudUluZGV4LCBmYWxzZSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLmlzRm9jdXNlZCAmJiAhdGhpcy5pc09wZW4pIHtcblx0XHRcdFx0XHRcdHRoaXMuZm9jdXNlZE1lbnUgPSB7IGluZGV4OiBtZW51SW5kZXggfTtcblx0XHRcdFx0XHRcdGJ1dHRvbkVsZW1lbnQuZm9jdXMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHR0aGlzLm1lbnVzLnB1c2goe1xuXHRcdFx0XHRcdGxhYmVsOiBtZW51QmFyTWVudS5sYWJlbCxcblx0XHRcdFx0XHRhY3Rpb25zOiBtZW51QmFyTWVudS5hY3Rpb25zLFxuXHRcdFx0XHRcdGJ1dHRvbkVsZW1lbnQ6IGJ1dHRvbkVsZW1lbnQsXG5cdFx0XHRcdFx0dGl0bGVFbGVtZW50OiB0aXRsZUVsZW1lbnRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRjcmVhdGVPdmVyZmxvd01lbnUoKTogdm9pZCB7XG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLmlzQ29tcGFjdCA/IG5scy5sb2NhbGl6ZSgnbUFwcE1lbnUnLCAnQXBwbGljYXRpb24gTWVudScpIDogbmxzLmxvY2FsaXplKCdtTW9yZScsICdNb3JlJyk7XG5cdFx0Y29uc3QgYnV0dG9uRWxlbWVudCA9ICQoJ2Rpdi5tZW51YmFyLW1lbnUtYnV0dG9uJywgeyAncm9sZSc6ICdtZW51aXRlbScsICd0YWJpbmRleCc6IHRoaXMuaXNDb21wYWN0ID8gMCA6IC0xLCAnYXJpYS1sYWJlbCc6IGxhYmVsLCAnYXJpYS1oYXNwb3B1cCc6IHRydWUgfSk7XG5cdFx0Y29uc3QgdGl0bGVFbGVtZW50ID0gJCgnZGl2Lm1lbnViYXItbWVudS10aXRsZS50b29sYmFyLXRvZ2dsZS1tb3JlJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKENvZGljb24ubWVudUJhck1vcmUpLCB7ICdyb2xlJzogJ25vbmUnLCAnYXJpYS1oaWRkZW4nOiB0cnVlIH0pO1xuXG5cdFx0YnV0dG9uRWxlbWVudC5hcHBlbmRDaGlsZCh0aXRsZUVsZW1lbnQpO1xuXHRcdHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKGJ1dHRvbkVsZW1lbnQpO1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihidXR0b25FbGVtZW50LCBET00uRXZlbnRUeXBlLktFWV9VUCwgKGUpID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlIGFzIEtleWJvYXJkRXZlbnQpO1xuXHRcdFx0bGV0IGV2ZW50SGFuZGxlZCA9IHRydWU7XG5cblx0XHRcdGNvbnN0IHRyaWdnZXJLZXlzID0gW0tleUNvZGUuRW50ZXJdO1xuXHRcdFx0aWYgKCF0aGlzLmlzQ29tcGFjdCkge1xuXHRcdFx0XHR0cmlnZ2VyS2V5cy5wdXNoKEtleUNvZGUuRG93bkFycm93KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRyaWdnZXJLZXlzLnB1c2goS2V5Q29kZS5TcGFjZSk7XG5cblx0XHRcdFx0aWYgKHRoaXMub3B0aW9ucy5jb21wYWN0TW9kZT8uaG9yaXpvbnRhbCA9PT0gSG9yaXpvbnRhbERpcmVjdGlvbi5SaWdodCkge1xuXHRcdFx0XHRcdHRyaWdnZXJLZXlzLnB1c2goS2V5Q29kZS5SaWdodEFycm93KTtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLm9wdGlvbnMuY29tcGFjdE1vZGU/Lmhvcml6b250YWwgPT09IEhvcml6b250YWxEaXJlY3Rpb24uTGVmdCkge1xuXHRcdFx0XHRcdHRyaWdnZXJLZXlzLnB1c2goS2V5Q29kZS5MZWZ0QXJyb3cpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICgodHJpZ2dlcktleXMuc29tZShrID0+IGV2ZW50LmVxdWFscyhrKSkgJiYgIXRoaXMuaXNPcGVuKSkge1xuXHRcdFx0XHR0aGlzLmZvY3VzZWRNZW51ID0geyBpbmRleDogTWVudUJhci5PVkVSRkxPV19JTkRFWCB9O1xuXHRcdFx0XHR0aGlzLm9wZW5lZFZpYUtleWJvYXJkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5mb2N1c1N0YXRlID0gTWVudWJhclN0YXRlLk9QRU47XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRldmVudEhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV2ZW50SGFuZGxlZCkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihHZXN0dXJlLmFkZFRhcmdldChidXR0b25FbGVtZW50KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihidXR0b25FbGVtZW50LCBFdmVudFR5cGUuVGFwLCAoZTogR2VzdHVyZUV2ZW50KSA9PiB7XG5cdFx0XHQvLyBJZ25vcmUgdGhpcyB0b3VjaCBpZiB0aGUgbWVudSBpcyB0b3VjaGVkXG5cdFx0XHRpZiAodGhpcy5pc09wZW4gJiYgdGhpcy5mb2N1c2VkTWVudSAmJiB0aGlzLmZvY3VzZWRNZW51LmhvbGRlciAmJiBET00uaXNBbmNlc3RvcihlLmluaXRpYWxUYXJnZXQgYXMgSFRNTEVsZW1lbnQsIHRoaXMuZm9jdXNlZE1lbnUuaG9sZGVyKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuaWdub3JlTmV4dE1vdXNlVXAgPSBmYWxzZTtcblx0XHRcdHRoaXMub25NZW51VHJpZ2dlcmVkKE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVgsIHRydWUpO1xuXG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoYnV0dG9uRWxlbWVudCwgRE9NLkV2ZW50VHlwZS5NT1VTRV9ET1dOLCAoZSkgPT4ge1xuXHRcdFx0Ly8gSWdub3JlIG5vbi1sZWZ0LWNsaWNrXG5cdFx0XHRjb25zdCBtb3VzZUV2ZW50ID0gbmV3IFN0YW5kYXJkTW91c2VFdmVudChET00uZ2V0V2luZG93KGJ1dHRvbkVsZW1lbnQpLCBlKTtcblx0XHRcdGlmICghbW91c2VFdmVudC5sZWZ0QnV0dG9uKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuaXNPcGVuKSB7XG5cdFx0XHRcdC8vIE9wZW4gdGhlIG1lbnUgd2l0aCBtb3VzZSBkb3duIGFuZCBpZ25vcmUgdGhlIGZvbGxvd2luZyBtb3VzZSB1cCBldmVudFxuXHRcdFx0XHR0aGlzLmlnbm9yZU5leHRNb3VzZVVwID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5vbk1lbnVUcmlnZ2VyZWQoTWVudUJhci5PVkVSRkxPV19JTkRFWCwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmlnbm9yZU5leHRNb3VzZVVwID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihidXR0b25FbGVtZW50LCBET00uRXZlbnRUeXBlLk1PVVNFX1VQLCAoZSkgPT4ge1xuXHRcdFx0aWYgKGUuZGVmYXVsdFByZXZlbnRlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5pZ25vcmVOZXh0TW91c2VVcCkge1xuXHRcdFx0XHRpZiAodGhpcy5pc0ZvY3VzZWQpIHtcblx0XHRcdFx0XHR0aGlzLm9uTWVudVRyaWdnZXJlZChNZW51QmFyLk9WRVJGTE9XX0lOREVYLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5pZ25vcmVOZXh0TW91c2VVcCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoYnV0dG9uRWxlbWVudCwgRE9NLkV2ZW50VHlwZS5NT1VTRV9FTlRFUiwgKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNPcGVuICYmICF0aGlzLmlzQ3VycmVudE1lbnUoTWVudUJhci5PVkVSRkxPV19JTkRFWCkpIHtcblx0XHRcdFx0dGhpcy5vdmVyZmxvd01lbnUuYnV0dG9uRWxlbWVudC5mb2N1cygpO1xuXHRcdFx0XHR0aGlzLmNsZWFudXBDdXN0b21NZW51KCk7XG5cdFx0XHRcdHRoaXMuc2hvd0N1c3RvbU1lbnUoTWVudUJhci5PVkVSRkxPV19JTkRFWCwgZmFsc2UpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLmlzRm9jdXNlZCAmJiAhdGhpcy5pc09wZW4pIHtcblx0XHRcdFx0dGhpcy5mb2N1c2VkTWVudSA9IHsgaW5kZXg6IE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVggfTtcblx0XHRcdFx0YnV0dG9uRWxlbWVudC5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMub3ZlcmZsb3dNZW51ID0ge1xuXHRcdFx0YnV0dG9uRWxlbWVudDogYnV0dG9uRWxlbWVudCxcblx0XHRcdHRpdGxlRWxlbWVudDogdGl0bGVFbGVtZW50LFxuXHRcdFx0bGFiZWw6ICdNb3JlJyxcblx0XHRcdGFjdGlvbnM6IFtdXG5cdFx0fTtcblx0fVxuXG5cdHVwZGF0ZU1lbnUobWVudTogTWVudUJhck1lbnUpOiB2b2lkIHtcblx0XHRjb25zdCBtZW51VG9VcGRhdGUgPSB0aGlzLm1lbnVzLmZpbHRlcihtZW51QmFyTWVudSA9PiBtZW51QmFyTWVudS5sYWJlbCA9PT0gbWVudS5sYWJlbCk7XG5cdFx0aWYgKG1lbnVUb1VwZGF0ZSAmJiBtZW51VG9VcGRhdGUubGVuZ3RoKSB7XG5cdFx0XHRtZW51VG9VcGRhdGVbMF0uYWN0aW9ucyA9IG1lbnUuYWN0aW9ucztcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMubWVudXMuZm9yRWFjaChtZW51QmFyTWVudSA9PiB7XG5cdFx0XHRtZW51QmFyTWVudS50aXRsZUVsZW1lbnQ/LnJlbW92ZSgpO1xuXHRcdFx0bWVudUJhck1lbnUuYnV0dG9uRWxlbWVudD8ucmVtb3ZlKCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLm92ZXJmbG93TWVudS50aXRsZUVsZW1lbnQucmVtb3ZlKCk7XG5cdFx0dGhpcy5vdmVyZmxvd01lbnUuYnV0dG9uRWxlbWVudC5yZW1vdmUoKTtcblxuXHRcdGRpc3Bvc2UodGhpcy5vdmVyZmxvd0xheW91dFNjaGVkdWxlZCk7XG5cdFx0dGhpcy5vdmVyZmxvd0xheW91dFNjaGVkdWxlZCA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdGJsdXIoKTogdm9pZCB7XG5cdFx0dGhpcy5zZXRVbmZvY3VzZWRTdGF0ZSgpO1xuXHR9XG5cblx0Z2V0V2lkdGgoKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuaXNDb21wYWN0ICYmIHRoaXMubWVudXMpIHtcblx0XHRcdGNvbnN0IGxlZnQgPSB0aGlzLm1lbnVzWzBdLmJ1dHRvbkVsZW1lbnQhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmxlZnQ7XG5cdFx0XHRjb25zdCByaWdodCA9IHRoaXMuaGFzT3ZlcmZsb3cgPyB0aGlzLm92ZXJmbG93TWVudS5idXR0b25FbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnJpZ2h0IDogdGhpcy5tZW51c1t0aGlzLm1lbnVzLmxlbmd0aCAtIDFdLmJ1dHRvbkVsZW1lbnQhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnJpZ2h0O1xuXHRcdFx0cmV0dXJuIHJpZ2h0IC0gbGVmdDtcblx0XHR9XG5cblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdGdldEhlaWdodCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLmNvbnRhaW5lci5jbGllbnRIZWlnaHQ7XG5cdH1cblxuXHR0b2dnbGVGb2N1cygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaXNGb2N1c2VkICYmIHRoaXMub3B0aW9ucy52aXNpYmlsaXR5ICE9PSAnaGlkZGVuJykge1xuXHRcdFx0dGhpcy5tbmVtb25pY3NJblVzZSA9IHRydWU7XG5cdFx0XHR0aGlzLmZvY3VzZWRNZW51ID0geyBpbmRleDogdGhpcy5udW1NZW51c1Nob3duID4gMCA/IDAgOiBNZW51QmFyLk9WRVJGTE9XX0lOREVYIH07XG5cdFx0XHR0aGlzLmZvY3VzU3RhdGUgPSBNZW51YmFyU3RhdGUuRk9DVVNFRDtcblx0XHR9IGVsc2UgaWYgKCF0aGlzLmlzT3Blbikge1xuXHRcdFx0dGhpcy5zZXRVbmZvY3VzZWRTdGF0ZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlT3ZlcmZsb3dBY3Rpb24oKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm1lbnVzIHx8ICF0aGlzLm1lbnVzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG92ZXJmbG93TWVudU9ubHlDbGFzcyA9ICdvdmVyZmxvdy1tZW51LW9ubHknO1xuXG5cdFx0Ly8gUmVtb3ZlIG92ZXJmbG93IG9ubHkgcmVzdHJpY3Rpb24gdG8gYWxsb3cgdGhlIG1vc3Qgc3BhY2Vcblx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKG92ZXJmbG93TWVudU9ubHlDbGFzcywgZmFsc2UpO1xuXG5cdFx0Y29uc3Qgc2l6ZUF2YWlsYWJsZSA9IHRoaXMuY29udGFpbmVyLm9mZnNldFdpZHRoO1xuXHRcdGxldCBjdXJyZW50U2l6ZSA9IDA7XG5cdFx0bGV0IGZ1bGwgPSB0aGlzLmlzQ29tcGFjdDtcblx0XHRjb25zdCBwcmV2TnVtTWVudXNTaG93biA9IHRoaXMubnVtTWVudXNTaG93bjtcblx0XHR0aGlzLm51bU1lbnVzU2hvd24gPSAwO1xuXG5cdFx0Y29uc3Qgc2hvd2FibGVNZW51cyA9IHRoaXMubWVudXMuZmlsdGVyKG1lbnUgPT4gbWVudS5idXR0b25FbGVtZW50ICE9PSB1bmRlZmluZWQgJiYgbWVudS50aXRsZUVsZW1lbnQgIT09IHVuZGVmaW5lZCkgYXMgKE1lbnVCYXJNZW51V2l0aEVsZW1lbnRzICYgeyB0aXRsZUVsZW1lbnQ6IEhUTUxFbGVtZW50OyBidXR0b25FbGVtZW50OiBIVE1MRWxlbWVudCB9KVtdO1xuXHRcdGZvciAoY29uc3QgbWVudUJhck1lbnUgb2Ygc2hvd2FibGVNZW51cykge1xuXHRcdFx0aWYgKCFmdWxsKSB7XG5cdFx0XHRcdGNvbnN0IHNpemUgPSBtZW51QmFyTWVudS5idXR0b25FbGVtZW50Lm9mZnNldFdpZHRoO1xuXHRcdFx0XHRpZiAoY3VycmVudFNpemUgKyBzaXplID4gc2l6ZUF2YWlsYWJsZSkge1xuXHRcdFx0XHRcdGZ1bGwgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGN1cnJlbnRTaXplICs9IHNpemU7XG5cdFx0XHRcdFx0dGhpcy5udW1NZW51c1Nob3duKys7XG5cdFx0XHRcdFx0aWYgKHRoaXMubnVtTWVudXNTaG93biA+IHByZXZOdW1NZW51c1Nob3duKSB7XG5cdFx0XHRcdFx0XHRtZW51QmFyTWVudS5idXR0b25FbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChmdWxsKSB7XG5cdFx0XHRcdG1lbnVCYXJNZW51LmJ1dHRvbkVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuXHRcdFx0fVxuXHRcdH1cblxuXG5cdFx0Ly8gSWYgYmVsb3cgbWluaW1pdW0gbWVudSB0aHJlc2hvbGQsIHNob3cgdGhlIG92ZXJmbG93IG1lbnUgb25seSBhcyBoYW1idXJnZXIgbWVudVxuXHRcdGlmICh0aGlzLm51bU1lbnVzU2hvd24gLSAxIDw9IHNob3dhYmxlTWVudXMubGVuZ3RoIC8gNCkge1xuXHRcdFx0Zm9yIChjb25zdCBtZW51QmFyTWVudSBvZiBzaG93YWJsZU1lbnVzKSB7XG5cdFx0XHRcdG1lbnVCYXJNZW51LmJ1dHRvbkVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuXHRcdFx0fVxuXG5cdFx0XHRmdWxsID0gdHJ1ZTtcblx0XHRcdHRoaXMubnVtTWVudXNTaG93biA9IDA7XG5cdFx0XHRjdXJyZW50U2l6ZSA9IDA7XG5cdFx0fVxuXG5cdFx0Ly8gT3ZlcmZsb3dcblx0XHRpZiAodGhpcy5pc0NvbXBhY3QpIHtcblx0XHRcdHRoaXMub3ZlcmZsb3dNZW51LmFjdGlvbnMgPSBbXTtcblx0XHRcdGZvciAobGV0IGlkeCA9IHRoaXMubnVtTWVudXNTaG93bjsgaWR4IDwgdGhpcy5tZW51cy5sZW5ndGg7IGlkeCsrKSB7XG5cdFx0XHRcdHRoaXMub3ZlcmZsb3dNZW51LmFjdGlvbnMucHVzaChuZXcgU3VibWVudUFjdGlvbihgbWVudWJhci5zdWJtZW51LiR7dGhpcy5tZW51c1tpZHhdLmxhYmVsfWAsIHRoaXMubWVudXNbaWR4XS5sYWJlbCwgdGhpcy5tZW51c1tpZHhdLmFjdGlvbnMgfHwgW10pKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29tcGFjdE1lbnVBY3Rpb25zID0gdGhpcy5vcHRpb25zLmdldENvbXBhY3RNZW51QWN0aW9ucz8uKCk7XG5cdFx0XHRpZiAoY29tcGFjdE1lbnVBY3Rpb25zICYmIGNvbXBhY3RNZW51QWN0aW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5vdmVyZmxvd01lbnUuYWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHRcdHRoaXMub3ZlcmZsb3dNZW51LmFjdGlvbnMucHVzaCguLi5jb21wYWN0TWVudUFjdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm92ZXJmbG93TWVudS5idXR0b25FbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG5cdFx0fSBlbHNlIGlmIChmdWxsKSB7XG5cdFx0XHQvLyBDYW4ndCBmaXQgdGhlIG1vcmUgYnV0dG9uLCBuZWVkIHRvIHJlbW92ZSBtb3JlIG1lbnVzXG5cdFx0XHR3aGlsZSAoY3VycmVudFNpemUgKyB0aGlzLm92ZXJmbG93TWVudS5idXR0b25FbGVtZW50Lm9mZnNldFdpZHRoID4gc2l6ZUF2YWlsYWJsZSAmJiB0aGlzLm51bU1lbnVzU2hvd24gPiAwKSB7XG5cdFx0XHRcdHRoaXMubnVtTWVudXNTaG93bi0tO1xuXHRcdFx0XHRjb25zdCBzaXplID0gc2hvd2FibGVNZW51c1t0aGlzLm51bU1lbnVzU2hvd25dLmJ1dHRvbkVsZW1lbnQub2Zmc2V0V2lkdGg7XG5cdFx0XHRcdHNob3dhYmxlTWVudXNbdGhpcy5udW1NZW51c1Nob3duXS5idXR0b25FbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcblx0XHRcdFx0Y3VycmVudFNpemUgLT0gc2l6ZTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5vdmVyZmxvd01lbnUuYWN0aW9ucyA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaWR4ID0gdGhpcy5udW1NZW51c1Nob3duOyBpZHggPCBzaG93YWJsZU1lbnVzLmxlbmd0aDsgaWR4KyspIHtcblx0XHRcdFx0dGhpcy5vdmVyZmxvd01lbnUuYWN0aW9ucy5wdXNoKG5ldyBTdWJtZW51QWN0aW9uKGBtZW51YmFyLnN1Ym1lbnUuJHtzaG93YWJsZU1lbnVzW2lkeF0ubGFiZWx9YCwgc2hvd2FibGVNZW51c1tpZHhdLmxhYmVsLCBzaG93YWJsZU1lbnVzW2lkeF0uYWN0aW9ucyB8fCBbXSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5vdmVyZmxvd01lbnUuYnV0dG9uRWxlbWVudC5uZXh0RWxlbWVudFNpYmxpbmcgIT09IHNob3dhYmxlTWVudXNbdGhpcy5udW1NZW51c1Nob3duXS5idXR0b25FbGVtZW50KSB7XG5cdFx0XHRcdHRoaXMub3ZlcmZsb3dNZW51LmJ1dHRvbkVsZW1lbnQucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLmluc2VydEJlZm9yZSh0aGlzLm92ZXJmbG93TWVudS5idXR0b25FbGVtZW50LCBzaG93YWJsZU1lbnVzW3RoaXMubnVtTWVudXNTaG93bl0uYnV0dG9uRWxlbWVudCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMub3ZlcmZsb3dNZW51LmJ1dHRvbkVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9ICd2aXNpYmxlJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5vdmVyZmxvd01lbnUuYnV0dG9uRWxlbWVudC5yZW1vdmUoKTtcblx0XHRcdHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMub3ZlcmZsb3dNZW51LmJ1dHRvbkVsZW1lbnQpO1xuXHRcdFx0dGhpcy5vdmVyZmxvd01lbnUuYnV0dG9uRWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgd2UgYXJlIG9ubHkgc2hvd2luZyB0aGUgb3ZlcmZsb3csIGFkZCB0aGlzIGNsYXNzIHRvIGF2b2lkIHRha2luZyB1cCBzcGFjZVxuXHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUob3ZlcmZsb3dNZW51T25seUNsYXNzLCB0aGlzLm51bU1lbnVzU2hvd24gPT09IDApO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVMYWJlbHModGl0bGVFbGVtZW50OiBIVE1MRWxlbWVudCwgYnV0dG9uRWxlbWVudDogSFRNTEVsZW1lbnQsIGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBjbGVhbk1lbnVMYWJlbCA9IGNsZWFuTW5lbW9uaWMobGFiZWwpO1xuXG5cdFx0Ly8gVXBkYXRlIHRoZSBidXR0b24gbGFiZWwgdG8gcmVmbGVjdCBtbmVtb25pY3NcblxuXHRcdGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlTW5lbW9uaWNzKSB7XG5cdFx0XHRjb25zdCBjbGVhbkxhYmVsID0gc3RyaW5ncy5lc2NhcGUobGFiZWwpO1xuXG5cdFx0XHQvLyBUaGlzIGlzIGdsb2JhbCBzbyByZXNldCBpdFxuXHRcdFx0TUVOVV9FU0NBUEVEX01ORU1PTklDX1JFR0VYLmxhc3RJbmRleCA9IDA7XG5cdFx0XHRsZXQgZXNjTWF0Y2ggPSBNRU5VX0VTQ0FQRURfTU5FTU9OSUNfUkVHRVguZXhlYyhjbGVhbkxhYmVsKTtcblxuXHRcdFx0Ly8gV2UgY2FuJ3QgdXNlIG5lZ2F0aXZlIGxvb2tiZWhpbmQgc28gd2UgbWF0Y2ggb3VyIG5lZ2F0aXZlIGFuZCBza2lwXG5cdFx0XHR3aGlsZSAoZXNjTWF0Y2ggJiYgZXNjTWF0Y2hbMV0pIHtcblx0XHRcdFx0ZXNjTWF0Y2ggPSBNRU5VX0VTQ0FQRURfTU5FTU9OSUNfUkVHRVguZXhlYyhjbGVhbkxhYmVsKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVwbGFjZURvdWJsZUVzY2FwZXMgPSAoc3RyOiBzdHJpbmcpID0+IHN0ci5yZXBsYWNlKC8mYW1wOyZhbXA7L2csICcmYW1wOycpO1xuXG5cdFx0XHRpZiAoZXNjTWF0Y2gpIHtcblx0XHRcdFx0dGl0bGVFbGVtZW50LmlubmVyVGV4dCA9ICcnO1xuXHRcdFx0XHR0aXRsZUVsZW1lbnQuYXBwZW5kKFxuXHRcdFx0XHRcdHN0cmluZ3MubHRyaW0ocmVwbGFjZURvdWJsZUVzY2FwZXMoY2xlYW5MYWJlbC5zdWJzdHIoMCwgZXNjTWF0Y2guaW5kZXgpKSwgJyAnKSxcblx0XHRcdFx0XHQkKCdtbmVtb25pYycsIHsgJ2FyaWEtaGlkZGVuJzogJ3RydWUnIH0sIGVzY01hdGNoWzNdKSxcblx0XHRcdFx0XHRzdHJpbmdzLnJ0cmltKHJlcGxhY2VEb3VibGVFc2NhcGVzKGNsZWFuTGFiZWwuc3Vic3RyKGVzY01hdGNoLmluZGV4ICsgZXNjTWF0Y2hbMF0ubGVuZ3RoKSksICcgJylcblx0XHRcdFx0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRpdGxlRWxlbWVudC5pbm5lclRleHQgPSByZXBsYWNlRG91YmxlRXNjYXBlcyhjbGVhbkxhYmVsKS50cmltKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRpdGxlRWxlbWVudC5pbm5lclRleHQgPSBjbGVhbk1lbnVMYWJlbC5yZXBsYWNlKC8mJi9nLCAnJicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1uZW1vbmljTWF0Y2hlcyA9IE1FTlVfTU5FTU9OSUNfUkVHRVguZXhlYyhsYWJlbCk7XG5cblx0XHQvLyBSZWdpc3RlciBtbmVtb25pY3Ncblx0XHRpZiAobW5lbW9uaWNNYXRjaGVzKSB7XG5cdFx0XHRjb25zdCBtbmVtb25pYyA9ICEhbW5lbW9uaWNNYXRjaGVzWzFdID8gbW5lbW9uaWNNYXRjaGVzWzFdIDogbW5lbW9uaWNNYXRjaGVzWzNdO1xuXG5cdFx0XHRpZiAodGhpcy5vcHRpb25zLmVuYWJsZU1uZW1vbmljcykge1xuXHRcdFx0XHRidXR0b25FbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1rZXlzaG9ydGN1dHMnLCAnQWx0KycgKyBtbmVtb25pYy50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGJ1dHRvbkVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWtleXNob3J0Y3V0cycpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZShvcHRpb25zPzogSU1lbnVCYXJPcHRpb25zKTogdm9pZCB7XG5cdFx0aWYgKG9wdGlvbnMpIHtcblx0XHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0fVxuXG5cdFx0Ly8gRG9uJ3QgdXBkYXRlIHdoaWxlIHVzaW5nIHRoZSBtZW51XG5cdFx0aWYgKHRoaXMuaXNGb2N1c2VkKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVBlbmRpbmcgPSB0cnVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMubWVudXMuZm9yRWFjaChtZW51QmFyTWVudSA9PiB7XG5cdFx0XHRpZiAoIW1lbnVCYXJNZW51LmJ1dHRvbkVsZW1lbnQgfHwgIW1lbnVCYXJNZW51LnRpdGxlRWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudXBkYXRlTGFiZWxzKG1lbnVCYXJNZW51LnRpdGxlRWxlbWVudCwgbWVudUJhck1lbnUuYnV0dG9uRWxlbWVudCwgbWVudUJhck1lbnUubGFiZWwpO1xuXHRcdH0pO1xuXG5cdFx0aWYgKCF0aGlzLm92ZXJmbG93TGF5b3V0U2NoZWR1bGVkKSB7XG5cdFx0XHR0aGlzLm92ZXJmbG93TGF5b3V0U2NoZWR1bGVkID0gRE9NLnNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoRE9NLmdldFdpbmRvdyh0aGlzLmNvbnRhaW5lciksICgpID0+IHtcblx0XHRcdFx0dGhpcy51cGRhdGVPdmVyZmxvd0FjdGlvbigpO1xuXHRcdFx0XHR0aGlzLm92ZXJmbG93TGF5b3V0U2NoZWR1bGVkID0gdW5kZWZpbmVkO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRVbmZvY3VzZWRTdGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlck1uZW1vbmljKG1lbnVJbmRleDogbnVtYmVyLCBtbmVtb25pYzogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5tbmVtb25pY3Muc2V0KG1uZW1vbmljLnRvTG9jYWxlTG93ZXJDYXNlKCksIG1lbnVJbmRleCk7XG5cdH1cblxuXHRwcml2YXRlIGhpZGVNZW51YmFyKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZScpIHtcblx0XHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0aGlzLl9vblZpc2liaWxpdHlDaGFuZ2UuZmlyZShmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzaG93TWVudWJhcigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jb250YWluZXIuc3R5bGUuZGlzcGxheSAhPT0gJ2ZsZXgnKSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdFx0dGhpcy5fb25WaXNpYmlsaXR5Q2hhbmdlLmZpcmUodHJ1ZSk7XG5cblx0XHRcdHRoaXMudXBkYXRlT3ZlcmZsb3dBY3Rpb24oKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldCBmb2N1c1N0YXRlKCk6IE1lbnViYXJTdGF0ZSB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZvY3VzU3RhdGU7XG5cdH1cblxuXHRwcml2YXRlIHNldCBmb2N1c1N0YXRlKHZhbHVlOiBNZW51YmFyU3RhdGUpIHtcblx0XHRpZiAodGhpcy5fZm9jdXNTdGF0ZSA+PSBNZW51YmFyU3RhdGUuRk9DVVNFRCAmJiB2YWx1ZSA8IE1lbnViYXJTdGF0ZS5GT0NVU0VEKSB7XG5cdFx0XHQvLyBMb3NpbmcgZm9jdXMsIHVwZGF0ZSB0aGUgbWVudSBpZiBuZWVkZWRcblxuXHRcdFx0aWYgKHRoaXMudXBkYXRlUGVuZGluZykge1xuXHRcdFx0XHR0aGlzLm1lbnVVcGRhdGVyLnNjaGVkdWxlKCk7XG5cdFx0XHRcdHRoaXMudXBkYXRlUGVuZGluZyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh2YWx1ZSA9PT0gdGhpcy5fZm9jdXNTdGF0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzVmlzaWJsZSA9IHRoaXMuaXNWaXNpYmxlO1xuXHRcdGNvbnN0IGlzT3BlbiA9IHRoaXMuaXNPcGVuO1xuXHRcdGNvbnN0IGlzRm9jdXNlZCA9IHRoaXMuaXNGb2N1c2VkO1xuXG5cdFx0dGhpcy5fZm9jdXNTdGF0ZSA9IHZhbHVlO1xuXG5cdFx0c3dpdGNoICh2YWx1ZSkge1xuXHRcdFx0Y2FzZSBNZW51YmFyU3RhdGUuSElEREVOOlxuXHRcdFx0XHRpZiAoaXNWaXNpYmxlKSB7XG5cdFx0XHRcdFx0dGhpcy5oaWRlTWVudWJhcigpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGlzT3Blbikge1xuXHRcdFx0XHRcdHRoaXMuY2xlYW51cEN1c3RvbU1lbnUoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpc0ZvY3VzZWQpIHtcblx0XHRcdFx0XHR0aGlzLmZvY3VzZWRNZW51ID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMuZm9jdXNUb1JldHVybikge1xuXHRcdFx0XHRcdFx0dGhpcy5mb2N1c1RvUmV0dXJuLmZvY3VzKCk7XG5cdFx0XHRcdFx0XHR0aGlzLmZvY3VzVG9SZXR1cm4gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgTWVudWJhclN0YXRlLlZJU0lCTEU6XG5cdFx0XHRcdGlmICghaXNWaXNpYmxlKSB7XG5cdFx0XHRcdFx0dGhpcy5zaG93TWVudWJhcigpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGlzT3Blbikge1xuXHRcdFx0XHRcdHRoaXMuY2xlYW51cEN1c3RvbU1lbnUoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpc0ZvY3VzZWQpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5mb2N1c2VkTWVudSkge1xuXHRcdFx0XHRcdFx0aWYgKHRoaXMuZm9jdXNlZE1lbnUuaW5kZXggPT09IE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVgpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5vdmVyZmxvd01lbnUuYnV0dG9uRWxlbWVudC5ibHVyKCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzLm1lbnVzW3RoaXMuZm9jdXNlZE1lbnUuaW5kZXhdLmJ1dHRvbkVsZW1lbnQ/LmJsdXIoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLmZvY3VzZWRNZW51ID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMuZm9jdXNUb1JldHVybikge1xuXHRcdFx0XHRcdFx0dGhpcy5mb2N1c1RvUmV0dXJuLmZvY3VzKCk7XG5cdFx0XHRcdFx0XHR0aGlzLmZvY3VzVG9SZXR1cm4gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIE1lbnViYXJTdGF0ZS5GT0NVU0VEOlxuXHRcdFx0XHRpZiAoIWlzVmlzaWJsZSkge1xuXHRcdFx0XHRcdHRoaXMuc2hvd01lbnViYXIoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpc09wZW4pIHtcblx0XHRcdFx0XHR0aGlzLmNsZWFudXBDdXN0b21NZW51KCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5mb2N1c2VkTWVudSkge1xuXHRcdFx0XHRcdC8vIFdoZW4gdGhlIG1lbnUgaXMgdG9nZ2xlZCBvbiwgaXQgbWF5IGJlIGluIGNvbXBhY3Qgc3RhdGUgYW5kIHRyeWluZyB0b1xuXHRcdFx0XHRcdC8vIGZvY3VzIHRoZSBmaXJzdCBtZW51LiBJbiB0aGlzIGNhc2Ugd2Ugc2hvdWxkIGZvY3VzIHRoZSBvdmVyZmxvdyBpbnN0ZWFkLlxuXHRcdFx0XHRcdGlmICh0aGlzLmZvY3VzZWRNZW51LmluZGV4ID09PSAwICYmIHRoaXMubnVtTWVudXNTaG93biA9PT0gMCkge1xuXHRcdFx0XHRcdFx0dGhpcy5mb2N1c2VkTWVudS5pbmRleCA9IE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVg7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHRoaXMuZm9jdXNlZE1lbnUuaW5kZXggPT09IE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVgpIHtcblx0XHRcdFx0XHRcdHRoaXMub3ZlcmZsb3dNZW51LmJ1dHRvbkVsZW1lbnQuZm9jdXMoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5tZW51c1t0aGlzLmZvY3VzZWRNZW51LmluZGV4XS5idXR0b25FbGVtZW50Py5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgTWVudWJhclN0YXRlLk9QRU46XG5cdFx0XHRcdGlmICghaXNWaXNpYmxlKSB7XG5cdFx0XHRcdFx0dGhpcy5zaG93TWVudWJhcigpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMuZm9jdXNlZE1lbnUpIHtcblx0XHRcdFx0XHR0aGlzLmNsZWFudXBDdXN0b21NZW51KCk7XG5cdFx0XHRcdFx0dGhpcy5zaG93Q3VzdG9tTWVudSh0aGlzLmZvY3VzZWRNZW51LmluZGV4LCB0aGlzLm9wZW5lZFZpYUtleWJvYXJkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHR0aGlzLl9mb2N1c1N0YXRlID0gdmFsdWU7XG5cdFx0dGhpcy5fb25Gb2N1c1N0YXRlQ2hhbmdlLmZpcmUodGhpcy5mb2N1c1N0YXRlID49IE1lbnViYXJTdGF0ZS5GT0NVU0VEKTtcblx0fVxuXG5cdGdldCBpc1Zpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZm9jdXNTdGF0ZSA+PSBNZW51YmFyU3RhdGUuVklTSUJMRTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGlzRm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5mb2N1c1N0YXRlID49IE1lbnViYXJTdGF0ZS5GT0NVU0VEO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgaXNPcGVuKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmZvY3VzU3RhdGUgPj0gTWVudWJhclN0YXRlLk9QRU47XG5cdH1cblxuXHRwcml2YXRlIGdldCBoYXNPdmVyZmxvdygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pc0NvbXBhY3QgfHwgdGhpcy5udW1NZW51c1Nob3duIDwgdGhpcy5tZW51cy5sZW5ndGg7XG5cdH1cblxuXHRwcml2YXRlIGdldCBpc0NvbXBhY3QoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMub3B0aW9ucy5jb21wYWN0TW9kZSAhPT0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRVbmZvY3VzZWRTdGF0ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5vcHRpb25zLnZpc2liaWxpdHkgPT09ICd0b2dnbGUnIHx8IHRoaXMub3B0aW9ucy52aXNpYmlsaXR5ID09PSAnaGlkZGVuJykge1xuXHRcdFx0dGhpcy5mb2N1c1N0YXRlID0gTWVudWJhclN0YXRlLkhJRERFTjtcblx0XHR9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy52aXNpYmlsaXR5ID09PSAnY2xhc3NpYycgJiYgYnJvd3Nlci5pc0Z1bGxzY3JlZW4obWFpbldpbmRvdykpIHtcblx0XHRcdHRoaXMuZm9jdXNTdGF0ZSA9IE1lbnViYXJTdGF0ZS5ISURERU47XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZm9jdXNTdGF0ZSA9IE1lbnViYXJTdGF0ZS5WSVNJQkxFO1xuXHRcdH1cblxuXHRcdHRoaXMuaWdub3JlTmV4dE1vdXNlVXAgPSBmYWxzZTtcblx0XHR0aGlzLm1uZW1vbmljc0luVXNlID0gZmFsc2U7XG5cdFx0dGhpcy51cGRhdGVNbmVtb25pY1Zpc2liaWxpdHkoZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBmb2N1c1ByZXZpb3VzKCk6IHZvaWQge1xuXG5cdFx0aWYgKCF0aGlzLmZvY3VzZWRNZW51IHx8IHRoaXMubnVtTWVudXNTaG93biA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXG5cdFx0bGV0IG5ld0ZvY3VzZWRJbmRleCA9ICh0aGlzLmZvY3VzZWRNZW51LmluZGV4IC0gMSArIHRoaXMubnVtTWVudXNTaG93bikgJSB0aGlzLm51bU1lbnVzU2hvd247XG5cdFx0aWYgKHRoaXMuZm9jdXNlZE1lbnUuaW5kZXggPT09IE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVgpIHtcblx0XHRcdG5ld0ZvY3VzZWRJbmRleCA9IHRoaXMubnVtTWVudXNTaG93biAtIDE7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmZvY3VzZWRNZW51LmluZGV4ID09PSAwICYmIHRoaXMuaGFzT3ZlcmZsb3cpIHtcblx0XHRcdG5ld0ZvY3VzZWRJbmRleCA9IE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVg7XG5cdFx0fVxuXG5cdFx0aWYgKG5ld0ZvY3VzZWRJbmRleCA9PT0gdGhpcy5mb2N1c2VkTWVudS5pbmRleCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzT3Blbikge1xuXHRcdFx0dGhpcy5jbGVhbnVwQ3VzdG9tTWVudSgpO1xuXHRcdFx0dGhpcy5zaG93Q3VzdG9tTWVudShuZXdGb2N1c2VkSW5kZXgpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5pc0ZvY3VzZWQpIHtcblx0XHRcdHRoaXMuZm9jdXNlZE1lbnUuaW5kZXggPSBuZXdGb2N1c2VkSW5kZXg7XG5cdFx0XHRpZiAobmV3Rm9jdXNlZEluZGV4ID09PSBNZW51QmFyLk9WRVJGTE9XX0lOREVYKSB7XG5cdFx0XHRcdHRoaXMub3ZlcmZsb3dNZW51LmJ1dHRvbkVsZW1lbnQuZm9jdXMoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubWVudXNbbmV3Rm9jdXNlZEluZGV4XS5idXR0b25FbGVtZW50Py5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZm9jdXNOZXh0KCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5mb2N1c2VkTWVudSB8fCB0aGlzLm51bU1lbnVzU2hvd24gPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgbmV3Rm9jdXNlZEluZGV4ID0gKHRoaXMuZm9jdXNlZE1lbnUuaW5kZXggKyAxKSAlIHRoaXMubnVtTWVudXNTaG93bjtcblx0XHRpZiAodGhpcy5mb2N1c2VkTWVudS5pbmRleCA9PT0gTWVudUJhci5PVkVSRkxPV19JTkRFWCkge1xuXHRcdFx0bmV3Rm9jdXNlZEluZGV4ID0gMDtcblx0XHR9IGVsc2UgaWYgKHRoaXMuZm9jdXNlZE1lbnUuaW5kZXggPT09IHRoaXMubnVtTWVudXNTaG93biAtIDEpIHtcblx0XHRcdG5ld0ZvY3VzZWRJbmRleCA9IE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVg7XG5cdFx0fVxuXG5cdFx0aWYgKG5ld0ZvY3VzZWRJbmRleCA9PT0gdGhpcy5mb2N1c2VkTWVudS5pbmRleCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzT3Blbikge1xuXHRcdFx0dGhpcy5jbGVhbnVwQ3VzdG9tTWVudSgpO1xuXHRcdFx0dGhpcy5zaG93Q3VzdG9tTWVudShuZXdGb2N1c2VkSW5kZXgpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5pc0ZvY3VzZWQpIHtcblx0XHRcdHRoaXMuZm9jdXNlZE1lbnUuaW5kZXggPSBuZXdGb2N1c2VkSW5kZXg7XG5cdFx0XHRpZiAobmV3Rm9jdXNlZEluZGV4ID09PSBNZW51QmFyLk9WRVJGTE9XX0lOREVYKSB7XG5cdFx0XHRcdHRoaXMub3ZlcmZsb3dNZW51LmJ1dHRvbkVsZW1lbnQuZm9jdXMoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubWVudXNbbmV3Rm9jdXNlZEluZGV4XS5idXR0b25FbGVtZW50Py5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlTW5lbW9uaWNWaXNpYmlsaXR5KHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5tZW51cykge1xuXHRcdFx0dGhpcy5tZW51cy5mb3JFYWNoKG1lbnVCYXJNZW51ID0+IHtcblx0XHRcdFx0aWYgKG1lbnVCYXJNZW51LnRpdGxlRWxlbWVudCAmJiBtZW51QmFyTWVudS50aXRsZUVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2hpbGQgPSBtZW51QmFyTWVudS50aXRsZUVsZW1lbnQuY2hpbGRyZW4uaXRlbSgwKSBhcyBIVE1MRWxlbWVudDtcblx0XHRcdFx0XHRpZiAoY2hpbGQpIHtcblx0XHRcdFx0XHRcdGNoaWxkLnN0eWxlLnRleHREZWNvcmF0aW9uID0gKHRoaXMub3B0aW9ucy5hbHdheXNPbk1uZW1vbmljcyB8fCB2aXNpYmxlKSA/ICd1bmRlcmxpbmUnIDogJyc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldCBtbmVtb25pY3NJblVzZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fbW5lbW9uaWNzSW5Vc2U7XG5cdH1cblxuXHRwcml2YXRlIHNldCBtbmVtb25pY3NJblVzZSh2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX21uZW1vbmljc0luVXNlID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIGdldCBzaG91bGRBbHRLZXlGb2N1cygpOiBib29sZWFuIHtcblx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMub3B0aW9ucy5kaXNhYmxlQWx0Rm9jdXMpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLm9wdGlvbnMudmlzaWJpbGl0eSA9PT0gJ3RvZ2dsZScpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgb25WaXNpYmlsaXR5Q2hhbmdlKCk6IEV2ZW50PGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25WaXNpYmlsaXR5Q2hhbmdlLmV2ZW50O1xuXHR9XG5cblx0cHVibGljIGdldCBvbkZvY3VzU3RhdGVDaGFuZ2UoKTogRXZlbnQ8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkZvY3VzU3RhdGVDaGFuZ2UuZXZlbnQ7XG5cdH1cblxuXHRwcml2YXRlIG9uTWVudVRyaWdnZXJlZChtZW51SW5kZXg6IG51bWJlciwgY2xpY2tlZDogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLmlzT3Blbikge1xuXHRcdFx0aWYgKHRoaXMuaXNDdXJyZW50TWVudShtZW51SW5kZXgpKSB7XG5cdFx0XHRcdHRoaXMuc2V0VW5mb2N1c2VkU3RhdGUoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuY2xlYW51cEN1c3RvbU1lbnUoKTtcblx0XHRcdFx0dGhpcy5zaG93Q3VzdG9tTWVudShtZW51SW5kZXgsIHRoaXMub3BlbmVkVmlhS2V5Ym9hcmQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmZvY3VzZWRNZW51ID0geyBpbmRleDogbWVudUluZGV4IH07XG5cdFx0XHR0aGlzLm9wZW5lZFZpYUtleWJvYXJkID0gIWNsaWNrZWQ7XG5cdFx0XHR0aGlzLmZvY3VzU3RhdGUgPSBNZW51YmFyU3RhdGUuT1BFTjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uTW9kaWZpZXJLZXlUb2dnbGVkKG1vZGlmaWVyS2V5U3RhdHVzOiBET00uSU1vZGlmaWVyS2V5U3RhdHVzKTogdm9pZCB7XG5cdFx0Y29uc3QgYWxsTW9kaWZpZXJzUmVsZWFzZWQgPSAhbW9kaWZpZXJLZXlTdGF0dXMuYWx0S2V5ICYmICFtb2RpZmllcktleVN0YXR1cy5jdHJsS2V5ICYmICFtb2RpZmllcktleVN0YXR1cy5zaGlmdEtleSAmJiAhbW9kaWZpZXJLZXlTdGF0dXMubWV0YUtleTtcblxuXHRcdGlmICh0aGlzLm9wdGlvbnMudmlzaWJpbGl0eSA9PT0gJ2hpZGRlbicpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBQcmV2ZW50IGFsdC1rZXkgZGVmYXVsdCBpZiB0aGUgbWVudSBpcyBub3QgaGlkZGVuIGFuZCB3ZSB1c2UgYWx0IHRvIGZvY3VzXG5cdFx0aWYgKG1vZGlmaWVyS2V5U3RhdHVzLmV2ZW50ICYmIHRoaXMuc2hvdWxkQWx0S2V5Rm9jdXMpIHtcblx0XHRcdGlmIChTY2FuQ29kZVV0aWxzLnRvRW51bShtb2RpZmllcktleVN0YXR1cy5ldmVudC5jb2RlKSA9PT0gU2NhbkNvZGUuQWx0TGVmdCkge1xuXHRcdFx0XHRtb2RpZmllcktleVN0YXR1cy5ldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFsdCBrZXkgcHJlc3NlZCB3aGlsZSBtZW51IGlzIGZvY3VzZWQuIFRoaXMgc2hvdWxkIHJldHVybiBmb2N1cyBhd2F5IGZyb20gdGhlIG1lbnViYXJcblx0XHRpZiAodGhpcy5pc0ZvY3VzZWQgJiYgbW9kaWZpZXJLZXlTdGF0dXMubGFzdEtleVByZXNzZWQgPT09ICdhbHQnICYmIG1vZGlmaWVyS2V5U3RhdHVzLmFsdEtleSkge1xuXHRcdFx0dGhpcy5zZXRVbmZvY3VzZWRTdGF0ZSgpO1xuXHRcdFx0dGhpcy5tbmVtb25pY3NJblVzZSA9IGZhbHNlO1xuXHRcdFx0dGhpcy5hd2FpdGluZ0FsdFJlbGVhc2UgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIENsZWFuIGFsdCBrZXkgcHJlc3MgYW5kIHJlbGVhc2Vcblx0XHRpZiAoYWxsTW9kaWZpZXJzUmVsZWFzZWQgJiYgbW9kaWZpZXJLZXlTdGF0dXMubGFzdEtleVByZXNzZWQgPT09ICdhbHQnICYmIG1vZGlmaWVyS2V5U3RhdHVzLmxhc3RLZXlSZWxlYXNlZCA9PT0gJ2FsdCcpIHtcblx0XHRcdGlmICghdGhpcy5hd2FpdGluZ0FsdFJlbGVhc2UpIHtcblx0XHRcdFx0aWYgKCF0aGlzLmlzRm9jdXNlZCAmJiB0aGlzLnNob3VsZEFsdEtleUZvY3VzKSB7XG5cdFx0XHRcdFx0dGhpcy5tbmVtb25pY3NJblVzZSA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c2VkTWVudSA9IHsgaW5kZXg6IHRoaXMubnVtTWVudXNTaG93biA+IDAgPyAwIDogTWVudUJhci5PVkVSRkxPV19JTkRFWCB9O1xuXHRcdFx0XHRcdHRoaXMuZm9jdXNTdGF0ZSA9IE1lbnViYXJTdGF0ZS5GT0NVU0VEO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCF0aGlzLmlzT3Blbikge1xuXHRcdFx0XHRcdHRoaXMuc2V0VW5mb2N1c2VkU3RhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFsdCBrZXkgcmVsZWFzZWRcblx0XHRpZiAoIW1vZGlmaWVyS2V5U3RhdHVzLmFsdEtleSAmJiBtb2RpZmllcktleVN0YXR1cy5sYXN0S2V5UmVsZWFzZWQgPT09ICdhbHQnKSB7XG5cdFx0XHR0aGlzLmF3YWl0aW5nQWx0UmVsZWFzZSA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLm9wdGlvbnMuZW5hYmxlTW5lbW9uaWNzICYmIHRoaXMubWVudXMgJiYgIXRoaXMuaXNPcGVuKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZU1uZW1vbmljVmlzaWJpbGl0eSgoIXRoaXMuYXdhaXRpbmdBbHRSZWxlYXNlICYmIG1vZGlmaWVyS2V5U3RhdHVzLmFsdEtleSkgfHwgdGhpcy5tbmVtb25pY3NJblVzZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpc0N1cnJlbnRNZW51KG1lbnVJbmRleDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmZvY3VzZWRNZW51KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZm9jdXNlZE1lbnUuaW5kZXggPT09IG1lbnVJbmRleDtcblx0fVxuXG5cdHByaXZhdGUgY2xlYW51cEN1c3RvbU1lbnUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZm9jdXNlZE1lbnUpIHtcblx0XHRcdC8vIFJlbW92ZSBmb2N1cyBmcm9tIHRoZSBtZW51cyBmaXJzdFxuXHRcdFx0aWYgKHRoaXMuZm9jdXNlZE1lbnUuaW5kZXggPT09IE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVgpIHtcblx0XHRcdFx0dGhpcy5vdmVyZmxvd01lbnUuYnV0dG9uRWxlbWVudC5mb2N1cygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5tZW51c1t0aGlzLmZvY3VzZWRNZW51LmluZGV4XS5idXR0b25FbGVtZW50Py5mb2N1cygpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5mb2N1c2VkTWVudS5ob2xkZXIpIHtcblx0XHRcdFx0dGhpcy5mb2N1c2VkTWVudS5ob2xkZXIucGFyZW50RWxlbWVudD8uY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpO1xuXG5cdFx0XHRcdHRoaXMuZm9jdXNlZE1lbnUuaG9sZGVyLnJlbW92ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmZvY3VzZWRNZW51LndpZGdldD8uZGlzcG9zZSgpO1xuXG5cdFx0XHR0aGlzLmZvY3VzZWRNZW51ID0geyBpbmRleDogdGhpcy5mb2N1c2VkTWVudS5pbmRleCB9O1xuXHRcdH1cblx0XHR0aGlzLm1lbnVEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93Q3VzdG9tTWVudShtZW51SW5kZXg6IG51bWJlciwgc2VsZWN0Rmlyc3QgPSB0cnVlKTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0dWFsTWVudUluZGV4ID0gbWVudUluZGV4ID49IHRoaXMubnVtTWVudXNTaG93biA/IE1lbnVCYXIuT1ZFUkZMT1dfSU5ERVggOiBtZW51SW5kZXg7XG5cdFx0Y29uc3QgY3VzdG9tTWVudSA9IGFjdHVhbE1lbnVJbmRleCA9PT0gTWVudUJhci5PVkVSRkxPV19JTkRFWCA/IHRoaXMub3ZlcmZsb3dNZW51IDogdGhpcy5tZW51c1thY3R1YWxNZW51SW5kZXhdO1xuXG5cdFx0aWYgKCFjdXN0b21NZW51LmFjdGlvbnMgfHwgIWN1c3RvbU1lbnUuYnV0dG9uRWxlbWVudCB8fCAhY3VzdG9tTWVudS50aXRsZUVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtZW51SG9sZGVyID0gJCgnZGl2Lm1lbnViYXItbWVudS1pdGVtcy1ob2xkZXInLCB7ICd0aXRsZSc6ICcnIH0pO1xuXG5cdFx0Y3VzdG9tTWVudS5idXR0b25FbGVtZW50LmNsYXNzTGlzdC5hZGQoJ29wZW4nKTtcblxuXHRcdGNvbnN0IHRpdGxlQm91bmRpbmdSZWN0ID0gY3VzdG9tTWVudS50aXRsZUVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0Y29uc3QgdGl0bGVCb3VuZGluZ1JlY3Rab29tID0gRE9NLmdldERvbU5vZGVab29tTGV2ZWwoY3VzdG9tTWVudS50aXRsZUVsZW1lbnQpO1xuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5jb21wYWN0TW9kZT8uaG9yaXpvbnRhbCA9PT0gSG9yaXpvbnRhbERpcmVjdGlvbi5SaWdodCkge1xuXHRcdFx0bWVudUhvbGRlci5zdHlsZS5sZWZ0ID0gYCR7dGl0bGVCb3VuZGluZ1JlY3QubGVmdCArIHRoaXMuY29udGFpbmVyLmNsaWVudFdpZHRofXB4YDtcblx0XHR9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5jb21wYWN0TW9kZT8uaG9yaXpvbnRhbCA9PT0gSG9yaXpvbnRhbERpcmVjdGlvbi5MZWZ0KSB7XG5cdFx0XHRjb25zdCB3aW5kb3dXaWR0aCA9IERPTS5nZXRXaW5kb3codGhpcy5jb250YWluZXIpLmlubmVyV2lkdGg7XG5cdFx0XHRtZW51SG9sZGVyLnN0eWxlLnJpZ2h0ID0gYCR7d2luZG93V2lkdGggLSB0aXRsZUJvdW5kaW5nUmVjdC5sZWZ0fXB4YDtcblx0XHRcdG1lbnVIb2xkZXIuc3R5bGUubGVmdCA9ICdhdXRvJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWVudUhvbGRlci5zdHlsZS5sZWZ0ID0gYCR7dGl0bGVCb3VuZGluZ1JlY3QubGVmdCAqIHRpdGxlQm91bmRpbmdSZWN0Wm9vbX1weGA7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5jb21wYWN0TW9kZT8udmVydGljYWwgPT09IFZlcnRpY2FsRGlyZWN0aW9uLkFib3ZlKSB7XG5cdFx0XHQvLyBUT0RPQGJlbmliZW5qIERvIG5vdCBoYXJkY29kZSB0aGUgaGVpZ2h0IG9mIHRoZSBtZW51IGhvbGRlclxuXHRcdFx0bWVudUhvbGRlci5zdHlsZS50b3AgPSBgJHt0aXRsZUJvdW5kaW5nUmVjdC50b3AgLSB0aGlzLm1lbnVzLmxlbmd0aCAqIDMwICsgdGhpcy5jb250YWluZXIuY2xpZW50SGVpZ2h0fXB4YDtcblx0XHR9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5jb21wYWN0TW9kZT8udmVydGljYWwgPT09IFZlcnRpY2FsRGlyZWN0aW9uLkJlbG93KSB7XG5cdFx0XHRtZW51SG9sZGVyLnN0eWxlLnRvcCA9IGAke3RpdGxlQm91bmRpbmdSZWN0LnRvcH1weGA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1lbnVIb2xkZXIuc3R5bGUudG9wID0gYCR7dGl0bGVCb3VuZGluZ1JlY3QuYm90dG9tICogdGl0bGVCb3VuZGluZ1JlY3Rab29tfXB4YDtcblx0XHR9XG5cblx0XHRjdXN0b21NZW51LmJ1dHRvbkVsZW1lbnQuYXBwZW5kQ2hpbGQobWVudUhvbGRlcik7XG5cblx0XHRjb25zdCBtZW51T3B0aW9uczogSU1lbnVPcHRpb25zID0ge1xuXHRcdFx0Z2V0S2V5QmluZGluZzogdGhpcy5vcHRpb25zLmdldEtleWJpbmRpbmcsXG5cdFx0XHRhY3Rpb25SdW5uZXI6IHRoaXMuYWN0aW9uUnVubmVyLFxuXHRcdFx0ZW5hYmxlTW5lbW9uaWNzOiB0aGlzLm9wdGlvbnMuYWx3YXlzT25NbmVtb25pY3MgfHwgKHRoaXMubW5lbW9uaWNzSW5Vc2UgJiYgdGhpcy5vcHRpb25zLmVuYWJsZU1uZW1vbmljcyksXG5cdFx0XHRhcmlhTGFiZWw6IGN1c3RvbU1lbnUuYnV0dG9uRWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSA/PyB1bmRlZmluZWQsXG5cdFx0XHRleHBhbmREaXJlY3Rpb246IHRoaXMuaXNDb21wYWN0ID8gdGhpcy5vcHRpb25zLmNvbXBhY3RNb2RlIDogeyBob3Jpem9udGFsOiBIb3Jpem9udGFsRGlyZWN0aW9uLlJpZ2h0LCB2ZXJ0aWNhbDogVmVydGljYWxEaXJlY3Rpb24uQmVsb3cgfSxcblx0XHRcdHVzZUV2ZW50QXNDb250ZXh0OiB0cnVlXG5cdFx0fTtcblxuXHRcdGNvbnN0IG1lbnVXaWRnZXQgPSB0aGlzLm1lbnVEaXNwb3NhYmxlcy5hZGQobmV3IE1lbnUobWVudUhvbGRlciwgY3VzdG9tTWVudS5hY3Rpb25zLCBtZW51T3B0aW9ucywgdGhpcy5tZW51U3R5bGUpKTtcblx0XHR0aGlzLm1lbnVEaXNwb3NhYmxlcy5hZGQobWVudVdpZGdldC5vbkRpZENhbmNlbCgoKSA9PiB7XG5cdFx0XHR0aGlzLmZvY3VzU3RhdGUgPSBNZW51YmFyU3RhdGUuRk9DVVNFRDtcblx0XHR9KSk7XG5cblx0XHRpZiAoYWN0dWFsTWVudUluZGV4ICE9PSBtZW51SW5kZXgpIHtcblx0XHRcdG1lbnVXaWRnZXQudHJpZ2dlcihtZW51SW5kZXggLSB0aGlzLm51bU1lbnVzU2hvd24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZW51V2lkZ2V0LmZvY3VzKHNlbGVjdEZpcnN0KTtcblx0XHR9XG5cblx0XHR0aGlzLmZvY3VzZWRNZW51ID0ge1xuXHRcdFx0aW5kZXg6IGFjdHVhbE1lbnVJbmRleCxcblx0XHRcdGhvbGRlcjogbWVudUhvbGRlcixcblx0XHRcdHdpZGdl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
