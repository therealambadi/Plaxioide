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
import "./media/paneCompositePart.css";
import { Event } from "../../../base/common/event.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { Extensions } from "../panecomposite.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../common/views.js";
import { DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { IWorkbenchLayoutService, Parts } from "../../services/layout/browser/layoutService.js";
import { CompositePart } from "./compositePart.js";
import { PaneCompositeBar } from "./paneCompositeBar.js";
import { Dimension, EventHelper, trackFocus, $, addDisposableListener, EventType, prepend, getWindow } from "../../../base/browser/dom.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { INotificationService } from "../../../platform/notification/common/notification.js";
import { IStorageService } from "../../../platform/storage/common/storage.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { localize } from "../../../nls.js";
import { CompositeDragAndDropObserver, toggleDropEffect } from "../dnd.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from "../../common/theme.js";
import { CompositeMenuActions } from "../actions.js";
import { IMenuService, MenuId } from "../../../platform/actions/common/actions.js";
import { ActionsOrientation, prepareActions } from "../../../base/browser/ui/actionbar/actionbar.js";
import { Gesture, EventType as GestureEventType } from "../../../base/browser/touch.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { SubmenuAction } from "../../../base/common/actions.js";
import { ViewsSubMenu } from "./views/viewPaneContainer.js";
import { getActionBarActions } from "../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { HiddenItemStrategy, WorkbenchToolBar } from "../../../platform/actions/browser/toolbar.js";
var CompositeBarPosition = /* @__PURE__ */ ((CompositeBarPosition2) => {
  CompositeBarPosition2[CompositeBarPosition2["TOP"] = 0] = "TOP";
  CompositeBarPosition2[CompositeBarPosition2["TITLE"] = 1] = "TITLE";
  CompositeBarPosition2[CompositeBarPosition2["BOTTOM"] = 2] = "BOTTOM";
  return CompositeBarPosition2;
})(CompositeBarPosition || {});
let AbstractPaneCompositePart = class extends CompositePart {
  constructor(partId, partOptions, activePaneCompositeSettingsKey, activePaneContextKey, paneFocusContextKey, nameForTelemetry, compositeCSSClass, titleForegroundColor, titleBorderColor, notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, viewDescriptorService, contextKeyService, extensionService, menuService) {
    let location = ViewContainerLocation.Sidebar;
    let registryId = Extensions.Viewlets;
    let globalActionsMenuId = MenuId.SidebarTitle;
    if (partId === Parts.PANEL_PART) {
      location = ViewContainerLocation.Panel;
      registryId = Extensions.Panels;
      globalActionsMenuId = MenuId.PanelTitle;
    } else if (partId === Parts.AUXILIARYBAR_PART) {
      location = ViewContainerLocation.AuxiliaryBar;
      registryId = Extensions.Auxiliary;
      globalActionsMenuId = MenuId.AuxiliaryBarTitle;
    }
    super(
      notificationService,
      storageService,
      contextMenuService,
      layoutService,
      keybindingService,
      hoverService,
      instantiationService,
      themeService,
      Registry.as(registryId),
      activePaneCompositeSettingsKey,
      viewDescriptorService.getDefaultViewContainer(location)?.id || "",
      nameForTelemetry,
      compositeCSSClass,
      titleForegroundColor,
      titleBorderColor,
      partId,
      partOptions
    );
    this.partId = partId;
    this.activePaneContextKey = activePaneContextKey;
    this.paneFocusContextKey = paneFocusContextKey;
    this.viewDescriptorService = viewDescriptorService;
    this.contextKeyService = contextKeyService;
    this.extensionService = extensionService;
    this.menuService = menuService;
    this.onDidPaneCompositeClose = this.onDidCompositeClose.event;
    this.headerFooterCompositeBarDispoables = this._register(new DisposableStore());
    this.paneCompositeBar = this._register(new MutableDisposable());
    this.compositeBarPosition = void 0;
    this.blockOpening = false;
    this.location = location;
    this.globalActions = this._register(this.instantiationService.createInstance(CompositeMenuActions, globalActionsMenuId, void 0, void 0));
    this.registerListeners();
  }
  get snap() {
    return this.layoutService.isVisible(this.partId) || !!this.paneCompositeBar.value?.getVisiblePaneCompositeIds().length;
  }
  get onDidPaneCompositeOpen() {
    return Event.map(this.onDidCompositeOpen.event, (compositeEvent) => compositeEvent.composite);
  }
  registerListeners() {
    this._register(this.onDidPaneCompositeOpen((composite) => this.onDidOpen(composite)));
    this._register(this.onDidPaneCompositeClose(this.onDidClose, this));
    this._register(this.globalActions.onDidChange(() => this.updateGlobalToolbarActions()));
    this._register(this.registry.onDidDeregister((viewletDescriptor) => {
      const activeContainers = this.viewDescriptorService.getViewContainersByLocation(this.location).filter((container) => this.viewDescriptorService.getViewContainerModel(container).activeViewDescriptors.length > 0);
      if (activeContainers.length) {
        if (this.getActiveComposite()?.getId() === viewletDescriptor.id) {
          const defaultViewletId = this.viewDescriptorService.getDefaultViewContainer(this.location)?.id;
          const containerToOpen = activeContainers.filter((c) => c.id === defaultViewletId)[0] || activeContainers[0];
          this.doOpenPaneComposite(containerToOpen.id);
        }
      } else {
        this.layoutService.setPartHidden(true, this.partId);
      }
      this.removeComposite(viewletDescriptor.id);
    }));
    this._register(this.extensionService.onDidRegisterExtensions(() => {
      this.layoutCompositeBar();
    }));
  }
  onDidOpen(composite) {
    this.activePaneContextKey.set(composite.getId());
  }
  onDidClose(composite) {
    const id = composite.getId();
    if (this.activePaneContextKey.get() === id) {
      this.activePaneContextKey.reset();
    }
  }
  showComposite(composite) {
    super.showComposite(composite);
    this.layoutCompositeBar();
    this.layoutEmptyMessage();
  }
  hideActiveComposite() {
    const composite = super.hideActiveComposite();
    this.layoutCompositeBar();
    this.layoutEmptyMessage();
    return composite;
  }
  create(parent) {
    this.element = parent;
    this.element.classList.add("pane-composite-part");
    super.create(parent);
    const contentArea = this.getContentArea();
    if (contentArea) {
      this.createEmptyPaneMessage(contentArea);
    }
    this.updateCompositeBar();
    const focusTracker = this._register(trackFocus(parent));
    this._register(focusTracker.onDidFocus(() => this.paneFocusContextKey.set(true)));
    this._register(focusTracker.onDidBlur(() => this.paneFocusContextKey.set(false)));
  }
  createEmptyPaneMessage(parent) {
    this.emptyPaneMessageElement = $(".empty-pane-message-area");
    const messageElement = $(".empty-pane-message");
    messageElement.innerText = localize("pane.emptyMessage", "Drag a view here to display.");
    this.emptyPaneMessageElement.appendChild(messageElement);
    parent.appendChild(this.emptyPaneMessageElement);
    const setDropBackgroundFeedback = (visible) => {
      const updateActivityBarBackground = !this.getActiveComposite() || !visible;
      const backgroundColor = visible ? this.theme.getColor(EDITOR_DRAG_AND_DROP_BACKGROUND)?.toString() || "" : "";
      if (this.titleContainer && updateActivityBarBackground) {
        this.titleContainer.style.backgroundColor = backgroundColor;
      }
      if (this.headerFooterCompositeBarContainer && updateActivityBarBackground) {
        this.headerFooterCompositeBarContainer.style.backgroundColor = backgroundColor;
      }
      this.emptyPaneMessageElement.style.backgroundColor = backgroundColor;
    };
    this._register(CompositeDragAndDropObserver.INSTANCE.registerTarget(this.element, {
      onDragOver: (e) => {
        EventHelper.stop(e.eventData, true);
        if (this.paneCompositeBar.value) {
          const validDropTarget = this.paneCompositeBar.value.dndHandler.onDragEnter(e.dragAndDropData, void 0, e.eventData);
          toggleDropEffect(e.eventData.dataTransfer, "move", validDropTarget);
        }
      },
      onDragEnter: (e) => {
        EventHelper.stop(e.eventData, true);
        if (this.paneCompositeBar.value) {
          const validDropTarget = this.paneCompositeBar.value.dndHandler.onDragEnter(e.dragAndDropData, void 0, e.eventData);
          setDropBackgroundFeedback(validDropTarget);
        }
      },
      onDragLeave: (e) => {
        EventHelper.stop(e.eventData, true);
        setDropBackgroundFeedback(false);
      },
      onDragEnd: (e) => {
        EventHelper.stop(e.eventData, true);
        setDropBackgroundFeedback(false);
      },
      onDrop: (e) => {
        EventHelper.stop(e.eventData, true);
        setDropBackgroundFeedback(false);
        if (this.paneCompositeBar.value) {
          this.paneCompositeBar.value.dndHandler.drop(e.dragAndDropData, void 0, e.eventData);
        } else {
          const dragData = e.dragAndDropData.getData();
          if (dragData.type === "composite") {
            const currentContainer = this.viewDescriptorService.getViewContainerById(dragData.id);
            this.viewDescriptorService.moveViewContainerToLocation(currentContainer, this.location, void 0, "dnd");
            this.openPaneComposite(currentContainer.id, true);
          } else if (dragData.type === "view") {
            const viewToMove = this.viewDescriptorService.getViewDescriptorById(dragData.id);
            if (viewToMove && viewToMove.canMoveView) {
              this.viewDescriptorService.moveViewToLocation(viewToMove, this.location, "dnd");
              const newContainer = this.viewDescriptorService.getViewContainerByViewId(viewToMove.id);
              this.openPaneComposite(newContainer.id, true).then((composite) => {
                composite?.openView(viewToMove.id, true);
              });
            }
          }
        }
      }
    }));
  }
  createTitleArea(parent) {
    const titleArea = super.createTitleArea(parent);
    this._register(addDisposableListener(titleArea, EventType.CONTEXT_MENU, (e) => {
      this.onTitleAreaContextMenu(new StandardMouseEvent(getWindow(titleArea), e));
    }));
    this._register(Gesture.addTarget(titleArea));
    this._register(addDisposableListener(titleArea, GestureEventType.Contextmenu, (e) => {
      this.onTitleAreaContextMenu(new StandardMouseEvent(getWindow(titleArea), e));
    }));
    const globalTitleActionsContainer = titleArea.appendChild($(".global-actions"));
    this.globalToolBar = this._register(this.instantiationService.createInstance(WorkbenchToolBar, globalTitleActionsContainer, {
      actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
      orientation: ActionsOrientation.HORIZONTAL,
      getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id),
      anchorAlignmentProvider: () => this.getTitleAreaDropDownAnchorAlignment(),
      toggleMenuTitle: localize("moreActions", "More Actions..."),
      hoverDelegate: this.toolbarHoverDelegate,
      hiddenItemStrategy: HiddenItemStrategy.NoHide
    }));
    this.updateGlobalToolbarActions();
    return titleArea;
  }
  createTitleLabel(parent) {
    this.titleContainer = parent;
    const titleLabel = super.createTitleLabel(parent);
    this.titleLabelElement.draggable = true;
    const draggedItemProvider = () => {
      const activeViewlet = this.getActivePaneComposite();
      return { type: "composite", id: activeViewlet.getId() };
    };
    this._register(CompositeDragAndDropObserver.INSTANCE.registerDraggable(this.titleLabelElement, draggedItemProvider, {}));
    return titleLabel;
  }
  updateCompositeBar(updateCompositeBarOption = false) {
    const wasCompositeBarVisible = this.compositeBarPosition !== void 0;
    const isCompositeBarVisible = this.shouldShowCompositeBar();
    const previousPosition = this.compositeBarPosition;
    const newPosition = isCompositeBarVisible ? this.getCompositeBarPosition() : void 0;
    if (!updateCompositeBarOption && previousPosition === newPosition) {
      return;
    }
    if (wasCompositeBarVisible) {
      const previousCompositeBarContainer = previousPosition === 1 /* TITLE */ ? this.titleContainer : this.headerFooterCompositeBarContainer;
      if (!this.paneCompositeBarContainer || !this.paneCompositeBar.value || !previousCompositeBarContainer) {
        throw new Error("Composite bar containers should exist when removing the previous composite bar");
      }
      this.paneCompositeBarContainer.remove();
      this.paneCompositeBarContainer = void 0;
      this.paneCompositeBar.value = void 0;
      previousCompositeBarContainer.classList.remove("has-composite-bar");
      if (previousPosition === 0 /* TOP */) {
        this.removeFooterHeaderArea(true);
      } else if (previousPosition === 2 /* BOTTOM */) {
        this.removeFooterHeaderArea(false);
      }
    }
    let newCompositeBarContainer;
    switch (newPosition) {
      case 0 /* TOP */:
        newCompositeBarContainer = this.createHeaderArea();
        break;
      case 1 /* TITLE */:
        newCompositeBarContainer = this.titleContainer;
        break;
      case 2 /* BOTTOM */:
        newCompositeBarContainer = this.createFooterArea();
        break;
    }
    if (isCompositeBarVisible) {
      if (this.paneCompositeBarContainer || this.paneCompositeBar.value || !newCompositeBarContainer) {
        throw new Error("Invalid composite bar state when creating the new composite bar");
      }
      newCompositeBarContainer.classList.add("has-composite-bar");
      this.paneCompositeBarContainer = prepend(newCompositeBarContainer, $(".composite-bar-container"));
      this.paneCompositeBar.value = this.createCompositeBar();
      this.paneCompositeBar.value.create(this.paneCompositeBarContainer);
      if (newPosition === 0 /* TOP */) {
        this.setHeaderArea(newCompositeBarContainer);
      } else if (newPosition === 2 /* BOTTOM */) {
        this.setFooterArea(newCompositeBarContainer);
      }
    }
    this.compositeBarPosition = newPosition;
    if (updateCompositeBarOption) {
      this.layoutCompositeBar();
    }
  }
  createHeaderArea() {
    const headerArea = super.createHeaderArea();
    return this.createHeaderFooterCompositeBarArea(headerArea);
  }
  createFooterArea() {
    const footerArea = super.createFooterArea();
    return this.createHeaderFooterCompositeBarArea(footerArea);
  }
  createHeaderFooterCompositeBarArea(area) {
    if (this.headerFooterCompositeBarContainer) {
      throw new Error("Header or Footer composite bar already exists");
    }
    this.headerFooterCompositeBarContainer = area;
    this.headerFooterCompositeBarDispoables.add(addDisposableListener(area, EventType.CONTEXT_MENU, (e) => {
      this.onCompositeBarAreaContextMenu(new StandardMouseEvent(getWindow(area), e));
    }));
    this.headerFooterCompositeBarDispoables.add(Gesture.addTarget(area));
    this.headerFooterCompositeBarDispoables.add(addDisposableListener(area, GestureEventType.Contextmenu, (e) => {
      this.onCompositeBarAreaContextMenu(new StandardMouseEvent(getWindow(area), e));
    }));
    return area;
  }
  removeFooterHeaderArea(header) {
    this.headerFooterCompositeBarContainer = void 0;
    this.headerFooterCompositeBarDispoables.clear();
    if (header) {
      this.removeHeaderArea();
    } else {
      this.removeFooterArea();
    }
  }
  createCompositeBar() {
    return this.instantiationService.createInstance(PaneCompositeBar, this.getCompositeBarOptions(), this.partId, this);
  }
  onTitleAreaUpdate(compositeId) {
    super.onTitleAreaUpdate(compositeId);
    this.layoutCompositeBar();
  }
  async openPaneComposite(id, focus) {
    if (typeof id === "string" && this.getPaneComposite(id)) {
      return this.doOpenPaneComposite(id, focus);
    }
    await this.extensionService.whenInstalledExtensionsRegistered();
    if (typeof id === "string" && this.getPaneComposite(id)) {
      return this.doOpenPaneComposite(id, focus);
    }
    return void 0;
  }
  doOpenPaneComposite(id, focus) {
    if (this.blockOpening) {
      return void 0;
    }
    if (!this.layoutService.isVisible(this.partId)) {
      try {
        this.blockOpening = true;
        this.layoutService.setPartHidden(false, this.partId);
      } finally {
        this.blockOpening = false;
      }
    }
    return this.openComposite(id, focus);
  }
  getPaneComposite(id) {
    return this.registry.getPaneComposite(id);
  }
  getPaneComposites() {
    return this.registry.getPaneComposites().sort((v1, v2) => {
      if (typeof v1.order !== "number") {
        return 1;
      }
      if (typeof v2.order !== "number") {
        return -1;
      }
      return v1.order - v2.order;
    });
  }
  getPinnedPaneCompositeIds() {
    return this.paneCompositeBar.value?.getPinnedPaneCompositeIds() ?? [];
  }
  getVisiblePaneCompositeIds() {
    return this.paneCompositeBar.value?.getVisiblePaneCompositeIds() ?? [];
  }
  getPaneCompositeIds() {
    return this.paneCompositeBar.value?.getPaneCompositeIds() ?? [];
  }
  getActivePaneComposite() {
    return this.getActiveComposite();
  }
  getLastActivePaneCompositeId() {
    return this.getLastActiveCompositeId();
  }
  hideActivePaneComposite() {
    if (this.layoutService.isVisible(this.partId)) {
      this.layoutService.setPartHidden(true, this.partId);
    }
    this.hideActiveComposite();
  }
  focusCompositeBar() {
    this.paneCompositeBar.value?.focus();
  }
  layout(width, height, top, left) {
    if (!this.layoutService.isVisible(this.partId)) {
      return;
    }
    this.contentDimension = new Dimension(width, height);
    super.layout(this.contentDimension.width, this.contentDimension.height, top, left);
    this.layoutCompositeBar();
    this.layoutEmptyMessage();
  }
  layoutCompositeBar() {
    if (this.contentDimension && this.dimension && this.paneCompositeBar.value) {
      const padding = this.compositeBarPosition === 1 /* TITLE */ ? 16 : 8;
      const borderWidth = this.partId === Parts.PANEL_PART ? 0 : 1;
      let availableWidth = this.contentDimension.width - padding - borderWidth;
      availableWidth = Math.max(AbstractPaneCompositePart.MIN_COMPOSITE_BAR_WIDTH, availableWidth - this.getToolbarWidth());
      this.paneCompositeBar.value.layout(availableWidth, this.dimension.height);
    }
  }
  layoutEmptyMessage() {
    const visible = !this.getActiveComposite();
    this.element.classList.toggle("empty", visible);
    if (visible) {
      this.titleLabel?.updateTitle("", "");
    }
  }
  updateGlobalToolbarActions() {
    const primaryActions = this.globalActions.getPrimaryActions();
    const secondaryActions = this.globalActions.getSecondaryActions();
    this.globalToolBar?.setActions(prepareActions(primaryActions), prepareActions(secondaryActions));
  }
  getToolbarWidth() {
    if (!this.toolBar || this.compositeBarPosition !== 1 /* TITLE */) {
      return 0;
    }
    const activePane = this.getActivePaneComposite();
    if (!activePane) {
      return 0;
    }
    const toolBarWidth = this.toolBar.getItemsWidth() + this.toolBar.getItemsLength() * 4;
    const globalToolBarWidth = this.globalToolBar ? this.globalToolBar.getItemsWidth() + this.globalToolBar.getItemsLength() * 4 : 0;
    return toolBarWidth + globalToolBarWidth + 5;
  }
  onTitleAreaContextMenu(event) {
    if (this.shouldShowCompositeBar() && this.getCompositeBarPosition() === 1 /* TITLE */) {
      return this.onCompositeBarContextMenu(event);
    } else {
      const activePaneComposite = this.getActivePaneComposite();
      const activePaneCompositeActions = activePaneComposite ? activePaneComposite.getContextMenuActions() : [];
      if (activePaneCompositeActions.length) {
        this.contextMenuService.showContextMenu({
          getAnchor: () => event,
          getActions: () => activePaneCompositeActions,
          getActionViewItem: (action, options) => this.actionViewItemProvider(action, options),
          actionRunner: activePaneComposite.getActionRunner(),
          skipTelemetry: true
        });
      }
    }
  }
  onCompositeBarAreaContextMenu(event) {
    return this.onCompositeBarContextMenu(event);
  }
  onCompositeBarContextMenu(event) {
    if (this.paneCompositeBar.value) {
      const actions = [...this.paneCompositeBar.value.getContextMenuActions()];
      if (actions.length) {
        this.contextMenuService.showContextMenu({
          getAnchor: () => event,
          getActions: () => actions,
          skipTelemetry: true
        });
      }
    }
  }
  getViewsSubmenuAction() {
    const viewPaneContainer = this.getActivePaneComposite()?.getViewPaneContainer();
    if (viewPaneContainer) {
      const disposables = new DisposableStore();
      const scopedContextKeyService = disposables.add(this.contextKeyService.createScoped(this.element));
      scopedContextKeyService.createKey("viewContainer", viewPaneContainer.viewContainer.id);
      const menu = this.menuService.getMenuActions(ViewsSubMenu, scopedContextKeyService, { shouldForwardArgs: true, renderShortTitle: true });
      const viewsActions = getActionBarActions(menu, () => true).primary;
      disposables.dispose();
      return viewsActions.length > 1 && viewsActions.some((a) => a.enabled) ? new SubmenuAction("views", localize("views", "Views"), viewsActions) : void 0;
    }
    return void 0;
  }
};
AbstractPaneCompositePart.MIN_COMPOSITE_BAR_WIDTH = 50;
AbstractPaneCompositePart = __decorateClass([
  __decorateParam(9, INotificationService),
  __decorateParam(10, IStorageService),
  __decorateParam(11, IContextMenuService),
  __decorateParam(12, IWorkbenchLayoutService),
  __decorateParam(13, IKeybindingService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, IInstantiationService),
  __decorateParam(16, IThemeService),
  __decorateParam(17, IViewDescriptorService),
  __decorateParam(18, IContextKeyService),
  __decorateParam(19, IExtensionService),
  __decorateParam(20, IMenuService)
], AbstractPaneCompositePart);
export {
  AbstractPaneCompositePart,
  CompositeBarPosition
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9wYW5lQ29tcG9zaXRlUGFydC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9wYW5lQ29tcG9zaXRlUGFydC5jc3MnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElQcm9ncmVzc0luZGljYXRvciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zLCBQYW5lQ29tcG9zaXRlLCBQYW5lQ29tcG9zaXRlRGVzY3JpcHRvciwgUGFuZUNvbXBvc2l0ZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElWaWV3IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2dyaWQvZ3JpZC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgUGFydHMgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbXBvc2l0ZVBhcnQsIElDb21wb3NpdGVUaXRsZUxhYmVsIH0gZnJvbSAnLi9jb21wb3NpdGVQYXJ0LmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlQmFyT3B0aW9ucywgUGFuZUNvbXBvc2l0ZUJhciB9IGZyb20gJy4vcGFuZUNvbXBvc2l0ZUJhci5qcyc7XG5pbXBvcnQgeyBEaW1lbnNpb24sIEV2ZW50SGVscGVyLCB0cmFja0ZvY3VzLCAkLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIEV2ZW50VHlwZSwgcHJlcGVuZCwgZ2V0V2luZG93IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNvbXBvc2l0ZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb21wb3NpdGUuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29tcG9zaXRlRHJhZ0FuZERyb3BPYnNlcnZlciwgdG9nZ2xlRHJvcEVmZmVjdCB9IGZyb20gJy4uL2RuZC5qcyc7XG5pbXBvcnQgeyBFRElUT1JfRFJBR19BTkRfRFJPUF9CQUNLR1JPVU5EIH0gZnJvbSAnLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElQYXJ0T3B0aW9ucyB9IGZyb20gJy4uL3BhcnQuanMnO1xuaW1wb3J0IHsgQ29tcG9zaXRlTWVudUFjdGlvbnMgfSBmcm9tICcuLi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25zT3JpZW50YXRpb24sIHByZXBhcmVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgR2VzdHVyZSwgRXZlbnRUeXBlIGFzIEdlc3R1cmVFdmVudFR5cGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdG91Y2guanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgSUFjdGlvbiwgU3VibWVudUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tcG9zaXRlIH0gZnJvbSAnLi4vY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IFZpZXdzU3ViTWVudSB9IGZyb20gJy4vdmlld3Mvdmlld1BhbmVDb250YWluZXIuanMnO1xuaW1wb3J0IHsgZ2V0QWN0aW9uQmFyQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBIaWRkZW5JdGVtU3RyYXRlZ3ksIFdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5cbmV4cG9ydCBlbnVtIENvbXBvc2l0ZUJhclBvc2l0aW9uIHtcblx0VE9QLFxuXHRUSVRMRSxcblx0Qk9UVE9NXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBhbmVDb21wb3NpdGVQYXJ0IGV4dGVuZHMgSVZpZXcge1xuXG5cdHJlYWRvbmx5IHBhcnRJZDogUGFydHMuUEFORUxfUEFSVCB8IFBhcnRzLkFVWElMSUFSWUJBUl9QQVJUIHwgUGFydHMuU0lERUJBUl9QQVJUO1xuXG5cdHJlYWRvbmx5IG9uRGlkUGFuZUNvbXBvc2l0ZU9wZW46IEV2ZW50PElQYW5lQ29tcG9zaXRlPjtcblx0cmVhZG9ubHkgb25EaWRQYW5lQ29tcG9zaXRlQ2xvc2U6IEV2ZW50PElQYW5lQ29tcG9zaXRlPjtcblxuXHQvKipcblx0ICogT3BlbnMgYSB2aWV3bGV0IHdpdGggdGhlIGdpdmVuIGlkZW50aWZpZXIgYW5kIHBhc3Mga2V5Ym9hcmQgZm9jdXMgdG8gaXQgaWYgc3BlY2lmaWVkLlxuXHQgKi9cblx0b3BlblBhbmVDb21wb3NpdGUoaWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgZm9jdXM/OiBib29sZWFuKTogUHJvbWlzZTxJUGFuZUNvbXBvc2l0ZSB8IHVuZGVmaW5lZD47XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGN1cnJlbnQgYWN0aXZlIHZpZXdsZXQgaWYgYW55LlxuXHQgKi9cblx0Z2V0QWN0aXZlUGFuZUNvbXBvc2l0ZSgpOiBJUGFuZUNvbXBvc2l0ZSB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgdmlld2xldCBieSBpZC5cblx0ICovXG5cdGdldFBhbmVDb21wb3NpdGUoaWQ6IHN0cmluZyk6IFBhbmVDb21wb3NpdGVEZXNjcmlwdG9yIHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGFsbCBlbmFibGVkIHZpZXdsZXRzXG5cdCAqL1xuXHRnZXRQYW5lQ29tcG9zaXRlcygpOiBQYW5lQ29tcG9zaXRlRGVzY3JpcHRvcltdO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBwcm9ncmVzcyBpbmRpY2F0b3IgZm9yIHRoZSBzaWRlIGJhci5cblx0ICovXG5cdGdldFByb2dyZXNzSW5kaWNhdG9yKGlkOiBzdHJpbmcpOiBJUHJvZ3Jlc3NJbmRpY2F0b3IgfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIEhpZGUgdGhlIGFjdGl2ZSB2aWV3bGV0LlxuXHQgKi9cblx0aGlkZUFjdGl2ZVBhbmVDb21wb3NpdGUoKTogdm9pZDtcblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBsYXN0IGFjdGl2ZSB2aWV3bGV0IGlkLlxuXHQgKi9cblx0Z2V0TGFzdEFjdGl2ZVBhbmVDb21wb3NpdGVJZCgpOiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFJldHVybnMgaWQgb2YgcGlubmVkIHZpZXcgY29udGFpbmVycyBmb2xsb3dpbmcgdGhlIHZpc3VhbCBvcmRlci5cblx0ICovXG5cdGdldFBpbm5lZFBhbmVDb21wb3NpdGVJZHMoKTogc3RyaW5nW107XG5cblx0LyoqXG5cdCAqIFJldHVybnMgaWQgb2YgdmlzaWJsZSB2aWV3IGNvbnRhaW5lcnMgZm9sbG93aW5nIHRoZSB2aXN1YWwgb3JkZXIuXG5cdCAqL1xuXHRnZXRWaXNpYmxlUGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXTtcblxuXHQvKipcblx0ICogUmV0dXJucyBpZCBvZiBhbGwgdmlldyBjb250YWluZXJzIGZvbGxvd2luZyB0aGUgdmlzdWFsIG9yZGVyLlxuXHQgKi9cblx0Z2V0UGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0UGFuZUNvbXBvc2l0ZVBhcnQgZXh0ZW5kcyBDb21wb3NpdGVQYXJ0PFBhbmVDb21wb3NpdGU+IGltcGxlbWVudHMgSVBhbmVDb21wb3NpdGVQYXJ0IHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNSU5fQ09NUE9TSVRFX0JBUl9XSURUSCA9IDUwO1xuXG5cdGdldCBzbmFwKCk6IGJvb2xlYW4ge1xuXHRcdC8vIEFsd2F5cyBhbGxvdyBzbmFwcGluZyBjbG9zZWRcblx0XHQvLyBPbmx5IGFsbG93IGRyYWdnaW5nIG9wZW4gaWYgdGhlIHBhbmVsIGNvbnRhaW5zIHZpZXcgY29udGFpbmVyc1xuXHRcdHJldHVybiB0aGlzLmxheW91dFNlcnZpY2UuaXNWaXNpYmxlKHRoaXMucGFydElkKSB8fCAhIXRoaXMucGFuZUNvbXBvc2l0ZUJhci52YWx1ZT8uZ2V0VmlzaWJsZVBhbmVDb21wb3NpdGVJZHMoKS5sZW5ndGg7XG5cdH1cblxuXHRnZXQgb25EaWRQYW5lQ29tcG9zaXRlT3BlbigpOiBFdmVudDxJUGFuZUNvbXBvc2l0ZT4geyByZXR1cm4gRXZlbnQubWFwKHRoaXMub25EaWRDb21wb3NpdGVPcGVuLmV2ZW50LCBjb21wb3NpdGVFdmVudCA9PiA8SVBhbmVDb21wb3NpdGU+Y29tcG9zaXRlRXZlbnQuY29tcG9zaXRlKTsgfVxuXHRyZWFkb25seSBvbkRpZFBhbmVDb21wb3NpdGVDbG9zZSA9IHRoaXMub25EaWRDb21wb3NpdGVDbG9zZS5ldmVudCBhcyBFdmVudDxJUGFuZUNvbXBvc2l0ZT47XG5cblx0cHJpdmF0ZSByZWFkb25seSBsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uO1xuXHRwcml2YXRlIHRpdGxlQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBoZWFkZXJGb290ZXJDb21wb3NpdGVCYXJDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgaGVhZGVyRm9vdGVyQ29tcG9zaXRlQmFyRGlzcG9hYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcGFuZUNvbXBvc2l0ZUJhckNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgcGFuZUNvbXBvc2l0ZUJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxQYW5lQ29tcG9zaXRlQmFyPigpKTtcblx0cHJpdmF0ZSBjb21wb3NpdGVCYXJQb3NpdGlvbjogQ29tcG9zaXRlQmFyUG9zaXRpb24gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZW1wdHlQYW5lTWVzc2FnZUVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgZ2xvYmFsVG9vbEJhcjogV29ya2JlbmNoVG9vbEJhciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBnbG9iYWxBY3Rpb25zOiBDb21wb3NpdGVNZW51QWN0aW9ucztcblxuXHRwcml2YXRlIGJsb2NrT3BlbmluZyA9IGZhbHNlO1xuXHRwcm90ZWN0ZWQgY29udGVudERpbWVuc2lvbjogRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHBhcnRJZDogUGFydHMuUEFORUxfUEFSVCB8IFBhcnRzLkFVWElMSUFSWUJBUl9QQVJUIHwgUGFydHMuU0lERUJBUl9QQVJULFxuXHRcdHBhcnRPcHRpb25zOiBJUGFydE9wdGlvbnMsXG5cdFx0YWN0aXZlUGFuZUNvbXBvc2l0ZVNldHRpbmdzS2V5OiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBhY3RpdmVQYW5lQ29udGV4dEtleTogSUNvbnRleHRLZXk8c3RyaW5nPixcblx0XHRwcml2YXRlIHBhbmVGb2N1c0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+LFxuXHRcdG5hbWVGb3JUZWxlbWV0cnk6IHN0cmluZyxcblx0XHRjb21wb3NpdGVDU1NDbGFzczogc3RyaW5nLFxuXHRcdHRpdGxlRm9yZWdyb3VuZENvbG9yOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0dGl0bGVCb3JkZXJDb2xvcjogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHQpIHtcblx0XHRsZXQgbG9jYXRpb24gPSBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcjtcblx0XHRsZXQgcmVnaXN0cnlJZCA9IEV4dGVuc2lvbnMuVmlld2xldHM7XG5cdFx0bGV0IGdsb2JhbEFjdGlvbnNNZW51SWQgPSBNZW51SWQuU2lkZWJhclRpdGxlO1xuXHRcdGlmIChwYXJ0SWQgPT09IFBhcnRzLlBBTkVMX1BBUlQpIHtcblx0XHRcdGxvY2F0aW9uID0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsO1xuXHRcdFx0cmVnaXN0cnlJZCA9IEV4dGVuc2lvbnMuUGFuZWxzO1xuXHRcdFx0Z2xvYmFsQWN0aW9uc01lbnVJZCA9IE1lbnVJZC5QYW5lbFRpdGxlO1xuXHRcdH0gZWxzZSBpZiAocGFydElkID09PSBQYXJ0cy5BVVhJTElBUllCQVJfUEFSVCkge1xuXHRcdFx0bG9jYXRpb24gPSBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyO1xuXHRcdFx0cmVnaXN0cnlJZCA9IEV4dGVuc2lvbnMuQXV4aWxpYXJ5O1xuXHRcdFx0Z2xvYmFsQWN0aW9uc01lbnVJZCA9IE1lbnVJZC5BdXhpbGlhcnlCYXJUaXRsZTtcblx0XHR9XG5cdFx0c3VwZXIoXG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdFx0c3RvcmFnZVNlcnZpY2UsXG5cdFx0XHRjb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0XHRsYXlvdXRTZXJ2aWNlLFxuXHRcdFx0a2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0XHRob3ZlclNlcnZpY2UsXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdHRoZW1lU2VydmljZSxcblx0XHRcdFJlZ2lzdHJ5LmFzPFBhbmVDb21wb3NpdGVSZWdpc3RyeT4ocmVnaXN0cnlJZCksXG5cdFx0XHRhY3RpdmVQYW5lQ29tcG9zaXRlU2V0dGluZ3NLZXksXG5cdFx0XHR2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIobG9jYXRpb24pPy5pZCB8fCAnJyxcblx0XHRcdG5hbWVGb3JUZWxlbWV0cnksXG5cdFx0XHRjb21wb3NpdGVDU1NDbGFzcyxcblx0XHRcdHRpdGxlRm9yZWdyb3VuZENvbG9yLFxuXHRcdFx0dGl0bGVCb3JkZXJDb2xvcixcblx0XHRcdHBhcnRJZCxcblx0XHRcdHBhcnRPcHRpb25zXG5cdFx0KTtcblxuXHRcdHRoaXMubG9jYXRpb24gPSBsb2NhdGlvbjtcblx0XHR0aGlzLmdsb2JhbEFjdGlvbnMgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbXBvc2l0ZU1lbnVBY3Rpb25zLCBnbG9iYWxBY3Rpb25zTWVudUlkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCkpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkUGFuZUNvbXBvc2l0ZU9wZW4oY29tcG9zaXRlID0+IHRoaXMub25EaWRPcGVuKGNvbXBvc2l0ZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkUGFuZUNvbXBvc2l0ZUNsb3NlKHRoaXMub25EaWRDbG9zZSwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZ2xvYmFsQWN0aW9ucy5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnVwZGF0ZUdsb2JhbFRvb2xiYXJBY3Rpb25zKCkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVnaXN0cnkub25EaWREZXJlZ2lzdGVyKCh2aWV3bGV0RGVzY3JpcHRvcjogUGFuZUNvbXBvc2l0ZURlc2NyaXB0b3IpID0+IHtcblxuXHRcdFx0Y29uc3QgYWN0aXZlQ29udGFpbmVycyA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJzQnlMb2NhdGlvbih0aGlzLmxvY2F0aW9uKVxuXHRcdFx0XHQuZmlsdGVyKGNvbnRhaW5lciA9PiB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKS5hY3RpdmVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoID4gMCk7XG5cblx0XHRcdGlmIChhY3RpdmVDb250YWluZXJzLmxlbmd0aCkge1xuXHRcdFx0XHRpZiAodGhpcy5nZXRBY3RpdmVDb21wb3NpdGUoKT8uZ2V0SWQoKSA9PT0gdmlld2xldERlc2NyaXB0b3IuaWQpIHtcblx0XHRcdFx0XHRjb25zdCBkZWZhdWx0Vmlld2xldElkID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0RGVmYXVsdFZpZXdDb250YWluZXIodGhpcy5sb2NhdGlvbik/LmlkO1xuXHRcdFx0XHRcdGNvbnN0IGNvbnRhaW5lclRvT3BlbiA9IGFjdGl2ZUNvbnRhaW5lcnMuZmlsdGVyKGMgPT4gYy5pZCA9PT0gZGVmYXVsdFZpZXdsZXRJZClbMF0gfHwgYWN0aXZlQ29udGFpbmVyc1swXTtcblx0XHRcdFx0XHR0aGlzLmRvT3BlblBhbmVDb21wb3NpdGUoY29udGFpbmVyVG9PcGVuLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5sYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4odHJ1ZSwgdGhpcy5wYXJ0SWQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnJlbW92ZUNvbXBvc2l0ZSh2aWV3bGV0RGVzY3JpcHRvci5pZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25TZXJ2aWNlLm9uRGlkUmVnaXN0ZXJFeHRlbnNpb25zKCgpID0+IHtcblx0XHRcdHRoaXMubGF5b3V0Q29tcG9zaXRlQmFyKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZE9wZW4oY29tcG9zaXRlOiBJQ29tcG9zaXRlKTogdm9pZCB7XG5cdFx0dGhpcy5hY3RpdmVQYW5lQ29udGV4dEtleS5zZXQoY29tcG9zaXRlLmdldElkKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENsb3NlKGNvbXBvc2l0ZTogSUNvbXBvc2l0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IGlkID0gY29tcG9zaXRlLmdldElkKCk7XG5cdFx0aWYgKHRoaXMuYWN0aXZlUGFuZUNvbnRleHRLZXkuZ2V0KCkgPT09IGlkKSB7XG5cdFx0XHR0aGlzLmFjdGl2ZVBhbmVDb250ZXh0S2V5LnJlc2V0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNob3dDb21wb3NpdGUoY29tcG9zaXRlOiBDb21wb3NpdGUpOiB2b2lkIHtcblx0XHRzdXBlci5zaG93Q29tcG9zaXRlKGNvbXBvc2l0ZSk7XG5cdFx0dGhpcy5sYXlvdXRDb21wb3NpdGVCYXIoKTtcblx0XHR0aGlzLmxheW91dEVtcHR5TWVzc2FnZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGhpZGVBY3RpdmVDb21wb3NpdGUoKTogQ29tcG9zaXRlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBjb21wb3NpdGUgPSBzdXBlci5oaWRlQWN0aXZlQ29tcG9zaXRlKCk7XG5cdFx0dGhpcy5sYXlvdXRDb21wb3NpdGVCYXIoKTtcblx0XHR0aGlzLmxheW91dEVtcHR5TWVzc2FnZSgpO1xuXHRcdHJldHVybiBjb21wb3NpdGU7XG5cdH1cblxuXHRvdmVycmlkZSBjcmVhdGUocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuZWxlbWVudCA9IHBhcmVudDtcblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgncGFuZS1jb21wb3NpdGUtcGFydCcpO1xuXG5cdFx0c3VwZXIuY3JlYXRlKHBhcmVudCk7XG5cblx0XHRjb25zdCBjb250ZW50QXJlYSA9IHRoaXMuZ2V0Q29udGVudEFyZWEoKTtcblx0XHRpZiAoY29udGVudEFyZWEpIHtcblx0XHRcdHRoaXMuY3JlYXRlRW1wdHlQYW5lTWVzc2FnZShjb250ZW50QXJlYSk7XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVDb21wb3NpdGVCYXIoKTtcblxuXHRcdGNvbnN0IGZvY3VzVHJhY2tlciA9IHRoaXMuX3JlZ2lzdGVyKHRyYWNrRm9jdXMocGFyZW50KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZm9jdXNUcmFja2VyLm9uRGlkRm9jdXMoKCkgPT4gdGhpcy5wYW5lRm9jdXNDb250ZXh0S2V5LnNldCh0cnVlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4gdGhpcy5wYW5lRm9jdXNDb250ZXh0S2V5LnNldChmYWxzZSkpKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRW1wdHlQYW5lTWVzc2FnZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5lbXB0eVBhbmVNZXNzYWdlRWxlbWVudCA9ICQoJy5lbXB0eS1wYW5lLW1lc3NhZ2UtYXJlYScpO1xuXG5cdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnQgPSAkKCcuZW1wdHktcGFuZS1tZXNzYWdlJyk7XG5cdFx0bWVzc2FnZUVsZW1lbnQuaW5uZXJUZXh0ID0gbG9jYWxpemUoJ3BhbmUuZW1wdHlNZXNzYWdlJywgXCJEcmFnIGEgdmlldyBoZXJlIHRvIGRpc3BsYXkuXCIpO1xuXG5cdFx0dGhpcy5lbXB0eVBhbmVNZXNzYWdlRWxlbWVudC5hcHBlbmRDaGlsZChtZXNzYWdlRWxlbWVudCk7XG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKHRoaXMuZW1wdHlQYW5lTWVzc2FnZUVsZW1lbnQpO1xuXG5cdFx0Y29uc3Qgc2V0RHJvcEJhY2tncm91bmRGZWVkYmFjayA9ICh2aXNpYmxlOiBib29sZWFuKSA9PiB7XG5cdFx0XHRjb25zdCB1cGRhdGVBY3Rpdml0eUJhckJhY2tncm91bmQgPSAhdGhpcy5nZXRBY3RpdmVDb21wb3NpdGUoKSB8fCAhdmlzaWJsZTtcblx0XHRcdGNvbnN0IGJhY2tncm91bmRDb2xvciA9IHZpc2libGUgPyB0aGlzLnRoZW1lLmdldENvbG9yKEVESVRPUl9EUkFHX0FORF9EUk9QX0JBQ0tHUk9VTkQpPy50b1N0cmluZygpIHx8ICcnIDogJyc7XG5cblx0XHRcdGlmICh0aGlzLnRpdGxlQ29udGFpbmVyICYmIHVwZGF0ZUFjdGl2aXR5QmFyQmFja2dyb3VuZCkge1xuXHRcdFx0XHR0aGlzLnRpdGxlQ29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGJhY2tncm91bmRDb2xvcjtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmhlYWRlckZvb3RlckNvbXBvc2l0ZUJhckNvbnRhaW5lciAmJiB1cGRhdGVBY3Rpdml0eUJhckJhY2tncm91bmQpIHtcblx0XHRcdFx0dGhpcy5oZWFkZXJGb290ZXJDb21wb3NpdGVCYXJDb250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYmFja2dyb3VuZENvbG9yO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmVtcHR5UGFuZU1lc3NhZ2VFbGVtZW50IS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBiYWNrZ3JvdW5kQ29sb3I7XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKENvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXIuSU5TVEFOQ0UucmVnaXN0ZXJUYXJnZXQodGhpcy5lbGVtZW50LCB7XG5cdFx0XHRvbkRyYWdPdmVyOiAoZSkgPT4ge1xuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUuZXZlbnREYXRhLCB0cnVlKTtcblx0XHRcdFx0aWYgKHRoaXMucGFuZUNvbXBvc2l0ZUJhci52YWx1ZSkge1xuXHRcdFx0XHRcdGNvbnN0IHZhbGlkRHJvcFRhcmdldCA9IHRoaXMucGFuZUNvbXBvc2l0ZUJhci52YWx1ZS5kbmRIYW5kbGVyLm9uRHJhZ0VudGVyKGUuZHJhZ0FuZERyb3BEYXRhLCB1bmRlZmluZWQsIGUuZXZlbnREYXRhKTtcblx0XHRcdFx0XHR0b2dnbGVEcm9wRWZmZWN0KGUuZXZlbnREYXRhLmRhdGFUcmFuc2ZlciwgJ21vdmUnLCB2YWxpZERyb3BUYXJnZXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0b25EcmFnRW50ZXI6IChlKSA9PiB7XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZS5ldmVudERhdGEsIHRydWUpO1xuXHRcdFx0XHRpZiAodGhpcy5wYW5lQ29tcG9zaXRlQmFyLnZhbHVlKSB7XG5cdFx0XHRcdFx0Y29uc3QgdmFsaWREcm9wVGFyZ2V0ID0gdGhpcy5wYW5lQ29tcG9zaXRlQmFyLnZhbHVlLmRuZEhhbmRsZXIub25EcmFnRW50ZXIoZS5kcmFnQW5kRHJvcERhdGEsIHVuZGVmaW5lZCwgZS5ldmVudERhdGEpO1xuXHRcdFx0XHRcdHNldERyb3BCYWNrZ3JvdW5kRmVlZGJhY2sodmFsaWREcm9wVGFyZ2V0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ0xlYXZlOiAoZSkgPT4ge1xuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUuZXZlbnREYXRhLCB0cnVlKTtcblx0XHRcdFx0c2V0RHJvcEJhY2tncm91bmRGZWVkYmFjayhmYWxzZSk7XG5cdFx0XHR9LFxuXHRcdFx0b25EcmFnRW5kOiAoZSkgPT4ge1xuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUuZXZlbnREYXRhLCB0cnVlKTtcblx0XHRcdFx0c2V0RHJvcEJhY2tncm91bmRGZWVkYmFjayhmYWxzZSk7XG5cdFx0XHR9LFxuXHRcdFx0b25Ecm9wOiAoZSkgPT4ge1xuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUuZXZlbnREYXRhLCB0cnVlKTtcblx0XHRcdFx0c2V0RHJvcEJhY2tncm91bmRGZWVkYmFjayhmYWxzZSk7XG5cdFx0XHRcdGlmICh0aGlzLnBhbmVDb21wb3NpdGVCYXIudmFsdWUpIHtcblx0XHRcdFx0XHR0aGlzLnBhbmVDb21wb3NpdGVCYXIudmFsdWUuZG5kSGFuZGxlci5kcm9wKGUuZHJhZ0FuZERyb3BEYXRhLCB1bmRlZmluZWQsIGUuZXZlbnREYXRhKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBBbGxvdyBvcGVuaW5nIHZpZXdzL2NvbXBvc2l0ZXMgaWYgdGhlIGNvbXBvc2l0ZSBiYXIgaXMgaGlkZGVuXG5cdFx0XHRcdFx0Y29uc3QgZHJhZ0RhdGEgPSBlLmRyYWdBbmREcm9wRGF0YS5nZXREYXRhKCk7XG5cblx0XHRcdFx0XHRpZiAoZHJhZ0RhdGEudHlwZSA9PT0gJ2NvbXBvc2l0ZScpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGN1cnJlbnRDb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChkcmFnRGF0YS5pZCkhO1xuXHRcdFx0XHRcdFx0dGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UubW92ZVZpZXdDb250YWluZXJUb0xvY2F0aW9uKGN1cnJlbnRDb250YWluZXIsIHRoaXMubG9jYXRpb24sIHVuZGVmaW5lZCwgJ2RuZCcpO1xuXHRcdFx0XHRcdFx0dGhpcy5vcGVuUGFuZUNvbXBvc2l0ZShjdXJyZW50Q29udGFpbmVyLmlkLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRlbHNlIGlmIChkcmFnRGF0YS50eXBlID09PSAndmlldycpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHZpZXdUb01vdmUgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3RGVzY3JpcHRvckJ5SWQoZHJhZ0RhdGEuaWQpITtcblx0XHRcdFx0XHRcdGlmICh2aWV3VG9Nb3ZlICYmIHZpZXdUb01vdmUuY2FuTW92ZVZpZXcpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UubW92ZVZpZXdUb0xvY2F0aW9uKHZpZXdUb01vdmUsIHRoaXMubG9jYXRpb24sICdkbmQnKTtcblxuXHRcdFx0XHRcdFx0XHRjb25zdCBuZXdDb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodmlld1RvTW92ZS5pZCkhO1xuXG5cdFx0XHRcdFx0XHRcdHRoaXMub3BlblBhbmVDb21wb3NpdGUobmV3Q29udGFpbmVyLmlkLCB0cnVlKS50aGVuKGNvbXBvc2l0ZSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29tcG9zaXRlPy5vcGVuVmlldyh2aWV3VG9Nb3ZlLmlkLCB0cnVlKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVUaXRsZUFyZWEocGFyZW50OiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCB0aXRsZUFyZWEgPSBzdXBlci5jcmVhdGVUaXRsZUFyZWEocGFyZW50KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aXRsZUFyZWEsIEV2ZW50VHlwZS5DT05URVhUX01FTlUsIGUgPT4ge1xuXHRcdFx0dGhpcy5vblRpdGxlQXJlYUNvbnRleHRNZW51KG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZ2V0V2luZG93KHRpdGxlQXJlYSksIGUpKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoR2VzdHVyZS5hZGRUYXJnZXQodGl0bGVBcmVhKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRpdGxlQXJlYSwgR2VzdHVyZUV2ZW50VHlwZS5Db250ZXh0bWVudSwgZSA9PiB7XG5cdFx0XHR0aGlzLm9uVGl0bGVBcmVhQ29udGV4dE1lbnUobmV3IFN0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3codGl0bGVBcmVhKSwgZSkpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGdsb2JhbFRpdGxlQWN0aW9uc0NvbnRhaW5lciA9IHRpdGxlQXJlYS5hcHBlbmRDaGlsZCgkKCcuZ2xvYmFsLWFjdGlvbnMnKSk7XG5cblx0XHQvLyBHbG9iYWwgQWN0aW9ucyBUb29sYmFyXG5cdFx0dGhpcy5nbG9iYWxUb29sQmFyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUb29sQmFyLCBnbG9iYWxUaXRsZUFjdGlvbnNDb250YWluZXIsIHtcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHRoaXMuYWN0aW9uVmlld0l0ZW1Qcm92aWRlcihhY3Rpb24sIG9wdGlvbnMpLFxuXHRcdFx0b3JpZW50YXRpb246IEFjdGlvbnNPcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuXHRcdFx0Z2V0S2V5QmluZGluZzogYWN0aW9uID0+IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhhY3Rpb24uaWQpLFxuXHRcdFx0YW5jaG9yQWxpZ25tZW50UHJvdmlkZXI6ICgpID0+IHRoaXMuZ2V0VGl0bGVBcmVhRHJvcERvd25BbmNob3JBbGlnbm1lbnQoKSxcblx0XHRcdHRvZ2dsZU1lbnVUaXRsZTogbG9jYWxpemUoJ21vcmVBY3Rpb25zJywgXCJNb3JlIEFjdGlvbnMuLi5cIiksXG5cdFx0XHRob3ZlckRlbGVnYXRlOiB0aGlzLnRvb2xiYXJIb3ZlckRlbGVnYXRlLFxuXHRcdFx0aGlkZGVuSXRlbVN0cmF0ZWd5OiBIaWRkZW5JdGVtU3RyYXRlZ3kuTm9IaWRlXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy51cGRhdGVHbG9iYWxUb29sYmFyQWN0aW9ucygpO1xuXG5cdFx0cmV0dXJuIHRpdGxlQXJlYTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVUaXRsZUxhYmVsKHBhcmVudDogSFRNTEVsZW1lbnQpOiBJQ29tcG9zaXRlVGl0bGVMYWJlbCB7XG5cdFx0dGhpcy50aXRsZUNvbnRhaW5lciA9IHBhcmVudDtcblxuXHRcdGNvbnN0IHRpdGxlTGFiZWwgPSBzdXBlci5jcmVhdGVUaXRsZUxhYmVsKHBhcmVudCk7XG5cdFx0dGhpcy50aXRsZUxhYmVsRWxlbWVudCEuZHJhZ2dhYmxlID0gdHJ1ZTtcblx0XHRjb25zdCBkcmFnZ2VkSXRlbVByb3ZpZGVyID0gKCk6IHsgdHlwZTogJ3ZpZXcnIHwgJ2NvbXBvc2l0ZSc7IGlkOiBzdHJpbmcgfSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmVWaWV3bGV0ID0gdGhpcy5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKCkhO1xuXHRcdFx0cmV0dXJuIHsgdHlwZTogJ2NvbXBvc2l0ZScsIGlkOiBhY3RpdmVWaWV3bGV0LmdldElkKCkgfTtcblx0XHR9O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKENvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXIuSU5TVEFOQ0UucmVnaXN0ZXJEcmFnZ2FibGUodGhpcy50aXRsZUxhYmVsRWxlbWVudCEsIGRyYWdnZWRJdGVtUHJvdmlkZXIsIHt9KSk7XG5cblx0XHRyZXR1cm4gdGl0bGVMYWJlbDtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGVDb21wb3NpdGVCYXIodXBkYXRlQ29tcG9zaXRlQmFyT3B0aW9uOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRjb25zdCB3YXNDb21wb3NpdGVCYXJWaXNpYmxlID0gdGhpcy5jb21wb3NpdGVCYXJQb3NpdGlvbiAhPT0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGlzQ29tcG9zaXRlQmFyVmlzaWJsZSA9IHRoaXMuc2hvdWxkU2hvd0NvbXBvc2l0ZUJhcigpO1xuXHRcdGNvbnN0IHByZXZpb3VzUG9zaXRpb24gPSB0aGlzLmNvbXBvc2l0ZUJhclBvc2l0aW9uO1xuXHRcdGNvbnN0IG5ld1Bvc2l0aW9uID0gaXNDb21wb3NpdGVCYXJWaXNpYmxlID8gdGhpcy5nZXRDb21wb3NpdGVCYXJQb3NpdGlvbigpIDogdW5kZWZpbmVkO1xuXG5cdFx0Ly8gT25seSB1cGRhdGUgaWYgdGhlIHZpc2liaWxpdHkgb3IgcG9zaXRpb24gaGFzIGNoYW5nZWQgb3IgaWYgdGhlIGNvbXBvc2l0ZSBiYXIgb3B0aW9ucyBzaG91bGQgYmUgdXBkYXRlZFxuXHRcdGlmICghdXBkYXRlQ29tcG9zaXRlQmFyT3B0aW9uICYmIHByZXZpb3VzUG9zaXRpb24gPT09IG5ld1Bvc2l0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIG9sZCBjb21wb3NpdGUgYmFyXG5cdFx0aWYgKHdhc0NvbXBvc2l0ZUJhclZpc2libGUpIHtcblx0XHRcdGNvbnN0IHByZXZpb3VzQ29tcG9zaXRlQmFyQ29udGFpbmVyID0gcHJldmlvdXNQb3NpdGlvbiA9PT0gQ29tcG9zaXRlQmFyUG9zaXRpb24uVElUTEUgPyB0aGlzLnRpdGxlQ29udGFpbmVyIDogdGhpcy5oZWFkZXJGb290ZXJDb21wb3NpdGVCYXJDb250YWluZXI7XG5cdFx0XHRpZiAoIXRoaXMucGFuZUNvbXBvc2l0ZUJhckNvbnRhaW5lciB8fCAhdGhpcy5wYW5lQ29tcG9zaXRlQmFyLnZhbHVlIHx8ICFwcmV2aW91c0NvbXBvc2l0ZUJhckNvbnRhaW5lcikge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvbXBvc2l0ZSBiYXIgY29udGFpbmVycyBzaG91bGQgZXhpc3Qgd2hlbiByZW1vdmluZyB0aGUgcHJldmlvdXMgY29tcG9zaXRlIGJhcicpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnBhbmVDb21wb3NpdGVCYXJDb250YWluZXIucmVtb3ZlKCk7XG5cdFx0XHR0aGlzLnBhbmVDb21wb3NpdGVCYXJDb250YWluZXIgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLnBhbmVDb21wb3NpdGVCYXIudmFsdWUgPSB1bmRlZmluZWQ7XG5cblx0XHRcdHByZXZpb3VzQ29tcG9zaXRlQmFyQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2hhcy1jb21wb3NpdGUtYmFyJyk7XG5cblx0XHRcdGlmIChwcmV2aW91c1Bvc2l0aW9uID09PSBDb21wb3NpdGVCYXJQb3NpdGlvbi5UT1ApIHtcblx0XHRcdFx0dGhpcy5yZW1vdmVGb290ZXJIZWFkZXJBcmVhKHRydWUpO1xuXHRcdFx0fSBlbHNlIGlmIChwcmV2aW91c1Bvc2l0aW9uID09PSBDb21wb3NpdGVCYXJQb3NpdGlvbi5CT1RUT00pIHtcblx0XHRcdFx0dGhpcy5yZW1vdmVGb290ZXJIZWFkZXJBcmVhKGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDcmVhdGUgbmV3IGNvbXBvc2l0ZSBiYXJcblx0XHRsZXQgbmV3Q29tcG9zaXRlQmFyQ29udGFpbmVyO1xuXHRcdHN3aXRjaCAobmV3UG9zaXRpb24pIHtcblx0XHRcdGNhc2UgQ29tcG9zaXRlQmFyUG9zaXRpb24uVE9QOiBuZXdDb21wb3NpdGVCYXJDb250YWluZXIgPSB0aGlzLmNyZWF0ZUhlYWRlckFyZWEoKTsgYnJlYWs7XG5cdFx0XHRjYXNlIENvbXBvc2l0ZUJhclBvc2l0aW9uLlRJVExFOiBuZXdDb21wb3NpdGVCYXJDb250YWluZXIgPSB0aGlzLnRpdGxlQ29udGFpbmVyOyBicmVhaztcblx0XHRcdGNhc2UgQ29tcG9zaXRlQmFyUG9zaXRpb24uQk9UVE9NOiBuZXdDb21wb3NpdGVCYXJDb250YWluZXIgPSB0aGlzLmNyZWF0ZUZvb3RlckFyZWEoKTsgYnJlYWs7XG5cdFx0fVxuXHRcdGlmIChpc0NvbXBvc2l0ZUJhclZpc2libGUpIHtcblxuXHRcdFx0aWYgKHRoaXMucGFuZUNvbXBvc2l0ZUJhckNvbnRhaW5lciB8fCB0aGlzLnBhbmVDb21wb3NpdGVCYXIudmFsdWUgfHwgIW5ld0NvbXBvc2l0ZUJhckNvbnRhaW5lcikge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29tcG9zaXRlIGJhciBzdGF0ZSB3aGVuIGNyZWF0aW5nIHRoZSBuZXcgY29tcG9zaXRlIGJhcicpO1xuXHRcdFx0fVxuXG5cdFx0XHRuZXdDb21wb3NpdGVCYXJDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnaGFzLWNvbXBvc2l0ZS1iYXInKTtcblx0XHRcdHRoaXMucGFuZUNvbXBvc2l0ZUJhckNvbnRhaW5lciA9IHByZXBlbmQobmV3Q29tcG9zaXRlQmFyQ29udGFpbmVyLCAkKCcuY29tcG9zaXRlLWJhci1jb250YWluZXInKSk7XG5cdFx0XHR0aGlzLnBhbmVDb21wb3NpdGVCYXIudmFsdWUgPSB0aGlzLmNyZWF0ZUNvbXBvc2l0ZUJhcigpO1xuXHRcdFx0dGhpcy5wYW5lQ29tcG9zaXRlQmFyLnZhbHVlLmNyZWF0ZSh0aGlzLnBhbmVDb21wb3NpdGVCYXJDb250YWluZXIpO1xuXG5cdFx0XHRpZiAobmV3UG9zaXRpb24gPT09IENvbXBvc2l0ZUJhclBvc2l0aW9uLlRPUCkge1xuXHRcdFx0XHR0aGlzLnNldEhlYWRlckFyZWEobmV3Q29tcG9zaXRlQmFyQ29udGFpbmVyKTtcblx0XHRcdH0gZWxzZSBpZiAobmV3UG9zaXRpb24gPT09IENvbXBvc2l0ZUJhclBvc2l0aW9uLkJPVFRPTSkge1xuXHRcdFx0XHR0aGlzLnNldEZvb3RlckFyZWEobmV3Q29tcG9zaXRlQmFyQ29udGFpbmVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmNvbXBvc2l0ZUJhclBvc2l0aW9uID0gbmV3UG9zaXRpb247XG5cblx0XHRpZiAodXBkYXRlQ29tcG9zaXRlQmFyT3B0aW9uKSB7XG5cdFx0XHR0aGlzLmxheW91dENvbXBvc2l0ZUJhcigpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVIZWFkZXJBcmVhKCk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBoZWFkZXJBcmVhID0gc3VwZXIuY3JlYXRlSGVhZGVyQXJlYSgpO1xuXHRcdHJldHVybiB0aGlzLmNyZWF0ZUhlYWRlckZvb3RlckNvbXBvc2l0ZUJhckFyZWEoaGVhZGVyQXJlYSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlRm9vdGVyQXJlYSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgZm9vdGVyQXJlYSA9IHN1cGVyLmNyZWF0ZUZvb3RlckFyZWEoKTtcblx0XHRyZXR1cm4gdGhpcy5jcmVhdGVIZWFkZXJGb290ZXJDb21wb3NpdGVCYXJBcmVhKGZvb3RlckFyZWEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUhlYWRlckZvb3RlckNvbXBvc2l0ZUJhckFyZWEoYXJlYTogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB7XG5cdFx0aWYgKHRoaXMuaGVhZGVyRm9vdGVyQ29tcG9zaXRlQmFyQ29udGFpbmVyKSB7XG5cdFx0XHQvLyBBIHBhbmUgY29tcG9zaXRlIHBhcnQgaGFzIGVpdGhlciBhIGhlYWRlciBvciBhIGZvb3RlciwgYnV0IG5vdCBib3RoXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0hlYWRlciBvciBGb290ZXIgY29tcG9zaXRlIGJhciBhbHJlYWR5IGV4aXN0cycpO1xuXHRcdH1cblx0XHR0aGlzLmhlYWRlckZvb3RlckNvbXBvc2l0ZUJhckNvbnRhaW5lciA9IGFyZWE7XG5cblx0XHR0aGlzLmhlYWRlckZvb3RlckNvbXBvc2l0ZUJhckRpc3BvYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihhcmVhLCBFdmVudFR5cGUuQ09OVEVYVF9NRU5VLCBlID0+IHtcblx0XHRcdHRoaXMub25Db21wb3NpdGVCYXJBcmVhQ29udGV4dE1lbnUobmV3IFN0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3coYXJlYSksIGUpKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5oZWFkZXJGb290ZXJDb21wb3NpdGVCYXJEaXNwb2FibGVzLmFkZChHZXN0dXJlLmFkZFRhcmdldChhcmVhKSk7XG5cdFx0dGhpcy5oZWFkZXJGb290ZXJDb21wb3NpdGVCYXJEaXNwb2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIoYXJlYSwgR2VzdHVyZUV2ZW50VHlwZS5Db250ZXh0bWVudSwgZSA9PiB7XG5cdFx0XHR0aGlzLm9uQ29tcG9zaXRlQmFyQXJlYUNvbnRleHRNZW51KG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZ2V0V2luZG93KGFyZWEpLCBlKSk7XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGFyZWE7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUZvb3RlckhlYWRlckFyZWEoaGVhZGVyOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5oZWFkZXJGb290ZXJDb21wb3NpdGVCYXJDb250YWluZXIgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5oZWFkZXJGb290ZXJDb21wb3NpdGVCYXJEaXNwb2FibGVzLmNsZWFyKCk7XG5cdFx0aWYgKGhlYWRlcikge1xuXHRcdFx0dGhpcy5yZW1vdmVIZWFkZXJBcmVhKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVtb3ZlRm9vdGVyQXJlYSgpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVDb21wb3NpdGVCYXIoKTogUGFuZUNvbXBvc2l0ZUJhciB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUGFuZUNvbXBvc2l0ZUJhciwgdGhpcy5nZXRDb21wb3NpdGVCYXJPcHRpb25zKCksIHRoaXMucGFydElkLCB0aGlzKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBvblRpdGxlQXJlYVVwZGF0ZShjb21wb3NpdGVJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0c3VwZXIub25UaXRsZUFyZWFVcGRhdGUoY29tcG9zaXRlSWQpO1xuXG5cdFx0Ly8gSWYgdGl0bGUgYWN0aW9ucyBjaGFuZ2UsIHJlbGF5b3V0IHRoZSBjb21wb3NpdGUgYmFyXG5cdFx0dGhpcy5sYXlvdXRDb21wb3NpdGVCYXIoKTtcblx0fVxuXG5cdGFzeW5jIG9wZW5QYW5lQ29tcG9zaXRlKGlkPzogc3RyaW5nLCBmb2N1cz86IGJvb2xlYW4pOiBQcm9taXNlPFBhbmVDb21wb3NpdGUgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodHlwZW9mIGlkID09PSAnc3RyaW5nJyAmJiB0aGlzLmdldFBhbmVDb21wb3NpdGUoaWQpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb09wZW5QYW5lQ29tcG9zaXRlKGlkLCBmb2N1cyk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXG5cdFx0aWYgKHR5cGVvZiBpZCA9PT0gJ3N0cmluZycgJiYgdGhpcy5nZXRQYW5lQ29tcG9zaXRlKGlkKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9PcGVuUGFuZUNvbXBvc2l0ZShpZCwgZm9jdXMpO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGRvT3BlblBhbmVDb21wb3NpdGUoaWQ6IHN0cmluZywgZm9jdXM/OiBib29sZWFuKTogUGFuZUNvbXBvc2l0ZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuYmxvY2tPcGVuaW5nKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyBXb3JrYXJvdW5kIGFnYWluc3QgYSBwb3RlbnRpYWwgcmFjZSBjb25kaXRpb25cblx0XHR9XG5cblx0XHRpZiAoIXRoaXMubGF5b3V0U2VydmljZS5pc1Zpc2libGUodGhpcy5wYXJ0SWQpKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLmJsb2NrT3BlbmluZyA9IHRydWU7XG5cdFx0XHRcdHRoaXMubGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKGZhbHNlLCB0aGlzLnBhcnRJZCk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLmJsb2NrT3BlbmluZyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLm9wZW5Db21wb3NpdGUoaWQsIGZvY3VzKSBhcyBQYW5lQ29tcG9zaXRlO1xuXHR9XG5cblx0Z2V0UGFuZUNvbXBvc2l0ZShpZDogc3RyaW5nKTogUGFuZUNvbXBvc2l0ZURlc2NyaXB0b3IgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiAodGhpcy5yZWdpc3RyeSBhcyBQYW5lQ29tcG9zaXRlUmVnaXN0cnkpLmdldFBhbmVDb21wb3NpdGUoaWQpO1xuXHR9XG5cblx0Z2V0UGFuZUNvbXBvc2l0ZXMoKTogUGFuZUNvbXBvc2l0ZURlc2NyaXB0b3JbXSB7XG5cdFx0cmV0dXJuICh0aGlzLnJlZ2lzdHJ5IGFzIFBhbmVDb21wb3NpdGVSZWdpc3RyeSkuZ2V0UGFuZUNvbXBvc2l0ZXMoKVxuXHRcdFx0LnNvcnQoKHYxLCB2MikgPT4ge1xuXHRcdFx0XHRpZiAodHlwZW9mIHYxLm9yZGVyICE9PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHR5cGVvZiB2Mi5vcmRlciAhPT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdjEub3JkZXIgLSB2Mi5vcmRlcjtcblx0XHRcdH0pO1xuXHR9XG5cblx0Z2V0UGlubmVkUGFuZUNvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMucGFuZUNvbXBvc2l0ZUJhci52YWx1ZT8uZ2V0UGlubmVkUGFuZUNvbXBvc2l0ZUlkcygpID8/IFtdO1xuXHR9XG5cblx0Z2V0VmlzaWJsZVBhbmVDb21wb3NpdGVJZHMoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLnBhbmVDb21wb3NpdGVCYXIudmFsdWU/LmdldFZpc2libGVQYW5lQ29tcG9zaXRlSWRzKCkgPz8gW107XG5cdH1cblxuXHRnZXRQYW5lQ29tcG9zaXRlSWRzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5wYW5lQ29tcG9zaXRlQmFyLnZhbHVlPy5nZXRQYW5lQ29tcG9zaXRlSWRzKCkgPz8gW107XG5cdH1cblxuXHRnZXRBY3RpdmVQYW5lQ29tcG9zaXRlKCk6IElQYW5lQ29tcG9zaXRlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gPElQYW5lQ29tcG9zaXRlPnRoaXMuZ2V0QWN0aXZlQ29tcG9zaXRlKCk7XG5cdH1cblxuXHRnZXRMYXN0QWN0aXZlUGFuZUNvbXBvc2l0ZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0TGFzdEFjdGl2ZUNvbXBvc2l0ZUlkKCk7XG5cdH1cblxuXHRoaWRlQWN0aXZlUGFuZUNvbXBvc2l0ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5sYXlvdXRTZXJ2aWNlLmlzVmlzaWJsZSh0aGlzLnBhcnRJZCkpIHtcblx0XHRcdHRoaXMubGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKHRydWUsIHRoaXMucGFydElkKTtcblx0XHR9XG5cblx0XHR0aGlzLmhpZGVBY3RpdmVDb21wb3NpdGUoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBmb2N1c0NvbXBvc2l0ZUJhcigpOiB2b2lkIHtcblx0XHR0aGlzLnBhbmVDb21wb3NpdGVCYXIudmFsdWU/LmZvY3VzKCk7XG5cdH1cblxuXHRvdmVycmlkZSBsYXlvdXQod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHRvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubGF5b3V0U2VydmljZS5pc1Zpc2libGUodGhpcy5wYXJ0SWQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jb250ZW50RGltZW5zaW9uID0gbmV3IERpbWVuc2lvbih3aWR0aCwgaGVpZ2h0KTtcblxuXHRcdC8vIExheW91dCBjb250ZW50c1xuXHRcdHN1cGVyLmxheW91dCh0aGlzLmNvbnRlbnREaW1lbnNpb24ud2lkdGgsIHRoaXMuY29udGVudERpbWVuc2lvbi5oZWlnaHQsIHRvcCwgbGVmdCk7XG5cblx0XHQvLyBMYXlvdXQgY29tcG9zaXRlIGJhclxuXHRcdHRoaXMubGF5b3V0Q29tcG9zaXRlQmFyKCk7XG5cblx0XHQvLyBBZGQgZW1wdHkgcGFuZSBtZXNzYWdlXG5cdFx0dGhpcy5sYXlvdXRFbXB0eU1lc3NhZ2UoKTtcblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0Q29tcG9zaXRlQmFyKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmNvbnRlbnREaW1lbnNpb24gJiYgdGhpcy5kaW1lbnNpb24gJiYgdGhpcy5wYW5lQ29tcG9zaXRlQmFyLnZhbHVlKSB7XG5cdFx0XHRjb25zdCBwYWRkaW5nID0gdGhpcy5jb21wb3NpdGVCYXJQb3NpdGlvbiA9PT0gQ29tcG9zaXRlQmFyUG9zaXRpb24uVElUTEUgPyAxNiA6IDg7XG5cdFx0XHRjb25zdCBib3JkZXJXaWR0aCA9IHRoaXMucGFydElkID09PSBQYXJ0cy5QQU5FTF9QQVJUID8gMCA6IDE7XG5cdFx0XHRsZXQgYXZhaWxhYmxlV2lkdGggPSB0aGlzLmNvbnRlbnREaW1lbnNpb24ud2lkdGggLSBwYWRkaW5nIC0gYm9yZGVyV2lkdGg7XG5cdFx0XHRhdmFpbGFibGVXaWR0aCA9IE1hdGgubWF4KEFic3RyYWN0UGFuZUNvbXBvc2l0ZVBhcnQuTUlOX0NPTVBPU0lURV9CQVJfV0lEVEgsIGF2YWlsYWJsZVdpZHRoIC0gdGhpcy5nZXRUb29sYmFyV2lkdGgoKSk7XG5cdFx0XHR0aGlzLnBhbmVDb21wb3NpdGVCYXIudmFsdWUubGF5b3V0KGF2YWlsYWJsZVdpZHRoLCB0aGlzLmRpbWVuc2lvbi5oZWlnaHQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0RW1wdHlNZXNzYWdlKCk6IHZvaWQge1xuXHRcdGNvbnN0IHZpc2libGUgPSAhdGhpcy5nZXRBY3RpdmVDb21wb3NpdGUoKTtcblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnZW1wdHknLCB2aXNpYmxlKTtcblx0XHRpZiAodmlzaWJsZSkge1xuXHRcdFx0dGhpcy50aXRsZUxhYmVsPy51cGRhdGVUaXRsZSgnJywgJycpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlR2xvYmFsVG9vbGJhckFjdGlvbnMoKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJpbWFyeUFjdGlvbnMgPSB0aGlzLmdsb2JhbEFjdGlvbnMuZ2V0UHJpbWFyeUFjdGlvbnMoKTtcblx0XHRjb25zdCBzZWNvbmRhcnlBY3Rpb25zID0gdGhpcy5nbG9iYWxBY3Rpb25zLmdldFNlY29uZGFyeUFjdGlvbnMoKTtcblx0XHR0aGlzLmdsb2JhbFRvb2xCYXI/LnNldEFjdGlvbnMocHJlcGFyZUFjdGlvbnMocHJpbWFyeUFjdGlvbnMpLCBwcmVwYXJlQWN0aW9ucyhzZWNvbmRhcnlBY3Rpb25zKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0VG9vbGJhcldpZHRoKCk6IG51bWJlciB7XG5cdFx0aWYgKCF0aGlzLnRvb2xCYXIgfHwgdGhpcy5jb21wb3NpdGVCYXJQb3NpdGlvbiAhPT0gQ29tcG9zaXRlQmFyUG9zaXRpb24uVElUTEUpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZVBhbmUgPSB0aGlzLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUoKTtcblx0XHRpZiAoIWFjdGl2ZVBhbmUpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdC8vIEVhY2ggdG9vbGJhciBpdGVtIGhhcyA0cHggbWFyZ2luXG5cdFx0Y29uc3QgdG9vbEJhcldpZHRoID0gdGhpcy50b29sQmFyLmdldEl0ZW1zV2lkdGgoKSArIHRoaXMudG9vbEJhci5nZXRJdGVtc0xlbmd0aCgpICogNDtcblx0XHRjb25zdCBnbG9iYWxUb29sQmFyV2lkdGggPSB0aGlzLmdsb2JhbFRvb2xCYXIgPyB0aGlzLmdsb2JhbFRvb2xCYXIuZ2V0SXRlbXNXaWR0aCgpICsgdGhpcy5nbG9iYWxUb29sQmFyLmdldEl0ZW1zTGVuZ3RoKCkgKiA0IDogMDtcblx0XHRyZXR1cm4gdG9vbEJhcldpZHRoICsgZ2xvYmFsVG9vbEJhcldpZHRoICsgNTsgLy8gNXB4IHBhZGRpbmcgbGVmdFxuXHR9XG5cblx0cHJpdmF0ZSBvblRpdGxlQXJlYUNvbnRleHRNZW51KGV2ZW50OiBTdGFuZGFyZE1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zaG91bGRTaG93Q29tcG9zaXRlQmFyKCkgJiYgdGhpcy5nZXRDb21wb3NpdGVCYXJQb3NpdGlvbigpID09PSBDb21wb3NpdGVCYXJQb3NpdGlvbi5USVRMRSkge1xuXHRcdFx0cmV0dXJuIHRoaXMub25Db21wb3NpdGVCYXJDb250ZXh0TWVudShldmVudCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGFjdGl2ZVBhbmVDb21wb3NpdGUgPSB0aGlzLmdldEFjdGl2ZVBhbmVDb21wb3NpdGUoKSBhcyBQYW5lQ29tcG9zaXRlO1xuXHRcdFx0Y29uc3QgYWN0aXZlUGFuZUNvbXBvc2l0ZUFjdGlvbnMgPSBhY3RpdmVQYW5lQ29tcG9zaXRlID8gYWN0aXZlUGFuZUNvbXBvc2l0ZS5nZXRDb250ZXh0TWVudUFjdGlvbnMoKSA6IFtdO1xuXHRcdFx0aWYgKGFjdGl2ZVBhbmVDb21wb3NpdGVBY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aXZlUGFuZUNvbXBvc2l0ZUFjdGlvbnMsXG5cdFx0XHRcdFx0Z2V0QWN0aW9uVmlld0l0ZW06IChhY3Rpb24sIG9wdGlvbnMpID0+IHRoaXMuYWN0aW9uVmlld0l0ZW1Qcm92aWRlcihhY3Rpb24sIG9wdGlvbnMpLFxuXHRcdFx0XHRcdGFjdGlvblJ1bm5lcjogYWN0aXZlUGFuZUNvbXBvc2l0ZS5nZXRBY3Rpb25SdW5uZXIoKSxcblx0XHRcdFx0XHRza2lwVGVsZW1ldHJ5OiB0cnVlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Db21wb3NpdGVCYXJBcmVhQ29udGV4dE1lbnUoZXZlbnQ6IFN0YW5kYXJkTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdHJldHVybiB0aGlzLm9uQ29tcG9zaXRlQmFyQ29udGV4dE1lbnUoZXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbXBvc2l0ZUJhckNvbnRleHRNZW51KGV2ZW50OiBTdGFuZGFyZE1vdXNlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5wYW5lQ29tcG9zaXRlQmFyLnZhbHVlKSB7XG5cdFx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbLi4udGhpcy5wYW5lQ29tcG9zaXRlQmFyLnZhbHVlLmdldENvbnRleHRNZW51QWN0aW9ucygpXTtcblx0XHRcdGlmIChhY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucyxcblx0XHRcdFx0XHRza2lwVGVsZW1ldHJ5OiB0cnVlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBnZXRWaWV3c1N1Ym1lbnVBY3Rpb24oKTogU3VibWVudUFjdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgdmlld1BhbmVDb250YWluZXIgPSAodGhpcy5nZXRBY3RpdmVQYW5lQ29tcG9zaXRlKCkgYXMgUGFuZUNvbXBvc2l0ZSk/LmdldFZpZXdQYW5lQ29udGFpbmVyKCk7XG5cdFx0aWYgKHZpZXdQYW5lQ29udGFpbmVyKSB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGNvbnN0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuZWxlbWVudCkpO1xuXHRcdFx0c2NvcGVkQ29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5KCd2aWV3Q29udGFpbmVyJywgdmlld1BhbmVDb250YWluZXIudmlld0NvbnRhaW5lci5pZCk7XG5cdFx0XHRjb25zdCBtZW51ID0gdGhpcy5tZW51U2VydmljZS5nZXRNZW51QWN0aW9ucyhWaWV3c1N1Yk1lbnUsIHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLCB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlLCByZW5kZXJTaG9ydFRpdGxlOiB0cnVlIH0pO1xuXHRcdFx0Y29uc3Qgdmlld3NBY3Rpb25zID0gZ2V0QWN0aW9uQmFyQWN0aW9ucyhtZW51LCAoKSA9PiB0cnVlKS5wcmltYXJ5O1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuIHZpZXdzQWN0aW9ucy5sZW5ndGggPiAxICYmIHZpZXdzQWN0aW9ucy5zb21lKGEgPT4gYS5lbmFibGVkKSA/IG5ldyBTdWJtZW51QWN0aW9uKCd2aWV3cycsIGxvY2FsaXplKCd2aWV3cycsIFwiVmlld3NcIiksIHZpZXdzQWN0aW9ucykgOiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3Qgc2hvdWxkU2hvd0NvbXBvc2l0ZUJhcigpOiBib29sZWFuO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0Q29tcG9zaXRlQmFyT3B0aW9ucygpOiBJUGFuZUNvbXBvc2l0ZUJhck9wdGlvbnM7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRDb21wb3NpdGVCYXJQb3NpdGlvbigpOiBDb21wb3NpdGVCYXJQb3NpdGlvbjtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsYUFBYTtBQUN0QixTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLGtCQUFpRjtBQUUxRixTQUFTLHdCQUF3Qiw2QkFBNkI7QUFDOUQsU0FBUyxpQkFBaUIseUJBQXlCO0FBRW5ELFNBQVMseUJBQXlCLGFBQWE7QUFDL0MsU0FBUyxxQkFBMkM7QUFDcEQsU0FBbUMsd0JBQXdCO0FBQzNELFNBQVMsV0FBVyxhQUFhLFlBQVksR0FBRyx1QkFBdUIsV0FBVyxTQUFTLGlCQUFpQjtBQUM1RyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw4QkFBOEIsd0JBQXdCO0FBQy9ELFNBQVMsdUNBQXVDO0FBRWhELFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsY0FBYyxjQUFjO0FBQ3JDLFNBQVMsb0JBQW9CLHNCQUFzQjtBQUNuRCxTQUFTLFNBQVMsYUFBYSx3QkFBd0I7QUFDdkQsU0FBUywwQkFBMEI7QUFDbkMsU0FBa0IscUJBQXFCO0FBRXZDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0JBQW9CLHdCQUF3QjtBQUU5QyxJQUFLLHVCQUFMLGtCQUFLQSwwQkFBTDtBQUNOLEVBQUFBLDRDQUFBO0FBQ0EsRUFBQUEsNENBQUE7QUFDQSxFQUFBQSw0Q0FBQTtBQUhXLFNBQUFB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
