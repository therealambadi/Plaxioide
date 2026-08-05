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
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { ResizableHTMLElement } from "../../../../base/browser/ui/resizable/resizable.js";
import * as nls from "../../../../nls.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { MarkdownRenderer } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
function canExpandCompletionItem(item) {
  return !!item && Boolean(item.completion.documentation || item.completion.detail && item.completion.detail !== item.completion.label);
}
const SuggestDetailsClassName = "suggest-details";
let SimpleSuggestDetailsWidget = class {
  constructor(_getFontInfo, onDidFontInfoChange, _getAdvancedExplainModeDetails, instaService) {
    this._getFontInfo = _getFontInfo;
    this._getAdvancedExplainModeDetails = _getAdvancedExplainModeDetails;
    this._onDidClose = new Emitter();
    this.onDidClose = this._onDidClose.event;
    this._onDidChangeContents = new Emitter();
    this.onDidChangeContents = this._onDidChangeContents.event;
    this._disposables = new DisposableStore();
    this._renderDisposeable = this._disposables.add(new DisposableStore());
    this._borderWidth = 1;
    this._size = new dom.Dimension(330, 0);
    this.domNode = dom.$(".suggest-details");
    this.domNode.classList.add("no-docs");
    this._markdownRenderer = instaService.createInstance(MarkdownRenderer, {});
    this._body = dom.$(".body");
    this._scrollbar = new DomScrollableElement(this._body, {
      alwaysConsumeMouseWheel: true
    });
    dom.append(this.domNode, this._scrollbar.getDomNode());
    this._disposables.add(this._scrollbar);
    this._header = dom.append(this._body, dom.$(".header"));
    this._close = dom.append(this._header, dom.$("span" + ThemeIcon.asCSSSelector(Codicon.close)));
    this._close.title = nls.localize("details.close", "Close");
    this._close.role = "button";
    this._close.tabIndex = -1;
    this._type = dom.append(this._header, dom.$("p.type"));
    this._docs = dom.append(this._body, dom.$("p.docs"));
    this._configureFont();
    this._disposables.add(onDidFontInfoChange(() => this._configureFont()));
  }
  _configureFont() {
    const fontInfo = this._getFontInfo();
    const fontFamily = fontInfo.fontFamily;
    const fontSize = fontInfo.fontSize;
    const lineHeight = fontInfo.lineHeight;
    const fontWeight = fontInfo.fontWeight;
    const fontSizePx = `${fontSize}px`;
    const lineHeightPx = `${lineHeight}px`;
    this.domNode.style.fontSize = fontSizePx;
    this.domNode.style.lineHeight = `${lineHeight / fontSize}`;
    this.domNode.style.fontWeight = fontWeight;
    this._type.style.fontFamily = fontFamily;
    this._close.style.height = lineHeightPx;
    this._close.style.width = lineHeightPx;
  }
  dispose() {
    this._disposables.dispose();
    this._onDidClose.dispose();
    this._onDidChangeContents.dispose();
  }
  getLayoutInfo() {
    const lineHeight = this._getFontInfo().lineHeight;
    const borderWidth = this._borderWidth;
    const borderHeight = borderWidth * 2;
    return {
      lineHeight,
      borderWidth,
      borderHeight,
      verticalPadding: 22,
      horizontalPadding: 14
    };
  }
  renderLoading() {
    this._type.textContent = nls.localize("loading", "Loading...");
    this._docs.textContent = "";
    this.domNode.classList.remove("no-docs", "no-type");
    this.layout(this.size.width, this.getLayoutInfo().lineHeight * 2);
    this._onDidChangeContents.fire(this);
  }
  renderItem(item, explainMode) {
    this._renderDisposeable.clear();
    let { detail, documentation } = item.completion;
    let md = "";
    if (explainMode) {
      md += `score: ${item.score[0]}
`;
      md += `prefix: ${item.word ?? "(no prefix)"}
`;
      md += `replacementIndex: ${item.completion.replacementIndex}
`;
      md += `replacementLength: ${item.completion.replacementLength}
`;
      md += `index: ${item.idx}
`;
      if (this._getAdvancedExplainModeDetails) {
        const advancedDetails = this._getAdvancedExplainModeDetails();
        if (advancedDetails) {
          md += `${advancedDetails}
`;
        }
      }
      detail = `Provider: ${item.completion.provider}`;
      documentation = new MarkdownString().appendCodeblock("empty", md);
    }
    if (!explainMode && !canExpandCompletionItem(item)) {
      this.clearContents();
      return;
    }
    this.domNode.classList.remove("no-docs", "no-type");
    if (detail) {
      const cappedDetail = detail.length > 1e5 ? `${detail.substr(0, 1e5)}\u2026` : detail;
      this._type.textContent = cappedDetail;
      this._type.title = cappedDetail;
      dom.show(this._type);
      this._type.classList.toggle("auto-wrap", !/\r?\n^\s+/gmi.test(cappedDetail));
    } else {
      dom.clearNode(this._type);
      this._type.title = "";
      dom.hide(this._type);
      this.domNode.classList.add("no-type");
    }
    dom.clearNode(this._docs);
    if (typeof documentation === "string") {
      this._docs.classList.remove("markdown-docs");
      this._docs.textContent = documentation;
    } else if (documentation) {
      this._docs.classList.add("markdown-docs");
      dom.clearNode(this._docs);
      const renderedContents = this._markdownRenderer.render(documentation, {
        asyncRenderCallback: () => {
          this.layout(this._size.width, this._type.clientHeight + this._docs.clientHeight);
          this._onDidChangeContents.fire(this);
        }
      });
      this._docs.appendChild(renderedContents.element);
      this._renderDisposeable.add(renderedContents);
    }
    this.domNode.classList.toggle("detail-and-doc", !!detail && !!documentation);
    this.domNode.style.userSelect = "text";
    this.domNode.tabIndex = -1;
    this._close.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    this._close.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._onDidClose.fire();
    };
    this._body.scrollTop = 0;
    this.layout(this._size.width, this._type.clientHeight + this._docs.clientHeight + this.getLayoutInfo().verticalPadding);
    this._onDidChangeContents.fire(this);
  }
  clearContents() {
    this.domNode.classList.add("no-docs");
    this._type.textContent = "";
    this._docs.textContent = "";
  }
  get isEmpty() {
    return this.domNode.classList.contains("no-docs");
  }
  get size() {
    return this._size;
  }
  layout(width, height) {
    const newSize = new dom.Dimension(width, height);
    if (!dom.Dimension.equals(newSize, this._size)) {
      this._size = newSize;
      dom.size(this.domNode, width, height);
    }
    this._scrollbar.scanDomNode();
  }
  scrollDown(much = 8) {
    this._body.scrollTop += much;
  }
  scrollUp(much = 8) {
    this._body.scrollTop -= much;
  }
  scrollTop() {
    this._body.scrollTop = 0;
  }
  scrollBottom() {
    this._body.scrollTop = this._body.scrollHeight;
  }
  pageDown() {
    this.scrollDown(80);
  }
  pageUp() {
    this.scrollUp(80);
  }
  set borderWidth(width) {
    this._borderWidth = width;
  }
  get borderWidth() {
    return this._borderWidth;
  }
  focus() {
    this.domNode.focus();
  }
};
SimpleSuggestDetailsWidget = __decorateClass([
  __decorateParam(3, IInstantiationService)
], SimpleSuggestDetailsWidget);
class SimpleSuggestDetailsOverlay {
  constructor(widget, _container) {
    this.widget = widget;
    this._container = _container;
    this._disposables = new DisposableStore();
    this._added = false;
    this._resizable = this._disposables.add(new ResizableHTMLElement());
    this._resizable.domNode.classList.add("suggest-details-container");
    this._resizable.domNode.appendChild(widget.domNode);
    this._resizable.enableSashes(false, true, true, false);
    let topLeftNow;
    let sizeNow;
    let deltaTop = 0;
    let deltaLeft = 0;
    this._disposables.add(this._resizable.onDidWillResize(() => {
      topLeftNow = this._topLeft;
      sizeNow = this._resizable.size;
    }));
    this._disposables.add(this._resizable.onDidResize((e) => {
      if (topLeftNow && sizeNow) {
        this.widget.layout(e.dimension.width, e.dimension.height);
        let updateTopLeft = false;
        if (e.west) {
          deltaLeft = sizeNow.width - e.dimension.width;
          updateTopLeft = true;
        }
        if (e.north) {
          deltaTop = sizeNow.height - e.dimension.height;
          updateTopLeft = true;
        }
        if (updateTopLeft) {
          this._applyTopLeft({
            top: topLeftNow.top + deltaTop,
            left: topLeftNow.left + deltaLeft
          });
        }
      }
      if (e.done) {
        topLeftNow = void 0;
        sizeNow = void 0;
        deltaTop = 0;
        deltaLeft = 0;
        this._userSize = e.dimension;
      }
    }));
    this._disposables.add(this.widget.onDidChangeContents(() => {
      if (this._anchorBox) {
        this._placeAtAnchor(this._anchorBox, this._userSize ?? this.widget.size);
      }
    }));
  }
  dispose() {
    this.widget.dispose();
    this._disposables.dispose();
    this.hide();
  }
  getId() {
    return "suggest.details";
  }
  getDomNode() {
    return this._resizable.domNode;
  }
  show() {
    if (!this._added) {
      this._container.appendChild(this._resizable.domNode);
      this._added = true;
    }
  }
  hide(sessionEnded = false) {
    this._resizable.clearSashHoverState();
    if (this._added) {
      this._container.removeChild(this._resizable.domNode);
      this._added = false;
      this._anchorBox = void 0;
    }
    if (sessionEnded) {
      this._userSize = void 0;
      this.widget.clearContents();
    }
  }
  placeAtAnchor(anchor) {
    const anchorBox = anchor.getBoundingClientRect();
    this._anchorBox = anchorBox;
    this.widget.layout(this._resizable.size.width, this._resizable.size.height);
    this._placeAtAnchor(this._anchorBox, this._userSize ?? this.widget.size);
  }
  _placeAtAnchor(anchorBox, size) {
    const bodyBox = dom.getClientArea(this.getDomNode().ownerDocument.body);
    const info = this.widget.getLayoutInfo();
    const defaultMinSize = new dom.Dimension(220, 2 * info.lineHeight);
    const defaultTop = anchorBox.top;
    const eastPlacement = function() {
      const width = bodyBox.width - (anchorBox.left + anchorBox.width + info.borderWidth + info.horizontalPadding);
      const left2 = -info.borderWidth + anchorBox.left + anchorBox.width;
      const maxSizeTop = new dom.Dimension(width, bodyBox.height - anchorBox.top - info.borderHeight - info.verticalPadding);
      const maxSizeBottom = maxSizeTop.with(void 0, anchorBox.top + anchorBox.height - info.borderHeight - info.verticalPadding);
      return { top: defaultTop, left: left2, fit: width - size.width, maxSizeTop, maxSizeBottom, minSize: defaultMinSize.with(Math.min(width, defaultMinSize.width)) };
    }();
    const westPlacement = function() {
      const width = anchorBox.left - info.borderWidth - info.horizontalPadding;
      const left2 = Math.max(info.horizontalPadding, anchorBox.left - size.width - info.borderWidth);
      const maxSizeTop = new dom.Dimension(width, bodyBox.height - anchorBox.top - info.borderHeight - info.verticalPadding);
      const maxSizeBottom = maxSizeTop.with(void 0, anchorBox.top + anchorBox.height - info.borderHeight - info.verticalPadding);
      return { top: defaultTop, left: left2, fit: width - size.width, maxSizeTop, maxSizeBottom, minSize: defaultMinSize.with(Math.min(width, defaultMinSize.width)) };
    }();
    const southPacement = function() {
      const left2 = anchorBox.left;
      const top2 = -info.borderWidth + anchorBox.top + anchorBox.height;
      const maxSizeBottom = new dom.Dimension(anchorBox.width - info.borderHeight, bodyBox.height - anchorBox.top - anchorBox.height - info.verticalPadding);
      return { top: top2, left: left2, fit: maxSizeBottom.height - size.height, maxSizeBottom, maxSizeTop: maxSizeBottom, minSize: defaultMinSize.with(maxSizeBottom.width) };
    }();
    const placements = [eastPlacement, westPlacement, southPacement];
    const placement = placements.find((p) => p.fit >= 0) ?? placements.sort((a, b) => b.fit - a.fit)[0];
    const bottom = anchorBox.top + anchorBox.height - info.borderHeight;
    let alignAtTop;
    let height = size.height;
    const maxHeight = Math.max(placement.maxSizeTop.height, placement.maxSizeBottom.height);
    if (height > maxHeight) {
      height = maxHeight;
    }
    let maxSize;
    if (height <= placement.maxSizeTop.height) {
      alignAtTop = true;
      maxSize = placement.maxSizeTop;
    } else {
      alignAtTop = false;
      maxSize = placement.maxSizeBottom;
    }
    let { top, left } = placement;
    if (!alignAtTop && height > anchorBox.height) {
      top = bottom - height;
    }
    const editorDomNode = this._container;
    if (editorDomNode) {
      const editorBoundingBox = editorDomNode.getBoundingClientRect();
      top -= editorBoundingBox.top;
      left -= editorBoundingBox.left;
    }
    this._applyTopLeft({ left, top });
    this._resizable.enableSashes(!alignAtTop, placement === eastPlacement, alignAtTop, placement !== eastPlacement);
    this._resizable.minSize = placement.minSize;
    this._resizable.maxSize = maxSize;
    this._resizable.layout(height, Math.min(maxSize.width, size.width));
    this.widget.layout(this._resizable.size.width, this._resizable.size.height);
  }
  _applyTopLeft(topLeft) {
    this._topLeft = topLeft;
    this._resizable.domNode.style.top = `${topLeft.top}px`;
    this._resizable.domNode.style.left = `${topLeft.left}px`;
    this._resizable.domNode.style.position = "absolute";
  }
}
export {
  SimpleSuggestDetailsOverlay,
  SimpleSuggestDetailsWidget,
  SuggestDetailsClassName,
  canExpandCompletionItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc3VnZ2VzdC9icm93c2VyL3NpbXBsZVN1Z2dlc3RXaWRnZXREZXRhaWxzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRG9tU2Nyb2xsYWJsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50LmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzaXphYmxlSFRNTEVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvcmVzaXphYmxlL3Jlc2l6YWJsZS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IFNpbXBsZUNvbXBsZXRpb25JdGVtIH0gZnJvbSAnLi9zaW1wbGVDb21wbGV0aW9uSXRlbS5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbWFya2Rvd25SZW5kZXJlci9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU2ltcGxlU3VnZ2VzdFdpZGdldEZvbnRJbmZvIH0gZnJvbSAnLi9zaW1wbGVTdWdnZXN0V2lkZ2V0UmVuZGVyZXIuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gY2FuRXhwYW5kQ29tcGxldGlvbkl0ZW0oaXRlbTogU2ltcGxlQ29tcGxldGlvbkl0ZW0gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0cmV0dXJuICEhaXRlbSAmJiBCb29sZWFuKGl0ZW0uY29tcGxldGlvbi5kb2N1bWVudGF0aW9uIHx8IGl0ZW0uY29tcGxldGlvbi5kZXRhaWwgJiYgaXRlbS5jb21wbGV0aW9uLmRldGFpbCAhPT0gaXRlbS5jb21wbGV0aW9uLmxhYmVsKTtcbn1cblxuZXhwb3J0IGNvbnN0IFN1Z2dlc3REZXRhaWxzQ2xhc3NOYW1lID0gJ3N1Z2dlc3QtZGV0YWlscyc7XG5cbmV4cG9ydCBjbGFzcyBTaW1wbGVTdWdnZXN0RGV0YWlsc1dpZGdldCB7XG5cblx0cmVhZG9ubHkgZG9tTm9kZTogSFRNTERpdkVsZW1lbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbG9zZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2xvc2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDbG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnRzID0gbmV3IEVtaXR0ZXI8dGhpcz4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZW50czogRXZlbnQ8dGhpcz4gPSB0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnRzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Nsb3NlOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfc2Nyb2xsYmFyOiBEb21TY3JvbGxhYmxlRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfYm9keTogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hlYWRlcjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3R5cGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kb2NzOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbWFya2Rvd25SZW5kZXJlcjogTWFya2Rvd25SZW5kZXJlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZW5kZXJEaXNwb3NlYWJsZSA9IHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIF9ib3JkZXJXaWR0aDogbnVtYmVyID0gMTtcblx0cHJpdmF0ZSBfc2l6ZSA9IG5ldyBkb20uRGltZW5zaW9uKDMzMCwgMCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZ2V0Rm9udEluZm86ICgpID0+IElTaW1wbGVTdWdnZXN0V2lkZ2V0Rm9udEluZm8sXG5cdFx0b25EaWRGb250SW5mb0NoYW5nZTogRXZlbnQ8dm9pZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZ2V0QWR2YW5jZWRFeHBsYWluTW9kZURldGFpbHM6ICgpID0+IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuZG9tTm9kZSA9IGRvbS4kKCcuc3VnZ2VzdC1kZXRhaWxzJyk7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ25vLWRvY3MnKTtcblxuXHRcdHRoaXMuX21hcmtkb3duUmVuZGVyZXIgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFya2Rvd25SZW5kZXJlciwge30pO1xuXG5cdFx0dGhpcy5fYm9keSA9IGRvbS4kKCcuYm9keScpO1xuXG5cdFx0dGhpcy5fc2Nyb2xsYmFyID0gbmV3IERvbVNjcm9sbGFibGVFbGVtZW50KHRoaXMuX2JvZHksIHtcblx0XHRcdGFsd2F5c0NvbnN1bWVNb3VzZVdoZWVsOiB0cnVlLFxuXHRcdH0pO1xuXHRcdGRvbS5hcHBlbmQodGhpcy5kb21Ob2RlLCB0aGlzLl9zY3JvbGxiYXIuZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fc2Nyb2xsYmFyKTtcblxuXHRcdHRoaXMuX2hlYWRlciA9IGRvbS5hcHBlbmQodGhpcy5fYm9keSwgZG9tLiQoJy5oZWFkZXInKSk7XG5cdFx0dGhpcy5fY2xvc2UgPSBkb20uYXBwZW5kKHRoaXMuX2hlYWRlciwgZG9tLiQoJ3NwYW4nICsgVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoQ29kaWNvbi5jbG9zZSkpKTtcblx0XHR0aGlzLl9jbG9zZS50aXRsZSA9IG5scy5sb2NhbGl6ZSgnZGV0YWlscy5jbG9zZScsIFwiQ2xvc2VcIik7XG5cdFx0dGhpcy5fY2xvc2Uucm9sZSA9ICdidXR0b24nO1xuXHRcdHRoaXMuX2Nsb3NlLnRhYkluZGV4ID0gLTE7XG5cdFx0dGhpcy5fdHlwZSA9IGRvbS5hcHBlbmQodGhpcy5faGVhZGVyLCBkb20uJCgncC50eXBlJykpO1xuXG5cdFx0dGhpcy5fZG9jcyA9IGRvbS5hcHBlbmQodGhpcy5fYm9keSwgZG9tLiQoJ3AuZG9jcycpKTtcblxuXHRcdHRoaXMuX2NvbmZpZ3VyZUZvbnQoKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChvbkRpZEZvbnRJbmZvQ2hhbmdlKCgpID0+IHRoaXMuX2NvbmZpZ3VyZUZvbnQoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29uZmlndXJlRm9udCgpOiB2b2lkIHtcblx0XHRjb25zdCBmb250SW5mbyA9IHRoaXMuX2dldEZvbnRJbmZvKCk7XG5cdFx0Y29uc3QgZm9udEZhbWlseSA9IGZvbnRJbmZvLmZvbnRGYW1pbHk7XG5cblx0XHRjb25zdCBmb250U2l6ZSA9IGZvbnRJbmZvLmZvbnRTaXplO1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSBmb250SW5mby5saW5lSGVpZ2h0O1xuXHRcdGNvbnN0IGZvbnRXZWlnaHQgPSBmb250SW5mby5mb250V2VpZ2h0O1xuXHRcdGNvbnN0IGZvbnRTaXplUHggPSBgJHtmb250U2l6ZX1weGA7XG5cdFx0Y29uc3QgbGluZUhlaWdodFB4ID0gYCR7bGluZUhlaWdodH1weGA7XG5cblx0XHR0aGlzLmRvbU5vZGUuc3R5bGUuZm9udFNpemUgPSBmb250U2l6ZVB4O1xuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5saW5lSGVpZ2h0ID0gYCR7bGluZUhlaWdodCAvIGZvbnRTaXplfWA7XG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLmZvbnRXZWlnaHQgPSBmb250V2VpZ2h0O1xuXHRcdC8vIHRoaXMuZG9tTm9kZS5zdHlsZS5mb250RmVhdHVyZVNldHRpbmdzID0gZm9udEluZm8uZm9udEZlYXR1cmVTZXR0aW5ncztcblx0XHR0aGlzLl90eXBlLnN0eWxlLmZvbnRGYW1pbHkgPSBmb250RmFtaWx5O1xuXHRcdHRoaXMuX2Nsb3NlLnN0eWxlLmhlaWdodCA9IGxpbmVIZWlnaHRQeDtcblx0XHR0aGlzLl9jbG9zZS5zdHlsZS53aWR0aCA9IGxpbmVIZWlnaHRQeDtcblxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fb25EaWRDbG9zZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50cy5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXRMYXlvdXRJbmZvKCkge1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLl9nZXRGb250SW5mbygpLmxpbmVIZWlnaHQ7XG5cdFx0Y29uc3QgYm9yZGVyV2lkdGggPSB0aGlzLl9ib3JkZXJXaWR0aDtcblx0XHRjb25zdCBib3JkZXJIZWlnaHQgPSBib3JkZXJXaWR0aCAqIDI7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxpbmVIZWlnaHQsXG5cdFx0XHRib3JkZXJXaWR0aCxcblx0XHRcdGJvcmRlckhlaWdodCxcblx0XHRcdHZlcnRpY2FsUGFkZGluZzogMjIsXG5cdFx0XHRob3Jpem9udGFsUGFkZGluZzogMTRcblx0XHR9O1xuXHR9XG5cblx0cmVuZGVyTG9hZGluZygpOiB2b2lkIHtcblx0XHR0aGlzLl90eXBlLnRleHRDb250ZW50ID0gbmxzLmxvY2FsaXplKCdsb2FkaW5nJywgXCJMb2FkaW5nLi4uXCIpO1xuXHRcdHRoaXMuX2RvY3MudGV4dENvbnRlbnQgPSAnJztcblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnbm8tZG9jcycsICduby10eXBlJyk7XG5cdFx0dGhpcy5sYXlvdXQodGhpcy5zaXplLndpZHRoLCB0aGlzLmdldExheW91dEluZm8oKS5saW5lSGVpZ2h0ICogMik7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50cy5maXJlKHRoaXMpO1xuXHR9XG5cblx0cmVuZGVySXRlbShpdGVtOiBTaW1wbGVDb21wbGV0aW9uSXRlbSwgZXhwbGFpbk1vZGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9yZW5kZXJEaXNwb3NlYWJsZS5jbGVhcigpO1xuXG5cdFx0bGV0IHsgZGV0YWlsLCBkb2N1bWVudGF0aW9uIH0gPSBpdGVtLmNvbXBsZXRpb247XG5cblx0XHRsZXQgbWQgPSAnJztcblxuXHRcdGlmIChleHBsYWluTW9kZSkge1xuXHRcdFx0bWQgKz0gYHNjb3JlOiAke2l0ZW0uc2NvcmVbMF19XFxuYDtcblx0XHRcdG1kICs9IGBwcmVmaXg6ICR7aXRlbS53b3JkID8/ICcobm8gcHJlZml4KSd9XFxuYDtcblx0XHRcdG1kICs9IGByZXBsYWNlbWVudEluZGV4OiAke2l0ZW0uY29tcGxldGlvbi5yZXBsYWNlbWVudEluZGV4fVxcbmA7XG5cdFx0XHRtZCArPSBgcmVwbGFjZW1lbnRMZW5ndGg6ICR7aXRlbS5jb21wbGV0aW9uLnJlcGxhY2VtZW50TGVuZ3RofVxcbmA7XG5cdFx0XHRtZCArPSBgaW5kZXg6ICR7aXRlbS5pZHh9XFxuYDtcblx0XHRcdGlmICh0aGlzLl9nZXRBZHZhbmNlZEV4cGxhaW5Nb2RlRGV0YWlscykge1xuXHRcdFx0XHRjb25zdCBhZHZhbmNlZERldGFpbHMgPSB0aGlzLl9nZXRBZHZhbmNlZEV4cGxhaW5Nb2RlRGV0YWlscygpO1xuXHRcdFx0XHRpZiAoYWR2YW5jZWREZXRhaWxzKSB7XG5cdFx0XHRcdFx0bWQgKz0gYCR7YWR2YW5jZWREZXRhaWxzfVxcbmA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGRldGFpbCA9IGBQcm92aWRlcjogJHtpdGVtLmNvbXBsZXRpb24ucHJvdmlkZXJ9YDtcblx0XHRcdGRvY3VtZW50YXRpb24gPSBuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRDb2RlYmxvY2soJ2VtcHR5JywgbWQpO1xuXHRcdH1cblxuXHRcdGlmICghZXhwbGFpbk1vZGUgJiYgIWNhbkV4cGFuZENvbXBsZXRpb25JdGVtKGl0ZW0pKSB7XG5cdFx0XHR0aGlzLmNsZWFyQ29udGVudHMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnbm8tZG9jcycsICduby10eXBlJyk7XG5cblx0XHQvLyAtLS0gZGV0YWlsc1xuXG5cdFx0aWYgKGRldGFpbCkge1xuXHRcdFx0Y29uc3QgY2FwcGVkRGV0YWlsID0gZGV0YWlsLmxlbmd0aCA+IDEwMDAwMCA/IGAke2RldGFpbC5zdWJzdHIoMCwgMTAwMDAwKX1cdTIwMjZgIDogZGV0YWlsO1xuXHRcdFx0dGhpcy5fdHlwZS50ZXh0Q29udGVudCA9IGNhcHBlZERldGFpbDtcblx0XHRcdHRoaXMuX3R5cGUudGl0bGUgPSBjYXBwZWREZXRhaWw7XG5cdFx0XHRkb20uc2hvdyh0aGlzLl90eXBlKTtcblx0XHRcdHRoaXMuX3R5cGUuY2xhc3NMaXN0LnRvZ2dsZSgnYXV0by13cmFwJywgIS9cXHI/XFxuXlxccysvZ21pLnRlc3QoY2FwcGVkRGV0YWlsKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRvbS5jbGVhck5vZGUodGhpcy5fdHlwZSk7XG5cdFx0XHR0aGlzLl90eXBlLnRpdGxlID0gJyc7XG5cdFx0XHRkb20uaGlkZSh0aGlzLl90eXBlKTtcblx0XHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCduby10eXBlJyk7XG5cdFx0fVxuXG5cdFx0Ly8gLy8gLS0tIGRvY3VtZW50YXRpb25cblxuXHRcdGRvbS5jbGVhck5vZGUodGhpcy5fZG9jcyk7XG5cdFx0aWYgKHR5cGVvZiBkb2N1bWVudGF0aW9uID09PSAnc3RyaW5nJykge1xuXHRcdFx0dGhpcy5fZG9jcy5jbGFzc0xpc3QucmVtb3ZlKCdtYXJrZG93bi1kb2NzJyk7XG5cdFx0XHR0aGlzLl9kb2NzLnRleHRDb250ZW50ID0gZG9jdW1lbnRhdGlvbjtcblxuXHRcdH0gZWxzZSBpZiAoZG9jdW1lbnRhdGlvbikge1xuXHRcdFx0dGhpcy5fZG9jcy5jbGFzc0xpc3QuYWRkKCdtYXJrZG93bi1kb2NzJyk7XG5cdFx0XHRkb20uY2xlYXJOb2RlKHRoaXMuX2RvY3MpO1xuXHRcdFx0Y29uc3QgcmVuZGVyZWRDb250ZW50cyA9IHRoaXMuX21hcmtkb3duUmVuZGVyZXIucmVuZGVyKGRvY3VtZW50YXRpb24sIHtcblx0XHRcdFx0YXN5bmNSZW5kZXJDYWxsYmFjazogKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMubGF5b3V0KHRoaXMuX3NpemUud2lkdGgsIHRoaXMuX3R5cGUuY2xpZW50SGVpZ2h0ICsgdGhpcy5fZG9jcy5jbGllbnRIZWlnaHQpO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudHMuZmlyZSh0aGlzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9kb2NzLmFwcGVuZENoaWxkKHJlbmRlcmVkQ29udGVudHMuZWxlbWVudCk7XG5cdFx0XHR0aGlzLl9yZW5kZXJEaXNwb3NlYWJsZS5hZGQocmVuZGVyZWRDb250ZW50cyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2RldGFpbC1hbmQtZG9jJywgISFkZXRhaWwgJiYgISFkb2N1bWVudGF0aW9uKTtcblxuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS51c2VyU2VsZWN0ID0gJ3RleHQnO1xuXHRcdHRoaXMuZG9tTm9kZS50YWJJbmRleCA9IC0xO1xuXG5cdFx0dGhpcy5fY2xvc2Uub25tb3VzZWRvd24gPSBlID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fTtcblx0XHR0aGlzLl9jbG9zZS5vbmNsaWNrID0gZSA9PiB7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0dGhpcy5fb25EaWRDbG9zZS5maXJlKCk7XG5cdFx0fTtcblxuXHRcdHRoaXMuX2JvZHkuc2Nyb2xsVG9wID0gMDtcblxuXHRcdHRoaXMubGF5b3V0KHRoaXMuX3NpemUud2lkdGgsIHRoaXMuX3R5cGUuY2xpZW50SGVpZ2h0ICsgdGhpcy5fZG9jcy5jbGllbnRIZWlnaHQgKyB0aGlzLmdldExheW91dEluZm8oKS52ZXJ0aWNhbFBhZGRpbmcpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudHMuZmlyZSh0aGlzKTtcblx0fVxuXG5cdGNsZWFyQ29udGVudHMoKSB7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ25vLWRvY3MnKTtcblx0XHR0aGlzLl90eXBlLnRleHRDb250ZW50ID0gJyc7XG5cdFx0dGhpcy5fZG9jcy50ZXh0Q29udGVudCA9ICcnO1xuXHR9XG5cblx0Z2V0IGlzRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QuY29udGFpbnMoJ25vLWRvY3MnKTtcblx0fVxuXG5cdGdldCBzaXplKCkge1xuXHRcdHJldHVybiB0aGlzLl9zaXplO1xuXHR9XG5cblx0bGF5b3V0KHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV3U2l6ZSA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHRcdGlmICghZG9tLkRpbWVuc2lvbi5lcXVhbHMobmV3U2l6ZSwgdGhpcy5fc2l6ZSkpIHtcblx0XHRcdHRoaXMuX3NpemUgPSBuZXdTaXplO1xuXHRcdFx0ZG9tLnNpemUodGhpcy5kb21Ob2RlLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHR9XG5cdFx0dGhpcy5fc2Nyb2xsYmFyLnNjYW5Eb21Ob2RlKCk7XG5cdH1cblxuXHRzY3JvbGxEb3duKG11Y2ggPSA4KTogdm9pZCB7XG5cdFx0dGhpcy5fYm9keS5zY3JvbGxUb3AgKz0gbXVjaDtcblx0fVxuXG5cdHNjcm9sbFVwKG11Y2ggPSA4KTogdm9pZCB7XG5cdFx0dGhpcy5fYm9keS5zY3JvbGxUb3AgLT0gbXVjaDtcblx0fVxuXG5cdHNjcm9sbFRvcCgpOiB2b2lkIHtcblx0XHR0aGlzLl9ib2R5LnNjcm9sbFRvcCA9IDA7XG5cdH1cblxuXHRzY3JvbGxCb3R0b20oKTogdm9pZCB7XG5cdFx0dGhpcy5fYm9keS5zY3JvbGxUb3AgPSB0aGlzLl9ib2R5LnNjcm9sbEhlaWdodDtcblx0fVxuXG5cdHBhZ2VEb3duKCk6IHZvaWQge1xuXHRcdHRoaXMuc2Nyb2xsRG93big4MCk7XG5cdH1cblxuXHRwYWdlVXAoKTogdm9pZCB7XG5cdFx0dGhpcy5zY3JvbGxVcCg4MCk7XG5cdH1cblxuXHRzZXQgYm9yZGVyV2lkdGgod2lkdGg6IG51bWJlcikge1xuXHRcdHRoaXMuX2JvcmRlcldpZHRoID0gd2lkdGg7XG5cdH1cblxuXHRnZXQgYm9yZGVyV2lkdGgoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2JvcmRlcldpZHRoO1xuXHR9XG5cblx0Zm9jdXMoKSB7XG5cdFx0dGhpcy5kb21Ob2RlLmZvY3VzKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNpbXBsZVN1Z2dlc3REZXRhaWxzT3ZlcmxheSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Jlc2l6YWJsZTogUmVzaXphYmxlSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBfYWRkZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfYW5jaG9yQm94PzogZG9tLklEb21Ob2RlUGFnZVBvc2l0aW9uO1xuXHQvLyBwcml2YXRlIF9wcmVmZXJBbGlnbkF0VG9wOiBib29sZWFuID0gdHJ1ZTtcblx0cHJpdmF0ZSBfdXNlclNpemU/OiBkb20uRGltZW5zaW9uO1xuXHRwcml2YXRlIF90b3BMZWZ0PzogVG9wTGVmdFBvc2l0aW9uO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHdpZGdldDogU2ltcGxlU3VnZ2VzdERldGFpbHNXaWRnZXQsXG5cdFx0cHJpdmF0ZSBfY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0KSB7XG5cblx0XHR0aGlzLl9yZXNpemFibGUgPSB0aGlzLl9kaXNwb3NhYmxlcy5hZGQobmV3IFJlc2l6YWJsZUhUTUxFbGVtZW50KCkpO1xuXHRcdHRoaXMuX3Jlc2l6YWJsZS5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3N1Z2dlc3QtZGV0YWlscy1jb250YWluZXInKTtcblx0XHR0aGlzLl9yZXNpemFibGUuZG9tTm9kZS5hcHBlbmRDaGlsZCh3aWRnZXQuZG9tTm9kZSk7XG5cdFx0dGhpcy5fcmVzaXphYmxlLmVuYWJsZVNhc2hlcyhmYWxzZSwgdHJ1ZSwgdHJ1ZSwgZmFsc2UpO1xuXG5cdFx0bGV0IHRvcExlZnROb3c6IFRvcExlZnRQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgc2l6ZU5vdzogZG9tLkRpbWVuc2lvbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZGVsdGFUb3A6IG51bWJlciA9IDA7XG5cdFx0bGV0IGRlbHRhTGVmdDogbnVtYmVyID0gMDtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fcmVzaXphYmxlLm9uRGlkV2lsbFJlc2l6ZSgoKSA9PiB7XG5cdFx0XHR0b3BMZWZ0Tm93ID0gdGhpcy5fdG9wTGVmdDtcblx0XHRcdHNpemVOb3cgPSB0aGlzLl9yZXNpemFibGUuc2l6ZTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fcmVzaXphYmxlLm9uRGlkUmVzaXplKGUgPT4ge1xuXHRcdFx0aWYgKHRvcExlZnROb3cgJiYgc2l6ZU5vdykge1xuXHRcdFx0XHR0aGlzLndpZGdldC5sYXlvdXQoZS5kaW1lbnNpb24ud2lkdGgsIGUuZGltZW5zaW9uLmhlaWdodCk7XG5cblx0XHRcdFx0bGV0IHVwZGF0ZVRvcExlZnQgPSBmYWxzZTtcblx0XHRcdFx0aWYgKGUud2VzdCkge1xuXHRcdFx0XHRcdGRlbHRhTGVmdCA9IHNpemVOb3cud2lkdGggLSBlLmRpbWVuc2lvbi53aWR0aDtcblx0XHRcdFx0XHR1cGRhdGVUb3BMZWZ0ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZS5ub3J0aCkge1xuXHRcdFx0XHRcdGRlbHRhVG9wID0gc2l6ZU5vdy5oZWlnaHQgLSBlLmRpbWVuc2lvbi5oZWlnaHQ7XG5cdFx0XHRcdFx0dXBkYXRlVG9wTGVmdCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHVwZGF0ZVRvcExlZnQpIHtcblx0XHRcdFx0XHR0aGlzLl9hcHBseVRvcExlZnQoe1xuXHRcdFx0XHRcdFx0dG9wOiB0b3BMZWZ0Tm93LnRvcCArIGRlbHRhVG9wLFxuXHRcdFx0XHRcdFx0bGVmdDogdG9wTGVmdE5vdy5sZWZ0ICsgZGVsdGFMZWZ0LFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5kb25lKSB7XG5cdFx0XHRcdHRvcExlZnROb3cgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHNpemVOb3cgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGRlbHRhVG9wID0gMDtcblx0XHRcdFx0ZGVsdGFMZWZ0ID0gMDtcblx0XHRcdFx0dGhpcy5fdXNlclNpemUgPSBlLmRpbWVuc2lvbjtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy53aWRnZXQub25EaWRDaGFuZ2VDb250ZW50cygoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fYW5jaG9yQm94KSB7XG5cdFx0XHRcdHRoaXMuX3BsYWNlQXRBbmNob3IodGhpcy5fYW5jaG9yQm94LCB0aGlzLl91c2VyU2l6ZSA/PyB0aGlzLndpZGdldC5zaXplKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMud2lkZ2V0LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5oaWRlKCk7XG5cdH1cblxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnc3VnZ2VzdC5kZXRhaWxzJztcblx0fVxuXG5cdGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9yZXNpemFibGUuZG9tTm9kZTtcblx0fVxuXG5cdHNob3coKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9hZGRlZCkge1xuXHRcdFx0dGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3Jlc2l6YWJsZS5kb21Ob2RlKTtcblx0XHRcdHRoaXMuX2FkZGVkID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRoaWRlKHNlc3Npb25FbmRlZDogYm9vbGVhbiA9IGZhbHNlKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVzaXphYmxlLmNsZWFyU2FzaEhvdmVyU3RhdGUoKTtcblxuXHRcdGlmICh0aGlzLl9hZGRlZCkge1xuXHRcdFx0dGhpcy5fY29udGFpbmVyLnJlbW92ZUNoaWxkKHRoaXMuX3Jlc2l6YWJsZS5kb21Ob2RlKTtcblx0XHRcdHRoaXMuX2FkZGVkID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9hbmNob3JCb3ggPSB1bmRlZmluZWQ7XG5cdFx0XHQvLyB0aGlzLl90b3BMZWZ0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoc2Vzc2lvbkVuZGVkKSB7XG5cdFx0XHR0aGlzLl91c2VyU2l6ZSA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMud2lkZ2V0LmNsZWFyQ29udGVudHMoKTtcblx0XHR9XG5cdH1cblxuXHRwbGFjZUF0QW5jaG9yKGFuY2hvcjogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBhbmNob3JCb3ggPSBhbmNob3IuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0dGhpcy5fYW5jaG9yQm94ID0gYW5jaG9yQm94O1xuXHRcdHRoaXMud2lkZ2V0LmxheW91dCh0aGlzLl9yZXNpemFibGUuc2l6ZS53aWR0aCwgdGhpcy5fcmVzaXphYmxlLnNpemUuaGVpZ2h0KTtcblx0XHR0aGlzLl9wbGFjZUF0QW5jaG9yKHRoaXMuX2FuY2hvckJveCwgdGhpcy5fdXNlclNpemUgPz8gdGhpcy53aWRnZXQuc2l6ZSk7XG5cdH1cblxuXHRfcGxhY2VBdEFuY2hvcihhbmNob3JCb3g6IGRvbS5JRG9tTm9kZVBhZ2VQb3NpdGlvbiwgc2l6ZTogZG9tLkRpbWVuc2lvbikge1xuXHRcdGNvbnN0IGJvZHlCb3ggPSBkb20uZ2V0Q2xpZW50QXJlYSh0aGlzLmdldERvbU5vZGUoKS5vd25lckRvY3VtZW50LmJvZHkpO1xuXG5cdFx0Y29uc3QgaW5mbyA9IHRoaXMud2lkZ2V0LmdldExheW91dEluZm8oKTtcblxuXHRcdGNvbnN0IGRlZmF1bHRNaW5TaXplID0gbmV3IGRvbS5EaW1lbnNpb24oMjIwLCAyICogaW5mby5saW5lSGVpZ2h0KTtcblx0XHRjb25zdCBkZWZhdWx0VG9wID0gYW5jaG9yQm94LnRvcDtcblxuXHRcdHR5cGUgUGxhY2VtZW50ID0geyB0b3A6IG51bWJlcjsgbGVmdDogbnVtYmVyOyBmaXQ6IG51bWJlcjsgbWF4U2l6ZVRvcDogZG9tLkRpbWVuc2lvbjsgbWF4U2l6ZUJvdHRvbTogZG9tLkRpbWVuc2lvbjsgbWluU2l6ZTogZG9tLkRpbWVuc2lvbiB9O1xuXG5cdFx0Ly8gRUFTVFxuXHRcdGNvbnN0IGVhc3RQbGFjZW1lbnQ6IFBsYWNlbWVudCA9IChmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCB3aWR0aCA9IGJvZHlCb3gud2lkdGggLSAoYW5jaG9yQm94LmxlZnQgKyBhbmNob3JCb3gud2lkdGggKyBpbmZvLmJvcmRlcldpZHRoICsgaW5mby5ob3Jpem9udGFsUGFkZGluZyk7XG5cdFx0XHRjb25zdCBsZWZ0ID0gLWluZm8uYm9yZGVyV2lkdGggKyBhbmNob3JCb3gubGVmdCArIGFuY2hvckJveC53aWR0aDtcblx0XHRcdGNvbnN0IG1heFNpemVUb3AgPSBuZXcgZG9tLkRpbWVuc2lvbih3aWR0aCwgYm9keUJveC5oZWlnaHQgLSBhbmNob3JCb3gudG9wIC0gaW5mby5ib3JkZXJIZWlnaHQgLSBpbmZvLnZlcnRpY2FsUGFkZGluZyk7XG5cdFx0XHRjb25zdCBtYXhTaXplQm90dG9tID0gbWF4U2l6ZVRvcC53aXRoKHVuZGVmaW5lZCwgYW5jaG9yQm94LnRvcCArIGFuY2hvckJveC5oZWlnaHQgLSBpbmZvLmJvcmRlckhlaWdodCAtIGluZm8udmVydGljYWxQYWRkaW5nKTtcblx0XHRcdHJldHVybiB7IHRvcDogZGVmYXVsdFRvcCwgbGVmdCwgZml0OiB3aWR0aCAtIHNpemUud2lkdGgsIG1heFNpemVUb3AsIG1heFNpemVCb3R0b20sIG1pblNpemU6IGRlZmF1bHRNaW5TaXplLndpdGgoTWF0aC5taW4od2lkdGgsIGRlZmF1bHRNaW5TaXplLndpZHRoKSkgfTtcblx0XHR9KSgpO1xuXG5cdFx0Ly8gV0VTVFxuXHRcdGNvbnN0IHdlc3RQbGFjZW1lbnQ6IFBsYWNlbWVudCA9IChmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCB3aWR0aCA9IGFuY2hvckJveC5sZWZ0IC0gaW5mby5ib3JkZXJXaWR0aCAtIGluZm8uaG9yaXpvbnRhbFBhZGRpbmc7XG5cdFx0XHRjb25zdCBsZWZ0ID0gTWF0aC5tYXgoaW5mby5ob3Jpem9udGFsUGFkZGluZywgYW5jaG9yQm94LmxlZnQgLSBzaXplLndpZHRoIC0gaW5mby5ib3JkZXJXaWR0aCk7XG5cdFx0XHRjb25zdCBtYXhTaXplVG9wID0gbmV3IGRvbS5EaW1lbnNpb24od2lkdGgsIGJvZHlCb3guaGVpZ2h0IC0gYW5jaG9yQm94LnRvcCAtIGluZm8uYm9yZGVySGVpZ2h0IC0gaW5mby52ZXJ0aWNhbFBhZGRpbmcpO1xuXHRcdFx0Y29uc3QgbWF4U2l6ZUJvdHRvbSA9IG1heFNpemVUb3Aud2l0aCh1bmRlZmluZWQsIGFuY2hvckJveC50b3AgKyBhbmNob3JCb3guaGVpZ2h0IC0gaW5mby5ib3JkZXJIZWlnaHQgLSBpbmZvLnZlcnRpY2FsUGFkZGluZyk7XG5cdFx0XHRyZXR1cm4geyB0b3A6IGRlZmF1bHRUb3AsIGxlZnQsIGZpdDogd2lkdGggLSBzaXplLndpZHRoLCBtYXhTaXplVG9wLCBtYXhTaXplQm90dG9tLCBtaW5TaXplOiBkZWZhdWx0TWluU2l6ZS53aXRoKE1hdGgubWluKHdpZHRoLCBkZWZhdWx0TWluU2l6ZS53aWR0aCkpIH07XG5cdFx0fSkoKTtcblxuXHRcdC8vIFNPVVRIXG5cdFx0Y29uc3Qgc291dGhQYWNlbWVudDogUGxhY2VtZW50ID0gKGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IGxlZnQgPSBhbmNob3JCb3gubGVmdDtcblx0XHRcdGNvbnN0IHRvcCA9IC1pbmZvLmJvcmRlcldpZHRoICsgYW5jaG9yQm94LnRvcCArIGFuY2hvckJveC5oZWlnaHQ7XG5cdFx0XHRjb25zdCBtYXhTaXplQm90dG9tID0gbmV3IGRvbS5EaW1lbnNpb24oYW5jaG9yQm94LndpZHRoIC0gaW5mby5ib3JkZXJIZWlnaHQsIGJvZHlCb3guaGVpZ2h0IC0gYW5jaG9yQm94LnRvcCAtIGFuY2hvckJveC5oZWlnaHQgLSBpbmZvLnZlcnRpY2FsUGFkZGluZyk7XG5cdFx0XHRyZXR1cm4geyB0b3AsIGxlZnQsIGZpdDogbWF4U2l6ZUJvdHRvbS5oZWlnaHQgLSBzaXplLmhlaWdodCwgbWF4U2l6ZUJvdHRvbSwgbWF4U2l6ZVRvcDogbWF4U2l6ZUJvdHRvbSwgbWluU2l6ZTogZGVmYXVsdE1pblNpemUud2l0aChtYXhTaXplQm90dG9tLndpZHRoKSB9O1xuXHRcdH0pKCk7XG5cblx0XHQvLyB0YWtlIGZpcnN0IHBsYWNlbWVudCB0aGF0IGZpdHMgb3IgdGhlIGZpcnN0IHdpdGggXCJsZWFzdCBiYWRcIiBmaXRcblx0XHRjb25zdCBwbGFjZW1lbnRzID0gW2Vhc3RQbGFjZW1lbnQsIHdlc3RQbGFjZW1lbnQsIHNvdXRoUGFjZW1lbnRdO1xuXHRcdGNvbnN0IHBsYWNlbWVudCA9IHBsYWNlbWVudHMuZmluZChwID0+IHAuZml0ID49IDApID8/IHBsYWNlbWVudHMuc29ydCgoYSwgYikgPT4gYi5maXQgLSBhLmZpdClbMF07XG5cblx0XHQvLyB0b3AvYm90dG9tIHBsYWNlbWVudFxuXHRcdGNvbnN0IGJvdHRvbSA9IGFuY2hvckJveC50b3AgKyBhbmNob3JCb3guaGVpZ2h0IC0gaW5mby5ib3JkZXJIZWlnaHQ7XG5cdFx0bGV0IGFsaWduQXRUb3A6IGJvb2xlYW47XG5cdFx0bGV0IGhlaWdodCA9IHNpemUuaGVpZ2h0O1xuXHRcdGNvbnN0IG1heEhlaWdodCA9IE1hdGgubWF4KHBsYWNlbWVudC5tYXhTaXplVG9wLmhlaWdodCwgcGxhY2VtZW50Lm1heFNpemVCb3R0b20uaGVpZ2h0KTtcblx0XHRpZiAoaGVpZ2h0ID4gbWF4SGVpZ2h0KSB7XG5cdFx0XHRoZWlnaHQgPSBtYXhIZWlnaHQ7XG5cdFx0fVxuXHRcdGxldCBtYXhTaXplOiBkb20uRGltZW5zaW9uO1xuXHRcdC8vIGlmIChwcmVmZXJBbGlnbkF0VG9wKSB7XG5cdFx0aWYgKGhlaWdodCA8PSBwbGFjZW1lbnQubWF4U2l6ZVRvcC5oZWlnaHQpIHtcblx0XHRcdGFsaWduQXRUb3AgPSB0cnVlO1xuXHRcdFx0bWF4U2l6ZSA9IHBsYWNlbWVudC5tYXhTaXplVG9wO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhbGlnbkF0VG9wID0gZmFsc2U7XG5cdFx0XHRtYXhTaXplID0gcGxhY2VtZW50Lm1heFNpemVCb3R0b207XG5cdFx0fVxuXHRcdC8vIH0gZWxzZSB7XG5cdFx0Ly8gXHRpZiAoaGVpZ2h0IDw9IHBsYWNlbWVudC5tYXhTaXplQm90dG9tLmhlaWdodCkge1xuXHRcdC8vIFx0XHRhbGlnbkF0VG9wID0gZmFsc2U7XG5cdFx0Ly8gXHRcdG1heFNpemUgPSBwbGFjZW1lbnQubWF4U2l6ZUJvdHRvbTtcblx0XHQvLyBcdH0gZWxzZSB7XG5cdFx0Ly8gXHRcdGFsaWduQXRUb3AgPSB0cnVlO1xuXHRcdC8vIFx0XHRtYXhTaXplID0gcGxhY2VtZW50Lm1heFNpemVUb3A7XG5cdFx0Ly8gXHR9XG5cdFx0Ly8gfVxuXG5cdFx0bGV0IHsgdG9wLCBsZWZ0IH0gPSBwbGFjZW1lbnQ7XG5cdFx0aWYgKCFhbGlnbkF0VG9wICYmIGhlaWdodCA+IGFuY2hvckJveC5oZWlnaHQpIHtcblx0XHRcdHRvcCA9IGJvdHRvbSAtIGhlaWdodDtcblx0XHR9XG5cdFx0Y29uc3QgZWRpdG9yRG9tTm9kZSA9IHRoaXMuX2NvbnRhaW5lcjtcblx0XHRpZiAoZWRpdG9yRG9tTm9kZSkge1xuXHRcdFx0Ly8gZ2V0IGJvdW5kaW5nIHJlY3RhbmdsZSBvZiB0aGUgc3VnZ2VzdCB3aWRnZXQgcmVsYXRpdmUgdG8gdGhlIGVkaXRvclxuXHRcdFx0Y29uc3QgZWRpdG9yQm91bmRpbmdCb3ggPSBlZGl0b3JEb21Ob2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0dG9wIC09IGVkaXRvckJvdW5kaW5nQm94LnRvcDtcblx0XHRcdGxlZnQgLT0gZWRpdG9yQm91bmRpbmdCb3gubGVmdDtcblx0XHR9XG5cdFx0dGhpcy5fYXBwbHlUb3BMZWZ0KHsgbGVmdCwgdG9wIH0pO1xuXG5cdFx0dGhpcy5fcmVzaXphYmxlLmVuYWJsZVNhc2hlcyghYWxpZ25BdFRvcCwgcGxhY2VtZW50ID09PSBlYXN0UGxhY2VtZW50LCBhbGlnbkF0VG9wLCBwbGFjZW1lbnQgIT09IGVhc3RQbGFjZW1lbnQpO1xuXG5cdFx0dGhpcy5fcmVzaXphYmxlLm1pblNpemUgPSBwbGFjZW1lbnQubWluU2l6ZTtcblx0XHR0aGlzLl9yZXNpemFibGUubWF4U2l6ZSA9IG1heFNpemU7XG5cdFx0dGhpcy5fcmVzaXphYmxlLmxheW91dChoZWlnaHQsIE1hdGgubWluKG1heFNpemUud2lkdGgsIHNpemUud2lkdGgpKTtcblx0XHR0aGlzLndpZGdldC5sYXlvdXQodGhpcy5fcmVzaXphYmxlLnNpemUud2lkdGgsIHRoaXMuX3Jlc2l6YWJsZS5zaXplLmhlaWdodCk7XG5cdH1cblxuXHRwcml2YXRlIF9hcHBseVRvcExlZnQodG9wTGVmdDogeyBsZWZ0OiBudW1iZXI7IHRvcDogbnVtYmVyIH0pOiB2b2lkIHtcblx0XHR0aGlzLl90b3BMZWZ0ID0gdG9wTGVmdDtcblx0XHQvLyB0aGlzLl9lZGl0b3IubGF5b3V0T3ZlcmxheVdpZGdldCh0aGlzKTtcblx0XHR0aGlzLl9yZXNpemFibGUuZG9tTm9kZS5zdHlsZS50b3AgPSBgJHt0b3BMZWZ0LnRvcH1weGA7XG5cdFx0dGhpcy5fcmVzaXphYmxlLmRvbU5vZGUuc3R5bGUubGVmdCA9IGAke3RvcExlZnQubGVmdH1weGA7XG5cdFx0dGhpcy5fcmVzaXphYmxlLmRvbU5vZGUuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHR9XG59XG5cbmludGVyZmFjZSBUb3BMZWZ0UG9zaXRpb24ge1xuXHR0b3A6IG51bWJlcjtcblx0bGVmdDogbnVtYmVyO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw0QkFBNEI7QUFDckMsWUFBWSxTQUFTO0FBRXJCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNkJBQTZCO0FBRy9CLFNBQVMsd0JBQXdCLE1BQWlEO0FBQ3hGLFNBQU8sQ0FBQyxDQUFDLFFBQVEsUUFBUSxLQUFLLFdBQVcsaUJBQWlCLEtBQUssV0FBVyxVQUFVLEtBQUssV0FBVyxXQUFXLEtBQUssV0FBVyxLQUFLO0FBQ3JJO0FBRU8sTUFBTSwwQkFBMEI7QUFFaEMsSUFBTSw2QkFBTixNQUFpQztBQUFBLEVBd0J2QyxZQUNrQixjQUNqQixxQkFDaUIsZ0NBQ00sY0FDdEI7QUFKZ0I7QUFFQTtBQXZCbEIsU0FBaUIsY0FBYyxJQUFJLFFBQWM7QUFDakQsU0FBUyxhQUEwQixLQUFLLFlBQVk7QUFFcEQsU0FBaUIsdUJBQXVCLElBQUksUUFBYztBQUMxRCxTQUFTLHNCQUFtQyxLQUFLLHFCQUFxQjtBQVF0RSxTQUFpQixlQUFlLElBQUksZ0JBQWdCO0FBSXBELFNBQWlCLHFCQUFxQixLQUFLLGFBQWEsSUFBSSxJQUFJLGdCQUFnQixDQUFDO0FBQ2pGLFNBQVEsZUFBdUI7QUFDL0IsU0FBUSxRQUFRLElBQUksSUFBSSxVQUFVLEtBQUssQ0FBQztBQVF2QyxTQUFLLFVBQVUsSUFBSSxFQUFFLGtCQUFrQjtBQUN2QyxTQUFLLFFBQVEsVUFBVSxJQUFJLFNBQVM7QUFFcEMsU0FBSyxvQkFBb0IsYUFBYSxlQUFlLGtCQUFrQixDQUFDLENBQUM7QUFFekUsU0FBSyxRQUFRLElBQUksRUFBRSxPQUFPO0FBRTFCLFNBQUssYUFBYSxJQUFJLHFCQUFxQixLQUFLLE9BQU87QUFBQSxNQUN0RCx5QkFBeUI7QUFBQSxJQUMxQixDQUFDO0FBQ0QsUUFBSSxPQUFPLEtBQUssU0FBUyxLQUFLLFdBQVcsV0FBVyxDQUFDO0FBQ3JELFNBQUssYUFBYSxJQUFJLEtBQUssVUFBVTtBQUVyQyxTQUFLLFVBQVUsSUFBSSxPQUFPLEtBQUssT0FBTyxJQUFJLEVBQUUsU0FBUyxDQUFDO0FBQ3RELFNBQUssU0FBUyxJQUFJLE9BQU8sS0FBSyxTQUFTLElBQUksRUFBRSxTQUFTLFVBQVUsY0FBYyxRQUFRLEtBQUssQ0FBQyxDQUFDO0FBQzdGLFNBQUssT0FBTyxRQUFRLElBQUksU0FBUyxpQkFBaUIsT0FBTztBQUN6RCxTQUFLLE9BQU8sT0FBTztBQUNuQixTQUFLLE9BQU8sV0FBVztBQUN2QixTQUFLLFFBQVEsSUFBSSxPQUFPLEtBQUssU0FBUyxJQUFJLEVBQUUsUUFBUSxDQUFDO0FBRXJELFNBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxPQUFPLElBQUksRUFBRSxRQUFRLENBQUM7QUFFbkQsU0FBSyxlQUFlO0FBRXBCLFNBQUssYUFBYSxJQUFJLG9CQUFvQixNQUFNLEtBQUssZUFBZSxDQUFDLENBQUM7QUFBQSxFQUN2RTtBQUFBLEVBRVEsaUJBQXVCO0FBQzlCLFVBQU0sV0FBVyxLQUFLLGFBQWE7QUFDbkMsVUFBTSxhQUFhLFNBQVM7QUFFNUIsVUFBTSxXQUFXLFNBQVM7QUFDMUIsVUFBTSxhQUFhLFNBQVM7QUFDNUIsVUFBTSxhQUFhLFNBQVM7QUFDNUIsVUFBTSxhQUFhLEdBQUcsUUFBUTtBQUM5QixVQUFNLGVBQWUsR0FBRyxVQUFVO0FBRWxDLFNBQUssUUFBUSxNQUFNLFdBQVc7QUFDOUIsU0FBSyxRQUFRLE1BQU0sYUFBYSxHQUFHLGFBQWEsUUFBUTtBQUN4RCxTQUFLLFFBQVEsTUFBTSxhQUFhO0FBRWhDLFNBQUssTUFBTSxNQUFNLGFBQWE7QUFDOUIsU0FBSyxPQUFPLE1BQU0sU0FBUztBQUMzQixTQUFLLE9BQU8sTUFBTSxRQUFRO0FBQUEsRUFFM0I7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsU0FBSyxhQUFhLFFBQVE7QUFDMUIsU0FBSyxZQUFZLFFBQVE7QUFDekIsU0FBSyxxQkFBcUIsUUFBUTtBQUFBLEVBQ25DO0FBQUEsRUFFQSxnQkFBZ0I7QUFDZixVQUFNLGFBQWEsS0FBSyxhQUFhLEVBQUU7QUFDdkMsVUFBTSxjQUFjLEtBQUs7QUFDekIsVUFBTSxlQUFlLGNBQWM7QUFDbkMsV0FBTztBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsaUJBQWlCO0FBQUEsTUFDakIsbUJBQW1CO0FBQUEsSUFDcEI7QUFBQSxFQUNEO0FBQUEsRUFFQSxnQkFBc0I7QUFDckIsU0FBSyxNQUFNLGNBQWMsSUFBSSxTQUFTLFdBQVcsWUFBWTtBQUM3RCxTQUFLLE1BQU0sY0FBYztBQUN6QixTQUFLLFFBQVEsVUFBVSxPQUFPLFdBQVcsU0FBUztBQUNsRCxTQUFLLE9BQU8sS0FBSyxLQUFLLE9BQU8sS0FBSyxjQUFjLEVBQUUsYUFBYSxDQUFDO0FBQ2hFLFNBQUsscUJBQXFCLEtBQUssSUFBSTtBQUFBLEVBQ3BDO0FBQUEsRUFFQSxXQUFXLE1BQTRCLGFBQTRCO0FBQ2xFLFNBQUssbUJBQW1CLE1BQU07QUFFOUIsUUFBSSxFQUFFLFFBQVEsY0FBYyxJQUFJLEtBQUs7QUFFckMsUUFBSSxLQUFLO0FBRVQsUUFBSSxhQUFhO0FBQ2hCLFlBQU0sVUFBVSxLQUFLLE1BQU0sQ0FBQyxDQUFDO0FBQUE7QUFDN0IsWUFBTSxXQUFXLEtBQUssUUFBUSxhQUFhO0FBQUE7QUFDM0MsWUFBTSxxQkFBcUIsS0FBSyxXQUFXLGdCQUFnQjtBQUFBO0FBQzNELFlBQU0sc0JBQXNCLEtBQUssV0FBVyxpQkFBaUI7QUFBQTtBQUM3RCxZQUFNLFVBQVUsS0FBSyxHQUFHO0FBQUE7QUFDeEIsVUFBSSxLQUFLLGdDQUFnQztBQUN4QyxjQUFNLGtCQUFrQixLQUFLLCtCQUErQjtBQUM1RCxZQUFJLGlCQUFpQjtBQUNwQixnQkFBTSxHQUFHLGVBQWU7QUFBQTtBQUFBLFFBQ3pCO0FBQUEsTUFDRDtBQUNBLGVBQVMsYUFBYSxLQUFLLFdBQVcsUUFBUTtBQUM5QyxzQkFBZ0IsSUFBSSxlQUFlLEVBQUUsZ0JBQWdCLFNBQVMsRUFBRTtBQUFBLElBQ2pFO0FBRUEsUUFBSSxDQUFDLGVBQWUsQ0FBQyx3QkFBd0IsSUFBSSxHQUFHO0FBQ25ELFdBQUssY0FBYztBQUNuQjtBQUFBLElBQ0Q7QUFFQSxTQUFLLFFBQVEsVUFBVSxPQUFPLFdBQVcsU0FBUztBQUlsRCxRQUFJLFFBQVE7QUFDWCxZQUFNLGVBQWUsT0FBTyxTQUFTLE1BQVMsR0FBRyxPQUFPLE9BQU8sR0FBRyxHQUFNLENBQUMsV0FBTTtBQUMvRSxXQUFLLE1BQU0sY0FBYztBQUN6QixXQUFLLE1BQU0sUUFBUTtBQUNuQixVQUFJLEtBQUssS0FBSyxLQUFLO0FBQ25CLFdBQUssTUFBTSxVQUFVLE9BQU8sYUFBYSxDQUFDLGVBQWUsS0FBSyxZQUFZLENBQUM7QUFBQSxJQUM1RSxPQUFPO0FBQ04sVUFBSSxVQUFVLEtBQUssS0FBSztBQUN4QixXQUFLLE1BQU0sUUFBUTtBQUNuQixVQUFJLEtBQUssS0FBSyxLQUFLO0FBQ25CLFdBQUssUUFBUSxVQUFVLElBQUksU0FBUztBQUFBLElBQ3JDO0FBSUEsUUFBSSxVQUFVLEtBQUssS0FBSztBQUN4QixRQUFJLE9BQU8sa0JBQWtCLFVBQVU7QUFDdEMsV0FBSyxNQUFNLFVBQVUsT0FBTyxlQUFlO0FBQzNDLFdBQUssTUFBTSxjQUFjO0FBQUEsSUFFMUIsV0FBVyxlQUFlO0FBQ3pCLFdBQUssTUFBTSxVQUFVLElBQUksZUFBZTtBQUN4QyxVQUFJLFVBQVUsS0FBSyxLQUFLO0FBQ3hCLFlBQU0sbUJBQW1CLEtBQUssa0JBQWtCLE9BQU8sZUFBZTtBQUFBLFFBQ3JFLHFCQUFxQixNQUFNO0FBQzFCLGVBQUssT0FBTyxLQUFLLE1BQU0sT0FBTyxLQUFLLE1BQU0sZUFBZSxLQUFLLE1BQU0sWUFBWTtBQUMvRSxlQUFLLHFCQUFxQixLQUFLLElBQUk7QUFBQSxRQUNwQztBQUFBLE1BQ0QsQ0FBQztBQUNELFdBQUssTUFBTSxZQUFZLGlCQUFpQixPQUFPO0FBQy9DLFdBQUssbUJBQW1CLElBQUksZ0JBQWdCO0FBQUEsSUFDN0M7QUFFQSxTQUFLLFFBQVEsVUFBVSxPQUFPLGtCQUFrQixDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsYUFBYTtBQUUzRSxTQUFLLFFBQVEsTUFBTSxhQUFhO0FBQ2hDLFNBQUssUUFBUSxXQUFXO0FBRXhCLFNBQUssT0FBTyxjQUFjLE9BQUs7QUFDOUIsUUFBRSxlQUFlO0FBQ2pCLFFBQUUsZ0JBQWdCO0FBQUEsSUFDbkI7QUFDQSxTQUFLLE9BQU8sVUFBVSxPQUFLO0FBQzFCLFFBQUUsZUFBZTtBQUNqQixRQUFFLGdCQUFnQjtBQUNsQixXQUFLLFlBQVksS0FBSztBQUFBLElBQ3ZCO0FBRUEsU0FBSyxNQUFNLFlBQVk7QUFFdkIsU0FBSyxPQUFPLEtBQUssTUFBTSxPQUFPLEtBQUssTUFBTSxlQUFlLEtBQUssTUFBTSxlQUFlLEtBQUssY0FBYyxFQUFFLGVBQWU7QUFDdEgsU0FBSyxxQkFBcUIsS0FBSyxJQUFJO0FBQUEsRUFDcEM7QUFBQSxFQUVBLGdCQUFnQjtBQUNmLFNBQUssUUFBUSxVQUFVLElBQUksU0FBUztBQUNwQyxTQUFLLE1BQU0sY0FBYztBQUN6QixTQUFLLE1BQU0sY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFFQSxJQUFJLFVBQW1CO0FBQ3RCLFdBQU8sS0FBSyxRQUFRLFVBQVUsU0FBUyxTQUFTO0FBQUEsRUFDakQ7QUFBQSxFQUVBLElBQUksT0FBTztBQUNWLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLE9BQU8sT0FBZSxRQUFzQjtBQUMzQyxVQUFNLFVBQVUsSUFBSSxJQUFJLFVBQVUsT0FBTyxNQUFNO0FBQy9DLFFBQUksQ0FBQyxJQUFJLFVBQVUsT0FBTyxTQUFTLEtBQUssS0FBSyxHQUFHO0FBQy9DLFdBQUssUUFBUTtBQUNiLFVBQUksS0FBSyxLQUFLLFNBQVMsT0FBTyxNQUFNO0FBQUEsSUFDckM7QUFDQSxTQUFLLFdBQVcsWUFBWTtBQUFBLEVBQzdCO0FBQUEsRUFFQSxXQUFXLE9BQU8sR0FBUztBQUMxQixTQUFLLE1BQU0sYUFBYTtBQUFBLEVBQ3pCO0FBQUEsRUFFQSxTQUFTLE9BQU8sR0FBUztBQUN4QixTQUFLLE1BQU0sYUFBYTtBQUFBLEVBQ3pCO0FBQUEsRUFFQSxZQUFrQjtBQUNqQixTQUFLLE1BQU0sWUFBWTtBQUFBLEVBQ3hCO0FBQUEsRUFFQSxlQUFxQjtBQUNwQixTQUFLLE1BQU0sWUFBWSxLQUFLLE1BQU07QUFBQSxFQUNuQztBQUFBLEVBRUEsV0FBaUI7QUFDaEIsU0FBSyxXQUFXLEVBQUU7QUFBQSxFQUNuQjtBQUFBLEVBRUEsU0FBZTtBQUNkLFNBQUssU0FBUyxFQUFFO0FBQUEsRUFDakI7QUFBQSxFQUVBLElBQUksWUFBWSxPQUFlO0FBQzlCLFNBQUssZUFBZTtBQUFBLEVBQ3JCO0FBQUEsRUFFQSxJQUFJLGNBQWM7QUFDakIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsUUFBUTtBQUNQLFNBQUssUUFBUSxNQUFNO0FBQUEsRUFDcEI7QUFDRDtBQXhQYSw2QkFBTjtBQUFBLEVBNEJKO0FBQUEsR0E1QlU7QUEwUE4sTUFBTSw0QkFBNEI7QUFBQSxFQVd4QyxZQUNVLFFBQ0QsWUFDUDtBQUZRO0FBQ0Q7QUFYVCxTQUFpQixlQUFlLElBQUksZ0JBQWdCO0FBR3BELFNBQVEsU0FBa0I7QUFXekIsU0FBSyxhQUFhLEtBQUssYUFBYSxJQUFJLElBQUkscUJBQXFCLENBQUM7QUFDbEUsU0FBSyxXQUFXLFFBQVEsVUFBVSxJQUFJLDJCQUEyQjtBQUNqRSxTQUFLLFdBQVcsUUFBUSxZQUFZLE9BQU8sT0FBTztBQUNsRCxTQUFLLFdBQVcsYUFBYSxPQUFPLE1BQU0sTUFBTSxLQUFLO0FBRXJELFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSSxXQUFtQjtBQUN2QixRQUFJLFlBQW9CO0FBQ3hCLFNBQUssYUFBYSxJQUFJLEtBQUssV0FBVyxnQkFBZ0IsTUFBTTtBQUMzRCxtQkFBYSxLQUFLO0FBQ2xCLGdCQUFVLEtBQUssV0FBVztBQUFBLElBQzNCLENBQUMsQ0FBQztBQUVGLFNBQUssYUFBYSxJQUFJLEtBQUssV0FBVyxZQUFZLE9BQUs7QUFDdEQsVUFBSSxjQUFjLFNBQVM7QUFDMUIsYUFBSyxPQUFPLE9BQU8sRUFBRSxVQUFVLE9BQU8sRUFBRSxVQUFVLE1BQU07QUFFeEQsWUFBSSxnQkFBZ0I7QUFDcEIsWUFBSSxFQUFFLE1BQU07QUFDWCxzQkFBWSxRQUFRLFFBQVEsRUFBRSxVQUFVO0FBQ3hDLDBCQUFnQjtBQUFBLFFBQ2pCO0FBQ0EsWUFBSSxFQUFFLE9BQU87QUFDWixxQkFBVyxRQUFRLFNBQVMsRUFBRSxVQUFVO0FBQ3hDLDBCQUFnQjtBQUFBLFFBQ2pCO0FBQ0EsWUFBSSxlQUFlO0FBQ2xCLGVBQUssY0FBYztBQUFBLFlBQ2xCLEtBQUssV0FBVyxNQUFNO0FBQUEsWUFDdEIsTUFBTSxXQUFXLE9BQU87QUFBQSxVQUN6QixDQUFDO0FBQUEsUUFDRjtBQUFBLE1BQ0Q7QUFDQSxVQUFJLEVBQUUsTUFBTTtBQUNYLHFCQUFhO0FBQ2Isa0JBQVU7QUFDVixtQkFBVztBQUNYLG9CQUFZO0FBQ1osYUFBSyxZQUFZLEVBQUU7QUFBQSxNQUNwQjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxhQUFhLElBQUksS0FBSyxPQUFPLG9CQUFvQixNQUFNO0FBQzNELFVBQUksS0FBSyxZQUFZO0FBQ3BCLGFBQUssZUFBZSxLQUFLLFlBQVksS0FBSyxhQUFhLEtBQUssT0FBTyxJQUFJO0FBQUEsTUFDeEU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsU0FBSyxPQUFPLFFBQVE7QUFDcEIsU0FBSyxhQUFhLFFBQVE7QUFDMUIsU0FBSyxLQUFLO0FBQUEsRUFDWDtBQUFBLEVBRUEsUUFBZ0I7QUFDZixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsYUFBMEI7QUFDekIsV0FBTyxLQUFLLFdBQVc7QUFBQSxFQUN4QjtBQUFBLEVBRUEsT0FBYTtBQUNaLFFBQUksQ0FBQyxLQUFLLFFBQVE7QUFDakIsV0FBSyxXQUFXLFlBQVksS0FBSyxXQUFXLE9BQU87QUFDbkQsV0FBSyxTQUFTO0FBQUEsSUFDZjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLEtBQUssZUFBd0IsT0FBYTtBQUN6QyxTQUFLLFdBQVcsb0JBQW9CO0FBRXBDLFFBQUksS0FBSyxRQUFRO0FBQ2hCLFdBQUssV0FBVyxZQUFZLEtBQUssV0FBVyxPQUFPO0FBQ25ELFdBQUssU0FBUztBQUNkLFdBQUssYUFBYTtBQUFBLElBRW5CO0FBQ0EsUUFBSSxjQUFjO0FBQ2pCLFdBQUssWUFBWTtBQUNqQixXQUFLLE9BQU8sY0FBYztBQUFBLElBQzNCO0FBQUEsRUFDRDtBQUFBLEVBRUEsY0FBYyxRQUFxQjtBQUNsQyxVQUFNLFlBQVksT0FBTyxzQkFBc0I7QUFDL0MsU0FBSyxhQUFhO0FBQ2xCLFNBQUssT0FBTyxPQUFPLEtBQUssV0FBVyxLQUFLLE9BQU8sS0FBSyxXQUFXLEtBQUssTUFBTTtBQUMxRSxTQUFLLGVBQWUsS0FBSyxZQUFZLEtBQUssYUFBYSxLQUFLLE9BQU8sSUFBSTtBQUFBLEVBQ3hFO0FBQUEsRUFFQSxlQUFlLFdBQXFDLE1BQXFCO0FBQ3hFLFVBQU0sVUFBVSxJQUFJLGNBQWMsS0FBSyxXQUFXLEVBQUUsY0FBYyxJQUFJO0FBRXRFLFVBQU0sT0FBTyxLQUFLLE9BQU8sY0FBYztBQUV2QyxVQUFNLGlCQUFpQixJQUFJLElBQUksVUFBVSxLQUFLLElBQUksS0FBSyxVQUFVO0FBQ2pFLFVBQU0sYUFBYSxVQUFVO0FBSzdCLFVBQU0sZ0JBQTRCLFdBQVk7QUFDN0MsWUFBTSxRQUFRLFFBQVEsU0FBUyxVQUFVLE9BQU8sVUFBVSxRQUFRLEtBQUssY0FBYyxLQUFLO0FBQzFGLFlBQU1BLFFBQU8sQ0FBQyxLQUFLLGNBQWMsVUFBVSxPQUFPLFVBQVU7QUFDNUQsWUFBTSxhQUFhLElBQUksSUFBSSxVQUFVLE9BQU8sUUFBUSxTQUFTLFVBQVUsTUFBTSxLQUFLLGVBQWUsS0FBSyxlQUFlO0FBQ3JILFlBQU0sZ0JBQWdCLFdBQVcsS0FBSyxRQUFXLFVBQVUsTUFBTSxVQUFVLFNBQVMsS0FBSyxlQUFlLEtBQUssZUFBZTtBQUM1SCxhQUFPLEVBQUUsS0FBSyxZQUFZLE1BQUFBLE9BQU0sS0FBSyxRQUFRLEtBQUssT0FBTyxZQUFZLGVBQWUsU0FBUyxlQUFlLEtBQUssS0FBSyxJQUFJLE9BQU8sZUFBZSxLQUFLLENBQUMsRUFBRTtBQUFBLElBQ3pKLEVBQUc7QUFHSCxVQUFNLGdCQUE0QixXQUFZO0FBQzdDLFlBQU0sUUFBUSxVQUFVLE9BQU8sS0FBSyxjQUFjLEtBQUs7QUFDdkQsWUFBTUEsUUFBTyxLQUFLLElBQUksS0FBSyxtQkFBbUIsVUFBVSxPQUFPLEtBQUssUUFBUSxLQUFLLFdBQVc7QUFDNUYsWUFBTSxhQUFhLElBQUksSUFBSSxVQUFVLE9BQU8sUUFBUSxTQUFTLFVBQVUsTUFBTSxLQUFLLGVBQWUsS0FBSyxlQUFlO0FBQ3JILFlBQU0sZ0JBQWdCLFdBQVcsS0FBSyxRQUFXLFVBQVUsTUFBTSxVQUFVLFNBQVMsS0FBSyxlQUFlLEtBQUssZUFBZTtBQUM1SCxhQUFPLEVBQUUsS0FBSyxZQUFZLE1BQUFBLE9BQU0sS0FBSyxRQUFRLEtBQUssT0FBTyxZQUFZLGVBQWUsU0FBUyxlQUFlLEtBQUssS0FBSyxJQUFJLE9BQU8sZUFBZSxLQUFLLENBQUMsRUFBRTtBQUFBLElBQ3pKLEVBQUc7QUFHSCxVQUFNLGdCQUE0QixXQUFZO0FBQzdDLFlBQU1BLFFBQU8sVUFBVTtBQUN2QixZQUFNQyxPQUFNLENBQUMsS0FBSyxjQUFjLFVBQVUsTUFBTSxVQUFVO0FBQzFELFlBQU0sZ0JBQWdCLElBQUksSUFBSSxVQUFVLFVBQVUsUUFBUSxLQUFLLGNBQWMsUUFBUSxTQUFTLFVBQVUsTUFBTSxVQUFVLFNBQVMsS0FBSyxlQUFlO0FBQ3JKLGFBQU8sRUFBRSxLQUFBQSxNQUFLLE1BQUFELE9BQU0sS0FBSyxjQUFjLFNBQVMsS0FBSyxRQUFRLGVBQWUsWUFBWSxlQUFlLFNBQVMsZUFBZSxLQUFLLGNBQWMsS0FBSyxFQUFFO0FBQUEsSUFDMUosRUFBRztBQUdILFVBQU0sYUFBYSxDQUFDLGVBQWUsZUFBZSxhQUFhO0FBQy9ELFVBQU0sWUFBWSxXQUFXLEtBQUssT0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLFdBQVcsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUdoRyxVQUFNLFNBQVMsVUFBVSxNQUFNLFVBQVUsU0FBUyxLQUFLO0FBQ3ZELFFBQUk7QUFDSixRQUFJLFNBQVMsS0FBSztBQUNsQixVQUFNLFlBQVksS0FBSyxJQUFJLFVBQVUsV0FBVyxRQUFRLFVBQVUsY0FBYyxNQUFNO0FBQ3RGLFFBQUksU0FBUyxXQUFXO0FBQ3ZCLGVBQVM7QUFBQSxJQUNWO0FBQ0EsUUFBSTtBQUVKLFFBQUksVUFBVSxVQUFVLFdBQVcsUUFBUTtBQUMxQyxtQkFBYTtBQUNiLGdCQUFVLFVBQVU7QUFBQSxJQUNyQixPQUFPO0FBQ04sbUJBQWE7QUFDYixnQkFBVSxVQUFVO0FBQUEsSUFDckI7QUFXQSxRQUFJLEVBQUUsS0FBSyxLQUFLLElBQUk7QUFDcEIsUUFBSSxDQUFDLGNBQWMsU0FBUyxVQUFVLFFBQVE7QUFDN0MsWUFBTSxTQUFTO0FBQUEsSUFDaEI7QUFDQSxVQUFNLGdCQUFnQixLQUFLO0FBQzNCLFFBQUksZUFBZTtBQUVsQixZQUFNLG9CQUFvQixjQUFjLHNCQUFzQjtBQUM5RCxhQUFPLGtCQUFrQjtBQUN6QixjQUFRLGtCQUFrQjtBQUFBLElBQzNCO0FBQ0EsU0FBSyxjQUFjLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFFaEMsU0FBSyxXQUFXLGFBQWEsQ0FBQyxZQUFZLGNBQWMsZUFBZSxZQUFZLGNBQWMsYUFBYTtBQUU5RyxTQUFLLFdBQVcsVUFBVSxVQUFVO0FBQ3BDLFNBQUssV0FBVyxVQUFVO0FBQzFCLFNBQUssV0FBVyxPQUFPLFFBQVEsS0FBSyxJQUFJLFFBQVEsT0FBTyxLQUFLLEtBQUssQ0FBQztBQUNsRSxTQUFLLE9BQU8sT0FBTyxLQUFLLFdBQVcsS0FBSyxPQUFPLEtBQUssV0FBVyxLQUFLLE1BQU07QUFBQSxFQUMzRTtBQUFBLEVBRVEsY0FBYyxTQUE4QztBQUNuRSxTQUFLLFdBQVc7QUFFaEIsU0FBSyxXQUFXLFFBQVEsTUFBTSxNQUFNLEdBQUcsUUFBUSxHQUFHO0FBQ2xELFNBQUssV0FBVyxRQUFRLE1BQU0sT0FBTyxHQUFHLFFBQVEsSUFBSTtBQUNwRCxTQUFLLFdBQVcsUUFBUSxNQUFNLFdBQVc7QUFBQSxFQUMxQztBQUNEOyIsCiAgIm5hbWVzIjogWyJsZWZ0IiwgInRvcCJdCn0K
