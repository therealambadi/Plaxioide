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
import "./hover.css";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../base/common/event.js";
import * as dom from "../../../../base/browser/dom.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { EDITOR_FONT_DEFAULTS } from "../../../common/config/editorOptions.js";
import { HoverAction, HoverPosition, HoverWidget as BaseHoverWidget, getHoverAccessibleViewHint } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { Widget } from "../../../../base/browser/ui/widget.js";
import { AnchorPosition } from "../../../../base/browser/ui/contextview/contextview.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { MarkdownRenderer, openLinkFromMarkdown } from "../../widget/markdownRenderer/browser/markdownRenderer.js";
import { isMarkdownString } from "../../../../base/common/htmlContent.js";
import { localize } from "../../../../nls.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { TimeoutTimer } from "../../../../base/common/async.js";
import { isNumber } from "../../../../base/common/types.js";
const $ = dom.$;
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["PointerSize"] = 3] = "PointerSize";
  Constants2[Constants2["HoverBorderWidth"] = 2] = "HoverBorderWidth";
  Constants2[Constants2["HoverWindowEdgeMargin"] = 2] = "HoverWindowEdgeMargin";
  return Constants2;
})(Constants || {});
let HoverWidget = class extends Widget {
  constructor(options, _keybindingService, _configurationService, _openerService, _instantiationService, _accessibilityService) {
    super();
    this._keybindingService = _keybindingService;
    this._configurationService = _configurationService;
    this._openerService = _openerService;
    this._instantiationService = _instantiationService;
    this._accessibilityService = _accessibilityService;
    this._messageListeners = new DisposableStore();
    this._isDisposed = false;
    this._forcePosition = false;
    this._x = 0;
    this._y = 0;
    this._isLocked = false;
    this._enableFocusTraps = false;
    this._addedFocusTrap = false;
    this._onDispose = this._register(new Emitter());
    this._onRequestLayout = this._register(new Emitter());
    this._linkHandler = options.linkHandler || ((url) => {
      return openLinkFromMarkdown(this._openerService, url, isMarkdownString(options.content) ? options.content.isTrusted : void 0);
    });
    this._target = "targetElements" in options.target ? options.target : new ElementHoverTarget(options.target);
    this._hoverPointer = options.appearance?.showPointer ? $("div.workbench-hover-pointer") : void 0;
    this._hover = this._register(new BaseHoverWidget(!options.appearance?.skipFadeInAnimation));
    this._hover.containerDomNode.classList.add("workbench-hover");
    if (options.appearance?.compact) {
      this._hover.containerDomNode.classList.add("workbench-hover", "compact");
    }
    if (options.additionalClasses) {
      this._hover.containerDomNode.classList.add(...options.additionalClasses);
    }
    if (options.position?.forcePosition) {
      this._forcePosition = true;
    }
    if (options.trapFocus) {
      this._enableFocusTraps = true;
    }
    this._hoverPosition = options.position?.hoverPosition === void 0 ? HoverPosition.ABOVE : isNumber(options.position.hoverPosition) ? options.position.hoverPosition : HoverPosition.BELOW;
    this.onmousedown(this._hover.containerDomNode, (e) => e.stopPropagation());
    this.onkeydown(this._hover.containerDomNode, (e) => {
      if (e.equals(KeyCode.Escape)) {
        this.dispose();
      }
    });
    this._register(dom.addDisposableListener(this._targetWindow, "blur", () => this.dispose()));
    const rowElement = $("div.hover-row.markdown-hover");
    const contentsElement = $("div.hover-contents");
    if (typeof options.content === "string") {
      contentsElement.textContent = options.content;
      contentsElement.style.whiteSpace = "pre-wrap";
    } else if (dom.isHTMLElement(options.content)) {
      contentsElement.appendChild(options.content);
      contentsElement.classList.add("html-hover-contents");
    } else {
      const markdown = options.content;
      const mdRenderer = this._instantiationService.createInstance(
        MarkdownRenderer,
        { codeBlockFontFamily: this._configurationService.getValue("editor").fontFamily || EDITOR_FONT_DEFAULTS.fontFamily }
      );
      const { element, dispose } = mdRenderer.render(markdown, {
        actionHandler: {
          callback: (content) => this._linkHandler(content),
          disposables: this._messageListeners
        },
        asyncRenderCallback: () => {
          contentsElement.classList.add("code-hover-contents");
          this.layout();
          this._onRequestLayout.fire();
        }
      });
      contentsElement.appendChild(element);
      this._register(toDisposable(dispose));
    }
    rowElement.appendChild(contentsElement);
    this._hover.contentsDomNode.appendChild(rowElement);
    if (options.actions && options.actions.length > 0) {
      const statusBarElement = $("div.hover-row.status-bar");
      const actionsElement = $("div.actions");
      options.actions.forEach((action) => {
        const keybinding = this._keybindingService.lookupKeybinding(action.commandId);
        const keybindingLabel = keybinding ? keybinding.getLabel() : null;
        this._register(HoverAction.render(actionsElement, {
          label: action.label,
          commandId: action.commandId,
          run: (e) => {
            action.run(e);
            this.dispose();
          },
          iconClass: action.iconClass
        }, keybindingLabel));
      });
      statusBarElement.appendChild(actionsElement);
      this._hover.containerDomNode.appendChild(statusBarElement);
    }
    this._hoverContainer = $("div.workbench-hover-container");
    if (this._hoverPointer) {
      this._hoverContainer.appendChild(this._hoverPointer);
    }
    this._hoverContainer.appendChild(this._hover.containerDomNode);
    let hideOnHover;
    if (options.actions && options.actions.length > 0) {
      hideOnHover = false;
    } else {
      if (options.persistence?.hideOnHover === void 0) {
        hideOnHover = typeof options.content === "string" || isMarkdownString(options.content) && !options.content.value.includes("](") && !options.content.value.includes("</a>");
      } else {
        hideOnHover = options.persistence.hideOnHover;
      }
    }
    if (options.appearance?.showHoverHint) {
      const statusBarElement = $("div.hover-row.status-bar");
      const infoElement = $("div.info");
      infoElement.textContent = localize("hoverhint", "Hold {0} key to mouse over", isMacintosh ? "Option" : "Alt");
      statusBarElement.appendChild(infoElement);
      this._hover.containerDomNode.appendChild(statusBarElement);
    }
    const mouseTrackerTargets = [...this._target.targetElements];
    if (!hideOnHover) {
      mouseTrackerTargets.push(this._hoverContainer);
    }
    const mouseTracker = this._register(new CompositeMouseTracker(mouseTrackerTargets));
    this._register(mouseTracker.onMouseOut(() => {
      if (!this._isLocked) {
        this.dispose();
      }
    }));
    if (hideOnHover) {
      const mouseTracker2Targets = [...this._target.targetElements, this._hoverContainer];
      this._lockMouseTracker = this._register(new CompositeMouseTracker(mouseTracker2Targets));
      this._register(this._lockMouseTracker.onMouseOut(() => {
        if (!this._isLocked) {
          this.dispose();
        }
      }));
    } else {
      this._lockMouseTracker = mouseTracker;
    }
  }
  get _targetWindow() {
    return dom.getWindow(this._target.targetElements[0]);
  }
  get _targetDocumentElement() {
    return dom.getWindow(this._target.targetElements[0]).document.documentElement;
  }
  get isDisposed() {
    return this._isDisposed;
  }
  get isMouseIn() {
    return this._lockMouseTracker.isMouseIn;
  }
  get domNode() {
    return this._hover.containerDomNode;
  }
  get onDispose() {
    return this._onDispose.event;
  }
  get onRequestLayout() {
    return this._onRequestLayout.event;
  }
  get anchor() {
    return this._hoverPosition === HoverPosition.BELOW ? AnchorPosition.BELOW : AnchorPosition.ABOVE;
  }
  get x() {
    return this._x;
  }
  get y() {
    return this._y;
  }
  /**
   * Whether the hover is "locked" by holding the alt/option key. When locked, the hover will not
   * hide and can be hovered regardless of whether the `hideOnHover` hover option is set.
   */
  get isLocked() {
    return this._isLocked;
  }
  set isLocked(value) {
    if (this._isLocked === value) {
      return;
    }
    this._isLocked = value;
    this._hoverContainer.classList.toggle("locked", this._isLocked);
  }
  addFocusTrap() {
    if (!this._enableFocusTraps || this._addedFocusTrap) {
      return;
    }
    this._addedFocusTrap = true;
    const firstContainerFocusElement = this._hover.containerDomNode;
    const lastContainerFocusElement = this.findLastFocusableChild(this._hover.containerDomNode);
    if (lastContainerFocusElement) {
      const beforeContainerFocusElement = dom.prepend(this._hoverContainer, $("div"));
      const afterContainerFocusElement = dom.append(this._hoverContainer, $("div"));
      beforeContainerFocusElement.tabIndex = 0;
      afterContainerFocusElement.tabIndex = 0;
      this._register(dom.addDisposableListener(afterContainerFocusElement, "focus", (e) => {
        firstContainerFocusElement.focus();
        e.preventDefault();
      }));
      this._register(dom.addDisposableListener(beforeContainerFocusElement, "focus", (e) => {
        lastContainerFocusElement.focus();
        e.preventDefault();
      }));
    }
  }
  findLastFocusableChild(root) {
    if (root.hasChildNodes()) {
      for (let i = 0; i < root.childNodes.length; i++) {
        const node = root.childNodes.item(root.childNodes.length - i - 1);
        if (node.nodeType === node.ELEMENT_NODE) {
          const parsedNode = node;
          if (typeof parsedNode.tabIndex === "number" && parsedNode.tabIndex >= 0) {
            return parsedNode;
          }
        }
        const recursivelyFoundElement = this.findLastFocusableChild(node);
        if (recursivelyFoundElement) {
          return recursivelyFoundElement;
        }
      }
    }
    return void 0;
  }
  render(container) {
    container.appendChild(this._hoverContainer);
    const hoverFocused = this._hoverContainer.contains(this._hoverContainer.ownerDocument.activeElement);
    const accessibleViewHint = hoverFocused && getHoverAccessibleViewHint(this._configurationService.getValue("accessibility.verbosity.hover") === true && this._accessibilityService.isScreenReaderOptimized(), this._keybindingService.lookupKeybinding("editor.action.accessibleView")?.getAriaLabel());
    if (accessibleViewHint) {
      status(accessibleViewHint);
    }
    this.layout();
    this.addFocusTrap();
  }
  layout() {
    this._hover.containerDomNode.classList.remove("right-aligned");
    this._hover.contentsDomNode.style.maxHeight = "";
    const getZoomAccountedBoundingClientRect = (e) => {
      const zoom = dom.getDomNodeZoomLevel(e);
      const boundingRect = e.getBoundingClientRect();
      return {
        top: boundingRect.top * zoom,
        bottom: boundingRect.bottom * zoom,
        right: boundingRect.right * zoom,
        left: boundingRect.left * zoom
      };
    };
    const targetBounds = this._target.targetElements.map((e) => getZoomAccountedBoundingClientRect(e));
    const { top, right, bottom, left } = targetBounds[0];
    const width = right - left;
    const height = bottom - top;
    const targetRect = {
      top,
      right,
      bottom,
      left,
      width,
      height,
      center: {
        x: left + width / 2,
        y: top + height / 2
      }
    };
    this.adjustHorizontalHoverPosition(targetRect);
    this.adjustVerticalHoverPosition(targetRect);
    this.adjustHoverMaxHeight(targetRect);
    this._hoverContainer.style.padding = "";
    this._hoverContainer.style.margin = "";
    if (this._hoverPointer) {
      switch (this._hoverPosition) {
        case HoverPosition.RIGHT:
          targetRect.left += 3 /* PointerSize */;
          targetRect.right += 3 /* PointerSize */;
          this._hoverContainer.style.paddingLeft = `${3 /* PointerSize */}px`;
          this._hoverContainer.style.marginLeft = `${-3}px`;
          break;
        case HoverPosition.LEFT:
          targetRect.left -= 3 /* PointerSize */;
          targetRect.right -= 3 /* PointerSize */;
          this._hoverContainer.style.paddingRight = `${3 /* PointerSize */}px`;
          this._hoverContainer.style.marginRight = `${-3}px`;
          break;
        case HoverPosition.BELOW:
          targetRect.top += 3 /* PointerSize */;
          targetRect.bottom += 3 /* PointerSize */;
          this._hoverContainer.style.paddingTop = `${3 /* PointerSize */}px`;
          this._hoverContainer.style.marginTop = `${-3}px`;
          break;
        case HoverPosition.ABOVE:
          targetRect.top -= 3 /* PointerSize */;
          targetRect.bottom -= 3 /* PointerSize */;
          this._hoverContainer.style.paddingBottom = `${3 /* PointerSize */}px`;
          this._hoverContainer.style.marginBottom = `${-3}px`;
          break;
      }
      targetRect.center.x = targetRect.left + width / 2;
      targetRect.center.y = targetRect.top + height / 2;
    }
    this.computeXCordinate(targetRect);
    this.computeYCordinate(targetRect);
    if (this._hoverPointer) {
      this._hoverPointer.classList.remove("top");
      this._hoverPointer.classList.remove("left");
      this._hoverPointer.classList.remove("right");
      this._hoverPointer.classList.remove("bottom");
      this.setHoverPointerPosition(targetRect);
    }
    this._hover.onContentsChanged();
  }
  computeXCordinate(target) {
    const hoverWidth = this._hover.containerDomNode.clientWidth + 2 /* HoverBorderWidth */;
    if (this._target.x !== void 0) {
      this._x = this._target.x;
    } else if (this._hoverPosition === HoverPosition.RIGHT) {
      this._x = target.right;
    } else if (this._hoverPosition === HoverPosition.LEFT) {
      this._x = target.left - hoverWidth;
    } else {
      if (this._hoverPointer) {
        this._x = target.center.x - this._hover.containerDomNode.clientWidth / 2;
      } else {
        this._x = target.left;
      }
      if (this._x + hoverWidth >= this._targetDocumentElement.clientWidth) {
        this._hover.containerDomNode.classList.add("right-aligned");
        this._x = Math.max(this._targetDocumentElement.clientWidth - hoverWidth - 2 /* HoverWindowEdgeMargin */, this._targetDocumentElement.clientLeft);
      }
    }
    if (this._x < this._targetDocumentElement.clientLeft) {
      this._x = target.left + 2 /* HoverWindowEdgeMargin */;
    }
  }
  computeYCordinate(target) {
    if (this._target.y !== void 0) {
      this._y = this._target.y;
    } else if (this._hoverPosition === HoverPosition.ABOVE) {
      this._y = target.top;
    } else if (this._hoverPosition === HoverPosition.BELOW) {
      this._y = target.bottom - 2;
    } else {
      if (this._hoverPointer) {
        this._y = target.center.y + this._hover.containerDomNode.clientHeight / 2;
      } else {
        this._y = target.bottom;
      }
    }
    if (this._y > this._targetWindow.innerHeight) {
      this._y = target.bottom;
    }
  }
  adjustHorizontalHoverPosition(target) {
    if (this._target.x !== void 0) {
      return;
    }
    const hoverPointerOffset = this._hoverPointer ? 3 /* PointerSize */ : 0;
    if (this._forcePosition) {
      const padding = hoverPointerOffset + 2 /* HoverBorderWidth */;
      if (this._hoverPosition === HoverPosition.RIGHT) {
        this._hover.containerDomNode.style.maxWidth = `${this._targetDocumentElement.clientWidth - target.right - padding}px`;
      } else if (this._hoverPosition === HoverPosition.LEFT) {
        this._hover.containerDomNode.style.maxWidth = `${target.left - padding}px`;
      }
      return;
    }
    if (this._hoverPosition === HoverPosition.RIGHT) {
      const roomOnRight = this._targetDocumentElement.clientWidth - target.right;
      if (roomOnRight < this._hover.containerDomNode.clientWidth + hoverPointerOffset) {
        const roomOnLeft = target.left;
        if (roomOnLeft >= this._hover.containerDomNode.clientWidth + hoverPointerOffset) {
          this._hoverPosition = HoverPosition.LEFT;
        } else {
          this._hoverPosition = HoverPosition.BELOW;
        }
      }
    } else if (this._hoverPosition === HoverPosition.LEFT) {
      const roomOnLeft = target.left;
      if (roomOnLeft < this._hover.containerDomNode.clientWidth + hoverPointerOffset) {
        const roomOnRight = this._targetDocumentElement.clientWidth - target.right;
        if (roomOnRight >= this._hover.containerDomNode.clientWidth + hoverPointerOffset) {
          this._hoverPosition = HoverPosition.RIGHT;
        } else {
          this._hoverPosition = HoverPosition.BELOW;
        }
      }
      if (target.left - this._hover.containerDomNode.clientWidth - hoverPointerOffset <= this._targetDocumentElement.clientLeft) {
        this._hoverPosition = HoverPosition.RIGHT;
      }
    }
  }
  adjustVerticalHoverPosition(target) {
    if (this._target.y !== void 0 || this._forcePosition) {
      return;
    }
    const hoverPointerOffset = this._hoverPointer ? 3 /* PointerSize */ : 0;
    if (this._hoverPosition === HoverPosition.ABOVE) {
      if (target.top - this._hover.containerDomNode.clientHeight - hoverPointerOffset < 0) {
        this._hoverPosition = HoverPosition.BELOW;
      }
    } else if (this._hoverPosition === HoverPosition.BELOW) {
      if (target.bottom + this._hover.containerDomNode.clientHeight + hoverPointerOffset > this._targetWindow.innerHeight) {
        this._hoverPosition = HoverPosition.ABOVE;
      }
    }
  }
  adjustHoverMaxHeight(target) {
    let maxHeight = this._targetWindow.innerHeight / 2;
    if (this._forcePosition) {
      const padding = (this._hoverPointer ? 3 /* PointerSize */ : 0) + 2 /* HoverBorderWidth */;
      if (this._hoverPosition === HoverPosition.ABOVE) {
        maxHeight = Math.min(maxHeight, target.top - padding);
      } else if (this._hoverPosition === HoverPosition.BELOW) {
        maxHeight = Math.min(maxHeight, this._targetWindow.innerHeight - target.bottom - padding);
      }
    }
    this._hover.containerDomNode.style.maxHeight = `${maxHeight}px`;
    if (this._hover.contentsDomNode.clientHeight < this._hover.contentsDomNode.scrollHeight) {
      const extraRightPadding = `${this._hover.scrollbar.options.verticalScrollbarSize}px`;
      if (this._hover.contentsDomNode.style.paddingRight !== extraRightPadding) {
        this._hover.contentsDomNode.style.paddingRight = extraRightPadding;
      }
    }
  }
  setHoverPointerPosition(target) {
    if (!this._hoverPointer) {
      return;
    }
    switch (this._hoverPosition) {
      case HoverPosition.LEFT:
      case HoverPosition.RIGHT: {
        this._hoverPointer.classList.add(this._hoverPosition === HoverPosition.LEFT ? "right" : "left");
        const hoverHeight = this._hover.containerDomNode.clientHeight;
        if (hoverHeight > target.height) {
          this._hoverPointer.style.top = `${target.center.y - (this._y - hoverHeight) - 3 /* PointerSize */}px`;
        } else {
          this._hoverPointer.style.top = `${Math.round(hoverHeight / 2) - 3 /* PointerSize */}px`;
        }
        break;
      }
      case HoverPosition.ABOVE:
      case HoverPosition.BELOW: {
        this._hoverPointer.classList.add(this._hoverPosition === HoverPosition.ABOVE ? "bottom" : "top");
        const hoverWidth = this._hover.containerDomNode.clientWidth;
        let pointerLeftPosition = Math.round(hoverWidth / 2) - 3 /* PointerSize */;
        const pointerX = this._x + pointerLeftPosition;
        if (pointerX < target.left || pointerX > target.right) {
          pointerLeftPosition = target.center.x - this._x - 3 /* PointerSize */;
        }
        this._hoverPointer.style.left = `${pointerLeftPosition}px`;
        break;
      }
    }
  }
  focus() {
    this._hover.containerDomNode.focus();
  }
  hide() {
    this.dispose();
  }
  dispose() {
    if (!this._isDisposed) {
      this._onDispose.fire();
      this._target.dispose?.();
      this._hoverContainer.remove();
      this._messageListeners.dispose();
      super.dispose();
    }
    this._isDisposed = true;
  }
};
HoverWidget = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IAccessibilityService)
], HoverWidget);
class CompositeMouseTracker extends Widget {
  /**
   * @param _elements The target elements to track mouse in/out events on.
   * @param _eventDebounceDelay The delay in ms to debounce the event firing. This is used to
   * allow a short period for the mouse to move into the hover or a nearby target element. For
   * example hovering a scroll bar will not hide the hover immediately.
   */
  constructor(_elements, _eventDebounceDelay = 200) {
    super();
    this._elements = _elements;
    this._eventDebounceDelay = _eventDebounceDelay;
    this._isMouseIn = true;
    this._mouseTimer = this._register(new MutableDisposable());
    this._onMouseOut = this._register(new Emitter());
    for (const element of this._elements) {
      this.onmouseover(element, () => this._onTargetMouseOver());
      this.onmouseleave(element, () => this._onTargetMouseLeave());
    }
  }
  get onMouseOut() {
    return this._onMouseOut.event;
  }
  get isMouseIn() {
    return this._isMouseIn;
  }
  _onTargetMouseOver() {
    this._isMouseIn = true;
    this._mouseTimer.clear();
  }
  _onTargetMouseLeave() {
    this._isMouseIn = false;
    this._mouseTimer.value = new TimeoutTimer(() => this._fireIfMouseOutside(), this._eventDebounceDelay);
  }
  _fireIfMouseOutside() {
    if (!this._isMouseIn) {
      this._onMouseOut.fire();
    }
  }
}
class ElementHoverTarget {
  constructor(_element) {
    this._element = _element;
    this.targetElements = [this._element];
  }
  dispose() {
  }
}
export {
  HoverWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9ob3ZlclNlcnZpY2UvaG92ZXJXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vaG92ZXIuY3NzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRURJVE9SX0ZPTlRfREVGQVVMVFMsIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEhvdmVyQWN0aW9uLCBIb3ZlclBvc2l0aW9uLCBIb3ZlcldpZGdldCBhcyBCYXNlSG92ZXJXaWRnZXQsIGdldEhvdmVyQWNjZXNzaWJsZVZpZXdIaW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IFdpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS93aWRnZXQuanMnO1xuaW1wb3J0IHsgQW5jaG9yUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIsIG9wZW5MaW5rRnJvbU1hcmtkb3duIH0gZnJvbSAnLi4vLi4vd2lkZ2V0L21hcmtkb3duUmVuZGVyZXIvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IGlzTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgc3RhdHVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgdHlwZSB7IElIb3Zlck9wdGlvbnMsIElIb3ZlclRhcmdldCwgSUhvdmVyV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyLmpzJztcbmltcG9ydCB7IFRpbWVvdXRUaW1lciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGlzTnVtYmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuXG5jb25zdCAkID0gZG9tLiQ7XG50eXBlIFRhcmdldFJlY3QgPSB7XG5cdGxlZnQ6IG51bWJlcjtcblx0cmlnaHQ6IG51bWJlcjtcblx0dG9wOiBudW1iZXI7XG5cdGJvdHRvbTogbnVtYmVyO1xuXHR3aWR0aDogbnVtYmVyO1xuXHRoZWlnaHQ6IG51bWJlcjtcblx0Y2VudGVyOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH07XG59O1xuXG5jb25zdCBlbnVtIENvbnN0YW50cyB7XG5cdFBvaW50ZXJTaXplID0gMyxcblx0SG92ZXJCb3JkZXJXaWR0aCA9IDIsXG5cdEhvdmVyV2luZG93RWRnZU1hcmdpbiA9IDIsXG59XG5cbmV4cG9ydCBjbGFzcyBIb3ZlcldpZGdldCBleHRlbmRzIFdpZGdldCBpbXBsZW1lbnRzIElIb3ZlcldpZGdldCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21lc3NhZ2VMaXN0ZW5lcnMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvY2tNb3VzZVRyYWNrZXI6IENvbXBvc2l0ZU1vdXNlVHJhY2tlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ob3ZlcjogQmFzZUhvdmVyV2lkZ2V0O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ob3ZlclBvaW50ZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ob3ZlckNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RhcmdldDogSUhvdmVyVGFyZ2V0O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9saW5rSGFuZGxlcjogKHVybDogc3RyaW5nKSA9PiBhbnk7XG5cblx0cHJpdmF0ZSBfaXNEaXNwb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9ob3ZlclBvc2l0aW9uOiBIb3ZlclBvc2l0aW9uO1xuXHRwcml2YXRlIF9mb3JjZVBvc2l0aW9uOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX3g6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgX3k6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgX2lzTG9ja2VkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2VuYWJsZUZvY3VzVHJhcHM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfYWRkZWRGb2N1c1RyYXA6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIGdldCBfdGFyZ2V0V2luZG93KCk6IFdpbmRvdyB7XG5cdFx0cmV0dXJuIGRvbS5nZXRXaW5kb3codGhpcy5fdGFyZ2V0LnRhcmdldEVsZW1lbnRzWzBdKTtcblx0fVxuXHRwcml2YXRlIGdldCBfdGFyZ2V0RG9jdW1lbnRFbGVtZW50KCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gZG9tLmdldFdpbmRvdyh0aGlzLl90YXJnZXQudGFyZ2V0RWxlbWVudHNbMF0pLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblx0fVxuXG5cdGdldCBpc0Rpc3Bvc2VkKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5faXNEaXNwb3NlZDsgfVxuXHRnZXQgaXNNb3VzZUluKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fbG9ja01vdXNlVHJhY2tlci5pc01vdXNlSW47IH1cblx0Z2V0IGRvbU5vZGUoKTogSFRNTEVsZW1lbnQgeyByZXR1cm4gdGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZTsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRnZXQgb25EaXNwb3NlKCk6IEV2ZW50PHZvaWQ+IHsgcmV0dXJuIHRoaXMuX29uRGlzcG9zZS5ldmVudDsgfVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblJlcXVlc3RMYXlvdXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0Z2V0IG9uUmVxdWVzdExheW91dCgpOiBFdmVudDx2b2lkPiB7IHJldHVybiB0aGlzLl9vblJlcXVlc3RMYXlvdXQuZXZlbnQ7IH1cblxuXHRnZXQgYW5jaG9yKCk6IEFuY2hvclBvc2l0aW9uIHsgcmV0dXJuIHRoaXMuX2hvdmVyUG9zaXRpb24gPT09IEhvdmVyUG9zaXRpb24uQkVMT1cgPyBBbmNob3JQb3NpdGlvbi5CRUxPVyA6IEFuY2hvclBvc2l0aW9uLkFCT1ZFOyB9XG5cdGdldCB4KCk6IG51bWJlciB7IHJldHVybiB0aGlzLl94OyB9XG5cdGdldCB5KCk6IG51bWJlciB7IHJldHVybiB0aGlzLl95OyB9XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIGhvdmVyIGlzIFwibG9ja2VkXCIgYnkgaG9sZGluZyB0aGUgYWx0L29wdGlvbiBrZXkuIFdoZW4gbG9ja2VkLCB0aGUgaG92ZXIgd2lsbCBub3Rcblx0ICogaGlkZSBhbmQgY2FuIGJlIGhvdmVyZWQgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBgaGlkZU9uSG92ZXJgIGhvdmVyIG9wdGlvbiBpcyBzZXQuXG5cdCAqL1xuXHRnZXQgaXNMb2NrZWQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9pc0xvY2tlZDsgfVxuXHRzZXQgaXNMb2NrZWQodmFsdWU6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5faXNMb2NrZWQgPT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2lzTG9ja2VkID0gdmFsdWU7XG5cdFx0dGhpcy5faG92ZXJDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnbG9ja2VkJywgdGhpcy5faXNMb2NrZWQpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSUhvdmVyT3B0aW9ucyxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9saW5rSGFuZGxlciA9IG9wdGlvbnMubGlua0hhbmRsZXIgfHwgKHVybCA9PiB7XG5cdFx0XHRyZXR1cm4gb3BlbkxpbmtGcm9tTWFya2Rvd24odGhpcy5fb3BlbmVyU2VydmljZSwgdXJsLCBpc01hcmtkb3duU3RyaW5nKG9wdGlvbnMuY29udGVudCkgPyBvcHRpb25zLmNvbnRlbnQuaXNUcnVzdGVkIDogdW5kZWZpbmVkKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3RhcmdldCA9ICd0YXJnZXRFbGVtZW50cycgaW4gb3B0aW9ucy50YXJnZXQgPyBvcHRpb25zLnRhcmdldCA6IG5ldyBFbGVtZW50SG92ZXJUYXJnZXQob3B0aW9ucy50YXJnZXQpO1xuXG5cdFx0dGhpcy5faG92ZXJQb2ludGVyID0gb3B0aW9ucy5hcHBlYXJhbmNlPy5zaG93UG9pbnRlciA/ICQoJ2Rpdi53b3JrYmVuY2gtaG92ZXItcG9pbnRlcicpIDogdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2hvdmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEJhc2VIb3ZlcldpZGdldCghb3B0aW9ucy5hcHBlYXJhbmNlPy5za2lwRmFkZUluQW5pbWF0aW9uKSk7XG5cdFx0dGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZS5jbGFzc0xpc3QuYWRkKCd3b3JrYmVuY2gtaG92ZXInKTtcblx0XHRpZiAob3B0aW9ucy5hcHBlYXJhbmNlPy5jb21wYWN0KSB7XG5cdFx0XHR0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3dvcmtiZW5jaC1ob3ZlcicsICdjb21wYWN0Jyk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmFkZGl0aW9uYWxDbGFzc2VzKSB7XG5cdFx0XHR0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsYXNzTGlzdC5hZGQoLi4ub3B0aW9ucy5hZGRpdGlvbmFsQ2xhc3Nlcyk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLnBvc2l0aW9uPy5mb3JjZVBvc2l0aW9uKSB7XG5cdFx0XHR0aGlzLl9mb3JjZVBvc2l0aW9uID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKG9wdGlvbnMudHJhcEZvY3VzKSB7XG5cdFx0XHR0aGlzLl9lbmFibGVGb2N1c1RyYXBzID0gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBEZWZhdWx0IHRvIHBvc2l0aW9uIGFib3ZlIHdoZW4gdGhlIHBvc2l0aW9uIGlzIHVuc3BlY2lmaWVkIG9yIGEgbW91c2UgZXZlbnRcblx0XHR0aGlzLl9ob3ZlclBvc2l0aW9uID0gb3B0aW9ucy5wb3NpdGlvbj8uaG92ZXJQb3NpdGlvbiA9PT0gdW5kZWZpbmVkXG5cdFx0XHQ/IEhvdmVyUG9zaXRpb24uQUJPVkVcblx0XHRcdDogaXNOdW1iZXIob3B0aW9ucy5wb3NpdGlvbi5ob3ZlclBvc2l0aW9uKVxuXHRcdFx0XHQ/IG9wdGlvbnMucG9zaXRpb24uaG92ZXJQb3NpdGlvblxuXHRcdFx0XHQ6IEhvdmVyUG9zaXRpb24uQkVMT1c7XG5cblx0XHQvLyBEb24ndCBhbGxvdyBtb3VzZWRvd24gb3V0IG9mIHRoZSB3aWRnZXQsIG90aGVyd2lzZSBwcmV2ZW50RGVmYXVsdCB3aWxsIGNhbGwgYW5kIHRleHQgd2lsbFxuXHRcdC8vIG5vdCBiZSBzZWxlY3RlZC5cblx0XHR0aGlzLm9ubW91c2Vkb3duKHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUsIGUgPT4gZS5zdG9wUHJvcGFnYXRpb24oKSk7XG5cblx0XHQvLyBIaWRlIGhvdmVyIG9uIGVzY2FwZVxuXHRcdHRoaXMub25rZXlkb3duKHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUsIGUgPT4ge1xuXHRcdFx0aWYgKGUuZXF1YWxzKEtleUNvZGUuRXNjYXBlKSkge1xuXHRcdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIEhpZGUgd2hlbiB0aGUgd2luZG93IGxvc2VzIGZvY3VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl90YXJnZXRXaW5kb3csICdibHVyJywgKCkgPT4gdGhpcy5kaXNwb3NlKCkpKTtcblxuXHRcdGNvbnN0IHJvd0VsZW1lbnQgPSAkKCdkaXYuaG92ZXItcm93Lm1hcmtkb3duLWhvdmVyJyk7XG5cdFx0Y29uc3QgY29udGVudHNFbGVtZW50ID0gJCgnZGl2LmhvdmVyLWNvbnRlbnRzJyk7XG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zLmNvbnRlbnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjb250ZW50c0VsZW1lbnQudGV4dENvbnRlbnQgPSBvcHRpb25zLmNvbnRlbnQ7XG5cdFx0XHRjb250ZW50c0VsZW1lbnQuc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUtd3JhcCc7XG5cblx0XHR9IGVsc2UgaWYgKGRvbS5pc0hUTUxFbGVtZW50KG9wdGlvbnMuY29udGVudCkpIHtcblx0XHRcdGNvbnRlbnRzRWxlbWVudC5hcHBlbmRDaGlsZChvcHRpb25zLmNvbnRlbnQpO1xuXHRcdFx0Y29udGVudHNFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2h0bWwtaG92ZXItY29udGVudHMnKTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBtYXJrZG93biA9IG9wdGlvbnMuY29udGVudDtcblx0XHRcdGNvbnN0IG1kUmVuZGVyZXIgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0TWFya2Rvd25SZW5kZXJlcixcblx0XHRcdFx0eyBjb2RlQmxvY2tGb250RmFtaWx5OiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRWRpdG9yT3B0aW9ucz4oJ2VkaXRvcicpLmZvbnRGYW1pbHkgfHwgRURJVE9SX0ZPTlRfREVGQVVMVFMuZm9udEZhbWlseSB9XG5cdFx0XHQpO1xuXG5cdFx0XHRjb25zdCB7IGVsZW1lbnQsIGRpc3Bvc2UgfSA9IG1kUmVuZGVyZXIucmVuZGVyKG1hcmtkb3duLCB7XG5cdFx0XHRcdGFjdGlvbkhhbmRsZXI6IHtcblx0XHRcdFx0XHRjYWxsYmFjazogKGNvbnRlbnQpID0+IHRoaXMuX2xpbmtIYW5kbGVyKGNvbnRlbnQpLFxuXHRcdFx0XHRcdGRpc3Bvc2FibGVzOiB0aGlzLl9tZXNzYWdlTGlzdGVuZXJzXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFzeW5jUmVuZGVyQ2FsbGJhY2s6ICgpID0+IHtcblx0XHRcdFx0XHRjb250ZW50c0VsZW1lbnQuY2xhc3NMaXN0LmFkZCgnY29kZS1ob3Zlci1jb250ZW50cycpO1xuXHRcdFx0XHRcdHRoaXMubGF5b3V0KCk7XG5cdFx0XHRcdFx0Ly8gVGhpcyBjaGFuZ2VzIHRoZSBkaW1lbnNpb25zIG9mIHRoZSBob3ZlciBzbyB0cmlnZ2VyIGEgbGF5b3V0XG5cdFx0XHRcdFx0dGhpcy5fb25SZXF1ZXN0TGF5b3V0LmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRjb250ZW50c0VsZW1lbnQuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoZGlzcG9zZSkpO1xuXHRcdH1cblx0XHRyb3dFbGVtZW50LmFwcGVuZENoaWxkKGNvbnRlbnRzRWxlbWVudCk7XG5cdFx0dGhpcy5faG92ZXIuY29udGVudHNEb21Ob2RlLmFwcGVuZENoaWxkKHJvd0VsZW1lbnQpO1xuXG5cdFx0aWYgKG9wdGlvbnMuYWN0aW9ucyAmJiBvcHRpb25zLmFjdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3Qgc3RhdHVzQmFyRWxlbWVudCA9ICQoJ2Rpdi5ob3Zlci1yb3cuc3RhdHVzLWJhcicpO1xuXHRcdFx0Y29uc3QgYWN0aW9uc0VsZW1lbnQgPSAkKCdkaXYuYWN0aW9ucycpO1xuXHRcdFx0b3B0aW9ucy5hY3Rpb25zLmZvckVhY2goYWN0aW9uID0+IHtcblx0XHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmNvbW1hbmRJZCk7XG5cdFx0XHRcdGNvbnN0IGtleWJpbmRpbmdMYWJlbCA9IGtleWJpbmRpbmcgPyBrZXliaW5kaW5nLmdldExhYmVsKCkgOiBudWxsO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3RlcihIb3ZlckFjdGlvbi5yZW5kZXIoYWN0aW9uc0VsZW1lbnQsIHtcblx0XHRcdFx0XHRsYWJlbDogYWN0aW9uLmxhYmVsLFxuXHRcdFx0XHRcdGNvbW1hbmRJZDogYWN0aW9uLmNvbW1hbmRJZCxcblx0XHRcdFx0XHRydW46IGUgPT4ge1xuXHRcdFx0XHRcdFx0YWN0aW9uLnJ1bihlKTtcblx0XHRcdFx0XHRcdHRoaXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0aWNvbkNsYXNzOiBhY3Rpb24uaWNvbkNsYXNzXG5cdFx0XHRcdH0sIGtleWJpbmRpbmdMYWJlbCkpO1xuXHRcdFx0fSk7XG5cdFx0XHRzdGF0dXNCYXJFbGVtZW50LmFwcGVuZENoaWxkKGFjdGlvbnNFbGVtZW50KTtcblx0XHRcdHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuYXBwZW5kQ2hpbGQoc3RhdHVzQmFyRWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5faG92ZXJDb250YWluZXIgPSAkKCdkaXYud29ya2JlbmNoLWhvdmVyLWNvbnRhaW5lcicpO1xuXHRcdGlmICh0aGlzLl9ob3ZlclBvaW50ZXIpIHtcblx0XHRcdHRoaXMuX2hvdmVyQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2hvdmVyUG9pbnRlcik7XG5cdFx0fVxuXHRcdHRoaXMuX2hvdmVyQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUpO1xuXG5cdFx0Ly8gRGV0ZXJtaW5lIHdoZXRoZXIgdG8gaGlkZSBvbiBob3ZlclxuXHRcdGxldCBoaWRlT25Ib3ZlcjogYm9vbGVhbjtcblx0XHRpZiAob3B0aW9ucy5hY3Rpb25zICYmIG9wdGlvbnMuYWN0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHQvLyBJZiB0aGVyZSBhcmUgYWN0aW9ucywgcmVxdWlyZSBob3ZlciBzbyB0aGV5IGNhbiBiZSBhY2Nlc3NlZFxuXHRcdFx0aGlkZU9uSG92ZXIgPSBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKG9wdGlvbnMucGVyc2lzdGVuY2U/LmhpZGVPbkhvdmVyID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Ly8gV2hlbiB1bnNldCwgd2lsbCBkZWZhdWx0IHRvIHRydWUgd2hlbiBpdCdzIGEgc3RyaW5nIG9yIHdoZW4gaXQncyBtYXJrZG93biB0aGF0XG5cdFx0XHRcdC8vIGFwcGVhcnMgdG8gaGF2ZSBhIGxpbmsgdXNpbmcgYSBuYWl2ZSBjaGVjayBmb3IgJ10oJyBhbmQgJzwvYT4nXG5cdFx0XHRcdGhpZGVPbkhvdmVyID0gdHlwZW9mIG9wdGlvbnMuY29udGVudCA9PT0gJ3N0cmluZycgfHxcblx0XHRcdFx0XHRpc01hcmtkb3duU3RyaW5nKG9wdGlvbnMuY29udGVudCkgJiYgIW9wdGlvbnMuY29udGVudC52YWx1ZS5pbmNsdWRlcygnXSgnKSAmJiAhb3B0aW9ucy5jb250ZW50LnZhbHVlLmluY2x1ZGVzKCc8L2E+Jyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBJdCdzIHNldCBleHBsaWNpdGx5XG5cdFx0XHRcdGhpZGVPbkhvdmVyID0gb3B0aW9ucy5wZXJzaXN0ZW5jZS5oaWRlT25Ib3Zlcjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTaG93IHRoZSBob3ZlciBoaW50IGlmIG5lZWRlZFxuXHRcdGlmIChvcHRpb25zLmFwcGVhcmFuY2U/LnNob3dIb3ZlckhpbnQpIHtcblx0XHRcdGNvbnN0IHN0YXR1c0JhckVsZW1lbnQgPSAkKCdkaXYuaG92ZXItcm93LnN0YXR1cy1iYXInKTtcblx0XHRcdGNvbnN0IGluZm9FbGVtZW50ID0gJCgnZGl2LmluZm8nKTtcblx0XHRcdGluZm9FbGVtZW50LnRleHRDb250ZW50ID0gbG9jYWxpemUoJ2hvdmVyaGludCcsICdIb2xkIHswfSBrZXkgdG8gbW91c2Ugb3ZlcicsIGlzTWFjaW50b3NoID8gJ09wdGlvbicgOiAnQWx0Jyk7XG5cdFx0XHRzdGF0dXNCYXJFbGVtZW50LmFwcGVuZENoaWxkKGluZm9FbGVtZW50KTtcblx0XHRcdHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuYXBwZW5kQ2hpbGQoc3RhdHVzQmFyRWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW91c2VUcmFja2VyVGFyZ2V0cyA9IFsuLi50aGlzLl90YXJnZXQudGFyZ2V0RWxlbWVudHNdO1xuXHRcdGlmICghaGlkZU9uSG92ZXIpIHtcblx0XHRcdG1vdXNlVHJhY2tlclRhcmdldHMucHVzaCh0aGlzLl9ob3ZlckNvbnRhaW5lcik7XG5cdFx0fVxuXHRcdGNvbnN0IG1vdXNlVHJhY2tlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDb21wb3NpdGVNb3VzZVRyYWNrZXIobW91c2VUcmFja2VyVGFyZ2V0cykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vdXNlVHJhY2tlci5vbk1vdXNlT3V0KCgpID0+IHtcblx0XHRcdGlmICghdGhpcy5faXNMb2NrZWQpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gU2V0dXAgYW5vdGhlciBtb3VzZSB0cmFja2VyIHdoZW4gaGlkZU9uSG92ZXIgaXMgc2V0IGluIG9yZGVyIHRvIHRyYWNrIHRoZSBob3ZlciBhcyB3ZWxsXG5cdFx0Ly8gd2hlbiBpdCBpcyBsb2NrZWQuIFRoaXMgZW5zdXJlcyB0aGUgaG92ZXIgd2lsbCBoaWRlIG9uIG1vdXNlb3V0IGFmdGVyIGFsdCBoYXMgYmVlblxuXHRcdC8vIHJlbGVhc2VkIHRvIHVubG9jayB0aGUgZWxlbWVudC5cblx0XHRpZiAoaGlkZU9uSG92ZXIpIHtcblx0XHRcdGNvbnN0IG1vdXNlVHJhY2tlcjJUYXJnZXRzID0gWy4uLnRoaXMuX3RhcmdldC50YXJnZXRFbGVtZW50cywgdGhpcy5faG92ZXJDb250YWluZXJdO1xuXHRcdFx0dGhpcy5fbG9ja01vdXNlVHJhY2tlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDb21wb3NpdGVNb3VzZVRyYWNrZXIobW91c2VUcmFja2VyMlRhcmdldHMpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2xvY2tNb3VzZVRyYWNrZXIub25Nb3VzZU91dCgoKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5faXNMb2NrZWQpIHtcblx0XHRcdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9sb2NrTW91c2VUcmFja2VyID0gbW91c2VUcmFja2VyO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYWRkRm9jdXNUcmFwKCkge1xuXHRcdGlmICghdGhpcy5fZW5hYmxlRm9jdXNUcmFwcyB8fCB0aGlzLl9hZGRlZEZvY3VzVHJhcCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9hZGRlZEZvY3VzVHJhcCA9IHRydWU7XG5cblx0XHQvLyBBZGQgYSBob3ZlciB0YWIgbG9vcCBpZiB0aGUgaG92ZXIgaGFzIGF0IGxlYXN0IG9uZSBlbGVtZW50IHdpdGggYSB2YWxpZCB0YWJJbmRleFxuXHRcdGNvbnN0IGZpcnN0Q29udGFpbmVyRm9jdXNFbGVtZW50ID0gdGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZTtcblx0XHRjb25zdCBsYXN0Q29udGFpbmVyRm9jdXNFbGVtZW50ID0gdGhpcy5maW5kTGFzdEZvY3VzYWJsZUNoaWxkKHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUpO1xuXHRcdGlmIChsYXN0Q29udGFpbmVyRm9jdXNFbGVtZW50KSB7XG5cdFx0XHRjb25zdCBiZWZvcmVDb250YWluZXJGb2N1c0VsZW1lbnQgPSBkb20ucHJlcGVuZCh0aGlzLl9ob3ZlckNvbnRhaW5lciwgJCgnZGl2JykpO1xuXHRcdFx0Y29uc3QgYWZ0ZXJDb250YWluZXJGb2N1c0VsZW1lbnQgPSBkb20uYXBwZW5kKHRoaXMuX2hvdmVyQ29udGFpbmVyLCAkKCdkaXYnKSk7XG5cdFx0XHRiZWZvcmVDb250YWluZXJGb2N1c0VsZW1lbnQudGFiSW5kZXggPSAwO1xuXHRcdFx0YWZ0ZXJDb250YWluZXJGb2N1c0VsZW1lbnQudGFiSW5kZXggPSAwO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihhZnRlckNvbnRhaW5lckZvY3VzRWxlbWVudCwgJ2ZvY3VzJywgKGUpID0+IHtcblx0XHRcdFx0Zmlyc3RDb250YWluZXJGb2N1c0VsZW1lbnQuZm9jdXMoKTtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihiZWZvcmVDb250YWluZXJGb2N1c0VsZW1lbnQsICdmb2N1cycsIChlKSA9PiB7XG5cdFx0XHRcdGxhc3RDb250YWluZXJGb2N1c0VsZW1lbnQuZm9jdXMoKTtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZmluZExhc3RGb2N1c2FibGVDaGlsZChyb290OiBOb2RlKTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQge1xuXHRcdGlmIChyb290Lmhhc0NoaWxkTm9kZXMoKSkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByb290LmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3Qgbm9kZSA9IHJvb3QuY2hpbGROb2Rlcy5pdGVtKHJvb3QuY2hpbGROb2Rlcy5sZW5ndGggLSBpIC0gMSk7XG5cdFx0XHRcdGlmIChub2RlLm5vZGVUeXBlID09PSBub2RlLkVMRU1FTlRfTk9ERSkge1xuXHRcdFx0XHRcdGNvbnN0IHBhcnNlZE5vZGUgPSBub2RlIGFzIEhUTUxFbGVtZW50O1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgcGFyc2VkTm9kZS50YWJJbmRleCA9PT0gJ251bWJlcicgJiYgcGFyc2VkTm9kZS50YWJJbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcGFyc2VkTm9kZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcmVjdXJzaXZlbHlGb3VuZEVsZW1lbnQgPSB0aGlzLmZpbmRMYXN0Rm9jdXNhYmxlQ2hpbGQobm9kZSk7XG5cdFx0XHRcdGlmIChyZWN1cnNpdmVseUZvdW5kRWxlbWVudCkge1xuXHRcdFx0XHRcdHJldHVybiByZWN1cnNpdmVseUZvdW5kRWxlbWVudDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2hvdmVyQ29udGFpbmVyKTtcblx0XHRjb25zdCBob3ZlckZvY3VzZWQgPSB0aGlzLl9ob3ZlckNvbnRhaW5lci5jb250YWlucyh0aGlzLl9ob3ZlckNvbnRhaW5lci5vd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpO1xuXHRcdGNvbnN0IGFjY2Vzc2libGVWaWV3SGludCA9IGhvdmVyRm9jdXNlZCAmJiBnZXRIb3ZlckFjY2Vzc2libGVWaWV3SGludCh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnYWNjZXNzaWJpbGl0eS52ZXJib3NpdHkuaG92ZXInKSA9PT0gdHJ1ZSAmJiB0aGlzLl9hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpLCB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKCdlZGl0b3IuYWN0aW9uLmFjY2Vzc2libGVWaWV3Jyk/LmdldEFyaWFMYWJlbCgpKTtcblx0XHRpZiAoYWNjZXNzaWJsZVZpZXdIaW50KSB7XG5cblx0XHRcdHN0YXR1cyhhY2Nlc3NpYmxlVmlld0hpbnQpO1xuXHRcdH1cblx0XHR0aGlzLmxheW91dCgpO1xuXHRcdHRoaXMuYWRkRm9jdXNUcmFwKCk7XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0KCkge1xuXHRcdHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgncmlnaHQtYWxpZ25lZCcpO1xuXHRcdHRoaXMuX2hvdmVyLmNvbnRlbnRzRG9tTm9kZS5zdHlsZS5tYXhIZWlnaHQgPSAnJztcblxuXHRcdGNvbnN0IGdldFpvb21BY2NvdW50ZWRCb3VuZGluZ0NsaWVudFJlY3QgPSAoZTogSFRNTEVsZW1lbnQpID0+IHtcblx0XHRcdGNvbnN0IHpvb20gPSBkb20uZ2V0RG9tTm9kZVpvb21MZXZlbChlKTtcblxuXHRcdFx0Y29uc3QgYm91bmRpbmdSZWN0ID0gZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHRvcDogYm91bmRpbmdSZWN0LnRvcCAqIHpvb20sXG5cdFx0XHRcdGJvdHRvbTogYm91bmRpbmdSZWN0LmJvdHRvbSAqIHpvb20sXG5cdFx0XHRcdHJpZ2h0OiBib3VuZGluZ1JlY3QucmlnaHQgKiB6b29tLFxuXHRcdFx0XHRsZWZ0OiBib3VuZGluZ1JlY3QubGVmdCAqIHpvb20sXG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHRjb25zdCB0YXJnZXRCb3VuZHMgPSB0aGlzLl90YXJnZXQudGFyZ2V0RWxlbWVudHMubWFwKGUgPT4gZ2V0Wm9vbUFjY291bnRlZEJvdW5kaW5nQ2xpZW50UmVjdChlKSk7XG5cdFx0Y29uc3QgeyB0b3AsIHJpZ2h0LCBib3R0b20sIGxlZnQgfSA9IHRhcmdldEJvdW5kc1swXTtcblx0XHRjb25zdCB3aWR0aCA9IHJpZ2h0IC0gbGVmdDtcblx0XHRjb25zdCBoZWlnaHQgPSBib3R0b20gLSB0b3A7XG5cblx0XHRjb25zdCB0YXJnZXRSZWN0OiBUYXJnZXRSZWN0ID0ge1xuXHRcdFx0dG9wLCByaWdodCwgYm90dG9tLCBsZWZ0LCB3aWR0aCwgaGVpZ2h0LFxuXHRcdFx0Y2VudGVyOiB7XG5cdFx0XHRcdHg6IGxlZnQgKyAod2lkdGggLyAyKSxcblx0XHRcdFx0eTogdG9wICsgKGhlaWdodCAvIDIpXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIFRoZXNlIGNhbGxzIGFkanVzdCB0aGUgcG9zaXRpb24gZGVwZW5kaW5nIG9uIHNwYWNpbmcuXG5cdFx0dGhpcy5hZGp1c3RIb3Jpem9udGFsSG92ZXJQb3NpdGlvbih0YXJnZXRSZWN0KTtcblx0XHR0aGlzLmFkanVzdFZlcnRpY2FsSG92ZXJQb3NpdGlvbih0YXJnZXRSZWN0KTtcblx0XHQvLyBUaGlzIGNhbGwgbGltaXRzIHRoZSBtYXhpbXVtIGhlaWdodCBvZiB0aGUgaG92ZXIuXG5cdFx0dGhpcy5hZGp1c3RIb3Zlck1heEhlaWdodCh0YXJnZXRSZWN0KTtcblxuXHRcdC8vIE9mZnNldCB0aGUgaG92ZXIgcG9zaXRpb24gaWYgdGhlcmUgaXMgYSBwb2ludGVyIHNvIGl0IGFsaWducyB3aXRoIHRoZSB0YXJnZXQgZWxlbWVudFxuXHRcdHRoaXMuX2hvdmVyQ29udGFpbmVyLnN0eWxlLnBhZGRpbmcgPSAnJztcblx0XHR0aGlzLl9ob3ZlckNvbnRhaW5lci5zdHlsZS5tYXJnaW4gPSAnJztcblx0XHRpZiAodGhpcy5faG92ZXJQb2ludGVyKSB7XG5cdFx0XHRzd2l0Y2ggKHRoaXMuX2hvdmVyUG9zaXRpb24pIHtcblx0XHRcdFx0Y2FzZSBIb3ZlclBvc2l0aW9uLlJJR0hUOlxuXHRcdFx0XHRcdHRhcmdldFJlY3QubGVmdCArPSBDb25zdGFudHMuUG9pbnRlclNpemU7XG5cdFx0XHRcdFx0dGFyZ2V0UmVjdC5yaWdodCArPSBDb25zdGFudHMuUG9pbnRlclNpemU7XG5cdFx0XHRcdFx0dGhpcy5faG92ZXJDb250YWluZXIuc3R5bGUucGFkZGluZ0xlZnQgPSBgJHtDb25zdGFudHMuUG9pbnRlclNpemV9cHhgO1xuXHRcdFx0XHRcdHRoaXMuX2hvdmVyQ29udGFpbmVyLnN0eWxlLm1hcmdpbkxlZnQgPSBgJHstQ29uc3RhbnRzLlBvaW50ZXJTaXplfXB4YDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBIb3ZlclBvc2l0aW9uLkxFRlQ6XG5cdFx0XHRcdFx0dGFyZ2V0UmVjdC5sZWZ0IC09IENvbnN0YW50cy5Qb2ludGVyU2l6ZTtcblx0XHRcdFx0XHR0YXJnZXRSZWN0LnJpZ2h0IC09IENvbnN0YW50cy5Qb2ludGVyU2l6ZTtcblx0XHRcdFx0XHR0aGlzLl9ob3ZlckNvbnRhaW5lci5zdHlsZS5wYWRkaW5nUmlnaHQgPSBgJHtDb25zdGFudHMuUG9pbnRlclNpemV9cHhgO1xuXHRcdFx0XHRcdHRoaXMuX2hvdmVyQ29udGFpbmVyLnN0eWxlLm1hcmdpblJpZ2h0ID0gYCR7LUNvbnN0YW50cy5Qb2ludGVyU2l6ZX1weGA7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgSG92ZXJQb3NpdGlvbi5CRUxPVzpcblx0XHRcdFx0XHR0YXJnZXRSZWN0LnRvcCArPSBDb25zdGFudHMuUG9pbnRlclNpemU7XG5cdFx0XHRcdFx0dGFyZ2V0UmVjdC5ib3R0b20gKz0gQ29uc3RhbnRzLlBvaW50ZXJTaXplO1xuXHRcdFx0XHRcdHRoaXMuX2hvdmVyQ29udGFpbmVyLnN0eWxlLnBhZGRpbmdUb3AgPSBgJHtDb25zdGFudHMuUG9pbnRlclNpemV9cHhgO1xuXHRcdFx0XHRcdHRoaXMuX2hvdmVyQ29udGFpbmVyLnN0eWxlLm1hcmdpblRvcCA9IGAkey1Db25zdGFudHMuUG9pbnRlclNpemV9cHhgO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEhvdmVyUG9zaXRpb24uQUJPVkU6XG5cdFx0XHRcdFx0dGFyZ2V0UmVjdC50b3AgLT0gQ29uc3RhbnRzLlBvaW50ZXJTaXplO1xuXHRcdFx0XHRcdHRhcmdldFJlY3QuYm90dG9tIC09IENvbnN0YW50cy5Qb2ludGVyU2l6ZTtcblx0XHRcdFx0XHR0aGlzLl9ob3ZlckNvbnRhaW5lci5zdHlsZS5wYWRkaW5nQm90dG9tID0gYCR7Q29uc3RhbnRzLlBvaW50ZXJTaXplfXB4YDtcblx0XHRcdFx0XHR0aGlzLl9ob3ZlckNvbnRhaW5lci5zdHlsZS5tYXJnaW5Cb3R0b20gPSBgJHstQ29uc3RhbnRzLlBvaW50ZXJTaXplfXB4YDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0dGFyZ2V0UmVjdC5jZW50ZXIueCA9IHRhcmdldFJlY3QubGVmdCArICh3aWR0aCAvIDIpO1xuXHRcdFx0dGFyZ2V0UmVjdC5jZW50ZXIueSA9IHRhcmdldFJlY3QudG9wICsgKGhlaWdodCAvIDIpO1xuXHRcdH1cblxuXHRcdHRoaXMuY29tcHV0ZVhDb3JkaW5hdGUodGFyZ2V0UmVjdCk7XG5cdFx0dGhpcy5jb21wdXRlWUNvcmRpbmF0ZSh0YXJnZXRSZWN0KTtcblxuXHRcdGlmICh0aGlzLl9ob3ZlclBvaW50ZXIpIHtcblx0XHRcdC8vIHJlc2V0XG5cdFx0XHR0aGlzLl9ob3ZlclBvaW50ZXIuY2xhc3NMaXN0LnJlbW92ZSgndG9wJyk7XG5cdFx0XHR0aGlzLl9ob3ZlclBvaW50ZXIuY2xhc3NMaXN0LnJlbW92ZSgnbGVmdCcpO1xuXHRcdFx0dGhpcy5faG92ZXJQb2ludGVyLmNsYXNzTGlzdC5yZW1vdmUoJ3JpZ2h0Jyk7XG5cdFx0XHR0aGlzLl9ob3ZlclBvaW50ZXIuY2xhc3NMaXN0LnJlbW92ZSgnYm90dG9tJyk7XG5cblx0XHRcdHRoaXMuc2V0SG92ZXJQb2ludGVyUG9zaXRpb24odGFyZ2V0UmVjdCk7XG5cdFx0fVxuXHRcdHRoaXMuX2hvdmVyLm9uQ29udGVudHNDaGFuZ2VkKCk7XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVYQ29yZGluYXRlKHRhcmdldDogVGFyZ2V0UmVjdCk6IHZvaWQge1xuXHRcdGNvbnN0IGhvdmVyV2lkdGggPSB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsaWVudFdpZHRoICsgQ29uc3RhbnRzLkhvdmVyQm9yZGVyV2lkdGg7XG5cblx0XHRpZiAodGhpcy5fdGFyZ2V0LnggIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5feCA9IHRoaXMuX3RhcmdldC54O1xuXHRcdH1cblxuXHRcdGVsc2UgaWYgKHRoaXMuX2hvdmVyUG9zaXRpb24gPT09IEhvdmVyUG9zaXRpb24uUklHSFQpIHtcblx0XHRcdHRoaXMuX3ggPSB0YXJnZXQucmlnaHQ7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAodGhpcy5faG92ZXJQb3NpdGlvbiA9PT0gSG92ZXJQb3NpdGlvbi5MRUZUKSB7XG5cdFx0XHR0aGlzLl94ID0gdGFyZ2V0LmxlZnQgLSBob3ZlcldpZHRoO1xuXHRcdH1cblxuXHRcdGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMuX2hvdmVyUG9pbnRlcikge1xuXHRcdFx0XHR0aGlzLl94ID0gdGFyZ2V0LmNlbnRlci54IC0gKHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuY2xpZW50V2lkdGggLyAyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3ggPSB0YXJnZXQubGVmdDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSG92ZXIgaXMgZ29pbmcgYmV5b25kIHdpbmRvdyB0b3dhcmRzIHJpZ2h0IGVuZFxuXHRcdFx0aWYgKHRoaXMuX3ggKyBob3ZlcldpZHRoID49IHRoaXMuX3RhcmdldERvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCkge1xuXHRcdFx0XHR0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3JpZ2h0LWFsaWduZWQnKTtcblx0XHRcdFx0dGhpcy5feCA9IE1hdGgubWF4KHRoaXMuX3RhcmdldERvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCAtIGhvdmVyV2lkdGggLSBDb25zdGFudHMuSG92ZXJXaW5kb3dFZGdlTWFyZ2luLCB0aGlzLl90YXJnZXREb2N1bWVudEVsZW1lbnQuY2xpZW50TGVmdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSG92ZXIgaXMgZ29pbmcgYmV5b25kIHdpbmRvdyB0b3dhcmRzIGxlZnQgZW5kXG5cdFx0aWYgKHRoaXMuX3ggPCB0aGlzLl90YXJnZXREb2N1bWVudEVsZW1lbnQuY2xpZW50TGVmdCkge1xuXHRcdFx0dGhpcy5feCA9IHRhcmdldC5sZWZ0ICsgQ29uc3RhbnRzLkhvdmVyV2luZG93RWRnZU1hcmdpbjtcblx0XHR9XG5cblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZVlDb3JkaW5hdGUodGFyZ2V0OiBUYXJnZXRSZWN0KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3RhcmdldC55ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3kgPSB0aGlzLl90YXJnZXQueTtcblx0XHR9XG5cblx0XHRlbHNlIGlmICh0aGlzLl9ob3ZlclBvc2l0aW9uID09PSBIb3ZlclBvc2l0aW9uLkFCT1ZFKSB7XG5cdFx0XHR0aGlzLl95ID0gdGFyZ2V0LnRvcDtcblx0XHR9XG5cblx0XHRlbHNlIGlmICh0aGlzLl9ob3ZlclBvc2l0aW9uID09PSBIb3ZlclBvc2l0aW9uLkJFTE9XKSB7XG5cdFx0XHR0aGlzLl95ID0gdGFyZ2V0LmJvdHRvbSAtIDI7XG5cdFx0fVxuXG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAodGhpcy5faG92ZXJQb2ludGVyKSB7XG5cdFx0XHRcdHRoaXMuX3kgPSB0YXJnZXQuY2VudGVyLnkgKyAodGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZS5jbGllbnRIZWlnaHQgLyAyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3kgPSB0YXJnZXQuYm90dG9tO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEhvdmVyIG9uIGJvdHRvbSBpcyBnb2luZyBiZXlvbmQgd2luZG93XG5cdFx0aWYgKHRoaXMuX3kgPiB0aGlzLl90YXJnZXRXaW5kb3cuaW5uZXJIZWlnaHQpIHtcblx0XHRcdHRoaXMuX3kgPSB0YXJnZXQuYm90dG9tO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYWRqdXN0SG9yaXpvbnRhbEhvdmVyUG9zaXRpb24odGFyZ2V0OiBUYXJnZXRSZWN0KTogdm9pZCB7XG5cdFx0Ly8gRG8gbm90IGFkanVzdCBob3Jpem9udGFsIGhvdmVyIHBvc2l0aW9uIGlmIHggY29yZGlhbnRlIGlzIHByb3ZpZGVkXG5cdFx0aWYgKHRoaXMuX3RhcmdldC54ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBob3ZlclBvaW50ZXJPZmZzZXQgPSAodGhpcy5faG92ZXJQb2ludGVyID8gQ29uc3RhbnRzLlBvaW50ZXJTaXplIDogMCk7XG5cblx0XHQvLyBXaGVuIGZvcmNlIHBvc2l0aW9uIGlzIGVuYWJsZWQsIHJlc3RyaWN0IG1heCB3aWR0aFxuXHRcdGlmICh0aGlzLl9mb3JjZVBvc2l0aW9uKSB7XG5cdFx0XHRjb25zdCBwYWRkaW5nID0gaG92ZXJQb2ludGVyT2Zmc2V0ICsgQ29uc3RhbnRzLkhvdmVyQm9yZGVyV2lkdGg7XG5cdFx0XHRpZiAodGhpcy5faG92ZXJQb3NpdGlvbiA9PT0gSG92ZXJQb3NpdGlvbi5SSUdIVCkge1xuXHRcdFx0XHR0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLnN0eWxlLm1heFdpZHRoID0gYCR7dGhpcy5fdGFyZ2V0RG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIC0gdGFyZ2V0LnJpZ2h0IC0gcGFkZGluZ31weGA7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX2hvdmVyUG9zaXRpb24gPT09IEhvdmVyUG9zaXRpb24uTEVGVCkge1xuXHRcdFx0XHR0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLnN0eWxlLm1heFdpZHRoID0gYCR7dGFyZ2V0LmxlZnQgLSBwYWRkaW5nfXB4YDtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBQb3NpdGlvbiBob3ZlciBvbiByaWdodCB0byB0YXJnZXRcblx0XHRpZiAodGhpcy5faG92ZXJQb3NpdGlvbiA9PT0gSG92ZXJQb3NpdGlvbi5SSUdIVCkge1xuXHRcdFx0Y29uc3Qgcm9vbU9uUmlnaHQgPSB0aGlzLl90YXJnZXREb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggLSB0YXJnZXQucmlnaHQ7XG5cdFx0XHQvLyBIb3ZlciBvbiB0aGUgcmlnaHQgaXMgZ29pbmcgYmV5b25kIHdpbmRvdy5cblx0XHRcdGlmIChyb29tT25SaWdodCA8IHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuY2xpZW50V2lkdGggKyBob3ZlclBvaW50ZXJPZmZzZXQpIHtcblx0XHRcdFx0Y29uc3Qgcm9vbU9uTGVmdCA9IHRhcmdldC5sZWZ0O1xuXHRcdFx0XHQvLyBUaGVyZSdzIGVub3VnaCByb29tIG9uIHRoZSBsZWZ0LCBmbGlwIHRoZSBob3ZlciBwb3NpdGlvblxuXHRcdFx0XHRpZiAocm9vbU9uTGVmdCA+PSB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsaWVudFdpZHRoICsgaG92ZXJQb2ludGVyT2Zmc2V0KSB7XG5cdFx0XHRcdFx0dGhpcy5faG92ZXJQb3NpdGlvbiA9IEhvdmVyUG9zaXRpb24uTEVGVDtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBIb3ZlciBvbiB0aGUgbGVmdCB3b3VsZCBnbyBiZXlvbmQgd2luZG93IHRvb1xuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9ob3ZlclBvc2l0aW9uID0gSG92ZXJQb3NpdGlvbi5CRUxPVztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBQb3NpdGlvbiBob3ZlciBvbiBsZWZ0IHRvIHRhcmdldFxuXHRcdGVsc2UgaWYgKHRoaXMuX2hvdmVyUG9zaXRpb24gPT09IEhvdmVyUG9zaXRpb24uTEVGVCkge1xuXG5cdFx0XHRjb25zdCByb29tT25MZWZ0ID0gdGFyZ2V0LmxlZnQ7XG5cdFx0XHQvLyBIb3ZlciBvbiB0aGUgbGVmdCBpcyBnb2luZyBiZXlvbmQgd2luZG93LlxuXHRcdFx0aWYgKHJvb21PbkxlZnQgPCB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsaWVudFdpZHRoICsgaG92ZXJQb2ludGVyT2Zmc2V0KSB7XG5cdFx0XHRcdGNvbnN0IHJvb21PblJpZ2h0ID0gdGhpcy5fdGFyZ2V0RG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIC0gdGFyZ2V0LnJpZ2h0O1xuXHRcdFx0XHQvLyBUaGVyZSdzIGVub3VnaCByb29tIG9uIHRoZSByaWdodCwgZmxpcCB0aGUgaG92ZXIgcG9zaXRpb25cblx0XHRcdFx0aWYgKHJvb21PblJpZ2h0ID49IHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuY2xpZW50V2lkdGggKyBob3ZlclBvaW50ZXJPZmZzZXQpIHtcblx0XHRcdFx0XHR0aGlzLl9ob3ZlclBvc2l0aW9uID0gSG92ZXJQb3NpdGlvbi5SSUdIVDtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBIb3ZlciBvbiB0aGUgcmlnaHQgd291bGQgZ28gYmV5b25kIHdpbmRvdyB0b29cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5faG92ZXJQb3NpdGlvbiA9IEhvdmVyUG9zaXRpb24uQkVMT1c7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIEhvdmVyIG9uIHRoZSBsZWZ0IGlzIGdvaW5nIGJleW9uZCB3aW5kb3cuXG5cdFx0XHRpZiAodGFyZ2V0LmxlZnQgLSB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsaWVudFdpZHRoIC0gaG92ZXJQb2ludGVyT2Zmc2V0IDw9IHRoaXMuX3RhcmdldERvY3VtZW50RWxlbWVudC5jbGllbnRMZWZ0KSB7XG5cdFx0XHRcdHRoaXMuX2hvdmVyUG9zaXRpb24gPSBIb3ZlclBvc2l0aW9uLlJJR0hUO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYWRqdXN0VmVydGljYWxIb3ZlclBvc2l0aW9uKHRhcmdldDogVGFyZ2V0UmVjdCk6IHZvaWQge1xuXHRcdC8vIERvIG5vdCBhZGp1c3QgdmVydGljYWwgaG92ZXIgcG9zaXRpb24gaWYgdGhlIHkgY29vcmRpbmF0ZSBpcyBwcm92aWRlZFxuXHRcdC8vIG9yIHRoZSBwb3NpdGlvbiBpcyBmb3JjZWRcblx0XHRpZiAodGhpcy5fdGFyZ2V0LnkgIT09IHVuZGVmaW5lZCB8fCB0aGlzLl9mb3JjZVBvc2l0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaG92ZXJQb2ludGVyT2Zmc2V0ID0gKHRoaXMuX2hvdmVyUG9pbnRlciA/IENvbnN0YW50cy5Qb2ludGVyU2l6ZSA6IDApO1xuXG5cdFx0Ly8gUG9zaXRpb24gaG92ZXIgb24gdG9wIG9mIHRoZSB0YXJnZXRcblx0XHRpZiAodGhpcy5faG92ZXJQb3NpdGlvbiA9PT0gSG92ZXJQb3NpdGlvbi5BQk9WRSkge1xuXHRcdFx0Ly8gSG92ZXIgb24gdG9wIGlzIGdvaW5nIGJleW9uZCB3aW5kb3dcblx0XHRcdGlmICh0YXJnZXQudG9wIC0gdGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZS5jbGllbnRIZWlnaHQgLSBob3ZlclBvaW50ZXJPZmZzZXQgPCAwKSB7XG5cdFx0XHRcdHRoaXMuX2hvdmVyUG9zaXRpb24gPSBIb3ZlclBvc2l0aW9uLkJFTE9XO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFBvc2l0aW9uIGhvdmVyIGJlbG93IHRoZSB0YXJnZXRcblx0XHRlbHNlIGlmICh0aGlzLl9ob3ZlclBvc2l0aW9uID09PSBIb3ZlclBvc2l0aW9uLkJFTE9XKSB7XG5cdFx0XHQvLyBIb3ZlciBvbiBib3R0b20gaXMgZ29pbmcgYmV5b25kIHdpbmRvd1xuXHRcdFx0aWYgKHRhcmdldC5ib3R0b20gKyB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsaWVudEhlaWdodCArIGhvdmVyUG9pbnRlck9mZnNldCA+IHRoaXMuX3RhcmdldFdpbmRvdy5pbm5lckhlaWdodCkge1xuXHRcdFx0XHR0aGlzLl9ob3ZlclBvc2l0aW9uID0gSG92ZXJQb3NpdGlvbi5BQk9WRTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFkanVzdEhvdmVyTWF4SGVpZ2h0KHRhcmdldDogVGFyZ2V0UmVjdCk6IHZvaWQge1xuXHRcdGxldCBtYXhIZWlnaHQgPSB0aGlzLl90YXJnZXRXaW5kb3cuaW5uZXJIZWlnaHQgLyAyO1xuXG5cdFx0Ly8gV2hlbiBmb3JjZSBwb3NpdGlvbiBpcyBlbmFibGVkLCByZXN0cmljdCBtYXggaGVpZ2h0XG5cdFx0aWYgKHRoaXMuX2ZvcmNlUG9zaXRpb24pIHtcblx0XHRcdGNvbnN0IHBhZGRpbmcgPSAodGhpcy5faG92ZXJQb2ludGVyID8gQ29uc3RhbnRzLlBvaW50ZXJTaXplIDogMCkgKyBDb25zdGFudHMuSG92ZXJCb3JkZXJXaWR0aDtcblx0XHRcdGlmICh0aGlzLl9ob3ZlclBvc2l0aW9uID09PSBIb3ZlclBvc2l0aW9uLkFCT1ZFKSB7XG5cdFx0XHRcdG1heEhlaWdodCA9IE1hdGgubWluKG1heEhlaWdodCwgdGFyZ2V0LnRvcCAtIHBhZGRpbmcpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLl9ob3ZlclBvc2l0aW9uID09PSBIb3ZlclBvc2l0aW9uLkJFTE9XKSB7XG5cdFx0XHRcdG1heEhlaWdodCA9IE1hdGgubWluKG1heEhlaWdodCwgdGhpcy5fdGFyZ2V0V2luZG93LmlubmVySGVpZ2h0IC0gdGFyZ2V0LmJvdHRvbSAtIHBhZGRpbmcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuc3R5bGUubWF4SGVpZ2h0ID0gYCR7bWF4SGVpZ2h0fXB4YDtcblx0XHRpZiAodGhpcy5faG92ZXIuY29udGVudHNEb21Ob2RlLmNsaWVudEhlaWdodCA8IHRoaXMuX2hvdmVyLmNvbnRlbnRzRG9tTm9kZS5zY3JvbGxIZWlnaHQpIHtcblx0XHRcdC8vIEFkZCBwYWRkaW5nIGZvciBhIHZlcnRpY2FsIHNjcm9sbGJhclxuXHRcdFx0Y29uc3QgZXh0cmFSaWdodFBhZGRpbmcgPSBgJHt0aGlzLl9ob3Zlci5zY3JvbGxiYXIub3B0aW9ucy52ZXJ0aWNhbFNjcm9sbGJhclNpemV9cHhgO1xuXHRcdFx0aWYgKHRoaXMuX2hvdmVyLmNvbnRlbnRzRG9tTm9kZS5zdHlsZS5wYWRkaW5nUmlnaHQgIT09IGV4dHJhUmlnaHRQYWRkaW5nKSB7XG5cdFx0XHRcdHRoaXMuX2hvdmVyLmNvbnRlbnRzRG9tTm9kZS5zdHlsZS5wYWRkaW5nUmlnaHQgPSBleHRyYVJpZ2h0UGFkZGluZztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldEhvdmVyUG9pbnRlclBvc2l0aW9uKHRhcmdldDogVGFyZ2V0UmVjdCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faG92ZXJQb2ludGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3dpdGNoICh0aGlzLl9ob3ZlclBvc2l0aW9uKSB7XG5cdFx0XHRjYXNlIEhvdmVyUG9zaXRpb24uTEVGVDpcblx0XHRcdGNhc2UgSG92ZXJQb3NpdGlvbi5SSUdIVDoge1xuXHRcdFx0XHR0aGlzLl9ob3ZlclBvaW50ZXIuY2xhc3NMaXN0LmFkZCh0aGlzLl9ob3ZlclBvc2l0aW9uID09PSBIb3ZlclBvc2l0aW9uLkxFRlQgPyAncmlnaHQnIDogJ2xlZnQnKTtcblx0XHRcdFx0Y29uc3QgaG92ZXJIZWlnaHQgPSB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsaWVudEhlaWdodDtcblxuXHRcdFx0XHQvLyBJZiBob3ZlciBpcyB0YWxsZXIgdGhhbiB0YXJnZXQsIHRoZW4gc2hvdyB0aGUgcG9pbnRlciBhdCB0aGUgY2VudGVyIG9mIHRhcmdldFxuXHRcdFx0XHRpZiAoaG92ZXJIZWlnaHQgPiB0YXJnZXQuaGVpZ2h0KSB7XG5cdFx0XHRcdFx0dGhpcy5faG92ZXJQb2ludGVyLnN0eWxlLnRvcCA9IGAke3RhcmdldC5jZW50ZXIueSAtICh0aGlzLl95IC0gaG92ZXJIZWlnaHQpIC0gQ29uc3RhbnRzLlBvaW50ZXJTaXplfXB4YDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIE90aGVyd2lzZSBzaG93IHRoZSBwb2ludGVyIGF0IHRoZSBjZW50ZXIgb2YgaG92ZXJcblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5faG92ZXJQb2ludGVyLnN0eWxlLnRvcCA9IGAke01hdGgucm91bmQoKGhvdmVySGVpZ2h0IC8gMikpIC0gQ29uc3RhbnRzLlBvaW50ZXJTaXplfXB4YDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBIb3ZlclBvc2l0aW9uLkFCT1ZFOlxuXHRcdFx0Y2FzZSBIb3ZlclBvc2l0aW9uLkJFTE9XOiB7XG5cdFx0XHRcdHRoaXMuX2hvdmVyUG9pbnRlci5jbGFzc0xpc3QuYWRkKHRoaXMuX2hvdmVyUG9zaXRpb24gPT09IEhvdmVyUG9zaXRpb24uQUJPVkUgPyAnYm90dG9tJyA6ICd0b3AnKTtcblx0XHRcdFx0Y29uc3QgaG92ZXJXaWR0aCA9IHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuY2xpZW50V2lkdGg7XG5cblx0XHRcdFx0Ly8gUG9zaXRpb24gcG9pbnRlciBhdCB0aGUgY2VudGVyIG9mIHRoZSBob3ZlclxuXHRcdFx0XHRsZXQgcG9pbnRlckxlZnRQb3NpdGlvbiA9IE1hdGgucm91bmQoKGhvdmVyV2lkdGggLyAyKSkgLSBDb25zdGFudHMuUG9pbnRlclNpemU7XG5cblx0XHRcdFx0Ly8gSWYgcG9pbnRlciBnb2VzIGJleW9uZCB0YXJnZXQgdGhlbiBwb3NpdGlvbiBpdCBhdCB0aGUgY2VudGVyIG9mIHRoZSB0YXJnZXRcblx0XHRcdFx0Y29uc3QgcG9pbnRlclggPSB0aGlzLl94ICsgcG9pbnRlckxlZnRQb3NpdGlvbjtcblx0XHRcdFx0aWYgKHBvaW50ZXJYIDwgdGFyZ2V0LmxlZnQgfHwgcG9pbnRlclggPiB0YXJnZXQucmlnaHQpIHtcblx0XHRcdFx0XHRwb2ludGVyTGVmdFBvc2l0aW9uID0gdGFyZ2V0LmNlbnRlci54IC0gdGhpcy5feCAtIENvbnN0YW50cy5Qb2ludGVyU2l6ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX2hvdmVyUG9pbnRlci5zdHlsZS5sZWZ0ID0gYCR7cG9pbnRlckxlZnRQb3NpdGlvbn1weGA7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBmb2N1cygpIHtcblx0XHR0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmZvY3VzKCk7XG5cdH1cblxuXHRwdWJsaWMgaGlkZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0dGhpcy5fb25EaXNwb3NlLmZpcmUoKTtcblx0XHRcdHRoaXMuX3RhcmdldC5kaXNwb3NlPy4oKTtcblx0XHRcdHRoaXMuX2hvdmVyQ29udGFpbmVyLnJlbW92ZSgpO1xuXHRcdFx0dGhpcy5fbWVzc2FnZUxpc3RlbmVycy5kaXNwb3NlKCk7XG5cdFx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXHR9XG59XG5cbmNsYXNzIENvbXBvc2l0ZU1vdXNlVHJhY2tlciBleHRlbmRzIFdpZGdldCB7XG5cdHByaXZhdGUgX2lzTW91c2VJbjogYm9vbGVhbiA9IHRydWU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX21vdXNlVGltZXI6IE11dGFibGVEaXNwb3NhYmxlPFRpbWVvdXRUaW1lcj4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Nb3VzZU91dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRnZXQgb25Nb3VzZU91dCgpOiBFdmVudDx2b2lkPiB7IHJldHVybiB0aGlzLl9vbk1vdXNlT3V0LmV2ZW50OyB9XG5cblx0Z2V0IGlzTW91c2VJbigpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2lzTW91c2VJbjsgfVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0gX2VsZW1lbnRzIFRoZSB0YXJnZXQgZWxlbWVudHMgdG8gdHJhY2sgbW91c2UgaW4vb3V0IGV2ZW50cyBvbi5cblx0ICogQHBhcmFtIF9ldmVudERlYm91bmNlRGVsYXkgVGhlIGRlbGF5IGluIG1zIHRvIGRlYm91bmNlIHRoZSBldmVudCBmaXJpbmcuIFRoaXMgaXMgdXNlZCB0b1xuXHQgKiBhbGxvdyBhIHNob3J0IHBlcmlvZCBmb3IgdGhlIG1vdXNlIHRvIG1vdmUgaW50byB0aGUgaG92ZXIgb3IgYSBuZWFyYnkgdGFyZ2V0IGVsZW1lbnQuIEZvclxuXHQgKiBleGFtcGxlIGhvdmVyaW5nIGEgc2Nyb2xsIGJhciB3aWxsIG5vdCBoaWRlIHRoZSBob3ZlciBpbW1lZGlhdGVseS5cblx0ICovXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX2VsZW1lbnRzOiBIVE1MRWxlbWVudFtdLFxuXHRcdHByaXZhdGUgX2V2ZW50RGVib3VuY2VEZWxheTogbnVtYmVyID0gMjAwXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgdGhpcy5fZWxlbWVudHMpIHtcblx0XHRcdHRoaXMub25tb3VzZW92ZXIoZWxlbWVudCwgKCkgPT4gdGhpcy5fb25UYXJnZXRNb3VzZU92ZXIoKSk7XG5cdFx0XHR0aGlzLm9ubW91c2VsZWF2ZShlbGVtZW50LCAoKSA9PiB0aGlzLl9vblRhcmdldE1vdXNlTGVhdmUoKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25UYXJnZXRNb3VzZU92ZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNNb3VzZUluID0gdHJ1ZTtcblx0XHR0aGlzLl9tb3VzZVRpbWVyLmNsZWFyKCk7XG5cdH1cblxuXHRwcml2YXRlIF9vblRhcmdldE1vdXNlTGVhdmUoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNNb3VzZUluID0gZmFsc2U7XG5cdFx0Ly8gRXZhbHVhdGUgd2hldGhlciB0aGUgbW91c2UgaXMgc3RpbGwgb3V0c2lkZSBhc3luY2hyb25vdXNseSBzdWNoIHRoYXQgb3RoZXIgbW91c2UgdGFyZ2V0c1xuXHRcdC8vIGhhdmUgdGhlIG9wcG9ydHVuaXR5IHRvIGZpcnN0IHRoZWlyIG1vdXNlIGluIGV2ZW50LlxuXHRcdHRoaXMuX21vdXNlVGltZXIudmFsdWUgPSBuZXcgVGltZW91dFRpbWVyKCgpID0+IHRoaXMuX2ZpcmVJZk1vdXNlT3V0c2lkZSgpLCB0aGlzLl9ldmVudERlYm91bmNlRGVsYXkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmlyZUlmTW91c2VPdXRzaWRlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faXNNb3VzZUluKSB7XG5cdFx0XHR0aGlzLl9vbk1vdXNlT3V0LmZpcmUoKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgRWxlbWVudEhvdmVyVGFyZ2V0IGltcGxlbWVudHMgSUhvdmVyVGFyZ2V0IHtcblx0cmVhZG9ubHkgdGFyZ2V0RWxlbWVudHM6IHJlYWRvbmx5IEhUTUxFbGVtZW50W107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBfZWxlbWVudDogSFRNTEVsZW1lbnRcblx0KSB7XG5cdFx0dGhpcy50YXJnZXRFbGVtZW50cyA9IFt0aGlzLl9lbGVtZW50XTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsaUJBQWlCLG1CQUFtQixvQkFBb0I7QUFDakUsU0FBZ0IsZUFBZTtBQUMvQixZQUFZLFNBQVM7QUFDckIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNEJBQTRDO0FBQ3JELFNBQVMsYUFBYSxlQUFlLGVBQWUsaUJBQWlCLGtDQUFrQztBQUN2RyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxrQkFBa0IsNEJBQTRCO0FBQ3ZELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsY0FBYztBQUV2QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQjtBQUV6QixNQUFNLElBQUksSUFBSTtBQVdkLElBQVcsWUFBWCxrQkFBV0EsZUFBWDtBQUNDLEVBQUFBLHNCQUFBLGlCQUFjLEtBQWQ7QUFDQSxFQUFBQSxzQkFBQSxzQkFBbUIsS0FBbkI7QUFDQSxFQUFBQSxzQkFBQSwyQkFBd0IsS0FBeEI7QUFIVSxTQUFBQTtBQUFBLEdBQUE7QUFNSixJQUFNLGNBQU4sY0FBMEIsT0FBK0I7QUFBQSxFQW9EL0QsWUFDQyxTQUNxQyxvQkFDRyx1QkFDUCxnQkFDTyx1QkFDQSx1QkFDdkM7QUFDRCxVQUFNO0FBTitCO0FBQ0c7QUFDUDtBQUNPO0FBQ0E7QUF6RHpDLFNBQWlCLG9CQUFvQixJQUFJLGdCQUFnQjtBQVN6RCxTQUFRLGNBQXVCO0FBRS9CLFNBQVEsaUJBQTBCO0FBQ2xDLFNBQVEsS0FBYTtBQUNyQixTQUFRLEtBQWE7QUFDckIsU0FBUSxZQUFxQjtBQUM3QixTQUFRLG9CQUE2QjtBQUNyQyxTQUFRLGtCQUEyQjtBQWFuQyxTQUFpQixhQUFhLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUVoRSxTQUFpQixtQkFBbUIsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBOEJyRSxTQUFLLGVBQWUsUUFBUSxnQkFBZ0IsU0FBTztBQUNsRCxhQUFPLHFCQUFxQixLQUFLLGdCQUFnQixLQUFLLGlCQUFpQixRQUFRLE9BQU8sSUFBSSxRQUFRLFFBQVEsWUFBWSxNQUFTO0FBQUEsSUFDaEk7QUFFQSxTQUFLLFVBQVUsb0JBQW9CLFFBQVEsU0FBUyxRQUFRLFNBQVMsSUFBSSxtQkFBbUIsUUFBUSxNQUFNO0FBRTFHLFNBQUssZ0JBQWdCLFFBQVEsWUFBWSxjQUFjLEVBQUUsNkJBQTZCLElBQUk7QUFDMUYsU0FBSyxTQUFTLEtBQUssVUFBVSxJQUFJLGdCQUFnQixDQUFDLFFBQVEsWUFBWSxtQkFBbUIsQ0FBQztBQUMxRixTQUFLLE9BQU8saUJBQWlCLFVBQVUsSUFBSSxpQkFBaUI7QUFDNUQsUUFBSSxRQUFRLFlBQVksU0FBUztBQUNoQyxXQUFLLE9BQU8saUJBQWlCLFVBQVUsSUFBSSxtQkFBbUIsU0FBUztBQUFBLElBQ3hFO0FBQ0EsUUFBSSxRQUFRLG1CQUFtQjtBQUM5QixXQUFLLE9BQU8saUJBQWlCLFVBQVUsSUFBSSxHQUFHLFFBQVEsaUJBQWlCO0FBQUEsSUFDeEU7QUFDQSxRQUFJLFFBQVEsVUFBVSxlQUFlO0FBQ3BDLFdBQUssaUJBQWlCO0FBQUEsSUFDdkI7QUFDQSxRQUFJLFFBQVEsV0FBVztBQUN0QixXQUFLLG9CQUFvQjtBQUFBLElBQzFCO0FBR0EsU0FBSyxpQkFBaUIsUUFBUSxVQUFVLGtCQUFrQixTQUN2RCxjQUFjLFFBQ2QsU0FBUyxRQUFRLFNBQVMsYUFBYSxJQUN0QyxRQUFRLFNBQVMsZ0JBQ2pCLGNBQWM7QUFJbEIsU0FBSyxZQUFZLEtBQUssT0FBTyxrQkFBa0IsT0FBSyxFQUFFLGdCQUFnQixDQUFDO0FBR3ZFLFNBQUssVUFBVSxLQUFLLE9BQU8sa0JBQWtCLE9BQUs7QUFDakQsVUFBSSxFQUFFLE9BQU8sUUFBUSxNQUFNLEdBQUc7QUFDN0IsYUFBSyxRQUFRO0FBQUEsTUFDZDtBQUFBLElBQ0QsQ0FBQztBQUdELFNBQUssVUFBVSxJQUFJLHNCQUFzQixLQUFLLGVBQWUsUUFBUSxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUM7QUFFMUYsVUFBTSxhQUFhLEVBQUUsOEJBQThCO0FBQ25ELFVBQU0sa0JBQWtCLEVBQUUsb0JBQW9CO0FBQzlDLFFBQUksT0FBTyxRQUFRLFlBQVksVUFBVTtBQUN4QyxzQkFBZ0IsY0FBYyxRQUFRO0FBQ3RDLHNCQUFnQixNQUFNLGFBQWE7QUFBQSxJQUVwQyxXQUFXLElBQUksY0FBYyxRQUFRLE9BQU8sR0FBRztBQUM5QyxzQkFBZ0IsWUFBWSxRQUFRLE9BQU87QUFDM0Msc0JBQWdCLFVBQVUsSUFBSSxxQkFBcUI7QUFBQSxJQUVwRCxPQUFPO0FBQ04sWUFBTSxXQUFXLFFBQVE7QUFDekIsWUFBTSxhQUFhLEtBQUssc0JBQXNCO0FBQUEsUUFDN0M7QUFBQSxRQUNBLEVBQUUscUJBQXFCLEtBQUssc0JBQXNCLFNBQXlCLFFBQVEsRUFBRSxjQUFjLHFCQUFxQixXQUFXO0FBQUEsTUFDcEk7QUFFQSxZQUFNLEVBQUUsU0FBUyxRQUFRLElBQUksV0FBVyxPQUFPLFVBQVU7QUFBQSxRQUN4RCxlQUFlO0FBQUEsVUFDZCxVQUFVLENBQUMsWUFBWSxLQUFLLGFBQWEsT0FBTztBQUFBLFVBQ2hELGFBQWEsS0FBSztBQUFBLFFBQ25CO0FBQUEsUUFDQSxxQkFBcUIsTUFBTTtBQUMxQiwwQkFBZ0IsVUFBVSxJQUFJLHFCQUFxQjtBQUNuRCxlQUFLLE9BQU87QUFFWixlQUFLLGlCQUFpQixLQUFLO0FBQUEsUUFDNUI7QUFBQSxNQUNELENBQUM7QUFDRCxzQkFBZ0IsWUFBWSxPQUFPO0FBQ25DLFdBQUssVUFBVSxhQUFhLE9BQU8sQ0FBQztBQUFBLElBQ3JDO0FBQ0EsZUFBVyxZQUFZLGVBQWU7QUFDdEMsU0FBSyxPQUFPLGdCQUFnQixZQUFZLFVBQVU7QUFFbEQsUUFBSSxRQUFRLFdBQVcsUUFBUSxRQUFRLFNBQVMsR0FBRztBQUNsRCxZQUFNLG1CQUFtQixFQUFFLDBCQUEwQjtBQUNyRCxZQUFNLGlCQUFpQixFQUFFLGFBQWE7QUFDdEMsY0FBUSxRQUFRLFFBQVEsWUFBVTtBQUNqQyxjQUFNLGFBQWEsS0FBSyxtQkFBbUIsaUJBQWlCLE9BQU8sU0FBUztBQUM1RSxjQUFNLGtCQUFrQixhQUFhLFdBQVcsU0FBUyxJQUFJO0FBQzdELGFBQUssVUFBVSxZQUFZLE9BQU8sZ0JBQWdCO0FBQUEsVUFDakQsT0FBTyxPQUFPO0FBQUEsVUFDZCxXQUFXLE9BQU87QUFBQSxVQUNsQixLQUFLLE9BQUs7QUFDVCxtQkFBTyxJQUFJLENBQUM7QUFDWixpQkFBSyxRQUFRO0FBQUEsVUFDZDtBQUFBLFVBQ0EsV0FBVyxPQUFPO0FBQUEsUUFDbkIsR0FBRyxlQUFlLENBQUM7QUFBQSxNQUNwQixDQUFDO0FBQ0QsdUJBQWlCLFlBQVksY0FBYztBQUMzQyxXQUFLLE9BQU8saUJBQWlCLFlBQVksZ0JBQWdCO0FBQUEsSUFDMUQ7QUFFQSxTQUFLLGtCQUFrQixFQUFFLCtCQUErQjtBQUN4RCxRQUFJLEtBQUssZUFBZTtBQUN2QixXQUFLLGdCQUFnQixZQUFZLEtBQUssYUFBYTtBQUFBLElBQ3BEO0FBQ0EsU0FBSyxnQkFBZ0IsWUFBWSxLQUFLLE9BQU8sZ0JBQWdCO0FBRzdELFFBQUk7QUFDSixRQUFJLFFBQVEsV0FBVyxRQUFRLFFBQVEsU0FBUyxHQUFHO0FBRWxELG9CQUFjO0FBQUEsSUFDZixPQUFPO0FBQ04sVUFBSSxRQUFRLGFBQWEsZ0JBQWdCLFFBQVc7QUFHbkQsc0JBQWMsT0FBTyxRQUFRLFlBQVksWUFDeEMsaUJBQWlCLFFBQVEsT0FBTyxLQUFLLENBQUMsUUFBUSxRQUFRLE1BQU0sU0FBUyxJQUFJLEtBQUssQ0FBQyxRQUFRLFFBQVEsTUFBTSxTQUFTLE1BQU07QUFBQSxNQUN0SCxPQUFPO0FBRU4sc0JBQWMsUUFBUSxZQUFZO0FBQUEsTUFDbkM7QUFBQSxJQUNEO0FBR0EsUUFBSSxRQUFRLFlBQVksZUFBZTtBQUN0QyxZQUFNLG1CQUFtQixFQUFFLDBCQUEwQjtBQUNyRCxZQUFNLGNBQWMsRUFBRSxVQUFVO0FBQ2hDLGtCQUFZLGNBQWMsU0FBUyxhQUFhLDhCQUE4QixjQUFjLFdBQVcsS0FBSztBQUM1Ryx1QkFBaUIsWUFBWSxXQUFXO0FBQ3hDLFdBQUssT0FBTyxpQkFBaUIsWUFBWSxnQkFBZ0I7QUFBQSxJQUMxRDtBQUVBLFVBQU0sc0JBQXNCLENBQUMsR0FBRyxLQUFLLFFBQVEsY0FBYztBQUMzRCxRQUFJLENBQUMsYUFBYTtBQUNqQiwwQkFBb0IsS0FBSyxLQUFLLGVBQWU7QUFBQSxJQUM5QztBQUNBLFVBQU0sZUFBZSxLQUFLLFVBQVUsSUFBSSxzQkFBc0IsbUJBQW1CLENBQUM7QUFDbEYsU0FBSyxVQUFVLGFBQWEsV0FBVyxNQUFNO0FBQzVDLFVBQUksQ0FBQyxLQUFLLFdBQVc7QUFDcEIsYUFBSyxRQUFRO0FBQUEsTUFDZDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBS0YsUUFBSSxhQUFhO0FBQ2hCLFlBQU0sdUJBQXVCLENBQUMsR0FBRyxLQUFLLFFBQVEsZ0JBQWdCLEtBQUssZUFBZTtBQUNsRixXQUFLLG9CQUFvQixLQUFLLFVBQVUsSUFBSSxzQkFBc0Isb0JBQW9CLENBQUM7QUFDdkYsV0FBSyxVQUFVLEtBQUssa0JBQWtCLFdBQVcsTUFBTTtBQUN0RCxZQUFJLENBQUMsS0FBSyxXQUFXO0FBQ3BCLGVBQUssUUFBUTtBQUFBLFFBQ2Q7QUFBQSxNQUNELENBQUMsQ0FBQztBQUFBLElBQ0gsT0FBTztBQUNOLFdBQUssb0JBQW9CO0FBQUEsSUFDMUI7QUFBQSxFQUNEO0FBQUEsRUF0TUEsSUFBWSxnQkFBd0I7QUFDbkMsV0FBTyxJQUFJLFVBQVUsS0FBSyxRQUFRLGVBQWUsQ0FBQyxDQUFDO0FBQUEsRUFDcEQ7QUFBQSxFQUNBLElBQVkseUJBQXNDO0FBQ2pELFdBQU8sSUFBSSxVQUFVLEtBQUssUUFBUSxlQUFlLENBQUMsQ0FBQyxFQUFFLFNBQVM7QUFBQSxFQUMvRDtBQUFBLEVBRUEsSUFBSSxhQUFzQjtBQUFFLFdBQU8sS0FBSztBQUFBLEVBQWE7QUFBQSxFQUNyRCxJQUFJLFlBQXFCO0FBQUUsV0FBTyxLQUFLLGtCQUFrQjtBQUFBLEVBQVc7QUFBQSxFQUNwRSxJQUFJLFVBQXVCO0FBQUUsV0FBTyxLQUFLLE9BQU87QUFBQSxFQUFrQjtBQUFBLEVBR2xFLElBQUksWUFBeUI7QUFBRSxXQUFPLEtBQUssV0FBVztBQUFBLEVBQU87QUFBQSxFQUU3RCxJQUFJLGtCQUErQjtBQUFFLFdBQU8sS0FBSyxpQkFBaUI7QUFBQSxFQUFPO0FBQUEsRUFFekUsSUFBSSxTQUF5QjtBQUFFLFdBQU8sS0FBSyxtQkFBbUIsY0FBYyxRQUFRLGVBQWUsUUFBUSxlQUFlO0FBQUEsRUFBTztBQUFBLEVBQ2pJLElBQUksSUFBWTtBQUFFLFdBQU8sS0FBSztBQUFBLEVBQUk7QUFBQSxFQUNsQyxJQUFJLElBQVk7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFJO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1sQyxJQUFJLFdBQW9CO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBVztBQUFBLEVBQ2pELElBQUksU0FBUyxPQUFnQjtBQUM1QixRQUFJLEtBQUssY0FBYyxPQUFPO0FBQzdCO0FBQUEsSUFDRDtBQUNBLFNBQUssWUFBWTtBQUNqQixTQUFLLGdCQUFnQixVQUFVLE9BQU8sVUFBVSxLQUFLLFNBQVM7QUFBQSxFQUMvRDtBQUFBLEVBeUtRLGVBQWU7QUFDdEIsUUFBSSxDQUFDLEtBQUsscUJBQXFCLEtBQUssaUJBQWlCO0FBQ3BEO0FBQUEsSUFDRDtBQUNBLFNBQUssa0JBQWtCO0FBR3ZCLFVBQU0sNkJBQTZCLEtBQUssT0FBTztBQUMvQyxVQUFNLDRCQUE0QixLQUFLLHVCQUF1QixLQUFLLE9BQU8sZ0JBQWdCO0FBQzFGLFFBQUksMkJBQTJCO0FBQzlCLFlBQU0sOEJBQThCLElBQUksUUFBUSxLQUFLLGlCQUFpQixFQUFFLEtBQUssQ0FBQztBQUM5RSxZQUFNLDZCQUE2QixJQUFJLE9BQU8sS0FBSyxpQkFBaUIsRUFBRSxLQUFLLENBQUM7QUFDNUUsa0NBQTRCLFdBQVc7QUFDdkMsaUNBQTJCLFdBQVc7QUFDdEMsV0FBSyxVQUFVLElBQUksc0JBQXNCLDRCQUE0QixTQUFTLENBQUMsTUFBTTtBQUNwRixtQ0FBMkIsTUFBTTtBQUNqQyxVQUFFLGVBQWU7QUFBQSxNQUNsQixDQUFDLENBQUM7QUFDRixXQUFLLFVBQVUsSUFBSSxzQkFBc0IsNkJBQTZCLFNBQVMsQ0FBQyxNQUFNO0FBQ3JGLGtDQUEwQixNQUFNO0FBQ2hDLFVBQUUsZUFBZTtBQUFBLE1BQ2xCLENBQUMsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNEO0FBQUEsRUFFUSx1QkFBdUIsTUFBcUM7QUFDbkUsUUFBSSxLQUFLLGNBQWMsR0FBRztBQUN6QixlQUFTLElBQUksR0FBRyxJQUFJLEtBQUssV0FBVyxRQUFRLEtBQUs7QUFDaEQsY0FBTSxPQUFPLEtBQUssV0FBVyxLQUFLLEtBQUssV0FBVyxTQUFTLElBQUksQ0FBQztBQUNoRSxZQUFJLEtBQUssYUFBYSxLQUFLLGNBQWM7QUFDeEMsZ0JBQU0sYUFBYTtBQUNuQixjQUFJLE9BQU8sV0FBVyxhQUFhLFlBQVksV0FBVyxZQUFZLEdBQUc7QUFDeEUsbUJBQU87QUFBQSxVQUNSO0FBQUEsUUFDRDtBQUNBLGNBQU0sMEJBQTBCLEtBQUssdUJBQXVCLElBQUk7QUFDaEUsWUFBSSx5QkFBeUI7QUFDNUIsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sT0FBTyxXQUE4QjtBQUMzQyxjQUFVLFlBQVksS0FBSyxlQUFlO0FBQzFDLFVBQU0sZUFBZSxLQUFLLGdCQUFnQixTQUFTLEtBQUssZ0JBQWdCLGNBQWMsYUFBYTtBQUNuRyxVQUFNLHFCQUFxQixnQkFBZ0IsMkJBQTJCLEtBQUssc0JBQXNCLFNBQVMsK0JBQStCLE1BQU0sUUFBUSxLQUFLLHNCQUFzQix3QkFBd0IsR0FBRyxLQUFLLG1CQUFtQixpQkFBaUIsOEJBQThCLEdBQUcsYUFBYSxDQUFDO0FBQ3JTLFFBQUksb0JBQW9CO0FBRXZCLGFBQU8sa0JBQWtCO0FBQUEsSUFDMUI7QUFDQSxTQUFLLE9BQU87QUFDWixTQUFLLGFBQWE7QUFBQSxFQUNuQjtBQUFBLEVBRU8sU0FBUztBQUNmLFNBQUssT0FBTyxpQkFBaUIsVUFBVSxPQUFPLGVBQWU7QUFDN0QsU0FBSyxPQUFPLGdCQUFnQixNQUFNLFlBQVk7QUFFOUMsVUFBTSxxQ0FBcUMsQ0FBQyxNQUFtQjtBQUM5RCxZQUFNLE9BQU8sSUFBSSxvQkFBb0IsQ0FBQztBQUV0QyxZQUFNLGVBQWUsRUFBRSxzQkFBc0I7QUFDN0MsYUFBTztBQUFBLFFBQ04sS0FBSyxhQUFhLE1BQU07QUFBQSxRQUN4QixRQUFRLGFBQWEsU0FBUztBQUFBLFFBQzlCLE9BQU8sYUFBYSxRQUFRO0FBQUEsUUFDNUIsTUFBTSxhQUFhLE9BQU87QUFBQSxNQUMzQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLGVBQWUsS0FBSyxRQUFRLGVBQWUsSUFBSSxPQUFLLG1DQUFtQyxDQUFDLENBQUM7QUFDL0YsVUFBTSxFQUFFLEtBQUssT0FBTyxRQUFRLEtBQUssSUFBSSxhQUFhLENBQUM7QUFDbkQsVUFBTSxRQUFRLFFBQVE7QUFDdEIsVUFBTSxTQUFTLFNBQVM7QUFFeEIsVUFBTSxhQUF5QjtBQUFBLE1BQzlCO0FBQUEsTUFBSztBQUFBLE1BQU87QUFBQSxNQUFRO0FBQUEsTUFBTTtBQUFBLE1BQU87QUFBQSxNQUNqQyxRQUFRO0FBQUEsUUFDUCxHQUFHLE9BQVEsUUFBUTtBQUFBLFFBQ25CLEdBQUcsTUFBTyxTQUFTO0FBQUEsTUFDcEI7QUFBQSxJQUNEO0FBR0EsU0FBSyw4QkFBOEIsVUFBVTtBQUM3QyxTQUFLLDRCQUE0QixVQUFVO0FBRTNDLFNBQUsscUJBQXFCLFVBQVU7QUFHcEMsU0FBSyxnQkFBZ0IsTUFBTSxVQUFVO0FBQ3JDLFNBQUssZ0JBQWdCLE1BQU0sU0FBUztBQUNwQyxRQUFJLEtBQUssZUFBZTtBQUN2QixjQUFRLEtBQUssZ0JBQWdCO0FBQUEsUUFDNUIsS0FBSyxjQUFjO0FBQ2xCLHFCQUFXLFFBQVE7QUFDbkIscUJBQVcsU0FBUztBQUNwQixlQUFLLGdCQUFnQixNQUFNLGNBQWMsR0FBRyxtQkFBcUI7QUFDakUsZUFBSyxnQkFBZ0IsTUFBTSxhQUFhLEdBQUcsRUFBc0I7QUFDakU7QUFBQSxRQUNELEtBQUssY0FBYztBQUNsQixxQkFBVyxRQUFRO0FBQ25CLHFCQUFXLFNBQVM7QUFDcEIsZUFBSyxnQkFBZ0IsTUFBTSxlQUFlLEdBQUcsbUJBQXFCO0FBQ2xFLGVBQUssZ0JBQWdCLE1BQU0sY0FBYyxHQUFHLEVBQXNCO0FBQ2xFO0FBQUEsUUFDRCxLQUFLLGNBQWM7QUFDbEIscUJBQVcsT0FBTztBQUNsQixxQkFBVyxVQUFVO0FBQ3JCLGVBQUssZ0JBQWdCLE1BQU0sYUFBYSxHQUFHLG1CQUFxQjtBQUNoRSxlQUFLLGdCQUFnQixNQUFNLFlBQVksR0FBRyxFQUFzQjtBQUNoRTtBQUFBLFFBQ0QsS0FBSyxjQUFjO0FBQ2xCLHFCQUFXLE9BQU87QUFDbEIscUJBQVcsVUFBVTtBQUNyQixlQUFLLGdCQUFnQixNQUFNLGdCQUFnQixHQUFHLG1CQUFxQjtBQUNuRSxlQUFLLGdCQUFnQixNQUFNLGVBQWUsR0FBRyxFQUFzQjtBQUNuRTtBQUFBLE1BQ0Y7QUFFQSxpQkFBVyxPQUFPLElBQUksV0FBVyxPQUFRLFFBQVE7QUFDakQsaUJBQVcsT0FBTyxJQUFJLFdBQVcsTUFBTyxTQUFTO0FBQUEsSUFDbEQ7QUFFQSxTQUFLLGtCQUFrQixVQUFVO0FBQ2pDLFNBQUssa0JBQWtCLFVBQVU7QUFFakMsUUFBSSxLQUFLLGVBQWU7QUFFdkIsV0FBSyxjQUFjLFVBQVUsT0FBTyxLQUFLO0FBQ3pDLFdBQUssY0FBYyxVQUFVLE9BQU8sTUFBTTtBQUMxQyxXQUFLLGNBQWMsVUFBVSxPQUFPLE9BQU87QUFDM0MsV0FBSyxjQUFjLFVBQVUsT0FBTyxRQUFRO0FBRTVDLFdBQUssd0JBQXdCLFVBQVU7QUFBQSxJQUN4QztBQUNBLFNBQUssT0FBTyxrQkFBa0I7QUFBQSxFQUMvQjtBQUFBLEVBRVEsa0JBQWtCLFFBQTBCO0FBQ25ELFVBQU0sYUFBYSxLQUFLLE9BQU8saUJBQWlCLGNBQWM7QUFFOUQsUUFBSSxLQUFLLFFBQVEsTUFBTSxRQUFXO0FBQ2pDLFdBQUssS0FBSyxLQUFLLFFBQVE7QUFBQSxJQUN4QixXQUVTLEtBQUssbUJBQW1CLGNBQWMsT0FBTztBQUNyRCxXQUFLLEtBQUssT0FBTztBQUFBLElBQ2xCLFdBRVMsS0FBSyxtQkFBbUIsY0FBYyxNQUFNO0FBQ3BELFdBQUssS0FBSyxPQUFPLE9BQU87QUFBQSxJQUN6QixPQUVLO0FBQ0osVUFBSSxLQUFLLGVBQWU7QUFDdkIsYUFBSyxLQUFLLE9BQU8sT0FBTyxJQUFLLEtBQUssT0FBTyxpQkFBaUIsY0FBYztBQUFBLE1BQ3pFLE9BQU87QUFDTixhQUFLLEtBQUssT0FBTztBQUFBLE1BQ2xCO0FBR0EsVUFBSSxLQUFLLEtBQUssY0FBYyxLQUFLLHVCQUF1QixhQUFhO0FBQ3BFLGFBQUssT0FBTyxpQkFBaUIsVUFBVSxJQUFJLGVBQWU7QUFDMUQsYUFBSyxLQUFLLEtBQUssSUFBSSxLQUFLLHVCQUF1QixjQUFjLGFBQWEsK0JBQWlDLEtBQUssdUJBQXVCLFVBQVU7QUFBQSxNQUNsSjtBQUFBLElBQ0Q7QUFHQSxRQUFJLEtBQUssS0FBSyxLQUFLLHVCQUF1QixZQUFZO0FBQ3JELFdBQUssS0FBSyxPQUFPLE9BQU87QUFBQSxJQUN6QjtBQUFBLEVBRUQ7QUFBQSxFQUVRLGtCQUFrQixRQUEwQjtBQUNuRCxRQUFJLEtBQUssUUFBUSxNQUFNLFFBQVc7QUFDakMsV0FBSyxLQUFLLEtBQUssUUFBUTtBQUFBLElBQ3hCLFdBRVMsS0FBSyxtQkFBbUIsY0FBYyxPQUFPO0FBQ3JELFdBQUssS0FBSyxPQUFPO0FBQUEsSUFDbEIsV0FFUyxLQUFLLG1CQUFtQixjQUFjLE9BQU87QUFDckQsV0FBSyxLQUFLLE9BQU8sU0FBUztBQUFBLElBQzNCLE9BRUs7QUFDSixVQUFJLEtBQUssZUFBZTtBQUN2QixhQUFLLEtBQUssT0FBTyxPQUFPLElBQUssS0FBSyxPQUFPLGlCQUFpQixlQUFlO0FBQUEsTUFDMUUsT0FBTztBQUNOLGFBQUssS0FBSyxPQUFPO0FBQUEsTUFDbEI7QUFBQSxJQUNEO0FBR0EsUUFBSSxLQUFLLEtBQUssS0FBSyxjQUFjLGFBQWE7QUFDN0MsV0FBSyxLQUFLLE9BQU87QUFBQSxJQUNsQjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLDhCQUE4QixRQUEwQjtBQUUvRCxRQUFJLEtBQUssUUFBUSxNQUFNLFFBQVc7QUFDakM7QUFBQSxJQUNEO0FBRUEsVUFBTSxxQkFBc0IsS0FBSyxnQkFBZ0Isc0JBQXdCO0FBR3pFLFFBQUksS0FBSyxnQkFBZ0I7QUFDeEIsWUFBTSxVQUFVLHFCQUFxQjtBQUNyQyxVQUFJLEtBQUssbUJBQW1CLGNBQWMsT0FBTztBQUNoRCxhQUFLLE9BQU8saUJBQWlCLE1BQU0sV0FBVyxHQUFHLEtBQUssdUJBQXVCLGNBQWMsT0FBTyxRQUFRLE9BQU87QUFBQSxNQUNsSCxXQUFXLEtBQUssbUJBQW1CLGNBQWMsTUFBTTtBQUN0RCxhQUFLLE9BQU8saUJBQWlCLE1BQU0sV0FBVyxHQUFHLE9BQU8sT0FBTyxPQUFPO0FBQUEsTUFDdkU7QUFDQTtBQUFBLElBQ0Q7QUFHQSxRQUFJLEtBQUssbUJBQW1CLGNBQWMsT0FBTztBQUNoRCxZQUFNLGNBQWMsS0FBSyx1QkFBdUIsY0FBYyxPQUFPO0FBRXJFLFVBQUksY0FBYyxLQUFLLE9BQU8saUJBQWlCLGNBQWMsb0JBQW9CO0FBQ2hGLGNBQU0sYUFBYSxPQUFPO0FBRTFCLFlBQUksY0FBYyxLQUFLLE9BQU8saUJBQWlCLGNBQWMsb0JBQW9CO0FBQ2hGLGVBQUssaUJBQWlCLGNBQWM7QUFBQSxRQUNyQyxPQUVLO0FBQ0osZUFBSyxpQkFBaUIsY0FBYztBQUFBLFFBQ3JDO0FBQUEsTUFDRDtBQUFBLElBQ0QsV0FFUyxLQUFLLG1CQUFtQixjQUFjLE1BQU07QUFFcEQsWUFBTSxhQUFhLE9BQU87QUFFMUIsVUFBSSxhQUFhLEtBQUssT0FBTyxpQkFBaUIsY0FBYyxvQkFBb0I7QUFDL0UsY0FBTSxjQUFjLEtBQUssdUJBQXVCLGNBQWMsT0FBTztBQUVyRSxZQUFJLGVBQWUsS0FBSyxPQUFPLGlCQUFpQixjQUFjLG9CQUFvQjtBQUNqRixlQUFLLGlCQUFpQixjQUFjO0FBQUEsUUFDckMsT0FFSztBQUNKLGVBQUssaUJBQWlCLGNBQWM7QUFBQSxRQUNyQztBQUFBLE1BQ0Q7QUFFQSxVQUFJLE9BQU8sT0FBTyxLQUFLLE9BQU8saUJBQWlCLGNBQWMsc0JBQXNCLEtBQUssdUJBQXVCLFlBQVk7QUFDMUgsYUFBSyxpQkFBaUIsY0FBYztBQUFBLE1BQ3JDO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLDRCQUE0QixRQUEwQjtBQUc3RCxRQUFJLEtBQUssUUFBUSxNQUFNLFVBQWEsS0FBSyxnQkFBZ0I7QUFDeEQ7QUFBQSxJQUNEO0FBRUEsVUFBTSxxQkFBc0IsS0FBSyxnQkFBZ0Isc0JBQXdCO0FBR3pFLFFBQUksS0FBSyxtQkFBbUIsY0FBYyxPQUFPO0FBRWhELFVBQUksT0FBTyxNQUFNLEtBQUssT0FBTyxpQkFBaUIsZUFBZSxxQkFBcUIsR0FBRztBQUNwRixhQUFLLGlCQUFpQixjQUFjO0FBQUEsTUFDckM7QUFBQSxJQUNELFdBR1MsS0FBSyxtQkFBbUIsY0FBYyxPQUFPO0FBRXJELFVBQUksT0FBTyxTQUFTLEtBQUssT0FBTyxpQkFBaUIsZUFBZSxxQkFBcUIsS0FBSyxjQUFjLGFBQWE7QUFDcEgsYUFBSyxpQkFBaUIsY0FBYztBQUFBLE1BQ3JDO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHFCQUFxQixRQUEwQjtBQUN0RCxRQUFJLFlBQVksS0FBSyxjQUFjLGNBQWM7QUFHakQsUUFBSSxLQUFLLGdCQUFnQjtBQUN4QixZQUFNLFdBQVcsS0FBSyxnQkFBZ0Isc0JBQXdCLEtBQUs7QUFDbkUsVUFBSSxLQUFLLG1CQUFtQixjQUFjLE9BQU87QUFDaEQsb0JBQVksS0FBSyxJQUFJLFdBQVcsT0FBTyxNQUFNLE9BQU87QUFBQSxNQUNyRCxXQUFXLEtBQUssbUJBQW1CLGNBQWMsT0FBTztBQUN2RCxvQkFBWSxLQUFLLElBQUksV0FBVyxLQUFLLGNBQWMsY0FBYyxPQUFPLFNBQVMsT0FBTztBQUFBLE1BQ3pGO0FBQUEsSUFDRDtBQUVBLFNBQUssT0FBTyxpQkFBaUIsTUFBTSxZQUFZLEdBQUcsU0FBUztBQUMzRCxRQUFJLEtBQUssT0FBTyxnQkFBZ0IsZUFBZSxLQUFLLE9BQU8sZ0JBQWdCLGNBQWM7QUFFeEYsWUFBTSxvQkFBb0IsR0FBRyxLQUFLLE9BQU8sVUFBVSxRQUFRLHFCQUFxQjtBQUNoRixVQUFJLEtBQUssT0FBTyxnQkFBZ0IsTUFBTSxpQkFBaUIsbUJBQW1CO0FBQ3pFLGFBQUssT0FBTyxnQkFBZ0IsTUFBTSxlQUFlO0FBQUEsTUFDbEQ7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVEsd0JBQXdCLFFBQTBCO0FBQ3pELFFBQUksQ0FBQyxLQUFLLGVBQWU7QUFDeEI7QUFBQSxJQUNEO0FBRUEsWUFBUSxLQUFLLGdCQUFnQjtBQUFBLE1BQzVCLEtBQUssY0FBYztBQUFBLE1BQ25CLEtBQUssY0FBYyxPQUFPO0FBQ3pCLGFBQUssY0FBYyxVQUFVLElBQUksS0FBSyxtQkFBbUIsY0FBYyxPQUFPLFVBQVUsTUFBTTtBQUM5RixjQUFNLGNBQWMsS0FBSyxPQUFPLGlCQUFpQjtBQUdqRCxZQUFJLGNBQWMsT0FBTyxRQUFRO0FBQ2hDLGVBQUssY0FBYyxNQUFNLE1BQU0sR0FBRyxPQUFPLE9BQU8sS0FBSyxLQUFLLEtBQUssZUFBZSxtQkFBcUI7QUFBQSxRQUNwRyxPQUdLO0FBQ0osZUFBSyxjQUFjLE1BQU0sTUFBTSxHQUFHLEtBQUssTUFBTyxjQUFjLENBQUUsSUFBSSxtQkFBcUI7QUFBQSxRQUN4RjtBQUVBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsS0FBSyxjQUFjO0FBQUEsTUFDbkIsS0FBSyxjQUFjLE9BQU87QUFDekIsYUFBSyxjQUFjLFVBQVUsSUFBSSxLQUFLLG1CQUFtQixjQUFjLFFBQVEsV0FBVyxLQUFLO0FBQy9GLGNBQU0sYUFBYSxLQUFLLE9BQU8saUJBQWlCO0FBR2hELFlBQUksc0JBQXNCLEtBQUssTUFBTyxhQUFhLENBQUUsSUFBSTtBQUd6RCxjQUFNLFdBQVcsS0FBSyxLQUFLO0FBQzNCLFlBQUksV0FBVyxPQUFPLFFBQVEsV0FBVyxPQUFPLE9BQU87QUFDdEQsZ0NBQXNCLE9BQU8sT0FBTyxJQUFJLEtBQUssS0FBSztBQUFBLFFBQ25EO0FBRUEsYUFBSyxjQUFjLE1BQU0sT0FBTyxHQUFHLG1CQUFtQjtBQUN0RDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRU8sUUFBUTtBQUNkLFNBQUssT0FBTyxpQkFBaUIsTUFBTTtBQUFBLEVBQ3BDO0FBQUEsRUFFTyxPQUFhO0FBQ25CLFNBQUssUUFBUTtBQUFBLEVBQ2Q7QUFBQSxFQUVnQixVQUFnQjtBQUMvQixRQUFJLENBQUMsS0FBSyxhQUFhO0FBQ3RCLFdBQUssV0FBVyxLQUFLO0FBQ3JCLFdBQUssUUFBUSxVQUFVO0FBQ3ZCLFdBQUssZ0JBQWdCLE9BQU87QUFDNUIsV0FBSyxrQkFBa0IsUUFBUTtBQUMvQixZQUFNLFFBQVE7QUFBQSxJQUNmO0FBQ0EsU0FBSyxjQUFjO0FBQUEsRUFDcEI7QUFDRDtBQS9rQmEsY0FBTjtBQUFBLEVBc0RKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBMURVO0FBaWxCYixNQUFNLDhCQUE4QixPQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFlMUMsWUFDUyxXQUNBLHNCQUE4QixLQUNyQztBQUNELFVBQU07QUFIRTtBQUNBO0FBaEJULFNBQVEsYUFBc0I7QUFDOUIsU0FBaUIsY0FBK0MsS0FBSyxVQUFVLElBQUksa0JBQWtCLENBQUM7QUFFdEcsU0FBaUIsY0FBYyxLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFpQmhFLGVBQVcsV0FBVyxLQUFLLFdBQVc7QUFDckMsV0FBSyxZQUFZLFNBQVMsTUFBTSxLQUFLLG1CQUFtQixDQUFDO0FBQ3pELFdBQUssYUFBYSxTQUFTLE1BQU0sS0FBSyxvQkFBb0IsQ0FBQztBQUFBLElBQzVEO0FBQUEsRUFDRDtBQUFBLEVBcEJBLElBQUksYUFBMEI7QUFBRSxXQUFPLEtBQUssWUFBWTtBQUFBLEVBQU87QUFBQSxFQUUvRCxJQUFJLFlBQXFCO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBWTtBQUFBLEVBb0IzQyxxQkFBMkI7QUFDbEMsU0FBSyxhQUFhO0FBQ2xCLFNBQUssWUFBWSxNQUFNO0FBQUEsRUFDeEI7QUFBQSxFQUVRLHNCQUE0QjtBQUNuQyxTQUFLLGFBQWE7QUFHbEIsU0FBSyxZQUFZLFFBQVEsSUFBSSxhQUFhLE1BQU0sS0FBSyxvQkFBb0IsR0FBRyxLQUFLLG1CQUFtQjtBQUFBLEVBQ3JHO0FBQUEsRUFFUSxzQkFBNEI7QUFDbkMsUUFBSSxDQUFDLEtBQUssWUFBWTtBQUNyQixXQUFLLFlBQVksS0FBSztBQUFBLElBQ3ZCO0FBQUEsRUFDRDtBQUNEO0FBRUEsTUFBTSxtQkFBMkM7QUFBQSxFQUdoRCxZQUNTLFVBQ1A7QUFETztBQUVSLFNBQUssaUJBQWlCLENBQUMsS0FBSyxRQUFRO0FBQUEsRUFDckM7QUFBQSxFQUVBLFVBQWdCO0FBQUEsRUFDaEI7QUFDRDsiLAogICJuYW1lcyI6IFsiQ29uc3RhbnRzIl0KfQo=
