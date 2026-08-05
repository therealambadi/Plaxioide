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
import { isSafari, setFullscreen } from "../../base/browser/browser.js";
import { addDisposableListener, EventHelper, EventType, getActiveWindow, getWindow, getWindowById, getWindows, getWindowsCount, windowOpenNoOpener, windowOpenPopup, windowOpenWithSuccess } from "../../base/browser/dom.js";
import { DomEmitter } from "../../base/browser/event.js";
import { requestHidDevice, requestSerialPort, requestUsbDevice } from "../../base/browser/deviceAccess.js";
import { timeout } from "../../base/common/async.js";
import { Event } from "../../base/common/event.js";
import { Disposable, dispose, toDisposable } from "../../base/common/lifecycle.js";
import { matchesScheme, Schemas } from "../../base/common/network.js";
import { isIOS, isMacintosh } from "../../base/common/platform.js";
import Severity from "../../base/common/severity.js";
import { URI } from "../../base/common/uri.js";
import { localize } from "../../nls.js";
import { CommandsRegistry } from "../../platform/commands/common/commands.js";
import { IDialogService } from "../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../platform/label/common/label.js";
import { IOpenerService } from "../../platform/opener/common/opener.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { IBrowserWorkbenchEnvironmentService } from "../services/environment/browser/environmentService.js";
import { IWorkbenchLayoutService } from "../services/layout/browser/layoutService.js";
import { ILifecycleService, ShutdownReason } from "../services/lifecycle/common/lifecycle.js";
import { IHostService } from "../services/host/browser/host.js";
import { registerWindowDriver } from "../services/driver/browser/driver.js";
import { isAuxiliaryWindow, mainWindow } from "../../base/browser/window.js";
import { createSingleCallFunction } from "../../base/common/functional.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { IWorkbenchEnvironmentService } from "../services/environment/common/environmentService.js";
let BaseWindow = class extends Disposable {
  constructor(targetWindow, dom = { getWindowsCount, getWindows }, hostService, environmentService) {
    super();
    this.hostService = hostService;
    this.environmentService = environmentService;
    this.enableWindowFocusOnElementFocus(targetWindow);
    this.enableMultiWindowAwareTimeout(targetWindow, dom);
    this.registerFullScreenListeners(targetWindow.vscodeWindowId);
  }
  //#region focus handling in multi-window applications
  enableWindowFocusOnElementFocus(targetWindow) {
    const originalFocus = targetWindow.HTMLElement.prototype.focus;
    const that = this;
    targetWindow.HTMLElement.prototype.focus = function(options) {
      that.onElementFocus(getWindow(this));
      originalFocus.apply(this, [options]);
    };
  }
  onElementFocus(targetWindow) {
    const activeWindow = getActiveWindow();
    if (activeWindow !== targetWindow && activeWindow.document.hasFocus()) {
      targetWindow.focus();
      if (!this.environmentService.extensionTestsLocationURI && !targetWindow.document.hasFocus()) {
        this.hostService.focus(targetWindow);
      }
    }
  }
  //#endregion
  //#region timeout handling in multi-window applications
  enableMultiWindowAwareTimeout(targetWindow, dom = { getWindowsCount, getWindows }) {
    const originalSetTimeout = targetWindow.setTimeout;
    Object.defineProperty(targetWindow, "vscodeOriginalSetTimeout", { get: () => originalSetTimeout });
    const originalClearTimeout = targetWindow.clearTimeout;
    Object.defineProperty(targetWindow, "vscodeOriginalClearTimeout", { get: () => originalClearTimeout });
    targetWindow.setTimeout = function(handler, timeout2 = 0, ...args) {
      if (dom.getWindowsCount() === 1 || typeof handler === "string" || timeout2 === 0) {
        return originalSetTimeout.apply(this, [handler, timeout2, ...args]);
      }
      const timeoutDisposables = /* @__PURE__ */ new Set();
      const timeoutHandle = BaseWindow.TIMEOUT_HANDLES++;
      BaseWindow.TIMEOUT_DISPOSABLES.set(timeoutHandle, timeoutDisposables);
      const handlerFn = createSingleCallFunction(handler, () => {
        dispose(timeoutDisposables);
        BaseWindow.TIMEOUT_DISPOSABLES.delete(timeoutHandle);
      });
      for (const { window, disposables } of dom.getWindows()) {
        if (isAuxiliaryWindow(window) && window.document.visibilityState === "hidden") {
          continue;
        }
        let didClear = false;
        const handle = window.vscodeOriginalSetTimeout.apply(this, [(...args2) => {
          if (didClear) {
            return;
          }
          handlerFn(...args2);
        }, timeout2, ...args]);
        const timeoutDisposable = toDisposable(() => {
          didClear = true;
          window.vscodeOriginalClearTimeout(handle);
          timeoutDisposables.delete(timeoutDisposable);
        });
        disposables.add(timeoutDisposable);
        timeoutDisposables.add(timeoutDisposable);
      }
      return timeoutHandle;
    };
    targetWindow.clearTimeout = function(timeoutHandle) {
      const timeoutDisposables = typeof timeoutHandle === "number" ? BaseWindow.TIMEOUT_DISPOSABLES.get(timeoutHandle) : void 0;
      if (timeoutDisposables) {
        dispose(timeoutDisposables);
        BaseWindow.TIMEOUT_DISPOSABLES.delete(timeoutHandle);
      } else {
        originalClearTimeout.apply(this, [timeoutHandle]);
      }
    };
  }
  //#endregion
  registerFullScreenListeners(targetWindowId) {
    this._register(this.hostService.onDidChangeFullScreen(({ windowId, fullscreen }) => {
      if (windowId === targetWindowId) {
        const targetWindow = getWindowById(targetWindowId);
        if (targetWindow) {
          setFullscreen(fullscreen, targetWindow.window);
        }
      }
    }));
  }
  //#region Confirm on Shutdown
  static async confirmOnShutdown(accessor, reason) {
    const dialogService = accessor.get(IDialogService);
    const configurationService = accessor.get(IConfigurationService);
    const message = reason === ShutdownReason.QUIT ? isMacintosh ? localize("quitMessageMac", "Are you sure you want to quit?") : localize("quitMessage", "Are you sure you want to exit?") : localize("closeWindowMessage", "Are you sure you want to close the window?");
    const primaryButton = reason === ShutdownReason.QUIT ? isMacintosh ? localize({ key: "quitButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Quit") : localize({ key: "exitButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Exit") : localize({ key: "closeWindowButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Close Window");
    const res = await dialogService.confirm({
      message,
      primaryButton,
      checkbox: {
        label: localize("doNotAskAgain", "Do not ask me again")
      }
    });
    if (res.confirmed && res.checkboxChecked) {
      await configurationService.updateValue("window.confirmBeforeClose", "never");
    }
    return res.confirmed;
  }
  //#endregion
};
BaseWindow.TIMEOUT_HANDLES = Number.MIN_SAFE_INTEGER;
// try to not compete with the IDs of native `setTimeout`
BaseWindow.TIMEOUT_DISPOSABLES = /* @__PURE__ */ new Map();
BaseWindow = __decorateClass([
  __decorateParam(2, IHostService),
  __decorateParam(3, IWorkbenchEnvironmentService)
], BaseWindow);
let BrowserWindow = class extends BaseWindow {
  constructor(openerService, lifecycleService, dialogService, labelService, productService, browserEnvironmentService, layoutService, instantiationService, hostService) {
    super(mainWindow, void 0, hostService, browserEnvironmentService);
    this.openerService = openerService;
    this.lifecycleService = lifecycleService;
    this.dialogService = dialogService;
    this.labelService = labelService;
    this.productService = productService;
    this.browserEnvironmentService = browserEnvironmentService;
    this.layoutService = layoutService;
    this.instantiationService = instantiationService;
    this.registerListeners();
    this.create();
  }
  registerListeners() {
    this._register(this.lifecycleService.onWillShutdown(() => this.onWillShutdown()));
    const viewport = isIOS && mainWindow.visualViewport ? mainWindow.visualViewport : mainWindow;
    this._register(addDisposableListener(viewport, EventType.RESIZE, () => {
      this.layoutService.layout();
      if (isIOS) {
        mainWindow.scrollTo(0, 0);
      }
    }));
    this._register(addDisposableListener(this.layoutService.mainContainer, EventType.WHEEL, (e) => e.preventDefault(), { passive: false }));
    this._register(addDisposableListener(this.layoutService.mainContainer, EventType.CONTEXT_MENU, (e) => EventHelper.stop(e, true)));
    this._register(addDisposableListener(this.layoutService.mainContainer, EventType.DROP, (e) => EventHelper.stop(e, true)));
  }
  onWillShutdown() {
    Event.toPromise(Event.any(
      Event.once(new DomEmitter(mainWindow.document.body, EventType.KEY_DOWN, true).event),
      Event.once(new DomEmitter(mainWindow.document.body, EventType.MOUSE_DOWN, true).event)
    )).then(async () => {
      await timeout(3e3);
      await this.dialogService.prompt({
        type: Severity.Error,
        message: localize("shutdownError", "An unexpected error occurred that requires a reload of this page."),
        detail: localize("shutdownErrorDetail", "The workbench was unexpectedly disposed while running."),
        buttons: [
          {
            label: localize({ key: "reload", comment: ["&& denotes a mnemonic"] }, "&&Reload"),
            run: () => mainWindow.location.reload()
            // do not use any services at this point since they are likely not functional at this point
          }
        ]
      });
    });
  }
  create() {
    this.setupOpenHandlers();
    this.registerLabelFormatters();
    this.registerCommands();
    this.setupDriver();
  }
  setupDriver() {
    if (this.environmentService.enableSmokeTestDriver) {
      registerWindowDriver(this.instantiationService);
    }
  }
  setupOpenHandlers() {
    this.openerService.setDefaultExternalOpener({
      openExternal: async (href) => {
        let isAllowedOpener = false;
        if (this.browserEnvironmentService.options?.openerAllowedExternalUrlPrefixes) {
          for (const trustedPopupPrefix of this.browserEnvironmentService.options.openerAllowedExternalUrlPrefixes) {
            if (href.startsWith(trustedPopupPrefix)) {
              isAllowedOpener = true;
              break;
            }
          }
        }
        if (matchesScheme(href, Schemas.http) || matchesScheme(href, Schemas.https)) {
          if (isSafari) {
            const opened = windowOpenWithSuccess(href, !isAllowedOpener);
            if (!opened) {
              await this.dialogService.prompt({
                type: Severity.Warning,
                message: localize("unableToOpenExternal", "The browser interrupted the opening of a new tab or window. Press 'Open' to open it anyway."),
                detail: href,
                buttons: [
                  {
                    label: localize({ key: "open", comment: ["&& denotes a mnemonic"] }, "&&Open"),
                    run: () => isAllowedOpener ? windowOpenPopup(href) : windowOpenNoOpener(href)
                  },
                  {
                    label: localize({ key: "learnMore", comment: ["&& denotes a mnemonic"] }, "&&Learn More"),
                    run: () => this.openerService.open(URI.parse("https://aka.ms/allow-vscode-popup"))
                  }
                ],
                cancelButton: true
              });
            }
          } else {
            isAllowedOpener ? windowOpenPopup(href) : windowOpenNoOpener(href);
          }
        } else {
          const invokeProtocolHandler = () => {
            this.lifecycleService.withExpectedShutdown({ disableShutdownHandling: true }, () => mainWindow.location.href = href);
          };
          invokeProtocolHandler();
          const showProtocolUrlOpenedDialog = async () => {
            const { downloadUrl } = this.productService;
            let detail;
            const buttons = [
              {
                label: localize({ key: "openExternalDialogButtonRetry.v2", comment: ["&& denotes a mnemonic"] }, "&&Try Again"),
                run: () => invokeProtocolHandler()
              }
            ];
            if (downloadUrl !== void 0) {
              detail = localize(
                "openExternalDialogDetail.v2",
                "We launched {0} on your computer.\n\nIf {1} did not launch, try again or install it below.",
                this.productService.nameLong,
                this.productService.nameLong
              );
              buttons.push({
                label: localize({ key: "openExternalDialogButtonInstall.v3", comment: ["&& denotes a mnemonic"] }, "&&Install"),
                run: async () => {
                  await this.openerService.open(URI.parse(downloadUrl));
                  showProtocolUrlOpenedDialog();
                }
              });
            } else {
              detail = localize(
                "openExternalDialogDetailNoInstall",
                "We launched {0} on your computer.\n\nIf {1} did not launch, try again below.",
                this.productService.nameLong,
                this.productService.nameLong
              );
            }
            await this.hostService.withExpectedShutdown(() => this.dialogService.prompt({
              type: Severity.Info,
              message: localize("openExternalDialogTitle", "All done. You can close this tab now."),
              detail,
              buttons,
              cancelButton: true
            }));
          };
          if (matchesScheme(href, this.productService.urlProtocol)) {
            await showProtocolUrlOpenedDialog();
          }
        }
        return true;
      }
    });
  }
  registerLabelFormatters() {
    this._register(this.labelService.registerFormatter({
      scheme: Schemas.vscodeUserData,
      priority: true,
      formatting: {
        label: "(Settings) ${path}",
        separator: "/"
      }
    }));
  }
  registerCommands() {
    CommandsRegistry.registerCommand("workbench.experimental.requestUsbDevice", async (_accessor, options) => {
      return requestUsbDevice(options);
    });
    CommandsRegistry.registerCommand("workbench.experimental.requestSerialPort", async (_accessor, options) => {
      return requestSerialPort(options);
    });
    CommandsRegistry.registerCommand("workbench.experimental.requestHidDevice", async (_accessor, options) => {
      return requestHidDevice(options);
    });
  }
};
BrowserWindow = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, ILifecycleService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IBrowserWorkbenchEnvironmentService),
  __decorateParam(6, IWorkbenchLayoutService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IHostService)
], BrowserWindow);
export {
  BaseWindow,
  BrowserWindow
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci93aW5kb3cudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc1NhZmFyaSwgc2V0RnVsbHNjcmVlbiB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgRXZlbnRIZWxwZXIsIEV2ZW50VHlwZSwgZ2V0QWN0aXZlV2luZG93LCBnZXRXaW5kb3csIGdldFdpbmRvd0J5SWQsIGdldFdpbmRvd3MsIGdldFdpbmRvd3NDb3VudCwgd2luZG93T3Blbk5vT3BlbmVyLCB3aW5kb3dPcGVuUG9wdXAsIHdpbmRvd09wZW5XaXRoU3VjY2VzcyB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRG9tRW1pdHRlciB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9ldmVudC5qcyc7XG5pbXBvcnQgeyBIaWREZXZpY2VEYXRhLCByZXF1ZXN0SGlkRGV2aWNlLCByZXF1ZXN0U2VyaWFsUG9ydCwgcmVxdWVzdFVzYkRldmljZSwgU2VyaWFsUG9ydERhdGEsIFVzYkRldmljZURhdGEgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvZGV2aWNlQWNjZXNzLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCBkaXNwb3NlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbWF0Y2hlc1NjaGVtZSwgU2NoZW1hcyB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgaXNJT1MsIGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlLCBJUHJvbXB0QnV0dG9uIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBCcm93c2VyTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9icm93c2VyL2xpZmVjeWNsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIFNodXRkb3duUmVhc29uIH0gZnJvbSAnLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJXaW5kb3dEcml2ZXIgfSBmcm9tICcuLi9zZXJ2aWNlcy9kcml2ZXIvYnJvd3Nlci9kcml2ZXIuanMnO1xuaW1wb3J0IHsgQ29kZVdpbmRvdywgaXNBdXhpbGlhcnlXaW5kb3csIG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbiB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2Z1bmN0aW9uYWwuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlV2luZG93IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgVElNRU9VVF9IQU5ETEVTID0gTnVtYmVyLk1JTl9TQUZFX0lOVEVHRVI7IC8vIHRyeSB0byBub3QgY29tcGV0ZSB3aXRoIHRoZSBJRHMgb2YgbmF0aXZlIGBzZXRUaW1lb3V0YFxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBUSU1FT1VUX0RJU1BPU0FCTEVTID0gbmV3IE1hcDxudW1iZXIsIFNldDxJRGlzcG9zYWJsZT4+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0dGFyZ2V0V2luZG93OiBDb2RlV2luZG93LFxuXHRcdGRvbSA9IHsgZ2V0V2luZG93c0NvdW50LCBnZXRXaW5kb3dzIH0sIC8qIGZvciB0ZXN0aW5nICovXG5cdFx0QElIb3N0U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmVuYWJsZVdpbmRvd0ZvY3VzT25FbGVtZW50Rm9jdXModGFyZ2V0V2luZG93KTtcblx0XHR0aGlzLmVuYWJsZU11bHRpV2luZG93QXdhcmVUaW1lb3V0KHRhcmdldFdpbmRvdywgZG9tKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJGdWxsU2NyZWVuTGlzdGVuZXJzKHRhcmdldFdpbmRvdy52c2NvZGVXaW5kb3dJZCk7XG5cdH1cblxuXHQvLyNyZWdpb24gZm9jdXMgaGFuZGxpbmcgaW4gbXVsdGktd2luZG93IGFwcGxpY2F0aW9uc1xuXG5cdHByb3RlY3RlZCBlbmFibGVXaW5kb3dGb2N1c09uRWxlbWVudEZvY3VzKHRhcmdldFdpbmRvdzogQ29kZVdpbmRvdyk6IHZvaWQge1xuXHRcdGNvbnN0IG9yaWdpbmFsRm9jdXMgPSB0YXJnZXRXaW5kb3cuSFRNTEVsZW1lbnQucHJvdG90eXBlLmZvY3VzO1xuXG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0dGFyZ2V0V2luZG93LkhUTUxFbGVtZW50LnByb3RvdHlwZS5mb2N1cyA9IGZ1bmN0aW9uICh0aGlzOiBIVE1MRWxlbWVudCwgb3B0aW9ucz86IEZvY3VzT3B0aW9ucyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXG5cdFx0XHQvLyBFbnN1cmUgdGhlIHdpbmRvdyB0aGUgZWxlbWVudCBiZWxvbmdzIHRvIGlzIGZvY3VzZWRcblx0XHRcdC8vIGluIHNjZW5hcmlvcyB3aGVyZSBhdXhpbGlhcnkgd2luZG93cyBhcmUgcHJlc2VudFxuXHRcdFx0dGhhdC5vbkVsZW1lbnRGb2N1cyhnZXRXaW5kb3codGhpcykpO1xuXG5cdFx0XHQvLyBQYXNzIHRvIG9yaWdpbmFsIGZvY3VzKCkgbWV0aG9kXG5cdFx0XHRvcmlnaW5hbEZvY3VzLmFwcGx5KHRoaXMsIFtvcHRpb25zXSk7XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgb25FbGVtZW50Rm9jdXModGFyZ2V0V2luZG93OiBDb2RlV2luZG93KTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gZ2V0QWN0aXZlV2luZG93KCk7XG5cdFx0aWYgKGFjdGl2ZVdpbmRvdyAhPT0gdGFyZ2V0V2luZG93ICYmIGFjdGl2ZVdpbmRvdy5kb2N1bWVudC5oYXNGb2N1cygpKSB7XG5cblx0XHRcdC8vIENhbGwgb3JpZ2luYWwgZm9jdXMoKVxuXHRcdFx0dGFyZ2V0V2luZG93LmZvY3VzKCk7XG5cblx0XHRcdC8vIEluIEVsZWN0cm9uLCBgd2luZG93LmZvY3VzKClgIGZhaWxzIHRvIGJyaW5nIHRoZSB3aW5kb3dcblx0XHRcdC8vIHRvIHRoZSBmcm9udCBpZiBtdWx0aXBsZSB3aW5kb3dzIGV4aXN0IGluIHRoZSBzYW1lIHByb2Nlc3Ncblx0XHRcdC8vIGdyb3VwIChmbG9hdGluZyB3aW5kb3dzKS4gQXMgc3VjaCwgd2UgYXNrIHRoZSBob3N0IHNlcnZpY2Vcblx0XHRcdC8vIHRvIGZvY3VzIHRoZSB3aW5kb3cgd2hpY2ggY2FuIHRha2UgY2FyZSBvZiBicmluZ2luIHRoZVxuXHRcdFx0Ly8gd2luZG93IHRvIHRoZSBmcm9udC5cblx0XHRcdC8vXG5cdFx0XHQvLyBUbyBtaW5pbWlzZSBkaXNydXB0aW9uIGJ5IGJyaW5naW5nIHdpbmRvd3MgdG8gdGhlIGZyb250XG5cdFx0XHQvLyBieSBhY2NpZGVudCwgd2Ugb25seSBkbyB0aGlzIGlmIHRoZSB3aW5kb3cgaXMgbm90IGFscmVhZHlcblx0XHRcdC8vIGZvY3VzZWQgYW5kIHRoZSBhY3RpdmUgd2luZG93IGlzIG5vdCB0aGUgdGFyZ2V0IHdpbmRvd1xuXHRcdFx0Ly8gYnV0IGhhcyBmb2N1cy4gVGhpcyBpcyBhbiBpbmRpY2F0aW9uIHRoYXQgbXVsdGlwbGUgd2luZG93c1xuXHRcdFx0Ly8gYXJlIG9wZW5lZCBpbiB0aGUgc2FtZSBwcm9jZXNzIGdyb3VwIHdoaWxlIHRoZSB0YXJnZXQgd2luZG93XG5cdFx0XHQvLyBpcyBub3QgZm9jdXNlZC5cblxuXHRcdFx0aWYgKFxuXHRcdFx0XHQhdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZXh0ZW5zaW9uVGVzdHNMb2NhdGlvblVSSSAmJlxuXHRcdFx0XHQhdGFyZ2V0V2luZG93LmRvY3VtZW50Lmhhc0ZvY3VzKClcblx0XHRcdCkge1xuXHRcdFx0XHR0aGlzLmhvc3RTZXJ2aWNlLmZvY3VzKHRhcmdldFdpbmRvdyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIHRpbWVvdXQgaGFuZGxpbmcgaW4gbXVsdGktd2luZG93IGFwcGxpY2F0aW9uc1xuXG5cdHByb3RlY3RlZCBlbmFibGVNdWx0aVdpbmRvd0F3YXJlVGltZW91dCh0YXJnZXRXaW5kb3c6IFdpbmRvdywgZG9tID0geyBnZXRXaW5kb3dzQ291bnQsIGdldFdpbmRvd3MgfSk6IHZvaWQge1xuXG5cdFx0Ly8gT3ZlcnJpZGUgYHNldFRpbWVvdXRgIGFuZCBgY2xlYXJUaW1lb3V0YCBvbiB0aGUgcHJvdmlkZWQgd2luZG93IHRvIG1ha2Vcblx0XHQvLyBzdXJlIHRpbWVvdXRzIGFyZSBkaXNwYXRjaGVkIHRvIGFsbCBvcGVuZWQgd2luZG93cy4gU29tZSBicm93c2VycyBtYXkgZGVjaWRlXG5cdFx0Ly8gdG8gdGhyb3R0bGUgdGltZW91dHMgaW4gbWluaW1pemVkIHdpbmRvd3MsIHNvIHdpdGggdGhpcyB3ZSBjYW4gZW5zdXJlIHRoZVxuXHRcdC8vIHRpbWVvdXQgaXMgc2NoZWR1bGVkIHdpdGhvdXQgYmVpbmcgdGhyb3R0bGVkICh1bmxlc3MgYWxsIHdpbmRvd3MgYXJlIG1pbmltaXplZCkuXG5cblx0XHRjb25zdCBvcmlnaW5hbFNldFRpbWVvdXQgPSB0YXJnZXRXaW5kb3cuc2V0VGltZW91dDtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0V2luZG93LCAndnNjb2RlT3JpZ2luYWxTZXRUaW1lb3V0JywgeyBnZXQ6ICgpID0+IG9yaWdpbmFsU2V0VGltZW91dCB9KTtcblxuXHRcdGNvbnN0IG9yaWdpbmFsQ2xlYXJUaW1lb3V0ID0gdGFyZ2V0V2luZG93LmNsZWFyVGltZW91dDtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0V2luZG93LCAndnNjb2RlT3JpZ2luYWxDbGVhclRpbWVvdXQnLCB7IGdldDogKCkgPT4gb3JpZ2luYWxDbGVhclRpbWVvdXQgfSk7XG5cblx0XHR0YXJnZXRXaW5kb3cuc2V0VGltZW91dCA9IGZ1bmN0aW9uICh0aGlzOiB1bmtub3duLCBoYW5kbGVyOiBUaW1lckhhbmRsZXIsIHRpbWVvdXQgPSAwLCAuLi5hcmdzOiB1bmtub3duW10pOiBudW1iZXIge1xuXHRcdFx0aWYgKGRvbS5nZXRXaW5kb3dzQ291bnQoKSA9PT0gMSB8fCB0eXBlb2YgaGFuZGxlciA9PT0gJ3N0cmluZycgfHwgdGltZW91dCA9PT0gMCAvKiBpbW1lZGlhdGVzIGFyZSBuZXZlciB0aHJvdHRsZWQgKi8pIHtcblx0XHRcdFx0cmV0dXJuIG9yaWdpbmFsU2V0VGltZW91dC5hcHBseSh0aGlzLCBbaGFuZGxlciwgdGltZW91dCwgLi4uYXJnc10pO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0aW1lb3V0RGlzcG9zYWJsZXMgPSBuZXcgU2V0PElEaXNwb3NhYmxlPigpO1xuXHRcdFx0Y29uc3QgdGltZW91dEhhbmRsZSA9IEJhc2VXaW5kb3cuVElNRU9VVF9IQU5ETEVTKys7XG5cdFx0XHRCYXNlV2luZG93LlRJTUVPVVRfRElTUE9TQUJMRVMuc2V0KHRpbWVvdXRIYW5kbGUsIHRpbWVvdXREaXNwb3NhYmxlcyk7XG5cblx0XHRcdGNvbnN0IGhhbmRsZXJGbiA9IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbihoYW5kbGVyLCAoKSA9PiB7XG5cdFx0XHRcdGRpc3Bvc2UodGltZW91dERpc3Bvc2FibGVzKTtcblx0XHRcdFx0QmFzZVdpbmRvdy5USU1FT1VUX0RJU1BPU0FCTEVTLmRlbGV0ZSh0aW1lb3V0SGFuZGxlKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHsgd2luZG93LCBkaXNwb3NhYmxlcyB9IG9mIGRvbS5nZXRXaW5kb3dzKCkpIHtcblx0XHRcdFx0aWYgKGlzQXV4aWxpYXJ5V2luZG93KHdpbmRvdykgJiYgd2luZG93LmRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZSA9PT0gJ2hpZGRlbicpIHtcblx0XHRcdFx0XHRjb250aW51ZTsgLy8gc2tpcCBvdmVyIGhpZGRlbiB3aW5kb3dzIChidXQgbmV2ZXIgb3ZlciBtYWluIHdpbmRvdylcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIHdlIHRyYWNrIGRpZENsZWFyIGluIGNhc2UgdGhlIGJyb3dzZXIgZG9lcyBub3QgcHJvcGVybHkgY2xlYXIgdGhlIHRpbWVvdXRcblx0XHRcdFx0Ly8gdGhpcyBjYW4gaGFwcGVuIGZvciB0aW1lb3V0cyBvbiB1bmZvY3VzZWQgd2luZG93c1xuXHRcdFx0XHRsZXQgZGlkQ2xlYXIgPSBmYWxzZTtcblxuXHRcdFx0XHRjb25zdCBoYW5kbGUgPSAod2luZG93IGFzIGFueSkudnNjb2RlT3JpZ2luYWxTZXRUaW1lb3V0LmFwcGx5KHRoaXMsIFsoLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGRpZENsZWFyKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGhhbmRsZXJGbiguLi5hcmdzKTtcblx0XHRcdFx0fSwgdGltZW91dCwgLi4uYXJnc10pO1xuXG5cdFx0XHRcdGNvbnN0IHRpbWVvdXREaXNwb3NhYmxlID0gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0XHRkaWRDbGVhciA9IHRydWU7XG5cdFx0XHRcdFx0KHdpbmRvdyBhcyBhbnkpLnZzY29kZU9yaWdpbmFsQ2xlYXJUaW1lb3V0KGhhbmRsZSk7XG5cdFx0XHRcdFx0dGltZW91dERpc3Bvc2FibGVzLmRlbGV0ZSh0aW1lb3V0RGlzcG9zYWJsZSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aW1lb3V0RGlzcG9zYWJsZSk7XG5cdFx0XHRcdHRpbWVvdXREaXNwb3NhYmxlcy5hZGQodGltZW91dERpc3Bvc2FibGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGltZW91dEhhbmRsZTtcblx0XHR9O1xuXG5cdFx0dGFyZ2V0V2luZG93LmNsZWFyVGltZW91dCA9IGZ1bmN0aW9uICh0aGlzOiB1bmtub3duLCB0aW1lb3V0SGFuZGxlOiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRcdGNvbnN0IHRpbWVvdXREaXNwb3NhYmxlcyA9IHR5cGVvZiB0aW1lb3V0SGFuZGxlID09PSAnbnVtYmVyJyA/IEJhc2VXaW5kb3cuVElNRU9VVF9ESVNQT1NBQkxFUy5nZXQodGltZW91dEhhbmRsZSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodGltZW91dERpc3Bvc2FibGVzKSB7XG5cdFx0XHRcdGRpc3Bvc2UodGltZW91dERpc3Bvc2FibGVzKTtcblx0XHRcdFx0QmFzZVdpbmRvdy5USU1FT1VUX0RJU1BPU0FCTEVTLmRlbGV0ZSh0aW1lb3V0SGFuZGxlISk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvcmlnaW5hbENsZWFyVGltZW91dC5hcHBseSh0aGlzLCBbdGltZW91dEhhbmRsZV0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRwcml2YXRlIHJlZ2lzdGVyRnVsbFNjcmVlbkxpc3RlbmVycyh0YXJnZXRXaW5kb3dJZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ob3N0U2VydmljZS5vbkRpZENoYW5nZUZ1bGxTY3JlZW4oKHsgd2luZG93SWQsIGZ1bGxzY3JlZW4gfSkgPT4ge1xuXHRcdFx0aWYgKHdpbmRvd0lkID09PSB0YXJnZXRXaW5kb3dJZCkge1xuXHRcdFx0XHRjb25zdCB0YXJnZXRXaW5kb3cgPSBnZXRXaW5kb3dCeUlkKHRhcmdldFdpbmRvd0lkKTtcblx0XHRcdFx0aWYgKHRhcmdldFdpbmRvdykge1xuXHRcdFx0XHRcdHNldEZ1bGxzY3JlZW4oZnVsbHNjcmVlbiwgdGFyZ2V0V2luZG93LndpbmRvdyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQvLyNyZWdpb24gQ29uZmlybSBvbiBTaHV0ZG93blxuXG5cdHN0YXRpYyBhc3luYyBjb25maXJtT25TaHV0ZG93bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmVhc29uOiBTaHV0ZG93blJlYXNvbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBtZXNzYWdlID0gcmVhc29uID09PSBTaHV0ZG93blJlYXNvbi5RVUlUID9cblx0XHRcdChpc01hY2ludG9zaCA/IGxvY2FsaXplKCdxdWl0TWVzc2FnZU1hYycsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHF1aXQ/XCIpIDogbG9jYWxpemUoJ3F1aXRNZXNzYWdlJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZXhpdD9cIikpIDpcblx0XHRcdGxvY2FsaXplKCdjbG9zZVdpbmRvd01lc3NhZ2UnLCBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBjbG9zZSB0aGUgd2luZG93P1wiKTtcblx0XHRjb25zdCBwcmltYXJ5QnV0dG9uID0gcmVhc29uID09PSBTaHV0ZG93blJlYXNvbi5RVUlUID9cblx0XHRcdChpc01hY2ludG9zaCA/IGxvY2FsaXplKHsga2V5OiAncXVpdEJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUXVpdFwiKSA6IGxvY2FsaXplKHsga2V5OiAnZXhpdEJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmRXhpdFwiKSkgOlxuXHRcdFx0bG9jYWxpemUoeyBrZXk6ICdjbG9zZVdpbmRvd0J1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ2xvc2UgV2luZG93XCIpO1xuXG5cdFx0Y29uc3QgcmVzID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRwcmltYXJ5QnV0dG9uLFxuXHRcdFx0Y2hlY2tib3g6IHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdkb05vdEFza0FnYWluJywgXCJEbyBub3QgYXNrIG1lIGFnYWluXCIpXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBVcGRhdGUgc2V0dGluZyBpZiBjaGVja2JveCBjaGVja2VkXG5cdFx0aWYgKHJlcy5jb25maXJtZWQgJiYgcmVzLmNoZWNrYm94Q2hlY2tlZCkge1xuXHRcdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ3dpbmRvdy5jb25maXJtQmVmb3JlQ2xvc2UnLCAnbmV2ZXInKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzLmNvbmZpcm1lZDtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxufVxuXG5leHBvcnQgY2xhc3MgQnJvd3NlcldpbmRvdyBleHRlbmRzIEJhc2VXaW5kb3cge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IEJyb3dzZXJMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGJyb3dzZXJFbnZpcm9ubWVudFNlcnZpY2U6IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihtYWluV2luZG93LCB1bmRlZmluZWQsIGhvc3RTZXJ2aWNlLCBicm93c2VyRW52aXJvbm1lbnRTZXJ2aWNlKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIExpZmVjeWNsZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlmZWN5Y2xlU2VydmljZS5vbldpbGxTaHV0ZG93bigoKSA9PiB0aGlzLm9uV2lsbFNodXRkb3duKCkpKTtcblxuXHRcdC8vIExheW91dFxuXHRcdGNvbnN0IHZpZXdwb3J0ID0gaXNJT1MgJiYgbWFpbldpbmRvdy52aXN1YWxWaWV3cG9ydCA/IG1haW5XaW5kb3cudmlzdWFsVmlld3BvcnQgLyoqIFZpc3VhbCB2aWV3cG9ydCAqLyA6IG1haW5XaW5kb3cgLyoqIExheW91dCB2aWV3cG9ydCAqLztcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodmlld3BvcnQsIEV2ZW50VHlwZS5SRVNJWkUsICgpID0+IHtcblx0XHRcdHRoaXMubGF5b3V0U2VydmljZS5sYXlvdXQoKTtcblxuXHRcdFx0Ly8gU29tZXRpbWVzIHRoZSBrZXlib2FyZCBhcHBlYXJpbmcgc2Nyb2xscyB0aGUgd2hvbGUgd29ya2JlbmNoIG91dCBvZiB2aWV3LCBhcyBhIHdvcmthcm91bmQgc2Nyb2xsIGJhY2sgaW50byB2aWV3ICMxMjEyMDZcblx0XHRcdGlmIChpc0lPUykge1xuXHRcdFx0XHRtYWluV2luZG93LnNjcm9sbFRvKDAsIDApO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIFByZXZlbnQgdGhlIGJhY2svZm9yd2FyZCBnZXN0dXJlcyBpbiBtYWNPU1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmxheW91dFNlcnZpY2UubWFpbkNvbnRhaW5lciwgRXZlbnRUeXBlLldIRUVMLCBlID0+IGUucHJldmVudERlZmF1bHQoKSwgeyBwYXNzaXZlOiBmYWxzZSB9KSk7XG5cblx0XHQvLyBQcmV2ZW50IG5hdGl2ZSBjb250ZXh0IG1lbnVzIGluIHdlYlxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmxheW91dFNlcnZpY2UubWFpbkNvbnRhaW5lciwgRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgZSA9PiBFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpKSk7XG5cblx0XHQvLyBQcmV2ZW50IGRlZmF1bHQgbmF2aWdhdGlvbiBvbiBkcm9wXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMubGF5b3V0U2VydmljZS5tYWluQ29udGFpbmVyLCBFdmVudFR5cGUuRFJPUCwgZSA9PiBFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uV2lsbFNodXRkb3duKCk6IHZvaWQge1xuXG5cdFx0Ly8gVHJ5IHRvIGRldGVjdCBzb21lIHVzZXIgaW50ZXJhY3Rpb24gd2l0aCB0aGUgd29ya2JlbmNoXG5cdFx0Ly8gd2hlbiBzaHV0ZG93biBoYXMgaGFwcGVuZWQgdG8gbm90IHNob3cgdGhlIGRpYWxvZyBlLmcuXG5cdFx0Ly8gd2hlbiBuYXZpZ2F0aW9uIHRha2VzIGEgbG9uZ2VyIHRpbWUuXG5cdFx0RXZlbnQudG9Qcm9taXNlKEV2ZW50LmFueShcblx0XHRcdEV2ZW50Lm9uY2UobmV3IERvbUVtaXR0ZXIobWFpbldpbmRvdy5kb2N1bWVudC5ib2R5LCBFdmVudFR5cGUuS0VZX0RPV04sIHRydWUpLmV2ZW50KSxcblx0XHRcdEV2ZW50Lm9uY2UobmV3IERvbUVtaXR0ZXIobWFpbldpbmRvdy5kb2N1bWVudC5ib2R5LCBFdmVudFR5cGUuTU9VU0VfRE9XTiwgdHJ1ZSkuZXZlbnQpXG5cdFx0KSkudGhlbihhc3luYyAoKSA9PiB7XG5cblx0XHRcdC8vIERlbGF5IHRoZSBkaWFsb2cgaW4gY2FzZSB0aGUgdXNlciBpbnRlcmFjdGVkXG5cdFx0XHQvLyB3aXRoIHRoZSBwYWdlIGJlZm9yZSBpdCB0cmFuc2l0aW9uZWQgYXdheVxuXHRcdFx0YXdhaXQgdGltZW91dCgzMDAwKTtcblxuXHRcdFx0Ly8gVGhpcyBzaG91bGQgbm9ybWFsbHkgbm90IGhhcHBlbiwgYnV0IGlmIGZvciBzb21lIHJlYXNvblxuXHRcdFx0Ly8gdGhlIHdvcmtiZW5jaCB3YXMgc2h1dGRvd24gd2hpbGUgdGhlIHBhZ2UgaXMgc3RpbGwgdGhlcmUsXG5cdFx0XHQvLyBpbmZvcm0gdGhlIHVzZXIgdGhhdCBvbmx5IGEgcmVsb2FkIGNhbiBicmluZyBiYWNrIGEgd29ya2luZ1xuXHRcdFx0Ly8gc3RhdGUuXG5cdFx0XHRhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdzaHV0ZG93bkVycm9yJywgXCJBbiB1bmV4cGVjdGVkIGVycm9yIG9jY3VycmVkIHRoYXQgcmVxdWlyZXMgYSByZWxvYWQgb2YgdGhpcyBwYWdlLlwiKSxcblx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnc2h1dGRvd25FcnJvckRldGFpbCcsIFwiVGhlIHdvcmtiZW5jaCB3YXMgdW5leHBlY3RlZGx5IGRpc3Bvc2VkIHdoaWxlIHJ1bm5pbmcuXCIpLFxuXHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAncmVsb2FkJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUmVsb2FkXCIpLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiBtYWluV2luZG93LmxvY2F0aW9uLnJlbG9hZCgpIC8vIGRvIG5vdCB1c2UgYW55IHNlcnZpY2VzIGF0IHRoaXMgcG9pbnQgc2luY2UgdGhleSBhcmUgbGlrZWx5IG5vdCBmdW5jdGlvbmFsIGF0IHRoaXMgcG9pbnRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGUoKTogdm9pZCB7XG5cblx0XHQvLyBIYW5kbGUgb3BlbiBjYWxsc1xuXHRcdHRoaXMuc2V0dXBPcGVuSGFuZGxlcnMoKTtcblxuXHRcdC8vIExhYmVsIGZvcm1hdHRpbmdcblx0XHR0aGlzLnJlZ2lzdGVyTGFiZWxGb3JtYXR0ZXJzKCk7XG5cblx0XHQvLyBDb21tYW5kc1xuXHRcdHRoaXMucmVnaXN0ZXJDb21tYW5kcygpO1xuXG5cdFx0Ly8gU21va2UgVGVzdCBEcml2ZXJcblx0XHR0aGlzLnNldHVwRHJpdmVyKCk7XG5cdH1cblxuXHRwcml2YXRlIHNldHVwRHJpdmVyKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5lbmFibGVTbW9rZVRlc3REcml2ZXIpIHtcblx0XHRcdHJlZ2lzdGVyV2luZG93RHJpdmVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2V0dXBPcGVuSGFuZGxlcnMoKTogdm9pZCB7XG5cblx0XHQvLyBXZSBuZWVkIHRvIGlnbm9yZSB0aGUgYGJlZm9yZXVubG9hZGAgZXZlbnQgd2hpbGVcblx0XHQvLyB3ZSBoYW5kbGUgZXh0ZXJuYWwgbGlua3MgdG8gb3BlbiBzcGVjaWZpY2FsbHkgZm9yXG5cdFx0Ly8gdGhlIGNhc2Ugb2YgYXBwbGljYXRpb24gcHJvdG9jb2xzIHRoYXQgZS5nLiBpbnZva2Vcblx0XHQvLyB2c2NvZGUgaXRzZWxmLiBXZSBkbyBub3Qgd2FudCB0byBvcGVuIHRoZXNlIGxpbmtzXG5cdFx0Ly8gaW4gYSBuZXcgd2luZG93IGJlY2F1c2UgdGhhdCB3b3VsZCBsZWF2ZSBhIGJsYW5rXG5cdFx0Ly8gd2luZG93IHRvIHRoZSB1c2VyLCBidXQgdXNpbmcgYHdpbmRvdy5sb2NhdGlvbi5ocmVmYFxuXHRcdC8vIHdpbGwgdHJpZ2dlciB0aGUgYGJlZm9yZXVubG9hZGAuXG5cdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLnNldERlZmF1bHRFeHRlcm5hbE9wZW5lcih7XG5cdFx0XHRvcGVuRXh0ZXJuYWw6IGFzeW5jIChocmVmOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0bGV0IGlzQWxsb3dlZE9wZW5lciA9IGZhbHNlO1xuXHRcdFx0XHRpZiAodGhpcy5icm93c2VyRW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/Lm9wZW5lckFsbG93ZWRFeHRlcm5hbFVybFByZWZpeGVzKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB0cnVzdGVkUG9wdXBQcmVmaXggb2YgdGhpcy5icm93c2VyRW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnMub3BlbmVyQWxsb3dlZEV4dGVybmFsVXJsUHJlZml4ZXMpIHtcblx0XHRcdFx0XHRcdGlmIChocmVmLnN0YXJ0c1dpdGgodHJ1c3RlZFBvcHVwUHJlZml4KSkge1xuXHRcdFx0XHRcdFx0XHRpc0FsbG93ZWRPcGVuZXIgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBIVFRQKHMpOiBvcGVuIGluIG5ldyB3aW5kb3cgYW5kIGRlYWwgd2l0aCBwb3RlbnRpYWwgcG9wdXAgYmxvY2tlcnNcblx0XHRcdFx0aWYgKG1hdGNoZXNTY2hlbWUoaHJlZiwgU2NoZW1hcy5odHRwKSB8fCBtYXRjaGVzU2NoZW1lKGhyZWYsIFNjaGVtYXMuaHR0cHMpKSB7XG5cdFx0XHRcdFx0aWYgKGlzU2FmYXJpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBvcGVuZWQgPSB3aW5kb3dPcGVuV2l0aFN1Y2Nlc3MoaHJlZiwgIWlzQWxsb3dlZE9wZW5lcik7XG5cdFx0XHRcdFx0XHRpZiAoIW9wZW5lZCkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd1bmFibGVUb09wZW5FeHRlcm5hbCcsIFwiVGhlIGJyb3dzZXIgaW50ZXJydXB0ZWQgdGhlIG9wZW5pbmcgb2YgYSBuZXcgdGFiIG9yIHdpbmRvdy4gUHJlc3MgJ09wZW4nIHRvIG9wZW4gaXQgYW55d2F5LlwiKSxcblx0XHRcdFx0XHRcdFx0XHRkZXRhaWw6IGhyZWYsXG5cdFx0XHRcdFx0XHRcdFx0YnV0dG9uczogW1xuXHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoeyBrZXk6ICdvcGVuJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmT3BlblwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiBpc0FsbG93ZWRPcGVuZXIgPyB3aW5kb3dPcGVuUG9wdXAoaHJlZikgOiB3aW5kb3dPcGVuTm9PcGVuZXIoaHJlZilcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSh7IGtleTogJ2xlYXJuTW9yZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkxlYXJuIE1vcmVcIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oVVJJLnBhcnNlKCdodHRwczovL2FrYS5tcy9hbGxvdy12c2NvZGUtcG9wdXAnKSlcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0XHRcdGNhbmNlbEJ1dHRvbjogdHJ1ZVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aXNBbGxvd2VkT3BlbmVyXG5cdFx0XHRcdFx0XHRcdD8gd2luZG93T3BlblBvcHVwKGhyZWYpXG5cdFx0XHRcdFx0XHRcdDogd2luZG93T3Blbk5vT3BlbmVyKGhyZWYpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEFueXRoaW5nIGVsc2U6IHNldCBsb2NhdGlvbiB0byB0cmlnZ2VyIHByb3RvY29sIGhhbmRsZXIgaW4gdGhlIGJyb3dzZXJcblx0XHRcdFx0Ly8gYnV0IG1ha2Ugc3VyZSB0byBzaWduYWwgdGhpcyBhcyBhbiBleHBlY3RlZCB1bmxvYWQgYW5kIGRpc2FibGUgdW5sb2FkXG5cdFx0XHRcdC8vIGhhbmRsaW5nIGV4cGxpY2l0bHkgdG8gcHJldmVudCB0aGUgd29ya2JlbmNoIGZyb20gZ29pbmcgZG93bi5cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgaW52b2tlUHJvdG9jb2xIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5saWZlY3ljbGVTZXJ2aWNlLndpdGhFeHBlY3RlZFNodXRkb3duKHsgZGlzYWJsZVNodXRkb3duSGFuZGxpbmc6IHRydWUgfSwgKCkgPT4gbWFpbldpbmRvdy5sb2NhdGlvbi5ocmVmID0gaHJlZik7XG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdGludm9rZVByb3RvY29sSGFuZGxlcigpO1xuXG5cdFx0XHRcdFx0Y29uc3Qgc2hvd1Byb3RvY29sVXJsT3BlbmVkRGlhbG9nID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgeyBkb3dubG9hZFVybCB9ID0gdGhpcy5wcm9kdWN0U2VydmljZTtcblx0XHRcdFx0XHRcdGxldCBkZXRhaWw6IHN0cmluZztcblxuXHRcdFx0XHRcdFx0Y29uc3QgYnV0dG9uczogSVByb21wdEJ1dHRvbjx2b2lkPltdID0gW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnb3BlbkV4dGVybmFsRGlhbG9nQnV0dG9uUmV0cnkudjInLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZUcnkgQWdhaW5cIiksXG5cdFx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiBpbnZva2VQcm90b2NvbEhhbmRsZXIoKVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdO1xuXG5cdFx0XHRcdFx0XHRpZiAoZG93bmxvYWRVcmwgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRkZXRhaWwgPSBsb2NhbGl6ZShcblx0XHRcdFx0XHRcdFx0XHQnb3BlbkV4dGVybmFsRGlhbG9nRGV0YWlsLnYyJyxcblx0XHRcdFx0XHRcdFx0XHRcIldlIGxhdW5jaGVkIHswfSBvbiB5b3VyIGNvbXB1dGVyLlxcblxcbklmIHsxfSBkaWQgbm90IGxhdW5jaCwgdHJ5IGFnYWluIG9yIGluc3RhbGwgaXQgYmVsb3cuXCIsXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyxcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nXG5cdFx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdFx0YnV0dG9ucy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoeyBrZXk6ICdvcGVuRXh0ZXJuYWxEaWFsb2dCdXR0b25JbnN0YWxsLnYzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmSW5zdGFsbFwiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKFVSSS5wYXJzZShkb3dubG9hZFVybCkpO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBSZS1zaG93IHRoZSBkaWFsb2cgc28gdGhhdCB0aGUgdXNlciBjYW4gY29tZSBiYWNrIGFmdGVyIGluc3RhbGxpbmcgYW5kIHRyeSBhZ2FpblxuXHRcdFx0XHRcdFx0XHRcdFx0c2hvd1Byb3RvY29sVXJsT3BlbmVkRGlhbG9nKCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGRldGFpbCA9IGxvY2FsaXplKFxuXHRcdFx0XHRcdFx0XHRcdCdvcGVuRXh0ZXJuYWxEaWFsb2dEZXRhaWxOb0luc3RhbGwnLFxuXHRcdFx0XHRcdFx0XHRcdFwiV2UgbGF1bmNoZWQgezB9IG9uIHlvdXIgY29tcHV0ZXIuXFxuXFxuSWYgezF9IGRpZCBub3QgbGF1bmNoLCB0cnkgYWdhaW4gYmVsb3cuXCIsXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyxcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nXG5cdFx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIFdoaWxlIHRoaXMgZGlhbG9nIHNob3dzLCBjbG9zaW5nIHRoZSB0YWIgd2lsbCBub3QgZGlzcGxheSBhIGNvbmZpcm1hdGlvbiBkaWFsb2dcblx0XHRcdFx0XHRcdC8vIHRvIGF2b2lkIHNob3dpbmcgdGhlIHVzZXIgdHdvIGRpYWxvZ3MgYXQgb25jZVxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5ob3N0U2VydmljZS53aXRoRXhwZWN0ZWRTaHV0ZG93bigoKSA9PiB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdFx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ29wZW5FeHRlcm5hbERpYWxvZ1RpdGxlJywgXCJBbGwgZG9uZS4gWW91IGNhbiBjbG9zZSB0aGlzIHRhYiBub3cuXCIpLFxuXHRcdFx0XHRcdFx0XHRkZXRhaWwsXG5cdFx0XHRcdFx0XHRcdGJ1dHRvbnMsXG5cdFx0XHRcdFx0XHRcdGNhbmNlbEJ1dHRvbjogdHJ1ZVxuXHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHQvLyBXZSBjYW5ub3Qga25vdyB3aGV0aGVyIHRoZSBwcm90b2NvbCBoYW5kbGVyIHN1Y2NlZWRlZC5cblx0XHRcdFx0XHQvLyBEaXNwbGF5IGd1aWRhbmNlIGluIGNhc2UgaXQgZGlkIG5vdCwgZS5nLiB0aGUgYXBwIGlzIG5vdCBpbnN0YWxsZWQgbG9jYWxseS5cblx0XHRcdFx0XHRpZiAobWF0Y2hlc1NjaGVtZShocmVmLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLnVybFByb3RvY29sKSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgc2hvd1Byb3RvY29sVXJsT3BlbmVkRGlhbG9nKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGFiZWxGb3JtYXR0ZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFiZWxTZXJ2aWNlLnJlZ2lzdGVyRm9ybWF0dGVyKHtcblx0XHRcdHNjaGVtZTogU2NoZW1hcy52c2NvZGVVc2VyRGF0YSxcblx0XHRcdHByaW9yaXR5OiB0cnVlLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJyhTZXR0aW5ncykgJHtwYXRofScsXG5cdFx0XHRcdHNlcGFyYXRvcjogJy8nLFxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJDb21tYW5kcygpOiB2b2lkIHtcblxuXHRcdC8vIEFsbG93IGV4dGVuc2lvbnMgdG8gcmVxdWVzdCBVU0IgZGV2aWNlcyBpbiBXZWJcblx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnd29ya2JlbmNoLmV4cGVyaW1lbnRhbC5yZXF1ZXN0VXNiRGV2aWNlJywgYXN5bmMgKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgb3B0aW9ucz86IHsgZmlsdGVycz86IHVua25vd25bXSB9KTogUHJvbWlzZTxVc2JEZXZpY2VEYXRhIHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRyZXR1cm4gcmVxdWVzdFVzYkRldmljZShvcHRpb25zKTtcblx0XHR9KTtcblxuXHRcdC8vIEFsbG93IGV4dGVuc2lvbnMgdG8gcmVxdWVzdCBTZXJpYWwgZGV2aWNlcyBpbiBXZWJcblx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnd29ya2JlbmNoLmV4cGVyaW1lbnRhbC5yZXF1ZXN0U2VyaWFsUG9ydCcsIGFzeW5jIChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG9wdGlvbnM/OiB7IGZpbHRlcnM/OiB1bmtub3duW10gfSk6IFByb21pc2U8U2VyaWFsUG9ydERhdGEgfCB1bmRlZmluZWQ+ID0+IHtcblx0XHRcdHJldHVybiByZXF1ZXN0U2VyaWFsUG9ydChvcHRpb25zKTtcblx0XHR9KTtcblxuXHRcdC8vIEFsbG93IGV4dGVuc2lvbnMgdG8gcmVxdWVzdCBISUQgZGV2aWNlcyBpbiBXZWJcblx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnd29ya2JlbmNoLmV4cGVyaW1lbnRhbC5yZXF1ZXN0SGlkRGV2aWNlJywgYXN5bmMgKF9hY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgb3B0aW9ucz86IHsgZmlsdGVycz86IHVua25vd25bXSB9KTogUHJvbWlzZTxIaWREZXZpY2VEYXRhIHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRyZXR1cm4gcmVxdWVzdEhpZERldmljZShvcHRpb25zKTtcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7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LGVBQWU7QUFBQSxnQkFDcEIsS0FBSyxlQUFlO0FBQUEsY0FDckI7QUFFQSxzQkFBUSxLQUFLO0FBQUEsZ0JBQ1osT0FBTyxTQUFTLEVBQUUsS0FBSyxzQ0FBc0MsU0FBUyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsV0FBVztBQUFBLGdCQUM5RyxLQUFLLFlBQVk7QUFDaEIsd0JBQU0sS0FBSyxjQUFjLEtBQUssSUFBSSxNQUFNLFdBQVcsQ0FBQztBQUdwRCw4Q0FBNEI7QUFBQSxnQkFDN0I7QUFBQSxjQUNELENBQUM7QUFBQSxZQUNGLE9BQU87QUFDTix1QkFBUztBQUFBLGdCQUNSO0FBQUEsZ0JBQ0E7QUFBQSxnQkFDQSxLQUFLLGVBQWU7QUFBQSxnQkFDcEIsS0FBSyxlQUFlO0FBQUEsY0FDckI7QUFBQSxZQUNEO0FBSUEsa0JBQU0sS0FBSyxZQUFZLHFCQUFxQixNQUFNLEtBQUssY0FBYyxPQUFPO0FBQUEsY0FDM0UsTUFBTSxTQUFTO0FBQUEsY0FDZixTQUFTLFNBQVMsMkJBQTJCLHVDQUF1QztBQUFBLGNBQ3BGO0FBQUEsY0FDQTtBQUFBLGNBQ0EsY0FBYztBQUFBLFlBQ2YsQ0FBQyxDQUFDO0FBQUEsVUFDSDtBQUlBLGNBQUksY0FBYyxNQUFNLEtBQUssZUFBZSxXQUFXLEdBQUc7QUFDekQsa0JBQU0sNEJBQTRCO0FBQUEsVUFDbkM7QUFBQSxRQUNEO0FBRUEsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSwwQkFBZ0M7QUFDdkMsU0FBSyxVQUFVLEtBQUssYUFBYSxrQkFBa0I7QUFBQSxNQUNsRCxRQUFRLFFBQVE7QUFBQSxNQUNoQixVQUFVO0FBQUEsTUFDVixZQUFZO0FBQUEsUUFDWCxPQUFPO0FBQUEsUUFDUCxXQUFXO0FBQUEsTUFDWjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRVEsbUJBQXlCO0FBR2hDLHFCQUFpQixnQkFBZ0IsMkNBQTJDLE9BQU8sV0FBNkIsWUFBMEU7QUFDekwsYUFBTyxpQkFBaUIsT0FBTztBQUFBLElBQ2hDLENBQUM7QUFHRCxxQkFBaUIsZ0JBQWdCLDRDQUE0QyxPQUFPLFdBQTZCLFlBQTJFO0FBQzNMLGFBQU8sa0JBQWtCLE9BQU87QUFBQSxJQUNqQyxDQUFDO0FBR0QscUJBQWlCLGdCQUFnQiwyQ0FBMkMsT0FBTyxXQUE2QixZQUEwRTtBQUN6TCxhQUFPLGlCQUFpQixPQUFPO0FBQUEsSUFDaEMsQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQXRQYSxnQkFBTjtBQUFBLEVBR0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBWFU7IiwKICAibmFtZXMiOiBbInRpbWVvdXQiLCAiYXJncyJdCn0K
