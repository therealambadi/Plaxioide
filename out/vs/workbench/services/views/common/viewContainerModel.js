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
import { Extensions as ViewExtensions, defaultViewIcon, VIEWS_LOG_ID, VIEWS_LOG_NAME } from "../../../common/views.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { URI } from "../../../../base/common/uri.js";
import { coalesce, move } from "../../../../base/common/arrays.js";
import { isUndefined, isUndefinedOrNull } from "../../../../base/common/types.js";
import { isEqual } from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { CounterSet } from "../../../../base/common/map.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { windowLogGroup } from "../../log/common/logConstants.js";
function getViewsStateStorageId(viewContainerStorageId) {
  return `${viewContainerStorageId}.hidden`;
}
let ViewDescriptorsState = class extends Disposable {
  constructor(viewContainerStorageId, viewContainerName, storageService, loggerService) {
    super();
    this.viewContainerName = viewContainerName;
    this.storageService = storageService;
    this._onDidChangeStoredState = this._register(new Emitter());
    this.onDidChangeStoredState = this._onDidChangeStoredState.event;
    this.logger = new Lazy(() => loggerService.createLogger(VIEWS_LOG_ID, { name: VIEWS_LOG_NAME, group: windowLogGroup }));
    this.globalViewsStateStorageId = getViewsStateStorageId(viewContainerStorageId);
    this.workspaceViewsStateStorageId = viewContainerStorageId;
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, this.globalViewsStateStorageId, this._store)(() => this.onDidStorageChange()));
    this.state = this.initialize();
  }
  set(id, state) {
    this.state.set(id, state);
  }
  get(id) {
    return this.state.get(id);
  }
  updateState(viewDescriptors) {
    this.updateWorkspaceState(viewDescriptors);
    this.updateGlobalState(viewDescriptors);
  }
  updateWorkspaceState(viewDescriptors) {
    const storedViewsStates = this.getStoredWorkspaceState();
    for (const viewDescriptor of viewDescriptors) {
      const viewState = this.get(viewDescriptor.id);
      if (viewState) {
        storedViewsStates[viewDescriptor.id] = {
          collapsed: !!viewState.collapsed,
          isHidden: !viewState.visibleWorkspace,
          size: viewState.size,
          order: viewDescriptor.workspace && viewState ? viewState.order : void 0
        };
      }
    }
    if (Object.keys(storedViewsStates).length > 0) {
      this.storageService.store(this.workspaceViewsStateStorageId, JSON.stringify(storedViewsStates), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(this.workspaceViewsStateStorageId, StorageScope.WORKSPACE);
    }
  }
  updateGlobalState(viewDescriptors) {
    const storedGlobalState = this.getStoredGlobalState();
    for (const viewDescriptor of viewDescriptors) {
      const state = this.get(viewDescriptor.id);
      storedGlobalState.set(viewDescriptor.id, {
        id: viewDescriptor.id,
        isHidden: state && viewDescriptor.canToggleVisibility ? !state.visibleGlobal : false,
        order: !viewDescriptor.workspace && state ? state.order : void 0
      });
    }
    this.setStoredGlobalState(storedGlobalState);
  }
  onDidStorageChange() {
    if (this.globalViewsStatesValue !== this.getStoredGlobalViewsStatesValue()) {
      this._globalViewsStatesValue = void 0;
      const storedViewsVisibilityStates = this.getStoredGlobalState();
      const storedWorkspaceViewsStates = this.getStoredWorkspaceState();
      const changedStates = [];
      for (const [id, storedState] of storedViewsVisibilityStates) {
        const state = this.get(id);
        if (state) {
          if (state.visibleGlobal !== !storedState.isHidden) {
            if (!storedState.isHidden) {
              this.logger.value.info(`View visibility state changed: ${id} is now visible`, this.viewContainerName);
            }
            changedStates.push({ id, visible: !storedState.isHidden });
          }
        } else {
          const workspaceViewState = storedWorkspaceViewsStates[id];
          this.set(id, {
            active: false,
            visibleGlobal: !storedState.isHidden,
            visibleWorkspace: isUndefined(workspaceViewState?.isHidden) ? void 0 : !workspaceViewState?.isHidden,
            collapsed: workspaceViewState?.collapsed,
            order: workspaceViewState?.order,
            size: workspaceViewState?.size
          });
        }
      }
      if (changedStates.length) {
        this._onDidChangeStoredState.fire(changedStates);
        for (const changedState of changedStates) {
          const state = this.get(changedState.id);
          if (state) {
            state.visibleGlobal = changedState.visible;
          }
        }
      }
    }
  }
  initialize() {
    const viewStates = /* @__PURE__ */ new Map();
    const workspaceViewsStates = this.getStoredWorkspaceState();
    for (const id of Object.keys(workspaceViewsStates)) {
      const workspaceViewState = workspaceViewsStates[id];
      viewStates.set(id, {
        active: false,
        visibleGlobal: void 0,
        visibleWorkspace: isUndefined(workspaceViewState.isHidden) ? void 0 : !workspaceViewState.isHidden,
        collapsed: workspaceViewState.collapsed,
        order: workspaceViewState.order,
        size: workspaceViewState.size
      });
    }
    const value = this.storageService.get(this.globalViewsStateStorageId, StorageScope.WORKSPACE, "[]");
    const { state: workspaceVisibilityStates } = this.parseStoredGlobalState(value);
    if (workspaceVisibilityStates.size > 0) {
      for (const { id, isHidden } of workspaceVisibilityStates.values()) {
        const viewState = viewStates.get(id);
        if (viewState) {
          if (isUndefined(viewState.visibleWorkspace)) {
            viewState.visibleWorkspace = !isHidden;
          }
        } else {
          viewStates.set(id, {
            active: false,
            collapsed: void 0,
            visibleGlobal: void 0,
            visibleWorkspace: !isHidden
          });
        }
      }
      this.storageService.remove(this.globalViewsStateStorageId, StorageScope.WORKSPACE);
    }
    const { state, hasDuplicates } = this.parseStoredGlobalState(this.globalViewsStatesValue);
    if (hasDuplicates) {
      this.setStoredGlobalState(state);
    }
    for (const { id, isHidden, order } of state.values()) {
      const viewState = viewStates.get(id);
      if (viewState) {
        viewState.visibleGlobal = !isHidden;
        if (!isUndefined(order)) {
          viewState.order = order;
        }
      } else {
        viewStates.set(id, {
          active: false,
          visibleGlobal: !isHidden,
          order,
          collapsed: void 0,
          visibleWorkspace: void 0
        });
      }
    }
    return viewStates;
  }
  getStoredWorkspaceState() {
    return JSON.parse(this.storageService.get(this.workspaceViewsStateStorageId, StorageScope.WORKSPACE, "{}"));
  }
  getStoredGlobalState() {
    return this.parseStoredGlobalState(this.globalViewsStatesValue).state;
  }
  setStoredGlobalState(storedGlobalState) {
    this.globalViewsStatesValue = JSON.stringify([...storedGlobalState.values()]);
  }
  parseStoredGlobalState(value) {
    const storedValue = JSON.parse(value);
    let hasDuplicates = false;
    const state = storedValue.reduce((result, storedState) => {
      if (typeof storedState === "string") {
        hasDuplicates = hasDuplicates || result.has(storedState);
        result.set(storedState, { id: storedState, isHidden: true });
      } else {
        hasDuplicates = hasDuplicates || result.has(storedState.id);
        result.set(storedState.id, storedState);
      }
      return result;
    }, /* @__PURE__ */ new Map());
    return { state, hasDuplicates };
  }
  get globalViewsStatesValue() {
    if (!this._globalViewsStatesValue) {
      this._globalViewsStatesValue = this.getStoredGlobalViewsStatesValue();
    }
    return this._globalViewsStatesValue;
  }
  set globalViewsStatesValue(globalViewsStatesValue) {
    if (this.globalViewsStatesValue !== globalViewsStatesValue) {
      this._globalViewsStatesValue = globalViewsStatesValue;
      this.setStoredGlobalViewsStatesValue(globalViewsStatesValue);
    }
  }
  getStoredGlobalViewsStatesValue() {
    return this.storageService.get(this.globalViewsStateStorageId, StorageScope.PROFILE, "[]");
  }
  setStoredGlobalViewsStatesValue(value) {
    this.storageService.store(this.globalViewsStateStorageId, value, StorageScope.PROFILE, StorageTarget.USER);
  }
};
ViewDescriptorsState = __decorateClass([
  __decorateParam(2, IStorageService),
  __decorateParam(3, ILoggerService)
], ViewDescriptorsState);
let ViewContainerModel = class extends Disposable {
  constructor(viewContainer, instantiationService, contextKeyService, loggerService) {
    super();
    this.viewContainer = viewContainer;
    this.contextKeyService = contextKeyService;
    this.contextKeys = new CounterSet();
    this.viewDescriptorItems = [];
    this._onDidChangeContainerInfo = this._register(new Emitter());
    this.onDidChangeContainerInfo = this._onDidChangeContainerInfo.event;
    this._onDidChangeAllViewDescriptors = this._register(new Emitter());
    this.onDidChangeAllViewDescriptors = this._onDidChangeAllViewDescriptors.event;
    this._onDidChangeActiveViewDescriptors = this._register(new Emitter());
    this.onDidChangeActiveViewDescriptors = this._onDidChangeActiveViewDescriptors.event;
    this._onDidAddVisibleViewDescriptors = this._register(new Emitter());
    this.onDidAddVisibleViewDescriptors = this._onDidAddVisibleViewDescriptors.event;
    this._onDidRemoveVisibleViewDescriptors = this._register(new Emitter());
    this.onDidRemoveVisibleViewDescriptors = this._onDidRemoveVisibleViewDescriptors.event;
    this._onDidMoveVisibleViewDescriptors = this._register(new Emitter());
    this.onDidMoveVisibleViewDescriptors = this._onDidMoveVisibleViewDescriptors.event;
    this.logger = new Lazy(() => loggerService.createLogger(VIEWS_LOG_ID, { name: VIEWS_LOG_NAME, group: windowLogGroup }));
    this._register(Event.filter(contextKeyService.onDidChangeContext, (e) => e.affectsSome(this.contextKeys))(() => this.onDidChangeContext()));
    this.viewDescriptorsState = this._register(instantiationService.createInstance(ViewDescriptorsState, viewContainer.storageId || `${viewContainer.id}.state`, typeof viewContainer.title === "string" ? viewContainer.title : viewContainer.title.original));
    this._register(this.viewDescriptorsState.onDidChangeStoredState((items) => this.updateVisibility(items)));
    this.updateContainerInfo();
  }
  get title() {
    return this._title;
  }
  get icon() {
    return this._icon;
  }
  get keybindingId() {
    return this._keybindingId;
  }
  // All View Descriptors
  get allViewDescriptors() {
    return this.viewDescriptorItems.map((item) => item.viewDescriptor);
  }
  // Active View Descriptors
  get activeViewDescriptors() {
    return this.viewDescriptorItems.filter((item) => item.state.active).map((item) => item.viewDescriptor);
  }
  // Visible View Descriptors
  get visibleViewDescriptors() {
    return this.viewDescriptorItems.filter((item) => this.isViewDescriptorVisible(item)).map((item) => item.viewDescriptor);
  }
  updateContainerInfo() {
    const useDefaultContainerInfo = this.viewContainer.alwaysUseContainerInfo || this.visibleViewDescriptors.length === 0 || this.visibleViewDescriptors.some((v) => Registry.as(ViewExtensions.ViewsRegistry).getViewContainer(v.id) === this.viewContainer);
    const title = useDefaultContainerInfo ? typeof this.viewContainer.title === "string" ? this.viewContainer.title : this.viewContainer.title.value : this.visibleViewDescriptors[0]?.containerTitle || this.visibleViewDescriptors[0]?.name?.value || "";
    let titleChanged = false;
    if (this._title !== title) {
      this._title = title;
      titleChanged = true;
    }
    const icon = useDefaultContainerInfo ? this.viewContainer.icon : this.visibleViewDescriptors[0]?.containerIcon || defaultViewIcon;
    let iconChanged = false;
    if (!this.isEqualIcon(icon)) {
      this._icon = icon;
      iconChanged = true;
    }
    const keybindingId = this.viewContainer.openCommandActionDescriptor?.id ?? this.activeViewDescriptors.find((v) => v.openCommandActionDescriptor)?.openCommandActionDescriptor?.id;
    let keybindingIdChanged = false;
    if (this._keybindingId !== keybindingId) {
      this._keybindingId = keybindingId;
      keybindingIdChanged = true;
    }
    if (titleChanged || iconChanged || keybindingIdChanged) {
      this._onDidChangeContainerInfo.fire({ title: titleChanged, icon: iconChanged, keybindingId: keybindingIdChanged });
    }
  }
  isEqualIcon(icon) {
    if (URI.isUri(icon)) {
      return URI.isUri(this._icon) && isEqual(icon, this._icon);
    } else if (ThemeIcon.isThemeIcon(icon)) {
      return ThemeIcon.isThemeIcon(this._icon) && ThemeIcon.isEqual(icon, this._icon);
    }
    return icon === this._icon;
  }
  isVisible(id) {
    const viewDescriptorItem = this.viewDescriptorItems.find((v) => v.viewDescriptor.id === id);
    if (!viewDescriptorItem) {
      throw new Error(`Unknown view ${id}`);
    }
    return this.isViewDescriptorVisible(viewDescriptorItem);
  }
  setVisible(id, visible) {
    this.updateVisibility([{ id, visible }]);
  }
  updateVisibility(viewDescriptors) {
    const viewDescriptorItemsToHide = coalesce(viewDescriptors.filter(({ visible }) => !visible).map(({ id }) => this.findAndIgnoreIfNotFound(id)));
    const removed = [];
    for (const { viewDescriptorItem, visibleIndex } of viewDescriptorItemsToHide) {
      if (this.updateViewDescriptorItemVisibility(viewDescriptorItem, false)) {
        removed.push({ viewDescriptor: viewDescriptorItem.viewDescriptor, index: visibleIndex });
      }
    }
    if (removed.length) {
      this.broadCastRemovedVisibleViewDescriptors(removed);
    }
    const added = [];
    for (const { id, visible } of viewDescriptors) {
      if (!visible) {
        continue;
      }
      const foundViewDescriptor = this.findAndIgnoreIfNotFound(id);
      if (!foundViewDescriptor) {
        continue;
      }
      const { viewDescriptorItem, visibleIndex } = foundViewDescriptor;
      if (this.updateViewDescriptorItemVisibility(viewDescriptorItem, true)) {
        added.push({ index: visibleIndex, viewDescriptor: viewDescriptorItem.viewDescriptor, size: viewDescriptorItem.state.size, collapsed: !!viewDescriptorItem.state.collapsed });
      }
    }
    if (added.length) {
      this.broadCastAddedVisibleViewDescriptors(added);
    }
  }
  updateViewDescriptorItemVisibility(viewDescriptorItem, visible) {
    if (!viewDescriptorItem.viewDescriptor.canToggleVisibility) {
      return false;
    }
    if (this.isViewDescriptorVisibleWhenActive(viewDescriptorItem) === visible) {
      return false;
    }
    if (viewDescriptorItem.viewDescriptor.workspace) {
      viewDescriptorItem.state.visibleWorkspace = visible;
    } else {
      viewDescriptorItem.state.visibleGlobal = visible;
      if (visible) {
        this.logger.value.info(`Showing view ${viewDescriptorItem.viewDescriptor.id} in the container ${this.viewContainer.id}`);
      }
    }
    return this.isViewDescriptorVisible(viewDescriptorItem) === visible;
  }
  isCollapsed(id) {
    return !!this.find(id).viewDescriptorItem.state.collapsed;
  }
  setCollapsed(id, collapsed) {
    const { viewDescriptorItem } = this.find(id);
    if (viewDescriptorItem.state.collapsed !== collapsed) {
      viewDescriptorItem.state.collapsed = collapsed;
    }
    this.viewDescriptorsState.updateState(this.allViewDescriptors);
  }
  getSize(id) {
    return this.find(id).viewDescriptorItem.state.size;
  }
  setSizes(newSizes) {
    for (const { id, size } of newSizes) {
      const { viewDescriptorItem } = this.find(id);
      if (viewDescriptorItem.state.size !== size) {
        viewDescriptorItem.state.size = size;
      }
    }
    this.viewDescriptorsState.updateState(this.allViewDescriptors);
  }
  move(from, to) {
    const fromIndex = this.viewDescriptorItems.findIndex((v) => v.viewDescriptor.id === from);
    const toIndex = this.viewDescriptorItems.findIndex((v) => v.viewDescriptor.id === to);
    const fromViewDescriptor = this.viewDescriptorItems[fromIndex];
    const toViewDescriptor = this.viewDescriptorItems[toIndex];
    move(this.viewDescriptorItems, fromIndex, toIndex);
    for (let index = 0; index < this.viewDescriptorItems.length; index++) {
      this.viewDescriptorItems[index].state.order = index;
    }
    this.broadCastMovedViewDescriptors({ index: fromIndex, viewDescriptor: fromViewDescriptor.viewDescriptor }, { index: toIndex, viewDescriptor: toViewDescriptor.viewDescriptor });
  }
  add(addedViewDescriptorStates) {
    const addedItems = [];
    for (const addedViewDescriptorState of addedViewDescriptorStates) {
      const viewDescriptor = addedViewDescriptorState.viewDescriptor;
      if (viewDescriptor.when) {
        for (const key of viewDescriptor.when.keys()) {
          this.contextKeys.add(key);
        }
      }
      let state = this.viewDescriptorsState.get(viewDescriptor.id);
      if (state) {
        if (viewDescriptor.workspace) {
          state.visibleWorkspace = isUndefinedOrNull(addedViewDescriptorState.visible) ? isUndefinedOrNull(state.visibleWorkspace) ? !viewDescriptor.hideByDefault : state.visibleWorkspace : addedViewDescriptorState.visible;
        } else {
          const isVisible = state.visibleGlobal;
          state.visibleGlobal = isUndefinedOrNull(addedViewDescriptorState.visible) ? isUndefinedOrNull(state.visibleGlobal) ? !viewDescriptor.hideByDefault : state.visibleGlobal : addedViewDescriptorState.visible;
          if (state.visibleGlobal && !isVisible) {
            this.logger.value.info(`Added view ${viewDescriptor.id} in the container ${this.viewContainer.id} and showing it.`, `${isVisible}`, `${viewDescriptor.hideByDefault}`, `${addedViewDescriptorState.visible}`);
          }
        }
        state.collapsed = isUndefinedOrNull(addedViewDescriptorState.collapsed) ? isUndefinedOrNull(state.collapsed) ? !!viewDescriptor.collapsed : state.collapsed : addedViewDescriptorState.collapsed;
      } else {
        state = {
          active: false,
          visibleGlobal: isUndefinedOrNull(addedViewDescriptorState.visible) ? !viewDescriptor.hideByDefault : addedViewDescriptorState.visible,
          visibleWorkspace: isUndefinedOrNull(addedViewDescriptorState.visible) ? !viewDescriptor.hideByDefault : addedViewDescriptorState.visible,
          collapsed: isUndefinedOrNull(addedViewDescriptorState.collapsed) ? !!viewDescriptor.collapsed : addedViewDescriptorState.collapsed
        };
      }
      this.viewDescriptorsState.set(viewDescriptor.id, state);
      state.active = this.contextKeyService.contextMatchesRules(viewDescriptor.when);
      addedItems.push({ viewDescriptor, state });
    }
    this.viewDescriptorItems.push(...addedItems);
    this.viewDescriptorItems.sort(this.compareViewDescriptors.bind(this));
    this._onDidChangeAllViewDescriptors.fire({ added: addedItems.map(({ viewDescriptor }) => viewDescriptor), removed: [] });
    const addedActiveItems = [];
    for (const viewDescriptorItem of addedItems) {
      if (viewDescriptorItem.state.active) {
        addedActiveItems.push({ viewDescriptorItem, visible: this.isViewDescriptorVisible(viewDescriptorItem) });
      }
    }
    if (addedActiveItems.length) {
      this._onDidChangeActiveViewDescriptors.fire({ added: addedActiveItems.map(({ viewDescriptorItem }) => viewDescriptorItem.viewDescriptor), removed: [] });
    }
    const addedVisibleDescriptors = [];
    for (const { viewDescriptorItem, visible } of addedActiveItems) {
      if (visible && this.isViewDescriptorVisible(viewDescriptorItem)) {
        const { visibleIndex } = this.find(viewDescriptorItem.viewDescriptor.id);
        addedVisibleDescriptors.push({ index: visibleIndex, viewDescriptor: viewDescriptorItem.viewDescriptor, size: viewDescriptorItem.state.size, collapsed: !!viewDescriptorItem.state.collapsed });
      }
    }
    this.broadCastAddedVisibleViewDescriptors(addedVisibleDescriptors);
  }
  remove(viewDescriptors) {
    const removed = [];
    const removedItems = [];
    const removedActiveDescriptors = [];
    const removedVisibleDescriptors = [];
    for (const viewDescriptor of viewDescriptors) {
      if (viewDescriptor.when) {
        for (const key of viewDescriptor.when.keys()) {
          this.contextKeys.delete(key);
        }
      }
      const index = this.viewDescriptorItems.findIndex((i) => i.viewDescriptor.id === viewDescriptor.id);
      if (index !== -1) {
        removed.push(viewDescriptor);
        const viewDescriptorItem = this.viewDescriptorItems[index];
        if (viewDescriptorItem.state.active) {
          removedActiveDescriptors.push(viewDescriptorItem.viewDescriptor);
        }
        if (this.isViewDescriptorVisible(viewDescriptorItem)) {
          const { visibleIndex } = this.find(viewDescriptorItem.viewDescriptor.id);
          removedVisibleDescriptors.push({ index: visibleIndex, viewDescriptor: viewDescriptorItem.viewDescriptor });
        }
        removedItems.push(viewDescriptorItem);
      }
    }
    removedItems.forEach((item) => this.viewDescriptorItems.splice(this.viewDescriptorItems.indexOf(item), 1));
    this.broadCastRemovedVisibleViewDescriptors(removedVisibleDescriptors);
    if (removedActiveDescriptors.length) {
      this._onDidChangeActiveViewDescriptors.fire({ added: [], removed: removedActiveDescriptors });
    }
    if (removed.length) {
      this._onDidChangeAllViewDescriptors.fire({ added: [], removed });
    }
  }
  onDidChangeContext() {
    const addedActiveItems = [];
    const removedActiveItems = [];
    for (const item of this.viewDescriptorItems) {
      const wasActive = item.state.active;
      const isActive = this.contextKeyService.contextMatchesRules(item.viewDescriptor.when);
      if (wasActive !== isActive) {
        if (isActive) {
          addedActiveItems.push({ item, visibleWhenActive: this.isViewDescriptorVisibleWhenActive(item) });
        } else {
          removedActiveItems.push(item);
        }
      }
    }
    const removedVisibleDescriptors = [];
    for (const item of removedActiveItems) {
      if (this.isViewDescriptorVisible(item)) {
        const { visibleIndex } = this.find(item.viewDescriptor.id);
        removedVisibleDescriptors.push({ index: visibleIndex, viewDescriptor: item.viewDescriptor });
      }
    }
    removedActiveItems.forEach((item) => item.state.active = false);
    addedActiveItems.forEach(({ item }) => item.state.active = true);
    this.broadCastRemovedVisibleViewDescriptors(removedVisibleDescriptors);
    if (addedActiveItems.length || removedActiveItems.length) {
      this._onDidChangeActiveViewDescriptors.fire({ added: addedActiveItems.map(({ item }) => item.viewDescriptor), removed: removedActiveItems.map((item) => item.viewDescriptor) });
    }
    const addedVisibleDescriptors = [];
    for (const { item, visibleWhenActive } of addedActiveItems) {
      if (visibleWhenActive && this.isViewDescriptorVisible(item)) {
        const { visibleIndex } = this.find(item.viewDescriptor.id);
        addedVisibleDescriptors.push({ index: visibleIndex, viewDescriptor: item.viewDescriptor, size: item.state.size, collapsed: !!item.state.collapsed });
      }
    }
    this.broadCastAddedVisibleViewDescriptors(addedVisibleDescriptors);
  }
  broadCastAddedVisibleViewDescriptors(added) {
    if (added.length) {
      this._onDidAddVisibleViewDescriptors.fire(added.sort((a, b) => a.index - b.index));
      this.updateState(`Added views:${added.map((v) => v.viewDescriptor.id).join(",")} in ${this.viewContainer.id}`);
    }
  }
  broadCastRemovedVisibleViewDescriptors(removed) {
    if (removed.length) {
      this._onDidRemoveVisibleViewDescriptors.fire(removed.sort((a, b) => b.index - a.index));
      this.updateState(`Removed views:${removed.map((v) => v.viewDescriptor.id).join(",")} from ${this.viewContainer.id}`);
    }
  }
  broadCastMovedViewDescriptors(from, to) {
    this._onDidMoveVisibleViewDescriptors.fire({ from, to });
    this.updateState(`Moved view ${from.viewDescriptor.id} to ${to.viewDescriptor.id} in ${this.viewContainer.id}`);
  }
  updateState(reason) {
    this.logger.value.info(reason);
    this.viewDescriptorsState.updateState(this.allViewDescriptors);
    this.updateContainerInfo();
  }
  isViewDescriptorVisible(viewDescriptorItem) {
    if (!viewDescriptorItem.state.active) {
      return false;
    }
    return this.isViewDescriptorVisibleWhenActive(viewDescriptorItem);
  }
  isViewDescriptorVisibleWhenActive(viewDescriptorItem) {
    if (viewDescriptorItem.viewDescriptor.workspace) {
      return !!viewDescriptorItem.state.visibleWorkspace;
    }
    return !!viewDescriptorItem.state.visibleGlobal;
  }
  find(id) {
    const result = this.findAndIgnoreIfNotFound(id);
    if (result) {
      return result;
    }
    throw new Error(`view descriptor ${id} not found`);
  }
  findAndIgnoreIfNotFound(id) {
    for (let i = 0, visibleIndex = 0; i < this.viewDescriptorItems.length; i++) {
      const viewDescriptorItem = this.viewDescriptorItems[i];
      if (viewDescriptorItem.viewDescriptor.id === id) {
        return { index: i, visibleIndex, viewDescriptorItem };
      }
      if (this.isViewDescriptorVisible(viewDescriptorItem)) {
        visibleIndex++;
      }
    }
    return void 0;
  }
  compareViewDescriptors(a, b) {
    if (a.viewDescriptor.id === b.viewDescriptor.id) {
      return 0;
    }
    return this.getViewOrder(a) - this.getViewOrder(b) || this.getGroupOrderResult(a.viewDescriptor, b.viewDescriptor);
  }
  getViewOrder(viewDescriptorItem) {
    const viewOrder = typeof viewDescriptorItem.state.order === "number" ? viewDescriptorItem.state.order : viewDescriptorItem.viewDescriptor.order;
    return typeof viewOrder === "number" ? viewOrder : Number.MAX_VALUE;
  }
  getGroupOrderResult(a, b) {
    if (!a.group || !b.group) {
      return 0;
    }
    if (a.group === b.group) {
      return 0;
    }
    return a.group < b.group ? -1 : 1;
  }
};
ViewContainerModel = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ILoggerService)
], ViewContainerModel);
export {
  ViewContainerModel,
  getViewsStateStorageId
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdDb250YWluZXJNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFZpZXdDb250YWluZXIsIElWaWV3c1JlZ2lzdHJ5LCBJVmlld0Rlc2NyaXB0b3IsIEV4dGVuc2lvbnMgYXMgVmlld0V4dGVuc2lvbnMsIElWaWV3Q29udGFpbmVyTW9kZWwsIElBZGRlZFZpZXdEZXNjcmlwdG9yUmVmLCBJVmlld0Rlc2NyaXB0b3JSZWYsIElBZGRlZFZpZXdEZXNjcmlwdG9yU3RhdGUsIGRlZmF1bHRWaWV3SWNvbiwgVklFV1NfTE9HX0lELCBWSUVXU19MT0dfTkFNRSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgY29hbGVzY2UsIG1vdmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgaXNVbmRlZmluZWQsIGlzVW5kZWZpbmVkT3JOdWxsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTG9nZ2VyLCBJTG9nZ2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IENvdW50ZXJTZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgd2luZG93TG9nR3JvdXAgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZ0NvbnN0YW50cy5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRWaWV3c1N0YXRlU3RvcmFnZUlkKHZpZXdDb250YWluZXJTdG9yYWdlSWQ6IHN0cmluZyk6IHN0cmluZyB7IHJldHVybiBgJHt2aWV3Q29udGFpbmVyU3RvcmFnZUlkfS5oaWRkZW5gOyB9XG5cbmludGVyZmFjZSBJU3RvcmVkV29ya3NwYWNlVmlld1N0YXRlIHtcblx0Y29sbGFwc2VkOiBib29sZWFuO1xuXHRpc0hpZGRlbjogYm9vbGVhbjtcblx0c2l6ZT86IG51bWJlcjtcblx0b3JkZXI/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBJU3RvcmVkR2xvYmFsVmlld1N0YXRlIHtcblx0aWQ6IHN0cmluZztcblx0aXNIaWRkZW46IGJvb2xlYW47XG5cdG9yZGVyPzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSVZpZXdEZXNjcmlwdG9yU3RhdGUge1xuXHR2aXNpYmxlR2xvYmFsOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHR2aXNpYmxlV29ya3NwYWNlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRjb2xsYXBzZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdGFjdGl2ZTogYm9vbGVhbjtcblx0b3JkZXI/OiBudW1iZXI7XG5cdHNpemU/OiBudW1iZXI7XG59XG5cbmNsYXNzIFZpZXdEZXNjcmlwdG9yc1N0YXRlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VWaWV3c1N0YXRlU3RvcmFnZUlkOiBzdHJpbmc7XG5cdHByaXZhdGUgcmVhZG9ubHkgZ2xvYmFsVmlld3NTdGF0ZVN0b3JhZ2VJZDogc3RyaW5nO1xuXHRwcml2YXRlIHJlYWRvbmx5IHN0YXRlOiBNYXA8c3RyaW5nLCBJVmlld0Rlc2NyaXB0b3JTdGF0ZT47XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VTdG9yZWRTdGF0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgaWQ6IHN0cmluZzsgdmlzaWJsZTogYm9vbGVhbiB9W10+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVN0b3JlZFN0YXRlID0gdGhpcy5fb25EaWRDaGFuZ2VTdG9yZWRTdGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxvZ2dlcjogTGF6eTxJTG9nZ2VyPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR2aWV3Q29udGFpbmVyU3RvcmFnZUlkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB2aWV3Q29udGFpbmVyTmFtZTogc3RyaW5nLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTG9nZ2VyU2VydmljZSBsb2dnZXJTZXJ2aWNlOiBJTG9nZ2VyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMubG9nZ2VyID0gbmV3IExhenkoKCkgPT4gbG9nZ2VyU2VydmljZS5jcmVhdGVMb2dnZXIoVklFV1NfTE9HX0lELCB7IG5hbWU6IFZJRVdTX0xPR19OQU1FLCBncm91cDogd2luZG93TG9nR3JvdXAgfSkpO1xuXG5cdFx0dGhpcy5nbG9iYWxWaWV3c1N0YXRlU3RvcmFnZUlkID0gZ2V0Vmlld3NTdGF0ZVN0b3JhZ2VJZCh2aWV3Q29udGFpbmVyU3RvcmFnZUlkKTtcblx0XHR0aGlzLndvcmtzcGFjZVZpZXdzU3RhdGVTdG9yYWdlSWQgPSB2aWV3Q29udGFpbmVyU3RvcmFnZUlkO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VWYWx1ZShTdG9yYWdlU2NvcGUuUFJPRklMRSwgdGhpcy5nbG9iYWxWaWV3c1N0YXRlU3RvcmFnZUlkLCB0aGlzLl9zdG9yZSkoKCkgPT4gdGhpcy5vbkRpZFN0b3JhZ2VDaGFuZ2UoKSkpO1xuXG5cdFx0dGhpcy5zdGF0ZSA9IHRoaXMuaW5pdGlhbGl6ZSgpO1xuXG5cdH1cblxuXHRzZXQoaWQ6IHN0cmluZywgc3RhdGU6IElWaWV3RGVzY3JpcHRvclN0YXRlKTogdm9pZCB7XG5cdFx0dGhpcy5zdGF0ZS5zZXQoaWQsIHN0YXRlKTtcblx0fVxuXG5cdGdldChpZDogc3RyaW5nKTogSVZpZXdEZXNjcmlwdG9yU3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnN0YXRlLmdldChpZCk7XG5cdH1cblxuXHR1cGRhdGVTdGF0ZSh2aWV3RGVzY3JpcHRvcnM6IFJlYWRvbmx5QXJyYXk8SVZpZXdEZXNjcmlwdG9yPik6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlV29ya3NwYWNlU3RhdGUodmlld0Rlc2NyaXB0b3JzKTtcblx0XHR0aGlzLnVwZGF0ZUdsb2JhbFN0YXRlKHZpZXdEZXNjcmlwdG9ycyk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVdvcmtzcGFjZVN0YXRlKHZpZXdEZXNjcmlwdG9yczogUmVhZG9ubHlBcnJheTxJVmlld0Rlc2NyaXB0b3I+KTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RvcmVkVmlld3NTdGF0ZXMgPSB0aGlzLmdldFN0b3JlZFdvcmtzcGFjZVN0YXRlKCk7XG5cdFx0Zm9yIChjb25zdCB2aWV3RGVzY3JpcHRvciBvZiB2aWV3RGVzY3JpcHRvcnMpIHtcblx0XHRcdGNvbnN0IHZpZXdTdGF0ZSA9IHRoaXMuZ2V0KHZpZXdEZXNjcmlwdG9yLmlkKTtcblx0XHRcdGlmICh2aWV3U3RhdGUpIHtcblx0XHRcdFx0c3RvcmVkVmlld3NTdGF0ZXNbdmlld0Rlc2NyaXB0b3IuaWRdID0ge1xuXHRcdFx0XHRcdGNvbGxhcHNlZDogISF2aWV3U3RhdGUuY29sbGFwc2VkLFxuXHRcdFx0XHRcdGlzSGlkZGVuOiAhdmlld1N0YXRlLnZpc2libGVXb3Jrc3BhY2UsXG5cdFx0XHRcdFx0c2l6ZTogdmlld1N0YXRlLnNpemUsXG5cdFx0XHRcdFx0b3JkZXI6IHZpZXdEZXNjcmlwdG9yLndvcmtzcGFjZSAmJiB2aWV3U3RhdGUgPyB2aWV3U3RhdGUub3JkZXIgOiB1bmRlZmluZWRcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoT2JqZWN0LmtleXMoc3RvcmVkVmlld3NTdGF0ZXMpLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUodGhpcy53b3Jrc3BhY2VWaWV3c1N0YXRlU3RvcmFnZUlkLCBKU09OLnN0cmluZ2lmeShzdG9yZWRWaWV3c1N0YXRlcyksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKHRoaXMud29ya3NwYWNlVmlld3NTdGF0ZVN0b3JhZ2VJZCwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVHbG9iYWxTdGF0ZSh2aWV3RGVzY3JpcHRvcnM6IFJlYWRvbmx5QXJyYXk8SVZpZXdEZXNjcmlwdG9yPik6IHZvaWQge1xuXHRcdGNvbnN0IHN0b3JlZEdsb2JhbFN0YXRlID0gdGhpcy5nZXRTdG9yZWRHbG9iYWxTdGF0ZSgpO1xuXHRcdGZvciAoY29uc3Qgdmlld0Rlc2NyaXB0b3Igb2Ygdmlld0Rlc2NyaXB0b3JzKSB7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuZ2V0KHZpZXdEZXNjcmlwdG9yLmlkKTtcblx0XHRcdHN0b3JlZEdsb2JhbFN0YXRlLnNldCh2aWV3RGVzY3JpcHRvci5pZCwge1xuXHRcdFx0XHRpZDogdmlld0Rlc2NyaXB0b3IuaWQsXG5cdFx0XHRcdGlzSGlkZGVuOiBzdGF0ZSAmJiB2aWV3RGVzY3JpcHRvci5jYW5Ub2dnbGVWaXNpYmlsaXR5ID8gIXN0YXRlLnZpc2libGVHbG9iYWwgOiBmYWxzZSxcblx0XHRcdFx0b3JkZXI6ICF2aWV3RGVzY3JpcHRvci53b3Jrc3BhY2UgJiYgc3RhdGUgPyBzdGF0ZS5vcmRlciA6IHVuZGVmaW5lZFxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHRoaXMuc2V0U3RvcmVkR2xvYmFsU3RhdGUoc3RvcmVkR2xvYmFsU3RhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFN0b3JhZ2VDaGFuZ2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZ2xvYmFsVmlld3NTdGF0ZXNWYWx1ZSAhPT0gdGhpcy5nZXRTdG9yZWRHbG9iYWxWaWV3c1N0YXRlc1ZhbHVlKCkgLyogVGhpcyBjaGVja3MgaWYgY3VycmVudCB3aW5kb3cgY2hhbmdlZCB0aGUgdmFsdWUgb3Igbm90ICovKSB7XG5cdFx0XHR0aGlzLl9nbG9iYWxWaWV3c1N0YXRlc1ZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qgc3RvcmVkVmlld3NWaXNpYmlsaXR5U3RhdGVzID0gdGhpcy5nZXRTdG9yZWRHbG9iYWxTdGF0ZSgpO1xuXHRcdFx0Y29uc3Qgc3RvcmVkV29ya3NwYWNlVmlld3NTdGF0ZXMgPSB0aGlzLmdldFN0b3JlZFdvcmtzcGFjZVN0YXRlKCk7XG5cdFx0XHRjb25zdCBjaGFuZ2VkU3RhdGVzOiB7IGlkOiBzdHJpbmc7IHZpc2libGU6IGJvb2xlYW4gfVtdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IFtpZCwgc3RvcmVkU3RhdGVdIG9mIHN0b3JlZFZpZXdzVmlzaWJpbGl0eVN0YXRlcykge1xuXHRcdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuZ2V0KGlkKTtcblx0XHRcdFx0aWYgKHN0YXRlKSB7XG5cdFx0XHRcdFx0aWYgKHN0YXRlLnZpc2libGVHbG9iYWwgIT09ICFzdG9yZWRTdGF0ZS5pc0hpZGRlbikge1xuXHRcdFx0XHRcdFx0aWYgKCFzdG9yZWRTdGF0ZS5pc0hpZGRlbikge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmxvZ2dlci52YWx1ZS5pbmZvKGBWaWV3IHZpc2liaWxpdHkgc3RhdGUgY2hhbmdlZDogJHtpZH0gaXMgbm93IHZpc2libGVgLCB0aGlzLnZpZXdDb250YWluZXJOYW1lKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNoYW5nZWRTdGF0ZXMucHVzaCh7IGlkLCB2aXNpYmxlOiAhc3RvcmVkU3RhdGUuaXNIaWRkZW4gfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHdvcmtzcGFjZVZpZXdTdGF0ZTogSVN0b3JlZFdvcmtzcGFjZVZpZXdTdGF0ZSB8IHVuZGVmaW5lZCA9IHN0b3JlZFdvcmtzcGFjZVZpZXdzU3RhdGVzW2lkXTtcblx0XHRcdFx0XHR0aGlzLnNldChpZCwge1xuXHRcdFx0XHRcdFx0YWN0aXZlOiBmYWxzZSxcblx0XHRcdFx0XHRcdHZpc2libGVHbG9iYWw6ICFzdG9yZWRTdGF0ZS5pc0hpZGRlbixcblx0XHRcdFx0XHRcdHZpc2libGVXb3Jrc3BhY2U6IGlzVW5kZWZpbmVkKHdvcmtzcGFjZVZpZXdTdGF0ZT8uaXNIaWRkZW4pID8gdW5kZWZpbmVkIDogIXdvcmtzcGFjZVZpZXdTdGF0ZT8uaXNIaWRkZW4sXG5cdFx0XHRcdFx0XHRjb2xsYXBzZWQ6IHdvcmtzcGFjZVZpZXdTdGF0ZT8uY29sbGFwc2VkLFxuXHRcdFx0XHRcdFx0b3JkZXI6IHdvcmtzcGFjZVZpZXdTdGF0ZT8ub3JkZXIsXG5cdFx0XHRcdFx0XHRzaXplOiB3b3Jrc3BhY2VWaWV3U3RhdGU/LnNpemUsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChjaGFuZ2VkU3RhdGVzLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0b3JlZFN0YXRlLmZpcmUoY2hhbmdlZFN0YXRlcyk7XG5cdFx0XHRcdC8vIFVwZGF0ZSB0aGUgaW4gbWVtb3J5IHN0YXRlIGFmdGVyIGZpcmluZyB0aGUgZXZlbnRcblx0XHRcdFx0Ly8gc28gdGhhdCB0aGUgdmlld3MgY2FuIHVwZGF0ZSB0aGVpciBzdGF0ZSBhY2NvcmRpbmdseVxuXHRcdFx0XHRmb3IgKGNvbnN0IGNoYW5nZWRTdGF0ZSBvZiBjaGFuZ2VkU3RhdGVzKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLmdldChjaGFuZ2VkU3RhdGUuaWQpO1xuXHRcdFx0XHRcdGlmIChzdGF0ZSkge1xuXHRcdFx0XHRcdFx0c3RhdGUudmlzaWJsZUdsb2JhbCA9IGNoYW5nZWRTdGF0ZS52aXNpYmxlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaW5pdGlhbGl6ZSgpOiBNYXA8c3RyaW5nLCBJVmlld0Rlc2NyaXB0b3JTdGF0ZT4ge1xuXHRcdGNvbnN0IHZpZXdTdGF0ZXMgPSBuZXcgTWFwPHN0cmluZywgSVZpZXdEZXNjcmlwdG9yU3RhdGU+KCk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlVmlld3NTdGF0ZXMgPSB0aGlzLmdldFN0b3JlZFdvcmtzcGFjZVN0YXRlKCk7XG5cdFx0Zm9yIChjb25zdCBpZCBvZiBPYmplY3Qua2V5cyh3b3Jrc3BhY2VWaWV3c1N0YXRlcykpIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZVZpZXdTdGF0ZSA9IHdvcmtzcGFjZVZpZXdzU3RhdGVzW2lkXTtcblx0XHRcdHZpZXdTdGF0ZXMuc2V0KGlkLCB7XG5cdFx0XHRcdGFjdGl2ZTogZmFsc2UsXG5cdFx0XHRcdHZpc2libGVHbG9iYWw6IHVuZGVmaW5lZCxcblx0XHRcdFx0dmlzaWJsZVdvcmtzcGFjZTogaXNVbmRlZmluZWQod29ya3NwYWNlVmlld1N0YXRlLmlzSGlkZGVuKSA/IHVuZGVmaW5lZCA6ICF3b3Jrc3BhY2VWaWV3U3RhdGUuaXNIaWRkZW4sXG5cdFx0XHRcdGNvbGxhcHNlZDogd29ya3NwYWNlVmlld1N0YXRlLmNvbGxhcHNlZCxcblx0XHRcdFx0b3JkZXI6IHdvcmtzcGFjZVZpZXdTdGF0ZS5vcmRlcixcblx0XHRcdFx0c2l6ZTogd29ya3NwYWNlVmlld1N0YXRlLnNpemUsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBNaWdyYXRlIHRvIGB2aWV3bGV0U3RhdGVTdG9yYWdlSWRgXG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldCh0aGlzLmdsb2JhbFZpZXdzU3RhdGVTdG9yYWdlSWQsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsICdbXScpO1xuXHRcdGNvbnN0IHsgc3RhdGU6IHdvcmtzcGFjZVZpc2liaWxpdHlTdGF0ZXMgfSA9IHRoaXMucGFyc2VTdG9yZWRHbG9iYWxTdGF0ZSh2YWx1ZSk7XG5cdFx0aWYgKHdvcmtzcGFjZVZpc2liaWxpdHlTdGF0ZXMuc2l6ZSA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgeyBpZCwgaXNIaWRkZW4gfSBvZiB3b3Jrc3BhY2VWaXNpYmlsaXR5U3RhdGVzLnZhbHVlcygpKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdTdGF0ZSA9IHZpZXdTdGF0ZXMuZ2V0KGlkKTtcblx0XHRcdFx0Ly8gTm90IG1pZ3JhdGVkIHRvIGB2aWV3bGV0U3RhdGVTdG9yYWdlSWRgXG5cdFx0XHRcdGlmICh2aWV3U3RhdGUpIHtcblx0XHRcdFx0XHRpZiAoaXNVbmRlZmluZWQodmlld1N0YXRlLnZpc2libGVXb3Jrc3BhY2UpKSB7XG5cdFx0XHRcdFx0XHR2aWV3U3RhdGUudmlzaWJsZVdvcmtzcGFjZSA9ICFpc0hpZGRlbjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmlld1N0YXRlcy5zZXQoaWQsIHtcblx0XHRcdFx0XHRcdGFjdGl2ZTogZmFsc2UsXG5cdFx0XHRcdFx0XHRjb2xsYXBzZWQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdHZpc2libGVHbG9iYWw6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdHZpc2libGVXb3Jrc3BhY2U6ICFpc0hpZGRlbixcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUodGhpcy5nbG9iYWxWaWV3c1N0YXRlU3RvcmFnZUlkLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHR9XG5cblx0XHRjb25zdCB7IHN0YXRlLCBoYXNEdXBsaWNhdGVzIH0gPSB0aGlzLnBhcnNlU3RvcmVkR2xvYmFsU3RhdGUodGhpcy5nbG9iYWxWaWV3c1N0YXRlc1ZhbHVlKTtcblx0XHRpZiAoaGFzRHVwbGljYXRlcykge1xuXHRcdFx0dGhpcy5zZXRTdG9yZWRHbG9iYWxTdGF0ZShzdGF0ZSk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgeyBpZCwgaXNIaWRkZW4sIG9yZGVyIH0gb2Ygc3RhdGUudmFsdWVzKCkpIHtcblx0XHRcdGNvbnN0IHZpZXdTdGF0ZSA9IHZpZXdTdGF0ZXMuZ2V0KGlkKTtcblx0XHRcdGlmICh2aWV3U3RhdGUpIHtcblx0XHRcdFx0dmlld1N0YXRlLnZpc2libGVHbG9iYWwgPSAhaXNIaWRkZW47XG5cdFx0XHRcdGlmICghaXNVbmRlZmluZWQob3JkZXIpKSB7XG5cdFx0XHRcdFx0dmlld1N0YXRlLm9yZGVyID0gb3JkZXI7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZpZXdTdGF0ZXMuc2V0KGlkLCB7XG5cdFx0XHRcdFx0YWN0aXZlOiBmYWxzZSxcblx0XHRcdFx0XHR2aXNpYmxlR2xvYmFsOiAhaXNIaWRkZW4sXG5cdFx0XHRcdFx0b3JkZXIsXG5cdFx0XHRcdFx0Y29sbGFwc2VkOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0dmlzaWJsZVdvcmtzcGFjZTogdW5kZWZpbmVkLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHZpZXdTdGF0ZXM7XG5cdH1cblxuXHRwcml2YXRlIGdldFN0b3JlZFdvcmtzcGFjZVN0YXRlKCk6IElTdHJpbmdEaWN0aW9uYXJ5PElTdG9yZWRXb3Jrc3BhY2VWaWV3U3RhdGU+IHtcblx0XHRyZXR1cm4gSlNPTi5wYXJzZSh0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldCh0aGlzLndvcmtzcGFjZVZpZXdzU3RhdGVTdG9yYWdlSWQsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsICd7fScpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U3RvcmVkR2xvYmFsU3RhdGUoKTogTWFwPHN0cmluZywgSVN0b3JlZEdsb2JhbFZpZXdTdGF0ZT4ge1xuXHRcdHJldHVybiB0aGlzLnBhcnNlU3RvcmVkR2xvYmFsU3RhdGUodGhpcy5nbG9iYWxWaWV3c1N0YXRlc1ZhbHVlKS5zdGF0ZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0U3RvcmVkR2xvYmFsU3RhdGUoc3RvcmVkR2xvYmFsU3RhdGU6IE1hcDxzdHJpbmcsIElTdG9yZWRHbG9iYWxWaWV3U3RhdGU+KTogdm9pZCB7XG5cdFx0dGhpcy5nbG9iYWxWaWV3c1N0YXRlc1ZhbHVlID0gSlNPTi5zdHJpbmdpZnkoWy4uLnN0b3JlZEdsb2JhbFN0YXRlLnZhbHVlcygpXSk7XG5cdH1cblxuXHRwcml2YXRlIHBhcnNlU3RvcmVkR2xvYmFsU3RhdGUodmFsdWU6IHN0cmluZyk6IHsgc3RhdGU6IE1hcDxzdHJpbmcsIElTdG9yZWRHbG9iYWxWaWV3U3RhdGU+OyBoYXNEdXBsaWNhdGVzOiBib29sZWFuIH0ge1xuXHRcdGNvbnN0IHN0b3JlZFZhbHVlOiBBcnJheTxzdHJpbmcgfCBJU3RvcmVkR2xvYmFsVmlld1N0YXRlPiA9IEpTT04ucGFyc2UodmFsdWUpO1xuXHRcdGxldCBoYXNEdXBsaWNhdGVzID0gZmFsc2U7XG5cdFx0Y29uc3Qgc3RhdGUgPSBzdG9yZWRWYWx1ZS5yZWR1Y2UoKHJlc3VsdCwgc3RvcmVkU3RhdGUpID0+IHtcblx0XHRcdGlmICh0eXBlb2Ygc3RvcmVkU3RhdGUgPT09ICdzdHJpbmcnIC8qIG1pZ3JhdGlvbiAqLykge1xuXHRcdFx0XHRoYXNEdXBsaWNhdGVzID0gaGFzRHVwbGljYXRlcyB8fCByZXN1bHQuaGFzKHN0b3JlZFN0YXRlKTtcblx0XHRcdFx0cmVzdWx0LnNldChzdG9yZWRTdGF0ZSwgeyBpZDogc3RvcmVkU3RhdGUsIGlzSGlkZGVuOiB0cnVlIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aGFzRHVwbGljYXRlcyA9IGhhc0R1cGxpY2F0ZXMgfHwgcmVzdWx0LmhhcyhzdG9yZWRTdGF0ZS5pZCk7XG5cdFx0XHRcdHJlc3VsdC5zZXQoc3RvcmVkU3RhdGUuaWQsIHN0b3JlZFN0YXRlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSwgbmV3IE1hcDxzdHJpbmcsIElTdG9yZWRHbG9iYWxWaWV3U3RhdGU+KCkpO1xuXHRcdHJldHVybiB7IHN0YXRlLCBoYXNEdXBsaWNhdGVzIH07XG5cdH1cblxuXHRwcml2YXRlIF9nbG9iYWxWaWV3c1N0YXRlc1ZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZ2V0IGdsb2JhbFZpZXdzU3RhdGVzVmFsdWUoKTogc3RyaW5nIHtcblx0XHRpZiAoIXRoaXMuX2dsb2JhbFZpZXdzU3RhdGVzVmFsdWUpIHtcblx0XHRcdHRoaXMuX2dsb2JhbFZpZXdzU3RhdGVzVmFsdWUgPSB0aGlzLmdldFN0b3JlZEdsb2JhbFZpZXdzU3RhdGVzVmFsdWUoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZ2xvYmFsVmlld3NTdGF0ZXNWYWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0IGdsb2JhbFZpZXdzU3RhdGVzVmFsdWUoZ2xvYmFsVmlld3NTdGF0ZXNWYWx1ZTogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMuZ2xvYmFsVmlld3NTdGF0ZXNWYWx1ZSAhPT0gZ2xvYmFsVmlld3NTdGF0ZXNWYWx1ZSkge1xuXHRcdFx0dGhpcy5fZ2xvYmFsVmlld3NTdGF0ZXNWYWx1ZSA9IGdsb2JhbFZpZXdzU3RhdGVzVmFsdWU7XG5cdFx0XHR0aGlzLnNldFN0b3JlZEdsb2JhbFZpZXdzU3RhdGVzVmFsdWUoZ2xvYmFsVmlld3NTdGF0ZXNWYWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRTdG9yZWRHbG9iYWxWaWV3c1N0YXRlc1ZhbHVlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KHRoaXMuZ2xvYmFsVmlld3NTdGF0ZVN0b3JhZ2VJZCwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsICdbXScpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRTdG9yZWRHbG9iYWxWaWV3c1N0YXRlc1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKHRoaXMuZ2xvYmFsVmlld3NTdGF0ZVN0b3JhZ2VJZCwgdmFsdWUsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHR9XG5cbn1cblxuaW50ZXJmYWNlIElWaWV3RGVzY3JpcHRvckl0ZW0ge1xuXHR2aWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yO1xuXHRzdGF0ZTogSVZpZXdEZXNjcmlwdG9yU3RhdGU7XG59XG5cbmV4cG9ydCBjbGFzcyBWaWV3Q29udGFpbmVyTW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVZpZXdDb250YWluZXJNb2RlbCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5cyA9IG5ldyBDb3VudGVyU2V0PHN0cmluZz4oKTtcblx0cHJpdmF0ZSB2aWV3RGVzY3JpcHRvckl0ZW1zOiBJVmlld0Rlc2NyaXB0b3JJdGVtW10gPSBbXTtcblx0cHJpdmF0ZSB2aWV3RGVzY3JpcHRvcnNTdGF0ZTogVmlld0Rlc2NyaXB0b3JzU3RhdGU7XG5cblx0Ly8gQ29udGFpbmVyIEluZm9cblx0cHJpdmF0ZSBfdGl0bGUhOiBzdHJpbmc7XG5cdGdldCB0aXRsZSgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5fdGl0bGU7IH1cblxuXHRwcml2YXRlIF9pY29uOiBVUkkgfCBUaGVtZUljb24gfCB1bmRlZmluZWQ7XG5cdGdldCBpY29uKCk6IFVSSSB8IFRoZW1lSWNvbiB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9pY29uOyB9XG5cblx0cHJpdmF0ZSBfa2V5YmluZGluZ0lkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGdldCBrZXliaW5kaW5nSWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2tleWJpbmRpbmdJZDsgfVxuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlQ29udGFpbmVySW5mbyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgdGl0bGU/OiBib29sZWFuOyBpY29uPzogYm9vbGVhbjsga2V5YmluZGluZ0lkPzogYm9vbGVhbiB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250YWluZXJJbmZvID0gdGhpcy5fb25EaWRDaGFuZ2VDb250YWluZXJJbmZvLmV2ZW50O1xuXG5cdC8vIEFsbCBWaWV3IERlc2NyaXB0b3JzXG5cdGdldCBhbGxWaWV3RGVzY3JpcHRvcnMoKTogUmVhZG9ubHlBcnJheTxJVmlld0Rlc2NyaXB0b3I+IHsgcmV0dXJuIHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtcy5tYXAoaXRlbSA9PiBpdGVtLnZpZXdEZXNjcmlwdG9yKTsgfVxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUFsbFZpZXdEZXNjcmlwdG9ycyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgYWRkZWQ6IFJlYWRvbmx5QXJyYXk8SVZpZXdEZXNjcmlwdG9yPjsgcmVtb3ZlZDogUmVhZG9ubHlBcnJheTxJVmlld0Rlc2NyaXB0b3I+IH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFsbFZpZXdEZXNjcmlwdG9ycyA9IHRoaXMuX29uRGlkQ2hhbmdlQWxsVmlld0Rlc2NyaXB0b3JzLmV2ZW50O1xuXG5cdC8vIEFjdGl2ZSBWaWV3IERlc2NyaXB0b3JzXG5cdGdldCBhY3RpdmVWaWV3RGVzY3JpcHRvcnMoKTogUmVhZG9ubHlBcnJheTxJVmlld0Rlc2NyaXB0b3I+IHsgcmV0dXJuIHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtcy5maWx0ZXIoaXRlbSA9PiBpdGVtLnN0YXRlLmFjdGl2ZSkubWFwKGl0ZW0gPT4gaXRlbS52aWV3RGVzY3JpcHRvcik7IH1cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VBY3RpdmVWaWV3RGVzY3JpcHRvcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGFkZGVkOiBSZWFkb25seUFycmF5PElWaWV3RGVzY3JpcHRvcj47IHJlbW92ZWQ6IFJlYWRvbmx5QXJyYXk8SVZpZXdEZXNjcmlwdG9yPiB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVWaWV3RGVzY3JpcHRvcnMgPSB0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5ldmVudDtcblxuXHQvLyBWaXNpYmxlIFZpZXcgRGVzY3JpcHRvcnNcblx0Z2V0IHZpc2libGVWaWV3RGVzY3JpcHRvcnMoKTogUmVhZG9ubHlBcnJheTxJVmlld0Rlc2NyaXB0b3I+IHsgcmV0dXJuIHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtcy5maWx0ZXIoaXRlbSA9PiB0aGlzLmlzVmlld0Rlc2NyaXB0b3JWaXNpYmxlKGl0ZW0pKS5tYXAoaXRlbSA9PiBpdGVtLnZpZXdEZXNjcmlwdG9yKTsgfVxuXG5cdHByaXZhdGUgX29uRGlkQWRkVmlzaWJsZVZpZXdEZXNjcmlwdG9ycyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElBZGRlZFZpZXdEZXNjcmlwdG9yUmVmW10+KCkpO1xuXHRyZWFkb25seSBvbkRpZEFkZFZpc2libGVWaWV3RGVzY3JpcHRvcnM6IEV2ZW50PElBZGRlZFZpZXdEZXNjcmlwdG9yUmVmW10+ID0gdGhpcy5fb25EaWRBZGRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkUmVtb3ZlVmlzaWJsZVZpZXdEZXNjcmlwdG9ycyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElWaWV3RGVzY3JpcHRvclJlZltdPigpKTtcblx0cmVhZG9ubHkgb25EaWRSZW1vdmVWaXNpYmxlVmlld0Rlc2NyaXB0b3JzOiBFdmVudDxJVmlld0Rlc2NyaXB0b3JSZWZbXT4gPSB0aGlzLl9vbkRpZFJlbW92ZVZpc2libGVWaWV3RGVzY3JpcHRvcnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRNb3ZlVmlzaWJsZVZpZXdEZXNjcmlwdG9ycyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgZnJvbTogSVZpZXdEZXNjcmlwdG9yUmVmOyB0bzogSVZpZXdEZXNjcmlwdG9yUmVmIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZE1vdmVWaXNpYmxlVmlld0Rlc2NyaXB0b3JzOiBFdmVudDx7IGZyb206IElWaWV3RGVzY3JpcHRvclJlZjsgdG86IElWaWV3RGVzY3JpcHRvclJlZiB9PiA9IHRoaXMuX29uRGlkTW92ZVZpc2libGVWaWV3RGVzY3JpcHRvcnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBsb2dnZXI6IExhenk8SUxvZ2dlcj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgdmlld0NvbnRhaW5lcjogVmlld0NvbnRhaW5lcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMb2dnZXJTZXJ2aWNlIGxvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5sb2dnZXIgPSBuZXcgTGF6eSgoKSA9PiBsb2dnZXJTZXJ2aWNlLmNyZWF0ZUxvZ2dlcihWSUVXU19MT0dfSUQsIHsgbmFtZTogVklFV1NfTE9HX05BTUUsIGdyb3VwOiB3aW5kb3dMb2dHcm91cCB9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIoY29udGV4dEtleVNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0LCBlID0+IGUuYWZmZWN0c1NvbWUodGhpcy5jb250ZXh0S2V5cykpKCgpID0+IHRoaXMub25EaWRDaGFuZ2VDb250ZXh0KCkpKTtcblx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yc1N0YXRlID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVmlld0Rlc2NyaXB0b3JzU3RhdGUsIHZpZXdDb250YWluZXIuc3RvcmFnZUlkIHx8IGAke3ZpZXdDb250YWluZXIuaWR9LnN0YXRlYCwgdHlwZW9mIHZpZXdDb250YWluZXIudGl0bGUgPT09ICdzdHJpbmcnID8gdmlld0NvbnRhaW5lci50aXRsZSA6IHZpZXdDb250YWluZXIudGl0bGUub3JpZ2luYWwpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdEZXNjcmlwdG9yc1N0YXRlLm9uRGlkQ2hhbmdlU3RvcmVkU3RhdGUoaXRlbXMgPT4gdGhpcy51cGRhdGVWaXNpYmlsaXR5KGl0ZW1zKSkpO1xuXG5cdFx0dGhpcy51cGRhdGVDb250YWluZXJJbmZvKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbnRhaW5lckluZm8oKTogdm9pZCB7XG5cdFx0LyogVXNlIGRlZmF1bHQgY29udGFpbmVyIGluZm8gaWYgb25lIG9mIHRoZSB2aXNpYmxlIHZpZXcgZGVzY3JpcHRvcnMgYmVsb25ncyB0byB0aGUgY3VycmVudCBjb250YWluZXIgYnkgZGVmYXVsdCAqL1xuXHRcdGNvbnN0IHVzZURlZmF1bHRDb250YWluZXJJbmZvID0gdGhpcy52aWV3Q29udGFpbmVyLmFsd2F5c1VzZUNvbnRhaW5lckluZm8gfHwgdGhpcy52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCA9PT0gMCB8fCB0aGlzLnZpc2libGVWaWV3RGVzY3JpcHRvcnMuc29tZSh2ID0+IFJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihWaWV3RXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KS5nZXRWaWV3Q29udGFpbmVyKHYuaWQpID09PSB0aGlzLnZpZXdDb250YWluZXIpO1xuXHRcdGNvbnN0IHRpdGxlID0gdXNlRGVmYXVsdENvbnRhaW5lckluZm8gPyAodHlwZW9mIHRoaXMudmlld0NvbnRhaW5lci50aXRsZSA9PT0gJ3N0cmluZycgPyB0aGlzLnZpZXdDb250YWluZXIudGl0bGUgOiB0aGlzLnZpZXdDb250YWluZXIudGl0bGUudmFsdWUpIDogdGhpcy52aXNpYmxlVmlld0Rlc2NyaXB0b3JzWzBdPy5jb250YWluZXJUaXRsZSB8fCB0aGlzLnZpc2libGVWaWV3RGVzY3JpcHRvcnNbMF0/Lm5hbWU/LnZhbHVlIHx8ICcnO1xuXHRcdGxldCB0aXRsZUNoYW5nZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRpZiAodGhpcy5fdGl0bGUgIT09IHRpdGxlKSB7XG5cdFx0XHR0aGlzLl90aXRsZSA9IHRpdGxlO1xuXHRcdFx0dGl0bGVDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBpY29uID0gdXNlRGVmYXVsdENvbnRhaW5lckluZm8gPyB0aGlzLnZpZXdDb250YWluZXIuaWNvbiA6IHRoaXMudmlzaWJsZVZpZXdEZXNjcmlwdG9yc1swXT8uY29udGFpbmVySWNvbiB8fCBkZWZhdWx0Vmlld0ljb247XG5cdFx0bGV0IGljb25DaGFuZ2VkOiBib29sZWFuID0gZmFsc2U7XG5cdFx0aWYgKCF0aGlzLmlzRXF1YWxJY29uKGljb24pKSB7XG5cdFx0XHR0aGlzLl9pY29uID0gaWNvbjtcblx0XHRcdGljb25DaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBrZXliaW5kaW5nSWQgPSB0aGlzLnZpZXdDb250YWluZXIub3BlbkNvbW1hbmRBY3Rpb25EZXNjcmlwdG9yPy5pZCA/PyB0aGlzLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5maW5kKHYgPT4gdi5vcGVuQ29tbWFuZEFjdGlvbkRlc2NyaXB0b3IpPy5vcGVuQ29tbWFuZEFjdGlvbkRlc2NyaXB0b3I/LmlkO1xuXHRcdGxldCBrZXliaW5kaW5nSWRDaGFuZ2VkOiBib29sZWFuID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMuX2tleWJpbmRpbmdJZCAhPT0ga2V5YmluZGluZ0lkKSB7XG5cdFx0XHR0aGlzLl9rZXliaW5kaW5nSWQgPSBrZXliaW5kaW5nSWQ7XG5cdFx0XHRrZXliaW5kaW5nSWRDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodGl0bGVDaGFuZ2VkIHx8IGljb25DaGFuZ2VkIHx8IGtleWJpbmRpbmdJZENoYW5nZWQpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGFpbmVySW5mby5maXJlKHsgdGl0bGU6IHRpdGxlQ2hhbmdlZCwgaWNvbjogaWNvbkNoYW5nZWQsIGtleWJpbmRpbmdJZDoga2V5YmluZGluZ0lkQ2hhbmdlZCB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGlzRXF1YWxJY29uKGljb246IFVSSSB8IFRoZW1lSWNvbiB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdGlmIChVUkkuaXNVcmkoaWNvbikpIHtcblx0XHRcdHJldHVybiBVUkkuaXNVcmkodGhpcy5faWNvbikgJiYgaXNFcXVhbChpY29uLCB0aGlzLl9pY29uKTtcblx0XHR9IGVsc2UgaWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihpY29uKSkge1xuXHRcdFx0cmV0dXJuIFRoZW1lSWNvbi5pc1RoZW1lSWNvbih0aGlzLl9pY29uKSAmJiBUaGVtZUljb24uaXNFcXVhbChpY29uLCB0aGlzLl9pY29uKTtcblx0XHR9XG5cdFx0cmV0dXJuIGljb24gPT09IHRoaXMuX2ljb247XG5cdH1cblxuXHRpc1Zpc2libGUoaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9ySXRlbSA9IHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtcy5maW5kKHYgPT4gdi52aWV3RGVzY3JpcHRvci5pZCA9PT0gaWQpO1xuXHRcdGlmICghdmlld0Rlc2NyaXB0b3JJdGVtKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gdmlldyAke2lkfWApO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5pc1ZpZXdEZXNjcmlwdG9yVmlzaWJsZSh2aWV3RGVzY3JpcHRvckl0ZW0pO1xuXHR9XG5cblx0c2V0VmlzaWJsZShpZDogc3RyaW5nLCB2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVWaXNpYmlsaXR5KFt7IGlkLCB2aXNpYmxlIH1dKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVmlzaWJpbGl0eSh2aWV3RGVzY3JpcHRvcnM6IHsgaWQ6IHN0cmluZzsgdmlzaWJsZTogYm9vbGVhbiB9W10pOiB2b2lkIHtcblx0XHQvLyBGaXJzdDogVXBkYXRlIGFuZCByZW1vdmUgdGhlIHZpZXcgZGVzY3JpcHRvcnMgd2hpY2ggYXJlIGFza2VkIHRvIGJlIGhpZGRlblxuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9ySXRlbXNUb0hpZGUgPSBjb2FsZXNjZSh2aWV3RGVzY3JpcHRvcnMuZmlsdGVyKCh7IHZpc2libGUgfSkgPT4gIXZpc2libGUpXG5cdFx0XHQubWFwKCh7IGlkIH0pID0+IHRoaXMuZmluZEFuZElnbm9yZUlmTm90Rm91bmQoaWQpKSk7XG5cdFx0Y29uc3QgcmVtb3ZlZDogSVZpZXdEZXNjcmlwdG9yUmVmW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHsgdmlld0Rlc2NyaXB0b3JJdGVtLCB2aXNpYmxlSW5kZXggfSBvZiB2aWV3RGVzY3JpcHRvckl0ZW1zVG9IaWRlKSB7XG5cdFx0XHRpZiAodGhpcy51cGRhdGVWaWV3RGVzY3JpcHRvckl0ZW1WaXNpYmlsaXR5KHZpZXdEZXNjcmlwdG9ySXRlbSwgZmFsc2UpKSB7XG5cdFx0XHRcdHJlbW92ZWQucHVzaCh7IHZpZXdEZXNjcmlwdG9yOiB2aWV3RGVzY3JpcHRvckl0ZW0udmlld0Rlc2NyaXB0b3IsIGluZGV4OiB2aXNpYmxlSW5kZXggfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChyZW1vdmVkLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5icm9hZENhc3RSZW1vdmVkVmlzaWJsZVZpZXdEZXNjcmlwdG9ycyhyZW1vdmVkKTtcblx0XHR9XG5cblx0XHQvLyBTZWNvbmQ6IFVwZGF0ZSBhbmQgYWRkIHRoZSB2aWV3IGRlc2NyaXB0b3JzIHdoaWNoIGFyZSBhc2tlZCB0byBiZSBzaG93blxuXHRcdGNvbnN0IGFkZGVkOiBJQWRkZWRWaWV3RGVzY3JpcHRvclJlZltdID0gW107XG5cdFx0Zm9yIChjb25zdCB7IGlkLCB2aXNpYmxlIH0gb2Ygdmlld0Rlc2NyaXB0b3JzKSB7XG5cdFx0XHRpZiAoIXZpc2libGUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmb3VuZFZpZXdEZXNjcmlwdG9yID0gdGhpcy5maW5kQW5kSWdub3JlSWZOb3RGb3VuZChpZCk7XG5cdFx0XHRpZiAoIWZvdW5kVmlld0Rlc2NyaXB0b3IpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB7IHZpZXdEZXNjcmlwdG9ySXRlbSwgdmlzaWJsZUluZGV4IH0gPSBmb3VuZFZpZXdEZXNjcmlwdG9yO1xuXHRcdFx0aWYgKHRoaXMudXBkYXRlVmlld0Rlc2NyaXB0b3JJdGVtVmlzaWJpbGl0eSh2aWV3RGVzY3JpcHRvckl0ZW0sIHRydWUpKSB7XG5cdFx0XHRcdGFkZGVkLnB1c2goeyBpbmRleDogdmlzaWJsZUluZGV4LCB2aWV3RGVzY3JpcHRvcjogdmlld0Rlc2NyaXB0b3JJdGVtLnZpZXdEZXNjcmlwdG9yLCBzaXplOiB2aWV3RGVzY3JpcHRvckl0ZW0uc3RhdGUuc2l6ZSwgY29sbGFwc2VkOiAhIXZpZXdEZXNjcmlwdG9ySXRlbS5zdGF0ZS5jb2xsYXBzZWQgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChhZGRlZC5sZW5ndGgpIHtcblx0XHRcdHRoaXMuYnJvYWRDYXN0QWRkZWRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKGFkZGVkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVZpZXdEZXNjcmlwdG9ySXRlbVZpc2liaWxpdHkodmlld0Rlc2NyaXB0b3JJdGVtOiBJVmlld0Rlc2NyaXB0b3JJdGVtLCB2aXNpYmxlOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF2aWV3RGVzY3JpcHRvckl0ZW0udmlld0Rlc2NyaXB0b3IuY2FuVG9nZ2xlVmlzaWJpbGl0eSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5pc1ZpZXdEZXNjcmlwdG9yVmlzaWJsZVdoZW5BY3RpdmUodmlld0Rlc2NyaXB0b3JJdGVtKSA9PT0gdmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIHVwZGF0ZSB2aXNpYmlsaXR5XG5cdFx0aWYgKHZpZXdEZXNjcmlwdG9ySXRlbS52aWV3RGVzY3JpcHRvci53b3Jrc3BhY2UpIHtcblx0XHRcdHZpZXdEZXNjcmlwdG9ySXRlbS5zdGF0ZS52aXNpYmxlV29ya3NwYWNlID0gdmlzaWJsZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmlld0Rlc2NyaXB0b3JJdGVtLnN0YXRlLnZpc2libGVHbG9iYWwgPSB2aXNpYmxlO1xuXHRcdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdFx0dGhpcy5sb2dnZXIudmFsdWUuaW5mbyhgU2hvd2luZyB2aWV3ICR7dmlld0Rlc2NyaXB0b3JJdGVtLnZpZXdEZXNjcmlwdG9yLmlkfSBpbiB0aGUgY29udGFpbmVyICR7dGhpcy52aWV3Q29udGFpbmVyLmlkfWApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHJldHVybiBgdHJ1ZWAgb25seSBpZiB2aXNpYmlsaXR5IGlzIGNoYW5nZWRcblx0XHRyZXR1cm4gdGhpcy5pc1ZpZXdEZXNjcmlwdG9yVmlzaWJsZSh2aWV3RGVzY3JpcHRvckl0ZW0pID09PSB2aXNpYmxlO1xuXHR9XG5cblx0aXNDb2xsYXBzZWQoaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuZmluZChpZCkudmlld0Rlc2NyaXB0b3JJdGVtLnN0YXRlLmNvbGxhcHNlZDtcblx0fVxuXG5cdHNldENvbGxhcHNlZChpZDogc3RyaW5nLCBjb2xsYXBzZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCB7IHZpZXdEZXNjcmlwdG9ySXRlbSB9ID0gdGhpcy5maW5kKGlkKTtcblx0XHRpZiAodmlld0Rlc2NyaXB0b3JJdGVtLnN0YXRlLmNvbGxhcHNlZCAhPT0gY29sbGFwc2VkKSB7XG5cdFx0XHR2aWV3RGVzY3JpcHRvckl0ZW0uc3RhdGUuY29sbGFwc2VkID0gY29sbGFwc2VkO1xuXHRcdH1cblx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yc1N0YXRlLnVwZGF0ZVN0YXRlKHRoaXMuYWxsVmlld0Rlc2NyaXB0b3JzKTtcblx0fVxuXG5cdGdldFNpemUoaWQ6IHN0cmluZyk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZmluZChpZCkudmlld0Rlc2NyaXB0b3JJdGVtLnN0YXRlLnNpemU7XG5cdH1cblxuXHRzZXRTaXplcyhuZXdTaXplczogcmVhZG9ubHkgeyBpZDogc3RyaW5nOyBzaXplOiBudW1iZXIgfVtdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCB7IGlkLCBzaXplIH0gb2YgbmV3U2l6ZXMpIHtcblx0XHRcdGNvbnN0IHsgdmlld0Rlc2NyaXB0b3JJdGVtIH0gPSB0aGlzLmZpbmQoaWQpO1xuXHRcdFx0aWYgKHZpZXdEZXNjcmlwdG9ySXRlbS5zdGF0ZS5zaXplICE9PSBzaXplKSB7XG5cdFx0XHRcdHZpZXdEZXNjcmlwdG9ySXRlbS5zdGF0ZS5zaXplID0gc2l6ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy52aWV3RGVzY3JpcHRvcnNTdGF0ZS51cGRhdGVTdGF0ZSh0aGlzLmFsbFZpZXdEZXNjcmlwdG9ycyk7XG5cdH1cblxuXHRtb3ZlKGZyb206IHN0cmluZywgdG86IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGZyb21JbmRleCA9IHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtcy5maW5kSW5kZXgodiA9PiB2LnZpZXdEZXNjcmlwdG9yLmlkID09PSBmcm9tKTtcblx0XHRjb25zdCB0b0luZGV4ID0gdGhpcy52aWV3RGVzY3JpcHRvckl0ZW1zLmZpbmRJbmRleCh2ID0+IHYudmlld0Rlc2NyaXB0b3IuaWQgPT09IHRvKTtcblxuXHRcdGNvbnN0IGZyb21WaWV3RGVzY3JpcHRvciA9IHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtc1tmcm9tSW5kZXhdO1xuXHRcdGNvbnN0IHRvVmlld0Rlc2NyaXB0b3IgPSB0aGlzLnZpZXdEZXNjcmlwdG9ySXRlbXNbdG9JbmRleF07XG5cblx0XHRtb3ZlKHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtcywgZnJvbUluZGV4LCB0b0luZGV4KTtcblxuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLnZpZXdEZXNjcmlwdG9ySXRlbXMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHR0aGlzLnZpZXdEZXNjcmlwdG9ySXRlbXNbaW5kZXhdLnN0YXRlLm9yZGVyID0gaW5kZXg7XG5cdFx0fVxuXG5cdFx0dGhpcy5icm9hZENhc3RNb3ZlZFZpZXdEZXNjcmlwdG9ycyh7IGluZGV4OiBmcm9tSW5kZXgsIHZpZXdEZXNjcmlwdG9yOiBmcm9tVmlld0Rlc2NyaXB0b3Iudmlld0Rlc2NyaXB0b3IgfSwgeyBpbmRleDogdG9JbmRleCwgdmlld0Rlc2NyaXB0b3I6IHRvVmlld0Rlc2NyaXB0b3Iudmlld0Rlc2NyaXB0b3IgfSk7XG5cdH1cblxuXHRhZGQoYWRkZWRWaWV3RGVzY3JpcHRvclN0YXRlczogSUFkZGVkVmlld0Rlc2NyaXB0b3JTdGF0ZVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgYWRkZWRJdGVtczogSVZpZXdEZXNjcmlwdG9ySXRlbVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBhZGRlZFZpZXdEZXNjcmlwdG9yU3RhdGUgb2YgYWRkZWRWaWV3RGVzY3JpcHRvclN0YXRlcykge1xuXHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3IgPSBhZGRlZFZpZXdEZXNjcmlwdG9yU3RhdGUudmlld0Rlc2NyaXB0b3I7XG5cblx0XHRcdGlmICh2aWV3RGVzY3JpcHRvci53aGVuKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qga2V5IG9mIHZpZXdEZXNjcmlwdG9yLndoZW4ua2V5cygpKSB7XG5cdFx0XHRcdFx0dGhpcy5jb250ZXh0S2V5cy5hZGQoa2V5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRsZXQgc3RhdGUgPSB0aGlzLnZpZXdEZXNjcmlwdG9yc1N0YXRlLmdldCh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdFx0Ly8gc2V0IGRlZmF1bHRzIGlmIG5vdCBzZXRcblx0XHRcdFx0aWYgKHZpZXdEZXNjcmlwdG9yLndvcmtzcGFjZSkge1xuXHRcdFx0XHRcdHN0YXRlLnZpc2libGVXb3Jrc3BhY2UgPSBpc1VuZGVmaW5lZE9yTnVsbChhZGRlZFZpZXdEZXNjcmlwdG9yU3RhdGUudmlzaWJsZSkgPyAoaXNVbmRlZmluZWRPck51bGwoc3RhdGUudmlzaWJsZVdvcmtzcGFjZSkgPyAhdmlld0Rlc2NyaXB0b3IuaGlkZUJ5RGVmYXVsdCA6IHN0YXRlLnZpc2libGVXb3Jrc3BhY2UpIDogYWRkZWRWaWV3RGVzY3JpcHRvclN0YXRlLnZpc2libGU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgaXNWaXNpYmxlID0gc3RhdGUudmlzaWJsZUdsb2JhbDtcblx0XHRcdFx0XHRzdGF0ZS52aXNpYmxlR2xvYmFsID0gaXNVbmRlZmluZWRPck51bGwoYWRkZWRWaWV3RGVzY3JpcHRvclN0YXRlLnZpc2libGUpID8gKGlzVW5kZWZpbmVkT3JOdWxsKHN0YXRlLnZpc2libGVHbG9iYWwpID8gIXZpZXdEZXNjcmlwdG9yLmhpZGVCeURlZmF1bHQgOiBzdGF0ZS52aXNpYmxlR2xvYmFsKSA6IGFkZGVkVmlld0Rlc2NyaXB0b3JTdGF0ZS52aXNpYmxlO1xuXHRcdFx0XHRcdGlmIChzdGF0ZS52aXNpYmxlR2xvYmFsICYmICFpc1Zpc2libGUpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nZ2VyLnZhbHVlLmluZm8oYEFkZGVkIHZpZXcgJHt2aWV3RGVzY3JpcHRvci5pZH0gaW4gdGhlIGNvbnRhaW5lciAke3RoaXMudmlld0NvbnRhaW5lci5pZH0gYW5kIHNob3dpbmcgaXQuYCwgYCR7aXNWaXNpYmxlfWAsIGAke3ZpZXdEZXNjcmlwdG9yLmhpZGVCeURlZmF1bHR9YCwgYCR7YWRkZWRWaWV3RGVzY3JpcHRvclN0YXRlLnZpc2libGV9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXRlLmNvbGxhcHNlZCA9IGlzVW5kZWZpbmVkT3JOdWxsKGFkZGVkVmlld0Rlc2NyaXB0b3JTdGF0ZS5jb2xsYXBzZWQpID8gKGlzVW5kZWZpbmVkT3JOdWxsKHN0YXRlLmNvbGxhcHNlZCkgPyAhIXZpZXdEZXNjcmlwdG9yLmNvbGxhcHNlZCA6IHN0YXRlLmNvbGxhcHNlZCkgOiBhZGRlZFZpZXdEZXNjcmlwdG9yU3RhdGUuY29sbGFwc2VkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3RhdGUgPSB7XG5cdFx0XHRcdFx0YWN0aXZlOiBmYWxzZSxcblx0XHRcdFx0XHR2aXNpYmxlR2xvYmFsOiBpc1VuZGVmaW5lZE9yTnVsbChhZGRlZFZpZXdEZXNjcmlwdG9yU3RhdGUudmlzaWJsZSkgPyAhdmlld0Rlc2NyaXB0b3IuaGlkZUJ5RGVmYXVsdCA6IGFkZGVkVmlld0Rlc2NyaXB0b3JTdGF0ZS52aXNpYmxlLFxuXHRcdFx0XHRcdHZpc2libGVXb3Jrc3BhY2U6IGlzVW5kZWZpbmVkT3JOdWxsKGFkZGVkVmlld0Rlc2NyaXB0b3JTdGF0ZS52aXNpYmxlKSA/ICF2aWV3RGVzY3JpcHRvci5oaWRlQnlEZWZhdWx0IDogYWRkZWRWaWV3RGVzY3JpcHRvclN0YXRlLnZpc2libGUsXG5cdFx0XHRcdFx0Y29sbGFwc2VkOiBpc1VuZGVmaW5lZE9yTnVsbChhZGRlZFZpZXdEZXNjcmlwdG9yU3RhdGUuY29sbGFwc2VkKSA/ICEhdmlld0Rlc2NyaXB0b3IuY29sbGFwc2VkIDogYWRkZWRWaWV3RGVzY3JpcHRvclN0YXRlLmNvbGxhcHNlZCxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHRoaXMudmlld0Rlc2NyaXB0b3JzU3RhdGUuc2V0KHZpZXdEZXNjcmlwdG9yLmlkLCBzdGF0ZSk7XG5cdFx0XHRzdGF0ZS5hY3RpdmUgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXModmlld0Rlc2NyaXB0b3Iud2hlbik7XG5cdFx0XHRhZGRlZEl0ZW1zLnB1c2goeyB2aWV3RGVzY3JpcHRvciwgc3RhdGUgfSk7XG5cdFx0fVxuXHRcdHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtcy5wdXNoKC4uLmFkZGVkSXRlbXMpO1xuXHRcdHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtcy5zb3J0KHRoaXMuY29tcGFyZVZpZXdEZXNjcmlwdG9ycy5iaW5kKHRoaXMpKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUFsbFZpZXdEZXNjcmlwdG9ycy5maXJlKHsgYWRkZWQ6IGFkZGVkSXRlbXMubWFwKCh7IHZpZXdEZXNjcmlwdG9yIH0pID0+IHZpZXdEZXNjcmlwdG9yKSwgcmVtb3ZlZDogW10gfSk7XG5cblx0XHRjb25zdCBhZGRlZEFjdGl2ZUl0ZW1zOiB7IHZpZXdEZXNjcmlwdG9ySXRlbTogSVZpZXdEZXNjcmlwdG9ySXRlbTsgdmlzaWJsZTogYm9vbGVhbiB9W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHZpZXdEZXNjcmlwdG9ySXRlbSBvZiBhZGRlZEl0ZW1zKSB7XG5cdFx0XHRpZiAodmlld0Rlc2NyaXB0b3JJdGVtLnN0YXRlLmFjdGl2ZSkge1xuXHRcdFx0XHRhZGRlZEFjdGl2ZUl0ZW1zLnB1c2goeyB2aWV3RGVzY3JpcHRvckl0ZW0sIHZpc2libGU6IHRoaXMuaXNWaWV3RGVzY3JpcHRvclZpc2libGUodmlld0Rlc2NyaXB0b3JJdGVtKSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGFkZGVkQWN0aXZlSXRlbXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5maXJlKCh7IGFkZGVkOiBhZGRlZEFjdGl2ZUl0ZW1zLm1hcCgoeyB2aWV3RGVzY3JpcHRvckl0ZW0gfSkgPT4gdmlld0Rlc2NyaXB0b3JJdGVtLnZpZXdEZXNjcmlwdG9yKSwgcmVtb3ZlZDogW10gfSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFkZGVkVmlzaWJsZURlc2NyaXB0b3JzOiBJQWRkZWRWaWV3RGVzY3JpcHRvclJlZltdID0gW107XG5cdFx0Zm9yIChjb25zdCB7IHZpZXdEZXNjcmlwdG9ySXRlbSwgdmlzaWJsZSB9IG9mIGFkZGVkQWN0aXZlSXRlbXMpIHtcblx0XHRcdGlmICh2aXNpYmxlICYmIHRoaXMuaXNWaWV3RGVzY3JpcHRvclZpc2libGUodmlld0Rlc2NyaXB0b3JJdGVtKSkge1xuXHRcdFx0XHRjb25zdCB7IHZpc2libGVJbmRleCB9ID0gdGhpcy5maW5kKHZpZXdEZXNjcmlwdG9ySXRlbS52aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdGFkZGVkVmlzaWJsZURlc2NyaXB0b3JzLnB1c2goeyBpbmRleDogdmlzaWJsZUluZGV4LCB2aWV3RGVzY3JpcHRvcjogdmlld0Rlc2NyaXB0b3JJdGVtLnZpZXdEZXNjcmlwdG9yLCBzaXplOiB2aWV3RGVzY3JpcHRvckl0ZW0uc3RhdGUuc2l6ZSwgY29sbGFwc2VkOiAhIXZpZXdEZXNjcmlwdG9ySXRlbS5zdGF0ZS5jb2xsYXBzZWQgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuYnJvYWRDYXN0QWRkZWRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKGFkZGVkVmlzaWJsZURlc2NyaXB0b3JzKTtcblx0fVxuXG5cdHJlbW92ZSh2aWV3RGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvcltdKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVtb3ZlZDogSVZpZXdEZXNjcmlwdG9yW10gPSBbXTtcblx0XHRjb25zdCByZW1vdmVkSXRlbXM6IElWaWV3RGVzY3JpcHRvckl0ZW1bXSA9IFtdO1xuXHRcdGNvbnN0IHJlbW92ZWRBY3RpdmVEZXNjcmlwdG9yczogSVZpZXdEZXNjcmlwdG9yW10gPSBbXTtcblx0XHRjb25zdCByZW1vdmVkVmlzaWJsZURlc2NyaXB0b3JzOiBJVmlld0Rlc2NyaXB0b3JSZWZbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCB2aWV3RGVzY3JpcHRvciBvZiB2aWV3RGVzY3JpcHRvcnMpIHtcblx0XHRcdGlmICh2aWV3RGVzY3JpcHRvci53aGVuKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qga2V5IG9mIHZpZXdEZXNjcmlwdG9yLndoZW4ua2V5cygpKSB7XG5cdFx0XHRcdFx0dGhpcy5jb250ZXh0S2V5cy5kZWxldGUoa2V5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLnZpZXdEZXNjcmlwdG9ySXRlbXMuZmluZEluZGV4KGkgPT4gaS52aWV3RGVzY3JpcHRvci5pZCA9PT0gdmlld0Rlc2NyaXB0b3IuaWQpO1xuXHRcdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRyZW1vdmVkLnB1c2godmlld0Rlc2NyaXB0b3IpO1xuXHRcdFx0XHRjb25zdCB2aWV3RGVzY3JpcHRvckl0ZW0gPSB0aGlzLnZpZXdEZXNjcmlwdG9ySXRlbXNbaW5kZXhdO1xuXHRcdFx0XHRpZiAodmlld0Rlc2NyaXB0b3JJdGVtLnN0YXRlLmFjdGl2ZSkge1xuXHRcdFx0XHRcdHJlbW92ZWRBY3RpdmVEZXNjcmlwdG9ycy5wdXNoKHZpZXdEZXNjcmlwdG9ySXRlbS52aWV3RGVzY3JpcHRvcik7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuaXNWaWV3RGVzY3JpcHRvclZpc2libGUodmlld0Rlc2NyaXB0b3JJdGVtKSkge1xuXHRcdFx0XHRcdGNvbnN0IHsgdmlzaWJsZUluZGV4IH0gPSB0aGlzLmZpbmQodmlld0Rlc2NyaXB0b3JJdGVtLnZpZXdEZXNjcmlwdG9yLmlkKTtcblx0XHRcdFx0XHRyZW1vdmVkVmlzaWJsZURlc2NyaXB0b3JzLnB1c2goeyBpbmRleDogdmlzaWJsZUluZGV4LCB2aWV3RGVzY3JpcHRvcjogdmlld0Rlc2NyaXB0b3JJdGVtLnZpZXdEZXNjcmlwdG9yIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlbW92ZWRJdGVtcy5wdXNoKHZpZXdEZXNjcmlwdG9ySXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gdXBkYXRlIHN0YXRlXG5cdFx0cmVtb3ZlZEl0ZW1zLmZvckVhY2goaXRlbSA9PiB0aGlzLnZpZXdEZXNjcmlwdG9ySXRlbXMuc3BsaWNlKHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtcy5pbmRleE9mKGl0ZW0pLCAxKSk7XG5cblx0XHR0aGlzLmJyb2FkQ2FzdFJlbW92ZWRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKHJlbW92ZWRWaXNpYmxlRGVzY3JpcHRvcnMpO1xuXHRcdGlmIChyZW1vdmVkQWN0aXZlRGVzY3JpcHRvcnMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5maXJlKCh7IGFkZGVkOiBbXSwgcmVtb3ZlZDogcmVtb3ZlZEFjdGl2ZURlc2NyaXB0b3JzIH0pKTtcblx0XHR9XG5cdFx0aWYgKHJlbW92ZWQubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFsbFZpZXdEZXNjcmlwdG9ycy5maXJlKHsgYWRkZWQ6IFtdLCByZW1vdmVkIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VDb250ZXh0KCk6IHZvaWQge1xuXHRcdGNvbnN0IGFkZGVkQWN0aXZlSXRlbXM6IHsgaXRlbTogSVZpZXdEZXNjcmlwdG9ySXRlbTsgdmlzaWJsZVdoZW5BY3RpdmU6IGJvb2xlYW4gfVtdID0gW107XG5cdFx0Y29uc3QgcmVtb3ZlZEFjdGl2ZUl0ZW1zOiBJVmlld0Rlc2NyaXB0b3JJdGVtW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLnZpZXdEZXNjcmlwdG9ySXRlbXMpIHtcblx0XHRcdGNvbnN0IHdhc0FjdGl2ZSA9IGl0ZW0uc3RhdGUuYWN0aXZlO1xuXHRcdFx0Y29uc3QgaXNBY3RpdmUgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoaXRlbS52aWV3RGVzY3JpcHRvci53aGVuKTtcblx0XHRcdGlmICh3YXNBY3RpdmUgIT09IGlzQWN0aXZlKSB7XG5cdFx0XHRcdGlmIChpc0FjdGl2ZSkge1xuXHRcdFx0XHRcdGFkZGVkQWN0aXZlSXRlbXMucHVzaCh7IGl0ZW0sIHZpc2libGVXaGVuQWN0aXZlOiB0aGlzLmlzVmlld0Rlc2NyaXB0b3JWaXNpYmxlV2hlbkFjdGl2ZShpdGVtKSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZW1vdmVkQWN0aXZlSXRlbXMucHVzaChpdGVtKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlbW92ZWRWaXNpYmxlRGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvclJlZltdID0gW107XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIHJlbW92ZWRBY3RpdmVJdGVtcykge1xuXHRcdFx0aWYgKHRoaXMuaXNWaWV3RGVzY3JpcHRvclZpc2libGUoaXRlbSkpIHtcblx0XHRcdFx0Y29uc3QgeyB2aXNpYmxlSW5kZXggfSA9IHRoaXMuZmluZChpdGVtLnZpZXdEZXNjcmlwdG9yLmlkKTtcblx0XHRcdFx0cmVtb3ZlZFZpc2libGVEZXNjcmlwdG9ycy5wdXNoKHsgaW5kZXg6IHZpc2libGVJbmRleCwgdmlld0Rlc2NyaXB0b3I6IGl0ZW0udmlld0Rlc2NyaXB0b3IgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHRoZSBTdGF0ZVxuXHRcdHJlbW92ZWRBY3RpdmVJdGVtcy5mb3JFYWNoKGl0ZW0gPT4gaXRlbS5zdGF0ZS5hY3RpdmUgPSBmYWxzZSk7XG5cdFx0YWRkZWRBY3RpdmVJdGVtcy5mb3JFYWNoKCh7IGl0ZW0gfSkgPT4gaXRlbS5zdGF0ZS5hY3RpdmUgPSB0cnVlKTtcblxuXHRcdHRoaXMuYnJvYWRDYXN0UmVtb3ZlZFZpc2libGVWaWV3RGVzY3JpcHRvcnMocmVtb3ZlZFZpc2libGVEZXNjcmlwdG9ycyk7XG5cblx0XHRpZiAoYWRkZWRBY3RpdmVJdGVtcy5sZW5ndGggfHwgcmVtb3ZlZEFjdGl2ZUl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVWaWV3RGVzY3JpcHRvcnMuZmlyZSgoeyBhZGRlZDogYWRkZWRBY3RpdmVJdGVtcy5tYXAoKHsgaXRlbSB9KSA9PiBpdGVtLnZpZXdEZXNjcmlwdG9yKSwgcmVtb3ZlZDogcmVtb3ZlZEFjdGl2ZUl0ZW1zLm1hcChpdGVtID0+IGl0ZW0udmlld0Rlc2NyaXB0b3IpIH0pKTtcblx0XHR9XG5cblx0XHRjb25zdCBhZGRlZFZpc2libGVEZXNjcmlwdG9yczogSUFkZGVkVmlld0Rlc2NyaXB0b3JSZWZbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgeyBpdGVtLCB2aXNpYmxlV2hlbkFjdGl2ZSB9IG9mIGFkZGVkQWN0aXZlSXRlbXMpIHtcblx0XHRcdGlmICh2aXNpYmxlV2hlbkFjdGl2ZSAmJiB0aGlzLmlzVmlld0Rlc2NyaXB0b3JWaXNpYmxlKGl0ZW0pKSB7XG5cdFx0XHRcdGNvbnN0IHsgdmlzaWJsZUluZGV4IH0gPSB0aGlzLmZpbmQoaXRlbS52aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdGFkZGVkVmlzaWJsZURlc2NyaXB0b3JzLnB1c2goeyBpbmRleDogdmlzaWJsZUluZGV4LCB2aWV3RGVzY3JpcHRvcjogaXRlbS52aWV3RGVzY3JpcHRvciwgc2l6ZTogaXRlbS5zdGF0ZS5zaXplLCBjb2xsYXBzZWQ6ICEhaXRlbS5zdGF0ZS5jb2xsYXBzZWQgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuYnJvYWRDYXN0QWRkZWRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKGFkZGVkVmlzaWJsZURlc2NyaXB0b3JzKTtcblx0fVxuXG5cdHByaXZhdGUgYnJvYWRDYXN0QWRkZWRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKGFkZGVkOiBJQWRkZWRWaWV3RGVzY3JpcHRvclJlZltdKTogdm9pZCB7XG5cdFx0aWYgKGFkZGVkLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fb25EaWRBZGRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzLmZpcmUoYWRkZWQuc29ydCgoYSwgYikgPT4gYS5pbmRleCAtIGIuaW5kZXgpKTtcblx0XHRcdHRoaXMudXBkYXRlU3RhdGUoYEFkZGVkIHZpZXdzOiR7YWRkZWQubWFwKHYgPT4gdi52aWV3RGVzY3JpcHRvci5pZCkuam9pbignLCcpfSBpbiAke3RoaXMudmlld0NvbnRhaW5lci5pZH1gKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGJyb2FkQ2FzdFJlbW92ZWRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKHJlbW92ZWQ6IElWaWV3RGVzY3JpcHRvclJlZltdKTogdm9pZCB7XG5cdFx0aWYgKHJlbW92ZWQubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFJlbW92ZVZpc2libGVWaWV3RGVzY3JpcHRvcnMuZmlyZShyZW1vdmVkLnNvcnQoKGEsIGIpID0+IGIuaW5kZXggLSBhLmluZGV4KSk7XG5cdFx0XHR0aGlzLnVwZGF0ZVN0YXRlKGBSZW1vdmVkIHZpZXdzOiR7cmVtb3ZlZC5tYXAodiA9PiB2LnZpZXdEZXNjcmlwdG9yLmlkKS5qb2luKCcsJyl9IGZyb20gJHt0aGlzLnZpZXdDb250YWluZXIuaWR9YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBicm9hZENhc3RNb3ZlZFZpZXdEZXNjcmlwdG9ycyhmcm9tOiBJVmlld0Rlc2NyaXB0b3JSZWYsIHRvOiBJVmlld0Rlc2NyaXB0b3JSZWYpOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZE1vdmVWaXNpYmxlVmlld0Rlc2NyaXB0b3JzLmZpcmUoeyBmcm9tLCB0byB9KTtcblx0XHR0aGlzLnVwZGF0ZVN0YXRlKGBNb3ZlZCB2aWV3ICR7ZnJvbS52aWV3RGVzY3JpcHRvci5pZH0gdG8gJHt0by52aWV3RGVzY3JpcHRvci5pZH0gaW4gJHt0aGlzLnZpZXdDb250YWluZXIuaWR9YCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVN0YXRlKHJlYXNvbjogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dnZXIudmFsdWUuaW5mbyhyZWFzb24pO1xuXHRcdHRoaXMudmlld0Rlc2NyaXB0b3JzU3RhdGUudXBkYXRlU3RhdGUodGhpcy5hbGxWaWV3RGVzY3JpcHRvcnMpO1xuXHRcdHRoaXMudXBkYXRlQ29udGFpbmVySW5mbygpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1ZpZXdEZXNjcmlwdG9yVmlzaWJsZSh2aWV3RGVzY3JpcHRvckl0ZW06IElWaWV3RGVzY3JpcHRvckl0ZW0pOiBib29sZWFuIHtcblx0XHRpZiAoIXZpZXdEZXNjcmlwdG9ySXRlbS5zdGF0ZS5hY3RpdmUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuaXNWaWV3RGVzY3JpcHRvclZpc2libGVXaGVuQWN0aXZlKHZpZXdEZXNjcmlwdG9ySXRlbSk7XG5cdH1cblxuXHRwcml2YXRlIGlzVmlld0Rlc2NyaXB0b3JWaXNpYmxlV2hlbkFjdGl2ZSh2aWV3RGVzY3JpcHRvckl0ZW06IElWaWV3RGVzY3JpcHRvckl0ZW0pOiBib29sZWFuIHtcblx0XHRpZiAodmlld0Rlc2NyaXB0b3JJdGVtLnZpZXdEZXNjcmlwdG9yLndvcmtzcGFjZSkge1xuXHRcdFx0cmV0dXJuICEhdmlld0Rlc2NyaXB0b3JJdGVtLnN0YXRlLnZpc2libGVXb3Jrc3BhY2U7XG5cdFx0fVxuXHRcdHJldHVybiAhIXZpZXdEZXNjcmlwdG9ySXRlbS5zdGF0ZS52aXNpYmxlR2xvYmFsO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kKGlkOiBzdHJpbmcpOiB7IGluZGV4OiBudW1iZXI7IHZpc2libGVJbmRleDogbnVtYmVyOyB2aWV3RGVzY3JpcHRvckl0ZW06IElWaWV3RGVzY3JpcHRvckl0ZW0gfSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5maW5kQW5kSWdub3JlSWZOb3RGb3VuZChpZCk7XG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKGB2aWV3IGRlc2NyaXB0b3IgJHtpZH0gbm90IGZvdW5kYCk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRBbmRJZ25vcmVJZk5vdEZvdW5kKGlkOiBzdHJpbmcpOiB7IGluZGV4OiBudW1iZXI7IHZpc2libGVJbmRleDogbnVtYmVyOyB2aWV3RGVzY3JpcHRvckl0ZW06IElWaWV3RGVzY3JpcHRvckl0ZW0gfSB8IHVuZGVmaW5lZCB7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIHZpc2libGVJbmRleCA9IDA7IGkgPCB0aGlzLnZpZXdEZXNjcmlwdG9ySXRlbXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9ySXRlbSA9IHRoaXMudmlld0Rlc2NyaXB0b3JJdGVtc1tpXTtcblx0XHRcdGlmICh2aWV3RGVzY3JpcHRvckl0ZW0udmlld0Rlc2NyaXB0b3IuaWQgPT09IGlkKSB7XG5cdFx0XHRcdHJldHVybiB7IGluZGV4OiBpLCB2aXNpYmxlSW5kZXgsIHZpZXdEZXNjcmlwdG9ySXRlbTogdmlld0Rlc2NyaXB0b3JJdGVtIH07XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5pc1ZpZXdEZXNjcmlwdG9yVmlzaWJsZSh2aWV3RGVzY3JpcHRvckl0ZW0pKSB7XG5cdFx0XHRcdHZpc2libGVJbmRleCsrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wYXJlVmlld0Rlc2NyaXB0b3JzKGE6IElWaWV3RGVzY3JpcHRvckl0ZW0sIGI6IElWaWV3RGVzY3JpcHRvckl0ZW0pOiBudW1iZXIge1xuXHRcdGlmIChhLnZpZXdEZXNjcmlwdG9yLmlkID09PSBiLnZpZXdEZXNjcmlwdG9yLmlkKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRyZXR1cm4gKHRoaXMuZ2V0Vmlld09yZGVyKGEpIC0gdGhpcy5nZXRWaWV3T3JkZXIoYikpIHx8IHRoaXMuZ2V0R3JvdXBPcmRlclJlc3VsdChhLnZpZXdEZXNjcmlwdG9yLCBiLnZpZXdEZXNjcmlwdG9yKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Vmlld09yZGVyKHZpZXdEZXNjcmlwdG9ySXRlbTogSVZpZXdEZXNjcmlwdG9ySXRlbSk6IG51bWJlciB7XG5cdFx0Y29uc3Qgdmlld09yZGVyID0gdHlwZW9mIHZpZXdEZXNjcmlwdG9ySXRlbS5zdGF0ZS5vcmRlciA9PT0gJ251bWJlcicgPyB2aWV3RGVzY3JpcHRvckl0ZW0uc3RhdGUub3JkZXIgOiB2aWV3RGVzY3JpcHRvckl0ZW0udmlld0Rlc2NyaXB0b3Iub3JkZXI7XG5cdFx0cmV0dXJuIHR5cGVvZiB2aWV3T3JkZXIgPT09ICdudW1iZXInID8gdmlld09yZGVyIDogTnVtYmVyLk1BWF9WQUxVRTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0R3JvdXBPcmRlclJlc3VsdChhOiBJVmlld0Rlc2NyaXB0b3IsIGI6IElWaWV3RGVzY3JpcHRvcikge1xuXHRcdGlmICghYS5ncm91cCB8fCAhYi5ncm91cCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0aWYgKGEuZ3JvdXAgPT09IGIuZ3JvdXApIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdHJldHVybiBhLmdyb3VwIDwgYi5ncm91cCA/IC0xIDogMTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUF5RCxjQUFjLGdCQUE2RyxpQkFBaUIsY0FBYyxzQkFBc0I7QUFDek8sU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxPQUFPLGVBQWU7QUFDL0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsVUFBVSxZQUFZO0FBQy9CLFNBQVMsYUFBYSx5QkFBeUI7QUFDL0MsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBRTFCLFNBQWtCLHNCQUFzQjtBQUN4QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFlBQVk7QUFDckIsU0FBUyxzQkFBc0I7QUFFeEIsU0FBUyx1QkFBdUIsd0JBQXdDO0FBQUUsU0FBTyxHQUFHLHNCQUFzQjtBQUFXO0FBd0I1SCxJQUFNLHVCQUFOLGNBQW1DLFdBQVc7QUFBQSxFQVc3QyxZQUNDLHdCQUNpQixtQkFDaUIsZ0JBQ2xCLGVBQ2Y7QUFDRCxVQUFNO0FBSlc7QUFDaUI7QUFSbkMsU0FBUSwwQkFBMEIsS0FBSyxVQUFVLElBQUksUUFBNEMsQ0FBQztBQUNsRyxTQUFTLHlCQUF5QixLQUFLLHdCQUF3QjtBQVk5RCxTQUFLLFNBQVMsSUFBSSxLQUFLLE1BQU0sY0FBYyxhQUFhLGNBQWMsRUFBRSxNQUFNLGdCQUFnQixPQUFPLGVBQWUsQ0FBQyxDQUFDO0FBRXRILFNBQUssNEJBQTRCLHVCQUF1QixzQkFBc0I7QUFDOUUsU0FBSywrQkFBK0I7QUFDcEMsU0FBSyxVQUFVLEtBQUssZUFBZSxpQkFBaUIsYUFBYSxTQUFTLEtBQUssMkJBQTJCLEtBQUssTUFBTSxFQUFFLE1BQU0sS0FBSyxtQkFBbUIsQ0FBQyxDQUFDO0FBRXZKLFNBQUssUUFBUSxLQUFLLFdBQVc7QUFBQSxFQUU5QjtBQUFBLEVBRUEsSUFBSSxJQUFZLE9BQW1DO0FBQ2xELFNBQUssTUFBTSxJQUFJLElBQUksS0FBSztBQUFBLEVBQ3pCO0FBQUEsRUFFQSxJQUFJLElBQThDO0FBQ2pELFdBQU8sS0FBSyxNQUFNLElBQUksRUFBRTtBQUFBLEVBQ3pCO0FBQUEsRUFFQSxZQUFZLGlCQUF1RDtBQUNsRSxTQUFLLHFCQUFxQixlQUFlO0FBQ3pDLFNBQUssa0JBQWtCLGVBQWU7QUFBQSxFQUN2QztBQUFBLEVBRVEscUJBQXFCLGlCQUF1RDtBQUNuRixVQUFNLG9CQUFvQixLQUFLLHdCQUF3QjtBQUN2RCxlQUFXLGtCQUFrQixpQkFBaUI7QUFDN0MsWUFBTSxZQUFZLEtBQUssSUFBSSxlQUFlLEVBQUU7QUFDNUMsVUFBSSxXQUFXO0FBQ2QsMEJBQWtCLGVBQWUsRUFBRSxJQUFJO0FBQUEsVUFDdEMsV0FBVyxDQUFDLENBQUMsVUFBVTtBQUFBLFVBQ3ZCLFVBQVUsQ0FBQyxVQUFVO0FBQUEsVUFDckIsTUFBTSxVQUFVO0FBQUEsVUFDaEIsT0FBTyxlQUFlLGFBQWEsWUFBWSxVQUFVLFFBQVE7QUFBQSxRQUNsRTtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsUUFBSSxPQUFPLEtBQUssaUJBQWlCLEVBQUUsU0FBUyxHQUFHO0FBQzlDLFdBQUssZUFBZSxNQUFNLEtBQUssOEJBQThCLEtBQUssVUFBVSxpQkFBaUIsR0FBRyxhQUFhLFdBQVcsY0FBYyxPQUFPO0FBQUEsSUFDOUksT0FBTztBQUNOLFdBQUssZUFBZSxPQUFPLEtBQUssOEJBQThCLGFBQWEsU0FBUztBQUFBLElBQ3JGO0FBQUEsRUFDRDtBQUFBLEVBRVEsa0JBQWtCLGlCQUF1RDtBQUNoRixVQUFNLG9CQUFvQixLQUFLLHFCQUFxQjtBQUNwRCxlQUFXLGtCQUFrQixpQkFBaUI7QUFDN0MsWUFBTSxRQUFRLEtBQUssSUFBSSxlQUFlLEVBQUU7QUFDeEMsd0JBQWtCLElBQUksZUFBZSxJQUFJO0FBQUEsUUFDeEMsSUFBSSxlQUFlO0FBQUEsUUFDbkIsVUFBVSxTQUFTLGVBQWUsc0JBQXNCLENBQUMsTUFBTSxnQkFBZ0I7QUFBQSxRQUMvRSxPQUFPLENBQUMsZUFBZSxhQUFhLFFBQVEsTUFBTSxRQUFRO0FBQUEsTUFDM0QsQ0FBQztBQUFBLElBQ0Y7QUFDQSxTQUFLLHFCQUFxQixpQkFBaUI7QUFBQSxFQUM1QztBQUFBLEVBRVEscUJBQTJCO0FBQ2xDLFFBQUksS0FBSywyQkFBMkIsS0FBSyxnQ0FBZ0MsR0FBZ0U7QUFDeEksV0FBSywwQkFBMEI7QUFDL0IsWUFBTSw4QkFBOEIsS0FBSyxxQkFBcUI7QUFDOUQsWUFBTSw2QkFBNkIsS0FBSyx3QkFBd0I7QUFDaEUsWUFBTSxnQkFBb0QsQ0FBQztBQUMzRCxpQkFBVyxDQUFDLElBQUksV0FBVyxLQUFLLDZCQUE2QjtBQUM1RCxjQUFNLFFBQVEsS0FBSyxJQUFJLEVBQUU7QUFDekIsWUFBSSxPQUFPO0FBQ1YsY0FBSSxNQUFNLGtCQUFrQixDQUFDLFlBQVksVUFBVTtBQUNsRCxnQkFBSSxDQUFDLFlBQVksVUFBVTtBQUMxQixtQkFBSyxPQUFPLE1BQU0sS0FBSyxrQ0FBa0MsRUFBRSxtQkFBbUIsS0FBSyxpQkFBaUI7QUFBQSxZQUNyRztBQUNBLDBCQUFjLEtBQUssRUFBRSxJQUFJLFNBQVMsQ0FBQyxZQUFZLFNBQVMsQ0FBQztBQUFBLFVBQzFEO0FBQUEsUUFDRCxPQUFPO0FBQ04sZ0JBQU0scUJBQTRELDJCQUEyQixFQUFFO0FBQy9GLGVBQUssSUFBSSxJQUFJO0FBQUEsWUFDWixRQUFRO0FBQUEsWUFDUixlQUFlLENBQUMsWUFBWTtBQUFBLFlBQzVCLGtCQUFrQixZQUFZLG9CQUFvQixRQUFRLElBQUksU0FBWSxDQUFDLG9CQUFvQjtBQUFBLFlBQy9GLFdBQVcsb0JBQW9CO0FBQUEsWUFDL0IsT0FBTyxvQkFBb0I7QUFBQSxZQUMzQixNQUFNLG9CQUFvQjtBQUFBLFVBQzNCLENBQUM7QUFBQSxRQUNGO0FBQUEsTUFDRDtBQUNBLFVBQUksY0FBYyxRQUFRO0FBQ3pCLGFBQUssd0JBQXdCLEtBQUssYUFBYTtBQUcvQyxtQkFBVyxnQkFBZ0IsZUFBZTtBQUN6QyxnQkFBTSxRQUFRLEtBQUssSUFBSSxhQUFhLEVBQUU7QUFDdEMsY0FBSSxPQUFPO0FBQ1Ysa0JBQU0sZ0JBQWdCLGFBQWE7QUFBQSxVQUNwQztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGFBQWdEO0FBQ3ZELFVBQU0sYUFBYSxvQkFBSSxJQUFrQztBQUN6RCxVQUFNLHVCQUF1QixLQUFLLHdCQUF3QjtBQUMxRCxlQUFXLE1BQU0sT0FBTyxLQUFLLG9CQUFvQixHQUFHO0FBQ25ELFlBQU0scUJBQXFCLHFCQUFxQixFQUFFO0FBQ2xELGlCQUFXLElBQUksSUFBSTtBQUFBLFFBQ2xCLFFBQVE7QUFBQSxRQUNSLGVBQWU7QUFBQSxRQUNmLGtCQUFrQixZQUFZLG1CQUFtQixRQUFRLElBQUksU0FBWSxDQUFDLG1CQUFtQjtBQUFBLFFBQzdGLFdBQVcsbUJBQW1CO0FBQUEsUUFDOUIsT0FBTyxtQkFBbUI7QUFBQSxRQUMxQixNQUFNLG1CQUFtQjtBQUFBLE1BQzFCLENBQUM7QUFBQSxJQUNGO0FBR0EsVUFBTSxRQUFRLEtBQUssZUFBZSxJQUFJLEtBQUssMkJBQTJCLGFBQWEsV0FBVyxJQUFJO0FBQ2xHLFVBQU0sRUFBRSxPQUFPLDBCQUEwQixJQUFJLEtBQUssdUJBQXVCLEtBQUs7QUFDOUUsUUFBSSwwQkFBMEIsT0FBTyxHQUFHO0FBQ3ZDLGlCQUFXLEVBQUUsSUFBSSxTQUFTLEtBQUssMEJBQTBCLE9BQU8sR0FBRztBQUNsRSxjQUFNLFlBQVksV0FBVyxJQUFJLEVBQUU7QUFFbkMsWUFBSSxXQUFXO0FBQ2QsY0FBSSxZQUFZLFVBQVUsZ0JBQWdCLEdBQUc7QUFDNUMsc0JBQVUsbUJBQW1CLENBQUM7QUFBQSxVQUMvQjtBQUFBLFFBQ0QsT0FBTztBQUNOLHFCQUFXLElBQUksSUFBSTtBQUFBLFlBQ2xCLFFBQVE7QUFBQSxZQUNSLFdBQVc7QUFBQSxZQUNYLGVBQWU7QUFBQSxZQUNmLGtCQUFrQixDQUFDO0FBQUEsVUFDcEIsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNEO0FBQ0EsV0FBSyxlQUFlLE9BQU8sS0FBSywyQkFBMkIsYUFBYSxTQUFTO0FBQUEsSUFDbEY7QUFFQSxVQUFNLEVBQUUsT0FBTyxjQUFjLElBQUksS0FBSyx1QkFBdUIsS0FBSyxzQkFBc0I7QUFDeEYsUUFBSSxlQUFlO0FBQ2xCLFdBQUsscUJBQXFCLEtBQUs7QUFBQSxJQUNoQztBQUNBLGVBQVcsRUFBRSxJQUFJLFVBQVUsTUFBTSxLQUFLLE1BQU0sT0FBTyxHQUFHO0FBQ3JELFlBQU0sWUFBWSxXQUFXLElBQUksRUFBRTtBQUNuQyxVQUFJLFdBQVc7QUFDZCxrQkFBVSxnQkFBZ0IsQ0FBQztBQUMzQixZQUFJLENBQUMsWUFBWSxLQUFLLEdBQUc7QUFDeEIsb0JBQVUsUUFBUTtBQUFBLFFBQ25CO0FBQUEsTUFDRCxPQUFPO0FBQ04sbUJBQVcsSUFBSSxJQUFJO0FBQUEsVUFDbEIsUUFBUTtBQUFBLFVBQ1IsZUFBZSxDQUFDO0FBQUEsVUFDaEI7QUFBQSxVQUNBLFdBQVc7QUFBQSxVQUNYLGtCQUFrQjtBQUFBLFFBQ25CLENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSwwQkFBd0U7QUFDL0UsV0FBTyxLQUFLLE1BQU0sS0FBSyxlQUFlLElBQUksS0FBSyw4QkFBOEIsYUFBYSxXQUFXLElBQUksQ0FBQztBQUFBLEVBQzNHO0FBQUEsRUFFUSx1QkFBNEQ7QUFDbkUsV0FBTyxLQUFLLHVCQUF1QixLQUFLLHNCQUFzQixFQUFFO0FBQUEsRUFDakU7QUFBQSxFQUVRLHFCQUFxQixtQkFBOEQ7QUFDMUYsU0FBSyx5QkFBeUIsS0FBSyxVQUFVLENBQUMsR0FBRyxrQkFBa0IsT0FBTyxDQUFDLENBQUM7QUFBQSxFQUM3RTtBQUFBLEVBRVEsdUJBQXVCLE9BQXVGO0FBQ3JILFVBQU0sY0FBc0QsS0FBSyxNQUFNLEtBQUs7QUFDNUUsUUFBSSxnQkFBZ0I7QUFDcEIsVUFBTSxRQUFRLFlBQVksT0FBTyxDQUFDLFFBQVEsZ0JBQWdCO0FBQ3pELFVBQUksT0FBTyxnQkFBZ0IsVUFBMEI7QUFDcEQsd0JBQWdCLGlCQUFpQixPQUFPLElBQUksV0FBVztBQUN2RCxlQUFPLElBQUksYUFBYSxFQUFFLElBQUksYUFBYSxVQUFVLEtBQUssQ0FBQztBQUFBLE1BQzVELE9BQU87QUFDTix3QkFBZ0IsaUJBQWlCLE9BQU8sSUFBSSxZQUFZLEVBQUU7QUFDMUQsZUFBTyxJQUFJLFlBQVksSUFBSSxXQUFXO0FBQUEsTUFDdkM7QUFDQSxhQUFPO0FBQUEsSUFDUixHQUFHLG9CQUFJLElBQW9DLENBQUM7QUFDNUMsV0FBTyxFQUFFLE9BQU8sY0FBYztBQUFBLEVBQy9CO0FBQUEsRUFHQSxJQUFZLHlCQUFpQztBQUM1QyxRQUFJLENBQUMsS0FBSyx5QkFBeUI7QUFDbEMsV0FBSywwQkFBMEIsS0FBSyxnQ0FBZ0M7QUFBQSxJQUNyRTtBQUVBLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLElBQVksdUJBQXVCLHdCQUFnQztBQUNsRSxRQUFJLEtBQUssMkJBQTJCLHdCQUF3QjtBQUMzRCxXQUFLLDBCQUEwQjtBQUMvQixXQUFLLGdDQUFnQyxzQkFBc0I7QUFBQSxJQUM1RDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGtDQUEwQztBQUNqRCxXQUFPLEtBQUssZUFBZSxJQUFJLEtBQUssMkJBQTJCLGFBQWEsU0FBUyxJQUFJO0FBQUEsRUFDMUY7QUFBQSxFQUVRLGdDQUFnQyxPQUFxQjtBQUM1RCxTQUFLLGVBQWUsTUFBTSxLQUFLLDJCQUEyQixPQUFPLGFBQWEsU0FBUyxjQUFjLElBQUk7QUFBQSxFQUMxRztBQUVEO0FBdk9NLHVCQUFOO0FBQUEsRUFjRztBQUFBLEVBQ0E7QUFBQSxHQWZHO0FBOE9DLElBQU0scUJBQU4sY0FBaUMsV0FBMEM7QUFBQSxFQTJDakYsWUFDVSxlQUNjLHNCQUNjLG1CQUNyQixlQUNmO0FBQ0QsVUFBTTtBQUxHO0FBRTRCO0FBNUN0QyxTQUFpQixjQUFjLElBQUksV0FBbUI7QUFDdEQsU0FBUSxzQkFBNkMsQ0FBQztBQWF0RCxTQUFRLDRCQUE0QixLQUFLLFVBQVUsSUFBSSxRQUFxRSxDQUFDO0FBQzdILFNBQVMsMkJBQTJCLEtBQUssMEJBQTBCO0FBSW5FLFNBQVEsaUNBQWlDLEtBQUssVUFBVSxJQUFJLFFBQTRGLENBQUM7QUFDekosU0FBUyxnQ0FBZ0MsS0FBSywrQkFBK0I7QUFJN0UsU0FBUSxvQ0FBb0MsS0FBSyxVQUFVLElBQUksUUFBNEYsQ0FBQztBQUM1SixTQUFTLG1DQUFtQyxLQUFLLGtDQUFrQztBQUtuRixTQUFRLGtDQUFrQyxLQUFLLFVBQVUsSUFBSSxRQUFtQyxDQUFDO0FBQ2pHLFNBQVMsaUNBQW1FLEtBQUssZ0NBQWdDO0FBRWpILFNBQVEscUNBQXFDLEtBQUssVUFBVSxJQUFJLFFBQThCLENBQUM7QUFDL0YsU0FBUyxvQ0FBaUUsS0FBSyxtQ0FBbUM7QUFFbEgsU0FBUSxtQ0FBbUMsS0FBSyxVQUFVLElBQUksUUFBOEQsQ0FBQztBQUM3SCxTQUFTLGtDQUErRixLQUFLLGlDQUFpQztBQVk3SSxTQUFLLFNBQVMsSUFBSSxLQUFLLE1BQU0sY0FBYyxhQUFhLGNBQWMsRUFBRSxNQUFNLGdCQUFnQixPQUFPLGVBQWUsQ0FBQyxDQUFDO0FBRXRILFNBQUssVUFBVSxNQUFNLE9BQU8sa0JBQWtCLG9CQUFvQixPQUFLLEVBQUUsWUFBWSxLQUFLLFdBQVcsQ0FBQyxFQUFFLE1BQU0sS0FBSyxtQkFBbUIsQ0FBQyxDQUFDO0FBQ3hJLFNBQUssdUJBQXVCLEtBQUssVUFBVSxxQkFBcUIsZUFBZSxzQkFBc0IsY0FBYyxhQUFhLEdBQUcsY0FBYyxFQUFFLFVBQVUsT0FBTyxjQUFjLFVBQVUsV0FBVyxjQUFjLFFBQVEsY0FBYyxNQUFNLFFBQVEsQ0FBQztBQUMxUCxTQUFLLFVBQVUsS0FBSyxxQkFBcUIsdUJBQXVCLFdBQVMsS0FBSyxpQkFBaUIsS0FBSyxDQUFDLENBQUM7QUFFdEcsU0FBSyxvQkFBb0I7QUFBQSxFQUMxQjtBQUFBLEVBbERBLElBQUksUUFBZ0I7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFRO0FBQUEsRUFHMUMsSUFBSSxPQUFvQztBQUFFLFdBQU8sS0FBSztBQUFBLEVBQU87QUFBQSxFQUc3RCxJQUFJLGVBQW1DO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBZTtBQUFBO0FBQUEsRUFNcEUsSUFBSSxxQkFBcUQ7QUFBRSxXQUFPLEtBQUssb0JBQW9CLElBQUksVUFBUSxLQUFLLGNBQWM7QUFBQSxFQUFHO0FBQUE7QUFBQSxFQUs3SCxJQUFJLHdCQUF3RDtBQUFFLFdBQU8sS0FBSyxvQkFBb0IsT0FBTyxVQUFRLEtBQUssTUFBTSxNQUFNLEVBQUUsSUFBSSxVQUFRLEtBQUssY0FBYztBQUFBLEVBQUc7QUFBQTtBQUFBLEVBS2xLLElBQUkseUJBQXlEO0FBQUUsV0FBTyxLQUFLLG9CQUFvQixPQUFPLFVBQVEsS0FBSyx3QkFBd0IsSUFBSSxDQUFDLEVBQUUsSUFBSSxVQUFRLEtBQUssY0FBYztBQUFBLEVBQUc7QUFBQSxFQThCNUssc0JBQTRCO0FBRW5DLFVBQU0sMEJBQTBCLEtBQUssY0FBYywwQkFBMEIsS0FBSyx1QkFBdUIsV0FBVyxLQUFLLEtBQUssdUJBQXVCLEtBQUssT0FBSyxTQUFTLEdBQW1CLGVBQWUsYUFBYSxFQUFFLGlCQUFpQixFQUFFLEVBQUUsTUFBTSxLQUFLLGFBQWE7QUFDdFEsVUFBTSxRQUFRLDBCQUEyQixPQUFPLEtBQUssY0FBYyxVQUFVLFdBQVcsS0FBSyxjQUFjLFFBQVEsS0FBSyxjQUFjLE1BQU0sUUFBUyxLQUFLLHVCQUF1QixDQUFDLEdBQUcsa0JBQWtCLEtBQUssdUJBQXVCLENBQUMsR0FBRyxNQUFNLFNBQVM7QUFDdFAsUUFBSSxlQUF3QjtBQUM1QixRQUFJLEtBQUssV0FBVyxPQUFPO0FBQzFCLFdBQUssU0FBUztBQUNkLHFCQUFlO0FBQUEsSUFDaEI7QUFFQSxVQUFNLE9BQU8sMEJBQTBCLEtBQUssY0FBYyxPQUFPLEtBQUssdUJBQXVCLENBQUMsR0FBRyxpQkFBaUI7QUFDbEgsUUFBSSxjQUF1QjtBQUMzQixRQUFJLENBQUMsS0FBSyxZQUFZLElBQUksR0FBRztBQUM1QixXQUFLLFFBQVE7QUFDYixvQkFBYztBQUFBLElBQ2Y7QUFFQSxVQUFNLGVBQWUsS0FBSyxjQUFjLDZCQUE2QixNQUFNLEtBQUssc0JBQXNCLEtBQUssT0FBSyxFQUFFLDJCQUEyQixHQUFHLDZCQUE2QjtBQUM3SyxRQUFJLHNCQUErQjtBQUNuQyxRQUFJLEtBQUssa0JBQWtCLGNBQWM7QUFDeEMsV0FBSyxnQkFBZ0I7QUFDckIsNEJBQXNCO0FBQUEsSUFDdkI7QUFFQSxRQUFJLGdCQUFnQixlQUFlLHFCQUFxQjtBQUN2RCxXQUFLLDBCQUEwQixLQUFLLEVBQUUsT0FBTyxjQUFjLE1BQU0sYUFBYSxjQUFjLG9CQUFvQixDQUFDO0FBQUEsSUFDbEg7QUFBQSxFQUNEO0FBQUEsRUFFUSxZQUFZLE1BQTRDO0FBQy9ELFFBQUksSUFBSSxNQUFNLElBQUksR0FBRztBQUNwQixhQUFPLElBQUksTUFBTSxLQUFLLEtBQUssS0FBSyxRQUFRLE1BQU0sS0FBSyxLQUFLO0FBQUEsSUFDekQsV0FBVyxVQUFVLFlBQVksSUFBSSxHQUFHO0FBQ3ZDLGFBQU8sVUFBVSxZQUFZLEtBQUssS0FBSyxLQUFLLFVBQVUsUUFBUSxNQUFNLEtBQUssS0FBSztBQUFBLElBQy9FO0FBQ0EsV0FBTyxTQUFTLEtBQUs7QUFBQSxFQUN0QjtBQUFBLEVBRUEsVUFBVSxJQUFxQjtBQUM5QixVQUFNLHFCQUFxQixLQUFLLG9CQUFvQixLQUFLLE9BQUssRUFBRSxlQUFlLE9BQU8sRUFBRTtBQUN4RixRQUFJLENBQUMsb0JBQW9CO0FBQ3hCLFlBQU0sSUFBSSxNQUFNLGdCQUFnQixFQUFFLEVBQUU7QUFBQSxJQUNyQztBQUNBLFdBQU8sS0FBSyx3QkFBd0Isa0JBQWtCO0FBQUEsRUFDdkQ7QUFBQSxFQUVBLFdBQVcsSUFBWSxTQUF3QjtBQUM5QyxTQUFLLGlCQUFpQixDQUFDLEVBQUUsSUFBSSxRQUFRLENBQUMsQ0FBQztBQUFBLEVBQ3hDO0FBQUEsRUFFUSxpQkFBaUIsaUJBQTJEO0FBRW5GLFVBQU0sNEJBQTRCLFNBQVMsZ0JBQWdCLE9BQU8sQ0FBQyxFQUFFLFFBQVEsTUFBTSxDQUFDLE9BQU8sRUFDekYsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLEtBQUssd0JBQXdCLEVBQUUsQ0FBQyxDQUFDO0FBQ25ELFVBQU0sVUFBZ0MsQ0FBQztBQUN2QyxlQUFXLEVBQUUsb0JBQW9CLGFBQWEsS0FBSywyQkFBMkI7QUFDN0UsVUFBSSxLQUFLLG1DQUFtQyxvQkFBb0IsS0FBSyxHQUFHO0FBQ3ZFLGdCQUFRLEtBQUssRUFBRSxnQkFBZ0IsbUJBQW1CLGdCQUFnQixPQUFPLGFBQWEsQ0FBQztBQUFBLE1BQ3hGO0FBQUEsSUFDRDtBQUNBLFFBQUksUUFBUSxRQUFRO0FBQ25CLFdBQUssdUNBQXVDLE9BQU87QUFBQSxJQUNwRDtBQUdBLFVBQU0sUUFBbUMsQ0FBQztBQUMxQyxlQUFXLEVBQUUsSUFBSSxRQUFRLEtBQUssaUJBQWlCO0FBQzlDLFVBQUksQ0FBQyxTQUFTO0FBQ2I7QUFBQSxNQUNEO0FBQ0EsWUFBTSxzQkFBc0IsS0FBSyx3QkFBd0IsRUFBRTtBQUMzRCxVQUFJLENBQUMscUJBQXFCO0FBQ3pCO0FBQUEsTUFDRDtBQUNBLFlBQU0sRUFBRSxvQkFBb0IsYUFBYSxJQUFJO0FBQzdDLFVBQUksS0FBSyxtQ0FBbUMsb0JBQW9CLElBQUksR0FBRztBQUN0RSxjQUFNLEtBQUssRUFBRSxPQUFPLGNBQWMsZ0JBQWdCLG1CQUFtQixnQkFBZ0IsTUFBTSxtQkFBbUIsTUFBTSxNQUFNLFdBQVcsQ0FBQyxDQUFDLG1CQUFtQixNQUFNLFVBQVUsQ0FBQztBQUFBLE1BQzVLO0FBQUEsSUFDRDtBQUNBLFFBQUksTUFBTSxRQUFRO0FBQ2pCLFdBQUsscUNBQXFDLEtBQUs7QUFBQSxJQUNoRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLG1DQUFtQyxvQkFBeUMsU0FBMkI7QUFDOUcsUUFBSSxDQUFDLG1CQUFtQixlQUFlLHFCQUFxQjtBQUMzRCxhQUFPO0FBQUEsSUFDUjtBQUNBLFFBQUksS0FBSyxrQ0FBa0Msa0JBQWtCLE1BQU0sU0FBUztBQUMzRSxhQUFPO0FBQUEsSUFDUjtBQUdBLFFBQUksbUJBQW1CLGVBQWUsV0FBVztBQUNoRCx5QkFBbUIsTUFBTSxtQkFBbUI7QUFBQSxJQUM3QyxPQUFPO0FBQ04seUJBQW1CLE1BQU0sZ0JBQWdCO0FBQ3pDLFVBQUksU0FBUztBQUNaLGFBQUssT0FBTyxNQUFNLEtBQUssZ0JBQWdCLG1CQUFtQixlQUFlLEVBQUUscUJBQXFCLEtBQUssY0FBYyxFQUFFLEVBQUU7QUFBQSxNQUN4SDtBQUFBLElBQ0Q7QUFHQSxXQUFPLEtBQUssd0JBQXdCLGtCQUFrQixNQUFNO0FBQUEsRUFDN0Q7QUFBQSxFQUVBLFlBQVksSUFBcUI7QUFDaEMsV0FBTyxDQUFDLENBQUMsS0FBSyxLQUFLLEVBQUUsRUFBRSxtQkFBbUIsTUFBTTtBQUFBLEVBQ2pEO0FBQUEsRUFFQSxhQUFhLElBQVksV0FBMEI7QUFDbEQsVUFBTSxFQUFFLG1CQUFtQixJQUFJLEtBQUssS0FBSyxFQUFFO0FBQzNDLFFBQUksbUJBQW1CLE1BQU0sY0FBYyxXQUFXO0FBQ3JELHlCQUFtQixNQUFNLFlBQVk7QUFBQSxJQUN0QztBQUNBLFNBQUsscUJBQXFCLFlBQVksS0FBSyxrQkFBa0I7QUFBQSxFQUM5RDtBQUFBLEVBRUEsUUFBUSxJQUFnQztBQUN2QyxXQUFPLEtBQUssS0FBSyxFQUFFLEVBQUUsbUJBQW1CLE1BQU07QUFBQSxFQUMvQztBQUFBLEVBRUEsU0FBUyxVQUF5RDtBQUNqRSxlQUFXLEVBQUUsSUFBSSxLQUFLLEtBQUssVUFBVTtBQUNwQyxZQUFNLEVBQUUsbUJBQW1CLElBQUksS0FBSyxLQUFLLEVBQUU7QUFDM0MsVUFBSSxtQkFBbUIsTUFBTSxTQUFTLE1BQU07QUFDM0MsMkJBQW1CLE1BQU0sT0FBTztBQUFBLE1BQ2pDO0FBQUEsSUFDRDtBQUNBLFNBQUsscUJBQXFCLFlBQVksS0FBSyxrQkFBa0I7QUFBQSxFQUM5RDtBQUFBLEVBRUEsS0FBSyxNQUFjLElBQWtCO0FBQ3BDLFVBQU0sWUFBWSxLQUFLLG9CQUFvQixVQUFVLE9BQUssRUFBRSxlQUFlLE9BQU8sSUFBSTtBQUN0RixVQUFNLFVBQVUsS0FBSyxvQkFBb0IsVUFBVSxPQUFLLEVBQUUsZUFBZSxPQUFPLEVBQUU7QUFFbEYsVUFBTSxxQkFBcUIsS0FBSyxvQkFBb0IsU0FBUztBQUM3RCxVQUFNLG1CQUFtQixLQUFLLG9CQUFvQixPQUFPO0FBRXpELFNBQUssS0FBSyxxQkFBcUIsV0FBVyxPQUFPO0FBRWpELGFBQVMsUUFBUSxHQUFHLFFBQVEsS0FBSyxvQkFBb0IsUUFBUSxTQUFTO0FBQ3JFLFdBQUssb0JBQW9CLEtBQUssRUFBRSxNQUFNLFFBQVE7QUFBQSxJQUMvQztBQUVBLFNBQUssOEJBQThCLEVBQUUsT0FBTyxXQUFXLGdCQUFnQixtQkFBbUIsZUFBZSxHQUFHLEVBQUUsT0FBTyxTQUFTLGdCQUFnQixpQkFBaUIsZUFBZSxDQUFDO0FBQUEsRUFDaEw7QUFBQSxFQUVBLElBQUksMkJBQThEO0FBQ2pFLFVBQU0sYUFBb0MsQ0FBQztBQUMzQyxlQUFXLDRCQUE0QiwyQkFBMkI7QUFDakUsWUFBTSxpQkFBaUIseUJBQXlCO0FBRWhELFVBQUksZUFBZSxNQUFNO0FBQ3hCLG1CQUFXLE9BQU8sZUFBZSxLQUFLLEtBQUssR0FBRztBQUM3QyxlQUFLLFlBQVksSUFBSSxHQUFHO0FBQUEsUUFDekI7QUFBQSxNQUNEO0FBRUEsVUFBSSxRQUFRLEtBQUsscUJBQXFCLElBQUksZUFBZSxFQUFFO0FBQzNELFVBQUksT0FBTztBQUVWLFlBQUksZUFBZSxXQUFXO0FBQzdCLGdCQUFNLG1CQUFtQixrQkFBa0IseUJBQXlCLE9BQU8sSUFBSyxrQkFBa0IsTUFBTSxnQkFBZ0IsSUFBSSxDQUFDLGVBQWUsZ0JBQWdCLE1BQU0sbUJBQW9CLHlCQUF5QjtBQUFBLFFBQ2hOLE9BQU87QUFDTixnQkFBTSxZQUFZLE1BQU07QUFDeEIsZ0JBQU0sZ0JBQWdCLGtCQUFrQix5QkFBeUIsT0FBTyxJQUFLLGtCQUFrQixNQUFNLGFBQWEsSUFBSSxDQUFDLGVBQWUsZ0JBQWdCLE1BQU0sZ0JBQWlCLHlCQUF5QjtBQUN0TSxjQUFJLE1BQU0saUJBQWlCLENBQUMsV0FBVztBQUN0QyxpQkFBSyxPQUFPLE1BQU0sS0FBSyxjQUFjLGVBQWUsRUFBRSxxQkFBcUIsS0FBSyxjQUFjLEVBQUUsb0JBQW9CLEdBQUcsU0FBUyxJQUFJLEdBQUcsZUFBZSxhQUFhLElBQUksR0FBRyx5QkFBeUIsT0FBTyxFQUFFO0FBQUEsVUFDN007QUFBQSxRQUNEO0FBQ0EsY0FBTSxZQUFZLGtCQUFrQix5QkFBeUIsU0FBUyxJQUFLLGtCQUFrQixNQUFNLFNBQVMsSUFBSSxDQUFDLENBQUMsZUFBZSxZQUFZLE1BQU0sWUFBYSx5QkFBeUI7QUFBQSxNQUMxTCxPQUFPO0FBQ04sZ0JBQVE7QUFBQSxVQUNQLFFBQVE7QUFBQSxVQUNSLGVBQWUsa0JBQWtCLHlCQUF5QixPQUFPLElBQUksQ0FBQyxlQUFlLGdCQUFnQix5QkFBeUI7QUFBQSxVQUM5SCxrQkFBa0Isa0JBQWtCLHlCQUF5QixPQUFPLElBQUksQ0FBQyxlQUFlLGdCQUFnQix5QkFBeUI7QUFBQSxVQUNqSSxXQUFXLGtCQUFrQix5QkFBeUIsU0FBUyxJQUFJLENBQUMsQ0FBQyxlQUFlLFlBQVkseUJBQXlCO0FBQUEsUUFDMUg7QUFBQSxNQUNEO0FBQ0EsV0FBSyxxQkFBcUIsSUFBSSxlQUFlLElBQUksS0FBSztBQUN0RCxZQUFNLFNBQVMsS0FBSyxrQkFBa0Isb0JBQW9CLGVBQWUsSUFBSTtBQUM3RSxpQkFBVyxLQUFLLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQztBQUFBLElBQzFDO0FBQ0EsU0FBSyxvQkFBb0IsS0FBSyxHQUFHLFVBQVU7QUFDM0MsU0FBSyxvQkFBb0IsS0FBSyxLQUFLLHVCQUF1QixLQUFLLElBQUksQ0FBQztBQUNwRSxTQUFLLCtCQUErQixLQUFLLEVBQUUsT0FBTyxXQUFXLElBQUksQ0FBQyxFQUFFLGVBQWUsTUFBTSxjQUFjLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBQztBQUV2SCxVQUFNLG1CQUFvRixDQUFDO0FBQzNGLGVBQVcsc0JBQXNCLFlBQVk7QUFDNUMsVUFBSSxtQkFBbUIsTUFBTSxRQUFRO0FBQ3BDLHlCQUFpQixLQUFLLEVBQUUsb0JBQW9CLFNBQVMsS0FBSyx3QkFBd0Isa0JBQWtCLEVBQUUsQ0FBQztBQUFBLE1BQ3hHO0FBQUEsSUFDRDtBQUNBLFFBQUksaUJBQWlCLFFBQVE7QUFDNUIsV0FBSyxrQ0FBa0MsS0FBTSxFQUFFLE9BQU8saUJBQWlCLElBQUksQ0FBQyxFQUFFLG1CQUFtQixNQUFNLG1CQUFtQixjQUFjLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBRTtBQUFBLElBQzFKO0FBRUEsVUFBTSwwQkFBcUQsQ0FBQztBQUM1RCxlQUFXLEVBQUUsb0JBQW9CLFFBQVEsS0FBSyxrQkFBa0I7QUFDL0QsVUFBSSxXQUFXLEtBQUssd0JBQXdCLGtCQUFrQixHQUFHO0FBQ2hFLGNBQU0sRUFBRSxhQUFhLElBQUksS0FBSyxLQUFLLG1CQUFtQixlQUFlLEVBQUU7QUFDdkUsZ0NBQXdCLEtBQUssRUFBRSxPQUFPLGNBQWMsZ0JBQWdCLG1CQUFtQixnQkFBZ0IsTUFBTSxtQkFBbUIsTUFBTSxNQUFNLFdBQVcsQ0FBQyxDQUFDLG1CQUFtQixNQUFNLFVBQVUsQ0FBQztBQUFBLE1BQzlMO0FBQUEsSUFDRDtBQUNBLFNBQUsscUNBQXFDLHVCQUF1QjtBQUFBLEVBQ2xFO0FBQUEsRUFFQSxPQUFPLGlCQUEwQztBQUNoRCxVQUFNLFVBQTZCLENBQUM7QUFDcEMsVUFBTSxlQUFzQyxDQUFDO0FBQzdDLFVBQU0sMkJBQThDLENBQUM7QUFDckQsVUFBTSw0QkFBa0QsQ0FBQztBQUV6RCxlQUFXLGtCQUFrQixpQkFBaUI7QUFDN0MsVUFBSSxlQUFlLE1BQU07QUFDeEIsbUJBQVcsT0FBTyxlQUFlLEtBQUssS0FBSyxHQUFHO0FBQzdDLGVBQUssWUFBWSxPQUFPLEdBQUc7QUFBQSxRQUM1QjtBQUFBLE1BQ0Q7QUFDQSxZQUFNLFFBQVEsS0FBSyxvQkFBb0IsVUFBVSxPQUFLLEVBQUUsZUFBZSxPQUFPLGVBQWUsRUFBRTtBQUMvRixVQUFJLFVBQVUsSUFBSTtBQUNqQixnQkFBUSxLQUFLLGNBQWM7QUFDM0IsY0FBTSxxQkFBcUIsS0FBSyxvQkFBb0IsS0FBSztBQUN6RCxZQUFJLG1CQUFtQixNQUFNLFFBQVE7QUFDcEMsbUNBQXlCLEtBQUssbUJBQW1CLGNBQWM7QUFBQSxRQUNoRTtBQUNBLFlBQUksS0FBSyx3QkFBd0Isa0JBQWtCLEdBQUc7QUFDckQsZ0JBQU0sRUFBRSxhQUFhLElBQUksS0FBSyxLQUFLLG1CQUFtQixlQUFlLEVBQUU7QUFDdkUsb0NBQTBCLEtBQUssRUFBRSxPQUFPLGNBQWMsZ0JBQWdCLG1CQUFtQixlQUFlLENBQUM7QUFBQSxRQUMxRztBQUNBLHFCQUFhLEtBQUssa0JBQWtCO0FBQUEsTUFDckM7QUFBQSxJQUNEO0FBR0EsaUJBQWEsUUFBUSxVQUFRLEtBQUssb0JBQW9CLE9BQU8sS0FBSyxvQkFBb0IsUUFBUSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBRXZHLFNBQUssdUNBQXVDLHlCQUF5QjtBQUNyRSxRQUFJLHlCQUF5QixRQUFRO0FBQ3BDLFdBQUssa0NBQWtDLEtBQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxTQUFTLHlCQUF5QixDQUFFO0FBQUEsSUFDL0Y7QUFDQSxRQUFJLFFBQVEsUUFBUTtBQUNuQixXQUFLLCtCQUErQixLQUFLLEVBQUUsT0FBTyxDQUFDLEdBQUcsUUFBUSxDQUFDO0FBQUEsSUFDaEU7QUFBQSxFQUNEO0FBQUEsRUFFUSxxQkFBMkI7QUFDbEMsVUFBTSxtQkFBZ0YsQ0FBQztBQUN2RixVQUFNLHFCQUE0QyxDQUFDO0FBRW5ELGVBQVcsUUFBUSxLQUFLLHFCQUFxQjtBQUM1QyxZQUFNLFlBQVksS0FBSyxNQUFNO0FBQzdCLFlBQU0sV0FBVyxLQUFLLGtCQUFrQixvQkFBb0IsS0FBSyxlQUFlLElBQUk7QUFDcEYsVUFBSSxjQUFjLFVBQVU7QUFDM0IsWUFBSSxVQUFVO0FBQ2IsMkJBQWlCLEtBQUssRUFBRSxNQUFNLG1CQUFtQixLQUFLLGtDQUFrQyxJQUFJLEVBQUUsQ0FBQztBQUFBLFFBQ2hHLE9BQU87QUFDTiw2QkFBbUIsS0FBSyxJQUFJO0FBQUEsUUFDN0I7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFVBQU0sNEJBQWtELENBQUM7QUFDekQsZUFBVyxRQUFRLG9CQUFvQjtBQUN0QyxVQUFJLEtBQUssd0JBQXdCLElBQUksR0FBRztBQUN2QyxjQUFNLEVBQUUsYUFBYSxJQUFJLEtBQUssS0FBSyxLQUFLLGVBQWUsRUFBRTtBQUN6RCxrQ0FBMEIsS0FBSyxFQUFFLE9BQU8sY0FBYyxnQkFBZ0IsS0FBSyxlQUFlLENBQUM7QUFBQSxNQUM1RjtBQUFBLElBQ0Q7QUFHQSx1QkFBbUIsUUFBUSxVQUFRLEtBQUssTUFBTSxTQUFTLEtBQUs7QUFDNUQscUJBQWlCLFFBQVEsQ0FBQyxFQUFFLEtBQUssTUFBTSxLQUFLLE1BQU0sU0FBUyxJQUFJO0FBRS9ELFNBQUssdUNBQXVDLHlCQUF5QjtBQUVyRSxRQUFJLGlCQUFpQixVQUFVLG1CQUFtQixRQUFRO0FBQ3pELFdBQUssa0NBQWtDLEtBQU0sRUFBRSxPQUFPLGlCQUFpQixJQUFJLENBQUMsRUFBRSxLQUFLLE1BQU0sS0FBSyxjQUFjLEdBQUcsU0FBUyxtQkFBbUIsSUFBSSxVQUFRLEtBQUssY0FBYyxFQUFFLENBQUU7QUFBQSxJQUMvSztBQUVBLFVBQU0sMEJBQXFELENBQUM7QUFDNUQsZUFBVyxFQUFFLE1BQU0sa0JBQWtCLEtBQUssa0JBQWtCO0FBQzNELFVBQUkscUJBQXFCLEtBQUssd0JBQXdCLElBQUksR0FBRztBQUM1RCxjQUFNLEVBQUUsYUFBYSxJQUFJLEtBQUssS0FBSyxLQUFLLGVBQWUsRUFBRTtBQUN6RCxnQ0FBd0IsS0FBSyxFQUFFLE9BQU8sY0FBYyxnQkFBZ0IsS0FBSyxnQkFBZ0IsTUFBTSxLQUFLLE1BQU0sTUFBTSxXQUFXLENBQUMsQ0FBQyxLQUFLLE1BQU0sVUFBVSxDQUFDO0FBQUEsTUFDcEo7QUFBQSxJQUNEO0FBQ0EsU0FBSyxxQ0FBcUMsdUJBQXVCO0FBQUEsRUFDbEU7QUFBQSxFQUVRLHFDQUFxQyxPQUF3QztBQUNwRixRQUFJLE1BQU0sUUFBUTtBQUNqQixXQUFLLGdDQUFnQyxLQUFLLE1BQU0sS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUM7QUFDakYsV0FBSyxZQUFZLGVBQWUsTUFBTSxJQUFJLE9BQUssRUFBRSxlQUFlLEVBQUUsRUFBRSxLQUFLLEdBQUcsQ0FBQyxPQUFPLEtBQUssY0FBYyxFQUFFLEVBQUU7QUFBQSxJQUM1RztBQUFBLEVBQ0Q7QUFBQSxFQUVRLHVDQUF1QyxTQUFxQztBQUNuRixRQUFJLFFBQVEsUUFBUTtBQUNuQixXQUFLLG1DQUFtQyxLQUFLLFFBQVEsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUM7QUFDdEYsV0FBSyxZQUFZLGlCQUFpQixRQUFRLElBQUksT0FBSyxFQUFFLGVBQWUsRUFBRSxFQUFFLEtBQUssR0FBRyxDQUFDLFNBQVMsS0FBSyxjQUFjLEVBQUUsRUFBRTtBQUFBLElBQ2xIO0FBQUEsRUFDRDtBQUFBLEVBRVEsOEJBQThCLE1BQTBCLElBQThCO0FBQzdGLFNBQUssaUNBQWlDLEtBQUssRUFBRSxNQUFNLEdBQUcsQ0FBQztBQUN2RCxTQUFLLFlBQVksY0FBYyxLQUFLLGVBQWUsRUFBRSxPQUFPLEdBQUcsZUFBZSxFQUFFLE9BQU8sS0FBSyxjQUFjLEVBQUUsRUFBRTtBQUFBLEVBQy9HO0FBQUEsRUFFUSxZQUFZLFFBQXNCO0FBQ3pDLFNBQUssT0FBTyxNQUFNLEtBQUssTUFBTTtBQUM3QixTQUFLLHFCQUFxQixZQUFZLEtBQUssa0JBQWtCO0FBQzdELFNBQUssb0JBQW9CO0FBQUEsRUFDMUI7QUFBQSxFQUVRLHdCQUF3QixvQkFBa0Q7QUFDakYsUUFBSSxDQUFDLG1CQUFtQixNQUFNLFFBQVE7QUFDckMsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLEtBQUssa0NBQWtDLGtCQUFrQjtBQUFBLEVBQ2pFO0FBQUEsRUFFUSxrQ0FBa0Msb0JBQWtEO0FBQzNGLFFBQUksbUJBQW1CLGVBQWUsV0FBVztBQUNoRCxhQUFPLENBQUMsQ0FBQyxtQkFBbUIsTUFBTTtBQUFBLElBQ25DO0FBQ0EsV0FBTyxDQUFDLENBQUMsbUJBQW1CLE1BQU07QUFBQSxFQUNuQztBQUFBLEVBRVEsS0FBSyxJQUE4RjtBQUMxRyxVQUFNLFNBQVMsS0FBSyx3QkFBd0IsRUFBRTtBQUM5QyxRQUFJLFFBQVE7QUFDWCxhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sSUFBSSxNQUFNLG1CQUFtQixFQUFFLFlBQVk7QUFBQSxFQUNsRDtBQUFBLEVBRVEsd0JBQXdCLElBQTBHO0FBQ3pJLGFBQVMsSUFBSSxHQUFHLGVBQWUsR0FBRyxJQUFJLEtBQUssb0JBQW9CLFFBQVEsS0FBSztBQUMzRSxZQUFNLHFCQUFxQixLQUFLLG9CQUFvQixDQUFDO0FBQ3JELFVBQUksbUJBQW1CLGVBQWUsT0FBTyxJQUFJO0FBQ2hELGVBQU8sRUFBRSxPQUFPLEdBQUcsY0FBYyxtQkFBdUM7QUFBQSxNQUN6RTtBQUNBLFVBQUksS0FBSyx3QkFBd0Isa0JBQWtCLEdBQUc7QUFDckQ7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSx1QkFBdUIsR0FBd0IsR0FBZ0M7QUFDdEYsUUFBSSxFQUFFLGVBQWUsT0FBTyxFQUFFLGVBQWUsSUFBSTtBQUNoRCxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQVEsS0FBSyxhQUFhLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxLQUFNLEtBQUssb0JBQW9CLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYztBQUFBLEVBQ3BIO0FBQUEsRUFFUSxhQUFhLG9CQUFpRDtBQUNyRSxVQUFNLFlBQVksT0FBTyxtQkFBbUIsTUFBTSxVQUFVLFdBQVcsbUJBQW1CLE1BQU0sUUFBUSxtQkFBbUIsZUFBZTtBQUMxSSxXQUFPLE9BQU8sY0FBYyxXQUFXLFlBQVksT0FBTztBQUFBLEVBQzNEO0FBQUEsRUFFUSxvQkFBb0IsR0FBb0IsR0FBb0I7QUFDbkUsUUFBSSxDQUFDLEVBQUUsU0FBUyxDQUFDLEVBQUUsT0FBTztBQUN6QixhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksRUFBRSxVQUFVLEVBQUUsT0FBTztBQUN4QixhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxLQUFLO0FBQUEsRUFDakM7QUFDRDtBQW5iYSxxQkFBTjtBQUFBLEVBNkNKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQS9DVTsiLAogICJuYW1lcyI6IFtdCn0K
