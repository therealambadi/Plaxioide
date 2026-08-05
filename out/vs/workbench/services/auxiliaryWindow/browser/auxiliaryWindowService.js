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
import { getZoomLevel } from "../../../../base/browser/browser.js";
import { $, Dimension, EventHelper, EventType, ModifierKeyEmitter, addDisposableListener, copyAttributes, createLinkElement, createMetaElement, getActiveWindow, getClientArea, getWindowId, isHTMLElement, position, registerWindow, sharedMutationObserver, trackAttributes } from "../../../../base/browser/dom.js";
import { cloneGlobalStylesheets, isGlobalStylesheet } from "../../../../base/browser/domStylesheets.js";
import { ensureCodeWindow, mainWindow } from "../../../../base/browser/window.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { Barrier } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { mark } from "../../../../base/common/performance.js";
import { isFirefox, isWeb } from "../../../../base/common/platform.js";
import Severity from "../../../../base/common/severity.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { DEFAULT_AUX_WINDOW_SIZE, WindowMinimumSize } from "../../../../platform/window/common/window.js";
import { BaseWindow } from "../../../browser/window.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IHostService } from "../../host/browser/host.js";
import { IWorkbenchLayoutService } from "../../layout/browser/layoutService.js";
const IAuxiliaryWindowService = createDecorator("auxiliaryWindowService");
var AuxiliaryWindowMode = /* @__PURE__ */ ((AuxiliaryWindowMode2) => {
  AuxiliaryWindowMode2[AuxiliaryWindowMode2["Maximized"] = 0] = "Maximized";
  AuxiliaryWindowMode2[AuxiliaryWindowMode2["Normal"] = 1] = "Normal";
  AuxiliaryWindowMode2[AuxiliaryWindowMode2["Fullscreen"] = 2] = "Fullscreen";
  return AuxiliaryWindowMode2;
})(AuxiliaryWindowMode || {});
const DEFAULT_AUX_WINDOW_DIMENSIONS = new Dimension(DEFAULT_AUX_WINDOW_SIZE.width, DEFAULT_AUX_WINDOW_SIZE.height);
let AuxiliaryWindow = class extends BaseWindow {
  constructor(window, container, stylesHaveLoaded, configurationService, hostService, environmentService) {
    super(window, void 0, hostService, environmentService);
    this.window = window;
    this.container = container;
    this.configurationService = configurationService;
    this._onWillLayout = this._register(new Emitter());
    this.onWillLayout = this._onWillLayout.event;
    this._onDidLayout = this._register(new Emitter());
    this.onDidLayout = this._onDidLayout.event;
    this._onBeforeUnload = this._register(new Emitter());
    this.onBeforeUnload = this._onBeforeUnload.event;
    this._onUnload = this._register(new Emitter());
    this.onUnload = this._onUnload.event;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this.whenStylesHaveLoaded = stylesHaveLoaded.wait().then(() => void 0);
    this.registerListeners();
  }
  registerListeners() {
    this._register(addDisposableListener(this.window, EventType.BEFORE_UNLOAD, (e) => this.handleBeforeUnload(e)));
    this._register(addDisposableListener(this.window, EventType.UNLOAD, () => this.handleUnload()));
    this._register(addDisposableListener(this.window, "unhandledrejection", (e) => {
      onUnexpectedError(e.reason);
      e.preventDefault();
    }));
    this._register(addDisposableListener(this.window, EventType.RESIZE, () => this.layout()));
    this._register(addDisposableListener(this.container, EventType.SCROLL, () => this.container.scrollTop = 0));
    if (isWeb) {
      this._register(addDisposableListener(this.container, EventType.DROP, (e) => EventHelper.stop(e, true)));
      this._register(addDisposableListener(this.container, EventType.WHEEL, (e) => e.preventDefault(), { passive: false }));
      this._register(addDisposableListener(this.container, EventType.CONTEXT_MENU, (e) => EventHelper.stop(e, true)));
    } else {
      this._register(addDisposableListener(this.window.document.body, EventType.DRAG_OVER, (e) => EventHelper.stop(e)));
      this._register(addDisposableListener(this.window.document.body, EventType.DROP, (e) => EventHelper.stop(e)));
    }
  }
  handleBeforeUnload(e) {
    let veto;
    this._onBeforeUnload.fire({
      veto(reason) {
        if (reason) {
          veto = reason;
        }
      }
    });
    if (veto) {
      this.handleVetoBeforeClose(e, veto);
      return;
    }
    const confirmBeforeCloseSetting = this.configurationService.getValue("window.confirmBeforeClose");
    const confirmBeforeClose = confirmBeforeCloseSetting === "always" || confirmBeforeCloseSetting === "keyboardOnly" && ModifierKeyEmitter.getInstance().isModifierPressed;
    if (confirmBeforeClose) {
      this.confirmBeforeClose(e);
    }
  }
  handleVetoBeforeClose(e, reason) {
    this.preventUnload(e);
  }
  preventUnload(e) {
    e.preventDefault();
    e.returnValue = localize("lifecycleVeto", "Changes that you made may not be saved. Please check press 'Cancel' and try again.");
  }
  confirmBeforeClose(e) {
    this.preventUnload(e);
  }
  handleUnload() {
    this._onUnload.fire();
  }
  layout() {
    const dimension = getClientArea(this.window.document.body, DEFAULT_AUX_WINDOW_DIMENSIONS, this.container);
    this._onWillLayout.fire(dimension);
    this._onDidLayout.fire(dimension);
  }
  createState() {
    return {
      bounds: {
        x: this.window.screenX,
        y: this.window.screenY,
        width: this.window.outerWidth,
        height: this.window.outerHeight
      },
      zoomLevel: getZoomLevel(this.window)
    };
  }
  dispose() {
    if (this._store.isDisposed) {
      return;
    }
    this._onWillDispose.fire();
    super.dispose();
  }
};
AuxiliaryWindow = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IWorkbenchEnvironmentService)
], AuxiliaryWindow);
let BrowserAuxiliaryWindowService = class extends Disposable {
  constructor(layoutService, dialogService, configurationService, telemetryService, hostService, environmentService) {
    super();
    this.layoutService = layoutService;
    this.dialogService = dialogService;
    this.configurationService = configurationService;
    this.telemetryService = telemetryService;
    this.hostService = hostService;
    this.environmentService = environmentService;
    // start from the main window ID + 1
    this._onDidOpenAuxiliaryWindow = this._register(new Emitter());
    this.onDidOpenAuxiliaryWindow = this._onDidOpenAuxiliaryWindow.event;
    this.windows = /* @__PURE__ */ new Map();
  }
  async open(options) {
    mark("code/auxiliaryWindow/willOpen");
    const targetWindow = await this.openWindow(options);
    if (!targetWindow) {
      throw new Error(localize("unableToOpenWindowError", "Unable to open a new window."));
    }
    const resolvedWindowId = await this.resolveWindowId(targetWindow);
    ensureCodeWindow(targetWindow, resolvedWindowId);
    const containerDisposables = new DisposableStore();
    const { container, stylesLoaded } = this.createContainer(targetWindow, containerDisposables, options);
    const auxiliaryWindow = this.createAuxiliaryWindow(targetWindow, container, stylesLoaded);
    const registryDisposables = new DisposableStore();
    this.windows.set(targetWindow.vscodeWindowId, auxiliaryWindow);
    registryDisposables.add(toDisposable(() => this.windows.delete(targetWindow.vscodeWindowId)));
    const eventDisposables = new DisposableStore();
    Event.once(auxiliaryWindow.onWillDispose)(() => {
      targetWindow.close();
      containerDisposables.dispose();
      registryDisposables.dispose();
      eventDisposables.dispose();
    });
    registryDisposables.add(registerWindow(targetWindow));
    this._onDidOpenAuxiliaryWindow.fire({ window: auxiliaryWindow, disposables: eventDisposables });
    mark("code/auxiliaryWindow/didOpen");
    this.telemetryService.publicLog2("auxiliaryWindowOpen", { bounds: !!options?.bounds });
    return auxiliaryWindow;
  }
  createAuxiliaryWindow(targetWindow, container, stylesLoaded) {
    return new AuxiliaryWindow(targetWindow, container, stylesLoaded, this.configurationService, this.hostService, this.environmentService);
  }
  async openWindow(options) {
    const activeWindow = getActiveWindow();
    const activeWindowBounds = {
      x: activeWindow.screenX,
      y: activeWindow.screenY,
      width: activeWindow.outerWidth,
      height: activeWindow.outerHeight
    };
    const width = Math.max(options?.bounds?.width ?? BrowserAuxiliaryWindowService.DEFAULT_SIZE.width, WindowMinimumSize.WIDTH);
    const height = Math.max(options?.bounds?.height ?? BrowserAuxiliaryWindowService.DEFAULT_SIZE.height, WindowMinimumSize.HEIGHT);
    let newWindowBounds = {
      x: options?.bounds?.x ?? Math.max(activeWindowBounds.x + activeWindowBounds.width / 2 - width / 2, 0),
      y: options?.bounds?.y ?? Math.max(activeWindowBounds.y + activeWindowBounds.height / 2 - height / 2, 0),
      width,
      height
    };
    if (!options?.bounds && newWindowBounds.x === activeWindowBounds.x && newWindowBounds.y === activeWindowBounds.y) {
      newWindowBounds = {
        ...newWindowBounds,
        x: newWindowBounds.x + 30,
        y: newWindowBounds.y + 30
      };
    }
    const features = coalesce([
      "popup=yes",
      `left=${newWindowBounds.x}`,
      `top=${newWindowBounds.y}`,
      `width=${newWindowBounds.width}`,
      `height=${newWindowBounds.height}`,
      // non-standard properties
      options?.nativeTitlebar ? "window-native-titlebar=yes" : void 0,
      options?.disableFullscreen ? "window-disable-fullscreen=yes" : void 0,
      options?.mode === 0 /* Maximized */ ? "window-maximized=yes" : void 0,
      options?.mode === 2 /* Fullscreen */ ? "window-fullscreen=yes" : void 0
    ]);
    const auxiliaryWindow = mainWindow.open(isFirefox ? "" : "about:blank", void 0, features.join(","));
    if (!auxiliaryWindow && isWeb) {
      return (await this.dialogService.prompt({
        type: Severity.Warning,
        message: localize("unableToOpenWindow", "The browser interrupted the opening of a new window. Press 'Retry' to try again."),
        detail: localize("unableToOpenWindowDetail", "To avoid this problem in the future, please ensure to allow popups for this website."),
        buttons: [
          {
            label: localize({ key: "retry", comment: ["&& denotes a mnemonic"] }, "&&Retry"),
            run: () => this.openWindow(options)
          }
        ],
        cancelButton: true
      })).result;
    }
    return auxiliaryWindow?.window;
  }
  async resolveWindowId(auxiliaryWindow) {
    return BrowserAuxiliaryWindowService.WINDOW_IDS++;
  }
  createContainer(auxiliaryWindow, disposables, options) {
    auxiliaryWindow.document.createElement = function() {
      throw new Error('Not allowed to create elements in child window JavaScript context. Always use the main window so that "xyz instanceof HTMLElement" continues to work.');
    };
    this.applyMeta(auxiliaryWindow);
    const { stylesLoaded } = this.applyCSS(auxiliaryWindow, disposables);
    const container = this.applyHTML(auxiliaryWindow, disposables);
    return { stylesLoaded, container };
  }
  applyMeta(auxiliaryWindow) {
    for (const metaTag of ['meta[charset="utf-8"]', 'meta[http-equiv="Content-Security-Policy"]', 'meta[name="viewport"]', 'meta[name="theme-color"]']) {
      const metaElement = mainWindow.document.querySelector(metaTag);
      if (metaElement) {
        const clonedMetaElement = createMetaElement(auxiliaryWindow.document.head);
        copyAttributes(metaElement, clonedMetaElement);
        if (metaTag === 'meta[http-equiv="Content-Security-Policy"]') {
          const content = clonedMetaElement.getAttribute("content");
          if (content) {
            clonedMetaElement.setAttribute("content", content.replace(/(script-src[^\;]*)/, `script-src 'none'`));
          }
        }
      }
    }
    const originalIconLinkTag = mainWindow.document.querySelector('link[rel="icon"]');
    if (originalIconLinkTag) {
      const icon = createLinkElement(auxiliaryWindow.document.head);
      copyAttributes(originalIconLinkTag, icon);
    }
  }
  applyCSS(auxiliaryWindow, disposables) {
    mark("code/auxiliaryWindow/willApplyCSS");
    const mapOriginalToClone = /* @__PURE__ */ new Map();
    const stylesLoaded = new Barrier();
    stylesLoaded.wait().then(() => mark("code/auxiliaryWindow/didLoadCSSStyles"));
    const pendingLinksDisposables = disposables.add(new DisposableStore());
    let pendingLinksToSettle = 0;
    function onLinkSettled() {
      if (--pendingLinksToSettle === 0) {
        pendingLinksDisposables.dispose();
        stylesLoaded.open();
      }
    }
    function cloneNode(originalNode) {
      if (isGlobalStylesheet(originalNode)) {
        return;
      }
      const clonedNode = auxiliaryWindow.document.head.appendChild(originalNode.cloneNode(true));
      if (originalNode.tagName.toLowerCase() === "link") {
        pendingLinksToSettle++;
        pendingLinksDisposables.add(addDisposableListener(clonedNode, "load", onLinkSettled));
        pendingLinksDisposables.add(addDisposableListener(clonedNode, "error", onLinkSettled));
      }
      mapOriginalToClone.set(originalNode, clonedNode);
    }
    pendingLinksToSettle++;
    try {
      for (const originalNode of mainWindow.document.head.querySelectorAll('link[rel="stylesheet"], style')) {
        cloneNode(originalNode);
      }
    } finally {
      onLinkSettled();
    }
    disposables.add(cloneGlobalStylesheets(auxiliaryWindow));
    disposables.add(sharedMutationObserver.observe(mainWindow.document.head, disposables, { childList: true, subtree: true })((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList" || // only interested in added/removed nodes
        mutation.target.nodeName.toLowerCase() === "title" || // skip over title changes that happen frequently
        mutation.target.nodeName.toLowerCase() === "script" || // block <script> changes that are unsupported anyway
        mutation.target.nodeName.toLowerCase() === "meta") {
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (isHTMLElement(node) && (node.tagName.toLowerCase() === "style" || node.tagName.toLowerCase() === "link")) {
            cloneNode(node);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentNode) {
            const clonedNode = mapOriginalToClone.get(node.parentNode);
            if (clonedNode) {
              clonedNode.textContent = node.textContent;
            }
          }
        }
        for (const node of mutation.removedNodes) {
          const clonedNode = mapOriginalToClone.get(node);
          if (clonedNode) {
            clonedNode.parentNode?.removeChild(clonedNode);
            mapOriginalToClone.delete(node);
          }
        }
      }
    }));
    mark("code/auxiliaryWindow/didApplyCSS");
    return { stylesLoaded };
  }
  applyHTML(auxiliaryWindow, disposables) {
    mark("code/auxiliaryWindow/willApplyHTML");
    const container = $("div", { role: "application" });
    position(container, 0, 0, 0, 0, "relative");
    container.style.display = "flex";
    container.style.height = "100%";
    container.style.flexDirection = "column";
    auxiliaryWindow.document.body.append(container);
    disposables.add(trackAttributes(mainWindow.document.documentElement, auxiliaryWindow.document.documentElement));
    disposables.add(trackAttributes(mainWindow.document.body, auxiliaryWindow.document.body));
    disposables.add(trackAttributes(this.layoutService.mainContainer, container, ["class"]));
    mark("code/auxiliaryWindow/didApplyHTML");
    return container;
  }
  getWindow(windowId) {
    return this.windows.get(windowId);
  }
};
BrowserAuxiliaryWindowService.DEFAULT_SIZE = DEFAULT_AUX_WINDOW_SIZE;
BrowserAuxiliaryWindowService.WINDOW_IDS = getWindowId(mainWindow) + 1;
BrowserAuxiliaryWindowService = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, IDialogService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IWorkbenchEnvironmentService)
], BrowserAuxiliaryWindowService);
registerSingleton(IAuxiliaryWindowService, BrowserAuxiliaryWindowService, InstantiationType.Delayed);
export {
  AuxiliaryWindow,
  AuxiliaryWindowMode,
  BrowserAuxiliaryWindowService,
  IAuxiliaryWindowService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvYXV4aWxpYXJ5V2luZG93L2Jyb3dzZXIvYXV4aWxpYXJ5V2luZG93U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGdldFpvb21MZXZlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7ICQsIERpbWVuc2lvbiwgRXZlbnRIZWxwZXIsIEV2ZW50VHlwZSwgTW9kaWZpZXJLZXlFbWl0dGVyLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGNvcHlBdHRyaWJ1dGVzLCBjcmVhdGVMaW5rRWxlbWVudCwgY3JlYXRlTWV0YUVsZW1lbnQsIGdldEFjdGl2ZVdpbmRvdywgZ2V0Q2xpZW50QXJlYSwgZ2V0V2luZG93SWQsIGlzSFRNTEVsZW1lbnQsIHBvc2l0aW9uLCByZWdpc3RlcldpbmRvdywgc2hhcmVkTXV0YXRpb25PYnNlcnZlciwgdHJhY2tBdHRyaWJ1dGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBjbG9uZUdsb2JhbFN0eWxlc2hlZXRzLCBpc0dsb2JhbFN0eWxlc2hlZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0IHsgQ29kZVdpbmRvdywgZW5zdXJlQ29kZVdpbmRvdywgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQmFycmllciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG1hcmsgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgeyBpc0ZpcmVmb3gsIGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IERFRkFVTFRfQVVYX1dJTkRPV19TSVpFLCBJUmVjdGFuZ2xlLCBXaW5kb3dNaW5pbXVtU2l6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IEJhc2VXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSB9IGZyb20gJy4uLy4uL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuXG5leHBvcnQgY29uc3QgSUF1eGlsaWFyeVdpbmRvd1NlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SUF1eGlsaWFyeVdpbmRvd1NlcnZpY2U+KCdhdXhpbGlhcnlXaW5kb3dTZXJ2aWNlJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUF1eGlsaWFyeVdpbmRvd09wZW5FdmVudCB7XG5cdHJlYWRvbmx5IHdpbmRvdzogSUF1eGlsaWFyeVdpbmRvdztcblx0cmVhZG9ubHkgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuZXhwb3J0IGVudW0gQXV4aWxpYXJ5V2luZG93TW9kZSB7XG5cdE1heGltaXplZCxcblx0Tm9ybWFsLFxuXHRGdWxsc2NyZWVuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUF1eGlsaWFyeVdpbmRvd09wZW5PcHRpb25zIHtcblx0cmVhZG9ubHkgYm91bmRzPzogUGFydGlhbDxJUmVjdGFuZ2xlPjtcblxuXHRyZWFkb25seSBtb2RlPzogQXV4aWxpYXJ5V2luZG93TW9kZTtcblx0cmVhZG9ubHkgem9vbUxldmVsPzogbnVtYmVyO1xuXG5cdHJlYWRvbmx5IG5hdGl2ZVRpdGxlYmFyPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgZGlzYWJsZUZ1bGxzY3JlZW4/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBdXhpbGlhcnlXaW5kb3dTZXJ2aWNlIHtcblxuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cmVhZG9ubHkgb25EaWRPcGVuQXV4aWxpYXJ5V2luZG93OiBFdmVudDxJQXV4aWxpYXJ5V2luZG93T3BlbkV2ZW50PjtcblxuXHRvcGVuKG9wdGlvbnM/OiBJQXV4aWxpYXJ5V2luZG93T3Blbk9wdGlvbnMpOiBQcm9taXNlPElBdXhpbGlhcnlXaW5kb3c+O1xuXG5cdGdldFdpbmRvdyh3aW5kb3dJZDogbnVtYmVyKTogSUF1eGlsaWFyeVdpbmRvdyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCZWZvcmVBdXhpbGlhcnlXaW5kb3dVbmxvYWRFdmVudCB7XG5cdHZldG8ocmVhc29uOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBdXhpbGlhcnlXaW5kb3cgZXh0ZW5kcyBJRGlzcG9zYWJsZSB7XG5cblx0cmVhZG9ubHkgb25XaWxsTGF5b3V0OiBFdmVudDxEaW1lbnNpb24+O1xuXHRyZWFkb25seSBvbkRpZExheW91dDogRXZlbnQ8RGltZW5zaW9uPjtcblxuXHRyZWFkb25seSBvbkJlZm9yZVVubG9hZDogRXZlbnQ8QmVmb3JlQXV4aWxpYXJ5V2luZG93VW5sb2FkRXZlbnQ+O1xuXHRyZWFkb25seSBvblVubG9hZDogRXZlbnQ8dm9pZD47XG5cblx0cmVhZG9ubHkgd2hlblN0eWxlc0hhdmVMb2FkZWQ6IFByb21pc2U8dm9pZD47XG5cblx0cmVhZG9ubHkgd2luZG93OiBDb2RlV2luZG93O1xuXHRyZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuXG5cdGxheW91dCgpOiB2b2lkO1xuXG5cdGNyZWF0ZVN0YXRlKCk6IElBdXhpbGlhcnlXaW5kb3dPcGVuT3B0aW9ucztcbn1cblxuY29uc3QgREVGQVVMVF9BVVhfV0lORE9XX0RJTUVOU0lPTlMgPSBuZXcgRGltZW5zaW9uKERFRkFVTFRfQVVYX1dJTkRPV19TSVpFLndpZHRoLCBERUZBVUxUX0FVWF9XSU5ET1dfU0laRS5oZWlnaHQpO1xuXG5leHBvcnQgY2xhc3MgQXV4aWxpYXJ5V2luZG93IGV4dGVuZHMgQmFzZVdpbmRvdyBpbXBsZW1lbnRzIElBdXhpbGlhcnlXaW5kb3cge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbExheW91dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPERpbWVuc2lvbj4oKSk7XG5cdHJlYWRvbmx5IG9uV2lsbExheW91dCA9IHRoaXMuX29uV2lsbExheW91dC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZExheW91dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPERpbWVuc2lvbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTGF5b3V0ID0gdGhpcy5fb25EaWRMYXlvdXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25CZWZvcmVVbmxvYWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxCZWZvcmVBdXhpbGlhcnlXaW5kb3dVbmxvYWRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uQmVmb3JlVW5sb2FkID0gdGhpcy5fb25CZWZvcmVVbmxvYWQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25VbmxvYWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25VbmxvYWQgPSB0aGlzLl9vblVubG9hZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxEaXNwb3NlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uV2lsbERpc3Bvc2UgPSB0aGlzLl9vbldpbGxEaXNwb3NlLmV2ZW50O1xuXG5cdHJlYWRvbmx5IHdoZW5TdHlsZXNIYXZlTG9hZGVkOiBQcm9taXNlPHZvaWQ+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHdpbmRvdzogQ29kZVdpbmRvdyxcblx0XHRyZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHN0eWxlc0hhdmVMb2FkZWQ6IEJhcnJpZXIsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcih3aW5kb3csIHVuZGVmaW5lZCwgaG9zdFNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSk7XG5cblx0XHR0aGlzLndoZW5TdHlsZXNIYXZlTG9hZGVkID0gc3R5bGVzSGF2ZUxvYWRlZC53YWl0KCkudGhlbigoKSA9PiB1bmRlZmluZWQpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy53aW5kb3csIEV2ZW50VHlwZS5CRUZPUkVfVU5MT0FELCAoZTogQmVmb3JlVW5sb2FkRXZlbnQpID0+IHRoaXMuaGFuZGxlQmVmb3JlVW5sb2FkKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMud2luZG93LCBFdmVudFR5cGUuVU5MT0FELCAoKSA9PiB0aGlzLmhhbmRsZVVubG9hZCgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy53aW5kb3csICd1bmhhbmRsZWRyZWplY3Rpb24nLCBlID0+IHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGUucmVhc29uKTtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy53aW5kb3csIEV2ZW50VHlwZS5SRVNJWkUsICgpID0+IHRoaXMubGF5b3V0KCkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmNvbnRhaW5lciwgRXZlbnRUeXBlLlNDUk9MTCwgKCkgPT4gdGhpcy5jb250YWluZXIuc2Nyb2xsVG9wID0gMCkpOyBcdFx0XHRcdFx0XHQvLyBQcmV2ZW50IGNvbnRhaW5lciBmcm9tIHNjcm9sbGluZyAoIzU1NDU2KVxuXG5cdFx0aWYgKGlzV2ViKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIEV2ZW50VHlwZS5EUk9QLCBlID0+IEV2ZW50SGVscGVyLnN0b3AoZSwgdHJ1ZSkpKTsgXHRcdFx0XHRcdFx0XHQvLyBQcmV2ZW50IGRlZmF1bHQgbmF2aWdhdGlvbiBvbiBkcm9wXG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIEV2ZW50VHlwZS5XSEVFTCwgZSA9PiBlLnByZXZlbnREZWZhdWx0KCksIHsgcGFzc2l2ZTogZmFsc2UgfSkpOyBcdFx0XHQvLyBQcmV2ZW50IHRoZSBiYWNrL2ZvcndhcmQgZ2VzdHVyZXMgaW4gbWFjT1Ncblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmNvbnRhaW5lciwgRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgZSA9PiBFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpKSk7IFx0XHRcdFx0XHQvLyBQcmV2ZW50IG5hdGl2ZSBjb250ZXh0IG1lbnVzIGluIHdlYlxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy53aW5kb3cuZG9jdW1lbnQuYm9keSwgRXZlbnRUeXBlLkRSQUdfT1ZFUiwgKGU6IERyYWdFdmVudCkgPT4gRXZlbnRIZWxwZXIuc3RvcChlKSkpO1x0Ly8gUHJldmVudCBkcmFnIGZlZWRiYWNrIG9uIDxib2R5PlxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMud2luZG93LmRvY3VtZW50LmJvZHksIEV2ZW50VHlwZS5EUk9QLCAoZTogRHJhZ0V2ZW50KSA9PiBFdmVudEhlbHBlci5zdG9wKGUpKSk7XHRcdC8vIFByZXZlbnQgZGVmYXVsdCBuYXZpZ2F0aW9uIG9uIGRyb3Bcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUJlZm9yZVVubG9hZChlOiBCZWZvcmVVbmxvYWRFdmVudCk6IHZvaWQge1xuXG5cdFx0Ly8gQ2hlY2sgZm9yIHZldG8gZnJvbSBhIGxpc3RlbmluZyBjb21wb25lbnRcblx0XHRsZXQgdmV0bzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdHRoaXMuX29uQmVmb3JlVW5sb2FkLmZpcmUoe1xuXHRcdFx0dmV0byhyZWFzb24pIHtcblx0XHRcdFx0aWYgKHJlYXNvbikge1xuXHRcdFx0XHRcdHZldG8gPSByZWFzb247XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZiAodmV0bykge1xuXHRcdFx0dGhpcy5oYW5kbGVWZXRvQmVmb3JlQ2xvc2UoZSwgdmV0byk7XG5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBmb3IgY29uZmlybSBiZWZvcmUgY2xvc2Ugc2V0dGluZ1xuXHRcdGNvbnN0IGNvbmZpcm1CZWZvcmVDbG9zZVNldHRpbmcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdhbHdheXMnIHwgJ25ldmVyJyB8ICdrZXlib2FyZE9ubHknPignd2luZG93LmNvbmZpcm1CZWZvcmVDbG9zZScpO1xuXHRcdGNvbnN0IGNvbmZpcm1CZWZvcmVDbG9zZSA9IGNvbmZpcm1CZWZvcmVDbG9zZVNldHRpbmcgPT09ICdhbHdheXMnIHx8IChjb25maXJtQmVmb3JlQ2xvc2VTZXR0aW5nID09PSAna2V5Ym9hcmRPbmx5JyAmJiBNb2RpZmllcktleUVtaXR0ZXIuZ2V0SW5zdGFuY2UoKS5pc01vZGlmaWVyUHJlc3NlZCk7XG5cdFx0aWYgKGNvbmZpcm1CZWZvcmVDbG9zZSkge1xuXHRcdFx0dGhpcy5jb25maXJtQmVmb3JlQ2xvc2UoZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGhhbmRsZVZldG9CZWZvcmVDbG9zZShlOiBCZWZvcmVVbmxvYWRFdmVudCwgcmVhc29uOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnByZXZlbnRVbmxvYWQoZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcHJldmVudFVubG9hZChlOiBCZWZvcmVVbmxvYWRFdmVudCk6IHZvaWQge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnJldHVyblZhbHVlID0gbG9jYWxpemUoJ2xpZmVjeWNsZVZldG8nLCBcIkNoYW5nZXMgdGhhdCB5b3UgbWFkZSBtYXkgbm90IGJlIHNhdmVkLiBQbGVhc2UgY2hlY2sgcHJlc3MgJ0NhbmNlbCcgYW5kIHRyeSBhZ2Fpbi5cIik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY29uZmlybUJlZm9yZUNsb3NlKGU6IEJlZm9yZVVubG9hZEV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5wcmV2ZW50VW5sb2FkKGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVVbmxvYWQoKTogdm9pZCB7XG5cblx0XHQvLyBFdmVudFxuXHRcdHRoaXMuX29uVW5sb2FkLmZpcmUoKTtcblx0fVxuXG5cdGxheW91dCgpOiB2b2lkIHtcblxuXHRcdC8vIFNwbGl0IGxheW91dCB1cCBpbnRvIHR3byBldmVudHMgc28gdGhhdCBkb3duc3RyZWFtIGNvbXBvbmVudHNcblx0XHQvLyBoYXZlIGEgY2hhbmNlIHRvIHBhcnRpY2lwYXRlIGluIHRoZSBiZWdpbm5pbmcgb3IgZW5kIG9mIHRoZVxuXHRcdC8vIGxheW91dCBwaGFzZS5cblx0XHQvLyBUaGlzIGhlbHBzIHRvIGJ1aWxkIHRoZSBhdXhpbGlhcnkgd2luZG93IGluIGFub3RoZXIgY29tcG9uZW50XG5cdFx0Ly8gaW4gdGhlIGBvbldpbGxMYXlvdXRgIHBoYXNlIGFuZCB0aGVuIGxldCBvdGhlciBjb21wb21lbnRzXG5cdFx0Ly8gcmVhY3Qgd2hlbiB0aGUgb3ZlcmFsbCBsYXlvdXQgaGFzIGZpbmlzaGVkIGluIGBvbkRpZExheW91dGAuXG5cblx0XHRjb25zdCBkaW1lbnNpb24gPSBnZXRDbGllbnRBcmVhKHRoaXMud2luZG93LmRvY3VtZW50LmJvZHksIERFRkFVTFRfQVVYX1dJTkRPV19ESU1FTlNJT05TLCB0aGlzLmNvbnRhaW5lcik7XG5cdFx0dGhpcy5fb25XaWxsTGF5b3V0LmZpcmUoZGltZW5zaW9uKTtcblx0XHR0aGlzLl9vbkRpZExheW91dC5maXJlKGRpbWVuc2lvbik7XG5cdH1cblxuXHRjcmVhdGVTdGF0ZSgpOiBJQXV4aWxpYXJ5V2luZG93T3Blbk9wdGlvbnMge1xuXHRcdHJldHVybiB7XG5cdFx0XHRib3VuZHM6IHtcblx0XHRcdFx0eDogdGhpcy53aW5kb3cuc2NyZWVuWCxcblx0XHRcdFx0eTogdGhpcy53aW5kb3cuc2NyZWVuWSxcblx0XHRcdFx0d2lkdGg6IHRoaXMud2luZG93Lm91dGVyV2lkdGgsXG5cdFx0XHRcdGhlaWdodDogdGhpcy53aW5kb3cub3V0ZXJIZWlnaHRcblx0XHRcdH0sXG5cdFx0XHR6b29tTGV2ZWw6IGdldFpvb21MZXZlbCh0aGlzLndpbmRvdylcblx0XHR9O1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uV2lsbERpc3Bvc2UuZmlyZSgpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBCcm93c2VyQXV4aWxpYXJ5V2luZG93U2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQXV4aWxpYXJ5V2luZG93U2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgREVGQVVMVF9TSVpFID0gREVGQVVMVF9BVVhfV0lORE9XX1NJWkU7XG5cblx0cHJpdmF0ZSBzdGF0aWMgV0lORE9XX0lEUyA9IGdldFdpbmRvd0lkKG1haW5XaW5kb3cpICsgMTsgLy8gc3RhcnQgZnJvbSB0aGUgbWFpbiB3aW5kb3cgSUQgKyAxXG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRPcGVuQXV4aWxpYXJ5V2luZG93ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUF1eGlsaWFyeVdpbmRvd09wZW5FdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkT3BlbkF1eGlsaWFyeVdpbmRvdyA9IHRoaXMuX29uRGlkT3BlbkF1eGlsaWFyeVdpbmRvdy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHdpbmRvd3MgPSBuZXcgTWFwPG51bWJlciwgSUF1eGlsaWFyeVdpbmRvdz4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRhc3luYyBvcGVuKG9wdGlvbnM/OiBJQXV4aWxpYXJ5V2luZG93T3Blbk9wdGlvbnMpOiBQcm9taXNlPElBdXhpbGlhcnlXaW5kb3c+IHtcblx0XHRtYXJrKCdjb2RlL2F1eGlsaWFyeVdpbmRvdy93aWxsT3BlbicpO1xuXG5cdFx0Y29uc3QgdGFyZ2V0V2luZG93ID0gYXdhaXQgdGhpcy5vcGVuV2luZG93KG9wdGlvbnMpO1xuXHRcdGlmICghdGFyZ2V0V2luZG93KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ3VuYWJsZVRvT3BlbldpbmRvd0Vycm9yJywgXCJVbmFibGUgdG8gb3BlbiBhIG5ldyB3aW5kb3cuXCIpKTtcblx0XHR9XG5cblx0XHQvLyBBZGQgYSBgdnNjb2RlV2luZG93SWRgIHByb3BlcnR5IHRvIGlkZW50aWZ5IGF1eGlsaWFyeSB3aW5kb3dzXG5cdFx0Y29uc3QgcmVzb2x2ZWRXaW5kb3dJZCA9IGF3YWl0IHRoaXMucmVzb2x2ZVdpbmRvd0lkKHRhcmdldFdpbmRvdyk7XG5cdFx0ZW5zdXJlQ29kZVdpbmRvdyh0YXJnZXRXaW5kb3csIHJlc29sdmVkV2luZG93SWQpO1xuXG5cdFx0Y29uc3QgY29udGFpbmVyRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgeyBjb250YWluZXIsIHN0eWxlc0xvYWRlZCB9ID0gdGhpcy5jcmVhdGVDb250YWluZXIodGFyZ2V0V2luZG93LCBjb250YWluZXJEaXNwb3NhYmxlcywgb3B0aW9ucyk7XG5cblx0XHRjb25zdCBhdXhpbGlhcnlXaW5kb3cgPSB0aGlzLmNyZWF0ZUF1eGlsaWFyeVdpbmRvdyh0YXJnZXRXaW5kb3csIGNvbnRhaW5lciwgc3R5bGVzTG9hZGVkKTtcblxuXHRcdGNvbnN0IHJlZ2lzdHJ5RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy53aW5kb3dzLnNldCh0YXJnZXRXaW5kb3cudnNjb2RlV2luZG93SWQsIGF1eGlsaWFyeVdpbmRvdyk7XG5cdFx0cmVnaXN0cnlEaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMud2luZG93cy5kZWxldGUodGFyZ2V0V2luZG93LnZzY29kZVdpbmRvd0lkKSkpO1xuXG5cdFx0Y29uc3QgZXZlbnREaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdEV2ZW50Lm9uY2UoYXV4aWxpYXJ5V2luZG93Lm9uV2lsbERpc3Bvc2UpKCgpID0+IHtcblx0XHRcdHRhcmdldFdpbmRvdy5jbG9zZSgpO1xuXG5cdFx0XHRjb250YWluZXJEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRyZWdpc3RyeURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdGV2ZW50RGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0cmVnaXN0cnlEaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJXaW5kb3codGFyZ2V0V2luZG93KSk7XG5cdFx0dGhpcy5fb25EaWRPcGVuQXV4aWxpYXJ5V2luZG93LmZpcmUoeyB3aW5kb3c6IGF1eGlsaWFyeVdpbmRvdywgZGlzcG9zYWJsZXM6IGV2ZW50RGlzcG9zYWJsZXMgfSk7XG5cblx0XHRtYXJrKCdjb2RlL2F1eGlsaWFyeVdpbmRvdy9kaWRPcGVuJyk7XG5cblx0XHR0eXBlIEF1eGlsaWFyeVdpbmRvd0NsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdicGFzZXJvJztcblx0XHRcdGNvbW1lbnQ6ICdBbiBldmVudCB0aGF0IGZpcmVzIHdoZW4gYW4gYXV4aWxpYXJ5IHdpbmRvdyBpcyBvcGVuZWQnO1xuXHRcdFx0Ym91bmRzOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnSGFzIHdpbmRvdyBib3VuZHMgcHJvdmlkZWQuJyB9O1xuXHRcdH07XG5cdFx0dHlwZSBBdXhpbGlhcnlXaW5kb3dPcGVuRXZlbnQgPSB7XG5cdFx0XHRib3VuZHM6IGJvb2xlYW47XG5cdFx0fTtcblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxBdXhpbGlhcnlXaW5kb3dPcGVuRXZlbnQsIEF1eGlsaWFyeVdpbmRvd0NsYXNzaWZpY2F0aW9uPignYXV4aWxpYXJ5V2luZG93T3BlbicsIHsgYm91bmRzOiAhIW9wdGlvbnM/LmJvdW5kcyB9KTtcblxuXHRcdHJldHVybiBhdXhpbGlhcnlXaW5kb3c7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlQXV4aWxpYXJ5V2luZG93KHRhcmdldFdpbmRvdzogQ29kZVdpbmRvdywgY29udGFpbmVyOiBIVE1MRWxlbWVudCwgc3R5bGVzTG9hZGVkOiBCYXJyaWVyKTogQXV4aWxpYXJ5V2luZG93IHtcblx0XHRyZXR1cm4gbmV3IEF1eGlsaWFyeVdpbmRvdyh0YXJnZXRXaW5kb3csIGNvbnRhaW5lciwgc3R5bGVzTG9hZGVkLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLmhvc3RTZXJ2aWNlLCB0aGlzLmVudmlyb25tZW50U2VydmljZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW5XaW5kb3cob3B0aW9ucz86IElBdXhpbGlhcnlXaW5kb3dPcGVuT3B0aW9ucyk6IFByb21pc2U8V2luZG93IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gZ2V0QWN0aXZlV2luZG93KCk7XG5cdFx0Y29uc3QgYWN0aXZlV2luZG93Qm91bmRzID0ge1xuXHRcdFx0eDogYWN0aXZlV2luZG93LnNjcmVlblgsXG5cdFx0XHR5OiBhY3RpdmVXaW5kb3cuc2NyZWVuWSxcblx0XHRcdHdpZHRoOiBhY3RpdmVXaW5kb3cub3V0ZXJXaWR0aCxcblx0XHRcdGhlaWdodDogYWN0aXZlV2luZG93Lm91dGVySGVpZ2h0XG5cdFx0fTtcblxuXHRcdGNvbnN0IHdpZHRoID0gTWF0aC5tYXgob3B0aW9ucz8uYm91bmRzPy53aWR0aCA/PyBCcm93c2VyQXV4aWxpYXJ5V2luZG93U2VydmljZS5ERUZBVUxUX1NJWkUud2lkdGgsIFdpbmRvd01pbmltdW1TaXplLldJRFRIKTtcblx0XHRjb25zdCBoZWlnaHQgPSBNYXRoLm1heChvcHRpb25zPy5ib3VuZHM/LmhlaWdodCA/PyBCcm93c2VyQXV4aWxpYXJ5V2luZG93U2VydmljZS5ERUZBVUxUX1NJWkUuaGVpZ2h0LCBXaW5kb3dNaW5pbXVtU2l6ZS5IRUlHSFQpO1xuXG5cdFx0bGV0IG5ld1dpbmRvd0JvdW5kczogSVJlY3RhbmdsZSA9IHtcblx0XHRcdHg6IG9wdGlvbnM/LmJvdW5kcz8ueCA/PyBNYXRoLm1heChhY3RpdmVXaW5kb3dCb3VuZHMueCArIGFjdGl2ZVdpbmRvd0JvdW5kcy53aWR0aCAvIDIgLSB3aWR0aCAvIDIsIDApLFxuXHRcdFx0eTogb3B0aW9ucz8uYm91bmRzPy55ID8/IE1hdGgubWF4KGFjdGl2ZVdpbmRvd0JvdW5kcy55ICsgYWN0aXZlV2luZG93Qm91bmRzLmhlaWdodCAvIDIgLSBoZWlnaHQgLyAyLCAwKSxcblx0XHRcdHdpZHRoLFxuXHRcdFx0aGVpZ2h0XG5cdFx0fTtcblxuXHRcdGlmICghb3B0aW9ucz8uYm91bmRzICYmIG5ld1dpbmRvd0JvdW5kcy54ID09PSBhY3RpdmVXaW5kb3dCb3VuZHMueCAmJiBuZXdXaW5kb3dCb3VuZHMueSA9PT0gYWN0aXZlV2luZG93Qm91bmRzLnkpIHtcblx0XHRcdC8vIE9mZnNldCB0aGUgbmV3IHdpbmRvdyBhIGJpdCBzbyB0aGF0IGl0IGRvZXMgbm90IG92ZXJsYXBcblx0XHRcdC8vIHdpdGggdGhlIGFjdGl2ZSB3aW5kb3csIHVubGVzcyBib3VuZHMgYXJlIHByb3ZpZGVkXG5cdFx0XHRuZXdXaW5kb3dCb3VuZHMgPSB7XG5cdFx0XHRcdC4uLm5ld1dpbmRvd0JvdW5kcyxcblx0XHRcdFx0eDogbmV3V2luZG93Qm91bmRzLnggKyAzMCxcblx0XHRcdFx0eTogbmV3V2luZG93Qm91bmRzLnkgKyAzMFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCBmZWF0dXJlcyA9IGNvYWxlc2NlKFtcblx0XHRcdCdwb3B1cD15ZXMnLFxuXHRcdFx0YGxlZnQ9JHtuZXdXaW5kb3dCb3VuZHMueH1gLFxuXHRcdFx0YHRvcD0ke25ld1dpbmRvd0JvdW5kcy55fWAsXG5cdFx0XHRgd2lkdGg9JHtuZXdXaW5kb3dCb3VuZHMud2lkdGh9YCxcblx0XHRcdGBoZWlnaHQ9JHtuZXdXaW5kb3dCb3VuZHMuaGVpZ2h0fWAsXG5cblx0XHRcdC8vIG5vbi1zdGFuZGFyZCBwcm9wZXJ0aWVzXG5cdFx0XHRvcHRpb25zPy5uYXRpdmVUaXRsZWJhciA/ICd3aW5kb3ctbmF0aXZlLXRpdGxlYmFyPXllcycgOiB1bmRlZmluZWQsXG5cdFx0XHRvcHRpb25zPy5kaXNhYmxlRnVsbHNjcmVlbiA/ICd3aW5kb3ctZGlzYWJsZS1mdWxsc2NyZWVuPXllcycgOiB1bmRlZmluZWQsXG5cdFx0XHRvcHRpb25zPy5tb2RlID09PSBBdXhpbGlhcnlXaW5kb3dNb2RlLk1heGltaXplZCA/ICd3aW5kb3ctbWF4aW1pemVkPXllcycgOiB1bmRlZmluZWQsXG5cdFx0XHRvcHRpb25zPy5tb2RlID09PSBBdXhpbGlhcnlXaW5kb3dNb2RlLkZ1bGxzY3JlZW4gPyAnd2luZG93LWZ1bGxzY3JlZW49eWVzJyA6IHVuZGVmaW5lZFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgYXV4aWxpYXJ5V2luZG93ID0gbWFpbldpbmRvdy5vcGVuKGlzRmlyZWZveCA/ICcnIC8qIEZGIGltbWVkaWF0ZWx5IGZpcmVzIGFuIHVubG9hZCBldmVudCBpZiB1c2luZyBhYm91dDpibGFuayAqLyA6ICdhYm91dDpibGFuaycsIHVuZGVmaW5lZCwgZmVhdHVyZXMuam9pbignLCcpKTtcblx0XHRpZiAoIWF1eGlsaWFyeVdpbmRvdyAmJiBpc1dlYikge1xuXHRcdFx0cmV0dXJuIChhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3VuYWJsZVRvT3BlbldpbmRvdycsIFwiVGhlIGJyb3dzZXIgaW50ZXJydXB0ZWQgdGhlIG9wZW5pbmcgb2YgYSBuZXcgd2luZG93LiBQcmVzcyAnUmV0cnknIHRvIHRyeSBhZ2Fpbi5cIiksXG5cdFx0XHRcdGRldGFpbDogbG9jYWxpemUoJ3VuYWJsZVRvT3BlbldpbmRvd0RldGFpbCcsIFwiVG8gYXZvaWQgdGhpcyBwcm9ibGVtIGluIHRoZSBmdXR1cmUsIHBsZWFzZSBlbnN1cmUgdG8gYWxsb3cgcG9wdXBzIGZvciB0aGlzIHdlYnNpdGUuXCIpLFxuXHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAncmV0cnknLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZXRyeVwiKSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5vcGVuV2luZG93KG9wdGlvbnMpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRjYW5jZWxCdXR0b246IHRydWVcblx0XHRcdH0pKS5yZXN1bHQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF1eGlsaWFyeVdpbmRvdz8ud2luZG93O1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIHJlc29sdmVXaW5kb3dJZChhdXhpbGlhcnlXaW5kb3c6IFdpbmRvdyk6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0cmV0dXJuIEJyb3dzZXJBdXhpbGlhcnlXaW5kb3dTZXJ2aWNlLldJTkRPV19JRFMrKztcblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVDb250YWluZXIoYXV4aWxpYXJ5V2luZG93OiBDb2RlV2luZG93LCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlLCBvcHRpb25zPzogSUF1eGlsaWFyeVdpbmRvd09wZW5PcHRpb25zKTogeyBzdHlsZXNMb2FkZWQ6IEJhcnJpZXI7IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfSB7XG5cdFx0YXV4aWxpYXJ5V2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHQvLyBEaXNhbGxvdyBgY3JlYXRlRWxlbWVudGAgYmVjYXVzZSBpdCB3b3VsZCBjcmVhdGVcblx0XHRcdC8vIEhUTUwgRWxlbWVudHMgaW4gdGhlIFwid3JvbmdcIiBjb250ZXh0IGFuZCBicmVha1xuXHRcdFx0Ly8gY29kZSB0aGF0IGRvZXMgXCJpbnN0YW5jZW9mIEhUTUxFbGVtZW50XCIgZXRjLlxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb3QgYWxsb3dlZCB0byBjcmVhdGUgZWxlbWVudHMgaW4gY2hpbGQgd2luZG93IEphdmFTY3JpcHQgY29udGV4dC4gQWx3YXlzIHVzZSB0aGUgbWFpbiB3aW5kb3cgc28gdGhhdCBcInh5eiBpbnN0YW5jZW9mIEhUTUxFbGVtZW50XCIgY29udGludWVzIHRvIHdvcmsuJyk7XG5cdFx0fTtcblxuXHRcdHRoaXMuYXBwbHlNZXRhKGF1eGlsaWFyeVdpbmRvdyk7XG5cdFx0Y29uc3QgeyBzdHlsZXNMb2FkZWQgfSA9IHRoaXMuYXBwbHlDU1MoYXV4aWxpYXJ5V2luZG93LCBkaXNwb3NhYmxlcyk7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gdGhpcy5hcHBseUhUTUwoYXV4aWxpYXJ5V2luZG93LCBkaXNwb3NhYmxlcyk7XG5cblx0XHRyZXR1cm4geyBzdHlsZXNMb2FkZWQsIGNvbnRhaW5lciB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBseU1ldGEoYXV4aWxpYXJ5V2luZG93OiBDb2RlV2luZG93KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBtZXRhVGFnIG9mIFsnbWV0YVtjaGFyc2V0PVwidXRmLThcIl0nLCAnbWV0YVtodHRwLWVxdWl2PVwiQ29udGVudC1TZWN1cml0eS1Qb2xpY3lcIl0nLCAnbWV0YVtuYW1lPVwidmlld3BvcnRcIl0nLCAnbWV0YVtuYW1lPVwidGhlbWUtY29sb3JcIl0nXSkge1xuXHRcdFx0Y29uc3QgbWV0YUVsZW1lbnQgPSBtYWluV2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IobWV0YVRhZyk7XG5cdFx0XHRpZiAobWV0YUVsZW1lbnQpIHtcblx0XHRcdFx0Y29uc3QgY2xvbmVkTWV0YUVsZW1lbnQgPSBjcmVhdGVNZXRhRWxlbWVudChhdXhpbGlhcnlXaW5kb3cuZG9jdW1lbnQuaGVhZCk7XG5cdFx0XHRcdGNvcHlBdHRyaWJ1dGVzKG1ldGFFbGVtZW50LCBjbG9uZWRNZXRhRWxlbWVudCk7XG5cblx0XHRcdFx0aWYgKG1ldGFUYWcgPT09ICdtZXRhW2h0dHAtZXF1aXY9XCJDb250ZW50LVNlY3VyaXR5LVBvbGljeVwiXScpIHtcblx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gY2xvbmVkTWV0YUVsZW1lbnQuZ2V0QXR0cmlidXRlKCdjb250ZW50Jyk7XG5cdFx0XHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0XHRcdGNsb25lZE1ldGFFbGVtZW50LnNldEF0dHJpYnV0ZSgnY29udGVudCcsIGNvbnRlbnQucmVwbGFjZSgvKHNjcmlwdC1zcmNbXlxcO10qKS8sIGBzY3JpcHQtc3JjICdub25lJ2ApKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBvcmlnaW5hbEljb25MaW5rVGFnID0gbWFpbldpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdsaW5rW3JlbD1cImljb25cIl0nKTtcblx0XHRpZiAob3JpZ2luYWxJY29uTGlua1RhZykge1xuXHRcdFx0Y29uc3QgaWNvbiA9IGNyZWF0ZUxpbmtFbGVtZW50KGF1eGlsaWFyeVdpbmRvdy5kb2N1bWVudC5oZWFkKTtcblx0XHRcdGNvcHlBdHRyaWJ1dGVzKG9yaWdpbmFsSWNvbkxpbmtUYWcsIGljb24pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXBwbHlDU1MoYXV4aWxpYXJ5V2luZG93OiBDb2RlV2luZG93LCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKSB7XG5cdFx0bWFyaygnY29kZS9hdXhpbGlhcnlXaW5kb3cvd2lsbEFwcGx5Q1NTJyk7XG5cblx0XHRjb25zdCBtYXBPcmlnaW5hbFRvQ2xvbmUgPSBuZXcgTWFwPE5vZGUgLyogb3JpZ2luYWwgKi8sIE5vZGUgLyogY2xvbmUgKi8+KCk7XG5cblx0XHRjb25zdCBzdHlsZXNMb2FkZWQgPSBuZXcgQmFycmllcigpO1xuXHRcdHN0eWxlc0xvYWRlZC53YWl0KCkudGhlbigoKSA9PiBtYXJrKCdjb2RlL2F1eGlsaWFyeVdpbmRvdy9kaWRMb2FkQ1NTU3R5bGVzJykpO1xuXG5cdFx0Y29uc3QgcGVuZGluZ0xpbmtzRGlzcG9zYWJsZXMgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRcdGxldCBwZW5kaW5nTGlua3NUb1NldHRsZSA9IDA7XG5cdFx0ZnVuY3Rpb24gb25MaW5rU2V0dGxlZCgpIHtcblx0XHRcdGlmICgtLXBlbmRpbmdMaW5rc1RvU2V0dGxlID09PSAwKSB7XG5cdFx0XHRcdHBlbmRpbmdMaW5rc0Rpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdFx0c3R5bGVzTG9hZGVkLm9wZW4oKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiBjbG9uZU5vZGUob3JpZ2luYWxOb2RlOiBFbGVtZW50KTogdm9pZCB7XG5cdFx0XHRpZiAoaXNHbG9iYWxTdHlsZXNoZWV0KG9yaWdpbmFsTm9kZSkpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyBnbG9iYWwgc3R5bGVzaGVldHMgYXJlIGhhbmRsZWQgYnkgYGNsb25lR2xvYmFsU3R5bGVzaGVldHNgIGJlbG93XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNsb25lZE5vZGUgPSBhdXhpbGlhcnlXaW5kb3cuZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChvcmlnaW5hbE5vZGUuY2xvbmVOb2RlKHRydWUpKTtcblx0XHRcdGlmIChvcmlnaW5hbE5vZGUudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnbGluaycpIHtcblx0XHRcdFx0cGVuZGluZ0xpbmtzVG9TZXR0bGUrKztcblxuXHRcdFx0XHRwZW5kaW5nTGlua3NEaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNsb25lZE5vZGUsICdsb2FkJywgb25MaW5rU2V0dGxlZCkpO1xuXHRcdFx0XHRwZW5kaW5nTGlua3NEaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNsb25lZE5vZGUsICdlcnJvcicsIG9uTGlua1NldHRsZWQpKTtcblx0XHRcdH1cblxuXHRcdFx0bWFwT3JpZ2luYWxUb0Nsb25lLnNldChvcmlnaW5hbE5vZGUsIGNsb25lZE5vZGUpO1xuXHRcdH1cblxuXHRcdC8vIENsb25lIGFsbCBzdHlsZSBlbGVtZW50cyBhbmQgc3R5bGVzaGVldCBsaW5rcyBmcm9tIHRoZSB3aW5kb3cgdG8gdGhlIGNoaWxkIHdpbmRvd1xuXHRcdC8vIGFuZCBrZWVwIHRyYWNrIG9mIDxsaW5rPiBlbGVtZW50cyB0byBzZXR0bGUgdG8gc2lnbmFsIHRoYXQgc3R5bGVzIGhhdmUgbG9hZGVkXG5cdFx0Ly8gSW5jcmVtZW50IHBlbmRpbmcgbGlua3MgcmlnaHQgZnJvbSB0aGUgYmVnaW5uaW5nIHRvIGVuc3VyZSB3ZSBvbmx5IHNldHRsZSB3aGVuXG5cdFx0Ly8gYWxsIHN0eWxlIHJlbGF0ZWQgbm9kZXMgaGF2ZSBiZWVuIGNsb25lZC5cblx0XHRwZW5kaW5nTGlua3NUb1NldHRsZSsrO1xuXHRcdHRyeSB7XG5cdFx0XHRmb3IgKGNvbnN0IG9yaWdpbmFsTm9kZSBvZiBtYWluV2luZG93LmRvY3VtZW50LmhlYWQucXVlcnlTZWxlY3RvckFsbCgnbGlua1tyZWw9XCJzdHlsZXNoZWV0XCJdLCBzdHlsZScpKSB7XG5cdFx0XHRcdGNsb25lTm9kZShvcmlnaW5hbE5vZGUpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRvbkxpbmtTZXR0bGVkKCk7XG5cdFx0fVxuXG5cdFx0Ly8gR2xvYmFsIHN0eWxlc2hlZXRzIGluIDxoZWFkPiBhcmUgY2xvbmVkIGluIGEgc3BlY2lhbCB3YXkgYmVjYXVzZSB0aGUgbXV0YXRpb25cblx0XHQvLyBvYnNlcnZlciBpcyBub3QgZmlyaW5nIGZvciBjaGFuZ2VzIGRvbmUgdmlhIGBzdHlsZS5zaGVldGAgQVBJLiBPbmx5IHRleHQgY2hhbmdlc1xuXHRcdC8vIGNhbiBiZSBvYnNlcnZlZC5cblx0XHRkaXNwb3NhYmxlcy5hZGQoY2xvbmVHbG9iYWxTdHlsZXNoZWV0cyhhdXhpbGlhcnlXaW5kb3cpKTtcblxuXHRcdC8vIExpc3RlbiB0byBuZXcgc3R5bGVzaGVldHMgYXMgdGhleSBhcmUgYmVpbmcgYWRkZWQgb3IgcmVtb3ZlZCBpbiB0aGUgbWFpbiB3aW5kb3dcblx0XHQvLyBhbmQgYXBwbHkgdG8gY2hpbGQgd2luZG93IChpbmNsdWRpbmcgY2hhbmdlcyB0byBleGlzdGluZyBzdHlsZXNoZWV0cyBlbGVtZW50cylcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2hhcmVkTXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKG1haW5XaW5kb3cuZG9jdW1lbnQuaGVhZCwgZGlzcG9zYWJsZXMsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pKG11dGF0aW9ucyA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IG11dGF0aW9uIG9mIG11dGF0aW9ucykge1xuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0bXV0YXRpb24udHlwZSAhPT0gJ2NoaWxkTGlzdCcgfHxcdFx0XHRcdFx0XHQvLyBvbmx5IGludGVyZXN0ZWQgaW4gYWRkZWQvcmVtb3ZlZCBub2Rlc1xuXHRcdFx0XHRcdG11dGF0aW9uLnRhcmdldC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpID09PSAndGl0bGUnIHx8IFx0Ly8gc2tpcCBvdmVyIHRpdGxlIGNoYW5nZXMgdGhhdCBoYXBwZW4gZnJlcXVlbnRseVxuXHRcdFx0XHRcdG11dGF0aW9uLnRhcmdldC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc2NyaXB0JyB8fCBcdC8vIGJsb2NrIDxzY3JpcHQ+IGNoYW5nZXMgdGhhdCBhcmUgdW5zdXBwb3J0ZWQgYW55d2F5XG5cdFx0XHRcdFx0bXV0YXRpb24udGFyZ2V0Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdtZXRhJ1x0XHQvLyBkbyBub3Qgb2JzZXJ2ZSA8bWV0YT4gZWxlbWVudHMgZm9yIG5vd1xuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiBtdXRhdGlvbi5hZGRlZE5vZGVzKSB7XG5cblx0XHRcdFx0XHQvLyA8c3R5bGU+LzxsaW5rPiBlbGVtZW50IHdhcyBhZGRlZFxuXHRcdFx0XHRcdGlmIChpc0hUTUxFbGVtZW50KG5vZGUpICYmIChub2RlLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3N0eWxlJyB8fCBub2RlLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2xpbmsnKSkge1xuXHRcdFx0XHRcdFx0Y2xvbmVOb2RlKG5vZGUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIHRleHQtbm9kZSB3YXMgY2hhbmdlZCwgdHJ5IHRvIGFwcGx5IHRvIG91ciBjbG9uZXNcblx0XHRcdFx0XHRlbHNlIGlmIChub2RlLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSAmJiBub2RlLnBhcmVudE5vZGUpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNsb25lZE5vZGUgPSBtYXBPcmlnaW5hbFRvQ2xvbmUuZ2V0KG5vZGUucGFyZW50Tm9kZSk7XG5cdFx0XHRcdFx0XHRpZiAoY2xvbmVkTm9kZSkge1xuXHRcdFx0XHRcdFx0XHRjbG9uZWROb2RlLnRleHRDb250ZW50ID0gbm9kZS50ZXh0Q29udGVudDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgbXV0YXRpb24ucmVtb3ZlZE5vZGVzKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2xvbmVkTm9kZSA9IG1hcE9yaWdpbmFsVG9DbG9uZS5nZXQobm9kZSk7XG5cdFx0XHRcdFx0aWYgKGNsb25lZE5vZGUpIHtcblx0XHRcdFx0XHRcdGNsb25lZE5vZGUucGFyZW50Tm9kZT8ucmVtb3ZlQ2hpbGQoY2xvbmVkTm9kZSk7XG5cdFx0XHRcdFx0XHRtYXBPcmlnaW5hbFRvQ2xvbmUuZGVsZXRlKG5vZGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdG1hcmsoJ2NvZGUvYXV4aWxpYXJ5V2luZG93L2RpZEFwcGx5Q1NTJyk7XG5cblx0XHRyZXR1cm4geyBzdHlsZXNMb2FkZWQgfTtcblx0fVxuXG5cdHByaXZhdGUgYXBwbHlIVE1MKGF1eGlsaWFyeVdpbmRvdzogQ29kZVdpbmRvdywgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IEhUTUxFbGVtZW50IHtcblx0XHRtYXJrKCdjb2RlL2F1eGlsaWFyeVdpbmRvdy93aWxsQXBwbHlIVE1MJyk7XG5cblx0XHQvLyBDcmVhdGUgd29ya2JlbmNoIGNvbnRhaW5lciBhbmQgYXBwbHkgY2xhc3Nlc1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9ICQoJ2RpdicsIHsgcm9sZTogJ2FwcGxpY2F0aW9uJyB9KTtcblx0XHRwb3NpdGlvbihjb250YWluZXIsIDAsIDAsIDAsIDAsICdyZWxhdGl2ZScpO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmZsZXhEaXJlY3Rpb24gPSAnY29sdW1uJztcblx0XHRhdXhpbGlhcnlXaW5kb3cuZG9jdW1lbnQuYm9keS5hcHBlbmQoY29udGFpbmVyKTtcblxuXHRcdC8vIFRyYWNrIGF0dHJpYnV0ZXNcblx0XHRkaXNwb3NhYmxlcy5hZGQodHJhY2tBdHRyaWJ1dGVzKG1haW5XaW5kb3cuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCBhdXhpbGlhcnlXaW5kb3cuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRyYWNrQXR0cmlidXRlcyhtYWluV2luZG93LmRvY3VtZW50LmJvZHksIGF1eGlsaWFyeVdpbmRvdy5kb2N1bWVudC5ib2R5KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRyYWNrQXR0cmlidXRlcyh0aGlzLmxheW91dFNlcnZpY2UubWFpbkNvbnRhaW5lciwgY29udGFpbmVyLCBbJ2NsYXNzJ10pKTsgLy8gb25seSBjbGFzcyBhdHRyaWJ1dGVcblxuXHRcdG1hcmsoJ2NvZGUvYXV4aWxpYXJ5V2luZG93L2RpZEFwcGx5SFRNTCcpO1xuXG5cdFx0cmV0dXJuIGNvbnRhaW5lcjtcblx0fVxuXG5cdGdldFdpbmRvdyh3aW5kb3dJZDogbnVtYmVyKTogSUF1eGlsaWFyeVdpbmRvdyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMud2luZG93cy5nZXQod2luZG93SWQpO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElBdXhpbGlhcnlXaW5kb3dTZXJ2aWNlLCBCcm93c2VyQXV4aWxpYXJ5V2luZG93U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsR0FBRyxXQUFXLGFBQWEsV0FBVyxvQkFBb0IsdUJBQXVCLGdCQUFnQixtQkFBbUIsbUJBQW1CLGlCQUFpQixlQUFlLGFBQWEsZUFBZSxVQUFVLGdCQUFnQix3QkFBd0IsdUJBQXVCO0FBQ3JSLFNBQVMsd0JBQXdCLDBCQUEwQjtBQUMzRCxTQUFxQixrQkFBa0Isa0JBQWtCO0FBQ3pELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQVksaUJBQThCLG9CQUFvQjtBQUN2RSxTQUFTLFlBQVk7QUFDckIsU0FBUyxXQUFXLGFBQWE7QUFDakMsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHlCQUFxQyx5QkFBeUI7QUFDdkUsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywrQkFBK0I7QUFFakMsTUFBTSwwQkFBMEIsZ0JBQXlDLHdCQUF3QjtBQU9qRyxJQUFLLHNC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QVMsWUFBWTtBQUd2QyxjQUFJLGNBQWMsSUFBSSxNQUFNLEtBQUssUUFBUSxZQUFZLE1BQU0sV0FBVyxLQUFLLFFBQVEsWUFBWSxNQUFNLFNBQVM7QUFDN0csc0JBQVUsSUFBSTtBQUFBLFVBQ2YsV0FHUyxLQUFLLGFBQWEsS0FBSyxhQUFhLEtBQUssWUFBWTtBQUM3RCxrQkFBTSxhQUFhLG1CQUFtQixJQUFJLEtBQUssVUFBVTtBQUN6RCxnQkFBSSxZQUFZO0FBQ2YseUJBQVcsY0FBYyxLQUFLO0FBQUEsWUFDL0I7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUVBLG1CQUFXLFFBQVEsU0FBUyxjQUFjO0FBQ3pDLGdCQUFNLGFBQWEsbUJBQW1CLElBQUksSUFBSTtBQUM5QyxjQUFJLFlBQVk7QUFDZix1QkFBVyxZQUFZLFlBQVksVUFBVTtBQUM3QywrQkFBbUIsT0FBTyxJQUFJO0FBQUEsVUFDL0I7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxrQ0FBa0M7QUFFdkMsV0FBTyxFQUFFLGFBQWE7QUFBQSxFQUN2QjtBQUFBLEVBRVEsVUFBVSxpQkFBNkIsYUFBMkM7QUFDekYsU0FBSyxvQ0FBb0M7QUFHekMsVUFBTSxZQUFZLEVBQUUsT0FBTyxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ2xELGFBQVMsV0FBVyxHQUFHLEdBQUcsR0FBRyxHQUFHLFVBQVU7QUFDMUMsY0FBVSxNQUFNLFVBQVU7QUFDMUIsY0FBVSxNQUFNLFNBQVM7QUFDekIsY0FBVSxNQUFNLGdCQUFnQjtBQUNoQyxvQkFBZ0IsU0FBUyxLQUFLLE9BQU8sU0FBUztBQUc5QyxnQkFBWSxJQUFJLGdCQUFnQixXQUFXLFNBQVMsaUJBQWlCLGdCQUFnQixTQUFTLGVBQWUsQ0FBQztBQUM5RyxnQkFBWSxJQUFJLGdCQUFnQixXQUFXLFNBQVMsTUFBTSxnQkFBZ0IsU0FBUyxJQUFJLENBQUM7QUFDeEYsZ0JBQVksSUFBSSxnQkFBZ0IsS0FBSyxjQUFjLGVBQWUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBRXZGLFNBQUssbUNBQW1DO0FBRXhDLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxVQUFVLFVBQWdEO0FBQ3pELFdBQU8sS0FBSyxRQUFRLElBQUksUUFBUTtBQUFBLEVBQ2pDO0FBQ0Q7QUE3U2EsOEJBSVksZUFBZTtBQUozQiw4QkFNRyxhQUFhLFlBQVksVUFBVSxJQUFJO0FBTjFDLGdDQUFOO0FBQUEsRUFjSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FuQlU7QUErU2Isa0JBQWtCLHlCQUF5QiwrQkFBK0Isa0JBQWtCLE9BQU87IiwKICAibmFtZXMiOiBbIkF1eGlsaWFyeVdpbmRvd01vZGUiXQp9Cg==
