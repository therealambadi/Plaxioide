import { $, addDisposableListener, append, getWindow, scheduleAtNextAnimationFrame } from "../../dom.js";
import { DomEmitter } from "../../event.js";
import { Orientation, Sash, SashState } from "../sash/sash.js";
import { SmoothScrollableElement } from "../scrollbar/scrollableElement.js";
import { pushToEnd, pushToStart, range } from "../../../common/arrays.js";
import { Color } from "../../../common/color.js";
import { Emitter, Event } from "../../../common/event.js";
import { combinedDisposable, Disposable, dispose, toDisposable } from "../../../common/lifecycle.js";
import { clamp } from "../../../common/numbers.js";
import { Scrollable, ScrollbarVisibility } from "../../../common/scrollable.js";
import * as types from "../../../common/types.js";
import "./splitview.css";
import { Orientation as Orientation2 } from "../sash/sash.js";
const defaultStyles = {
  separatorBorder: Color.transparent
};
var LayoutPriority = /* @__PURE__ */ ((LayoutPriority2) => {
  LayoutPriority2[LayoutPriority2["Normal"] = 0] = "Normal";
  LayoutPriority2[LayoutPriority2["Low"] = 1] = "Low";
  LayoutPriority2[LayoutPriority2["High"] = 2] = "High";
  return LayoutPriority2;
})(LayoutPriority || {});
class ViewItem {
  constructor(container, view, size, disposable) {
    this.container = container;
    this.view = view;
    this.disposable = disposable;
    this._cachedVisibleSize = void 0;
    if (typeof size === "number") {
      this._size = size;
      this._cachedVisibleSize = void 0;
      container.classList.add("visible");
    } else {
      this._size = 0;
      this._cachedVisibleSize = size.cachedVisibleSize;
    }
  }
  set size(size) {
    this._size = size;
  }
  get size() {
    return this._size;
  }
  get cachedVisibleSize() {
    return this._cachedVisibleSize;
  }
  get visible() {
    return typeof this._cachedVisibleSize === "undefined";
  }
  setVisible(visible, size) {
    if (visible === this.visible) {
      return;
    }
    if (visible) {
      this.size = clamp(this._cachedVisibleSize, this.viewMinimumSize, this.viewMaximumSize);
      this._cachedVisibleSize = void 0;
    } else {
      this._cachedVisibleSize = typeof size === "number" ? size : this.size;
      this.size = 0;
    }
    this.container.classList.toggle("visible", visible);
    try {
      this.view.setVisible?.(visible);
    } catch (e) {
      console.error("Splitview: Failed to set visible view");
      console.error(e);
    }
  }
  get minimumSize() {
    return this.visible ? this.view.minimumSize : 0;
  }
  get viewMinimumSize() {
    return this.view.minimumSize;
  }
  get maximumSize() {
    return this.visible ? this.view.maximumSize : 0;
  }
  get viewMaximumSize() {
    return this.view.maximumSize;
  }
  get priority() {
    return this.view.priority;
  }
  get proportionalLayout() {
    return this.view.proportionalLayout ?? true;
  }
  get snap() {
    return !!this.view.snap;
  }
  set enabled(enabled) {
    this.container.style.pointerEvents = enabled ? "" : "none";
  }
  layout(offset, layoutContext) {
    this.layoutContainer(offset);
    try {
      this.view.layout(this.size, offset, layoutContext);
    } catch (e) {
      console.error("Splitview: Failed to layout view");
      console.error(e);
    }
  }
  dispose() {
    this.disposable.dispose();
  }
}
class VerticalViewItem extends ViewItem {
  layoutContainer(offset) {
    this.container.style.top = `${offset}px`;
    this.container.style.height = `${this.size}px`;
  }
}
class HorizontalViewItem extends ViewItem {
  layoutContainer(offset) {
    this.container.style.left = `${offset}px`;
    this.container.style.width = `${this.size}px`;
  }
}
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["Idle"] = 0] = "Idle";
  State2[State2["Busy"] = 1] = "Busy";
  return State2;
})(State || {});
var Sizing;
((Sizing2) => {
  Sizing2.Distribute = { type: "distribute" };
  function Split(index) {
    return { type: "split", index };
  }
  Sizing2.Split = Split;
  function Auto(index) {
    return { type: "auto", index };
  }
  Sizing2.Auto = Auto;
  function Invisible(cachedVisibleSize) {
    return { type: "invisible", cachedVisibleSize };
  }
  Sizing2.Invisible = Invisible;
})(Sizing || (Sizing = {}));
class SplitView extends Disposable {
  /**
   * Create a new {@link SplitView} instance.
   */
  constructor(container, options = {}) {
    super();
    this.size = 0;
    this._contentSize = 0;
    this.proportions = void 0;
    this.viewItems = [];
    this.sashItems = [];
    this.state = 0 /* Idle */;
    this._onDidSashChange = this._register(new Emitter());
    this._onDidSashReset = this._register(new Emitter());
    this._startSnappingEnabled = true;
    this._endSnappingEnabled = true;
    /**
     * Fires whenever the user resizes a {@link Sash sash}.
     */
    this.onDidSashChange = this._onDidSashChange.event;
    /**
     * Fires whenever the user double clicks a {@link Sash sash}.
     */
    this.onDidSashReset = this._onDidSashReset.event;
    this.orientation = options.orientation ?? Orientation.VERTICAL;
    this.inverseAltBehavior = options.inverseAltBehavior ?? false;
    this.proportionalLayout = options.proportionalLayout ?? true;
    this.getSashOrthogonalSize = options.getSashOrthogonalSize;
    this.el = document.createElement("div");
    this.el.classList.add("monaco-split-view2");
    this.el.classList.add(this.orientation === Orientation.VERTICAL ? "vertical" : "horizontal");
    container.appendChild(this.el);
    this.sashContainer = append(this.el, $(".sash-container"));
    this.viewContainer = $(".split-view-container");
    this.scrollable = this._register(new Scrollable({
      forceIntegerValues: true,
      smoothScrollDuration: 125,
      scheduleAtNextAnimationFrame: (callback) => scheduleAtNextAnimationFrame(getWindow(this.el), callback)
    }));
    this.scrollableElement = this._register(new SmoothScrollableElement(this.viewContainer, {
      vertical: this.orientation === Orientation.VERTICAL ? options.scrollbarVisibility ?? ScrollbarVisibility.Auto : ScrollbarVisibility.Hidden,
      horizontal: this.orientation === Orientation.HORIZONTAL ? options.scrollbarVisibility ?? ScrollbarVisibility.Auto : ScrollbarVisibility.Hidden
    }, this.scrollable));
    const onDidScrollViewContainer = this._register(new DomEmitter(this.viewContainer, "scroll")).event;
    this._register(onDidScrollViewContainer((_) => {
      const position = this.scrollableElement.getScrollPosition();
      const scrollLeft = Math.abs(this.viewContainer.scrollLeft - position.scrollLeft) <= 1 ? void 0 : this.viewContainer.scrollLeft;
      const scrollTop = Math.abs(this.viewContainer.scrollTop - position.scrollTop) <= 1 ? void 0 : this.viewContainer.scrollTop;
      if (scrollLeft !== void 0 || scrollTop !== void 0) {
        this.scrollableElement.setScrollPosition({ scrollLeft, scrollTop });
      }
    }));
    this.onDidScroll = this.scrollableElement.onScroll;
    this._register(this.onDidScroll((e) => {
      if (e.scrollTopChanged) {
        this.viewContainer.scrollTop = e.scrollTop;
      }
      if (e.scrollLeftChanged) {
        this.viewContainer.scrollLeft = e.scrollLeft;
      }
    }));
    append(this.el, this.scrollableElement.getDomNode());
    this.style(options.styles || defaultStyles);
    if (options.descriptor) {
      this.size = options.descriptor.size;
      options.descriptor.views.forEach((viewDescriptor, index) => {
        const sizing = types.isUndefined(viewDescriptor.visible) || viewDescriptor.visible ? viewDescriptor.size : { type: "invisible", cachedVisibleSize: viewDescriptor.size };
        const view = viewDescriptor.view;
        this.doAddView(view, sizing, index, true);
      });
      this._contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
      this.saveProportions();
    }
  }
  /**
   * The sum of all views' sizes.
   */
  get contentSize() {
    return this._contentSize;
  }
  /**
   * The amount of views in this {@link SplitView}.
   */
  get length() {
    return this.viewItems.length;
  }
  /**
   * The minimum size of this {@link SplitView}.
   */
  get minimumSize() {
    return this.viewItems.reduce((r, item) => r + item.minimumSize, 0);
  }
  /**
   * The maximum size of this {@link SplitView}.
   */
  get maximumSize() {
    return this.length === 0 ? Number.POSITIVE_INFINITY : this.viewItems.reduce((r, item) => r + item.maximumSize, 0);
  }
  get orthogonalStartSash() {
    return this._orthogonalStartSash;
  }
  get orthogonalEndSash() {
    return this._orthogonalEndSash;
  }
  get startSnappingEnabled() {
    return this._startSnappingEnabled;
  }
  get endSnappingEnabled() {
    return this._endSnappingEnabled;
  }
  /**
   * A reference to a sash, perpendicular to all sashes in this {@link SplitView},
   * located at the left- or top-most side of the SplitView.
   * Corner sashes will be created automatically at the intersections.
   */
  set orthogonalStartSash(sash) {
    for (const sashItem of this.sashItems) {
      sashItem.sash.orthogonalStartSash = sash;
    }
    this._orthogonalStartSash = sash;
  }
  /**
   * A reference to a sash, perpendicular to all sashes in this {@link SplitView},
   * located at the right- or bottom-most side of the SplitView.
   * Corner sashes will be created automatically at the intersections.
   */
  set orthogonalEndSash(sash) {
    for (const sashItem of this.sashItems) {
      sashItem.sash.orthogonalEndSash = sash;
    }
    this._orthogonalEndSash = sash;
  }
  /**
   * The internal sashes within this {@link SplitView}.
   */
  get sashes() {
    return this.sashItems.map((s) => s.sash);
  }
  /**
   * Enable/disable snapping at the beginning of this {@link SplitView}.
   */
  set startSnappingEnabled(startSnappingEnabled) {
    if (this._startSnappingEnabled === startSnappingEnabled) {
      return;
    }
    this._startSnappingEnabled = startSnappingEnabled;
    this.updateSashEnablement();
  }
  /**
   * Enable/disable snapping at the end of this {@link SplitView}.
   */
  set endSnappingEnabled(endSnappingEnabled) {
    if (this._endSnappingEnabled === endSnappingEnabled) {
      return;
    }
    this._endSnappingEnabled = endSnappingEnabled;
    this.updateSashEnablement();
  }
  style(styles) {
    if (styles.separatorBorder.isTransparent()) {
      this.el.classList.remove("separator-border");
      this.el.style.removeProperty("--separator-border");
    } else {
      this.el.classList.add("separator-border");
      this.el.style.setProperty("--separator-border", styles.separatorBorder.toString());
    }
  }
  /**
   * Add a {@link IView view} to this {@link SplitView}.
   *
   * @param view The view to add.
   * @param size Either a fixed size, or a dynamic {@link Sizing} strategy.
   * @param index The index to insert the view on.
   * @param skipLayout Whether layout should be skipped.
   */
  addView(view, size, index = this.viewItems.length, skipLayout) {
    this.doAddView(view, size, index, skipLayout);
  }
  /**
   * Remove a {@link IView view} from this {@link SplitView}.
   *
   * @param index The index where the {@link IView view} is located.
   * @param sizing Whether to distribute other {@link IView view}'s sizes.
   */
  removeView(index, sizing) {
    if (index < 0 || index >= this.viewItems.length) {
      throw new Error("Index out of bounds");
    }
    if (this.state !== 0 /* Idle */) {
      throw new Error("Cant modify splitview");
    }
    this.state = 1 /* Busy */;
    try {
      if (sizing?.type === "auto") {
        if (this.areViewsDistributed()) {
          sizing = { type: "distribute" };
        } else {
          sizing = { type: "split", index: sizing.index };
        }
      }
      const referenceViewItem = sizing?.type === "split" ? this.viewItems[sizing.index] : void 0;
      const viewItemToRemove = this.viewItems.splice(index, 1)[0];
      if (referenceViewItem) {
        referenceViewItem.size += viewItemToRemove.size;
      }
      if (this.viewItems.length >= 1) {
        const sashIndex = Math.max(index - 1, 0);
        const sashItem = this.sashItems.splice(sashIndex, 1)[0];
        sashItem.disposable.dispose();
      }
      this.relayout();
      if (sizing?.type === "distribute") {
        this.distributeViewSizes();
      }
      const result = viewItemToRemove.view;
      viewItemToRemove.dispose();
      return result;
    } finally {
      this.state = 0 /* Idle */;
    }
  }
  removeAllViews() {
    if (this.state !== 0 /* Idle */) {
      throw new Error("Cant modify splitview");
    }
    this.state = 1 /* Busy */;
    try {
      const viewItems = this.viewItems.splice(0, this.viewItems.length);
      for (const viewItem of viewItems) {
        viewItem.dispose();
      }
      const sashItems = this.sashItems.splice(0, this.sashItems.length);
      for (const sashItem of sashItems) {
        sashItem.disposable.dispose();
      }
      this.relayout();
      return viewItems.map((i) => i.view);
    } finally {
      this.state = 0 /* Idle */;
    }
  }
  /**
   * Move a {@link IView view} to a different index.
   *
   * @param from The source index.
   * @param to The target index.
   */
  moveView(from, to) {
    if (this.state !== 0 /* Idle */) {
      throw new Error("Cant modify splitview");
    }
    const cachedVisibleSize = this.getViewCachedVisibleSize(from);
    const sizing = typeof cachedVisibleSize === "undefined" ? this.getViewSize(from) : Sizing.Invisible(cachedVisibleSize);
    const view = this.removeView(from);
    this.addView(view, sizing, to);
  }
  /**
   * Swap two {@link IView views}.
   *
   * @param from The source index.
   * @param to The target index.
   */
  swapViews(from, to) {
    if (this.state !== 0 /* Idle */) {
      throw new Error("Cant modify splitview");
    }
    if (from > to) {
      return this.swapViews(to, from);
    }
    const fromSize = this.getViewSize(from);
    const toSize = this.getViewSize(to);
    const toView = this.removeView(to);
    const fromView = this.removeView(from);
    this.addView(toView, fromSize, from);
    this.addView(fromView, toSize, to);
  }
  /**
   * Returns whether the {@link IView view} is visible.
   *
   * @param index The {@link IView view} index.
   */
  isViewVisible(index) {
    if (index < 0 || index >= this.viewItems.length) {
      throw new Error("Index out of bounds");
    }
    const viewItem = this.viewItems[index];
    return viewItem.visible;
  }
  /**
   * Set a {@link IView view}'s visibility.
   *
   * @param index The {@link IView view} index.
   * @param visible Whether the {@link IView view} should be visible.
   */
  setViewVisible(index, visible) {
    if (index < 0 || index >= this.viewItems.length) {
      throw new Error("Index out of bounds");
    }
    const viewItem = this.viewItems[index];
    viewItem.setVisible(visible);
    this.distributeEmptySpace(index);
    this.layoutViews();
    this.saveProportions();
  }
  /**
   * Returns the {@link IView view}'s size previously to being hidden.
   *
   * @param index The {@link IView view} index.
   */
  getViewCachedVisibleSize(index) {
    if (index < 0 || index >= this.viewItems.length) {
      throw new Error("Index out of bounds");
    }
    const viewItem = this.viewItems[index];
    return viewItem.cachedVisibleSize;
  }
  /**
   * Layout the {@link SplitView}.
   *
   * @param size The entire size of the {@link SplitView}.
   * @param layoutContext An optional layout context to pass along to {@link IView views}.
   */
  layout(size, layoutContext) {
    const previousSize = Math.max(this.size, this._contentSize);
    this.size = size;
    this.layoutContext = layoutContext;
    if (!this.proportions) {
      const indexes = range(this.viewItems.length);
      const lowPriorityIndexes = indexes.filter((i) => this.viewItems[i].priority === 1 /* Low */);
      const highPriorityIndexes = indexes.filter((i) => this.viewItems[i].priority === 2 /* High */);
      this.resize(this.viewItems.length - 1, size - previousSize, void 0, lowPriorityIndexes, highPriorityIndexes);
    } else {
      let total = 0;
      for (let i = 0; i < this.viewItems.length; i++) {
        const item = this.viewItems[i];
        const proportion = this.proportions[i];
        if (typeof proportion === "number") {
          total += proportion;
        } else {
          size -= item.size;
        }
      }
      for (let i = 0; i < this.viewItems.length; i++) {
        const item = this.viewItems[i];
        const proportion = this.proportions[i];
        if (typeof proportion === "number" && total > 0) {
          item.size = clamp(Math.round(proportion * size / total), item.minimumSize, item.maximumSize);
        }
      }
    }
    this.distributeEmptySpace();
    this.layoutViews();
  }
  saveProportions() {
    if (this.proportionalLayout && this._contentSize > 0) {
      this.proportions = this.viewItems.map((v) => v.proportionalLayout && v.visible ? v.size / this._contentSize : void 0);
    }
  }
  onSashStart({ sash, start, alt }) {
    for (const item of this.viewItems) {
      item.enabled = false;
    }
    const index = this.sashItems.findIndex((item) => item.sash === sash);
    const disposable = combinedDisposable(
      addDisposableListener(this.el.ownerDocument.body, "keydown", (e) => resetSashDragState(this.sashDragState.current, e.altKey)),
      addDisposableListener(this.el.ownerDocument.body, "keyup", () => resetSashDragState(this.sashDragState.current, false))
    );
    const resetSashDragState = (start2, alt2) => {
      const sizes = this.viewItems.map((i) => i.size);
      let minDelta = Number.NEGATIVE_INFINITY;
      let maxDelta = Number.POSITIVE_INFINITY;
      if (this.inverseAltBehavior) {
        alt2 = !alt2;
      }
      if (alt2) {
        const isLastSash = index === this.sashItems.length - 1;
        if (isLastSash) {
          const viewItem = this.viewItems[index];
          minDelta = (viewItem.minimumSize - viewItem.size) / 2;
          maxDelta = (viewItem.maximumSize - viewItem.size) / 2;
        } else {
          const viewItem = this.viewItems[index + 1];
          minDelta = (viewItem.size - viewItem.maximumSize) / 2;
          maxDelta = (viewItem.size - viewItem.minimumSize) / 2;
        }
      }
      let snapBefore;
      let snapAfter;
      if (!alt2) {
        const upIndexes = range(index, -1);
        const downIndexes = range(index + 1, this.viewItems.length);
        const minDeltaUp = upIndexes.reduce((r, i) => r + (this.viewItems[i].minimumSize - sizes[i]), 0);
        const maxDeltaUp = upIndexes.reduce((r, i) => r + (this.viewItems[i].viewMaximumSize - sizes[i]), 0);
        const maxDeltaDown = downIndexes.length === 0 ? Number.POSITIVE_INFINITY : downIndexes.reduce((r, i) => r + (sizes[i] - this.viewItems[i].minimumSize), 0);
        const minDeltaDown = downIndexes.length === 0 ? Number.NEGATIVE_INFINITY : downIndexes.reduce((r, i) => r + (sizes[i] - this.viewItems[i].viewMaximumSize), 0);
        const minDelta2 = Math.max(minDeltaUp, minDeltaDown);
        const maxDelta2 = Math.min(maxDeltaDown, maxDeltaUp);
        const snapBeforeIndex = this.findFirstSnapIndex(upIndexes);
        const snapAfterIndex = this.findFirstSnapIndex(downIndexes);
        if (typeof snapBeforeIndex === "number") {
          const viewItem = this.viewItems[snapBeforeIndex];
          const halfSize = Math.floor(viewItem.viewMinimumSize / 2);
          snapBefore = {
            index: snapBeforeIndex,
            limitDelta: viewItem.visible ? minDelta2 - halfSize : minDelta2 + halfSize,
            size: viewItem.size
          };
        }
        if (typeof snapAfterIndex === "number") {
          const viewItem = this.viewItems[snapAfterIndex];
          const halfSize = Math.floor(viewItem.viewMinimumSize / 2);
          snapAfter = {
            index: snapAfterIndex,
            limitDelta: viewItem.visible ? maxDelta2 + halfSize : maxDelta2 - halfSize,
            size: viewItem.size
          };
        }
      }
      this.sashDragState = { start: start2, current: start2, index, sizes, minDelta, maxDelta, alt: alt2, snapBefore, snapAfter, disposable };
    };
    resetSashDragState(start, alt);
  }
  onSashChange({ current }) {
    const { index, start, sizes, alt, minDelta, maxDelta, snapBefore, snapAfter } = this.sashDragState;
    this.sashDragState.current = current;
    const delta = current - start;
    const newDelta = this.resize(index, delta, sizes, void 0, void 0, minDelta, maxDelta, snapBefore, snapAfter);
    if (alt) {
      const isLastSash = index === this.sashItems.length - 1;
      const newSizes = this.viewItems.map((i) => i.size);
      const viewItemIndex = isLastSash ? index : index + 1;
      const viewItem = this.viewItems[viewItemIndex];
      const newMinDelta = viewItem.size - viewItem.maximumSize;
      const newMaxDelta = viewItem.size - viewItem.minimumSize;
      const resizeIndex = isLastSash ? index - 1 : index + 1;
      this.resize(resizeIndex, -newDelta, newSizes, void 0, void 0, newMinDelta, newMaxDelta);
    }
    this.distributeEmptySpace();
    this.layoutViews();
  }
  onSashEnd(index) {
    this._onDidSashChange.fire(index);
    this.sashDragState.disposable.dispose();
    this.saveProportions();
    for (const item of this.viewItems) {
      item.enabled = true;
    }
  }
  onViewChange(item, size) {
    const index = this.viewItems.indexOf(item);
    if (index < 0 || index >= this.viewItems.length) {
      return;
    }
    size = typeof size === "number" ? size : item.size;
    size = clamp(size, item.minimumSize, item.maximumSize);
    if (this.inverseAltBehavior && index > 0) {
      this.resize(index - 1, Math.floor((item.size - size) / 2));
      this.distributeEmptySpace();
      this.layoutViews();
    } else {
      item.size = size;
      this.relayout([index], void 0);
    }
  }
  /**
   * Resize a {@link IView view} within the {@link SplitView}.
   *
   * @param index The {@link IView view} index.
   * @param size The {@link IView view} size.
   */
  resizeView(index, size) {
    if (index < 0 || index >= this.viewItems.length) {
      return;
    }
    if (this.state !== 0 /* Idle */) {
      throw new Error("Cant modify splitview");
    }
    this.state = 1 /* Busy */;
    try {
      const indexes = range(this.viewItems.length).filter((i) => i !== index);
      const lowPriorityIndexes = [...indexes.filter((i) => this.viewItems[i].priority === 1 /* Low */), index];
      const highPriorityIndexes = indexes.filter((i) => this.viewItems[i].priority === 2 /* High */);
      const item = this.viewItems[index];
      size = Math.round(size);
      size = clamp(size, item.minimumSize, Math.min(item.maximumSize, this.size));
      item.size = size;
      this.relayout(lowPriorityIndexes, highPriorityIndexes);
    } finally {
      this.state = 0 /* Idle */;
    }
  }
  /**
   * Returns whether all other {@link IView views} are at their minimum size.
   */
  isViewExpanded(index) {
    if (index < 0 || index >= this.viewItems.length) {
      return false;
    }
    for (const item of this.viewItems) {
      if (item !== this.viewItems[index] && item.size > item.minimumSize) {
        return false;
      }
    }
    return true;
  }
  /**
   * Distribute the entire {@link SplitView} size among all {@link IView views}.
   */
  distributeViewSizes() {
    const flexibleViewItems = [];
    let flexibleSize = 0;
    for (const item of this.viewItems) {
      if (item.maximumSize - item.minimumSize > 0) {
        flexibleViewItems.push(item);
        flexibleSize += item.size;
      }
    }
    const size = Math.floor(flexibleSize / flexibleViewItems.length);
    for (const item of flexibleViewItems) {
      item.size = clamp(size, item.minimumSize, item.maximumSize);
    }
    const indexes = range(this.viewItems.length);
    const lowPriorityIndexes = indexes.filter((i) => this.viewItems[i].priority === 1 /* Low */);
    const highPriorityIndexes = indexes.filter((i) => this.viewItems[i].priority === 2 /* High */);
    this.relayout(lowPriorityIndexes, highPriorityIndexes);
  }
  /**
   * Returns the size of a {@link IView view}.
   */
  getViewSize(index) {
    if (index < 0 || index >= this.viewItems.length) {
      return -1;
    }
    return this.viewItems[index].size;
  }
  doAddView(view, size, index = this.viewItems.length, skipLayout) {
    if (this.state !== 0 /* Idle */) {
      throw new Error("Cant modify splitview");
    }
    this.state = 1 /* Busy */;
    try {
      const container = $(".split-view-view");
      if (index === this.viewItems.length) {
        this.viewContainer.appendChild(container);
      } else {
        this.viewContainer.insertBefore(container, this.viewContainer.children.item(index));
      }
      const onChangeDisposable = view.onDidChange((size2) => this.onViewChange(item, size2));
      const containerDisposable = toDisposable(() => container.remove());
      const disposable = combinedDisposable(onChangeDisposable, containerDisposable);
      let viewSize;
      if (typeof size === "number") {
        viewSize = size;
      } else {
        if (size.type === "auto") {
          if (this.areViewsDistributed()) {
            size = { type: "distribute" };
          } else {
            size = { type: "split", index: size.index };
          }
        }
        if (size.type === "split") {
          viewSize = this.getViewSize(size.index) / 2;
        } else if (size.type === "invisible") {
          viewSize = { cachedVisibleSize: size.cachedVisibleSize };
        } else {
          viewSize = view.minimumSize;
        }
      }
      const item = this.orientation === Orientation.VERTICAL ? new VerticalViewItem(container, view, viewSize, disposable) : new HorizontalViewItem(container, view, viewSize, disposable);
      this.viewItems.splice(index, 0, item);
      if (this.viewItems.length > 1) {
        const opts = { orthogonalStartSash: this.orthogonalStartSash, orthogonalEndSash: this.orthogonalEndSash };
        const sash = this.orientation === Orientation.VERTICAL ? new Sash(this.sashContainer, { getHorizontalSashTop: (s) => this.getSashPosition(s), getHorizontalSashWidth: this.getSashOrthogonalSize }, { ...opts, orientation: Orientation.HORIZONTAL }) : new Sash(this.sashContainer, { getVerticalSashLeft: (s) => this.getSashPosition(s), getVerticalSashHeight: this.getSashOrthogonalSize }, { ...opts, orientation: Orientation.VERTICAL });
        const sashEventMapper = this.orientation === Orientation.VERTICAL ? (e) => ({ sash, start: e.startY, current: e.currentY, alt: e.altKey }) : (e) => ({ sash, start: e.startX, current: e.currentX, alt: e.altKey });
        const onStart = Event.map(sash.onDidStart, sashEventMapper);
        const onStartDisposable = onStart(this.onSashStart, this);
        const onChange = Event.map(sash.onDidChange, sashEventMapper);
        const onChangeDisposable2 = onChange(this.onSashChange, this);
        const onEnd = Event.map(sash.onDidEnd, () => this.sashItems.findIndex((item2) => item2.sash === sash));
        const onEndDisposable = onEnd(this.onSashEnd, this);
        const onDidResetDisposable = sash.onDidReset(() => {
          const index2 = this.sashItems.findIndex((item2) => item2.sash === sash);
          const upIndexes = range(index2, -1);
          const downIndexes = range(index2 + 1, this.viewItems.length);
          const snapBeforeIndex = this.findFirstSnapIndex(upIndexes);
          const snapAfterIndex = this.findFirstSnapIndex(downIndexes);
          if (typeof snapBeforeIndex === "number" && !this.viewItems[snapBeforeIndex].visible) {
            return;
          }
          if (typeof snapAfterIndex === "number" && !this.viewItems[snapAfterIndex].visible) {
            return;
          }
          this._onDidSashReset.fire(index2);
        });
        const disposable2 = combinedDisposable(onStartDisposable, onChangeDisposable2, onEndDisposable, onDidResetDisposable, sash);
        const sashItem = { sash, disposable: disposable2 };
        this.sashItems.splice(index - 1, 0, sashItem);
      }
      container.appendChild(view.element);
      let highPriorityIndexes;
      if (typeof size !== "number" && size.type === "split") {
        highPriorityIndexes = [size.index];
      }
      if (!skipLayout) {
        this.relayout([index], highPriorityIndexes);
      }
      if (!skipLayout && typeof size !== "number" && size.type === "distribute") {
        this.distributeViewSizes();
      }
    } finally {
      this.state = 0 /* Idle */;
    }
  }
  relayout(lowPriorityIndexes, highPriorityIndexes) {
    const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
    this.resize(this.viewItems.length - 1, this.size - contentSize, void 0, lowPriorityIndexes, highPriorityIndexes);
    this.distributeEmptySpace();
    this.layoutViews();
    this.saveProportions();
  }
  resize(index, delta, sizes = this.viewItems.map((i) => i.size), lowPriorityIndexes, highPriorityIndexes, overloadMinDelta = Number.NEGATIVE_INFINITY, overloadMaxDelta = Number.POSITIVE_INFINITY, snapBefore, snapAfter) {
    if (index < 0 || index >= this.viewItems.length) {
      return 0;
    }
    const upIndexes = range(index, -1);
    const downIndexes = range(index + 1, this.viewItems.length);
    if (highPriorityIndexes) {
      for (const index2 of highPriorityIndexes) {
        pushToStart(upIndexes, index2);
        pushToStart(downIndexes, index2);
      }
    }
    if (lowPriorityIndexes) {
      for (const index2 of lowPriorityIndexes) {
        pushToEnd(upIndexes, index2);
        pushToEnd(downIndexes, index2);
      }
    }
    const upItems = upIndexes.map((i) => this.viewItems[i]);
    const upSizes = upIndexes.map((i) => sizes[i]);
    const downItems = downIndexes.map((i) => this.viewItems[i]);
    const downSizes = downIndexes.map((i) => sizes[i]);
    const minDeltaUp = upIndexes.reduce((r, i) => r + (this.viewItems[i].minimumSize - sizes[i]), 0);
    const maxDeltaUp = upIndexes.reduce((r, i) => r + (this.viewItems[i].maximumSize - sizes[i]), 0);
    const maxDeltaDown = downIndexes.length === 0 ? Number.POSITIVE_INFINITY : downIndexes.reduce((r, i) => r + (sizes[i] - this.viewItems[i].minimumSize), 0);
    const minDeltaDown = downIndexes.length === 0 ? Number.NEGATIVE_INFINITY : downIndexes.reduce((r, i) => r + (sizes[i] - this.viewItems[i].maximumSize), 0);
    const minDelta = Math.max(minDeltaUp, minDeltaDown, overloadMinDelta);
    const maxDelta = Math.min(maxDeltaDown, maxDeltaUp, overloadMaxDelta);
    let snapped = false;
    if (snapBefore) {
      const snapView = this.viewItems[snapBefore.index];
      const visible = delta >= snapBefore.limitDelta;
      snapped = visible !== snapView.visible;
      snapView.setVisible(visible, snapBefore.size);
    }
    if (!snapped && snapAfter) {
      const snapView = this.viewItems[snapAfter.index];
      const visible = delta < snapAfter.limitDelta;
      snapped = visible !== snapView.visible;
      snapView.setVisible(visible, snapAfter.size);
    }
    if (snapped) {
      return this.resize(index, delta, sizes, lowPriorityIndexes, highPriorityIndexes, overloadMinDelta, overloadMaxDelta);
    }
    delta = clamp(delta, minDelta, maxDelta);
    for (let i = 0, deltaUp = delta; i < upItems.length; i++) {
      const item = upItems[i];
      const size = clamp(upSizes[i] + deltaUp, item.minimumSize, item.maximumSize);
      const viewDelta = size - upSizes[i];
      deltaUp -= viewDelta;
      item.size = size;
    }
    for (let i = 0, deltaDown = delta; i < downItems.length; i++) {
      const item = downItems[i];
      const size = clamp(downSizes[i] - deltaDown, item.minimumSize, item.maximumSize);
      const viewDelta = size - downSizes[i];
      deltaDown += viewDelta;
      item.size = size;
    }
    return delta;
  }
  distributeEmptySpace(lowPriorityIndex) {
    const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
    let emptyDelta = this.size - contentSize;
    const indexes = range(this.viewItems.length - 1, -1);
    const lowPriorityIndexes = indexes.filter((i) => this.viewItems[i].priority === 1 /* Low */);
    const highPriorityIndexes = indexes.filter((i) => this.viewItems[i].priority === 2 /* High */);
    for (const index of highPriorityIndexes) {
      pushToStart(indexes, index);
    }
    for (const index of lowPriorityIndexes) {
      pushToEnd(indexes, index);
    }
    if (typeof lowPriorityIndex === "number") {
      pushToEnd(indexes, lowPriorityIndex);
    }
    for (let i = 0; emptyDelta !== 0 && i < indexes.length; i++) {
      const item = this.viewItems[indexes[i]];
      const size = clamp(item.size + emptyDelta, item.minimumSize, item.maximumSize);
      const viewDelta = size - item.size;
      emptyDelta -= viewDelta;
      item.size = size;
    }
  }
  layoutViews() {
    this._contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
    let offset = 0;
    for (const viewItem of this.viewItems) {
      viewItem.layout(offset, this.layoutContext);
      offset += viewItem.size;
    }
    this.sashItems.forEach((item) => item.sash.layout());
    this.updateSashEnablement();
    this.updateScrollableElement();
  }
  updateScrollableElement() {
    if (this.orientation === Orientation.VERTICAL) {
      this.scrollableElement.setScrollDimensions({
        height: this.size,
        scrollHeight: this._contentSize
      });
    } else {
      this.scrollableElement.setScrollDimensions({
        width: this.size,
        scrollWidth: this._contentSize
      });
    }
  }
  updateSashEnablement() {
    let previous = false;
    const collapsesDown = this.viewItems.map((i) => previous = i.size - i.minimumSize > 0 || previous);
    previous = false;
    const expandsDown = this.viewItems.map((i) => previous = i.maximumSize - i.size > 0 || previous);
    const reverseViews = [...this.viewItems].reverse();
    previous = false;
    const collapsesUp = reverseViews.map((i) => previous = i.size - i.minimumSize > 0 || previous).reverse();
    previous = false;
    const expandsUp = reverseViews.map((i) => previous = i.maximumSize - i.size > 0 || previous).reverse();
    let position = 0;
    for (let index = 0; index < this.sashItems.length; index++) {
      const { sash } = this.sashItems[index];
      const viewItem = this.viewItems[index];
      position += viewItem.size;
      const min = !(collapsesDown[index] && expandsUp[index + 1]);
      const max = !(expandsDown[index] && collapsesUp[index + 1]);
      if (min && max) {
        const upIndexes = range(index, -1);
        const downIndexes = range(index + 1, this.viewItems.length);
        const snapBeforeIndex = this.findFirstSnapIndex(upIndexes);
        const snapAfterIndex = this.findFirstSnapIndex(downIndexes);
        const snappedBefore = typeof snapBeforeIndex === "number" && !this.viewItems[snapBeforeIndex].visible;
        const snappedAfter = typeof snapAfterIndex === "number" && !this.viewItems[snapAfterIndex].visible;
        if (snappedBefore && collapsesUp[index] && (position > 0 || this.startSnappingEnabled)) {
          sash.state = SashState.AtMinimum;
        } else if (snappedAfter && collapsesDown[index] && (position < this._contentSize || this.endSnappingEnabled)) {
          sash.state = SashState.AtMaximum;
        } else {
          sash.state = SashState.Disabled;
        }
      } else if (min && !max) {
        sash.state = SashState.AtMinimum;
      } else if (!min && max) {
        sash.state = SashState.AtMaximum;
      } else {
        sash.state = SashState.Enabled;
      }
    }
  }
  getSashPosition(sash) {
    let position = 0;
    for (let i = 0; i < this.sashItems.length; i++) {
      position += this.viewItems[i].size;
      if (this.sashItems[i].sash === sash) {
        return position;
      }
    }
    return 0;
  }
  findFirstSnapIndex(indexes) {
    for (const index of indexes) {
      const viewItem = this.viewItems[index];
      if (!viewItem.visible) {
        continue;
      }
      if (viewItem.snap) {
        return index;
      }
    }
    for (const index of indexes) {
      const viewItem = this.viewItems[index];
      if (viewItem.visible && viewItem.maximumSize - viewItem.minimumSize > 0) {
        return void 0;
      }
      if (!viewItem.visible && viewItem.snap) {
        return index;
      }
    }
    return void 0;
  }
  areViewsDistributed() {
    let min = void 0, max = void 0;
    for (const view of this.viewItems) {
      min = min === void 0 ? view.size : Math.min(min, view.size);
      max = max === void 0 ? view.size : Math.max(max, view.size);
      if (max - min > 2) {
        return false;
      }
    }
    return true;
  }
  dispose() {
    this.sashDragState?.disposable.dispose();
    dispose(this.viewItems);
    this.viewItems = [];
    this.sashItems.forEach((i) => i.disposable.dispose());
    this.sashItems = [];
    super.dispose();
  }
}
export {
  LayoutPriority,
  Orientation2 as Orientation,
  Sizing,
  SplitView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvc3BsaXR2aWV3L3NwbGl0dmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7ICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgYXBwZW5kLCBnZXRXaW5kb3csIHNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUgfSBmcm9tICcuLi8uLi9kb20uanMnO1xuaW1wb3J0IHsgRG9tRW1pdHRlciB9IGZyb20gJy4uLy4uL2V2ZW50LmpzJztcbmltcG9ydCB7IElTYXNoRXZlbnQgYXMgSUJhc2VTYXNoRXZlbnQsIE9yaWVudGF0aW9uLCBTYXNoLCBTYXNoU3RhdGUgfSBmcm9tICcuLi9zYXNoL3Nhc2guanMnO1xuaW1wb3J0IHsgU21vb3RoU2Nyb2xsYWJsZUVsZW1lbnQgfSBmcm9tICcuLi9zY3JvbGxiYXIvc2Nyb2xsYWJsZUVsZW1lbnQuanMnO1xuaW1wb3J0IHsgcHVzaFRvRW5kLCBwdXNoVG9TdGFydCwgcmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGNvbWJpbmVkRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbnVtYmVycy5qcyc7XG5pbXBvcnQgeyBTY3JvbGxhYmxlLCBTY3JvbGxiYXJWaXNpYmlsaXR5LCBTY3JvbGxFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zY3JvbGxhYmxlLmpzJztcbmltcG9ydCAqIGFzIHR5cGVzIGZyb20gJy4uLy4uLy4uL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgJy4vc3BsaXR2aWV3LmNzcyc7XG5leHBvcnQgeyBPcmllbnRhdGlvbiB9IGZyb20gJy4uL3Nhc2gvc2FzaC5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNwbGl0Vmlld1N0eWxlcyB7XG5cdHJlYWRvbmx5IHNlcGFyYXRvckJvcmRlcjogQ29sb3I7XG59XG5cbmNvbnN0IGRlZmF1bHRTdHlsZXM6IElTcGxpdFZpZXdTdHlsZXMgPSB7XG5cdHNlcGFyYXRvckJvcmRlcjogQ29sb3IudHJhbnNwYXJlbnRcbn07XG5cbmV4cG9ydCBjb25zdCBlbnVtIExheW91dFByaW9yaXR5IHtcblx0Tm9ybWFsLFxuXHRMb3csXG5cdEhpZ2hcbn1cblxuLyoqXG4gKiBUaGUgaW50ZXJmYWNlIHRvIGltcGxlbWVudCBmb3Igdmlld3Mgd2l0aGluIGEge0BsaW5rIFNwbGl0Vmlld30uXG4gKlxuICogQW4gb3B0aW9uYWwge0BsaW5rIFRMYXlvdXRDb250ZXh0IGxheW91dCBjb250ZXh0IHR5cGV9IG1heSBiZSB1c2VkIGluIG9yZGVyIHRvXG4gKiBwYXNzIGFsb25nIGxheW91dCBjb250ZXh0dWFsIGRhdGEgZnJvbSB0aGUge0BsaW5rIFNwbGl0Vmlldy5sYXlvdXR9IG1ldGhvZCBkb3duXG4gKiB0byBlYWNoIHZpZXcncyB7QGxpbmsgSVZpZXcubGF5b3V0fSBjYWxscy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJVmlldzxUTGF5b3V0Q29udGV4dCA9IHVuZGVmaW5lZD4ge1xuXG5cdC8qKlxuXHQgKiBUaGUgRE9NIGVsZW1lbnQgZm9yIHRoaXMgdmlldy5cblx0ICovXG5cdHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXG5cdC8qKlxuXHQgKiBBIG1pbmltdW0gc2l6ZSBmb3IgdGhpcyB2aWV3LlxuXHQgKlxuXHQgKiBAcmVtYXJrcyBJZiBub25lLCBzZXQgaXQgdG8gYDBgLlxuXHQgKi9cblx0cmVhZG9ubHkgbWluaW11bVNpemU6IG51bWJlcjtcblxuXHQvKipcblx0ICogQSBtYXhpbXVtIHNpemUgZm9yIHRoaXMgdmlldy5cblx0ICpcblx0ICogQHJlbWFya3MgSWYgbm9uZSwgc2V0IGl0IHRvIGBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFlgLlxuXHQgKi9cblx0cmVhZG9ubHkgbWF4aW11bVNpemU6IG51bWJlcjtcblxuXHQvKipcblx0ICogVGhlIHByaW9yaXR5IG9mIHRoZSB2aWV3IHdoZW4gdGhlIHtAbGluayBTcGxpdFZpZXcucmVzaXplIGxheW91dH0gYWxnb3JpdGhtXG5cdCAqIHJ1bnMuIFZpZXdzIHdpdGggaGlnaGVyIHByaW9yaXR5IHdpbGwgYmUgcmVzaXplZCBmaXJzdC5cblx0ICpcblx0ICogQHJlbWFya3MgT25seSB1c2VkIHdoZW4gYHByb3BvcnRpb25hbExheW91dGAgaXMgZmFsc2UuXG5cdCAqL1xuXHRyZWFkb25seSBwcmlvcml0eT86IExheW91dFByaW9yaXR5O1xuXG5cdC8qKlxuXHQgKiBJZiB0aGUge0BsaW5rIFNwbGl0Vmlld30gc3VwcG9ydHMge0BsaW5rIElTcGxpdFZpZXdPcHRpb25zLnByb3BvcnRpb25hbExheW91dCBwcm9wb3J0aW9uYWwgbGF5b3V0fSxcblx0ICogdGhpcyBwcm9wZXJ0eSBhbGxvd3MgZm9yIGZpbmVyIGNvbnRyb2wgb3ZlciB0aGUgcHJvcG9ydGlvbmFsIGxheW91dCBhbGdvcml0aG0sIHBlciB2aWV3LlxuXHQgKlxuXHQgKiBAZGVmYXVsdFZhbHVlIGB0cnVlYFxuXHQgKi9cblx0cmVhZG9ubHkgcHJvcG9ydGlvbmFsTGF5b3V0PzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGUgdmlldyB3aWxsIHNuYXAgd2hlbmV2ZXIgdGhlIHVzZXIgcmVhY2hlcyBpdHMgbWluaW11bSBzaXplIG9yXG5cdCAqIGF0dGVtcHRzIHRvIGdyb3cgaXQgYmV5b25kIHRoZSBtaW5pbXVtIHNpemUuXG5cdCAqXG5cdCAqIEBkZWZhdWx0VmFsdWUgYGZhbHNlYFxuXHQgKi9cblx0cmVhZG9ubHkgc25hcD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFZpZXcgaW5zdGFuY2VzIGFyZSBzdXBwb3NlZCB0byBmaXJlIHRoZSB7QGxpbmsgSVZpZXcub25EaWRDaGFuZ2V9IGV2ZW50IHdoZW5ldmVyXG5cdCAqIGFueSBvZiB0aGUgY29uc3RyYWludCBwcm9wZXJ0aWVzIGhhdmUgY2hhbmdlZDpcblx0ICpcblx0ICogLSB7QGxpbmsgSVZpZXcubWluaW11bVNpemV9XG5cdCAqIC0ge0BsaW5rIElWaWV3Lm1heGltdW1TaXplfVxuXHQgKiAtIHtAbGluayBJVmlldy5wcmlvcml0eX1cblx0ICogLSB7QGxpbmsgSVZpZXcuc25hcH1cblx0ICpcblx0ICogVGhlIFNwbGl0VmlldyB3aWxsIHJlbGF5b3V0IHdoZW5ldmVyIHRoYXQgaGFwcGVucy4gVGhlIGV2ZW50IGNhbiBvcHRpb25hbGx5IGVtaXRcblx0ICogdGhlIHZpZXcncyBwcmVmZXJyZWQgc2l6ZSBmb3IgdGhhdCByZWxheW91dC5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDxudW1iZXIgfCB1bmRlZmluZWQ+O1xuXG5cdC8qKlxuXHQgKiBUaGlzIHdpbGwgYmUgY2FsbGVkIGJ5IHRoZSB7QGxpbmsgU3BsaXRWaWV3fSBkdXJpbmcgbGF5b3V0LiBBIHZpZXcgbWVhbnQgdG9cblx0ICogcGFzcyBhbG9uZyB0aGUgbGF5b3V0IGluZm9ybWF0aW9uIGRvd24gdG8gaXRzIGRlc2NlbmRhbnRzLlxuXHQgKlxuXHQgKiBAcGFyYW0gc2l6ZSBUaGUgc2l6ZSBvZiB0aGlzIHZpZXcsIGluIHBpeGVscy5cblx0ICogQHBhcmFtIG9mZnNldCBUaGUgb2Zmc2V0IG9mIHRoaXMgdmlldywgcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSB7QGxpbmsgU3BsaXRWaWV3fS5cblx0ICogQHBhcmFtIGNvbnRleHQgVGhlIG9wdGlvbmFsIHtAbGluayBJVmlldyBsYXlvdXQgY29udGV4dH0gcGFzc2VkIHRvIHtAbGluayBTcGxpdFZpZXcubGF5b3V0fS5cblx0ICovXG5cdGxheW91dChzaXplOiBudW1iZXIsIG9mZnNldDogbnVtYmVyLCBjb250ZXh0OiBUTGF5b3V0Q29udGV4dCB8IHVuZGVmaW5lZCk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIFRoaXMgd2lsbCBiZSBjYWxsZWQgYnkgdGhlIHtAbGluayBTcGxpdFZpZXd9IHdoZW5ldmVyIHRoaXMgdmlldyBpcyBtYWRlXG5cdCAqIHZpc2libGUgb3IgaGlkZGVuLlxuXHQgKlxuXHQgKiBAcGFyYW0gdmlzaWJsZSBXaGV0aGVyIHRoZSB2aWV3IGJlY29tZXMgdmlzaWJsZS5cblx0ICovXG5cdHNldFZpc2libGU/KHZpc2libGU6IGJvb2xlYW4pOiB2b2lkO1xufVxuXG4vKipcbiAqIEEgZGVzY3JpcHRvciBmb3IgYSB7QGxpbmsgU3BsaXRWaWV3fSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJU3BsaXRWaWV3RGVzY3JpcHRvcjxUTGF5b3V0Q29udGV4dCA9IHVuZGVmaW5lZCwgVFZpZXcgZXh0ZW5kcyBJVmlldzxUTGF5b3V0Q29udGV4dD4gPSBJVmlldzxUTGF5b3V0Q29udGV4dD4+IHtcblxuXHQvKipcblx0ICogVGhlIGxheW91dCBzaXplIG9mIHRoZSB7QGxpbmsgU3BsaXRWaWV3fS5cblx0ICovXG5cdHJlYWRvbmx5IHNpemU6IG51bWJlcjtcblxuXHQvKipcblx0ICogRGVzY3JpcHRvcnMgZm9yIGVhY2gge0BsaW5rIElWaWV3IHZpZXd9LlxuXHQgKi9cblx0cmVhZG9ubHkgdmlld3M6IHtcblxuXHRcdC8qKlxuXHRcdCAqIFdoZXRoZXIgdGhlIHtAbGluayBJVmlldyB2aWV3fSBpcyB2aXNpYmxlLlxuXHRcdCAqXG5cdFx0ICogQGRlZmF1bHRWYWx1ZSBgdHJ1ZWBcblx0XHQgKi9cblx0XHRyZWFkb25seSB2aXNpYmxlPzogYm9vbGVhbjtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBzaXplIG9mIHRoZSB7QGxpbmsgSVZpZXcgdmlld30uXG5cdFx0ICpcblx0XHQgKiBAZGVmYXVsdFZhbHVlIGB0cnVlYFxuXHRcdCAqL1xuXHRcdHJlYWRvbmx5IHNpemU6IG51bWJlcjtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBzaXplIG9mIHRoZSB7QGxpbmsgSVZpZXcgdmlld30uXG5cdFx0ICpcblx0XHQgKiBAZGVmYXVsdFZhbHVlIGB0cnVlYFxuXHRcdCAqL1xuXHRcdHJlYWRvbmx5IHZpZXc6IFRWaWV3O1xuXHR9W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNwbGl0Vmlld09wdGlvbnM8VExheW91dENvbnRleHQgPSB1bmRlZmluZWQsIFRWaWV3IGV4dGVuZHMgSVZpZXc8VExheW91dENvbnRleHQ+ID0gSVZpZXc8VExheW91dENvbnRleHQ+PiB7XG5cblx0LyoqXG5cdCAqIFdoaWNoIGF4aXMgdGhlIHZpZXdzIGFsaWduIG9uLlxuXHQgKlxuXHQgKiBAZGVmYXVsdFZhbHVlIGBPcmllbnRhdGlvbi5WRVJUSUNBTGBcblx0ICovXG5cdHJlYWRvbmx5IG9yaWVudGF0aW9uPzogT3JpZW50YXRpb247XG5cblx0LyoqXG5cdCAqIFN0eWxlcyBvdmVycmlkaW5nIHRoZSB7QGxpbmsgZGVmYXVsdFN0eWxlcyBkZWZhdWx0IG9uZXN9LlxuXHQgKi9cblx0cmVhZG9ubHkgc3R5bGVzPzogSVNwbGl0Vmlld1N0eWxlcztcblxuXHQvKipcblx0ICogTWFrZSBBbHQtZHJhZyB0aGUgZGVmYXVsdCBkcmFnIG9wZXJhdGlvbi5cblx0ICovXG5cdHJlYWRvbmx5IGludmVyc2VBbHRCZWhhdmlvcj86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFJlc2l6ZSBlYWNoIHZpZXcgcHJvcG9ydGlvbmFsbHkgd2hlbiByZXNpemluZyB0aGUgU3BsaXRWaWV3LlxuXHQgKlxuXHQgKiBAZGVmYXVsdFZhbHVlIGB0cnVlYFxuXHQgKi9cblx0cmVhZG9ubHkgcHJvcG9ydGlvbmFsTGF5b3V0PzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogQW4gaW5pdGlhbCBkZXNjcmlwdGlvbiBvZiB0aGlzIHtAbGluayBTcGxpdFZpZXd9IGluc3RhbmNlLCBhbGxvd2luZ1xuXHQgKiB0byBpbml0aWFsemUgYWxsIHZpZXdzIHdpdGhpbiB0aGUgY3Rvci5cblx0ICovXG5cdHJlYWRvbmx5IGRlc2NyaXB0b3I/OiBJU3BsaXRWaWV3RGVzY3JpcHRvcjxUTGF5b3V0Q29udGV4dCwgVFZpZXc+O1xuXG5cdC8qKlxuXHQgKiBUaGUgc2Nyb2xsYmFyIHZpc2liaWxpdHkgc2V0dGluZyBmb3Igd2hlbmV2ZXIgdGhlIHZpZXdzIHdpdGhpblxuXHQgKiB0aGUge0BsaW5rIFNwbGl0Vmlld30gb3ZlcmZsb3cuXG5cdCAqL1xuXHRyZWFkb25seSBzY3JvbGxiYXJWaXNpYmlsaXR5PzogU2Nyb2xsYmFyVmlzaWJpbGl0eTtcblxuXHQvKipcblx0ICogT3ZlcnJpZGUgdGhlIG9ydGhvZ29uYWwgc2l6ZSBvZiBzYXNoZXMuXG5cdCAqL1xuXHRyZWFkb25seSBnZXRTYXNoT3J0aG9nb25hbFNpemU/OiAoKSA9PiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBJU2FzaEV2ZW50IHtcblx0cmVhZG9ubHkgc2FzaDogU2FzaDtcblx0cmVhZG9ubHkgc3RhcnQ6IG51bWJlcjtcblx0cmVhZG9ubHkgY3VycmVudDogbnVtYmVyO1xuXHRyZWFkb25seSBhbHQ6IGJvb2xlYW47XG59XG5cbnR5cGUgVmlld0l0ZW1TaXplID0gbnVtYmVyIHwgeyBjYWNoZWRWaXNpYmxlU2l6ZTogbnVtYmVyIH07XG5cbmFic3RyYWN0IGNsYXNzIFZpZXdJdGVtPFRMYXlvdXRDb250ZXh0LCBUVmlldyBleHRlbmRzIElWaWV3PFRMYXlvdXRDb250ZXh0Pj4ge1xuXG5cdHByaXZhdGUgX3NpemU6IG51bWJlcjtcblx0c2V0IHNpemUoc2l6ZTogbnVtYmVyKSB7XG5cdFx0dGhpcy5fc2l6ZSA9IHNpemU7XG5cdH1cblxuXHRnZXQgc2l6ZSgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9zaXplO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2FjaGVkVmlzaWJsZVNpemU6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0Z2V0IGNhY2hlZFZpc2libGVTaXplKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9jYWNoZWRWaXNpYmxlU2l6ZTsgfVxuXG5cdGdldCB2aXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0eXBlb2YgdGhpcy5fY2FjaGVkVmlzaWJsZVNpemUgPT09ICd1bmRlZmluZWQnO1xuXHR9XG5cblx0c2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuLCBzaXplPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKHZpc2libGUgPT09IHRoaXMudmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh2aXNpYmxlKSB7XG5cdFx0XHR0aGlzLnNpemUgPSBjbGFtcCh0aGlzLl9jYWNoZWRWaXNpYmxlU2l6ZSEsIHRoaXMudmlld01pbmltdW1TaXplLCB0aGlzLnZpZXdNYXhpbXVtU2l6ZSk7XG5cdFx0XHR0aGlzLl9jYWNoZWRWaXNpYmxlU2l6ZSA9IHVuZGVmaW5lZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY2FjaGVkVmlzaWJsZVNpemUgPSB0eXBlb2Ygc2l6ZSA9PT0gJ251bWJlcicgPyBzaXplIDogdGhpcy5zaXplO1xuXHRcdFx0dGhpcy5zaXplID0gMDtcblx0XHR9XG5cblx0XHR0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCd2aXNpYmxlJywgdmlzaWJsZSk7XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy52aWV3LnNldFZpc2libGU/Lih2aXNpYmxlKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdTcGxpdHZpZXc6IEZhaWxlZCB0byBzZXQgdmlzaWJsZSB2aWV3Jyk7XG5cdFx0XHRjb25zb2xlLmVycm9yKGUpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBtaW5pbXVtU2l6ZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy52aXNpYmxlID8gdGhpcy52aWV3Lm1pbmltdW1TaXplIDogMDsgfVxuXHRnZXQgdmlld01pbmltdW1TaXplKCk6IG51bWJlciB7IHJldHVybiB0aGlzLnZpZXcubWluaW11bVNpemU7IH1cblxuXHRnZXQgbWF4aW11bVNpemUoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMudmlzaWJsZSA/IHRoaXMudmlldy5tYXhpbXVtU2l6ZSA6IDA7IH1cblx0Z2V0IHZpZXdNYXhpbXVtU2l6ZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy52aWV3Lm1heGltdW1TaXplOyB9XG5cblx0Z2V0IHByaW9yaXR5KCk6IExheW91dFByaW9yaXR5IHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMudmlldy5wcmlvcml0eTsgfVxuXHRnZXQgcHJvcG9ydGlvbmFsTGF5b3V0KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy52aWV3LnByb3BvcnRpb25hbExheW91dCA/PyB0cnVlOyB9XG5cdGdldCBzbmFwKCk6IGJvb2xlYW4geyByZXR1cm4gISF0aGlzLnZpZXcuc25hcDsgfVxuXG5cdHNldCBlbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5wb2ludGVyRXZlbnRzID0gZW5hYmxlZCA/ICcnIDogJ25vbmUnO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJvdGVjdGVkIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cmVhZG9ubHkgdmlldzogVFZpZXcsXG5cdFx0c2l6ZTogVmlld0l0ZW1TaXplLFxuXHRcdHByaXZhdGUgZGlzcG9zYWJsZTogSURpc3Bvc2FibGVcblx0KSB7XG5cdFx0aWYgKHR5cGVvZiBzaXplID09PSAnbnVtYmVyJykge1xuXHRcdFx0dGhpcy5fc2l6ZSA9IHNpemU7XG5cdFx0XHR0aGlzLl9jYWNoZWRWaXNpYmxlU2l6ZSA9IHVuZGVmaW5lZDtcblx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3NpemUgPSAwO1xuXHRcdFx0dGhpcy5fY2FjaGVkVmlzaWJsZVNpemUgPSBzaXplLmNhY2hlZFZpc2libGVTaXplO1xuXHRcdH1cblx0fVxuXG5cdGxheW91dChvZmZzZXQ6IG51bWJlciwgbGF5b3V0Q29udGV4dDogVExheW91dENvbnRleHQgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLmxheW91dENvbnRhaW5lcihvZmZzZXQpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMudmlldy5sYXlvdXQodGhpcy5zaXplLCBvZmZzZXQsIGxheW91dENvbnRleHQpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1NwbGl0dmlldzogRmFpbGVkIHRvIGxheW91dCB2aWV3Jyk7XG5cdFx0XHRjb25zb2xlLmVycm9yKGUpO1xuXHRcdH1cblx0fVxuXG5cdGFic3RyYWN0IGxheW91dENvbnRhaW5lcihvZmZzZXQ6IG51bWJlcik6IHZvaWQ7XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIFZlcnRpY2FsVmlld0l0ZW08VExheW91dENvbnRleHQsIFRWaWV3IGV4dGVuZHMgSVZpZXc8VExheW91dENvbnRleHQ+PiBleHRlbmRzIFZpZXdJdGVtPFRMYXlvdXRDb250ZXh0LCBUVmlldz4ge1xuXG5cdGxheW91dENvbnRhaW5lcihvZmZzZXQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLnRvcCA9IGAke29mZnNldH1weGA7XG5cdFx0dGhpcy5jb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7dGhpcy5zaXplfXB4YDtcblx0fVxufVxuXG5jbGFzcyBIb3Jpem9udGFsVmlld0l0ZW08VExheW91dENvbnRleHQsIFRWaWV3IGV4dGVuZHMgSVZpZXc8VExheW91dENvbnRleHQ+PiBleHRlbmRzIFZpZXdJdGVtPFRMYXlvdXRDb250ZXh0LCBUVmlldz4ge1xuXG5cdGxheW91dENvbnRhaW5lcihvZmZzZXQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLmxlZnQgPSBgJHtvZmZzZXR9cHhgO1xuXHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7dGhpcy5zaXplfXB4YDtcblx0fVxufVxuXG5pbnRlcmZhY2UgSVNhc2hJdGVtIHtcblx0c2FzaDogU2FzaDtcblx0ZGlzcG9zYWJsZTogSURpc3Bvc2FibGU7XG59XG5cbmludGVyZmFjZSBJU2FzaERyYWdTbmFwU3RhdGUge1xuXHRyZWFkb25seSBpbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBsaW1pdERlbHRhOiBudW1iZXI7XG5cdHJlYWRvbmx5IHNpemU6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElTYXNoRHJhZ1N0YXRlIHtcblx0aW5kZXg6IG51bWJlcjtcblx0c3RhcnQ6IG51bWJlcjtcblx0Y3VycmVudDogbnVtYmVyO1xuXHRzaXplczogbnVtYmVyW107XG5cdG1pbkRlbHRhOiBudW1iZXI7XG5cdG1heERlbHRhOiBudW1iZXI7XG5cdGFsdDogYm9vbGVhbjtcblx0c25hcEJlZm9yZTogSVNhc2hEcmFnU25hcFN0YXRlIHwgdW5kZWZpbmVkO1xuXHRzbmFwQWZ0ZXI6IElTYXNoRHJhZ1NuYXBTdGF0ZSB8IHVuZGVmaW5lZDtcblx0ZGlzcG9zYWJsZTogSURpc3Bvc2FibGU7XG59XG5cbmVudW0gU3RhdGUge1xuXHRJZGxlLFxuXHRCdXN5XG59XG5cbi8qKlxuICogV2hlbiBhZGRpbmcgb3IgcmVtb3Zpbmcgdmlld3MsIHVuaWZvcm1seSBkaXN0cmlidXRlIHRoZSBlbnRpcmUgc3BsaXQgdmlldyBzcGFjZSBhbW9uZ1xuICogYWxsIHZpZXdzLlxuICovXG5leHBvcnQgdHlwZSBEaXN0cmlidXRlU2l6aW5nID0geyB0eXBlOiAnZGlzdHJpYnV0ZScgfTtcblxuLyoqXG4gKiBXaGVuIGFkZGluZyBhIHZpZXcsIG1ha2Ugc3BhY2UgZm9yIGl0IGJ5IHJlZHVjaW5nIHRoZSBzaXplIG9mIGFub3RoZXIgdmlldyxcbiAqIGluZGV4ZWQgYnkgdGhlIHByb3ZpZGVkIGBpbmRleGAuXG4gKi9cbmV4cG9ydCB0eXBlIFNwbGl0U2l6aW5nID0geyB0eXBlOiAnc3BsaXQnOyBpbmRleDogbnVtYmVyIH07XG5cbi8qKlxuICogV2hlbiBhZGRpbmcgYSB2aWV3LCB1c2UgRGlzdHJpYnV0ZVNpemluZyB3aGVuIGFsbCBwcmUtZXhpc3Rpbmcgdmlld3MgYXJlXG4gKiBkaXN0cmlidXRlZCBldmVubHksIG90aGVyd2lzZSB1c2UgU3BsaXRTaXppbmcuXG4gKi9cbmV4cG9ydCB0eXBlIEF1dG9TaXppbmcgPSB7IHR5cGU6ICdhdXRvJzsgaW5kZXg6IG51bWJlciB9O1xuXG4vKipcbiAqIFdoZW4gYWRkaW5nIG9yIHJlbW92aW5nIHZpZXdzLCBhc3N1bWUgdGhlIHZpZXcgaXMgaW52aXNpYmxlLlxuICovXG5leHBvcnQgdHlwZSBJbnZpc2libGVTaXppbmcgPSB7IHR5cGU6ICdpbnZpc2libGUnOyBjYWNoZWRWaXNpYmxlU2l6ZTogbnVtYmVyIH07XG5cbi8qKlxuICogV2hlbiBhZGRpbmcgb3IgcmVtb3Zpbmcgdmlld3MsIHRoZSBzaXppbmcgcHJvdmlkZXMgZmluZSBncmFpbmVkXG4gKiBjb250cm9sIG92ZXIgaG93IG90aGVyIHZpZXdzIGdldCByZXNpemVkLlxuICovXG5leHBvcnQgdHlwZSBTaXppbmcgPSBEaXN0cmlidXRlU2l6aW5nIHwgU3BsaXRTaXppbmcgfCBBdXRvU2l6aW5nIHwgSW52aXNpYmxlU2l6aW5nO1xuXG5leHBvcnQgbmFtZXNwYWNlIFNpemluZyB7XG5cblx0LyoqXG5cdCAqIFdoZW4gYWRkaW5nIG9yIHJlbW92aW5nIHZpZXdzLCBkaXN0cmlidXRlIHRoZSBkZWx0YSBzcGFjZSBhbW9uZ1xuXHQgKiBhbGwgb3RoZXIgdmlld3MuXG5cdCAqL1xuXHRleHBvcnQgY29uc3QgRGlzdHJpYnV0ZTogRGlzdHJpYnV0ZVNpemluZyA9IHsgdHlwZTogJ2Rpc3RyaWJ1dGUnIH07XG5cblx0LyoqXG5cdCAqIFdoZW4gYWRkaW5nIG9yIHJlbW92aW5nIHZpZXdzLCBzcGxpdCB0aGUgZGVsdGEgc3BhY2Ugd2l0aCBhbm90aGVyXG5cdCAqIHNwZWNpZmljIHZpZXcsIGluZGV4ZWQgYnkgdGhlIHByb3ZpZGVkIGBpbmRleGAuXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gU3BsaXQoaW5kZXg6IG51bWJlcik6IFNwbGl0U2l6aW5nIHsgcmV0dXJuIHsgdHlwZTogJ3NwbGl0JywgaW5kZXggfTsgfVxuXG5cdC8qKlxuXHQgKiBXaGVuIGFkZGluZyBhIHZpZXcsIHVzZSBEaXN0cmlidXRlU2l6aW5nIHdoZW4gYWxsIHByZS1leGlzdGluZyB2aWV3cyBhcmVcblx0ICogZGlzdHJpYnV0ZWQgZXZlbmx5LCBvdGhlcndpc2UgdXNlIFNwbGl0U2l6aW5nLlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIEF1dG8oaW5kZXg6IG51bWJlcik6IEF1dG9TaXppbmcgeyByZXR1cm4geyB0eXBlOiAnYXV0bycsIGluZGV4IH07IH1cblxuXHQvKipcblx0ICogV2hlbiBhZGRpbmcgb3IgcmVtb3Zpbmcgdmlld3MsIGFzc3VtZSB0aGUgdmlldyBpcyBpbnZpc2libGUuXG5cdCAqL1xuXHRleHBvcnQgZnVuY3Rpb24gSW52aXNpYmxlKGNhY2hlZFZpc2libGVTaXplOiBudW1iZXIpOiBJbnZpc2libGVTaXppbmcgeyByZXR1cm4geyB0eXBlOiAnaW52aXNpYmxlJywgY2FjaGVkVmlzaWJsZVNpemUgfTsgfVxufVxuXG4vKipcbiAqIFRoZSB7QGxpbmsgU3BsaXRWaWV3fSBpcyB0aGUgVUkgY29tcG9uZW50IHdoaWNoIGltcGxlbWVudHMgYSBvbmUgZGltZW5zaW9uYWxcbiAqIGZsZXgtbGlrZSBsYXlvdXQgYWxnb3JpdGhtIGZvciBhIGNvbGxlY3Rpb24gb2Yge0BsaW5rIElWaWV3fSBpbnN0YW5jZXMsIHdoaWNoXG4gKiBhcmUgZXNzZW50aWFsbHkgSFRNTEVsZW1lbnQgaW5zdGFuY2VzIHdpdGggdGhlIGZvbGxvd2luZyBzaXplIGNvbnN0cmFpbnRzOlxuICpcbiAqIC0ge0BsaW5rIElWaWV3Lm1pbmltdW1TaXplfVxuICogLSB7QGxpbmsgSVZpZXcubWF4aW11bVNpemV9XG4gKiAtIHtAbGluayBJVmlldy5wcmlvcml0eX1cbiAqIC0ge0BsaW5rIElWaWV3LnNuYXB9XG4gKlxuICogSW4gY2FzZSB0aGUgU3BsaXRWaWV3IGRvZXNuJ3QgaGF2ZSBlbm91Z2ggc2l6ZSB0byBmaXQgYWxsIHZpZXdzLCBpdCB3aWxsIG92ZXJmbG93XG4gKiBpdHMgY29udGVudCB3aXRoIGEgc2Nyb2xsYmFyLlxuICpcbiAqIEluIGJldHdlZW4gZWFjaCBwYWlyIG9mIHZpZXdzIHRoZXJlIHdpbGwgYmUgYSB7QGxpbmsgU2FzaH0gYWxsb3dpbmcgdGhlIHVzZXJcbiAqIHRvIHJlc2l6ZSB0aGUgdmlld3MsIG1ha2luZyBzdXJlIHRoZSBjb25zdHJhaW50cyBhcmUgcmVzcGVjdGVkLlxuICpcbiAqIEFuIG9wdGlvbmFsIHtAbGluayBUTGF5b3V0Q29udGV4dCBsYXlvdXQgY29udGV4dCB0eXBlfSBtYXkgYmUgdXNlZCBpbiBvcmRlciB0b1xuICogcGFzcyBhbG9uZyBsYXlvdXQgY29udGV4dHVhbCBkYXRhIGZyb20gdGhlIHtAbGluayBTcGxpdFZpZXcubGF5b3V0fSBtZXRob2QgZG93blxuICogdG8gZWFjaCB2aWV3J3Mge0BsaW5rIElWaWV3LmxheW91dH0gY2FsbHMuXG4gKlxuICogRmVhdHVyZXM6XG4gKiAtIEZsZXgtbGlrZSBsYXlvdXQgYWxnb3JpdGhtXG4gKiAtIFNuYXAgc3VwcG9ydFxuICogLSBPcnRob2dvbmFsIHNhc2ggc3VwcG9ydCwgZm9yIGNvcm5lciBzYXNoZXNcbiAqIC0gVmlldyBoaWRlL3Nob3cgc3VwcG9ydFxuICogLSBWaWV3IHN3YXAvbW92ZSBzdXBwb3J0XG4gKiAtIEFsdCBrZXkgbW9kaWZpZXIgYmVoYXZpb3IsIG1hY09TIHN0eWxlXG4gKi9cbmV4cG9ydCBjbGFzcyBTcGxpdFZpZXc8VExheW91dENvbnRleHQgPSB1bmRlZmluZWQsIFRWaWV3IGV4dGVuZHMgSVZpZXc8VExheW91dENvbnRleHQ+ID0gSVZpZXc8VExheW91dENvbnRleHQ+PiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdC8qKlxuXHQgKiBUaGlzIHtAbGluayBTcGxpdFZpZXd9J3Mgb3JpZW50YXRpb24uXG5cdCAqL1xuXHRyZWFkb25seSBvcmllbnRhdGlvbjogT3JpZW50YXRpb247XG5cblx0LyoqXG5cdCAqIFRoZSBET00gZWxlbWVudCByZXByZXNlbnRpbmcgdGhpcyB7QGxpbmsgU3BsaXRWaWV3fS5cblx0ICovXG5cdHJlYWRvbmx5IGVsOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIHNhc2hDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHZpZXdDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHNjcm9sbGFibGU6IFNjcm9sbGFibGU7XG5cdHByaXZhdGUgc2Nyb2xsYWJsZUVsZW1lbnQ6IFNtb290aFNjcm9sbGFibGVFbGVtZW50O1xuXHRwcml2YXRlIHNpemUgPSAwO1xuXHRwcml2YXRlIGxheW91dENvbnRleHQ6IFRMYXlvdXRDb250ZXh0IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jb250ZW50U2l6ZSA9IDA7XG5cdHByaXZhdGUgcHJvcG9ydGlvbnM6IChudW1iZXIgfCB1bmRlZmluZWQpW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgdmlld0l0ZW1zOiBWaWV3SXRlbTxUTGF5b3V0Q29udGV4dCwgVFZpZXc+W10gPSBbXTtcblx0c2FzaEl0ZW1zOiBJU2FzaEl0ZW1bXSA9IFtdOyAvLyB1c2VkIGluIHRlc3RzXG5cdHByaXZhdGUgc2FzaERyYWdTdGF0ZTogSVNhc2hEcmFnU3RhdGUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgc3RhdGU6IFN0YXRlID0gU3RhdGUuSWRsZTtcblx0cHJpdmF0ZSBpbnZlcnNlQWx0QmVoYXZpb3I6IGJvb2xlYW47XG5cdHByaXZhdGUgcHJvcG9ydGlvbmFsTGF5b3V0OiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IGdldFNhc2hPcnRob2dvbmFsU2l6ZTogeyAoKTogbnVtYmVyIH0gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfb25EaWRTYXNoQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblx0cHJpdmF0ZSBfb25EaWRTYXNoUmVzZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRwcml2YXRlIF9vcnRob2dvbmFsU3RhcnRTYXNoOiBTYXNoIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9vcnRob2dvbmFsRW5kU2FzaDogU2FzaCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfc3RhcnRTbmFwcGluZ0VuYWJsZWQgPSB0cnVlO1xuXHRwcml2YXRlIF9lbmRTbmFwcGluZ0VuYWJsZWQgPSB0cnVlO1xuXG5cdC8qKlxuXHQgKiBUaGUgc3VtIG9mIGFsbCB2aWV3cycgc2l6ZXMuXG5cdCAqL1xuXHRnZXQgY29udGVudFNpemUoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX2NvbnRlbnRTaXplOyB9XG5cblx0LyoqXG5cdCAqIEZpcmVzIHdoZW5ldmVyIHRoZSB1c2VyIHJlc2l6ZXMgYSB7QGxpbmsgU2FzaCBzYXNofS5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkU2FzaENoYW5nZSA9IHRoaXMuX29uRGlkU2FzaENoYW5nZS5ldmVudDtcblxuXHQvKipcblx0ICogRmlyZXMgd2hlbmV2ZXIgdGhlIHVzZXIgZG91YmxlIGNsaWNrcyBhIHtAbGluayBTYXNoIHNhc2h9LlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRTYXNoUmVzZXQgPSB0aGlzLl9vbkRpZFNhc2hSZXNldC5ldmVudDtcblxuXHQvKipcblx0ICogRmlyZXMgd2hlbmV2ZXIgdGhlIHNwbGl0IHZpZXcgaXMgc2Nyb2xsZWQuXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZFNjcm9sbDogRXZlbnQ8U2Nyb2xsRXZlbnQ+O1xuXG5cdC8qKlxuXHQgKiBUaGUgYW1vdW50IG9mIHZpZXdzIGluIHRoaXMge0BsaW5rIFNwbGl0Vmlld30uXG5cdCAqL1xuXHRnZXQgbGVuZ3RoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMudmlld0l0ZW1zLmxlbmd0aDtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgbWluaW11bSBzaXplIG9mIHRoaXMge0BsaW5rIFNwbGl0Vmlld30uXG5cdCAqL1xuXHRnZXQgbWluaW11bVNpemUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy52aWV3SXRlbXMucmVkdWNlKChyLCBpdGVtKSA9PiByICsgaXRlbS5taW5pbXVtU2l6ZSwgMCk7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIG1heGltdW0gc2l6ZSBvZiB0aGlzIHtAbGluayBTcGxpdFZpZXd9LlxuXHQgKi9cblx0Z2V0IG1heGltdW1TaXplKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubGVuZ3RoID09PSAwID8gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZIDogdGhpcy52aWV3SXRlbXMucmVkdWNlKChyLCBpdGVtKSA9PiByICsgaXRlbS5tYXhpbXVtU2l6ZSwgMCk7XG5cdH1cblxuXHRnZXQgb3J0aG9nb25hbFN0YXJ0U2FzaCgpOiBTYXNoIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX29ydGhvZ29uYWxTdGFydFNhc2g7IH1cblx0Z2V0IG9ydGhvZ29uYWxFbmRTYXNoKCk6IFNhc2ggfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fb3J0aG9nb25hbEVuZFNhc2g7IH1cblx0Z2V0IHN0YXJ0U25hcHBpbmdFbmFibGVkKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fc3RhcnRTbmFwcGluZ0VuYWJsZWQ7IH1cblx0Z2V0IGVuZFNuYXBwaW5nRW5hYmxlZCgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2VuZFNuYXBwaW5nRW5hYmxlZDsgfVxuXG5cdC8qKlxuXHQgKiBBIHJlZmVyZW5jZSB0byBhIHNhc2gsIHBlcnBlbmRpY3VsYXIgdG8gYWxsIHNhc2hlcyBpbiB0aGlzIHtAbGluayBTcGxpdFZpZXd9LFxuXHQgKiBsb2NhdGVkIGF0IHRoZSBsZWZ0LSBvciB0b3AtbW9zdCBzaWRlIG9mIHRoZSBTcGxpdFZpZXcuXG5cdCAqIENvcm5lciBzYXNoZXMgd2lsbCBiZSBjcmVhdGVkIGF1dG9tYXRpY2FsbHkgYXQgdGhlIGludGVyc2VjdGlvbnMuXG5cdCAqL1xuXHRzZXQgb3J0aG9nb25hbFN0YXJ0U2FzaChzYXNoOiBTYXNoIHwgdW5kZWZpbmVkKSB7XG5cdFx0Zm9yIChjb25zdCBzYXNoSXRlbSBvZiB0aGlzLnNhc2hJdGVtcykge1xuXHRcdFx0c2FzaEl0ZW0uc2FzaC5vcnRob2dvbmFsU3RhcnRTYXNoID0gc2FzaDtcblx0XHR9XG5cblx0XHR0aGlzLl9vcnRob2dvbmFsU3RhcnRTYXNoID0gc2FzaDtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIHJlZmVyZW5jZSB0byBhIHNhc2gsIHBlcnBlbmRpY3VsYXIgdG8gYWxsIHNhc2hlcyBpbiB0aGlzIHtAbGluayBTcGxpdFZpZXd9LFxuXHQgKiBsb2NhdGVkIGF0IHRoZSByaWdodC0gb3IgYm90dG9tLW1vc3Qgc2lkZSBvZiB0aGUgU3BsaXRWaWV3LlxuXHQgKiBDb3JuZXIgc2FzaGVzIHdpbGwgYmUgY3JlYXRlZCBhdXRvbWF0aWNhbGx5IGF0IHRoZSBpbnRlcnNlY3Rpb25zLlxuXHQgKi9cblx0c2V0IG9ydGhvZ29uYWxFbmRTYXNoKHNhc2g6IFNhc2ggfCB1bmRlZmluZWQpIHtcblx0XHRmb3IgKGNvbnN0IHNhc2hJdGVtIG9mIHRoaXMuc2FzaEl0ZW1zKSB7XG5cdFx0XHRzYXNoSXRlbS5zYXNoLm9ydGhvZ29uYWxFbmRTYXNoID0gc2FzaDtcblx0XHR9XG5cblx0XHR0aGlzLl9vcnRob2dvbmFsRW5kU2FzaCA9IHNhc2g7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGludGVybmFsIHNhc2hlcyB3aXRoaW4gdGhpcyB7QGxpbmsgU3BsaXRWaWV3fS5cblx0ICovXG5cdGdldCBzYXNoZXMoKTogcmVhZG9ubHkgU2FzaFtdIHtcblx0XHRyZXR1cm4gdGhpcy5zYXNoSXRlbXMubWFwKHMgPT4gcy5zYXNoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFbmFibGUvZGlzYWJsZSBzbmFwcGluZyBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoaXMge0BsaW5rIFNwbGl0Vmlld30uXG5cdCAqL1xuXHRzZXQgc3RhcnRTbmFwcGluZ0VuYWJsZWQoc3RhcnRTbmFwcGluZ0VuYWJsZWQ6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5fc3RhcnRTbmFwcGluZ0VuYWJsZWQgPT09IHN0YXJ0U25hcHBpbmdFbmFibGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fc3RhcnRTbmFwcGluZ0VuYWJsZWQgPSBzdGFydFNuYXBwaW5nRW5hYmxlZDtcblx0XHR0aGlzLnVwZGF0ZVNhc2hFbmFibGVtZW50KCk7XG5cdH1cblxuXHQvKipcblx0ICogRW5hYmxlL2Rpc2FibGUgc25hcHBpbmcgYXQgdGhlIGVuZCBvZiB0aGlzIHtAbGluayBTcGxpdFZpZXd9LlxuXHQgKi9cblx0c2V0IGVuZFNuYXBwaW5nRW5hYmxlZChlbmRTbmFwcGluZ0VuYWJsZWQ6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5fZW5kU25hcHBpbmdFbmFibGVkID09PSBlbmRTbmFwcGluZ0VuYWJsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9lbmRTbmFwcGluZ0VuYWJsZWQgPSBlbmRTbmFwcGluZ0VuYWJsZWQ7XG5cdFx0dGhpcy51cGRhdGVTYXNoRW5hYmxlbWVudCgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIG5ldyB7QGxpbmsgU3BsaXRWaWV3fSBpbnN0YW5jZS5cblx0ICovXG5cdGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG9wdGlvbnM6IElTcGxpdFZpZXdPcHRpb25zPFRMYXlvdXRDb250ZXh0LCBUVmlldz4gPSB7fSkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLm9yaWVudGF0aW9uID0gb3B0aW9ucy5vcmllbnRhdGlvbiA/PyBPcmllbnRhdGlvbi5WRVJUSUNBTDtcblx0XHR0aGlzLmludmVyc2VBbHRCZWhhdmlvciA9IG9wdGlvbnMuaW52ZXJzZUFsdEJlaGF2aW9yID8/IGZhbHNlO1xuXHRcdHRoaXMucHJvcG9ydGlvbmFsTGF5b3V0ID0gb3B0aW9ucy5wcm9wb3J0aW9uYWxMYXlvdXQgPz8gdHJ1ZTtcblx0XHR0aGlzLmdldFNhc2hPcnRob2dvbmFsU2l6ZSA9IG9wdGlvbnMuZ2V0U2FzaE9ydGhvZ29uYWxTaXplO1xuXG5cdFx0dGhpcy5lbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuZWwuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLXNwbGl0LXZpZXcyJyk7XG5cdFx0dGhpcy5lbC5jbGFzc0xpc3QuYWRkKHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMID8gJ3ZlcnRpY2FsJyA6ICdob3Jpem9udGFsJyk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuZWwpO1xuXG5cdFx0dGhpcy5zYXNoQ29udGFpbmVyID0gYXBwZW5kKHRoaXMuZWwsICQoJy5zYXNoLWNvbnRhaW5lcicpKTtcblx0XHR0aGlzLnZpZXdDb250YWluZXIgPSAkKCcuc3BsaXQtdmlldy1jb250YWluZXInKTtcblxuXHRcdHRoaXMuc2Nyb2xsYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTY3JvbGxhYmxlKHtcblx0XHRcdGZvcmNlSW50ZWdlclZhbHVlczogdHJ1ZSxcblx0XHRcdHNtb290aFNjcm9sbER1cmF0aW9uOiAxMjUsXG5cdFx0XHRzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lOiBjYWxsYmFjayA9PiBzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKGdldFdpbmRvdyh0aGlzLmVsKSwgY2FsbGJhY2spLFxuXHRcdH0pKTtcblx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNtb290aFNjcm9sbGFibGVFbGVtZW50KHRoaXMudmlld0NvbnRhaW5lciwge1xuXHRcdFx0dmVydGljYWw6IHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMID8gKG9wdGlvbnMuc2Nyb2xsYmFyVmlzaWJpbGl0eSA/PyBTY3JvbGxiYXJWaXNpYmlsaXR5LkF1dG8pIDogU2Nyb2xsYmFyVmlzaWJpbGl0eS5IaWRkZW4sXG5cdFx0XHRob3Jpem9udGFsOiB0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5IT1JJWk9OVEFMID8gKG9wdGlvbnMuc2Nyb2xsYmFyVmlzaWJpbGl0eSA/PyBTY3JvbGxiYXJWaXNpYmlsaXR5LkF1dG8pIDogU2Nyb2xsYmFyVmlzaWJpbGl0eS5IaWRkZW5cblx0XHR9LCB0aGlzLnNjcm9sbGFibGUpKTtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNTc3Mzdcblx0XHRjb25zdCBvbkRpZFNjcm9sbFZpZXdDb250YWluZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcih0aGlzLnZpZXdDb250YWluZXIsICdzY3JvbGwnKSkuZXZlbnQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIob25EaWRTY3JvbGxWaWV3Q29udGFpbmVyKF8gPT4ge1xuXHRcdFx0Y29uc3QgcG9zaXRpb24gPSB0aGlzLnNjcm9sbGFibGVFbGVtZW50LmdldFNjcm9sbFBvc2l0aW9uKCk7XG5cdFx0XHRjb25zdCBzY3JvbGxMZWZ0ID0gTWF0aC5hYnModGhpcy52aWV3Q29udGFpbmVyLnNjcm9sbExlZnQgLSBwb3NpdGlvbi5zY3JvbGxMZWZ0KSA8PSAxID8gdW5kZWZpbmVkIDogdGhpcy52aWV3Q29udGFpbmVyLnNjcm9sbExlZnQ7XG5cdFx0XHRjb25zdCBzY3JvbGxUb3AgPSBNYXRoLmFicyh0aGlzLnZpZXdDb250YWluZXIuc2Nyb2xsVG9wIC0gcG9zaXRpb24uc2Nyb2xsVG9wKSA8PSAxID8gdW5kZWZpbmVkIDogdGhpcy52aWV3Q29udGFpbmVyLnNjcm9sbFRvcDtcblxuXHRcdFx0aWYgKHNjcm9sbExlZnQgIT09IHVuZGVmaW5lZCB8fCBzY3JvbGxUb3AgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsTGVmdCwgc2Nyb2xsVG9wIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMub25EaWRTY3JvbGwgPSB0aGlzLnNjcm9sbGFibGVFbGVtZW50Lm9uU2Nyb2xsO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRTY3JvbGwoZSA9PiB7XG5cdFx0XHRpZiAoZS5zY3JvbGxUb3BDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMudmlld0NvbnRhaW5lci5zY3JvbGxUb3AgPSBlLnNjcm9sbFRvcDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuc2Nyb2xsTGVmdENoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy52aWV3Q29udGFpbmVyLnNjcm9sbExlZnQgPSBlLnNjcm9sbExlZnQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXBwZW5kKHRoaXMuZWwsIHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0RG9tTm9kZSgpKTtcblxuXHRcdHRoaXMuc3R5bGUob3B0aW9ucy5zdHlsZXMgfHwgZGVmYXVsdFN0eWxlcyk7XG5cblx0XHQvLyBXZSBoYXZlIGFuIGV4aXN0aW5nIHNldCBvZiB2aWV3LCBhZGQgdGhlbSBub3dcblx0XHRpZiAob3B0aW9ucy5kZXNjcmlwdG9yKSB7XG5cdFx0XHR0aGlzLnNpemUgPSBvcHRpb25zLmRlc2NyaXB0b3Iuc2l6ZTtcblx0XHRcdG9wdGlvbnMuZGVzY3JpcHRvci52aWV3cy5mb3JFYWNoKCh2aWV3RGVzY3JpcHRvciwgaW5kZXgpID0+IHtcblx0XHRcdFx0Y29uc3Qgc2l6aW5nID0gdHlwZXMuaXNVbmRlZmluZWQodmlld0Rlc2NyaXB0b3IudmlzaWJsZSkgfHwgdmlld0Rlc2NyaXB0b3IudmlzaWJsZSA/IHZpZXdEZXNjcmlwdG9yLnNpemUgOiB7IHR5cGU6ICdpbnZpc2libGUnLCBjYWNoZWRWaXNpYmxlU2l6ZTogdmlld0Rlc2NyaXB0b3Iuc2l6ZSB9IHNhdGlzZmllcyBJbnZpc2libGVTaXppbmc7XG5cblx0XHRcdFx0Y29uc3QgdmlldyA9IHZpZXdEZXNjcmlwdG9yLnZpZXc7XG5cdFx0XHRcdHRoaXMuZG9BZGRWaWV3KHZpZXcsIHNpemluZywgaW5kZXgsIHRydWUpO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIEluaXRpYWxpemUgY29udGVudCBzaXplIGFuZCBwcm9wb3J0aW9ucyBmb3IgZmlyc3QgbGF5b3V0XG5cdFx0XHR0aGlzLl9jb250ZW50U2l6ZSA9IHRoaXMudmlld0l0ZW1zLnJlZHVjZSgociwgaSkgPT4gciArIGkuc2l6ZSwgMCk7XG5cdFx0XHR0aGlzLnNhdmVQcm9wb3J0aW9ucygpO1xuXHRcdH1cblx0fVxuXG5cdHN0eWxlKHN0eWxlczogSVNwbGl0Vmlld1N0eWxlcyk6IHZvaWQge1xuXHRcdGlmIChzdHlsZXMuc2VwYXJhdG9yQm9yZGVyLmlzVHJhbnNwYXJlbnQoKSkge1xuXHRcdFx0dGhpcy5lbC5jbGFzc0xpc3QucmVtb3ZlKCdzZXBhcmF0b3ItYm9yZGVyJyk7XG5cdFx0XHR0aGlzLmVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCctLXNlcGFyYXRvci1ib3JkZXInKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5lbC5jbGFzc0xpc3QuYWRkKCdzZXBhcmF0b3ItYm9yZGVyJyk7XG5cdFx0XHR0aGlzLmVsLnN0eWxlLnNldFByb3BlcnR5KCctLXNlcGFyYXRvci1ib3JkZXInLCBzdHlsZXMuc2VwYXJhdG9yQm9yZGVyLnRvU3RyaW5nKCkpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBBZGQgYSB7QGxpbmsgSVZpZXcgdmlld30gdG8gdGhpcyB7QGxpbmsgU3BsaXRWaWV3fS5cblx0ICpcblx0ICogQHBhcmFtIHZpZXcgVGhlIHZpZXcgdG8gYWRkLlxuXHQgKiBAcGFyYW0gc2l6ZSBFaXRoZXIgYSBmaXhlZCBzaXplLCBvciBhIGR5bmFtaWMge0BsaW5rIFNpemluZ30gc3RyYXRlZ3kuXG5cdCAqIEBwYXJhbSBpbmRleCBUaGUgaW5kZXggdG8gaW5zZXJ0IHRoZSB2aWV3IG9uLlxuXHQgKiBAcGFyYW0gc2tpcExheW91dCBXaGV0aGVyIGxheW91dCBzaG91bGQgYmUgc2tpcHBlZC5cblx0ICovXG5cdGFkZFZpZXcodmlldzogVFZpZXcsIHNpemU6IG51bWJlciB8IFNpemluZywgaW5kZXggPSB0aGlzLnZpZXdJdGVtcy5sZW5ndGgsIHNraXBMYXlvdXQ/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5kb0FkZFZpZXcodmlldywgc2l6ZSwgaW5kZXgsIHNraXBMYXlvdXQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbW92ZSBhIHtAbGluayBJVmlldyB2aWV3fSBmcm9tIHRoaXMge0BsaW5rIFNwbGl0Vmlld30uXG5cdCAqXG5cdCAqIEBwYXJhbSBpbmRleCBUaGUgaW5kZXggd2hlcmUgdGhlIHtAbGluayBJVmlldyB2aWV3fSBpcyBsb2NhdGVkLlxuXHQgKiBAcGFyYW0gc2l6aW5nIFdoZXRoZXIgdG8gZGlzdHJpYnV0ZSBvdGhlciB7QGxpbmsgSVZpZXcgdmlld30ncyBzaXplcy5cblx0ICovXG5cdHJlbW92ZVZpZXcoaW5kZXg6IG51bWJlciwgc2l6aW5nPzogU2l6aW5nKTogVFZpZXcge1xuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy52aWV3SXRlbXMubGVuZ3RoKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0luZGV4IG91dCBvZiBib3VuZHMnKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zdGF0ZSAhPT0gU3RhdGUuSWRsZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW50IG1vZGlmeSBzcGxpdHZpZXcnKTtcblx0XHR9XG5cblx0XHR0aGlzLnN0YXRlID0gU3RhdGUuQnVzeTtcblxuXHRcdHRyeSB7XG5cdFx0XHRpZiAoc2l6aW5nPy50eXBlID09PSAnYXV0bycpIHtcblx0XHRcdFx0aWYgKHRoaXMuYXJlVmlld3NEaXN0cmlidXRlZCgpKSB7XG5cdFx0XHRcdFx0c2l6aW5nID0geyB0eXBlOiAnZGlzdHJpYnV0ZScgfTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzaXppbmcgPSB7IHR5cGU6ICdzcGxpdCcsIGluZGV4OiBzaXppbmcuaW5kZXggfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBTYXZlIHJlZmVyZW5lIHZpZXcsIGluIGNhc2Ugb2YgYHNwbGl0YCBzaXppbmdcblx0XHRcdGNvbnN0IHJlZmVyZW5jZVZpZXdJdGVtID0gc2l6aW5nPy50eXBlID09PSAnc3BsaXQnID8gdGhpcy52aWV3SXRlbXNbc2l6aW5nLmluZGV4XSA6IHVuZGVmaW5lZDtcblxuXHRcdFx0Ly8gUmVtb3ZlIHZpZXdcblx0XHRcdGNvbnN0IHZpZXdJdGVtVG9SZW1vdmUgPSB0aGlzLnZpZXdJdGVtcy5zcGxpY2UoaW5kZXgsIDEpWzBdO1xuXG5cdFx0XHQvLyBSZXNpemUgcmVmZXJlbmNlIHZpZXcsIGluIGNhc2Ugb2YgYHNwbGl0YCBzaXppbmdcblx0XHRcdGlmIChyZWZlcmVuY2VWaWV3SXRlbSkge1xuXHRcdFx0XHRyZWZlcmVuY2VWaWV3SXRlbS5zaXplICs9IHZpZXdJdGVtVG9SZW1vdmUuc2l6ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVtb3ZlIHNhc2hcblx0XHRcdGlmICh0aGlzLnZpZXdJdGVtcy5sZW5ndGggPj0gMSkge1xuXHRcdFx0XHRjb25zdCBzYXNoSW5kZXggPSBNYXRoLm1heChpbmRleCAtIDEsIDApO1xuXHRcdFx0XHRjb25zdCBzYXNoSXRlbSA9IHRoaXMuc2FzaEl0ZW1zLnNwbGljZShzYXNoSW5kZXgsIDEpWzBdO1xuXHRcdFx0XHRzYXNoSXRlbS5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5yZWxheW91dCgpO1xuXG5cdFx0XHRpZiAoc2l6aW5nPy50eXBlID09PSAnZGlzdHJpYnV0ZScpIHtcblx0XHRcdFx0dGhpcy5kaXN0cmlidXRlVmlld1NpemVzKCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHZpZXdJdGVtVG9SZW1vdmUudmlldztcblx0XHRcdHZpZXdJdGVtVG9SZW1vdmUuZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnN0YXRlID0gU3RhdGUuSWRsZTtcblx0XHR9XG5cdH1cblxuXHRyZW1vdmVBbGxWaWV3cygpOiBUVmlld1tdIHtcblx0XHRpZiAodGhpcy5zdGF0ZSAhPT0gU3RhdGUuSWRsZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW50IG1vZGlmeSBzcGxpdHZpZXcnKTtcblx0XHR9XG5cblx0XHR0aGlzLnN0YXRlID0gU3RhdGUuQnVzeTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB2aWV3SXRlbXMgPSB0aGlzLnZpZXdJdGVtcy5zcGxpY2UoMCwgdGhpcy52aWV3SXRlbXMubGVuZ3RoKTtcblxuXHRcdFx0Zm9yIChjb25zdCB2aWV3SXRlbSBvZiB2aWV3SXRlbXMpIHtcblx0XHRcdFx0dmlld0l0ZW0uZGlzcG9zZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzYXNoSXRlbXMgPSB0aGlzLnNhc2hJdGVtcy5zcGxpY2UoMCwgdGhpcy5zYXNoSXRlbXMubGVuZ3RoKTtcblxuXHRcdFx0Zm9yIChjb25zdCBzYXNoSXRlbSBvZiBzYXNoSXRlbXMpIHtcblx0XHRcdFx0c2FzaEl0ZW0uZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucmVsYXlvdXQoKTtcblx0XHRcdHJldHVybiB2aWV3SXRlbXMubWFwKGkgPT4gaS52aWV3KTtcblxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnN0YXRlID0gU3RhdGUuSWRsZTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogTW92ZSBhIHtAbGluayBJVmlldyB2aWV3fSB0byBhIGRpZmZlcmVudCBpbmRleC5cblx0ICpcblx0ICogQHBhcmFtIGZyb20gVGhlIHNvdXJjZSBpbmRleC5cblx0ICogQHBhcmFtIHRvIFRoZSB0YXJnZXQgaW5kZXguXG5cdCAqL1xuXHRtb3ZlVmlldyhmcm9tOiBudW1iZXIsIHRvOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zdGF0ZSAhPT0gU3RhdGUuSWRsZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW50IG1vZGlmeSBzcGxpdHZpZXcnKTtcblx0XHR9XG5cblx0XHRjb25zdCBjYWNoZWRWaXNpYmxlU2l6ZSA9IHRoaXMuZ2V0Vmlld0NhY2hlZFZpc2libGVTaXplKGZyb20pO1xuXHRcdGNvbnN0IHNpemluZyA9IHR5cGVvZiBjYWNoZWRWaXNpYmxlU2l6ZSA9PT0gJ3VuZGVmaW5lZCcgPyB0aGlzLmdldFZpZXdTaXplKGZyb20pIDogU2l6aW5nLkludmlzaWJsZShjYWNoZWRWaXNpYmxlU2l6ZSk7XG5cdFx0Y29uc3QgdmlldyA9IHRoaXMucmVtb3ZlVmlldyhmcm9tKTtcblx0XHR0aGlzLmFkZFZpZXcodmlldywgc2l6aW5nLCB0byk7XG5cdH1cblxuXG5cdC8qKlxuXHQgKiBTd2FwIHR3byB7QGxpbmsgSVZpZXcgdmlld3N9LlxuXHQgKlxuXHQgKiBAcGFyYW0gZnJvbSBUaGUgc291cmNlIGluZGV4LlxuXHQgKiBAcGFyYW0gdG8gVGhlIHRhcmdldCBpbmRleC5cblx0ICovXG5cdHN3YXBWaWV3cyhmcm9tOiBudW1iZXIsIHRvOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zdGF0ZSAhPT0gU3RhdGUuSWRsZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW50IG1vZGlmeSBzcGxpdHZpZXcnKTtcblx0XHR9XG5cblx0XHRpZiAoZnJvbSA+IHRvKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zd2FwVmlld3ModG8sIGZyb20pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZyb21TaXplID0gdGhpcy5nZXRWaWV3U2l6ZShmcm9tKTtcblx0XHRjb25zdCB0b1NpemUgPSB0aGlzLmdldFZpZXdTaXplKHRvKTtcblx0XHRjb25zdCB0b1ZpZXcgPSB0aGlzLnJlbW92ZVZpZXcodG8pO1xuXHRcdGNvbnN0IGZyb21WaWV3ID0gdGhpcy5yZW1vdmVWaWV3KGZyb20pO1xuXG5cdFx0dGhpcy5hZGRWaWV3KHRvVmlldywgZnJvbVNpemUsIGZyb20pO1xuXHRcdHRoaXMuYWRkVmlldyhmcm9tVmlldywgdG9TaXplLCB0byk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB3aGV0aGVyIHRoZSB7QGxpbmsgSVZpZXcgdmlld30gaXMgdmlzaWJsZS5cblx0ICpcblx0ICogQHBhcmFtIGluZGV4IFRoZSB7QGxpbmsgSVZpZXcgdmlld30gaW5kZXguXG5cdCAqL1xuXHRpc1ZpZXdWaXNpYmxlKGluZGV4OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMudmlld0l0ZW1zLmxlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbmRleCBvdXQgb2YgYm91bmRzJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld0l0ZW0gPSB0aGlzLnZpZXdJdGVtc1tpbmRleF07XG5cdFx0cmV0dXJuIHZpZXdJdGVtLnZpc2libGU7XG5cdH1cblxuXHQvKipcblx0ICogU2V0IGEge0BsaW5rIElWaWV3IHZpZXd9J3MgdmlzaWJpbGl0eS5cblx0ICpcblx0ICogQHBhcmFtIGluZGV4IFRoZSB7QGxpbmsgSVZpZXcgdmlld30gaW5kZXguXG5cdCAqIEBwYXJhbSB2aXNpYmxlIFdoZXRoZXIgdGhlIHtAbGluayBJVmlldyB2aWV3fSBzaG91bGQgYmUgdmlzaWJsZS5cblx0ICovXG5cdHNldFZpZXdWaXNpYmxlKGluZGV4OiBudW1iZXIsIHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMudmlld0l0ZW1zLmxlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbmRleCBvdXQgb2YgYm91bmRzJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld0l0ZW0gPSB0aGlzLnZpZXdJdGVtc1tpbmRleF07XG5cdFx0dmlld0l0ZW0uc2V0VmlzaWJsZSh2aXNpYmxlKTtcblxuXHRcdHRoaXMuZGlzdHJpYnV0ZUVtcHR5U3BhY2UoaW5kZXgpO1xuXHRcdHRoaXMubGF5b3V0Vmlld3MoKTtcblx0XHR0aGlzLnNhdmVQcm9wb3J0aW9ucygpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHtAbGluayBJVmlldyB2aWV3fSdzIHNpemUgcHJldmlvdXNseSB0byBiZWluZyBoaWRkZW4uXG5cdCAqXG5cdCAqIEBwYXJhbSBpbmRleCBUaGUge0BsaW5rIElWaWV3IHZpZXd9IGluZGV4LlxuXHQgKi9cblx0Z2V0Vmlld0NhY2hlZFZpc2libGVTaXplKGluZGV4OiBudW1iZXIpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy52aWV3SXRlbXMubGVuZ3RoKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0luZGV4IG91dCBvZiBib3VuZHMnKTtcblx0XHR9XG5cblx0XHRjb25zdCB2aWV3SXRlbSA9IHRoaXMudmlld0l0ZW1zW2luZGV4XTtcblx0XHRyZXR1cm4gdmlld0l0ZW0uY2FjaGVkVmlzaWJsZVNpemU7XG5cdH1cblxuXHQvKipcblx0ICogTGF5b3V0IHRoZSB7QGxpbmsgU3BsaXRWaWV3fS5cblx0ICpcblx0ICogQHBhcmFtIHNpemUgVGhlIGVudGlyZSBzaXplIG9mIHRoZSB7QGxpbmsgU3BsaXRWaWV3fS5cblx0ICogQHBhcmFtIGxheW91dENvbnRleHQgQW4gb3B0aW9uYWwgbGF5b3V0IGNvbnRleHQgdG8gcGFzcyBhbG9uZyB0byB7QGxpbmsgSVZpZXcgdmlld3N9LlxuXHQgKi9cblx0bGF5b3V0KHNpemU6IG51bWJlciwgbGF5b3V0Q29udGV4dD86IFRMYXlvdXRDb250ZXh0KTogdm9pZCB7XG5cdFx0Y29uc3QgcHJldmlvdXNTaXplID0gTWF0aC5tYXgodGhpcy5zaXplLCB0aGlzLl9jb250ZW50U2l6ZSk7XG5cdFx0dGhpcy5zaXplID0gc2l6ZTtcblx0XHR0aGlzLmxheW91dENvbnRleHQgPSBsYXlvdXRDb250ZXh0O1xuXG5cdFx0aWYgKCF0aGlzLnByb3BvcnRpb25zKSB7XG5cdFx0XHRjb25zdCBpbmRleGVzID0gcmFuZ2UodGhpcy52aWV3SXRlbXMubGVuZ3RoKTtcblx0XHRcdGNvbnN0IGxvd1ByaW9yaXR5SW5kZXhlcyA9IGluZGV4ZXMuZmlsdGVyKGkgPT4gdGhpcy52aWV3SXRlbXNbaV0ucHJpb3JpdHkgPT09IExheW91dFByaW9yaXR5Lkxvdyk7XG5cdFx0XHRjb25zdCBoaWdoUHJpb3JpdHlJbmRleGVzID0gaW5kZXhlcy5maWx0ZXIoaSA9PiB0aGlzLnZpZXdJdGVtc1tpXS5wcmlvcml0eSA9PT0gTGF5b3V0UHJpb3JpdHkuSGlnaCk7XG5cblx0XHRcdHRoaXMucmVzaXplKHRoaXMudmlld0l0ZW1zLmxlbmd0aCAtIDEsIHNpemUgLSBwcmV2aW91c1NpemUsIHVuZGVmaW5lZCwgbG93UHJpb3JpdHlJbmRleGVzLCBoaWdoUHJpb3JpdHlJbmRleGVzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGV0IHRvdGFsID0gMDtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnZpZXdJdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gdGhpcy52aWV3SXRlbXNbaV07XG5cdFx0XHRcdGNvbnN0IHByb3BvcnRpb24gPSB0aGlzLnByb3BvcnRpb25zW2ldO1xuXG5cdFx0XHRcdGlmICh0eXBlb2YgcHJvcG9ydGlvbiA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHR0b3RhbCArPSBwcm9wb3J0aW9uO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNpemUgLT0gaXRlbS5zaXplO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy52aWV3SXRlbXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMudmlld0l0ZW1zW2ldO1xuXHRcdFx0XHRjb25zdCBwcm9wb3J0aW9uID0gdGhpcy5wcm9wb3J0aW9uc1tpXTtcblxuXHRcdFx0XHRpZiAodHlwZW9mIHByb3BvcnRpb24gPT09ICdudW1iZXInICYmIHRvdGFsID4gMCkge1xuXHRcdFx0XHRcdGl0ZW0uc2l6ZSA9IGNsYW1wKE1hdGgucm91bmQocHJvcG9ydGlvbiAqIHNpemUgLyB0b3RhbCksIGl0ZW0ubWluaW11bVNpemUsIGl0ZW0ubWF4aW11bVNpemUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5kaXN0cmlidXRlRW1wdHlTcGFjZSgpO1xuXHRcdHRoaXMubGF5b3V0Vmlld3MoKTtcblx0fVxuXG5cdHByaXZhdGUgc2F2ZVByb3BvcnRpb25zKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnByb3BvcnRpb25hbExheW91dCAmJiB0aGlzLl9jb250ZW50U2l6ZSA+IDApIHtcblx0XHRcdHRoaXMucHJvcG9ydGlvbnMgPSB0aGlzLnZpZXdJdGVtcy5tYXAodiA9PiB2LnByb3BvcnRpb25hbExheW91dCAmJiB2LnZpc2libGUgPyB2LnNpemUgLyB0aGlzLl9jb250ZW50U2l6ZSA6IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblNhc2hTdGFydCh7IHNhc2gsIHN0YXJ0LCBhbHQgfTogSVNhc2hFdmVudCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLnZpZXdJdGVtcykge1xuXHRcdFx0aXRlbS5lbmFibGVkID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLnNhc2hJdGVtcy5maW5kSW5kZXgoaXRlbSA9PiBpdGVtLnNhc2ggPT09IHNhc2gpO1xuXG5cdFx0Ly8gVGhpcyB3YXksIHdlIGNhbiBwcmVzcyBBbHQgd2hpbGUgd2UgcmVzaXplIGEgc2FzaCwgbWFjT1Mgc3R5bGUhXG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGNvbWJpbmVkRGlzcG9zYWJsZShcblx0XHRcdGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsLm93bmVyRG9jdW1lbnQuYm9keSwgJ2tleWRvd24nLCBlID0+IHJlc2V0U2FzaERyYWdTdGF0ZSh0aGlzLnNhc2hEcmFnU3RhdGUhLmN1cnJlbnQsIGUuYWx0S2V5KSksXG5cdFx0XHRhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5lbC5vd25lckRvY3VtZW50LmJvZHksICdrZXl1cCcsICgpID0+IHJlc2V0U2FzaERyYWdTdGF0ZSh0aGlzLnNhc2hEcmFnU3RhdGUhLmN1cnJlbnQsIGZhbHNlKSlcblx0XHQpO1xuXG5cdFx0Y29uc3QgcmVzZXRTYXNoRHJhZ1N0YXRlID0gKHN0YXJ0OiBudW1iZXIsIGFsdDogYm9vbGVhbikgPT4ge1xuXHRcdFx0Y29uc3Qgc2l6ZXMgPSB0aGlzLnZpZXdJdGVtcy5tYXAoaSA9PiBpLnNpemUpO1xuXHRcdFx0bGV0IG1pbkRlbHRhID0gTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZO1xuXHRcdFx0bGV0IG1heERlbHRhID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuXG5cdFx0XHRpZiAodGhpcy5pbnZlcnNlQWx0QmVoYXZpb3IpIHtcblx0XHRcdFx0YWx0ID0gIWFsdDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFsdCkge1xuXHRcdFx0XHQvLyBXaGVuIHdlJ3JlIHVzaW5nIHRoZSBsYXN0IHNhc2ggd2l0aCBBbHQsIHdlJ3JlIHJlc2l6aW5nXG5cdFx0XHRcdC8vIHRoZSB2aWV3IHRvIHRoZSBsZWZ0L3VwLCBpbnN0ZWFkIG9mIHJpZ2h0L2Rvd24gYXMgdXN1YWxcblx0XHRcdFx0Ly8gVGh1cywgd2UgbXVzdCBkbyB0aGUgaW52ZXJzZSBvZiB0aGUgdXN1YWxcblx0XHRcdFx0Y29uc3QgaXNMYXN0U2FzaCA9IGluZGV4ID09PSB0aGlzLnNhc2hJdGVtcy5sZW5ndGggLSAxO1xuXG5cdFx0XHRcdGlmIChpc0xhc3RTYXNoKSB7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld0l0ZW0gPSB0aGlzLnZpZXdJdGVtc1tpbmRleF07XG5cdFx0XHRcdFx0bWluRGVsdGEgPSAodmlld0l0ZW0ubWluaW11bVNpemUgLSB2aWV3SXRlbS5zaXplKSAvIDI7XG5cdFx0XHRcdFx0bWF4RGVsdGEgPSAodmlld0l0ZW0ubWF4aW11bVNpemUgLSB2aWV3SXRlbS5zaXplKSAvIDI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld0l0ZW0gPSB0aGlzLnZpZXdJdGVtc1tpbmRleCArIDFdO1xuXHRcdFx0XHRcdG1pbkRlbHRhID0gKHZpZXdJdGVtLnNpemUgLSB2aWV3SXRlbS5tYXhpbXVtU2l6ZSkgLyAyO1xuXHRcdFx0XHRcdG1heERlbHRhID0gKHZpZXdJdGVtLnNpemUgLSB2aWV3SXRlbS5taW5pbXVtU2l6ZSkgLyAyO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGxldCBzbmFwQmVmb3JlOiBJU2FzaERyYWdTbmFwU3RhdGUgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgc25hcEFmdGVyOiBJU2FzaERyYWdTbmFwU3RhdGUgfCB1bmRlZmluZWQ7XG5cblx0XHRcdGlmICghYWx0KSB7XG5cdFx0XHRcdGNvbnN0IHVwSW5kZXhlcyA9IHJhbmdlKGluZGV4LCAtMSk7XG5cdFx0XHRcdGNvbnN0IGRvd25JbmRleGVzID0gcmFuZ2UoaW5kZXggKyAxLCB0aGlzLnZpZXdJdGVtcy5sZW5ndGgpO1xuXHRcdFx0XHRjb25zdCBtaW5EZWx0YVVwID0gdXBJbmRleGVzLnJlZHVjZSgociwgaSkgPT4gciArICh0aGlzLnZpZXdJdGVtc1tpXS5taW5pbXVtU2l6ZSAtIHNpemVzW2ldKSwgMCk7XG5cdFx0XHRcdGNvbnN0IG1heERlbHRhVXAgPSB1cEluZGV4ZXMucmVkdWNlKChyLCBpKSA9PiByICsgKHRoaXMudmlld0l0ZW1zW2ldLnZpZXdNYXhpbXVtU2l6ZSAtIHNpemVzW2ldKSwgMCk7XG5cdFx0XHRcdGNvbnN0IG1heERlbHRhRG93biA9IGRvd25JbmRleGVzLmxlbmd0aCA9PT0gMCA/IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSA6IGRvd25JbmRleGVzLnJlZHVjZSgociwgaSkgPT4gciArIChzaXplc1tpXSAtIHRoaXMudmlld0l0ZW1zW2ldLm1pbmltdW1TaXplKSwgMCk7XG5cdFx0XHRcdGNvbnN0IG1pbkRlbHRhRG93biA9IGRvd25JbmRleGVzLmxlbmd0aCA9PT0gMCA/IE51bWJlci5ORUdBVElWRV9JTkZJTklUWSA6IGRvd25JbmRleGVzLnJlZHVjZSgociwgaSkgPT4gciArIChzaXplc1tpXSAtIHRoaXMudmlld0l0ZW1zW2ldLnZpZXdNYXhpbXVtU2l6ZSksIDApO1xuXHRcdFx0XHRjb25zdCBtaW5EZWx0YSA9IE1hdGgubWF4KG1pbkRlbHRhVXAsIG1pbkRlbHRhRG93bik7XG5cdFx0XHRcdGNvbnN0IG1heERlbHRhID0gTWF0aC5taW4obWF4RGVsdGFEb3duLCBtYXhEZWx0YVVwKTtcblx0XHRcdFx0Y29uc3Qgc25hcEJlZm9yZUluZGV4ID0gdGhpcy5maW5kRmlyc3RTbmFwSW5kZXgodXBJbmRleGVzKTtcblx0XHRcdFx0Y29uc3Qgc25hcEFmdGVySW5kZXggPSB0aGlzLmZpbmRGaXJzdFNuYXBJbmRleChkb3duSW5kZXhlcyk7XG5cblx0XHRcdFx0aWYgKHR5cGVvZiBzbmFwQmVmb3JlSW5kZXggPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld0l0ZW0gPSB0aGlzLnZpZXdJdGVtc1tzbmFwQmVmb3JlSW5kZXhdO1xuXHRcdFx0XHRcdGNvbnN0IGhhbGZTaXplID0gTWF0aC5mbG9vcih2aWV3SXRlbS52aWV3TWluaW11bVNpemUgLyAyKTtcblxuXHRcdFx0XHRcdHNuYXBCZWZvcmUgPSB7XG5cdFx0XHRcdFx0XHRpbmRleDogc25hcEJlZm9yZUluZGV4LFxuXHRcdFx0XHRcdFx0bGltaXREZWx0YTogdmlld0l0ZW0udmlzaWJsZSA/IG1pbkRlbHRhIC0gaGFsZlNpemUgOiBtaW5EZWx0YSArIGhhbGZTaXplLFxuXHRcdFx0XHRcdFx0c2l6ZTogdmlld0l0ZW0uc2l6ZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodHlwZW9mIHNuYXBBZnRlckluZGV4ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdGNvbnN0IHZpZXdJdGVtID0gdGhpcy52aWV3SXRlbXNbc25hcEFmdGVySW5kZXhdO1xuXHRcdFx0XHRcdGNvbnN0IGhhbGZTaXplID0gTWF0aC5mbG9vcih2aWV3SXRlbS52aWV3TWluaW11bVNpemUgLyAyKTtcblxuXHRcdFx0XHRcdHNuYXBBZnRlciA9IHtcblx0XHRcdFx0XHRcdGluZGV4OiBzbmFwQWZ0ZXJJbmRleCxcblx0XHRcdFx0XHRcdGxpbWl0RGVsdGE6IHZpZXdJdGVtLnZpc2libGUgPyBtYXhEZWx0YSArIGhhbGZTaXplIDogbWF4RGVsdGEgLSBoYWxmU2l6ZSxcblx0XHRcdFx0XHRcdHNpemU6IHZpZXdJdGVtLnNpemVcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuc2FzaERyYWdTdGF0ZSA9IHsgc3RhcnQsIGN1cnJlbnQ6IHN0YXJ0LCBpbmRleCwgc2l6ZXMsIG1pbkRlbHRhLCBtYXhEZWx0YSwgYWx0LCBzbmFwQmVmb3JlLCBzbmFwQWZ0ZXIsIGRpc3Bvc2FibGUgfTtcblx0XHR9O1xuXG5cdFx0cmVzZXRTYXNoRHJhZ1N0YXRlKHN0YXJ0LCBhbHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblNhc2hDaGFuZ2UoeyBjdXJyZW50IH06IElTYXNoRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCB7IGluZGV4LCBzdGFydCwgc2l6ZXMsIGFsdCwgbWluRGVsdGEsIG1heERlbHRhLCBzbmFwQmVmb3JlLCBzbmFwQWZ0ZXIgfSA9IHRoaXMuc2FzaERyYWdTdGF0ZSE7XG5cdFx0dGhpcy5zYXNoRHJhZ1N0YXRlIS5jdXJyZW50ID0gY3VycmVudDtcblxuXHRcdGNvbnN0IGRlbHRhID0gY3VycmVudCAtIHN0YXJ0O1xuXHRcdGNvbnN0IG5ld0RlbHRhID0gdGhpcy5yZXNpemUoaW5kZXgsIGRlbHRhLCBzaXplcywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIG1pbkRlbHRhLCBtYXhEZWx0YSwgc25hcEJlZm9yZSwgc25hcEFmdGVyKTtcblxuXHRcdGlmIChhbHQpIHtcblx0XHRcdGNvbnN0IGlzTGFzdFNhc2ggPSBpbmRleCA9PT0gdGhpcy5zYXNoSXRlbXMubGVuZ3RoIC0gMTtcblx0XHRcdGNvbnN0IG5ld1NpemVzID0gdGhpcy52aWV3SXRlbXMubWFwKGkgPT4gaS5zaXplKTtcblx0XHRcdGNvbnN0IHZpZXdJdGVtSW5kZXggPSBpc0xhc3RTYXNoID8gaW5kZXggOiBpbmRleCArIDE7XG5cdFx0XHRjb25zdCB2aWV3SXRlbSA9IHRoaXMudmlld0l0ZW1zW3ZpZXdJdGVtSW5kZXhdO1xuXHRcdFx0Y29uc3QgbmV3TWluRGVsdGEgPSB2aWV3SXRlbS5zaXplIC0gdmlld0l0ZW0ubWF4aW11bVNpemU7XG5cdFx0XHRjb25zdCBuZXdNYXhEZWx0YSA9IHZpZXdJdGVtLnNpemUgLSB2aWV3SXRlbS5taW5pbXVtU2l6ZTtcblx0XHRcdGNvbnN0IHJlc2l6ZUluZGV4ID0gaXNMYXN0U2FzaCA/IGluZGV4IC0gMSA6IGluZGV4ICsgMTtcblxuXHRcdFx0dGhpcy5yZXNpemUocmVzaXplSW5kZXgsIC1uZXdEZWx0YSwgbmV3U2l6ZXMsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBuZXdNaW5EZWx0YSwgbmV3TWF4RGVsdGEpO1xuXHRcdH1cblxuXHRcdHRoaXMuZGlzdHJpYnV0ZUVtcHR5U3BhY2UoKTtcblx0XHR0aGlzLmxheW91dFZpZXdzKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uU2FzaEVuZChpbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRTYXNoQ2hhbmdlLmZpcmUoaW5kZXgpO1xuXHRcdHRoaXMuc2FzaERyYWdTdGF0ZSEuZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5zYXZlUHJvcG9ydGlvbnMoKTtcblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLnZpZXdJdGVtcykge1xuXHRcdFx0aXRlbS5lbmFibGVkID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uVmlld0NoYW5nZShpdGVtOiBWaWV3SXRlbTxUTGF5b3V0Q29udGV4dCwgVFZpZXc+LCBzaXplOiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMudmlld0l0ZW1zLmluZGV4T2YoaXRlbSk7XG5cblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMudmlld0l0ZW1zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHNpemUgPSB0eXBlb2Ygc2l6ZSA9PT0gJ251bWJlcicgPyBzaXplIDogaXRlbS5zaXplO1xuXHRcdHNpemUgPSBjbGFtcChzaXplLCBpdGVtLm1pbmltdW1TaXplLCBpdGVtLm1heGltdW1TaXplKTtcblxuXHRcdGlmICh0aGlzLmludmVyc2VBbHRCZWhhdmlvciAmJiBpbmRleCA+IDApIHtcblx0XHRcdC8vIEluIHRoaXMgY2FzZSwgd2Ugd2FudCB0aGUgdmlldyB0byBncm93IG9yIHNocmluayBib3RoIHNpZGVzIGVxdWFsbHlcblx0XHRcdC8vIHNvIHdlIGp1c3QgcmVzaXplIHRoZSBcImxlZnRcIiBzaWRlIGJ5IGhhbGYgYW5kIGxldCBgcmVzaXplYCBkbyB0aGUgY2xhbXBpbmcgbWFnaWNcblx0XHRcdHRoaXMucmVzaXplKGluZGV4IC0gMSwgTWF0aC5mbG9vcigoaXRlbS5zaXplIC0gc2l6ZSkgLyAyKSk7XG5cdFx0XHR0aGlzLmRpc3RyaWJ1dGVFbXB0eVNwYWNlKCk7XG5cdFx0XHR0aGlzLmxheW91dFZpZXdzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGl0ZW0uc2l6ZSA9IHNpemU7XG5cdFx0XHR0aGlzLnJlbGF5b3V0KFtpbmRleF0sIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlc2l6ZSBhIHtAbGluayBJVmlldyB2aWV3fSB3aXRoaW4gdGhlIHtAbGluayBTcGxpdFZpZXd9LlxuXHQgKlxuXHQgKiBAcGFyYW0gaW5kZXggVGhlIHtAbGluayBJVmlldyB2aWV3fSBpbmRleC5cblx0ICogQHBhcmFtIHNpemUgVGhlIHtAbGluayBJVmlldyB2aWV3fSBzaXplLlxuXHQgKi9cblx0cmVzaXplVmlldyhpbmRleDogbnVtYmVyLCBzaXplOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMudmlld0l0ZW1zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnN0YXRlICE9PSBTdGF0ZS5JZGxlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NhbnQgbW9kaWZ5IHNwbGl0dmlldycpO1xuXHRcdH1cblxuXHRcdHRoaXMuc3RhdGUgPSBTdGF0ZS5CdXN5O1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluZGV4ZXMgPSByYW5nZSh0aGlzLnZpZXdJdGVtcy5sZW5ndGgpLmZpbHRlcihpID0+IGkgIT09IGluZGV4KTtcblx0XHRcdGNvbnN0IGxvd1ByaW9yaXR5SW5kZXhlcyA9IFsuLi5pbmRleGVzLmZpbHRlcihpID0+IHRoaXMudmlld0l0ZW1zW2ldLnByaW9yaXR5ID09PSBMYXlvdXRQcmlvcml0eS5Mb3cpLCBpbmRleF07XG5cdFx0XHRjb25zdCBoaWdoUHJpb3JpdHlJbmRleGVzID0gaW5kZXhlcy5maWx0ZXIoaSA9PiB0aGlzLnZpZXdJdGVtc1tpXS5wcmlvcml0eSA9PT0gTGF5b3V0UHJpb3JpdHkuSGlnaCk7XG5cblx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLnZpZXdJdGVtc1tpbmRleF07XG5cdFx0XHRzaXplID0gTWF0aC5yb3VuZChzaXplKTtcblx0XHRcdHNpemUgPSBjbGFtcChzaXplLCBpdGVtLm1pbmltdW1TaXplLCBNYXRoLm1pbihpdGVtLm1heGltdW1TaXplLCB0aGlzLnNpemUpKTtcblxuXHRcdFx0aXRlbS5zaXplID0gc2l6ZTtcblx0XHRcdHRoaXMucmVsYXlvdXQobG93UHJpb3JpdHlJbmRleGVzLCBoaWdoUHJpb3JpdHlJbmRleGVzKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5zdGF0ZSA9IFN0YXRlLklkbGU7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgd2hldGhlciBhbGwgb3RoZXIge0BsaW5rIElWaWV3IHZpZXdzfSBhcmUgYXQgdGhlaXIgbWluaW11bSBzaXplLlxuXHQgKi9cblx0aXNWaWV3RXhwYW5kZWQoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy52aWV3SXRlbXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIHRoaXMudmlld0l0ZW1zKSB7XG5cdFx0XHRpZiAoaXRlbSAhPT0gdGhpcy52aWV3SXRlbXNbaW5kZXhdICYmIGl0ZW0uc2l6ZSA+IGl0ZW0ubWluaW11bVNpemUpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIERpc3RyaWJ1dGUgdGhlIGVudGlyZSB7QGxpbmsgU3BsaXRWaWV3fSBzaXplIGFtb25nIGFsbCB7QGxpbmsgSVZpZXcgdmlld3N9LlxuXHQgKi9cblx0ZGlzdHJpYnV0ZVZpZXdTaXplcygpOiB2b2lkIHtcblx0XHRjb25zdCBmbGV4aWJsZVZpZXdJdGVtczogVmlld0l0ZW08VExheW91dENvbnRleHQsIFRWaWV3PltdID0gW107XG5cdFx0bGV0IGZsZXhpYmxlU2l6ZSA9IDA7XG5cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy52aWV3SXRlbXMpIHtcblx0XHRcdGlmIChpdGVtLm1heGltdW1TaXplIC0gaXRlbS5taW5pbXVtU2l6ZSA+IDApIHtcblx0XHRcdFx0ZmxleGlibGVWaWV3SXRlbXMucHVzaChpdGVtKTtcblx0XHRcdFx0ZmxleGlibGVTaXplICs9IGl0ZW0uc2l6ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBzaXplID0gTWF0aC5mbG9vcihmbGV4aWJsZVNpemUgLyBmbGV4aWJsZVZpZXdJdGVtcy5sZW5ndGgpO1xuXG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGZsZXhpYmxlVmlld0l0ZW1zKSB7XG5cdFx0XHRpdGVtLnNpemUgPSBjbGFtcChzaXplLCBpdGVtLm1pbmltdW1TaXplLCBpdGVtLm1heGltdW1TaXplKTtcblx0XHR9XG5cblx0XHRjb25zdCBpbmRleGVzID0gcmFuZ2UodGhpcy52aWV3SXRlbXMubGVuZ3RoKTtcblx0XHRjb25zdCBsb3dQcmlvcml0eUluZGV4ZXMgPSBpbmRleGVzLmZpbHRlcihpID0+IHRoaXMudmlld0l0ZW1zW2ldLnByaW9yaXR5ID09PSBMYXlvdXRQcmlvcml0eS5Mb3cpO1xuXHRcdGNvbnN0IGhpZ2hQcmlvcml0eUluZGV4ZXMgPSBpbmRleGVzLmZpbHRlcihpID0+IHRoaXMudmlld0l0ZW1zW2ldLnByaW9yaXR5ID09PSBMYXlvdXRQcmlvcml0eS5IaWdoKTtcblxuXHRcdHRoaXMucmVsYXlvdXQobG93UHJpb3JpdHlJbmRleGVzLCBoaWdoUHJpb3JpdHlJbmRleGVzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBzaXplIG9mIGEge0BsaW5rIElWaWV3IHZpZXd9LlxuXHQgKi9cblx0Z2V0Vmlld1NpemUoaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLnZpZXdJdGVtcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy52aWV3SXRlbXNbaW5kZXhdLnNpemU7XG5cdH1cblxuXHRwcml2YXRlIGRvQWRkVmlldyh2aWV3OiBUVmlldywgc2l6ZTogbnVtYmVyIHwgU2l6aW5nLCBpbmRleCA9IHRoaXMudmlld0l0ZW1zLmxlbmd0aCwgc2tpcExheW91dD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zdGF0ZSAhPT0gU3RhdGUuSWRsZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW50IG1vZGlmeSBzcGxpdHZpZXcnKTtcblx0XHR9XG5cblx0XHR0aGlzLnN0YXRlID0gU3RhdGUuQnVzeTtcblxuXHRcdHRyeSB7XG5cdFx0XHQvLyBBZGQgdmlld1xuXHRcdFx0Y29uc3QgY29udGFpbmVyID0gJCgnLnNwbGl0LXZpZXctdmlldycpO1xuXG5cdFx0XHRpZiAoaW5kZXggPT09IHRoaXMudmlld0l0ZW1zLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLnZpZXdDb250YWluZXIuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudmlld0NvbnRhaW5lci5pbnNlcnRCZWZvcmUoY29udGFpbmVyLCB0aGlzLnZpZXdDb250YWluZXIuY2hpbGRyZW4uaXRlbShpbmRleCkpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBvbkNoYW5nZURpc3Bvc2FibGUgPSB2aWV3Lm9uRGlkQ2hhbmdlKHNpemUgPT4gdGhpcy5vblZpZXdDaGFuZ2UoaXRlbSwgc2l6ZSkpO1xuXHRcdFx0Y29uc3QgY29udGFpbmVyRGlzcG9zYWJsZSA9IHRvRGlzcG9zYWJsZSgoKSA9PiBjb250YWluZXIucmVtb3ZlKCkpO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGNvbWJpbmVkRGlzcG9zYWJsZShvbkNoYW5nZURpc3Bvc2FibGUsIGNvbnRhaW5lckRpc3Bvc2FibGUpO1xuXG5cdFx0XHRsZXQgdmlld1NpemU6IFZpZXdJdGVtU2l6ZTtcblxuXHRcdFx0aWYgKHR5cGVvZiBzaXplID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHR2aWV3U2l6ZSA9IHNpemU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoc2l6ZS50eXBlID09PSAnYXV0bycpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5hcmVWaWV3c0Rpc3RyaWJ1dGVkKCkpIHtcblx0XHRcdFx0XHRcdHNpemUgPSB7IHR5cGU6ICdkaXN0cmlidXRlJyB9O1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzaXplID0geyB0eXBlOiAnc3BsaXQnLCBpbmRleDogc2l6ZS5pbmRleCB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChzaXplLnR5cGUgPT09ICdzcGxpdCcpIHtcblx0XHRcdFx0XHR2aWV3U2l6ZSA9IHRoaXMuZ2V0Vmlld1NpemUoc2l6ZS5pbmRleCkgLyAyO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHNpemUudHlwZSA9PT0gJ2ludmlzaWJsZScpIHtcblx0XHRcdFx0XHR2aWV3U2l6ZSA9IHsgY2FjaGVkVmlzaWJsZVNpemU6IHNpemUuY2FjaGVkVmlzaWJsZVNpemUgfTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR2aWV3U2l6ZSA9IHZpZXcubWluaW11bVNpemU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMXG5cdFx0XHRcdD8gbmV3IFZlcnRpY2FsVmlld0l0ZW0oY29udGFpbmVyLCB2aWV3LCB2aWV3U2l6ZSwgZGlzcG9zYWJsZSlcblx0XHRcdFx0OiBuZXcgSG9yaXpvbnRhbFZpZXdJdGVtKGNvbnRhaW5lciwgdmlldywgdmlld1NpemUsIGRpc3Bvc2FibGUpO1xuXG5cdFx0XHR0aGlzLnZpZXdJdGVtcy5zcGxpY2UoaW5kZXgsIDAsIGl0ZW0pO1xuXG5cdFx0XHQvLyBBZGQgc2FzaFxuXHRcdFx0aWYgKHRoaXMudmlld0l0ZW1zLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0Y29uc3Qgb3B0cyA9IHsgb3J0aG9nb25hbFN0YXJ0U2FzaDogdGhpcy5vcnRob2dvbmFsU3RhcnRTYXNoLCBvcnRob2dvbmFsRW5kU2FzaDogdGhpcy5vcnRob2dvbmFsRW5kU2FzaCB9O1xuXG5cdFx0XHRcdGNvbnN0IHNhc2ggPSB0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5WRVJUSUNBTFxuXHRcdFx0XHRcdD8gbmV3IFNhc2godGhpcy5zYXNoQ29udGFpbmVyLCB7IGdldEhvcml6b250YWxTYXNoVG9wOiBzID0+IHRoaXMuZ2V0U2FzaFBvc2l0aW9uKHMpLCBnZXRIb3Jpem9udGFsU2FzaFdpZHRoOiB0aGlzLmdldFNhc2hPcnRob2dvbmFsU2l6ZSB9LCB7IC4uLm9wdHMsIG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIH0pXG5cdFx0XHRcdFx0OiBuZXcgU2FzaCh0aGlzLnNhc2hDb250YWluZXIsIHsgZ2V0VmVydGljYWxTYXNoTGVmdDogcyA9PiB0aGlzLmdldFNhc2hQb3NpdGlvbihzKSwgZ2V0VmVydGljYWxTYXNoSGVpZ2h0OiB0aGlzLmdldFNhc2hPcnRob2dvbmFsU2l6ZSB9LCB7IC4uLm9wdHMsIG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbi5WRVJUSUNBTCB9KTtcblxuXHRcdFx0XHRjb25zdCBzYXNoRXZlbnRNYXBwZXIgPSB0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5WRVJUSUNBTFxuXHRcdFx0XHRcdD8gKGU6IElCYXNlU2FzaEV2ZW50KSA9PiAoeyBzYXNoLCBzdGFydDogZS5zdGFydFksIGN1cnJlbnQ6IGUuY3VycmVudFksIGFsdDogZS5hbHRLZXkgfSlcblx0XHRcdFx0XHQ6IChlOiBJQmFzZVNhc2hFdmVudCkgPT4gKHsgc2FzaCwgc3RhcnQ6IGUuc3RhcnRYLCBjdXJyZW50OiBlLmN1cnJlbnRYLCBhbHQ6IGUuYWx0S2V5IH0pO1xuXG5cdFx0XHRcdGNvbnN0IG9uU3RhcnQgPSBFdmVudC5tYXAoc2FzaC5vbkRpZFN0YXJ0LCBzYXNoRXZlbnRNYXBwZXIpO1xuXHRcdFx0XHRjb25zdCBvblN0YXJ0RGlzcG9zYWJsZSA9IG9uU3RhcnQodGhpcy5vblNhc2hTdGFydCwgdGhpcyk7XG5cdFx0XHRcdGNvbnN0IG9uQ2hhbmdlID0gRXZlbnQubWFwKHNhc2gub25EaWRDaGFuZ2UsIHNhc2hFdmVudE1hcHBlcik7XG5cdFx0XHRcdGNvbnN0IG9uQ2hhbmdlRGlzcG9zYWJsZSA9IG9uQ2hhbmdlKHRoaXMub25TYXNoQ2hhbmdlLCB0aGlzKTtcblx0XHRcdFx0Y29uc3Qgb25FbmQgPSBFdmVudC5tYXAoc2FzaC5vbkRpZEVuZCwgKCkgPT4gdGhpcy5zYXNoSXRlbXMuZmluZEluZGV4KGl0ZW0gPT4gaXRlbS5zYXNoID09PSBzYXNoKSk7XG5cdFx0XHRcdGNvbnN0IG9uRW5kRGlzcG9zYWJsZSA9IG9uRW5kKHRoaXMub25TYXNoRW5kLCB0aGlzKTtcblxuXHRcdFx0XHRjb25zdCBvbkRpZFJlc2V0RGlzcG9zYWJsZSA9IHNhc2gub25EaWRSZXNldCgoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLnNhc2hJdGVtcy5maW5kSW5kZXgoaXRlbSA9PiBpdGVtLnNhc2ggPT09IHNhc2gpO1xuXHRcdFx0XHRcdGNvbnN0IHVwSW5kZXhlcyA9IHJhbmdlKGluZGV4LCAtMSk7XG5cdFx0XHRcdFx0Y29uc3QgZG93bkluZGV4ZXMgPSByYW5nZShpbmRleCArIDEsIHRoaXMudmlld0l0ZW1zLmxlbmd0aCk7XG5cdFx0XHRcdFx0Y29uc3Qgc25hcEJlZm9yZUluZGV4ID0gdGhpcy5maW5kRmlyc3RTbmFwSW5kZXgodXBJbmRleGVzKTtcblx0XHRcdFx0XHRjb25zdCBzbmFwQWZ0ZXJJbmRleCA9IHRoaXMuZmluZEZpcnN0U25hcEluZGV4KGRvd25JbmRleGVzKTtcblxuXHRcdFx0XHRcdGlmICh0eXBlb2Ygc25hcEJlZm9yZUluZGV4ID09PSAnbnVtYmVyJyAmJiAhdGhpcy52aWV3SXRlbXNbc25hcEJlZm9yZUluZGV4XS52aXNpYmxlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBzbmFwQWZ0ZXJJbmRleCA9PT0gJ251bWJlcicgJiYgIXRoaXMudmlld0l0ZW1zW3NuYXBBZnRlckluZGV4XS52aXNpYmxlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5fb25EaWRTYXNoUmVzZXQuZmlyZShpbmRleCk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBjb21iaW5lZERpc3Bvc2FibGUob25TdGFydERpc3Bvc2FibGUsIG9uQ2hhbmdlRGlzcG9zYWJsZSwgb25FbmREaXNwb3NhYmxlLCBvbkRpZFJlc2V0RGlzcG9zYWJsZSwgc2FzaCk7XG5cdFx0XHRcdGNvbnN0IHNhc2hJdGVtOiBJU2FzaEl0ZW0gPSB7IHNhc2gsIGRpc3Bvc2FibGUgfTtcblxuXHRcdFx0XHR0aGlzLnNhc2hJdGVtcy5zcGxpY2UoaW5kZXggLSAxLCAwLCBzYXNoSXRlbSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZCh2aWV3LmVsZW1lbnQpO1xuXG5cdFx0XHRsZXQgaGlnaFByaW9yaXR5SW5kZXhlczogbnVtYmVyW10gfCB1bmRlZmluZWQ7XG5cblx0XHRcdGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicgJiYgc2l6ZS50eXBlID09PSAnc3BsaXQnKSB7XG5cdFx0XHRcdGhpZ2hQcmlvcml0eUluZGV4ZXMgPSBbc2l6ZS5pbmRleF07XG5cdFx0XHR9XG5cblx0XHRcdGlmICghc2tpcExheW91dCkge1xuXHRcdFx0XHR0aGlzLnJlbGF5b3V0KFtpbmRleF0sIGhpZ2hQcmlvcml0eUluZGV4ZXMpO1xuXHRcdFx0fVxuXG5cblx0XHRcdGlmICghc2tpcExheW91dCAmJiB0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicgJiYgc2l6ZS50eXBlID09PSAnZGlzdHJpYnV0ZScpIHtcblx0XHRcdFx0dGhpcy5kaXN0cmlidXRlVmlld1NpemVzKCk7XG5cdFx0XHR9XG5cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5zdGF0ZSA9IFN0YXRlLklkbGU7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWxheW91dChsb3dQcmlvcml0eUluZGV4ZXM/OiBudW1iZXJbXSwgaGlnaFByaW9yaXR5SW5kZXhlcz86IG51bWJlcltdKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udGVudFNpemUgPSB0aGlzLnZpZXdJdGVtcy5yZWR1Y2UoKHIsIGkpID0+IHIgKyBpLnNpemUsIDApO1xuXG5cdFx0dGhpcy5yZXNpemUodGhpcy52aWV3SXRlbXMubGVuZ3RoIC0gMSwgdGhpcy5zaXplIC0gY29udGVudFNpemUsIHVuZGVmaW5lZCwgbG93UHJpb3JpdHlJbmRleGVzLCBoaWdoUHJpb3JpdHlJbmRleGVzKTtcblx0XHR0aGlzLmRpc3RyaWJ1dGVFbXB0eVNwYWNlKCk7XG5cdFx0dGhpcy5sYXlvdXRWaWV3cygpO1xuXHRcdHRoaXMuc2F2ZVByb3BvcnRpb25zKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlc2l6ZShcblx0XHRpbmRleDogbnVtYmVyLFxuXHRcdGRlbHRhOiBudW1iZXIsXG5cdFx0c2l6ZXMgPSB0aGlzLnZpZXdJdGVtcy5tYXAoaSA9PiBpLnNpemUpLFxuXHRcdGxvd1ByaW9yaXR5SW5kZXhlcz86IG51bWJlcltdLFxuXHRcdGhpZ2hQcmlvcml0eUluZGV4ZXM/OiBudW1iZXJbXSxcblx0XHRvdmVybG9hZE1pbkRlbHRhOiBudW1iZXIgPSBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFksXG5cdFx0b3ZlcmxvYWRNYXhEZWx0YTogbnVtYmVyID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLFxuXHRcdHNuYXBCZWZvcmU/OiBJU2FzaERyYWdTbmFwU3RhdGUsXG5cdFx0c25hcEFmdGVyPzogSVNhc2hEcmFnU25hcFN0YXRlXG5cdCk6IG51bWJlciB7XG5cdFx0aWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLnZpZXdJdGVtcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVwSW5kZXhlcyA9IHJhbmdlKGluZGV4LCAtMSk7XG5cdFx0Y29uc3QgZG93bkluZGV4ZXMgPSByYW5nZShpbmRleCArIDEsIHRoaXMudmlld0l0ZW1zLmxlbmd0aCk7XG5cblx0XHRpZiAoaGlnaFByaW9yaXR5SW5kZXhlcykge1xuXHRcdFx0Zm9yIChjb25zdCBpbmRleCBvZiBoaWdoUHJpb3JpdHlJbmRleGVzKSB7XG5cdFx0XHRcdHB1c2hUb1N0YXJ0KHVwSW5kZXhlcywgaW5kZXgpO1xuXHRcdFx0XHRwdXNoVG9TdGFydChkb3duSW5kZXhlcywgaW5kZXgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChsb3dQcmlvcml0eUluZGV4ZXMpIHtcblx0XHRcdGZvciAoY29uc3QgaW5kZXggb2YgbG93UHJpb3JpdHlJbmRleGVzKSB7XG5cdFx0XHRcdHB1c2hUb0VuZCh1cEluZGV4ZXMsIGluZGV4KTtcblx0XHRcdFx0cHVzaFRvRW5kKGRvd25JbmRleGVzLCBpbmRleCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXBJdGVtcyA9IHVwSW5kZXhlcy5tYXAoaSA9PiB0aGlzLnZpZXdJdGVtc1tpXSk7XG5cdFx0Y29uc3QgdXBTaXplcyA9IHVwSW5kZXhlcy5tYXAoaSA9PiBzaXplc1tpXSk7XG5cblx0XHRjb25zdCBkb3duSXRlbXMgPSBkb3duSW5kZXhlcy5tYXAoaSA9PiB0aGlzLnZpZXdJdGVtc1tpXSk7XG5cdFx0Y29uc3QgZG93blNpemVzID0gZG93bkluZGV4ZXMubWFwKGkgPT4gc2l6ZXNbaV0pO1xuXG5cdFx0Y29uc3QgbWluRGVsdGFVcCA9IHVwSW5kZXhlcy5yZWR1Y2UoKHIsIGkpID0+IHIgKyAodGhpcy52aWV3SXRlbXNbaV0ubWluaW11bVNpemUgLSBzaXplc1tpXSksIDApO1xuXHRcdGNvbnN0IG1heERlbHRhVXAgPSB1cEluZGV4ZXMucmVkdWNlKChyLCBpKSA9PiByICsgKHRoaXMudmlld0l0ZW1zW2ldLm1heGltdW1TaXplIC0gc2l6ZXNbaV0pLCAwKTtcblx0XHRjb25zdCBtYXhEZWx0YURvd24gPSBkb3duSW5kZXhlcy5sZW5ndGggPT09IDAgPyBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkgOiBkb3duSW5kZXhlcy5yZWR1Y2UoKHIsIGkpID0+IHIgKyAoc2l6ZXNbaV0gLSB0aGlzLnZpZXdJdGVtc1tpXS5taW5pbXVtU2l6ZSksIDApO1xuXHRcdGNvbnN0IG1pbkRlbHRhRG93biA9IGRvd25JbmRleGVzLmxlbmd0aCA9PT0gMCA/IE51bWJlci5ORUdBVElWRV9JTkZJTklUWSA6IGRvd25JbmRleGVzLnJlZHVjZSgociwgaSkgPT4gciArIChzaXplc1tpXSAtIHRoaXMudmlld0l0ZW1zW2ldLm1heGltdW1TaXplKSwgMCk7XG5cdFx0Y29uc3QgbWluRGVsdGEgPSBNYXRoLm1heChtaW5EZWx0YVVwLCBtaW5EZWx0YURvd24sIG92ZXJsb2FkTWluRGVsdGEpO1xuXHRcdGNvbnN0IG1heERlbHRhID0gTWF0aC5taW4obWF4RGVsdGFEb3duLCBtYXhEZWx0YVVwLCBvdmVybG9hZE1heERlbHRhKTtcblxuXHRcdGxldCBzbmFwcGVkID0gZmFsc2U7XG5cblx0XHRpZiAoc25hcEJlZm9yZSkge1xuXHRcdFx0Y29uc3Qgc25hcFZpZXcgPSB0aGlzLnZpZXdJdGVtc1tzbmFwQmVmb3JlLmluZGV4XTtcblx0XHRcdGNvbnN0IHZpc2libGUgPSBkZWx0YSA+PSBzbmFwQmVmb3JlLmxpbWl0RGVsdGE7XG5cdFx0XHRzbmFwcGVkID0gdmlzaWJsZSAhPT0gc25hcFZpZXcudmlzaWJsZTtcblx0XHRcdHNuYXBWaWV3LnNldFZpc2libGUodmlzaWJsZSwgc25hcEJlZm9yZS5zaXplKTtcblx0XHR9XG5cblx0XHRpZiAoIXNuYXBwZWQgJiYgc25hcEFmdGVyKSB7XG5cdFx0XHRjb25zdCBzbmFwVmlldyA9IHRoaXMudmlld0l0ZW1zW3NuYXBBZnRlci5pbmRleF07XG5cdFx0XHRjb25zdCB2aXNpYmxlID0gZGVsdGEgPCBzbmFwQWZ0ZXIubGltaXREZWx0YTtcblx0XHRcdHNuYXBwZWQgPSB2aXNpYmxlICE9PSBzbmFwVmlldy52aXNpYmxlO1xuXHRcdFx0c25hcFZpZXcuc2V0VmlzaWJsZSh2aXNpYmxlLCBzbmFwQWZ0ZXIuc2l6ZSk7XG5cdFx0fVxuXG5cdFx0aWYgKHNuYXBwZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLnJlc2l6ZShpbmRleCwgZGVsdGEsIHNpemVzLCBsb3dQcmlvcml0eUluZGV4ZXMsIGhpZ2hQcmlvcml0eUluZGV4ZXMsIG92ZXJsb2FkTWluRGVsdGEsIG92ZXJsb2FkTWF4RGVsdGEpO1xuXHRcdH1cblxuXHRcdGRlbHRhID0gY2xhbXAoZGVsdGEsIG1pbkRlbHRhLCBtYXhEZWx0YSk7XG5cblx0XHRmb3IgKGxldCBpID0gMCwgZGVsdGFVcCA9IGRlbHRhOyBpIDwgdXBJdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgaXRlbSA9IHVwSXRlbXNbaV07XG5cdFx0XHRjb25zdCBzaXplID0gY2xhbXAodXBTaXplc1tpXSArIGRlbHRhVXAsIGl0ZW0ubWluaW11bVNpemUsIGl0ZW0ubWF4aW11bVNpemUpO1xuXHRcdFx0Y29uc3Qgdmlld0RlbHRhID0gc2l6ZSAtIHVwU2l6ZXNbaV07XG5cblx0XHRcdGRlbHRhVXAgLT0gdmlld0RlbHRhO1xuXHRcdFx0aXRlbS5zaXplID0gc2l6ZTtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gMCwgZGVsdGFEb3duID0gZGVsdGE7IGkgPCBkb3duSXRlbXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGl0ZW0gPSBkb3duSXRlbXNbaV07XG5cdFx0XHRjb25zdCBzaXplID0gY2xhbXAoZG93blNpemVzW2ldIC0gZGVsdGFEb3duLCBpdGVtLm1pbmltdW1TaXplLCBpdGVtLm1heGltdW1TaXplKTtcblx0XHRcdGNvbnN0IHZpZXdEZWx0YSA9IHNpemUgLSBkb3duU2l6ZXNbaV07XG5cblx0XHRcdGRlbHRhRG93biArPSB2aWV3RGVsdGE7XG5cdFx0XHRpdGVtLnNpemUgPSBzaXplO1xuXHRcdH1cblxuXHRcdHJldHVybiBkZWx0YTtcblx0fVxuXG5cdHByaXZhdGUgZGlzdHJpYnV0ZUVtcHR5U3BhY2UobG93UHJpb3JpdHlJbmRleD86IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRlbnRTaXplID0gdGhpcy52aWV3SXRlbXMucmVkdWNlKChyLCBpKSA9PiByICsgaS5zaXplLCAwKTtcblx0XHRsZXQgZW1wdHlEZWx0YSA9IHRoaXMuc2l6ZSAtIGNvbnRlbnRTaXplO1xuXG5cdFx0Y29uc3QgaW5kZXhlcyA9IHJhbmdlKHRoaXMudmlld0l0ZW1zLmxlbmd0aCAtIDEsIC0xKTtcblx0XHRjb25zdCBsb3dQcmlvcml0eUluZGV4ZXMgPSBpbmRleGVzLmZpbHRlcihpID0+IHRoaXMudmlld0l0ZW1zW2ldLnByaW9yaXR5ID09PSBMYXlvdXRQcmlvcml0eS5Mb3cpO1xuXHRcdGNvbnN0IGhpZ2hQcmlvcml0eUluZGV4ZXMgPSBpbmRleGVzLmZpbHRlcihpID0+IHRoaXMudmlld0l0ZW1zW2ldLnByaW9yaXR5ID09PSBMYXlvdXRQcmlvcml0eS5IaWdoKTtcblxuXHRcdGZvciAoY29uc3QgaW5kZXggb2YgaGlnaFByaW9yaXR5SW5kZXhlcykge1xuXHRcdFx0cHVzaFRvU3RhcnQoaW5kZXhlcywgaW5kZXgpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgaW5kZXggb2YgbG93UHJpb3JpdHlJbmRleGVzKSB7XG5cdFx0XHRwdXNoVG9FbmQoaW5kZXhlcywgaW5kZXgpO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgbG93UHJpb3JpdHlJbmRleCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHB1c2hUb0VuZChpbmRleGVzLCBsb3dQcmlvcml0eUluZGV4KTtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gMDsgZW1wdHlEZWx0YSAhPT0gMCAmJiBpIDwgaW5kZXhlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMudmlld0l0ZW1zW2luZGV4ZXNbaV1dO1xuXHRcdFx0Y29uc3Qgc2l6ZSA9IGNsYW1wKGl0ZW0uc2l6ZSArIGVtcHR5RGVsdGEsIGl0ZW0ubWluaW11bVNpemUsIGl0ZW0ubWF4aW11bVNpemUpO1xuXHRcdFx0Y29uc3Qgdmlld0RlbHRhID0gc2l6ZSAtIGl0ZW0uc2l6ZTtcblxuXHRcdFx0ZW1wdHlEZWx0YSAtPSB2aWV3RGVsdGE7XG5cdFx0XHRpdGVtLnNpemUgPSBzaXplO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbGF5b3V0Vmlld3MoKTogdm9pZCB7XG5cdFx0Ly8gU2F2ZSBuZXcgY29udGVudCBzaXplXG5cdFx0dGhpcy5fY29udGVudFNpemUgPSB0aGlzLnZpZXdJdGVtcy5yZWR1Y2UoKHIsIGkpID0+IHIgKyBpLnNpemUsIDApO1xuXG5cdFx0Ly8gTGF5b3V0IHZpZXdzXG5cdFx0bGV0IG9mZnNldCA9IDA7XG5cblx0XHRmb3IgKGNvbnN0IHZpZXdJdGVtIG9mIHRoaXMudmlld0l0ZW1zKSB7XG5cdFx0XHR2aWV3SXRlbS5sYXlvdXQob2Zmc2V0LCB0aGlzLmxheW91dENvbnRleHQpO1xuXHRcdFx0b2Zmc2V0ICs9IHZpZXdJdGVtLnNpemU7XG5cdFx0fVxuXG5cdFx0Ly8gTGF5b3V0IHNhc2hlc1xuXHRcdHRoaXMuc2FzaEl0ZW1zLmZvckVhY2goaXRlbSA9PiBpdGVtLnNhc2gubGF5b3V0KCkpO1xuXHRcdHRoaXMudXBkYXRlU2FzaEVuYWJsZW1lbnQoKTtcblx0XHR0aGlzLnVwZGF0ZVNjcm9sbGFibGVFbGVtZW50KCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVNjcm9sbGFibGVFbGVtZW50KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5WRVJUSUNBTCkge1xuXHRcdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxEaW1lbnNpb25zKHtcblx0XHRcdFx0aGVpZ2h0OiB0aGlzLnNpemUsXG5cdFx0XHRcdHNjcm9sbEhlaWdodDogdGhpcy5fY29udGVudFNpemVcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbERpbWVuc2lvbnMoe1xuXHRcdFx0XHR3aWR0aDogdGhpcy5zaXplLFxuXHRcdFx0XHRzY3JvbGxXaWR0aDogdGhpcy5fY29udGVudFNpemVcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU2FzaEVuYWJsZW1lbnQoKTogdm9pZCB7XG5cdFx0bGV0IHByZXZpb3VzID0gZmFsc2U7XG5cdFx0Y29uc3QgY29sbGFwc2VzRG93biA9IHRoaXMudmlld0l0ZW1zLm1hcChpID0+IHByZXZpb3VzID0gKGkuc2l6ZSAtIGkubWluaW11bVNpemUgPiAwKSB8fCBwcmV2aW91cyk7XG5cblx0XHRwcmV2aW91cyA9IGZhbHNlO1xuXHRcdGNvbnN0IGV4cGFuZHNEb3duID0gdGhpcy52aWV3SXRlbXMubWFwKGkgPT4gcHJldmlvdXMgPSAoaS5tYXhpbXVtU2l6ZSAtIGkuc2l6ZSA+IDApIHx8IHByZXZpb3VzKTtcblxuXHRcdGNvbnN0IHJldmVyc2VWaWV3cyA9IFsuLi50aGlzLnZpZXdJdGVtc10ucmV2ZXJzZSgpO1xuXHRcdHByZXZpb3VzID0gZmFsc2U7XG5cdFx0Y29uc3QgY29sbGFwc2VzVXAgPSByZXZlcnNlVmlld3MubWFwKGkgPT4gcHJldmlvdXMgPSAoaS5zaXplIC0gaS5taW5pbXVtU2l6ZSA+IDApIHx8IHByZXZpb3VzKS5yZXZlcnNlKCk7XG5cblx0XHRwcmV2aW91cyA9IGZhbHNlO1xuXHRcdGNvbnN0IGV4cGFuZHNVcCA9IHJldmVyc2VWaWV3cy5tYXAoaSA9PiBwcmV2aW91cyA9IChpLm1heGltdW1TaXplIC0gaS5zaXplID4gMCkgfHwgcHJldmlvdXMpLnJldmVyc2UoKTtcblxuXHRcdGxldCBwb3NpdGlvbiA9IDA7XG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuc2FzaEl0ZW1zLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0Y29uc3QgeyBzYXNoIH0gPSB0aGlzLnNhc2hJdGVtc1tpbmRleF07XG5cdFx0XHRjb25zdCB2aWV3SXRlbSA9IHRoaXMudmlld0l0ZW1zW2luZGV4XTtcblx0XHRcdHBvc2l0aW9uICs9IHZpZXdJdGVtLnNpemU7XG5cblx0XHRcdGNvbnN0IG1pbiA9ICEoY29sbGFwc2VzRG93bltpbmRleF0gJiYgZXhwYW5kc1VwW2luZGV4ICsgMV0pO1xuXHRcdFx0Y29uc3QgbWF4ID0gIShleHBhbmRzRG93bltpbmRleF0gJiYgY29sbGFwc2VzVXBbaW5kZXggKyAxXSk7XG5cblx0XHRcdGlmIChtaW4gJiYgbWF4KSB7XG5cdFx0XHRcdGNvbnN0IHVwSW5kZXhlcyA9IHJhbmdlKGluZGV4LCAtMSk7XG5cdFx0XHRcdGNvbnN0IGRvd25JbmRleGVzID0gcmFuZ2UoaW5kZXggKyAxLCB0aGlzLnZpZXdJdGVtcy5sZW5ndGgpO1xuXHRcdFx0XHRjb25zdCBzbmFwQmVmb3JlSW5kZXggPSB0aGlzLmZpbmRGaXJzdFNuYXBJbmRleCh1cEluZGV4ZXMpO1xuXHRcdFx0XHRjb25zdCBzbmFwQWZ0ZXJJbmRleCA9IHRoaXMuZmluZEZpcnN0U25hcEluZGV4KGRvd25JbmRleGVzKTtcblxuXHRcdFx0XHRjb25zdCBzbmFwcGVkQmVmb3JlID0gdHlwZW9mIHNuYXBCZWZvcmVJbmRleCA9PT0gJ251bWJlcicgJiYgIXRoaXMudmlld0l0ZW1zW3NuYXBCZWZvcmVJbmRleF0udmlzaWJsZTtcblx0XHRcdFx0Y29uc3Qgc25hcHBlZEFmdGVyID0gdHlwZW9mIHNuYXBBZnRlckluZGV4ID09PSAnbnVtYmVyJyAmJiAhdGhpcy52aWV3SXRlbXNbc25hcEFmdGVySW5kZXhdLnZpc2libGU7XG5cblx0XHRcdFx0aWYgKHNuYXBwZWRCZWZvcmUgJiYgY29sbGFwc2VzVXBbaW5kZXhdICYmIChwb3NpdGlvbiA+IDAgfHwgdGhpcy5zdGFydFNuYXBwaW5nRW5hYmxlZCkpIHtcblx0XHRcdFx0XHRzYXNoLnN0YXRlID0gU2FzaFN0YXRlLkF0TWluaW11bTtcblx0XHRcdFx0fSBlbHNlIGlmIChzbmFwcGVkQWZ0ZXIgJiYgY29sbGFwc2VzRG93bltpbmRleF0gJiYgKHBvc2l0aW9uIDwgdGhpcy5fY29udGVudFNpemUgfHwgdGhpcy5lbmRTbmFwcGluZ0VuYWJsZWQpKSB7XG5cdFx0XHRcdFx0c2FzaC5zdGF0ZSA9IFNhc2hTdGF0ZS5BdE1heGltdW07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2FzaC5zdGF0ZSA9IFNhc2hTdGF0ZS5EaXNhYmxlZDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChtaW4gJiYgIW1heCkge1xuXHRcdFx0XHRzYXNoLnN0YXRlID0gU2FzaFN0YXRlLkF0TWluaW11bTtcblx0XHRcdH0gZWxzZSBpZiAoIW1pbiAmJiBtYXgpIHtcblx0XHRcdFx0c2FzaC5zdGF0ZSA9IFNhc2hTdGF0ZS5BdE1heGltdW07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzYXNoLnN0YXRlID0gU2FzaFN0YXRlLkVuYWJsZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRTYXNoUG9zaXRpb24oc2FzaDogU2FzaCk6IG51bWJlciB7XG5cdFx0bGV0IHBvc2l0aW9uID0gMDtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zYXNoSXRlbXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHBvc2l0aW9uICs9IHRoaXMudmlld0l0ZW1zW2ldLnNpemU7XG5cblx0XHRcdGlmICh0aGlzLnNhc2hJdGVtc1tpXS5zYXNoID09PSBzYXNoKSB7XG5cdFx0XHRcdHJldHVybiBwb3NpdGlvbjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdHByaXZhdGUgZmluZEZpcnN0U25hcEluZGV4KGluZGV4ZXM6IG51bWJlcltdKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHQvLyB2aXNpYmxlIHZpZXdzIGZpcnN0XG5cdFx0Zm9yIChjb25zdCBpbmRleCBvZiBpbmRleGVzKSB7XG5cdFx0XHRjb25zdCB2aWV3SXRlbSA9IHRoaXMudmlld0l0ZW1zW2luZGV4XTtcblxuXHRcdFx0aWYgKCF2aWV3SXRlbS52aXNpYmxlKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodmlld0l0ZW0uc25hcCkge1xuXHRcdFx0XHRyZXR1cm4gaW5kZXg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gdGhlbiwgaGlkZGVuIHZpZXdzXG5cdFx0Zm9yIChjb25zdCBpbmRleCBvZiBpbmRleGVzKSB7XG5cdFx0XHRjb25zdCB2aWV3SXRlbSA9IHRoaXMudmlld0l0ZW1zW2luZGV4XTtcblxuXHRcdFx0aWYgKHZpZXdJdGVtLnZpc2libGUgJiYgdmlld0l0ZW0ubWF4aW11bVNpemUgLSB2aWV3SXRlbS5taW5pbXVtU2l6ZSA+IDApIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF2aWV3SXRlbS52aXNpYmxlICYmIHZpZXdJdGVtLnNuYXApIHtcblx0XHRcdFx0cmV0dXJuIGluZGV4O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFyZVZpZXdzRGlzdHJpYnV0ZWQoKSB7XG5cdFx0bGV0IG1pbiA9IHVuZGVmaW5lZCwgbWF4ID0gdW5kZWZpbmVkO1xuXG5cdFx0Zm9yIChjb25zdCB2aWV3IG9mIHRoaXMudmlld0l0ZW1zKSB7XG5cdFx0XHRtaW4gPSBtaW4gPT09IHVuZGVmaW5lZCA/IHZpZXcuc2l6ZSA6IE1hdGgubWluKG1pbiwgdmlldy5zaXplKTtcblx0XHRcdG1heCA9IG1heCA9PT0gdW5kZWZpbmVkID8gdmlldy5zaXplIDogTWF0aC5tYXgobWF4LCB2aWV3LnNpemUpO1xuXG5cdFx0XHRpZiAobWF4IC0gbWluID4gMikge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuc2FzaERyYWdTdGF0ZT8uZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cblx0XHRkaXNwb3NlKHRoaXMudmlld0l0ZW1zKTtcblx0XHR0aGlzLnZpZXdJdGVtcyA9IFtdO1xuXG5cdFx0dGhpcy5zYXNoSXRlbXMuZm9yRWFjaChpID0+IGkuZGlzcG9zYWJsZS5kaXNwb3NlKCkpO1xuXHRcdHRoaXMuc2FzaEl0ZW1zID0gW107XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsR0FBRyx1QkFBdUIsUUFBUSxXQUFXLG9DQUFvQztBQUMxRixTQUFTLGtCQUFrQjtBQUMzQixTQUF1QyxhQUFhLE1BQU0saUJBQWlCO0FBQzNFLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsV0FBVyxhQUFhLGFBQWE7QUFDOUMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMs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TTtBQUNsQixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFHQSxlQUFXLFNBQVMsU0FBUztBQUM1QixZQUFNLFdBQVcsS0FBSyxVQUFVLEtBQUs7QUFFckMsVUFBSSxTQUFTLFdBQVcsU0FBUyxjQUFjLFNBQVMsY0FBYyxHQUFHO0FBQ3hFLGVBQU87QUFBQSxNQUNSO0FBRUEsVUFBSSxDQUFDLFNBQVMsV0FBVyxTQUFTLE1BQU07QUFDdkMsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLHNCQUFzQjtBQUM3QixRQUFJLE1BQU0sUUFBVyxNQUFNO0FBRTNCLGVBQVcsUUFBUSxLQUFLLFdBQVc7QUFDbEMsWUFBTSxRQUFRLFNBQVksS0FBSyxPQUFPLEtBQUssSUFBSSxLQUFLLEtBQUssSUFBSTtBQUM3RCxZQUFNLFFBQVEsU0FBWSxLQUFLLE9BQU8sS0FBSyxJQUFJLEtBQUssS0FBSyxJQUFJO0FBRTdELFVBQUksTUFBTSxNQUFNLEdBQUc7QUFDbEIsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVTLFVBQWdCO0FBQ3hCLFNBQUssZUFBZSxXQUFXLFFBQVE7QUFFdkMsWUFBUSxLQUFLLFNBQVM7QUFDdEIsU0FBSyxZQUFZLENBQUM7QUFFbEIsU0FBSyxVQUFVLFFBQVEsT0FBSyxFQUFFLFdBQVcsUUFBUSxDQUFDO0FBQ2xELFNBQUssWUFBWSxDQUFDO0FBRWxCLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFDRDsiLAogICJuYW1lcyI6IFsiT3JpZW50YXRpb24iLCAiTGF5b3V0UHJpb3JpdHkiLCAiU3RhdGUiLCAiU2l6aW5nIiwgInN0YXJ0IiwgImFsdCIsICJtaW5EZWx0YSIsICJtYXhEZWx0YSIsICJzaXplIiwgIm9uQ2hhbmdlRGlzcG9zYWJsZSIsICJpdGVtIiwgImluZGV4IiwgImRpc3Bvc2FibGUiXQp9Cg==
