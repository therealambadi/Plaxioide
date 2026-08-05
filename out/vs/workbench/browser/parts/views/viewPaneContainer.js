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
import { $, addDisposableListener, DragAndDropObserver, EventType, getWindow, isAncestor } from "../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { EventType as TouchEventType, Gesture } from "../../../../base/browser/touch.js";
import { Orientation } from "../../../../base/browser/ui/sash/sash.js";
import { PaneView } from "../../../../base/browser/ui/splitview/paneview.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { combinedDisposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import "./media/paneviewlet.css";
import * as nls from "../../../../nls.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { activeContrastBorder, asCssVariable } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { CompositeMenuActions } from "../../actions.js";
import { CompositeDragAndDropObserver, toggleDropEffect } from "../../dnd.js";
import { Component } from "../../../common/component.js";
import { PANEL_SECTION_BORDER, PANEL_SECTION_DRAG_AND_DROP_BACKGROUND, PANEL_SECTION_HEADER_BACKGROUND, PANEL_SECTION_HEADER_BORDER, PANEL_SECTION_HEADER_FOREGROUND, SIDE_BAR_DRAG_AND_DROP_BACKGROUND, SIDE_BAR_SECTION_HEADER_BACKGROUND, SIDE_BAR_SECTION_HEADER_BORDER, SIDE_BAR_SECTION_HEADER_FOREGROUND } from "../../../common/theme.js";
import { IViewDescriptorService, ViewContainerLocation, ViewContainerLocationToString, ViewVisibilityState } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { FocusedViewContext } from "../../../common/contextkeys.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { isHorizontal, IWorkbenchLayoutService, LayoutSettings } from "../../../services/layout/browser/layoutService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
const ViewsSubMenu = new MenuId("Views");
MenuRegistry.appendMenuItem(MenuId.ViewContainerTitle, {
  submenu: ViewsSubMenu,
  title: nls.localize("views", "Views"),
  order: 1
});
var DropDirection = /* @__PURE__ */ ((DropDirection2) => {
  DropDirection2[DropDirection2["UP"] = 0] = "UP";
  DropDirection2[DropDirection2["DOWN"] = 1] = "DOWN";
  DropDirection2[DropDirection2["LEFT"] = 2] = "LEFT";
  DropDirection2[DropDirection2["RIGHT"] = 3] = "RIGHT";
  return DropDirection2;
})(DropDirection || {});
const _ViewPaneDropOverlay = class _ViewPaneDropOverlay extends Themable {
  constructor(paneElement, orientation, bounds, location, themeService) {
    super(themeService);
    this.paneElement = paneElement;
    this.orientation = orientation;
    this.bounds = bounds;
    this.location = location;
    this.cleanupOverlayScheduler = this._register(new RunOnceScheduler(() => this.dispose(), 300));
    this.create();
  }
  get currentDropOperation() {
    return this._currentDropOperation;
  }
  get disposed() {
    return !!this._disposed;
  }
  create() {
    this.container = $("div", { id: _ViewPaneDropOverlay.OVERLAY_ID });
    this.container.style.top = "0px";
    this.paneElement.appendChild(this.container);
    this.paneElement.classList.add("dragged-over");
    this._register(toDisposable(() => {
      this.container.remove();
      this.paneElement.classList.remove("dragged-over");
    }));
    this.overlay = $(".pane-overlay-indicator");
    this.container.appendChild(this.overlay);
    this.registerListeners();
    this.updateStyles();
  }
  updateStyles() {
    this.overlay.style.backgroundColor = this.getColor(this.location === ViewContainerLocation.Panel ? PANEL_SECTION_DRAG_AND_DROP_BACKGROUND : SIDE_BAR_DRAG_AND_DROP_BACKGROUND) || "";
    const activeContrastBorderColor = this.getColor(activeContrastBorder);
    this.overlay.style.outlineColor = activeContrastBorderColor || "";
    this.overlay.style.outlineOffset = activeContrastBorderColor ? "-2px" : "";
    this.overlay.style.outlineStyle = activeContrastBorderColor ? "dashed" : "";
    this.overlay.style.outlineWidth = activeContrastBorderColor ? "2px" : "";
    this.overlay.style.borderColor = activeContrastBorderColor || "";
    this.overlay.style.borderStyle = "solid";
    this.overlay.style.borderWidth = "0px";
  }
  registerListeners() {
    this._register(new DragAndDropObserver(this.container, {
      onDragOver: (e) => {
        this.positionOverlay(e.offsetX, e.offsetY);
        if (this.cleanupOverlayScheduler.isScheduled()) {
          this.cleanupOverlayScheduler.cancel();
        }
      },
      onDragLeave: (e) => this.dispose(),
      onDragEnd: (e) => this.dispose(),
      onDrop: (e) => {
        this.dispose();
      }
    }));
    this._register(addDisposableListener(this.container, EventType.MOUSE_OVER, () => {
      if (!this.cleanupOverlayScheduler.isScheduled()) {
        this.cleanupOverlayScheduler.schedule();
      }
    }));
  }
  positionOverlay(mousePosX, mousePosY) {
    const paneWidth = this.paneElement.clientWidth;
    const paneHeight = this.paneElement.clientHeight;
    const splitWidthThreshold = paneWidth / 2;
    const splitHeightThreshold = paneHeight / 2;
    let dropDirection;
    if (this.orientation === Orientation.VERTICAL) {
      if (mousePosY < splitHeightThreshold) {
        dropDirection = 0 /* UP */;
      } else if (mousePosY >= splitHeightThreshold) {
        dropDirection = 1 /* DOWN */;
      }
    } else if (this.orientation === Orientation.HORIZONTAL) {
      if (mousePosX < splitWidthThreshold) {
        dropDirection = 2 /* LEFT */;
      } else if (mousePosX >= splitWidthThreshold) {
        dropDirection = 3 /* RIGHT */;
      }
    }
    switch (dropDirection) {
      case 0 /* UP */:
        this.doPositionOverlay({ top: "0", left: "0", width: "100%", height: "50%" });
        break;
      case 1 /* DOWN */:
        this.doPositionOverlay({ bottom: "0", left: "0", width: "100%", height: "50%" });
        break;
      case 2 /* LEFT */:
        this.doPositionOverlay({ top: "0", left: "0", width: "50%", height: "100%" });
        break;
      case 3 /* RIGHT */:
        this.doPositionOverlay({ top: "0", right: "0", width: "50%", height: "100%" });
        break;
      default: {
        let top = "0";
        let left = "0";
        let width = "100%";
        let height = "100%";
        if (this.bounds) {
          const boundingRect = this.container.getBoundingClientRect();
          top = `${this.bounds.top - boundingRect.top}px`;
          left = `${this.bounds.left - boundingRect.left}px`;
          height = `${this.bounds.bottom - this.bounds.top}px`;
          width = `${this.bounds.right - this.bounds.left}px`;
        }
        this.doPositionOverlay({ top, left, width, height });
      }
    }
    if (this.orientation === Orientation.VERTICAL && paneHeight <= 25 || this.orientation === Orientation.HORIZONTAL && paneWidth <= 25) {
      this.doUpdateOverlayBorder(dropDirection);
    } else {
      this.doUpdateOverlayBorder(void 0);
    }
    this.overlay.style.opacity = "1";
    setTimeout(() => this.overlay.classList.add("overlay-move-transition"), 0);
    this._currentDropOperation = dropDirection;
  }
  doUpdateOverlayBorder(direction) {
    this.overlay.style.borderTopWidth = direction === 0 /* UP */ ? "2px" : "0px";
    this.overlay.style.borderLeftWidth = direction === 2 /* LEFT */ ? "2px" : "0px";
    this.overlay.style.borderBottomWidth = direction === 1 /* DOWN */ ? "2px" : "0px";
    this.overlay.style.borderRightWidth = direction === 3 /* RIGHT */ ? "2px" : "0px";
  }
  doPositionOverlay(options) {
    this.container.style.height = "100%";
    this.overlay.style.top = options.top || "";
    this.overlay.style.left = options.left || "";
    this.overlay.style.bottom = options.bottom || "";
    this.overlay.style.right = options.right || "";
    this.overlay.style.width = options.width;
    this.overlay.style.height = options.height;
  }
  contains(element) {
    return element === this.container || element === this.overlay;
  }
  dispose() {
    super.dispose();
    this._disposed = true;
  }
};
_ViewPaneDropOverlay.OVERLAY_ID = "monaco-pane-drop-overlay";
let ViewPaneDropOverlay = _ViewPaneDropOverlay;
let ViewContainerMenuActions = class extends CompositeMenuActions {
  constructor(element, viewContainer, viewDescriptorService, contextKeyService, menuService) {
    const scopedContextKeyService = contextKeyService.createScoped(element);
    scopedContextKeyService.createKey("viewContainer", viewContainer.id);
    const viewContainerLocationKey = scopedContextKeyService.createKey("viewContainerLocation", ViewContainerLocationToString(viewDescriptorService.getViewContainerLocation(viewContainer)));
    super(MenuId.ViewContainerTitle, MenuId.ViewContainerTitleContext, { shouldForwardArgs: true, renderShortTitle: true }, scopedContextKeyService, menuService);
    this._register(scopedContextKeyService);
    this._register(Event.filter(viewDescriptorService.onDidChangeContainerLocation, (e) => e.viewContainer === viewContainer)(() => viewContainerLocationKey.set(ViewContainerLocationToString(viewDescriptorService.getViewContainerLocation(viewContainer)))));
  }
};
ViewContainerMenuActions = __decorateClass([
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IMenuService)
], ViewContainerMenuActions);
let ViewPaneContainer = class extends Component {
  constructor(id, options, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService, logService) {
    super(id, themeService, storageService);
    this.options = options;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.layoutService = layoutService;
    this.contextMenuService = contextMenuService;
    this.telemetryService = telemetryService;
    this.extensionService = extensionService;
    this.storageService = storageService;
    this.contextService = contextService;
    this.viewDescriptorService = viewDescriptorService;
    this.logService = logService;
    this.paneItems = [];
    this.visible = false;
    this.areExtensionsReady = false;
    this.didLayout = false;
    this._onTitleAreaUpdate = this._register(new Emitter());
    this.onTitleAreaUpdate = this._onTitleAreaUpdate.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._onDidAddViews = this._register(new Emitter());
    this.onDidAddViews = this._onDidAddViews.event;
    this._onDidRemoveViews = this._register(new Emitter());
    this.onDidRemoveViews = this._onDidRemoveViews.event;
    this._onDidChangeViewVisibility = this._register(new Emitter());
    this.onDidChangeViewVisibility = this._onDidChangeViewVisibility.event;
    this._onDidFocusView = this._register(new Emitter());
    this.onDidFocusView = this._onDidFocusView.event;
    this._onDidBlurView = this._register(new Emitter());
    this.onDidBlurView = this._onDidBlurView.event;
    const container = this.viewDescriptorService.getViewContainerById(id);
    if (!container) {
      throw new Error("Could not find container");
    }
    this.viewContainer = container;
    this.visibleViewsStorageId = `${id}.numberOfVisibleViews`;
    this.visibleViewsCountFromCache = this.storageService.getNumber(this.visibleViewsStorageId, StorageScope.WORKSPACE, void 0);
    this.viewContainerModel = this.viewDescriptorService.getViewContainerModel(container);
  }
  get onDidSashChange() {
    return assertIsDefined(this.paneview).onDidSashChange;
  }
  get panes() {
    return this.paneItems.map((i) => i.pane);
  }
  get views() {
    return this.panes;
  }
  get length() {
    return this.paneItems.length;
  }
  get menuActions() {
    return this._menuActions;
  }
  create(parent) {
    const options = this.options;
    options.orientation = this.orientation;
    this.paneview = this._register(new PaneView(parent, this.options));
    if (this._boundarySashes) {
      this.paneview.setBoundarySashes(this._boundarySashes);
    }
    this._register(this.paneview.onDidDrop(({ from, to }) => this.movePane(from, to)));
    this._register(this.paneview.onDidScroll((_) => this.onDidScrollPane()));
    this._register(this.paneview.onDidSashReset((index) => this.onDidSashReset(index)));
    this._register(addDisposableListener(parent, EventType.CONTEXT_MENU, (e) => this.showContextMenu(new StandardMouseEvent(getWindow(parent), e))));
    this._register(Gesture.addTarget(parent));
    this._register(addDisposableListener(parent, TouchEventType.Contextmenu, (e) => this.showContextMenu(new StandardMouseEvent(getWindow(parent), e))));
    this._menuActions = this._register(this.instantiationService.createInstance(ViewContainerMenuActions, this.paneview.element, this.viewContainer));
    this._register(this._menuActions.onDidChange(() => this.updateTitleArea()));
    let overlay;
    const getOverlayBounds = () => {
      const fullSize = parent.getBoundingClientRect();
      const lastPane = this.panes[this.panes.length - 1].element.getBoundingClientRect();
      const top = this.orientation === Orientation.VERTICAL ? lastPane.bottom : fullSize.top;
      const left = this.orientation === Orientation.HORIZONTAL ? lastPane.right : fullSize.left;
      return {
        top,
        bottom: fullSize.bottom,
        left,
        right: fullSize.right
      };
    };
    const inBounds = (bounds2, pos) => {
      return pos.x >= bounds2.left && pos.x <= bounds2.right && pos.y >= bounds2.top && pos.y <= bounds2.bottom;
    };
    let bounds;
    this._register(CompositeDragAndDropObserver.INSTANCE.registerTarget(parent, {
      onDragEnter: (e) => {
        bounds = getOverlayBounds();
        if (overlay && overlay.disposed) {
          overlay = void 0;
        }
        if (!overlay && inBounds(bounds, e.eventData)) {
          const dropData = e.dragAndDropData.getData();
          if (dropData.type === "view") {
            const oldViewContainer = this.viewDescriptorService.getViewContainerByViewId(dropData.id);
            const viewDescriptor = this.viewDescriptorService.getViewDescriptorById(dropData.id);
            if (oldViewContainer !== this.viewContainer && (!viewDescriptor || !viewDescriptor.canMoveView || this.viewContainer.rejectAddedViews)) {
              return;
            }
            overlay = new ViewPaneDropOverlay(parent, void 0, bounds, this.viewDescriptorService.getViewContainerLocation(this.viewContainer), this.themeService);
          }
          if (dropData.type === "composite" && dropData.id !== this.viewContainer.id) {
            const container = this.viewDescriptorService.getViewContainerById(dropData.id);
            const viewsToMove = this.viewDescriptorService.getViewContainerModel(container).allViewDescriptors;
            if (!viewsToMove.some((v) => !v.canMoveView) && viewsToMove.length > 0) {
              overlay = new ViewPaneDropOverlay(parent, void 0, bounds, this.viewDescriptorService.getViewContainerLocation(this.viewContainer), this.themeService);
            }
          }
        }
      },
      onDragOver: (e) => {
        if (overlay && overlay.disposed) {
          overlay = void 0;
        }
        if (overlay && !inBounds(bounds, e.eventData)) {
          overlay.dispose();
          overlay = void 0;
        }
        if (inBounds(bounds, e.eventData)) {
          toggleDropEffect(e.eventData.dataTransfer, "move", overlay !== void 0);
        }
      },
      onDragLeave: (e) => {
        overlay?.dispose();
        overlay = void 0;
      },
      onDrop: (e) => {
        if (overlay) {
          const dropData = e.dragAndDropData.getData();
          const viewsToMove = [];
          if (dropData.type === "composite" && dropData.id !== this.viewContainer.id) {
            const container = this.viewDescriptorService.getViewContainerById(dropData.id);
            const allViews = this.viewDescriptorService.getViewContainerModel(container).allViewDescriptors;
            if (!allViews.some((v) => !v.canMoveView)) {
              viewsToMove.push(...allViews);
            }
          } else if (dropData.type === "view") {
            const oldViewContainer = this.viewDescriptorService.getViewContainerByViewId(dropData.id);
            const viewDescriptor = this.viewDescriptorService.getViewDescriptorById(dropData.id);
            if (oldViewContainer !== this.viewContainer && viewDescriptor && viewDescriptor.canMoveView) {
              this.viewDescriptorService.moveViewsToContainer([viewDescriptor], this.viewContainer, void 0, "dnd");
            }
          }
          const paneCount = this.panes.length;
          if (viewsToMove.length > 0) {
            this.viewDescriptorService.moveViewsToContainer(viewsToMove, this.viewContainer, void 0, "dnd");
          }
          if (paneCount > 0) {
            for (const view of viewsToMove) {
              const paneToMove = this.panes.find((p) => p.id === view.id);
              if (paneToMove) {
                this.movePane(paneToMove, this.panes[this.panes.length - 1]);
              }
            }
          }
        }
        overlay?.dispose();
        overlay = void 0;
      }
    }));
    this._register(this.onDidSashChange(() => this.saveViewSizes()));
    this._register(this.viewContainerModel.onDidAddVisibleViewDescriptors((added) => this.onDidAddViewDescriptors(added)));
    this._register(this.viewContainerModel.onDidRemoveVisibleViewDescriptors((removed) => this.onDidRemoveViewDescriptors(removed)));
    const addedViews = this.viewContainerModel.visibleViewDescriptors.map((viewDescriptor, index) => {
      const size = this.viewContainerModel.getSize(viewDescriptor.id);
      const collapsed = this.viewContainerModel.isCollapsed(viewDescriptor.id);
      return { viewDescriptor, index, size, collapsed };
    });
    if (addedViews.length) {
      this.onDidAddViewDescriptors(addedViews);
    }
    this.extensionService.whenInstalledExtensionsRegistered().then(() => {
      this.areExtensionsReady = true;
      if (this.panes.length) {
        this.updateTitleArea();
        this.updateViewHeaders();
      }
      this._register(this.configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION)) {
          this.updateViewHeaders();
        }
      }));
    });
    this._register(this.viewContainerModel.onDidChangeActiveViewDescriptors(() => this._onTitleAreaUpdate.fire()));
  }
  getTitle() {
    const containerTitle = this.viewContainerModel.title;
    if (this.isViewMergedWithContainer()) {
      const singleViewPaneContainerTitle = this.paneItems[0].pane.singleViewPaneContainerTitle;
      if (singleViewPaneContainerTitle) {
        return singleViewPaneContainerTitle;
      }
      const paneItemTitle = this.paneItems[0].pane.title;
      if (containerTitle === paneItemTitle) {
        return paneItemTitle;
      }
      return paneItemTitle ? `${containerTitle}: ${paneItemTitle}` : containerTitle;
    }
    return containerTitle;
  }
  showContextMenu(event) {
    for (const paneItem of this.paneItems) {
      if (isAncestor(event.target, paneItem.pane.element)) {
        return;
      }
    }
    event.stopPropagation();
    event.preventDefault();
    this.contextMenuService.showContextMenu({
      getAnchor: () => event,
      getActions: () => this.menuActions?.getContextMenuActions() ?? []
    });
  }
  getActionsContext() {
    if (this.isViewMergedWithContainer()) {
      return this.panes[0].getActionsContext();
    }
    return void 0;
  }
  getActionViewItem(action, options) {
    if (this.isViewMergedWithContainer()) {
      return this.paneItems[0].pane.createActionViewItem(action, options);
    }
    return createActionViewItem(this.instantiationService, action, options);
  }
  focus() {
    let paneToFocus = void 0;
    if (this.lastFocusedPane) {
      paneToFocus = this.lastFocusedPane;
    } else if (this.paneItems.length > 0) {
      for (const { pane } of this.paneItems) {
        if (pane.isExpanded()) {
          paneToFocus = pane;
          break;
        }
      }
    }
    if (paneToFocus) {
      paneToFocus.focus();
    }
  }
  get orientation() {
    switch (this.viewDescriptorService.getViewContainerLocation(this.viewContainer)) {
      case ViewContainerLocation.Sidebar:
      case ViewContainerLocation.AuxiliaryBar:
        return Orientation.VERTICAL;
      case ViewContainerLocation.Panel: {
        return isHorizontal(this.layoutService.getPanelPosition()) ? Orientation.HORIZONTAL : Orientation.VERTICAL;
      }
    }
    return Orientation.VERTICAL;
  }
  layout(dimension) {
    if (this.paneview) {
      if (this.paneview.orientation !== this.orientation) {
        this.paneview.flipOrientation(dimension.height, dimension.width);
      }
      this.paneview.layout(dimension.height, dimension.width);
    }
    this.dimension = dimension;
    if (this.didLayout) {
      this.saveViewSizes();
    } else {
      this.didLayout = true;
      this.restoreViewSizes();
    }
  }
  setBoundarySashes(sashes) {
    this._boundarySashes = sashes;
    this.paneview?.setBoundarySashes(sashes);
  }
  getOptimalWidth() {
    const additionalMargin = 16;
    const optimalWidth = Math.max(...this.panes.map((view) => view.getOptimalWidth() || 0));
    return optimalWidth + additionalMargin;
  }
  addPanes(panes) {
    const wasMerged = this.isViewMergedWithContainer();
    for (const { pane, size, index, disposable } of panes) {
      this.addPane(pane, size, disposable, index);
    }
    this.updateViewHeaders();
    if (this.isViewMergedWithContainer() !== wasMerged) {
      this.updateTitleArea();
    }
    this._onDidAddViews.fire(panes.map(({ pane }) => pane));
  }
  setVisible(visible) {
    if (this.visible !== !!visible) {
      this.visible = visible;
      this._onDidChangeVisibility.fire(visible);
    }
    this.panes.filter((view) => view.isVisible() !== visible).map((view) => view.setVisible(visible));
  }
  isVisible() {
    return this.visible;
  }
  updateTitleArea() {
    this._onTitleAreaUpdate.fire();
  }
  createView(viewDescriptor, options) {
    return this.instantiationService.createInstance(viewDescriptor.ctorDescriptor.ctor, ...viewDescriptor.ctorDescriptor.staticArguments || [], options);
  }
  getView(id) {
    return this.panes.filter((view) => view.id === id)[0];
  }
  saveViewSizes() {
    if (this.didLayout) {
      this.viewContainerModel.setSizes(this.panes.map((view) => ({ id: view.id, size: this.getPaneSize(view) })));
    }
  }
  restoreViewSizes() {
    if (this.didLayout) {
      let initialSizes;
      for (let i = 0; i < this.viewContainerModel.visibleViewDescriptors.length; i++) {
        const pane = this.panes[i];
        const viewDescriptor = this.viewContainerModel.visibleViewDescriptors[i];
        const size = this.viewContainerModel.getSize(viewDescriptor.id);
        if (typeof size === "number") {
          this.resizePane(pane, size);
        } else {
          initialSizes = initialSizes ? initialSizes : this.computeInitialSizes();
          this.resizePane(pane, initialSizes.get(pane.id) || 200);
        }
      }
    }
  }
  computeInitialSizes() {
    const sizes = /* @__PURE__ */ new Map();
    if (this.dimension) {
      const totalWeight = this.viewContainerModel.visibleViewDescriptors.reduce((totalWeight2, { weight }) => totalWeight2 + (weight || 20), 0);
      for (const viewDescriptor of this.viewContainerModel.visibleViewDescriptors) {
        if (this.orientation === Orientation.VERTICAL) {
          sizes.set(viewDescriptor.id, this.dimension.height * (viewDescriptor.weight || 20) / totalWeight);
        } else {
          sizes.set(viewDescriptor.id, this.dimension.width * (viewDescriptor.weight || 20) / totalWeight);
        }
      }
    }
    return sizes;
  }
  saveState() {
    this.panes.forEach((view) => view.saveState());
    this.storageService.store(this.visibleViewsStorageId, this.length, StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  onContextMenu(event, viewPane) {
    event.stopPropagation();
    event.preventDefault();
    const actions = viewPane.menuActions.getContextMenuActions();
    this.contextMenuService.showContextMenu({
      getAnchor: () => event,
      getActions: () => actions
    });
  }
  openView(id, focus) {
    let view = this.getView(id);
    if (!view) {
      this.toggleViewVisibility(id);
    }
    view = this.getView(id);
    if (view) {
      view.setExpanded(true);
      if (focus) {
        view.focus();
      }
    }
    return view;
  }
  onDidAddViewDescriptors(added) {
    const panesToAdd = [];
    for (const { viewDescriptor, collapsed, index, size } of added) {
      const pane = this.createView(
        viewDescriptor,
        {
          id: viewDescriptor.id,
          title: viewDescriptor.name.value,
          fromExtensionId: viewDescriptor.extensionId,
          expanded: !collapsed,
          singleViewPaneContainerTitle: viewDescriptor.singleViewPaneContainerTitle
        }
      );
      try {
        pane.render();
      } catch (error) {
        this.logService.error(`Fail to render view ${viewDescriptor.id}`, error);
        continue;
      }
      if (pane.draggableElement) {
        const contextMenuDisposable = addDisposableListener(pane.draggableElement, "contextmenu", (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.onContextMenu(new StandardMouseEvent(getWindow(pane.draggableElement), e), pane);
        });
        const collapseDisposable = Event.latch(Event.map(pane.onDidChange, () => !pane.isExpanded()))((collapsed2) => {
          this.viewContainerModel.setCollapsed(viewDescriptor.id, collapsed2);
        });
        panesToAdd.push({ pane, size: size || pane.minimumSize, index, disposable: combinedDisposable(contextMenuDisposable, collapseDisposable) });
      }
    }
    this.addPanes(panesToAdd);
    this.restoreViewSizes();
    const panes = [];
    for (const { pane } of panesToAdd) {
      pane.setVisible(this.isVisible());
      panes.push(pane);
    }
    return panes;
  }
  onDidRemoveViewDescriptors(removed) {
    removed = removed.sort((a, b) => b.index - a.index);
    const panesToRemove = [];
    for (const { index } of removed) {
      const paneItem = this.paneItems[index];
      if (paneItem) {
        panesToRemove.push(this.paneItems[index].pane);
      }
    }
    if (panesToRemove.length) {
      this.removePanes(panesToRemove);
      for (const pane of panesToRemove) {
        pane.setVisible(false);
      }
    }
  }
  toggleViewVisibility(viewId) {
    if (this.viewContainerModel.activeViewDescriptors.some((viewDescriptor) => viewDescriptor.id === viewId)) {
      const visible = !this.viewContainerModel.isVisible(viewId);
      this.viewContainerModel.setVisible(viewId, visible);
    }
  }
  addPane(pane, size, disposable, index = this.paneItems.length - 1) {
    const onDidFocus = pane.onDidFocus(() => {
      this._onDidFocusView.fire(pane);
      this.lastFocusedPane = pane;
    });
    const onDidBlur = pane.onDidBlur(() => this._onDidBlurView.fire(pane));
    const onDidChangeTitleArea = pane.onDidChangeTitleArea(() => {
      if (this.isViewMergedWithContainer()) {
        this.updateTitleArea();
      }
    });
    const onDidChangeVisibility = pane.onDidChangeBodyVisibility(() => this._onDidChangeViewVisibility.fire(pane));
    const onDidChange = pane.onDidChange(() => {
      if (pane === this.lastFocusedPane && !pane.isExpanded()) {
        this.lastFocusedPane = void 0;
      }
    });
    const isPanel = this.viewDescriptorService.getViewContainerLocation(this.viewContainer) === ViewContainerLocation.Panel;
    pane.style({
      headerForeground: asCssVariable(isPanel ? PANEL_SECTION_HEADER_FOREGROUND : SIDE_BAR_SECTION_HEADER_FOREGROUND),
      headerBackground: asCssVariable(isPanel ? PANEL_SECTION_HEADER_BACKGROUND : SIDE_BAR_SECTION_HEADER_BACKGROUND),
      headerBorder: asCssVariable(isPanel ? PANEL_SECTION_HEADER_BORDER : SIDE_BAR_SECTION_HEADER_BORDER),
      dropBackground: asCssVariable(isPanel ? PANEL_SECTION_DRAG_AND_DROP_BACKGROUND : SIDE_BAR_DRAG_AND_DROP_BACKGROUND),
      leftBorder: isPanel ? asCssVariable(PANEL_SECTION_BORDER) : void 0
    });
    const store = new DisposableStore();
    store.add(disposable);
    store.add(combinedDisposable(pane, onDidFocus, onDidBlur, onDidChangeTitleArea, onDidChange, onDidChangeVisibility));
    const paneItem = { pane, disposable: store };
    this.paneItems.splice(index, 0, paneItem);
    assertIsDefined(this.paneview).addPane(pane, size, index);
    let overlay;
    if (pane.draggableElement) {
      store.add(CompositeDragAndDropObserver.INSTANCE.registerDraggable(pane.draggableElement, () => {
        return { type: "view", id: pane.id };
      }, {}));
    }
    store.add(CompositeDragAndDropObserver.INSTANCE.registerTarget(pane.dropTargetElement, {
      onDragEnter: (e) => {
        if (!overlay) {
          const dropData = e.dragAndDropData.getData();
          if (dropData.type === "view" && dropData.id !== pane.id) {
            const oldViewContainer = this.viewDescriptorService.getViewContainerByViewId(dropData.id);
            const viewDescriptor = this.viewDescriptorService.getViewDescriptorById(dropData.id);
            if (oldViewContainer !== this.viewContainer && (!viewDescriptor || !viewDescriptor.canMoveView || this.viewContainer.rejectAddedViews)) {
              return;
            }
            overlay = new ViewPaneDropOverlay(pane.dropTargetElement, this.orientation ?? Orientation.VERTICAL, void 0, this.viewDescriptorService.getViewContainerLocation(this.viewContainer), this.themeService);
          }
          if (dropData.type === "composite" && dropData.id !== this.viewContainer.id && !this.viewContainer.rejectAddedViews) {
            const container = this.viewDescriptorService.getViewContainerById(dropData.id);
            const viewsToMove = this.viewDescriptorService.getViewContainerModel(container).allViewDescriptors;
            if (!viewsToMove.some((v) => !v.canMoveView) && viewsToMove.length > 0) {
              overlay = new ViewPaneDropOverlay(pane.dropTargetElement, this.orientation ?? Orientation.VERTICAL, void 0, this.viewDescriptorService.getViewContainerLocation(this.viewContainer), this.themeService);
            }
          }
        }
      },
      onDragOver: (e) => {
        toggleDropEffect(e.eventData.dataTransfer, "move", overlay !== void 0);
      },
      onDragLeave: (e) => {
        overlay?.dispose();
        overlay = void 0;
      },
      onDrop: (e) => {
        if (overlay) {
          const dropData = e.dragAndDropData.getData();
          const viewsToMove = [];
          let anchorView;
          if (dropData.type === "composite" && dropData.id !== this.viewContainer.id && !this.viewContainer.rejectAddedViews) {
            const container = this.viewDescriptorService.getViewContainerById(dropData.id);
            const allViews = this.viewDescriptorService.getViewContainerModel(container).allViewDescriptors;
            if (allViews.length > 0 && !allViews.some((v) => !v.canMoveView)) {
              viewsToMove.push(...allViews);
              anchorView = allViews[0];
            }
          } else if (dropData.type === "view") {
            const oldViewContainer = this.viewDescriptorService.getViewContainerByViewId(dropData.id);
            const viewDescriptor = this.viewDescriptorService.getViewDescriptorById(dropData.id);
            if (oldViewContainer !== this.viewContainer && viewDescriptor && viewDescriptor.canMoveView && !this.viewContainer.rejectAddedViews) {
              viewsToMove.push(viewDescriptor);
            }
            if (viewDescriptor) {
              anchorView = viewDescriptor;
            }
          }
          if (viewsToMove) {
            this.viewDescriptorService.moveViewsToContainer(viewsToMove, this.viewContainer, void 0, "dnd");
          }
          if (anchorView) {
            if (overlay.currentDropOperation === 1 /* DOWN */ || overlay.currentDropOperation === 3 /* RIGHT */) {
              const fromIndex = this.panes.findIndex((p) => p.id === anchorView.id);
              let toIndex = this.panes.findIndex((p) => p.id === pane.id);
              if (fromIndex >= 0 && toIndex >= 0) {
                if (fromIndex > toIndex) {
                  toIndex++;
                }
                if (toIndex < this.panes.length && toIndex !== fromIndex) {
                  this.movePane(this.panes[fromIndex], this.panes[toIndex]);
                }
              }
            }
            if (overlay.currentDropOperation === 0 /* UP */ || overlay.currentDropOperation === 2 /* LEFT */) {
              const fromIndex = this.panes.findIndex((p) => p.id === anchorView.id);
              let toIndex = this.panes.findIndex((p) => p.id === pane.id);
              if (fromIndex >= 0 && toIndex >= 0) {
                if (fromIndex < toIndex) {
                  toIndex--;
                }
                if (toIndex >= 0 && toIndex !== fromIndex) {
                  this.movePane(this.panes[fromIndex], this.panes[toIndex]);
                }
              }
            }
            if (viewsToMove.length > 1) {
              viewsToMove.slice(1).forEach((view) => {
                let toIndex = this.panes.findIndex((p) => p.id === anchorView.id);
                const fromIndex = this.panes.findIndex((p) => p.id === view.id);
                if (fromIndex >= 0 && toIndex >= 0) {
                  if (fromIndex > toIndex) {
                    toIndex++;
                  }
                  if (toIndex < this.panes.length && toIndex !== fromIndex) {
                    this.movePane(this.panes[fromIndex], this.panes[toIndex]);
                    anchorView = view;
                  }
                }
              });
            }
          }
        }
        overlay?.dispose();
        overlay = void 0;
      }
    }));
  }
  removePanes(panes) {
    const wasMerged = this.isViewMergedWithContainer();
    panes.forEach((pane) => this.removePane(pane));
    this.updateViewHeaders();
    if (wasMerged !== this.isViewMergedWithContainer()) {
      this.updateTitleArea();
    }
    this._onDidRemoveViews.fire(panes);
  }
  removePane(pane) {
    const index = this.paneItems.findIndex((i) => i.pane === pane);
    if (index === -1) {
      return;
    }
    if (this.lastFocusedPane === pane) {
      this.lastFocusedPane = void 0;
    }
    assertIsDefined(this.paneview).removePane(pane);
    const [paneItem] = this.paneItems.splice(index, 1);
    paneItem.disposable.dispose();
  }
  movePane(from, to) {
    const fromIndex = this.paneItems.findIndex((item) => item.pane === from);
    const toIndex = this.paneItems.findIndex((item) => item.pane === to);
    const fromViewDescriptor = this.viewContainerModel.visibleViewDescriptors[fromIndex];
    const toViewDescriptor = this.viewContainerModel.visibleViewDescriptors[toIndex];
    if (fromIndex < 0 || fromIndex >= this.paneItems.length) {
      return;
    }
    if (toIndex < 0 || toIndex >= this.paneItems.length) {
      return;
    }
    const [paneItem] = this.paneItems.splice(fromIndex, 1);
    this.paneItems.splice(toIndex, 0, paneItem);
    assertIsDefined(this.paneview).movePane(from, to);
    this.viewContainerModel.move(fromViewDescriptor.id, toViewDescriptor.id);
    this.updateTitleArea();
  }
  resizePane(pane, size) {
    assertIsDefined(this.paneview).resizePane(pane, size);
  }
  getPaneSize(pane) {
    return assertIsDefined(this.paneview).getPaneSize(pane);
  }
  updateViewHeaders() {
    if (this.isViewMergedWithContainer()) {
      if (this.paneItems[0].pane.isExpanded()) {
        this.lastMergedCollapsedPane = void 0;
      } else {
        this.lastMergedCollapsedPane = this.paneItems[0].pane;
        this.paneItems[0].pane.setExpanded(true);
      }
      this.paneItems[0].pane.headerVisible = false;
      this.paneItems[0].pane.collapsible = true;
    } else {
      if (this.paneItems.length === 1) {
        this.paneItems[0].pane.headerVisible = true;
        if (this.paneItems[0].pane === this.lastMergedCollapsedPane) {
          this.paneItems[0].pane.setExpanded(false);
        }
        this.paneItems[0].pane.collapsible = false;
      } else {
        this.paneItems.forEach((i) => {
          i.pane.headerVisible = true;
          i.pane.collapsible = true;
          if (i.pane === this.lastMergedCollapsedPane) {
            i.pane.setExpanded(false);
          }
        });
      }
      this.lastMergedCollapsedPane = void 0;
    }
  }
  isViewMergedWithContainer() {
    if (!(this.options.mergeViewWithContainerWhenSingleView && this.paneItems.length === 1)) {
      return false;
    }
    if (!this.areExtensionsReady) {
      if (this.visibleViewsCountFromCache === void 0) {
        return this.paneItems[0].pane.isExpanded();
      }
      return this.visibleViewsCountFromCache === 1;
    }
    return true;
  }
  onDidScrollPane() {
    for (const pane of this.panes) {
      pane.onDidScrollRoot();
    }
  }
  onDidSashReset(index) {
    let firstPane = void 0;
    let secondPane = void 0;
    for (let i = index; i >= 0; i--) {
      if (this.paneItems[i].pane?.isVisible() && this.paneItems[i]?.pane.isExpanded()) {
        firstPane = this.paneItems[i].pane;
        break;
      }
    }
    for (let i = index + 1; i < this.paneItems.length; i++) {
      if (this.paneItems[i].pane?.isVisible() && this.paneItems[i]?.pane.isExpanded()) {
        secondPane = this.paneItems[i].pane;
        break;
      }
    }
    if (firstPane && secondPane) {
      const firstPaneSize = this.getPaneSize(firstPane);
      const secondPaneSize = this.getPaneSize(secondPane);
      const newFirstPaneSize = Math.ceil((firstPaneSize + secondPaneSize) / 2);
      const newSecondPaneSize = Math.floor((firstPaneSize + secondPaneSize) / 2);
      if (firstPaneSize > secondPaneSize) {
        this.resizePane(firstPane, newFirstPaneSize);
        this.resizePane(secondPane, newSecondPaneSize);
      } else {
        this.resizePane(secondPane, newSecondPaneSize);
        this.resizePane(firstPane, newFirstPaneSize);
      }
    }
  }
  dispose() {
    super.dispose();
    this.paneItems.forEach((i) => i.disposable.dispose());
    if (this.paneview) {
      this.paneview.dispose();
    }
  }
};
ViewPaneContainer = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IWorkbenchLayoutService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, IWorkspaceContextService),
  __decorateParam(11, IViewDescriptorService),
  __decorateParam(12, ILogService)
], ViewPaneContainer);
class ViewPaneContainerAction extends Action2 {
  constructor(desc) {
    super(desc);
    this.desc = desc;
  }
  run(accessor, ...args) {
    const viewPaneContainer = accessor.get(IViewsService).getActiveViewPaneContainerWithId(this.desc.viewPaneContainerId);
    if (viewPaneContainer) {
      return this.runInViewPaneContainer(accessor, viewPaneContainer, ...args);
    }
    return void 0;
  }
}
class MoveViewPosition extends Action2 {
  constructor(desc, offset) {
    super(desc);
    this.offset = offset;
  }
  async run(accessor) {
    const viewDescriptorService = accessor.get(IViewDescriptorService);
    const contextKeyService = accessor.get(IContextKeyService);
    const viewId = FocusedViewContext.getValue(contextKeyService);
    if (viewId === void 0) {
      return;
    }
    const viewContainer = viewDescriptorService.getViewContainerByViewId(viewId);
    const model = viewDescriptorService.getViewContainerModel(viewContainer);
    const viewDescriptor = model.visibleViewDescriptors.find((vd) => vd.id === viewId);
    const currentIndex = model.visibleViewDescriptors.indexOf(viewDescriptor);
    if (currentIndex + this.offset < 0 || currentIndex + this.offset >= model.visibleViewDescriptors.length) {
      return;
    }
    const newPosition = model.visibleViewDescriptors[currentIndex + this.offset];
    model.move(viewDescriptor.id, newPosition.id);
  }
}
registerAction2(
  class MoveViewUp extends MoveViewPosition {
    constructor() {
      super({
        id: "views.moveViewUp",
        title: nls.localize("viewMoveUp", "Move View Up"),
        keybinding: {
          primary: KeyChord(KeyMod.CtrlCmd + KeyCode.KeyK, KeyCode.UpArrow),
          weight: KeybindingWeight.WorkbenchContrib + 1,
          when: FocusedViewContext.notEqualsTo("")
        }
      }, -1);
    }
  }
);
registerAction2(
  class MoveViewLeft extends MoveViewPosition {
    constructor() {
      super({
        id: "views.moveViewLeft",
        title: nls.localize("viewMoveLeft", "Move View Left"),
        keybinding: {
          primary: KeyChord(KeyMod.CtrlCmd + KeyCode.KeyK, KeyCode.LeftArrow),
          weight: KeybindingWeight.WorkbenchContrib + 1,
          when: FocusedViewContext.notEqualsTo("")
        }
      }, -1);
    }
  }
);
registerAction2(
  class MoveViewDown extends MoveViewPosition {
    constructor() {
      super({
        id: "views.moveViewDown",
        title: nls.localize("viewMoveDown", "Move View Down"),
        keybinding: {
          primary: KeyChord(KeyMod.CtrlCmd + KeyCode.KeyK, KeyCode.DownArrow),
          weight: KeybindingWeight.WorkbenchContrib + 1,
          when: FocusedViewContext.notEqualsTo("")
        }
      }, 1);
    }
  }
);
registerAction2(
  class MoveViewRight extends MoveViewPosition {
    constructor() {
      super({
        id: "views.moveViewRight",
        title: nls.localize("viewMoveRight", "Move View Right"),
        keybinding: {
          primary: KeyChord(KeyMod.CtrlCmd + KeyCode.KeyK, KeyCode.RightArrow),
          weight: KeybindingWeight.WorkbenchContrib + 1,
          when: FocusedViewContext.notEqualsTo("")
        }
      }, 1);
    }
  }
);
registerAction2(class MoveViews extends Action2 {
  constructor() {
    super({
      id: "vscode.moveViews",
      title: nls.localize("viewsMove", "Move Views")
    });
  }
  async run(accessor, options) {
    if (!Array.isArray(options?.viewIds) || typeof options?.destinationId !== "string") {
      return Promise.reject("Invalid arguments");
    }
    const viewDescriptorService = accessor.get(IViewDescriptorService);
    const destination = viewDescriptorService.getViewContainerById(options.destinationId);
    if (!destination) {
      return;
    }
    for (const viewId of options.viewIds) {
      const viewDescriptor = viewDescriptorService.getViewDescriptorById(viewId);
      if (viewDescriptor?.canMoveView) {
        viewDescriptorService.moveViewsToContainer([viewDescriptor], destination, ViewVisibilityState.Default, this.desc.id);
      }
    }
    await accessor.get(IViewsService).openViewContainer(destination.id, true);
  }
});
export {
  ViewPaneContainer,
  ViewPaneContainerAction,
  ViewsSubMenu
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZUNvbnRhaW5lci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7ICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgRGltZW5zaW9uLCBEcmFnQW5kRHJvcE9ic2VydmVyLCBFdmVudFR5cGUsIGdldFdpbmRvdywgaXNBbmNlc3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgRXZlbnRUeXBlIGFzIFRvdWNoRXZlbnRUeXBlLCBHZXN0dXJlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3RvdWNoLmpzJztcbmltcG9ydCB7IElBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IElCb3VuZGFyeVNhc2hlcywgT3JpZW50YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2FzaC9zYXNoLmpzJztcbmltcG9ydCB7IElQYW5lVmlld09wdGlvbnMsIFBhbmVWaWV3IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NwbGl0dmlldy9wYW5ldmlldy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBLZXlDaG9yZCwgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgY29tYmluZWREaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0ICcuL21lZGlhL3BhbmV2aWV3bGV0LmNzcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGNyZWF0ZUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIElBY3Rpb24yT3B0aW9ucywgSU1lbnVTZXJ2aWNlLCBJU3VibWVudUl0ZW0sIE1lbnVJZCwgTWVudVJlZ2lzdHJ5LCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IGFjdGl2ZUNvbnRyYXN0Qm9yZGVyLCBhc0Nzc1ZhcmlhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSwgVGhlbWFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IENvbXBvc2l0ZU1lbnVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb21wb3NpdGVEcmFnQW5kRHJvcE9ic2VydmVyLCB0b2dnbGVEcm9wRWZmZWN0IH0gZnJvbSAnLi4vLi4vZG5kLmpzJztcbmltcG9ydCB7IFZpZXdQYW5lIH0gZnJvbSAnLi92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBJVmlld2xldFZpZXdPcHRpb25zIH0gZnJvbSAnLi92aWV3c1ZpZXdsZXQuanMnO1xuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBQQU5FTF9TRUNUSU9OX0JPUkRFUiwgUEFORUxfU0VDVElPTl9EUkFHX0FORF9EUk9QX0JBQ0tHUk9VTkQsIFBBTkVMX1NFQ1RJT05fSEVBREVSX0JBQ0tHUk9VTkQsIFBBTkVMX1NFQ1RJT05fSEVBREVSX0JPUkRFUiwgUEFORUxfU0VDVElPTl9IRUFERVJfRk9SRUdST1VORCwgU0lERV9CQVJfRFJBR19BTkRfRFJPUF9CQUNLR1JPVU5ELCBTSURFX0JBUl9TRUNUSU9OX0hFQURFUl9CQUNLR1JPVU5ELCBTSURFX0JBUl9TRUNUSU9OX0hFQURFUl9CT1JERVIsIFNJREVfQkFSX1NFQ1RJT05fSEVBREVSX0ZPUkVHUk9VTkQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgSUFkZGVkVmlld0Rlc2NyaXB0b3JSZWYsIElDdXN0b21WaWV3RGVzY3JpcHRvciwgSVZpZXcsIElWaWV3Q29udGFpbmVyTW9kZWwsIElWaWV3RGVzY3JpcHRvciwgSVZpZXdEZXNjcmlwdG9yUmVmLCBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBJVmlld1BhbmVDb250YWluZXIsIFZpZXdDb250YWluZXIsIFZpZXdDb250YWluZXJMb2NhdGlvbiwgVmlld0NvbnRhaW5lckxvY2F0aW9uVG9TdHJpbmcsIFZpZXdWaXNpYmlsaXR5U3RhdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgRm9jdXNlZFZpZXdDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBpc0hvcml6b250YWwsIElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCBMYXlvdXRTZXR0aW5ncyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUJhc2VBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcblxuZXhwb3J0IGNvbnN0IFZpZXdzU3ViTWVudSA9IG5ldyBNZW51SWQoJ1ZpZXdzJyk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlZpZXdDb250YWluZXJUaXRsZSwge1xuXHRzdWJtZW51OiBWaWV3c1N1Yk1lbnUsXG5cdHRpdGxlOiBubHMubG9jYWxpemUoJ3ZpZXdzJywgXCJWaWV3c1wiKSxcblx0b3JkZXI6IDEsXG59IHNhdGlzZmllcyBJU3VibWVudUl0ZW0pO1xuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3UGFuZUNvbnRhaW5lck9wdGlvbnMgZXh0ZW5kcyBJUGFuZVZpZXdPcHRpb25zIHtcblx0bWVyZ2VWaWV3V2l0aENvbnRhaW5lcldoZW5TaW5nbGVWaWV3OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSVZpZXdQYW5lSXRlbSB7XG5cdHBhbmU6IFZpZXdQYW5lO1xuXHRkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcbn1cblxuY29uc3QgZW51bSBEcm9wRGlyZWN0aW9uIHtcblx0VVAsXG5cdERPV04sXG5cdExFRlQsXG5cdFJJR0hUXG59XG5cbnR5cGUgQm91bmRpbmdSZWN0ID0geyB0b3A6IG51bWJlcjsgbGVmdDogbnVtYmVyOyBib3R0b206IG51bWJlcjsgcmlnaHQ6IG51bWJlciB9O1xuXG5jbGFzcyBWaWV3UGFuZURyb3BPdmVybGF5IGV4dGVuZHMgVGhlbWFibGUge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE9WRVJMQVlfSUQgPSAnbW9uYWNvLXBhbmUtZHJvcC1vdmVybGF5JztcblxuXHRwcml2YXRlIGNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIG92ZXJsYXkhOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIF9jdXJyZW50RHJvcE9wZXJhdGlvbjogRHJvcERpcmVjdGlvbiB8IHVuZGVmaW5lZDtcblxuXHQvLyBwcml2YXRlIGN1cnJlbnREcm9wT3BlcmF0aW9uOiBJRHJvcE9wZXJhdGlvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZGlzcG9zZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBjbGVhbnVwT3ZlcmxheVNjaGVkdWxlcjogUnVuT25jZVNjaGVkdWxlcjtcblxuXHRnZXQgY3VycmVudERyb3BPcGVyYXRpb24oKTogRHJvcERpcmVjdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnREcm9wT3BlcmF0aW9uO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBwYW5lRWxlbWVudDogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSBvcmllbnRhdGlvbjogT3JpZW50YXRpb24gfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBib3VuZHM6IEJvdW5kaW5nUmVjdCB8IHVuZGVmaW5lZCxcblx0XHRwcm90ZWN0ZWQgbG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbixcblx0XHR0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHRoZW1lU2VydmljZSk7XG5cdFx0dGhpcy5jbGVhbnVwT3ZlcmxheVNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuZGlzcG9zZSgpLCAzMDApKTtcblxuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdH1cblxuXHRnZXQgZGlzcG9zZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5fZGlzcG9zZWQ7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZSgpOiB2b2lkIHtcblxuXHRcdC8vIENvbnRhaW5lclxuXHRcdHRoaXMuY29udGFpbmVyID0gJCgnZGl2JywgeyBpZDogVmlld1BhbmVEcm9wT3ZlcmxheS5PVkVSTEFZX0lEIH0pO1xuXHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLnRvcCA9ICcwcHgnO1xuXG5cdFx0Ly8gUGFyZW50XG5cdFx0dGhpcy5wYW5lRWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLmNvbnRhaW5lcik7XG5cdFx0dGhpcy5wYW5lRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdkcmFnZ2VkLW92ZXInKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5jb250YWluZXIucmVtb3ZlKCk7XG5cdFx0XHR0aGlzLnBhbmVFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdnZWQtb3ZlcicpO1xuXHRcdH0pKTtcblxuXHRcdC8vIE92ZXJsYXlcblx0XHR0aGlzLm92ZXJsYXkgPSAkKCcucGFuZS1vdmVybGF5LWluZGljYXRvcicpO1xuXHRcdHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMub3ZlcmxheSk7XG5cblx0XHQvLyBPdmVybGF5IEV2ZW50IEhhbmRsaW5nXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXG5cdFx0Ly8gU3R5bGVzXG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZVN0eWxlcygpOiB2b2lkIHtcblxuXHRcdC8vIE92ZXJsYXkgZHJvcCBiYWNrZ3JvdW5kXG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHRoaXMuZ2V0Q29sb3IodGhpcy5sb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsID8gUEFORUxfU0VDVElPTl9EUkFHX0FORF9EUk9QX0JBQ0tHUk9VTkQgOiBTSURFX0JBUl9EUkFHX0FORF9EUk9QX0JBQ0tHUk9VTkQpIHx8ICcnO1xuXG5cdFx0Ly8gT3ZlcmxheSBjb250cmFzdCBib3JkZXIgKGlmIGFueSlcblx0XHRjb25zdCBhY3RpdmVDb250cmFzdEJvcmRlckNvbG9yID0gdGhpcy5nZXRDb2xvcihhY3RpdmVDb250cmFzdEJvcmRlcik7XG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLm91dGxpbmVDb2xvciA9IGFjdGl2ZUNvbnRyYXN0Qm9yZGVyQ29sb3IgfHwgJyc7XG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLm91dGxpbmVPZmZzZXQgPSBhY3RpdmVDb250cmFzdEJvcmRlckNvbG9yID8gJy0ycHgnIDogJyc7XG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLm91dGxpbmVTdHlsZSA9IGFjdGl2ZUNvbnRyYXN0Qm9yZGVyQ29sb3IgPyAnZGFzaGVkJyA6ICcnO1xuXHRcdHRoaXMub3ZlcmxheS5zdHlsZS5vdXRsaW5lV2lkdGggPSBhY3RpdmVDb250cmFzdEJvcmRlckNvbG9yID8gJzJweCcgOiAnJztcblxuXHRcdHRoaXMub3ZlcmxheS5zdHlsZS5ib3JkZXJDb2xvciA9IGFjdGl2ZUNvbnRyYXN0Qm9yZGVyQ29sb3IgfHwgJyc7XG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLmJvcmRlclN0eWxlID0gJ3NvbGlkJztcblx0XHR0aGlzLm92ZXJsYXkuc3R5bGUuYm9yZGVyV2lkdGggPSAnMHB4Jztcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobmV3IERyYWdBbmREcm9wT2JzZXJ2ZXIodGhpcy5jb250YWluZXIsIHtcblx0XHRcdG9uRHJhZ092ZXI6IGUgPT4ge1xuXG5cdFx0XHRcdC8vIFBvc2l0aW9uIG92ZXJsYXlcblx0XHRcdFx0dGhpcy5wb3NpdGlvbk92ZXJsYXkoZS5vZmZzZXRYLCBlLm9mZnNldFkpO1xuXG5cdFx0XHRcdC8vIE1ha2Ugc3VyZSB0byBzdG9wIGFueSBydW5uaW5nIGNsZWFudXAgc2NoZWR1bGVyIHRvIHJlbW92ZSB0aGUgb3ZlcmxheVxuXHRcdFx0XHRpZiAodGhpcy5jbGVhbnVwT3ZlcmxheVNjaGVkdWxlci5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5jbGVhbnVwT3ZlcmxheVNjaGVkdWxlci5jYW5jZWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0b25EcmFnTGVhdmU6IGUgPT4gdGhpcy5kaXNwb3NlKCksXG5cdFx0XHRvbkRyYWdFbmQ6IGUgPT4gdGhpcy5kaXNwb3NlKCksXG5cblx0XHRcdG9uRHJvcDogZSA9PiB7XG5cdFx0XHRcdC8vIERpc3Bvc2Ugb3ZlcmxheVxuXHRcdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIEV2ZW50VHlwZS5NT1VTRV9PVkVSLCAoKSA9PiB7XG5cdFx0XHQvLyBVbmRlciBzb21lIGNpcmN1bXN0YW5jZXMgd2UgaGF2ZSBzZWVuIHJlcG9ydHMgd2hlcmUgdGhlIGRyb3Agb3ZlcmxheSBpcyBub3QgYmVpbmdcblx0XHRcdC8vIGNsZWFuZWQgdXAgYW5kIGFzIHN1Y2ggdGhlIGVkaXRvciBhcmVhIHJlbWFpbnMgdW5kZXIgdGhlIG92ZXJsYXkgc28gdGhhdCB5b3UgY2Fubm90XG5cdFx0XHQvLyB0eXBlIGludG8gdGhlIGVkaXRvciBhbnltb3JlLiBUaGlzIHNlZW1zIHJlbGF0ZWQgdG8gdXNpbmcgVk1zIGFuZCBETkQgdmlhIGhvc3QgYW5kXG5cdFx0XHQvLyBndWVzdCBPUywgdGhvdWdoIHNvbWUgdXNlcnMgYWxzbyBzYXcgaXQgd2l0aG91dCBWTXMuXG5cdFx0XHQvLyBUbyBwcm90ZWN0IGFnYWluc3QgdGhpcyBpc3N1ZSB3ZSBhbHdheXMgZGVzdHJveSB0aGUgb3ZlcmxheSBhcyBzb29uIGFzIHdlIGRldGVjdCBhXG5cdFx0XHQvLyBtb3VzZSBldmVudCBvdmVyIGl0LiBUaGUgZGVsYXkgaXMgdXNlZCB0byBndWFyYW50ZWUgd2UgYXJlIG5vdCBpbnRlcmZlcmluZyB3aXRoIHRoZVxuXHRcdFx0Ly8gYWN0dWFsIERST1AgZXZlbnQgdGhhdCBjYW4gYWxzbyB0cmlnZ2VyIGEgbW91c2Ugb3ZlciBldmVudC5cblx0XHRcdGlmICghdGhpcy5jbGVhbnVwT3ZlcmxheVNjaGVkdWxlci5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdHRoaXMuY2xlYW51cE92ZXJsYXlTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHBvc2l0aW9uT3ZlcmxheShtb3VzZVBvc1g6IG51bWJlciwgbW91c2VQb3NZOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBwYW5lV2lkdGggPSB0aGlzLnBhbmVFbGVtZW50LmNsaWVudFdpZHRoO1xuXHRcdGNvbnN0IHBhbmVIZWlnaHQgPSB0aGlzLnBhbmVFbGVtZW50LmNsaWVudEhlaWdodDtcblxuXHRcdGNvbnN0IHNwbGl0V2lkdGhUaHJlc2hvbGQgPSBwYW5lV2lkdGggLyAyO1xuXHRcdGNvbnN0IHNwbGl0SGVpZ2h0VGhyZXNob2xkID0gcGFuZUhlaWdodCAvIDI7XG5cblx0XHRsZXQgZHJvcERpcmVjdGlvbjogRHJvcERpcmVjdGlvbiB8IHVuZGVmaW5lZDtcblxuXHRcdGlmICh0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5WRVJUSUNBTCkge1xuXHRcdFx0aWYgKG1vdXNlUG9zWSA8IHNwbGl0SGVpZ2h0VGhyZXNob2xkKSB7XG5cdFx0XHRcdGRyb3BEaXJlY3Rpb24gPSBEcm9wRGlyZWN0aW9uLlVQO1xuXHRcdFx0fSBlbHNlIGlmIChtb3VzZVBvc1kgPj0gc3BsaXRIZWlnaHRUaHJlc2hvbGQpIHtcblx0XHRcdFx0ZHJvcERpcmVjdGlvbiA9IERyb3BEaXJlY3Rpb24uRE9XTjtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwpIHtcblx0XHRcdGlmIChtb3VzZVBvc1ggPCBzcGxpdFdpZHRoVGhyZXNob2xkKSB7XG5cdFx0XHRcdGRyb3BEaXJlY3Rpb24gPSBEcm9wRGlyZWN0aW9uLkxFRlQ7XG5cdFx0XHR9IGVsc2UgaWYgKG1vdXNlUG9zWCA+PSBzcGxpdFdpZHRoVGhyZXNob2xkKSB7XG5cdFx0XHRcdGRyb3BEaXJlY3Rpb24gPSBEcm9wRGlyZWN0aW9uLlJJR0hUO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIERyYXcgb3ZlcmxheSBiYXNlZCBvbiBzcGxpdCBkaXJlY3Rpb25cblx0XHRzd2l0Y2ggKGRyb3BEaXJlY3Rpb24pIHtcblx0XHRcdGNhc2UgRHJvcERpcmVjdGlvbi5VUDpcblx0XHRcdFx0dGhpcy5kb1Bvc2l0aW9uT3ZlcmxheSh7IHRvcDogJzAnLCBsZWZ0OiAnMCcsIHdpZHRoOiAnMTAwJScsIGhlaWdodDogJzUwJScgfSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBEcm9wRGlyZWN0aW9uLkRPV046XG5cdFx0XHRcdHRoaXMuZG9Qb3NpdGlvbk92ZXJsYXkoeyBib3R0b206ICcwJywgbGVmdDogJzAnLCB3aWR0aDogJzEwMCUnLCBoZWlnaHQ6ICc1MCUnIH0pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgRHJvcERpcmVjdGlvbi5MRUZUOlxuXHRcdFx0XHR0aGlzLmRvUG9zaXRpb25PdmVybGF5KHsgdG9wOiAnMCcsIGxlZnQ6ICcwJywgd2lkdGg6ICc1MCUnLCBoZWlnaHQ6ICcxMDAlJyB9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIERyb3BEaXJlY3Rpb24uUklHSFQ6XG5cdFx0XHRcdHRoaXMuZG9Qb3NpdGlvbk92ZXJsYXkoeyB0b3A6ICcwJywgcmlnaHQ6ICcwJywgd2lkdGg6ICc1MCUnLCBoZWlnaHQ6ICcxMDAlJyB9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdC8vIGNvbnN0IHRvcCA9IHRoaXMuYm91bmRzPy50b3AgfHwgMDtcblx0XHRcdFx0Ly8gY29uc3QgbGVmdCA9IHRoaXMuYm91bmRzPy5ib3R0b20gfHwgMDtcblxuXHRcdFx0XHRsZXQgdG9wID0gJzAnO1xuXHRcdFx0XHRsZXQgbGVmdCA9ICcwJztcblx0XHRcdFx0bGV0IHdpZHRoID0gJzEwMCUnO1xuXHRcdFx0XHRsZXQgaGVpZ2h0ID0gJzEwMCUnO1xuXHRcdFx0XHRpZiAodGhpcy5ib3VuZHMpIHtcblx0XHRcdFx0XHRjb25zdCBib3VuZGluZ1JlY3QgPSB0aGlzLmNvbnRhaW5lci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0XHR0b3AgPSBgJHt0aGlzLmJvdW5kcy50b3AgLSBib3VuZGluZ1JlY3QudG9wfXB4YDtcblx0XHRcdFx0XHRsZWZ0ID0gYCR7dGhpcy5ib3VuZHMubGVmdCAtIGJvdW5kaW5nUmVjdC5sZWZ0fXB4YDtcblx0XHRcdFx0XHRoZWlnaHQgPSBgJHt0aGlzLmJvdW5kcy5ib3R0b20gLSB0aGlzLmJvdW5kcy50b3B9cHhgO1xuXHRcdFx0XHRcdHdpZHRoID0gYCR7dGhpcy5ib3VuZHMucmlnaHQgLSB0aGlzLmJvdW5kcy5sZWZ0fXB4YDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuZG9Qb3NpdGlvbk92ZXJsYXkoeyB0b3AsIGxlZnQsIHdpZHRoLCBoZWlnaHQgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCh0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5WRVJUSUNBTCAmJiBwYW5lSGVpZ2h0IDw9IDI1KSB8fFxuXHRcdFx0KHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwgJiYgcGFuZVdpZHRoIDw9IDI1KSkge1xuXHRcdFx0dGhpcy5kb1VwZGF0ZU92ZXJsYXlCb3JkZXIoZHJvcERpcmVjdGlvbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZG9VcGRhdGVPdmVybGF5Qm9yZGVyKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Ly8gTWFrZSBzdXJlIHRoZSBvdmVybGF5IGlzIHZpc2libGUgbm93XG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLm9wYWNpdHkgPSAnMSc7XG5cblx0XHQvLyBFbmFibGUgdHJhbnNpdGlvbiBhZnRlciBhIHRpbWVvdXQgdG8gcHJldmVudCBpbml0aWFsIGFuaW1hdGlvblxuXHRcdHNldFRpbWVvdXQoKCkgPT4gdGhpcy5vdmVybGF5LmNsYXNzTGlzdC5hZGQoJ292ZXJsYXktbW92ZS10cmFuc2l0aW9uJyksIDApO1xuXG5cdFx0Ly8gUmVtZW1iZXIgYXMgY3VycmVudCBzcGxpdCBkaXJlY3Rpb25cblx0XHR0aGlzLl9jdXJyZW50RHJvcE9wZXJhdGlvbiA9IGRyb3BEaXJlY3Rpb247XG5cdH1cblxuXHRwcml2YXRlIGRvVXBkYXRlT3ZlcmxheUJvcmRlcihkaXJlY3Rpb246IERyb3BEaXJlY3Rpb24gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLm92ZXJsYXkuc3R5bGUuYm9yZGVyVG9wV2lkdGggPSBkaXJlY3Rpb24gPT09IERyb3BEaXJlY3Rpb24uVVAgPyAnMnB4JyA6ICcwcHgnO1xuXHRcdHRoaXMub3ZlcmxheS5zdHlsZS5ib3JkZXJMZWZ0V2lkdGggPSBkaXJlY3Rpb24gPT09IERyb3BEaXJlY3Rpb24uTEVGVCA/ICcycHgnIDogJzBweCc7XG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLmJvcmRlckJvdHRvbVdpZHRoID0gZGlyZWN0aW9uID09PSBEcm9wRGlyZWN0aW9uLkRPV04gPyAnMnB4JyA6ICcwcHgnO1xuXHRcdHRoaXMub3ZlcmxheS5zdHlsZS5ib3JkZXJSaWdodFdpZHRoID0gZGlyZWN0aW9uID09PSBEcm9wRGlyZWN0aW9uLlJJR0hUID8gJzJweCcgOiAnMHB4Jztcblx0fVxuXG5cdHByaXZhdGUgZG9Qb3NpdGlvbk92ZXJsYXkob3B0aW9uczogeyB0b3A/OiBzdHJpbmc7IGJvdHRvbT86IHN0cmluZzsgbGVmdD86IHN0cmluZzsgcmlnaHQ/OiBzdHJpbmc7IHdpZHRoOiBzdHJpbmc7IGhlaWdodDogc3RyaW5nIH0pOiB2b2lkIHtcblxuXHRcdC8vIENvbnRhaW5lclxuXHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLmhlaWdodCA9ICcxMDAlJztcblxuXHRcdC8vIE92ZXJsYXlcblx0XHR0aGlzLm92ZXJsYXkuc3R5bGUudG9wID0gb3B0aW9ucy50b3AgfHwgJyc7XG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLmxlZnQgPSBvcHRpb25zLmxlZnQgfHwgJyc7XG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLmJvdHRvbSA9IG9wdGlvbnMuYm90dG9tIHx8ICcnO1xuXHRcdHRoaXMub3ZlcmxheS5zdHlsZS5yaWdodCA9IG9wdGlvbnMucmlnaHQgfHwgJyc7XG5cdFx0dGhpcy5vdmVybGF5LnN0eWxlLndpZHRoID0gb3B0aW9ucy53aWR0aDtcblx0XHR0aGlzLm92ZXJsYXkuc3R5bGUuaGVpZ2h0ID0gb3B0aW9ucy5oZWlnaHQ7XG5cdH1cblxuXG5cdGNvbnRhaW5zKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGVsZW1lbnQgPT09IHRoaXMuY29udGFpbmVyIHx8IGVsZW1lbnQgPT09IHRoaXMub3ZlcmxheTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXG5cdFx0dGhpcy5fZGlzcG9zZWQgPSB0cnVlO1xuXHR9XG59XG5cbmNsYXNzIFZpZXdDb250YWluZXJNZW51QWN0aW9ucyBleHRlbmRzIENvbXBvc2l0ZU1lbnVBY3Rpb25zIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0ZWxlbWVudDogSFRNTEVsZW1lbnQsXG5cdFx0dmlld0NvbnRhaW5lcjogVmlld0NvbnRhaW5lcixcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3Qgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPSBjb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQoZWxlbWVudCk7XG5cdFx0c2NvcGVkQ29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5KCd2aWV3Q29udGFpbmVyJywgdmlld0NvbnRhaW5lci5pZCk7XG5cdFx0Y29uc3Qgdmlld0NvbnRhaW5lckxvY2F0aW9uS2V5ID0gc2NvcGVkQ29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5KCd2aWV3Q29udGFpbmVyTG9jYXRpb24nLCBWaWV3Q29udGFpbmVyTG9jYXRpb25Ub1N0cmluZyh2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHZpZXdDb250YWluZXIpISkpO1xuXHRcdHN1cGVyKE1lbnVJZC5WaWV3Q29udGFpbmVyVGl0bGUsIE1lbnVJZC5WaWV3Q29udGFpbmVyVGl0bGVDb250ZXh0LCB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlLCByZW5kZXJTaG9ydFRpdGxlOiB0cnVlIH0sIHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLCBtZW51U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcih2aWV3RGVzY3JpcHRvclNlcnZpY2Uub25EaWRDaGFuZ2VDb250YWluZXJMb2NhdGlvbiwgZSA9PiBlLnZpZXdDb250YWluZXIgPT09IHZpZXdDb250YWluZXIpKCgpID0+IHZpZXdDb250YWluZXJMb2NhdGlvbktleS5zZXQoVmlld0NvbnRhaW5lckxvY2F0aW9uVG9TdHJpbmcodmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKSEpKSkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBWaWV3UGFuZUNvbnRhaW5lciBleHRlbmRzIENvbXBvbmVudCBpbXBsZW1lbnRzIElWaWV3UGFuZUNvbnRhaW5lciB7XG5cblx0cmVhZG9ubHkgdmlld0NvbnRhaW5lcjogVmlld0NvbnRhaW5lcjtcblx0cHJpdmF0ZSBsYXN0Rm9jdXNlZFBhbmU6IFZpZXdQYW5lIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGxhc3RNZXJnZWRDb2xsYXBzZWRQYW5lOiBWaWV3UGFuZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBwYW5lSXRlbXM6IElWaWV3UGFuZUl0ZW1bXSA9IFtdO1xuXHRwcml2YXRlIHBhbmV2aWV3PzogUGFuZVZpZXc7XG5cblx0cHJpdmF0ZSB2aXNpYmxlOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBhcmVFeHRlbnNpb25zUmVhZHk6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIGRpZExheW91dCA9IGZhbHNlO1xuXHRwcml2YXRlIGRpbWVuc2lvbjogRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9ib3VuZGFyeVNhc2hlczogSUJvdW5kYXJ5U2FzaGVzIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdmlzaWJsZVZpZXdzQ291bnRGcm9tQ2FjaGU6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSB2aXNpYmxlVmlld3NTdG9yYWdlSWQ6IHN0cmluZztcblx0cHJvdGVjdGVkIHJlYWRvbmx5IHZpZXdDb250YWluZXJNb2RlbDogSVZpZXdDb250YWluZXJNb2RlbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblRpdGxlQXJlYVVwZGF0ZTogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvblRpdGxlQXJlYVVwZGF0ZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vblRpdGxlQXJlYVVwZGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpc2liaWxpdHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gdGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQWRkVmlld3MgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVmlld1tdPigpKTtcblx0cmVhZG9ubHkgb25EaWRBZGRWaWV3cyA9IHRoaXMuX29uRGlkQWRkVmlld3MuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW1vdmVWaWV3cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElWaWV3W10+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlbW92ZVZpZXdzID0gdGhpcy5fb25EaWRSZW1vdmVWaWV3cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5ID0gdGhpcy5fb25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZvY3VzVmlldyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElWaWV3PigpKTtcblx0cmVhZG9ubHkgb25EaWRGb2N1c1ZpZXcgPSB0aGlzLl9vbkRpZEZvY3VzVmlldy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEJsdXJWaWV3ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVZpZXc+KCkpO1xuXHRyZWFkb25seSBvbkRpZEJsdXJWaWV3ID0gdGhpcy5fb25EaWRCbHVyVmlldy5ldmVudDtcblxuXHRnZXQgb25EaWRTYXNoQ2hhbmdlKCk6IEV2ZW50PG51bWJlcj4ge1xuXHRcdHJldHVybiBhc3NlcnRJc0RlZmluZWQodGhpcy5wYW5ldmlldykub25EaWRTYXNoQ2hhbmdlO1xuXHR9XG5cblx0Z2V0IHBhbmVzKCk6IFZpZXdQYW5lW10ge1xuXHRcdHJldHVybiB0aGlzLnBhbmVJdGVtcy5tYXAoaSA9PiBpLnBhbmUpO1xuXHR9XG5cblx0Z2V0IHZpZXdzKCk6IElWaWV3W10ge1xuXHRcdHJldHVybiB0aGlzLnBhbmVzO1xuXHR9XG5cblx0Z2V0IGxlbmd0aCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnBhbmVJdGVtcy5sZW5ndGg7XG5cdH1cblxuXHRwcml2YXRlIF9tZW51QWN0aW9ucz86IFZpZXdDb250YWluZXJNZW51QWN0aW9ucztcblx0Z2V0IG1lbnVBY3Rpb25zKCk6IENvbXBvc2l0ZU1lbnVBY3Rpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbWVudUFjdGlvbnM7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgb3B0aW9uczogSVZpZXdQYW5lQ29udGFpbmVyT3B0aW9ucyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIHByb3RlY3RlZCBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcm90ZWN0ZWQgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcm90ZWN0ZWQgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByb3RlY3RlZCBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcm90ZWN0ZWQgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByb3RlY3RlZCBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHByb3RlY3RlZCB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cblx0XHRzdXBlcihpZCwgdGhlbWVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cblx0XHRjb25zdCBjb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChpZCk7XG5cdFx0aWYgKCFjb250YWluZXIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgY29udGFpbmVyJyk7XG5cdFx0fVxuXG5cblx0XHR0aGlzLnZpZXdDb250YWluZXIgPSBjb250YWluZXI7XG5cdFx0dGhpcy52aXNpYmxlVmlld3NTdG9yYWdlSWQgPSBgJHtpZH0ubnVtYmVyT2ZWaXNpYmxlVmlld3NgO1xuXHRcdHRoaXMudmlzaWJsZVZpZXdzQ291bnRGcm9tQ2FjaGUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE51bWJlcih0aGlzLnZpc2libGVWaWV3c1N0b3JhZ2VJZCwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgdW5kZWZpbmVkKTtcblx0XHR0aGlzLnZpZXdDb250YWluZXJNb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpO1xuXHR9XG5cblx0Y3JlYXRlKHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zIGFzIElQYW5lVmlld09wdGlvbnM7XG5cdFx0b3B0aW9ucy5vcmllbnRhdGlvbiA9IHRoaXMub3JpZW50YXRpb247XG5cdFx0dGhpcy5wYW5ldmlldyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQYW5lVmlldyhwYXJlbnQsIHRoaXMub3B0aW9ucykpO1xuXG5cdFx0aWYgKHRoaXMuX2JvdW5kYXJ5U2FzaGVzKSB7XG5cdFx0XHR0aGlzLnBhbmV2aWV3LnNldEJvdW5kYXJ5U2FzaGVzKHRoaXMuX2JvdW5kYXJ5U2FzaGVzKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnBhbmV2aWV3Lm9uRGlkRHJvcCgoeyBmcm9tLCB0byB9KSA9PiB0aGlzLm1vdmVQYW5lKGZyb20gYXMgVmlld1BhbmUsIHRvIGFzIFZpZXdQYW5lKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucGFuZXZpZXcub25EaWRTY3JvbGwoXyA9PiB0aGlzLm9uRGlkU2Nyb2xsUGFuZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5wYW5ldmlldy5vbkRpZFNhc2hSZXNldCgoaW5kZXgpID0+IHRoaXMub25EaWRTYXNoUmVzZXQoaW5kZXgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHBhcmVudCwgRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgKGU6IE1vdXNlRXZlbnQpID0+IHRoaXMuc2hvd0NvbnRleHRNZW51KG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZ2V0V2luZG93KHBhcmVudCksIGUpKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEdlc3R1cmUuYWRkVGFyZ2V0KHBhcmVudCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihwYXJlbnQsIFRvdWNoRXZlbnRUeXBlLkNvbnRleHRtZW51LCAoZTogTW91c2VFdmVudCkgPT4gdGhpcy5zaG93Q29udGV4dE1lbnUobmV3IFN0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3cocGFyZW50KSwgZSkpKSk7XG5cblx0XHR0aGlzLl9tZW51QWN0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVmlld0NvbnRhaW5lck1lbnVBY3Rpb25zLCB0aGlzLnBhbmV2aWV3LmVsZW1lbnQsIHRoaXMudmlld0NvbnRhaW5lcikpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX21lbnVBY3Rpb25zLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlVGl0bGVBcmVhKCkpKTtcblxuXHRcdGxldCBvdmVybGF5OiBWaWV3UGFuZURyb3BPdmVybGF5IHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGdldE92ZXJsYXlCb3VuZHM6ICgpID0+IEJvdW5kaW5nUmVjdCA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGZ1bGxTaXplID0gcGFyZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0Y29uc3QgbGFzdFBhbmUgPSB0aGlzLnBhbmVzW3RoaXMucGFuZXMubGVuZ3RoIC0gMV0uZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdGNvbnN0IHRvcCA9IHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMID8gbGFzdFBhbmUuYm90dG9tIDogZnVsbFNpemUudG9wO1xuXHRcdFx0Y29uc3QgbGVmdCA9IHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwgPyBsYXN0UGFuZS5yaWdodCA6IGZ1bGxTaXplLmxlZnQ7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHRvcCxcblx0XHRcdFx0Ym90dG9tOiBmdWxsU2l6ZS5ib3R0b20sXG5cdFx0XHRcdGxlZnQsXG5cdFx0XHRcdHJpZ2h0OiBmdWxsU2l6ZS5yaWdodCxcblx0XHRcdH07XG5cdFx0fTtcblxuXHRcdGNvbnN0IGluQm91bmRzID0gKGJvdW5kczogQm91bmRpbmdSZWN0LCBwb3M6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSkgPT4ge1xuXHRcdFx0cmV0dXJuIHBvcy54ID49IGJvdW5kcy5sZWZ0ICYmIHBvcy54IDw9IGJvdW5kcy5yaWdodCAmJiBwb3MueSA+PSBib3VuZHMudG9wICYmIHBvcy55IDw9IGJvdW5kcy5ib3R0b207XG5cdFx0fTtcblxuXG5cdFx0bGV0IGJvdW5kczogQm91bmRpbmdSZWN0O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoQ29tcG9zaXRlRHJhZ0FuZERyb3BPYnNlcnZlci5JTlNUQU5DRS5yZWdpc3RlclRhcmdldChwYXJlbnQsIHtcblx0XHRcdG9uRHJhZ0VudGVyOiAoZSkgPT4ge1xuXHRcdFx0XHRib3VuZHMgPSBnZXRPdmVybGF5Qm91bmRzKCk7XG5cdFx0XHRcdGlmIChvdmVybGF5ICYmIG92ZXJsYXkuZGlzcG9zZWQpIHtcblx0XHRcdFx0XHRvdmVybGF5ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFvdmVybGF5ICYmIGluQm91bmRzKGJvdW5kcywgZS5ldmVudERhdGEpKSB7XG5cdFx0XHRcdFx0Y29uc3QgZHJvcERhdGEgPSBlLmRyYWdBbmREcm9wRGF0YS5nZXREYXRhKCk7XG5cdFx0XHRcdFx0aWYgKGRyb3BEYXRhLnR5cGUgPT09ICd2aWV3Jykge1xuXG5cdFx0XHRcdFx0XHRjb25zdCBvbGRWaWV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKGRyb3BEYXRhLmlkKTtcblx0XHRcdFx0XHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKGRyb3BEYXRhLmlkKTtcblxuXHRcdFx0XHRcdFx0aWYgKG9sZFZpZXdDb250YWluZXIgIT09IHRoaXMudmlld0NvbnRhaW5lciAmJiAoIXZpZXdEZXNjcmlwdG9yIHx8ICF2aWV3RGVzY3JpcHRvci5jYW5Nb3ZlVmlldyB8fCB0aGlzLnZpZXdDb250YWluZXIucmVqZWN0QWRkZWRWaWV3cykpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRvdmVybGF5ID0gbmV3IFZpZXdQYW5lRHJvcE92ZXJsYXkocGFyZW50LCB1bmRlZmluZWQsIGJvdW5kcywgdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHRoaXMudmlld0NvbnRhaW5lcikhLCB0aGlzLnRoZW1lU2VydmljZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGRyb3BEYXRhLnR5cGUgPT09ICdjb21wb3NpdGUnICYmIGRyb3BEYXRhLmlkICE9PSB0aGlzLnZpZXdDb250YWluZXIuaWQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKGRyb3BEYXRhLmlkKSE7XG5cdFx0XHRcdFx0XHRjb25zdCB2aWV3c1RvTW92ZSA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpLmFsbFZpZXdEZXNjcmlwdG9ycztcblxuXHRcdFx0XHRcdFx0aWYgKCF2aWV3c1RvTW92ZS5zb21lKHYgPT4gIXYuY2FuTW92ZVZpZXcpICYmIHZpZXdzVG9Nb3ZlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdFx0b3ZlcmxheSA9IG5ldyBWaWV3UGFuZURyb3BPdmVybGF5KHBhcmVudCwgdW5kZWZpbmVkLCBib3VuZHMsIHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJMb2NhdGlvbih0aGlzLnZpZXdDb250YWluZXIpISwgdGhpcy50aGVtZVNlcnZpY2UpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ092ZXI6IChlKSA9PiB7XG5cdFx0XHRcdGlmIChvdmVybGF5ICYmIG92ZXJsYXkuZGlzcG9zZWQpIHtcblx0XHRcdFx0XHRvdmVybGF5ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG92ZXJsYXkgJiYgIWluQm91bmRzKGJvdW5kcywgZS5ldmVudERhdGEpKSB7XG5cdFx0XHRcdFx0b3ZlcmxheS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0b3ZlcmxheSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpbkJvdW5kcyhib3VuZHMsIGUuZXZlbnREYXRhKSkge1xuXHRcdFx0XHRcdHRvZ2dsZURyb3BFZmZlY3QoZS5ldmVudERhdGEuZGF0YVRyYW5zZmVyLCAnbW92ZScsIG92ZXJsYXkgIT09IHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRvbkRyYWdMZWF2ZTogKGUpID0+IHtcblx0XHRcdFx0b3ZlcmxheT8uZGlzcG9zZSgpO1xuXHRcdFx0XHRvdmVybGF5ID0gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHRcdG9uRHJvcDogKGUpID0+IHtcblx0XHRcdFx0aWYgKG92ZXJsYXkpIHtcblx0XHRcdFx0XHRjb25zdCBkcm9wRGF0YSA9IGUuZHJhZ0FuZERyb3BEYXRhLmdldERhdGEoKTtcblx0XHRcdFx0XHRjb25zdCB2aWV3c1RvTW92ZTogSVZpZXdEZXNjcmlwdG9yW10gPSBbXTtcblxuXHRcdFx0XHRcdGlmIChkcm9wRGF0YS50eXBlID09PSAnY29tcG9zaXRlJyAmJiBkcm9wRGF0YS5pZCAhPT0gdGhpcy52aWV3Q29udGFpbmVyLmlkKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChkcm9wRGF0YS5pZCkhO1xuXHRcdFx0XHRcdFx0Y29uc3QgYWxsVmlld3MgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKS5hbGxWaWV3RGVzY3JpcHRvcnM7XG5cdFx0XHRcdFx0XHRpZiAoIWFsbFZpZXdzLnNvbWUodiA9PiAhdi5jYW5Nb3ZlVmlldykpIHtcblx0XHRcdFx0XHRcdFx0dmlld3NUb01vdmUucHVzaCguLi5hbGxWaWV3cyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChkcm9wRGF0YS50eXBlID09PSAndmlldycpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG9sZFZpZXdDb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQoZHJvcERhdGEuaWQpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3IgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3RGVzY3JpcHRvckJ5SWQoZHJvcERhdGEuaWQpO1xuXHRcdFx0XHRcdFx0aWYgKG9sZFZpZXdDb250YWluZXIgIT09IHRoaXMudmlld0NvbnRhaW5lciAmJiB2aWV3RGVzY3JpcHRvciAmJiB2aWV3RGVzY3JpcHRvci5jYW5Nb3ZlVmlldykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5tb3ZlVmlld3NUb0NvbnRhaW5lcihbdmlld0Rlc2NyaXB0b3JdLCB0aGlzLnZpZXdDb250YWluZXIsIHVuZGVmaW5lZCwgJ2RuZCcpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHBhbmVDb3VudCA9IHRoaXMucGFuZXMubGVuZ3RoO1xuXG5cdFx0XHRcdFx0aWYgKHZpZXdzVG9Nb3ZlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3c1RvQ29udGFpbmVyKHZpZXdzVG9Nb3ZlLCB0aGlzLnZpZXdDb250YWluZXIsIHVuZGVmaW5lZCwgJ2RuZCcpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChwYW5lQ291bnQgPiAwKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHZpZXcgb2Ygdmlld3NUb01vdmUpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcGFuZVRvTW92ZSA9IHRoaXMucGFuZXMuZmluZChwID0+IHAuaWQgPT09IHZpZXcuaWQpO1xuXHRcdFx0XHRcdFx0XHRpZiAocGFuZVRvTW92ZSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubW92ZVBhbmUocGFuZVRvTW92ZSwgdGhpcy5wYW5lc1t0aGlzLnBhbmVzLmxlbmd0aCAtIDFdKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdG92ZXJsYXk/LmRpc3Bvc2UoKTtcblx0XHRcdFx0b3ZlcmxheSA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkU2FzaENoYW5nZSgoKSA9PiB0aGlzLnNhdmVWaWV3U2l6ZXMoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld0NvbnRhaW5lck1vZGVsLm9uRGlkQWRkVmlzaWJsZVZpZXdEZXNjcmlwdG9ycyhhZGRlZCA9PiB0aGlzLm9uRGlkQWRkVmlld0Rlc2NyaXB0b3JzKGFkZGVkKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld0NvbnRhaW5lck1vZGVsLm9uRGlkUmVtb3ZlVmlzaWJsZVZpZXdEZXNjcmlwdG9ycyhyZW1vdmVkID0+IHRoaXMub25EaWRSZW1vdmVWaWV3RGVzY3JpcHRvcnMocmVtb3ZlZCkpKTtcblx0XHRjb25zdCBhZGRlZFZpZXdzOiBJQWRkZWRWaWV3RGVzY3JpcHRvclJlZltdID0gdGhpcy52aWV3Q29udGFpbmVyTW9kZWwudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5tYXAoKHZpZXdEZXNjcmlwdG9yLCBpbmRleCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2l6ZSA9IHRoaXMudmlld0NvbnRhaW5lck1vZGVsLmdldFNpemUodmlld0Rlc2NyaXB0b3IuaWQpO1xuXHRcdFx0Y29uc3QgY29sbGFwc2VkID0gdGhpcy52aWV3Q29udGFpbmVyTW9kZWwuaXNDb2xsYXBzZWQodmlld0Rlc2NyaXB0b3IuaWQpO1xuXHRcdFx0cmV0dXJuICh7IHZpZXdEZXNjcmlwdG9yLCBpbmRleCwgc2l6ZSwgY29sbGFwc2VkIH0pO1xuXHRcdH0pO1xuXHRcdGlmIChhZGRlZFZpZXdzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5vbkRpZEFkZFZpZXdEZXNjcmlwdG9ycyhhZGRlZFZpZXdzKTtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgaGVhZGVycyBhZnRlciBhbmQgdGl0bGUgY29udHJpYnV0ZWQgdmlld3MgYWZ0ZXIgYXZhaWxhYmxlLCBzaW5jZSB3ZSByZWFkIGZyb20gY2FjaGUgaW4gdGhlIGJlZ2lubmluZyB0byBrbm93IGlmIHRoZSB2aWV3bGV0IGhhcyBzaW5nbGUgdmlldyBvciBub3QuIFJlZiAjMjk2MDlcblx0XHR0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCkudGhlbigoKSA9PiB7XG5cdFx0XHR0aGlzLmFyZUV4dGVuc2lvbnNSZWFkeSA9IHRydWU7XG5cdFx0XHRpZiAodGhpcy5wYW5lcy5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVUaXRsZUFyZWEoKTtcblx0XHRcdFx0dGhpcy51cGRhdGVWaWV3SGVhZGVycygpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKExheW91dFNldHRpbmdzLkFDVElWSVRZX0JBUl9MT0NBVElPTikpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVZpZXdIZWFkZXJzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudmlld0NvbnRhaW5lck1vZGVsLm9uRGlkQ2hhbmdlQWN0aXZlVmlld0Rlc2NyaXB0b3JzKCgpID0+IHRoaXMuX29uVGl0bGVBcmVhVXBkYXRlLmZpcmUoKSkpO1xuXHR9XG5cblx0Z2V0VGl0bGUoKTogc3RyaW5nIHtcblx0XHRjb25zdCBjb250YWluZXJUaXRsZSA9IHRoaXMudmlld0NvbnRhaW5lck1vZGVsLnRpdGxlO1xuXG5cdFx0aWYgKHRoaXMuaXNWaWV3TWVyZ2VkV2l0aENvbnRhaW5lcigpKSB7XG5cdFx0XHRjb25zdCBzaW5nbGVWaWV3UGFuZUNvbnRhaW5lclRpdGxlID0gdGhpcy5wYW5lSXRlbXNbMF0ucGFuZS5zaW5nbGVWaWV3UGFuZUNvbnRhaW5lclRpdGxlO1xuXHRcdFx0aWYgKHNpbmdsZVZpZXdQYW5lQ29udGFpbmVyVGl0bGUpIHtcblx0XHRcdFx0cmV0dXJuIHNpbmdsZVZpZXdQYW5lQ29udGFpbmVyVGl0bGU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHBhbmVJdGVtVGl0bGUgPSB0aGlzLnBhbmVJdGVtc1swXS5wYW5lLnRpdGxlO1xuXHRcdFx0aWYgKGNvbnRhaW5lclRpdGxlID09PSBwYW5lSXRlbVRpdGxlKSB7XG5cdFx0XHRcdHJldHVybiBwYW5lSXRlbVRpdGxlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcGFuZUl0ZW1UaXRsZSA/IGAke2NvbnRhaW5lclRpdGxlfTogJHtwYW5lSXRlbVRpdGxlfWAgOiBjb250YWluZXJUaXRsZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY29udGFpbmVyVGl0bGU7XG5cdH1cblxuXHRwcml2YXRlIHNob3dDb250ZXh0TWVudShldmVudDogU3RhbmRhcmRNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBwYW5lSXRlbSBvZiB0aGlzLnBhbmVJdGVtcykge1xuXHRcdFx0Ly8gRG8gbm90IHNob3cgY29udGV4dCBtZW51IGlmIHRhcmdldCBpcyBjb21pbmcgZnJvbSBpbnNpZGUgcGFuZSB2aWV3c1xuXHRcdFx0aWYgKGlzQW5jZXN0b3IoZXZlbnQudGFyZ2V0LCBwYW5lSXRlbS5wYW5lLmVsZW1lbnQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiB0aGlzLm1lbnVBY3Rpb25zPy5nZXRDb250ZXh0TWVudUFjdGlvbnMoKSA/PyBbXVxuXHRcdH0pO1xuXHR9XG5cblx0Z2V0QWN0aW9uc0NvbnRleHQoKTogdW5rbm93biB7XG5cdFx0aWYgKHRoaXMuaXNWaWV3TWVyZ2VkV2l0aENvbnRhaW5lcigpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wYW5lc1swXS5nZXRBY3Rpb25zQ29udGV4dCgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0QWN0aW9uVmlld0l0ZW0oYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zOiBJQmFzZUFjdGlvblZpZXdJdGVtT3B0aW9ucyk6IElBY3Rpb25WaWV3SXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuaXNWaWV3TWVyZ2VkV2l0aENvbnRhaW5lcigpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wYW5lSXRlbXNbMF0ucGFuZS5jcmVhdGVBY3Rpb25WaWV3SXRlbShhY3Rpb24sIG9wdGlvbnMpO1xuXHRcdH1cblx0XHRyZXR1cm4gY3JlYXRlQWN0aW9uVmlld0l0ZW0odGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSwgYWN0aW9uLCBvcHRpb25zKTtcblx0fVxuXG5cdGZvY3VzKCk6IHZvaWQge1xuXHRcdGxldCBwYW5lVG9Gb2N1czogVmlld1BhbmUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHRoaXMubGFzdEZvY3VzZWRQYW5lKSB7XG5cdFx0XHRwYW5lVG9Gb2N1cyA9IHRoaXMubGFzdEZvY3VzZWRQYW5lO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5wYW5lSXRlbXMubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yIChjb25zdCB7IHBhbmUgfSBvZiB0aGlzLnBhbmVJdGVtcykge1xuXHRcdFx0XHRpZiAocGFuZS5pc0V4cGFuZGVkKCkpIHtcblx0XHRcdFx0XHRwYW5lVG9Gb2N1cyA9IHBhbmU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHBhbmVUb0ZvY3VzKSB7XG5cdFx0XHRwYW5lVG9Gb2N1cy5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0IG9yaWVudGF0aW9uKCk6IE9yaWVudGF0aW9uIHtcblx0XHRzd2l0Y2ggKHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJMb2NhdGlvbih0aGlzLnZpZXdDb250YWluZXIpKSB7XG5cdFx0XHRjYXNlIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyOlxuXHRcdFx0Y2FzZSBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyOlxuXHRcdFx0XHRyZXR1cm4gT3JpZW50YXRpb24uVkVSVElDQUw7XG5cdFx0XHRjYXNlIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbDoge1xuXHRcdFx0XHRyZXR1cm4gaXNIb3Jpem9udGFsKHRoaXMubGF5b3V0U2VydmljZS5nZXRQYW5lbFBvc2l0aW9uKCkpID8gT3JpZW50YXRpb24uSE9SSVpPTlRBTCA6IE9yaWVudGF0aW9uLlZFUlRJQ0FMO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBPcmllbnRhdGlvbi5WRVJUSUNBTDtcblx0fVxuXG5cdGxheW91dChkaW1lbnNpb246IERpbWVuc2lvbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLnBhbmV2aWV3KSB7XG5cdFx0XHRpZiAodGhpcy5wYW5ldmlldy5vcmllbnRhdGlvbiAhPT0gdGhpcy5vcmllbnRhdGlvbikge1xuXHRcdFx0XHR0aGlzLnBhbmV2aWV3LmZsaXBPcmllbnRhdGlvbihkaW1lbnNpb24uaGVpZ2h0LCBkaW1lbnNpb24ud2lkdGgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnBhbmV2aWV3LmxheW91dChkaW1lbnNpb24uaGVpZ2h0LCBkaW1lbnNpb24ud2lkdGgpO1xuXHRcdH1cblxuXHRcdHRoaXMuZGltZW5zaW9uID0gZGltZW5zaW9uO1xuXHRcdGlmICh0aGlzLmRpZExheW91dCkge1xuXHRcdFx0dGhpcy5zYXZlVmlld1NpemVzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZGlkTGF5b3V0ID0gdHJ1ZTtcblx0XHRcdHRoaXMucmVzdG9yZVZpZXdTaXplcygpO1xuXHRcdH1cblx0fVxuXG5cdHNldEJvdW5kYXJ5U2FzaGVzKHNhc2hlczogSUJvdW5kYXJ5U2FzaGVzKTogdm9pZCB7XG5cdFx0dGhpcy5fYm91bmRhcnlTYXNoZXMgPSBzYXNoZXM7XG5cdFx0dGhpcy5wYW5ldmlldz8uc2V0Qm91bmRhcnlTYXNoZXMoc2FzaGVzKTtcblx0fVxuXG5cdGdldE9wdGltYWxXaWR0aCgpOiBudW1iZXIge1xuXHRcdGNvbnN0IGFkZGl0aW9uYWxNYXJnaW4gPSAxNjtcblx0XHRjb25zdCBvcHRpbWFsV2lkdGggPSBNYXRoLm1heCguLi50aGlzLnBhbmVzLm1hcCh2aWV3ID0+IHZpZXcuZ2V0T3B0aW1hbFdpZHRoKCkgfHwgMCkpO1xuXHRcdHJldHVybiBvcHRpbWFsV2lkdGggKyBhZGRpdGlvbmFsTWFyZ2luO1xuXHR9XG5cblx0YWRkUGFuZXMocGFuZXM6IHsgcGFuZTogVmlld1BhbmU7IHNpemU6IG51bWJlcjsgaW5kZXg/OiBudW1iZXI7IGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlIH1bXSk6IHZvaWQge1xuXHRcdGNvbnN0IHdhc01lcmdlZCA9IHRoaXMuaXNWaWV3TWVyZ2VkV2l0aENvbnRhaW5lcigpO1xuXG5cdFx0Zm9yIChjb25zdCB7IHBhbmUsIHNpemUsIGluZGV4LCBkaXNwb3NhYmxlIH0gb2YgcGFuZXMpIHtcblx0XHRcdHRoaXMuYWRkUGFuZShwYW5lLCBzaXplLCBkaXNwb3NhYmxlLCBpbmRleCk7XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVWaWV3SGVhZGVycygpO1xuXHRcdGlmICh0aGlzLmlzVmlld01lcmdlZFdpdGhDb250YWluZXIoKSAhPT0gd2FzTWVyZ2VkKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRpdGxlQXJlYSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQWRkVmlld3MuZmlyZShwYW5lcy5tYXAoKHsgcGFuZSB9KSA9PiBwYW5lKSk7XG5cdH1cblxuXHRzZXRWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy52aXNpYmxlICE9PSAhIXZpc2libGUpIHtcblx0XHRcdHRoaXMudmlzaWJsZSA9IHZpc2libGU7XG5cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5maXJlKHZpc2libGUpO1xuXHRcdH1cblxuXHRcdHRoaXMucGFuZXMuZmlsdGVyKHZpZXcgPT4gdmlldy5pc1Zpc2libGUoKSAhPT0gdmlzaWJsZSlcblx0XHRcdC5tYXAoKHZpZXcpID0+IHZpZXcuc2V0VmlzaWJsZSh2aXNpYmxlKSk7XG5cdH1cblxuXHRpc1Zpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMudmlzaWJsZTtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGVUaXRsZUFyZWEoKTogdm9pZCB7XG5cdFx0dGhpcy5fb25UaXRsZUFyZWFVcGRhdGUuZmlyZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZVZpZXcodmlld0Rlc2NyaXB0b3I6IElWaWV3RGVzY3JpcHRvciwgb3B0aW9uczogSVZpZXdsZXRWaWV3T3B0aW9ucyk6IFZpZXdQYW5lIHtcblx0XHRyZXR1cm4gKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UgYXMgYW55KS5jcmVhdGVJbnN0YW5jZSh2aWV3RGVzY3JpcHRvci5jdG9yRGVzY3JpcHRvci5jdG9yLCAuLi4odmlld0Rlc2NyaXB0b3IuY3RvckRlc2NyaXB0b3Iuc3RhdGljQXJndW1lbnRzIHx8IFtdKSwgb3B0aW9ucykgYXMgVmlld1BhbmU7XG5cdH1cblxuXHRnZXRWaWV3KGlkOiBzdHJpbmcpOiBWaWV3UGFuZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMucGFuZXMuZmlsdGVyKHZpZXcgPT4gdmlldy5pZCA9PT0gaWQpWzBdO1xuXHR9XG5cblx0cHJpdmF0ZSBzYXZlVmlld1NpemVzKCk6IHZvaWQge1xuXHRcdC8vIFNhdmUgc2l6ZSBvbmx5IHdoZW4gdGhlIGxheW91dCBoYXMgaGFwcGVuZWRcblx0XHRpZiAodGhpcy5kaWRMYXlvdXQpIHtcblx0XHRcdHRoaXMudmlld0NvbnRhaW5lck1vZGVsLnNldFNpemVzKHRoaXMucGFuZXMubWFwKHZpZXcgPT4gKHsgaWQ6IHZpZXcuaWQsIHNpemU6IHRoaXMuZ2V0UGFuZVNpemUodmlldykgfSkpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlc3RvcmVWaWV3U2l6ZXMoKTogdm9pZCB7XG5cdFx0Ly8gUmVzdG9yZSBzaXplcyBvbmx5IHdoZW4gdGhlIGxheW91dCBoYXMgaGFwcGVuZWRcblx0XHRpZiAodGhpcy5kaWRMYXlvdXQpIHtcblx0XHRcdGxldCBpbml0aWFsU2l6ZXM7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudmlld0NvbnRhaW5lck1vZGVsLnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IHRoaXMucGFuZXNbaV07XG5cdFx0XHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yID0gdGhpcy52aWV3Q29udGFpbmVyTW9kZWwudmlzaWJsZVZpZXdEZXNjcmlwdG9yc1tpXTtcblx0XHRcdFx0Y29uc3Qgc2l6ZSA9IHRoaXMudmlld0NvbnRhaW5lck1vZGVsLmdldFNpemUodmlld0Rlc2NyaXB0b3IuaWQpO1xuXG5cdFx0XHRcdGlmICh0eXBlb2Ygc2l6ZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHR0aGlzLnJlc2l6ZVBhbmUocGFuZSwgc2l6ZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW5pdGlhbFNpemVzID0gaW5pdGlhbFNpemVzID8gaW5pdGlhbFNpemVzIDogdGhpcy5jb21wdXRlSW5pdGlhbFNpemVzKCk7XG5cdFx0XHRcdFx0dGhpcy5yZXNpemVQYW5lKHBhbmUsIGluaXRpYWxTaXplcy5nZXQocGFuZS5pZCkgfHwgMjAwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZUluaXRpYWxTaXplcygpOiBNYXA8c3RyaW5nLCBudW1iZXI+IHtcblx0XHRjb25zdCBzaXplczogTWFwPHN0cmluZywgbnVtYmVyPiA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cdFx0aWYgKHRoaXMuZGltZW5zaW9uKSB7XG5cdFx0XHRjb25zdCB0b3RhbFdlaWdodCA9IHRoaXMudmlld0NvbnRhaW5lck1vZGVsLnZpc2libGVWaWV3RGVzY3JpcHRvcnMucmVkdWNlKCh0b3RhbFdlaWdodCwgeyB3ZWlnaHQgfSkgPT4gdG90YWxXZWlnaHQgKyAod2VpZ2h0IHx8IDIwKSwgMCk7XG5cdFx0XHRmb3IgKGNvbnN0IHZpZXdEZXNjcmlwdG9yIG9mIHRoaXMudmlld0NvbnRhaW5lck1vZGVsLnZpc2libGVWaWV3RGVzY3JpcHRvcnMpIHtcblx0XHRcdFx0aWYgKHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMKSB7XG5cdFx0XHRcdFx0c2l6ZXMuc2V0KHZpZXdEZXNjcmlwdG9yLmlkLCB0aGlzLmRpbWVuc2lvbi5oZWlnaHQgKiAodmlld0Rlc2NyaXB0b3Iud2VpZ2h0IHx8IDIwKSAvIHRvdGFsV2VpZ2h0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzaXplcy5zZXQodmlld0Rlc2NyaXB0b3IuaWQsIHRoaXMuZGltZW5zaW9uLndpZHRoICogKHZpZXdEZXNjcmlwdG9yLndlaWdodCB8fCAyMCkgLyB0b3RhbFdlaWdodCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHNpemVzO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNhdmVTdGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLnBhbmVzLmZvckVhY2goKHZpZXcpID0+IHZpZXcuc2F2ZVN0YXRlKCkpO1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUodGhpcy52aXNpYmxlVmlld3NTdG9yYWdlSWQsIHRoaXMubGVuZ3RoLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbnRleHRNZW51KGV2ZW50OiBTdGFuZGFyZE1vdXNlRXZlbnQsIHZpZXdQYW5lOiBWaWV3UGFuZSk6IHZvaWQge1xuXHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSB2aWV3UGFuZS5tZW51QWN0aW9ucy5nZXRDb250ZXh0TWVudUFjdGlvbnMoKTtcblxuXHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IGV2ZW50LFxuXHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9uc1xuXHRcdH0pO1xuXHR9XG5cblx0b3BlblZpZXcoaWQ6IHN0cmluZywgZm9jdXM/OiBib29sZWFuKTogSVZpZXcgfCB1bmRlZmluZWQge1xuXHRcdGxldCB2aWV3ID0gdGhpcy5nZXRWaWV3KGlkKTtcblx0XHRpZiAoIXZpZXcpIHtcblx0XHRcdHRoaXMudG9nZ2xlVmlld1Zpc2liaWxpdHkoaWQpO1xuXHRcdH1cblx0XHR2aWV3ID0gdGhpcy5nZXRWaWV3KGlkKTtcblx0XHRpZiAodmlldykge1xuXHRcdFx0dmlldy5zZXRFeHBhbmRlZCh0cnVlKTtcblx0XHRcdGlmIChmb2N1cykge1xuXHRcdFx0XHR2aWV3LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB2aWV3O1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRGlkQWRkVmlld0Rlc2NyaXB0b3JzKGFkZGVkOiBJQWRkZWRWaWV3RGVzY3JpcHRvclJlZltdKTogVmlld1BhbmVbXSB7XG5cdFx0Y29uc3QgcGFuZXNUb0FkZDogeyBwYW5lOiBWaWV3UGFuZTsgc2l6ZTogbnVtYmVyOyBpbmRleDogbnVtYmVyOyBkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSB9W10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgeyB2aWV3RGVzY3JpcHRvciwgY29sbGFwc2VkLCBpbmRleCwgc2l6ZSB9IG9mIGFkZGVkKSB7XG5cdFx0XHRjb25zdCBwYW5lID0gdGhpcy5jcmVhdGVWaWV3KHZpZXdEZXNjcmlwdG9yLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IHZpZXdEZXNjcmlwdG9yLmlkLFxuXHRcdFx0XHRcdHRpdGxlOiB2aWV3RGVzY3JpcHRvci5uYW1lLnZhbHVlLFxuXHRcdFx0XHRcdGZyb21FeHRlbnNpb25JZDogKHZpZXdEZXNjcmlwdG9yIGFzIFBhcnRpYWw8SUN1c3RvbVZpZXdEZXNjcmlwdG9yPikuZXh0ZW5zaW9uSWQsXG5cdFx0XHRcdFx0ZXhwYW5kZWQ6ICFjb2xsYXBzZWQsXG5cdFx0XHRcdFx0c2luZ2xlVmlld1BhbmVDb250YWluZXJUaXRsZTogdmlld0Rlc2NyaXB0b3Iuc2luZ2xlVmlld1BhbmVDb250YWluZXJUaXRsZSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHBhbmUucmVuZGVyKCk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEZhaWwgdG8gcmVuZGVyIHZpZXcgJHt2aWV3RGVzY3JpcHRvci5pZH1gLCBlcnJvcik7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHBhbmUuZHJhZ2dhYmxlRWxlbWVudCkge1xuXHRcdFx0XHRjb25zdCBjb250ZXh0TWVudURpc3Bvc2FibGUgPSBhZGREaXNwb3NhYmxlTGlzdGVuZXIocGFuZS5kcmFnZ2FibGVFbGVtZW50LCAnY29udGV4dG1lbnUnLCBlID0+IHtcblx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHR0aGlzLm9uQ29udGV4dE1lbnUobmV3IFN0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3cocGFuZS5kcmFnZ2FibGVFbGVtZW50KSwgZSksIHBhbmUpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBjb2xsYXBzZURpc3Bvc2FibGUgPSBFdmVudC5sYXRjaChFdmVudC5tYXAocGFuZS5vbkRpZENoYW5nZSwgKCkgPT4gIXBhbmUuaXNFeHBhbmRlZCgpKSkoY29sbGFwc2VkID0+IHtcblx0XHRcdFx0XHR0aGlzLnZpZXdDb250YWluZXJNb2RlbC5zZXRDb2xsYXBzZWQodmlld0Rlc2NyaXB0b3IuaWQsIGNvbGxhcHNlZCk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHBhbmVzVG9BZGQucHVzaCh7IHBhbmUsIHNpemU6IHNpemUgfHwgcGFuZS5taW5pbXVtU2l6ZSwgaW5kZXgsIGRpc3Bvc2FibGU6IGNvbWJpbmVkRGlzcG9zYWJsZShjb250ZXh0TWVudURpc3Bvc2FibGUsIGNvbGxhcHNlRGlzcG9zYWJsZSkgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5hZGRQYW5lcyhwYW5lc1RvQWRkKTtcblx0XHR0aGlzLnJlc3RvcmVWaWV3U2l6ZXMoKTtcblxuXHRcdGNvbnN0IHBhbmVzOiBWaWV3UGFuZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCB7IHBhbmUgfSBvZiBwYW5lc1RvQWRkKSB7XG5cdFx0XHRwYW5lLnNldFZpc2libGUodGhpcy5pc1Zpc2libGUoKSk7XG5cdFx0XHRwYW5lcy5wdXNoKHBhbmUpO1xuXHRcdH1cblx0XHRyZXR1cm4gcGFuZXM7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkUmVtb3ZlVmlld0Rlc2NyaXB0b3JzKHJlbW92ZWQ6IElWaWV3RGVzY3JpcHRvclJlZltdKTogdm9pZCB7XG5cdFx0cmVtb3ZlZCA9IHJlbW92ZWQuc29ydCgoYSwgYikgPT4gYi5pbmRleCAtIGEuaW5kZXgpO1xuXHRcdGNvbnN0IHBhbmVzVG9SZW1vdmU6IFZpZXdQYW5lW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHsgaW5kZXggfSBvZiByZW1vdmVkKSB7XG5cdFx0XHRjb25zdCBwYW5lSXRlbSA9IHRoaXMucGFuZUl0ZW1zW2luZGV4XTtcblx0XHRcdGlmIChwYW5lSXRlbSkge1xuXHRcdFx0XHRwYW5lc1RvUmVtb3ZlLnB1c2godGhpcy5wYW5lSXRlbXNbaW5kZXhdLnBhbmUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwYW5lc1RvUmVtb3ZlLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5yZW1vdmVQYW5lcyhwYW5lc1RvUmVtb3ZlKTtcblxuXHRcdFx0Zm9yIChjb25zdCBwYW5lIG9mIHBhbmVzVG9SZW1vdmUpIHtcblx0XHRcdFx0cGFuZS5zZXRWaXNpYmxlKGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR0b2dnbGVWaWV3VmlzaWJpbGl0eSh2aWV3SWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdC8vIENoZWNrIGlmIHZpZXcgaXMgYWN0aXZlXG5cdFx0aWYgKHRoaXMudmlld0NvbnRhaW5lck1vZGVsLmFjdGl2ZVZpZXdEZXNjcmlwdG9ycy5zb21lKHZpZXdEZXNjcmlwdG9yID0+IHZpZXdEZXNjcmlwdG9yLmlkID09PSB2aWV3SWQpKSB7XG5cdFx0XHRjb25zdCB2aXNpYmxlID0gIXRoaXMudmlld0NvbnRhaW5lck1vZGVsLmlzVmlzaWJsZSh2aWV3SWQpO1xuXHRcdFx0dGhpcy52aWV3Q29udGFpbmVyTW9kZWwuc2V0VmlzaWJsZSh2aWV3SWQsIHZpc2libGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYWRkUGFuZShwYW5lOiBWaWV3UGFuZSwgc2l6ZTogbnVtYmVyLCBkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSwgaW5kZXggPSB0aGlzLnBhbmVJdGVtcy5sZW5ndGggLSAxKTogdm9pZCB7XG5cdFx0Y29uc3Qgb25EaWRGb2N1cyA9IHBhbmUub25EaWRGb2N1cygoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZEZvY3VzVmlldy5maXJlKHBhbmUpO1xuXHRcdFx0dGhpcy5sYXN0Rm9jdXNlZFBhbmUgPSBwYW5lO1xuXHRcdH0pO1xuXHRcdGNvbnN0IG9uRGlkQmx1ciA9IHBhbmUub25EaWRCbHVyKCgpID0+IHRoaXMuX29uRGlkQmx1clZpZXcuZmlyZShwYW5lKSk7XG5cdFx0Y29uc3Qgb25EaWRDaGFuZ2VUaXRsZUFyZWEgPSBwYW5lLm9uRGlkQ2hhbmdlVGl0bGVBcmVhKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmlld01lcmdlZFdpdGhDb250YWluZXIoKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVRpdGxlQXJlYSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gcGFuZS5vbkRpZENoYW5nZUJvZHlWaXNpYmlsaXR5KCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHkuZmlyZShwYW5lKSk7XG5cdFx0Y29uc3Qgb25EaWRDaGFuZ2UgPSBwYW5lLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdGlmIChwYW5lID09PSB0aGlzLmxhc3RGb2N1c2VkUGFuZSAmJiAhcGFuZS5pc0V4cGFuZGVkKCkpIHtcblx0XHRcdFx0dGhpcy5sYXN0Rm9jdXNlZFBhbmUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBpc1BhbmVsID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHRoaXMudmlld0NvbnRhaW5lcikgPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbDtcblx0XHRwYW5lLnN0eWxlKHtcblx0XHRcdGhlYWRlckZvcmVncm91bmQ6IGFzQ3NzVmFyaWFibGUoaXNQYW5lbCA/IFBBTkVMX1NFQ1RJT05fSEVBREVSX0ZPUkVHUk9VTkQgOiBTSURFX0JBUl9TRUNUSU9OX0hFQURFUl9GT1JFR1JPVU5EKSxcblx0XHRcdGhlYWRlckJhY2tncm91bmQ6IGFzQ3NzVmFyaWFibGUoaXNQYW5lbCA/IFBBTkVMX1NFQ1RJT05fSEVBREVSX0JBQ0tHUk9VTkQgOiBTSURFX0JBUl9TRUNUSU9OX0hFQURFUl9CQUNLR1JPVU5EKSxcblx0XHRcdGhlYWRlckJvcmRlcjogYXNDc3NWYXJpYWJsZShpc1BhbmVsID8gUEFORUxfU0VDVElPTl9IRUFERVJfQk9SREVSIDogU0lERV9CQVJfU0VDVElPTl9IRUFERVJfQk9SREVSKSxcblx0XHRcdGRyb3BCYWNrZ3JvdW5kOiBhc0Nzc1ZhcmlhYmxlKGlzUGFuZWwgPyBQQU5FTF9TRUNUSU9OX0RSQUdfQU5EX0RST1BfQkFDS0dST1VORCA6IFNJREVfQkFSX0RSQUdfQU5EX0RST1BfQkFDS0dST1VORCksXG5cdFx0XHRsZWZ0Qm9yZGVyOiBpc1BhbmVsID8gYXNDc3NWYXJpYWJsZShQQU5FTF9TRUNUSU9OX0JPUkRFUikgOiB1bmRlZmluZWRcblx0XHR9KTtcblxuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHN0b3JlLmFkZChkaXNwb3NhYmxlKTtcblx0XHRzdG9yZS5hZGQoY29tYmluZWREaXNwb3NhYmxlKHBhbmUsIG9uRGlkRm9jdXMsIG9uRGlkQmx1ciwgb25EaWRDaGFuZ2VUaXRsZUFyZWEsIG9uRGlkQ2hhbmdlLCBvbkRpZENoYW5nZVZpc2liaWxpdHkpKTtcblx0XHRjb25zdCBwYW5lSXRlbTogSVZpZXdQYW5lSXRlbSA9IHsgcGFuZSwgZGlzcG9zYWJsZTogc3RvcmUgfTtcblxuXHRcdHRoaXMucGFuZUl0ZW1zLnNwbGljZShpbmRleCwgMCwgcGFuZUl0ZW0pO1xuXHRcdGFzc2VydElzRGVmaW5lZCh0aGlzLnBhbmV2aWV3KS5hZGRQYW5lKHBhbmUsIHNpemUsIGluZGV4KTtcblxuXHRcdGxldCBvdmVybGF5OiBWaWV3UGFuZURyb3BPdmVybGF5IHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKHBhbmUuZHJhZ2dhYmxlRWxlbWVudCkge1xuXHRcdFx0c3RvcmUuYWRkKENvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXIuSU5TVEFOQ0UucmVnaXN0ZXJEcmFnZ2FibGUocGFuZS5kcmFnZ2FibGVFbGVtZW50LCAoKSA9PiB7IHJldHVybiB7IHR5cGU6ICd2aWV3JywgaWQ6IHBhbmUuaWQgfTsgfSwge30pKTtcblx0XHR9XG5cblx0XHRzdG9yZS5hZGQoQ29tcG9zaXRlRHJhZ0FuZERyb3BPYnNlcnZlci5JTlNUQU5DRS5yZWdpc3RlclRhcmdldChwYW5lLmRyb3BUYXJnZXRFbGVtZW50LCB7XG5cdFx0XHRvbkRyYWdFbnRlcjogKGUpID0+IHtcblx0XHRcdFx0aWYgKCFvdmVybGF5KSB7XG5cdFx0XHRcdFx0Y29uc3QgZHJvcERhdGEgPSBlLmRyYWdBbmREcm9wRGF0YS5nZXREYXRhKCk7XG5cdFx0XHRcdFx0aWYgKGRyb3BEYXRhLnR5cGUgPT09ICd2aWV3JyAmJiBkcm9wRGF0YS5pZCAhPT0gcGFuZS5pZCkge1xuXG5cdFx0XHRcdFx0XHRjb25zdCBvbGRWaWV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKGRyb3BEYXRhLmlkKTtcblx0XHRcdFx0XHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKGRyb3BEYXRhLmlkKTtcblxuXHRcdFx0XHRcdFx0aWYgKG9sZFZpZXdDb250YWluZXIgIT09IHRoaXMudmlld0NvbnRhaW5lciAmJiAoIXZpZXdEZXNjcmlwdG9yIHx8ICF2aWV3RGVzY3JpcHRvci5jYW5Nb3ZlVmlldyB8fCB0aGlzLnZpZXdDb250YWluZXIucmVqZWN0QWRkZWRWaWV3cykpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRvdmVybGF5ID0gbmV3IFZpZXdQYW5lRHJvcE92ZXJsYXkocGFuZS5kcm9wVGFyZ2V0RWxlbWVudCwgdGhpcy5vcmllbnRhdGlvbiA/PyBPcmllbnRhdGlvbi5WRVJUSUNBTCwgdW5kZWZpbmVkLCB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24odGhpcy52aWV3Q29udGFpbmVyKSEsIHRoaXMudGhlbWVTZXJ2aWNlKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoZHJvcERhdGEudHlwZSA9PT0gJ2NvbXBvc2l0ZScgJiYgZHJvcERhdGEuaWQgIT09IHRoaXMudmlld0NvbnRhaW5lci5pZCAmJiAhdGhpcy52aWV3Q29udGFpbmVyLnJlamVjdEFkZGVkVmlld3MpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKGRyb3BEYXRhLmlkKSE7XG5cdFx0XHRcdFx0XHRjb25zdCB2aWV3c1RvTW92ZSA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbChjb250YWluZXIpLmFsbFZpZXdEZXNjcmlwdG9ycztcblxuXHRcdFx0XHRcdFx0aWYgKCF2aWV3c1RvTW92ZS5zb21lKHYgPT4gIXYuY2FuTW92ZVZpZXcpICYmIHZpZXdzVG9Nb3ZlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdFx0b3ZlcmxheSA9IG5ldyBWaWV3UGFuZURyb3BPdmVybGF5KHBhbmUuZHJvcFRhcmdldEVsZW1lbnQsIHRoaXMub3JpZW50YXRpb24gPz8gT3JpZW50YXRpb24uVkVSVElDQUwsIHVuZGVmaW5lZCwgdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKHRoaXMudmlld0NvbnRhaW5lcikhLCB0aGlzLnRoZW1lU2VydmljZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0b25EcmFnT3ZlcjogKGUpID0+IHtcblx0XHRcdFx0dG9nZ2xlRHJvcEVmZmVjdChlLmV2ZW50RGF0YS5kYXRhVHJhbnNmZXIsICdtb3ZlJywgb3ZlcmxheSAhPT0gdW5kZWZpbmVkKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRyYWdMZWF2ZTogKGUpID0+IHtcblx0XHRcdFx0b3ZlcmxheT8uZGlzcG9zZSgpO1xuXHRcdFx0XHRvdmVybGF5ID0gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHRcdG9uRHJvcDogKGUpID0+IHtcblx0XHRcdFx0aWYgKG92ZXJsYXkpIHtcblx0XHRcdFx0XHRjb25zdCBkcm9wRGF0YSA9IGUuZHJhZ0FuZERyb3BEYXRhLmdldERhdGEoKTtcblx0XHRcdFx0XHRjb25zdCB2aWV3c1RvTW92ZTogSVZpZXdEZXNjcmlwdG9yW10gPSBbXTtcblx0XHRcdFx0XHRsZXQgYW5jaG9yVmlldzogSVZpZXdEZXNjcmlwdG9yIHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0aWYgKGRyb3BEYXRhLnR5cGUgPT09ICdjb21wb3NpdGUnICYmIGRyb3BEYXRhLmlkICE9PSB0aGlzLnZpZXdDb250YWluZXIuaWQgJiYgIXRoaXMudmlld0NvbnRhaW5lci5yZWplY3RBZGRlZFZpZXdzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChkcm9wRGF0YS5pZCkhO1xuXHRcdFx0XHRcdFx0Y29uc3QgYWxsVmlld3MgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKS5hbGxWaWV3RGVzY3JpcHRvcnM7XG5cblx0XHRcdFx0XHRcdGlmIChhbGxWaWV3cy5sZW5ndGggPiAwICYmICFhbGxWaWV3cy5zb21lKHYgPT4gIXYuY2FuTW92ZVZpZXcpKSB7XG5cdFx0XHRcdFx0XHRcdHZpZXdzVG9Nb3ZlLnB1c2goLi4uYWxsVmlld3MpO1xuXHRcdFx0XHRcdFx0XHRhbmNob3JWaWV3ID0gYWxsVmlld3NbMF07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChkcm9wRGF0YS50eXBlID09PSAndmlldycpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG9sZFZpZXdDb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQoZHJvcERhdGEuaWQpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3IgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3RGVzY3JpcHRvckJ5SWQoZHJvcERhdGEuaWQpO1xuXHRcdFx0XHRcdFx0aWYgKG9sZFZpZXdDb250YWluZXIgIT09IHRoaXMudmlld0NvbnRhaW5lciAmJiB2aWV3RGVzY3JpcHRvciAmJiB2aWV3RGVzY3JpcHRvci5jYW5Nb3ZlVmlldyAmJiAhdGhpcy52aWV3Q29udGFpbmVyLnJlamVjdEFkZGVkVmlld3MpIHtcblx0XHRcdFx0XHRcdFx0dmlld3NUb01vdmUucHVzaCh2aWV3RGVzY3JpcHRvcik7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICh2aWV3RGVzY3JpcHRvcikge1xuXHRcdFx0XHRcdFx0XHRhbmNob3JWaWV3ID0gdmlld0Rlc2NyaXB0b3I7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHZpZXdzVG9Nb3ZlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5tb3ZlVmlld3NUb0NvbnRhaW5lcih2aWV3c1RvTW92ZSwgdGhpcy52aWV3Q29udGFpbmVyLCB1bmRlZmluZWQsICdkbmQnKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoYW5jaG9yVmlldykge1xuXHRcdFx0XHRcdFx0aWYgKG92ZXJsYXkuY3VycmVudERyb3BPcGVyYXRpb24gPT09IERyb3BEaXJlY3Rpb24uRE9XTiB8fFxuXHRcdFx0XHRcdFx0XHRvdmVybGF5LmN1cnJlbnREcm9wT3BlcmF0aW9uID09PSBEcm9wRGlyZWN0aW9uLlJJR0hUKSB7XG5cblx0XHRcdFx0XHRcdFx0Y29uc3QgZnJvbUluZGV4ID0gdGhpcy5wYW5lcy5maW5kSW5kZXgocCA9PiBwLmlkID09PSBhbmNob3JWaWV3IS5pZCk7XG5cdFx0XHRcdFx0XHRcdGxldCB0b0luZGV4ID0gdGhpcy5wYW5lcy5maW5kSW5kZXgocCA9PiBwLmlkID09PSBwYW5lLmlkKTtcblxuXHRcdFx0XHRcdFx0XHRpZiAoZnJvbUluZGV4ID49IDAgJiYgdG9JbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGZyb21JbmRleCA+IHRvSW5kZXgpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRvSW5kZXgrKztcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRpZiAodG9JbmRleCA8IHRoaXMucGFuZXMubGVuZ3RoICYmIHRvSW5kZXggIT09IGZyb21JbmRleCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5tb3ZlUGFuZSh0aGlzLnBhbmVzW2Zyb21JbmRleF0sIHRoaXMucGFuZXNbdG9JbmRleF0pO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAob3ZlcmxheS5jdXJyZW50RHJvcE9wZXJhdGlvbiA9PT0gRHJvcERpcmVjdGlvbi5VUCB8fFxuXHRcdFx0XHRcdFx0XHRvdmVybGF5LmN1cnJlbnREcm9wT3BlcmF0aW9uID09PSBEcm9wRGlyZWN0aW9uLkxFRlQpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZnJvbUluZGV4ID0gdGhpcy5wYW5lcy5maW5kSW5kZXgocCA9PiBwLmlkID09PSBhbmNob3JWaWV3IS5pZCk7XG5cdFx0XHRcdFx0XHRcdGxldCB0b0luZGV4ID0gdGhpcy5wYW5lcy5maW5kSW5kZXgocCA9PiBwLmlkID09PSBwYW5lLmlkKTtcblxuXHRcdFx0XHRcdFx0XHRpZiAoZnJvbUluZGV4ID49IDAgJiYgdG9JbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGZyb21JbmRleCA8IHRvSW5kZXgpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRvSW5kZXgtLTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRpZiAodG9JbmRleCA+PSAwICYmIHRvSW5kZXggIT09IGZyb21JbmRleCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5tb3ZlUGFuZSh0aGlzLnBhbmVzW2Zyb21JbmRleF0sIHRoaXMucGFuZXNbdG9JbmRleF0pO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAodmlld3NUb01vdmUubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRcdFx0XHR2aWV3c1RvTW92ZS5zbGljZSgxKS5mb3JFYWNoKHZpZXcgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGxldCB0b0luZGV4ID0gdGhpcy5wYW5lcy5maW5kSW5kZXgocCA9PiBwLmlkID09PSBhbmNob3JWaWV3IS5pZCk7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZnJvbUluZGV4ID0gdGhpcy5wYW5lcy5maW5kSW5kZXgocCA9PiBwLmlkID09PSB2aWV3LmlkKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoZnJvbUluZGV4ID49IDAgJiYgdG9JbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZnJvbUluZGV4ID4gdG9JbmRleCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0b0luZGV4Kys7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRcdGlmICh0b0luZGV4IDwgdGhpcy5wYW5lcy5sZW5ndGggJiYgdG9JbmRleCAhPT0gZnJvbUluZGV4KSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHRoaXMubW92ZVBhbmUodGhpcy5wYW5lc1tmcm9tSW5kZXhdLCB0aGlzLnBhbmVzW3RvSW5kZXhdKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0YW5jaG9yVmlldyA9IHZpZXc7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRvdmVybGF5Py5kaXNwb3NlKCk7XG5cdFx0XHRcdG92ZXJsYXkgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cmVtb3ZlUGFuZXMocGFuZXM6IFZpZXdQYW5lW10pOiB2b2lkIHtcblx0XHRjb25zdCB3YXNNZXJnZWQgPSB0aGlzLmlzVmlld01lcmdlZFdpdGhDb250YWluZXIoKTtcblxuXHRcdHBhbmVzLmZvckVhY2gocGFuZSA9PiB0aGlzLnJlbW92ZVBhbmUocGFuZSkpO1xuXG5cdFx0dGhpcy51cGRhdGVWaWV3SGVhZGVycygpO1xuXHRcdGlmICh3YXNNZXJnZWQgIT09IHRoaXMuaXNWaWV3TWVyZ2VkV2l0aENvbnRhaW5lcigpKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRpdGxlQXJlYSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkUmVtb3ZlVmlld3MuZmlyZShwYW5lcyk7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZVBhbmUocGFuZTogVmlld1BhbmUpOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMucGFuZUl0ZW1zLmZpbmRJbmRleChpID0+IGkucGFuZSA9PT0gcGFuZSk7XG5cblx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMubGFzdEZvY3VzZWRQYW5lID09PSBwYW5lKSB7XG5cdFx0XHR0aGlzLmxhc3RGb2N1c2VkUGFuZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRhc3NlcnRJc0RlZmluZWQodGhpcy5wYW5ldmlldykucmVtb3ZlUGFuZShwYW5lKTtcblx0XHRjb25zdCBbcGFuZUl0ZW1dID0gdGhpcy5wYW5lSXRlbXMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRwYW5lSXRlbS5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblxuXHR9XG5cblx0bW92ZVBhbmUoZnJvbTogVmlld1BhbmUsIHRvOiBWaWV3UGFuZSk6IHZvaWQge1xuXHRcdGNvbnN0IGZyb21JbmRleCA9IHRoaXMucGFuZUl0ZW1zLmZpbmRJbmRleChpdGVtID0+IGl0ZW0ucGFuZSA9PT0gZnJvbSk7XG5cdFx0Y29uc3QgdG9JbmRleCA9IHRoaXMucGFuZUl0ZW1zLmZpbmRJbmRleChpdGVtID0+IGl0ZW0ucGFuZSA9PT0gdG8pO1xuXG5cdFx0Y29uc3QgZnJvbVZpZXdEZXNjcmlwdG9yID0gdGhpcy52aWV3Q29udGFpbmVyTW9kZWwudmlzaWJsZVZpZXdEZXNjcmlwdG9yc1tmcm9tSW5kZXhdO1xuXHRcdGNvbnN0IHRvVmlld0Rlc2NyaXB0b3IgPSB0aGlzLnZpZXdDb250YWluZXJNb2RlbC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzW3RvSW5kZXhdO1xuXG5cdFx0aWYgKGZyb21JbmRleCA8IDAgfHwgZnJvbUluZGV4ID49IHRoaXMucGFuZUl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0b0luZGV4IDwgMCB8fCB0b0luZGV4ID49IHRoaXMucGFuZUl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IFtwYW5lSXRlbV0gPSB0aGlzLnBhbmVJdGVtcy5zcGxpY2UoZnJvbUluZGV4LCAxKTtcblx0XHR0aGlzLnBhbmVJdGVtcy5zcGxpY2UodG9JbmRleCwgMCwgcGFuZUl0ZW0pO1xuXG5cdFx0YXNzZXJ0SXNEZWZpbmVkKHRoaXMucGFuZXZpZXcpLm1vdmVQYW5lKGZyb20sIHRvKTtcblxuXHRcdHRoaXMudmlld0NvbnRhaW5lck1vZGVsLm1vdmUoZnJvbVZpZXdEZXNjcmlwdG9yLmlkLCB0b1ZpZXdEZXNjcmlwdG9yLmlkKTtcblxuXHRcdHRoaXMudXBkYXRlVGl0bGVBcmVhKCk7XG5cdH1cblxuXHRyZXNpemVQYW5lKHBhbmU6IFZpZXdQYW5lLCBzaXplOiBudW1iZXIpOiB2b2lkIHtcblx0XHRhc3NlcnRJc0RlZmluZWQodGhpcy5wYW5ldmlldykucmVzaXplUGFuZShwYW5lLCBzaXplKTtcblx0fVxuXG5cdGdldFBhbmVTaXplKHBhbmU6IFZpZXdQYW5lKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gYXNzZXJ0SXNEZWZpbmVkKHRoaXMucGFuZXZpZXcpLmdldFBhbmVTaXplKHBhbmUpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVWaWV3SGVhZGVycygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pc1ZpZXdNZXJnZWRXaXRoQ29udGFpbmVyKCkpIHtcblx0XHRcdGlmICh0aGlzLnBhbmVJdGVtc1swXS5wYW5lLmlzRXhwYW5kZWQoKSkge1xuXHRcdFx0XHR0aGlzLmxhc3RNZXJnZWRDb2xsYXBzZWRQYW5lID0gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5sYXN0TWVyZ2VkQ29sbGFwc2VkUGFuZSA9IHRoaXMucGFuZUl0ZW1zWzBdLnBhbmU7XG5cdFx0XHRcdHRoaXMucGFuZUl0ZW1zWzBdLnBhbmUuc2V0RXhwYW5kZWQodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnBhbmVJdGVtc1swXS5wYW5lLmhlYWRlclZpc2libGUgPSBmYWxzZTtcblx0XHRcdHRoaXMucGFuZUl0ZW1zWzBdLnBhbmUuY29sbGFwc2libGUgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodGhpcy5wYW5lSXRlbXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdHRoaXMucGFuZUl0ZW1zWzBdLnBhbmUuaGVhZGVyVmlzaWJsZSA9IHRydWU7XG5cdFx0XHRcdGlmICh0aGlzLnBhbmVJdGVtc1swXS5wYW5lID09PSB0aGlzLmxhc3RNZXJnZWRDb2xsYXBzZWRQYW5lKSB7XG5cdFx0XHRcdFx0dGhpcy5wYW5lSXRlbXNbMF0ucGFuZS5zZXRFeHBhbmRlZChmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5wYW5lSXRlbXNbMF0ucGFuZS5jb2xsYXBzaWJsZSA9IGZhbHNlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5wYW5lSXRlbXMuZm9yRWFjaChpID0+IHtcblx0XHRcdFx0XHRpLnBhbmUuaGVhZGVyVmlzaWJsZSA9IHRydWU7XG5cdFx0XHRcdFx0aS5wYW5lLmNvbGxhcHNpYmxlID0gdHJ1ZTtcblx0XHRcdFx0XHRpZiAoaS5wYW5lID09PSB0aGlzLmxhc3RNZXJnZWRDb2xsYXBzZWRQYW5lKSB7XG5cdFx0XHRcdFx0XHRpLnBhbmUuc2V0RXhwYW5kZWQoZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmxhc3RNZXJnZWRDb2xsYXBzZWRQYW5lID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGlzVmlld01lcmdlZFdpdGhDb250YWluZXIoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCEodGhpcy5vcHRpb25zLm1lcmdlVmlld1dpdGhDb250YWluZXJXaGVuU2luZ2xlVmlldyAmJiB0aGlzLnBhbmVJdGVtcy5sZW5ndGggPT09IDEpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5hcmVFeHRlbnNpb25zUmVhZHkpIHtcblx0XHRcdGlmICh0aGlzLnZpc2libGVWaWV3c0NvdW50RnJvbUNhY2hlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucGFuZUl0ZW1zWzBdLnBhbmUuaXNFeHBhbmRlZCgpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gQ2hlY2sgaW4gY2FjaGUgc28gdGhhdCB2aWV3IGRvIG5vdCBqdW1wLiBTZWUgIzI5NjA5XG5cdFx0XHRyZXR1cm4gdGhpcy52aXNpYmxlVmlld3NDb3VudEZyb21DYWNoZSA9PT0gMTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkU2Nyb2xsUGFuZSgpIHtcblx0XHRmb3IgKGNvbnN0IHBhbmUgb2YgdGhpcy5wYW5lcykge1xuXHRcdFx0cGFuZS5vbkRpZFNjcm9sbFJvb3QoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkU2FzaFJlc2V0KGluZGV4OiBudW1iZXIpIHtcblx0XHRsZXQgZmlyc3RQYW5lID0gdW5kZWZpbmVkO1xuXHRcdGxldCBzZWNvbmRQYW5lID0gdW5kZWZpbmVkO1xuXG5cdFx0Ly8gRGVhbCB3aXRoIGNvbGxhcHNlZCB2aWV3czogdG8gYmUgY2xldmVyLCB3ZSBzcGxpdCB0aGUgc3BhY2UgdGFrZW4gYnkgdGhlIG5lYXJlc3QgdW5jb2xsYXBzZWQgdmlld3Ncblx0XHRmb3IgKGxldCBpID0gaW5kZXg7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRpZiAodGhpcy5wYW5lSXRlbXNbaV0ucGFuZT8uaXNWaXNpYmxlKCkgJiYgdGhpcy5wYW5lSXRlbXNbaV0/LnBhbmUuaXNFeHBhbmRlZCgpKSB7XG5cdFx0XHRcdGZpcnN0UGFuZSA9IHRoaXMucGFuZUl0ZW1zW2ldLnBhbmU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSBpbmRleCArIDE7IGkgPCB0aGlzLnBhbmVJdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKHRoaXMucGFuZUl0ZW1zW2ldLnBhbmU/LmlzVmlzaWJsZSgpICYmIHRoaXMucGFuZUl0ZW1zW2ldPy5wYW5lLmlzRXhwYW5kZWQoKSkge1xuXHRcdFx0XHRzZWNvbmRQYW5lID0gdGhpcy5wYW5lSXRlbXNbaV0ucGFuZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGZpcnN0UGFuZSAmJiBzZWNvbmRQYW5lKSB7XG5cdFx0XHRjb25zdCBmaXJzdFBhbmVTaXplID0gdGhpcy5nZXRQYW5lU2l6ZShmaXJzdFBhbmUpO1xuXHRcdFx0Y29uc3Qgc2Vjb25kUGFuZVNpemUgPSB0aGlzLmdldFBhbmVTaXplKHNlY29uZFBhbmUpO1xuXG5cdFx0XHQvLyBBdm9pZCByb3VuZGluZyBlcnJvcnMgYW5kIGJlIGNvbnNpc3RlbnQgd2hlbiByZXNpemluZ1xuXHRcdFx0Ly8gVGhlIGZpcnN0IHBhbmUgYWx3YXlzIGdldCBoYWxmIHJvdW5kZWQgdXAgYW5kIHRoZSBzZWNvbmQgaXMgaGFsZiByb3VuZGVkIGRvd25cblx0XHRcdGNvbnN0IG5ld0ZpcnN0UGFuZVNpemUgPSBNYXRoLmNlaWwoKGZpcnN0UGFuZVNpemUgKyBzZWNvbmRQYW5lU2l6ZSkgLyAyKTtcblx0XHRcdGNvbnN0IG5ld1NlY29uZFBhbmVTaXplID0gTWF0aC5mbG9vcigoZmlyc3RQYW5lU2l6ZSArIHNlY29uZFBhbmVTaXplKSAvIDIpO1xuXG5cdFx0XHQvLyBTaHJpbmsgdGhlIGxhcmdlciBwYW5lIGZpcnN0LCB0aGVuIGdyb3cgdGhlIHNtYWxsZXIgcGFuZVxuXHRcdFx0Ly8gVGhpcyBwcmV2ZW50cyBpbnRlcmZlcmluZyB3aXRoIG90aGVyIHZpZXcgc2l6ZXNcblx0XHRcdGlmIChmaXJzdFBhbmVTaXplID4gc2Vjb25kUGFuZVNpemUpIHtcblx0XHRcdFx0dGhpcy5yZXNpemVQYW5lKGZpcnN0UGFuZSwgbmV3Rmlyc3RQYW5lU2l6ZSk7XG5cdFx0XHRcdHRoaXMucmVzaXplUGFuZShzZWNvbmRQYW5lLCBuZXdTZWNvbmRQYW5lU2l6ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnJlc2l6ZVBhbmUoc2Vjb25kUGFuZSwgbmV3U2Vjb25kUGFuZVNpemUpO1xuXHRcdFx0XHR0aGlzLnJlc2l6ZVBhbmUoZmlyc3RQYW5lLCBuZXdGaXJzdFBhbmVTaXplKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLnBhbmVJdGVtcy5mb3JFYWNoKGkgPT4gaS5kaXNwb3NhYmxlLmRpc3Bvc2UoKSk7XG5cdFx0aWYgKHRoaXMucGFuZXZpZXcpIHtcblx0XHRcdHRoaXMucGFuZXZpZXcuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgVmlld1BhbmVDb250YWluZXJBY3Rpb248VCBleHRlbmRzIElWaWV3UGFuZUNvbnRhaW5lcj4gZXh0ZW5kcyBBY3Rpb24yIHtcblx0b3ZlcnJpZGUgcmVhZG9ubHkgZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPiAmIHsgdmlld1BhbmVDb250YWluZXJJZDogc3RyaW5nIH07XG5cdGNvbnN0cnVjdG9yKGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4gJiB7IHZpZXdQYW5lQ29udGFpbmVySWQ6IHN0cmluZyB9KSB7XG5cdFx0c3VwZXIoZGVzYyk7XG5cdFx0dGhpcy5kZXNjID0gZGVzYztcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiB1bmtub3duIHtcblx0XHRjb25zdCB2aWV3UGFuZUNvbnRhaW5lciA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKS5nZXRBY3RpdmVWaWV3UGFuZUNvbnRhaW5lcldpdGhJZCh0aGlzLmRlc2Mudmlld1BhbmVDb250YWluZXJJZCk7XG5cdFx0aWYgKHZpZXdQYW5lQ29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5ydW5JblZpZXdQYW5lQ29udGFpbmVyKGFjY2Vzc29yLCA8VD52aWV3UGFuZUNvbnRhaW5lciwgLi4uYXJncyk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhYnN0cmFjdCBydW5JblZpZXdQYW5lQ29udGFpbmVyKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB2aWV3UGFuZUNvbnRhaW5lcjogVCwgLi4uYXJnczogYW55W10pOiB1bmtub3duO1xufVxuXG5jbGFzcyBNb3ZlVmlld1Bvc2l0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4sIHByaXZhdGUgcmVhZG9ubHkgb2Zmc2V0OiBudW1iZXIpIHtcblx0XHRzdXBlcihkZXNjKTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgdmlld0lkID0gRm9jdXNlZFZpZXdDb250ZXh0LmdldFZhbHVlKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpZiAodmlld0lkID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeVZpZXdJZCh2aWV3SWQpITtcblx0XHRjb25zdCBtb2RlbCA9IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lcik7XG5cblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvciA9IG1vZGVsLnZpc2libGVWaWV3RGVzY3JpcHRvcnMuZmluZCh2ZCA9PiB2ZC5pZCA9PT0gdmlld0lkKSE7XG5cdFx0Y29uc3QgY3VycmVudEluZGV4ID0gbW9kZWwudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5pbmRleE9mKHZpZXdEZXNjcmlwdG9yKTtcblx0XHRpZiAoY3VycmVudEluZGV4ICsgdGhpcy5vZmZzZXQgPCAwIHx8IGN1cnJlbnRJbmRleCArIHRoaXMub2Zmc2V0ID49IG1vZGVsLnZpc2libGVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3UG9zaXRpb24gPSBtb2RlbC52aXNpYmxlVmlld0Rlc2NyaXB0b3JzW2N1cnJlbnRJbmRleCArIHRoaXMub2Zmc2V0XTtcblxuXHRcdG1vZGVsLm1vdmUodmlld0Rlc2NyaXB0b3IuaWQsIG5ld1Bvc2l0aW9uLmlkKTtcblx0fVxufVxuXG5yZWdpc3RlckFjdGlvbjIoXG5cdGNsYXNzIE1vdmVWaWV3VXAgZXh0ZW5kcyBNb3ZlVmlld1Bvc2l0aW9uIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd2aWV3cy5tb3ZlVmlld1VwJyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgndmlld01vdmVVcCcsIFwiTW92ZSBWaWV3IFVwXCIpLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgKyBLZXlDb2RlLktleUssIEtleUNvZGUuVXBBcnJvdyksXG5cdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxLFxuXHRcdFx0XHRcdHdoZW46IEZvY3VzZWRWaWV3Q29udGV4dC5ub3RFcXVhbHNUbygnJylcblx0XHRcdFx0fVxuXHRcdFx0fSwgLTEpO1xuXHRcdH1cblx0fVxuKTtcblxucmVnaXN0ZXJBY3Rpb24yKFxuXHRjbGFzcyBNb3ZlVmlld0xlZnQgZXh0ZW5kcyBNb3ZlVmlld1Bvc2l0aW9uIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd2aWV3cy5tb3ZlVmlld0xlZnQnLFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCd2aWV3TW92ZUxlZnQnLCBcIk1vdmUgVmlldyBMZWZ0XCIpLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgKyBLZXlDb2RlLktleUssIEtleUNvZGUuTGVmdEFycm93KSxcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEsXG5cdFx0XHRcdFx0d2hlbjogRm9jdXNlZFZpZXdDb250ZXh0Lm5vdEVxdWFsc1RvKCcnKVxuXHRcdFx0XHR9XG5cdFx0XHR9LCAtMSk7XG5cdFx0fVxuXHR9XG4pO1xuXG5yZWdpc3RlckFjdGlvbjIoXG5cdGNsYXNzIE1vdmVWaWV3RG93biBleHRlbmRzIE1vdmVWaWV3UG9zaXRpb24ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3ZpZXdzLm1vdmVWaWV3RG93bicsXG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3ZpZXdNb3ZlRG93bicsIFwiTW92ZSBWaWV3IERvd25cIiksXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCArIEtleUNvZGUuS2V5SywgS2V5Q29kZS5Eb3duQXJyb3cpLFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMSxcblx0XHRcdFx0XHR3aGVuOiBGb2N1c2VkVmlld0NvbnRleHQubm90RXF1YWxzVG8oJycpXG5cdFx0XHRcdH1cblx0XHRcdH0sIDEpO1xuXHRcdH1cblx0fVxuKTtcblxucmVnaXN0ZXJBY3Rpb24yKFxuXHRjbGFzcyBNb3ZlVmlld1JpZ2h0IGV4dGVuZHMgTW92ZVZpZXdQb3NpdGlvbiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAndmlld3MubW92ZVZpZXdSaWdodCcsXG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3ZpZXdNb3ZlUmlnaHQnLCBcIk1vdmUgVmlldyBSaWdodFwiKSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kICsgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLlJpZ2h0QXJyb3cpLFxuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMSxcblx0XHRcdFx0XHR3aGVuOiBGb2N1c2VkVmlld0NvbnRleHQubm90RXF1YWxzVG8oJycpXG5cdFx0XHRcdH1cblx0XHRcdH0sIDEpO1xuXHRcdH1cblx0fVxuKTtcblxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgTW92ZVZpZXdzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAndnNjb2RlLm1vdmVWaWV3cycsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCd2aWV3c01vdmUnLCBcIk1vdmUgVmlld3NcIiksXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG9wdGlvbnM6IHsgdmlld0lkczogc3RyaW5nW107IGRlc3RpbmF0aW9uSWQ6IHN0cmluZyB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KG9wdGlvbnM/LnZpZXdJZHMpIHx8IHR5cGVvZiBvcHRpb25zPy5kZXN0aW5hdGlvbklkICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KCdJbnZhbGlkIGFyZ3VtZW50cycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGRlc3RpbmF0aW9uID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKG9wdGlvbnMuZGVzdGluYXRpb25JZCk7XG5cdFx0aWYgKCFkZXN0aW5hdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEZZSSwgZG9uJ3QgdXNlIGBtb3ZlVmlld3NUb0NvbnRhaW5lcmAgaW4gMSBzaG90LCBiZWNhdXNlIGl0IGV4cGVjdHMgYWxsIHZpZXdzIHRvIGhhdmUgdGhlIHNhbWUgY3VycmVudCBsb2NhdGlvblxuXHRcdGZvciAoY29uc3Qgdmlld0lkIG9mIG9wdGlvbnMudmlld0lkcykge1xuXHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3IgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKHZpZXdJZCk7XG5cdFx0XHRpZiAodmlld0Rlc2NyaXB0b3I/LmNhbk1vdmVWaWV3KSB7XG5cdFx0XHRcdHZpZXdEZXNjcmlwdG9yU2VydmljZS5tb3ZlVmlld3NUb0NvbnRhaW5lcihbdmlld0Rlc2NyaXB0b3JdLCBkZXN0aW5hdGlvbiwgVmlld1Zpc2liaWxpdHlTdGF0ZS5EZWZhdWx0LCB0aGlzLmRlc2MuaWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGF3YWl0IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKS5vcGVuVmlld0NvbnRhaW5lcihkZXN0aW5hdGlvbi5pZCwgdHJ1ZSk7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLEdBQUcsdUJBQWtDLHFCQUFxQixXQUFXLFdBQVcsa0JBQWtCO0FBQzNHLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsYUFBYSxnQkFBZ0IsZUFBZTtBQUVyRCxTQUEwQixtQkFBbUI7QUFDN0MsU0FBMkIsZ0JBQWdCO0FBRTNDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsVUFBVSxTQUFTLGNBQWM7QUFDMUMsU0FBUyxvQkFBb0IsaUJBQThCLG9CQUFvQjtBQUMvRSxTQUFTLHVCQUF1QjtBQUNoQyxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsU0FBMEIsY0FBNEIsUUFBUSxjQUFjLHVCQUF1QjtBQUM1RyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDZCQUErQztBQUN4RCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHNCQUFzQixxQkFBcUI7QUFDcEQsU0FBUyxlQUFlLGdCQUFnQjtBQUN4QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDhCQUE4Qix3QkFBd0I7QUFHL0QsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxzQkFB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
