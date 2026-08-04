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
import { localize } from "../../../nls.js";
import { ActionsOrientation } from "../../../base/browser/ui/actionbar/actionbar.js";
import { IActivityService } from "../../services/activity/common/activity.js";
import { IWorkbenchLayoutService, Parts } from "../../services/layout/browser/layoutService.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { DisposableStore, Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { CompositeBar, CompositeDragAndDrop } from "./compositeBar.js";
import { Dimension, isMouseEvent } from "../../../base/browser/dom.js";
import { createCSSRule } from "../../../base/browser/domStylesheets.js";
import { asCSSUrl } from "../../../base/browser/cssValue.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { URI } from "../../../base/common/uri.js";
import { ToggleCompositePinnedAction, ToggleCompositeBadgeAction, CompositeBarAction } from "./compositeBarActions.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../common/views.js";
import { IContextKeyService, ContextKeyExpr } from "../../../platform/contextkey/common/contextkey.js";
import { isString } from "../../../base/common/types.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { isNative } from "../../../base/common/platform.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { Separator, SubmenuAction, toAction } from "../../../base/common/actions.js";
import { StringSHA1 } from "../../../base/common/hash.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IViewsService } from "../../services/views/common/viewsService.js";
let PaneCompositeBar = class extends Disposable {
  constructor(options, part, paneCompositePart, instantiationService, storageService, extensionService, viewDescriptorService, viewService, contextKeyService, environmentService, layoutService) {
    super();
    this.options = options;
    this.part = part;
    this.paneCompositePart = paneCompositePart;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.viewDescriptorService = viewDescriptorService;
    this.viewService = viewService;
    this.contextKeyService = contextKeyService;
    this.environmentService = environmentService;
    this.layoutService = layoutService;
    this.viewContainerDisposables = this._register(new DisposableMap());
    this.compositeActions = /* @__PURE__ */ new Map();
    this.hasExtensionsRegistered = false;
    this._cachedViewContainers = void 0;
    this.location = paneCompositePart.partId === Parts.PANEL_PART ? ViewContainerLocation.Panel : paneCompositePart.partId === Parts.AUXILIARYBAR_PART ? ViewContainerLocation.AuxiliaryBar : ViewContainerLocation.Sidebar;
    this.dndHandler = new CompositeDragAndDrop(
      this.viewDescriptorService,
      this.location,
      this.options.orientation,
      async (id, focus) => {
        return await this.paneCompositePart.openPaneComposite(id, focus) ?? null;
      },
      (from, to, before) => this.compositeBar.move(from, to, this.options.orientation === ActionsOrientation.VERTICAL ? before?.verticallyBefore : before?.horizontallyBefore),
      () => this.compositeBar.getCompositeBarItems()
    );
    const cachedItems = this.cachedViewContainers.map((container) => ({
      id: container.id,
      name: container.name,
      visible: !this.shouldBeHidden(container.id, container),
      order: container.order,
      pinned: container.pinned
    }));
    this.compositeBar = this.createCompositeBar(cachedItems);
    this.onDidRegisterViewContainers(this.getViewContainers());
    this.registerListeners();
  }
  createCompositeBar(cachedItems) {
    return this._register(this.instantiationService.createInstance(CompositeBar, cachedItems, {
      icon: this.options.icon,
      compact: this.options.compact,
      orientation: this.options.orientation,
      activityHoverOptions: this.options.activityHoverOptions,
      preventLoopNavigation: this.options.preventLoopNavigation,
      openComposite: async (compositeId, preserveFocus) => {
        return await this.paneCompositePart.openPaneComposite(compositeId, !preserveFocus) ?? null;
      },
      getActivityAction: (compositeId) => this.getCompositeActions(compositeId).activityAction,
      getCompositePinnedAction: (compositeId) => this.getCompositeActions(compositeId).pinnedAction,
      getCompositeBadgeAction: (compositeId) => this.getCompositeActions(compositeId).badgeAction,
      getOnCompositeClickAction: (compositeId) => this.getCompositeActions(compositeId).activityAction,
      fillExtraContextMenuActions: (actions, e) => this.options.fillExtraContextMenuActions(actions, e),
      getContextMenuActionsForComposite: (compositeId) => this.getContextMenuActionsForComposite(compositeId),
      getDefaultCompositeId: () => this.viewDescriptorService.getDefaultViewContainer(this.location)?.id,
      dndHandler: this.dndHandler,
      compositeSize: this.options.compositeSize,
      overflowActionSize: this.options.overflowActionSize,
      colors: (theme) => this.options.colors(theme)
    }));
  }
  getContextMenuActionsForComposite(compositeId) {
    const actions = [new Separator()];
    const viewContainer = this.viewDescriptorService.getViewContainerById(compositeId);
    const defaultLocation = this.viewDescriptorService.getDefaultViewContainerLocation(viewContainer);
    const currentLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
    const moveActions = [];
    for (const location of [ViewContainerLocation.Sidebar, ViewContainerLocation.AuxiliaryBar, ViewContainerLocation.Panel]) {
      if (currentLocation !== location) {
        moveActions.push(this.createMoveAction(viewContainer, location, defaultLocation));
      }
    }
    actions.push(new SubmenuAction("moveToMenu", localize("moveToMenu", "Move To"), moveActions));
    if (defaultLocation !== currentLocation) {
      actions.push(toAction({
        id: "resetLocationAction",
        label: localize("resetLocation", "Reset Location"),
        run: () => {
          this.viewDescriptorService.moveViewContainerToLocation(viewContainer, defaultLocation, void 0, "resetLocationAction");
          this.viewService.openViewContainer(viewContainer.id, true);
        }
      }));
    } else {
      const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
      if (viewContainerModel.allViewDescriptors.length === 1) {
        const viewToReset = viewContainerModel.allViewDescriptors[0];
        const defaultContainer = this.viewDescriptorService.getDefaultContainerById(viewToReset.id);
        if (defaultContainer !== viewContainer) {
          actions.push(toAction({
            id: "resetLocationAction",
            label: localize("resetLocation", "Reset Location"),
            run: () => {
              this.viewDescriptorService.moveViewsToContainer([viewToReset], defaultContainer, void 0, "resetLocationAction");
              this.viewService.openViewContainer(viewContainer.id, true);
            }
          }));
        }
      }
    }
    return actions;
  }
  createMoveAction(viewContainer, newLocation, defaultLocation) {
    return toAction({
      id: `moveViewContainerTo${newLocation}`,
      label: newLocation === ViewContainerLocation.Panel ? localize("panel", "Panel") : newLocation === ViewContainerLocation.Sidebar ? localize("sidebar", "Primary Side Bar") : localize("auxiliarybar", "Void Side Bar"),
      run: () => {
        let index;
        if (newLocation !== defaultLocation) {
          index = this.viewDescriptorService.getViewContainersByLocation(newLocation).length;
        } else {
          index = void 0;
        }
        this.viewDescriptorService.moveViewContainerToLocation(viewContainer, newLocation, index);
        this.viewService.openViewContainer(viewContainer.id, true);
      }
    });
  }
  registerListeners() {
    this._register(this.viewDescriptorService.onDidChangeViewContainers(({ added, removed }) => this.onDidChangeViewContainers(added, removed)));
    this._register(this.viewDescriptorService.onDidChangeContainerLocation(({ viewContainer, from, to }) => this.onDidChangeViewContainerLocation(viewContainer, from, to)));
    this._register(this.paneCompositePart.onDidPaneCompositeOpen((e) => this.onDidChangeViewContainerVisibility(e.getId(), true)));
    this._register(this.paneCompositePart.onDidPaneCompositeClose((e) => this.onDidChangeViewContainerVisibility(e.getId(), false)));
    this.extensionService.whenInstalledExtensionsRegistered().then(() => {
      if (this._store.isDisposed) {
        return;
      }
      this.onDidRegisterExtensions();
      this._register(this.compositeBar.onDidChange(() => {
        this.updateCompositeBarItemsFromStorage(true);
        this.saveCachedViewContainers();
      }));
      this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, this.options.pinnedViewContainersKey, this._store)(() => this.updateCompositeBarItemsFromStorage(false)));
    });
  }
  onDidChangeViewContainers(added, removed) {
    removed.filter(({ location }) => location === this.location).forEach(({ container }) => this.onDidDeregisterViewContainer(container));
    this.onDidRegisterViewContainers(added.filter(({ location }) => location === this.location).map(({ container }) => container));
  }
  onDidChangeViewContainerLocation(container, from, to) {
    if (from === this.location) {
      this.onDidDeregisterViewContainer(container);
    }
    if (to === this.location) {
      this.onDidRegisterViewContainers([container]);
    }
  }
  onDidChangeViewContainerVisibility(id, visible) {
    if (visible) {
      this.onDidViewContainerVisible(id);
    } else {
      this.compositeBar.deactivateComposite(id);
    }
  }
  onDidRegisterExtensions() {
    this.hasExtensionsRegistered = true;
    for (const { id } of this.cachedViewContainers) {
      const viewContainer = this.getViewContainer(id);
      if (viewContainer) {
        this.showOrHideViewContainer(viewContainer);
      } else {
        if (this.viewDescriptorService.isViewContainerRemovedPermanently(id)) {
          this.removeComposite(id);
        } else {
          this.hideComposite(id);
        }
      }
    }
    this.saveCachedViewContainers();
  }
  onDidViewContainerVisible(id) {
    const viewContainer = this.getViewContainer(id);
    if (viewContainer) {
      this.addComposite(viewContainer);
      this.compositeBar.activateComposite(viewContainer.id);
      if (this.shouldBeHidden(viewContainer)) {
        const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
        if (viewContainerModel.activeViewDescriptors.length === 0) {
          this.hideComposite(viewContainer.id);
        }
      }
    }
  }
  create(parent) {
    return this.compositeBar.create(parent);
  }
  getCompositeActions(compositeId) {
    let compositeActions = this.compositeActions.get(compositeId);
    if (!compositeActions) {
      const viewContainer = this.getViewContainer(compositeId);
      if (viewContainer) {
        const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
        compositeActions = {
          activityAction: this._register(this.instantiationService.createInstance(ViewContainerActivityAction, this.toCompositeBarActionItemFrom(viewContainerModel), this.part, this.paneCompositePart)),
          pinnedAction: this._register(new ToggleCompositePinnedAction(this.toCompositeBarActionItemFrom(viewContainerModel), this.compositeBar)),
          badgeAction: this._register(new ToggleCompositeBadgeAction(this.toCompositeBarActionItemFrom(viewContainerModel), this.compositeBar))
        };
      } else {
        const cachedComposite = this.cachedViewContainers.filter((c) => c.id === compositeId)[0];
        compositeActions = {
          activityAction: this._register(this.instantiationService.createInstance(PlaceHolderViewContainerActivityAction, this.toCompositeBarActionItem(compositeId, cachedComposite?.name ?? compositeId, cachedComposite?.icon, void 0), this.part, this.paneCompositePart)),
          pinnedAction: this._register(new PlaceHolderToggleCompositePinnedAction(compositeId, this.compositeBar)),
          badgeAction: this._register(new PlaceHolderToggleCompositeBadgeAction(compositeId, this.compositeBar))
        };
      }
      this.compositeActions.set(compositeId, compositeActions);
    }
    return compositeActions;
  }
  onDidRegisterViewContainers(viewContainers) {
    for (const viewContainer of viewContainers) {
      this.addComposite(viewContainer);
      const cachedViewContainer = this.cachedViewContainers.filter(({ id }) => id === viewContainer.id)[0];
      if (PaneCompositeBar._plaxioHiddenViewContainers.has(viewContainer.id)) {
        this.compositeBar.unpin(viewContainer.id);
        this.hideComposite(viewContainer.id);
      } else if (!cachedViewContainer || viewContainer.id === "workbench.view.plcEditor") {
        this.compositeBar.pin(viewContainer.id);
      }
      const visibleViewContainer = this.paneCompositePart.getActivePaneComposite();
      if (visibleViewContainer?.getId() === viewContainer.id) {
        this.compositeBar.activateComposite(viewContainer.id);
      }
      const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
      this.updateCompositeBarActionItem(viewContainer, viewContainerModel);
      this.showOrHideViewContainer(viewContainer);
      const disposables = new DisposableStore();
      disposables.add(viewContainerModel.onDidChangeContainerInfo(() => this.updateCompositeBarActionItem(viewContainer, viewContainerModel)));
      disposables.add(viewContainerModel.onDidChangeActiveViewDescriptors(() => this.showOrHideViewContainer(viewContainer)));
      this.viewContainerDisposables.set(viewContainer.id, disposables);
    }
  }
  onDidDeregisterViewContainer(viewContainer) {
    this.viewContainerDisposables.deleteAndDispose(viewContainer.id);
    this.removeComposite(viewContainer.id);
  }
  updateCompositeBarActionItem(viewContainer, viewContainerModel) {
    const compositeBarActionItem = this.toCompositeBarActionItemFrom(viewContainerModel);
    const { activityAction, pinnedAction } = this.getCompositeActions(viewContainer.id);
    activityAction.updateCompositeBarActionItem(compositeBarActionItem);
    if (pinnedAction instanceof PlaceHolderToggleCompositePinnedAction) {
      pinnedAction.setActivity(compositeBarActionItem);
    }
    if (this.options.recomputeSizes) {
      this.compositeBar.recomputeSizes();
    }
    this.saveCachedViewContainers();
  }
  toCompositeBarActionItemFrom(viewContainerModel) {
    return this.toCompositeBarActionItem(viewContainerModel.viewContainer.id, viewContainerModel.title, viewContainerModel.icon, viewContainerModel.keybindingId);
  }
  toCompositeBarActionItem(id, name, icon, keybindingId) {
    let classNames = void 0;
    let iconUrl = void 0;
    if (this.options.icon) {
      if (URI.isUri(icon)) {
        iconUrl = icon;
        const cssUrl = asCSSUrl(icon);
        const hash = new StringSHA1();
        hash.update(cssUrl);
        const iconId = `activity-${id.replace(/\./g, "-")}-${hash.digest()}`;
        const iconClass = `.monaco-workbench .${this.options.partContainerClass} .monaco-action-bar .action-label.${iconId}`;
        classNames = [iconId, "uri-icon"];
        createCSSRule(iconClass, `
				mask: ${cssUrl} no-repeat 50% 50%;
				mask-size: ${this.options.iconSize}px;
				-webkit-mask: ${cssUrl} no-repeat 50% 50%;
				-webkit-mask-size: ${this.options.iconSize}px;
				mask-origin: padding;
				-webkit-mask-origin: padding;
			`);
      } else if (ThemeIcon.isThemeIcon(icon)) {
        classNames = ThemeIcon.asClassNameArray(icon);
      }
    }
    return { id, name, classNames, iconUrl, keybindingId };
  }
  showOrHideViewContainer(viewContainer) {
    if (this.shouldBeHidden(viewContainer)) {
      this.hideComposite(viewContainer.id);
    } else {
      this.addComposite(viewContainer);
      const activePaneComposite = this.paneCompositePart.getActivePaneComposite();
      if (activePaneComposite?.getId() === viewContainer.id) {
        this.compositeBar.activateComposite(viewContainer.id);
      }
    }
  }
  shouldBeHidden(viewContainerOrId, cachedViewContainer) {
    const viewContainer = isString(viewContainerOrId) ? this.getViewContainer(viewContainerOrId) : viewContainerOrId;
    const viewContainerId = isString(viewContainerOrId) ? viewContainerOrId : viewContainerOrId.id;
    if (viewContainer) {
      if (viewContainer.hideIfEmpty) {
        if (this.viewService.isViewContainerActive(viewContainerId)) {
          return false;
        }
      } else {
        return false;
      }
    }
    if (!this.hasExtensionsRegistered && !(this.part === Parts.SIDEBAR_PART && this.environmentService.remoteAuthority && isNative)) {
      cachedViewContainer = cachedViewContainer || this.cachedViewContainers.find(({ id }) => id === viewContainerId);
      if (!viewContainer && cachedViewContainer?.isBuiltin && cachedViewContainer?.visible) {
        return false;
      }
      if (cachedViewContainer?.views?.length) {
        return cachedViewContainer.views.every(({ when }) => !!when && !this.contextKeyService.contextMatchesRules(ContextKeyExpr.deserialize(when)));
      }
    }
    return true;
  }
  addComposite(viewContainer) {
    this.compositeBar.addComposite({ id: viewContainer.id, name: typeof viewContainer.title === "string" ? viewContainer.title : viewContainer.title.value, order: viewContainer.order, requestedIndex: viewContainer.requestedIndex });
  }
  hideComposite(compositeId) {
    this.compositeBar.hideComposite(compositeId);
    const compositeActions = this.compositeActions.get(compositeId);
    if (compositeActions) {
      compositeActions.activityAction.dispose();
      compositeActions.pinnedAction.dispose();
      this.compositeActions.delete(compositeId);
    }
  }
  removeComposite(compositeId) {
    this.compositeBar.removeComposite(compositeId);
    const compositeActions = this.compositeActions.get(compositeId);
    if (compositeActions) {
      compositeActions.activityAction.dispose();
      compositeActions.pinnedAction.dispose();
      this.compositeActions.delete(compositeId);
    }
  }
  getPinnedPaneCompositeIds() {
    const pinnedCompositeIds = this.compositeBar.getPinnedComposites().map((v) => v.id);
    return this.getViewContainers().filter((v) => this.compositeBar.isPinned(v.id)).sort((v1, v2) => pinnedCompositeIds.indexOf(v1.id) - pinnedCompositeIds.indexOf(v2.id)).map((v) => v.id);
  }
  getVisiblePaneCompositeIds() {
    return this.compositeBar.getVisibleComposites().filter((v) => this.paneCompositePart.getActivePaneComposite()?.getId() === v.id || this.compositeBar.isPinned(v.id)).map((v) => v.id);
  }
  getPaneCompositeIds() {
    return this.compositeBar.getVisibleComposites().map((v) => v.id);
  }
  getContextMenuActions() {
    return this.compositeBar.getContextMenuActions();
  }
  focus(index) {
    this.compositeBar.focus(index);
  }
  layout(width, height) {
    this.compositeBar.layout(new Dimension(width, height));
  }
  getViewContainer(id) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(id);
    return viewContainer && this.viewDescriptorService.getViewContainerLocation(viewContainer) === this.location ? viewContainer : void 0;
  }
  getViewContainers() {
    return this.viewDescriptorService.getViewContainersByLocation(this.location);
  }
  updateCompositeBarItemsFromStorage(retainExisting) {
    if (this.pinnedViewContainersValue === this.getStoredPinnedViewContainersValue()) {
      return;
    }
    this._placeholderViewContainersValue = void 0;
    this._pinnedViewContainersValue = void 0;
    this._cachedViewContainers = void 0;
    const newCompositeItems = [];
    const compositeItems = this.compositeBar.getCompositeBarItems();
    for (const cachedViewContainer of this.cachedViewContainers) {
      newCompositeItems.push({
        id: cachedViewContainer.id,
        name: cachedViewContainer.name,
        order: cachedViewContainer.order,
        pinned: cachedViewContainer.pinned,
        visible: cachedViewContainer.visible && !!this.getViewContainer(cachedViewContainer.id)
      });
    }
    for (const viewContainer of this.getViewContainers()) {
      if (!newCompositeItems.some(({ id }) => id === viewContainer.id)) {
        const index = compositeItems.findIndex(({ id }) => id === viewContainer.id);
        if (index !== -1) {
          const compositeItem = compositeItems[index];
          newCompositeItems.splice(index, 0, {
            id: viewContainer.id,
            name: typeof viewContainer.title === "string" ? viewContainer.title : viewContainer.title.value,
            order: compositeItem.order,
            pinned: compositeItem.pinned,
            visible: compositeItem.visible
          });
        } else {
          newCompositeItems.push({
            id: viewContainer.id,
            name: typeof viewContainer.title === "string" ? viewContainer.title : viewContainer.title.value,
            order: viewContainer.order,
            pinned: true,
            visible: !this.shouldBeHidden(viewContainer)
          });
        }
      }
    }
    if (retainExisting) {
      for (const compositeItem of compositeItems) {
        const newCompositeItem = newCompositeItems.find(({ id }) => id === compositeItem.id);
        if (!newCompositeItem) {
          newCompositeItems.push(compositeItem);
        }
      }
    }
    this.compositeBar.setCompositeBarItems(newCompositeItems);
  }
  saveCachedViewContainers() {
    const state = [];
    const compositeItems = this.compositeBar.getCompositeBarItems();
    for (const compositeItem of compositeItems) {
      const viewContainer = this.getViewContainer(compositeItem.id);
      if (viewContainer) {
        const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
        const views = [];
        for (const { when } of viewContainerModel.allViewDescriptors) {
          views.push({ when: when ? when.serialize() : void 0 });
        }
        state.push({
          id: compositeItem.id,
          name: viewContainerModel.title,
          icon: URI.isUri(viewContainerModel.icon) && this.environmentService.remoteAuthority ? void 0 : viewContainerModel.icon,
          // Do not cache uri icons with remote connection
          views,
          pinned: compositeItem.pinned,
          order: compositeItem.order,
          visible: compositeItem.visible,
          isBuiltin: !viewContainer.extensionId
        });
      } else {
        state.push({ id: compositeItem.id, name: compositeItem.name, pinned: compositeItem.pinned, order: compositeItem.order, visible: false, isBuiltin: false });
      }
    }
    this.storeCachedViewContainersState(state);
  }
  get cachedViewContainers() {
    if (this._cachedViewContainers === void 0) {
      this._cachedViewContainers = this.getPinnedViewContainers();
      for (const placeholderViewContainer of this.getPlaceholderViewContainers()) {
        const cachedViewContainer = this._cachedViewContainers.find((cached) => cached.id === placeholderViewContainer.id);
        if (cachedViewContainer) {
          cachedViewContainer.visible = placeholderViewContainer.visible ?? cachedViewContainer.visible;
          cachedViewContainer.name = placeholderViewContainer.name;
          cachedViewContainer.icon = placeholderViewContainer.themeIcon ? placeholderViewContainer.themeIcon : placeholderViewContainer.iconUrl ? URI.revive(placeholderViewContainer.iconUrl) : void 0;
          if (URI.isUri(cachedViewContainer.icon) && this.environmentService.remoteAuthority) {
            cachedViewContainer.icon = void 0;
          }
          cachedViewContainer.views = placeholderViewContainer.views;
          cachedViewContainer.isBuiltin = placeholderViewContainer.isBuiltin;
        }
      }
      for (const viewContainerWorkspaceState of this.getViewContainersWorkspaceState()) {
        const cachedViewContainer = this._cachedViewContainers.find((cached) => cached.id === viewContainerWorkspaceState.id);
        if (cachedViewContainer) {
          cachedViewContainer.visible = viewContainerWorkspaceState.visible ?? cachedViewContainer.visible;
        }
      }
    }
    return this._cachedViewContainers;
  }
  storeCachedViewContainersState(cachedViewContainers) {
    // Always keep Logic (plcEditor) in the activity bar
    if (this.options.pinnedViewContainersKey === "workbench.activity.pinnedViewlets2") {
      if (!cachedViewContainers.some((v) => v.id === "workbench.view.plcEditor")) {
        cachedViewContainers = [...cachedViewContainers, {
          id: "workbench.view.plcEditor", name: "Logic", pinned: true, order: 7, visible: true, isBuiltin: true, views: [{}]
        }];
        cachedViewContainers.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      }
    }
    const pinnedViewContainers = this.getPinnedViewContainers();
    this.setPinnedViewContainers(cachedViewContainers.map(({ id, pinned, order }) => ({
      id,
      pinned,
      visible: Boolean(pinnedViewContainers.find(({ id: pinnedId }) => pinnedId === id)?.visible),
      order
    })));
    this.setPlaceholderViewContainers(cachedViewContainers.map(({ id, icon, name, views, isBuiltin }) => ({
      id,
      iconUrl: URI.isUri(icon) ? icon : void 0,
      themeIcon: ThemeIcon.isThemeIcon(icon) ? icon : void 0,
      name,
      isBuiltin,
      views
    })));
    this.setViewContainersWorkspaceState(cachedViewContainers.map(({ id, visible }) => ({
      id,
      visible
    })));
  }
  getPinnedViewContainers() {
    return JSON.parse(this.pinnedViewContainersValue);
  }
  setPinnedViewContainers(pinnedViewContainers) {
    const filtered = pinnedViewContainers.filter((v) => !PaneCompositeBar._plaxioHiddenViewContainers.has(v.id));
    this.pinnedViewContainersValue = JSON.stringify(filtered);
  }
  get pinnedViewContainersValue() {
    if (!this._pinnedViewContainersValue) {
      this._pinnedViewContainersValue = this.getStoredPinnedViewContainersValue();
    }
    return this._pinnedViewContainersValue;
  }
  set pinnedViewContainersValue(pinnedViewContainersValue) {
    if (this.pinnedViewContainersValue !== pinnedViewContainersValue) {
      this._pinnedViewContainersValue = pinnedViewContainersValue;
      this.setStoredPinnedViewContainersValue(pinnedViewContainersValue);
    }
  }
  getStoredPinnedViewContainersValue() {
    const raw = this.storageService.get(this.options.pinnedViewContainersKey, StorageScope.PROFILE, "[]");
    try {
      let parsed = JSON.parse(raw);
      const filtered = parsed.filter((v) => !PaneCompositeBar._plaxioHiddenViewContainers.has(v.id));
      // Always ensure the Logic (plcEditor) tab is pinned in the activity bar
      if (this.options.pinnedViewContainersKey === "workbench.activity.pinnedViewlets2") {
        const hasLogic = filtered.some((v) => v.id === "workbench.view.plcEditor");
        if (!hasLogic) {
          filtered.push({ id: "workbench.view.plcEditor", pinned: true, visible: false, order: 7 });
          filtered.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
        }
      }
      return JSON.stringify(filtered);
    } catch {
      return raw;
    }
  }
  setStoredPinnedViewContainersValue(value) {
    this.storageService.store(this.options.pinnedViewContainersKey, value, StorageScope.PROFILE, StorageTarget.USER);
  }
  getPlaceholderViewContainers() {
    return JSON.parse(this.placeholderViewContainersValue);
  }
  setPlaceholderViewContainers(placeholderViewContainers) {
    const filtered = placeholderViewContainers.filter((v) => !PaneCompositeBar._plaxioHiddenViewContainers.has(v.id));
    this.placeholderViewContainersValue = JSON.stringify(filtered);
  }
  get placeholderViewContainersValue() {
    if (!this._placeholderViewContainersValue) {
      this._placeholderViewContainersValue = this.getStoredPlaceholderViewContainersValue();
    }
    return this._placeholderViewContainersValue;
  }
  set placeholderViewContainersValue(placeholderViewContainesValue) {
    if (this.placeholderViewContainersValue !== placeholderViewContainesValue) {
      this._placeholderViewContainersValue = placeholderViewContainesValue;
      this.setStoredPlaceholderViewContainersValue(placeholderViewContainesValue);
    }
  }
  getStoredPlaceholderViewContainersValue() {
    return this.storageService.get(this.options.placeholderViewContainersKey, StorageScope.PROFILE, "[]");
  }
  setStoredPlaceholderViewContainersValue(value) {
    this.storageService.store(this.options.placeholderViewContainersKey, value, StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  getViewContainersWorkspaceState() {
    return JSON.parse(this.viewContainersWorkspaceStateValue);
  }
  setViewContainersWorkspaceState(viewContainersWorkspaceState) {
    this.viewContainersWorkspaceStateValue = JSON.stringify(viewContainersWorkspaceState);
  }
  get viewContainersWorkspaceStateValue() {
    if (!this._viewContainersWorkspaceStateValue) {
      this._viewContainersWorkspaceStateValue = this.getStoredViewContainersWorkspaceStateValue();
    }
    return this._viewContainersWorkspaceStateValue;
  }
  set viewContainersWorkspaceStateValue(viewContainersWorkspaceStateValue) {
    if (this.viewContainersWorkspaceStateValue !== viewContainersWorkspaceStateValue) {
      this._viewContainersWorkspaceStateValue = viewContainersWorkspaceStateValue;
      this.setStoredViewContainersWorkspaceStateValue(viewContainersWorkspaceStateValue);
    }
  }
  getStoredViewContainersWorkspaceStateValue() {
    return this.storageService.get(this.options.viewContainersWorkspaceStateKey, StorageScope.WORKSPACE, "[]");
  }
  setStoredViewContainersWorkspaceStateValue(value) {
    this.storageService.store(this.options.viewContainersWorkspaceStateKey, value, StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
};
PaneCompositeBar._plaxioHiddenViewContainers = /* @__PURE__ */ new Set([
  "workbench.view.debug",
  "workbench.view.remote",
  "workbench.view.extension.test",
  "workbench.view.extension.references-view",
  "workbench.view.extensions"
]);
PaneCompositeBar = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, IViewDescriptorService),
  __decorateParam(7, IViewsService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IWorkbenchEnvironmentService),
  __decorateParam(10, IWorkbenchLayoutService)
], PaneCompositeBar);
let ViewContainerActivityAction = class extends CompositeBarAction {
  constructor(compositeBarActionItem, part, paneCompositePart, layoutService, configurationService, activityService) {
    super(compositeBarActionItem);
    this.part = part;
    this.paneCompositePart = paneCompositePart;
    this.layoutService = layoutService;
    this.configurationService = configurationService;
    this.activityService = activityService;
    this.lastRun = 0;
    this.updateActivity();
    this._register(this.activityService.onDidChangeActivity((viewContainerOrAction) => {
      if (!isString(viewContainerOrAction) && viewContainerOrAction.id === this.compositeBarActionItem.id) {
        this.updateActivity();
      }
    }));
  }
  updateCompositeBarActionItem(compositeBarActionItem) {
    this.compositeBarActionItem = compositeBarActionItem;
  }
  updateActivity() {
    this.activities = this.activityService.getViewContainerActivities(this.compositeBarActionItem.id);
  }
  async run(event) {
    if (isMouseEvent(event) && event.button === 2) {
      return;
    }
    const now = Date.now();
    if (now > this.lastRun && now - this.lastRun < ViewContainerActivityAction.preventDoubleClickDelay) {
      return;
    }
    this.lastRun = now;
    const focus = event && "preserveFocus" in event ? !event.preserveFocus : true;
    if (this.part === Parts.ACTIVITYBAR_PART) {
      const sideBarVisible = this.layoutService.isVisible(Parts.SIDEBAR_PART);
      const activeViewlet = this.paneCompositePart.getActivePaneComposite();
      const focusBehavior = this.configurationService.getValue("workbench.activityBar.iconClickBehavior");
      if (sideBarVisible && activeViewlet?.getId() === this.compositeBarActionItem.id) {
        switch (focusBehavior) {
          case "focus":
            this.paneCompositePart.openPaneComposite(this.compositeBarActionItem.id, focus);
            break;
          case "toggle":
          default:
            this.layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
            break;
        }
        return;
      }
    }
    await this.paneCompositePart.openPaneComposite(this.compositeBarActionItem.id, focus);
    return this.activate();
  }
};
ViewContainerActivityAction.preventDoubleClickDelay = 300;
ViewContainerActivityAction = __decorateClass([
  __decorateParam(3, IWorkbenchLayoutService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IActivityService)
], ViewContainerActivityAction);
class PlaceHolderViewContainerActivityAction extends ViewContainerActivityAction {
}
class PlaceHolderToggleCompositePinnedAction extends ToggleCompositePinnedAction {
  constructor(id, compositeBar) {
    super({ id, name: id, classNames: void 0 }, compositeBar);
  }
  setActivity(activity) {
    this.label = activity.name;
  }
}
class PlaceHolderToggleCompositeBadgeAction extends ToggleCompositeBadgeAction {
  constructor(id, compositeBar) {
    super({ id, name: id, classNames: void 0 }, compositeBar);
  }
  setCompositeBarActionItem(actionItem) {
    this.label = actionItem.name;
  }
}
export {
  PaneCompositeBar
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9wYW5lQ29tcG9zaXRlQmFyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uc09yaWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2FjdGl2aXR5L2NvbW1vbi9hY3Rpdml0eS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgUGFydHMgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZU1hcCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ29sb3JUaGVtZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29tcG9zaXRlQmFyLCBJQ29tcG9zaXRlQmFySXRlbSwgQ29tcG9zaXRlRHJhZ0FuZERyb3AgfSBmcm9tICcuL2NvbXBvc2l0ZUJhci5qcyc7XG5pbXBvcnQgeyBEaW1lbnNpb24sIGlzTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgY3JlYXRlQ1NTUnVsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgeyBhc0NTU1VybCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jc3NWYWx1ZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBUb2dnbGVDb21wb3NpdGVQaW5uZWRBY3Rpb24sIElDb21wb3NpdGVCYXJDb2xvcnMsIElBY3Rpdml0eUhvdmVyT3B0aW9ucywgVG9nZ2xlQ29tcG9zaXRlQmFkZ2VBY3Rpb24sIENvbXBvc2l0ZUJhckFjdGlvbiwgSUNvbXBvc2l0ZUJhciwgSUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0gfSBmcm9tICcuL2NvbXBvc2l0ZUJhckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgVmlld0NvbnRhaW5lciwgSVZpZXdDb250YWluZXJNb2RlbCwgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSwgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNOYXRpdmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBCZWZvcmUyRCwgSUNvbXBvc2l0ZURyYWdBbmREcm9wIH0gZnJvbSAnLi4vZG5kLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBTZXBhcmF0b3IsIFN1Ym1lbnVBY3Rpb24sIHRvQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBTdHJpbmdTSEExIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBHZXN0dXJlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdG91Y2guanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0IH0gZnJvbSAnLi9wYW5lQ29tcG9zaXRlUGFydC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcblxuaW50ZXJmYWNlIElQbGFjZWhvbGRlclZpZXdDb250YWluZXIge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRyZWFkb25seSBuYW1lPzogc3RyaW5nO1xuXHRyZWFkb25seSBpY29uVXJsPzogVXJpQ29tcG9uZW50cztcblx0cmVhZG9ubHkgdGhlbWVJY29uPzogVGhlbWVJY29uO1xuXHRyZWFkb25seSBpc0J1aWx0aW4/OiBib29sZWFuO1xuXHRyZWFkb25seSB2aWV3cz86IHsgd2hlbj86IHN0cmluZyB9W107XG5cdC8vIFRPRE8gQHNhbmR5MDgxOiBSZW1vdmUgdGhpcyBhZnRlciBhIHdoaWxlLiBNaWdyYXRlZCB0byB2aXNpYmxlIGluIElWaWV3Q29udGFpbmVyV29ya3NwYWNlU3RhdGVcblx0cmVhZG9ubHkgdmlzaWJsZT86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJUGlubmVkVmlld0NvbnRhaW5lciB7XG5cdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHBpbm5lZDogYm9vbGVhbjtcblx0cmVhZG9ubHkgb3JkZXI/OiBudW1iZXI7XG5cdC8vIFRPRE8gQHNhbmR5MDgxOiBSZW1vdmUgdGhpcyBhZnRlciBhIHdoaWxlLiBNaWdyYXRlZCB0byB2aXNpYmxlIGluIElWaWV3Q29udGFpbmVyV29ya3NwYWNlU3RhdGVcblx0cmVhZG9ubHkgdmlzaWJsZTogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIElWaWV3Q29udGFpbmVyV29ya3NwYWNlU3RhdGUge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRyZWFkb25seSB2aXNpYmxlOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSUNhY2hlZFZpZXdDb250YWluZXIge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRuYW1lPzogc3RyaW5nO1xuXHRpY29uPzogVVJJIHwgVGhlbWVJY29uO1xuXHRyZWFkb25seSBwaW5uZWQ6IGJvb2xlYW47XG5cdHJlYWRvbmx5IG9yZGVyPzogbnVtYmVyO1xuXHR2aXNpYmxlOiBib29sZWFuO1xuXHRpc0J1aWx0aW4/OiBib29sZWFuO1xuXHR2aWV3cz86IHsgd2hlbj86IHN0cmluZyB9W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBhbmVDb21wb3NpdGVCYXJPcHRpb25zIHtcblx0cmVhZG9ubHkgcGFydENvbnRhaW5lckNsYXNzOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHBpbm5lZFZpZXdDb250YWluZXJzS2V5OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHBsYWNlaG9sZGVyVmlld0NvbnRhaW5lcnNLZXk6IHN0cmluZztcblx0cmVhZG9ubHkgdmlld0NvbnRhaW5lcnNXb3Jrc3BhY2VTdGF0ZUtleTogc3RyaW5nO1xuXHRyZWFkb25seSBpY29uOiBib29sZWFuO1xuXHRyZWFkb25seSBjb21wYWN0PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgaWNvblNpemU6IG51bWJlcjtcblx0cmVhZG9ubHkgcmVjb21wdXRlU2l6ZXM6IGJvb2xlYW47XG5cdHJlYWRvbmx5IG9yaWVudGF0aW9uOiBBY3Rpb25zT3JpZW50YXRpb247XG5cdHJlYWRvbmx5IGNvbXBvc2l0ZVNpemU6IG51bWJlcjtcblx0cmVhZG9ubHkgb3ZlcmZsb3dBY3Rpb25TaXplOiBudW1iZXI7XG5cdHJlYWRvbmx5IHByZXZlbnRMb29wTmF2aWdhdGlvbj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGFjdGl2aXR5SG92ZXJPcHRpb25zOiBJQWN0aXZpdHlIb3Zlck9wdGlvbnM7XG5cdHJlYWRvbmx5IGZpbGxFeHRyYUNvbnRleHRNZW51QWN0aW9uczogKGFjdGlvbnM6IElBY3Rpb25bXSwgZT86IE1vdXNlRXZlbnQgfCBHZXN0dXJlRXZlbnQpID0+IHZvaWQ7XG5cdHJlYWRvbmx5IGNvbG9yczogKHRoZW1lOiBJQ29sb3JUaGVtZSkgPT4gSUNvbXBvc2l0ZUJhckNvbG9ycztcbn1cblxuZXhwb3J0IGNsYXNzIFBhbmVDb21wb3NpdGVCYXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdDb250YWluZXJEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPHN0cmluZywgSURpc3Bvc2FibGU+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb247XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb21wb3NpdGVCYXI6IENvbXBvc2l0ZUJhcjtcblx0cmVhZG9ubHkgZG5kSGFuZGxlcjogSUNvbXBvc2l0ZURyYWdBbmREcm9wO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbXBvc2l0ZUFjdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgeyBhY3Rpdml0eUFjdGlvbjogVmlld0NvbnRhaW5lckFjdGl2aXR5QWN0aW9uOyBwaW5uZWRBY3Rpb246IFRvZ2dsZUNvbXBvc2l0ZVBpbm5lZEFjdGlvbjsgYmFkZ2VBY3Rpb246IFRvZ2dsZUNvbXBvc2l0ZUJhZGdlQWN0aW9uIH0+KCk7XG5cblx0cHJpdmF0ZSBoYXNFeHRlbnNpb25zUmVnaXN0ZXJlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBvcHRpb25zOiBJUGFuZUNvbXBvc2l0ZUJhck9wdGlvbnMsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHBhcnQ6IFBhcnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcGFuZUNvbXBvc2l0ZVBhcnQ6IElQYW5lQ29tcG9zaXRlUGFydCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJVmlld3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdmlld1NlcnZpY2U6IElWaWV3c1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMubG9jYXRpb24gPSBwYW5lQ29tcG9zaXRlUGFydC5wYXJ0SWQgPT09IFBhcnRzLlBBTkVMX1BBUlRcblx0XHRcdD8gVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsIDogcGFuZUNvbXBvc2l0ZVBhcnQucGFydElkID09PSBQYXJ0cy5BVVhJTElBUllCQVJfUEFSVFxuXHRcdFx0XHQ/IFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIgOiBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcjtcblxuXHRcdHRoaXMuZG5kSGFuZGxlciA9IG5ldyBDb21wb3NpdGVEcmFnQW5kRHJvcCh0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZSwgdGhpcy5sb2NhdGlvbiwgdGhpcy5vcHRpb25zLm9yaWVudGF0aW9uLFxuXHRcdFx0YXN5bmMgKGlkOiBzdHJpbmcsIGZvY3VzPzogYm9vbGVhbikgPT4geyByZXR1cm4gYXdhaXQgdGhpcy5wYW5lQ29tcG9zaXRlUGFydC5vcGVuUGFuZUNvbXBvc2l0ZShpZCwgZm9jdXMpID8/IG51bGw7IH0sXG5cdFx0XHQoZnJvbTogc3RyaW5nLCB0bzogc3RyaW5nLCBiZWZvcmU/OiBCZWZvcmUyRCkgPT4gdGhpcy5jb21wb3NpdGVCYXIubW92ZShmcm9tLCB0bywgdGhpcy5vcHRpb25zLm9yaWVudGF0aW9uID09PSBBY3Rpb25zT3JpZW50YXRpb24uVkVSVElDQUwgPyBiZWZvcmU/LnZlcnRpY2FsbHlCZWZvcmUgOiBiZWZvcmU/Lmhvcml6b250YWxseUJlZm9yZSksXG5cdFx0XHQoKSA9PiB0aGlzLmNvbXBvc2l0ZUJhci5nZXRDb21wb3NpdGVCYXJJdGVtcygpLFxuXHRcdCk7XG5cblx0XHRjb25zdCBjYWNoZWRJdGVtcyA9IHRoaXMuY2FjaGVkVmlld0NvbnRhaW5lcnNcblx0XHRcdC5tYXAoY29udGFpbmVyID0+ICh7XG5cdFx0XHRcdGlkOiBjb250YWluZXIuaWQsXG5cdFx0XHRcdG5hbWU6IGNvbnRhaW5lci5uYW1lLFxuXHRcdFx0XHR2aXNpYmxlOiAhdGhpcy5zaG91bGRCZUhpZGRlbihjb250YWluZXIuaWQsIGNvbnRhaW5lciksXG5cdFx0XHRcdG9yZGVyOiBjb250YWluZXIub3JkZXIsXG5cdFx0XHRcdHBpbm5lZDogY29udGFpbmVyLnBpbm5lZCxcblx0XHRcdH0pKTtcblx0XHR0aGlzLmNvbXBvc2l0ZUJhciA9IHRoaXMuY3JlYXRlQ29tcG9zaXRlQmFyKGNhY2hlZEl0ZW1zKTtcblx0XHR0aGlzLm9uRGlkUmVnaXN0ZXJWaWV3Q29udGFpbmVycyh0aGlzLmdldFZpZXdDb250YWluZXJzKCkpO1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQ29tcG9zaXRlQmFyKGNhY2hlZEl0ZW1zOiBJQ29tcG9zaXRlQmFySXRlbVtdKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29tcG9zaXRlQmFyLCBjYWNoZWRJdGVtcywge1xuXHRcdFx0aWNvbjogdGhpcy5vcHRpb25zLmljb24sXG5cdFx0XHRjb21wYWN0OiB0aGlzLm9wdGlvbnMuY29tcGFjdCxcblx0XHRcdG9yaWVudGF0aW9uOiB0aGlzLm9wdGlvbnMub3JpZW50YXRpb24sXG5cdFx0XHRhY3Rpdml0eUhvdmVyT3B0aW9uczogdGhpcy5vcHRpb25zLmFjdGl2aXR5SG92ZXJPcHRpb25zLFxuXHRcdFx0cHJldmVudExvb3BOYXZpZ2F0aW9uOiB0aGlzLm9wdGlvbnMucHJldmVudExvb3BOYXZpZ2F0aW9uLFxuXHRcdFx0b3BlbkNvbXBvc2l0ZTogYXN5bmMgKGNvbXBvc2l0ZUlkLCBwcmVzZXJ2ZUZvY3VzKSA9PiB7XG5cdFx0XHRcdHJldHVybiAoYXdhaXQgdGhpcy5wYW5lQ29tcG9zaXRlUGFydC5vcGVuUGFuZUNvbXBvc2l0ZShjb21wb3NpdGVJZCwgIXByZXNlcnZlRm9jdXMpKSA/PyBudWxsO1xuXHRcdFx0fSxcblx0XHRcdGdldEFjdGl2aXR5QWN0aW9uOiBjb21wb3NpdGVJZCA9PiB0aGlzLmdldENvbXBvc2l0ZUFjdGlvbnMoY29tcG9zaXRlSWQpLmFjdGl2aXR5QWN0aW9uLFxuXHRcdFx0Z2V0Q29tcG9zaXRlUGlubmVkQWN0aW9uOiBjb21wb3NpdGVJZCA9PiB0aGlzLmdldENvbXBvc2l0ZUFjdGlvbnMoY29tcG9zaXRlSWQpLnBpbm5lZEFjdGlvbixcblx0XHRcdGdldENvbXBvc2l0ZUJhZGdlQWN0aW9uOiBjb21wb3NpdGVJZCA9PiB0aGlzLmdldENvbXBvc2l0ZUFjdGlvbnMoY29tcG9zaXRlSWQpLmJhZGdlQWN0aW9uLFxuXHRcdFx0Z2V0T25Db21wb3NpdGVDbGlja0FjdGlvbjogY29tcG9zaXRlSWQgPT4gdGhpcy5nZXRDb21wb3NpdGVBY3Rpb25zKGNvbXBvc2l0ZUlkKS5hY3Rpdml0eUFjdGlvbixcblx0XHRcdGZpbGxFeHRyYUNvbnRleHRNZW51QWN0aW9uczogKGFjdGlvbnMsIGUpID0+IHRoaXMub3B0aW9ucy5maWxsRXh0cmFDb250ZXh0TWVudUFjdGlvbnMoYWN0aW9ucywgZSksXG5cdFx0XHRnZXRDb250ZXh0TWVudUFjdGlvbnNGb3JDb21wb3NpdGU6IGNvbXBvc2l0ZUlkID0+IHRoaXMuZ2V0Q29udGV4dE1lbnVBY3Rpb25zRm9yQ29tcG9zaXRlKGNvbXBvc2l0ZUlkKSxcblx0XHRcdGdldERlZmF1bHRDb21wb3NpdGVJZDogKCkgPT4gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIodGhpcy5sb2NhdGlvbik/LmlkLFxuXHRcdFx0ZG5kSGFuZGxlcjogdGhpcy5kbmRIYW5kbGVyLFxuXHRcdFx0Y29tcG9zaXRlU2l6ZTogdGhpcy5vcHRpb25zLmNvbXBvc2l0ZVNpemUsXG5cdFx0XHRvdmVyZmxvd0FjdGlvblNpemU6IHRoaXMub3B0aW9ucy5vdmVyZmxvd0FjdGlvblNpemUsXG5cdFx0XHRjb2xvcnM6IHRoZW1lID0+IHRoaXMub3B0aW9ucy5jb2xvcnModGhlbWUpLFxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29udGV4dE1lbnVBY3Rpb25zRm9yQ29tcG9zaXRlKGNvbXBvc2l0ZUlkOiBzdHJpbmcpOiBJQWN0aW9uW10ge1xuXHRcdGNvbnN0IGFjdGlvbnM6IElBY3Rpb25bXSA9IFtuZXcgU2VwYXJhdG9yKCldO1xuXG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKGNvbXBvc2l0ZUlkKSE7XG5cdFx0Y29uc3QgZGVmYXVsdExvY2F0aW9uID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKSE7XG5cdFx0Y29uc3QgY3VycmVudExvY2F0aW9uID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIpO1xuXG5cdFx0Ly8gTW92ZSBWaWV3IENvbnRhaW5lclxuXHRcdGNvbnN0IG1vdmVBY3Rpb25zID0gW107XG5cdFx0Zm9yIChjb25zdCBsb2NhdGlvbiBvZiBbVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIsIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbF0pIHtcblx0XHRcdGlmIChjdXJyZW50TG9jYXRpb24gIT09IGxvY2F0aW9uKSB7XG5cdFx0XHRcdG1vdmVBY3Rpb25zLnB1c2godGhpcy5jcmVhdGVNb3ZlQWN0aW9uKHZpZXdDb250YWluZXIsIGxvY2F0aW9uLCBkZWZhdWx0TG9jYXRpb24pKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRhY3Rpb25zLnB1c2gobmV3IFN1Ym1lbnVBY3Rpb24oJ21vdmVUb01lbnUnLCBsb2NhbGl6ZSgnbW92ZVRvTWVudScsIFwiTW92ZSBUb1wiKSwgbW92ZUFjdGlvbnMpKTtcblxuXHRcdC8vIFJlc2V0IExvY2F0aW9uXG5cdFx0aWYgKGRlZmF1bHRMb2NhdGlvbiAhPT0gY3VycmVudExvY2F0aW9uKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2godG9BY3Rpb24oe1xuXHRcdFx0XHRpZDogJ3Jlc2V0TG9jYXRpb25BY3Rpb24nLCBsYWJlbDogbG9jYWxpemUoJ3Jlc2V0TG9jYXRpb24nLCBcIlJlc2V0IExvY2F0aW9uXCIpLCBydW46ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5tb3ZlVmlld0NvbnRhaW5lclRvTG9jYXRpb24odmlld0NvbnRhaW5lciwgZGVmYXVsdExvY2F0aW9uLCB1bmRlZmluZWQsICdyZXNldExvY2F0aW9uQWN0aW9uJyk7XG5cdFx0XHRcdFx0dGhpcy52aWV3U2VydmljZS5vcGVuVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyLmlkLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyTW9kZWwgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lcik7XG5cdFx0XHRpZiAodmlld0NvbnRhaW5lck1vZGVsLmFsbFZpZXdEZXNjcmlwdG9ycy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0Y29uc3Qgdmlld1RvUmVzZXQgPSB2aWV3Q29udGFpbmVyTW9kZWwuYWxsVmlld0Rlc2NyaXB0b3JzWzBdO1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdENvbnRhaW5lckJ5SWQodmlld1RvUmVzZXQuaWQpITtcblx0XHRcdFx0aWYgKGRlZmF1bHRDb250YWluZXIgIT09IHZpZXdDb250YWluZXIpIHtcblx0XHRcdFx0XHRhY3Rpb25zLnB1c2godG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0aWQ6ICdyZXNldExvY2F0aW9uQWN0aW9uJywgbGFiZWw6IGxvY2FsaXplKCdyZXNldExvY2F0aW9uJywgXCJSZXNldCBMb2NhdGlvblwiKSwgcnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3c1RvQ29udGFpbmVyKFt2aWV3VG9SZXNldF0sIGRlZmF1bHRDb250YWluZXIsIHVuZGVmaW5lZCwgJ3Jlc2V0TG9jYXRpb25BY3Rpb24nKTtcblx0XHRcdFx0XHRcdFx0dGhpcy52aWV3U2VydmljZS5vcGVuVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyLmlkLCB0cnVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gYWN0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlTW92ZUFjdGlvbih2aWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyLCBuZXdMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uLCBkZWZhdWx0TG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IElBY3Rpb24ge1xuXHRcdHJldHVybiB0b0FjdGlvbih7XG5cdFx0XHRpZDogYG1vdmVWaWV3Q29udGFpbmVyVG8ke25ld0xvY2F0aW9ufWAsXG5cdFx0XHRsYWJlbDogbmV3TG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCA/IGxvY2FsaXplKCdwYW5lbCcsIFwiUGFuZWxcIikgOiBuZXdMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIgPyBsb2NhbGl6ZSgnc2lkZWJhcicsIFwiUHJpbWFyeSBTaWRlIEJhclwiKSA6IGxvY2FsaXplKCdhdXhpbGlhcnliYXInLCBcIlZvaWQgU2lkZSBCYXJcIiksXG5cdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0bGV0IGluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChuZXdMb2NhdGlvbiAhPT0gZGVmYXVsdExvY2F0aW9uKSB7XG5cdFx0XHRcdFx0aW5kZXggPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyc0J5TG9jYXRpb24obmV3TG9jYXRpb24pLmxlbmd0aDsgLy8gbW92ZSB0byB0aGUgZW5kIG9mIHRoZSBsb2NhdGlvblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGluZGV4ID0gdW5kZWZpbmVkOyAvLyByZXN0b3JlIGRlZmF1bHQgbG9jYXRpb25cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5tb3ZlVmlld0NvbnRhaW5lclRvTG9jYXRpb24odmlld0NvbnRhaW5lciwgbmV3TG9jYXRpb24sIGluZGV4KTtcblx0XHRcdFx0dGhpcy52aWV3U2VydmljZS5vcGVuVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyLmlkLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0Ly8gVmlldyBDb250YWluZXIgQ2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lcnMoKHsgYWRkZWQsIHJlbW92ZWQgfSkgPT4gdGhpcy5vbkRpZENoYW5nZVZpZXdDb250YWluZXJzKGFkZGVkLCByZW1vdmVkKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGFpbmVyTG9jYXRpb24oKHsgdmlld0NvbnRhaW5lciwgZnJvbSwgdG8gfSkgPT4gdGhpcy5vbkRpZENoYW5nZVZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyLCBmcm9tLCB0bykpKTtcblxuXHRcdC8vIFZpZXcgQ29udGFpbmVyIFZpc2liaWxpdHkgQ2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucGFuZUNvbXBvc2l0ZVBhcnQub25EaWRQYW5lQ29tcG9zaXRlT3BlbihlID0+IHRoaXMub25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eShlLmdldElkKCksIHRydWUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5wYW5lQ29tcG9zaXRlUGFydC5vbkRpZFBhbmVDb21wb3NpdGVDbG9zZShlID0+IHRoaXMub25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eShlLmdldElkKCksIGZhbHNlKSkpO1xuXG5cdFx0Ly8gRXh0ZW5zaW9uIHJlZ2lzdHJhdGlvblxuXHRcdHRoaXMuZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKS50aGVuKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMub25EaWRSZWdpc3RlckV4dGVuc2lvbnMoKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29tcG9zaXRlQmFyLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdFx0dGhpcy51cGRhdGVDb21wb3NpdGVCYXJJdGVtc0Zyb21TdG9yYWdlKHRydWUpO1xuXHRcdFx0XHR0aGlzLnNhdmVDYWNoZWRWaWV3Q29udGFpbmVycygpO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zdG9yYWdlU2VydmljZS5vbkRpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCB0aGlzLm9wdGlvbnMucGlubmVkVmlld0NvbnRhaW5lcnNLZXksIHRoaXMuX3N0b3JlKSgoKSA9PiB0aGlzLnVwZGF0ZUNvbXBvc2l0ZUJhckl0ZW1zRnJvbVN0b3JhZ2UoZmFsc2UpKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lcnMoYWRkZWQ6IHJlYWRvbmx5IHsgY29udGFpbmVyOiBWaWV3Q29udGFpbmVyOyBsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uIH1bXSwgcmVtb3ZlZDogcmVhZG9ubHkgeyBjb250YWluZXI6IFZpZXdDb250YWluZXI7IGxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24gfVtdKSB7XG5cdFx0cmVtb3ZlZC5maWx0ZXIoKHsgbG9jYXRpb24gfSkgPT4gbG9jYXRpb24gPT09IHRoaXMubG9jYXRpb24pLmZvckVhY2goKHsgY29udGFpbmVyIH0pID0+IHRoaXMub25EaWREZXJlZ2lzdGVyVmlld0NvbnRhaW5lcihjb250YWluZXIpKTtcblx0XHR0aGlzLm9uRGlkUmVnaXN0ZXJWaWV3Q29udGFpbmVycyhhZGRlZC5maWx0ZXIoKHsgbG9jYXRpb24gfSkgPT4gbG9jYXRpb24gPT09IHRoaXMubG9jYXRpb24pLm1hcCgoeyBjb250YWluZXIgfSkgPT4gY29udGFpbmVyKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lckxvY2F0aW9uKGNvbnRhaW5lcjogVmlld0NvbnRhaW5lciwgZnJvbTogVmlld0NvbnRhaW5lckxvY2F0aW9uLCB0bzogVmlld0NvbnRhaW5lckxvY2F0aW9uKSB7XG5cdFx0aWYgKGZyb20gPT09IHRoaXMubG9jYXRpb24pIHtcblx0XHRcdHRoaXMub25EaWREZXJlZ2lzdGVyVmlld0NvbnRhaW5lcihjb250YWluZXIpO1xuXHRcdH1cblxuXHRcdGlmICh0byA9PT0gdGhpcy5sb2NhdGlvbikge1xuXHRcdFx0dGhpcy5vbkRpZFJlZ2lzdGVyVmlld0NvbnRhaW5lcnMoW2NvbnRhaW5lcl0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eShpZDogc3RyaW5nLCB2aXNpYmxlOiBib29sZWFuKSB7XG5cdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdC8vIEFjdGl2YXRlIHZpZXcgY29udGFpbmVyIGFjdGlvbiBvbiBvcGVuaW5nIG9mIGEgdmlldyBjb250YWluZXJcblx0XHRcdHRoaXMub25EaWRWaWV3Q29udGFpbmVyVmlzaWJsZShpZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIERlYWN0aXZhdGUgdmlldyBjb250YWluZXIgYWN0aW9uIG9uIGNsb3NlXG5cdFx0XHR0aGlzLmNvbXBvc2l0ZUJhci5kZWFjdGl2YXRlQ29tcG9zaXRlKGlkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkUmVnaXN0ZXJFeHRlbnNpb25zKCk6IHZvaWQge1xuXHRcdHRoaXMuaGFzRXh0ZW5zaW9uc1JlZ2lzdGVyZWQgPSB0cnVlO1xuXG5cdFx0Ly8gc2hvdy9oaWRlL3JlbW92ZSBjb21wb3NpdGVzXG5cdFx0Zm9yIChjb25zdCB7IGlkIH0gb2YgdGhpcy5jYWNoZWRWaWV3Q29udGFpbmVycykge1xuXHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMuZ2V0Vmlld0NvbnRhaW5lcihpZCk7XG5cdFx0XHRpZiAodmlld0NvbnRhaW5lcikge1xuXHRcdFx0XHR0aGlzLnNob3dPckhpZGVWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmlzVmlld0NvbnRhaW5lclJlbW92ZWRQZXJtYW5lbnRseShpZCkpIHtcblx0XHRcdFx0XHR0aGlzLnJlbW92ZUNvbXBvc2l0ZShpZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5oaWRlQ29tcG9zaXRlKGlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuc2F2ZUNhY2hlZFZpZXdDb250YWluZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkVmlld0NvbnRhaW5lclZpc2libGUoaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdDb250YWluZXIgPSB0aGlzLmdldFZpZXdDb250YWluZXIoaWQpO1xuXHRcdGlmICh2aWV3Q29udGFpbmVyKSB7XG5cblx0XHRcdC8vIFVwZGF0ZSB0aGUgY29tcG9zaXRlIGJhciBieSBhZGRpbmdcblx0XHRcdHRoaXMuYWRkQ29tcG9zaXRlKHZpZXdDb250YWluZXIpO1xuXHRcdFx0dGhpcy5jb21wb3NpdGVCYXIuYWN0aXZhdGVDb21wb3NpdGUodmlld0NvbnRhaW5lci5pZCk7XG5cblx0XHRcdGlmICh0aGlzLnNob3VsZEJlSGlkZGVuKHZpZXdDb250YWluZXIpKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdDb250YWluZXJNb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbCh2aWV3Q29udGFpbmVyKTtcblx0XHRcdFx0aWYgKHZpZXdDb250YWluZXJNb2RlbC5hY3RpdmVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Ly8gVXBkYXRlIHRoZSBjb21wb3NpdGUgYmFyIGJ5IGhpZGluZ1xuXHRcdFx0XHRcdHRoaXMuaGlkZUNvbXBvc2l0ZSh2aWV3Q29udGFpbmVyLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGNyZWF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLmNvbXBvc2l0ZUJhci5jcmVhdGUocGFyZW50KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29tcG9zaXRlQWN0aW9ucyhjb21wb3NpdGVJZDogc3RyaW5nKTogeyBhY3Rpdml0eUFjdGlvbjogVmlld0NvbnRhaW5lckFjdGl2aXR5QWN0aW9uOyBwaW5uZWRBY3Rpb246IFRvZ2dsZUNvbXBvc2l0ZVBpbm5lZEFjdGlvbjsgYmFkZ2VBY3Rpb246IFRvZ2dsZUNvbXBvc2l0ZUJhZGdlQWN0aW9uIH0ge1xuXHRcdGxldCBjb21wb3NpdGVBY3Rpb25zID0gdGhpcy5jb21wb3NpdGVBY3Rpb25zLmdldChjb21wb3NpdGVJZCk7XG5cdFx0aWYgKCFjb21wb3NpdGVBY3Rpb25zKSB7XG5cdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy5nZXRWaWV3Q29udGFpbmVyKGNvbXBvc2l0ZUlkKTtcblx0XHRcdGlmICh2aWV3Q29udGFpbmVyKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdDb250YWluZXJNb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbCh2aWV3Q29udGFpbmVyKTtcblx0XHRcdFx0Y29tcG9zaXRlQWN0aW9ucyA9IHtcblx0XHRcdFx0XHRhY3Rpdml0eUFjdGlvbjogdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShWaWV3Q29udGFpbmVyQWN0aXZpdHlBY3Rpb24sIHRoaXMudG9Db21wb3NpdGVCYXJBY3Rpb25JdGVtRnJvbSh2aWV3Q29udGFpbmVyTW9kZWwpLCB0aGlzLnBhcnQsIHRoaXMucGFuZUNvbXBvc2l0ZVBhcnQpKSxcblx0XHRcdFx0XHRwaW5uZWRBY3Rpb246IHRoaXMuX3JlZ2lzdGVyKG5ldyBUb2dnbGVDb21wb3NpdGVQaW5uZWRBY3Rpb24odGhpcy50b0NvbXBvc2l0ZUJhckFjdGlvbkl0ZW1Gcm9tKHZpZXdDb250YWluZXJNb2RlbCksIHRoaXMuY29tcG9zaXRlQmFyKSksXG5cdFx0XHRcdFx0YmFkZ2VBY3Rpb246IHRoaXMuX3JlZ2lzdGVyKG5ldyBUb2dnbGVDb21wb3NpdGVCYWRnZUFjdGlvbih0aGlzLnRvQ29tcG9zaXRlQmFyQWN0aW9uSXRlbUZyb20odmlld0NvbnRhaW5lck1vZGVsKSwgdGhpcy5jb21wb3NpdGVCYXIpKVxuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgY2FjaGVkQ29tcG9zaXRlID0gdGhpcy5jYWNoZWRWaWV3Q29udGFpbmVycy5maWx0ZXIoYyA9PiBjLmlkID09PSBjb21wb3NpdGVJZClbMF07XG5cdFx0XHRcdGNvbXBvc2l0ZUFjdGlvbnMgPSB7XG5cdFx0XHRcdFx0YWN0aXZpdHlBY3Rpb246IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUGxhY2VIb2xkZXJWaWV3Q29udGFpbmVyQWN0aXZpdHlBY3Rpb24sIHRoaXMudG9Db21wb3NpdGVCYXJBY3Rpb25JdGVtKGNvbXBvc2l0ZUlkLCBjYWNoZWRDb21wb3NpdGU/Lm5hbWUgPz8gY29tcG9zaXRlSWQsIGNhY2hlZENvbXBvc2l0ZT8uaWNvbiwgdW5kZWZpbmVkKSwgdGhpcy5wYXJ0LCB0aGlzLnBhbmVDb21wb3NpdGVQYXJ0KSksXG5cdFx0XHRcdFx0cGlubmVkQWN0aW9uOiB0aGlzLl9yZWdpc3RlcihuZXcgUGxhY2VIb2xkZXJUb2dnbGVDb21wb3NpdGVQaW5uZWRBY3Rpb24oY29tcG9zaXRlSWQsIHRoaXMuY29tcG9zaXRlQmFyKSksXG5cdFx0XHRcdFx0YmFkZ2VBY3Rpb246IHRoaXMuX3JlZ2lzdGVyKG5ldyBQbGFjZUhvbGRlclRvZ2dsZUNvbXBvc2l0ZUJhZGdlQWN0aW9uKGNvbXBvc2l0ZUlkLCB0aGlzLmNvbXBvc2l0ZUJhcikpXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuY29tcG9zaXRlQWN0aW9ucy5zZXQoY29tcG9zaXRlSWQsIGNvbXBvc2l0ZUFjdGlvbnMpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb21wb3NpdGVBY3Rpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX3BsYXhpb0hpZGRlblZpZXdDb250YWluZXJzID0gbmV3IFNldChbXG5cdFx0J3dvcmtiZW5jaC52aWV3LmRlYnVnJywgJ3dvcmtiZW5jaC52aWV3LnJlbW90ZScsXG5cdFx0J3dvcmtiZW5jaC52aWV3LmV4dGVuc2lvbi50ZXN0JywgJ3dvcmtiZW5jaC52aWV3LmV4dGVuc2lvbi5yZWZlcmVuY2VzLXZpZXcnLFxuXHRdKTtcblxuXHRwcml2YXRlIG9uRGlkUmVnaXN0ZXJWaWV3Q29udGFpbmVycyh2aWV3Q29udGFpbmVyczogcmVhZG9ubHkgVmlld0NvbnRhaW5lcltdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCB2aWV3Q29udGFpbmVyIG9mIHZpZXdDb250YWluZXJzKSB7XG5cdFx0XHR0aGlzLmFkZENvbXBvc2l0ZSh2aWV3Q29udGFpbmVyKTtcblxuXHRcdFx0Y29uc3QgY2FjaGVkVmlld0NvbnRhaW5lciA9IHRoaXMuY2FjaGVkVmlld0NvbnRhaW5lcnMuZmlsdGVyKCh7IGlkIH0pID0+IGlkID09PSB2aWV3Q29udGFpbmVyLmlkKVswXTtcblx0XHRcdGlmIChQYW5lQ29tcG9zaXRlQmFyLl9wbGF4aW9IaWRkZW5WaWV3Q29udGFpbmVycy5oYXModmlld0NvbnRhaW5lci5pZCkpIHtcblx0XHRcdFx0dGhpcy5jb21wb3NpdGVCYXIudW5waW4odmlld0NvbnRhaW5lci5pZCk7XG5cdFx0XHRcdHRoaXMuaGlkZUNvbXBvc2l0ZSh2aWV3Q29udGFpbmVyLmlkKTtcblx0XHRcdH0gZWxzZSBpZiAoIWNhY2hlZFZpZXdDb250YWluZXIpIHtcblx0XHRcdFx0dGhpcy5jb21wb3NpdGVCYXIucGluKHZpZXdDb250YWluZXIuaWQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBBY3RpdmVcblx0XHRcdGNvbnN0IHZpc2libGVWaWV3Q29udGFpbmVyID0gdGhpcy5wYW5lQ29tcG9zaXRlUGFydC5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKCk7XG5cdFx0XHRpZiAodmlzaWJsZVZpZXdDb250YWluZXI/LmdldElkKCkgPT09IHZpZXdDb250YWluZXIuaWQpIHtcblx0XHRcdFx0dGhpcy5jb21wb3NpdGVCYXIuYWN0aXZhdGVDb21wb3NpdGUodmlld0NvbnRhaW5lci5pZCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHZpZXdDb250YWluZXJNb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbCh2aWV3Q29udGFpbmVyKTtcblx0XHRcdHRoaXMudXBkYXRlQ29tcG9zaXRlQmFyQWN0aW9uSXRlbSh2aWV3Q29udGFpbmVyLCB2aWV3Q29udGFpbmVyTW9kZWwpO1xuXHRcdFx0dGhpcy5zaG93T3JIaWRlVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyKTtcblxuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQodmlld0NvbnRhaW5lck1vZGVsLm9uRGlkQ2hhbmdlQ29udGFpbmVySW5mbygoKSA9PiB0aGlzLnVwZGF0ZUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0odmlld0NvbnRhaW5lciwgdmlld0NvbnRhaW5lck1vZGVsKSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHZpZXdDb250YWluZXJNb2RlbC5vbkRpZENoYW5nZUFjdGl2ZVZpZXdEZXNjcmlwdG9ycygoKSA9PiB0aGlzLnNob3dPckhpZGVWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXIpKSk7XG5cblx0XHRcdHRoaXMudmlld0NvbnRhaW5lckRpc3Bvc2FibGVzLnNldCh2aWV3Q29udGFpbmVyLmlkLCBkaXNwb3NhYmxlcyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZERlcmVnaXN0ZXJWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXdDb250YWluZXJEaXNwb3NhYmxlcy5kZWxldGVBbmREaXNwb3NlKHZpZXdDb250YWluZXIuaWQpO1xuXHRcdHRoaXMucmVtb3ZlQ29tcG9zaXRlKHZpZXdDb250YWluZXIuaWQpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDb21wb3NpdGVCYXJBY3Rpb25JdGVtKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIsIHZpZXdDb250YWluZXJNb2RlbDogSVZpZXdDb250YWluZXJNb2RlbCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0gPSB0aGlzLnRvQ29tcG9zaXRlQmFyQWN0aW9uSXRlbUZyb20odmlld0NvbnRhaW5lck1vZGVsKTtcblx0XHRjb25zdCB7IGFjdGl2aXR5QWN0aW9uLCBwaW5uZWRBY3Rpb24gfSA9IHRoaXMuZ2V0Q29tcG9zaXRlQWN0aW9ucyh2aWV3Q29udGFpbmVyLmlkKTtcblx0XHRhY3Rpdml0eUFjdGlvbi51cGRhdGVDb21wb3NpdGVCYXJBY3Rpb25JdGVtKGNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0pO1xuXG5cdFx0aWYgKHBpbm5lZEFjdGlvbiBpbnN0YW5jZW9mIFBsYWNlSG9sZGVyVG9nZ2xlQ29tcG9zaXRlUGlubmVkQWN0aW9uKSB7XG5cdFx0XHRwaW5uZWRBY3Rpb24uc2V0QWN0aXZpdHkoY29tcG9zaXRlQmFyQWN0aW9uSXRlbSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5yZWNvbXB1dGVTaXplcykge1xuXHRcdFx0dGhpcy5jb21wb3NpdGVCYXIucmVjb21wdXRlU2l6ZXMoKTtcblx0XHR9XG5cblx0XHR0aGlzLnNhdmVDYWNoZWRWaWV3Q29udGFpbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0NvbXBvc2l0ZUJhckFjdGlvbkl0ZW1Gcm9tKHZpZXdDb250YWluZXJNb2RlbDogSVZpZXdDb250YWluZXJNb2RlbCk6IElDb21wb3NpdGVCYXJBY3Rpb25JdGVtIHtcblx0XHRyZXR1cm4gdGhpcy50b0NvbXBvc2l0ZUJhckFjdGlvbkl0ZW0odmlld0NvbnRhaW5lck1vZGVsLnZpZXdDb250YWluZXIuaWQsIHZpZXdDb250YWluZXJNb2RlbC50aXRsZSwgdmlld0NvbnRhaW5lck1vZGVsLmljb24sIHZpZXdDb250YWluZXJNb2RlbC5rZXliaW5kaW5nSWQpO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0NvbXBvc2l0ZUJhckFjdGlvbkl0ZW0oaWQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCBpY29uOiBVUkkgfCBUaGVtZUljb24gfCB1bmRlZmluZWQsIGtleWJpbmRpbmdJZDogc3RyaW5nIHwgdW5kZWZpbmVkKTogSUNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0ge1xuXHRcdGxldCBjbGFzc05hbWVzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgaWNvblVybDogVVJJIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuaWNvbikge1xuXHRcdFx0aWYgKFVSSS5pc1VyaShpY29uKSkge1xuXHRcdFx0XHRpY29uVXJsID0gaWNvbjtcblx0XHRcdFx0Y29uc3QgY3NzVXJsID0gYXNDU1NVcmwoaWNvbik7XG5cdFx0XHRcdGNvbnN0IGhhc2ggPSBuZXcgU3RyaW5nU0hBMSgpO1xuXHRcdFx0XHRoYXNoLnVwZGF0ZShjc3NVcmwpO1xuXHRcdFx0XHRjb25zdCBpY29uSWQgPSBgYWN0aXZpdHktJHtpZC5yZXBsYWNlKC9cXC4vZywgJy0nKX0tJHtoYXNoLmRpZ2VzdCgpfWA7XG5cdFx0XHRcdGNvbnN0IGljb25DbGFzcyA9IGAubW9uYWNvLXdvcmtiZW5jaCAuJHt0aGlzLm9wdGlvbnMucGFydENvbnRhaW5lckNsYXNzfSAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1sYWJlbC4ke2ljb25JZH1gO1xuXHRcdFx0XHRjbGFzc05hbWVzID0gW2ljb25JZCwgJ3VyaS1pY29uJ107XG5cdFx0XHRcdGNyZWF0ZUNTU1J1bGUoaWNvbkNsYXNzLCBgXG5cdFx0XHRcdG1hc2s6ICR7Y3NzVXJsfSBuby1yZXBlYXQgNTAlIDUwJTtcblx0XHRcdFx0bWFzay1zaXplOiAke3RoaXMub3B0aW9ucy5pY29uU2l6ZX1weDtcblx0XHRcdFx0LXdlYmtpdC1tYXNrOiAke2Nzc1VybH0gbm8tcmVwZWF0IDUwJSA1MCU7XG5cdFx0XHRcdC13ZWJraXQtbWFzay1zaXplOiAke3RoaXMub3B0aW9ucy5pY29uU2l6ZX1weDtcblx0XHRcdFx0bWFzay1vcmlnaW46IHBhZGRpbmc7XG5cdFx0XHRcdC13ZWJraXQtbWFzay1vcmlnaW46IHBhZGRpbmc7XG5cdFx0XHRgKTtcblx0XHRcdH0gZWxzZSBpZiAoVGhlbWVJY29uLmlzVGhlbWVJY29uKGljb24pKSB7XG5cdFx0XHRcdGNsYXNzTmFtZXMgPSBUaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShpY29uKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBpZCwgbmFtZSwgY2xhc3NOYW1lcywgaWNvblVybCwga2V5YmluZGluZ0lkIH07XG5cdH1cblxuXHRwcml2YXRlIHNob3dPckhpZGVWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zaG91bGRCZUhpZGRlbih2aWV3Q29udGFpbmVyKSkge1xuXHRcdFx0dGhpcy5oaWRlQ29tcG9zaXRlKHZpZXdDb250YWluZXIuaWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmFkZENvbXBvc2l0ZSh2aWV3Q29udGFpbmVyKTtcblxuXHRcdFx0Ly8gQWN0aXZhdGUgaWYgdGhpcyBpcyB0aGUgYWN0aXZlIHBhbmUgY29tcG9zaXRlXG5cdFx0XHRjb25zdCBhY3RpdmVQYW5lQ29tcG9zaXRlID0gdGhpcy5wYW5lQ29tcG9zaXRlUGFydC5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKCk7XG5cdFx0XHRpZiAoYWN0aXZlUGFuZUNvbXBvc2l0ZT8uZ2V0SWQoKSA9PT0gdmlld0NvbnRhaW5lci5pZCkge1xuXHRcdFx0XHR0aGlzLmNvbXBvc2l0ZUJhci5hY3RpdmF0ZUNvbXBvc2l0ZSh2aWV3Q29udGFpbmVyLmlkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZEJlSGlkZGVuKHZpZXdDb250YWluZXJPcklkOiBzdHJpbmcgfCBWaWV3Q29udGFpbmVyLCBjYWNoZWRWaWV3Q29udGFpbmVyPzogSUNhY2hlZFZpZXdDb250YWluZXIpOiBib29sZWFuIHtcblx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gaXNTdHJpbmcodmlld0NvbnRhaW5lck9ySWQpID8gdGhpcy5nZXRWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXJPcklkKSA6IHZpZXdDb250YWluZXJPcklkO1xuXHRcdGNvbnN0IHZpZXdDb250YWluZXJJZCA9IGlzU3RyaW5nKHZpZXdDb250YWluZXJPcklkKSA/IHZpZXdDb250YWluZXJPcklkIDogdmlld0NvbnRhaW5lck9ySWQuaWQ7XG5cblx0XHRpZiAodmlld0NvbnRhaW5lcikge1xuXHRcdFx0aWYgKHZpZXdDb250YWluZXIuaGlkZUlmRW1wdHkpIHtcblx0XHRcdFx0aWYgKHRoaXMudmlld1NlcnZpY2UuaXNWaWV3Q29udGFpbmVyQWN0aXZlKHZpZXdDb250YWluZXJJZCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDaGVjayBjYWNoZSBvbmx5IGlmIGV4dGVuc2lvbnMgYXJlIG5vdCB5ZXQgcmVnaXN0ZXJlZCBhbmQgY3VycmVudCB3aW5kb3cgaXMgbm90IG5hdGl2ZSAoZGVza3RvcCkgcmVtb3RlIGNvbm5lY3Rpb24gd2luZG93XG5cdFx0aWYgKCF0aGlzLmhhc0V4dGVuc2lvbnNSZWdpc3RlcmVkICYmICEodGhpcy5wYXJ0ID09PSBQYXJ0cy5TSURFQkFSX1BBUlQgJiYgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5ICYmIGlzTmF0aXZlKSkge1xuXHRcdFx0Y2FjaGVkVmlld0NvbnRhaW5lciA9IGNhY2hlZFZpZXdDb250YWluZXIgfHwgdGhpcy5jYWNoZWRWaWV3Q29udGFpbmVycy5maW5kKCh7IGlkIH0pID0+IGlkID09PSB2aWV3Q29udGFpbmVySWQpO1xuXG5cdFx0XHQvLyBTaG93IGJ1aWx0aW4gVmlld0NvbnRhaW5lciBpZiBub3QgcmVnaXN0ZXJlZCB5ZXRcblx0XHRcdGlmICghdmlld0NvbnRhaW5lciAmJiBjYWNoZWRWaWV3Q29udGFpbmVyPy5pc0J1aWx0aW4gJiYgY2FjaGVkVmlld0NvbnRhaW5lcj8udmlzaWJsZSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjYWNoZWRWaWV3Q29udGFpbmVyPy52aWV3cz8ubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiBjYWNoZWRWaWV3Q29udGFpbmVyLnZpZXdzLmV2ZXJ5KCh7IHdoZW4gfSkgPT4gISF3aGVuICYmICF0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUod2hlbikpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgYWRkQ29tcG9zaXRlKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHR0aGlzLmNvbXBvc2l0ZUJhci5hZGRDb21wb3NpdGUoeyBpZDogdmlld0NvbnRhaW5lci5pZCwgbmFtZTogdHlwZW9mIHZpZXdDb250YWluZXIudGl0bGUgPT09ICdzdHJpbmcnID8gdmlld0NvbnRhaW5lci50aXRsZSA6IHZpZXdDb250YWluZXIudGl0bGUudmFsdWUsIG9yZGVyOiB2aWV3Q29udGFpbmVyLm9yZGVyLCByZXF1ZXN0ZWRJbmRleDogdmlld0NvbnRhaW5lci5yZXF1ZXN0ZWRJbmRleCB9KTtcblx0fVxuXG5cdHByaXZhdGUgaGlkZUNvbXBvc2l0ZShjb21wb3NpdGVJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5jb21wb3NpdGVCYXIuaGlkZUNvbXBvc2l0ZShjb21wb3NpdGVJZCk7XG5cblx0XHRjb25zdCBjb21wb3NpdGVBY3Rpb25zID0gdGhpcy5jb21wb3NpdGVBY3Rpb25zLmdldChjb21wb3NpdGVJZCk7XG5cdFx0aWYgKGNvbXBvc2l0ZUFjdGlvbnMpIHtcblx0XHRcdGNvbXBvc2l0ZUFjdGlvbnMuYWN0aXZpdHlBY3Rpb24uZGlzcG9zZSgpO1xuXHRcdFx0Y29tcG9zaXRlQWN0aW9ucy5waW5uZWRBY3Rpb24uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5jb21wb3NpdGVBY3Rpb25zLmRlbGV0ZShjb21wb3NpdGVJZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVDb21wb3NpdGUoY29tcG9zaXRlSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuY29tcG9zaXRlQmFyLnJlbW92ZUNvbXBvc2l0ZShjb21wb3NpdGVJZCk7XG5cblx0XHRjb25zdCBjb21wb3NpdGVBY3Rpb25zID0gdGhpcy5jb21wb3NpdGVBY3Rpb25zLmdldChjb21wb3NpdGVJZCk7XG5cdFx0aWYgKGNvbXBvc2l0ZUFjdGlvbnMpIHtcblx0XHRcdGNvbXBvc2l0ZUFjdGlvbnMuYWN0aXZpdHlBY3Rpb24uZGlzcG9zZSgpO1xuXHRcdFx0Y29tcG9zaXRlQWN0aW9ucy5waW5uZWRBY3Rpb24uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5jb21wb3NpdGVBY3Rpb25zLmRlbGV0ZShjb21wb3NpdGVJZCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0UGlubmVkUGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgcGlubmVkQ29tcG9zaXRlSWRzID0gdGhpcy5jb21wb3NpdGVCYXIuZ2V0UGlubmVkQ29tcG9zaXRlcygpLm1hcCh2ID0+IHYuaWQpO1xuXHRcdHJldHVybiB0aGlzLmdldFZpZXdDb250YWluZXJzKClcblx0XHRcdC5maWx0ZXIodiA9PiB0aGlzLmNvbXBvc2l0ZUJhci5pc1Bpbm5lZCh2LmlkKSlcblx0XHRcdC5zb3J0KCh2MSwgdjIpID0+IHBpbm5lZENvbXBvc2l0ZUlkcy5pbmRleE9mKHYxLmlkKSAtIHBpbm5lZENvbXBvc2l0ZUlkcy5pbmRleE9mKHYyLmlkKSlcblx0XHRcdC5tYXAodiA9PiB2LmlkKTtcblx0fVxuXG5cdGdldFZpc2libGVQYW5lQ29tcG9zaXRlSWRzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5jb21wb3NpdGVCYXIuZ2V0VmlzaWJsZUNvbXBvc2l0ZXMoKVxuXHRcdFx0LmZpbHRlcih2ID0+IHRoaXMucGFuZUNvbXBvc2l0ZVBhcnQuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZSgpPy5nZXRJZCgpID09PSB2LmlkIHx8IHRoaXMuY29tcG9zaXRlQmFyLmlzUGlubmVkKHYuaWQpKVxuXHRcdFx0Lm1hcCh2ID0+IHYuaWQpO1xuXHR9XG5cblx0Z2V0UGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuY29tcG9zaXRlQmFyLmdldFZpc2libGVDb21wb3NpdGVzKClcblx0XHRcdC5tYXAodiA9PiB2LmlkKTtcblx0fVxuXG5cdGdldENvbnRleHRNZW51QWN0aW9ucygpOiBJQWN0aW9uW10ge1xuXHRcdHJldHVybiB0aGlzLmNvbXBvc2l0ZUJhci5nZXRDb250ZXh0TWVudUFjdGlvbnMoKTtcblx0fVxuXG5cdGZvY3VzKGluZGV4PzogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5jb21wb3NpdGVCYXIuZm9jdXMoaW5kZXgpO1xuXHR9XG5cblx0bGF5b3V0KHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5jb21wb3NpdGVCYXIubGF5b3V0KG5ldyBEaW1lbnNpb24od2lkdGgsIGhlaWdodCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRWaWV3Q29udGFpbmVyKGlkOiBzdHJpbmcpOiBWaWV3Q29udGFpbmVyIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5SWQoaWQpO1xuXHRcdHJldHVybiB2aWV3Q29udGFpbmVyICYmIHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKSA9PT0gdGhpcy5sb2NhdGlvbiA/IHZpZXdDb250YWluZXIgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldFZpZXdDb250YWluZXJzKCk6IHJlYWRvbmx5IFZpZXdDb250YWluZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJzQnlMb2NhdGlvbih0aGlzLmxvY2F0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29tcG9zaXRlQmFySXRlbXNGcm9tU3RvcmFnZShyZXRhaW5FeGlzdGluZzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLnBpbm5lZFZpZXdDb250YWluZXJzVmFsdWUgPT09IHRoaXMuZ2V0U3RvcmVkUGlubmVkVmlld0NvbnRhaW5lcnNWYWx1ZSgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fcGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyc1ZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Bpbm5lZFZpZXdDb250YWluZXJzVmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fY2FjaGVkVmlld0NvbnRhaW5lcnMgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBuZXdDb21wb3NpdGVJdGVtczogSUNvbXBvc2l0ZUJhckl0ZW1bXSA9IFtdO1xuXHRcdGNvbnN0IGNvbXBvc2l0ZUl0ZW1zID0gdGhpcy5jb21wb3NpdGVCYXIuZ2V0Q29tcG9zaXRlQmFySXRlbXMoKTtcblxuXHRcdGZvciAoY29uc3QgY2FjaGVkVmlld0NvbnRhaW5lciBvZiB0aGlzLmNhY2hlZFZpZXdDb250YWluZXJzKSB7XG5cdFx0XHRuZXdDb21wb3NpdGVJdGVtcy5wdXNoKHtcblx0XHRcdFx0aWQ6IGNhY2hlZFZpZXdDb250YWluZXIuaWQsXG5cdFx0XHRcdG5hbWU6IGNhY2hlZFZpZXdDb250YWluZXIubmFtZSxcblx0XHRcdFx0b3JkZXI6IGNhY2hlZFZpZXdDb250YWluZXIub3JkZXIsXG5cdFx0XHRcdHBpbm5lZDogY2FjaGVkVmlld0NvbnRhaW5lci5waW5uZWQsXG5cdFx0XHRcdHZpc2libGU6IGNhY2hlZFZpZXdDb250YWluZXIudmlzaWJsZSAmJiAhIXRoaXMuZ2V0Vmlld0NvbnRhaW5lcihjYWNoZWRWaWV3Q29udGFpbmVyLmlkKSxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3Qgdmlld0NvbnRhaW5lciBvZiB0aGlzLmdldFZpZXdDb250YWluZXJzKCkpIHtcblx0XHRcdC8vIEFkZCBtaXNzaW5nIHZpZXcgY29udGFpbmVyc1xuXHRcdFx0aWYgKCFuZXdDb21wb3NpdGVJdGVtcy5zb21lKCh7IGlkIH0pID0+IGlkID09PSB2aWV3Q29udGFpbmVyLmlkKSkge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IGNvbXBvc2l0ZUl0ZW1zLmZpbmRJbmRleCgoeyBpZCB9KSA9PiBpZCA9PT0gdmlld0NvbnRhaW5lci5pZCk7XG5cdFx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0XHRjb25zdCBjb21wb3NpdGVJdGVtID0gY29tcG9zaXRlSXRlbXNbaW5kZXhdO1xuXHRcdFx0XHRcdG5ld0NvbXBvc2l0ZUl0ZW1zLnNwbGljZShpbmRleCwgMCwge1xuXHRcdFx0XHRcdFx0aWQ6IHZpZXdDb250YWluZXIuaWQsXG5cdFx0XHRcdFx0XHRuYW1lOiB0eXBlb2Ygdmlld0NvbnRhaW5lci50aXRsZSA9PT0gJ3N0cmluZycgPyB2aWV3Q29udGFpbmVyLnRpdGxlIDogdmlld0NvbnRhaW5lci50aXRsZS52YWx1ZSxcblx0XHRcdFx0XHRcdG9yZGVyOiBjb21wb3NpdGVJdGVtLm9yZGVyLFxuXHRcdFx0XHRcdFx0cGlubmVkOiBjb21wb3NpdGVJdGVtLnBpbm5lZCxcblx0XHRcdFx0XHRcdHZpc2libGU6IGNvbXBvc2l0ZUl0ZW0udmlzaWJsZSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXdDb21wb3NpdGVJdGVtcy5wdXNoKHtcblx0XHRcdFx0XHRcdGlkOiB2aWV3Q29udGFpbmVyLmlkLFxuXHRcdFx0XHRcdFx0bmFtZTogdHlwZW9mIHZpZXdDb250YWluZXIudGl0bGUgPT09ICdzdHJpbmcnID8gdmlld0NvbnRhaW5lci50aXRsZSA6IHZpZXdDb250YWluZXIudGl0bGUudmFsdWUsXG5cdFx0XHRcdFx0XHRvcmRlcjogdmlld0NvbnRhaW5lci5vcmRlcixcblx0XHRcdFx0XHRcdHBpbm5lZDogdHJ1ZSxcblx0XHRcdFx0XHRcdHZpc2libGU6ICF0aGlzLnNob3VsZEJlSGlkZGVuKHZpZXdDb250YWluZXIpLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHJldGFpbkV4aXN0aW5nKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGNvbXBvc2l0ZUl0ZW0gb2YgY29tcG9zaXRlSXRlbXMpIHtcblx0XHRcdFx0Y29uc3QgbmV3Q29tcG9zaXRlSXRlbSA9IG5ld0NvbXBvc2l0ZUl0ZW1zLmZpbmQoKHsgaWQgfSkgPT4gaWQgPT09IGNvbXBvc2l0ZUl0ZW0uaWQpO1xuXHRcdFx0XHRpZiAoIW5ld0NvbXBvc2l0ZUl0ZW0pIHtcblx0XHRcdFx0XHRuZXdDb21wb3NpdGVJdGVtcy5wdXNoKGNvbXBvc2l0ZUl0ZW0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5jb21wb3NpdGVCYXIuc2V0Q29tcG9zaXRlQmFySXRlbXMobmV3Q29tcG9zaXRlSXRlbXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBzYXZlQ2FjaGVkVmlld0NvbnRhaW5lcnMoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhdGU6IElDYWNoZWRWaWV3Q29udGFpbmVyW10gPSBbXTtcblxuXHRcdGNvbnN0IGNvbXBvc2l0ZUl0ZW1zID0gdGhpcy5jb21wb3NpdGVCYXIuZ2V0Q29tcG9zaXRlQmFySXRlbXMoKTtcblx0XHRmb3IgKGNvbnN0IGNvbXBvc2l0ZUl0ZW0gb2YgY29tcG9zaXRlSXRlbXMpIHtcblx0XHRcdGNvbnN0IHZpZXdDb250YWluZXIgPSB0aGlzLmdldFZpZXdDb250YWluZXIoY29tcG9zaXRlSXRlbS5pZCk7XG5cdFx0XHRpZiAodmlld0NvbnRhaW5lcikge1xuXHRcdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyTW9kZWwgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lcik7XG5cdFx0XHRcdGNvbnN0IHZpZXdzOiB7IHdoZW46IHN0cmluZyB8IHVuZGVmaW5lZCB9W10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCB7IHdoZW4gfSBvZiB2aWV3Q29udGFpbmVyTW9kZWwuYWxsVmlld0Rlc2NyaXB0b3JzKSB7XG5cdFx0XHRcdFx0dmlld3MucHVzaCh7IHdoZW46IHdoZW4gPyB3aGVuLnNlcmlhbGl6ZSgpIDogdW5kZWZpbmVkIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXRlLnB1c2goe1xuXHRcdFx0XHRcdGlkOiBjb21wb3NpdGVJdGVtLmlkLFxuXHRcdFx0XHRcdG5hbWU6IHZpZXdDb250YWluZXJNb2RlbC50aXRsZSxcblx0XHRcdFx0XHRpY29uOiBVUkkuaXNVcmkodmlld0NvbnRhaW5lck1vZGVsLmljb24pICYmIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSA/IHVuZGVmaW5lZCA6IHZpZXdDb250YWluZXJNb2RlbC5pY29uLCAvLyBEbyBub3QgY2FjaGUgdXJpIGljb25zIHdpdGggcmVtb3RlIGNvbm5lY3Rpb25cblx0XHRcdFx0XHR2aWV3cyxcblx0XHRcdFx0XHRwaW5uZWQ6IGNvbXBvc2l0ZUl0ZW0ucGlubmVkLFxuXHRcdFx0XHRcdG9yZGVyOiBjb21wb3NpdGVJdGVtLm9yZGVyLFxuXHRcdFx0XHRcdHZpc2libGU6IGNvbXBvc2l0ZUl0ZW0udmlzaWJsZSxcblx0XHRcdFx0XHRpc0J1aWx0aW46ICF2aWV3Q29udGFpbmVyLmV4dGVuc2lvbklkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3RhdGUucHVzaCh7IGlkOiBjb21wb3NpdGVJdGVtLmlkLCBuYW1lOiBjb21wb3NpdGVJdGVtLm5hbWUsIHBpbm5lZDogY29tcG9zaXRlSXRlbS5waW5uZWQsIG9yZGVyOiBjb21wb3NpdGVJdGVtLm9yZGVyLCB2aXNpYmxlOiBmYWxzZSwgaXNCdWlsdGluOiBmYWxzZSB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnN0b3JlQ2FjaGVkVmlld0NvbnRhaW5lcnNTdGF0ZShzdGF0ZSk7XG5cdH1cblxuXHRwcml2YXRlIF9jYWNoZWRWaWV3Q29udGFpbmVyczogSUNhY2hlZFZpZXdDb250YWluZXJbXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXQgY2FjaGVkVmlld0NvbnRhaW5lcnMoKTogSUNhY2hlZFZpZXdDb250YWluZXJbXSB7XG5cdFx0aWYgKHRoaXMuX2NhY2hlZFZpZXdDb250YWluZXJzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX2NhY2hlZFZpZXdDb250YWluZXJzID0gdGhpcy5nZXRQaW5uZWRWaWV3Q29udGFpbmVycygpO1xuXHRcdFx0Zm9yIChjb25zdCBwbGFjZWhvbGRlclZpZXdDb250YWluZXIgb2YgdGhpcy5nZXRQbGFjZWhvbGRlclZpZXdDb250YWluZXJzKCkpIHtcblx0XHRcdFx0Y29uc3QgY2FjaGVkVmlld0NvbnRhaW5lciA9IHRoaXMuX2NhY2hlZFZpZXdDb250YWluZXJzLmZpbmQoY2FjaGVkID0+IGNhY2hlZC5pZCA9PT0gcGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyLmlkKTtcblx0XHRcdFx0aWYgKGNhY2hlZFZpZXdDb250YWluZXIpIHtcblx0XHRcdFx0XHRjYWNoZWRWaWV3Q29udGFpbmVyLnZpc2libGUgPSBwbGFjZWhvbGRlclZpZXdDb250YWluZXIudmlzaWJsZSA/PyBjYWNoZWRWaWV3Q29udGFpbmVyLnZpc2libGU7XG5cdFx0XHRcdFx0Y2FjaGVkVmlld0NvbnRhaW5lci5uYW1lID0gcGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyLm5hbWU7XG5cdFx0XHRcdFx0Y2FjaGVkVmlld0NvbnRhaW5lci5pY29uID0gcGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyLnRoZW1lSWNvbiA/IHBsYWNlaG9sZGVyVmlld0NvbnRhaW5lci50aGVtZUljb24gOlxuXHRcdFx0XHRcdFx0cGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyLmljb25VcmwgPyBVUkkucmV2aXZlKHBsYWNlaG9sZGVyVmlld0NvbnRhaW5lci5pY29uVXJsKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRpZiAoVVJJLmlzVXJpKGNhY2hlZFZpZXdDb250YWluZXIuaWNvbikgJiYgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0XHRjYWNoZWRWaWV3Q29udGFpbmVyLmljb24gPSB1bmRlZmluZWQ7IC8vIERvIG5vdCBjYWNoZSB1cmkgaWNvbnMgd2l0aCByZW1vdGUgY29ubmVjdGlvblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYWNoZWRWaWV3Q29udGFpbmVyLnZpZXdzID0gcGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyLnZpZXdzO1xuXHRcdFx0XHRcdGNhY2hlZFZpZXdDb250YWluZXIuaXNCdWlsdGluID0gcGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyLmlzQnVpbHRpbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCB2aWV3Q29udGFpbmVyV29ya3NwYWNlU3RhdGUgb2YgdGhpcy5nZXRWaWV3Q29udGFpbmVyc1dvcmtzcGFjZVN0YXRlKCkpIHtcblx0XHRcdFx0Y29uc3QgY2FjaGVkVmlld0NvbnRhaW5lciA9IHRoaXMuX2NhY2hlZFZpZXdDb250YWluZXJzLmZpbmQoY2FjaGVkID0+IGNhY2hlZC5pZCA9PT0gdmlld0NvbnRhaW5lcldvcmtzcGFjZVN0YXRlLmlkKTtcblx0XHRcdFx0aWYgKGNhY2hlZFZpZXdDb250YWluZXIpIHtcblx0XHRcdFx0XHRjYWNoZWRWaWV3Q29udGFpbmVyLnZpc2libGUgPSB2aWV3Q29udGFpbmVyV29ya3NwYWNlU3RhdGUudmlzaWJsZSA/PyBjYWNoZWRWaWV3Q29udGFpbmVyLnZpc2libGU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fY2FjaGVkVmlld0NvbnRhaW5lcnM7XG5cdH1cblxuXHRwcml2YXRlIHN0b3JlQ2FjaGVkVmlld0NvbnRhaW5lcnNTdGF0ZShjYWNoZWRWaWV3Q29udGFpbmVyczogSUNhY2hlZFZpZXdDb250YWluZXJbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHBpbm5lZFZpZXdDb250YWluZXJzID0gdGhpcy5nZXRQaW5uZWRWaWV3Q29udGFpbmVycygpO1xuXHRcdHRoaXMuc2V0UGlubmVkVmlld0NvbnRhaW5lcnMoY2FjaGVkVmlld0NvbnRhaW5lcnMubWFwKCh7IGlkLCBwaW5uZWQsIG9yZGVyIH0pID0+ICh7XG5cdFx0XHRpZCxcblx0XHRcdHBpbm5lZCxcblx0XHRcdHZpc2libGU6IEJvb2xlYW4ocGlubmVkVmlld0NvbnRhaW5lcnMuZmluZCgoeyBpZDogcGlubmVkSWQgfSkgPT4gcGlubmVkSWQgPT09IGlkKT8udmlzaWJsZSksXG5cdFx0XHRvcmRlclxuXHRcdH0gc2F0aXNmaWVzIElQaW5uZWRWaWV3Q29udGFpbmVyKSkpO1xuXG5cdFx0dGhpcy5zZXRQbGFjZWhvbGRlclZpZXdDb250YWluZXJzKGNhY2hlZFZpZXdDb250YWluZXJzLm1hcCgoeyBpZCwgaWNvbiwgbmFtZSwgdmlld3MsIGlzQnVpbHRpbiB9KSA9PiAoe1xuXHRcdFx0aWQsXG5cdFx0XHRpY29uVXJsOiBVUkkuaXNVcmkoaWNvbikgPyBpY29uIDogdW5kZWZpbmVkLFxuXHRcdFx0dGhlbWVJY29uOiBUaGVtZUljb24uaXNUaGVtZUljb24oaWNvbikgPyBpY29uIDogdW5kZWZpbmVkLFxuXHRcdFx0bmFtZSxcblx0XHRcdGlzQnVpbHRpbixcblx0XHRcdHZpZXdzXG5cdFx0fSBzYXRpc2ZpZXMgSVBsYWNlaG9sZGVyVmlld0NvbnRhaW5lcikpKTtcblxuXHRcdHRoaXMuc2V0Vmlld0NvbnRhaW5lcnNXb3Jrc3BhY2VTdGF0ZShjYWNoZWRWaWV3Q29udGFpbmVycy5tYXAoKHsgaWQsIHZpc2libGUgfSkgPT4gKHtcblx0XHRcdGlkLFxuXHRcdFx0dmlzaWJsZSxcblx0XHR9IHNhdGlzZmllcyBJVmlld0NvbnRhaW5lcldvcmtzcGFjZVN0YXRlKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRQaW5uZWRWaWV3Q29udGFpbmVycygpOiBJUGlubmVkVmlld0NvbnRhaW5lcltdIHtcblx0XHRyZXR1cm4gSlNPTi5wYXJzZSh0aGlzLnBpbm5lZFZpZXdDb250YWluZXJzVmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRQaW5uZWRWaWV3Q29udGFpbmVycyhwaW5uZWRWaWV3Q29udGFpbmVyczogSVBpbm5lZFZpZXdDb250YWluZXJbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGZpbHRlcmVkID0gcGlubmVkVmlld0NvbnRhaW5lcnMuZmlsdGVyKHYgPT4gIVBhbmVDb21wb3NpdGVCYXIuX3BsYXhpb0hpZGRlblZpZXdDb250YWluZXJzLmhhcyh2LmlkKSk7XG5cdFx0dGhpcy5waW5uZWRWaWV3Q29udGFpbmVyc1ZhbHVlID0gSlNPTi5zdHJpbmdpZnkoZmlsdGVyZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcGlubmVkVmlld0NvbnRhaW5lcnNWYWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCBwaW5uZWRWaWV3Q29udGFpbmVyc1ZhbHVlKCk6IHN0cmluZyB7XG5cdFx0aWYgKCF0aGlzLl9waW5uZWRWaWV3Q29udGFpbmVyc1ZhbHVlKSB7XG5cdFx0XHR0aGlzLl9waW5uZWRWaWV3Q29udGFpbmVyc1ZhbHVlID0gdGhpcy5nZXRTdG9yZWRQaW5uZWRWaWV3Q29udGFpbmVyc1ZhbHVlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3Bpbm5lZFZpZXdDb250YWluZXJzVmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIHNldCBwaW5uZWRWaWV3Q29udGFpbmVyc1ZhbHVlKHBpbm5lZFZpZXdDb250YWluZXJzVmFsdWU6IHN0cmluZykge1xuXHRcdGlmICh0aGlzLnBpbm5lZFZpZXdDb250YWluZXJzVmFsdWUgIT09IHBpbm5lZFZpZXdDb250YWluZXJzVmFsdWUpIHtcblx0XHRcdHRoaXMuX3Bpbm5lZFZpZXdDb250YWluZXJzVmFsdWUgPSBwaW5uZWRWaWV3Q29udGFpbmVyc1ZhbHVlO1xuXHRcdFx0dGhpcy5zZXRTdG9yZWRQaW5uZWRWaWV3Q29udGFpbmVyc1ZhbHVlKHBpbm5lZFZpZXdDb250YWluZXJzVmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0U3RvcmVkUGlubmVkVmlld0NvbnRhaW5lcnNWYWx1ZSgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHJhdyA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KHRoaXMub3B0aW9ucy5waW5uZWRWaWV3Q29udGFpbmVyc0tleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsICdbXScpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwYXJzZWQ6IElQaW5uZWRWaWV3Q29udGFpbmVyW10gPSBKU09OLnBhcnNlKHJhdyk7XG5cdFx0XHRjb25zdCBmaWx0ZXJlZCA9IHBhcnNlZC5maWx0ZXIodiA9PiAhUGFuZUNvbXBvc2l0ZUJhci5fcGxheGlvSGlkZGVuVmlld0NvbnRhaW5lcnMuaGFzKHYuaWQpKTtcblx0XHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShmaWx0ZXJlZCk7XG5cdFx0fSBjYXRjaCB7IHJldHVybiByYXc7IH1cblx0fVxuXG5cdHByaXZhdGUgc2V0U3RvcmVkUGlubmVkVmlld0NvbnRhaW5lcnNWYWx1ZSh2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZSh0aGlzLm9wdGlvbnMucGlubmVkVmlld0NvbnRhaW5lcnNLZXksIHZhbHVlLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UGxhY2Vob2xkZXJWaWV3Q29udGFpbmVycygpOiBJUGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyW10ge1xuXHRcdHJldHVybiBKU09OLnBhcnNlKHRoaXMucGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyc1ZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0UGxhY2Vob2xkZXJWaWV3Q29udGFpbmVycyhwbGFjZWhvbGRlclZpZXdDb250YWluZXJzOiBJUGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyW10pOiB2b2lkIHtcblx0XHRjb25zdCBmaWx0ZXJlZCA9IHBsYWNlaG9sZGVyVmlld0NvbnRhaW5lcnMuZmlsdGVyKHYgPT4gIVBhbmVDb21wb3NpdGVCYXIuX3BsYXhpb0hpZGRlblZpZXdDb250YWluZXJzLmhhcyh2LmlkKSk7XG5cdFx0dGhpcy5wbGFjZWhvbGRlclZpZXdDb250YWluZXJzVmFsdWUgPSBKU09OLnN0cmluZ2lmeShmaWx0ZXJlZCk7XG5cdH1cblxuXHRwcml2YXRlIF9wbGFjZWhvbGRlclZpZXdDb250YWluZXJzVmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXQgcGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyc1ZhbHVlKCk6IHN0cmluZyB7XG5cdFx0aWYgKCF0aGlzLl9wbGFjZWhvbGRlclZpZXdDb250YWluZXJzVmFsdWUpIHtcblx0XHRcdHRoaXMuX3BsYWNlaG9sZGVyVmlld0NvbnRhaW5lcnNWYWx1ZSA9IHRoaXMuZ2V0U3RvcmVkUGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyc1ZhbHVlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3BsYWNlaG9sZGVyVmlld0NvbnRhaW5lcnNWYWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0IHBsYWNlaG9sZGVyVmlld0NvbnRhaW5lcnNWYWx1ZShwbGFjZWhvbGRlclZpZXdDb250YWluZXNWYWx1ZTogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMucGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyc1ZhbHVlICE9PSBwbGFjZWhvbGRlclZpZXdDb250YWluZXNWYWx1ZSkge1xuXHRcdFx0dGhpcy5fcGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyc1ZhbHVlID0gcGxhY2Vob2xkZXJWaWV3Q29udGFpbmVzVmFsdWU7XG5cdFx0XHR0aGlzLnNldFN0b3JlZFBsYWNlaG9sZGVyVmlld0NvbnRhaW5lcnNWYWx1ZShwbGFjZWhvbGRlclZpZXdDb250YWluZXNWYWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRTdG9yZWRQbGFjZWhvbGRlclZpZXdDb250YWluZXJzVmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQodGhpcy5vcHRpb25zLnBsYWNlaG9sZGVyVmlld0NvbnRhaW5lcnNLZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAnW10nKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0U3RvcmVkUGxhY2Vob2xkZXJWaWV3Q29udGFpbmVyc1ZhbHVlKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKHRoaXMub3B0aW9ucy5wbGFjZWhvbGRlclZpZXdDb250YWluZXJzS2V5LCB2YWx1ZSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRwcml2YXRlIGdldFZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGUoKTogSVZpZXdDb250YWluZXJXb3Jrc3BhY2VTdGF0ZVtdIHtcblx0XHRyZXR1cm4gSlNPTi5wYXJzZSh0aGlzLnZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVWYWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIHNldFZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGUodmlld0NvbnRhaW5lcnNXb3Jrc3BhY2VTdGF0ZTogSVZpZXdDb250YWluZXJXb3Jrc3BhY2VTdGF0ZVtdKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3Q29udGFpbmVyc1dvcmtzcGFjZVN0YXRlVmFsdWUgPSBKU09OLnN0cmluZ2lmeSh2aWV3Q29udGFpbmVyc1dvcmtzcGFjZVN0YXRlKTtcblx0fVxuXG5cdHByaXZhdGUgX3ZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVWYWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCB2aWV3Q29udGFpbmVyc1dvcmtzcGFjZVN0YXRlVmFsdWUoKTogc3RyaW5nIHtcblx0XHRpZiAoIXRoaXMuX3ZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVWYWx1ZSkge1xuXHRcdFx0dGhpcy5fdmlld0NvbnRhaW5lcnNXb3Jrc3BhY2VTdGF0ZVZhbHVlID0gdGhpcy5nZXRTdG9yZWRWaWV3Q29udGFpbmVyc1dvcmtzcGFjZVN0YXRlVmFsdWUoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fdmlld0NvbnRhaW5lcnNXb3Jrc3BhY2VTdGF0ZVZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXQgdmlld0NvbnRhaW5lcnNXb3Jrc3BhY2VTdGF0ZVZhbHVlKHZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVWYWx1ZTogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMudmlld0NvbnRhaW5lcnNXb3Jrc3BhY2VTdGF0ZVZhbHVlICE9PSB2aWV3Q29udGFpbmVyc1dvcmtzcGFjZVN0YXRlVmFsdWUpIHtcblx0XHRcdHRoaXMuX3ZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVWYWx1ZSA9IHZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVWYWx1ZTtcblx0XHRcdHRoaXMuc2V0U3RvcmVkVmlld0NvbnRhaW5lcnNXb3Jrc3BhY2VTdGF0ZVZhbHVlKHZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVWYWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRTdG9yZWRWaWV3Q29udGFpbmVyc1dvcmtzcGFjZVN0YXRlVmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQodGhpcy5vcHRpb25zLnZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVLZXksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsICdbXScpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRTdG9yZWRWaWV3Q29udGFpbmVyc1dvcmtzcGFjZVN0YXRlVmFsdWUodmFsdWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUodGhpcy5vcHRpb25zLnZpZXdDb250YWluZXJzV29ya3NwYWNlU3RhdGVLZXksIHZhbHVlLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG59XG5cbmNsYXNzIFZpZXdDb250YWluZXJBY3Rpdml0eUFjdGlvbiBleHRlbmRzIENvbXBvc2l0ZUJhckFjdGlvbiB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgcHJldmVudERvdWJsZUNsaWNrRGVsYXkgPSAzMDA7XG5cblx0cHJpdmF0ZSBsYXN0UnVuID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb21wb3NpdGVCYXJBY3Rpb25JdGVtOiBJQ29tcG9zaXRlQmFyQWN0aW9uSXRlbSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHBhcnQ6IFBhcnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcGFuZUNvbXBvc2l0ZVBhcnQ6IElQYW5lQ29tcG9zaXRlUGFydCxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUFjdGl2aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjdGl2aXR5U2VydmljZTogSUFjdGl2aXR5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoY29tcG9zaXRlQmFyQWN0aW9uSXRlbSk7XG5cdFx0dGhpcy51cGRhdGVBY3Rpdml0eSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYWN0aXZpdHlTZXJ2aWNlLm9uRGlkQ2hhbmdlQWN0aXZpdHkodmlld0NvbnRhaW5lck9yQWN0aW9uID0+IHtcblx0XHRcdGlmICghaXNTdHJpbmcodmlld0NvbnRhaW5lck9yQWN0aW9uKSAmJiB2aWV3Q29udGFpbmVyT3JBY3Rpb24uaWQgPT09IHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUFjdGl2aXR5KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0dXBkYXRlQ29tcG9zaXRlQmFyQWN0aW9uSXRlbShjb21wb3NpdGVCYXJBY3Rpb25JdGVtOiBJQ29tcG9zaXRlQmFyQWN0aW9uSXRlbSk6IHZvaWQge1xuXHRcdHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbSA9IGNvbXBvc2l0ZUJhckFjdGlvbkl0ZW07XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUFjdGl2aXR5KCk6IHZvaWQge1xuXHRcdHRoaXMuYWN0aXZpdGllcyA9IHRoaXMuYWN0aXZpdHlTZXJ2aWNlLmdldFZpZXdDb250YWluZXJBY3Rpdml0aWVzKHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oZXZlbnQ6IHsgcHJlc2VydmVGb2N1czogYm9vbGVhbiB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGlzTW91c2VFdmVudChldmVudCkgJiYgZXZlbnQuYnV0dG9uID09PSAyKSB7XG5cdFx0XHRyZXR1cm47IC8vIGRvIG5vdCBydW4gb24gcmlnaHQgY2xpY2tcblx0XHR9XG5cblx0XHQvLyBwcmV2ZW50IGFjY2lkZW50IHRyaWdnZXIgb24gYSBkb3VibGVjbGljayAodG8gaGVscCBuZXJ2b3VzIHBlb3BsZSlcblx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdGlmIChub3cgPiB0aGlzLmxhc3RSdW4gLyogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI1ODMwICovICYmIG5vdyAtIHRoaXMubGFzdFJ1biA8IFZpZXdDb250YWluZXJBY3Rpdml0eUFjdGlvbi5wcmV2ZW50RG91YmxlQ2xpY2tEZWxheSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmxhc3RSdW4gPSBub3c7XG5cblx0XHRjb25zdCBmb2N1cyA9IChldmVudCAmJiAncHJlc2VydmVGb2N1cycgaW4gZXZlbnQpID8gIWV2ZW50LnByZXNlcnZlRm9jdXMgOiB0cnVlO1xuXG5cdFx0aWYgKHRoaXMucGFydCA9PT0gUGFydHMuQUNUSVZJVFlCQVJfUEFSVCkge1xuXHRcdFx0Y29uc3Qgc2lkZUJhclZpc2libGUgPSB0aGlzLmxheW91dFNlcnZpY2UuaXNWaXNpYmxlKFBhcnRzLlNJREVCQVJfUEFSVCk7XG5cdFx0XHRjb25zdCBhY3RpdmVWaWV3bGV0ID0gdGhpcy5wYW5lQ29tcG9zaXRlUGFydC5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKCk7XG5cdFx0XHRjb25zdCBmb2N1c0JlaGF2aW9yID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KCd3b3JrYmVuY2guYWN0aXZpdHlCYXIuaWNvbkNsaWNrQmVoYXZpb3InKTtcblxuXHRcdFx0aWYgKHNpZGVCYXJWaXNpYmxlICYmIGFjdGl2ZVZpZXdsZXQ/LmdldElkKCkgPT09IHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCkge1xuXHRcdFx0XHRzd2l0Y2ggKGZvY3VzQmVoYXZpb3IpIHtcblx0XHRcdFx0XHRjYXNlICdmb2N1cyc6XG5cdFx0XHRcdFx0XHR0aGlzLnBhbmVDb21wb3NpdGVQYXJ0Lm9wZW5QYW5lQ29tcG9zaXRlKHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCwgZm9jdXMpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAndG9nZ2xlJzpcblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0Ly8gSGlkZSBzaWRlYmFyIGlmIHNlbGVjdGVkIHZpZXdsZXQgYWxyZWFkeSB2aXNpYmxlXG5cdFx0XHRcdFx0XHR0aGlzLmxheW91dFNlcnZpY2Uuc2V0UGFydEhpZGRlbih0cnVlLCBQYXJ0cy5TSURFQkFSX1BBUlQpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5wYW5lQ29tcG9zaXRlUGFydC5vcGVuUGFuZUNvbXBvc2l0ZSh0aGlzLmNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0uaWQsIGZvY3VzKTtcblx0XHRyZXR1cm4gdGhpcy5hY3RpdmF0ZSgpO1xuXHR9XG59XG5cbmNsYXNzIFBsYWNlSG9sZGVyVmlld0NvbnRhaW5lckFjdGl2aXR5QWN0aW9uIGV4dGVuZHMgVmlld0NvbnRhaW5lckFjdGl2aXR5QWN0aW9uIHsgfVxuXG5jbGFzcyBQbGFjZUhvbGRlclRvZ2dsZUNvbXBvc2l0ZVBpbm5lZEFjdGlvbiBleHRlbmRzIFRvZ2dsZUNvbXBvc2l0ZVBpbm5lZEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoaWQ6IHN0cmluZywgY29tcG9zaXRlQmFyOiBJQ29tcG9zaXRlQmFyKSB7XG5cdFx0c3VwZXIoeyBpZCwgbmFtZTogaWQsIGNsYXNzTmFtZXM6IHVuZGVmaW5lZCB9LCBjb21wb3NpdGVCYXIpO1xuXHR9XG5cblx0c2V0QWN0aXZpdHkoYWN0aXZpdHk6IElDb21wb3NpdGVCYXJBY3Rpb25JdGVtKTogdm9pZCB7XG5cdFx0dGhpcy5sYWJlbCA9IGFjdGl2aXR5Lm5hbWU7XG5cdH1cbn1cblxuY2xhc3MgUGxhY2VIb2xkZXJUb2dnbGVDb21wb3NpdGVCYWRnZUFjdGlvbiBleHRlbmRzIFRvZ2dsZUNvbXBvc2l0ZUJhZGdlQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcihpZDogc3RyaW5nLCBjb21wb3NpdGVCYXI6IElDb21wb3NpdGVCYXIpIHtcblx0XHRzdXBlcih7IGlkLCBuYW1lOiBpZCwgY2xhc3NOYW1lczogdW5kZWZpbmVkIH0sIGNvbXBvc2l0ZUJhcik7XG5cdH1cblxuXHRzZXRDb21wb3NpdGVCYXJBY3Rpb25JdGVtKGFjdGlvbkl0ZW06IElDb21wb3NpdGVCYXJBY3Rpb25JdGVtKTogdm9pZCB7XG5cdFx0dGhpcy5sYWJlbCA9IGFjdGlvbkl0ZW0ubmFtZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHlCQUF5QixhQUFhO0FBQy9DLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQXNCLGlCQUFpQixZQUFZLHFCQUFxQjtBQUV4RSxTQUFTLGNBQWlDLDRCQUE0QjtBQUN0RSxTQUFTLFdBQVcsb0JBQW9CO0FBQ3hDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0JBQWdC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
