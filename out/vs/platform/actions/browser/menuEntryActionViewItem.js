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
import { asCSSUrl } from "../../../base/browser/cssValue.js";
import { $, addDisposableListener, append, EventType, ModifierKeyEmitter, prepend } from "../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { ActionViewItem, BaseActionViewItem, SelectActionViewItem } from "../../../base/browser/ui/actionbar/actionViewItems.js";
import { DropdownMenuActionViewItem } from "../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { ActionRunner, Separator, SubmenuAction } from "../../../base/common/actions.js";
import { UILabelProvider } from "../../../base/common/keybindingLabels.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { combinedDisposable, DisposableStore, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { isLinux, isWindows, OS } from "../../../base/common/platform.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { assertType } from "../../../base/common/types.js";
import { localize } from "../../../nls.js";
import { IAccessibilityService } from "../../accessibility/common/accessibility.js";
import { isICommandActionToggleInfo } from "../../action/common/action.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../contextview/browser/contextView.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { INotificationService } from "../../notification/common/notification.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { defaultSelectBoxStyles } from "../../theme/browser/defaultStyles.js";
import { asCssVariable, selectBorder } from "../../theme/common/colorRegistry.js";
import { isDark } from "../../theme/common/theme.js";
import { IThemeService } from "../../theme/common/themeService.js";
import { IMenuService, MenuItemAction, SubmenuItemAction } from "../common/actions.js";
import "./menuEntryActionViewItem.css";
function getContextMenuActions(groups, primaryGroup) {
  const target = { primary: [], secondary: [] };
  getContextMenuActionsImpl(groups, target, primaryGroup);
  return target;
}
function getFlatContextMenuActions(groups, primaryGroup) {
  const target = [];
  getContextMenuActionsImpl(groups, target, primaryGroup);
  return target;
}
function getContextMenuActionsImpl(groups, target, primaryGroup) {
  const modifierKeyEmitter = ModifierKeyEmitter.getInstance();
  const useAlternativeActions = modifierKeyEmitter.keyStatus.altKey || (isWindows || isLinux) && modifierKeyEmitter.keyStatus.shiftKey;
  fillInActions(groups, target, useAlternativeActions, primaryGroup ? (actionGroup) => actionGroup === primaryGroup : (actionGroup) => actionGroup === "navigation");
}
function getActionBarActions(groups, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions) {
  const target = { primary: [], secondary: [] };
  fillInActionBarActions(groups, target, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
  return target;
}
function getFlatActionBarActions(groups, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions) {
  const target = [];
  fillInActionBarActions(groups, target, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
  return target;
}
function fillInActionBarActions(groups, target, primaryGroup, shouldInlineSubmenu, useSeparatorsInPrimaryActions) {
  const isPrimaryAction = typeof primaryGroup === "string" ? (actionGroup) => actionGroup === primaryGroup : primaryGroup;
  fillInActions(groups, target, false, isPrimaryAction, shouldInlineSubmenu, useSeparatorsInPrimaryActions);
}
function fillInActions(groups, target, useAlternativeActions, isPrimaryAction = (actionGroup) => actionGroup === "navigation", shouldInlineSubmenu = () => false, useSeparatorsInPrimaryActions = false) {
  let primaryBucket;
  let secondaryBucket;
  if (Array.isArray(target)) {
    primaryBucket = target;
    secondaryBucket = target;
  } else {
    primaryBucket = target.primary;
    secondaryBucket = target.secondary;
  }
  const submenuInfo = /* @__PURE__ */ new Set();
  for (const [group, actions] of groups) {
    let target2;
    if (isPrimaryAction(group)) {
      target2 = primaryBucket;
      if (target2.length > 0 && useSeparatorsInPrimaryActions) {
        target2.push(new Separator());
      }
    } else {
      target2 = secondaryBucket;
      if (target2.length > 0) {
        target2.push(new Separator());
      }
    }
    for (let action of actions) {
      if (useAlternativeActions) {
        action = action instanceof MenuItemAction && action.alt ? action.alt : action;
      }
      const newLen = target2.push(action);
      if (action instanceof SubmenuAction) {
        submenuInfo.add({ group, action, index: newLen - 1 });
      }
    }
  }
  for (const { group, action, index } of submenuInfo) {
    const target2 = isPrimaryAction(group) ? primaryBucket : secondaryBucket;
    const submenuActions = action.actions;
    if (shouldInlineSubmenu(action, group, target2.length)) {
      target2.splice(index, 1, ...submenuActions);
    }
  }
}
let MenuEntryActionViewItem = class extends ActionViewItem {
  constructor(action, _options, _keybindingService, _notificationService, _contextKeyService, _themeService, _contextMenuService, _accessibilityService) {
    super(void 0, action, { icon: !!(action.class || action.item.icon), label: !action.class && !action.item.icon, draggable: _options?.draggable, keybinding: _options?.keybinding, hoverDelegate: _options?.hoverDelegate, keybindingNotRenderedWithLabel: _options?.keybindingNotRenderedWithLabel });
    this._options = _options;
    this._keybindingService = _keybindingService;
    this._notificationService = _notificationService;
    this._contextKeyService = _contextKeyService;
    this._themeService = _themeService;
    this._contextMenuService = _contextMenuService;
    this._accessibilityService = _accessibilityService;
    this._wantsAltCommand = false;
    this._itemClassDispose = this._register(new MutableDisposable());
    this._altKey = ModifierKeyEmitter.getInstance();
  }
  get _menuItemAction() {
    return this._action;
  }
  get _commandAction() {
    return this._wantsAltCommand && this._menuItemAction.alt || this._menuItemAction;
  }
  async onClick(event) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await this.actionRunner.run(this._commandAction, this._context);
    } catch (err) {
      this._notificationService.error(err);
    }
  }
  render(container) {
    super.render(container);
    container.classList.add("menu-entry");
    if (this.options.icon) {
      this._updateItemClass(this._menuItemAction.item);
    }
    if (this._menuItemAction.alt) {
      let isMouseOver = false;
      const updateAltState = () => {
        const wantsAltCommand = !!this._menuItemAction.alt?.enabled && (!this._accessibilityService.isMotionReduced() || isMouseOver) && (this._altKey.keyStatus.altKey || this._altKey.keyStatus.shiftKey && isMouseOver);
        if (wantsAltCommand !== this._wantsAltCommand) {
          this._wantsAltCommand = wantsAltCommand;
          this.updateLabel();
          this.updateTooltip();
          this.updateClass();
        }
      };
      this._register(this._altKey.event(updateAltState));
      this._register(addDisposableListener(container, "mouseleave", (_) => {
        isMouseOver = false;
        updateAltState();
      }));
      this._register(addDisposableListener(container, "mouseenter", (_) => {
        isMouseOver = true;
        updateAltState();
      }));
      updateAltState();
    }
  }
  updateLabel() {
    if (this.options.label && this.label) {
      this.label.textContent = this._commandAction.label;
    }
  }
  getTooltip() {
    const keybinding = this._keybindingService.lookupKeybinding(this._commandAction.id, this._contextKeyService);
    const keybindingLabel = keybinding && keybinding.getLabel();
    const tooltip = this._commandAction.tooltip || this._commandAction.label;
    let title = keybindingLabel ? localize("titleAndKb", "{0} ({1})", tooltip, keybindingLabel) : tooltip;
    if (!this._wantsAltCommand && this._menuItemAction.alt?.enabled) {
      const altTooltip = this._menuItemAction.alt.tooltip || this._menuItemAction.alt.label;
      const altKeybinding = this._keybindingService.lookupKeybinding(this._menuItemAction.alt.id, this._contextKeyService);
      const altKeybindingLabel = altKeybinding && altKeybinding.getLabel();
      const altTitleSection = altKeybindingLabel ? localize("titleAndKb", "{0} ({1})", altTooltip, altKeybindingLabel) : altTooltip;
      title = localize("titleAndKbAndAlt", "{0}\n[{1}] {2}", title, UILabelProvider.modifierLabels[OS].altKey, altTitleSection);
    }
    return title;
  }
  updateClass() {
    if (this.options.icon) {
      if (this._commandAction !== this._menuItemAction) {
        if (this._menuItemAction.alt) {
          this._updateItemClass(this._menuItemAction.alt.item);
        }
      } else {
        this._updateItemClass(this._menuItemAction.item);
      }
    }
  }
  _updateItemClass(item) {
    this._itemClassDispose.value = void 0;
    const { element, label } = this;
    if (!element || !label) {
      return;
    }
    const icon = this._commandAction.checked && isICommandActionToggleInfo(item.toggled) && item.toggled.icon ? item.toggled.icon : item.icon;
    if (!icon) {
      return;
    }
    if (ThemeIcon.isThemeIcon(icon)) {
      const iconClasses = ThemeIcon.asClassNameArray(icon);
      label.classList.add(...iconClasses);
      this._itemClassDispose.value = toDisposable(() => {
        label.classList.remove(...iconClasses);
      });
    } else {
      label.style.backgroundImage = isDark(this._themeService.getColorTheme().type) ? asCSSUrl(icon.dark) : asCSSUrl(icon.light);
      label.classList.add("icon");
      this._itemClassDispose.value = combinedDisposable(
        toDisposable(() => {
          label.style.backgroundImage = "";
          label.classList.remove("icon");
        }),
        this._themeService.onDidColorThemeChange(() => {
          this.updateClass();
        })
      );
    }
  }
};
MenuEntryActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IAccessibilityService)
], MenuEntryActionViewItem);
class TextOnlyMenuEntryActionViewItem extends MenuEntryActionViewItem {
  render(container) {
    this.options.label = true;
    this.options.icon = false;
    super.render(container);
    container.classList.add("text-only");
    container.classList.toggle("use-comma", this._options?.useComma ?? false);
  }
  updateLabel() {
    const kb = this._keybindingService.lookupKeybinding(this._action.id, this._contextKeyService);
    if (!kb) {
      return super.updateLabel();
    }
    if (this.label) {
      const kb2 = TextOnlyMenuEntryActionViewItem._symbolPrintEnter(kb);
      if (this._options?.conversational) {
        this.label.textContent = localize({ key: "content2", comment: ['A label with keybindg like "ESC to dismiss"'] }, "{1} to {0}", this._action.label, kb2);
      } else {
        this.label.textContent = localize({ key: "content", comment: ["A label", "A keybinding"] }, "{0} ({1})", this._action.label, kb2);
      }
    }
  }
  static _symbolPrintEnter(kb) {
    return kb.getLabel()?.replace(/\benter\b/gi, "\u23CE").replace(/\bEscape\b/gi, "Esc");
  }
}
let SubmenuEntryActionViewItem = class extends DropdownMenuActionViewItem {
  constructor(action, options, _keybindingService, _contextMenuService, _themeService) {
    const dropdownOptions = {
      ...options,
      menuAsChild: options?.menuAsChild ?? false,
      classNames: options?.classNames ?? (ThemeIcon.isThemeIcon(action.item.icon) ? ThemeIcon.asClassName(action.item.icon) : void 0),
      keybindingProvider: options?.keybindingProvider ?? ((action2) => _keybindingService.lookupKeybinding(action2.id))
    };
    super(action, { getActions: () => action.actions }, _contextMenuService, dropdownOptions);
    this._keybindingService = _keybindingService;
    this._contextMenuService = _contextMenuService;
    this._themeService = _themeService;
  }
  render(container) {
    super.render(container);
    assertType(this.element);
    container.classList.add("menu-entry");
    const action = this._action;
    const { icon } = action.item;
    if (icon && !ThemeIcon.isThemeIcon(icon)) {
      this.element.classList.add("icon");
      const setBackgroundImage = () => {
        if (this.element) {
          this.element.style.backgroundImage = isDark(this._themeService.getColorTheme().type) ? asCSSUrl(icon.dark) : asCSSUrl(icon.light);
        }
      };
      setBackgroundImage();
      this._register(this._themeService.onDidColorThemeChange(() => {
        setBackgroundImage();
      }));
    }
  }
};
SubmenuEntryActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IThemeService)
], SubmenuEntryActionViewItem);
let DropdownWithDefaultActionViewItem = class extends BaseActionViewItem {
  constructor(submenuAction, options, _keybindingService, _notificationService, _contextMenuService, _menuService, _instaService, _storageService) {
    super(null, submenuAction);
    this._keybindingService = _keybindingService;
    this._notificationService = _notificationService;
    this._contextMenuService = _contextMenuService;
    this._menuService = _menuService;
    this._instaService = _instaService;
    this._storageService = _storageService;
    this._defaultActionDisposables = this._register(new DisposableStore());
    this._container = null;
    this._options = options;
    this._storageKey = `${submenuAction.item.submenu.id}_lastActionId`;
    let defaultAction;
    const defaultActionId = options?.persistLastActionId ? _storageService.get(this._storageKey, StorageScope.WORKSPACE) : void 0;
    if (defaultActionId) {
      defaultAction = submenuAction.actions.find((a) => defaultActionId === a.id);
    }
    if (!defaultAction) {
      defaultAction = submenuAction.actions[0];
    }
    this._defaultAction = this._defaultActionDisposables.add(this._instaService.createInstance(MenuEntryActionViewItem, defaultAction, { keybinding: this._getDefaultActionKeybindingLabel(defaultAction) }));
    const dropdownOptions = {
      keybindingProvider: (action) => this._keybindingService.lookupKeybinding(action.id),
      ...options,
      menuAsChild: options?.menuAsChild ?? true,
      classNames: options?.classNames ?? ["codicon", "codicon-chevron-down"],
      actionRunner: options?.actionRunner ?? this._register(new ActionRunner())
    };
    this._dropdown = this._register(new DropdownMenuActionViewItem(submenuAction, submenuAction.actions, this._contextMenuService, dropdownOptions));
    this._register(this._dropdown.actionRunner.onDidRun((e) => {
      if (e.action instanceof MenuItemAction) {
        this.update(e.action);
      }
    }));
  }
  get onDidChangeDropdownVisibility() {
    return this._dropdown.onDidChangeVisibility;
  }
  update(lastAction) {
    if (this._options?.persistLastActionId) {
      this._storageService.store(this._storageKey, lastAction.id, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    }
    this._defaultActionDisposables.clear();
    this._defaultAction = this._defaultActionDisposables.add(this._instaService.createInstance(MenuEntryActionViewItem, lastAction, { keybinding: this._getDefaultActionKeybindingLabel(lastAction) }));
    this._defaultAction.actionRunner = this._defaultActionDisposables.add(new class extends ActionRunner {
      async runAction(action, context) {
        await action.run(void 0);
      }
    }());
    if (this._container) {
      this._defaultAction.render(prepend(this._container, $(".action-container")));
    }
  }
  _getDefaultActionKeybindingLabel(defaultAction) {
    let defaultActionKeybinding;
    if (this._options?.renderKeybindingWithDefaultActionLabel) {
      const kb = this._keybindingService.lookupKeybinding(defaultAction.id);
      if (kb) {
        defaultActionKeybinding = `(${kb.getLabel()})`;
      }
    }
    return defaultActionKeybinding;
  }
  setActionContext(newContext) {
    super.setActionContext(newContext);
    this._defaultAction.setActionContext(newContext);
    this._dropdown.setActionContext(newContext);
  }
  render(container) {
    this._container = container;
    super.render(this._container);
    this._container.classList.add("monaco-dropdown-with-default");
    const primaryContainer = $(".action-container");
    this._defaultAction.render(append(this._container, primaryContainer));
    this._register(addDisposableListener(primaryContainer, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.RightArrow)) {
        this._defaultAction.element.tabIndex = -1;
        this._dropdown.focus();
        event.stopPropagation();
      }
    }));
    const dropdownContainer = $(".dropdown-action-container");
    this._dropdown.render(append(this._container, dropdownContainer));
    this._register(addDisposableListener(dropdownContainer, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.LeftArrow)) {
        this._defaultAction.element.tabIndex = 0;
        this._dropdown.setFocusable(false);
        this._defaultAction.element?.focus();
        event.stopPropagation();
      }
    }));
  }
  focus(fromRight) {
    if (fromRight) {
      this._dropdown.focus();
    } else {
      this._defaultAction.element.tabIndex = 0;
      this._defaultAction.element.focus();
    }
  }
  blur() {
    this._defaultAction.element.tabIndex = -1;
    this._dropdown.blur();
    this._container.blur();
  }
  setFocusable(focusable) {
    if (focusable) {
      this._defaultAction.element.tabIndex = 0;
    } else {
      this._defaultAction.element.tabIndex = -1;
      this._dropdown.setFocusable(false);
    }
  }
};
DropdownWithDefaultActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IStorageService)
], DropdownWithDefaultActionViewItem);
let SubmenuEntrySelectActionViewItem = class extends SelectActionViewItem {
  constructor(action, contextViewService) {
    super(null, action, action.actions.map((a) => ({
      text: a.id === Separator.ID ? "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" : a.label,
      isDisabled: !a.enabled
    })), 0, contextViewService, defaultSelectBoxStyles, { ariaLabel: action.tooltip, optionsAsChildren: true });
    this.select(Math.max(0, action.actions.findIndex((a) => a.checked)));
  }
  render(container) {
    super.render(container);
    container.style.borderColor = asCssVariable(selectBorder);
  }
  runAction(option, index) {
    const action = this.action.actions[index];
    if (action) {
      this.actionRunner.run(action);
    }
  }
};
SubmenuEntrySelectActionViewItem = __decorateClass([
  __decorateParam(1, IContextViewService)
], SubmenuEntrySelectActionViewItem);
function createActionViewItem(instaService, action, options) {
  if (action instanceof MenuItemAction) {
    return instaService.createInstance(MenuEntryActionViewItem, action, options);
  } else if (action instanceof SubmenuItemAction) {
    if (action.item.isSelection) {
      return instaService.createInstance(SubmenuEntrySelectActionViewItem, action);
    } else {
      if (action.item.rememberDefaultAction) {
        return instaService.createInstance(DropdownWithDefaultActionViewItem, action, { ...options, persistLastActionId: true });
      } else {
        return instaService.createInstance(SubmenuEntryActionViewItem, action, options);
      }
    }
  } else {
    return void 0;
  }
}
export {
  DropdownWithDefaultActionViewItem,
  MenuEntryActionViewItem,
  SubmenuEntryActionViewItem,
  TextOnlyMenuEntryActionViewItem,
  createActionViewItem,
  fillInActionBarActions,
  getActionBarActions,
  getContextMenuActions,
  getFlatActionBarActions,
  getFlatContextMenuActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBhc0NTU1VybCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jc3NWYWx1ZS5qcyc7XG5pbXBvcnQgeyAkLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGFwcGVuZCwgRXZlbnRUeXBlLCBNb2RpZmllcktleUVtaXR0ZXIsIHByZXBlbmQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvblZpZXdJdGVtLCBCYXNlQWN0aW9uVmlld0l0ZW0sIFNlbGVjdEFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW0sIElEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZHJvcGRvd24vZHJvcGRvd25BY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlLmpzJztcbmltcG9ydCB7IEFjdGlvblJ1bm5lciwgSUFjdGlvbiwgSVJ1bkV2ZW50LCBTZXBhcmF0b3IsIFN1Ym1lbnVBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgVUlMYWJlbFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ0xhYmVscy5qcyc7XG5pbXBvcnQgeyBSZXNvbHZlZEtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgY29tYmluZWREaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNMaW51eCwgaXNXaW5kb3dzLCBPUyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZEFjdGlvbiwgaXNJQ29tbWFuZEFjdGlvblRvZ2dsZUluZm8gfSBmcm9tICcuLi8uLi9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UsIElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0U2VsZWN0Qm94U3R5bGVzIH0gZnJvbSAnLi4vLi4vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUsIHNlbGVjdEJvcmRlciB9IGZyb20gJy4uLy4uL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGlzRGFyayB9IGZyb20gJy4uLy4uL3RoZW1lL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJdGVtQWN0aW9uLCBTdWJtZW51SXRlbUFjdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCAnLi9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5jc3MnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByaW1hcnlBbmRTZWNvbmRhcnlBY3Rpb25zIHtcblx0cHJpbWFyeTogSUFjdGlvbltdO1xuXHRzZWNvbmRhcnk6IElBY3Rpb25bXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbnRleHRNZW51QWN0aW9ucyhcblx0Z3JvdXBzOiBSZWFkb25seUFycmF5PFtzdHJpbmcsIFJlYWRvbmx5QXJyYXk8TWVudUl0ZW1BY3Rpb24gfCBTdWJtZW51SXRlbUFjdGlvbj5dPixcblx0cHJpbWFyeUdyb3VwPzogc3RyaW5nXG4pOiBQcmltYXJ5QW5kU2Vjb25kYXJ5QWN0aW9ucyB7XG5cdGNvbnN0IHRhcmdldDogUHJpbWFyeUFuZFNlY29uZGFyeUFjdGlvbnMgPSB7IHByaW1hcnk6IFtdLCBzZWNvbmRhcnk6IFtdIH07XG5cdGdldENvbnRleHRNZW51QWN0aW9uc0ltcGwoZ3JvdXBzLCB0YXJnZXQsIHByaW1hcnlHcm91cCk7XG5cdHJldHVybiB0YXJnZXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zKFxuXHRncm91cHM6IFJlYWRvbmx5QXJyYXk8W3N0cmluZywgUmVhZG9ubHlBcnJheTxNZW51SXRlbUFjdGlvbiB8IFN1Ym1lbnVJdGVtQWN0aW9uPl0+LFxuXHRwcmltYXJ5R3JvdXA/OiBzdHJpbmdcbik6IElBY3Rpb25bXSB7XG5cdGNvbnN0IHRhcmdldDogSUFjdGlvbltdID0gW107XG5cdGdldENvbnRleHRNZW51QWN0aW9uc0ltcGwoZ3JvdXBzLCB0YXJnZXQsIHByaW1hcnlHcm91cCk7XG5cdHJldHVybiB0YXJnZXQ7XG59XG5cbmZ1bmN0aW9uIGdldENvbnRleHRNZW51QWN0aW9uc0ltcGwoXG5cdGdyb3VwczogUmVhZG9ubHlBcnJheTxbc3RyaW5nLCBSZWFkb25seUFycmF5PE1lbnVJdGVtQWN0aW9uIHwgU3VibWVudUl0ZW1BY3Rpb24+XT4sXG5cdHRhcmdldDogSUFjdGlvbltdIHwgUHJpbWFyeUFuZFNlY29uZGFyeUFjdGlvbnMsXG5cdHByaW1hcnlHcm91cD86IHN0cmluZ1xuKSB7XG5cdGNvbnN0IG1vZGlmaWVyS2V5RW1pdHRlciA9IE1vZGlmaWVyS2V5RW1pdHRlci5nZXRJbnN0YW5jZSgpO1xuXHRjb25zdCB1c2VBbHRlcm5hdGl2ZUFjdGlvbnMgPSBtb2RpZmllcktleUVtaXR0ZXIua2V5U3RhdHVzLmFsdEtleSB8fCAoKGlzV2luZG93cyB8fCBpc0xpbnV4KSAmJiBtb2RpZmllcktleUVtaXR0ZXIua2V5U3RhdHVzLnNoaWZ0S2V5KTtcblx0ZmlsbEluQWN0aW9ucyhncm91cHMsIHRhcmdldCwgdXNlQWx0ZXJuYXRpdmVBY3Rpb25zLCBwcmltYXJ5R3JvdXAgPyBhY3Rpb25Hcm91cCA9PiBhY3Rpb25Hcm91cCA9PT0gcHJpbWFyeUdyb3VwIDogYWN0aW9uR3JvdXAgPT4gYWN0aW9uR3JvdXAgPT09ICduYXZpZ2F0aW9uJyk7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEFjdGlvbkJhckFjdGlvbnMoXG5cdGdyb3VwczogW3N0cmluZywgQXJyYXk8TWVudUl0ZW1BY3Rpb24gfCBTdWJtZW51SXRlbUFjdGlvbj5dW10sXG5cdHByaW1hcnlHcm91cD86IHN0cmluZyB8ICgoYWN0aW9uR3JvdXA6IHN0cmluZykgPT4gYm9vbGVhbiksXG5cdHNob3VsZElubGluZVN1Ym1lbnU/OiAoYWN0aW9uOiBTdWJtZW51QWN0aW9uLCBncm91cDogc3RyaW5nLCBncm91cFNpemU6IG51bWJlcikgPT4gYm9vbGVhbixcblx0dXNlU2VwYXJhdG9yc0luUHJpbWFyeUFjdGlvbnM/OiBib29sZWFuXG4pOiBQcmltYXJ5QW5kU2Vjb25kYXJ5QWN0aW9ucyB7XG5cdGNvbnN0IHRhcmdldDogUHJpbWFyeUFuZFNlY29uZGFyeUFjdGlvbnMgPSB7IHByaW1hcnk6IFtdLCBzZWNvbmRhcnk6IFtdIH07XG5cdGZpbGxJbkFjdGlvbkJhckFjdGlvbnMoZ3JvdXBzLCB0YXJnZXQsIHByaW1hcnlHcm91cCwgc2hvdWxkSW5saW5lU3VibWVudSwgdXNlU2VwYXJhdG9yc0luUHJpbWFyeUFjdGlvbnMpO1xuXHRyZXR1cm4gdGFyZ2V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnMoXG5cdGdyb3VwczogW3N0cmluZywgQXJyYXk8TWVudUl0ZW1BY3Rpb24gfCBTdWJtZW51SXRlbUFjdGlvbj5dW10sXG5cdHByaW1hcnlHcm91cD86IHN0cmluZyB8ICgoYWN0aW9uR3JvdXA6IHN0cmluZykgPT4gYm9vbGVhbiksXG5cdHNob3VsZElubGluZVN1Ym1lbnU/OiAoYWN0aW9uOiBTdWJtZW51QWN0aW9uLCBncm91cDogc3RyaW5nLCBncm91cFNpemU6IG51bWJlcikgPT4gYm9vbGVhbixcblx0dXNlU2VwYXJhdG9yc0luUHJpbWFyeUFjdGlvbnM/OiBib29sZWFuXG4pOiBJQWN0aW9uW10ge1xuXHRjb25zdCB0YXJnZXQ6IElBY3Rpb25bXSA9IFtdO1xuXHRmaWxsSW5BY3Rpb25CYXJBY3Rpb25zKGdyb3VwcywgdGFyZ2V0LCBwcmltYXJ5R3JvdXAsIHNob3VsZElubGluZVN1Ym1lbnUsIHVzZVNlcGFyYXRvcnNJblByaW1hcnlBY3Rpb25zKTtcblx0cmV0dXJuIHRhcmdldDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbGxJbkFjdGlvbkJhckFjdGlvbnMoXG5cdGdyb3VwczogW3N0cmluZywgQXJyYXk8TWVudUl0ZW1BY3Rpb24gfCBTdWJtZW51SXRlbUFjdGlvbj5dW10sXG5cdHRhcmdldDogSUFjdGlvbltdIHwgUHJpbWFyeUFuZFNlY29uZGFyeUFjdGlvbnMsXG5cdHByaW1hcnlHcm91cD86IHN0cmluZyB8ICgoYWN0aW9uR3JvdXA6IHN0cmluZykgPT4gYm9vbGVhbiksXG5cdHNob3VsZElubGluZVN1Ym1lbnU/OiAoYWN0aW9uOiBTdWJtZW51QWN0aW9uLCBncm91cDogc3RyaW5nLCBncm91cFNpemU6IG51bWJlcikgPT4gYm9vbGVhbixcblx0dXNlU2VwYXJhdG9yc0luUHJpbWFyeUFjdGlvbnM/OiBib29sZWFuXG4pOiB2b2lkIHtcblx0Y29uc3QgaXNQcmltYXJ5QWN0aW9uID0gdHlwZW9mIHByaW1hcnlHcm91cCA9PT0gJ3N0cmluZycgPyAoYWN0aW9uR3JvdXA6IHN0cmluZykgPT4gYWN0aW9uR3JvdXAgPT09IHByaW1hcnlHcm91cCA6IHByaW1hcnlHcm91cDtcblxuXHQvLyBBY3Rpb24gYmFycyBoYW5kbGUgYWx0ZXJuYXRpdmUgYWN0aW9ucyBvbiB0aGVpciBvd24gc28gdGhlIGFsdGVybmF0aXZlIGFjdGlvbnMgc2hvdWxkIGJlIGlnbm9yZWRcblx0ZmlsbEluQWN0aW9ucyhncm91cHMsIHRhcmdldCwgZmFsc2UsIGlzUHJpbWFyeUFjdGlvbiwgc2hvdWxkSW5saW5lU3VibWVudSwgdXNlU2VwYXJhdG9yc0luUHJpbWFyeUFjdGlvbnMpO1xufVxuXG5mdW5jdGlvbiBmaWxsSW5BY3Rpb25zKFxuXHRncm91cHM6IFJlYWRvbmx5QXJyYXk8W3N0cmluZywgUmVhZG9ubHlBcnJheTxNZW51SXRlbUFjdGlvbiB8IFN1Ym1lbnVJdGVtQWN0aW9uPl0+LFxuXHR0YXJnZXQ6IElBY3Rpb25bXSB8IFByaW1hcnlBbmRTZWNvbmRhcnlBY3Rpb25zLFxuXHR1c2VBbHRlcm5hdGl2ZUFjdGlvbnM6IGJvb2xlYW4sXG5cdGlzUHJpbWFyeUFjdGlvbjogKGFjdGlvbkdyb3VwOiBzdHJpbmcpID0+IGJvb2xlYW4gPSBhY3Rpb25Hcm91cCA9PiBhY3Rpb25Hcm91cCA9PT0gJ25hdmlnYXRpb24nLFxuXHRzaG91bGRJbmxpbmVTdWJtZW51OiAoYWN0aW9uOiBTdWJtZW51QWN0aW9uLCBncm91cDogc3RyaW5nLCBncm91cFNpemU6IG51bWJlcikgPT4gYm9vbGVhbiA9ICgpID0+IGZhbHNlLFxuXHR1c2VTZXBhcmF0b3JzSW5QcmltYXJ5QWN0aW9uczogYm9vbGVhbiA9IGZhbHNlXG4pOiB2b2lkIHtcblxuXHRsZXQgcHJpbWFyeUJ1Y2tldDogSUFjdGlvbltdO1xuXHRsZXQgc2Vjb25kYXJ5QnVja2V0OiBJQWN0aW9uW107XG5cdGlmIChBcnJheS5pc0FycmF5KHRhcmdldCkpIHtcblx0XHRwcmltYXJ5QnVja2V0ID0gdGFyZ2V0O1xuXHRcdHNlY29uZGFyeUJ1Y2tldCA9IHRhcmdldDtcblx0fSBlbHNlIHtcblx0XHRwcmltYXJ5QnVja2V0ID0gdGFyZ2V0LnByaW1hcnk7XG5cdFx0c2Vjb25kYXJ5QnVja2V0ID0gdGFyZ2V0LnNlY29uZGFyeTtcblx0fVxuXG5cdGNvbnN0IHN1Ym1lbnVJbmZvID0gbmV3IFNldDx7IGdyb3VwOiBzdHJpbmc7IGFjdGlvbjogU3VibWVudUFjdGlvbjsgaW5kZXg6IG51bWJlciB9PigpO1xuXG5cdGZvciAoY29uc3QgW2dyb3VwLCBhY3Rpb25zXSBvZiBncm91cHMpIHtcblxuXHRcdGxldCB0YXJnZXQ6IElBY3Rpb25bXTtcblx0XHRpZiAoaXNQcmltYXJ5QWN0aW9uKGdyb3VwKSkge1xuXHRcdFx0dGFyZ2V0ID0gcHJpbWFyeUJ1Y2tldDtcblx0XHRcdGlmICh0YXJnZXQubGVuZ3RoID4gMCAmJiB1c2VTZXBhcmF0b3JzSW5QcmltYXJ5QWN0aW9ucykge1xuXHRcdFx0XHR0YXJnZXQucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0YXJnZXQgPSBzZWNvbmRhcnlCdWNrZXQ7XG5cdFx0XHRpZiAodGFyZ2V0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGFyZ2V0LnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGxldCBhY3Rpb24gb2YgYWN0aW9ucykge1xuXHRcdFx0aWYgKHVzZUFsdGVybmF0aXZlQWN0aW9ucykge1xuXHRcdFx0XHRhY3Rpb24gPSBhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbiAmJiBhY3Rpb24uYWx0ID8gYWN0aW9uLmFsdCA6IGFjdGlvbjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG5ld0xlbiA9IHRhcmdldC5wdXNoKGFjdGlvbik7XG5cdFx0XHQvLyBrZWVwIHN1Ym1lbnUgaW5mbyBmb3IgbGF0ZXIgaW5saW5pbmdcblx0XHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBTdWJtZW51QWN0aW9uKSB7XG5cdFx0XHRcdHN1Ym1lbnVJbmZvLmFkZCh7IGdyb3VwLCBhY3Rpb24sIGluZGV4OiBuZXdMZW4gLSAxIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIGFzayB0aGUgb3V0c2lkZSBpZiBzdWJtZW51IHNob3VsZCBiZSBpbmxpbmVkIG9yIG5vdC4gb25seSBhc2sgd2hlblxuXHQvLyB0aGVyZSB3b3VsZCBiZSBlbm91Z2ggc3BhY2Vcblx0Zm9yIChjb25zdCB7IGdyb3VwLCBhY3Rpb24sIGluZGV4IH0gb2Ygc3VibWVudUluZm8pIHtcblx0XHRjb25zdCB0YXJnZXQgPSBpc1ByaW1hcnlBY3Rpb24oZ3JvdXApID8gcHJpbWFyeUJ1Y2tldCA6IHNlY29uZGFyeUJ1Y2tldDtcblxuXHRcdC8vIGlubGluaW5nIHN1Ym1lbnVzIHdpdGggbGVuZ3RoIDAgb3IgMSBpcyBlYXN5LFxuXHRcdC8vIGxhcmdlciBzdWJtZW51cyBuZWVkIHRvIGJlIGNoZWNrZWQgd2l0aCB0aGUgb3ZlcmFsbCBsaW1pdFxuXHRcdGNvbnN0IHN1Ym1lbnVBY3Rpb25zID0gYWN0aW9uLmFjdGlvbnM7XG5cdFx0aWYgKHNob3VsZElubGluZVN1Ym1lbnUoYWN0aW9uLCBncm91cCwgdGFyZ2V0Lmxlbmd0aCkpIHtcblx0XHRcdHRhcmdldC5zcGxpY2UoaW5kZXgsIDEsIC4uLnN1Ym1lbnVBY3Rpb25zKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTWVudUVudHJ5QWN0aW9uVmlld0l0ZW1PcHRpb25zIHtcblx0ZHJhZ2dhYmxlPzogYm9vbGVhbjtcblx0a2V5YmluZGluZz86IHN0cmluZyB8IG51bGw7XG5cdGhvdmVyRGVsZWdhdGU/OiBJSG92ZXJEZWxlZ2F0ZTtcblx0a2V5YmluZGluZ05vdFJlbmRlcmVkV2l0aExhYmVsPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtPFQgZXh0ZW5kcyBJTWVudUVudHJ5QWN0aW9uVmlld0l0ZW1PcHRpb25zID0gSU1lbnVFbnRyeUFjdGlvblZpZXdJdGVtT3B0aW9ucz4gZXh0ZW5kcyBBY3Rpb25WaWV3SXRlbSB7XG5cblx0cHJpdmF0ZSBfd2FudHNBbHRDb21tYW5kOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2l0ZW1DbGFzc0Rpc3Bvc2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FsdEtleTogTW9kaWZpZXJLZXlFbWl0dGVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFjdGlvbjogTWVudUl0ZW1BY3Rpb24sXG5cdFx0cHJvdGVjdGVkIF9vcHRpb25zOiBUIHwgdW5kZWZpbmVkLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcm90ZWN0ZWQgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJvdGVjdGVkIF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByb3RlY3RlZCBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByb3RlY3RlZCBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcih1bmRlZmluZWQsIGFjdGlvbiwgeyBpY29uOiAhIShhY3Rpb24uY2xhc3MgfHwgYWN0aW9uLml0ZW0uaWNvbiksIGxhYmVsOiAhYWN0aW9uLmNsYXNzICYmICFhY3Rpb24uaXRlbS5pY29uLCBkcmFnZ2FibGU6IF9vcHRpb25zPy5kcmFnZ2FibGUsIGtleWJpbmRpbmc6IF9vcHRpb25zPy5rZXliaW5kaW5nLCBob3ZlckRlbGVnYXRlOiBfb3B0aW9ucz8uaG92ZXJEZWxlZ2F0ZSwga2V5YmluZGluZ05vdFJlbmRlcmVkV2l0aExhYmVsOiBfb3B0aW9ucz8ua2V5YmluZGluZ05vdFJlbmRlcmVkV2l0aExhYmVsIH0pO1xuXHRcdHRoaXMuX2FsdEtleSA9IE1vZGlmaWVyS2V5RW1pdHRlci5nZXRJbnN0YW5jZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldCBfbWVudUl0ZW1BY3Rpb24oKTogTWVudUl0ZW1BY3Rpb24ge1xuXHRcdHJldHVybiA8TWVudUl0ZW1BY3Rpb24+dGhpcy5fYWN0aW9uO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldCBfY29tbWFuZEFjdGlvbigpOiBNZW51SXRlbUFjdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dhbnRzQWx0Q29tbWFuZCAmJiB0aGlzLl9tZW51SXRlbUFjdGlvbi5hbHQgfHwgdGhpcy5fbWVudUl0ZW1BY3Rpb247XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBvbkNsaWNrKGV2ZW50OiBNb3VzZUV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFjdGlvblJ1bm5lci5ydW4odGhpcy5fY29tbWFuZEFjdGlvbiwgdGhpcy5fY29udGV4dCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbWVudS1lbnRyeScpO1xuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5pY29uKSB7XG5cdFx0XHR0aGlzLl91cGRhdGVJdGVtQ2xhc3ModGhpcy5fbWVudUl0ZW1BY3Rpb24uaXRlbSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX21lbnVJdGVtQWN0aW9uLmFsdCkge1xuXHRcdFx0bGV0IGlzTW91c2VPdmVyID0gZmFsc2U7XG5cblx0XHRcdGNvbnN0IHVwZGF0ZUFsdFN0YXRlID0gKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB3YW50c0FsdENvbW1hbmQgPSAhIXRoaXMuX21lbnVJdGVtQWN0aW9uLmFsdD8uZW5hYmxlZCAmJlxuXHRcdFx0XHRcdCghdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNNb3Rpb25SZWR1Y2VkKCkgfHwgaXNNb3VzZU92ZXIpICYmIChcblx0XHRcdFx0XHRcdHRoaXMuX2FsdEtleS5rZXlTdGF0dXMuYWx0S2V5IHx8XG5cdFx0XHRcdFx0XHQodGhpcy5fYWx0S2V5LmtleVN0YXR1cy5zaGlmdEtleSAmJiBpc01vdXNlT3Zlcilcblx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdGlmICh3YW50c0FsdENvbW1hbmQgIT09IHRoaXMuX3dhbnRzQWx0Q29tbWFuZCkge1xuXHRcdFx0XHRcdHRoaXMuX3dhbnRzQWx0Q29tbWFuZCA9IHdhbnRzQWx0Q29tbWFuZDtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUxhYmVsKCk7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVUb29sdGlwKCk7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVDbGFzcygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9hbHRLZXkuZXZlbnQodXBkYXRlQWx0U3RhdGUpKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNvbnRhaW5lciwgJ21vdXNlbGVhdmUnLCBfID0+IHtcblx0XHRcdFx0aXNNb3VzZU92ZXIgPSBmYWxzZTtcblx0XHRcdFx0dXBkYXRlQWx0U3RhdGUoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNvbnRhaW5lciwgJ21vdXNlZW50ZXInLCBfID0+IHtcblx0XHRcdFx0aXNNb3VzZU92ZXIgPSB0cnVlO1xuXHRcdFx0XHR1cGRhdGVBbHRTdGF0ZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR1cGRhdGVBbHRTdGF0ZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVMYWJlbCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5vcHRpb25zLmxhYmVsICYmIHRoaXMubGFiZWwpIHtcblx0XHRcdHRoaXMubGFiZWwudGV4dENvbnRlbnQgPSB0aGlzLl9jb21tYW5kQWN0aW9uLmxhYmVsO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRUb29sdGlwKCkge1xuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKHRoaXMuX2NvbW1hbmRBY3Rpb24uaWQsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCBrZXliaW5kaW5nTGFiZWwgPSBrZXliaW5kaW5nICYmIGtleWJpbmRpbmcuZ2V0TGFiZWwoKTtcblxuXHRcdGNvbnN0IHRvb2x0aXAgPSB0aGlzLl9jb21tYW5kQWN0aW9uLnRvb2x0aXAgfHwgdGhpcy5fY29tbWFuZEFjdGlvbi5sYWJlbDtcblx0XHRsZXQgdGl0bGUgPSBrZXliaW5kaW5nTGFiZWxcblx0XHRcdD8gbG9jYWxpemUoJ3RpdGxlQW5kS2InLCBcInswfSAoezF9KVwiLCB0b29sdGlwLCBrZXliaW5kaW5nTGFiZWwpXG5cdFx0XHQ6IHRvb2x0aXA7XG5cdFx0aWYgKCF0aGlzLl93YW50c0FsdENvbW1hbmQgJiYgdGhpcy5fbWVudUl0ZW1BY3Rpb24uYWx0Py5lbmFibGVkKSB7XG5cdFx0XHRjb25zdCBhbHRUb29sdGlwID0gdGhpcy5fbWVudUl0ZW1BY3Rpb24uYWx0LnRvb2x0aXAgfHwgdGhpcy5fbWVudUl0ZW1BY3Rpb24uYWx0LmxhYmVsO1xuXHRcdFx0Y29uc3QgYWx0S2V5YmluZGluZyA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcodGhpcy5fbWVudUl0ZW1BY3Rpb24uYWx0LmlkLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHRjb25zdCBhbHRLZXliaW5kaW5nTGFiZWwgPSBhbHRLZXliaW5kaW5nICYmIGFsdEtleWJpbmRpbmcuZ2V0TGFiZWwoKTtcblx0XHRcdGNvbnN0IGFsdFRpdGxlU2VjdGlvbiA9IGFsdEtleWJpbmRpbmdMYWJlbFxuXHRcdFx0XHQ/IGxvY2FsaXplKCd0aXRsZUFuZEtiJywgXCJ7MH0gKHsxfSlcIiwgYWx0VG9vbHRpcCwgYWx0S2V5YmluZGluZ0xhYmVsKVxuXHRcdFx0XHQ6IGFsdFRvb2x0aXA7XG5cblx0XHRcdHRpdGxlID0gbG9jYWxpemUoJ3RpdGxlQW5kS2JBbmRBbHQnLCBcInswfVxcblt7MX1dIHsyfVwiLCB0aXRsZSwgVUlMYWJlbFByb3ZpZGVyLm1vZGlmaWVyTGFiZWxzW09TXS5hbHRLZXksIGFsdFRpdGxlU2VjdGlvbik7XG5cdFx0fVxuXHRcdHJldHVybiB0aXRsZTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVDbGFzcygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5vcHRpb25zLmljb24pIHtcblx0XHRcdGlmICh0aGlzLl9jb21tYW5kQWN0aW9uICE9PSB0aGlzLl9tZW51SXRlbUFjdGlvbikge1xuXHRcdFx0XHRpZiAodGhpcy5fbWVudUl0ZW1BY3Rpb24uYWx0KSB7XG5cdFx0XHRcdFx0dGhpcy5fdXBkYXRlSXRlbUNsYXNzKHRoaXMuX21lbnVJdGVtQWN0aW9uLmFsdC5pdGVtKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fdXBkYXRlSXRlbUNsYXNzKHRoaXMuX21lbnVJdGVtQWN0aW9uLml0ZW0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUl0ZW1DbGFzcyhpdGVtOiBJQ29tbWFuZEFjdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuX2l0ZW1DbGFzc0Rpc3Bvc2UudmFsdWUgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCB7IGVsZW1lbnQsIGxhYmVsIH0gPSB0aGlzO1xuXHRcdGlmICghZWxlbWVudCB8fCAhbGFiZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpY29uID0gdGhpcy5fY29tbWFuZEFjdGlvbi5jaGVja2VkICYmIGlzSUNvbW1hbmRBY3Rpb25Ub2dnbGVJbmZvKGl0ZW0udG9nZ2xlZCkgJiYgaXRlbS50b2dnbGVkLmljb24gPyBpdGVtLnRvZ2dsZWQuaWNvbiA6IGl0ZW0uaWNvbjtcblxuXHRcdGlmICghaWNvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChUaGVtZUljb24uaXNUaGVtZUljb24oaWNvbikpIHtcblx0XHRcdC8vIHRoZW1lIGljb25zXG5cdFx0XHRjb25zdCBpY29uQ2xhc3NlcyA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KGljb24pO1xuXHRcdFx0bGFiZWwuY2xhc3NMaXN0LmFkZCguLi5pY29uQ2xhc3Nlcyk7XG5cdFx0XHR0aGlzLl9pdGVtQ2xhc3NEaXNwb3NlLnZhbHVlID0gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0bGFiZWwuY2xhc3NMaXN0LnJlbW92ZSguLi5pY29uQ2xhc3Nlcyk7XG5cdFx0XHR9KTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBpY29uIHBhdGgvdXJsXG5cdFx0XHRsYWJlbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAoXG5cdFx0XHRcdGlzRGFyayh0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLnR5cGUpXG5cdFx0XHRcdFx0PyBhc0NTU1VybChpY29uLmRhcmspXG5cdFx0XHRcdFx0OiBhc0NTU1VybChpY29uLmxpZ2h0KVxuXHRcdFx0KTtcblx0XHRcdGxhYmVsLmNsYXNzTGlzdC5hZGQoJ2ljb24nKTtcblx0XHRcdHRoaXMuX2l0ZW1DbGFzc0Rpc3Bvc2UudmFsdWUgPSBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdFx0bGFiZWwuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7XG5cdFx0XHRcdFx0bGFiZWwuY2xhc3NMaXN0LnJlbW92ZSgnaWNvbicpO1xuXHRcdFx0XHR9KSxcblx0XHRcdFx0dGhpcy5fdGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdFx0Ly8gcmVmcmVzaCB3aGVuIHRoZSB0aGVtZSBjaGFuZ2VzIGluIGNhc2Ugd2UgZ28gYmV0d2VlbiBkYXJrIDwtPiBsaWdodFxuXHRcdFx0XHRcdHRoaXMudXBkYXRlQ2xhc3MoKTtcblx0XHRcdFx0fSlcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRleHRPbmx5TWVudUVudHJ5QWN0aW9uVmlld0l0ZW1PcHRpb25zIGV4dGVuZHMgSU1lbnVFbnRyeUFjdGlvblZpZXdJdGVtT3B0aW9ucyB7XG5cdGNvbnZlcnNhdGlvbmFsPzogYm9vbGVhbjtcblx0dXNlQ29tbWE/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgVGV4dE9ubHlNZW51RW50cnlBY3Rpb25WaWV3SXRlbSBleHRlbmRzIE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtPElUZXh0T25seU1lbnVFbnRyeUFjdGlvblZpZXdJdGVtT3B0aW9ucz4ge1xuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5vcHRpb25zLmxhYmVsID0gdHJ1ZTtcblx0XHR0aGlzLm9wdGlvbnMuaWNvbiA9IGZhbHNlO1xuXHRcdHN1cGVyLnJlbmRlcihjb250YWluZXIpO1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCd0ZXh0LW9ubHknKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgndXNlLWNvbW1hJywgdGhpcy5fb3B0aW9ucz8udXNlQ29tbWEgPz8gZmFsc2UpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUxhYmVsKCkge1xuXHRcdGNvbnN0IGtiID0gdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyh0aGlzLl9hY3Rpb24uaWQsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpZiAoIWtiKSB7XG5cdFx0XHRyZXR1cm4gc3VwZXIudXBkYXRlTGFiZWwoKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMubGFiZWwpIHtcblx0XHRcdGNvbnN0IGtiMiA9IFRleHRPbmx5TWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uX3N5bWJvbFByaW50RW50ZXIoa2IpO1xuXG5cdFx0XHRpZiAodGhpcy5fb3B0aW9ucz8uY29udmVyc2F0aW9uYWwpIHtcblx0XHRcdFx0dGhpcy5sYWJlbC50ZXh0Q29udGVudCA9IGxvY2FsaXplKHsga2V5OiAnY29udGVudDInLCBjb21tZW50OiBbJ0EgbGFiZWwgd2l0aCBrZXliaW5kZyBsaWtlIFwiRVNDIHRvIGRpc21pc3NcIiddIH0sICd7MX0gdG8gezB9JywgdGhpcy5fYWN0aW9uLmxhYmVsLCBrYjIpO1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxhYmVsLnRleHRDb250ZW50ID0gbG9jYWxpemUoeyBrZXk6ICdjb250ZW50JywgY29tbWVudDogWydBIGxhYmVsJywgJ0Ega2V5YmluZGluZyddIH0sICd7MH0gKHsxfSknLCB0aGlzLl9hY3Rpb24ubGFiZWwsIGtiMik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3N5bWJvbFByaW50RW50ZXIoa2I6IFJlc29sdmVkS2V5YmluZGluZykge1xuXHRcdHJldHVybiBrYi5nZXRMYWJlbCgpXG5cdFx0XHQ/LnJlcGxhY2UoL1xcYmVudGVyXFxiL2dpLCAnXFx1MjNDRScpXG5cdFx0XHQucmVwbGFjZSgvXFxiRXNjYXBlXFxiL2dpLCAnRXNjJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFN1Ym1lbnVFbnRyeUFjdGlvblZpZXdJdGVtIGV4dGVuZHMgRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW0ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFjdGlvbjogU3VibWVudUl0ZW1BY3Rpb24sXG5cdFx0b3B0aW9uczogSURyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtT3B0aW9ucyB8IHVuZGVmaW5lZCxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByb3RlY3RlZCBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcm90ZWN0ZWQgX2NvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcm90ZWN0ZWQgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZVxuXHQpIHtcblx0XHRjb25zdCBkcm9wZG93bk9wdGlvbnM6IElEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbU9wdGlvbnMgPSB7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0bWVudUFzQ2hpbGQ6IG9wdGlvbnM/Lm1lbnVBc0NoaWxkID8/IGZhbHNlLFxuXHRcdFx0Y2xhc3NOYW1lczogb3B0aW9ucz8uY2xhc3NOYW1lcyA/PyAoVGhlbWVJY29uLmlzVGhlbWVJY29uKGFjdGlvbi5pdGVtLmljb24pID8gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGFjdGlvbi5pdGVtLmljb24pIDogdW5kZWZpbmVkKSxcblx0XHRcdGtleWJpbmRpbmdQcm92aWRlcjogb3B0aW9ucz8ua2V5YmluZGluZ1Byb3ZpZGVyID8/IChhY3Rpb24gPT4gX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKSlcblx0XHR9O1xuXG5cdFx0c3VwZXIoYWN0aW9uLCB7IGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbi5hY3Rpb25zIH0sIF9jb250ZXh0TWVudVNlcnZpY2UsIGRyb3Bkb3duT3B0aW9ucyk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlcihjb250YWluZXIpO1xuXHRcdGFzc2VydFR5cGUodGhpcy5lbGVtZW50KTtcblxuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdtZW51LWVudHJ5Jyk7XG5cdFx0Y29uc3QgYWN0aW9uID0gPFN1Ym1lbnVJdGVtQWN0aW9uPnRoaXMuX2FjdGlvbjtcblx0XHRjb25zdCB7IGljb24gfSA9IGFjdGlvbi5pdGVtO1xuXHRcdGlmIChpY29uICYmICFUaGVtZUljb24uaXNUaGVtZUljb24oaWNvbikpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpY29uJyk7XG5cdFx0XHRjb25zdCBzZXRCYWNrZ3JvdW5kSW1hZ2UgPSAoKSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLmVsZW1lbnQpIHtcblx0XHRcdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gKFxuXHRcdFx0XHRcdFx0aXNEYXJrKHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkudHlwZSlcblx0XHRcdFx0XHRcdFx0PyBhc0NTU1VybChpY29uLmRhcmspXG5cdFx0XHRcdFx0XHRcdDogYXNDU1NVcmwoaWNvbi5saWdodClcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0c2V0QmFja2dyb3VuZEltYWdlKCk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKCgpID0+IHtcblx0XHRcdFx0Ly8gcmVmcmVzaCB3aGVuIHRoZSB0aGVtZSBjaGFuZ2VzIGluIGNhc2Ugd2UgZ28gYmV0d2VlbiBkYXJrIDwtPiBsaWdodFxuXHRcdFx0XHRzZXRCYWNrZ3JvdW5kSW1hZ2UoKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRHJvcGRvd25XaXRoRGVmYXVsdEFjdGlvblZpZXdJdGVtT3B0aW9ucyBleHRlbmRzIElEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbU9wdGlvbnMge1xuXHRyZW5kZXJLZXliaW5kaW5nV2l0aERlZmF1bHRBY3Rpb25MYWJlbD86IGJvb2xlYW47XG5cdHBlcnNpc3RMYXN0QWN0aW9uSWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgRHJvcGRvd25XaXRoRGVmYXVsdEFjdGlvblZpZXdJdGVtIGV4dGVuZHMgQmFzZUFjdGlvblZpZXdJdGVtIHtcblx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogSURyb3Bkb3duV2l0aERlZmF1bHRBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2RlZmF1bHRBY3Rpb246IEFjdGlvblZpZXdJdGVtO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWZhdWx0QWN0aW9uRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kcm9wZG93bjogRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW07XG5cdHByaXZhdGUgX2NvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZUtleTogc3RyaW5nO1xuXG5cdGdldCBvbkRpZENoYW5nZURyb3Bkb3duVmlzaWJpbGl0eSgpOiBFdmVudDxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2Ryb3Bkb3duLm9uRGlkQ2hhbmdlVmlzaWJpbGl0eTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHN1Ym1lbnVBY3Rpb246IFN1Ym1lbnVJdGVtQWN0aW9uLFxuXHRcdG9wdGlvbnM6IElEcm9wZG93bldpdGhEZWZhdWx0QWN0aW9uVmlld0l0ZW1PcHRpb25zIHwgdW5kZWZpbmVkLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcm90ZWN0ZWQgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByb3RlY3RlZCBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJvdGVjdGVkIF9tZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJvdGVjdGVkIF9pbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByb3RlY3RlZCBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihudWxsLCBzdWJtZW51QWN0aW9uKTtcblx0XHR0aGlzLl9vcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLl9zdG9yYWdlS2V5ID0gYCR7c3VibWVudUFjdGlvbi5pdGVtLnN1Ym1lbnUuaWR9X2xhc3RBY3Rpb25JZGA7XG5cblx0XHQvLyBkZXRlcm1pbmUgZGVmYXVsdCBhY3Rpb25cblx0XHRsZXQgZGVmYXVsdEFjdGlvbjogSUFjdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBkZWZhdWx0QWN0aW9uSWQgPSBvcHRpb25zPy5wZXJzaXN0TGFzdEFjdGlvbklkID8gX3N0b3JhZ2VTZXJ2aWNlLmdldCh0aGlzLl9zdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKSA6IHVuZGVmaW5lZDtcblx0XHRpZiAoZGVmYXVsdEFjdGlvbklkKSB7XG5cdFx0XHRkZWZhdWx0QWN0aW9uID0gc3VibWVudUFjdGlvbi5hY3Rpb25zLmZpbmQoYSA9PiBkZWZhdWx0QWN0aW9uSWQgPT09IGEuaWQpO1xuXHRcdH1cblx0XHRpZiAoIWRlZmF1bHRBY3Rpb24pIHtcblx0XHRcdGRlZmF1bHRBY3Rpb24gPSBzdWJtZW51QWN0aW9uLmFjdGlvbnNbMF07XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGVmYXVsdEFjdGlvbiA9IHRoaXMuX2RlZmF1bHRBY3Rpb25EaXNwb3NhYmxlcy5hZGQodGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCA8TWVudUl0ZW1BY3Rpb24+ZGVmYXVsdEFjdGlvbiwgeyBrZXliaW5kaW5nOiB0aGlzLl9nZXREZWZhdWx0QWN0aW9uS2V5YmluZGluZ0xhYmVsKGRlZmF1bHRBY3Rpb24pIH0pKTtcblxuXHRcdGNvbnN0IGRyb3Bkb3duT3B0aW9uczogSURyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtT3B0aW9ucyA9IHtcblx0XHRcdGtleWJpbmRpbmdQcm92aWRlcjogYWN0aW9uID0+IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKSxcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRtZW51QXNDaGlsZDogb3B0aW9ucz8ubWVudUFzQ2hpbGQgPz8gdHJ1ZSxcblx0XHRcdGNsYXNzTmFtZXM6IG9wdGlvbnM/LmNsYXNzTmFtZXMgPz8gWydjb2RpY29uJywgJ2NvZGljb24tY2hldnJvbi1kb3duJ10sXG5cdFx0XHRhY3Rpb25SdW5uZXI6IG9wdGlvbnM/LmFjdGlvblJ1bm5lciA/PyB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uUnVubmVyKCkpLFxuXHRcdH07XG5cblx0XHR0aGlzLl9kcm9wZG93biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbShzdWJtZW51QWN0aW9uLCBzdWJtZW51QWN0aW9uLmFjdGlvbnMsIHRoaXMuX2NvbnRleHRNZW51U2VydmljZSwgZHJvcGRvd25PcHRpb25zKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZHJvcGRvd24uYWN0aW9uUnVubmVyLm9uRGlkUnVuKChlOiBJUnVuRXZlbnQpID0+IHtcblx0XHRcdGlmIChlLmFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlKGUuYWN0aW9uKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZShsYXN0QWN0aW9uOiBNZW51SXRlbUFjdGlvbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9vcHRpb25zPy5wZXJzaXN0TGFzdEFjdGlvbklkKSB7XG5cdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZSh0aGlzLl9zdG9yYWdlS2V5LCBsYXN0QWN0aW9uLmlkLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2RlZmF1bHRBY3Rpb25EaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMuX2RlZmF1bHRBY3Rpb24gPSB0aGlzLl9kZWZhdWx0QWN0aW9uRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51RW50cnlBY3Rpb25WaWV3SXRlbSwgbGFzdEFjdGlvbiwgeyBrZXliaW5kaW5nOiB0aGlzLl9nZXREZWZhdWx0QWN0aW9uS2V5YmluZGluZ0xhYmVsKGxhc3RBY3Rpb24pIH0pKTtcblx0XHR0aGlzLl9kZWZhdWx0QWN0aW9uLmFjdGlvblJ1bm5lciA9IHRoaXMuX2RlZmF1bHRBY3Rpb25EaXNwb3NhYmxlcy5hZGQobmV3IGNsYXNzIGV4dGVuZHMgQWN0aW9uUnVubmVyIHtcblx0XHRcdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBydW5BY3Rpb24oYWN0aW9uOiBJQWN0aW9uLCBjb250ZXh0PzogdW5rbm93bik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRhd2FpdCBhY3Rpb24ucnVuKHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fSgpKTtcblxuXHRcdGlmICh0aGlzLl9jb250YWluZXIpIHtcblx0XHRcdHRoaXMuX2RlZmF1bHRBY3Rpb24ucmVuZGVyKHByZXBlbmQodGhpcy5fY29udGFpbmVyLCAkKCcuYWN0aW9uLWNvbnRhaW5lcicpKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RGVmYXVsdEFjdGlvbktleWJpbmRpbmdMYWJlbChkZWZhdWx0QWN0aW9uOiBJQWN0aW9uKSB7XG5cdFx0bGV0IGRlZmF1bHRBY3Rpb25LZXliaW5kaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHRoaXMuX29wdGlvbnM/LnJlbmRlcktleWJpbmRpbmdXaXRoRGVmYXVsdEFjdGlvbkxhYmVsKSB7XG5cdFx0XHRjb25zdCBrYiA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoZGVmYXVsdEFjdGlvbi5pZCk7XG5cdFx0XHRpZiAoa2IpIHtcblx0XHRcdFx0ZGVmYXVsdEFjdGlvbktleWJpbmRpbmcgPSBgKCR7a2IuZ2V0TGFiZWwoKX0pYDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGRlZmF1bHRBY3Rpb25LZXliaW5kaW5nO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0QWN0aW9uQ29udGV4dChuZXdDb250ZXh0OiB1bmtub3duKTogdm9pZCB7XG5cdFx0c3VwZXIuc2V0QWN0aW9uQ29udGV4dChuZXdDb250ZXh0KTtcblx0XHR0aGlzLl9kZWZhdWx0QWN0aW9uLnNldEFjdGlvbkNvbnRleHQobmV3Q29udGV4dCk7XG5cdFx0dGhpcy5fZHJvcGRvd24uc2V0QWN0aW9uQ29udGV4dChuZXdDb250ZXh0KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5fY29udGFpbmVyID0gY29udGFpbmVyO1xuXHRcdHN1cGVyLnJlbmRlcih0aGlzLl9jb250YWluZXIpO1xuXG5cdFx0dGhpcy5fY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21vbmFjby1kcm9wZG93bi13aXRoLWRlZmF1bHQnKTtcblxuXHRcdGNvbnN0IHByaW1hcnlDb250YWluZXIgPSAkKCcuYWN0aW9uLWNvbnRhaW5lcicpO1xuXHRcdHRoaXMuX2RlZmF1bHRBY3Rpb24ucmVuZGVyKGFwcGVuZCh0aGlzLl9jb250YWluZXIsIHByaW1hcnlDb250YWluZXIpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIocHJpbWFyeUNvbnRhaW5lciwgRXZlbnRUeXBlLktFWV9ET1dOLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLlJpZ2h0QXJyb3cpKSB7XG5cdFx0XHRcdHRoaXMuX2RlZmF1bHRBY3Rpb24uZWxlbWVudCEudGFiSW5kZXggPSAtMTtcblx0XHRcdFx0dGhpcy5fZHJvcGRvd24uZm9jdXMoKTtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgZHJvcGRvd25Db250YWluZXIgPSAkKCcuZHJvcGRvd24tYWN0aW9uLWNvbnRhaW5lcicpO1xuXHRcdHRoaXMuX2Ryb3Bkb3duLnJlbmRlcihhcHBlbmQodGhpcy5fY29udGFpbmVyLCBkcm9wZG93bkNvbnRhaW5lcikpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihkcm9wZG93bkNvbnRhaW5lciwgRXZlbnRUeXBlLktFWV9ET1dOLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLkxlZnRBcnJvdykpIHtcblx0XHRcdFx0dGhpcy5fZGVmYXVsdEFjdGlvbi5lbGVtZW50IS50YWJJbmRleCA9IDA7XG5cdFx0XHRcdHRoaXMuX2Ryb3Bkb3duLnNldEZvY3VzYWJsZShmYWxzZSk7XG5cdFx0XHRcdHRoaXMuX2RlZmF1bHRBY3Rpb24uZWxlbWVudD8uZm9jdXMoKTtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoZnJvbVJpZ2h0PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChmcm9tUmlnaHQpIHtcblx0XHRcdHRoaXMuX2Ryb3Bkb3duLmZvY3VzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2RlZmF1bHRBY3Rpb24uZWxlbWVudCEudGFiSW5kZXggPSAwO1xuXHRcdFx0dGhpcy5fZGVmYXVsdEFjdGlvbi5lbGVtZW50IS5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGJsdXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGVmYXVsdEFjdGlvbi5lbGVtZW50IS50YWJJbmRleCA9IC0xO1xuXHRcdHRoaXMuX2Ryb3Bkb3duLmJsdXIoKTtcblx0XHR0aGlzLl9jb250YWluZXIhLmJsdXIoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldEZvY3VzYWJsZShmb2N1c2FibGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoZm9jdXNhYmxlKSB7XG5cdFx0XHR0aGlzLl9kZWZhdWx0QWN0aW9uLmVsZW1lbnQhLnRhYkluZGV4ID0gMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fZGVmYXVsdEFjdGlvbi5lbGVtZW50IS50YWJJbmRleCA9IC0xO1xuXHRcdFx0dGhpcy5fZHJvcGRvd24uc2V0Rm9jdXNhYmxlKGZhbHNlKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgU3VibWVudUVudHJ5U2VsZWN0QWN0aW9uVmlld0l0ZW0gZXh0ZW5kcyBTZWxlY3RBY3Rpb25WaWV3SXRlbSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0YWN0aW9uOiBTdWJtZW51SXRlbUFjdGlvbixcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIobnVsbCwgYWN0aW9uLCBhY3Rpb24uYWN0aW9ucy5tYXAoYSA9PiAoe1xuXHRcdFx0dGV4dDogYS5pZCA9PT0gU2VwYXJhdG9yLklEID8gJ1xcdTI1MDBcXHUyNTAwXFx1MjUwMFxcdTI1MDBcXHUyNTAwXFx1MjUwMFxcdTI1MDBcXHUyNTAwXFx1MjUwMCcgOiBhLmxhYmVsLFxuXHRcdFx0aXNEaXNhYmxlZDogIWEuZW5hYmxlZCxcblx0XHR9KSksIDAsIGNvbnRleHRWaWV3U2VydmljZSwgZGVmYXVsdFNlbGVjdEJveFN0eWxlcywgeyBhcmlhTGFiZWw6IGFjdGlvbi50b29sdGlwLCBvcHRpb25zQXNDaGlsZHJlbjogdHJ1ZSB9KTtcblx0XHR0aGlzLnNlbGVjdChNYXRoLm1heCgwLCBhY3Rpb24uYWN0aW9ucy5maW5kSW5kZXgoYSA9PiBhLmNoZWNrZWQpKSk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlcihjb250YWluZXIpO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5ib3JkZXJDb2xvciA9IGFzQ3NzVmFyaWFibGUoc2VsZWN0Qm9yZGVyKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBydW5BY3Rpb24ob3B0aW9uOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBhY3Rpb24gPSAodGhpcy5hY3Rpb24gYXMgU3VibWVudUl0ZW1BY3Rpb24pLmFjdGlvbnNbaW5kZXhdO1xuXHRcdGlmIChhY3Rpb24pIHtcblx0XHRcdHRoaXMuYWN0aW9uUnVubmVyLnJ1bihhY3Rpb24pO1xuXHRcdH1cblx0fVxuXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhY3Rpb24gdmlldyBpdGVtcyBmb3IgbWVudSBhY3Rpb25zIG9yIHN1Ym1lbnUgYWN0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFjdGlvblZpZXdJdGVtKGluc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfCBJTWVudUVudHJ5QWN0aW9uVmlld0l0ZW1PcHRpb25zIHwgdW5kZWZpbmVkKTogdW5kZWZpbmVkIHwgTWVudUVudHJ5QWN0aW9uVmlld0l0ZW0gfCBTdWJtZW51RW50cnlBY3Rpb25WaWV3SXRlbSB8IEJhc2VBY3Rpb25WaWV3SXRlbSB7XG5cdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikge1xuXHRcdHJldHVybiBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVudUVudHJ5QWN0aW9uVmlld0l0ZW0sIGFjdGlvbiwgb3B0aW9ucyk7XG5cdH0gZWxzZSBpZiAoYWN0aW9uIGluc3RhbmNlb2YgU3VibWVudUl0ZW1BY3Rpb24pIHtcblx0XHRpZiAoYWN0aW9uLml0ZW0uaXNTZWxlY3Rpb24pIHtcblx0XHRcdHJldHVybiBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3VibWVudUVudHJ5U2VsZWN0QWN0aW9uVmlld0l0ZW0sIGFjdGlvbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChhY3Rpb24uaXRlbS5yZW1lbWJlckRlZmF1bHRBY3Rpb24pIHtcblx0XHRcdFx0cmV0dXJuIGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShEcm9wZG93bldpdGhEZWZhdWx0QWN0aW9uVmlld0l0ZW0sIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBwZXJzaXN0TGFzdEFjdGlvbklkOiB0cnVlIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShTdWJtZW51RW50cnlBY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCBvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLEdBQUcsdUJBQXVCLFFBQVEsV0FBVyxvQkFBb0IsZUFBZTtBQUN6RixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQixvQkFBb0IsNEJBQTRCO0FBQ3pFLFNBQVMsa0NBQXNFO0FBRS9FLFNBQVMsY0FBa0MsV0FBVyxxQkFBcUI7QUFFM0UsU0FBUyx1QkFBdUI7QUFFaEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsb0JBQW9CLGlCQUFpQixtQkFBbUIsb0JBQW9CO0FBQ3JGLFNBQVMsU0FBUyxXQUFXLFVBQVU7QUFDdkMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBeUIsa0NBQWtDO0FBQzNELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMscUJBQXFCLDJCQUEyQjtBQUN6RCxTQUFTLDZCQUE2QjtBQUN0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
