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
import * as dom from "../../../../base/browser/dom.js";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { HoverStartSource } from "./hoverOperation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ResizableContentWidget } from "./resizableContentWidget.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { getHoverAccessibleViewHint, HoverWidget } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { PositionAffinity } from "../../../common/model.js";
import { Emitter } from "../../../../base/common/event.js";
const HORIZONTAL_SCROLLING_BY = 30;
let ContentHoverWidget = class extends ResizableContentWidget {
  constructor(editor, contextKeyService, _configurationService, _accessibilityService, _keybindingService) {
    const minimumHeight = editor.getOption(EditorOption.lineHeight) + 8;
    const minimumWidth = 150;
    const minimumSize = new dom.Dimension(minimumWidth, minimumHeight);
    super(editor, minimumSize);
    this._configurationService = _configurationService;
    this._accessibilityService = _accessibilityService;
    this._keybindingService = _keybindingService;
    this._hover = this._register(new HoverWidget(true));
    this._onDidResize = this._register(new Emitter());
    this.onDidResize = this._onDidResize.event;
    this._onDidScroll = this._register(new Emitter());
    this.onDidScroll = this._onDidScroll.event;
    this._minimumSize = minimumSize;
    this._hoverVisibleKey = EditorContextKeys.hoverVisible.bindTo(contextKeyService);
    this._hoverFocusedKey = EditorContextKeys.hoverFocused.bindTo(contextKeyService);
    dom.append(this._resizableNode.domNode, this._hover.containerDomNode);
    this._resizableNode.domNode.style.zIndex = "50";
    this._resizableNode.domNode.className = "monaco-resizable-hover";
    this._register(this._editor.onDidLayoutChange(() => {
      if (this.isVisible) {
        this._updateMaxDimensions();
      }
    }));
    this._register(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.fontInfo)) {
        this._updateFont();
      }
    }));
    const focusTracker = this._register(dom.trackFocus(this._resizableNode.domNode));
    this._register(focusTracker.onDidFocus(() => {
      this._hoverFocusedKey.set(true);
    }));
    this._register(focusTracker.onDidBlur(() => {
      this._hoverFocusedKey.set(false);
    }));
    this._register(this._hover.scrollbar.onScroll((e) => {
      this._onDidScroll.fire(e);
    }));
    this._setRenderedHover(void 0);
    this._editor.addContentWidget(this);
  }
  get isVisibleFromKeyboard() {
    return this._renderedHover?.source === HoverStartSource.Keyboard;
  }
  get isVisible() {
    return this._hoverVisibleKey.get() ?? false;
  }
  get isFocused() {
    return this._hoverFocusedKey.get() ?? false;
  }
  dispose() {
    super.dispose();
    this._renderedHover?.dispose();
    this._editor.removeContentWidget(this);
  }
  getId() {
    return ContentHoverWidget.ID;
  }
  static _applyDimensions(container, width, height) {
    const transformedWidth = typeof width === "number" ? `${width}px` : width;
    const transformedHeight = typeof height === "number" ? `${height}px` : height;
    container.style.width = transformedWidth;
    container.style.height = transformedHeight;
  }
  _setContentsDomNodeDimensions(width, height) {
    const contentsDomNode = this._hover.contentsDomNode;
    return ContentHoverWidget._applyDimensions(contentsDomNode, width, height);
  }
  _setContainerDomNodeDimensions(width, height) {
    const containerDomNode = this._hover.containerDomNode;
    return ContentHoverWidget._applyDimensions(containerDomNode, width, height);
  }
  _setScrollableElementDimensions(width, height) {
    const scrollbarDomElement = this._hover.scrollbar.getDomNode();
    return ContentHoverWidget._applyDimensions(scrollbarDomElement, width, height);
  }
  _setHoverWidgetDimensions(width, height) {
    this._setContainerDomNodeDimensions(width, height);
    this._setScrollableElementDimensions(width, height);
    this._setContentsDomNodeDimensions(width, height);
    this._layoutContentWidget();
  }
  static _applyMaxDimensions(container, width, height) {
    const transformedWidth = typeof width === "number" ? `${width}px` : width;
    const transformedHeight = typeof height === "number" ? `${height}px` : height;
    container.style.maxWidth = transformedWidth;
    container.style.maxHeight = transformedHeight;
  }
  _setHoverWidgetMaxDimensions(width, height) {
    ContentHoverWidget._applyMaxDimensions(this._hover.contentsDomNode, width, height);
    ContentHoverWidget._applyMaxDimensions(this._hover.scrollbar.getDomNode(), width, height);
    ContentHoverWidget._applyMaxDimensions(this._hover.containerDomNode, width, height);
    this._hover.containerDomNode.style.setProperty("--vscode-hover-maxWidth", typeof width === "number" ? `${width}px` : width);
    this._layoutContentWidget();
  }
  _setAdjustedHoverWidgetDimensions(size) {
    this._setHoverWidgetMaxDimensions("none", "none");
    this._setHoverWidgetDimensions(size.width, size.height);
  }
  _updateResizableNodeMaxDimensions() {
    const maxRenderingWidth = this._findMaximumRenderingWidth() ?? Infinity;
    const maxRenderingHeight = this._findMaximumRenderingHeight() ?? Infinity;
    this._resizableNode.maxSize = new dom.Dimension(maxRenderingWidth, maxRenderingHeight);
    this._setHoverWidgetMaxDimensions(maxRenderingWidth, maxRenderingHeight);
  }
  _resize(size) {
    ContentHoverWidget._lastDimensions = new dom.Dimension(size.width, size.height);
    this._setAdjustedHoverWidgetDimensions(size);
    this._resizableNode.layout(size.height, size.width);
    this._updateResizableNodeMaxDimensions();
    this._hover.scrollbar.scanDomNode();
    this._editor.layoutContentWidget(this);
    this._onDidResize.fire();
  }
  _findAvailableSpaceVertically() {
    const position = this._renderedHover?.showAtPosition;
    if (!position) {
      return;
    }
    return this._positionPreference === ContentWidgetPositionPreference.ABOVE ? this._availableVerticalSpaceAbove(position) : this._availableVerticalSpaceBelow(position);
  }
  _findMaximumRenderingHeight() {
    const availableSpace = this._findAvailableSpaceVertically();
    if (!availableSpace) {
      return;
    }
    const children = this._hover.contentsDomNode.children;
    let maximumHeight = children.length - 1;
    Array.from(this._hover.contentsDomNode.children).forEach((hoverPart) => {
      maximumHeight += hoverPart.clientHeight;
    });
    return Math.min(availableSpace, maximumHeight);
  }
  _isHoverTextOverflowing() {
    this._hover.containerDomNode.style.setProperty("--vscode-hover-whiteSpace", "nowrap");
    this._hover.containerDomNode.style.setProperty("--vscode-hover-sourceWhiteSpace", "nowrap");
    const overflowing = Array.from(this._hover.contentsDomNode.children).some((hoverElement) => {
      return hoverElement.scrollWidth > hoverElement.clientWidth;
    });
    this._hover.containerDomNode.style.removeProperty("--vscode-hover-whiteSpace");
    this._hover.containerDomNode.style.removeProperty("--vscode-hover-sourceWhiteSpace");
    return overflowing;
  }
  _findMaximumRenderingWidth() {
    if (!this._editor || !this._editor.hasModel()) {
      return;
    }
    const overflowing = this._isHoverTextOverflowing();
    const initialWidth = typeof this._contentWidth === "undefined" ? 0 : this._contentWidth;
    if (overflowing || this._hover.containerDomNode.clientWidth < initialWidth) {
      const bodyBoxWidth = dom.getClientArea(this._hover.containerDomNode.ownerDocument.body).width;
      const horizontalPadding = 14;
      return bodyBoxWidth - horizontalPadding;
    } else {
      return this._hover.containerDomNode.clientWidth;
    }
  }
  isMouseGettingCloser(posx, posy) {
    if (!this._renderedHover) {
      return false;
    }
    if (this._renderedHover.initialMousePosX === void 0 || this._renderedHover.initialMousePosY === void 0) {
      this._renderedHover.initialMousePosX = posx;
      this._renderedHover.initialMousePosY = posy;
      return false;
    }
    const widgetRect = dom.getDomNodePagePosition(this.getDomNode());
    if (this._renderedHover.closestMouseDistance === void 0) {
      this._renderedHover.closestMouseDistance = computeDistanceFromPointToRectangle(
        this._renderedHover.initialMousePosX,
        this._renderedHover.initialMousePosY,
        widgetRect.left,
        widgetRect.top,
        widgetRect.width,
        widgetRect.height
      );
    }
    const distance = computeDistanceFromPointToRectangle(
      posx,
      posy,
      widgetRect.left,
      widgetRect.top,
      widgetRect.width,
      widgetRect.height
    );
    if (distance > this._renderedHover.closestMouseDistance + 4) {
      return false;
    }
    this._renderedHover.closestMouseDistance = Math.min(this._renderedHover.closestMouseDistance, distance);
    return true;
  }
  _setRenderedHover(renderedHover) {
    this._renderedHover?.dispose();
    this._renderedHover = renderedHover;
    this._hoverVisibleKey.set(!!renderedHover);
    this._hover.containerDomNode.classList.toggle("hidden", !renderedHover);
  }
  _updateFont() {
    const { fontSize, lineHeight } = this._editor.getOption(EditorOption.fontInfo);
    const contentsDomNode = this._hover.contentsDomNode;
    contentsDomNode.style.fontSize = `${fontSize}px`;
    contentsDomNode.style.lineHeight = `${lineHeight / fontSize}`;
    const codeClasses = Array.prototype.slice.call(this._hover.contentsDomNode.getElementsByClassName("code"));
    codeClasses.forEach((node) => this._editor.applyFontInfo(node));
  }
  _updateContent(node) {
    const contentsDomNode = this._hover.contentsDomNode;
    contentsDomNode.style.paddingBottom = "";
    contentsDomNode.textContent = "";
    contentsDomNode.appendChild(node);
  }
  _layoutContentWidget() {
    this._editor.layoutContentWidget(this);
    this._hover.onContentsChanged();
  }
  _updateMaxDimensions() {
    const height = Math.max(this._editor.getLayoutInfo().height / 4, 250, ContentHoverWidget._lastDimensions.height);
    const width = Math.max(this._editor.getLayoutInfo().width * 0.66, 750, ContentHoverWidget._lastDimensions.width);
    this._resizableNode.maxSize = new dom.Dimension(width, height);
    this._setHoverWidgetMaxDimensions(width, height);
  }
  _render(renderedHover) {
    this._setRenderedHover(renderedHover);
    this._updateFont();
    this._updateContent(renderedHover.domNode);
    this.onContentsChanged();
    this._editor.render();
  }
  getPosition() {
    if (!this._renderedHover) {
      return null;
    }
    return {
      position: this._renderedHover.showAtPosition,
      secondaryPosition: this._renderedHover.showAtSecondaryPosition,
      positionAffinity: this._renderedHover.shouldAppearBeforeContent ? PositionAffinity.LeftOfInjectedText : void 0,
      preference: [this._positionPreference ?? ContentWidgetPositionPreference.ABOVE]
    };
  }
  show(renderedHover) {
    if (!this._editor || !this._editor.hasModel()) {
      return;
    }
    this._render(renderedHover);
    const widgetHeight = dom.getTotalHeight(this._hover.containerDomNode);
    const widgetPosition = renderedHover.showAtPosition;
    this._positionPreference = this._findPositionPreference(widgetHeight, widgetPosition) ?? ContentWidgetPositionPreference.ABOVE;
    this.onContentsChanged();
    if (renderedHover.shouldFocus) {
      this._hover.containerDomNode.focus();
    }
    this._onDidResize.fire();
    const hoverFocused = this._hover.containerDomNode.ownerDocument.activeElement === this._hover.containerDomNode;
    const accessibleViewHint = hoverFocused && getHoverAccessibleViewHint(
      this._configurationService.getValue("accessibility.verbosity.hover") === true && this._accessibilityService.isScreenReaderOptimized(),
      this._keybindingService.lookupKeybinding("editor.action.accessibleView")?.getAriaLabel() ?? ""
    );
    if (accessibleViewHint) {
      this._hover.contentsDomNode.ariaLabel = this._hover.contentsDomNode.textContent + ", " + accessibleViewHint;
    }
  }
  hide() {
    if (!this._renderedHover) {
      return;
    }
    const hoverStoleFocus = this._renderedHover.shouldFocus || this._hoverFocusedKey.get();
    this._setRenderedHover(void 0);
    this._resizableNode.maxSize = new dom.Dimension(Infinity, Infinity);
    this._resizableNode.clearSashHoverState();
    this._hoverFocusedKey.set(false);
    this._editor.layoutContentWidget(this);
    if (hoverStoleFocus) {
      this._editor.focus();
    }
  }
  _removeConstraintsRenderNormally() {
    const layoutInfo = this._editor.getLayoutInfo();
    this._resizableNode.layout(layoutInfo.height, layoutInfo.width);
    this._setHoverWidgetDimensions("auto", "auto");
    this._updateMaxDimensions();
  }
  setMinimumDimensions(dimensions) {
    this._minimumSize = new dom.Dimension(
      Math.max(this._minimumSize.width, dimensions.width),
      Math.max(this._minimumSize.height, dimensions.height)
    );
    this._updateMinimumWidth();
  }
  _updateMinimumWidth() {
    const width = typeof this._contentWidth === "undefined" ? this._minimumSize.width : Math.min(this._contentWidth, this._minimumSize.width);
    this._resizableNode.minSize = new dom.Dimension(width, this._minimumSize.height);
  }
  onContentsChanged() {
    this._removeConstraintsRenderNormally();
    const contentsDomNode = this._hover.contentsDomNode;
    let height = dom.getTotalHeight(contentsDomNode);
    let width = dom.getTotalWidth(contentsDomNode) + 2;
    this._resizableNode.layout(height, width);
    this._setHoverWidgetDimensions(width, height);
    height = dom.getTotalHeight(contentsDomNode);
    width = dom.getTotalWidth(contentsDomNode);
    this._contentWidth = width;
    this._updateMinimumWidth();
    this._resizableNode.layout(height, width);
    if (this._renderedHover?.showAtPosition) {
      const widgetHeight = dom.getTotalHeight(this._hover.containerDomNode);
      this._positionPreference = this._findPositionPreference(widgetHeight, this._renderedHover.showAtPosition);
    }
    this._layoutContentWidget();
  }
  focus() {
    this._hover.containerDomNode.focus();
  }
  scrollUp() {
    const scrollTop = this._hover.scrollbar.getScrollPosition().scrollTop;
    const fontInfo = this._editor.getOption(EditorOption.fontInfo);
    this._hover.scrollbar.setScrollPosition({ scrollTop: scrollTop - fontInfo.lineHeight });
  }
  scrollDown() {
    const scrollTop = this._hover.scrollbar.getScrollPosition().scrollTop;
    const fontInfo = this._editor.getOption(EditorOption.fontInfo);
    this._hover.scrollbar.setScrollPosition({ scrollTop: scrollTop + fontInfo.lineHeight });
  }
  scrollLeft() {
    const scrollLeft = this._hover.scrollbar.getScrollPosition().scrollLeft;
    this._hover.scrollbar.setScrollPosition({ scrollLeft: scrollLeft - HORIZONTAL_SCROLLING_BY });
  }
  scrollRight() {
    const scrollLeft = this._hover.scrollbar.getScrollPosition().scrollLeft;
    this._hover.scrollbar.setScrollPosition({ scrollLeft: scrollLeft + HORIZONTAL_SCROLLING_BY });
  }
  pageUp() {
    const scrollTop = this._hover.scrollbar.getScrollPosition().scrollTop;
    const scrollHeight = this._hover.scrollbar.getScrollDimensions().height;
    this._hover.scrollbar.setScrollPosition({ scrollTop: scrollTop - scrollHeight });
  }
  pageDown() {
    const scrollTop = this._hover.scrollbar.getScrollPosition().scrollTop;
    const scrollHeight = this._hover.scrollbar.getScrollDimensions().height;
    this._hover.scrollbar.setScrollPosition({ scrollTop: scrollTop + scrollHeight });
  }
  goToTop() {
    this._hover.scrollbar.setScrollPosition({ scrollTop: 0 });
  }
  goToBottom() {
    this._hover.scrollbar.setScrollPosition({ scrollTop: this._hover.scrollbar.getScrollDimensions().scrollHeight });
  }
};
ContentHoverWidget.ID = "editor.contrib.resizableContentHoverWidget";
ContentHoverWidget._lastDimensions = new dom.Dimension(0, 0);
ContentHoverWidget = __decorateClass([
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IAccessibilityService),
  __decorateParam(4, IKeybindingService)
], ContentHoverWidget);
function computeDistanceFromPointToRectangle(pointX, pointY, left, top, width, height) {
  const x = left + width / 2;
  const y = top + height / 2;
  const dx = Math.max(Math.abs(pointX - x) - width / 2, 0);
  const dy = Math.max(Math.abs(pointY - y) - height / 2, 0);
  return Math.sqrt(dx * dx + dy * dy);
}
export {
  ContentHoverWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2NvbnRlbnRIb3ZlcldpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UsIElDb2RlRWRpdG9yLCBJQ29udGVudFdpZGdldFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBIb3ZlclN0YXJ0U291cmNlIH0gZnJvbSAnLi9ob3Zlck9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IFJlc2l6YWJsZUNvbnRlbnRXaWRnZXQgfSBmcm9tICcuL3Jlc2l6YWJsZUNvbnRlbnRXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IGdldEhvdmVyQWNjZXNzaWJsZVZpZXdIaW50LCBIb3ZlcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlcldpZGdldC5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbkFmZmluaXR5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBSZW5kZXJlZENvbnRlbnRIb3ZlciB9IGZyb20gJy4vY29udGVudEhvdmVyUmVuZGVyZWQuanMnO1xuaW1wb3J0IHsgU2Nyb2xsRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zY3JvbGxhYmxlLmpzJztcblxuY29uc3QgSE9SSVpPTlRBTF9TQ1JPTExJTkdfQlkgPSAzMDtcblxuZXhwb3J0IGNsYXNzIENvbnRlbnRIb3ZlcldpZGdldCBleHRlbmRzIFJlc2l6YWJsZUNvbnRlbnRXaWRnZXQge1xuXG5cdHB1YmxpYyBzdGF0aWMgSUQgPSAnZWRpdG9yLmNvbnRyaWIucmVzaXphYmxlQ29udGVudEhvdmVyV2lkZ2V0Jztcblx0cHJpdmF0ZSBzdGF0aWMgX2xhc3REaW1lbnNpb25zOiBkb20uRGltZW5zaW9uID0gbmV3IGRvbS5EaW1lbnNpb24oMCwgMCk7XG5cblx0cHJpdmF0ZSBfcmVuZGVyZWRIb3ZlcjogUmVuZGVyZWRDb250ZW50SG92ZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Bvc2l0aW9uUHJlZmVyZW5jZTogQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfbWluaW11bVNpemU6IGRvbS5EaW1lbnNpb247XG5cdHByaXZhdGUgX2NvbnRlbnRXaWR0aDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyOiBIb3ZlcldpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBIb3ZlcldpZGdldCh0cnVlKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyVmlzaWJsZUtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyRm9jdXNlZEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXNpemUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkUmVzaXplID0gdGhpcy5fb25EaWRSZXNpemUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTY3JvbGwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxTY3JvbGxFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFNjcm9sbCA9IHRoaXMuX29uRGlkU2Nyb2xsLmV2ZW50O1xuXG5cdHB1YmxpYyBnZXQgaXNWaXNpYmxlRnJvbUtleWJvYXJkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5fcmVuZGVyZWRIb3Zlcj8uc291cmNlID09PSBIb3ZlclN0YXJ0U291cmNlLktleWJvYXJkKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgaXNWaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9ob3ZlclZpc2libGVLZXkuZ2V0KCkgPz8gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzRm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faG92ZXJGb2N1c2VkS2V5LmdldCgpID8/IGZhbHNlO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgbWluaW11bUhlaWdodCA9IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpICsgODtcblx0XHRjb25zdCBtaW5pbXVtV2lkdGggPSAxNTA7XG5cdFx0Y29uc3QgbWluaW11bVNpemUgPSBuZXcgZG9tLkRpbWVuc2lvbihtaW5pbXVtV2lkdGgsIG1pbmltdW1IZWlnaHQpO1xuXHRcdHN1cGVyKGVkaXRvciwgbWluaW11bVNpemUpO1xuXG5cdFx0dGhpcy5fbWluaW11bVNpemUgPSBtaW5pbXVtU2l6ZTtcblx0XHR0aGlzLl9ob3ZlclZpc2libGVLZXkgPSBFZGl0b3JDb250ZXh0S2V5cy5ob3ZlclZpc2libGUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9ob3ZlckZvY3VzZWRLZXkgPSBFZGl0b3JDb250ZXh0S2V5cy5ob3ZlckZvY3VzZWQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGRvbS5hcHBlbmQodGhpcy5fcmVzaXphYmxlTm9kZS5kb21Ob2RlLCB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlKTtcblx0XHR0aGlzLl9yZXNpemFibGVOb2RlLmRvbU5vZGUuc3R5bGUuekluZGV4ID0gJzUwJztcblx0XHR0aGlzLl9yZXNpemFibGVOb2RlLmRvbU5vZGUuY2xhc3NOYW1lID0gJ21vbmFjby1yZXNpemFibGUtaG92ZXInO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkTGF5b3V0Q2hhbmdlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVNYXhEaW1lbnNpb25zKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKGU6IENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQpID0+IHtcblx0XHRcdGlmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVGb250KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGNvbnN0IGZvY3VzVHJhY2tlciA9IHRoaXMuX3JlZ2lzdGVyKGRvbS50cmFja0ZvY3VzKHRoaXMuX3Jlc2l6YWJsZU5vZGUuZG9tTm9kZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHtcblx0XHRcdHRoaXMuX2hvdmVyRm9jdXNlZEtleS5zZXQodHJ1ZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4ge1xuXHRcdFx0dGhpcy5faG92ZXJGb2N1c2VkS2V5LnNldChmYWxzZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2hvdmVyLnNjcm9sbGJhci5vblNjcm9sbCgoZSkgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRTY3JvbGwuZmlyZShlKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fc2V0UmVuZGVyZWRIb3Zlcih1bmRlZmluZWQpO1xuXHRcdHRoaXMuX2VkaXRvci5hZGRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3JlbmRlcmVkSG92ZXI/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9lZGl0b3IucmVtb3ZlQ29udGVudFdpZGdldCh0aGlzKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBDb250ZW50SG92ZXJXaWRnZXQuSUQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfYXBwbHlEaW1lbnNpb25zKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHdpZHRoOiBudW1iZXIgfCBzdHJpbmcsIGhlaWdodDogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgdHJhbnNmb3JtZWRXaWR0aCA9IHR5cGVvZiB3aWR0aCA9PT0gJ251bWJlcicgPyBgJHt3aWR0aH1weGAgOiB3aWR0aDtcblx0XHRjb25zdCB0cmFuc2Zvcm1lZEhlaWdodCA9IHR5cGVvZiBoZWlnaHQgPT09ICdudW1iZXInID8gYCR7aGVpZ2h0fXB4YCA6IGhlaWdodDtcblx0XHRjb250YWluZXIuc3R5bGUud2lkdGggPSB0cmFuc2Zvcm1lZFdpZHRoO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSB0cmFuc2Zvcm1lZEhlaWdodDtcblx0fVxuXG5cdHByaXZhdGUgX3NldENvbnRlbnRzRG9tTm9kZURpbWVuc2lvbnMod2lkdGg6IG51bWJlciB8IHN0cmluZywgaGVpZ2h0OiBudW1iZXIgfCBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBjb250ZW50c0RvbU5vZGUgPSB0aGlzLl9ob3Zlci5jb250ZW50c0RvbU5vZGU7XG5cdFx0cmV0dXJuIENvbnRlbnRIb3ZlcldpZGdldC5fYXBwbHlEaW1lbnNpb25zKGNvbnRlbnRzRG9tTm9kZSwgd2lkdGgsIGhlaWdodCk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRDb250YWluZXJEb21Ob2RlRGltZW5zaW9ucyh3aWR0aDogbnVtYmVyIHwgc3RyaW5nLCBoZWlnaHQ6IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRhaW5lckRvbU5vZGUgPSB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlO1xuXHRcdHJldHVybiBDb250ZW50SG92ZXJXaWRnZXQuX2FwcGx5RGltZW5zaW9ucyhjb250YWluZXJEb21Ob2RlLCB3aWR0aCwgaGVpZ2h0KTtcblx0fVxuXG5cdHByaXZhdGUgX3NldFNjcm9sbGFibGVFbGVtZW50RGltZW5zaW9ucyh3aWR0aDogbnVtYmVyIHwgc3RyaW5nLCBoZWlnaHQ6IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHNjcm9sbGJhckRvbUVsZW1lbnQgPSB0aGlzLl9ob3Zlci5zY3JvbGxiYXIuZ2V0RG9tTm9kZSgpO1xuXHRcdHJldHVybiBDb250ZW50SG92ZXJXaWRnZXQuX2FwcGx5RGltZW5zaW9ucyhzY3JvbGxiYXJEb21FbGVtZW50LCB3aWR0aCwgaGVpZ2h0KTtcblx0fVxuXG5cdHByaXZhdGUgX3NldEhvdmVyV2lkZ2V0RGltZW5zaW9ucyh3aWR0aDogbnVtYmVyIHwgc3RyaW5nLCBoZWlnaHQ6IG51bWJlciB8IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3NldENvbnRhaW5lckRvbU5vZGVEaW1lbnNpb25zKHdpZHRoLCBoZWlnaHQpO1xuXHRcdHRoaXMuX3NldFNjcm9sbGFibGVFbGVtZW50RGltZW5zaW9ucyh3aWR0aCwgaGVpZ2h0KTtcblx0XHR0aGlzLl9zZXRDb250ZW50c0RvbU5vZGVEaW1lbnNpb25zKHdpZHRoLCBoZWlnaHQpO1xuXHRcdHRoaXMuX2xheW91dENvbnRlbnRXaWRnZXQoKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9hcHBseU1heERpbWVuc2lvbnMoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgd2lkdGg6IG51bWJlciB8IHN0cmluZywgaGVpZ2h0OiBudW1iZXIgfCBzdHJpbmcpIHtcblx0XHRjb25zdCB0cmFuc2Zvcm1lZFdpZHRoID0gdHlwZW9mIHdpZHRoID09PSAnbnVtYmVyJyA/IGAke3dpZHRofXB4YCA6IHdpZHRoO1xuXHRcdGNvbnN0IHRyYW5zZm9ybWVkSGVpZ2h0ID0gdHlwZW9mIGhlaWdodCA9PT0gJ251bWJlcicgPyBgJHtoZWlnaHR9cHhgIDogaGVpZ2h0O1xuXHRcdGNvbnRhaW5lci5zdHlsZS5tYXhXaWR0aCA9IHRyYW5zZm9ybWVkV2lkdGg7XG5cdFx0Y29udGFpbmVyLnN0eWxlLm1heEhlaWdodCA9IHRyYW5zZm9ybWVkSGVpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0SG92ZXJXaWRnZXRNYXhEaW1lbnNpb25zKHdpZHRoOiBudW1iZXIgfCBzdHJpbmcsIGhlaWdodDogbnVtYmVyIHwgc3RyaW5nKTogdm9pZCB7XG5cdFx0Q29udGVudEhvdmVyV2lkZ2V0Ll9hcHBseU1heERpbWVuc2lvbnModGhpcy5faG92ZXIuY29udGVudHNEb21Ob2RlLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRDb250ZW50SG92ZXJXaWRnZXQuX2FwcGx5TWF4RGltZW5zaW9ucyh0aGlzLl9ob3Zlci5zY3JvbGxiYXIuZ2V0RG9tTm9kZSgpLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRDb250ZW50SG92ZXJXaWRnZXQuX2FwcGx5TWF4RGltZW5zaW9ucyh0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHR0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLnN0eWxlLnNldFByb3BlcnR5KCctLXZzY29kZS1ob3Zlci1tYXhXaWR0aCcsIHR5cGVvZiB3aWR0aCA9PT0gJ251bWJlcicgPyBgJHt3aWR0aH1weGAgOiB3aWR0aCk7XG5cdFx0dGhpcy5fbGF5b3V0Q29udGVudFdpZGdldCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0QWRqdXN0ZWRIb3ZlcldpZGdldERpbWVuc2lvbnMoc2l6ZTogZG9tLkRpbWVuc2lvbik6IHZvaWQge1xuXHRcdHRoaXMuX3NldEhvdmVyV2lkZ2V0TWF4RGltZW5zaW9ucygnbm9uZScsICdub25lJyk7XG5cdFx0dGhpcy5fc2V0SG92ZXJXaWRnZXREaW1lbnNpb25zKHNpemUud2lkdGgsIHNpemUuaGVpZ2h0KTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVJlc2l6YWJsZU5vZGVNYXhEaW1lbnNpb25zKCk6IHZvaWQge1xuXHRcdGNvbnN0IG1heFJlbmRlcmluZ1dpZHRoID0gdGhpcy5fZmluZE1heGltdW1SZW5kZXJpbmdXaWR0aCgpID8/IEluZmluaXR5O1xuXHRcdGNvbnN0IG1heFJlbmRlcmluZ0hlaWdodCA9IHRoaXMuX2ZpbmRNYXhpbXVtUmVuZGVyaW5nSGVpZ2h0KCkgPz8gSW5maW5pdHk7XG5cdFx0dGhpcy5fcmVzaXphYmxlTm9kZS5tYXhTaXplID0gbmV3IGRvbS5EaW1lbnNpb24obWF4UmVuZGVyaW5nV2lkdGgsIG1heFJlbmRlcmluZ0hlaWdodCk7XG5cdFx0dGhpcy5fc2V0SG92ZXJXaWRnZXRNYXhEaW1lbnNpb25zKG1heFJlbmRlcmluZ1dpZHRoLCBtYXhSZW5kZXJpbmdIZWlnaHQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF9yZXNpemUoc2l6ZTogZG9tLkRpbWVuc2lvbik6IHZvaWQge1xuXHRcdENvbnRlbnRIb3ZlcldpZGdldC5fbGFzdERpbWVuc2lvbnMgPSBuZXcgZG9tLkRpbWVuc2lvbihzaXplLndpZHRoLCBzaXplLmhlaWdodCk7XG5cdFx0dGhpcy5fc2V0QWRqdXN0ZWRIb3ZlcldpZGdldERpbWVuc2lvbnMoc2l6ZSk7XG5cdFx0dGhpcy5fcmVzaXphYmxlTm9kZS5sYXlvdXQoc2l6ZS5oZWlnaHQsIHNpemUud2lkdGgpO1xuXHRcdHRoaXMuX3VwZGF0ZVJlc2l6YWJsZU5vZGVNYXhEaW1lbnNpb25zKCk7XG5cdFx0dGhpcy5faG92ZXIuc2Nyb2xsYmFyLnNjYW5Eb21Ob2RlKCk7XG5cdFx0dGhpcy5fZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0dGhpcy5fb25EaWRSZXNpemUuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmluZEF2YWlsYWJsZVNwYWNlVmVydGljYWxseSgpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fcmVuZGVyZWRIb3Zlcj8uc2hvd0F0UG9zaXRpb247XG5cdFx0aWYgKCFwb3NpdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcG9zaXRpb25QcmVmZXJlbmNlID09PSBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkFCT1ZFID9cblx0XHRcdHRoaXMuX2F2YWlsYWJsZVZlcnRpY2FsU3BhY2VBYm92ZShwb3NpdGlvbilcblx0XHRcdDogdGhpcy5fYXZhaWxhYmxlVmVydGljYWxTcGFjZUJlbG93KHBvc2l0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgX2ZpbmRNYXhpbXVtUmVuZGVyaW5nSGVpZ2h0KCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgYXZhaWxhYmxlU3BhY2UgPSB0aGlzLl9maW5kQXZhaWxhYmxlU3BhY2VWZXJ0aWNhbGx5KCk7XG5cdFx0aWYgKCFhdmFpbGFibGVTcGFjZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjaGlsZHJlbiA9IHRoaXMuX2hvdmVyLmNvbnRlbnRzRG9tTm9kZS5jaGlsZHJlbjtcblx0XHRsZXQgbWF4aW11bUhlaWdodCA9IGNoaWxkcmVuLmxlbmd0aCAtIDE7XG5cdFx0QXJyYXkuZnJvbSh0aGlzLl9ob3Zlci5jb250ZW50c0RvbU5vZGUuY2hpbGRyZW4pLmZvckVhY2goKGhvdmVyUGFydCkgPT4ge1xuXHRcdFx0bWF4aW11bUhlaWdodCArPSBob3ZlclBhcnQuY2xpZW50SGVpZ2h0O1xuXHRcdH0pO1xuXHRcdHJldHVybiBNYXRoLm1pbihhdmFpbGFibGVTcGFjZSwgbWF4aW11bUhlaWdodCk7XG5cdH1cblxuXHRwcml2YXRlIF9pc0hvdmVyVGV4dE92ZXJmbG93aW5nKCk6IGJvb2xlYW4ge1xuXHRcdC8vIFRvIGZpbmQgb3V0IGlmIHRoZSB0ZXh0IGlzIG92ZXJmbG93aW5nLCB3ZSB3aWxsIGRpc2FibGUgd3JhcHBpbmcsIGNoZWNrIHRoZSB3aWR0aHMsIGFuZCB0aGVuIHJlLWVuYWJsZSB3cmFwcGluZ1xuXHRcdHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuc3R5bGUuc2V0UHJvcGVydHkoJy0tdnNjb2RlLWhvdmVyLXdoaXRlU3BhY2UnLCAnbm93cmFwJyk7XG5cdFx0dGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZS5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12c2NvZGUtaG92ZXItc291cmNlV2hpdGVTcGFjZScsICdub3dyYXAnKTtcblxuXHRcdGNvbnN0IG92ZXJmbG93aW5nID0gQXJyYXkuZnJvbSh0aGlzLl9ob3Zlci5jb250ZW50c0RvbU5vZGUuY2hpbGRyZW4pLnNvbWUoKGhvdmVyRWxlbWVudCkgPT4ge1xuXHRcdFx0cmV0dXJuIGhvdmVyRWxlbWVudC5zY3JvbGxXaWR0aCA+IGhvdmVyRWxlbWVudC5jbGllbnRXaWR0aDtcblx0XHR9KTtcblxuXHRcdHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuc3R5bGUucmVtb3ZlUHJvcGVydHkoJy0tdnNjb2RlLWhvdmVyLXdoaXRlU3BhY2UnKTtcblx0XHR0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLnN0eWxlLnJlbW92ZVByb3BlcnR5KCctLXZzY29kZS1ob3Zlci1zb3VyY2VXaGl0ZVNwYWNlJyk7XG5cblx0XHRyZXR1cm4gb3ZlcmZsb3dpbmc7XG5cdH1cblxuXHRwcml2YXRlIF9maW5kTWF4aW11bVJlbmRlcmluZ1dpZHRoKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IgfHwgIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3ZlcmZsb3dpbmcgPSB0aGlzLl9pc0hvdmVyVGV4dE92ZXJmbG93aW5nKCk7XG5cdFx0Y29uc3QgaW5pdGlhbFdpZHRoID0gKFxuXHRcdFx0dHlwZW9mIHRoaXMuX2NvbnRlbnRXaWR0aCA9PT0gJ3VuZGVmaW5lZCdcblx0XHRcdFx0PyAwXG5cdFx0XHRcdDogdGhpcy5fY29udGVudFdpZHRoXG5cdFx0KTtcblxuXHRcdGlmIChvdmVyZmxvd2luZyB8fCB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLmNsaWVudFdpZHRoIDwgaW5pdGlhbFdpZHRoKSB7XG5cdFx0XHRjb25zdCBib2R5Qm94V2lkdGggPSBkb20uZ2V0Q2xpZW50QXJlYSh0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlLm93bmVyRG9jdW1lbnQuYm9keSkud2lkdGg7XG5cdFx0XHRjb25zdCBob3Jpem9udGFsUGFkZGluZyA9IDE0O1xuXHRcdFx0cmV0dXJuIGJvZHlCb3hXaWR0aCAtIGhvcml6b250YWxQYWRkaW5nO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZS5jbGllbnRXaWR0aDtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgaXNNb3VzZUdldHRpbmdDbG9zZXIocG9zeDogbnVtYmVyLCBwb3N5OiBudW1iZXIpOiBib29sZWFuIHtcblxuXHRcdGlmICghdGhpcy5fcmVuZGVyZWRIb3Zlcikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fcmVuZGVyZWRIb3Zlci5pbml0aWFsTW91c2VQb3NYID09PSB1bmRlZmluZWQgfHwgdGhpcy5fcmVuZGVyZWRIb3Zlci5pbml0aWFsTW91c2VQb3NZID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3JlbmRlcmVkSG92ZXIuaW5pdGlhbE1vdXNlUG9zWCA9IHBvc3g7XG5cdFx0XHR0aGlzLl9yZW5kZXJlZEhvdmVyLmluaXRpYWxNb3VzZVBvc1kgPSBwb3N5O1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdpZGdldFJlY3QgPSBkb20uZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0aGlzLmdldERvbU5vZGUoKSk7XG5cdFx0aWYgKHRoaXMuX3JlbmRlcmVkSG92ZXIuY2xvc2VzdE1vdXNlRGlzdGFuY2UgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fcmVuZGVyZWRIb3Zlci5jbG9zZXN0TW91c2VEaXN0YW5jZSA9IGNvbXB1dGVEaXN0YW5jZUZyb21Qb2ludFRvUmVjdGFuZ2xlKFxuXHRcdFx0XHR0aGlzLl9yZW5kZXJlZEhvdmVyLmluaXRpYWxNb3VzZVBvc1gsXG5cdFx0XHRcdHRoaXMuX3JlbmRlcmVkSG92ZXIuaW5pdGlhbE1vdXNlUG9zWSxcblx0XHRcdFx0d2lkZ2V0UmVjdC5sZWZ0LFxuXHRcdFx0XHR3aWRnZXRSZWN0LnRvcCxcblx0XHRcdFx0d2lkZ2V0UmVjdC53aWR0aCxcblx0XHRcdFx0d2lkZ2V0UmVjdC5oZWlnaHRcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzdGFuY2UgPSBjb21wdXRlRGlzdGFuY2VGcm9tUG9pbnRUb1JlY3RhbmdsZShcblx0XHRcdHBvc3gsXG5cdFx0XHRwb3N5LFxuXHRcdFx0d2lkZ2V0UmVjdC5sZWZ0LFxuXHRcdFx0d2lkZ2V0UmVjdC50b3AsXG5cdFx0XHR3aWRnZXRSZWN0LndpZHRoLFxuXHRcdFx0d2lkZ2V0UmVjdC5oZWlnaHRcblx0XHQpO1xuXHRcdGlmIChkaXN0YW5jZSA+IHRoaXMuX3JlbmRlcmVkSG92ZXIuY2xvc2VzdE1vdXNlRGlzdGFuY2UgKyA0IC8qIHRvbGVyYW5jZSBvZiA0IHBpeGVscyAqLykge1xuXHRcdFx0Ly8gVGhlIG1vdXNlIGlzIGdldHRpbmcgZmFydGhlciBhd2F5XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVuZGVyZWRIb3Zlci5jbG9zZXN0TW91c2VEaXN0YW5jZSA9IE1hdGgubWluKHRoaXMuX3JlbmRlcmVkSG92ZXIuY2xvc2VzdE1vdXNlRGlzdGFuY2UsIGRpc3RhbmNlKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX3NldFJlbmRlcmVkSG92ZXIocmVuZGVyZWRIb3ZlcjogUmVuZGVyZWRDb250ZW50SG92ZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLl9yZW5kZXJlZEhvdmVyPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcmVuZGVyZWRIb3ZlciA9IHJlbmRlcmVkSG92ZXI7XG5cdFx0dGhpcy5faG92ZXJWaXNpYmxlS2V5LnNldCghIXJlbmRlcmVkSG92ZXIpO1xuXHRcdHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXJlbmRlcmVkSG92ZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlRm9udCgpOiB2b2lkIHtcblx0XHRjb25zdCB7IGZvbnRTaXplLCBsaW5lSGVpZ2h0IH0gPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250SW5mbyk7XG5cdFx0Y29uc3QgY29udGVudHNEb21Ob2RlID0gdGhpcy5faG92ZXIuY29udGVudHNEb21Ob2RlO1xuXHRcdGNvbnRlbnRzRG9tTm9kZS5zdHlsZS5mb250U2l6ZSA9IGAke2ZvbnRTaXplfXB4YDtcblx0XHRjb250ZW50c0RvbU5vZGUuc3R5bGUubGluZUhlaWdodCA9IGAke2xpbmVIZWlnaHQgLyBmb250U2l6ZX1gO1xuXHRcdGNvbnN0IGNvZGVDbGFzc2VzOiBIVE1MRWxlbWVudFtdID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5faG92ZXIuY29udGVudHNEb21Ob2RlLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2NvZGUnKSk7XG5cdFx0Y29kZUNsYXNzZXMuZm9yRWFjaChub2RlID0+IHRoaXMuX2VkaXRvci5hcHBseUZvbnRJbmZvKG5vZGUpKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUNvbnRlbnQobm9kZTogRG9jdW1lbnRGcmFnbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRlbnRzRG9tTm9kZSA9IHRoaXMuX2hvdmVyLmNvbnRlbnRzRG9tTm9kZTtcblx0XHRjb250ZW50c0RvbU5vZGUuc3R5bGUucGFkZGluZ0JvdHRvbSA9ICcnO1xuXHRcdGNvbnRlbnRzRG9tTm9kZS50ZXh0Q29udGVudCA9ICcnO1xuXHRcdGNvbnRlbnRzRG9tTm9kZS5hcHBlbmRDaGlsZChub2RlKTtcblx0fVxuXG5cdHByaXZhdGUgX2xheW91dENvbnRlbnRXaWRnZXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0dGhpcy5faG92ZXIub25Db250ZW50c0NoYW5nZWQoKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZU1heERpbWVuc2lvbnMoKSB7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gTWF0aC5tYXgodGhpcy5fZWRpdG9yLmdldExheW91dEluZm8oKS5oZWlnaHQgLyA0LCAyNTAsIENvbnRlbnRIb3ZlcldpZGdldC5fbGFzdERpbWVuc2lvbnMuaGVpZ2h0KTtcblx0XHRjb25zdCB3aWR0aCA9IE1hdGgubWF4KHRoaXMuX2VkaXRvci5nZXRMYXlvdXRJbmZvKCkud2lkdGggKiAwLjY2LCA3NTAsIENvbnRlbnRIb3ZlcldpZGdldC5fbGFzdERpbWVuc2lvbnMud2lkdGgpO1xuXHRcdHRoaXMuX3Jlc2l6YWJsZU5vZGUubWF4U2l6ZSA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHRcdHRoaXMuX3NldEhvdmVyV2lkZ2V0TWF4RGltZW5zaW9ucyh3aWR0aCwgaGVpZ2h0KTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlcihyZW5kZXJlZEhvdmVyOiBSZW5kZXJlZENvbnRlbnRIb3Zlcikge1xuXHRcdHRoaXMuX3NldFJlbmRlcmVkSG92ZXIocmVuZGVyZWRIb3Zlcik7XG5cdFx0dGhpcy5fdXBkYXRlRm9udCgpO1xuXHRcdHRoaXMuX3VwZGF0ZUNvbnRlbnQocmVuZGVyZWRIb3Zlci5kb21Ob2RlKTtcblx0XHR0aGlzLm9uQ29udGVudHNDaGFuZ2VkKCk7XG5cdFx0Ly8gU2ltcGx5IGZvcmNlIGEgc3luY2hyb25vdXMgcmVuZGVyIG9uIHRoZSBlZGl0b3Jcblx0XHQvLyBzdWNoIHRoYXQgdGhlIHdpZGdldCBkb2VzIG5vdCByZWFsbHkgcmVuZGVyIHdpdGggbGVmdCA9ICcwcHgnXG5cdFx0dGhpcy5fZWRpdG9yLnJlbmRlcigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0UG9zaXRpb24oKTogSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB8IG51bGwge1xuXHRcdGlmICghdGhpcy5fcmVuZGVyZWRIb3Zlcikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRwb3NpdGlvbjogdGhpcy5fcmVuZGVyZWRIb3Zlci5zaG93QXRQb3NpdGlvbixcblx0XHRcdHNlY29uZGFyeVBvc2l0aW9uOiB0aGlzLl9yZW5kZXJlZEhvdmVyLnNob3dBdFNlY29uZGFyeVBvc2l0aW9uLFxuXHRcdFx0cG9zaXRpb25BZmZpbml0eTogdGhpcy5fcmVuZGVyZWRIb3Zlci5zaG91bGRBcHBlYXJCZWZvcmVDb250ZW50ID8gUG9zaXRpb25BZmZpbml0eS5MZWZ0T2ZJbmplY3RlZFRleHQgOiB1bmRlZmluZWQsXG5cdFx0XHRwcmVmZXJlbmNlOiBbdGhpcy5fcG9zaXRpb25QcmVmZXJlbmNlID8/IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQUJPVkVdXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBzaG93KHJlbmRlcmVkSG92ZXI6IFJlbmRlcmVkQ29udGVudEhvdmVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IgfHwgIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3JlbmRlcihyZW5kZXJlZEhvdmVyKTtcblx0XHRjb25zdCB3aWRnZXRIZWlnaHQgPSBkb20uZ2V0VG90YWxIZWlnaHQodGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0UG9zaXRpb24gPSByZW5kZXJlZEhvdmVyLnNob3dBdFBvc2l0aW9uO1xuXHRcdHRoaXMuX3Bvc2l0aW9uUHJlZmVyZW5jZSA9IHRoaXMuX2ZpbmRQb3NpdGlvblByZWZlcmVuY2Uod2lkZ2V0SGVpZ2h0LCB3aWRnZXRQb3NpdGlvbikgPz8gQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5BQk9WRTtcblxuXHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTQwMzM5XG5cdFx0Ly8gVE9ETzogRG9pbmcgYSBzZWNvbmQgbGF5b3V0IG9mIHRoZSBob3ZlciBhZnRlciBmb3JjZSByZW5kZXJpbmcgdGhlIGVkaXRvclxuXHRcdHRoaXMub25Db250ZW50c0NoYW5nZWQoKTtcblx0XHRpZiAocmVuZGVyZWRIb3Zlci5zaG91bGRGb2N1cykge1xuXHRcdFx0dGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZS5mb2N1cygpO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZFJlc2l6ZS5maXJlKCk7XG5cdFx0Ly8gVGhlIGFyaWEgbGFiZWwgb3ZlcnJpZGVzIHRoZSBsYWJlbCwgc28gaWYgd2UgYWRkIHRvIGl0LCBhZGQgdGhlIGNvbnRlbnRzIG9mIHRoZSBob3ZlclxuXHRcdGNvbnN0IGhvdmVyRm9jdXNlZCA9IHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUub3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSB0aGlzLl9ob3Zlci5jb250YWluZXJEb21Ob2RlO1xuXHRcdGNvbnN0IGFjY2Vzc2libGVWaWV3SGludCA9IGhvdmVyRm9jdXNlZCAmJiBnZXRIb3ZlckFjY2Vzc2libGVWaWV3SGludChcblx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdhY2Nlc3NpYmlsaXR5LnZlcmJvc2l0eS5ob3ZlcicpID09PSB0cnVlICYmIHRoaXMuX2FjY2Vzc2liaWxpdHlTZXJ2aWNlLmlzU2NyZWVuUmVhZGVyT3B0aW1pemVkKCksXG5cdFx0XHR0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKCdlZGl0b3IuYWN0aW9uLmFjY2Vzc2libGVWaWV3Jyk/LmdldEFyaWFMYWJlbCgpID8/ICcnXG5cdFx0KTtcblxuXHRcdGlmIChhY2Nlc3NpYmxlVmlld0hpbnQpIHtcblx0XHRcdHRoaXMuX2hvdmVyLmNvbnRlbnRzRG9tTm9kZS5hcmlhTGFiZWwgPSB0aGlzLl9ob3Zlci5jb250ZW50c0RvbU5vZGUudGV4dENvbnRlbnQgKyAnLCAnICsgYWNjZXNzaWJsZVZpZXdIaW50O1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBoaWRlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fcmVuZGVyZWRIb3Zlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBob3ZlclN0b2xlRm9jdXMgPSB0aGlzLl9yZW5kZXJlZEhvdmVyLnNob3VsZEZvY3VzIHx8IHRoaXMuX2hvdmVyRm9jdXNlZEtleS5nZXQoKTtcblx0XHR0aGlzLl9zZXRSZW5kZXJlZEhvdmVyKHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5fcmVzaXphYmxlTm9kZS5tYXhTaXplID0gbmV3IGRvbS5EaW1lbnNpb24oSW5maW5pdHksIEluZmluaXR5KTtcblx0XHR0aGlzLl9yZXNpemFibGVOb2RlLmNsZWFyU2FzaEhvdmVyU3RhdGUoKTtcblx0XHR0aGlzLl9ob3ZlckZvY3VzZWRLZXkuc2V0KGZhbHNlKTtcblx0XHR0aGlzLl9lZGl0b3IubGF5b3V0Q29udGVudFdpZGdldCh0aGlzKTtcblx0XHRpZiAoaG92ZXJTdG9sZUZvY3VzKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3IuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVDb25zdHJhaW50c1JlbmRlck5vcm1hbGx5KCk6IHZvaWQge1xuXHRcdC8vIEFkZGVkIGJlY2F1c2Ugb3RoZXJ3aXNlIHRoZSBpbml0aWFsIHNpemUgb2YgdGhlIGhvdmVyIGNvbnRlbnQgaXMgc21hbGxlciB0aGFuIHNob3VsZCBiZVxuXHRcdGNvbnN0IGxheW91dEluZm8gPSB0aGlzLl9lZGl0b3IuZ2V0TGF5b3V0SW5mbygpO1xuXHRcdHRoaXMuX3Jlc2l6YWJsZU5vZGUubGF5b3V0KGxheW91dEluZm8uaGVpZ2h0LCBsYXlvdXRJbmZvLndpZHRoKTtcblx0XHR0aGlzLl9zZXRIb3ZlcldpZGdldERpbWVuc2lvbnMoJ2F1dG8nLCAnYXV0bycpO1xuXHRcdHRoaXMuX3VwZGF0ZU1heERpbWVuc2lvbnMoKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRNaW5pbXVtRGltZW5zaW9ucyhkaW1lbnNpb25zOiBkb20uRGltZW5zaW9uKTogdm9pZCB7XG5cdFx0Ly8gV2UgY29tYmluZSB0aGUgbmV3IG1pbmltdW0gZGltZW5zaW9ucyB3aXRoIHRoZSBwcmV2aW91cyBvbmVzXG5cdFx0dGhpcy5fbWluaW11bVNpemUgPSBuZXcgZG9tLkRpbWVuc2lvbihcblx0XHRcdE1hdGgubWF4KHRoaXMuX21pbmltdW1TaXplLndpZHRoLCBkaW1lbnNpb25zLndpZHRoKSxcblx0XHRcdE1hdGgubWF4KHRoaXMuX21pbmltdW1TaXplLmhlaWdodCwgZGltZW5zaW9ucy5oZWlnaHQpXG5cdFx0KTtcblx0XHR0aGlzLl91cGRhdGVNaW5pbXVtV2lkdGgoKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZU1pbmltdW1XaWR0aCgpOiB2b2lkIHtcblx0XHRjb25zdCB3aWR0aCA9IChcblx0XHRcdHR5cGVvZiB0aGlzLl9jb250ZW50V2lkdGggPT09ICd1bmRlZmluZWQnXG5cdFx0XHRcdD8gdGhpcy5fbWluaW11bVNpemUud2lkdGhcblx0XHRcdFx0OiBNYXRoLm1pbih0aGlzLl9jb250ZW50V2lkdGgsIHRoaXMuX21pbmltdW1TaXplLndpZHRoKVxuXHRcdCk7XG5cdFx0Ly8gV2Ugd2FudCB0byBhdm9pZCB0aGF0IHRoZSBob3ZlciBpcyBhcnRpZmljaWFsbHkgbGFyZ2UsIHNvIHdlIHVzZSB0aGUgY29udGVudCB3aWR0aCBhcyBtaW5pbXVtIHdpZHRoXG5cdFx0dGhpcy5fcmVzaXphYmxlTm9kZS5taW5TaXplID0gbmV3IGRvbS5EaW1lbnNpb24od2lkdGgsIHRoaXMuX21pbmltdW1TaXplLmhlaWdodCk7XG5cdH1cblxuXHRwdWJsaWMgb25Db250ZW50c0NoYW5nZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVtb3ZlQ29uc3RyYWludHNSZW5kZXJOb3JtYWxseSgpO1xuXHRcdGNvbnN0IGNvbnRlbnRzRG9tTm9kZSA9IHRoaXMuX2hvdmVyLmNvbnRlbnRzRG9tTm9kZTtcblxuXHRcdGxldCBoZWlnaHQgPSBkb20uZ2V0VG90YWxIZWlnaHQoY29udGVudHNEb21Ob2RlKTtcblx0XHRsZXQgd2lkdGggPSBkb20uZ2V0VG90YWxXaWR0aChjb250ZW50c0RvbU5vZGUpICsgMjtcblx0XHR0aGlzLl9yZXNpemFibGVOb2RlLmxheW91dChoZWlnaHQsIHdpZHRoKTtcblxuXHRcdHRoaXMuX3NldEhvdmVyV2lkZ2V0RGltZW5zaW9ucyh3aWR0aCwgaGVpZ2h0KTtcblxuXHRcdGhlaWdodCA9IGRvbS5nZXRUb3RhbEhlaWdodChjb250ZW50c0RvbU5vZGUpO1xuXHRcdHdpZHRoID0gZG9tLmdldFRvdGFsV2lkdGgoY29udGVudHNEb21Ob2RlKTtcblx0XHR0aGlzLl9jb250ZW50V2lkdGggPSB3aWR0aDtcblx0XHR0aGlzLl91cGRhdGVNaW5pbXVtV2lkdGgoKTtcblx0XHR0aGlzLl9yZXNpemFibGVOb2RlLmxheW91dChoZWlnaHQsIHdpZHRoKTtcblxuXHRcdGlmICh0aGlzLl9yZW5kZXJlZEhvdmVyPy5zaG93QXRQb3NpdGlvbikge1xuXHRcdFx0Y29uc3Qgd2lkZ2V0SGVpZ2h0ID0gZG9tLmdldFRvdGFsSGVpZ2h0KHRoaXMuX2hvdmVyLmNvbnRhaW5lckRvbU5vZGUpO1xuXHRcdFx0dGhpcy5fcG9zaXRpb25QcmVmZXJlbmNlID0gdGhpcy5fZmluZFBvc2l0aW9uUHJlZmVyZW5jZSh3aWRnZXRIZWlnaHQsIHRoaXMuX3JlbmRlcmVkSG92ZXIuc2hvd0F0UG9zaXRpb24pO1xuXHRcdH1cblx0XHR0aGlzLl9sYXlvdXRDb250ZW50V2lkZ2V0KCk7XG5cdH1cblxuXHRwdWJsaWMgZm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5faG92ZXIuY29udGFpbmVyRG9tTm9kZS5mb2N1cygpO1xuXHR9XG5cblx0cHVibGljIHNjcm9sbFVwKCk6IHZvaWQge1xuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMuX2hvdmVyLnNjcm9sbGJhci5nZXRTY3JvbGxQb3NpdGlvbigpLnNjcm9sbFRvcDtcblx0XHRjb25zdCBmb250SW5mbyA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0XHR0aGlzLl9ob3Zlci5zY3JvbGxiYXIuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IHNjcm9sbFRvcCAtIGZvbnRJbmZvLmxpbmVIZWlnaHQgfSk7XG5cdH1cblxuXHRwdWJsaWMgc2Nyb2xsRG93bigpOiB2b2lkIHtcblx0XHRjb25zdCBzY3JvbGxUb3AgPSB0aGlzLl9ob3Zlci5zY3JvbGxiYXIuZ2V0U2Nyb2xsUG9zaXRpb24oKS5zY3JvbGxUb3A7XG5cdFx0Y29uc3QgZm9udEluZm8gPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250SW5mbyk7XG5cdFx0dGhpcy5faG92ZXIuc2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsVG9wOiBzY3JvbGxUb3AgKyBmb250SW5mby5saW5lSGVpZ2h0IH0pO1xuXHR9XG5cblx0cHVibGljIHNjcm9sbExlZnQoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2Nyb2xsTGVmdCA9IHRoaXMuX2hvdmVyLnNjcm9sbGJhci5nZXRTY3JvbGxQb3NpdGlvbigpLnNjcm9sbExlZnQ7XG5cdFx0dGhpcy5faG92ZXIuc2Nyb2xsYmFyLnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsTGVmdDogc2Nyb2xsTGVmdCAtIEhPUklaT05UQUxfU0NST0xMSU5HX0JZIH0pO1xuXHR9XG5cblx0cHVibGljIHNjcm9sbFJpZ2h0KCk6IHZvaWQge1xuXHRcdGNvbnN0IHNjcm9sbExlZnQgPSB0aGlzLl9ob3Zlci5zY3JvbGxiYXIuZ2V0U2Nyb2xsUG9zaXRpb24oKS5zY3JvbGxMZWZ0O1xuXHRcdHRoaXMuX2hvdmVyLnNjcm9sbGJhci5zZXRTY3JvbGxQb3NpdGlvbih7IHNjcm9sbExlZnQ6IHNjcm9sbExlZnQgKyBIT1JJWk9OVEFMX1NDUk9MTElOR19CWSB9KTtcblx0fVxuXG5cdHB1YmxpYyBwYWdlVXAoKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2Nyb2xsVG9wID0gdGhpcy5faG92ZXIuc2Nyb2xsYmFyLmdldFNjcm9sbFBvc2l0aW9uKCkuc2Nyb2xsVG9wO1xuXHRcdGNvbnN0IHNjcm9sbEhlaWdodCA9IHRoaXMuX2hvdmVyLnNjcm9sbGJhci5nZXRTY3JvbGxEaW1lbnNpb25zKCkuaGVpZ2h0O1xuXHRcdHRoaXMuX2hvdmVyLnNjcm9sbGJhci5zZXRTY3JvbGxQb3NpdGlvbih7IHNjcm9sbFRvcDogc2Nyb2xsVG9wIC0gc2Nyb2xsSGVpZ2h0IH0pO1xuXHR9XG5cblx0cHVibGljIHBhZ2VEb3duKCk6IHZvaWQge1xuXHRcdGNvbnN0IHNjcm9sbFRvcCA9IHRoaXMuX2hvdmVyLnNjcm9sbGJhci5nZXRTY3JvbGxQb3NpdGlvbigpLnNjcm9sbFRvcDtcblx0XHRjb25zdCBzY3JvbGxIZWlnaHQgPSB0aGlzLl9ob3Zlci5zY3JvbGxiYXIuZ2V0U2Nyb2xsRGltZW5zaW9ucygpLmhlaWdodDtcblx0XHR0aGlzLl9ob3Zlci5zY3JvbGxiYXIuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IHNjcm9sbFRvcCArIHNjcm9sbEhlaWdodCB9KTtcblx0fVxuXG5cdHB1YmxpYyBnb1RvVG9wKCk6IHZvaWQge1xuXHRcdHRoaXMuX2hvdmVyLnNjcm9sbGJhci5zZXRTY3JvbGxQb3NpdGlvbih7IHNjcm9sbFRvcDogMCB9KTtcblx0fVxuXG5cdHB1YmxpYyBnb1RvQm90dG9tKCk6IHZvaWQge1xuXHRcdHRoaXMuX2hvdmVyLnNjcm9sbGJhci5zZXRTY3JvbGxQb3NpdGlvbih7IHNjcm9sbFRvcDogdGhpcy5faG92ZXIuc2Nyb2xsYmFyLmdldFNjcm9sbERpbWVuc2lvbnMoKS5zY3JvbGxIZWlnaHQgfSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZURpc3RhbmNlRnJvbVBvaW50VG9SZWN0YW5nbGUocG9pbnRYOiBudW1iZXIsIHBvaW50WTogbnVtYmVyLCBsZWZ0OiBudW1iZXIsIHRvcDogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IG51bWJlciB7XG5cdGNvbnN0IHggPSAobGVmdCArIHdpZHRoIC8gMik7IC8vIHggY2VudGVyIG9mIHJlY3RhbmdsZVxuXHRjb25zdCB5ID0gKHRvcCArIGhlaWdodCAvIDIpOyAvLyB5IGNlbnRlciBvZiByZWN0YW5nbGVcblx0Y29uc3QgZHggPSBNYXRoLm1heChNYXRoLmFicyhwb2ludFggLSB4KSAtIHdpZHRoIC8gMiwgMCk7XG5cdGNvbnN0IGR5ID0gTWF0aC5tYXgoTWF0aC5hYnMocG9pbnRZIC0geSkgLSBoZWlnaHQgLyAyLCAwKTtcblx0cmV0dXJuIE1hdGguc3FydChkeCAqIGR4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QUUsWUFBWSxhQUFhLHdCQUF3QixDQUFDO0FBQUEsRUFDN0Y7QUFBQSxFQUVPLGNBQW9CO0FBQzFCLFVBQU0sYUFBYSxLQUFLLE9BQU8sVUFBVSxrQkFBa0IsRUFBRTtBQUM3RCxTQUFLLE9BQU8sVUFBVSxrQkFBa0IsRUFBRSxZQUFZLGFBQWEsd0JBQXdCLENBQUM7QUFBQSxFQUM3RjtBQUFBLEVBRU8sU0FBZTtBQUNyQixVQUFNLFlBQVksS0FBSyxPQUFPLFVBQVUsa0JBQWtCLEVBQUU7QUFDNUQsVUFBTSxlQUFlLEtBQUssT0FBTyxVQUFVLG9CQUFvQixFQUFFO0FBQ2pFLFNBQUssT0FBTyxVQUFVLGtCQUFrQixFQUFFLFdBQVcsWUFBWSxhQUFhLENBQUM7QUFBQSxFQUNoRjtBQUFBLEVBRU8sV0FBaUI7QUFDdkIsVUFBTSxZQUFZLEtBQUssT0FBTyxVQUFVLGtCQUFrQixFQUFFO0FBQzVELFVBQU0sZUFBZSxLQUFLLE9BQU8sVUFBVSxvQkFBb0IsRUFBRTtBQUNqRSxTQUFLLE9BQU8sVUFBVSxrQkFBa0IsRUFBRSxXQUFXLFlBQVksYUFBYSxDQUFDO0FBQUEsRUFDaEY7QUFBQSxFQUVPLFVBQWdCO0FBQ3RCLFNBQUssT0FBTyxVQUFVLGtCQUFrQixFQUFFLFdBQVcsRUFBRSxDQUFDO0FBQUEsRUFDekQ7QUFBQSxFQUVPLGFBQW1CO0FBQ3pCLFNBQUssT0FBTyxVQUFVLGtCQUFrQixFQUFFLFdBQVcsS0FBSyxPQUFPLFVBQVUsb0JBQW9CLEVBQUUsYUFBYSxDQUFDO0FBQUEsRUFDaEg7QUFDRDtBQTliYSxtQkFFRSxLQUFLO0FBRlAsbUJBR0csa0JBQWlDLElBQUksSUFBSSxVQUFVLEdBQUcsQ0FBQztBQUgxRCxxQkFBTjtBQUFBLEVBa0NKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FyQ1U7QUFnY2IsU0FBUyxvQ0FBb0MsUUFBZ0IsUUFBZ0IsTUFBYyxLQUFhLE9BQWUsUUFBd0I7QUFDOUksUUFBTSxJQUFLLE9BQU8sUUFBUTtBQUMxQixRQUFNLElBQUssTUFBTSxTQUFTO0FBQzFCLFFBQU0sS0FBSyxLQUFLLElBQUksS0FBSyxJQUFJLFNBQVMsQ0FBQyxJQUFJLFFBQVEsR0FBRyxDQUFDO0FBQ3ZELFFBQU0sS0FBSyxLQUFLLElBQUksS0FBSyxJQUFJLFNBQVMsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDO0FBQ3hELFNBQU8sS0FBSyxLQUFLLEtBQUssS0FBSyxLQUFLLEVBQUU7QUFDbkM7IiwKICAibmFtZXMiOiBbXQp9Cg==
