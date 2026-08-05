import { isFirefox } from "../../browser.js";
import { DataTransfers } from "../../dnd.js";
import { $, addDisposableListener, append, clearNode, EventHelper, EventType, getWindow, isHTMLElement, trackFocus } from "../../dom.js";
import { DomEmitter } from "../../event.js";
import { StandardKeyboardEvent } from "../../keyboardEvent.js";
import { Gesture, EventType as TouchEventType } from "../../touch.js";
import { Orientation } from "../sash/sash.js";
import { Color, RGBA } from "../../../common/color.js";
import { Emitter, Event } from "../../../common/event.js";
import { KeyCode } from "../../../common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../common/lifecycle.js";
import "./paneview.css";
import { localize } from "../../../../nls.js";
import { Sizing, SplitView } from "./splitview.js";
import { applyDragImage } from "../dnd/dnd.js";
const _Pane = class _Pane extends Disposable {
  constructor(options) {
    super();
    this.expandedSize = void 0;
    this._headerVisible = true;
    this._collapsible = true;
    this._bodyRendered = false;
    this.styles = {
      dropBackground: void 0,
      headerBackground: void 0,
      headerBorder: void 0,
      headerForeground: void 0,
      leftBorder: void 0
    };
    this.animationTimer = void 0;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._onDidChangeExpansionState = this._register(new Emitter());
    this.onDidChangeExpansionState = this._onDidChangeExpansionState.event;
    this.orthogonalSize = 0;
    this._expanded = typeof options.expanded === "undefined" ? true : !!options.expanded;
    this._orientation = typeof options.orientation === "undefined" ? Orientation.VERTICAL : options.orientation;
    this._ariaHeaderLabel = this.getAriaHeaderLabel(options.title);
    this._minimumBodySize = typeof options.minimumBodySize === "number" ? options.minimumBodySize : this._orientation === Orientation.HORIZONTAL ? 200 : 120;
    this._maximumBodySize = typeof options.maximumBodySize === "number" ? options.maximumBodySize : Number.POSITIVE_INFINITY;
    this.element = $(".pane");
  }
  get ariaHeaderLabel() {
    return this._ariaHeaderLabel;
  }
  set ariaHeaderLabel(newLabel) {
    this._ariaHeaderLabel = newLabel;
    this.header?.setAttribute("aria-label", this.ariaHeaderLabel);
  }
  get draggableElement() {
    return this.header;
  }
  get dropTargetElement() {
    return this.element;
  }
  get dropBackground() {
    return this.styles.dropBackground;
  }
  get minimumBodySize() {
    return this._minimumBodySize;
  }
  set minimumBodySize(size) {
    this._minimumBodySize = size;
    this._onDidChange.fire(void 0);
  }
  get maximumBodySize() {
    return this._maximumBodySize;
  }
  set maximumBodySize(size) {
    this._maximumBodySize = size;
    this._onDidChange.fire(void 0);
  }
  get headerSize() {
    return this.headerVisible ? _Pane.HEADER_SIZE : 0;
  }
  get minimumSize() {
    const headerSize = this.headerSize;
    const expanded = !this.headerVisible || this.isExpanded();
    const minimumBodySize = expanded ? this.minimumBodySize : 0;
    return headerSize + minimumBodySize;
  }
  get maximumSize() {
    const headerSize = this.headerSize;
    const expanded = !this.headerVisible || this.isExpanded();
    const maximumBodySize = expanded ? this.maximumBodySize : 0;
    return headerSize + maximumBodySize;
  }
  getAriaHeaderLabel(title) {
    return localize("viewSection", "{0} Section", title);
  }
  isExpanded() {
    return this._expanded;
  }
  setExpanded(expanded) {
    if (!expanded && !this.collapsible) {
      return false;
    }
    if (this._expanded === !!expanded) {
      return false;
    }
    this.element?.classList.toggle("expanded", expanded);
    this._expanded = !!expanded;
    this.updateHeader();
    if (expanded) {
      if (!this._bodyRendered) {
        this.renderBody(this.body);
        this._bodyRendered = true;
      }
      if (typeof this.animationTimer === "number") {
        getWindow(this.element).clearTimeout(this.animationTimer);
      }
      append(this.element, this.body);
    } else {
      this.animationTimer = getWindow(this.element).setTimeout(() => {
        this.body.remove();
      }, 200);
    }
    this._onDidChangeExpansionState.fire(expanded);
    this._onDidChange.fire(expanded ? this.expandedSize : void 0);
    return true;
  }
  get headerVisible() {
    return this._headerVisible;
  }
  set headerVisible(visible) {
    if (this._headerVisible === !!visible) {
      return;
    }
    this._headerVisible = !!visible;
    this.updateHeader();
    this._onDidChange.fire(void 0);
  }
  get collapsible() {
    return this._collapsible;
  }
  set collapsible(collapsible) {
    if (this._collapsible === !!collapsible) {
      return;
    }
    this._collapsible = !!collapsible;
    this.updateHeader();
  }
  get orientation() {
    return this._orientation;
  }
  set orientation(orientation) {
    if (this._orientation === orientation) {
      return;
    }
    this._orientation = orientation;
    if (this.element) {
      this.element.classList.toggle("horizontal", this.orientation === Orientation.HORIZONTAL);
      this.element.classList.toggle("vertical", this.orientation === Orientation.VERTICAL);
    }
    if (this.header) {
      this.updateHeader();
    }
  }
  render() {
    this.element.classList.toggle("expanded", this.isExpanded());
    this.element.classList.toggle("horizontal", this.orientation === Orientation.HORIZONTAL);
    this.element.classList.toggle("vertical", this.orientation === Orientation.VERTICAL);
    this.header = $(".pane-header");
    append(this.element, this.header);
    this.header.setAttribute("tabindex", "0");
    this.header.setAttribute("role", "button");
    this.header.setAttribute("aria-label", this.ariaHeaderLabel);
    this.renderHeader(this.header);
    const focusTracker = trackFocus(this.header);
    this._register(focusTracker);
    this._register(focusTracker.onDidFocus(() => this.header?.classList.add("focused"), null));
    this._register(focusTracker.onDidBlur(() => this.header?.classList.remove("focused"), null));
    this.updateHeader();
    const eventDisposables = this._register(new DisposableStore());
    const onKeyDown = this._register(new DomEmitter(this.header, "keydown"));
    const onHeaderKeyDown = Event.map(onKeyDown.event, (e) => new StandardKeyboardEvent(e), eventDisposables);
    this._register(Event.filter(onHeaderKeyDown, (e) => e.keyCode === KeyCode.Enter || e.keyCode === KeyCode.Space, eventDisposables)(() => this.setExpanded(!this.isExpanded()), null));
    this._register(Event.filter(onHeaderKeyDown, (e) => e.keyCode === KeyCode.LeftArrow, eventDisposables)(() => this.setExpanded(false), null));
    this._register(Event.filter(onHeaderKeyDown, (e) => e.keyCode === KeyCode.RightArrow, eventDisposables)(() => this.setExpanded(true), null));
    this._register(Gesture.addTarget(this.header));
    const header = this.header;
    [EventType.CLICK, TouchEventType.Tap].forEach((eventType) => {
      this._register(addDisposableListener(header, eventType, (e) => {
        if (!e.defaultPrevented) {
          this.setExpanded(!this.isExpanded());
        }
      }));
    });
    this.body = append(this.element, $(".pane-body"));
    if (!this._bodyRendered && this.isExpanded()) {
      this.renderBody(this.body);
      this._bodyRendered = true;
    }
    if (!this.isExpanded()) {
      this.body.remove();
    }
  }
  layout(size) {
    const headerSize = this.headerVisible ? _Pane.HEADER_SIZE : 0;
    const width = this._orientation === Orientation.VERTICAL ? this.orthogonalSize : size;
    const height = this._orientation === Orientation.VERTICAL ? size - headerSize : this.orthogonalSize - headerSize;
    if (this.isExpanded()) {
      this.body.classList.toggle("wide", width >= 600);
      this.layoutBody(height, width);
      this.expandedSize = size;
    }
  }
  style(styles) {
    this.styles = styles;
    if (!this.header) {
      return;
    }
    this.updateHeader();
  }
  updateHeader() {
    if (!this.header) {
      return;
    }
    const expanded = !this.headerVisible || this.isExpanded();
    if (this.collapsible) {
      this.header.setAttribute("tabindex", "0");
      this.header.setAttribute("role", "button");
    } else {
      this.header.removeAttribute("tabindex");
      this.header.removeAttribute("role");
    }
    this.header.style.lineHeight = `${this.headerSize}px`;
    this.header.classList.toggle("hidden", !this.headerVisible);
    this.header.classList.toggle("expanded", expanded);
    this.header.classList.toggle("not-collapsible", !this.collapsible);
    this.header.setAttribute("aria-expanded", String(expanded));
    this.header.style.color = this.collapsible ? this.styles.headerForeground ?? "" : "";
    this.header.style.backgroundColor = (this.collapsible ? this.styles.headerBackground : "transparent") ?? "";
    this.header.style.borderTop = this.styles.headerBorder && this.orientation === Orientation.VERTICAL ? `1px solid ${this.styles.headerBorder}` : "";
    this.element.style.borderLeft = this.styles.leftBorder && this.orientation === Orientation.HORIZONTAL ? `1px solid ${this.styles.leftBorder}` : "";
  }
};
_Pane.HEADER_SIZE = 22;
let Pane = _Pane;
const _PaneDraggable = class _PaneDraggable extends Disposable {
  constructor(pane, dnd, context) {
    super();
    this.pane = pane;
    this.dnd = dnd;
    this.context = context;
    this.dragOverCounter = 0;
    // see https://github.com/microsoft/vscode/issues/14470
    this._onDidDrop = this._register(new Emitter());
    this.onDidDrop = this._onDidDrop.event;
    pane.draggableElement.draggable = true;
    this._register(addDisposableListener(pane.draggableElement, "dragstart", (e) => this.onDragStart(e)));
    this._register(addDisposableListener(pane.dropTargetElement, "dragenter", (e) => this.onDragEnter(e)));
    this._register(addDisposableListener(pane.dropTargetElement, "dragleave", (e) => this.onDragLeave(e)));
    this._register(addDisposableListener(pane.dropTargetElement, "dragend", (e) => this.onDragEnd(e)));
    this._register(addDisposableListener(pane.dropTargetElement, "drop", (e) => this.onDrop(e)));
  }
  onDragStart(e) {
    if (!this.dnd.canDrag(this.pane) || !e.dataTransfer) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const label = this.pane.draggableElement?.textContent || "";
    e.dataTransfer.effectAllowed = "move";
    if (isFirefox) {
      e.dataTransfer?.setData(DataTransfers.TEXT, label);
    }
    applyDragImage(e, this.pane.element, label);
    this.context.draggable = this;
  }
  onDragEnter(e) {
    if (!this.context.draggable || this.context.draggable === this) {
      return;
    }
    if (!this.dnd.canDrop(this.context.draggable.pane, this.pane)) {
      return;
    }
    this.dragOverCounter++;
    this.render();
  }
  onDragLeave(e) {
    if (!this.context.draggable || this.context.draggable === this) {
      return;
    }
    if (!this.dnd.canDrop(this.context.draggable.pane, this.pane)) {
      return;
    }
    this.dragOverCounter--;
    if (this.dragOverCounter === 0) {
      this.render();
    }
  }
  onDragEnd(e) {
    if (!this.context.draggable) {
      return;
    }
    this.dragOverCounter = 0;
    this.render();
    this.context.draggable = null;
  }
  onDrop(e) {
    if (!this.context.draggable) {
      return;
    }
    EventHelper.stop(e);
    this.dragOverCounter = 0;
    this.render();
    if (this.dnd.canDrop(this.context.draggable.pane, this.pane) && this.context.draggable !== this) {
      this._onDidDrop.fire({ from: this.context.draggable.pane, to: this.pane });
    }
    this.context.draggable = null;
  }
  render() {
    let backgroundColor = null;
    if (this.dragOverCounter > 0) {
      backgroundColor = this.pane.dropBackground ?? _PaneDraggable.DefaultDragOverBackgroundColor.toString();
    }
    this.pane.dropTargetElement.style.backgroundColor = backgroundColor || "";
  }
};
_PaneDraggable.DefaultDragOverBackgroundColor = new Color(new RGBA(128, 128, 128, 0.5));
let PaneDraggable = _PaneDraggable;
class DefaultPaneDndController {
  canDrag(pane) {
    return true;
  }
  canDrop(pane, overPane) {
    return true;
  }
}
class PaneView extends Disposable {
  constructor(container, options = {}) {
    super();
    this.dndContext = { draggable: null };
    this.paneItems = [];
    this.orthogonalSize = 0;
    this.size = 0;
    this.animationTimer = void 0;
    this._onDidDrop = this._register(new Emitter());
    this.onDidDrop = this._onDidDrop.event;
    this.dnd = options.dnd;
    this.orientation = options.orientation ?? Orientation.VERTICAL;
    this.element = append(container, $(".monaco-pane-view"));
    this.splitview = this._register(new SplitView(this.element, { orientation: this.orientation }));
    this.onDidSashReset = this.splitview.onDidSashReset;
    this.onDidSashChange = this.splitview.onDidSashChange;
    this.onDidScroll = this.splitview.onDidScroll;
    const eventDisposables = this._register(new DisposableStore());
    const onKeyDown = this._register(new DomEmitter(this.element, "keydown"));
    const onHeaderKeyDown = Event.map(Event.filter(onKeyDown.event, (e) => isHTMLElement(e.target) && e.target.classList.contains("pane-header"), eventDisposables), (e) => new StandardKeyboardEvent(e), eventDisposables);
    this._register(Event.filter(onHeaderKeyDown, (e) => e.keyCode === KeyCode.UpArrow, eventDisposables)(() => this.focusPrevious()));
    this._register(Event.filter(onHeaderKeyDown, (e) => e.keyCode === KeyCode.DownArrow, eventDisposables)(() => this.focusNext()));
  }
  addPane(pane, size, index = this.splitview.length) {
    const disposables = new DisposableStore();
    pane.onDidChangeExpansionState(this.setupAnimation, this, disposables);
    const paneItem = { pane, disposable: disposables };
    this.paneItems.splice(index, 0, paneItem);
    pane.orientation = this.orientation;
    pane.orthogonalSize = this.orthogonalSize;
    this.splitview.addView(pane, size, index);
    if (this.dnd) {
      const draggable = new PaneDraggable(pane, this.dnd, this.dndContext);
      disposables.add(draggable);
      disposables.add(draggable.onDidDrop(this._onDidDrop.fire, this._onDidDrop));
    }
  }
  removePane(pane) {
    const index = this.paneItems.findIndex((item) => item.pane === pane);
    if (index === -1) {
      return;
    }
    this.splitview.removeView(index, pane.isExpanded() ? Sizing.Distribute : void 0);
    const paneItem = this.paneItems.splice(index, 1)[0];
    paneItem.disposable.dispose();
  }
  movePane(from, to) {
    const fromIndex = this.paneItems.findIndex((item) => item.pane === from);
    const toIndex = this.paneItems.findIndex((item) => item.pane === to);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const [paneItem] = this.paneItems.splice(fromIndex, 1);
    this.paneItems.splice(toIndex, 0, paneItem);
    this.splitview.moveView(fromIndex, toIndex);
  }
  resizePane(pane, size) {
    const index = this.paneItems.findIndex((item) => item.pane === pane);
    if (index === -1) {
      return;
    }
    this.splitview.resizeView(index, size);
  }
  getPaneSize(pane) {
    const index = this.paneItems.findIndex((item) => item.pane === pane);
    if (index === -1) {
      return -1;
    }
    return this.splitview.getViewSize(index);
  }
  layout(height, width) {
    this.orthogonalSize = this.orientation === Orientation.VERTICAL ? width : height;
    this.size = this.orientation === Orientation.HORIZONTAL ? width : height;
    for (const paneItem of this.paneItems) {
      paneItem.pane.orthogonalSize = this.orthogonalSize;
    }
    this.splitview.layout(this.size);
  }
  setBoundarySashes(sashes) {
    this.boundarySashes = sashes;
    this.updateSplitviewOrthogonalSashes(sashes);
  }
  updateSplitviewOrthogonalSashes(sashes) {
    if (this.orientation === Orientation.VERTICAL) {
      this.splitview.orthogonalStartSash = sashes?.left;
      this.splitview.orthogonalEndSash = sashes?.right;
    } else {
      this.splitview.orthogonalEndSash = sashes?.bottom;
    }
  }
  flipOrientation(height, width) {
    this.orientation = this.orientation === Orientation.VERTICAL ? Orientation.HORIZONTAL : Orientation.VERTICAL;
    const paneSizes = this.paneItems.map((pane) => this.getPaneSize(pane.pane));
    this.splitview.dispose();
    clearNode(this.element);
    this.splitview = this._register(new SplitView(this.element, { orientation: this.orientation }));
    this.updateSplitviewOrthogonalSashes(this.boundarySashes);
    const newOrthogonalSize = this.orientation === Orientation.VERTICAL ? width : height;
    const newSize = this.orientation === Orientation.HORIZONTAL ? width : height;
    this.paneItems.forEach((pane, index) => {
      pane.pane.orthogonalSize = newOrthogonalSize;
      pane.pane.orientation = this.orientation;
      const viewSize = this.size === 0 ? 0 : newSize * paneSizes[index] / this.size;
      this.splitview.addView(pane.pane, viewSize, index);
    });
    this.size = newSize;
    this.orthogonalSize = newOrthogonalSize;
    this.splitview.layout(this.size);
  }
  setupAnimation() {
    if (typeof this.animationTimer === "number") {
      getWindow(this.element).clearTimeout(this.animationTimer);
    }
    this.element.classList.add("animated");
    this.animationTimer = getWindow(this.element).setTimeout(() => {
      this.animationTimer = void 0;
      this.element.classList.remove("animated");
    }, 200);
  }
  getPaneHeaderElements() {
    return [...this.element.querySelectorAll(".pane-header")];
  }
  focusPrevious() {
    const headers = this.getPaneHeaderElements();
    const index = headers.indexOf(this.element.ownerDocument.activeElement);
    if (index === -1) {
      return;
    }
    headers[Math.max(index - 1, 0)].focus();
  }
  focusNext() {
    const headers = this.getPaneHeaderElements();
    const index = headers.indexOf(this.element.ownerDocument.activeElement);
    if (index === -1) {
      return;
    }
    headers[Math.min(index + 1, headers.length - 1)].focus();
  }
  dispose() {
    super.dispose();
    this.paneItems.forEach((i) => i.disposable.dispose());
  }
}
export {
  DefaultPaneDndController,
  Pane,
  PaneView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvc3BsaXR2aWV3L3BhbmV2aWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgaXNGaXJlZm94IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJzIH0gZnJvbSAnLi4vLi4vZG5kLmpzJztcbmltcG9ydCB7ICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgYXBwZW5kLCBjbGVhck5vZGUsIEV2ZW50SGVscGVyLCBFdmVudFR5cGUsIGdldFdpbmRvdywgaXNIVE1MRWxlbWVudCwgdHJhY2tGb2N1cyB9IGZyb20gJy4uLy4uL2RvbS5qcyc7XG5pbXBvcnQgeyBEb21FbWl0dGVyIH0gZnJvbSAnLi4vLi4vZXZlbnQuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4va2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBHZXN0dXJlLCBFdmVudFR5cGUgYXMgVG91Y2hFdmVudFR5cGUgfSBmcm9tICcuLi8uLi90b3VjaC5qcyc7XG5pbXBvcnQgeyBJQm91bmRhcnlTYXNoZXMsIE9yaWVudGF0aW9uIH0gZnJvbSAnLi4vc2FzaC9zYXNoLmpzJztcbmltcG9ydCB7IENvbG9yLCBSR0JBIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2Nyb2xsRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5pbXBvcnQgJy4vcGFuZXZpZXcuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElWaWV3LCBTaXppbmcsIFNwbGl0VmlldyB9IGZyb20gJy4vc3BsaXR2aWV3LmpzJztcbmltcG9ydCB7IGFwcGx5RHJhZ0ltYWdlIH0gZnJvbSAnLi4vZG5kL2RuZC5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBhbmVPcHRpb25zIHtcblx0bWluaW11bUJvZHlTaXplPzogbnVtYmVyO1xuXHRtYXhpbXVtQm9keVNpemU/OiBudW1iZXI7XG5cdGV4cGFuZGVkPzogYm9vbGVhbjtcblx0b3JpZW50YXRpb24/OiBPcmllbnRhdGlvbjtcblx0dGl0bGU6IHN0cmluZztcblx0dGl0bGVEZXNjcmlwdGlvbj86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUGFuZVN0eWxlcyB7XG5cdHJlYWRvbmx5IGRyb3BCYWNrZ3JvdW5kOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGhlYWRlckZvcmVncm91bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgaGVhZGVyQmFja2dyb3VuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBoZWFkZXJCb3JkZXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgbGVmdEJvcmRlcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIEEgUGFuZSBpcyBhIHN0cnVjdHVyZWQgU3BsaXRWaWV3IHZpZXcuXG4gKlxuICogV0FSTklORzogWW91IG11c3QgY2FsbCBgcmVuZGVyKClgIGFmdGVyIHlvdSBjb25zdHJ1Y3QgaXQuXG4gKiBJdCBjYW4ndCBiZSBkb25lIGF1dG9tYXRpY2FsbHkgYXQgdGhlIGVuZCBvZiB0aGUgY3RvclxuICogYmVjYXVzZSBvZiB0aGUgb3JkZXIgb2YgcHJvcGVydHkgaW5pdGlhbGl6YXRpb24gaW4gVHlwZVNjcmlwdC5cbiAqIFN1YmNsYXNzZXMgd291bGRuJ3QgYmUgYWJsZSB0byBzZXQgb3duIHByb3BlcnRpZXNcbiAqIGJlZm9yZSB0aGUgYHJlbmRlcigpYCBjYWxsLCB0aHVzIGZvcmJpZGRpbmcgdGhlaXIgdXNlLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgUGFuZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVmlldyB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgSEVBREVSX1NJWkUgPSAyMjtcblxuXHRyZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBoZWFkZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGJvZHkhOiBIVE1MRWxlbWVudDtcblxuXHRwcm90ZWN0ZWQgX2V4cGFuZGVkOiBib29sZWFuO1xuXHRwcm90ZWN0ZWQgX29yaWVudGF0aW9uOiBPcmllbnRhdGlvbjtcblxuXHRwcml2YXRlIGV4cGFuZGVkU2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9oZWFkZXJWaXNpYmxlID0gdHJ1ZTtcblx0cHJpdmF0ZSBfY29sbGFwc2libGUgPSB0cnVlO1xuXHRwcml2YXRlIF9ib2R5UmVuZGVyZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBfbWluaW11bUJvZHlTaXplOiBudW1iZXI7XG5cdHByaXZhdGUgX21heGltdW1Cb2R5U2l6ZTogbnVtYmVyO1xuXHRwcml2YXRlIF9hcmlhSGVhZGVyTGFiZWw6IHN0cmluZztcblx0cHJpdmF0ZSBzdHlsZXM6IElQYW5lU3R5bGVzID0ge1xuXHRcdGRyb3BCYWNrZ3JvdW5kOiB1bmRlZmluZWQsXG5cdFx0aGVhZGVyQmFja2dyb3VuZDogdW5kZWZpbmVkLFxuXHRcdGhlYWRlckJvcmRlcjogdW5kZWZpbmVkLFxuXHRcdGhlYWRlckZvcmVncm91bmQ6IHVuZGVmaW5lZCxcblx0XHRsZWZ0Qm9yZGVyOiB1bmRlZmluZWRcblx0fTtcblx0cHJpdmF0ZSBhbmltYXRpb25UaW1lcjogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8bnVtYmVyIHwgdW5kZWZpbmVkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PG51bWJlciB8IHVuZGVmaW5lZD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUV4cGFuc2lvblN0YXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRXhwYW5zaW9uU3RhdGU6IEV2ZW50PGJvb2xlYW4+ID0gdGhpcy5fb25EaWRDaGFuZ2VFeHBhbnNpb25TdGF0ZS5ldmVudDtcblxuXHRnZXQgYXJpYUhlYWRlckxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2FyaWFIZWFkZXJMYWJlbDtcblx0fVxuXG5cdHNldCBhcmlhSGVhZGVyTGFiZWwobmV3TGFiZWw6IHN0cmluZykge1xuXHRcdHRoaXMuX2FyaWFIZWFkZXJMYWJlbCA9IG5ld0xhYmVsO1xuXHRcdHRoaXMuaGVhZGVyPy5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCB0aGlzLmFyaWFIZWFkZXJMYWJlbCk7XG5cdH1cblxuXHRnZXQgZHJhZ2dhYmxlRWxlbWVudCgpOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuaGVhZGVyO1xuXHR9XG5cblx0Z2V0IGRyb3BUYXJnZXRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5lbGVtZW50O1xuXHR9XG5cblx0Z2V0IGRyb3BCYWNrZ3JvdW5kKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuc3R5bGVzLmRyb3BCYWNrZ3JvdW5kO1xuXHR9XG5cblx0Z2V0IG1pbmltdW1Cb2R5U2l6ZSgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9taW5pbXVtQm9keVNpemU7XG5cdH1cblxuXHRzZXQgbWluaW11bUJvZHlTaXplKHNpemU6IG51bWJlcikge1xuXHRcdHRoaXMuX21pbmltdW1Cb2R5U2l6ZSA9IHNpemU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0Z2V0IG1heGltdW1Cb2R5U2l6ZSgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9tYXhpbXVtQm9keVNpemU7XG5cdH1cblxuXHRzZXQgbWF4aW11bUJvZHlTaXplKHNpemU6IG51bWJlcikge1xuXHRcdHRoaXMuX21heGltdW1Cb2R5U2l6ZSA9IHNpemU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgaGVhZGVyU2l6ZSgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLmhlYWRlclZpc2libGUgPyBQYW5lLkhFQURFUl9TSVpFIDogMDtcblx0fVxuXG5cdGdldCBtaW5pbXVtU2l6ZSgpOiBudW1iZXIge1xuXHRcdGNvbnN0IGhlYWRlclNpemUgPSB0aGlzLmhlYWRlclNpemU7XG5cdFx0Y29uc3QgZXhwYW5kZWQgPSAhdGhpcy5oZWFkZXJWaXNpYmxlIHx8IHRoaXMuaXNFeHBhbmRlZCgpO1xuXHRcdGNvbnN0IG1pbmltdW1Cb2R5U2l6ZSA9IGV4cGFuZGVkID8gdGhpcy5taW5pbXVtQm9keVNpemUgOiAwO1xuXG5cdFx0cmV0dXJuIGhlYWRlclNpemUgKyBtaW5pbXVtQm9keVNpemU7XG5cdH1cblxuXHRnZXQgbWF4aW11bVNpemUoKTogbnVtYmVyIHtcblx0XHRjb25zdCBoZWFkZXJTaXplID0gdGhpcy5oZWFkZXJTaXplO1xuXHRcdGNvbnN0IGV4cGFuZGVkID0gIXRoaXMuaGVhZGVyVmlzaWJsZSB8fCB0aGlzLmlzRXhwYW5kZWQoKTtcblx0XHRjb25zdCBtYXhpbXVtQm9keVNpemUgPSBleHBhbmRlZCA/IHRoaXMubWF4aW11bUJvZHlTaXplIDogMDtcblxuXHRcdHJldHVybiBoZWFkZXJTaXplICsgbWF4aW11bUJvZHlTaXplO1xuXHR9XG5cblx0b3J0aG9nb25hbFNpemU6IG51bWJlciA9IDA7XG5cblx0cHJvdGVjdGVkIGdldEFyaWFIZWFkZXJMYWJlbCh0aXRsZTogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ3ZpZXdTZWN0aW9uJywgXCJ7MH0gU2VjdGlvblwiLCB0aXRsZSk7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcihvcHRpb25zOiBJUGFuZU9wdGlvbnMpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2V4cGFuZGVkID0gdHlwZW9mIG9wdGlvbnMuZXhwYW5kZWQgPT09ICd1bmRlZmluZWQnID8gdHJ1ZSA6ICEhb3B0aW9ucy5leHBhbmRlZDtcblx0XHR0aGlzLl9vcmllbnRhdGlvbiA9IHR5cGVvZiBvcHRpb25zLm9yaWVudGF0aW9uID09PSAndW5kZWZpbmVkJyA/IE9yaWVudGF0aW9uLlZFUlRJQ0FMIDogb3B0aW9ucy5vcmllbnRhdGlvbjtcblx0XHR0aGlzLl9hcmlhSGVhZGVyTGFiZWwgPSB0aGlzLmdldEFyaWFIZWFkZXJMYWJlbChvcHRpb25zLnRpdGxlKTtcblx0XHR0aGlzLl9taW5pbXVtQm9keVNpemUgPSB0eXBlb2Ygb3B0aW9ucy5taW5pbXVtQm9keVNpemUgPT09ICdudW1iZXInID8gb3B0aW9ucy5taW5pbXVtQm9keVNpemUgOiB0aGlzLl9vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uSE9SSVpPTlRBTCA/IDIwMCA6IDEyMDtcblx0XHR0aGlzLl9tYXhpbXVtQm9keVNpemUgPSB0eXBlb2Ygb3B0aW9ucy5tYXhpbXVtQm9keVNpemUgPT09ICdudW1iZXInID8gb3B0aW9ucy5tYXhpbXVtQm9keVNpemUgOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG5cblx0XHR0aGlzLmVsZW1lbnQgPSAkKCcucGFuZScpO1xuXHR9XG5cblx0aXNFeHBhbmRlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZXhwYW5kZWQ7XG5cdH1cblxuXHRzZXRFeHBhbmRlZChleHBhbmRlZDogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGlmICghZXhwYW5kZWQgJiYgIXRoaXMuY29sbGFwc2libGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZXhwYW5kZWQgPT09ICEhZXhwYW5kZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLmVsZW1lbnQ/LmNsYXNzTGlzdC50b2dnbGUoJ2V4cGFuZGVkJywgZXhwYW5kZWQpO1xuXG5cdFx0dGhpcy5fZXhwYW5kZWQgPSAhIWV4cGFuZGVkO1xuXHRcdHRoaXMudXBkYXRlSGVhZGVyKCk7XG5cblx0XHRpZiAoZXhwYW5kZWQpIHtcblx0XHRcdGlmICghdGhpcy5fYm9keVJlbmRlcmVkKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyQm9keSh0aGlzLmJvZHkpO1xuXHRcdFx0XHR0aGlzLl9ib2R5UmVuZGVyZWQgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodHlwZW9mIHRoaXMuYW5pbWF0aW9uVGltZXIgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdGdldFdpbmRvdyh0aGlzLmVsZW1lbnQpLmNsZWFyVGltZW91dCh0aGlzLmFuaW1hdGlvblRpbWVyKTtcblx0XHRcdH1cblx0XHRcdGFwcGVuZCh0aGlzLmVsZW1lbnQsIHRoaXMuYm9keSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuYW5pbWF0aW9uVGltZXIgPSBnZXRXaW5kb3codGhpcy5lbGVtZW50KS5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dGhpcy5ib2R5LnJlbW92ZSgpO1xuXHRcdFx0fSwgMjAwKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZUV4cGFuc2lvblN0YXRlLmZpcmUoZXhwYW5kZWQpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoZXhwYW5kZWQgPyB0aGlzLmV4cGFuZGVkU2l6ZSA6IHVuZGVmaW5lZCk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRnZXQgaGVhZGVyVmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faGVhZGVyVmlzaWJsZTtcblx0fVxuXG5cdHNldCBoZWFkZXJWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5faGVhZGVyVmlzaWJsZSA9PT0gISF2aXNpYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5faGVhZGVyVmlzaWJsZSA9ICEhdmlzaWJsZTtcblx0XHR0aGlzLnVwZGF0ZUhlYWRlcigpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdGdldCBjb2xsYXBzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY29sbGFwc2libGU7XG5cdH1cblxuXHRzZXQgY29sbGFwc2libGUoY29sbGFwc2libGU6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5fY29sbGFwc2libGUgPT09ICEhY29sbGFwc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jb2xsYXBzaWJsZSA9ICEhY29sbGFwc2libGU7XG5cdFx0dGhpcy51cGRhdGVIZWFkZXIoKTtcblx0fVxuXG5cdGdldCBvcmllbnRhdGlvbigpOiBPcmllbnRhdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuX29yaWVudGF0aW9uO1xuXHR9XG5cblx0c2V0IG9yaWVudGF0aW9uKG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbikge1xuXHRcdGlmICh0aGlzLl9vcmllbnRhdGlvbiA9PT0gb3JpZW50YXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9vcmllbnRhdGlvbiA9IG9yaWVudGF0aW9uO1xuXG5cdFx0aWYgKHRoaXMuZWxlbWVudCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2hvcml6b250YWwnLCB0aGlzLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5IT1JJWk9OVEFMKTtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCd2ZXJ0aWNhbCcsIHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5oZWFkZXIpIHtcblx0XHRcdHRoaXMudXBkYXRlSGVhZGVyKCk7XG5cdFx0fVxuXHR9XG5cblx0cmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdleHBhbmRlZCcsIHRoaXMuaXNFeHBhbmRlZCgpKTtcblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnaG9yaXpvbnRhbCcsIHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwpO1xuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCd2ZXJ0aWNhbCcsIHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMKTtcblxuXHRcdHRoaXMuaGVhZGVyID0gJCgnLnBhbmUtaGVhZGVyJyk7XG5cdFx0YXBwZW5kKHRoaXMuZWxlbWVudCwgdGhpcy5oZWFkZXIpO1xuXHRcdHRoaXMuaGVhZGVyLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXHRcdC8vIFVzZSByb2xlIGJ1dHRvbiBzbyB0aGUgYXJpYS1leHBhbmRlZCBzdGF0ZSBnZXRzIHJlYWQgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzk1OTk2XG5cdFx0dGhpcy5oZWFkZXIuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuXHRcdHRoaXMuaGVhZGVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRoaXMuYXJpYUhlYWRlckxhYmVsKTtcblx0XHR0aGlzLnJlbmRlckhlYWRlcih0aGlzLmhlYWRlcik7XG5cblx0XHRjb25zdCBmb2N1c1RyYWNrZXIgPSB0cmFja0ZvY3VzKHRoaXMuaGVhZGVyKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihmb2N1c1RyYWNrZXIpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHRoaXMuaGVhZGVyPy5jbGFzc0xpc3QuYWRkKCdmb2N1c2VkJyksIG51bGwpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihmb2N1c1RyYWNrZXIub25EaWRCbHVyKCgpID0+IHRoaXMuaGVhZGVyPy5jbGFzc0xpc3QucmVtb3ZlKCdmb2N1c2VkJyksIG51bGwpKTtcblxuXHRcdHRoaXMudXBkYXRlSGVhZGVyKCk7XG5cblx0XHRjb25zdCBldmVudERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRjb25zdCBvbktleURvd24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcih0aGlzLmhlYWRlciwgJ2tleWRvd24nKSk7XG5cdFx0Y29uc3Qgb25IZWFkZXJLZXlEb3duID0gRXZlbnQubWFwKG9uS2V5RG93bi5ldmVudCwgZSA9PiBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpLCBldmVudERpc3Bvc2FibGVzKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcihvbkhlYWRlcktleURvd24sIGUgPT4gZS5rZXlDb2RlID09PSBLZXlDb2RlLkVudGVyIHx8IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5TcGFjZSwgZXZlbnREaXNwb3NhYmxlcykoKCkgPT4gdGhpcy5zZXRFeHBhbmRlZCghdGhpcy5pc0V4cGFuZGVkKCkpLCBudWxsKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIob25IZWFkZXJLZXlEb3duLCBlID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5MZWZ0QXJyb3csIGV2ZW50RGlzcG9zYWJsZXMpKCgpID0+IHRoaXMuc2V0RXhwYW5kZWQoZmFsc2UpLCBudWxsKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIob25IZWFkZXJLZXlEb3duLCBlID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5SaWdodEFycm93LCBldmVudERpc3Bvc2FibGVzKSgoKSA9PiB0aGlzLnNldEV4cGFuZGVkKHRydWUpLCBudWxsKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihHZXN0dXJlLmFkZFRhcmdldCh0aGlzLmhlYWRlcikpO1xuXG5cdFx0Y29uc3QgaGVhZGVyID0gdGhpcy5oZWFkZXI7XG5cdFx0W0V2ZW50VHlwZS5DTElDSywgVG91Y2hFdmVudFR5cGUuVGFwXS5mb3JFYWNoKGV2ZW50VHlwZSA9PiB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIoaGVhZGVyLCBldmVudFR5cGUsIGUgPT4ge1xuXHRcdFx0XHRpZiAoIWUuZGVmYXVsdFByZXZlbnRlZCkge1xuXHRcdFx0XHRcdHRoaXMuc2V0RXhwYW5kZWQoIXRoaXMuaXNFeHBhbmRlZCgpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5ib2R5ID0gYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnLnBhbmUtYm9keScpKTtcblxuXHRcdC8vIE9ubHkgcmVuZGVyIHRoZSBib2R5IGlmIGl0IHdpbGwgYmUgdmlzaWJsZVxuXHRcdC8vIE90aGVyd2lzZSwgcmVuZGVyIGl0IHdoZW4gdGhlIHBhbmUgaXMgZXhwYW5kZWRcblx0XHRpZiAoIXRoaXMuX2JvZHlSZW5kZXJlZCAmJiB0aGlzLmlzRXhwYW5kZWQoKSkge1xuXHRcdFx0dGhpcy5yZW5kZXJCb2R5KHRoaXMuYm9keSk7XG5cdFx0XHR0aGlzLl9ib2R5UmVuZGVyZWQgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5pc0V4cGFuZGVkKCkpIHtcblx0XHRcdHRoaXMuYm9keS5yZW1vdmUoKTtcblx0XHR9XG5cdH1cblxuXHRsYXlvdXQoc2l6ZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgaGVhZGVyU2l6ZSA9IHRoaXMuaGVhZGVyVmlzaWJsZSA/IFBhbmUuSEVBREVSX1NJWkUgOiAwO1xuXG5cdFx0Y29uc3Qgd2lkdGggPSB0aGlzLl9vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uVkVSVElDQUwgPyB0aGlzLm9ydGhvZ29uYWxTaXplIDogc2l6ZTtcblx0XHRjb25zdCBoZWlnaHQgPSB0aGlzLl9vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uVkVSVElDQUwgPyBzaXplIC0gaGVhZGVyU2l6ZSA6IHRoaXMub3J0aG9nb25hbFNpemUgLSBoZWFkZXJTaXplO1xuXG5cdFx0aWYgKHRoaXMuaXNFeHBhbmRlZCgpKSB7XG5cdFx0XHR0aGlzLmJvZHkuY2xhc3NMaXN0LnRvZ2dsZSgnd2lkZScsIHdpZHRoID49IDYwMCk7XG5cdFx0XHR0aGlzLmxheW91dEJvZHkoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0XHR0aGlzLmV4cGFuZGVkU2l6ZSA9IHNpemU7XG5cdFx0fVxuXHR9XG5cblx0c3R5bGUoc3R5bGVzOiBJUGFuZVN0eWxlcyk6IHZvaWQge1xuXHRcdHRoaXMuc3R5bGVzID0gc3R5bGVzO1xuXG5cdFx0aWYgKCF0aGlzLmhlYWRlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlSGVhZGVyKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlSGVhZGVyKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5oZWFkZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZXhwYW5kZWQgPSAhdGhpcy5oZWFkZXJWaXNpYmxlIHx8IHRoaXMuaXNFeHBhbmRlZCgpO1xuXG5cdFx0aWYgKHRoaXMuY29sbGFwc2libGUpIHtcblx0XHRcdHRoaXMuaGVhZGVyLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXHRcdFx0dGhpcy5oZWFkZXIuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmhlYWRlci5yZW1vdmVBdHRyaWJ1dGUoJ3RhYmluZGV4Jyk7XG5cdFx0XHR0aGlzLmhlYWRlci5yZW1vdmVBdHRyaWJ1dGUoJ3JvbGUnKTtcblx0XHR9XG5cblx0XHR0aGlzLmhlYWRlci5zdHlsZS5saW5lSGVpZ2h0ID0gYCR7dGhpcy5oZWFkZXJTaXplfXB4YDtcblx0XHR0aGlzLmhlYWRlci5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAhdGhpcy5oZWFkZXJWaXNpYmxlKTtcblx0XHR0aGlzLmhlYWRlci5jbGFzc0xpc3QudG9nZ2xlKCdleHBhbmRlZCcsIGV4cGFuZGVkKTtcblx0XHR0aGlzLmhlYWRlci5jbGFzc0xpc3QudG9nZ2xlKCdub3QtY29sbGFwc2libGUnLCAhdGhpcy5jb2xsYXBzaWJsZSk7XG5cdFx0dGhpcy5oZWFkZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgU3RyaW5nKGV4cGFuZGVkKSk7XG5cblx0XHR0aGlzLmhlYWRlci5zdHlsZS5jb2xvciA9IHRoaXMuY29sbGFwc2libGUgPyB0aGlzLnN0eWxlcy5oZWFkZXJGb3JlZ3JvdW5kID8/ICcnIDogJyc7XG5cdFx0dGhpcy5oZWFkZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gKHRoaXMuY29sbGFwc2libGUgPyB0aGlzLnN0eWxlcy5oZWFkZXJCYWNrZ3JvdW5kIDogJ3RyYW5zcGFyZW50JykgPz8gJyc7XG5cdFx0dGhpcy5oZWFkZXIuc3R5bGUuYm9yZGVyVG9wID0gdGhpcy5zdHlsZXMuaGVhZGVyQm9yZGVyICYmIHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMID8gYDFweCBzb2xpZCAke3RoaXMuc3R5bGVzLmhlYWRlckJvcmRlcn1gIDogJyc7XG5cdFx0dGhpcy5lbGVtZW50LnN0eWxlLmJvcmRlckxlZnQgPSB0aGlzLnN0eWxlcy5sZWZ0Qm9yZGVyICYmIHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwgPyBgMXB4IHNvbGlkICR7dGhpcy5zdHlsZXMubGVmdEJvcmRlcn1gIDogJyc7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgcmVuZGVySGVhZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZDtcblx0cHJvdGVjdGVkIGFic3RyYWN0IGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkO1xufVxuXG5pbnRlcmZhY2UgSURuZENvbnRleHQge1xuXHRkcmFnZ2FibGU6IFBhbmVEcmFnZ2FibGUgfCBudWxsO1xufVxuXG5jbGFzcyBQYW5lRHJhZ2dhYmxlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRGVmYXVsdERyYWdPdmVyQmFja2dyb3VuZENvbG9yID0gbmV3IENvbG9yKG5ldyBSR0JBKDEyOCwgMTI4LCAxMjgsIDAuNSkpO1xuXG5cdHByaXZhdGUgZHJhZ092ZXJDb3VudGVyID0gMDsgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDQ3MFxuXG5cdHByaXZhdGUgX29uRGlkRHJvcCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgZnJvbTogUGFuZTsgdG86IFBhbmUgfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRHJvcCA9IHRoaXMuX29uRGlkRHJvcC5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHBhbmU6IFBhbmUsIHByaXZhdGUgZG5kOiBJUGFuZURuZENvbnRyb2xsZXIsIHByaXZhdGUgY29udGV4dDogSURuZENvbnRleHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0cGFuZS5kcmFnZ2FibGVFbGVtZW50IS5kcmFnZ2FibGUgPSB0cnVlO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihwYW5lLmRyYWdnYWJsZUVsZW1lbnQhLCAnZHJhZ3N0YXJ0JywgZSA9PiB0aGlzLm9uRHJhZ1N0YXJ0KGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHBhbmUuZHJvcFRhcmdldEVsZW1lbnQsICdkcmFnZW50ZXInLCBlID0+IHRoaXMub25EcmFnRW50ZXIoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIocGFuZS5kcm9wVGFyZ2V0RWxlbWVudCwgJ2RyYWdsZWF2ZScsIGUgPT4gdGhpcy5vbkRyYWdMZWF2ZShlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihwYW5lLmRyb3BUYXJnZXRFbGVtZW50LCAnZHJhZ2VuZCcsIGUgPT4gdGhpcy5vbkRyYWdFbmQoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIocGFuZS5kcm9wVGFyZ2V0RWxlbWVudCwgJ2Ryb3AnLCBlID0+IHRoaXMub25Ecm9wKGUpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRHJhZ1N0YXJ0KGU6IERyYWdFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5kbmQuY2FuRHJhZyh0aGlzLnBhbmUpIHx8ICFlLmRhdGFUcmFuc2Zlcikge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsYWJlbCA9IHRoaXMucGFuZS5kcmFnZ2FibGVFbGVtZW50Py50ZXh0Q29udGVudCB8fCAnJztcblxuXHRcdGUuZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSAnbW92ZSc7XG5cblx0XHRpZiAoaXNGaXJlZm94KSB7XG5cdFx0XHQvLyBGaXJlZm94OiByZXF1aXJlcyB0byBzZXQgYSB0ZXh0IGRhdGEgdHJhbnNmZXIgdG8gZ2V0IGdvaW5nXG5cdFx0XHRlLmRhdGFUcmFuc2Zlcj8uc2V0RGF0YShEYXRhVHJhbnNmZXJzLlRFWFQsIGxhYmVsKTtcblx0XHR9XG5cblx0XHRhcHBseURyYWdJbWFnZShlLCB0aGlzLnBhbmUuZWxlbWVudCwgbGFiZWwpO1xuXG5cdFx0dGhpcy5jb250ZXh0LmRyYWdnYWJsZSA9IHRoaXM7XG5cdH1cblxuXHRwcml2YXRlIG9uRHJhZ0VudGVyKGU6IERyYWdFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5jb250ZXh0LmRyYWdnYWJsZSB8fCB0aGlzLmNvbnRleHQuZHJhZ2dhYmxlID09PSB0aGlzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmRuZC5jYW5Ecm9wKHRoaXMuY29udGV4dC5kcmFnZ2FibGUucGFuZSwgdGhpcy5wYW5lKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZHJhZ092ZXJDb3VudGVyKys7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgb25EcmFnTGVhdmUoZTogRHJhZ0V2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmNvbnRleHQuZHJhZ2dhYmxlIHx8IHRoaXMuY29udGV4dC5kcmFnZ2FibGUgPT09IHRoaXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZG5kLmNhbkRyb3AodGhpcy5jb250ZXh0LmRyYWdnYWJsZS5wYW5lLCB0aGlzLnBhbmUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5kcmFnT3ZlckNvdW50ZXItLTtcblxuXHRcdGlmICh0aGlzLmRyYWdPdmVyQ291bnRlciA9PT0gMCkge1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRHJhZ0VuZChlOiBEcmFnRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuY29udGV4dC5kcmFnZ2FibGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmRyYWdPdmVyQ291bnRlciA9IDA7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR0aGlzLmNvbnRleHQuZHJhZ2dhYmxlID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgb25Ecm9wKGU6IERyYWdFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5jb250ZXh0LmRyYWdnYWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdEV2ZW50SGVscGVyLnN0b3AoZSk7XG5cblx0XHR0aGlzLmRyYWdPdmVyQ291bnRlciA9IDA7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblxuXHRcdGlmICh0aGlzLmRuZC5jYW5Ecm9wKHRoaXMuY29udGV4dC5kcmFnZ2FibGUucGFuZSwgdGhpcy5wYW5lKSAmJiB0aGlzLmNvbnRleHQuZHJhZ2dhYmxlICE9PSB0aGlzKSB7XG5cdFx0XHR0aGlzLl9vbkRpZERyb3AuZmlyZSh7IGZyb206IHRoaXMuY29udGV4dC5kcmFnZ2FibGUucGFuZSwgdG86IHRoaXMucGFuZSB9KTtcblx0XHR9XG5cblx0XHR0aGlzLmNvbnRleHQuZHJhZ2dhYmxlID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyKCk6IHZvaWQge1xuXHRcdGxldCBiYWNrZ3JvdW5kQ29sb3I6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG5cdFx0aWYgKHRoaXMuZHJhZ092ZXJDb3VudGVyID4gMCkge1xuXHRcdFx0YmFja2dyb3VuZENvbG9yID0gdGhpcy5wYW5lLmRyb3BCYWNrZ3JvdW5kID8/IFBhbmVEcmFnZ2FibGUuRGVmYXVsdERyYWdPdmVyQmFja2dyb3VuZENvbG9yLnRvU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5wYW5lLmRyb3BUYXJnZXRFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGJhY2tncm91bmRDb2xvciB8fCAnJztcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQYW5lRG5kQ29udHJvbGxlciB7XG5cdGNhbkRyYWcocGFuZTogUGFuZSk6IGJvb2xlYW47XG5cdGNhbkRyb3AocGFuZTogUGFuZSwgb3ZlclBhbmU6IFBhbmUpOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgRGVmYXVsdFBhbmVEbmRDb250cm9sbGVyIGltcGxlbWVudHMgSVBhbmVEbmRDb250cm9sbGVyIHtcblxuXHRjYW5EcmFnKHBhbmU6IFBhbmUpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGNhbkRyb3AocGFuZTogUGFuZSwgb3ZlclBhbmU6IFBhbmUpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQYW5lVmlld09wdGlvbnMge1xuXHRkbmQ/OiBJUGFuZURuZENvbnRyb2xsZXI7XG5cdG9yaWVudGF0aW9uPzogT3JpZW50YXRpb247XG59XG5cbmludGVyZmFjZSBJUGFuZUl0ZW0ge1xuXHRwYW5lOiBQYW5lO1xuXHRkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcbn1cblxuZXhwb3J0IGNsYXNzIFBhbmVWaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBkbmQ6IElQYW5lRG5kQ29udHJvbGxlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBkbmRDb250ZXh0OiBJRG5kQ29udGV4dCA9IHsgZHJhZ2dhYmxlOiBudWxsIH07XG5cdHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHBhbmVJdGVtczogSVBhbmVJdGVtW10gPSBbXTtcblx0cHJpdmF0ZSBvcnRob2dvbmFsU2l6ZTogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBzaXplOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIHNwbGl0dmlldzogU3BsaXRWaWV3O1xuXHRwcml2YXRlIGFuaW1hdGlvblRpbWVyOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfb25EaWREcm9wID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBmcm9tOiBQYW5lOyB0bzogUGFuZSB9PigpKTtcblx0cmVhZG9ubHkgb25EaWREcm9wOiBFdmVudDx7IGZyb206IFBhbmU7IHRvOiBQYW5lIH0+ID0gdGhpcy5fb25EaWREcm9wLmV2ZW50O1xuXG5cdG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbjtcblx0cHJpdmF0ZSBib3VuZGFyeVNhc2hlczogSUJvdW5kYXJ5U2FzaGVzIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBvbkRpZFNhc2hDaGFuZ2U6IEV2ZW50PG51bWJlcj47XG5cdHJlYWRvbmx5IG9uRGlkU2FzaFJlc2V0OiBFdmVudDxudW1iZXI+O1xuXHRyZWFkb25seSBvbkRpZFNjcm9sbDogRXZlbnQ8U2Nyb2xsRXZlbnQ+O1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG9wdGlvbnM6IElQYW5lVmlld09wdGlvbnMgPSB7fSkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmRuZCA9IG9wdGlvbnMuZG5kO1xuXHRcdHRoaXMub3JpZW50YXRpb24gPSBvcHRpb25zLm9yaWVudGF0aW9uID8/IE9yaWVudGF0aW9uLlZFUlRJQ0FMO1xuXHRcdHRoaXMuZWxlbWVudCA9IGFwcGVuZChjb250YWluZXIsICQoJy5tb25hY28tcGFuZS12aWV3JykpO1xuXHRcdHRoaXMuc3BsaXR2aWV3ID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNwbGl0Vmlldyh0aGlzLmVsZW1lbnQsIHsgb3JpZW50YXRpb246IHRoaXMub3JpZW50YXRpb24gfSkpO1xuXHRcdHRoaXMub25EaWRTYXNoUmVzZXQgPSB0aGlzLnNwbGl0dmlldy5vbkRpZFNhc2hSZXNldDtcblx0XHR0aGlzLm9uRGlkU2FzaENoYW5nZSA9IHRoaXMuc3BsaXR2aWV3Lm9uRGlkU2FzaENoYW5nZTtcblx0XHR0aGlzLm9uRGlkU2Nyb2xsID0gdGhpcy5zcGxpdHZpZXcub25EaWRTY3JvbGw7XG5cblx0XHRjb25zdCBldmVudERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRjb25zdCBvbktleURvd24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcih0aGlzLmVsZW1lbnQsICdrZXlkb3duJykpO1xuXHRcdGNvbnN0IG9uSGVhZGVyS2V5RG93biA9IEV2ZW50Lm1hcChFdmVudC5maWx0ZXIob25LZXlEb3duLmV2ZW50LCBlID0+IGlzSFRNTEVsZW1lbnQoZS50YXJnZXQpICYmIGUudGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygncGFuZS1oZWFkZXInKSwgZXZlbnREaXNwb3NhYmxlcyksIGUgPT4gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKSwgZXZlbnREaXNwb3NhYmxlcyk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIob25IZWFkZXJLZXlEb3duLCBlID0+IGUua2V5Q29kZSA9PT0gS2V5Q29kZS5VcEFycm93LCBldmVudERpc3Bvc2FibGVzKSgoKSA9PiB0aGlzLmZvY3VzUHJldmlvdXMoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcihvbkhlYWRlcktleURvd24sIGUgPT4gZS5rZXlDb2RlID09PSBLZXlDb2RlLkRvd25BcnJvdywgZXZlbnREaXNwb3NhYmxlcykoKCkgPT4gdGhpcy5mb2N1c05leHQoKSkpO1xuXHR9XG5cblx0YWRkUGFuZShwYW5lOiBQYW5lLCBzaXplOiBudW1iZXIsIGluZGV4ID0gdGhpcy5zcGxpdHZpZXcubGVuZ3RoKTogdm9pZCB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0cGFuZS5vbkRpZENoYW5nZUV4cGFuc2lvblN0YXRlKHRoaXMuc2V0dXBBbmltYXRpb24sIHRoaXMsIGRpc3Bvc2FibGVzKTtcblxuXHRcdGNvbnN0IHBhbmVJdGVtID0geyBwYW5lOiBwYW5lLCBkaXNwb3NhYmxlOiBkaXNwb3NhYmxlcyB9O1xuXHRcdHRoaXMucGFuZUl0ZW1zLnNwbGljZShpbmRleCwgMCwgcGFuZUl0ZW0pO1xuXHRcdHBhbmUub3JpZW50YXRpb24gPSB0aGlzLm9yaWVudGF0aW9uO1xuXHRcdHBhbmUub3J0aG9nb25hbFNpemUgPSB0aGlzLm9ydGhvZ29uYWxTaXplO1xuXHRcdHRoaXMuc3BsaXR2aWV3LmFkZFZpZXcocGFuZSwgc2l6ZSwgaW5kZXgpO1xuXG5cdFx0aWYgKHRoaXMuZG5kKSB7XG5cdFx0XHRjb25zdCBkcmFnZ2FibGUgPSBuZXcgUGFuZURyYWdnYWJsZShwYW5lLCB0aGlzLmRuZCwgdGhpcy5kbmRDb250ZXh0KTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChkcmFnZ2FibGUpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGRyYWdnYWJsZS5vbkRpZERyb3AodGhpcy5fb25EaWREcm9wLmZpcmUsIHRoaXMuX29uRGlkRHJvcCkpO1xuXHRcdH1cblx0fVxuXG5cdHJlbW92ZVBhbmUocGFuZTogUGFuZSk6IHZvaWQge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5wYW5lSXRlbXMuZmluZEluZGV4KGl0ZW0gPT4gaXRlbS5wYW5lID09PSBwYW5lKTtcblxuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNwbGl0dmlldy5yZW1vdmVWaWV3KGluZGV4LCBwYW5lLmlzRXhwYW5kZWQoKSA/IFNpemluZy5EaXN0cmlidXRlIDogdW5kZWZpbmVkKTtcblx0XHRjb25zdCBwYW5lSXRlbSA9IHRoaXMucGFuZUl0ZW1zLnNwbGljZShpbmRleCwgMSlbMF07XG5cdFx0cGFuZUl0ZW0uZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRtb3ZlUGFuZShmcm9tOiBQYW5lLCB0bzogUGFuZSk6IHZvaWQge1xuXHRcdGNvbnN0IGZyb21JbmRleCA9IHRoaXMucGFuZUl0ZW1zLmZpbmRJbmRleChpdGVtID0+IGl0ZW0ucGFuZSA9PT0gZnJvbSk7XG5cdFx0Y29uc3QgdG9JbmRleCA9IHRoaXMucGFuZUl0ZW1zLmZpbmRJbmRleChpdGVtID0+IGl0ZW0ucGFuZSA9PT0gdG8pO1xuXG5cdFx0aWYgKGZyb21JbmRleCA9PT0gLTEgfHwgdG9JbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBbcGFuZUl0ZW1dID0gdGhpcy5wYW5lSXRlbXMuc3BsaWNlKGZyb21JbmRleCwgMSk7XG5cdFx0dGhpcy5wYW5lSXRlbXMuc3BsaWNlKHRvSW5kZXgsIDAsIHBhbmVJdGVtKTtcblxuXHRcdHRoaXMuc3BsaXR2aWV3Lm1vdmVWaWV3KGZyb21JbmRleCwgdG9JbmRleCk7XG5cdH1cblxuXHRyZXNpemVQYW5lKHBhbmU6IFBhbmUsIHNpemU6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5wYW5lSXRlbXMuZmluZEluZGV4KGl0ZW0gPT4gaXRlbS5wYW5lID09PSBwYW5lKTtcblxuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNwbGl0dmlldy5yZXNpemVWaWV3KGluZGV4LCBzaXplKTtcblx0fVxuXG5cdGdldFBhbmVTaXplKHBhbmU6IFBhbmUpOiBudW1iZXIge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5wYW5lSXRlbXMuZmluZEluZGV4KGl0ZW0gPT4gaXRlbS5wYW5lID09PSBwYW5lKTtcblxuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zcGxpdHZpZXcuZ2V0Vmlld1NpemUoaW5kZXgpO1xuXHR9XG5cblx0bGF5b3V0KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5vcnRob2dvbmFsU2l6ZSA9IHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMID8gd2lkdGggOiBoZWlnaHQ7XG5cdFx0dGhpcy5zaXplID0gdGhpcy5vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uSE9SSVpPTlRBTCA/IHdpZHRoIDogaGVpZ2h0O1xuXG5cdFx0Zm9yIChjb25zdCBwYW5lSXRlbSBvZiB0aGlzLnBhbmVJdGVtcykge1xuXHRcdFx0cGFuZUl0ZW0ucGFuZS5vcnRob2dvbmFsU2l6ZSA9IHRoaXMub3J0aG9nb25hbFNpemU7XG5cdFx0fVxuXG5cdFx0dGhpcy5zcGxpdHZpZXcubGF5b3V0KHRoaXMuc2l6ZSk7XG5cdH1cblxuXHRzZXRCb3VuZGFyeVNhc2hlcyhzYXNoZXM6IElCb3VuZGFyeVNhc2hlcykge1xuXHRcdHRoaXMuYm91bmRhcnlTYXNoZXMgPSBzYXNoZXM7XG5cdFx0dGhpcy51cGRhdGVTcGxpdHZpZXdPcnRob2dvbmFsU2FzaGVzKHNhc2hlcyk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVNwbGl0dmlld09ydGhvZ29uYWxTYXNoZXMoc2FzaGVzOiBJQm91bmRhcnlTYXNoZXMgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5vcmllbnRhdGlvbiA9PT0gT3JpZW50YXRpb24uVkVSVElDQUwpIHtcblx0XHRcdHRoaXMuc3BsaXR2aWV3Lm9ydGhvZ29uYWxTdGFydFNhc2ggPSBzYXNoZXM/LmxlZnQ7XG5cdFx0XHR0aGlzLnNwbGl0dmlldy5vcnRob2dvbmFsRW5kU2FzaCA9IHNhc2hlcz8ucmlnaHQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3BsaXR2aWV3Lm9ydGhvZ29uYWxFbmRTYXNoID0gc2FzaGVzPy5ib3R0b207XG5cdFx0fVxuXHR9XG5cblx0ZmxpcE9yaWVudGF0aW9uKGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5vcmllbnRhdGlvbiA9IHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMID8gT3JpZW50YXRpb24uSE9SSVpPTlRBTCA6IE9yaWVudGF0aW9uLlZFUlRJQ0FMO1xuXHRcdGNvbnN0IHBhbmVTaXplcyA9IHRoaXMucGFuZUl0ZW1zLm1hcChwYW5lID0+IHRoaXMuZ2V0UGFuZVNpemUocGFuZS5wYW5lKSk7XG5cblx0XHR0aGlzLnNwbGl0dmlldy5kaXNwb3NlKCk7XG5cdFx0Y2xlYXJOb2RlKHRoaXMuZWxlbWVudCk7XG5cblx0XHR0aGlzLnNwbGl0dmlldyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTcGxpdFZpZXcodGhpcy5lbGVtZW50LCB7IG9yaWVudGF0aW9uOiB0aGlzLm9yaWVudGF0aW9uIH0pKTtcblx0XHR0aGlzLnVwZGF0ZVNwbGl0dmlld09ydGhvZ29uYWxTYXNoZXModGhpcy5ib3VuZGFyeVNhc2hlcyk7XG5cblx0XHRjb25zdCBuZXdPcnRob2dvbmFsU2l6ZSA9IHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMID8gd2lkdGggOiBoZWlnaHQ7XG5cdFx0Y29uc3QgbmV3U2l6ZSA9IHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwgPyB3aWR0aCA6IGhlaWdodDtcblxuXHRcdHRoaXMucGFuZUl0ZW1zLmZvckVhY2goKHBhbmUsIGluZGV4KSA9PiB7XG5cdFx0XHRwYW5lLnBhbmUub3J0aG9nb25hbFNpemUgPSBuZXdPcnRob2dvbmFsU2l6ZTtcblx0XHRcdHBhbmUucGFuZS5vcmllbnRhdGlvbiA9IHRoaXMub3JpZW50YXRpb247XG5cblx0XHRcdGNvbnN0IHZpZXdTaXplID0gdGhpcy5zaXplID09PSAwID8gMCA6IChuZXdTaXplICogcGFuZVNpemVzW2luZGV4XSkgLyB0aGlzLnNpemU7XG5cdFx0XHR0aGlzLnNwbGl0dmlldy5hZGRWaWV3KHBhbmUucGFuZSwgdmlld1NpemUsIGluZGV4KTtcblx0XHR9KTtcblxuXHRcdHRoaXMuc2l6ZSA9IG5ld1NpemU7XG5cdFx0dGhpcy5vcnRob2dvbmFsU2l6ZSA9IG5ld09ydGhvZ29uYWxTaXplO1xuXG5cdFx0dGhpcy5zcGxpdHZpZXcubGF5b3V0KHRoaXMuc2l6ZSk7XG5cdH1cblxuXHRwcml2YXRlIHNldHVwQW5pbWF0aW9uKCk6IHZvaWQge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5hbmltYXRpb25UaW1lciA9PT0gJ251bWJlcicpIHtcblx0XHRcdGdldFdpbmRvdyh0aGlzLmVsZW1lbnQpLmNsZWFyVGltZW91dCh0aGlzLmFuaW1hdGlvblRpbWVyKTtcblx0XHR9XG5cblx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnYW5pbWF0ZWQnKTtcblxuXHRcdHRoaXMuYW5pbWF0aW9uVGltZXIgPSBnZXRXaW5kb3codGhpcy5lbGVtZW50KS5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuYW5pbWF0aW9uVGltZXIgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnYW5pbWF0ZWQnKTtcblx0XHR9LCAyMDApO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRQYW5lSGVhZGVyRWxlbWVudHMoKTogSFRNTEVsZW1lbnRbXSB7XG5cdFx0cmV0dXJuIFsuLi50aGlzLmVsZW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnBhbmUtaGVhZGVyJyldIGFzIEhUTUxFbGVtZW50W107XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzUHJldmlvdXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgaGVhZGVycyA9IHRoaXMuZ2V0UGFuZUhlYWRlckVsZW1lbnRzKCk7XG5cdFx0Y29uc3QgaW5kZXggPSBoZWFkZXJzLmluZGV4T2YodGhpcy5lbGVtZW50Lm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudCBhcyBIVE1MRWxlbWVudCk7XG5cblx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aGVhZGVyc1tNYXRoLm1heChpbmRleCAtIDEsIDApXS5mb2N1cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBmb2N1c05leHQoKTogdm9pZCB7XG5cdFx0Y29uc3QgaGVhZGVycyA9IHRoaXMuZ2V0UGFuZUhlYWRlckVsZW1lbnRzKCk7XG5cdFx0Y29uc3QgaW5kZXggPSBoZWFkZXJzLmluZGV4T2YodGhpcy5lbGVtZW50Lm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudCBhcyBIVE1MRWxlbWVudCk7XG5cblx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aGVhZGVyc1tNYXRoLm1pbihpbmRleCArIDEsIGhlYWRlcnMubGVuZ3RoIC0gMSldLmZvY3VzKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMucGFuZUl0ZW1zLmZvckVhY2goaSA9PiBpLmRpc3Bvc2FibGUuZGlzcG9zZSgpKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxHQUFHLHVCQUF1QixRQUFRLFdBQVcsYUFBYSxXQUFXLFdBQVcsZUFBZSxrQkFBa0I7QUFDMUgsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxTQUFTLGFBQWEsc0JBQXNCO0FBQ3JELFNBQTBCLG1CQUFtQjtBQUM3QyxTQUFTLE9BQU8sWUFBWTtBQUM1QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLHVC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
