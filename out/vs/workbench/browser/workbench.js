import "./style.js";
import { runWhenWindowIdle } from "../../base/browser/dom.js";
import { Event, Emitter, setGlobalLeakWarningThreshold } from "../../base/common/event.js";
import { RunOnceScheduler, timeout } from "../../base/common/async.js";
import { isFirefox, isSafari, isChrome } from "../../base/browser/browser.js";
import { mark } from "../../base/common/performance.js";
import { onUnexpectedError, setUnexpectedErrorHandler } from "../../base/common/errors.js";
import { Registry } from "../../platform/registry/common/platform.js";
import { isWindows, isLinux, isWeb, isNative, isMacintosh } from "../../base/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../common/contributions.js";
import { EditorExtensions } from "../common/editor.js";
import { getSingletonServiceDescriptors } from "../../platform/instantiation/common/extensions.js";
import { Position, Parts, IWorkbenchLayoutService, positionToString } from "../services/layout/browser/layoutService.js";
import { IStorageService, WillSaveStateReason, StorageScope, StorageTarget } from "../../platform/storage/common/storage.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { LifecyclePhase, ILifecycleService } from "../services/lifecycle/common/lifecycle.js";
import { INotificationService } from "../../platform/notification/common/notification.js";
import { NotificationsCenter } from "./parts/notifications/notificationsCenter.js";
import { NotificationsAlerts } from "./parts/notifications/notificationsAlerts.js";
import { NotificationsStatus } from "./parts/notifications/notificationsStatus.js";
import { registerNotificationCommands } from "./parts/notifications/notificationsCommands.js";
import { NotificationsToasts } from "./parts/notifications/notificationsToasts.js";
import { setARIAContainer } from "../../base/browser/ui/aria/aria.js";
import { FontMeasurements } from "../../editor/browser/config/fontMeasurements.js";
import { BareFontInfo } from "../../editor/common/config/fontInfo.js";
import { toErrorMessage } from "../../base/common/errorMessage.js";
import { WorkbenchContextKeysHandler } from "./contextkeys.js";
import { coalesce } from "../../base/common/arrays.js";
import { InstantiationService } from "../../platform/instantiation/common/instantiationService.js";
import { Layout } from "./layout.js";
import { IHostService } from "../services/host/browser/host.js";
import { IDialogService } from "../../platform/dialogs/common/dialogs.js";
import { mainWindow } from "../../base/browser/window.js";
import { PixelRatio } from "../../base/browser/pixelRatio.js";
import { IHoverService, WorkbenchHoverDelegate } from "../../platform/hover/browser/hover.js";
import { setHoverDelegateFactory } from "../../base/browser/ui/hover/hoverDelegateFactory.js";
import { setBaseLayerHoverDelegate } from "../../base/browser/ui/hover/hoverDelegate2.js";
import { AccessibilityProgressSignalScheduler } from "../../platform/accessibilitySignal/browser/progressAccessibilitySignalScheduler.js";
import { setProgressAcccessibilitySignalScheduler } from "../../base/browser/ui/progressbar/progressAccessibilitySignal.js";
import { AccessibleViewRegistry } from "../../platform/accessibility/browser/accessibleViewRegistry.js";
import { NotificationAccessibleView } from "./parts/notifications/notificationAccessibleView.js";
class Workbench extends Layout {
  constructor(parent, options, serviceCollection, logService) {
    super(parent);
    this.options = options;
    this.serviceCollection = serviceCollection;
    this._onWillShutdown = this._register(new Emitter());
    this.onWillShutdown = this._onWillShutdown.event;
    this._onDidShutdown = this._register(new Emitter());
    this.onDidShutdown = this._onDidShutdown.event;
    this.previousUnexpectedError = { message: void 0, time: 0 };
    mark("code/willStartWorkbench");
    this.registerErrorHandler(logService);
  }
  registerErrorHandler(logService) {
    mainWindow.addEventListener("unhandledrejection", (event) => {
      onUnexpectedError(event.reason);
      event.preventDefault();
    });
    setUnexpectedErrorHandler((error) => this.handleUnexpectedError(error, logService));
  }
  handleUnexpectedError(error, logService) {
    const message = toErrorMessage(error, true);
    if (!message) {
      return;
    }
    const now = Date.now();
    if (message === this.previousUnexpectedError.message && now - this.previousUnexpectedError.time <= 1e3) {
      return;
    }
    this.previousUnexpectedError.time = now;
    this.previousUnexpectedError.message = message;
    logService.error(message);
  }
  startup() {
    try {
      this._register(setGlobalLeakWarningThreshold(175));
      const instantiationService = this.initServices(this.serviceCollection);
      instantiationService.invokeFunction((accessor) => {
        const lifecycleService = accessor.get(ILifecycleService);
        const storageService = accessor.get(IStorageService);
        const configurationService = accessor.get(IConfigurationService);
        const hostService = accessor.get(IHostService);
        const hoverService = accessor.get(IHoverService);
        const dialogService = accessor.get(IDialogService);
        const notificationService = accessor.get(INotificationService);
        setHoverDelegateFactory((placement, enableInstantHover) => instantiationService.createInstance(WorkbenchHoverDelegate, placement, { instantHover: enableInstantHover }, {}));
        setBaseLayerHoverDelegate(hoverService);
        this.initLayout(accessor);
        Registry.as(WorkbenchExtensions.Workbench).start(accessor);
        Registry.as(EditorExtensions.EditorFactory).start(accessor);
        this._register(instantiationService.createInstance(WorkbenchContextKeysHandler));
        this.registerListeners(lifecycleService, storageService, configurationService, hostService, dialogService);
        this.renderWorkbench(instantiationService, notificationService, storageService, configurationService);
        this.createWorkbenchLayout();
        this.layout();
        this.restore(lifecycleService);
      });
      return instantiationService;
    } catch (error) {
      onUnexpectedError(error);
      throw error;
    }
  }
  initServices(serviceCollection) {
    serviceCollection.set(IWorkbenchLayoutService, this);
    const contributedServices = getSingletonServiceDescriptors();
    for (const [id, descriptor] of contributedServices) {
      serviceCollection.set(id, descriptor);
    }
    const instantiationService = new InstantiationService(serviceCollection, true);
    instantiationService.invokeFunction((accessor) => {
      const lifecycleService = accessor.get(ILifecycleService);
      const configurationService = accessor.get(IConfigurationService);
      if (typeof configurationService.acquireInstantiationService === "function") {
        configurationService.acquireInstantiationService(instantiationService);
      }
      lifecycleService.phase = LifecyclePhase.Ready;
    });
    return instantiationService;
  }
  registerListeners(lifecycleService, storageService, configurationService, hostService, dialogService) {
    this._register(configurationService.onDidChangeConfiguration((e) => this.updateFontAliasing(e, configurationService)));
    if (isNative) {
      this._register(storageService.onWillSaveState((e) => {
        if (e.reason === WillSaveStateReason.SHUTDOWN) {
          this.storeFontInfo(storageService);
        }
      }));
    } else {
      this._register(lifecycleService.onWillShutdown(() => this.storeFontInfo(storageService)));
    }
    this._register(lifecycleService.onWillShutdown((event) => this._onWillShutdown.fire(event)));
    this._register(lifecycleService.onDidShutdown(() => {
      this._onDidShutdown.fire();
      this.dispose();
    }));
    this._register(hostService.onDidChangeFocus((focus) => {
      if (!focus) {
        storageService.flush();
      }
    }));
    this._register(dialogService.onWillShowDialog(() => this.mainContainer.classList.add("modal-dialog-visible")));
    this._register(dialogService.onDidShowDialog(() => this.mainContainer.classList.remove("modal-dialog-visible")));
  }
  updateFontAliasing(e, configurationService) {
    if (!isMacintosh) {
      return;
    }
    if (e && !e.affectsConfiguration("workbench.fontAliasing")) {
      return;
    }
    const aliasing = configurationService.getValue("workbench.fontAliasing");
    if (this.fontAliasing === aliasing) {
      return;
    }
    this.fontAliasing = aliasing;
    const fontAliasingValues = ["antialiased", "none", "auto"];
    this.mainContainer.classList.remove(...fontAliasingValues.map((value) => `monaco-font-aliasing-${value}`));
    if (fontAliasingValues.some((option) => option === aliasing)) {
      this.mainContainer.classList.add(`monaco-font-aliasing-${aliasing}`);
    }
  }
  restoreFontInfo(storageService, configurationService) {
    const storedFontInfoRaw = storageService.get("editorFontInfo", StorageScope.APPLICATION);
    if (storedFontInfoRaw) {
      try {
        const storedFontInfo = JSON.parse(storedFontInfoRaw);
        if (Array.isArray(storedFontInfo)) {
          FontMeasurements.restoreFontInfo(mainWindow, storedFontInfo);
        }
      } catch (err) {
      }
    }
    FontMeasurements.readFontInfo(mainWindow, BareFontInfo.createFromRawSettings(configurationService.getValue("editor"), PixelRatio.getInstance(mainWindow).value));
  }
  storeFontInfo(storageService) {
    const serializedFontInfo = FontMeasurements.serializeFontInfo(mainWindow);
    if (serializedFontInfo) {
      storageService.store("editorFontInfo", JSON.stringify(serializedFontInfo), StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
  }
  renderWorkbench(instantiationService, notificationService, storageService, configurationService) {
    setARIAContainer(this.mainContainer);
    setProgressAcccessibilitySignalScheduler((msDelayTime, msLoopTime) => instantiationService.createInstance(AccessibilityProgressSignalScheduler, msDelayTime, msLoopTime));
    const platformClass = isWindows ? "windows" : isLinux ? "linux" : "mac";
    const workbenchClasses = coalesce([
      "monaco-workbench",
      platformClass,
      isWeb ? "web" : void 0,
      isChrome ? "chromium" : isFirefox ? "firefox" : isSafari ? "safari" : void 0,
      ...this.getLayoutClasses(),
      ...this.options?.extraClasses ? this.options.extraClasses : []
    ]);
    this.mainContainer.classList.add(...workbenchClasses);
    this.updateFontAliasing(void 0, configurationService);
    this.restoreFontInfo(storageService, configurationService);
    for (const { id, role, classes, options } of [
      { id: Parts.TITLEBAR_PART, role: "none", classes: ["titlebar"] },
      { id: Parts.BANNER_PART, role: "banner", classes: ["banner"] },
      { id: Parts.ACTIVITYBAR_PART, role: "none", classes: ["activitybar", this.getSideBarPosition() === Position.LEFT ? "left" : "right"] },
      // Use role 'none' for some parts to make screen readers less chatty #114892
      { id: Parts.SIDEBAR_PART, role: "none", classes: ["sidebar", this.getSideBarPosition() === Position.LEFT ? "left" : "right"] },
      { id: Parts.EDITOR_PART, role: "main", classes: ["editor"], options: { restorePreviousState: this.willRestoreEditors() } },
      { id: Parts.PANEL_PART, role: "none", classes: ["panel", "basepanel", positionToString(this.getPanelPosition())] },
      { id: Parts.AUXILIARYBAR_PART, role: "none", classes: ["auxiliarybar", "basepanel", this.getSideBarPosition() === Position.LEFT ? "right" : "left"] },
      { id: Parts.STATUSBAR_PART, role: "status", classes: ["statusbar"] }
    ]) {
      const partContainer = this.createPart(id, role, classes);
      mark(`code/willCreatePart/${id}`);
      this.getPart(id).create(partContainer, options);
      mark(`code/didCreatePart/${id}`);
    }
    this.createNotificationsHandlers(instantiationService, notificationService);
    this.parent.appendChild(this.mainContainer);
  }
  createPart(id, role, classes) {
    const part = document.createElement(role === "status" ? "footer" : "div");
    part.classList.add("part", ...classes);
    part.id = id;
    part.setAttribute("role", role);
    if (role === "status") {
      part.setAttribute("aria-live", "off");
    }
    return part;
  }
  createNotificationsHandlers(instantiationService, notificationService) {
    const notificationsCenter = this._register(instantiationService.createInstance(NotificationsCenter, this.mainContainer, notificationService.model));
    const notificationsToasts = this._register(instantiationService.createInstance(NotificationsToasts, this.mainContainer, notificationService.model));
    this._register(instantiationService.createInstance(NotificationsAlerts, notificationService.model));
    const notificationsStatus = instantiationService.createInstance(NotificationsStatus, notificationService.model);
    this._register(notificationsCenter.onDidChangeVisibility(() => {
      notificationsStatus.update(notificationsCenter.isVisible, notificationsToasts.isVisible);
      notificationsToasts.update(notificationsCenter.isVisible);
    }));
    this._register(notificationsToasts.onDidChangeVisibility(() => {
      notificationsStatus.update(notificationsCenter.isVisible, notificationsToasts.isVisible);
    }));
    registerNotificationCommands(notificationsCenter, notificationsToasts, notificationService.model);
    AccessibleViewRegistry.register(new NotificationAccessibleView());
    this.registerNotifications({
      onDidChangeNotificationsVisibility: Event.map(Event.any(notificationsToasts.onDidChangeVisibility, notificationsCenter.onDidChangeVisibility), () => notificationsToasts.isVisible || notificationsCenter.isVisible)
    });
  }
  restore(lifecycleService) {
    try {
      this.restoreParts();
    } catch (error) {
      onUnexpectedError(error);
    }
    this.whenReady.finally(
      () => Promise.race([
        this.whenRestored,
        timeout(2e3)
      ]).finally(() => {
        function markDidStartWorkbench() {
          mark("code/didStartWorkbench");
          performance.measure("perf: workbench create & restore", "code/didLoadWorkbenchMain", "code/didStartWorkbench");
        }
        if (this.isRestored()) {
          markDidStartWorkbench();
        } else {
          this.whenRestored.finally(() => markDidStartWorkbench());
        }
        lifecycleService.phase = LifecyclePhase.Restored;
        const eventuallyPhaseScheduler = this._register(new RunOnceScheduler(() => {
          this._register(runWhenWindowIdle(mainWindow, () => lifecycleService.phase = LifecyclePhase.Eventually, 2500));
        }, 2500));
        eventuallyPhaseScheduler.schedule();
      })
    );
  }
}
export {
  Workbench
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci93b3JrYmVuY2gudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vc3R5bGUuanMnO1xuaW1wb3J0IHsgcnVuV2hlbldpbmRvd0lkbGUgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyLCBzZXRHbG9iYWxMZWFrV2FybmluZ1RocmVzaG9sZCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBpc0ZpcmVmb3gsIGlzU2FmYXJpLCBpc0Nocm9tZSB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IG1hcmsgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciwgc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlciB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MsIGlzTGludXgsIGlzV2ViLCBpc05hdGl2ZSwgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIFdvcmtiZW5jaEV4dGVuc2lvbnMgfSBmcm9tICcuLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5LCBFZGl0b3JFeHRlbnNpb25zIH0gZnJvbSAnLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBnZXRTaW5nbGV0b25TZXJ2aWNlRGVzY3JpcHRvcnMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uLCBQYXJ0cywgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIHBvc2l0aW9uVG9TdHJpbmcgfSBmcm9tICcuLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgV2lsbFNhdmVTdGF0ZVJlYXNvbiwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSwgSUxpZmVjeWNsZVNlcnZpY2UsIFdpbGxTaHV0ZG93bkV2ZW50IH0gZnJvbSAnLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGlmaWNhdGlvbnNDZW50ZXIgfSBmcm9tICcuL3BhcnRzL25vdGlmaWNhdGlvbnMvbm90aWZpY2F0aW9uc0NlbnRlci5qcyc7XG5pbXBvcnQgeyBOb3RpZmljYXRpb25zQWxlcnRzIH0gZnJvbSAnLi9wYXJ0cy9ub3RpZmljYXRpb25zL25vdGlmaWNhdGlvbnNBbGVydHMuanMnO1xuaW1wb3J0IHsgTm90aWZpY2F0aW9uc1N0YXR1cyB9IGZyb20gJy4vcGFydHMvbm90aWZpY2F0aW9ucy9ub3RpZmljYXRpb25zU3RhdHVzLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyTm90aWZpY2F0aW9uQ29tbWFuZHMgfSBmcm9tICcuL3BhcnRzL25vdGlmaWNhdGlvbnMvbm90aWZpY2F0aW9uc0NvbW1hbmRzLmpzJztcbmltcG9ydCB7IE5vdGlmaWNhdGlvbnNUb2FzdHMgfSBmcm9tICcuL3BhcnRzL25vdGlmaWNhdGlvbnMvbm90aWZpY2F0aW9uc1RvYXN0cy5qcyc7XG5pbXBvcnQgeyBzZXRBUklBQ29udGFpbmVyIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBGb250TWVhc3VyZW1lbnRzIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2Jyb3dzZXIvY29uZmlnL2ZvbnRNZWFzdXJlbWVudHMuanMnO1xuaW1wb3J0IHsgQmFyZUZvbnRJbmZvIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZm9udEluZm8uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hDb250ZXh0S2V5c0hhbmRsZXIgfSBmcm9tICcuL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTGF5b3V0IH0gZnJvbSAnLi9sYXlvdXQuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IFBpeGVsUmF0aW8gfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvcGl4ZWxSYXRpby5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlLCBXb3JrYmVuY2hIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBzZXRIb3ZlckRlbGVnYXRlRmFjdG9yeSB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBzZXRCYXNlTGF5ZXJIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGUyLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlQcm9ncmVzc1NpZ25hbFNjaGVkdWxlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHlTaWduYWwvYnJvd3Nlci9wcm9ncmVzc0FjY2Vzc2liaWxpdHlTaWduYWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgc2V0UHJvZ3Jlc3NBY2NjZXNzaWJpbGl0eVNpZ25hbFNjaGVkdWxlciB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9wcm9ncmVzc2Jhci9wcm9ncmVzc0FjY2Vzc2liaWxpdHlTaWduYWwuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJsZVZpZXdSZWdpc3RyeSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IE5vdGlmaWNhdGlvbkFjY2Vzc2libGVWaWV3IH0gZnJvbSAnLi9wYXJ0cy9ub3RpZmljYXRpb25zL25vdGlmaWNhdGlvbkFjY2Vzc2libGVWaWV3LmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJV29ya2JlbmNoT3B0aW9ucyB7XG5cblx0LyoqXG5cdCAqIEV4dHJhIGNsYXNzZXMgdG8gYmUgYWRkZWQgdG8gdGhlIHdvcmtiZW5jaCBjb250YWluZXIuXG5cdCAqL1xuXHRleHRyYUNsYXNzZXM/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtiZW5jaCBleHRlbmRzIExheW91dCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsU2h1dGRvd24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxXaWxsU2h1dGRvd25FdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uV2lsbFNodXRkb3duID0gdGhpcy5fb25XaWxsU2h1dGRvd24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTaHV0ZG93biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFNodXRkb3duID0gdGhpcy5fb25EaWRTaHV0ZG93bi5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwYXJlbnQ6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogSVdvcmtiZW5jaE9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzZXJ2aWNlQ29sbGVjdGlvbjogU2VydmljZUNvbGxlY3Rpb24sXG5cdFx0bG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIocGFyZW50KTtcblxuXHRcdC8vIFBlcmY6IG1lYXN1cmUgd29ya2JlbmNoIHN0YXJ0dXAgdGltZVxuXHRcdG1hcmsoJ2NvZGUvd2lsbFN0YXJ0V29ya2JlbmNoJyk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXJyb3JIYW5kbGVyKGxvZ1NlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckVycm9ySGFuZGxlcihsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSk6IHZvaWQge1xuXG5cdFx0Ly8gTGlzdGVuIG9uIHVuaGFuZGxlZCByZWplY3Rpb24gZXZlbnRzXG5cdFx0Ly8gTm90ZTogaW50ZW50aW9uYWxseSBub3QgcmVnaXN0ZXJlZCBhcyBkaXNwb3NhYmxlIHRvIGhhbmRsZVxuXHRcdC8vICAgICAgIGVycm9ycyB0aGF0IGNhbiBvY2N1ciBkdXJpbmcgc2h1dGRvd24gcGhhc2UuXG5cdFx0bWFpbldpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd1bmhhbmRsZWRyZWplY3Rpb24nLCAoZXZlbnQpID0+IHtcblxuXHRcdFx0Ly8gU2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9Qcm9taXNlUmVqZWN0aW9uRXZlbnRcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGV2ZW50LnJlYXNvbik7XG5cblx0XHRcdC8vIFByZXZlbnQgdGhlIHByaW50aW5nIG9mIHRoaXMgZXZlbnQgdG8gdGhlIGNvbnNvbGVcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0fSk7XG5cblx0XHQvLyBJbnN0YWxsIGhhbmRsZXIgZm9yIHVuZXhwZWN0ZWQgZXJyb3JzXG5cdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihlcnJvciA9PiB0aGlzLmhhbmRsZVVuZXhwZWN0ZWRFcnJvcihlcnJvciwgbG9nU2VydmljZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBwcmV2aW91c1VuZXhwZWN0ZWRFcnJvcjogeyBtZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQ7IHRpbWU6IG51bWJlciB9ID0geyBtZXNzYWdlOiB1bmRlZmluZWQsIHRpbWU6IDAgfTtcblx0cHJpdmF0ZSBoYW5kbGVVbmV4cGVjdGVkRXJyb3IoZXJyb3I6IHVua25vd24sIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlKTogdm9pZCB7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IHRvRXJyb3JNZXNzYWdlKGVycm9yLCB0cnVlKTtcblx0XHRpZiAoIW1lc3NhZ2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdGlmIChtZXNzYWdlID09PSB0aGlzLnByZXZpb3VzVW5leHBlY3RlZEVycm9yLm1lc3NhZ2UgJiYgbm93IC0gdGhpcy5wcmV2aW91c1VuZXhwZWN0ZWRFcnJvci50aW1lIDw9IDEwMDApIHtcblx0XHRcdHJldHVybjsgLy8gUmV0dXJuIGlmIGVycm9yIG1lc3NhZ2UgaWRlbnRpY2FsIHRvIHByZXZpb3VzIGFuZCBzaG9ydGVyIHRoYW4gMSBzZWNvbmRcblx0XHR9XG5cblx0XHR0aGlzLnByZXZpb3VzVW5leHBlY3RlZEVycm9yLnRpbWUgPSBub3c7XG5cdFx0dGhpcy5wcmV2aW91c1VuZXhwZWN0ZWRFcnJvci5tZXNzYWdlID0gbWVzc2FnZTtcblxuXHRcdC8vIExvZyBpdFxuXHRcdGxvZ1NlcnZpY2UuZXJyb3IobWVzc2FnZSk7XG5cdH1cblxuXHRzdGFydHVwKCk6IElJbnN0YW50aWF0aW9uU2VydmljZSB7XG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gQ29uZmlndXJlIGVtaXR0ZXIgbGVhayB3YXJuaW5nIHRocmVzaG9sZFxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoc2V0R2xvYmFsTGVha1dhcm5pbmdUaHJlc2hvbGQoMTc1KSk7XG5cblx0XHRcdC8vIFNlcnZpY2VzXG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuaW5pdFNlcnZpY2VzKHRoaXMuc2VydmljZUNvbGxlY3Rpb24pO1xuXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdGNvbnN0IGxpZmVjeWNsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpZmVjeWNsZVNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBob3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJSG9zdFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBob3ZlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvdmVyU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKSBhcyBOb3RpZmljYXRpb25TZXJ2aWNlO1xuXG5cdFx0XHRcdC8vIERlZmF1bHQgSG92ZXIgRGVsZWdhdGUgbXVzdCBiZSByZWdpc3RlcmVkIGJlZm9yZSBjcmVhdGluZyBhbnkgd29ya2JlbmNoL2xheW91dCBjb21wb25lbnRzXG5cdFx0XHRcdC8vIGFzIHRoZXNlIHBvc3NpYmx5IHdpbGwgdXNlIHRoZSBkZWZhdWx0IGhvdmVyIGRlbGVnYXRlXG5cdFx0XHRcdHNldEhvdmVyRGVsZWdhdGVGYWN0b3J5KChwbGFjZW1lbnQsIGVuYWJsZUluc3RhbnRIb3ZlcikgPT4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoSG92ZXJEZWxlZ2F0ZSwgcGxhY2VtZW50LCB7IGluc3RhbnRIb3ZlcjogZW5hYmxlSW5zdGFudEhvdmVyIH0sIHt9KSk7XG5cdFx0XHRcdHNldEJhc2VMYXllckhvdmVyRGVsZWdhdGUoaG92ZXJTZXJ2aWNlKTtcblxuXHRcdFx0XHQvLyBMYXlvdXRcblx0XHRcdFx0dGhpcy5pbml0TGF5b3V0KGFjY2Vzc29yKTtcblxuXHRcdFx0XHQvLyBSZWdpc3RyaWVzXG5cdFx0XHRcdFJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5zdGFydChhY2Nlc3Nvcik7XG5cdFx0XHRcdFJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkuc3RhcnQoYWNjZXNzb3IpO1xuXG5cdFx0XHRcdC8vIENvbnRleHQgS2V5c1xuXHRcdFx0XHR0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hDb250ZXh0S2V5c0hhbmRsZXIpKTtcblxuXHRcdFx0XHQvLyBSZWdpc3RlciBMaXN0ZW5lcnNcblx0XHRcdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycyhsaWZlY3ljbGVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGhvc3RTZXJ2aWNlLCBkaWFsb2dTZXJ2aWNlKTtcblxuXHRcdFx0XHQvLyBSZW5kZXIgV29ya2JlbmNoXG5cdFx0XHRcdHRoaXMucmVuZGVyV29ya2JlbmNoKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0XHRcdC8vIFdvcmtiZW5jaCBMYXlvdXRcblx0XHRcdFx0dGhpcy5jcmVhdGVXb3JrYmVuY2hMYXlvdXQoKTtcblxuXHRcdFx0XHQvLyBMYXlvdXRcblx0XHRcdFx0dGhpcy5sYXlvdXQoKTtcblxuXHRcdFx0XHQvLyBSZXN0b3JlXG5cdFx0XHRcdHRoaXMucmVzdG9yZShsaWZlY3ljbGVTZXJ2aWNlKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycm9yKTtcblxuXHRcdFx0dGhyb3cgZXJyb3I7IC8vIHJldGhyb3cgYmVjYXVzZSB0aGlzIGlzIGEgY3JpdGljYWwgaXNzdWUgd2UgY2Fubm90IGhhbmRsZSBwcm9wZXJseSBoZXJlXG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpbml0U2VydmljZXMoc2VydmljZUNvbGxlY3Rpb246IFNlcnZpY2VDb2xsZWN0aW9uKTogSUluc3RhbnRpYXRpb25TZXJ2aWNlIHtcblxuXHRcdC8vIExheW91dCBTZXJ2aWNlXG5cdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCB0aGlzKTtcblxuXHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblx0XHQvL1xuXHRcdC8vIE5PVEU6IFBsZWFzZSBkbyBOT1QgcmVnaXN0ZXIgc2VydmljZXMgaGVyZS4gVXNlIGByZWdpc3RlclNpbmdsZXRvbigpYFxuXHRcdC8vICAgICAgIGZyb20gYHdvcmtiZW5jaC5jb21tb24ubWFpbi50c2AgaWYgdGhlIHNlcnZpY2UgaXMgc2hhcmVkIGJldHdlZW5cblx0XHQvLyAgICAgICBkZXNrdG9wIGFuZCB3ZWIgb3IgYHdvcmtiZW5jaC5kZXNrdG9wLm1haW4udHNgIGlmIHRoZSBzZXJ2aWNlXG5cdFx0Ly8gICAgICAgaXMgZGVza3RvcCBvbmx5LlxuXHRcdC8vXG5cdFx0Ly8gISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIVxuXG5cdFx0Ly8gQWxsIENvbnRyaWJ1dGVkIFNlcnZpY2VzXG5cdFx0Y29uc3QgY29udHJpYnV0ZWRTZXJ2aWNlcyA9IGdldFNpbmdsZXRvblNlcnZpY2VEZXNjcmlwdG9ycygpO1xuXHRcdGZvciAoY29uc3QgW2lkLCBkZXNjcmlwdG9yXSBvZiBjb250cmlidXRlZFNlcnZpY2VzKSB7XG5cdFx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoaWQsIGRlc2NyaXB0b3IpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKHNlcnZpY2VDb2xsZWN0aW9uLCB0cnVlKTtcblxuXHRcdC8vIFdyYXAgdXBcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHRjb25zdCBsaWZlY3ljbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMaWZlY3ljbGVTZXJ2aWNlKTtcblxuXHRcdFx0Ly8gVE9ET0BTYW5kZWVwIGRlYnQgYXJvdW5kIGN5Y2xpYyBkZXBlbmRlbmNpZXNcblx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSkgYXMgYW55O1xuXHRcdFx0aWYgKHR5cGVvZiBjb25maWd1cmF0aW9uU2VydmljZS5hY3F1aXJlSW5zdGFudGlhdGlvblNlcnZpY2UgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UuYWNxdWlyZUluc3RhbnRpYXRpb25TZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2lnbmFsIHRvIGxpZmVjeWNsZSB0aGF0IHNlcnZpY2VzIGFyZSBzZXRcblx0XHRcdGxpZmVjeWNsZVNlcnZpY2UucGhhc2UgPSBMaWZlY3ljbGVQaGFzZS5SZWFkeTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMobGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsIGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsIGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlKTogdm9pZCB7XG5cblx0XHQvLyBDb25maWd1cmF0aW9uIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB0aGlzLnVwZGF0ZUZvbnRBbGlhc2luZyhlLCBjb25maWd1cmF0aW9uU2VydmljZSkpKTtcblxuXHRcdC8vIEZvbnQgSW5mb1xuXHRcdGlmIChpc05hdGl2ZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoc3RvcmFnZVNlcnZpY2Uub25XaWxsU2F2ZVN0YXRlKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5yZWFzb24gPT09IFdpbGxTYXZlU3RhdGVSZWFzb24uU0hVVERPV04pIHtcblx0XHRcdFx0XHR0aGlzLnN0b3JlRm9udEluZm8oc3RvcmFnZVNlcnZpY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGxpZmVjeWNsZVNlcnZpY2Uub25XaWxsU2h1dGRvd24oKCkgPT4gdGhpcy5zdG9yZUZvbnRJbmZvKHN0b3JhZ2VTZXJ2aWNlKSkpO1xuXHRcdH1cblxuXHRcdC8vIExpZmVjeWNsZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKGxpZmVjeWNsZVNlcnZpY2Uub25XaWxsU2h1dGRvd24oZXZlbnQgPT4gdGhpcy5fb25XaWxsU2h1dGRvd24uZmlyZShldmVudCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsaWZlY3ljbGVTZXJ2aWNlLm9uRGlkU2h1dGRvd24oKCkgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRTaHV0ZG93bi5maXJlKCk7XG5cdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHR9KSk7XG5cblx0XHQvLyBJbiBzb21lIGVudmlyb25tZW50cyB3ZSBkbyBub3QgZ2V0IGVub3VnaCB0aW1lIHRvIHBlcnNpc3Qgc3RhdGUgb24gc2h1dGRvd24uXG5cdFx0Ly8gSW4gb3RoZXIgY2FzZXMsIFZTQ29kZSBtaWdodCBjcmFzaCwgc28gd2UgcGVyaW9kaWNhbGx5IHNhdmUgc3RhdGUgdG8gcmVkdWNlXG5cdFx0Ly8gdGhlIGNoYW5jZSBvZiBsb29zaW5nIGFueSBzdGF0ZS5cblx0XHQvLyBUaGUgd2luZG93IGxvb3NpbmcgZm9jdXMgaXMgYSBnb29kIGluZGljYXRpb24gdGhhdCB0aGUgdXNlciBoYXMgc3RvcHBlZCB3b3JraW5nXG5cdFx0Ly8gaW4gdGhhdCB3aW5kb3cgc28gd2UgcGljayB0aGF0IGF0IGEgdGltZSB0byBjb2xsZWN0IHN0YXRlLlxuXHRcdHRoaXMuX3JlZ2lzdGVyKGhvc3RTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9jdXMoZm9jdXMgPT4ge1xuXHRcdFx0aWYgKCFmb2N1cykge1xuXHRcdFx0XHRzdG9yYWdlU2VydmljZS5mbHVzaCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIERpYWxvZ3Mgc2hvd2luZy9oaWRpbmdcblx0XHR0aGlzLl9yZWdpc3RlcihkaWFsb2dTZXJ2aWNlLm9uV2lsbFNob3dEaWFsb2coKCkgPT4gdGhpcy5tYWluQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21vZGFsLWRpYWxvZy12aXNpYmxlJykpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihkaWFsb2dTZXJ2aWNlLm9uRGlkU2hvd0RpYWxvZygoKSA9PiB0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnbW9kYWwtZGlhbG9nLXZpc2libGUnKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBmb250QWxpYXNpbmc6ICdkZWZhdWx0JyB8ICdhbnRpYWxpYXNlZCcgfCAnbm9uZScgfCAnYXV0bycgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgdXBkYXRlRm9udEFsaWFzaW5nKGU6IElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQgfCB1bmRlZmluZWQsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpIHtcblx0XHRpZiAoIWlzTWFjaW50b3NoKSB7XG5cdFx0XHRyZXR1cm47IC8vIG1hY09TIG9ubHlcblx0XHR9XG5cblx0XHRpZiAoZSAmJiAhZS5hZmZlY3RzQ29uZmlndXJhdGlvbignd29ya2JlbmNoLmZvbnRBbGlhc2luZycpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxpYXNpbmcgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnZGVmYXVsdCcgfCAnYW50aWFsaWFzZWQnIHwgJ25vbmUnIHwgJ2F1dG8nPignd29ya2JlbmNoLmZvbnRBbGlhc2luZycpO1xuXHRcdGlmICh0aGlzLmZvbnRBbGlhc2luZyA9PT0gYWxpYXNpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmZvbnRBbGlhc2luZyA9IGFsaWFzaW5nO1xuXG5cdFx0Ly8gUmVtb3ZlIGFsbFxuXHRcdGNvbnN0IGZvbnRBbGlhc2luZ1ZhbHVlczogKHR5cGVvZiBhbGlhc2luZylbXSA9IFsnYW50aWFsaWFzZWQnLCAnbm9uZScsICdhdXRvJ107XG5cdFx0dGhpcy5tYWluQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoLi4uZm9udEFsaWFzaW5nVmFsdWVzLm1hcCh2YWx1ZSA9PiBgbW9uYWNvLWZvbnQtYWxpYXNpbmctJHt2YWx1ZX1gKSk7XG5cblx0XHQvLyBBZGQgc3BlY2lmaWNcblx0XHRpZiAoZm9udEFsaWFzaW5nVmFsdWVzLnNvbWUob3B0aW9uID0+IG9wdGlvbiA9PT0gYWxpYXNpbmcpKSB7XG5cdFx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LmFkZChgbW9uYWNvLWZvbnQtYWxpYXNpbmctJHthbGlhc2luZ31gKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlc3RvcmVGb250SW5mbyhzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RvcmVkRm9udEluZm9SYXcgPSBzdG9yYWdlU2VydmljZS5nZXQoJ2VkaXRvckZvbnRJbmZvJywgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRpZiAoc3RvcmVkRm9udEluZm9SYXcpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHN0b3JlZEZvbnRJbmZvID0gSlNPTi5wYXJzZShzdG9yZWRGb250SW5mb1Jhdyk7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHN0b3JlZEZvbnRJbmZvKSkge1xuXHRcdFx0XHRcdEZvbnRNZWFzdXJlbWVudHMucmVzdG9yZUZvbnRJbmZvKG1haW5XaW5kb3csIHN0b3JlZEZvbnRJbmZvKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdC8qIGlnbm9yZSAqL1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdEZvbnRNZWFzdXJlbWVudHMucmVhZEZvbnRJbmZvKG1haW5XaW5kb3csIEJhcmVGb250SW5mby5jcmVhdGVGcm9tUmF3U2V0dGluZ3MoY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2VkaXRvcicpLCBQaXhlbFJhdGlvLmdldEluc3RhbmNlKG1haW5XaW5kb3cpLnZhbHVlKSk7XG5cdH1cblxuXHRwcml2YXRlIHN0b3JlRm9udEluZm8oc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSk6IHZvaWQge1xuXHRcdGNvbnN0IHNlcmlhbGl6ZWRGb250SW5mbyA9IEZvbnRNZWFzdXJlbWVudHMuc2VyaWFsaXplRm9udEluZm8obWFpbldpbmRvdyk7XG5cdFx0aWYgKHNlcmlhbGl6ZWRGb250SW5mbykge1xuXHRcdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2VkaXRvckZvbnRJbmZvJywgSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplZEZvbnRJbmZvKSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyV29ya2JlbmNoKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsIG5vdGlmaWNhdGlvblNlcnZpY2U6IE5vdGlmaWNhdGlvblNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpOiB2b2lkIHtcblxuXHRcdC8vIEFSSUEgJiBTaWduYWxzXG5cdFx0c2V0QVJJQUNvbnRhaW5lcih0aGlzLm1haW5Db250YWluZXIpO1xuXHRcdHNldFByb2dyZXNzQWNjY2Vzc2liaWxpdHlTaWduYWxTY2hlZHVsZXIoKG1zRGVsYXlUaW1lOiBudW1iZXIsIG1zTG9vcFRpbWU/OiBudW1iZXIpID0+IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEFjY2Vzc2liaWxpdHlQcm9ncmVzc1NpZ25hbFNjaGVkdWxlciwgbXNEZWxheVRpbWUsIG1zTG9vcFRpbWUpKTtcblxuXHRcdC8vIFN0YXRlIHNwZWNpZmljIGNsYXNzZXNcblx0XHRjb25zdCBwbGF0Zm9ybUNsYXNzID0gaXNXaW5kb3dzID8gJ3dpbmRvd3MnIDogaXNMaW51eCA/ICdsaW51eCcgOiAnbWFjJztcblx0XHRjb25zdCB3b3JrYmVuY2hDbGFzc2VzID0gY29hbGVzY2UoW1xuXHRcdFx0J21vbmFjby13b3JrYmVuY2gnLFxuXHRcdFx0cGxhdGZvcm1DbGFzcyxcblx0XHRcdGlzV2ViID8gJ3dlYicgOiB1bmRlZmluZWQsXG5cdFx0XHRpc0Nocm9tZSA/ICdjaHJvbWl1bScgOiBpc0ZpcmVmb3ggPyAnZmlyZWZveCcgOiBpc1NhZmFyaSA/ICdzYWZhcmknIDogdW5kZWZpbmVkLFxuXHRcdFx0Li4udGhpcy5nZXRMYXlvdXRDbGFzc2VzKCksXG5cdFx0XHQuLi4odGhpcy5vcHRpb25zPy5leHRyYUNsYXNzZXMgPyB0aGlzLm9wdGlvbnMuZXh0cmFDbGFzc2VzIDogW10pXG5cdFx0XSk7XG5cblx0XHR0aGlzLm1haW5Db250YWluZXIuY2xhc3NMaXN0LmFkZCguLi53b3JrYmVuY2hDbGFzc2VzKTtcblxuXHRcdC8vIEFwcGx5IGZvbnQgYWxpYXNpbmdcblx0XHR0aGlzLnVwZGF0ZUZvbnRBbGlhc2luZyh1bmRlZmluZWQsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdC8vIFdhcm0gdXAgZm9udCBjYWNoZSBpbmZvcm1hdGlvbiBiZWZvcmUgYnVpbGRpbmcgdXAgdG9vIG1hbnkgZG9tIGVsZW1lbnRzXG5cdFx0dGhpcy5yZXN0b3JlRm9udEluZm8oc3RvcmFnZVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdC8vIENyZWF0ZSBQYXJ0c1xuXHRcdGZvciAoY29uc3QgeyBpZCwgcm9sZSwgY2xhc3Nlcywgb3B0aW9ucyB9IG9mIFtcblx0XHRcdHsgaWQ6IFBhcnRzLlRJVExFQkFSX1BBUlQsIHJvbGU6ICdub25lJywgY2xhc3NlczogWyd0aXRsZWJhciddIH0sXG5cdFx0XHR7IGlkOiBQYXJ0cy5CQU5ORVJfUEFSVCwgcm9sZTogJ2Jhbm5lcicsIGNsYXNzZXM6IFsnYmFubmVyJ10gfSxcblx0XHRcdHsgaWQ6IFBhcnRzLkFDVElWSVRZQkFSX1BBUlQsIHJvbGU6ICdub25lJywgY2xhc3NlczogWydhY3Rpdml0eWJhcicsIHRoaXMuZ2V0U2lkZUJhclBvc2l0aW9uKCkgPT09IFBvc2l0aW9uLkxFRlQgPyAnbGVmdCcgOiAncmlnaHQnXSB9LCAvLyBVc2Ugcm9sZSAnbm9uZScgZm9yIHNvbWUgcGFydHMgdG8gbWFrZSBzY3JlZW4gcmVhZGVycyBsZXNzIGNoYXR0eSAjMTE0ODkyXG5cdFx0XHR7IGlkOiBQYXJ0cy5TSURFQkFSX1BBUlQsIHJvbGU6ICdub25lJywgY2xhc3NlczogWydzaWRlYmFyJywgdGhpcy5nZXRTaWRlQmFyUG9zaXRpb24oKSA9PT0gUG9zaXRpb24uTEVGVCA/ICdsZWZ0JyA6ICdyaWdodCddIH0sXG5cdFx0XHR7IGlkOiBQYXJ0cy5FRElUT1JfUEFSVCwgcm9sZTogJ21haW4nLCBjbGFzc2VzOiBbJ2VkaXRvciddLCBvcHRpb25zOiB7IHJlc3RvcmVQcmV2aW91c1N0YXRlOiB0aGlzLndpbGxSZXN0b3JlRWRpdG9ycygpIH0gfSxcblx0XHRcdHsgaWQ6IFBhcnRzLlBBTkVMX1BBUlQsIHJvbGU6ICdub25lJywgY2xhc3NlczogWydwYW5lbCcsICdiYXNlcGFuZWwnLCBwb3NpdGlvblRvU3RyaW5nKHRoaXMuZ2V0UGFuZWxQb3NpdGlvbigpKV0gfSxcblx0XHRcdHsgaWQ6IFBhcnRzLkFVWElMSUFSWUJBUl9QQVJULCByb2xlOiAnbm9uZScsIGNsYXNzZXM6IFsnYXV4aWxpYXJ5YmFyJywgJ2Jhc2VwYW5lbCcsIHRoaXMuZ2V0U2lkZUJhclBvc2l0aW9uKCkgPT09IFBvc2l0aW9uLkxFRlQgPyAncmlnaHQnIDogJ2xlZnQnXSB9LFxuXHRcdFx0eyBpZDogUGFydHMuU1RBVFVTQkFSX1BBUlQsIHJvbGU6ICdzdGF0dXMnLCBjbGFzc2VzOiBbJ3N0YXR1c2JhciddIH1cblx0XHRdKSB7XG5cdFx0XHRjb25zdCBwYXJ0Q29udGFpbmVyID0gdGhpcy5jcmVhdGVQYXJ0KGlkLCByb2xlLCBjbGFzc2VzKTtcblxuXHRcdFx0bWFyayhgY29kZS93aWxsQ3JlYXRlUGFydC8ke2lkfWApO1xuXHRcdFx0dGhpcy5nZXRQYXJ0KGlkKS5jcmVhdGUocGFydENvbnRhaW5lciwgb3B0aW9ucyk7XG5cdFx0XHRtYXJrKGBjb2RlL2RpZENyZWF0ZVBhcnQvJHtpZH1gKTtcblx0XHR9XG5cblx0XHQvLyBOb3RpZmljYXRpb24gSGFuZGxlcnNcblx0XHR0aGlzLmNyZWF0ZU5vdGlmaWNhdGlvbnNIYW5kbGVycyhpbnN0YW50aWF0aW9uU2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZSk7XG5cblx0XHQvLyBBZGQgV29ya2JlbmNoIHRvIERPTVxuXHRcdHRoaXMucGFyZW50LmFwcGVuZENoaWxkKHRoaXMubWFpbkNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVBhcnQoaWQ6IHN0cmluZywgcm9sZTogc3RyaW5nLCBjbGFzc2VzOiBzdHJpbmdbXSk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBwYXJ0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChyb2xlID09PSAnc3RhdHVzJyA/ICdmb290ZXInIC8qIFVzZSBmb290ZXIgZWxlbWVudCBmb3Igc3RhdHVzIGJhciAjOTgzNzYgKi8gOiAnZGl2Jyk7XG5cdFx0cGFydC5jbGFzc0xpc3QuYWRkKCdwYXJ0JywgLi4uY2xhc3Nlcyk7XG5cdFx0cGFydC5pZCA9IGlkO1xuXHRcdHBhcnQuc2V0QXR0cmlidXRlKCdyb2xlJywgcm9sZSk7XG5cdFx0aWYgKHJvbGUgPT09ICdzdGF0dXMnKSB7XG5cdFx0XHRwYXJ0LnNldEF0dHJpYnV0ZSgnYXJpYS1saXZlJywgJ29mZicpO1xuXHRcdH1cblxuXHRcdHJldHVybiBwYXJ0O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVOb3RpZmljYXRpb25zSGFuZGxlcnMoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZTogTm90aWZpY2F0aW9uU2VydmljZSk6IHZvaWQge1xuXG5cdFx0Ly8gSW5zdGFudGlhdGUgTm90aWZpY2F0aW9uIGNvbXBvbmVudHNcblx0XHRjb25zdCBub3RpZmljYXRpb25zQ2VudGVyID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90aWZpY2F0aW9uc0NlbnRlciwgdGhpcy5tYWluQ29udGFpbmVyLCBub3RpZmljYXRpb25TZXJ2aWNlLm1vZGVsKSk7XG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uc1RvYXN0cyA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGlmaWNhdGlvbnNUb2FzdHMsIHRoaXMubWFpbkNvbnRhaW5lciwgbm90aWZpY2F0aW9uU2VydmljZS5tb2RlbCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGlmaWNhdGlvbnNBbGVydHMsIG5vdGlmaWNhdGlvblNlcnZpY2UubW9kZWwpKTtcblx0XHRjb25zdCBub3RpZmljYXRpb25zU3RhdHVzID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90aWZpY2F0aW9uc1N0YXR1cywgbm90aWZpY2F0aW9uU2VydmljZS5tb2RlbCk7XG5cblx0XHQvLyBWaXNpYmlsaXR5XG5cdFx0dGhpcy5fcmVnaXN0ZXIobm90aWZpY2F0aW9uc0NlbnRlci5vbkRpZENoYW5nZVZpc2liaWxpdHkoKCkgPT4ge1xuXHRcdFx0bm90aWZpY2F0aW9uc1N0YXR1cy51cGRhdGUobm90aWZpY2F0aW9uc0NlbnRlci5pc1Zpc2libGUsIG5vdGlmaWNhdGlvbnNUb2FzdHMuaXNWaXNpYmxlKTtcblx0XHRcdG5vdGlmaWNhdGlvbnNUb2FzdHMudXBkYXRlKG5vdGlmaWNhdGlvbnNDZW50ZXIuaXNWaXNpYmxlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihub3RpZmljYXRpb25zVG9hc3RzLm9uRGlkQ2hhbmdlVmlzaWJpbGl0eSgoKSA9PiB7XG5cdFx0XHRub3RpZmljYXRpb25zU3RhdHVzLnVwZGF0ZShub3RpZmljYXRpb25zQ2VudGVyLmlzVmlzaWJsZSwgbm90aWZpY2F0aW9uc1RvYXN0cy5pc1Zpc2libGUpO1xuXHRcdH0pKTtcblxuXHRcdC8vIFJlZ2lzdGVyIENvbW1hbmRzXG5cdFx0cmVnaXN0ZXJOb3RpZmljYXRpb25Db21tYW5kcyhub3RpZmljYXRpb25zQ2VudGVyLCBub3RpZmljYXRpb25zVG9hc3RzLCBub3RpZmljYXRpb25TZXJ2aWNlLm1vZGVsKTtcblxuXHRcdC8vIFJlZ2lzdGVyIG5vdGlmaWNhdGlvbiBhY2Nlc3NpYmxlIHZpZXdcblx0XHRBY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LnJlZ2lzdGVyKG5ldyBOb3RpZmljYXRpb25BY2Nlc3NpYmxlVmlldygpKTtcblxuXHRcdC8vIFJlZ2lzdGVyIHdpdGggTGF5b3V0XG5cdFx0dGhpcy5yZWdpc3Rlck5vdGlmaWNhdGlvbnMoe1xuXHRcdFx0b25EaWRDaGFuZ2VOb3RpZmljYXRpb25zVmlzaWJpbGl0eTogRXZlbnQubWFwKEV2ZW50LmFueShub3RpZmljYXRpb25zVG9hc3RzLm9uRGlkQ2hhbmdlVmlzaWJpbGl0eSwgbm90aWZpY2F0aW9uc0NlbnRlci5vbkRpZENoYW5nZVZpc2liaWxpdHkpLCAoKSA9PiBub3RpZmljYXRpb25zVG9hc3RzLmlzVmlzaWJsZSB8fCBub3RpZmljYXRpb25zQ2VudGVyLmlzVmlzaWJsZSlcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVzdG9yZShsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSk6IHZvaWQge1xuXG5cdFx0Ly8gQXNrIGVhY2ggcGFydCB0byByZXN0b3JlXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMucmVzdG9yZVBhcnRzKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycm9yKTtcblx0XHR9XG5cblx0XHQvLyBUcmFuc2l0aW9uIGludG8gcmVzdG9yZWQgcGhhc2UgYWZ0ZXIgbGF5b3V0IGhhcyByZXN0b3JlZFxuXHRcdC8vIGJ1dCBkbyBub3Qgd2FpdCBpbmRlZmluaXRlbHkgb24gdGhpcyB0byBhY2NvdW50IGZvciBzbG93XG5cdFx0Ly8gZWRpdG9ycyByZXN0b3JpbmcuIFNpbmNlIHRoZSB3b3JrYmVuY2ggaXMgZnVsbHkgZnVuY3Rpb25hbFxuXHRcdC8vIGV2ZW4gd2hlbiB0aGUgdmlzaWJsZSBlZGl0b3JzIGhhdmUgbm90IHJlc29sdmVkLCB3ZSBzdGlsbFxuXHRcdC8vIHdhbnQgY29udHJpYnV0aW9ucyBvbiB0aGUgYFJlc3RvcmVkYCBwaGFzZSB0byB3b3JrIGJlZm9yZVxuXHRcdC8vIHNsb3cgZWRpdG9ycyBoYXZlIHJlc29sdmVkLiBCdXQgd2UgYWxzbyBkbyBub3Qgd2FudCBmYXN0XG5cdFx0Ly8gZWRpdG9ycyB0byByZXNvbHZlIHNsb3cgd2hlbiB0b28gbWFueSBjb250cmlidXRpb25zIGdldFxuXHRcdC8vIGluc3RhbnRpYXRlZCwgc28gd2UgZmluZCBhIG1pZGRsZSBncm91bmQgc29sdXRpb24gdmlhXG5cdFx0Ly8gYFByb21pc2UucmFjZWBcblx0XHR0aGlzLndoZW5SZWFkeS5maW5hbGx5KCgpID0+XG5cdFx0XHRQcm9taXNlLnJhY2UoW1xuXHRcdFx0XHR0aGlzLndoZW5SZXN0b3JlZCxcblx0XHRcdFx0dGltZW91dCgyMDAwKVxuXHRcdFx0XSkuZmluYWxseSgoKSA9PiB7XG5cblx0XHRcdFx0Ly8gVXBkYXRlIHBlcmYgbWFya3Mgb25seSB3aGVuIHRoZSBsYXlvdXQgaXMgZnVsbHlcblx0XHRcdFx0Ly8gcmVzdG9yZWQuIFdlIHdhbnQgdGhlIHRpbWUgaXQgdGFrZXMgdG8gcmVzdG9yZVxuXHRcdFx0XHQvLyBlZGl0b3JzIHRvIGJlIGluY2x1ZGVkIGluIHRoZXNlIG51bWJlcnNcblxuXHRcdFx0XHRmdW5jdGlvbiBtYXJrRGlkU3RhcnRXb3JrYmVuY2goKSB7XG5cdFx0XHRcdFx0bWFyaygnY29kZS9kaWRTdGFydFdvcmtiZW5jaCcpO1xuXHRcdFx0XHRcdHBlcmZvcm1hbmNlLm1lYXN1cmUoJ3BlcmY6IHdvcmtiZW5jaCBjcmVhdGUgJiByZXN0b3JlJywgJ2NvZGUvZGlkTG9hZFdvcmtiZW5jaE1haW4nLCAnY29kZS9kaWRTdGFydFdvcmtiZW5jaCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMuaXNSZXN0b3JlZCgpKSB7XG5cdFx0XHRcdFx0bWFya0RpZFN0YXJ0V29ya2JlbmNoKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy53aGVuUmVzdG9yZWQuZmluYWxseSgoKSA9PiBtYXJrRGlkU3RhcnRXb3JrYmVuY2goKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTZXQgbGlmZWN5Y2xlIHBoYXNlIHRvIGBSZXN0b3JlZGBcblx0XHRcdFx0bGlmZWN5Y2xlU2VydmljZS5waGFzZSA9IExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkO1xuXG5cdFx0XHRcdC8vIFNldCBsaWZlY3ljbGUgcGhhc2UgdG8gYEV2ZW50dWFsbHlgIGFmdGVyIGEgc2hvcnQgZGVsYXkgYW5kIHdoZW4gaWRsZSAobWluIDIuNXNlYywgbWF4IDVzZWMpXG5cdFx0XHRcdGNvbnN0IGV2ZW50dWFsbHlQaGFzZVNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3RlcihydW5XaGVuV2luZG93SWRsZShtYWluV2luZG93LCAoKSA9PiBsaWZlY3ljbGVTZXJ2aWNlLnBoYXNlID0gTGlmZWN5Y2xlUGhhc2UuRXZlbnR1YWxseSwgMjUwMCkpO1xuXHRcdFx0XHR9LCAyNTAwKSk7XG5cdFx0XHRcdGV2ZW50dWFsbHlQaGFzZVNjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdFx0fSlcblx0XHQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPO0FBQ1AsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxPQUFPLFNBQVMscUNBQXFDO0FBQzlELFNBQVMsa0JBQWtCLGVBQWU7QUFDMUMsU0FBUyxXQUFXLFVBQVUsZ0JBQWdCO0FBQzlDLFNBQVMsWUFBWTtBQUNyQixTQUFTLG1CQUFtQixpQ0FBaUM7QUFDN0QsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXLFNBQVMsT0FBTyxVQUFVLG1CQUFtQjtBQUNqRSxTQUEwQyxjQUFjLDJCQUEyQjtBQUNuRixTQUFpQyx3QkFBd0I7QUFDekQsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxVQUFVLE9BQU8seUJBQXlCLHdCQUF3QjtBQUMzRSxTQUFTLGlCQUFpQixxQkFBcUIsY0FBYyxxQkFBcUI7QUFDbEYsU0FBb0MsNkJBQTZCO0FBR2pFLFNBQVMsZ0JBQWdCLHlCQUE0QztBQUNyRSxTQUFTLDRCQUE0QjtBQUVyQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG9CQUFvQjtBQUU3QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0I7QUFD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
