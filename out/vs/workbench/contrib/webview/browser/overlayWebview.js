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
import { getWindowById } from "../../../../base/browser/dom.js";
import { FastDomNode } from "../../../../base/browser/fastDomNode.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { IWebviewService, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_ENABLED, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_VISIBLE } from "./webview.js";
let OverlayWebview = class extends Disposable {
  constructor(initInfo, _layoutService, _webviewService, _baseContextKeyService) {
    super();
    this._layoutService = _layoutService;
    this._webviewService = _webviewService;
    this._baseContextKeyService = _baseContextKeyService;
    this._isFirstLoad = true;
    this._firstLoadPendingMessages = /* @__PURE__ */ new Set();
    this._webview = this._register(new MutableDisposable());
    this._webviewEvents = this._register(new DisposableStore());
    this._html = "";
    this._initialScrollProgress = 0;
    this._state = void 0;
    this._owner = void 0;
    this._windowId = void 0;
    this._scopedContextKeyService = this._register(new MutableDisposable());
    this._shouldShowFindWidgetOnRestore = false;
    this._isDisposed = false;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._onDidClickLink = this._register(new Emitter());
    this.onDidClickLink = this._onDidClickLink.event;
    this._onDidReload = this._register(new Emitter());
    this.onDidReload = this._onDidReload.event;
    this._onDidScroll = this._register(new Emitter());
    this.onDidScroll = this._onDidScroll.event;
    this._onDidUpdateState = this._register(new Emitter());
    this.onDidUpdateState = this._onDidUpdateState.event;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onMissingCsp = this._register(new Emitter());
    this.onMissingCsp = this._onMissingCsp.event;
    this._onDidWheel = this._register(new Emitter());
    this.onDidWheel = this._onDidWheel.event;
    this._onFatalError = this._register(new Emitter());
    this.onFatalError = this._onFatalError.event;
    this.providedViewType = initInfo.providedViewType;
    this.origin = initInfo.origin ?? generateUuid();
    this._title = initInfo.title;
    this._extension = initInfo.extension;
    this._options = initInfo.options;
    this._contentOptions = initInfo.contentOptions;
  }
  get window() {
    return getWindowById(this._windowId, true).window;
  }
  get isFocused() {
    return !!this._webview.value?.isFocused;
  }
  dispose() {
    this._isDisposed = true;
    this._container?.domNode.remove();
    this._container = void 0;
    for (const msg of this._firstLoadPendingMessages) {
      msg.resolve(false);
    }
    this._firstLoadPendingMessages.clear();
    this._onDidDispose.fire();
    super.dispose();
  }
  get container() {
    if (this._isDisposed) {
      throw new Error(`OverlayWebview has been disposed`);
    }
    if (!this._container) {
      const node = document.createElement("div");
      node.style.position = "absolute";
      node.style.overflow = "hidden";
      this._container = new FastDomNode(node);
      this._container.setVisibility("hidden");
      this._layoutService.getContainer(this.window).appendChild(node);
    }
    return this._container.domNode;
  }
  claim(owner, targetWindow, scopedContextKeyService) {
    if (this._isDisposed) {
      return;
    }
    const oldOwner = this._owner;
    if (this._windowId !== targetWindow.vscodeWindowId) {
      this.release(oldOwner);
      this._webview.clear();
      this._webviewEvents.clear();
      this._container?.domNode.remove();
      this._container = void 0;
    }
    this._owner = owner;
    this._windowId = targetWindow.vscodeWindowId;
    this._show(targetWindow);
    if (oldOwner !== owner) {
      const contextKeyService = scopedContextKeyService || this._baseContextKeyService;
      this._scopedContextKeyService.clear();
      this._scopedContextKeyService.value = contextKeyService.createScoped(this.container);
      const wasFindVisible = this._findWidgetVisible?.get();
      this._findWidgetVisible?.reset();
      this._findWidgetVisible = KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_VISIBLE.bindTo(contextKeyService);
      this._findWidgetVisible.set(!!wasFindVisible);
      this._findWidgetEnabled?.reset();
      this._findWidgetEnabled = KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_ENABLED.bindTo(contextKeyService);
      this._findWidgetEnabled.set(!!this.options.enableFindWidget);
      this._webview.value?.setContextKeyService(this._scopedContextKeyService.value);
    }
  }
  release(owner) {
    if (this._owner !== owner) {
      return;
    }
    this._scopedContextKeyService.clear();
    this._owner = void 0;
    if (this._container) {
      this._container.setVisibility("hidden");
    }
    if (this._options.retainContextWhenHidden) {
      this._shouldShowFindWidgetOnRestore = !!this._findWidgetVisible?.get();
      this.hideFind(false);
    } else {
      this._webview.clear();
      this._webviewEvents.clear();
    }
  }
  layoutWebviewOverElement(element, dimension, clippingContainer) {
    if (!this._container || !this._container.domNode.parentElement) {
      return;
    }
    const whenContainerStylesLoaded = this._layoutService.whenContainerStylesLoaded(this.window);
    if (whenContainerStylesLoaded) {
      whenContainerStylesLoaded.then(() => this.doLayoutWebviewOverElement(element, dimension, clippingContainer));
    } else {
      this.doLayoutWebviewOverElement(element, dimension, clippingContainer);
    }
  }
  doLayoutWebviewOverElement(element, dimension, clippingContainer) {
    if (!this._container || !this._container.domNode.parentElement) {
      return;
    }
    const frameRect = element.getBoundingClientRect();
    const containerRect = this._container.domNode.parentElement.getBoundingClientRect();
    const parentBorderTop = (containerRect.height - this._container.domNode.parentElement.clientHeight) / 2;
    const parentBorderLeft = (containerRect.width - this._container.domNode.parentElement.clientWidth) / 2;
    this._container.setTop(frameRect.top - containerRect.top - parentBorderTop);
    this._container.setLeft(frameRect.left - containerRect.left - parentBorderLeft);
    this._container.setWidth(dimension ? dimension.width : frameRect.width);
    this._container.setHeight(dimension ? dimension.height : frameRect.height);
    if (clippingContainer) {
      const { top, left, right, bottom } = computeClippingRect(frameRect, clippingContainer);
      this._container.domNode.style.clipPath = `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`;
    }
  }
  _show(targetWindow) {
    if (this._isDisposed) {
      throw new Error("OverlayWebview is disposed");
    }
    if (!this._webview.value) {
      const webview = this._webviewService.createWebviewElement({
        providedViewType: this.providedViewType,
        origin: this.origin,
        title: this._title,
        options: this._options,
        contentOptions: this._contentOptions,
        extension: this.extension
      });
      this._webview.value = webview;
      webview.state = this._state;
      if (this._scopedContextKeyService.value) {
        this._webview.value.setContextKeyService(this._scopedContextKeyService.value);
      }
      if (this._html) {
        webview.setHtml(this._html);
      }
      if (this._options.tryRestoreScrollPosition) {
        webview.initialScrollProgress = this._initialScrollProgress;
      }
      this._findWidgetEnabled?.set(!!this.options.enableFindWidget);
      webview.mountTo(this.container, targetWindow);
      this._webviewEvents.clear();
      this._webviewEvents.add(webview.onDidFocus(() => {
        this._onDidFocus.fire();
      }));
      this._webviewEvents.add(webview.onDidBlur(() => {
        this._onDidBlur.fire();
      }));
      this._webviewEvents.add(webview.onDidClickLink((x) => {
        this._onDidClickLink.fire(x);
      }));
      this._webviewEvents.add(webview.onMessage((x) => {
        this._onMessage.fire(x);
      }));
      this._webviewEvents.add(webview.onMissingCsp((x) => {
        this._onMissingCsp.fire(x);
      }));
      this._webviewEvents.add(webview.onDidWheel((x) => {
        this._onDidWheel.fire(x);
      }));
      this._webviewEvents.add(webview.onDidReload(() => {
        this._onDidReload.fire();
      }));
      this._webviewEvents.add(webview.onFatalError((x) => {
        this._onFatalError.fire(x);
      }));
      this._webviewEvents.add(webview.onDidScroll((x) => {
        this._initialScrollProgress = x.scrollYPercentage;
        this._onDidScroll.fire(x);
      }));
      this._webviewEvents.add(webview.onDidUpdateState((state) => {
        this._state = state;
        this._onDidUpdateState.fire(state);
      }));
      if (this._isFirstLoad) {
        this._firstLoadPendingMessages.forEach(async (msg) => {
          msg.resolve(await webview.postMessage(msg.message, msg.transfer));
        });
      }
      this._isFirstLoad = false;
      this._firstLoadPendingMessages.clear();
    }
    if (this.options.retainContextWhenHidden && this._shouldShowFindWidgetOnRestore) {
      this.showFind(false);
      this._shouldShowFindWidgetOnRestore = false;
    }
    this._container?.setVisibility("visible");
  }
  setHtml(html) {
    this._html = html;
    this._withWebview((webview) => webview.setHtml(html));
  }
  setTitle(title) {
    this._title = title;
    this._withWebview((webview) => webview.setTitle(title));
  }
  get initialScrollProgress() {
    return this._initialScrollProgress;
  }
  set initialScrollProgress(value) {
    this._initialScrollProgress = value;
    this._withWebview((webview) => webview.initialScrollProgress = value);
  }
  get state() {
    return this._state;
  }
  set state(value) {
    this._state = value;
    this._withWebview((webview) => webview.state = value);
  }
  get extension() {
    return this._extension;
  }
  set extension(value) {
    this._extension = value;
    this._withWebview((webview) => webview.extension = value);
  }
  get options() {
    return this._options;
  }
  set options(value) {
    this._options = { customClasses: this._options.customClasses, ...value };
  }
  get contentOptions() {
    return this._contentOptions;
  }
  set contentOptions(value) {
    this._contentOptions = value;
    this._withWebview((webview) => webview.contentOptions = value);
  }
  set localResourcesRoot(resources) {
    this._withWebview((webview) => webview.localResourcesRoot = resources);
  }
  async postMessage(message, transfer) {
    if (this._webview.value) {
      return this._webview.value.postMessage(message, transfer);
    }
    if (this._isFirstLoad) {
      let resolve;
      const p = new Promise((r) => resolve = r);
      this._firstLoadPendingMessages.add({ message, transfer, resolve });
      return p;
    }
    return false;
  }
  focus() {
    this._webview.value?.focus();
  }
  reload() {
    this._webview.value?.reload();
  }
  selectAll() {
    this._webview.value?.selectAll();
  }
  copy() {
    this._webview.value?.copy();
  }
  paste() {
    this._webview.value?.paste();
  }
  cut() {
    this._webview.value?.cut();
  }
  undo() {
    this._webview.value?.undo();
  }
  redo() {
    this._webview.value?.redo();
  }
  showFind(animated = true) {
    if (this._webview.value) {
      this._webview.value.showFind(animated);
      this._findWidgetVisible?.set(true);
    }
  }
  hideFind(animated = true) {
    this._findWidgetVisible?.reset();
    this._webview.value?.hideFind(animated);
  }
  runFindAction(previous) {
    this._webview.value?.runFindAction(previous);
  }
  _withWebview(f) {
    if (this._webview.value) {
      f(this._webview.value);
    }
  }
  windowDidDragStart() {
    this._webview.value?.windowDidDragStart();
  }
  windowDidDragEnd() {
    this._webview.value?.windowDidDragEnd();
  }
  setContextKeyService(contextKeyService) {
    this._webview.value?.setContextKeyService(contextKeyService);
  }
};
OverlayWebview = __decorateClass([
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, IWebviewService),
  __decorateParam(3, IContextKeyService)
], OverlayWebview);
function computeClippingRect(frameRect, clipper) {
  const rootRect = clipper.getBoundingClientRect();
  const top = Math.max(rootRect.top - frameRect.top, 0);
  const right = Math.max(frameRect.width - (frameRect.right - rootRect.right), 0);
  const bottom = Math.max(frameRect.height - (frameRect.bottom - rootRect.bottom), 0);
  const left = Math.max(rootRect.left - frameRect.left, 0);
  return { top, right, bottom, left };
}
export {
  OverlayWebview
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWJ2aWV3L2Jyb3dzZXIvb3ZlcmxheVdlYnZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaW1lbnNpb24sIGdldFdpbmRvd0J5SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEZhc3REb21Ob2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Zhc3REb21Ob2RlLmpzJztcbmltcG9ydCB7IElNb3VzZVdoZWVsRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBDb2RlV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBJU2NvcGVkQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJT3ZlcmxheVdlYnZpZXcsIElXZWJ2aWV3LCBJV2Vidmlld0VsZW1lbnQsIElXZWJ2aWV3U2VydmljZSwgS0VZQklORElOR19DT05URVhUX1dFQlZJRVdfRklORF9XSURHRVRfRU5BQkxFRCwgS0VZQklORElOR19DT05URVhUX1dFQlZJRVdfRklORF9XSURHRVRfVklTSUJMRSwgV2Vidmlld0NvbnRlbnRPcHRpb25zLCBXZWJ2aWV3RXh0ZW5zaW9uRGVzY3JpcHRpb24sIFdlYnZpZXdJbml0SW5mbywgV2Vidmlld01lc3NhZ2VSZWNlaXZlZEV2ZW50LCBXZWJ2aWV3T3B0aW9ucyB9IGZyb20gJy4vd2Vidmlldy5qcyc7XG5cbi8qKlxuICogV2VidmlldyB0aGF0IGlzIGFic29sdXRlbHkgcG9zaXRpb25lZCBvdmVyIGFub3RoZXIgZWxlbWVudCBhbmQgdGhhdCBjYW4gY3JlYXRlcyBhbmQgZGVzdHJveXMgYW4gdW5kZXJseWluZyB3ZWJ2aWV3IGFzIG5lZWRlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIE92ZXJsYXlXZWJ2aWV3IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElPdmVybGF5V2VidmlldyB7XG5cblx0cHJpdmF0ZSBfaXNGaXJzdExvYWQgPSB0cnVlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9maXJzdExvYWRQZW5kaW5nTWVzc2FnZXMgPSBuZXcgU2V0PHsgcmVhZG9ubHkgbWVzc2FnZTogYW55OyByZWFkb25seSB0cmFuc2Zlcj86IHJlYWRvbmx5IEFycmF5QnVmZmVyW107IHJlYWRvbmx5IHJlc29sdmU6ICh2YWx1ZTogYm9vbGVhbikgPT4gdm9pZCB9PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF93ZWJ2aWV3ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElXZWJ2aWV3RWxlbWVudD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3dlYnZpZXdFdmVudHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdHByaXZhdGUgX2h0bWwgPSAnJztcblx0cHJpdmF0ZSBfdGl0bGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfaW5pdGlhbFNjcm9sbFByb2dyZXNzOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF9zdGF0ZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX2V4dGVuc2lvbjogV2Vidmlld0V4dGVuc2lvbkRlc2NyaXB0aW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jb250ZW50T3B0aW9uczogV2Vidmlld0NvbnRlbnRPcHRpb25zO1xuXHRwcml2YXRlIF9vcHRpb25zOiBXZWJ2aWV3T3B0aW9ucztcblxuXHRwcml2YXRlIF9vd25lcjogYW55ID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX3dpbmRvd0lkOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZ2V0IHdpbmRvdygpIHsgcmV0dXJuIGdldFdpbmRvd0J5SWQodGhpcy5fd2luZG93SWQsIHRydWUpLndpbmRvdzsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElTY29wZWRDb250ZXh0S2V5U2VydmljZT4oKSk7XG5cdHByaXZhdGUgX2ZpbmRXaWRnZXRWaXNpYmxlOiBJQ29udGV4dEtleTxib29sZWFuPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZmluZFdpZGdldEVuYWJsZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9zaG91bGRTaG93RmluZFdpZGdldE9uUmVzdG9yZSA9IGZhbHNlO1xuXG5cdHB1YmxpYyByZWFkb25seSBwcm92aWRlZFZpZXdUeXBlPzogc3RyaW5nO1xuXG5cdHB1YmxpYyBvcmlnaW46IHN0cmluZztcblxuXHRwcml2YXRlIF9jb250YWluZXI6IEZhc3REb21Ob2RlPEhUTUxEaXZFbGVtZW50PiB8IHVuZGVmaW5lZDtcblxuXHRwdWJsaWMgY29uc3RydWN0b3IoXG5cdFx0aW5pdEluZm86IFdlYnZpZXdJbml0SW5mbyxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElXZWJ2aWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93ZWJ2aWV3U2VydmljZTogSVdlYnZpZXdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYmFzZUNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucHJvdmlkZWRWaWV3VHlwZSA9IGluaXRJbmZvLnByb3ZpZGVkVmlld1R5cGU7XG5cdFx0dGhpcy5vcmlnaW4gPSBpbml0SW5mby5vcmlnaW4gPz8gZ2VuZXJhdGVVdWlkKCk7XG5cblx0XHR0aGlzLl90aXRsZSA9IGluaXRJbmZvLnRpdGxlO1xuXHRcdHRoaXMuX2V4dGVuc2lvbiA9IGluaXRJbmZvLmV4dGVuc2lvbjtcblx0XHR0aGlzLl9vcHRpb25zID0gaW5pdEluZm8ub3B0aW9ucztcblx0XHR0aGlzLl9jb250ZW50T3B0aW9ucyA9IGluaXRJbmZvLmNvbnRlbnRPcHRpb25zO1xuXHR9XG5cblx0cHVibGljIGdldCBpc0ZvY3VzZWQoKSB7XG5cdFx0cmV0dXJuICEhdGhpcy5fd2Vidmlldy52YWx1ZT8uaXNGb2N1c2VkO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNEaXNwb3NlZCA9IGZhbHNlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWREaXNwb3NlID0gdGhpcy5fb25EaWREaXNwb3NlLmV2ZW50O1xuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cblx0XHR0aGlzLl9jb250YWluZXI/LmRvbU5vZGUucmVtb3ZlKCk7XG5cdFx0dGhpcy5fY29udGFpbmVyID0gdW5kZWZpbmVkO1xuXG5cdFx0Zm9yIChjb25zdCBtc2cgb2YgdGhpcy5fZmlyc3RMb2FkUGVuZGluZ01lc3NhZ2VzKSB7XG5cdFx0XHRtc2cucmVzb2x2ZShmYWxzZSk7XG5cdFx0fVxuXHRcdHRoaXMuX2ZpcnN0TG9hZFBlbmRpbmdNZXNzYWdlcy5jbGVhcigpO1xuXG5cdFx0dGhpcy5fb25EaWREaXNwb3NlLmZpcmUoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgY29udGFpbmVyKCk6IEhUTUxFbGVtZW50IHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBPdmVybGF5V2VidmlldyBoYXMgYmVlbiBkaXNwb3NlZGApO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fY29udGFpbmVyKSB7XG5cdFx0XHRjb25zdCBub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRub2RlLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRcdG5vZGUuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcblx0XHRcdHRoaXMuX2NvbnRhaW5lciA9IG5ldyBGYXN0RG9tTm9kZShub2RlKTtcblx0XHRcdHRoaXMuX2NvbnRhaW5lci5zZXRWaXNpYmlsaXR5KCdoaWRkZW4nKTtcblxuXHRcdFx0Ly8gV2Vidmlld3MgY2Fubm90IGJlIHJlcGFyZW50ZWQgaW4gdGhlIGRvbSBhcyBpdCB3aWxsIGRlc3Ryb3kgdGhlaXIgY29udGVudHMuXG5cdFx0XHQvLyBNb3VudCB0aGVtIHRvIGEgaGlnaCBsZXZlbCBub2RlIHRvIGF2b2lkIHRoaXMuXG5cdFx0XHR0aGlzLl9sYXlvdXRTZXJ2aWNlLmdldENvbnRhaW5lcih0aGlzLndpbmRvdykuYXBwZW5kQ2hpbGQobm9kZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRhaW5lci5kb21Ob2RlO1xuXHR9XG5cblx0cHVibGljIGNsYWltKG93bmVyOiBhbnksIHRhcmdldFdpbmRvdzogQ29kZVdpbmRvdywgc2NvcGVkQ29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb2xkT3duZXIgPSB0aGlzLl9vd25lcjtcblxuXHRcdGlmICh0aGlzLl93aW5kb3dJZCAhPT0gdGFyZ2V0V2luZG93LnZzY29kZVdpbmRvd0lkKSB7XG5cdFx0XHQvLyBtb3ZpbmcgdG8gYSBuZXcgd2luZG93XG5cdFx0XHR0aGlzLnJlbGVhc2Uob2xkT3duZXIpO1xuXHRcdFx0Ly8gc2luY2Ugd2UgYXJlIG1vdmluZyB0byBhIG5ldyB3aW5kb3csIHdlIG5lZWQgdG8gZGlzcG9zZSB0aGUgd2VidmlldyBhbmQgcmVjcmVhdGVcblx0XHRcdHRoaXMuX3dlYnZpZXcuY2xlYXIoKTtcblx0XHRcdHRoaXMuX3dlYnZpZXdFdmVudHMuY2xlYXIoKTtcblx0XHRcdHRoaXMuX2NvbnRhaW5lcj8uZG9tTm9kZS5yZW1vdmUoKTtcblx0XHRcdHRoaXMuX2NvbnRhaW5lciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLl9vd25lciA9IG93bmVyO1xuXHRcdHRoaXMuX3dpbmRvd0lkID0gdGFyZ2V0V2luZG93LnZzY29kZVdpbmRvd0lkO1xuXHRcdHRoaXMuX3Nob3codGFyZ2V0V2luZG93KTtcblxuXHRcdGlmIChvbGRPd25lciAhPT0gb3duZXIpIHtcblx0XHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gKHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlIHx8IHRoaXMuX2Jhc2VDb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRcdC8vIEV4cGxpY2l0bHkgY2xlYXIgYmVmb3JlIGNyZWF0aW5nIHRoZSBuZXcgY29udGV4dC5cblx0XHRcdC8vIE90aGVyd2lzZSB3ZSBjcmVhdGUgdGhlIG5ldyBjb250ZXh0IHdoaWxlIHRoZSBvbGQgb25lIGlzIHN0aWxsIGFyb3VuZFxuXHRcdFx0dGhpcy5fc2NvcGVkQ29udGV4dEtleVNlcnZpY2UuY2xlYXIoKTtcblx0XHRcdHRoaXMuX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlLnZhbHVlID0gY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuY29udGFpbmVyKTtcblxuXHRcdFx0Y29uc3Qgd2FzRmluZFZpc2libGUgPSB0aGlzLl9maW5kV2lkZ2V0VmlzaWJsZT8uZ2V0KCk7XG5cdFx0XHR0aGlzLl9maW5kV2lkZ2V0VmlzaWJsZT8ucmVzZXQoKTtcblx0XHRcdHRoaXMuX2ZpbmRXaWRnZXRWaXNpYmxlID0gS0VZQklORElOR19DT05URVhUX1dFQlZJRVdfRklORF9XSURHRVRfVklTSUJMRS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5fZmluZFdpZGdldFZpc2libGUuc2V0KCEhd2FzRmluZFZpc2libGUpO1xuXG5cdFx0XHR0aGlzLl9maW5kV2lkZ2V0RW5hYmxlZD8ucmVzZXQoKTtcblx0XHRcdHRoaXMuX2ZpbmRXaWRnZXRFbmFibGVkID0gS0VZQklORElOR19DT05URVhUX1dFQlZJRVdfRklORF9XSURHRVRfRU5BQkxFRC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5fZmluZFdpZGdldEVuYWJsZWQuc2V0KCEhdGhpcy5vcHRpb25zLmVuYWJsZUZpbmRXaWRnZXQpO1xuXG5cdFx0XHR0aGlzLl93ZWJ2aWV3LnZhbHVlPy5zZXRDb250ZXh0S2V5U2VydmljZSh0aGlzLl9zY29wZWRDb250ZXh0S2V5U2VydmljZS52YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlbGVhc2Uob3duZXI6IGFueSkge1xuXHRcdGlmICh0aGlzLl9vd25lciAhPT0gb3duZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9zY29wZWRDb250ZXh0S2V5U2VydmljZS5jbGVhcigpO1xuXG5cdFx0dGhpcy5fb3duZXIgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHRoaXMuX2NvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5fY29udGFpbmVyLnNldFZpc2liaWxpdHkoJ2hpZGRlbicpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9vcHRpb25zLnJldGFpbkNvbnRleHRXaGVuSGlkZGVuKSB7XG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTU3NDI0XG5cdFx0XHQvLyBXZSBuZWVkIHRvIHJlY29yZCB0aGUgY3VycmVudCBzdGF0ZSB3aGVuIHJldGFpbmluZyBjb250ZXh0IHNvIHdlIGNhbiB0cnkgdG8gc2hvd0ZpbmQoKSB3aGVuIHNob3dpbmcgd2VidmlldyBhZ2FpblxuXHRcdFx0dGhpcy5fc2hvdWxkU2hvd0ZpbmRXaWRnZXRPblJlc3RvcmUgPSAhIXRoaXMuX2ZpbmRXaWRnZXRWaXNpYmxlPy5nZXQoKTtcblx0XHRcdHRoaXMuaGlkZUZpbmQoZmFsc2UpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3LmNsZWFyKCk7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3RXZlbnRzLmNsZWFyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGxheW91dFdlYnZpZXdPdmVyRWxlbWVudChlbGVtZW50OiBIVE1MRWxlbWVudCwgZGltZW5zaW9uPzogRGltZW5zaW9uLCBjbGlwcGluZ0NvbnRhaW5lcj86IEhUTUxFbGVtZW50KSB7XG5cdFx0aWYgKCF0aGlzLl9jb250YWluZXIgfHwgIXRoaXMuX2NvbnRhaW5lci5kb21Ob2RlLnBhcmVudEVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB3aGVuQ29udGFpbmVyU3R5bGVzTG9hZGVkID0gdGhpcy5fbGF5b3V0U2VydmljZS53aGVuQ29udGFpbmVyU3R5bGVzTG9hZGVkKHRoaXMud2luZG93KTtcblx0XHRpZiAod2hlbkNvbnRhaW5lclN0eWxlc0xvYWRlZCkge1xuXHRcdFx0Ly8gSW4gZmxvYXRpbmcgd2luZG93cywgd2UgbmVlZCB0byBlbnN1cmUgdGhhdCB0aGVcblx0XHRcdC8vIGNvbnRhaW5lciBpcyByZWFkeSBmb3IgdXMgdG8gY29tcHV0ZSBjZXJ0YWluXG5cdFx0XHQvLyBsYXlvdXQgcmVsYXRlZCBwcm9wZXJ0aWVzLlxuXHRcdFx0d2hlbkNvbnRhaW5lclN0eWxlc0xvYWRlZC50aGVuKCgpID0+IHRoaXMuZG9MYXlvdXRXZWJ2aWV3T3ZlckVsZW1lbnQoZWxlbWVudCwgZGltZW5zaW9uLCBjbGlwcGluZ0NvbnRhaW5lcikpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRvTGF5b3V0V2Vidmlld092ZXJFbGVtZW50KGVsZW1lbnQsIGRpbWVuc2lvbiwgY2xpcHBpbmdDb250YWluZXIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9MYXlvdXRXZWJ2aWV3T3ZlckVsZW1lbnQoZWxlbWVudDogSFRNTEVsZW1lbnQsIGRpbWVuc2lvbj86IERpbWVuc2lvbiwgY2xpcHBpbmdDb250YWluZXI/OiBIVE1MRWxlbWVudCkge1xuXHRcdGlmICghdGhpcy5fY29udGFpbmVyIHx8ICF0aGlzLl9jb250YWluZXIuZG9tTm9kZS5wYXJlbnRFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZnJhbWVSZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRjb25zdCBjb250YWluZXJSZWN0ID0gdGhpcy5fY29udGFpbmVyLmRvbU5vZGUucGFyZW50RWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRjb25zdCBwYXJlbnRCb3JkZXJUb3AgPSAoY29udGFpbmVyUmVjdC5oZWlnaHQgLSB0aGlzLl9jb250YWluZXIuZG9tTm9kZS5wYXJlbnRFbGVtZW50LmNsaWVudEhlaWdodCkgLyAyLjA7XG5cdFx0Y29uc3QgcGFyZW50Qm9yZGVyTGVmdCA9IChjb250YWluZXJSZWN0LndpZHRoIC0gdGhpcy5fY29udGFpbmVyLmRvbU5vZGUucGFyZW50RWxlbWVudC5jbGllbnRXaWR0aCkgLyAyLjA7XG5cblx0XHR0aGlzLl9jb250YWluZXIuc2V0VG9wKGZyYW1lUmVjdC50b3AgLSBjb250YWluZXJSZWN0LnRvcCAtIHBhcmVudEJvcmRlclRvcCk7XG5cdFx0dGhpcy5fY29udGFpbmVyLnNldExlZnQoZnJhbWVSZWN0LmxlZnQgLSBjb250YWluZXJSZWN0LmxlZnQgLSBwYXJlbnRCb3JkZXJMZWZ0KTtcblx0XHR0aGlzLl9jb250YWluZXIuc2V0V2lkdGgoZGltZW5zaW9uID8gZGltZW5zaW9uLndpZHRoIDogZnJhbWVSZWN0LndpZHRoKTtcblx0XHR0aGlzLl9jb250YWluZXIuc2V0SGVpZ2h0KGRpbWVuc2lvbiA/IGRpbWVuc2lvbi5oZWlnaHQgOiBmcmFtZVJlY3QuaGVpZ2h0KTtcblxuXHRcdGlmIChjbGlwcGluZ0NvbnRhaW5lcikge1xuXHRcdFx0Y29uc3QgeyB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20gfSA9IGNvbXB1dGVDbGlwcGluZ1JlY3QoZnJhbWVSZWN0LCBjbGlwcGluZ0NvbnRhaW5lcik7XG5cdFx0XHR0aGlzLl9jb250YWluZXIuZG9tTm9kZS5zdHlsZS5jbGlwUGF0aCA9IGBwb2x5Z29uKCR7bGVmdH1weCAke3RvcH1weCwgJHtyaWdodH1weCAke3RvcH1weCwgJHtyaWdodH1weCAke2JvdHRvbX1weCwgJHtsZWZ0fXB4ICR7Ym90dG9tfXB4KWA7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2hvdyh0YXJnZXRXaW5kb3c6IENvZGVXaW5kb3cpIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdPdmVybGF5V2VidmlldyBpcyBkaXNwb3NlZCcpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fd2Vidmlldy52YWx1ZSkge1xuXHRcdFx0Y29uc3Qgd2VidmlldyA9IHRoaXMuX3dlYnZpZXdTZXJ2aWNlLmNyZWF0ZVdlYnZpZXdFbGVtZW50KHtcblx0XHRcdFx0cHJvdmlkZWRWaWV3VHlwZTogdGhpcy5wcm92aWRlZFZpZXdUeXBlLFxuXHRcdFx0XHRvcmlnaW46IHRoaXMub3JpZ2luLFxuXHRcdFx0XHR0aXRsZTogdGhpcy5fdGl0bGUsXG5cdFx0XHRcdG9wdGlvbnM6IHRoaXMuX29wdGlvbnMsXG5cdFx0XHRcdGNvbnRlbnRPcHRpb25zOiB0aGlzLl9jb250ZW50T3B0aW9ucyxcblx0XHRcdFx0ZXh0ZW5zaW9uOiB0aGlzLmV4dGVuc2lvbixcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fd2Vidmlldy52YWx1ZSA9IHdlYnZpZXc7XG5cdFx0XHR3ZWJ2aWV3LnN0YXRlID0gdGhpcy5fc3RhdGU7XG5cblx0XHRcdGlmICh0aGlzLl9zY29wZWRDb250ZXh0S2V5U2VydmljZS52YWx1ZSkge1xuXHRcdFx0XHR0aGlzLl93ZWJ2aWV3LnZhbHVlLnNldENvbnRleHRLZXlTZXJ2aWNlKHRoaXMuX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlLnZhbHVlKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2h0bWwpIHtcblx0XHRcdFx0d2Vidmlldy5zZXRIdG1sKHRoaXMuX2h0bWwpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fb3B0aW9ucy50cnlSZXN0b3JlU2Nyb2xsUG9zaXRpb24pIHtcblx0XHRcdFx0d2Vidmlldy5pbml0aWFsU2Nyb2xsUHJvZ3Jlc3MgPSB0aGlzLl9pbml0aWFsU2Nyb2xsUHJvZ3Jlc3M7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2ZpbmRXaWRnZXRFbmFibGVkPy5zZXQoISF0aGlzLm9wdGlvbnMuZW5hYmxlRmluZFdpZGdldCk7XG5cblx0XHRcdHdlYnZpZXcubW91bnRUbyh0aGlzLmNvbnRhaW5lciwgdGFyZ2V0V2luZG93KTtcblxuXHRcdFx0Ly8gRm9yd2FyZCBldmVudHMgZnJvbSBpbm5lciB3ZWJ2aWV3IHRvIG91dGVyIGxpc3RlbmVyc1xuXHRcdFx0dGhpcy5fd2Vidmlld0V2ZW50cy5jbGVhcigpO1xuXHRcdFx0dGhpcy5fd2Vidmlld0V2ZW50cy5hZGQod2Vidmlldy5vbkRpZEZvY3VzKCgpID0+IHsgdGhpcy5fb25EaWRGb2N1cy5maXJlKCk7IH0pKTtcblx0XHRcdHRoaXMuX3dlYnZpZXdFdmVudHMuYWRkKHdlYnZpZXcub25EaWRCbHVyKCgpID0+IHsgdGhpcy5fb25EaWRCbHVyLmZpcmUoKTsgfSkpO1xuXHRcdFx0dGhpcy5fd2Vidmlld0V2ZW50cy5hZGQod2Vidmlldy5vbkRpZENsaWNrTGluayh4ID0+IHsgdGhpcy5fb25EaWRDbGlja0xpbmsuZmlyZSh4KTsgfSkpO1xuXHRcdFx0dGhpcy5fd2Vidmlld0V2ZW50cy5hZGQod2Vidmlldy5vbk1lc3NhZ2UoeCA9PiB7IHRoaXMuX29uTWVzc2FnZS5maXJlKHgpOyB9KSk7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3RXZlbnRzLmFkZCh3ZWJ2aWV3Lm9uTWlzc2luZ0NzcCh4ID0+IHsgdGhpcy5fb25NaXNzaW5nQ3NwLmZpcmUoeCk7IH0pKTtcblx0XHRcdHRoaXMuX3dlYnZpZXdFdmVudHMuYWRkKHdlYnZpZXcub25EaWRXaGVlbCh4ID0+IHsgdGhpcy5fb25EaWRXaGVlbC5maXJlKHgpOyB9KSk7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3RXZlbnRzLmFkZCh3ZWJ2aWV3Lm9uRGlkUmVsb2FkKCgpID0+IHsgdGhpcy5fb25EaWRSZWxvYWQuZmlyZSgpOyB9KSk7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3RXZlbnRzLmFkZCh3ZWJ2aWV3Lm9uRmF0YWxFcnJvcih4ID0+IHsgdGhpcy5fb25GYXRhbEVycm9yLmZpcmUoeCk7IH0pKTtcblxuXHRcdFx0dGhpcy5fd2Vidmlld0V2ZW50cy5hZGQod2Vidmlldy5vbkRpZFNjcm9sbCh4ID0+IHtcblx0XHRcdFx0dGhpcy5faW5pdGlhbFNjcm9sbFByb2dyZXNzID0geC5zY3JvbGxZUGVyY2VudGFnZTtcblx0XHRcdFx0dGhpcy5fb25EaWRTY3JvbGwuZmlyZSh4KTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fd2Vidmlld0V2ZW50cy5hZGQod2Vidmlldy5vbkRpZFVwZGF0ZVN0YXRlKHN0YXRlID0+IHtcblx0XHRcdFx0dGhpcy5fc3RhdGUgPSBzdGF0ZTtcblx0XHRcdFx0dGhpcy5fb25EaWRVcGRhdGVTdGF0ZS5maXJlKHN0YXRlKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0aWYgKHRoaXMuX2lzRmlyc3RMb2FkKSB7XG5cdFx0XHRcdHRoaXMuX2ZpcnN0TG9hZFBlbmRpbmdNZXNzYWdlcy5mb3JFYWNoKGFzeW5jIG1zZyA9PiB7XG5cdFx0XHRcdFx0bXNnLnJlc29sdmUoYXdhaXQgd2Vidmlldy5wb3N0TWVzc2FnZShtc2cubWVzc2FnZSwgbXNnLnRyYW5zZmVyKSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5faXNGaXJzdExvYWQgPSBmYWxzZTtcblx0XHRcdHRoaXMuX2ZpcnN0TG9hZFBlbmRpbmdNZXNzYWdlcy5jbGVhcigpO1xuXHRcdH1cblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNTc0MjRcblx0XHRpZiAodGhpcy5vcHRpb25zLnJldGFpbkNvbnRleHRXaGVuSGlkZGVuICYmIHRoaXMuX3Nob3VsZFNob3dGaW5kV2lkZ2V0T25SZXN0b3JlKSB7XG5cdFx0XHR0aGlzLnNob3dGaW5kKGZhbHNlKTtcblx0XHRcdC8vIFJlc2V0XG5cdFx0XHR0aGlzLl9zaG91bGRTaG93RmluZFdpZGdldE9uUmVzdG9yZSA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMuX2NvbnRhaW5lcj8uc2V0VmlzaWJpbGl0eSgndmlzaWJsZScpO1xuXHR9XG5cblx0cHVibGljIHNldEh0bWwoaHRtbDogc3RyaW5nKSB7XG5cdFx0dGhpcy5faHRtbCA9IGh0bWw7XG5cdFx0dGhpcy5fd2l0aFdlYnZpZXcod2VidmlldyA9PiB3ZWJ2aWV3LnNldEh0bWwoaHRtbCkpO1xuXHR9XG5cblx0cHVibGljIHNldFRpdGxlKHRpdGxlOiBzdHJpbmcpIHtcblx0XHR0aGlzLl90aXRsZSA9IHRpdGxlO1xuXHRcdHRoaXMuX3dpdGhXZWJ2aWV3KHdlYnZpZXcgPT4gd2Vidmlldy5zZXRUaXRsZSh0aXRsZSkpO1xuXHR9XG5cblx0cHVibGljIGdldCBpbml0aWFsU2Nyb2xsUHJvZ3Jlc3MoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX2luaXRpYWxTY3JvbGxQcm9ncmVzczsgfVxuXHRwdWJsaWMgc2V0IGluaXRpYWxTY3JvbGxQcm9ncmVzcyh2YWx1ZTogbnVtYmVyKSB7XG5cdFx0dGhpcy5faW5pdGlhbFNjcm9sbFByb2dyZXNzID0gdmFsdWU7XG5cdFx0dGhpcy5fd2l0aFdlYnZpZXcod2VidmlldyA9PiB3ZWJ2aWV3LmluaXRpYWxTY3JvbGxQcm9ncmVzcyA9IHZhbHVlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgc3RhdGUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3N0YXRlOyB9XG5cdHB1YmxpYyBzZXQgc3RhdGUodmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX3N0YXRlID0gdmFsdWU7XG5cdFx0dGhpcy5fd2l0aFdlYnZpZXcod2VidmlldyA9PiB3ZWJ2aWV3LnN0YXRlID0gdmFsdWUpO1xuXHR9XG5cblx0cHVibGljIGdldCBleHRlbnNpb24oKTogV2Vidmlld0V4dGVuc2lvbkRlc2NyaXB0aW9uIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2V4dGVuc2lvbjsgfVxuXHRwdWJsaWMgc2V0IGV4dGVuc2lvbih2YWx1ZTogV2Vidmlld0V4dGVuc2lvbkRlc2NyaXB0aW9uIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fZXh0ZW5zaW9uID0gdmFsdWU7XG5cdFx0dGhpcy5fd2l0aFdlYnZpZXcod2VidmlldyA9PiB3ZWJ2aWV3LmV4dGVuc2lvbiA9IHZhbHVlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgb3B0aW9ucygpOiBXZWJ2aWV3T3B0aW9ucyB7IHJldHVybiB0aGlzLl9vcHRpb25zOyB9XG5cdHB1YmxpYyBzZXQgb3B0aW9ucyh2YWx1ZTogV2Vidmlld09wdGlvbnMpIHsgdGhpcy5fb3B0aW9ucyA9IHsgY3VzdG9tQ2xhc3NlczogdGhpcy5fb3B0aW9ucy5jdXN0b21DbGFzc2VzLCAuLi52YWx1ZSB9OyB9XG5cblx0cHVibGljIGdldCBjb250ZW50T3B0aW9ucygpOiBXZWJ2aWV3Q29udGVudE9wdGlvbnMgeyByZXR1cm4gdGhpcy5fY29udGVudE9wdGlvbnM7IH1cblx0cHVibGljIHNldCBjb250ZW50T3B0aW9ucyh2YWx1ZTogV2Vidmlld0NvbnRlbnRPcHRpb25zKSB7XG5cdFx0dGhpcy5fY29udGVudE9wdGlvbnMgPSB2YWx1ZTtcblx0XHR0aGlzLl93aXRoV2Vidmlldyh3ZWJ2aWV3ID0+IHdlYnZpZXcuY29udGVudE9wdGlvbnMgPSB2YWx1ZSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0IGxvY2FsUmVzb3VyY2VzUm9vdChyZXNvdXJjZXM6IFVSSVtdKSB7XG5cdFx0dGhpcy5fd2l0aFdlYnZpZXcod2VidmlldyA9PiB3ZWJ2aWV3LmxvY2FsUmVzb3VyY2VzUm9vdCA9IHJlc291cmNlcyk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZvY3VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZEZvY3VzID0gdGhpcy5fb25EaWRGb2N1cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEJsdXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQmx1ciA9IHRoaXMuX29uRGlkQmx1ci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENsaWNrTGluayA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENsaWNrTGluayA9IHRoaXMuX29uRGlkQ2xpY2tMaW5rLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVsb2FkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFJlbG9hZCA9IHRoaXMuX29uRGlkUmVsb2FkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2Nyb2xsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZWFkb25seSBzY3JvbGxZUGVyY2VudGFnZTogbnVtYmVyIH0+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRTY3JvbGwgPSB0aGlzLl9vbkRpZFNjcm9sbC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFVwZGF0ZVN0YXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nIHwgdW5kZWZpbmVkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkVXBkYXRlU3RhdGUgPSB0aGlzLl9vbkRpZFVwZGF0ZVN0YXRlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uTWVzc2FnZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFdlYnZpZXdNZXNzYWdlUmVjZWl2ZWRFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbk1lc3NhZ2UgPSB0aGlzLl9vbk1lc3NhZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25NaXNzaW5nQ3NwID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RXh0ZW5zaW9uSWRlbnRpZmllcj4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbk1pc3NpbmdDc3AgPSB0aGlzLl9vbk1pc3NpbmdDc3AuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRXaGVlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElNb3VzZVdoZWVsRXZlbnQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRXaGVlbCA9IHRoaXMuX29uRGlkV2hlZWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25GYXRhbEVycm9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZWFkb25seSBtZXNzYWdlOiBzdHJpbmcgfT4oKSk7XG5cdHB1YmxpYyBvbkZhdGFsRXJyb3IgPSB0aGlzLl9vbkZhdGFsRXJyb3IuZXZlbnQ7XG5cblx0cHVibGljIGFzeW5jIHBvc3RNZXNzYWdlKG1lc3NhZ2U6IGFueSwgdHJhbnNmZXI/OiByZWFkb25seSBBcnJheUJ1ZmZlcltdKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKHRoaXMuX3dlYnZpZXcudmFsdWUpIHtcblx0XHRcdHJldHVybiB0aGlzLl93ZWJ2aWV3LnZhbHVlLnBvc3RNZXNzYWdlKG1lc3NhZ2UsIHRyYW5zZmVyKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5faXNGaXJzdExvYWQpIHtcblx0XHRcdGxldCByZXNvbHZlOiAoeDogYm9vbGVhbikgPT4gdm9pZDtcblx0XHRcdGNvbnN0IHAgPSBuZXcgUHJvbWlzZTxib29sZWFuPihyID0+IHJlc29sdmUgPSByKTtcblx0XHRcdHRoaXMuX2ZpcnN0TG9hZFBlbmRpbmdNZXNzYWdlcy5hZGQoeyBtZXNzYWdlLCB0cmFuc2ZlciwgcmVzb2x2ZTogcmVzb2x2ZSEgfSk7XG5cdFx0XHRyZXR1cm4gcDtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRmb2N1cygpOiB2b2lkIHsgdGhpcy5fd2Vidmlldy52YWx1ZT8uZm9jdXMoKTsgfVxuXHRyZWxvYWQoKTogdm9pZCB7IHRoaXMuX3dlYnZpZXcudmFsdWU/LnJlbG9hZCgpOyB9XG5cdHNlbGVjdEFsbCgpOiB2b2lkIHsgdGhpcy5fd2Vidmlldy52YWx1ZT8uc2VsZWN0QWxsKCk7IH1cblx0Y29weSgpOiB2b2lkIHsgdGhpcy5fd2Vidmlldy52YWx1ZT8uY29weSgpOyB9XG5cdHBhc3RlKCk6IHZvaWQgeyB0aGlzLl93ZWJ2aWV3LnZhbHVlPy5wYXN0ZSgpOyB9XG5cdGN1dCgpOiB2b2lkIHsgdGhpcy5fd2Vidmlldy52YWx1ZT8uY3V0KCk7IH1cblx0dW5kbygpOiB2b2lkIHsgdGhpcy5fd2Vidmlldy52YWx1ZT8udW5kbygpOyB9XG5cdHJlZG8oKTogdm9pZCB7IHRoaXMuX3dlYnZpZXcudmFsdWU/LnJlZG8oKTsgfVxuXG5cdHNob3dGaW5kKGFuaW1hdGVkID0gdHJ1ZSkge1xuXHRcdGlmICh0aGlzLl93ZWJ2aWV3LnZhbHVlKSB7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3LnZhbHVlLnNob3dGaW5kKGFuaW1hdGVkKTtcblx0XHRcdHRoaXMuX2ZpbmRXaWRnZXRWaXNpYmxlPy5zZXQodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0aGlkZUZpbmQoYW5pbWF0ZWQgPSB0cnVlKSB7XG5cdFx0dGhpcy5fZmluZFdpZGdldFZpc2libGU/LnJlc2V0KCk7XG5cdFx0dGhpcy5fd2Vidmlldy52YWx1ZT8uaGlkZUZpbmQoYW5pbWF0ZWQpO1xuXHR9XG5cblx0cnVuRmluZEFjdGlvbihwcmV2aW91czogYm9vbGVhbik6IHZvaWQgeyB0aGlzLl93ZWJ2aWV3LnZhbHVlPy5ydW5GaW5kQWN0aW9uKHByZXZpb3VzKTsgfVxuXG5cdHByaXZhdGUgX3dpdGhXZWJ2aWV3KGY6ICh3ZWJ2aWV3OiBJV2VidmlldykgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl93ZWJ2aWV3LnZhbHVlKSB7XG5cdFx0XHRmKHRoaXMuX3dlYnZpZXcudmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdHdpbmRvd0RpZERyYWdTdGFydCgpIHtcblx0XHR0aGlzLl93ZWJ2aWV3LnZhbHVlPy53aW5kb3dEaWREcmFnU3RhcnQoKTtcblx0fVxuXG5cdHdpbmRvd0RpZERyYWdFbmQoKSB7XG5cdFx0dGhpcy5fd2Vidmlldy52YWx1ZT8ud2luZG93RGlkRHJhZ0VuZCgpO1xuXHR9XG5cblx0c2V0Q29udGV4dEtleVNlcnZpY2UoY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSkge1xuXHRcdHRoaXMuX3dlYnZpZXcudmFsdWU/LnNldENvbnRleHRLZXlTZXJ2aWNlKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0fVxufVxuXG5mdW5jdGlvbiBjb21wdXRlQ2xpcHBpbmdSZWN0KGZyYW1lUmVjdDogRE9NUmVjdFJlYWRPbmx5LCBjbGlwcGVyOiBIVE1MRWxlbWVudCkge1xuXHRjb25zdCByb290UmVjdCA9IGNsaXBwZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblx0Y29uc3QgdG9wID0gTWF0aC5tYXgocm9vdFJlY3QudG9wIC0gZnJhbWVSZWN0LnRvcCwgMCk7XG5cdGNvbnN0IHJpZ2h0ID0gTWF0aC5tYXgoZnJhbWVSZWN0LndpZHRoIC0gKGZyYW1lUmVjdC5yaWdodCAtIHJvb3RSZWN0LnJpZ2h0KSwgMCk7XG5cdGNvbnN0IGJvdHRvbSA9IE1hdGgubWF4KGZyYW1lUmVjdC5oZWlnaHQgLSAoZnJhbWVSZWN0LmJvdHRvbSAtIHJvb3RSZWN0LmJvdHRvbSksIDApO1xuXHRjb25zdCBsZWZ0ID0gTWF0aC5tYXgocm9vdFJlY3QubGVmdCAtIGZyYW1lUmVjdC5sZWZ0LCAwKTtcblxuXHRyZXR1cm4geyB0b3AsIHJpZ2h0LCBib3R0b20sIGxlZnQgfTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBb0IscUJBQXFCO0FBQ3pDLFNBQVMsbUJBQW1CO0FBRzVCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFlBQVksaUJBQWlCLHlCQUF5QjtBQUUvRCxTQUFTLG9CQUFvQjtBQUM3QixTQUFzQiwwQkFBb0Q7QUFFMUUsU0FBUywrQkFBK0I7QUFDeEMsU0FBcUQsaUJBQWlCLGdEQUFnRCxzREFBd0s7QUFLdlIsSUFBTSxpQkFBTixjQUE2QixXQUFzQztBQUFBLEVBZ0NsRSxZQUNOLFVBQzBDLGdCQUNSLGlCQUNHLHdCQUNwQztBQUNELFVBQU07QUFKb0M7QUFDUjtBQUNHO0FBbEN0QyxTQUFRLGVBQWU7QUFDdkIsU0FBaUIsNEJBQTRCLG9CQUFJLElBQXVIO0FBQ3hLLFNBQWlCLFdBQVcsS0FBSyxVQUFVLElBQUksa0JBQW1DLENBQUM7QUFDbkYsU0FBaUIsaUJBQWlCLEtBQUssVUFBVSxJQUFJLGdCQUFnQixDQUFDO0FBRXRFLFNBQVEsUUFBUTtBQUVoQixTQUFRLHlCQUFpQztBQUN6QyxTQUFRLFNBQTZCO0FBTXJDLFNBQVEsU0FBYztBQUV0QixTQUFRLFlBQWdDO0FBR3hDLFNBQWlCLDJCQUEyQixLQUFLLFVBQVUsSUFBSSxrQkFBNEMsQ0FBQztBQUc1RyxTQUFRLGlDQUFpQztBQTZCekMsU0FBUSxjQUFjO0FBRXRCLFNBQWlCLGdCQUFnQixLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDbkUsU0FBZ0IsZUFBZSxLQUFLLGNBQWM7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
