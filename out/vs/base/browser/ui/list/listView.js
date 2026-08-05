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
import { DataTransfers } from "../../dnd.js";
import { addDisposableListener, animate, getActiveElement, getContentHeight, getContentWidth, getDocument, getTopLeftOffset, getWindow, isAncestor, isHTMLElement, isSVGElement, scheduleAtNextAnimationFrame } from "../../dom.js";
import { DomEmitter } from "../../event.js";
import { EventType as TouchEventType, Gesture } from "../../touch.js";
import { SmoothScrollableElement } from "../scrollbar/scrollableElement.js";
import { distinct, equals, splice } from "../../../common/arrays.js";
import { Delayer, disposableTimeout } from "../../../common/async.js";
import { memoize } from "../../../common/decorators.js";
import { Emitter, Event } from "../../../common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../common/lifecycle.js";
import { Range } from "../../../common/range.js";
import { Scrollable, ScrollbarVisibility } from "../../../common/scrollable.js";
import { ListDragOverEffectPosition, ListDragOverEffectType } from "./list.js";
import { RangeMap, shift } from "./rangeMap.js";
import { RowCache } from "./rowCache.js";
import { BugIndicatingError } from "../../../common/errors.js";
import { clamp } from "../../../common/numbers.js";
import { applyDragImage } from "../dnd/dnd.js";
const StaticDND = {
  CurrentDragAndDropData: void 0
};
var ListViewTargetSector = /* @__PURE__ */ ((ListViewTargetSector2) => {
  ListViewTargetSector2[ListViewTargetSector2["TOP"] = 0] = "TOP";
  ListViewTargetSector2[ListViewTargetSector2["CENTER_TOP"] = 1] = "CENTER_TOP";
  ListViewTargetSector2[ListViewTargetSector2["CENTER_BOTTOM"] = 2] = "CENTER_BOTTOM";
  ListViewTargetSector2[ListViewTargetSector2["BOTTOM"] = 3] = "BOTTOM";
  return ListViewTargetSector2;
})(ListViewTargetSector || {});
const DefaultOptions = {
  useShadows: true,
  verticalScrollMode: ScrollbarVisibility.Auto,
  setRowLineHeight: true,
  setRowHeight: true,
  supportDynamicHeights: false,
  dnd: {
    getDragElements(e) {
      return [e];
    },
    getDragURI() {
      return null;
    },
    onDragStart() {
    },
    onDragOver() {
      return false;
    },
    drop() {
    },
    dispose() {
    }
  },
  horizontalScrolling: false,
  transformOptimization: true,
  alwaysConsumeMouseWheel: true
};
class ElementsDragAndDropData {
  get context() {
    return this._context;
  }
  set context(value) {
    this._context = value;
  }
  constructor(elements) {
    this.elements = elements;
  }
  update() {
  }
  getData() {
    return this.elements;
  }
}
class ExternalElementsDragAndDropData {
  constructor(elements) {
    this.elements = elements;
  }
  update() {
  }
  getData() {
    return this.elements;
  }
}
class NativeDragAndDropData {
  constructor() {
    this.types = [];
    this.files = [];
  }
  update(dataTransfer) {
    if (dataTransfer.types) {
      this.types.splice(0, this.types.length, ...dataTransfer.types);
    }
    if (dataTransfer.files) {
      this.files.splice(0, this.files.length);
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files.item(i);
        if (file && (file.size || file.type)) {
          this.files.push(file);
        }
      }
    }
  }
  getData() {
    return {
      types: this.types,
      files: this.files
    };
  }
}
function equalsDragFeedback(f1, f2) {
  if (Array.isArray(f1) && Array.isArray(f2)) {
    return equals(f1, f2);
  }
  return f1 === f2;
}
class ListViewAccessibilityProvider {
  constructor(accessibilityProvider) {
    if (accessibilityProvider?.getSetSize) {
      this.getSetSize = accessibilityProvider.getSetSize.bind(accessibilityProvider);
    } else {
      this.getSetSize = (e, i, l) => l;
    }
    if (accessibilityProvider?.getPosInSet) {
      this.getPosInSet = accessibilityProvider.getPosInSet.bind(accessibilityProvider);
    } else {
      this.getPosInSet = (e, i) => i + 1;
    }
    if (accessibilityProvider?.getRole) {
      this.getRole = accessibilityProvider.getRole.bind(accessibilityProvider);
    } else {
      this.getRole = (_) => "listitem";
    }
    if (accessibilityProvider?.isChecked) {
      this.isChecked = accessibilityProvider.isChecked.bind(accessibilityProvider);
    } else {
      this.isChecked = (_) => void 0;
    }
  }
}
const _ListView = class _ListView {
  constructor(container, virtualDelegate, renderers, options = DefaultOptions) {
    this.virtualDelegate = virtualDelegate;
    this.domId = `list_id_${++_ListView.InstanceCount}`;
    this.renderers = /* @__PURE__ */ new Map();
    this.renderWidth = 0;
    this._scrollHeight = 0;
    this.scrollableElementUpdateDisposable = null;
    this.scrollableElementWidthDelayer = new Delayer(50);
    this.splicing = false;
    this.dragOverAnimationStopDisposable = Disposable.None;
    this.dragOverMouseY = 0;
    this.canDrop = false;
    this.currentDragFeedbackDisposable = Disposable.None;
    this.onDragLeaveTimeout = Disposable.None;
    this.currentSelectionDisposable = Disposable.None;
    this.disposables = new DisposableStore();
    this._onDidChangeContentHeight = new Emitter();
    this._onDidChangeContentWidth = new Emitter();
    this.onDidChangeContentHeight = Event.latch(this._onDidChangeContentHeight.event, void 0, this.disposables);
    this.onDidChangeContentWidth = Event.latch(this._onDidChangeContentWidth.event, void 0, this.disposables);
    this._horizontalScrolling = false;
    if (options.horizontalScrolling && options.supportDynamicHeights) {
      throw new Error("Horizontal scrolling and dynamic heights not supported simultaneously");
    }
    this.items = [];
    this.itemId = 0;
    this.rangeMap = this.createRangeMap(options.paddingTop ?? 0);
    for (const renderer of renderers) {
      this.renderers.set(renderer.templateId, renderer);
    }
    this.cache = this.disposables.add(new RowCache(this.renderers));
    this.lastRenderTop = 0;
    this.lastRenderHeight = 0;
    this.domNode = document.createElement("div");
    this.domNode.className = "monaco-list";
    this.domNode.classList.add(this.domId);
    this.domNode.tabIndex = 0;
    this.domNode.classList.toggle("mouse-support", typeof options.mouseSupport === "boolean" ? options.mouseSupport : true);
    this._horizontalScrolling = options.horizontalScrolling ?? DefaultOptions.horizontalScrolling;
    this.domNode.classList.toggle("horizontal-scrolling", this._horizontalScrolling);
    this.paddingBottom = typeof options.paddingBottom === "undefined" ? 0 : options.paddingBottom;
    this.accessibilityProvider = new ListViewAccessibilityProvider(options.accessibilityProvider);
    this.rowsContainer = document.createElement("div");
    this.rowsContainer.className = "monaco-list-rows";
    const transformOptimization = options.transformOptimization ?? DefaultOptions.transformOptimization;
    if (transformOptimization) {
      this.rowsContainer.style.transform = "translate3d(0px, 0px, 0px)";
      this.rowsContainer.style.overflow = "hidden";
      this.rowsContainer.style.contain = "strict";
    }
    this.disposables.add(Gesture.addTarget(this.rowsContainer));
    this.scrollable = this.disposables.add(new Scrollable({
      forceIntegerValues: true,
      smoothScrollDuration: options.smoothScrolling ?? false ? 125 : 0,
      scheduleAtNextAnimationFrame: (cb) => scheduleAtNextAnimationFrame(getWindow(this.domNode), cb)
    }));
    this.scrollableElement = this.disposables.add(new SmoothScrollableElement(this.rowsContainer, {
      alwaysConsumeMouseWheel: options.alwaysConsumeMouseWheel ?? DefaultOptions.alwaysConsumeMouseWheel,
      horizontal: ScrollbarVisibility.Auto,
      vertical: options.verticalScrollMode ?? DefaultOptions.verticalScrollMode,
      useShadows: options.useShadows ?? DefaultOptions.useShadows,
      mouseWheelScrollSensitivity: options.mouseWheelScrollSensitivity,
      fastScrollSensitivity: options.fastScrollSensitivity,
      scrollByPage: options.scrollByPage
    }, this.scrollable));
    this.domNode.appendChild(this.scrollableElement.getDomNode());
    container.appendChild(this.domNode);
    this.scrollableElement.onScroll(this.onScroll, this, this.disposables);
    this.disposables.add(addDisposableListener(this.rowsContainer, TouchEventType.Change, (e) => this.onTouchChange(e)));
    this.disposables.add(addDisposableListener(this.scrollableElement.getDomNode(), "scroll", (e) => {
      const element = e.target;
      const scrollValue = element.scrollTop;
      element.scrollTop = 0;
      if (options.scrollToActiveElement) {
        this.setScrollTop(this.scrollTop + scrollValue);
      }
    }));
    this.disposables.add(addDisposableListener(this.domNode, "dragover", (e) => this.onDragOver(this.toDragEvent(e))));
    this.disposables.add(addDisposableListener(this.domNode, "drop", (e) => this.onDrop(this.toDragEvent(e))));
    this.disposables.add(addDisposableListener(this.domNode, "dragleave", (e) => this.onDragLeave(this.toDragEvent(e))));
    this.disposables.add(addDisposableListener(this.domNode, "dragend", (e) => this.onDragEnd(e)));
    if (options.userSelection) {
      if (options.dnd) {
        throw new Error("DND and user selection cannot be used simultaneously");
      }
      this.disposables.add(addDisposableListener(this.domNode, "mousedown", (e) => this.onPotentialSelectionStart(e)));
    }
    this.setRowLineHeight = options.setRowLineHeight ?? DefaultOptions.setRowLineHeight;
    this.setRowHeight = options.setRowHeight ?? DefaultOptions.setRowHeight;
    this.supportDynamicHeights = options.supportDynamicHeights ?? DefaultOptions.supportDynamicHeights;
    this.dnd = options.dnd ?? this.disposables.add(DefaultOptions.dnd);
    this.layout(options.initialSize?.height, options.initialSize?.width);
    if (options.scrollToActiveElement) {
      this._setupFocusObserver(container);
    }
  }
  get contentHeight() {
    return this.rangeMap.size;
  }
  get contentWidth() {
    return this.scrollWidth ?? 0;
  }
  get onDidScroll() {
    return this.scrollableElement.onScroll;
  }
  get onWillScroll() {
    return this.scrollableElement.onWillScroll;
  }
  get containerDomNode() {
    return this.rowsContainer;
  }
  get scrollableElementDomNode() {
    return this.scrollableElement.getDomNode();
  }
  get horizontalScrolling() {
    return this._horizontalScrolling;
  }
  set horizontalScrolling(value) {
    if (value === this._horizontalScrolling) {
      return;
    }
    if (value && this.supportDynamicHeights) {
      throw new Error("Horizontal scrolling and dynamic heights not supported simultaneously");
    }
    this._horizontalScrolling = value;
    this.domNode.classList.toggle("horizontal-scrolling", this._horizontalScrolling);
    if (this._horizontalScrolling) {
      for (const item of this.items) {
        this.measureItemWidth(item);
      }
      this.updateScrollWidth();
      this.scrollableElement.setScrollDimensions({ width: getContentWidth(this.domNode) });
      this.rowsContainer.style.width = `${Math.max(this.scrollWidth || 0, this.renderWidth)}px`;
    } else {
      this.scrollableElementWidthDelayer.cancel();
      this.scrollableElement.setScrollDimensions({ width: this.renderWidth, scrollWidth: this.renderWidth });
      this.rowsContainer.style.width = "";
    }
  }
  _setupFocusObserver(container) {
    this.disposables.add(addDisposableListener(container, "focus", () => {
      const element = getActiveElement();
      if (this.activeElement !== element && element !== null) {
        this.activeElement = element;
        this._scrollToActiveElement(this.activeElement, container);
      }
    }, true));
  }
  _scrollToActiveElement(element, container) {
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const topOffset = elementRect.top - containerRect.top;
    if (topOffset < 0) {
      this.setScrollTop(this.scrollTop + topOffset);
    }
  }
  updateOptions(options) {
    if (options.paddingBottom !== void 0) {
      this.paddingBottom = options.paddingBottom;
      this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
    }
    if (options.smoothScrolling !== void 0) {
      this.scrollable.setSmoothScrollDuration(options.smoothScrolling ? 125 : 0);
    }
    if (options.horizontalScrolling !== void 0) {
      this.horizontalScrolling = options.horizontalScrolling;
    }
    let scrollableOptions;
    if (options.scrollByPage !== void 0) {
      scrollableOptions = { ...scrollableOptions ?? {}, scrollByPage: options.scrollByPage };
    }
    if (options.mouseWheelScrollSensitivity !== void 0) {
      scrollableOptions = { ...scrollableOptions ?? {}, mouseWheelScrollSensitivity: options.mouseWheelScrollSensitivity };
    }
    if (options.fastScrollSensitivity !== void 0) {
      scrollableOptions = { ...scrollableOptions ?? {}, fastScrollSensitivity: options.fastScrollSensitivity };
    }
    if (scrollableOptions) {
      this.scrollableElement.updateOptions(scrollableOptions);
    }
    if (options.paddingTop !== void 0 && options.paddingTop !== this.rangeMap.paddingTop) {
      const lastRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
      const offset = options.paddingTop - this.rangeMap.paddingTop;
      this.rangeMap.paddingTop = options.paddingTop;
      this.render(lastRenderRange, Math.max(0, this.lastRenderTop + offset), this.lastRenderHeight, void 0, void 0, true);
      this.setScrollTop(this.lastRenderTop);
      this.eventuallyUpdateScrollDimensions();
      if (this.supportDynamicHeights) {
        this._rerender(this.lastRenderTop, this.lastRenderHeight);
      }
    }
  }
  delegateScrollFromMouseWheelEvent(browserEvent) {
    this.scrollableElement.delegateScrollFromMouseWheelEvent(browserEvent);
  }
  delegateVerticalScrollbarPointerDown(browserEvent) {
    this.scrollableElement.delegateVerticalScrollbarPointerDown(browserEvent);
  }
  updateElementHeight(index, size, anchorIndex) {
    if (index < 0 || index >= this.items.length) {
      return;
    }
    const originalSize = this.items[index].size;
    if (typeof size === "undefined") {
      if (!this.supportDynamicHeights) {
        console.warn("Dynamic heights not supported", new Error().stack);
        return;
      }
      this.items[index].lastDynamicHeightWidth = void 0;
      size = originalSize + this.probeDynamicHeight(index);
    }
    if (originalSize === size) {
      return;
    }
    const lastRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
    let heightDiff = 0;
    if (index < lastRenderRange.start) {
      heightDiff = size - originalSize;
    } else {
      if (anchorIndex !== null && anchorIndex > index && anchorIndex < lastRenderRange.end) {
        heightDiff = size - originalSize;
      } else {
        heightDiff = 0;
      }
    }
    this.rangeMap.splice(index, 1, [{ size }]);
    this.items[index].size = size;
    this.render(lastRenderRange, Math.max(0, this.lastRenderTop + heightDiff), this.lastRenderHeight, void 0, void 0, true);
    this.setScrollTop(this.lastRenderTop);
    this.eventuallyUpdateScrollDimensions();
    if (this.supportDynamicHeights) {
      this._rerender(this.lastRenderTop, this.lastRenderHeight);
    } else {
      this._onDidChangeContentHeight.fire(this.contentHeight);
    }
  }
  createRangeMap(paddingTop) {
    return new RangeMap(paddingTop);
  }
  splice(start, deleteCount, elements = []) {
    if (this.splicing) {
      throw new Error("Can't run recursive splices.");
    }
    this.splicing = true;
    try {
      return this._splice(start, deleteCount, elements);
    } finally {
      this.splicing = false;
      this._onDidChangeContentHeight.fire(this.contentHeight);
    }
  }
  _splice(start, deleteCount, elements = []) {
    const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
    const deleteRange = { start, end: start + deleteCount };
    const removeRange = Range.intersect(previousRenderRange, deleteRange);
    const rowsToDispose = /* @__PURE__ */ new Map();
    for (let i = removeRange.end - 1; i >= removeRange.start; i--) {
      const item = this.items[i];
      item.dragStartDisposable.dispose();
      item.checkedDisposable.dispose();
      if (item.row) {
        let rows = rowsToDispose.get(item.templateId);
        if (!rows) {
          rows = [];
          rowsToDispose.set(item.templateId, rows);
        }
        const renderer = this.renderers.get(item.templateId);
        if (renderer && renderer.disposeElement) {
          renderer.disposeElement(item.element, i, item.row.templateData, item.size);
        }
        rows.unshift(item.row);
      }
      item.row = null;
      item.stale = true;
    }
    const previousRestRange = { start: start + deleteCount, end: this.items.length };
    const previousRenderedRestRange = Range.intersect(previousRestRange, previousRenderRange);
    const previousUnrenderedRestRanges = Range.relativeComplement(previousRestRange, previousRenderRange);
    const inserted = elements.map((element) => ({
      id: String(this.itemId++),
      element,
      templateId: this.virtualDelegate.getTemplateId(element),
      size: this.virtualDelegate.getHeight(element),
      width: void 0,
      hasDynamicHeight: !!this.virtualDelegate.hasDynamicHeight && this.virtualDelegate.hasDynamicHeight(element),
      lastDynamicHeightWidth: void 0,
      row: null,
      uri: void 0,
      dropTarget: false,
      dragStartDisposable: Disposable.None,
      checkedDisposable: Disposable.None,
      stale: false
    }));
    let deleted;
    if (start === 0 && deleteCount >= this.items.length) {
      this.rangeMap = this.createRangeMap(this.rangeMap.paddingTop);
      this.rangeMap.splice(0, 0, inserted);
      deleted = this.items;
      this.items = inserted;
    } else {
      this.rangeMap.splice(start, deleteCount, inserted);
      deleted = splice(this.items, start, deleteCount, inserted);
    }
    const delta = elements.length - deleteCount;
    const renderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
    const renderedRestRange = shift(previousRenderedRestRange, delta);
    const updateRange = Range.intersect(renderRange, renderedRestRange);
    for (let i = updateRange.start; i < updateRange.end; i++) {
      this.updateItemInDOM(this.items[i], i);
    }
    const removeRanges = Range.relativeComplement(renderedRestRange, renderRange);
    for (const range of removeRanges) {
      for (let i = range.start; i < range.end; i++) {
        this.removeItemFromDOM(i);
      }
    }
    const unrenderedRestRanges = previousUnrenderedRestRanges.map((r) => shift(r, delta));
    const elementsRange = { start, end: start + elements.length };
    const insertRanges = [elementsRange, ...unrenderedRestRanges].map((r) => Range.intersect(renderRange, r)).reverse();
    for (const range of insertRanges) {
      for (let i = range.end - 1; i >= range.start; i--) {
        const item = this.items[i];
        const rows = rowsToDispose.get(item.templateId);
        const row = rows?.pop();
        this.insertItemInDOM(i, row);
      }
    }
    for (const rows of rowsToDispose.values()) {
      for (const row of rows) {
        this.cache.release(row);
      }
    }
    this.eventuallyUpdateScrollDimensions();
    if (this.supportDynamicHeights) {
      this._rerender(this.scrollTop, this.renderHeight);
    }
    return deleted.map((i) => i.element);
  }
  eventuallyUpdateScrollDimensions() {
    this._scrollHeight = this.contentHeight;
    this.rowsContainer.style.height = `${this._scrollHeight}px`;
    if (!this.scrollableElementUpdateDisposable) {
      this.scrollableElementUpdateDisposable = scheduleAtNextAnimationFrame(getWindow(this.domNode), () => {
        this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
        this.updateScrollWidth();
        this.scrollableElementUpdateDisposable = null;
      });
    }
  }
  eventuallyUpdateScrollWidth() {
    if (!this.horizontalScrolling) {
      this.scrollableElementWidthDelayer.cancel();
      return;
    }
    this.scrollableElementWidthDelayer.trigger(() => this.updateScrollWidth());
  }
  updateScrollWidth() {
    if (!this.horizontalScrolling) {
      return;
    }
    let scrollWidth = 0;
    for (const item of this.items) {
      if (typeof item.width !== "undefined") {
        scrollWidth = Math.max(scrollWidth, item.width);
      }
    }
    this.scrollWidth = scrollWidth;
    this.scrollableElement.setScrollDimensions({ scrollWidth: scrollWidth === 0 ? 0 : scrollWidth + 10 });
    this._onDidChangeContentWidth.fire(this.scrollWidth);
  }
  updateWidth(index) {
    if (!this.horizontalScrolling || typeof this.scrollWidth === "undefined") {
      return;
    }
    const item = this.items[index];
    this.measureItemWidth(item);
    if (typeof item.width !== "undefined" && item.width > this.scrollWidth) {
      this.scrollWidth = item.width;
      this.scrollableElement.setScrollDimensions({ scrollWidth: this.scrollWidth + 10 });
      this._onDidChangeContentWidth.fire(this.scrollWidth);
    }
  }
  rerender() {
    if (!this.supportDynamicHeights) {
      return;
    }
    for (const item of this.items) {
      item.lastDynamicHeightWidth = void 0;
    }
    this._rerender(this.lastRenderTop, this.lastRenderHeight);
  }
  get length() {
    return this.items.length;
  }
  get renderHeight() {
    const scrollDimensions = this.scrollableElement.getScrollDimensions();
    return scrollDimensions.height;
  }
  get firstVisibleIndex() {
    const range = this.getVisibleRange(this.lastRenderTop, this.lastRenderHeight);
    return range.start;
  }
  get firstMostlyVisibleIndex() {
    const firstVisibleIndex = this.firstVisibleIndex;
    const firstElTop = this.rangeMap.positionAt(firstVisibleIndex);
    const nextElTop = this.rangeMap.positionAt(firstVisibleIndex + 1);
    if (nextElTop !== -1) {
      const firstElMidpoint = (nextElTop - firstElTop) / 2 + firstElTop;
      if (firstElMidpoint < this.scrollTop) {
        return firstVisibleIndex + 1;
      }
    }
    return firstVisibleIndex;
  }
  get lastVisibleIndex() {
    const range = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
    return range.end - 1;
  }
  element(index) {
    return this.items[index].element;
  }
  indexOf(element) {
    return this.items.findIndex((item) => item.element === element);
  }
  domElement(index) {
    const row = this.items[index].row;
    return row && row.domNode;
  }
  elementHeight(index) {
    return this.items[index].size;
  }
  elementTop(index) {
    return this.rangeMap.positionAt(index);
  }
  indexAt(position) {
    return this.rangeMap.indexAt(position);
  }
  indexAfter(position) {
    return this.rangeMap.indexAfter(position);
  }
  layout(height, width) {
    const scrollDimensions = {
      height: typeof height === "number" ? height : getContentHeight(this.domNode)
    };
    if (this.scrollableElementUpdateDisposable) {
      this.scrollableElementUpdateDisposable.dispose();
      this.scrollableElementUpdateDisposable = null;
      scrollDimensions.scrollHeight = this.scrollHeight;
    }
    this.scrollableElement.setScrollDimensions(scrollDimensions);
    if (typeof width !== "undefined") {
      this.renderWidth = width;
      if (this.supportDynamicHeights) {
        this._rerender(this.scrollTop, this.renderHeight);
      }
    }
    if (this.horizontalScrolling) {
      this.scrollableElement.setScrollDimensions({
        width: typeof width === "number" ? width : getContentWidth(this.domNode)
      });
    }
  }
  // Render
  render(previousRenderRange, renderTop, renderHeight, renderLeft, scrollWidth, updateItemsInDOM = false) {
    const renderRange = this.getRenderRange(renderTop, renderHeight);
    const rangesToInsert = Range.relativeComplement(renderRange, previousRenderRange).reverse();
    const rangesToRemove = Range.relativeComplement(previousRenderRange, renderRange);
    if (updateItemsInDOM) {
      const rangesToUpdate = Range.intersect(previousRenderRange, renderRange);
      for (let i = rangesToUpdate.start; i < rangesToUpdate.end; i++) {
        this.updateItemInDOM(this.items[i], i);
      }
    }
    this.cache.transact(() => {
      for (const range of rangesToRemove) {
        for (let i = range.start; i < range.end; i++) {
          this.removeItemFromDOM(i);
        }
      }
      for (const range of rangesToInsert) {
        for (let i = range.end - 1; i >= range.start; i--) {
          this.insertItemInDOM(i);
        }
      }
    });
    if (renderLeft !== void 0) {
      this.rowsContainer.style.left = `-${renderLeft}px`;
    }
    this.rowsContainer.style.top = `-${renderTop}px`;
    if (this.horizontalScrolling && scrollWidth !== void 0) {
      this.rowsContainer.style.width = `${Math.max(scrollWidth, this.renderWidth)}px`;
    }
    this.lastRenderTop = renderTop;
    this.lastRenderHeight = renderHeight;
  }
  // DOM operations
  insertItemInDOM(index, row) {
    const item = this.items[index];
    if (!item.row) {
      if (row) {
        item.row = row;
        item.stale = true;
      } else {
        const result = this.cache.alloc(item.templateId);
        item.row = result.row;
        item.stale ||= result.isReusingConnectedDomNode;
      }
    }
    const role = this.accessibilityProvider.getRole(item.element) || "listitem";
    item.row.domNode.setAttribute("role", role);
    const checked = this.accessibilityProvider.isChecked(item.element);
    if (typeof checked === "boolean") {
      item.row.domNode.setAttribute("aria-checked", String(!!checked));
    } else if (checked) {
      const update = (checked2) => item.row.domNode.setAttribute("aria-checked", String(!!checked2));
      update(checked.value);
      item.checkedDisposable = checked.onDidChange(() => update(checked.value));
    }
    if (item.stale || !item.row.domNode.parentElement) {
      const referenceNode = this.items.at(index + 1)?.row?.domNode ?? null;
      if (item.row.domNode.parentElement !== this.rowsContainer || item.row.domNode.nextElementSibling !== referenceNode) {
        this.rowsContainer.insertBefore(item.row.domNode, referenceNode);
      }
      item.stale = false;
    }
    this.updateItemInDOM(item, index);
    const renderer = this.renderers.get(item.templateId);
    if (!renderer) {
      throw new Error(`No renderer found for template id ${item.templateId}`);
    }
    renderer?.renderElement(item.element, index, item.row.templateData, item.size);
    const uri = this.dnd.getDragURI(item.element);
    item.dragStartDisposable.dispose();
    item.row.domNode.draggable = !!uri;
    if (uri) {
      item.dragStartDisposable = addDisposableListener(item.row.domNode, "dragstart", (event) => this.onDragStart(item.element, uri, event));
    }
    if (this.horizontalScrolling) {
      this.measureItemWidth(item);
      this.eventuallyUpdateScrollWidth();
    }
  }
  measureItemWidth(item) {
    if (!item.row || !item.row.domNode) {
      return;
    }
    item.row.domNode.style.width = "fit-content";
    item.width = getContentWidth(item.row.domNode);
    const style = getWindow(item.row.domNode).getComputedStyle(item.row.domNode);
    if (style.paddingLeft) {
      item.width += parseFloat(style.paddingLeft);
    }
    if (style.paddingRight) {
      item.width += parseFloat(style.paddingRight);
    }
    item.row.domNode.style.width = "";
  }
  updateItemInDOM(item, index) {
    item.row.domNode.style.top = `${this.elementTop(index)}px`;
    if (this.setRowHeight) {
      item.row.domNode.style.height = `${item.size}px`;
    }
    if (this.setRowLineHeight) {
      item.row.domNode.style.lineHeight = `${item.size}px`;
    }
    item.row.domNode.setAttribute("data-index", `${index}`);
    item.row.domNode.setAttribute("data-last-element", index === this.length - 1 ? "true" : "false");
    item.row.domNode.setAttribute("data-parity", index % 2 === 0 ? "even" : "odd");
    item.row.domNode.setAttribute("aria-setsize", String(this.accessibilityProvider.getSetSize(item.element, index, this.length)));
    item.row.domNode.setAttribute("aria-posinset", String(this.accessibilityProvider.getPosInSet(item.element, index)));
    item.row.domNode.setAttribute("id", this.getElementDomId(index));
    item.row.domNode.classList.toggle("drop-target", item.dropTarget);
  }
  removeItemFromDOM(index) {
    const item = this.items[index];
    item.dragStartDisposable.dispose();
    item.checkedDisposable.dispose();
    if (item.row) {
      const renderer = this.renderers.get(item.templateId);
      if (renderer && renderer.disposeElement) {
        renderer.disposeElement(item.element, index, item.row.templateData, item.size);
      }
      this.cache.release(item.row);
      item.row = null;
    }
    if (this.horizontalScrolling) {
      this.eventuallyUpdateScrollWidth();
    }
  }
  getScrollTop() {
    const scrollPosition = this.scrollableElement.getScrollPosition();
    return scrollPosition.scrollTop;
  }
  setScrollTop(scrollTop, reuseAnimation) {
    if (this.scrollableElementUpdateDisposable) {
      this.scrollableElementUpdateDisposable.dispose();
      this.scrollableElementUpdateDisposable = null;
      this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
    }
    this.scrollableElement.setScrollPosition({ scrollTop, reuseAnimation });
  }
  getScrollLeft() {
    const scrollPosition = this.scrollableElement.getScrollPosition();
    return scrollPosition.scrollLeft;
  }
  setScrollLeft(scrollLeft) {
    if (this.scrollableElementUpdateDisposable) {
      this.scrollableElementUpdateDisposable.dispose();
      this.scrollableElementUpdateDisposable = null;
      this.scrollableElement.setScrollDimensions({ scrollWidth: this.scrollWidth });
    }
    this.scrollableElement.setScrollPosition({ scrollLeft });
  }
  get scrollTop() {
    return this.getScrollTop();
  }
  set scrollTop(scrollTop) {
    this.setScrollTop(scrollTop);
  }
  get scrollHeight() {
    return this._scrollHeight + (this.horizontalScrolling ? 10 : 0) + this.paddingBottom;
  }
  get onMouseClick() {
    return Event.map(this.disposables.add(new DomEmitter(this.domNode, "click")).event, (e) => this.toMouseEvent(e), this.disposables);
  }
  get onMouseDblClick() {
    return Event.map(this.disposables.add(new DomEmitter(this.domNode, "dblclick")).event, (e) => this.toMouseEvent(e), this.disposables);
  }
  get onMouseMiddleClick() {
    return Event.filter(Event.map(this.disposables.add(new DomEmitter(this.domNode, "auxclick")).event, (e) => this.toMouseEvent(e), this.disposables), (e) => e.browserEvent.button === 1, this.disposables);
  }
  get onMouseUp() {
    return Event.map(this.disposables.add(new DomEmitter(this.domNode, "mouseup")).event, (e) => this.toMouseEvent(e), this.disposables);
  }
  get onMouseDown() {
    return Event.map(this.disposables.add(new DomEmitter(this.domNode, "mousedown")).event, (e) => this.toMouseEvent(e), this.disposables);
  }
  get onMouseOver() {
    return Event.map(this.disposables.add(new DomEmitter(this.domNode, "mouseover")).event, (e) => this.toMouseEvent(e), this.disposables);
  }
  get onMouseMove() {
    return Event.map(this.disposables.add(new DomEmitter(this.domNode, "mousemove")).event, (e) => this.toMouseEvent(e), this.disposables);
  }
  get onMouseOut() {
    return Event.map(this.disposables.add(new DomEmitter(this.domNode, "mouseout")).event, (e) => this.toMouseEvent(e), this.disposables);
  }
  get onContextMenu() {
    return Event.any(Event.map(this.disposables.add(new DomEmitter(this.domNode, "contextmenu")).event, (e) => this.toMouseEvent(e), this.disposables), Event.map(this.disposables.add(new DomEmitter(this.domNode, TouchEventType.Contextmenu)).event, (e) => this.toGestureEvent(e), this.disposables));
  }
  get onTouchStart() {
    return Event.map(this.disposables.add(new DomEmitter(this.domNode, "touchstart")).event, (e) => this.toTouchEvent(e), this.disposables);
  }
  get onTap() {
    return Event.map(this.disposables.add(new DomEmitter(this.rowsContainer, TouchEventType.Tap)).event, (e) => this.toGestureEvent(e), this.disposables);
  }
  toMouseEvent(browserEvent) {
    const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
    const item = typeof index === "undefined" ? void 0 : this.items[index];
    const element = item && item.element;
    return { browserEvent, index, element };
  }
  toTouchEvent(browserEvent) {
    const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
    const item = typeof index === "undefined" ? void 0 : this.items[index];
    const element = item && item.element;
    return { browserEvent, index, element };
  }
  toGestureEvent(browserEvent) {
    const index = this.getItemIndexFromEventTarget(browserEvent.initialTarget || null);
    const item = typeof index === "undefined" ? void 0 : this.items[index];
    const element = item && item.element;
    return { browserEvent, index, element };
  }
  toDragEvent(browserEvent) {
    const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
    const item = typeof index === "undefined" ? void 0 : this.items[index];
    const element = item && item.element;
    const sector = this.getTargetSector(browserEvent, index);
    return { browserEvent, index, element, sector };
  }
  onScroll(e) {
    try {
      const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
      this.render(previousRenderRange, e.scrollTop, e.height, e.scrollLeft, e.scrollWidth);
      if (this.supportDynamicHeights) {
        this._rerender(e.scrollTop, e.height, e.inSmoothScrolling);
      }
    } catch (err) {
      console.error("Got bad scroll event:", e);
      throw err;
    }
  }
  onTouchChange(event) {
    event.preventDefault();
    event.stopPropagation();
    this.scrollTop -= event.translationY;
  }
  // DND
  onDragStart(element, uri, event) {
    if (!event.dataTransfer) {
      return;
    }
    const elements = this.dnd.getDragElements(element);
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData(DataTransfers.TEXT, uri);
    let label;
    if (this.dnd.getDragLabel) {
      label = this.dnd.getDragLabel(elements, event);
    }
    if (typeof label === "undefined") {
      label = String(elements.length);
    }
    applyDragImage(event, this.domNode, label, [
      this.domId
      /* add domId to get list specific styling */
    ]);
    this.domNode.classList.add("dragging");
    this.currentDragData = new ElementsDragAndDropData(elements);
    StaticDND.CurrentDragAndDropData = new ExternalElementsDragAndDropData(elements);
    this.dnd.onDragStart?.(this.currentDragData, event);
  }
  onPotentialSelectionStart(e) {
    this.currentSelectionDisposable.dispose();
    const doc = getDocument(this.domNode);
    const selectionStore = this.currentSelectionDisposable = new DisposableStore();
    const movementStore = selectionStore.add(new DisposableStore());
    movementStore.add(addDisposableListener(this.domNode, "selectstart", () => {
      movementStore.add(addDisposableListener(doc, "mousemove", (e2) => {
        if (doc.getSelection()?.isCollapsed === false) {
          this.setupDragAndDropScrollTopAnimation(e2);
        }
      }));
      selectionStore.add(toDisposable(() => {
        const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
        this.currentSelectionBounds = void 0;
        this.render(previousRenderRange, this.lastRenderTop, this.lastRenderHeight, void 0, void 0);
      }));
      selectionStore.add(addDisposableListener(doc, "selectionchange", () => {
        const selection = doc.getSelection();
        if (!selection || selection.isCollapsed) {
          if (movementStore.isDisposed) {
            selectionStore.dispose();
          }
          return;
        }
        let start = this.getIndexOfListElement(selection.anchorNode);
        let end = this.getIndexOfListElement(selection.focusNode);
        if (start !== void 0 && end !== void 0) {
          if (end < start) {
            [start, end] = [end, start];
          }
          this.currentSelectionBounds = { start, end };
        }
      }));
    }));
    movementStore.add(addDisposableListener(doc, "mouseup", () => {
      movementStore.dispose();
      this.teardownDragAndDropScrollTopAnimation();
      if (doc.getSelection()?.isCollapsed !== false) {
        selectionStore.dispose();
      }
    }));
  }
  getIndexOfListElement(element) {
    if (!element || !this.domNode.contains(element)) {
      return void 0;
    }
    while (element && element !== this.domNode) {
      if (element.dataset?.index) {
        return Number(element.dataset.index);
      }
      element = element.parentElement;
    }
    return void 0;
  }
  onDragOver(event) {
    event.browserEvent.preventDefault();
    this.onDragLeaveTimeout.dispose();
    if (StaticDND.CurrentDragAndDropData && StaticDND.CurrentDragAndDropData.getData() === "vscode-ui") {
      return false;
    }
    this.setupDragAndDropScrollTopAnimation(event.browserEvent);
    if (!event.browserEvent.dataTransfer) {
      return false;
    }
    if (!this.currentDragData) {
      if (StaticDND.CurrentDragAndDropData) {
        this.currentDragData = StaticDND.CurrentDragAndDropData;
      } else {
        if (!event.browserEvent.dataTransfer.types) {
          return false;
        }
        this.currentDragData = new NativeDragAndDropData();
      }
    }
    const result = this.dnd.onDragOver(this.currentDragData, event.element, event.index, event.sector, event.browserEvent);
    this.canDrop = typeof result === "boolean" ? result : result.accept;
    if (!this.canDrop) {
      this.currentDragFeedback = void 0;
      this.currentDragFeedbackDisposable.dispose();
      return false;
    }
    event.browserEvent.dataTransfer.dropEffect = typeof result !== "boolean" && result.effect?.type === ListDragOverEffectType.Copy ? "copy" : "move";
    let feedback;
    if (typeof result !== "boolean" && result.feedback) {
      feedback = result.feedback;
    } else {
      if (typeof event.index === "undefined") {
        feedback = [-1];
      } else {
        feedback = [event.index];
      }
    }
    feedback = distinct(feedback).filter((i) => i >= -1 && i < this.length).sort((a, b) => a - b);
    feedback = feedback[0] === -1 ? [-1] : feedback;
    let dragOverEffectPosition = typeof result !== "boolean" && result.effect && result.effect.position ? result.effect.position : ListDragOverEffectPosition.Over;
    if (equalsDragFeedback(this.currentDragFeedback, feedback) && this.currentDragFeedbackPosition === dragOverEffectPosition) {
      return true;
    }
    this.currentDragFeedback = feedback;
    this.currentDragFeedbackPosition = dragOverEffectPosition;
    this.currentDragFeedbackDisposable.dispose();
    if (feedback[0] === -1) {
      this.domNode.classList.add(dragOverEffectPosition);
      this.rowsContainer.classList.add(dragOverEffectPosition);
      this.currentDragFeedbackDisposable = toDisposable(() => {
        this.domNode.classList.remove(dragOverEffectPosition);
        this.rowsContainer.classList.remove(dragOverEffectPosition);
      });
    } else {
      if (feedback.length > 1 && dragOverEffectPosition !== ListDragOverEffectPosition.Over) {
        throw new Error("Can't use multiple feedbacks with position different than 'over'");
      }
      if (dragOverEffectPosition === ListDragOverEffectPosition.After) {
        if (feedback[0] < this.length - 1) {
          feedback[0] += 1;
          dragOverEffectPosition = ListDragOverEffectPosition.Before;
        }
      }
      for (const index of feedback) {
        const item = this.items[index];
        item.dropTarget = true;
        item.row?.domNode.classList.add(dragOverEffectPosition);
      }
      this.currentDragFeedbackDisposable = toDisposable(() => {
        for (const index of feedback) {
          const item = this.items[index];
          item.dropTarget = false;
          item.row?.domNode.classList.remove(dragOverEffectPosition);
        }
      });
    }
    return true;
  }
  onDragLeave(event) {
    this.onDragLeaveTimeout.dispose();
    this.onDragLeaveTimeout = disposableTimeout(() => this.clearDragOverFeedback(), 100, this.disposables);
    if (this.currentDragData) {
      this.dnd.onDragLeave?.(this.currentDragData, event.element, event.index, event.browserEvent);
    }
  }
  onDrop(event) {
    if (!this.canDrop) {
      return;
    }
    const dragData = this.currentDragData;
    this.teardownDragAndDropScrollTopAnimation();
    this.clearDragOverFeedback();
    this.domNode.classList.remove("dragging");
    this.currentDragData = void 0;
    StaticDND.CurrentDragAndDropData = void 0;
    if (!dragData || !event.browserEvent.dataTransfer) {
      return;
    }
    event.browserEvent.preventDefault();
    dragData.update(event.browserEvent.dataTransfer);
    this.dnd.drop(dragData, event.element, event.index, event.sector, event.browserEvent);
  }
  onDragEnd(event) {
    this.canDrop = false;
    this.teardownDragAndDropScrollTopAnimation();
    this.clearDragOverFeedback();
    this.domNode.classList.remove("dragging");
    this.currentDragData = void 0;
    StaticDND.CurrentDragAndDropData = void 0;
    this.dnd.onDragEnd?.(event);
  }
  clearDragOverFeedback() {
    this.currentDragFeedback = void 0;
    this.currentDragFeedbackPosition = void 0;
    this.currentDragFeedbackDisposable.dispose();
    this.currentDragFeedbackDisposable = Disposable.None;
  }
  // DND scroll top animation
  setupDragAndDropScrollTopAnimation(event) {
    if (!this.dragOverAnimationDisposable) {
      const viewTop = getTopLeftOffset(this.domNode).top;
      this.dragOverAnimationDisposable = animate(getWindow(this.domNode), this.animateDragAndDropScrollTop.bind(this, viewTop));
    }
    this.dragOverAnimationStopDisposable.dispose();
    this.dragOverAnimationStopDisposable = disposableTimeout(() => {
      if (this.dragOverAnimationDisposable) {
        this.dragOverAnimationDisposable.dispose();
        this.dragOverAnimationDisposable = void 0;
      }
    }, 1e3, this.disposables);
    this.dragOverMouseY = event.pageY;
  }
  animateDragAndDropScrollTop(viewTop) {
    if (this.dragOverMouseY === void 0) {
      return;
    }
    const diff = this.dragOverMouseY - viewTop;
    const upperLimit = this.renderHeight - 35;
    if (diff < 35) {
      this.scrollTop += Math.max(-14, Math.floor(0.3 * (diff - 35)));
    } else if (diff > upperLimit) {
      this.scrollTop += Math.min(14, Math.floor(0.3 * (diff - upperLimit)));
    }
  }
  teardownDragAndDropScrollTopAnimation() {
    this.dragOverAnimationStopDisposable.dispose();
    if (this.dragOverAnimationDisposable) {
      this.dragOverAnimationDisposable.dispose();
      this.dragOverAnimationDisposable = void 0;
    }
  }
  // Util
  getTargetSector(browserEvent, targetIndex) {
    if (targetIndex === void 0) {
      return void 0;
    }
    const relativePosition = browserEvent.offsetY / this.items[targetIndex].size;
    const sector = Math.floor(relativePosition / 0.25);
    return clamp(sector, 0, 3);
  }
  getItemIndexFromEventTarget(target) {
    const scrollableElement = this.scrollableElement.getDomNode();
    let element = target;
    while ((isHTMLElement(element) || isSVGElement(element)) && element !== this.rowsContainer && scrollableElement.contains(element)) {
      const rawIndex = element.getAttribute("data-index");
      if (rawIndex) {
        const index = Number(rawIndex);
        if (!isNaN(index)) {
          return index;
        }
      }
      element = element.parentElement;
    }
    return void 0;
  }
  getVisibleRange(renderTop, renderHeight) {
    return {
      start: this.rangeMap.indexAt(renderTop),
      end: this.rangeMap.indexAfter(renderTop + renderHeight - 1)
    };
  }
  getRenderRange(renderTop, renderHeight) {
    const range = this.getVisibleRange(renderTop, renderHeight);
    if (this.currentSelectionBounds) {
      const max = this.rangeMap.count;
      range.start = Math.min(range.start, this.currentSelectionBounds.start, max);
      range.end = Math.min(Math.max(range.end, this.currentSelectionBounds.end + 1), max);
    }
    return range;
  }
  /**
   * Given a stable rendered state, checks every rendered element whether it needs
   * to be probed for dynamic height. Adjusts scroll height and top if necessary.
   */
  _rerender(renderTop, renderHeight, inSmoothScrolling) {
    const previousRenderRange = this.getRenderRange(renderTop, renderHeight);
    let anchorElementIndex;
    let anchorElementTopDelta;
    if (renderTop === this.elementTop(previousRenderRange.start)) {
      anchorElementIndex = previousRenderRange.start;
      anchorElementTopDelta = 0;
    } else if (previousRenderRange.end - previousRenderRange.start > 1) {
      anchorElementIndex = previousRenderRange.start + 1;
      anchorElementTopDelta = this.elementTop(anchorElementIndex) - renderTop;
    }
    let heightDiff = 0;
    while (true) {
      const renderRange = this.getRenderRange(renderTop, renderHeight);
      let didChange = false;
      for (let i = renderRange.start; i < renderRange.end; i++) {
        const diff = this.probeDynamicHeight(i);
        if (diff !== 0) {
          this.rangeMap.splice(i, 1, [this.items[i]]);
        }
        heightDiff += diff;
        didChange = didChange || diff !== 0;
      }
      if (!didChange) {
        if (heightDiff !== 0) {
          this.eventuallyUpdateScrollDimensions();
        }
        const unrenderRanges = Range.relativeComplement(previousRenderRange, renderRange);
        for (const range of unrenderRanges) {
          for (let i = range.start; i < range.end; i++) {
            if (this.items[i].row) {
              this.removeItemFromDOM(i);
            }
          }
        }
        const renderRanges = Range.relativeComplement(renderRange, previousRenderRange).reverse();
        for (const range of renderRanges) {
          for (let i = range.end - 1; i >= range.start; i--) {
            this.insertItemInDOM(i);
          }
        }
        for (let i = renderRange.start; i < renderRange.end; i++) {
          if (this.items[i].row) {
            this.updateItemInDOM(this.items[i], i);
          }
        }
        if (typeof anchorElementIndex === "number") {
          const deltaScrollTop = this.scrollable.getFutureScrollPosition().scrollTop - renderTop;
          const newScrollTop = this.elementTop(anchorElementIndex) - anchorElementTopDelta + deltaScrollTop;
          this.setScrollTop(newScrollTop, inSmoothScrolling);
        }
        this._onDidChangeContentHeight.fire(this.contentHeight);
        return;
      }
    }
  }
  probeDynamicHeight(index) {
    const item = this.items[index];
    if (!!this.virtualDelegate.getDynamicHeight) {
      const newSize = this.virtualDelegate.getDynamicHeight(item.element);
      if (newSize !== null) {
        const size2 = item.size;
        item.size = newSize;
        item.lastDynamicHeightWidth = this.renderWidth;
        return newSize - size2;
      }
    }
    if (!item.hasDynamicHeight || item.lastDynamicHeightWidth === this.renderWidth) {
      return 0;
    }
    if (!!this.virtualDelegate.hasDynamicHeight && !this.virtualDelegate.hasDynamicHeight(item.element)) {
      return 0;
    }
    const size = item.size;
    if (item.row) {
      item.row.domNode.style.height = "";
      item.size = item.row.domNode.offsetHeight;
      if (item.size === 0 && !isAncestor(item.row.domNode, getWindow(item.row.domNode).document.body)) {
        console.warn("Measuring item node that is not in DOM! Add ListView to the DOM before measuring row height!", new Error().stack);
      }
      item.lastDynamicHeightWidth = this.renderWidth;
      return item.size - size;
    }
    const { row } = this.cache.alloc(item.templateId);
    row.domNode.style.height = "";
    this.rowsContainer.appendChild(row.domNode);
    const renderer = this.renderers.get(item.templateId);
    if (!renderer) {
      throw new BugIndicatingError("Missing renderer for templateId: " + item.templateId);
    }
    renderer.renderElement(item.element, index, row.templateData, void 0);
    item.size = row.domNode.offsetHeight;
    renderer.disposeElement?.(item.element, index, row.templateData, void 0);
    this.virtualDelegate.setDynamicHeight?.(item.element, item.size);
    item.lastDynamicHeightWidth = this.renderWidth;
    row.domNode.remove();
    this.cache.release(row);
    return item.size - size;
  }
  getElementDomId(index) {
    return `${this.domId}_${index}`;
  }
  // Dispose
  dispose() {
    for (const item of this.items) {
      item.dragStartDisposable.dispose();
      item.checkedDisposable.dispose();
      if (item.row) {
        const renderer = this.renderers.get(item.row.templateId);
        if (renderer) {
          renderer.disposeElement?.(item.element, -1, item.row.templateData, void 0);
          renderer.disposeTemplate(item.row.templateData);
        }
      }
    }
    this.items = [];
    this.domNode?.remove();
    this.dragOverAnimationDisposable?.dispose();
    this.disposables.dispose();
  }
};
_ListView.InstanceCount = 0;
__decorateClass([
  memoize
], _ListView.prototype, "onMouseClick", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onMouseDblClick", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onMouseMiddleClick", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onMouseUp", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onMouseDown", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onMouseOver", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onMouseMove", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onMouseOut", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onContextMenu", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onTouchStart", 1);
__decorateClass([
  memoize
], _ListView.prototype, "onTap", 1);
let ListView = _ListView;
export {
  ElementsDragAndDropData,
  ExternalElementsDragAndDropData,
  ListView,
  ListViewTargetSector,
  NativeDragAndDropData
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0Vmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERhdGFUcmFuc2ZlcnMsIElEcmFnQW5kRHJvcERhdGEgfSBmcm9tICcuLi8uLi9kbmQuanMnO1xuaW1wb3J0IHsgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBhbmltYXRlLCBEaW1lbnNpb24sIGdldEFjdGl2ZUVsZW1lbnQsIGdldENvbnRlbnRIZWlnaHQsIGdldENvbnRlbnRXaWR0aCwgZ2V0RG9jdW1lbnQsIGdldFRvcExlZnRPZmZzZXQsIGdldFdpbmRvdywgaXNBbmNlc3RvciwgaXNIVE1MRWxlbWVudCwgaXNTVkdFbGVtZW50LCBzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lIH0gZnJvbSAnLi4vLi4vZG9tLmpzJztcbmltcG9ydCB7IERvbUVtaXR0ZXIgfSBmcm9tICcuLi8uLi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTW91c2VXaGVlbEV2ZW50IH0gZnJvbSAnLi4vLi4vbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBFdmVudFR5cGUgYXMgVG91Y2hFdmVudFR5cGUsIEdlc3R1cmUsIEdlc3R1cmVFdmVudCB9IGZyb20gJy4uLy4uL3RvdWNoLmpzJztcbmltcG9ydCB7IFNtb290aFNjcm9sbGFibGVFbGVtZW50IH0gZnJvbSAnLi4vc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50LmpzJztcbmltcG9ydCB7IGRpc3RpbmN0LCBlcXVhbHMsIHNwbGljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgRGVsYXllciwgZGlzcG9zYWJsZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50LCBJVmFsdWVXaXRoQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3JhbmdlLmpzJztcbmltcG9ydCB7IElOZXdTY3JvbGxEaW1lbnNpb25zLCBTY3JvbGxhYmxlLCBTY3JvbGxiYXJWaXNpYmlsaXR5LCBTY3JvbGxFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zY3JvbGxhYmxlLmpzJztcbmltcG9ydCB7IElTcGxpY2VhYmxlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcXVlbmNlLmpzJztcbmltcG9ydCB7IElMaXN0RHJhZ0FuZERyb3AsIElMaXN0RHJhZ0V2ZW50LCBJTGlzdEdlc3R1cmVFdmVudCwgSUxpc3RNb3VzZUV2ZW50LCBJTGlzdFJlbmRlcmVyLCBJTGlzdFRvdWNoRXZlbnQsIElMaXN0VmlydHVhbERlbGVnYXRlLCBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbiwgTGlzdERyYWdPdmVyRWZmZWN0VHlwZSB9IGZyb20gJy4vbGlzdC5qcyc7XG5pbXBvcnQgeyBJUmFuZ2VNYXAsIFJhbmdlTWFwLCBzaGlmdCB9IGZyb20gJy4vcmFuZ2VNYXAuanMnO1xuaW1wb3J0IHsgSVJvdywgUm93Q2FjaGUgfSBmcm9tICcuL3Jvd0NhY2hlLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgQXJpYVJvbGUgfSBmcm9tICcuLi9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgU2Nyb2xsYWJsZUVsZW1lbnRDaGFuZ2VPcHRpb25zIH0gZnJvbSAnLi4vc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50T3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IGFwcGx5RHJhZ0ltYWdlIH0gZnJvbSAnLi4vZG5kL2RuZC5qcyc7XG5cbmludGVyZmFjZSBJSXRlbTxUPiB7XG5cdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGVsZW1lbnQ6IFQ7XG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZztcblx0cm93OiBJUm93IHwgbnVsbDtcblx0c2l6ZTogbnVtYmVyO1xuXHR3aWR0aDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRoYXNEeW5hbWljSGVpZ2h0OiBib29sZWFuO1xuXHRsYXN0RHluYW1pY0hlaWdodFdpZHRoOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHVyaTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRkcm9wVGFyZ2V0OiBib29sZWFuO1xuXHRkcmFnU3RhcnREaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcblx0Y2hlY2tlZERpc3Bvc2FibGU6IElEaXNwb3NhYmxlO1xuXHRzdGFsZTogYm9vbGVhbjtcbn1cblxuY29uc3QgU3RhdGljRE5EID0ge1xuXHRDdXJyZW50RHJhZ0FuZERyb3BEYXRhOiB1bmRlZmluZWQgYXMgSURyYWdBbmREcm9wRGF0YSB8IHVuZGVmaW5lZFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBJTGlzdFZpZXdEcmFnQW5kRHJvcDxUPiBleHRlbmRzIElMaXN0RHJhZ0FuZERyb3A8VD4ge1xuXHRnZXREcmFnRWxlbWVudHMoZWxlbWVudDogVCk6IFRbXTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gTGlzdFZpZXdUYXJnZXRTZWN0b3Ige1xuXHQvLyBkcm9wIHBvc2l0aW9uIHJlbGF0aXZlIHRvIHRoZSB0b3Agb2YgdGhlIGl0ZW1cblx0VE9QID0gMCwgXHRcdFx0XHQvLyBbMCUtMjUlKVxuXHRDRU5URVJfVE9QID0gMSwgXHRcdC8vIFsyNSUtNTAlKVxuXHRDRU5URVJfQk9UVE9NID0gMiwgXHRcdC8vIFs1MCUtNzUlKVxuXHRCT1RUT00gPSAzXHRcdFx0XHQvLyBbNzUlLTEwMCUpXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxpc3RWaWV3QWNjZXNzaWJpbGl0eVByb3ZpZGVyPFQ+IHtcblx0Z2V0U2V0U2l6ZT8oZWxlbWVudDogVCwgaW5kZXg6IG51bWJlciwgbGlzdExlbmd0aDogbnVtYmVyKTogbnVtYmVyO1xuXHRnZXRQb3NJblNldD8oZWxlbWVudDogVCwgaW5kZXg6IG51bWJlcik6IG51bWJlcjtcblx0Z2V0Um9sZT8oZWxlbWVudDogVCk6IEFyaWFSb2xlIHwgdW5kZWZpbmVkO1xuXHRpc0NoZWNrZWQ/KGVsZW1lbnQ6IFQpOiBib29sZWFuIHwgSVZhbHVlV2l0aENoYW5nZUV2ZW50PGJvb2xlYW4+IHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElMaXN0Vmlld09wdGlvbnNVcGRhdGUge1xuXHRyZWFkb25seSBzbW9vdGhTY3JvbGxpbmc/OiBib29sZWFuO1xuXHRyZWFkb25seSBob3Jpem9udGFsU2Nyb2xsaW5nPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgc2Nyb2xsQnlQYWdlPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgbW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5PzogbnVtYmVyO1xuXHRyZWFkb25seSBmYXN0U2Nyb2xsU2Vuc2l0aXZpdHk/OiBudW1iZXI7XG5cdHJlYWRvbmx5IHBhZGRpbmdUb3A/OiBudW1iZXI7XG5cdHJlYWRvbmx5IHBhZGRpbmdCb3R0b20/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxpc3RWaWV3T3B0aW9uczxUPiBleHRlbmRzIElMaXN0Vmlld09wdGlvbnNVcGRhdGUge1xuXHRyZWFkb25seSBkbmQ/OiBJTGlzdFZpZXdEcmFnQW5kRHJvcDxUPjtcblx0cmVhZG9ubHkgdXNlU2hhZG93cz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHZlcnRpY2FsU2Nyb2xsTW9kZT86IFNjcm9sbGJhclZpc2liaWxpdHk7XG5cdHJlYWRvbmx5IHNldFJvd0xpbmVIZWlnaHQ/OiBib29sZWFuO1xuXHRyZWFkb25seSBzZXRSb3dIZWlnaHQ/OiBib29sZWFuO1xuXHRyZWFkb25seSBzdXBwb3J0RHluYW1pY0hlaWdodHM/OiBib29sZWFuO1xuXHRyZWFkb25seSBtb3VzZVN1cHBvcnQ/OiBib29sZWFuO1xuXHRyZWFkb25seSB1c2VyU2VsZWN0aW9uPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgYWNjZXNzaWJpbGl0eVByb3ZpZGVyPzogSUxpc3RWaWV3QWNjZXNzaWJpbGl0eVByb3ZpZGVyPFQ+O1xuXHRyZWFkb25seSB0cmFuc2Zvcm1PcHRpbWl6YXRpb24/OiBib29sZWFuO1xuXHRyZWFkb25seSBhbHdheXNDb25zdW1lTW91c2VXaGVlbD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGluaXRpYWxTaXplPzogRGltZW5zaW9uO1xuXHRyZWFkb25seSBzY3JvbGxUb0FjdGl2ZUVsZW1lbnQ/OiBib29sZWFuO1xufVxuXG5jb25zdCBEZWZhdWx0T3B0aW9ucyA9IHtcblx0dXNlU2hhZG93czogdHJ1ZSxcblx0dmVydGljYWxTY3JvbGxNb2RlOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkF1dG8sXG5cdHNldFJvd0xpbmVIZWlnaHQ6IHRydWUsXG5cdHNldFJvd0hlaWdodDogdHJ1ZSxcblx0c3VwcG9ydER5bmFtaWNIZWlnaHRzOiBmYWxzZSxcblx0ZG5kOiB7XG5cdFx0Z2V0RHJhZ0VsZW1lbnRzPFQ+KGU6IFQpIHsgcmV0dXJuIFtlXTsgfSxcblx0XHRnZXREcmFnVVJJKCkgeyByZXR1cm4gbnVsbDsgfSxcblx0XHRvbkRyYWdTdGFydCgpOiB2b2lkIHsgfSxcblx0XHRvbkRyYWdPdmVyKCkgeyByZXR1cm4gZmFsc2U7IH0sXG5cdFx0ZHJvcCgpIHsgfSxcblx0XHRkaXNwb3NlKCkgeyB9XG5cdH0sXG5cdGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlLFxuXHR0cmFuc2Zvcm1PcHRpbWl6YXRpb246IHRydWUsXG5cdGFsd2F5c0NvbnN1bWVNb3VzZVdoZWVsOiB0cnVlLFxufSBzYXRpc2ZpZXMgSUxpc3RWaWV3T3B0aW9uczxhbnk+O1xuXG5leHBvcnQgY2xhc3MgRWxlbWVudHNEcmFnQW5kRHJvcERhdGE8VCwgVENvbnRleHQgPSB2b2lkPiBpbXBsZW1lbnRzIElEcmFnQW5kRHJvcERhdGEge1xuXG5cdHJlYWRvbmx5IGVsZW1lbnRzOiBUW107XG5cblx0cHJpdmF0ZSBfY29udGV4dDogVENvbnRleHQgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBnZXQgY29udGV4dCgpOiBUQ29udGV4dCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHQ7XG5cdH1cblx0cHVibGljIHNldCBjb250ZXh0KHZhbHVlOiBUQ29udGV4dCB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2NvbnRleHQgPSB2YWx1ZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKGVsZW1lbnRzOiBUW10pIHtcblx0XHR0aGlzLmVsZW1lbnRzID0gZWxlbWVudHM7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7IH1cblxuXHRnZXREYXRhKCk6IFRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZWxlbWVudHM7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVybmFsRWxlbWVudHNEcmFnQW5kRHJvcERhdGE8VD4gaW1wbGVtZW50cyBJRHJhZ0FuZERyb3BEYXRhIHtcblxuXHRyZWFkb25seSBlbGVtZW50czogVFtdO1xuXG5cdGNvbnN0cnVjdG9yKGVsZW1lbnRzOiBUW10pIHtcblx0XHR0aGlzLmVsZW1lbnRzID0gZWxlbWVudHM7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7IH1cblxuXHRnZXREYXRhKCk6IFRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZWxlbWVudHM7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5hdGl2ZURyYWdBbmREcm9wRGF0YSBpbXBsZW1lbnRzIElEcmFnQW5kRHJvcERhdGEge1xuXG5cdHJlYWRvbmx5IHR5cGVzOiBhbnlbXTtcblx0cmVhZG9ubHkgZmlsZXM6IGFueVtdO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMudHlwZXMgPSBbXTtcblx0XHR0aGlzLmZpbGVzID0gW107XG5cdH1cblxuXHR1cGRhdGUoZGF0YVRyYW5zZmVyOiBEYXRhVHJhbnNmZXIpOiB2b2lkIHtcblx0XHRpZiAoZGF0YVRyYW5zZmVyLnR5cGVzKSB7XG5cdFx0XHR0aGlzLnR5cGVzLnNwbGljZSgwLCB0aGlzLnR5cGVzLmxlbmd0aCwgLi4uZGF0YVRyYW5zZmVyLnR5cGVzKTtcblx0XHR9XG5cblx0XHRpZiAoZGF0YVRyYW5zZmVyLmZpbGVzKSB7XG5cdFx0XHR0aGlzLmZpbGVzLnNwbGljZSgwLCB0aGlzLmZpbGVzLmxlbmd0aCk7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YVRyYW5zZmVyLmZpbGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGZpbGUgPSBkYXRhVHJhbnNmZXIuZmlsZXMuaXRlbShpKTtcblxuXHRcdFx0XHRpZiAoZmlsZSAmJiAoZmlsZS5zaXplIHx8IGZpbGUudHlwZSkpIHtcblx0XHRcdFx0XHR0aGlzLmZpbGVzLnB1c2goZmlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXREYXRhKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHR0eXBlczogdGhpcy50eXBlcyxcblx0XHRcdGZpbGVzOiB0aGlzLmZpbGVzXG5cdFx0fTtcblx0fVxufVxuXG5mdW5jdGlvbiBlcXVhbHNEcmFnRmVlZGJhY2soZjE6IG51bWJlcltdIHwgdW5kZWZpbmVkLCBmMjogbnVtYmVyW10gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0aWYgKEFycmF5LmlzQXJyYXkoZjEpICYmIEFycmF5LmlzQXJyYXkoZjIpKSB7XG5cdFx0cmV0dXJuIGVxdWFscyhmMSwgZjIpO1xuXHR9XG5cblx0cmV0dXJuIGYxID09PSBmMjtcbn1cblxuY2xhc3MgTGlzdFZpZXdBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8VD4gaW1wbGVtZW50cyBSZXF1aXJlZDxJTGlzdFZpZXdBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8VD4+IHtcblxuXHRyZWFkb25seSBnZXRTZXRTaXplOiAoZWxlbWVudDogYW55LCBpbmRleDogbnVtYmVyLCBsaXN0TGVuZ3RoOiBudW1iZXIpID0+IG51bWJlcjtcblx0cmVhZG9ubHkgZ2V0UG9zSW5TZXQ6IChlbGVtZW50OiBhbnksIGluZGV4OiBudW1iZXIpID0+IG51bWJlcjtcblx0cmVhZG9ubHkgZ2V0Um9sZTogKGVsZW1lbnQ6IFQpID0+IEFyaWFSb2xlIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBpc0NoZWNrZWQ6IChlbGVtZW50OiBUKSA9PiBib29sZWFuIHwgSVZhbHVlV2l0aENoYW5nZUV2ZW50PGJvb2xlYW4+IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKGFjY2Vzc2liaWxpdHlQcm92aWRlcj86IElMaXN0Vmlld0FjY2Vzc2liaWxpdHlQcm92aWRlcjxUPikge1xuXHRcdGlmIChhY2Nlc3NpYmlsaXR5UHJvdmlkZXI/LmdldFNldFNpemUpIHtcblx0XHRcdHRoaXMuZ2V0U2V0U2l6ZSA9IGFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRTZXRTaXplLmJpbmQoYWNjZXNzaWJpbGl0eVByb3ZpZGVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5nZXRTZXRTaXplID0gKGUsIGksIGwpID0+IGw7XG5cdFx0fVxuXG5cdFx0aWYgKGFjY2Vzc2liaWxpdHlQcm92aWRlcj8uZ2V0UG9zSW5TZXQpIHtcblx0XHRcdHRoaXMuZ2V0UG9zSW5TZXQgPSBhY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0UG9zSW5TZXQuYmluZChhY2Nlc3NpYmlsaXR5UHJvdmlkZXIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmdldFBvc0luU2V0ID0gKGUsIGkpID0+IGkgKyAxO1xuXHRcdH1cblxuXHRcdGlmIChhY2Nlc3NpYmlsaXR5UHJvdmlkZXI/LmdldFJvbGUpIHtcblx0XHRcdHRoaXMuZ2V0Um9sZSA9IGFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRSb2xlLmJpbmQoYWNjZXNzaWJpbGl0eVByb3ZpZGVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5nZXRSb2xlID0gXyA9PiAnbGlzdGl0ZW0nO1xuXHRcdH1cblxuXHRcdGlmIChhY2Nlc3NpYmlsaXR5UHJvdmlkZXI/LmlzQ2hlY2tlZCkge1xuXHRcdFx0dGhpcy5pc0NoZWNrZWQgPSBhY2Nlc3NpYmlsaXR5UHJvdmlkZXIuaXNDaGVja2VkLmJpbmQoYWNjZXNzaWJpbGl0eVByb3ZpZGVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5pc0NoZWNrZWQgPSBfID0+IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTGlzdFZpZXc8VD4gZXh0ZW5kcyBJU3BsaWNlYWJsZTxUPiwgSURpc3Bvc2FibGUge1xuXHRyZWFkb25seSBkb21JZDogc3RyaW5nO1xuXHRyZWFkb25seSBkb21Ob2RlOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgY29udGFpbmVyRG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHNjcm9sbGFibGVFbGVtZW50RG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGxlbmd0aDogbnVtYmVyO1xuXHRyZWFkb25seSBjb250ZW50SGVpZ2h0OiBudW1iZXI7XG5cdHJlYWRvbmx5IGNvbnRlbnRXaWR0aDogbnVtYmVyO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQ6IEV2ZW50PG51bWJlcj47XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29udGVudFdpZHRoOiBFdmVudDxudW1iZXI+O1xuXHRyZWFkb25seSByZW5kZXJIZWlnaHQ6IG51bWJlcjtcblx0cmVhZG9ubHkgc2Nyb2xsSGVpZ2h0OiBudW1iZXI7XG5cdHJlYWRvbmx5IGZpcnN0VmlzaWJsZUluZGV4OiBudW1iZXI7XG5cdHJlYWRvbmx5IGZpcnN0TW9zdGx5VmlzaWJsZUluZGV4OiBudW1iZXI7XG5cdHJlYWRvbmx5IGxhc3RWaXNpYmxlSW5kZXg6IG51bWJlcjtcblx0b25EaWRTY3JvbGw6IEV2ZW50PFNjcm9sbEV2ZW50Pjtcblx0b25XaWxsU2Nyb2xsOiBFdmVudDxTY3JvbGxFdmVudD47XG5cdG9uTW91c2VDbGljazogRXZlbnQ8SUxpc3RNb3VzZUV2ZW50PFQ+Pjtcblx0b25Nb3VzZURibENsaWNrOiBFdmVudDxJTGlzdE1vdXNlRXZlbnQ8VD4+O1xuXHRvbk1vdXNlTWlkZGxlQ2xpY2s6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj47XG5cdG9uTW91c2VVcDogRXZlbnQ8SUxpc3RNb3VzZUV2ZW50PFQ+Pjtcblx0b25Nb3VzZURvd246IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj47XG5cdG9uTW91c2VPdmVyOiBFdmVudDxJTGlzdE1vdXNlRXZlbnQ8VD4+O1xuXHRvbk1vdXNlTW92ZTogRXZlbnQ8SUxpc3RNb3VzZUV2ZW50PFQ+Pjtcblx0b25Nb3VzZU91dDogRXZlbnQ8SUxpc3RNb3VzZUV2ZW50PFQ+Pjtcblx0b25Db250ZXh0TWVudTogRXZlbnQ8SUxpc3RNb3VzZUV2ZW50PFQ+Pjtcblx0b25Ub3VjaFN0YXJ0OiBFdmVudDxJTGlzdFRvdWNoRXZlbnQ8VD4+O1xuXHRvblRhcDogRXZlbnQ8SUxpc3RHZXN0dXJlRXZlbnQ8VD4+O1xuXHRlbGVtZW50KGluZGV4OiBudW1iZXIpOiBUO1xuXHRkb21FbGVtZW50KGluZGV4OiBudW1iZXIpOiBIVE1MRWxlbWVudCB8IG51bGw7XG5cdGdldEVsZW1lbnREb21JZChpbmRleDogbnVtYmVyKTogc3RyaW5nO1xuXHRlbGVtZW50SGVpZ2h0KGluZGV4OiBudW1iZXIpOiBudW1iZXI7XG5cdGVsZW1lbnRUb3AoaW5kZXg6IG51bWJlcik6IG51bWJlcjtcblx0aW5kZXhPZihlbGVtZW50OiBUKTogbnVtYmVyO1xuXHRpbmRleEF0KHBvc2l0aW9uOiBudW1iZXIpOiBudW1iZXI7XG5cdGluZGV4QWZ0ZXIocG9zaXRpb246IG51bWJlcik6IG51bWJlcjtcblx0dXBkYXRlT3B0aW9ucyhvcHRpb25zOiBJTGlzdFZpZXdPcHRpb25zVXBkYXRlKTogdm9pZDtcblx0Z2V0U2Nyb2xsVG9wKCk6IG51bWJlcjtcblx0c2V0U2Nyb2xsVG9wKHNjcm9sbFRvcDogbnVtYmVyLCByZXVzZUFuaW1hdGlvbj86IGJvb2xlYW4pOiB2b2lkO1xuXHRnZXRTY3JvbGxMZWZ0KCk6IG51bWJlcjtcblx0c2V0U2Nyb2xsTGVmdChzY3JvbGxMZWZ0OiBudW1iZXIpOiB2b2lkO1xuXHRkZWxlZ2F0ZVNjcm9sbEZyb21Nb3VzZVdoZWVsRXZlbnQoYnJvd3NlckV2ZW50OiBJTW91c2VXaGVlbEV2ZW50KTogdm9pZDtcblx0ZGVsZWdhdGVWZXJ0aWNhbFNjcm9sbGJhclBvaW50ZXJEb3duKGJyb3dzZXJFdmVudDogUG9pbnRlckV2ZW50KTogdm9pZDtcblx0dXBkYXRlV2lkdGgoaW5kZXg6IG51bWJlcik6IHZvaWQ7XG5cdHVwZGF0ZUVsZW1lbnRIZWlnaHQoaW5kZXg6IG51bWJlciwgc2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkLCBhbmNob3JJbmRleDogbnVtYmVyIHwgbnVsbCk6IHZvaWQ7XG5cdHJlcmVuZGVyKCk6IHZvaWQ7XG5cdGxheW91dChoZWlnaHQ/OiBudW1iZXIsIHdpZHRoPzogbnVtYmVyKTogdm9pZDtcbn1cblxuLyoqXG4gKiBUaGUge0BsaW5rIExpc3RWaWV3fSBpcyBhIHZpcnR1YWwgc2Nyb2xsaW5nIGVuZ2luZS5cbiAqXG4gKiBHaXZlbiB0aGF0IGl0IG9ubHkgcmVuZGVycyBlbGVtZW50cyB3aXRoaW4gaXRzIHZpZXdwb3J0LCBpdCBjYW4gaG9sZCBsYXJnZVxuICogY29sbGVjdGlvbnMgb2YgZWxlbWVudHMgYW5kIHN0YXkgdmVyeSBwZXJmb3JtYW50LiBUaGUgcGVyZm9ybWFuY2UgYm90dGxlbmVja1xuICogdXN1YWxseSBsaWVzIHdpdGhpbiB0aGUgdXNlcidzIHJlbmRlcmluZyBjb2RlIGZvciBlYWNoIGVsZW1lbnQuXG4gKlxuICogQHJlbWFya3MgSXQgaXMgYSBsb3ctbGV2ZWwgd2lkZ2V0LCBub3QgbWVhbnQgdG8gYmUgdXNlZCBkaXJlY3RseS4gUmVmZXIgdG8gdGhlXG4gKiBMaXN0IHdpZGdldCBpbnN0ZWFkLlxuICovXG5leHBvcnQgY2xhc3MgTGlzdFZpZXc8VD4gaW1wbGVtZW50cyBJTGlzdFZpZXc8VD4ge1xuXG5cdHByaXZhdGUgc3RhdGljIEluc3RhbmNlQ291bnQgPSAwO1xuXHRyZWFkb25seSBkb21JZCA9IGBsaXN0X2lkXyR7KytMaXN0Vmlldy5JbnN0YW5jZUNvdW50fWA7XG5cblx0cmVhZG9ubHkgZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBpdGVtczogSUl0ZW08VD5bXTtcblx0cHJpdmF0ZSBpdGVtSWQ6IG51bWJlcjtcblx0cHJvdGVjdGVkIHJhbmdlTWFwOiBJUmFuZ2VNYXA7XG5cdHByaXZhdGUgY2FjaGU6IFJvd0NhY2hlPFQ+O1xuXHRwcml2YXRlIHJlbmRlcmVycyA9IG5ldyBNYXA8c3RyaW5nLCBJTGlzdFJlbmRlcmVyPGFueSAvKiBUT0RPQGpvYW8gKi8sIGFueT4+KCk7XG5cdHByb3RlY3RlZCBsYXN0UmVuZGVyVG9wOiBudW1iZXI7XG5cdHByb3RlY3RlZCBsYXN0UmVuZGVySGVpZ2h0OiBudW1iZXI7XG5cdHByaXZhdGUgcmVuZGVyV2lkdGggPSAwO1xuXHRwcml2YXRlIHJvd3NDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHNjcm9sbGFibGU6IFNjcm9sbGFibGU7XG5cdHByaXZhdGUgc2Nyb2xsYWJsZUVsZW1lbnQ6IFNtb290aFNjcm9sbGFibGVFbGVtZW50O1xuXHRwcml2YXRlIF9zY3JvbGxIZWlnaHQ6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgc2Nyb2xsYWJsZUVsZW1lbnRVcGRhdGVEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHNjcm9sbGFibGVFbGVtZW50V2lkdGhEZWxheWVyID0gbmV3IERlbGF5ZXI8dm9pZD4oNTApO1xuXHRwcml2YXRlIHNwbGljaW5nID0gZmFsc2U7XG5cdHByaXZhdGUgZHJhZ092ZXJBbmltYXRpb25EaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBkcmFnT3ZlckFuaW1hdGlvblN0b3BEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSA9IERpc3Bvc2FibGUuTm9uZTtcblx0cHJpdmF0ZSBkcmFnT3Zlck1vdXNlWTogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBzZXRSb3dMaW5lSGVpZ2h0OiBib29sZWFuO1xuXHRwcml2YXRlIHNldFJvd0hlaWdodDogYm9vbGVhbjtcblx0cHJpdmF0ZSBzdXBwb3J0RHluYW1pY0hlaWdodHM6IGJvb2xlYW47XG5cdHByaXZhdGUgcGFkZGluZ0JvdHRvbTogbnVtYmVyO1xuXHRwcml2YXRlIGFjY2Vzc2liaWxpdHlQcm92aWRlcjogTGlzdFZpZXdBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8VD47XG5cdHByaXZhdGUgc2Nyb2xsV2lkdGg6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGRuZDogSUxpc3RWaWV3RHJhZ0FuZERyb3A8VD47XG5cdHByaXZhdGUgY2FuRHJvcDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIGN1cnJlbnREcmFnRGF0YTogSURyYWdBbmREcm9wRGF0YSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjdXJyZW50RHJhZ0ZlZWRiYWNrOiBudW1iZXJbXSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjdXJyZW50RHJhZ0ZlZWRiYWNrUG9zaXRpb246IExpc3REcmFnT3ZlckVmZmVjdFBvc2l0aW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGN1cnJlbnREcmFnRmVlZGJhY2tEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSA9IERpc3Bvc2FibGUuTm9uZTtcblx0cHJpdmF0ZSBvbkRyYWdMZWF2ZVRpbWVvdXQ6IElEaXNwb3NhYmxlID0gRGlzcG9zYWJsZS5Ob25lO1xuXHRwcml2YXRlIGN1cnJlbnRTZWxlY3Rpb25EaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSA9IERpc3Bvc2FibGUuTm9uZTtcblx0cHJpdmF0ZSBjdXJyZW50U2VsZWN0aW9uQm91bmRzOiBJUmFuZ2UgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYWN0aXZlRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29udGVudEhlaWdodCA9IG5ldyBFbWl0dGVyPG51bWJlcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb250ZW50V2lkdGggPSBuZXcgRW1pdHRlcjxudW1iZXI+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29udGVudEhlaWdodDogRXZlbnQ8bnVtYmVyPiA9IEV2ZW50LmxhdGNoKHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudEhlaWdodC5ldmVudCwgdW5kZWZpbmVkLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZW50V2lkdGg6IEV2ZW50PG51bWJlcj4gPSBFdmVudC5sYXRjaCh0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnRXaWR0aC5ldmVudCwgdW5kZWZpbmVkLCB0aGlzLmRpc3Bvc2FibGVzKTtcblx0Z2V0IGNvbnRlbnRIZWlnaHQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMucmFuZ2VNYXAuc2l6ZTsgfVxuXHRnZXQgY29udGVudFdpZHRoKCk6IG51bWJlciB7IHJldHVybiB0aGlzLnNjcm9sbFdpZHRoID8/IDA7IH1cblxuXHRnZXQgb25EaWRTY3JvbGwoKTogRXZlbnQ8U2Nyb2xsRXZlbnQ+IHsgcmV0dXJuIHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQub25TY3JvbGw7IH1cblx0Z2V0IG9uV2lsbFNjcm9sbCgpOiBFdmVudDxTY3JvbGxFdmVudD4geyByZXR1cm4gdGhpcy5zY3JvbGxhYmxlRWxlbWVudC5vbldpbGxTY3JvbGw7IH1cblx0Z2V0IGNvbnRhaW5lckRvbU5vZGUoKTogSFRNTEVsZW1lbnQgeyByZXR1cm4gdGhpcy5yb3dzQ29udGFpbmVyOyB9XG5cdGdldCBzY3JvbGxhYmxlRWxlbWVudERvbU5vZGUoKTogSFRNTEVsZW1lbnQgeyByZXR1cm4gdGhpcy5zY3JvbGxhYmxlRWxlbWVudC5nZXREb21Ob2RlKCk7IH1cblxuXHRwcml2YXRlIF9ob3Jpem9udGFsU2Nyb2xsaW5nOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgZ2V0IGhvcml6b250YWxTY3JvbGxpbmcoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9ob3Jpem9udGFsU2Nyb2xsaW5nOyB9XG5cdHByaXZhdGUgc2V0IGhvcml6b250YWxTY3JvbGxpbmcodmFsdWU6IGJvb2xlYW4pIHtcblx0XHRpZiAodmFsdWUgPT09IHRoaXMuX2hvcml6b250YWxTY3JvbGxpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodmFsdWUgJiYgdGhpcy5zdXBwb3J0RHluYW1pY0hlaWdodHMpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSG9yaXpvbnRhbCBzY3JvbGxpbmcgYW5kIGR5bmFtaWMgaGVpZ2h0cyBub3Qgc3VwcG9ydGVkIHNpbXVsdGFuZW91c2x5Jyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5faG9yaXpvbnRhbFNjcm9sbGluZyA9IHZhbHVlO1xuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdob3Jpem9udGFsLXNjcm9sbGluZycsIHRoaXMuX2hvcml6b250YWxTY3JvbGxpbmcpO1xuXG5cdFx0aWYgKHRoaXMuX2hvcml6b250YWxTY3JvbGxpbmcpIHtcblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZW1zKSB7XG5cdFx0XHRcdHRoaXMubWVhc3VyZUl0ZW1XaWR0aChpdGVtKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy51cGRhdGVTY3JvbGxXaWR0aCgpO1xuXHRcdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxEaW1lbnNpb25zKHsgd2lkdGg6IGdldENvbnRlbnRXaWR0aCh0aGlzLmRvbU5vZGUpIH0pO1xuXHRcdFx0dGhpcy5yb3dzQ29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7TWF0aC5tYXgodGhpcy5zY3JvbGxXaWR0aCB8fCAwLCB0aGlzLnJlbmRlcldpZHRoKX1weGA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnRXaWR0aERlbGF5ZXIuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbERpbWVuc2lvbnMoeyB3aWR0aDogdGhpcy5yZW5kZXJXaWR0aCwgc2Nyb2xsV2lkdGg6IHRoaXMucmVuZGVyV2lkdGggfSk7XG5cdFx0XHR0aGlzLnJvd3NDb250YWluZXIuc3R5bGUud2lkdGggPSAnJztcblx0XHR9XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgdmlydHVhbERlbGVnYXRlOiBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxUPixcblx0XHRyZW5kZXJlcnM6IElMaXN0UmVuZGVyZXI8YW55IC8qIFRPRE9Aam9hbyAqLywgYW55PltdLFxuXHRcdG9wdGlvbnM6IElMaXN0Vmlld09wdGlvbnM8VD4gPSBEZWZhdWx0T3B0aW9uc1xuXHQpIHtcblx0XHRpZiAob3B0aW9ucy5ob3Jpem9udGFsU2Nyb2xsaW5nICYmIG9wdGlvbnMuc3VwcG9ydER5bmFtaWNIZWlnaHRzKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0hvcml6b250YWwgc2Nyb2xsaW5nIGFuZCBkeW5hbWljIGhlaWdodHMgbm90IHN1cHBvcnRlZCBzaW11bHRhbmVvdXNseScpO1xuXHRcdH1cblxuXHRcdHRoaXMuaXRlbXMgPSBbXTtcblx0XHR0aGlzLml0ZW1JZCA9IDA7XG5cdFx0dGhpcy5yYW5nZU1hcCA9IHRoaXMuY3JlYXRlUmFuZ2VNYXAob3B0aW9ucy5wYWRkaW5nVG9wID8/IDApO1xuXG5cdFx0Zm9yIChjb25zdCByZW5kZXJlciBvZiByZW5kZXJlcnMpIHtcblx0XHRcdHRoaXMucmVuZGVyZXJzLnNldChyZW5kZXJlci50ZW1wbGF0ZUlkLCByZW5kZXJlcik7XG5cdFx0fVxuXG5cdFx0dGhpcy5jYWNoZSA9IHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBSb3dDYWNoZSh0aGlzLnJlbmRlcmVycykpO1xuXG5cdFx0dGhpcy5sYXN0UmVuZGVyVG9wID0gMDtcblx0XHR0aGlzLmxhc3RSZW5kZXJIZWlnaHQgPSAwO1xuXG5cdFx0dGhpcy5kb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTmFtZSA9ICdtb25hY28tbGlzdCc7XG5cblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCh0aGlzLmRvbUlkKTtcblx0XHR0aGlzLmRvbU5vZGUudGFiSW5kZXggPSAwO1xuXG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ21vdXNlLXN1cHBvcnQnLCB0eXBlb2Ygb3B0aW9ucy5tb3VzZVN1cHBvcnQgPT09ICdib29sZWFuJyA/IG9wdGlvbnMubW91c2VTdXBwb3J0IDogdHJ1ZSk7XG5cblx0XHR0aGlzLl9ob3Jpem9udGFsU2Nyb2xsaW5nID0gb3B0aW9ucy5ob3Jpem9udGFsU2Nyb2xsaW5nID8/IERlZmF1bHRPcHRpb25zLmhvcml6b250YWxTY3JvbGxpbmc7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2hvcml6b250YWwtc2Nyb2xsaW5nJywgdGhpcy5faG9yaXpvbnRhbFNjcm9sbGluZyk7XG5cblx0XHR0aGlzLnBhZGRpbmdCb3R0b20gPSB0eXBlb2Ygb3B0aW9ucy5wYWRkaW5nQm90dG9tID09PSAndW5kZWZpbmVkJyA/IDAgOiBvcHRpb25zLnBhZGRpbmdCb3R0b207XG5cblx0XHR0aGlzLmFjY2Vzc2liaWxpdHlQcm92aWRlciA9IG5ldyBMaXN0Vmlld0FjY2Vzc2liaWxpdHlQcm92aWRlcihvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlcik7XG5cblx0XHR0aGlzLnJvd3NDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLnJvd3NDb250YWluZXIuY2xhc3NOYW1lID0gJ21vbmFjby1saXN0LXJvd3MnO1xuXG5cdFx0Y29uc3QgdHJhbnNmb3JtT3B0aW1pemF0aW9uID0gb3B0aW9ucy50cmFuc2Zvcm1PcHRpbWl6YXRpb24gPz8gRGVmYXVsdE9wdGlvbnMudHJhbnNmb3JtT3B0aW1pemF0aW9uO1xuXHRcdGlmICh0cmFuc2Zvcm1PcHRpbWl6YXRpb24pIHtcblx0XHRcdHRoaXMucm93c0NvbnRhaW5lci5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlM2QoMHB4LCAwcHgsIDBweCknO1xuXHRcdFx0dGhpcy5yb3dzQ29udGFpbmVyLnN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7XG5cdFx0XHR0aGlzLnJvd3NDb250YWluZXIuc3R5bGUuY29udGFpbiA9ICdzdHJpY3QnO1xuXHRcdH1cblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKEdlc3R1cmUuYWRkVGFyZ2V0KHRoaXMucm93c0NvbnRhaW5lcikpO1xuXG5cdFx0dGhpcy5zY3JvbGxhYmxlID0gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IFNjcm9sbGFibGUoe1xuXHRcdFx0Zm9yY2VJbnRlZ2VyVmFsdWVzOiB0cnVlLFxuXHRcdFx0c21vb3RoU2Nyb2xsRHVyYXRpb246IChvcHRpb25zLnNtb290aFNjcm9sbGluZyA/PyBmYWxzZSkgPyAxMjUgOiAwLFxuXHRcdFx0c2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZTogY2IgPT4gc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShnZXRXaW5kb3codGhpcy5kb21Ob2RlKSwgY2IpXG5cdFx0fSkpO1xuXHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQgPSB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgU21vb3RoU2Nyb2xsYWJsZUVsZW1lbnQodGhpcy5yb3dzQ29udGFpbmVyLCB7XG5cdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogb3B0aW9ucy5hbHdheXNDb25zdW1lTW91c2VXaGVlbCA/PyBEZWZhdWx0T3B0aW9ucy5hbHdheXNDb25zdW1lTW91c2VXaGVlbCxcblx0XHRcdGhvcml6b250YWw6IFNjcm9sbGJhclZpc2liaWxpdHkuQXV0byxcblx0XHRcdHZlcnRpY2FsOiBvcHRpb25zLnZlcnRpY2FsU2Nyb2xsTW9kZSA/PyBEZWZhdWx0T3B0aW9ucy52ZXJ0aWNhbFNjcm9sbE1vZGUsXG5cdFx0XHR1c2VTaGFkb3dzOiBvcHRpb25zLnVzZVNoYWRvd3MgPz8gRGVmYXVsdE9wdGlvbnMudXNlU2hhZG93cyxcblx0XHRcdG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eTogb3B0aW9ucy5tb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHksXG5cdFx0XHRmYXN0U2Nyb2xsU2Vuc2l0aXZpdHk6IG9wdGlvbnMuZmFzdFNjcm9sbFNlbnNpdGl2aXR5LFxuXHRcdFx0c2Nyb2xsQnlQYWdlOiBvcHRpb25zLnNjcm9sbEJ5UGFnZVxuXHRcdH0sIHRoaXMuc2Nyb2xsYWJsZSkpO1xuXG5cdFx0dGhpcy5kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0RG9tTm9kZSgpKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5kb21Ob2RlKTtcblxuXHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQub25TY3JvbGwodGhpcy5vblNjcm9sbCwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMucm93c0NvbnRhaW5lciwgVG91Y2hFdmVudFR5cGUuQ2hhbmdlLCBlID0+IHRoaXMub25Ub3VjaENoYW5nZShlIGFzIEdlc3R1cmVFdmVudCkpKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnNjcm9sbGFibGVFbGVtZW50LmdldERvbU5vZGUoKSwgJ3Njcm9sbCcsIGUgPT4ge1xuXHRcdFx0Ly8gTWFrZSBzdXJlIHRoZSBhY3RpdmUgZWxlbWVudCBpcyBzY3JvbGxlZCBpbnRvIHZpZXdcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSAoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpO1xuXHRcdFx0Y29uc3Qgc2Nyb2xsVmFsdWUgPSBlbGVtZW50LnNjcm9sbFRvcDtcblx0XHRcdGVsZW1lbnQuc2Nyb2xsVG9wID0gMDtcblx0XHRcdGlmIChvcHRpb25zLnNjcm9sbFRvQWN0aXZlRWxlbWVudCkge1xuXHRcdFx0XHR0aGlzLnNldFNjcm9sbFRvcCh0aGlzLnNjcm9sbFRvcCArIHNjcm9sbFZhbHVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLCAnZHJhZ292ZXInLCBlID0+IHRoaXMub25EcmFnT3Zlcih0aGlzLnRvRHJhZ0V2ZW50KGUpKSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmRvbU5vZGUsICdkcm9wJywgZSA9PiB0aGlzLm9uRHJvcCh0aGlzLnRvRHJhZ0V2ZW50KGUpKSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmRvbU5vZGUsICdkcmFnbGVhdmUnLCBlID0+IHRoaXMub25EcmFnTGVhdmUodGhpcy50b0RyYWdFdmVudChlKSkpKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLCAnZHJhZ2VuZCcsIGUgPT4gdGhpcy5vbkRyYWdFbmQoZSkpKTtcblx0XHRpZiAob3B0aW9ucy51c2VyU2VsZWN0aW9uKSB7XG5cdFx0XHRpZiAob3B0aW9ucy5kbmQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdETkQgYW5kIHVzZXIgc2VsZWN0aW9uIGNhbm5vdCBiZSB1c2VkIHNpbXVsdGFuZW91c2x5Jyk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5kb21Ob2RlLCAnbW91c2Vkb3duJywgZSA9PiB0aGlzLm9uUG90ZW50aWFsU2VsZWN0aW9uU3RhcnQoZSkpKTtcblx0XHR9XG5cblx0XHR0aGlzLnNldFJvd0xpbmVIZWlnaHQgPSBvcHRpb25zLnNldFJvd0xpbmVIZWlnaHQgPz8gRGVmYXVsdE9wdGlvbnMuc2V0Um93TGluZUhlaWdodDtcblx0XHR0aGlzLnNldFJvd0hlaWdodCA9IG9wdGlvbnMuc2V0Um93SGVpZ2h0ID8/IERlZmF1bHRPcHRpb25zLnNldFJvd0hlaWdodDtcblx0XHR0aGlzLnN1cHBvcnREeW5hbWljSGVpZ2h0cyA9IG9wdGlvbnMuc3VwcG9ydER5bmFtaWNIZWlnaHRzID8/IERlZmF1bHRPcHRpb25zLnN1cHBvcnREeW5hbWljSGVpZ2h0cztcblx0XHR0aGlzLmRuZCA9IG9wdGlvbnMuZG5kID8/IHRoaXMuZGlzcG9zYWJsZXMuYWRkKERlZmF1bHRPcHRpb25zLmRuZCk7XG5cblx0XHR0aGlzLmxheW91dChvcHRpb25zLmluaXRpYWxTaXplPy5oZWlnaHQsIG9wdGlvbnMuaW5pdGlhbFNpemU/LndpZHRoKTtcblx0XHRpZiAob3B0aW9ucy5zY3JvbGxUb0FjdGl2ZUVsZW1lbnQpIHtcblx0XHRcdHRoaXMuX3NldHVwRm9jdXNPYnNlcnZlcihjb250YWluZXIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NldHVwRm9jdXNPYnNlcnZlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNvbnRhaW5lciwgJ2ZvY3VzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IGdldEFjdGl2ZUVsZW1lbnQoKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0XHRpZiAodGhpcy5hY3RpdmVFbGVtZW50ICE9PSBlbGVtZW50ICYmIGVsZW1lbnQgIT09IG51bGwpIHtcblx0XHRcdFx0dGhpcy5hY3RpdmVFbGVtZW50ID0gZWxlbWVudDtcblx0XHRcdFx0dGhpcy5fc2Nyb2xsVG9BY3RpdmVFbGVtZW50KHRoaXMuYWN0aXZlRWxlbWVudCwgY29udGFpbmVyKTtcblx0XHRcdH1cblx0XHR9LCB0cnVlKSk7XG5cdH1cblxuXHRwcml2YXRlIF9zY3JvbGxUb0FjdGl2ZUVsZW1lbnQoZWxlbWVudDogSFRNTEVsZW1lbnQsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHQvLyBUaGUgc2Nyb2xsIGV2ZW50IG9uIHRoZSBsaXN0IG9ubHkgZmlyZXMgd2hlbiBzY3JvbGxpbmcgZG93bi5cblx0XHQvLyBJZiB0aGUgYWN0aXZlIGVsZW1lbnQgaXMgYWJvdmUgdGhlIHZpZXdwb3J0LCB3ZSBuZWVkIHRvIHNjcm9sbCB1cC5cblx0XHRjb25zdCBjb250YWluZXJSZWN0ID0gY29udGFpbmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGNvbnN0IGVsZW1lbnRSZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuXHRcdGNvbnN0IHRvcE9mZnNldCA9IGVsZW1lbnRSZWN0LnRvcCAtIGNvbnRhaW5lclJlY3QudG9wO1xuXG5cdFx0aWYgKHRvcE9mZnNldCA8IDApIHtcblx0XHRcdC8vIFNjcm9sbCB1cFxuXHRcdFx0dGhpcy5zZXRTY3JvbGxUb3AodGhpcy5zY3JvbGxUb3AgKyB0b3BPZmZzZXQpO1xuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZU9wdGlvbnMob3B0aW9uczogSUxpc3RWaWV3T3B0aW9uc1VwZGF0ZSkge1xuXHRcdGlmIChvcHRpb25zLnBhZGRpbmdCb3R0b20gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5wYWRkaW5nQm90dG9tID0gb3B0aW9ucy5wYWRkaW5nQm90dG9tO1xuXHRcdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxEaW1lbnNpb25zKHsgc2Nyb2xsSGVpZ2h0OiB0aGlzLnNjcm9sbEhlaWdodCB9KTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5zbW9vdGhTY3JvbGxpbmcgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5zY3JvbGxhYmxlLnNldFNtb290aFNjcm9sbER1cmF0aW9uKG9wdGlvbnMuc21vb3RoU2Nyb2xsaW5nID8gMTI1IDogMCk7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMuaG9yaXpvbnRhbFNjcm9sbGluZyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmhvcml6b250YWxTY3JvbGxpbmcgPSBvcHRpb25zLmhvcml6b250YWxTY3JvbGxpbmc7XG5cdFx0fVxuXG5cdFx0bGV0IHNjcm9sbGFibGVPcHRpb25zOiBTY3JvbGxhYmxlRWxlbWVudENoYW5nZU9wdGlvbnMgfCB1bmRlZmluZWQ7XG5cblx0XHRpZiAob3B0aW9ucy5zY3JvbGxCeVBhZ2UgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0c2Nyb2xsYWJsZU9wdGlvbnMgPSB7IC4uLihzY3JvbGxhYmxlT3B0aW9ucyA/PyB7fSksIHNjcm9sbEJ5UGFnZTogb3B0aW9ucy5zY3JvbGxCeVBhZ2UgfTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5tb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHkgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0c2Nyb2xsYWJsZU9wdGlvbnMgPSB7IC4uLihzY3JvbGxhYmxlT3B0aW9ucyA/PyB7fSksIG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eTogb3B0aW9ucy5tb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHkgfTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5mYXN0U2Nyb2xsU2Vuc2l0aXZpdHkgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0c2Nyb2xsYWJsZU9wdGlvbnMgPSB7IC4uLihzY3JvbGxhYmxlT3B0aW9ucyA/PyB7fSksIGZhc3RTY3JvbGxTZW5zaXRpdml0eTogb3B0aW9ucy5mYXN0U2Nyb2xsU2Vuc2l0aXZpdHkgfTtcblx0XHR9XG5cblx0XHRpZiAoc2Nyb2xsYWJsZU9wdGlvbnMpIHtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQudXBkYXRlT3B0aW9ucyhzY3JvbGxhYmxlT3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMucGFkZGluZ1RvcCAhPT0gdW5kZWZpbmVkICYmIG9wdGlvbnMucGFkZGluZ1RvcCAhPT0gdGhpcy5yYW5nZU1hcC5wYWRkaW5nVG9wKSB7XG5cdFx0XHQvLyB0cmlnZ2VyIGEgcmVyZW5kZXJcblx0XHRcdGNvbnN0IGxhc3RSZW5kZXJSYW5nZSA9IHRoaXMuZ2V0UmVuZGVyUmFuZ2UodGhpcy5sYXN0UmVuZGVyVG9wLCB0aGlzLmxhc3RSZW5kZXJIZWlnaHQpO1xuXHRcdFx0Y29uc3Qgb2Zmc2V0ID0gb3B0aW9ucy5wYWRkaW5nVG9wIC0gdGhpcy5yYW5nZU1hcC5wYWRkaW5nVG9wO1xuXHRcdFx0dGhpcy5yYW5nZU1hcC5wYWRkaW5nVG9wID0gb3B0aW9ucy5wYWRkaW5nVG9wO1xuXG5cdFx0XHR0aGlzLnJlbmRlcihsYXN0UmVuZGVyUmFuZ2UsIE1hdGgubWF4KDAsIHRoaXMubGFzdFJlbmRlclRvcCArIG9mZnNldCksIHRoaXMubGFzdFJlbmRlckhlaWdodCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0dGhpcy5zZXRTY3JvbGxUb3AodGhpcy5sYXN0UmVuZGVyVG9wKTtcblxuXHRcdFx0dGhpcy5ldmVudHVhbGx5VXBkYXRlU2Nyb2xsRGltZW5zaW9ucygpO1xuXG5cdFx0XHRpZiAodGhpcy5zdXBwb3J0RHluYW1pY0hlaWdodHMpIHtcblx0XHRcdFx0dGhpcy5fcmVyZW5kZXIodGhpcy5sYXN0UmVuZGVyVG9wLCB0aGlzLmxhc3RSZW5kZXJIZWlnaHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGRlbGVnYXRlU2Nyb2xsRnJvbU1vdXNlV2hlZWxFdmVudChicm93c2VyRXZlbnQ6IElNb3VzZVdoZWVsRXZlbnQpIHtcblx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LmRlbGVnYXRlU2Nyb2xsRnJvbU1vdXNlV2hlZWxFdmVudChicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0ZGVsZWdhdGVWZXJ0aWNhbFNjcm9sbGJhclBvaW50ZXJEb3duKGJyb3dzZXJFdmVudDogUG9pbnRlckV2ZW50KSB7XG5cdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudC5kZWxlZ2F0ZVZlcnRpY2FsU2Nyb2xsYmFyUG9pbnRlckRvd24oYnJvd3NlckV2ZW50KTtcblx0fVxuXG5cdHVwZGF0ZUVsZW1lbnRIZWlnaHQoaW5kZXg6IG51bWJlciwgc2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkLCBhbmNob3JJbmRleDogbnVtYmVyIHwgbnVsbCk6IHZvaWQge1xuXHRcdGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5pdGVtcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvcmlnaW5hbFNpemUgPSB0aGlzLml0ZW1zW2luZGV4XS5zaXplO1xuXG5cdFx0aWYgKHR5cGVvZiBzaXplID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0aWYgKCF0aGlzLnN1cHBvcnREeW5hbWljSGVpZ2h0cykge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oJ0R5bmFtaWMgaGVpZ2h0cyBub3Qgc3VwcG9ydGVkJywgbmV3IEVycm9yKCkuc3RhY2spO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuaXRlbXNbaW5kZXhdLmxhc3REeW5hbWljSGVpZ2h0V2lkdGggPSB1bmRlZmluZWQ7XG5cdFx0XHRzaXplID0gb3JpZ2luYWxTaXplICsgdGhpcy5wcm9iZUR5bmFtaWNIZWlnaHQoaW5kZXgpO1xuXHRcdH1cblxuXHRcdGlmIChvcmlnaW5hbFNpemUgPT09IHNpemUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsYXN0UmVuZGVyUmFuZ2UgPSB0aGlzLmdldFJlbmRlclJhbmdlKHRoaXMubGFzdFJlbmRlclRvcCwgdGhpcy5sYXN0UmVuZGVySGVpZ2h0KTtcblxuXHRcdGxldCBoZWlnaHREaWZmID0gMDtcblxuXHRcdGlmIChpbmRleCA8IGxhc3RSZW5kZXJSYW5nZS5zdGFydCkge1xuXHRcdFx0Ly8gZG8gbm90IHNjcm9sbCB0aGUgdmlld3BvcnQgaWYgcmVzaXplZCBlbGVtZW50IGlzIG91dCBvZiB2aWV3cG9ydFxuXHRcdFx0aGVpZ2h0RGlmZiA9IHNpemUgLSBvcmlnaW5hbFNpemU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChhbmNob3JJbmRleCAhPT0gbnVsbCAmJiBhbmNob3JJbmRleCA+IGluZGV4ICYmIGFuY2hvckluZGV4IDwgbGFzdFJlbmRlclJhbmdlLmVuZCkge1xuXHRcdFx0XHQvLyBhbmNob3IgaW4gdmlld3BvcnRcblx0XHRcdFx0Ly8gcmVzaXplZCBlbGVtZW50IGluIHZpZXdwb3J0IGFuZCBhYm92ZSB0aGUgYW5jaG9yXG5cdFx0XHRcdGhlaWdodERpZmYgPSBzaXplIC0gb3JpZ2luYWxTaXplO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aGVpZ2h0RGlmZiA9IDA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5yYW5nZU1hcC5zcGxpY2UoaW5kZXgsIDEsIFt7IHNpemU6IHNpemUgfV0pO1xuXHRcdHRoaXMuaXRlbXNbaW5kZXhdLnNpemUgPSBzaXplO1xuXG5cdFx0dGhpcy5yZW5kZXIobGFzdFJlbmRlclJhbmdlLCBNYXRoLm1heCgwLCB0aGlzLmxhc3RSZW5kZXJUb3AgKyBoZWlnaHREaWZmKSwgdGhpcy5sYXN0UmVuZGVySGVpZ2h0LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0dGhpcy5zZXRTY3JvbGxUb3AodGhpcy5sYXN0UmVuZGVyVG9wKTtcblxuXHRcdHRoaXMuZXZlbnR1YWxseVVwZGF0ZVNjcm9sbERpbWVuc2lvbnMoKTtcblxuXHRcdGlmICh0aGlzLnN1cHBvcnREeW5hbWljSGVpZ2h0cykge1xuXHRcdFx0dGhpcy5fcmVyZW5kZXIodGhpcy5sYXN0UmVuZGVyVG9wLCB0aGlzLmxhc3RSZW5kZXJIZWlnaHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQuZmlyZSh0aGlzLmNvbnRlbnRIZWlnaHQpOyAvLyBvdGhlcndpc2UgZmlyZWQgaW4gX3JlcmVuZGVyKClcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlUmFuZ2VNYXAocGFkZGluZ1RvcDogbnVtYmVyKTogSVJhbmdlTWFwIHtcblx0XHRyZXR1cm4gbmV3IFJhbmdlTWFwKHBhZGRpbmdUb3ApO1xuXHR9XG5cblx0c3BsaWNlKHN0YXJ0OiBudW1iZXIsIGRlbGV0ZUNvdW50OiBudW1iZXIsIGVsZW1lbnRzOiByZWFkb25seSBUW10gPSBbXSk6IFRbXSB7XG5cdFx0aWYgKHRoaXMuc3BsaWNpbmcpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2FuXFwndCBydW4gcmVjdXJzaXZlIHNwbGljZXMuJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zcGxpY2luZyA9IHRydWU7XG5cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3NwbGljZShzdGFydCwgZGVsZXRlQ291bnQsIGVsZW1lbnRzKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5zcGxpY2luZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0LmZpcmUodGhpcy5jb250ZW50SGVpZ2h0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zcGxpY2Uoc3RhcnQ6IG51bWJlciwgZGVsZXRlQ291bnQ6IG51bWJlciwgZWxlbWVudHM6IHJlYWRvbmx5IFRbXSA9IFtdKTogVFtdIHtcblx0XHRjb25zdCBwcmV2aW91c1JlbmRlclJhbmdlID0gdGhpcy5nZXRSZW5kZXJSYW5nZSh0aGlzLmxhc3RSZW5kZXJUb3AsIHRoaXMubGFzdFJlbmRlckhlaWdodCk7XG5cdFx0Y29uc3QgZGVsZXRlUmFuZ2UgPSB7IHN0YXJ0LCBlbmQ6IHN0YXJ0ICsgZGVsZXRlQ291bnQgfTtcblx0XHRjb25zdCByZW1vdmVSYW5nZSA9IFJhbmdlLmludGVyc2VjdChwcmV2aW91c1JlbmRlclJhbmdlLCBkZWxldGVSYW5nZSk7XG5cblx0XHQvLyB0cnkgdG8gcmV1c2Ugcm93cywgYXZvaWQgcmVtb3ZpbmcgdGhlbSBmcm9tIERPTVxuXHRcdGNvbnN0IHJvd3NUb0Rpc3Bvc2UgPSBuZXcgTWFwPHN0cmluZywgSVJvd1tdPigpO1xuXHRcdGZvciAobGV0IGkgPSByZW1vdmVSYW5nZS5lbmQgLSAxOyBpID49IHJlbW92ZVJhbmdlLnN0YXJ0OyBpLS0pIHtcblx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLml0ZW1zW2ldO1xuXHRcdFx0aXRlbS5kcmFnU3RhcnREaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdGl0ZW0uY2hlY2tlZERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXG5cdFx0XHRpZiAoaXRlbS5yb3cpIHtcblx0XHRcdFx0bGV0IHJvd3MgPSByb3dzVG9EaXNwb3NlLmdldChpdGVtLnRlbXBsYXRlSWQpO1xuXG5cdFx0XHRcdGlmICghcm93cykge1xuXHRcdFx0XHRcdHJvd3MgPSBbXTtcblx0XHRcdFx0XHRyb3dzVG9EaXNwb3NlLnNldChpdGVtLnRlbXBsYXRlSWQsIHJvd3MpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLnJlbmRlcmVycy5nZXQoaXRlbS50ZW1wbGF0ZUlkKTtcblxuXHRcdFx0XHRpZiAocmVuZGVyZXIgJiYgcmVuZGVyZXIuZGlzcG9zZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRyZW5kZXJlci5kaXNwb3NlRWxlbWVudChpdGVtLmVsZW1lbnQsIGksIGl0ZW0ucm93LnRlbXBsYXRlRGF0YSwgaXRlbS5zaXplKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJvd3MudW5zaGlmdChpdGVtLnJvdyk7XG5cdFx0XHR9XG5cblx0XHRcdGl0ZW0ucm93ID0gbnVsbDtcblx0XHRcdGl0ZW0uc3RhbGUgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXZpb3VzUmVzdFJhbmdlOiBJUmFuZ2UgPSB7IHN0YXJ0OiBzdGFydCArIGRlbGV0ZUNvdW50LCBlbmQ6IHRoaXMuaXRlbXMubGVuZ3RoIH07XG5cdFx0Y29uc3QgcHJldmlvdXNSZW5kZXJlZFJlc3RSYW5nZSA9IFJhbmdlLmludGVyc2VjdChwcmV2aW91c1Jlc3RSYW5nZSwgcHJldmlvdXNSZW5kZXJSYW5nZSk7XG5cdFx0Y29uc3QgcHJldmlvdXNVbnJlbmRlcmVkUmVzdFJhbmdlcyA9IFJhbmdlLnJlbGF0aXZlQ29tcGxlbWVudChwcmV2aW91c1Jlc3RSYW5nZSwgcHJldmlvdXNSZW5kZXJSYW5nZSk7XG5cblx0XHRjb25zdCBpbnNlcnRlZCA9IGVsZW1lbnRzLm1hcDxJSXRlbTxUPj4oZWxlbWVudCA9PiAoe1xuXHRcdFx0aWQ6IFN0cmluZyh0aGlzLml0ZW1JZCsrKSxcblx0XHRcdGVsZW1lbnQsXG5cdFx0XHR0ZW1wbGF0ZUlkOiB0aGlzLnZpcnR1YWxEZWxlZ2F0ZS5nZXRUZW1wbGF0ZUlkKGVsZW1lbnQpLFxuXHRcdFx0c2l6ZTogdGhpcy52aXJ0dWFsRGVsZWdhdGUuZ2V0SGVpZ2h0KGVsZW1lbnQpLFxuXHRcdFx0d2lkdGg6IHVuZGVmaW5lZCxcblx0XHRcdGhhc0R5bmFtaWNIZWlnaHQ6ICEhdGhpcy52aXJ0dWFsRGVsZWdhdGUuaGFzRHluYW1pY0hlaWdodCAmJiB0aGlzLnZpcnR1YWxEZWxlZ2F0ZS5oYXNEeW5hbWljSGVpZ2h0KGVsZW1lbnQpLFxuXHRcdFx0bGFzdER5bmFtaWNIZWlnaHRXaWR0aDogdW5kZWZpbmVkLFxuXHRcdFx0cm93OiBudWxsLFxuXHRcdFx0dXJpOiB1bmRlZmluZWQsXG5cdFx0XHRkcm9wVGFyZ2V0OiBmYWxzZSxcblx0XHRcdGRyYWdTdGFydERpc3Bvc2FibGU6IERpc3Bvc2FibGUuTm9uZSxcblx0XHRcdGNoZWNrZWREaXNwb3NhYmxlOiBEaXNwb3NhYmxlLk5vbmUsXG5cdFx0XHRzdGFsZTogZmFsc2Vcblx0XHR9KSk7XG5cblx0XHRsZXQgZGVsZXRlZDogSUl0ZW08VD5bXTtcblxuXHRcdC8vIFRPRE9Aam9hbzogaW1wcm92ZSB0aGlzIG9wdGltaXphdGlvbiB0byBjYXRjaCBldmVuIG1vcmUgY2FzZXNcblx0XHRpZiAoc3RhcnQgPT09IDAgJiYgZGVsZXRlQ291bnQgPj0gdGhpcy5pdGVtcy5sZW5ndGgpIHtcblx0XHRcdHRoaXMucmFuZ2VNYXAgPSB0aGlzLmNyZWF0ZVJhbmdlTWFwKHRoaXMucmFuZ2VNYXAucGFkZGluZ1RvcCk7XG5cdFx0XHR0aGlzLnJhbmdlTWFwLnNwbGljZSgwLCAwLCBpbnNlcnRlZCk7XG5cdFx0XHRkZWxldGVkID0gdGhpcy5pdGVtcztcblx0XHRcdHRoaXMuaXRlbXMgPSBpbnNlcnRlZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yYW5nZU1hcC5zcGxpY2Uoc3RhcnQsIGRlbGV0ZUNvdW50LCBpbnNlcnRlZCk7XG5cdFx0XHRkZWxldGVkID0gc3BsaWNlKHRoaXMuaXRlbXMsIHN0YXJ0LCBkZWxldGVDb3VudCwgaW5zZXJ0ZWQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlbHRhID0gZWxlbWVudHMubGVuZ3RoIC0gZGVsZXRlQ291bnQ7XG5cdFx0Y29uc3QgcmVuZGVyUmFuZ2UgPSB0aGlzLmdldFJlbmRlclJhbmdlKHRoaXMubGFzdFJlbmRlclRvcCwgdGhpcy5sYXN0UmVuZGVySGVpZ2h0KTtcblx0XHRjb25zdCByZW5kZXJlZFJlc3RSYW5nZSA9IHNoaWZ0KHByZXZpb3VzUmVuZGVyZWRSZXN0UmFuZ2UsIGRlbHRhKTtcblx0XHRjb25zdCB1cGRhdGVSYW5nZSA9IFJhbmdlLmludGVyc2VjdChyZW5kZXJSYW5nZSwgcmVuZGVyZWRSZXN0UmFuZ2UpO1xuXG5cdFx0Zm9yIChsZXQgaSA9IHVwZGF0ZVJhbmdlLnN0YXJ0OyBpIDwgdXBkYXRlUmFuZ2UuZW5kOyBpKyspIHtcblx0XHRcdHRoaXMudXBkYXRlSXRlbUluRE9NKHRoaXMuaXRlbXNbaV0sIGkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlbW92ZVJhbmdlcyA9IFJhbmdlLnJlbGF0aXZlQ29tcGxlbWVudChyZW5kZXJlZFJlc3RSYW5nZSwgcmVuZGVyUmFuZ2UpO1xuXG5cdFx0Zm9yIChjb25zdCByYW5nZSBvZiByZW1vdmVSYW5nZXMpIHtcblx0XHRcdGZvciAobGV0IGkgPSByYW5nZS5zdGFydDsgaSA8IHJhbmdlLmVuZDsgaSsrKSB7XG5cdFx0XHRcdHRoaXMucmVtb3ZlSXRlbUZyb21ET00oaSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgdW5yZW5kZXJlZFJlc3RSYW5nZXMgPSBwcmV2aW91c1VucmVuZGVyZWRSZXN0UmFuZ2VzLm1hcChyID0+IHNoaWZ0KHIsIGRlbHRhKSk7XG5cdFx0Y29uc3QgZWxlbWVudHNSYW5nZSA9IHsgc3RhcnQsIGVuZDogc3RhcnQgKyBlbGVtZW50cy5sZW5ndGggfTtcblx0XHRjb25zdCBpbnNlcnRSYW5nZXMgPSBbZWxlbWVudHNSYW5nZSwgLi4udW5yZW5kZXJlZFJlc3RSYW5nZXNdLm1hcChyID0+IFJhbmdlLmludGVyc2VjdChyZW5kZXJSYW5nZSwgcikpLnJldmVyc2UoKTtcblxuXHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgaW5zZXJ0UmFuZ2VzKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gcmFuZ2UuZW5kIC0gMTsgaSA+PSByYW5nZS5zdGFydDsgaS0tKSB7XG5cdFx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLml0ZW1zW2ldO1xuXHRcdFx0XHRjb25zdCByb3dzID0gcm93c1RvRGlzcG9zZS5nZXQoaXRlbS50ZW1wbGF0ZUlkKTtcblx0XHRcdFx0Y29uc3Qgcm93ID0gcm93cz8ucG9wKCk7XG5cdFx0XHRcdHRoaXMuaW5zZXJ0SXRlbUluRE9NKGksIHJvdyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCByb3dzIG9mIHJvd3NUb0Rpc3Bvc2UudmFsdWVzKCkpIHtcblx0XHRcdGZvciAoY29uc3Qgcm93IG9mIHJvd3MpIHtcblx0XHRcdFx0dGhpcy5jYWNoZS5yZWxlYXNlKHJvdyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5ldmVudHVhbGx5VXBkYXRlU2Nyb2xsRGltZW5zaW9ucygpO1xuXG5cdFx0aWYgKHRoaXMuc3VwcG9ydER5bmFtaWNIZWlnaHRzKSB7XG5cdFx0XHR0aGlzLl9yZXJlbmRlcih0aGlzLnNjcm9sbFRvcCwgdGhpcy5yZW5kZXJIZWlnaHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBkZWxldGVkLm1hcChpID0+IGkuZWxlbWVudCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZXZlbnR1YWxseVVwZGF0ZVNjcm9sbERpbWVuc2lvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2Nyb2xsSGVpZ2h0ID0gdGhpcy5jb250ZW50SGVpZ2h0O1xuXHRcdHRoaXMucm93c0NvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHt0aGlzLl9zY3JvbGxIZWlnaHR9cHhgO1xuXG5cdFx0aWYgKCF0aGlzLnNjcm9sbGFibGVFbGVtZW50VXBkYXRlRGlzcG9zYWJsZSkge1xuXHRcdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudFVwZGF0ZURpc3Bvc2FibGUgPSBzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKGdldFdpbmRvdyh0aGlzLmRvbU5vZGUpLCAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuc2V0U2Nyb2xsRGltZW5zaW9ucyh7IHNjcm9sbEhlaWdodDogdGhpcy5zY3JvbGxIZWlnaHQgfSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlU2Nyb2xsV2lkdGgoKTtcblx0XHRcdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudFVwZGF0ZURpc3Bvc2FibGUgPSBudWxsO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBldmVudHVhbGx5VXBkYXRlU2Nyb2xsV2lkdGgoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmhvcml6b250YWxTY3JvbGxpbmcpIHtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnRXaWR0aERlbGF5ZXIuY2FuY2VsKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudFdpZHRoRGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMudXBkYXRlU2Nyb2xsV2lkdGgoKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVNjcm9sbFdpZHRoKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5ob3Jpem9udGFsU2Nyb2xsaW5nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHNjcm9sbFdpZHRoID0gMDtcblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZW1zKSB7XG5cdFx0XHRpZiAodHlwZW9mIGl0ZW0ud2lkdGggIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRcdHNjcm9sbFdpZHRoID0gTWF0aC5tYXgoc2Nyb2xsV2lkdGgsIGl0ZW0ud2lkdGgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuc2Nyb2xsV2lkdGggPSBzY3JvbGxXaWR0aDtcblx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbERpbWVuc2lvbnMoeyBzY3JvbGxXaWR0aDogc2Nyb2xsV2lkdGggPT09IDAgPyAwIDogKHNjcm9sbFdpZHRoICsgMTApIH0pO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudFdpZHRoLmZpcmUodGhpcy5zY3JvbGxXaWR0aCk7XG5cdH1cblxuXHR1cGRhdGVXaWR0aChpbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmhvcml6b250YWxTY3JvbGxpbmcgfHwgdHlwZW9mIHRoaXMuc2Nyb2xsV2lkdGggPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuaXRlbXNbaW5kZXhdO1xuXHRcdHRoaXMubWVhc3VyZUl0ZW1XaWR0aChpdGVtKTtcblxuXHRcdGlmICh0eXBlb2YgaXRlbS53aWR0aCAhPT0gJ3VuZGVmaW5lZCcgJiYgaXRlbS53aWR0aCA+IHRoaXMuc2Nyb2xsV2lkdGgpIHtcblx0XHRcdHRoaXMuc2Nyb2xsV2lkdGggPSBpdGVtLndpZHRoO1xuXHRcdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxEaW1lbnNpb25zKHsgc2Nyb2xsV2lkdGg6IHRoaXMuc2Nyb2xsV2lkdGggKyAxMCB9KTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudFdpZHRoLmZpcmUodGhpcy5zY3JvbGxXaWR0aCk7XG5cdFx0fVxuXHR9XG5cblx0cmVyZW5kZXIoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnN1cHBvcnREeW5hbWljSGVpZ2h0cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZW1zKSB7XG5cdFx0XHRpdGVtLmxhc3REeW5hbWljSGVpZ2h0V2lkdGggPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVyZW5kZXIodGhpcy5sYXN0UmVuZGVyVG9wLCB0aGlzLmxhc3RSZW5kZXJIZWlnaHQpO1xuXHR9XG5cblx0Z2V0IGxlbmd0aCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zLmxlbmd0aDtcblx0fVxuXG5cdGdldCByZW5kZXJIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRjb25zdCBzY3JvbGxEaW1lbnNpb25zID0gdGhpcy5zY3JvbGxhYmxlRWxlbWVudC5nZXRTY3JvbGxEaW1lbnNpb25zKCk7XG5cdFx0cmV0dXJuIHNjcm9sbERpbWVuc2lvbnMuaGVpZ2h0O1xuXHR9XG5cblx0Z2V0IGZpcnN0VmlzaWJsZUluZGV4KCk6IG51bWJlciB7XG5cdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLmdldFZpc2libGVSYW5nZSh0aGlzLmxhc3RSZW5kZXJUb3AsIHRoaXMubGFzdFJlbmRlckhlaWdodCk7XG5cdFx0cmV0dXJuIHJhbmdlLnN0YXJ0O1xuXHR9XG5cblx0Z2V0IGZpcnN0TW9zdGx5VmlzaWJsZUluZGV4KCk6IG51bWJlciB7XG5cdFx0Y29uc3QgZmlyc3RWaXNpYmxlSW5kZXggPSB0aGlzLmZpcnN0VmlzaWJsZUluZGV4O1xuXHRcdGNvbnN0IGZpcnN0RWxUb3AgPSB0aGlzLnJhbmdlTWFwLnBvc2l0aW9uQXQoZmlyc3RWaXNpYmxlSW5kZXgpO1xuXHRcdGNvbnN0IG5leHRFbFRvcCA9IHRoaXMucmFuZ2VNYXAucG9zaXRpb25BdChmaXJzdFZpc2libGVJbmRleCArIDEpO1xuXHRcdGlmIChuZXh0RWxUb3AgIT09IC0xKSB7XG5cdFx0XHRjb25zdCBmaXJzdEVsTWlkcG9pbnQgPSAobmV4dEVsVG9wIC0gZmlyc3RFbFRvcCkgLyAyICsgZmlyc3RFbFRvcDtcblx0XHRcdGlmIChmaXJzdEVsTWlkcG9pbnQgPCB0aGlzLnNjcm9sbFRvcCkge1xuXHRcdFx0XHRyZXR1cm4gZmlyc3RWaXNpYmxlSW5kZXggKyAxO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmaXJzdFZpc2libGVJbmRleDtcblx0fVxuXG5cdGdldCBsYXN0VmlzaWJsZUluZGV4KCk6IG51bWJlciB7XG5cdFx0Y29uc3QgcmFuZ2UgPSB0aGlzLmdldFJlbmRlclJhbmdlKHRoaXMubGFzdFJlbmRlclRvcCwgdGhpcy5sYXN0UmVuZGVySGVpZ2h0KTtcblx0XHRyZXR1cm4gcmFuZ2UuZW5kIC0gMTtcblx0fVxuXG5cdGVsZW1lbnQoaW5kZXg6IG51bWJlcik6IFQge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zW2luZGV4XS5lbGVtZW50O1xuXHR9XG5cblx0aW5kZXhPZihlbGVtZW50OiBUKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcy5maW5kSW5kZXgoaXRlbSA9PiBpdGVtLmVsZW1lbnQgPT09IGVsZW1lbnQpO1xuXHR9XG5cblx0ZG9tRWxlbWVudChpbmRleDogbnVtYmVyKTogSFRNTEVsZW1lbnQgfCBudWxsIHtcblx0XHRjb25zdCByb3cgPSB0aGlzLml0ZW1zW2luZGV4XS5yb3c7XG5cdFx0cmV0dXJuIHJvdyAmJiByb3cuZG9tTm9kZTtcblx0fVxuXG5cdGVsZW1lbnRIZWlnaHQoaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuaXRlbXNbaW5kZXhdLnNpemU7XG5cdH1cblxuXHRlbGVtZW50VG9wKGluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnJhbmdlTWFwLnBvc2l0aW9uQXQoaW5kZXgpO1xuXHR9XG5cblx0aW5kZXhBdChwb3NpdGlvbjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5yYW5nZU1hcC5pbmRleEF0KHBvc2l0aW9uKTtcblx0fVxuXG5cdGluZGV4QWZ0ZXIocG9zaXRpb246IG51bWJlcik6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMucmFuZ2VNYXAuaW5kZXhBZnRlcihwb3NpdGlvbik7XG5cdH1cblxuXHRsYXlvdXQoaGVpZ2h0PzogbnVtYmVyLCB3aWR0aD86IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHNjcm9sbERpbWVuc2lvbnM6IElOZXdTY3JvbGxEaW1lbnNpb25zID0ge1xuXHRcdFx0aGVpZ2h0OiB0eXBlb2YgaGVpZ2h0ID09PSAnbnVtYmVyJyA/IGhlaWdodCA6IGdldENvbnRlbnRIZWlnaHQodGhpcy5kb21Ob2RlKVxuXHRcdH07XG5cblx0XHRpZiAodGhpcy5zY3JvbGxhYmxlRWxlbWVudFVwZGF0ZURpc3Bvc2FibGUpIHtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnRVcGRhdGVEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnRVcGRhdGVEaXNwb3NhYmxlID0gbnVsbDtcblx0XHRcdHNjcm9sbERpbWVuc2lvbnMuc2Nyb2xsSGVpZ2h0ID0gdGhpcy5zY3JvbGxIZWlnaHQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxEaW1lbnNpb25zKHNjcm9sbERpbWVuc2lvbnMpO1xuXG5cdFx0aWYgKHR5cGVvZiB3aWR0aCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHRoaXMucmVuZGVyV2lkdGggPSB3aWR0aDtcblxuXHRcdFx0aWYgKHRoaXMuc3VwcG9ydER5bmFtaWNIZWlnaHRzKSB7XG5cdFx0XHRcdHRoaXMuX3JlcmVuZGVyKHRoaXMuc2Nyb2xsVG9wLCB0aGlzLnJlbmRlckhlaWdodCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaG9yaXpvbnRhbFNjcm9sbGluZykge1xuXHRcdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxEaW1lbnNpb25zKHtcblx0XHRcdFx0d2lkdGg6IHR5cGVvZiB3aWR0aCA9PT0gJ251bWJlcicgPyB3aWR0aCA6IGdldENvbnRlbnRXaWR0aCh0aGlzLmRvbU5vZGUpXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvLyBSZW5kZXJcblxuXHRwcm90ZWN0ZWQgcmVuZGVyKHByZXZpb3VzUmVuZGVyUmFuZ2U6IElSYW5nZSwgcmVuZGVyVG9wOiBudW1iZXIsIHJlbmRlckhlaWdodDogbnVtYmVyLCByZW5kZXJMZWZ0OiBudW1iZXIgfCB1bmRlZmluZWQsIHNjcm9sbFdpZHRoOiBudW1iZXIgfCB1bmRlZmluZWQsIHVwZGF0ZUl0ZW1zSW5ET006IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlbmRlclJhbmdlID0gdGhpcy5nZXRSZW5kZXJSYW5nZShyZW5kZXJUb3AsIHJlbmRlckhlaWdodCk7XG5cblx0XHRjb25zdCByYW5nZXNUb0luc2VydCA9IFJhbmdlLnJlbGF0aXZlQ29tcGxlbWVudChyZW5kZXJSYW5nZSwgcHJldmlvdXNSZW5kZXJSYW5nZSkucmV2ZXJzZSgpO1xuXHRcdGNvbnN0IHJhbmdlc1RvUmVtb3ZlID0gUmFuZ2UucmVsYXRpdmVDb21wbGVtZW50KHByZXZpb3VzUmVuZGVyUmFuZ2UsIHJlbmRlclJhbmdlKTtcblxuXHRcdGlmICh1cGRhdGVJdGVtc0luRE9NKSB7XG5cdFx0XHRjb25zdCByYW5nZXNUb1VwZGF0ZSA9IFJhbmdlLmludGVyc2VjdChwcmV2aW91c1JlbmRlclJhbmdlLCByZW5kZXJSYW5nZSk7XG5cblx0XHRcdGZvciAobGV0IGkgPSByYW5nZXNUb1VwZGF0ZS5zdGFydDsgaSA8IHJhbmdlc1RvVXBkYXRlLmVuZDsgaSsrKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlSXRlbUluRE9NKHRoaXMuaXRlbXNbaV0sIGkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuY2FjaGUudHJhbnNhY3QoKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCByYW5nZSBvZiByYW5nZXNUb1JlbW92ZSkge1xuXHRcdFx0XHRmb3IgKGxldCBpID0gcmFuZ2Uuc3RhcnQ7IGkgPCByYW5nZS5lbmQ7IGkrKykge1xuXHRcdFx0XHRcdHRoaXMucmVtb3ZlSXRlbUZyb21ET00oaSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCByYW5nZSBvZiByYW5nZXNUb0luc2VydCkge1xuXHRcdFx0XHRmb3IgKGxldCBpID0gcmFuZ2UuZW5kIC0gMTsgaSA+PSByYW5nZS5zdGFydDsgaS0tKSB7XG5cdFx0XHRcdFx0dGhpcy5pbnNlcnRJdGVtSW5ET00oaSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmIChyZW5kZXJMZWZ0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMucm93c0NvbnRhaW5lci5zdHlsZS5sZWZ0ID0gYC0ke3JlbmRlckxlZnR9cHhgO1xuXHRcdH1cblxuXHRcdHRoaXMucm93c0NvbnRhaW5lci5zdHlsZS50b3AgPSBgLSR7cmVuZGVyVG9wfXB4YDtcblxuXHRcdGlmICh0aGlzLmhvcml6b250YWxTY3JvbGxpbmcgJiYgc2Nyb2xsV2lkdGggIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5yb3dzQ29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7TWF0aC5tYXgoc2Nyb2xsV2lkdGgsIHRoaXMucmVuZGVyV2lkdGgpfXB4YDtcblx0XHR9XG5cblx0XHR0aGlzLmxhc3RSZW5kZXJUb3AgPSByZW5kZXJUb3A7XG5cdFx0dGhpcy5sYXN0UmVuZGVySGVpZ2h0ID0gcmVuZGVySGVpZ2h0O1xuXHR9XG5cblx0Ly8gRE9NIG9wZXJhdGlvbnNcblxuXHRwcml2YXRlIGluc2VydEl0ZW1JbkRPTShpbmRleDogbnVtYmVyLCByb3c/OiBJUm93KTogdm9pZCB7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuaXRlbXNbaW5kZXhdO1xuXG5cdFx0aWYgKCFpdGVtLnJvdykge1xuXHRcdFx0aWYgKHJvdykge1xuXHRcdFx0XHRpdGVtLnJvdyA9IHJvdztcblx0XHRcdFx0aXRlbS5zdGFsZSA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmNhY2hlLmFsbG9jKGl0ZW0udGVtcGxhdGVJZCk7XG5cdFx0XHRcdGl0ZW0ucm93ID0gcmVzdWx0LnJvdztcblx0XHRcdFx0aXRlbS5zdGFsZSB8fD0gcmVzdWx0LmlzUmV1c2luZ0Nvbm5lY3RlZERvbU5vZGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9sZSA9IHRoaXMuYWNjZXNzaWJpbGl0eVByb3ZpZGVyLmdldFJvbGUoaXRlbS5lbGVtZW50KSB8fCAnbGlzdGl0ZW0nO1xuXHRcdGl0ZW0ucm93LmRvbU5vZGUuc2V0QXR0cmlidXRlKCdyb2xlJywgcm9sZSk7XG5cblx0XHRjb25zdCBjaGVja2VkID0gdGhpcy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuaXNDaGVja2VkKGl0ZW0uZWxlbWVudCk7XG5cblx0XHRpZiAodHlwZW9mIGNoZWNrZWQgPT09ICdib29sZWFuJykge1xuXHRcdFx0aXRlbS5yb3cuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcsIFN0cmluZyghIWNoZWNrZWQpKTtcblx0XHR9IGVsc2UgaWYgKGNoZWNrZWQpIHtcblx0XHRcdGNvbnN0IHVwZGF0ZSA9IChjaGVja2VkOiBib29sZWFuKSA9PiBpdGVtLnJvdyEuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtY2hlY2tlZCcsIFN0cmluZyghIWNoZWNrZWQpKTtcblx0XHRcdHVwZGF0ZShjaGVja2VkLnZhbHVlKTtcblx0XHRcdGl0ZW0uY2hlY2tlZERpc3Bvc2FibGUgPSBjaGVja2VkLm9uRGlkQ2hhbmdlKCgpID0+IHVwZGF0ZShjaGVja2VkLnZhbHVlKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGl0ZW0uc3RhbGUgfHwgIWl0ZW0ucm93LmRvbU5vZGUucGFyZW50RWxlbWVudCkge1xuXHRcdFx0Y29uc3QgcmVmZXJlbmNlTm9kZSA9IHRoaXMuaXRlbXMuYXQoaW5kZXggKyAxKT8ucm93Py5kb21Ob2RlID8/IG51bGw7XG5cdFx0XHRpZiAoaXRlbS5yb3cuZG9tTm9kZS5wYXJlbnRFbGVtZW50ICE9PSB0aGlzLnJvd3NDb250YWluZXIgfHwgaXRlbS5yb3cuZG9tTm9kZS5uZXh0RWxlbWVudFNpYmxpbmcgIT09IHJlZmVyZW5jZU5vZGUpIHtcblx0XHRcdFx0dGhpcy5yb3dzQ29udGFpbmVyLmluc2VydEJlZm9yZShpdGVtLnJvdy5kb21Ob2RlLCByZWZlcmVuY2VOb2RlKTtcblx0XHRcdH1cblx0XHRcdGl0ZW0uc3RhbGUgPSBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZUl0ZW1JbkRPTShpdGVtLCBpbmRleCk7XG5cblx0XHRjb25zdCByZW5kZXJlciA9IHRoaXMucmVuZGVyZXJzLmdldChpdGVtLnRlbXBsYXRlSWQpO1xuXG5cdFx0aWYgKCFyZW5kZXJlcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyByZW5kZXJlciBmb3VuZCBmb3IgdGVtcGxhdGUgaWQgJHtpdGVtLnRlbXBsYXRlSWR9YCk7XG5cdFx0fVxuXG5cdFx0cmVuZGVyZXI/LnJlbmRlckVsZW1lbnQoaXRlbS5lbGVtZW50LCBpbmRleCwgaXRlbS5yb3cudGVtcGxhdGVEYXRhLCBpdGVtLnNpemUpO1xuXG5cdFx0Y29uc3QgdXJpID0gdGhpcy5kbmQuZ2V0RHJhZ1VSSShpdGVtLmVsZW1lbnQpO1xuXHRcdGl0ZW0uZHJhZ1N0YXJ0RGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0aXRlbS5yb3cuZG9tTm9kZS5kcmFnZ2FibGUgPSAhIXVyaTtcblxuXHRcdGlmICh1cmkpIHtcblx0XHRcdGl0ZW0uZHJhZ1N0YXJ0RGlzcG9zYWJsZSA9IGFkZERpc3Bvc2FibGVMaXN0ZW5lcihpdGVtLnJvdy5kb21Ob2RlLCAnZHJhZ3N0YXJ0JywgZXZlbnQgPT4gdGhpcy5vbkRyYWdTdGFydChpdGVtLmVsZW1lbnQsIHVyaSwgZXZlbnQpKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5ob3Jpem9udGFsU2Nyb2xsaW5nKSB7XG5cdFx0XHR0aGlzLm1lYXN1cmVJdGVtV2lkdGgoaXRlbSk7XG5cdFx0XHR0aGlzLmV2ZW50dWFsbHlVcGRhdGVTY3JvbGxXaWR0aCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbWVhc3VyZUl0ZW1XaWR0aChpdGVtOiBJSXRlbTxUPik6IHZvaWQge1xuXHRcdGlmICghaXRlbS5yb3cgfHwgIWl0ZW0ucm93LmRvbU5vZGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpdGVtLnJvdy5kb21Ob2RlLnN0eWxlLndpZHRoID0gJ2ZpdC1jb250ZW50Jztcblx0XHRpdGVtLndpZHRoID0gZ2V0Q29udGVudFdpZHRoKGl0ZW0ucm93LmRvbU5vZGUpO1xuXHRcdGNvbnN0IHN0eWxlID0gZ2V0V2luZG93KGl0ZW0ucm93LmRvbU5vZGUpLmdldENvbXB1dGVkU3R5bGUoaXRlbS5yb3cuZG9tTm9kZSk7XG5cblx0XHRpZiAoc3R5bGUucGFkZGluZ0xlZnQpIHtcblx0XHRcdGl0ZW0ud2lkdGggKz0gcGFyc2VGbG9hdChzdHlsZS5wYWRkaW5nTGVmdCk7XG5cdFx0fVxuXG5cdFx0aWYgKHN0eWxlLnBhZGRpbmdSaWdodCkge1xuXHRcdFx0aXRlbS53aWR0aCArPSBwYXJzZUZsb2F0KHN0eWxlLnBhZGRpbmdSaWdodCk7XG5cdFx0fVxuXG5cdFx0aXRlbS5yb3cuZG9tTm9kZS5zdHlsZS53aWR0aCA9ICcnO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVJdGVtSW5ET00oaXRlbTogSUl0ZW08VD4sIGluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpdGVtLnJvdyEuZG9tTm9kZS5zdHlsZS50b3AgPSBgJHt0aGlzLmVsZW1lbnRUb3AoaW5kZXgpfXB4YDtcblxuXHRcdGlmICh0aGlzLnNldFJvd0hlaWdodCkge1xuXHRcdFx0aXRlbS5yb3chLmRvbU5vZGUuc3R5bGUuaGVpZ2h0ID0gYCR7aXRlbS5zaXplfXB4YDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zZXRSb3dMaW5lSGVpZ2h0KSB7XG5cdFx0XHRpdGVtLnJvdyEuZG9tTm9kZS5zdHlsZS5saW5lSGVpZ2h0ID0gYCR7aXRlbS5zaXplfXB4YDtcblx0XHR9XG5cblx0XHRpdGVtLnJvdyEuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtaW5kZXgnLCBgJHtpbmRleH1gKTtcblx0XHRpdGVtLnJvdyEuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtbGFzdC1lbGVtZW50JywgaW5kZXggPT09IHRoaXMubGVuZ3RoIC0gMSA/ICd0cnVlJyA6ICdmYWxzZScpO1xuXHRcdGl0ZW0ucm93IS5kb21Ob2RlLnNldEF0dHJpYnV0ZSgnZGF0YS1wYXJpdHknLCBpbmRleCAlIDIgPT09IDAgPyAnZXZlbicgOiAnb2RkJyk7XG5cdFx0aXRlbS5yb3chLmRvbU5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLXNldHNpemUnLCBTdHJpbmcodGhpcy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0U2V0U2l6ZShpdGVtLmVsZW1lbnQsIGluZGV4LCB0aGlzLmxlbmd0aCkpKTtcblx0XHRpdGVtLnJvdyEuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtcG9zaW5zZXQnLCBTdHJpbmcodGhpcy5hY2Nlc3NpYmlsaXR5UHJvdmlkZXIuZ2V0UG9zSW5TZXQoaXRlbS5lbGVtZW50LCBpbmRleCkpKTtcblx0XHRpdGVtLnJvdyEuZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2lkJywgdGhpcy5nZXRFbGVtZW50RG9tSWQoaW5kZXgpKTtcblxuXHRcdGl0ZW0ucm93IS5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2Ryb3AtdGFyZ2V0JywgaXRlbS5kcm9wVGFyZ2V0KTtcblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlSXRlbUZyb21ET00oaW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGl0ZW0gPSB0aGlzLml0ZW1zW2luZGV4XTtcblx0XHRpdGVtLmRyYWdTdGFydERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdGl0ZW0uY2hlY2tlZERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXG5cdFx0aWYgKGl0ZW0ucm93KSB7XG5cdFx0XHRjb25zdCByZW5kZXJlciA9IHRoaXMucmVuZGVyZXJzLmdldChpdGVtLnRlbXBsYXRlSWQpO1xuXG5cdFx0XHRpZiAocmVuZGVyZXIgJiYgcmVuZGVyZXIuZGlzcG9zZUVsZW1lbnQpIHtcblx0XHRcdFx0cmVuZGVyZXIuZGlzcG9zZUVsZW1lbnQoaXRlbS5lbGVtZW50LCBpbmRleCwgaXRlbS5yb3cudGVtcGxhdGVEYXRhLCBpdGVtLnNpemUpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmNhY2hlLnJlbGVhc2UoaXRlbS5yb3cpO1xuXHRcdFx0aXRlbS5yb3cgPSBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmhvcml6b250YWxTY3JvbGxpbmcpIHtcblx0XHRcdHRoaXMuZXZlbnR1YWxseVVwZGF0ZVNjcm9sbFdpZHRoKCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0U2Nyb2xsVG9wKCk6IG51bWJlciB7XG5cdFx0Y29uc3Qgc2Nyb2xsUG9zaXRpb24gPSB0aGlzLnNjcm9sbGFibGVFbGVtZW50LmdldFNjcm9sbFBvc2l0aW9uKCk7XG5cdFx0cmV0dXJuIHNjcm9sbFBvc2l0aW9uLnNjcm9sbFRvcDtcblx0fVxuXG5cdHNldFNjcm9sbFRvcChzY3JvbGxUb3A6IG51bWJlciwgcmV1c2VBbmltYXRpb24/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnRVcGRhdGVEaXNwb3NhYmxlKSB7XG5cdFx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50VXBkYXRlRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50VXBkYXRlRGlzcG9zYWJsZSA9IG51bGw7XG5cdFx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50LnNldFNjcm9sbERpbWVuc2lvbnMoeyBzY3JvbGxIZWlnaHQ6IHRoaXMuc2Nyb2xsSGVpZ2h0IH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3AsIHJldXNlQW5pbWF0aW9uIH0pO1xuXHR9XG5cblx0Z2V0U2Nyb2xsTGVmdCgpOiBudW1iZXIge1xuXHRcdGNvbnN0IHNjcm9sbFBvc2l0aW9uID0gdGhpcy5zY3JvbGxhYmxlRWxlbWVudC5nZXRTY3JvbGxQb3NpdGlvbigpO1xuXHRcdHJldHVybiBzY3JvbGxQb3NpdGlvbi5zY3JvbGxMZWZ0O1xuXHR9XG5cblx0c2V0U2Nyb2xsTGVmdChzY3JvbGxMZWZ0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zY3JvbGxhYmxlRWxlbWVudFVwZGF0ZURpc3Bvc2FibGUpIHtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnRVcGRhdGVEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnRVcGRhdGVEaXNwb3NhYmxlID0gbnVsbDtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuc2V0U2Nyb2xsRGltZW5zaW9ucyh7IHNjcm9sbFdpZHRoOiB0aGlzLnNjcm9sbFdpZHRoIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxMZWZ0IH0pO1xuXHR9XG5cblxuXHRnZXQgc2Nyb2xsVG9wKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U2Nyb2xsVG9wKCk7XG5cdH1cblxuXHRzZXQgc2Nyb2xsVG9wKHNjcm9sbFRvcDogbnVtYmVyKSB7XG5cdFx0dGhpcy5zZXRTY3JvbGxUb3Aoc2Nyb2xsVG9wKTtcblx0fVxuXG5cdGdldCBzY3JvbGxIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fc2Nyb2xsSGVpZ2h0ICsgKHRoaXMuaG9yaXpvbnRhbFNjcm9sbGluZyA/IDEwIDogMCkgKyB0aGlzLnBhZGRpbmdCb3R0b207XG5cdH1cblxuXHQvLyBFdmVudHNcblxuXHRAbWVtb2l6ZSBnZXQgb25Nb3VzZUNsaWNrKCk6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj4geyByZXR1cm4gRXZlbnQubWFwKHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHRoaXMuZG9tTm9kZSwgJ2NsaWNrJykpLmV2ZW50LCBlID0+IHRoaXMudG9Nb3VzZUV2ZW50KGUpLCB0aGlzLmRpc3Bvc2FibGVzKTsgfVxuXHRAbWVtb2l6ZSBnZXQgb25Nb3VzZURibENsaWNrKCk6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj4geyByZXR1cm4gRXZlbnQubWFwKHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHRoaXMuZG9tTm9kZSwgJ2RibGNsaWNrJykpLmV2ZW50LCBlID0+IHRoaXMudG9Nb3VzZUV2ZW50KGUpLCB0aGlzLmRpc3Bvc2FibGVzKTsgfVxuXHRAbWVtb2l6ZSBnZXQgb25Nb3VzZU1pZGRsZUNsaWNrKCk6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj4geyByZXR1cm4gRXZlbnQuZmlsdGVyKEV2ZW50Lm1hcCh0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcih0aGlzLmRvbU5vZGUsICdhdXhjbGljaycpKS5ldmVudCwgZSA9PiB0aGlzLnRvTW91c2VFdmVudChlIGFzIE1vdXNlRXZlbnQpLCB0aGlzLmRpc3Bvc2FibGVzKSwgZSA9PiBlLmJyb3dzZXJFdmVudC5idXR0b24gPT09IDEsIHRoaXMuZGlzcG9zYWJsZXMpOyB9XG5cdEBtZW1vaXplIGdldCBvbk1vdXNlVXAoKTogRXZlbnQ8SUxpc3RNb3VzZUV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5tYXAodGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy5kb21Ob2RlLCAnbW91c2V1cCcpKS5ldmVudCwgZSA9PiB0aGlzLnRvTW91c2VFdmVudChlKSwgdGhpcy5kaXNwb3NhYmxlcyk7IH1cblx0QG1lbW9pemUgZ2V0IG9uTW91c2VEb3duKCk6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj4geyByZXR1cm4gRXZlbnQubWFwKHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHRoaXMuZG9tTm9kZSwgJ21vdXNlZG93bicpKS5ldmVudCwgZSA9PiB0aGlzLnRvTW91c2VFdmVudChlKSwgdGhpcy5kaXNwb3NhYmxlcyk7IH1cblx0QG1lbW9pemUgZ2V0IG9uTW91c2VPdmVyKCk6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj4geyByZXR1cm4gRXZlbnQubWFwKHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHRoaXMuZG9tTm9kZSwgJ21vdXNlb3ZlcicpKS5ldmVudCwgZSA9PiB0aGlzLnRvTW91c2VFdmVudChlKSwgdGhpcy5kaXNwb3NhYmxlcyk7IH1cblx0QG1lbW9pemUgZ2V0IG9uTW91c2VNb3ZlKCk6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPj4geyByZXR1cm4gRXZlbnQubWFwKHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHRoaXMuZG9tTm9kZSwgJ21vdXNlbW92ZScpKS5ldmVudCwgZSA9PiB0aGlzLnRvTW91c2VFdmVudChlKSwgdGhpcy5kaXNwb3NhYmxlcyk7IH1cblx0QG1lbW9pemUgZ2V0IG9uTW91c2VPdXQoKTogRXZlbnQ8SUxpc3RNb3VzZUV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5tYXAodGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy5kb21Ob2RlLCAnbW91c2VvdXQnKSkuZXZlbnQsIGUgPT4gdGhpcy50b01vdXNlRXZlbnQoZSksIHRoaXMuZGlzcG9zYWJsZXMpOyB9XG5cdEBtZW1vaXplIGdldCBvbkNvbnRleHRNZW51KCk6IEV2ZW50PElMaXN0TW91c2VFdmVudDxUPiB8IElMaXN0R2VzdHVyZUV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5hbnk8SUxpc3RNb3VzZUV2ZW50PGFueT4gfCBJTGlzdEdlc3R1cmVFdmVudDxhbnk+PihFdmVudC5tYXAodGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy5kb21Ob2RlLCAnY29udGV4dG1lbnUnKSkuZXZlbnQsIGUgPT4gdGhpcy50b01vdXNlRXZlbnQoZSksIHRoaXMuZGlzcG9zYWJsZXMpLCBFdmVudC5tYXAodGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy5kb21Ob2RlLCBUb3VjaEV2ZW50VHlwZS5Db250ZXh0bWVudSkpLmV2ZW50IGFzIEV2ZW50PEdlc3R1cmVFdmVudD4sIGUgPT4gdGhpcy50b0dlc3R1cmVFdmVudChlKSwgdGhpcy5kaXNwb3NhYmxlcykpOyB9XG5cdEBtZW1vaXplIGdldCBvblRvdWNoU3RhcnQoKTogRXZlbnQ8SUxpc3RUb3VjaEV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5tYXAodGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy5kb21Ob2RlLCAndG91Y2hzdGFydCcpKS5ldmVudCwgZSA9PiB0aGlzLnRvVG91Y2hFdmVudChlKSwgdGhpcy5kaXNwb3NhYmxlcyk7IH1cblx0QG1lbW9pemUgZ2V0IG9uVGFwKCk6IEV2ZW50PElMaXN0R2VzdHVyZUV2ZW50PFQ+PiB7IHJldHVybiBFdmVudC5tYXAodGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy5yb3dzQ29udGFpbmVyLCBUb3VjaEV2ZW50VHlwZS5UYXApKS5ldmVudCwgZSA9PiB0aGlzLnRvR2VzdHVyZUV2ZW50KGUgYXMgR2VzdHVyZUV2ZW50KSwgdGhpcy5kaXNwb3NhYmxlcyk7IH1cblxuXHRwcml2YXRlIHRvTW91c2VFdmVudChicm93c2VyRXZlbnQ6IE1vdXNlRXZlbnQpOiBJTGlzdE1vdXNlRXZlbnQ8VD4ge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJdGVtSW5kZXhGcm9tRXZlbnRUYXJnZXQoYnJvd3NlckV2ZW50LnRhcmdldCB8fCBudWxsKTtcblx0XHRjb25zdCBpdGVtID0gdHlwZW9mIGluZGV4ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IHRoaXMuaXRlbXNbaW5kZXhdO1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBpdGVtICYmIGl0ZW0uZWxlbWVudDtcblx0XHRyZXR1cm4geyBicm93c2VyRXZlbnQsIGluZGV4LCBlbGVtZW50IH07XG5cdH1cblxuXHRwcml2YXRlIHRvVG91Y2hFdmVudChicm93c2VyRXZlbnQ6IFRvdWNoRXZlbnQpOiBJTGlzdFRvdWNoRXZlbnQ8VD4ge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJdGVtSW5kZXhGcm9tRXZlbnRUYXJnZXQoYnJvd3NlckV2ZW50LnRhcmdldCB8fCBudWxsKTtcblx0XHRjb25zdCBpdGVtID0gdHlwZW9mIGluZGV4ID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IHRoaXMuaXRlbXNbaW5kZXhdO1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBpdGVtICYmIGl0ZW0uZWxlbWVudDtcblx0XHRyZXR1cm4geyBicm93c2VyRXZlbnQsIGluZGV4LCBlbGVtZW50IH07XG5cdH1cblxuXHRwcml2YXRlIHRvR2VzdHVyZUV2ZW50KGJyb3dzZXJFdmVudDogR2VzdHVyZUV2ZW50KTogSUxpc3RHZXN0dXJlRXZlbnQ8VD4ge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJdGVtSW5kZXhGcm9tRXZlbnRUYXJnZXQoYnJvd3NlckV2ZW50LmluaXRpYWxUYXJnZXQgfHwgbnVsbCk7XG5cdFx0Y29uc3QgaXRlbSA9IHR5cGVvZiBpbmRleCA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiB0aGlzLml0ZW1zW2luZGV4XTtcblx0XHRjb25zdCBlbGVtZW50ID0gaXRlbSAmJiBpdGVtLmVsZW1lbnQ7XG5cdFx0cmV0dXJuIHsgYnJvd3NlckV2ZW50LCBpbmRleCwgZWxlbWVudCB9O1xuXHR9XG5cblx0cHJpdmF0ZSB0b0RyYWdFdmVudChicm93c2VyRXZlbnQ6IERyYWdFdmVudCk6IElMaXN0RHJhZ0V2ZW50PFQ+IHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuZ2V0SXRlbUluZGV4RnJvbUV2ZW50VGFyZ2V0KGJyb3dzZXJFdmVudC50YXJnZXQgfHwgbnVsbCk7XG5cdFx0Y29uc3QgaXRlbSA9IHR5cGVvZiBpbmRleCA9PT0gJ3VuZGVmaW5lZCcgPyB1bmRlZmluZWQgOiB0aGlzLml0ZW1zW2luZGV4XTtcblx0XHRjb25zdCBlbGVtZW50ID0gaXRlbSAmJiBpdGVtLmVsZW1lbnQ7XG5cdFx0Y29uc3Qgc2VjdG9yID0gdGhpcy5nZXRUYXJnZXRTZWN0b3IoYnJvd3NlckV2ZW50LCBpbmRleCk7XG5cdFx0cmV0dXJuIHsgYnJvd3NlckV2ZW50LCBpbmRleCwgZWxlbWVudCwgc2VjdG9yIH07XG5cdH1cblxuXHRwcml2YXRlIG9uU2Nyb2xsKGU6IFNjcm9sbEV2ZW50KTogdm9pZCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHByZXZpb3VzUmVuZGVyUmFuZ2UgPSB0aGlzLmdldFJlbmRlclJhbmdlKHRoaXMubGFzdFJlbmRlclRvcCwgdGhpcy5sYXN0UmVuZGVySGVpZ2h0KTtcblx0XHRcdHRoaXMucmVuZGVyKHByZXZpb3VzUmVuZGVyUmFuZ2UsIGUuc2Nyb2xsVG9wLCBlLmhlaWdodCwgZS5zY3JvbGxMZWZ0LCBlLnNjcm9sbFdpZHRoKTtcblxuXHRcdFx0aWYgKHRoaXMuc3VwcG9ydER5bmFtaWNIZWlnaHRzKSB7XG5cdFx0XHRcdHRoaXMuX3JlcmVuZGVyKGUuc2Nyb2xsVG9wLCBlLmhlaWdodCwgZS5pblNtb290aFNjcm9sbGluZyk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdHb3QgYmFkIHNjcm9sbCBldmVudDonLCBlKTtcblx0XHRcdHRocm93IGVycjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uVG91Y2hDaGFuZ2UoZXZlbnQ6IEdlc3R1cmVFdmVudCk6IHZvaWQge1xuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHR0aGlzLnNjcm9sbFRvcCAtPSBldmVudC50cmFuc2xhdGlvblk7XG5cdH1cblxuXHQvLyBETkRcblxuXHRwcml2YXRlIG9uRHJhZ1N0YXJ0KGVsZW1lbnQ6IFQsIHVyaTogc3RyaW5nLCBldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCFldmVudC5kYXRhVHJhbnNmZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbGVtZW50cyA9IHRoaXMuZG5kLmdldERyYWdFbGVtZW50cyhlbGVtZW50KTtcblxuXHRcdGV2ZW50LmRhdGFUcmFuc2Zlci5lZmZlY3RBbGxvd2VkID0gJ2NvcHlNb3ZlJztcblx0XHRldmVudC5kYXRhVHJhbnNmZXIuc2V0RGF0YShEYXRhVHJhbnNmZXJzLlRFWFQsIHVyaSk7XG5cblx0XHRsZXQgbGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5kbmQuZ2V0RHJhZ0xhYmVsKSB7XG5cdFx0XHRsYWJlbCA9IHRoaXMuZG5kLmdldERyYWdMYWJlbChlbGVtZW50cywgZXZlbnQpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGxhYmVsID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0bGFiZWwgPSBTdHJpbmcoZWxlbWVudHMubGVuZ3RoKTtcblx0XHR9XG5cblx0XHRhcHBseURyYWdJbWFnZShldmVudCwgdGhpcy5kb21Ob2RlLCBsYWJlbCwgW3RoaXMuZG9tSWQgLyogYWRkIGRvbUlkIHRvIGdldCBsaXN0IHNwZWNpZmljIHN0eWxpbmcgKi9dKTtcblxuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xuXHRcdHRoaXMuY3VycmVudERyYWdEYXRhID0gbmV3IEVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhKGVsZW1lbnRzKTtcblx0XHRTdGF0aWNETkQuQ3VycmVudERyYWdBbmREcm9wRGF0YSA9IG5ldyBFeHRlcm5hbEVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhKGVsZW1lbnRzKTtcblxuXHRcdHRoaXMuZG5kLm9uRHJhZ1N0YXJ0Py4odGhpcy5jdXJyZW50RHJhZ0RhdGEsIGV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgb25Qb3RlbnRpYWxTZWxlY3Rpb25TdGFydChlOiBNb3VzZUV2ZW50KSB7XG5cdFx0dGhpcy5jdXJyZW50U2VsZWN0aW9uRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0Y29uc3QgZG9jID0gZ2V0RG9jdW1lbnQodGhpcy5kb21Ob2RlKTtcblxuXHRcdC8vIFNldCB1cCBib3RoIHRoZSAnbW92ZW1lbnQgc3RvcmUnIGZvciB3YXRjaGluZyB0aGUgbW91c2UsIGFuZCB0aGVcblx0XHQvLyAnc2VsZWN0aW9uIHN0b3JlJyB3aGljaCBsYXN0cyBhcyBsb25nIGFzIHRoZXJlJ3MgYSBzZWxlY3Rpb24sIGV2ZW5cblx0XHQvLyBhZnRlciB0aGUgdXNyIGhhcyBzdG9wcGVkIG1vZGlmeWluZyBpdC5cblx0XHRjb25zdCBzZWxlY3Rpb25TdG9yZSA9IHRoaXMuY3VycmVudFNlbGVjdGlvbkRpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbW92ZW1lbnRTdG9yZSA9IHNlbGVjdGlvblN0b3JlLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdFx0Ly8gVGhlIHNlbGVjdGlvbiBldmVudHMgd2UgZ2V0IGZyb20gdGhlIERPTSBhcmUgZmFpcmx5IGxpbWl0ZWQgYW5kIHdlIGxhY2sgYSAnc2VsZWN0aW9uIGVuZCcgZXZlbnQuXG5cdFx0Ly8gU2VsZWN0aW9uIGV2ZW50cyBhbHNvIGRvbid0IHRlbGwgdXMgd2hlcmUgdGhlIGlucHV0IGRvaW5nIHRoZSBzZWxlY3Rpb24gaXMuIFNvLCBtYWtlIGEgcG9vclxuXHRcdC8vIGFzc3VtcHRpb24gdGhhdCBhIHVzZXIgaXMgdXNpbmcgdGhlIG1vdXNlLCBhbmQgYmFzZSBvdXIgZXZlbnRzIG9uIHRoYXQuXG5cdFx0bW92ZW1lbnRTdG9yZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZG9tTm9kZSwgJ3NlbGVjdHN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0bW92ZW1lbnRTdG9yZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGRvYywgJ21vdXNlbW92ZScsIGUgPT4ge1xuXHRcdFx0XHRpZiAoZG9jLmdldFNlbGVjdGlvbigpPy5pc0NvbGxhcHNlZCA9PT0gZmFsc2UpIHtcblx0XHRcdFx0XHR0aGlzLnNldHVwRHJhZ0FuZERyb3BTY3JvbGxUb3BBbmltYXRpb24oZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gVGhlIHNlbGVjdGlvbiBpcyBjbGVhcmVkIGVpdGhlciBvbiBtb3VzZXVwIGlmIHRoZXJlJ3Mgbm8gc2VsZWN0aW9uLCBvciBvbiBuZXh0IG1vdXNlZG93blxuXHRcdFx0Ly8gd2hlbiBgdGhpcy5jdXJyZW50U2VsZWN0aW9uRGlzcG9zYWJsZWAgaXMgcmVzZXQuXG5cdFx0XHRzZWxlY3Rpb25TdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgcHJldmlvdXNSZW5kZXJSYW5nZSA9IHRoaXMuZ2V0UmVuZGVyUmFuZ2UodGhpcy5sYXN0UmVuZGVyVG9wLCB0aGlzLmxhc3RSZW5kZXJIZWlnaHQpO1xuXHRcdFx0XHR0aGlzLmN1cnJlbnRTZWxlY3Rpb25Cb3VuZHMgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMucmVuZGVyKHByZXZpb3VzUmVuZGVyUmFuZ2UsIHRoaXMubGFzdFJlbmRlclRvcCwgdGhpcy5sYXN0UmVuZGVySGVpZ2h0LCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRzZWxlY3Rpb25TdG9yZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGRvYywgJ3NlbGVjdGlvbmNoYW5nZScsICgpID0+IHtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gZG9jLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0XHQvLyBpZiB0aGUgc2VsZWN0aW9uIGNoYW5nZWQgX2FmdGVyXyBtb3VzZXVwLCBpdCdzIGZyb20gY2xlYXJpbmcgdGhlIGxpc3Qgb3Igc2ltaWxhciwgc28gdGVhcmRvd25cblx0XHRcdFx0aWYgKCFzZWxlY3Rpb24gfHwgc2VsZWN0aW9uLmlzQ29sbGFwc2VkKSB7XG5cdFx0XHRcdFx0aWYgKG1vdmVtZW50U3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdFx0c2VsZWN0aW9uU3RvcmUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgc3RhcnQgPSB0aGlzLmdldEluZGV4T2ZMaXN0RWxlbWVudChzZWxlY3Rpb24uYW5jaG9yTm9kZSBhcyBIVE1MRWxlbWVudCk7XG5cdFx0XHRcdGxldCBlbmQgPSB0aGlzLmdldEluZGV4T2ZMaXN0RWxlbWVudChzZWxlY3Rpb24uZm9jdXNOb2RlIGFzIEhUTUxFbGVtZW50KTtcblx0XHRcdFx0aWYgKHN0YXJ0ICE9PSB1bmRlZmluZWQgJiYgZW5kICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRpZiAoZW5kIDwgc3RhcnQpIHtcblx0XHRcdFx0XHRcdFtzdGFydCwgZW5kXSA9IFtlbmQsIHN0YXJ0XTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50U2VsZWN0aW9uQm91bmRzID0geyBzdGFydCwgZW5kIH07XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9KSk7XG5cblx0XHRtb3ZlbWVudFN0b3JlLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIoZG9jLCAnbW91c2V1cCcsICgpID0+IHtcblx0XHRcdG1vdmVtZW50U3RvcmUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy50ZWFyZG93bkRyYWdBbmREcm9wU2Nyb2xsVG9wQW5pbWF0aW9uKCk7XG5cblx0XHRcdGlmIChkb2MuZ2V0U2VsZWN0aW9uKCk/LmlzQ29sbGFwc2VkICE9PSBmYWxzZSkge1xuXHRcdFx0XHRzZWxlY3Rpb25TdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRJbmRleE9mTGlzdEVsZW1lbnQoZWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIWVsZW1lbnQgfHwgIXRoaXMuZG9tTm9kZS5jb250YWlucyhlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR3aGlsZSAoZWxlbWVudCAmJiBlbGVtZW50ICE9PSB0aGlzLmRvbU5vZGUpIHtcblx0XHRcdGlmIChlbGVtZW50LmRhdGFzZXQ/LmluZGV4KSB7XG5cdFx0XHRcdHJldHVybiBOdW1iZXIoZWxlbWVudC5kYXRhc2V0LmluZGV4KTtcblx0XHRcdH1cblxuXHRcdFx0ZWxlbWVudCA9IGVsZW1lbnQucGFyZW50RWxlbWVudDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRyYWdPdmVyKGV2ZW50OiBJTGlzdERyYWdFdmVudDxUPik6IGJvb2xlYW4ge1xuXHRcdGV2ZW50LmJyb3dzZXJFdmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBuZWVkZWQgc28gdGhhdCB0aGUgZHJvcCBldmVudCBmaXJlcyAoaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjEzMzk5MjQvZHJvcC1ldmVudC1ub3QtZmlyaW5nLWluLWNocm9tZSlcblxuXHRcdHRoaXMub25EcmFnTGVhdmVUaW1lb3V0LmRpc3Bvc2UoKTtcblxuXHRcdGlmIChTdGF0aWNETkQuQ3VycmVudERyYWdBbmREcm9wRGF0YSAmJiBTdGF0aWNETkQuQ3VycmVudERyYWdBbmREcm9wRGF0YS5nZXREYXRhKCkgPT09ICd2c2NvZGUtdWknKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXR1cERyYWdBbmREcm9wU2Nyb2xsVG9wQW5pbWF0aW9uKGV2ZW50LmJyb3dzZXJFdmVudCk7XG5cblx0XHRpZiAoIWV2ZW50LmJyb3dzZXJFdmVudC5kYXRhVHJhbnNmZXIpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBEcmFnIG92ZXIgZnJvbSBvdXRzaWRlXG5cdFx0aWYgKCF0aGlzLmN1cnJlbnREcmFnRGF0YSkge1xuXHRcdFx0aWYgKFN0YXRpY0RORC5DdXJyZW50RHJhZ0FuZERyb3BEYXRhKSB7XG5cdFx0XHRcdC8vIERyYWcgb3ZlciBmcm9tIGFub3RoZXIgbGlzdFxuXHRcdFx0XHR0aGlzLmN1cnJlbnREcmFnRGF0YSA9IFN0YXRpY0RORC5DdXJyZW50RHJhZ0FuZERyb3BEYXRhO1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBEcmFnIG92ZXIgZnJvbSB0aGUgZGVza3RvcFxuXHRcdFx0XHRpZiAoIWV2ZW50LmJyb3dzZXJFdmVudC5kYXRhVHJhbnNmZXIudHlwZXMpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmN1cnJlbnREcmFnRGF0YSA9IG5ldyBOYXRpdmVEcmFnQW5kRHJvcERhdGEoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmRuZC5vbkRyYWdPdmVyKHRoaXMuY3VycmVudERyYWdEYXRhLCBldmVudC5lbGVtZW50LCBldmVudC5pbmRleCwgZXZlbnQuc2VjdG9yLCBldmVudC5icm93c2VyRXZlbnQpO1xuXHRcdHRoaXMuY2FuRHJvcCA9IHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJyA/IHJlc3VsdCA6IHJlc3VsdC5hY2NlcHQ7XG5cblx0XHRpZiAoIXRoaXMuY2FuRHJvcCkge1xuXHRcdFx0dGhpcy5jdXJyZW50RHJhZ0ZlZWRiYWNrID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5jdXJyZW50RHJhZ0ZlZWRiYWNrRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0ZXZlbnQuYnJvd3NlckV2ZW50LmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gKHR5cGVvZiByZXN1bHQgIT09ICdib29sZWFuJyAmJiByZXN1bHQuZWZmZWN0Py50eXBlID09PSBMaXN0RHJhZ092ZXJFZmZlY3RUeXBlLkNvcHkpID8gJ2NvcHknIDogJ21vdmUnO1xuXG5cdFx0bGV0IGZlZWRiYWNrOiBudW1iZXJbXTtcblxuXHRcdGlmICh0eXBlb2YgcmVzdWx0ICE9PSAnYm9vbGVhbicgJiYgcmVzdWx0LmZlZWRiYWNrKSB7XG5cdFx0XHRmZWVkYmFjayA9IHJlc3VsdC5mZWVkYmFjaztcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHR5cGVvZiBldmVudC5pbmRleCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0ZmVlZGJhY2sgPSBbLTFdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZmVlZGJhY2sgPSBbZXZlbnQuaW5kZXhdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHNhbml0aXplIGZlZWRiYWNrIGxpc3Rcblx0XHRmZWVkYmFjayA9IGRpc3RpbmN0KGZlZWRiYWNrKS5maWx0ZXIoaSA9PiBpID49IC0xICYmIGkgPCB0aGlzLmxlbmd0aCkuc29ydCgoYSwgYikgPT4gYSAtIGIpO1xuXHRcdGZlZWRiYWNrID0gZmVlZGJhY2tbMF0gPT09IC0xID8gWy0xXSA6IGZlZWRiYWNrO1xuXG5cdFx0bGV0IGRyYWdPdmVyRWZmZWN0UG9zaXRpb24gPSB0eXBlb2YgcmVzdWx0ICE9PSAnYm9vbGVhbicgJiYgcmVzdWx0LmVmZmVjdCAmJiByZXN1bHQuZWZmZWN0LnBvc2l0aW9uID8gcmVzdWx0LmVmZmVjdC5wb3NpdGlvbiA6IExpc3REcmFnT3ZlckVmZmVjdFBvc2l0aW9uLk92ZXI7XG5cblx0XHRpZiAoZXF1YWxzRHJhZ0ZlZWRiYWNrKHRoaXMuY3VycmVudERyYWdGZWVkYmFjaywgZmVlZGJhY2spICYmIHRoaXMuY3VycmVudERyYWdGZWVkYmFja1Bvc2l0aW9uID09PSBkcmFnT3ZlckVmZmVjdFBvc2l0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHR0aGlzLmN1cnJlbnREcmFnRmVlZGJhY2sgPSBmZWVkYmFjaztcblx0XHR0aGlzLmN1cnJlbnREcmFnRmVlZGJhY2tQb3NpdGlvbiA9IGRyYWdPdmVyRWZmZWN0UG9zaXRpb247XG5cdFx0dGhpcy5jdXJyZW50RHJhZ0ZlZWRiYWNrRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cblx0XHRpZiAoZmVlZGJhY2tbMF0gPT09IC0xKSB7IC8vIGVudGlyZSBsaXN0IGZlZWRiYWNrXG5cdFx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LmFkZChkcmFnT3ZlckVmZmVjdFBvc2l0aW9uKTtcblx0XHRcdHRoaXMucm93c0NvbnRhaW5lci5jbGFzc0xpc3QuYWRkKGRyYWdPdmVyRWZmZWN0UG9zaXRpb24pO1xuXHRcdFx0dGhpcy5jdXJyZW50RHJhZ0ZlZWRiYWNrRGlzcG9zYWJsZSA9IHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKGRyYWdPdmVyRWZmZWN0UG9zaXRpb24pO1xuXHRcdFx0XHR0aGlzLnJvd3NDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShkcmFnT3ZlckVmZmVjdFBvc2l0aW9uKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cblx0XHRcdGlmIChmZWVkYmFjay5sZW5ndGggPiAxICYmIGRyYWdPdmVyRWZmZWN0UG9zaXRpb24gIT09IExpc3REcmFnT3ZlckVmZmVjdFBvc2l0aW9uLk92ZXIpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IHVzZSBtdWx0aXBsZSBmZWVkYmFja3Mgd2l0aCBwb3NpdGlvbiBkaWZmZXJlbnQgdGhhbiBcXCdvdmVyXFwnJyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1ha2Ugc3VyZSB0aGVyZSBpcyBubyBmbGlja2VyIHdoZW4gbW92aW5nIGJldHdlZW4gdHdvIGl0ZW1zXG5cdFx0XHQvLyBBbHdheXMgdXNlIHRoZSBiZWZvcmUgZmVlZGJhY2sgaWYgcG9zc2libGVcblx0XHRcdGlmIChkcmFnT3ZlckVmZmVjdFBvc2l0aW9uID09PSBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbi5BZnRlcikge1xuXHRcdFx0XHRpZiAoZmVlZGJhY2tbMF0gPCB0aGlzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHRmZWVkYmFja1swXSArPSAxO1xuXHRcdFx0XHRcdGRyYWdPdmVyRWZmZWN0UG9zaXRpb24gPSBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbi5CZWZvcmU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBpbmRleCBvZiBmZWVkYmFjaykge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gdGhpcy5pdGVtc1tpbmRleF0hO1xuXHRcdFx0XHRpdGVtLmRyb3BUYXJnZXQgPSB0cnVlO1xuXG5cdFx0XHRcdGl0ZW0ucm93Py5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoZHJhZ092ZXJFZmZlY3RQb3NpdGlvbik7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuY3VycmVudERyYWdGZWVkYmFja0Rpc3Bvc2FibGUgPSB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGluZGV4IG9mIGZlZWRiYWNrKSB7XG5cdFx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuaXRlbXNbaW5kZXhdITtcblx0XHRcdFx0XHRpdGVtLmRyb3BUYXJnZXQgPSBmYWxzZTtcblxuXHRcdFx0XHRcdGl0ZW0ucm93Py5kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoZHJhZ092ZXJFZmZlY3RQb3NpdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRyYWdMZWF2ZShldmVudDogSUxpc3REcmFnRXZlbnQ8VD4pOiB2b2lkIHtcblx0XHR0aGlzLm9uRHJhZ0xlYXZlVGltZW91dC5kaXNwb3NlKCk7XG5cdFx0dGhpcy5vbkRyYWdMZWF2ZVRpbWVvdXQgPSBkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB0aGlzLmNsZWFyRHJhZ092ZXJGZWVkYmFjaygpLCAxMDAsIHRoaXMuZGlzcG9zYWJsZXMpO1xuXHRcdGlmICh0aGlzLmN1cnJlbnREcmFnRGF0YSkge1xuXHRcdFx0dGhpcy5kbmQub25EcmFnTGVhdmU/Lih0aGlzLmN1cnJlbnREcmFnRGF0YSwgZXZlbnQuZWxlbWVudCwgZXZlbnQuaW5kZXgsIGV2ZW50LmJyb3dzZXJFdmVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRyb3AoZXZlbnQ6IElMaXN0RHJhZ0V2ZW50PFQ+KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmNhbkRyb3ApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkcmFnRGF0YSA9IHRoaXMuY3VycmVudERyYWdEYXRhO1xuXHRcdHRoaXMudGVhcmRvd25EcmFnQW5kRHJvcFNjcm9sbFRvcEFuaW1hdGlvbigpO1xuXHRcdHRoaXMuY2xlYXJEcmFnT3ZlckZlZWRiYWNrKCk7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdnaW5nJyk7XG5cdFx0dGhpcy5jdXJyZW50RHJhZ0RhdGEgPSB1bmRlZmluZWQ7XG5cdFx0U3RhdGljRE5ELkN1cnJlbnREcmFnQW5kRHJvcERhdGEgPSB1bmRlZmluZWQ7XG5cblx0XHRpZiAoIWRyYWdEYXRhIHx8ICFldmVudC5icm93c2VyRXZlbnQuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZXZlbnQuYnJvd3NlckV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZHJhZ0RhdGEudXBkYXRlKGV2ZW50LmJyb3dzZXJFdmVudC5kYXRhVHJhbnNmZXIpO1xuXHRcdHRoaXMuZG5kLmRyb3AoZHJhZ0RhdGEsIGV2ZW50LmVsZW1lbnQsIGV2ZW50LmluZGV4LCBldmVudC5zZWN0b3IsIGV2ZW50LmJyb3dzZXJFdmVudCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRHJhZ0VuZChldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5jYW5Ecm9wID0gZmFsc2U7XG5cdFx0dGhpcy50ZWFyZG93bkRyYWdBbmREcm9wU2Nyb2xsVG9wQW5pbWF0aW9uKCk7XG5cdFx0dGhpcy5jbGVhckRyYWdPdmVyRmVlZGJhY2soKTtcblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dpbmcnKTtcblx0XHR0aGlzLmN1cnJlbnREcmFnRGF0YSA9IHVuZGVmaW5lZDtcblx0XHRTdGF0aWNETkQuQ3VycmVudERyYWdBbmREcm9wRGF0YSA9IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuZG5kLm9uRHJhZ0VuZD8uKGV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJEcmFnT3ZlckZlZWRiYWNrKCk6IHZvaWQge1xuXHRcdHRoaXMuY3VycmVudERyYWdGZWVkYmFjayA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmN1cnJlbnREcmFnRmVlZGJhY2tQb3NpdGlvbiA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmN1cnJlbnREcmFnRmVlZGJhY2tEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmN1cnJlbnREcmFnRmVlZGJhY2tEaXNwb3NhYmxlID0gRGlzcG9zYWJsZS5Ob25lO1xuXHR9XG5cblx0Ly8gRE5EIHNjcm9sbCB0b3AgYW5pbWF0aW9uXG5cblx0cHJpdmF0ZSBzZXR1cERyYWdBbmREcm9wU2Nyb2xsVG9wQW5pbWF0aW9uKGV2ZW50OiBEcmFnRXZlbnQgfCBNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmRyYWdPdmVyQW5pbWF0aW9uRGlzcG9zYWJsZSkge1xuXHRcdFx0Y29uc3Qgdmlld1RvcCA9IGdldFRvcExlZnRPZmZzZXQodGhpcy5kb21Ob2RlKS50b3A7XG5cdFx0XHR0aGlzLmRyYWdPdmVyQW5pbWF0aW9uRGlzcG9zYWJsZSA9IGFuaW1hdGUoZ2V0V2luZG93KHRoaXMuZG9tTm9kZSksIHRoaXMuYW5pbWF0ZURyYWdBbmREcm9wU2Nyb2xsVG9wLmJpbmQodGhpcywgdmlld1RvcCkpO1xuXHRcdH1cblxuXHRcdHRoaXMuZHJhZ092ZXJBbmltYXRpb25TdG9wRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5kcmFnT3ZlckFuaW1hdGlvblN0b3BEaXNwb3NhYmxlID0gZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuZHJhZ092ZXJBbmltYXRpb25EaXNwb3NhYmxlKSB7XG5cdFx0XHRcdHRoaXMuZHJhZ092ZXJBbmltYXRpb25EaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5kcmFnT3ZlckFuaW1hdGlvbkRpc3Bvc2FibGUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSwgMTAwMCwgdGhpcy5kaXNwb3NhYmxlcyk7XG5cblx0XHR0aGlzLmRyYWdPdmVyTW91c2VZID0gZXZlbnQucGFnZVk7XG5cdH1cblxuXHRwcml2YXRlIGFuaW1hdGVEcmFnQW5kRHJvcFNjcm9sbFRvcCh2aWV3VG9wOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5kcmFnT3Zlck1vdXNlWSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlmZiA9IHRoaXMuZHJhZ092ZXJNb3VzZVkgLSB2aWV3VG9wO1xuXHRcdGNvbnN0IHVwcGVyTGltaXQgPSB0aGlzLnJlbmRlckhlaWdodCAtIDM1O1xuXG5cdFx0aWYgKGRpZmYgPCAzNSkge1xuXHRcdFx0dGhpcy5zY3JvbGxUb3AgKz0gTWF0aC5tYXgoLTE0LCBNYXRoLmZsb29yKDAuMyAqIChkaWZmIC0gMzUpKSk7XG5cdFx0fSBlbHNlIGlmIChkaWZmID4gdXBwZXJMaW1pdCkge1xuXHRcdFx0dGhpcy5zY3JvbGxUb3AgKz0gTWF0aC5taW4oMTQsIE1hdGguZmxvb3IoMC4zICogKGRpZmYgLSB1cHBlckxpbWl0KSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdGVhcmRvd25EcmFnQW5kRHJvcFNjcm9sbFRvcEFuaW1hdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLmRyYWdPdmVyQW5pbWF0aW9uU3RvcERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXG5cdFx0aWYgKHRoaXMuZHJhZ092ZXJBbmltYXRpb25EaXNwb3NhYmxlKSB7XG5cdFx0XHR0aGlzLmRyYWdPdmVyQW5pbWF0aW9uRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmRyYWdPdmVyQW5pbWF0aW9uRGlzcG9zYWJsZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHQvLyBVdGlsXG5cblx0cHJpdmF0ZSBnZXRUYXJnZXRTZWN0b3IoYnJvd3NlckV2ZW50OiBEcmFnRXZlbnQsIHRhcmdldEluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQpOiBMaXN0Vmlld1RhcmdldFNlY3RvciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRhcmdldEluZGV4ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVsYXRpdmVQb3NpdGlvbiA9IGJyb3dzZXJFdmVudC5vZmZzZXRZIC8gdGhpcy5pdGVtc1t0YXJnZXRJbmRleF0uc2l6ZTtcblx0XHRjb25zdCBzZWN0b3IgPSBNYXRoLmZsb29yKHJlbGF0aXZlUG9zaXRpb24gLyAwLjI1KTtcblx0XHRyZXR1cm4gY2xhbXAoc2VjdG9yLCAwLCAzKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0SXRlbUluZGV4RnJvbUV2ZW50VGFyZ2V0KHRhcmdldDogRXZlbnRUYXJnZXQgfCBudWxsKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBzY3JvbGxhYmxlRWxlbWVudCA9IHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0RG9tTm9kZSgpO1xuXHRcdGxldCBlbGVtZW50OiBIVE1MRWxlbWVudCB8IFNWR0VsZW1lbnQgfCBudWxsID0gdGFyZ2V0IGFzIChIVE1MRWxlbWVudCB8IFNWR0VsZW1lbnQgfCBudWxsKTtcblxuXHRcdHdoaWxlICgoaXNIVE1MRWxlbWVudChlbGVtZW50KSB8fCBpc1NWR0VsZW1lbnQoZWxlbWVudCkpICYmIGVsZW1lbnQgIT09IHRoaXMucm93c0NvbnRhaW5lciAmJiBzY3JvbGxhYmxlRWxlbWVudC5jb250YWlucyhlbGVtZW50KSkge1xuXHRcdFx0Y29uc3QgcmF3SW5kZXggPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1pbmRleCcpO1xuXG5cdFx0XHRpZiAocmF3SW5kZXgpIHtcblx0XHRcdFx0Y29uc3QgaW5kZXggPSBOdW1iZXIocmF3SW5kZXgpO1xuXG5cdFx0XHRcdGlmICghaXNOYU4oaW5kZXgpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGluZGV4O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudEVsZW1lbnQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VmlzaWJsZVJhbmdlKHJlbmRlclRvcDogbnVtYmVyLCByZW5kZXJIZWlnaHQ6IG51bWJlcik6IElSYW5nZSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXJ0OiB0aGlzLnJhbmdlTWFwLmluZGV4QXQocmVuZGVyVG9wKSxcblx0XHRcdGVuZDogdGhpcy5yYW5nZU1hcC5pbmRleEFmdGVyKHJlbmRlclRvcCArIHJlbmRlckhlaWdodCAtIDEpXG5cdFx0fTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRSZW5kZXJSYW5nZShyZW5kZXJUb3A6IG51bWJlciwgcmVuZGVySGVpZ2h0OiBudW1iZXIpOiBJUmFuZ2Uge1xuXHRcdGNvbnN0IHJhbmdlID0gdGhpcy5nZXRWaXNpYmxlUmFuZ2UocmVuZGVyVG9wLCByZW5kZXJIZWlnaHQpO1xuXHRcdGlmICh0aGlzLmN1cnJlbnRTZWxlY3Rpb25Cb3VuZHMpIHtcblx0XHRcdGNvbnN0IG1heCA9IHRoaXMucmFuZ2VNYXAuY291bnQ7XG5cdFx0XHRyYW5nZS5zdGFydCA9IE1hdGgubWluKHJhbmdlLnN0YXJ0LCB0aGlzLmN1cnJlbnRTZWxlY3Rpb25Cb3VuZHMuc3RhcnQsIG1heCk7XG5cdFx0XHRyYW5nZS5lbmQgPSBNYXRoLm1pbihNYXRoLm1heChyYW5nZS5lbmQsIHRoaXMuY3VycmVudFNlbGVjdGlvbkJvdW5kcy5lbmQgKyAxKSwgbWF4KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmFuZ2U7XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYSBzdGFibGUgcmVuZGVyZWQgc3RhdGUsIGNoZWNrcyBldmVyeSByZW5kZXJlZCBlbGVtZW50IHdoZXRoZXIgaXQgbmVlZHNcblx0ICogdG8gYmUgcHJvYmVkIGZvciBkeW5hbWljIGhlaWdodC4gQWRqdXN0cyBzY3JvbGwgaGVpZ2h0IGFuZCB0b3AgaWYgbmVjZXNzYXJ5LlxuXHQgKi9cblx0cHJvdGVjdGVkIF9yZXJlbmRlcihyZW5kZXJUb3A6IG51bWJlciwgcmVuZGVySGVpZ2h0OiBudW1iZXIsIGluU21vb3RoU2Nyb2xsaW5nPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IHByZXZpb3VzUmVuZGVyUmFuZ2UgPSB0aGlzLmdldFJlbmRlclJhbmdlKHJlbmRlclRvcCwgcmVuZGVySGVpZ2h0KTtcblxuXHRcdC8vIExldCdzIHJlbWVtYmVyIHRoZSBzZWNvbmQgZWxlbWVudCdzIHBvc2l0aW9uLCB0aGlzIGhlbHBzIGluIHNjcm9sbGluZyB1cFxuXHRcdC8vIGFuZCBwcmVzZXJ2aW5nIGEgbGluZWFyIHVwd2FyZHMgc2Nyb2xsIG1vdmVtZW50XG5cdFx0bGV0IGFuY2hvckVsZW1lbnRJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBhbmNob3JFbGVtZW50VG9wRGVsdGE6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRcdGlmIChyZW5kZXJUb3AgPT09IHRoaXMuZWxlbWVudFRvcChwcmV2aW91c1JlbmRlclJhbmdlLnN0YXJ0KSkge1xuXHRcdFx0YW5jaG9yRWxlbWVudEluZGV4ID0gcHJldmlvdXNSZW5kZXJSYW5nZS5zdGFydDtcblx0XHRcdGFuY2hvckVsZW1lbnRUb3BEZWx0YSA9IDA7XG5cdFx0fSBlbHNlIGlmIChwcmV2aW91c1JlbmRlclJhbmdlLmVuZCAtIHByZXZpb3VzUmVuZGVyUmFuZ2Uuc3RhcnQgPiAxKSB7XG5cdFx0XHRhbmNob3JFbGVtZW50SW5kZXggPSBwcmV2aW91c1JlbmRlclJhbmdlLnN0YXJ0ICsgMTtcblx0XHRcdGFuY2hvckVsZW1lbnRUb3BEZWx0YSA9IHRoaXMuZWxlbWVudFRvcChhbmNob3JFbGVtZW50SW5kZXgpIC0gcmVuZGVyVG9wO1xuXHRcdH1cblxuXHRcdGxldCBoZWlnaHREaWZmID0gMDtcblxuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRjb25zdCByZW5kZXJSYW5nZSA9IHRoaXMuZ2V0UmVuZGVyUmFuZ2UocmVuZGVyVG9wLCByZW5kZXJIZWlnaHQpO1xuXG5cdFx0XHRsZXQgZGlkQ2hhbmdlID0gZmFsc2U7XG5cblx0XHRcdGZvciAobGV0IGkgPSByZW5kZXJSYW5nZS5zdGFydDsgaSA8IHJlbmRlclJhbmdlLmVuZDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGRpZmYgPSB0aGlzLnByb2JlRHluYW1pY0hlaWdodChpKTtcblxuXHRcdFx0XHRpZiAoZGlmZiAhPT0gMCkge1xuXHRcdFx0XHRcdHRoaXMucmFuZ2VNYXAuc3BsaWNlKGksIDEsIFt0aGlzLml0ZW1zW2ldXSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRoZWlnaHREaWZmICs9IGRpZmY7XG5cdFx0XHRcdGRpZENoYW5nZSA9IGRpZENoYW5nZSB8fCBkaWZmICE9PSAwO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWRpZENoYW5nZSkge1xuXHRcdFx0XHRpZiAoaGVpZ2h0RGlmZiAhPT0gMCkge1xuXHRcdFx0XHRcdHRoaXMuZXZlbnR1YWxseVVwZGF0ZVNjcm9sbERpbWVuc2lvbnMoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHVucmVuZGVyUmFuZ2VzID0gUmFuZ2UucmVsYXRpdmVDb21wbGVtZW50KHByZXZpb3VzUmVuZGVyUmFuZ2UsIHJlbmRlclJhbmdlKTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIHVucmVuZGVyUmFuZ2VzKSB7XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IHJhbmdlLnN0YXJ0OyBpIDwgcmFuZ2UuZW5kOyBpKyspIHtcblx0XHRcdFx0XHRcdGlmICh0aGlzLml0ZW1zW2ldLnJvdykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUl0ZW1Gcm9tRE9NKGkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHJlbmRlclJhbmdlcyA9IFJhbmdlLnJlbGF0aXZlQ29tcGxlbWVudChyZW5kZXJSYW5nZSwgcHJldmlvdXNSZW5kZXJSYW5nZSkucmV2ZXJzZSgpO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgcmVuZGVyUmFuZ2VzKSB7XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IHJhbmdlLmVuZCAtIDE7IGkgPj0gcmFuZ2Uuc3RhcnQ7IGktLSkge1xuXHRcdFx0XHRcdFx0dGhpcy5pbnNlcnRJdGVtSW5ET00oaSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Zm9yIChsZXQgaSA9IHJlbmRlclJhbmdlLnN0YXJ0OyBpIDwgcmVuZGVyUmFuZ2UuZW5kOyBpKyspIHtcblx0XHRcdFx0XHRpZiAodGhpcy5pdGVtc1tpXS5yb3cpIHtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlSXRlbUluRE9NKHRoaXMuaXRlbXNbaV0sIGkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0eXBlb2YgYW5jaG9yRWxlbWVudEluZGV4ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdC8vIFRvIGNvbXB1dGUgYSBkZXN0aW5hdGlvbiBzY3JvbGwgdG9wLCB3ZSBuZWVkIHRvIHRha2UgaW50byBhY2NvdW50IHRoZSBjdXJyZW50IHNtb290aCBzY3JvbGxpbmdcblx0XHRcdFx0XHQvLyBhbmltYXRpb24sIGFuZCB0aGVuIHJldXNlIGl0IHdpdGggYSBuZXcgdGFyZ2V0ICh0byBhdm9pZCBwcm9sb25naW5nIHRoZSBzY3JvbGwpXG5cdFx0XHRcdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDQxNDRcblx0XHRcdFx0XHQvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvcHVsbC8xMDQyODRcblx0XHRcdFx0XHQvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwNzcwNFxuXHRcdFx0XHRcdGNvbnN0IGRlbHRhU2Nyb2xsVG9wID0gdGhpcy5zY3JvbGxhYmxlLmdldEZ1dHVyZVNjcm9sbFBvc2l0aW9uKCkuc2Nyb2xsVG9wIC0gcmVuZGVyVG9wO1xuXHRcdFx0XHRcdGNvbnN0IG5ld1Njcm9sbFRvcCA9IHRoaXMuZWxlbWVudFRvcChhbmNob3JFbGVtZW50SW5kZXgpIC0gYW5jaG9yRWxlbWVudFRvcERlbHRhISArIGRlbHRhU2Nyb2xsVG9wO1xuXHRcdFx0XHRcdHRoaXMuc2V0U2Nyb2xsVG9wKG5ld1Njcm9sbFRvcCwgaW5TbW9vdGhTY3JvbGxpbmcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0LmZpcmUodGhpcy5jb250ZW50SGVpZ2h0KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcHJvYmVEeW5hbWljSGVpZ2h0KGluZGV4OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGNvbnN0IGl0ZW0gPSB0aGlzLml0ZW1zW2luZGV4XTtcblxuXHRcdGlmICghIXRoaXMudmlydHVhbERlbGVnYXRlLmdldER5bmFtaWNIZWlnaHQpIHtcblx0XHRcdGNvbnN0IG5ld1NpemUgPSB0aGlzLnZpcnR1YWxEZWxlZ2F0ZS5nZXREeW5hbWljSGVpZ2h0KGl0ZW0uZWxlbWVudCk7XG5cdFx0XHRpZiAobmV3U2l6ZSAhPT0gbnVsbCkge1xuXHRcdFx0XHRjb25zdCBzaXplID0gaXRlbS5zaXplO1xuXHRcdFx0XHRpdGVtLnNpemUgPSBuZXdTaXplO1xuXHRcdFx0XHRpdGVtLmxhc3REeW5hbWljSGVpZ2h0V2lkdGggPSB0aGlzLnJlbmRlcldpZHRoO1xuXHRcdFx0XHRyZXR1cm4gbmV3U2l6ZSAtIHNpemU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFpdGVtLmhhc0R5bmFtaWNIZWlnaHQgfHwgaXRlbS5sYXN0RHluYW1pY0hlaWdodFdpZHRoID09PSB0aGlzLnJlbmRlcldpZHRoKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRpZiAoISF0aGlzLnZpcnR1YWxEZWxlZ2F0ZS5oYXNEeW5hbWljSGVpZ2h0ICYmICF0aGlzLnZpcnR1YWxEZWxlZ2F0ZS5oYXNEeW5hbWljSGVpZ2h0KGl0ZW0uZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNpemUgPSBpdGVtLnNpemU7XG5cblx0XHRpZiAoaXRlbS5yb3cpIHtcblx0XHRcdGl0ZW0ucm93LmRvbU5vZGUuc3R5bGUuaGVpZ2h0ID0gJyc7XG5cdFx0XHRpdGVtLnNpemUgPSBpdGVtLnJvdy5kb21Ob2RlLm9mZnNldEhlaWdodDtcblx0XHRcdGlmIChpdGVtLnNpemUgPT09IDAgJiYgIWlzQW5jZXN0b3IoaXRlbS5yb3cuZG9tTm9kZSwgZ2V0V2luZG93KGl0ZW0ucm93LmRvbU5vZGUpLmRvY3VtZW50LmJvZHkpKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybignTWVhc3VyaW5nIGl0ZW0gbm9kZSB0aGF0IGlzIG5vdCBpbiBET00hIEFkZCBMaXN0VmlldyB0byB0aGUgRE9NIGJlZm9yZSBtZWFzdXJpbmcgcm93IGhlaWdodCEnLCBuZXcgRXJyb3IoKS5zdGFjayk7XG5cdFx0XHR9XG5cdFx0XHRpdGVtLmxhc3REeW5hbWljSGVpZ2h0V2lkdGggPSB0aGlzLnJlbmRlcldpZHRoO1xuXHRcdFx0cmV0dXJuIGl0ZW0uc2l6ZSAtIHNpemU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyByb3cgfSA9IHRoaXMuY2FjaGUuYWxsb2MoaXRlbS50ZW1wbGF0ZUlkKTtcblx0XHRyb3cuZG9tTm9kZS5zdHlsZS5oZWlnaHQgPSAnJztcblx0XHR0aGlzLnJvd3NDb250YWluZXIuYXBwZW5kQ2hpbGQocm93LmRvbU5vZGUpO1xuXG5cdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLnJlbmRlcmVycy5nZXQoaXRlbS50ZW1wbGF0ZUlkKTtcblxuXHRcdGlmICghcmVuZGVyZXIpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ01pc3NpbmcgcmVuZGVyZXIgZm9yIHRlbXBsYXRlSWQ6ICcgKyBpdGVtLnRlbXBsYXRlSWQpO1xuXHRcdH1cblxuXHRcdHJlbmRlcmVyLnJlbmRlckVsZW1lbnQoaXRlbS5lbGVtZW50LCBpbmRleCwgcm93LnRlbXBsYXRlRGF0YSwgdW5kZWZpbmVkKTtcblx0XHRpdGVtLnNpemUgPSByb3cuZG9tTm9kZS5vZmZzZXRIZWlnaHQ7XG5cdFx0cmVuZGVyZXIuZGlzcG9zZUVsZW1lbnQ/LihpdGVtLmVsZW1lbnQsIGluZGV4LCByb3cudGVtcGxhdGVEYXRhLCB1bmRlZmluZWQpO1xuXG5cdFx0dGhpcy52aXJ0dWFsRGVsZWdhdGUuc2V0RHluYW1pY0hlaWdodD8uKGl0ZW0uZWxlbWVudCwgaXRlbS5zaXplKTtcblxuXHRcdGl0ZW0ubGFzdER5bmFtaWNIZWlnaHRXaWR0aCA9IHRoaXMucmVuZGVyV2lkdGg7XG5cdFx0cm93LmRvbU5vZGUucmVtb3ZlKCk7XG5cdFx0dGhpcy5jYWNoZS5yZWxlYXNlKHJvdyk7XG5cblx0XHRyZXR1cm4gaXRlbS5zaXplIC0gc2l6ZTtcblx0fVxuXG5cdGdldEVsZW1lbnREb21JZChpbmRleDogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7dGhpcy5kb21JZH1fJHtpbmRleH1gO1xuXHR9XG5cblx0Ly8gRGlzcG9zZVxuXG5cdGRpc3Bvc2UoKSB7XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIHRoaXMuaXRlbXMpIHtcblx0XHRcdGl0ZW0uZHJhZ1N0YXJ0RGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRpdGVtLmNoZWNrZWREaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblxuXHRcdFx0aWYgKGl0ZW0ucm93KSB7XG5cdFx0XHRcdGNvbnN0IHJlbmRlcmVyID0gdGhpcy5yZW5kZXJlcnMuZ2V0KGl0ZW0ucm93LnRlbXBsYXRlSWQpO1xuXHRcdFx0XHRpZiAocmVuZGVyZXIpIHtcblx0XHRcdFx0XHRyZW5kZXJlci5kaXNwb3NlRWxlbWVudD8uKGl0ZW0uZWxlbWVudCwgLTEsIGl0ZW0ucm93LnRlbXBsYXRlRGF0YSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRyZW5kZXJlci5kaXNwb3NlVGVtcGxhdGUoaXRlbS5yb3cudGVtcGxhdGVEYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuaXRlbXMgPSBbXTtcblxuXHRcdHRoaXMuZG9tTm9kZT8ucmVtb3ZlKCk7XG5cblx0XHR0aGlzLmRyYWdPdmVyQW5pbWF0aW9uRGlzcG9zYWJsZT8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBS0EsU0FBUyxxQkFBdUM7QUFDaEQsU0FBUyx1QkFBdUIsU0FBb0Isa0JBQWtCLGtCQUFrQixpQkFBaUIsYUFBYSxrQkFBa0IsV0FBVyxZQUFZLGVBQWUsY0FBYyxvQ0FBb0M7QUFDaE8sU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxhQUFhLGdCQUFnQixlQUE2QjtBQUNuRSxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLFVBQVUsUUFBUSxjQUFjO0FBQ3pDLFNBQVMsU0FBUyx5QkFBeUI7QUFDM0MsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyxhQUFvQztBQUN0RCxTQUFTLFlBQVksaUJBQThCLG9CQUFvQjtBQUN2RSxTQUFpQixhQUFhO0FBQzlCLFNBQStCLFlBQVksMkJBQXdDO0FBRW5GLFNBQXFJLDRCQUE0Qiw4QkFBOEI7QUFDL0wsU0FBb0IsVUFBVSxhQUFhO0FBQzNDLFNBQWUsZ0JBQWdCO0FBQy9CLFNBQVMsMEJBQTBCO0FBR25DLFNBQVMsYUFBYTtBQUN0QixTQUFTLHNCQUFzQjtBQWtCL0IsTUFBTSxZQUFZO0FBQUEsRUFDakIsd0JBQXdCO0FBQ3pCO0FBTU8sSUFB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UztBQUN2RSxTQUFLLE9BQU8sSUFBSSxRQUFRO0FBQ3hCLGFBQVMsaUJBQWlCLEtBQUssU0FBUyxPQUFPLElBQUksY0FBYyxNQUFTO0FBRTFFLFNBQUssZ0JBQWdCLG1CQUFtQixLQUFLLFNBQVMsS0FBSyxJQUFJO0FBRS9ELFNBQUsseUJBQXlCLEtBQUs7QUFDbkMsUUFBSSxRQUFRLE9BQU87QUFDbkIsU0FBSyxNQUFNLFFBQVEsR0FBRztBQUV0QixXQUFPLEtBQUssT0FBTztBQUFBLEVBQ3BCO0FBQUEsRUFFQSxnQkFBZ0IsT0FBdUI7QUFDdEMsV0FBTyxHQUFHLEtBQUssS0FBSyxJQUFJLEtBQUs7QUFBQSxFQUM5QjtBQUFBO0FBQUEsRUFJQSxVQUFVO0FBQ1QsZUFBVyxRQUFRLEtBQUssT0FBTztBQUM5QixXQUFLLG9CQUFvQixRQUFRO0FBQ2pDLFdBQUssa0JBQWtCLFFBQVE7QUFFL0IsVUFBSSxLQUFLLEtBQUs7QUFDYixjQUFNLFdBQVcsS0FBSyxVQUFVLElBQUksS0FBSyxJQUFJLFVBQVU7QUFDdkQsWUFBSSxVQUFVO0FBQ2IsbUJBQVMsaUJBQWlCLEtBQUssU0FBUyxJQUFJLEtBQUssSUFBSSxjQUFjLE1BQVM7QUFDNUUsbUJBQVMsZ0JBQWdCLEtBQUssSUFBSSxZQUFZO0FBQUEsUUFDL0M7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFNBQUssUUFBUSxDQUFDO0FBRWQsU0FBSyxTQUFTLE9BQU87QUFFckIsU0FBSyw2QkFBNkIsUUFBUTtBQUMxQyxTQUFLLFlBQVksUUFBUTtBQUFBLEVBQzFCO0FBQ0Q7QUE3M0NhLFVBRUcsZ0JBQWdCO0FBb3pCbEI7QUFBQSxFQUFaO0FBQUEsR0F0ekJXLFVBc3pCQztBQUNBO0FBQUEsRUFBWjtBQUFBLEdBdnpCVyxVQXV6QkM7QUFDQTtBQUFBLEVBQVo7QUFBQSxHQXh6QlcsVUF3ekJDO0FBQ0E7QUFBQSxFQUFaO0FBQUEsR0F6ekJXLFVBeXpCQztBQUNBO0FBQUEsRUFBWjtBQUFBLEdBMXpCVyxVQTB6QkM7QUFDQTtBQUFBLEVBQVo7QUFBQSxHQTN6QlcsVUEyekJDO0FBQ0E7QUFBQSxFQUFaO0FBQUEsR0E1ekJXLFVBNHpCQztBQUNBO0FBQUEsRUFBWjtBQUFBLEdBN3pCVyxVQTZ6QkM7QUFDQTtBQUFBLEVBQVo7QUFBQSxHQTl6QlcsVUE4ekJDO0FBQ0E7QUFBQSxFQUFaO0FBQUEsR0EvekJXLFVBK3pCQztBQUNBO0FBQUEsRUFBWjtBQUFBLEdBaDBCVyxVQWcwQkM7QUFoMEJQLElBQU0sV0FBTjsiLAogICJuYW1lcyI6IFsiTGlzdFZpZXdUYXJnZXRTZWN0b3IiLCAiY2hlY2tlZCIsICJlIiwgInNpemUiXQp9Cg==
