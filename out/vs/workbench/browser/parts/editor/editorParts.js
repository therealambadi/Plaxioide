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
import { localize } from "../../../../nls.js";
import { GroupLocation, GroupsOrder, IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableMap, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { MainEditorPart } from "./editorPart.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { distinct } from "../../../../base/common/arrays.js";
import { AuxiliaryEditorPart } from "./auxiliaryEditorPart.js";
import { MultiWindowParts } from "../../part.js";
import { DeferredPromise } from "../../../../base/common/async.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IAuxiliaryWindowService } from "../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { isHTMLElement } from "../../../../base/browser/dom.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
let EditorParts = class extends MultiWindowParts {
  constructor(instantiationService, storageService, themeService, auxiliaryWindowService, contextKeyService) {
    super("workbench.editorParts", themeService, storageService);
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.auxiliaryWindowService = auxiliaryWindowService;
    this.contextKeyService = contextKeyService;
    //#region Scoped Instantiation Services
    this.mapPartToInstantiationService = /* @__PURE__ */ new Map();
    //#endregion
    //#region Auxiliary Editor Parts
    this._onDidCreateAuxiliaryEditorPart = this._register(new Emitter());
    this.onDidCreateAuxiliaryEditorPart = this._onDidCreateAuxiliaryEditorPart.event;
    this.workspaceMemento = this.getMemento(StorageScope.WORKSPACE, StorageTarget.USER);
    this._isReady = false;
    this.whenReadyPromise = new DeferredPromise();
    this.whenReady = this.whenReadyPromise.p;
    this.whenRestoredPromise = new DeferredPromise();
    this.whenRestored = this.whenRestoredPromise.p;
    this.editorWorkingSets = (() => {
      const workingSetsRaw = this.storageService.get(EditorParts.EDITOR_WORKING_SETS_STORAGE_KEY, StorageScope.WORKSPACE);
      if (workingSetsRaw) {
        return JSON.parse(workingSetsRaw);
      }
      return [];
    })();
    //#endregion
    //#region Events
    this._onDidActiveGroupChange = this._register(new Emitter());
    this.onDidChangeActiveGroup = this._onDidActiveGroupChange.event;
    this._onDidAddGroup = this._register(new Emitter());
    this.onDidAddGroup = this._onDidAddGroup.event;
    this._onDidRemoveGroup = this._register(new Emitter());
    this.onDidRemoveGroup = this._onDidRemoveGroup.event;
    this._onDidMoveGroup = this._register(new Emitter());
    this.onDidMoveGroup = this._onDidMoveGroup.event;
    this._onDidActivateGroup = this._register(new Emitter());
    this.onDidActivateGroup = this._onDidActivateGroup.event;
    this._onDidChangeGroupIndex = this._register(new Emitter());
    this.onDidChangeGroupIndex = this._onDidChangeGroupIndex.event;
    this._onDidChangeGroupLocked = this._register(new Emitter());
    this.onDidChangeGroupLocked = this._onDidChangeGroupLocked.event;
    this._onDidChangeGroupMaximized = this._register(new Emitter());
    this.onDidChangeGroupMaximized = this._onDidChangeGroupMaximized.event;
    //#endregion
    //#region Editor Group Context Key Handling
    this.globalContextKeys = /* @__PURE__ */ new Map();
    this.scopedContextKeys = /* @__PURE__ */ new Map();
    this.contextKeyProviders = /* @__PURE__ */ new Map();
    this.registeredContextKeys = /* @__PURE__ */ new Map();
    this.contextKeyProviderDisposables = this._register(new DisposableMap());
    this.mainPart = this._register(this.createMainEditorPart());
    this._register(this.registerPart(this.mainPart));
    this.mostRecentActiveParts = [this.mainPart];
    this.restoreParts();
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.onDidChangeMementoValue(StorageScope.WORKSPACE, this._store)((e) => this.onDidChangeMementoState(e)));
    this.whenReady.then(() => this.registerGroupsContextKeyListeners());
  }
  createMainEditorPart() {
    return this.instantiationService.createInstance(MainEditorPart, this);
  }
  getScopedInstantiationService(part) {
    if (part === this.mainPart) {
      if (!this.mapPartToInstantiationService.has(part.windowId)) {
        this.instantiationService.invokeFunction((accessor) => {
          const editorService = accessor.get(IEditorService);
          this.mapPartToInstantiationService.set(part.windowId, this._register(this.instantiationService.createChild(new ServiceCollection(
            [IEditorService, editorService.createScoped("main", this._store)]
          ))));
        });
      }
    }
    return this.mapPartToInstantiationService.get(part.windowId) ?? this.instantiationService;
  }
  async createAuxiliaryEditorPart(options) {
    const { part, instantiationService, disposables } = await this.instantiationService.createInstance(AuxiliaryEditorPart, this).create(this.getGroupsLabel(this._parts.size), options);
    this.mapPartToInstantiationService.set(part.windowId, instantiationService);
    disposables.add(toDisposable(() => this.mapPartToInstantiationService.delete(part.windowId)));
    this._onDidAddGroup.fire(part.activeGroup);
    this._onDidCreateAuxiliaryEditorPart.fire(part);
    return part;
  }
  //#endregion
  //#region Registration
  registerPart(part) {
    const disposables = this._register(new DisposableStore());
    disposables.add(super.registerPart(part));
    this.registerEditorPartListeners(part, disposables);
    return disposables;
  }
  unregisterPart(part) {
    super.unregisterPart(part);
    this.parts.forEach((part2, index) => {
      if (part2 === this.mainPart) {
        return;
      }
      part2.notifyGroupsLabelChange(this.getGroupsLabel(index));
    });
  }
  registerEditorPartListeners(part, disposables) {
    disposables.add(part.onDidFocus(() => {
      this.doUpdateMostRecentActive(part, true);
      if (this._parts.size > 1) {
        this._onDidActiveGroupChange.fire(this.activeGroup);
      }
    }));
    disposables.add(toDisposable(() => this.doUpdateMostRecentActive(part)));
    disposables.add(part.onDidChangeActiveGroup((group) => this._onDidActiveGroupChange.fire(group)));
    disposables.add(part.onDidAddGroup((group) => this._onDidAddGroup.fire(group)));
    disposables.add(part.onDidRemoveGroup((group) => this._onDidRemoveGroup.fire(group)));
    disposables.add(part.onDidMoveGroup((group) => this._onDidMoveGroup.fire(group)));
    disposables.add(part.onDidActivateGroup((group) => this._onDidActivateGroup.fire(group)));
    disposables.add(part.onDidChangeGroupMaximized((maximized) => this._onDidChangeGroupMaximized.fire(maximized)));
    disposables.add(part.onDidChangeGroupIndex((group) => this._onDidChangeGroupIndex.fire(group)));
    disposables.add(part.onDidChangeGroupLocked((group) => this._onDidChangeGroupLocked.fire(group)));
  }
  doUpdateMostRecentActive(part, makeMostRecentlyActive) {
    const index = this.mostRecentActiveParts.indexOf(part);
    if (index !== -1) {
      this.mostRecentActiveParts.splice(index, 1);
    }
    if (makeMostRecentlyActive) {
      this.mostRecentActiveParts.unshift(part);
    }
  }
  getGroupsLabel(index) {
    return localize("groupLabel", "Window {0}", index + 1);
  }
  getPart(groupOrElement) {
    if (this._parts.size > 1) {
      if (isHTMLElement(groupOrElement)) {
        const element = groupOrElement;
        return this.getPartByDocument(element.ownerDocument);
      } else {
        const group = groupOrElement;
        let id;
        if (typeof group === "number") {
          id = group;
        } else {
          id = group.id;
        }
        for (const part of this._parts) {
          if (part.hasGroup(id)) {
            return part;
          }
        }
      }
    }
    return this.mainPart;
  }
  get isReady() {
    return this._isReady;
  }
  async restoreParts() {
    await this.mainPart.whenReady;
    if (this.mainPart.willRestoreState) {
      const state = this.loadState();
      if (state) {
        await this.restoreState(state);
      }
    }
    const mostRecentActivePart = this.mostRecentActiveParts.at(0);
    mostRecentActivePart?.activeGroup.focus();
    this._isReady = true;
    this.whenReadyPromise.complete();
    await Promise.allSettled(this.parts.map((part) => part.whenRestored));
    this.whenRestoredPromise.complete();
  }
  loadState() {
    return this.workspaceMemento[EditorParts.EDITOR_PARTS_UI_STATE_STORAGE_KEY];
  }
  saveState() {
    const state = this.createState();
    if (state.auxiliary.length === 0) {
      delete this.workspaceMemento[EditorParts.EDITOR_PARTS_UI_STATE_STORAGE_KEY];
    } else {
      this.workspaceMemento[EditorParts.EDITOR_PARTS_UI_STATE_STORAGE_KEY] = state;
    }
  }
  createState() {
    return {
      auxiliary: this.parts.filter((part) => part !== this.mainPart).map((part) => {
        const auxiliaryWindow = this.auxiliaryWindowService.getWindow(part.windowId);
        return {
          state: part.createState(),
          ...auxiliaryWindow?.createState()
        };
      }),
      mru: this.mostRecentActiveParts.map((part) => this.parts.indexOf(part))
    };
  }
  async restoreState(state) {
    if (state.auxiliary.length) {
      const auxiliaryEditorPartPromises = [];
      for (const auxiliaryEditorPartState of state.auxiliary) {
        auxiliaryEditorPartPromises.push(this.createAuxiliaryEditorPart(auxiliaryEditorPartState));
      }
      await Promise.allSettled(auxiliaryEditorPartPromises);
      if (state.mru.length === this.parts.length) {
        this.mostRecentActiveParts = state.mru.map((index) => this.parts[index]);
      } else {
        this.mostRecentActiveParts = [...this.parts];
      }
      await Promise.allSettled(this.parts.map((part) => part.whenReady));
    }
  }
  get hasRestorableState() {
    return this.parts.some((part) => part.hasRestorableState);
  }
  onDidChangeMementoState(e) {
    if (e.external && e.scope === StorageScope.WORKSPACE) {
      this.reloadMemento(e.scope);
      const state = this.loadState();
      if (state) {
        this.applyState(state);
      }
    }
  }
  async applyState(state) {
    for (const part of this.parts) {
      if (part === this.mainPart) {
        continue;
      }
      for (const group of part.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
        await group.closeAllEditors({ excludeConfirming: true });
      }
      const closed = part.close();
      if (!closed) {
        return false;
      }
    }
    if (state !== "empty") {
      await this.restoreState(state);
    }
    return true;
  }
  saveWorkingSet(name) {
    const workingSet = {
      id: generateUuid(),
      name,
      main: this.mainPart.createState(),
      auxiliary: this.createState()
    };
    this.editorWorkingSets.push(workingSet);
    this.saveWorkingSets();
    return {
      id: workingSet.id,
      name: workingSet.name
    };
  }
  getWorkingSets() {
    return this.editorWorkingSets.map((workingSet) => ({ id: workingSet.id, name: workingSet.name }));
  }
  deleteWorkingSet(workingSet) {
    const index = this.indexOfWorkingSet(workingSet);
    if (typeof index === "number") {
      this.editorWorkingSets.splice(index, 1);
      this.saveWorkingSets();
    }
  }
  async applyWorkingSet(workingSet, options) {
    let workingSetState;
    if (workingSet === "empty") {
      workingSetState = "empty";
    } else {
      workingSetState = this.editorWorkingSets[this.indexOfWorkingSet(workingSet) ?? -1];
    }
    if (!workingSetState) {
      return false;
    }
    const applied = await this.applyState(workingSetState === "empty" ? workingSetState : workingSetState.auxiliary);
    if (!applied) {
      return false;
    }
    await this.mainPart.applyState(workingSetState === "empty" ? workingSetState : workingSetState.main, options);
    if (!options?.preserveFocus) {
      const mostRecentActivePart = this.mostRecentActiveParts.at(0);
      if (mostRecentActivePart) {
        await mostRecentActivePart.whenReady;
        mostRecentActivePart.activeGroup.focus();
      }
    }
    return true;
  }
  indexOfWorkingSet(workingSet) {
    for (let i = 0; i < this.editorWorkingSets.length; i++) {
      if (this.editorWorkingSets[i].id === workingSet.id) {
        return i;
      }
    }
    return void 0;
  }
  saveWorkingSets() {
    this.storageService.store(EditorParts.EDITOR_WORKING_SETS_STORAGE_KEY, JSON.stringify(this.editorWorkingSets), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  //#endregion
  //#region Group Management
  get activeGroup() {
    return this.activePart.activeGroup;
  }
  get sideGroup() {
    return this.activePart.sideGroup;
  }
  get groups() {
    return this.getGroups();
  }
  get count() {
    return this.groups.length;
  }
  getGroups(order = GroupsOrder.CREATION_TIME) {
    if (this._parts.size > 1) {
      let parts;
      switch (order) {
        case GroupsOrder.GRID_APPEARANCE:
        // we currently do not have a way to compute by appearance over multiple windows
        case GroupsOrder.CREATION_TIME:
          parts = this.parts;
          break;
        case GroupsOrder.MOST_RECENTLY_ACTIVE:
          parts = distinct([...this.mostRecentActiveParts, ...this.parts]);
          break;
      }
      return parts.map((part) => part.getGroups(order)).flat();
    }
    return this.mainPart.getGroups(order);
  }
  getGroup(identifier) {
    if (this._parts.size > 1) {
      for (const part of this._parts) {
        const group = part.getGroup(identifier);
        if (group) {
          return group;
        }
      }
    }
    return this.mainPart.getGroup(identifier);
  }
  assertGroupView(group) {
    let groupView;
    if (typeof group === "number") {
      groupView = this.getGroup(group);
    } else {
      groupView = group;
    }
    if (!groupView) {
      throw new Error("Invalid editor group provided!");
    }
    return groupView;
  }
  activateGroup(group) {
    return this.getPart(group).activateGroup(group);
  }
  getSize(group) {
    return this.getPart(group).getSize(group);
  }
  setSize(group, size) {
    this.getPart(group).setSize(group, size);
  }
  arrangeGroups(arrangement, group = this.activePart.activeGroup) {
    this.getPart(group).arrangeGroups(arrangement, group);
  }
  toggleMaximizeGroup(group = this.activePart.activeGroup) {
    this.getPart(group).toggleMaximizeGroup(group);
  }
  toggleExpandGroup(group = this.activePart.activeGroup) {
    this.getPart(group).toggleExpandGroup(group);
  }
  restoreGroup(group) {
    return this.getPart(group).restoreGroup(group);
  }
  applyLayout(layout) {
    this.activePart.applyLayout(layout);
  }
  getLayout() {
    return this.activePart.getLayout();
  }
  get orientation() {
    return this.activePart.orientation;
  }
  setGroupOrientation(orientation) {
    this.activePart.setGroupOrientation(orientation);
  }
  findGroup(scope, source = this.activeGroup, wrap) {
    const sourcePart = this.getPart(source);
    if (this._parts.size > 1) {
      const groups = this.getGroups(GroupsOrder.GRID_APPEARANCE);
      if (scope.location === GroupLocation.FIRST || scope.location === GroupLocation.LAST) {
        return scope.location === GroupLocation.FIRST ? groups[0] : groups[groups.length - 1];
      }
      const group = sourcePart.findGroup(scope, source, false);
      if (group) {
        return group;
      }
      if (scope.location === GroupLocation.NEXT || scope.location === GroupLocation.PREVIOUS) {
        const sourceGroup = this.assertGroupView(source);
        const index = groups.indexOf(sourceGroup);
        if (scope.location === GroupLocation.NEXT) {
          let nextGroup = groups[index + 1];
          if (!nextGroup && wrap) {
            nextGroup = groups[0];
          }
          return nextGroup;
        } else {
          let previousGroup = groups[index - 1];
          if (!previousGroup && wrap) {
            previousGroup = groups[groups.length - 1];
          }
          return previousGroup;
        }
      }
    }
    return sourcePart.findGroup(scope, source, wrap);
  }
  addGroup(location, direction) {
    return this.getPart(location).addGroup(location, direction);
  }
  removeGroup(group) {
    this.getPart(group).removeGroup(group);
  }
  moveGroup(group, location, direction) {
    return this.getPart(group).moveGroup(group, location, direction);
  }
  mergeGroup(group, target, options) {
    return this.getPart(group).mergeGroup(group, target, options);
  }
  mergeAllGroups(target, options) {
    return this.activePart.mergeAllGroups(target, options);
  }
  copyGroup(group, location, direction) {
    return this.getPart(group).copyGroup(group, location, direction);
  }
  createEditorDropTarget(container, delegate) {
    return this.getPart(container).createEditorDropTarget(container, delegate);
  }
  registerGroupsContextKeyListeners() {
    this._register(this.onDidChangeActiveGroup(() => this.updateGlobalContextKeys()));
    this.groups.forEach((group) => this.registerGroupContextKeyProvidersListeners(group));
    this._register(this.onDidAddGroup((group) => this.registerGroupContextKeyProvidersListeners(group)));
    this._register(this.onDidRemoveGroup((group) => {
      this.scopedContextKeys.delete(group.id);
      this.registeredContextKeys.delete(group.id);
      this.contextKeyProviderDisposables.deleteAndDispose(group.id);
    }));
  }
  updateGlobalContextKeys() {
    const activeGroupScopedContextKeys = this.scopedContextKeys.get(this.activeGroup.id);
    if (!activeGroupScopedContextKeys) {
      return;
    }
    for (const [key, globalContextKey] of this.globalContextKeys) {
      const scopedContextKey = activeGroupScopedContextKeys.get(key);
      if (scopedContextKey) {
        globalContextKey.set(scopedContextKey.get());
      } else {
        globalContextKey.reset();
      }
    }
  }
  bind(contextKey, group) {
    let globalContextKey = this.globalContextKeys.get(contextKey.key);
    if (!globalContextKey) {
      globalContextKey = contextKey.bindTo(this.contextKeyService);
      this.globalContextKeys.set(contextKey.key, globalContextKey);
    }
    let groupScopedContextKeys = this.scopedContextKeys.get(group.id);
    if (!groupScopedContextKeys) {
      groupScopedContextKeys = /* @__PURE__ */ new Map();
      this.scopedContextKeys.set(group.id, groupScopedContextKeys);
    }
    let scopedContextKey = groupScopedContextKeys.get(contextKey.key);
    if (!scopedContextKey) {
      scopedContextKey = contextKey.bindTo(group.scopedContextKeyService);
      groupScopedContextKeys.set(contextKey.key, scopedContextKey);
    }
    const that = this;
    return {
      get() {
        return scopedContextKey.get();
      },
      set(value) {
        if (that.activeGroup === group) {
          globalContextKey.set(value);
        }
        scopedContextKey.set(value);
      },
      reset() {
        if (that.activeGroup === group) {
          globalContextKey.reset();
        }
        scopedContextKey.reset();
      }
    };
  }
  registerContextKeyProvider(provider) {
    if (this.contextKeyProviders.has(provider.contextKey.key) || this.globalContextKeys.has(provider.contextKey.key)) {
      throw new Error(`A context key provider for key ${provider.contextKey.key} already exists.`);
    }
    this.contextKeyProviders.set(provider.contextKey.key, provider);
    const setContextKeyForGroups = () => {
      for (const group of this.groups) {
        this.updateRegisteredContextKey(group, provider);
      }
    };
    setContextKeyForGroups();
    const onDidChange = provider.onDidChange?.(() => setContextKeyForGroups());
    return toDisposable(() => {
      onDidChange?.dispose();
      this.globalContextKeys.delete(provider.contextKey.key);
      this.scopedContextKeys.forEach((scopedContextKeys) => scopedContextKeys.delete(provider.contextKey.key));
      this.contextKeyProviders.delete(provider.contextKey.key);
      this.registeredContextKeys.forEach((registeredContextKeys) => registeredContextKeys.delete(provider.contextKey.key));
    });
  }
  registerGroupContextKeyProvidersListeners(group) {
    const disposable = group.onDidActiveEditorChange(() => {
      for (const contextKeyProvider of this.contextKeyProviders.values()) {
        this.updateRegisteredContextKey(group, contextKeyProvider);
      }
    });
    this.contextKeyProviderDisposables.set(group.id, disposable);
  }
  updateRegisteredContextKey(group, provider) {
    let groupRegisteredContextKeys = this.registeredContextKeys.get(group.id);
    if (!groupRegisteredContextKeys) {
      groupRegisteredContextKeys = /* @__PURE__ */ new Map();
      this.registeredContextKeys.set(group.id, groupRegisteredContextKeys);
    }
    let scopedRegisteredContextKey = groupRegisteredContextKeys.get(provider.contextKey.key);
    if (!scopedRegisteredContextKey) {
      scopedRegisteredContextKey = this.bind(provider.contextKey, group);
      groupRegisteredContextKeys.set(provider.contextKey.key, scopedRegisteredContextKey);
    }
    scopedRegisteredContextKey.set(provider.getGroupContextKeyValue(group));
  }
  //#endregion
  //#region Main Editor Part Only
  get partOptions() {
    return this.mainPart.partOptions;
  }
  get onDidChangeEditorPartOptions() {
    return this.mainPart.onDidChangeEditorPartOptions;
  }
  //#endregion
};
//#endregion
//#region Lifecycle / State
EditorParts.EDITOR_PARTS_UI_STATE_STORAGE_KEY = "editorparts.state";
//#endregion
//#region Working Sets
EditorParts.EDITOR_WORKING_SETS_STORAGE_KEY = "editor.workingSets";
EditorParts = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IAuxiliaryWindowService),
  __decorateParam(4, IContextKeyService)
], EditorParts);
registerSingleton(IEditorGroupsService, EditorParts, InstantiationType.Eager);
export {
  EditorParts
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFydHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JHcm91cExheW91dCwgR3JvdXBEaXJlY3Rpb24sIEdyb3VwTG9jYXRpb24sIEdyb3VwT3JpZW50YXRpb24sIEdyb3Vwc0FycmFuZ2VtZW50LCBHcm91cHNPcmRlciwgSUF1eGlsaWFyeUVkaXRvclBhcnQsIElFZGl0b3JHcm91cENvbnRleHRLZXlQcm92aWRlciwgSUVkaXRvckRyb3BUYXJnZXREZWxlZ2F0ZSwgSUVkaXRvckdyb3Vwc1NlcnZpY2UsIElFZGl0b3JTaWRlR3JvdXAsIElFZGl0b3JXb3JraW5nU2V0LCBJRmluZEdyb3VwU2NvcGUsIElNZXJnZUdyb3VwT3B0aW9ucywgSUVkaXRvcldvcmtpbmdTZXRPcHRpb25zLCBJRWRpdG9yUGFydCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZU1hcCwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEdyb3VwSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFydCwgSUVkaXRvclBhcnRVSVN0YXRlLCBNYWluRWRpdG9yUGFydCB9IGZyb20gJy4vZWRpdG9yUGFydC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBWaWV3LCBJRWRpdG9yUGFydHNWaWV3IH0gZnJvbSAnLi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGRpc3RpbmN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IEF1eGlsaWFyeUVkaXRvclBhcnQsIElBdXhpbGlhcnlFZGl0b3JQYXJ0T3Blbk9wdGlvbnMgfSBmcm9tICcuL2F1eGlsaWFyeUVkaXRvclBhcnQuanMnO1xuaW1wb3J0IHsgTXVsdGlXaW5kb3dQYXJ0cyB9IGZyb20gJy4uLy4uL3BhcnQuanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBJU3RvcmFnZVZhbHVlQ2hhbmdlRXZlbnQsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUF1eGlsaWFyeVdpbmRvd09wZW5PcHRpb25zLCBJQXV4aWxpYXJ5V2luZG93U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2F1eGlsaWFyeVdpbmRvdy9icm93c2VyL2F1eGlsaWFyeVdpbmRvd1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5VmFsdWUsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IGlzSFRNTEVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuXG5pbnRlcmZhY2UgSUVkaXRvclBhcnRzVUlTdGF0ZSB7XG5cdHJlYWRvbmx5IGF1eGlsaWFyeTogSUF1eGlsaWFyeUVkaXRvclBhcnRTdGF0ZVtdO1xuXHRyZWFkb25seSBtcnU6IG51bWJlcltdO1xuXHQvLyBtYWluIHN0YXRlIGlzIG1hbmFnZWQgYnkgdGhlIG1haW4gcGFydFxufVxuXG5pbnRlcmZhY2UgSUF1eGlsaWFyeUVkaXRvclBhcnRTdGF0ZSBleHRlbmRzIElBdXhpbGlhcnlXaW5kb3dPcGVuT3B0aW9ucyB7XG5cdHJlYWRvbmx5IHN0YXRlOiBJRWRpdG9yUGFydFVJU3RhdGU7XG59XG5cbmludGVyZmFjZSBJRWRpdG9yV29ya2luZ1NldFN0YXRlIGV4dGVuZHMgSUVkaXRvcldvcmtpbmdTZXQge1xuXHRyZWFkb25seSBtYWluOiBJRWRpdG9yUGFydFVJU3RhdGU7XG5cdHJlYWRvbmx5IGF1eGlsaWFyeTogSUVkaXRvclBhcnRzVUlTdGF0ZTtcbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvclBhcnRzIGV4dGVuZHMgTXVsdGlXaW5kb3dQYXJ0czxFZGl0b3JQYXJ0PiBpbXBsZW1lbnRzIElFZGl0b3JHcm91cHNTZXJ2aWNlLCBJRWRpdG9yUGFydHNWaWV3IHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBtYWluUGFydDogTWFpbkVkaXRvclBhcnQ7XG5cblx0cHJpdmF0ZSBtb3N0UmVjZW50QWN0aXZlUGFydHM6IE1haW5FZGl0b3JQYXJ0W107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElBdXhpbGlhcnlXaW5kb3dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYXV4aWxpYXJ5V2luZG93U2VydmljZTogSUF1eGlsaWFyeVdpbmRvd1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoJ3dvcmtiZW5jaC5lZGl0b3JQYXJ0cycsIHRoZW1lU2VydmljZSwgc3RvcmFnZVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5tYWluUGFydCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3JlYXRlTWFpbkVkaXRvclBhcnQoKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZWdpc3RlclBhcnQodGhpcy5tYWluUGFydCkpO1xuXG5cdFx0dGhpcy5tb3N0UmVjZW50QWN0aXZlUGFydHMgPSBbdGhpcy5tYWluUGFydF07XG5cblx0XHR0aGlzLnJlc3RvcmVQYXJ0cygpO1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZU1lbWVudG9WYWx1ZShTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCB0aGlzLl9zdG9yZSkoZSA9PiB0aGlzLm9uRGlkQ2hhbmdlTWVtZW50b1N0YXRlKGUpKSk7XG5cdFx0dGhpcy53aGVuUmVhZHkudGhlbigoKSA9PiB0aGlzLnJlZ2lzdGVyR3JvdXBzQ29udGV4dEtleUxpc3RlbmVycygpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVNYWluRWRpdG9yUGFydCgpOiBNYWluRWRpdG9yUGFydCB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFpbkVkaXRvclBhcnQsIHRoaXMpO1xuXHR9XG5cblx0Ly8jcmVnaW9uIFNjb3BlZCBJbnN0YW50aWF0aW9uIFNlcnZpY2VzXG5cblx0cHJpdmF0ZSByZWFkb25seSBtYXBQYXJ0VG9JbnN0YW50aWF0aW9uU2VydmljZSA9IG5ldyBNYXA8bnVtYmVyIC8qIHdpbmRvdyBJRCAqLywgSUluc3RhbnRpYXRpb25TZXJ2aWNlPigpO1xuXG5cdGdldFNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlKHBhcnQ6IElFZGl0b3JQYXJ0KTogSUluc3RhbnRpYXRpb25TZXJ2aWNlIHtcblx0XHRpZiAocGFydCA9PT0gdGhpcy5tYWluUGFydCkge1xuXHRcdFx0aWYgKCF0aGlzLm1hcFBhcnRUb0luc3RhbnRpYXRpb25TZXJ2aWNlLmhhcyhwYXJ0LndpbmRvd0lkKSkge1xuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTsgLy8gdXNpbmcgYGludm9rZUZ1bmN0aW9uYCB0byBnZXQgaG9sZCBvZiBgSUVkaXRvclNlcnZpY2VgIGxhemlseVxuXG5cdFx0XHRcdFx0dGhpcy5tYXBQYXJ0VG9JbnN0YW50aWF0aW9uU2VydmljZS5zZXQocGFydC53aW5kb3dJZCwgdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVDaGlsZChuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRcdFx0XHRbSUVkaXRvclNlcnZpY2UsIGVkaXRvclNlcnZpY2UuY3JlYXRlU2NvcGVkKCdtYWluJywgdGhpcy5fc3RvcmUpXVxuXHRcdFx0XHRcdCkpKSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLm1hcFBhcnRUb0luc3RhbnRpYXRpb25TZXJ2aWNlLmdldChwYXJ0LndpbmRvd0lkKSA/PyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEF1eGlsaWFyeSBFZGl0b3IgUGFydHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENyZWF0ZUF1eGlsaWFyeUVkaXRvclBhcnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQXV4aWxpYXJ5RWRpdG9yUGFydD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydCA9IHRoaXMuX29uRGlkQ3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydC5ldmVudDtcblxuXHRhc3luYyBjcmVhdGVBdXhpbGlhcnlFZGl0b3JQYXJ0KG9wdGlvbnM/OiBJQXV4aWxpYXJ5RWRpdG9yUGFydE9wZW5PcHRpb25zKTogUHJvbWlzZTxJQXV4aWxpYXJ5RWRpdG9yUGFydD4ge1xuXHRcdGNvbnN0IHsgcGFydCwgaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzIH0gPSBhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEF1eGlsaWFyeUVkaXRvclBhcnQsIHRoaXMpLmNyZWF0ZSh0aGlzLmdldEdyb3Vwc0xhYmVsKHRoaXMuX3BhcnRzLnNpemUpLCBvcHRpb25zKTtcblxuXHRcdC8vIEtlZXAgaW5zdGFudGlhdGlvbiBzZXJ2aWNlXG5cdFx0dGhpcy5tYXBQYXJ0VG9JbnN0YW50aWF0aW9uU2VydmljZS5zZXQocGFydC53aW5kb3dJZCwgaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5tYXBQYXJ0VG9JbnN0YW50aWF0aW9uU2VydmljZS5kZWxldGUocGFydC53aW5kb3dJZCkpKTtcblxuXHRcdC8vIEV2ZW50c1xuXHRcdHRoaXMuX29uRGlkQWRkR3JvdXAuZmlyZShwYXJ0LmFjdGl2ZUdyb3VwKTtcblxuXHRcdHRoaXMuX29uRGlkQ3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydC5maXJlKHBhcnQpO1xuXG5cdFx0cmV0dXJuIHBhcnQ7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gUmVnaXN0cmF0aW9uXG5cblx0b3ZlcnJpZGUgcmVnaXN0ZXJQYXJ0KHBhcnQ6IEVkaXRvclBhcnQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzdXBlci5yZWdpc3RlclBhcnQocGFydCkpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckVkaXRvclBhcnRMaXN0ZW5lcnMocGFydCwgZGlzcG9zYWJsZXMpO1xuXG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVzO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVucmVnaXN0ZXJQYXJ0KHBhcnQ6IEVkaXRvclBhcnQpOiB2b2lkIHtcblx0XHRzdXBlci51bnJlZ2lzdGVyUGFydChwYXJ0KTtcblxuXHRcdC8vIE5vdGlmeSBhbGwgcGFydHMgYWJvdXQgYSBncm91cHMgbGFiZWwgY2hhbmdlXG5cdFx0Ly8gZ2l2ZW4gaXQgaXMgY29tcHV0ZWQgYmFzZWQgb24gdGhlIGluZGV4XG5cblx0XHR0aGlzLnBhcnRzLmZvckVhY2goKHBhcnQsIGluZGV4KSA9PiB7XG5cdFx0XHRpZiAocGFydCA9PT0gdGhpcy5tYWluUGFydCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHBhcnQubm90aWZ5R3JvdXBzTGFiZWxDaGFuZ2UodGhpcy5nZXRHcm91cHNMYWJlbChpbmRleCkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckVkaXRvclBhcnRMaXN0ZW5lcnMocGFydDogRWRpdG9yUGFydCwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IHZvaWQge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwYXJ0Lm9uRGlkRm9jdXMoKCkgPT4ge1xuXHRcdFx0dGhpcy5kb1VwZGF0ZU1vc3RSZWNlbnRBY3RpdmUocGFydCwgdHJ1ZSk7XG5cblx0XHRcdGlmICh0aGlzLl9wYXJ0cy5zaXplID4gMSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZEFjdGl2ZUdyb3VwQ2hhbmdlLmZpcmUodGhpcy5hY3RpdmVHcm91cCk7IC8vIHRoaXMgY2FuIG9ubHkgaGFwcGVuIHdoZW4gd2UgaGF2ZSBtb3JlIHRoYW4gMSBlZGl0b3IgcGFydFxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuZG9VcGRhdGVNb3N0UmVjZW50QWN0aXZlKHBhcnQpKSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocGFydC5vbkRpZENoYW5nZUFjdGl2ZUdyb3VwKGdyb3VwID0+IHRoaXMuX29uRGlkQWN0aXZlR3JvdXBDaGFuZ2UuZmlyZShncm91cCkpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocGFydC5vbkRpZEFkZEdyb3VwKGdyb3VwID0+IHRoaXMuX29uRGlkQWRkR3JvdXAuZmlyZShncm91cCkpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocGFydC5vbkRpZFJlbW92ZUdyb3VwKGdyb3VwID0+IHRoaXMuX29uRGlkUmVtb3ZlR3JvdXAuZmlyZShncm91cCkpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocGFydC5vbkRpZE1vdmVHcm91cChncm91cCA9PiB0aGlzLl9vbkRpZE1vdmVHcm91cC5maXJlKGdyb3VwKSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwYXJ0Lm9uRGlkQWN0aXZhdGVHcm91cChncm91cCA9PiB0aGlzLl9vbkRpZEFjdGl2YXRlR3JvdXAuZmlyZShncm91cCkpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocGFydC5vbkRpZENoYW5nZUdyb3VwTWF4aW1pemVkKG1heGltaXplZCA9PiB0aGlzLl9vbkRpZENoYW5nZUdyb3VwTWF4aW1pemVkLmZpcmUobWF4aW1pemVkKSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHBhcnQub25EaWRDaGFuZ2VHcm91cEluZGV4KGdyb3VwID0+IHRoaXMuX29uRGlkQ2hhbmdlR3JvdXBJbmRleC5maXJlKGdyb3VwKSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwYXJ0Lm9uRGlkQ2hhbmdlR3JvdXBMb2NrZWQoZ3JvdXAgPT4gdGhpcy5fb25EaWRDaGFuZ2VHcm91cExvY2tlZC5maXJlKGdyb3VwKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1VwZGF0ZU1vc3RSZWNlbnRBY3RpdmUocGFydDogRWRpdG9yUGFydCwgbWFrZU1vc3RSZWNlbnRseUFjdGl2ZT86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMubW9zdFJlY2VudEFjdGl2ZVBhcnRzLmluZGV4T2YocGFydCk7XG5cblx0XHQvLyBSZW1vdmUgZnJvbSBNUlUgbGlzdFxuXHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdHRoaXMubW9zdFJlY2VudEFjdGl2ZVBhcnRzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIHRvIGZyb250IGFzIG5lZWRlZFxuXHRcdGlmIChtYWtlTW9zdFJlY2VudGx5QWN0aXZlKSB7XG5cdFx0XHR0aGlzLm1vc3RSZWNlbnRBY3RpdmVQYXJ0cy51bnNoaWZ0KHBhcnQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0R3JvdXBzTGFiZWwoaW5kZXg6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdncm91cExhYmVsJywgXCJXaW5kb3cgezB9XCIsIGluZGV4ICsgMSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gSGVscGVyc1xuXG5cdG92ZXJyaWRlIGdldFBhcnQoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIpOiBFZGl0b3JQYXJ0O1xuXHRvdmVycmlkZSBnZXRQYXJ0KGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogRWRpdG9yUGFydDtcblx0b3ZlcnJpZGUgZ2V0UGFydChncm91cE9yRWxlbWVudDogSUVkaXRvckdyb3VwVmlldyB8IEdyb3VwSWRlbnRpZmllciB8IEhUTUxFbGVtZW50KTogRWRpdG9yUGFydCB7XG5cdFx0aWYgKHRoaXMuX3BhcnRzLnNpemUgPiAxKSB7XG5cdFx0XHRpZiAoaXNIVE1MRWxlbWVudChncm91cE9yRWxlbWVudCkpIHtcblx0XHRcdFx0Y29uc3QgZWxlbWVudCA9IGdyb3VwT3JFbGVtZW50O1xuXG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFBhcnRCeURvY3VtZW50KGVsZW1lbnQub3duZXJEb2N1bWVudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBncm91cCA9IGdyb3VwT3JFbGVtZW50O1xuXG5cdFx0XHRcdGxldCBpZDogR3JvdXBJZGVudGlmaWVyO1xuXHRcdFx0XHRpZiAodHlwZW9mIGdyb3VwID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdGlkID0gZ3JvdXA7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWQgPSBncm91cC5pZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGZvciAoY29uc3QgcGFydCBvZiB0aGlzLl9wYXJ0cykge1xuXHRcdFx0XHRcdGlmIChwYXJ0Lmhhc0dyb3VwKGlkKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHBhcnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMubWFpblBhcnQ7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gTGlmZWN5Y2xlIC8gU3RhdGVcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBFRElUT1JfUEFSVFNfVUlfU1RBVEVfU1RPUkFHRV9LRVkgPSAnZWRpdG9ycGFydHMuc3RhdGUnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlTWVtZW50byA9IHRoaXMuZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXG5cdHByaXZhdGUgX2lzUmVhZHkgPSBmYWxzZTtcblx0Z2V0IGlzUmVhZHkoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9pc1JlYWR5OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSB3aGVuUmVhZHlQcm9taXNlID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRyZWFkb25seSB3aGVuUmVhZHkgPSB0aGlzLndoZW5SZWFkeVByb21pc2UucDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHdoZW5SZXN0b3JlZFByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IHdoZW5SZXN0b3JlZCA9IHRoaXMud2hlblJlc3RvcmVkUHJvbWlzZS5wO1xuXG5cdHByaXZhdGUgYXN5bmMgcmVzdG9yZVBhcnRzKCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gSm9pbiBvbiB0aGUgbWFpbiBwYXJ0IGJlaW5nIHJlYWR5IHRvIHBpY2tcblx0XHQvLyB0aGUgcmlnaHQgbW9tZW50IHRvIGJlZ2luIHJlc3RvcmluZy5cblx0XHQvLyBUaGUgbWFpbiBwYXJ0IGlzIGF1dG9tYXRpY2FsbHkgYmVpbmcgY3JlYXRlZFxuXHRcdC8vIGFzIHBhcnQgb2YgdGhlIG92ZXJhbGwgc3RhcnR1cCBwcm9jZXNzLlxuXHRcdGF3YWl0IHRoaXMubWFpblBhcnQud2hlblJlYWR5O1xuXG5cdFx0Ly8gT25seSBhdHRlbXB0IHRvIHJlc3RvcmUgYXV4aWxpYXJ5IGVkaXRvciBwYXJ0c1xuXHRcdC8vIHdoZW4gdGhlIG1haW4gcGFydCBkaWQgcmVzdG9yZS4gSXQgaXMgcG9zc2libGVcblx0XHQvLyB0aGF0IHJlc3RvcmluZyB3YXMgbm90IGF0dGVtcHRlZCBiZWNhdXNlIHNwZWNpZmljXG5cdFx0Ly8gZWRpdG9ycyB3ZXJlIG9wZW5lZC5cblx0XHRpZiAodGhpcy5tYWluUGFydC53aWxsUmVzdG9yZVN0YXRlKSB7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMubG9hZFN0YXRlKCk7XG5cdFx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5yZXN0b3JlU3RhdGUoc3RhdGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG1vc3RSZWNlbnRBY3RpdmVQYXJ0ID0gdGhpcy5tb3N0UmVjZW50QWN0aXZlUGFydHMuYXQoMCk7XG5cdFx0bW9zdFJlY2VudEFjdGl2ZVBhcnQ/LmFjdGl2ZUdyb3VwLmZvY3VzKCk7XG5cblx0XHR0aGlzLl9pc1JlYWR5ID0gdHJ1ZTtcblx0XHR0aGlzLndoZW5SZWFkeVByb21pc2UuY29tcGxldGUoKTtcblxuXHRcdC8vIEF3YWl0IHJlc3RvcmVkXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHRoaXMucGFydHMubWFwKHBhcnQgPT4gcGFydC53aGVuUmVzdG9yZWQpKTtcblx0XHR0aGlzLndoZW5SZXN0b3JlZFByb21pc2UuY29tcGxldGUoKTtcblx0fVxuXG5cdHByaXZhdGUgbG9hZFN0YXRlKCk6IElFZGl0b3JQYXJ0c1VJU3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLndvcmtzcGFjZU1lbWVudG9bRWRpdG9yUGFydHMuRURJVE9SX1BBUlRTX1VJX1NUQVRFX1NUT1JBR0VfS0VZXTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLmNyZWF0ZVN0YXRlKCk7XG5cdFx0aWYgKHN0YXRlLmF1eGlsaWFyeS5sZW5ndGggPT09IDApIHtcblx0XHRcdGRlbGV0ZSB0aGlzLndvcmtzcGFjZU1lbWVudG9bRWRpdG9yUGFydHMuRURJVE9SX1BBUlRTX1VJX1NUQVRFX1NUT1JBR0VfS0VZXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy53b3Jrc3BhY2VNZW1lbnRvW0VkaXRvclBhcnRzLkVESVRPUl9QQVJUU19VSV9TVEFURV9TVE9SQUdFX0tFWV0gPSBzdGF0ZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVN0YXRlKCk6IElFZGl0b3JQYXJ0c1VJU3RhdGUge1xuXHRcdHJldHVybiB7XG5cdFx0XHRhdXhpbGlhcnk6IHRoaXMucGFydHMuZmlsdGVyKHBhcnQgPT4gcGFydCAhPT0gdGhpcy5tYWluUGFydCkubWFwKHBhcnQgPT4ge1xuXHRcdFx0XHRjb25zdCBhdXhpbGlhcnlXaW5kb3cgPSB0aGlzLmF1eGlsaWFyeVdpbmRvd1NlcnZpY2UuZ2V0V2luZG93KHBhcnQud2luZG93SWQpO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3RhdGU6IHBhcnQuY3JlYXRlU3RhdGUoKSxcblx0XHRcdFx0XHQuLi5hdXhpbGlhcnlXaW5kb3c/LmNyZWF0ZVN0YXRlKClcblx0XHRcdFx0fTtcblx0XHRcdH0pLFxuXHRcdFx0bXJ1OiB0aGlzLm1vc3RSZWNlbnRBY3RpdmVQYXJ0cy5tYXAocGFydCA9PiB0aGlzLnBhcnRzLmluZGV4T2YocGFydCkpXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzdG9yZVN0YXRlKHN0YXRlOiBJRWRpdG9yUGFydHNVSVN0YXRlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHN0YXRlLmF1eGlsaWFyeS5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGF1eGlsaWFyeUVkaXRvclBhcnRQcm9taXNlczogUHJvbWlzZTxJQXV4aWxpYXJ5RWRpdG9yUGFydD5bXSA9IFtdO1xuXG5cdFx0XHQvLyBDcmVhdGUgYXV4aWxpYXJ5IGVkaXRvciBwYXJ0c1xuXHRcdFx0Zm9yIChjb25zdCBhdXhpbGlhcnlFZGl0b3JQYXJ0U3RhdGUgb2Ygc3RhdGUuYXV4aWxpYXJ5KSB7XG5cdFx0XHRcdGF1eGlsaWFyeUVkaXRvclBhcnRQcm9taXNlcy5wdXNoKHRoaXMuY3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydChhdXhpbGlhcnlFZGl0b3JQYXJ0U3RhdGUpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQXdhaXQgY3JlYXRpb25cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChhdXhpbGlhcnlFZGl0b3JQYXJ0UHJvbWlzZXMpO1xuXG5cdFx0XHQvLyBVcGRhdGUgTVJVIGxpc3Rcblx0XHRcdGlmIChzdGF0ZS5tcnUubGVuZ3RoID09PSB0aGlzLnBhcnRzLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLm1vc3RSZWNlbnRBY3RpdmVQYXJ0cyA9IHN0YXRlLm1ydS5tYXAoaW5kZXggPT4gdGhpcy5wYXJ0c1tpbmRleF0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5tb3N0UmVjZW50QWN0aXZlUGFydHMgPSBbLi4udGhpcy5wYXJ0c107XG5cdFx0XHR9XG5cblx0XHRcdC8vIEF3YWl0IHJlYWR5XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQodGhpcy5wYXJ0cy5tYXAocGFydCA9PiBwYXJ0LndoZW5SZWFkeSkpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBoYXNSZXN0b3JhYmxlU3RhdGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMucGFydHMuc29tZShwYXJ0ID0+IHBhcnQuaGFzUmVzdG9yYWJsZVN0YXRlKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VNZW1lbnRvU3RhdGUoZTogSVN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUuZXh0ZXJuYWwgJiYgZS5zY29wZSA9PT0gU3RvcmFnZVNjb3BlLldPUktTUEFDRSkge1xuXHRcdFx0dGhpcy5yZWxvYWRNZW1lbnRvKGUuc2NvcGUpO1xuXG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMubG9hZFN0YXRlKCk7XG5cdFx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdFx0dGhpcy5hcHBseVN0YXRlKHN0YXRlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFwcGx5U3RhdGUoc3RhdGU6IElFZGl0b3JQYXJ0c1VJU3RhdGUgfCAnZW1wdHknKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHQvLyBCZWZvcmUgY2xvc2luZyB3aW5kb3dzLCB0cnkgdG8gY2xvc2UgYXMgbWFueSBlZGl0b3JzIGFzXG5cdFx0Ly8gcG9zc2libGUsIGJ1dCBza2lwIG92ZXIgdGhvc2UgdGhhdCB3b3VsZCB0cmlnZ2VyIGEgZGlhbG9nXG5cdFx0Ly8gKGZvciBleGFtcGxlIHdoZW4gYmVpbmcgZGlydHkpLiBUaGlzIGlzIHRvIGJlIGFibGUgdG8gaGF2ZVxuXHRcdC8vIHRoZW0gbWVyZ2UgaW50byB0aGUgbWFpbiBwYXJ0LlxuXG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHRoaXMucGFydHMpIHtcblx0XHRcdGlmIChwYXJ0ID09PSB0aGlzLm1haW5QYXJ0KSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBtYWluIHBhcnQgdGFrZXMgY2FyZSBvbiBpdHMgb3duXG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgcGFydC5nZXRHcm91cHMoR3JvdXBzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpKSB7XG5cdFx0XHRcdGF3YWl0IGdyb3VwLmNsb3NlQWxsRWRpdG9ycyh7IGV4Y2x1ZGVDb25maXJtaW5nOiB0cnVlIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjbG9zZWQgPSAocGFydCBhcyB1bmtub3duIGFzIElBdXhpbGlhcnlFZGl0b3JQYXJ0KS5jbG9zZSgpOyAvLyB3aWxsIG1vdmUgcmVtYWluaW5nIGVkaXRvcnMgdG8gbWFpbiBwYXJ0XG5cdFx0XHRpZiAoIWNsb3NlZCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHRoaXMgaW5kaWNhdGVzIHRoYXQgY2xvc2luZyB3YXMgdmV0b2VkXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmVzdG9yZSBhdXhpbGlhcnkgc3RhdGUgdW5sZXNzIHdlIGFyZSBpbiBhbiBlbXB0eSBzdGF0ZVxuXHRcdGlmIChzdGF0ZSAhPT0gJ2VtcHR5Jykge1xuXHRcdFx0YXdhaXQgdGhpcy5yZXN0b3JlU3RhdGUoc3RhdGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIFdvcmtpbmcgU2V0c1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEVESVRPUl9XT1JLSU5HX1NFVFNfU1RPUkFHRV9LRVkgPSAnZWRpdG9yLndvcmtpbmdTZXRzJztcblxuXHRwcml2YXRlIGVkaXRvcldvcmtpbmdTZXRzOiBJRWRpdG9yV29ya2luZ1NldFN0YXRlW10gPSAoKCkgPT4ge1xuXHRcdGNvbnN0IHdvcmtpbmdTZXRzUmF3ID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoRWRpdG9yUGFydHMuRURJVE9SX1dPUktJTkdfU0VUU19TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0aWYgKHdvcmtpbmdTZXRzUmF3KSB7XG5cdFx0XHRyZXR1cm4gSlNPTi5wYXJzZSh3b3JraW5nU2V0c1Jhdyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtdO1xuXHR9KSgpO1xuXG5cdHNhdmVXb3JraW5nU2V0KG5hbWU6IHN0cmluZyk6IElFZGl0b3JXb3JraW5nU2V0IHtcblx0XHRjb25zdCB3b3JraW5nU2V0OiBJRWRpdG9yV29ya2luZ1NldFN0YXRlID0ge1xuXHRcdFx0aWQ6IGdlbmVyYXRlVXVpZCgpLFxuXHRcdFx0bmFtZSxcblx0XHRcdG1haW46IHRoaXMubWFpblBhcnQuY3JlYXRlU3RhdGUoKSxcblx0XHRcdGF1eGlsaWFyeTogdGhpcy5jcmVhdGVTdGF0ZSgpXG5cdFx0fTtcblxuXHRcdHRoaXMuZWRpdG9yV29ya2luZ1NldHMucHVzaCh3b3JraW5nU2V0KTtcblxuXHRcdHRoaXMuc2F2ZVdvcmtpbmdTZXRzKCk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IHdvcmtpbmdTZXQuaWQsXG5cdFx0XHRuYW1lOiB3b3JraW5nU2V0Lm5hbWVcblx0XHR9O1xuXHR9XG5cblx0Z2V0V29ya2luZ1NldHMoKTogSUVkaXRvcldvcmtpbmdTZXRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZWRpdG9yV29ya2luZ1NldHMubWFwKHdvcmtpbmdTZXQgPT4gKHsgaWQ6IHdvcmtpbmdTZXQuaWQsIG5hbWU6IHdvcmtpbmdTZXQubmFtZSB9KSk7XG5cdH1cblxuXHRkZWxldGVXb3JraW5nU2V0KHdvcmtpbmdTZXQ6IElFZGl0b3JXb3JraW5nU2V0KTogdm9pZCB7XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLmluZGV4T2ZXb3JraW5nU2V0KHdvcmtpbmdTZXQpO1xuXHRcdGlmICh0eXBlb2YgaW5kZXggPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLmVkaXRvcldvcmtpbmdTZXRzLnNwbGljZShpbmRleCwgMSk7XG5cblx0XHRcdHRoaXMuc2F2ZVdvcmtpbmdTZXRzKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgYXBwbHlXb3JraW5nU2V0KHdvcmtpbmdTZXQ6IElFZGl0b3JXb3JraW5nU2V0IHwgJ2VtcHR5Jywgb3B0aW9ucz86IElFZGl0b3JXb3JraW5nU2V0T3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGxldCB3b3JraW5nU2V0U3RhdGU6IElFZGl0b3JXb3JraW5nU2V0U3RhdGUgfCAnZW1wdHknIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh3b3JraW5nU2V0ID09PSAnZW1wdHknKSB7XG5cdFx0XHR3b3JraW5nU2V0U3RhdGUgPSAnZW1wdHknO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR3b3JraW5nU2V0U3RhdGUgPSB0aGlzLmVkaXRvcldvcmtpbmdTZXRzW3RoaXMuaW5kZXhPZldvcmtpbmdTZXQod29ya2luZ1NldCkgPz8gLTFdO1xuXHRcdH1cblxuXHRcdGlmICghd29ya2luZ1NldFN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gQXBwbHkgc3RhdGU6IGJlZ2luIHdpdGggYXV4aWxpYXJ5IHdpbmRvd3MgZmlyc3QgYmVjYXVzZSBpdCBoZWxwcyB0byBrZWVwXG5cdFx0Ly8gZWRpdG9ycyBhcm91bmQgdGhhdCBuZWVkIGNvbmZpcm1hdGlvbiBieSBtb3ZpbmcgdGhlbSBpbnRvIHRoZSBtYWluIHBhcnQuXG5cdFx0Ly8gQWxzbywgaW4gcmFyZSBjYXNlcywgdGhlIGF1eGlsaWFyeSBwYXJ0IG1heSBub3QgYmUgYWJsZSB0byBhcHBseSB0aGUgc3RhdGVcblx0XHQvLyBmb3IgY2VydGFpbiBlZGl0b3JzIHRoYXQgY2Fubm90IG1vdmUgdG8gdGhlIG1haW4gcGFydC5cblx0XHRjb25zdCBhcHBsaWVkID0gYXdhaXQgdGhpcy5hcHBseVN0YXRlKHdvcmtpbmdTZXRTdGF0ZSA9PT0gJ2VtcHR5JyA/IHdvcmtpbmdTZXRTdGF0ZSA6IHdvcmtpbmdTZXRTdGF0ZS5hdXhpbGlhcnkpO1xuXHRcdGlmICghYXBwbGllZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLm1haW5QYXJ0LmFwcGx5U3RhdGUod29ya2luZ1NldFN0YXRlID09PSAnZW1wdHknID8gd29ya2luZ1NldFN0YXRlIDogd29ya2luZ1NldFN0YXRlLm1haW4sIG9wdGlvbnMpO1xuXG5cdFx0Ly8gUmVzdG9yZSBGb2N1cyB1bmxlc3MgaW5zdHJ1Y3RlZCBvdGhlcndpc2Vcblx0XHRpZiAoIW9wdGlvbnM/LnByZXNlcnZlRm9jdXMpIHtcblx0XHRcdGNvbnN0IG1vc3RSZWNlbnRBY3RpdmVQYXJ0ID0gdGhpcy5tb3N0UmVjZW50QWN0aXZlUGFydHMuYXQoMCk7XG5cdFx0XHRpZiAobW9zdFJlY2VudEFjdGl2ZVBhcnQpIHtcblx0XHRcdFx0YXdhaXQgbW9zdFJlY2VudEFjdGl2ZVBhcnQud2hlblJlYWR5O1xuXHRcdFx0XHRtb3N0UmVjZW50QWN0aXZlUGFydC5hY3RpdmVHcm91cC5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBpbmRleE9mV29ya2luZ1NldCh3b3JraW5nU2V0OiBJRWRpdG9yV29ya2luZ1NldCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmVkaXRvcldvcmtpbmdTZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAodGhpcy5lZGl0b3JXb3JraW5nU2V0c1tpXS5pZCA9PT0gd29ya2luZ1NldC5pZCkge1xuXHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBzYXZlV29ya2luZ1NldHMoKTogdm9pZCB7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShFZGl0b3JQYXJ0cy5FRElUT1JfV09SS0lOR19TRVRTX1NUT1JBR0VfS0VZLCBKU09OLnN0cmluZ2lmeSh0aGlzLmVkaXRvcldvcmtpbmdTZXRzKSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBFdmVudHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEFjdGl2ZUdyb3VwQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvckdyb3VwVmlldz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQWN0aXZlR3JvdXAgPSB0aGlzLl9vbkRpZEFjdGl2ZUdyb3VwQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQWRkR3JvdXAgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRWRpdG9yR3JvdXBWaWV3PigpKTtcblx0cmVhZG9ubHkgb25EaWRBZGRHcm91cCA9IHRoaXMuX29uRGlkQWRkR3JvdXAuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW1vdmVHcm91cCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFZGl0b3JHcm91cFZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlbW92ZUdyb3VwID0gdGhpcy5fb25EaWRSZW1vdmVHcm91cC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZE1vdmVHcm91cCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFZGl0b3JHcm91cFZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZE1vdmVHcm91cCA9IHRoaXMuX29uRGlkTW92ZUdyb3VwLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQWN0aXZhdGVHcm91cCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFZGl0b3JHcm91cFZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZEFjdGl2YXRlR3JvdXAgPSB0aGlzLl9vbkRpZEFjdGl2YXRlR3JvdXAuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VHcm91cEluZGV4ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvckdyb3VwVmlldz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlR3JvdXBJbmRleCA9IHRoaXMuX29uRGlkQ2hhbmdlR3JvdXBJbmRleC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUdyb3VwTG9ja2VkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUVkaXRvckdyb3VwVmlldz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlR3JvdXBMb2NrZWQgPSB0aGlzLl9vbkRpZENoYW5nZUdyb3VwTG9ja2VkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlR3JvdXBNYXhpbWl6ZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VHcm91cE1heGltaXplZCA9IHRoaXMuX29uRGlkQ2hhbmdlR3JvdXBNYXhpbWl6ZWQuZXZlbnQ7XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEdyb3VwIE1hbmFnZW1lbnRcblxuXHRnZXQgYWN0aXZlR3JvdXAoKTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0cmV0dXJuIHRoaXMuYWN0aXZlUGFydC5hY3RpdmVHcm91cDtcblx0fVxuXG5cdGdldCBzaWRlR3JvdXAoKTogSUVkaXRvclNpZGVHcm91cCB7XG5cdFx0cmV0dXJuIHRoaXMuYWN0aXZlUGFydC5zaWRlR3JvdXA7XG5cdH1cblxuXHRnZXQgZ3JvdXBzKCk6IElFZGl0b3JHcm91cFZpZXdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0R3JvdXBzKCk7XG5cdH1cblxuXHRnZXQgY291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5ncm91cHMubGVuZ3RoO1xuXHR9XG5cblx0Z2V0R3JvdXBzKG9yZGVyID0gR3JvdXBzT3JkZXIuQ1JFQVRJT05fVElNRSk6IElFZGl0b3JHcm91cFZpZXdbXSB7XG5cdFx0aWYgKHRoaXMuX3BhcnRzLnNpemUgPiAxKSB7XG5cdFx0XHRsZXQgcGFydHM6IEVkaXRvclBhcnRbXTtcblx0XHRcdHN3aXRjaCAob3JkZXIpIHtcblx0XHRcdFx0Y2FzZSBHcm91cHNPcmRlci5HUklEX0FQUEVBUkFOQ0U6IC8vIHdlIGN1cnJlbnRseSBkbyBub3QgaGF2ZSBhIHdheSB0byBjb21wdXRlIGJ5IGFwcGVhcmFuY2Ugb3ZlciBtdWx0aXBsZSB3aW5kb3dzXG5cdFx0XHRcdGNhc2UgR3JvdXBzT3JkZXIuQ1JFQVRJT05fVElNRTpcblx0XHRcdFx0XHRwYXJ0cyA9IHRoaXMucGFydHM7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgR3JvdXBzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkU6XG5cdFx0XHRcdFx0cGFydHMgPSBkaXN0aW5jdChbLi4udGhpcy5tb3N0UmVjZW50QWN0aXZlUGFydHMsIC4uLnRoaXMucGFydHNdKTsgLy8gYWx3YXlzIGVuc3VyZSBhbGwgcGFydHMgYXJlIGluY2x1ZGVkXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBwYXJ0cy5tYXAocGFydCA9PiBwYXJ0LmdldEdyb3VwcyhvcmRlcikpLmZsYXQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5tYWluUGFydC5nZXRHcm91cHMob3JkZXIpO1xuXHR9XG5cblx0Z2V0R3JvdXAoaWRlbnRpZmllcjogR3JvdXBJZGVudGlmaWVyKTogSUVkaXRvckdyb3VwVmlldyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX3BhcnRzLnNpemUgPiAxKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHBhcnQgb2YgdGhpcy5fcGFydHMpIHtcblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBwYXJ0LmdldEdyb3VwKGlkZW50aWZpZXIpO1xuXHRcdFx0XHRpZiAoZ3JvdXApIHtcblx0XHRcdFx0XHRyZXR1cm4gZ3JvdXA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5tYWluUGFydC5nZXRHcm91cChpZGVudGlmaWVyKTtcblx0fVxuXG5cdHByaXZhdGUgYXNzZXJ0R3JvdXBWaWV3KGdyb3VwOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyKTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0bGV0IGdyb3VwVmlldzogSUVkaXRvckdyb3VwVmlldyB8IHVuZGVmaW5lZDtcblx0XHRpZiAodHlwZW9mIGdyb3VwID09PSAnbnVtYmVyJykge1xuXHRcdFx0Z3JvdXBWaWV3ID0gdGhpcy5nZXRHcm91cChncm91cCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGdyb3VwVmlldyA9IGdyb3VwO1xuXHRcdH1cblxuXHRcdGlmICghZ3JvdXBWaWV3KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZWRpdG9yIGdyb3VwIHByb3ZpZGVkIScpO1xuXHRcdH1cblxuXHRcdHJldHVybiBncm91cFZpZXc7XG5cdH1cblxuXHRhY3RpdmF0ZUdyb3VwKGdyb3VwOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyKTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0UGFydChncm91cCkuYWN0aXZhdGVHcm91cChncm91cCk7XG5cdH1cblxuXHRnZXRTaXplKGdyb3VwOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyKTogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHtcblx0XHRyZXR1cm4gdGhpcy5nZXRQYXJ0KGdyb3VwKS5nZXRTaXplKGdyb3VwKTtcblx0fVxuXG5cdHNldFNpemUoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIHNpemU6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSk6IHZvaWQge1xuXHRcdHRoaXMuZ2V0UGFydChncm91cCkuc2V0U2l6ZShncm91cCwgc2l6ZSk7XG5cdH1cblxuXHRhcnJhbmdlR3JvdXBzKGFycmFuZ2VtZW50OiBHcm91cHNBcnJhbmdlbWVudCwgZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIgPSB0aGlzLmFjdGl2ZVBhcnQuYWN0aXZlR3JvdXApOiB2b2lkIHtcblx0XHR0aGlzLmdldFBhcnQoZ3JvdXApLmFycmFuZ2VHcm91cHMoYXJyYW5nZW1lbnQsIGdyb3VwKTtcblx0fVxuXG5cdHRvZ2dsZU1heGltaXplR3JvdXAoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIgPSB0aGlzLmFjdGl2ZVBhcnQuYWN0aXZlR3JvdXApOiB2b2lkIHtcblx0XHR0aGlzLmdldFBhcnQoZ3JvdXApLnRvZ2dsZU1heGltaXplR3JvdXAoZ3JvdXApO1xuXHR9XG5cblx0dG9nZ2xlRXhwYW5kR3JvdXAoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIgPSB0aGlzLmFjdGl2ZVBhcnQuYWN0aXZlR3JvdXApOiB2b2lkIHtcblx0XHR0aGlzLmdldFBhcnQoZ3JvdXApLnRvZ2dsZUV4cGFuZEdyb3VwKGdyb3VwKTtcblx0fVxuXG5cdHJlc3RvcmVHcm91cChncm91cDogSUVkaXRvckdyb3VwVmlldyB8IEdyb3VwSWRlbnRpZmllcik6IElFZGl0b3JHcm91cFZpZXcge1xuXHRcdHJldHVybiB0aGlzLmdldFBhcnQoZ3JvdXApLnJlc3RvcmVHcm91cChncm91cCk7XG5cdH1cblxuXHRhcHBseUxheW91dChsYXlvdXQ6IEVkaXRvckdyb3VwTGF5b3V0KTogdm9pZCB7XG5cdFx0dGhpcy5hY3RpdmVQYXJ0LmFwcGx5TGF5b3V0KGxheW91dCk7XG5cdH1cblxuXHRnZXRMYXlvdXQoKTogRWRpdG9yR3JvdXBMYXlvdXQge1xuXHRcdHJldHVybiB0aGlzLmFjdGl2ZVBhcnQuZ2V0TGF5b3V0KCk7XG5cdH1cblxuXHRnZXQgb3JpZW50YXRpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWN0aXZlUGFydC5vcmllbnRhdGlvbjtcblx0fVxuXG5cdHNldEdyb3VwT3JpZW50YXRpb24ob3JpZW50YXRpb246IEdyb3VwT3JpZW50YXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLmFjdGl2ZVBhcnQuc2V0R3JvdXBPcmllbnRhdGlvbihvcmllbnRhdGlvbik7XG5cdH1cblxuXHRmaW5kR3JvdXAoc2NvcGU6IElGaW5kR3JvdXBTY29wZSwgc291cmNlOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyID0gdGhpcy5hY3RpdmVHcm91cCwgd3JhcD86IGJvb2xlYW4pOiBJRWRpdG9yR3JvdXBWaWV3IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBzb3VyY2VQYXJ0ID0gdGhpcy5nZXRQYXJ0KHNvdXJjZSk7XG5cdFx0aWYgKHRoaXMuX3BhcnRzLnNpemUgPiAxKSB7XG5cdFx0XHRjb25zdCBncm91cHMgPSB0aGlzLmdldEdyb3VwcyhHcm91cHNPcmRlci5HUklEX0FQUEVBUkFOQ0UpO1xuXG5cdFx0XHQvLyBFbnN1cmUgdGhhdCBGSVJTVC9MQVNUIGRpc3BhdGNoZXMgZ2xvYmFsbHkgb3ZlciBhbGwgcGFydHNcblx0XHRcdGlmIChzY29wZS5sb2NhdGlvbiA9PT0gR3JvdXBMb2NhdGlvbi5GSVJTVCB8fCBzY29wZS5sb2NhdGlvbiA9PT0gR3JvdXBMb2NhdGlvbi5MQVNUKSB7XG5cdFx0XHRcdHJldHVybiBzY29wZS5sb2NhdGlvbiA9PT0gR3JvdXBMb2NhdGlvbi5GSVJTVCA/IGdyb3Vwc1swXSA6IGdyb3Vwc1tncm91cHMubGVuZ3RoIC0gMV07XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRyeSB0byBmaW5kIGluIHRhcmdldCBwYXJ0IGZpcnN0IHdpdGhvdXQgd3JhcHBpbmdcblx0XHRcdGNvbnN0IGdyb3VwID0gc291cmNlUGFydC5maW5kR3JvdXAoc2NvcGUsIHNvdXJjZSwgZmFsc2UpO1xuXHRcdFx0aWYgKGdyb3VwKSB7XG5cdFx0XHRcdHJldHVybiBncm91cDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRW5zdXJlIHRoYXQgTkVYVC9QUkVWSU9VUyBkaXNwYXRjaGVzIGdsb2JhbGx5IG92ZXIgYWxsIHBhcnRzXG5cdFx0XHRpZiAoc2NvcGUubG9jYXRpb24gPT09IEdyb3VwTG9jYXRpb24uTkVYVCB8fCBzY29wZS5sb2NhdGlvbiA9PT0gR3JvdXBMb2NhdGlvbi5QUkVWSU9VUykge1xuXHRcdFx0XHRjb25zdCBzb3VyY2VHcm91cCA9IHRoaXMuYXNzZXJ0R3JvdXBWaWV3KHNvdXJjZSk7XG5cdFx0XHRcdGNvbnN0IGluZGV4ID0gZ3JvdXBzLmluZGV4T2Yoc291cmNlR3JvdXApO1xuXG5cdFx0XHRcdGlmIChzY29wZS5sb2NhdGlvbiA9PT0gR3JvdXBMb2NhdGlvbi5ORVhUKSB7XG5cdFx0XHRcdFx0bGV0IG5leHRHcm91cDogSUVkaXRvckdyb3VwVmlldyB8IHVuZGVmaW5lZCA9IGdyb3Vwc1tpbmRleCArIDFdO1xuXHRcdFx0XHRcdGlmICghbmV4dEdyb3VwICYmIHdyYXApIHtcblx0XHRcdFx0XHRcdG5leHRHcm91cCA9IGdyb3Vwc1swXTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gbmV4dEdyb3VwO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxldCBwcmV2aW91c0dyb3VwOiBJRWRpdG9yR3JvdXBWaWV3IHwgdW5kZWZpbmVkID0gZ3JvdXBzW2luZGV4IC0gMV07XG5cdFx0XHRcdFx0aWYgKCFwcmV2aW91c0dyb3VwICYmIHdyYXApIHtcblx0XHRcdFx0XHRcdHByZXZpb3VzR3JvdXAgPSBncm91cHNbZ3JvdXBzLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBwcmV2aW91c0dyb3VwO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHNvdXJjZVBhcnQuZmluZEdyb3VwKHNjb3BlLCBzb3VyY2UsIHdyYXApO1xuXHR9XG5cblx0YWRkR3JvdXAobG9jYXRpb246IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIGRpcmVjdGlvbjogR3JvdXBEaXJlY3Rpb24pOiBJRWRpdG9yR3JvdXBWaWV3IHtcblx0XHRyZXR1cm4gdGhpcy5nZXRQYXJ0KGxvY2F0aW9uKS5hZGRHcm91cChsb2NhdGlvbiwgZGlyZWN0aW9uKTtcblx0fVxuXG5cdHJlbW92ZUdyb3VwKGdyb3VwOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyKTogdm9pZCB7XG5cdFx0dGhpcy5nZXRQYXJ0KGdyb3VwKS5yZW1vdmVHcm91cChncm91cCk7XG5cdH1cblxuXHRtb3ZlR3JvdXAoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIGxvY2F0aW9uOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyLCBkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uKTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0UGFydChncm91cCkubW92ZUdyb3VwKGdyb3VwLCBsb2NhdGlvbiwgZGlyZWN0aW9uKTtcblx0fVxuXG5cdG1lcmdlR3JvdXAoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIHRhcmdldDogSUVkaXRvckdyb3VwVmlldyB8IEdyb3VwSWRlbnRpZmllciwgb3B0aW9ucz86IElNZXJnZUdyb3VwT3B0aW9ucyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmdldFBhcnQoZ3JvdXApLm1lcmdlR3JvdXAoZ3JvdXAsIHRhcmdldCwgb3B0aW9ucyk7XG5cdH1cblxuXHRtZXJnZUFsbEdyb3Vwcyh0YXJnZXQ6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIG9wdGlvbnM/OiBJTWVyZ2VHcm91cE9wdGlvbnMpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5hY3RpdmVQYXJ0Lm1lcmdlQWxsR3JvdXBzKHRhcmdldCwgb3B0aW9ucyk7XG5cdH1cblxuXHRjb3B5R3JvdXAoZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcgfCBHcm91cElkZW50aWZpZXIsIGxvY2F0aW9uOiBJRWRpdG9yR3JvdXBWaWV3IHwgR3JvdXBJZGVudGlmaWVyLCBkaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uKTogSUVkaXRvckdyb3VwVmlldyB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0UGFydChncm91cCkuY29weUdyb3VwKGdyb3VwLCBsb2NhdGlvbiwgZGlyZWN0aW9uKTtcblx0fVxuXG5cdGNyZWF0ZUVkaXRvckRyb3BUYXJnZXQoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZGVsZWdhdGU6IElFZGl0b3JEcm9wVGFyZ2V0RGVsZWdhdGUpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0UGFydChjb250YWluZXIpLmNyZWF0ZUVkaXRvckRyb3BUYXJnZXQoY29udGFpbmVyLCBkZWxlZ2F0ZSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gRWRpdG9yIEdyb3VwIENvbnRleHQgS2V5IEhhbmRsaW5nXG5cblx0cHJpdmF0ZSByZWFkb25seSBnbG9iYWxDb250ZXh0S2V5cyA9IG5ldyBNYXA8c3RyaW5nLCBJQ29udGV4dEtleTxDb250ZXh0S2V5VmFsdWU+PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHNjb3BlZENvbnRleHRLZXlzID0gbmV3IE1hcDxHcm91cElkZW50aWZpZXIsIE1hcDxzdHJpbmcsIElDb250ZXh0S2V5PENvbnRleHRLZXlWYWx1ZT4+PigpO1xuXG5cdHByaXZhdGUgcmVnaXN0ZXJHcm91cHNDb250ZXh0S2V5TGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2VBY3RpdmVHcm91cCgoKSA9PiB0aGlzLnVwZGF0ZUdsb2JhbENvbnRleHRLZXlzKCkpKTtcblx0XHR0aGlzLmdyb3Vwcy5mb3JFYWNoKGdyb3VwID0+IHRoaXMucmVnaXN0ZXJHcm91cENvbnRleHRLZXlQcm92aWRlcnNMaXN0ZW5lcnMoZ3JvdXApKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQWRkR3JvdXAoZ3JvdXAgPT4gdGhpcy5yZWdpc3Rlckdyb3VwQ29udGV4dEtleVByb3ZpZGVyc0xpc3RlbmVycyhncm91cCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkUmVtb3ZlR3JvdXAoZ3JvdXAgPT4ge1xuXHRcdFx0dGhpcy5zY29wZWRDb250ZXh0S2V5cy5kZWxldGUoZ3JvdXAuaWQpO1xuXHRcdFx0dGhpcy5yZWdpc3RlcmVkQ29udGV4dEtleXMuZGVsZXRlKGdyb3VwLmlkKTtcblx0XHRcdHRoaXMuY29udGV4dEtleVByb3ZpZGVyRGlzcG9zYWJsZXMuZGVsZXRlQW5kRGlzcG9zZShncm91cC5pZCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVHbG9iYWxDb250ZXh0S2V5cygpOiB2b2lkIHtcblx0XHRjb25zdCBhY3RpdmVHcm91cFNjb3BlZENvbnRleHRLZXlzID0gdGhpcy5zY29wZWRDb250ZXh0S2V5cy5nZXQodGhpcy5hY3RpdmVHcm91cC5pZCk7XG5cdFx0aWYgKCFhY3RpdmVHcm91cFNjb3BlZENvbnRleHRLZXlzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBba2V5LCBnbG9iYWxDb250ZXh0S2V5XSBvZiB0aGlzLmdsb2JhbENvbnRleHRLZXlzKSB7XG5cdFx0XHRjb25zdCBzY29wZWRDb250ZXh0S2V5ID0gYWN0aXZlR3JvdXBTY29wZWRDb250ZXh0S2V5cy5nZXQoa2V5KTtcblx0XHRcdGlmIChzY29wZWRDb250ZXh0S2V5KSB7XG5cdFx0XHRcdGdsb2JhbENvbnRleHRLZXkuc2V0KHNjb3BlZENvbnRleHRLZXkuZ2V0KCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Z2xvYmFsQ29udGV4dEtleS5yZXNldCgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGJpbmQ8VCBleHRlbmRzIENvbnRleHRLZXlWYWx1ZT4oY29udGV4dEtleTogUmF3Q29udGV4dEtleTxUPiwgZ3JvdXA6IElFZGl0b3JHcm91cFZpZXcpOiBJQ29udGV4dEtleTxUPiB7XG5cblx0XHQvLyBFbnN1cmUgd2Ugb25seSBiaW5kIHRvIHRoZSBzYW1lIGNvbnRleHQga2V5IG9uY2UgZ2xvYmFseVxuXHRcdGxldCBnbG9iYWxDb250ZXh0S2V5ID0gdGhpcy5nbG9iYWxDb250ZXh0S2V5cy5nZXQoY29udGV4dEtleS5rZXkpO1xuXHRcdGlmICghZ2xvYmFsQ29udGV4dEtleSkge1xuXHRcdFx0Z2xvYmFsQ29udGV4dEtleSA9IGNvbnRleHRLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5nbG9iYWxDb250ZXh0S2V5cy5zZXQoY29udGV4dEtleS5rZXksIGdsb2JhbENvbnRleHRLZXkpO1xuXHRcdH1cblxuXHRcdC8vIEVuc3VyZSB3ZSBvbmx5IGJpbmQgdG8gdGhlIHNhbWUgY29udGV4dCBrZXkgb25jZSBwZXIgZ3JvdXBcblx0XHRsZXQgZ3JvdXBTY29wZWRDb250ZXh0S2V5cyA9IHRoaXMuc2NvcGVkQ29udGV4dEtleXMuZ2V0KGdyb3VwLmlkKTtcblx0XHRpZiAoIWdyb3VwU2NvcGVkQ29udGV4dEtleXMpIHtcblx0XHRcdGdyb3VwU2NvcGVkQ29udGV4dEtleXMgPSBuZXcgTWFwPHN0cmluZywgSUNvbnRleHRLZXk8Q29udGV4dEtleVZhbHVlPj4oKTtcblx0XHRcdHRoaXMuc2NvcGVkQ29udGV4dEtleXMuc2V0KGdyb3VwLmlkLCBncm91cFNjb3BlZENvbnRleHRLZXlzKTtcblx0XHR9XG5cdFx0bGV0IHNjb3BlZENvbnRleHRLZXkgPSBncm91cFNjb3BlZENvbnRleHRLZXlzLmdldChjb250ZXh0S2V5LmtleSk7XG5cdFx0aWYgKCFzY29wZWRDb250ZXh0S2V5KSB7XG5cdFx0XHRzY29wZWRDb250ZXh0S2V5ID0gY29udGV4dEtleS5iaW5kVG8oZ3JvdXAuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0Z3JvdXBTY29wZWRDb250ZXh0S2V5cy5zZXQoY29udGV4dEtleS5rZXksIHNjb3BlZENvbnRleHRLZXkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHJldHVybiB7XG5cdFx0XHRnZXQoKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdHJldHVybiBzY29wZWRDb250ZXh0S2V5LmdldCgpIGFzIFQgfCB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXHRcdFx0c2V0KHZhbHVlOiBUKTogdm9pZCB7XG5cdFx0XHRcdGlmICh0aGF0LmFjdGl2ZUdyb3VwID09PSBncm91cCkge1xuXHRcdFx0XHRcdGdsb2JhbENvbnRleHRLZXkuc2V0KHZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzY29wZWRDb250ZXh0S2V5LnNldCh2YWx1ZSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVzZXQoKTogdm9pZCB7XG5cdFx0XHRcdGlmICh0aGF0LmFjdGl2ZUdyb3VwID09PSBncm91cCkge1xuXHRcdFx0XHRcdGdsb2JhbENvbnRleHRLZXkucmVzZXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzY29wZWRDb250ZXh0S2V5LnJlc2V0KCk7XG5cdFx0XHR9LFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlQcm92aWRlcnMgPSBuZXcgTWFwPHN0cmluZywgSUVkaXRvckdyb3VwQ29udGV4dEtleVByb3ZpZGVyPENvbnRleHRLZXlWYWx1ZT4+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVnaXN0ZXJlZENvbnRleHRLZXlzID0gbmV3IE1hcDxHcm91cElkZW50aWZpZXIsIE1hcDxzdHJpbmcsIElDb250ZXh0S2V5Pj4oKTtcblxuXHRyZWdpc3RlckNvbnRleHRLZXlQcm92aWRlcjxUIGV4dGVuZHMgQ29udGV4dEtleVZhbHVlPihwcm92aWRlcjogSUVkaXRvckdyb3VwQ29udGV4dEtleVByb3ZpZGVyPFQ+KTogSURpc3Bvc2FibGUge1xuXHRcdGlmICh0aGlzLmNvbnRleHRLZXlQcm92aWRlcnMuaGFzKHByb3ZpZGVyLmNvbnRleHRLZXkua2V5KSB8fCB0aGlzLmdsb2JhbENvbnRleHRLZXlzLmhhcyhwcm92aWRlci5jb250ZXh0S2V5LmtleSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQSBjb250ZXh0IGtleSBwcm92aWRlciBmb3Iga2V5ICR7cHJvdmlkZXIuY29udGV4dEtleS5rZXl9IGFscmVhZHkgZXhpc3RzLmApO1xuXHRcdH1cblxuXHRcdHRoaXMuY29udGV4dEtleVByb3ZpZGVycy5zZXQocHJvdmlkZXIuY29udGV4dEtleS5rZXksIHByb3ZpZGVyKTtcblxuXHRcdGNvbnN0IHNldENvbnRleHRLZXlGb3JHcm91cHMgPSAoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIHRoaXMuZ3JvdXBzKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlUmVnaXN0ZXJlZENvbnRleHRLZXkoZ3JvdXAsIHByb3ZpZGVyKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gUnVuIGluaXRpYWxseSBhbmQgb24gY2hhbmdlXG5cdFx0c2V0Q29udGV4dEtleUZvckdyb3VwcygpO1xuXHRcdGNvbnN0IG9uRGlkQ2hhbmdlID0gcHJvdmlkZXIub25EaWRDaGFuZ2U/LigoKSA9PiBzZXRDb250ZXh0S2V5Rm9yR3JvdXBzKCkpO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRvbkRpZENoYW5nZT8uZGlzcG9zZSgpO1xuXG5cdFx0XHR0aGlzLmdsb2JhbENvbnRleHRLZXlzLmRlbGV0ZShwcm92aWRlci5jb250ZXh0S2V5LmtleSk7XG5cdFx0XHR0aGlzLnNjb3BlZENvbnRleHRLZXlzLmZvckVhY2goc2NvcGVkQ29udGV4dEtleXMgPT4gc2NvcGVkQ29udGV4dEtleXMuZGVsZXRlKHByb3ZpZGVyLmNvbnRleHRLZXkua2V5KSk7XG5cblx0XHRcdHRoaXMuY29udGV4dEtleVByb3ZpZGVycy5kZWxldGUocHJvdmlkZXIuY29udGV4dEtleS5rZXkpO1xuXHRcdFx0dGhpcy5yZWdpc3RlcmVkQ29udGV4dEtleXMuZm9yRWFjaChyZWdpc3RlcmVkQ29udGV4dEtleXMgPT4gcmVnaXN0ZXJlZENvbnRleHRLZXlzLmRlbGV0ZShwcm92aWRlci5jb250ZXh0S2V5LmtleSkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5UHJvdmlkZXJEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPEdyb3VwSWRlbnRpZmllciwgSURpc3Bvc2FibGU+KCkpO1xuXHRwcml2YXRlIHJlZ2lzdGVyR3JvdXBDb250ZXh0S2V5UHJvdmlkZXJzTGlzdGVuZXJzKGdyb3VwOiBJRWRpdG9yR3JvdXBWaWV3KTogdm9pZCB7XG5cblx0XHQvLyBVcGRhdGUgY29udGV4dCBrZXlzIGZyb20gcHJvdmlkZXJzIGZvciB0aGUgZ3JvdXAgd2hlbiBpdHMgYWN0aXZlIGVkaXRvciBjaGFuZ2VzXG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGdyb3VwLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCgpID0+IHtcblx0XHRcdGZvciAoY29uc3QgY29udGV4dEtleVByb3ZpZGVyIG9mIHRoaXMuY29udGV4dEtleVByb3ZpZGVycy52YWx1ZXMoKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVJlZ2lzdGVyZWRDb250ZXh0S2V5KGdyb3VwLCBjb250ZXh0S2V5UHJvdmlkZXIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5jb250ZXh0S2V5UHJvdmlkZXJEaXNwb3NhYmxlcy5zZXQoZ3JvdXAuaWQsIGRpc3Bvc2FibGUpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVSZWdpc3RlcmVkQ29udGV4dEtleTxUIGV4dGVuZHMgQ29udGV4dEtleVZhbHVlPihncm91cDogSUVkaXRvckdyb3VwVmlldywgcHJvdmlkZXI6IElFZGl0b3JHcm91cENvbnRleHRLZXlQcm92aWRlcjxUPik6IHZvaWQge1xuXG5cdFx0Ly8gR2V0IHRoZSBncm91cCBzY29wZWQgY29udGV4dCBrZXlzIGZvciB0aGUgcHJvdmlkZXJcblx0XHQvLyBJZiB0aGUgcHJvdmlkZXJzIGNvbnRleHQga2V5IGhhcyBub3QgeWV0IGJlZW4gYm91bmRcblx0XHQvLyB0byB0aGUgZ3JvdXAsIGRvIHNvIG5vdy5cblxuXHRcdGxldCBncm91cFJlZ2lzdGVyZWRDb250ZXh0S2V5cyA9IHRoaXMucmVnaXN0ZXJlZENvbnRleHRLZXlzLmdldChncm91cC5pZCk7XG5cdFx0aWYgKCFncm91cFJlZ2lzdGVyZWRDb250ZXh0S2V5cykge1xuXHRcdFx0Z3JvdXBSZWdpc3RlcmVkQ29udGV4dEtleXMgPSBuZXcgTWFwPHN0cmluZywgSUNvbnRleHRLZXk+KCk7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyZWRDb250ZXh0S2V5cy5zZXQoZ3JvdXAuaWQsIGdyb3VwUmVnaXN0ZXJlZENvbnRleHRLZXlzKTtcblx0XHR9XG5cblx0XHRsZXQgc2NvcGVkUmVnaXN0ZXJlZENvbnRleHRLZXkgPSBncm91cFJlZ2lzdGVyZWRDb250ZXh0S2V5cy5nZXQocHJvdmlkZXIuY29udGV4dEtleS5rZXkpO1xuXHRcdGlmICghc2NvcGVkUmVnaXN0ZXJlZENvbnRleHRLZXkpIHtcblx0XHRcdHNjb3BlZFJlZ2lzdGVyZWRDb250ZXh0S2V5ID0gdGhpcy5iaW5kKHByb3ZpZGVyLmNvbnRleHRLZXksIGdyb3VwKTtcblx0XHRcdGdyb3VwUmVnaXN0ZXJlZENvbnRleHRLZXlzLnNldChwcm92aWRlci5jb250ZXh0S2V5LmtleSwgc2NvcGVkUmVnaXN0ZXJlZENvbnRleHRLZXkpO1xuXHRcdH1cblxuXHRcdC8vIFNldCB0aGUgY29udGV4dCBrZXkgdmFsdWUgZm9yIHRoZSBncm91cCBjb250ZXh0XG5cdFx0c2NvcGVkUmVnaXN0ZXJlZENvbnRleHRLZXkuc2V0KHByb3ZpZGVyLmdldEdyb3VwQ29udGV4dEtleVZhbHVlKGdyb3VwKSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gTWFpbiBFZGl0b3IgUGFydCBPbmx5XG5cblx0Z2V0IHBhcnRPcHRpb25zKCkgeyByZXR1cm4gdGhpcy5tYWluUGFydC5wYXJ0T3B0aW9uczsgfVxuXHRnZXQgb25EaWRDaGFuZ2VFZGl0b3JQYXJ0T3B0aW9ucygpIHsgcmV0dXJuIHRoaXMubWFpblBhcnQub25EaWRDaGFuZ2VFZGl0b3JQYXJ0T3B0aW9uczsgfVxuXG5cdC8vI2VuZHJlZ2lvblxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJRWRpdG9yR3JvdXBzU2VydmljZSwgRWRpdG9yUGFydHMsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBNEMsZUFBb0QsYUFBOEYsNEJBQTZJO0FBQzNVLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWUsaUJBQThCLG9CQUFvQjtBQUUxRSxTQUF5QyxzQkFBc0I7QUFFL0QsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMkJBQTREO0FBQ3JFLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsaUJBQTJDLGNBQWMscUJBQXFCO0FBQ3ZGLFNBQVMscUJBQXFCO0FBQzlCLFNBQXNDLCtCQUErQjtBQUNyRSxTQUFTLG9CQUFvQjtBQUM3QixTQUF1QywwQkFBeUM7QUFDaEYsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxzQkFBc0I7QUFpQnhCLElBQU0sY0FBTixjQUEwQixpQkFBK0U7QUFBQSxFQVEvRyxZQUMyQyxzQkFDUixnQkFDbkIsY0FDMkIsd0JBQ0wsbUJBQ3BDO0FBQ0Qs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
