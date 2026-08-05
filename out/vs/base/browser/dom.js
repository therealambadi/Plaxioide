import * as browser from "./browser.js";
import { BrowserFeatures } from "./canIUse.js";
import { StandardKeyboardEvent } from "./keyboardEvent.js";
import { StandardMouseEvent } from "./mouseEvent.js";
import { AbstractIdleValue, IntervalTimer, TimeoutTimer, _runWhenIdle } from "../common/async.js";
import { onUnexpectedError } from "../common/errors.js";
import * as event from "../common/event.js";
import dompurify from "./dompurify/dompurify.js";
import { KeyCode } from "../common/keyCodes.js";
import { Disposable, DisposableStore, toDisposable } from "../common/lifecycle.js";
import { RemoteAuthorities, Schemas } from "../common/network.js";
import * as platform from "../common/platform.js";
import { URI } from "../common/uri.js";
import { hash } from "../common/hash.js";
import { ensureCodeWindow, mainWindow } from "./window.js";
import { isPointWithinTriangle } from "../common/numbers.js";
export * from "./domImpl/domObservable.js";
export * from "./domImpl/n.js";
const {
  registerWindow,
  getWindow,
  getDocument,
  getWindows,
  getWindowsCount,
  getWindowId,
  getWindowById,
  hasWindow,
  onDidRegisterWindow,
  onWillUnregisterWindow,
  onDidUnregisterWindow
} = function() {
  const windows = /* @__PURE__ */ new Map();
  ensureCodeWindow(mainWindow, 1);
  const mainWindowRegistration = { window: mainWindow, disposables: new DisposableStore() };
  windows.set(mainWindow.vscodeWindowId, mainWindowRegistration);
  const onDidRegisterWindow2 = new event.Emitter();
  const onDidUnregisterWindow2 = new event.Emitter();
  const onWillUnregisterWindow2 = new event.Emitter();
  function getWindowById2(windowId, fallbackToMain) {
    const window = typeof windowId === "number" ? windows.get(windowId) : void 0;
    return window ?? (fallbackToMain ? mainWindowRegistration : void 0);
  }
  return {
    onDidRegisterWindow: onDidRegisterWindow2.event,
    onWillUnregisterWindow: onWillUnregisterWindow2.event,
    onDidUnregisterWindow: onDidUnregisterWindow2.event,
    registerWindow(window) {
      if (windows.has(window.vscodeWindowId)) {
        return Disposable.None;
      }
      const disposables = new DisposableStore();
      const registeredWindow = {
        window,
        disposables: disposables.add(new DisposableStore())
      };
      windows.set(window.vscodeWindowId, registeredWindow);
      disposables.add(toDisposable(() => {
        windows.delete(window.vscodeWindowId);
        onDidUnregisterWindow2.fire(window);
      }));
      disposables.add(addDisposableListener(window, EventType.BEFORE_UNLOAD, () => {
        onWillUnregisterWindow2.fire(window);
      }));
      onDidRegisterWindow2.fire(registeredWindow);
      return disposables;
    },
    getWindows() {
      return windows.values();
    },
    getWindowsCount() {
      return windows.size;
    },
    getWindowId(targetWindow) {
      return targetWindow.vscodeWindowId;
    },
    hasWindow(windowId) {
      return windows.has(windowId);
    },
    getWindowById: getWindowById2,
    getWindow(e) {
      const candidateNode = e;
      if (candidateNode?.ownerDocument?.defaultView) {
        return candidateNode.ownerDocument.defaultView.window;
      }
      const candidateEvent = e;
      if (candidateEvent?.view) {
        return candidateEvent.view.window;
      }
      return mainWindow;
    },
    getDocument(e) {
      const candidateNode = e;
      return getWindow(candidateNode).document;
    }
  };
}();
function clearNode(node) {
  while (node.firstChild) {
    node.firstChild.remove();
  }
}
class DomListener {
  constructor(node, type, handler, options) {
    this._node = node;
    this._type = type;
    this._handler = handler;
    this._options = options || false;
    this._node.addEventListener(this._type, this._handler, this._options);
  }
  dispose() {
    if (!this._handler) {
      return;
    }
    this._node.removeEventListener(this._type, this._handler, this._options);
    this._node = null;
    this._handler = null;
  }
}
function addDisposableListener(node, type, handler, useCaptureOrOptions) {
  return new DomListener(node, type, handler, useCaptureOrOptions);
}
function _wrapAsStandardMouseEvent(targetWindow, handler) {
  return function(e) {
    return handler(new StandardMouseEvent(targetWindow, e));
  };
}
function _wrapAsStandardKeyboardEvent(handler) {
  return function(e) {
    return handler(new StandardKeyboardEvent(e));
  };
}
const addStandardDisposableListener = function addStandardDisposableListener2(node, type, handler, useCapture) {
  let wrapHandler = handler;
  if (type === "click" || type === "mousedown" || type === "contextmenu") {
    wrapHandler = _wrapAsStandardMouseEvent(getWindow(node), handler);
  } else if (type === "keydown" || type === "keypress" || type === "keyup") {
    wrapHandler = _wrapAsStandardKeyboardEvent(handler);
  }
  return addDisposableListener(node, type, wrapHandler, useCapture);
};
const addStandardDisposableGenericMouseDownListener = function addStandardDisposableListener3(node, handler, useCapture) {
  const wrapHandler = _wrapAsStandardMouseEvent(getWindow(node), handler);
  return addDisposableGenericMouseDownListener(node, wrapHandler, useCapture);
};
const addStandardDisposableGenericMouseUpListener = function addStandardDisposableListener4(node, handler, useCapture) {
  const wrapHandler = _wrapAsStandardMouseEvent(getWindow(node), handler);
  return addDisposableGenericMouseUpListener(node, wrapHandler, useCapture);
};
function addDisposableGenericMouseDownListener(node, handler, useCapture) {
  return addDisposableListener(node, platform.isIOS && BrowserFeatures.pointerEvents ? EventType.POINTER_DOWN : EventType.MOUSE_DOWN, handler, useCapture);
}
function addDisposableGenericMouseMoveListener(node, handler, useCapture) {
  return addDisposableListener(node, platform.isIOS && BrowserFeatures.pointerEvents ? EventType.POINTER_MOVE : EventType.MOUSE_MOVE, handler, useCapture);
}
function addDisposableGenericMouseUpListener(node, handler, useCapture) {
  return addDisposableListener(node, platform.isIOS && BrowserFeatures.pointerEvents ? EventType.POINTER_UP : EventType.MOUSE_UP, handler, useCapture);
}
function runWhenWindowIdle(targetWindow, callback, timeout) {
  return _runWhenIdle(targetWindow, callback, timeout);
}
class WindowIdleValue extends AbstractIdleValue {
  constructor(targetWindow, executor) {
    super(targetWindow, executor);
  }
}
let runAtThisOrScheduleAtNextAnimationFrame;
let scheduleAtNextAnimationFrame;
function disposableWindowInterval(targetWindow, handler, interval, iterations) {
  let iteration = 0;
  const timer = targetWindow.setInterval(() => {
    iteration++;
    if (typeof iterations === "number" && iteration >= iterations || handler() === true) {
      disposable.dispose();
    }
  }, interval);
  const disposable = toDisposable(() => {
    targetWindow.clearInterval(timer);
  });
  return disposable;
}
class WindowIntervalTimer extends IntervalTimer {
  /**
   *
   * @param node The optional node from which the target window is determined
   */
  constructor(node) {
    super();
    this.defaultTarget = node && getWindow(node);
  }
  cancelAndSet(runner, interval, targetWindow) {
    return super.cancelAndSet(runner, interval, targetWindow ?? this.defaultTarget);
  }
}
class AnimationFrameQueueItem {
  constructor(runner, priority = 0) {
    this._runner = runner;
    this.priority = priority;
    this._canceled = false;
  }
  dispose() {
    this._canceled = true;
  }
  execute() {
    if (this._canceled) {
      return;
    }
    try {
      this._runner();
    } catch (e) {
      onUnexpectedError(e);
    }
  }
  // Sort by priority (largest to lowest)
  static sort(a, b) {
    return b.priority - a.priority;
  }
}
(function() {
  const NEXT_QUEUE = /* @__PURE__ */ new Map();
  const CURRENT_QUEUE = /* @__PURE__ */ new Map();
  const animFrameRequested = /* @__PURE__ */ new Map();
  const inAnimationFrameRunner = /* @__PURE__ */ new Map();
  const animationFrameRunner = (targetWindowId) => {
    animFrameRequested.set(targetWindowId, false);
    const currentQueue = NEXT_QUEUE.get(targetWindowId) ?? [];
    CURRENT_QUEUE.set(targetWindowId, currentQueue);
    NEXT_QUEUE.set(targetWindowId, []);
    inAnimationFrameRunner.set(targetWindowId, true);
    while (currentQueue.length > 0) {
      currentQueue.sort(AnimationFrameQueueItem.sort);
      const top = currentQueue.shift();
      top.execute();
    }
    inAnimationFrameRunner.set(targetWindowId, false);
  };
  scheduleAtNextAnimationFrame = (targetWindow, runner, priority = 0) => {
    const targetWindowId = getWindowId(targetWindow);
    const item = new AnimationFrameQueueItem(runner, priority);
    let nextQueue = NEXT_QUEUE.get(targetWindowId);
    if (!nextQueue) {
      nextQueue = [];
      NEXT_QUEUE.set(targetWindowId, nextQueue);
    }
    nextQueue.push(item);
    if (!animFrameRequested.get(targetWindowId)) {
      animFrameRequested.set(targetWindowId, true);
      targetWindow.requestAnimationFrame(() => animationFrameRunner(targetWindowId));
    }
    return item;
  };
  runAtThisOrScheduleAtNextAnimationFrame = (targetWindow, runner, priority) => {
    const targetWindowId = getWindowId(targetWindow);
    if (inAnimationFrameRunner.get(targetWindowId)) {
      const item = new AnimationFrameQueueItem(runner, priority);
      let currentQueue = CURRENT_QUEUE.get(targetWindowId);
      if (!currentQueue) {
        currentQueue = [];
        CURRENT_QUEUE.set(targetWindowId, currentQueue);
      }
      currentQueue.push(item);
      return item;
    } else {
      return scheduleAtNextAnimationFrame(targetWindow, runner, priority);
    }
  };
})();
function measure(targetWindow, callback) {
  return scheduleAtNextAnimationFrame(
    targetWindow,
    callback,
    1e4
    /* must be early */
  );
}
function modify(targetWindow, callback) {
  return scheduleAtNextAnimationFrame(
    targetWindow,
    callback,
    -1e4
    /* must be late */
  );
}
const MINIMUM_TIME_MS = 8;
const DEFAULT_EVENT_MERGER = function(lastEvent, currentEvent) {
  return currentEvent;
};
class TimeoutThrottledDomListener extends Disposable {
  constructor(node, type, handler, eventMerger = DEFAULT_EVENT_MERGER, minimumTimeMs = MINIMUM_TIME_MS) {
    super();
    let lastEvent = null;
    let lastHandlerTime = 0;
    const timeout = this._register(new TimeoutTimer());
    const invokeHandler = () => {
      lastHandlerTime = (/* @__PURE__ */ new Date()).getTime();
      handler(lastEvent);
      lastEvent = null;
    };
    this._register(addDisposableListener(node, type, (e) => {
      lastEvent = eventMerger(lastEvent, e);
      const elapsedTime = (/* @__PURE__ */ new Date()).getTime() - lastHandlerTime;
      if (elapsedTime >= minimumTimeMs) {
        timeout.cancel();
        invokeHandler();
      } else {
        timeout.setIfNotSet(invokeHandler, minimumTimeMs - elapsedTime);
      }
    }));
  }
}
function addDisposableThrottledListener(node, type, handler, eventMerger, minimumTimeMs) {
  return new TimeoutThrottledDomListener(node, type, handler, eventMerger, minimumTimeMs);
}
function getComputedStyle(el) {
  return getWindow(el).getComputedStyle(el, null);
}
function getClientArea(element, defaultValue, fallbackElement) {
  const elWindow = getWindow(element);
  const elDocument = elWindow.document;
  if (element !== elDocument.body) {
    return new Dimension(element.clientWidth, element.clientHeight);
  }
  if (platform.isIOS && elWindow?.visualViewport) {
    return new Dimension(elWindow.visualViewport.width, elWindow.visualViewport.height);
  }
  if (elWindow?.innerWidth && elWindow.innerHeight) {
    return new Dimension(elWindow.innerWidth, elWindow.innerHeight);
  }
  if (elDocument.body && elDocument.body.clientWidth && elDocument.body.clientHeight) {
    return new Dimension(elDocument.body.clientWidth, elDocument.body.clientHeight);
  }
  if (elDocument.documentElement && elDocument.documentElement.clientWidth && elDocument.documentElement.clientHeight) {
    return new Dimension(elDocument.documentElement.clientWidth, elDocument.documentElement.clientHeight);
  }
  if (fallbackElement) {
    return getClientArea(fallbackElement, defaultValue);
  }
  if (defaultValue) {
    return defaultValue;
  }
  throw new Error("Unable to figure out browser width and height");
}
class SizeUtils {
  // Adapted from WinJS
  // Converts a CSS positioning string for the specified element to pixels.
  static convertToPixels(element, value) {
    return parseFloat(value) || 0;
  }
  static getDimension(element, cssPropertyName) {
    const computedStyle = getComputedStyle(element);
    const value = computedStyle ? computedStyle.getPropertyValue(cssPropertyName) : "0";
    return SizeUtils.convertToPixels(element, value);
  }
  static getBorderLeftWidth(element) {
    return SizeUtils.getDimension(element, "border-left-width");
  }
  static getBorderRightWidth(element) {
    return SizeUtils.getDimension(element, "border-right-width");
  }
  static getBorderTopWidth(element) {
    return SizeUtils.getDimension(element, "border-top-width");
  }
  static getBorderBottomWidth(element) {
    return SizeUtils.getDimension(element, "border-bottom-width");
  }
  static getPaddingLeft(element) {
    return SizeUtils.getDimension(element, "padding-left");
  }
  static getPaddingRight(element) {
    return SizeUtils.getDimension(element, "padding-right");
  }
  static getPaddingTop(element) {
    return SizeUtils.getDimension(element, "padding-top");
  }
  static getPaddingBottom(element) {
    return SizeUtils.getDimension(element, "padding-bottom");
  }
  static getMarginLeft(element) {
    return SizeUtils.getDimension(element, "margin-left");
  }
  static getMarginTop(element) {
    return SizeUtils.getDimension(element, "margin-top");
  }
  static getMarginRight(element) {
    return SizeUtils.getDimension(element, "margin-right");
  }
  static getMarginBottom(element) {
    return SizeUtils.getDimension(element, "margin-bottom");
  }
}
const _Dimension = class _Dimension {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  with(width = this.width, height = this.height) {
    if (width !== this.width || height !== this.height) {
      return new _Dimension(width, height);
    } else {
      return this;
    }
  }
  static is(obj) {
    return typeof obj === "object" && typeof obj.height === "number" && typeof obj.width === "number";
  }
  static lift(obj) {
    if (obj instanceof _Dimension) {
      return obj;
    } else {
      return new _Dimension(obj.width, obj.height);
    }
  }
  static equals(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.width === b.width && a.height === b.height;
  }
};
_Dimension.None = new _Dimension(0, 0);
let Dimension = _Dimension;
function getTopLeftOffset(element) {
  let offsetParent = element.offsetParent;
  let top = element.offsetTop;
  let left = element.offsetLeft;
  while ((element = element.parentNode) !== null && element !== element.ownerDocument.body && element !== element.ownerDocument.documentElement) {
    top -= element.scrollTop;
    const c = isShadowRoot(element) ? null : getComputedStyle(element);
    if (c) {
      left -= c.direction !== "rtl" ? element.scrollLeft : -element.scrollLeft;
    }
    if (element === offsetParent) {
      left += SizeUtils.getBorderLeftWidth(element);
      top += SizeUtils.getBorderTopWidth(element);
      top += element.offsetTop;
      left += element.offsetLeft;
      offsetParent = element.offsetParent;
    }
  }
  return {
    left,
    top
  };
}
function size(element, width, height) {
  if (typeof width === "number") {
    element.style.width = `${width}px`;
  }
  if (typeof height === "number") {
    element.style.height = `${height}px`;
  }
}
function position(element, top, right, bottom, left, position2 = "absolute") {
  if (typeof top === "number") {
    element.style.top = `${top}px`;
  }
  if (typeof right === "number") {
    element.style.right = `${right}px`;
  }
  if (typeof bottom === "number") {
    element.style.bottom = `${bottom}px`;
  }
  if (typeof left === "number") {
    element.style.left = `${left}px`;
  }
  element.style.position = position2;
}
function getDomNodePagePosition(domNode) {
  const bb = domNode.getBoundingClientRect();
  const window = getWindow(domNode);
  return {
    left: bb.left + window.scrollX,
    top: bb.top + window.scrollY,
    width: bb.width,
    height: bb.height
  };
}
function getDomNodeZoomLevel(domNode) {
  let testElement = domNode;
  let zoom = 1;
  do {
    const elementZoomLevel = getComputedStyle(testElement).zoom;
    if (elementZoomLevel !== null && elementZoomLevel !== void 0 && elementZoomLevel !== "1") {
      zoom *= elementZoomLevel;
    }
    testElement = testElement.parentElement;
  } while (testElement !== null && testElement !== testElement.ownerDocument.documentElement);
  return zoom;
}
function getTotalWidth(element) {
  const margin = SizeUtils.getMarginLeft(element) + SizeUtils.getMarginRight(element);
  return element.offsetWidth + margin;
}
function getContentWidth(element) {
  const border = SizeUtils.getBorderLeftWidth(element) + SizeUtils.getBorderRightWidth(element);
  const padding = SizeUtils.getPaddingLeft(element) + SizeUtils.getPaddingRight(element);
  return element.offsetWidth - border - padding;
}
function getTotalScrollWidth(element) {
  const margin = SizeUtils.getMarginLeft(element) + SizeUtils.getMarginRight(element);
  return element.scrollWidth + margin;
}
function getContentHeight(element) {
  const border = SizeUtils.getBorderTopWidth(element) + SizeUtils.getBorderBottomWidth(element);
  const padding = SizeUtils.getPaddingTop(element) + SizeUtils.getPaddingBottom(element);
  return element.offsetHeight - border - padding;
}
function getTotalHeight(element) {
  const margin = SizeUtils.getMarginTop(element) + SizeUtils.getMarginBottom(element);
  return element.offsetHeight + margin;
}
function getRelativeLeft(element, parent) {
  if (element === null) {
    return 0;
  }
  const elementPosition = getTopLeftOffset(element);
  const parentPosition = getTopLeftOffset(parent);
  return elementPosition.left - parentPosition.left;
}
function getLargestChildWidth(parent, children) {
  const childWidths = children.map((child) => {
    return Math.max(getTotalScrollWidth(child), getTotalWidth(child)) + getRelativeLeft(child, parent) || 0;
  });
  const maxWidth = Math.max(...childWidths);
  return maxWidth;
}
function isAncestor(testChild, testAncestor) {
  return Boolean(testAncestor?.contains(testChild));
}
const parentFlowToDataKey = "parentFlowToElementId";
function setParentFlowTo(fromChildElement, toParentElement) {
  fromChildElement.dataset[parentFlowToDataKey] = toParentElement.id;
}
function getParentFlowToElement(node) {
  const flowToParentId = node.dataset[parentFlowToDataKey];
  if (typeof flowToParentId === "string") {
    return node.ownerDocument.getElementById(flowToParentId);
  }
  return null;
}
function isAncestorUsingFlowTo(testChild, testAncestor) {
  let node = testChild;
  while (node) {
    if (node === testAncestor) {
      return true;
    }
    if (isHTMLElement(node)) {
      const flowToParentElement = getParentFlowToElement(node);
      if (flowToParentElement) {
        node = flowToParentElement;
        continue;
      }
    }
    node = node.parentNode;
  }
  return false;
}
function findParentWithClass(node, clazz, stopAtClazzOrNode) {
  while (node && node.nodeType === node.ELEMENT_NODE) {
    if (node.classList.contains(clazz)) {
      return node;
    }
    if (stopAtClazzOrNode) {
      if (typeof stopAtClazzOrNode === "string") {
        if (node.classList.contains(stopAtClazzOrNode)) {
          return null;
        }
      } else {
        if (node === stopAtClazzOrNode) {
          return null;
        }
      }
    }
    node = node.parentNode;
  }
  return null;
}
function hasParentWithClass(node, clazz, stopAtClazzOrNode) {
  return !!findParentWithClass(node, clazz, stopAtClazzOrNode);
}
function isShadowRoot(node) {
  return node && !!node.host && !!node.mode;
}
function isInShadowDOM(domNode) {
  return !!getShadowRoot(domNode);
}
function getShadowRoot(domNode) {
  while (domNode.parentNode) {
    if (domNode === domNode.ownerDocument?.body) {
      return null;
    }
    domNode = domNode.parentNode;
  }
  return isShadowRoot(domNode) ? domNode : null;
}
function getActiveElement() {
  let result = getActiveDocument().activeElement;
  while (result?.shadowRoot) {
    result = result.shadowRoot.activeElement;
  }
  return result;
}
function isActiveElement(element) {
  return getActiveElement() === element;
}
function isAncestorOfActiveElement(ancestor) {
  return isAncestor(getActiveElement(), ancestor);
}
function isActiveDocument(element) {
  return element.ownerDocument === getActiveDocument();
}
function getActiveDocument() {
  if (getWindowsCount() <= 1) {
    return mainWindow.document;
  }
  const documents = Array.from(getWindows()).map(({ window }) => window.document);
  return documents.find((doc) => doc.hasFocus()) ?? mainWindow.document;
}
function getActiveWindow() {
  const document2 = getActiveDocument();
  return document2.defaultView?.window ?? mainWindow;
}
const sharedMutationObserver = new class {
  constructor() {
    this.mutationObservers = /* @__PURE__ */ new Map();
  }
  observe(target, disposables, options) {
    let mutationObserversPerTarget = this.mutationObservers.get(target);
    if (!mutationObserversPerTarget) {
      mutationObserversPerTarget = /* @__PURE__ */ new Map();
      this.mutationObservers.set(target, mutationObserversPerTarget);
    }
    const optionsHash = hash(options);
    let mutationObserverPerOptions = mutationObserversPerTarget.get(optionsHash);
    if (!mutationObserverPerOptions) {
      const onDidMutate = new event.Emitter();
      const observer = new MutationObserver((mutations) => onDidMutate.fire(mutations));
      observer.observe(target, options);
      const resolvedMutationObserverPerOptions = mutationObserverPerOptions = {
        users: 1,
        observer,
        onDidMutate: onDidMutate.event
      };
      disposables.add(toDisposable(() => {
        resolvedMutationObserverPerOptions.users -= 1;
        if (resolvedMutationObserverPerOptions.users === 0) {
          onDidMutate.dispose();
          observer.disconnect();
          mutationObserversPerTarget?.delete(optionsHash);
          if (mutationObserversPerTarget?.size === 0) {
            this.mutationObservers.delete(target);
          }
        }
      }));
      mutationObserversPerTarget.set(optionsHash, mutationObserverPerOptions);
    } else {
      mutationObserverPerOptions.users += 1;
    }
    return mutationObserverPerOptions.onDidMutate;
  }
}();
function createMetaElement(container = mainWindow.document.head) {
  return createHeadElement("meta", container);
}
function createLinkElement(container = mainWindow.document.head) {
  return createHeadElement("link", container);
}
function createHeadElement(tagName, container = mainWindow.document.head) {
  const element = document.createElement(tagName);
  container.appendChild(element);
  return element;
}
function isHTMLElement(e) {
  return e instanceof HTMLElement || e instanceof getWindow(e).HTMLElement;
}
function isHTMLAnchorElement(e) {
  return e instanceof HTMLAnchorElement || e instanceof getWindow(e).HTMLAnchorElement;
}
function isHTMLSpanElement(e) {
  return e instanceof HTMLSpanElement || e instanceof getWindow(e).HTMLSpanElement;
}
function isHTMLTextAreaElement(e) {
  return e instanceof HTMLTextAreaElement || e instanceof getWindow(e).HTMLTextAreaElement;
}
function isHTMLInputElement(e) {
  return e instanceof HTMLInputElement || e instanceof getWindow(e).HTMLInputElement;
}
function isHTMLButtonElement(e) {
  return e instanceof HTMLButtonElement || e instanceof getWindow(e).HTMLButtonElement;
}
function isHTMLDivElement(e) {
  return e instanceof HTMLDivElement || e instanceof getWindow(e).HTMLDivElement;
}
function isSVGElement(e) {
  return e instanceof SVGElement || e instanceof getWindow(e).SVGElement;
}
function isMouseEvent(e) {
  return e instanceof MouseEvent || e instanceof getWindow(e).MouseEvent;
}
function isKeyboardEvent(e) {
  return e instanceof KeyboardEvent || e instanceof getWindow(e).KeyboardEvent;
}
function isPointerEvent(e) {
  return e instanceof PointerEvent || e instanceof getWindow(e).PointerEvent;
}
function isDragEvent(e) {
  return e instanceof DragEvent || e instanceof getWindow(e).DragEvent;
}
const EventType = {
  // Mouse
  CLICK: "click",
  AUXCLICK: "auxclick",
  DBLCLICK: "dblclick",
  MOUSE_UP: "mouseup",
  MOUSE_DOWN: "mousedown",
  MOUSE_OVER: "mouseover",
  MOUSE_MOVE: "mousemove",
  MOUSE_OUT: "mouseout",
  MOUSE_ENTER: "mouseenter",
  MOUSE_LEAVE: "mouseleave",
  MOUSE_WHEEL: "wheel",
  POINTER_UP: "pointerup",
  POINTER_DOWN: "pointerdown",
  POINTER_MOVE: "pointermove",
  POINTER_LEAVE: "pointerleave",
  CONTEXT_MENU: "contextmenu",
  WHEEL: "wheel",
  // Keyboard
  KEY_DOWN: "keydown",
  KEY_PRESS: "keypress",
  KEY_UP: "keyup",
  // HTML Document
  LOAD: "load",
  BEFORE_UNLOAD: "beforeunload",
  UNLOAD: "unload",
  PAGE_SHOW: "pageshow",
  PAGE_HIDE: "pagehide",
  PASTE: "paste",
  ABORT: "abort",
  ERROR: "error",
  RESIZE: "resize",
  SCROLL: "scroll",
  FULLSCREEN_CHANGE: "fullscreenchange",
  WK_FULLSCREEN_CHANGE: "webkitfullscreenchange",
  // Form
  SELECT: "select",
  CHANGE: "change",
  SUBMIT: "submit",
  RESET: "reset",
  FOCUS: "focus",
  FOCUS_IN: "focusin",
  FOCUS_OUT: "focusout",
  BLUR: "blur",
  INPUT: "input",
  // Local Storage
  STORAGE: "storage",
  // Drag
  DRAG_START: "dragstart",
  DRAG: "drag",
  DRAG_ENTER: "dragenter",
  DRAG_LEAVE: "dragleave",
  DRAG_OVER: "dragover",
  DROP: "drop",
  DRAG_END: "dragend",
  // Animation
  ANIMATION_START: browser.isWebKit ? "webkitAnimationStart" : "animationstart",
  ANIMATION_END: browser.isWebKit ? "webkitAnimationEnd" : "animationend",
  ANIMATION_ITERATION: browser.isWebKit ? "webkitAnimationIteration" : "animationiteration"
};
function isEventLike(obj) {
  const candidate = obj;
  return !!(candidate && typeof candidate.preventDefault === "function" && typeof candidate.stopPropagation === "function");
}
const EventHelper = {
  stop: (e, cancelBubble) => {
    e.preventDefault();
    if (cancelBubble) {
      e.stopPropagation();
    }
    return e;
  }
};
function saveParentsScrollTop(node) {
  const r = [];
  for (let i = 0; node && node.nodeType === node.ELEMENT_NODE; i++) {
    r[i] = node.scrollTop;
    node = node.parentNode;
  }
  return r;
}
function restoreParentsScrollTop(node, state) {
  for (let i = 0; node && node.nodeType === node.ELEMENT_NODE; i++) {
    if (node.scrollTop !== state[i]) {
      node.scrollTop = state[i];
    }
    node = node.parentNode;
  }
}
class FocusTracker extends Disposable {
  constructor(element) {
    super();
    this._onDidFocus = this._register(new event.Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new event.Emitter());
    this.onDidBlur = this._onDidBlur.event;
    let hasFocus = FocusTracker.hasFocusWithin(element);
    let loosingFocus = false;
    const onFocus = () => {
      loosingFocus = false;
      if (!hasFocus) {
        hasFocus = true;
        this._onDidFocus.fire();
      }
    };
    const onBlur = () => {
      if (hasFocus) {
        loosingFocus = true;
        (isHTMLElement(element) ? getWindow(element) : element).setTimeout(() => {
          if (loosingFocus) {
            loosingFocus = false;
            hasFocus = false;
            this._onDidBlur.fire();
          }
        }, 0);
      }
    };
    this._refreshStateHandler = () => {
      const currentNodeHasFocus = FocusTracker.hasFocusWithin(element);
      if (currentNodeHasFocus !== hasFocus) {
        if (hasFocus) {
          onBlur();
        } else {
          onFocus();
        }
      }
    };
    this._register(addDisposableListener(element, EventType.FOCUS, onFocus, true));
    this._register(addDisposableListener(element, EventType.BLUR, onBlur, true));
    if (isHTMLElement(element)) {
      this._register(addDisposableListener(element, EventType.FOCUS_IN, () => this._refreshStateHandler()));
      this._register(addDisposableListener(element, EventType.FOCUS_OUT, () => this._refreshStateHandler()));
    }
  }
  static hasFocusWithin(element) {
    if (isHTMLElement(element)) {
      const shadowRoot = getShadowRoot(element);
      const activeElement = shadowRoot ? shadowRoot.activeElement : element.ownerDocument.activeElement;
      return isAncestor(activeElement, element);
    } else {
      const window = element;
      return isAncestor(window.document.activeElement, window.document);
    }
  }
  refreshState() {
    this._refreshStateHandler();
  }
}
function trackFocus(element) {
  return new FocusTracker(element);
}
function after(sibling, child) {
  sibling.after(child);
  return child;
}
function append(parent, ...children) {
  parent.append(...children);
  if (children.length === 1 && typeof children[0] !== "string") {
    return children[0];
  }
}
function prepend(parent, child) {
  parent.insertBefore(child, parent.firstChild);
  return child;
}
function reset(parent, ...children) {
  parent.innerText = "";
  append(parent, ...children);
}
const SELECTOR_REGEX = /([\w\-]+)?(#([\w\-]+))?((\.([\w\-]+))*)/;
var Namespace = /* @__PURE__ */ ((Namespace2) => {
  Namespace2["HTML"] = "http://www.w3.org/1999/xhtml";
  Namespace2["SVG"] = "http://www.w3.org/2000/svg";
  return Namespace2;
})(Namespace || {});
function _$(namespace, description, attrs, ...children) {
  const match = SELECTOR_REGEX.exec(description);
  if (!match) {
    throw new Error("Bad use of emmet");
  }
  const tagName = match[1] || "div";
  let result;
  if (namespace !== "http://www.w3.org/1999/xhtml" /* HTML */) {
    result = document.createElementNS(namespace, tagName);
  } else {
    result = document.createElement(tagName);
  }
  if (match[3]) {
    result.id = match[3];
  }
  if (match[4]) {
    result.className = match[4].replace(/\./g, " ").trim();
  }
  if (attrs) {
    Object.entries(attrs).forEach(([name, value]) => {
      if (typeof value === "undefined") {
        return;
      }
      if (/^on\w+$/.test(name)) {
        result[name] = value;
      } else if (name === "selected") {
        if (value) {
          result.setAttribute(name, "true");
        }
      } else {
        result.setAttribute(name, value);
      }
    });
  }
  result.append(...children);
  return result;
}
function $(description, attrs, ...children) {
  return _$("http://www.w3.org/1999/xhtml" /* HTML */, description, attrs, ...children);
}
$.SVG = function(description, attrs, ...children) {
  return _$("http://www.w3.org/2000/svg" /* SVG */, description, attrs, ...children);
};
function join(nodes, separator) {
  const result = [];
  nodes.forEach((node, index) => {
    if (index > 0) {
      if (separator instanceof Node) {
        result.push(separator.cloneNode());
      } else {
        result.push(document.createTextNode(separator));
      }
    }
    result.push(node);
  });
  return result;
}
function setVisibility(visible, ...elements) {
  if (visible) {
    show(...elements);
  } else {
    hide(...elements);
  }
}
function show(...elements) {
  for (const element of elements) {
    element.style.display = "";
    element.removeAttribute("aria-hidden");
  }
}
function hide(...elements) {
  for (const element of elements) {
    element.style.display = "none";
    element.setAttribute("aria-hidden", "true");
  }
}
function findParentWithAttribute(node, attribute) {
  while (node && node.nodeType === node.ELEMENT_NODE) {
    if (isHTMLElement(node) && node.hasAttribute(attribute)) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}
function removeTabIndexAndUpdateFocus(node) {
  if (!node || !node.hasAttribute("tabIndex")) {
    return;
  }
  if (node.ownerDocument.activeElement === node) {
    const parentFocusable = findParentWithAttribute(node.parentElement, "tabIndex");
    parentFocusable?.focus();
  }
  node.removeAttribute("tabindex");
}
function finalHandler(fn) {
  return (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn(e);
  };
}
function domContentLoaded(targetWindow) {
  return new Promise((resolve) => {
    const readyState = targetWindow.document.readyState;
    if (readyState === "complete" || targetWindow.document && targetWindow.document.body !== null) {
      resolve(void 0);
    } else {
      const listener = () => {
        targetWindow.window.removeEventListener("DOMContentLoaded", listener, false);
        resolve();
      };
      targetWindow.window.addEventListener("DOMContentLoaded", listener, false);
    }
  });
}
function computeScreenAwareSize(window, cssPx) {
  const screenPx = window.devicePixelRatio * cssPx;
  return Math.max(1, Math.floor(screenPx)) / window.devicePixelRatio;
}
function windowOpenNoOpener(url) {
  mainWindow.open(url, "_blank", "noopener");
}
const popupWidth = 780, popupHeight = 640;
function windowOpenPopup(url) {
  const left = Math.floor(mainWindow.screenLeft + mainWindow.innerWidth / 2 - popupWidth / 2);
  const top = Math.floor(mainWindow.screenTop + mainWindow.innerHeight / 2 - popupHeight / 2);
  mainWindow.open(
    url,
    "_blank",
    `width=${popupWidth},height=${popupHeight},top=${top},left=${left}`
  );
}
function windowOpenWithSuccess(url, noOpener = true) {
  const newTab = mainWindow.open();
  if (newTab) {
    if (noOpener) {
      newTab.opener = null;
    }
    newTab.location.href = url;
    return true;
  }
  return false;
}
function animate(targetWindow, fn) {
  const step = () => {
    fn();
    stepDisposable = scheduleAtNextAnimationFrame(targetWindow, step);
  };
  let stepDisposable = scheduleAtNextAnimationFrame(targetWindow, step);
  return toDisposable(() => stepDisposable.dispose());
}
RemoteAuthorities.setPreferredWebSchema(/^https:/.test(mainWindow.location.href) ? "https" : "http");
function triggerDownload(dataOrUri, name) {
  let url;
  if (URI.isUri(dataOrUri)) {
    url = dataOrUri.toString(true);
  } else {
    const blob = new Blob([dataOrUri]);
    url = URL.createObjectURL(blob);
    setTimeout(() => URL.revokeObjectURL(url));
  }
  const activeWindow = getActiveWindow();
  const anchor = document.createElement("a");
  activeWindow.document.body.appendChild(anchor);
  anchor.download = name;
  anchor.href = url;
  anchor.click();
  setTimeout(() => anchor.remove());
}
function triggerUpload() {
  return new Promise((resolve) => {
    const activeWindow = getActiveWindow();
    const input = document.createElement("input");
    activeWindow.document.body.appendChild(input);
    input.type = "file";
    input.multiple = true;
    event.Event.once(event.Event.fromDOMEventEmitter(input, "input"))(() => {
      resolve(input.files ?? void 0);
    });
    input.click();
    setTimeout(() => input.remove());
  });
}
var DetectedFullscreenMode = /* @__PURE__ */ ((DetectedFullscreenMode2) => {
  DetectedFullscreenMode2[DetectedFullscreenMode2["DOCUMENT"] = 1] = "DOCUMENT";
  DetectedFullscreenMode2[DetectedFullscreenMode2["BROWSER"] = 2] = "BROWSER";
  return DetectedFullscreenMode2;
})(DetectedFullscreenMode || {});
function detectFullscreen(targetWindow) {
  if (targetWindow.document.fullscreenElement || targetWindow.document.webkitFullscreenElement || targetWindow.document.webkitIsFullScreen) {
    return { mode: 1 /* DOCUMENT */, guess: false };
  }
  if (targetWindow.innerHeight === targetWindow.screen.height) {
    return { mode: 2 /* BROWSER */, guess: false };
  }
  if (platform.isMacintosh || platform.isLinux) {
    if (targetWindow.outerHeight === targetWindow.screen.height && targetWindow.outerWidth === targetWindow.screen.width) {
      return { mode: 2 /* BROWSER */, guess: true };
    }
  }
  return null;
}
function hookDomPurifyHrefAndSrcSanitizer(allowedProtocols, allowDataImages = false) {
  const anchor = document.createElement("a");
  dompurify.addHook("afterSanitizeAttributes", (node) => {
    for (const attr of ["href", "src"]) {
      if (node.hasAttribute(attr)) {
        const attrValue = node.getAttribute(attr);
        if (attr === "href" && attrValue.startsWith("#")) {
          continue;
        }
        anchor.href = attrValue;
        if (!allowedProtocols.includes(anchor.protocol.replace(/:$/, ""))) {
          if (allowDataImages && attr === "src" && anchor.href.startsWith("data:")) {
            continue;
          }
          node.removeAttribute(attr);
        }
      }
    }
  });
  return toDisposable(() => {
    dompurify.removeHook("afterSanitizeAttributes");
  });
}
const defaultSafeProtocols = [
  Schemas.http,
  Schemas.https,
  Schemas.command
];
const basicMarkupHtmlTags = Object.freeze([
  "a",
  "abbr",
  "b",
  "bdo",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "rp",
  "rt",
  "ruby",
  "samp",
  "small",
  "small",
  "source",
  "span",
  "strike",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "tt",
  "u",
  "ul",
  "var",
  "video",
  "wbr"
]);
const defaultDomPurifyConfig = Object.freeze({
  ALLOWED_TAGS: ["a", "button", "blockquote", "code", "div", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "input", "label", "li", "p", "pre", "select", "small", "span", "strong", "textarea", "ul", "ol"],
  ALLOWED_ATTR: ["href", "data-href", "data-command", "target", "title", "name", "src", "alt", "class", "id", "role", "tabindex", "style", "data-code", "width", "height", "align", "x-dispatch", "required", "checked", "placeholder", "type", "start"],
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: true
});
function safeInnerHtml(node, value, extraDomPurifyConfig) {
  const hook = hookDomPurifyHrefAndSrcSanitizer(defaultSafeProtocols);
  try {
    const html = dompurify.sanitize(value, { ...defaultDomPurifyConfig, ...extraDomPurifyConfig });
    node.innerHTML = html;
  } finally {
    hook.dispose();
  }
}
function toBinary(str) {
  const codeUnits = new Uint16Array(str.length);
  for (let i = 0; i < codeUnits.length; i++) {
    codeUnits[i] = str.charCodeAt(i);
  }
  let binary = "";
  const uint8array = new Uint8Array(codeUnits.buffer);
  for (let i = 0; i < uint8array.length; i++) {
    binary += String.fromCharCode(uint8array[i]);
  }
  return binary;
}
function multibyteAwareBtoa(str) {
  return btoa(toBinary(str));
}
class ModifierKeyEmitter extends event.Emitter {
  constructor() {
    super();
    this._subscriptions = new DisposableStore();
    this._keyStatus = {
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false
    };
    this._subscriptions.add(event.Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => this.registerListeners(window, disposables), { window: mainWindow, disposables: this._subscriptions }));
  }
  registerListeners(window, disposables) {
    disposables.add(addDisposableListener(window, "keydown", (e) => {
      if (e.defaultPrevented) {
        return;
      }
      const event2 = new StandardKeyboardEvent(e);
      if (event2.keyCode === KeyCode.Alt && e.repeat) {
        return;
      }
      if (e.altKey && !this._keyStatus.altKey) {
        this._keyStatus.lastKeyPressed = "alt";
      } else if (e.ctrlKey && !this._keyStatus.ctrlKey) {
        this._keyStatus.lastKeyPressed = "ctrl";
      } else if (e.metaKey && !this._keyStatus.metaKey) {
        this._keyStatus.lastKeyPressed = "meta";
      } else if (e.shiftKey && !this._keyStatus.shiftKey) {
        this._keyStatus.lastKeyPressed = "shift";
      } else if (event2.keyCode !== KeyCode.Alt) {
        this._keyStatus.lastKeyPressed = void 0;
      } else {
        return;
      }
      this._keyStatus.altKey = e.altKey;
      this._keyStatus.ctrlKey = e.ctrlKey;
      this._keyStatus.metaKey = e.metaKey;
      this._keyStatus.shiftKey = e.shiftKey;
      if (this._keyStatus.lastKeyPressed) {
        this._keyStatus.event = e;
        this.fire(this._keyStatus);
      }
    }, true));
    disposables.add(addDisposableListener(window, "keyup", (e) => {
      if (e.defaultPrevented) {
        return;
      }
      if (!e.altKey && this._keyStatus.altKey) {
        this._keyStatus.lastKeyReleased = "alt";
      } else if (!e.ctrlKey && this._keyStatus.ctrlKey) {
        this._keyStatus.lastKeyReleased = "ctrl";
      } else if (!e.metaKey && this._keyStatus.metaKey) {
        this._keyStatus.lastKeyReleased = "meta";
      } else if (!e.shiftKey && this._keyStatus.shiftKey) {
        this._keyStatus.lastKeyReleased = "shift";
      } else {
        this._keyStatus.lastKeyReleased = void 0;
      }
      if (this._keyStatus.lastKeyPressed !== this._keyStatus.lastKeyReleased) {
        this._keyStatus.lastKeyPressed = void 0;
      }
      this._keyStatus.altKey = e.altKey;
      this._keyStatus.ctrlKey = e.ctrlKey;
      this._keyStatus.metaKey = e.metaKey;
      this._keyStatus.shiftKey = e.shiftKey;
      if (this._keyStatus.lastKeyReleased) {
        this._keyStatus.event = e;
        this.fire(this._keyStatus);
      }
    }, true));
    disposables.add(addDisposableListener(window.document.body, "mousedown", () => {
      this._keyStatus.lastKeyPressed = void 0;
    }, true));
    disposables.add(addDisposableListener(window.document.body, "mouseup", () => {
      this._keyStatus.lastKeyPressed = void 0;
    }, true));
    disposables.add(addDisposableListener(window.document.body, "mousemove", (e) => {
      if (e.buttons) {
        this._keyStatus.lastKeyPressed = void 0;
      }
    }, true));
    disposables.add(addDisposableListener(window, "blur", () => {
      this.resetKeyStatus();
    }));
  }
  get keyStatus() {
    return this._keyStatus;
  }
  get isModifierPressed() {
    return this._keyStatus.altKey || this._keyStatus.ctrlKey || this._keyStatus.metaKey || this._keyStatus.shiftKey;
  }
  /**
   * Allows to explicitly reset the key status based on more knowledge (#109062)
   */
  resetKeyStatus() {
    this.doResetKeyStatus();
    this.fire(this._keyStatus);
  }
  doResetKeyStatus() {
    this._keyStatus = {
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false
    };
  }
  static getInstance() {
    if (!ModifierKeyEmitter.instance) {
      ModifierKeyEmitter.instance = new ModifierKeyEmitter();
    }
    return ModifierKeyEmitter.instance;
  }
  dispose() {
    super.dispose();
    this._subscriptions.dispose();
  }
}
function getCookieValue(name) {
  const match = document.cookie.match("(^|[^;]+)\\s*" + name + "\\s*=\\s*([^;]+)");
  return match ? match.pop() : void 0;
}
class DragAndDropObserver extends Disposable {
  constructor(element, callbacks) {
    super();
    this.element = element;
    this.callbacks = callbacks;
    // A helper to fix issues with repeated DRAG_ENTER / DRAG_LEAVE
    // calls see https://github.com/microsoft/vscode/issues/14470
    // when the element has child elements where the events are fired
    // repeadedly.
    this.counter = 0;
    // Allows to measure the duration of the drag operation.
    this.dragStartTime = 0;
    this.registerListeners();
  }
  registerListeners() {
    if (this.callbacks.onDragStart) {
      this._register(addDisposableListener(this.element, EventType.DRAG_START, (e) => {
        this.callbacks.onDragStart?.(e);
      }));
    }
    if (this.callbacks.onDrag) {
      this._register(addDisposableListener(this.element, EventType.DRAG, (e) => {
        this.callbacks.onDrag?.(e);
      }));
    }
    this._register(addDisposableListener(this.element, EventType.DRAG_ENTER, (e) => {
      this.counter++;
      this.dragStartTime = e.timeStamp;
      this.callbacks.onDragEnter?.(e);
    }));
    this._register(addDisposableListener(this.element, EventType.DRAG_OVER, (e) => {
      e.preventDefault();
      this.callbacks.onDragOver?.(e, e.timeStamp - this.dragStartTime);
    }));
    this._register(addDisposableListener(this.element, EventType.DRAG_LEAVE, (e) => {
      this.counter--;
      if (this.counter === 0) {
        this.dragStartTime = 0;
        this.callbacks.onDragLeave?.(e);
      }
    }));
    this._register(addDisposableListener(this.element, EventType.DRAG_END, (e) => {
      this.counter = 0;
      this.dragStartTime = 0;
      this.callbacks.onDragEnd?.(e);
    }));
    this._register(addDisposableListener(this.element, EventType.DROP, (e) => {
      this.counter = 0;
      this.dragStartTime = 0;
      this.callbacks.onDrop?.(e);
    }));
  }
}
const H_REGEX = /(?<tag>[\w\-]+)?(?:#(?<id>[\w\-]+))?(?<class>(?:\.(?:[\w\-]+))*)(?:@(?<name>(?:[\w\_])+))?/;
function h(tag, ...args) {
  let attributes;
  let children;
  if (Array.isArray(args[0])) {
    attributes = {};
    children = args[0];
  } else {
    attributes = args[0] || {};
    children = args[1];
  }
  const match = H_REGEX.exec(tag);
  if (!match || !match.groups) {
    throw new Error("Bad use of h");
  }
  const tagName = match.groups["tag"] || "div";
  const el = document.createElement(tagName);
  if (match.groups["id"]) {
    el.id = match.groups["id"];
  }
  const classNames = [];
  if (match.groups["class"]) {
    for (const className of match.groups["class"].split(".")) {
      if (className !== "") {
        classNames.push(className);
      }
    }
  }
  if (attributes.className !== void 0) {
    for (const className of attributes.className.split(".")) {
      if (className !== "") {
        classNames.push(className);
      }
    }
  }
  if (classNames.length > 0) {
    el.className = classNames.join(" ");
  }
  const result = {};
  if (match.groups["name"]) {
    result[match.groups["name"]] = el;
  }
  if (children) {
    for (const c of children) {
      if (isHTMLElement(c)) {
        el.appendChild(c);
      } else if (typeof c === "string") {
        el.append(c);
      } else if ("root" in c) {
        Object.assign(result, c);
        el.appendChild(c.root);
      }
    }
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") {
      continue;
    } else if (key === "style") {
      for (const [cssKey, cssValue] of Object.entries(value)) {
        el.style.setProperty(
          camelCaseToHyphenCase(cssKey),
          typeof cssValue === "number" ? cssValue + "px" : "" + cssValue
        );
      }
    } else if (key === "tabIndex") {
      el.tabIndex = value;
    } else {
      el.setAttribute(camelCaseToHyphenCase(key), value.toString());
    }
  }
  result["root"] = el;
  return result;
}
function svgElem(tag, ...args) {
  let attributes;
  let children;
  if (Array.isArray(args[0])) {
    attributes = {};
    children = args[0];
  } else {
    attributes = args[0] || {};
    children = args[1];
  }
  const match = H_REGEX.exec(tag);
  if (!match || !match.groups) {
    throw new Error("Bad use of h");
  }
  const tagName = match.groups["tag"] || "div";
  const el = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  if (match.groups["id"]) {
    el.id = match.groups["id"];
  }
  const classNames = [];
  if (match.groups["class"]) {
    for (const className of match.groups["class"].split(".")) {
      if (className !== "") {
        classNames.push(className);
      }
    }
  }
  if (attributes.className !== void 0) {
    for (const className of attributes.className.split(".")) {
      if (className !== "") {
        classNames.push(className);
      }
    }
  }
  if (classNames.length > 0) {
    el.className = classNames.join(" ");
  }
  const result = {};
  if (match.groups["name"]) {
    result[match.groups["name"]] = el;
  }
  if (children) {
    for (const c of children) {
      if (isHTMLElement(c)) {
        el.appendChild(c);
      } else if (typeof c === "string") {
        el.append(c);
      } else if ("root" in c) {
        Object.assign(result, c);
        el.appendChild(c.root);
      }
    }
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") {
      continue;
    } else if (key === "style") {
      for (const [cssKey, cssValue] of Object.entries(value)) {
        el.style.setProperty(
          camelCaseToHyphenCase(cssKey),
          typeof cssValue === "number" ? cssValue + "px" : "" + cssValue
        );
      }
    } else if (key === "tabIndex") {
      el.tabIndex = value;
    } else {
      el.setAttribute(camelCaseToHyphenCase(key), value.toString());
    }
  }
  result["root"] = el;
  return result;
}
function camelCaseToHyphenCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
function copyAttributes(from, to, filter) {
  for (const { name, value } of from.attributes) {
    if (!filter || filter.includes(name)) {
      to.setAttribute(name, value);
    }
  }
}
function copyAttribute(from, to, name) {
  const value = from.getAttribute(name);
  if (value) {
    to.setAttribute(name, value);
  } else {
    to.removeAttribute(name);
  }
}
function trackAttributes(from, to, filter) {
  copyAttributes(from, to, filter);
  const disposables = new DisposableStore();
  disposables.add(sharedMutationObserver.observe(from, disposables, { attributes: true, attributeFilter: filter })((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName) {
        copyAttribute(from, to, mutation.attributeName);
      }
    }
  }));
  return disposables;
}
function isEditableElement(element) {
  return element.tagName.toLowerCase() === "input" || element.tagName.toLowerCase() === "textarea" || isHTMLElement(element) && !!element.editContext;
}
class SafeTriangle {
  constructor(originX, originY, target) {
    this.originX = originX;
    this.originY = originY;
    // 4 points (x, y), 8 length
    this.points = new Int16Array(8);
    const { top, left, right, bottom } = target.getBoundingClientRect();
    const t = this.points;
    let i = 0;
    t[i++] = left;
    t[i++] = top;
    t[i++] = right;
    t[i++] = top;
    t[i++] = left;
    t[i++] = bottom;
    t[i++] = right;
    t[i++] = bottom;
  }
  contains(x, y) {
    const { points, originX, originY } = this;
    for (let i = 0; i < 4; i++) {
      const p1 = 2 * i;
      const p2 = 2 * ((i + 1) % 4);
      if (isPointWithinTriangle(x, y, originX, originY, points[p1], points[p1 + 1], points[p2], points[p2 + 1])) {
        return true;
      }
    }
    return false;
  }
}
export {
  $,
  DetectedFullscreenMode,
  Dimension,
  DragAndDropObserver,
  EventHelper,
  EventType,
  ModifierKeyEmitter,
  Namespace,
  SafeTriangle,
  WindowIdleValue,
  WindowIntervalTimer,
  addDisposableGenericMouseDownListener,
  addDisposableGenericMouseMoveListener,
  addDisposableGenericMouseUpListener,
  addDisposableListener,
  addDisposableThrottledListener,
  addStandardDisposableGenericMouseDownListener,
  addStandardDisposableGenericMouseUpListener,
  addStandardDisposableListener,
  after,
  animate,
  append,
  basicMarkupHtmlTags,
  clearNode,
  computeScreenAwareSize,
  copyAttributes,
  createLinkElement,
  createMetaElement,
  detectFullscreen,
  disposableWindowInterval,
  domContentLoaded,
  finalHandler,
  findParentWithClass,
  getActiveDocument,
  getActiveElement,
  getActiveWindow,
  getClientArea,
  getComputedStyle,
  getContentHeight,
  getContentWidth,
  getCookieValue,
  getDocument,
  getDomNodePagePosition,
  getDomNodeZoomLevel,
  getLargestChildWidth,
  getShadowRoot,
  getTopLeftOffset,
  getTotalHeight,
  getTotalScrollWidth,
  getTotalWidth,
  getWindow,
  getWindowById,
  getWindowId,
  getWindows,
  getWindowsCount,
  h,
  hasParentWithClass,
  hasWindow,
  hide,
  hookDomPurifyHrefAndSrcSanitizer,
  isActiveDocument,
  isActiveElement,
  isAncestor,
  isAncestorOfActiveElement,
  isAncestorUsingFlowTo,
  isDragEvent,
  isEditableElement,
  isEventLike,
  isHTMLAnchorElement,
  isHTMLButtonElement,
  isHTMLDivElement,
  isHTMLElement,
  isHTMLInputElement,
  isHTMLSpanElement,
  isHTMLTextAreaElement,
  isInShadowDOM,
  isKeyboardEvent,
  isMouseEvent,
  isPointerEvent,
  isSVGElement,
  isShadowRoot,
  join,
  measure,
  modify,
  multibyteAwareBtoa,
  onDidRegisterWindow,
  onDidUnregisterWindow,
  onWillUnregisterWindow,
  position,
  prepend,
  registerWindow,
  removeTabIndexAndUpdateFocus,
  reset,
  restoreParentsScrollTop,
  runAtThisOrScheduleAtNextAnimationFrame,
  runWhenWindowIdle,
  safeInnerHtml,
  saveParentsScrollTop,
  scheduleAtNextAnimationFrame,
  setParentFlowTo,
  setVisibility,
  sharedMutationObserver,
  show,
  size,
  svgElem,
  trackAttributes,
  trackFocus,
  triggerDownload,
  triggerUpload,
  windowOpenNoOpener,
  windowOpenPopup,
  windowOpenWithSuccess
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvZG9tLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgYnJvd3NlciBmcm9tICcuL2Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgQnJvd3NlckZlYXR1cmVzIH0gZnJvbSAnLi9jYW5JVXNlLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50LCBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgSU1vdXNlRXZlbnQsIFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4vbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdElkbGVWYWx1ZSwgSW50ZXJ2YWxUaW1lciwgVGltZW91dFRpbWVyLCBfcnVuV2hlbklkbGUsIElkbGVEZWFkbGluZSB9IGZyb20gJy4uL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0ICogYXMgZXZlbnQgZnJvbSAnLi4vY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCBkb21wdXJpZnkgZnJvbSAnLi9kb21wdXJpZnkvZG9tcHVyaWZ5LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZW1vdGVBdXRob3JpdGllcywgU2NoZW1hcyB9IGZyb20gJy4uL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGhhc2ggfSBmcm9tICcuLi9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBDb2RlV2luZG93LCBlbnN1cmVDb2RlV2luZG93LCBtYWluV2luZG93IH0gZnJvbSAnLi93aW5kb3cuanMnO1xuaW1wb3J0IHsgaXNQb2ludFdpdGhpblRyaWFuZ2xlIH0gZnJvbSAnLi4vY29tbW9uL251bWJlcnMuanMnO1xuZXhwb3J0ICogZnJvbSAnLi9kb21JbXBsL2RvbU9ic2VydmFibGUuanMnO1xuZXhwb3J0ICogZnJvbSAnLi9kb21JbXBsL24uanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElSZWdpc3RlcmVkQ29kZVdpbmRvdyB7XG5cdHJlYWRvbmx5IHdpbmRvdzogQ29kZVdpbmRvdztcblx0cmVhZG9ubHkgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuLy8jIHJlZ2lvbiBNdWx0aS1XaW5kb3cgU3VwcG9ydCBVdGlsaXRpZXNcblxuZXhwb3J0IGNvbnN0IHtcblx0cmVnaXN0ZXJXaW5kb3csXG5cdGdldFdpbmRvdyxcblx0Z2V0RG9jdW1lbnQsXG5cdGdldFdpbmRvd3MsXG5cdGdldFdpbmRvd3NDb3VudCxcblx0Z2V0V2luZG93SWQsXG5cdGdldFdpbmRvd0J5SWQsXG5cdGhhc1dpbmRvdyxcblx0b25EaWRSZWdpc3RlcldpbmRvdyxcblx0b25XaWxsVW5yZWdpc3RlcldpbmRvdyxcblx0b25EaWRVbnJlZ2lzdGVyV2luZG93XG59ID0gKGZ1bmN0aW9uICgpIHtcblx0Y29uc3Qgd2luZG93cyA9IG5ldyBNYXA8bnVtYmVyLCBJUmVnaXN0ZXJlZENvZGVXaW5kb3c+KCk7XG5cblx0ZW5zdXJlQ29kZVdpbmRvdyhtYWluV2luZG93LCAxKTtcblx0Y29uc3QgbWFpbldpbmRvd1JlZ2lzdHJhdGlvbiA9IHsgd2luZG93OiBtYWluV2luZG93LCBkaXNwb3NhYmxlczogbmV3IERpc3Bvc2FibGVTdG9yZSgpIH07XG5cdHdpbmRvd3Muc2V0KG1haW5XaW5kb3cudnNjb2RlV2luZG93SWQsIG1haW5XaW5kb3dSZWdpc3RyYXRpb24pO1xuXG5cdGNvbnN0IG9uRGlkUmVnaXN0ZXJXaW5kb3cgPSBuZXcgZXZlbnQuRW1pdHRlcjxJUmVnaXN0ZXJlZENvZGVXaW5kb3c+KCk7XG5cdGNvbnN0IG9uRGlkVW5yZWdpc3RlcldpbmRvdyA9IG5ldyBldmVudC5FbWl0dGVyPENvZGVXaW5kb3c+KCk7XG5cdGNvbnN0IG9uV2lsbFVucmVnaXN0ZXJXaW5kb3cgPSBuZXcgZXZlbnQuRW1pdHRlcjxDb2RlV2luZG93PigpO1xuXG5cdGZ1bmN0aW9uIGdldFdpbmRvd0J5SWQod2luZG93SWQ6IG51bWJlcik6IElSZWdpc3RlcmVkQ29kZVdpbmRvdyB8IHVuZGVmaW5lZDtcblx0ZnVuY3Rpb24gZ2V0V2luZG93QnlJZCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBmYWxsYmFja1RvTWFpbjogdHJ1ZSk6IElSZWdpc3RlcmVkQ29kZVdpbmRvdztcblx0ZnVuY3Rpb24gZ2V0V2luZG93QnlJZCh3aW5kb3dJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBmYWxsYmFja1RvTWFpbj86IGJvb2xlYW4pOiBJUmVnaXN0ZXJlZENvZGVXaW5kb3cgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHdpbmRvdyA9IHR5cGVvZiB3aW5kb3dJZCA9PT0gJ251bWJlcicgPyB3aW5kb3dzLmdldCh3aW5kb3dJZCkgOiB1bmRlZmluZWQ7XG5cblx0XHRyZXR1cm4gd2luZG93ID8/IChmYWxsYmFja1RvTWFpbiA/IG1haW5XaW5kb3dSZWdpc3RyYXRpb24gOiB1bmRlZmluZWQpO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRvbkRpZFJlZ2lzdGVyV2luZG93OiBvbkRpZFJlZ2lzdGVyV2luZG93LmV2ZW50LFxuXHRcdG9uV2lsbFVucmVnaXN0ZXJXaW5kb3c6IG9uV2lsbFVucmVnaXN0ZXJXaW5kb3cuZXZlbnQsXG5cdFx0b25EaWRVbnJlZ2lzdGVyV2luZG93OiBvbkRpZFVucmVnaXN0ZXJXaW5kb3cuZXZlbnQsXG5cdFx0cmVnaXN0ZXJXaW5kb3cod2luZG93OiBDb2RlV2luZG93KTogSURpc3Bvc2FibGUge1xuXHRcdFx0aWYgKHdpbmRvd3MuaGFzKHdpbmRvdy52c2NvZGVXaW5kb3dJZCkpIHtcblx0XHRcdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdGNvbnN0IHJlZ2lzdGVyZWRXaW5kb3cgPSB7XG5cdFx0XHRcdHdpbmRvdyxcblx0XHRcdFx0ZGlzcG9zYWJsZXM6IGRpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpXG5cdFx0XHR9O1xuXHRcdFx0d2luZG93cy5zZXQod2luZG93LnZzY29kZVdpbmRvd0lkLCByZWdpc3RlcmVkV2luZG93KTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdHdpbmRvd3MuZGVsZXRlKHdpbmRvdy52c2NvZGVXaW5kb3dJZCk7XG5cdFx0XHRcdG9uRGlkVW5yZWdpc3RlcldpbmRvdy5maXJlKHdpbmRvdyk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LCBFdmVudFR5cGUuQkVGT1JFX1VOTE9BRCwgKCkgPT4ge1xuXHRcdFx0XHRvbldpbGxVbnJlZ2lzdGVyV2luZG93LmZpcmUod2luZG93KTtcblx0XHRcdH0pKTtcblxuXHRcdFx0b25EaWRSZWdpc3RlcldpbmRvdy5maXJlKHJlZ2lzdGVyZWRXaW5kb3cpO1xuXG5cdFx0XHRyZXR1cm4gZGlzcG9zYWJsZXM7XG5cdFx0fSxcblx0XHRnZXRXaW5kb3dzKCk6IEl0ZXJhYmxlPElSZWdpc3RlcmVkQ29kZVdpbmRvdz4ge1xuXHRcdFx0cmV0dXJuIHdpbmRvd3MudmFsdWVzKCk7XG5cdFx0fSxcblx0XHRnZXRXaW5kb3dzQ291bnQoKTogbnVtYmVyIHtcblx0XHRcdHJldHVybiB3aW5kb3dzLnNpemU7XG5cdFx0fSxcblx0XHRnZXRXaW5kb3dJZCh0YXJnZXRXaW5kb3c6IFdpbmRvdyk6IG51bWJlciB7XG5cdFx0XHRyZXR1cm4gKHRhcmdldFdpbmRvdyBhcyBDb2RlV2luZG93KS52c2NvZGVXaW5kb3dJZDtcblx0XHR9LFxuXHRcdGhhc1dpbmRvdyh3aW5kb3dJZDogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0XHRyZXR1cm4gd2luZG93cy5oYXMod2luZG93SWQpO1xuXHRcdH0sXG5cdFx0Z2V0V2luZG93QnlJZCxcblx0XHRnZXRXaW5kb3coZTogTm9kZSB8IFVJRXZlbnQgfCB1bmRlZmluZWQgfCBudWxsKTogQ29kZVdpbmRvdyB7XG5cdFx0XHRjb25zdCBjYW5kaWRhdGVOb2RlID0gZSBhcyBOb2RlIHwgdW5kZWZpbmVkIHwgbnVsbDtcblx0XHRcdGlmIChjYW5kaWRhdGVOb2RlPy5vd25lckRvY3VtZW50Py5kZWZhdWx0Vmlldykge1xuXHRcdFx0XHRyZXR1cm4gY2FuZGlkYXRlTm9kZS5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LndpbmRvdyBhcyBDb2RlV2luZG93O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjYW5kaWRhdGVFdmVudCA9IGUgYXMgVUlFdmVudCB8IHVuZGVmaW5lZCB8IG51bGw7XG5cdFx0XHRpZiAoY2FuZGlkYXRlRXZlbnQ/LnZpZXcpIHtcblx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZUV2ZW50LnZpZXcud2luZG93IGFzIENvZGVXaW5kb3c7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBtYWluV2luZG93O1xuXHRcdH0sXG5cdFx0Z2V0RG9jdW1lbnQoZTogTm9kZSB8IFVJRXZlbnQgfCB1bmRlZmluZWQgfCBudWxsKTogRG9jdW1lbnQge1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlTm9kZSA9IGUgYXMgTm9kZSB8IHVuZGVmaW5lZCB8IG51bGw7XG5cdFx0XHRyZXR1cm4gZ2V0V2luZG93KGNhbmRpZGF0ZU5vZGUpLmRvY3VtZW50O1xuXHRcdH1cblx0fTtcbn0pKCk7XG5cbi8vI2VuZHJlZ2lvblxuXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJOb2RlKG5vZGU6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdHdoaWxlIChub2RlLmZpcnN0Q2hpbGQpIHtcblx0XHRub2RlLmZpcnN0Q2hpbGQucmVtb3ZlKCk7XG5cdH1cbn1cblxuY2xhc3MgRG9tTGlzdGVuZXIgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBfaGFuZGxlcjogKGU6IGFueSkgPT4gdm9pZDtcblx0cHJpdmF0ZSBfbm9kZTogRXZlbnRUYXJnZXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3R5cGU6IHN0cmluZztcblx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogYm9vbGVhbiB8IEFkZEV2ZW50TGlzdGVuZXJPcHRpb25zO1xuXG5cdGNvbnN0cnVjdG9yKG5vZGU6IEV2ZW50VGFyZ2V0LCB0eXBlOiBzdHJpbmcsIGhhbmRsZXI6IChlOiBhbnkpID0+IHZvaWQsIG9wdGlvbnM/OiBib29sZWFuIHwgQWRkRXZlbnRMaXN0ZW5lck9wdGlvbnMpIHtcblx0XHR0aGlzLl9ub2RlID0gbm9kZTtcblx0XHR0aGlzLl90eXBlID0gdHlwZTtcblx0XHR0aGlzLl9oYW5kbGVyID0gaGFuZGxlcjtcblx0XHR0aGlzLl9vcHRpb25zID0gKG9wdGlvbnMgfHwgZmFsc2UpO1xuXHRcdHRoaXMuX25vZGUuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLl90eXBlLCB0aGlzLl9oYW5kbGVyLCB0aGlzLl9vcHRpb25zKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9oYW5kbGVyKSB7XG5cdFx0XHQvLyBBbHJlYWR5IGRpc3Bvc2VkXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMuX3R5cGUsIHRoaXMuX2hhbmRsZXIsIHRoaXMuX29wdGlvbnMpO1xuXG5cdFx0Ly8gUHJldmVudCBsZWFrZXJzIGZyb20gaG9sZGluZyBvbiB0byB0aGUgZG9tIG9yIGhhbmRsZXIgZnVuY1xuXHRcdHRoaXMuX25vZGUgPSBudWxsITtcblx0XHR0aGlzLl9oYW5kbGVyID0gbnVsbCE7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZERpc3Bvc2FibGVMaXN0ZW5lcjxLIGV4dGVuZHMga2V5b2YgR2xvYmFsRXZlbnRIYW5kbGVyc0V2ZW50TWFwPihub2RlOiBFdmVudFRhcmdldCwgdHlwZTogSywgaGFuZGxlcjogKGV2ZW50OiBHbG9iYWxFdmVudEhhbmRsZXJzRXZlbnRNYXBbS10pID0+IHZvaWQsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGU7XG5leHBvcnQgZnVuY3Rpb24gYWRkRGlzcG9zYWJsZUxpc3RlbmVyKG5vZGU6IEV2ZW50VGFyZ2V0LCB0eXBlOiBzdHJpbmcsIGhhbmRsZXI6IChldmVudDogYW55KSA9PiB2b2lkLCB1c2VDYXB0dXJlPzogYm9vbGVhbik6IElEaXNwb3NhYmxlO1xuZXhwb3J0IGZ1bmN0aW9uIGFkZERpc3Bvc2FibGVMaXN0ZW5lcihub2RlOiBFdmVudFRhcmdldCwgdHlwZTogc3RyaW5nLCBoYW5kbGVyOiAoZXZlbnQ6IGFueSkgPT4gdm9pZCwgb3B0aW9uczogQWRkRXZlbnRMaXN0ZW5lck9wdGlvbnMpOiBJRGlzcG9zYWJsZTtcbmV4cG9ydCBmdW5jdGlvbiBhZGREaXNwb3NhYmxlTGlzdGVuZXIobm9kZTogRXZlbnRUYXJnZXQsIHR5cGU6IHN0cmluZywgaGFuZGxlcjogKGV2ZW50OiBhbnkpID0+IHZvaWQsIHVzZUNhcHR1cmVPck9wdGlvbnM/OiBib29sZWFuIHwgQWRkRXZlbnRMaXN0ZW5lck9wdGlvbnMpOiBJRGlzcG9zYWJsZSB7XG5cdHJldHVybiBuZXcgRG9tTGlzdGVuZXIobm9kZSwgdHlwZSwgaGFuZGxlciwgdXNlQ2FwdHVyZU9yT3B0aW9ucyk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyU2lnbmF0dXJlIHtcblx0KG5vZGU6IEhUTUxFbGVtZW50LCB0eXBlOiAnY2xpY2snLCBoYW5kbGVyOiAoZXZlbnQ6IElNb3VzZUV2ZW50KSA9PiB2b2lkLCB1c2VDYXB0dXJlPzogYm9vbGVhbik6IElEaXNwb3NhYmxlO1xuXHQobm9kZTogSFRNTEVsZW1lbnQsIHR5cGU6ICdtb3VzZWRvd24nLCBoYW5kbGVyOiAoZXZlbnQ6IElNb3VzZUV2ZW50KSA9PiB2b2lkLCB1c2VDYXB0dXJlPzogYm9vbGVhbik6IElEaXNwb3NhYmxlO1xuXHQobm9kZTogSFRNTEVsZW1lbnQsIHR5cGU6ICdrZXlkb3duJywgaGFuZGxlcjogKGV2ZW50OiBJS2V5Ym9hcmRFdmVudCkgPT4gdm9pZCwgdXNlQ2FwdHVyZT86IGJvb2xlYW4pOiBJRGlzcG9zYWJsZTtcblx0KG5vZGU6IEhUTUxFbGVtZW50LCB0eXBlOiAna2V5cHJlc3MnLCBoYW5kbGVyOiAoZXZlbnQ6IElLZXlib2FyZEV2ZW50KSA9PiB2b2lkLCB1c2VDYXB0dXJlPzogYm9vbGVhbik6IElEaXNwb3NhYmxlO1xuXHQobm9kZTogSFRNTEVsZW1lbnQsIHR5cGU6ICdrZXl1cCcsIGhhbmRsZXI6IChldmVudDogSUtleWJvYXJkRXZlbnQpID0+IHZvaWQsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGU7XG5cdChub2RlOiBIVE1MRWxlbWVudCwgdHlwZTogJ3BvaW50ZXJkb3duJywgaGFuZGxlcjogKGV2ZW50OiBQb2ludGVyRXZlbnQpID0+IHZvaWQsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGU7XG5cdChub2RlOiBIVE1MRWxlbWVudCwgdHlwZTogJ3BvaW50ZXJtb3ZlJywgaGFuZGxlcjogKGV2ZW50OiBQb2ludGVyRXZlbnQpID0+IHZvaWQsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGU7XG5cdChub2RlOiBIVE1MRWxlbWVudCwgdHlwZTogJ3BvaW50ZXJ1cCcsIGhhbmRsZXI6IChldmVudDogUG9pbnRlckV2ZW50KSA9PiB2b2lkLCB1c2VDYXB0dXJlPzogYm9vbGVhbik6IElEaXNwb3NhYmxlO1xuXHQobm9kZTogSFRNTEVsZW1lbnQsIHR5cGU6IHN0cmluZywgaGFuZGxlcjogKGV2ZW50OiBhbnkpID0+IHZvaWQsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGU7XG59XG5mdW5jdGlvbiBfd3JhcEFzU3RhbmRhcmRNb3VzZUV2ZW50KHRhcmdldFdpbmRvdzogV2luZG93LCBoYW5kbGVyOiAoZTogSU1vdXNlRXZlbnQpID0+IHZvaWQpOiAoZTogTW91c2VFdmVudCkgPT4gdm9pZCB7XG5cdHJldHVybiBmdW5jdGlvbiAoZTogTW91c2VFdmVudCkge1xuXHRcdHJldHVybiBoYW5kbGVyKG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQodGFyZ2V0V2luZG93LCBlKSk7XG5cdH07XG59XG5mdW5jdGlvbiBfd3JhcEFzU3RhbmRhcmRLZXlib2FyZEV2ZW50KGhhbmRsZXI6IChlOiBJS2V5Ym9hcmRFdmVudCkgPT4gdm9pZCk6IChlOiBLZXlib2FyZEV2ZW50KSA9PiB2b2lkIHtcblx0cmV0dXJuIGZ1bmN0aW9uIChlOiBLZXlib2FyZEV2ZW50KSB7XG5cdFx0cmV0dXJuIGhhbmRsZXIobmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKSk7XG5cdH07XG59XG5leHBvcnQgY29uc3QgYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXI6IElBZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lclNpZ25hdHVyZSA9IGZ1bmN0aW9uIGFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKG5vZGU6IEhUTUxFbGVtZW50LCB0eXBlOiBzdHJpbmcsIGhhbmRsZXI6IChldmVudDogYW55KSA9PiB2b2lkLCB1c2VDYXB0dXJlPzogYm9vbGVhbik6IElEaXNwb3NhYmxlIHtcblx0bGV0IHdyYXBIYW5kbGVyID0gaGFuZGxlcjtcblxuXHRpZiAodHlwZSA9PT0gJ2NsaWNrJyB8fCB0eXBlID09PSAnbW91c2Vkb3duJyB8fCB0eXBlID09PSAnY29udGV4dG1lbnUnKSB7XG5cdFx0d3JhcEhhbmRsZXIgPSBfd3JhcEFzU3RhbmRhcmRNb3VzZUV2ZW50KGdldFdpbmRvdyhub2RlKSwgaGFuZGxlcik7XG5cdH0gZWxzZSBpZiAodHlwZSA9PT0gJ2tleWRvd24nIHx8IHR5cGUgPT09ICdrZXlwcmVzcycgfHwgdHlwZSA9PT0gJ2tleXVwJykge1xuXHRcdHdyYXBIYW5kbGVyID0gX3dyYXBBc1N0YW5kYXJkS2V5Ym9hcmRFdmVudChoYW5kbGVyKTtcblx0fVxuXG5cdHJldHVybiBhZGREaXNwb3NhYmxlTGlzdGVuZXIobm9kZSwgdHlwZSwgd3JhcEhhbmRsZXIsIHVzZUNhcHR1cmUpO1xufTtcblxuZXhwb3J0IGNvbnN0IGFkZFN0YW5kYXJkRGlzcG9zYWJsZUdlbmVyaWNNb3VzZURvd25MaXN0ZW5lciA9IGZ1bmN0aW9uIGFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKG5vZGU6IEhUTUxFbGVtZW50LCBoYW5kbGVyOiAoZXZlbnQ6IGFueSkgPT4gdm9pZCwgdXNlQ2FwdHVyZT86IGJvb2xlYW4pOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IHdyYXBIYW5kbGVyID0gX3dyYXBBc1N0YW5kYXJkTW91c2VFdmVudChnZXRXaW5kb3cobm9kZSksIGhhbmRsZXIpO1xuXG5cdHJldHVybiBhZGREaXNwb3NhYmxlR2VuZXJpY01vdXNlRG93bkxpc3RlbmVyKG5vZGUsIHdyYXBIYW5kbGVyLCB1c2VDYXB0dXJlKTtcbn07XG5cbmV4cG9ydCBjb25zdCBhZGRTdGFuZGFyZERpc3Bvc2FibGVHZW5lcmljTW91c2VVcExpc3RlbmVyID0gZnVuY3Rpb24gYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIobm9kZTogSFRNTEVsZW1lbnQsIGhhbmRsZXI6IChldmVudDogYW55KSA9PiB2b2lkLCB1c2VDYXB0dXJlPzogYm9vbGVhbik6IElEaXNwb3NhYmxlIHtcblx0Y29uc3Qgd3JhcEhhbmRsZXIgPSBfd3JhcEFzU3RhbmRhcmRNb3VzZUV2ZW50KGdldFdpbmRvdyhub2RlKSwgaGFuZGxlcik7XG5cblx0cmV0dXJuIGFkZERpc3Bvc2FibGVHZW5lcmljTW91c2VVcExpc3RlbmVyKG5vZGUsIHdyYXBIYW5kbGVyLCB1c2VDYXB0dXJlKTtcbn07XG5leHBvcnQgZnVuY3Rpb24gYWRkRGlzcG9zYWJsZUdlbmVyaWNNb3VzZURvd25MaXN0ZW5lcihub2RlOiBFdmVudFRhcmdldCwgaGFuZGxlcjogKGV2ZW50OiBhbnkpID0+IHZvaWQsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGUge1xuXHRyZXR1cm4gYWRkRGlzcG9zYWJsZUxpc3RlbmVyKG5vZGUsIHBsYXRmb3JtLmlzSU9TICYmIEJyb3dzZXJGZWF0dXJlcy5wb2ludGVyRXZlbnRzID8gRXZlbnRUeXBlLlBPSU5URVJfRE9XTiA6IEV2ZW50VHlwZS5NT1VTRV9ET1dOLCBoYW5kbGVyLCB1c2VDYXB0dXJlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZERpc3Bvc2FibGVHZW5lcmljTW91c2VNb3ZlTGlzdGVuZXIobm9kZTogRXZlbnRUYXJnZXQsIGhhbmRsZXI6IChldmVudDogYW55KSA9PiB2b2lkLCB1c2VDYXB0dXJlPzogYm9vbGVhbik6IElEaXNwb3NhYmxlIHtcblx0cmV0dXJuIGFkZERpc3Bvc2FibGVMaXN0ZW5lcihub2RlLCBwbGF0Zm9ybS5pc0lPUyAmJiBCcm93c2VyRmVhdHVyZXMucG9pbnRlckV2ZW50cyA/IEV2ZW50VHlwZS5QT0lOVEVSX01PVkUgOiBFdmVudFR5cGUuTU9VU0VfTU9WRSwgaGFuZGxlciwgdXNlQ2FwdHVyZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGREaXNwb3NhYmxlR2VuZXJpY01vdXNlVXBMaXN0ZW5lcihub2RlOiBFdmVudFRhcmdldCwgaGFuZGxlcjogKGV2ZW50OiBhbnkpID0+IHZvaWQsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogSURpc3Bvc2FibGUge1xuXHRyZXR1cm4gYWRkRGlzcG9zYWJsZUxpc3RlbmVyKG5vZGUsIHBsYXRmb3JtLmlzSU9TICYmIEJyb3dzZXJGZWF0dXJlcy5wb2ludGVyRXZlbnRzID8gRXZlbnRUeXBlLlBPSU5URVJfVVAgOiBFdmVudFR5cGUuTU9VU0VfVVAsIGhhbmRsZXIsIHVzZUNhcHR1cmUpO1xufVxuXG4vKipcbiAqIEV4ZWN1dGUgdGhlIGNhbGxiYWNrIHRoZSBuZXh0IHRpbWUgdGhlIGJyb3dzZXIgaXMgaWRsZSwgcmV0dXJuaW5nIGFuXG4gKiB7QGxpbmsgSURpc3Bvc2FibGV9IHRoYXQgd2lsbCBjYW5jZWwgdGhlIGNhbGxiYWNrIHdoZW4gZGlzcG9zZWQuIFRoaXMgd3JhcHNcbiAqIFtyZXF1ZXN0SWRsZUNhbGxiYWNrXSBzbyBpdCB3aWxsIGZhbGxiYWNrIHRvIFtzZXRUaW1lb3V0XSBpZiB0aGUgZW52aXJvbm1lbnRcbiAqIGRvZXNuJ3Qgc3VwcG9ydCBpdC5cbiAqXG4gKiBAcGFyYW0gdGFyZ2V0V2luZG93IFRoZSB3aW5kb3cgZm9yIHdoaWNoIHRvIHJ1biB0aGUgaWRsZSBjYWxsYmFja1xuICogQHBhcmFtIGNhbGxiYWNrIFRoZSBjYWxsYmFjayB0byBydW4gd2hlbiBpZGxlLCB0aGlzIGluY2x1ZGVzIGFuXG4gKiBbSWRsZURlYWRsaW5lXSB0aGF0IHByb3ZpZGVzIHRoZSB0aW1lIGFsbG90ZWQgZm9yIHRoZSBpZGxlIGNhbGxiYWNrIGJ5IHRoZVxuICogYnJvd3Nlci4gTm90IHJlc3BlY3RpbmcgdGhpcyBkZWFkbGluZSB3aWxsIHJlc3VsdCBpbiBhIGRlZ3JhZGVkIHVzZXJcbiAqIGV4cGVyaWVuY2UuXG4gKiBAcGFyYW0gdGltZW91dCBBIHRpbWVvdXQgYXQgd2hpY2ggcG9pbnQgdG8gcXVldWUgbm8gbG9uZ2VyIHdhaXQgZm9yIGFuIGlkbGVcbiAqIGNhbGxiYWNrIGJ1dCBxdWV1ZSBpdCBvbiB0aGUgcmVndWxhciBldmVudCBsb29wIChsaWtlIHNldFRpbWVvdXQpLiBUeXBpY2FsbHlcbiAqIHRoaXMgc2hvdWxkIG5vdCBiZSB1c2VkLlxuICpcbiAqIFtJZGxlRGVhZGxpbmVdOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvSWRsZURlYWRsaW5lXG4gKiBbcmVxdWVzdElkbGVDYWxsYmFja106IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9XaW5kb3cvcmVxdWVzdElkbGVDYWxsYmFja1xuICogW3NldFRpbWVvdXRdOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2luZG93L3NldFRpbWVvdXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJ1bldoZW5XaW5kb3dJZGxlKHRhcmdldFdpbmRvdzogV2luZG93IHwgdHlwZW9mIGdsb2JhbFRoaXMsIGNhbGxiYWNrOiAoaWRsZTogSWRsZURlYWRsaW5lKSA9PiB2b2lkLCB0aW1lb3V0PzogbnVtYmVyKTogSURpc3Bvc2FibGUge1xuXHRyZXR1cm4gX3J1bldoZW5JZGxlKHRhcmdldFdpbmRvdywgY2FsbGJhY2ssIHRpbWVvdXQpO1xufVxuXG4vKipcbiAqIEFuIGltcGxlbWVudGF0aW9uIG9mIHRoZSBcImlkbGUtdW50aWwtdXJnZW50XCItc3RyYXRlZ3kgYXMgaW50cm9kdWNlZFxuICogaGVyZTogaHR0cHM6Ly9waGlsaXB3YWx0b24uY29tL2FydGljbGVzL2lkbGUtdW50aWwtdXJnZW50L1xuICovXG5leHBvcnQgY2xhc3MgV2luZG93SWRsZVZhbHVlPFQ+IGV4dGVuZHMgQWJzdHJhY3RJZGxlVmFsdWU8VD4ge1xuXHRjb25zdHJ1Y3Rvcih0YXJnZXRXaW5kb3c6IFdpbmRvdyB8IHR5cGVvZiBnbG9iYWxUaGlzLCBleGVjdXRvcjogKCkgPT4gVCkge1xuXHRcdHN1cGVyKHRhcmdldFdpbmRvdywgZXhlY3V0b3IpO1xuXHR9XG59XG5cbi8qKlxuICogU2NoZWR1bGUgYSBjYWxsYmFjayB0byBiZSBydW4gYXQgdGhlIG5leHQgYW5pbWF0aW9uIGZyYW1lLlxuICogVGhpcyBhbGxvd3MgbXVsdGlwbGUgcGFydGllcyB0byByZWdpc3RlciBjYWxsYmFja3MgdGhhdCBzaG91bGQgcnVuIGF0IHRoZSBuZXh0IGFuaW1hdGlvbiBmcmFtZS5cbiAqIElmIGN1cnJlbnRseSBpbiBhbiBhbmltYXRpb24gZnJhbWUsIGBydW5uZXJgIHdpbGwgYmUgZXhlY3V0ZWQgaW1tZWRpYXRlbHkuXG4gKiBAcmV0dXJuIHRva2VuIHRoYXQgY2FuIGJlIHVzZWQgdG8gY2FuY2VsIHRoZSBzY2hlZHVsZWQgcnVubmVyIChvbmx5IGlmIGBydW5uZXJgIHdhcyBub3QgZXhlY3V0ZWQgaW1tZWRpYXRlbHkpLlxuICovXG5leHBvcnQgbGV0IHJ1bkF0VGhpc09yU2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZTogKHRhcmdldFdpbmRvdzogV2luZG93LCBydW5uZXI6ICgpID0+IHZvaWQsIHByaW9yaXR5PzogbnVtYmVyKSA9PiBJRGlzcG9zYWJsZTtcbi8qKlxuICogU2NoZWR1bGUgYSBjYWxsYmFjayB0byBiZSBydW4gYXQgdGhlIG5leHQgYW5pbWF0aW9uIGZyYW1lLlxuICogVGhpcyBhbGxvd3MgbXVsdGlwbGUgcGFydGllcyB0byByZWdpc3RlciBjYWxsYmFja3MgdGhhdCBzaG91bGQgcnVuIGF0IHRoZSBuZXh0IGFuaW1hdGlvbiBmcmFtZS5cbiAqIElmIGN1cnJlbnRseSBpbiBhbiBhbmltYXRpb24gZnJhbWUsIGBydW5uZXJgIHdpbGwgYmUgZXhlY3V0ZWQgYXQgdGhlIG5leHQgYW5pbWF0aW9uIGZyYW1lLlxuICogQHJldHVybiB0b2tlbiB0aGF0IGNhbiBiZSB1c2VkIHRvIGNhbmNlbCB0aGUgc2NoZWR1bGVkIHJ1bm5lci5cbiAqL1xuZXhwb3J0IGxldCBzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lOiAodGFyZ2V0V2luZG93OiBXaW5kb3csIHJ1bm5lcjogKCkgPT4gdm9pZCwgcHJpb3JpdHk/OiBudW1iZXIpID0+IElEaXNwb3NhYmxlO1xuXG5leHBvcnQgZnVuY3Rpb24gZGlzcG9zYWJsZVdpbmRvd0ludGVydmFsKHRhcmdldFdpbmRvdzogV2luZG93LCBoYW5kbGVyOiAoKSA9PiB2b2lkIHwgYm9vbGVhbiAvKiBzdG9wIGludGVydmFsICovIHwgUHJvbWlzZTx1bmtub3duPiwgaW50ZXJ2YWw6IG51bWJlciwgaXRlcmF0aW9ucz86IG51bWJlcik6IElEaXNwb3NhYmxlIHtcblx0bGV0IGl0ZXJhdGlvbiA9IDA7XG5cdGNvbnN0IHRpbWVyID0gdGFyZ2V0V2luZG93LnNldEludGVydmFsKCgpID0+IHtcblx0XHRpdGVyYXRpb24rKztcblx0XHRpZiAoKHR5cGVvZiBpdGVyYXRpb25zID09PSAnbnVtYmVyJyAmJiBpdGVyYXRpb24gPj0gaXRlcmF0aW9ucykgfHwgaGFuZGxlcigpID09PSB0cnVlKSB7XG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0sIGludGVydmFsKTtcblx0Y29uc3QgZGlzcG9zYWJsZSA9IHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0dGFyZ2V0V2luZG93LmNsZWFySW50ZXJ2YWwodGltZXIpO1xuXHR9KTtcblx0cmV0dXJuIGRpc3Bvc2FibGU7XG59XG5cbmV4cG9ydCBjbGFzcyBXaW5kb3dJbnRlcnZhbFRpbWVyIGV4dGVuZHMgSW50ZXJ2YWxUaW1lciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkZWZhdWx0VGFyZ2V0PzogV2luZG93ICYgdHlwZW9mIGdsb2JhbFRoaXM7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSBub2RlIFRoZSBvcHRpb25hbCBub2RlIGZyb20gd2hpY2ggdGhlIHRhcmdldCB3aW5kb3cgaXMgZGV0ZXJtaW5lZFxuXHQgKi9cblx0Y29uc3RydWN0b3Iobm9kZT86IE5vZGUpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuZGVmYXVsdFRhcmdldCA9IG5vZGUgJiYgZ2V0V2luZG93KG5vZGUpO1xuXHR9XG5cblx0b3ZlcnJpZGUgY2FuY2VsQW5kU2V0KHJ1bm5lcjogKCkgPT4gdm9pZCwgaW50ZXJ2YWw6IG51bWJlciwgdGFyZ2V0V2luZG93PzogV2luZG93ICYgdHlwZW9mIGdsb2JhbFRoaXMpOiB2b2lkIHtcblx0XHRyZXR1cm4gc3VwZXIuY2FuY2VsQW5kU2V0KHJ1bm5lciwgaW50ZXJ2YWwsIHRhcmdldFdpbmRvdyA/PyB0aGlzLmRlZmF1bHRUYXJnZXQpO1xuXHR9XG59XG5cbmNsYXNzIEFuaW1hdGlvbkZyYW1lUXVldWVJdGVtIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgX3J1bm5lcjogKCkgPT4gdm9pZDtcblx0cHVibGljIHByaW9yaXR5OiBudW1iZXI7XG5cdHByaXZhdGUgX2NhbmNlbGVkOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKHJ1bm5lcjogKCkgPT4gdm9pZCwgcHJpb3JpdHk6IG51bWJlciA9IDApIHtcblx0XHR0aGlzLl9ydW5uZXIgPSBydW5uZXI7XG5cdFx0dGhpcy5wcmlvcml0eSA9IHByaW9yaXR5O1xuXHRcdHRoaXMuX2NhbmNlbGVkID0gZmFsc2U7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2NhbmNlbGVkID0gdHJ1ZTtcblx0fVxuXG5cdGV4ZWN1dGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2NhbmNlbGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX3J1bm5lcigpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGUpO1xuXHRcdH1cblx0fVxuXG5cdC8vIFNvcnQgYnkgcHJpb3JpdHkgKGxhcmdlc3QgdG8gbG93ZXN0KVxuXHRzdGF0aWMgc29ydChhOiBBbmltYXRpb25GcmFtZVF1ZXVlSXRlbSwgYjogQW5pbWF0aW9uRnJhbWVRdWV1ZUl0ZW0pOiBudW1iZXIge1xuXHRcdHJldHVybiBiLnByaW9yaXR5IC0gYS5wcmlvcml0eTtcblx0fVxufVxuXG4oZnVuY3Rpb24gKCkge1xuXHQvKipcblx0ICogVGhlIHJ1bm5lcnMgc2NoZWR1bGVkIGF0IHRoZSBuZXh0IGFuaW1hdGlvbiBmcmFtZVxuXHQgKi9cblx0Y29uc3QgTkVYVF9RVUVVRSA9IG5ldyBNYXA8bnVtYmVyIC8qIHdpbmRvdyBJRCAqLywgQW5pbWF0aW9uRnJhbWVRdWV1ZUl0ZW1bXT4oKTtcblx0LyoqXG5cdCAqIFRoZSBydW5uZXJzIHNjaGVkdWxlZCBhdCB0aGUgY3VycmVudCBhbmltYXRpb24gZnJhbWVcblx0ICovXG5cdGNvbnN0IENVUlJFTlRfUVVFVUUgPSBuZXcgTWFwPG51bWJlciAvKiB3aW5kb3cgSUQgKi8sIEFuaW1hdGlvbkZyYW1lUXVldWVJdGVtW10+KCk7XG5cdC8qKlxuXHQgKiBBIGZsYWcgdG8ga2VlcCB0cmFjayBpZiB0aGUgbmF0aXZlIHJlcXVlc3RBbmltYXRpb25GcmFtZSB3YXMgYWxyZWFkeSBjYWxsZWRcblx0ICovXG5cdGNvbnN0IGFuaW1GcmFtZVJlcXVlc3RlZCA9IG5ldyBNYXA8bnVtYmVyIC8qIHdpbmRvdyBJRCAqLywgYm9vbGVhbj4oKTtcblx0LyoqXG5cdCAqIEEgZmxhZyB0byBpbmRpY2F0ZSBpZiBjdXJyZW50bHkgaGFuZGxpbmcgYSBuYXRpdmUgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrXG5cdCAqL1xuXHRjb25zdCBpbkFuaW1hdGlvbkZyYW1lUnVubmVyID0gbmV3IE1hcDxudW1iZXIgLyogd2luZG93IElEICovLCBib29sZWFuPigpO1xuXG5cdGNvbnN0IGFuaW1hdGlvbkZyYW1lUnVubmVyID0gKHRhcmdldFdpbmRvd0lkOiBudW1iZXIpID0+IHtcblx0XHRhbmltRnJhbWVSZXF1ZXN0ZWQuc2V0KHRhcmdldFdpbmRvd0lkLCBmYWxzZSk7XG5cblx0XHRjb25zdCBjdXJyZW50UXVldWUgPSBORVhUX1FVRVVFLmdldCh0YXJnZXRXaW5kb3dJZCkgPz8gW107XG5cdFx0Q1VSUkVOVF9RVUVVRS5zZXQodGFyZ2V0V2luZG93SWQsIGN1cnJlbnRRdWV1ZSk7XG5cdFx0TkVYVF9RVUVVRS5zZXQodGFyZ2V0V2luZG93SWQsIFtdKTtcblxuXHRcdGluQW5pbWF0aW9uRnJhbWVSdW5uZXIuc2V0KHRhcmdldFdpbmRvd0lkLCB0cnVlKTtcblx0XHR3aGlsZSAoY3VycmVudFF1ZXVlLmxlbmd0aCA+IDApIHtcblx0XHRcdGN1cnJlbnRRdWV1ZS5zb3J0KEFuaW1hdGlvbkZyYW1lUXVldWVJdGVtLnNvcnQpO1xuXHRcdFx0Y29uc3QgdG9wID0gY3VycmVudFF1ZXVlLnNoaWZ0KCkhO1xuXHRcdFx0dG9wLmV4ZWN1dGUoKTtcblx0XHR9XG5cdFx0aW5BbmltYXRpb25GcmFtZVJ1bm5lci5zZXQodGFyZ2V0V2luZG93SWQsIGZhbHNlKTtcblx0fTtcblxuXHRzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lID0gKHRhcmdldFdpbmRvdzogV2luZG93LCBydW5uZXI6ICgpID0+IHZvaWQsIHByaW9yaXR5OiBudW1iZXIgPSAwKSA9PiB7XG5cdFx0Y29uc3QgdGFyZ2V0V2luZG93SWQgPSBnZXRXaW5kb3dJZCh0YXJnZXRXaW5kb3cpO1xuXHRcdGNvbnN0IGl0ZW0gPSBuZXcgQW5pbWF0aW9uRnJhbWVRdWV1ZUl0ZW0ocnVubmVyLCBwcmlvcml0eSk7XG5cblx0XHRsZXQgbmV4dFF1ZXVlID0gTkVYVF9RVUVVRS5nZXQodGFyZ2V0V2luZG93SWQpO1xuXHRcdGlmICghbmV4dFF1ZXVlKSB7XG5cdFx0XHRuZXh0UXVldWUgPSBbXTtcblx0XHRcdE5FWFRfUVVFVUUuc2V0KHRhcmdldFdpbmRvd0lkLCBuZXh0UXVldWUpO1xuXHRcdH1cblx0XHRuZXh0UXVldWUucHVzaChpdGVtKTtcblxuXHRcdGlmICghYW5pbUZyYW1lUmVxdWVzdGVkLmdldCh0YXJnZXRXaW5kb3dJZCkpIHtcblx0XHRcdGFuaW1GcmFtZVJlcXVlc3RlZC5zZXQodGFyZ2V0V2luZG93SWQsIHRydWUpO1xuXHRcdFx0dGFyZ2V0V2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiBhbmltYXRpb25GcmFtZVJ1bm5lcih0YXJnZXRXaW5kb3dJZCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBpdGVtO1xuXHR9O1xuXG5cdHJ1bkF0VGhpc09yU2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZSA9ICh0YXJnZXRXaW5kb3c6IFdpbmRvdywgcnVubmVyOiAoKSA9PiB2b2lkLCBwcmlvcml0eT86IG51bWJlcikgPT4ge1xuXHRcdGNvbnN0IHRhcmdldFdpbmRvd0lkID0gZ2V0V2luZG93SWQodGFyZ2V0V2luZG93KTtcblx0XHRpZiAoaW5BbmltYXRpb25GcmFtZVJ1bm5lci5nZXQodGFyZ2V0V2luZG93SWQpKSB7XG5cdFx0XHRjb25zdCBpdGVtID0gbmV3IEFuaW1hdGlvbkZyYW1lUXVldWVJdGVtKHJ1bm5lciwgcHJpb3JpdHkpO1xuXHRcdFx0bGV0IGN1cnJlbnRRdWV1ZSA9IENVUlJFTlRfUVVFVUUuZ2V0KHRhcmdldFdpbmRvd0lkKTtcblx0XHRcdGlmICghY3VycmVudFF1ZXVlKSB7XG5cdFx0XHRcdGN1cnJlbnRRdWV1ZSA9IFtdO1xuXHRcdFx0XHRDVVJSRU5UX1FVRVVFLnNldCh0YXJnZXRXaW5kb3dJZCwgY3VycmVudFF1ZXVlKTtcblx0XHRcdH1cblx0XHRcdGN1cnJlbnRRdWV1ZS5wdXNoKGl0ZW0pO1xuXHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKHRhcmdldFdpbmRvdywgcnVubmVyLCBwcmlvcml0eSk7XG5cdFx0fVxuXHR9O1xufSkoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIG1lYXN1cmUodGFyZ2V0V2luZG93OiBXaW5kb3csIGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogSURpc3Bvc2FibGUge1xuXHRyZXR1cm4gc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZSh0YXJnZXRXaW5kb3csIGNhbGxiYWNrLCAxMDAwMCAvKiBtdXN0IGJlIGVhcmx5ICovKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1vZGlmeSh0YXJnZXRXaW5kb3c6IFdpbmRvdywgY2FsbGJhY2s6ICgpID0+IHZvaWQpOiBJRGlzcG9zYWJsZSB7XG5cdHJldHVybiBzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKHRhcmdldFdpbmRvdywgY2FsbGJhY2ssIC0xMDAwMCAvKiBtdXN0IGJlIGxhdGUgKi8pO1xufVxuXG4vKipcbiAqIEFkZCBhIHRocm90dGxlZCBsaXN0ZW5lci4gYGhhbmRsZXJgIGlzIGZpcmVkIGF0IG1vc3QgZXZlcnkgOC4zMzMzM21zIG9yIHdpdGggdGhlIG5leHQgYW5pbWF0aW9uIGZyYW1lIChpZiBicm93c2VyIHN1cHBvcnRzIGl0KS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRXZlbnRNZXJnZXI8UiwgRT4ge1xuXHQobGFzdEV2ZW50OiBSIHwgbnVsbCwgY3VycmVudEV2ZW50OiBFKTogUjtcbn1cblxuY29uc3QgTUlOSU1VTV9USU1FX01TID0gODtcbmNvbnN0IERFRkFVTFRfRVZFTlRfTUVSR0VSOiBJRXZlbnRNZXJnZXI8RXZlbnQsIEV2ZW50PiA9IGZ1bmN0aW9uIChsYXN0RXZlbnQ6IEV2ZW50IHwgbnVsbCwgY3VycmVudEV2ZW50OiBFdmVudCkge1xuXHRyZXR1cm4gY3VycmVudEV2ZW50O1xufTtcblxuY2xhc3MgVGltZW91dFRocm90dGxlZERvbUxpc3RlbmVyPFIsIEUgZXh0ZW5kcyBFdmVudD4gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRjb25zdHJ1Y3Rvcihub2RlOiBhbnksIHR5cGU6IHN0cmluZywgaGFuZGxlcjogKGV2ZW50OiBSKSA9PiB2b2lkLCBldmVudE1lcmdlcjogSUV2ZW50TWVyZ2VyPFIsIEU+ID0gPGFueT5ERUZBVUxUX0VWRU5UX01FUkdFUiwgbWluaW11bVRpbWVNczogbnVtYmVyID0gTUlOSU1VTV9USU1FX01TKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGxldCBsYXN0RXZlbnQ6IFIgfCBudWxsID0gbnVsbDtcblx0XHRsZXQgbGFzdEhhbmRsZXJUaW1lID0gMDtcblx0XHRjb25zdCB0aW1lb3V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRpbWVvdXRUaW1lcigpKTtcblxuXHRcdGNvbnN0IGludm9rZUhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRsYXN0SGFuZGxlclRpbWUgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpO1xuXHRcdFx0aGFuZGxlcig8Uj5sYXN0RXZlbnQpO1xuXHRcdFx0bGFzdEV2ZW50ID0gbnVsbDtcblx0XHR9O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKG5vZGUsIHR5cGUsIChlKSA9PiB7XG5cblx0XHRcdGxhc3RFdmVudCA9IGV2ZW50TWVyZ2VyKGxhc3RFdmVudCwgZSk7XG5cdFx0XHRjb25zdCBlbGFwc2VkVGltZSA9IChuZXcgRGF0ZSgpKS5nZXRUaW1lKCkgLSBsYXN0SGFuZGxlclRpbWU7XG5cblx0XHRcdGlmIChlbGFwc2VkVGltZSA+PSBtaW5pbXVtVGltZU1zKSB7XG5cdFx0XHRcdHRpbWVvdXQuY2FuY2VsKCk7XG5cdFx0XHRcdGludm9rZUhhbmRsZXIoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRpbWVvdXQuc2V0SWZOb3RTZXQoaW52b2tlSGFuZGxlciwgbWluaW11bVRpbWVNcyAtIGVsYXBzZWRUaW1lKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZERpc3Bvc2FibGVUaHJvdHRsZWRMaXN0ZW5lcjxSLCBFIGV4dGVuZHMgRXZlbnQgPSBFdmVudD4obm9kZTogYW55LCB0eXBlOiBzdHJpbmcsIGhhbmRsZXI6IChldmVudDogUikgPT4gdm9pZCwgZXZlbnRNZXJnZXI/OiBJRXZlbnRNZXJnZXI8UiwgRT4sIG1pbmltdW1UaW1lTXM/OiBudW1iZXIpOiBJRGlzcG9zYWJsZSB7XG5cdHJldHVybiBuZXcgVGltZW91dFRocm90dGxlZERvbUxpc3RlbmVyPFIsIEU+KG5vZGUsIHR5cGUsIGhhbmRsZXIsIGV2ZW50TWVyZ2VyLCBtaW5pbXVtVGltZU1zKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbXB1dGVkU3R5bGUoZWw6IEhUTUxFbGVtZW50KTogQ1NTU3R5bGVEZWNsYXJhdGlvbiB7XG5cdHJldHVybiBnZXRXaW5kb3coZWwpLmdldENvbXB1dGVkU3R5bGUoZWwsIG51bGwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2xpZW50QXJlYShlbGVtZW50OiBIVE1MRWxlbWVudCwgZGVmYXVsdFZhbHVlPzogRGltZW5zaW9uLCBmYWxsYmFja0VsZW1lbnQ/OiBIVE1MRWxlbWVudCk6IERpbWVuc2lvbiB7XG5cdGNvbnN0IGVsV2luZG93ID0gZ2V0V2luZG93KGVsZW1lbnQpO1xuXHRjb25zdCBlbERvY3VtZW50ID0gZWxXaW5kb3cuZG9jdW1lbnQ7XG5cblx0Ly8gVHJ5IHdpdGggRE9NIGNsaWVudFdpZHRoIC8gY2xpZW50SGVpZ2h0XG5cdGlmIChlbGVtZW50ICE9PSBlbERvY3VtZW50LmJvZHkpIHtcblx0XHRyZXR1cm4gbmV3IERpbWVuc2lvbihlbGVtZW50LmNsaWVudFdpZHRoLCBlbGVtZW50LmNsaWVudEhlaWdodCk7XG5cdH1cblxuXHQvLyBJZiB2aXN1YWwgdmlldyBwb3J0IGV4aXRzIGFuZCBpdCdzIG9uIG1vYmlsZSwgaXQgc2hvdWxkIGJlIHVzZWQgaW5zdGVhZCBvZiB3aW5kb3cgaW5uZXJXaWR0aCAvIGlubmVySGVpZ2h0LCBvciBkb2N1bWVudC5ib2R5LmNsaWVudFdpZHRoIC8gZG9jdW1lbnQuYm9keS5jbGllbnRIZWlnaHRcblx0aWYgKHBsYXRmb3JtLmlzSU9TICYmIGVsV2luZG93Py52aXN1YWxWaWV3cG9ydCkge1xuXHRcdHJldHVybiBuZXcgRGltZW5zaW9uKGVsV2luZG93LnZpc3VhbFZpZXdwb3J0LndpZHRoLCBlbFdpbmRvdy52aXN1YWxWaWV3cG9ydC5oZWlnaHQpO1xuXHR9XG5cblx0Ly8gVHJ5IGlubmVyV2lkdGggLyBpbm5lckhlaWdodFxuXHRpZiAoZWxXaW5kb3c/LmlubmVyV2lkdGggJiYgZWxXaW5kb3cuaW5uZXJIZWlnaHQpIHtcblx0XHRyZXR1cm4gbmV3IERpbWVuc2lvbihlbFdpbmRvdy5pbm5lcldpZHRoLCBlbFdpbmRvdy5pbm5lckhlaWdodCk7XG5cdH1cblxuXHQvLyBUcnkgd2l0aCBkb2N1bWVudC5ib2R5LmNsaWVudFdpZHRoIC8gZG9jdW1lbnQuYm9keS5jbGllbnRIZWlnaHRcblx0aWYgKGVsRG9jdW1lbnQuYm9keSAmJiBlbERvY3VtZW50LmJvZHkuY2xpZW50V2lkdGggJiYgZWxEb2N1bWVudC5ib2R5LmNsaWVudEhlaWdodCkge1xuXHRcdHJldHVybiBuZXcgRGltZW5zaW9uKGVsRG9jdW1lbnQuYm9keS5jbGllbnRXaWR0aCwgZWxEb2N1bWVudC5ib2R5LmNsaWVudEhlaWdodCk7XG5cdH1cblxuXHQvLyBUcnkgd2l0aCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggLyBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0XG5cdGlmIChlbERvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiBlbERvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCAmJiBlbERvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQpIHtcblx0XHRyZXR1cm4gbmV3IERpbWVuc2lvbihlbERvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCwgZWxEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0KTtcblx0fVxuXG5cdGlmIChmYWxsYmFja0VsZW1lbnQpIHtcblx0XHRyZXR1cm4gZ2V0Q2xpZW50QXJlYShmYWxsYmFja0VsZW1lbnQsIGRlZmF1bHRWYWx1ZSk7XG5cdH1cblxuXHRpZiAoZGVmYXVsdFZhbHVlKSB7XG5cdFx0cmV0dXJuIGRlZmF1bHRWYWx1ZTtcblx0fVxuXG5cdHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGZpZ3VyZSBvdXQgYnJvd3NlciB3aWR0aCBhbmQgaGVpZ2h0Jyk7XG59XG5cbmNsYXNzIFNpemVVdGlscyB7XG5cdC8vIEFkYXB0ZWQgZnJvbSBXaW5KU1xuXHQvLyBDb252ZXJ0cyBhIENTUyBwb3NpdGlvbmluZyBzdHJpbmcgZm9yIHRoZSBzcGVjaWZpZWQgZWxlbWVudCB0byBwaXhlbHMuXG5cdHByaXZhdGUgc3RhdGljIGNvbnZlcnRUb1BpeGVscyhlbGVtZW50OiBIVE1MRWxlbWVudCwgdmFsdWU6IHN0cmluZyk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHBhcnNlRmxvYXQodmFsdWUpIHx8IDA7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXREaW1lbnNpb24oZWxlbWVudDogSFRNTEVsZW1lbnQsIGNzc1Byb3BlcnR5TmFtZTogc3RyaW5nKTogbnVtYmVyIHtcblx0XHRjb25zdCBjb21wdXRlZFN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KTtcblx0XHRjb25zdCB2YWx1ZSA9IGNvbXB1dGVkU3R5bGUgPyBjb21wdXRlZFN0eWxlLmdldFByb3BlcnR5VmFsdWUoY3NzUHJvcGVydHlOYW1lKSA6ICcwJztcblx0XHRyZXR1cm4gU2l6ZVV0aWxzLmNvbnZlcnRUb1BpeGVscyhlbGVtZW50LCB2YWx1ZSk7XG5cdH1cblxuXHRzdGF0aWMgZ2V0Qm9yZGVyTGVmdFdpZHRoKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogbnVtYmVyIHtcblx0XHRyZXR1cm4gU2l6ZVV0aWxzLmdldERpbWVuc2lvbihlbGVtZW50LCAnYm9yZGVyLWxlZnQtd2lkdGgnKTtcblx0fVxuXHRzdGF0aWMgZ2V0Qm9yZGVyUmlnaHRXaWR0aChlbGVtZW50OiBIVE1MRWxlbWVudCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIFNpemVVdGlscy5nZXREaW1lbnNpb24oZWxlbWVudCwgJ2JvcmRlci1yaWdodC13aWR0aCcpO1xuXHR9XG5cdHN0YXRpYyBnZXRCb3JkZXJUb3BXaWR0aChlbGVtZW50OiBIVE1MRWxlbWVudCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIFNpemVVdGlscy5nZXREaW1lbnNpb24oZWxlbWVudCwgJ2JvcmRlci10b3Atd2lkdGgnKTtcblx0fVxuXHRzdGF0aWMgZ2V0Qm9yZGVyQm90dG9tV2lkdGgoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBudW1iZXIge1xuXHRcdHJldHVybiBTaXplVXRpbHMuZ2V0RGltZW5zaW9uKGVsZW1lbnQsICdib3JkZXItYm90dG9tLXdpZHRoJyk7XG5cdH1cblxuXHRzdGF0aWMgZ2V0UGFkZGluZ0xlZnQoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBudW1iZXIge1xuXHRcdHJldHVybiBTaXplVXRpbHMuZ2V0RGltZW5zaW9uKGVsZW1lbnQsICdwYWRkaW5nLWxlZnQnKTtcblx0fVxuXHRzdGF0aWMgZ2V0UGFkZGluZ1JpZ2h0KGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogbnVtYmVyIHtcblx0XHRyZXR1cm4gU2l6ZVV0aWxzLmdldERpbWVuc2lvbihlbGVtZW50LCAncGFkZGluZy1yaWdodCcpO1xuXHR9XG5cdHN0YXRpYyBnZXRQYWRkaW5nVG9wKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogbnVtYmVyIHtcblx0XHRyZXR1cm4gU2l6ZVV0aWxzLmdldERpbWVuc2lvbihlbGVtZW50LCAncGFkZGluZy10b3AnKTtcblx0fVxuXHRzdGF0aWMgZ2V0UGFkZGluZ0JvdHRvbShlbGVtZW50OiBIVE1MRWxlbWVudCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIFNpemVVdGlscy5nZXREaW1lbnNpb24oZWxlbWVudCwgJ3BhZGRpbmctYm90dG9tJyk7XG5cdH1cblxuXHRzdGF0aWMgZ2V0TWFyZ2luTGVmdChlbGVtZW50OiBIVE1MRWxlbWVudCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIFNpemVVdGlscy5nZXREaW1lbnNpb24oZWxlbWVudCwgJ21hcmdpbi1sZWZ0Jyk7XG5cdH1cblx0c3RhdGljIGdldE1hcmdpblRvcChlbGVtZW50OiBIVE1MRWxlbWVudCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIFNpemVVdGlscy5nZXREaW1lbnNpb24oZWxlbWVudCwgJ21hcmdpbi10b3AnKTtcblx0fVxuXHRzdGF0aWMgZ2V0TWFyZ2luUmlnaHQoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBudW1iZXIge1xuXHRcdHJldHVybiBTaXplVXRpbHMuZ2V0RGltZW5zaW9uKGVsZW1lbnQsICdtYXJnaW4tcmlnaHQnKTtcblx0fVxuXHRzdGF0aWMgZ2V0TWFyZ2luQm90dG9tKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogbnVtYmVyIHtcblx0XHRyZXR1cm4gU2l6ZVV0aWxzLmdldERpbWVuc2lvbihlbGVtZW50LCAnbWFyZ2luLWJvdHRvbScpO1xuXHR9XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFBvc2l0aW9uICYgRGltZW5zaW9uXG5cbmV4cG9ydCBpbnRlcmZhY2UgSURpbWVuc2lvbiB7XG5cdHJlYWRvbmx5IHdpZHRoOiBudW1iZXI7XG5cdHJlYWRvbmx5IGhlaWdodDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgRGltZW5zaW9uIGltcGxlbWVudHMgSURpbWVuc2lvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IE5vbmUgPSBuZXcgRGltZW5zaW9uKDAsIDApO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHdpZHRoOiBudW1iZXIsXG5cdFx0cmVhZG9ubHkgaGVpZ2h0OiBudW1iZXIsXG5cdCkgeyB9XG5cblx0d2l0aCh3aWR0aDogbnVtYmVyID0gdGhpcy53aWR0aCwgaGVpZ2h0OiBudW1iZXIgPSB0aGlzLmhlaWdodCk6IERpbWVuc2lvbiB7XG5cdFx0aWYgKHdpZHRoICE9PSB0aGlzLndpZHRoIHx8IGhlaWdodCAhPT0gdGhpcy5oZWlnaHQpIHtcblx0XHRcdHJldHVybiBuZXcgRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgaXMob2JqOiB1bmtub3duKTogb2JqIGlzIElEaW1lbnNpb24ge1xuXHRcdHJldHVybiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgKDxJRGltZW5zaW9uPm9iaikuaGVpZ2h0ID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgKDxJRGltZW5zaW9uPm9iaikud2lkdGggPT09ICdudW1iZXInO1xuXHR9XG5cblx0c3RhdGljIGxpZnQob2JqOiBJRGltZW5zaW9uKTogRGltZW5zaW9uIHtcblx0XHRpZiAob2JqIGluc3RhbmNlb2YgRGltZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gb2JqO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbmV3IERpbWVuc2lvbihvYmoud2lkdGgsIG9iai5oZWlnaHQpO1xuXHRcdH1cblx0fVxuXG5cdHN0YXRpYyBlcXVhbHMoYTogRGltZW5zaW9uIHwgdW5kZWZpbmVkLCBiOiBEaW1lbnNpb24gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRpZiAoYSA9PT0gYikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICghYSB8fCAhYikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gYS53aWR0aCA9PT0gYi53aWR0aCAmJiBhLmhlaWdodCA9PT0gYi5oZWlnaHQ7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRG9tUG9zaXRpb24ge1xuXHRyZWFkb25seSBsZWZ0OiBudW1iZXI7XG5cdHJlYWRvbmx5IHRvcDogbnVtYmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VG9wTGVmdE9mZnNldChlbGVtZW50OiBIVE1MRWxlbWVudCk6IElEb21Qb3NpdGlvbiB7XG5cdC8vIEFkYXB0ZWQgZnJvbSBXaW5KUy5VdGlsaXRpZXMuZ2V0UG9zaXRpb25cblx0Ly8gYW5kIGFkZGVkIGJvcmRlcnMgdG8gdGhlIG1peFxuXG5cdGxldCBvZmZzZXRQYXJlbnQgPSBlbGVtZW50Lm9mZnNldFBhcmVudDtcblx0bGV0IHRvcCA9IGVsZW1lbnQub2Zmc2V0VG9wO1xuXHRsZXQgbGVmdCA9IGVsZW1lbnQub2Zmc2V0TGVmdDtcblxuXHR3aGlsZSAoXG5cdFx0KGVsZW1lbnQgPSA8SFRNTEVsZW1lbnQ+ZWxlbWVudC5wYXJlbnROb2RlKSAhPT0gbnVsbFxuXHRcdCYmIGVsZW1lbnQgIT09IGVsZW1lbnQub3duZXJEb2N1bWVudC5ib2R5XG5cdFx0JiYgZWxlbWVudCAhPT0gZWxlbWVudC5vd25lckRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxuXHQpIHtcblx0XHR0b3AgLT0gZWxlbWVudC5zY3JvbGxUb3A7XG5cdFx0Y29uc3QgYyA9IGlzU2hhZG93Um9vdChlbGVtZW50KSA/IG51bGwgOiBnZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpO1xuXHRcdGlmIChjKSB7XG5cdFx0XHRsZWZ0IC09IGMuZGlyZWN0aW9uICE9PSAncnRsJyA/IGVsZW1lbnQuc2Nyb2xsTGVmdCA6IC1lbGVtZW50LnNjcm9sbExlZnQ7XG5cdFx0fVxuXG5cdFx0aWYgKGVsZW1lbnQgPT09IG9mZnNldFBhcmVudCkge1xuXHRcdFx0bGVmdCArPSBTaXplVXRpbHMuZ2V0Qm9yZGVyTGVmdFdpZHRoKGVsZW1lbnQpO1xuXHRcdFx0dG9wICs9IFNpemVVdGlscy5nZXRCb3JkZXJUb3BXaWR0aChlbGVtZW50KTtcblx0XHRcdHRvcCArPSBlbGVtZW50Lm9mZnNldFRvcDtcblx0XHRcdGxlZnQgKz0gZWxlbWVudC5vZmZzZXRMZWZ0O1xuXHRcdFx0b2Zmc2V0UGFyZW50ID0gZWxlbWVudC5vZmZzZXRQYXJlbnQ7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRsZWZ0OiBsZWZ0LFxuXHRcdHRvcDogdG9wXG5cdH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURvbU5vZGVQYWdlUG9zaXRpb24ge1xuXHRsZWZ0OiBudW1iZXI7XG5cdHRvcDogbnVtYmVyO1xuXHR3aWR0aDogbnVtYmVyO1xuXHRoZWlnaHQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpemUoZWxlbWVudDogSFRNTEVsZW1lbnQsIHdpZHRoOiBudW1iZXIgfCBudWxsLCBoZWlnaHQ6IG51bWJlciB8IG51bGwpOiB2b2lkIHtcblx0aWYgKHR5cGVvZiB3aWR0aCA9PT0gJ251bWJlcicpIHtcblx0XHRlbGVtZW50LnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuXHR9XG5cblx0aWYgKHR5cGVvZiBoZWlnaHQgPT09ICdudW1iZXInKSB7XG5cdFx0ZWxlbWVudC5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHR9cHhgO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwb3NpdGlvbihlbGVtZW50OiBIVE1MRWxlbWVudCwgdG9wOiBudW1iZXIsIHJpZ2h0PzogbnVtYmVyLCBib3R0b20/OiBudW1iZXIsIGxlZnQ/OiBudW1iZXIsIHBvc2l0aW9uOiBzdHJpbmcgPSAnYWJzb2x1dGUnKTogdm9pZCB7XG5cdGlmICh0eXBlb2YgdG9wID09PSAnbnVtYmVyJykge1xuXHRcdGVsZW1lbnQuc3R5bGUudG9wID0gYCR7dG9wfXB4YDtcblx0fVxuXG5cdGlmICh0eXBlb2YgcmlnaHQgPT09ICdudW1iZXInKSB7XG5cdFx0ZWxlbWVudC5zdHlsZS5yaWdodCA9IGAke3JpZ2h0fXB4YDtcblx0fVxuXG5cdGlmICh0eXBlb2YgYm90dG9tID09PSAnbnVtYmVyJykge1xuXHRcdGVsZW1lbnQuc3R5bGUuYm90dG9tID0gYCR7Ym90dG9tfXB4YDtcblx0fVxuXG5cdGlmICh0eXBlb2YgbGVmdCA9PT0gJ251bWJlcicpIHtcblx0XHRlbGVtZW50LnN0eWxlLmxlZnQgPSBgJHtsZWZ0fXB4YDtcblx0fVxuXG5cdGVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBwb3NpdGlvbjtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBwb3NpdGlvbiBvZiBhIGRvbSBub2RlIHJlbGF0aXZlIHRvIHRoZSBlbnRpcmUgcGFnZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldERvbU5vZGVQYWdlUG9zaXRpb24oZG9tTm9kZTogSFRNTEVsZW1lbnQpOiBJRG9tTm9kZVBhZ2VQb3NpdGlvbiB7XG5cdGNvbnN0IGJiID0gZG9tTm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0Y29uc3Qgd2luZG93ID0gZ2V0V2luZG93KGRvbU5vZGUpO1xuXHRyZXR1cm4ge1xuXHRcdGxlZnQ6IGJiLmxlZnQgKyB3aW5kb3cuc2Nyb2xsWCxcblx0XHR0b3A6IGJiLnRvcCArIHdpbmRvdy5zY3JvbGxZLFxuXHRcdHdpZHRoOiBiYi53aWR0aCxcblx0XHRoZWlnaHQ6IGJiLmhlaWdodFxuXHR9O1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGVmZmVjdGl2ZSB6b29tIG9uIGEgZ2l2ZW4gZWxlbWVudCBiZWZvcmUgd2luZG93IHpvb20gbGV2ZWwgaXMgYXBwbGllZFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RG9tTm9kZVpvb21MZXZlbChkb21Ob2RlOiBIVE1MRWxlbWVudCk6IG51bWJlciB7XG5cdGxldCB0ZXN0RWxlbWVudDogSFRNTEVsZW1lbnQgfCBudWxsID0gZG9tTm9kZTtcblx0bGV0IHpvb20gPSAxLjA7XG5cdGRvIHtcblx0XHRjb25zdCBlbGVtZW50Wm9vbUxldmVsID0gKGdldENvbXB1dGVkU3R5bGUodGVzdEVsZW1lbnQpIGFzIGFueSkuem9vbTtcblx0XHRpZiAoZWxlbWVudFpvb21MZXZlbCAhPT0gbnVsbCAmJiBlbGVtZW50Wm9vbUxldmVsICE9PSB1bmRlZmluZWQgJiYgZWxlbWVudFpvb21MZXZlbCAhPT0gJzEnKSB7XG5cdFx0XHR6b29tICo9IGVsZW1lbnRab29tTGV2ZWw7XG5cdFx0fVxuXG5cdFx0dGVzdEVsZW1lbnQgPSB0ZXN0RWxlbWVudC5wYXJlbnRFbGVtZW50O1xuXHR9IHdoaWxlICh0ZXN0RWxlbWVudCAhPT0gbnVsbCAmJiB0ZXN0RWxlbWVudCAhPT0gdGVzdEVsZW1lbnQub3duZXJEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpO1xuXG5cdHJldHVybiB6b29tO1xufVxuXG5cbi8vIEFkYXB0ZWQgZnJvbSBXaW5KU1xuLy8gR2V0cyB0aGUgd2lkdGggb2YgdGhlIGVsZW1lbnQsIGluY2x1ZGluZyBtYXJnaW5zLlxuZXhwb3J0IGZ1bmN0aW9uIGdldFRvdGFsV2lkdGgoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBudW1iZXIge1xuXHRjb25zdCBtYXJnaW4gPSBTaXplVXRpbHMuZ2V0TWFyZ2luTGVmdChlbGVtZW50KSArIFNpemVVdGlscy5nZXRNYXJnaW5SaWdodChlbGVtZW50KTtcblx0cmV0dXJuIGVsZW1lbnQub2Zmc2V0V2lkdGggKyBtYXJnaW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb250ZW50V2lkdGgoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBudW1iZXIge1xuXHRjb25zdCBib3JkZXIgPSBTaXplVXRpbHMuZ2V0Qm9yZGVyTGVmdFdpZHRoKGVsZW1lbnQpICsgU2l6ZVV0aWxzLmdldEJvcmRlclJpZ2h0V2lkdGgoZWxlbWVudCk7XG5cdGNvbnN0IHBhZGRpbmcgPSBTaXplVXRpbHMuZ2V0UGFkZGluZ0xlZnQoZWxlbWVudCkgKyBTaXplVXRpbHMuZ2V0UGFkZGluZ1JpZ2h0KGVsZW1lbnQpO1xuXHRyZXR1cm4gZWxlbWVudC5vZmZzZXRXaWR0aCAtIGJvcmRlciAtIHBhZGRpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUb3RhbFNjcm9sbFdpZHRoKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogbnVtYmVyIHtcblx0Y29uc3QgbWFyZ2luID0gU2l6ZVV0aWxzLmdldE1hcmdpbkxlZnQoZWxlbWVudCkgKyBTaXplVXRpbHMuZ2V0TWFyZ2luUmlnaHQoZWxlbWVudCk7XG5cdHJldHVybiBlbGVtZW50LnNjcm9sbFdpZHRoICsgbWFyZ2luO1xufVxuXG4vLyBBZGFwdGVkIGZyb20gV2luSlNcbi8vIEdldHMgdGhlIGhlaWdodCBvZiB0aGUgY29udGVudCBvZiB0aGUgc3BlY2lmaWVkIGVsZW1lbnQuIFRoZSBjb250ZW50IGhlaWdodCBkb2VzIG5vdCBpbmNsdWRlIGJvcmRlcnMgb3IgcGFkZGluZy5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb250ZW50SGVpZ2h0KGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogbnVtYmVyIHtcblx0Y29uc3QgYm9yZGVyID0gU2l6ZVV0aWxzLmdldEJvcmRlclRvcFdpZHRoKGVsZW1lbnQpICsgU2l6ZVV0aWxzLmdldEJvcmRlckJvdHRvbVdpZHRoKGVsZW1lbnQpO1xuXHRjb25zdCBwYWRkaW5nID0gU2l6ZVV0aWxzLmdldFBhZGRpbmdUb3AoZWxlbWVudCkgKyBTaXplVXRpbHMuZ2V0UGFkZGluZ0JvdHRvbShlbGVtZW50KTtcblx0cmV0dXJuIGVsZW1lbnQub2Zmc2V0SGVpZ2h0IC0gYm9yZGVyIC0gcGFkZGluZztcbn1cblxuLy8gQWRhcHRlZCBmcm9tIFdpbkpTXG4vLyBHZXRzIHRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQsIGluY2x1ZGluZyBpdHMgbWFyZ2lucy5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUb3RhbEhlaWdodChlbGVtZW50OiBIVE1MRWxlbWVudCk6IG51bWJlciB7XG5cdGNvbnN0IG1hcmdpbiA9IFNpemVVdGlscy5nZXRNYXJnaW5Ub3AoZWxlbWVudCkgKyBTaXplVXRpbHMuZ2V0TWFyZ2luQm90dG9tKGVsZW1lbnQpO1xuXHRyZXR1cm4gZWxlbWVudC5vZmZzZXRIZWlnaHQgKyBtYXJnaW47XG59XG5cbi8vIEdldHMgdGhlIGxlZnQgY29vcmRpbmF0ZSBvZiB0aGUgc3BlY2lmaWVkIGVsZW1lbnQgcmVsYXRpdmUgdG8gdGhlIHNwZWNpZmllZCBwYXJlbnQuXG5mdW5jdGlvbiBnZXRSZWxhdGl2ZUxlZnQoZWxlbWVudDogSFRNTEVsZW1lbnQsIHBhcmVudDogSFRNTEVsZW1lbnQpOiBudW1iZXIge1xuXHRpZiAoZWxlbWVudCA9PT0gbnVsbCkge1xuXHRcdHJldHVybiAwO1xuXHR9XG5cblx0Y29uc3QgZWxlbWVudFBvc2l0aW9uID0gZ2V0VG9wTGVmdE9mZnNldChlbGVtZW50KTtcblx0Y29uc3QgcGFyZW50UG9zaXRpb24gPSBnZXRUb3BMZWZ0T2Zmc2V0KHBhcmVudCk7XG5cdHJldHVybiBlbGVtZW50UG9zaXRpb24ubGVmdCAtIHBhcmVudFBvc2l0aW9uLmxlZnQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMYXJnZXN0Q2hpbGRXaWR0aChwYXJlbnQ6IEhUTUxFbGVtZW50LCBjaGlsZHJlbjogSFRNTEVsZW1lbnRbXSk6IG51bWJlciB7XG5cdGNvbnN0IGNoaWxkV2lkdGhzID0gY2hpbGRyZW4ubWFwKChjaGlsZCkgPT4ge1xuXHRcdHJldHVybiBNYXRoLm1heChnZXRUb3RhbFNjcm9sbFdpZHRoKGNoaWxkKSwgZ2V0VG90YWxXaWR0aChjaGlsZCkpICsgZ2V0UmVsYXRpdmVMZWZ0KGNoaWxkLCBwYXJlbnQpIHx8IDA7XG5cdH0pO1xuXHRjb25zdCBtYXhXaWR0aCA9IE1hdGgubWF4KC4uLmNoaWxkV2lkdGhzKTtcblx0cmV0dXJuIG1heFdpZHRoO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FuY2VzdG9yKHRlc3RDaGlsZDogTm9kZSB8IG51bGwsIHRlc3RBbmNlc3RvcjogTm9kZSB8IG51bGwpOiBib29sZWFuIHtcblx0cmV0dXJuIEJvb2xlYW4odGVzdEFuY2VzdG9yPy5jb250YWlucyh0ZXN0Q2hpbGQpKTtcbn1cblxuY29uc3QgcGFyZW50Rmxvd1RvRGF0YUtleSA9ICdwYXJlbnRGbG93VG9FbGVtZW50SWQnO1xuXG4vKipcbiAqIFNldCBhbiBleHBsaWNpdCBwYXJlbnQgdG8gdXNlIGZvciBub2RlcyB0aGF0IGFyZSBub3QgcGFydCBvZiB0aGVcbiAqIHJlZ3VsYXIgZG9tIHN0cnVjdHVyZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldFBhcmVudEZsb3dUbyhmcm9tQ2hpbGRFbGVtZW50OiBIVE1MRWxlbWVudCwgdG9QYXJlbnRFbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XG5cdGZyb21DaGlsZEVsZW1lbnQuZGF0YXNldFtwYXJlbnRGbG93VG9EYXRhS2V5XSA9IHRvUGFyZW50RWxlbWVudC5pZDtcbn1cblxuZnVuY3Rpb24gZ2V0UGFyZW50Rmxvd1RvRWxlbWVudChub2RlOiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG5cdGNvbnN0IGZsb3dUb1BhcmVudElkID0gbm9kZS5kYXRhc2V0W3BhcmVudEZsb3dUb0RhdGFLZXldO1xuXHRpZiAodHlwZW9mIGZsb3dUb1BhcmVudElkID09PSAnc3RyaW5nJykge1xuXHRcdHJldHVybiBub2RlLm93bmVyRG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZmxvd1RvUGFyZW50SWQpO1xuXHR9XG5cdHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGB0ZXN0QW5jZXN0b3JgIGlzIGFuIGFuY2VzdG9yIG9mIGB0ZXN0Q2hpbGRgLCBvYnNlcnZpbmcgdGhlIGV4cGxpY2l0XG4gKiBwYXJlbnRzIHNldCBieSBgc2V0UGFyZW50Rmxvd1RvYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQW5jZXN0b3JVc2luZ0Zsb3dUbyh0ZXN0Q2hpbGQ6IE5vZGUsIHRlc3RBbmNlc3RvcjogTm9kZSk6IGJvb2xlYW4ge1xuXHRsZXQgbm9kZTogTm9kZSB8IG51bGwgPSB0ZXN0Q2hpbGQ7XG5cdHdoaWxlIChub2RlKSB7XG5cdFx0aWYgKG5vZGUgPT09IHRlc3RBbmNlc3Rvcikge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKGlzSFRNTEVsZW1lbnQobm9kZSkpIHtcblx0XHRcdGNvbnN0IGZsb3dUb1BhcmVudEVsZW1lbnQgPSBnZXRQYXJlbnRGbG93VG9FbGVtZW50KG5vZGUpO1xuXHRcdFx0aWYgKGZsb3dUb1BhcmVudEVsZW1lbnQpIHtcblx0XHRcdFx0bm9kZSA9IGZsb3dUb1BhcmVudEVsZW1lbnQ7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRub2RlID0gbm9kZS5wYXJlbnROb2RlO1xuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmluZFBhcmVudFdpdGhDbGFzcyhub2RlOiBIVE1MRWxlbWVudCwgY2xheno6IHN0cmluZywgc3RvcEF0Q2xhenpPck5vZGU/OiBzdHJpbmcgfCBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG5cdHdoaWxlIChub2RlICYmIG5vZGUubm9kZVR5cGUgPT09IG5vZGUuRUxFTUVOVF9OT0RFKSB7XG5cdFx0aWYgKG5vZGUuY2xhc3NMaXN0LmNvbnRhaW5zKGNsYXp6KSkge1xuXHRcdFx0cmV0dXJuIG5vZGU7XG5cdFx0fVxuXG5cdFx0aWYgKHN0b3BBdENsYXp6T3JOb2RlKSB7XG5cdFx0XHRpZiAodHlwZW9mIHN0b3BBdENsYXp6T3JOb2RlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRpZiAobm9kZS5jbGFzc0xpc3QuY29udGFpbnMoc3RvcEF0Q2xhenpPck5vZGUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChub2RlID09PSBzdG9wQXRDbGF6ek9yTm9kZSkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bm9kZSA9IDxIVE1MRWxlbWVudD5ub2RlLnBhcmVudE5vZGU7XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc1BhcmVudFdpdGhDbGFzcyhub2RlOiBIVE1MRWxlbWVudCwgY2xheno6IHN0cmluZywgc3RvcEF0Q2xhenpPck5vZGU/OiBzdHJpbmcgfCBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gISFmaW5kUGFyZW50V2l0aENsYXNzKG5vZGUsIGNsYXp6LCBzdG9wQXRDbGF6ek9yTm9kZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1NoYWRvd1Jvb3Qobm9kZTogTm9kZSk6IG5vZGUgaXMgU2hhZG93Um9vdCB7XG5cdHJldHVybiAoXG5cdFx0bm9kZSAmJiAhISg8U2hhZG93Um9vdD5ub2RlKS5ob3N0ICYmICEhKDxTaGFkb3dSb290Pm5vZGUpLm1vZGVcblx0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5TaGFkb3dET00oZG9tTm9kZTogTm9kZSk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gISFnZXRTaGFkb3dSb290KGRvbU5vZGUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2hhZG93Um9vdChkb21Ob2RlOiBOb2RlKTogU2hhZG93Um9vdCB8IG51bGwge1xuXHR3aGlsZSAoZG9tTm9kZS5wYXJlbnROb2RlKSB7XG5cdFx0aWYgKGRvbU5vZGUgPT09IGRvbU5vZGUub3duZXJEb2N1bWVudD8uYm9keSkge1xuXHRcdFx0Ly8gcmVhY2hlZCB0aGUgYm9keVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGRvbU5vZGUgPSBkb21Ob2RlLnBhcmVudE5vZGU7XG5cdH1cblx0cmV0dXJuIGlzU2hhZG93Um9vdChkb21Ob2RlKSA/IGRvbU5vZGUgOiBudWxsO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGFjdGl2ZSBlbGVtZW50IGFjcm9zcyBhbGwgY2hpbGQgd2luZG93c1xuICogYmFzZWQgb24gZG9jdW1lbnQgZm9jdXMuIEZhbGxzIGJhY2sgdG8gdGhlIG1haW5cbiAqIHdpbmRvdyBpZiBubyB3aW5kb3cgaGFzIGZvY3VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QWN0aXZlRWxlbWVudCgpOiBFbGVtZW50IHwgbnVsbCB7XG5cdGxldCByZXN1bHQgPSBnZXRBY3RpdmVEb2N1bWVudCgpLmFjdGl2ZUVsZW1lbnQ7XG5cblx0d2hpbGUgKHJlc3VsdD8uc2hhZG93Um9vdCkge1xuXHRcdHJlc3VsdCA9IHJlc3VsdC5zaGFkb3dSb290LmFjdGl2ZUVsZW1lbnQ7XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZm9jdXNlZCB3aW5kb3cgYWN0aXZlIGVsZW1lbnQgbWF0Y2hlc1xuICogdGhlIHByb3ZpZGVkIGVsZW1lbnQuIEZhbGxzIGJhY2sgdG8gdGhlIG1haW4gd2luZG93IGlmIG5vXG4gKiB3aW5kb3cgaGFzIGZvY3VzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNBY3RpdmVFbGVtZW50KGVsZW1lbnQ6IEVsZW1lbnQpOiBib29sZWFuIHtcblx0cmV0dXJuIGdldEFjdGl2ZUVsZW1lbnQoKSA9PT0gZWxlbWVudDtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIGZvY3VzZWQgd2luZG93IGFjdGl2ZSBlbGVtZW50IGlzIGNvbnRhaW5lZCBpblxuICogYGFuY2VzdG9yYC4gRmFsbHMgYmFjayB0byB0aGUgbWFpbiB3aW5kb3cgaWYgbm8gd2luZG93IGhhcyBmb2N1cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQoYW5jZXN0b3I6IEVsZW1lbnQpOiBib29sZWFuIHtcblx0cmV0dXJuIGlzQW5jZXN0b3IoZ2V0QWN0aXZlRWxlbWVudCgpLCBhbmNlc3Rvcik7XG59XG5cbi8qKlxuICogUmV0dXJucyB3aGV0aGVyIHRoZSBlbGVtZW50IGlzIGluIHRoZSBhY3RpdmUgYGRvY3VtZW50YC4gVGhlIGFjdGl2ZVxuICogZG9jdW1lbnQgaGFzIGZvY3VzIG9yIHdpbGwgYmUgdGhlIG1haW4gd2luZG93cyBkb2N1bWVudC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQWN0aXZlRG9jdW1lbnQoZWxlbWVudDogRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gZWxlbWVudC5vd25lckRvY3VtZW50ID09PSBnZXRBY3RpdmVEb2N1bWVudCgpO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGFjdGl2ZSBkb2N1bWVudCBhY3Jvc3MgbWFpbiBhbmQgY2hpbGQgd2luZG93cy5cbiAqIFByZWZlcnMgdGhlIHdpbmRvdyB3aXRoIGZvY3VzLCBvdGhlcndpc2UgZmFsbHMgYmFjayB0b1xuICogdGhlIG1haW4gd2luZG93cyBkb2N1bWVudC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEFjdGl2ZURvY3VtZW50KCk6IERvY3VtZW50IHtcblx0aWYgKGdldFdpbmRvd3NDb3VudCgpIDw9IDEpIHtcblx0XHRyZXR1cm4gbWFpbldpbmRvdy5kb2N1bWVudDtcblx0fVxuXG5cdGNvbnN0IGRvY3VtZW50cyA9IEFycmF5LmZyb20oZ2V0V2luZG93cygpKS5tYXAoKHsgd2luZG93IH0pID0+IHdpbmRvdy5kb2N1bWVudCk7XG5cdHJldHVybiBkb2N1bWVudHMuZmluZChkb2MgPT4gZG9jLmhhc0ZvY3VzKCkpID8/IG1haW5XaW5kb3cuZG9jdW1lbnQ7XG59XG5cbi8qKlxuICogUmV0dXJucyB0aGUgYWN0aXZlIHdpbmRvdyBhY3Jvc3MgbWFpbiBhbmQgY2hpbGQgd2luZG93cy5cbiAqIFByZWZlcnMgdGhlIHdpbmRvdyB3aXRoIGZvY3VzLCBvdGhlcndpc2UgZmFsbHMgYmFjayB0b1xuICogdGhlIG1haW4gd2luZG93LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QWN0aXZlV2luZG93KCk6IENvZGVXaW5kb3cge1xuXHRjb25zdCBkb2N1bWVudCA9IGdldEFjdGl2ZURvY3VtZW50KCk7XG5cdHJldHVybiAoZG9jdW1lbnQuZGVmYXVsdFZpZXc/LndpbmRvdyA/PyBtYWluV2luZG93KSBhcyBDb2RlV2luZG93O1xufVxuXG5pbnRlcmZhY2UgSU11dGF0aW9uT2JzZXJ2ZXIge1xuXHR1c2VyczogbnVtYmVyO1xuXHRyZWFkb25seSBvYnNlcnZlcjogTXV0YXRpb25PYnNlcnZlcjtcblx0cmVhZG9ubHkgb25EaWRNdXRhdGU6IGV2ZW50LkV2ZW50PE11dGF0aW9uUmVjb3JkW10+O1xufVxuXG5leHBvcnQgY29uc3Qgc2hhcmVkTXV0YXRpb25PYnNlcnZlciA9IG5ldyBjbGFzcyB7XG5cblx0cmVhZG9ubHkgbXV0YXRpb25PYnNlcnZlcnMgPSBuZXcgTWFwPE5vZGUsIE1hcDxudW1iZXIsIElNdXRhdGlvbk9ic2VydmVyPj4oKTtcblxuXHRvYnNlcnZlKHRhcmdldDogTm9kZSwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSwgb3B0aW9ucz86IE11dGF0aW9uT2JzZXJ2ZXJJbml0KTogZXZlbnQuRXZlbnQ8TXV0YXRpb25SZWNvcmRbXT4ge1xuXHRcdGxldCBtdXRhdGlvbk9ic2VydmVyc1BlclRhcmdldCA9IHRoaXMubXV0YXRpb25PYnNlcnZlcnMuZ2V0KHRhcmdldCk7XG5cdFx0aWYgKCFtdXRhdGlvbk9ic2VydmVyc1BlclRhcmdldCkge1xuXHRcdFx0bXV0YXRpb25PYnNlcnZlcnNQZXJUYXJnZXQgPSBuZXcgTWFwPG51bWJlciwgSU11dGF0aW9uT2JzZXJ2ZXI+KCk7XG5cdFx0XHR0aGlzLm11dGF0aW9uT2JzZXJ2ZXJzLnNldCh0YXJnZXQsIG11dGF0aW9uT2JzZXJ2ZXJzUGVyVGFyZ2V0KTtcblx0XHR9XG5cblx0XHRjb25zdCBvcHRpb25zSGFzaCA9IGhhc2gob3B0aW9ucyk7XG5cdFx0bGV0IG11dGF0aW9uT2JzZXJ2ZXJQZXJPcHRpb25zID0gbXV0YXRpb25PYnNlcnZlcnNQZXJUYXJnZXQuZ2V0KG9wdGlvbnNIYXNoKTtcblx0XHRpZiAoIW11dGF0aW9uT2JzZXJ2ZXJQZXJPcHRpb25zKSB7XG5cdFx0XHRjb25zdCBvbkRpZE11dGF0ZSA9IG5ldyBldmVudC5FbWl0dGVyPE11dGF0aW9uUmVjb3JkW10+KCk7XG5cdFx0XHRjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKG11dGF0aW9ucyA9PiBvbkRpZE11dGF0ZS5maXJlKG11dGF0aW9ucykpO1xuXHRcdFx0b2JzZXJ2ZXIub2JzZXJ2ZSh0YXJnZXQsIG9wdGlvbnMpO1xuXG5cdFx0XHRjb25zdCByZXNvbHZlZE11dGF0aW9uT2JzZXJ2ZXJQZXJPcHRpb25zID0gbXV0YXRpb25PYnNlcnZlclBlck9wdGlvbnMgPSB7XG5cdFx0XHRcdHVzZXJzOiAxLFxuXHRcdFx0XHRvYnNlcnZlcixcblx0XHRcdFx0b25EaWRNdXRhdGU6IG9uRGlkTXV0YXRlLmV2ZW50XG5cdFx0XHR9O1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZWRNdXRhdGlvbk9ic2VydmVyUGVyT3B0aW9ucy51c2VycyAtPSAxO1xuXG5cdFx0XHRcdGlmIChyZXNvbHZlZE11dGF0aW9uT2JzZXJ2ZXJQZXJPcHRpb25zLnVzZXJzID09PSAwKSB7XG5cdFx0XHRcdFx0b25EaWRNdXRhdGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcblxuXHRcdFx0XHRcdG11dGF0aW9uT2JzZXJ2ZXJzUGVyVGFyZ2V0Py5kZWxldGUob3B0aW9uc0hhc2gpO1xuXHRcdFx0XHRcdGlmIChtdXRhdGlvbk9ic2VydmVyc1BlclRhcmdldD8uc2l6ZSA9PT0gMCkge1xuXHRcdFx0XHRcdFx0dGhpcy5tdXRhdGlvbk9ic2VydmVycy5kZWxldGUodGFyZ2V0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0bXV0YXRpb25PYnNlcnZlcnNQZXJUYXJnZXQuc2V0KG9wdGlvbnNIYXNoLCBtdXRhdGlvbk9ic2VydmVyUGVyT3B0aW9ucyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG11dGF0aW9uT2JzZXJ2ZXJQZXJPcHRpb25zLnVzZXJzICs9IDE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG11dGF0aW9uT2JzZXJ2ZXJQZXJPcHRpb25zLm9uRGlkTXV0YXRlO1xuXHR9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWV0YUVsZW1lbnQoY29udGFpbmVyOiBIVE1MRWxlbWVudCA9IG1haW5XaW5kb3cuZG9jdW1lbnQuaGVhZCk6IEhUTUxNZXRhRWxlbWVudCB7XG5cdHJldHVybiBjcmVhdGVIZWFkRWxlbWVudCgnbWV0YScsIGNvbnRhaW5lcikgYXMgSFRNTE1ldGFFbGVtZW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGlua0VsZW1lbnQoY29udGFpbmVyOiBIVE1MRWxlbWVudCA9IG1haW5XaW5kb3cuZG9jdW1lbnQuaGVhZCk6IEhUTUxMaW5rRWxlbWVudCB7XG5cdHJldHVybiBjcmVhdGVIZWFkRWxlbWVudCgnbGluaycsIGNvbnRhaW5lcikgYXMgSFRNTExpbmtFbGVtZW50O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVIZWFkRWxlbWVudCh0YWdOYW1lOiBzdHJpbmcsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgPSBtYWluV2luZG93LmRvY3VtZW50LmhlYWQpOiBIVE1MRWxlbWVudCB7XG5cdGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xuXHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XG5cdHJldHVybiBlbGVtZW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNIVE1MRWxlbWVudChlOiB1bmtub3duKTogZSBpcyBIVE1MRWxlbWVudCB7XG5cdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXN0cmljdGVkLXN5bnRheFxuXHRyZXR1cm4gZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50IHx8IGUgaW5zdGFuY2VvZiBnZXRXaW5kb3coZSBhcyBOb2RlKS5IVE1MRWxlbWVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSFRNTEFuY2hvckVsZW1lbnQoZTogdW5rbm93bik6IGUgaXMgSFRNTEFuY2hvckVsZW1lbnQge1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcblx0cmV0dXJuIGUgaW5zdGFuY2VvZiBIVE1MQW5jaG9yRWxlbWVudCB8fCBlIGluc3RhbmNlb2YgZ2V0V2luZG93KGUgYXMgTm9kZSkuSFRNTEFuY2hvckVsZW1lbnQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0hUTUxTcGFuRWxlbWVudChlOiB1bmtub3duKTogZSBpcyBIVE1MU3BhbkVsZW1lbnQge1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcblx0cmV0dXJuIGUgaW5zdGFuY2VvZiBIVE1MU3BhbkVsZW1lbnQgfHwgZSBpbnN0YW5jZW9mIGdldFdpbmRvdyhlIGFzIE5vZGUpLkhUTUxTcGFuRWxlbWVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSFRNTFRleHRBcmVhRWxlbWVudChlOiB1bmtub3duKTogZSBpcyBIVE1MVGV4dEFyZWFFbGVtZW50IHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXJlc3RyaWN0ZWQtc3ludGF4XG5cdHJldHVybiBlIGluc3RhbmNlb2YgSFRNTFRleHRBcmVhRWxlbWVudCB8fCBlIGluc3RhbmNlb2YgZ2V0V2luZG93KGUgYXMgTm9kZSkuSFRNTFRleHRBcmVhRWxlbWVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSFRNTElucHV0RWxlbWVudChlOiB1bmtub3duKTogZSBpcyBIVE1MSW5wdXRFbGVtZW50IHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXJlc3RyaWN0ZWQtc3ludGF4XG5cdHJldHVybiBlIGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCB8fCBlIGluc3RhbmNlb2YgZ2V0V2luZG93KGUgYXMgTm9kZSkuSFRNTElucHV0RWxlbWVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSFRNTEJ1dHRvbkVsZW1lbnQoZTogdW5rbm93bik6IGUgaXMgSFRNTEJ1dHRvbkVsZW1lbnQge1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcblx0cmV0dXJuIGUgaW5zdGFuY2VvZiBIVE1MQnV0dG9uRWxlbWVudCB8fCBlIGluc3RhbmNlb2YgZ2V0V2luZG93KGUgYXMgTm9kZSkuSFRNTEJ1dHRvbkVsZW1lbnQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0hUTUxEaXZFbGVtZW50KGU6IHVua25vd24pOiBlIGlzIEhUTUxEaXZFbGVtZW50IHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXJlc3RyaWN0ZWQtc3ludGF4XG5cdHJldHVybiBlIGluc3RhbmNlb2YgSFRNTERpdkVsZW1lbnQgfHwgZSBpbnN0YW5jZW9mIGdldFdpbmRvdyhlIGFzIE5vZGUpLkhUTUxEaXZFbGVtZW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTVkdFbGVtZW50KGU6IHVua25vd24pOiBlIGlzIFNWR0VsZW1lbnQge1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcblx0cmV0dXJuIGUgaW5zdGFuY2VvZiBTVkdFbGVtZW50IHx8IGUgaW5zdGFuY2VvZiBnZXRXaW5kb3coZSBhcyBOb2RlKS5TVkdFbGVtZW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNNb3VzZUV2ZW50KGU6IHVua25vd24pOiBlIGlzIE1vdXNlRXZlbnQge1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcblx0cmV0dXJuIGUgaW5zdGFuY2VvZiBNb3VzZUV2ZW50IHx8IGUgaW5zdGFuY2VvZiBnZXRXaW5kb3coZSBhcyBVSUV2ZW50KS5Nb3VzZUV2ZW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNLZXlib2FyZEV2ZW50KGU6IHVua25vd24pOiBlIGlzIEtleWJvYXJkRXZlbnQge1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcblx0cmV0dXJuIGUgaW5zdGFuY2VvZiBLZXlib2FyZEV2ZW50IHx8IGUgaW5zdGFuY2VvZiBnZXRXaW5kb3coZSBhcyBVSUV2ZW50KS5LZXlib2FyZEV2ZW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQb2ludGVyRXZlbnQoZTogdW5rbm93bik6IGUgaXMgUG9pbnRlckV2ZW50IHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXJlc3RyaWN0ZWQtc3ludGF4XG5cdHJldHVybiBlIGluc3RhbmNlb2YgUG9pbnRlckV2ZW50IHx8IGUgaW5zdGFuY2VvZiBnZXRXaW5kb3coZSBhcyBVSUV2ZW50KS5Qb2ludGVyRXZlbnQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RyYWdFdmVudChlOiB1bmtub3duKTogZSBpcyBEcmFnRXZlbnQge1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcblx0cmV0dXJuIGUgaW5zdGFuY2VvZiBEcmFnRXZlbnQgfHwgZSBpbnN0YW5jZW9mIGdldFdpbmRvdyhlIGFzIFVJRXZlbnQpLkRyYWdFdmVudDtcbn1cblxuZXhwb3J0IGNvbnN0IEV2ZW50VHlwZSA9IHtcblx0Ly8gTW91c2Vcblx0Q0xJQ0s6ICdjbGljaycsXG5cdEFVWENMSUNLOiAnYXV4Y2xpY2snLFxuXHREQkxDTElDSzogJ2RibGNsaWNrJyxcblx0TU9VU0VfVVA6ICdtb3VzZXVwJyxcblx0TU9VU0VfRE9XTjogJ21vdXNlZG93bicsXG5cdE1PVVNFX09WRVI6ICdtb3VzZW92ZXInLFxuXHRNT1VTRV9NT1ZFOiAnbW91c2Vtb3ZlJyxcblx0TU9VU0VfT1VUOiAnbW91c2VvdXQnLFxuXHRNT1VTRV9FTlRFUjogJ21vdXNlZW50ZXInLFxuXHRNT1VTRV9MRUFWRTogJ21vdXNlbGVhdmUnLFxuXHRNT1VTRV9XSEVFTDogJ3doZWVsJyxcblx0UE9JTlRFUl9VUDogJ3BvaW50ZXJ1cCcsXG5cdFBPSU5URVJfRE9XTjogJ3BvaW50ZXJkb3duJyxcblx0UE9JTlRFUl9NT1ZFOiAncG9pbnRlcm1vdmUnLFxuXHRQT0lOVEVSX0xFQVZFOiAncG9pbnRlcmxlYXZlJyxcblx0Q09OVEVYVF9NRU5VOiAnY29udGV4dG1lbnUnLFxuXHRXSEVFTDogJ3doZWVsJyxcblx0Ly8gS2V5Ym9hcmRcblx0S0VZX0RPV046ICdrZXlkb3duJyxcblx0S0VZX1BSRVNTOiAna2V5cHJlc3MnLFxuXHRLRVlfVVA6ICdrZXl1cCcsXG5cdC8vIEhUTUwgRG9jdW1lbnRcblx0TE9BRDogJ2xvYWQnLFxuXHRCRUZPUkVfVU5MT0FEOiAnYmVmb3JldW5sb2FkJyxcblx0VU5MT0FEOiAndW5sb2FkJyxcblx0UEFHRV9TSE9XOiAncGFnZXNob3cnLFxuXHRQQUdFX0hJREU6ICdwYWdlaGlkZScsXG5cdFBBU1RFOiAncGFzdGUnLFxuXHRBQk9SVDogJ2Fib3J0Jyxcblx0RVJST1I6ICdlcnJvcicsXG5cdFJFU0laRTogJ3Jlc2l6ZScsXG5cdFNDUk9MTDogJ3Njcm9sbCcsXG5cdEZVTExTQ1JFRU5fQ0hBTkdFOiAnZnVsbHNjcmVlbmNoYW5nZScsXG5cdFdLX0ZVTExTQ1JFRU5fQ0hBTkdFOiAnd2Via2l0ZnVsbHNjcmVlbmNoYW5nZScsXG5cdC8vIEZvcm1cblx0U0VMRUNUOiAnc2VsZWN0Jyxcblx0Q0hBTkdFOiAnY2hhbmdlJyxcblx0U1VCTUlUOiAnc3VibWl0Jyxcblx0UkVTRVQ6ICdyZXNldCcsXG5cdEZPQ1VTOiAnZm9jdXMnLFxuXHRGT0NVU19JTjogJ2ZvY3VzaW4nLFxuXHRGT0NVU19PVVQ6ICdmb2N1c291dCcsXG5cdEJMVVI6ICdibHVyJyxcblx0SU5QVVQ6ICdpbnB1dCcsXG5cdC8vIExvY2FsIFN0b3JhZ2Vcblx0U1RPUkFHRTogJ3N0b3JhZ2UnLFxuXHQvLyBEcmFnXG5cdERSQUdfU1RBUlQ6ICdkcmFnc3RhcnQnLFxuXHREUkFHOiAnZHJhZycsXG5cdERSQUdfRU5URVI6ICdkcmFnZW50ZXInLFxuXHREUkFHX0xFQVZFOiAnZHJhZ2xlYXZlJyxcblx0RFJBR19PVkVSOiAnZHJhZ292ZXInLFxuXHREUk9QOiAnZHJvcCcsXG5cdERSQUdfRU5EOiAnZHJhZ2VuZCcsXG5cdC8vIEFuaW1hdGlvblxuXHRBTklNQVRJT05fU1RBUlQ6IGJyb3dzZXIuaXNXZWJLaXQgPyAnd2Via2l0QW5pbWF0aW9uU3RhcnQnIDogJ2FuaW1hdGlvbnN0YXJ0Jyxcblx0QU5JTUFUSU9OX0VORDogYnJvd3Nlci5pc1dlYktpdCA/ICd3ZWJraXRBbmltYXRpb25FbmQnIDogJ2FuaW1hdGlvbmVuZCcsXG5cdEFOSU1BVElPTl9JVEVSQVRJT046IGJyb3dzZXIuaXNXZWJLaXQgPyAnd2Via2l0QW5pbWF0aW9uSXRlcmF0aW9uJyA6ICdhbmltYXRpb25pdGVyYXRpb24nXG59IGFzIGNvbnN0O1xuXG5leHBvcnQgaW50ZXJmYWNlIEV2ZW50TGlrZSB7XG5cdHByZXZlbnREZWZhdWx0KCk6IHZvaWQ7XG5cdHN0b3BQcm9wYWdhdGlvbigpOiB2b2lkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFdmVudExpa2Uob2JqOiB1bmtub3duKTogb2JqIGlzIEV2ZW50TGlrZSB7XG5cdGNvbnN0IGNhbmRpZGF0ZSA9IG9iaiBhcyBFdmVudExpa2UgfCB1bmRlZmluZWQ7XG5cblx0cmV0dXJuICEhKGNhbmRpZGF0ZSAmJiB0eXBlb2YgY2FuZGlkYXRlLnByZXZlbnREZWZhdWx0ID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBjYW5kaWRhdGUuc3RvcFByb3BhZ2F0aW9uID09PSAnZnVuY3Rpb24nKTtcbn1cblxuZXhwb3J0IGNvbnN0IEV2ZW50SGVscGVyID0ge1xuXHRzdG9wOiA8VCBleHRlbmRzIEV2ZW50TGlrZT4oZTogVCwgY2FuY2VsQnViYmxlPzogYm9vbGVhbik6IFQgPT4ge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRpZiAoY2FuY2VsQnViYmxlKSB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdH1cblx0XHRyZXR1cm4gZTtcblx0fVxufTtcblxuZXhwb3J0IGludGVyZmFjZSBJRm9jdXNUcmFja2VyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXM6IGV2ZW50LkV2ZW50PHZvaWQ+O1xuXHRyZWFkb25seSBvbkRpZEJsdXI6IGV2ZW50LkV2ZW50PHZvaWQ+O1xuXHRyZWZyZXNoU3RhdGUoKTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhdmVQYXJlbnRzU2Nyb2xsVG9wKG5vZGU6IEVsZW1lbnQpOiBudW1iZXJbXSB7XG5cdGNvbnN0IHI6IG51bWJlcltdID0gW107XG5cdGZvciAobGV0IGkgPSAwOyBub2RlICYmIG5vZGUubm9kZVR5cGUgPT09IG5vZGUuRUxFTUVOVF9OT0RFOyBpKyspIHtcblx0XHRyW2ldID0gbm9kZS5zY3JvbGxUb3A7XG5cdFx0bm9kZSA9IDxFbGVtZW50Pm5vZGUucGFyZW50Tm9kZTtcblx0fVxuXHRyZXR1cm4gcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc3RvcmVQYXJlbnRzU2Nyb2xsVG9wKG5vZGU6IEVsZW1lbnQsIHN0YXRlOiBudW1iZXJbXSk6IHZvaWQge1xuXHRmb3IgKGxldCBpID0gMDsgbm9kZSAmJiBub2RlLm5vZGVUeXBlID09PSBub2RlLkVMRU1FTlRfTk9ERTsgaSsrKSB7XG5cdFx0aWYgKG5vZGUuc2Nyb2xsVG9wICE9PSBzdGF0ZVtpXSkge1xuXHRcdFx0bm9kZS5zY3JvbGxUb3AgPSBzdGF0ZVtpXTtcblx0XHR9XG5cdFx0bm9kZSA9IDxFbGVtZW50Pm5vZGUucGFyZW50Tm9kZTtcblx0fVxufVxuXG5jbGFzcyBGb2N1c1RyYWNrZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUZvY3VzVHJhY2tlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRGb2N1cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBldmVudC5FbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEZvY3VzID0gdGhpcy5fb25EaWRGb2N1cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEJsdXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgZXZlbnQuRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRCbHVyID0gdGhpcy5fb25EaWRCbHVyLmV2ZW50O1xuXG5cdHByaXZhdGUgX3JlZnJlc2hTdGF0ZUhhbmRsZXI6ICgpID0+IHZvaWQ7XG5cblx0cHJpdmF0ZSBzdGF0aWMgaGFzRm9jdXNXaXRoaW4oZWxlbWVudDogSFRNTEVsZW1lbnQgfCBXaW5kb3cpOiBib29sZWFuIHtcblx0XHRpZiAoaXNIVE1MRWxlbWVudChlbGVtZW50KSkge1xuXHRcdFx0Y29uc3Qgc2hhZG93Um9vdCA9IGdldFNoYWRvd1Jvb3QoZWxlbWVudCk7XG5cdFx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gKHNoYWRvd1Jvb3QgPyBzaGFkb3dSb290LmFjdGl2ZUVsZW1lbnQgOiBlbGVtZW50Lm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7XG5cdFx0XHRyZXR1cm4gaXNBbmNlc3RvcihhY3RpdmVFbGVtZW50LCBlbGVtZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3Qgd2luZG93ID0gZWxlbWVudDtcblx0XHRcdHJldHVybiBpc0FuY2VzdG9yKHdpbmRvdy5kb2N1bWVudC5hY3RpdmVFbGVtZW50LCB3aW5kb3cuZG9jdW1lbnQpO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0cnVjdG9yKGVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgV2luZG93KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRsZXQgaGFzRm9jdXMgPSBGb2N1c1RyYWNrZXIuaGFzRm9jdXNXaXRoaW4oZWxlbWVudCk7XG5cdFx0bGV0IGxvb3NpbmdGb2N1cyA9IGZhbHNlO1xuXG5cdFx0Y29uc3Qgb25Gb2N1cyA9ICgpID0+IHtcblx0XHRcdGxvb3NpbmdGb2N1cyA9IGZhbHNlO1xuXHRcdFx0aWYgKCFoYXNGb2N1cykge1xuXHRcdFx0XHRoYXNGb2N1cyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX29uRGlkRm9jdXMuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBvbkJsdXIgPSAoKSA9PiB7XG5cdFx0XHRpZiAoaGFzRm9jdXMpIHtcblx0XHRcdFx0bG9vc2luZ0ZvY3VzID0gdHJ1ZTtcblx0XHRcdFx0KGlzSFRNTEVsZW1lbnQoZWxlbWVudCkgPyBnZXRXaW5kb3coZWxlbWVudCkgOiBlbGVtZW50KS5zZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRpZiAobG9vc2luZ0ZvY3VzKSB7XG5cdFx0XHRcdFx0XHRsb29zaW5nRm9jdXMgPSBmYWxzZTtcblx0XHRcdFx0XHRcdGhhc0ZvY3VzID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR0aGlzLl9vbkRpZEJsdXIuZmlyZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgMCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZnJlc2hTdGF0ZUhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBjdXJyZW50Tm9kZUhhc0ZvY3VzID0gRm9jdXNUcmFja2VyLmhhc0ZvY3VzV2l0aGluKDxIVE1MRWxlbWVudD5lbGVtZW50KTtcblx0XHRcdGlmIChjdXJyZW50Tm9kZUhhc0ZvY3VzICE9PSBoYXNGb2N1cykge1xuXHRcdFx0XHRpZiAoaGFzRm9jdXMpIHtcblx0XHRcdFx0XHRvbkJsdXIoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRvbkZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIEV2ZW50VHlwZS5GT0NVUywgb25Gb2N1cywgdHJ1ZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50LCBFdmVudFR5cGUuQkxVUiwgb25CbHVyLCB0cnVlKSk7XG5cdFx0aWYgKGlzSFRNTEVsZW1lbnQoZWxlbWVudCkpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50LCBFdmVudFR5cGUuRk9DVVNfSU4sICgpID0+IHRoaXMuX3JlZnJlc2hTdGF0ZUhhbmRsZXIoKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIEV2ZW50VHlwZS5GT0NVU19PVVQsICgpID0+IHRoaXMuX3JlZnJlc2hTdGF0ZUhhbmRsZXIoKSkpO1xuXHRcdH1cblxuXHR9XG5cblx0cmVmcmVzaFN0YXRlKCkge1xuXHRcdHRoaXMuX3JlZnJlc2hTdGF0ZUhhbmRsZXIoKTtcblx0fVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYElGb2N1c1RyYWNrZXJgIGluc3RhbmNlIHRoYXQgdHJhY2tzIGZvY3VzIGNoYW5nZXMgb24gdGhlIGdpdmVuIGBlbGVtZW50YCBhbmQgaXRzIGRlc2NlbmRhbnRzLlxuICpcbiAqIEBwYXJhbSBlbGVtZW50IFRoZSBgSFRNTEVsZW1lbnRgIG9yIGBXaW5kb3dgIHRvIHRyYWNrIGZvY3VzIGNoYW5nZXMgb24uXG4gKiBAcmV0dXJucyBBbiBgSUZvY3VzVHJhY2tlcmAgaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmFja0ZvY3VzKGVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgV2luZG93KTogSUZvY3VzVHJhY2tlciB7XG5cdHJldHVybiBuZXcgRm9jdXNUcmFja2VyKGVsZW1lbnQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWZ0ZXI8VCBleHRlbmRzIE5vZGU+KHNpYmxpbmc6IEhUTUxFbGVtZW50LCBjaGlsZDogVCk6IFQge1xuXHRzaWJsaW5nLmFmdGVyKGNoaWxkKTtcblx0cmV0dXJuIGNoaWxkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwZW5kPFQgZXh0ZW5kcyBOb2RlPihwYXJlbnQ6IEhUTUxFbGVtZW50LCBjaGlsZDogVCk6IFQ7XG5leHBvcnQgZnVuY3Rpb24gYXBwZW5kPFQgZXh0ZW5kcyBOb2RlPihwYXJlbnQ6IEhUTUxFbGVtZW50LCAuLi5jaGlsZHJlbjogKFQgfCBzdHJpbmcpW10pOiB2b2lkO1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZDxUIGV4dGVuZHMgTm9kZT4ocGFyZW50OiBIVE1MRWxlbWVudCwgLi4uY2hpbGRyZW46IChUIHwgc3RyaW5nKVtdKTogVCB8IHZvaWQge1xuXHRwYXJlbnQuYXBwZW5kKC4uLmNoaWxkcmVuKTtcblx0aWYgKGNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiB0eXBlb2YgY2hpbGRyZW5bMF0gIT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIDxUPmNoaWxkcmVuWzBdO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVwZW5kPFQgZXh0ZW5kcyBOb2RlPihwYXJlbnQ6IEhUTUxFbGVtZW50LCBjaGlsZDogVCk6IFQge1xuXHRwYXJlbnQuaW5zZXJ0QmVmb3JlKGNoaWxkLCBwYXJlbnQuZmlyc3RDaGlsZCk7XG5cdHJldHVybiBjaGlsZDtcbn1cblxuLyoqXG4gKiBSZW1vdmVzIGFsbCBjaGlsZHJlbiBmcm9tIGBwYXJlbnRgIGFuZCBhcHBlbmRzIGBjaGlsZHJlbmBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0KHBhcmVudDogSFRNTEVsZW1lbnQsIC4uLmNoaWxkcmVuOiBBcnJheTxOb2RlIHwgc3RyaW5nPik6IHZvaWQge1xuXHRwYXJlbnQuaW5uZXJUZXh0ID0gJyc7XG5cdGFwcGVuZChwYXJlbnQsIC4uLmNoaWxkcmVuKTtcbn1cblxuY29uc3QgU0VMRUNUT1JfUkVHRVggPSAvKFtcXHdcXC1dKyk/KCMoW1xcd1xcLV0rKSk/KChcXC4oW1xcd1xcLV0rKSkqKS87XG5cbmV4cG9ydCBlbnVtIE5hbWVzcGFjZSB7XG5cdEhUTUwgPSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCcsXG5cdFNWRyA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zydcbn1cblxuZnVuY3Rpb24gXyQ8VCBleHRlbmRzIEVsZW1lbnQ+KG5hbWVzcGFjZTogTmFtZXNwYWNlLCBkZXNjcmlwdGlvbjogc3RyaW5nLCBhdHRycz86IHsgW2tleTogc3RyaW5nXTogYW55IH0sIC4uLmNoaWxkcmVuOiBBcnJheTxOb2RlIHwgc3RyaW5nPik6IFQge1xuXHRjb25zdCBtYXRjaCA9IFNFTEVDVE9SX1JFR0VYLmV4ZWMoZGVzY3JpcHRpb24pO1xuXG5cdGlmICghbWF0Y2gpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0JhZCB1c2Ugb2YgZW1tZXQnKTtcblx0fVxuXG5cdGNvbnN0IHRhZ05hbWUgPSBtYXRjaFsxXSB8fCAnZGl2Jztcblx0bGV0IHJlc3VsdDogVDtcblxuXHRpZiAobmFtZXNwYWNlICE9PSBOYW1lc3BhY2UuSFRNTCkge1xuXHRcdHJlc3VsdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2UgYXMgc3RyaW5nLCB0YWdOYW1lKSBhcyBUO1xuXHR9IGVsc2Uge1xuXHRcdHJlc3VsdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSkgYXMgdW5rbm93biBhcyBUO1xuXHR9XG5cblx0aWYgKG1hdGNoWzNdKSB7XG5cdFx0cmVzdWx0LmlkID0gbWF0Y2hbM107XG5cdH1cblx0aWYgKG1hdGNoWzRdKSB7XG5cdFx0cmVzdWx0LmNsYXNzTmFtZSA9IG1hdGNoWzRdLnJlcGxhY2UoL1xcLi9nLCAnICcpLnRyaW0oKTtcblx0fVxuXG5cdGlmIChhdHRycykge1xuXHRcdE9iamVjdC5lbnRyaWVzKGF0dHJzKS5mb3JFYWNoKChbbmFtZSwgdmFsdWVdKSA9PiB7XG5cdFx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICgvXm9uXFx3KyQvLnRlc3QobmFtZSkpIHtcblx0XHRcdFx0KDxhbnk+cmVzdWx0KVtuYW1lXSA9IHZhbHVlO1xuXHRcdFx0fSBlbHNlIGlmIChuYW1lID09PSAnc2VsZWN0ZWQnKSB7XG5cdFx0XHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0XHRcdHJlc3VsdC5zZXRBdHRyaWJ1dGUobmFtZSwgJ3RydWUnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJlc3VsdC5hcHBlbmQoLi4uY2hpbGRyZW4pO1xuXG5cdHJldHVybiByZXN1bHQgYXMgVDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uICQ8VCBleHRlbmRzIEhUTUxFbGVtZW50PihkZXNjcmlwdGlvbjogc3RyaW5nLCBhdHRycz86IHsgW2tleTogc3RyaW5nXTogYW55IH0sIC4uLmNoaWxkcmVuOiBBcnJheTxOb2RlIHwgc3RyaW5nPik6IFQge1xuXHRyZXR1cm4gXyQoTmFtZXNwYWNlLkhUTUwsIGRlc2NyaXB0aW9uLCBhdHRycywgLi4uY2hpbGRyZW4pO1xufVxuXG4kLlNWRyA9IGZ1bmN0aW9uIDxUIGV4dGVuZHMgU1ZHRWxlbWVudD4oZGVzY3JpcHRpb246IHN0cmluZywgYXR0cnM/OiB7IFtrZXk6IHN0cmluZ106IGFueSB9LCAuLi5jaGlsZHJlbjogQXJyYXk8Tm9kZSB8IHN0cmluZz4pOiBUIHtcblx0cmV0dXJuIF8kKE5hbWVzcGFjZS5TVkcsIGRlc2NyaXB0aW9uLCBhdHRycywgLi4uY2hpbGRyZW4pO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGpvaW4obm9kZXM6IE5vZGVbXSwgc2VwYXJhdG9yOiBOb2RlIHwgc3RyaW5nKTogTm9kZVtdIHtcblx0Y29uc3QgcmVzdWx0OiBOb2RlW10gPSBbXTtcblxuXHRub2Rlcy5mb3JFYWNoKChub2RlLCBpbmRleCkgPT4ge1xuXHRcdGlmIChpbmRleCA+IDApIHtcblx0XHRcdGlmIChzZXBhcmF0b3IgaW5zdGFuY2VvZiBOb2RlKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHNlcGFyYXRvci5jbG9uZU5vZGUoKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQucHVzaChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShzZXBhcmF0b3IpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXN1bHQucHVzaChub2RlKTtcblx0fSk7XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldFZpc2liaWxpdHkodmlzaWJsZTogYm9vbGVhbiwgLi4uZWxlbWVudHM6IEhUTUxFbGVtZW50W10pOiB2b2lkIHtcblx0aWYgKHZpc2libGUpIHtcblx0XHRzaG93KC4uLmVsZW1lbnRzKTtcblx0fSBlbHNlIHtcblx0XHRoaWRlKC4uLmVsZW1lbnRzKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdyguLi5lbGVtZW50czogSFRNTEVsZW1lbnRbXSk6IHZvaWQge1xuXHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnJztcblx0XHRlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaGlkZSguLi5lbGVtZW50czogSFRNTEVsZW1lbnRbXSk6IHZvaWQge1xuXHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcblx0fVxufVxuXG5mdW5jdGlvbiBmaW5kUGFyZW50V2l0aEF0dHJpYnV0ZShub2RlOiBOb2RlIHwgbnVsbCwgYXR0cmlidXRlOiBzdHJpbmcpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuXHR3aGlsZSAobm9kZSAmJiBub2RlLm5vZGVUeXBlID09PSBub2RlLkVMRU1FTlRfTk9ERSkge1xuXHRcdGlmIChpc0hUTUxFbGVtZW50KG5vZGUpICYmIG5vZGUuaGFzQXR0cmlidXRlKGF0dHJpYnV0ZSkpIHtcblx0XHRcdHJldHVybiBub2RlO1xuXHRcdH1cblxuXHRcdG5vZGUgPSBub2RlLnBhcmVudE5vZGU7XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZVRhYkluZGV4QW5kVXBkYXRlRm9jdXMobm9kZTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0aWYgKCFub2RlIHx8ICFub2RlLmhhc0F0dHJpYnV0ZSgndGFiSW5kZXgnKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdC8vIElmIHdlIGFyZSB0aGUgY3VycmVudGx5IGZvY3VzZWQgZWxlbWVudCBhbmQgdGFiSW5kZXggaXMgcmVtb3ZlZCxcblx0Ly8gc3RhbmRhcmQgRE9NIGJlaGF2aW9yIGlzIHRvIG1vdmUgZm9jdXMgdG8gdGhlIDxib2R5PiBlbGVtZW50LiBXZVxuXHQvLyB0eXBpY2FsbHkgbmV2ZXIgd2FudCB0aGF0LCByYXRoZXIgcHV0IGZvY3VzIHRvIHRoZSBjbG9zZXN0IGVsZW1lbnRcblx0Ly8gaW4gdGhlIGhpZXJhcmNoeSBvZiB0aGUgcGFyZW50IERPTSBub2Rlcy5cblx0aWYgKG5vZGUub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBub2RlKSB7XG5cdFx0Y29uc3QgcGFyZW50Rm9jdXNhYmxlID0gZmluZFBhcmVudFdpdGhBdHRyaWJ1dGUobm9kZS5wYXJlbnRFbGVtZW50LCAndGFiSW5kZXgnKTtcblx0XHRwYXJlbnRGb2N1c2FibGU/LmZvY3VzKCk7XG5cdH1cblxuXHRub2RlLnJlbW92ZUF0dHJpYnV0ZSgndGFiaW5kZXgnKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbmFsSGFuZGxlcjxUIGV4dGVuZHMgRXZlbnQ+KGZuOiAoZXZlbnQ6IFQpID0+IHVua25vd24pOiAoZXZlbnQ6IFQpID0+IHVua25vd24ge1xuXHRyZXR1cm4gZSA9PiB7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0Zm4oZSk7XG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkb21Db250ZW50TG9hZGVkKHRhcmdldFdpbmRvdzogV2luZG93KTogUHJvbWlzZTx2b2lkPiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRjb25zdCByZWFkeVN0YXRlID0gdGFyZ2V0V2luZG93LmRvY3VtZW50LnJlYWR5U3RhdGU7XG5cdFx0aWYgKHJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScgfHwgKHRhcmdldFdpbmRvdy5kb2N1bWVudCAmJiB0YXJnZXRXaW5kb3cuZG9jdW1lbnQuYm9keSAhPT0gbnVsbCkpIHtcblx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbGlzdGVuZXIgPSAoKSA9PiB7XG5cdFx0XHRcdHRhcmdldFdpbmRvdy53aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGxpc3RlbmVyLCBmYWxzZSk7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH07XG5cblx0XHRcdHRhcmdldFdpbmRvdy53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGxpc3RlbmVyLCBmYWxzZSk7XG5cdFx0fVxuXHR9KTtcbn1cblxuLyoqXG4gKiBGaW5kIGEgdmFsdWUgdXNhYmxlIGZvciBhIGRvbSBub2RlIHNpemUgc3VjaCB0aGF0IHRoZSBsaWtlbGlob29kIHRoYXQgaXQgd291bGQgYmVcbiAqIGRpc3BsYXllZCB3aXRoIGNvbnN0YW50IHNjcmVlbiBwaXhlbHMgc2l6ZSBpcyBhcyBoaWdoIGFzIHBvc3NpYmxlLlxuICpcbiAqIGUuZy4gV2Ugd291bGQgZGVzaXJlIGZvciB0aGUgY3Vyc29ycyB0byBiZSAycHggKENTUyBweCkgd2lkZS4gVW5kZXIgYSBkZXZpY2VQaXhlbFJhdGlvXG4gKiBvZiAxLjI1LCB0aGUgY3Vyc29yIHdpbGwgYmUgMi41IHNjcmVlbiBwaXhlbHMgd2lkZS4gRGVwZW5kaW5nIG9uIGhvdyB0aGUgZG9tIG5vZGUgYWxpZ25zL1wic25hcHNcIlxuICogd2l0aCB0aGUgc2NyZWVuIHBpeGVscywgaXQgd2lsbCBzb21ldGltZXMgYmUgcmVuZGVyZWQgd2l0aCAyIHNjcmVlbiBwaXhlbHMsIGFuZCBzb21ldGltZXMgd2l0aCAzIHNjcmVlbiBwaXhlbHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlU2NyZWVuQXdhcmVTaXplKHdpbmRvdzogV2luZG93LCBjc3NQeDogbnVtYmVyKTogbnVtYmVyIHtcblx0Y29uc3Qgc2NyZWVuUHggPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyAqIGNzc1B4O1xuXHRyZXR1cm4gTWF0aC5tYXgoMSwgTWF0aC5mbG9vcihzY3JlZW5QeCkpIC8gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG59XG5cbi8qKlxuICogT3BlbiBzYWZlbHkgYSBuZXcgd2luZG93LiBUaGlzIGlzIHRoZSBiZXN0IHdheSB0byBkbyBzbywgYnV0IHlvdSBjYW5ub3QgdGVsbFxuICogaWYgdGhlIHdpbmRvdyB3YXMgb3BlbmVkIG9yIGlmIGl0IHdhcyBibG9ja2VkIGJ5IHRoZSBicm93c2VyJ3MgcG9wdXAgYmxvY2tlci5cbiAqIElmIHlvdSB3YW50IHRvIHRlbGwgaWYgdGhlIGJyb3dzZXIgYmxvY2tlZCB0aGUgbmV3IHdpbmRvdywgdXNlIHtAbGluayB3aW5kb3dPcGVuV2l0aFN1Y2Nlc3N9LlxuICpcbiAqIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L21vbmFjby1lZGl0b3IvaXNzdWVzLzYwMVxuICogVG8gcHJvdGVjdCBhZ2FpbnN0IG1hbGljaW91cyBjb2RlIGluIHRoZSBsaW5rZWQgc2l0ZSwgcGFydGljdWxhcmx5IHBoaXNoaW5nIGF0dGVtcHRzLFxuICogdGhlIHdpbmRvdy5vcGVuZXIgc2hvdWxkIGJlIHNldCB0byBudWxsIHRvIHByZXZlbnQgdGhlIGxpbmtlZCBzaXRlIGZyb20gaGF2aW5nIGFjY2Vzc1xuICogdG8gY2hhbmdlIHRoZSBsb2NhdGlvbiBvZiB0aGUgY3VycmVudCBwYWdlLlxuICogU2VlIGh0dHBzOi8vbWF0aGlhc2J5bmVucy5naXRodWIuaW8vcmVsLW5vb3BlbmVyL1xuICovXG5leHBvcnQgZnVuY3Rpb24gd2luZG93T3Blbk5vT3BlbmVyKHVybDogc3RyaW5nKTogdm9pZCB7XG5cdC8vIEJ5IHVzaW5nICdub29wZW5lcicgaW4gdGhlIGB3aW5kb3dGZWF0dXJlc2AgYXJndW1lbnQsIHRoZSBuZXdseSBjcmVhdGVkIHdpbmRvdyB3aWxsXG5cdC8vIG5vdCBiZSBhYmxlIHRvIHVzZSBgd2luZG93Lm9wZW5lcmAgdG8gcmVhY2ggYmFjayB0byB0aGUgY3VycmVudCBwYWdlLlxuXHQvLyBTZWUgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzQ2OTU4NzMxXG5cdC8vIFNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2luZG93L29wZW4jbm9vcGVuZXJcblx0Ly8gSG93ZXZlciwgdGhpcyBhbHNvIGRvZXNuJ3QgYWxsb3cgdXMgdG8gcmVhbGl6ZSBpZiB0aGUgYnJvd3NlciBibG9ja2VkXG5cdC8vIHRoZSBjcmVhdGlvbiBvZiB0aGUgd2luZG93LlxuXHRtYWluV2luZG93Lm9wZW4odXJsLCAnX2JsYW5rJywgJ25vb3BlbmVyJyk7XG59XG5cbi8qKlxuICogT3BlbiBhIG5ldyB3aW5kb3cgaW4gYSBwb3B1cC4gVGhpcyBpcyB0aGUgYmVzdCB3YXkgdG8gZG8gc28sIGJ1dCB5b3UgY2Fubm90IHRlbGxcbiAqIGlmIHRoZSB3aW5kb3cgd2FzIG9wZW5lZCBvciBpZiBpdCB3YXMgYmxvY2tlZCBieSB0aGUgYnJvd3NlcidzIHBvcHVwIGJsb2NrZXIuXG4gKiBJZiB5b3Ugd2FudCB0byB0ZWxsIGlmIHRoZSBicm93c2VyIGJsb2NrZWQgdGhlIG5ldyB3aW5kb3csIHVzZSB7QGxpbmsgd2luZG93T3BlbldpdGhTdWNjZXNzfS5cbiAqXG4gKiBOb3RlOiB0aGlzIGRvZXMgbm90IHNldCB7QGxpbmsgd2luZG93Lm9wZW5lcn0gdG8gbnVsbC4gVGhpcyBpcyB0byBhbGxvdyB0aGUgb3BlbmVkIHBvcHVwIHRvXG4gKiBiZSBhYmxlIHRvIHVzZSB7QGxpbmsgd2luZG93LmNsb3NlfSB0byBjbG9zZSBpdHNlbGYuIEJlY2F1c2Ugb2YgdGhpcywgeW91IHNob3VsZCBvbmx5IHVzZVxuICogdGhpcyBmdW5jdGlvbiBvbiB1cmxzIHRoYXQgeW91IHRydXN0LlxuICpcbiAqIEluIG90aGVyd29yZHMsIHlvdSBzaG91bGQgYWxtb3N0IGFsd2F5cyB1c2Uge0BsaW5rIHdpbmRvd09wZW5Ob09wZW5lcn0gaW5zdGVhZCBvZiB0aGlzIGZ1bmN0aW9uLlxuICovXG5jb25zdCBwb3B1cFdpZHRoID0gNzgwLCBwb3B1cEhlaWdodCA9IDY0MDtcbmV4cG9ydCBmdW5jdGlvbiB3aW5kb3dPcGVuUG9wdXAodXJsOiBzdHJpbmcpOiB2b2lkIHtcblx0Y29uc3QgbGVmdCA9IE1hdGguZmxvb3IobWFpbldpbmRvdy5zY3JlZW5MZWZ0ICsgbWFpbldpbmRvdy5pbm5lcldpZHRoIC8gMiAtIHBvcHVwV2lkdGggLyAyKTtcblx0Y29uc3QgdG9wID0gTWF0aC5mbG9vcihtYWluV2luZG93LnNjcmVlblRvcCArIG1haW5XaW5kb3cuaW5uZXJIZWlnaHQgLyAyIC0gcG9wdXBIZWlnaHQgLyAyKTtcblx0bWFpbldpbmRvdy5vcGVuKFxuXHRcdHVybCxcblx0XHQnX2JsYW5rJyxcblx0XHRgd2lkdGg9JHtwb3B1cFdpZHRofSxoZWlnaHQ9JHtwb3B1cEhlaWdodH0sdG9wPSR7dG9wfSxsZWZ0PSR7bGVmdH1gXG5cdCk7XG59XG5cbi8qKlxuICogQXR0ZW1wdHMgdG8gb3BlbiBhIHdpbmRvdyBhbmQgcmV0dXJucyB3aGV0aGVyIGl0IHN1Y2NlZWRlZC4gVGhpcyB0ZWNobmlxdWUgaXNcbiAqIG5vdCBhcHByb3ByaWF0ZSBpbiBjZXJ0YWluIGNvbnRleHRzLCBsaWtlIGZvciBleGFtcGxlIHdoZW4gdGhlIEpTIGNvbnRleHQgaXNcbiAqIGV4ZWN1dGluZyBpbnNpZGUgYSBzYW5kYm94ZWQgaWZyYW1lLiBJZiBpdCBpcyBub3QgbmVjZXNzYXJ5IHRvIGtub3cgaWYgdGhlXG4gKiBicm93c2VyIGJsb2NrZWQgdGhlIG5ldyB3aW5kb3csIHVzZSB7QGxpbmsgd2luZG93T3Blbk5vT3BlbmVyfS5cbiAqXG4gKiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9tb25hY28tZWRpdG9yL2lzc3Vlcy82MDFcbiAqIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L21vbmFjby1lZGl0b3IvaXNzdWVzLzI0NzRcbiAqIFNlZSBodHRwczovL21hdGhpYXNieW5lbnMuZ2l0aHViLmlvL3JlbC1ub29wZW5lci9cbiAqXG4gKiBAcGFyYW0gdXJsIHRoZSB1cmwgdG8gb3BlblxuICogQHBhcmFtIG5vT3BlbmVyIHdoZXRoZXIgb3Igbm90IHRvIHNldCB0aGUge0BsaW5rIHdpbmRvdy5vcGVuZXJ9IHRvIG51bGwuIFlvdSBzaG91bGQgbGVhdmUgdGhlIGRlZmF1bHRcbiAqICh0cnVlKSB1bmxlc3MgeW91IHRydXN0IHRoZSB1cmwgdGhhdCBpcyBiZWluZyBvcGVuZWQuXG4gKiBAcmV0dXJucyBib29sZWFuIGluZGljYXRpbmcgaWYgdGhlIHtAbGluayB3aW5kb3cub3Blbn0gY2FsbCBzdWNjZWVkZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpbmRvd09wZW5XaXRoU3VjY2Vzcyh1cmw6IHN0cmluZywgbm9PcGVuZXIgPSB0cnVlKTogYm9vbGVhbiB7XG5cdGNvbnN0IG5ld1RhYiA9IG1haW5XaW5kb3cub3BlbigpO1xuXHRpZiAobmV3VGFiKSB7XG5cdFx0aWYgKG5vT3BlbmVyKSB7XG5cdFx0XHQvLyBzZWUgYHdpbmRvd09wZW5Ob09wZW5lcmAgZm9yIGRldGFpbHMgb24gd2h5IHRoaXMgaXMgaW1wb3J0YW50XG5cdFx0XHQobmV3VGFiIGFzIGFueSkub3BlbmVyID0gbnVsbDtcblx0XHR9XG5cdFx0bmV3VGFiLmxvY2F0aW9uLmhyZWYgPSB1cmw7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0cmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYW5pbWF0ZSh0YXJnZXRXaW5kb3c6IFdpbmRvdywgZm46ICgpID0+IHZvaWQpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IHN0ZXAgPSAoKSA9PiB7XG5cdFx0Zm4oKTtcblx0XHRzdGVwRGlzcG9zYWJsZSA9IHNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUodGFyZ2V0V2luZG93LCBzdGVwKTtcblx0fTtcblxuXHRsZXQgc3RlcERpc3Bvc2FibGUgPSBzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKHRhcmdldFdpbmRvdywgc3RlcCk7XG5cdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4gc3RlcERpc3Bvc2FibGUuZGlzcG9zZSgpKTtcbn1cblxuUmVtb3RlQXV0aG9yaXRpZXMuc2V0UHJlZmVycmVkV2ViU2NoZW1hKC9eaHR0cHM6Ly50ZXN0KG1haW5XaW5kb3cubG9jYXRpb24uaHJlZikgPyAnaHR0cHMnIDogJ2h0dHAnKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHRyaWdnZXJEb3dubG9hZChkYXRhT3JVcmk6IFVpbnQ4QXJyYXkgfCBVUkksIG5hbWU6IHN0cmluZyk6IHZvaWQge1xuXG5cdC8vIElmIHRoZSBkYXRhIGlzIHByb3ZpZGVkIGFzIEJ1ZmZlciwgd2UgY3JlYXRlIGFcblx0Ly8gYmxvYiBVUkwgb3V0IG9mIGl0IHRvIHByb2R1Y2UgYSB2YWxpZCBsaW5rXG5cdGxldCB1cmw6IHN0cmluZztcblx0aWYgKFVSSS5pc1VyaShkYXRhT3JVcmkpKSB7XG5cdFx0dXJsID0gZGF0YU9yVXJpLnRvU3RyaW5nKHRydWUpO1xuXHR9IGVsc2Uge1xuXHRcdGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbZGF0YU9yVXJpXSk7XG5cdFx0dXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcblxuXHRcdC8vIEVuc3VyZSB0byBmcmVlIHRoZSBkYXRhIGZyb20gRE9NIGV2ZW50dWFsbHlcblx0XHRzZXRUaW1lb3V0KCgpID0+IFVSTC5yZXZva2VPYmplY3RVUkwodXJsKSk7XG5cdH1cblxuXHQvLyBJbiBvcmRlciB0byBkb3dubG9hZCBmcm9tIHRoZSBicm93c2VyLCB0aGUgb25seSB3YXkgc2VlbXNcblx0Ly8gdG8gYmUgY3JlYXRpbmcgYSA8YT4gZWxlbWVudCB3aXRoIGRvd25sb2FkIGF0dHJpYnV0ZSB0aGF0XG5cdC8vIHBvaW50cyB0byB0aGUgZmlsZSB0byBkb3dubG9hZC5cblx0Ly8gU2VlIGFsc28gaHR0cHM6Ly9kZXZlbG9wZXJzLmdvb2dsZS5jb20vd2ViL3VwZGF0ZXMvMjAxMS8wOC9Eb3dubG9hZGluZy1yZXNvdXJjZXMtaW4tSFRNTDUtYS1kb3dubG9hZFxuXHRjb25zdCBhY3RpdmVXaW5kb3cgPSBnZXRBY3RpdmVXaW5kb3coKTtcblx0Y29uc3QgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXHRhY3RpdmVXaW5kb3cuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhbmNob3IpO1xuXHRhbmNob3IuZG93bmxvYWQgPSBuYW1lO1xuXHRhbmNob3IuaHJlZiA9IHVybDtcblx0YW5jaG9yLmNsaWNrKCk7XG5cblx0Ly8gRW5zdXJlIHRvIHJlbW92ZSB0aGUgZWxlbWVudCBmcm9tIERPTSBldmVudHVhbGx5XG5cdHNldFRpbWVvdXQoKCkgPT4gYW5jaG9yLnJlbW92ZSgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyaWdnZXJVcGxvYWQoKTogUHJvbWlzZTxGaWxlTGlzdCB8IHVuZGVmaW5lZD4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2U8RmlsZUxpc3QgfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4ge1xuXG5cdFx0Ly8gSW4gb3JkZXIgdG8gdXBsb2FkIHRvIHRoZSBicm93c2VyLCBjcmVhdGUgYVxuXHRcdC8vIGlucHV0IGVsZW1lbnQgb2YgdHlwZSBgZmlsZWAgYW5kIGNsaWNrIGl0XG5cdFx0Ly8gdG8gZ2F0aGVyIHRoZSBzZWxlY3RlZCBmaWxlc1xuXHRcdGNvbnN0IGFjdGl2ZVdpbmRvdyA9IGdldEFjdGl2ZVdpbmRvdygpO1xuXHRcdGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcblx0XHRhY3RpdmVXaW5kb3cuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpbnB1dCk7XG5cdFx0aW5wdXQudHlwZSA9ICdmaWxlJztcblx0XHRpbnB1dC5tdWx0aXBsZSA9IHRydWU7XG5cblx0XHQvLyBSZXNvbHZlIG9uY2UgdGhlIGlucHV0IGV2ZW50IGhhcyBmaXJlZCBvbmNlXG5cdFx0ZXZlbnQuRXZlbnQub25jZShldmVudC5FdmVudC5mcm9tRE9NRXZlbnRFbWl0dGVyKGlucHV0LCAnaW5wdXQnKSkoKCkgPT4ge1xuXHRcdFx0cmVzb2x2ZShpbnB1dC5maWxlcyA/PyB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXG5cdFx0aW5wdXQuY2xpY2soKTtcblxuXHRcdC8vIEVuc3VyZSB0byByZW1vdmUgdGhlIGVsZW1lbnQgZnJvbSBET00gZXZlbnR1YWxseVxuXHRcdHNldFRpbWVvdXQoKCkgPT4gaW5wdXQucmVtb3ZlKCkpO1xuXHR9KTtcbn1cblxuZXhwb3J0IGVudW0gRGV0ZWN0ZWRGdWxsc2NyZWVuTW9kZSB7XG5cblx0LyoqXG5cdCAqIFRoZSBkb2N1bWVudCBpcyBmdWxsc2NyZWVuLCBlLmcuIGJlY2F1c2UgYW4gZWxlbWVudFxuXHQgKiBpbiB0aGUgZG9jdW1lbnQgcmVxdWVzdGVkIHRvIGJlIGZ1bGxzY3JlZW4uXG5cdCAqL1xuXHRET0NVTUVOVCA9IDEsXG5cblx0LyoqXG5cdCAqIFRoZSBicm93c2VyIGlzIGZ1bGxzY3JlZW4sIGUuZy4gYmVjYXVzZSB0aGUgdXNlciBlbmFibGVkXG5cdCAqIG5hdGl2ZSB3aW5kb3cgZnVsbHNjcmVlbiBmb3IgaXQuXG5cdCAqL1xuXHRCUk9XU0VSXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURldGVjdGVkRnVsbHNjcmVlbiB7XG5cblx0LyoqXG5cdCAqIEZpZ3VyZSBvdXQgaWYgdGhlIGRvY3VtZW50IGlzIGZ1bGxzY3JlZW4gb3IgdGhlIGJyb3dzZXIuXG5cdCAqL1xuXHRtb2RlOiBEZXRlY3RlZEZ1bGxzY3JlZW5Nb2RlO1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHdlIGtub3cgZm9yIHN1cmUgdGhhdCB3ZSBhcmUgaW4gZnVsbHNjcmVlbiBtb2RlIG9yXG5cdCAqIGl0IGlzIGEgZ3Vlc3MuXG5cdCAqL1xuXHRndWVzczogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdEZ1bGxzY3JlZW4odGFyZ2V0V2luZG93OiBXaW5kb3cpOiBJRGV0ZWN0ZWRGdWxsc2NyZWVuIHwgbnVsbCB7XG5cblx0Ly8gQnJvd3NlciBmdWxsc2NyZWVuOiB1c2UgRE9NIEFQSXMgdG8gZGV0ZWN0XG5cdGlmICh0YXJnZXRXaW5kb3cuZG9jdW1lbnQuZnVsbHNjcmVlbkVsZW1lbnQgfHwgKDxhbnk+dGFyZ2V0V2luZG93LmRvY3VtZW50KS53ZWJraXRGdWxsc2NyZWVuRWxlbWVudCB8fCAoPGFueT50YXJnZXRXaW5kb3cuZG9jdW1lbnQpLndlYmtpdElzRnVsbFNjcmVlbikge1xuXHRcdHJldHVybiB7IG1vZGU6IERldGVjdGVkRnVsbHNjcmVlbk1vZGUuRE9DVU1FTlQsIGd1ZXNzOiBmYWxzZSB9O1xuXHR9XG5cblx0Ly8gVGhlcmUgaXMgbm8gc3RhbmRhcmQgd2F5IHRvIGZpZ3VyZSBvdXQgaWYgdGhlIGJyb3dzZXJcblx0Ly8gaXMgdXNpbmcgbmF0aXZlIGZ1bGxzY3JlZW4uIFZpYSBjaGVja2luZyBvbiBzY3JlZW5cblx0Ly8gaGVpZ2h0IGFuZCBjb21wYXJpbmcgdGhhdCB0byB3aW5kb3cgaGVpZ2h0LCB3ZSBjYW4gZ3Vlc3Ncblx0Ly8gaXQgdGhvdWdoLlxuXG5cdGlmICh0YXJnZXRXaW5kb3cuaW5uZXJIZWlnaHQgPT09IHRhcmdldFdpbmRvdy5zY3JlZW4uaGVpZ2h0KSB7XG5cdFx0Ly8gaWYgdGhlIGhlaWdodCBvZiB0aGUgd2luZG93IG1hdGNoZXMgdGhlIHNjcmVlbiBoZWlnaHQsIHdlIGNhblxuXHRcdC8vIHNhZmVseSBhc3N1bWUgdGhhdCB0aGUgYnJvd3NlciBpcyBmdWxsc2NyZWVuIGJlY2F1c2Ugbm8gYnJvd3NlclxuXHRcdC8vIGNocm9tZSBpcyB0YWtpbmcgaGVpZ2h0IGF3YXkgKGUuZy4gbGlrZSB0b29sYmFycykuXG5cdFx0cmV0dXJuIHsgbW9kZTogRGV0ZWN0ZWRGdWxsc2NyZWVuTW9kZS5CUk9XU0VSLCBndWVzczogZmFsc2UgfTtcblx0fVxuXG5cdGlmIChwbGF0Zm9ybS5pc01hY2ludG9zaCB8fCBwbGF0Zm9ybS5pc0xpbnV4KSB7XG5cdFx0Ly8gbWFjT1MgYW5kIExpbnV4IGRvIG5vdCBwcm9wZXJseSByZXBvcnQgYGlubmVySGVpZ2h0YCwgb25seSBXaW5kb3dzIGRvZXNcblx0XHRpZiAodGFyZ2V0V2luZG93Lm91dGVySGVpZ2h0ID09PSB0YXJnZXRXaW5kb3cuc2NyZWVuLmhlaWdodCAmJiB0YXJnZXRXaW5kb3cub3V0ZXJXaWR0aCA9PT0gdGFyZ2V0V2luZG93LnNjcmVlbi53aWR0aCkge1xuXHRcdFx0Ly8gaWYgdGhlIGhlaWdodCBvZiB0aGUgYnJvd3NlciBtYXRjaGVzIHRoZSBzY3JlZW4gaGVpZ2h0LCB3ZSBjYW5cblx0XHRcdC8vIG9ubHkgZ3Vlc3MgdGhhdCB3ZSBhcmUgaW4gZnVsbHNjcmVlbi4gSXQgaXMgYWxzbyBwb3NzaWJsZSB0aGF0XG5cdFx0XHQvLyB0aGUgdXNlciBoYXMgdHVybmVkIG9mZiB0YXNrYmFycyBpbiB0aGUgT1MgYW5kIHRoZSBicm93c2VyIGlzXG5cdFx0XHQvLyBzaW1wbHkgYWJsZSB0byBzcGFuIHRoZSBlbnRpcmUgc2l6ZSBvZiB0aGUgc2NyZWVuLlxuXHRcdFx0cmV0dXJuIHsgbW9kZTogRGV0ZWN0ZWRGdWxsc2NyZWVuTW9kZS5CUk9XU0VSLCBndWVzczogdHJ1ZSB9O1xuXHRcdH1cblx0fVxuXG5cdC8vIE5vdCBpbiBmdWxsc2NyZWVuXG5cdHJldHVybiBudWxsO1xufVxuXG4vLyAtLSBzYW5pdGl6ZSBhbmQgdHJ1c3RlZCBodG1sXG5cbi8qKlxuICogSG9va3MgZG9tcHVyaWZ5IHVzaW5nIGBhZnRlclNhbml0aXplQXR0cmlidXRlc2AgdG8gY2hlY2sgdGhhdCBhbGwgYGhyZWZgIGFuZCBgc3JjYFxuICogYXR0cmlidXRlcyBhcmUgdmFsaWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBob29rRG9tUHVyaWZ5SHJlZkFuZFNyY1Nhbml0aXplcihhbGxvd2VkUHJvdG9jb2xzOiByZWFkb25seSBzdHJpbmdbXSwgYWxsb3dEYXRhSW1hZ2VzID0gZmFsc2UpOiBJRGlzcG9zYWJsZSB7XG5cdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9jdXJlNTMvRE9NUHVyaWZ5L2Jsb2IvbWFpbi9kZW1vcy9ob29rcy1zY2hlbWUtYWxsb3dsaXN0Lmh0bWxcblxuXHQvLyBidWlsZCBhbiBhbmNob3IgdG8gbWFwIFVSTHMgdG9cblx0Y29uc3QgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXG5cdGRvbXB1cmlmeS5hZGRIb29rKCdhZnRlclNhbml0aXplQXR0cmlidXRlcycsIChub2RlKSA9PiB7XG5cdFx0Ly8gY2hlY2sgYWxsIGhyZWYvc3JjIGF0dHJpYnV0ZXMgZm9yIHZhbGlkaXR5XG5cdFx0Zm9yIChjb25zdCBhdHRyIG9mIFsnaHJlZicsICdzcmMnXSkge1xuXHRcdFx0aWYgKG5vZGUuaGFzQXR0cmlidXRlKGF0dHIpKSB7XG5cdFx0XHRcdGNvbnN0IGF0dHJWYWx1ZSA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHIpIGFzIHN0cmluZztcblx0XHRcdFx0aWYgKGF0dHIgPT09ICdocmVmJyAmJiBhdHRyVmFsdWUuc3RhcnRzV2l0aCgnIycpKSB7XG5cdFx0XHRcdFx0Ly8gQWxsb3cgZnJhZ21lbnQgbGlua3Ncblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGFuY2hvci5ocmVmID0gYXR0clZhbHVlO1xuXHRcdFx0XHRpZiAoIWFsbG93ZWRQcm90b2NvbHMuaW5jbHVkZXMoYW5jaG9yLnByb3RvY29sLnJlcGxhY2UoLzokLywgJycpKSkge1xuXHRcdFx0XHRcdGlmIChhbGxvd0RhdGFJbWFnZXMgJiYgYXR0ciA9PT0gJ3NyYycgJiYgYW5jaG9yLmhyZWYuc3RhcnRzV2l0aCgnZGF0YTonKSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0cik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdGRvbXB1cmlmeS5yZW1vdmVIb29rKCdhZnRlclNhbml0aXplQXR0cmlidXRlcycpO1xuXHR9KTtcbn1cblxuY29uc3QgZGVmYXVsdFNhZmVQcm90b2NvbHMgPSBbXG5cdFNjaGVtYXMuaHR0cCxcblx0U2NoZW1hcy5odHRwcyxcblx0U2NoZW1hcy5jb21tYW5kLFxuXTtcblxuLyoqXG4gKiBMaXN0IG9mIHNhZmUsIG5vbi1pbnB1dCBodG1sIHRhZ3MuXG4gKi9cbmV4cG9ydCBjb25zdCBiYXNpY01hcmt1cEh0bWxUYWdzID0gT2JqZWN0LmZyZWV6ZShbXG5cdCdhJyxcblx0J2FiYnInLFxuXHQnYicsXG5cdCdiZG8nLFxuXHQnYmxvY2txdW90ZScsXG5cdCdicicsXG5cdCdjYXB0aW9uJyxcblx0J2NpdGUnLFxuXHQnY29kZScsXG5cdCdjb2wnLFxuXHQnY29sZ3JvdXAnLFxuXHQnZGQnLFxuXHQnZGVsJyxcblx0J2RldGFpbHMnLFxuXHQnZGZuJyxcblx0J2RpdicsXG5cdCdkbCcsXG5cdCdkdCcsXG5cdCdlbScsXG5cdCdmaWdjYXB0aW9uJyxcblx0J2ZpZ3VyZScsXG5cdCdoMScsXG5cdCdoMicsXG5cdCdoMycsXG5cdCdoNCcsXG5cdCdoNScsXG5cdCdoNicsXG5cdCdocicsXG5cdCdpJyxcblx0J2ltZycsXG5cdCdpbnB1dCcsXG5cdCdpbnMnLFxuXHQna2JkJyxcblx0J2xhYmVsJyxcblx0J2xpJyxcblx0J21hcmsnLFxuXHQnb2wnLFxuXHQncCcsXG5cdCdwcmUnLFxuXHQncScsXG5cdCdycCcsXG5cdCdydCcsXG5cdCdydWJ5Jyxcblx0J3NhbXAnLFxuXHQnc21hbGwnLFxuXHQnc21hbGwnLFxuXHQnc291cmNlJyxcblx0J3NwYW4nLFxuXHQnc3RyaWtlJyxcblx0J3N0cm9uZycsXG5cdCdzdWInLFxuXHQnc3VtbWFyeScsXG5cdCdzdXAnLFxuXHQndGFibGUnLFxuXHQndGJvZHknLFxuXHQndGQnLFxuXHQndGZvb3QnLFxuXHQndGgnLFxuXHQndGhlYWQnLFxuXHQndGltZScsXG5cdCd0cicsXG5cdCd0dCcsXG5cdCd1Jyxcblx0J3VsJyxcblx0J3ZhcicsXG5cdCd2aWRlbycsXG5cdCd3YnInLFxuXSk7XG5cbmNvbnN0IGRlZmF1bHREb21QdXJpZnlDb25maWcgPSBPYmplY3QuZnJlZXplPGRvbXB1cmlmeS5Db25maWcgJiB7IFJFVFVSTl9UUlVTVEVEX1RZUEU6IHRydWUgfT4oe1xuXHRBTExPV0VEX1RBR1M6IFsnYScsICdidXR0b24nLCAnYmxvY2txdW90ZScsICdjb2RlJywgJ2RpdicsICdoMScsICdoMicsICdoMycsICdoNCcsICdoNScsICdoNicsICdocicsICdpbnB1dCcsICdsYWJlbCcsICdsaScsICdwJywgJ3ByZScsICdzZWxlY3QnLCAnc21hbGwnLCAnc3BhbicsICdzdHJvbmcnLCAndGV4dGFyZWEnLCAndWwnLCAnb2wnXSxcblx0QUxMT1dFRF9BVFRSOiBbJ2hyZWYnLCAnZGF0YS1ocmVmJywgJ2RhdGEtY29tbWFuZCcsICd0YXJnZXQnLCAndGl0bGUnLCAnbmFtZScsICdzcmMnLCAnYWx0JywgJ2NsYXNzJywgJ2lkJywgJ3JvbGUnLCAndGFiaW5kZXgnLCAnc3R5bGUnLCAnZGF0YS1jb2RlJywgJ3dpZHRoJywgJ2hlaWdodCcsICdhbGlnbicsICd4LWRpc3BhdGNoJywgJ3JlcXVpcmVkJywgJ2NoZWNrZWQnLCAncGxhY2Vob2xkZXInLCAndHlwZScsICdzdGFydCddLFxuXHRSRVRVUk5fRE9NOiBmYWxzZSxcblx0UkVUVVJOX0RPTV9GUkFHTUVOVDogZmFsc2UsXG5cdFJFVFVSTl9UUlVTVEVEX1RZUEU6IHRydWVcbn0pO1xuXG4vKipcbiAqIFNhbml0aXplcyB0aGUgZ2l2ZW4gYHZhbHVlYCBhbmQgcmVzZXQgdGhlIGdpdmVuIGBub2RlYCB3aXRoIGl0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2FmZUlubmVySHRtbChub2RlOiBIVE1MRWxlbWVudCwgdmFsdWU6IHN0cmluZywgZXh0cmFEb21QdXJpZnlDb25maWc/OiBkb21wdXJpZnkuQ29uZmlnKTogdm9pZCB7XG5cdGNvbnN0IGhvb2sgPSBob29rRG9tUHVyaWZ5SHJlZkFuZFNyY1Nhbml0aXplcihkZWZhdWx0U2FmZVByb3RvY29scyk7XG5cdHRyeSB7XG5cdFx0Y29uc3QgaHRtbCA9IGRvbXB1cmlmeS5zYW5pdGl6ZSh2YWx1ZSwgeyAuLi5kZWZhdWx0RG9tUHVyaWZ5Q29uZmlnLCAuLi5leHRyYURvbVB1cmlmeUNvbmZpZyB9KTtcblx0XHRub2RlLmlubmVySFRNTCA9IGh0bWwgYXMgdW5rbm93biBhcyBzdHJpbmc7XG5cdH0gZmluYWxseSB7XG5cdFx0aG9vay5kaXNwb3NlKCk7XG5cdH1cbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgVW5pY29kZSBzdHJpbmcgdG8gYSBzdHJpbmcgaW4gd2hpY2ggZWFjaCAxNi1iaXQgdW5pdCBvY2N1cGllcyBvbmx5IG9uZSBieXRlXG4gKlxuICogRnJvbSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2luZG93T3JXb3JrZXJHbG9iYWxTY29wZS9idG9hXG4gKi9cbmZ1bmN0aW9uIHRvQmluYXJ5KHN0cjogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3QgY29kZVVuaXRzID0gbmV3IFVpbnQxNkFycmF5KHN0ci5sZW5ndGgpO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGNvZGVVbml0cy5sZW5ndGg7IGkrKykge1xuXHRcdGNvZGVVbml0c1tpXSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuXHR9XG5cdGxldCBiaW5hcnkgPSAnJztcblx0Y29uc3QgdWludDhhcnJheSA9IG5ldyBVaW50OEFycmF5KGNvZGVVbml0cy5idWZmZXIpO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IHVpbnQ4YXJyYXkubGVuZ3RoOyBpKyspIHtcblx0XHRiaW5hcnkgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh1aW50OGFycmF5W2ldKTtcblx0fVxuXHRyZXR1cm4gYmluYXJ5O1xufVxuXG4vKipcbiAqIFZlcnNpb24gb2YgdGhlIGdsb2JhbCBgYnRvYWAgZnVuY3Rpb24gdGhhdCBoYW5kbGVzIG11bHRpLWJ5dGUgY2hhcmFjdGVycyBpbnN0ZWFkXG4gKiBvZiB0aHJvd2luZyBhbiBleGNlcHRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtdWx0aWJ5dGVBd2FyZUJ0b2Eoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gYnRvYSh0b0JpbmFyeShzdHIpKTtcbn1cblxudHlwZSBNb2RpZmllcktleSA9ICdhbHQnIHwgJ2N0cmwnIHwgJ3NoaWZ0JyB8ICdtZXRhJztcblxuZXhwb3J0IGludGVyZmFjZSBJTW9kaWZpZXJLZXlTdGF0dXMge1xuXHRhbHRLZXk6IGJvb2xlYW47XG5cdHNoaWZ0S2V5OiBib29sZWFuO1xuXHRjdHJsS2V5OiBib29sZWFuO1xuXHRtZXRhS2V5OiBib29sZWFuO1xuXHRsYXN0S2V5UHJlc3NlZD86IE1vZGlmaWVyS2V5O1xuXHRsYXN0S2V5UmVsZWFzZWQ/OiBNb2RpZmllcktleTtcblx0ZXZlbnQ/OiBLZXlib2FyZEV2ZW50O1xufVxuXG5leHBvcnQgY2xhc3MgTW9kaWZpZXJLZXlFbWl0dGVyIGV4dGVuZHMgZXZlbnQuRW1pdHRlcjxJTW9kaWZpZXJLZXlTdGF0dXM+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdWJzY3JpcHRpb25zID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIF9rZXlTdGF0dXM6IElNb2RpZmllcktleVN0YXR1cztcblx0cHJpdmF0ZSBzdGF0aWMgaW5zdGFuY2U6IE1vZGlmaWVyS2V5RW1pdHRlcjtcblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9rZXlTdGF0dXMgPSB7XG5cdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0Y3RybEtleTogZmFsc2UsXG5cdFx0XHRtZXRhS2V5OiBmYWxzZVxuXHRcdH07XG5cblx0XHR0aGlzLl9zdWJzY3JpcHRpb25zLmFkZChldmVudC5FdmVudC5ydW5BbmRTdWJzY3JpYmUob25EaWRSZWdpc3RlcldpbmRvdywgKHsgd2luZG93LCBkaXNwb3NhYmxlcyB9KSA9PiB0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKHdpbmRvdywgZGlzcG9zYWJsZXMpLCB7IHdpbmRvdzogbWFpbldpbmRvdywgZGlzcG9zYWJsZXM6IHRoaXMuX3N1YnNjcmlwdGlvbnMgfSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycyh3aW5kb3c6IFdpbmRvdywgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IHZvaWQge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LCAna2V5ZG93bicsIGUgPT4ge1xuXHRcdFx0aWYgKGUuZGVmYXVsdFByZXZlbnRlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdC8vIElmIEFsdC1rZXkga2V5ZG93biBldmVudCBpcyByZXBlYXRlZCwgaWdub3JlIGl0ICMxMTIzNDdcblx0XHRcdC8vIE9ubHkga25vd24gdG8gYmUgbmVjZXNzYXJ5IGZvciBBbHQtS2V5IGF0IHRoZSBtb21lbnQgIzExNTgxMFxuXHRcdFx0aWYgKGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGUuQWx0ICYmIGUucmVwZWF0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuYWx0S2V5ICYmICF0aGlzLl9rZXlTdGF0dXMuYWx0S2V5KSB7XG5cdFx0XHRcdHRoaXMuX2tleVN0YXR1cy5sYXN0S2V5UHJlc3NlZCA9ICdhbHQnO1xuXHRcdFx0fSBlbHNlIGlmIChlLmN0cmxLZXkgJiYgIXRoaXMuX2tleVN0YXR1cy5jdHJsS2V5KSB7XG5cdFx0XHRcdHRoaXMuX2tleVN0YXR1cy5sYXN0S2V5UHJlc3NlZCA9ICdjdHJsJztcblx0XHRcdH0gZWxzZSBpZiAoZS5tZXRhS2V5ICYmICF0aGlzLl9rZXlTdGF0dXMubWV0YUtleSkge1xuXHRcdFx0XHR0aGlzLl9rZXlTdGF0dXMubGFzdEtleVByZXNzZWQgPSAnbWV0YSc7XG5cdFx0XHR9IGVsc2UgaWYgKGUuc2hpZnRLZXkgJiYgIXRoaXMuX2tleVN0YXR1cy5zaGlmdEtleSkge1xuXHRcdFx0XHR0aGlzLl9rZXlTdGF0dXMubGFzdEtleVByZXNzZWQgPSAnc2hpZnQnO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5rZXlDb2RlICE9PSBLZXlDb2RlLkFsdCkge1xuXHRcdFx0XHR0aGlzLl9rZXlTdGF0dXMubGFzdEtleVByZXNzZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2tleVN0YXR1cy5hbHRLZXkgPSBlLmFsdEtleTtcblx0XHRcdHRoaXMuX2tleVN0YXR1cy5jdHJsS2V5ID0gZS5jdHJsS2V5O1xuXHRcdFx0dGhpcy5fa2V5U3RhdHVzLm1ldGFLZXkgPSBlLm1ldGFLZXk7XG5cdFx0XHR0aGlzLl9rZXlTdGF0dXMuc2hpZnRLZXkgPSBlLnNoaWZ0S2V5O1xuXG5cdFx0XHRpZiAodGhpcy5fa2V5U3RhdHVzLmxhc3RLZXlQcmVzc2VkKSB7XG5cdFx0XHRcdHRoaXMuX2tleVN0YXR1cy5ldmVudCA9IGU7XG5cdFx0XHRcdHRoaXMuZmlyZSh0aGlzLl9rZXlTdGF0dXMpO1xuXHRcdFx0fVxuXHRcdH0sIHRydWUpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LCAna2V5dXAnLCBlID0+IHtcblx0XHRcdGlmIChlLmRlZmF1bHRQcmV2ZW50ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWUuYWx0S2V5ICYmIHRoaXMuX2tleVN0YXR1cy5hbHRLZXkpIHtcblx0XHRcdFx0dGhpcy5fa2V5U3RhdHVzLmxhc3RLZXlSZWxlYXNlZCA9ICdhbHQnO1xuXHRcdFx0fSBlbHNlIGlmICghZS5jdHJsS2V5ICYmIHRoaXMuX2tleVN0YXR1cy5jdHJsS2V5KSB7XG5cdFx0XHRcdHRoaXMuX2tleVN0YXR1cy5sYXN0S2V5UmVsZWFzZWQgPSAnY3RybCc7XG5cdFx0XHR9IGVsc2UgaWYgKCFlLm1ldGFLZXkgJiYgdGhpcy5fa2V5U3RhdHVzLm1ldGFLZXkpIHtcblx0XHRcdFx0dGhpcy5fa2V5U3RhdHVzLmxhc3RLZXlSZWxlYXNlZCA9ICdtZXRhJztcblx0XHRcdH0gZWxzZSBpZiAoIWUuc2hpZnRLZXkgJiYgdGhpcy5fa2V5U3RhdHVzLnNoaWZ0S2V5KSB7XG5cdFx0XHRcdHRoaXMuX2tleVN0YXR1cy5sYXN0S2V5UmVsZWFzZWQgPSAnc2hpZnQnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fa2V5U3RhdHVzLmxhc3RLZXlSZWxlYXNlZCA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2tleVN0YXR1cy5sYXN0S2V5UHJlc3NlZCAhPT0gdGhpcy5fa2V5U3RhdHVzLmxhc3RLZXlSZWxlYXNlZCkge1xuXHRcdFx0XHR0aGlzLl9rZXlTdGF0dXMubGFzdEtleVByZXNzZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2tleVN0YXR1cy5hbHRLZXkgPSBlLmFsdEtleTtcblx0XHRcdHRoaXMuX2tleVN0YXR1cy5jdHJsS2V5ID0gZS5jdHJsS2V5O1xuXHRcdFx0dGhpcy5fa2V5U3RhdHVzLm1ldGFLZXkgPSBlLm1ldGFLZXk7XG5cdFx0XHR0aGlzLl9rZXlTdGF0dXMuc2hpZnRLZXkgPSBlLnNoaWZ0S2V5O1xuXG5cdFx0XHRpZiAodGhpcy5fa2V5U3RhdHVzLmxhc3RLZXlSZWxlYXNlZCkge1xuXHRcdFx0XHR0aGlzLl9rZXlTdGF0dXMuZXZlbnQgPSBlO1xuXHRcdFx0XHR0aGlzLmZpcmUodGhpcy5fa2V5U3RhdHVzKTtcblx0XHRcdH1cblx0XHR9LCB0cnVlKSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdpbmRvdy5kb2N1bWVudC5ib2R5LCAnbW91c2Vkb3duJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5fa2V5U3RhdHVzLmxhc3RLZXlQcmVzc2VkID0gdW5kZWZpbmVkO1xuXHRcdH0sIHRydWUpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LmRvY3VtZW50LmJvZHksICdtb3VzZXVwJywgKCkgPT4ge1xuXHRcdFx0dGhpcy5fa2V5U3RhdHVzLmxhc3RLZXlQcmVzc2VkID0gdW5kZWZpbmVkO1xuXHRcdH0sIHRydWUpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LmRvY3VtZW50LmJvZHksICdtb3VzZW1vdmUnLCBlID0+IHtcblx0XHRcdGlmIChlLmJ1dHRvbnMpIHtcblx0XHRcdFx0dGhpcy5fa2V5U3RhdHVzLmxhc3RLZXlQcmVzc2VkID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0sIHRydWUpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LCAnYmx1cicsICgpID0+IHtcblx0XHRcdHRoaXMucmVzZXRLZXlTdGF0dXMoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRnZXQga2V5U3RhdHVzKCk6IElNb2RpZmllcktleVN0YXR1cyB7XG5cdFx0cmV0dXJuIHRoaXMuX2tleVN0YXR1cztcblx0fVxuXG5cdGdldCBpc01vZGlmaWVyUHJlc3NlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fa2V5U3RhdHVzLmFsdEtleSB8fCB0aGlzLl9rZXlTdGF0dXMuY3RybEtleSB8fCB0aGlzLl9rZXlTdGF0dXMubWV0YUtleSB8fCB0aGlzLl9rZXlTdGF0dXMuc2hpZnRLZXk7XG5cdH1cblxuXHQvKipcblx0ICogQWxsb3dzIHRvIGV4cGxpY2l0bHkgcmVzZXQgdGhlIGtleSBzdGF0dXMgYmFzZWQgb24gbW9yZSBrbm93bGVkZ2UgKCMxMDkwNjIpXG5cdCAqL1xuXHRyZXNldEtleVN0YXR1cygpOiB2b2lkIHtcblx0XHR0aGlzLmRvUmVzZXRLZXlTdGF0dXMoKTtcblx0XHR0aGlzLmZpcmUodGhpcy5fa2V5U3RhdHVzKTtcblx0fVxuXG5cdHByaXZhdGUgZG9SZXNldEtleVN0YXR1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9rZXlTdGF0dXMgPSB7XG5cdFx0XHRhbHRLZXk6IGZhbHNlLFxuXHRcdFx0c2hpZnRLZXk6IGZhbHNlLFxuXHRcdFx0Y3RybEtleTogZmFsc2UsXG5cdFx0XHRtZXRhS2V5OiBmYWxzZVxuXHRcdH07XG5cdH1cblxuXHRzdGF0aWMgZ2V0SW5zdGFuY2UoKSB7XG5cdFx0aWYgKCFNb2RpZmllcktleUVtaXR0ZXIuaW5zdGFuY2UpIHtcblx0XHRcdE1vZGlmaWVyS2V5RW1pdHRlci5pbnN0YW5jZSA9IG5ldyBNb2RpZmllcktleUVtaXR0ZXIoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gTW9kaWZpZXJLZXlFbWl0dGVyLmluc3RhbmNlO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fc3Vic2NyaXB0aW9ucy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvb2tpZVZhbHVlKG5hbWU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IG1hdGNoID0gZG9jdW1lbnQuY29va2llLm1hdGNoKCcoXnxbXjtdKylcXFxccyonICsgbmFtZSArICdcXFxccyo9XFxcXHMqKFteO10rKScpOyAvLyBTZWUgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzI1NDkwNTMxXG5cblx0cmV0dXJuIG1hdGNoID8gbWF0Y2gucG9wKCkgOiB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURyYWdBbmREcm9wT2JzZXJ2ZXJDYWxsYmFja3Mge1xuXHRyZWFkb25seSBvbkRyYWdFbnRlcj86IChlOiBEcmFnRXZlbnQpID0+IHZvaWQ7XG5cdHJlYWRvbmx5IG9uRHJhZ0xlYXZlPzogKGU6IERyYWdFdmVudCkgPT4gdm9pZDtcblx0cmVhZG9ubHkgb25Ecm9wPzogKGU6IERyYWdFdmVudCkgPT4gdm9pZDtcblx0cmVhZG9ubHkgb25EcmFnRW5kPzogKGU6IERyYWdFdmVudCkgPT4gdm9pZDtcblx0cmVhZG9ubHkgb25EcmFnU3RhcnQ/OiAoZTogRHJhZ0V2ZW50KSA9PiB2b2lkO1xuXHRyZWFkb25seSBvbkRyYWc/OiAoZTogRHJhZ0V2ZW50KSA9PiB2b2lkO1xuXHRyZWFkb25seSBvbkRyYWdPdmVyPzogKGU6IERyYWdFdmVudCwgZHJhZ0R1cmF0aW9uOiBudW1iZXIpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBEcmFnQW5kRHJvcE9ic2VydmVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0Ly8gQSBoZWxwZXIgdG8gZml4IGlzc3VlcyB3aXRoIHJlcGVhdGVkIERSQUdfRU5URVIgLyBEUkFHX0xFQVZFXG5cdC8vIGNhbGxzIHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTQ0NzBcblx0Ly8gd2hlbiB0aGUgZWxlbWVudCBoYXMgY2hpbGQgZWxlbWVudHMgd2hlcmUgdGhlIGV2ZW50cyBhcmUgZmlyZWRcblx0Ly8gcmVwZWFkZWRseS5cblx0cHJpdmF0ZSBjb3VudGVyOiBudW1iZXIgPSAwO1xuXG5cdC8vIEFsbG93cyB0byBtZWFzdXJlIHRoZSBkdXJhdGlvbiBvZiB0aGUgZHJhZyBvcGVyYXRpb24uXG5cdHByaXZhdGUgZHJhZ1N0YXJ0VGltZSA9IDA7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBlbGVtZW50OiBIVE1MRWxlbWVudCwgcHJpdmF0ZSByZWFkb25seSBjYWxsYmFja3M6IElEcmFnQW5kRHJvcE9ic2VydmVyQ2FsbGJhY2tzKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2FsbGJhY2tzLm9uRHJhZ1N0YXJ0KSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5lbGVtZW50LCBFdmVudFR5cGUuRFJBR19TVEFSVCwgKGU6IERyYWdFdmVudCkgPT4ge1xuXHRcdFx0XHR0aGlzLmNhbGxiYWNrcy5vbkRyYWdTdGFydD8uKGUpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNhbGxiYWNrcy5vbkRyYWcpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5EUkFHLCAoZTogRHJhZ0V2ZW50KSA9PiB7XG5cdFx0XHRcdHRoaXMuY2FsbGJhY2tzLm9uRHJhZz8uKGUpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5EUkFHX0VOVEVSLCAoZTogRHJhZ0V2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLmNvdW50ZXIrKztcblx0XHRcdHRoaXMuZHJhZ1N0YXJ0VGltZSA9IGUudGltZVN0YW1wO1xuXG5cdFx0XHR0aGlzLmNhbGxiYWNrcy5vbkRyYWdFbnRlcj8uKGUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIEV2ZW50VHlwZS5EUkFHX09WRVIsIChlOiBEcmFnRXZlbnQpID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTsgLy8gbmVlZGVkIHNvIHRoYXQgdGhlIGRyb3AgZXZlbnQgZmlyZXMgKGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzIxMzM5OTI0L2Ryb3AtZXZlbnQtbm90LWZpcmluZy1pbi1jaHJvbWUpXG5cblx0XHRcdHRoaXMuY2FsbGJhY2tzLm9uRHJhZ092ZXI/LihlLCBlLnRpbWVTdGFtcCAtIHRoaXMuZHJhZ1N0YXJ0VGltZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZWxlbWVudCwgRXZlbnRUeXBlLkRSQUdfTEVBVkUsIChlOiBEcmFnRXZlbnQpID0+IHtcblx0XHRcdHRoaXMuY291bnRlci0tO1xuXG5cdFx0XHRpZiAodGhpcy5jb3VudGVyID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuZHJhZ1N0YXJ0VGltZSA9IDA7XG5cblx0XHRcdFx0dGhpcy5jYWxsYmFja3Mub25EcmFnTGVhdmU/LihlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5lbGVtZW50LCBFdmVudFR5cGUuRFJBR19FTkQsIChlOiBEcmFnRXZlbnQpID0+IHtcblx0XHRcdHRoaXMuY291bnRlciA9IDA7XG5cdFx0XHR0aGlzLmRyYWdTdGFydFRpbWUgPSAwO1xuXG5cdFx0XHR0aGlzLmNhbGxiYWNrcy5vbkRyYWdFbmQ/LihlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5lbGVtZW50LCBFdmVudFR5cGUuRFJPUCwgKGU6IERyYWdFdmVudCkgPT4ge1xuXHRcdFx0dGhpcy5jb3VudGVyID0gMDtcblx0XHRcdHRoaXMuZHJhZ1N0YXJ0VGltZSA9IDA7XG5cblx0XHRcdHRoaXMuY2FsbGJhY2tzLm9uRHJvcD8uKGUpO1xuXHRcdH0pKTtcblx0fVxufVxuXG50eXBlIEhUTUxFbGVtZW50QXR0cmlidXRlS2V5czxUPiA9IFBhcnRpYWw8eyBbSyBpbiBrZXlvZiBUXTogVFtLXSBleHRlbmRzIEZ1bmN0aW9uID8gbmV2ZXIgOiBUW0tdIGV4dGVuZHMgb2JqZWN0ID8gSFRNTEVsZW1lbnRBdHRyaWJ1dGVLZXlzPFRbS10+IDogVFtLXSB9PjtcbnR5cGUgRWxlbWVudEF0dHJpYnV0ZXM8VD4gPSBIVE1MRWxlbWVudEF0dHJpYnV0ZUtleXM8VD4gJiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xudHlwZSBSZW1vdmVIVE1MRWxlbWVudDxUPiA9IFQgZXh0ZW5kcyBIVE1MRWxlbWVudCA/IG5ldmVyIDogVDtcbnR5cGUgVW5pb25Ub0ludGVyc2VjdGlvbjxVPiA9IChVIGV4dGVuZHMgYW55ID8gKGs6IFUpID0+IHZvaWQgOiBuZXZlcikgZXh0ZW5kcyAoKGs6IGluZmVyIEkpID0+IHZvaWQpID8gSSA6IG5ldmVyO1xudHlwZSBBcnJheVRvT2JqPFQgZXh0ZW5kcyByZWFkb25seSBhbnlbXT4gPSBVbmlvblRvSW50ZXJzZWN0aW9uPFJlbW92ZUhUTUxFbGVtZW50PFRbbnVtYmVyXT4+O1xudHlwZSBISFRNTEVsZW1lbnRUYWdOYW1lTWFwID0gSFRNTEVsZW1lbnRUYWdOYW1lTWFwICYgeyAnJzogSFRNTERpdkVsZW1lbnQgfTtcblxudHlwZSBUYWdUb0VsZW1lbnQ8VD4gPSBUIGV4dGVuZHMgYCR7aW5mZXIgVFN0YXJ0fSMke3N0cmluZ31gXG5cdD8gVFN0YXJ0IGV4dGVuZHMga2V5b2YgSEhUTUxFbGVtZW50VGFnTmFtZU1hcFxuXHQ/IEhIVE1MRWxlbWVudFRhZ05hbWVNYXBbVFN0YXJ0XVxuXHQ6IEhUTUxFbGVtZW50XG5cdDogVCBleHRlbmRzIGAke2luZmVyIFRTdGFydH0uJHtzdHJpbmd9YFxuXHQ/IFRTdGFydCBleHRlbmRzIGtleW9mIEhIVE1MRWxlbWVudFRhZ05hbWVNYXBcblx0PyBISFRNTEVsZW1lbnRUYWdOYW1lTWFwW1RTdGFydF1cblx0OiBIVE1MRWxlbWVudFxuXHQ6IFQgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVNYXBcblx0PyBIVE1MRWxlbWVudFRhZ05hbWVNYXBbVF1cblx0OiBIVE1MRWxlbWVudDtcblxudHlwZSBUYWdUb0VsZW1lbnRBbmRJZDxUVGFnPiA9IFRUYWcgZXh0ZW5kcyBgJHtpbmZlciBUVGFnfUAke2luZmVyIFRJZH1gXG5cdD8geyBlbGVtZW50OiBUYWdUb0VsZW1lbnQ8VFRhZz47IGlkOiBUSWQgfVxuXHQ6IHsgZWxlbWVudDogVGFnVG9FbGVtZW50PFRUYWc+OyBpZDogJ3Jvb3QnIH07XG5cbnR5cGUgVGFnVG9SZWNvcmQ8VFRhZz4gPSBUYWdUb0VsZW1lbnRBbmRJZDxUVGFnPiBleHRlbmRzIHsgZWxlbWVudDogaW5mZXIgVEVsZW1lbnQ7IGlkOiBpbmZlciBUSWQgfVxuXHQ/IFJlY29yZDwoVElkIGV4dGVuZHMgc3RyaW5nID8gVElkIDogbmV2ZXIpIHwgJ3Jvb3QnLCBURWxlbWVudD5cblx0OiBuZXZlcjtcblxudHlwZSBDaGlsZCA9IEhUTUxFbGVtZW50IHwgc3RyaW5nIHwgUmVjb3JkPHN0cmluZywgSFRNTEVsZW1lbnQ+O1xuXG5jb25zdCBIX1JFR0VYID0gLyg/PHRhZz5bXFx3XFwtXSspPyg/OiMoPzxpZD5bXFx3XFwtXSspKT8oPzxjbGFzcz4oPzpcXC4oPzpbXFx3XFwtXSspKSopKD86QCg/PG5hbWU+KD86W1xcd1xcX10pKykpPy87XG5cbi8qKlxuICogQSBoZWxwZXIgZnVuY3Rpb24gdG8gY3JlYXRlIG5lc3RlZCBkb20gbm9kZXMuXG4gKlxuICpcbiAqIGBgYHRzXG4gKiBjb25zdCBlbGVtZW50cyA9IGgoJ2Rpdi5jb2RlLXZpZXcnLCBbXG4gKiBcdGgoJ2Rpdi50aXRsZUB0aXRsZScpLFxuICogXHRoKCdkaXYuY29udGFpbmVyJywgW1xuICogXHRcdGgoJ2Rpdi5ndXR0ZXJAZ3V0dGVyRGl2JyksXG4gKiBcdFx0aCgnZGl2QGVkaXRvcicpLFxuICogXHRdKSxcbiAqIF0pO1xuICogY29uc3QgZWRpdG9yID0gY3JlYXRlRWRpdG9yKGVsZW1lbnRzLmVkaXRvcik7XG4gKiBgYGBcbiovXG5leHBvcnQgZnVuY3Rpb24gaDxUVGFnIGV4dGVuZHMgc3RyaW5nPlxuXHQodGFnOiBUVGFnKTpcblx0VGFnVG9SZWNvcmQ8VFRhZz4gZXh0ZW5kcyBpbmZlciBZID8geyBbVEtleSBpbiBrZXlvZiBZXTogWVtUS2V5XSB9IDogbmV2ZXI7XG5cbmV4cG9ydCBmdW5jdGlvbiBoPFRUYWcgZXh0ZW5kcyBzdHJpbmcsIFQgZXh0ZW5kcyBDaGlsZFtdPlxuXHQodGFnOiBUVGFnLCBjaGlsZHJlbjogWy4uLlRdKTpcblx0KEFycmF5VG9PYmo8VD4gJiBUYWdUb1JlY29yZDxUVGFnPikgZXh0ZW5kcyBpbmZlciBZID8geyBbVEtleSBpbiBrZXlvZiBZXTogWVtUS2V5XSB9IDogbmV2ZXI7XG5cbmV4cG9ydCBmdW5jdGlvbiBoPFRUYWcgZXh0ZW5kcyBzdHJpbmc+XG5cdCh0YWc6IFRUYWcsIGF0dHJpYnV0ZXM6IFBhcnRpYWw8RWxlbWVudEF0dHJpYnV0ZXM8VGFnVG9FbGVtZW50PFRUYWc+Pj4pOlxuXHRUYWdUb1JlY29yZDxUVGFnPiBleHRlbmRzIGluZmVyIFkgPyB7IFtUS2V5IGluIGtleW9mIFldOiBZW1RLZXldIH0gOiBuZXZlcjtcblxuZXhwb3J0IGZ1bmN0aW9uIGg8VFRhZyBleHRlbmRzIHN0cmluZywgVCBleHRlbmRzIENoaWxkW10+XG5cdCh0YWc6IFRUYWcsIGF0dHJpYnV0ZXM6IFBhcnRpYWw8RWxlbWVudEF0dHJpYnV0ZXM8VGFnVG9FbGVtZW50PFRUYWc+Pj4sIGNoaWxkcmVuOiBbLi4uVF0pOlxuXHQoQXJyYXlUb09iajxUPiAmIFRhZ1RvUmVjb3JkPFRUYWc+KSBleHRlbmRzIGluZmVyIFkgPyB7IFtUS2V5IGluIGtleW9mIFldOiBZW1RLZXldIH0gOiBuZXZlcjtcblxuZXhwb3J0IGZ1bmN0aW9uIGgodGFnOiBzdHJpbmcsIC4uLmFyZ3M6IFtdIHwgW2F0dHJpYnV0ZXM6IHsgJDogc3RyaW5nIH0gJiBQYXJ0aWFsPEVsZW1lbnRBdHRyaWJ1dGVzPEhUTUxFbGVtZW50Pj4gfCBSZWNvcmQ8c3RyaW5nLCBhbnk+LCBjaGlsZHJlbj86IGFueVtdXSB8IFtjaGlsZHJlbjogYW55W11dKTogUmVjb3JkPHN0cmluZywgSFRNTEVsZW1lbnQ+IHtcblx0bGV0IGF0dHJpYnV0ZXM6IHsgJD86IHN0cmluZyB9ICYgUGFydGlhbDxFbGVtZW50QXR0cmlidXRlczxIVE1MRWxlbWVudD4+O1xuXHRsZXQgY2hpbGRyZW46IChSZWNvcmQ8c3RyaW5nLCBIVE1MRWxlbWVudD4gfCBIVE1MRWxlbWVudClbXSB8IHVuZGVmaW5lZDtcblxuXHRpZiAoQXJyYXkuaXNBcnJheShhcmdzWzBdKSkge1xuXHRcdGF0dHJpYnV0ZXMgPSB7fTtcblx0XHRjaGlsZHJlbiA9IGFyZ3NbMF07XG5cdH0gZWxzZSB7XG5cdFx0YXR0cmlidXRlcyA9IGFyZ3NbMF0gYXMgYW55IHx8IHt9O1xuXHRcdGNoaWxkcmVuID0gYXJnc1sxXTtcblx0fVxuXG5cdGNvbnN0IG1hdGNoID0gSF9SRUdFWC5leGVjKHRhZyk7XG5cblx0aWYgKCFtYXRjaCB8fCAhbWF0Y2guZ3JvdXBzKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdCYWQgdXNlIG9mIGgnKTtcblx0fVxuXG5cdGNvbnN0IHRhZ05hbWUgPSBtYXRjaC5ncm91cHNbJ3RhZyddIHx8ICdkaXYnO1xuXHRjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG5cblx0aWYgKG1hdGNoLmdyb3Vwc1snaWQnXSkge1xuXHRcdGVsLmlkID0gbWF0Y2guZ3JvdXBzWydpZCddO1xuXHR9XG5cblx0Y29uc3QgY2xhc3NOYW1lcyA9IFtdO1xuXHRpZiAobWF0Y2guZ3JvdXBzWydjbGFzcyddKSB7XG5cdFx0Zm9yIChjb25zdCBjbGFzc05hbWUgb2YgbWF0Y2guZ3JvdXBzWydjbGFzcyddLnNwbGl0KCcuJykpIHtcblx0XHRcdGlmIChjbGFzc05hbWUgIT09ICcnKSB7XG5cdFx0XHRcdGNsYXNzTmFtZXMucHVzaChjbGFzc05hbWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRpZiAoYXR0cmlidXRlcy5jbGFzc05hbWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdGZvciAoY29uc3QgY2xhc3NOYW1lIG9mIGF0dHJpYnV0ZXMuY2xhc3NOYW1lLnNwbGl0KCcuJykpIHtcblx0XHRcdGlmIChjbGFzc05hbWUgIT09ICcnKSB7XG5cdFx0XHRcdGNsYXNzTmFtZXMucHVzaChjbGFzc05hbWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRpZiAoY2xhc3NOYW1lcy5sZW5ndGggPiAwKSB7XG5cdFx0ZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lcy5qb2luKCcgJyk7XG5cdH1cblxuXHRjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIEhUTUxFbGVtZW50PiA9IHt9O1xuXG5cdGlmIChtYXRjaC5ncm91cHNbJ25hbWUnXSkge1xuXHRcdHJlc3VsdFttYXRjaC5ncm91cHNbJ25hbWUnXV0gPSBlbDtcblx0fVxuXG5cdGlmIChjaGlsZHJlbikge1xuXHRcdGZvciAoY29uc3QgYyBvZiBjaGlsZHJlbikge1xuXHRcdFx0aWYgKGlzSFRNTEVsZW1lbnQoYykpIHtcblx0XHRcdFx0ZWwuYXBwZW5kQ2hpbGQoYyk7XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRlbC5hcHBlbmQoYyk7XG5cdFx0XHR9IGVsc2UgaWYgKCdyb290JyBpbiBjKSB7XG5cdFx0XHRcdE9iamVjdC5hc3NpZ24ocmVzdWx0LCBjKTtcblx0XHRcdFx0ZWwuYXBwZW5kQ2hpbGQoYy5yb290KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhhdHRyaWJ1dGVzKSkge1xuXHRcdGlmIChrZXkgPT09ICdjbGFzc05hbWUnKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ3N0eWxlJykge1xuXHRcdFx0Zm9yIChjb25zdCBbY3NzS2V5LCBjc3NWYWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSB7XG5cdFx0XHRcdGVsLnN0eWxlLnNldFByb3BlcnR5KFxuXHRcdFx0XHRcdGNhbWVsQ2FzZVRvSHlwaGVuQ2FzZShjc3NLZXkpLFxuXHRcdFx0XHRcdHR5cGVvZiBjc3NWYWx1ZSA9PT0gJ251bWJlcicgPyBjc3NWYWx1ZSArICdweCcgOiAnJyArIGNzc1ZhbHVlXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChrZXkgPT09ICd0YWJJbmRleCcpIHtcblx0XHRcdGVsLnRhYkluZGV4ID0gdmFsdWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVsLnNldEF0dHJpYnV0ZShjYW1lbENhc2VUb0h5cGhlbkNhc2Uoa2V5KSwgdmFsdWUudG9TdHJpbmcoKSk7XG5cdFx0fVxuXHR9XG5cblx0cmVzdWx0Wydyb290J10gPSBlbDtcblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vKiogQGRlcHJlY2F0ZWQgVGhpcyBpcyBhIGR1cGxpY2F0aW9uIG9mIHRoZSBoIGZ1bmN0aW9uLiBOZWVkcyBjbGVhbnVwLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN2Z0VsZW08VFRhZyBleHRlbmRzIHN0cmluZz5cblx0KHRhZzogVFRhZyk6XG5cdFRhZ1RvUmVjb3JkPFRUYWc+IGV4dGVuZHMgaW5mZXIgWSA/IHsgW1RLZXkgaW4ga2V5b2YgWV06IFlbVEtleV0gfSA6IG5ldmVyO1xuLyoqIEBkZXByZWNhdGVkIFRoaXMgaXMgYSBkdXBsaWNhdGlvbiBvZiB0aGUgaCBmdW5jdGlvbi4gTmVlZHMgY2xlYW51cC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdmdFbGVtPFRUYWcgZXh0ZW5kcyBzdHJpbmcsIFQgZXh0ZW5kcyBDaGlsZFtdPlxuXHQodGFnOiBUVGFnLCBjaGlsZHJlbjogWy4uLlRdKTpcblx0KEFycmF5VG9PYmo8VD4gJiBUYWdUb1JlY29yZDxUVGFnPikgZXh0ZW5kcyBpbmZlciBZID8geyBbVEtleSBpbiBrZXlvZiBZXTogWVtUS2V5XSB9IDogbmV2ZXI7XG4vKiogQGRlcHJlY2F0ZWQgVGhpcyBpcyBhIGR1cGxpY2F0aW9uIG9mIHRoZSBoIGZ1bmN0aW9uLiBOZWVkcyBjbGVhbnVwLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN2Z0VsZW08VFRhZyBleHRlbmRzIHN0cmluZz5cblx0KHRhZzogVFRhZywgYXR0cmlidXRlczogUGFydGlhbDxFbGVtZW50QXR0cmlidXRlczxUYWdUb0VsZW1lbnQ8VFRhZz4+Pik6XG5cdFRhZ1RvUmVjb3JkPFRUYWc+IGV4dGVuZHMgaW5mZXIgWSA/IHsgW1RLZXkgaW4ga2V5b2YgWV06IFlbVEtleV0gfSA6IG5ldmVyO1xuLyoqIEBkZXByZWNhdGVkIFRoaXMgaXMgYSBkdXBsaWNhdGlvbiBvZiB0aGUgaCBmdW5jdGlvbi4gTmVlZHMgY2xlYW51cC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdmdFbGVtPFRUYWcgZXh0ZW5kcyBzdHJpbmcsIFQgZXh0ZW5kcyBDaGlsZFtdPlxuXHQodGFnOiBUVGFnLCBhdHRyaWJ1dGVzOiBQYXJ0aWFsPEVsZW1lbnRBdHRyaWJ1dGVzPFRhZ1RvRWxlbWVudDxUVGFnPj4+LCBjaGlsZHJlbjogWy4uLlRdKTpcblx0KEFycmF5VG9PYmo8VD4gJiBUYWdUb1JlY29yZDxUVGFnPikgZXh0ZW5kcyBpbmZlciBZID8geyBbVEtleSBpbiBrZXlvZiBZXTogWVtUS2V5XSB9IDogbmV2ZXI7XG4vKiogQGRlcHJlY2F0ZWQgVGhpcyBpcyBhIGR1cGxpY2F0aW9uIG9mIHRoZSBoIGZ1bmN0aW9uLiBOZWVkcyBjbGVhbnVwLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN2Z0VsZW0odGFnOiBzdHJpbmcsIC4uLmFyZ3M6IFtdIHwgW2F0dHJpYnV0ZXM6IHsgJDogc3RyaW5nIH0gJiBQYXJ0aWFsPEVsZW1lbnRBdHRyaWJ1dGVzPEhUTUxFbGVtZW50Pj4gfCBSZWNvcmQ8c3RyaW5nLCBhbnk+LCBjaGlsZHJlbj86IGFueVtdXSB8IFtjaGlsZHJlbjogYW55W11dKTogUmVjb3JkPHN0cmluZywgSFRNTEVsZW1lbnQ+IHtcblx0bGV0IGF0dHJpYnV0ZXM6IHsgJD86IHN0cmluZyB9ICYgUGFydGlhbDxFbGVtZW50QXR0cmlidXRlczxIVE1MRWxlbWVudD4+O1xuXHRsZXQgY2hpbGRyZW46IChSZWNvcmQ8c3RyaW5nLCBIVE1MRWxlbWVudD4gfCBIVE1MRWxlbWVudClbXSB8IHVuZGVmaW5lZDtcblxuXHRpZiAoQXJyYXkuaXNBcnJheShhcmdzWzBdKSkge1xuXHRcdGF0dHJpYnV0ZXMgPSB7fTtcblx0XHRjaGlsZHJlbiA9IGFyZ3NbMF07XG5cdH0gZWxzZSB7XG5cdFx0YXR0cmlidXRlcyA9IGFyZ3NbMF0gYXMgYW55IHx8IHt9O1xuXHRcdGNoaWxkcmVuID0gYXJnc1sxXTtcblx0fVxuXG5cdGNvbnN0IG1hdGNoID0gSF9SRUdFWC5leGVjKHRhZyk7XG5cblx0aWYgKCFtYXRjaCB8fCAhbWF0Y2guZ3JvdXBzKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdCYWQgdXNlIG9mIGgnKTtcblx0fVxuXG5cdGNvbnN0IHRhZ05hbWUgPSBtYXRjaC5ncm91cHNbJ3RhZyddIHx8ICdkaXYnO1xuXHRjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCB0YWdOYW1lKSBhcyBhbnkgYXMgSFRNTEVsZW1lbnQ7XG5cblx0aWYgKG1hdGNoLmdyb3Vwc1snaWQnXSkge1xuXHRcdGVsLmlkID0gbWF0Y2guZ3JvdXBzWydpZCddO1xuXHR9XG5cblx0Y29uc3QgY2xhc3NOYW1lcyA9IFtdO1xuXHRpZiAobWF0Y2guZ3JvdXBzWydjbGFzcyddKSB7XG5cdFx0Zm9yIChjb25zdCBjbGFzc05hbWUgb2YgbWF0Y2guZ3JvdXBzWydjbGFzcyddLnNwbGl0KCcuJykpIHtcblx0XHRcdGlmIChjbGFzc05hbWUgIT09ICcnKSB7XG5cdFx0XHRcdGNsYXNzTmFtZXMucHVzaChjbGFzc05hbWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRpZiAoYXR0cmlidXRlcy5jbGFzc05hbWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdGZvciAoY29uc3QgY2xhc3NOYW1lIG9mIGF0dHJpYnV0ZXMuY2xhc3NOYW1lLnNwbGl0KCcuJykpIHtcblx0XHRcdGlmIChjbGFzc05hbWUgIT09ICcnKSB7XG5cdFx0XHRcdGNsYXNzTmFtZXMucHVzaChjbGFzc05hbWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRpZiAoY2xhc3NOYW1lcy5sZW5ndGggPiAwKSB7XG5cdFx0ZWwuY2xhc3NOYW1lID0gY2xhc3NOYW1lcy5qb2luKCcgJyk7XG5cdH1cblxuXHRjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIEhUTUxFbGVtZW50PiA9IHt9O1xuXG5cdGlmIChtYXRjaC5ncm91cHNbJ25hbWUnXSkge1xuXHRcdHJlc3VsdFttYXRjaC5ncm91cHNbJ25hbWUnXV0gPSBlbDtcblx0fVxuXG5cdGlmIChjaGlsZHJlbikge1xuXHRcdGZvciAoY29uc3QgYyBvZiBjaGlsZHJlbikge1xuXHRcdFx0aWYgKGlzSFRNTEVsZW1lbnQoYykpIHtcblx0XHRcdFx0ZWwuYXBwZW5kQ2hpbGQoYyk7XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRlbC5hcHBlbmQoYyk7XG5cdFx0XHR9IGVsc2UgaWYgKCdyb290JyBpbiBjKSB7XG5cdFx0XHRcdE9iamVjdC5hc3NpZ24ocmVzdWx0LCBjKTtcblx0XHRcdFx0ZWwuYXBwZW5kQ2hpbGQoYy5yb290KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhhdHRyaWJ1dGVzKSkge1xuXHRcdGlmIChrZXkgPT09ICdjbGFzc05hbWUnKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ3N0eWxlJykge1xuXHRcdFx0Zm9yIChjb25zdCBbY3NzS2V5LCBjc3NWYWx1ZV0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSB7XG5cdFx0XHRcdGVsLnN0eWxlLnNldFByb3BlcnR5KFxuXHRcdFx0XHRcdGNhbWVsQ2FzZVRvSHlwaGVuQ2FzZShjc3NLZXkpLFxuXHRcdFx0XHRcdHR5cGVvZiBjc3NWYWx1ZSA9PT0gJ251bWJlcicgPyBjc3NWYWx1ZSArICdweCcgOiAnJyArIGNzc1ZhbHVlXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChrZXkgPT09ICd0YWJJbmRleCcpIHtcblx0XHRcdGVsLnRhYkluZGV4ID0gdmFsdWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVsLnNldEF0dHJpYnV0ZShjYW1lbENhc2VUb0h5cGhlbkNhc2Uoa2V5KSwgdmFsdWUudG9TdHJpbmcoKSk7XG5cdFx0fVxuXHR9XG5cblx0cmVzdWx0Wydyb290J10gPSBlbDtcblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBjYW1lbENhc2VUb0h5cGhlbkNhc2Uoc3RyOiBzdHJpbmcpIHtcblx0cmV0dXJuIHN0ci5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEtJDInKS50b0xvd2VyQ2FzZSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29weUF0dHJpYnV0ZXMoZnJvbTogRWxlbWVudCwgdG86IEVsZW1lbnQsIGZpbHRlcj86IHN0cmluZ1tdKTogdm9pZCB7XG5cdGZvciAoY29uc3QgeyBuYW1lLCB2YWx1ZSB9IG9mIGZyb20uYXR0cmlidXRlcykge1xuXHRcdGlmICghZmlsdGVyIHx8IGZpbHRlci5pbmNsdWRlcyhuYW1lKSkge1xuXHRcdFx0dG8uc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gY29weUF0dHJpYnV0ZShmcm9tOiBFbGVtZW50LCB0bzogRWxlbWVudCwgbmFtZTogc3RyaW5nKTogdm9pZCB7XG5cdGNvbnN0IHZhbHVlID0gZnJvbS5nZXRBdHRyaWJ1dGUobmFtZSk7XG5cdGlmICh2YWx1ZSkge1xuXHRcdHRvLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG5cdH0gZWxzZSB7XG5cdFx0dG8ucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFja0F0dHJpYnV0ZXMoZnJvbTogRWxlbWVudCwgdG86IEVsZW1lbnQsIGZpbHRlcj86IHN0cmluZ1tdKTogSURpc3Bvc2FibGUge1xuXHRjb3B5QXR0cmlidXRlcyhmcm9tLCB0bywgZmlsdGVyKTtcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRkaXNwb3NhYmxlcy5hZGQoc2hhcmVkTXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKGZyb20sIGRpc3Bvc2FibGVzLCB7IGF0dHJpYnV0ZXM6IHRydWUsIGF0dHJpYnV0ZUZpbHRlcjogZmlsdGVyIH0pKG11dGF0aW9ucyA9PiB7XG5cdFx0Zm9yIChjb25zdCBtdXRhdGlvbiBvZiBtdXRhdGlvbnMpIHtcblx0XHRcdGlmIChtdXRhdGlvbi50eXBlID09PSAnYXR0cmlidXRlcycgJiYgbXV0YXRpb24uYXR0cmlidXRlTmFtZSkge1xuXHRcdFx0XHRjb3B5QXR0cmlidXRlKGZyb20sIHRvLCBtdXRhdGlvbi5hdHRyaWJ1dGVOYW1lKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pKTtcblxuXHRyZXR1cm4gZGlzcG9zYWJsZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VkaXRhYmxlRWxlbWVudChlbGVtZW50OiBFbGVtZW50KTogYm9vbGVhbiB7XG5cdHJldHVybiBlbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2lucHV0JyB8fCBlbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3RleHRhcmVhJyB8fCBpc0hUTUxFbGVtZW50KGVsZW1lbnQpICYmICEhZWxlbWVudC5lZGl0Q29udGV4dDtcbn1cblxuLyoqXG4gKiBIZWxwZXIgZm9yIGNhbGN1bGF0aW5nIHRoZSBcInNhZmUgdHJpYW5nbGVcIiBvY2NsdWRlZCBieSBob3ZlcnMgdG8gYXZvaWQgZWFybHkgZGlzbWlzc2FsLlxuICogQHNlZSBodHRwczovL3d3dy5zbWFzaGluZ21hZ2F6aW5lLmNvbS8yMDIzLzA4L2JldHRlci1jb250ZXh0LW1lbnVzLXNhZmUtdHJpYW5nbGVzLyBmb3IgZXhhbXBsZVxuICovXG5leHBvcnQgY2xhc3MgU2FmZVRyaWFuZ2xlIHtcblx0Ly8gNCBwb2ludHMgKHgsIHkpLCA4IGxlbmd0aFxuXHRwcml2YXRlIHBvaW50cyA9IG5ldyBJbnQxNkFycmF5KDgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3JpZ2luWDogbnVtYmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3JpZ2luWTogbnVtYmVyLFxuXHRcdHRhcmdldDogSFRNTEVsZW1lbnRcblx0KSB7XG5cdFx0Y29uc3QgeyB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20gfSA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRjb25zdCB0ID0gdGhpcy5wb2ludHM7XG5cdFx0bGV0IGkgPSAwO1xuXG5cdFx0dFtpKytdID0gbGVmdDtcblx0XHR0W2krK10gPSB0b3A7XG5cblx0XHR0W2krK10gPSByaWdodDtcblx0XHR0W2krK10gPSB0b3A7XG5cblx0XHR0W2krK10gPSBsZWZ0O1xuXHRcdHRbaSsrXSA9IGJvdHRvbTtcblxuXHRcdHRbaSsrXSA9IHJpZ2h0O1xuXHRcdHRbaSsrXSA9IGJvdHRvbTtcblx0fVxuXG5cdHB1YmxpYyBjb250YWlucyh4OiBudW1iZXIsIHk6IG51bWJlcikge1xuXHRcdGNvbnN0IHsgcG9pbnRzLCBvcmlnaW5YLCBvcmlnaW5ZIH0gPSB0aGlzO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNDsgaSsrKSB7XG5cdFx0XHRjb25zdCBwMSA9IDIgKiBpO1xuXHRcdFx0Y29uc3QgcDIgPSAyICogKChpICsgMSkgJSA0KTtcblx0XHRcdGlmIChpc1BvaW50V2l0aGluVHJpYW5nbGUoeCwgeSwgb3JpZ2luWCwgb3JpZ2luWSwgcG9pbnRzW3AxXSwgcG9pbnRzW3AxICsgMV0sIHBvaW50c1twMl0sIHBvaW50c1twMiArIDFdKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksYUFBYTtBQUN6QixTQUFTLHVCQUF1QjtBQUNoQyxTQUF5Qiw2QkFBNkI7QUFDdEQsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsbUJBQW1CLGVBQWUsY0FBYyxvQkFBa0M7QUFDM0YsU0FBUyx5QkFBeUI7QUFDbEMsWUFBWSxXQUFXO0FBQ3ZCLE9BQU8sZUFBZTtBQUN0QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLGlCQUE4QixvQkFBb0I7QUFDdkUsU0FBUyxtQkFBbUIsZUFBZTtBQUMzQyxZQUFZLGNBQWM7QUFDMUIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsWUFBWTtBQUNyQixTQUFxQixrQkFBa0Isa0JBQWtCO0FBQ3pELFNBQVMsNkJBQTZCO0FBQ3RDLGNBQWM7QUFDZCxjQUFjO0FBU1AsTUFBTTtBQUFBLEVBQ1o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0QsSUFBSyxXQUFZO0FBQ2hCLFFBQU0sVUFBVSxvQkFBSSxJQUFtQztBQUV2RCxtQkFBaUIsWUFBWSxDQUFDO0FBQzlCLFFBQU0s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LFFBQVEsU0FBUyxRQUFRLElBQUk7QUFDckMsYUFBUyxJQUFJLEdBQUcsSUFBSSxHQUFHLEtBQUs7QUFDM0IsWUFBTSxLQUFLLElBQUk7QUFDZixZQUFNLEtBQUssTUFBTSxJQUFJLEtBQUs7QUFDMUIsVUFBSSxzQkFBc0IsR0FBRyxHQUFHLFNBQVMsU0FBUyxPQUFPLEVBQUUsR0FBRyxPQUFPLEtBQUssQ0FBQyxHQUFHLE9BQU8sRUFBRSxHQUFHLE9BQU8sS0FBSyxDQUFDLENBQUMsR0FBRztBQUMxRyxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUNEOyIsCiAgIm5hbWVzIjogWyJvbkRpZFJlZ2lzdGVyV2luZG93IiwgIm9uRGlkVW5yZWdpc3RlcldpbmRvdyIsICJvbldpbGxVbnJlZ2lzdGVyV2luZG93IiwgImdldFdpbmRvd0J5SWQiLCAiYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIiLCAicG9zaXRpb24iLCAiZG9jdW1lbnQiLCAiTmFtZXNwYWNlIiwgIkRldGVjdGVkRnVsbHNjcmVlbk1vZGUiLCAiZXZlbnQiXQp9Cg==
