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
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { MarkdownRenderer } from "../../../browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { ResizableHTMLElement } from "../../../../base/browser/ui/resizable/resizable.js";
import * as nls from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
function canExpandCompletionItem(item) {
  return !!item && Boolean(item.completion.documentation || item.completion.detail && item.completion.detail !== item.completion.label);
}
let SuggestDetailsWidget = class {
  constructor(_editor, instaService) {
    this._editor = _editor;
    this._onDidClose = new Emitter();
    this.onDidClose = this._onDidClose.event;
    this._onDidChangeContents = new Emitter();
    this.onDidChangeContents = this._onDidChangeContents.event;
    this._disposables = new DisposableStore();
    this._renderDisposeable = new DisposableStore();
    this._borderWidth = 1;
    this._size = new dom.Dimension(330, 0);
    this.domNode = dom.$(".suggest-details");
    this.domNode.classList.add("no-docs");
    this._markdownRenderer = instaService.createInstance(MarkdownRenderer, { editor: _editor });
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
    this._disposables.add(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.fontInfo)) {
        this._configureFont();
      }
    }));
  }
  dispose() {
    this._disposables.dispose();
    this._renderDisposeable.dispose();
  }
  _configureFont() {
    const options = this._editor.getOptions();
    const fontInfo = options.get(EditorOption.fontInfo);
    const fontFamily = fontInfo.getMassagedFontFamily();
    const fontSize = options.get(EditorOption.suggestFontSize) || fontInfo.fontSize;
    const lineHeight = options.get(EditorOption.suggestLineHeight) || fontInfo.lineHeight;
    const fontWeight = fontInfo.fontWeight;
    const fontSizePx = `${fontSize}px`;
    const lineHeightPx = `${lineHeight}px`;
    this.domNode.style.fontSize = fontSizePx;
    this.domNode.style.lineHeight = `${lineHeight / fontSize}`;
    this.domNode.style.fontWeight = fontWeight;
    this.domNode.style.fontFeatureSettings = fontInfo.fontFeatureSettings;
    this._type.style.fontFamily = fontFamily;
    this._close.style.height = lineHeightPx;
    this._close.style.width = lineHeightPx;
  }
  getLayoutInfo() {
    const lineHeight = this._editor.getOption(EditorOption.suggestLineHeight) || this._editor.getOption(EditorOption.fontInfo).lineHeight;
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
    if (explainMode) {
      let md = "";
      md += `score: ${item.score[0]}
`;
      md += `prefix: ${item.word ?? "(no prefix)"}
`;
      md += `word: ${item.completion.filterText ? item.completion.filterText + " (filterText)" : item.textLabel}
`;
      md += `distance: ${item.distance} (localityBonus-setting)
`;
      md += `index: ${item.idx}, based on ${item.completion.sortText && `sortText: "${item.completion.sortText}"` || "label"}
`;
      md += `commit_chars: ${item.completion.commitCharacters?.join("")}
`;
      documentation = new MarkdownString().appendCodeblock("empty", md);
      detail = `Provider: ${item.provider._debugDisplayName}`;
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
    this.layout(this._size.width, this._type.clientHeight + this._docs.clientHeight);
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
SuggestDetailsWidget = __decorateClass([
  __decorateParam(1, IInstantiationService)
], SuggestDetailsWidget);
class SuggestDetailsOverlay {
  constructor(widget, _editor) {
    this.widget = widget;
    this._editor = _editor;
    this.allowEditorOverflow = true;
    this._disposables = new DisposableStore();
    this._added = false;
    this._preferAlignAtTop = true;
    this._resizable = new ResizableHTMLElement();
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
        this._placeAtAnchor(this._anchorBox, this._userSize ?? this.widget.size, this._preferAlignAtTop);
      }
    }));
  }
  dispose() {
    this._resizable.dispose();
    this._disposables.dispose();
    this.hide();
  }
  getId() {
    return "suggest.details";
  }
  getDomNode() {
    return this._resizable.domNode;
  }
  getPosition() {
    return this._topLeft ? { preference: this._topLeft } : null;
  }
  show() {
    if (!this._added) {
      this._editor.addOverlayWidget(this);
      this._added = true;
    }
  }
  hide(sessionEnded = false) {
    this._resizable.clearSashHoverState();
    if (this._added) {
      this._editor.removeOverlayWidget(this);
      this._added = false;
      this._anchorBox = void 0;
      this._topLeft = void 0;
    }
    if (sessionEnded) {
      this._userSize = void 0;
      this.widget.clearContents();
    }
  }
  placeAtAnchor(anchor, preferAlignAtTop) {
    const anchorBox = anchor.getBoundingClientRect();
    this._anchorBox = anchorBox;
    this._preferAlignAtTop = preferAlignAtTop;
    this._placeAtAnchor(this._anchorBox, this._userSize ?? this.widget.size, preferAlignAtTop);
  }
  _placeAtAnchor(anchorBox, size, preferAlignAtTop) {
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
    if (preferAlignAtTop) {
      if (height <= placement.maxSizeTop.height) {
        alignAtTop = true;
        maxSize = placement.maxSizeTop;
      } else {
        alignAtTop = false;
        maxSize = placement.maxSizeBottom;
      }
    } else {
      if (height <= placement.maxSizeBottom.height) {
        alignAtTop = false;
        maxSize = placement.maxSizeBottom;
      } else {
        alignAtTop = true;
        maxSize = placement.maxSizeTop;
      }
    }
    let { top, left } = placement;
    if (!alignAtTop && height > anchorBox.height) {
      top = bottom - height;
    }
    const editorDomNode = this._editor.getDomNode();
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
    this._editor.layoutOverlayWidget(this);
  }
}
export {
  SuggestDetailsOverlay,
  SuggestDetailsWidget,
  canExpandCompletionItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdFdpZGdldERldGFpbHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBEb21TY3JvbGxhYmxlRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zY3JvbGxiYXIvc2Nyb2xsYWJsZUVsZW1lbnQuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciwgSU92ZXJsYXlXaWRnZXQsIElPdmVybGF5V2lkZ2V0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFJlc2l6YWJsZUhUTUxFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Jlc2l6YWJsZS9yZXNpemFibGUuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IENvbXBsZXRpb25JdGVtIH0gZnJvbSAnLi9zdWdnZXN0LmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNhbkV4cGFuZENvbXBsZXRpb25JdGVtKGl0ZW06IENvbXBsZXRpb25JdGVtIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG5cdHJldHVybiAhIWl0ZW0gJiYgQm9vbGVhbihpdGVtLmNvbXBsZXRpb24uZG9jdW1lbnRhdGlvbiB8fCBpdGVtLmNvbXBsZXRpb24uZGV0YWlsICYmIGl0ZW0uY29tcGxldGlvbi5kZXRhaWwgIT09IGl0ZW0uY29tcGxldGlvbi5sYWJlbCk7XG59XG5cbmV4cG9ydCBjbGFzcyBTdWdnZXN0RGV0YWlsc1dpZGdldCB7XG5cblx0cmVhZG9ubHkgZG9tTm9kZTogSFRNTERpdkVsZW1lbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbG9zZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2xvc2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDbG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnRzID0gbmV3IEVtaXR0ZXI8dGhpcz4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZW50czogRXZlbnQ8dGhpcz4gPSB0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnRzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Nsb3NlOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfc2Nyb2xsYmFyOiBEb21TY3JvbGxhYmxlRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfYm9keTogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hlYWRlcjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3R5cGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kb2NzOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbWFya2Rvd25SZW5kZXJlcjogTWFya2Rvd25SZW5kZXJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVuZGVyRGlzcG9zZWFibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgX2JvcmRlcldpZHRoOiBudW1iZXIgPSAxO1xuXHRwcml2YXRlIF9zaXplID0gbmV3IGRvbS5EaW1lbnNpb24oMzMwLCAwKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuZG9tTm9kZSA9IGRvbS4kKCcuc3VnZ2VzdC1kZXRhaWxzJyk7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ25vLWRvY3MnKTtcblxuXHRcdHRoaXMuX21hcmtkb3duUmVuZGVyZXIgPSBpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWFya2Rvd25SZW5kZXJlciwgeyBlZGl0b3I6IF9lZGl0b3IgfSk7XG5cblx0XHR0aGlzLl9ib2R5ID0gZG9tLiQoJy5ib2R5Jyk7XG5cblx0XHR0aGlzLl9zY3JvbGxiYXIgPSBuZXcgRG9tU2Nyb2xsYWJsZUVsZW1lbnQodGhpcy5fYm9keSwge1xuXHRcdFx0YWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IHRydWUsXG5cdFx0fSk7XG5cdFx0ZG9tLmFwcGVuZCh0aGlzLmRvbU5vZGUsIHRoaXMuX3Njcm9sbGJhci5nZXREb21Ob2RlKCkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9zY3JvbGxiYXIpO1xuXG5cdFx0dGhpcy5faGVhZGVyID0gZG9tLmFwcGVuZCh0aGlzLl9ib2R5LCBkb20uJCgnLmhlYWRlcicpKTtcblx0XHR0aGlzLl9jbG9zZSA9IGRvbS5hcHBlbmQodGhpcy5faGVhZGVyLCBkb20uJCgnc3BhbicgKyBUaGVtZUljb24uYXNDU1NTZWxlY3RvcihDb2RpY29uLmNsb3NlKSkpO1xuXHRcdHRoaXMuX2Nsb3NlLnRpdGxlID0gbmxzLmxvY2FsaXplKCdkZXRhaWxzLmNsb3NlJywgXCJDbG9zZVwiKTtcblx0XHR0aGlzLl9jbG9zZS5yb2xlID0gJ2J1dHRvbic7XG5cdFx0dGhpcy5fY2xvc2UudGFiSW5kZXggPSAtMTtcblx0XHR0aGlzLl90eXBlID0gZG9tLmFwcGVuZCh0aGlzLl9oZWFkZXIsIGRvbS4kKCdwLnR5cGUnKSk7XG5cblx0XHR0aGlzLl9kb2NzID0gZG9tLmFwcGVuZCh0aGlzLl9ib2R5LCBkb20uJCgncC5kb2NzJykpO1xuXG5cdFx0dGhpcy5fY29uZmlndXJlRm9udCgpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5mb250SW5mbykpIHtcblx0XHRcdFx0dGhpcy5fY29uZmlndXJlRm9udCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3JlbmRlckRpc3Bvc2VhYmxlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbmZpZ3VyZUZvbnQoKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb25zKCk7XG5cdFx0Y29uc3QgZm9udEluZm8gPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uZm9udEluZm8pO1xuXHRcdGNvbnN0IGZvbnRGYW1pbHkgPSBmb250SW5mby5nZXRNYXNzYWdlZEZvbnRGYW1pbHkoKTtcblx0XHRjb25zdCBmb250U2l6ZSA9IG9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5zdWdnZXN0Rm9udFNpemUpIHx8IGZvbnRJbmZvLmZvbnRTaXplO1xuXHRcdGNvbnN0IGxpbmVIZWlnaHQgPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24uc3VnZ2VzdExpbmVIZWlnaHQpIHx8IGZvbnRJbmZvLmxpbmVIZWlnaHQ7XG5cdFx0Y29uc3QgZm9udFdlaWdodCA9IGZvbnRJbmZvLmZvbnRXZWlnaHQ7XG5cdFx0Y29uc3QgZm9udFNpemVQeCA9IGAke2ZvbnRTaXplfXB4YDtcblx0XHRjb25zdCBsaW5lSGVpZ2h0UHggPSBgJHtsaW5lSGVpZ2h0fXB4YDtcblxuXHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5mb250U2l6ZSA9IGZvbnRTaXplUHg7XG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLmxpbmVIZWlnaHQgPSBgJHtsaW5lSGVpZ2h0IC8gZm9udFNpemV9YDtcblx0XHR0aGlzLmRvbU5vZGUuc3R5bGUuZm9udFdlaWdodCA9IGZvbnRXZWlnaHQ7XG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLmZvbnRGZWF0dXJlU2V0dGluZ3MgPSBmb250SW5mby5mb250RmVhdHVyZVNldHRpbmdzO1xuXHRcdHRoaXMuX3R5cGUuc3R5bGUuZm9udEZhbWlseSA9IGZvbnRGYW1pbHk7XG5cdFx0dGhpcy5fY2xvc2Uuc3R5bGUuaGVpZ2h0ID0gbGluZUhlaWdodFB4O1xuXHRcdHRoaXMuX2Nsb3NlLnN0eWxlLndpZHRoID0gbGluZUhlaWdodFB4O1xuXHR9XG5cblx0Z2V0TGF5b3V0SW5mbygpIHtcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc3VnZ2VzdExpbmVIZWlnaHQpIHx8IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZvbnRJbmZvKS5saW5lSGVpZ2h0O1xuXHRcdGNvbnN0IGJvcmRlcldpZHRoID0gdGhpcy5fYm9yZGVyV2lkdGg7XG5cdFx0Y29uc3QgYm9yZGVySGVpZ2h0ID0gYm9yZGVyV2lkdGggKiAyO1xuXHRcdHJldHVybiB7XG5cdFx0XHRsaW5lSGVpZ2h0LFxuXHRcdFx0Ym9yZGVyV2lkdGgsXG5cdFx0XHRib3JkZXJIZWlnaHQsXG5cdFx0XHR2ZXJ0aWNhbFBhZGRpbmc6IDIyLFxuXHRcdFx0aG9yaXpvbnRhbFBhZGRpbmc6IDE0XG5cdFx0fTtcblx0fVxuXG5cblx0cmVuZGVyTG9hZGluZygpOiB2b2lkIHtcblx0XHR0aGlzLl90eXBlLnRleHRDb250ZW50ID0gbmxzLmxvY2FsaXplKCdsb2FkaW5nJywgXCJMb2FkaW5nLi4uXCIpO1xuXHRcdHRoaXMuX2RvY3MudGV4dENvbnRlbnQgPSAnJztcblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnbm8tZG9jcycsICduby10eXBlJyk7XG5cdFx0dGhpcy5sYXlvdXQodGhpcy5zaXplLndpZHRoLCB0aGlzLmdldExheW91dEluZm8oKS5saW5lSGVpZ2h0ICogMik7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50cy5maXJlKHRoaXMpO1xuXHR9XG5cblx0cmVuZGVySXRlbShpdGVtOiBDb21wbGV0aW9uSXRlbSwgZXhwbGFpbk1vZGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9yZW5kZXJEaXNwb3NlYWJsZS5jbGVhcigpO1xuXG5cdFx0bGV0IHsgZGV0YWlsLCBkb2N1bWVudGF0aW9uIH0gPSBpdGVtLmNvbXBsZXRpb247XG5cblx0XHRpZiAoZXhwbGFpbk1vZGUpIHtcblx0XHRcdGxldCBtZCA9ICcnO1xuXHRcdFx0bWQgKz0gYHNjb3JlOiAke2l0ZW0uc2NvcmVbMF19XFxuYDtcblx0XHRcdG1kICs9IGBwcmVmaXg6ICR7aXRlbS53b3JkID8/ICcobm8gcHJlZml4KSd9XFxuYDtcblx0XHRcdG1kICs9IGB3b3JkOiAke2l0ZW0uY29tcGxldGlvbi5maWx0ZXJUZXh0ID8gaXRlbS5jb21wbGV0aW9uLmZpbHRlclRleHQgKyAnIChmaWx0ZXJUZXh0KScgOiBpdGVtLnRleHRMYWJlbH1cXG5gO1xuXHRcdFx0bWQgKz0gYGRpc3RhbmNlOiAke2l0ZW0uZGlzdGFuY2V9IChsb2NhbGl0eUJvbnVzLXNldHRpbmcpXFxuYDtcblx0XHRcdG1kICs9IGBpbmRleDogJHtpdGVtLmlkeH0sIGJhc2VkIG9uICR7aXRlbS5jb21wbGV0aW9uLnNvcnRUZXh0ICYmIGBzb3J0VGV4dDogXCIke2l0ZW0uY29tcGxldGlvbi5zb3J0VGV4dH1cImAgfHwgJ2xhYmVsJ31cXG5gO1xuXHRcdFx0bWQgKz0gYGNvbW1pdF9jaGFyczogJHtpdGVtLmNvbXBsZXRpb24uY29tbWl0Q2hhcmFjdGVycz8uam9pbignJyl9XFxuYDtcblx0XHRcdGRvY3VtZW50YXRpb24gPSBuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRDb2RlYmxvY2soJ2VtcHR5JywgbWQpO1xuXHRcdFx0ZGV0YWlsID0gYFByb3ZpZGVyOiAke2l0ZW0ucHJvdmlkZXIuX2RlYnVnRGlzcGxheU5hbWV9YDtcblx0XHR9XG5cblx0XHRpZiAoIWV4cGxhaW5Nb2RlICYmICFjYW5FeHBhbmRDb21wbGV0aW9uSXRlbShpdGVtKSkge1xuXHRcdFx0dGhpcy5jbGVhckNvbnRlbnRzKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ25vLWRvY3MnLCAnbm8tdHlwZScpO1xuXG5cdFx0Ly8gLS0tIGRldGFpbHNcblxuXHRcdGlmIChkZXRhaWwpIHtcblx0XHRcdGNvbnN0IGNhcHBlZERldGFpbCA9IGRldGFpbC5sZW5ndGggPiAxMDAwMDAgPyBgJHtkZXRhaWwuc3Vic3RyKDAsIDEwMDAwMCl9XHUyMDI2YCA6IGRldGFpbDtcblx0XHRcdHRoaXMuX3R5cGUudGV4dENvbnRlbnQgPSBjYXBwZWREZXRhaWw7XG5cdFx0XHR0aGlzLl90eXBlLnRpdGxlID0gY2FwcGVkRGV0YWlsO1xuXHRcdFx0ZG9tLnNob3codGhpcy5fdHlwZSk7XG5cdFx0XHR0aGlzLl90eXBlLmNsYXNzTGlzdC50b2dnbGUoJ2F1dG8td3JhcCcsICEvXFxyP1xcbl5cXHMrL2dtaS50ZXN0KGNhcHBlZERldGFpbCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkb20uY2xlYXJOb2RlKHRoaXMuX3R5cGUpO1xuXHRcdFx0dGhpcy5fdHlwZS50aXRsZSA9ICcnO1xuXHRcdFx0ZG9tLmhpZGUodGhpcy5fdHlwZSk7XG5cdFx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnbm8tdHlwZScpO1xuXHRcdH1cblxuXHRcdC8vIC0tLSBkb2N1bWVudGF0aW9uXG5cdFx0ZG9tLmNsZWFyTm9kZSh0aGlzLl9kb2NzKTtcblx0XHRpZiAodHlwZW9mIGRvY3VtZW50YXRpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLl9kb2NzLmNsYXNzTGlzdC5yZW1vdmUoJ21hcmtkb3duLWRvY3MnKTtcblx0XHRcdHRoaXMuX2RvY3MudGV4dENvbnRlbnQgPSBkb2N1bWVudGF0aW9uO1xuXG5cdFx0fSBlbHNlIGlmIChkb2N1bWVudGF0aW9uKSB7XG5cdFx0XHR0aGlzLl9kb2NzLmNsYXNzTGlzdC5hZGQoJ21hcmtkb3duLWRvY3MnKTtcblx0XHRcdGRvbS5jbGVhck5vZGUodGhpcy5fZG9jcyk7XG5cdFx0XHRjb25zdCByZW5kZXJlZENvbnRlbnRzID0gdGhpcy5fbWFya2Rvd25SZW5kZXJlci5yZW5kZXIoZG9jdW1lbnRhdGlvbiwge1xuXHRcdFx0XHRhc3luY1JlbmRlckNhbGxiYWNrOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5sYXlvdXQodGhpcy5fc2l6ZS53aWR0aCwgdGhpcy5fdHlwZS5jbGllbnRIZWlnaHQgKyB0aGlzLl9kb2NzLmNsaWVudEhlaWdodCk7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50cy5maXJlKHRoaXMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX2RvY3MuYXBwZW5kQ2hpbGQocmVuZGVyZWRDb250ZW50cy5lbGVtZW50KTtcblx0XHRcdHRoaXMuX3JlbmRlckRpc3Bvc2VhYmxlLmFkZChyZW5kZXJlZENvbnRlbnRzKTtcblx0XHR9XG5cblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnZGV0YWlsLWFuZC1kb2MnLCAhIWRldGFpbCAmJiAhIWRvY3VtZW50YXRpb24pO1xuXG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLnVzZXJTZWxlY3QgPSAndGV4dCc7XG5cdFx0dGhpcy5kb21Ob2RlLnRhYkluZGV4ID0gLTE7XG5cblx0XHR0aGlzLl9jbG9zZS5vbm1vdXNlZG93biA9IGUgPT4ge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR9O1xuXHRcdHRoaXMuX2Nsb3NlLm9uY2xpY2sgPSBlID0+IHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR0aGlzLl9vbkRpZENsb3NlLmZpcmUoKTtcblx0XHR9O1xuXG5cdFx0dGhpcy5fYm9keS5zY3JvbGxUb3AgPSAwO1xuXG5cdFx0dGhpcy5sYXlvdXQodGhpcy5fc2l6ZS53aWR0aCwgdGhpcy5fdHlwZS5jbGllbnRIZWlnaHQgKyB0aGlzLl9kb2NzLmNsaWVudEhlaWdodCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50cy5maXJlKHRoaXMpO1xuXHR9XG5cblx0Y2xlYXJDb250ZW50cygpIHtcblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnbm8tZG9jcycpO1xuXHRcdHRoaXMuX3R5cGUudGV4dENvbnRlbnQgPSAnJztcblx0XHR0aGlzLl9kb2NzLnRleHRDb250ZW50ID0gJyc7XG5cdH1cblxuXHRnZXQgaXNFbXB0eSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5jb250YWlucygnbm8tZG9jcycpO1xuXHR9XG5cblx0Z2V0IHNpemUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3NpemU7XG5cdH1cblxuXHRsYXlvdXQod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBuZXdTaXplID0gbmV3IGRvbS5EaW1lbnNpb24od2lkdGgsIGhlaWdodCk7XG5cdFx0aWYgKCFkb20uRGltZW5zaW9uLmVxdWFscyhuZXdTaXplLCB0aGlzLl9zaXplKSkge1xuXHRcdFx0dGhpcy5fc2l6ZSA9IG5ld1NpemU7XG5cdFx0XHRkb20uc2l6ZSh0aGlzLmRvbU5vZGUsIHdpZHRoLCBoZWlnaHQpO1xuXHRcdH1cblx0XHR0aGlzLl9zY3JvbGxiYXIuc2NhbkRvbU5vZGUoKTtcblx0fVxuXG5cdHNjcm9sbERvd24obXVjaCA9IDgpOiB2b2lkIHtcblx0XHR0aGlzLl9ib2R5LnNjcm9sbFRvcCArPSBtdWNoO1xuXHR9XG5cblx0c2Nyb2xsVXAobXVjaCA9IDgpOiB2b2lkIHtcblx0XHR0aGlzLl9ib2R5LnNjcm9sbFRvcCAtPSBtdWNoO1xuXHR9XG5cblx0c2Nyb2xsVG9wKCk6IHZvaWQge1xuXHRcdHRoaXMuX2JvZHkuc2Nyb2xsVG9wID0gMDtcblx0fVxuXG5cdHNjcm9sbEJvdHRvbSgpOiB2b2lkIHtcblx0XHR0aGlzLl9ib2R5LnNjcm9sbFRvcCA9IHRoaXMuX2JvZHkuc2Nyb2xsSGVpZ2h0O1xuXHR9XG5cblx0cGFnZURvd24oKTogdm9pZCB7XG5cdFx0dGhpcy5zY3JvbGxEb3duKDgwKTtcblx0fVxuXG5cdHBhZ2VVcCgpOiB2b2lkIHtcblx0XHR0aGlzLnNjcm9sbFVwKDgwKTtcblx0fVxuXG5cdHNldCBib3JkZXJXaWR0aCh3aWR0aDogbnVtYmVyKSB7XG5cdFx0dGhpcy5fYm9yZGVyV2lkdGggPSB3aWR0aDtcblx0fVxuXG5cdGdldCBib3JkZXJXaWR0aCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fYm9yZGVyV2lkdGg7XG5cdH1cblxuXHRmb2N1cygpIHtcblx0XHR0aGlzLmRvbU5vZGUuZm9jdXMoKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgVG9wTGVmdFBvc2l0aW9uIHtcblx0dG9wOiBudW1iZXI7XG5cdGxlZnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFN1Z2dlc3REZXRhaWxzT3ZlcmxheSBpbXBsZW1lbnRzIElPdmVybGF5V2lkZ2V0IHtcblxuXHRyZWFkb25seSBhbGxvd0VkaXRvck92ZXJmbG93ID0gdHJ1ZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVzaXphYmxlOiBSZXNpemFibGVIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIF9hZGRlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9hbmNob3JCb3g/OiBkb20uSURvbU5vZGVQYWdlUG9zaXRpb247XG5cdHByaXZhdGUgX3ByZWZlckFsaWduQXRUb3A6IGJvb2xlYW4gPSB0cnVlO1xuXHRwcml2YXRlIF91c2VyU2l6ZT86IGRvbS5EaW1lbnNpb247XG5cdHByaXZhdGUgX3RvcExlZnQ/OiBUb3BMZWZ0UG9zaXRpb247XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgd2lkZ2V0OiBTdWdnZXN0RGV0YWlsc1dpZGdldCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yXG5cdCkge1xuXG5cdFx0dGhpcy5fcmVzaXphYmxlID0gbmV3IFJlc2l6YWJsZUhUTUxFbGVtZW50KCk7XG5cdFx0dGhpcy5fcmVzaXphYmxlLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnc3VnZ2VzdC1kZXRhaWxzLWNvbnRhaW5lcicpO1xuXHRcdHRoaXMuX3Jlc2l6YWJsZS5kb21Ob2RlLmFwcGVuZENoaWxkKHdpZGdldC5kb21Ob2RlKTtcblx0XHR0aGlzLl9yZXNpemFibGUuZW5hYmxlU2FzaGVzKGZhbHNlLCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cblx0XHRsZXQgdG9wTGVmdE5vdzogVG9wTGVmdFBvc2l0aW9uIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBzaXplTm93OiBkb20uRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBkZWx0YVRvcDogbnVtYmVyID0gMDtcblx0XHRsZXQgZGVsdGFMZWZ0OiBudW1iZXIgPSAwO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9yZXNpemFibGUub25EaWRXaWxsUmVzaXplKCgpID0+IHtcblx0XHRcdHRvcExlZnROb3cgPSB0aGlzLl90b3BMZWZ0O1xuXHRcdFx0c2l6ZU5vdyA9IHRoaXMuX3Jlc2l6YWJsZS5zaXplO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9yZXNpemFibGUub25EaWRSZXNpemUoZSA9PiB7XG5cdFx0XHRpZiAodG9wTGVmdE5vdyAmJiBzaXplTm93KSB7XG5cdFx0XHRcdHRoaXMud2lkZ2V0LmxheW91dChlLmRpbWVuc2lvbi53aWR0aCwgZS5kaW1lbnNpb24uaGVpZ2h0KTtcblxuXHRcdFx0XHRsZXQgdXBkYXRlVG9wTGVmdCA9IGZhbHNlO1xuXHRcdFx0XHRpZiAoZS53ZXN0KSB7XG5cdFx0XHRcdFx0ZGVsdGFMZWZ0ID0gc2l6ZU5vdy53aWR0aCAtIGUuZGltZW5zaW9uLndpZHRoO1xuXHRcdFx0XHRcdHVwZGF0ZVRvcExlZnQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlLm5vcnRoKSB7XG5cdFx0XHRcdFx0ZGVsdGFUb3AgPSBzaXplTm93LmhlaWdodCAtIGUuZGltZW5zaW9uLmhlaWdodDtcblx0XHRcdFx0XHR1cGRhdGVUb3BMZWZ0ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodXBkYXRlVG9wTGVmdCkge1xuXHRcdFx0XHRcdHRoaXMuX2FwcGx5VG9wTGVmdCh7XG5cdFx0XHRcdFx0XHR0b3A6IHRvcExlZnROb3cudG9wICsgZGVsdGFUb3AsXG5cdFx0XHRcdFx0XHRsZWZ0OiB0b3BMZWZ0Tm93LmxlZnQgKyBkZWx0YUxlZnQsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChlLmRvbmUpIHtcblx0XHRcdFx0dG9wTGVmdE5vdyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0c2l6ZU5vdyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0ZGVsdGFUb3AgPSAwO1xuXHRcdFx0XHRkZWx0YUxlZnQgPSAwO1xuXHRcdFx0XHR0aGlzLl91c2VyU2l6ZSA9IGUuZGltZW5zaW9uO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLndpZGdldC5vbkRpZENoYW5nZUNvbnRlbnRzKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9hbmNob3JCb3gpIHtcblx0XHRcdFx0dGhpcy5fcGxhY2VBdEFuY2hvcih0aGlzLl9hbmNob3JCb3gsIHRoaXMuX3VzZXJTaXplID8/IHRoaXMud2lkZ2V0LnNpemUsIHRoaXMuX3ByZWZlckFsaWduQXRUb3ApO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVzaXphYmxlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5oaWRlKCk7XG5cdH1cblxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnc3VnZ2VzdC5kZXRhaWxzJztcblx0fVxuXG5cdGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLl9yZXNpemFibGUuZG9tTm9kZTtcblx0fVxuXG5cdGdldFBvc2l0aW9uKCk6IElPdmVybGF5V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fdG9wTGVmdCA/IHsgcHJlZmVyZW5jZTogdGhpcy5fdG9wTGVmdCB9IDogbnVsbDtcblx0fVxuXG5cdHNob3coKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9hZGRlZCkge1xuXHRcdFx0dGhpcy5fZWRpdG9yLmFkZE92ZXJsYXlXaWRnZXQodGhpcyk7XG5cdFx0XHR0aGlzLl9hZGRlZCA9IHRydWU7XG5cdFx0fVxuXHR9XG5cblx0aGlkZShzZXNzaW9uRW5kZWQ6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuXHRcdHRoaXMuX3Jlc2l6YWJsZS5jbGVhclNhc2hIb3ZlclN0YXRlKCk7XG5cblx0XHRpZiAodGhpcy5fYWRkZWQpIHtcblx0XHRcdHRoaXMuX2VkaXRvci5yZW1vdmVPdmVybGF5V2lkZ2V0KHRoaXMpO1xuXHRcdFx0dGhpcy5fYWRkZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMuX2FuY2hvckJveCA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3RvcExlZnQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChzZXNzaW9uRW5kZWQpIHtcblx0XHRcdHRoaXMuX3VzZXJTaXplID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy53aWRnZXQuY2xlYXJDb250ZW50cygpO1xuXHRcdH1cblx0fVxuXG5cdHBsYWNlQXRBbmNob3IoYW5jaG9yOiBIVE1MRWxlbWVudCwgcHJlZmVyQWxpZ25BdFRvcDogYm9vbGVhbikge1xuXHRcdGNvbnN0IGFuY2hvckJveCA9IGFuY2hvci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHR0aGlzLl9hbmNob3JCb3ggPSBhbmNob3JCb3g7XG5cdFx0dGhpcy5fcHJlZmVyQWxpZ25BdFRvcCA9IHByZWZlckFsaWduQXRUb3A7XG5cdFx0dGhpcy5fcGxhY2VBdEFuY2hvcih0aGlzLl9hbmNob3JCb3gsIHRoaXMuX3VzZXJTaXplID8/IHRoaXMud2lkZ2V0LnNpemUsIHByZWZlckFsaWduQXRUb3ApO1xuXHR9XG5cblx0X3BsYWNlQXRBbmNob3IoYW5jaG9yQm94OiBkb20uSURvbU5vZGVQYWdlUG9zaXRpb24sIHNpemU6IGRvbS5EaW1lbnNpb24sIHByZWZlckFsaWduQXRUb3A6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBib2R5Qm94ID0gZG9tLmdldENsaWVudEFyZWEodGhpcy5nZXREb21Ob2RlKCkub3duZXJEb2N1bWVudC5ib2R5KTtcblxuXHRcdGNvbnN0IGluZm8gPSB0aGlzLndpZGdldC5nZXRMYXlvdXRJbmZvKCk7XG5cblx0XHRjb25zdCBkZWZhdWx0TWluU2l6ZSA9IG5ldyBkb20uRGltZW5zaW9uKDIyMCwgMiAqIGluZm8ubGluZUhlaWdodCk7XG5cdFx0Y29uc3QgZGVmYXVsdFRvcCA9IGFuY2hvckJveC50b3A7XG5cblx0XHR0eXBlIFBsYWNlbWVudCA9IHsgdG9wOiBudW1iZXI7IGxlZnQ6IG51bWJlcjsgZml0OiBudW1iZXI7IG1heFNpemVUb3A6IGRvbS5EaW1lbnNpb247IG1heFNpemVCb3R0b206IGRvbS5EaW1lbnNpb247IG1pblNpemU6IGRvbS5EaW1lbnNpb24gfTtcblxuXHRcdC8vIEVBU1Rcblx0XHRjb25zdCBlYXN0UGxhY2VtZW50OiBQbGFjZW1lbnQgPSAoZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3Qgd2lkdGggPSBib2R5Qm94LndpZHRoIC0gKGFuY2hvckJveC5sZWZ0ICsgYW5jaG9yQm94LndpZHRoICsgaW5mby5ib3JkZXJXaWR0aCArIGluZm8uaG9yaXpvbnRhbFBhZGRpbmcpO1xuXHRcdFx0Y29uc3QgbGVmdCA9IC1pbmZvLmJvcmRlcldpZHRoICsgYW5jaG9yQm94LmxlZnQgKyBhbmNob3JCb3gud2lkdGg7XG5cdFx0XHRjb25zdCBtYXhTaXplVG9wID0gbmV3IGRvbS5EaW1lbnNpb24od2lkdGgsIGJvZHlCb3guaGVpZ2h0IC0gYW5jaG9yQm94LnRvcCAtIGluZm8uYm9yZGVySGVpZ2h0IC0gaW5mby52ZXJ0aWNhbFBhZGRpbmcpO1xuXHRcdFx0Y29uc3QgbWF4U2l6ZUJvdHRvbSA9IG1heFNpemVUb3Aud2l0aCh1bmRlZmluZWQsIGFuY2hvckJveC50b3AgKyBhbmNob3JCb3guaGVpZ2h0IC0gaW5mby5ib3JkZXJIZWlnaHQgLSBpbmZvLnZlcnRpY2FsUGFkZGluZyk7XG5cdFx0XHRyZXR1cm4geyB0b3A6IGRlZmF1bHRUb3AsIGxlZnQsIGZpdDogd2lkdGggLSBzaXplLndpZHRoLCBtYXhTaXplVG9wLCBtYXhTaXplQm90dG9tLCBtaW5TaXplOiBkZWZhdWx0TWluU2l6ZS53aXRoKE1hdGgubWluKHdpZHRoLCBkZWZhdWx0TWluU2l6ZS53aWR0aCkpIH07XG5cdFx0fSkoKTtcblxuXHRcdC8vIFdFU1Rcblx0XHRjb25zdCB3ZXN0UGxhY2VtZW50OiBQbGFjZW1lbnQgPSAoZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3Qgd2lkdGggPSBhbmNob3JCb3gubGVmdCAtIGluZm8uYm9yZGVyV2lkdGggLSBpbmZvLmhvcml6b250YWxQYWRkaW5nO1xuXHRcdFx0Y29uc3QgbGVmdCA9IE1hdGgubWF4KGluZm8uaG9yaXpvbnRhbFBhZGRpbmcsIGFuY2hvckJveC5sZWZ0IC0gc2l6ZS53aWR0aCAtIGluZm8uYm9yZGVyV2lkdGgpO1xuXHRcdFx0Y29uc3QgbWF4U2l6ZVRvcCA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBib2R5Qm94LmhlaWdodCAtIGFuY2hvckJveC50b3AgLSBpbmZvLmJvcmRlckhlaWdodCAtIGluZm8udmVydGljYWxQYWRkaW5nKTtcblx0XHRcdGNvbnN0IG1heFNpemVCb3R0b20gPSBtYXhTaXplVG9wLndpdGgodW5kZWZpbmVkLCBhbmNob3JCb3gudG9wICsgYW5jaG9yQm94LmhlaWdodCAtIGluZm8uYm9yZGVySGVpZ2h0IC0gaW5mby52ZXJ0aWNhbFBhZGRpbmcpO1xuXHRcdFx0cmV0dXJuIHsgdG9wOiBkZWZhdWx0VG9wLCBsZWZ0LCBmaXQ6IHdpZHRoIC0gc2l6ZS53aWR0aCwgbWF4U2l6ZVRvcCwgbWF4U2l6ZUJvdHRvbSwgbWluU2l6ZTogZGVmYXVsdE1pblNpemUud2l0aChNYXRoLm1pbih3aWR0aCwgZGVmYXVsdE1pblNpemUud2lkdGgpKSB9O1xuXHRcdH0pKCk7XG5cblx0XHQvLyBTT1VUSFxuXHRcdGNvbnN0IHNvdXRoUGFjZW1lbnQ6IFBsYWNlbWVudCA9IChmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBsZWZ0ID0gYW5jaG9yQm94LmxlZnQ7XG5cdFx0XHRjb25zdCB0b3AgPSAtaW5mby5ib3JkZXJXaWR0aCArIGFuY2hvckJveC50b3AgKyBhbmNob3JCb3guaGVpZ2h0O1xuXHRcdFx0Y29uc3QgbWF4U2l6ZUJvdHRvbSA9IG5ldyBkb20uRGltZW5zaW9uKGFuY2hvckJveC53aWR0aCAtIGluZm8uYm9yZGVySGVpZ2h0LCBib2R5Qm94LmhlaWdodCAtIGFuY2hvckJveC50b3AgLSBhbmNob3JCb3guaGVpZ2h0IC0gaW5mby52ZXJ0aWNhbFBhZGRpbmcpO1xuXHRcdFx0cmV0dXJuIHsgdG9wLCBsZWZ0LCBmaXQ6IG1heFNpemVCb3R0b20uaGVpZ2h0IC0gc2l6ZS5oZWlnaHQsIG1heFNpemVCb3R0b20sIG1heFNpemVUb3A6IG1heFNpemVCb3R0b20sIG1pblNpemU6IGRlZmF1bHRNaW5TaXplLndpdGgobWF4U2l6ZUJvdHRvbS53aWR0aCkgfTtcblx0XHR9KSgpO1xuXG5cdFx0Ly8gdGFrZSBmaXJzdCBwbGFjZW1lbnQgdGhhdCBmaXRzIG9yIHRoZSBmaXJzdCB3aXRoIFwibGVhc3QgYmFkXCIgZml0XG5cdFx0Y29uc3QgcGxhY2VtZW50cyA9IFtlYXN0UGxhY2VtZW50LCB3ZXN0UGxhY2VtZW50LCBzb3V0aFBhY2VtZW50XTtcblx0XHRjb25zdCBwbGFjZW1lbnQgPSBwbGFjZW1lbnRzLmZpbmQocCA9PiBwLmZpdCA+PSAwKSA/PyBwbGFjZW1lbnRzLnNvcnQoKGEsIGIpID0+IGIuZml0IC0gYS5maXQpWzBdO1xuXG5cdFx0Ly8gdG9wL2JvdHRvbSBwbGFjZW1lbnRcblx0XHRjb25zdCBib3R0b20gPSBhbmNob3JCb3gudG9wICsgYW5jaG9yQm94LmhlaWdodCAtIGluZm8uYm9yZGVySGVpZ2h0O1xuXHRcdGxldCBhbGlnbkF0VG9wOiBib29sZWFuO1xuXHRcdGxldCBoZWlnaHQgPSBzaXplLmhlaWdodDtcblx0XHRjb25zdCBtYXhIZWlnaHQgPSBNYXRoLm1heChwbGFjZW1lbnQubWF4U2l6ZVRvcC5oZWlnaHQsIHBsYWNlbWVudC5tYXhTaXplQm90dG9tLmhlaWdodCk7XG5cdFx0aWYgKGhlaWdodCA+IG1heEhlaWdodCkge1xuXHRcdFx0aGVpZ2h0ID0gbWF4SGVpZ2h0O1xuXHRcdH1cblx0XHRsZXQgbWF4U2l6ZTogZG9tLkRpbWVuc2lvbjtcblx0XHRpZiAocHJlZmVyQWxpZ25BdFRvcCkge1xuXHRcdFx0aWYgKGhlaWdodCA8PSBwbGFjZW1lbnQubWF4U2l6ZVRvcC5oZWlnaHQpIHtcblx0XHRcdFx0YWxpZ25BdFRvcCA9IHRydWU7XG5cdFx0XHRcdG1heFNpemUgPSBwbGFjZW1lbnQubWF4U2l6ZVRvcDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFsaWduQXRUb3AgPSBmYWxzZTtcblx0XHRcdFx0bWF4U2l6ZSA9IHBsYWNlbWVudC5tYXhTaXplQm90dG9tO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoaGVpZ2h0IDw9IHBsYWNlbWVudC5tYXhTaXplQm90dG9tLmhlaWdodCkge1xuXHRcdFx0XHRhbGlnbkF0VG9wID0gZmFsc2U7XG5cdFx0XHRcdG1heFNpemUgPSBwbGFjZW1lbnQubWF4U2l6ZUJvdHRvbTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFsaWduQXRUb3AgPSB0cnVlO1xuXHRcdFx0XHRtYXhTaXplID0gcGxhY2VtZW50Lm1heFNpemVUb3A7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IHsgdG9wLCBsZWZ0IH0gPSBwbGFjZW1lbnQ7XG5cdFx0aWYgKCFhbGlnbkF0VG9wICYmIGhlaWdodCA+IGFuY2hvckJveC5oZWlnaHQpIHtcblx0XHRcdHRvcCA9IGJvdHRvbSAtIGhlaWdodDtcblx0XHR9XG5cdFx0Y29uc3QgZWRpdG9yRG9tTm9kZSA9IHRoaXMuX2VkaXRvci5nZXREb21Ob2RlKCk7XG5cdFx0aWYgKGVkaXRvckRvbU5vZGUpIHtcblx0XHRcdC8vIGdldCBib3VuZGluZyByZWN0YW5nbGUgb2YgdGhlIHN1Z2dlc3Qgd2lkZ2V0IHJlbGF0aXZlIHRvIHRoZSBlZGl0b3Jcblx0XHRcdGNvbnN0IGVkaXRvckJvdW5kaW5nQm94ID0gZWRpdG9yRG9tTm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdHRvcCAtPSBlZGl0b3JCb3VuZGluZ0JveC50b3A7XG5cdFx0XHRsZWZ0IC09IGVkaXRvckJvdW5kaW5nQm94LmxlZnQ7XG5cdFx0fVxuXHRcdHRoaXMuX2FwcGx5VG9wTGVmdCh7IGxlZnQsIHRvcCB9KTtcblxuXHRcdHRoaXMuX3Jlc2l6YWJsZS5lbmFibGVTYXNoZXMoIWFsaWduQXRUb3AsIHBsYWNlbWVudCA9PT0gZWFzdFBsYWNlbWVudCwgYWxpZ25BdFRvcCwgcGxhY2VtZW50ICE9PSBlYXN0UGxhY2VtZW50KTtcblxuXHRcdHRoaXMuX3Jlc2l6YWJsZS5taW5TaXplID0gcGxhY2VtZW50Lm1pblNpemU7XG5cdFx0dGhpcy5fcmVzaXphYmxlLm1heFNpemUgPSBtYXhTaXplO1xuXHRcdHRoaXMuX3Jlc2l6YWJsZS5sYXlvdXQoaGVpZ2h0LCBNYXRoLm1pbihtYXhTaXplLndpZHRoLCBzaXplLndpZHRoKSk7XG5cdFx0dGhpcy53aWRnZXQubGF5b3V0KHRoaXMuX3Jlc2l6YWJsZS5zaXplLndpZHRoLCB0aGlzLl9yZXNpemFibGUuc2l6ZS5oZWlnaHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXBwbHlUb3BMZWZ0KHRvcExlZnQ6IFRvcExlZnRQb3NpdGlvbik6IHZvaWQge1xuXHRcdHRoaXMuX3RvcExlZnQgPSB0b3BMZWZ0O1xuXHRcdHRoaXMuX2VkaXRvci5sYXlvdXRPdmVybGF5V2lkZ2V0KHRoaXMpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxlQUFzQjtBQUMvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDRCQUE0QjtBQUNyQyxZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFHL0IsU0FBUyx3QkFBd0IsTUFBMkM7QUFDbEYsU0FBTyxDQUFDLENBQUMsUUFBUSxRQUFRLEtBQUssV0FBVyxpQkFBaUIsS0FBSyxXQUFXLFVBQVUsS0FBSyxXQUFXLFdBQVcsS0FBSyxXQUFXLEtBQUs7QUFDckk7QUFFTyxJQUFNLHVCQUFOLE1BQTJCO0FBQUEsRUF1QmpDLFlBQ2tCLFNBQ00sY0FDdEI7QUFGZ0I7QUFwQmxCLFNBQWlCLGNBQWMsSUFBSSxRQUFjO0FBQ2pELFNBQVMsYUFBMEIsS0FBSyxZQUFZO0FBRXBELFNBQWlCLHVCQUF1QixJQUFJLFFBQWM7QUFDMUQsU0FBUyxzQkFBbUMsS0FBSyxxQkFBcUI7QUFRdEUs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
