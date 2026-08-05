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
import { Emitter, Event } from "../../../../base/common/event.js";
import { IHostService } from "./host.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { isFolderToOpen, isWorkspaceToOpen, isFileToOpen } from "../../../../platform/window/common/window.js";
import { isResourceEditorInput, pathsToEditors } from "../../../common/editor.js";
import { whenEditorClosed } from "../../../browser/editor.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { EventType, ModifierKeyEmitter, addDisposableListener, addDisposableThrottledListener, detectFullscreen, disposableWindowInterval, getActiveDocument, getWindowId, onDidRegisterWindow, trackFocus } from "../../../../base/browser/dom.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { memoize } from "../../../../base/common/decorators.js";
import { parseLineAndColumnAware } from "../../../../base/common/extpath.js";
import { IWorkspaceEditingService } from "../../workspaces/common/workspaceEditing.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILifecycleService, ShutdownReason } from "../../lifecycle/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { getWorkspaceIdentifier } from "../../workspaces/browser/workspaces.js";
import { localize } from "../../../../nls.js";
import Severity from "../../../../base/common/severity.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { DomEmitter } from "../../../../base/browser/event.js";
import { isUndefined } from "../../../../base/common/types.js";
import { isTemporaryWorkspace, IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { Schemas } from "../../../../base/common/network.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { mainWindow, isAuxiliaryWindow } from "../../../../base/browser/window.js";
import { isIOS, isMacintosh } from "../../../../base/common/platform.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
var HostShutdownReason = /* @__PURE__ */ ((HostShutdownReason2) => {
  HostShutdownReason2[HostShutdownReason2["Unknown"] = 1] = "Unknown";
  HostShutdownReason2[HostShutdownReason2["Keyboard"] = 2] = "Keyboard";
  HostShutdownReason2[HostShutdownReason2["Api"] = 3] = "Api";
  return HostShutdownReason2;
})(HostShutdownReason || {});
let BrowserHostService = class extends Disposable {
  constructor(layoutService, configurationService, fileService, labelService, environmentService, instantiationService, lifecycleService, logService, dialogService, contextService, userDataProfilesService) {
    super();
    this.layoutService = layoutService;
    this.configurationService = configurationService;
    this.fileService = fileService;
    this.labelService = labelService;
    this.environmentService = environmentService;
    this.instantiationService = instantiationService;
    this.lifecycleService = lifecycleService;
    this.logService = logService;
    this.dialogService = dialogService;
    this.contextService = contextService;
    this.userDataProfilesService = userDataProfilesService;
    this.shutdownReason = 1 /* Unknown */;
    if (environmentService.options?.workspaceProvider) {
      this.workspaceProvider = environmentService.options.workspaceProvider;
    } else {
      this.workspaceProvider = new class {
        constructor() {
          this.workspace = void 0;
          this.trusted = void 0;
        }
        async open() {
          return true;
        }
      }();
    }
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.lifecycleService.onBeforeShutdown((e) => this.onBeforeShutdown(e)));
    this._register(ModifierKeyEmitter.getInstance().event(() => this.updateShutdownReasonFromEvent()));
  }
  onBeforeShutdown(e) {
    switch (this.shutdownReason) {
      // Unknown / Keyboard shows veto depending on setting
      case 1 /* Unknown */:
      case 2 /* Keyboard */: {
        const confirmBeforeClose = this.configurationService.getValue("window.confirmBeforeClose");
        if (confirmBeforeClose === "always" || confirmBeforeClose === "keyboardOnly" && this.shutdownReason === 2 /* Keyboard */) {
          e.veto(true, "veto.confirmBeforeClose");
        }
        break;
      }
      // Api never shows veto
      case 3 /* Api */:
        break;
    }
    this.shutdownReason = 1 /* Unknown */;
  }
  updateShutdownReasonFromEvent() {
    if (this.shutdownReason === 3 /* Api */) {
      return;
    }
    if (ModifierKeyEmitter.getInstance().isModifierPressed) {
      this.shutdownReason = 2 /* Keyboard */;
    } else {
      this.shutdownReason = 1 /* Unknown */;
    }
  }
  get onDidChangeFocus() {
    const emitter = this._register(new Emitter());
    this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
      const focusTracker = disposables.add(trackFocus(window));
      const visibilityTracker = disposables.add(new DomEmitter(window.document, "visibilitychange"));
      Event.any(
        Event.map(focusTracker.onDidFocus, () => this.hasFocus, disposables),
        Event.map(focusTracker.onDidBlur, () => this.hasFocus, disposables),
        Event.map(visibilityTracker.event, () => this.hasFocus, disposables),
        Event.map(this.onDidChangeActiveWindow, () => this.hasFocus, disposables)
      )((focus) => emitter.fire(focus));
    }, { window: mainWindow, disposables: this._store }));
    return Event.latch(emitter.event, void 0, this._store);
  }
  get hasFocus() {
    return getActiveDocument().hasFocus();
  }
  async hadLastFocus() {
    return true;
  }
  async focus(targetWindow) {
    targetWindow.focus();
  }
  get onDidChangeActiveWindow() {
    const emitter = this._register(new Emitter());
    this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
      const windowId = getWindowId(window);
      const focusTracker = disposables.add(trackFocus(window));
      disposables.add(focusTracker.onDidFocus(() => emitter.fire(windowId)));
      if (isAuxiliaryWindow(window)) {
        disposables.add(disposableWindowInterval(window, () => {
          const hasFocus = window.document.hasFocus();
          if (hasFocus) {
            emitter.fire(windowId);
          }
          return hasFocus;
        }, 100, 20));
      }
    }, { window: mainWindow, disposables: this._store }));
    return Event.latch(emitter.event, void 0, this._store);
  }
  get onDidChangeFullScreen() {
    const emitter = this._register(new Emitter());
    this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
      const windowId = getWindowId(window);
      const viewport = isIOS && window.visualViewport ? window.visualViewport : window;
      for (const event of [EventType.FULLSCREEN_CHANGE, EventType.WK_FULLSCREEN_CHANGE]) {
        disposables.add(addDisposableListener(window.document, event, () => emitter.fire({ windowId, fullscreen: !!detectFullscreen(window) })));
      }
      disposables.add(addDisposableThrottledListener(
        viewport,
        EventType.RESIZE,
        () => emitter.fire({ windowId, fullscreen: !!detectFullscreen(window) }),
        void 0,
        isMacintosh ? 2e3 : 800
        /* can be throttled */
      ));
    }, { window: mainWindow, disposables: this._store }));
    return emitter.event;
  }
  openWindow(arg1, arg2) {
    if (Array.isArray(arg1)) {
      return this.doOpenWindow(arg1, arg2);
    }
    return this.doOpenEmptyWindow(arg1);
  }
  async doOpenWindow(toOpen, options) {
    const payload = this.preservePayload(false, options);
    const fileOpenables = [];
    const foldersToAdd = [];
    const foldersToRemove = [];
    for (const openable of toOpen) {
      openable.label = openable.label || this.getRecentLabel(openable);
      if (isFolderToOpen(openable)) {
        if (options?.addMode) {
          foldersToAdd.push({ uri: openable.folderUri });
        } else if (options?.removeMode) {
          foldersToRemove.push(openable.folderUri);
        } else {
          this.doOpen({ folderUri: openable.folderUri }, { reuse: this.shouldReuse(
            options,
            false
            /* no file */
          ), payload });
        }
      } else if (isWorkspaceToOpen(openable)) {
        this.doOpen({ workspaceUri: openable.workspaceUri }, { reuse: this.shouldReuse(
          options,
          false
          /* no file */
        ), payload });
      } else if (isFileToOpen(openable)) {
        fileOpenables.push(openable);
      }
    }
    if (foldersToAdd.length > 0 || foldersToRemove.length > 0) {
      this.withServices(async (accessor) => {
        const workspaceEditingService = accessor.get(IWorkspaceEditingService);
        if (foldersToAdd.length > 0) {
          await workspaceEditingService.addFolders(foldersToAdd);
        }
        if (foldersToRemove.length > 0) {
          await workspaceEditingService.removeFolders(foldersToRemove);
        }
      });
    }
    if (fileOpenables.length > 0) {
      this.withServices(async (accessor) => {
        const editorService = accessor.get(IEditorService);
        if (options?.mergeMode && fileOpenables.length === 4) {
          const editors = coalesce(await pathsToEditors(fileOpenables, this.fileService, this.logService));
          if (editors.length !== 4 || !isResourceEditorInput(editors[0]) || !isResourceEditorInput(editors[1]) || !isResourceEditorInput(editors[2]) || !isResourceEditorInput(editors[3])) {
            return;
          }
          if (this.shouldReuse(
            options,
            true
            /* file */
          )) {
            editorService.openEditor({
              input1: { resource: editors[0].resource },
              input2: { resource: editors[1].resource },
              base: { resource: editors[2].resource },
              result: { resource: editors[3].resource },
              options: { pinned: true }
            });
          } else {
            const environment = /* @__PURE__ */ new Map();
            environment.set("mergeFile1", editors[0].resource.toString());
            environment.set("mergeFile2", editors[1].resource.toString());
            environment.set("mergeFileBase", editors[2].resource.toString());
            environment.set("mergeFileResult", editors[3].resource.toString());
            this.doOpen(void 0, { payload: Array.from(environment.entries()) });
          }
        } else if (options?.diffMode && fileOpenables.length === 2) {
          const editors = coalesce(await pathsToEditors(fileOpenables, this.fileService, this.logService));
          if (editors.length !== 2 || !isResourceEditorInput(editors[0]) || !isResourceEditorInput(editors[1])) {
            return;
          }
          if (this.shouldReuse(
            options,
            true
            /* file */
          )) {
            editorService.openEditor({
              original: { resource: editors[0].resource },
              modified: { resource: editors[1].resource },
              options: { pinned: true }
            });
          } else {
            const environment = /* @__PURE__ */ new Map();
            environment.set("diffFileSecondary", editors[0].resource.toString());
            environment.set("diffFilePrimary", editors[1].resource.toString());
            this.doOpen(void 0, { payload: Array.from(environment.entries()) });
          }
        } else {
          for (const openable of fileOpenables) {
            if (this.shouldReuse(
              options,
              true
              /* file */
            )) {
              let openables = [];
              if (options?.gotoLineMode) {
                const pathColumnAware = parseLineAndColumnAware(openable.fileUri.path);
                openables = [{
                  fileUri: openable.fileUri.with({ path: pathColumnAware.path }),
                  options: {
                    selection: !isUndefined(pathColumnAware.line) ? { startLineNumber: pathColumnAware.line, startColumn: pathColumnAware.column || 1 } : void 0
                  }
                }];
              } else {
                openables = [openable];
              }
              editorService.openEditors(coalesce(await pathsToEditors(openables, this.fileService, this.logService)), void 0, { validateTrust: true });
            } else {
              const environment = /* @__PURE__ */ new Map();
              environment.set("openFile", openable.fileUri.toString());
              if (options?.gotoLineMode) {
                environment.set("gotoLineMode", "true");
              }
              this.doOpen(void 0, { payload: Array.from(environment.entries()) });
            }
          }
        }
        const waitMarkerFileURI = options?.waitMarkerFileURI;
        if (waitMarkerFileURI) {
          (async () => {
            await this.instantiationService.invokeFunction((accessor2) => whenEditorClosed(accessor2, fileOpenables.map((fileOpenable) => fileOpenable.fileUri)));
            await this.fileService.del(waitMarkerFileURI);
          })();
        }
      });
    }
  }
  withServices(fn) {
    this.instantiationService.invokeFunction((accessor) => fn(accessor));
  }
  preservePayload(isEmptyWindow, options) {
    const newPayload = new Array();
    if (!isEmptyWindow && this.environmentService.extensionDevelopmentLocationURI) {
      newPayload.push(["extensionDevelopmentPath", this.environmentService.extensionDevelopmentLocationURI.toString()]);
      if (this.environmentService.debugExtensionHost.debugId) {
        newPayload.push(["debugId", this.environmentService.debugExtensionHost.debugId]);
      }
      if (this.environmentService.debugExtensionHost.port) {
        newPayload.push(["inspect-brk-extensions", String(this.environmentService.debugExtensionHost.port)]);
      }
    }
    const newWindowProfile = options?.forceProfile ? this.userDataProfilesService.profiles.find((profile) => profile.name === options?.forceProfile) : void 0;
    if (newWindowProfile && !newWindowProfile.isDefault) {
      newPayload.push(["profile", newWindowProfile.name]);
    }
    return newPayload.length ? newPayload : void 0;
  }
  getRecentLabel(openable) {
    if (isFolderToOpen(openable)) {
      return this.labelService.getWorkspaceLabel(openable.folderUri, { verbose: Verbosity.LONG });
    }
    if (isWorkspaceToOpen(openable)) {
      return this.labelService.getWorkspaceLabel(getWorkspaceIdentifier(openable.workspaceUri), { verbose: Verbosity.LONG });
    }
    return this.labelService.getUriLabel(openable.fileUri, { appendWorkspaceSuffix: true });
  }
  shouldReuse(options = /* @__PURE__ */ Object.create(null), isFile) {
    if (options.waitMarkerFileURI) {
      return true;
    }
    const windowConfig = this.configurationService.getValue("window");
    const openInNewWindowConfig = isFile ? windowConfig?.openFilesInNewWindow || "off" : windowConfig?.openFoldersInNewWindow || "default";
    let openInNewWindow = (options.preferNewWindow || !!options.forceNewWindow) && !options.forceReuseWindow;
    if (!options.forceNewWindow && !options.forceReuseWindow && (openInNewWindowConfig === "on" || openInNewWindowConfig === "off")) {
      openInNewWindow = openInNewWindowConfig === "on";
    }
    return !openInNewWindow;
  }
  async doOpenEmptyWindow(options) {
    return this.doOpen(void 0, {
      reuse: options?.forceReuseWindow,
      payload: this.preservePayload(true, options)
    });
  }
  async doOpen(workspace, options) {
    if (workspace && isFolderToOpen(workspace) && workspace.folderUri.scheme === Schemas.file && isTemporaryWorkspace(this.contextService.getWorkspace())) {
      this.withServices(async (accessor) => {
        const workspaceEditingService = accessor.get(IWorkspaceEditingService);
        await workspaceEditingService.updateFolders(0, this.contextService.getWorkspace().folders.length, [{ uri: workspace.folderUri }]);
      });
      return;
    }
    if (options?.reuse) {
      await this.handleExpectedShutdown(ShutdownReason.LOAD);
    }
    const opened = await this.workspaceProvider.open(workspace, options);
    if (!opened) {
      const { confirmed } = await this.dialogService.confirm({
        type: Severity.Warning,
        message: localize("unableToOpenExternal", "The browser interrupted the opening of a new tab or window. Press 'Open' to open it anyway."),
        primaryButton: localize({ key: "open", comment: ["&& denotes a mnemonic"] }, "&&Open")
      });
      if (confirmed) {
        await this.workspaceProvider.open(workspace, options);
      }
    }
  }
  async toggleFullScreen(targetWindow) {
    const target = this.layoutService.getContainer(targetWindow);
    if (targetWindow.document.fullscreen !== void 0) {
      if (!targetWindow.document.fullscreen) {
        try {
          return await target.requestFullscreen();
        } catch (error) {
          this.logService.warn("toggleFullScreen(): requestFullscreen failed");
        }
      } else {
        try {
          return await targetWindow.document.exitFullscreen();
        } catch (error) {
          this.logService.warn("toggleFullScreen(): exitFullscreen failed");
        }
      }
    }
    if (targetWindow.document.webkitIsFullScreen !== void 0) {
      try {
        if (!targetWindow.document.webkitIsFullScreen) {
          target.webkitRequestFullscreen();
        } else {
          targetWindow.document.webkitExitFullscreen();
        }
      } catch {
        this.logService.warn("toggleFullScreen(): requestFullscreen/exitFullscreen failed");
      }
    }
  }
  async moveTop(targetWindow) {
  }
  async getCursorScreenPoint() {
    return void 0;
  }
  //#endregion
  //#region Lifecycle
  async restart() {
    this.reload();
  }
  async reload() {
    await this.handleExpectedShutdown(ShutdownReason.RELOAD);
    mainWindow.location.reload();
  }
  async close() {
    await this.handleExpectedShutdown(ShutdownReason.CLOSE);
    mainWindow.close();
  }
  async withExpectedShutdown(expectedShutdownTask) {
    const previousShutdownReason = this.shutdownReason;
    try {
      this.shutdownReason = 3 /* Api */;
      return await expectedShutdownTask();
    } finally {
      this.shutdownReason = previousShutdownReason;
    }
  }
  async handleExpectedShutdown(reason) {
    this.shutdownReason = 3 /* Api */;
    return this.lifecycleService.withExpectedShutdown(reason);
  }
  //#endregion
  //#region Screenshots
  async getScreenshot() {
    const store = new DisposableStore();
    const video = document.createElement("video");
    store.add(toDisposable(() => video.remove()));
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: true
      });
      video.srcObject = stream;
      video.play();
      await Promise.all([
        new Promise((r) => store.add(addDisposableListener(video, "loadedmetadata", () => r()))),
        new Promise((r) => store.add(addDisposableListener(video, "canplaythrough", () => r())))
      ]);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return void 0;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob((blob2) => resolve(blob2), "image/jpeg", 0.95));
      if (!blob) {
        throw new Error("Failed to create blob from canvas");
      }
      return blob.arrayBuffer();
    } catch (error) {
      console.error("Error taking screenshot:", error);
      return void 0;
    } finally {
      store.dispose();
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    }
  }
  //#endregion
  //#region Native Handle
  async getNativeWindowHandle(_windowId) {
    return void 0;
  }
  //#endregion
};
__decorateClass([
  memoize
], BrowserHostService.prototype, "onDidChangeFocus", 1);
__decorateClass([
  memoize
], BrowserHostService.prototype, "onDidChangeActiveWindow", 1);
__decorateClass([
  memoize
], BrowserHostService.prototype, "onDidChangeFullScreen", 1);
BrowserHostService = __decorateClass([
  __decorateParam(0, ILayoutService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IFileService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IBrowserWorkbenchEnvironmentService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ILifecycleService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, IWorkspaceContextService),
  __decorateParam(10, IUserDataProfilesService)
], BrowserHostService);
registerSingleton(IHostService, BrowserHostService, InstantiationType.Delayed);
export {
  BrowserHostService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvaG9zdC9icm93c2VyL2Jyb3dzZXJIb3N0U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi9ob3N0LmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVdpbmRvd1NldHRpbmdzLCBJV2luZG93T3BlbmFibGUsIElPcGVuV2luZG93T3B0aW9ucywgaXNGb2xkZXJUb09wZW4sIGlzV29ya3NwYWNlVG9PcGVuLCBpc0ZpbGVUb09wZW4sIElPcGVuRW1wdHlXaW5kb3dPcHRpb25zLCBJUGF0aERhdGEsIElGaWxlVG9PcGVuIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgaXNSZXNvdXJjZUVkaXRvcklucHV0LCBwYXRoc1RvRWRpdG9ycyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgd2hlbkVkaXRvckNsb3NlZCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2UsIElXb3Jrc3BhY2VQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvd2ViLmFwaS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSwgVmVyYm9zaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IEV2ZW50VHlwZSwgTW9kaWZpZXJLZXlFbWl0dGVyLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGFkZERpc3Bvc2FibGVUaHJvdHRsZWRMaXN0ZW5lciwgZGV0ZWN0RnVsbHNjcmVlbiwgZGlzcG9zYWJsZVdpbmRvd0ludGVydmFsLCBnZXRBY3RpdmVEb2N1bWVudCwgZ2V0V2luZG93SWQsIG9uRGlkUmVnaXN0ZXJXaW5kb3csIHRyYWNrRm9jdXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvYnJvd3Nlci9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgcGFyc2VMaW5lQW5kQ29sdW1uQXdhcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9leHRwYXRoLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VFZGl0aW5nU2VydmljZSB9IGZyb20gJy4uLy4uL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZUVkaXRpbmcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSwgQmVmb3JlU2h1dGRvd25FdmVudCwgU2h1dGRvd25SZWFzb24gfSBmcm9tICcuLi8uLi9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBCcm93c2VyTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9icm93c2VyL2xpZmVjeWNsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBnZXRXb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlcy9icm93c2VyL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBEb21FbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2V2ZW50LmpzJztcbmltcG9ydCB7IGlzVW5kZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgaXNUZW1wb3JhcnlXb3Jrc3BhY2UsIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElUZXh0RWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3csIGlzQXV4aWxpYXJ5V2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBpc0lPUywgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuXG5lbnVtIEhvc3RTaHV0ZG93blJlYXNvbiB7XG5cblx0LyoqXG5cdCAqIEFuIHVua25vd24gc2h1dGRvd24gcmVhc29uLlxuXHQgKi9cblx0VW5rbm93biA9IDEsXG5cblx0LyoqXG5cdCAqIEEgc2h1dGRvd24gdGhhdCB3YXMgcG90ZW50aWFsbHkgdHJpZ2dlcmVkIGJ5IGtleWJvYXJkIHVzZS5cblx0ICovXG5cdEtleWJvYXJkID0gMixcblxuXHQvKipcblx0ICogQW4gZXhwbGljaXQgc2h1dGRvd24gdmlhIGNvZGUuXG5cdCAqL1xuXHRBcGkgPSAzXG59XG5cbmV4cG9ydCBjbGFzcyBCcm93c2VySG9zdFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUhvc3RTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHdvcmtzcGFjZVByb3ZpZGVyOiBJV29ya3NwYWNlUHJvdmlkZXI7XG5cblx0cHJpdmF0ZSBzaHV0ZG93blJlYXNvbiA9IEhvc3RTaHV0ZG93blJlYXNvbi5Vbmtub3duO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogQnJvd3NlckxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpZiAoZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/LndvcmtzcGFjZVByb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLndvcmtzcGFjZVByb3ZpZGVyID0gZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnMud29ya3NwYWNlUHJvdmlkZXI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMud29ya3NwYWNlUHJvdmlkZXIgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJV29ya3NwYWNlUHJvdmlkZXIge1xuXHRcdFx0XHRyZWFkb25seSB3b3Jrc3BhY2UgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHJlYWRvbmx5IHRydXN0ZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGFzeW5jIG9wZW4oKSB7IHJldHVybiB0cnVlOyB9XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cblx0XHQvLyBWZXRvIHNodXRkb3duIGRlcGVuZGluZyBvbiBgd2luZG93LmNvbmZpcm1CZWZvcmVDbG9zZWAgc2V0dGluZ1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlmZWN5Y2xlU2VydmljZS5vbkJlZm9yZVNodXRkb3duKGUgPT4gdGhpcy5vbkJlZm9yZVNodXRkb3duKGUpKSk7XG5cblx0XHQvLyBUcmFjayBtb2RpZmllciBrZXlzIHRvIGRldGVjdCBrZXliaW5kaW5nIHVzYWdlXG5cdFx0dGhpcy5fcmVnaXN0ZXIoTW9kaWZpZXJLZXlFbWl0dGVyLmdldEluc3RhbmNlKCkuZXZlbnQoKCkgPT4gdGhpcy51cGRhdGVTaHV0ZG93blJlYXNvbkZyb21FdmVudCgpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uQmVmb3JlU2h1dGRvd24oZTogQmVmb3JlU2h1dGRvd25FdmVudCk6IHZvaWQge1xuXG5cdFx0c3dpdGNoICh0aGlzLnNodXRkb3duUmVhc29uKSB7XG5cblx0XHRcdC8vIFVua25vd24gLyBLZXlib2FyZCBzaG93cyB2ZXRvIGRlcGVuZGluZyBvbiBzZXR0aW5nXG5cdFx0XHRjYXNlIEhvc3RTaHV0ZG93blJlYXNvbi5Vbmtub3duOlxuXHRcdFx0Y2FzZSBIb3N0U2h1dGRvd25SZWFzb24uS2V5Ym9hcmQ6IHtcblx0XHRcdFx0Y29uc3QgY29uZmlybUJlZm9yZUNsb3NlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnd2luZG93LmNvbmZpcm1CZWZvcmVDbG9zZScpO1xuXHRcdFx0XHRpZiAoY29uZmlybUJlZm9yZUNsb3NlID09PSAnYWx3YXlzJyB8fCAoY29uZmlybUJlZm9yZUNsb3NlID09PSAna2V5Ym9hcmRPbmx5JyAmJiB0aGlzLnNodXRkb3duUmVhc29uID09PSBIb3N0U2h1dGRvd25SZWFzb24uS2V5Ym9hcmQpKSB7XG5cdFx0XHRcdFx0ZS52ZXRvKHRydWUsICd2ZXRvLmNvbmZpcm1CZWZvcmVDbG9zZScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Ly8gQXBpIG5ldmVyIHNob3dzIHZldG9cblx0XHRcdGNhc2UgSG9zdFNodXRkb3duUmVhc29uLkFwaTpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0Ly8gVW5zZXQgZm9yIG5leHQgc2h1dGRvd25cblx0XHR0aGlzLnNodXRkb3duUmVhc29uID0gSG9zdFNodXRkb3duUmVhc29uLlVua25vd247XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVNodXRkb3duUmVhc29uRnJvbUV2ZW50KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnNodXRkb3duUmVhc29uID09PSBIb3N0U2h1dGRvd25SZWFzb24uQXBpKSB7XG5cdFx0XHRyZXR1cm47IC8vIGRvIG5vdCBvdmVyd3JpdGUgYW55IGV4cGxpY2l0bHkgc2V0IHNodXRkb3duIHJlYXNvblxuXHRcdH1cblxuXHRcdGlmIChNb2RpZmllcktleUVtaXR0ZXIuZ2V0SW5zdGFuY2UoKS5pc01vZGlmaWVyUHJlc3NlZCkge1xuXHRcdFx0dGhpcy5zaHV0ZG93blJlYXNvbiA9IEhvc3RTaHV0ZG93blJlYXNvbi5LZXlib2FyZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zaHV0ZG93blJlYXNvbiA9IEhvc3RTaHV0ZG93blJlYXNvbi5Vbmtub3duO1xuXHRcdH1cblx0fVxuXG5cdC8vI3JlZ2lvbiBGb2N1c1xuXG5cdEBtZW1vaXplXG5cdGdldCBvbkRpZENoYW5nZUZvY3VzKCk6IEV2ZW50PGJvb2xlYW4+IHtcblx0XHRjb25zdCBlbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUob25EaWRSZWdpc3RlcldpbmRvdywgKHsgd2luZG93LCBkaXNwb3NhYmxlcyB9KSA9PiB7XG5cdFx0XHRjb25zdCBmb2N1c1RyYWNrZXIgPSBkaXNwb3NhYmxlcy5hZGQodHJhY2tGb2N1cyh3aW5kb3cpKTtcblx0XHRcdGNvbnN0IHZpc2liaWxpdHlUcmFja2VyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEb21FbWl0dGVyKHdpbmRvdy5kb2N1bWVudCwgJ3Zpc2liaWxpdHljaGFuZ2UnKSk7XG5cblx0XHRcdEV2ZW50LmFueShcblx0XHRcdFx0RXZlbnQubWFwKGZvY3VzVHJhY2tlci5vbkRpZEZvY3VzLCAoKSA9PiB0aGlzLmhhc0ZvY3VzLCBkaXNwb3NhYmxlcyksXG5cdFx0XHRcdEV2ZW50Lm1hcChmb2N1c1RyYWNrZXIub25EaWRCbHVyLCAoKSA9PiB0aGlzLmhhc0ZvY3VzLCBkaXNwb3NhYmxlcyksXG5cdFx0XHRcdEV2ZW50Lm1hcCh2aXNpYmlsaXR5VHJhY2tlci5ldmVudCwgKCkgPT4gdGhpcy5oYXNGb2N1cywgZGlzcG9zYWJsZXMpLFxuXHRcdFx0XHRFdmVudC5tYXAodGhpcy5vbkRpZENoYW5nZUFjdGl2ZVdpbmRvdywgKCkgPT4gdGhpcy5oYXNGb2N1cywgZGlzcG9zYWJsZXMpLFxuXHRcdFx0KShmb2N1cyA9PiBlbWl0dGVyLmZpcmUoZm9jdXMpKTtcblx0XHR9LCB7IHdpbmRvdzogbWFpbldpbmRvdywgZGlzcG9zYWJsZXM6IHRoaXMuX3N0b3JlIH0pKTtcblxuXHRcdHJldHVybiBFdmVudC5sYXRjaChlbWl0dGVyLmV2ZW50LCB1bmRlZmluZWQsIHRoaXMuX3N0b3JlKTtcblx0fVxuXG5cdGdldCBoYXNGb2N1cygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZ2V0QWN0aXZlRG9jdW1lbnQoKS5oYXNGb2N1cygpO1xuXHR9XG5cblx0YXN5bmMgaGFkTGFzdEZvY3VzKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0YXN5bmMgZm9jdXModGFyZ2V0V2luZG93OiBXaW5kb3cpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0YXJnZXRXaW5kb3cuZm9jdXMoKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cblx0Ly8jcmVnaW9uIFdpbmRvd1xuXG5cdEBtZW1vaXplXG5cdGdldCBvbkRpZENoYW5nZUFjdGl2ZVdpbmRvdygpOiBFdmVudDxudW1iZXI+IHtcblx0XHRjb25zdCBlbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8bnVtYmVyPigpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LnJ1bkFuZFN1YnNjcmliZShvbkRpZFJlZ2lzdGVyV2luZG93LCAoeyB3aW5kb3csIGRpc3Bvc2FibGVzIH0pID0+IHtcblx0XHRcdGNvbnN0IHdpbmRvd0lkID0gZ2V0V2luZG93SWQod2luZG93KTtcblxuXHRcdFx0Ly8gRW1pdCB2aWEgZm9jdXMgdHJhY2tpbmdcblx0XHRcdGNvbnN0IGZvY3VzVHJhY2tlciA9IGRpc3Bvc2FibGVzLmFkZCh0cmFja0ZvY3VzKHdpbmRvdykpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IGVtaXR0ZXIuZmlyZSh3aW5kb3dJZCkpKTtcblxuXHRcdFx0Ly8gRW1pdCB2aWEgaW50ZXJ2YWw6IGltbWVkaWF0ZWx5IHdoZW4gb3BlbmluZyBhbiBhdXhpbGlhcnkgd2luZG93LFxuXHRcdFx0Ly8gaXQgaXMgcG9zc2libGUgdGhhdCBkb2N1bWVudCBmb2N1cyBoYXMgbm90IHlldCBjaGFuZ2VkLCBzbyB3ZVxuXHRcdFx0Ly8gcG9sbCBmb3IgYSB3aGlsZSB0byBlbnN1cmUgd2UgY2F0Y2ggdGhlIGV2ZW50LlxuXHRcdFx0aWYgKGlzQXV4aWxpYXJ5V2luZG93KHdpbmRvdykpIHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGRpc3Bvc2FibGVXaW5kb3dJbnRlcnZhbCh3aW5kb3csICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBoYXNGb2N1cyA9IHdpbmRvdy5kb2N1bWVudC5oYXNGb2N1cygpO1xuXHRcdFx0XHRcdGlmIChoYXNGb2N1cykge1xuXHRcdFx0XHRcdFx0ZW1pdHRlci5maXJlKHdpbmRvd0lkKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gaGFzRm9jdXM7XG5cdFx0XHRcdH0sIDEwMCwgMjApKTtcblx0XHRcdH1cblx0XHR9LCB7IHdpbmRvdzogbWFpbldpbmRvdywgZGlzcG9zYWJsZXM6IHRoaXMuX3N0b3JlIH0pKTtcblxuXHRcdHJldHVybiBFdmVudC5sYXRjaChlbWl0dGVyLmV2ZW50LCB1bmRlZmluZWQsIHRoaXMuX3N0b3JlKTtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGdldCBvbkRpZENoYW5nZUZ1bGxTY3JlZW4oKTogRXZlbnQ8eyB3aW5kb3dJZDogbnVtYmVyOyBmdWxsc2NyZWVuOiBib29sZWFuIH0+IHtcblx0XHRjb25zdCBlbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyB3aW5kb3dJZDogbnVtYmVyOyBmdWxsc2NyZWVuOiBib29sZWFuIH0+KCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKG9uRGlkUmVnaXN0ZXJXaW5kb3csICh7IHdpbmRvdywgZGlzcG9zYWJsZXMgfSkgPT4ge1xuXHRcdFx0Y29uc3Qgd2luZG93SWQgPSBnZXRXaW5kb3dJZCh3aW5kb3cpO1xuXHRcdFx0Y29uc3Qgdmlld3BvcnQgPSBpc0lPUyAmJiB3aW5kb3cudmlzdWFsVmlld3BvcnQgPyB3aW5kb3cudmlzdWFsVmlld3BvcnQgLyoqIFZpc3VhbCB2aWV3cG9ydCAqLyA6IHdpbmRvdyAvKiogTGF5b3V0IHZpZXdwb3J0ICovO1xuXG5cdFx0XHQvLyBGdWxsc2NyZWVuIChCcm93c2VyKVxuXHRcdFx0Zm9yIChjb25zdCBldmVudCBvZiBbRXZlbnRUeXBlLkZVTExTQ1JFRU5fQ0hBTkdFLCBFdmVudFR5cGUuV0tfRlVMTFNDUkVFTl9DSEFOR0VdKSB7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LmRvY3VtZW50LCBldmVudCwgKCkgPT4gZW1pdHRlci5maXJlKHsgd2luZG93SWQsIGZ1bGxzY3JlZW46ICEhZGV0ZWN0RnVsbHNjcmVlbih3aW5kb3cpIH0pKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZ1bGxzY3JlZW4gKE5hdGl2ZSlcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlVGhyb3R0bGVkTGlzdGVuZXIodmlld3BvcnQsIEV2ZW50VHlwZS5SRVNJWkUsICgpID0+IGVtaXR0ZXIuZmlyZSh7IHdpbmRvd0lkLCBmdWxsc2NyZWVuOiAhIWRldGVjdEZ1bGxzY3JlZW4od2luZG93KSB9KSwgdW5kZWZpbmVkLCBpc01hY2ludG9zaCA/IDIwMDAgLyogYWRqdXN0IGZvciBtYWNPUyBhbmltYXRpb24gKi8gOiA4MDAgLyogY2FuIGJlIHRocm90dGxlZCAqLykpO1xuXHRcdH0sIHsgd2luZG93OiBtYWluV2luZG93LCBkaXNwb3NhYmxlczogdGhpcy5fc3RvcmUgfSkpO1xuXG5cdFx0cmV0dXJuIGVtaXR0ZXIuZXZlbnQ7XG5cdH1cblxuXHRvcGVuV2luZG93KG9wdGlvbnM/OiBJT3BlbkVtcHR5V2luZG93T3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdG9wZW5XaW5kb3codG9PcGVuOiBJV2luZG93T3BlbmFibGVbXSwgb3B0aW9ucz86IElPcGVuV2luZG93T3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdG9wZW5XaW5kb3coYXJnMT86IElPcGVuRW1wdHlXaW5kb3dPcHRpb25zIHwgSVdpbmRvd09wZW5hYmxlW10sIGFyZzI/OiBJT3BlbldpbmRvd09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShhcmcxKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9PcGVuV2luZG93KGFyZzEsIGFyZzIpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmRvT3BlbkVtcHR5V2luZG93KGFyZzEpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb09wZW5XaW5kb3codG9PcGVuOiBJV2luZG93T3BlbmFibGVbXSwgb3B0aW9ucz86IElPcGVuV2luZG93T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHBheWxvYWQgPSB0aGlzLnByZXNlcnZlUGF5bG9hZChmYWxzZSAvKiBub3QgYW4gZW1wdHkgd2luZG93ICovLCBvcHRpb25zKTtcblx0XHRjb25zdCBmaWxlT3BlbmFibGVzOiBJRmlsZVRvT3BlbltdID0gW107XG5cblx0XHRjb25zdCBmb2xkZXJzVG9BZGQ6IElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGFbXSA9IFtdO1xuXHRcdGNvbnN0IGZvbGRlcnNUb1JlbW92ZTogVVJJW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3Qgb3BlbmFibGUgb2YgdG9PcGVuKSB7XG5cdFx0XHRvcGVuYWJsZS5sYWJlbCA9IG9wZW5hYmxlLmxhYmVsIHx8IHRoaXMuZ2V0UmVjZW50TGFiZWwob3BlbmFibGUpO1xuXG5cdFx0XHQvLyBGb2xkZXJcblx0XHRcdGlmIChpc0ZvbGRlclRvT3BlbihvcGVuYWJsZSkpIHtcblx0XHRcdFx0aWYgKG9wdGlvbnM/LmFkZE1vZGUpIHtcblx0XHRcdFx0XHRmb2xkZXJzVG9BZGQucHVzaCh7IHVyaTogb3BlbmFibGUuZm9sZGVyVXJpIH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG9wdGlvbnM/LnJlbW92ZU1vZGUpIHtcblx0XHRcdFx0XHRmb2xkZXJzVG9SZW1vdmUucHVzaChvcGVuYWJsZS5mb2xkZXJVcmkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuZG9PcGVuKHsgZm9sZGVyVXJpOiBvcGVuYWJsZS5mb2xkZXJVcmkgfSwgeyByZXVzZTogdGhpcy5zaG91bGRSZXVzZShvcHRpb25zLCBmYWxzZSAvKiBubyBmaWxlICovKSwgcGF5bG9hZCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBXb3Jrc3BhY2Vcblx0XHRcdGVsc2UgaWYgKGlzV29ya3NwYWNlVG9PcGVuKG9wZW5hYmxlKSkge1xuXHRcdFx0XHR0aGlzLmRvT3Blbih7IHdvcmtzcGFjZVVyaTogb3BlbmFibGUud29ya3NwYWNlVXJpIH0sIHsgcmV1c2U6IHRoaXMuc2hvdWxkUmV1c2Uob3B0aW9ucywgZmFsc2UgLyogbm8gZmlsZSAqLyksIHBheWxvYWQgfSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZpbGUgKGhhbmRsZWQgbGF0ZXIgaW4gYnVsaylcblx0XHRcdGVsc2UgaWYgKGlzRmlsZVRvT3BlbihvcGVuYWJsZSkpIHtcblx0XHRcdFx0ZmlsZU9wZW5hYmxlcy5wdXNoKG9wZW5hYmxlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgRm9sZGVycyB0byBhZGQgb3IgcmVtb3ZlXG5cdFx0aWYgKGZvbGRlcnNUb0FkZC5sZW5ndGggPiAwIHx8IGZvbGRlcnNUb1JlbW92ZS5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLndpdGhTZXJ2aWNlcyhhc3luYyBhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdGNvbnN0IHdvcmtzcGFjZUVkaXRpbmdTZXJ2aWNlOiBJV29ya3NwYWNlRWRpdGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUVkaXRpbmdTZXJ2aWNlKTtcblx0XHRcdFx0aWYgKGZvbGRlcnNUb0FkZC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0YXdhaXQgd29ya3NwYWNlRWRpdGluZ1NlcnZpY2UuYWRkRm9sZGVycyhmb2xkZXJzVG9BZGQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGZvbGRlcnNUb1JlbW92ZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0YXdhaXQgd29ya3NwYWNlRWRpdGluZ1NlcnZpY2UucmVtb3ZlRm9sZGVycyhmb2xkZXJzVG9SZW1vdmUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgRmlsZXNcblx0XHRpZiAoZmlsZU9wZW5hYmxlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLndpdGhTZXJ2aWNlcyhhc3luYyBhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0XHRcdC8vIFN1cHBvcnQgbWVyZ2VNb2RlXG5cdFx0XHRcdGlmIChvcHRpb25zPy5tZXJnZU1vZGUgJiYgZmlsZU9wZW5hYmxlcy5sZW5ndGggPT09IDQpIHtcblx0XHRcdFx0XHRjb25zdCBlZGl0b3JzID0gY29hbGVzY2UoYXdhaXQgcGF0aHNUb0VkaXRvcnMoZmlsZU9wZW5hYmxlcywgdGhpcy5maWxlU2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlKSk7XG5cdFx0XHRcdFx0aWYgKGVkaXRvcnMubGVuZ3RoICE9PSA0IHx8ICFpc1Jlc291cmNlRWRpdG9ySW5wdXQoZWRpdG9yc1swXSkgfHwgIWlzUmVzb3VyY2VFZGl0b3JJbnB1dChlZGl0b3JzWzFdKSB8fCAhaXNSZXNvdXJjZUVkaXRvcklucHV0KGVkaXRvcnNbMl0pIHx8ICFpc1Jlc291cmNlRWRpdG9ySW5wdXQoZWRpdG9yc1szXSkpIHtcblx0XHRcdFx0XHRcdHJldHVybjsgLy8gaW52YWxpZCByZXNvdXJjZXNcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBTYW1lIFdpbmRvdzogb3BlbiB2aWEgZWRpdG9yIHNlcnZpY2UgaW4gY3VycmVudCB3aW5kb3dcblx0XHRcdFx0XHRpZiAodGhpcy5zaG91bGRSZXVzZShvcHRpb25zLCB0cnVlIC8qIGZpbGUgKi8pKSB7XG5cdFx0XHRcdFx0XHRlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRcdFx0XHRpbnB1dDE6IHsgcmVzb3VyY2U6IGVkaXRvcnNbMF0ucmVzb3VyY2UgfSxcblx0XHRcdFx0XHRcdFx0aW5wdXQyOiB7IHJlc291cmNlOiBlZGl0b3JzWzFdLnJlc291cmNlIH0sXG5cdFx0XHRcdFx0XHRcdGJhc2U6IHsgcmVzb3VyY2U6IGVkaXRvcnNbMl0ucmVzb3VyY2UgfSxcblx0XHRcdFx0XHRcdFx0cmVzdWx0OiB7IHJlc291cmNlOiBlZGl0b3JzWzNdLnJlc291cmNlIH0sXG5cdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIE5ldyBXaW5kb3c6IG9wZW4gaW50byBlbXB0eSB3aW5kb3dcblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IGVudmlyb25tZW50ID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRcdFx0XHRcdGVudmlyb25tZW50LnNldCgnbWVyZ2VGaWxlMScsIGVkaXRvcnNbMF0ucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0XHRlbnZpcm9ubWVudC5zZXQoJ21lcmdlRmlsZTInLCBlZGl0b3JzWzFdLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRcdFx0ZW52aXJvbm1lbnQuc2V0KCdtZXJnZUZpbGVCYXNlJywgZWRpdG9yc1syXS5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0XHRcdGVudmlyb25tZW50LnNldCgnbWVyZ2VGaWxlUmVzdWx0JywgZWRpdG9yc1szXS5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdFx0XHRcdFx0dGhpcy5kb09wZW4odW5kZWZpbmVkLCB7IHBheWxvYWQ6IEFycmF5LmZyb20oZW52aXJvbm1lbnQuZW50cmllcygpKSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTdXBwb3J0IGRpZmZNb2RlXG5cdFx0XHRcdGVsc2UgaWYgKG9wdGlvbnM/LmRpZmZNb2RlICYmIGZpbGVPcGVuYWJsZXMubGVuZ3RoID09PSAyKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdG9ycyA9IGNvYWxlc2NlKGF3YWl0IHBhdGhzVG9FZGl0b3JzKGZpbGVPcGVuYWJsZXMsIHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSkpO1xuXHRcdFx0XHRcdGlmIChlZGl0b3JzLmxlbmd0aCAhPT0gMiB8fCAhaXNSZXNvdXJjZUVkaXRvcklucHV0KGVkaXRvcnNbMF0pIHx8ICFpc1Jlc291cmNlRWRpdG9ySW5wdXQoZWRpdG9yc1sxXSkpIHtcblx0XHRcdFx0XHRcdHJldHVybjsgLy8gaW52YWxpZCByZXNvdXJjZXNcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBTYW1lIFdpbmRvdzogb3BlbiB2aWEgZWRpdG9yIHNlcnZpY2UgaW4gY3VycmVudCB3aW5kb3dcblx0XHRcdFx0XHRpZiAodGhpcy5zaG91bGRSZXVzZShvcHRpb25zLCB0cnVlIC8qIGZpbGUgKi8pKSB7XG5cdFx0XHRcdFx0XHRlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRcdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogZWRpdG9yc1swXS5yZXNvdXJjZSB9LFxuXHRcdFx0XHRcdFx0XHRtb2RpZmllZDogeyByZXNvdXJjZTogZWRpdG9yc1sxXS5yZXNvdXJjZSB9LFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBOZXcgV2luZG93OiBvcGVuIGludG8gZW1wdHkgd2luZG93XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBlbnZpcm9ubWVudCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0XHRcdFx0XHRlbnZpcm9ubWVudC5zZXQoJ2RpZmZGaWxlU2Vjb25kYXJ5JywgZWRpdG9yc1swXS5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0XHRcdGVudmlyb25tZW50LnNldCgnZGlmZkZpbGVQcmltYXJ5JywgZWRpdG9yc1sxXS5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdFx0XHRcdFx0dGhpcy5kb09wZW4odW5kZWZpbmVkLCB7IHBheWxvYWQ6IEFycmF5LmZyb20oZW52aXJvbm1lbnQuZW50cmllcygpKSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBKdXN0IG9wZW4gbm9ybWFsbHlcblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBvcGVuYWJsZSBvZiBmaWxlT3BlbmFibGVzKSB7XG5cblx0XHRcdFx0XHRcdC8vIFNhbWUgV2luZG93OiBvcGVuIHZpYSBlZGl0b3Igc2VydmljZSBpbiBjdXJyZW50IHdpbmRvd1xuXHRcdFx0XHRcdFx0aWYgKHRoaXMuc2hvdWxkUmV1c2Uob3B0aW9ucywgdHJ1ZSAvKiBmaWxlICovKSkge1xuXHRcdFx0XHRcdFx0XHRsZXQgb3BlbmFibGVzOiBJUGF0aERhdGE8SVRleHRFZGl0b3JPcHRpb25zPltdID0gW107XG5cblx0XHRcdFx0XHRcdFx0Ly8gU3VwcG9ydDogLS1nb3RvIHBhcmFtZXRlciB0byBvcGVuIG9uIGxpbmUvY29sXG5cdFx0XHRcdFx0XHRcdGlmIChvcHRpb25zPy5nb3RvTGluZU1vZGUpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBwYXRoQ29sdW1uQXdhcmUgPSBwYXJzZUxpbmVBbmRDb2x1bW5Bd2FyZShvcGVuYWJsZS5maWxlVXJpLnBhdGgpO1xuXHRcdFx0XHRcdFx0XHRcdG9wZW5hYmxlcyA9IFt7XG5cdFx0XHRcdFx0XHRcdFx0XHRmaWxlVXJpOiBvcGVuYWJsZS5maWxlVXJpLndpdGgoeyBwYXRoOiBwYXRoQ29sdW1uQXdhcmUucGF0aCB9KSxcblx0XHRcdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0c2VsZWN0aW9uOiAhaXNVbmRlZmluZWQocGF0aENvbHVtbkF3YXJlLmxpbmUpID8geyBzdGFydExpbmVOdW1iZXI6IHBhdGhDb2x1bW5Bd2FyZS5saW5lLCBzdGFydENvbHVtbjogcGF0aENvbHVtbkF3YXJlLmNvbHVtbiB8fCAxIH0gOiB1bmRlZmluZWRcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRvcGVuYWJsZXMgPSBbb3BlbmFibGVdO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0ZWRpdG9yU2VydmljZS5vcGVuRWRpdG9ycyhjb2FsZXNjZShhd2FpdCBwYXRoc1RvRWRpdG9ycyhvcGVuYWJsZXMsIHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSkpLCB1bmRlZmluZWQsIHsgdmFsaWRhdGVUcnVzdDogdHJ1ZSB9KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gTmV3IFdpbmRvdzogb3BlbiBpbnRvIGVtcHR5IHdpbmRvd1xuXHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGVudmlyb25tZW50ID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRcdFx0XHRcdFx0ZW52aXJvbm1lbnQuc2V0KCdvcGVuRmlsZScsIG9wZW5hYmxlLmZpbGVVcmkudG9TdHJpbmcoKSk7XG5cblx0XHRcdFx0XHRcdFx0aWYgKG9wdGlvbnM/LmdvdG9MaW5lTW9kZSkge1xuXHRcdFx0XHRcdFx0XHRcdGVudmlyb25tZW50LnNldCgnZ290b0xpbmVNb2RlJywgJ3RydWUnKTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHRoaXMuZG9PcGVuKHVuZGVmaW5lZCwgeyBwYXlsb2FkOiBBcnJheS5mcm9tKGVudmlyb25tZW50LmVudHJpZXMoKSkgfSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gU3VwcG9ydCB3YWl0IG1vZGVcblx0XHRcdFx0Y29uc3Qgd2FpdE1hcmtlckZpbGVVUkkgPSBvcHRpb25zPy53YWl0TWFya2VyRmlsZVVSSTtcblx0XHRcdFx0aWYgKHdhaXRNYXJrZXJGaWxlVVJJKSB7XG5cdFx0XHRcdFx0KGFzeW5jICgpID0+IHtcblxuXHRcdFx0XHRcdFx0Ly8gV2FpdCBmb3IgdGhlIHJlc291cmNlcyB0byBiZSBjbG9zZWQgaW4gdGhlIHRleHQgZWRpdG9yLi4uXG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHdoZW5FZGl0b3JDbG9zZWQoYWNjZXNzb3IsIGZpbGVPcGVuYWJsZXMubWFwKGZpbGVPcGVuYWJsZSA9PiBmaWxlT3BlbmFibGUuZmlsZVVyaSkpKTtcblxuXHRcdFx0XHRcdFx0Ly8gLi4uYmVmb3JlIGRlbGV0aW5nIHRoZSB3YWl0IG1hcmtlciBmaWxlXG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmRlbCh3YWl0TWFya2VyRmlsZVVSSSk7XG5cdFx0XHRcdFx0fSkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB3aXRoU2VydmljZXMoZm46IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4gdW5rbm93bik6IHZvaWQge1xuXHRcdC8vIEhvc3Qgc2VydmljZSBpcyB1c2VkIGluIGEgbG90IG9mIGNvbnRleHRzIGFuZCBzb21lIHNlcnZpY2VzXG5cdFx0Ly8gbmVlZCB0byBiZSByZXNvbHZlZCBkeW5hbWljYWxseSB0byBhdm9pZCBjeWNsaWMgZGVwZW5kZW5jaWVzXG5cdFx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDg1MjIpXG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBmbihhY2Nlc3NvcikpO1xuXHR9XG5cblx0cHJpdmF0ZSBwcmVzZXJ2ZVBheWxvYWQoaXNFbXB0eVdpbmRvdzogYm9vbGVhbiwgb3B0aW9ucz86IElPcGVuV2luZG93T3B0aW9ucyk6IEFycmF5PHVua25vd24+IHwgdW5kZWZpbmVkIHtcblxuXHRcdC8vIFNlbGVjdGl2ZWx5IGNvcHkgcGF5bG9hZDogZm9yIG5vdyBvbmx5IGV4dGVuc2lvbiBkZWJ1Z2dpbmcgcHJvcGVydGllcyBhcmUgY29uc2lkZXJlZFxuXHRcdGNvbnN0IG5ld1BheWxvYWQ6IEFycmF5PHVua25vd24+ID0gbmV3IEFycmF5KCk7XG5cdFx0aWYgKCFpc0VtcHR5V2luZG93ICYmIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25VUkkpIHtcblx0XHRcdG5ld1BheWxvYWQucHVzaChbJ2V4dGVuc2lvbkRldmVsb3BtZW50UGF0aCcsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25VUkkudG9TdHJpbmcoKV0pO1xuXG5cdFx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZGVidWdFeHRlbnNpb25Ib3N0LmRlYnVnSWQpIHtcblx0XHRcdFx0bmV3UGF5bG9hZC5wdXNoKFsnZGVidWdJZCcsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmRlYnVnRXh0ZW5zaW9uSG9zdC5kZWJ1Z0lkXSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5kZWJ1Z0V4dGVuc2lvbkhvc3QucG9ydCkge1xuXHRcdFx0XHRuZXdQYXlsb2FkLnB1c2goWydpbnNwZWN0LWJyay1leHRlbnNpb25zJywgU3RyaW5nKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmRlYnVnRXh0ZW5zaW9uSG9zdC5wb3J0KV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG5ld1dpbmRvd1Byb2ZpbGUgPSBvcHRpb25zPy5mb3JjZVByb2ZpbGVcblx0XHRcdD8gdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcy5maW5kKHByb2ZpbGUgPT4gcHJvZmlsZS5uYW1lID09PSBvcHRpb25zPy5mb3JjZVByb2ZpbGUpXG5cdFx0XHQ6IHVuZGVmaW5lZDtcblx0XHRpZiAobmV3V2luZG93UHJvZmlsZSAmJiAhbmV3V2luZG93UHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdG5ld1BheWxvYWQucHVzaChbJ3Byb2ZpbGUnLCBuZXdXaW5kb3dQcm9maWxlLm5hbWVdKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3UGF5bG9hZC5sZW5ndGggPyBuZXdQYXlsb2FkIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRSZWNlbnRMYWJlbChvcGVuYWJsZTogSVdpbmRvd09wZW5hYmxlKTogc3RyaW5nIHtcblx0XHRpZiAoaXNGb2xkZXJUb09wZW4ob3BlbmFibGUpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0V29ya3NwYWNlTGFiZWwob3BlbmFibGUuZm9sZGVyVXJpLCB7IHZlcmJvc2U6IFZlcmJvc2l0eS5MT05HIH0pO1xuXHRcdH1cblxuXHRcdGlmIChpc1dvcmtzcGFjZVRvT3BlbihvcGVuYWJsZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmxhYmVsU2VydmljZS5nZXRXb3Jrc3BhY2VMYWJlbChnZXRXb3Jrc3BhY2VJZGVudGlmaWVyKG9wZW5hYmxlLndvcmtzcGFjZVVyaSksIHsgdmVyYm9zZTogVmVyYm9zaXR5LkxPTkcgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKG9wZW5hYmxlLmZpbGVVcmksIHsgYXBwZW5kV29ya3NwYWNlU3VmZml4OiB0cnVlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG91bGRSZXVzZShvcHRpb25zOiBJT3BlbldpbmRvd09wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpLCBpc0ZpbGU6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRpZiAob3B0aW9ucy53YWl0TWFya2VyRmlsZVVSSSkge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIGFsd2F5cyBoYW5kbGUgLS13YWl0IGluIHNhbWUgd2luZG93XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2luZG93Q29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJV2luZG93U2V0dGluZ3MgfCB1bmRlZmluZWQ+KCd3aW5kb3cnKTtcblx0XHRjb25zdCBvcGVuSW5OZXdXaW5kb3dDb25maWcgPSBpc0ZpbGUgPyAod2luZG93Q29uZmlnPy5vcGVuRmlsZXNJbk5ld1dpbmRvdyB8fCAnb2ZmJyAvKiBkZWZhdWx0ICovKSA6ICh3aW5kb3dDb25maWc/Lm9wZW5Gb2xkZXJzSW5OZXdXaW5kb3cgfHwgJ2RlZmF1bHQnIC8qIGRlZmF1bHQgKi8pO1xuXG5cdFx0bGV0IG9wZW5Jbk5ld1dpbmRvdyA9IChvcHRpb25zLnByZWZlck5ld1dpbmRvdyB8fCAhIW9wdGlvbnMuZm9yY2VOZXdXaW5kb3cpICYmICFvcHRpb25zLmZvcmNlUmV1c2VXaW5kb3c7XG5cdFx0aWYgKCFvcHRpb25zLmZvcmNlTmV3V2luZG93ICYmICFvcHRpb25zLmZvcmNlUmV1c2VXaW5kb3cgJiYgKG9wZW5Jbk5ld1dpbmRvd0NvbmZpZyA9PT0gJ29uJyB8fCBvcGVuSW5OZXdXaW5kb3dDb25maWcgPT09ICdvZmYnKSkge1xuXHRcdFx0b3BlbkluTmV3V2luZG93ID0gKG9wZW5Jbk5ld1dpbmRvd0NvbmZpZyA9PT0gJ29uJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICFvcGVuSW5OZXdXaW5kb3c7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvT3BlbkVtcHR5V2luZG93KG9wdGlvbnM/OiBJT3BlbkVtcHR5V2luZG93T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmRvT3Blbih1bmRlZmluZWQsIHtcblx0XHRcdHJldXNlOiBvcHRpb25zPy5mb3JjZVJldXNlV2luZG93LFxuXHRcdFx0cGF5bG9hZDogdGhpcy5wcmVzZXJ2ZVBheWxvYWQodHJ1ZSAvKiBlbXB0eSB3aW5kb3cgKi8sIG9wdGlvbnMpXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvT3Blbih3b3Jrc3BhY2U6IElXb3Jrc3BhY2UsIG9wdGlvbnM/OiB7IHJldXNlPzogYm9vbGVhbjsgcGF5bG9hZD86IG9iamVjdCB9KTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBXaGVuIHdlIGFyZSBpbiBhIHRlbXBvcmFyeSB3b3Jrc3BhY2UgYW5kIGFyZSBhc2tlZCB0byBvcGVuIGEgbG9jYWwgZm9sZGVyXG5cdFx0Ly8gd2Ugc3dhcCB0aGF0IGZvbGRlciBpbnRvIHRoZSB3b3Jrc3BhY2UgdG8gYXZvaWQgYSB3aW5kb3cgcmVsb2FkLiBBY2Nlc3Ncblx0XHQvLyB0byBsb2NhbCByZXNvdXJjZXMgaXMgb25seSBwb3NzaWJsZSB3aXRob3V0IGEgd2luZG93IHJlbG9hZCBiZWNhdXNlIGl0XG5cdFx0Ly8gbmVlZHMgdXNlciBhY3RpdmF0aW9uLlxuXHRcdGlmICh3b3Jrc3BhY2UgJiYgaXNGb2xkZXJUb09wZW4od29ya3NwYWNlKSAmJiB3b3Jrc3BhY2UuZm9sZGVyVXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlICYmIGlzVGVtcG9yYXJ5V29ya3NwYWNlKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpKSB7XG5cdFx0XHR0aGlzLndpdGhTZXJ2aWNlcyhhc3luYyBhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdGNvbnN0IHdvcmtzcGFjZUVkaXRpbmdTZXJ2aWNlOiBJV29ya3NwYWNlRWRpdGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUVkaXRpbmdTZXJ2aWNlKTtcblxuXHRcdFx0XHRhd2FpdCB3b3Jrc3BhY2VFZGl0aW5nU2VydmljZS51cGRhdGVGb2xkZXJzKDAsIHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5sZW5ndGgsIFt7IHVyaTogd29ya3NwYWNlLmZvbGRlclVyaSB9XSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFdlIGtub3cgdGhhdCBgd29ya3NwYWNlUHJvdmlkZXIub3BlbmAgd2lsbCB0cmlnZ2VyIGEgc2h1dGRvd25cblx0XHQvLyB3aXRoIGBvcHRpb25zLnJldXNlYCBzbyB3ZSBoYW5kbGUgdGhpcyBleHBlY3RlZCBzaHV0ZG93blxuXHRcdGlmIChvcHRpb25zPy5yZXVzZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5oYW5kbGVFeHBlY3RlZFNodXRkb3duKFNodXRkb3duUmVhc29uLkxPQUQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wZW5lZCA9IGF3YWl0IHRoaXMud29ya3NwYWNlUHJvdmlkZXIub3Blbih3b3Jrc3BhY2UsIG9wdGlvbnMpO1xuXHRcdGlmICghb3BlbmVkKSB7XG5cdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHR0eXBlOiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgndW5hYmxlVG9PcGVuRXh0ZXJuYWwnLCBcIlRoZSBicm93c2VyIGludGVycnVwdGVkIHRoZSBvcGVuaW5nIG9mIGEgbmV3IHRhYiBvciB3aW5kb3cuIFByZXNzICdPcGVuJyB0byBvcGVuIGl0IGFueXdheS5cIiksXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnb3BlbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk9wZW5cIilcblx0XHRcdH0pO1xuXHRcdFx0aWYgKGNvbmZpcm1lZCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZVByb3ZpZGVyLm9wZW4od29ya3NwYWNlLCBvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhc3luYyB0b2dnbGVGdWxsU2NyZWVuKHRhcmdldFdpbmRvdzogV2luZG93KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gdGhpcy5sYXlvdXRTZXJ2aWNlLmdldENvbnRhaW5lcih0YXJnZXRXaW5kb3cpO1xuXG5cdFx0Ly8gQ2hyb21pdW1cblx0XHRpZiAodGFyZ2V0V2luZG93LmRvY3VtZW50LmZ1bGxzY3JlZW4gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKCF0YXJnZXRXaW5kb3cuZG9jdW1lbnQuZnVsbHNjcmVlbikge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJldHVybiBhd2FpdCB0YXJnZXQucmVxdWVzdEZ1bGxzY3JlZW4oKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybigndG9nZ2xlRnVsbFNjcmVlbigpOiByZXF1ZXN0RnVsbHNjcmVlbiBmYWlsZWQnKTsgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0VsZW1lbnQvcmVxdWVzdEZ1bGxzY3JlZW5cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgdGFyZ2V0V2luZG93LmRvY3VtZW50LmV4aXRGdWxsc2NyZWVuKCk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oJ3RvZ2dsZUZ1bGxTY3JlZW4oKTogZXhpdEZ1bGxzY3JlZW4gZmFpbGVkJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTYWZhcmkgYW5kIEVkZ2UgMTQgYXJlIGFsbCB1c2luZyB3ZWJraXQgcHJlZml4XG5cdFx0aWYgKCg8YW55PnRhcmdldFdpbmRvdy5kb2N1bWVudCkud2Via2l0SXNGdWxsU2NyZWVuICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlmICghKDxhbnk+dGFyZ2V0V2luZG93LmRvY3VtZW50KS53ZWJraXRJc0Z1bGxTY3JlZW4pIHtcblx0XHRcdFx0XHQoPGFueT50YXJnZXQpLndlYmtpdFJlcXVlc3RGdWxsc2NyZWVuKCk7IC8vIGl0J3MgYXN5bmMsIGJ1dCBkb2Vzbid0IHJldHVybiBhIHJlYWwgcHJvbWlzZS5cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQoPGFueT50YXJnZXRXaW5kb3cuZG9jdW1lbnQpLndlYmtpdEV4aXRGdWxsc2NyZWVuKCk7IC8vIGl0J3MgYXN5bmMsIGJ1dCBkb2Vzbid0IHJldHVybiBhIHJlYWwgcHJvbWlzZS5cblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKCd0b2dnbGVGdWxsU2NyZWVuKCk6IHJlcXVlc3RGdWxsc2NyZWVuL2V4aXRGdWxsc2NyZWVuIGZhaWxlZCcpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIG1vdmVUb3AodGFyZ2V0V2luZG93OiBXaW5kb3cpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBUaGVyZSBzZWVtcyB0byBiZSBubyBBUEkgdG8gYnJpbmcgYSB3aW5kb3cgdG8gZnJvbnQgaW4gYnJvd3NlcnNcblx0fVxuXG5cdGFzeW5jIGdldEN1cnNvclNjcmVlblBvaW50KCk6IFByb21pc2U8dW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBMaWZlY3ljbGVcblxuXHRhc3luYyByZXN0YXJ0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMucmVsb2FkKCk7XG5cdH1cblxuXHRhc3luYyByZWxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5oYW5kbGVFeHBlY3RlZFNodXRkb3duKFNodXRkb3duUmVhc29uLlJFTE9BRCk7XG5cblx0XHRtYWluV2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xuXHR9XG5cblx0YXN5bmMgY2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5oYW5kbGVFeHBlY3RlZFNodXRkb3duKFNodXRkb3duUmVhc29uLkNMT1NFKTtcblxuXHRcdG1haW5XaW5kb3cuY2xvc2UoKTtcblx0fVxuXG5cdGFzeW5jIHdpdGhFeHBlY3RlZFNodXRkb3duPFQ+KGV4cGVjdGVkU2h1dGRvd25UYXNrOiAoKSA9PiBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG5cdFx0Y29uc3QgcHJldmlvdXNTaHV0ZG93blJlYXNvbiA9IHRoaXMuc2h1dGRvd25SZWFzb247XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuc2h1dGRvd25SZWFzb24gPSBIb3N0U2h1dGRvd25SZWFzb24uQXBpO1xuXHRcdFx0cmV0dXJuIGF3YWl0IGV4cGVjdGVkU2h1dGRvd25UYXNrKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuc2h1dGRvd25SZWFzb24gPSBwcmV2aW91c1NodXRkb3duUmVhc29uO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlRXhwZWN0ZWRTaHV0ZG93bihyZWFzb246IFNodXRkb3duUmVhc29uKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBVcGRhdGUgc2h1dGRvd24gcmVhc29uIGluIGEgd2F5IHRoYXQgd2UgZG9cblx0XHQvLyBub3Qgc2hvdyBhIGRpYWxvZyBiZWNhdXNlIHRoaXMgaXMgYSBleHBlY3RlZFxuXHRcdC8vIHNodXRkb3duLlxuXHRcdHRoaXMuc2h1dGRvd25SZWFzb24gPSBIb3N0U2h1dGRvd25SZWFzb24uQXBpO1xuXG5cdFx0Ly8gU2lnbmFsIHNodXRkb3duIHJlYXNvbiB0byBsaWZlY3ljbGVcblx0XHRyZXR1cm4gdGhpcy5saWZlY3ljbGVTZXJ2aWNlLndpdGhFeHBlY3RlZFNodXRkb3duKHJlYXNvbik7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gU2NyZWVuc2hvdHNcblxuXHRhc3luYyBnZXRTY3JlZW5zaG90KCk6IFByb21pc2U8QXJyYXlCdWZmZXJMaWtlIHwgdW5kZWZpbmVkPiB7XG5cdFx0Ly8gR2V0cyBhIHNjcmVlbnNob3QgZnJvbSB0aGUgYnJvd3Nlci4gVGhpcyBnZXRzIHRoZSBzY3JlZW5zaG90IHZpYSB0aGUgYnJvd3NlcidzIGRpc3BsYXlcblx0XHQvLyBtZWRpYSBBUEkgd2hpY2ggd2lsbCB0eXBpY2FsbHkgb2ZmZXIgYSBwaWNrZXIgb2YgYWxsIGF2YWlsYWJsZSBzY3JlZW5zIGFuZCB3aW5kb3dzIGZvclxuXHRcdC8vIHRoZSB1c2VyIHRvIHNlbGVjdC4gVXNpbmcgdGhlIHZpZGVvIHN0cmVhbSBwcm92aWRlZCBieSB0aGUgZGlzcGxheSBtZWRpYSBBUEksIHRoaXMgd2lsbFxuXHRcdC8vIGNhcHR1cmUgYSBzaW5nbGUgZnJhbWUgb2YgdGhlIHZpZGVvIGFuZCBjb252ZXJ0IGl0IHRvIGEgSlBFRyBpbWFnZS5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdC8vIENyZWF0ZSBhIHZpZGVvIGVsZW1lbnQgdG8gcGxheSB0aGUgY2FwdHVyZWQgc2NyZWVuIHNvdXJjZVxuXHRcdGNvbnN0IHZpZGVvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndmlkZW8nKTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHZpZGVvLnJlbW92ZSgpKSk7XG5cdFx0bGV0IHN0cmVhbTogTWVkaWFTdHJlYW0gfCB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIENyZWF0ZSBhIHN0cmVhbSBmcm9tIHRoZSBzY3JlZW4gc291cmNlIChjYXB0dXJlIHNjcmVlbiB3aXRob3V0IGF1ZGlvKVxuXHRcdFx0c3RyZWFtID0gYXdhaXQgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXREaXNwbGF5TWVkaWEoe1xuXHRcdFx0XHRhdWRpbzogZmFsc2UsXG5cdFx0XHRcdHZpZGVvOiB0cnVlXG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gU2V0IHRoZSBzdHJlYW0gYXMgdGhlIHNvdXJjZSBvZiB0aGUgdmlkZW8gZWxlbWVudFxuXHRcdFx0dmlkZW8uc3JjT2JqZWN0ID0gc3RyZWFtO1xuXHRcdFx0dmlkZW8ucGxheSgpO1xuXG5cdFx0XHQvLyBXYWl0IGZvciB0aGUgdmlkZW8gdG8gbG9hZCBwcm9wZXJseSBiZWZvcmUgY2FwdHVyaW5nIHRoZSBzY3JlZW5zaG90XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRcdG5ldyBQcm9taXNlPHZvaWQ+KHIgPT4gc3RvcmUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih2aWRlbywgJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4gcigpKSkpLFxuXHRcdFx0XHRuZXcgUHJvbWlzZTx2b2lkPihyID0+IHN0b3JlLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodmlkZW8sICdjYW5wbGF5dGhyb3VnaCcsICgpID0+IHIoKSkpKVxuXHRcdFx0XSk7XG5cblx0XHRcdGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXHRcdFx0Y2FudmFzLndpZHRoID0gdmlkZW8udmlkZW9XaWR0aDtcblx0XHRcdGNhbnZhcy5oZWlnaHQgPSB2aWRlby52aWRlb0hlaWdodDtcblxuXHRcdFx0Y29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cdFx0XHRpZiAoIWN0eCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBEcmF3IHRoZSBwb3J0aW9uIG9mIHRoZSB2aWRlbyAoeCwgeSkgd2l0aCB0aGUgc3BlY2lmaWVkIHdpZHRoIGFuZCBoZWlnaHRcblx0XHRcdGN0eC5kcmF3SW1hZ2UodmlkZW8sIDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG5cblx0XHRcdC8vIENvbnZlcnQgdGhlIGNhbnZhcyB0byBhIEJsb2IgKEpQRUcgZm9ybWF0KSwgdXNlIC45NSBmb3IgcXVhbGl0eVxuXHRcdFx0Y29uc3QgYmxvYjogQmxvYiB8IG51bGwgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gY2FudmFzLnRvQmxvYigoYmxvYikgPT4gcmVzb2x2ZShibG9iKSwgJ2ltYWdlL2pwZWcnLCAwLjk1KSk7XG5cdFx0XHRpZiAoIWJsb2IpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gY3JlYXRlIGJsb2IgZnJvbSBjYW52YXMnKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ29udmVydCB0aGUgQmxvYiB0byBhbiBBcnJheUJ1ZmZlclxuXHRcdFx0cmV0dXJuIGJsb2IuYXJyYXlCdWZmZXIoKTtcblxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdFcnJvciB0YWtpbmcgc2NyZWVuc2hvdDonLCBlcnJvcik7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHRpZiAoc3RyZWFtKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgdHJhY2sgb2Ygc3RyZWFtLmdldFRyYWNrcygpKSB7XG5cdFx0XHRcdFx0dHJhY2suc3RvcCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIE5hdGl2ZSBIYW5kbGVcblxuXHRhc3luYyBnZXROYXRpdmVXaW5kb3dIYW5kbGUoX3dpbmRvd0lkOiBudW1iZXIpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElIb3N0U2VydmljZSwgQnJvd3Nlckhvc3RTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQStELGdCQUFnQixtQkFBbUIsb0JBQXFFO0FBQ3ZLLFNBQVMsdUJBQXVCLHNCQUFzQjtBQUN0RCxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGVBQWUsaUJBQWlCO0FBQ3pDLFNBQVMsV0FBVyxvQkFBb0IsdUJBQXVCLGdDQUFnQyxrQkFBa0IsMEJBQTBCLG1CQUFtQixhQUFhLHFCQUFxQixrQkFBa0I7QUFDbE4sU0FBUyxZQUFZLGlCQUFpQixvQkFBb0I7QUFDMUQsU0FBUywyQ0FBMkM7QUFDcEQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsK0JBQStCO0FBRXhDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQXdDLHNCQUFzQjtBQUV2RSxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLGdCQUFnQjtBQUN6QixPQUFPLGNBQWM7QUFDckIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxzQkFBc0IsZ0NBQWdDO0FBRS9ELFNBQVMsZUFBZTtBQUV4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFlBQVkseUJBQXlCO0FBQzlDLFNBQVMsT0FBTyxtQkFBbUI7QUFDbkMsU0FBUyxnQ0FBZ0M7QUFHekMsSUFBSyxxQkFBTCxrQkFBS0Esd0JBQUw7QUFLQyxFQUFBQSx3Q0FBQSxhQUFVLEtBQVY7QUFLQSxFQUFBQSx3Q0FBQSxjQUFXLEtBQVg7QUFLQSxFQUFBQSx3Q0FBQSxTQUFNLEtBQU47QUFmSSxTQUFBQTtBQUFBLEdBQUE7QUFrQkUsSUFBTSxxQkFBTixjQUFpQyxXQUFtQztBQUFBLEVBUTFFLFlBQ2tDLGVBQ08sc0JBQ1QsYUFDQyxjQUNzQixvQkFDZCxzQkFDSixrQkFDTixZQUNHLGVBQ1UsZ0JBQ0EseUJBQzFDO0FBQ0QsVUFBTTtBQVoyQjtBQUNPO0FBQ1Q7QUFDQztBQUNzQjtBQUNkO0FBQ0o7QUFDTjtBQUNHO0FBQ1U7QUFDQTtBQWI1QyxTQUFRLGlCQUFpQjtBQWlCeEIsUUFBSSxtQkFBbUIsU0FBUyxtQkFBbUI7QUFDbEQsV0FBSyxvQkFBb0IsbUJBQW1CLFFBQVE7QUFBQSxJQUNyRCxPQUFPO0FBQ04sV0FBSyxvQkFBb0IsSUFBSSxNQUFvQztBQUFBLFFBQXBDO0FBQzVCLGVBQVMsWUFBWTtBQUNyQixlQUFTLFVBQVU7QUFBQTtBQUFBLFFBQ25CLE1BQU0sT0FBTztBQUFFLGlCQUFPO0FBQUEsUUFBTTtBQUFBLE1BQzdCO0FBQUEsSUFDRDtBQUVBLFNBQUssa0JBQWtCO0FBQUEsRUFDeEI7QUFBQSxFQUVRLG9CQUEwQjtBQUdqQyxTQUFLLFVBQVUsS0FBSyxpQkFBaUIsaUJBQWlCLE9BQUssS0FBSyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7QUFHcEYsU0FBSyxVQUFVLG1CQUFtQixZQUFZLEVBQUUsTUFBTSxNQUFNLEtBQUssOEJBQThCLENBQUMsQ0FBQztBQUFBLEVBQ2xHO0FBQUEsRUFFUSxpQkFBaUIsR0FBOEI7QUFFdEQsWUFBUSxLQUFLLGdCQUFnQjtBQUFBO0FBQUEsTUFHNUIsS0FBSztBQUFBLE1BQ0wsS0FBSyxrQkFBNkI7QUFDakMsY0FBTSxxQkFBcUIsS0FBSyxxQkFBcUIsU0FBUywyQkFBMkI7QUFDekYsWUFBSSx1QkFBdUIsWUFBYSx1QkFBdUIsa0JBQWtCLEtBQUssbUJBQW1CLGtCQUE4QjtBQUN0SSxZQUFFLEtBQUssTUFBTSx5QkFBeUI7QUFBQSxRQUN2QztBQUNBO0FBQUEsTUFDRDtBQUFBO0FBQUEsTUFFQSxLQUFLO0FBQ0o7QUFBQSxJQUNGO0FBR0EsU0FBSyxpQkFBaUI7QUFBQSxFQUN2QjtBQUFBLEVBRVEsZ0NBQXNDO0FBQzdDLFFBQUksS0FBSyxtQkFBbUIsYUFBd0I7QUFDbkQ7QUFBQSxJQUNEO0FBRUEsUUFBSSxtQkFBbUIsWUFBWSxFQUFFLG1CQUFtQjtBQUN2RCxXQUFLLGlCQUFpQjtBQUFBLElBQ3ZCLE9BQU87QUFDTixXQUFLLGlCQUFpQjtBQUFBLElBQ3ZCO0FBQUEsRUFDRDtBQUFBLEVBS0EsSUFBSSxtQkFBbUM7QUFDdEMsVUFBTSxVQUFVLEtBQUssVUFBVSxJQUFJLFFBQWlCLENBQUM7QUFFckQsU0FBSyxVQUFVLE1BQU0sZ0JBQWdCLHFCQUFxQixDQUFDLEVBQUUsUUFBUSxZQUFZLE1BQU07QUFDdEYsWUFBTSxlQUFlLFlBQVksSUFBSSxXQUFXLE1BQU0sQ0FBQztBQUN2RCxZQUFNLG9CQUFvQixZQUFZLElBQUksSUFBSSxXQUFXLE9BQU8sVUFBVSxrQkFBa0IsQ0FBQztBQUU3RixZQUFNO0FBQUEsUUFDTCxNQUFNLElBQUksYUFBYSxZQUFZLE1BQU0sS0FBSyxVQUFVLFdBQVc7QUFBQSxRQUNuRSxNQUFNLElBQUksYUFBYSxXQUFXLE1BQU0sS0FBSyxVQUFVLFdBQVc7QUFBQSxRQUNsRSxNQUFNLElBQUksa0JBQWtCLE9BQU8sTUFBTSxLQUFLLFVBQVUsV0FBVztBQUFBLFFBQ25FLE1BQU0sSUFBSSxLQUFLLHlCQUF5QixNQUFNLEtBQUssVUFBVSxXQUFXO0FBQUEsTUFDekUsRUFBRSxXQUFTLFFBQVEsS0FBSyxLQUFLLENBQUM7QUFBQSxJQUMvQixHQUFHLEVBQUUsUUFBUSxZQUFZLGFBQWEsS0FBSyxPQUFPLENBQUMsQ0FBQztBQUVwRCxXQUFPLE1BQU0sTUFBTSxRQUFRLE9BQU8sUUFBVyxLQUFLLE1BQU07QUFBQSxFQUN6RDtBQUFBLEVBRUEsSUFBSSxXQUFvQjtBQUN2QixXQUFPLGtCQUFrQixFQUFFLFNBQVM7QUFBQSxFQUNyQztBQUFBLEVBRUEsTUFBTSxlQUFpQztBQUN0QyxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBTSxNQUFNLGNBQXFDO0FBQ2hELGlCQUFhLE1BQU07QUFBQSxFQUNwQjtBQUFBLEVBUUEsSUFBSSwwQkFBeUM7QUFDNUMsVUFBTSxVQUFVLEtBQUssVUFBVSxJQUFJLFFBQWdCLENBQUM7QUFFcEQsU0FBSyxVQUFVLE1BQU0sZ0JBQWdCLHFCQUFxQixDQUFDLEVBQUUsUUFBUSxZQUFZLE1BQU07QUFDdEYsWUFBTSxXQUFXLFlBQVksTUFBTTtBQUduQyxZQUFNLGVBQWUsWUFBWSxJQUFJLFdBQVcsTUFBTSxDQUFDO0FBQ3ZELGtCQUFZLElBQUksYUFBYSxXQUFXLE1BQU0sUUFBUSxLQUFLLFFBQVEsQ0FBQyxDQUFDO0FBS3JFLFVBQUksa0JBQWtCLE1BQU0sR0FBRztBQUM5QixvQkFBWSxJQUFJLHlCQUF5QixRQUFRLE1BQU07QUFDdEQsZ0JBQU0sV0FBVyxPQUFPLFNBQVMsU0FBUztBQUMxQyxjQUFJLFVBQVU7QUFDYixvQkFBUSxLQUFLLFFBQVE7QUFBQSxVQUN0QjtBQUVBLGlCQUFPO0FBQUEsUUFDUixHQUFHLEtBQUssRUFBRSxDQUFDO0FBQUEsTUFDWjtBQUFBLElBQ0QsR0FBRyxFQUFFLFFBQVEsWUFBWSxhQUFhLEtBQUssT0FBTyxDQUFDLENBQUM7QUFFcEQsV0FBTyxNQUFNLE1BQU0sUUFBUSxPQUFPLFFBQVcsS0FBSyxNQUFNO0FBQUEsRUFDekQ7QUFBQSxFQUdBLElBQUksd0JBQTBFO0FBQzdFLFVBQU0sVUFBVSxLQUFLLFVBQVUsSUFBSSxRQUFtRCxDQUFDO0FBRXZGLFNBQUssVUFBVSxNQUFNLGdCQUFnQixxQkFBcUIsQ0FBQyxFQUFFLFFBQVEsWUFBWSxNQUFNO0FBQ3RGLFlBQU0sV0FBVyxZQUFZLE1BQU07QUFDbkMsWUFBTSxXQUFXLFNBQVMsT0FBTyxpQkFBaUIsT0FBTyxpQkFBd0M7QUFHakcsaUJBQVcsU0FBUyxDQUFDLFVBQVUsbUJBQW1CLFVBQVUsb0JBQW9CLEdBQUc7QUFDbEYsb0JBQVksSUFBSSxzQkFBc0IsT0FBTyxVQUFVLE9BQU8sTUFBTSxRQUFRLEtBQUssRUFBRSxVQUFVLFlBQVksQ0FBQyxDQUFDLGlCQUFpQixNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFBQSxNQUN4STtBQUdBLGtCQUFZLElBQUk7QUFBQSxRQUErQjtBQUFBLFFBQVUsVUFBVTtBQUFBLFFBQVEsTUFBTSxRQUFRLEtBQUssRUFBRSxVQUFVLFlBQVksQ0FBQyxDQUFDLGlCQUFpQixNQUFNLEVBQUUsQ0FBQztBQUFBLFFBQUc7QUFBQSxRQUFXLGNBQWMsTUFBd0M7QUFBQTtBQUFBLE1BQTBCLENBQUM7QUFBQSxJQUNsUCxHQUFHLEVBQUUsUUFBUSxZQUFZLGFBQWEsS0FBSyxPQUFPLENBQUMsQ0FBQztBQUVwRCxXQUFPLFFBQVE7QUFBQSxFQUNoQjtBQUFBLEVBSUEsV0FBVyxNQUFvRCxNQUEwQztBQUN4RyxRQUFJLE1BQU0sUUFBUSxJQUFJLEdBQUc7QUFDeEIsYUFBTyxLQUFLLGFBQWEsTUFBTSxJQUFJO0FBQUEsSUFDcEM7QUFFQSxXQUFPLEtBQUssa0JBQWtCLElBQUk7QUFBQSxFQUNuQztBQUFBLEVBRUEsTUFBYyxhQUFhLFFBQTJCLFNBQTZDO0FBQ2xHLFVBQU0sVUFBVSxLQUFLLGdCQUFnQixPQUFpQyxPQUFPO0FBQzdFLFVBQU0sZ0JBQStCLENBQUM7QUFFdEMsVUFBTSxlQUErQyxDQUFDO0FBQ3RELFVBQU0sa0JBQXlCLENBQUM7QUFFaEMsZUFBVyxZQUFZLFFBQVE7QUFDOUIsZUFBUyxRQUFRLFNBQVMsU0FBUyxLQUFLLGVBQWUsUUFBUTtBQUcvRCxVQUFJLGVBQWUsUUFBUSxHQUFHO0FBQzdCLFlBQUksU0FBUyxTQUFTO0FBQ3JCLHVCQUFhLEtBQUssRUFBRSxLQUFLLFNBQVMsVUFBVSxDQUFDO0FBQUEsUUFDOUMsV0FBVyxTQUFTLFlBQVk7QUFDL0IsMEJBQWdCLEtBQUssU0FBUyxTQUFTO0FBQUEsUUFDeEMsT0FBTztBQUNOLGVBQUssT0FBTyxFQUFFLFdBQVcsU0FBUyxVQUFVLEdBQUcsRUFBRSxPQUFPLEtBQUs7QUFBQSxZQUFZO0FBQUEsWUFBUztBQUFBO0FBQUEsVUFBbUIsR0FBRyxRQUFRLENBQUM7QUFBQSxRQUNsSDtBQUFBLE1BQ0QsV0FHUyxrQkFBa0IsUUFBUSxHQUFHO0FBQ3JDLGFBQUssT0FBTyxFQUFFLGNBQWMsU0FBUyxhQUFhLEdBQUcsRUFBRSxPQUFPLEtBQUs7QUFBQSxVQUFZO0FBQUEsVUFBUztBQUFBO0FBQUEsUUFBbUIsR0FBRyxRQUFRLENBQUM7QUFBQSxNQUN4SCxXQUdTLGFBQWEsUUFBUSxHQUFHO0FBQ2hDLHNCQUFjLEtBQUssUUFBUTtBQUFBLE1BQzVCO0FBQUEsSUFDRDtBQUdBLFFBQUksYUFBYSxTQUFTLEtBQUssZ0JBQWdCLFNBQVMsR0FBRztBQUMxRCxXQUFLLGFBQWEsT0FBTSxhQUFZO0FBQ25DLGNBQU0sMEJBQW9ELFNBQVMsSUFBSSx3QkFBd0I7QUFDL0YsWUFBSSxhQUFhLFNBQVMsR0FBRztBQUM1QixnQkFBTSx3QkFBd0IsV0FBVyxZQUFZO0FBQUEsUUFDdEQ7QUFFQSxZQUFJLGdCQUFnQixTQUFTLEdBQUc7QUFDL0IsZ0JBQU0sd0JBQXdCLGNBQWMsZUFBZTtBQUFBLFFBQzVEO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRjtBQUdBLFFBQUksY0FBYyxTQUFTLEdBQUc7QUFDN0IsV0FBSyxhQUFhLE9BQU0sYUFBWTtBQUNuQyxjQUFNLGdCQUFnQixTQUFTLElBQUksY0FBYztBQUdqRCxZQUFJLFNBQVMsYUFBYSxjQUFjLFdBQVcsR0FBRztBQUNyRCxnQkFBTSxVQUFVLFNBQVMsTUFBTSxlQUFlLGVBQWUsS0FBSyxhQUFhLEtBQUssVUFBVSxDQUFDO0FBQy9GLGNBQUksUUFBUSxXQUFXLEtBQUssQ0FBQyxzQkFBc0IsUUFBUSxDQUFDLENBQUMsS0FBSyxDQUFDLHNCQUFzQixRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsUUFBUSxDQUFDLENBQUMsR0FBRztBQUNqTDtBQUFBLFVBQ0Q7QUFHQSxjQUFJLEtBQUs7QUFBQSxZQUFZO0FBQUEsWUFBUztBQUFBO0FBQUEsVUFBZSxHQUFHO0FBQy9DLDBCQUFjLFdBQVc7QUFBQSxjQUN4QixRQUFRLEVBQUUsVUFBVSxRQUFRLENBQUMsRUFBRSxTQUFTO0FBQUEsY0FDeEMsUUFBUSxFQUFFLFVBQVUsUUFBUSxDQUFDLEVBQUUsU0FBUztBQUFBLGNBQ3hDLE1BQU0sRUFBRSxVQUFVLFFBQVEsQ0FBQyxFQUFFLFNBQVM7QUFBQSxjQUN0QyxRQUFRLEVBQUUsVUFBVSxRQUFRLENBQUMsRUFBRSxTQUFTO0FBQUEsY0FDeEMsU0FBUyxFQUFFLFFBQVEsS0FBSztBQUFBLFlBQ3pCLENBQUM7QUFBQSxVQUNGLE9BR0s7QUFDSixrQkFBTSxjQUFjLG9CQUFJLElBQW9CO0FBQzVDLHdCQUFZLElBQUksY0FBYyxRQUFRLENBQUMsRUFBRSxTQUFTLFNBQVMsQ0FBQztBQUM1RCx3QkFBWSxJQUFJLGNBQWMsUUFBUSxDQUFDLEVBQUUsU0FBUyxTQUFTLENBQUM7QUFDNUQsd0JBQVksSUFBSSxpQkFBaUIsUUFBUSxDQUFDLEVBQUUsU0FBUyxTQUFTLENBQUM7QUFDL0Qsd0JBQVksSUFBSSxtQkFBbUIsUUFBUSxDQUFDLEVBQUUsU0FBUyxTQUFTLENBQUM7QUFFakUsaUJBQUssT0FBTyxRQUFXLEVBQUUsU0FBUyxNQUFNLEtBQUssWUFBWSxRQUFRLENBQUMsRUFBRSxDQUFDO0FBQUEsVUFDdEU7QUFBQSxRQUNELFdBR1MsU0FBUyxZQUFZLGNBQWMsV0FBVyxHQUFHO0FBQ3pELGdCQUFNLFVBQVUsU0FBUyxNQUFNLGVBQWUsZUFBZSxLQUFLLGFBQWEsS0FBSyxVQUFVLENBQUM7QUFDL0YsY0FBSSxRQUFRLFdBQVcsS0FBSyxDQUFDLHNCQUFzQixRQUFRLENBQUMsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLFFBQVEsQ0FBQyxDQUFDLEdBQUc7QUFDckc7QUFBQSxVQUNEO0FBR0EsY0FBSSxLQUFLO0FBQUEsWUFBWTtBQUFBLFlBQVM7QUFBQTtBQUFBLFVBQWUsR0FBRztBQUMvQywwQkFBYyxXQUFXO0FBQUEsY0FDeEIsVUFBVSxFQUFFLFVBQVUsUUFBUSxDQUFDLEVBQUUsU0FBUztBQUFBLGNBQzFDLFVBQVUsRUFBRSxVQUFVLFFBQVEsQ0FBQyxFQUFFLFNBQVM7QUFBQSxjQUMxQyxTQUFTLEVBQUUsUUFBUSxLQUFLO0FBQUEsWUFDekIsQ0FBQztBQUFBLFVBQ0YsT0FHSztBQUNKLGtCQUFNLGNBQWMsb0JBQUksSUFBb0I7QUFDNUMsd0JBQVksSUFBSSxxQkFBcUIsUUFBUSxDQUFDLEVBQUUsU0FBUyxTQUFTLENBQUM7QUFDbkUsd0JBQVksSUFBSSxtQkFBbUIsUUFBUSxDQUFDLEVBQUUsU0FBUyxTQUFTLENBQUM7QUFFakUsaUJBQUssT0FBTyxRQUFXLEVBQUUsU0FBUyxNQUFNLEtBQUssWUFBWSxRQUFRLENBQUMsRUFBRSxDQUFDO0FBQUEsVUFDdEU7QUFBQSxRQUNELE9BR0s7QUFDSixxQkFBVyxZQUFZLGVBQWU7QUFHckMsZ0JBQUksS0FBSztBQUFBLGNBQVk7QUFBQSxjQUFTO0FBQUE7QUFBQSxZQUFlLEdBQUc7QUFDL0Msa0JBQUksWUFBNkMsQ0FBQztBQUdsRCxrQkFBSSxTQUFTLGNBQWM7QUFDMUIsc0JBQU0sa0JBQWtCLHdCQUF3QixTQUFTLFFBQVEsSUFBSTtBQUNyRSw0QkFBWSxDQUFDO0FBQUEsa0JBQ1osU0FBUyxTQUFTLFFBQVEsS0FBSyxFQUFFLE1BQU0sZ0JBQWdCLEtBQUssQ0FBQztBQUFBLGtCQUM3RCxTQUFTO0FBQUEsb0JBQ1IsV0FBVyxDQUFDLFlBQVksZ0JBQWdCLElBQUksSUFBSSxFQUFFLGlCQUFpQixnQkFBZ0IsTUFBTSxhQUFhLGdCQUFnQixVQUFVLEVBQUUsSUFBSTtBQUFBLGtCQUN2STtBQUFBLGdCQUNELENBQUM7QUFBQSxjQUNGLE9BQU87QUFDTiw0QkFBWSxDQUFDLFFBQVE7QUFBQSxjQUN0QjtBQUVBLDRCQUFjLFlBQVksU0FBUyxNQUFNLGVBQWUsV0FBVyxLQUFLLGFBQWEsS0FBSyxVQUFVLENBQUMsR0FBRyxRQUFXLEVBQUUsZUFBZSxLQUFLLENBQUM7QUFBQSxZQUMzSSxPQUdLO0FBQ0osb0JBQU0sY0FBYyxvQkFBSSxJQUFvQjtBQUM1QywwQkFBWSxJQUFJLFlBQVksU0FBUyxRQUFRLFNBQVMsQ0FBQztBQUV2RCxrQkFBSSxTQUFTLGNBQWM7QUFDMUIsNEJBQVksSUFBSSxnQkFBZ0IsTUFBTTtBQUFBLGNBQ3ZDO0FBRUEsbUJBQUssT0FBTyxRQUFXLEVBQUUsU0FBUyxNQUFNLEtBQUssWUFBWSxRQUFRLENBQUMsRUFBRSxDQUFDO0FBQUEsWUFDdEU7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUdBLGNBQU0sb0JBQW9CLFNBQVM7QUFDbkMsWUFBSSxtQkFBbUI7QUFDdEIsV0FBQyxZQUFZO0FBR1osa0JBQU0sS0FBSyxxQkFBcUIsZUFBZSxDQUFBQyxjQUFZLGlCQUFpQkEsV0FBVSxjQUFjLElBQUksa0JBQWdCLGFBQWEsT0FBTyxDQUFDLENBQUM7QUFHOUksa0JBQU0sS0FBSyxZQUFZLElBQUksaUJBQWlCO0FBQUEsVUFDN0MsR0FBRztBQUFBLFFBQ0o7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUFBLEVBRVEsYUFBYSxJQUFtRDtBQUl2RSxTQUFLLHFCQUFxQixlQUFlLGNBQVksR0FBRyxRQUFRLENBQUM7QUFBQSxFQUNsRTtBQUFBLEVBRVEsZ0JBQWdCLGVBQXdCLFNBQTBEO0FBR3pHLFVBQU0sYUFBNkIsSUFBSSxNQUFNO0FBQzdDLFFBQUksQ0FBQyxpQkFBaUIsS0FBSyxtQkFBbUIsaUNBQWlDO0FBQzlFLGlCQUFXLEtBQUssQ0FBQyw0QkFBNEIsS0FBSyxtQkFBbUIsZ0NBQWdDLFNBQVMsQ0FBQyxDQUFDO0FBRWhILFVBQUksS0FBSyxtQkFBbUIsbUJBQW1CLFNBQVM7QUFDdkQsbUJBQVcsS0FBSyxDQUFDLFdBQVcsS0FBSyxtQkFBbUIsbUJBQW1CLE9BQU8sQ0FBQztBQUFBLE1BQ2hGO0FBRUEsVUFBSSxLQUFLLG1CQUFtQixtQkFBbUIsTUFBTTtBQUNwRCxtQkFBVyxLQUFLLENBQUMsMEJBQTBCLE9BQU8sS0FBSyxtQkFBbUIsbUJBQW1CLElBQUksQ0FBQyxDQUFDO0FBQUEsTUFDcEc7QUFBQSxJQUNEO0FBRUEsVUFBTSxtQkFBbUIsU0FBUyxlQUMvQixLQUFLLHdCQUF3QixTQUFTLEtBQUssYUFBVyxRQUFRLFNBQVMsU0FBUyxZQUFZLElBQzVGO0FBQ0gsUUFBSSxvQkFBb0IsQ0FBQyxpQkFBaUIsV0FBVztBQUNwRCxpQkFBVyxLQUFLLENBQUMsV0FBVyxpQkFBaUIsSUFBSSxDQUFDO0FBQUEsSUFDbkQ7QUFFQSxXQUFPLFdBQVcsU0FBUyxhQUFhO0FBQUEsRUFDekM7QUFBQSxFQUVRLGVBQWUsVUFBbUM7QUFDekQsUUFBSSxlQUFlLFFBQVEsR0FBRztBQUM3QixhQUFPLEtBQUssYUFBYSxrQkFBa0IsU0FBUyxXQUFXLEVBQUUsU0FBUyxVQUFVLEtBQUssQ0FBQztBQUFBLElBQzNGO0FBRUEsUUFBSSxrQkFBa0IsUUFBUSxHQUFHO0FBQ2hDLGFBQU8sS0FBSyxhQUFhLGtCQUFrQix1QkFBdUIsU0FBUyxZQUFZLEdBQUcsRUFBRSxTQUFTLFVBQVUsS0FBSyxDQUFDO0FBQUEsSUFDdEg7QUFFQSxXQUFPLEtBQUssYUFBYSxZQUFZLFNBQVMsU0FBUyxFQUFFLHVCQUF1QixLQUFLLENBQUM7QUFBQSxFQUN2RjtBQUFBLEVBRVEsWUFBWSxVQUE4Qix1QkFBTyxPQUFPLElBQUksR0FBRyxRQUEwQjtBQUNoRyxRQUFJLFFBQVEsbUJBQW1CO0FBQzlCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxlQUFlLEtBQUsscUJBQXFCLFNBQXNDLFFBQVE7QUFDN0YsVUFBTSx3QkFBd0IsU0FBVSxjQUFjLHdCQUF3QixRQUF3QixjQUFjLDBCQUEwQjtBQUU5SSxRQUFJLG1CQUFtQixRQUFRLG1CQUFtQixDQUFDLENBQUMsUUFBUSxtQkFBbUIsQ0FBQyxRQUFRO0FBQ3hGLFFBQUksQ0FBQyxRQUFRLGtCQUFrQixDQUFDLFFBQVEscUJBQXFCLDBCQUEwQixRQUFRLDBCQUEwQixRQUFRO0FBQ2hJLHdCQUFtQiwwQkFBMEI7QUFBQSxJQUM5QztBQUVBLFdBQU8sQ0FBQztBQUFBLEVBQ1Q7QUFBQSxFQUVBLE1BQWMsa0JBQWtCLFNBQWtEO0FBQ2pGLFdBQU8sS0FBSyxPQUFPLFFBQVc7QUFBQSxNQUM3QixPQUFPLFNBQVM7QUFBQSxNQUNoQixTQUFTLEtBQUssZ0JBQWdCLE1BQXlCLE9BQU87QUFBQSxJQUMvRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBYyxPQUFPLFdBQXVCLFNBQWdFO0FBTTNHLFFBQUksYUFBYSxlQUFlLFNBQVMsS0FBSyxVQUFVLFVBQVUsV0FBVyxRQUFRLFFBQVEscUJBQXFCLEtBQUssZUFBZSxhQUFhLENBQUMsR0FBRztBQUN0SixXQUFLLGFBQWEsT0FBTSxhQUFZO0FBQ25DLGNBQU0sMEJBQW9ELFNBQVMsSUFBSSx3QkFBd0I7QUFFL0YsY0FBTSx3QkFBd0IsY0FBYyxHQUFHLEtBQUssZUFBZSxhQUFhLEVBQUUsUUFBUSxRQUFRLENBQUMsRUFBRSxLQUFLLFVBQVUsVUFBVSxDQUFDLENBQUM7QUFBQSxNQUNqSSxDQUFDO0FBRUQ7QUFBQSxJQUNEO0FBSUEsUUFBSSxTQUFTLE9BQU87QUFDbkIsWUFBTSxLQUFLLHVCQUF1QixlQUFlLElBQUk7QUFBQSxJQUN0RDtBQUVBLFVBQU0sU0FBUyxNQUFNLEtBQUssa0JBQWtCLEtBQUssV0FBVyxPQUFPO0FBQ25FLFFBQUksQ0FBQyxRQUFRO0FBQ1osWUFBTSxFQUFFLFVBQVUsSUFBSSxNQUFNLEtBQUssY0FBYyxRQUFRO0FBQUEsUUFDdEQsTUFBTSxTQUFTO0FBQUEsUUFDZixTQUFTLFNBQVMsd0JBQXdCLDZGQUE2RjtBQUFBLFFBQ3ZJLGVBQWUsU0FBUyxFQUFFLEtBQUssUUFBUSxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxRQUFRO0FBQUEsTUFDdEYsQ0FBQztBQUNELFVBQUksV0FBVztBQUNkLGNBQU0sS0FBSyxrQkFBa0IsS0FBSyxXQUFXLE9BQU87QUFBQSxNQUNyRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFNLGlCQUFpQixjQUFxQztBQUMzRCxVQUFNLFNBQVMsS0FBSyxjQUFjLGFBQWEsWUFBWTtBQUczRCxRQUFJLGFBQWEsU0FBUyxlQUFlLFFBQVc7QUFDbkQsVUFBSSxDQUFDLGFBQWEsU0FBUyxZQUFZO0FBQ3RDLFlBQUk7QUFDSCxpQkFBTyxNQUFNLE9BQU8sa0JBQWtCO0FBQUEsUUFDdkMsU0FBUyxPQUFPO0FBQ2YsZUFBSyxXQUFXLEtBQUssOENBQThDO0FBQUEsUUFDcEU7QUFBQSxNQUNELE9BQU87QUFDTixZQUFJO0FBQ0gsaUJBQU8sTUFBTSxhQUFhLFNBQVMsZUFBZTtBQUFBLFFBQ25ELFNBQVMsT0FBTztBQUNmLGVBQUssV0FBVyxLQUFLLDJDQUEyQztBQUFBLFFBQ2pFO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxRQUFVLGFBQWEsU0FBVSx1QkFBdUIsUUFBVztBQUNsRSxVQUFJO0FBQ0gsWUFBSSxDQUFPLGFBQWEsU0FBVSxvQkFBb0I7QUFDckQsVUFBTSxPQUFRLHdCQUF3QjtBQUFBLFFBQ3ZDLE9BQU87QUFDTixVQUFNLGFBQWEsU0FBVSxxQkFBcUI7QUFBQSxRQUNuRDtBQUFBLE1BQ0QsUUFBUTtBQUNQLGFBQUssV0FBVyxLQUFLLDZEQUE2RDtBQUFBLE1BQ25GO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sUUFBUSxjQUFxQztBQUFBLEVBRW5EO0FBQUEsRUFFQSxNQUFNLHVCQUEyQztBQUNoRCxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUE7QUFBQSxFQU1BLE1BQU0sVUFBeUI7QUFDOUIsU0FBSyxPQUFPO0FBQUEsRUFDYjtBQUFBLEVBRUEsTUFBTSxTQUF3QjtBQUM3QixVQUFNLEtBQUssdUJBQXVCLGVBQWUsTUFBTTtBQUV2RCxlQUFXLFNBQVMsT0FBTztBQUFBLEVBQzVCO0FBQUEsRUFFQSxNQUFNLFFBQXVCO0FBQzVCLFVBQU0sS0FBSyx1QkFBdUIsZUFBZSxLQUFLO0FBRXRELGVBQVcsTUFBTTtBQUFBLEVBQ2xCO0FBQUEsRUFFQSxNQUFNLHFCQUF3QixzQkFBb0Q7QUFDakYsVUFBTSx5QkFBeUIsS0FBSztBQUNwQyxRQUFJO0FBQ0gsV0FBSyxpQkFBaUI7QUFDdEIsYUFBTyxNQUFNLHFCQUFxQjtBQUFBLElBQ25DLFVBQUU7QUFDRCxXQUFLLGlCQUFpQjtBQUFBLElBQ3ZCO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyx1QkFBdUIsUUFBdUM7QUFLM0UsU0FBSyxpQkFBaUI7QUFHdEIsV0FBTyxLQUFLLGlCQUFpQixxQkFBcUIsTUFBTTtBQUFBLEVBQ3pEO0FBQUE7QUFBQTtBQUFBLEVBTUEsTUFBTSxnQkFBc0Q7QUFLM0QsVUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBR2xDLFVBQU0sUUFBUSxTQUFTLGNBQWMsT0FBTztBQUM1QyxVQUFNLElBQUksYUFBYSxNQUFNLE1BQU0sT0FBTyxDQUFDLENBQUM7QUFDNUMsUUFBSTtBQUNKLFFBQUk7QUFFSCxlQUFTLE1BQU0sVUFBVSxhQUFhLGdCQUFnQjtBQUFBLFFBQ3JELE9BQU87QUFBQSxRQUNQLE9BQU87QUFBQSxNQUNSLENBQUM7QUFHRCxZQUFNLFlBQVk7QUFDbEIsWUFBTSxLQUFLO0FBR1gsWUFBTSxRQUFRLElBQUk7QUFBQSxRQUNqQixJQUFJLFFBQWMsT0FBSyxNQUFNLElBQUksc0JBQXNCLE9BQU8sa0JBQWtCLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUFBLFFBQzNGLElBQUksUUFBYyxPQUFLLE1BQU0sSUFBSSxzQkFBc0IsT0FBTyxrQkFBa0IsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDNUYsQ0FBQztBQUVELFlBQU0sU0FBUyxTQUFTLGNBQWMsUUFBUTtBQUM5QyxhQUFPLFFBQVEsTUFBTTtBQUNyQixhQUFPLFNBQVMsTUFBTTtBQUV0QixZQUFNLE1BQU0sT0FBTyxXQUFXLElBQUk7QUFDbEMsVUFBSSxDQUFDLEtBQUs7QUFDVCxlQUFPO0FBQUEsTUFDUjtBQUdBLFVBQUksVUFBVSxPQUFPLEdBQUcsR0FBRyxPQUFPLE9BQU8sT0FBTyxNQUFNO0FBR3RELFlBQU0sT0FBb0IsTUFBTSxJQUFJLFFBQVEsQ0FBQyxZQUFZLE9BQU8sT0FBTyxDQUFDQyxVQUFTLFFBQVFBLEtBQUksR0FBRyxjQUFjLElBQUksQ0FBQztBQUNuSCxVQUFJLENBQUMsTUFBTTtBQUNWLGNBQU0sSUFBSSxNQUFNLG1DQUFtQztBQUFBLE1BQ3BEO0FBR0EsYUFBTyxLQUFLLFlBQVk7QUFBQSxJQUV6QixTQUFTLE9BQU87QUFDZixjQUFRLE1BQU0sNEJBQTRCLEtBQUs7QUFDL0MsYUFBTztBQUFBLElBQ1IsVUFBRTtBQUNELFlBQU0sUUFBUTtBQUNkLFVBQUksUUFBUTtBQUNYLG1CQUFXLFNBQVMsT0FBTyxVQUFVLEdBQUc7QUFDdkMsZ0JBQU0sS0FBSztBQUFBLFFBQ1o7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUEsRUFNQSxNQUFNLHNCQUFzQixXQUFtQjtBQUM5QyxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBR0Q7QUFwZ0JLO0FBQUEsRUFESDtBQUFBLEdBakZXLG1CQWtGUjtBQW9DQTtBQUFBLEVBREg7QUFBQSxHQXJIVyxtQkFzSFI7QUE2QkE7QUFBQSxFQURIO0FBQUEsR0FsSlcsbUJBbUpSO0FBbkpRLHFCQUFOO0FBQUEsRUFTSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQW5CVTtBQXdsQmIsa0JBQWtCLGNBQWMsb0JBQW9CLGtCQUFrQixPQUFPOyIsCiAgIm5hbWVzIjogWyJIb3N0U2h1dGRvd25SZWFzb24iLCAiYWNjZXNzb3IiLCAiYmxvYiJdCn0K
