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
import { toAction } from "../../../base/common/actions.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ActionBar, ActionsOrientation } from "../../../base/browser/ui/actionbar/actionbar.js";
import { CompositeActionViewItem, CompositeOverflowActivityAction, CompositeOverflowActivityActionViewItem } from "./compositeBarActions.js";
import { $, addDisposableListener, EventType, EventHelper, isAncestor, getWindow } from "../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { Widget } from "../../../base/browser/ui/widget.js";
import { isUndefinedOrNull } from "../../../base/common/types.js";
import { Emitter } from "../../../base/common/event.js";
import { IViewDescriptorService } from "../../common/views.js";
import { CompositeDragAndDropObserver, toggleDropEffect } from "../dnd.js";
import { Gesture, EventType as TouchEventType } from "../../../base/browser/touch.js";
class CompositeDragAndDrop {
  constructor(viewDescriptorService, targetContainerLocation, orientation, openComposite, moveComposite, getItems) {
    this.viewDescriptorService = viewDescriptorService;
    this.targetContainerLocation = targetContainerLocation;
    this.orientation = orientation;
    this.openComposite = openComposite;
    this.moveComposite = moveComposite;
    this.getItems = getItems;
  }
  drop(data, targetCompositeId, originalEvent, before) {
    const dragData = data.getData();
    if (dragData.type === "composite") {
      const currentContainer = this.viewDescriptorService.getViewContainerById(dragData.id);
      const currentLocation = this.viewDescriptorService.getViewContainerLocation(currentContainer);
      let moved = false;
      if (currentLocation === this.targetContainerLocation) {
        if (targetCompositeId) {
          this.moveComposite(dragData.id, targetCompositeId, before);
          moved = true;
        }
      } else {
        this.viewDescriptorService.moveViewContainerToLocation(currentContainer, this.targetContainerLocation, this.getTargetIndex(targetCompositeId, before), "dnd");
        moved = true;
      }
      if (moved) {
        this.openComposite(currentContainer.id, true);
      }
    }
    if (dragData.type === "view") {
      const viewToMove = this.viewDescriptorService.getViewDescriptorById(dragData.id);
      if (viewToMove && viewToMove.canMoveView) {
        this.viewDescriptorService.moveViewToLocation(viewToMove, this.targetContainerLocation, "dnd");
        const newContainer = this.viewDescriptorService.getViewContainerByViewId(viewToMove.id);
        if (targetCompositeId) {
          this.moveComposite(newContainer.id, targetCompositeId, before);
        }
        this.openComposite(newContainer.id, true).then((composite) => {
          composite?.openView(viewToMove.id, true);
        });
      }
    }
  }
  onDragEnter(data, targetCompositeId, originalEvent) {
    return this.canDrop(data, targetCompositeId);
  }
  onDragOver(data, targetCompositeId, originalEvent) {
    return this.canDrop(data, targetCompositeId);
  }
  getTargetIndex(targetId, before2d) {
    if (!targetId) {
      return void 0;
    }
    const items = this.getItems();
    const before = this.orientation === ActionsOrientation.HORIZONTAL ? before2d?.horizontallyBefore : before2d?.verticallyBefore;
    return items.filter((item) => item.visible).findIndex((item) => item.id === targetId) + (before ? 0 : 1);
  }
  canDrop(data, targetCompositeId) {
    const dragData = data.getData();
    if (dragData.type === "composite") {
      const currentContainer = this.viewDescriptorService.getViewContainerById(dragData.id);
      const currentLocation = this.viewDescriptorService.getViewContainerLocation(currentContainer);
      if (currentLocation === this.targetContainerLocation) {
        return dragData.id !== targetCompositeId;
      }
      return true;
    } else {
      const viewDescriptor = this.viewDescriptorService.getViewDescriptorById(dragData.id);
      if (!viewDescriptor || !viewDescriptor.canMoveView) {
        return false;
      }
      return true;
    }
  }
}
class CompositeBarDndCallbacks {
  constructor(compositeBarContainer, actionBarContainer, compositeBarModel, dndHandler, orientation) {
    this.compositeBarContainer = compositeBarContainer;
    this.actionBarContainer = actionBarContainer;
    this.compositeBarModel = compositeBarModel;
    this.dndHandler = dndHandler;
    this.orientation = orientation;
    this.insertDropBefore = void 0;
  }
  onDragOver(e) {
    const visibleItems = this.compositeBarModel.visibleItems;
    if (!visibleItems.length || e.eventData.target && isAncestor(e.eventData.target, this.actionBarContainer)) {
      this.insertDropBefore = this.updateFromDragging(this.compositeBarContainer, false, false, true);
      return;
    }
    const insertAtFront = this.insertAtFront(this.actionBarContainer, e.eventData);
    const target = insertAtFront ? visibleItems[0] : visibleItems[visibleItems.length - 1];
    const validDropTarget = this.dndHandler.onDragOver(e.dragAndDropData, target.id, e.eventData);
    toggleDropEffect(e.eventData.dataTransfer, "move", validDropTarget);
    this.insertDropBefore = this.updateFromDragging(this.compositeBarContainer, validDropTarget, insertAtFront, true);
  }
  onDragLeave(e) {
    this.insertDropBefore = this.updateFromDragging(this.compositeBarContainer, false, false, false);
  }
  onDragEnd(e) {
    this.insertDropBefore = this.updateFromDragging(this.compositeBarContainer, false, false, false);
  }
  onDrop(e) {
    const visibleItems = this.compositeBarModel.visibleItems;
    let targetId = void 0;
    if (visibleItems.length) {
      targetId = this.insertAtFront(this.actionBarContainer, e.eventData) ? visibleItems[0].id : visibleItems[visibleItems.length - 1].id;
    }
    this.dndHandler.drop(e.dragAndDropData, targetId, e.eventData, this.insertDropBefore);
    this.insertDropBefore = this.updateFromDragging(this.compositeBarContainer, false, false, false);
  }
  insertAtFront(element, event) {
    const rect = element.getBoundingClientRect();
    const posX = event.clientX;
    const posY = event.clientY;
    switch (this.orientation) {
      case ActionsOrientation.HORIZONTAL:
        return posX < rect.left;
      case ActionsOrientation.VERTICAL:
        return posY < rect.top;
    }
  }
  updateFromDragging(element, showFeedback, front, isDragging) {
    element.classList.toggle("dragged-over", isDragging);
    element.classList.toggle("dragged-over-head", showFeedback && front);
    element.classList.toggle("dragged-over-tail", showFeedback && !front);
    if (!showFeedback) {
      return void 0;
    }
    return { verticallyBefore: front, horizontallyBefore: front };
  }
}
let CompositeBar = class extends Widget {
  constructor(items, options, instantiationService, contextMenuService, viewDescriptorService) {
    super();
    this.options = options;
    this.instantiationService = instantiationService;
    this.contextMenuService = contextMenuService;
    this.viewDescriptorService = viewDescriptorService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.model = new CompositeBarModel(items, options);
    this.visibleComposites = [];
    this.compositeSizeInBar = /* @__PURE__ */ new Map();
    this.computeSizes(this.model.visibleItems);
  }
  getCompositeBarItems() {
    return [...this.model.items];
  }
  setCompositeBarItems(items) {
    this.model.setItems(items);
    this.updateCompositeSwitcher(true);
  }
  getPinnedComposites() {
    return this.model.pinnedItems;
  }
  getPinnedCompositeIds() {
    return this.getPinnedComposites().map((c) => c.id);
  }
  getVisibleComposites() {
    return this.model.visibleItems;
  }
  create(parent) {
    const actionBarDiv = parent.appendChild($(".composite-bar"));
    this.compositeSwitcherBar = this._register(new ActionBar(actionBarDiv, {
      actionViewItemProvider: (action, options) => {
        if (action instanceof CompositeOverflowActivityAction) {
          return this.compositeOverflowActionViewItem;
        }
        const item = this.model.findItem(action.id);
        return item && this.instantiationService.createInstance(
          CompositeActionViewItem,
          { ...options, draggable: true, colors: this.options.colors, icon: this.options.icon, hoverOptions: this.options.activityHoverOptions, compact: this.options.compact },
          action,
          item.pinnedAction,
          item.toggleBadgeAction,
          (compositeId) => this.options.getContextMenuActionsForComposite(compositeId),
          () => this.getContextMenuActions(),
          this.options.dndHandler,
          this
        );
      },
      orientation: this.options.orientation,
      ariaLabel: localize("activityBarAriaLabel", "Active View Switcher"),
      ariaRole: "tablist",
      preventLoopNavigation: this.options.preventLoopNavigation,
      triggerKeys: { keyDown: true }
    }));
    this._register(addDisposableListener(parent, EventType.CONTEXT_MENU, (e) => this.showContextMenu(getWindow(parent), e)));
    this._register(Gesture.addTarget(parent));
    this._register(addDisposableListener(parent, TouchEventType.Contextmenu, (e) => this.showContextMenu(getWindow(parent), e)));
    const dndCallback = new CompositeBarDndCallbacks(parent, actionBarDiv, this.model, this.options.dndHandler, this.options.orientation);
    this._register(CompositeDragAndDropObserver.INSTANCE.registerTarget(parent, dndCallback));
    return actionBarDiv;
  }
  focus(index) {
    this.compositeSwitcherBar?.focus(index);
  }
  recomputeSizes() {
    this.computeSizes(this.model.visibleItems);
    this.updateCompositeSwitcher();
  }
  layout(dimension) {
    this.dimension = dimension;
    if (dimension.height === 0 || dimension.width === 0) {
      return;
    }
    if (this.compositeSizeInBar.size === 0) {
      this.computeSizes(this.model.visibleItems);
    }
    this.updateCompositeSwitcher();
  }
  addComposite({ id, name, order, requestedIndex }) {
    if (this.model.add(id, name, order, requestedIndex)) {
      this.computeSizes([this.model.findItem(id)]);
      this.updateCompositeSwitcher();
    }
  }
  removeComposite(id) {
    if (this.isPinned(id)) {
      this.unpin(id);
    }
    if (this.model.remove(id)) {
      this.updateCompositeSwitcher();
    }
  }
  hideComposite(id) {
    if (this.model.hide(id)) {
      this.resetActiveComposite(id);
      this.updateCompositeSwitcher();
    }
  }
  activateComposite(id) {
    const previousActiveItem = this.model.activeItem;
    if (this.model.activate(id)) {
      if (this.visibleComposites.indexOf(id) === -1 || !!this.model.activeItem && !this.model.activeItem.pinned || previousActiveItem && !previousActiveItem.pinned) {
        this.updateCompositeSwitcher();
      }
    }
  }
  deactivateComposite(id) {
    const previousActiveItem = this.model.activeItem;
    if (this.model.deactivate()) {
      if (previousActiveItem && !previousActiveItem.pinned) {
        this.updateCompositeSwitcher();
      }
    }
  }
  async pin(compositeId, open) {
    if (this.model.setPinned(compositeId, true)) {
      this.updateCompositeSwitcher();
      if (open) {
        await this.options.openComposite(compositeId);
        this.activateComposite(compositeId);
      }
    }
  }
  unpin(compositeId) {
    if (this.model.setPinned(compositeId, false)) {
      this.updateCompositeSwitcher();
      this.resetActiveComposite(compositeId);
    }
  }
  areBadgesEnabled(compositeId) {
    return this.viewDescriptorService.getViewContainerBadgeEnablementState(compositeId);
  }
  toggleBadgeEnablement(compositeId) {
    this.viewDescriptorService.setViewContainerBadgeEnablementState(compositeId, !this.areBadgesEnabled(compositeId));
    this.updateCompositeSwitcher();
    const item = this.model.findItem(compositeId);
    if (item) {
      item.activityAction.activities = item.activityAction.activities;
    }
  }
  resetActiveComposite(compositeId) {
    const defaultCompositeId = this.options.getDefaultCompositeId();
    if (!this.model.activeItem || this.model.activeItem.id !== compositeId) {
      return;
    }
    this.deactivateComposite(compositeId);
    if (defaultCompositeId && defaultCompositeId !== compositeId && this.isPinned(defaultCompositeId)) {
      this.options.openComposite(defaultCompositeId, true);
    } else {
      const visibleComposite = this.visibleComposites.find((cid) => cid !== compositeId);
      if (visibleComposite) {
        this.options.openComposite(visibleComposite);
      }
    }
  }
  isPinned(compositeId) {
    const item = this.model.findItem(compositeId);
    return item?.pinned;
  }
  move(compositeId, toCompositeId, before) {
    if (before !== void 0) {
      const fromIndex = this.model.items.findIndex((c) => c.id === compositeId);
      let toIndex = this.model.items.findIndex((c) => c.id === toCompositeId);
      if (fromIndex >= 0 && toIndex >= 0) {
        if (!before && fromIndex > toIndex) {
          toIndex++;
        }
        if (before && fromIndex < toIndex) {
          toIndex--;
        }
        if (toIndex < this.model.items.length && toIndex >= 0 && toIndex !== fromIndex) {
          if (this.model.move(this.model.items[fromIndex].id, this.model.items[toIndex].id)) {
            setTimeout(() => this.updateCompositeSwitcher(), 0);
          }
        }
      }
    } else {
      if (this.model.move(compositeId, toCompositeId)) {
        setTimeout(() => this.updateCompositeSwitcher(), 0);
      }
    }
  }
  getAction(compositeId) {
    const item = this.model.findItem(compositeId);
    return item?.activityAction;
  }
  computeSizes(items) {
    const size = this.options.compositeSize;
    if (size) {
      items.forEach((composite) => this.compositeSizeInBar.set(composite.id, size));
    } else {
      const compositeSwitcherBar = this.compositeSwitcherBar;
      if (compositeSwitcherBar && this.dimension && this.dimension.height !== 0 && this.dimension.width !== 0) {
        const currentItemsLength = compositeSwitcherBar.viewItems.length;
        compositeSwitcherBar.push(items.map((composite) => composite.activityAction));
        items.map((composite, index) => this.compositeSizeInBar.set(
          composite.id,
          this.options.orientation === ActionsOrientation.VERTICAL ? compositeSwitcherBar.getHeight(currentItemsLength + index) : compositeSwitcherBar.getWidth(currentItemsLength + index)
        ));
        items.forEach(() => compositeSwitcherBar.pull(compositeSwitcherBar.viewItems.length - 1));
      }
    }
  }
  updateCompositeSwitcher(donotTrigger) {
    const compositeSwitcherBar = this.compositeSwitcherBar;
    if (!compositeSwitcherBar || !this.dimension) {
      return;
    }
    let compositesToShow = this.model.visibleItems.filter(
      (item) => item.pinned || this.model.activeItem && this.model.activeItem.id === item.id
      /* Show the active composite even if it is not pinned */
    ).map((item) => item.id);
    let maxVisible = compositesToShow.length;
    const totalComposites = compositesToShow.length;
    let size = 0;
    const limit = this.options.orientation === ActionsOrientation.VERTICAL ? this.dimension.height : this.dimension.width;
    for (let i = 0; i < compositesToShow.length; i++) {
      const compositeSize = this.compositeSizeInBar.get(compositesToShow[i]);
      if (size + compositeSize > limit) {
        maxVisible = i;
        break;
      }
      size += compositeSize;
    }
    if (totalComposites > maxVisible) {
      compositesToShow = compositesToShow.slice(0, maxVisible);
    }
    if (this.model.activeItem && compositesToShow.every((compositeId) => !!this.model.activeItem && compositeId !== this.model.activeItem.id)) {
      size += this.compositeSizeInBar.get(this.model.activeItem.id);
      compositesToShow.push(this.model.activeItem.id);
    }
    while (size > limit && compositesToShow.length) {
      const removedComposite = compositesToShow.length > 1 ? compositesToShow.splice(compositesToShow.length - 2, 1)[0] : compositesToShow.pop();
      size -= this.compositeSizeInBar.get(removedComposite);
    }
    if (totalComposites > compositesToShow.length) {
      size += this.options.overflowActionSize;
    }
    while (size > limit && compositesToShow.length) {
      const removedComposite = compositesToShow.length > 1 && compositesToShow[compositesToShow.length - 1] === this.model.activeItem?.id ? compositesToShow.splice(compositesToShow.length - 2, 1)[0] : compositesToShow.pop();
      size -= this.compositeSizeInBar.get(removedComposite);
    }
    if (totalComposites === compositesToShow.length && this.compositeOverflowAction) {
      compositeSwitcherBar.pull(compositeSwitcherBar.length() - 1);
      this.compositeOverflowAction.dispose();
      this.compositeOverflowAction = void 0;
      this.compositeOverflowActionViewItem?.dispose();
      this.compositeOverflowActionViewItem = void 0;
    }
    const compositesToRemove = [];
    this.visibleComposites.forEach((compositeId, index) => {
      if (!compositesToShow.includes(compositeId)) {
        compositesToRemove.push(index);
      }
    });
    compositesToRemove.reverse().forEach((index) => {
      compositeSwitcherBar.pull(index);
      this.visibleComposites.splice(index, 1);
    });
    compositesToShow.forEach((compositeId, newIndex) => {
      const currentIndex = this.visibleComposites.indexOf(compositeId);
      if (newIndex !== currentIndex) {
        if (currentIndex !== -1) {
          compositeSwitcherBar.pull(currentIndex);
          this.visibleComposites.splice(currentIndex, 1);
        }
        compositeSwitcherBar.push(this.model.findItem(compositeId).activityAction, { label: true, icon: this.options.icon, index: newIndex });
        this.visibleComposites.splice(newIndex, 0, compositeId);
      }
    });
    if (totalComposites > compositesToShow.length && !this.compositeOverflowAction) {
      this.compositeOverflowAction = this._register(this.instantiationService.createInstance(CompositeOverflowActivityAction, () => {
        this.compositeOverflowActionViewItem?.showMenu();
      }));
      this.compositeOverflowActionViewItem = this._register(this.instantiationService.createInstance(
        CompositeOverflowActivityActionViewItem,
        this.compositeOverflowAction,
        () => this.getOverflowingComposites(),
        () => this.model.activeItem ? this.model.activeItem.id : void 0,
        (compositeId) => {
          const item = this.model.findItem(compositeId);
          return item?.activity[0]?.badge;
        },
        this.options.getOnCompositeClickAction,
        this.options.colors,
        this.options.activityHoverOptions
      ));
      compositeSwitcherBar.push(this.compositeOverflowAction, { label: false, icon: true });
    }
    if (!donotTrigger) {
      this._onDidChange.fire();
    }
  }
  getOverflowingComposites() {
    let overflowingIds = this.model.visibleItems.filter((item) => item.pinned).map((item) => item.id);
    if (this.model.activeItem && !this.model.activeItem.pinned) {
      overflowingIds.push(this.model.activeItem.id);
    }
    overflowingIds = overflowingIds.filter((compositeId) => !this.visibleComposites.includes(compositeId));
    return this.model.visibleItems.filter((c) => overflowingIds.includes(c.id)).map((item) => {
      return { id: item.id, name: this.getAction(item.id)?.label || item.name };
    });
  }
  showContextMenu(targetWindow, e) {
    EventHelper.stop(e, true);
    const event = new StandardMouseEvent(targetWindow, e);
    this.contextMenuService.showContextMenu({
      getAnchor: () => event,
      getActions: () => this.getContextMenuActions(e)
    });
  }
  getContextMenuActions(e) {
    const actions = this.model.visibleItems.map(({ id, name, activityAction }) => {
      const isPinned = this.isPinned(id);
      return toAction({
        id,
        label: this.getAction(id).label || name || id,
        checked: isPinned,
        enabled: activityAction.enabled && (!isPinned || this.getPinnedCompositeIds().length > 1),
        run: () => {
          if (this.isPinned(id)) {
            this.unpin(id);
          } else {
            this.pin(id, true);
          }
        }
      });
    });
    this.options.fillExtraContextMenuActions(actions, e);
    return actions;
  }
};
CompositeBar = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IViewDescriptorService)
], CompositeBar);
class CompositeBarModel {
  constructor(items, options) {
    this._items = [];
    this.options = options;
    this.setItems(items);
  }
  get items() {
    return this._items;
  }
  setItems(items) {
    this._items = [];
    this._items = items.map((i) => this.createCompositeBarItem(i.id, i.name, i.order, i.pinned, i.visible));
  }
  get visibleItems() {
    return this.items.filter((item) => item.visible);
  }
  get pinnedItems() {
    return this.items.filter((item) => item.visible && item.pinned);
  }
  createCompositeBarItem(id, name, order, pinned, visible) {
    const options = this.options;
    return {
      id,
      name,
      pinned,
      order,
      visible,
      activity: [],
      get activityAction() {
        return options.getActivityAction(id);
      },
      get pinnedAction() {
        return options.getCompositePinnedAction(id);
      },
      get toggleBadgeAction() {
        return options.getCompositeBadgeAction(id);
      }
    };
  }
  add(id, name, order, requestedIndex) {
    const item = this.findItem(id);
    if (item) {
      let changed = false;
      item.name = name;
      if (!isUndefinedOrNull(order)) {
        changed = item.order !== order;
        item.order = order;
      }
      if (!item.visible) {
        item.visible = true;
        changed = true;
      }
      return changed;
    } else {
      const item2 = this.createCompositeBarItem(id, name, order, true, true);
      if (!isUndefinedOrNull(requestedIndex)) {
        let index = 0;
        let rIndex = requestedIndex;
        while (rIndex > 0 && index < this.items.length) {
          if (this.items[index++].visible) {
            rIndex--;
          }
        }
        this.items.splice(index, 0, item2);
      } else if (isUndefinedOrNull(order)) {
        this.items.push(item2);
      } else {
        let index = 0;
        while (index < this.items.length && typeof this.items[index].order === "number" && this.items[index].order < order) {
          index++;
        }
        this.items.splice(index, 0, item2);
      }
      return true;
    }
  }
  remove(id) {
    for (let index = 0; index < this.items.length; index++) {
      if (this.items[index].id === id) {
        this.items.splice(index, 1);
        return true;
      }
    }
    return false;
  }
  hide(id) {
    for (const item of this.items) {
      if (item.id === id) {
        if (item.visible) {
          item.visible = false;
          return true;
        }
        return false;
      }
    }
    return false;
  }
  move(compositeId, toCompositeId) {
    const fromIndex = this.findIndex(compositeId);
    const toIndex = this.findIndex(toCompositeId);
    if (fromIndex === -1 || toIndex === -1) {
      return false;
    }
    const sourceItem = this.items.splice(fromIndex, 1)[0];
    this.items.splice(toIndex, 0, sourceItem);
    sourceItem.pinned = true;
    return true;
  }
  setPinned(id, pinned) {
    for (const item of this.items) {
      if (item.id === id) {
        if (item.pinned !== pinned) {
          item.pinned = pinned;
          return true;
        }
        return false;
      }
    }
    return false;
  }
  activate(id) {
    if (!this.activeItem || this.activeItem.id !== id) {
      if (this.activeItem) {
        this.deactivate();
      }
      for (const item of this.items) {
        if (item.id === id) {
          this.activeItem = item;
          this.activeItem.activityAction.activate();
          return true;
        }
      }
    }
    return false;
  }
  deactivate() {
    if (this.activeItem) {
      this.activeItem.activityAction.deactivate();
      this.activeItem = void 0;
      return true;
    }
    return false;
  }
  findItem(id) {
    return this.items.filter((item) => item.id === id)[0];
  }
  findIndex(id) {
    for (let index = 0; index < this.items.length; index++) {
      if (this.items[index].id === id) {
        return index;
      }
    }
    return -1;
  }
}
export {
  CompositeBar,
  CompositeDragAndDrop
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9jb21wb3NpdGVCYXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYWN0aXZpdHkvY29tbW9uL2FjdGl2aXR5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyLCBBY3Rpb25zT3JpZW50YXRpb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBDb21wb3NpdGVBY3Rpb25WaWV3SXRlbSwgQ29tcG9zaXRlT3ZlcmZsb3dBY3Rpdml0eUFjdGlvbiwgQ29tcG9zaXRlT3ZlcmZsb3dBY3Rpdml0eUFjdGlvblZpZXdJdGVtLCBDb21wb3NpdGVCYXJBY3Rpb24sIElDb21wb3NpdGVCYXIsIElDb21wb3NpdGVCYXJDb2xvcnMsIElBY3Rpdml0eUhvdmVyT3B0aW9ucyB9IGZyb20gJy4vY29tcG9zaXRlQmFyQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEaW1lbnNpb24sICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgRXZlbnRUeXBlLCBFdmVudEhlbHBlciwgaXNBbmNlc3RvciwgZ2V0V2luZG93IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvd2lkZ2V0LmpzJztcbmltcG9ydCB7IGlzVW5kZWZpbmVkT3JOdWxsIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSUNvbG9yVGhlbWUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGFpbmVyTG9jYXRpb24sIElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGUgfSBmcm9tICcuLi8uLi9jb21tb24vcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBJQ29tcG9zaXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBDb21wb3NpdGVEcmFnQW5kRHJvcERhdGEsIENvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXIsIElEcmFnZ2VkQ29tcG9zaXRlRGF0YSwgSUNvbXBvc2l0ZURyYWdBbmREcm9wLCBCZWZvcmUyRCwgdG9nZ2xlRHJvcEVmZmVjdCwgSUNvbXBvc2l0ZURyYWdBbmREcm9wT2JzZXJ2ZXJDYWxsYmFja3MgfSBmcm9tICcuLi9kbmQuanMnO1xuaW1wb3J0IHsgR2VzdHVyZSwgRXZlbnRUeXBlIGFzIFRvdWNoRXZlbnRUeXBlLCBHZXN0dXJlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdG91Y2guanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDb21wb3NpdGVCYXJJdGVtIHtcblxuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXG5cdG5hbWU/OiBzdHJpbmc7XG5cdHBpbm5lZDogYm9vbGVhbjtcblx0b3JkZXI/OiBudW1iZXI7XG5cdHZpc2libGU6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wb3NpdGVEcmFnQW5kRHJvcCBpbXBsZW1lbnRzIElDb21wb3NpdGVEcmFnQW5kRHJvcCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSB0YXJnZXRDb250YWluZXJMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uLFxuXHRcdHByaXZhdGUgb3JpZW50YXRpb246IEFjdGlvbnNPcmllbnRhdGlvbixcblx0XHRwcml2YXRlIG9wZW5Db21wb3NpdGU6IChpZDogc3RyaW5nLCBmb2N1cz86IGJvb2xlYW4pID0+IFByb21pc2U8SVBhbmVDb21wb3NpdGUgfCBudWxsPixcblx0XHRwcml2YXRlIG1vdmVDb21wb3NpdGU6IChmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcsIGJlZm9yZT86IEJlZm9yZTJEKSA9PiB2b2lkLFxuXHRcdHByaXZhdGUgZ2V0SXRlbXM6ICgpID0+IElDb21wb3NpdGVCYXJJdGVtW11cblx0KSB7IH1cblxuXHRkcm9wKGRhdGE6IENvbXBvc2l0ZURyYWdBbmREcm9wRGF0YSwgdGFyZ2V0Q29tcG9zaXRlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50LCBiZWZvcmU/OiBCZWZvcmUyRCk6IHZvaWQge1xuXHRcdGNvbnN0IGRyYWdEYXRhID0gZGF0YS5nZXREYXRhKCk7XG5cblx0XHRpZiAoZHJhZ0RhdGEudHlwZSA9PT0gJ2NvbXBvc2l0ZScpIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRDb250YWluZXIgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlJZChkcmFnRGF0YS5pZCkhO1xuXHRcdFx0Y29uc3QgY3VycmVudExvY2F0aW9uID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckxvY2F0aW9uKGN1cnJlbnRDb250YWluZXIpO1xuXHRcdFx0bGV0IG1vdmVkID0gZmFsc2U7XG5cblx0XHRcdC8vIC4uLiBvbiB0aGUgc2FtZSBjb21wb3NpdGUgYmFyXG5cdFx0XHRpZiAoY3VycmVudExvY2F0aW9uID09PSB0aGlzLnRhcmdldENvbnRhaW5lckxvY2F0aW9uKSB7XG5cdFx0XHRcdGlmICh0YXJnZXRDb21wb3NpdGVJZCkge1xuXHRcdFx0XHRcdHRoaXMubW92ZUNvbXBvc2l0ZShkcmFnRGF0YS5pZCwgdGFyZ2V0Q29tcG9zaXRlSWQsIGJlZm9yZSk7XG5cdFx0XHRcdFx0bW92ZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyAuLi4gb24gYSBkaWZmZXJlbnQgY29tcG9zaXRlIGJhclxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3Q29udGFpbmVyVG9Mb2NhdGlvbihjdXJyZW50Q29udGFpbmVyLCB0aGlzLnRhcmdldENvbnRhaW5lckxvY2F0aW9uLCB0aGlzLmdldFRhcmdldEluZGV4KHRhcmdldENvbXBvc2l0ZUlkLCBiZWZvcmUpLCAnZG5kJyk7XG5cdFx0XHRcdG1vdmVkID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG1vdmVkKSB7XG5cdFx0XHRcdHRoaXMub3BlbkNvbXBvc2l0ZShjdXJyZW50Q29udGFpbmVyLmlkLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZHJhZ0RhdGEudHlwZSA9PT0gJ3ZpZXcnKSB7XG5cdFx0XHRjb25zdCB2aWV3VG9Nb3ZlID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKGRyYWdEYXRhLmlkKSE7XG5cdFx0XHRpZiAodmlld1RvTW92ZSAmJiB2aWV3VG9Nb3ZlLmNhbk1vdmVWaWV3KSB7XG5cdFx0XHRcdHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm1vdmVWaWV3VG9Mb2NhdGlvbih2aWV3VG9Nb3ZlLCB0aGlzLnRhcmdldENvbnRhaW5lckxvY2F0aW9uLCAnZG5kJyk7XG5cblx0XHRcdFx0Y29uc3QgbmV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKHZpZXdUb01vdmUuaWQpITtcblxuXHRcdFx0XHRpZiAodGFyZ2V0Q29tcG9zaXRlSWQpIHtcblx0XHRcdFx0XHR0aGlzLm1vdmVDb21wb3NpdGUobmV3Q29udGFpbmVyLmlkLCB0YXJnZXRDb21wb3NpdGVJZCwgYmVmb3JlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMub3BlbkNvbXBvc2l0ZShuZXdDb250YWluZXIuaWQsIHRydWUpLnRoZW4oY29tcG9zaXRlID0+IHtcblx0XHRcdFx0XHRjb21wb3NpdGU/Lm9wZW5WaWV3KHZpZXdUb01vdmUuaWQsIHRydWUpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvbkRyYWdFbnRlcihkYXRhOiBDb21wb3NpdGVEcmFnQW5kRHJvcERhdGEsIHRhcmdldENvbXBvc2l0ZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmNhbkRyb3AoZGF0YSwgdGFyZ2V0Q29tcG9zaXRlSWQpO1xuXHR9XG5cblx0b25EcmFnT3ZlcihkYXRhOiBDb21wb3NpdGVEcmFnQW5kRHJvcERhdGEsIHRhcmdldENvbXBvc2l0ZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmNhbkRyb3AoZGF0YSwgdGFyZ2V0Q29tcG9zaXRlSWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRUYXJnZXRJbmRleCh0YXJnZXRJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCBiZWZvcmUyZDogQmVmb3JlMkQgfCB1bmRlZmluZWQpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGFyZ2V0SWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXRlbXMgPSB0aGlzLmdldEl0ZW1zKCk7XG5cdFx0Y29uc3QgYmVmb3JlID0gdGhpcy5vcmllbnRhdGlvbiA9PT0gQWN0aW9uc09yaWVudGF0aW9uLkhPUklaT05UQUwgPyBiZWZvcmUyZD8uaG9yaXpvbnRhbGx5QmVmb3JlIDogYmVmb3JlMmQ/LnZlcnRpY2FsbHlCZWZvcmU7XG5cdFx0cmV0dXJuIGl0ZW1zLmZpbHRlcihpdGVtID0+IGl0ZW0udmlzaWJsZSkuZmluZEluZGV4KGl0ZW0gPT4gaXRlbS5pZCA9PT0gdGFyZ2V0SWQpICsgKGJlZm9yZSA/IDAgOiAxKTtcblx0fVxuXG5cdHByaXZhdGUgY2FuRHJvcChkYXRhOiBDb21wb3NpdGVEcmFnQW5kRHJvcERhdGEsIHRhcmdldENvbXBvc2l0ZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRjb25zdCBkcmFnRGF0YSA9IGRhdGEuZ2V0RGF0YSgpO1xuXG5cdFx0aWYgKGRyYWdEYXRhLnR5cGUgPT09ICdjb21wb3NpdGUnKSB7XG5cblx0XHRcdC8vIERyYWdnaW5nIGEgY29tcG9zaXRlXG5cdFx0XHRjb25zdCBjdXJyZW50Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5SWQoZHJhZ0RhdGEuaWQpITtcblx0XHRcdGNvbnN0IGN1cnJlbnRMb2NhdGlvbiA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJMb2NhdGlvbihjdXJyZW50Q29udGFpbmVyKTtcblxuXHRcdFx0Ly8gLi4uIHRvIHRoZSBzYW1lIGNvbXBvc2l0ZSBsb2NhdGlvblxuXHRcdFx0aWYgKGN1cnJlbnRMb2NhdGlvbiA9PT0gdGhpcy50YXJnZXRDb250YWluZXJMb2NhdGlvbikge1xuXHRcdFx0XHRyZXR1cm4gZHJhZ0RhdGEuaWQgIT09IHRhcmdldENvbXBvc2l0ZUlkO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXG5cdFx0XHQvLyBEcmFnZ2luZyBhbiBpbmRpdmlkdWFsIHZpZXdcblx0XHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKGRyYWdEYXRhLmlkKTtcblxuXHRcdFx0Ly8gLi4uIHRoYXQgY2Fubm90IG1vdmVcblx0XHRcdGlmICghdmlld0Rlc2NyaXB0b3IgfHwgIXZpZXdEZXNjcmlwdG9yLmNhbk1vdmVWaWV3KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gLi4uIHRvIGNyZWF0ZSBhIHZpZXcgY29udGFpbmVyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29tcG9zaXRlQmFyT3B0aW9ucyB7XG5cblx0cmVhZG9ubHkgaWNvbjogYm9vbGVhbjtcblx0cmVhZG9ubHkgb3JpZW50YXRpb246IEFjdGlvbnNPcmllbnRhdGlvbjtcblx0cmVhZG9ubHkgY29sb3JzOiAodGhlbWU6IElDb2xvclRoZW1lKSA9PiBJQ29tcG9zaXRlQmFyQ29sb3JzO1xuXHRyZWFkb25seSBjb21wYWN0PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgY29tcG9zaXRlU2l6ZTogbnVtYmVyO1xuXHRyZWFkb25seSBvdmVyZmxvd0FjdGlvblNpemU6IG51bWJlcjtcblx0cmVhZG9ubHkgZG5kSGFuZGxlcjogSUNvbXBvc2l0ZURyYWdBbmREcm9wO1xuXHRyZWFkb25seSBhY3Rpdml0eUhvdmVyT3B0aW9uczogSUFjdGl2aXR5SG92ZXJPcHRpb25zO1xuXHRyZWFkb25seSBwcmV2ZW50TG9vcE5hdmlnYXRpb24/OiBib29sZWFuO1xuXG5cdHJlYWRvbmx5IGdldEFjdGl2aXR5QWN0aW9uOiAoY29tcG9zaXRlSWQ6IHN0cmluZykgPT4gQ29tcG9zaXRlQmFyQWN0aW9uO1xuXHRyZWFkb25seSBnZXRDb21wb3NpdGVQaW5uZWRBY3Rpb246IChjb21wb3NpdGVJZDogc3RyaW5nKSA9PiBJQWN0aW9uO1xuXHRyZWFkb25seSBnZXRDb21wb3NpdGVCYWRnZUFjdGlvbjogKGNvbXBvc2l0ZUlkOiBzdHJpbmcpID0+IElBY3Rpb247XG5cdHJlYWRvbmx5IGdldE9uQ29tcG9zaXRlQ2xpY2tBY3Rpb246IChjb21wb3NpdGVJZDogc3RyaW5nKSA9PiBJQWN0aW9uO1xuXHRyZWFkb25seSBmaWxsRXh0cmFDb250ZXh0TWVudUFjdGlvbnM6IChhY3Rpb25zOiBJQWN0aW9uW10sIGU/OiBNb3VzZUV2ZW50IHwgR2VzdHVyZUV2ZW50KSA9PiB2b2lkO1xuXHRyZWFkb25seSBnZXRDb250ZXh0TWVudUFjdGlvbnNGb3JDb21wb3NpdGU6IChjb21wb3NpdGVJZDogc3RyaW5nKSA9PiBJQWN0aW9uW107XG5cblx0cmVhZG9ubHkgb3BlbkNvbXBvc2l0ZTogKGNvbXBvc2l0ZUlkOiBzdHJpbmcsIHByZXNlcnZlRm9jdXM/OiBib29sZWFuKSA9PiBQcm9taXNlPElDb21wb3NpdGUgfCBudWxsPjtcblx0cmVhZG9ubHkgZ2V0RGVmYXVsdENvbXBvc2l0ZUlkOiAoKSA9PiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIENvbXBvc2l0ZUJhckRuZENhbGxiYWNrcyBpbXBsZW1lbnRzIElDb21wb3NpdGVEcmFnQW5kRHJvcE9ic2VydmVyQ2FsbGJhY2tzIHtcblxuXHRwcml2YXRlIGluc2VydERyb3BCZWZvcmU6IEJlZm9yZTJEIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29tcG9zaXRlQmFyQ29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGFjdGlvbkJhckNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb21wb3NpdGVCYXJNb2RlbDogQ29tcG9zaXRlQmFyTW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkbmRIYW5kbGVyOiBJQ29tcG9zaXRlRHJhZ0FuZERyb3AsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBvcmllbnRhdGlvbjogQWN0aW9uc09yaWVudGF0aW9uLFxuXHQpIHsgfVxuXG5cdG9uRHJhZ092ZXIoZTogSURyYWdnZWRDb21wb3NpdGVEYXRhKSB7XG5cblx0XHQvLyBkb24ndCBhZGQgZmVlZGJhY2sgaWYgdGhpcyBpcyBvdmVyIHRoZSBjb21wb3NpdGUgYmFyIGFjdGlvbnMgb3IgdGhlcmUgYXJlIG5vIGFjdGlvbnNcblx0XHRjb25zdCB2aXNpYmxlSXRlbXMgPSB0aGlzLmNvbXBvc2l0ZUJhck1vZGVsLnZpc2libGVJdGVtcztcblx0XHRpZiAoIXZpc2libGVJdGVtcy5sZW5ndGggfHwgKGUuZXZlbnREYXRhLnRhcmdldCAmJiBpc0FuY2VzdG9yKGUuZXZlbnREYXRhLnRhcmdldCBhcyBIVE1MRWxlbWVudCwgdGhpcy5hY3Rpb25CYXJDb250YWluZXIpKSkge1xuXHRcdFx0dGhpcy5pbnNlcnREcm9wQmVmb3JlID0gdGhpcy51cGRhdGVGcm9tRHJhZ2dpbmcodGhpcy5jb21wb3NpdGVCYXJDb250YWluZXIsIGZhbHNlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5zZXJ0QXRGcm9udCA9IHRoaXMuaW5zZXJ0QXRGcm9udCh0aGlzLmFjdGlvbkJhckNvbnRhaW5lciwgZS5ldmVudERhdGEpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGluc2VydEF0RnJvbnQgPyB2aXNpYmxlSXRlbXNbMF0gOiB2aXNpYmxlSXRlbXNbdmlzaWJsZUl0ZW1zLmxlbmd0aCAtIDFdO1xuXHRcdGNvbnN0IHZhbGlkRHJvcFRhcmdldCA9IHRoaXMuZG5kSGFuZGxlci5vbkRyYWdPdmVyKGUuZHJhZ0FuZERyb3BEYXRhLCB0YXJnZXQuaWQsIGUuZXZlbnREYXRhKTtcblx0XHR0b2dnbGVEcm9wRWZmZWN0KGUuZXZlbnREYXRhLmRhdGFUcmFuc2ZlciwgJ21vdmUnLCB2YWxpZERyb3BUYXJnZXQpO1xuXHRcdHRoaXMuaW5zZXJ0RHJvcEJlZm9yZSA9IHRoaXMudXBkYXRlRnJvbURyYWdnaW5nKHRoaXMuY29tcG9zaXRlQmFyQ29udGFpbmVyLCB2YWxpZERyb3BUYXJnZXQsIGluc2VydEF0RnJvbnQsIHRydWUpO1xuXHR9XG5cblx0b25EcmFnTGVhdmUoZTogSURyYWdnZWRDb21wb3NpdGVEYXRhKSB7XG5cdFx0dGhpcy5pbnNlcnREcm9wQmVmb3JlID0gdGhpcy51cGRhdGVGcm9tRHJhZ2dpbmcodGhpcy5jb21wb3NpdGVCYXJDb250YWluZXIsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHR9XG5cblx0b25EcmFnRW5kKGU6IElEcmFnZ2VkQ29tcG9zaXRlRGF0YSkge1xuXHRcdHRoaXMuaW5zZXJ0RHJvcEJlZm9yZSA9IHRoaXMudXBkYXRlRnJvbURyYWdnaW5nKHRoaXMuY29tcG9zaXRlQmFyQ29udGFpbmVyLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0fVxuXG5cdG9uRHJvcChlOiBJRHJhZ2dlZENvbXBvc2l0ZURhdGEpIHtcblx0XHRjb25zdCB2aXNpYmxlSXRlbXMgPSB0aGlzLmNvbXBvc2l0ZUJhck1vZGVsLnZpc2libGVJdGVtcztcblx0XHRsZXQgdGFyZ2V0SWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHZpc2libGVJdGVtcy5sZW5ndGgpIHtcblx0XHRcdHRhcmdldElkID0gdGhpcy5pbnNlcnRBdEZyb250KHRoaXMuYWN0aW9uQmFyQ29udGFpbmVyLCBlLmV2ZW50RGF0YSkgPyB2aXNpYmxlSXRlbXNbMF0uaWQgOiB2aXNpYmxlSXRlbXNbdmlzaWJsZUl0ZW1zLmxlbmd0aCAtIDFdLmlkO1xuXHRcdH1cblx0XHR0aGlzLmRuZEhhbmRsZXIuZHJvcChlLmRyYWdBbmREcm9wRGF0YSwgdGFyZ2V0SWQsIGUuZXZlbnREYXRhLCB0aGlzLmluc2VydERyb3BCZWZvcmUpO1xuXHRcdHRoaXMuaW5zZXJ0RHJvcEJlZm9yZSA9IHRoaXMudXBkYXRlRnJvbURyYWdnaW5nKHRoaXMuY29tcG9zaXRlQmFyQ29udGFpbmVyLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgaW5zZXJ0QXRGcm9udChlbGVtZW50OiBIVE1MRWxlbWVudCwgZXZlbnQ6IERyYWdFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGNvbnN0IHBvc1ggPSBldmVudC5jbGllbnRYO1xuXHRcdGNvbnN0IHBvc1kgPSBldmVudC5jbGllbnRZO1xuXG5cdFx0c3dpdGNoICh0aGlzLm9yaWVudGF0aW9uKSB7XG5cdFx0XHRjYXNlIEFjdGlvbnNPcmllbnRhdGlvbi5IT1JJWk9OVEFMOlxuXHRcdFx0XHRyZXR1cm4gcG9zWCA8IHJlY3QubGVmdDtcblx0XHRcdGNhc2UgQWN0aW9uc09yaWVudGF0aW9uLlZFUlRJQ0FMOlxuXHRcdFx0XHRyZXR1cm4gcG9zWSA8IHJlY3QudG9wO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRnJvbURyYWdnaW5nKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBzaG93RmVlZGJhY2s6IGJvb2xlYW4sIGZyb250OiBib29sZWFuLCBpc0RyYWdnaW5nOiBib29sZWFuKTogQmVmb3JlMkQgfCB1bmRlZmluZWQge1xuXHRcdGVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnZHJhZ2dlZC1vdmVyJywgaXNEcmFnZ2luZyk7XG5cdFx0ZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdkcmFnZ2VkLW92ZXItaGVhZCcsIHNob3dGZWVkYmFjayAmJiBmcm9udCk7XG5cdFx0ZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdkcmFnZ2VkLW92ZXItdGFpbCcsIHNob3dGZWVkYmFjayAmJiAhZnJvbnQpO1xuXG5cdFx0aWYgKCFzaG93RmVlZGJhY2spIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgdmVydGljYWxseUJlZm9yZTogZnJvbnQsIGhvcml6b250YWxseUJlZm9yZTogZnJvbnQgfTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29tcG9zaXRlQmFyIGV4dGVuZHMgV2lkZ2V0IGltcGxlbWVudHMgSUNvbXBvc2l0ZUJhciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIGRpbWVuc2lvbjogRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgY29tcG9zaXRlU3dpdGNoZXJCYXI6IEFjdGlvbkJhciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjb21wb3NpdGVPdmVyZmxvd0FjdGlvbjogQ29tcG9zaXRlT3ZlcmZsb3dBY3Rpdml0eUFjdGlvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjb21wb3NpdGVPdmVyZmxvd0FjdGlvblZpZXdJdGVtOiBDb21wb3NpdGVPdmVyZmxvd0FjdGl2aXR5QWN0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBtb2RlbDogQ29tcG9zaXRlQmFyTW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgdmlzaWJsZUNvbXBvc2l0ZXM6IHN0cmluZ1tdO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbXBvc2l0ZVNpemVJbkJhcjogTWFwPHN0cmluZywgbnVtYmVyPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpdGVtczogSUNvbXBvc2l0ZUJhckl0ZW1bXSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IElDb21wb3NpdGVCYXJPcHRpb25zLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5tb2RlbCA9IG5ldyBDb21wb3NpdGVCYXJNb2RlbChpdGVtcywgb3B0aW9ucyk7XG5cdFx0dGhpcy52aXNpYmxlQ29tcG9zaXRlcyA9IFtdO1xuXHRcdHRoaXMuY29tcG9zaXRlU2l6ZUluQmFyID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHR0aGlzLmNvbXB1dGVTaXplcyh0aGlzLm1vZGVsLnZpc2libGVJdGVtcyk7XG5cdH1cblxuXHRnZXRDb21wb3NpdGVCYXJJdGVtcygpOiBJQ29tcG9zaXRlQmFySXRlbVtdIHtcblx0XHRyZXR1cm4gWy4uLnRoaXMubW9kZWwuaXRlbXNdO1xuXHR9XG5cblx0c2V0Q29tcG9zaXRlQmFySXRlbXMoaXRlbXM6IElDb21wb3NpdGVCYXJJdGVtW10pOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLnNldEl0ZW1zKGl0ZW1zKTtcblx0XHR0aGlzLnVwZGF0ZUNvbXBvc2l0ZVN3aXRjaGVyKHRydWUpO1xuXHR9XG5cblx0Z2V0UGlubmVkQ29tcG9zaXRlcygpOiBJQ29tcG9zaXRlQmFySXRlbVtdIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RlbC5waW5uZWRJdGVtcztcblx0fVxuXG5cdGdldFBpbm5lZENvbXBvc2l0ZUlkcygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0UGlubmVkQ29tcG9zaXRlcygpLm1hcChjID0+IGMuaWQpO1xuXHR9XG5cblx0Z2V0VmlzaWJsZUNvbXBvc2l0ZXMoKTogSUNvbXBvc2l0ZUJhckl0ZW1bXSB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwudmlzaWJsZUl0ZW1zO1xuXHR9XG5cblx0Y3JlYXRlKHBhcmVudDogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgYWN0aW9uQmFyRGl2ID0gcGFyZW50LmFwcGVuZENoaWxkKCQoJy5jb21wb3NpdGUtYmFyJykpO1xuXHRcdHRoaXMuY29tcG9zaXRlU3dpdGNoZXJCYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uQmFyKGFjdGlvbkJhckRpdiwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgQ29tcG9zaXRlT3ZlcmZsb3dBY3Rpdml0eUFjdGlvbikge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmNvbXBvc2l0ZU92ZXJmbG93QWN0aW9uVmlld0l0ZW07XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMubW9kZWwuZmluZEl0ZW0oYWN0aW9uLmlkKTtcblx0XHRcdFx0cmV0dXJuIGl0ZW0gJiYgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0XHRDb21wb3NpdGVBY3Rpb25WaWV3SXRlbSxcblx0XHRcdFx0XHR7IC4uLm9wdGlvbnMsIGRyYWdnYWJsZTogdHJ1ZSwgY29sb3JzOiB0aGlzLm9wdGlvbnMuY29sb3JzLCBpY29uOiB0aGlzLm9wdGlvbnMuaWNvbiwgaG92ZXJPcHRpb25zOiB0aGlzLm9wdGlvbnMuYWN0aXZpdHlIb3Zlck9wdGlvbnMsIGNvbXBhY3Q6IHRoaXMub3B0aW9ucy5jb21wYWN0IH0sXG5cdFx0XHRcdFx0YWN0aW9uIGFzIENvbXBvc2l0ZUJhckFjdGlvbixcblx0XHRcdFx0XHRpdGVtLnBpbm5lZEFjdGlvbixcblx0XHRcdFx0XHRpdGVtLnRvZ2dsZUJhZGdlQWN0aW9uLFxuXHRcdFx0XHRcdGNvbXBvc2l0ZUlkID0+IHRoaXMub3B0aW9ucy5nZXRDb250ZXh0TWVudUFjdGlvbnNGb3JDb21wb3NpdGUoY29tcG9zaXRlSWQpLFxuXHRcdFx0XHRcdCgpID0+IHRoaXMuZ2V0Q29udGV4dE1lbnVBY3Rpb25zKCksXG5cdFx0XHRcdFx0dGhpcy5vcHRpb25zLmRuZEhhbmRsZXIsXG5cdFx0XHRcdFx0dGhpc1xuXHRcdFx0XHQpO1xuXHRcdFx0fSxcblx0XHRcdG9yaWVudGF0aW9uOiB0aGlzLm9wdGlvbnMub3JpZW50YXRpb24sXG5cdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdhY3Rpdml0eUJhckFyaWFMYWJlbCcsIFwiQWN0aXZlIFZpZXcgU3dpdGNoZXJcIiksXG5cdFx0XHRhcmlhUm9sZTogJ3RhYmxpc3QnLFxuXHRcdFx0cHJldmVudExvb3BOYXZpZ2F0aW9uOiB0aGlzLm9wdGlvbnMucHJldmVudExvb3BOYXZpZ2F0aW9uLFxuXHRcdFx0dHJpZ2dlcktleXM6IHsga2V5RG93bjogdHJ1ZSB9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gQ29udGV4dG1lbnUgZm9yIGNvbXBvc2l0ZXNcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIocGFyZW50LCBFdmVudFR5cGUuQ09OVEVYVF9NRU5VLCBlID0+IHRoaXMuc2hvd0NvbnRleHRNZW51KGdldFdpbmRvdyhwYXJlbnQpLCBlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEdlc3R1cmUuYWRkVGFyZ2V0KHBhcmVudCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihwYXJlbnQsIFRvdWNoRXZlbnRUeXBlLkNvbnRleHRtZW51LCBlID0+IHRoaXMuc2hvd0NvbnRleHRNZW51KGdldFdpbmRvdyhwYXJlbnQpLCBlKSkpO1xuXG5cdFx0Ly8gUmVnaXN0ZXIgYSBkcm9wIHRhcmdldCBvbiB0aGUgd2hvbGUgYmFyIHRvIHByZXZlbnQgZm9yYmlkZGVuIGZlZWRiYWNrXG5cdFx0Y29uc3QgZG5kQ2FsbGJhY2sgPSBuZXcgQ29tcG9zaXRlQmFyRG5kQ2FsbGJhY2tzKHBhcmVudCwgYWN0aW9uQmFyRGl2LCB0aGlzLm1vZGVsLCB0aGlzLm9wdGlvbnMuZG5kSGFuZGxlciwgdGhpcy5vcHRpb25zLm9yaWVudGF0aW9uKTtcblx0XHR0aGlzLl9yZWdpc3RlcihDb21wb3NpdGVEcmFnQW5kRHJvcE9ic2VydmVyLklOU1RBTkNFLnJlZ2lzdGVyVGFyZ2V0KHBhcmVudCwgZG5kQ2FsbGJhY2spKTtcblxuXHRcdHJldHVybiBhY3Rpb25CYXJEaXY7XG5cdH1cblxuXHRmb2N1cyhpbmRleD86IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuY29tcG9zaXRlU3dpdGNoZXJCYXI/LmZvY3VzKGluZGV4KTtcblx0fVxuXG5cdHJlY29tcHV0ZVNpemVzKCk6IHZvaWQge1xuXHRcdHRoaXMuY29tcHV0ZVNpemVzKHRoaXMubW9kZWwudmlzaWJsZUl0ZW1zKTtcblx0XHR0aGlzLnVwZGF0ZUNvbXBvc2l0ZVN3aXRjaGVyKCk7XG5cdH1cblxuXHRsYXlvdXQoZGltZW5zaW9uOiBEaW1lbnNpb24pOiB2b2lkIHtcblx0XHR0aGlzLmRpbWVuc2lvbiA9IGRpbWVuc2lvbjtcblxuXHRcdGlmIChkaW1lbnNpb24uaGVpZ2h0ID09PSAwIHx8IGRpbWVuc2lvbi53aWR0aCA9PT0gMCkge1xuXHRcdFx0Ly8gRG8gbm90IGxheW91dCBpZiBub3QgdmlzaWJsZS4gT3RoZXJ3aXNlIHRoZSBzaXplIG1lYXN1cm1lbnQgd291bGQgYmUgY29tcHV0ZWQgd3JvbmdseVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNvbXBvc2l0ZVNpemVJbkJhci5zaXplID09PSAwKSB7XG5cdFx0XHQvLyBDb21wdXRlIHNpemUgb2YgZWFjaCBjb21wb3NpdGUgYnkgZ2V0dGluZyB0aGUgc2l6ZSBmcm9tIHRoZSBjc3MgcmVuZGVyZXJcblx0XHRcdC8vIFNpemUgaXMgbGF0ZXIgdXNlZCBmb3Igb3ZlcmZsb3cgY29tcHV0YXRpb25cblx0XHRcdHRoaXMuY29tcHV0ZVNpemVzKHRoaXMubW9kZWwudmlzaWJsZUl0ZW1zKTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZUNvbXBvc2l0ZVN3aXRjaGVyKCk7XG5cdH1cblxuXHRhZGRDb21wb3NpdGUoeyBpZCwgbmFtZSwgb3JkZXIsIHJlcXVlc3RlZEluZGV4IH06IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBvcmRlcj86IG51bWJlcjsgcmVxdWVzdGVkSW5kZXg/OiBudW1iZXIgfSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLm1vZGVsLmFkZChpZCwgbmFtZSwgb3JkZXIsIHJlcXVlc3RlZEluZGV4KSkge1xuXHRcdFx0dGhpcy5jb21wdXRlU2l6ZXMoW3RoaXMubW9kZWwuZmluZEl0ZW0oaWQpXSk7XG5cdFx0XHR0aGlzLnVwZGF0ZUNvbXBvc2l0ZVN3aXRjaGVyKCk7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlQ29tcG9zaXRlKGlkOiBzdHJpbmcpOiB2b2lkIHtcblxuXHRcdC8vIElmIGl0IHBpbm5lZCwgdW5waW4gaXQgZmlyc3Rcblx0XHRpZiAodGhpcy5pc1Bpbm5lZChpZCkpIHtcblx0XHRcdHRoaXMudW5waW4oaWQpO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBmcm9tIHRoZSBtb2RlbFxuXHRcdGlmICh0aGlzLm1vZGVsLnJlbW92ZShpZCkpIHtcblx0XHRcdHRoaXMudXBkYXRlQ29tcG9zaXRlU3dpdGNoZXIoKTtcblx0XHR9XG5cdH1cblxuXHRoaWRlQ29tcG9zaXRlKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5tb2RlbC5oaWRlKGlkKSkge1xuXHRcdFx0dGhpcy5yZXNldEFjdGl2ZUNvbXBvc2l0ZShpZCk7XG5cdFx0XHR0aGlzLnVwZGF0ZUNvbXBvc2l0ZVN3aXRjaGVyKCk7XG5cdFx0fVxuXHR9XG5cblx0YWN0aXZhdGVDb21wb3NpdGUoaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHByZXZpb3VzQWN0aXZlSXRlbSA9IHRoaXMubW9kZWwuYWN0aXZlSXRlbTtcblx0XHRpZiAodGhpcy5tb2RlbC5hY3RpdmF0ZShpZCkpIHtcblx0XHRcdC8vIFVwZGF0ZSBpZiBjdXJyZW50IGNvbXBvc2l0ZSBpcyBuZWl0aGVyIHZpc2libGUgbm9yIHBpbm5lZFxuXHRcdFx0Ly8gb3IgcHJldmlvdXMgYWN0aXZlIGNvbXBvc2l0ZSBpcyBub3QgcGlubmVkXG5cdFx0XHRpZiAodGhpcy52aXNpYmxlQ29tcG9zaXRlcy5pbmRleE9mKGlkKSA9PT0gLSAxIHx8ICghIXRoaXMubW9kZWwuYWN0aXZlSXRlbSAmJiAhdGhpcy5tb2RlbC5hY3RpdmVJdGVtLnBpbm5lZCkgfHwgKHByZXZpb3VzQWN0aXZlSXRlbSAmJiAhcHJldmlvdXNBY3RpdmVJdGVtLnBpbm5lZCkpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVDb21wb3NpdGVTd2l0Y2hlcigpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGRlYWN0aXZhdGVDb21wb3NpdGUoaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHByZXZpb3VzQWN0aXZlSXRlbSA9IHRoaXMubW9kZWwuYWN0aXZlSXRlbTtcblx0XHRpZiAodGhpcy5tb2RlbC5kZWFjdGl2YXRlKCkpIHtcblx0XHRcdGlmIChwcmV2aW91c0FjdGl2ZUl0ZW0gJiYgIXByZXZpb3VzQWN0aXZlSXRlbS5waW5uZWQpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVDb21wb3NpdGVTd2l0Y2hlcigpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHBpbihjb21wb3NpdGVJZDogc3RyaW5nLCBvcGVuPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLm1vZGVsLnNldFBpbm5lZChjb21wb3NpdGVJZCwgdHJ1ZSkpIHtcblx0XHRcdHRoaXMudXBkYXRlQ29tcG9zaXRlU3dpdGNoZXIoKTtcblxuXHRcdFx0aWYgKG9wZW4pIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5vcHRpb25zLm9wZW5Db21wb3NpdGUoY29tcG9zaXRlSWQpO1xuXHRcdFx0XHR0aGlzLmFjdGl2YXRlQ29tcG9zaXRlKGNvbXBvc2l0ZUlkKTsgLy8gQWN0aXZhdGUgYWZ0ZXIgb3BlbmluZ1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHVucGluKGNvbXBvc2l0ZUlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5tb2RlbC5zZXRQaW5uZWQoY29tcG9zaXRlSWQsIGZhbHNlKSkge1xuXG5cdFx0XHR0aGlzLnVwZGF0ZUNvbXBvc2l0ZVN3aXRjaGVyKCk7XG5cblx0XHRcdHRoaXMucmVzZXRBY3RpdmVDb21wb3NpdGUoY29tcG9zaXRlSWQpO1xuXHRcdH1cblx0fVxuXG5cdGFyZUJhZGdlc0VuYWJsZWQoY29tcG9zaXRlSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQmFkZ2VFbmFibGVtZW50U3RhdGUoY29tcG9zaXRlSWQpO1xuXHR9XG5cblx0dG9nZ2xlQmFkZ2VFbmFibGVtZW50KGNvbXBvc2l0ZUlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5zZXRWaWV3Q29udGFpbmVyQmFkZ2VFbmFibGVtZW50U3RhdGUoY29tcG9zaXRlSWQsICF0aGlzLmFyZUJhZGdlc0VuYWJsZWQoY29tcG9zaXRlSWQpKTtcblx0XHR0aGlzLnVwZGF0ZUNvbXBvc2l0ZVN3aXRjaGVyKCk7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMubW9kZWwuZmluZEl0ZW0oY29tcG9zaXRlSWQpO1xuXHRcdGlmIChpdGVtKSB7XG5cdFx0XHQvLyBUT0RPIEBscmFtb3MxNSBob3cgZG8gd2UgdGVsbCB0aGUgYWN0aXZpdHkgdG8gcmUtcmVuZGVyIHRoZSBiYWRnZT8gVGhpcyB0cmlnZ2VycyBhbiBvbkRpZENoYW5nZSBidXQgaXNuJ3QgdGhlIHJpZ2h0IHdheSB0byBkbyBpdC5cblx0XHRcdC8vIEkgY291bGQgYWRkIGFub3RoZXIgc3BlY2lmaWMgZnVuY3Rpb24gbGlrZSBgYWN0aXZpdHkudXBkYXRlQmFkZ2VFbmFibGVtZW50YCB3b3VsZCB0aGVuIHRoZSBhY3Rpdml0eSBzdG9yZSB0aGUgc2F0ZT9cblx0XHRcdGl0ZW0uYWN0aXZpdHlBY3Rpb24uYWN0aXZpdGllcyA9IGl0ZW0uYWN0aXZpdHlBY3Rpb24uYWN0aXZpdGllcztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlc2V0QWN0aXZlQ29tcG9zaXRlKGNvbXBvc2l0ZUlkOiBzdHJpbmcpIHtcblx0XHRjb25zdCBkZWZhdWx0Q29tcG9zaXRlSWQgPSB0aGlzLm9wdGlvbnMuZ2V0RGVmYXVsdENvbXBvc2l0ZUlkKCk7XG5cblx0XHQvLyBDYXNlOiBjb21wb3NpdGUgaXMgbm90IHRoZSBhY3RpdmUgb25lIG9yIHRoZSBhY3RpdmUgb25lIGlzIGEgZGlmZmVyZW50IG9uZVxuXHRcdC8vIFNvbHY6IHdlIGRvIG5vdGhpbmdcblx0XHRpZiAoIXRoaXMubW9kZWwuYWN0aXZlSXRlbSB8fCB0aGlzLm1vZGVsLmFjdGl2ZUl0ZW0uaWQgIT09IGNvbXBvc2l0ZUlkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRGVhY3RpdmF0ZSBpdHNlbGZcblx0XHR0aGlzLmRlYWN0aXZhdGVDb21wb3NpdGUoY29tcG9zaXRlSWQpO1xuXG5cdFx0Ly8gQ2FzZTogY29tcG9zaXRlIGlzIG5vdCB0aGUgZGVmYXVsdCBjb21wb3NpdGUgYW5kIGRlZmF1bHQgY29tcG9zaXRlIGlzIHN0aWxsIHNob3dpbmdcblx0XHQvLyBTb2x2OiB3ZSBvcGVuIHRoZSBkZWZhdWx0IGNvbXBvc2l0ZVxuXHRcdGlmIChkZWZhdWx0Q29tcG9zaXRlSWQgJiYgZGVmYXVsdENvbXBvc2l0ZUlkICE9PSBjb21wb3NpdGVJZCAmJiB0aGlzLmlzUGlubmVkKGRlZmF1bHRDb21wb3NpdGVJZCkpIHtcblx0XHRcdHRoaXMub3B0aW9ucy5vcGVuQ29tcG9zaXRlKGRlZmF1bHRDb21wb3NpdGVJZCwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2FzZTogd2UgY2xvc2VkIHRoZSBkZWZhdWx0IGNvbXBvc2l0ZVxuXHRcdC8vIFNvbHY6IHdlIG9wZW4gdGhlIG5leHQgdmlzaWJsZSBjb21wb3NpdGUgZnJvbSB0b3Bcblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IHZpc2libGVDb21wb3NpdGUgPSB0aGlzLnZpc2libGVDb21wb3NpdGVzLmZpbmQoY2lkID0+IGNpZCAhPT0gY29tcG9zaXRlSWQpO1xuXHRcdFx0aWYgKHZpc2libGVDb21wb3NpdGUpIHtcblx0XHRcdFx0dGhpcy5vcHRpb25zLm9wZW5Db21wb3NpdGUodmlzaWJsZUNvbXBvc2l0ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aXNQaW5uZWQoY29tcG9zaXRlSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGl0ZW0gPSB0aGlzLm1vZGVsLmZpbmRJdGVtKGNvbXBvc2l0ZUlkKTtcblx0XHRyZXR1cm4gaXRlbT8ucGlubmVkO1xuXHR9XG5cblx0bW92ZShjb21wb3NpdGVJZDogc3RyaW5nLCB0b0NvbXBvc2l0ZUlkOiBzdHJpbmcsIGJlZm9yZT86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoYmVmb3JlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IGZyb21JbmRleCA9IHRoaXMubW9kZWwuaXRlbXMuZmluZEluZGV4KGMgPT4gYy5pZCA9PT0gY29tcG9zaXRlSWQpO1xuXHRcdFx0bGV0IHRvSW5kZXggPSB0aGlzLm1vZGVsLml0ZW1zLmZpbmRJbmRleChjID0+IGMuaWQgPT09IHRvQ29tcG9zaXRlSWQpO1xuXG5cdFx0XHRpZiAoZnJvbUluZGV4ID49IDAgJiYgdG9JbmRleCA+PSAwKSB7XG5cdFx0XHRcdGlmICghYmVmb3JlICYmIGZyb21JbmRleCA+IHRvSW5kZXgpIHtcblx0XHRcdFx0XHR0b0luZGV4Kys7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYmVmb3JlICYmIGZyb21JbmRleCA8IHRvSW5kZXgpIHtcblx0XHRcdFx0XHR0b0luZGV4LS07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodG9JbmRleCA8IHRoaXMubW9kZWwuaXRlbXMubGVuZ3RoICYmIHRvSW5kZXggPj0gMCAmJiB0b0luZGV4ICE9PSBmcm9tSW5kZXgpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5tb2RlbC5tb3ZlKHRoaXMubW9kZWwuaXRlbXNbZnJvbUluZGV4XS5pZCwgdGhpcy5tb2RlbC5pdGVtc1t0b0luZGV4XS5pZCkpIHtcblx0XHRcdFx0XHRcdC8vIHRpbWVvdXQgaGVscHMgdG8gcHJldmVudCBhcnRpZmFjdHMgZnJvbSBzaG93aW5nIHVwXG5cdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMudXBkYXRlQ29tcG9zaXRlU3dpdGNoZXIoKSwgMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLm1vZGVsLm1vdmUoY29tcG9zaXRlSWQsIHRvQ29tcG9zaXRlSWQpKSB7XG5cdFx0XHRcdC8vIHRpbWVvdXQgaGVscHMgdG8gcHJldmVudCBhcnRpZmFjdHMgZnJvbSBzaG93aW5nIHVwXG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4gdGhpcy51cGRhdGVDb21wb3NpdGVTd2l0Y2hlcigpLCAwKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRBY3Rpb24oY29tcG9zaXRlSWQ6IHN0cmluZyk6IENvbXBvc2l0ZUJhckFjdGlvbiB7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMubW9kZWwuZmluZEl0ZW0oY29tcG9zaXRlSWQpO1xuXG5cdFx0cmV0dXJuIGl0ZW0/LmFjdGl2aXR5QWN0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBjb21wdXRlU2l6ZXMoaXRlbXM6IElDb21wb3NpdGVCYXJNb2RlbEl0ZW1bXSk6IHZvaWQge1xuXHRcdGNvbnN0IHNpemUgPSB0aGlzLm9wdGlvbnMuY29tcG9zaXRlU2l6ZTtcblx0XHRpZiAoc2l6ZSkge1xuXHRcdFx0aXRlbXMuZm9yRWFjaChjb21wb3NpdGUgPT4gdGhpcy5jb21wb3NpdGVTaXplSW5CYXIuc2V0KGNvbXBvc2l0ZS5pZCwgc2l6ZSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBjb21wb3NpdGVTd2l0Y2hlckJhciA9IHRoaXMuY29tcG9zaXRlU3dpdGNoZXJCYXI7XG5cdFx0XHRpZiAoY29tcG9zaXRlU3dpdGNoZXJCYXIgJiYgdGhpcy5kaW1lbnNpb24gJiYgdGhpcy5kaW1lbnNpb24uaGVpZ2h0ICE9PSAwICYmIHRoaXMuZGltZW5zaW9uLndpZHRoICE9PSAwKSB7XG5cblx0XHRcdFx0Ly8gQ29tcHV0ZSBzaXplcyBvbmx5IGlmIHZpc2libGUuIE90aGVyd2lzZSB0aGUgc2l6ZSBtZWFzdXJtZW50IHdvdWxkIGJlIGNvbXB1dGVkIHdyb25nbHkuXG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRJdGVtc0xlbmd0aCA9IGNvbXBvc2l0ZVN3aXRjaGVyQmFyLnZpZXdJdGVtcy5sZW5ndGg7XG5cdFx0XHRcdGNvbXBvc2l0ZVN3aXRjaGVyQmFyLnB1c2goaXRlbXMubWFwKGNvbXBvc2l0ZSA9PiBjb21wb3NpdGUuYWN0aXZpdHlBY3Rpb24pKTtcblx0XHRcdFx0aXRlbXMubWFwKChjb21wb3NpdGUsIGluZGV4KSA9PiB0aGlzLmNvbXBvc2l0ZVNpemVJbkJhci5zZXQoY29tcG9zaXRlLmlkLCB0aGlzLm9wdGlvbnMub3JpZW50YXRpb24gPT09IEFjdGlvbnNPcmllbnRhdGlvbi5WRVJUSUNBTFxuXHRcdFx0XHRcdD8gY29tcG9zaXRlU3dpdGNoZXJCYXIuZ2V0SGVpZ2h0KGN1cnJlbnRJdGVtc0xlbmd0aCArIGluZGV4KVxuXHRcdFx0XHRcdDogY29tcG9zaXRlU3dpdGNoZXJCYXIuZ2V0V2lkdGgoY3VycmVudEl0ZW1zTGVuZ3RoICsgaW5kZXgpXG5cdFx0XHRcdCkpO1xuXHRcdFx0XHRpdGVtcy5mb3JFYWNoKCgpID0+IGNvbXBvc2l0ZVN3aXRjaGVyQmFyLnB1bGwoY29tcG9zaXRlU3dpdGNoZXJCYXIudmlld0l0ZW1zLmxlbmd0aCAtIDEpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbXBvc2l0ZVN3aXRjaGVyKGRvbm90VHJpZ2dlcj86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBjb21wb3NpdGVTd2l0Y2hlckJhciA9IHRoaXMuY29tcG9zaXRlU3dpdGNoZXJCYXI7XG5cdFx0aWYgKCFjb21wb3NpdGVTd2l0Y2hlckJhciB8fCAhdGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdHJldHVybjsgLy8gV2UgaGF2ZSBub3QgYmVlbiByZW5kZXJlZCB5ZXQgc28gdGhlcmUgaXMgbm90aGluZyB0byB1cGRhdGUuXG5cdFx0fVxuXG5cdFx0bGV0IGNvbXBvc2l0ZXNUb1Nob3cgPSB0aGlzLm1vZGVsLnZpc2libGVJdGVtcy5maWx0ZXIoaXRlbSA9PlxuXHRcdFx0aXRlbS5waW5uZWRcblx0XHRcdHx8ICh0aGlzLm1vZGVsLmFjdGl2ZUl0ZW0gJiYgdGhpcy5tb2RlbC5hY3RpdmVJdGVtLmlkID09PSBpdGVtLmlkKSAvKiBTaG93IHRoZSBhY3RpdmUgY29tcG9zaXRlIGV2ZW4gaWYgaXQgaXMgbm90IHBpbm5lZCAqL1xuXHRcdCkubWFwKGl0ZW0gPT4gaXRlbS5pZCk7XG5cblx0XHQvLyBFbnN1cmUgd2UgYXJlIG5vdCBzaG93aW5nIG1vcmUgY29tcG9zaXRlcyB0aGFuIHdlIGhhdmUgaGVpZ2h0IGZvclxuXHRcdGxldCBtYXhWaXNpYmxlID0gY29tcG9zaXRlc1RvU2hvdy5sZW5ndGg7XG5cdFx0Y29uc3QgdG90YWxDb21wb3NpdGVzID0gY29tcG9zaXRlc1RvU2hvdy5sZW5ndGg7XG5cdFx0bGV0IHNpemUgPSAwO1xuXHRcdGNvbnN0IGxpbWl0ID0gdGhpcy5vcHRpb25zLm9yaWVudGF0aW9uID09PSBBY3Rpb25zT3JpZW50YXRpb24uVkVSVElDQUwgPyB0aGlzLmRpbWVuc2lvbi5oZWlnaHQgOiB0aGlzLmRpbWVuc2lvbi53aWR0aDtcblxuXHRcdC8vIEFkZCBjb21wb3NpdGVzIHdoaWxlIHRoZXkgZml0XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb21wb3NpdGVzVG9TaG93Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBjb21wb3NpdGVTaXplID0gdGhpcy5jb21wb3NpdGVTaXplSW5CYXIuZ2V0KGNvbXBvc2l0ZXNUb1Nob3dbaV0pITtcblx0XHRcdC8vIEFkZGluZyB0aGlzIGNvbXBvc2l0ZSB3aWxsIG92ZXJmbG93IGF2YWlsYWJsZSBzaXplLCBzbyBkb24ndFxuXHRcdFx0aWYgKHNpemUgKyBjb21wb3NpdGVTaXplID4gbGltaXQpIHtcblx0XHRcdFx0bWF4VmlzaWJsZSA9IGk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRzaXplICs9IGNvbXBvc2l0ZVNpemU7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIHRoZSB0YWlsIG9mIGNvbXBvc2l0ZXMgdGhhdCBkaWQgbm90IGZpdFxuXHRcdGlmICh0b3RhbENvbXBvc2l0ZXMgPiBtYXhWaXNpYmxlKSB7XG5cdFx0XHRjb21wb3NpdGVzVG9TaG93ID0gY29tcG9zaXRlc1RvU2hvdy5zbGljZSgwLCBtYXhWaXNpYmxlKTtcblx0XHR9XG5cblx0XHQvLyBXZSBhbHdheXMgdHJ5IHNob3cgdGhlIGFjdGl2ZSBjb21wb3NpdGUsIHNvIHJlLWFkZCBpdCBpZiBpdCB3YXMgc2xpY2VkIG91dFxuXHRcdGlmICh0aGlzLm1vZGVsLmFjdGl2ZUl0ZW0gJiYgY29tcG9zaXRlc1RvU2hvdy5ldmVyeShjb21wb3NpdGVJZCA9PiAhIXRoaXMubW9kZWwuYWN0aXZlSXRlbSAmJiBjb21wb3NpdGVJZCAhPT0gdGhpcy5tb2RlbC5hY3RpdmVJdGVtLmlkKSkge1xuXHRcdFx0c2l6ZSArPSB0aGlzLmNvbXBvc2l0ZVNpemVJbkJhci5nZXQodGhpcy5tb2RlbC5hY3RpdmVJdGVtLmlkKSE7XG5cdFx0XHRjb21wb3NpdGVzVG9TaG93LnB1c2godGhpcy5tb2RlbC5hY3RpdmVJdGVtLmlkKTtcblx0XHR9XG5cblx0XHQvLyBUaGUgYWN0aXZlIGNvbXBvc2l0ZSBtaWdodCBoYXZlIHB1c2hlZCB1cyBvdmVyIHRoZSBsaW1pdFxuXHRcdC8vIEtlZXAgcG9wcGluZyB0aGUgY29tcG9zaXRlIGJlZm9yZSB0aGUgYWN0aXZlIG9uZSB1bnRpbCBpdCBmaXRzXG5cdFx0Ly8gSWYgZXZlbiB0aGUgYWN0aXZlIG9uZSBkb2Vzbid0IGZpdCwgd2Ugd2lsbCByZXNvcnQgdG8gb3ZlcmZsb3dcblx0XHR3aGlsZSAoc2l6ZSA+IGxpbWl0ICYmIGNvbXBvc2l0ZXNUb1Nob3cubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCByZW1vdmVkQ29tcG9zaXRlID0gY29tcG9zaXRlc1RvU2hvdy5sZW5ndGggPiAxID8gY29tcG9zaXRlc1RvU2hvdy5zcGxpY2UoY29tcG9zaXRlc1RvU2hvdy5sZW5ndGggLSAyLCAxKVswXSA6IGNvbXBvc2l0ZXNUb1Nob3cucG9wKCk7XG5cdFx0XHRzaXplIC09IHRoaXMuY29tcG9zaXRlU2l6ZUluQmFyLmdldChyZW1vdmVkQ29tcG9zaXRlISkhO1xuXHRcdH1cblxuXHRcdC8vIFdlIGFyZSBvdmVyZmxvd2luZywgYWRkIHRoZSBvdmVyZmxvdyBzaXplXG5cdFx0aWYgKHRvdGFsQ29tcG9zaXRlcyA+IGNvbXBvc2l0ZXNUb1Nob3cubGVuZ3RoKSB7XG5cdFx0XHRzaXplICs9IHRoaXMub3B0aW9ucy5vdmVyZmxvd0FjdGlvblNpemU7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgaWYgd2UgbmVlZCB0byBtYWtlIGV4dHJhIHJvb20gZm9yIHRoZSBvdmVyZmxvdyBhY3Rpb25cblx0XHR3aGlsZSAoc2l6ZSA+IGxpbWl0ICYmIGNvbXBvc2l0ZXNUb1Nob3cubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCByZW1vdmVkQ29tcG9zaXRlID0gY29tcG9zaXRlc1RvU2hvdy5sZW5ndGggPiAxICYmIGNvbXBvc2l0ZXNUb1Nob3dbY29tcG9zaXRlc1RvU2hvdy5sZW5ndGggLSAxXSA9PT0gdGhpcy5tb2RlbC5hY3RpdmVJdGVtPy5pZCA/XG5cdFx0XHRcdGNvbXBvc2l0ZXNUb1Nob3cuc3BsaWNlKGNvbXBvc2l0ZXNUb1Nob3cubGVuZ3RoIC0gMiwgMSlbMF0gOiBjb21wb3NpdGVzVG9TaG93LnBvcCgpO1xuXHRcdFx0c2l6ZSAtPSB0aGlzLmNvbXBvc2l0ZVNpemVJbkJhci5nZXQocmVtb3ZlZENvbXBvc2l0ZSEpITtcblx0XHR9XG5cblx0XHQvLyBSZW1vdmUgdGhlIG92ZXJmbG93IGFjdGlvbiBpZiB0aGVyZSBhcmUgbm8gb3ZlcmZsb3dzXG5cdFx0aWYgKHRvdGFsQ29tcG9zaXRlcyA9PT0gY29tcG9zaXRlc1RvU2hvdy5sZW5ndGggJiYgdGhpcy5jb21wb3NpdGVPdmVyZmxvd0FjdGlvbikge1xuXHRcdFx0Y29tcG9zaXRlU3dpdGNoZXJCYXIucHVsbChjb21wb3NpdGVTd2l0Y2hlckJhci5sZW5ndGgoKSAtIDEpO1xuXG5cdFx0XHR0aGlzLmNvbXBvc2l0ZU92ZXJmbG93QWN0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuY29tcG9zaXRlT3ZlcmZsb3dBY3Rpb24gPSB1bmRlZmluZWQ7XG5cblx0XHRcdHRoaXMuY29tcG9zaXRlT3ZlcmZsb3dBY3Rpb25WaWV3SXRlbT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5jb21wb3NpdGVPdmVyZmxvd0FjdGlvblZpZXdJdGVtID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIFB1bGwgb3V0IGNvbXBvc2l0ZXMgdGhhdCBvdmVyZmxvdyBvciBnb3QgaGlkZGVuXG5cdFx0Y29uc3QgY29tcG9zaXRlc1RvUmVtb3ZlOiBudW1iZXJbXSA9IFtdO1xuXHRcdHRoaXMudmlzaWJsZUNvbXBvc2l0ZXMuZm9yRWFjaCgoY29tcG9zaXRlSWQsIGluZGV4KSA9PiB7XG5cdFx0XHRpZiAoIWNvbXBvc2l0ZXNUb1Nob3cuaW5jbHVkZXMoY29tcG9zaXRlSWQpKSB7XG5cdFx0XHRcdGNvbXBvc2l0ZXNUb1JlbW92ZS5wdXNoKGluZGV4KTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRjb21wb3NpdGVzVG9SZW1vdmUucmV2ZXJzZSgpLmZvckVhY2goaW5kZXggPT4ge1xuXHRcdFx0Y29tcG9zaXRlU3dpdGNoZXJCYXIucHVsbChpbmRleCk7XG5cdFx0XHR0aGlzLnZpc2libGVDb21wb3NpdGVzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0fSk7XG5cblx0XHQvLyBVcGRhdGUgdGhlIHBvc2l0aW9ucyBvZiB0aGUgY29tcG9zaXRlc1xuXHRcdGNvbXBvc2l0ZXNUb1Nob3cuZm9yRWFjaCgoY29tcG9zaXRlSWQsIG5ld0luZGV4KSA9PiB7XG5cdFx0XHRjb25zdCBjdXJyZW50SW5kZXggPSB0aGlzLnZpc2libGVDb21wb3NpdGVzLmluZGV4T2YoY29tcG9zaXRlSWQpO1xuXHRcdFx0aWYgKG5ld0luZGV4ICE9PSBjdXJyZW50SW5kZXgpIHtcblx0XHRcdFx0aWYgKGN1cnJlbnRJbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0XHRjb21wb3NpdGVTd2l0Y2hlckJhci5wdWxsKGN1cnJlbnRJbmRleCk7XG5cdFx0XHRcdFx0dGhpcy52aXNpYmxlQ29tcG9zaXRlcy5zcGxpY2UoY3VycmVudEluZGV4LCAxKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbXBvc2l0ZVN3aXRjaGVyQmFyLnB1c2godGhpcy5tb2RlbC5maW5kSXRlbShjb21wb3NpdGVJZCkuYWN0aXZpdHlBY3Rpb24sIHsgbGFiZWw6IHRydWUsIGljb246IHRoaXMub3B0aW9ucy5pY29uLCBpbmRleDogbmV3SW5kZXggfSk7XG5cdFx0XHRcdHRoaXMudmlzaWJsZUNvbXBvc2l0ZXMuc3BsaWNlKG5ld0luZGV4LCAwLCBjb21wb3NpdGVJZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBBZGQgb3ZlcmZsb3cgYWN0aW9uIGFzIG5lZWRlZFxuXHRcdGlmICh0b3RhbENvbXBvc2l0ZXMgPiBjb21wb3NpdGVzVG9TaG93Lmxlbmd0aCAmJiAhdGhpcy5jb21wb3NpdGVPdmVyZmxvd0FjdGlvbikge1xuXHRcdFx0dGhpcy5jb21wb3NpdGVPdmVyZmxvd0FjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29tcG9zaXRlT3ZlcmZsb3dBY3Rpdml0eUFjdGlvbiwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmNvbXBvc2l0ZU92ZXJmbG93QWN0aW9uVmlld0l0ZW0/LnNob3dNZW51KCk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLmNvbXBvc2l0ZU92ZXJmbG93QWN0aW9uVmlld0l0ZW0gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRDb21wb3NpdGVPdmVyZmxvd0FjdGl2aXR5QWN0aW9uVmlld0l0ZW0sXG5cdFx0XHRcdHRoaXMuY29tcG9zaXRlT3ZlcmZsb3dBY3Rpb24sXG5cdFx0XHRcdCgpID0+IHRoaXMuZ2V0T3ZlcmZsb3dpbmdDb21wb3NpdGVzKCksXG5cdFx0XHRcdCgpID0+IHRoaXMubW9kZWwuYWN0aXZlSXRlbSA/IHRoaXMubW9kZWwuYWN0aXZlSXRlbS5pZCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0Y29tcG9zaXRlSWQgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLm1vZGVsLmZpbmRJdGVtKGNvbXBvc2l0ZUlkKTtcblx0XHRcdFx0XHRyZXR1cm4gaXRlbT8uYWN0aXZpdHlbMF0/LmJhZGdlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR0aGlzLm9wdGlvbnMuZ2V0T25Db21wb3NpdGVDbGlja0FjdGlvbixcblx0XHRcdFx0dGhpcy5vcHRpb25zLmNvbG9ycyxcblx0XHRcdFx0dGhpcy5vcHRpb25zLmFjdGl2aXR5SG92ZXJPcHRpb25zXG5cdFx0XHQpKTtcblxuXHRcdFx0Y29tcG9zaXRlU3dpdGNoZXJCYXIucHVzaCh0aGlzLmNvbXBvc2l0ZU92ZXJmbG93QWN0aW9uLCB7IGxhYmVsOiBmYWxzZSwgaWNvbjogdHJ1ZSB9KTtcblx0XHR9XG5cblx0XHRpZiAoIWRvbm90VHJpZ2dlcikge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0T3ZlcmZsb3dpbmdDb21wb3NpdGVzKCk6IHsgaWQ6IHN0cmluZzsgbmFtZT86IHN0cmluZyB9W10ge1xuXHRcdGxldCBvdmVyZmxvd2luZ0lkcyA9IHRoaXMubW9kZWwudmlzaWJsZUl0ZW1zLmZpbHRlcihpdGVtID0+IGl0ZW0ucGlubmVkKS5tYXAoaXRlbSA9PiBpdGVtLmlkKTtcblxuXHRcdC8vIFNob3cgdGhlIGFjdGl2ZSBjb21wb3NpdGUgZXZlbiBpZiBpdCBpcyBub3QgcGlubmVkXG5cdFx0aWYgKHRoaXMubW9kZWwuYWN0aXZlSXRlbSAmJiAhdGhpcy5tb2RlbC5hY3RpdmVJdGVtLnBpbm5lZCkge1xuXHRcdFx0b3ZlcmZsb3dpbmdJZHMucHVzaCh0aGlzLm1vZGVsLmFjdGl2ZUl0ZW0uaWQpO1xuXHRcdH1cblxuXHRcdG92ZXJmbG93aW5nSWRzID0gb3ZlcmZsb3dpbmdJZHMuZmlsdGVyKGNvbXBvc2l0ZUlkID0+ICF0aGlzLnZpc2libGVDb21wb3NpdGVzLmluY2x1ZGVzKGNvbXBvc2l0ZUlkKSk7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwudmlzaWJsZUl0ZW1zLmZpbHRlcihjID0+IG92ZXJmbG93aW5nSWRzLmluY2x1ZGVzKGMuaWQpKS5tYXAoaXRlbSA9PiB7IHJldHVybiB7IGlkOiBpdGVtLmlkLCBuYW1lOiB0aGlzLmdldEFjdGlvbihpdGVtLmlkKT8ubGFiZWwgfHwgaXRlbS5uYW1lIH07IH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93Q29udGV4dE1lbnUodGFyZ2V0V2luZG93OiBXaW5kb3csIGU6IE1vdXNlRXZlbnQgfCBHZXN0dXJlRXZlbnQpOiB2b2lkIHtcblx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KHRhcmdldFdpbmRvdywgZSk7XG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiB0aGlzLmdldENvbnRleHRNZW51QWN0aW9ucyhlKVxuXHRcdH0pO1xuXHR9XG5cblx0Z2V0Q29udGV4dE1lbnVBY3Rpb25zKGU/OiBNb3VzZUV2ZW50IHwgR2VzdHVyZUV2ZW50KTogSUFjdGlvbltdIHtcblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSB0aGlzLm1vZGVsLnZpc2libGVJdGVtc1xuXHRcdFx0Lm1hcCgoeyBpZCwgbmFtZSwgYWN0aXZpdHlBY3Rpb24gfSkgPT4ge1xuXHRcdFx0XHRjb25zdCBpc1Bpbm5lZCA9IHRoaXMuaXNQaW5uZWQoaWQpO1xuXHRcdFx0XHRyZXR1cm4gdG9BY3Rpb24oe1xuXHRcdFx0XHRcdGlkLFxuXHRcdFx0XHRcdGxhYmVsOiB0aGlzLmdldEFjdGlvbihpZCkubGFiZWwgfHwgbmFtZSB8fCBpZCxcblx0XHRcdFx0XHRjaGVja2VkOiBpc1Bpbm5lZCxcblx0XHRcdFx0XHRlbmFibGVkOiBhY3Rpdml0eUFjdGlvbi5lbmFibGVkICYmICghaXNQaW5uZWQgfHwgdGhpcy5nZXRQaW5uZWRDb21wb3NpdGVJZHMoKS5sZW5ndGggPiAxKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdGlmICh0aGlzLmlzUGlubmVkKGlkKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnVucGluKGlkKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMucGluKGlkLCB0cnVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHR0aGlzLm9wdGlvbnMuZmlsbEV4dHJhQ29udGV4dE1lbnVBY3Rpb25zKGFjdGlvbnMsIGUpO1xuXG5cdFx0cmV0dXJuIGFjdGlvbnM7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElDb21wb3NpdGVCYXJNb2RlbEl0ZW0gZXh0ZW5kcyBJQ29tcG9zaXRlQmFySXRlbSB7XG5cdHJlYWRvbmx5IGFjdGl2aXR5QWN0aW9uOiBDb21wb3NpdGVCYXJBY3Rpb247XG5cdHJlYWRvbmx5IHBpbm5lZEFjdGlvbjogSUFjdGlvbjtcblx0cmVhZG9ubHkgdG9nZ2xlQmFkZ2VBY3Rpb246IElBY3Rpb247XG5cdHJlYWRvbmx5IGFjdGl2aXR5OiBJQWN0aXZpdHlbXTtcbn1cblxuY2xhc3MgQ29tcG9zaXRlQmFyTW9kZWwge1xuXG5cdHByaXZhdGUgX2l0ZW1zOiBJQ29tcG9zaXRlQmFyTW9kZWxJdGVtW10gPSBbXTtcblx0Z2V0IGl0ZW1zKCk6IElDb21wb3NpdGVCYXJNb2RlbEl0ZW1bXSB7IHJldHVybiB0aGlzLl9pdGVtczsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogSUNvbXBvc2l0ZUJhck9wdGlvbnM7XG5cblx0YWN0aXZlSXRlbT86IElDb21wb3NpdGVCYXJNb2RlbEl0ZW07XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aXRlbXM6IElDb21wb3NpdGVCYXJJdGVtW10sXG5cdFx0b3B0aW9uczogSUNvbXBvc2l0ZUJhck9wdGlvbnNcblx0KSB7XG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLnNldEl0ZW1zKGl0ZW1zKTtcblx0fVxuXG5cdHNldEl0ZW1zKGl0ZW1zOiBJQ29tcG9zaXRlQmFySXRlbVtdKTogdm9pZCB7XG5cdFx0dGhpcy5faXRlbXMgPSBbXTtcblx0XHR0aGlzLl9pdGVtcyA9IGl0ZW1zXG5cdFx0XHQubWFwKGkgPT4gdGhpcy5jcmVhdGVDb21wb3NpdGVCYXJJdGVtKGkuaWQsIGkubmFtZSwgaS5vcmRlciwgaS5waW5uZWQsIGkudmlzaWJsZSkpO1xuXHR9XG5cblx0Z2V0IHZpc2libGVJdGVtcygpOiBJQ29tcG9zaXRlQmFyTW9kZWxJdGVtW10ge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zLmZpbHRlcihpdGVtID0+IGl0ZW0udmlzaWJsZSk7XG5cdH1cblxuXHRnZXQgcGlubmVkSXRlbXMoKTogSUNvbXBvc2l0ZUJhck1vZGVsSXRlbVtdIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcy5maWx0ZXIoaXRlbSA9PiBpdGVtLnZpc2libGUgJiYgaXRlbS5waW5uZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVDb21wb3NpdGVCYXJJdGVtKGlkOiBzdHJpbmcsIG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCwgb3JkZXI6IG51bWJlciB8IHVuZGVmaW5lZCwgcGlubmVkOiBib29sZWFuLCB2aXNpYmxlOiBib29sZWFuKTogSUNvbXBvc2l0ZUJhck1vZGVsSXRlbSB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQsIG5hbWUsIHBpbm5lZCwgb3JkZXIsIHZpc2libGUsXG5cdFx0XHRhY3Rpdml0eTogW10sXG5cdFx0XHRnZXQgYWN0aXZpdHlBY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBvcHRpb25zLmdldEFjdGl2aXR5QWN0aW9uKGlkKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcGlubmVkQWN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5nZXRDb21wb3NpdGVQaW5uZWRBY3Rpb24oaWQpO1xuXHRcdFx0fSxcblx0XHRcdGdldCB0b2dnbGVCYWRnZUFjdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIG9wdGlvbnMuZ2V0Q29tcG9zaXRlQmFkZ2VBY3Rpb24oaWQpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRhZGQoaWQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCBvcmRlcjogbnVtYmVyIHwgdW5kZWZpbmVkLCByZXF1ZXN0ZWRJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuZmluZEl0ZW0oaWQpO1xuXHRcdGlmIChpdGVtKSB7XG5cdFx0XHRsZXQgY2hhbmdlZCA9IGZhbHNlO1xuXHRcdFx0aXRlbS5uYW1lID0gbmFtZTtcblx0XHRcdGlmICghaXNVbmRlZmluZWRPck51bGwob3JkZXIpKSB7XG5cdFx0XHRcdGNoYW5nZWQgPSBpdGVtLm9yZGVyICE9PSBvcmRlcjtcblx0XHRcdFx0aXRlbS5vcmRlciA9IG9yZGVyO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFpdGVtLnZpc2libGUpIHtcblx0XHRcdFx0aXRlbS52aXNpYmxlID0gdHJ1ZTtcblx0XHRcdFx0Y2hhbmdlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjaGFuZ2VkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBpdGVtID0gdGhpcy5jcmVhdGVDb21wb3NpdGVCYXJJdGVtKGlkLCBuYW1lLCBvcmRlciwgdHJ1ZSwgdHJ1ZSk7XG5cdFx0XHRpZiAoIWlzVW5kZWZpbmVkT3JOdWxsKHJlcXVlc3RlZEluZGV4KSkge1xuXHRcdFx0XHRsZXQgaW5kZXggPSAwO1xuXHRcdFx0XHRsZXQgckluZGV4ID0gcmVxdWVzdGVkSW5kZXg7XG5cdFx0XHRcdHdoaWxlIChySW5kZXggPiAwICYmIGluZGV4IDwgdGhpcy5pdGVtcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5pdGVtc1tpbmRleCsrXS52aXNpYmxlKSB7XG5cdFx0XHRcdFx0XHRySW5kZXgtLTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLml0ZW1zLnNwbGljZShpbmRleCwgMCwgaXRlbSk7XG5cdFx0XHR9IGVsc2UgaWYgKGlzVW5kZWZpbmVkT3JOdWxsKG9yZGVyKSkge1xuXHRcdFx0XHR0aGlzLml0ZW1zLnB1c2goaXRlbSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsZXQgaW5kZXggPSAwO1xuXHRcdFx0XHR3aGlsZSAoaW5kZXggPCB0aGlzLml0ZW1zLmxlbmd0aCAmJiB0eXBlb2YgdGhpcy5pdGVtc1tpbmRleF0ub3JkZXIgPT09ICdudW1iZXInICYmIHRoaXMuaXRlbXNbaW5kZXhdLm9yZGVyISA8IG9yZGVyKSB7XG5cdFx0XHRcdFx0aW5kZXgrKztcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLml0ZW1zLnNwbGljZShpbmRleCwgMCwgaXRlbSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHJlbW92ZShpZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuaXRlbXMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRpZiAodGhpcy5pdGVtc1tpbmRleF0uaWQgPT09IGlkKSB7XG5cdFx0XHRcdHRoaXMuaXRlbXMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGhpZGUoaWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZW1zKSB7XG5cdFx0XHRpZiAoaXRlbS5pZCA9PT0gaWQpIHtcblx0XHRcdFx0aWYgKGl0ZW0udmlzaWJsZSkge1xuXHRcdFx0XHRcdGl0ZW0udmlzaWJsZSA9IGZhbHNlO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0bW92ZShjb21wb3NpdGVJZDogc3RyaW5nLCB0b0NvbXBvc2l0ZUlkOiBzdHJpbmcpOiBib29sZWFuIHtcblxuXHRcdGNvbnN0IGZyb21JbmRleCA9IHRoaXMuZmluZEluZGV4KGNvbXBvc2l0ZUlkKTtcblx0XHRjb25zdCB0b0luZGV4ID0gdGhpcy5maW5kSW5kZXgodG9Db21wb3NpdGVJZCk7XG5cblx0XHQvLyBNYWtlIHN1cmUgYm90aCBpdGVtcyBhcmUga25vd24gdG8gdGhlIG1vZGVsXG5cdFx0aWYgKGZyb21JbmRleCA9PT0gLTEgfHwgdG9JbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBzb3VyY2VJdGVtID0gdGhpcy5pdGVtcy5zcGxpY2UoZnJvbUluZGV4LCAxKVswXTtcblx0XHR0aGlzLml0ZW1zLnNwbGljZSh0b0luZGV4LCAwLCBzb3VyY2VJdGVtKTtcblxuXHRcdC8vIE1ha2Ugc3VyZSBhIG1vdmVkIGNvbXBvc2l0ZSBnZXRzIHBpbm5lZFxuXHRcdHNvdXJjZUl0ZW0ucGlubmVkID0gdHJ1ZTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0c2V0UGlubmVkKGlkOiBzdHJpbmcsIHBpbm5lZDogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZW1zKSB7XG5cdFx0XHRpZiAoaXRlbS5pZCA9PT0gaWQpIHtcblx0XHRcdFx0aWYgKGl0ZW0ucGlubmVkICE9PSBwaW5uZWQpIHtcblx0XHRcdFx0XHRpdGVtLnBpbm5lZCA9IHBpbm5lZDtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGFjdGl2YXRlKGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuYWN0aXZlSXRlbSB8fCB0aGlzLmFjdGl2ZUl0ZW0uaWQgIT09IGlkKSB7XG5cdFx0XHRpZiAodGhpcy5hY3RpdmVJdGVtKSB7XG5cdFx0XHRcdHRoaXMuZGVhY3RpdmF0ZSgpO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIHRoaXMuaXRlbXMpIHtcblx0XHRcdFx0aWYgKGl0ZW0uaWQgPT09IGlkKSB7XG5cdFx0XHRcdFx0dGhpcy5hY3RpdmVJdGVtID0gaXRlbTtcblx0XHRcdFx0XHR0aGlzLmFjdGl2ZUl0ZW0uYWN0aXZpdHlBY3Rpb24uYWN0aXZhdGUoKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRkZWFjdGl2YXRlKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmFjdGl2ZUl0ZW0pIHtcblx0XHRcdHRoaXMuYWN0aXZlSXRlbS5hY3Rpdml0eUFjdGlvbi5kZWFjdGl2YXRlKCk7XG5cdFx0XHR0aGlzLmFjdGl2ZUl0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0ZmluZEl0ZW0oaWQ6IHN0cmluZyk6IElDb21wb3NpdGVCYXJNb2RlbEl0ZW0ge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zLmZpbHRlcihpdGVtID0+IGl0ZW0uaWQgPT09IGlkKVswXTtcblx0fVxuXG5cdHByaXZhdGUgZmluZEluZGV4KGlkOiBzdHJpbmcpOiBudW1iZXIge1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLml0ZW1zLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0aWYgKHRoaXMuaXRlbXNbaW5kZXhdLmlkID09PSBpZCkge1xuXHRcdFx0XHRyZXR1cm4gaW5kZXg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIC0xO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQWtCLGdCQUFnQjtBQUVsQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLFdBQVcsMEJBQTBCO0FBQzlDLFNBQVMseUJBQXlCLGlDQUFpQywrQ0FBOEg7QUFDak0sU0FBb0IsR0FBRyx1QkFBdUIsV0FBVyxhQUFhLFlBQVksaUJBQWlCO0FBQ25HLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsY0FBYztBQUN2QixTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLGVBQWU7QUFDeEIsU0FBZ0MsOEJBQThCO0FBRzlELFNBQW1DLDhCQUFzRix3QkFBZ0U7QUFDekwsU0FBUyxTQUFTLGFBQWEsc0JBQW9DO0FBWTVELE1BQU0scUJBQXNEO0FBQUEsRUFFbEUsWUFDUyx1QkFDQSx5QkFDQSxhQUNBLGVBQ0EsZUFDQSxVQUNQO0FBTk87QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQUEsRUFDTDtBQUFBLEVBRUosS0FBSyxNQUFnQyxtQkFBdUMsZUFBMEIsUUFBeUI7QUFDOUgsVUFBTSxXQUFXLEtBQUssUUFBUTtBQUU5QixRQUFJLFNBQVMsU0FBUyxhQUFhO0FBQ2xDLFlBQU0sbUJBQW1CLEtBQUssc0JBQXNCLHFCQUFxQixTQUFTLEVBQUU7QUFDcEYsWUFBTSxrQkFBa0IsS0FBSyxzQkFBc0IseUJBQXlCLGdCQUFnQjtBQUM1RixVQUFJLFFBQVE7QUFHWixVQUFJLG9CQUFvQixLQUFLLHlCQUF5QjtBQUNyRCxZQUFJLG1CQUFtQjtBQUN0QixlQUFLLGNBQWMsU0FBUyxJQUFJLG1CQUFtQixNQUFNO0FBQ3pELGtCQUFRO0FBQUEsUUFDVDtBQUFBLE1BQ0QsT0FFSztBQUNKLGFBQUssc0JBQXNCLDRCQUE0QixrQkFBa0IsS0FBSyx5QkFBeUIsS0FBSyxlQUFl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
