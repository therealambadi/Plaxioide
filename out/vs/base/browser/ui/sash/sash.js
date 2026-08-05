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
import { $, append, EventHelper, getWindow, isHTMLElement } from "../../dom.js";
import { createStyleSheet } from "../../domStylesheets.js";
import { DomEmitter } from "../../event.js";
import { EventType, Gesture } from "../../touch.js";
import { Delayer } from "../../../common/async.js";
import { memoize } from "../../../common/decorators.js";
import { Emitter } from "../../../common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../common/lifecycle.js";
import { isMacintosh } from "../../../common/platform.js";
import "./sash.css";
const DEBUG = false;
var OrthogonalEdge = /* @__PURE__ */ ((OrthogonalEdge2) => {
  OrthogonalEdge2["North"] = "north";
  OrthogonalEdge2["South"] = "south";
  OrthogonalEdge2["East"] = "east";
  OrthogonalEdge2["West"] = "west";
  return OrthogonalEdge2;
})(OrthogonalEdge || {});
var Orientation = /* @__PURE__ */ ((Orientation2) => {
  Orientation2[Orientation2["VERTICAL"] = 0] = "VERTICAL";
  Orientation2[Orientation2["HORIZONTAL"] = 1] = "HORIZONTAL";
  return Orientation2;
})(Orientation || {});
var SashState = /* @__PURE__ */ ((SashState2) => {
  SashState2[SashState2["Disabled"] = 0] = "Disabled";
  SashState2[SashState2["AtMinimum"] = 1] = "AtMinimum";
  SashState2[SashState2["AtMaximum"] = 2] = "AtMaximum";
  SashState2[SashState2["Enabled"] = 3] = "Enabled";
  return SashState2;
})(SashState || {});
let globalSize = 4;
const onDidChangeGlobalSize = new Emitter();
function setGlobalSashSize(size) {
  globalSize = size;
  onDidChangeGlobalSize.fire(size);
}
let globalHoverDelay = 300;
const onDidChangeHoverDelay = new Emitter();
function setGlobalHoverDelay(size) {
  globalHoverDelay = size;
  onDidChangeHoverDelay.fire(size);
}
class MouseEventFactory {
  constructor(el) {
    this.el = el;
    this.disposables = new DisposableStore();
  }
  get onPointerMove() {
    return this.disposables.add(new DomEmitter(getWindow(this.el), "mousemove")).event;
  }
  get onPointerUp() {
    return this.disposables.add(new DomEmitter(getWindow(this.el), "mouseup")).event;
  }
  dispose() {
    this.disposables.dispose();
  }
}
__decorateClass([
  memoize
], MouseEventFactory.prototype, "onPointerMove", 1);
__decorateClass([
  memoize
], MouseEventFactory.prototype, "onPointerUp", 1);
class GestureEventFactory {
  constructor(el) {
    this.el = el;
    this.disposables = new DisposableStore();
  }
  get onPointerMove() {
    return this.disposables.add(new DomEmitter(this.el, EventType.Change)).event;
  }
  get onPointerUp() {
    return this.disposables.add(new DomEmitter(this.el, EventType.End)).event;
  }
  dispose() {
    this.disposables.dispose();
  }
}
__decorateClass([
  memoize
], GestureEventFactory.prototype, "onPointerMove", 1);
__decorateClass([
  memoize
], GestureEventFactory.prototype, "onPointerUp", 1);
class OrthogonalPointerEventFactory {
  constructor(factory) {
    this.factory = factory;
  }
  get onPointerMove() {
    return this.factory.onPointerMove;
  }
  get onPointerUp() {
    return this.factory.onPointerUp;
  }
  dispose() {
  }
}
__decorateClass([
  memoize
], OrthogonalPointerEventFactory.prototype, "onPointerMove", 1);
__decorateClass([
  memoize
], OrthogonalPointerEventFactory.prototype, "onPointerUp", 1);
const PointerEventsDisabledCssClass = "pointer-events-disabled";
class Sash extends Disposable {
  constructor(container, layoutProvider, options) {
    super();
    this.hoverDelay = globalHoverDelay;
    this.hoverDelayer = this._register(new Delayer(this.hoverDelay));
    this._state = 3 /* Enabled */;
    this.onDidEnablementChange = this._register(new Emitter());
    this._onDidStart = this._register(new Emitter());
    this._onDidChange = this._register(new Emitter());
    this._onDidReset = this._register(new Emitter());
    this._onDidEnd = this._register(new Emitter());
    this.orthogonalStartSashDisposables = this._register(new DisposableStore());
    this.orthogonalStartDragHandleDisposables = this._register(new DisposableStore());
    this.orthogonalEndSashDisposables = this._register(new DisposableStore());
    this.orthogonalEndDragHandleDisposables = this._register(new DisposableStore());
    /**
     * An event which fires whenever the user starts dragging this sash.
     */
    this.onDidStart = this._onDidStart.event;
    /**
     * An event which fires whenever the user moves the mouse while
     * dragging this sash.
     */
    this.onDidChange = this._onDidChange.event;
    /**
     * An event which fires whenever the user double clicks this sash.
     */
    this.onDidReset = this._onDidReset.event;
    /**
     * An event which fires whenever the user stops dragging this sash.
     */
    this.onDidEnd = this._onDidEnd.event;
    /**
     * A linked sash will be forwarded the same user interactions and events
     * so it moves exactly the same way as this sash.
     *
     * Useful in 2x2 grids. Not meant for widespread usage.
     */
    this.linkedSash = void 0;
    this.el = append(container, $(".monaco-sash"));
    if (options.orthogonalEdge) {
      this.el.classList.add(`orthogonal-edge-${options.orthogonalEdge}`);
    }
    if (isMacintosh) {
      this.el.classList.add("mac");
    }
    const onMouseDown = this._register(new DomEmitter(this.el, "mousedown")).event;
    this._register(onMouseDown((e) => this.onPointerStart(e, new MouseEventFactory(container)), this));
    const onMouseDoubleClick = this._register(new DomEmitter(this.el, "dblclick")).event;
    this._register(onMouseDoubleClick(this.onPointerDoublePress, this));
    const onMouseEnter = this._register(new DomEmitter(this.el, "mouseenter")).event;
    this._register(onMouseEnter(() => Sash.onMouseEnter(this)));
    const onMouseLeave = this._register(new DomEmitter(this.el, "mouseleave")).event;
    this._register(onMouseLeave(() => Sash.onMouseLeave(this)));
    this._register(Gesture.addTarget(this.el));
    const onTouchStart = this._register(new DomEmitter(this.el, EventType.Start)).event;
    this._register(onTouchStart((e) => this.onPointerStart(e, new GestureEventFactory(this.el)), this));
    const onTap = this._register(new DomEmitter(this.el, EventType.Tap)).event;
    let doubleTapTimeout = void 0;
    this._register(onTap((event) => {
      if (doubleTapTimeout) {
        clearTimeout(doubleTapTimeout);
        doubleTapTimeout = void 0;
        this.onPointerDoublePress(event);
        return;
      }
      clearTimeout(doubleTapTimeout);
      doubleTapTimeout = setTimeout(() => doubleTapTimeout = void 0, 250);
    }, this));
    if (typeof options.size === "number") {
      this.size = options.size;
      if (options.orientation === 0 /* VERTICAL */) {
        this.el.style.width = `${this.size}px`;
      } else {
        this.el.style.height = `${this.size}px`;
      }
    } else {
      this.size = globalSize;
      this._register(onDidChangeGlobalSize.event((size) => {
        this.size = size;
        this.layout();
      }));
    }
    this._register(onDidChangeHoverDelay.event((delay) => this.hoverDelay = delay));
    this.layoutProvider = layoutProvider;
    this.orthogonalStartSash = options.orthogonalStartSash;
    this.orthogonalEndSash = options.orthogonalEndSash;
    this.orientation = options.orientation || 0 /* VERTICAL */;
    if (this.orientation === 1 /* HORIZONTAL */) {
      this.el.classList.add("horizontal");
      this.el.classList.remove("vertical");
    } else {
      this.el.classList.remove("horizontal");
      this.el.classList.add("vertical");
    }
    this.el.classList.toggle("debug", DEBUG);
    this.layout();
  }
  get state() {
    return this._state;
  }
  get orthogonalStartSash() {
    return this._orthogonalStartSash;
  }
  get orthogonalEndSash() {
    return this._orthogonalEndSash;
  }
  /**
   * The state of a sash defines whether it can be interacted with by the user
   * as well as what mouse cursor to use, when hovered.
   */
  set state(state) {
    if (this._state === state) {
      return;
    }
    this.el.classList.toggle("disabled", state === 0 /* Disabled */);
    this.el.classList.toggle("minimum", state === 1 /* AtMinimum */);
    this.el.classList.toggle("maximum", state === 2 /* AtMaximum */);
    this._state = state;
    this.onDidEnablementChange.fire(state);
  }
  /**
   * A reference to another sash, perpendicular to this one, which
   * aligns at the start of this one. A corner sash will be created
   * automatically at that location.
   *
   * The start of a horizontal sash is its left-most position.
   * The start of a vertical sash is its top-most position.
   */
  set orthogonalStartSash(sash) {
    if (this._orthogonalStartSash === sash) {
      return;
    }
    this.orthogonalStartDragHandleDisposables.clear();
    this.orthogonalStartSashDisposables.clear();
    if (sash) {
      const onChange = (state) => {
        this.orthogonalStartDragHandleDisposables.clear();
        if (state !== 0 /* Disabled */) {
          this._orthogonalStartDragHandle = append(this.el, $(".orthogonal-drag-handle.start"));
          this.orthogonalStartDragHandleDisposables.add(toDisposable(() => this._orthogonalStartDragHandle.remove()));
          this.orthogonalStartDragHandleDisposables.add(new DomEmitter(this._orthogonalStartDragHandle, "mouseenter")).event(() => Sash.onMouseEnter(sash), void 0, this.orthogonalStartDragHandleDisposables);
          this.orthogonalStartDragHandleDisposables.add(new DomEmitter(this._orthogonalStartDragHandle, "mouseleave")).event(() => Sash.onMouseLeave(sash), void 0, this.orthogonalStartDragHandleDisposables);
        }
      };
      this.orthogonalStartSashDisposables.add(sash.onDidEnablementChange.event(onChange, this));
      onChange(sash.state);
    }
    this._orthogonalStartSash = sash;
  }
  /**
   * A reference to another sash, perpendicular to this one, which
   * aligns at the end of this one. A corner sash will be created
   * automatically at that location.
   *
   * The end of a horizontal sash is its right-most position.
   * The end of a vertical sash is its bottom-most position.
   */
  set orthogonalEndSash(sash) {
    if (this._orthogonalEndSash === sash) {
      return;
    }
    this.orthogonalEndDragHandleDisposables.clear();
    this.orthogonalEndSashDisposables.clear();
    if (sash) {
      const onChange = (state) => {
        this.orthogonalEndDragHandleDisposables.clear();
        if (state !== 0 /* Disabled */) {
          this._orthogonalEndDragHandle = append(this.el, $(".orthogonal-drag-handle.end"));
          this.orthogonalEndDragHandleDisposables.add(toDisposable(() => this._orthogonalEndDragHandle.remove()));
          this.orthogonalEndDragHandleDisposables.add(new DomEmitter(this._orthogonalEndDragHandle, "mouseenter")).event(() => Sash.onMouseEnter(sash), void 0, this.orthogonalEndDragHandleDisposables);
          this.orthogonalEndDragHandleDisposables.add(new DomEmitter(this._orthogonalEndDragHandle, "mouseleave")).event(() => Sash.onMouseLeave(sash), void 0, this.orthogonalEndDragHandleDisposables);
        }
      };
      this.orthogonalEndSashDisposables.add(sash.onDidEnablementChange.event(onChange, this));
      onChange(sash.state);
    }
    this._orthogonalEndSash = sash;
  }
  onPointerStart(event, pointerEventFactory) {
    EventHelper.stop(event);
    let isMultisashResize = false;
    if (!event.__orthogonalSashEvent) {
      const orthogonalSash = this.getOrthogonalSash(event);
      if (orthogonalSash) {
        isMultisashResize = true;
        event.__orthogonalSashEvent = true;
        orthogonalSash.onPointerStart(event, new OrthogonalPointerEventFactory(pointerEventFactory));
      }
    }
    if (this.linkedSash && !event.__linkedSashEvent) {
      event.__linkedSashEvent = true;
      this.linkedSash.onPointerStart(event, new OrthogonalPointerEventFactory(pointerEventFactory));
    }
    if (!this.state) {
      return;
    }
    const iframes = this.el.ownerDocument.getElementsByTagName("iframe");
    for (const iframe of iframes) {
      iframe.classList.add(PointerEventsDisabledCssClass);
    }
    const startX = event.pageX;
    const startY = event.pageY;
    const altKey = event.altKey;
    const startEvent = { startX, currentX: startX, startY, currentY: startY, altKey };
    this.el.classList.add("active");
    this._onDidStart.fire(startEvent);
    const style = createStyleSheet(this.el);
    const updateStyle = () => {
      let cursor = "";
      if (isMultisashResize) {
        cursor = "all-scroll";
      } else if (this.orientation === 1 /* HORIZONTAL */) {
        if (this.state === 1 /* AtMinimum */) {
          cursor = "s-resize";
        } else if (this.state === 2 /* AtMaximum */) {
          cursor = "n-resize";
        } else {
          cursor = isMacintosh ? "row-resize" : "ns-resize";
        }
      } else {
        if (this.state === 1 /* AtMinimum */) {
          cursor = "e-resize";
        } else if (this.state === 2 /* AtMaximum */) {
          cursor = "w-resize";
        } else {
          cursor = isMacintosh ? "col-resize" : "ew-resize";
        }
      }
      style.textContent = `* { cursor: ${cursor} !important; }`;
    };
    const disposables = new DisposableStore();
    updateStyle();
    if (!isMultisashResize) {
      this.onDidEnablementChange.event(updateStyle, null, disposables);
    }
    const onPointerMove = (e) => {
      EventHelper.stop(e, false);
      const event2 = { startX, currentX: e.pageX, startY, currentY: e.pageY, altKey };
      this._onDidChange.fire(event2);
    };
    const onPointerUp = (e) => {
      EventHelper.stop(e, false);
      style.remove();
      this.el.classList.remove("active");
      this._onDidEnd.fire();
      disposables.dispose();
      for (const iframe of iframes) {
        iframe.classList.remove(PointerEventsDisabledCssClass);
      }
    };
    pointerEventFactory.onPointerMove(onPointerMove, null, disposables);
    pointerEventFactory.onPointerUp(onPointerUp, null, disposables);
    disposables.add(pointerEventFactory);
  }
  onPointerDoublePress(e) {
    const orthogonalSash = this.getOrthogonalSash(e);
    if (orthogonalSash) {
      orthogonalSash._onDidReset.fire();
    }
    if (this.linkedSash) {
      this.linkedSash._onDidReset.fire();
    }
    this._onDidReset.fire();
  }
  static onMouseEnter(sash, fromLinkedSash = false) {
    if (sash.el.classList.contains("active")) {
      sash.hoverDelayer.cancel();
      sash.el.classList.add("hover");
    } else {
      sash.hoverDelayer.trigger(() => sash.el.classList.add("hover"), sash.hoverDelay).then(void 0, () => {
      });
    }
    if (!fromLinkedSash && sash.linkedSash) {
      Sash.onMouseEnter(sash.linkedSash, true);
    }
  }
  static onMouseLeave(sash, fromLinkedSash = false) {
    sash.hoverDelayer.cancel();
    sash.el.classList.remove("hover");
    if (!fromLinkedSash && sash.linkedSash) {
      Sash.onMouseLeave(sash.linkedSash, true);
    }
  }
  /**
   * Forcefully stop any user interactions with this sash.
   * Useful when hiding a parent component, while the user is still
   * interacting with the sash.
   */
  clearSashHoverState() {
    Sash.onMouseLeave(this);
  }
  /**
   * Layout the sash. The sash will size and position itself
   * based on its provided {@link ISashLayoutProvider layout provider}.
   */
  layout() {
    if (this.orientation === 0 /* VERTICAL */) {
      const verticalProvider = this.layoutProvider;
      this.el.style.left = verticalProvider.getVerticalSashLeft(this) - this.size / 2 + "px";
      if (verticalProvider.getVerticalSashTop) {
        this.el.style.top = verticalProvider.getVerticalSashTop(this) + "px";
      }
      if (verticalProvider.getVerticalSashHeight) {
        this.el.style.height = verticalProvider.getVerticalSashHeight(this) + "px";
      }
    } else {
      const horizontalProvider = this.layoutProvider;
      this.el.style.top = horizontalProvider.getHorizontalSashTop(this) - this.size / 2 + "px";
      if (horizontalProvider.getHorizontalSashLeft) {
        this.el.style.left = horizontalProvider.getHorizontalSashLeft(this) + "px";
      }
      if (horizontalProvider.getHorizontalSashWidth) {
        this.el.style.width = horizontalProvider.getHorizontalSashWidth(this) + "px";
      }
    }
  }
  getOrthogonalSash(e) {
    const target = e.initialTarget ?? e.target;
    if (!target || !isHTMLElement(target)) {
      return void 0;
    }
    if (target.classList.contains("orthogonal-drag-handle")) {
      return target.classList.contains("start") ? this.orthogonalStartSash : this.orthogonalEndSash;
    }
    return void 0;
  }
  dispose() {
    super.dispose();
    this.el.remove();
  }
}
export {
  Orientation,
  OrthogonalEdge,
  Sash,
  SashState,
  setGlobalHoverDelay,
  setGlobalSashSize
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvc2FzaC9zYXNoLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgJCwgYXBwZW5kLCBFdmVudEhlbHBlciwgRXZlbnRMaWtlLCBnZXRXaW5kb3csIGlzSFRNTEVsZW1lbnQgfSBmcm9tICcuLi8uLi9kb20uanMnO1xuaW1wb3J0IHsgY3JlYXRlU3R5bGVTaGVldCB9IGZyb20gJy4uLy4uL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IERvbUVtaXR0ZXIgfSBmcm9tICcuLi8uLi9ldmVudC5qcyc7XG5pbXBvcnQgeyBFdmVudFR5cGUsIEdlc3R1cmUgfSBmcm9tICcuLi8uLi90b3VjaC5qcyc7XG5pbXBvcnQgeyBEZWxheWVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0ICcuL3Nhc2guY3NzJztcblxuLyoqXG4gKiBBbGxvdyB0aGUgc2FzaGVzIHRvIGJlIHZpc2libGUgYXQgcnVudGltZS5cbiAqIEByZW1hcmsgVXNlIGZvciBkZXZlbG9wbWVudCBwdXJwb3NlcyBvbmx5LlxuICovXG5jb25zdCBERUJVRyA9IGZhbHNlO1xuLy8gREVCVUcgPSBCb29sZWFuKFwidHJ1ZVwiKTsgLy8gZG9uZSBcIndlaXJkbHlcIiBzbyB0aGF0IGEgbGludCB3YXJuaW5nIHByZXZlbnRzIHlvdSBmcm9tIHB1c2hpbmcgdGhpc1xuXG4vKipcbiAqIEEgdmVydGljYWwgc2FzaCBsYXlvdXQgcHJvdmlkZXIgcHJvdmlkZXMgcG9zaXRpb24gYW5kIGhlaWdodCBmb3IgYSBzYXNoLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElWZXJ0aWNhbFNhc2hMYXlvdXRQcm92aWRlciB7XG5cdGdldFZlcnRpY2FsU2FzaExlZnQoc2FzaDogU2FzaCk6IG51bWJlcjtcblx0Z2V0VmVydGljYWxTYXNoVG9wPyhzYXNoOiBTYXNoKTogbnVtYmVyO1xuXHRnZXRWZXJ0aWNhbFNhc2hIZWlnaHQ/KHNhc2g6IFNhc2gpOiBudW1iZXI7XG59XG5cbi8qKlxuICogQSB2ZXJ0aWNhbCBzYXNoIGxheW91dCBwcm92aWRlciBwcm92aWRlcyBwb3NpdGlvbiBhbmQgd2lkdGggZm9yIGEgc2FzaC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJSG9yaXpvbnRhbFNhc2hMYXlvdXRQcm92aWRlciB7XG5cdGdldEhvcml6b250YWxTYXNoVG9wKHNhc2g6IFNhc2gpOiBudW1iZXI7XG5cdGdldEhvcml6b250YWxTYXNoTGVmdD8oc2FzaDogU2FzaCk6IG51bWJlcjtcblx0Z2V0SG9yaXpvbnRhbFNhc2hXaWR0aD8oc2FzaDogU2FzaCk6IG51bWJlcjtcbn1cblxudHlwZSBJU2FzaExheW91dFByb3ZpZGVyID0gSVZlcnRpY2FsU2FzaExheW91dFByb3ZpZGVyIHwgSUhvcml6b250YWxTYXNoTGF5b3V0UHJvdmlkZXI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNhc2hFdmVudCB7XG5cdHJlYWRvbmx5IHN0YXJ0WDogbnVtYmVyO1xuXHRyZWFkb25seSBjdXJyZW50WDogbnVtYmVyO1xuXHRyZWFkb25seSBzdGFydFk6IG51bWJlcjtcblx0cmVhZG9ubHkgY3VycmVudFk6IG51bWJlcjtcblx0cmVhZG9ubHkgYWx0S2V5OiBib29sZWFuO1xufVxuXG5leHBvcnQgZW51bSBPcnRob2dvbmFsRWRnZSB7XG5cdE5vcnRoID0gJ25vcnRoJyxcblx0U291dGggPSAnc291dGgnLFxuXHRFYXN0ID0gJ2Vhc3QnLFxuXHRXZXN0ID0gJ3dlc3QnXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJvdW5kYXJ5U2FzaGVzIHtcblx0cmVhZG9ubHkgdG9wPzogU2FzaDtcblx0cmVhZG9ubHkgcmlnaHQ/OiBTYXNoO1xuXHRyZWFkb25seSBib3R0b20/OiBTYXNoO1xuXHRyZWFkb25seSBsZWZ0PzogU2FzaDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2FzaE9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIGEgc2FzaCBpcyBob3Jpem9udGFsIG9yIHZlcnRpY2FsLlxuXHQgKi9cblx0cmVhZG9ubHkgb3JpZW50YXRpb246IE9yaWVudGF0aW9uO1xuXG5cdC8qKlxuXHQgKiBUaGUgd2lkdGggb3IgaGVpZ2h0IG9mIGEgdmVydGljYWwgb3IgaG9yaXpvbnRhbCBzYXNoLCByZXNwZWN0aXZlbHkuXG5cdCAqL1xuXHRyZWFkb25seSBzaXplPzogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBBIHJlZmVyZW5jZSB0byBhbm90aGVyIHNhc2gsIHBlcnBlbmRpY3VsYXIgdG8gdGhpcyBvbmUsIHdoaWNoXG5cdCAqIGFsaWducyBhdCB0aGUgc3RhcnQgb2YgdGhpcyBvbmUuIEEgY29ybmVyIHNhc2ggd2lsbCBiZSBjcmVhdGVkXG5cdCAqIGF1dG9tYXRpY2FsbHkgYXQgdGhhdCBsb2NhdGlvbi5cblx0ICpcblx0ICogVGhlIHN0YXJ0IG9mIGEgaG9yaXpvbnRhbCBzYXNoIGlzIGl0cyBsZWZ0LW1vc3QgcG9zaXRpb24uXG5cdCAqIFRoZSBzdGFydCBvZiBhIHZlcnRpY2FsIHNhc2ggaXMgaXRzIHRvcC1tb3N0IHBvc2l0aW9uLlxuXHQgKi9cblx0cmVhZG9ubHkgb3J0aG9nb25hbFN0YXJ0U2FzaD86IFNhc2g7XG5cblx0LyoqXG5cdCAqIEEgcmVmZXJlbmNlIHRvIGFub3RoZXIgc2FzaCwgcGVycGVuZGljdWxhciB0byB0aGlzIG9uZSwgd2hpY2hcblx0ICogYWxpZ25zIGF0IHRoZSBlbmQgb2YgdGhpcyBvbmUuIEEgY29ybmVyIHNhc2ggd2lsbCBiZSBjcmVhdGVkXG5cdCAqIGF1dG9tYXRpY2FsbHkgYXQgdGhhdCBsb2NhdGlvbi5cblx0ICpcblx0ICogVGhlIGVuZCBvZiBhIGhvcml6b250YWwgc2FzaCBpcyBpdHMgcmlnaHQtbW9zdCBwb3NpdGlvbi5cblx0ICogVGhlIGVuZCBvZiBhIHZlcnRpY2FsIHNhc2ggaXMgaXRzIGJvdHRvbS1tb3N0IHBvc2l0aW9uLlxuXHQgKi9cblx0cmVhZG9ubHkgb3J0aG9nb25hbEVuZFNhc2g/OiBTYXNoO1xuXG5cdC8qKlxuXHQgKiBQcm92aWRlcyBhIGhpbnQgYXMgdG8gd2hhdCBtb3VzZSBjdXJzb3IgdG8gdXNlIHdoZW5ldmVyIHRoZSB1c2VyXG5cdCAqIGhvdmVycyBvdmVyIGEgY29ybmVyIHNhc2ggcHJvdmlkZWQgYnkgdGhpcyBhbmQgYW4gb3J0aG9nb25hbCBzYXNoLlxuXHQgKi9cblx0cmVhZG9ubHkgb3J0aG9nb25hbEVkZ2U/OiBPcnRob2dvbmFsRWRnZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVmVydGljYWxTYXNoT3B0aW9ucyBleHRlbmRzIElTYXNoT3B0aW9ucyB7XG5cdHJlYWRvbmx5IG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbi5WRVJUSUNBTDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJSG9yaXpvbnRhbFNhc2hPcHRpb25zIGV4dGVuZHMgSVNhc2hPcHRpb25zIHtcblx0cmVhZG9ubHkgb3JpZW50YXRpb246IE9yaWVudGF0aW9uLkhPUklaT05UQUw7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIE9yaWVudGF0aW9uIHtcblx0VkVSVElDQUwsXG5cdEhPUklaT05UQUxcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gU2FzaFN0YXRlIHtcblxuXHQvKipcblx0ICogRGlzYWJsZSBhbnkgVUkgaW50ZXJhY3Rpb24uXG5cdCAqL1xuXHREaXNhYmxlZCxcblxuXHQvKipcblx0ICogQWxsb3cgZHJhZ2dpbmcgZG93biBvciB0byB0aGUgcmlnaHQsIGRlcGVuZGluZyBvbiB0aGUgc2FzaCBvcmllbnRhdGlvbi5cblx0ICpcblx0ICogU29tZSBPU3MgYWxsb3cgY3VzdG9taXppbmcgdGhlIG1vdXNlIGN1cnNvciBkaWZmZXJlbnRseSB3aGVuZXZlclxuXHQgKiBzb21lIHJlc2l6YWJsZSBjb21wb25lbnQgY2FuJ3QgYmUgYW55IHNtYWxsZXIsIGJ1dCBjYW4gYmUgbGFyZ2VyLlxuXHQgKi9cblx0QXRNaW5pbXVtLFxuXG5cdC8qKlxuXHQgKiBBbGxvdyBkcmFnZ2luZyB1cCBvciB0byB0aGUgbGVmdCwgZGVwZW5kaW5nIG9uIHRoZSBzYXNoIG9yaWVudGF0aW9uLlxuXHQgKlxuXHQgKiBTb21lIE9TcyBhbGxvdyBjdXN0b21pemluZyB0aGUgbW91c2UgY3Vyc29yIGRpZmZlcmVudGx5IHdoZW5ldmVyXG5cdCAqIHNvbWUgcmVzaXphYmxlIGNvbXBvbmVudCBjYW4ndCBiZSBhbnkgbGFyZ2VyLCBidXQgY2FuIGJlIHNtYWxsZXIuXG5cdCAqL1xuXHRBdE1heGltdW0sXG5cblx0LyoqXG5cdCAqIEVuYWJsZSBkcmFnZ2luZy5cblx0ICovXG5cdEVuYWJsZWRcbn1cblxubGV0IGdsb2JhbFNpemUgPSA0O1xuY29uc3Qgb25EaWRDaGFuZ2VHbG9iYWxTaXplID0gbmV3IEVtaXR0ZXI8bnVtYmVyPigpO1xuZXhwb3J0IGZ1bmN0aW9uIHNldEdsb2JhbFNhc2hTaXplKHNpemU6IG51bWJlcik6IHZvaWQge1xuXHRnbG9iYWxTaXplID0gc2l6ZTtcblx0b25EaWRDaGFuZ2VHbG9iYWxTaXplLmZpcmUoc2l6ZSk7XG59XG5cbmxldCBnbG9iYWxIb3ZlckRlbGF5ID0gMzAwO1xuY29uc3Qgb25EaWRDaGFuZ2VIb3ZlckRlbGF5ID0gbmV3IEVtaXR0ZXI8bnVtYmVyPigpO1xuZXhwb3J0IGZ1bmN0aW9uIHNldEdsb2JhbEhvdmVyRGVsYXkoc2l6ZTogbnVtYmVyKTogdm9pZCB7XG5cdGdsb2JhbEhvdmVyRGVsYXkgPSBzaXplO1xuXHRvbkRpZENoYW5nZUhvdmVyRGVsYXkuZmlyZShzaXplKTtcbn1cblxuaW50ZXJmYWNlIFBvaW50ZXJFdmVudCBleHRlbmRzIEV2ZW50TGlrZSB7XG5cdHJlYWRvbmx5IHBhZ2VYOiBudW1iZXI7XG5cdHJlYWRvbmx5IHBhZ2VZOiBudW1iZXI7XG5cdHJlYWRvbmx5IGFsdEtleTogYm9vbGVhbjtcblx0cmVhZG9ubHkgdGFyZ2V0OiBFdmVudFRhcmdldCB8IG51bGw7XG5cdHJlYWRvbmx5IGluaXRpYWxUYXJnZXQ/OiBFdmVudFRhcmdldCB8IHVuZGVmaW5lZDtcbn1cblxuaW50ZXJmYWNlIElQb2ludGVyRXZlbnRGYWN0b3J5IHtcblx0cmVhZG9ubHkgb25Qb2ludGVyTW92ZTogRXZlbnQ8UG9pbnRlckV2ZW50Pjtcblx0cmVhZG9ubHkgb25Qb2ludGVyVXA6IEV2ZW50PFBvaW50ZXJFdmVudD47XG5cdGRpc3Bvc2UoKTogdm9pZDtcbn1cblxuY2xhc3MgTW91c2VFdmVudEZhY3RvcnkgaW1wbGVtZW50cyBJUG9pbnRlckV2ZW50RmFjdG9yeSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGVsOiBIVE1MRWxlbWVudCkgeyB9XG5cblx0QG1lbW9pemVcblx0Z2V0IG9uUG9pbnRlck1vdmUoKTogRXZlbnQ8UG9pbnRlckV2ZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKGdldFdpbmRvdyh0aGlzLmVsKSwgJ21vdXNlbW92ZScpKS5ldmVudDtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGdldCBvblBvaW50ZXJVcCgpOiBFdmVudDxQb2ludGVyRXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIoZ2V0V2luZG93KHRoaXMuZWwpLCAnbW91c2V1cCcpKS5ldmVudDtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgR2VzdHVyZUV2ZW50RmFjdG9yeSBpbXBsZW1lbnRzIElQb2ludGVyRXZlbnRGYWN0b3J5IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdEBtZW1vaXplXG5cdGdldCBvblBvaW50ZXJNb3ZlKCk6IEV2ZW50PFBvaW50ZXJFdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcih0aGlzLmVsLCBFdmVudFR5cGUuQ2hhbmdlKSkuZXZlbnQ7XG5cdH1cblxuXHRAbWVtb2l6ZVxuXHRnZXQgb25Qb2ludGVyVXAoKTogRXZlbnQ8UG9pbnRlckV2ZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHRoaXMuZWwsIEV2ZW50VHlwZS5FbmQpKS5ldmVudDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgZWw6IEhUTUxFbGVtZW50KSB7IH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIE9ydGhvZ29uYWxQb2ludGVyRXZlbnRGYWN0b3J5IGltcGxlbWVudHMgSVBvaW50ZXJFdmVudEZhY3Rvcnkge1xuXG5cdEBtZW1vaXplXG5cdGdldCBvblBvaW50ZXJNb3ZlKCk6IEV2ZW50PFBvaW50ZXJFdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLmZhY3Rvcnkub25Qb2ludGVyTW92ZTtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGdldCBvblBvaW50ZXJVcCgpOiBFdmVudDxQb2ludGVyRXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5mYWN0b3J5Lm9uUG9pbnRlclVwO1xuXHR9XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBmYWN0b3J5OiBJUG9pbnRlckV2ZW50RmFjdG9yeSkgeyB9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHQvLyBub29wXG5cdH1cbn1cblxuY29uc3QgUG9pbnRlckV2ZW50c0Rpc2FibGVkQ3NzQ2xhc3MgPSAncG9pbnRlci1ldmVudHMtZGlzYWJsZWQnO1xuXG4vKipcbiAqIFRoZSB7QGxpbmsgU2FzaH0gaXMgdGhlIFVJIGNvbXBvbmVudCB3aGljaCBhbGxvd3MgdGhlIHVzZXIgdG8gcmVzaXplIG90aGVyXG4gKiBjb21wb25lbnRzLiBJdCdzIHVzdWFsbHkgYW4gaW52aXNpYmxlIGhvcml6b250YWwgb3IgdmVydGljYWwgbGluZSB3aGljaCwgd2hlblxuICogaG92ZXJlZCwgYmVjb21lcyBoaWdobGlnaHRlZCBhbmQgY2FuIGJlIGRyYWdnZWQgYWxvbmcgdGhlIHBlcnBlbmRpY3VsYXIgZGltZW5zaW9uXG4gKiB0byBpdHMgZGlyZWN0aW9uLlxuICpcbiAqIEZlYXR1cmVzOlxuICogLSBUb3VjaCBldmVudCBoYW5kbGluZ1xuICogLSBDb3JuZXIgc2FzaCBzdXBwb3J0XG4gKiAtIEhvdmVyIHdpdGggZGlmZmVyZW50IG1vdXNlIGN1cnNvciBzdXBwb3J0XG4gKiAtIENvbmZpZ3VyYWJsZSBob3ZlciBzaXplXG4gKiAtIExpbmtlZCBzYXNoIHN1cHBvcnQsIGZvciAyeDIgY29ybmVyIHNhc2hlc1xuICovXG5leHBvcnQgY2xhc3MgU2FzaCBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgZWw6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIGxheW91dFByb3ZpZGVyOiBJU2FzaExheW91dFByb3ZpZGVyO1xuXHRwcml2YXRlIG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbjtcblx0cHJpdmF0ZSBzaXplOiBudW1iZXI7XG5cdHByaXZhdGUgaG92ZXJEZWxheSA9IGdsb2JhbEhvdmVyRGVsYXk7XG5cdHByaXZhdGUgaG92ZXJEZWxheWVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IERlbGF5ZXIodGhpcy5ob3ZlckRlbGF5KSk7XG5cblx0cHJpdmF0ZSBfc3RhdGU6IFNhc2hTdGF0ZSA9IFNhc2hTdGF0ZS5FbmFibGVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uRGlkRW5hYmxlbWVudENoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFNhc2hTdGF0ZT4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU3RhcnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJU2FzaEV2ZW50PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJU2FzaEV2ZW50PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXNldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEVuZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9ydGhvZ29uYWxTdGFydFNhc2hEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgX29ydGhvZ29uYWxTdGFydFNhc2g6IFNhc2ggfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgb3J0aG9nb25hbFN0YXJ0RHJhZ0hhbmRsZURpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBfb3J0aG9nb25hbFN0YXJ0RHJhZ0hhbmRsZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgb3J0aG9nb25hbEVuZFNhc2hEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgX29ydGhvZ29uYWxFbmRTYXNoOiBTYXNoIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9ydGhvZ29uYWxFbmREcmFnSGFuZGxlRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIF9vcnRob2dvbmFsRW5kRHJhZ0hhbmRsZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0Z2V0IHN0YXRlKCk6IFNhc2hTdGF0ZSB7IHJldHVybiB0aGlzLl9zdGF0ZTsgfVxuXHRnZXQgb3J0aG9nb25hbFN0YXJ0U2FzaCgpOiBTYXNoIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX29ydGhvZ29uYWxTdGFydFNhc2g7IH1cblx0Z2V0IG9ydGhvZ29uYWxFbmRTYXNoKCk6IFNhc2ggfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fb3J0aG9nb25hbEVuZFNhc2g7IH1cblxuXHQvKipcblx0ICogVGhlIHN0YXRlIG9mIGEgc2FzaCBkZWZpbmVzIHdoZXRoZXIgaXQgY2FuIGJlIGludGVyYWN0ZWQgd2l0aCBieSB0aGUgdXNlclxuXHQgKiBhcyB3ZWxsIGFzIHdoYXQgbW91c2UgY3Vyc29yIHRvIHVzZSwgd2hlbiBob3ZlcmVkLlxuXHQgKi9cblx0c2V0IHN0YXRlKHN0YXRlOiBTYXNoU3RhdGUpIHtcblx0XHRpZiAodGhpcy5fc3RhdGUgPT09IHN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5lbC5jbGFzc0xpc3QudG9nZ2xlKCdkaXNhYmxlZCcsIHN0YXRlID09PSBTYXNoU3RhdGUuRGlzYWJsZWQpO1xuXHRcdHRoaXMuZWwuY2xhc3NMaXN0LnRvZ2dsZSgnbWluaW11bScsIHN0YXRlID09PSBTYXNoU3RhdGUuQXRNaW5pbXVtKTtcblx0XHR0aGlzLmVsLmNsYXNzTGlzdC50b2dnbGUoJ21heGltdW0nLCBzdGF0ZSA9PT0gU2FzaFN0YXRlLkF0TWF4aW11bSk7XG5cblx0XHR0aGlzLl9zdGF0ZSA9IHN0YXRlO1xuXHRcdHRoaXMub25EaWRFbmFibGVtZW50Q2hhbmdlLmZpcmUoc3RhdGUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFuIGV2ZW50IHdoaWNoIGZpcmVzIHdoZW5ldmVyIHRoZSB1c2VyIHN0YXJ0cyBkcmFnZ2luZyB0aGlzIHNhc2guXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZFN0YXJ0OiBFdmVudDxJU2FzaEV2ZW50PiA9IHRoaXMuX29uRGlkU3RhcnQuZXZlbnQ7XG5cblx0LyoqXG5cdCAqIEFuIGV2ZW50IHdoaWNoIGZpcmVzIHdoZW5ldmVyIHRoZSB1c2VyIG1vdmVzIHRoZSBtb3VzZSB3aGlsZVxuXHQgKiBkcmFnZ2luZyB0aGlzIHNhc2guXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8SVNhc2hFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHQvKipcblx0ICogQW4gZXZlbnQgd2hpY2ggZmlyZXMgd2hlbmV2ZXIgdGhlIHVzZXIgZG91YmxlIGNsaWNrcyB0aGlzIHNhc2guXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZFJlc2V0OiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkUmVzZXQuZXZlbnQ7XG5cblx0LyoqXG5cdCAqIEFuIGV2ZW50IHdoaWNoIGZpcmVzIHdoZW5ldmVyIHRoZSB1c2VyIHN0b3BzIGRyYWdnaW5nIHRoaXMgc2FzaC5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkRW5kOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkRW5kLmV2ZW50O1xuXG5cdC8qKlxuXHQgKiBBIGxpbmtlZCBzYXNoIHdpbGwgYmUgZm9yd2FyZGVkIHRoZSBzYW1lIHVzZXIgaW50ZXJhY3Rpb25zIGFuZCBldmVudHNcblx0ICogc28gaXQgbW92ZXMgZXhhY3RseSB0aGUgc2FtZSB3YXkgYXMgdGhpcyBzYXNoLlxuXHQgKlxuXHQgKiBVc2VmdWwgaW4gMngyIGdyaWRzLiBOb3QgbWVhbnQgZm9yIHdpZGVzcHJlYWQgdXNhZ2UuXG5cdCAqL1xuXHRsaW5rZWRTYXNoOiBTYXNoIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBBIHJlZmVyZW5jZSB0byBhbm90aGVyIHNhc2gsIHBlcnBlbmRpY3VsYXIgdG8gdGhpcyBvbmUsIHdoaWNoXG5cdCAqIGFsaWducyBhdCB0aGUgc3RhcnQgb2YgdGhpcyBvbmUuIEEgY29ybmVyIHNhc2ggd2lsbCBiZSBjcmVhdGVkXG5cdCAqIGF1dG9tYXRpY2FsbHkgYXQgdGhhdCBsb2NhdGlvbi5cblx0ICpcblx0ICogVGhlIHN0YXJ0IG9mIGEgaG9yaXpvbnRhbCBzYXNoIGlzIGl0cyBsZWZ0LW1vc3QgcG9zaXRpb24uXG5cdCAqIFRoZSBzdGFydCBvZiBhIHZlcnRpY2FsIHNhc2ggaXMgaXRzIHRvcC1tb3N0IHBvc2l0aW9uLlxuXHQgKi9cblx0c2V0IG9ydGhvZ29uYWxTdGFydFNhc2goc2FzaDogU2FzaCB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0aGlzLl9vcnRob2dvbmFsU3RhcnRTYXNoID09PSBzYXNoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5vcnRob2dvbmFsU3RhcnREcmFnSGFuZGxlRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0aGlzLm9ydGhvZ29uYWxTdGFydFNhc2hEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0aWYgKHNhc2gpIHtcblx0XHRcdGNvbnN0IG9uQ2hhbmdlID0gKHN0YXRlOiBTYXNoU3RhdGUpID0+IHtcblx0XHRcdFx0dGhpcy5vcnRob2dvbmFsU3RhcnREcmFnSGFuZGxlRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdFx0XHRpZiAoc3RhdGUgIT09IFNhc2hTdGF0ZS5EaXNhYmxlZCkge1xuXHRcdFx0XHRcdHRoaXMuX29ydGhvZ29uYWxTdGFydERyYWdIYW5kbGUgPSBhcHBlbmQodGhpcy5lbCwgJCgnLm9ydGhvZ29uYWwtZHJhZy1oYW5kbGUuc3RhcnQnKSk7XG5cdFx0XHRcdFx0dGhpcy5vcnRob2dvbmFsU3RhcnREcmFnSGFuZGxlRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9vcnRob2dvbmFsU3RhcnREcmFnSGFuZGxlIS5yZW1vdmUoKSkpO1xuXHRcdFx0XHRcdHRoaXMub3J0aG9nb25hbFN0YXJ0RHJhZ0hhbmRsZURpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcih0aGlzLl9vcnRob2dvbmFsU3RhcnREcmFnSGFuZGxlLCAnbW91c2VlbnRlcicpKS5ldmVudFxuXHRcdFx0XHRcdFx0KCgpID0+IFNhc2gub25Nb3VzZUVudGVyKHNhc2gpLCB1bmRlZmluZWQsIHRoaXMub3J0aG9nb25hbFN0YXJ0RHJhZ0hhbmRsZURpc3Bvc2FibGVzKTtcblx0XHRcdFx0XHR0aGlzLm9ydGhvZ29uYWxTdGFydERyYWdIYW5kbGVEaXNwb3NhYmxlcy5hZGQobmV3IERvbUVtaXR0ZXIodGhpcy5fb3J0aG9nb25hbFN0YXJ0RHJhZ0hhbmRsZSwgJ21vdXNlbGVhdmUnKSkuZXZlbnRcblx0XHRcdFx0XHRcdCgoKSA9PiBTYXNoLm9uTW91c2VMZWF2ZShzYXNoKSwgdW5kZWZpbmVkLCB0aGlzLm9ydGhvZ29uYWxTdGFydERyYWdIYW5kbGVEaXNwb3NhYmxlcyk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdHRoaXMub3J0aG9nb25hbFN0YXJ0U2FzaERpc3Bvc2FibGVzLmFkZChzYXNoLm9uRGlkRW5hYmxlbWVudENoYW5nZS5ldmVudChvbkNoYW5nZSwgdGhpcykpO1xuXHRcdFx0b25DaGFuZ2Uoc2FzaC5zdGF0ZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb3J0aG9nb25hbFN0YXJ0U2FzaCA9IHNhc2g7XG5cdH1cblxuXHQvKipcblx0ICogQSByZWZlcmVuY2UgdG8gYW5vdGhlciBzYXNoLCBwZXJwZW5kaWN1bGFyIHRvIHRoaXMgb25lLCB3aGljaFxuXHQgKiBhbGlnbnMgYXQgdGhlIGVuZCBvZiB0aGlzIG9uZS4gQSBjb3JuZXIgc2FzaCB3aWxsIGJlIGNyZWF0ZWRcblx0ICogYXV0b21hdGljYWxseSBhdCB0aGF0IGxvY2F0aW9uLlxuXHQgKlxuXHQgKiBUaGUgZW5kIG9mIGEgaG9yaXpvbnRhbCBzYXNoIGlzIGl0cyByaWdodC1tb3N0IHBvc2l0aW9uLlxuXHQgKiBUaGUgZW5kIG9mIGEgdmVydGljYWwgc2FzaCBpcyBpdHMgYm90dG9tLW1vc3QgcG9zaXRpb24uXG5cdCAqL1xuXG5cdHNldCBvcnRob2dvbmFsRW5kU2FzaChzYXNoOiBTYXNoIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRoaXMuX29ydGhvZ29uYWxFbmRTYXNoID09PSBzYXNoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5vcnRob2dvbmFsRW5kRHJhZ0hhbmRsZURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5vcnRob2dvbmFsRW5kU2FzaERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRpZiAoc2FzaCkge1xuXHRcdFx0Y29uc3Qgb25DaGFuZ2UgPSAoc3RhdGU6IFNhc2hTdGF0ZSkgPT4ge1xuXHRcdFx0XHR0aGlzLm9ydGhvZ29uYWxFbmREcmFnSGFuZGxlRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdFx0XHRpZiAoc3RhdGUgIT09IFNhc2hTdGF0ZS5EaXNhYmxlZCkge1xuXHRcdFx0XHRcdHRoaXMuX29ydGhvZ29uYWxFbmREcmFnSGFuZGxlID0gYXBwZW5kKHRoaXMuZWwsICQoJy5vcnRob2dvbmFsLWRyYWctaGFuZGxlLmVuZCcpKTtcblx0XHRcdFx0XHR0aGlzLm9ydGhvZ29uYWxFbmREcmFnSGFuZGxlRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9vcnRob2dvbmFsRW5kRHJhZ0hhbmRsZSEucmVtb3ZlKCkpKTtcblx0XHRcdFx0XHR0aGlzLm9ydGhvZ29uYWxFbmREcmFnSGFuZGxlRGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHRoaXMuX29ydGhvZ29uYWxFbmREcmFnSGFuZGxlLCAnbW91c2VlbnRlcicpKS5ldmVudFxuXHRcdFx0XHRcdFx0KCgpID0+IFNhc2gub25Nb3VzZUVudGVyKHNhc2gpLCB1bmRlZmluZWQsIHRoaXMub3J0aG9nb25hbEVuZERyYWdIYW5kbGVEaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0dGhpcy5vcnRob2dvbmFsRW5kRHJhZ0hhbmRsZURpc3Bvc2FibGVzLmFkZChuZXcgRG9tRW1pdHRlcih0aGlzLl9vcnRob2dvbmFsRW5kRHJhZ0hhbmRsZSwgJ21vdXNlbGVhdmUnKSkuZXZlbnRcblx0XHRcdFx0XHRcdCgoKSA9PiBTYXNoLm9uTW91c2VMZWF2ZShzYXNoKSwgdW5kZWZpbmVkLCB0aGlzLm9ydGhvZ29uYWxFbmREcmFnSGFuZGxlRGlzcG9zYWJsZXMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLm9ydGhvZ29uYWxFbmRTYXNoRGlzcG9zYWJsZXMuYWRkKHNhc2gub25EaWRFbmFibGVtZW50Q2hhbmdlLmV2ZW50KG9uQ2hhbmdlLCB0aGlzKSk7XG5cdFx0XHRvbkNoYW5nZShzYXNoLnN0YXRlKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vcnRob2dvbmFsRW5kU2FzaCA9IHNhc2g7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIGEgbmV3IHZlcnRpY2FsIHNhc2guXG5cdCAqXG5cdCAqIEBwYXJhbSBjb250YWluZXIgQSBET00gbm9kZSB0byBhcHBlbmQgdGhlIHNhc2ggdG8uXG5cdCAqIEBwYXJhbSB2ZXJ0aWNhbExheW91dFByb3ZpZGVyIEEgdmVydGljYWwgbGF5b3V0IHByb3ZpZGVyLlxuXHQgKiBAcGFyYW0gb3B0aW9ucyBUaGUgb3B0aW9ucy5cblx0ICovXG5cdGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHZlcnRpY2FsTGF5b3V0UHJvdmlkZXI6IElWZXJ0aWNhbFNhc2hMYXlvdXRQcm92aWRlciwgb3B0aW9uczogSVZlcnRpY2FsU2FzaE9wdGlvbnMpO1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBuZXcgaG9yaXpvbnRhbCBzYXNoLlxuXHQgKlxuXHQgKiBAcGFyYW0gY29udGFpbmVyIEEgRE9NIG5vZGUgdG8gYXBwZW5kIHRoZSBzYXNoIHRvLlxuXHQgKiBAcGFyYW0gaG9yaXpvbnRhbExheW91dFByb3ZpZGVyIEEgaG9yaXpvbnRhbCBsYXlvdXQgcHJvdmlkZXIuXG5cdCAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zLlxuXHQgKi9cblx0Y29uc3RydWN0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgaG9yaXpvbnRhbExheW91dFByb3ZpZGVyOiBJSG9yaXpvbnRhbFNhc2hMYXlvdXRQcm92aWRlciwgb3B0aW9uczogSUhvcml6b250YWxTYXNoT3B0aW9ucyk7XG5cdGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGxheW91dFByb3ZpZGVyOiBJU2FzaExheW91dFByb3ZpZGVyLCBvcHRpb25zOiBJU2FzaE9wdGlvbnMpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5lbCA9IGFwcGVuZChjb250YWluZXIsICQoJy5tb25hY28tc2FzaCcpKTtcblxuXHRcdGlmIChvcHRpb25zLm9ydGhvZ29uYWxFZGdlKSB7XG5cdFx0XHR0aGlzLmVsLmNsYXNzTGlzdC5hZGQoYG9ydGhvZ29uYWwtZWRnZS0ke29wdGlvbnMub3J0aG9nb25hbEVkZ2V9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHR0aGlzLmVsLmNsYXNzTGlzdC5hZGQoJ21hYycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9uTW91c2VEb3duID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5lbCwgJ21vdXNlZG93bicpKS5ldmVudDtcblx0XHR0aGlzLl9yZWdpc3Rlcihvbk1vdXNlRG93bihlID0+IHRoaXMub25Qb2ludGVyU3RhcnQoZSwgbmV3IE1vdXNlRXZlbnRGYWN0b3J5KGNvbnRhaW5lcikpLCB0aGlzKSk7XG5cdFx0Y29uc3Qgb25Nb3VzZURvdWJsZUNsaWNrID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5lbCwgJ2RibGNsaWNrJykpLmV2ZW50O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG9uTW91c2VEb3VibGVDbGljayh0aGlzLm9uUG9pbnRlckRvdWJsZVByZXNzLCB0aGlzKSk7XG5cdFx0Y29uc3Qgb25Nb3VzZUVudGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5lbCwgJ21vdXNlZW50ZXInKSkuZXZlbnQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIob25Nb3VzZUVudGVyKCgpID0+IFNhc2gub25Nb3VzZUVudGVyKHRoaXMpKSk7XG5cdFx0Y29uc3Qgb25Nb3VzZUxlYXZlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5lbCwgJ21vdXNlbGVhdmUnKSkuZXZlbnQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIob25Nb3VzZUxlYXZlKCgpID0+IFNhc2gub25Nb3VzZUxlYXZlKHRoaXMpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihHZXN0dXJlLmFkZFRhcmdldCh0aGlzLmVsKSk7XG5cblx0XHRjb25zdCBvblRvdWNoU3RhcnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcih0aGlzLmVsLCBFdmVudFR5cGUuU3RhcnQpKS5ldmVudDtcblx0XHR0aGlzLl9yZWdpc3RlcihvblRvdWNoU3RhcnQoZSA9PiB0aGlzLm9uUG9pbnRlclN0YXJ0KGUsIG5ldyBHZXN0dXJlRXZlbnRGYWN0b3J5KHRoaXMuZWwpKSwgdGhpcykpO1xuXHRcdGNvbnN0IG9uVGFwID0gdGhpcy5fcmVnaXN0ZXIobmV3IERvbUVtaXR0ZXIodGhpcy5lbCwgRXZlbnRUeXBlLlRhcCkpLmV2ZW50O1xuXG5cdFx0bGV0IGRvdWJsZVRhcFRpbWVvdXQ6IGFueSA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9yZWdpc3RlcihvblRhcChldmVudCA9PiB7XG5cdFx0XHRpZiAoZG91YmxlVGFwVGltZW91dCkge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQoZG91YmxlVGFwVGltZW91dCk7XG5cdFx0XHRcdGRvdWJsZVRhcFRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMub25Qb2ludGVyRG91YmxlUHJlc3MoZXZlbnQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNsZWFyVGltZW91dChkb3VibGVUYXBUaW1lb3V0KTtcblx0XHRcdGRvdWJsZVRhcFRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IGRvdWJsZVRhcFRpbWVvdXQgPSB1bmRlZmluZWQsIDI1MCk7XG5cdFx0fSwgdGhpcykpO1xuXG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zLnNpemUgPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLnNpemUgPSBvcHRpb25zLnNpemU7XG5cblx0XHRcdGlmIChvcHRpb25zLm9yaWVudGF0aW9uID09PSBPcmllbnRhdGlvbi5WRVJUSUNBTCkge1xuXHRcdFx0XHR0aGlzLmVsLnN0eWxlLndpZHRoID0gYCR7dGhpcy5zaXplfXB4YDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZWwuc3R5bGUuaGVpZ2h0ID0gYCR7dGhpcy5zaXplfXB4YDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zaXplID0gZ2xvYmFsU2l6ZTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKG9uRGlkQ2hhbmdlR2xvYmFsU2l6ZS5ldmVudChzaXplID0+IHtcblx0XHRcdFx0dGhpcy5zaXplID0gc2l6ZTtcblx0XHRcdFx0dGhpcy5sYXlvdXQoKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RlcihvbkRpZENoYW5nZUhvdmVyRGVsYXkuZXZlbnQoZGVsYXkgPT4gdGhpcy5ob3ZlckRlbGF5ID0gZGVsYXkpKTtcblxuXHRcdHRoaXMubGF5b3V0UHJvdmlkZXIgPSBsYXlvdXRQcm92aWRlcjtcblxuXHRcdHRoaXMub3J0aG9nb25hbFN0YXJ0U2FzaCA9IG9wdGlvbnMub3J0aG9nb25hbFN0YXJ0U2FzaDtcblx0XHR0aGlzLm9ydGhvZ29uYWxFbmRTYXNoID0gb3B0aW9ucy5vcnRob2dvbmFsRW5kU2FzaDtcblxuXHRcdHRoaXMub3JpZW50YXRpb24gPSBvcHRpb25zLm9yaWVudGF0aW9uIHx8IE9yaWVudGF0aW9uLlZFUlRJQ0FMO1xuXG5cdFx0aWYgKHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwpIHtcblx0XHRcdHRoaXMuZWwuY2xhc3NMaXN0LmFkZCgnaG9yaXpvbnRhbCcpO1xuXHRcdFx0dGhpcy5lbC5jbGFzc0xpc3QucmVtb3ZlKCd2ZXJ0aWNhbCcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmVsLmNsYXNzTGlzdC5yZW1vdmUoJ2hvcml6b250YWwnKTtcblx0XHRcdHRoaXMuZWwuY2xhc3NMaXN0LmFkZCgndmVydGljYWwnKTtcblx0XHR9XG5cblx0XHR0aGlzLmVsLmNsYXNzTGlzdC50b2dnbGUoJ2RlYnVnJywgREVCVUcpO1xuXG5cdFx0dGhpcy5sYXlvdXQoKTtcblx0fVxuXG5cdHByaXZhdGUgb25Qb2ludGVyU3RhcnQoZXZlbnQ6IFBvaW50ZXJFdmVudCwgcG9pbnRlckV2ZW50RmFjdG9yeTogSVBvaW50ZXJFdmVudEZhY3RvcnkpOiB2b2lkIHtcblx0XHRFdmVudEhlbHBlci5zdG9wKGV2ZW50KTtcblxuXHRcdGxldCBpc011bHRpc2FzaFJlc2l6ZSA9IGZhbHNlO1xuXG5cdFx0aWYgKCEoZXZlbnQgYXMgYW55KS5fX29ydGhvZ29uYWxTYXNoRXZlbnQpIHtcblx0XHRcdGNvbnN0IG9ydGhvZ29uYWxTYXNoID0gdGhpcy5nZXRPcnRob2dvbmFsU2FzaChldmVudCk7XG5cblx0XHRcdGlmIChvcnRob2dvbmFsU2FzaCkge1xuXHRcdFx0XHRpc011bHRpc2FzaFJlc2l6ZSA9IHRydWU7XG5cdFx0XHRcdChldmVudCBhcyBhbnkpLl9fb3J0aG9nb25hbFNhc2hFdmVudCA9IHRydWU7XG5cdFx0XHRcdG9ydGhvZ29uYWxTYXNoLm9uUG9pbnRlclN0YXJ0KGV2ZW50LCBuZXcgT3J0aG9nb25hbFBvaW50ZXJFdmVudEZhY3RvcnkocG9pbnRlckV2ZW50RmFjdG9yeSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmxpbmtlZFNhc2ggJiYgIShldmVudCBhcyBhbnkpLl9fbGlua2VkU2FzaEV2ZW50KSB7XG5cdFx0XHQoZXZlbnQgYXMgYW55KS5fX2xpbmtlZFNhc2hFdmVudCA9IHRydWU7XG5cdFx0XHR0aGlzLmxpbmtlZFNhc2gub25Qb2ludGVyU3RhcnQoZXZlbnQsIG5ldyBPcnRob2dvbmFsUG9pbnRlckV2ZW50RmFjdG9yeShwb2ludGVyRXZlbnRGYWN0b3J5KSk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaWZyYW1lcyA9IHRoaXMuZWwub3duZXJEb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaWZyYW1lJyk7XG5cdFx0Zm9yIChjb25zdCBpZnJhbWUgb2YgaWZyYW1lcykge1xuXHRcdFx0aWZyYW1lLmNsYXNzTGlzdC5hZGQoUG9pbnRlckV2ZW50c0Rpc2FibGVkQ3NzQ2xhc3MpOyAvLyBkaXNhYmxlIG1vdXNlIGV2ZW50cyBvbiBpZnJhbWVzIGFzIGxvbmcgYXMgd2UgZHJhZyB0aGUgc2FzaFxuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXJ0WCA9IGV2ZW50LnBhZ2VYO1xuXHRcdGNvbnN0IHN0YXJ0WSA9IGV2ZW50LnBhZ2VZO1xuXHRcdGNvbnN0IGFsdEtleSA9IGV2ZW50LmFsdEtleTtcblx0XHRjb25zdCBzdGFydEV2ZW50OiBJU2FzaEV2ZW50ID0geyBzdGFydFgsIGN1cnJlbnRYOiBzdGFydFgsIHN0YXJ0WSwgY3VycmVudFk6IHN0YXJ0WSwgYWx0S2V5IH07XG5cblx0XHR0aGlzLmVsLmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpO1xuXHRcdHRoaXMuX29uRGlkU3RhcnQuZmlyZShzdGFydEV2ZW50KTtcblxuXHRcdC8vIGZpeCBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjE2NzVcblx0XHRjb25zdCBzdHlsZSA9IGNyZWF0ZVN0eWxlU2hlZXQodGhpcy5lbCk7XG5cdFx0Y29uc3QgdXBkYXRlU3R5bGUgPSAoKSA9PiB7XG5cdFx0XHRsZXQgY3Vyc29yID0gJyc7XG5cblx0XHRcdGlmIChpc011bHRpc2FzaFJlc2l6ZSkge1xuXHRcdFx0XHRjdXJzb3IgPSAnYWxsLXNjcm9sbCc7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUwpIHtcblx0XHRcdFx0aWYgKHRoaXMuc3RhdGUgPT09IFNhc2hTdGF0ZS5BdE1pbmltdW0pIHtcblx0XHRcdFx0XHRjdXJzb3IgPSAncy1yZXNpemUnO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IFNhc2hTdGF0ZS5BdE1heGltdW0pIHtcblx0XHRcdFx0XHRjdXJzb3IgPSAnbi1yZXNpemUnO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGN1cnNvciA9IGlzTWFjaW50b3NoID8gJ3Jvdy1yZXNpemUnIDogJ25zLXJlc2l6ZSc7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0aGlzLnN0YXRlID09PSBTYXNoU3RhdGUuQXRNaW5pbXVtKSB7XG5cdFx0XHRcdFx0Y3Vyc29yID0gJ2UtcmVzaXplJztcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLnN0YXRlID09PSBTYXNoU3RhdGUuQXRNYXhpbXVtKSB7XG5cdFx0XHRcdFx0Y3Vyc29yID0gJ3ctcmVzaXplJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjdXJzb3IgPSBpc01hY2ludG9zaCA/ICdjb2wtcmVzaXplJyA6ICdldy1yZXNpemUnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHN0eWxlLnRleHRDb250ZW50ID0gYCogeyBjdXJzb3I6ICR7Y3Vyc29yfSAhaW1wb3J0YW50OyB9YDtcblx0XHR9O1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHR1cGRhdGVTdHlsZSgpO1xuXG5cdFx0aWYgKCFpc011bHRpc2FzaFJlc2l6ZSkge1xuXHRcdFx0dGhpcy5vbkRpZEVuYWJsZW1lbnRDaGFuZ2UuZXZlbnQodXBkYXRlU3R5bGUsIG51bGwsIGRpc3Bvc2FibGVzKTtcblx0XHR9XG5cblx0XHRjb25zdCBvblBvaW50ZXJNb3ZlID0gKGU6IFBvaW50ZXJFdmVudCkgPT4ge1xuXHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCBmYWxzZSk7XG5cdFx0XHRjb25zdCBldmVudDogSVNhc2hFdmVudCA9IHsgc3RhcnRYLCBjdXJyZW50WDogZS5wYWdlWCwgc3RhcnRZLCBjdXJyZW50WTogZS5wYWdlWSwgYWx0S2V5IH07XG5cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoZXZlbnQpO1xuXHRcdH07XG5cblx0XHRjb25zdCBvblBvaW50ZXJVcCA9IChlOiBQb2ludGVyRXZlbnQpID0+IHtcblx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZSwgZmFsc2UpO1xuXG5cdFx0XHRzdHlsZS5yZW1vdmUoKTtcblxuXHRcdFx0dGhpcy5lbC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKTtcblx0XHRcdHRoaXMuX29uRGlkRW5kLmZpcmUoKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGlmcmFtZSBvZiBpZnJhbWVzKSB7XG5cdFx0XHRcdGlmcmFtZS5jbGFzc0xpc3QucmVtb3ZlKFBvaW50ZXJFdmVudHNEaXNhYmxlZENzc0NsYXNzKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0cG9pbnRlckV2ZW50RmFjdG9yeS5vblBvaW50ZXJNb3ZlKG9uUG9pbnRlck1vdmUsIG51bGwsIGRpc3Bvc2FibGVzKTtcblx0XHRwb2ludGVyRXZlbnRGYWN0b3J5Lm9uUG9pbnRlclVwKG9uUG9pbnRlclVwLCBudWxsLCBkaXNwb3NhYmxlcyk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHBvaW50ZXJFdmVudEZhY3RvcnkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblBvaW50ZXJEb3VibGVQcmVzcyhlOiBNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qgb3J0aG9nb25hbFNhc2ggPSB0aGlzLmdldE9ydGhvZ29uYWxTYXNoKGUpO1xuXG5cdFx0aWYgKG9ydGhvZ29uYWxTYXNoKSB7XG5cdFx0XHRvcnRob2dvbmFsU2FzaC5fb25EaWRSZXNldC5maXJlKCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMubGlua2VkU2FzaCkge1xuXHRcdFx0dGhpcy5saW5rZWRTYXNoLl9vbkRpZFJlc2V0LmZpcmUoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZFJlc2V0LmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIG9uTW91c2VFbnRlcihzYXNoOiBTYXNoLCBmcm9tTGlua2VkU2FzaDogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0aWYgKHNhc2guZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCdhY3RpdmUnKSkge1xuXHRcdFx0c2FzaC5ob3ZlckRlbGF5ZXIuY2FuY2VsKCk7XG5cdFx0XHRzYXNoLmVsLmNsYXNzTGlzdC5hZGQoJ2hvdmVyJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNhc2guaG92ZXJEZWxheWVyLnRyaWdnZXIoKCkgPT4gc2FzaC5lbC5jbGFzc0xpc3QuYWRkKCdob3ZlcicpLCBzYXNoLmhvdmVyRGVsYXkpLnRoZW4odW5kZWZpbmVkLCAoKSA9PiB7IH0pO1xuXHRcdH1cblxuXHRcdGlmICghZnJvbUxpbmtlZFNhc2ggJiYgc2FzaC5saW5rZWRTYXNoKSB7XG5cdFx0XHRTYXNoLm9uTW91c2VFbnRlcihzYXNoLmxpbmtlZFNhc2gsIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIG9uTW91c2VMZWF2ZShzYXNoOiBTYXNoLCBmcm9tTGlua2VkU2FzaDogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0c2FzaC5ob3ZlckRlbGF5ZXIuY2FuY2VsKCk7XG5cdFx0c2FzaC5lbC5jbGFzc0xpc3QucmVtb3ZlKCdob3ZlcicpO1xuXG5cdFx0aWYgKCFmcm9tTGlua2VkU2FzaCAmJiBzYXNoLmxpbmtlZFNhc2gpIHtcblx0XHRcdFNhc2gub25Nb3VzZUxlYXZlKHNhc2gubGlua2VkU2FzaCwgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEZvcmNlZnVsbHkgc3RvcCBhbnkgdXNlciBpbnRlcmFjdGlvbnMgd2l0aCB0aGlzIHNhc2guXG5cdCAqIFVzZWZ1bCB3aGVuIGhpZGluZyBhIHBhcmVudCBjb21wb25lbnQsIHdoaWxlIHRoZSB1c2VyIGlzIHN0aWxsXG5cdCAqIGludGVyYWN0aW5nIHdpdGggdGhlIHNhc2guXG5cdCAqL1xuXHRjbGVhclNhc2hIb3ZlclN0YXRlKCk6IHZvaWQge1xuXHRcdFNhc2gub25Nb3VzZUxlYXZlKHRoaXMpO1xuXHR9XG5cblx0LyoqXG5cdCAqIExheW91dCB0aGUgc2FzaC4gVGhlIHNhc2ggd2lsbCBzaXplIGFuZCBwb3NpdGlvbiBpdHNlbGZcblx0ICogYmFzZWQgb24gaXRzIHByb3ZpZGVkIHtAbGluayBJU2FzaExheW91dFByb3ZpZGVyIGxheW91dCBwcm92aWRlcn0uXG5cdCAqL1xuXHRsYXlvdXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMub3JpZW50YXRpb24gPT09IE9yaWVudGF0aW9uLlZFUlRJQ0FMKSB7XG5cdFx0XHRjb25zdCB2ZXJ0aWNhbFByb3ZpZGVyID0gKDxJVmVydGljYWxTYXNoTGF5b3V0UHJvdmlkZXI+dGhpcy5sYXlvdXRQcm92aWRlcik7XG5cdFx0XHR0aGlzLmVsLnN0eWxlLmxlZnQgPSB2ZXJ0aWNhbFByb3ZpZGVyLmdldFZlcnRpY2FsU2FzaExlZnQodGhpcykgLSAodGhpcy5zaXplIC8gMikgKyAncHgnO1xuXG5cdFx0XHRpZiAodmVydGljYWxQcm92aWRlci5nZXRWZXJ0aWNhbFNhc2hUb3ApIHtcblx0XHRcdFx0dGhpcy5lbC5zdHlsZS50b3AgPSB2ZXJ0aWNhbFByb3ZpZGVyLmdldFZlcnRpY2FsU2FzaFRvcCh0aGlzKSArICdweCc7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh2ZXJ0aWNhbFByb3ZpZGVyLmdldFZlcnRpY2FsU2FzaEhlaWdodCkge1xuXHRcdFx0XHR0aGlzLmVsLnN0eWxlLmhlaWdodCA9IHZlcnRpY2FsUHJvdmlkZXIuZ2V0VmVydGljYWxTYXNoSGVpZ2h0KHRoaXMpICsgJ3B4Jztcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgaG9yaXpvbnRhbFByb3ZpZGVyID0gKDxJSG9yaXpvbnRhbFNhc2hMYXlvdXRQcm92aWRlcj50aGlzLmxheW91dFByb3ZpZGVyKTtcblx0XHRcdHRoaXMuZWwuc3R5bGUudG9wID0gaG9yaXpvbnRhbFByb3ZpZGVyLmdldEhvcml6b250YWxTYXNoVG9wKHRoaXMpIC0gKHRoaXMuc2l6ZSAvIDIpICsgJ3B4JztcblxuXHRcdFx0aWYgKGhvcml6b250YWxQcm92aWRlci5nZXRIb3Jpem9udGFsU2FzaExlZnQpIHtcblx0XHRcdFx0dGhpcy5lbC5zdHlsZS5sZWZ0ID0gaG9yaXpvbnRhbFByb3ZpZGVyLmdldEhvcml6b250YWxTYXNoTGVmdCh0aGlzKSArICdweCc7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChob3Jpem9udGFsUHJvdmlkZXIuZ2V0SG9yaXpvbnRhbFNhc2hXaWR0aCkge1xuXHRcdFx0XHR0aGlzLmVsLnN0eWxlLndpZHRoID0gaG9yaXpvbnRhbFByb3ZpZGVyLmdldEhvcml6b250YWxTYXNoV2lkdGgodGhpcykgKyAncHgnO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0T3J0aG9nb25hbFNhc2goZTogUG9pbnRlckV2ZW50KTogU2FzaCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gZS5pbml0aWFsVGFyZ2V0ID8/IGUudGFyZ2V0O1xuXG5cdFx0aWYgKCF0YXJnZXQgfHwgIShpc0hUTUxFbGVtZW50KHRhcmdldCkpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICh0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCdvcnRob2dvbmFsLWRyYWctaGFuZGxlJykpIHtcblx0XHRcdHJldHVybiB0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCdzdGFydCcpID8gdGhpcy5vcnRob2dvbmFsU3RhcnRTYXNoIDogdGhpcy5vcnRob2dvbmFsRW5kU2FzaDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5lbC5yZW1vdmUoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUtBLFNBQVMsR0FBRyxRQUFRLGFBQXdCLFdBQVcscUJBQXFCO0FBQzVFLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBVyxlQUFlO0FBQ25DLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFzQjtBQUMvQixTQUFTLFlBQVksaUJBQWlCLG9CQUFvQjtBQUMxRCxTQUFTLG1CQUFtQjtBQUM1QixPQUFPO0FBTVAsTUFBTSxRQUFRO0FBK0JQLElB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LG1CQUFtQix1QkFBdUI7QUFDN0MsYUFBSyxHQUFHLE1BQU0sT0FBTyxtQkFBbUIsc0JBQXNCLElBQUksSUFBSTtBQUFBLE1BQ3ZFO0FBRUEsVUFBSSxtQkFBbUIsd0JBQXdCO0FBQzlDLGFBQUssR0FBRyxNQUFNLFFBQVEsbUJBQW1CLHVCQUF1QixJQUFJLElBQUk7QUFBQSxNQUN6RTtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSxrQkFBa0IsR0FBbUM7QUFDNUQsVUFBTSxTQUFTLEVBQUUsaUJBQWlCLEVBQUU7QUFFcEMsUUFBSSxDQUFDLFVBQVUsQ0FBRSxjQUFjLE1BQU0sR0FBSTtBQUN4QyxhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksT0FBTyxVQUFVLFNBQVMsd0JBQXdCLEdBQUc7QUFDeEQsYUFBTyxPQUFPLFVBQVUsU0FBUyxPQUFPLElBQUksS0FBSyxzQkFBc0IsS0FBSztBQUFBLElBQzdFO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVTLFVBQWdCO0FBQ3hCLFVBQU0sUUFBUTtBQUNkLFNBQUssR0FBRyxPQUFPO0FBQUEsRUFDaEI7QUFDRDsiLAogICJuYW1lcyI6IFsiT3J0aG9nb25hbEVkZ2UiLCAiT3JpZW50YXRpb24iLCAiU2FzaFN0YXRlIiwgImV2ZW50Il0KfQo=
