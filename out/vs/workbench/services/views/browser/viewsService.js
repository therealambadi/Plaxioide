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
import { Disposable, toDisposable, DisposableStore, DisposableMap } from "../../../../base/common/lifecycle.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { FocusedViewContext, getVisbileViewContextKey } from "../../../common/contextkeys.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { isString } from "../../../../base/common/types.js";
import { MenuId, registerAction2, Action2, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { localize, localize2 } from "../../../../nls.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { PaneCompositeDescriptor, Extensions as PaneCompositeExtensions, PaneComposite } from "../../../browser/panecomposite.js";
import { IWorkbenchLayoutService, Parts } from "../../layout/browser/layoutService.js";
import { URI } from "../../../../base/common/uri.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IEditorGroupsService } from "../../editor/common/editorGroupsService.js";
import { FilterViewPaneContainer } from "../../../browser/parts/views/viewsViewlet.js";
import { IPaneCompositePartService } from "../../panecomposite/browser/panecomposite.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IViewsService } from "../common/viewsService.js";
let ViewsService = class extends Disposable {
  constructor(viewDescriptorService, paneCompositeService, contextKeyService, layoutService, editorService) {
    super();
    this.viewDescriptorService = viewDescriptorService;
    this.paneCompositeService = paneCompositeService;
    this.contextKeyService = contextKeyService;
    this.layoutService = layoutService;
    this.editorService = editorService;
    this._onDidChangeViewVisibility = this._register(new Emitter());
    this.onDidChangeViewVisibility = this._onDidChangeViewVisibility.event;
    this._onDidChangeViewContainerVisibility = this._register(new Emitter());
    this.onDidChangeViewContainerVisibility = this._onDidChangeViewContainerVisibility.event;
    this._onDidChangeFocusedView = this._register(new Emitter());
    this.onDidChangeFocusedView = this._onDidChangeFocusedView.event;
    this.viewContainerDisposables = this._register(new DisposableMap());
    this.viewDisposable = /* @__PURE__ */ new Map();
    this.enabledViewContainersContextKeys = /* @__PURE__ */ new Map();
    this.visibleViewContextKeys = /* @__PURE__ */ new Map();
    this.viewPaneContainers = /* @__PURE__ */ new Map();
    this._register(toDisposable(() => {
      this.viewDisposable.forEach((disposable) => disposable.dispose());
      this.viewDisposable.clear();
    }));
    this.viewDescriptorService.viewContainers.forEach((viewContainer) => this.onDidRegisterViewContainer(viewContainer, this.viewDescriptorService.getViewContainerLocation(viewContainer)));
    this._register(this.viewDescriptorService.onDidChangeViewContainers(({ added, removed }) => this.onDidChangeContainers(added, removed)));
    this._register(this.viewDescriptorService.onDidChangeContainerLocation(({ viewContainer, from, to }) => this.onDidChangeContainerLocation(viewContainer, from, to)));
    this._register(this.paneCompositeService.onDidPaneCompositeOpen((e) => this._onDidChangeViewContainerVisibility.fire({ id: e.composite.getId(), visible: true, location: e.viewContainerLocation })));
    this._register(this.paneCompositeService.onDidPaneCompositeClose((e) => this._onDidChangeViewContainerVisibility.fire({ id: e.composite.getId(), visible: false, location: e.viewContainerLocation })));
    this.focusedViewContextKey = FocusedViewContext.bindTo(contextKeyService);
  }
  onViewsAdded(added) {
    for (const view of added) {
      this.onViewsVisibilityChanged(view, view.isBodyVisible());
    }
  }
  onViewsVisibilityChanged(view, visible) {
    this.getOrCreateActiveViewContextKey(view).set(visible);
    this._onDidChangeViewVisibility.fire({ id: view.id, visible });
  }
  onViewsRemoved(removed) {
    for (const view of removed) {
      this.onViewsVisibilityChanged(view, false);
    }
  }
  getOrCreateActiveViewContextKey(view) {
    const visibleContextKeyId = getVisbileViewContextKey(view.id);
    let contextKey = this.visibleViewContextKeys.get(visibleContextKeyId);
    if (!contextKey) {
      contextKey = new RawContextKey(visibleContextKeyId, false).bindTo(this.contextKeyService);
      this.visibleViewContextKeys.set(visibleContextKeyId, contextKey);
    }
    return contextKey;
  }
  onDidChangeContainers(added, removed) {
    for (const { container, location } of removed) {
      this.onDidDeregisterViewContainer(container, location);
    }
    for (const { container, location } of added) {
      this.onDidRegisterViewContainer(container, location);
    }
  }
  onDidRegisterViewContainer(viewContainer, viewContainerLocation) {
    this.registerPaneComposite(viewContainer, viewContainerLocation);
    const disposables = new DisposableStore();
    const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
    this.onViewDescriptorsAdded(viewContainerModel.allViewDescriptors, viewContainer);
    disposables.add(viewContainerModel.onDidChangeAllViewDescriptors(({ added, removed }) => {
      this.onViewDescriptorsAdded(added, viewContainer);
      this.onViewDescriptorsRemoved(removed);
    }));
    this.updateViewContainerEnablementContextKey(viewContainer);
    disposables.add(viewContainerModel.onDidChangeActiveViewDescriptors(() => this.updateViewContainerEnablementContextKey(viewContainer)));
    disposables.add(this.registerOpenViewContainerAction(viewContainer));
    this.viewContainerDisposables.set(viewContainer.id, disposables);
  }
  onDidDeregisterViewContainer(viewContainer, viewContainerLocation) {
    this.deregisterPaneComposite(viewContainer, viewContainerLocation);
    this.viewContainerDisposables.deleteAndDispose(viewContainer.id);
  }
  onDidChangeContainerLocation(viewContainer, from, to) {
    this.deregisterPaneComposite(viewContainer, from);
    this.registerPaneComposite(viewContainer, to);
    if (this.layoutService.isVisible(getPartByLocation(to)) && this.viewDescriptorService.getViewContainersByLocation(to).filter((vc) => this.isViewContainerActive(vc.id)).length === 1) {
      this.openViewContainer(viewContainer.id);
    }
  }
  onViewDescriptorsAdded(views, container) {
    const location = this.viewDescriptorService.getViewContainerLocation(container);
    if (location === null) {
      return;
    }
    for (const viewDescriptor of views) {
      const disposables = new DisposableStore();
      disposables.add(this.registerOpenViewAction(viewDescriptor));
      disposables.add(this.registerFocusViewAction(viewDescriptor, container.title));
      disposables.add(this.registerResetViewLocationAction(viewDescriptor));
      this.viewDisposable.set(viewDescriptor, disposables);
    }
  }
  onViewDescriptorsRemoved(views) {
    for (const view of views) {
      const disposable = this.viewDisposable.get(view);
      if (disposable) {
        disposable.dispose();
        this.viewDisposable.delete(view);
      }
    }
  }
  updateViewContainerEnablementContextKey(viewContainer) {
    let contextKey = this.enabledViewContainersContextKeys.get(viewContainer.id);
    if (!contextKey) {
      contextKey = this.contextKeyService.createKey(getEnabledViewContainerContextKey(viewContainer.id), false);
      this.enabledViewContainersContextKeys.set(viewContainer.id, contextKey);
    }
    contextKey.set(!(viewContainer.hideIfEmpty && this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.length === 0));
  }
  async openComposite(compositeId, location, focus) {
    return this.paneCompositeService.openPaneComposite(compositeId, location, focus);
  }
  getComposite(compositeId, location) {
    return this.paneCompositeService.getPaneComposite(compositeId, location);
  }
  // One view container can be visible at a time in a location
  isViewContainerVisible(id) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(id);
    if (!viewContainer) {
      return false;
    }
    const viewContainerLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
    if (viewContainerLocation === null) {
      return false;
    }
    return this.paneCompositeService.getActivePaneComposite(viewContainerLocation)?.getId() === id;
  }
  // Multiple view containers can be active/inactive at a time in a location
  isViewContainerActive(id) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(id);
    if (!viewContainer) {
      return false;
    }
    if (!viewContainer.hideIfEmpty) {
      return true;
    }
    return this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.length > 0;
  }
  getVisibleViewContainer(location) {
    const viewContainerId = this.paneCompositeService.getActivePaneComposite(location)?.getId();
    return viewContainerId ? this.viewDescriptorService.getViewContainerById(viewContainerId) : null;
  }
  getActiveViewPaneContainerWithId(viewContainerId) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(viewContainerId);
    return viewContainer ? this.getActiveViewPaneContainer(viewContainer) : null;
  }
  async openViewContainer(id, focus) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(id);
    if (viewContainer) {
      const viewContainerLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
      if (viewContainerLocation !== null) {
        const paneComposite = await this.paneCompositeService.openPaneComposite(id, viewContainerLocation, focus);
        return paneComposite || null;
      }
    }
    return null;
  }
  async closeViewContainer(id) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(id);
    if (viewContainer) {
      const viewContainerLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
      const isActive = viewContainerLocation !== null && this.paneCompositeService.getActivePaneComposite(viewContainerLocation);
      if (viewContainerLocation !== null) {
        return isActive ? this.layoutService.setPartHidden(true, getPartByLocation(viewContainerLocation)) : void 0;
      }
    }
  }
  isViewVisible(id) {
    const activeView = this.getActiveViewWithId(id);
    return activeView?.isBodyVisible() || false;
  }
  getActiveViewWithId(id) {
    const viewContainer = this.viewDescriptorService.getViewContainerByViewId(id);
    if (viewContainer) {
      const activeViewPaneContainer = this.getActiveViewPaneContainer(viewContainer);
      if (activeViewPaneContainer) {
        return activeViewPaneContainer.getView(id);
      }
    }
    return null;
  }
  getViewWithId(id) {
    const viewContainer = this.viewDescriptorService.getViewContainerByViewId(id);
    if (viewContainer) {
      const viewPaneContainer = this.viewPaneContainers.get(viewContainer.id);
      if (viewPaneContainer) {
        return viewPaneContainer.getView(id);
      }
    }
    return null;
  }
  getFocusedView() {
    const viewId = this.contextKeyService.getContextKeyValue(FocusedViewContext.key) ?? "";
    return this.viewDescriptorService.getViewDescriptorById(viewId.toString());
  }
  getFocusedViewName() {
    const textEditorFocused = this.editorService.activeTextEditorControl?.hasTextFocus() ? localize("editor", "Text Editor") : void 0;
    return this.getFocusedView()?.name?.value ?? textEditorFocused ?? "";
  }
  async openView(id, focus) {
    const viewContainer = this.viewDescriptorService.getViewContainerByViewId(id);
    if (!viewContainer) {
      return null;
    }
    if (!this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.some((viewDescriptor) => viewDescriptor.id === id)) {
      return null;
    }
    const location = this.viewDescriptorService.getViewContainerLocation(viewContainer);
    const compositeDescriptor = this.getComposite(viewContainer.id, location);
    if (compositeDescriptor) {
      const paneComposite = await this.openComposite(compositeDescriptor.id, location);
      if (paneComposite && paneComposite.openView) {
        return paneComposite.openView(id, focus) || null;
      } else if (focus) {
        paneComposite?.focus();
      }
    }
    return null;
  }
  closeView(id) {
    const viewContainer = this.viewDescriptorService.getViewContainerByViewId(id);
    if (viewContainer) {
      const activeViewPaneContainer = this.getActiveViewPaneContainer(viewContainer);
      if (activeViewPaneContainer) {
        const view = activeViewPaneContainer.getView(id);
        if (view) {
          if (activeViewPaneContainer.views.length === 1) {
            const location = this.viewDescriptorService.getViewContainerLocation(viewContainer);
            if (location === ViewContainerLocation.Sidebar) {
              this.layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
            } else if (location === ViewContainerLocation.Panel || location === ViewContainerLocation.AuxiliaryBar) {
              this.paneCompositeService.hideActivePaneComposite(location);
            }
            if (this.focusedViewContextKey.get() === id) {
              this.focusedViewContextKey.reset();
            }
          } else {
            view.setExpanded(false);
          }
        }
      }
    }
  }
  getActiveViewPaneContainer(viewContainer) {
    const location = this.viewDescriptorService.getViewContainerLocation(viewContainer);
    if (location === null) {
      return null;
    }
    const activePaneComposite = this.paneCompositeService.getActivePaneComposite(location);
    if (activePaneComposite?.getId() === viewContainer.id) {
      return activePaneComposite.getViewPaneContainer() || null;
    }
    return null;
  }
  getViewProgressIndicator(viewId) {
    const viewContainer = this.viewDescriptorService.getViewContainerByViewId(viewId);
    if (!viewContainer) {
      return void 0;
    }
    const viewPaneContainer = this.viewPaneContainers.get(viewContainer.id);
    if (!viewPaneContainer) {
      return void 0;
    }
    const view = viewPaneContainer.getView(viewId);
    if (!view) {
      return void 0;
    }
    if (viewPaneContainer.isViewMergedWithContainer()) {
      return this.getViewContainerProgressIndicator(viewContainer);
    }
    return view.getProgressIndicator();
  }
  getViewContainerProgressIndicator(viewContainer) {
    const viewContainerLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
    if (viewContainerLocation === null) {
      return void 0;
    }
    return this.paneCompositeService.getProgressIndicator(viewContainer.id, viewContainerLocation);
  }
  registerOpenViewContainerAction(viewContainer) {
    const disposables = new DisposableStore();
    if (viewContainer.openCommandActionDescriptor) {
      const { id, mnemonicTitle, keybindings, order } = viewContainer.openCommandActionDescriptor ?? { id: viewContainer.id };
      const title = viewContainer.openCommandActionDescriptor.title ?? viewContainer.title;
      const that = this;
      disposables.add(registerAction2(class OpenViewContainerAction extends Action2 {
        constructor() {
          super({
            id,
            get title() {
              const viewContainerLocation = that.viewDescriptorService.getViewContainerLocation(viewContainer);
              const localizedTitle = typeof title === "string" ? title : title.value;
              const originalTitle = typeof title === "string" ? title : title.original;
              if (viewContainerLocation === ViewContainerLocation.Sidebar) {
                return { value: localize("show view", "Show {0}", localizedTitle), original: `Show ${originalTitle}` };
              } else {
                return { value: localize("toggle view", "Toggle {0}", localizedTitle), original: `Toggle ${originalTitle}` };
              }
            },
            category: Categories.View,
            precondition: ContextKeyExpr.has(getEnabledViewContainerContextKey(viewContainer.id)),
            keybinding: keybindings ? { ...keybindings, weight: KeybindingWeight.WorkbenchContrib } : void 0,
            f1: true
          });
        }
        async run(serviceAccessor) {
          const editorGroupService = serviceAccessor.get(IEditorGroupsService);
          const viewDescriptorService = serviceAccessor.get(IViewDescriptorService);
          const layoutService = serviceAccessor.get(IWorkbenchLayoutService);
          const viewsService = serviceAccessor.get(IViewsService);
          const viewContainerLocation = viewDescriptorService.getViewContainerLocation(viewContainer);
          switch (viewContainerLocation) {
            case ViewContainerLocation.AuxiliaryBar:
            case ViewContainerLocation.Sidebar: {
              const part = viewContainerLocation === ViewContainerLocation.Sidebar ? Parts.SIDEBAR_PART : Parts.AUXILIARYBAR_PART;
              if (!viewsService.isViewContainerVisible(viewContainer.id) || !layoutService.hasFocus(part)) {
                await viewsService.openViewContainer(viewContainer.id, true);
              } else {
                editorGroupService.activeGroup.focus();
              }
              break;
            }
            case ViewContainerLocation.Panel:
              if (!viewsService.isViewContainerVisible(viewContainer.id) || !layoutService.hasFocus(Parts.PANEL_PART)) {
                await viewsService.openViewContainer(viewContainer.id, true);
              } else {
                viewsService.closeViewContainer(viewContainer.id);
              }
              break;
          }
        }
      }));
      if (mnemonicTitle) {
        const defaultLocation = this.viewDescriptorService.getDefaultViewContainerLocation(viewContainer);
        disposables.add(MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
          command: {
            id,
            title: mnemonicTitle
          },
          group: defaultLocation === ViewContainerLocation.Sidebar ? "3_sidebar" : defaultLocation === ViewContainerLocation.AuxiliaryBar ? "4_auxbar" : "5_panel",
          when: ContextKeyExpr.has(getEnabledViewContainerContextKey(viewContainer.id)),
          order: order ?? Number.MAX_VALUE
        }));
      }
    }
    return disposables;
  }
  registerOpenViewAction(viewDescriptor) {
    const disposables = new DisposableStore();
    if (viewDescriptor.openCommandActionDescriptor) {
      const title = viewDescriptor.openCommandActionDescriptor.title ?? viewDescriptor.name;
      const commandId = viewDescriptor.openCommandActionDescriptor.id;
      const that = this;
      disposables.add(registerAction2(class OpenViewAction extends Action2 {
        constructor() {
          super({
            id: commandId,
            get title() {
              const viewContainerLocation = that.viewDescriptorService.getViewLocationById(viewDescriptor.id);
              const localizedTitle = typeof title === "string" ? title : title.value;
              const originalTitle = typeof title === "string" ? title : title.original;
              if (viewContainerLocation === ViewContainerLocation.Sidebar) {
                return { value: localize("show view", "Show {0}", localizedTitle), original: `Show ${originalTitle}` };
              } else {
                return { value: localize("toggle view", "Toggle {0}", localizedTitle), original: `Toggle ${originalTitle}` };
              }
            },
            category: Categories.View,
            precondition: ContextKeyExpr.has(`${viewDescriptor.id}.active`),
            keybinding: viewDescriptor.openCommandActionDescriptor.keybindings ? { ...viewDescriptor.openCommandActionDescriptor.keybindings, weight: KeybindingWeight.WorkbenchContrib } : void 0,
            f1: true
          });
        }
        async run(serviceAccessor) {
          const editorGroupService = serviceAccessor.get(IEditorGroupsService);
          const viewDescriptorService = serviceAccessor.get(IViewDescriptorService);
          const layoutService = serviceAccessor.get(IWorkbenchLayoutService);
          const viewsService = serviceAccessor.get(IViewsService);
          const contextKeyService = serviceAccessor.get(IContextKeyService);
          const focusedViewId = FocusedViewContext.getValue(contextKeyService);
          if (focusedViewId === viewDescriptor.id) {
            const viewLocation = viewDescriptorService.getViewLocationById(viewDescriptor.id);
            if (viewDescriptorService.getViewLocationById(viewDescriptor.id) === ViewContainerLocation.Sidebar) {
              editorGroupService.activeGroup.focus();
            } else if (viewLocation !== null) {
              layoutService.setPartHidden(true, getPartByLocation(viewLocation));
            }
          } else {
            viewsService.openView(viewDescriptor.id, true);
          }
        }
      }));
      if (viewDescriptor.openCommandActionDescriptor.mnemonicTitle) {
        const defaultViewContainer = this.viewDescriptorService.getDefaultContainerById(viewDescriptor.id);
        if (defaultViewContainer) {
          const defaultLocation = this.viewDescriptorService.getDefaultViewContainerLocation(defaultViewContainer);
          disposables.add(MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
            command: {
              id: commandId,
              title: viewDescriptor.openCommandActionDescriptor.mnemonicTitle
            },
            group: defaultLocation === ViewContainerLocation.Sidebar ? "3_sidebar" : defaultLocation === ViewContainerLocation.AuxiliaryBar ? "4_auxbar" : "5_panel",
            when: ContextKeyExpr.has(`${viewDescriptor.id}.active`),
            order: viewDescriptor.openCommandActionDescriptor.order ?? Number.MAX_VALUE
          }));
        }
      }
    }
    return disposables;
  }
  registerFocusViewAction(viewDescriptor, category) {
    return registerAction2(class FocusViewAction extends Action2 {
      constructor() {
        const title = localize2({ key: "focus view", comment: ["{0} indicates the name of the view to be focused."] }, "Focus on {0} View", viewDescriptor.name.value);
        super({
          id: viewDescriptor.focusCommand ? viewDescriptor.focusCommand.id : `${viewDescriptor.id}.focus`,
          title,
          category,
          menu: [{
            id: MenuId.CommandPalette,
            when: viewDescriptor.when
          }],
          keybinding: {
            when: ContextKeyExpr.has(`${viewDescriptor.id}.active`),
            weight: KeybindingWeight.WorkbenchContrib,
            primary: viewDescriptor.focusCommand?.keybindings?.primary,
            secondary: viewDescriptor.focusCommand?.keybindings?.secondary,
            linux: viewDescriptor.focusCommand?.keybindings?.linux,
            mac: viewDescriptor.focusCommand?.keybindings?.mac,
            win: viewDescriptor.focusCommand?.keybindings?.win
          },
          metadata: {
            description: title.value,
            args: [
              {
                name: "focusOptions",
                description: "Focus Options",
                schema: {
                  type: "object",
                  properties: {
                    "preserveFocus": {
                      type: "boolean",
                      default: false
                    }
                  }
                }
              }
            ]
          }
        });
      }
      run(accessor, options) {
        accessor.get(IViewsService).openView(viewDescriptor.id, !options?.preserveFocus);
      }
    });
  }
  registerResetViewLocationAction(viewDescriptor) {
    return registerAction2(class ResetViewLocationAction extends Action2 {
      constructor() {
        super({
          id: `${viewDescriptor.id}.resetViewLocation`,
          title: localize2("resetViewLocation", "Reset Location"),
          menu: [{
            id: MenuId.ViewTitleContext,
            when: ContextKeyExpr.or(
              ContextKeyExpr.and(
                ContextKeyExpr.equals("view", viewDescriptor.id),
                ContextKeyExpr.equals(`${viewDescriptor.id}.defaultViewLocation`, false)
              )
            ),
            group: "1_hide",
            order: 2
          }]
        });
      }
      run(accessor) {
        const viewDescriptorService = accessor.get(IViewDescriptorService);
        const defaultContainer = viewDescriptorService.getDefaultContainerById(viewDescriptor.id);
        const containerModel = viewDescriptorService.getViewContainerModel(defaultContainer);
        if (defaultContainer.hideIfEmpty && containerModel.visibleViewDescriptors.length === 0) {
          const defaultLocation = viewDescriptorService.getDefaultViewContainerLocation(defaultContainer);
          viewDescriptorService.moveViewContainerToLocation(defaultContainer, defaultLocation, void 0, this.desc.id);
        }
        viewDescriptorService.moveViewsToContainer([viewDescriptor], defaultContainer, void 0, this.desc.id);
        accessor.get(IViewsService).openView(viewDescriptor.id, true);
      }
    });
  }
  registerPaneComposite(viewContainer, viewContainerLocation) {
    const that = this;
    let PaneContainer = class extends PaneComposite {
      constructor(telemetryService, contextService, storageService, instantiationService, themeService, contextMenuService, extensionService) {
        super(viewContainer.id, telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService);
      }
      createViewPaneContainer(element) {
        const viewPaneContainerDisposables = this._register(new DisposableStore());
        const viewPaneContainer = that.createViewPaneContainer(element, viewContainer, viewContainerLocation, viewPaneContainerDisposables, this.instantiationService);
        if (!(viewPaneContainer instanceof FilterViewPaneContainer)) {
          viewPaneContainerDisposables.add(Event.any(viewPaneContainer.onDidAddViews, viewPaneContainer.onDidRemoveViews, viewPaneContainer.onTitleAreaUpdate)(() => {
            this.updateTitleArea();
          }));
        }
        return viewPaneContainer;
      }
    };
    PaneContainer = __decorateClass([
      __decorateParam(0, ITelemetryService),
      __decorateParam(1, IWorkspaceContextService),
      __decorateParam(2, IStorageService),
      __decorateParam(3, IInstantiationService),
      __decorateParam(4, IThemeService),
      __decorateParam(5, IContextMenuService),
      __decorateParam(6, IExtensionService)
    ], PaneContainer);
    Registry.as(getPaneCompositeExtension(viewContainerLocation)).registerPaneComposite(PaneCompositeDescriptor.create(
      PaneContainer,
      viewContainer.id,
      typeof viewContainer.title === "string" ? viewContainer.title : viewContainer.title.value,
      isString(viewContainer.icon) ? viewContainer.icon : void 0,
      viewContainer.order,
      viewContainer.requestedIndex,
      viewContainer.icon instanceof URI ? viewContainer.icon : void 0
    ));
  }
  deregisterPaneComposite(viewContainer, viewContainerLocation) {
    Registry.as(getPaneCompositeExtension(viewContainerLocation)).deregisterPaneComposite(viewContainer.id);
  }
  createViewPaneContainer(element, viewContainer, viewContainerLocation, disposables, instantiationService) {
    const viewPaneContainer = instantiationService.createInstance(viewContainer.ctorDescriptor.ctor, ...viewContainer.ctorDescriptor.staticArguments || []);
    this.viewPaneContainers.set(viewPaneContainer.getId(), viewPaneContainer);
    disposables.add(toDisposable(() => this.viewPaneContainers.delete(viewPaneContainer.getId())));
    disposables.add(viewPaneContainer.onDidAddViews((views) => this.onViewsAdded(views)));
    disposables.add(viewPaneContainer.onDidChangeViewVisibility((view) => this.onViewsVisibilityChanged(view, view.isBodyVisible())));
    disposables.add(viewPaneContainer.onDidRemoveViews((views) => this.onViewsRemoved(views)));
    disposables.add(viewPaneContainer.onDidFocusView((view) => {
      if (this.focusedViewContextKey.get() !== view.id) {
        this.focusedViewContextKey.set(view.id);
        this._onDidChangeFocusedView.fire();
      }
    }));
    disposables.add(viewPaneContainer.onDidBlurView((view) => {
      if (this.focusedViewContextKey.get() === view.id) {
        this.focusedViewContextKey.reset();
        this._onDidChangeFocusedView.fire();
      }
    }));
    return viewPaneContainer;
  }
};
ViewsService = __decorateClass([
  __decorateParam(0, IViewDescriptorService),
  __decorateParam(1, IPaneCompositePartService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IWorkbenchLayoutService),
  __decorateParam(4, IEditorService)
], ViewsService);
function getEnabledViewContainerContextKey(viewContainerId) {
  return `viewContainer.${viewContainerId}.enabled`;
}
function getPaneCompositeExtension(viewContainerLocation) {
  switch (viewContainerLocation) {
    case ViewContainerLocation.AuxiliaryBar:
      return PaneCompositeExtensions.Auxiliary;
    case ViewContainerLocation.Panel:
      return PaneCompositeExtensions.Panels;
    case ViewContainerLocation.Sidebar:
    default:
      return PaneCompositeExtensions.Viewlets;
  }
}
function getPartByLocation(viewContainerLocation) {
  switch (viewContainerLocation) {
    case ViewContainerLocation.AuxiliaryBar:
      return Parts.AUXILIARYBAR_PART;
    case ViewContainerLocation.Panel:
      return Parts.PANEL_PART;
    case ViewContainerLocation.Sidebar:
    default:
      return Parts.SIDEBAR_PART;
  }
}
registerSingleton(
  IViewsService,
  ViewsService,
  InstantiationType.Eager
  /* Eager because it registers viewlets and panels in the constructor which are required during workbench layout */
);
export {
  ViewsService,
  getPartByLocation
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdmlld3MvYnJvd3Nlci92aWV3c1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIERpc3Bvc2FibGVNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgVmlld0NvbnRhaW5lciwgSVZpZXdEZXNjcmlwdG9yLCBJVmlldywgVmlld0NvbnRhaW5lckxvY2F0aW9uLCBJVmlld1BhbmVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgRm9jdXNlZFZpZXdDb250ZXh0LCBnZXRWaXNiaWxlVmlld0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yLCBBY3Rpb24yLCBNZW51UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IsIElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgVmlld1BhbmVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lQ29udGFpbmVyLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFBhbmVDb21wb3NpdGVEZXNjcmlwdG9yLCBQYW5lQ29tcG9zaXRlUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgUGFuZUNvbXBvc2l0ZUV4dGVuc2lvbnMsIFBhbmVDb21wb3NpdGUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhbmVjb21wb3NpdGUuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIFBhcnRzIH0gZnJvbSAnLi4vLi4vbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzSW5kaWNhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgRmlsdGVyVmlld1BhbmVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdzVmlld2xldC5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGFuZWNvbXBvc2l0ZS9icm93c2VyL3BhbmVjb21wb3NpdGUuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRBY3Rpb25UaXRsZSwgSUxvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFZpZXdzU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVmlld3NTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdEaXNwb3NhYmxlOiBNYXA8SVZpZXdEZXNjcmlwdG9yLCBJRGlzcG9zYWJsZT47XG5cdHByaXZhdGUgcmVhZG9ubHkgdmlld1BhbmVDb250YWluZXJzOiBNYXA8c3RyaW5nLCBWaWV3UGFuZUNvbnRhaW5lcj47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRW1pdHRlcjx7IGlkOiBzdHJpbmc7IHZpc2libGU6IGJvb2xlYW4gfT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGlkOiBzdHJpbmc7IHZpc2libGU6IGJvb2xlYW4gfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50PHsgaWQ6IHN0cmluZzsgdmlzaWJsZTogYm9vbGVhbiB9PiA9IHRoaXMuX29uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHkuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgaWQ6IHN0cmluZzsgdmlzaWJsZTogYm9vbGVhbjsgbG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eSA9IHRoaXMuX29uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHkuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VGb2N1c2VkVmlldyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZvY3VzZWRWaWV3ID0gdGhpcy5fb25EaWRDaGFuZ2VGb2N1c2VkVmlldy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdDb250YWluZXJEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGVuYWJsZWRWaWV3Q29udGFpbmVyc0NvbnRleHRLZXlzOiBNYXA8c3RyaW5nLCBJQ29udGV4dEtleTxib29sZWFuPj47XG5cdHByaXZhdGUgcmVhZG9ubHkgdmlzaWJsZVZpZXdDb250ZXh0S2V5czogTWFwPHN0cmluZywgSUNvbnRleHRLZXk8Ym9vbGVhbj4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGZvY3VzZWRWaWV3Q29udGV4dEtleTogSUNvbnRleHRLZXk8c3RyaW5nPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhbmVDb21wb3NpdGVTZXJ2aWNlOiBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnZpZXdEaXNwb3NhYmxlID0gbmV3IE1hcDxJVmlld0Rlc2NyaXB0b3IsIElEaXNwb3NhYmxlPigpO1xuXHRcdHRoaXMuZW5hYmxlZFZpZXdDb250YWluZXJzQ29udGV4dEtleXMgPSBuZXcgTWFwPHN0cmluZywgSUNvbnRleHRLZXk8Ym9vbGVhbj4+KCk7XG5cdFx0dGhpcy52aXNpYmxlVmlld0NvbnRleHRLZXlzID0gbmV3IE1hcDxzdHJpbmcsIElDb250ZXh0S2V5PGJvb2xlYW4+PigpO1xuXHRcdHRoaXMudmlld1BhbmVDb250YWluZXJzID0gbmV3IE1hcDxzdHJpbmcsIFZpZXdQYW5lQ29udGFpbmVyPigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMudmlld0Rpc3Bvc2FibGUuZm9yRWFjaChkaXNwb3NhYmxlID0+IGRpc3Bvc2FibGUuZGlzcG9zZSgpKTtcblx0XHRcdHRoaXMudmlld0Rpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS52aWV3Q29udGFpbmVycy5mb3JFYWNoKHZpZXdDb250YWluZXIgPT4gdGhpcy5vbkRpZFJlZ2lzdGVyVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyLCB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcikhKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2Uub25EaWRDaGFuZ2VWaWV3Q29udGFpbmVycygoeyBhZGRlZCwgcmVtb3ZlZCB9KSA9PiB0aGlzLm9uRGlkQ2hhbmdlQ29udGFpbmVycyhhZGRlZCwgcmVtb3ZlZCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5vbkRpZENoYW5nZUNvbnRhaW5lckxvY2F0aW9uKCh7IHZpZXdDb250YWluZXIsIGZyb20sIHRvIH0pID0+IHRoaXMub25EaWRDaGFuZ2VDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyLCBmcm9tLCB0bykpKTtcblxuXHRcdC8vIFZpZXcgQ29udGFpbmVyIFZpc2liaWxpdHlcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLm9uRGlkUGFuZUNvbXBvc2l0ZU9wZW4oZSA9PiB0aGlzLl9vbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5LmZpcmUoeyBpZDogZS5jb21wb3NpdGUuZ2V0SWQoKSwgdmlzaWJsZTogdHJ1ZSwgbG9jYXRpb246IGUudmlld0NvbnRhaW5lckxvY2F0aW9uIH0pKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5vbkRpZFBhbmVDb21wb3NpdGVDbG9zZShlID0+IHRoaXMuX29uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHkuZmlyZSh7IGlkOiBlLmNvbXBvc2l0ZS5nZXRJZCgpLCB2aXNpYmxlOiBmYWxzZSwgbG9jYXRpb246IGUudmlld0NvbnRhaW5lckxvY2F0aW9uIH0pKSk7XG5cblx0XHR0aGlzLmZvY3VzZWRWaWV3Q29udGV4dEtleSA9IEZvY3VzZWRWaWV3Q29udGV4dC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblZpZXdzQWRkZWQoYWRkZWQ6IElWaWV3W10pOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHZpZXcgb2YgYWRkZWQpIHtcblx0XHRcdHRoaXMub25WaWV3c1Zpc2liaWxpdHlDaGFuZ2VkKHZpZXcsIHZpZXcuaXNCb2R5VmlzaWJsZSgpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uVmlld3NWaXNpYmlsaXR5Q2hhbmdlZCh2aWV3OiBJVmlldywgdmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuZ2V0T3JDcmVhdGVBY3RpdmVWaWV3Q29udGV4dEtleSh2aWV3KS5zZXQodmlzaWJsZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eS5maXJlKHsgaWQ6IHZpZXcuaWQsIHZpc2libGU6IHZpc2libGUgfSk7XG5cdH1cblxuXHRwcml2YXRlIG9uVmlld3NSZW1vdmVkKHJlbW92ZWQ6IElWaWV3W10pOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHZpZXcgb2YgcmVtb3ZlZCkge1xuXHRcdFx0dGhpcy5vblZpZXdzVmlzaWJpbGl0eUNoYW5nZWQodmlldywgZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0T3JDcmVhdGVBY3RpdmVWaWV3Q29udGV4dEtleSh2aWV3OiBJVmlldyk6IElDb250ZXh0S2V5PGJvb2xlYW4+IHtcblx0XHRjb25zdCB2aXNpYmxlQ29udGV4dEtleUlkID0gZ2V0VmlzYmlsZVZpZXdDb250ZXh0S2V5KHZpZXcuaWQpO1xuXHRcdGxldCBjb250ZXh0S2V5ID0gdGhpcy52aXNpYmxlVmlld0NvbnRleHRLZXlzLmdldCh2aXNpYmxlQ29udGV4dEtleUlkKTtcblx0XHRpZiAoIWNvbnRleHRLZXkpIHtcblx0XHRcdGNvbnRleHRLZXkgPSBuZXcgUmF3Q29udGV4dEtleSh2aXNpYmxlQ29udGV4dEtleUlkLCBmYWxzZSkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0dGhpcy52aXNpYmxlVmlld0NvbnRleHRLZXlzLnNldCh2aXNpYmxlQ29udGV4dEtleUlkLCBjb250ZXh0S2V5KTtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbnRleHRLZXk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlQ29udGFpbmVycyhhZGRlZDogUmVhZG9ubHlBcnJheTx7IGNvbnRhaW5lcjogVmlld0NvbnRhaW5lcjsgbG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiB9PiwgcmVtb3ZlZDogUmVhZG9ubHlBcnJheTx7IGNvbnRhaW5lcjogVmlld0NvbnRhaW5lcjsgbG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiB9Pik6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgeyBjb250YWluZXIsIGxvY2F0aW9uIH0gb2YgcmVtb3ZlZCkge1xuXHRcdFx0dGhpcy5vbkRpZERlcmVnaXN0ZXJWaWV3Q29udGFpbmVyKGNvbnRhaW5lciwgbG9jYXRpb24pO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IHsgY29udGFpbmVyLCBsb2NhdGlvbiB9IG9mIGFkZGVkKSB7XG5cdFx0XHR0aGlzLm9uRGlkUmVnaXN0ZXJWaWV3Q29udGFpbmVyKGNvbnRhaW5lciwgbG9jYXRpb24pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRSZWdpc3RlclZpZXdDb250YWluZXIodmlld0NvbnRhaW5lcjogVmlld0NvbnRhaW5lciwgdmlld0NvbnRhaW5lckxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLnJlZ2lzdGVyUGFuZUNvbXBvc2l0ZSh2aWV3Q29udGFpbmVyLCB2aWV3Q29udGFpbmVyTG9jYXRpb24pO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lck1vZGVsID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIpO1xuXHRcdHRoaXMub25WaWV3RGVzY3JpcHRvcnNBZGRlZCh2aWV3Q29udGFpbmVyTW9kZWwuYWxsVmlld0Rlc2NyaXB0b3JzLCB2aWV3Q29udGFpbmVyKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodmlld0NvbnRhaW5lck1vZGVsLm9uRGlkQ2hhbmdlQWxsVmlld0Rlc2NyaXB0b3JzKCh7IGFkZGVkLCByZW1vdmVkIH0pID0+IHtcblx0XHRcdHRoaXMub25WaWV3RGVzY3JpcHRvcnNBZGRlZChhZGRlZCwgdmlld0NvbnRhaW5lcik7XG5cdFx0XHR0aGlzLm9uVmlld0Rlc2NyaXB0b3JzUmVtb3ZlZChyZW1vdmVkKTtcblx0XHR9KSk7XG5cdFx0dGhpcy51cGRhdGVWaWV3Q29udGFpbmVyRW5hYmxlbWVudENvbnRleHRLZXkodmlld0NvbnRhaW5lcik7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHZpZXdDb250YWluZXJNb2RlbC5vbkRpZENoYW5nZUFjdGl2ZVZpZXdEZXNjcmlwdG9ycygoKSA9PiB0aGlzLnVwZGF0ZVZpZXdDb250YWluZXJFbmFibGVtZW50Q29udGV4dEtleSh2aWV3Q29udGFpbmVyKSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLnJlZ2lzdGVyT3BlblZpZXdDb250YWluZXJBY3Rpb24odmlld0NvbnRhaW5lcikpO1xuXG5cdFx0dGhpcy52aWV3Q29udGFpbmVyRGlzcG9zYWJsZXMuc2V0KHZpZXdDb250YWluZXIuaWQsIGRpc3Bvc2FibGVzKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWREZXJlZ2lzdGVyVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyLCB2aWV3Q29udGFpbmVyTG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuZGVyZWdpc3RlclBhbmVDb21wb3NpdGUodmlld0NvbnRhaW5lciwgdmlld0NvbnRhaW5lckxvY2F0aW9uKTtcblx0XHR0aGlzLnZpZXdDb250YWluZXJEaXNwb3NhYmxlcy5kZWxldGVBbmREaXNwb3NlKHZpZXdDb250YWluZXIuaWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZUNvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIsIGZyb206IFZpZXdDb250YWluZXJMb2NhdGlvbiwgdG86IFZpZXdDb250YWluZXJMb2NhdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuZGVyZWdpc3RlclBhbmVDb21wb3NpdGUodmlld0NvbnRhaW5lciwgZnJvbSk7XG5cdFx0dGhpcy5yZWdpc3RlclBhbmVDb21wb3NpdGUodmlld0NvbnRhaW5lciwgdG8pO1xuXG5cdFx0Ly8gT3BlbiB2aWV3IGNvbnRhaW5lciBpZiBwYXJ0IGlzIHZpc2libGUgYW5kIHRoZXJlIGlzIG9ubHkgb25lIHZpZXcgY29udGFpbmVyIGluIGxvY2F0aW9uXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5sYXlvdXRTZXJ2aWNlLmlzVmlzaWJsZShnZXRQYXJ0QnlMb2NhdGlvbih0bykpICYmXG5cdFx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyc0J5TG9jYXRpb24odG8pLmZpbHRlcih2YyA9PiB0aGlzLmlzVmlld0NvbnRhaW5lckFjdGl2ZSh2Yy5pZCkpLmxlbmd0aCA9PT0gMVxuXHRcdCkge1xuXHRcdFx0dGhpcy5vcGVuVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyLmlkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uVmlld0Rlc2NyaXB0b3JzQWRkZWQodmlld3M6IFJlYWRvbmx5QXJyYXk8SVZpZXdEZXNjcmlwdG9yPiwgY29udGFpbmVyOiBWaWV3Q29udGFpbmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgbG9jYXRpb24gPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24oY29udGFpbmVyKTtcblx0XHRpZiAobG9jYXRpb24gPT09IG51bGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHZpZXdEZXNjcmlwdG9yIG9mIHZpZXdzKSB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLnJlZ2lzdGVyT3BlblZpZXdBY3Rpb24odmlld0Rlc2NyaXB0b3IpKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLnJlZ2lzdGVyRm9jdXNWaWV3QWN0aW9uKHZpZXdEZXNjcmlwdG9yLCBjb250YWluZXIudGl0bGUpKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLnJlZ2lzdGVyUmVzZXRWaWV3TG9jYXRpb25BY3Rpb24odmlld0Rlc2NyaXB0b3IpKTtcblx0XHRcdHRoaXMudmlld0Rpc3Bvc2FibGUuc2V0KHZpZXdEZXNjcmlwdG9yLCBkaXNwb3NhYmxlcyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblZpZXdEZXNjcmlwdG9yc1JlbW92ZWQodmlld3M6IFJlYWRvbmx5QXJyYXk8SVZpZXdEZXNjcmlwdG9yPik6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgdmlldyBvZiB2aWV3cykge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXMudmlld0Rpc3Bvc2FibGUuZ2V0KHZpZXcpO1xuXHRcdFx0aWYgKGRpc3Bvc2FibGUpIHtcblx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMudmlld0Rpc3Bvc2FibGUuZGVsZXRlKHZpZXcpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVmlld0NvbnRhaW5lckVuYWJsZW1lbnRDb250ZXh0S2V5KHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiB2b2lkIHtcblx0XHRsZXQgY29udGV4dEtleSA9IHRoaXMuZW5hYmxlZFZpZXdDb250YWluZXJzQ29udGV4dEtleXMuZ2V0KHZpZXdDb250YWluZXIuaWQpO1xuXHRcdGlmICghY29udGV4dEtleSkge1xuXHRcdFx0Y29udGV4dEtleSA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5KGdldEVuYWJsZWRWaWV3Q29udGFpbmVyQ29udGV4dEtleSh2aWV3Q29udGFpbmVyLmlkKSwgZmFsc2UpO1xuXHRcdFx0dGhpcy5lbmFibGVkVmlld0NvbnRhaW5lcnNDb250ZXh0S2V5cy5zZXQodmlld0NvbnRhaW5lci5pZCwgY29udGV4dEtleSk7XG5cdFx0fVxuXHRcdGNvbnRleHRLZXkuc2V0KCEodmlld0NvbnRhaW5lci5oaWRlSWZFbXB0eSAmJiB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lcikuYWN0aXZlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCA9PT0gMCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuQ29tcG9zaXRlKGNvbXBvc2l0ZUlkOiBzdHJpbmcsIGxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24sIGZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8SVBhbmVDb21wb3NpdGUgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZShjb21wb3NpdGVJZCwgbG9jYXRpb24sIGZvY3VzKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29tcG9zaXRlKGNvbXBvc2l0ZUlkOiBzdHJpbmcsIGxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24pOiB7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5nZXRQYW5lQ29tcG9zaXRlKGNvbXBvc2l0ZUlkLCBsb2NhdGlvbik7XG5cdH1cblxuXHQvLyBPbmUgdmlldyBjb250YWluZXIgY2FuIGJlIHZpc2libGUgYXQgYSB0aW1lIGluIGEgbG9jYXRpb25cblx0aXNWaWV3Q29udGFpbmVyVmlzaWJsZShpZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKGlkKTtcblx0XHRpZiAoIXZpZXdDb250YWluZXIpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCB2aWV3Q29udGFpbmVyTG9jYXRpb24gPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcik7XG5cdFx0aWYgKHZpZXdDb250YWluZXJMb2NhdGlvbiA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUodmlld0NvbnRhaW5lckxvY2F0aW9uKT8uZ2V0SWQoKSA9PT0gaWQ7XG5cdH1cblxuXHQvLyBNdWx0aXBsZSB2aWV3IGNvbnRhaW5lcnMgY2FuIGJlIGFjdGl2ZS9pbmFjdGl2ZSBhdCBhIHRpbWUgaW4gYSBsb2NhdGlvblxuXHRpc1ZpZXdDb250YWluZXJBY3RpdmUoaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHZpZXdDb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChpZCk7XG5cdFx0aWYgKCF2aWV3Q29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCF2aWV3Q29udGFpbmVyLmhpZGVJZkVtcHR5KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIpLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5sZW5ndGggPiAwO1xuXHR9XG5cblx0Z2V0VmlzaWJsZVZpZXdDb250YWluZXIobG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IFZpZXdDb250YWluZXIgfCBudWxsIHtcblx0XHRjb25zdCB2aWV3Q29udGFpbmVySWQgPSB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUobG9jYXRpb24pPy5nZXRJZCgpO1xuXHRcdHJldHVybiB2aWV3Q29udGFpbmVySWQgPyB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZCh2aWV3Q29udGFpbmVySWQpIDogbnVsbDtcblx0fVxuXG5cdGdldEFjdGl2ZVZpZXdQYW5lQ29udGFpbmVyV2l0aElkKHZpZXdDb250YWluZXJJZDogc3RyaW5nKTogSVZpZXdQYW5lQ29udGFpbmVyIHwgbnVsbCB7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKHZpZXdDb250YWluZXJJZCk7XG5cdFx0cmV0dXJuIHZpZXdDb250YWluZXIgPyB0aGlzLmdldEFjdGl2ZVZpZXdQYW5lQ29udGFpbmVyKHZpZXdDb250YWluZXIpIDogbnVsbDtcblx0fVxuXG5cdGFzeW5jIG9wZW5WaWV3Q29udGFpbmVyKGlkOiBzdHJpbmcsIGZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8SVBhbmVDb21wb3NpdGUgfCBudWxsPiB7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKGlkKTtcblx0XHRpZiAodmlld0NvbnRhaW5lcikge1xuXHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lckxvY2F0aW9uID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIpO1xuXHRcdFx0aWYgKHZpZXdDb250YWluZXJMb2NhdGlvbiAhPT0gbnVsbCkge1xuXHRcdFx0XHRjb25zdCBwYW5lQ29tcG9zaXRlID0gYXdhaXQgdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZShpZCwgdmlld0NvbnRhaW5lckxvY2F0aW9uLCBmb2N1cyk7XG5cdFx0XHRcdHJldHVybiBwYW5lQ29tcG9zaXRlIHx8IG51bGw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRhc3luYyBjbG9zZVZpZXdDb250YWluZXIoaWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZpZXdDb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChpZCk7XG5cdFx0aWYgKHZpZXdDb250YWluZXIpIHtcblx0XHRcdGNvbnN0IHZpZXdDb250YWluZXJMb2NhdGlvbiA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKTtcblx0XHRcdGNvbnN0IGlzQWN0aXZlID0gdmlld0NvbnRhaW5lckxvY2F0aW9uICE9PSBudWxsICYmIHRoaXMucGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZSh2aWV3Q29udGFpbmVyTG9jYXRpb24pO1xuXHRcdFx0aWYgKHZpZXdDb250YWluZXJMb2NhdGlvbiAhPT0gbnVsbCkge1xuXHRcdFx0XHRyZXR1cm4gaXNBY3RpdmUgPyB0aGlzLmxheW91dFNlcnZpY2Uuc2V0UGFydEhpZGRlbih0cnVlLCBnZXRQYXJ0QnlMb2NhdGlvbih2aWV3Q29udGFpbmVyTG9jYXRpb24pKSA6IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpc1ZpZXdWaXNpYmxlKGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCBhY3RpdmVWaWV3ID0gdGhpcy5nZXRBY3RpdmVWaWV3V2l0aElkKGlkKTtcblx0XHRyZXR1cm4gYWN0aXZlVmlldz8uaXNCb2R5VmlzaWJsZSgpIHx8IGZhbHNlO1xuXHR9XG5cblx0Z2V0QWN0aXZlVmlld1dpdGhJZDxUIGV4dGVuZHMgSVZpZXc+KGlkOiBzdHJpbmcpOiBUIHwgbnVsbCB7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeVZpZXdJZChpZCk7XG5cdFx0aWYgKHZpZXdDb250YWluZXIpIHtcblx0XHRcdGNvbnN0IGFjdGl2ZVZpZXdQYW5lQ29udGFpbmVyID0gdGhpcy5nZXRBY3RpdmVWaWV3UGFuZUNvbnRhaW5lcih2aWV3Q29udGFpbmVyKTtcblx0XHRcdGlmIChhY3RpdmVWaWV3UGFuZUNvbnRhaW5lcikge1xuXHRcdFx0XHRyZXR1cm4gYWN0aXZlVmlld1BhbmVDb250YWluZXIuZ2V0VmlldyhpZCkgYXMgVDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRnZXRWaWV3V2l0aElkPFQgZXh0ZW5kcyBJVmlldz4oaWQ6IHN0cmluZyk6IFQgfCBudWxsIHtcblx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKGlkKTtcblx0XHRpZiAodmlld0NvbnRhaW5lcikge1xuXHRcdFx0Y29uc3Qgdmlld1BhbmVDb250YWluZXI6IElWaWV3UGFuZUNvbnRhaW5lciB8IHVuZGVmaW5lZCA9IHRoaXMudmlld1BhbmVDb250YWluZXJzLmdldCh2aWV3Q29udGFpbmVyLmlkKTtcblx0XHRcdGlmICh2aWV3UGFuZUNvbnRhaW5lcikge1xuXHRcdFx0XHRyZXR1cm4gdmlld1BhbmVDb250YWluZXIuZ2V0VmlldyhpZCkgYXMgVDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRnZXRGb2N1c2VkVmlldygpOiBJVmlld0Rlc2NyaXB0b3IgfCBudWxsIHtcblx0XHRjb25zdCB2aWV3SWQ6IHN0cmluZyA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dEtleVZhbHVlKEZvY3VzZWRWaWV3Q29udGV4dC5rZXkpID8/ICcnO1xuXHRcdHJldHVybiB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3RGVzY3JpcHRvckJ5SWQodmlld0lkLnRvU3RyaW5nKCkpO1xuXHR9XG5cblx0Z2V0Rm9jdXNlZFZpZXdOYW1lKCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgdGV4dEVkaXRvckZvY3VzZWQgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w/Lmhhc1RleHRGb2N1cygpID8gbG9jYWxpemUoJ2VkaXRvcicsIFwiVGV4dCBFZGl0b3JcIikgOiB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0Rm9jdXNlZFZpZXcoKT8ubmFtZT8udmFsdWUgPz8gdGV4dEVkaXRvckZvY3VzZWQgPz8gJyc7XG5cdH1cblxuXHRhc3luYyBvcGVuVmlldzxUIGV4dGVuZHMgSVZpZXc+KGlkOiBzdHJpbmcsIGZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8VCB8IG51bGw+IHtcblx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKGlkKTtcblx0XHRpZiAoIXZpZXdDb250YWluZXIpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lck1vZGVsKHZpZXdDb250YWluZXIpLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5zb21lKHZpZXdEZXNjcmlwdG9yID0+IHZpZXdEZXNjcmlwdG9yLmlkID09PSBpZCkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxvY2F0aW9uID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIpO1xuXHRcdGNvbnN0IGNvbXBvc2l0ZURlc2NyaXB0b3IgPSB0aGlzLmdldENvbXBvc2l0ZSh2aWV3Q29udGFpbmVyLmlkLCBsb2NhdGlvbiEpO1xuXHRcdGlmIChjb21wb3NpdGVEZXNjcmlwdG9yKSB7XG5cdFx0XHRjb25zdCBwYW5lQ29tcG9zaXRlID0gYXdhaXQgdGhpcy5vcGVuQ29tcG9zaXRlKGNvbXBvc2l0ZURlc2NyaXB0b3IuaWQsIGxvY2F0aW9uISkgYXMgSVBhbmVDb21wb3NpdGUgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAocGFuZUNvbXBvc2l0ZSAmJiBwYW5lQ29tcG9zaXRlLm9wZW5WaWV3KSB7XG5cdFx0XHRcdHJldHVybiBwYW5lQ29tcG9zaXRlLm9wZW5WaWV3PFQ+KGlkLCBmb2N1cykgfHwgbnVsbDtcblx0XHRcdH0gZWxzZSBpZiAoZm9jdXMpIHtcblx0XHRcdFx0cGFuZUNvbXBvc2l0ZT8uZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNsb3NlVmlldyhpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeVZpZXdJZChpZCk7XG5cdFx0aWYgKHZpZXdDb250YWluZXIpIHtcblx0XHRcdGNvbnN0IGFjdGl2ZVZpZXdQYW5lQ29udGFpbmVyID0gdGhpcy5nZXRBY3RpdmVWaWV3UGFuZUNvbnRhaW5lcih2aWV3Q29udGFpbmVyKTtcblx0XHRcdGlmIChhY3RpdmVWaWV3UGFuZUNvbnRhaW5lcikge1xuXHRcdFx0XHRjb25zdCB2aWV3ID0gYWN0aXZlVmlld1BhbmVDb250YWluZXIuZ2V0VmlldyhpZCk7XG5cdFx0XHRcdGlmICh2aWV3KSB7XG5cdFx0XHRcdFx0aWYgKGFjdGl2ZVZpZXdQYW5lQ29udGFpbmVyLnZpZXdzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbG9jYXRpb24gPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcik7XG5cdFx0XHRcdFx0XHRpZiAobG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMubGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKHRydWUsIFBhcnRzLlNJREVCQVJfUEFSVCk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGxvY2F0aW9uID09PSBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwgfHwgbG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5oaWRlQWN0aXZlUGFuZUNvbXBvc2l0ZShsb2NhdGlvbik7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIFRoZSBibHVyIGV2ZW50IGRvZXNuJ3QgZmlyZSBvbiBXZWJLaXQgd2hlbiB0aGUgZm9jdXNlZCBlbGVtZW50IGlzIGhpZGRlbixcblx0XHRcdFx0XHRcdC8vIHNvIHRoZSBjb250ZXh0IGtleSBuZWVkcyB0byBiZSBmb3JjZWQgaGVyZSB0b28gb3RoZXJ3aXNlIGEgdmlldyBtYXkgc3RpbGxcblx0XHRcdFx0XHRcdC8vIHRoaW5rIGl0J3Mgc2hvd2luZywgYnJlYWtpbmcgdG9nZ2xlIGNvbW1hbmRzLlxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuZm9jdXNlZFZpZXdDb250ZXh0S2V5LmdldCgpID09PSBpZCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmZvY3VzZWRWaWV3Q29udGV4dEtleS5yZXNldCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2aWV3LnNldEV4cGFuZGVkKGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldEFjdGl2ZVZpZXdQYW5lQ29udGFpbmVyKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiBJVmlld1BhbmVDb250YWluZXIgfCBudWxsIHtcblx0XHRjb25zdCBsb2NhdGlvbiA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKTtcblx0XHRpZiAobG9jYXRpb24gPT09IG51bGwpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZVBhbmVDb21wb3NpdGUgPSB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUobG9jYXRpb24pO1xuXHRcdGlmIChhY3RpdmVQYW5lQ29tcG9zaXRlPy5nZXRJZCgpID09PSB2aWV3Q29udGFpbmVyLmlkKSB7XG5cdFx0XHRyZXR1cm4gYWN0aXZlUGFuZUNvbXBvc2l0ZS5nZXRWaWV3UGFuZUNvbnRhaW5lcigpIHx8IG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRnZXRWaWV3UHJvZ3Jlc3NJbmRpY2F0b3Iodmlld0lkOiBzdHJpbmcpOiBJUHJvZ3Jlc3NJbmRpY2F0b3IgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHZpZXdDb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodmlld0lkKTtcblx0XHRpZiAoIXZpZXdDb250YWluZXIpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld1BhbmVDb250YWluZXIgPSB0aGlzLnZpZXdQYW5lQ29udGFpbmVycy5nZXQodmlld0NvbnRhaW5lci5pZCk7XG5cdFx0aWYgKCF2aWV3UGFuZUNvbnRhaW5lcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCB2aWV3ID0gdmlld1BhbmVDb250YWluZXIuZ2V0Vmlldyh2aWV3SWQpO1xuXHRcdGlmICghdmlldykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAodmlld1BhbmVDb250YWluZXIuaXNWaWV3TWVyZ2VkV2l0aENvbnRhaW5lcigpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRWaWV3Q29udGFpbmVyUHJvZ3Jlc3NJbmRpY2F0b3Iodmlld0NvbnRhaW5lcik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZpZXcuZ2V0UHJvZ3Jlc3NJbmRpY2F0b3IoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Vmlld0NvbnRhaW5lclByb2dyZXNzSW5kaWNhdG9yKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIpOiBJUHJvZ3Jlc3NJbmRpY2F0b3IgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHZpZXdDb250YWluZXJMb2NhdGlvbiA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKTtcblx0XHRpZiAodmlld0NvbnRhaW5lckxvY2F0aW9uID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldFByb2dyZXNzSW5kaWNhdG9yKHZpZXdDb250YWluZXIuaWQsIHZpZXdDb250YWluZXJMb2NhdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyT3BlblZpZXdDb250YWluZXJBY3Rpb24odmlld0NvbnRhaW5lcjogVmlld0NvbnRhaW5lcik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpZiAodmlld0NvbnRhaW5lci5vcGVuQ29tbWFuZEFjdGlvbkRlc2NyaXB0b3IpIHtcblx0XHRcdGNvbnN0IHsgaWQsIG1uZW1vbmljVGl0bGUsIGtleWJpbmRpbmdzLCBvcmRlciB9ID0gdmlld0NvbnRhaW5lci5vcGVuQ29tbWFuZEFjdGlvbkRlc2NyaXB0b3IgPz8geyBpZDogdmlld0NvbnRhaW5lci5pZCB9O1xuXHRcdFx0Y29uc3QgdGl0bGUgPSB2aWV3Q29udGFpbmVyLm9wZW5Db21tYW5kQWN0aW9uRGVzY3JpcHRvci50aXRsZSA/PyB2aWV3Q29udGFpbmVyLnRpdGxlO1xuXHRcdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE9wZW5WaWV3Q29udGFpbmVyQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdGlkLFxuXHRcdFx0XHRcdFx0Z2V0IHRpdGxlKCk6IElDb21tYW5kQWN0aW9uVGl0bGUge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyTG9jYXRpb24gPSB0aGF0LnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odmlld0NvbnRhaW5lcik7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxvY2FsaXplZFRpdGxlID0gdHlwZW9mIHRpdGxlID09PSAnc3RyaW5nJyA/IHRpdGxlIDogdGl0bGUudmFsdWU7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG9yaWdpbmFsVGl0bGUgPSB0eXBlb2YgdGl0bGUgPT09ICdzdHJpbmcnID8gdGl0bGUgOiB0aXRsZS5vcmlnaW5hbDtcblx0XHRcdFx0XHRcdFx0aWYgKHZpZXdDb250YWluZXJMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogbG9jYWxpemUoJ3Nob3cgdmlldycsIFwiU2hvdyB7MH1cIiwgbG9jYWxpemVkVGl0bGUpLCBvcmlnaW5hbDogYFNob3cgJHtvcmlnaW5hbFRpdGxlfWAgfTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogbG9jYWxpemUoJ3RvZ2dsZSB2aWV3JywgXCJUb2dnbGUgezB9XCIsIGxvY2FsaXplZFRpdGxlKSwgb3JpZ2luYWw6IGBUb2dnbGUgJHtvcmlnaW5hbFRpdGxlfWAgfTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmhhcyhnZXRFbmFibGVkVmlld0NvbnRhaW5lckNvbnRleHRLZXkodmlld0NvbnRhaW5lci5pZCkpLFxuXHRcdFx0XHRcdFx0a2V5YmluZGluZzoga2V5YmluZGluZ3MgPyB7IC4uLmtleWJpbmRpbmdzLCB3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiB9IDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwdWJsaWMgYXN5bmMgcnVuKHNlcnZpY2VBY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8YW55PiB7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gc2VydmljZUFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlID0gc2VydmljZUFjY2Vzc29yLmdldChJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gc2VydmljZUFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gc2VydmljZUFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyTG9jYXRpb24gPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIpO1xuXHRcdFx0XHRcdHN3aXRjaCAodmlld0NvbnRhaW5lckxvY2F0aW9uKSB7XG5cdFx0XHRcdFx0XHRjYXNlIFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXI6XG5cdFx0XHRcdFx0XHRjYXNlIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyOiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHBhcnQgPSB2aWV3Q29udGFpbmVyTG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyID8gUGFydHMuU0lERUJBUl9QQVJUIDogUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQ7XG5cdFx0XHRcdFx0XHRcdGlmICghdmlld3NTZXJ2aWNlLmlzVmlld0NvbnRhaW5lclZpc2libGUodmlld0NvbnRhaW5lci5pZCkgfHwgIWxheW91dFNlcnZpY2UuaGFzRm9jdXMocGFydCkpIHtcblx0XHRcdFx0XHRcdFx0XHRhd2FpdCB2aWV3c1NlcnZpY2Uub3BlblZpZXdDb250YWluZXIodmlld0NvbnRhaW5lci5pZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0ZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwLmZvY3VzKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYXNlIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbDpcblx0XHRcdFx0XHRcdFx0aWYgKCF2aWV3c1NlcnZpY2UuaXNWaWV3Q29udGFpbmVyVmlzaWJsZSh2aWV3Q29udGFpbmVyLmlkKSB8fCAhbGF5b3V0U2VydmljZS5oYXNGb2N1cyhQYXJ0cy5QQU5FTF9QQVJUKSkge1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHZpZXdzU2VydmljZS5vcGVuVmlld0NvbnRhaW5lcih2aWV3Q29udGFpbmVyLmlkLCB0cnVlKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHR2aWV3c1NlcnZpY2UuY2xvc2VWaWV3Q29udGFpbmVyKHZpZXdDb250YWluZXIuaWQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRpZiAobW5lbW9uaWNUaXRsZSkge1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0TG9jYXRpb24gPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXREZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIpO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyVmlld01lbnUsIHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZCxcblx0XHRcdFx0XHRcdHRpdGxlOiBtbmVtb25pY1RpdGxlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z3JvdXA6IGRlZmF1bHRMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIgPyAnM19zaWRlYmFyJyA6IGRlZmF1bHRMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhciA/ICc0X2F1eGJhcicgOiAnNV9wYW5lbCcsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuaGFzKGdldEVuYWJsZWRWaWV3Q29udGFpbmVyQ29udGV4dEtleSh2aWV3Q29udGFpbmVyLmlkKSksXG5cdFx0XHRcdFx0b3JkZXI6IG9yZGVyID8/IE51bWJlci5NQVhfVkFMVUVcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJPcGVuVmlld0FjdGlvbih2aWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGlmICh2aWV3RGVzY3JpcHRvci5vcGVuQ29tbWFuZEFjdGlvbkRlc2NyaXB0b3IpIHtcblx0XHRcdGNvbnN0IHRpdGxlID0gdmlld0Rlc2NyaXB0b3Iub3BlbkNvbW1hbmRBY3Rpb25EZXNjcmlwdG9yLnRpdGxlID8/IHZpZXdEZXNjcmlwdG9yLm5hbWU7XG5cdFx0XHRjb25zdCBjb21tYW5kSWQgPSB2aWV3RGVzY3JpcHRvci5vcGVuQ29tbWFuZEFjdGlvbkRlc2NyaXB0b3IuaWQ7XG5cdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RlckFjdGlvbjIoY2xhc3MgT3BlblZpZXdBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdFx0aWQ6IGNvbW1hbmRJZCxcblx0XHRcdFx0XHRcdGdldCB0aXRsZSgpOiBJQ29tbWFuZEFjdGlvblRpdGxlIHtcblx0XHRcdFx0XHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lckxvY2F0aW9uID0gdGhhdC52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0xvY2F0aW9uQnlJZCh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxvY2FsaXplZFRpdGxlID0gdHlwZW9mIHRpdGxlID09PSAnc3RyaW5nJyA/IHRpdGxlIDogdGl0bGUudmFsdWU7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG9yaWdpbmFsVGl0bGUgPSB0eXBlb2YgdGl0bGUgPT09ICdzdHJpbmcnID8gdGl0bGUgOiB0aXRsZS5vcmlnaW5hbDtcblx0XHRcdFx0XHRcdFx0aWYgKHZpZXdDb250YWluZXJMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogbG9jYWxpemUoJ3Nob3cgdmlldycsIFwiU2hvdyB7MH1cIiwgbG9jYWxpemVkVGl0bGUpLCBvcmlnaW5hbDogYFNob3cgJHtvcmlnaW5hbFRpdGxlfWAgfTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogbG9jYWxpemUoJ3RvZ2dsZSB2aWV3JywgXCJUb2dnbGUgezB9XCIsIGxvY2FsaXplZFRpdGxlKSwgb3JpZ2luYWw6IGBUb2dnbGUgJHtvcmlnaW5hbFRpdGxlfWAgfTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmhhcyhgJHt2aWV3RGVzY3JpcHRvci5pZH0uYWN0aXZlYCksXG5cdFx0XHRcdFx0XHRrZXliaW5kaW5nOiB2aWV3RGVzY3JpcHRvci5vcGVuQ29tbWFuZEFjdGlvbkRlc2NyaXB0b3IhLmtleWJpbmRpbmdzID8geyAuLi52aWV3RGVzY3JpcHRvci5vcGVuQ29tbWFuZEFjdGlvbkRlc2NyaXB0b3IhLmtleWJpbmRpbmdzLCB3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiB9IDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwdWJsaWMgYXN5bmMgcnVuKHNlcnZpY2VBY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8YW55PiB7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gc2VydmljZUFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlID0gc2VydmljZUFjY2Vzc29yLmdldChJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gc2VydmljZUFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gc2VydmljZUFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IHNlcnZpY2VBY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdFx0XHRcdGNvbnN0IGZvY3VzZWRWaWV3SWQgPSBGb2N1c2VkVmlld0NvbnRleHQuZ2V0VmFsdWUoY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0XHRcdGlmIChmb2N1c2VkVmlld0lkID09PSB2aWV3RGVzY3JpcHRvci5pZCkge1xuXG5cdFx0XHRcdFx0XHRjb25zdCB2aWV3TG9jYXRpb24gPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0xvY2F0aW9uQnlJZCh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdFx0XHRpZiAodmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdMb2NhdGlvbkJ5SWQodmlld0Rlc2NyaXB0b3IuaWQpID09PSBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcikge1xuXHRcdFx0XHRcdFx0XHQvLyBmb2N1cyB0aGUgZWRpdG9yIGlmIHRoZSB2aWV3IGlzIGZvY3VzZWQgYW5kIGluIHRoZSBzaWRlIGJhclxuXHRcdFx0XHRcdFx0XHRlZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAuZm9jdXMoKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAodmlld0xvY2F0aW9uICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0XHRcdC8vIG90aGVyd2lzZSBoaWRlIHRoZSBwYXJ0IHdoZXJlIHRoZSB2aWV3IGxpdmVzIGlmIGZvY3VzZWRcblx0XHRcdFx0XHRcdFx0bGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKHRydWUsIGdldFBhcnRCeUxvY2F0aW9uKHZpZXdMb2NhdGlvbikpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR2aWV3c1NlcnZpY2Uub3BlblZpZXcodmlld0Rlc2NyaXB0b3IuaWQsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRpZiAodmlld0Rlc2NyaXB0b3Iub3BlbkNvbW1hbmRBY3Rpb25EZXNjcmlwdG9yLm1uZW1vbmljVGl0bGUpIHtcblx0XHRcdFx0Y29uc3QgZGVmYXVsdFZpZXdDb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXREZWZhdWx0Q29udGFpbmVyQnlJZCh2aWV3RGVzY3JpcHRvci5pZCk7XG5cdFx0XHRcdGlmIChkZWZhdWx0Vmlld0NvbnRhaW5lcikge1xuXHRcdFx0XHRcdGNvbnN0IGRlZmF1bHRMb2NhdGlvbiA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldERlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb24oZGVmYXVsdFZpZXdDb250YWluZXIpO1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJWaWV3TWVudSwge1xuXHRcdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0XHRpZDogY29tbWFuZElkLFxuXHRcdFx0XHRcdFx0XHR0aXRsZTogdmlld0Rlc2NyaXB0b3Iub3BlbkNvbW1hbmRBY3Rpb25EZXNjcmlwdG9yLm1uZW1vbmljVGl0bGUsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0Z3JvdXA6IGRlZmF1bHRMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIgPyAnM19zaWRlYmFyJyA6IGRlZmF1bHRMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhciA/ICc0X2F1eGJhcicgOiAnNV9wYW5lbCcsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5oYXMoYCR7dmlld0Rlc2NyaXB0b3IuaWR9LmFjdGl2ZWApLFxuXHRcdFx0XHRcdFx0b3JkZXI6IHZpZXdEZXNjcmlwdG9yLm9wZW5Db21tYW5kQWN0aW9uRGVzY3JpcHRvci5vcmRlciA/PyBOdW1iZXIuTUFYX1ZBTFVFXG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJGb2N1c1ZpZXdBY3Rpb24odmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciwgY2F0ZWdvcnk/OiBzdHJpbmcgfCBJTG9jYWxpemVkU3RyaW5nKTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiByZWdpc3RlckFjdGlvbjIoY2xhc3MgRm9jdXNWaWV3QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0Y29uc3QgdGl0bGUgPSBsb2NhbGl6ZTIoeyBrZXk6ICdmb2N1cyB2aWV3JywgY29tbWVudDogWyd7MH0gaW5kaWNhdGVzIHRoZSBuYW1lIG9mIHRoZSB2aWV3IHRvIGJlIGZvY3VzZWQuJ10gfSwgXCJGb2N1cyBvbiB7MH0gVmlld1wiLCB2aWV3RGVzY3JpcHRvci5uYW1lLnZhbHVlKTtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiB2aWV3RGVzY3JpcHRvci5mb2N1c0NvbW1hbmQgPyB2aWV3RGVzY3JpcHRvci5mb2N1c0NvbW1hbmQuaWQgOiBgJHt2aWV3RGVzY3JpcHRvci5pZH0uZm9jdXNgLFxuXHRcdFx0XHRcdHRpdGxlLFxuXHRcdFx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHRcdFx0d2hlbjogdmlld0Rlc2NyaXB0b3Iud2hlbixcblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5oYXMoYCR7dmlld0Rlc2NyaXB0b3IuaWR9LmFjdGl2ZWApLFxuXHRcdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdFx0XHRwcmltYXJ5OiB2aWV3RGVzY3JpcHRvci5mb2N1c0NvbW1hbmQ/LmtleWJpbmRpbmdzPy5wcmltYXJ5LFxuXHRcdFx0XHRcdFx0c2Vjb25kYXJ5OiB2aWV3RGVzY3JpcHRvci5mb2N1c0NvbW1hbmQ/LmtleWJpbmRpbmdzPy5zZWNvbmRhcnksXG5cdFx0XHRcdFx0XHRsaW51eDogdmlld0Rlc2NyaXB0b3IuZm9jdXNDb21tYW5kPy5rZXliaW5kaW5ncz8ubGludXgsXG5cdFx0XHRcdFx0XHRtYWM6IHZpZXdEZXNjcmlwdG9yLmZvY3VzQ29tbWFuZD8ua2V5YmluZGluZ3M/Lm1hYyxcblx0XHRcdFx0XHRcdHdpbjogdmlld0Rlc2NyaXB0b3IuZm9jdXNDb21tYW5kPy5rZXliaW5kaW5ncz8ud2luXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IHRpdGxlLnZhbHVlLFxuXHRcdFx0XHRcdFx0YXJnczogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2ZvY3VzT3B0aW9ucycsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdGb2N1cyBPcHRpb25zJyxcblx0XHRcdFx0XHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQncHJlc2VydmVGb2N1cyc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBvcHRpb25zPzogeyBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbiB9KTogdm9pZCB7XG5cdFx0XHRcdGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKS5vcGVuVmlldyh2aWV3RGVzY3JpcHRvci5pZCwgIW9wdGlvbnM/LnByZXNlcnZlRm9jdXMpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclJlc2V0Vmlld0xvY2F0aW9uQWN0aW9uKHZpZXdEZXNjcmlwdG9yOiBJVmlld0Rlc2NyaXB0b3IpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBSZXNldFZpZXdMb2NhdGlvbkFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogYCR7dmlld0Rlc2NyaXB0b3IuaWR9LnJlc2V0Vmlld0xvY2F0aW9uYCxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdyZXNldFZpZXdMb2NhdGlvbicsIFwiUmVzZXQgTG9jYXRpb25cIiksXG5cdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlQ29udGV4dCxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3Jywgdmlld0Rlc2NyaXB0b3IuaWQpLFxuXHRcdFx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhgJHt2aWV3RGVzY3JpcHRvci5pZH0uZGVmYXVsdFZpZXdMb2NhdGlvbmAsIGZhbHNlKVxuXHRcdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICcxX2hpZGUnLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3RGVzY3JpcHRvclNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0Q29udGFpbmVyID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldERlZmF1bHRDb250YWluZXJCeUlkKHZpZXdEZXNjcmlwdG9yLmlkKSE7XG5cdFx0XHRcdGNvbnN0IGNvbnRhaW5lck1vZGVsID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChkZWZhdWx0Q29udGFpbmVyKSE7XG5cblx0XHRcdFx0Ly8gVGhlIGRlZmF1bHQgY29udGFpbmVyIGlzIGhpZGRlbiBzbyB3ZSBzaG91bGQgdHJ5IHRvIHJlc2V0IGl0cyBsb2NhdGlvbiBmaXJzdFxuXHRcdFx0XHRpZiAoZGVmYXVsdENvbnRhaW5lci5oaWRlSWZFbXB0eSAmJiBjb250YWluZXJNb2RlbC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdGNvbnN0IGRlZmF1bHRMb2NhdGlvbiA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXREZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uKGRlZmF1bHRDb250YWluZXIpITtcblx0XHRcdFx0XHR2aWV3RGVzY3JpcHRvclNlcnZpY2UubW92ZVZpZXdDb250YWluZXJUb0xvY2F0aW9uKGRlZmF1bHRDb250YWluZXIsIGRlZmF1bHRMb2NhdGlvbiwgdW5kZWZpbmVkLCB0aGlzLmRlc2MuaWQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3c1RvQ29udGFpbmVyKFt2aWV3RGVzY3JpcHRvcl0sIGRlZmF1bHRDb250YWluZXIsIHVuZGVmaW5lZCwgdGhpcy5kZXNjLmlkKTtcblx0XHRcdFx0YWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpLm9wZW5WaWV3KHZpZXdEZXNjcmlwdG9yLmlkLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJQYW5lQ29tcG9zaXRlKHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIsIHZpZXdDb250YWluZXJMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0Y2xhc3MgUGFuZUNvbnRhaW5lciBleHRlbmRzIFBhbmVDb21wb3NpdGUge1xuXHRcdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRcdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdFx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0XHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdFx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0XHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRcdCkge1xuXHRcdFx0XHRzdXBlcih2aWV3Q29udGFpbmVyLmlkLCB0ZWxlbWV0cnlTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIHRoZW1lU2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBleHRlbnNpb25TZXJ2aWNlLCBjb250ZXh0U2VydmljZSk7XG5cdFx0XHR9XG5cblx0XHRcdHByb3RlY3RlZCBjcmVhdGVWaWV3UGFuZUNvbnRhaW5lcihlbGVtZW50OiBIVE1MRWxlbWVudCk6IFZpZXdQYW5lQ29udGFpbmVyIHtcblx0XHRcdFx0Y29uc3Qgdmlld1BhbmVDb250YWluZXJEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0XHRcdFx0Ly8gVXNlIGNvbXBvc2l0ZSdzIGluc3RhbnRpYXRpb24gc2VydmljZSB0byBnZXQgdGhlIGVkaXRvciBwcm9ncmVzcyBzZXJ2aWNlIGZvciBhbnkgZWRpdG9ycyBpbnN0YW50aWF0ZWQgd2l0aGluIHRoZSBjb21wb3NpdGVcblx0XHRcdFx0Y29uc3Qgdmlld1BhbmVDb250YWluZXIgPSB0aGF0LmNyZWF0ZVZpZXdQYW5lQ29udGFpbmVyKGVsZW1lbnQsIHZpZXdDb250YWluZXIsIHZpZXdDb250YWluZXJMb2NhdGlvbiwgdmlld1BhbmVDb250YWluZXJEaXNwb3NhYmxlcywgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSk7XG5cblx0XHRcdFx0Ly8gT25seSB1cGRhdGVUaXRsZUFyZWEgZm9yIG5vbi1maWx0ZXIgdmlld3M6IG1pY3Jvc29mdC92c2NvZGUtcmVtb3RlLXJlbGVhc2UjMzY3NlxuXHRcdFx0XHRpZiAoISh2aWV3UGFuZUNvbnRhaW5lciBpbnN0YW5jZW9mIEZpbHRlclZpZXdQYW5lQ29udGFpbmVyKSkge1xuXHRcdFx0XHRcdHZpZXdQYW5lQ29udGFpbmVyRGlzcG9zYWJsZXMuYWRkKEV2ZW50LmFueSh2aWV3UGFuZUNvbnRhaW5lci5vbkRpZEFkZFZpZXdzLCB2aWV3UGFuZUNvbnRhaW5lci5vbkRpZFJlbW92ZVZpZXdzLCB2aWV3UGFuZUNvbnRhaW5lci5vblRpdGxlQXJlYVVwZGF0ZSkoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Ly8gVXBkYXRlIHRpdGxlIGFyZWEgc2luY2UgdGhlcmUgaXMgbm8gYmV0dGVyIHdheSB0byB1cGRhdGUgc2Vjb25kYXJ5IGFjdGlvbnNcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlVGl0bGVBcmVhKCk7XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHZpZXdQYW5lQ29udGFpbmVyO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdFJlZ2lzdHJ5LmFzPFBhbmVDb21wb3NpdGVSZWdpc3RyeT4oZ2V0UGFuZUNvbXBvc2l0ZUV4dGVuc2lvbih2aWV3Q29udGFpbmVyTG9jYXRpb24pKS5yZWdpc3RlclBhbmVDb21wb3NpdGUoUGFuZUNvbXBvc2l0ZURlc2NyaXB0b3IuY3JlYXRlKFxuXHRcdFx0UGFuZUNvbnRhaW5lcixcblx0XHRcdHZpZXdDb250YWluZXIuaWQsXG5cdFx0XHR0eXBlb2Ygdmlld0NvbnRhaW5lci50aXRsZSA9PT0gJ3N0cmluZycgPyB2aWV3Q29udGFpbmVyLnRpdGxlIDogdmlld0NvbnRhaW5lci50aXRsZS52YWx1ZSxcblx0XHRcdGlzU3RyaW5nKHZpZXdDb250YWluZXIuaWNvbikgPyB2aWV3Q29udGFpbmVyLmljb24gOiB1bmRlZmluZWQsXG5cdFx0XHR2aWV3Q29udGFpbmVyLm9yZGVyLFxuXHRcdFx0dmlld0NvbnRhaW5lci5yZXF1ZXN0ZWRJbmRleCxcblx0XHRcdHZpZXdDb250YWluZXIuaWNvbiBpbnN0YW5jZW9mIFVSSSA/IHZpZXdDb250YWluZXIuaWNvbiA6IHVuZGVmaW5lZFxuXHRcdCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBkZXJlZ2lzdGVyUGFuZUNvbXBvc2l0ZSh2aWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyLCB2aWV3Q29udGFpbmVyTG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IHZvaWQge1xuXHRcdFJlZ2lzdHJ5LmFzPFBhbmVDb21wb3NpdGVSZWdpc3RyeT4oZ2V0UGFuZUNvbXBvc2l0ZUV4dGVuc2lvbih2aWV3Q29udGFpbmVyTG9jYXRpb24pKS5kZXJlZ2lzdGVyUGFuZUNvbXBvc2l0ZSh2aWV3Q29udGFpbmVyLmlkKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVmlld1BhbmVDb250YWluZXIoZWxlbWVudDogSFRNTEVsZW1lbnQsIHZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIsIHZpZXdDb250YWluZXJMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlLCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKTogVmlld1BhbmVDb250YWluZXIge1xuXHRcdGNvbnN0IHZpZXdQYW5lQ29udGFpbmVyOiBWaWV3UGFuZUNvbnRhaW5lciA9IChpbnN0YW50aWF0aW9uU2VydmljZSBhcyBhbnkpLmNyZWF0ZUluc3RhbmNlKHZpZXdDb250YWluZXIuY3RvckRlc2NyaXB0b3IuY3RvciwgLi4uKHZpZXdDb250YWluZXIuY3RvckRlc2NyaXB0b3Iuc3RhdGljQXJndW1lbnRzIHx8IFtdKSk7XG5cblx0XHR0aGlzLnZpZXdQYW5lQ29udGFpbmVycy5zZXQodmlld1BhbmVDb250YWluZXIuZ2V0SWQoKSwgdmlld1BhbmVDb250YWluZXIpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy52aWV3UGFuZUNvbnRhaW5lcnMuZGVsZXRlKHZpZXdQYW5lQ29udGFpbmVyLmdldElkKCkpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHZpZXdQYW5lQ29udGFpbmVyLm9uRGlkQWRkVmlld3Modmlld3MgPT4gdGhpcy5vblZpZXdzQWRkZWQodmlld3MpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHZpZXdQYW5lQ29udGFpbmVyLm9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHkodmlldyA9PiB0aGlzLm9uVmlld3NWaXNpYmlsaXR5Q2hhbmdlZCh2aWV3LCB2aWV3LmlzQm9keVZpc2libGUoKSkpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodmlld1BhbmVDb250YWluZXIub25EaWRSZW1vdmVWaWV3cyh2aWV3cyA9PiB0aGlzLm9uVmlld3NSZW1vdmVkKHZpZXdzKSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh2aWV3UGFuZUNvbnRhaW5lci5vbkRpZEZvY3VzVmlldyh2aWV3ID0+IHtcblx0XHRcdGlmICh0aGlzLmZvY3VzZWRWaWV3Q29udGV4dEtleS5nZXQoKSAhPT0gdmlldy5pZCkge1xuXHRcdFx0XHR0aGlzLmZvY3VzZWRWaWV3Q29udGV4dEtleS5zZXQodmlldy5pZCk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRm9jdXNlZFZpZXcuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodmlld1BhbmVDb250YWluZXIub25EaWRCbHVyVmlldyh2aWV3ID0+IHtcblx0XHRcdGlmICh0aGlzLmZvY3VzZWRWaWV3Q29udGV4dEtleS5nZXQoKSA9PT0gdmlldy5pZCkge1xuXHRcdFx0XHR0aGlzLmZvY3VzZWRWaWV3Q29udGV4dEtleS5yZXNldCgpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUZvY3VzZWRWaWV3LmZpcmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gdmlld1BhbmVDb250YWluZXI7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0RW5hYmxlZFZpZXdDb250YWluZXJDb250ZXh0S2V5KHZpZXdDb250YWluZXJJZDogc3RyaW5nKTogc3RyaW5nIHsgcmV0dXJuIGB2aWV3Q29udGFpbmVyLiR7dmlld0NvbnRhaW5lcklkfS5lbmFibGVkYDsgfVxuXG5mdW5jdGlvbiBnZXRQYW5lQ29tcG9zaXRlRXh0ZW5zaW9uKHZpZXdDb250YWluZXJMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uKTogc3RyaW5nIHtcblx0c3dpdGNoICh2aWV3Q29udGFpbmVyTG9jYXRpb24pIHtcblx0XHRjYXNlIFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXI6XG5cdFx0XHRyZXR1cm4gUGFuZUNvbXBvc2l0ZUV4dGVuc2lvbnMuQXV4aWxpYXJ5O1xuXHRcdGNhc2UgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsOlxuXHRcdFx0cmV0dXJuIFBhbmVDb21wb3NpdGVFeHRlbnNpb25zLlBhbmVscztcblx0XHRjYXNlIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyOlxuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gUGFuZUNvbXBvc2l0ZUV4dGVuc2lvbnMuVmlld2xldHM7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFBhcnRCeUxvY2F0aW9uKHZpZXdDb250YWluZXJMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uKTogUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQgfCBQYXJ0cy5TSURFQkFSX1BBUlQgfCBQYXJ0cy5QQU5FTF9QQVJUIHtcblx0c3dpdGNoICh2aWV3Q29udGFpbmVyTG9jYXRpb24pIHtcblx0XHRjYXNlIFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXI6XG5cdFx0XHRyZXR1cm4gUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQ7XG5cdFx0Y2FzZSBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWw6XG5cdFx0XHRyZXR1cm4gUGFydHMuUEFORUxfUEFSVDtcblx0XHRjYXNlIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyOlxuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gUGFydHMuU0lERUJBUl9QQVJUO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElWaWV3c1NlcnZpY2UsIFZpZXdzU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIgLyogRWFnZXIgYmVjYXVzZSBpdCByZWdpc3RlcnMgdmlld2xldHMgYW5kIHBhbmVscyBpbiB0aGUgY29uc3RydWN0b3Igd2hpY2ggYXJlIHJlcXVpcmVkIGR1cmluZyB3b3JrYmVuY2ggbGF5b3V0ICovKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxZQUF5QixjQUFjLGlCQUFpQixxQkFBcUI7QUFDdEYsU0FBUyx3QkFBK0QsNkJBQWlEO0FBQ3pILFNBQVMsb0JBQW9CLGdDQUFnQztBQUM3RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdCQUE2QixvQkFBb0IscUJBQXFCO0FBQy9FLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsUUFBUSxpQkFBaUIsU0FBUyxvQkFBb0I7QUFDL0QsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG1CQUFtQix5QkFBeUI7QUFFckQsU0FBMkIsNkJBQTZCO0FBRXhELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMseUJBQWdELGNBQWMseUJBQXlCLHFCQUFxQjtBQUNySCxTQUFTLHlCQUF5QixhQUFhO0FBQy9DLFNBQVMsV0FBVztBQUVwQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGlDQUFpQztBQUUxQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQjtBQUV2QixJQUFNLGVBQU4sY0FBMkIsV0FBb0M7QUFBQSxFQXFCckUsWUFDMEMsdUJBQ0csc0JBQ1AsbUJBQ0ssZUFDVCxlQUNoQztBQUNELFVBQU07QUFObUM7QUFDRztBQUNQO0FBQ0s7QUFDVDtBQW5CbEMsU0FBaUIsNkJBQXdFLEtBQUssVUFBVSxJQUFJLFFBQTBDLENBQUM7QUFDdkosU0FBUyw0QkFBcUUsS0FBSywyQkFBMkI7QUFFOUcsU0FBaUIsc0NBQXNDLEtBQUssVUFBVSxJQUFJLFFBQTJFLENBQUM7QUFDdEosU0FBUyxxQ0FBcUMsS0FBSyxvQ0FBb0M7QUFFdkYsU0FBaUIsMEJBQTBCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUM3RSxTQUFTLHlCQUF5QixLQUFLLHdCQUF3QjtBQUUvRCxTQUFpQiwyQkFBMkIsS0FBSyxVQUFVLElBQUksY0FBYyxDQUFDO0FBYzdFLFNBQUssaUJBQWlCLG9CQUFJLElBQWtDO0FBQzVELFNBQUssbUNBQW1DLG9CQUFJLElBQWtDO0FBQzlFLFNBQUsseUJBQXlCLG9CQUFJLElBQWtDO0FBQ3BFLFNBQUsscUJBQXFCLG9CQUFJLElBQStCO0FBRTdELFNBQUssVUFBVSxhQUFhLE1BQU07QUFDakMsV0FBSyxlQUFlLFFBQVEsZ0JBQWMsV0FBVyxRQUFRLENBQUM7QUFDOUQsV0FBSyxlQUFlLE1BQU07QUFBQSxJQUMzQixDQUFDLENBQUM7QUFFRixTQUFLLHNCQUFzQixlQUFlLFFBQVEsbUJBQWlCLEtBQUssMkJBQTJCLGVBQWUsS0FBSyxzQkFBc0IseUJBQXlCLGFBQWEsQ0FBRSxDQUFDO0FBQ3RMLFNBQUssVUFBVSxLQUFLLHNCQUFzQiwwQkFBMEIsQ0FBQyxFQUFFLE9BQU8sUUFBUSxNQUFNLEtBQUssc0JBQXNCLE9BQU8sT0FBTyxDQUFDLENBQUM7QUFDdkksU0FBSyxVQUFVLEtBQUssc0JBQXNCLDZCQUE2QixDQUFDLEVBQUUsZUFBZSxNQUFNLEdBQUcsTUFBTSxLQUFLLDZCQUE2QixlQUFlLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFHbkssU0FBSyxVQUFVLEtBQUsscUJBQXFCLHVCQUF1QixPQUFLLEtBQUssb0NBQW9DLEtBQUssRUFBRSxJQUFJLEVBQUUsVUFBVSxNQUFNLEdBQUcsU0FBUyxNQUFNLFVBQVUsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7QUFDbE0sU0FBSyxVQUFVLEtBQUsscUJBQXFCLHdCQUF3QixPQUFLLEtBQUssb0NBQW9DLEtBQUssRUFBRSxJQUFJLEVBQUUsVUFBVSxNQUFNLEdBQUcsU0FBUyxPQUFPLFVBQVUsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7QUFFcE0sU0FBSyx3QkFBd0IsbUJBQW1CLE9BQU8saUJBQWlCO0FBQUEsRUFDekU7QUFBQSxFQUVRLGFBQWEsT0FBc0I7QUFDMUMsZUFBVyxRQUFRLE9BQU87QUFDekIsV0FBSyx5QkFBeUIsTUFBTSxLQUFLLGNBQWMsQ0FBQztBQUFBLElBQ3pEO0FBQUEsRUFDRDtBQUFBLEVBRVEseUJBQXlCLE1BQWEsU0FBd0I7QUFDckUsU0FBSyxnQ0FBZ0MsSUFBSSxFQUFFLElBQUksT0FBTztBQUN0RCxTQUFLLDJCQUEyQixLQUFLLEVBQUUsSUFBSSxLQUFLLElBQUksUUFBaUIsQ0FBQztBQUFBLEVBQ3ZFO0FBQUEsRUFFUSxlQUFlLFNBQXdCO0FBQzlDLGVBQVcsUUFBUSxTQUFTO0FBQzNCLFdBQUsseUJBQXlCLE1BQU0sS0FBSztBQUFBLElBQzFDO0FBQUEsRUFDRDtBQUFBLEVBRVEsZ0NBQWdDLE1BQW1DO0FBQzFFLFVBQU0sc0JBQXNCLHlCQUF5QixLQUFLLEVBQUU7QUFDNUQsUUFBSSxhQUFhLEtBQUssdUJBQXVCLElBQUksbUJBQW1CO0FBQ3BFLFFBQUksQ0FBQyxZQUFZO0FBQ2hCLG1CQUFhLElBQUksY0FBYyxxQkFBcUIsS0FBSyxFQUFFLE9BQU8sS0FBSyxpQkFBaUI7QUFDeEYsV0FBSyx1QkFBdUIsSUFBSSxxQkFBcUIsVUFBVTtBQUFBLElBQ2hFO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLHNCQUFzQixPQUFxRixTQUE2RjtBQUMvTSxlQUFXLEVBQUUsV0FBVyxTQUFTLEtBQUssU0FBUztBQUM5QyxXQUFLLDZCQUE2QixXQUFXLFFBQVE7QUFBQSxJQUN0RDtBQUNBLGVBQVcsRUFBRSxXQUFXLFNBQVMsS0FBSyxPQUFPO0FBQzVDLFdBQUssMkJBQTJCLFdBQVcsUUFBUTtBQUFBLElBQ3BEO0FBQUEsRUFDRDtBQUFBLEVBRVEsMkJBQTJCLGVBQThCLHVCQUFvRDtBQUNwSCxTQUFLLHNCQUFzQixlQUFlLHFCQUFxQjtBQUMvRCxVQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFFeEMsVUFBTSxxQkFBcUIsS0FBSyxzQkFBc0Isc0JBQXNCLGFBQWE7QUFDekYsU0FBSyx1QkFBdUIsbUJBQW1CLG9CQUFvQixhQUFhO0FBQ2hGLGdCQUFZLElBQUksbUJBQW1CLDhCQUE4QixDQUFDLEVBQUUsT0FBTyxRQUFRLE1BQU07QUFDeEYsV0FBSyx1QkFBdUIsT0FBTyxhQUFhO0FBQ2hELFdBQUsseUJBQXlCLE9BQU87QUFBQSxJQUN0QyxDQUFDLENBQUM7QUFDRixTQUFLLHdDQUF3QyxhQUFhO0FBQzFELGdCQUFZLElBQUksbUJBQW1CLGlDQUFpQyxNQUFNLEtBQUssd0NBQXdDLGFBQWEsQ0FBQyxDQUFDO0FBQ3RJLGdCQUFZLElBQUksS0FBSyxnQ0FBZ0MsYUFBYSxDQUFDO0FBRW5FLFNBQUsseUJBQXlCLElBQUksY0FBYyxJQUFJLFdBQVc7QUFBQSxFQUNoRTtBQUFBLEVBRVEsNkJBQTZCLGVBQThCLHVCQUFvRDtBQUN0SCxTQUFLLHdCQUF3QixlQUFlLHFCQUFxQjtBQUNqRSxTQUFLLHlCQUF5QixpQkFBaUIsY0FBYyxFQUFFO0FBQUEsRUFDaEU7QUFBQSxFQUVRLDZCQUE2QixlQUE4QixNQUE2QixJQUFpQztBQUNoSSxTQUFLLHdCQUF3QixlQUFlLElBQUk7QUFDaEQsU0FBSyxzQkFBc0IsZUFBZSxFQUFFO0FBRzVDLFFBQ0MsS0FBSyxjQUFjLFVBQVUsa0JBQWtCLEVBQUUsQ0FBQyxLQUNsRCxLQUFLLHNCQUFzQiw0QkFBNEIsRUFBRSxFQUFFLE9BQU8sUUFBTSxLQUFLLHNCQUFzQixHQUFHLEVBQUUsQ0FBQyxFQUFFLFdBQVcsR0FDckg7QUFDRCxXQUFLLGtCQUFrQixjQUFjLEVBQUU7QUFBQSxJQUN4QztBQUFBLEVBQ0Q7QUFBQSxFQUVRLHVCQUF1QixPQUF1QyxXQUFnQztBQUNyRyxVQUFNLFdBQVcsS0FBSyxzQkFBc0IseUJBQXlCLFNBQVM7QUFDOUUsUUFBSSxhQUFhLE1BQU07QUFDdEI7QUFBQSxJQUNEO0FBRUEsZUFBVyxrQkFBa0IsT0FBTztBQUNuQyxZQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsa0JBQVksSUFBSSxLQUFLLHVCQUF1QixjQUFjLENBQUM7QUFDM0Qsa0JBQVksSUFBSSxLQUFLLHdCQUF3QixnQkFBZ0IsVUFBVSxLQUFLLENBQUM7QUFDN0Usa0JBQVksSUFBSSxLQUFLLGdDQUFnQyxjQUFjLENBQUM7QUFDcEUsV0FBSyxlQUFlLElBQUksZ0JBQWdCLFdBQVc7QUFBQSxJQUNwRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHlCQUF5QixPQUE2QztBQUM3RSxlQUFXLFFBQVEsT0FBTztBQUN6QixZQUFNLGFBQWEsS0FBSyxlQUFlLElBQUksSUFBSTtBQUMvQyxVQUFJLFlBQVk7QUFDZixtQkFBVyxRQUFRO0FBQ25CLGFBQUssZUFBZSxPQUFPLElBQUk7QUFBQSxNQUNoQztBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSx3Q0FBd0MsZUFBb0M7QUFDbkYsUUFBSSxhQUFhLEtBQUssaUNBQWlDLElBQUksY0FBYyxFQUFFO0FBQzNFLFFBQUksQ0FBQyxZQUFZO0FBQ2hCLG1CQUFhLEtBQUssa0JBQWtCLFVBQVUsa0NBQWtDLGNBQWMsRUFBRSxHQUFHLEtBQUs7QUFDeEcsV0FBSyxpQ0FBaUMsSUFBSSxjQUFjLElBQUksVUFBVTtBQUFBLElBQ3ZFO0FBQ0EsZUFBVyxJQUFJLEVBQUUsY0FBYyxlQUFlLEtBQUssc0JBQXNCLHNCQUFzQixhQUFhLEVBQUUsc0JBQXNCLFdBQVcsRUFBRTtBQUFBLEVBQ2xKO0FBQUEsRUFFQSxNQUFjLGNBQWMsYUFBcUIsVUFBaUMsT0FBc0Q7QUFDdkksV0FBTyxLQUFLLHFCQUFxQixrQkFBa0IsYUFBYSxVQUFVLEtBQUs7QUFBQSxFQUNoRjtBQUFBLEVBRVEsYUFBYSxhQUFxQixVQUEyRTtBQUNwSCxXQUFPLEtBQUsscUJBQXFCLGlCQUFpQixhQUFhLFFBQVE7QUFBQSxFQUN4RTtBQUFBO0FBQUEsRUFHQSx1QkFBdUIsSUFBcUI7QUFDM0MsVUFBTSxnQkFBZ0IsS0FBSyxzQkFBc0IscUJBQXFCLEVBQUU7QUFDeEUsUUFBSSxDQUFDLGVBQWU7QUFDbkIsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLHdCQUF3QixLQUFLLHNCQUFzQix5QkFBeUIsYUFBYTtBQUMvRixRQUFJLDBCQUEwQixNQUFNO0FBQ25DLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLHFCQUFxQix1QkFBdUIscUJBQXFCLEdBQUcsTUFBTSxNQUFNO0FBQUEsRUFDN0Y7QUFBQTtBQUFBLEVBR0Esc0JBQXNCLElBQXFCO0FBQzFDLFVBQU0sZ0JBQWdCLEtBQUssc0JBQXNCLHFCQUFxQixFQUFFO0FBQ3hFLFFBQUksQ0FBQyxlQUFlO0FBQ25CLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxDQUFDLGNBQWMsYUFBYTtBQUMvQixhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sS0FBSyxzQkFBc0Isc0JBQXNCLGFBQWEsRUFBRSxzQkFBc0IsU0FBUztBQUFBLEVBQ3ZHO0FBQUEsRUFFQSx3QkFBd0IsVUFBdUQ7QUFDOUUsVUFBTSxrQkFBa0IsS0FBSyxxQkFBcUIsdUJBQXVCLFFBQVEsR0FBRyxNQUFNO0FBQzFGLFdBQU8sa0JBQWtCLEtBQUssc0JBQXNCLHFCQUFxQixlQUFlLElBQUk7QUFBQSxFQUM3RjtBQUFBLEVBRUEsaUNBQWlDLGlCQUFvRDtBQUNwRixVQUFNLGdCQUFnQixLQUFLLHNCQUFzQixxQkFBcUIsZUFBZTtBQUNyRixXQUFPLGdCQUFnQixLQUFLLDJCQUEyQixhQUFhLElBQUk7QUFBQSxFQUN6RTtBQUFBLEVBRUEsTUFBTSxrQkFBa0IsSUFBWSxPQUFpRDtBQUNwRixVQUFNLGdCQUFnQixLQUFLLHNCQUFzQixxQkFBcUIsRUFBRTtBQUN4RSxRQUFJLGVBQWU7QUFDbEIsWUFBTSx3QkFBd0IsS0FBSyxzQkFBc0IseUJBQXlCLGFBQWE7QUFDL0YsVUFBSSwwQkFBMEIsTUFBTTtBQUNuQyxjQUFNLGdCQUFnQixNQUFNLEtBQUsscUJBQXFCLGtCQUFrQixJQUFJLHVCQUF1QixLQUFLO0FBQ3hHLGVBQU8saUJBQWlCO0FBQUEsTUFDekI7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQU0sbUJBQW1CLElBQTJCO0FBQ25ELFVBQU0sZ0JBQWdCLEtBQUssc0JBQXNCLHFCQUFxQixFQUFFO0FBQ3hFLFFBQUksZUFBZTtBQUNsQixZQUFNLHdCQUF3QixLQUFLLHNCQUFzQix5QkFBeUIsYUFBYTtBQUMvRixZQUFNLFdBQVcsMEJBQTBCLFFBQVEsS0FBSyxxQkFBcUIsdUJBQXVCLHFCQUFxQjtBQUN6SCxVQUFJLDBCQUEwQixNQUFNO0FBQ25DLGVBQU8sV0FBVyxLQUFLLGNBQWMsY0FBYyxNQUFNLGtCQUFrQixxQkFBcUIsQ0FBQyxJQUFJO0FBQUEsTUFDdEc7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEsY0FBYyxJQUFxQjtBQUNsQyxVQUFNLGFBQWEsS0FBSyxvQkFBb0IsRUFBRTtBQUM5QyxXQUFPLFlBQVksY0FBYyxLQUFLO0FBQUEsRUFDdkM7QUFBQSxFQUVBLG9CQUFxQyxJQUFzQjtBQUMxRCxVQUFNLGdCQUFnQixLQUFLLHNCQUFzQix5QkFBeUIsRUFBRTtBQUM1RSxRQUFJLGVBQWU7QUFDbEIsWUFBTSwwQkFBMEIsS0FBSywyQkFBMkIsYUFBYTtBQUM3RSxVQUFJLHlCQUF5QjtBQUM1QixlQUFPLHdCQUF3QixRQUFRLEVBQUU7QUFBQSxNQUMxQztBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsY0FBK0IsSUFBc0I7QUFDcEQsVUFBTSxnQkFBZ0IsS0FBSyxzQkFBc0IseUJBQXlCLEVBQUU7QUFDNUUsUUFBSSxlQUFlO0FBQ2xCLFlBQU0sb0JBQW9ELEtBQUssbUJBQW1CLElBQUksY0FBYyxFQUFFO0FBQ3RHLFVBQUksbUJBQW1CO0FBQ3RCLGVBQU8sa0JBQWtCLFFBQVEsRUFBRTtBQUFBLE1BQ3BDO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxpQkFBeUM7QUFDeEMsVUFBTSxTQUFpQixLQUFLLGtCQUFrQixtQkFBbUIsbUJBQW1CLEdBQUcsS0FBSztBQUM1RixXQUFPLEtBQUssc0JBQXNCLHNCQUFzQixPQUFPLFNBQVMsQ0FBQztBQUFBLEVBQzFFO0FBQUEsRUFFQSxxQkFBNkI7QUFDNUIsVUFBTSxvQkFBb0IsS0FBSyxjQUFjLHlCQUF5QixhQUFhLElBQUksU0FBUyxVQUFVLGFBQWEsSUFBSTtBQUMzSCxXQUFPLEtBQUssZUFBZSxHQUFHLE1BQU0sU0FBUyxxQkFBcUI7QUFBQSxFQUNuRTtBQUFBLEVBRUEsTUFBTSxTQUEwQixJQUFZLE9BQW9DO0FBQy9FLFVBQU0sZ0JBQWdCLEtBQUssc0JBQXNCLHlCQUF5QixFQUFFO0FBQzVFLFFBQUksQ0FBQyxlQUFlO0FBQ25CLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxDQUFDLEtBQUssc0JBQXNCLHNCQUFzQixhQUFhLEVBQUUsc0JBQXNCLEtBQUssb0JBQWtCLGVBQWUsT0FBTyxFQUFFLEdBQUc7QUFDNUksYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLFdBQVcsS0FBSyxzQkFBc0IseUJBQXlCLGFBQWE7QUFDbEYsVUFBTSxzQkFBc0IsS0FBSyxhQUFhLGNBQWMsSUFBSSxRQUFTO0FBQ3pFLFFBQUkscUJBQXFCO0FBQ3hCLFlBQU0sZ0JBQWdCLE1BQU0sS0FBSyxjQUFjLG9CQUFvQixJQUFJLFFBQVM7QUFDaEYsVUFBSSxpQkFBaUIsY0FBYyxVQUFVO0FBQzVDLGVBQU8sY0FBYyxTQUFZLElBQUksS0FBSyxLQUFLO0FBQUEsTUFDaEQsV0FBVyxPQUFPO0FBQ2pCLHVCQUFlLE1BQU07QUFBQSxNQUN0QjtBQUFBLElBQ0Q7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsVUFBVSxJQUFrQjtBQUMzQixVQUFNLGdCQUFnQixLQUFLLHNCQUFzQix5QkFBeUIsRUFBRTtBQUM1RSxRQUFJLGVBQWU7QUFDbEIsWUFBTSwwQkFBMEIsS0FBSywyQkFBMkIsYUFBYTtBQUM3RSxVQUFJLHlCQUF5QjtBQUM1QixjQUFNLE9BQU8sd0JBQXdCLFFBQVEsRUFBRTtBQUMvQyxZQUFJLE1BQU07QUFDVCxjQUFJLHdCQUF3QixNQUFNLFdBQVcsR0FBRztBQUMvQyxrQkFBTSxXQUFXLEtBQUssc0JBQXNCLHlCQUF5QixhQUFhO0FBQ2xGLGdCQUFJLGFBQWEsc0JBQXNCLFNBQVM7QUFDL0MsbUJBQUssY0FBYyxjQUFjLE1BQU0sTUFBTSxZQUFZO0FBQUEsWUFDMUQsV0FBVyxhQUFhLHNCQUFzQixTQUFTLGFBQWEsc0JBQXNCLGNBQWM7QUFDdkcsbUJBQUsscUJBQXFCLHdCQUF3QixRQUFRO0FBQUEsWUFDM0Q7QUFLQSxnQkFBSSxLQUFLLHNCQUFzQixJQUFJLE1BQU0sSUFBSTtBQUM1QyxtQkFBSyxzQkFBc0IsTUFBTTtBQUFBLFlBQ2xDO0FBQUEsVUFDRCxPQUFPO0FBQ04saUJBQUssWUFBWSxLQUFLO0FBQUEsVUFDdkI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSwyQkFBMkIsZUFBeUQ7QUFDM0YsVUFBTSxXQUFXLEtBQUssc0JBQXNCLHlCQUF5QixhQUFhO0FBQ2xGLFFBQUksYUFBYSxNQUFNO0FBQ3RCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxzQkFBc0IsS0FBSyxxQkFBcUIsdUJBQXVCLFFBQVE7QUFDckYsUUFBSSxxQkFBcUIsTUFBTSxNQUFNLGNBQWMsSUFBSTtBQUN0RCxhQUFPLG9CQUFvQixxQkFBcUIsS0FBSztBQUFBLElBQ3REO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLHlCQUF5QixRQUFnRDtBQUN4RSxVQUFNLGdCQUFnQixLQUFLLHNCQUFzQix5QkFBeUIsTUFBTTtBQUNoRixRQUFJLENBQUMsZUFBZTtBQUNuQixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sb0JBQW9CLEtBQUssbUJBQW1CLElBQUksY0FBYyxFQUFFO0FBQ3RFLFFBQUksQ0FBQyxtQkFBbUI7QUFDdkIsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLE9BQU8sa0JBQWtCLFFBQVEsTUFBTTtBQUM3QyxRQUFJLENBQUMsTUFBTTtBQUNWLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxrQkFBa0IsMEJBQTBCLEdBQUc7QUFDbEQsYUFBTyxLQUFLLGtDQUFrQyxhQUFhO0FBQUEsSUFDNUQ7QUFFQSxXQUFPLEtBQUsscUJBQXFCO0FBQUEsRUFDbEM7QUFBQSxFQUVRLGtDQUFrQyxlQUE4RDtBQUN2RyxVQUFNLHdCQUF3QixLQUFLLHNCQUFzQix5QkFBeUIsYUFBYTtBQUMvRixRQUFJLDBCQUEwQixNQUFNO0FBQ25DLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLHFCQUFxQixxQkFBcUIsY0FBYyxJQUFJLHFCQUFxQjtBQUFBLEVBQzlGO0FBQUEsRUFFUSxnQ0FBZ0MsZUFBMkM7QUFDbEYsVUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLFFBQUksY0FBYyw2QkFBNkI7QUFDOUMsWUFBTSxFQUFFLElBQUksZUFBZSxhQUFhLE1BQU0sSUFBSSxjQUFjLCtCQUErQixFQUFFLElBQUksY0FBYyxHQUFHO0FBQ3RILFlBQU0sUUFBUSxjQUFjLDRCQUE0QixTQUFTLGNBQWM7QUFDL0UsWUFBTSxPQUFPO0FBQ2Isa0JBQVksSUFBSSxnQkFBZ0IsTUFBTSxnQ0FBZ0MsUUFBUTtBQUFBLFFBQzdFLGNBQWM7QUFDYixnQkFBTTtBQUFBLFlBQ0w7QUFBQSxZQUNBLElBQUksUUFBNkI7QUFDaEMsb0JBQU0sd0JBQXdCLEtBQUssc0JBQXNCLHlCQUF5QixhQUFhO0FBQy9GLG9CQUFNLGlCQUFpQixPQUFPLFVBQVUsV0FBVyxRQUFRLE1BQU07QUFDakUsb0JBQU0sZ0JBQWdCLE9BQU8sVUFBVSxXQUFXLFFBQVEsTUFBTTtBQUNoRSxrQkFBSSwwQkFBMEIsc0JBQXNCLFNBQVM7QUFDNUQsdUJBQU8sRUFBRSxPQUFPLFNBQVMsYUFBYSxZQUFZLGNBQWMsR0FBRyxVQUFVLFFBQVEsYUFBYSxHQUFHO0FBQUEsY0FDdEcsT0FBTztBQUNOLHVCQUFPLEVBQUUsT0FBTyxTQUFTLGVBQWUsY0FBYyxjQUFjLEdBQUcsVUFBVSxVQUFVLGFBQWEsR0FBRztBQUFBLGNBQzVHO0FBQUEsWUFDRDtBQUFBLFlBQ0EsVUFBVSxXQUFXO0FBQUEsWUFDckIsY0FBYyxlQUFlLElBQUksa0NBQWtDLGNBQWMsRUFBRSxDQUFDO0FBQUEsWUFDcEYsWUFBWSxjQUFjLEVBQUUsR0FBRyxhQUFhLFFBQVEsaUJBQWlCLGlCQUFpQixJQUFJO0FBQUEsWUFDMUYsSUFBSTtBQUFBLFVBQ0wsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxRQUNBLE1BQWEsSUFBSSxpQkFBaUQ7QUFDakUsZ0JBQU0scUJBQXFCLGdCQUFnQixJQUFJLG9CQUFvQjtBQUNuRSxnQkFBTSx3QkFBd0IsZ0JBQWdCLElBQUksc0JBQXNCO0FBQ3hFLGdCQUFNLGdCQUFnQixnQkFBZ0IsSUFBSSx1QkFBdUI7QUFDakUsZ0JBQU0sZUFBZSxnQkFBZ0IsSUFBSSxhQUFhO0FBQ3RELGdCQUFNLHdCQUF3QixzQkFBc0IseUJBQXlCLGFBQWE7QUFDMUYsa0JBQVEsdUJBQXVCO0FBQUEsWUFDOUIsS0FBSyxzQkFBc0I7QUFBQSxZQUMzQixLQUFLLHNCQUFzQixTQUFTO0FBQ25DLG9CQUFNLE9BQU8sMEJBQTBCLHNCQUFzQixVQUFVLE1BQU0sZUFBZSxNQUFNO0FBQ2xHLGtCQUFJLENBQUMsYUFBYSx1QkFBdUIsY0FBYyxFQUFFLEtBQUssQ0FBQyxjQUFjLFNBQVMsSUFBSSxHQUFHO0FBQzVGLHNCQUFNLGFBQWEsa0JBQWtCLGNBQWMsSUFBSSxJQUFJO0FBQUEsY0FDNUQsT0FBTztBQUNOLG1DQUFtQixZQUFZLE1BQU07QUFBQSxjQUN0QztBQUNBO0FBQUEsWUFDRDtBQUFBLFlBQ0EsS0FBSyxzQkFBc0I7QUFDMUIsa0JBQUksQ0FBQyxhQUFhLHVCQUF1QixjQUFjLEVBQUUsS0FBSyxDQUFDLGNBQWMsU0FBUyxNQUFNLFVBQVUsR0FBRztBQUN4RyxzQkFBTSxhQUFhLGtCQUFrQixjQUFjLElBQUksSUFBSTtBQUFBLGNBQzVELE9BQU87QUFDTiw2QkFBYSxtQkFBbUIsY0FBYyxFQUFFO0FBQUEsY0FDakQ7QUFDQTtBQUFBLFVBQ0Y7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFFRixVQUFJLGVBQWU7QUFDbEIsY0FBTSxrQkFBa0IsS0FBSyxzQkFBc0IsZ0NBQWdDLGFBQWE7QUFDaEcsb0JBQVksSUFBSSxhQUFhLGVBQWUsT0FBTyxpQkFBaUI7QUFBQSxVQUNuRSxTQUFTO0FBQUEsWUFDUjtBQUFBLFlBQ0EsT0FBTztBQUFBLFVBQ1I7QUFBQSxVQUNBLE9BQU8sb0JBQW9CLHNCQUFzQixVQUFVLGNBQWMsb0JBQW9CLHNCQUFzQixlQUFlLGFBQWE7QUFBQSxVQUMvSSxNQUFNLGVBQWUsSUFBSSxrQ0FBa0MsY0FBYyxFQUFFLENBQUM7QUFBQSxVQUM1RSxPQUFPLFNBQVMsT0FBTztBQUFBLFFBQ3hCLENBQUMsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLHVCQUF1QixnQkFBOEM7QUFDNUUsVUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLFFBQUksZUFBZSw2QkFBNkI7QUFDL0MsWUFBTSxRQUFRLGVBQWUsNEJBQTRCLFNBQVMsZUFBZTtBQUNqRixZQUFNLFlBQVksZUFBZSw0QkFBNEI7QUFDN0QsWUFBTSxPQUFPO0FBQ2Isa0JBQVksSUFBSSxnQkFBZ0IsTUFBTSx1QkFBdUIsUUFBUTtBQUFBLFFBQ3BFLGNBQWM7QUFDYixnQkFBTTtBQUFBLFlBQ0wsSUFBSTtBQUFBLFlBQ0osSUFBSSxRQUE2QjtBQUNoQyxvQkFBTSx3QkFBd0IsS0FBSyxzQkFBc0Isb0JBQW9CLGVBQWUsRUFBRTtBQUM5RixvQkFBTSxpQkFBaUIsT0FBTyxVQUFVLFdBQVcsUUFBUSxNQUFNO0FBQ2pFLG9CQUFNLGdCQUFnQixPQUFPLFVBQVUsV0FBVyxRQUFRLE1BQU07QUFDaEUsa0JBQUksMEJBQTBCLHNCQUFzQixTQUFTO0FBQzVELHVCQUFPLEVBQUUsT0FBTyxTQUFTLGFBQWEsWUFBWSxjQUFjLEdBQUcsVUFBVSxRQUFRLGFBQWEsR0FBRztBQUFBLGNBQ3RHLE9BQU87QUFDTix1QkFBTyxFQUFFLE9BQU8sU0FBUyxlQUFlLGNBQWMsY0FBYyxHQUFHLFVBQVUsVUFBVSxhQUFhLEdBQUc7QUFBQSxjQUM1RztBQUFBLFlBQ0Q7QUFBQSxZQUNBLFVBQVUsV0FBVztBQUFBLFlBQ3JCLGNBQWMsZUFBZSxJQUFJLEdBQUcsZUFBZSxFQUFFLFNBQVM7QUFBQSxZQUM5RCxZQUFZLGVBQWUsNEJBQTZCLGNBQWMsRUFBRSxHQUFHLGVBQWUsNEJBQTZCLGFBQWEsUUFBUSxpQkFBaUIsaUJBQWlCLElBQUk7QUFBQSxZQUNsTCxJQUFJO0FBQUEsVUFDTCxDQUFDO0FBQUEsUUFDRjtBQUFBLFFBQ0EsTUFBYSxJQUFJLGlCQUFpRDtBQUNqRSxnQkFBTSxxQkFBcUIsZ0JBQWdCLElBQUksb0JBQW9CO0FBQ25FLGdCQUFNLHdCQUF3QixnQkFBZ0IsSUFBSSxzQkFBc0I7QUFDeEUsZ0JBQU0sZ0JBQWdCLGdCQUFnQixJQUFJLHVCQUF1QjtBQUNqRSxnQkFBTSxlQUFlLGdCQUFnQixJQUFJLGFBQWE7QUFDdEQsZ0JBQU0sb0JBQW9CLGdCQUFnQixJQUFJLGtCQUFrQjtBQUVoRSxnQkFBTSxnQkFBZ0IsbUJBQW1CLFNBQVMsaUJBQWlCO0FBQ25FLGNBQUksa0JBQWtCLGVBQWUsSUFBSTtBQUV4QyxrQkFBTSxlQUFlLHNCQUFzQixvQkFBb0IsZUFBZSxFQUFFO0FBQ2hGLGdCQUFJLHNCQUFzQixvQkFBb0IsZUFBZSxFQUFFLE1BQU0sc0JBQXNCLFNBQVM7QUFFbkcsaUNBQW1CLFlBQVksTUFBTTtBQUFBLFlBQ3RDLFdBQVcsaUJBQWlCLE1BQU07QUFFakMsNEJBQWMsY0FBYyxNQUFNLGtCQUFrQixZQUFZLENBQUM7QUFBQSxZQUNsRTtBQUFBLFVBQ0QsT0FBTztBQUNOLHlCQUFhLFNBQVMsZUFBZSxJQUFJLElBQUk7QUFBQSxVQUM5QztBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUMsQ0FBQztBQUVGLFVBQUksZUFBZSw0QkFBNEIsZUFBZTtBQUM3RCxjQUFNLHVCQUF1QixLQUFLLHNCQUFzQix3QkFBd0IsZUFBZSxFQUFFO0FBQ2pHLFlBQUksc0JBQXNCO0FBQ3pCLGdCQUFNLGtCQUFrQixLQUFLLHNCQUFzQixnQ0FBZ0Msb0JBQW9CO0FBQ3ZHLHNCQUFZLElBQUksYUFBYSxlQUFlLE9BQU8saUJBQWlCO0FBQUEsWUFDbkUsU0FBUztBQUFBLGNBQ1IsSUFBSTtBQUFBLGNBQ0osT0FBTyxlQUFlLDRCQUE0QjtBQUFBLFlBQ25EO0FBQUEsWUFDQSxPQUFPLG9CQUFvQixzQkFBc0IsVUFBVSxjQUFjLG9CQUFvQixzQkFBc0IsZUFBZSxhQUFhO0FBQUEsWUFDL0ksTUFBTSxlQUFlLElBQUksR0FBRyxlQUFlLEVBQUUsU0FBUztBQUFBLFlBQ3RELE9BQU8sZUFBZSw0QkFBNEIsU0FBUyxPQUFPO0FBQUEsVUFDbkUsQ0FBQyxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLHdCQUF3QixnQkFBaUMsVUFBbUQ7QUFDbkgsV0FBTyxnQkFBZ0IsTUFBTSx3QkFBd0IsUUFBUTtBQUFBLE1BQzVELGNBQWM7QUFDYixjQUFNLFFBQVEsVUFBVSxFQUFFLEtBQUssY0FBYyxTQUFTLENBQUMsbURBQW1ELEVBQUUsR0FBRyxxQkFBcUIsZUFBZSxLQUFLLEtBQUs7QUFDN0osY0FBTTtBQUFBLFVBQ0wsSUFBSSxlQUFlLGVBQWUsZUFBZSxhQUFhLEtBQUssR0FBRyxlQUFlLEVBQUU7QUFBQSxVQUN2RjtBQUFBLFVBQ0E7QUFBQSxVQUNBLE1BQU0sQ0FBQztBQUFBLFlBQ04sSUFBSSxPQUFPO0FBQUEsWUFDWCxNQUFNLGVBQWU7QUFBQSxVQUN0QixDQUFDO0FBQUEsVUFDRCxZQUFZO0FBQUEsWUFDWCxNQUFNLGVBQWUsSUFBSSxHQUFHLGVBQWUsRUFBRSxTQUFTO0FBQUEsWUFDdEQsUUFBUSxpQkFBaUI7QUFBQSxZQUN6QixTQUFTLGVBQWUsY0FBYyxhQUFhO0FBQUEsWUFDbkQsV0FBVyxlQUFlLGNBQWMsYUFBYTtBQUFBLFlBQ3JELE9BQU8sZUFBZSxjQUFjLGFBQWE7QUFBQSxZQUNqRCxLQUFLLGVBQWUsY0FBYyxhQUFhO0FBQUEsWUFDL0MsS0FBSyxlQUFlLGNBQWMsYUFBYTtBQUFBLFVBQ2hEO0FBQUEsVUFDQSxVQUFVO0FBQUEsWUFDVCxhQUFhLE1BQU07QUFBQSxZQUNuQixNQUFNO0FBQUEsY0FDTDtBQUFBLGdCQUNDLE1BQU07QUFBQSxnQkFDTixhQUFhO0FBQUEsZ0JBQ2IsUUFBUTtBQUFBLGtCQUNQLE1BQU07QUFBQSxrQkFDTixZQUFZO0FBQUEsb0JBQ1gsaUJBQWlCO0FBQUEsc0JBQ2hCLE1BQU07QUFBQSxzQkFDTixTQUFTO0FBQUEsb0JBQ1Y7QUFBQSxrQkFDRDtBQUFBLGdCQUNEO0FBQUEsY0FDRDtBQUFBLFlBQ0Q7QUFBQSxVQUNEO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsSUFBSSxVQUE0QixTQUE2QztBQUM1RSxpQkFBUyxJQUFJLGFBQWEsRUFBRSxTQUFTLGVBQWUsSUFBSSxDQUFDLFNBQVMsYUFBYTtBQUFBLE1BQ2hGO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsZ0NBQWdDLGdCQUE4QztBQUNyRixXQUFPLGdCQUFnQixNQUFNLGdDQUFnQyxRQUFRO0FBQUEsTUFDcEUsY0FBYztBQUNiLGNBQU07QUFBQSxVQUNMLElBQUksR0FBRyxlQUFlLEVBQUU7QUFBQSxVQUN4QixPQUFPLFVBQVUscUJBQXFCLGdCQUFnQjtBQUFBLFVBQ3RELE1BQU0sQ0FBQztBQUFBLFlBQ04sSUFBSSxPQUFPO0FBQUEsWUFDWCxNQUFNLGVBQWU7QUFBQSxjQUNwQixlQUFlO0FBQUEsZ0JBQ2QsZUFBZSxPQUFPLFFBQVEsZUFBZSxFQUFFO0FBQUEsZ0JBQy9DLGVBQWUsT0FBTyxHQUFHLGVBQWUsRUFBRSx3QkFBd0IsS0FBSztBQUFBLGNBQ3hFO0FBQUEsWUFDRDtBQUFBLFlBQ0EsT0FBTztBQUFBLFlBQ1AsT0FBTztBQUFBLFVBQ1IsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLElBQUksVUFBa0M7QUFDckMsY0FBTSx3QkFBd0IsU0FBUyxJQUFJLHNCQUFzQjtBQUNqRSxjQUFNLG1CQUFtQixzQkFBc0Isd0JBQXdCLGVBQWUsRUFBRTtBQUN4RixjQUFNLGlCQUFpQixzQkFBc0Isc0JBQXNCLGdCQUFnQjtBQUduRixZQUFJLGlCQUFpQixlQUFlLGVBQWUsdUJBQXVCLFdBQVcsR0FBRztBQUN2RixnQkFBTSxrQkFBa0Isc0JBQXNCLGdDQUFnQyxnQkFBZ0I7QUFDOUYsZ0NBQXNCLDRCQUE0QixrQkFBa0IsaUJBQWlCLFFBQVcsS0FBSyxLQUFLLEVBQUU7QUFBQSxRQUM3RztBQUVBLDhCQUFzQixxQkFBcUIsQ0FBQyxjQUFjLEdBQUcsa0JBQWtCLFFBQVcsS0FBSyxLQUFLLEVBQUU7QUFDdEcsaUJBQVMsSUFBSSxhQUFhLEVBQUUsU0FBUyxlQUFlLElBQUksSUFBSTtBQUFBLE1BQzdEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsc0JBQXNCLGVBQThCLHVCQUFvRDtBQUMvRyxVQUFNLE9BQU87QUFDYixRQUFNLGdCQUFOLGNBQTRCLGNBQWM7QUFBQSxNQUN6QyxZQUNvQixrQkFDTyxnQkFDVCxnQkFDTSxzQkFDUixjQUNNLG9CQUNGLGtCQUNsQjtBQUNELGNBQU0sY0FBYyxJQUFJLGtCQUFrQixnQkFBZ0Isc0JBQXNCLGNBQWMsb0JBQW9CLGtCQUFrQixjQUFjO0FBQUEsTUFDbko7QUFBQSxNQUVVLHdCQUF3QixTQUF5QztBQUMxRSxjQUFNLCtCQUErQixLQUFLLFVBQVUsSUFBSSxnQkFBZ0IsQ0FBQztBQUd6RSxjQUFNLG9CQUFvQixLQUFLLHdCQUF3QixTQUFTLGVBQWUsdUJBQXVCLDhCQUE4QixLQUFLLG9CQUFvQjtBQUc3SixZQUFJLEVBQUUsNkJBQTZCLDBCQUEwQjtBQUM1RCx1Q0FBNkIsSUFBSSxNQUFNLElBQUksa0JBQWtCLGVBQWUsa0JBQWtCLGtCQUFrQixrQkFBa0IsaUJBQWlCLEVBQUUsTUFBTTtBQUUxSixpQkFBSyxnQkFBZ0I7QUFBQSxVQUN0QixDQUFDLENBQUM7QUFBQSxRQUNIO0FBRUEsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBN0JNLG9CQUFOO0FBQUEsTUFFRztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE9BUkc7QUErQk4sYUFBUyxHQUEwQiwwQkFBMEIscUJBQXFCLENBQUMsRUFBRSxzQkFBc0Isd0JBQXdCO0FBQUEsTUFDbEk7QUFBQSxNQUNBLGNBQWM7QUFBQSxNQUNkLE9BQU8sY0FBYyxVQUFVLFdBQVcsY0FBYyxRQUFRLGNBQWMsTUFBTTtBQUFBLE1BQ3BGLFNBQVMsY0FBYyxJQUFJLElBQUksY0FBYyxPQUFPO0FBQUEsTUFDcEQsY0FBYztBQUFBLE1BQ2QsY0FBYztBQUFBLE1BQ2QsY0FBYyxnQkFBZ0IsTUFBTSxjQUFjLE9BQU87QUFBQSxJQUMxRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsd0JBQXdCLGVBQThCLHVCQUFvRDtBQUNqSCxhQUFTLEdBQTBCLDBCQUEwQixxQkFBcUIsQ0FBQyxFQUFFLHdCQUF3QixjQUFjLEVBQUU7QUFBQSxFQUM5SDtBQUFBLEVBRVEsd0JBQXdCLFNBQXNCLGVBQThCLHVCQUE4QyxhQUE4QixzQkFBZ0U7QUFDL04sVUFBTSxvQkFBd0MscUJBQTZCLGVBQWUsY0FBYyxlQUFlLE1BQU0sR0FBSSxjQUFjLGVBQWUsbUJBQW1CLENBQUMsQ0FBRTtBQUVwTCxTQUFLLG1CQUFtQixJQUFJLGtCQUFrQixNQUFNLEdBQUcsaUJBQWlCO0FBQ3hFLGdCQUFZLElBQUksYUFBYSxNQUFNLEtBQUssbUJBQW1CLE9BQU8sa0JBQWtCLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDN0YsZ0JBQVksSUFBSSxrQkFBa0IsY0FBYyxXQUFTLEtBQUssYUFBYSxLQUFLLENBQUMsQ0FBQztBQUNsRixnQkFBWSxJQUFJLGtCQUFrQiwwQkFBMEIsVUFBUSxLQUFLLHlCQUF5QixNQUFNLEtBQUssY0FBYyxDQUFDLENBQUMsQ0FBQztBQUM5SCxnQkFBWSxJQUFJLGtCQUFrQixpQkFBaUIsV0FBUyxLQUFLLGVBQWUsS0FBSyxDQUFDLENBQUM7QUFDdkYsZ0JBQVksSUFBSSxrQkFBa0IsZUFBZSxVQUFRO0FBQ3hELFVBQUksS0FBSyxzQkFBc0IsSUFBSSxNQUFNLEtBQUssSUFBSTtBQUNqRCxhQUFLLHNCQUFzQixJQUFJLEtBQUssRUFBRTtBQUN0QyxhQUFLLHdCQUF3QixLQUFLO0FBQUEsTUFDbkM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLGdCQUFZLElBQUksa0JBQWtCLGNBQWMsVUFBUTtBQUN2RCxVQUFJLEtBQUssc0JBQXNCLElBQUksTUFBTSxLQUFLLElBQUk7QUFDakQsYUFBSyxzQkFBc0IsTUFBTTtBQUNqQyxhQUFLLHdCQUF3QixLQUFLO0FBQUEsTUFDbkM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFqcEJhLGVBQU47QUFBQSxFQXNCSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQTFCVTtBQW1wQmIsU0FBUyxrQ0FBa0MsaUJBQWlDO0FBQUUsU0FBTyxpQkFBaUIsZUFBZTtBQUFZO0FBRWpJLFNBQVMsMEJBQTBCLHVCQUFzRDtBQUN4RixVQUFRLHVCQUF1QjtBQUFBLElBQzlCLEtBQUssc0JBQXNCO0FBQzFCLGFBQU8sd0JBQXdCO0FBQUEsSUFDaEMsS0FBSyxzQkFBc0I7QUFDMUIsYUFBTyx3QkFBd0I7QUFBQSxJQUNoQyxLQUFLLHNCQUFzQjtBQUFBLElBQzNCO0FBQ0MsYUFBTyx3QkFBd0I7QUFBQSxFQUNqQztBQUNEO0FBRU8sU0FBUyxrQkFBa0IsdUJBQStHO0FBQ2hKLFVBQVEsdUJBQXVCO0FBQUEsSUFDOUIsS0FBSyxzQkFBc0I7QUFDMUIsYUFBTyxNQUFNO0FBQUEsSUFDZCxLQUFLLHNCQUFzQjtBQUMxQixhQUFPLE1BQU07QUFBQSxJQUNkLEtBQUssc0JBQXNCO0FBQUEsSUFDM0I7QUFDQyxhQUFPLE1BQU07QUFBQSxFQUNmO0FBQ0Q7QUFFQTtBQUFBLEVBQWtCO0FBQUEsRUFBZTtBQUFBLEVBQWMsa0JBQWtCO0FBQUE7QUFBd0g7IiwKICAibmFtZXMiOiBbXQp9Cg==
