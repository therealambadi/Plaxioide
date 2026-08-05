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
import { ViewContainerLocation, IViewDescriptorService, Extensions as ViewExtensions, ViewVisibilityState, defaultViewIcon, ViewContainerLocationToString, VIEWS_LOG_ID, VIEWS_LOG_NAME } from "../../../common/views.js";
import { RawContextKey, IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { toDisposable, DisposableStore, Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { ViewPaneContainer, ViewPaneContainerAction, ViewsSubMenu } from "../../../browser/parts/views/viewPaneContainer.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { getViewsStateStorageId, ViewContainerModel } from "../common/viewContainerModel.js";
import { registerAction2, Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { localize, localize2 } from "../../../../nls.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { IViewsService } from "../common/viewsService.js";
import { windowLogGroup } from "../../log/common/logConstants.js";
function getViewContainerStorageId(viewContainerId) {
  return `${viewContainerId}.state`;
}
let ViewDescriptorService = class extends Disposable {
  constructor(instantiationService, contextKeyService, storageService, extensionService, telemetryService, loggerService) {
    super();
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.telemetryService = telemetryService;
    this._onDidChangeContainer = this._register(new Emitter());
    this.onDidChangeContainer = this._onDidChangeContainer.event;
    this._onDidChangeLocation = this._register(new Emitter());
    this.onDidChangeLocation = this._onDidChangeLocation.event;
    this._onDidChangeContainerLocation = this._register(new Emitter());
    this.onDidChangeContainerLocation = this._onDidChangeContainerLocation.event;
    this.viewContainerModels = this._register(new DisposableMap());
    this.viewsVisibilityActionDisposables = this._register(new DisposableMap());
    this.canRegisterViewsVisibilityActions = false;
    this._onDidChangeViewContainers = this._register(new Emitter());
    this.onDidChangeViewContainers = this._onDidChangeViewContainers.event;
    this.logger = new Lazy(() => loggerService.createLogger(VIEWS_LOG_ID, { name: VIEWS_LOG_NAME, group: windowLogGroup }));
    this.activeViewContextKeys = /* @__PURE__ */ new Map();
    this.movableViewContextKeys = /* @__PURE__ */ new Map();
    this.defaultViewLocationContextKeys = /* @__PURE__ */ new Map();
    this.defaultViewContainerLocationContextKeys = /* @__PURE__ */ new Map();
    this.viewContainersRegistry = Registry.as(ViewExtensions.ViewContainersRegistry);
    this.viewsRegistry = Registry.as(ViewExtensions.ViewsRegistry);
    this.migrateToViewsCustomizationsStorage();
    this.viewContainersCustomLocations = new Map(Object.entries(this.viewCustomizations.viewContainerLocations));
    this.viewDescriptorsCustomLocations = new Map(Object.entries(this.viewCustomizations.viewLocations));
    this.viewContainerBadgeEnablementStates = new Map(Object.entries(this.viewCustomizations.viewContainerBadgeEnablementStates));
    this.viewContainers.forEach((viewContainer) => this.onDidRegisterViewContainer(viewContainer));
    this._register(this.viewsRegistry.onViewsRegistered((views) => this.onDidRegisterViews(views)));
    this._register(this.viewsRegistry.onViewsDeregistered(({ views, viewContainer }) => this.onDidDeregisterViews(views, viewContainer)));
    this._register(this.viewsRegistry.onDidChangeContainer(({ views, from, to }) => this.onDidChangeDefaultContainer(views, from, to)));
    this._register(this.viewContainersRegistry.onDidRegister(({ viewContainer }) => {
      this.onDidRegisterViewContainer(viewContainer);
      this._onDidChangeViewContainers.fire({ added: [{ container: viewContainer, location: this.getViewContainerLocation(viewContainer) }], removed: [] });
    }));
    this._register(this.viewContainersRegistry.onDidDeregister(({ viewContainer, viewContainerLocation }) => {
      this.onDidDeregisterViewContainer(viewContainer);
      this._onDidChangeViewContainers.fire({ removed: [{ container: viewContainer, location: viewContainerLocation }], added: [] });
    }));
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, ViewDescriptorService.VIEWS_CUSTOMIZATIONS, this._store)(() => this.onDidStorageChange()));
    this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered());
  }
  get viewContainers() {
    return this.viewContainersRegistry.all;
  }
  migrateToViewsCustomizationsStorage() {
    if (this.storageService.get(ViewDescriptorService.VIEWS_CUSTOMIZATIONS, StorageScope.PROFILE)) {
      return;
    }
    const viewContainerLocationsValue = this.storageService.get("views.cachedViewContainerLocations", StorageScope.PROFILE);
    const viewDescriptorLocationsValue = this.storageService.get("views.cachedViewPositions", StorageScope.PROFILE);
    if (!viewContainerLocationsValue && !viewDescriptorLocationsValue) {
      return;
    }
    const viewContainerLocations = viewContainerLocationsValue ? JSON.parse(viewContainerLocationsValue) : [];
    const viewDescriptorLocations = viewDescriptorLocationsValue ? JSON.parse(viewDescriptorLocationsValue) : [];
    const viewsCustomizations = {
      viewContainerLocations: viewContainerLocations.reduce((result, [id, location]) => {
        result[id] = location;
        return result;
      }, {}),
      viewLocations: viewDescriptorLocations.reduce((result, [id, { containerId }]) => {
        result[id] = containerId;
        return result;
      }, {}),
      viewContainerBadgeEnablementStates: {}
    };
    this.storageService.store(ViewDescriptorService.VIEWS_CUSTOMIZATIONS, JSON.stringify(viewsCustomizations), StorageScope.PROFILE, StorageTarget.USER);
    this.storageService.remove("views.cachedViewContainerLocations", StorageScope.PROFILE);
    this.storageService.remove("views.cachedViewPositions", StorageScope.PROFILE);
  }
  registerGroupedViews(groupedViews) {
    for (const [containerId, views] of groupedViews.entries()) {
      const viewContainer = this.viewContainersRegistry.get(containerId);
      if (!viewContainer || !this.viewContainerModels.has(viewContainer)) {
        if (this.isGeneratedContainerId(containerId)) {
          const viewContainerLocation = this.viewContainersCustomLocations.get(containerId);
          if (viewContainerLocation !== void 0) {
            this.registerGeneratedViewContainer(viewContainerLocation, containerId);
          }
        }
        continue;
      }
      const viewsToAdd = views.filter((view) => this.getViewContainerModel(viewContainer).allViewDescriptors.filter((vd) => vd.id === view.id).length === 0);
      this.addViews(viewContainer, viewsToAdd);
    }
  }
  deregisterGroupedViews(groupedViews) {
    for (const [viewContainerId, views] of groupedViews.entries()) {
      const viewContainer = this.viewContainersRegistry.get(viewContainerId);
      if (!viewContainer || !this.viewContainerModels.has(viewContainer)) {
        continue;
      }
      this.removeViews(viewContainer, views);
    }
  }
  moveOrphanViewsToDefaultLocation() {
    for (const [viewId, containerId] of this.viewDescriptorsCustomLocations.entries()) {
      if (this.viewContainersRegistry.get(containerId)) {
        continue;
      }
      const viewContainer = this.viewsRegistry.getViewContainer(viewId);
      const viewDescriptor = this.getViewDescriptorById(viewId);
      if (viewContainer && viewDescriptor) {
        this.addViews(viewContainer, [viewDescriptor]);
      }
    }
  }
  whenExtensionsRegistered() {
    this.moveOrphanViewsToDefaultLocation();
    for (const viewContainerId of [...this.viewContainersCustomLocations.keys()]) {
      this.cleanUpGeneratedViewContainer(viewContainerId);
    }
    this.saveViewCustomizations();
    for (const [key, value] of this.viewContainerModels) {
      this.registerViewsVisibilityActions(key, value);
    }
    this.canRegisterViewsVisibilityActions = true;
  }
  onDidRegisterViews(views) {
    this.contextKeyService.bufferChangeEvents(() => {
      views.forEach(({ views: views2, viewContainer }) => {
        const regroupedViews = this.regroupViews(viewContainer.id, views2);
        this.registerGroupedViews(regroupedViews);
        views2.forEach((viewDescriptor) => this.getOrCreateMovableViewContextKey(viewDescriptor).set(!!viewDescriptor.canMoveView));
      });
    });
  }
  isGeneratedContainerId(id) {
    return id.startsWith(ViewDescriptorService.COMMON_CONTAINER_ID_PREFIX);
  }
  onDidDeregisterViews(views, viewContainer) {
    const regroupedViews = this.regroupViews(viewContainer.id, views);
    this.deregisterGroupedViews(regroupedViews);
    this.contextKeyService.bufferChangeEvents(() => {
      views.forEach((viewDescriptor) => this.getOrCreateMovableViewContextKey(viewDescriptor).set(false));
    });
  }
  regroupViews(containerId, views) {
    const viewsByContainer = /* @__PURE__ */ new Map();
    for (const viewDescriptor of views) {
      const correctContainerId = this.viewDescriptorsCustomLocations.get(viewDescriptor.id) ?? containerId;
      let containerViews = viewsByContainer.get(correctContainerId);
      if (!containerViews) {
        viewsByContainer.set(correctContainerId, containerViews = []);
      }
      containerViews.push(viewDescriptor);
    }
    return viewsByContainer;
  }
  getViewDescriptorById(viewId) {
    return this.viewsRegistry.getView(viewId);
  }
  getViewLocationById(viewId) {
    const container = this.getViewContainerByViewId(viewId);
    if (container === null) {
      return null;
    }
    return this.getViewContainerLocation(container);
  }
  getViewContainerByViewId(viewId) {
    const containerId = this.viewDescriptorsCustomLocations.get(viewId);
    return containerId ? this.viewContainersRegistry.get(containerId) ?? null : this.getDefaultContainerById(viewId);
  }
  getViewContainerLocation(viewContainer) {
    return this.viewContainersCustomLocations.get(viewContainer.id) ?? this.getDefaultViewContainerLocation(viewContainer);
  }
  getDefaultViewContainerLocation(viewContainer) {
    return this.viewContainersRegistry.getViewContainerLocation(viewContainer);
  }
  getDefaultContainerById(viewId) {
    return this.viewsRegistry.getViewContainer(viewId) ?? null;
  }
  getViewContainerModel(container) {
    return this.getOrRegisterViewContainerModel(container);
  }
  getViewContainerById(id) {
    return this.viewContainersRegistry.get(id) || null;
  }
  getViewContainersByLocation(location) {
    return this.viewContainers.filter((v) => this.getViewContainerLocation(v) === location);
  }
  getDefaultViewContainer(location) {
    return this.viewContainersRegistry.getDefaultViewContainer(location);
  }
  moveViewContainerToLocation(viewContainer, location, requestedIndex, reason) {
    this.logger.value.info(`moveViewContainerToLocation: viewContainer:${viewContainer.id} location:${location} reason:${reason}`);
    this.moveViewContainerToLocationWithoutSaving(viewContainer, location, requestedIndex);
    this.saveViewCustomizations();
  }
  getViewContainerBadgeEnablementState(id) {
    return this.viewContainerBadgeEnablementStates.get(id) ?? true;
  }
  setViewContainerBadgeEnablementState(id, badgesEnabled) {
    this.viewContainerBadgeEnablementStates.set(id, badgesEnabled);
    this.saveViewCustomizations();
  }
  moveViewToLocation(view, location, reason) {
    this.logger.value.info(`moveViewToLocation: view:${view.id} location:${location} reason:${reason}`);
    const container = this.registerGeneratedViewContainer(location);
    this.moveViewsToContainer([view], container);
  }
  moveViewsToContainer(views, viewContainer, visibilityState, reason) {
    if (!views.length) {
      return;
    }
    this.logger.value.info(`moveViewsToContainer: views:${views.map((view) => view.id).join(",")} viewContainer:${viewContainer.id} reason:${reason}`);
    const from = this.getViewContainerByViewId(views[0].id);
    const to = viewContainer;
    if (from && to && from !== to) {
      this.moveViewsWithoutSaving(views, from, to, visibilityState);
      this.cleanUpGeneratedViewContainer(from.id);
      this.saveViewCustomizations();
      this.reportMovedViews(views, from, to);
    }
  }
  reset() {
    for (const viewContainer of this.viewContainers) {
      const viewContainerModel = this.getViewContainerModel(viewContainer);
      for (const viewDescriptor of viewContainerModel.allViewDescriptors) {
        const defaultContainer = this.getDefaultContainerById(viewDescriptor.id);
        const currentContainer = this.getViewContainerByViewId(viewDescriptor.id);
        if (currentContainer && defaultContainer && currentContainer !== defaultContainer) {
          this.moveViewsWithoutSaving([viewDescriptor], currentContainer, defaultContainer);
        }
      }
      const defaultContainerLocation = this.getDefaultViewContainerLocation(viewContainer);
      const currentContainerLocation = this.getViewContainerLocation(viewContainer);
      if (defaultContainerLocation !== null && currentContainerLocation !== defaultContainerLocation) {
        this.moveViewContainerToLocationWithoutSaving(viewContainer, defaultContainerLocation);
      }
      this.cleanUpGeneratedViewContainer(viewContainer.id);
    }
    this.viewContainersCustomLocations.clear();
    this.viewDescriptorsCustomLocations.clear();
    this.saveViewCustomizations();
  }
  isViewContainerRemovedPermanently(viewContainerId) {
    return this.isGeneratedContainerId(viewContainerId) && !this.viewContainersCustomLocations.has(viewContainerId);
  }
  onDidChangeDefaultContainer(views, from, to) {
    const viewsToMove = views.filter(
      (view) => !this.viewDescriptorsCustomLocations.has(view.id) || !this.viewContainers.includes(from) && this.viewDescriptorsCustomLocations.get(view.id) === from.id
      // Move views which are moved from a removed container
    );
    if (viewsToMove.length) {
      this.moveViewsWithoutSaving(viewsToMove, from, to);
    }
  }
  reportMovedViews(views, from, to) {
    const containerToString = (container) => {
      if (container.id.startsWith(ViewDescriptorService.COMMON_CONTAINER_ID_PREFIX)) {
        return "custom";
      }
      if (!container.extensionId) {
        return container.id;
      }
      return "extension";
    };
    const oldLocation = this.getViewContainerLocation(from);
    const newLocation = this.getViewContainerLocation(to);
    const viewCount = views.length;
    const fromContainer = containerToString(from);
    const toContainer = containerToString(to);
    const fromLocation = oldLocation === ViewContainerLocation.Panel ? "panel" : "sidebar";
    const toLocation = newLocation === ViewContainerLocation.Panel ? "panel" : "sidebar";
    this.telemetryService.publicLog2("viewDescriptorService.moveViews", { viewCount, fromContainer, toContainer, fromLocation, toLocation });
  }
  moveViewsWithoutSaving(views, from, to, visibilityState = ViewVisibilityState.Expand) {
    this.removeViews(from, views);
    this.addViews(to, views, visibilityState);
    const oldLocation = this.getViewContainerLocation(from);
    const newLocation = this.getViewContainerLocation(to);
    if (oldLocation !== newLocation) {
      this._onDidChangeLocation.fire({ views, from: oldLocation, to: newLocation });
    }
    this._onDidChangeContainer.fire({ views, from, to });
  }
  moveViewContainerToLocationWithoutSaving(viewContainer, location, requestedIndex) {
    const from = this.getViewContainerLocation(viewContainer);
    const to = location;
    if (from !== to) {
      const isGeneratedViewContainer = this.isGeneratedContainerId(viewContainer.id);
      const isDefaultViewContainerLocation = to === this.getDefaultViewContainerLocation(viewContainer);
      if (isGeneratedViewContainer || !isDefaultViewContainerLocation) {
        this.viewContainersCustomLocations.set(viewContainer.id, to);
      } else {
        this.viewContainersCustomLocations.delete(viewContainer.id);
      }
      this.getOrCreateDefaultViewContainerLocationContextKey(viewContainer).set(isGeneratedViewContainer || isDefaultViewContainerLocation);
      viewContainer.requestedIndex = requestedIndex;
      this._onDidChangeContainerLocation.fire({ viewContainer, from, to });
      const views = this.getViewsByContainer(viewContainer);
      this._onDidChangeLocation.fire({ views, from, to });
    }
  }
  cleanUpGeneratedViewContainer(viewContainerId) {
    if (!this.isGeneratedContainerId(viewContainerId)) {
      return;
    }
    const viewContainer = this.getViewContainerById(viewContainerId);
    if (viewContainer && this.getViewContainerModel(viewContainer)?.allViewDescriptors.length) {
      return;
    }
    if ([...this.viewDescriptorsCustomLocations.values()].includes(viewContainerId)) {
      return;
    }
    if (viewContainer) {
      this.viewContainersRegistry.deregisterViewContainer(viewContainer);
    }
    this.viewContainersCustomLocations.delete(viewContainerId);
    this.viewContainerBadgeEnablementStates.delete(viewContainerId);
    this.storageService.remove(getViewsStateStorageId(viewContainer?.storageId || getViewContainerStorageId(viewContainerId)), StorageScope.PROFILE);
  }
  registerGeneratedViewContainer(location, existingId) {
    const id = existingId || this.generateContainerId(location);
    const container = this.viewContainersRegistry.registerViewContainer({
      id,
      ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [id, { mergeViewWithContainerWhenSingleView: true }]),
      title: { value: localize("user", "User View Container"), original: "User View Container" },
      // having a placeholder title - this should not be shown anywhere
      icon: location === ViewContainerLocation.Sidebar ? defaultViewIcon : void 0,
      storageId: getViewContainerStorageId(id),
      hideIfEmpty: true
    }, location, { doNotRegisterOpenCommand: true });
    if (this.viewContainersCustomLocations.get(container.id) !== location) {
      this.viewContainersCustomLocations.set(container.id, location);
    }
    this.getOrCreateDefaultViewContainerLocationContextKey(container).set(true);
    return container;
  }
  onDidStorageChange() {
    if (JSON.stringify(this.viewCustomizations) !== this.getStoredViewCustomizationsValue()) {
      this.onDidViewCustomizationsStorageChange();
    }
  }
  onDidViewCustomizationsStorageChange() {
    this._viewCustomizations = void 0;
    const newViewContainerCustomizations = new Map(Object.entries(this.viewCustomizations.viewContainerLocations));
    const newViewDescriptorCustomizations = new Map(Object.entries(this.viewCustomizations.viewLocations));
    const viewContainersToMove = [];
    const viewsToMove = [];
    for (const [containerId, location] of newViewContainerCustomizations.entries()) {
      const container = this.getViewContainerById(containerId);
      if (container) {
        if (location !== this.getViewContainerLocation(container)) {
          viewContainersToMove.push([container, location]);
        }
      } else if (this.isGeneratedContainerId(containerId)) {
        this.registerGeneratedViewContainer(location, containerId);
      }
    }
    for (const viewContainer of this.viewContainers) {
      if (!newViewContainerCustomizations.has(viewContainer.id)) {
        const currentLocation = this.getViewContainerLocation(viewContainer);
        const defaultLocation = this.getDefaultViewContainerLocation(viewContainer);
        if (currentLocation !== defaultLocation) {
          viewContainersToMove.push([viewContainer, defaultLocation]);
        }
      }
    }
    for (const [viewId, viewContainerId] of newViewDescriptorCustomizations.entries()) {
      const viewDescriptor = this.getViewDescriptorById(viewId);
      if (viewDescriptor) {
        const prevViewContainer = this.getViewContainerByViewId(viewId);
        const newViewContainer = this.viewContainersRegistry.get(viewContainerId);
        if (prevViewContainer && newViewContainer && newViewContainer !== prevViewContainer) {
          viewsToMove.push({ views: [viewDescriptor], from: prevViewContainer, to: newViewContainer });
        }
      }
    }
    for (const viewContainer of this.viewContainers) {
      const viewContainerModel = this.getViewContainerModel(viewContainer);
      for (const viewDescriptor of viewContainerModel.allViewDescriptors) {
        if (!newViewDescriptorCustomizations.has(viewDescriptor.id)) {
          const currentContainer = this.getViewContainerByViewId(viewDescriptor.id);
          const defaultContainer = this.getDefaultContainerById(viewDescriptor.id);
          if (currentContainer && defaultContainer && currentContainer !== defaultContainer) {
            viewsToMove.push({ views: [viewDescriptor], from: currentContainer, to: defaultContainer });
          }
        }
      }
    }
    for (const [container, location] of viewContainersToMove) {
      this.moveViewContainerToLocationWithoutSaving(container, location);
    }
    for (const { views, from, to } of viewsToMove) {
      this.moveViewsWithoutSaving(views, from, to, ViewVisibilityState.Default);
    }
    this.viewContainersCustomLocations = newViewContainerCustomizations;
    this.viewDescriptorsCustomLocations = newViewDescriptorCustomizations;
  }
  // Generated Container Id Format
  // {Common Prefix}.{Location}.{Uniqueness Id}
  // Old Format (deprecated)
  // {Common Prefix}.{Uniqueness Id}.{Source View Id}
  generateContainerId(location) {
    return `${ViewDescriptorService.COMMON_CONTAINER_ID_PREFIX}.${ViewContainerLocationToString(location)}.${generateUuid()}`;
  }
  saveViewCustomizations() {
    const viewCustomizations = { viewContainerLocations: {}, viewLocations: {}, viewContainerBadgeEnablementStates: {} };
    for (const [containerId, location] of this.viewContainersCustomLocations) {
      const container = this.getViewContainerById(containerId);
      if (container && !this.isGeneratedContainerId(containerId) && location === this.getDefaultViewContainerLocation(container)) {
        continue;
      }
      viewCustomizations.viewContainerLocations[containerId] = location;
    }
    for (const [viewId, viewContainerId] of this.viewDescriptorsCustomLocations) {
      const viewContainer = this.getViewContainerById(viewContainerId);
      if (viewContainer) {
        const defaultContainer = this.getDefaultContainerById(viewId);
        if (defaultContainer?.id === viewContainer.id) {
          continue;
        }
      }
      viewCustomizations.viewLocations[viewId] = viewContainerId;
    }
    for (const [viewContainerId, badgeEnablementState] of this.viewContainerBadgeEnablementStates) {
      if (badgeEnablementState === false) {
        viewCustomizations.viewContainerBadgeEnablementStates[viewContainerId] = badgeEnablementState;
      }
    }
    this.viewCustomizations = viewCustomizations;
  }
  get viewCustomizations() {
    if (!this._viewCustomizations) {
      this._viewCustomizations = JSON.parse(this.getStoredViewCustomizationsValue());
      this._viewCustomizations.viewContainerLocations = this._viewCustomizations.viewContainerLocations ?? {};
      this._viewCustomizations.viewLocations = this._viewCustomizations.viewLocations ?? {};
      this._viewCustomizations.viewContainerBadgeEnablementStates = this._viewCustomizations.viewContainerBadgeEnablementStates ?? {};
    }
    return this._viewCustomizations;
  }
  set viewCustomizations(viewCustomizations) {
    const value = JSON.stringify(viewCustomizations);
    if (JSON.stringify(this.viewCustomizations) !== value) {
      this._viewCustomizations = viewCustomizations;
      this.setStoredViewCustomizationsValue(value);
    }
  }
  getStoredViewCustomizationsValue() {
    return this.storageService.get(ViewDescriptorService.VIEWS_CUSTOMIZATIONS, StorageScope.PROFILE, "{}");
  }
  setStoredViewCustomizationsValue(value) {
    this.storageService.store(ViewDescriptorService.VIEWS_CUSTOMIZATIONS, value, StorageScope.PROFILE, StorageTarget.USER);
  }
  getViewsByContainer(viewContainer) {
    const result = this.viewsRegistry.getViews(viewContainer).filter((viewDescriptor) => {
      const viewDescriptorViewContainerId = this.viewDescriptorsCustomLocations.get(viewDescriptor.id) ?? viewContainer.id;
      return viewDescriptorViewContainerId === viewContainer.id;
    });
    for (const [viewId, viewContainerId] of this.viewDescriptorsCustomLocations.entries()) {
      if (viewContainerId !== viewContainer.id) {
        continue;
      }
      if (this.viewsRegistry.getViewContainer(viewId) === viewContainer) {
        continue;
      }
      const viewDescriptor = this.getViewDescriptorById(viewId);
      if (viewDescriptor) {
        result.push(viewDescriptor);
      }
    }
    return result;
  }
  onDidRegisterViewContainer(viewContainer) {
    const defaultLocation = this.isGeneratedContainerId(viewContainer.id) ? true : this.getViewContainerLocation(viewContainer) === this.getDefaultViewContainerLocation(viewContainer);
    this.getOrCreateDefaultViewContainerLocationContextKey(viewContainer).set(defaultLocation);
    this.getOrRegisterViewContainerModel(viewContainer);
  }
  getOrRegisterViewContainerModel(viewContainer) {
    let viewContainerModel = this.viewContainerModels.get(viewContainer)?.viewContainerModel;
    if (!viewContainerModel) {
      const disposables = new DisposableStore();
      viewContainerModel = disposables.add(this.instantiationService.createInstance(ViewContainerModel, viewContainer));
      this.onDidChangeActiveViews({ added: viewContainerModel.activeViewDescriptors, removed: [] });
      viewContainerModel.onDidChangeActiveViewDescriptors((changed) => this.onDidChangeActiveViews(changed), this, disposables);
      this.onDidChangeVisibleViews({ added: [...viewContainerModel.visibleViewDescriptors], removed: [] });
      viewContainerModel.onDidAddVisibleViewDescriptors((added) => this.onDidChangeVisibleViews({ added: added.map(({ viewDescriptor }) => viewDescriptor), removed: [] }), this, disposables);
      viewContainerModel.onDidRemoveVisibleViewDescriptors((removed) => this.onDidChangeVisibleViews({ added: [], removed: removed.map(({ viewDescriptor }) => viewDescriptor) }), this, disposables);
      disposables.add(toDisposable(() => this.viewsVisibilityActionDisposables.deleteAndDispose(viewContainer)));
      disposables.add(this.registerResetViewContainerAction(viewContainer));
      const value = { viewContainerModel, disposables, dispose: () => disposables.dispose() };
      this.viewContainerModels.set(viewContainer, value);
      this.onDidRegisterViews([{ views: this.viewsRegistry.getViews(viewContainer), viewContainer }]);
      const viewsToRegister = this.getViewsByContainer(viewContainer).filter((view) => this.getDefaultContainerById(view.id) !== viewContainer);
      if (viewsToRegister.length) {
        this.addViews(viewContainer, viewsToRegister);
        this.contextKeyService.bufferChangeEvents(() => {
          viewsToRegister.forEach((viewDescriptor) => this.getOrCreateMovableViewContextKey(viewDescriptor).set(!!viewDescriptor.canMoveView));
        });
      }
      if (this.canRegisterViewsVisibilityActions) {
        this.registerViewsVisibilityActions(viewContainer, value);
      }
    }
    return viewContainerModel;
  }
  onDidDeregisterViewContainer(viewContainer) {
    this.viewContainerModels.deleteAndDispose(viewContainer);
    this.viewsVisibilityActionDisposables.deleteAndDispose(viewContainer);
  }
  onDidChangeActiveViews({ added, removed }) {
    this.contextKeyService.bufferChangeEvents(() => {
      added.forEach((viewDescriptor) => this.getOrCreateActiveViewContextKey(viewDescriptor).set(true));
      removed.forEach((viewDescriptor) => this.getOrCreateActiveViewContextKey(viewDescriptor).set(false));
    });
  }
  onDidChangeVisibleViews({ added, removed }) {
    this.contextKeyService.bufferChangeEvents(() => {
      added.forEach((viewDescriptor) => this.getOrCreateVisibleViewContextKey(viewDescriptor).set(true));
      removed.forEach((viewDescriptor) => this.getOrCreateVisibleViewContextKey(viewDescriptor).set(false));
    });
  }
  registerViewsVisibilityActions(viewContainer, { viewContainerModel, disposables }) {
    this.viewsVisibilityActionDisposables.deleteAndDispose(viewContainer);
    this.viewsVisibilityActionDisposables.set(viewContainer, this.registerViewsVisibilityActionsForContainer(viewContainerModel));
    disposables.add(Event.any(
      viewContainerModel.onDidChangeActiveViewDescriptors,
      viewContainerModel.onDidAddVisibleViewDescriptors,
      viewContainerModel.onDidRemoveVisibleViewDescriptors,
      viewContainerModel.onDidMoveVisibleViewDescriptors
    )((e) => {
      this.viewsVisibilityActionDisposables.deleteAndDispose(viewContainer);
      this.viewsVisibilityActionDisposables.set(viewContainer, this.registerViewsVisibilityActionsForContainer(viewContainerModel));
    }));
  }
  registerViewsVisibilityActionsForContainer(viewContainerModel) {
    const disposables = new DisposableStore();
    viewContainerModel.activeViewDescriptors.forEach((viewDescriptor, index) => {
      if (!viewDescriptor.remoteAuthority) {
        disposables.add(registerAction2(class extends ViewPaneContainerAction {
          constructor() {
            super({
              id: `${viewDescriptor.id}.toggleVisibility`,
              viewPaneContainerId: viewContainerModel.viewContainer.id,
              precondition: viewDescriptor.canToggleVisibility && (!viewContainerModel.isVisible(viewDescriptor.id) || viewContainerModel.visibleViewDescriptors.length > 1) ? ContextKeyExpr.true() : ContextKeyExpr.false(),
              toggled: ContextKeyExpr.has(`${viewDescriptor.id}.visible`),
              title: viewDescriptor.name,
              metadata: {
                description: localize2("toggleVisibilityDescription", "Toggles the visibility of the {0} view if the view container it is located in is visible", viewDescriptor.name.value)
              },
              menu: [{
                id: ViewsSubMenu,
                when: ContextKeyExpr.equals("viewContainer", viewContainerModel.viewContainer.id),
                order: index
              }, {
                id: MenuId.ViewContainerTitleContext,
                when: ContextKeyExpr.equals("viewContainer", viewContainerModel.viewContainer.id),
                order: index,
                group: "1_toggleVisibility"
              }, {
                id: MenuId.ViewTitleContext,
                when: ContextKeyExpr.or(...viewContainerModel.visibleViewDescriptors.map((v) => ContextKeyExpr.equals("view", v.id))),
                order: index,
                group: "2_toggleVisibility"
              }]
            });
          }
          async runInViewPaneContainer(serviceAccessor, viewPaneContainer) {
            viewPaneContainer.toggleViewVisibility(viewDescriptor.id);
          }
        }));
        disposables.add(registerAction2(class extends ViewPaneContainerAction {
          constructor() {
            super({
              id: `${viewDescriptor.id}.removeView`,
              viewPaneContainerId: viewContainerModel.viewContainer.id,
              title: localize("hideView", "Hide '{0}'", viewDescriptor.name.value),
              metadata: {
                description: localize2("hideViewDescription", "Hides the {0} view if it is visible and the view container it is located in is visible", viewDescriptor.name.value)
              },
              precondition: viewDescriptor.canToggleVisibility && (!viewContainerModel.isVisible(viewDescriptor.id) || viewContainerModel.visibleViewDescriptors.length > 1) ? ContextKeyExpr.true() : ContextKeyExpr.false(),
              menu: [{
                id: MenuId.ViewTitleContext,
                when: ContextKeyExpr.and(
                  ContextKeyExpr.equals("view", viewDescriptor.id),
                  ContextKeyExpr.has(`${viewDescriptor.id}.visible`)
                ),
                group: "1_hide",
                order: 1
              }]
            });
          }
          async runInViewPaneContainer(serviceAccessor, viewPaneContainer) {
            if (viewPaneContainer.getView(viewDescriptor.id)?.isVisible()) {
              viewPaneContainer.toggleViewVisibility(viewDescriptor.id);
            }
          }
        }));
      }
    });
    return disposables;
  }
  registerResetViewContainerAction(viewContainer) {
    const that = this;
    return registerAction2(class ResetViewLocationAction extends Action2 {
      constructor() {
        super({
          id: `${viewContainer.id}.resetViewContainerLocation`,
          title: localize2("resetViewLocation", "Reset Location"),
          menu: [{
            id: MenuId.ViewContainerTitleContext,
            group: "1_viewActions",
            when: ContextKeyExpr.or(
              ContextKeyExpr.and(
                ContextKeyExpr.equals("viewContainer", viewContainer.id),
                ContextKeyExpr.equals(`${viewContainer.id}.defaultViewContainerLocation`, false)
              )
            )
          }]
        });
      }
      run(accessor) {
        that.moveViewContainerToLocation(viewContainer, that.getDefaultViewContainerLocation(viewContainer), void 0, this.desc.id);
        accessor.get(IViewsService).openViewContainer(viewContainer.id, true);
      }
    });
  }
  addViews(container, views, visibilityState = ViewVisibilityState.Default) {
    this.contextKeyService.bufferChangeEvents(() => {
      views.forEach((view) => {
        const isDefaultContainer = this.getDefaultContainerById(view.id) === container;
        this.getOrCreateDefaultViewLocationContextKey(view).set(isDefaultContainer);
        if (isDefaultContainer) {
          this.viewDescriptorsCustomLocations.delete(view.id);
        } else {
          this.viewDescriptorsCustomLocations.set(view.id, container.id);
        }
      });
    });
    this.getViewContainerModel(container).add(views.map((view) => {
      return {
        viewDescriptor: view,
        collapsed: visibilityState === ViewVisibilityState.Default ? void 0 : false,
        visible: visibilityState === ViewVisibilityState.Default ? void 0 : true
      };
    }));
  }
  removeViews(container, views) {
    this.contextKeyService.bufferChangeEvents(() => {
      views.forEach((view) => {
        if (this.viewDescriptorsCustomLocations.get(view.id) === container.id) {
          this.viewDescriptorsCustomLocations.delete(view.id);
        }
        this.getOrCreateDefaultViewLocationContextKey(view).set(false);
      });
    });
    this.getViewContainerModel(container).remove(views);
  }
  getOrCreateActiveViewContextKey(viewDescriptor) {
    const activeContextKeyId = `${viewDescriptor.id}.active`;
    let contextKey = this.activeViewContextKeys.get(activeContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(activeContextKeyId, false).bindTo(this.contextKeyService);
      this.activeViewContextKeys.set(activeContextKeyId, contextKey);
    }
    return contextKey;
  }
  getOrCreateVisibleViewContextKey(viewDescriptor) {
    const activeContextKeyId = `${viewDescriptor.id}.visible`;
    let contextKey = this.activeViewContextKeys.get(activeContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(activeContextKeyId, false).bindTo(this.contextKeyService);
      this.activeViewContextKeys.set(activeContextKeyId, contextKey);
    }
    return contextKey;
  }
  getOrCreateMovableViewContextKey(viewDescriptor) {
    const movableViewContextKeyId = `${viewDescriptor.id}.canMove`;
    let contextKey = this.movableViewContextKeys.get(movableViewContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(movableViewContextKeyId, false).bindTo(this.contextKeyService);
      this.movableViewContextKeys.set(movableViewContextKeyId, contextKey);
    }
    return contextKey;
  }
  getOrCreateDefaultViewLocationContextKey(viewDescriptor) {
    const defaultViewLocationContextKeyId = `${viewDescriptor.id}.defaultViewLocation`;
    let contextKey = this.defaultViewLocationContextKeys.get(defaultViewLocationContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(defaultViewLocationContextKeyId, false).bindTo(this.contextKeyService);
      this.defaultViewLocationContextKeys.set(defaultViewLocationContextKeyId, contextKey);
    }
    return contextKey;
  }
  getOrCreateDefaultViewContainerLocationContextKey(viewContainer) {
    const defaultViewContainerLocationContextKeyId = `${viewContainer.id}.defaultViewContainerLocation`;
    let contextKey = this.defaultViewContainerLocationContextKeys.get(defaultViewContainerLocationContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(defaultViewContainerLocationContextKeyId, false).bindTo(this.contextKeyService);
      this.defaultViewContainerLocationContextKeys.set(defaultViewContainerLocationContextKeyId, contextKey);
    }
    return contextKey;
  }
};
ViewDescriptorService.VIEWS_CUSTOMIZATIONS = "views.customizations";
ViewDescriptorService.COMMON_CONTAINER_ID_PREFIX = "workbench.views.service";
ViewDescriptorService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, ILoggerService)
], ViewDescriptorService);
registerSingleton(IViewDescriptorService, ViewDescriptorService, InstantiationType.Delayed);
export {
  ViewDescriptorService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdmlld3MvYnJvd3Nlci92aWV3RGVzY3JpcHRvclNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBWaWV3Q29udGFpbmVyTG9jYXRpb24sIElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIFZpZXdDb250YWluZXIsIElWaWV3c1JlZ2lzdHJ5LCBJVmlld0NvbnRhaW5lcnNSZWdpc3RyeSwgSVZpZXdEZXNjcmlwdG9yLCBFeHRlbnNpb25zIGFzIFZpZXdFeHRlbnNpb25zLCBWaWV3VmlzaWJpbGl0eVN0YXRlLCBkZWZhdWx0Vmlld0ljb24sIFZpZXdDb250YWluZXJMb2NhdGlvblRvU3RyaW5nLCBWSUVXU19MT0dfSUQsIFZJRVdTX0xPR19OQU1FIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBSYXdDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IHRvRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZUNvbnRhaW5lciwgVmlld1BhbmVDb250YWluZXJBY3Rpb24sIFZpZXdzU3ViTWVudSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmVDb250YWluZXIuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgZ2V0Vmlld3NTdGF0ZVN0b3JhZ2VJZCwgVmlld0NvbnRhaW5lck1vZGVsIH0gZnJvbSAnLi4vY29tbW9uL3ZpZXdDb250YWluZXJNb2RlbC5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIsIE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IElMb2dnZXIsIElMb2dnZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgd2luZG93TG9nR3JvdXAgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZ0NvbnN0YW50cy5qcyc7XG5cbmludGVyZmFjZSBJVmlld3NDdXN0b21pemF0aW9ucyB7XG5cdHZpZXdDb250YWluZXJMb2NhdGlvbnM6IElTdHJpbmdEaWN0aW9uYXJ5PFZpZXdDb250YWluZXJMb2NhdGlvbj47XG5cdHZpZXdMb2NhdGlvbnM6IElTdHJpbmdEaWN0aW9uYXJ5PHN0cmluZz47XG5cdHZpZXdDb250YWluZXJCYWRnZUVuYWJsZW1lbnRTdGF0ZXM6IElTdHJpbmdEaWN0aW9uYXJ5PGJvb2xlYW4+O1xufVxuXG5mdW5jdGlvbiBnZXRWaWV3Q29udGFpbmVyU3RvcmFnZUlkKHZpZXdDb250YWluZXJJZDogc3RyaW5nKTogc3RyaW5nIHsgcmV0dXJuIGAke3ZpZXdDb250YWluZXJJZH0uc3RhdGVgOyB9XG5cbmV4cG9ydCBjbGFzcyBWaWV3RGVzY3JpcHRvclNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVklFV1NfQ1VTVE9NSVpBVElPTlMgPSAndmlld3MuY3VzdG9taXphdGlvbnMnO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBDT01NT05fQ09OVEFJTkVSX0lEX1BSRUZJWCA9ICd3b3JrYmVuY2gudmlld3Muc2VydmljZSc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb250YWluZXI6IEVtaXR0ZXI8eyB2aWV3czogSVZpZXdEZXNjcmlwdG9yW107IGZyb206IFZpZXdDb250YWluZXI7IHRvOiBWaWV3Q29udGFpbmVyIH0+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyB2aWV3czogSVZpZXdEZXNjcmlwdG9yW107IGZyb206IFZpZXdDb250YWluZXI7IHRvOiBWaWV3Q29udGFpbmVyIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbnRhaW5lcjogRXZlbnQ8eyB2aWV3czogSVZpZXdEZXNjcmlwdG9yW107IGZyb206IFZpZXdDb250YWluZXI7IHRvOiBWaWV3Q29udGFpbmVyIH0+ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250YWluZXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VMb2NhdGlvbjogRW1pdHRlcjx7IHZpZXdzOiBJVmlld0Rlc2NyaXB0b3JbXTsgZnJvbTogVmlld0NvbnRhaW5lckxvY2F0aW9uOyB0bzogVmlld0NvbnRhaW5lckxvY2F0aW9uIH0+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyB2aWV3czogSVZpZXdEZXNjcmlwdG9yW107IGZyb206IFZpZXdDb250YWluZXJMb2NhdGlvbjsgdG86IFZpZXdDb250YWluZXJMb2NhdGlvbiB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VMb2NhdGlvbjogRXZlbnQ8eyB2aWV3czogSVZpZXdEZXNjcmlwdG9yW107IGZyb206IFZpZXdDb250YWluZXJMb2NhdGlvbjsgdG86IFZpZXdDb250YWluZXJMb2NhdGlvbiB9PiA9IHRoaXMuX29uRGlkQ2hhbmdlTG9jYXRpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb250YWluZXJMb2NhdGlvbjogRW1pdHRlcjx7IHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXI7IGZyb206IFZpZXdDb250YWluZXJMb2NhdGlvbjsgdG86IFZpZXdDb250YWluZXJMb2NhdGlvbiB9PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgdmlld0NvbnRhaW5lcjogVmlld0NvbnRhaW5lcjsgZnJvbTogVmlld0NvbnRhaW5lckxvY2F0aW9uOyB0bzogVmlld0NvbnRhaW5lckxvY2F0aW9uIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbnRhaW5lckxvY2F0aW9uOiBFdmVudDx7IHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXI7IGZyb206IFZpZXdDb250YWluZXJMb2NhdGlvbjsgdG86IFZpZXdDb250YWluZXJMb2NhdGlvbiB9PiA9IHRoaXMuX29uRGlkQ2hhbmdlQ29udGFpbmVyTG9jYXRpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSB2aWV3Q29udGFpbmVyTW9kZWxzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVNYXA8Vmlld0NvbnRhaW5lciwgeyB2aWV3Q29udGFpbmVyTW9kZWw6IFZpZXdDb250YWluZXJNb2RlbDsgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSB9ICYgSURpc3Bvc2FibGU+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdzVmlzaWJpbGl0eUFjdGlvbkRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVNYXA8Vmlld0NvbnRhaW5lciwgSURpc3Bvc2FibGU+KCkpO1xuXHRwcml2YXRlIGNhblJlZ2lzdGVyVmlld3NWaXNpYmlsaXR5QWN0aW9uczogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGl2ZVZpZXdDb250ZXh0S2V5czogTWFwPHN0cmluZywgSUNvbnRleHRLZXk8Ym9vbGVhbj4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IG1vdmFibGVWaWV3Q29udGV4dEtleXM6IE1hcDxzdHJpbmcsIElDb250ZXh0S2V5PGJvb2xlYW4+Pjtcblx0cHJpdmF0ZSByZWFkb25seSBkZWZhdWx0Vmlld0xvY2F0aW9uQ29udGV4dEtleXM6IE1hcDxzdHJpbmcsIElDb250ZXh0S2V5PGJvb2xlYW4+Pjtcblx0cHJpdmF0ZSByZWFkb25seSBkZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uQ29udGV4dEtleXM6IE1hcDxzdHJpbmcsIElDb250ZXh0S2V5PGJvb2xlYW4+PjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdzUmVnaXN0cnk6IElWaWV3c1JlZ2lzdHJ5O1xuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdDb250YWluZXJzUmVnaXN0cnk6IElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5O1xuXG5cdHByaXZhdGUgdmlld0NvbnRhaW5lcnNDdXN0b21Mb2NhdGlvbnM6IE1hcDxzdHJpbmcsIFZpZXdDb250YWluZXJMb2NhdGlvbj47XG5cdHByaXZhdGUgdmlld0Rlc2NyaXB0b3JzQ3VzdG9tTG9jYXRpb25zOiBNYXA8c3RyaW5nLCBzdHJpbmc+O1xuXHRwcml2YXRlIHZpZXdDb250YWluZXJCYWRnZUVuYWJsZW1lbnRTdGF0ZXM6IE1hcDxzdHJpbmcsIGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVmlld0NvbnRhaW5lcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGFkZGVkOiBSZWFkb25seUFycmF5PHsgY29udGFpbmVyOiBWaWV3Q29udGFpbmVyOyBsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uIH0+OyByZW1vdmVkOiBSZWFkb25seUFycmF5PHsgY29udGFpbmVyOiBWaWV3Q29udGFpbmVyOyBsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uIH0+IH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVZpZXdDb250YWluZXJzID0gdGhpcy5fb25EaWRDaGFuZ2VWaWV3Q29udGFpbmVycy5ldmVudDtcblx0Z2V0IHZpZXdDb250YWluZXJzKCk6IFJlYWRvbmx5QXJyYXk8Vmlld0NvbnRhaW5lcj4geyByZXR1cm4gdGhpcy52aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmFsbDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgbG9nZ2VyOiBMYXp5PElMb2dnZXI+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJTG9nZ2VyU2VydmljZSBsb2dnZXJTZXJ2aWNlOiBJTG9nZ2VyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMubG9nZ2VyID0gbmV3IExhenkoKCkgPT4gbG9nZ2VyU2VydmljZS5jcmVhdGVMb2dnZXIoVklFV1NfTE9HX0lELCB7IG5hbWU6IFZJRVdTX0xPR19OQU1FLCBncm91cDogd2luZG93TG9nR3JvdXAgfSkpO1xuXG5cdFx0dGhpcy5hY3RpdmVWaWV3Q29udGV4dEtleXMgPSBuZXcgTWFwPHN0cmluZywgSUNvbnRleHRLZXk8Ym9vbGVhbj4+KCk7XG5cdFx0dGhpcy5tb3ZhYmxlVmlld0NvbnRleHRLZXlzID0gbmV3IE1hcDxzdHJpbmcsIElDb250ZXh0S2V5PGJvb2xlYW4+PigpO1xuXHRcdHRoaXMuZGVmYXVsdFZpZXdMb2NhdGlvbkNvbnRleHRLZXlzID0gbmV3IE1hcDxzdHJpbmcsIElDb250ZXh0S2V5PGJvb2xlYW4+PigpO1xuXHRcdHRoaXMuZGVmYXVsdFZpZXdDb250YWluZXJMb2NhdGlvbkNvbnRleHRLZXlzID0gbmV3IE1hcDxzdHJpbmcsIElDb250ZXh0S2V5PGJvb2xlYW4+PigpO1xuXG5cdFx0dGhpcy52aWV3Q29udGFpbmVyc1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdDb250YWluZXJzUmVnaXN0cnk+KFZpZXdFeHRlbnNpb25zLlZpZXdDb250YWluZXJzUmVnaXN0cnkpO1xuXHRcdHRoaXMudmlld3NSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihWaWV3RXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KTtcblxuXHRcdHRoaXMubWlncmF0ZVRvVmlld3NDdXN0b21pemF0aW9uc1N0b3JhZ2UoKTtcblx0XHR0aGlzLnZpZXdDb250YWluZXJzQ3VzdG9tTG9jYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIFZpZXdDb250YWluZXJMb2NhdGlvbj4oT2JqZWN0LmVudHJpZXModGhpcy52aWV3Q3VzdG9taXphdGlvbnMudmlld0NvbnRhaW5lckxvY2F0aW9ucykpO1xuXHRcdHRoaXMudmlld0Rlc2NyaXB0b3JzQ3VzdG9tTG9jYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oT2JqZWN0LmVudHJpZXModGhpcy52aWV3Q3VzdG9taXphdGlvbnMudmlld0xvY2F0aW9ucykpO1xuXHRcdHRoaXMudmlld0NvbnRhaW5lckJhZGdlRW5hYmxlbWVudFN0YXRlcyA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPihPYmplY3QuZW50cmllcyh0aGlzLnZpZXdDdXN0b21pemF0aW9ucy52aWV3Q29udGFpbmVyQmFkZ2VFbmFibGVtZW50U3RhdGVzKSk7XG5cblx0XHQvLyBSZWdpc3RlciBhbGwgY29udGFpbmVycyB0aGF0IHdlcmUgcmVnaXN0ZXJlZCBiZWZvcmUgdGhpcyBjdG9yXG5cdFx0dGhpcy52aWV3Q29udGFpbmVycy5mb3JFYWNoKHZpZXdDb250YWluZXIgPT4gdGhpcy5vbkRpZFJlZ2lzdGVyVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdzUmVnaXN0cnkub25WaWV3c1JlZ2lzdGVyZWQodmlld3MgPT4gdGhpcy5vbkRpZFJlZ2lzdGVyVmlld3Modmlld3MpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3c1JlZ2lzdHJ5Lm9uVmlld3NEZXJlZ2lzdGVyZWQoKHsgdmlld3MsIHZpZXdDb250YWluZXIgfSkgPT4gdGhpcy5vbkRpZERlcmVnaXN0ZXJWaWV3cyh2aWV3cywgdmlld0NvbnRhaW5lcikpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld3NSZWdpc3RyeS5vbkRpZENoYW5nZUNvbnRhaW5lcigoeyB2aWV3cywgZnJvbSwgdG8gfSkgPT4gdGhpcy5vbkRpZENoYW5nZURlZmF1bHRDb250YWluZXIodmlld3MsIGZyb20sIHRvKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3Q29udGFpbmVyc1JlZ2lzdHJ5Lm9uRGlkUmVnaXN0ZXIoKHsgdmlld0NvbnRhaW5lciB9KSA9PiB7XG5cdFx0XHR0aGlzLm9uRGlkUmVnaXN0ZXJWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXIpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaWV3Q29udGFpbmVycy5maXJlKHsgYWRkZWQ6IFt7IGNvbnRhaW5lcjogdmlld0NvbnRhaW5lciwgbG9jYXRpb246IHRoaXMuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIpIH1dLCByZW1vdmVkOiBbXSB9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdDb250YWluZXJzUmVnaXN0cnkub25EaWREZXJlZ2lzdGVyKCh7IHZpZXdDb250YWluZXIsIHZpZXdDb250YWluZXJMb2NhdGlvbiB9KSA9PiB7XG5cdFx0XHR0aGlzLm9uRGlkRGVyZWdpc3RlclZpZXdDb250YWluZXIodmlld0NvbnRhaW5lcik7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZpZXdDb250YWluZXJzLmZpcmUoeyByZW1vdmVkOiBbeyBjb250YWluZXI6IHZpZXdDb250YWluZXIsIGxvY2F0aW9uOiB2aWV3Q29udGFpbmVyTG9jYXRpb24gfV0sIGFkZGVkOiBbXSB9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFZpZXdEZXNjcmlwdG9yU2VydmljZS5WSUVXU19DVVNUT01JWkFUSU9OUywgdGhpcy5fc3RvcmUpKCgpID0+IHRoaXMub25EaWRTdG9yYWdlQ2hhbmdlKCkpKTtcblxuXHRcdHRoaXMuZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKS50aGVuKCgpID0+IHRoaXMud2hlbkV4dGVuc2lvbnNSZWdpc3RlcmVkKCkpO1xuXG5cdH1cblxuXHRwcml2YXRlIG1pZ3JhdGVUb1ZpZXdzQ3VzdG9taXphdGlvbnNTdG9yYWdlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChWaWV3RGVzY3JpcHRvclNlcnZpY2UuVklFV1NfQ1VTVE9NSVpBVElPTlMsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdDb250YWluZXJMb2NhdGlvbnNWYWx1ZSA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KCd2aWV3cy5jYWNoZWRWaWV3Q29udGFpbmVyTG9jYXRpb25zJywgU3RvcmFnZVNjb3BlLlBST0ZJTEUpO1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yTG9jYXRpb25zVmFsdWUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldCgndmlld3MuY2FjaGVkVmlld1Bvc2l0aW9ucycsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0XHRpZiAoIXZpZXdDb250YWluZXJMb2NhdGlvbnNWYWx1ZSAmJiAhdmlld0Rlc2NyaXB0b3JMb2NhdGlvbnNWYWx1ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdDb250YWluZXJMb2NhdGlvbnM6IFtzdHJpbmcsIFZpZXdDb250YWluZXJMb2NhdGlvbl1bXSA9IHZpZXdDb250YWluZXJMb2NhdGlvbnNWYWx1ZSA/IEpTT04ucGFyc2Uodmlld0NvbnRhaW5lckxvY2F0aW9uc1ZhbHVlKSA6IFtdO1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yTG9jYXRpb25zOiBbc3RyaW5nLCB7IGNvbnRhaW5lcklkOiBzdHJpbmcgfV1bXSA9IHZpZXdEZXNjcmlwdG9yTG9jYXRpb25zVmFsdWUgPyBKU09OLnBhcnNlKHZpZXdEZXNjcmlwdG9yTG9jYXRpb25zVmFsdWUpIDogW107XG5cdFx0Y29uc3Qgdmlld3NDdXN0b21pemF0aW9uczogSVZpZXdzQ3VzdG9taXphdGlvbnMgPSB7XG5cdFx0XHR2aWV3Q29udGFpbmVyTG9jYXRpb25zOiB2aWV3Q29udGFpbmVyTG9jYXRpb25zLnJlZHVjZTxJU3RyaW5nRGljdGlvbmFyeTxWaWV3Q29udGFpbmVyTG9jYXRpb24+PigocmVzdWx0LCBbaWQsIGxvY2F0aW9uXSkgPT4geyByZXN1bHRbaWRdID0gbG9jYXRpb247IHJldHVybiByZXN1bHQ7IH0sIHt9KSxcblx0XHRcdHZpZXdMb2NhdGlvbnM6IHZpZXdEZXNjcmlwdG9yTG9jYXRpb25zLnJlZHVjZTxJU3RyaW5nRGljdGlvbmFyeTxzdHJpbmc+PigocmVzdWx0LCBbaWQsIHsgY29udGFpbmVySWQgfV0pID0+IHsgcmVzdWx0W2lkXSA9IGNvbnRhaW5lcklkOyByZXR1cm4gcmVzdWx0OyB9LCB7fSksXG5cdFx0XHR2aWV3Q29udGFpbmVyQmFkZ2VFbmFibGVtZW50U3RhdGVzOiB7fVxuXHRcdH07XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShWaWV3RGVzY3JpcHRvclNlcnZpY2UuVklFV1NfQ1VTVE9NSVpBVElPTlMsIEpTT04uc3RyaW5naWZ5KHZpZXdzQ3VzdG9taXphdGlvbnMpLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZSgndmlld3MuY2FjaGVkVmlld0NvbnRhaW5lckxvY2F0aW9ucycsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZSgndmlld3MuY2FjaGVkVmlld1Bvc2l0aW9ucycsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJHcm91cGVkVmlld3MoZ3JvdXBlZFZpZXdzOiBNYXA8c3RyaW5nLCBJVmlld0Rlc2NyaXB0b3JbXT4pOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IFtjb250YWluZXJJZCwgdmlld3NdIG9mIGdyb3VwZWRWaWV3cy5lbnRyaWVzKCkpIHtcblx0XHRcdGNvbnN0IHZpZXdDb250YWluZXIgPSB0aGlzLnZpZXdDb250YWluZXJzUmVnaXN0cnkuZ2V0KGNvbnRhaW5lcklkKTtcblxuXHRcdFx0Ly8gVGhlIGNvbnRhaW5lciBoYXMgbm90IGJlZW4gcmVnaXN0ZXJlZCB5ZXRcblx0XHRcdGlmICghdmlld0NvbnRhaW5lciB8fCAhdGhpcy52aWV3Q29udGFpbmVyTW9kZWxzLmhhcyh2aWV3Q29udGFpbmVyKSkge1xuXHRcdFx0XHQvLyBSZWdpc3RlciBpZiB0aGUgY29udGFpbmVyIGlzIGEgZ2VuYXJhdGVkIGNvbnRhaW5lclxuXHRcdFx0XHRpZiAodGhpcy5pc0dlbmVyYXRlZENvbnRhaW5lcklkKGNvbnRhaW5lcklkKSkge1xuXHRcdFx0XHRcdGNvbnN0IHZpZXdDb250YWluZXJMb2NhdGlvbiA9IHRoaXMudmlld0NvbnRhaW5lcnNDdXN0b21Mb2NhdGlvbnMuZ2V0KGNvbnRhaW5lcklkKTtcblx0XHRcdFx0XHRpZiAodmlld0NvbnRhaW5lckxvY2F0aW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMucmVnaXN0ZXJHZW5lcmF0ZWRWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXJMb2NhdGlvbiwgY29udGFpbmVySWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBSZWdpc3RyYXRpb24gb2YgdGhlIGNvbnRhaW5lciBoYW5kbGVzIHJlZ2lzdHJhdGlvbiBvZiBpdHMgdmlld3Ncblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZpbHRlciBvdXQgdmlld3MgdGhhdCBoYXZlIGFscmVhZHkgYmVlbiBhZGRlZCB0byB0aGUgdmlldyBjb250YWluZXIgbW9kZWxcblx0XHRcdC8vIFRoaXMgaXMgbmVlZGVkIHdoZW4gc3RhdGljYWxseS1yZWdpc3RlcmVkIHZpZXdzIGFyZSBtb3ZlZCB0b1xuXHRcdFx0Ly8gb3RoZXIgc3RhdGljYWxseSByZWdpc3RlcmVkIGNvbnRhaW5lcnMgYXMgdGhleSB3aWxsIGJvdGggdHJ5IHRvIGFkZCBvbiBzdGFydHVwXG5cdFx0XHRjb25zdCB2aWV3c1RvQWRkID0gdmlld3MuZmlsdGVyKHZpZXcgPT4gdGhpcy5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lcikuYWxsVmlld0Rlc2NyaXB0b3JzLmZpbHRlcih2ZCA9PiB2ZC5pZCA9PT0gdmlldy5pZCkubGVuZ3RoID09PSAwKTtcblx0XHRcdHRoaXMuYWRkVmlld3Modmlld0NvbnRhaW5lciwgdmlld3NUb0FkZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkZXJlZ2lzdGVyR3JvdXBlZFZpZXdzKGdyb3VwZWRWaWV3czogTWFwPHN0cmluZywgSVZpZXdEZXNjcmlwdG9yW10+KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBbdmlld0NvbnRhaW5lcklkLCB2aWV3c10gb2YgZ3JvdXBlZFZpZXdzLmVudHJpZXMoKSkge1xuXHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0NvbnRhaW5lcnNSZWdpc3RyeS5nZXQodmlld0NvbnRhaW5lcklkKTtcblxuXHRcdFx0Ly8gVGhlIGNvbnRhaW5lciBoYXMgbm90IGJlZW4gcmVnaXN0ZXJlZCB5ZXRcblx0XHRcdGlmICghdmlld0NvbnRhaW5lciB8fCAhdGhpcy52aWV3Q29udGFpbmVyTW9kZWxzLmhhcyh2aWV3Q29udGFpbmVyKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5yZW1vdmVWaWV3cyh2aWV3Q29udGFpbmVyLCB2aWV3cyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBtb3ZlT3JwaGFuVmlld3NUb0RlZmF1bHRMb2NhdGlvbigpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IFt2aWV3SWQsIGNvbnRhaW5lcklkXSBvZiB0aGlzLnZpZXdEZXNjcmlwdG9yc0N1c3RvbUxvY2F0aW9ucy5lbnRyaWVzKCkpIHtcblx0XHRcdC8vIGNoZWNrIGlmIHRoZSB2aWV3IGNvbnRhaW5lciBleGlzdHNcblx0XHRcdGlmICh0aGlzLnZpZXdDb250YWluZXJzUmVnaXN0cnkuZ2V0KGNvbnRhaW5lcklkKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gY2hlY2sgaWYgdmlldyBoYXMgYmVlbiByZWdpc3RlcmVkIHRvIGRlZmF1bHQgbG9jYXRpb25cblx0XHRcdGNvbnN0IHZpZXdDb250YWluZXIgPSB0aGlzLnZpZXdzUmVnaXN0cnkuZ2V0Vmlld0NvbnRhaW5lcih2aWV3SWQpO1xuXHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3IgPSB0aGlzLmdldFZpZXdEZXNjcmlwdG9yQnlJZCh2aWV3SWQpO1xuXHRcdFx0aWYgKHZpZXdDb250YWluZXIgJiYgdmlld0Rlc2NyaXB0b3IpIHtcblx0XHRcdFx0dGhpcy5hZGRWaWV3cyh2aWV3Q29udGFpbmVyLCBbdmlld0Rlc2NyaXB0b3JdKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR3aGVuRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKTogdm9pZCB7XG5cblx0XHQvLyBIYW5kbGUgdGhvc2Ugdmlld3Mgd2hvc2UgY3VzdG9tIHBhcmVudCB2aWV3IGNvbnRhaW5lciBkb2VzIG5vdCBleGlzdCBhbnltb3JlXG5cdFx0Ly8gTWF5IGJlIHRoZSBleHRlbnNpb24gY29udHJpYnV0aW5nIHRoaXMgdmlldyBjb250YWluZXIgaXMgbm8gbG9uZ2VyIGluc3RhbGxlZFxuXHRcdC8vIE9yIHRoZSBwYXJlbnQgdmlldyBjb250YWluZXIgaXMgZ2VuZXJhdGVkIGFuZCBubyBsb25nZXIgYXZhaWxhYmxlLlxuXHRcdHRoaXMubW92ZU9ycGhhblZpZXdzVG9EZWZhdWx0TG9jYXRpb24oKTtcblxuXHRcdC8vIENsZWFuIHVwIGVtcHR5IGdlbmVyYXRlZCB2aWV3IGNvbnRhaW5lcnNcblx0XHRmb3IgKGNvbnN0IHZpZXdDb250YWluZXJJZCBvZiBbLi4udGhpcy52aWV3Q29udGFpbmVyc0N1c3RvbUxvY2F0aW9ucy5rZXlzKCldKSB7XG5cdFx0XHR0aGlzLmNsZWFuVXBHZW5lcmF0ZWRWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXJJZCk7XG5cdFx0fVxuXG5cdFx0Ly8gU2F2ZSB1cGRhdGVkIHZpZXcgY3VzdG9taXphdGlvbnMgYWZ0ZXIgY2xlYW51cFxuXHRcdHRoaXMuc2F2ZVZpZXdDdXN0b21pemF0aW9ucygpO1xuXG5cdFx0Ly8gUmVnaXN0ZXIgdmlzaWJpbGl0eSBhY3Rpb25zIGZvciBhbGwgdmlld3Ncblx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiB0aGlzLnZpZXdDb250YWluZXJNb2RlbHMpIHtcblx0XHRcdHRoaXMucmVnaXN0ZXJWaWV3c1Zpc2liaWxpdHlBY3Rpb25zKGtleSwgdmFsdWUpO1xuXHRcdH1cblx0XHR0aGlzLmNhblJlZ2lzdGVyVmlld3NWaXNpYmlsaXR5QWN0aW9ucyA9IHRydWU7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkUmVnaXN0ZXJWaWV3cyh2aWV3czogeyB2aWV3czogSVZpZXdEZXNjcmlwdG9yW107IHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIgfVtdKTogdm9pZCB7XG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZS5idWZmZXJDaGFuZ2VFdmVudHMoKCkgPT4ge1xuXHRcdFx0dmlld3MuZm9yRWFjaCgoeyB2aWV3cywgdmlld0NvbnRhaW5lciB9KSA9PiB7XG5cdFx0XHRcdC8vIFdoZW4gdmlld3MgYXJlIHJlZ2lzdGVyZWQsIHdlIG5lZWQgdG8gcmVncm91cCB0aGVtIGJhc2VkIG9uIHRoZSBjdXN0b21pemF0aW9uc1xuXHRcdFx0XHRjb25zdCByZWdyb3VwZWRWaWV3cyA9IHRoaXMucmVncm91cFZpZXdzKHZpZXdDb250YWluZXIuaWQsIHZpZXdzKTtcblxuXHRcdFx0XHQvLyBPbmNlIHRoZXkgYXJlIGdyb3VwZWQsIHRyeSByZWdpc3RlcmluZyB0aGVtIHdoaWNoIG9jY3Vyc1xuXHRcdFx0XHQvLyBpZiB0aGUgY29udGFpbmVyIGhhcyBhbHJlYWR5IGJlZW4gcmVnaXN0ZXJlZCB3aXRoaW4gdGhpcyBzZXJ2aWNlXG5cdFx0XHRcdC8vIG9yIHdlIGNhbiBnZW5lcmF0ZSB0aGUgY29udGFpbmVyIGZyb20gdGhlIHNvdXJjZSB2aWV3IGlkXG5cdFx0XHRcdHRoaXMucmVnaXN0ZXJHcm91cGVkVmlld3MocmVncm91cGVkVmlld3MpO1xuXG5cdFx0XHRcdHZpZXdzLmZvckVhY2godmlld0Rlc2NyaXB0b3IgPT4gdGhpcy5nZXRPckNyZWF0ZU1vdmFibGVWaWV3Q29udGV4dEtleSh2aWV3RGVzY3JpcHRvcikuc2V0KCEhdmlld0Rlc2NyaXB0b3IuY2FuTW92ZVZpZXcpKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0dlbmVyYXRlZENvbnRhaW5lcklkKGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaWQuc3RhcnRzV2l0aChWaWV3RGVzY3JpcHRvclNlcnZpY2UuQ09NTU9OX0NPTlRBSU5FUl9JRF9QUkVGSVgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZERlcmVnaXN0ZXJWaWV3cyh2aWV3czogSVZpZXdEZXNjcmlwdG9yW10sIHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHQvLyBXaGVuIHZpZXdzIGFyZSByZWdpc3RlcmVkLCB3ZSBuZWVkIHRvIHJlZ3JvdXAgdGhlbSBiYXNlZCBvbiB0aGUgY3VzdG9taXphdGlvbnNcblx0XHRjb25zdCByZWdyb3VwZWRWaWV3cyA9IHRoaXMucmVncm91cFZpZXdzKHZpZXdDb250YWluZXIuaWQsIHZpZXdzKTtcblx0XHR0aGlzLmRlcmVnaXN0ZXJHcm91cGVkVmlld3MocmVncm91cGVkVmlld3MpO1xuXHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2UuYnVmZmVyQ2hhbmdlRXZlbnRzKCgpID0+IHtcblx0XHRcdHZpZXdzLmZvckVhY2godmlld0Rlc2NyaXB0b3IgPT4gdGhpcy5nZXRPckNyZWF0ZU1vdmFibGVWaWV3Q29udGV4dEtleSh2aWV3RGVzY3JpcHRvcikuc2V0KGZhbHNlKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ3JvdXBWaWV3cyhjb250YWluZXJJZDogc3RyaW5nLCB2aWV3czogSVZpZXdEZXNjcmlwdG9yW10pOiBNYXA8c3RyaW5nLCBJVmlld0Rlc2NyaXB0b3JbXT4ge1xuXHRcdGNvbnN0IHZpZXdzQnlDb250YWluZXIgPSBuZXcgTWFwPHN0cmluZywgSVZpZXdEZXNjcmlwdG9yW10+KCk7XG5cblx0XHRmb3IgKGNvbnN0IHZpZXdEZXNjcmlwdG9yIG9mIHZpZXdzKSB7XG5cdFx0XHRjb25zdCBjb3JyZWN0Q29udGFpbmVySWQgPSB0aGlzLnZpZXdEZXNjcmlwdG9yc0N1c3RvbUxvY2F0aW9ucy5nZXQodmlld0Rlc2NyaXB0b3IuaWQpID8/IGNvbnRhaW5lcklkO1xuXHRcdFx0bGV0IGNvbnRhaW5lclZpZXdzID0gdmlld3NCeUNvbnRhaW5lci5nZXQoY29ycmVjdENvbnRhaW5lcklkKTtcblx0XHRcdGlmICghY29udGFpbmVyVmlld3MpIHtcblx0XHRcdFx0dmlld3NCeUNvbnRhaW5lci5zZXQoY29ycmVjdENvbnRhaW5lcklkLCBjb250YWluZXJWaWV3cyA9IFtdKTtcblx0XHRcdH1cblx0XHRcdGNvbnRhaW5lclZpZXdzLnB1c2godmlld0Rlc2NyaXB0b3IpO1xuXHRcdH1cblxuXHRcdHJldHVybiB2aWV3c0J5Q29udGFpbmVyO1xuXHR9XG5cblx0Z2V0Vmlld0Rlc2NyaXB0b3JCeUlkKHZpZXdJZDogc3RyaW5nKTogSVZpZXdEZXNjcmlwdG9yIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMudmlld3NSZWdpc3RyeS5nZXRWaWV3KHZpZXdJZCk7XG5cdH1cblxuXHRnZXRWaWV3TG9jYXRpb25CeUlkKHZpZXdJZDogc3RyaW5nKTogVmlld0NvbnRhaW5lckxvY2F0aW9uIHwgbnVsbCB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodmlld0lkKTtcblx0XHRpZiAoY29udGFpbmVyID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24oY29udGFpbmVyKTtcblx0fVxuXG5cdGdldFZpZXdDb250YWluZXJCeVZpZXdJZCh2aWV3SWQ6IHN0cmluZyk6IFZpZXdDb250YWluZXIgfCBudWxsIHtcblx0XHRjb25zdCBjb250YWluZXJJZCA9IHRoaXMudmlld0Rlc2NyaXB0b3JzQ3VzdG9tTG9jYXRpb25zLmdldCh2aWV3SWQpO1xuXG5cdFx0cmV0dXJuIGNvbnRhaW5lcklkID9cblx0XHRcdHRoaXMudmlld0NvbnRhaW5lcnNSZWdpc3RyeS5nZXQoY29udGFpbmVySWQpID8/IG51bGwgOlxuXHRcdFx0dGhpcy5nZXREZWZhdWx0Q29udGFpbmVyQnlJZCh2aWV3SWQpO1xuXHR9XG5cblx0Z2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiBWaWV3Q29udGFpbmVyTG9jYXRpb24ge1xuXHRcdHJldHVybiB0aGlzLnZpZXdDb250YWluZXJzQ3VzdG9tTG9jYXRpb25zLmdldCh2aWV3Q29udGFpbmVyLmlkKSA/PyB0aGlzLmdldERlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcik7XG5cdH1cblxuXHRnZXREZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiBWaWV3Q29udGFpbmVyTG9jYXRpb24ge1xuXHRcdHJldHVybiB0aGlzLnZpZXdDb250YWluZXJzUmVnaXN0cnkuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIpO1xuXHR9XG5cblx0Z2V0RGVmYXVsdENvbnRhaW5lckJ5SWQodmlld0lkOiBzdHJpbmcpOiBWaWV3Q29udGFpbmVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMudmlld3NSZWdpc3RyeS5nZXRWaWV3Q29udGFpbmVyKHZpZXdJZCkgPz8gbnVsbDtcblx0fVxuXG5cdGdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXI6IFZpZXdDb250YWluZXIpOiBWaWV3Q29udGFpbmVyTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLmdldE9yUmVnaXN0ZXJWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKTtcblx0fVxuXG5cdGdldFZpZXdDb250YWluZXJCeUlkKGlkOiBzdHJpbmcpOiBWaWV3Q29udGFpbmVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMudmlld0NvbnRhaW5lcnNSZWdpc3RyeS5nZXQoaWQpIHx8IG51bGw7XG5cdH1cblxuXHRnZXRWaWV3Q29udGFpbmVyc0J5TG9jYXRpb24obG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IFZpZXdDb250YWluZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMudmlld0NvbnRhaW5lcnMuZmlsdGVyKHYgPT4gdGhpcy5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odikgPT09IGxvY2F0aW9uKTtcblx0fVxuXG5cdGdldERlZmF1bHRWaWV3Q29udGFpbmVyKGxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24pOiBWaWV3Q29udGFpbmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmdldERlZmF1bHRWaWV3Q29udGFpbmVyKGxvY2F0aW9uKTtcblx0fVxuXG5cdG1vdmVWaWV3Q29udGFpbmVyVG9Mb2NhdGlvbih2aWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyLCBsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uLCByZXF1ZXN0ZWRJbmRleD86IG51bWJlciwgcmVhc29uPzogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dnZXIudmFsdWUuaW5mbyhgbW92ZVZpZXdDb250YWluZXJUb0xvY2F0aW9uOiB2aWV3Q29udGFpbmVyOiR7dmlld0NvbnRhaW5lci5pZH0gbG9jYXRpb246JHtsb2NhdGlvbn0gcmVhc29uOiR7cmVhc29ufWApO1xuXHRcdHRoaXMubW92ZVZpZXdDb250YWluZXJUb0xvY2F0aW9uV2l0aG91dFNhdmluZyh2aWV3Q29udGFpbmVyLCBsb2NhdGlvbiwgcmVxdWVzdGVkSW5kZXgpO1xuXHRcdHRoaXMuc2F2ZVZpZXdDdXN0b21pemF0aW9ucygpO1xuXHR9XG5cblx0Z2V0Vmlld0NvbnRhaW5lckJhZGdlRW5hYmxlbWVudFN0YXRlKGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3Q29udGFpbmVyQmFkZ2VFbmFibGVtZW50U3RhdGVzLmdldChpZCkgPz8gdHJ1ZTtcblx0fVxuXG5cdHNldFZpZXdDb250YWluZXJCYWRnZUVuYWJsZW1lbnRTdGF0ZShpZDogc3RyaW5nLCBiYWRnZXNFbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3Q29udGFpbmVyQmFkZ2VFbmFibGVtZW50U3RhdGVzLnNldChpZCwgYmFkZ2VzRW5hYmxlZCk7XG5cdFx0dGhpcy5zYXZlVmlld0N1c3RvbWl6YXRpb25zKCk7XG5cdH1cblxuXHRtb3ZlVmlld1RvTG9jYXRpb24odmlldzogSVZpZXdEZXNjcmlwdG9yLCBsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uLCByZWFzb24/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ2dlci52YWx1ZS5pbmZvKGBtb3ZlVmlld1RvTG9jYXRpb246IHZpZXc6JHt2aWV3LmlkfSBsb2NhdGlvbjoke2xvY2F0aW9ufSByZWFzb246JHtyZWFzb259YCk7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy5yZWdpc3RlckdlbmVyYXRlZFZpZXdDb250YWluZXIobG9jYXRpb24pO1xuXHRcdHRoaXMubW92ZVZpZXdzVG9Db250YWluZXIoW3ZpZXddLCBjb250YWluZXIpO1xuXHR9XG5cblx0bW92ZVZpZXdzVG9Db250YWluZXIodmlld3M6IElWaWV3RGVzY3JpcHRvcltdLCB2aWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyLCB2aXNpYmlsaXR5U3RhdGU/OiBWaWV3VmlzaWJpbGl0eVN0YXRlLCByZWFzb24/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoIXZpZXdzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMubG9nZ2VyLnZhbHVlLmluZm8oYG1vdmVWaWV3c1RvQ29udGFpbmVyOiB2aWV3czoke3ZpZXdzLm1hcCh2aWV3ID0+IHZpZXcuaWQpLmpvaW4oJywnKX0gdmlld0NvbnRhaW5lcjoke3ZpZXdDb250YWluZXIuaWR9IHJlYXNvbjoke3JlYXNvbn1gKTtcblxuXHRcdGNvbnN0IGZyb20gPSB0aGlzLmdldFZpZXdDb250YWluZXJCeVZpZXdJZCh2aWV3c1swXS5pZCk7XG5cdFx0Y29uc3QgdG8gPSB2aWV3Q29udGFpbmVyO1xuXG5cdFx0aWYgKGZyb20gJiYgdG8gJiYgZnJvbSAhPT0gdG8pIHtcblx0XHRcdC8vIE1vdmUgdmlld3Ncblx0XHRcdHRoaXMubW92ZVZpZXdzV2l0aG91dFNhdmluZyh2aWV3cywgZnJvbSwgdG8sIHZpc2liaWxpdHlTdGF0ZSk7XG5cdFx0XHR0aGlzLmNsZWFuVXBHZW5lcmF0ZWRWaWV3Q29udGFpbmVyKGZyb20uaWQpO1xuXG5cdFx0XHQvLyBTYXZlIG5ldyBsb2NhdGlvbnNcblx0XHRcdHRoaXMuc2F2ZVZpZXdDdXN0b21pemF0aW9ucygpO1xuXG5cdFx0XHQvLyBMb2cgdG8gdGVsZW1ldHJ5XG5cdFx0XHR0aGlzLnJlcG9ydE1vdmVkVmlld3Modmlld3MsIGZyb20sIHRvKTtcblx0XHR9XG5cdH1cblxuXHRyZXNldCgpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHZpZXdDb250YWluZXIgb2YgdGhpcy52aWV3Q29udGFpbmVycykge1xuXHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lck1vZGVsID0gdGhpcy5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lcik7XG5cblx0XHRcdGZvciAoY29uc3Qgdmlld0Rlc2NyaXB0b3Igb2Ygdmlld0NvbnRhaW5lck1vZGVsLmFsbFZpZXdEZXNjcmlwdG9ycykge1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0Q29udGFpbmVyID0gdGhpcy5nZXREZWZhdWx0Q29udGFpbmVyQnlJZCh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRDb250YWluZXIgPSB0aGlzLmdldFZpZXdDb250YWluZXJCeVZpZXdJZCh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdGlmIChjdXJyZW50Q29udGFpbmVyICYmIGRlZmF1bHRDb250YWluZXIgJiYgY3VycmVudENvbnRhaW5lciAhPT0gZGVmYXVsdENvbnRhaW5lcikge1xuXHRcdFx0XHRcdHRoaXMubW92ZVZpZXdzV2l0aG91dFNhdmluZyhbdmlld0Rlc2NyaXB0b3JdLCBjdXJyZW50Q29udGFpbmVyLCBkZWZhdWx0Q29udGFpbmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkZWZhdWx0Q29udGFpbmVyTG9jYXRpb24gPSB0aGlzLmdldERlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcik7XG5cdFx0XHRjb25zdCBjdXJyZW50Q29udGFpbmVyTG9jYXRpb24gPSB0aGlzLmdldFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKTtcblx0XHRcdGlmIChkZWZhdWx0Q29udGFpbmVyTG9jYXRpb24gIT09IG51bGwgJiYgY3VycmVudENvbnRhaW5lckxvY2F0aW9uICE9PSBkZWZhdWx0Q29udGFpbmVyTG9jYXRpb24pIHtcblx0XHRcdFx0dGhpcy5tb3ZlVmlld0NvbnRhaW5lclRvTG9jYXRpb25XaXRob3V0U2F2aW5nKHZpZXdDb250YWluZXIsIGRlZmF1bHRDb250YWluZXJMb2NhdGlvbik7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuY2xlYW5VcEdlbmVyYXRlZFZpZXdDb250YWluZXIodmlld0NvbnRhaW5lci5pZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy52aWV3Q29udGFpbmVyc0N1c3RvbUxvY2F0aW9ucy5jbGVhcigpO1xuXHRcdHRoaXMudmlld0Rlc2NyaXB0b3JzQ3VzdG9tTG9jYXRpb25zLmNsZWFyKCk7XG5cdFx0dGhpcy5zYXZlVmlld0N1c3RvbWl6YXRpb25zKCk7XG5cdH1cblxuXHRpc1ZpZXdDb250YWluZXJSZW1vdmVkUGVybWFuZW50bHkodmlld0NvbnRhaW5lcklkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pc0dlbmVyYXRlZENvbnRhaW5lcklkKHZpZXdDb250YWluZXJJZCkgJiYgIXRoaXMudmlld0NvbnRhaW5lcnNDdXN0b21Mb2NhdGlvbnMuaGFzKHZpZXdDb250YWluZXJJZCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRGVmYXVsdENvbnRhaW5lcih2aWV3czogSVZpZXdEZXNjcmlwdG9yW10sIGZyb206IFZpZXdDb250YWluZXIsIHRvOiBWaWV3Q29udGFpbmVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgdmlld3NUb01vdmUgPSB2aWV3cy5maWx0ZXIodmlldyA9PlxuXHRcdFx0IXRoaXMudmlld0Rlc2NyaXB0b3JzQ3VzdG9tTG9jYXRpb25zLmhhcyh2aWV3LmlkKSAvLyBNb3ZlIHZpZXdzIHdoaWNoIGFyZSBub3QgYWxyZWFkeSBtb3ZlZFxuXHRcdFx0fHwgKCF0aGlzLnZpZXdDb250YWluZXJzLmluY2x1ZGVzKGZyb20pICYmIHRoaXMudmlld0Rlc2NyaXB0b3JzQ3VzdG9tTG9jYXRpb25zLmdldCh2aWV3LmlkKSA9PT0gZnJvbS5pZCkgLy8gTW92ZSB2aWV3cyB3aGljaCBhcmUgbW92ZWQgZnJvbSBhIHJlbW92ZWQgY29udGFpbmVyXG5cdFx0KTtcblx0XHRpZiAodmlld3NUb01vdmUubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLm1vdmVWaWV3c1dpdGhvdXRTYXZpbmcodmlld3NUb01vdmUsIGZyb20sIHRvKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlcG9ydE1vdmVkVmlld3Modmlld3M6IElWaWV3RGVzY3JpcHRvcltdLCBmcm9tOiBWaWV3Q29udGFpbmVyLCB0bzogVmlld0NvbnRhaW5lcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRhaW5lclRvU3RyaW5nID0gKGNvbnRhaW5lcjogVmlld0NvbnRhaW5lcik6IHN0cmluZyA9PiB7XG5cdFx0XHRpZiAoY29udGFpbmVyLmlkLnN0YXJ0c1dpdGgoVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLkNPTU1PTl9DT05UQUlORVJfSURfUFJFRklYKSkge1xuXHRcdFx0XHRyZXR1cm4gJ2N1c3RvbSc7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghY29udGFpbmVyLmV4dGVuc2lvbklkKSB7XG5cdFx0XHRcdHJldHVybiBjb250YWluZXIuaWQ7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAnZXh0ZW5zaW9uJztcblx0XHR9O1xuXG5cdFx0Y29uc3Qgb2xkTG9jYXRpb24gPSB0aGlzLmdldFZpZXdDb250YWluZXJMb2NhdGlvbihmcm9tKTtcblx0XHRjb25zdCBuZXdMb2NhdGlvbiA9IHRoaXMuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHRvKTtcblx0XHRjb25zdCB2aWV3Q291bnQgPSB2aWV3cy5sZW5ndGg7XG5cdFx0Y29uc3QgZnJvbUNvbnRhaW5lciA9IGNvbnRhaW5lclRvU3RyaW5nKGZyb20pO1xuXHRcdGNvbnN0IHRvQ29udGFpbmVyID0gY29udGFpbmVyVG9TdHJpbmcodG8pO1xuXHRcdGNvbnN0IGZyb21Mb2NhdGlvbiA9IG9sZExvY2F0aW9uID09PSBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwgPyAncGFuZWwnIDogJ3NpZGViYXInO1xuXHRcdGNvbnN0IHRvTG9jYXRpb24gPSBuZXdMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsID8gJ3BhbmVsJyA6ICdzaWRlYmFyJztcblxuXHRcdGludGVyZmFjZSBWaWV3RGVzY3JpcHRvclNlcnZpY2VNb3ZlVmlld3NFdmVudCB7XG5cdFx0XHR2aWV3Q291bnQ6IG51bWJlcjtcblx0XHRcdGZyb21Db250YWluZXI6IHN0cmluZztcblx0XHRcdHRvQ29udGFpbmVyOiBzdHJpbmc7XG5cdFx0XHRmcm9tTG9jYXRpb246IHN0cmluZztcblx0XHRcdHRvTG9jYXRpb246IHN0cmluZztcblx0XHR9XG5cblx0XHR0eXBlIFZpZXdEZXNjcmlwdG9yU2VydmljZU1vdmVWaWV3c0NsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdiZW5pYmVuaic7XG5cdFx0XHRjb21tZW50OiAnTG9nZ2VkIHdoZW4gdmlld3MgYXJlIG1vdmVkIGZyb20gb25lIHZpZXcgY29udGFpbmVyIHRvIGFub3RoZXInO1xuXHRcdFx0dmlld0NvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIG51bWJlciBvZiB2aWV3cyBtb3ZlZCcgfTtcblx0XHRcdGZyb21Db250YWluZXI6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgc3RhcnRpbmcgdmlldyBjb250YWluZXIgb2YgdGhlIG1vdmVkIHZpZXdzJyB9O1xuXHRcdFx0dG9Db250YWluZXI6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgZGVzdGluYXRpb24gdmlldyBjb250YWluZXIgb2YgdGhlIG1vdmVkIHZpZXdzJyB9O1xuXHRcdFx0ZnJvbUxvY2F0aW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGxvY2F0aW9uIG9mIHRoZSBzdGFydGluZyB2aWV3IGNvbnRhaW5lci4gZS5nLiBQcmltYXJ5IFNpZGUgQmFyJyB9O1xuXHRcdFx0dG9Mb2NhdGlvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBsb2NhdGlvbiBvZiB0aGUgZGVzdGluYXRpb24gdmlldyBjb250YWluZXIuIGUuZy4gUGFuZWwnIH07XG5cdFx0fTtcblxuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFZpZXdEZXNjcmlwdG9yU2VydmljZU1vdmVWaWV3c0V2ZW50LCBWaWV3RGVzY3JpcHRvclNlcnZpY2VNb3ZlVmlld3NDbGFzc2lmaWNhdGlvbj4oJ3ZpZXdEZXNjcmlwdG9yU2VydmljZS5tb3ZlVmlld3MnLCB7IHZpZXdDb3VudCwgZnJvbUNvbnRhaW5lciwgdG9Db250YWluZXIsIGZyb21Mb2NhdGlvbiwgdG9Mb2NhdGlvbiB9KTtcblx0fVxuXG5cdHByaXZhdGUgbW92ZVZpZXdzV2l0aG91dFNhdmluZyh2aWV3czogSVZpZXdEZXNjcmlwdG9yW10sIGZyb206IFZpZXdDb250YWluZXIsIHRvOiBWaWV3Q29udGFpbmVyLCB2aXNpYmlsaXR5U3RhdGU6IFZpZXdWaXNpYmlsaXR5U3RhdGUgPSBWaWV3VmlzaWJpbGl0eVN0YXRlLkV4cGFuZCk6IHZvaWQge1xuXHRcdHRoaXMucmVtb3ZlVmlld3MoZnJvbSwgdmlld3MpO1xuXHRcdHRoaXMuYWRkVmlld3ModG8sIHZpZXdzLCB2aXNpYmlsaXR5U3RhdGUpO1xuXG5cdFx0Y29uc3Qgb2xkTG9jYXRpb24gPSB0aGlzLmdldFZpZXdDb250YWluZXJMb2NhdGlvbihmcm9tKTtcblx0XHRjb25zdCBuZXdMb2NhdGlvbiA9IHRoaXMuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHRvKTtcblxuXHRcdGlmIChvbGRMb2NhdGlvbiAhPT0gbmV3TG9jYXRpb24pIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTG9jYXRpb24uZmlyZSh7IHZpZXdzLCBmcm9tOiBvbGRMb2NhdGlvbiwgdG86IG5ld0xvY2F0aW9uIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGFpbmVyLmZpcmUoeyB2aWV3cywgZnJvbSwgdG8gfSk7XG5cdH1cblxuXHRwcml2YXRlIG1vdmVWaWV3Q29udGFpbmVyVG9Mb2NhdGlvbldpdGhvdXRTYXZpbmcodmlld0NvbnRhaW5lcjogVmlld0NvbnRhaW5lciwgbG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiwgcmVxdWVzdGVkSW5kZXg/OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBmcm9tID0gdGhpcy5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcik7XG5cdFx0Y29uc3QgdG8gPSBsb2NhdGlvbjtcblx0XHRpZiAoZnJvbSAhPT0gdG8pIHtcblx0XHRcdGNvbnN0IGlzR2VuZXJhdGVkVmlld0NvbnRhaW5lciA9IHRoaXMuaXNHZW5lcmF0ZWRDb250YWluZXJJZCh2aWV3Q29udGFpbmVyLmlkKTtcblx0XHRcdGNvbnN0IGlzRGVmYXVsdFZpZXdDb250YWluZXJMb2NhdGlvbiA9IHRvID09PSB0aGlzLmdldERlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcik7XG5cdFx0XHRpZiAoaXNHZW5lcmF0ZWRWaWV3Q29udGFpbmVyIHx8ICFpc0RlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb24pIHtcblx0XHRcdFx0dGhpcy52aWV3Q29udGFpbmVyc0N1c3RvbUxvY2F0aW9ucy5zZXQodmlld0NvbnRhaW5lci5pZCwgdG8pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy52aWV3Q29udGFpbmVyc0N1c3RvbUxvY2F0aW9ucy5kZWxldGUodmlld0NvbnRhaW5lci5pZCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmdldE9yQ3JlYXRlRGVmYXVsdFZpZXdDb250YWluZXJMb2NhdGlvbkNvbnRleHRLZXkodmlld0NvbnRhaW5lcikuc2V0KGlzR2VuZXJhdGVkVmlld0NvbnRhaW5lciB8fCBpc0RlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb24pO1xuXG5cdFx0XHR2aWV3Q29udGFpbmVyLnJlcXVlc3RlZEluZGV4ID0gcmVxdWVzdGVkSW5kZXg7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRhaW5lckxvY2F0aW9uLmZpcmUoeyB2aWV3Q29udGFpbmVyLCBmcm9tLCB0byB9KTtcblxuXHRcdFx0Y29uc3Qgdmlld3MgPSB0aGlzLmdldFZpZXdzQnlDb250YWluZXIodmlld0NvbnRhaW5lcik7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxvY2F0aW9uLmZpcmUoeyB2aWV3cywgZnJvbSwgdG8gfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhblVwR2VuZXJhdGVkVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVySWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdC8vIFNraXAgaWYgY29udGFpbmVyIGlzIG5vdCBnZW5lcmF0ZWRcblx0XHRpZiAoIXRoaXMuaXNHZW5lcmF0ZWRDb250YWluZXJJZCh2aWV3Q29udGFpbmVySWQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU2tpcCBpZiBjb250YWluZXIgaGFzIHZpZXdzIHJlZ2lzdGVyZWRcblx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy5nZXRWaWV3Q29udGFpbmVyQnlJZCh2aWV3Q29udGFpbmVySWQpO1xuXHRcdGlmICh2aWV3Q29udGFpbmVyICYmIHRoaXMuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIpPy5hbGxWaWV3RGVzY3JpcHRvcnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU2tpcCBpZiBjb250YWluZXIgaGFzIG1vdmVkIHZpZXdzXG5cdFx0aWYgKFsuLi50aGlzLnZpZXdEZXNjcmlwdG9yc0N1c3RvbUxvY2F0aW9ucy52YWx1ZXMoKV0uaW5jbHVkZXModmlld0NvbnRhaW5lcklkKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIERlcmVnaXN0ZXIgdGhlIGNvbnRhaW5lclxuXHRcdGlmICh2aWV3Q29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLnZpZXdDb250YWluZXJzUmVnaXN0cnkuZGVyZWdpc3RlclZpZXdDb250YWluZXIodmlld0NvbnRhaW5lcik7XG5cdFx0fVxuXG5cdFx0dGhpcy52aWV3Q29udGFpbmVyc0N1c3RvbUxvY2F0aW9ucy5kZWxldGUodmlld0NvbnRhaW5lcklkKTtcblx0XHR0aGlzLnZpZXdDb250YWluZXJCYWRnZUVuYWJsZW1lbnRTdGF0ZXMuZGVsZXRlKHZpZXdDb250YWluZXJJZCk7XG5cblx0XHQvLyBDbGVhbiB1cCBjYWNoZXMgb2YgY29udGFpbmVyXG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoZ2V0Vmlld3NTdGF0ZVN0b3JhZ2VJZCh2aWV3Q29udGFpbmVyPy5zdG9yYWdlSWQgfHwgZ2V0Vmlld0NvbnRhaW5lclN0b3JhZ2VJZCh2aWV3Q29udGFpbmVySWQpKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckdlbmVyYXRlZFZpZXdDb250YWluZXIobG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiwgZXhpc3RpbmdJZD86IHN0cmluZyk6IFZpZXdDb250YWluZXIge1xuXHRcdGNvbnN0IGlkID0gZXhpc3RpbmdJZCB8fCB0aGlzLmdlbmVyYXRlQ29udGFpbmVySWQobG9jYXRpb24pO1xuXG5cdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy52aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7XG5cdFx0XHRpZCxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoVmlld1BhbmVDb250YWluZXIsIFtpZCwgeyBtZXJnZVZpZXdXaXRoQ29udGFpbmVyV2hlblNpbmdsZVZpZXc6IHRydWUgfV0pLFxuXHRcdFx0dGl0bGU6IHsgdmFsdWU6IGxvY2FsaXplKCd1c2VyJywgXCJVc2VyIFZpZXcgQ29udGFpbmVyXCIpLCBvcmlnaW5hbDogJ1VzZXIgVmlldyBDb250YWluZXInIH0sIC8vIGhhdmluZyBhIHBsYWNlaG9sZGVyIHRpdGxlIC0gdGhpcyBzaG91bGQgbm90IGJlIHNob3duIGFueXdoZXJlXG5cdFx0XHRpY29uOiBsb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIgPyBkZWZhdWx0Vmlld0ljb24gOiB1bmRlZmluZWQsXG5cdFx0XHRzdG9yYWdlSWQ6IGdldFZpZXdDb250YWluZXJTdG9yYWdlSWQoaWQpLFxuXHRcdFx0aGlkZUlmRW1wdHk6IHRydWVcblx0XHR9LCBsb2NhdGlvbiwgeyBkb05vdFJlZ2lzdGVyT3BlbkNvbW1hbmQ6IHRydWUgfSk7XG5cblx0XHRpZiAodGhpcy52aWV3Q29udGFpbmVyc0N1c3RvbUxvY2F0aW9ucy5nZXQoY29udGFpbmVyLmlkKSAhPT0gbG9jYXRpb24pIHtcblx0XHRcdHRoaXMudmlld0NvbnRhaW5lcnNDdXN0b21Mb2NhdGlvbnMuc2V0KGNvbnRhaW5lci5pZCwgbG9jYXRpb24pO1xuXHRcdH1cblxuXHRcdHRoaXMuZ2V0T3JDcmVhdGVEZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uQ29udGV4dEtleShjb250YWluZXIpLnNldCh0cnVlKTtcblxuXHRcdHJldHVybiBjb250YWluZXI7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkU3RvcmFnZUNoYW5nZSgpOiB2b2lkIHtcblx0XHRpZiAoSlNPTi5zdHJpbmdpZnkodGhpcy52aWV3Q3VzdG9taXphdGlvbnMpICE9PSB0aGlzLmdldFN0b3JlZFZpZXdDdXN0b21pemF0aW9uc1ZhbHVlKCkgLyogVGhpcyBjaGVja3MgaWYgY3VycmVudCB3aW5kb3cgY2hhbmdlZCB0aGUgdmFsdWUgb3Igbm90ICovKSB7XG5cdFx0XHR0aGlzLm9uRGlkVmlld0N1c3RvbWl6YXRpb25zU3RvcmFnZUNoYW5nZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRWaWV3Q3VzdG9taXphdGlvbnNTdG9yYWdlQ2hhbmdlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3ZpZXdDdXN0b21pemF0aW9ucyA9IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IG5ld1ZpZXdDb250YWluZXJDdXN0b21pemF0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBWaWV3Q29udGFpbmVyTG9jYXRpb24+KE9iamVjdC5lbnRyaWVzKHRoaXMudmlld0N1c3RvbWl6YXRpb25zLnZpZXdDb250YWluZXJMb2NhdGlvbnMpKTtcblx0XHRjb25zdCBuZXdWaWV3RGVzY3JpcHRvckN1c3RvbWl6YXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oT2JqZWN0LmVudHJpZXModGhpcy52aWV3Q3VzdG9taXphdGlvbnMudmlld0xvY2F0aW9ucykpO1xuXHRcdGNvbnN0IHZpZXdDb250YWluZXJzVG9Nb3ZlOiBbVmlld0NvbnRhaW5lciwgVmlld0NvbnRhaW5lckxvY2F0aW9uXVtdID0gW107XG5cdFx0Y29uc3Qgdmlld3NUb01vdmU6IHsgdmlld3M6IElWaWV3RGVzY3JpcHRvcltdOyBmcm9tOiBWaWV3Q29udGFpbmVyOyB0bzogVmlld0NvbnRhaW5lciB9W10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgW2NvbnRhaW5lcklkLCBsb2NhdGlvbl0gb2YgbmV3Vmlld0NvbnRhaW5lckN1c3RvbWl6YXRpb25zLmVudHJpZXMoKSkge1xuXHRcdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy5nZXRWaWV3Q29udGFpbmVyQnlJZChjb250YWluZXJJZCk7XG5cdFx0XHRpZiAoY29udGFpbmVyKSB7XG5cdFx0XHRcdGlmIChsb2NhdGlvbiAhPT0gdGhpcy5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24oY29udGFpbmVyKSkge1xuXHRcdFx0XHRcdHZpZXdDb250YWluZXJzVG9Nb3ZlLnB1c2goW2NvbnRhaW5lciwgbG9jYXRpb25dKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gSWYgdGhlIGNvbnRhaW5lciBpcyBnZW5lcmF0ZWQgYW5kIG5vdCByZWdpc3RlcmVkLCB3ZSByZWdpc3RlciBpdCBub3dcblx0XHRcdGVsc2UgaWYgKHRoaXMuaXNHZW5lcmF0ZWRDb250YWluZXJJZChjb250YWluZXJJZCkpIHtcblx0XHRcdFx0dGhpcy5yZWdpc3RlckdlbmVyYXRlZFZpZXdDb250YWluZXIobG9jYXRpb24sIGNvbnRhaW5lcklkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHZpZXdDb250YWluZXIgb2YgdGhpcy52aWV3Q29udGFpbmVycykge1xuXHRcdFx0aWYgKCFuZXdWaWV3Q29udGFpbmVyQ3VzdG9taXphdGlvbnMuaGFzKHZpZXdDb250YWluZXIuaWQpKSB7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRMb2NhdGlvbiA9IHRoaXMuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIpO1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0TG9jYXRpb24gPSB0aGlzLmdldERlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcik7XG5cdFx0XHRcdGlmIChjdXJyZW50TG9jYXRpb24gIT09IGRlZmF1bHRMb2NhdGlvbikge1xuXHRcdFx0XHRcdHZpZXdDb250YWluZXJzVG9Nb3ZlLnB1c2goW3ZpZXdDb250YWluZXIsIGRlZmF1bHRMb2NhdGlvbl0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBbdmlld0lkLCB2aWV3Q29udGFpbmVySWRdIG9mIG5ld1ZpZXdEZXNjcmlwdG9yQ3VzdG9taXphdGlvbnMuZW50cmllcygpKSB7XG5cdFx0XHRjb25zdCB2aWV3RGVzY3JpcHRvciA9IHRoaXMuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKHZpZXdJZCk7XG5cdFx0XHRpZiAodmlld0Rlc2NyaXB0b3IpIHtcblx0XHRcdFx0Y29uc3QgcHJldlZpZXdDb250YWluZXIgPSB0aGlzLmdldFZpZXdDb250YWluZXJCeVZpZXdJZCh2aWV3SWQpO1xuXHRcdFx0XHRjb25zdCBuZXdWaWV3Q29udGFpbmVyID0gdGhpcy52aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmdldCh2aWV3Q29udGFpbmVySWQpO1xuXHRcdFx0XHRpZiAocHJldlZpZXdDb250YWluZXIgJiYgbmV3Vmlld0NvbnRhaW5lciAmJiBuZXdWaWV3Q29udGFpbmVyICE9PSBwcmV2Vmlld0NvbnRhaW5lcikge1xuXHRcdFx0XHRcdHZpZXdzVG9Nb3ZlLnB1c2goeyB2aWV3czogW3ZpZXdEZXNjcmlwdG9yXSwgZnJvbTogcHJldlZpZXdDb250YWluZXIsIHRvOiBuZXdWaWV3Q29udGFpbmVyIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSWYgYSB2YWx1ZSBpcyBub3QgcHJlc2VudCBpbiB0aGUgY2FjaGUsIGl0IG11c3QgYmUgcmVzZXQgdG8gZGVmYXVsdFxuXHRcdGZvciAoY29uc3Qgdmlld0NvbnRhaW5lciBvZiB0aGlzLnZpZXdDb250YWluZXJzKSB7XG5cdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyTW9kZWwgPSB0aGlzLmdldFZpZXdDb250YWluZXJNb2RlbCh2aWV3Q29udGFpbmVyKTtcblx0XHRcdGZvciAoY29uc3Qgdmlld0Rlc2NyaXB0b3Igb2Ygdmlld0NvbnRhaW5lck1vZGVsLmFsbFZpZXdEZXNjcmlwdG9ycykge1xuXHRcdFx0XHRpZiAoIW5ld1ZpZXdEZXNjcmlwdG9yQ3VzdG9taXphdGlvbnMuaGFzKHZpZXdEZXNjcmlwdG9yLmlkKSkge1xuXHRcdFx0XHRcdGNvbnN0IGN1cnJlbnRDb250YWluZXIgPSB0aGlzLmdldFZpZXdDb250YWluZXJCeVZpZXdJZCh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdFx0Y29uc3QgZGVmYXVsdENvbnRhaW5lciA9IHRoaXMuZ2V0RGVmYXVsdENvbnRhaW5lckJ5SWQodmlld0Rlc2NyaXB0b3IuaWQpO1xuXHRcdFx0XHRcdGlmIChjdXJyZW50Q29udGFpbmVyICYmIGRlZmF1bHRDb250YWluZXIgJiYgY3VycmVudENvbnRhaW5lciAhPT0gZGVmYXVsdENvbnRhaW5lcikge1xuXHRcdFx0XHRcdFx0dmlld3NUb01vdmUucHVzaCh7IHZpZXdzOiBbdmlld0Rlc2NyaXB0b3JdLCBmcm9tOiBjdXJyZW50Q29udGFpbmVyLCB0bzogZGVmYXVsdENvbnRhaW5lciB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBFeGVjdXRlIFZpZXcgQ29udGFpbmVyIE1vdmVtZW50c1xuXHRcdGZvciAoY29uc3QgW2NvbnRhaW5lciwgbG9jYXRpb25dIG9mIHZpZXdDb250YWluZXJzVG9Nb3ZlKSB7XG5cdFx0XHR0aGlzLm1vdmVWaWV3Q29udGFpbmVyVG9Mb2NhdGlvbldpdGhvdXRTYXZpbmcoY29udGFpbmVyLCBsb2NhdGlvbik7XG5cdFx0fVxuXHRcdC8vIEV4ZWN1dGUgVmlldyBNb3ZlbWVudHNcblx0XHRmb3IgKGNvbnN0IHsgdmlld3MsIGZyb20sIHRvIH0gb2Ygdmlld3NUb01vdmUpIHtcblx0XHRcdHRoaXMubW92ZVZpZXdzV2l0aG91dFNhdmluZyh2aWV3cywgZnJvbSwgdG8sIFZpZXdWaXNpYmlsaXR5U3RhdGUuRGVmYXVsdCk7XG5cdFx0fVxuXG5cdFx0dGhpcy52aWV3Q29udGFpbmVyc0N1c3RvbUxvY2F0aW9ucyA9IG5ld1ZpZXdDb250YWluZXJDdXN0b21pemF0aW9ucztcblx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yc0N1c3RvbUxvY2F0aW9ucyA9IG5ld1ZpZXdEZXNjcmlwdG9yQ3VzdG9taXphdGlvbnM7XG5cdH1cblxuXHQvLyBHZW5lcmF0ZWQgQ29udGFpbmVyIElkIEZvcm1hdFxuXHQvLyB7Q29tbW9uIFByZWZpeH0ue0xvY2F0aW9ufS57VW5pcXVlbmVzcyBJZH1cblx0Ly8gT2xkIEZvcm1hdCAoZGVwcmVjYXRlZClcblx0Ly8ge0NvbW1vbiBQcmVmaXh9LntVbmlxdWVuZXNzIElkfS57U291cmNlIFZpZXcgSWR9XG5cdHByaXZhdGUgZ2VuZXJhdGVDb250YWluZXJJZChsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7Vmlld0Rlc2NyaXB0b3JTZXJ2aWNlLkNPTU1PTl9DT05UQUlORVJfSURfUFJFRklYfS4ke1ZpZXdDb250YWluZXJMb2NhdGlvblRvU3RyaW5nKGxvY2F0aW9uKX0uJHtnZW5lcmF0ZVV1aWQoKX1gO1xuXHR9XG5cblx0cHJpdmF0ZSBzYXZlVmlld0N1c3RvbWl6YXRpb25zKCk6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdDdXN0b21pemF0aW9uczogSVZpZXdzQ3VzdG9taXphdGlvbnMgPSB7IHZpZXdDb250YWluZXJMb2NhdGlvbnM6IHt9LCB2aWV3TG9jYXRpb25zOiB7fSwgdmlld0NvbnRhaW5lckJhZGdlRW5hYmxlbWVudFN0YXRlczoge30gfTtcblxuXHRcdGZvciAoY29uc3QgW2NvbnRhaW5lcklkLCBsb2NhdGlvbl0gb2YgdGhpcy52aWV3Q29udGFpbmVyc0N1c3RvbUxvY2F0aW9ucykge1xuXHRcdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy5nZXRWaWV3Q29udGFpbmVyQnlJZChjb250YWluZXJJZCk7XG5cdFx0XHQvLyBTa2lwIGlmIHRoZSB2aWV3IGNvbnRhaW5lciBpcyBub3QgYSBnZW5lcmF0ZWQgY29udGFpbmVyIGFuZCBpbiBkZWZhdWx0IGxvY2F0aW9uXG5cdFx0XHRpZiAoY29udGFpbmVyICYmICF0aGlzLmlzR2VuZXJhdGVkQ29udGFpbmVySWQoY29udGFpbmVySWQpICYmIGxvY2F0aW9uID09PSB0aGlzLmdldERlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb24oY29udGFpbmVyKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHZpZXdDdXN0b21pemF0aW9ucy52aWV3Q29udGFpbmVyTG9jYXRpb25zW2NvbnRhaW5lcklkXSA9IGxvY2F0aW9uO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgW3ZpZXdJZCwgdmlld0NvbnRhaW5lcklkXSBvZiB0aGlzLnZpZXdEZXNjcmlwdG9yc0N1c3RvbUxvY2F0aW9ucykge1xuXHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMuZ2V0Vmlld0NvbnRhaW5lckJ5SWQodmlld0NvbnRhaW5lcklkKTtcblx0XHRcdGlmICh2aWV3Q29udGFpbmVyKSB7XG5cdFx0XHRcdGNvbnN0IGRlZmF1bHRDb250YWluZXIgPSB0aGlzLmdldERlZmF1bHRDb250YWluZXJCeUlkKHZpZXdJZCk7XG5cdFx0XHRcdC8vIFNraXAgaWYgdGhlIHZpZXcgaXMgYXQgZGVmYXVsdCBsb2NhdGlvblxuXHRcdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvOTA0MTRcblx0XHRcdFx0aWYgKGRlZmF1bHRDb250YWluZXI/LmlkID09PSB2aWV3Q29udGFpbmVyLmlkKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHZpZXdDdXN0b21pemF0aW9ucy52aWV3TG9jYXRpb25zW3ZpZXdJZF0gPSB2aWV3Q29udGFpbmVySWQ7XG5cdFx0fVxuXG5cdFx0Ly8gTG9vcCB0aHJvdWdoIHZpZXdDb250YWluZXJCYWRnZUVuYWJsZW1lbnRTdGF0ZXMgYW5kIHNhdmUgb25seSB0aGUgb25lcyB0aGF0IGFyZSBkaXNhYmxlZFxuXHRcdGZvciAoY29uc3QgW3ZpZXdDb250YWluZXJJZCwgYmFkZ2VFbmFibGVtZW50U3RhdGVdIG9mIHRoaXMudmlld0NvbnRhaW5lckJhZGdlRW5hYmxlbWVudFN0YXRlcykge1xuXHRcdFx0aWYgKGJhZGdlRW5hYmxlbWVudFN0YXRlID09PSBmYWxzZSkge1xuXHRcdFx0XHR2aWV3Q3VzdG9taXphdGlvbnMudmlld0NvbnRhaW5lckJhZGdlRW5hYmxlbWVudFN0YXRlc1t2aWV3Q29udGFpbmVySWRdID0gYmFkZ2VFbmFibGVtZW50U3RhdGU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMudmlld0N1c3RvbWl6YXRpb25zID0gdmlld0N1c3RvbWl6YXRpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBfdmlld0N1c3RvbWl6YXRpb25zOiBJVmlld3NDdXN0b21pemF0aW9ucyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXQgdmlld0N1c3RvbWl6YXRpb25zKCk6IElWaWV3c0N1c3RvbWl6YXRpb25zIHtcblx0XHRpZiAoIXRoaXMuX3ZpZXdDdXN0b21pemF0aW9ucykge1xuXHRcdFx0dGhpcy5fdmlld0N1c3RvbWl6YXRpb25zID0gSlNPTi5wYXJzZSh0aGlzLmdldFN0b3JlZFZpZXdDdXN0b21pemF0aW9uc1ZhbHVlKCkpIGFzIElWaWV3c0N1c3RvbWl6YXRpb25zO1xuXHRcdFx0dGhpcy5fdmlld0N1c3RvbWl6YXRpb25zLnZpZXdDb250YWluZXJMb2NhdGlvbnMgPSB0aGlzLl92aWV3Q3VzdG9taXphdGlvbnMudmlld0NvbnRhaW5lckxvY2F0aW9ucyA/PyB7fTtcblx0XHRcdHRoaXMuX3ZpZXdDdXN0b21pemF0aW9ucy52aWV3TG9jYXRpb25zID0gdGhpcy5fdmlld0N1c3RvbWl6YXRpb25zLnZpZXdMb2NhdGlvbnMgPz8ge307XG5cdFx0XHR0aGlzLl92aWV3Q3VzdG9taXphdGlvbnMudmlld0NvbnRhaW5lckJhZGdlRW5hYmxlbWVudFN0YXRlcyA9IHRoaXMuX3ZpZXdDdXN0b21pemF0aW9ucy52aWV3Q29udGFpbmVyQmFkZ2VFbmFibGVtZW50U3RhdGVzID8/IHt9O1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdmlld0N1c3RvbWl6YXRpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXQgdmlld0N1c3RvbWl6YXRpb25zKHZpZXdDdXN0b21pemF0aW9uczogSVZpZXdzQ3VzdG9taXphdGlvbnMpIHtcblx0XHRjb25zdCB2YWx1ZSA9IEpTT04uc3RyaW5naWZ5KHZpZXdDdXN0b21pemF0aW9ucyk7XG5cdFx0aWYgKEpTT04uc3RyaW5naWZ5KHRoaXMudmlld0N1c3RvbWl6YXRpb25zKSAhPT0gdmFsdWUpIHtcblx0XHRcdHRoaXMuX3ZpZXdDdXN0b21pemF0aW9ucyA9IHZpZXdDdXN0b21pemF0aW9ucztcblx0XHRcdHRoaXMuc2V0U3RvcmVkVmlld0N1c3RvbWl6YXRpb25zVmFsdWUodmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0U3RvcmVkVmlld0N1c3RvbWl6YXRpb25zVmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLlZJRVdTX0NVU1RPTUlaQVRJT05TLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgJ3t9Jyk7XG5cdH1cblxuXHRwcml2YXRlIHNldFN0b3JlZFZpZXdDdXN0b21pemF0aW9uc1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFZpZXdEZXNjcmlwdG9yU2VydmljZS5WSUVXU19DVVNUT01JWkFUSU9OUywgdmFsdWUsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRWaWV3c0J5Q29udGFpbmVyKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiBJVmlld0Rlc2NyaXB0b3JbXSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy52aWV3c1JlZ2lzdHJ5LmdldFZpZXdzKHZpZXdDb250YWluZXIpLmZpbHRlcih2aWV3RGVzY3JpcHRvciA9PiB7XG5cdFx0XHRjb25zdCB2aWV3RGVzY3JpcHRvclZpZXdDb250YWluZXJJZCA9IHRoaXMudmlld0Rlc2NyaXB0b3JzQ3VzdG9tTG9jYXRpb25zLmdldCh2aWV3RGVzY3JpcHRvci5pZCkgPz8gdmlld0NvbnRhaW5lci5pZDtcblx0XHRcdHJldHVybiB2aWV3RGVzY3JpcHRvclZpZXdDb250YWluZXJJZCA9PT0gdmlld0NvbnRhaW5lci5pZDtcblx0XHR9KTtcblxuXHRcdGZvciAoY29uc3QgW3ZpZXdJZCwgdmlld0NvbnRhaW5lcklkXSBvZiB0aGlzLnZpZXdEZXNjcmlwdG9yc0N1c3RvbUxvY2F0aW9ucy5lbnRyaWVzKCkpIHtcblx0XHRcdGlmICh2aWV3Q29udGFpbmVySWQgIT09IHZpZXdDb250YWluZXIuaWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnZpZXdzUmVnaXN0cnkuZ2V0Vmlld0NvbnRhaW5lcih2aWV3SWQpID09PSB2aWV3Q29udGFpbmVyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB2aWV3RGVzY3JpcHRvciA9IHRoaXMuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKHZpZXdJZCk7XG5cdFx0XHRpZiAodmlld0Rlc2NyaXB0b3IpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2godmlld0Rlc2NyaXB0b3IpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkUmVnaXN0ZXJWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHRjb25zdCBkZWZhdWx0TG9jYXRpb24gPSB0aGlzLmlzR2VuZXJhdGVkQ29udGFpbmVySWQodmlld0NvbnRhaW5lci5pZCkgPyB0cnVlIDogdGhpcy5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcikgPT09IHRoaXMuZ2V0RGVmYXVsdFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKTtcblx0XHR0aGlzLmdldE9yQ3JlYXRlRGVmYXVsdFZpZXdDb250YWluZXJMb2NhdGlvbkNvbnRleHRLZXkodmlld0NvbnRhaW5lcikuc2V0KGRlZmF1bHRMb2NhdGlvbik7XG5cdFx0dGhpcy5nZXRPclJlZ2lzdGVyVmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPclJlZ2lzdGVyVmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiBWaWV3Q29udGFpbmVyTW9kZWwge1xuXHRcdGxldCB2aWV3Q29udGFpbmVyTW9kZWwgPSB0aGlzLnZpZXdDb250YWluZXJNb2RlbHMuZ2V0KHZpZXdDb250YWluZXIpPy52aWV3Q29udGFpbmVyTW9kZWw7XG5cblx0XHRpZiAoIXZpZXdDb250YWluZXJNb2RlbCkge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHR2aWV3Q29udGFpbmVyTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShWaWV3Q29udGFpbmVyTW9kZWwsIHZpZXdDb250YWluZXIpKTtcblxuXHRcdFx0dGhpcy5vbkRpZENoYW5nZUFjdGl2ZVZpZXdzKHsgYWRkZWQ6IHZpZXdDb250YWluZXJNb2RlbC5hY3RpdmVWaWV3RGVzY3JpcHRvcnMsIHJlbW92ZWQ6IFtdIH0pO1xuXHRcdFx0dmlld0NvbnRhaW5lck1vZGVsLm9uRGlkQ2hhbmdlQWN0aXZlVmlld0Rlc2NyaXB0b3JzKGNoYW5nZWQgPT4gdGhpcy5vbkRpZENoYW5nZUFjdGl2ZVZpZXdzKGNoYW5nZWQpLCB0aGlzLCBkaXNwb3NhYmxlcyk7XG5cblx0XHRcdHRoaXMub25EaWRDaGFuZ2VWaXNpYmxlVmlld3MoeyBhZGRlZDogWy4uLnZpZXdDb250YWluZXJNb2RlbC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzXSwgcmVtb3ZlZDogW10gfSk7XG5cdFx0XHR2aWV3Q29udGFpbmVyTW9kZWwub25EaWRBZGRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzKGFkZGVkID0+IHRoaXMub25EaWRDaGFuZ2VWaXNpYmxlVmlld3MoeyBhZGRlZDogYWRkZWQubWFwKCh7IHZpZXdEZXNjcmlwdG9yIH0pID0+IHZpZXdEZXNjcmlwdG9yKSwgcmVtb3ZlZDogW10gfSksIHRoaXMsIGRpc3Bvc2FibGVzKTtcblx0XHRcdHZpZXdDb250YWluZXJNb2RlbC5vbkRpZFJlbW92ZVZpc2libGVWaWV3RGVzY3JpcHRvcnMocmVtb3ZlZCA9PiB0aGlzLm9uRGlkQ2hhbmdlVmlzaWJsZVZpZXdzKHsgYWRkZWQ6IFtdLCByZW1vdmVkOiByZW1vdmVkLm1hcCgoeyB2aWV3RGVzY3JpcHRvciB9KSA9PiB2aWV3RGVzY3JpcHRvcikgfSksIHRoaXMsIGRpc3Bvc2FibGVzKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLnZpZXdzVmlzaWJpbGl0eUFjdGlvbkRpc3Bvc2FibGVzLmRlbGV0ZUFuZERpc3Bvc2Uodmlld0NvbnRhaW5lcikpKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMucmVnaXN0ZXJSZXNldFZpZXdDb250YWluZXJBY3Rpb24odmlld0NvbnRhaW5lcikpO1xuXG5cdFx0XHRjb25zdCB2YWx1ZSA9IHsgdmlld0NvbnRhaW5lck1vZGVsOiB2aWV3Q29udGFpbmVyTW9kZWwsIGRpc3Bvc2FibGVzLCBkaXNwb3NlOiAoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkgfTtcblx0XHRcdHRoaXMudmlld0NvbnRhaW5lck1vZGVscy5zZXQodmlld0NvbnRhaW5lciwgdmFsdWUpO1xuXG5cdFx0XHQvLyBSZWdpc3RlciBhbGwgdmlld3MgdGhhdCB3ZXJlIHN0YXRpY2FsbHkgcmVnaXN0ZXJlZCB0byB0aGlzIGNvbnRhaW5lclxuXHRcdFx0Ly8gUG90ZW50aWFsbHksIHRoaXMgaXMgcmVnaXN0ZXJpbmcgc29tZXRoaW5nIHRoYXQgd2FzIGhhbmRsZWQgYnkgYW5vdGhlciBjb250YWluZXJcblx0XHRcdC8vIGFkZFZpZXdzKCkgaGFuZGxlcyB0aGlzIGJ5IGZpbHRlcmluZyB2aWV3cyB0aGF0IGFyZSBhbHJlYWR5IHJlZ2lzdGVyZWRcblx0XHRcdHRoaXMub25EaWRSZWdpc3RlclZpZXdzKFt7IHZpZXdzOiB0aGlzLnZpZXdzUmVnaXN0cnkuZ2V0Vmlld3Modmlld0NvbnRhaW5lciksIHZpZXdDb250YWluZXIgfV0pO1xuXG5cdFx0XHQvLyBBZGQgdmlld3MgdGhhdCB3ZXJlIHJlZ2lzdGVyZWQgcHJpb3IgdG8gdGhpcyB2aWV3IGNvbnRhaW5lclxuXHRcdFx0Y29uc3Qgdmlld3NUb1JlZ2lzdGVyID0gdGhpcy5nZXRWaWV3c0J5Q29udGFpbmVyKHZpZXdDb250YWluZXIpLmZpbHRlcih2aWV3ID0+IHRoaXMuZ2V0RGVmYXVsdENvbnRhaW5lckJ5SWQodmlldy5pZCkgIT09IHZpZXdDb250YWluZXIpO1xuXHRcdFx0aWYgKHZpZXdzVG9SZWdpc3Rlci5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5hZGRWaWV3cyh2aWV3Q29udGFpbmVyLCB2aWV3c1RvUmVnaXN0ZXIpO1xuXHRcdFx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmJ1ZmZlckNoYW5nZUV2ZW50cygoKSA9PiB7XG5cdFx0XHRcdFx0dmlld3NUb1JlZ2lzdGVyLmZvckVhY2godmlld0Rlc2NyaXB0b3IgPT4gdGhpcy5nZXRPckNyZWF0ZU1vdmFibGVWaWV3Q29udGV4dEtleSh2aWV3RGVzY3JpcHRvcikuc2V0KCEhdmlld0Rlc2NyaXB0b3IuY2FuTW92ZVZpZXcpKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmNhblJlZ2lzdGVyVmlld3NWaXNpYmlsaXR5QWN0aW9ucykge1xuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyVmlld3NWaXNpYmlsaXR5QWN0aW9ucyh2aWV3Q29udGFpbmVyLCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZpZXdDb250YWluZXJNb2RlbDtcblx0fVxuXG5cdHByaXZhdGUgb25EaWREZXJlZ2lzdGVyVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3Q29udGFpbmVyTW9kZWxzLmRlbGV0ZUFuZERpc3Bvc2Uodmlld0NvbnRhaW5lcik7XG5cdFx0dGhpcy52aWV3c1Zpc2liaWxpdHlBY3Rpb25EaXNwb3NhYmxlcy5kZWxldGVBbmREaXNwb3NlKHZpZXdDb250YWluZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZUFjdGl2ZVZpZXdzKHsgYWRkZWQsIHJlbW92ZWQgfTogeyBhZGRlZDogUmVhZG9ubHlBcnJheTxJVmlld0Rlc2NyaXB0b3I+OyByZW1vdmVkOiBSZWFkb25seUFycmF5PElWaWV3RGVzY3JpcHRvcj4gfSk6IHZvaWQge1xuXHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2UuYnVmZmVyQ2hhbmdlRXZlbnRzKCgpID0+IHtcblx0XHRcdGFkZGVkLmZvckVhY2godmlld0Rlc2NyaXB0b3IgPT4gdGhpcy5nZXRPckNyZWF0ZUFjdGl2ZVZpZXdDb250ZXh0S2V5KHZpZXdEZXNjcmlwdG9yKS5zZXQodHJ1ZSkpO1xuXHRcdFx0cmVtb3ZlZC5mb3JFYWNoKHZpZXdEZXNjcmlwdG9yID0+IHRoaXMuZ2V0T3JDcmVhdGVBY3RpdmVWaWV3Q29udGV4dEtleSh2aWV3RGVzY3JpcHRvcikuc2V0KGZhbHNlKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlVmlzaWJsZVZpZXdzKHsgYWRkZWQsIHJlbW92ZWQgfTogeyBhZGRlZDogSVZpZXdEZXNjcmlwdG9yW107IHJlbW92ZWQ6IElWaWV3RGVzY3JpcHRvcltdIH0pOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmJ1ZmZlckNoYW5nZUV2ZW50cygoKSA9PiB7XG5cdFx0XHRhZGRlZC5mb3JFYWNoKHZpZXdEZXNjcmlwdG9yID0+IHRoaXMuZ2V0T3JDcmVhdGVWaXNpYmxlVmlld0NvbnRleHRLZXkodmlld0Rlc2NyaXB0b3IpLnNldCh0cnVlKSk7XG5cdFx0XHRyZW1vdmVkLmZvckVhY2godmlld0Rlc2NyaXB0b3IgPT4gdGhpcy5nZXRPckNyZWF0ZVZpc2libGVWaWV3Q29udGV4dEtleSh2aWV3RGVzY3JpcHRvcikuc2V0KGZhbHNlKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVmlld3NWaXNpYmlsaXR5QWN0aW9ucyh2aWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyLCB7IHZpZXdDb250YWluZXJNb2RlbCwgZGlzcG9zYWJsZXMgfTogeyB2aWV3Q29udGFpbmVyTW9kZWw6IFZpZXdDb250YWluZXJNb2RlbDsgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSB9KTogdm9pZCB7XG5cdFx0dGhpcy52aWV3c1Zpc2liaWxpdHlBY3Rpb25EaXNwb3NhYmxlcy5kZWxldGVBbmREaXNwb3NlKHZpZXdDb250YWluZXIpO1xuXHRcdHRoaXMudmlld3NWaXNpYmlsaXR5QWN0aW9uRGlzcG9zYWJsZXMuc2V0KHZpZXdDb250YWluZXIsIHRoaXMucmVnaXN0ZXJWaWV3c1Zpc2liaWxpdHlBY3Rpb25zRm9yQ29udGFpbmVyKHZpZXdDb250YWluZXJNb2RlbCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChFdmVudC5hbnkoXG5cdFx0XHR2aWV3Q29udGFpbmVyTW9kZWwub25EaWRDaGFuZ2VBY3RpdmVWaWV3RGVzY3JpcHRvcnMsXG5cdFx0XHR2aWV3Q29udGFpbmVyTW9kZWwub25EaWRBZGRWaXNpYmxlVmlld0Rlc2NyaXB0b3JzLFxuXHRcdFx0dmlld0NvbnRhaW5lck1vZGVsLm9uRGlkUmVtb3ZlVmlzaWJsZVZpZXdEZXNjcmlwdG9ycyxcblx0XHRcdHZpZXdDb250YWluZXJNb2RlbC5vbkRpZE1vdmVWaXNpYmxlVmlld0Rlc2NyaXB0b3JzXG5cdFx0KShlID0+IHtcblx0XHRcdHRoaXMudmlld3NWaXNpYmlsaXR5QWN0aW9uRGlzcG9zYWJsZXMuZGVsZXRlQW5kRGlzcG9zZSh2aWV3Q29udGFpbmVyKTtcblx0XHRcdHRoaXMudmlld3NWaXNpYmlsaXR5QWN0aW9uRGlzcG9zYWJsZXMuc2V0KHZpZXdDb250YWluZXIsIHRoaXMucmVnaXN0ZXJWaWV3c1Zpc2liaWxpdHlBY3Rpb25zRm9yQ29udGFpbmVyKHZpZXdDb250YWluZXJNb2RlbCkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJWaWV3c1Zpc2liaWxpdHlBY3Rpb25zRm9yQ29udGFpbmVyKHZpZXdDb250YWluZXJNb2RlbDogVmlld0NvbnRhaW5lck1vZGVsKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHZpZXdDb250YWluZXJNb2RlbC5hY3RpdmVWaWV3RGVzY3JpcHRvcnMuZm9yRWFjaCgodmlld0Rlc2NyaXB0b3IsIGluZGV4KSA9PiB7XG5cdFx0XHRpZiAoIXZpZXdEZXNjcmlwdG9yLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld1BhbmVDb250YWluZXJBY3Rpb248Vmlld1BhbmVDb250YWluZXI+IHtcblx0XHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdFx0aWQ6IGAke3ZpZXdEZXNjcmlwdG9yLmlkfS50b2dnbGVWaXNpYmlsaXR5YCxcblx0XHRcdFx0XHRcdFx0dmlld1BhbmVDb250YWluZXJJZDogdmlld0NvbnRhaW5lck1vZGVsLnZpZXdDb250YWluZXIuaWQsXG5cdFx0XHRcdFx0XHRcdHByZWNvbmRpdGlvbjogdmlld0Rlc2NyaXB0b3IuY2FuVG9nZ2xlVmlzaWJpbGl0eSAmJiAoIXZpZXdDb250YWluZXJNb2RlbC5pc1Zpc2libGUodmlld0Rlc2NyaXB0b3IuaWQpIHx8IHZpZXdDb250YWluZXJNb2RlbC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCA+IDEpID8gQ29udGV4dEtleUV4cHIudHJ1ZSgpIDogQ29udGV4dEtleUV4cHIuZmFsc2UoKSxcblx0XHRcdFx0XHRcdFx0dG9nZ2xlZDogQ29udGV4dEtleUV4cHIuaGFzKGAke3ZpZXdEZXNjcmlwdG9yLmlkfS52aXNpYmxlYCksXG5cdFx0XHRcdFx0XHRcdHRpdGxlOiB2aWV3RGVzY3JpcHRvci5uYW1lLFxuXHRcdFx0XHRcdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZTIoJ3RvZ2dsZVZpc2liaWxpdHlEZXNjcmlwdGlvbicsICdUb2dnbGVzIHRoZSB2aXNpYmlsaXR5IG9mIHRoZSB7MH0gdmlldyBpZiB0aGUgdmlldyBjb250YWluZXIgaXQgaXMgbG9jYXRlZCBpbiBpcyB2aXNpYmxlJywgdmlld0Rlc2NyaXB0b3IubmFtZS52YWx1ZSlcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdFx0XHRpZDogVmlld3NTdWJNZW51LFxuXHRcdFx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lcicsIHZpZXdDb250YWluZXJNb2RlbC52aWV3Q29udGFpbmVyLmlkKSxcblx0XHRcdFx0XHRcdFx0XHRvcmRlcjogaW5kZXgsXG5cdFx0XHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZUNvbnRleHQsXG5cdFx0XHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3Q29udGFpbmVyJywgdmlld0NvbnRhaW5lck1vZGVsLnZpZXdDb250YWluZXIuaWQpLFxuXHRcdFx0XHRcdFx0XHRcdG9yZGVyOiBpbmRleCxcblx0XHRcdFx0XHRcdFx0XHRncm91cDogJzFfdG9nZ2xlVmlzaWJpbGl0eSdcblx0XHRcdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlQ29udGV4dCxcblx0XHRcdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vciguLi52aWV3Q29udGFpbmVyTW9kZWwudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5tYXAodiA9PiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCB2LmlkKSkpLFxuXHRcdFx0XHRcdFx0XHRcdG9yZGVyOiBpbmRleCxcblx0XHRcdFx0XHRcdFx0XHRncm91cDogJzJfdG9nZ2xlVmlzaWJpbGl0eSdcblx0XHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhc3luYyBydW5JblZpZXdQYW5lQ29udGFpbmVyKHNlcnZpY2VBY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgdmlld1BhbmVDb250YWluZXI6IFZpZXdQYW5lQ29udGFpbmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0XHR2aWV3UGFuZUNvbnRhaW5lci50b2dnbGVWaWV3VmlzaWJpbGl0eSh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBWaWV3UGFuZUNvbnRhaW5lckFjdGlvbjxWaWV3UGFuZUNvbnRhaW5lcj4ge1xuXHRcdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdFx0XHRpZDogYCR7dmlld0Rlc2NyaXB0b3IuaWR9LnJlbW92ZVZpZXdgLFxuXHRcdFx0XHRcdFx0XHR2aWV3UGFuZUNvbnRhaW5lcklkOiB2aWV3Q29udGFpbmVyTW9kZWwudmlld0NvbnRhaW5lci5pZCxcblx0XHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdoaWRlVmlldycsIFwiSGlkZSAnezB9J1wiLCB2aWV3RGVzY3JpcHRvci5uYW1lLnZhbHVlKSxcblx0XHRcdFx0XHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUyKCdoaWRlVmlld0Rlc2NyaXB0aW9uJywgJ0hpZGVzIHRoZSB7MH0gdmlldyBpZiBpdCBpcyB2aXNpYmxlIGFuZCB0aGUgdmlldyBjb250YWluZXIgaXQgaXMgbG9jYXRlZCBpbiBpcyB2aXNpYmxlJywgdmlld0Rlc2NyaXB0b3IubmFtZS52YWx1ZSlcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0cHJlY29uZGl0aW9uOiB2aWV3RGVzY3JpcHRvci5jYW5Ub2dnbGVWaXNpYmlsaXR5ICYmICghdmlld0NvbnRhaW5lck1vZGVsLmlzVmlzaWJsZSh2aWV3RGVzY3JpcHRvci5pZCkgfHwgdmlld0NvbnRhaW5lck1vZGVsLnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoID4gMSkgPyBDb250ZXh0S2V5RXhwci50cnVlKCkgOiBDb250ZXh0S2V5RXhwci5mYWxzZSgpLFxuXHRcdFx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlQ29udGV4dCxcblx0XHRcdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCB2aWV3RGVzY3JpcHRvci5pZCksXG5cdFx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoYCR7dmlld0Rlc2NyaXB0b3IuaWR9LnZpc2libGVgKSxcblx0XHRcdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0XHRcdGdyb3VwOiAnMV9oaWRlJyxcblx0XHRcdFx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGFzeW5jIHJ1bkluVmlld1BhbmVDb250YWluZXIoc2VydmljZUFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3UGFuZUNvbnRhaW5lcjogVmlld1BhbmVDb250YWluZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0XHRcdGlmICh2aWV3UGFuZUNvbnRhaW5lci5nZXRWaWV3KHZpZXdEZXNjcmlwdG9yLmlkKT8uaXNWaXNpYmxlKCkpIHtcblx0XHRcdFx0XHRcdFx0dmlld1BhbmVDb250YWluZXIudG9nZ2xlVmlld1Zpc2liaWxpdHkodmlld0Rlc2NyaXB0b3IuaWQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJSZXNldFZpZXdDb250YWluZXJBY3Rpb24odmlld0NvbnRhaW5lcjogVmlld0NvbnRhaW5lcik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRyZXR1cm4gcmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFJlc2V0Vmlld0xvY2F0aW9uQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgJHt2aWV3Q29udGFpbmVyLmlkfS5yZXNldFZpZXdDb250YWluZXJMb2NhdGlvbmAsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigncmVzZXRWaWV3TG9jYXRpb24nLCBcIlJlc2V0IExvY2F0aW9uXCIpLFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZUNvbnRleHQsXG5cdFx0XHRcdFx0XHRncm91cDogJzFfdmlld0FjdGlvbnMnLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXInLCB2aWV3Q29udGFpbmVyLmlkKSxcblx0XHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYCR7dmlld0NvbnRhaW5lci5pZH0uZGVmYXVsdFZpZXdDb250YWluZXJMb2NhdGlvbmAsIGZhbHNlKVxuXHRcdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdHRoYXQubW92ZVZpZXdDb250YWluZXJUb0xvY2F0aW9uKHZpZXdDb250YWluZXIsIHRoYXQuZ2V0RGVmYXVsdFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKSwgdW5kZWZpbmVkLCB0aGlzLmRlc2MuaWQpO1xuXHRcdFx0XHRhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkub3BlblZpZXdDb250YWluZXIodmlld0NvbnRhaW5lci5pZCwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFkZFZpZXdzKGNvbnRhaW5lcjogVmlld0NvbnRhaW5lciwgdmlld3M6IElWaWV3RGVzY3JpcHRvcltdLCB2aXNpYmlsaXR5U3RhdGU6IFZpZXdWaXNpYmlsaXR5U3RhdGUgPSBWaWV3VmlzaWJpbGl0eVN0YXRlLkRlZmF1bHQpOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmJ1ZmZlckNoYW5nZUV2ZW50cygoKSA9PiB7XG5cdFx0XHR2aWV3cy5mb3JFYWNoKHZpZXcgPT4ge1xuXHRcdFx0XHRjb25zdCBpc0RlZmF1bHRDb250YWluZXIgPSB0aGlzLmdldERlZmF1bHRDb250YWluZXJCeUlkKHZpZXcuaWQpID09PSBjb250YWluZXI7XG5cdFx0XHRcdHRoaXMuZ2V0T3JDcmVhdGVEZWZhdWx0Vmlld0xvY2F0aW9uQ29udGV4dEtleSh2aWV3KS5zZXQoaXNEZWZhdWx0Q29udGFpbmVyKTtcblx0XHRcdFx0aWYgKGlzRGVmYXVsdENvbnRhaW5lcikge1xuXHRcdFx0XHRcdHRoaXMudmlld0Rlc2NyaXB0b3JzQ3VzdG9tTG9jYXRpb25zLmRlbGV0ZSh2aWV3LmlkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yc0N1c3RvbUxvY2F0aW9ucy5zZXQodmlldy5pZCwgY29udGFpbmVyLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpLmFkZCh2aWV3cy5tYXAodmlldyA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR2aWV3RGVzY3JpcHRvcjogdmlldyxcblx0XHRcdFx0Y29sbGFwc2VkOiB2aXNpYmlsaXR5U3RhdGUgPT09IFZpZXdWaXNpYmlsaXR5U3RhdGUuRGVmYXVsdCA/IHVuZGVmaW5lZCA6IGZhbHNlLFxuXHRcdFx0XHR2aXNpYmxlOiB2aXNpYmlsaXR5U3RhdGUgPT09IFZpZXdWaXNpYmlsaXR5U3RhdGUuRGVmYXVsdCA/IHVuZGVmaW5lZCA6IHRydWVcblx0XHRcdH07XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVWaWV3cyhjb250YWluZXI6IFZpZXdDb250YWluZXIsIHZpZXdzOiBJVmlld0Rlc2NyaXB0b3JbXSk6IHZvaWQge1xuXHRcdC8vIFNldCB2aWV3IGRlZmF1bHQgbG9jYXRpb24ga2V5cyB0byBmYWxzZVxuXHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2UuYnVmZmVyQ2hhbmdlRXZlbnRzKCgpID0+IHtcblx0XHRcdHZpZXdzLmZvckVhY2godmlldyA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLnZpZXdEZXNjcmlwdG9yc0N1c3RvbUxvY2F0aW9ucy5nZXQodmlldy5pZCkgPT09IGNvbnRhaW5lci5pZCkge1xuXHRcdFx0XHRcdHRoaXMudmlld0Rlc2NyaXB0b3JzQ3VzdG9tTG9jYXRpb25zLmRlbGV0ZSh2aWV3LmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmdldE9yQ3JlYXRlRGVmYXVsdFZpZXdMb2NhdGlvbkNvbnRleHRLZXkodmlldykuc2V0KGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Ly8gUmVtb3ZlIHRoZSB2aWV3c1xuXHRcdHRoaXMuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKGNvbnRhaW5lcikucmVtb3ZlKHZpZXdzKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0T3JDcmVhdGVBY3RpdmVWaWV3Q29udGV4dEtleSh2aWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yKTogSUNvbnRleHRLZXk8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IGFjdGl2ZUNvbnRleHRLZXlJZCA9IGAke3ZpZXdEZXNjcmlwdG9yLmlkfS5hY3RpdmVgO1xuXHRcdGxldCBjb250ZXh0S2V5ID0gdGhpcy5hY3RpdmVWaWV3Q29udGV4dEtleXMuZ2V0KGFjdGl2ZUNvbnRleHRLZXlJZCk7XG5cdFx0aWYgKCFjb250ZXh0S2V5KSB7XG5cdFx0XHRjb250ZXh0S2V5ID0gbmV3IFJhd0NvbnRleHRLZXkoYWN0aXZlQ29udGV4dEtleUlkLCBmYWxzZSkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5hY3RpdmVWaWV3Q29udGV4dEtleXMuc2V0KGFjdGl2ZUNvbnRleHRLZXlJZCwgY29udGV4dEtleSk7XG5cdFx0fVxuXHRcdHJldHVybiBjb250ZXh0S2V5O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPckNyZWF0ZVZpc2libGVWaWV3Q29udGV4dEtleSh2aWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yKTogSUNvbnRleHRLZXk8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IGFjdGl2ZUNvbnRleHRLZXlJZCA9IGAke3ZpZXdEZXNjcmlwdG9yLmlkfS52aXNpYmxlYDtcblx0XHRsZXQgY29udGV4dEtleSA9IHRoaXMuYWN0aXZlVmlld0NvbnRleHRLZXlzLmdldChhY3RpdmVDb250ZXh0S2V5SWQpO1xuXHRcdGlmICghY29udGV4dEtleSkge1xuXHRcdFx0Y29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5KGFjdGl2ZUNvbnRleHRLZXlJZCwgZmFsc2UpLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdHRoaXMuYWN0aXZlVmlld0NvbnRleHRLZXlzLnNldChhY3RpdmVDb250ZXh0S2V5SWQsIGNvbnRleHRLZXkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY29udGV4dEtleTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0T3JDcmVhdGVNb3ZhYmxlVmlld0NvbnRleHRLZXkodmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvcik6IElDb250ZXh0S2V5PGJvb2xlYW4+IHtcblx0XHRjb25zdCBtb3ZhYmxlVmlld0NvbnRleHRLZXlJZCA9IGAke3ZpZXdEZXNjcmlwdG9yLmlkfS5jYW5Nb3ZlYDtcblx0XHRsZXQgY29udGV4dEtleSA9IHRoaXMubW92YWJsZVZpZXdDb250ZXh0S2V5cy5nZXQobW92YWJsZVZpZXdDb250ZXh0S2V5SWQpO1xuXHRcdGlmICghY29udGV4dEtleSkge1xuXHRcdFx0Y29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5KG1vdmFibGVWaWV3Q29udGV4dEtleUlkLCBmYWxzZSkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5tb3ZhYmxlVmlld0NvbnRleHRLZXlzLnNldChtb3ZhYmxlVmlld0NvbnRleHRLZXlJZCwgY29udGV4dEtleSk7XG5cdFx0fVxuXHRcdHJldHVybiBjb250ZXh0S2V5O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPckNyZWF0ZURlZmF1bHRWaWV3TG9jYXRpb25Db250ZXh0S2V5KHZpZXdEZXNjcmlwdG9yOiBJVmlld0Rlc2NyaXB0b3IpOiBJQ29udGV4dEtleTxib29sZWFuPiB7XG5cdFx0Y29uc3QgZGVmYXVsdFZpZXdMb2NhdGlvbkNvbnRleHRLZXlJZCA9IGAke3ZpZXdEZXNjcmlwdG9yLmlkfS5kZWZhdWx0Vmlld0xvY2F0aW9uYDtcblx0XHRsZXQgY29udGV4dEtleSA9IHRoaXMuZGVmYXVsdFZpZXdMb2NhdGlvbkNvbnRleHRLZXlzLmdldChkZWZhdWx0Vmlld0xvY2F0aW9uQ29udGV4dEtleUlkKTtcblx0XHRpZiAoIWNvbnRleHRLZXkpIHtcblx0XHRcdGNvbnRleHRLZXkgPSBuZXcgUmF3Q29udGV4dEtleShkZWZhdWx0Vmlld0xvY2F0aW9uQ29udGV4dEtleUlkLCBmYWxzZSkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5kZWZhdWx0Vmlld0xvY2F0aW9uQ29udGV4dEtleXMuc2V0KGRlZmF1bHRWaWV3TG9jYXRpb25Db250ZXh0S2V5SWQsIGNvbnRleHRLZXkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY29udGV4dEtleTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0T3JDcmVhdGVEZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uQ29udGV4dEtleSh2aWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyKTogSUNvbnRleHRLZXk8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IGRlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb25Db250ZXh0S2V5SWQgPSBgJHt2aWV3Q29udGFpbmVyLmlkfS5kZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uYDtcblx0XHRsZXQgY29udGV4dEtleSA9IHRoaXMuZGVmYXVsdFZpZXdDb250YWluZXJMb2NhdGlvbkNvbnRleHRLZXlzLmdldChkZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uQ29udGV4dEtleUlkKTtcblx0XHRpZiAoIWNvbnRleHRLZXkpIHtcblx0XHRcdGNvbnRleHRLZXkgPSBuZXcgUmF3Q29udGV4dEtleShkZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uQ29udGV4dEtleUlkLCBmYWxzZSkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5kZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uQ29udGV4dEtleXMuc2V0KGRlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb25Db250ZXh0S2V5SWQsIGNvbnRleHRLZXkpO1xuXHRcdH1cblx0XHRyZXR1cm4gY29udGV4dEtleTtcblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBWaWV3RGVzY3JpcHRvclNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHVCQUF1Qix3QkFB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QUFHLGVBQWUsRUFBRTtBQUMvQyxRQUFJLGFBQWEsS0FBSyxzQkFBc0IsSUFBSSxrQkFBa0I7QUFDbEUsUUFBSSxDQUFDLFlBQVk7QUFDaEIsbUJBQWEsSUFBSSxjQUFjLG9CQUFvQixLQUFLLEVBQUUsT0FBTyxLQUFLLGlCQUFpQjtBQUN2RixXQUFLLHNCQUFzQixJQUFJLG9CQUFvQixVQUFVO0FBQUEsSUFDOUQ7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsaUNBQWlDLGdCQUF1RDtBQUMvRixVQUFNLDBCQUEwQixHQUFHLGVBQWUsRUFBRTtBQUNwRCxRQUFJLGFBQWEsS0FBSyx1QkFBdUIsSUFBSSx1QkFBdUI7QUFDeEUsUUFBSSxDQUFDLFlBQVk7QUFDaEIsbUJBQWEsSUFBSSxjQUFjLHlCQUF5QixLQUFLLEVBQUUsT0FBTyxLQUFLLGlCQUFpQjtBQUM1RixXQUFLLHVCQUF1QixJQUFJLHlCQUF5QixVQUFVO0FBQUEsSUFDcEU7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEseUNBQXlDLGdCQUF1RDtBQUN2RyxVQUFNLGtDQUFrQyxHQUFHLGVBQWUsRUFBRTtBQUM1RCxRQUFJLGFBQWEsS0FBSywrQkFBK0IsSUFBSSwrQkFBK0I7QUFDeEYsUUFBSSxDQUFDLFlBQVk7QUFDaEIsbUJBQWEsSUFBSSxjQUFjLGlDQUFpQyxLQUFLLEVBQUUsT0FBTyxLQUFLLGlCQUFpQjtBQUNwRyxXQUFLLCtCQUErQixJQUFJLGlDQUFpQyxVQUFVO0FBQUEsSUFDcEY7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsa0RBQWtELGVBQW9EO0FBQzdHLFVBQU0sMkNBQTJDLEdBQUcsY0FBYyxFQUFFO0FBQ3BFLFFBQUksYUFBYSxLQUFLLHdDQUF3QyxJQUFJLHdDQUF3QztBQUMxRyxRQUFJLENBQUMsWUFBWTtBQUNoQixtQkFBYSxJQUFJLGNBQWMsMENBQTBDLEtBQUssRUFBRSxPQUFPLEtBQUssaUJBQWlCO0FBQzdHLFdBQUssd0NBQXdDLElBQUksMENBQTBDLFVBQVU7QUFBQSxJQUN0RztBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUF2NUJhLHNCQUlZLHVCQUF1QjtBQUpuQyxzQkFLWSw2QkFBNkI7QUFMekMsd0JBQU47QUFBQSxFQXNDSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0EzQ1U7QUF5NUJiLGtCQUFrQix3QkFBd0IsdUJBQXVCLGtCQUFrQixPQUFPOyIsCiAgIm5hbWVzIjogWyJ2aWV3cyJdCn0K
