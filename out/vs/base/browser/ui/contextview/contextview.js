import { BrowserFeatures } from "../../canIUse.js";
import * as DOM from "../../dom.js";
import { Disposable, DisposableStore, toDisposable } from "../../../common/lifecycle.js";
import * as platform from "../../../common/platform.js";
import { Range } from "../../../common/range.js";
import "./contextview.css";
var ContextViewDOMPosition = /* @__PURE__ */ ((ContextViewDOMPosition2) => {
  ContextViewDOMPosition2[ContextViewDOMPosition2["ABSOLUTE"] = 1] = "ABSOLUTE";
  ContextViewDOMPosition2[ContextViewDOMPosition2["FIXED"] = 2] = "FIXED";
  ContextViewDOMPosition2[ContextViewDOMPosition2["FIXED_SHADOW"] = 3] = "FIXED_SHADOW";
  return ContextViewDOMPosition2;
})(ContextViewDOMPosition || {});
function isAnchor(obj) {
  const anchor = obj;
  return !!anchor && typeof anchor.x === "number" && typeof anchor.y === "number";
}
var AnchorAlignment = /* @__PURE__ */ ((AnchorAlignment2) => {
  AnchorAlignment2[AnchorAlignment2["LEFT"] = 0] = "LEFT";
  AnchorAlignment2[AnchorAlignment2["RIGHT"] = 1] = "RIGHT";
  return AnchorAlignment2;
})(AnchorAlignment || {});
var AnchorPosition = /* @__PURE__ */ ((AnchorPosition2) => {
  AnchorPosition2[AnchorPosition2["BELOW"] = 0] = "BELOW";
  AnchorPosition2[AnchorPosition2["ABOVE"] = 1] = "ABOVE";
  return AnchorPosition2;
})(AnchorPosition || {});
var AnchorAxisAlignment = /* @__PURE__ */ ((AnchorAxisAlignment2) => {
  AnchorAxisAlignment2[AnchorAxisAlignment2["VERTICAL"] = 0] = "VERTICAL";
  AnchorAxisAlignment2[AnchorAxisAlignment2["HORIZONTAL"] = 1] = "HORIZONTAL";
  return AnchorAxisAlignment2;
})(AnchorAxisAlignment || {});
var LayoutAnchorPosition = /* @__PURE__ */ ((LayoutAnchorPosition2) => {
  LayoutAnchorPosition2[LayoutAnchorPosition2["Before"] = 0] = "Before";
  LayoutAnchorPosition2[LayoutAnchorPosition2["After"] = 1] = "After";
  return LayoutAnchorPosition2;
})(LayoutAnchorPosition || {});
var LayoutAnchorMode = /* @__PURE__ */ ((LayoutAnchorMode2) => {
  LayoutAnchorMode2[LayoutAnchorMode2["AVOID"] = 0] = "AVOID";
  LayoutAnchorMode2[LayoutAnchorMode2["ALIGN"] = 1] = "ALIGN";
  return LayoutAnchorMode2;
})(LayoutAnchorMode || {});
function layout(viewportSize, viewSize, anchor) {
  const layoutAfterAnchorBoundary = anchor.mode === 1 /* ALIGN */ ? anchor.offset : anchor.offset + anchor.size;
  const layoutBeforeAnchorBoundary = anchor.mode === 1 /* ALIGN */ ? anchor.offset + anchor.size : anchor.offset;
  if (anchor.position === 0 /* Before */) {
    if (viewSize <= viewportSize - layoutAfterAnchorBoundary) {
      return layoutAfterAnchorBoundary;
    }
    if (viewSize <= layoutBeforeAnchorBoundary) {
      return layoutBeforeAnchorBoundary - viewSize;
    }
    return Math.max(viewportSize - viewSize, 0);
  } else {
    if (viewSize <= layoutBeforeAnchorBoundary) {
      return layoutBeforeAnchorBoundary - viewSize;
    }
    if (viewSize <= viewportSize - layoutAfterAnchorBoundary) {
      return layoutAfterAnchorBoundary;
    }
    return 0;
  }
}
const _ContextView = class _ContextView extends Disposable {
  constructor(container, domPosition) {
    super();
    this.container = null;
    this.useFixedPosition = false;
    this.useShadowDOM = false;
    this.delegate = null;
    this.toDisposeOnClean = Disposable.None;
    this.toDisposeOnSetContainer = Disposable.None;
    this.shadowRoot = null;
    this.shadowRootHostElement = null;
    this.view = DOM.$(".context-view");
    DOM.hide(this.view);
    this.setContainer(container, domPosition);
    this._register(toDisposable(() => this.setContainer(null, 1 /* ABSOLUTE */)));
  }
  setContainer(container, domPosition) {
    this.useFixedPosition = domPosition !== 1 /* ABSOLUTE */;
    const usedShadowDOM = this.useShadowDOM;
    this.useShadowDOM = domPosition === 3 /* FIXED_SHADOW */;
    if (container === this.container && usedShadowDOM === this.useShadowDOM) {
      return;
    }
    if (this.container) {
      this.toDisposeOnSetContainer.dispose();
      this.view.remove();
      if (this.shadowRoot) {
        this.shadowRoot = null;
        this.shadowRootHostElement?.remove();
        this.shadowRootHostElement = null;
      }
      this.container = null;
    }
    if (container) {
      this.container = container;
      if (this.useShadowDOM) {
        this.shadowRootHostElement = DOM.$(".shadow-root-host");
        this.container.appendChild(this.shadowRootHostElement);
        this.shadowRoot = this.shadowRootHostElement.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.textContent = SHADOW_ROOT_CSS;
        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(this.view);
        this.shadowRoot.appendChild(DOM.$("slot"));
      } else {
        this.container.appendChild(this.view);
      }
      const toDisposeOnSetContainer = new DisposableStore();
      _ContextView.BUBBLE_UP_EVENTS.forEach((event) => {
        toDisposeOnSetContainer.add(DOM.addStandardDisposableListener(this.container, event, (e) => {
          this.onDOMEvent(e, false);
        }));
      });
      _ContextView.BUBBLE_DOWN_EVENTS.forEach((event) => {
        toDisposeOnSetContainer.add(DOM.addStandardDisposableListener(this.container, event, (e) => {
          this.onDOMEvent(e, true);
        }, true));
      });
      this.toDisposeOnSetContainer = toDisposeOnSetContainer;
    }
  }
  show(delegate) {
    if (this.isVisible()) {
      this.hide();
    }
    DOM.clearNode(this.view);
    this.view.className = "context-view monaco-component";
    this.view.style.top = "0px";
    this.view.style.left = "0px";
    this.view.style.zIndex = `${2575 + (delegate.layer ?? 0)}`;
    this.view.style.position = this.useFixedPosition ? "fixed" : "absolute";
    DOM.show(this.view);
    this.toDisposeOnClean = delegate.render(this.view) || Disposable.None;
    this.delegate = delegate;
    this.doLayout();
    this.delegate.focus?.();
  }
  getViewElement() {
    return this.view;
  }
  layout() {
    if (!this.isVisible()) {
      return;
    }
    if (this.delegate.canRelayout === false && !(platform.isIOS && BrowserFeatures.pointerEvents)) {
      this.hide();
      return;
    }
    this.delegate?.layout?.();
    this.doLayout();
  }
  doLayout() {
    if (!this.isVisible()) {
      return;
    }
    const anchor = this.delegate.getAnchor();
    let around;
    if (DOM.isHTMLElement(anchor)) {
      const elementPosition = DOM.getDomNodePagePosition(anchor);
      const zoom = DOM.getDomNodeZoomLevel(anchor);
      around = {
        top: elementPosition.top * zoom,
        left: elementPosition.left * zoom,
        width: elementPosition.width * zoom,
        height: elementPosition.height * zoom
      };
    } else if (isAnchor(anchor)) {
      around = {
        top: anchor.y,
        left: anchor.x,
        width: anchor.width || 1,
        height: anchor.height || 2
      };
    } else {
      around = {
        top: anchor.posy,
        left: anchor.posx,
        // We are about to position the context view where the mouse
        // cursor is. To prevent the view being exactly under the mouse
        // when showing and thus potentially triggering an action within,
        // we treat the mouse location like a small sized block element.
        width: 2,
        height: 2
      };
    }
    const viewSizeWidth = DOM.getTotalWidth(this.view);
    const viewSizeHeight = DOM.getTotalHeight(this.view);
    const anchorPosition = this.delegate.anchorPosition ?? 0 /* BELOW */;
    const anchorAlignment = this.delegate.anchorAlignment ?? 0 /* LEFT */;
    const anchorAxisAlignment = this.delegate.anchorAxisAlignment ?? 0 /* VERTICAL */;
    let top;
    let left;
    const activeWindow = DOM.getActiveWindow();
    if (anchorAxisAlignment === 0 /* VERTICAL */) {
      const verticalAnchor = { offset: around.top - activeWindow.pageYOffset, size: around.height, position: anchorPosition === 0 /* BELOW */ ? 0 /* Before */ : 1 /* After */ };
      const horizontalAnchor = { offset: around.left, size: around.width, position: anchorAlignment === 0 /* LEFT */ ? 0 /* Before */ : 1 /* After */, mode: 1 /* ALIGN */ };
      top = layout(activeWindow.innerHeight, viewSizeHeight, verticalAnchor) + activeWindow.pageYOffset;
      if (Range.intersects({ start: top, end: top + viewSizeHeight }, { start: verticalAnchor.offset, end: verticalAnchor.offset + verticalAnchor.size })) {
        horizontalAnchor.mode = 0 /* AVOID */;
      }
      left = layout(activeWindow.innerWidth, viewSizeWidth, horizontalAnchor);
    } else {
      const horizontalAnchor = { offset: around.left, size: around.width, position: anchorAlignment === 0 /* LEFT */ ? 0 /* Before */ : 1 /* After */ };
      const verticalAnchor = { offset: around.top, size: around.height, position: anchorPosition === 0 /* BELOW */ ? 0 /* Before */ : 1 /* After */, mode: 1 /* ALIGN */ };
      left = layout(activeWindow.innerWidth, viewSizeWidth, horizontalAnchor);
      if (Range.intersects({ start: left, end: left + viewSizeWidth }, { start: horizontalAnchor.offset, end: horizontalAnchor.offset + horizontalAnchor.size })) {
        verticalAnchor.mode = 0 /* AVOID */;
      }
      top = layout(activeWindow.innerHeight, viewSizeHeight, verticalAnchor) + activeWindow.pageYOffset;
    }
    this.view.classList.remove("top", "bottom", "left", "right");
    this.view.classList.add(anchorPosition === 0 /* BELOW */ ? "bottom" : "top");
    this.view.classList.add(anchorAlignment === 0 /* LEFT */ ? "left" : "right");
    this.view.classList.toggle("fixed", this.useFixedPosition);
    const containerPosition = DOM.getDomNodePagePosition(this.container);
    this.view.style.top = `${top - (this.useFixedPosition ? DOM.getDomNodePagePosition(this.view).top : containerPosition.top)}px`;
    this.view.style.left = `${left - (this.useFixedPosition ? DOM.getDomNodePagePosition(this.view).left : containerPosition.left)}px`;
    this.view.style.width = "initial";
  }
  hide(data) {
    const delegate = this.delegate;
    this.delegate = null;
    if (delegate?.onHide) {
      delegate.onHide(data);
    }
    this.toDisposeOnClean.dispose();
    DOM.hide(this.view);
  }
  isVisible() {
    return !!this.delegate;
  }
  onDOMEvent(e, onCapture) {
    if (this.delegate) {
      if (this.delegate.onDOMEvent) {
        this.delegate.onDOMEvent(e, DOM.getWindow(e).document.activeElement);
      } else if (onCapture && !DOM.isAncestor(e.target, this.container)) {
        this.hide();
      }
    }
  }
  dispose() {
    this.hide();
    super.dispose();
  }
};
_ContextView.BUBBLE_UP_EVENTS = ["click", "keydown", "focus", "blur"];
_ContextView.BUBBLE_DOWN_EVENTS = ["click"];
let ContextView = _ContextView;
const SHADOW_ROOT_CSS = (
  /* css */
  `
	:host {
		all: initial; /* 1st rule so subsequent properties are reset. */
	}

	.codicon[class*='codicon-'] {
		font: normal normal normal 16px/1 codicon;
		display: inline-block;
		text-decoration: none;
		text-rendering: auto;
		text-align: center;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}

	:host {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "HelveticaNeue-Light", system-ui, "Ubuntu", "Droid Sans", sans-serif;
	}

	:host-context(.mac) { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
	:host-context(.mac:lang(zh-Hans)) { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", sans-serif; }
	:host-context(.mac:lang(zh-Hant)) { font-family: -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif; }
	:host-context(.mac:lang(ja)) { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic Pro", sans-serif; }
	:host-context(.mac:lang(ko)) { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Nanum Gothic", "AppleGothic", sans-serif; }

	:host-context(.windows) { font-family: "Segoe WPC", "Segoe UI", sans-serif; }
	:host-context(.windows:lang(zh-Hans)) { font-family: "Segoe WPC", "Segoe UI", "Microsoft YaHei", sans-serif; }
	:host-context(.windows:lang(zh-Hant)) { font-family: "Segoe WPC", "Segoe UI", "Microsoft Jhenghei", sans-serif; }
	:host-context(.windows:lang(ja)) { font-family: "Segoe WPC", "Segoe UI", "Yu Gothic UI", "Meiryo UI", sans-serif; }
	:host-context(.windows:lang(ko)) { font-family: "Segoe WPC", "Segoe UI", "Malgun Gothic", "Dotom", sans-serif; }

	:host-context(.linux) { font-family: system-ui, "Ubuntu", "Droid Sans", sans-serif; }
	:host-context(.linux:lang(zh-Hans)) { font-family: system-ui, "Ubuntu", "Droid Sans", "Source Han Sans SC", "Source Han Sans CN", "Source Han Sans", sans-serif; }
	:host-context(.linux:lang(zh-Hant)) { font-family: system-ui, "Ubuntu", "Droid Sans", "Source Han Sans TC", "Source Han Sans TW", "Source Han Sans", sans-serif; }
	:host-context(.linux:lang(ja)) { font-family: system-ui, "Ubuntu", "Droid Sans", "Source Han Sans J", "Source Han Sans JP", "Source Han Sans", sans-serif; }
	:host-context(.linux:lang(ko)) { font-family: system-ui, "Ubuntu", "Droid Sans", "Source Han Sans K", "Source Han Sans JR", "Source Han Sans", "UnDotum", "FBaekmuk Gulim", sans-serif; }
`
);
export {
  AnchorAlignment,
  AnchorAxisAlignment,
  AnchorPosition,
  ContextView,
  ContextViewDOMPosition,
  LayoutAnchorMode,
  LayoutAnchorPosition,
  isAnchor,
  layout
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvY29udGV4dHZpZXcvY29udGV4dHZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBCcm93c2VyRmVhdHVyZXMgfSBmcm9tICcuLi8uLi9jYW5JVXNlLmpzJztcbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi9kb20uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9yYW5nZS5qcyc7XG5pbXBvcnQgeyBPbWl0T3B0aW9uYWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0ICcuL2NvbnRleHR2aWV3LmNzcyc7XG5cbmV4cG9ydCBjb25zdCBlbnVtIENvbnRleHRWaWV3RE9NUG9zaXRpb24ge1xuXHRBQlNPTFVURSA9IDEsXG5cdEZJWEVELFxuXHRGSVhFRF9TSEFET1dcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQW5jaG9yIHtcblx0eDogbnVtYmVyO1xuXHR5OiBudW1iZXI7XG5cdHdpZHRoPzogbnVtYmVyO1xuXHRoZWlnaHQ/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FuY2hvcihvYmo6IHVua25vd24pOiBvYmogaXMgSUFuY2hvciB8IE9taXRPcHRpb25hbDxJQW5jaG9yPiB7XG5cdGNvbnN0IGFuY2hvciA9IG9iaiBhcyBJQW5jaG9yIHwgT21pdE9wdGlvbmFsPElBbmNob3I+IHwgdW5kZWZpbmVkO1xuXG5cdHJldHVybiAhIWFuY2hvciAmJiB0eXBlb2YgYW5jaG9yLnggPT09ICdudW1iZXInICYmIHR5cGVvZiBhbmNob3IueSA9PT0gJ251bWJlcic7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEFuY2hvckFsaWdubWVudCB7XG5cdExFRlQsIFJJR0hUXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEFuY2hvclBvc2l0aW9uIHtcblx0QkVMT1csIEFCT1ZFXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEFuY2hvckF4aXNBbGlnbm1lbnQge1xuXHRWRVJUSUNBTCwgSE9SSVpPTlRBTFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEZWxlZ2F0ZSB7XG5cdC8qKlxuXHQgKiBUaGUgYW5jaG9yIHdoZXJlIHRvIHBvc2l0aW9uIHRoZSBjb250ZXh0IHZpZXcuXG5cdCAqIFVzZSBhIGBIVE1MRWxlbWVudGAgdG8gcG9zaXRpb24gdGhlIHZpZXcgYXQgdGhlIGVsZW1lbnQsXG5cdCAqIGEgYFN0YW5kYXJkTW91c2VFdmVudGAgdG8gcG9zaXRpb24gaXQgYXQgdGhlIG1vdXNlIHBvc2l0aW9uXG5cdCAqIG9yIGFuIGBJQW5jaG9yYCB0byBwb3NpdGlvbiBpdCBhdCBhIHNwZWNpZmljIGxvY2F0aW9uLlxuXHQgKi9cblx0Z2V0QW5jaG9yKCk6IEhUTUxFbGVtZW50IHwgU3RhbmRhcmRNb3VzZUV2ZW50IHwgSUFuY2hvcjtcblx0cmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJRGlzcG9zYWJsZSB8IG51bGw7XG5cdGZvY3VzPygpOiB2b2lkO1xuXHRsYXlvdXQ/KCk6IHZvaWQ7XG5cdGFuY2hvckFsaWdubWVudD86IEFuY2hvckFsaWdubWVudDsgLy8gZGVmYXVsdDogbGVmdFxuXHRhbmNob3JQb3NpdGlvbj86IEFuY2hvclBvc2l0aW9uOyAvLyBkZWZhdWx0OiBiZWxvd1xuXHRhbmNob3JBeGlzQWxpZ25tZW50PzogQW5jaG9yQXhpc0FsaWdubWVudDsgLy8gZGVmYXVsdDogdmVydGljYWxcblx0Y2FuUmVsYXlvdXQ/OiBib29sZWFuOyAvLyBkZWZhdWx0OiB0cnVlXG5cdG9uRE9NRXZlbnQ/KGU6IEV2ZW50LCBhY3RpdmVFbGVtZW50OiBIVE1MRWxlbWVudCk6IHZvaWQ7XG5cdG9uSGlkZT8oZGF0YT86IHVua25vd24pOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBjb250ZXh0IHZpZXdzIHdpdGggaGlnaGVyIGxheWVycyBhcmUgcmVuZGVyZWQgaGlnaGVyIGluIHotaW5kZXggb3JkZXJcblx0ICovXG5cdGxheWVyPzogbnVtYmVyOyAvLyBEZWZhdWx0OiAwXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbnRleHRWaWV3UHJvdmlkZXIge1xuXHRzaG93Q29udGV4dFZpZXcoZGVsZWdhdGU6IElEZWxlZ2F0ZSwgY29udGFpbmVyPzogSFRNTEVsZW1lbnQpOiB2b2lkO1xuXHRoaWRlQ29udGV4dFZpZXcoKTogdm9pZDtcblx0bGF5b3V0KCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBvc2l0aW9uIHtcblx0dG9wOiBudW1iZXI7XG5cdGxlZnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2l6ZSB7XG5cdHdpZHRoOiBudW1iZXI7XG5cdGhlaWdodDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3IGV4dGVuZHMgSVBvc2l0aW9uLCBJU2l6ZSB7IH1cblxuZXhwb3J0IGNvbnN0IGVudW0gTGF5b3V0QW5jaG9yUG9zaXRpb24ge1xuXHRCZWZvcmUsXG5cdEFmdGVyXG59XG5cbmV4cG9ydCBlbnVtIExheW91dEFuY2hvck1vZGUge1xuXHRBVk9JRCxcblx0QUxJR05cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTGF5b3V0QW5jaG9yIHtcblx0b2Zmc2V0OiBudW1iZXI7XG5cdHNpemU6IG51bWJlcjtcblx0bW9kZT86IExheW91dEFuY2hvck1vZGU7IC8vIGRlZmF1bHQ6IEFWT0lEXG5cdHBvc2l0aW9uOiBMYXlvdXRBbmNob3JQb3NpdGlvbjtcbn1cblxuLyoqXG4gKiBMYXlzIG91dCBhIG9uZSBkaW1lbnNpb25hbCB2aWV3IG5leHQgdG8gYW4gYW5jaG9yIGluIGEgdmlld3BvcnQuXG4gKlxuICogQHJldHVybnMgVGhlIHZpZXcgb2Zmc2V0IHdpdGhpbiB0aGUgdmlld3BvcnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsYXlvdXQodmlld3BvcnRTaXplOiBudW1iZXIsIHZpZXdTaXplOiBudW1iZXIsIGFuY2hvcjogSUxheW91dEFuY2hvcik6IG51bWJlciB7XG5cdGNvbnN0IGxheW91dEFmdGVyQW5jaG9yQm91bmRhcnkgPSBhbmNob3IubW9kZSA9PT0gTGF5b3V0QW5jaG9yTW9kZS5BTElHTiA/IGFuY2hvci5vZmZzZXQgOiBhbmNob3Iub2Zmc2V0ICsgYW5jaG9yLnNpemU7XG5cdGNvbnN0IGxheW91dEJlZm9yZUFuY2hvckJvdW5kYXJ5ID0gYW5jaG9yLm1vZGUgPT09IExheW91dEFuY2hvck1vZGUuQUxJR04gPyBhbmNob3Iub2Zmc2V0ICsgYW5jaG9yLnNpemUgOiBhbmNob3Iub2Zmc2V0O1xuXG5cdGlmIChhbmNob3IucG9zaXRpb24gPT09IExheW91dEFuY2hvclBvc2l0aW9uLkJlZm9yZSkge1xuXHRcdGlmICh2aWV3U2l6ZSA8PSB2aWV3cG9ydFNpemUgLSBsYXlvdXRBZnRlckFuY2hvckJvdW5kYXJ5KSB7XG5cdFx0XHRyZXR1cm4gbGF5b3V0QWZ0ZXJBbmNob3JCb3VuZGFyeTsgLy8gaGFwcHkgY2FzZSwgbGF5IGl0IG91dCBhZnRlciB0aGUgYW5jaG9yXG5cdFx0fVxuXG5cdFx0aWYgKHZpZXdTaXplIDw9IGxheW91dEJlZm9yZUFuY2hvckJvdW5kYXJ5KSB7XG5cdFx0XHRyZXR1cm4gbGF5b3V0QmVmb3JlQW5jaG9yQm91bmRhcnkgLSB2aWV3U2l6ZTsgLy8gb2sgY2FzZSwgbGF5IGl0IG91dCBiZWZvcmUgdGhlIGFuY2hvclxuXHRcdH1cblxuXHRcdHJldHVybiBNYXRoLm1heCh2aWV3cG9ydFNpemUgLSB2aWV3U2l6ZSwgMCk7IC8vIHNhZCBjYXNlLCBsYXkgaXQgb3ZlciB0aGUgYW5jaG9yXG5cdH0gZWxzZSB7XG5cdFx0aWYgKHZpZXdTaXplIDw9IGxheW91dEJlZm9yZUFuY2hvckJvdW5kYXJ5KSB7XG5cdFx0XHRyZXR1cm4gbGF5b3V0QmVmb3JlQW5jaG9yQm91bmRhcnkgLSB2aWV3U2l6ZTsgLy8gaGFwcHkgY2FzZSwgbGF5IGl0IG91dCBiZWZvcmUgdGhlIGFuY2hvclxuXHRcdH1cblxuXHRcdGlmICh2aWV3U2l6ZSA8PSB2aWV3cG9ydFNpemUgLSBsYXlvdXRBZnRlckFuY2hvckJvdW5kYXJ5KSB7XG5cdFx0XHRyZXR1cm4gbGF5b3V0QWZ0ZXJBbmNob3JCb3VuZGFyeTsgLy8gb2sgY2FzZSwgbGF5IGl0IG91dCBhZnRlciB0aGUgYW5jaG9yXG5cdFx0fVxuXG5cdFx0cmV0dXJuIDA7IC8vIHNhZCBjYXNlLCBsYXkgaXQgb3ZlciB0aGUgYW5jaG9yXG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbnRleHRWaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQlVCQkxFX1VQX0VWRU5UUyA9IFsnY2xpY2snLCAna2V5ZG93bicsICdmb2N1cycsICdibHVyJ107XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEJVQkJMRV9ET1dOX0VWRU5UUyA9IFsnY2xpY2snXTtcblxuXHRwcml2YXRlIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSB2aWV3OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB1c2VGaXhlZFBvc2l0aW9uID0gZmFsc2U7XG5cdHByaXZhdGUgdXNlU2hhZG93RE9NID0gZmFsc2U7XG5cdHByaXZhdGUgZGVsZWdhdGU6IElEZWxlZ2F0ZSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHRvRGlzcG9zZU9uQ2xlYW46IElEaXNwb3NhYmxlID0gRGlzcG9zYWJsZS5Ob25lO1xuXHRwcml2YXRlIHRvRGlzcG9zZU9uU2V0Q29udGFpbmVyOiBJRGlzcG9zYWJsZSA9IERpc3Bvc2FibGUuTm9uZTtcblx0cHJpdmF0ZSBzaGFkb3dSb290OiBTaGFkb3dSb290IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgc2hhZG93Um9vdEhvc3RFbGVtZW50OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGRvbVBvc2l0aW9uOiBDb250ZXh0Vmlld0RPTVBvc2l0aW9uKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMudmlldyA9IERPTS4kKCcuY29udGV4dC12aWV3Jyk7XG5cdFx0RE9NLmhpZGUodGhpcy52aWV3KTtcblxuXHRcdHRoaXMuc2V0Q29udGFpbmVyKGNvbnRhaW5lciwgZG9tUG9zaXRpb24pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLnNldENvbnRhaW5lcihudWxsLCBDb250ZXh0Vmlld0RPTVBvc2l0aW9uLkFCU09MVVRFKSkpO1xuXHR9XG5cblx0c2V0Q29udGFpbmVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCBudWxsLCBkb21Qb3NpdGlvbjogQ29udGV4dFZpZXdET01Qb3NpdGlvbik6IHZvaWQge1xuXHRcdHRoaXMudXNlRml4ZWRQb3NpdGlvbiA9IGRvbVBvc2l0aW9uICE9PSBDb250ZXh0Vmlld0RPTVBvc2l0aW9uLkFCU09MVVRFO1xuXHRcdGNvbnN0IHVzZWRTaGFkb3dET00gPSB0aGlzLnVzZVNoYWRvd0RPTTtcblx0XHR0aGlzLnVzZVNoYWRvd0RPTSA9IGRvbVBvc2l0aW9uID09PSBDb250ZXh0Vmlld0RPTVBvc2l0aW9uLkZJWEVEX1NIQURPVztcblxuXHRcdGlmIChjb250YWluZXIgPT09IHRoaXMuY29udGFpbmVyICYmIHVzZWRTaGFkb3dET00gPT09IHRoaXMudXNlU2hhZG93RE9NKSB7XG5cdFx0XHRyZXR1cm47IC8vIGNvbnRhaW5lciBpcyB0aGUgc2FtZSBhbmQgbm8gc2hhZG93IERPTSB1c2FnZSBoYXMgY2hhbmdlZFxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy50b0Rpc3Bvc2VPblNldENvbnRhaW5lci5kaXNwb3NlKCk7XG5cblx0XHRcdHRoaXMudmlldy5yZW1vdmUoKTtcblx0XHRcdGlmICh0aGlzLnNoYWRvd1Jvb3QpIHtcblx0XHRcdFx0dGhpcy5zaGFkb3dSb290ID0gbnVsbDtcblx0XHRcdFx0dGhpcy5zaGFkb3dSb290SG9zdEVsZW1lbnQ/LnJlbW92ZSgpO1xuXHRcdFx0XHR0aGlzLnNoYWRvd1Jvb3RIb3N0RWxlbWVudCA9IG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuY29udGFpbmVyID0gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAoY29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcblxuXHRcdFx0aWYgKHRoaXMudXNlU2hhZG93RE9NKSB7XG5cdFx0XHRcdHRoaXMuc2hhZG93Um9vdEhvc3RFbGVtZW50ID0gRE9NLiQoJy5zaGFkb3ctcm9vdC1ob3N0Jyk7XG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuc2hhZG93Um9vdEhvc3RFbGVtZW50KTtcblx0XHRcdFx0dGhpcy5zaGFkb3dSb290ID0gdGhpcy5zaGFkb3dSb290SG9zdEVsZW1lbnQuYXR0YWNoU2hhZG93KHsgbW9kZTogJ29wZW4nIH0pO1xuXHRcdFx0XHRjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG5cdFx0XHRcdHN0eWxlLnRleHRDb250ZW50ID0gU0hBRE9XX1JPT1RfQ1NTO1xuXHRcdFx0XHR0aGlzLnNoYWRvd1Jvb3QuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuXHRcdFx0XHR0aGlzLnNoYWRvd1Jvb3QuYXBwZW5kQ2hpbGQodGhpcy52aWV3KTtcblx0XHRcdFx0dGhpcy5zaGFkb3dSb290LmFwcGVuZENoaWxkKERPTS4kKCdzbG90JykpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy52aWV3KTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdG9EaXNwb3NlT25TZXRDb250YWluZXIgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdENvbnRleHRWaWV3LkJVQkJMRV9VUF9FVkVOVFMuZm9yRWFjaChldmVudCA9PiB7XG5cdFx0XHRcdHRvRGlzcG9zZU9uU2V0Q29udGFpbmVyLmFkZChET00uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIhLCBldmVudCwgZSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5vbkRPTUV2ZW50KGUsIGZhbHNlKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fSk7XG5cblx0XHRcdENvbnRleHRWaWV3LkJVQkJMRV9ET1dOX0VWRU5UUy5mb3JFYWNoKGV2ZW50ID0+IHtcblx0XHRcdFx0dG9EaXNwb3NlT25TZXRDb250YWluZXIuYWRkKERPTS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmNvbnRhaW5lciEsIGV2ZW50LCBlID0+IHtcblx0XHRcdFx0XHR0aGlzLm9uRE9NRXZlbnQoZSwgdHJ1ZSk7XG5cdFx0XHRcdH0sIHRydWUpKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLnRvRGlzcG9zZU9uU2V0Q29udGFpbmVyID0gdG9EaXNwb3NlT25TZXRDb250YWluZXI7XG5cdFx0fVxuXHR9XG5cblx0c2hvdyhkZWxlZ2F0ZTogSURlbGVnYXRlKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdHRoaXMuaGlkZSgpO1xuXHRcdH1cblxuXHRcdC8vIFNob3cgc3RhdGljIGJveFxuXHRcdERPTS5jbGVhck5vZGUodGhpcy52aWV3KTtcblx0XHR0aGlzLnZpZXcuY2xhc3NOYW1lID0gJ2NvbnRleHQtdmlldyBtb25hY28tY29tcG9uZW50Jztcblx0XHR0aGlzLnZpZXcuc3R5bGUudG9wID0gJzBweCc7XG5cdFx0dGhpcy52aWV3LnN0eWxlLmxlZnQgPSAnMHB4Jztcblx0XHR0aGlzLnZpZXcuc3R5bGUuekluZGV4ID0gYCR7MjU3NSArIChkZWxlZ2F0ZS5sYXllciA/PyAwKX1gO1xuXHRcdHRoaXMudmlldy5zdHlsZS5wb3NpdGlvbiA9IHRoaXMudXNlRml4ZWRQb3NpdGlvbiA/ICdmaXhlZCcgOiAnYWJzb2x1dGUnO1xuXHRcdERPTS5zaG93KHRoaXMudmlldyk7XG5cblx0XHQvLyBSZW5kZXIgY29udGVudFxuXHRcdHRoaXMudG9EaXNwb3NlT25DbGVhbiA9IGRlbGVnYXRlLnJlbmRlcih0aGlzLnZpZXcpIHx8IERpc3Bvc2FibGUuTm9uZTtcblxuXHRcdC8vIFNldCBhY3RpdmUgZGVsZWdhdGVcblx0XHR0aGlzLmRlbGVnYXRlID0gZGVsZWdhdGU7XG5cblx0XHQvLyBMYXlvdXRcblx0XHR0aGlzLmRvTGF5b3V0KCk7XG5cblx0XHQvLyBGb2N1c1xuXHRcdHRoaXMuZGVsZWdhdGUuZm9jdXM/LigpO1xuXHR9XG5cblx0Z2V0Vmlld0VsZW1lbnQoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLnZpZXc7XG5cdH1cblxuXHRsYXlvdXQoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZGVsZWdhdGUhLmNhblJlbGF5b3V0ID09PSBmYWxzZSAmJiAhKHBsYXRmb3JtLmlzSU9TICYmIEJyb3dzZXJGZWF0dXJlcy5wb2ludGVyRXZlbnRzKSkge1xuXHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5kZWxlZ2F0ZT8ubGF5b3V0Py4oKTtcblxuXHRcdHRoaXMuZG9MYXlvdXQoKTtcblx0fVxuXG5cdHByaXZhdGUgZG9MYXlvdXQoKTogdm9pZCB7XG5cdFx0Ly8gQ2hlY2sgdGhhdCB3ZSBzdGlsbCBoYXZlIGEgZGVsZWdhdGUgLSB0aGlzLmRlbGVnYXRlLmxheW91dCBtYXkgaGF2ZSBoaWRkZW5cblx0XHRpZiAoIXRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBHZXQgYW5jaG9yXG5cdFx0Y29uc3QgYW5jaG9yID0gdGhpcy5kZWxlZ2F0ZSEuZ2V0QW5jaG9yKCk7XG5cblx0XHQvLyBDb21wdXRlIGFyb3VuZFxuXHRcdGxldCBhcm91bmQ6IElWaWV3O1xuXG5cdFx0Ly8gR2V0IHRoZSBlbGVtZW50J3MgcG9zaXRpb24gYW5kIHNpemUgKHRvIGFuY2hvciB0aGUgdmlldylcblx0XHRpZiAoRE9NLmlzSFRNTEVsZW1lbnQoYW5jaG9yKSkge1xuXHRcdFx0Y29uc3QgZWxlbWVudFBvc2l0aW9uID0gRE9NLmdldERvbU5vZGVQYWdlUG9zaXRpb24oYW5jaG9yKTtcblxuXHRcdFx0Ly8gSW4gYXJlYXMgd2hlcmUgem9vbSBpcyBhcHBsaWVkIHRvIHRoZSBlbGVtZW50IG9yIGl0cyBhbmNlc3RvcnMsIHdlIG5lZWQgdG8gYWRqdXN0IHRoZSBzaXplIG9mIHRoZSBlbGVtZW50XG5cdFx0XHQvLyBlLmcuIFRoZSB0aXRsZSBiYXIgaGFzIGNvdW50ZXIgem9vbSBiZWhhdmlvciBtZWFuaW5nIGl0IGFwcGxpZXMgdGhlIGludmVyc2Ugb2Ygem9vbSBsZXZlbC5cblx0XHRcdC8vIFdpbmRvdyBab29tIExldmVsOiAxLjUsIFRpdGxlIEJhciBab29tOiAxLzEuNSwgU2l6ZSBNdWx0aXBsaWVyOiAxLjVcblx0XHRcdGNvbnN0IHpvb20gPSBET00uZ2V0RG9tTm9kZVpvb21MZXZlbChhbmNob3IpO1xuXG5cdFx0XHRhcm91bmQgPSB7XG5cdFx0XHRcdHRvcDogZWxlbWVudFBvc2l0aW9uLnRvcCAqIHpvb20sXG5cdFx0XHRcdGxlZnQ6IGVsZW1lbnRQb3NpdGlvbi5sZWZ0ICogem9vbSxcblx0XHRcdFx0d2lkdGg6IGVsZW1lbnRQb3NpdGlvbi53aWR0aCAqIHpvb20sXG5cdFx0XHRcdGhlaWdodDogZWxlbWVudFBvc2l0aW9uLmhlaWdodCAqIHpvb21cblx0XHRcdH07XG5cdFx0fSBlbHNlIGlmIChpc0FuY2hvcihhbmNob3IpKSB7XG5cdFx0XHRhcm91bmQgPSB7XG5cdFx0XHRcdHRvcDogYW5jaG9yLnksXG5cdFx0XHRcdGxlZnQ6IGFuY2hvci54LFxuXHRcdFx0XHR3aWR0aDogYW5jaG9yLndpZHRoIHx8IDEsXG5cdFx0XHRcdGhlaWdodDogYW5jaG9yLmhlaWdodCB8fCAyXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhcm91bmQgPSB7XG5cdFx0XHRcdHRvcDogYW5jaG9yLnBvc3ksXG5cdFx0XHRcdGxlZnQ6IGFuY2hvci5wb3N4LFxuXHRcdFx0XHQvLyBXZSBhcmUgYWJvdXQgdG8gcG9zaXRpb24gdGhlIGNvbnRleHQgdmlldyB3aGVyZSB0aGUgbW91c2Vcblx0XHRcdFx0Ly8gY3Vyc29yIGlzLiBUbyBwcmV2ZW50IHRoZSB2aWV3IGJlaW5nIGV4YWN0bHkgdW5kZXIgdGhlIG1vdXNlXG5cdFx0XHRcdC8vIHdoZW4gc2hvd2luZyBhbmQgdGh1cyBwb3RlbnRpYWxseSB0cmlnZ2VyaW5nIGFuIGFjdGlvbiB3aXRoaW4sXG5cdFx0XHRcdC8vIHdlIHRyZWF0IHRoZSBtb3VzZSBsb2NhdGlvbiBsaWtlIGEgc21hbGwgc2l6ZWQgYmxvY2sgZWxlbWVudC5cblx0XHRcdFx0d2lkdGg6IDIsXG5cdFx0XHRcdGhlaWdodDogMlxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCB2aWV3U2l6ZVdpZHRoID0gRE9NLmdldFRvdGFsV2lkdGgodGhpcy52aWV3KTtcblx0XHRjb25zdCB2aWV3U2l6ZUhlaWdodCA9IERPTS5nZXRUb3RhbEhlaWdodCh0aGlzLnZpZXcpO1xuXG5cdFx0Y29uc3QgYW5jaG9yUG9zaXRpb24gPSB0aGlzLmRlbGVnYXRlIS5hbmNob3JQb3NpdGlvbiA/PyBBbmNob3JQb3NpdGlvbi5CRUxPVztcblx0XHRjb25zdCBhbmNob3JBbGlnbm1lbnQgPSB0aGlzLmRlbGVnYXRlIS5hbmNob3JBbGlnbm1lbnQgPz8gQW5jaG9yQWxpZ25tZW50LkxFRlQ7XG5cdFx0Y29uc3QgYW5jaG9yQXhpc0FsaWdubWVudCA9IHRoaXMuZGVsZWdhdGUhLmFuY2hvckF4aXNBbGlnbm1lbnQgPz8gQW5jaG9yQXhpc0FsaWdubWVudC5WRVJUSUNBTDtcblxuXHRcdGxldCB0b3A6IG51bWJlcjtcblx0XHRsZXQgbGVmdDogbnVtYmVyO1xuXG5cdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gRE9NLmdldEFjdGl2ZVdpbmRvdygpO1xuXHRcdGlmIChhbmNob3JBeGlzQWxpZ25tZW50ID09PSBBbmNob3JBeGlzQWxpZ25tZW50LlZFUlRJQ0FMKSB7XG5cdFx0XHRjb25zdCB2ZXJ0aWNhbEFuY2hvcjogSUxheW91dEFuY2hvciA9IHsgb2Zmc2V0OiBhcm91bmQudG9wIC0gYWN0aXZlV2luZG93LnBhZ2VZT2Zmc2V0LCBzaXplOiBhcm91bmQuaGVpZ2h0LCBwb3NpdGlvbjogYW5jaG9yUG9zaXRpb24gPT09IEFuY2hvclBvc2l0aW9uLkJFTE9XID8gTGF5b3V0QW5jaG9yUG9zaXRpb24uQmVmb3JlIDogTGF5b3V0QW5jaG9yUG9zaXRpb24uQWZ0ZXIgfTtcblx0XHRcdGNvbnN0IGhvcml6b250YWxBbmNob3I6IElMYXlvdXRBbmNob3IgPSB7IG9mZnNldDogYXJvdW5kLmxlZnQsIHNpemU6IGFyb3VuZC53aWR0aCwgcG9zaXRpb246IGFuY2hvckFsaWdubWVudCA9PT0gQW5jaG9yQWxpZ25tZW50LkxFRlQgPyBMYXlvdXRBbmNob3JQb3NpdGlvbi5CZWZvcmUgOiBMYXlvdXRBbmNob3JQb3NpdGlvbi5BZnRlciwgbW9kZTogTGF5b3V0QW5jaG9yTW9kZS5BTElHTiB9O1xuXG5cdFx0XHR0b3AgPSBsYXlvdXQoYWN0aXZlV2luZG93LmlubmVySGVpZ2h0LCB2aWV3U2l6ZUhlaWdodCwgdmVydGljYWxBbmNob3IpICsgYWN0aXZlV2luZG93LnBhZ2VZT2Zmc2V0O1xuXG5cdFx0XHQvLyBpZiB2aWV3IGludGVyc2VjdHMgdmVydGljYWxseSB3aXRoIGFuY2hvciwgIHdlIG11c3QgYXZvaWQgdGhlIGFuY2hvclxuXHRcdFx0aWYgKFJhbmdlLmludGVyc2VjdHMoeyBzdGFydDogdG9wLCBlbmQ6IHRvcCArIHZpZXdTaXplSGVpZ2h0IH0sIHsgc3RhcnQ6IHZlcnRpY2FsQW5jaG9yLm9mZnNldCwgZW5kOiB2ZXJ0aWNhbEFuY2hvci5vZmZzZXQgKyB2ZXJ0aWNhbEFuY2hvci5zaXplIH0pKSB7XG5cdFx0XHRcdGhvcml6b250YWxBbmNob3IubW9kZSA9IExheW91dEFuY2hvck1vZGUuQVZPSUQ7XG5cdFx0XHR9XG5cblx0XHRcdGxlZnQgPSBsYXlvdXQoYWN0aXZlV2luZG93LmlubmVyV2lkdGgsIHZpZXdTaXplV2lkdGgsIGhvcml6b250YWxBbmNob3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBob3Jpem9udGFsQW5jaG9yOiBJTGF5b3V0QW5jaG9yID0geyBvZmZzZXQ6IGFyb3VuZC5sZWZ0LCBzaXplOiBhcm91bmQud2lkdGgsIHBvc2l0aW9uOiBhbmNob3JBbGlnbm1lbnQgPT09IEFuY2hvckFsaWdubWVudC5MRUZUID8gTGF5b3V0QW5jaG9yUG9zaXRpb24uQmVmb3JlIDogTGF5b3V0QW5jaG9yUG9zaXRpb24uQWZ0ZXIgfTtcblx0XHRcdGNvbnN0IHZlcnRpY2FsQW5jaG9yOiBJTGF5b3V0QW5jaG9yID0geyBvZmZzZXQ6IGFyb3VuZC50b3AsIHNpemU6IGFyb3VuZC5oZWlnaHQsIHBvc2l0aW9uOiBhbmNob3JQb3NpdGlvbiA9PT0gQW5jaG9yUG9zaXRpb24uQkVMT1cgPyBMYXlvdXRBbmNob3JQb3NpdGlvbi5CZWZvcmUgOiBMYXlvdXRBbmNob3JQb3NpdGlvbi5BZnRlciwgbW9kZTogTGF5b3V0QW5jaG9yTW9kZS5BTElHTiB9O1xuXG5cdFx0XHRsZWZ0ID0gbGF5b3V0KGFjdGl2ZVdpbmRvdy5pbm5lcldpZHRoLCB2aWV3U2l6ZVdpZHRoLCBob3Jpem9udGFsQW5jaG9yKTtcblxuXHRcdFx0Ly8gaWYgdmlldyBpbnRlcnNlY3RzIGhvcml6b250YWxseSB3aXRoIGFuY2hvciwgd2UgbXVzdCBhdm9pZCB0aGUgYW5jaG9yXG5cdFx0XHRpZiAoUmFuZ2UuaW50ZXJzZWN0cyh7IHN0YXJ0OiBsZWZ0LCBlbmQ6IGxlZnQgKyB2aWV3U2l6ZVdpZHRoIH0sIHsgc3RhcnQ6IGhvcml6b250YWxBbmNob3Iub2Zmc2V0LCBlbmQ6IGhvcml6b250YWxBbmNob3Iub2Zmc2V0ICsgaG9yaXpvbnRhbEFuY2hvci5zaXplIH0pKSB7XG5cdFx0XHRcdHZlcnRpY2FsQW5jaG9yLm1vZGUgPSBMYXlvdXRBbmNob3JNb2RlLkFWT0lEO1xuXHRcdFx0fVxuXG5cdFx0XHR0b3AgPSBsYXlvdXQoYWN0aXZlV2luZG93LmlubmVySGVpZ2h0LCB2aWV3U2l6ZUhlaWdodCwgdmVydGljYWxBbmNob3IpICsgYWN0aXZlV2luZG93LnBhZ2VZT2Zmc2V0O1xuXHRcdH1cblxuXHRcdHRoaXMudmlldy5jbGFzc0xpc3QucmVtb3ZlKCd0b3AnLCAnYm90dG9tJywgJ2xlZnQnLCAncmlnaHQnKTtcblx0XHR0aGlzLnZpZXcuY2xhc3NMaXN0LmFkZChhbmNob3JQb3NpdGlvbiA9PT0gQW5jaG9yUG9zaXRpb24uQkVMT1cgPyAnYm90dG9tJyA6ICd0b3AnKTtcblx0XHR0aGlzLnZpZXcuY2xhc3NMaXN0LmFkZChhbmNob3JBbGlnbm1lbnQgPT09IEFuY2hvckFsaWdubWVudC5MRUZUID8gJ2xlZnQnIDogJ3JpZ2h0Jyk7XG5cdFx0dGhpcy52aWV3LmNsYXNzTGlzdC50b2dnbGUoJ2ZpeGVkJywgdGhpcy51c2VGaXhlZFBvc2l0aW9uKTtcblxuXHRcdGNvbnN0IGNvbnRhaW5lclBvc2l0aW9uID0gRE9NLmdldERvbU5vZGVQYWdlUG9zaXRpb24odGhpcy5jb250YWluZXIhKTtcblx0XHR0aGlzLnZpZXcuc3R5bGUudG9wID0gYCR7dG9wIC0gKHRoaXMudXNlRml4ZWRQb3NpdGlvbiA/IERPTS5nZXREb21Ob2RlUGFnZVBvc2l0aW9uKHRoaXMudmlldykudG9wIDogY29udGFpbmVyUG9zaXRpb24udG9wKX1weGA7XG5cdFx0dGhpcy52aWV3LnN0eWxlLmxlZnQgPSBgJHtsZWZ0IC0gKHRoaXMudXNlRml4ZWRQb3NpdGlvbiA/IERPTS5nZXREb21Ob2RlUGFnZVBvc2l0aW9uKHRoaXMudmlldykubGVmdCA6IGNvbnRhaW5lclBvc2l0aW9uLmxlZnQpfXB4YDtcblx0XHR0aGlzLnZpZXcuc3R5bGUud2lkdGggPSAnaW5pdGlhbCc7XG5cdH1cblxuXHRoaWRlKGRhdGE/OiB1bmtub3duKTogdm9pZCB7XG5cdFx0Y29uc3QgZGVsZWdhdGUgPSB0aGlzLmRlbGVnYXRlO1xuXHRcdHRoaXMuZGVsZWdhdGUgPSBudWxsO1xuXG5cdFx0aWYgKGRlbGVnYXRlPy5vbkhpZGUpIHtcblx0XHRcdGRlbGVnYXRlLm9uSGlkZShkYXRhKTtcblx0XHR9XG5cblx0XHR0aGlzLnRvRGlzcG9zZU9uQ2xlYW4uZGlzcG9zZSgpO1xuXG5cdFx0RE9NLmhpZGUodGhpcy52aWV3KTtcblx0fVxuXG5cdHByaXZhdGUgaXNWaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuZGVsZWdhdGU7XG5cdH1cblxuXHRwcml2YXRlIG9uRE9NRXZlbnQoZTogVUlFdmVudCwgb25DYXB0dXJlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZGVsZWdhdGUpIHtcblx0XHRcdGlmICh0aGlzLmRlbGVnYXRlLm9uRE9NRXZlbnQpIHtcblx0XHRcdFx0dGhpcy5kZWxlZ2F0ZS5vbkRPTUV2ZW50KGUsIDxIVE1MRWxlbWVudD5ET00uZ2V0V2luZG93KGUpLmRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpO1xuXHRcdFx0fSBlbHNlIGlmIChvbkNhcHR1cmUgJiYgIURPTS5pc0FuY2VzdG9yKDxIVE1MRWxlbWVudD5lLnRhcmdldCwgdGhpcy5jb250YWluZXIpKSB7XG5cdFx0XHRcdHRoaXMuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5oaWRlKCk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY29uc3QgU0hBRE9XX1JPT1RfQ1NTID0gLyogY3NzICovIGBcblx0Omhvc3Qge1xuXHRcdGFsbDogaW5pdGlhbDsgLyogMXN0IHJ1bGUgc28gc3Vic2VxdWVudCBwcm9wZXJ0aWVzIGFyZSByZXNldC4gKi9cblx0fVxuXG5cdC5jb2RpY29uW2NsYXNzKj0nY29kaWNvbi0nXSB7XG5cdFx0Zm9udDogbm9ybWFsIG5vcm1hbCBub3JtYWwgMTZweC8xIGNvZGljb247XG5cdFx0ZGlzcGxheTogaW5saW5lLWJsb2NrO1xuXHRcdHRleHQtZGVjb3JhdGlvbjogbm9uZTtcblx0XHR0ZXh0LXJlbmRlcmluZzogYXV0bztcblx0XHR0ZXh0LWFsaWduOiBjZW50ZXI7XG5cdFx0LXdlYmtpdC1mb250LXNtb290aGluZzogYW50aWFsaWFzZWQ7XG5cdFx0LW1vei1vc3gtZm9udC1zbW9vdGhpbmc6IGdyYXlzY2FsZTtcblx0XHR1c2VyLXNlbGVjdDogbm9uZTtcblx0XHQtd2Via2l0LXVzZXItc2VsZWN0OiBub25lO1xuXHRcdC1tcy11c2VyLXNlbGVjdDogbm9uZTtcblx0fVxuXG5cdDpob3N0IHtcblx0XHRmb250LWZhbWlseTogLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFdQQ1wiLCBcIlNlZ29lIFVJXCIsIFwiSGVsdmV0aWNhTmV1ZS1MaWdodFwiLCBzeXN0ZW0tdWksIFwiVWJ1bnR1XCIsIFwiRHJvaWQgU2Fuc1wiLCBzYW5zLXNlcmlmO1xuXHR9XG5cblx0Omhvc3QtY29udGV4dCgubWFjKSB7IGZvbnQtZmFtaWx5OiAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIHNhbnMtc2VyaWY7IH1cblx0Omhvc3QtY29udGV4dCgubWFjOmxhbmcoemgtSGFucykpIHsgZm9udC1mYW1pbHk6IC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgXCJQaW5nRmFuZyBTQ1wiLCBcIkhpcmFnaW5vIFNhbnMgR0JcIiwgc2Fucy1zZXJpZjsgfVxuXHQ6aG9zdC1jb250ZXh0KC5tYWM6bGFuZyh6aC1IYW50KSkgeyBmb250LWZhbWlseTogLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlBpbmdGYW5nIFRDXCIsIHNhbnMtc2VyaWY7IH1cblx0Omhvc3QtY29udGV4dCgubWFjOmxhbmcoamEpKSB7IGZvbnQtZmFtaWx5OiAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIFwiSGlyYWdpbm8gS2FrdSBHb3RoaWMgUHJvXCIsIHNhbnMtc2VyaWY7IH1cblx0Omhvc3QtY29udGV4dCgubWFjOmxhbmcoa28pKSB7IGZvbnQtZmFtaWx5OiAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIFwiQXBwbGUgU0QgR290aGljIE5lb1wiLCBcIk5hbnVtIEdvdGhpY1wiLCBcIkFwcGxlR290aGljXCIsIHNhbnMtc2VyaWY7IH1cblxuXHQ6aG9zdC1jb250ZXh0KC53aW5kb3dzKSB7IGZvbnQtZmFtaWx5OiBcIlNlZ29lIFdQQ1wiLCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7IH1cblx0Omhvc3QtY29udGV4dCgud2luZG93czpsYW5nKHpoLUhhbnMpKSB7IGZvbnQtZmFtaWx5OiBcIlNlZ29lIFdQQ1wiLCBcIlNlZ29lIFVJXCIsIFwiTWljcm9zb2Z0IFlhSGVpXCIsIHNhbnMtc2VyaWY7IH1cblx0Omhvc3QtY29udGV4dCgud2luZG93czpsYW5nKHpoLUhhbnQpKSB7IGZvbnQtZmFtaWx5OiBcIlNlZ29lIFdQQ1wiLCBcIlNlZ29lIFVJXCIsIFwiTWljcm9zb2Z0IEpoZW5naGVpXCIsIHNhbnMtc2VyaWY7IH1cblx0Omhvc3QtY29udGV4dCgud2luZG93czpsYW5nKGphKSkgeyBmb250LWZhbWlseTogXCJTZWdvZSBXUENcIiwgXCJTZWdvZSBVSVwiLCBcIll1IEdvdGhpYyBVSVwiLCBcIk1laXJ5byBVSVwiLCBzYW5zLXNlcmlmOyB9XG5cdDpob3N0LWNvbnRleHQoLndpbmRvd3M6bGFuZyhrbykpIHsgZm9udC1mYW1pbHk6IFwiU2Vnb2UgV1BDXCIsIFwiU2Vnb2UgVUlcIiwgXCJNYWxndW4gR290aGljXCIsIFwiRG90b21cIiwgc2Fucy1zZXJpZjsgfVxuXG5cdDpob3N0LWNvbnRleHQoLmxpbnV4KSB7IGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIFwiVWJ1bnR1XCIsIFwiRHJvaWQgU2Fuc1wiLCBzYW5zLXNlcmlmOyB9XG5cdDpob3N0LWNvbnRleHQoLmxpbnV4OmxhbmcoemgtSGFucykpIHsgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgXCJVYnVudHVcIiwgXCJEcm9pZCBTYW5zXCIsIFwiU291cmNlIEhhbiBTYW5zIFNDXCIsIFwiU291cmNlIEhhbiBTYW5zIENOXCIsIFwiU291cmNlIEhhbiBTYW5zXCIsIHNhbnMtc2VyaWY7IH1cblx0Omhvc3QtY29udGV4dCgubGludXg6bGFuZyh6aC1IYW50KSkgeyBmb250LWZhbWlseTogc3lzdGVtLXVpLCBcIlVidW50dVwiLCBcIkRyb2lkIFNhbnNcIiwgXCJTb3VyY2UgSGFuIFNhbnMgVENcIiwgXCJTb3VyY2UgSGFuIFNhbnMgVFdcIiwgXCJTb3VyY2UgSGFuIFNhbnNcIiwgc2Fucy1zZXJpZjsgfVxuXHQ6aG9zdC1jb250ZXh0KC5saW51eDpsYW5nKGphKSkgeyBmb250LWZhbWlseTogc3lzdGVtLXVpLCBcIlVidW50dVwiLCBcIkRyb2lkIFNhbnNcIiwgXCJTb3VyY2UgSGFuIFNhbnMgSlwiLCBcIlNvdXJjZSBIYW4gU2FucyBKUFwiLCBcIlNvdXJjZSBIYW4gU2Fuc1wiLCBzYW5zLXNlcmlmOyB9XG5cdDpob3N0LWNvbnRleHQoLmxpbnV4Omxhbmcoa28pKSB7IGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIFwiVWJ1bnR1XCIsIFwiRHJvaWQgU2Fuc1wiLCBcIlNvdXJjZSBIYW4gU2FucyBLXCIsIFwiU291cmNlIEhhbiBTYW5zIEpSXCIsIFwiU291cmNlIEhhbiBTYW5zXCIsIFwiVW5Eb3R1bVwiLCBcIkZCYWVrbXVrIEd1bGltXCIsIHNhbnMtc2VyaWY7IH1cbmA7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHVCQUF1QjtBQUNoQyxZQUFZLFNBQVM7QUFFckIsU0FBUyxZQUFZLGlCQUE4QixvQkFBb0I7QUFDdkUsWUFBWSxjQUFjO0FBQzFCLFNBQVMsYUFBYTtBQUV0QixPQUFPO0FBRUEsSUFBVyx5QkFBWCxrQkFBV0EsNEJBQVg7QUFDTixFQUFBQSxnREFBQSxjQUFXLEtBQVg7QUFDQSxFQUFBQSxnREFBQTtBQUNBLEVBQUFBLGdEQUFBO0FBSGlCLFNBQUFBO0FBQUEsR0FBQTtBQWFYLFNBQVMsU0FBUyxLQUFzRDtBQUM5RSxRQUFNLFNBQVM7QUFFZixTQUFPLENBQUMsQ0FBQyxVQUFVLE9BQU8sT0FBTyxNQUFNLFlBQVksT0FBTyxPQUFPLE1BQU07QUFDeEU7QUFFTyxJQUFXLGtCQUFYLGtCQUFXQyxxQkFBWDtBQUNOLEVBQUFBLGtDQUFBO0FBQU0sRUFBQUEsa0NBQUE7QUFEVyxTQUFBQTtBQUFBLEdBQUE7QUFJWCxJQUFXLGlCQUFYLGtCQUFXQyxvQkFBWDtBQUNOLEVB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LEtBQUssU0FBUyxHQUFHO0FBQy9FLGFBQUssS0FBSztBQUFBLE1BQ1g7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVMsVUFBZ0I7QUFDeEIsU0FBSyxLQUFLO0FBRVYsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUNEO0FBOVBhLGFBRVksbUJBQW1CLENBQUMsU0FBUyxXQUFXLFNBQVMsTUFBTTtBQUZuRSxhQUdZLHFCQUFxQixDQUFDLE9BQU87QUFIL0MsSUFBTSxjQUFOO0FBZ1FQLE1BQU07QUFBQTtBQUFBLEVBQTRCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7IiwKICAibmFtZXMiOiBbIkNvbnRleHRWaWV3RE9NUG9zaXRpb24iLCAiQW5jaG9yQWxpZ25tZW50IiwgIkFuY2hvclBvc2l0aW9uIiwgIkFuY2hvckF4aXNBbGlnbm1lbnQiLCAiTGF5b3V0QW5jaG9yUG9zaXRpb24iLCAiTGF5b3V0QW5jaG9yTW9kZSJdCn0K
