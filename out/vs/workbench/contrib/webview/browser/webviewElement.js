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
import { isFirefox } from "../../../../base/browser/browser.js";
import { addDisposableListener, EventType, getWindowById } from "../../../../base/browser/dom.js";
import { parentOriginHash } from "../../../../base/browser/iframe.js";
import { promiseWithResolvers, ThrottledDelayer } from "../../../../base/common/async.js";
import { streamToBuffer } from "../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { COI } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { ITunnelService } from "../../../../platform/tunnel/common/tunnel.js";
import { WebviewPortMappingManager } from "../../../../platform/webview/common/webviewPortMapping.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { decodeAuthority, webviewGenericCspSource, webviewRootResourceAuthority } from "../common/webview.js";
import { loadLocalResource, WebviewResourceResponse } from "./resourceLoading.js";
import { areWebviewContentOptionsEqual } from "./webview.js";
import { WebviewFindWidget } from "./webviewFindWidget.js";
var WebviewState;
((WebviewState2) => {
  let Type;
  ((Type2) => {
    Type2[Type2["Initializing"] = 0] = "Initializing";
    Type2[Type2["Ready"] = 1] = "Ready";
  })(Type = WebviewState2.Type || (WebviewState2.Type = {}));
  class Initializing {
    constructor(pendingMessages) {
      this.pendingMessages = pendingMessages;
      this.type = 0 /* Initializing */;
    }
  }
  WebviewState2.Initializing = Initializing;
  WebviewState2.Ready = { type: 1 /* Ready */ };
})(WebviewState || (WebviewState = {}));
const webviewIdContext = "webviewId";
let WebviewElement = class extends Disposable {
  constructor(initInfo, webviewThemeDataProvider, configurationService, contextMenuService, notificationService, _environmentService, _fileService, _logService, _remoteAuthorityResolverService, _tunnelService, instantiationService, _accessibilityService) {
    super();
    this.webviewThemeDataProvider = webviewThemeDataProvider;
    this._environmentService = _environmentService;
    this._fileService = _fileService;
    this._logService = _logService;
    this._remoteAuthorityResolverService = _remoteAuthorityResolverService;
    this._tunnelService = _tunnelService;
    this._accessibilityService = _accessibilityService;
    this.id = generateUuid();
    this._windowId = void 0;
    this._expectedServiceWorkerVersion = 4;
    this._state = new WebviewState.Initializing([]);
    this._resourceLoadingCts = this._register(new CancellationTokenSource());
    this._focusDelayer = this._register(new ThrottledDelayer(50));
    this._onDidHtmlChange = this._register(new Emitter());
    this.onDidHtmlChange = this._onDidHtmlChange.event;
    this._messageHandlers = /* @__PURE__ */ new Map();
    this.checkImeCompletionState = true;
    this._disposed = false;
    this._onMissingCsp = this._register(new Emitter());
    this.onMissingCsp = this._onMissingCsp.event;
    this._onDidClickLink = this._register(new Emitter());
    this.onDidClickLink = this._onDidClickLink.event;
    this._onDidReload = this._register(new Emitter());
    this.onDidReload = this._onDidReload.event;
    this._onMessage = this._register(new Emitter());
    this.onMessage = this._onMessage.event;
    this._onDidScroll = this._register(new Emitter());
    this.onDidScroll = this._onDidScroll.event;
    this._onDidWheel = this._register(new Emitter());
    this.onDidWheel = this._onDidWheel.event;
    this._onDidUpdateState = this._register(new Emitter());
    this.onDidUpdateState = this._onDidUpdateState.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._onFatalError = this._register(new Emitter());
    this.onFatalError = this._onFatalError.event;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._hasAlertedAboutMissingCsp = false;
    this._hasFindResult = this._register(new Emitter());
    this.hasFindResult = this._hasFindResult.event;
    this._onDidStopFind = this._register(new Emitter());
    this.onDidStopFind = this._onDidStopFind.event;
    this.providedViewType = initInfo.providedViewType;
    this.origin = initInfo.origin ?? this.id;
    this._options = initInfo.options;
    this.extension = initInfo.extension;
    this._content = {
      html: "",
      title: initInfo.title,
      options: initInfo.contentOptions,
      state: void 0
    };
    this._portMappingManager = this._register(new WebviewPortMappingManager(
      () => this.extension?.location,
      () => this._content.options.portMapping || [],
      this._tunnelService
    ));
    this._element = this._createElement(initInfo.options, initInfo.contentOptions);
    this._register(this.on("no-csp-found", () => {
      this.handleNoCspFound();
    }));
    this._register(this.on("did-click-link", ({ uri }) => {
      this._onDidClickLink.fire(uri);
    }));
    this._register(this.on("onmessage", ({ message, transfer }) => {
      this._onMessage.fire({ message, transfer });
    }));
    this._register(this.on("did-scroll", ({ scrollYPercentage }) => {
      this._onDidScroll.fire({ scrollYPercentage });
    }));
    this._register(this.on("do-reload", () => {
      this.reload();
    }));
    this._register(this.on("do-update-state", (state) => {
      this.state = state;
      this._onDidUpdateState.fire(state);
    }));
    this._register(this.on("did-focus", () => {
      this.handleFocusChange(true);
    }));
    this._register(this.on("did-blur", () => {
      this.handleFocusChange(false);
    }));
    this._register(this.on("did-scroll-wheel", (event) => {
      this._onDidWheel.fire(event);
    }));
    this._register(this.on("did-find", ({ didFind }) => {
      this._hasFindResult.fire(didFind);
    }));
    this._register(this.on("fatal-error", (e) => {
      notificationService.error(localize("fatalErrorMessage", "Error loading webview: {0}", e.message));
      this._onFatalError.fire({ message: e.message });
    }));
    this._register(this.on("did-keydown", (data) => {
      this.handleKeyEvent("keydown", data);
    }));
    this._register(this.on("did-keyup", (data) => {
      this.handleKeyEvent("keyup", data);
    }));
    this._register(this.on("did-context-menu", (data) => {
      if (!this.element) {
        return;
      }
      if (!this._contextKeyService) {
        return;
      }
      const elementBox = this.element.getBoundingClientRect();
      const contextKeyService = this._contextKeyService.createOverlay([
        ...Object.entries(data.context),
        [webviewIdContext, this.providedViewType]
      ]);
      contextMenuService.showContextMenu({
        menuId: MenuId.WebviewContext,
        menuActionOptions: { shouldForwardArgs: true },
        contextKeyService,
        getActionsContext: () => ({ ...data.context, webview: this.providedViewType }),
        getAnchor: () => ({
          x: elementBox.x + data.clientX,
          y: elementBox.y + data.clientY
        })
      });
      this._send("set-context-menu-visible", { visible: true });
    }));
    this._register(this.on("load-resource", async (entry) => {
      try {
        const authority = decodeAuthority(entry.authority);
        const uri = URI.from({
          scheme: entry.scheme,
          authority,
          path: decodeURIComponent(entry.path),
          // This gets re-encoded
          query: entry.query ? decodeURIComponent(entry.query) : entry.query
        });
        this.loadResource(entry.id, uri, entry.ifNoneMatch);
      } catch (e) {
        this._send("did-load-resource", {
          id: entry.id,
          status: 404,
          path: entry.path
        });
      }
    }));
    this._register(this.on("load-localhost", (entry) => {
      this.localLocalhost(entry.id, entry.origin);
    }));
    this._register(Event.runAndSubscribe(webviewThemeDataProvider.onThemeDataChanged, () => this.style()));
    this._register(_accessibilityService.onDidChangeReducedMotion(() => this.style()));
    this._register(_accessibilityService.onDidChangeScreenReaderOptimized(() => this.style()));
    this._register(contextMenuService.onDidHideContextMenu(() => this._send("set-context-menu-visible", { visible: false })));
    this._confirmBeforeClose = configurationService.getValue("window.confirmBeforeClose");
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("window.confirmBeforeClose")) {
        this._confirmBeforeClose = configurationService.getValue("window.confirmBeforeClose");
        this._send("set-confirm-before-close", this._confirmBeforeClose);
      }
    }));
    this._register(this.on("drag-start", () => {
      this._startBlockingIframeDragEvents();
    }));
    this._register(this.on("drag", (event) => {
      this.handleDragEvent("drag", event);
    }));
    if (initInfo.options.enableFindWidget) {
      this._webviewFindWidget = this._register(instantiationService.createInstance(WebviewFindWidget, this));
    }
  }
  get window() {
    return typeof this._windowId === "number" ? getWindowById(this._windowId)?.window : void 0;
  }
  get platform() {
    return "browser";
  }
  get element() {
    return this._element;
  }
  get isFocused() {
    if (!this._focused) {
      return false;
    }
    if (!this.window) {
      return false;
    }
    if (this.window.document.activeElement && this.window.document.activeElement !== this.element) {
      return false;
    }
    return true;
  }
  dispose() {
    this._disposed = true;
    this.element?.remove();
    this._element = void 0;
    this._messagePort = void 0;
    if (this._state.type === 0 /* Initializing */) {
      for (const message of this._state.pendingMessages) {
        message.resolve(false);
      }
      this._state.pendingMessages = [];
    }
    this._onDidDispose.fire();
    this._resourceLoadingCts.dispose(true);
    super.dispose();
  }
  setContextKeyService(contextKeyService) {
    this._contextKeyService = contextKeyService;
  }
  postMessage(message, transfer) {
    return this._send("message", { message, transfer });
  }
  async _send(channel, data, _createElement = []) {
    if (this._state.type === 0 /* Initializing */) {
      const { promise, resolve } = promiseWithResolvers();
      this._state.pendingMessages.push({ channel, data, transferable: _createElement, resolve });
      return promise;
    } else {
      return this.doPostMessage(channel, data, _createElement);
    }
  }
  _createElement(options, _contentOptions) {
    const element = document.createElement("iframe");
    element.name = this.id;
    element.className = `webview ${options.customClasses || ""}`;
    element.sandbox.add("allow-scripts", "allow-same-origin", "allow-forms", "allow-pointer-lock", "allow-downloads");
    const allowRules = ["cross-origin-isolated", "autoplay"];
    if (!isFirefox) {
      allowRules.push("clipboard-read", "clipboard-write");
    }
    element.setAttribute("allow", allowRules.join("; "));
    element.style.border = "none";
    element.style.width = "100%";
    element.style.height = "100%";
    element.focus = () => {
      this._doFocus();
    };
    return element;
  }
  _initElement(encodedWebviewOrigin, extension, options, targetWindow) {
    const params = {
      id: this.id,
      origin: this.origin,
      swVersion: String(this._expectedServiceWorkerVersion),
      extensionId: extension?.id.value ?? "",
      platform: this.platform,
      "vscode-resource-base-authority": webviewRootResourceAuthority,
      parentOrigin: targetWindow.origin
    };
    if (this._options.disableServiceWorker) {
      params.disableServiceWorker = "true";
    }
    if (this._environmentService.remoteAuthority) {
      params.remoteAuthority = this._environmentService.remoteAuthority;
    }
    if (options.purpose) {
      params.purpose = options.purpose;
    }
    COI.addSearchParam(params, true, true);
    const queryString = new URLSearchParams(params).toString();
    const fileName = isFirefox ? "index-no-csp.html" : "index.html";
    this.element.setAttribute("src", `${this.webviewContentEndpoint(encodedWebviewOrigin)}/${fileName}?${queryString}`);
  }
  mountTo(element, targetWindow) {
    if (!this.element) {
      return;
    }
    this._windowId = targetWindow.vscodeWindowId;
    this._encodedWebviewOriginPromise = parentOriginHash(targetWindow.origin, this.origin).then((id) => this._encodedWebviewOrigin = id);
    this._encodedWebviewOriginPromise.then((encodedWebviewOrigin) => {
      if (!this._disposed) {
        this._initElement(encodedWebviewOrigin, this.extension, this._options, targetWindow);
      }
    });
    this._registerMessageHandler(targetWindow);
    if (this._webviewFindWidget) {
      element.appendChild(this._webviewFindWidget.getDomNode());
    }
    for (const eventName of [EventType.MOUSE_DOWN, EventType.MOUSE_MOVE, EventType.DROP]) {
      this._register(addDisposableListener(element, eventName, () => {
        this._stopBlockingIframeDragEvents();
      }));
    }
    for (const node of [element, targetWindow]) {
      this._register(addDisposableListener(node, EventType.DRAG_END, () => {
        this._stopBlockingIframeDragEvents();
      }));
    }
    element.id = this.id;
    element.appendChild(this.element);
  }
  _registerMessageHandler(targetWindow) {
    const subscription = this._register(addDisposableListener(targetWindow, "message", (e) => {
      if (!this._encodedWebviewOrigin || e?.data?.target !== this.id) {
        return;
      }
      if (e.origin !== this._webviewContentOrigin(this._encodedWebviewOrigin)) {
        console.log(`Skipped renderer receiving message due to mismatched origins: ${e.origin} ${this._webviewContentOrigin}`);
        return;
      }
      if (e.data.channel === "webview-ready") {
        if (this._messagePort) {
          return;
        }
        this._logService.debug(`Webview(${this.id}): webview ready`);
        this._messagePort = e.ports[0];
        this._messagePort.onmessage = (e2) => {
          const handlers = this._messageHandlers.get(e2.data.channel);
          if (!handlers) {
            console.log(`No handlers found for '${e2.data.channel}'`);
            return;
          }
          handlers?.forEach((handler) => handler(e2.data.data, e2));
        };
        this.element?.classList.add("ready");
        if (this._state.type === 0 /* Initializing */) {
          this._state.pendingMessages.forEach(({ channel, data, resolve }) => resolve(this.doPostMessage(channel, data)));
        }
        this._state = WebviewState.Ready;
        subscription.dispose();
      }
    }));
  }
  _startBlockingIframeDragEvents() {
    if (this.element) {
      this.element.style.pointerEvents = "none";
    }
  }
  _stopBlockingIframeDragEvents() {
    if (this.element) {
      this.element.style.pointerEvents = "auto";
    }
  }
  webviewContentEndpoint(encodedWebviewOrigin) {
    const webviewExternalEndpoint = this._environmentService.webviewExternalEndpoint;
    if (!webviewExternalEndpoint) {
      throw new Error(`'webviewExternalEndpoint' has not been configured. Webviews will not work!`);
    }
    const endpoint = webviewExternalEndpoint.replace("{{uuid}}", encodedWebviewOrigin);
    if (endpoint[endpoint.length - 1] === "/") {
      return endpoint.slice(0, endpoint.length - 1);
    }
    return endpoint;
  }
  _webviewContentOrigin(encodedWebviewOrigin) {
    const uri = URI.parse(this.webviewContentEndpoint(encodedWebviewOrigin));
    return uri.scheme + "://" + uri.authority.toLowerCase();
  }
  doPostMessage(channel, data, transferable = []) {
    if (this.element && this._messagePort) {
      this._messagePort.postMessage({ channel, args: data }, transferable);
      return true;
    }
    return false;
  }
  on(channel, handler) {
    let handlers = this._messageHandlers.get(channel);
    if (!handlers) {
      handlers = /* @__PURE__ */ new Set();
      this._messageHandlers.set(channel, handlers);
    }
    handlers.add(handler);
    return toDisposable(() => {
      this._messageHandlers.get(channel)?.delete(handler);
    });
  }
  handleNoCspFound() {
    if (this._hasAlertedAboutMissingCsp) {
      return;
    }
    this._hasAlertedAboutMissingCsp = true;
    if (this.extension?.id) {
      if (this._environmentService.isExtensionDevelopment) {
        this._onMissingCsp.fire(this.extension.id);
      }
    }
  }
  reload() {
    this.doUpdateContent(this._content);
    const subscription = this._register(this.on("did-load", () => {
      this._onDidReload.fire();
      subscription.dispose();
    }));
  }
  setHtml(html) {
    this.doUpdateContent({ ...this._content, html });
    this._onDidHtmlChange.fire(html);
  }
  setTitle(title) {
    this._content = { ...this._content, title };
    this._send("set-title", title);
  }
  set contentOptions(options) {
    this._logService.debug(`Webview(${this.id}): will update content options`);
    if (areWebviewContentOptionsEqual(options, this._content.options)) {
      this._logService.debug(`Webview(${this.id}): skipping content options update`);
      return;
    }
    this.doUpdateContent({ ...this._content, options });
  }
  set localResourcesRoot(resources) {
    this._content = {
      ...this._content,
      options: { ...this._content.options, localResourceRoots: resources }
    };
  }
  set state(state) {
    this._content = { ...this._content, state };
  }
  set initialScrollProgress(value) {
    this._send("initial-scroll-position", value);
  }
  doUpdateContent(newContent) {
    this._logService.debug(`Webview(${this.id}): will update content`);
    this._content = newContent;
    const allowScripts = !!this._content.options.allowScripts;
    this._send("content", {
      contents: this._content.html,
      title: this._content.title,
      options: {
        allowMultipleAPIAcquire: !!this._content.options.allowMultipleAPIAcquire,
        allowScripts,
        allowForms: this._content.options.allowForms ?? allowScripts
        // For back compat, we allow forms by default when scripts are enabled
      },
      state: this._content.state,
      cspSource: webviewGenericCspSource,
      confirmBeforeClose: this._confirmBeforeClose
    });
  }
  style() {
    let { styles, activeTheme, themeLabel, themeId } = this.webviewThemeDataProvider.getWebviewThemeData();
    if (this._options.transformCssVariables) {
      styles = this._options.transformCssVariables(styles);
    }
    const reduceMotion = this._accessibilityService.isMotionReduced();
    const screenReader = this._accessibilityService.isScreenReaderOptimized();
    this._send("styles", { styles, activeTheme, themeId, themeLabel, reduceMotion, screenReader });
  }
  handleFocusChange(isFocused) {
    this._focused = isFocused;
    if (isFocused) {
      this._onDidFocus.fire();
    } else {
      this._onDidBlur.fire();
    }
  }
  handleKeyEvent(type, event) {
    const emulatedKeyboardEvent = new KeyboardEvent(type, event);
    Object.defineProperty(emulatedKeyboardEvent, "target", {
      get: () => this.element
    });
    this.window?.dispatchEvent(emulatedKeyboardEvent);
  }
  handleDragEvent(type, event) {
    const emulatedDragEvent = new DragEvent(type, event);
    Object.defineProperty(emulatedDragEvent, "target", {
      get: () => this.element
    });
    this.window?.dispatchEvent(emulatedDragEvent);
  }
  windowDidDragStart() {
    this._startBlockingIframeDragEvents();
  }
  windowDidDragEnd() {
    this._stopBlockingIframeDragEvents();
  }
  selectAll() {
    this.execCommand("selectAll");
  }
  copy() {
    this.execCommand("copy");
  }
  paste() {
    this.execCommand("paste");
  }
  cut() {
    this.execCommand("cut");
  }
  undo() {
    this.execCommand("undo");
  }
  redo() {
    this.execCommand("redo");
  }
  execCommand(command) {
    if (this.element) {
      this._send("execCommand", command);
    }
  }
  async loadResource(id, uri, ifNoneMatch) {
    try {
      const result = await loadLocalResource(uri, {
        ifNoneMatch,
        roots: this._content.options.localResourceRoots || []
      }, this._fileService, this._logService, this._resourceLoadingCts.token);
      switch (result.type) {
        case WebviewResourceResponse.Type.Success: {
          const buffer = await this.streamToBuffer(result.stream);
          return this._send("did-load-resource", {
            id,
            status: 200,
            path: uri.path,
            mime: result.mimeType,
            data: buffer,
            etag: result.etag,
            mtime: result.mtime
          }, [buffer]);
        }
        case WebviewResourceResponse.Type.NotModified: {
          return this._send("did-load-resource", {
            id,
            status: 304,
            // not modified
            path: uri.path,
            mime: result.mimeType,
            mtime: result.mtime
          });
        }
        case WebviewResourceResponse.Type.AccessDenied: {
          return this._send("did-load-resource", {
            id,
            status: 401,
            // unauthorized
            path: uri.path
          });
        }
      }
    } catch {
    }
    return this._send("did-load-resource", {
      id,
      status: 404,
      path: uri.path
    });
  }
  async streamToBuffer(stream) {
    const vsBuffer = await streamToBuffer(stream);
    return vsBuffer.buffer.buffer;
  }
  async localLocalhost(id, origin) {
    const authority = this._environmentService.remoteAuthority;
    const resolveAuthority = authority ? await this._remoteAuthorityResolverService.resolveAuthority(authority) : void 0;
    const redirect = resolveAuthority ? await this._portMappingManager.getRedirect(resolveAuthority.authority, origin) : void 0;
    return this._send("did-load-localhost", {
      id,
      origin,
      location: redirect
    });
  }
  focus() {
    this._doFocus();
    this.handleFocusChange(true);
  }
  _doFocus() {
    if (!this.element) {
      return;
    }
    try {
      this.element.contentWindow?.focus();
    } catch {
    }
    this._focusDelayer.trigger(async () => {
      if (!this.isFocused || !this.element) {
        return;
      }
      if (this.window?.document.activeElement && this.window.document.activeElement !== this.element && this.window.document.activeElement?.tagName !== "BODY") {
        return;
      }
      this.window?.document.body?.focus();
      this._send("focus", void 0);
    });
  }
  /**
   * Webviews expose a stateful find API.
   * Successive calls to find will move forward or backward through onFindResults
   * depending on the supplied options.
   *
   * @param value The string to search for. Empty strings are ignored.
   */
  find(value, previous) {
    if (!this.element) {
      return;
    }
    this._send("find", { value, previous });
  }
  updateFind(value) {
    if (!value || !this.element) {
      return;
    }
    this._send("find", { value });
  }
  stopFind(keepSelection) {
    if (!this.element) {
      return;
    }
    this._send("find-stop", { clearSelection: !keepSelection });
    this._onDidStopFind.fire();
  }
  showFind(animated = true) {
    this._webviewFindWidget?.reveal(void 0, animated);
  }
  hideFind(animated = true) {
    this._webviewFindWidget?.hide(animated);
  }
  runFindAction(previous) {
    this._webviewFindWidget?.find(previous);
  }
};
WebviewElement = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, IFileService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IRemoteAuthorityResolverService),
  __decorateParam(9, ITunnelService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IAccessibilityService)
], WebviewElement);
export {
  WebviewElement
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWJ2aWV3L2Jyb3dzZXIvd2Vidmlld0VsZW1lbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc0ZpcmVmb3ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvYnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIEV2ZW50VHlwZSwgZ2V0V2luZG93QnlJZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgcGFyZW50T3JpZ2luSGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9pZnJhbWUuanMnO1xuaW1wb3J0IHsgSU1vdXNlV2hlZWxFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IENvZGVXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IHByb21pc2VXaXRoUmVzb2x2ZXJzLCBUaHJvdHRsZWREZWxheWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgc3RyZWFtVG9CdWZmZXIsIFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IENPSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSVR1bm5lbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90dW5uZWwvY29tbW9uL3R1bm5lbC5qcyc7XG5pbXBvcnQgeyBXZWJ2aWV3UG9ydE1hcHBpbmdNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd2Vidmlldy9jb21tb24vd2Vidmlld1BvcnRNYXBwaW5nLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGRlY29kZUF1dGhvcml0eSwgd2Vidmlld0dlbmVyaWNDc3BTb3VyY2UsIHdlYnZpZXdSb290UmVzb3VyY2VBdXRob3JpdHkgfSBmcm9tICcuLi9jb21tb24vd2Vidmlldy5qcyc7XG5pbXBvcnQgeyBsb2FkTG9jYWxSZXNvdXJjZSwgV2Vidmlld1Jlc291cmNlUmVzcG9uc2UgfSBmcm9tICcuL3Jlc291cmNlTG9hZGluZy5qcyc7XG5pbXBvcnQgeyBXZWJ2aWV3VGhlbWVEYXRhUHJvdmlkZXIgfSBmcm9tICcuL3RoZW1laW5nLmpzJztcbmltcG9ydCB7IGFyZVdlYnZpZXdDb250ZW50T3B0aW9uc0VxdWFsLCBJV2VidmlldywgV2Vidmlld0NvbnRlbnRPcHRpb25zLCBXZWJ2aWV3RXh0ZW5zaW9uRGVzY3JpcHRpb24sIFdlYnZpZXdJbml0SW5mbywgV2Vidmlld01lc3NhZ2VSZWNlaXZlZEV2ZW50LCBXZWJ2aWV3T3B0aW9ucyB9IGZyb20gJy4vd2Vidmlldy5qcyc7XG5pbXBvcnQgeyBXZWJ2aWV3RmluZERlbGVnYXRlLCBXZWJ2aWV3RmluZFdpZGdldCB9IGZyb20gJy4vd2Vidmlld0ZpbmRXaWRnZXQuanMnO1xuaW1wb3J0IHsgRnJvbVdlYnZpZXdNZXNzYWdlLCBLZXlFdmVudCwgVG9XZWJ2aWV3TWVzc2FnZSwgV2ViVmlld0RyYWdFdmVudCB9IGZyb20gJy4vd2Vidmlld01lc3NhZ2VzLmpzJztcblxuaW50ZXJmYWNlIFdlYnZpZXdDb250ZW50IHtcblx0cmVhZG9ubHkgaHRtbDogc3RyaW5nO1xuXHRyZWFkb25seSB0aXRsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBvcHRpb25zOiBXZWJ2aWV3Q29udGVudE9wdGlvbnM7XG5cdHJlYWRvbmx5IHN0YXRlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbm5hbWVzcGFjZSBXZWJ2aWV3U3RhdGUge1xuXHRleHBvcnQgY29uc3QgZW51bSBUeXBlIHsgSW5pdGlhbGl6aW5nLCBSZWFkeSB9XG5cblx0ZXhwb3J0IGNsYXNzIEluaXRpYWxpemluZyB7XG5cdFx0cmVhZG9ubHkgdHlwZSA9IFR5cGUuSW5pdGlhbGl6aW5nO1xuXG5cdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRwdWJsaWMgcGVuZGluZ01lc3NhZ2VzOiBBcnJheTx7XG5cdFx0XHRcdHJlYWRvbmx5IGNoYW5uZWw6IHN0cmluZztcblx0XHRcdFx0cmVhZG9ubHkgZGF0YT86IGFueTtcblx0XHRcdFx0cmVhZG9ubHkgdHJhbnNmZXJhYmxlOiBUcmFuc2ZlcmFibGVbXTtcblx0XHRcdFx0cmVhZG9ubHkgcmVzb2x2ZTogKHBvc3RlZDogYm9vbGVhbikgPT4gdm9pZDtcblx0XHRcdH0+XG5cdFx0KSB7IH1cblx0fVxuXG5cdGV4cG9ydCBjb25zdCBSZWFkeSA9IHsgdHlwZTogVHlwZS5SZWFkeSB9IGFzIGNvbnN0O1xuXG5cdGV4cG9ydCB0eXBlIFN0YXRlID0gdHlwZW9mIFJlYWR5IHwgSW5pdGlhbGl6aW5nO1xufVxuXG5pbnRlcmZhY2UgV2Vidmlld0FjdGlvbkNvbnRleHQge1xuXHRyZWFkb25seSB3ZWJ2aWV3Pzogc3RyaW5nO1xuXHRyZWFkb25seSBba2V5OiBzdHJpbmddOiB1bmtub3duO1xufVxuXG5jb25zdCB3ZWJ2aWV3SWRDb250ZXh0ID0gJ3dlYnZpZXdJZCc7XG5cbmV4cG9ydCBjbGFzcyBXZWJ2aWV3RWxlbWVudCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV2VidmlldywgV2Vidmlld0ZpbmREZWxlZ2F0ZSB7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IGlkID0gZ2VuZXJhdGVVdWlkKCk7XG5cblx0LyoqXG5cdCAqIFRoZSBwcm92aWRlZCBpZGVudGlmaWVyIG9mIHRoaXMgd2Vidmlldy5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBwcm92aWRlZFZpZXdUeXBlPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBUaGUgb3JpZ2luIHRoaXMgd2VidmlldyBpdHNlbGYgaXMgbG9hZGVkIGZyb20uIE1heSBub3QgYmUgdW5pcXVlXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgb3JpZ2luOiBzdHJpbmc7XG5cblx0cHJpdmF0ZSBfd2luZG93SWQ6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXQgd2luZG93KCkgeyByZXR1cm4gdHlwZW9mIHRoaXMuX3dpbmRvd0lkID09PSAnbnVtYmVyJyA/IGdldFdpbmRvd0J5SWQodGhpcy5fd2luZG93SWQpPy53aW5kb3cgOiB1bmRlZmluZWQ7IH1cblxuXHRwcml2YXRlIF9lbmNvZGVkV2Vidmlld09yaWdpblByb21pc2U/OiBQcm9taXNlPHN0cmluZz47XG5cdHByaXZhdGUgX2VuY29kZWRXZWJ2aWV3T3JpZ2luOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIGdldCBwbGF0Zm9ybSgpOiBzdHJpbmcgeyByZXR1cm4gJ2Jyb3dzZXInOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZXhwZWN0ZWRTZXJ2aWNlV29ya2VyVmVyc2lvbiA9IDQ7IC8vIEtlZXAgdGhpcyBpbiBzeW5jIHdpdGggdGhlIHZlcnNpb24gaW4gc2VydmljZS13b3JrZXIuanNcblxuXHRwcml2YXRlIF9lbGVtZW50OiBIVE1MSUZyYW1lRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIGdldCBlbGVtZW50KCk6IEhUTUxJRnJhbWVFbGVtZW50IHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2VsZW1lbnQ7IH1cblxuXHRwcml2YXRlIF9mb2N1c2VkOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgZ2V0IGlzRm9jdXNlZCgpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuX2ZvY3VzZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Ly8gY29kZSB3aW5kb3cgaXMgb25seSBhdmFpbGFibGUgYWZ0ZXIgdGhlIHdlYnZpZXcgaXMgbW91bnRlZC5cblx0XHRpZiAoIXRoaXMud2luZG93KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMud2luZG93LmRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgJiYgdGhpcy53aW5kb3cuZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAhPT0gdGhpcy5lbGVtZW50KSB7XG5cdFx0XHQvLyBsb29rcyBsaWtlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMzI2NDFcblx0XHRcdC8vIHdoZXJlIHRoZSBmb2N1cyBpcyBhY3R1YWxseSBub3QgaW4gdGhlIGA8aWZyYW1lPmBcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIF9zdGF0ZTogV2Vidmlld1N0YXRlLlN0YXRlID0gbmV3IFdlYnZpZXdTdGF0ZS5Jbml0aWFsaXppbmcoW10pO1xuXG5cdHByaXZhdGUgX2NvbnRlbnQ6IFdlYnZpZXdDb250ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3BvcnRNYXBwaW5nTWFuYWdlcjogV2Vidmlld1BvcnRNYXBwaW5nTWFuYWdlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXNvdXJjZUxvYWRpbmdDdHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKSk7XG5cblx0cHJpdmF0ZSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9jb25maXJtQmVmb3JlQ2xvc2U6IHN0cmluZztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9mb2N1c0RlbGF5ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGhyb3R0bGVkRGVsYXllcig1MCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkSHRtbENoYW5nZTogRW1pdHRlcjxzdHJpbmc+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IG9uRGlkSHRtbENoYW5nZSA9IHRoaXMuX29uRGlkSHRtbENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIF9tZXNzYWdlUG9ydD86IE1lc3NhZ2VQb3J0O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tZXNzYWdlSGFuZGxlcnMgPSBuZXcgTWFwPHN0cmluZywgU2V0PChkYXRhOiBhbnksIGU6IE1lc3NhZ2VFdmVudCkgPT4gdm9pZD4+KCk7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF93ZWJ2aWV3RmluZFdpZGdldDogV2Vidmlld0ZpbmRXaWRnZXQgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyByZWFkb25seSBjaGVja0ltZUNvbXBsZXRpb25TdGF0ZSA9IHRydWU7XG5cblx0cHJpdmF0ZSBfZGlzcG9zZWQgPSBmYWxzZTtcblxuXG5cdHB1YmxpYyBleHRlbnNpb246IFdlYnZpZXdFeHRlbnNpb25EZXNjcmlwdGlvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogV2Vidmlld09wdGlvbnM7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aW5pdEluZm86IFdlYnZpZXdJbml0SW5mbyxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgd2Vidmlld1RoZW1lRGF0YVByb3ZpZGVyOiBXZWJ2aWV3VGhlbWVEYXRhUHJvdmlkZXIsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlOiBJUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJVHVubmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90dW5uZWxTZXJ2aWNlOiBJVHVubmVsU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5wcm92aWRlZFZpZXdUeXBlID0gaW5pdEluZm8ucHJvdmlkZWRWaWV3VHlwZTtcblx0XHR0aGlzLm9yaWdpbiA9IGluaXRJbmZvLm9yaWdpbiA/PyB0aGlzLmlkO1xuXG5cdFx0dGhpcy5fb3B0aW9ucyA9IGluaXRJbmZvLm9wdGlvbnM7XG5cdFx0dGhpcy5leHRlbnNpb24gPSBpbml0SW5mby5leHRlbnNpb247XG5cblx0XHR0aGlzLl9jb250ZW50ID0ge1xuXHRcdFx0aHRtbDogJycsXG5cdFx0XHR0aXRsZTogaW5pdEluZm8udGl0bGUsXG5cdFx0XHRvcHRpb25zOiBpbml0SW5mby5jb250ZW50T3B0aW9ucyxcblx0XHRcdHN0YXRlOiB1bmRlZmluZWRcblx0XHR9O1xuXG5cdFx0dGhpcy5fcG9ydE1hcHBpbmdNYW5hZ2VyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFdlYnZpZXdQb3J0TWFwcGluZ01hbmFnZXIoXG5cdFx0XHQoKSA9PiB0aGlzLmV4dGVuc2lvbj8ubG9jYXRpb24sXG5cdFx0XHQoKSA9PiB0aGlzLl9jb250ZW50Lm9wdGlvbnMucG9ydE1hcHBpbmcgfHwgW10sXG5cdFx0XHR0aGlzLl90dW5uZWxTZXJ2aWNlXG5cdFx0KSk7XG5cblx0XHR0aGlzLl9lbGVtZW50ID0gdGhpcy5fY3JlYXRlRWxlbWVudChpbml0SW5mby5vcHRpb25zLCBpbml0SW5mby5jb250ZW50T3B0aW9ucyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCduby1jc3AtZm91bmQnLCAoKSA9PiB7XG5cdFx0XHR0aGlzLmhhbmRsZU5vQ3NwRm91bmQoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCdkaWQtY2xpY2stbGluaycsICh7IHVyaSB9KSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENsaWNrTGluay5maXJlKHVyaSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbignb25tZXNzYWdlJywgKHsgbWVzc2FnZSwgdHJhbnNmZXIgfSkgPT4ge1xuXHRcdFx0dGhpcy5fb25NZXNzYWdlLmZpcmUoeyBtZXNzYWdlLCB0cmFuc2ZlciB9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCdkaWQtc2Nyb2xsJywgKHsgc2Nyb2xsWVBlcmNlbnRhZ2UgfSkgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRTY3JvbGwuZmlyZSh7IHNjcm9sbFlQZXJjZW50YWdlIH0pO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub24oJ2RvLXJlbG9hZCcsICgpID0+IHtcblx0XHRcdHRoaXMucmVsb2FkKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbignZG8tdXBkYXRlLXN0YXRlJywgKHN0YXRlKSA9PiB7XG5cdFx0XHR0aGlzLnN0YXRlID0gc3RhdGU7XG5cdFx0XHR0aGlzLl9vbkRpZFVwZGF0ZVN0YXRlLmZpcmUoc3RhdGUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub24oJ2RpZC1mb2N1cycsICgpID0+IHtcblx0XHRcdHRoaXMuaGFuZGxlRm9jdXNDaGFuZ2UodHJ1ZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbignZGlkLWJsdXInLCAoKSA9PiB7XG5cdFx0XHR0aGlzLmhhbmRsZUZvY3VzQ2hhbmdlKGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCdkaWQtc2Nyb2xsLXdoZWVsJywgKGV2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZFdoZWVsLmZpcmUoZXZlbnQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub24oJ2RpZC1maW5kJywgKHsgZGlkRmluZCB9KSA9PiB7XG5cdFx0XHR0aGlzLl9oYXNGaW5kUmVzdWx0LmZpcmUoZGlkRmluZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbignZmF0YWwtZXJyb3InLCAoZSkgPT4ge1xuXHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihsb2NhbGl6ZSgnZmF0YWxFcnJvck1lc3NhZ2UnLCBcIkVycm9yIGxvYWRpbmcgd2VidmlldzogezB9XCIsIGUubWVzc2FnZSkpO1xuXHRcdFx0dGhpcy5fb25GYXRhbEVycm9yLmZpcmUoeyBtZXNzYWdlOiBlLm1lc3NhZ2UgfSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbignZGlkLWtleWRvd24nLCAoZGF0YSkgPT4ge1xuXHRcdFx0Ly8gRWxlY3Ryb246IHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi9lbGVjdHJvbi9pc3N1ZXMvMTQyNThcblx0XHRcdC8vIFdlIGhhdmUgdG8gZGV0ZWN0IGtleWJvYXJkIGV2ZW50cyBpbiB0aGUgPHdlYnZpZXc+IGFuZCBkaXNwYXRjaCB0aGVtIHRvIG91clxuXHRcdFx0Ly8ga2V5YmluZGluZyBzZXJ2aWNlIGJlY2F1c2UgdGhlc2UgZXZlbnRzIGRvIG5vdCBidWJibGUgdG8gdGhlIHBhcmVudCB3aW5kb3cgYW55bW9yZS5cblx0XHRcdHRoaXMuaGFuZGxlS2V5RXZlbnQoJ2tleWRvd24nLCBkYXRhKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCdkaWQta2V5dXAnLCAoZGF0YSkgPT4ge1xuXHRcdFx0dGhpcy5oYW5kbGVLZXlFdmVudCgna2V5dXAnLCBkYXRhKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCdkaWQtY29udGV4dC1tZW51JywgKGRhdGEpID0+IHtcblx0XHRcdGlmICghdGhpcy5lbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghdGhpcy5fY29udGV4dEtleVNlcnZpY2UpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZWxlbWVudEJveCA9IHRoaXMuZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5fY29udGV4dEtleVNlcnZpY2UuY3JlYXRlT3ZlcmxheShbXG5cdFx0XHRcdC4uLk9iamVjdC5lbnRyaWVzKGRhdGEuY29udGV4dCksXG5cdFx0XHRcdFt3ZWJ2aWV3SWRDb250ZXh0LCB0aGlzLnByb3ZpZGVkVmlld1R5cGVdLFxuXHRcdFx0XSk7XG5cdFx0XHRjb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuV2Vidmlld0NvbnRleHQsXG5cdFx0XHRcdG1lbnVBY3Rpb25PcHRpb25zOiB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0sXG5cdFx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCk6IFdlYnZpZXdBY3Rpb25Db250ZXh0ID0+ICh7IC4uLmRhdGEuY29udGV4dCwgd2VidmlldzogdGhpcy5wcm92aWRlZFZpZXdUeXBlIH0pLFxuXHRcdFx0XHRnZXRBbmNob3I6ICgpID0+ICh7XG5cdFx0XHRcdFx0eDogZWxlbWVudEJveC54ICsgZGF0YS5jbGllbnRYLFxuXHRcdFx0XHRcdHk6IGVsZW1lbnRCb3gueSArIGRhdGEuY2xpZW50WVxuXHRcdFx0XHR9KVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9zZW5kKCdzZXQtY29udGV4dC1tZW51LXZpc2libGUnLCB7IHZpc2libGU6IHRydWUgfSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbignbG9hZC1yZXNvdXJjZScsIGFzeW5jIChlbnRyeSkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Ly8gUmVzdG9yZSB0aGUgYXV0aG9yaXR5IHdlIHByZXZpb3VzbHkgZW5jb2RlZFxuXHRcdFx0XHRjb25zdCBhdXRob3JpdHkgPSBkZWNvZGVBdXRob3JpdHkoZW50cnkuYXV0aG9yaXR5KTtcblx0XHRcdFx0Y29uc3QgdXJpID0gVVJJLmZyb20oe1xuXHRcdFx0XHRcdHNjaGVtZTogZW50cnkuc2NoZW1lLFxuXHRcdFx0XHRcdGF1dGhvcml0eTogYXV0aG9yaXR5LFxuXHRcdFx0XHRcdHBhdGg6IGRlY29kZVVSSUNvbXBvbmVudChlbnRyeS5wYXRoKSwgLy8gVGhpcyBnZXRzIHJlLWVuY29kZWRcblx0XHRcdFx0XHRxdWVyeTogZW50cnkucXVlcnkgPyBkZWNvZGVVUklDb21wb25lbnQoZW50cnkucXVlcnkpIDogZW50cnkucXVlcnksXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLmxvYWRSZXNvdXJjZShlbnRyeS5pZCwgdXJpLCBlbnRyeS5pZk5vbmVNYXRjaCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMuX3NlbmQoJ2RpZC1sb2FkLXJlc291cmNlJywge1xuXHRcdFx0XHRcdGlkOiBlbnRyeS5pZCxcblx0XHRcdFx0XHRzdGF0dXM6IDQwNCxcblx0XHRcdFx0XHRwYXRoOiBlbnRyeS5wYXRoLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCdsb2FkLWxvY2FsaG9zdCcsIChlbnRyeSkgPT4ge1xuXHRcdFx0dGhpcy5sb2NhbExvY2FsaG9zdChlbnRyeS5pZCwgZW50cnkub3JpZ2luKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUod2Vidmlld1RoZW1lRGF0YVByb3ZpZGVyLm9uVGhlbWVEYXRhQ2hhbmdlZCwgKCkgPT4gdGhpcy5zdHlsZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX2FjY2Vzc2liaWxpdHlTZXJ2aWNlLm9uRGlkQ2hhbmdlUmVkdWNlZE1vdGlvbigoKSA9PiB0aGlzLnN0eWxlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfYWNjZXNzaWJpbGl0eVNlcnZpY2Uub25EaWRDaGFuZ2VTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKCkgPT4gdGhpcy5zdHlsZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29udGV4dE1lbnVTZXJ2aWNlLm9uRGlkSGlkZUNvbnRleHRNZW51KCgpID0+IHRoaXMuX3NlbmQoJ3NldC1jb250ZXh0LW1lbnUtdmlzaWJsZScsIHsgdmlzaWJsZTogZmFsc2UgfSkpKTtcblxuXHRcdHRoaXMuX2NvbmZpcm1CZWZvcmVDbG9zZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oJ3dpbmRvdy5jb25maXJtQmVmb3JlQ2xvc2UnKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCd3aW5kb3cuY29uZmlybUJlZm9yZUNsb3NlJykpIHtcblx0XHRcdFx0dGhpcy5fY29uZmlybUJlZm9yZUNsb3NlID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3dpbmRvdy5jb25maXJtQmVmb3JlQ2xvc2UnKTtcblx0XHRcdFx0dGhpcy5fc2VuZCgnc2V0LWNvbmZpcm0tYmVmb3JlLWNsb3NlJywgdGhpcy5fY29uZmlybUJlZm9yZUNsb3NlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCdkcmFnLXN0YXJ0JywgKCkgPT4ge1xuXHRcdFx0dGhpcy5fc3RhcnRCbG9ja2luZ0lmcmFtZURyYWdFdmVudHMoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCdkcmFnJywgKGV2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLmhhbmRsZURyYWdFdmVudCgnZHJhZycsIGV2ZW50KTtcblx0XHR9KSk7XG5cblx0XHRpZiAoaW5pdEluZm8ub3B0aW9ucy5lbmFibGVGaW5kV2lkZ2V0KSB7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3RmluZFdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdlYnZpZXdGaW5kV2lkZ2V0LCB0aGlzKSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NlZCA9IHRydWU7XG5cblx0XHR0aGlzLmVsZW1lbnQ/LnJlbW92ZSgpO1xuXHRcdHRoaXMuX2VsZW1lbnQgPSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLl9tZXNzYWdlUG9ydCA9IHVuZGVmaW5lZDtcblxuXHRcdGlmICh0aGlzLl9zdGF0ZS50eXBlID09PSBXZWJ2aWV3U3RhdGUuVHlwZS5Jbml0aWFsaXppbmcpIHtcblx0XHRcdGZvciAoY29uc3QgbWVzc2FnZSBvZiB0aGlzLl9zdGF0ZS5wZW5kaW5nTWVzc2FnZXMpIHtcblx0XHRcdFx0bWVzc2FnZS5yZXNvbHZlKGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3N0YXRlLnBlbmRpbmdNZXNzYWdlcyA9IFtdO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkRGlzcG9zZS5maXJlKCk7XG5cblx0XHR0aGlzLl9yZXNvdXJjZUxvYWRpbmdDdHMuZGlzcG9zZSh0cnVlKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHNldENvbnRleHRLZXlTZXJ2aWNlKGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UpIHtcblx0XHR0aGlzLl9jb250ZXh0S2V5U2VydmljZSA9IGNvbnRleHRLZXlTZXJ2aWNlO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25NaXNzaW5nQ3NwID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RXh0ZW5zaW9uSWRlbnRpZmllcj4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbk1pc3NpbmdDc3AgPSB0aGlzLl9vbk1pc3NpbmdDc3AuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbGlja0xpbmsgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDbGlja0xpbmsgPSB0aGlzLl9vbkRpZENsaWNrTGluay5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlbG9hZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRSZWxvYWQgPSB0aGlzLl9vbkRpZFJlbG9hZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbk1lc3NhZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxXZWJ2aWV3TWVzc2FnZVJlY2VpdmVkRXZlbnQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25NZXNzYWdlID0gdGhpcy5fb25NZXNzYWdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2Nyb2xsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZWFkb25seSBzY3JvbGxZUGVyY2VudGFnZTogbnVtYmVyIH0+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRTY3JvbGwgPSB0aGlzLl9vbkRpZFNjcm9sbC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFdoZWVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU1vdXNlV2hlZWxFdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFdoZWVsID0gdGhpcy5fb25EaWRXaGVlbC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFVwZGF0ZVN0YXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nIHwgdW5kZWZpbmVkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkVXBkYXRlU3RhdGUgPSB0aGlzLl9vbkRpZFVwZGF0ZVN0YXRlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRm9jdXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkRm9jdXMgPSB0aGlzLl9vbkRpZEZvY3VzLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQmx1ciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRCbHVyID0gdGhpcy5fb25EaWRCbHVyLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRmF0YWxFcnJvciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgcmVhZG9ubHkgbWVzc2FnZTogc3RyaW5nIH0+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25GYXRhbEVycm9yID0gdGhpcy5fb25GYXRhbEVycm9yLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWREaXNwb3NlID0gdGhpcy5fb25EaWREaXNwb3NlLmV2ZW50O1xuXG5cdHB1YmxpYyBwb3N0TWVzc2FnZShtZXNzYWdlOiBhbnksIHRyYW5zZmVyPzogQXJyYXlCdWZmZXJbXSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0aGlzLl9zZW5kKCdtZXNzYWdlJywgeyBtZXNzYWdlLCB0cmFuc2ZlciB9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3NlbmQ8SyBleHRlbmRzIGtleW9mIFRvV2Vidmlld01lc3NhZ2U+KGNoYW5uZWw6IEssIGRhdGE6IFRvV2Vidmlld01lc3NhZ2VbS10sIF9jcmVhdGVFbGVtZW50OiBUcmFuc2ZlcmFibGVbXSA9IFtdKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlLnR5cGUgPT09IFdlYnZpZXdTdGF0ZS5UeXBlLkluaXRpYWxpemluZykge1xuXHRcdFx0Y29uc3QgeyBwcm9taXNlLCByZXNvbHZlIH0gPSBwcm9taXNlV2l0aFJlc29sdmVyczxib29sZWFuPigpO1xuXHRcdFx0dGhpcy5fc3RhdGUucGVuZGluZ01lc3NhZ2VzLnB1c2goeyBjaGFubmVsLCBkYXRhLCB0cmFuc2ZlcmFibGU6IF9jcmVhdGVFbGVtZW50LCByZXNvbHZlIH0pO1xuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLmRvUG9zdE1lc3NhZ2UoY2hhbm5lbCwgZGF0YSwgX2NyZWF0ZUVsZW1lbnQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUVsZW1lbnQob3B0aW9uczogV2Vidmlld09wdGlvbnMsIF9jb250ZW50T3B0aW9uczogV2Vidmlld0NvbnRlbnRPcHRpb25zKSB7XG5cdFx0Ly8gRG8gbm90IHN0YXJ0IGxvYWRpbmcgdGhlIHdlYnZpZXcgeWV0LlxuXHRcdC8vIFdhaXQgdGhlIGVuZCBvZiB0aGUgY3RvciB3aGVuIGFsbCBsaXN0ZW5lcnMgaGF2ZSBiZWVuIGhvb2tlZCB1cC5cblx0XHRjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG5cdFx0ZWxlbWVudC5uYW1lID0gdGhpcy5pZDtcblx0XHRlbGVtZW50LmNsYXNzTmFtZSA9IGB3ZWJ2aWV3ICR7b3B0aW9ucy5jdXN0b21DbGFzc2VzIHx8ICcnfWA7XG5cdFx0ZWxlbWVudC5zYW5kYm94LmFkZCgnYWxsb3ctc2NyaXB0cycsICdhbGxvdy1zYW1lLW9yaWdpbicsICdhbGxvdy1mb3JtcycsICdhbGxvdy1wb2ludGVyLWxvY2snLCAnYWxsb3ctZG93bmxvYWRzJyk7XG5cblx0XHRjb25zdCBhbGxvd1J1bGVzID0gWydjcm9zcy1vcmlnaW4taXNvbGF0ZWQnLCAnYXV0b3BsYXknXTtcblx0XHRpZiAoIWlzRmlyZWZveCkge1xuXHRcdFx0YWxsb3dSdWxlcy5wdXNoKCdjbGlwYm9hcmQtcmVhZCcsICdjbGlwYm9hcmQtd3JpdGUnKTtcblx0XHR9XG5cdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FsbG93JywgYWxsb3dSdWxlcy5qb2luKCc7ICcpKTtcblxuXHRcdGVsZW1lbnQuc3R5bGUuYm9yZGVyID0gJ25vbmUnO1xuXHRcdGVsZW1lbnQuc3R5bGUud2lkdGggPSAnMTAwJSc7XG5cdFx0ZWxlbWVudC5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG5cblx0XHRlbGVtZW50LmZvY3VzID0gKCkgPT4ge1xuXHRcdFx0dGhpcy5fZG9Gb2N1cygpO1xuXHRcdH07XG5cblx0XHRyZXR1cm4gZWxlbWVudDtcblx0fVxuXG5cdHByaXZhdGUgX2luaXRFbGVtZW50KGVuY29kZWRXZWJ2aWV3T3JpZ2luOiBzdHJpbmcsIGV4dGVuc2lvbjogV2Vidmlld0V4dGVuc2lvbkRlc2NyaXB0aW9uIHwgdW5kZWZpbmVkLCBvcHRpb25zOiBXZWJ2aWV3T3B0aW9ucywgdGFyZ2V0V2luZG93OiBDb2RlV2luZG93KSB7XG5cdFx0Ly8gVGhlIGV4dGVuc2lvbklkIGFuZCBwdXJwb3NlIGluIHRoZSBVUkwgYXJlIHVzZWQgZm9yIGZpbHRlcmluZyBpbiBqcy1kZWJ1Zzpcblx0XHRjb25zdCBwYXJhbXM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG5cdFx0XHRpZDogdGhpcy5pZCxcblx0XHRcdG9yaWdpbjogdGhpcy5vcmlnaW4sXG5cdFx0XHRzd1ZlcnNpb246IFN0cmluZyh0aGlzLl9leHBlY3RlZFNlcnZpY2VXb3JrZXJWZXJzaW9uKSxcblx0XHRcdGV4dGVuc2lvbklkOiBleHRlbnNpb24/LmlkLnZhbHVlID8/ICcnLFxuXHRcdFx0cGxhdGZvcm06IHRoaXMucGxhdGZvcm0sXG5cdFx0XHQndnNjb2RlLXJlc291cmNlLWJhc2UtYXV0aG9yaXR5Jzogd2Vidmlld1Jvb3RSZXNvdXJjZUF1dGhvcml0eSxcblx0XHRcdHBhcmVudE9yaWdpbjogdGFyZ2V0V2luZG93Lm9yaWdpbixcblx0XHR9O1xuXG5cdFx0aWYgKHRoaXMuX29wdGlvbnMuZGlzYWJsZVNlcnZpY2VXb3JrZXIpIHtcblx0XHRcdHBhcmFtcy5kaXNhYmxlU2VydmljZVdvcmtlciA9ICd0cnVlJztcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0cGFyYW1zLnJlbW90ZUF1dGhvcml0eSA9IHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHk7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMucHVycG9zZSkge1xuXHRcdFx0cGFyYW1zLnB1cnBvc2UgPSBvcHRpb25zLnB1cnBvc2U7XG5cdFx0fVxuXG5cdFx0Q09JLmFkZFNlYXJjaFBhcmFtKHBhcmFtcywgdHJ1ZSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBxdWVyeVN0cmluZyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMocGFyYW1zKS50b1N0cmluZygpO1xuXG5cdFx0Ly8gV29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTc1NDg3MlxuXHRcdGNvbnN0IGZpbGVOYW1lID0gaXNGaXJlZm94ID8gJ2luZGV4LW5vLWNzcC5odG1sJyA6ICdpbmRleC5odG1sJztcblxuXHRcdHRoaXMuZWxlbWVudCEuc2V0QXR0cmlidXRlKCdzcmMnLCBgJHt0aGlzLndlYnZpZXdDb250ZW50RW5kcG9pbnQoZW5jb2RlZFdlYnZpZXdPcmlnaW4pfS8ke2ZpbGVOYW1lfT8ke3F1ZXJ5U3RyaW5nfWApO1xuXHR9XG5cblx0cHVibGljIG1vdW50VG8oZWxlbWVudDogSFRNTEVsZW1lbnQsIHRhcmdldFdpbmRvdzogQ29kZVdpbmRvdykge1xuXHRcdGlmICghdGhpcy5lbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fd2luZG93SWQgPSB0YXJnZXRXaW5kb3cudnNjb2RlV2luZG93SWQ7XG5cdFx0dGhpcy5fZW5jb2RlZFdlYnZpZXdPcmlnaW5Qcm9taXNlID0gcGFyZW50T3JpZ2luSGFzaCh0YXJnZXRXaW5kb3cub3JpZ2luLCB0aGlzLm9yaWdpbikudGhlbihpZCA9PiB0aGlzLl9lbmNvZGVkV2Vidmlld09yaWdpbiA9IGlkKTtcblx0XHR0aGlzLl9lbmNvZGVkV2Vidmlld09yaWdpblByb21pc2UudGhlbihlbmNvZGVkV2Vidmlld09yaWdpbiA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHRoaXMuX2luaXRFbGVtZW50KGVuY29kZWRXZWJ2aWV3T3JpZ2luLCB0aGlzLmV4dGVuc2lvbiwgdGhpcy5fb3B0aW9ucywgdGFyZ2V0V2luZG93KTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlck1lc3NhZ2VIYW5kbGVyKHRhcmdldFdpbmRvdyk7XG5cblx0XHRpZiAodGhpcy5fd2Vidmlld0ZpbmRXaWRnZXQpIHtcblx0XHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5fd2Vidmlld0ZpbmRXaWRnZXQuZ2V0RG9tTm9kZSgpKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGV2ZW50TmFtZSBvZiBbRXZlbnRUeXBlLk1PVVNFX0RPV04sIEV2ZW50VHlwZS5NT1VTRV9NT1ZFLCBFdmVudFR5cGUuRFJPUF0pIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50LCBldmVudE5hbWUsICgpID0+IHtcblx0XHRcdFx0dGhpcy5fc3RvcEJsb2NraW5nSWZyYW1lRHJhZ0V2ZW50cygpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3Qgbm9kZSBvZiBbZWxlbWVudCwgdGFyZ2V0V2luZG93XSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKG5vZGUsIEV2ZW50VHlwZS5EUkFHX0VORCwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9zdG9wQmxvY2tpbmdJZnJhbWVEcmFnRXZlbnRzKCk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0ZWxlbWVudC5pZCA9IHRoaXMuaWQ7IC8vIFRoaXMgaXMgdXNlZCBieSBhcmlhLWZsb3cgZm9yIGFjY2Vzc2liaWxpdHkgb3JkZXJcblxuXHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50KTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyTWVzc2FnZUhhbmRsZXIodGFyZ2V0V2luZG93OiBDb2RlV2luZG93KSB7XG5cdFx0Y29uc3Qgc3Vic2NyaXB0aW9uID0gdGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRhcmdldFdpbmRvdywgJ21lc3NhZ2UnLCAoZTogTWVzc2FnZUV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2VuY29kZWRXZWJ2aWV3T3JpZ2luIHx8IGU/LmRhdGE/LnRhcmdldCAhPT0gdGhpcy5pZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLm9yaWdpbiAhPT0gdGhpcy5fd2Vidmlld0NvbnRlbnRPcmlnaW4odGhpcy5fZW5jb2RlZFdlYnZpZXdPcmlnaW4pKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBTa2lwcGVkIHJlbmRlcmVyIHJlY2VpdmluZyBtZXNzYWdlIGR1ZSB0byBtaXNtYXRjaGVkIG9yaWdpbnM6ICR7ZS5vcmlnaW59ICR7dGhpcy5fd2Vidmlld0NvbnRlbnRPcmlnaW59YCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuZGF0YS5jaGFubmVsID09PSAnd2Vidmlldy1yZWFkeScpIHtcblx0XHRcdFx0aWYgKHRoaXMuX21lc3NhZ2VQb3J0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZyhgV2Vidmlldygke3RoaXMuaWR9KTogd2VidmlldyByZWFkeWApO1xuXG5cdFx0XHRcdHRoaXMuX21lc3NhZ2VQb3J0ID0gZS5wb3J0c1swXTtcblx0XHRcdFx0dGhpcy5fbWVzc2FnZVBvcnQub25tZXNzYWdlID0gKGUpID0+IHtcblx0XHRcdFx0XHRjb25zdCBoYW5kbGVycyA9IHRoaXMuX21lc3NhZ2VIYW5kbGVycy5nZXQoZS5kYXRhLmNoYW5uZWwpO1xuXHRcdFx0XHRcdGlmICghaGFuZGxlcnMpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBObyBoYW5kbGVycyBmb3VuZCBmb3IgJyR7ZS5kYXRhLmNoYW5uZWx9J2ApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRoYW5kbGVycz8uZm9yRWFjaChoYW5kbGVyID0+IGhhbmRsZXIoZS5kYXRhLmRhdGEsIGUpKTtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHR0aGlzLmVsZW1lbnQ/LmNsYXNzTGlzdC5hZGQoJ3JlYWR5Jyk7XG5cblx0XHRcdFx0aWYgKHRoaXMuX3N0YXRlLnR5cGUgPT09IFdlYnZpZXdTdGF0ZS5UeXBlLkluaXRpYWxpemluZykge1xuXHRcdFx0XHRcdHRoaXMuX3N0YXRlLnBlbmRpbmdNZXNzYWdlcy5mb3JFYWNoKCh7IGNoYW5uZWwsIGRhdGEsIHJlc29sdmUgfSkgPT4gcmVzb2x2ZSh0aGlzLmRvUG9zdE1lc3NhZ2UoY2hhbm5lbCwgZGF0YSkpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9zdGF0ZSA9IFdlYnZpZXdTdGF0ZS5SZWFkeTtcblxuXHRcdFx0XHRzdWJzY3JpcHRpb24uZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3N0YXJ0QmxvY2tpbmdJZnJhbWVEcmFnRXZlbnRzKCkge1xuXHRcdGlmICh0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3N0b3BCbG9ja2luZ0lmcmFtZURyYWdFdmVudHMoKSB7XG5cdFx0aWYgKHRoaXMuZWxlbWVudCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnYXV0byc7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIHdlYnZpZXdDb250ZW50RW5kcG9pbnQoZW5jb2RlZFdlYnZpZXdPcmlnaW46IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgd2Vidmlld0V4dGVybmFsRW5kcG9pbnQgPSB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2Uud2Vidmlld0V4dGVybmFsRW5kcG9pbnQ7XG5cdFx0aWYgKCF3ZWJ2aWV3RXh0ZXJuYWxFbmRwb2ludCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGAnd2Vidmlld0V4dGVybmFsRW5kcG9pbnQnIGhhcyBub3QgYmVlbiBjb25maWd1cmVkLiBXZWJ2aWV3cyB3aWxsIG5vdCB3b3JrIWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVuZHBvaW50ID0gd2Vidmlld0V4dGVybmFsRW5kcG9pbnQucmVwbGFjZSgne3t1dWlkfX0nLCBlbmNvZGVkV2Vidmlld09yaWdpbik7XG5cdFx0aWYgKGVuZHBvaW50W2VuZHBvaW50Lmxlbmd0aCAtIDFdID09PSAnLycpIHtcblx0XHRcdHJldHVybiBlbmRwb2ludC5zbGljZSgwLCBlbmRwb2ludC5sZW5ndGggLSAxKTtcblx0XHR9XG5cdFx0cmV0dXJuIGVuZHBvaW50O1xuXHR9XG5cblx0cHJpdmF0ZSBfd2Vidmlld0NvbnRlbnRPcmlnaW4oZW5jb2RlZFdlYnZpZXdPcmlnaW46IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKHRoaXMud2Vidmlld0NvbnRlbnRFbmRwb2ludChlbmNvZGVkV2Vidmlld09yaWdpbikpO1xuXHRcdHJldHVybiB1cmkuc2NoZW1lICsgJzovLycgKyB1cmkuYXV0aG9yaXR5LnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHRwcml2YXRlIGRvUG9zdE1lc3NhZ2UoY2hhbm5lbDogc3RyaW5nLCBkYXRhPzogYW55LCB0cmFuc2ZlcmFibGU6IFRyYW5zZmVyYWJsZVtdID0gW10pOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5lbGVtZW50ICYmIHRoaXMuX21lc3NhZ2VQb3J0KSB7XG5cdFx0XHR0aGlzLl9tZXNzYWdlUG9ydC5wb3N0TWVzc2FnZSh7IGNoYW5uZWwsIGFyZ3M6IGRhdGEgfSwgdHJhbnNmZXJhYmxlKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIG9uPEsgZXh0ZW5kcyBrZXlvZiBGcm9tV2Vidmlld01lc3NhZ2U+KGNoYW5uZWw6IEssIGhhbmRsZXI6IChkYXRhOiBGcm9tV2Vidmlld01lc3NhZ2VbS10sIGU6IE1lc3NhZ2VFdmVudCkgPT4gdm9pZCk6IElEaXNwb3NhYmxlIHtcblx0XHRsZXQgaGFuZGxlcnMgPSB0aGlzLl9tZXNzYWdlSGFuZGxlcnMuZ2V0KGNoYW5uZWwpO1xuXHRcdGlmICghaGFuZGxlcnMpIHtcblx0XHRcdGhhbmRsZXJzID0gbmV3IFNldCgpO1xuXHRcdFx0dGhpcy5fbWVzc2FnZUhhbmRsZXJzLnNldChjaGFubmVsLCBoYW5kbGVycyk7XG5cdFx0fVxuXG5cdFx0aGFuZGxlcnMuYWRkKGhhbmRsZXIpO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbWVzc2FnZUhhbmRsZXJzLmdldChjaGFubmVsKT8uZGVsZXRlKGhhbmRsZXIpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFzQWxlcnRlZEFib3V0TWlzc2luZ0NzcCA9IGZhbHNlO1xuXHRwcml2YXRlIGhhbmRsZU5vQ3NwRm91bmQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2hhc0FsZXJ0ZWRBYm91dE1pc3NpbmdDc3ApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5faGFzQWxlcnRlZEFib3V0TWlzc2luZ0NzcCA9IHRydWU7XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24/LmlkKSB7XG5cdFx0XHRpZiAodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQpIHtcblx0XHRcdFx0dGhpcy5fb25NaXNzaW5nQ3NwLmZpcmUodGhpcy5leHRlbnNpb24uaWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyByZWxvYWQoKTogdm9pZCB7XG5cdFx0dGhpcy5kb1VwZGF0ZUNvbnRlbnQodGhpcy5fY29udGVudCk7XG5cblx0XHRjb25zdCBzdWJzY3JpcHRpb24gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLm9uKCdkaWQtbG9hZCcsICgpID0+IHtcblx0XHRcdHRoaXMuX29uRGlkUmVsb2FkLmZpcmUoKTtcblx0XHRcdHN1YnNjcmlwdGlvbi5kaXNwb3NlKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIHNldEh0bWwoaHRtbDogc3RyaW5nKSB7XG5cdFx0dGhpcy5kb1VwZGF0ZUNvbnRlbnQoeyAuLi50aGlzLl9jb250ZW50LCBodG1sIH0pO1xuXHRcdHRoaXMuX29uRGlkSHRtbENoYW5nZS5maXJlKGh0bWwpO1xuXHR9XG5cblx0cHVibGljIHNldFRpdGxlKHRpdGxlOiBzdHJpbmcpIHtcblx0XHR0aGlzLl9jb250ZW50ID0geyAuLi50aGlzLl9jb250ZW50LCB0aXRsZSB9O1xuXHRcdHRoaXMuX3NlbmQoJ3NldC10aXRsZScsIHRpdGxlKTtcblx0fVxuXG5cdHB1YmxpYyBzZXQgY29udGVudE9wdGlvbnMob3B0aW9uczogV2Vidmlld0NvbnRlbnRPcHRpb25zKSB7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZyhgV2Vidmlldygke3RoaXMuaWR9KTogd2lsbCB1cGRhdGUgY29udGVudCBvcHRpb25zYCk7XG5cblx0XHRpZiAoYXJlV2Vidmlld0NvbnRlbnRPcHRpb25zRXF1YWwob3B0aW9ucywgdGhpcy5fY29udGVudC5vcHRpb25zKSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZyhgV2Vidmlldygke3RoaXMuaWR9KTogc2tpcHBpbmcgY29udGVudCBvcHRpb25zIHVwZGF0ZWApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZG9VcGRhdGVDb250ZW50KHsgLi4udGhpcy5fY29udGVudCwgb3B0aW9ucyB9KTtcblx0fVxuXG5cdHB1YmxpYyBzZXQgbG9jYWxSZXNvdXJjZXNSb290KHJlc291cmNlczogcmVhZG9ubHkgVVJJW10pIHtcblx0XHR0aGlzLl9jb250ZW50ID0ge1xuXHRcdFx0Li4udGhpcy5fY29udGVudCxcblx0XHRcdG9wdGlvbnM6IHsgLi4udGhpcy5fY29udGVudC5vcHRpb25zLCBsb2NhbFJlc291cmNlUm9vdHM6IHJlc291cmNlcyB9XG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBzZXQgc3RhdGUoc3RhdGU6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2NvbnRlbnQgPSB7IC4uLnRoaXMuX2NvbnRlbnQsIHN0YXRlIH07XG5cdH1cblxuXHRwdWJsaWMgc2V0IGluaXRpYWxTY3JvbGxQcm9ncmVzcyh2YWx1ZTogbnVtYmVyKSB7XG5cdFx0dGhpcy5fc2VuZCgnaW5pdGlhbC1zY3JvbGwtcG9zaXRpb24nLCB2YWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGRvVXBkYXRlQ29udGVudChuZXdDb250ZW50OiBXZWJ2aWV3Q29udGVudCkge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYFdlYnZpZXcoJHt0aGlzLmlkfSk6IHdpbGwgdXBkYXRlIGNvbnRlbnRgKTtcblxuXHRcdHRoaXMuX2NvbnRlbnQgPSBuZXdDb250ZW50O1xuXG5cdFx0Y29uc3QgYWxsb3dTY3JpcHRzID0gISF0aGlzLl9jb250ZW50Lm9wdGlvbnMuYWxsb3dTY3JpcHRzO1xuXHRcdHRoaXMuX3NlbmQoJ2NvbnRlbnQnLCB7XG5cdFx0XHRjb250ZW50czogdGhpcy5fY29udGVudC5odG1sLFxuXHRcdFx0dGl0bGU6IHRoaXMuX2NvbnRlbnQudGl0bGUsXG5cdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdGFsbG93TXVsdGlwbGVBUElBY3F1aXJlOiAhIXRoaXMuX2NvbnRlbnQub3B0aW9ucy5hbGxvd011bHRpcGxlQVBJQWNxdWlyZSxcblx0XHRcdFx0YWxsb3dTY3JpcHRzOiBhbGxvd1NjcmlwdHMsXG5cdFx0XHRcdGFsbG93Rm9ybXM6IHRoaXMuX2NvbnRlbnQub3B0aW9ucy5hbGxvd0Zvcm1zID8/IGFsbG93U2NyaXB0cywgLy8gRm9yIGJhY2sgY29tcGF0LCB3ZSBhbGxvdyBmb3JtcyBieSBkZWZhdWx0IHdoZW4gc2NyaXB0cyBhcmUgZW5hYmxlZFxuXHRcdFx0fSxcblx0XHRcdHN0YXRlOiB0aGlzLl9jb250ZW50LnN0YXRlLFxuXHRcdFx0Y3NwU291cmNlOiB3ZWJ2aWV3R2VuZXJpY0NzcFNvdXJjZSxcblx0XHRcdGNvbmZpcm1CZWZvcmVDbG9zZTogdGhpcy5fY29uZmlybUJlZm9yZUNsb3NlLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIHN0eWxlKCk6IHZvaWQge1xuXHRcdGxldCB7IHN0eWxlcywgYWN0aXZlVGhlbWUsIHRoZW1lTGFiZWwsIHRoZW1lSWQgfSA9IHRoaXMud2Vidmlld1RoZW1lRGF0YVByb3ZpZGVyLmdldFdlYnZpZXdUaGVtZURhdGEoKTtcblx0XHRpZiAodGhpcy5fb3B0aW9ucy50cmFuc2Zvcm1Dc3NWYXJpYWJsZXMpIHtcblx0XHRcdHN0eWxlcyA9IHRoaXMuX29wdGlvbnMudHJhbnNmb3JtQ3NzVmFyaWFibGVzKHN0eWxlcyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVkdWNlTW90aW9uID0gdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNNb3Rpb25SZWR1Y2VkKCk7XG5cdFx0Y29uc3Qgc2NyZWVuUmVhZGVyID0gdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKTtcblxuXHRcdHRoaXMuX3NlbmQoJ3N0eWxlcycsIHsgc3R5bGVzLCBhY3RpdmVUaGVtZSwgdGhlbWVJZCwgdGhlbWVMYWJlbCwgcmVkdWNlTW90aW9uLCBzY3JlZW5SZWFkZXIgfSk7XG5cdH1cblxuXG5cdHByb3RlY3RlZCBoYW5kbGVGb2N1c0NoYW5nZShpc0ZvY3VzZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9mb2N1c2VkID0gaXNGb2N1c2VkO1xuXHRcdGlmIChpc0ZvY3VzZWQpIHtcblx0XHRcdHRoaXMuX29uRGlkRm9jdXMuZmlyZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9vbkRpZEJsdXIuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlS2V5RXZlbnQodHlwZTogJ2tleWRvd24nIHwgJ2tleXVwJywgZXZlbnQ6IEtleUV2ZW50KSB7XG5cdFx0Ly8gQ3JlYXRlIGEgZmFrZSBLZXlib2FyZEV2ZW50IGZyb20gdGhlIGRhdGEgcHJvdmlkZWRcblx0XHRjb25zdCBlbXVsYXRlZEtleWJvYXJkRXZlbnQgPSBuZXcgS2V5Ym9hcmRFdmVudCh0eXBlLCBldmVudCk7XG5cdFx0Ly8gRm9yY2Ugb3ZlcnJpZGUgdGhlIHRhcmdldFxuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlbXVsYXRlZEtleWJvYXJkRXZlbnQsICd0YXJnZXQnLCB7XG5cdFx0XHRnZXQ6ICgpID0+IHRoaXMuZWxlbWVudCxcblx0XHR9KTtcblx0XHQvLyBBbmQgcmUtZGlzcGF0Y2hcblx0XHR0aGlzLndpbmRvdz8uZGlzcGF0Y2hFdmVudChlbXVsYXRlZEtleWJvYXJkRXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVEcmFnRXZlbnQodHlwZTogJ2RyYWcnLCBldmVudDogV2ViVmlld0RyYWdFdmVudCkge1xuXHRcdC8vIENyZWF0ZSBhIGZha2UgRHJhZ0V2ZW50IGZyb20gdGhlIGRhdGEgcHJvdmlkZWRcblx0XHRjb25zdCBlbXVsYXRlZERyYWdFdmVudCA9IG5ldyBEcmFnRXZlbnQodHlwZSwgZXZlbnQpO1xuXHRcdC8vIEZvcmNlIG92ZXJyaWRlIHRoZSB0YXJnZXRcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZW11bGF0ZWREcmFnRXZlbnQsICd0YXJnZXQnLCB7XG5cdFx0XHRnZXQ6ICgpID0+IHRoaXMuZWxlbWVudCxcblx0XHR9KTtcblx0XHQvLyBBbmQgcmUtZGlzcGF0Y2hcblx0XHR0aGlzLndpbmRvdz8uZGlzcGF0Y2hFdmVudChlbXVsYXRlZERyYWdFdmVudCk7XG5cdH1cblxuXHR3aW5kb3dEaWREcmFnU3RhcnQoKTogdm9pZCB7XG5cdFx0Ly8gV2VidmlldyBicmVhayBkcmFnIGFuZCBkcm9wcGluZyBhcm91bmQgdGhlIG1haW4gd2luZG93IChubyBldmVudHMgYXJlIGdlbmVyYXRlZCB3aGVuIHlvdSBhcmUgb3ZlciB0aGVtKVxuXHRcdC8vIFdvcmsgYXJvdW5kIHRoaXMgYnkgZGlzYWJsaW5nIHBvaW50ZXIgZXZlbnRzIGR1cmluZyB0aGUgZHJhZy5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24vZWxlY3Ryb24vaXNzdWVzLzE4MjI2XG5cdFx0dGhpcy5fc3RhcnRCbG9ja2luZ0lmcmFtZURyYWdFdmVudHMoKTtcblx0fVxuXG5cdHdpbmRvd0RpZERyYWdFbmQoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RvcEJsb2NraW5nSWZyYW1lRHJhZ0V2ZW50cygpO1xuXHR9XG5cblx0cHVibGljIHNlbGVjdEFsbCgpIHtcblx0XHR0aGlzLmV4ZWNDb21tYW5kKCdzZWxlY3RBbGwnKTtcblx0fVxuXG5cdHB1YmxpYyBjb3B5KCkge1xuXHRcdHRoaXMuZXhlY0NvbW1hbmQoJ2NvcHknKTtcblx0fVxuXG5cdHB1YmxpYyBwYXN0ZSgpIHtcblx0XHR0aGlzLmV4ZWNDb21tYW5kKCdwYXN0ZScpO1xuXHR9XG5cblx0cHVibGljIGN1dCgpIHtcblx0XHR0aGlzLmV4ZWNDb21tYW5kKCdjdXQnKTtcblx0fVxuXG5cdHB1YmxpYyB1bmRvKCkge1xuXHRcdHRoaXMuZXhlY0NvbW1hbmQoJ3VuZG8nKTtcblx0fVxuXG5cdHB1YmxpYyByZWRvKCkge1xuXHRcdHRoaXMuZXhlY0NvbW1hbmQoJ3JlZG8nKTtcblx0fVxuXG5cdHByaXZhdGUgZXhlY0NvbW1hbmQoY29tbWFuZDogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMuZWxlbWVudCkge1xuXHRcdFx0dGhpcy5fc2VuZCgnZXhlY0NvbW1hbmQnLCBjb21tYW5kKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGxvYWRSZXNvdXJjZShpZDogbnVtYmVyLCB1cmk6IFVSSSwgaWZOb25lTWF0Y2g6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBsb2FkTG9jYWxSZXNvdXJjZSh1cmksIHtcblx0XHRcdFx0aWZOb25lTWF0Y2gsXG5cdFx0XHRcdHJvb3RzOiB0aGlzLl9jb250ZW50Lm9wdGlvbnMubG9jYWxSZXNvdXJjZVJvb3RzIHx8IFtdLFxuXHRcdFx0fSwgdGhpcy5fZmlsZVNlcnZpY2UsIHRoaXMuX2xvZ1NlcnZpY2UsIHRoaXMuX3Jlc291cmNlTG9hZGluZ0N0cy50b2tlbik7XG5cblx0XHRcdHN3aXRjaCAocmVzdWx0LnR5cGUpIHtcblx0XHRcdFx0Y2FzZSBXZWJ2aWV3UmVzb3VyY2VSZXNwb25zZS5UeXBlLlN1Y2Nlc3M6IHtcblx0XHRcdFx0XHRjb25zdCBidWZmZXIgPSBhd2FpdCB0aGlzLnN0cmVhbVRvQnVmZmVyKHJlc3VsdC5zdHJlYW0pO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9zZW5kKCdkaWQtbG9hZC1yZXNvdXJjZScsIHtcblx0XHRcdFx0XHRcdGlkLFxuXHRcdFx0XHRcdFx0c3RhdHVzOiAyMDAsXG5cdFx0XHRcdFx0XHRwYXRoOiB1cmkucGF0aCxcblx0XHRcdFx0XHRcdG1pbWU6IHJlc3VsdC5taW1lVHlwZSxcblx0XHRcdFx0XHRcdGRhdGE6IGJ1ZmZlcixcblx0XHRcdFx0XHRcdGV0YWc6IHJlc3VsdC5ldGFnLFxuXHRcdFx0XHRcdFx0bXRpbWU6IHJlc3VsdC5tdGltZVxuXHRcdFx0XHRcdH0sIFtidWZmZXJdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIFdlYnZpZXdSZXNvdXJjZVJlc3BvbnNlLlR5cGUuTm90TW9kaWZpZWQ6IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fc2VuZCgnZGlkLWxvYWQtcmVzb3VyY2UnLCB7XG5cdFx0XHRcdFx0XHRpZCxcblx0XHRcdFx0XHRcdHN0YXR1czogMzA0LCAvLyBub3QgbW9kaWZpZWRcblx0XHRcdFx0XHRcdHBhdGg6IHVyaS5wYXRoLFxuXHRcdFx0XHRcdFx0bWltZTogcmVzdWx0Lm1pbWVUeXBlLFxuXHRcdFx0XHRcdFx0bXRpbWU6IHJlc3VsdC5tdGltZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgV2Vidmlld1Jlc291cmNlUmVzcG9uc2UuVHlwZS5BY2Nlc3NEZW5pZWQ6IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fc2VuZCgnZGlkLWxvYWQtcmVzb3VyY2UnLCB7XG5cdFx0XHRcdFx0XHRpZCxcblx0XHRcdFx0XHRcdHN0YXR1czogNDAxLCAvLyB1bmF1dGhvcml6ZWRcblx0XHRcdFx0XHRcdHBhdGg6IHVyaS5wYXRoLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHQvLyBub29wXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3NlbmQoJ2RpZC1sb2FkLXJlc291cmNlJywge1xuXHRcdFx0aWQsXG5cdFx0XHRzdGF0dXM6IDQwNCxcblx0XHRcdHBhdGg6IHVyaS5wYXRoLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIHN0cmVhbVRvQnVmZmVyKHN0cmVhbTogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSk6IFByb21pc2U8QXJyYXlCdWZmZXJMaWtlPiB7XG5cdFx0Y29uc3QgdnNCdWZmZXIgPSBhd2FpdCBzdHJlYW1Ub0J1ZmZlcihzdHJlYW0pO1xuXHRcdHJldHVybiB2c0J1ZmZlci5idWZmZXIuYnVmZmVyO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBsb2NhbExvY2FsaG9zdChpZDogc3RyaW5nLCBvcmlnaW46IHN0cmluZykge1xuXHRcdGNvbnN0IGF1dGhvcml0eSA9IHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHk7XG5cdFx0Y29uc3QgcmVzb2x2ZUF1dGhvcml0eSA9IGF1dGhvcml0eSA/IGF3YWl0IHRoaXMuX3JlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZS5yZXNvbHZlQXV0aG9yaXR5KGF1dGhvcml0eSkgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcmVkaXJlY3QgPSByZXNvbHZlQXV0aG9yaXR5ID8gYXdhaXQgdGhpcy5fcG9ydE1hcHBpbmdNYW5hZ2VyLmdldFJlZGlyZWN0KHJlc29sdmVBdXRob3JpdHkuYXV0aG9yaXR5LCBvcmlnaW4pIDogdW5kZWZpbmVkO1xuXHRcdHJldHVybiB0aGlzLl9zZW5kKCdkaWQtbG9hZC1sb2NhbGhvc3QnLCB7XG5cdFx0XHRpZCxcblx0XHRcdG9yaWdpbixcblx0XHRcdGxvY2F0aW9uOiByZWRpcmVjdFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuX2RvRm9jdXMoKTtcblxuXHRcdC8vIEhhbmRsZSBmb2N1cyBjaGFuZ2UgcHJvZ3JhbW1hdGljYWxseSAoZG8gbm90IHJlbHkgb24gZXZlbnQgZnJvbSA8d2Vidmlldz4pXG5cdFx0dGhpcy5oYW5kbGVGb2N1c0NoYW5nZSh0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgX2RvRm9jdXMoKSB7XG5cdFx0aWYgKCF0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy5lbGVtZW50LmNvbnRlbnRXaW5kb3c/LmZvY3VzKCk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHQvLyBub29wXG5cdFx0fVxuXG5cdFx0Ly8gV29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzc1MjA5XG5cdFx0Ly8gRm9jdXNpbmcgdGhlIGlubmVyIHdlYnZpZXcgaXMgYXN5bmMgc28gZm9yIGEgc2VxdWVuY2Ugb2YgYWN0aW9ucyBzdWNoIGFzOlxuXHRcdC8vXG5cdFx0Ly8gMS4gT3BlbiB3ZWJ2aWV3XG5cdFx0Ly8gMS4gU2hvdyBxdWljayBwaWNrIGZyb20gY29tbWFuZCBwYWxldHRlXG5cdFx0Ly9cblx0XHQvLyBXZSBlbmQgdXAgZm9jdXNpbmcgdGhlIHdlYnZpZXcgYWZ0ZXIgc2hvd2luZyB0aGUgcXVpY2sgcGljaywgd2hpY2ggY2F1c2VzXG5cdFx0Ly8gdGhlIHF1aWNrIHBpY2sgdG8gaW5zdGFudGx5IGRpc21pc3MuXG5cdFx0Ly9cblx0XHQvLyBXb3JrYXJvdW5kIHRoaXMgYnkgZGVib3VuY2luZyB0aGUgZm9jdXMgYW5kIG1ha2luZyBzdXJlIHdlIGFyZSBub3QgZm9jdXNlZCBvbiBhbiBpbnB1dFxuXHRcdC8vIHdoZW4gd2UgdHJ5IHRvIHJlLWZvY3VzLlxuXHRcdHRoaXMuX2ZvY3VzRGVsYXllci50cmlnZ2VyKGFzeW5jICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5pc0ZvY3VzZWQgfHwgIXRoaXMuZWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLndpbmRvdz8uZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJiB0aGlzLndpbmRvdy5kb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSB0aGlzLmVsZW1lbnQgJiYgdGhpcy53aW5kb3cuZG9jdW1lbnQuYWN0aXZlRWxlbWVudD8udGFnTmFtZSAhPT0gJ0JPRFknKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSXQgaXMgcG9zc2libGUgZm9yIHRoZSB3ZWJ2aWV3IHRvIGJlIGNvbnRhaW5lZCBpbiBhbm90aGVyIHdpbmRvd1xuXHRcdFx0Ly8gdGhhdCBkb2VzIG5vdCBoYXZlIGZvY3VzLiBBcyBzdWNoLCBhbHNvIGZvY3VzIHRoZSBib2R5IG9mIHRoZVxuXHRcdFx0Ly8gd2VidmlldydzIHdpbmRvdyB0byBlbnN1cmUgaXQgaXMgcHJvcGVybHkgcmVjZWl2aW5nIGtleWJvYXJkIGZvY3VzLlxuXHRcdFx0dGhpcy53aW5kb3c/LmRvY3VtZW50LmJvZHk/LmZvY3VzKCk7XG5cblx0XHRcdHRoaXMuX3NlbmQoJ2ZvY3VzJywgdW5kZWZpbmVkKTtcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCByZWFkb25seSBfaGFzRmluZFJlc3VsdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgaGFzRmluZFJlc3VsdDogRXZlbnQ8Ym9vbGVhbj4gPSB0aGlzLl9oYXNGaW5kUmVzdWx0LmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRTdG9wRmluZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRTdG9wRmluZDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZFN0b3BGaW5kLmV2ZW50O1xuXG5cdC8qKlxuXHQgKiBXZWJ2aWV3cyBleHBvc2UgYSBzdGF0ZWZ1bCBmaW5kIEFQSS5cblx0ICogU3VjY2Vzc2l2ZSBjYWxscyB0byBmaW5kIHdpbGwgbW92ZSBmb3J3YXJkIG9yIGJhY2t3YXJkIHRocm91Z2ggb25GaW5kUmVzdWx0c1xuXHQgKiBkZXBlbmRpbmcgb24gdGhlIHN1cHBsaWVkIG9wdGlvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB2YWx1ZSBUaGUgc3RyaW5nIHRvIHNlYXJjaCBmb3IuIEVtcHR5IHN0cmluZ3MgYXJlIGlnbm9yZWQuXG5cdCAqL1xuXHRwdWJsaWMgZmluZCh2YWx1ZTogc3RyaW5nLCBwcmV2aW91czogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5lbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2VuZCgnZmluZCcsIHsgdmFsdWUsIHByZXZpb3VzIH0pO1xuXHR9XG5cblx0cHVibGljIHVwZGF0ZUZpbmQodmFsdWU6IHN0cmluZykge1xuXHRcdGlmICghdmFsdWUgfHwgIXRoaXMuZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9zZW5kKCdmaW5kJywgeyB2YWx1ZSB9KTtcblx0fVxuXG5cdHB1YmxpYyBzdG9wRmluZChrZWVwU2VsZWN0aW9uPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5lbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3NlbmQoJ2ZpbmQtc3RvcCcsIHsgY2xlYXJTZWxlY3Rpb246ICFrZWVwU2VsZWN0aW9uIH0pO1xuXHRcdHRoaXMuX29uRGlkU3RvcEZpbmQuZmlyZSgpO1xuXHR9XG5cblx0cHVibGljIHNob3dGaW5kKGFuaW1hdGVkID0gdHJ1ZSkge1xuXHRcdHRoaXMuX3dlYnZpZXdGaW5kV2lkZ2V0Py5yZXZlYWwodW5kZWZpbmVkLCBhbmltYXRlZCk7XG5cdH1cblxuXHRwdWJsaWMgaGlkZUZpbmQoYW5pbWF0ZWQgPSB0cnVlKSB7XG5cdFx0dGhpcy5fd2Vidmlld0ZpbmRXaWRnZXQ/LmhpZGUoYW5pbWF0ZWQpO1xuXHR9XG5cblx0cHVibGljIHJ1bkZpbmRBY3Rpb24ocHJldmlvdXM6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl93ZWJ2aWV3RmluZFdpZGdldD8uZmluZChwcmV2aW91cyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyx1QkFBdUIsV0FBVyxxQkFBcUI7QUFDaEUsU0FBUyx3QkFBd0I7QUFHakMsU0FBUyxzQkFBc0Isd0JBQXdCO0FBQ3ZELFNBQVMsc0JBQThDO0FBQ3ZELFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsWUFBeUIsb0JBQW9CO0FBQ3RELFNBQVMsV0FBVztBQUNwQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsMkJBQTJCO0FBRXBDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsaUJBQWlCLHlCQUF5QixvQ0FBb0M7QUFDdkYsU0FBUyxtQkFBbUIsK0JBQStCO0FBRTNELFNBQVMscUNBQWlLO0FBQzFLLFNBQThCLHlCQUF5QjtBQVV2RCxJQUFVO0FBQUEsQ0FBVixDQUFVQSxrQkFBVjtBQUNRLE1BQVc7QUFBWCxJQUFXQyxVQUFYO0FBQWtCLElBQUFBLFlBQUE7QUFBYyxJQUFBQSxZQUFBO0FBQUEsS0FBckIsT0FBQUQsY0FBQSxTQUFBQSxj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
