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
import { RunOnceScheduler } from "../../../base/common/async.js";
import { DebounceEmitter, Emitter } from "../../../base/common/event.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { isIMenuItem, isISubmenuItem, MenuItemAction, MenuRegistry, SubmenuItemAction } from "./actions.js";
import { ICommandService } from "../../commands/common/commands.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import { Separator, toAction } from "../../../base/common/actions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { removeFastWithoutKeepingOrder } from "../../../base/common/arrays.js";
import { localize } from "../../../nls.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
let MenuService = class {
  constructor(_commandService, _keybindingService, storageService) {
    this._commandService = _commandService;
    this._keybindingService = _keybindingService;
    this._hiddenStates = new PersistedMenuHideState(storageService);
  }
  createMenu(id, contextKeyService, options) {
    return new MenuImpl(id, this._hiddenStates, { emitEventsForSubmenuChanges: false, eventDebounceDelay: 50, ...options }, this._commandService, this._keybindingService, contextKeyService);
  }
  getMenuActions(id, contextKeyService, options) {
    const menu = new MenuImpl(id, this._hiddenStates, { emitEventsForSubmenuChanges: false, eventDebounceDelay: 50, ...options }, this._commandService, this._keybindingService, contextKeyService);
    const actions = menu.getActions(options);
    menu.dispose();
    return actions;
  }
  getMenuContexts(id) {
    const menuInfo = new MenuInfoSnapshot(id, false);
    return /* @__PURE__ */ new Set([...menuInfo.structureContextKeys, ...menuInfo.preconditionContextKeys, ...menuInfo.toggledContextKeys]);
  }
  resetHiddenStates(ids) {
    this._hiddenStates.reset(ids);
  }
};
MenuService = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IStorageService)
], MenuService);
let PersistedMenuHideState = class {
  constructor(_storageService) {
    this._storageService = _storageService;
    this._disposables = new DisposableStore();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._ignoreChangeEvent = false;
    this._hiddenByDefaultCache = /* @__PURE__ */ new Map();
    try {
      const raw = _storageService.get(PersistedMenuHideState._key, StorageScope.PROFILE, "{}");
      this._data = JSON.parse(raw);
    } catch (err) {
      this._data = /* @__PURE__ */ Object.create(null);
    }
    this._disposables.add(_storageService.onDidChangeValue(StorageScope.PROFILE, PersistedMenuHideState._key, this._disposables)(() => {
      if (!this._ignoreChangeEvent) {
        try {
          const raw = _storageService.get(PersistedMenuHideState._key, StorageScope.PROFILE, "{}");
          this._data = JSON.parse(raw);
        } catch (err) {
          console.log("FAILED to read storage after UPDATE", err);
        }
      }
      this._onDidChange.fire();
    }));
  }
  dispose() {
    this._onDidChange.dispose();
    this._disposables.dispose();
  }
  _isHiddenByDefault(menu, commandId) {
    return this._hiddenByDefaultCache.get(`${menu.id}/${commandId}`) ?? false;
  }
  setDefaultState(menu, commandId, hidden) {
    this._hiddenByDefaultCache.set(`${menu.id}/${commandId}`, hidden);
  }
  isHidden(menu, commandId) {
    const hiddenByDefault = this._isHiddenByDefault(menu, commandId);
    const state = this._data[menu.id]?.includes(commandId) ?? false;
    return hiddenByDefault ? !state : state;
  }
  updateHidden(menu, commandId, hidden) {
    const hiddenByDefault = this._isHiddenByDefault(menu, commandId);
    if (hiddenByDefault) {
      hidden = !hidden;
    }
    const entries = this._data[menu.id];
    if (!hidden) {
      if (entries) {
        const idx = entries.indexOf(commandId);
        if (idx >= 0) {
          removeFastWithoutKeepingOrder(entries, idx);
        }
        if (entries.length === 0) {
          delete this._data[menu.id];
        }
      }
    } else {
      if (!entries) {
        this._data[menu.id] = [commandId];
      } else {
        const idx = entries.indexOf(commandId);
        if (idx < 0) {
          entries.push(commandId);
        }
      }
    }
    this._persist();
  }
  reset(menus) {
    if (menus === void 0) {
      this._data = /* @__PURE__ */ Object.create(null);
      this._persist();
    } else {
      for (const { id } of menus) {
        if (this._data[id]) {
          delete this._data[id];
        }
      }
      this._persist();
    }
  }
  _persist() {
    try {
      this._ignoreChangeEvent = true;
      const raw = JSON.stringify(this._data);
      this._storageService.store(PersistedMenuHideState._key, raw, StorageScope.PROFILE, StorageTarget.USER);
    } finally {
      this._ignoreChangeEvent = false;
    }
  }
};
PersistedMenuHideState._key = "menu.hiddenCommands";
PersistedMenuHideState = __decorateClass([
  __decorateParam(0, IStorageService)
], PersistedMenuHideState);
class MenuInfoSnapshot {
  constructor(_id, _collectContextKeysForSubmenus) {
    this._id = _id;
    this._collectContextKeysForSubmenus = _collectContextKeysForSubmenus;
    this._menuGroups = [];
    this._allMenuIds = /* @__PURE__ */ new Set();
    this._structureContextKeys = /* @__PURE__ */ new Set();
    this._preconditionContextKeys = /* @__PURE__ */ new Set();
    this._toggledContextKeys = /* @__PURE__ */ new Set();
    this.refresh();
  }
  get allMenuIds() {
    return this._allMenuIds;
  }
  get structureContextKeys() {
    return this._structureContextKeys;
  }
  get preconditionContextKeys() {
    return this._preconditionContextKeys;
  }
  get toggledContextKeys() {
    return this._toggledContextKeys;
  }
  refresh() {
    this._menuGroups.length = 0;
    this._allMenuIds.clear();
    this._structureContextKeys.clear();
    this._preconditionContextKeys.clear();
    this._toggledContextKeys.clear();
    const menuItems = this._sort(MenuRegistry.getMenuItems(this._id));
    let group;
    for (const item of menuItems) {
      const groupName = item.group || "";
      if (!group || group[0] !== groupName) {
        group = [groupName, []];
        this._menuGroups.push(group);
      }
      group[1].push(item);
      this._collectContextKeysAndSubmenuIds(item);
    }
    this._allMenuIds.add(this._id);
  }
  _sort(menuItems) {
    return menuItems;
  }
  _collectContextKeysAndSubmenuIds(item) {
    MenuInfoSnapshot._fillInKbExprKeys(item.when, this._structureContextKeys);
    if (isIMenuItem(item)) {
      if (item.command.precondition) {
        MenuInfoSnapshot._fillInKbExprKeys(item.command.precondition, this._preconditionContextKeys);
      }
      if (item.command.toggled) {
        const toggledExpression = item.command.toggled.condition || item.command.toggled;
        MenuInfoSnapshot._fillInKbExprKeys(toggledExpression, this._toggledContextKeys);
      }
    } else if (this._collectContextKeysForSubmenus) {
      MenuRegistry.getMenuItems(item.submenu).forEach(this._collectContextKeysAndSubmenuIds, this);
      this._allMenuIds.add(item.submenu);
    }
  }
  static _fillInKbExprKeys(exp, set) {
    if (exp) {
      for (const key of exp.keys()) {
        set.add(key);
      }
    }
  }
}
let MenuInfo = class extends MenuInfoSnapshot {
  constructor(_id, _hiddenStates, _collectContextKeysForSubmenus, _commandService, _keybindingService, _contextKeyService) {
    super(_id, _collectContextKeysForSubmenus);
    this._hiddenStates = _hiddenStates;
    this._commandService = _commandService;
    this._keybindingService = _keybindingService;
    this._contextKeyService = _contextKeyService;
    this.refresh();
  }
  createActionGroups(options) {
    const result = [];
    for (const group of this._menuGroups) {
      const [id, items] = group;
      let activeActions;
      for (const item of items) {
        if (this._contextKeyService.contextMatchesRules(item.when)) {
          const isMenuItem = isIMenuItem(item);
          if (isMenuItem) {
            this._hiddenStates.setDefaultState(this._id, item.command.id, !!item.isHiddenByDefault);
          }
          const menuHide = createMenuHide(this._id, isMenuItem ? item.command : item, this._hiddenStates);
          if (isMenuItem) {
            const menuKeybinding = createConfigureKeybindingAction(this._commandService, this._keybindingService, item.command.id, item.when);
            (activeActions ??= []).push(new MenuItemAction(item.command, item.alt, options, menuHide, menuKeybinding, this._contextKeyService, this._commandService));
          } else {
            const groups = new MenuInfo(item.submenu, this._hiddenStates, this._collectContextKeysForSubmenus, this._commandService, this._keybindingService, this._contextKeyService).createActionGroups(options);
            const submenuActions = Separator.join(...groups.map((g) => g[1]));
            if (submenuActions.length > 0) {
              (activeActions ??= []).push(new SubmenuItemAction(item, menuHide, submenuActions));
            }
          }
        }
      }
      if (activeActions && activeActions.length > 0) {
        result.push([id, activeActions]);
      }
    }
    return result;
  }
  _sort(menuItems) {
    return menuItems.sort(MenuInfo._compareMenuItems);
  }
  static _compareMenuItems(a, b) {
    const aGroup = a.group;
    const bGroup = b.group;
    if (aGroup !== bGroup) {
      if (!aGroup) {
        return 1;
      } else if (!bGroup) {
        return -1;
      }
      if (aGroup === "navigation") {
        return -1;
      } else if (bGroup === "navigation") {
        return 1;
      }
      const value = aGroup.localeCompare(bGroup);
      if (value !== 0) {
        return value;
      }
    }
    const aPrio = a.order || 0;
    const bPrio = b.order || 0;
    if (aPrio < bPrio) {
      return -1;
    } else if (aPrio > bPrio) {
      return 1;
    }
    return MenuInfo._compareTitles(
      isIMenuItem(a) ? a.command.title : a.title,
      isIMenuItem(b) ? b.command.title : b.title
    );
  }
  static _compareTitles(a, b) {
    const aStr = typeof a === "string" ? a : a.original;
    const bStr = typeof b === "string" ? b : b.original;
    return aStr.localeCompare(bStr);
  }
};
MenuInfo = __decorateClass([
  __decorateParam(3, ICommandService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextKeyService)
], MenuInfo);
let MenuImpl = class {
  constructor(id, hiddenStates, options, commandService, keybindingService, contextKeyService) {
    this._disposables = new DisposableStore();
    this._menuInfo = new MenuInfo(id, hiddenStates, options.emitEventsForSubmenuChanges, commandService, keybindingService, contextKeyService);
    const rebuildMenuSoon = new RunOnceScheduler(() => {
      this._menuInfo.refresh();
      this._onDidChange.fire({ menu: this, isStructuralChange: true, isEnablementChange: true, isToggleChange: true });
    }, options.eventDebounceDelay);
    this._disposables.add(rebuildMenuSoon);
    this._disposables.add(MenuRegistry.onDidChangeMenu((e) => {
      for (const id2 of this._menuInfo.allMenuIds) {
        if (e.has(id2)) {
          rebuildMenuSoon.schedule();
          break;
        }
      }
    }));
    const lazyListener = this._disposables.add(new DisposableStore());
    const merge = (events) => {
      let isStructuralChange = false;
      let isEnablementChange = false;
      let isToggleChange = false;
      for (const item of events) {
        isStructuralChange = isStructuralChange || item.isStructuralChange;
        isEnablementChange = isEnablementChange || item.isEnablementChange;
        isToggleChange = isToggleChange || item.isToggleChange;
        if (isStructuralChange && isEnablementChange && isToggleChange) {
          break;
        }
      }
      return { menu: this, isStructuralChange, isEnablementChange, isToggleChange };
    };
    const startLazyListener = () => {
      lazyListener.add(contextKeyService.onDidChangeContext((e) => {
        const isStructuralChange = e.affectsSome(this._menuInfo.structureContextKeys);
        const isEnablementChange = e.affectsSome(this._menuInfo.preconditionContextKeys);
        const isToggleChange = e.affectsSome(this._menuInfo.toggledContextKeys);
        if (isStructuralChange || isEnablementChange || isToggleChange) {
          this._onDidChange.fire({ menu: this, isStructuralChange, isEnablementChange, isToggleChange });
        }
      }));
      lazyListener.add(hiddenStates.onDidChange((e) => {
        this._onDidChange.fire({ menu: this, isStructuralChange: true, isEnablementChange: false, isToggleChange: false });
      }));
    };
    this._onDidChange = new DebounceEmitter({
      // start/stop context key listener
      onWillAddFirstListener: startLazyListener,
      onDidRemoveLastListener: lazyListener.clear.bind(lazyListener),
      delay: options.eventDebounceDelay,
      merge
    });
    this.onDidChange = this._onDidChange.event;
  }
  getActions(options) {
    return this._menuInfo.createActionGroups(options);
  }
  dispose() {
    this._disposables.dispose();
    this._onDidChange.dispose();
  }
};
MenuImpl = __decorateClass([
  __decorateParam(3, ICommandService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextKeyService)
], MenuImpl);
function createMenuHide(menu, command, states) {
  const id = isISubmenuItem(command) ? command.submenu.id : command.id;
  const title = typeof command.title === "string" ? command.title : command.title.value;
  const hide = toAction({
    id: `hide/${menu.id}/${id}`,
    label: localize("hide.label", "Hide '{0}'", title),
    run() {
      states.updateHidden(menu, id, true);
    }
  });
  const toggle = toAction({
    id: `toggle/${menu.id}/${id}`,
    label: title,
    get checked() {
      return !states.isHidden(menu, id);
    },
    run() {
      states.updateHidden(menu, id, !!this.checked);
    }
  });
  return {
    hide,
    toggle,
    get isHidden() {
      return !toggle.checked;
    }
  };
}
function createConfigureKeybindingAction(commandService, keybindingService, commandId, when = void 0, enabled = true) {
  return toAction({
    id: `configureKeybinding/${commandId}`,
    label: localize("configure keybinding", "Configure Keybinding"),
    enabled,
    run() {
      const hasKeybinding = !!keybindingService.lookupKeybinding(commandId);
      const whenValue = !hasKeybinding && when ? when.serialize() : void 0;
      commandService.executeCommand("workbench.action.openGlobalKeybindings", `@command:${commandId}` + (whenValue ? ` +when:${whenValue}` : ""));
    }
  });
}
export {
  MenuService,
  createConfigureKeybindingAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9tZW51U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBEZWJvdW5jZUVtaXR0ZXIsIEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElNZW51LCBJTWVudUFjdGlvbk9wdGlvbnMsIElNZW51Q2hhbmdlRXZlbnQsIElNZW51Q3JlYXRlT3B0aW9ucywgSU1lbnVJdGVtLCBJTWVudUl0ZW1IaWRlLCBJTWVudVNlcnZpY2UsIGlzSU1lbnVJdGVtLCBpc0lTdWJtZW51SXRlbSwgSVN1Ym1lbnVJdGVtLCBNZW51SWQsIE1lbnVJdGVtQWN0aW9uLCBNZW51UmVnaXN0cnksIFN1Ym1lbnVJdGVtQWN0aW9uIH0gZnJvbSAnLi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kQWN0aW9uLCBJTG9jYWxpemVkU3RyaW5nIH0gZnJvbSAnLi4vLi4vYWN0aW9uL2NvbW1vbi9hY3Rpb24uanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByZXNzaW9uLCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElBY3Rpb24sIFNlcGFyYXRvciwgdG9BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyByZW1vdmVGYXN0V2l0aG91dEtlZXBpbmdPcmRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcblxuZXhwb3J0IGNsYXNzIE1lbnVTZXJ2aWNlIGltcGxlbWVudHMgSU1lbnVTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9oaWRkZW5TdGF0ZXM6IFBlcnNpc3RlZE1lbnVIaWRlU3RhdGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX2hpZGRlblN0YXRlcyA9IG5ldyBQZXJzaXN0ZWRNZW51SGlkZVN0YXRlKHN0b3JhZ2VTZXJ2aWNlKTtcblx0fVxuXG5cdGNyZWF0ZU1lbnUoaWQ6IE1lbnVJZCwgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSwgb3B0aW9ucz86IElNZW51Q3JlYXRlT3B0aW9ucyk6IElNZW51IHtcblx0XHRyZXR1cm4gbmV3IE1lbnVJbXBsKGlkLCB0aGlzLl9oaWRkZW5TdGF0ZXMsIHsgZW1pdEV2ZW50c0ZvclN1Ym1lbnVDaGFuZ2VzOiBmYWxzZSwgZXZlbnREZWJvdW5jZURlbGF5OiA1MCwgLi4ub3B0aW9ucyB9LCB0aGlzLl9jb21tYW5kU2VydmljZSwgdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0fVxuXG5cdGdldE1lbnVBY3Rpb25zKGlkOiBNZW51SWQsIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsIG9wdGlvbnM/OiBJTWVudUFjdGlvbk9wdGlvbnMpOiBbc3RyaW5nLCBBcnJheTxNZW51SXRlbUFjdGlvbiB8IFN1Ym1lbnVJdGVtQWN0aW9uPl1bXSB7XG5cdFx0Y29uc3QgbWVudSA9IG5ldyBNZW51SW1wbChpZCwgdGhpcy5faGlkZGVuU3RhdGVzLCB7IGVtaXRFdmVudHNGb3JTdWJtZW51Q2hhbmdlczogZmFsc2UsIGV2ZW50RGVib3VuY2VEZWxheTogNTAsIC4uLm9wdGlvbnMgfSwgdGhpcy5fY29tbWFuZFNlcnZpY2UsIHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgYWN0aW9ucyA9IG1lbnUuZ2V0QWN0aW9ucyhvcHRpb25zKTtcblx0XHRtZW51LmRpc3Bvc2UoKTtcblx0XHRyZXR1cm4gYWN0aW9ucztcblx0fVxuXG5cdGdldE1lbnVDb250ZXh0cyhpZDogTWVudUlkKTogUmVhZG9ubHlTZXQ8c3RyaW5nPiB7XG5cdFx0Y29uc3QgbWVudUluZm8gPSBuZXcgTWVudUluZm9TbmFwc2hvdChpZCwgZmFsc2UpO1xuXHRcdHJldHVybiBuZXcgU2V0PHN0cmluZz4oWy4uLm1lbnVJbmZvLnN0cnVjdHVyZUNvbnRleHRLZXlzLCAuLi5tZW51SW5mby5wcmVjb25kaXRpb25Db250ZXh0S2V5cywgLi4ubWVudUluZm8udG9nZ2xlZENvbnRleHRLZXlzXSk7XG5cdH1cblxuXHRyZXNldEhpZGRlblN0YXRlcyhpZHM/OiBNZW51SWRbXSk6IHZvaWQge1xuXHRcdHRoaXMuX2hpZGRlblN0YXRlcy5yZXNldChpZHMpO1xuXHR9XG59XG5cbmNsYXNzIFBlcnNpc3RlZE1lbnVIaWRlU3RhdGUge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9rZXkgPSAnbWVudS5oaWRkZW5Db21tYW5kcyc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfaWdub3JlQ2hhbmdlRXZlbnQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfZGF0YTogUmVjb3JkPHN0cmluZywgc3RyaW5nW10gfCB1bmRlZmluZWQ+O1xuXG5cdHByaXZhdGUgX2hpZGRlbkJ5RGVmYXVsdENhY2hlID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG5cblx0Y29uc3RydWN0b3IoQElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJhdyA9IF9zdG9yYWdlU2VydmljZS5nZXQoUGVyc2lzdGVkTWVudUhpZGVTdGF0ZS5fa2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgJ3t9Jyk7XG5cdFx0XHR0aGlzLl9kYXRhID0gSlNPTi5wYXJzZShyYXcpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0dGhpcy5fZGF0YSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKF9zdG9yYWdlU2VydmljZS5vbkRpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBQZXJzaXN0ZWRNZW51SGlkZVN0YXRlLl9rZXksIHRoaXMuX2Rpc3Bvc2FibGVzKSgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2lnbm9yZUNoYW5nZUV2ZW50KSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgcmF3ID0gX3N0b3JhZ2VTZXJ2aWNlLmdldChQZXJzaXN0ZWRNZW51SGlkZVN0YXRlLl9rZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAne30nKTtcblx0XHRcdFx0XHR0aGlzLl9kYXRhID0gSlNPTi5wYXJzZShyYXcpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZygnRkFJTEVEIHRvIHJlYWQgc3RvcmFnZSBhZnRlciBVUERBVEUnLCBlcnIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNIaWRkZW5CeURlZmF1bHQobWVudTogTWVudUlkLCBjb21tYW5kSWQ6IHN0cmluZykge1xuXHRcdHJldHVybiB0aGlzLl9oaWRkZW5CeURlZmF1bHRDYWNoZS5nZXQoYCR7bWVudS5pZH0vJHtjb21tYW5kSWR9YCkgPz8gZmFsc2U7XG5cdH1cblxuXHRzZXREZWZhdWx0U3RhdGUobWVudTogTWVudUlkLCBjb21tYW5kSWQ6IHN0cmluZywgaGlkZGVuOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5faGlkZGVuQnlEZWZhdWx0Q2FjaGUuc2V0KGAke21lbnUuaWR9LyR7Y29tbWFuZElkfWAsIGhpZGRlbik7XG5cdH1cblxuXHRpc0hpZGRlbihtZW51OiBNZW51SWQsIGNvbW1hbmRJZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgaGlkZGVuQnlEZWZhdWx0ID0gdGhpcy5faXNIaWRkZW5CeURlZmF1bHQobWVudSwgY29tbWFuZElkKTtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX2RhdGFbbWVudS5pZF0/LmluY2x1ZGVzKGNvbW1hbmRJZCkgPz8gZmFsc2U7XG5cdFx0cmV0dXJuIGhpZGRlbkJ5RGVmYXVsdCA/ICFzdGF0ZSA6IHN0YXRlO1xuXHR9XG5cblx0dXBkYXRlSGlkZGVuKG1lbnU6IE1lbnVJZCwgY29tbWFuZElkOiBzdHJpbmcsIGhpZGRlbjogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGhpZGRlbkJ5RGVmYXVsdCA9IHRoaXMuX2lzSGlkZGVuQnlEZWZhdWx0KG1lbnUsIGNvbW1hbmRJZCk7XG5cdFx0aWYgKGhpZGRlbkJ5RGVmYXVsdCkge1xuXHRcdFx0aGlkZGVuID0gIWhpZGRlbjtcblx0XHR9XG5cdFx0Y29uc3QgZW50cmllcyA9IHRoaXMuX2RhdGFbbWVudS5pZF07XG5cdFx0aWYgKCFoaWRkZW4pIHtcblx0XHRcdC8vIHJlbW92ZSBhbmQgY2xlYW51cFxuXHRcdFx0aWYgKGVudHJpZXMpIHtcblx0XHRcdFx0Y29uc3QgaWR4ID0gZW50cmllcy5pbmRleE9mKGNvbW1hbmRJZCk7XG5cdFx0XHRcdGlmIChpZHggPj0gMCkge1xuXHRcdFx0XHRcdHJlbW92ZUZhc3RXaXRob3V0S2VlcGluZ09yZGVyKGVudHJpZXMsIGlkeCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHRoaXMuX2RhdGFbbWVudS5pZF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gYWRkIHVubGVzcyBhbHJlYWR5IGFkZGVkXG5cdFx0XHRpZiAoIWVudHJpZXMpIHtcblx0XHRcdFx0dGhpcy5fZGF0YVttZW51LmlkXSA9IFtjb21tYW5kSWRdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgaWR4ID0gZW50cmllcy5pbmRleE9mKGNvbW1hbmRJZCk7XG5cdFx0XHRcdGlmIChpZHggPCAwKSB7XG5cdFx0XHRcdFx0ZW50cmllcy5wdXNoKGNvbW1hbmRJZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fcGVyc2lzdCgpO1xuXHR9XG5cblx0cmVzZXQobWVudXM/OiBNZW51SWRbXSk6IHZvaWQge1xuXHRcdGlmIChtZW51cyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyByZXNldCBhbGxcblx0XHRcdHRoaXMuX2RhdGEgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdFx0dGhpcy5fcGVyc2lzdCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyByZXNldCBvbmx5IGZvciBhIHNwZWNpZmljIG1lbnVcblx0XHRcdGZvciAoY29uc3QgeyBpZCB9IG9mIG1lbnVzKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9kYXRhW2lkXSkge1xuXHRcdFx0XHRcdGRlbGV0ZSB0aGlzLl9kYXRhW2lkXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fcGVyc2lzdCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3BlcnNpc3QoKTogdm9pZCB7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX2lnbm9yZUNoYW5nZUV2ZW50ID0gdHJ1ZTtcblx0XHRcdGNvbnN0IHJhdyA9IEpTT04uc3RyaW5naWZ5KHRoaXMuX2RhdGEpO1xuXHRcdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoUGVyc2lzdGVkTWVudUhpZGVTdGF0ZS5fa2V5LCByYXcsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9pZ25vcmVDaGFuZ2VFdmVudCA9IGZhbHNlO1xuXHRcdH1cblx0fVxufVxuXG50eXBlIE1lbnVJdGVtR3JvdXAgPSBbc3RyaW5nLCBBcnJheTxJTWVudUl0ZW0gfCBJU3VibWVudUl0ZW0+XTtcblxuY2xhc3MgTWVudUluZm9TbmFwc2hvdCB7XG5cdHByb3RlY3RlZCBfbWVudUdyb3VwczogTWVudUl0ZW1Hcm91cFtdID0gW107XG5cdHByaXZhdGUgX2FsbE1lbnVJZHM6IFNldDxNZW51SWQ+ID0gbmV3IFNldCgpO1xuXHRwcml2YXRlIF9zdHJ1Y3R1cmVDb250ZXh0S2V5czogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG5cdHByaXZhdGUgX3ByZWNvbmRpdGlvbkNvbnRleHRLZXlzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblx0cHJpdmF0ZSBfdG9nZ2xlZENvbnRleHRLZXlzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2lkOiBNZW51SWQsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF9jb2xsZWN0Q29udGV4dEtleXNGb3JTdWJtZW51czogYm9vbGVhbixcblx0KSB7XG5cdFx0dGhpcy5yZWZyZXNoKCk7XG5cdH1cblxuXHRnZXQgYWxsTWVudUlkcygpOiBSZWFkb25seVNldDxNZW51SWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fYWxsTWVudUlkcztcblx0fVxuXG5cdGdldCBzdHJ1Y3R1cmVDb250ZXh0S2V5cygpOiBSZWFkb25seVNldDxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fc3RydWN0dXJlQ29udGV4dEtleXM7XG5cdH1cblxuXHRnZXQgcHJlY29uZGl0aW9uQ29udGV4dEtleXMoKTogUmVhZG9ubHlTZXQ8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3ByZWNvbmRpdGlvbkNvbnRleHRLZXlzO1xuXHR9XG5cblx0Z2V0IHRvZ2dsZWRDb250ZXh0S2V5cygpOiBSZWFkb25seVNldDxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fdG9nZ2xlZENvbnRleHRLZXlzO1xuXHR9XG5cblx0cmVmcmVzaCgpOiB2b2lkIHtcblxuXHRcdC8vIHJlc2V0XG5cdFx0dGhpcy5fbWVudUdyb3Vwcy5sZW5ndGggPSAwO1xuXHRcdHRoaXMuX2FsbE1lbnVJZHMuY2xlYXIoKTtcblx0XHR0aGlzLl9zdHJ1Y3R1cmVDb250ZXh0S2V5cy5jbGVhcigpO1xuXHRcdHRoaXMuX3ByZWNvbmRpdGlvbkNvbnRleHRLZXlzLmNsZWFyKCk7XG5cdFx0dGhpcy5fdG9nZ2xlZENvbnRleHRLZXlzLmNsZWFyKCk7XG5cblx0XHRjb25zdCBtZW51SXRlbXMgPSB0aGlzLl9zb3J0KE1lbnVSZWdpc3RyeS5nZXRNZW51SXRlbXModGhpcy5faWQpKTtcblx0XHRsZXQgZ3JvdXA6IE1lbnVJdGVtR3JvdXAgfCB1bmRlZmluZWQ7XG5cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgbWVudUl0ZW1zKSB7XG5cdFx0XHQvLyBncm91cCBieSBncm91cElkXG5cdFx0XHRjb25zdCBncm91cE5hbWUgPSBpdGVtLmdyb3VwIHx8ICcnO1xuXHRcdFx0aWYgKCFncm91cCB8fCBncm91cFswXSAhPT0gZ3JvdXBOYW1lKSB7XG5cdFx0XHRcdGdyb3VwID0gW2dyb3VwTmFtZSwgW11dO1xuXHRcdFx0XHR0aGlzLl9tZW51R3JvdXBzLnB1c2goZ3JvdXApO1xuXHRcdFx0fVxuXHRcdFx0Z3JvdXBbMV0ucHVzaChpdGVtKTtcblxuXHRcdFx0Ly8ga2VlcCBrZXlzIGFuZCBzdWJtZW51IGlkcyBmb3IgZXZlbnRpbmdcblx0XHRcdHRoaXMuX2NvbGxlY3RDb250ZXh0S2V5c0FuZFN1Ym1lbnVJZHMoaXRlbSk7XG5cdFx0fVxuXHRcdHRoaXMuX2FsbE1lbnVJZHMuYWRkKHRoaXMuX2lkKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfc29ydChtZW51SXRlbXM6IChJTWVudUl0ZW0gfCBJU3VibWVudUl0ZW0pW10pIHtcblx0XHQvLyBubyBzb3J0aW5nIG5lZWRlZCBpbiBzbmFwc2hvdFxuXHRcdHJldHVybiBtZW51SXRlbXM7XG5cdH1cblxuXHRwcml2YXRlIF9jb2xsZWN0Q29udGV4dEtleXNBbmRTdWJtZW51SWRzKGl0ZW06IElNZW51SXRlbSB8IElTdWJtZW51SXRlbSk6IHZvaWQge1xuXG5cdFx0TWVudUluZm9TbmFwc2hvdC5fZmlsbEluS2JFeHByS2V5cyhpdGVtLndoZW4sIHRoaXMuX3N0cnVjdHVyZUNvbnRleHRLZXlzKTtcblxuXHRcdGlmIChpc0lNZW51SXRlbShpdGVtKSkge1xuXHRcdFx0Ly8ga2VlcCBwcmVjb25kaXRpb24ga2V5cyBmb3IgZXZlbnQgaWYgYXBwbGljYWJsZVxuXHRcdFx0aWYgKGl0ZW0uY29tbWFuZC5wcmVjb25kaXRpb24pIHtcblx0XHRcdFx0TWVudUluZm9TbmFwc2hvdC5fZmlsbEluS2JFeHByS2V5cyhpdGVtLmNvbW1hbmQucHJlY29uZGl0aW9uLCB0aGlzLl9wcmVjb25kaXRpb25Db250ZXh0S2V5cyk7XG5cdFx0XHR9XG5cdFx0XHQvLyBrZWVwIHRvZ2dsZWQga2V5cyBmb3IgZXZlbnQgaWYgYXBwbGljYWJsZVxuXHRcdFx0aWYgKGl0ZW0uY29tbWFuZC50b2dnbGVkKSB7XG5cdFx0XHRcdGNvbnN0IHRvZ2dsZWRFeHByZXNzaW9uOiBDb250ZXh0S2V5RXhwcmVzc2lvbiA9IChpdGVtLmNvbW1hbmQudG9nZ2xlZCBhcyB7IGNvbmRpdGlvbjogQ29udGV4dEtleUV4cHJlc3Npb24gfSkuY29uZGl0aW9uIHx8IGl0ZW0uY29tbWFuZC50b2dnbGVkO1xuXHRcdFx0XHRNZW51SW5mb1NuYXBzaG90Ll9maWxsSW5LYkV4cHJLZXlzKHRvZ2dsZWRFeHByZXNzaW9uLCB0aGlzLl90b2dnbGVkQ29udGV4dEtleXMpO1xuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIGlmICh0aGlzLl9jb2xsZWN0Q29udGV4dEtleXNGb3JTdWJtZW51cykge1xuXHRcdFx0Ly8gcmVjdXJzaXZlbHkgY29sbGVjdCBjb250ZXh0IGtleXMgZnJvbSBzdWJtZW51cyBzbyB0aGF0IHRoaXNcblx0XHRcdC8vIG1lbnUgZmlyZXMgZXZlbnRzIHdoZW4gY29udGV4dCBrZXkgY2hhbmdlcyBhZmZlY3Qgc3VibWVudXNcblx0XHRcdE1lbnVSZWdpc3RyeS5nZXRNZW51SXRlbXMoaXRlbS5zdWJtZW51KS5mb3JFYWNoKHRoaXMuX2NvbGxlY3RDb250ZXh0S2V5c0FuZFN1Ym1lbnVJZHMsIHRoaXMpO1xuXG5cdFx0XHR0aGlzLl9hbGxNZW51SWRzLmFkZChpdGVtLnN1Ym1lbnUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9maWxsSW5LYkV4cHJLZXlzKGV4cDogQ29udGV4dEtleUV4cHJlc3Npb24gfCB1bmRlZmluZWQsIHNldDogU2V0PHN0cmluZz4pOiB2b2lkIHtcblx0XHRpZiAoZXhwKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBvZiBleHAua2V5cygpKSB7XG5cdFx0XHRcdHNldC5hZGQoa2V5KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxufVxuXG5jbGFzcyBNZW51SW5mbyBleHRlbmRzIE1lbnVJbmZvU25hcHNob3Qge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdF9pZDogTWVudUlkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hpZGRlblN0YXRlczogUGVyc2lzdGVkTWVudUhpZGVTdGF0ZSxcblx0XHRfY29sbGVjdENvbnRleHRLZXlzRm9yU3VibWVudXM6IGJvb2xlYW4sXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoX2lkLCBfY29sbGVjdENvbnRleHRLZXlzRm9yU3VibWVudXMpO1xuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cblx0Y3JlYXRlQWN0aW9uR3JvdXBzKG9wdGlvbnM6IElNZW51QWN0aW9uT3B0aW9ucyB8IHVuZGVmaW5lZCk6IFtzdHJpbmcsIEFycmF5PE1lbnVJdGVtQWN0aW9uIHwgU3VibWVudUl0ZW1BY3Rpb24+XVtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFtzdHJpbmcsIEFycmF5PE1lbnVJdGVtQWN0aW9uIHwgU3VibWVudUl0ZW1BY3Rpb24+XVtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIHRoaXMuX21lbnVHcm91cHMpIHtcblx0XHRcdGNvbnN0IFtpZCwgaXRlbXNdID0gZ3JvdXA7XG5cblx0XHRcdGxldCBhY3RpdmVBY3Rpb25zOiBBcnJheTxNZW51SXRlbUFjdGlvbiB8IFN1Ym1lbnVJdGVtQWN0aW9uPiB8IHVuZGVmaW5lZDtcblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuXHRcdFx0XHRpZiAodGhpcy5fY29udGV4dEtleVNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyhpdGVtLndoZW4pKSB7XG5cdFx0XHRcdFx0Y29uc3QgaXNNZW51SXRlbSA9IGlzSU1lbnVJdGVtKGl0ZW0pO1xuXHRcdFx0XHRcdGlmIChpc01lbnVJdGVtKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9oaWRkZW5TdGF0ZXMuc2V0RGVmYXVsdFN0YXRlKHRoaXMuX2lkLCBpdGVtLmNvbW1hbmQuaWQsICEhaXRlbS5pc0hpZGRlbkJ5RGVmYXVsdCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgbWVudUhpZGUgPSBjcmVhdGVNZW51SGlkZSh0aGlzLl9pZCwgaXNNZW51SXRlbSA/IGl0ZW0uY29tbWFuZCA6IGl0ZW0sIHRoaXMuX2hpZGRlblN0YXRlcyk7XG5cdFx0XHRcdFx0aWYgKGlzTWVudUl0ZW0pIHtcblx0XHRcdFx0XHRcdC8vIE1lbnVJdGVtQWN0aW9uXG5cdFx0XHRcdFx0XHRjb25zdCBtZW51S2V5YmluZGluZyA9IGNyZWF0ZUNvbmZpZ3VyZUtleWJpbmRpbmdBY3Rpb24odGhpcy5fY29tbWFuZFNlcnZpY2UsIHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLCBpdGVtLmNvbW1hbmQuaWQsIGl0ZW0ud2hlbik7XG5cdFx0XHRcdFx0XHQoYWN0aXZlQWN0aW9ucyA/Pz0gW10pLnB1c2gobmV3IE1lbnVJdGVtQWN0aW9uKGl0ZW0uY29tbWFuZCwgaXRlbS5hbHQsIG9wdGlvbnMsIG1lbnVIaWRlLCBtZW51S2V5YmluZGluZywgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsIHRoaXMuX2NvbW1hbmRTZXJ2aWNlKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIFN1Ym1lbnVJdGVtQWN0aW9uXG5cdFx0XHRcdFx0XHRjb25zdCBncm91cHMgPSBuZXcgTWVudUluZm8oaXRlbS5zdWJtZW51LCB0aGlzLl9oaWRkZW5TdGF0ZXMsIHRoaXMuX2NvbGxlY3RDb250ZXh0S2V5c0ZvclN1Ym1lbnVzLCB0aGlzLl9jb21tYW5kU2VydmljZSwgdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKS5jcmVhdGVBY3Rpb25Hcm91cHMob3B0aW9ucyk7XG5cdFx0XHRcdFx0XHRjb25zdCBzdWJtZW51QWN0aW9ucyA9IFNlcGFyYXRvci5qb2luKC4uLmdyb3Vwcy5tYXAoZyA9PiBnWzFdKSk7XG5cdFx0XHRcdFx0XHRpZiAoc3VibWVudUFjdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0XHQoYWN0aXZlQWN0aW9ucyA/Pz0gW10pLnB1c2gobmV3IFN1Ym1lbnVJdGVtQWN0aW9uKGl0ZW0sIG1lbnVIaWRlLCBzdWJtZW51QWN0aW9ucykpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGFjdGl2ZUFjdGlvbnMgJiYgYWN0aXZlQWN0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKFtpZCwgYWN0aXZlQWN0aW9uc10pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9zb3J0KG1lbnVJdGVtczogKElNZW51SXRlbSB8IElTdWJtZW51SXRlbSlbXSk6IChJTWVudUl0ZW0gfCBJU3VibWVudUl0ZW0pW10ge1xuXHRcdHJldHVybiBtZW51SXRlbXMuc29ydChNZW51SW5mby5fY29tcGFyZU1lbnVJdGVtcyk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfY29tcGFyZU1lbnVJdGVtcyhhOiBJTWVudUl0ZW0gfCBJU3VibWVudUl0ZW0sIGI6IElNZW51SXRlbSB8IElTdWJtZW51SXRlbSk6IG51bWJlciB7XG5cblx0XHRjb25zdCBhR3JvdXAgPSBhLmdyb3VwO1xuXHRcdGNvbnN0IGJHcm91cCA9IGIuZ3JvdXA7XG5cblx0XHRpZiAoYUdyb3VwICE9PSBiR3JvdXApIHtcblxuXHRcdFx0Ly8gRmFsc3kgZ3JvdXBzIGNvbWUgbGFzdFxuXHRcdFx0aWYgKCFhR3JvdXApIHtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9IGVsc2UgaWYgKCFiR3JvdXApIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyAnbmF2aWdhdGlvbicgZ3JvdXAgY29tZXMgZmlyc3Rcblx0XHRcdGlmIChhR3JvdXAgPT09ICduYXZpZ2F0aW9uJykge1xuXHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHR9IGVsc2UgaWYgKGJHcm91cCA9PT0gJ25hdmlnYXRpb24nKSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBsZXhpY2FsIHNvcnQgZm9yIGdyb3Vwc1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBhR3JvdXAubG9jYWxlQ29tcGFyZShiR3JvdXApO1xuXHRcdFx0aWYgKHZhbHVlICE9PSAwKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBzb3J0IG9uIHByaW9yaXR5IC0gZGVmYXVsdCBpcyAwXG5cdFx0Y29uc3QgYVByaW8gPSBhLm9yZGVyIHx8IDA7XG5cdFx0Y29uc3QgYlByaW8gPSBiLm9yZGVyIHx8IDA7XG5cdFx0aWYgKGFQcmlvIDwgYlByaW8pIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9IGVsc2UgaWYgKGFQcmlvID4gYlByaW8pIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblxuXHRcdC8vIHNvcnQgb24gdGl0bGVzXG5cdFx0cmV0dXJuIE1lbnVJbmZvLl9jb21wYXJlVGl0bGVzKFxuXHRcdFx0aXNJTWVudUl0ZW0oYSkgPyBhLmNvbW1hbmQudGl0bGUgOiBhLnRpdGxlLFxuXHRcdFx0aXNJTWVudUl0ZW0oYikgPyBiLmNvbW1hbmQudGl0bGUgOiBiLnRpdGxlXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jb21wYXJlVGl0bGVzKGE6IHN0cmluZyB8IElMb2NhbGl6ZWRTdHJpbmcsIGI6IHN0cmluZyB8IElMb2NhbGl6ZWRTdHJpbmcpIHtcblx0XHRjb25zdCBhU3RyID0gdHlwZW9mIGEgPT09ICdzdHJpbmcnID8gYSA6IGEub3JpZ2luYWw7XG5cdFx0Y29uc3QgYlN0ciA9IHR5cGVvZiBiID09PSAnc3RyaW5nJyA/IGIgOiBiLm9yaWdpbmFsO1xuXHRcdHJldHVybiBhU3RyLmxvY2FsZUNvbXBhcmUoYlN0cik7XG5cdH1cbn1cblxuY2xhc3MgTWVudUltcGwgaW1wbGVtZW50cyBJTWVudSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbWVudUluZm86IE1lbnVJbmZvO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZTogRW1pdHRlcjxJTWVudUNoYW5nZUV2ZW50Pjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PElNZW51Q2hhbmdlRXZlbnQ+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBNZW51SWQsXG5cdFx0aGlkZGVuU3RhdGVzOiBQZXJzaXN0ZWRNZW51SGlkZVN0YXRlLFxuXHRcdG9wdGlvbnM6IFJlcXVpcmVkPElNZW51Q3JlYXRlT3B0aW9ucz4sXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5fbWVudUluZm8gPSBuZXcgTWVudUluZm8oaWQsIGhpZGRlblN0YXRlcywgb3B0aW9ucy5lbWl0RXZlbnRzRm9yU3VibWVudUNoYW5nZXMsIGNvbW1hbmRTZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0Ly8gUmVidWlsZCB0aGlzIG1lbnUgd2hlbmV2ZXIgdGhlIG1lbnUgcmVnaXN0cnkgcmVwb3J0cyBhbiBldmVudCBmb3IgdGhpcyBNZW51SWQuXG5cdFx0Ly8gVGhpcyB1c3VhbGx5IGhhcHBlbiB3aGlsZSBjb2RlIGFuZCBleHRlbnNpb25zIGFyZSBsb2FkZWQgYW5kIGFmZmVjdHMgdGhlIG92ZXJcblx0XHQvLyBzdHJ1Y3R1cmUgb2YgdGhlIG1lbnVcblx0XHRjb25zdCByZWJ1aWxkTWVudVNvb24gPSBuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHR0aGlzLl9tZW51SW5mby5yZWZyZXNoKCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsgbWVudTogdGhpcywgaXNTdHJ1Y3R1cmFsQ2hhbmdlOiB0cnVlLCBpc0VuYWJsZW1lbnRDaGFuZ2U6IHRydWUsIGlzVG9nZ2xlQ2hhbmdlOiB0cnVlIH0pO1xuXHRcdH0sIG9wdGlvbnMuZXZlbnREZWJvdW5jZURlbGF5KTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQocmVidWlsZE1lbnVTb29uKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoTWVudVJlZ2lzdHJ5Lm9uRGlkQ2hhbmdlTWVudShlID0+IHtcblx0XHRcdGZvciAoY29uc3QgaWQgb2YgdGhpcy5fbWVudUluZm8uYWxsTWVudUlkcykge1xuXHRcdFx0XHRpZiAoZS5oYXMoaWQpKSB7XG5cdFx0XHRcdFx0cmVidWlsZE1lbnVTb29uLnNjaGVkdWxlKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBXaGVuIGNvbnRleHQga2V5cyBvciBzdG9yYWdlIHN0YXRlIGNoYW5nZXMgd2UgbmVlZCB0byBjaGVjayBpZiB0aGUgbWVudSBhbHNvIGhhcyBjaGFuZ2VkLiBIb3dldmVyLFxuXHRcdC8vIHdlIG9ubHkgZG8gdGhhdCB3aGVuIHNvbWVvbmUgbGlzdGVucyBvbiB0aGlzIG1lbnUgYmVjYXVzZSAoMSkgdGhlc2UgZXZlbnRzIGFyZVxuXHRcdC8vIGZpcmluZyBvZnRlbiBhbmQgKDIpIG1lbnUgYXJlIG9mdGVuIGxlYWtlZFxuXHRcdGNvbnN0IGxhenlMaXN0ZW5lciA9IHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdFx0Y29uc3QgbWVyZ2UgPSAoZXZlbnRzOiBJTWVudUNoYW5nZUV2ZW50W10pOiBJTWVudUNoYW5nZUV2ZW50ID0+IHtcblxuXHRcdFx0bGV0IGlzU3RydWN0dXJhbENoYW5nZSA9IGZhbHNlO1xuXHRcdFx0bGV0IGlzRW5hYmxlbWVudENoYW5nZSA9IGZhbHNlO1xuXHRcdFx0bGV0IGlzVG9nZ2xlQ2hhbmdlID0gZmFsc2U7XG5cblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBldmVudHMpIHtcblx0XHRcdFx0aXNTdHJ1Y3R1cmFsQ2hhbmdlID0gaXNTdHJ1Y3R1cmFsQ2hhbmdlIHx8IGl0ZW0uaXNTdHJ1Y3R1cmFsQ2hhbmdlO1xuXHRcdFx0XHRpc0VuYWJsZW1lbnRDaGFuZ2UgPSBpc0VuYWJsZW1lbnRDaGFuZ2UgfHwgaXRlbS5pc0VuYWJsZW1lbnRDaGFuZ2U7XG5cdFx0XHRcdGlzVG9nZ2xlQ2hhbmdlID0gaXNUb2dnbGVDaGFuZ2UgfHwgaXRlbS5pc1RvZ2dsZUNoYW5nZTtcblx0XHRcdFx0aWYgKGlzU3RydWN0dXJhbENoYW5nZSAmJiBpc0VuYWJsZW1lbnRDaGFuZ2UgJiYgaXNUb2dnbGVDaGFuZ2UpIHtcblx0XHRcdFx0XHQvLyBldmVyeXRoaW5nIGlzIFRSVUUsIG5vIG5lZWQgdG8gY29udGludWUgaXRlcmF0aW5nXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHsgbWVudTogdGhpcywgaXNTdHJ1Y3R1cmFsQ2hhbmdlLCBpc0VuYWJsZW1lbnRDaGFuZ2UsIGlzVG9nZ2xlQ2hhbmdlIH07XG5cdFx0fTtcblxuXHRcdGNvbnN0IHN0YXJ0TGF6eUxpc3RlbmVyID0gKCkgPT4ge1xuXG5cdFx0XHRsYXp5TGlzdGVuZXIuYWRkKGNvbnRleHRLZXlTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGV4dChlID0+IHtcblx0XHRcdFx0Y29uc3QgaXNTdHJ1Y3R1cmFsQ2hhbmdlID0gZS5hZmZlY3RzU29tZSh0aGlzLl9tZW51SW5mby5zdHJ1Y3R1cmVDb250ZXh0S2V5cyk7XG5cdFx0XHRcdGNvbnN0IGlzRW5hYmxlbWVudENoYW5nZSA9IGUuYWZmZWN0c1NvbWUodGhpcy5fbWVudUluZm8ucHJlY29uZGl0aW9uQ29udGV4dEtleXMpO1xuXHRcdFx0XHRjb25zdCBpc1RvZ2dsZUNoYW5nZSA9IGUuYWZmZWN0c1NvbWUodGhpcy5fbWVudUluZm8udG9nZ2xlZENvbnRleHRLZXlzKTtcblx0XHRcdFx0aWYgKGlzU3RydWN0dXJhbENoYW5nZSB8fCBpc0VuYWJsZW1lbnRDaGFuZ2UgfHwgaXNUb2dnbGVDaGFuZ2UpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsgbWVudTogdGhpcywgaXNTdHJ1Y3R1cmFsQ2hhbmdlLCBpc0VuYWJsZW1lbnRDaGFuZ2UsIGlzVG9nZ2xlQ2hhbmdlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHRsYXp5TGlzdGVuZXIuYWRkKGhpZGRlblN0YXRlcy5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IG1lbnU6IHRoaXMsIGlzU3RydWN0dXJhbENoYW5nZTogdHJ1ZSwgaXNFbmFibGVtZW50Q2hhbmdlOiBmYWxzZSwgaXNUb2dnbGVDaGFuZ2U6IGZhbHNlIH0pO1xuXHRcdFx0fSkpO1xuXHRcdH07XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZSA9IG5ldyBEZWJvdW5jZUVtaXR0ZXIoe1xuXHRcdFx0Ly8gc3RhcnQvc3RvcCBjb250ZXh0IGtleSBsaXN0ZW5lclxuXHRcdFx0b25XaWxsQWRkRmlyc3RMaXN0ZW5lcjogc3RhcnRMYXp5TGlzdGVuZXIsXG5cdFx0XHRvbkRpZFJlbW92ZUxhc3RMaXN0ZW5lcjogbGF6eUxpc3RlbmVyLmNsZWFyLmJpbmQobGF6eUxpc3RlbmVyKSxcblx0XHRcdGRlbGF5OiBvcHRpb25zLmV2ZW50RGVib3VuY2VEZWxheSxcblx0XHRcdG1lcmdlXG5cdFx0fSk7XG5cdFx0dGhpcy5vbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXHR9XG5cblx0Z2V0QWN0aW9ucyhvcHRpb25zPzogSU1lbnVBY3Rpb25PcHRpb25zIHwgdW5kZWZpbmVkKTogW3N0cmluZywgKE1lbnVJdGVtQWN0aW9uIHwgU3VibWVudUl0ZW1BY3Rpb24pW11dW10ge1xuXHRcdHJldHVybiB0aGlzLl9tZW51SW5mby5jcmVhdGVBY3Rpb25Hcm91cHMob3B0aW9ucyk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlTWVudUhpZGUobWVudTogTWVudUlkLCBjb21tYW5kOiBJQ29tbWFuZEFjdGlvbiB8IElTdWJtZW51SXRlbSwgc3RhdGVzOiBQZXJzaXN0ZWRNZW51SGlkZVN0YXRlKTogSU1lbnVJdGVtSGlkZSB7XG5cblx0Y29uc3QgaWQgPSBpc0lTdWJtZW51SXRlbShjb21tYW5kKSA/IGNvbW1hbmQuc3VibWVudS5pZCA6IGNvbW1hbmQuaWQ7XG5cdGNvbnN0IHRpdGxlID0gdHlwZW9mIGNvbW1hbmQudGl0bGUgPT09ICdzdHJpbmcnID8gY29tbWFuZC50aXRsZSA6IGNvbW1hbmQudGl0bGUudmFsdWU7XG5cblx0Y29uc3QgaGlkZSA9IHRvQWN0aW9uKHtcblx0XHRpZDogYGhpZGUvJHttZW51LmlkfS8ke2lkfWAsXG5cdFx0bGFiZWw6IGxvY2FsaXplKCdoaWRlLmxhYmVsJywgJ0hpZGUgXFwnezB9XFwnJywgdGl0bGUpLFxuXHRcdHJ1bigpIHsgc3RhdGVzLnVwZGF0ZUhpZGRlbihtZW51LCBpZCwgdHJ1ZSk7IH1cblx0fSk7XG5cblx0Y29uc3QgdG9nZ2xlID0gdG9BY3Rpb24oe1xuXHRcdGlkOiBgdG9nZ2xlLyR7bWVudS5pZH0vJHtpZH1gLFxuXHRcdGxhYmVsOiB0aXRsZSxcblx0XHRnZXQgY2hlY2tlZCgpIHsgcmV0dXJuICFzdGF0ZXMuaXNIaWRkZW4obWVudSwgaWQpOyB9LFxuXHRcdHJ1bigpIHsgc3RhdGVzLnVwZGF0ZUhpZGRlbihtZW51LCBpZCwgISF0aGlzLmNoZWNrZWQpOyB9XG5cdH0pO1xuXG5cdHJldHVybiB7XG5cdFx0aGlkZSxcblx0XHR0b2dnbGUsXG5cdFx0Z2V0IGlzSGlkZGVuKCkgeyByZXR1cm4gIXRvZ2dsZS5jaGVja2VkOyB9LFxuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29uZmlndXJlS2V5YmluZGluZ0FjdGlvbihjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLCBjb21tYW5kSWQ6IHN0cmluZywgd2hlbjogQ29udGV4dEtleUV4cHJlc3Npb24gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsIGVuYWJsZWQgPSB0cnVlKTogSUFjdGlvbiB7XG5cdHJldHVybiB0b0FjdGlvbih7XG5cdFx0aWQ6IGBjb25maWd1cmVLZXliaW5kaW5nLyR7Y29tbWFuZElkfWAsXG5cdFx0bGFiZWw6IGxvY2FsaXplKCdjb25maWd1cmUga2V5YmluZGluZycsIFwiQ29uZmlndXJlIEtleWJpbmRpbmdcIiksXG5cdFx0ZW5hYmxlZCxcblx0XHRydW4oKSB7XG5cdFx0XHQvLyBPbmx5IHNldCB0aGUgd2hlbiBjbGF1c2Ugd2hlbiB0aGVyZSBpcyBubyBrZXliaW5kaW5nXG5cdFx0XHQvLyBJdCBpcyBwb3NzaWJsZSB0aGF0IHRoZSBhY3Rpb24gYW5kIHRoZSBrZXliaW5kaW5nIGhhdmUgZGlmZmVyZW50IHdoZW4gY2xhdXNlc1xuXHRcdFx0Y29uc3QgaGFzS2V5YmluZGluZyA9ICEha2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhjb21tYW5kSWQpOyAvLyBUaGlzIG1heSBvbmx5IGJlIGNhbGxlZCBpbnNpZGUgdGhlIGBydW4oKWAgbWV0aG9kIGFzIGl0IGNhbiBiZSBleHBlbnNpdmUgb24gc3RhcnR1cC4gIzIxMDUyOVxuXHRcdFx0Y29uc3Qgd2hlblZhbHVlID0gIWhhc0tleWJpbmRpbmcgJiYgd2hlbiA/IHdoZW4uc2VyaWFsaXplKCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5vcGVuR2xvYmFsS2V5YmluZGluZ3MnLCBgQGNvbW1hbmQ6JHtjb21tYW5kSWR9YCArICh3aGVuVmFsdWUgPyBgICt3aGVuOiR7d2hlblZhbHVlfWAgOiAnJykpO1xuXHRcdH1cblx0fSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsaUJBQWlCLGVBQXNCO0FBQ2hELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQWtILGFBQWEsZ0JBQXNDLGdCQUFnQixjQUFjLHlCQUF5QjtBQUU1TixTQUFTLHVCQUF1QjtBQUNoQyxTQUErQiwwQkFBMEI7QUFDekQsU0FBa0IsV0FBVyxnQkFBZ0I7QUFDN0MsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywwQkFBMEI7QUFFNUIsSUFBTSxjQUFOLE1BQTBDO0FBQUEsRUFNaEQsWUFDbUMsaUJBQ0csb0JBQ3BCLGdCQUNoQjtBQUhpQztBQUNHO0FBR3JDLFNBQUssZ0JBQWdCLElBQUksdUJBQXVCLGNBQWM7QUFBQSxFQUMvRDtBQUFBLEVBRUEsV0FBVyxJQUFZLG1CQUF1QyxTQUFxQztBQUNsRyxXQUFPLElBQUksU0FBUyxJQUFJLEtBQUssZUFBZSxFQUFFLDZCQUE2QixPQUFPLG9CQUFvQixJQUFJLEdBQUcsUUFBUSxHQUFHLEtBQUssaUJBQWlCLEtBQUssb0JBQW9CLGlCQUFpQjtBQUFBLEVBQ3pMO0FBQUEsRUFFQSxlQUFlLElBQVksbUJBQXVDLFNBQXFGO0FBQ3RKLFVBQU0sT0FBTyxJQUFJLFNBQVMsSUFBSSxLQUFLLGVBQWUsRUFBRSw2QkFBNkIsT0FBTyxvQkFBb0IsSUFBSSxHQUFHLFFBQVEsR0FBRyxLQUFLLGlCQUFpQixLQUFLLG9CQUFvQixpQkFBaUI7QUFDOUwsVUFBTSxVQUFVLEtBQUssV0FBVyxPQUFPO0FB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
