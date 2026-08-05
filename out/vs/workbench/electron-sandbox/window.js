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
import "./media/window.css";
import { localize } from "../../nls.js";
import { URI } from "../../base/common/uri.js";
import { equals } from "../../base/common/objects.js";
import { EventType, EventHelper, addDisposableListener, ModifierKeyEmitter, getActiveElement, hasWindow, getWindowById, getWindows, $ } from "../../base/browser/dom.js";
import { Action, Separator } from "../../base/common/actions.js";
import { IFileService } from "../../platform/files/common/files.js";
import { EditorResourceAccessor, SideBySideEditor, pathsToEditors, isResourceEditorInput } from "../common/editor.js";
import { IEditorService } from "../services/editor/common/editorService.js";
import { ITelemetryService } from "../../platform/telemetry/common/telemetry.js";
import { WindowMinimumSize, hasNativeTitlebar } from "../../platform/window/common/window.js";
import { ITitleService } from "../services/title/browser/titleService.js";
import { IWorkbenchThemeService } from "../services/themes/common/workbenchThemeService.js";
import { ApplyZoomTarget, applyZoom } from "../../platform/window/electron-sandbox/window.js";
import { setFullscreen, getZoomLevel, onDidChangeZoomLevel, getZoomFactor } from "../../base/browser/browser.js";
import { ICommandService, CommandsRegistry } from "../../platform/commands/common/commands.js";
import { ipcRenderer, process } from "../../base/parts/sandbox/electron-sandbox/globals.js";
import { IWorkspaceEditingService } from "../services/workspaces/common/workspaceEditing.js";
import { IMenuService, MenuId, MenuItemAction, MenuRegistry } from "../../platform/actions/common/actions.js";
import { getFlatActionBarActions } from "../../platform/actions/browser/menuEntryActionViewItem.js";
import { RunOnceScheduler } from "../../base/common/async.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../base/common/lifecycle.js";
import { LifecyclePhase, ILifecycleService, ShutdownReason } from "../services/lifecycle/common/lifecycle.js";
import { IIntegrityService } from "../services/integrity/common/integrity.js";
import { isWindows, isMacintosh } from "../../base/common/platform.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { INotificationService, NeverShowAgainScope, NotificationPriority, Severity } from "../../platform/notification/common/notification.js";
import { IKeybindingService } from "../../platform/keybinding/common/keybinding.js";
import { INativeWorkbenchEnvironmentService } from "../services/environment/electron-sandbox/environmentService.js";
import { IAccessibilityService, AccessibilitySupport } from "../../platform/accessibility/common/accessibility.js";
import { WorkbenchState, IWorkspaceContextService } from "../../platform/workspace/common/workspace.js";
import { coalesce } from "../../base/common/arrays.js";
import { ConfigurationTarget, IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { IStorageService, StorageScope, StorageTarget } from "../../platform/storage/common/storage.js";
import { IOpenerService } from "../../platform/opener/common/opener.js";
import { Schemas } from "../../base/common/network.js";
import { INativeHostService } from "../../platform/native/common/native.js";
import { posix } from "../../base/common/path.js";
import { ITunnelService, extractLocalHostUriMetaDataForPortMapping, extractQueryLocalHostUriMetaDataForPortMapping } from "../../platform/tunnel/common/tunnel.js";
import { IWorkbenchLayoutService, positionFromString, Position } from "../services/layout/browser/layoutService.js";
import { IWorkingCopyService } from "../services/workingCopy/common/workingCopyService.js";
import { WorkingCopyCapabilities } from "../services/workingCopy/common/workingCopy.js";
import { IFilesConfigurationService } from "../services/filesConfiguration/common/filesConfigurationService.js";
import { Event } from "../../base/common/event.js";
import { IRemoteAuthorityResolverService } from "../../platform/remote/common/remoteAuthorityResolver.js";
import { IEditorGroupsService } from "../services/editor/common/editorGroupsService.js";
import { IDialogService } from "../../platform/dialogs/common/dialogs.js";
import { ILogService } from "../../platform/log/common/log.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { whenEditorClosed } from "../browser/editor.js";
import { ISharedProcessService } from "../../platform/ipc/electron-sandbox/services.js";
import { IProgressService, ProgressLocation } from "../../platform/progress/common/progress.js";
import { toErrorMessage } from "../../base/common/errorMessage.js";
import { ILabelService } from "../../platform/label/common/label.js";
import { dirname } from "../../base/common/resources.js";
import { IBannerService } from "../services/banner/browser/bannerService.js";
import { Codicon } from "../../base/common/codicons.js";
import { IUriIdentityService } from "../../platform/uriIdentity/common/uriIdentity.js";
import { IPreferencesService } from "../services/preferences/common/preferences.js";
import { IUtilityProcessWorkerWorkbenchService } from "../services/utilityProcess/electron-sandbox/utilityProcessWorkerWorkbenchService.js";
import { registerWindowDriver } from "../services/driver/electron-sandbox/driver.js";
import { mainWindow } from "../../base/browser/window.js";
import { BaseWindow } from "../browser/window.js";
import { IHostService } from "../services/host/browser/host.js";
import { IStatusbarService, ShowTooltipCommand, StatusbarAlignment } from "../services/statusbar/browser/statusbar.js";
import { ActionBar } from "../../base/browser/ui/actionbar/actionbar.js";
import { ThemeIcon } from "../../base/common/themables.js";
import { getWorkbenchContribution } from "../common/contributions.js";
import { DynamicWorkbenchSecurityConfiguration } from "../common/configuration.js";
import { nativeHoverDelegate } from "../../platform/hover/browser/hover.js";
let NativeWindow = class extends BaseWindow {
  constructor(editorService, editorGroupService, configurationService, titleService, themeService, notificationService, commandService, keybindingService, telemetryService, workspaceEditingService, fileService, menuService, lifecycleService, integrityService, nativeEnvironmentService, accessibilityService, contextService, openerService, nativeHostService, tunnelService, layoutService, workingCopyService, filesConfigurationService, productService, remoteAuthorityResolverService, dialogService, storageService, logService, instantiationService, sharedProcessService, progressService, labelService, bannerService, uriIdentityService, preferencesService, utilityProcessWorkerWorkbenchService, hostService) {
    super(mainWindow, void 0, hostService, nativeEnvironmentService);
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.configurationService = configurationService;
    this.titleService = titleService;
    this.themeService = themeService;
    this.notificationService = notificationService;
    this.commandService = commandService;
    this.keybindingService = keybindingService;
    this.telemetryService = telemetryService;
    this.workspaceEditingService = workspaceEditingService;
    this.fileService = fileService;
    this.menuService = menuService;
    this.lifecycleService = lifecycleService;
    this.integrityService = integrityService;
    this.nativeEnvironmentService = nativeEnvironmentService;
    this.accessibilityService = accessibilityService;
    this.contextService = contextService;
    this.openerService = openerService;
    this.nativeHostService = nativeHostService;
    this.tunnelService = tunnelService;
    this.layoutService = layoutService;
    this.workingCopyService = workingCopyService;
    this.filesConfigurationService = filesConfigurationService;
    this.productService = productService;
    this.remoteAuthorityResolverService = remoteAuthorityResolverService;
    this.dialogService = dialogService;
    this.storageService = storageService;
    this.logService = logService;
    this.instantiationService = instantiationService;
    this.sharedProcessService = sharedProcessService;
    this.progressService = progressService;
    this.labelService = labelService;
    this.bannerService = bannerService;
    this.uriIdentityService = uriIdentityService;
    this.preferencesService = preferencesService;
    this.utilityProcessWorkerWorkbenchService = utilityProcessWorkerWorkbenchService;
    this.customTitleContextMenuDisposable = this._register(new DisposableStore());
    this.addRemoveFoldersScheduler = this._register(new RunOnceScheduler(() => this.doAddRemoveFolders(), 100));
    this.pendingFoldersToAdd = [];
    this.pendingFoldersToRemove = [];
    this.isDocumentedEdited = false;
    this.touchBarDisposables = this._register(new DisposableStore());
    //#region Window Zoom
    this.mapWindowIdToZoomStatusEntry = /* @__PURE__ */ new Map();
    this.configuredWindowZoomLevel = this.resolveConfiguredWindowZoomLevel();
    this.registerListeners();
    this.create();
  }
  registerListeners() {
    this._register(addDisposableListener(mainWindow, EventType.RESIZE, () => this.layoutService.layout()));
    this._register(this.editorService.onDidActiveEditorChange(() => this.updateTouchbarMenu()));
    for (const event of [EventType.DRAG_OVER, EventType.DROP]) {
      this._register(addDisposableListener(mainWindow.document.body, event, (e) => {
        EventHelper.stop(e);
      }));
    }
    ipcRenderer.on("vscode:runAction", async (event, request) => {
      const args = request.args || [];
      if (request.from === "touchbar") {
        const activeEditor = this.editorService.activeEditor;
        if (activeEditor) {
          const resource = EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
          if (resource) {
            args.push(resource);
          }
        }
      } else {
        args.push({ from: request.from });
      }
      try {
        await this.commandService.executeCommand(request.id, ...args);
        this.telemetryService.publicLog2("workbenchActionExecuted", { id: request.id, from: request.from });
      } catch (error) {
        this.notificationService.error(error);
      }
    });
    ipcRenderer.on("vscode:runKeybinding", (event, request) => {
      const activeElement = getActiveElement();
      if (activeElement) {
        this.keybindingService.dispatchByUserSettingsLabel(request.userSettingsLabel, activeElement);
      }
    });
    ipcRenderer.on("vscode:reportSharedProcessCrash", (event, error) => {
      this.notificationService.prompt(
        Severity.Error,
        localize("sharedProcessCrash", "A shared background process terminated unexpectedly. Please restart the application to recover."),
        [{
          label: localize("restart", "Restart"),
          run: () => this.nativeHostService.relaunch()
        }],
        {
          priority: NotificationPriority.URGENT
        }
      );
    });
    ipcRenderer.on("vscode:openFiles", (event, request) => {
      this.onOpenFiles(request);
    });
    ipcRenderer.on("vscode:addRemoveFolders", (event, request) => this.onAddRemoveFoldersRequest(request));
    ipcRenderer.on("vscode:showInfoMessage", (event, message) => this.notificationService.info(message));
    ipcRenderer.on("vscode:showResolveShellEnvError", (event, message) => {
      this.notificationService.prompt(
        Severity.Error,
        message,
        [
          {
            label: localize("restart", "Restart"),
            run: () => this.nativeHostService.relaunch()
          },
          {
            label: localize("configure", "Configure"),
            run: () => this.preferencesService.openUserSettings({ query: "application.shellEnvironmentResolutionTimeout" })
          },
          {
            label: localize("learnMore", "Learn More"),
            run: () => this.openerService.open("https://go.microsoft.com/fwlink/?linkid=2149667")
          }
        ]
      );
    });
    ipcRenderer.on("vscode:showCredentialsError", (event, message) => {
      this.notificationService.prompt(
        Severity.Error,
        localize("keychainWriteError", "Writing login information to the keychain failed with error '{0}'.", message),
        [{
          label: localize("troubleshooting", "Troubleshooting Guide"),
          run: () => this.openerService.open("https://go.microsoft.com/fwlink/?linkid=2190713")
        }]
      );
    });
    ipcRenderer.on("vscode:showTranslatedBuildWarning", () => {
      this.notificationService.prompt(
        Severity.Warning,
        localize("runningTranslated", "You are running an emulated version of {0}. For better performance download the native arm64 version of {0} build for your machine.", this.productService.nameLong),
        [{
          label: localize("downloadArmBuild", "Download"),
          run: () => {
            const quality = this.productService.quality;
            const stableURL = "https://code.visualstudio.com/docs/?dv=osx";
            const insidersURL = "https://code.visualstudio.com/docs/?dv=osx&build=insiders";
            this.openerService.open(quality === "stable" ? stableURL : insidersURL);
          }
        }],
        {
          priority: NotificationPriority.URGENT
        }
      );
    });
    ipcRenderer.on("vscode:showArgvParseWarning", (event, message) => {
      this.notificationService.prompt(
        Severity.Warning,
        localize("showArgvParseWarning", "The runtime arguments file 'argv.json' contains errors. Please correct them and restart."),
        [{
          label: localize("showArgvParseWarningAction", "Open File"),
          run: () => this.editorService.openEditor({ resource: this.nativeEnvironmentService.argvResource })
        }],
        {
          priority: NotificationPriority.URGENT
        }
      );
    });
    ipcRenderer.on("vscode:enterFullScreen", () => setFullscreen(true, mainWindow));
    ipcRenderer.on("vscode:leaveFullScreen", () => setFullscreen(false, mainWindow));
    ipcRenderer.on("vscode:openProxyAuthenticationDialog", async (event, payload) => {
      const rememberCredentialsKey = "window.rememberProxyCredentials";
      const rememberCredentials = this.storageService.getBoolean(rememberCredentialsKey, StorageScope.APPLICATION);
      const result = await this.dialogService.input({
        type: "warning",
        message: localize("proxyAuthRequired", "Proxy Authentication Required"),
        primaryButton: localize({ key: "loginButton", comment: ["&& denotes a mnemonic"] }, "&&Log In"),
        inputs: [
          { placeholder: localize("username", "Username"), value: payload.username },
          { placeholder: localize("password", "Password"), type: "password", value: payload.password }
        ],
        detail: localize("proxyDetail", "The proxy {0} requires a username and password.", `${payload.authInfo.host}:${payload.authInfo.port}`),
        checkbox: {
          label: localize("rememberCredentials", "Remember my credentials"),
          checked: rememberCredentials
        }
      });
      if (!result.confirmed || !result.values) {
        ipcRenderer.send(payload.replyChannel);
      } else {
        if (result.checkboxChecked) {
          this.storageService.store(rememberCredentialsKey, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
        } else {
          this.storageService.remove(rememberCredentialsKey, StorageScope.APPLICATION);
        }
        const [username, password] = result.values;
        ipcRenderer.send(payload.replyChannel, { username, password, remember: !!result.checkboxChecked });
      }
    });
    ipcRenderer.on("vscode:accessibilitySupportChanged", (event, accessibilitySupportEnabled) => {
      this.accessibilityService.setAccessibilitySupport(accessibilitySupportEnabled ? AccessibilitySupport.Enabled : AccessibilitySupport.Disabled);
    });
    ipcRenderer.on("vscode:configureAllowedUNCHost", async (event, host) => {
      if (!isWindows) {
        return;
      }
      const allowedUncHosts = /* @__PURE__ */ new Set();
      const configuredAllowedUncHosts = this.configurationService.getValue("security.allowedUNCHosts") ?? [];
      if (Array.isArray(configuredAllowedUncHosts)) {
        for (const configuredAllowedUncHost of configuredAllowedUncHosts) {
          if (typeof configuredAllowedUncHost === "string") {
            allowedUncHosts.add(configuredAllowedUncHost);
          }
        }
      }
      if (!allowedUncHosts.has(host)) {
        allowedUncHosts.add(host);
        await getWorkbenchContribution(DynamicWorkbenchSecurityConfiguration.ID).ready;
        this.configurationService.updateValue("security.allowedUNCHosts", [...allowedUncHosts.values()], ConfigurationTarget.USER);
      }
    });
    ipcRenderer.on("vscode:disablePromptForProtocolHandling", (event, kind) => {
      const setting = kind === "local" ? "security.promptForLocalFileProtocolHandling" : "security.promptForRemoteFileProtocolHandling";
      this.configurationService.updateValue(setting, false);
    });
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("window.zoomLevel") || e.affectsConfiguration("window.zoomPerWindow") && this.configurationService.getValue("window.zoomPerWindow") === false) {
        this.onDidChangeConfiguredWindowZoomLevel();
      } else if (e.affectsConfiguration("keyboard.touchbar.enabled") || e.affectsConfiguration("keyboard.touchbar.ignored")) {
        this.updateTouchbarMenu();
      }
    }));
    this._register(onDidChangeZoomLevel((targetWindowId) => this.handleOnDidChangeZoomLevel(targetWindowId)));
    for (const part of this.editorGroupService.parts) {
      this.createWindowZoomStatusEntry(part);
    }
    this._register(this.editorGroupService.onDidCreateAuxiliaryEditorPart((part) => this.createWindowZoomStatusEntry(part)));
    this._register(Event.debounce(this.editorService.onDidVisibleEditorsChange, () => void 0, 0, void 0, void 0, void 0, this._store)(() => this.maybeCloseWindow()));
    const filesToWait = this.nativeEnvironmentService.filesToWait;
    if (filesToWait) {
      this.trackClosedWaitFiles(filesToWait.waitMarkerFileUri, coalesce(filesToWait.paths.map((path) => path.fileUri)));
    }
    if (isMacintosh) {
      for (const part of this.editorGroupService.parts) {
        this.handleRepresentedFilename(part);
      }
      this._register(this.editorGroupService.onDidCreateAuxiliaryEditorPart((part) => this.handleRepresentedFilename(part)));
    }
    this._register(this.workingCopyService.onDidChangeDirty((workingCopy) => {
      const gotDirty = workingCopy.isDirty();
      if (gotDirty && !(workingCopy.capabilities & WorkingCopyCapabilities.Untitled) && this.filesConfigurationService.hasShortAutoSaveDelay(workingCopy.resource)) {
        return;
      }
      this.updateDocumentEdited(gotDirty ? true : void 0);
    }));
    this.updateDocumentEdited(void 0);
    this._register(Event.any(
      Event.map(Event.filter(this.nativeHostService.onDidMaximizeWindow, (windowId) => !!hasWindow(windowId)), (windowId) => ({ maximized: true, windowId })),
      Event.map(Event.filter(this.nativeHostService.onDidUnmaximizeWindow, (windowId) => !!hasWindow(windowId)), (windowId) => ({ maximized: false, windowId }))
    )((e) => this.layoutService.updateWindowMaximizedState(getWindowById(e.windowId).window, e.maximized)));
    this.layoutService.updateWindowMaximizedState(mainWindow, this.nativeEnvironmentService.window.maximized ?? false);
    this._register(this.layoutService.onDidChangePanelPosition((pos) => this.onDidChangePanelPosition(positionFromString(pos))));
    this.onDidChangePanelPosition(this.layoutService.getPanelPosition());
    this._register(this.lifecycleService.onBeforeShutdown((e) => this.onBeforeShutdown(e)));
    this._register(this.lifecycleService.onBeforeShutdownError((e) => this.onBeforeShutdownError(e)));
    this._register(this.lifecycleService.onWillShutdown((e) => this.onWillShutdown(e)));
  }
  handleRepresentedFilename(part) {
    const disposables = new DisposableStore();
    Event.once(part.onWillDispose)(() => disposables.dispose());
    const scopedEditorService = this.editorGroupService.getScopedInstantiationService(part).invokeFunction((accessor) => accessor.get(IEditorService));
    disposables.add(scopedEditorService.onDidActiveEditorChange(() => this.updateRepresentedFilename(scopedEditorService, part.windowId)));
  }
  updateRepresentedFilename(editorService, targetWindowId) {
    const file = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY, filterByScheme: Schemas.file });
    this.nativeHostService.setRepresentedFilename(file?.fsPath ?? "", { targetWindowId });
    if (targetWindowId === mainWindow.vscodeWindowId) {
      this.provideCustomTitleContextMenu(file?.fsPath);
    }
  }
  //#region Window Lifecycle
  onBeforeShutdown({ veto, reason }) {
    if (reason === ShutdownReason.CLOSE) {
      const confirmBeforeCloseSetting = this.configurationService.getValue("window.confirmBeforeClose");
      const confirmBeforeClose = confirmBeforeCloseSetting === "always" || confirmBeforeCloseSetting === "keyboardOnly" && ModifierKeyEmitter.getInstance().isModifierPressed;
      if (confirmBeforeClose) {
        return veto((async () => {
          let actualReason = reason;
          if (reason === ShutdownReason.CLOSE && !isMacintosh) {
            const windowCount = await this.nativeHostService.getWindowCount();
            if (windowCount === 1) {
              actualReason = ShutdownReason.QUIT;
            }
          }
          let confirmed = true;
          if (confirmBeforeClose) {
            confirmed = await this.instantiationService.invokeFunction((accessor) => NativeWindow.confirmOnShutdown(accessor, actualReason));
          }
          if (confirmed) {
            this.progressOnBeforeShutdown(reason);
          }
          return !confirmed;
        })(), "veto.confirmBeforeClose");
      }
    }
    this.progressOnBeforeShutdown(reason);
  }
  progressOnBeforeShutdown(reason) {
    this.progressService.withProgress({
      location: ProgressLocation.Window,
      // use window progress to not be too annoying about this operation
      delay: 800,
      // delay so that it only appears when operation takes a long time
      title: this.toShutdownLabel(reason, false)
    }, () => {
      return Event.toPromise(Event.any(
        this.lifecycleService.onWillShutdown,
        // dismiss this dialog when we shutdown
        this.lifecycleService.onShutdownVeto,
        // or when shutdown was vetoed
        this.dialogService.onWillShowDialog
        // or when a dialog asks for input
      ));
    });
  }
  onBeforeShutdownError({ error, reason }) {
    this.dialogService.error(this.toShutdownLabel(reason, true), localize("shutdownErrorDetail", "Error: {0}", toErrorMessage(error)));
  }
  onWillShutdown({ reason, force, joiners }) {
    const shutdownDialogScheduler = new RunOnceScheduler(() => {
      const pendingJoiners = joiners();
      this.progressService.withProgress({
        location: ProgressLocation.Dialog,
        // use a dialog to prevent the user from making any more interactions now
        buttons: [this.toForceShutdownLabel(reason)],
        // allow to force shutdown anyway
        cancellable: false,
        // do not allow to cancel
        sticky: true,
        // do not allow to dismiss
        title: this.toShutdownLabel(reason, false),
        detail: pendingJoiners.length > 0 ? localize("willShutdownDetail", "The following operations are still running: \n{0}", pendingJoiners.map((joiner) => `- ${joiner.label}`).join("\n")) : void 0
      }, () => {
        return Event.toPromise(this.lifecycleService.onDidShutdown);
      }, () => {
        force();
      });
    }, 1200);
    shutdownDialogScheduler.schedule();
    Event.once(this.lifecycleService.onDidShutdown)(() => shutdownDialogScheduler.dispose());
  }
  toShutdownLabel(reason, isError) {
    if (isError) {
      switch (reason) {
        case ShutdownReason.CLOSE:
          return localize("shutdownErrorClose", "An unexpected error prevented the window to close");
        case ShutdownReason.QUIT:
          return localize("shutdownErrorQuit", "An unexpected error prevented the application to quit");
        case ShutdownReason.RELOAD:
          return localize("shutdownErrorReload", "An unexpected error prevented the window to reload");
        case ShutdownReason.LOAD:
          return localize("shutdownErrorLoad", "An unexpected error prevented to change the workspace");
      }
    }
    switch (reason) {
      case ShutdownReason.CLOSE:
        return localize("shutdownTitleClose", "Closing the window is taking a bit longer...");
      case ShutdownReason.QUIT:
        return localize("shutdownTitleQuit", "Quitting the application is taking a bit longer...");
      case ShutdownReason.RELOAD:
        return localize("shutdownTitleReload", "Reloading the window is taking a bit longer...");
      case ShutdownReason.LOAD:
        return localize("shutdownTitleLoad", "Changing the workspace is taking a bit longer...");
    }
  }
  toForceShutdownLabel(reason) {
    switch (reason) {
      case ShutdownReason.CLOSE:
        return localize("shutdownForceClose", "Close Anyway");
      case ShutdownReason.QUIT:
        return localize("shutdownForceQuit", "Quit Anyway");
      case ShutdownReason.RELOAD:
        return localize("shutdownForceReload", "Reload Anyway");
      case ShutdownReason.LOAD:
        return localize("shutdownForceLoad", "Change Anyway");
    }
  }
  //#endregion
  updateDocumentEdited(documentEdited) {
    let setDocumentEdited;
    if (typeof documentEdited === "boolean") {
      setDocumentEdited = documentEdited;
    } else {
      setDocumentEdited = this.workingCopyService.hasDirty;
    }
    if (!this.isDocumentedEdited && setDocumentEdited || this.isDocumentedEdited && !setDocumentEdited) {
      this.isDocumentedEdited = setDocumentEdited;
      this.nativeHostService.setDocumentEdited(setDocumentEdited);
    }
  }
  getWindowMinimumWidth(panelPosition = this.layoutService.getPanelPosition()) {
    const panelOnSide = panelPosition === Position.LEFT || panelPosition === Position.RIGHT;
    if (panelOnSide) {
      return WindowMinimumSize.WIDTH_WITH_VERTICAL_PANEL;
    }
    return WindowMinimumSize.WIDTH;
  }
  onDidChangePanelPosition(pos) {
    const minWidth = this.getWindowMinimumWidth(pos);
    this.nativeHostService.setMinimumSize(minWidth, void 0);
  }
  maybeCloseWindow() {
    const closeWhenEmpty = this.configurationService.getValue("window.closeWhenEmpty") || this.nativeEnvironmentService.args.wait;
    if (!closeWhenEmpty) {
      return;
    }
    for (const editorPart of this.editorGroupService.parts) {
      if (editorPart.groups.some((group) => !group.isEmpty)) {
        continue;
      }
      if (editorPart === this.editorGroupService.mainPart && (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY || // only for empty windows
      this.environmentService.isExtensionDevelopment || // not when developing an extension
      this.editorService.visibleEditors.length > 0)) {
        continue;
      }
      if (editorPart === this.editorGroupService.mainPart) {
        this.nativeHostService.closeWindow();
      } else {
        editorPart.removeGroup(editorPart.activeGroup);
      }
    }
  }
  provideCustomTitleContextMenu(filePath) {
    this.customTitleContextMenuDisposable.clear();
    if (!filePath || hasNativeTitlebar(this.configurationService)) {
      return;
    }
    const segments = filePath.split(posix.sep);
    for (let i = segments.length; i > 0; i--) {
      const isFile = i === segments.length;
      let pathOffset = i;
      if (!isFile) {
        pathOffset++;
      }
      const path = URI.file(segments.slice(0, pathOffset).join(posix.sep));
      let label;
      if (!isFile) {
        label = this.labelService.getUriBasenameLabel(dirname(path));
      } else {
        label = this.labelService.getUriBasenameLabel(path);
      }
      const commandId = `workbench.action.revealPathInFinder${i}`;
      this.customTitleContextMenuDisposable.add(CommandsRegistry.registerCommand(commandId, () => this.nativeHostService.showItemInFolder(path.fsPath)));
      this.customTitleContextMenuDisposable.add(MenuRegistry.appendMenuItem(MenuId.TitleBarTitleContext, { command: { id: commandId, title: label || posix.sep }, order: -i, group: "1_file" }));
    }
  }
  create() {
    this.setupOpenHandlers();
    this.lifecycleService.when(LifecyclePhase.Ready).then(() => this.nativeHostService.notifyReady());
    this.lifecycleService.when(LifecyclePhase.Restored).then(() => {
      this.sharedProcessService.notifyRestored();
      this.utilityProcessWorkerWorkbenchService.notifyRestored();
    });
    this.handleWarnings();
    this.updateTouchbarMenu();
    if (this.environmentService.enableSmokeTestDriver) {
      this.setupDriver();
    }
  }
  async handleWarnings() {
    await this.lifecycleService.when(LifecyclePhase.Restored);
    (async () => {
      const isAdmin = await this.nativeHostService.isAdmin();
      const { isPure } = await this.integrityService.isPure();
      this.titleService.updateProperties({ isPure, isAdmin });
      if (isAdmin && !isWindows) {
        this.notificationService.warn(localize("runningAsRoot", "It is not recommended to run {0} as root user.", this.productService.nameShort));
      }
    })();
    if (this.environmentService.isBuilt) {
      let installLocationUri;
      if (isMacintosh) {
        installLocationUri = dirname(dirname(dirname(URI.file(this.nativeEnvironmentService.appRoot))));
      } else {
        installLocationUri = dirname(dirname(URI.file(this.nativeEnvironmentService.appRoot)));
      }
      for (const folder of this.contextService.getWorkspace().folders) {
        if (this.uriIdentityService.extUri.isEqualOrParent(folder.uri, installLocationUri)) {
          this.bannerService.show({
            id: "appRootWarning.banner",
            message: localize("appRootWarning.banner", "Files you store within the installation folder ('{0}') may be OVERWRITTEN or DELETED IRREVERSIBLY without warning at update time.", this.labelService.getUriLabel(installLocationUri)),
            icon: Codicon.warning
          });
          break;
        }
      }
    }
    if (isMacintosh) {
      const majorVersion = this.nativeEnvironmentService.os.release.split(".")[0];
      const eolReleases = /* @__PURE__ */ new Map([
        ["19", "macOS Catalina"]
      ]);
      if (eolReleases.has(majorVersion)) {
        const message = localize("macoseolmessage", "{0} on {1} will soon stop receiving updates. Consider upgrading your macOS version.", this.productService.nameLong, eolReleases.get(majorVersion));
        this.notificationService.prompt(
          Severity.Warning,
          message,
          [{
            label: localize("learnMore", "Learn More"),
            run: () => this.openerService.open(URI.parse("https://aka.ms/vscode-faq-old-macOS"))
          }],
          {
            neverShowAgain: { id: "macoseol", isSecondary: true, scope: NeverShowAgainScope.APPLICATION },
            priority: NotificationPriority.URGENT,
            sticky: true
          }
        );
      }
    }
    const shellEnv = process.shellEnv();
    this.progressService.withProgress({
      title: localize("resolveShellEnvironment", "Resolving shell environment..."),
      location: ProgressLocation.Window,
      delay: 1600,
      buttons: [localize("learnMore", "Learn More")]
    }, () => shellEnv, () => this.openerService.open("https://go.microsoft.com/fwlink/?linkid=2149667"));
  }
  setupDriver() {
    const that = this;
    let pendingQuit = false;
    registerWindowDriver(this.instantiationService, {
      async exitApplication() {
        if (pendingQuit) {
          that.logService.info("[driver] not handling exitApplication() due to pending quit() call");
          return;
        }
        that.logService.info("[driver] handling exitApplication()");
        pendingQuit = true;
        return that.nativeHostService.quit();
      }
    });
  }
  async resolveExternalUri(uri, options) {
    let queryTunnel;
    if (options?.allowTunneling) {
      const portMappingRequest = extractLocalHostUriMetaDataForPortMapping(uri);
      const queryPortMapping = extractQueryLocalHostUriMetaDataForPortMapping(uri);
      if (queryPortMapping) {
        queryTunnel = await this.openTunnel(queryPortMapping.address, queryPortMapping.port);
        if (queryTunnel && typeof queryTunnel !== "string") {
          if (queryTunnel.tunnelRemotePort !== queryPortMapping.port) {
            queryTunnel.dispose();
            queryTunnel = void 0;
          } else {
            if (!portMappingRequest) {
              const tunnel = queryTunnel;
              return {
                resolved: uri,
                dispose: () => tunnel.dispose()
              };
            }
          }
        }
      }
      if (portMappingRequest) {
        const tunnel = await this.openTunnel(portMappingRequest.address, portMappingRequest.port);
        if (tunnel && typeof tunnel !== "string") {
          const addressAsUri = URI.parse(tunnel.localAddress).with({ path: uri.path });
          const resolved = addressAsUri.scheme.startsWith(uri.scheme) ? addressAsUri : uri.with({ authority: tunnel.localAddress });
          return {
            resolved,
            dispose() {
              tunnel.dispose();
              if (queryTunnel && typeof queryTunnel !== "string") {
                queryTunnel.dispose();
              }
            }
          };
        }
      }
    }
    if (!options?.openExternal) {
      const canHandleResource = await this.fileService.canHandleResource(uri);
      if (canHandleResource) {
        return {
          resolved: URI.from({
            scheme: this.productService.urlProtocol,
            path: "workspace",
            query: uri.toString()
          }),
          dispose() {
          }
        };
      }
    }
    return void 0;
  }
  async openTunnel(address, port) {
    const remoteAuthority = this.environmentService.remoteAuthority;
    const addressProvider = remoteAuthority ? {
      getAddress: async () => {
        return (await this.remoteAuthorityResolverService.resolveAuthority(remoteAuthority)).authority;
      }
    } : void 0;
    const tunnel = await this.tunnelService.getExistingTunnel(address, port);
    if (!tunnel || typeof tunnel === "string") {
      return this.tunnelService.openTunnel(addressProvider, address, port);
    }
    return tunnel;
  }
  setupOpenHandlers() {
    this.openerService.setDefaultExternalOpener({
      openExternal: async (href) => {
        const success = await this.nativeHostService.openExternal(href, this.configurationService.getValue("workbench.externalBrowser"));
        if (!success) {
          const fileCandidate = URI.parse(href);
          if (fileCandidate.scheme === Schemas.file) {
            await this.nativeHostService.showItemInFolder(fileCandidate.fsPath);
          }
        }
        return true;
      }
    });
    this.openerService.registerExternalUriResolver({
      resolveExternalUri: async (uri, options) => {
        return this.resolveExternalUri(uri, options);
      }
    });
  }
  updateTouchbarMenu() {
    if (!isMacintosh) {
      return;
    }
    this.touchBarDisposables.clear();
    this.touchBarMenu = void 0;
    const scheduler = this.touchBarDisposables.add(new RunOnceScheduler(() => this.doUpdateTouchbarMenu(scheduler), 300));
    scheduler.schedule();
  }
  doUpdateTouchbarMenu(scheduler) {
    if (!this.touchBarMenu) {
      const scopedContextKeyService = this.editorService.activeEditorPane?.scopedContextKeyService || this.editorGroupService.activeGroup.scopedContextKeyService;
      this.touchBarMenu = this.menuService.createMenu(MenuId.TouchBarContext, scopedContextKeyService);
      this.touchBarDisposables.add(this.touchBarMenu);
      this.touchBarDisposables.add(this.touchBarMenu.onDidChange(() => scheduler.schedule()));
    }
    const disabled = this.configurationService.getValue("keyboard.touchbar.enabled") === false;
    const touchbarIgnored = this.configurationService.getValue("keyboard.touchbar.ignored");
    const ignoredItems = Array.isArray(touchbarIgnored) ? touchbarIgnored : [];
    const actions = getFlatActionBarActions(this.touchBarMenu.getActions());
    const items = [];
    let group = [];
    if (!disabled) {
      for (const action of actions) {
        if (action instanceof MenuItemAction) {
          if (ignoredItems.indexOf(action.item.id) >= 0) {
            continue;
          }
          group.push(action.item);
        } else if (action instanceof Separator) {
          if (group.length) {
            items.push(group);
          }
          group = [];
        }
      }
      if (group.length) {
        items.push(group);
      }
    }
    if (!equals(this.lastInstalledTouchedBar, items)) {
      this.lastInstalledTouchedBar = items;
      this.nativeHostService.updateTouchBar(items);
    }
  }
  //#endregion
  onAddRemoveFoldersRequest(request) {
    this.pendingFoldersToAdd.push(...request.foldersToAdd.map((folder) => URI.revive(folder)));
    this.pendingFoldersToRemove.push(...request.foldersToRemove.map((folder) => URI.revive(folder)));
    if (!this.addRemoveFoldersScheduler.isScheduled()) {
      this.addRemoveFoldersScheduler.schedule();
    }
  }
  async doAddRemoveFolders() {
    const foldersToAdd = this.pendingFoldersToAdd.map((folder) => ({ uri: folder }));
    const foldersToRemove = this.pendingFoldersToRemove.slice(0);
    this.pendingFoldersToAdd = [];
    this.pendingFoldersToRemove = [];
    if (foldersToAdd.length) {
      await this.workspaceEditingService.addFolders(foldersToAdd);
    }
    if (foldersToRemove.length) {
      await this.workspaceEditingService.removeFolders(foldersToRemove);
    }
  }
  async onOpenFiles(request) {
    const diffMode = !!(request.filesToDiff && request.filesToDiff.length === 2);
    const mergeMode = !!(request.filesToMerge && request.filesToMerge.length === 4);
    const inputs = coalesce(await pathsToEditors(mergeMode ? request.filesToMerge : diffMode ? request.filesToDiff : request.filesToOpenOrCreate, this.fileService, this.logService));
    if (inputs.length) {
      const openedEditorPanes = await this.openResources(inputs, diffMode, mergeMode);
      if (request.filesToWait) {
        if (openedEditorPanes.length) {
          return this.trackClosedWaitFiles(URI.revive(request.filesToWait.waitMarkerFileUri), coalesce(request.filesToWait.paths.map((path) => URI.revive(path.fileUri))));
        } else {
          return this.fileService.del(URI.revive(request.filesToWait.waitMarkerFileUri));
        }
      }
    }
  }
  async trackClosedWaitFiles(waitMarkerFile, resourcesToWaitFor) {
    await this.instantiationService.invokeFunction((accessor) => whenEditorClosed(accessor, resourcesToWaitFor));
    await this.fileService.del(waitMarkerFile);
  }
  async openResources(resources, diffMode, mergeMode) {
    const editors = [];
    if (mergeMode && isResourceEditorInput(resources[0]) && isResourceEditorInput(resources[1]) && isResourceEditorInput(resources[2]) && isResourceEditorInput(resources[3])) {
      const mergeEditor = {
        input1: { resource: resources[0].resource },
        input2: { resource: resources[1].resource },
        base: { resource: resources[2].resource },
        result: { resource: resources[3].resource },
        options: { pinned: true }
      };
      editors.push(mergeEditor);
    } else if (diffMode && isResourceEditorInput(resources[0]) && isResourceEditorInput(resources[1])) {
      const diffEditor = {
        original: { resource: resources[0].resource },
        modified: { resource: resources[1].resource },
        options: { pinned: true }
      };
      editors.push(diffEditor);
    } else {
      editors.push(...resources);
    }
    return this.editorService.openEditors(editors, void 0, { validateTrust: true });
  }
  resolveConfiguredWindowZoomLevel() {
    const windowZoomLevel = this.configurationService.getValue("window.zoomLevel");
    return typeof windowZoomLevel === "number" ? windowZoomLevel : 0;
  }
  handleOnDidChangeZoomLevel(targetWindowId) {
    this.updateWindowZoomStatusEntry(targetWindowId);
    if (targetWindowId === mainWindow.vscodeWindowId) {
      const currentWindowZoomLevel = getZoomLevel(mainWindow);
      let notifyZoomLevel = void 0;
      if (this.configuredWindowZoomLevel !== currentWindowZoomLevel) {
        notifyZoomLevel = currentWindowZoomLevel;
      }
      ipcRenderer.invoke("vscode:notifyZoomLevel", notifyZoomLevel);
    }
  }
  createWindowZoomStatusEntry(part) {
    const disposables = new DisposableStore();
    Event.once(part.onWillDispose)(() => disposables.dispose());
    const scopedInstantiationService = this.editorGroupService.getScopedInstantiationService(part);
    this.mapWindowIdToZoomStatusEntry.set(part.windowId, disposables.add(scopedInstantiationService.createInstance(ZoomStatusEntry)));
    disposables.add(toDisposable(() => this.mapWindowIdToZoomStatusEntry.delete(part.windowId)));
    this.updateWindowZoomStatusEntry(part.windowId);
  }
  updateWindowZoomStatusEntry(targetWindowId) {
    const targetWindow = getWindowById(targetWindowId);
    const entry = this.mapWindowIdToZoomStatusEntry.get(targetWindowId);
    if (entry && targetWindow) {
      const currentZoomLevel = getZoomLevel(targetWindow.window);
      let text = void 0;
      if (currentZoomLevel < this.configuredWindowZoomLevel) {
        text = "$(zoom-out)";
      } else if (currentZoomLevel > this.configuredWindowZoomLevel) {
        text = "$(zoom-in)";
      }
      entry.updateZoomEntry(text ?? false, targetWindowId);
    }
  }
  onDidChangeConfiguredWindowZoomLevel() {
    this.configuredWindowZoomLevel = this.resolveConfiguredWindowZoomLevel();
    let applyZoomLevel = false;
    for (const { window } of getWindows()) {
      if (getZoomLevel(window) !== this.configuredWindowZoomLevel) {
        applyZoomLevel = true;
        break;
      }
    }
    if (applyZoomLevel) {
      applyZoom(this.configuredWindowZoomLevel, ApplyZoomTarget.ALL_WINDOWS);
    }
    for (const [windowId] of this.mapWindowIdToZoomStatusEntry) {
      this.updateWindowZoomStatusEntry(windowId);
    }
  }
  //#endregion
  dispose() {
    super.dispose();
    for (const [, entry] of this.mapWindowIdToZoomStatusEntry) {
      entry.dispose();
    }
  }
};
NativeWindow = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ITitleService),
  __decorateParam(4, IWorkbenchThemeService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IWorkspaceEditingService),
  __decorateParam(10, IFileService),
  __decorateParam(11, IMenuService),
  __decorateParam(12, ILifecycleService),
  __decorateParam(13, IIntegrityService),
  __decorateParam(14, INativeWorkbenchEnvironmentService),
  __decorateParam(15, IAccessibilityService),
  __decorateParam(16, IWorkspaceContextService),
  __decorateParam(17, IOpenerService),
  __decorateParam(18, INativeHostService),
  __decorateParam(19, ITunnelService),
  __decorateParam(20, IWorkbenchLayoutService),
  __decorateParam(21, IWorkingCopyService),
  __decorateParam(22, IFilesConfigurationService),
  __decorateParam(23, IProductService),
  __decorateParam(24, IRemoteAuthorityResolverService),
  __decorateParam(25, IDialogService),
  __decorateParam(26, IStorageService),
  __decorateParam(27, ILogService),
  __decorateParam(28, IInstantiationService),
  __decorateParam(29, ISharedProcessService),
  __decorateParam(30, IProgressService),
  __decorateParam(31, ILabelService),
  __decorateParam(32, IBannerService),
  __decorateParam(33, IUriIdentityService),
  __decorateParam(34, IPreferencesService),
  __decorateParam(35, IUtilityProcessWorkerWorkbenchService),
  __decorateParam(36, IHostService)
], NativeWindow);
let ZoomStatusEntry = class extends Disposable {
  constructor(statusbarService, commandService, keybindingService) {
    super();
    this.statusbarService = statusbarService;
    this.commandService = commandService;
    this.keybindingService = keybindingService;
    this.disposable = this._register(new MutableDisposable());
    this.zoomLevelLabel = void 0;
  }
  updateZoomEntry(visibleOrText, targetWindowId) {
    if (typeof visibleOrText === "string") {
      if (!this.disposable.value) {
        this.createZoomEntry(visibleOrText);
      }
      this.updateZoomLevelLabel(targetWindowId);
    } else {
      this.disposable.clear();
    }
  }
  createZoomEntry(visibleOrText) {
    const disposables = new DisposableStore();
    this.disposable.value = disposables;
    const container = $(".zoom-status");
    const left = $(".zoom-status-left");
    container.appendChild(left);
    const zoomOutAction = disposables.add(new Action("workbench.action.zoomOut", localize("zoomOut", "Zoom Out"), ThemeIcon.asClassName(Codicon.remove), true, () => this.commandService.executeCommand(zoomOutAction.id)));
    const zoomInAction = disposables.add(new Action("workbench.action.zoomIn", localize("zoomIn", "Zoom In"), ThemeIcon.asClassName(Codicon.plus), true, () => this.commandService.executeCommand(zoomInAction.id)));
    const zoomResetAction = disposables.add(new Action("workbench.action.zoomReset", localize("zoomReset", "Reset"), void 0, true, () => this.commandService.executeCommand(zoomResetAction.id)));
    zoomResetAction.tooltip = localize("zoomResetLabel", "{0} ({1})", zoomResetAction.label, this.keybindingService.lookupKeybinding(zoomResetAction.id)?.getLabel());
    const zoomSettingsAction = disposables.add(new Action("workbench.action.openSettings", localize("zoomSettings", "Settings"), ThemeIcon.asClassName(Codicon.settingsGear), true, () => this.commandService.executeCommand(zoomSettingsAction.id, "window.zoom")));
    const zoomLevelLabel = disposables.add(new Action("zoomLabel", void 0, void 0, false));
    this.zoomLevelLabel = zoomLevelLabel;
    disposables.add(toDisposable(() => this.zoomLevelLabel = void 0));
    const actionBarLeft = disposables.add(new ActionBar(left, { hoverDelegate: nativeHoverDelegate }));
    actionBarLeft.push(zoomOutAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomOutAction.id)?.getLabel() });
    actionBarLeft.push(this.zoomLevelLabel, { icon: false, label: true });
    actionBarLeft.push(zoomInAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomInAction.id)?.getLabel() });
    const right = $(".zoom-status-right");
    container.appendChild(right);
    const actionBarRight = disposables.add(new ActionBar(right, { hoverDelegate: nativeHoverDelegate }));
    actionBarRight.push(zoomResetAction, { icon: false, label: true });
    actionBarRight.push(zoomSettingsAction, { icon: true, label: false, keybinding: this.keybindingService.lookupKeybinding(zoomSettingsAction.id)?.getLabel() });
    const name = localize("status.windowZoom", "Window Zoom");
    disposables.add(this.statusbarService.addEntry({
      name,
      text: visibleOrText,
      tooltip: container,
      ariaLabel: name,
      command: ShowTooltipCommand,
      kind: "prominent"
    }, "status.windowZoom", StatusbarAlignment.RIGHT, 102));
  }
  updateZoomLevelLabel(targetWindowId) {
    if (this.zoomLevelLabel) {
      const targetWindow = getWindowById(targetWindowId, true).window;
      const zoomFactor = Math.round(getZoomFactor(targetWindow) * 100);
      const zoomLevel = getZoomLevel(targetWindow);
      this.zoomLevelLabel.label = `${zoomLevel}`;
      this.zoomLevelLabel.tooltip = localize("zoomNumber", "Zoom Level: {0} ({1}%)", zoomLevel, zoomFactor);
    }
  }
};
ZoomStatusEntry = __decorateClass([
  __decorateParam(0, IStatusbarService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IKeybindingService)
], ZoomStatusEntry);
export {
  NativeWindow
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvZWxlY3Ryb24tc2FuZGJveC93aW5kb3cudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvd2luZG93LmNzcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBFdmVudFR5cGUsIEV2ZW50SGVscGVyLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIE1vZGlmaWVyS2V5RW1pdHRlciwgZ2V0QWN0aXZlRWxlbWVudCwgaGFzV2luZG93LCBnZXRXaW5kb3dCeUlkLCBnZXRXaW5kb3dzLCAkIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIFNlcGFyYXRvciwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbiwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEVkaXRvclJlc291cmNlQWNjZXNzb3IsIElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0LCBTaWRlQnlTaWRlRWRpdG9yLCBwYXRoc1RvRWRpdG9ycywgSVJlc291cmNlRGlmZkVkaXRvcklucHV0LCBJVW50eXBlZEVkaXRvcklucHV0LCBJRWRpdG9yUGFuZSwgaXNSZXNvdXJjZUVkaXRvcklucHV0LCBJUmVzb3VyY2VNZXJnZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IFdpbmRvd01pbmltdW1TaXplLCBJT3BlbkZpbGVSZXF1ZXN0LCBJQWRkUmVtb3ZlRm9sZGVyc1JlcXVlc3QsIElOYXRpdmVSdW5BY3Rpb25JbldpbmRvd1JlcXVlc3QsIElOYXRpdmVSdW5LZXliaW5kaW5nSW5XaW5kb3dSZXF1ZXN0LCBJTmF0aXZlT3BlbkZpbGVSZXF1ZXN0LCBoYXNOYXRpdmVUaXRsZWJhciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IElUaXRsZVNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy90aXRsZS9icm93c2VyL3RpdGxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvdGhlbWVzL2NvbW1vbi93b3JrYmVuY2hUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQXBwbHlab29tVGFyZ2V0LCBhcHBseVpvb20gfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS93aW5kb3cvZWxlY3Ryb24tc2FuZGJveC93aW5kb3cuanMnO1xuaW1wb3J0IHsgc2V0RnVsbHNjcmVlbiwgZ2V0Wm9vbUxldmVsLCBvbkRpZENoYW5nZVpvb21MZXZlbCwgZ2V0Wm9vbUZhY3RvciB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSwgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGlwY1JlbmRlcmVyLCBwcm9jZXNzIH0gZnJvbSAnLi4vLi4vYmFzZS9wYXJ0cy9zYW5kYm94L2VsZWN0cm9uLXNhbmRib3gvZ2xvYmFscy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlRWRpdGluZ1NlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VFZGl0aW5nLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkLCBJTWVudSwgTWVudUl0ZW1BY3Rpb24sIE1lbnVSZWdpc3RyeSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRBY3Rpb24gfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRGbGF0QWN0aW9uQmFyQWN0aW9ucyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlLCBJTGlmZWN5Y2xlU2VydmljZSwgV2lsbFNodXRkb3duRXZlbnQsIFNodXRkb3duUmVhc29uLCBCZWZvcmVTaHV0ZG93bkVycm9yRXZlbnQsIEJlZm9yZVNodXRkb3duRXZlbnQgfSBmcm9tICcuLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlRm9sZGVyQ3JlYXRpb25EYXRhIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlcy5qcyc7XG5pbXBvcnQgeyBJSW50ZWdyaXR5U2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL2ludGVncml0eS9jb21tb24vaW50ZWdyaXR5LmpzJztcbmltcG9ydCB7IGlzV2luZG93cywgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgTmV2ZXJTaG93QWdhaW5TY29wZSwgTm90aWZpY2F0aW9uUHJpb3JpdHksIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvZW52aXJvbm1lbnQvZWxlY3Ryb24tc2FuZGJveC9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLCBBY2Nlc3NpYmlsaXR5U3VwcG9ydCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoU3RhdGUsIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25UYXJnZXQsIElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlLCBJUmVzb2x2ZWRFeHRlcm5hbFVyaSwgT3Blbk9wdGlvbnMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9uYXRpdmUvY29tbW9uL25hdGl2ZS5qcyc7XG5pbXBvcnQgeyBwb3NpeCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgSVR1bm5lbFNlcnZpY2UsIFJlbW90ZVR1bm5lbCwgZXh0cmFjdExvY2FsSG9zdFVyaU1ldGFEYXRhRm9yUG9ydE1hcHBpbmcsIGV4dHJhY3RRdWVyeUxvY2FsSG9zdFVyaU1ldGFEYXRhRm9yUG9ydE1hcHBpbmcgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90dW5uZWwvY29tbW9uL3R1bm5lbC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgcG9zaXRpb25Gcm9tU3RyaW5nLCBQb3NpdGlvbiB9IGZyb20gJy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5U2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi93b3JraW5nQ29weVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMgfSBmcm9tICcuLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBdXRob3JpdHlSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJQWRkcmVzc1Byb3ZpZGVyLCBJQWRkcmVzcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRDb25uZWN0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlLCBJRWRpdG9yUGFydCB9IGZyb20gJy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgQXV0aEluZm8gfSBmcm9tICcuLi8uLi9iYXNlL3BhcnRzL3NhbmRib3gvZWxlY3Ryb24tc2FuZGJveC9lbGVjdHJvblR5cGVzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyB3aGVuRWRpdG9yQ2xvc2VkIH0gZnJvbSAnLi4vYnJvd3Nlci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVNoYXJlZFByb2Nlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaXBjL2VsZWN0cm9uLXNhbmRib3gvc2VydmljZXMuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUJhbm5lclNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9iYW5uZXIvYnJvd3Nlci9iYW5uZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgSVV0aWxpdHlQcm9jZXNzV29ya2VyV29ya2JlbmNoU2VydmljZSB9IGZyb20gJy4uL3NlcnZpY2VzL3V0aWxpdHlQcm9jZXNzL2VsZWN0cm9uLXNhbmRib3gvdXRpbGl0eVByb2Nlc3NXb3JrZXJXb3JrYmVuY2hTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyV2luZG93RHJpdmVyIH0gZnJvbSAnLi4vc2VydmljZXMvZHJpdmVyL2VsZWN0cm9uLXNhbmRib3gvZHJpdmVyLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IEJhc2VXaW5kb3cgfSBmcm9tICcuLi9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJU3RhdHVzYmFyU2VydmljZSwgU2hvd1Rvb2x0aXBDb21tYW5kLCBTdGF0dXNiYXJBbGlnbm1lbnQgfSBmcm9tICcuLi9zZXJ2aWNlcy9zdGF0dXNiYXIvYnJvd3Nlci9zdGF0dXNiYXIuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGdldFdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IER5bmFtaWNXb3JrYmVuY2hTZWN1cml0eUNvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBuYXRpdmVIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBOYXRpdmVXaW5kb3cgZXh0ZW5kcyBCYXNlV2luZG93IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGN1c3RvbVRpdGxlQ29udGV4dE1lbnVEaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGFkZFJlbW92ZUZvbGRlcnNTY2hlZHVsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmRvQWRkUmVtb3ZlRm9sZGVycygpLCAxMDApKTtcblx0cHJpdmF0ZSBwZW5kaW5nRm9sZGVyc1RvQWRkOiBVUklbXSA9IFtdO1xuXHRwcml2YXRlIHBlbmRpbmdGb2xkZXJzVG9SZW1vdmU6IFVSSVtdID0gW107XG5cblx0cHJpdmF0ZSBpc0RvY3VtZW50ZWRFZGl0ZWQgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGl0bGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGl0bGVTZXJ2aWNlOiBJVGl0bGVTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlIHByb3RlY3RlZCB0aGVtZVNlcnZpY2U6IElXb3JrYmVuY2hUaGVtZVNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VFZGl0aW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUVkaXRpbmdTZXJ2aWNlOiBJV29ya3NwYWNlRWRpdGluZ1NlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElJbnRlZ3JpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW50ZWdyaXR5U2VydmljZTogSUludGVncml0eVNlcnZpY2UsXG5cdFx0QElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBuYXRpdmVFbnZpcm9ubWVudFNlcnZpY2U6IElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5hdGl2ZUhvc3RTZXJ2aWNlOiBJTmF0aXZlSG9zdFNlcnZpY2UsXG5cdFx0QElUdW5uZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JraW5nQ29weVNlcnZpY2U6IElXb3JraW5nQ29weVNlcnZpY2UsXG5cdFx0QElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2U6IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElTaGFyZWRQcm9jZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNoYXJlZFByb2Nlc3NTZXJ2aWNlOiBJU2hhcmVkUHJvY2Vzc1NlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElCYW5uZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYmFubmVyU2VydmljZTogSUJhbm5lclNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElQcmVmZXJlbmNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2UsXG5cdFx0QElVdGlsaXR5UHJvY2Vzc1dvcmtlcldvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1dGlsaXR5UHJvY2Vzc1dvcmtlcldvcmtiZW5jaFNlcnZpY2U6IElVdGlsaXR5UHJvY2Vzc1dvcmtlcldvcmtiZW5jaFNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKG1haW5XaW5kb3csIHVuZGVmaW5lZCwgaG9zdFNlcnZpY2UsIG5hdGl2ZUVudmlyb25tZW50U2VydmljZSk7XG5cblx0XHR0aGlzLmNvbmZpZ3VyZWRXaW5kb3dab29tTGV2ZWwgPSB0aGlzLnJlc29sdmVDb25maWd1cmVkV2luZG93Wm9vbUxldmVsKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fVxuXG5cdHByb3RlY3RlZCByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblxuXHRcdC8vIExheW91dFxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihtYWluV2luZG93LCBFdmVudFR5cGUuUkVTSVpFLCAoKSA9PiB0aGlzLmxheW91dFNlcnZpY2UubGF5b3V0KCkpKTtcblxuXHRcdC8vIFJlYWN0IHRvIGVkaXRvciBpbnB1dCBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlVG91Y2hiYXJNZW51KCkpKTtcblxuXHRcdC8vIFByZXZlbnQgb3BlbmluZyBhIHJlYWwgVVJMIGluc2lkZSB0aGUgd2luZG93XG5cdFx0Zm9yIChjb25zdCBldmVudCBvZiBbRXZlbnRUeXBlLkRSQUdfT1ZFUiwgRXZlbnRUeXBlLkRST1BdKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIobWFpbldpbmRvdy5kb2N1bWVudC5ib2R5LCBldmVudCwgKGU6IERyYWdFdmVudCkgPT4ge1xuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIFN1cHBvcnQgYHJ1bkFjdGlvbmAgZXZlbnRcblx0XHRpcGNSZW5kZXJlci5vbigndnNjb2RlOnJ1bkFjdGlvbicsIGFzeW5jIChldmVudDogdW5rbm93biwgcmVxdWVzdDogSU5hdGl2ZVJ1bkFjdGlvbkluV2luZG93UmVxdWVzdCkgPT4ge1xuXHRcdFx0Y29uc3QgYXJnczogdW5rbm93bltdID0gcmVxdWVzdC5hcmdzIHx8IFtdO1xuXG5cdFx0XHQvLyBJZiB3ZSBydW4gYW4gYWN0aW9uIGZyb20gdGhlIHRvdWNoYmFyLCB3ZSBmaWxsIGluIHRoZSBjdXJyZW50bHkgYWN0aXZlIHJlc291cmNlXG5cdFx0XHQvLyBhcyBwYXlsb2FkIGJlY2F1c2UgdGhlIHRvdWNoIGJhciBpdGVtcyBhcmUgY29udGV4dCBhd2FyZSBkZXBlbmRpbmcgb24gdGhlIGVkaXRvclxuXHRcdFx0aWYgKHJlcXVlc3QuZnJvbSA9PT0gJ3RvdWNoYmFyJykge1xuXHRcdFx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yO1xuXHRcdFx0XHRpZiAoYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdFx0XHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0XHRcdFx0YXJncy5wdXNoKHJlc291cmNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFyZ3MucHVzaCh7IGZyb206IHJlcXVlc3QuZnJvbSB9KTtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChyZXF1ZXN0LmlkLCAuLi5hcmdzKTtcblxuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiByZXF1ZXN0LmlkLCBmcm9tOiByZXF1ZXN0LmZyb20gfSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gU3VwcG9ydCBydW5LZXliaW5kaW5nIGV2ZW50XG5cdFx0aXBjUmVuZGVyZXIub24oJ3ZzY29kZTpydW5LZXliaW5kaW5nJywgKGV2ZW50OiB1bmtub3duLCByZXF1ZXN0OiBJTmF0aXZlUnVuS2V5YmluZGluZ0luV2luZG93UmVxdWVzdCkgPT4ge1xuXHRcdFx0Y29uc3QgYWN0aXZlRWxlbWVudCA9IGdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRcdGlmIChhY3RpdmVFbGVtZW50KSB7XG5cdFx0XHRcdHRoaXMua2V5YmluZGluZ1NlcnZpY2UuZGlzcGF0Y2hCeVVzZXJTZXR0aW5nc0xhYmVsKHJlcXVlc3QudXNlclNldHRpbmdzTGFiZWwsIGFjdGl2ZUVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gU2hhcmVkIFByb2Nlc3MgY3Jhc2ggcmVwb3J0ZWQgZnJvbSBtYWluXG5cdFx0aXBjUmVuZGVyZXIub24oJ3ZzY29kZTpyZXBvcnRTaGFyZWRQcm9jZXNzQ3Jhc2gnLCAoZXZlbnQ6IHVua25vd24sIGVycm9yOiBzdHJpbmcpID0+IHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRcdFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRsb2NhbGl6ZSgnc2hhcmVkUHJvY2Vzc0NyYXNoJywgXCJBIHNoYXJlZCBiYWNrZ3JvdW5kIHByb2Nlc3MgdGVybWluYXRlZCB1bmV4cGVjdGVkbHkuIFBsZWFzZSByZXN0YXJ0IHRoZSBhcHBsaWNhdGlvbiB0byByZWNvdmVyLlwiKSxcblx0XHRcdFx0W3tcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3Jlc3RhcnQnLCBcIlJlc3RhcnRcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLm5hdGl2ZUhvc3RTZXJ2aWNlLnJlbGF1bmNoKClcblx0XHRcdFx0fV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRwcmlvcml0eTogTm90aWZpY2F0aW9uUHJpb3JpdHkuVVJHRU5UXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHQvLyBTdXBwb3J0IG9wZW5GaWxlcyBldmVudCBmb3IgZXhpc3RpbmcgYW5kIG5ldyBmaWxlc1xuXHRcdGlwY1JlbmRlcmVyLm9uKCd2c2NvZGU6b3BlbkZpbGVzJywgKGV2ZW50OiB1bmtub3duLCByZXF1ZXN0OiBJT3BlbkZpbGVSZXF1ZXN0KSA9PiB7IHRoaXMub25PcGVuRmlsZXMocmVxdWVzdCk7IH0pO1xuXG5cdFx0Ly8gU3VwcG9ydCBhZGRSZW1vdmVGb2xkZXJzIGV2ZW50IGZvciB3b3Jrc3BhY2UgbWFuYWdlbWVudFxuXHRcdGlwY1JlbmRlcmVyLm9uKCd2c2NvZGU6YWRkUmVtb3ZlRm9sZGVycycsIChldmVudDogdW5rbm93biwgcmVxdWVzdDogSUFkZFJlbW92ZUZvbGRlcnNSZXF1ZXN0KSA9PiB0aGlzLm9uQWRkUmVtb3ZlRm9sZGVyc1JlcXVlc3QocmVxdWVzdCkpO1xuXG5cdFx0Ly8gTWVzc2FnZSBzdXBwb3J0XG5cdFx0aXBjUmVuZGVyZXIub24oJ3ZzY29kZTpzaG93SW5mb01lc3NhZ2UnLCAoZXZlbnQ6IHVua25vd24sIG1lc3NhZ2U6IHN0cmluZykgPT4gdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obWVzc2FnZSkpO1xuXG5cdFx0Ly8gU2hlbGwgRW52aXJvbm1lbnQgSXNzdWUgTm90aWZpY2F0aW9uc1xuXHRcdGlwY1JlbmRlcmVyLm9uKCd2c2NvZGU6c2hvd1Jlc29sdmVTaGVsbEVudkVycm9yJywgKGV2ZW50OiB1bmtub3duLCBtZXNzYWdlOiBzdHJpbmcpID0+IHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRcdFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRtZXNzYWdlLFxuXHRcdFx0XHRbe1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncmVzdGFydCcsIFwiUmVzdGFydFwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMubmF0aXZlSG9zdFNlcnZpY2UucmVsYXVuY2goKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdjb25maWd1cmUnLCBcIkNvbmZpZ3VyZVwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMucHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5Vc2VyU2V0dGluZ3MoeyBxdWVyeTogJ2FwcGxpY2F0aW9uLnNoZWxsRW52aXJvbm1lbnRSZXNvbHV0aW9uVGltZW91dCcgfSlcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbGVhcm5Nb3JlJywgXCJMZWFybiBNb3JlXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oJ2h0dHBzOi8vZ28ubWljcm9zb2Z0LmNvbS9md2xpbmsvP2xpbmtpZD0yMTQ5NjY3Jylcblx0XHRcdFx0fV1cblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHRpcGNSZW5kZXJlci5vbigndnNjb2RlOnNob3dDcmVkZW50aWFsc0Vycm9yJywgKGV2ZW50OiB1bmtub3duLCBtZXNzYWdlOiBzdHJpbmcpID0+IHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRcdFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRsb2NhbGl6ZSgna2V5Y2hhaW5Xcml0ZUVycm9yJywgXCJXcml0aW5nIGxvZ2luIGluZm9ybWF0aW9uIHRvIHRoZSBrZXljaGFpbiBmYWlsZWQgd2l0aCBlcnJvciAnezB9Jy5cIiwgbWVzc2FnZSksXG5cdFx0XHRcdFt7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCd0cm91Ymxlc2hvb3RpbmcnLCBcIlRyb3VibGVzaG9vdGluZyBHdWlkZVwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKCdodHRwczovL2dvLm1pY3Jvc29mdC5jb20vZndsaW5rLz9saW5raWQ9MjE5MDcxMycpXG5cdFx0XHRcdH1dXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0aXBjUmVuZGVyZXIub24oJ3ZzY29kZTpzaG93VHJhbnNsYXRlZEJ1aWxkV2FybmluZycsICgpID0+IHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRcdFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRcdGxvY2FsaXplKFwicnVubmluZ1RyYW5zbGF0ZWRcIiwgXCJZb3UgYXJlIHJ1bm5pbmcgYW4gZW11bGF0ZWQgdmVyc2lvbiBvZiB7MH0uIEZvciBiZXR0ZXIgcGVyZm9ybWFuY2UgZG93bmxvYWQgdGhlIG5hdGl2ZSBhcm02NCB2ZXJzaW9uIG9mIHswfSBidWlsZCBmb3IgeW91ciBtYWNoaW5lLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSxcblx0XHRcdFx0W3tcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2Rvd25sb2FkQXJtQnVpbGQnLCBcIkRvd25sb2FkXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgcXVhbGl0eSA9IHRoaXMucHJvZHVjdFNlcnZpY2UucXVhbGl0eTtcblx0XHRcdFx0XHRcdGNvbnN0IHN0YWJsZVVSTCA9ICdodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9kb2NzLz9kdj1vc3gnO1xuXHRcdFx0XHRcdFx0Y29uc3QgaW5zaWRlcnNVUkwgPSAnaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy8/ZHY9b3N4JmJ1aWxkPWluc2lkZXJzJztcblx0XHRcdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKHF1YWxpdHkgPT09ICdzdGFibGUnID8gc3RhYmxlVVJMIDogaW5zaWRlcnNVUkwpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRwcmlvcml0eTogTm90aWZpY2F0aW9uUHJpb3JpdHkuVVJHRU5UXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHRpcGNSZW5kZXJlci5vbigndnNjb2RlOnNob3dBcmd2UGFyc2VXYXJuaW5nJywgKGV2ZW50OiB1bmtub3duLCBtZXNzYWdlOiBzdHJpbmcpID0+IHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRcdFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRcdGxvY2FsaXplKFwic2hvd0FyZ3ZQYXJzZVdhcm5pbmdcIiwgXCJUaGUgcnVudGltZSBhcmd1bWVudHMgZmlsZSAnYXJndi5qc29uJyBjb250YWlucyBlcnJvcnMuIFBsZWFzZSBjb3JyZWN0IHRoZW0gYW5kIHJlc3RhcnQuXCIpLFxuXHRcdFx0XHRbe1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2hvd0FyZ3ZQYXJzZVdhcm5pbmdBY3Rpb24nLCBcIk9wZW4gRmlsZVwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IHRoaXMubmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3ZSZXNvdXJjZSB9KVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlRcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdC8vIEZ1bGxzY3JlZW4gRXZlbnRzXG5cdFx0aXBjUmVuZGVyZXIub24oJ3ZzY29kZTplbnRlckZ1bGxTY3JlZW4nLCAoKSA9PiBzZXRGdWxsc2NyZWVuKHRydWUsIG1haW5XaW5kb3cpKTtcblx0XHRpcGNSZW5kZXJlci5vbigndnNjb2RlOmxlYXZlRnVsbFNjcmVlbicsICgpID0+IHNldEZ1bGxzY3JlZW4oZmFsc2UsIG1haW5XaW5kb3cpKTtcblxuXHRcdC8vIFByb3h5IExvZ2luIERpYWxvZ1xuXHRcdGlwY1JlbmRlcmVyLm9uKCd2c2NvZGU6b3BlblByb3h5QXV0aGVudGljYXRpb25EaWFsb2cnLCBhc3luYyAoZXZlbnQ6IHVua25vd24sIHBheWxvYWQ6IHsgYXV0aEluZm86IEF1dGhJbmZvOyB1c2VybmFtZT86IHN0cmluZzsgcGFzc3dvcmQ/OiBzdHJpbmc7IHJlcGx5Q2hhbm5lbDogc3RyaW5nIH0pID0+IHtcblx0XHRcdGNvbnN0IHJlbWVtYmVyQ3JlZGVudGlhbHNLZXkgPSAnd2luZG93LnJlbWVtYmVyUHJveHlDcmVkZW50aWFscyc7XG5cdFx0XHRjb25zdCByZW1lbWJlckNyZWRlbnRpYWxzID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKHJlbWVtYmVyQ3JlZGVudGlhbHNLZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuaW5wdXQoe1xuXHRcdFx0XHR0eXBlOiAnd2FybmluZycsXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdwcm94eUF1dGhSZXF1aXJlZCcsIFwiUHJveHkgQXV0aGVudGljYXRpb24gUmVxdWlyZWRcIiksXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnbG9naW5CdXR0b24nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZMb2cgSW5cIiksXG5cdFx0XHRcdGlucHV0czpcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHR7IHBsYWNlaG9sZGVyOiBsb2NhbGl6ZSgndXNlcm5hbWUnLCBcIlVzZXJuYW1lXCIpLCB2YWx1ZTogcGF5bG9hZC51c2VybmFtZSB9LFxuXHRcdFx0XHRcdFx0eyBwbGFjZWhvbGRlcjogbG9jYWxpemUoJ3Bhc3N3b3JkJywgXCJQYXNzd29yZFwiKSwgdHlwZTogJ3Bhc3N3b3JkJywgdmFsdWU6IHBheWxvYWQucGFzc3dvcmQgfVxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdGRldGFpbDogbG9jYWxpemUoJ3Byb3h5RGV0YWlsJywgXCJUaGUgcHJveHkgezB9IHJlcXVpcmVzIGEgdXNlcm5hbWUgYW5kIHBhc3N3b3JkLlwiLCBgJHtwYXlsb2FkLmF1dGhJbmZvLmhvc3R9OiR7cGF5bG9hZC5hdXRoSW5mby5wb3J0fWApLFxuXHRcdFx0XHRjaGVja2JveDoge1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncmVtZW1iZXJDcmVkZW50aWFscycsIFwiUmVtZW1iZXIgbXkgY3JlZGVudGlhbHNcIiksXG5cdFx0XHRcdFx0Y2hlY2tlZDogcmVtZW1iZXJDcmVkZW50aWFsc1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gUmVwbHkgYmFjayB0byB0aGUgY2hhbm5lbCB3aXRob3V0IHJlc3VsdCB0byBpbmRpY2F0ZVxuXHRcdFx0Ly8gdGhhdCB0aGUgbG9naW4gZGlhbG9nIHdhcyBjYW5jZWxsZWRcblx0XHRcdGlmICghcmVzdWx0LmNvbmZpcm1lZCB8fCAhcmVzdWx0LnZhbHVlcykge1xuXHRcdFx0XHRpcGNSZW5kZXJlci5zZW5kKHBheWxvYWQucmVwbHlDaGFubmVsKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gT3RoZXIgcmVwbHkgYmFjayB3aXRoIHRoZSBwaWNrZWQgY3JlZGVudGlhbHNcblx0XHRcdGVsc2Uge1xuXG5cdFx0XHRcdC8vIFVwZGF0ZSBzdGF0ZSBiYXNlZCBvbiBjaGVja2JveFxuXHRcdFx0XHRpZiAocmVzdWx0LmNoZWNrYm94Q2hlY2tlZCkge1xuXHRcdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUocmVtZW1iZXJDcmVkZW50aWFsc0tleSwgdHJ1ZSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKHJlbWVtYmVyQ3JlZGVudGlhbHNLZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZXBseSBiYWNrIHRvIG1haW4gc2lkZSB3aXRoIGNyZWRlbnRpYWxzXG5cdFx0XHRcdGNvbnN0IFt1c2VybmFtZSwgcGFzc3dvcmRdID0gcmVzdWx0LnZhbHVlcztcblx0XHRcdFx0aXBjUmVuZGVyZXIuc2VuZChwYXlsb2FkLnJlcGx5Q2hhbm5lbCwgeyB1c2VybmFtZSwgcGFzc3dvcmQsIHJlbWVtYmVyOiAhIXJlc3VsdC5jaGVja2JveENoZWNrZWQgfSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBBY2Nlc3NpYmlsaXR5IHN1cHBvcnQgY2hhbmdlZCBldmVudFxuXHRcdGlwY1JlbmRlcmVyLm9uKCd2c2NvZGU6YWNjZXNzaWJpbGl0eVN1cHBvcnRDaGFuZ2VkJywgKGV2ZW50OiB1bmtub3duLCBhY2Nlc3NpYmlsaXR5U3VwcG9ydEVuYWJsZWQ6IGJvb2xlYW4pID0+IHtcblx0XHRcdHRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2Uuc2V0QWNjZXNzaWJpbGl0eVN1cHBvcnQoYWNjZXNzaWJpbGl0eVN1cHBvcnRFbmFibGVkID8gQWNjZXNzaWJpbGl0eVN1cHBvcnQuRW5hYmxlZCA6IEFjY2Vzc2liaWxpdHlTdXBwb3J0LkRpc2FibGVkKTtcblx0XHR9KTtcblxuXHRcdC8vIEFsbG93IHRvIHVwZGF0ZSBzZWN1cml0eSBzZXR0aW5ncyBhcm91bmQgYWxsb3dlZCBVTkMgSG9zdFxuXHRcdGlwY1JlbmRlcmVyLm9uKCd2c2NvZGU6Y29uZmlndXJlQWxsb3dlZFVOQ0hvc3QnLCBhc3luYyAoZXZlbnQ6IHVua25vd24sIGhvc3Q6IHN0cmluZykgPT4ge1xuXHRcdFx0aWYgKCFpc1dpbmRvd3MpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyBvbmx5IHN1cHBvcnRlZCBvbiBXaW5kb3dzXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFsbG93ZWRVbmNIb3N0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdFx0XHRjb25zdCBjb25maWd1cmVkQWxsb3dlZFVuY0hvc3RzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmdbXSB8IHVuZGVmaW5lZD4oJ3NlY3VyaXR5LmFsbG93ZWRVTkNIb3N0cycsKSA/PyBbXTtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGNvbmZpZ3VyZWRBbGxvd2VkVW5jSG9zdHMpKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgY29uZmlndXJlZEFsbG93ZWRVbmNIb3N0IG9mIGNvbmZpZ3VyZWRBbGxvd2VkVW5jSG9zdHMpIHtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGNvbmZpZ3VyZWRBbGxvd2VkVW5jSG9zdCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdGFsbG93ZWRVbmNIb3N0cy5hZGQoY29uZmlndXJlZEFsbG93ZWRVbmNIb3N0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFhbGxvd2VkVW5jSG9zdHMuaGFzKGhvc3QpKSB7XG5cdFx0XHRcdGFsbG93ZWRVbmNIb3N0cy5hZGQoaG9zdCk7XG5cblx0XHRcdFx0YXdhaXQgZ2V0V29ya2JlbmNoQ29udHJpYnV0aW9uPER5bmFtaWNXb3JrYmVuY2hTZWN1cml0eUNvbmZpZ3VyYXRpb24+KER5bmFtaWNXb3JrYmVuY2hTZWN1cml0eUNvbmZpZ3VyYXRpb24uSUQpLnJlYWR5OyAvLyBlbnN1cmUgdGhpcyBzZXR0aW5nIGlzIHJlZ2lzdGVyZWRcblx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZSgnc2VjdXJpdHkuYWxsb3dlZFVOQ0hvc3RzJywgWy4uLmFsbG93ZWRVbmNIb3N0cy52YWx1ZXMoKV0sIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBBbGxvdyB0byB1cGRhdGUgc2VjdXJpdHkgc2V0dGluZ3MgYXJvdW5kIHByb3RvY29sIGhhbmRsZXJzXG5cdFx0aXBjUmVuZGVyZXIub24oJ3ZzY29kZTpkaXNhYmxlUHJvbXB0Rm9yUHJvdG9jb2xIYW5kbGluZycsIChldmVudDogdW5rbm93biwga2luZDogJ2xvY2FsJyB8ICdyZW1vdGUnKSA9PiB7XG5cdFx0XHRjb25zdCBzZXR0aW5nID0ga2luZCA9PT0gJ2xvY2FsJyA/ICdzZWN1cml0eS5wcm9tcHRGb3JMb2NhbEZpbGVQcm90b2NvbEhhbmRsaW5nJyA6ICdzZWN1cml0eS5wcm9tcHRGb3JSZW1vdGVGaWxlUHJvdG9jb2xIYW5kbGluZyc7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKHNldHRpbmcsIGZhbHNlKTtcblx0XHR9KTtcblxuXHRcdC8vIFdpbmRvdyBab29tXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignd2luZG93Lnpvb21MZXZlbCcpIHx8IChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCd3aW5kb3cuem9vbVBlcldpbmRvdycpICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3dpbmRvdy56b29tUGVyV2luZG93JykgPT09IGZhbHNlKSkge1xuXHRcdFx0XHR0aGlzLm9uRGlkQ2hhbmdlQ29uZmlndXJlZFdpbmRvd1pvb21MZXZlbCgpO1xuXHRcdFx0fSBlbHNlIGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdrZXlib2FyZC50b3VjaGJhci5lbmFibGVkJykgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbigna2V5Ym9hcmQudG91Y2hiYXIuaWdub3JlZCcpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlVG91Y2hiYXJNZW51KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIob25EaWRDaGFuZ2Vab29tTGV2ZWwodGFyZ2V0V2luZG93SWQgPT4gdGhpcy5oYW5kbGVPbkRpZENoYW5nZVpvb21MZXZlbCh0YXJnZXRXaW5kb3dJZCkpKTtcblxuXHRcdGZvciAoY29uc3QgcGFydCBvZiB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5wYXJ0cykge1xuXHRcdFx0dGhpcy5jcmVhdGVXaW5kb3dab29tU3RhdHVzRW50cnkocGFydCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JHcm91cFNlcnZpY2Uub25EaWRDcmVhdGVBdXhpbGlhcnlFZGl0b3JQYXJ0KHBhcnQgPT4gdGhpcy5jcmVhdGVXaW5kb3dab29tU3RhdHVzRW50cnkocGFydCkpKTtcblxuXHRcdC8vIExpc3RlbiB0byB2aXNpYmxlIGVkaXRvciBjaGFuZ2VzIChkZWJvdW5jZWQgaW4gY2FzZSBhIG5ldyBlZGl0b3Igb3BlbnMgaW1tZWRpYXRlbHkgYWZ0ZXIpXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZGVib3VuY2UodGhpcy5lZGl0b3JTZXJ2aWNlLm9uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2UsICgpID0+IHVuZGVmaW5lZCwgMCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdGhpcy5fc3RvcmUpKCgpID0+IHRoaXMubWF5YmVDbG9zZVdpbmRvdygpKSk7XG5cblx0XHQvLyBMaXN0ZW4gdG8gZWRpdG9yIGNsb3NpbmcgKGlmIHdlIHJ1biB3aXRoIC0td2FpdClcblx0XHRjb25zdCBmaWxlc1RvV2FpdCA9IHRoaXMubmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlLmZpbGVzVG9XYWl0O1xuXHRcdGlmIChmaWxlc1RvV2FpdCkge1xuXHRcdFx0dGhpcy50cmFja0Nsb3NlZFdhaXRGaWxlcyhmaWxlc1RvV2FpdC53YWl0TWFya2VyRmlsZVVyaSwgY29hbGVzY2UoZmlsZXNUb1dhaXQucGF0aHMubWFwKHBhdGggPT4gcGF0aC5maWxlVXJpKSkpO1xuXHRcdH1cblxuXHRcdC8vIG1hY09TIE9TIGludGVncmF0aW9uOiByZXByZXNlbnRlZCBmaWxlIG5hbWVcblx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdGZvciAoY29uc3QgcGFydCBvZiB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5wYXJ0cykge1xuXHRcdFx0XHR0aGlzLmhhbmRsZVJlcHJlc2VudGVkRmlsZW5hbWUocGFydCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm9uRGlkQ3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydChwYXJ0ID0+IHRoaXMuaGFuZGxlUmVwcmVzZW50ZWRGaWxlbmFtZShwYXJ0KSkpO1xuXHRcdH1cblxuXHRcdC8vIERvY3VtZW50IGVkaXRlZDogaW5kaWNhdGUgZm9yIGRpcnR5IHdvcmtpbmcgY29waWVzXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3JraW5nQ29weVNlcnZpY2Uub25EaWRDaGFuZ2VEaXJ0eSh3b3JraW5nQ29weSA9PiB7XG5cdFx0XHRjb25zdCBnb3REaXJ0eSA9IHdvcmtpbmdDb3B5LmlzRGlydHkoKTtcblx0XHRcdGlmIChnb3REaXJ0eSAmJiAhKHdvcmtpbmdDb3B5LmNhcGFiaWxpdGllcyAmIFdvcmtpbmdDb3B5Q2FwYWJpbGl0aWVzLlVudGl0bGVkKSAmJiB0aGlzLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuaGFzU2hvcnRBdXRvU2F2ZURlbGF5KHdvcmtpbmdDb3B5LnJlc291cmNlKSkge1xuXHRcdFx0XHRyZXR1cm47IC8vIGRvIG5vdCBpbmRpY2F0ZSBkaXJ0eSBvZiB3b3JraW5nIGNvcGllcyB0aGF0IGFyZSBhdXRvIHNhdmVkIGFmdGVyIHNob3J0IGRlbGF5XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudXBkYXRlRG9jdW1lbnRFZGl0ZWQoZ290RGlydHkgPyB0cnVlIDogdW5kZWZpbmVkKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLnVwZGF0ZURvY3VtZW50RWRpdGVkKHVuZGVmaW5lZCk7XG5cblx0XHQvLyBEZXRlY3QgbWluaW1pemUgLyBtYXhpbWl6ZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueShcblx0XHRcdEV2ZW50Lm1hcChFdmVudC5maWx0ZXIodGhpcy5uYXRpdmVIb3N0U2VydmljZS5vbkRpZE1heGltaXplV2luZG93LCB3aW5kb3dJZCA9PiAhIWhhc1dpbmRvdyh3aW5kb3dJZCkpLCB3aW5kb3dJZCA9PiAoeyBtYXhpbWl6ZWQ6IHRydWUsIHdpbmRvd0lkIH0pKSxcblx0XHRcdEV2ZW50Lm1hcChFdmVudC5maWx0ZXIodGhpcy5uYXRpdmVIb3N0U2VydmljZS5vbkRpZFVubWF4aW1pemVXaW5kb3csIHdpbmRvd0lkID0+ICEhaGFzV2luZG93KHdpbmRvd0lkKSksIHdpbmRvd0lkID0+ICh7IG1heGltaXplZDogZmFsc2UsIHdpbmRvd0lkIH0pKVxuXHRcdCkoZSA9PiB0aGlzLmxheW91dFNlcnZpY2UudXBkYXRlV2luZG93TWF4aW1pemVkU3RhdGUoZ2V0V2luZG93QnlJZChlLndpbmRvd0lkKSEud2luZG93LCBlLm1heGltaXplZCkpKTtcblx0XHR0aGlzLmxheW91dFNlcnZpY2UudXBkYXRlV2luZG93TWF4aW1pemVkU3RhdGUobWFpbldpbmRvdywgdGhpcy5uYXRpdmVFbnZpcm9ubWVudFNlcnZpY2Uud2luZG93Lm1heGltaXplZCA/PyBmYWxzZSk7XG5cblx0XHQvLyBEZXRlY3QgcGFuZWwgcG9zaXRpb24gdG8gZGV0ZXJtaW5lIG1pbmltdW0gd2lkdGhcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxheW91dFNlcnZpY2Uub25EaWRDaGFuZ2VQYW5lbFBvc2l0aW9uKHBvcyA9PiB0aGlzLm9uRGlkQ2hhbmdlUGFuZWxQb3NpdGlvbihwb3NpdGlvbkZyb21TdHJpbmcocG9zKSkpKTtcblx0XHR0aGlzLm9uRGlkQ2hhbmdlUGFuZWxQb3NpdGlvbih0aGlzLmxheW91dFNlcnZpY2UuZ2V0UGFuZWxQb3NpdGlvbigpKTtcblxuXHRcdC8vIExpZmVjeWNsZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlmZWN5Y2xlU2VydmljZS5vbkJlZm9yZVNodXRkb3duKGUgPT4gdGhpcy5vbkJlZm9yZVNodXRkb3duKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5saWZlY3ljbGVTZXJ2aWNlLm9uQmVmb3JlU2h1dGRvd25FcnJvcihlID0+IHRoaXMub25CZWZvcmVTaHV0ZG93bkVycm9yKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5saWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKGUgPT4gdGhpcy5vbldpbGxTaHV0ZG93bihlKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVSZXByZXNlbnRlZEZpbGVuYW1lKHBhcnQ6IElFZGl0b3JQYXJ0KTogdm9pZCB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0RXZlbnQub25jZShwYXJ0Lm9uV2lsbERpc3Bvc2UpKCgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSk7XG5cblx0XHRjb25zdCBzY29wZWRFZGl0b3JTZXJ2aWNlID0gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuZ2V0U2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UocGFydCkuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNjb3BlZEVkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKCkgPT4gdGhpcy51cGRhdGVSZXByZXNlbnRlZEZpbGVuYW1lKHNjb3BlZEVkaXRvclNlcnZpY2UsIHBhcnQud2luZG93SWQpKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVJlcHJlc2VudGVkRmlsZW5hbWUoZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsIHRhcmdldFdpbmRvd0lkOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCBmaWxlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZLCBmaWx0ZXJCeVNjaGVtZTogU2NoZW1hcy5maWxlIH0pO1xuXG5cdFx0Ly8gUmVwcmVzZW50ZWQgRmlsZW5hbWVcblx0XHR0aGlzLm5hdGl2ZUhvc3RTZXJ2aWNlLnNldFJlcHJlc2VudGVkRmlsZW5hbWUoZmlsZT8uZnNQYXRoID8/ICcnLCB7IHRhcmdldFdpbmRvd0lkIH0pO1xuXG5cdFx0Ly8gQ3VzdG9tIHRpdGxlIG1lbnUgKG1haW4gd2luZG93IG9ubHkgY3VycmVudGx5KVxuXHRcdGlmICh0YXJnZXRXaW5kb3dJZCA9PT0gbWFpbldpbmRvdy52c2NvZGVXaW5kb3dJZCkge1xuXHRcdFx0dGhpcy5wcm92aWRlQ3VzdG9tVGl0bGVDb250ZXh0TWVudShmaWxlPy5mc1BhdGgpO1xuXHRcdH1cblx0fVxuXG5cdC8vI3JlZ2lvbiBXaW5kb3cgTGlmZWN5Y2xlXG5cblx0cHJpdmF0ZSBvbkJlZm9yZVNodXRkb3duKHsgdmV0bywgcmVhc29uIH06IEJlZm9yZVNodXRkb3duRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAocmVhc29uID09PSBTaHV0ZG93blJlYXNvbi5DTE9TRSkge1xuXHRcdFx0Y29uc3QgY29uZmlybUJlZm9yZUNsb3NlU2V0dGluZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J2Fsd2F5cycgfCAnbmV2ZXInIHwgJ2tleWJvYXJkT25seSc+KCd3aW5kb3cuY29uZmlybUJlZm9yZUNsb3NlJyk7XG5cblx0XHRcdGNvbnN0IGNvbmZpcm1CZWZvcmVDbG9zZSA9IGNvbmZpcm1CZWZvcmVDbG9zZVNldHRpbmcgPT09ICdhbHdheXMnIHx8IChjb25maXJtQmVmb3JlQ2xvc2VTZXR0aW5nID09PSAna2V5Ym9hcmRPbmx5JyAmJiBNb2RpZmllcktleUVtaXR0ZXIuZ2V0SW5zdGFuY2UoKS5pc01vZGlmaWVyUHJlc3NlZCk7XG5cdFx0XHRpZiAoY29uZmlybUJlZm9yZUNsb3NlKSB7XG5cblx0XHRcdFx0Ly8gV2hlbiB3ZSBuZWVkIHRvIGNvbmZpcm0gb24gY2xvc2Ugb3IgcXVpdCwgdmV0byB0aGUgc2h1dGRvd25cblx0XHRcdFx0Ly8gd2l0aCBhIGxvbmcgcnVubmluZyBwcm9taXNlIHRvIGZpZ3VyZSBvdXQgd2hldGhlciBzaHV0ZG93blxuXHRcdFx0XHQvLyBjYW4gcHJvY2VlZCBvciBub3QuXG5cblx0XHRcdFx0cmV0dXJuIHZldG8oKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRsZXQgYWN0dWFsUmVhc29uOiBTaHV0ZG93blJlYXNvbiA9IHJlYXNvbjtcblx0XHRcdFx0XHRpZiAocmVhc29uID09PSBTaHV0ZG93blJlYXNvbi5DTE9TRSAmJiAhaXNNYWNpbnRvc2gpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHdpbmRvd0NvdW50ID0gYXdhaXQgdGhpcy5uYXRpdmVIb3N0U2VydmljZS5nZXRXaW5kb3dDb3VudCgpO1xuXHRcdFx0XHRcdFx0aWYgKHdpbmRvd0NvdW50ID09PSAxKSB7XG5cdFx0XHRcdFx0XHRcdGFjdHVhbFJlYXNvbiA9IFNodXRkb3duUmVhc29uLlFVSVQ7IC8vIFdpbmRvd3MvTGludXg6IGNsb3NpbmcgbGFzdCB3aW5kb3cgbWVhbnMgdG8gUVVJVFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGxldCBjb25maXJtZWQgPSB0cnVlO1xuXHRcdFx0XHRcdGlmIChjb25maXJtQmVmb3JlQ2xvc2UpIHtcblx0XHRcdFx0XHRcdGNvbmZpcm1lZCA9IGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gTmF0aXZlV2luZG93LmNvbmZpcm1PblNodXRkb3duKGFjY2Vzc29yLCBhY3R1YWxSZWFzb24pKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBQcm9ncmVzcyBmb3IgbG9uZyBydW5uaW5nIHNodXRkb3duXG5cdFx0XHRcdFx0aWYgKGNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5wcm9ncmVzc09uQmVmb3JlU2h1dGRvd24ocmVhc29uKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gIWNvbmZpcm1lZDtcblx0XHRcdFx0fSkoKSwgJ3ZldG8uY29uZmlybUJlZm9yZUNsb3NlJyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUHJvZ3Jlc3MgZm9yIGxvbmcgcnVubmluZyBzaHV0ZG93blxuXHRcdHRoaXMucHJvZ3Jlc3NPbkJlZm9yZVNodXRkb3duKHJlYXNvbik7XG5cdH1cblxuXHRwcml2YXRlIHByb2dyZXNzT25CZWZvcmVTaHV0ZG93bihyZWFzb246IFNodXRkb3duUmVhc29uKTogdm9pZCB7XG5cdFx0dGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHtcblx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdywgXHQvLyB1c2Ugd2luZG93IHByb2dyZXNzIHRvIG5vdCBiZSB0b28gYW5ub3lpbmcgYWJvdXQgdGhpcyBvcGVyYXRpb25cblx0XHRcdGRlbGF5OiA4MDAsXHRcdFx0XHRcdFx0XHQvLyBkZWxheSBzbyB0aGF0IGl0IG9ubHkgYXBwZWFycyB3aGVuIG9wZXJhdGlvbiB0YWtlcyBhIGxvbmcgdGltZVxuXHRcdFx0dGl0bGU6IHRoaXMudG9TaHV0ZG93bkxhYmVsKHJlYXNvbiwgZmFsc2UpLFxuXHRcdH0sICgpID0+IHtcblx0XHRcdHJldHVybiBFdmVudC50b1Byb21pc2UoRXZlbnQuYW55KFxuXHRcdFx0XHR0aGlzLmxpZmVjeWNsZVNlcnZpY2Uub25XaWxsU2h1dGRvd24sIFx0Ly8gZGlzbWlzcyB0aGlzIGRpYWxvZyB3aGVuIHdlIHNodXRkb3duXG5cdFx0XHRcdHRoaXMubGlmZWN5Y2xlU2VydmljZS5vblNodXRkb3duVmV0bywgXHQvLyBvciB3aGVuIHNodXRkb3duIHdhcyB2ZXRvZWRcblx0XHRcdFx0dGhpcy5kaWFsb2dTZXJ2aWNlLm9uV2lsbFNob3dEaWFsb2dcdFx0Ly8gb3Igd2hlbiBhIGRpYWxvZyBhc2tzIGZvciBpbnB1dFxuXHRcdFx0KSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIG9uQmVmb3JlU2h1dGRvd25FcnJvcih7IGVycm9yLCByZWFzb24gfTogQmVmb3JlU2h1dGRvd25FcnJvckV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5kaWFsb2dTZXJ2aWNlLmVycm9yKHRoaXMudG9TaHV0ZG93bkxhYmVsKHJlYXNvbiwgdHJ1ZSksIGxvY2FsaXplKCdzaHV0ZG93bkVycm9yRGV0YWlsJywgXCJFcnJvcjogezB9XCIsIHRvRXJyb3JNZXNzYWdlKGVycm9yKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbldpbGxTaHV0ZG93bih7IHJlYXNvbiwgZm9yY2UsIGpvaW5lcnMgfTogV2lsbFNodXRkb3duRXZlbnQpOiB2b2lkIHtcblxuXHRcdC8vIERlbGF5IHNvIHRoYXQgdGhlIGRpYWxvZyBvbmx5IGFwcGVhcnMgYWZ0ZXIgdGltZW91dFxuXHRcdGNvbnN0IHNodXRkb3duRGlhbG9nU2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdFx0Y29uc3QgcGVuZGluZ0pvaW5lcnMgPSBqb2luZXJzKCk7XG5cblx0XHRcdHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7XG5cdFx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLkRpYWxvZywgXHRcdFx0XHQvLyB1c2UgYSBkaWFsb2cgdG8gcHJldmVudCB0aGUgdXNlciBmcm9tIG1ha2luZyBhbnkgbW9yZSBpbnRlcmFjdGlvbnMgbm93XG5cdFx0XHRcdGJ1dHRvbnM6IFt0aGlzLnRvRm9yY2VTaHV0ZG93bkxhYmVsKHJlYXNvbildLFx0Ly8gYWxsb3cgdG8gZm9yY2Ugc2h1dGRvd24gYW55d2F5XG5cdFx0XHRcdGNhbmNlbGxhYmxlOiBmYWxzZSxcdFx0XHRcdFx0XHRcdFx0Ly8gZG8gbm90IGFsbG93IHRvIGNhbmNlbFxuXHRcdFx0XHRzdGlja3k6IHRydWUsXHRcdFx0XHRcdFx0XHRcdFx0Ly8gZG8gbm90IGFsbG93IHRvIGRpc21pc3Ncblx0XHRcdFx0dGl0bGU6IHRoaXMudG9TaHV0ZG93bkxhYmVsKHJlYXNvbiwgZmFsc2UpLFxuXHRcdFx0XHRkZXRhaWw6IHBlbmRpbmdKb2luZXJzLmxlbmd0aCA+IDAgPyBsb2NhbGl6ZSgnd2lsbFNodXRkb3duRGV0YWlsJywgXCJUaGUgZm9sbG93aW5nIG9wZXJhdGlvbnMgYXJlIHN0aWxsIHJ1bm5pbmc6IFxcbnswfVwiLCBwZW5kaW5nSm9pbmVycy5tYXAoam9pbmVyID0+IGAtICR7am9pbmVyLmxhYmVsfWApLmpvaW4oJ1xcbicpKSA6IHVuZGVmaW5lZFxuXHRcdFx0fSwgKCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gRXZlbnQudG9Qcm9taXNlKHRoaXMubGlmZWN5Y2xlU2VydmljZS5vbkRpZFNodXRkb3duKTsgLy8gZGlzbWlzcyB0aGlzIGRpYWxvZyB3aGVuIHdlIGFjdHVhbGx5IHNodXRkb3duXG5cdFx0XHR9LCAoKSA9PiB7XG5cdFx0XHRcdGZvcmNlKCk7XG5cdFx0XHR9KTtcblx0XHR9LCAxMjAwKTtcblx0XHRzaHV0ZG93bkRpYWxvZ1NjaGVkdWxlci5zY2hlZHVsZSgpO1xuXG5cdFx0Ly8gRGlzcG9zZSBzY2hlZHVsZXIgd2hlbiB3ZSBhY3R1YWxseSBzaHV0ZG93blxuXHRcdEV2ZW50Lm9uY2UodGhpcy5saWZlY3ljbGVTZXJ2aWNlLm9uRGlkU2h1dGRvd24pKCgpID0+IHNodXRkb3duRGlhbG9nU2NoZWR1bGVyLmRpc3Bvc2UoKSk7XG5cdH1cblxuXHRwcml2YXRlIHRvU2h1dGRvd25MYWJlbChyZWFzb246IFNodXRkb3duUmVhc29uLCBpc0Vycm9yOiBib29sZWFuKTogc3RyaW5nIHtcblx0XHRpZiAoaXNFcnJvcikge1xuXHRcdFx0c3dpdGNoIChyZWFzb24pIHtcblx0XHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5DTE9TRTpcblx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3NodXRkb3duRXJyb3JDbG9zZScsIFwiQW4gdW5leHBlY3RlZCBlcnJvciBwcmV2ZW50ZWQgdGhlIHdpbmRvdyB0byBjbG9zZVwiKTtcblx0XHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5RVUlUOlxuXHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgnc2h1dGRvd25FcnJvclF1aXQnLCBcIkFuIHVuZXhwZWN0ZWQgZXJyb3IgcHJldmVudGVkIHRoZSBhcHBsaWNhdGlvbiB0byBxdWl0XCIpO1xuXHRcdFx0XHRjYXNlIFNodXRkb3duUmVhc29uLlJFTE9BRDpcblx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3NodXRkb3duRXJyb3JSZWxvYWQnLCBcIkFuIHVuZXhwZWN0ZWQgZXJyb3IgcHJldmVudGVkIHRoZSB3aW5kb3cgdG8gcmVsb2FkXCIpO1xuXHRcdFx0XHRjYXNlIFNodXRkb3duUmVhc29uLkxPQUQ6XG5cdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaHV0ZG93bkVycm9yTG9hZCcsIFwiQW4gdW5leHBlY3RlZCBlcnJvciBwcmV2ZW50ZWQgdG8gY2hhbmdlIHRoZSB3b3Jrc3BhY2VcIik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0c3dpdGNoIChyZWFzb24pIHtcblx0XHRcdGNhc2UgU2h1dGRvd25SZWFzb24uQ0xPU0U6XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgnc2h1dGRvd25UaXRsZUNsb3NlJywgXCJDbG9zaW5nIHRoZSB3aW5kb3cgaXMgdGFraW5nIGEgYml0IGxvbmdlci4uLlwiKTtcblx0XHRcdGNhc2UgU2h1dGRvd25SZWFzb24uUVVJVDpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaHV0ZG93blRpdGxlUXVpdCcsIFwiUXVpdHRpbmcgdGhlIGFwcGxpY2F0aW9uIGlzIHRha2luZyBhIGJpdCBsb25nZXIuLi5cIik7XG5cdFx0XHRjYXNlIFNodXRkb3duUmVhc29uLlJFTE9BRDpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaHV0ZG93blRpdGxlUmVsb2FkJywgXCJSZWxvYWRpbmcgdGhlIHdpbmRvdyBpcyB0YWtpbmcgYSBiaXQgbG9uZ2VyLi4uXCIpO1xuXHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5MT0FEOlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3NodXRkb3duVGl0bGVMb2FkJywgXCJDaGFuZ2luZyB0aGUgd29ya3NwYWNlIGlzIHRha2luZyBhIGJpdCBsb25nZXIuLi5cIik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0b0ZvcmNlU2h1dGRvd25MYWJlbChyZWFzb246IFNodXRkb3duUmVhc29uKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHJlYXNvbikge1xuXHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5DTE9TRTpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaHV0ZG93bkZvcmNlQ2xvc2UnLCBcIkNsb3NlIEFueXdheVwiKTtcblx0XHRcdGNhc2UgU2h1dGRvd25SZWFzb24uUVVJVDpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaHV0ZG93bkZvcmNlUXVpdCcsIFwiUXVpdCBBbnl3YXlcIik7XG5cdFx0XHRjYXNlIFNodXRkb3duUmVhc29uLlJFTE9BRDpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaHV0ZG93bkZvcmNlUmVsb2FkJywgXCJSZWxvYWQgQW55d2F5XCIpO1xuXHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5MT0FEOlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3NodXRkb3duRm9yY2VMb2FkJywgXCJDaGFuZ2UgQW55d2F5XCIpO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgdXBkYXRlRG9jdW1lbnRFZGl0ZWQoZG9jdW1lbnRFZGl0ZWQ6IHRydWUgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRsZXQgc2V0RG9jdW1lbnRFZGl0ZWQ6IGJvb2xlYW47XG5cdFx0aWYgKHR5cGVvZiBkb2N1bWVudEVkaXRlZCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRzZXREb2N1bWVudEVkaXRlZCA9IGRvY3VtZW50RWRpdGVkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZXREb2N1bWVudEVkaXRlZCA9IHRoaXMud29ya2luZ0NvcHlTZXJ2aWNlLmhhc0RpcnR5O1xuXHRcdH1cblxuXHRcdGlmICgoIXRoaXMuaXNEb2N1bWVudGVkRWRpdGVkICYmIHNldERvY3VtZW50RWRpdGVkKSB8fCAodGhpcy5pc0RvY3VtZW50ZWRFZGl0ZWQgJiYgIXNldERvY3VtZW50RWRpdGVkKSkge1xuXHRcdFx0dGhpcy5pc0RvY3VtZW50ZWRFZGl0ZWQgPSBzZXREb2N1bWVudEVkaXRlZDtcblxuXHRcdFx0dGhpcy5uYXRpdmVIb3N0U2VydmljZS5zZXREb2N1bWVudEVkaXRlZChzZXREb2N1bWVudEVkaXRlZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRXaW5kb3dNaW5pbXVtV2lkdGgocGFuZWxQb3NpdGlvbjogUG9zaXRpb24gPSB0aGlzLmxheW91dFNlcnZpY2UuZ2V0UGFuZWxQb3NpdGlvbigpKTogbnVtYmVyIHtcblxuXHRcdC8vIGlmIHBhbmVsIGlzIG9uIHRoZSBzaWRlLCB0aGVuIHJldHVybiB0aGUgbGFyZ2VyIG1pbndpZHRoXG5cdFx0Y29uc3QgcGFuZWxPblNpZGUgPSBwYW5lbFBvc2l0aW9uID09PSBQb3NpdGlvbi5MRUZUIHx8IHBhbmVsUG9zaXRpb24gPT09IFBvc2l0aW9uLlJJR0hUO1xuXHRcdGlmIChwYW5lbE9uU2lkZSkge1xuXHRcdFx0cmV0dXJuIFdpbmRvd01pbmltdW1TaXplLldJRFRIX1dJVEhfVkVSVElDQUxfUEFORUw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFdpbmRvd01pbmltdW1TaXplLldJRFRIO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZVBhbmVsUG9zaXRpb24ocG9zOiBQb3NpdGlvbik6IHZvaWQge1xuXHRcdGNvbnN0IG1pbldpZHRoID0gdGhpcy5nZXRXaW5kb3dNaW5pbXVtV2lkdGgocG9zKTtcblxuXHRcdHRoaXMubmF0aXZlSG9zdFNlcnZpY2Uuc2V0TWluaW11bVNpemUobWluV2lkdGgsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIG1heWJlQ2xvc2VXaW5kb3coKTogdm9pZCB7XG5cdFx0Y29uc3QgY2xvc2VXaGVuRW1wdHkgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCd3aW5kb3cuY2xvc2VXaGVuRW1wdHknKSB8fCB0aGlzLm5hdGl2ZUVudmlyb25tZW50U2VydmljZS5hcmdzLndhaXQ7XG5cdFx0aWYgKCFjbG9zZVdoZW5FbXB0eSkge1xuXHRcdFx0cmV0dXJuOyAvLyByZXR1cm4gZWFybHkgaWYgY29uZmlndXJlZCB0byBub3QgY2xvc2Ugd2hlbiBlbXB0eVxuXHRcdH1cblxuXHRcdC8vIENsb3NlIGVtcHR5IGVkaXRvciBncm91cHMgYmFzZWQgb24gc2V0dGluZyBhbmQgZW52aXJvbm1lbnRcblx0XHRmb3IgKGNvbnN0IGVkaXRvclBhcnQgb2YgdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UucGFydHMpIHtcblx0XHRcdGlmIChlZGl0b3JQYXJ0Lmdyb3Vwcy5zb21lKGdyb3VwID0+ICFncm91cC5pc0VtcHR5KSkge1xuXHRcdFx0XHRjb250aW51ZTsgLy8gbm90IGVtcHR5XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlZGl0b3JQYXJ0ID09PSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5tYWluUGFydCAmJiAoXG5cdFx0XHRcdHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSAhPT0gV29ya2JlbmNoU3RhdGUuRU1QVFkgfHxcdC8vIG9ubHkgZm9yIGVtcHR5IHdpbmRvd3Ncblx0XHRcdFx0dGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuaXNFeHRlbnNpb25EZXZlbG9wbWVudCB8fFx0XHRcdFx0XHQvLyBub3Qgd2hlbiBkZXZlbG9waW5nIGFuIGV4dGVuc2lvblxuXHRcdFx0XHR0aGlzLmVkaXRvclNlcnZpY2UudmlzaWJsZUVkaXRvcnMubGVuZ3RoID4gMFx0XHRcdFx0XHRcdC8vIG5vdCB3aGVuIHRoZXJlIGFyZSBzdGlsbCBlZGl0b3JzIG9wZW4gaW4gb3RoZXIgd2luZG93c1xuXHRcdFx0KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGVkaXRvclBhcnQgPT09IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLm1haW5QYXJ0KSB7XG5cdFx0XHRcdHRoaXMubmF0aXZlSG9zdFNlcnZpY2UuY2xvc2VXaW5kb3coKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVkaXRvclBhcnQucmVtb3ZlR3JvdXAoZWRpdG9yUGFydC5hY3RpdmVHcm91cCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBwcm92aWRlQ3VzdG9tVGl0bGVDb250ZXh0TWVudShmaWxlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cblx0XHQvLyBDbGVhciBvbGQgbWVudVxuXHRcdHRoaXMuY3VzdG9tVGl0bGVDb250ZXh0TWVudURpc3Bvc2FibGUuY2xlYXIoKTtcblxuXHRcdC8vIE9ubHkgcHJvdmlkZSBhIG1lbnUgd2hlbiB3ZSBoYXZlIGEgZmlsZSBwYXRoIGFuZCBjdXN0b20gdGl0bGViYXJcblx0XHRpZiAoIWZpbGVQYXRoIHx8IGhhc05hdGl2ZVRpdGxlYmFyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU3BsaXQgdXAgZmlsZXBhdGggaW50byBzZWdtZW50c1xuXHRcdGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocG9zaXguc2VwKTtcblx0XHRmb3IgKGxldCBpID0gc2VnbWVudHMubGVuZ3RoOyBpID4gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBpc0ZpbGUgPSAoaSA9PT0gc2VnbWVudHMubGVuZ3RoKTtcblxuXHRcdFx0bGV0IHBhdGhPZmZzZXQgPSBpO1xuXHRcdFx0aWYgKCFpc0ZpbGUpIHtcblx0XHRcdFx0cGF0aE9mZnNldCsrOyAvLyBmb3Igc2VnbWVudHMgd2hpY2ggYXJlIG5vdCB0aGUgZmlsZSBuYW1lIHdlIHdhbnQgdG8gb3BlbiB0aGUgZm9sZGVyXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHBhdGggPSBVUkkuZmlsZShzZWdtZW50cy5zbGljZSgwLCBwYXRoT2Zmc2V0KS5qb2luKHBvc2l4LnNlcCkpO1xuXG5cdFx0XHRsZXQgbGFiZWw6IHN0cmluZztcblx0XHRcdGlmICghaXNGaWxlKSB7XG5cdFx0XHRcdGxhYmVsID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbChkaXJuYW1lKHBhdGgpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGxhYmVsID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbChwYXRoKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29tbWFuZElkID0gYHdvcmtiZW5jaC5hY3Rpb24ucmV2ZWFsUGF0aEluRmluZGVyJHtpfWA7XG5cdFx0XHR0aGlzLmN1c3RvbVRpdGxlQ29udGV4dE1lbnVEaXNwb3NhYmxlLmFkZChDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChjb21tYW5kSWQsICgpID0+IHRoaXMubmF0aXZlSG9zdFNlcnZpY2Uuc2hvd0l0ZW1JbkZvbGRlcihwYXRoLmZzUGF0aCkpKTtcblx0XHRcdHRoaXMuY3VzdG9tVGl0bGVDb250ZXh0TWVudURpc3Bvc2FibGUuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVGl0bGVCYXJUaXRsZUNvbnRleHQsIHsgY29tbWFuZDogeyBpZDogY29tbWFuZElkLCB0aXRsZTogbGFiZWwgfHwgcG9zaXguc2VwIH0sIG9yZGVyOiAtaSwgZ3JvdXA6ICcxX2ZpbGUnIH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlKCk6IHZvaWQge1xuXG5cdFx0Ly8gSGFuZGxlIG9wZW4gY2FsbHNcblx0XHR0aGlzLnNldHVwT3BlbkhhbmRsZXJzKCk7XG5cblx0XHQvLyBOb3RpZnkgc29tZSBzZXJ2aWNlcyBhYm91dCBsaWZlY3ljbGUgcGhhc2VzXG5cdFx0dGhpcy5saWZlY3ljbGVTZXJ2aWNlLndoZW4oTGlmZWN5Y2xlUGhhc2UuUmVhZHkpLnRoZW4oKCkgPT4gdGhpcy5uYXRpdmVIb3N0U2VydmljZS5ub3RpZnlSZWFkeSgpKTtcblx0XHR0aGlzLmxpZmVjeWNsZVNlcnZpY2Uud2hlbihMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCkudGhlbigoKSA9PiB7XG5cdFx0XHR0aGlzLnNoYXJlZFByb2Nlc3NTZXJ2aWNlLm5vdGlmeVJlc3RvcmVkKCk7XG5cdFx0XHR0aGlzLnV0aWxpdHlQcm9jZXNzV29ya2VyV29ya2JlbmNoU2VydmljZS5ub3RpZnlSZXN0b3JlZCgpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gQ2hlY2sgZm9yIHNpdHVhdGlvbnMgdGhhdCBhcmUgd29ydGggd2FybmluZyB0aGUgdXNlciBhYm91dFxuXHRcdHRoaXMuaGFuZGxlV2FybmluZ3MoKTtcblxuXHRcdC8vIFRvdWNoYmFyIG1lbnUgKGlmIGVuYWJsZWQpXG5cdFx0dGhpcy51cGRhdGVUb3VjaGJhck1lbnUoKTtcblxuXHRcdC8vIFNtb2tlIFRlc3QgRHJpdmVyXG5cdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmVuYWJsZVNtb2tlVGVzdERyaXZlcikge1xuXHRcdFx0dGhpcy5zZXR1cERyaXZlcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlV2FybmluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBBZnRlciByZXN0b3JlZCBwaGFzZSBpcyBmaW5lIGZvciB0aGUgZm9sbG93aW5nIG9uZXNcblx0XHRhd2FpdCB0aGlzLmxpZmVjeWNsZVNlcnZpY2Uud2hlbihMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG5cblx0XHQvLyBJbnRlZ3JpdHkgLyBSb290IHdhcm5pbmdcblx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaXNBZG1pbiA9IGF3YWl0IHRoaXMubmF0aXZlSG9zdFNlcnZpY2UuaXNBZG1pbigpO1xuXHRcdFx0Y29uc3QgeyBpc1B1cmUgfSA9IGF3YWl0IHRoaXMuaW50ZWdyaXR5U2VydmljZS5pc1B1cmUoKTtcblxuXHRcdFx0Ly8gVXBkYXRlIHRvIHRpdGxlXG5cdFx0XHR0aGlzLnRpdGxlU2VydmljZS51cGRhdGVQcm9wZXJ0aWVzKHsgaXNQdXJlLCBpc0FkbWluIH0pO1xuXG5cdFx0XHQvLyBTaG93IHdhcm5pbmcgbWVzc2FnZSAodW5peCBvbmx5KVxuXHRcdFx0aWYgKGlzQWRtaW4gJiYgIWlzV2luZG93cykge1xuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uud2Fybihsb2NhbGl6ZSgncnVubmluZ0FzUm9vdCcsIFwiSXQgaXMgbm90IHJlY29tbWVuZGVkIHRvIHJ1biB7MH0gYXMgcm9vdCB1c2VyLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydCkpO1xuXHRcdFx0fVxuXHRcdH0pKCk7XG5cblx0XHQvLyBJbnN0YWxsYXRpb24gRGlyIFdhcm5pbmdcblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuaXNCdWlsdCkge1xuXHRcdFx0bGV0IGluc3RhbGxMb2NhdGlvblVyaTogVVJJO1xuXHRcdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdC8vIGFwcFJvb3QgPSAvQXBwbGljYXRpb25zL1Zpc3VhbCBTdHVkaW8gQ29kZSAtIEluc2lkZXJzLmFwcC9Db250ZW50cy9SZXNvdXJjZXMvYXBwXG5cdFx0XHRcdGluc3RhbGxMb2NhdGlvblVyaSA9IGRpcm5hbWUoZGlybmFtZShkaXJuYW1lKFVSSS5maWxlKHRoaXMubmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlLmFwcFJvb3QpKSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gYXBwUm9vdCA9IEM6XFxVc2Vyc1xcPG5hbWU+XFxBcHBEYXRhXFxMb2NhbFxcUHJvZ3JhbXNcXE1pY3Jvc29mdCBWUyBDb2RlIEluc2lkZXJzXFxyZXNvdXJjZXNcXGFwcFxuXHRcdFx0XHQvLyBhcHBSb290ID0gL3Vzci9zaGFyZS9jb2RlLWluc2lkZXJzL3Jlc291cmNlcy9hcHBcblx0XHRcdFx0aW5zdGFsbExvY2F0aW9uVXJpID0gZGlybmFtZShkaXJuYW1lKFVSSS5maWxlKHRoaXMubmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlLmFwcFJvb3QpKSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycykge1xuXHRcdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudChmb2xkZXIudXJpLCBpbnN0YWxsTG9jYXRpb25VcmkpKSB7XG5cdFx0XHRcdFx0dGhpcy5iYW5uZXJTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRcdFx0aWQ6ICdhcHBSb290V2FybmluZy5iYW5uZXInLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2FwcFJvb3RXYXJuaW5nLmJhbm5lcicsIFwiRmlsZXMgeW91IHN0b3JlIHdpdGhpbiB0aGUgaW5zdGFsbGF0aW9uIGZvbGRlciAoJ3swfScpIG1heSBiZSBPVkVSV1JJVFRFTiBvciBERUxFVEVEIElSUkVWRVJTSUJMWSB3aXRob3V0IHdhcm5pbmcgYXQgdXBkYXRlIHRpbWUuXCIsIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGluc3RhbGxMb2NhdGlvblVyaSkpLFxuXHRcdFx0XHRcdFx0aWNvbjogQ29kaWNvbi53YXJuaW5nXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIG1hY09TIDEwLjE1IHdhcm5pbmdcblx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdGNvbnN0IG1ham9yVmVyc2lvbiA9IHRoaXMubmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlLm9zLnJlbGVhc2Uuc3BsaXQoJy4nKVswXTtcblx0XHRcdGNvbnN0IGVvbFJlbGVhc2VzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oW1xuXHRcdFx0XHRbJzE5JywgJ21hY09TIENhdGFsaW5hJ10sXG5cdFx0XHRdKTtcblxuXHRcdFx0aWYgKGVvbFJlbGVhc2VzLmhhcyhtYWpvclZlcnNpb24pKSB7XG5cdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBsb2NhbGl6ZSgnbWFjb3Nlb2xtZXNzYWdlJywgXCJ7MH0gb24gezF9IHdpbGwgc29vbiBzdG9wIHJlY2VpdmluZyB1cGRhdGVzLiBDb25zaWRlciB1cGdyYWRpbmcgeW91ciBtYWNPUyB2ZXJzaW9uLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nLCBlb2xSZWxlYXNlcy5nZXQobWFqb3JWZXJzaW9uKSk7XG5cblx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChcblx0XHRcdFx0XHRTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbGVhcm5Nb3JlJywgXCJMZWFybiBNb3JlXCIpLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihVUkkucGFyc2UoJ2h0dHBzOi8vYWthLm1zL3ZzY29kZS1mYXEtb2xkLW1hY09TJykpXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmV2ZXJTaG93QWdhaW46IHsgaWQ6ICdtYWNvc2VvbCcsIGlzU2Vjb25kYXJ5OiB0cnVlLCBzY29wZTogTmV2ZXJTaG93QWdhaW5TY29wZS5BUFBMSUNBVElPTiB9LFxuXHRcdFx0XHRcdFx0cHJpb3JpdHk6IE5vdGlmaWNhdGlvblByaW9yaXR5LlVSR0VOVCxcblx0XHRcdFx0XHRcdHN0aWNreTogdHJ1ZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTbG93IHNoZWxsIGVudmlyb25tZW50IHByb2dyZXNzIGluZGljYXRvclxuXHRcdGNvbnN0IHNoZWxsRW52ID0gcHJvY2Vzcy5zaGVsbEVudigpO1xuXHRcdHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7XG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3Jlc29sdmVTaGVsbEVudmlyb25tZW50JywgXCJSZXNvbHZpbmcgc2hlbGwgZW52aXJvbm1lbnQuLi5cIiksXG5cdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5XaW5kb3csXG5cdFx0XHRkZWxheTogMTYwMCxcblx0XHRcdGJ1dHRvbnM6IFtsb2NhbGl6ZSgnbGVhcm5Nb3JlJywgXCJMZWFybiBNb3JlXCIpXVxuXHRcdH0sICgpID0+IHNoZWxsRW52LCAoKSA9PiB0aGlzLm9wZW5lclNlcnZpY2Uub3BlbignaHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/bGlua2lkPTIxNDk2NjcnKSk7XG5cdH1cblxuXHRwcml2YXRlIHNldHVwRHJpdmVyKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdGxldCBwZW5kaW5nUXVpdCA9IGZhbHNlO1xuXG5cdFx0cmVnaXN0ZXJXaW5kb3dEcml2ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSwge1xuXHRcdFx0YXN5bmMgZXhpdEFwcGxpY2F0aW9uKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRpZiAocGVuZGluZ1F1aXQpIHtcblx0XHRcdFx0XHR0aGF0LmxvZ1NlcnZpY2UuaW5mbygnW2RyaXZlcl0gbm90IGhhbmRsaW5nIGV4aXRBcHBsaWNhdGlvbigpIGR1ZSB0byBwZW5kaW5nIHF1aXQoKSBjYWxsJyk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhhdC5sb2dTZXJ2aWNlLmluZm8oJ1tkcml2ZXJdIGhhbmRsaW5nIGV4aXRBcHBsaWNhdGlvbigpJyk7XG5cblx0XHRcdFx0cGVuZGluZ1F1aXQgPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5uYXRpdmVIb3N0U2VydmljZS5xdWl0KCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlRXh0ZXJuYWxVcmkodXJpOiBVUkksIG9wdGlvbnM/OiBPcGVuT3B0aW9ucyk6IFByb21pc2U8SVJlc29sdmVkRXh0ZXJuYWxVcmkgfCB1bmRlZmluZWQ+IHtcblx0XHRsZXQgcXVlcnlUdW5uZWw6IFJlbW90ZVR1bm5lbCB8IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAob3B0aW9ucz8uYWxsb3dUdW5uZWxpbmcpIHtcblx0XHRcdGNvbnN0IHBvcnRNYXBwaW5nUmVxdWVzdCA9IGV4dHJhY3RMb2NhbEhvc3RVcmlNZXRhRGF0YUZvclBvcnRNYXBwaW5nKHVyaSk7XG5cdFx0XHRjb25zdCBxdWVyeVBvcnRNYXBwaW5nID0gZXh0cmFjdFF1ZXJ5TG9jYWxIb3N0VXJpTWV0YURhdGFGb3JQb3J0TWFwcGluZyh1cmkpO1xuXHRcdFx0aWYgKHF1ZXJ5UG9ydE1hcHBpbmcpIHtcblx0XHRcdFx0cXVlcnlUdW5uZWwgPSBhd2FpdCB0aGlzLm9wZW5UdW5uZWwocXVlcnlQb3J0TWFwcGluZy5hZGRyZXNzLCBxdWVyeVBvcnRNYXBwaW5nLnBvcnQpO1xuXHRcdFx0XHRpZiAocXVlcnlUdW5uZWwgJiYgKHR5cGVvZiBxdWVyeVR1bm5lbCAhPT0gJ3N0cmluZycpKSB7XG5cdFx0XHRcdFx0Ly8gSWYgdGhlIHR1bm5lbCB3YXMgbWFwcGVkIHRvIGEgZGlmZmVyZW50IHBvcnQsIGRpc3Bvc2UgaXQsIGJlY2F1c2Ugc29tZSBzZXJ2aWNlc1xuXHRcdFx0XHRcdC8vIHZhbGlkYXRlIHRoZSBwb3J0IG51bWJlciBpbiB0aGUgcXVlcnkgc3RyaW5nLlxuXHRcdFx0XHRcdGlmIChxdWVyeVR1bm5lbC50dW5uZWxSZW1vdGVQb3J0ICE9PSBxdWVyeVBvcnRNYXBwaW5nLnBvcnQpIHtcblx0XHRcdFx0XHRcdHF1ZXJ5VHVubmVsLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdHF1ZXJ5VHVubmVsID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZiAoIXBvcnRNYXBwaW5nUmVxdWVzdCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB0dW5uZWwgPSBxdWVyeVR1bm5lbDtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRyZXNvbHZlZDogdXJpLFxuXHRcdFx0XHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHR1bm5lbC5kaXNwb3NlKClcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHBvcnRNYXBwaW5nUmVxdWVzdCkge1xuXHRcdFx0XHRjb25zdCB0dW5uZWwgPSBhd2FpdCB0aGlzLm9wZW5UdW5uZWwocG9ydE1hcHBpbmdSZXF1ZXN0LmFkZHJlc3MsIHBvcnRNYXBwaW5nUmVxdWVzdC5wb3J0KTtcblx0XHRcdFx0aWYgKHR1bm5lbCAmJiAodHlwZW9mIHR1bm5lbCAhPT0gJ3N0cmluZycpKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWRkcmVzc0FzVXJpID0gVVJJLnBhcnNlKHR1bm5lbC5sb2NhbEFkZHJlc3MpLndpdGgoeyBwYXRoOiB1cmkucGF0aCB9KTtcblx0XHRcdFx0XHRjb25zdCByZXNvbHZlZCA9IGFkZHJlc3NBc1VyaS5zY2hlbWUuc3RhcnRzV2l0aCh1cmkuc2NoZW1lKSA/IGFkZHJlc3NBc1VyaSA6IHVyaS53aXRoKHsgYXV0aG9yaXR5OiB0dW5uZWwubG9jYWxBZGRyZXNzIH0pO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlZCxcblx0XHRcdFx0XHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHRcdFx0XHRcdHR1bm5lbC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdGlmIChxdWVyeVR1bm5lbCAmJiAodHlwZW9mIHF1ZXJ5VHVubmVsICE9PSAnc3RyaW5nJykpIHtcblx0XHRcdFx0XHRcdFx0XHRxdWVyeVR1bm5lbC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFvcHRpb25zPy5vcGVuRXh0ZXJuYWwpIHtcblx0XHRcdGNvbnN0IGNhbkhhbmRsZVJlc291cmNlID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5jYW5IYW5kbGVSZXNvdXJjZSh1cmkpO1xuXHRcdFx0aWYgKGNhbkhhbmRsZVJlc291cmNlKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0cmVzb2x2ZWQ6IFVSSS5mcm9tKHtcblx0XHRcdFx0XHRcdHNjaGVtZTogdGhpcy5wcm9kdWN0U2VydmljZS51cmxQcm90b2NvbCxcblx0XHRcdFx0XHRcdHBhdGg6ICd3b3Jrc3BhY2UnLFxuXHRcdFx0XHRcdFx0cXVlcnk6IHVyaS50b1N0cmluZygpXG5cdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0ZGlzcG9zZSgpIHsgfVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW5UdW5uZWwoYWRkcmVzczogc3RyaW5nLCBwb3J0OiBudW1iZXIpOiBQcm9taXNlPFJlbW90ZVR1bm5lbCB8IHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eTtcblx0XHRjb25zdCBhZGRyZXNzUHJvdmlkZXI6IElBZGRyZXNzUHJvdmlkZXIgfCB1bmRlZmluZWQgPSByZW1vdGVBdXRob3JpdHkgPyB7XG5cdFx0XHRnZXRBZGRyZXNzOiBhc3luYyAoKTogUHJvbWlzZTxJQWRkcmVzcz4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gKGF3YWl0IHRoaXMucmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVBdXRob3JpdHkocmVtb3RlQXV0aG9yaXR5KSkuYXV0aG9yaXR5O1xuXHRcdFx0fVxuXHRcdH0gOiB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCB0dW5uZWwgPSBhd2FpdCB0aGlzLnR1bm5lbFNlcnZpY2UuZ2V0RXhpc3RpbmdUdW5uZWwoYWRkcmVzcywgcG9ydCk7XG5cdFx0aWYgKCF0dW5uZWwgfHwgKHR5cGVvZiB0dW5uZWwgPT09ICdzdHJpbmcnKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMudHVubmVsU2VydmljZS5vcGVuVHVubmVsKGFkZHJlc3NQcm92aWRlciwgYWRkcmVzcywgcG9ydCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHR1bm5lbDtcblx0fVxuXG5cdHByaXZhdGUgc2V0dXBPcGVuSGFuZGxlcnMoKTogdm9pZCB7XG5cblx0XHQvLyBIYW5kbGUgZXh0ZXJuYWwgb3BlbigpIGNhbGxzXG5cdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLnNldERlZmF1bHRFeHRlcm5hbE9wZW5lcih7XG5cdFx0XHRvcGVuRXh0ZXJuYWw6IGFzeW5jIChocmVmOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y29uc3Qgc3VjY2VzcyA9IGF3YWl0IHRoaXMubmF0aXZlSG9zdFNlcnZpY2Uub3BlbkV4dGVybmFsKGhyZWYsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPignd29ya2JlbmNoLmV4dGVybmFsQnJvd3NlcicpKTtcblx0XHRcdFx0aWYgKCFzdWNjZXNzKSB7XG5cdFx0XHRcdFx0Y29uc3QgZmlsZUNhbmRpZGF0ZSA9IFVSSS5wYXJzZShocmVmKTtcblx0XHRcdFx0XHRpZiAoZmlsZUNhbmRpZGF0ZS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRcdFx0Ly8gaWYgb3BlbmluZyBmYWlsZWQsIGFuZCB0aGlzIGlzIGEgZmlsZSwgd2UgY2FuIHN0aWxsIHRyeSB0byByZXZlYWwgaXRcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMubmF0aXZlSG9zdFNlcnZpY2Uuc2hvd0l0ZW1JbkZvbGRlcihmaWxlQ2FuZGlkYXRlLmZzUGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBSZWdpc3RlciBleHRlcm5hbCBVUkkgcmVzb2x2ZXJcblx0XHR0aGlzLm9wZW5lclNlcnZpY2UucmVnaXN0ZXJFeHRlcm5hbFVyaVJlc29sdmVyKHtcblx0XHRcdHJlc29sdmVFeHRlcm5hbFVyaTogYXN5bmMgKHVyaTogVVJJLCBvcHRpb25zPzogT3Blbk9wdGlvbnMpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucmVzb2x2ZUV4dGVybmFsVXJpKHVyaSwgb3B0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHQvLyNyZWdpb24gVG91Y2hiYXJcblxuXHRwcml2YXRlIHRvdWNoQmFyTWVudTogSU1lbnUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgdG91Y2hCYXJEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgbGFzdEluc3RhbGxlZFRvdWNoZWRCYXI6IElDb21tYW5kQWN0aW9uW11bXSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHVwZGF0ZVRvdWNoYmFyTWVudSgpOiB2b2lkIHtcblx0XHRpZiAoIWlzTWFjaW50b3NoKSB7XG5cdFx0XHRyZXR1cm47IC8vIG1hY09TIG9ubHlcblx0XHR9XG5cblx0XHQvLyBEaXNwb3NlIG9sZFxuXHRcdHRoaXMudG91Y2hCYXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMudG91Y2hCYXJNZW51ID0gdW5kZWZpbmVkO1xuXG5cdFx0Ly8gQ3JlYXRlIG5ldyAoZGVsYXllZClcblx0XHRjb25zdCBzY2hlZHVsZXI6IFJ1bk9uY2VTY2hlZHVsZXIgPSB0aGlzLnRvdWNoQmFyRGlzcG9zYWJsZXMuYWRkKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuZG9VcGRhdGVUb3VjaGJhck1lbnUoc2NoZWR1bGVyKSwgMzAwKSk7XG5cdFx0c2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdH1cblxuXHRwcml2YXRlIGRvVXBkYXRlVG91Y2hiYXJNZW51KHNjaGVkdWxlcjogUnVuT25jZVNjaGVkdWxlcik6IHZvaWQge1xuXHRcdGlmICghdGhpcy50b3VjaEJhck1lbnUpIHtcblx0XHRcdGNvbnN0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU/LnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlIHx8IHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlO1xuXHRcdFx0dGhpcy50b3VjaEJhck1lbnUgPSB0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLlRvdWNoQmFyQ29udGV4dCwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0dGhpcy50b3VjaEJhckRpc3Bvc2FibGVzLmFkZCh0aGlzLnRvdWNoQmFyTWVudSk7XG5cdFx0XHR0aGlzLnRvdWNoQmFyRGlzcG9zYWJsZXMuYWRkKHRoaXMudG91Y2hCYXJNZW51Lm9uRGlkQ2hhbmdlKCgpID0+IHNjaGVkdWxlci5zY2hlZHVsZSgpKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzYWJsZWQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdrZXlib2FyZC50b3VjaGJhci5lbmFibGVkJykgPT09IGZhbHNlO1xuXHRcdGNvbnN0IHRvdWNoYmFySWdub3JlZCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2tleWJvYXJkLnRvdWNoYmFyLmlnbm9yZWQnKTtcblx0XHRjb25zdCBpZ25vcmVkSXRlbXMgPSBBcnJheS5pc0FycmF5KHRvdWNoYmFySWdub3JlZCkgPyB0b3VjaGJhcklnbm9yZWQgOiBbXTtcblxuXHRcdC8vIEZpbGwgYWN0aW9ucyBpbnRvIGdyb3VwcyByZXNwZWN0aW5nIG9yZGVyXG5cdFx0Y29uc3QgYWN0aW9ucyA9IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zKHRoaXMudG91Y2hCYXJNZW51LmdldEFjdGlvbnMoKSk7XG5cblx0XHQvLyBDb252ZXJ0IGludG8gY29tbWFuZCBhY3Rpb24gbXVsdGkgYXJyYXlcblx0XHRjb25zdCBpdGVtczogSUNvbW1hbmRBY3Rpb25bXVtdID0gW107XG5cdFx0bGV0IGdyb3VwOiBJQ29tbWFuZEFjdGlvbltdID0gW107XG5cdFx0aWYgKCFkaXNhYmxlZCkge1xuXHRcdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgYWN0aW9ucykge1xuXG5cdFx0XHRcdC8vIENvbW1hbmRcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRcdFx0aWYgKGlnbm9yZWRJdGVtcy5pbmRleE9mKGFjdGlvbi5pdGVtLmlkKSA+PSAwKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTsgLy8gaWdub3JlZFxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGdyb3VwLnB1c2goYWN0aW9uLml0ZW0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gU2VwYXJhdG9yXG5cdFx0XHRcdGVsc2UgaWYgKGFjdGlvbiBpbnN0YW5jZW9mIFNlcGFyYXRvcikge1xuXHRcdFx0XHRcdGlmIChncm91cC5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdGl0ZW1zLnB1c2goZ3JvdXApO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGdyb3VwID0gW107XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGdyb3VwLmxlbmd0aCkge1xuXHRcdFx0XHRpdGVtcy5wdXNoKGdyb3VwKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBPbmx5IHVwZGF0ZSBpZiB0aGUgYWN0aW9ucyBoYXZlIGNoYW5nZWRcblx0XHRpZiAoIWVxdWFscyh0aGlzLmxhc3RJbnN0YWxsZWRUb3VjaGVkQmFyLCBpdGVtcykpIHtcblx0XHRcdHRoaXMubGFzdEluc3RhbGxlZFRvdWNoZWRCYXIgPSBpdGVtcztcblx0XHRcdHRoaXMubmF0aXZlSG9zdFNlcnZpY2UudXBkYXRlVG91Y2hCYXIoaXRlbXMpO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgb25BZGRSZW1vdmVGb2xkZXJzUmVxdWVzdChyZXF1ZXN0OiBJQWRkUmVtb3ZlRm9sZGVyc1JlcXVlc3QpOiB2b2lkIHtcblxuXHRcdC8vIEJ1ZmZlciBhbGwgcGVuZGluZyByZXF1ZXN0c1xuXHRcdHRoaXMucGVuZGluZ0ZvbGRlcnNUb0FkZC5wdXNoKC4uLnJlcXVlc3QuZm9sZGVyc1RvQWRkLm1hcChmb2xkZXIgPT4gVVJJLnJldml2ZShmb2xkZXIpKSk7XG5cdFx0dGhpcy5wZW5kaW5nRm9sZGVyc1RvUmVtb3ZlLnB1c2goLi4ucmVxdWVzdC5mb2xkZXJzVG9SZW1vdmUubWFwKGZvbGRlciA9PiBVUkkucmV2aXZlKGZvbGRlcikpKTtcblxuXHRcdC8vIERlbGF5IHRoZSBhZGRpbmcgb2YgZm9sZGVycyBhIGJpdCB0byBidWZmZXIgaW4gY2FzZSBtb3JlIHJlcXVlc3RzIGFyZSBjb21pbmdcblx0XHRpZiAoIXRoaXMuYWRkUmVtb3ZlRm9sZGVyc1NjaGVkdWxlci5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHR0aGlzLmFkZFJlbW92ZUZvbGRlcnNTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvQWRkUmVtb3ZlRm9sZGVycygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmb2xkZXJzVG9BZGQ6IElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGFbXSA9IHRoaXMucGVuZGluZ0ZvbGRlcnNUb0FkZC5tYXAoZm9sZGVyID0+ICh7IHVyaTogZm9sZGVyIH0pKTtcblx0XHRjb25zdCBmb2xkZXJzVG9SZW1vdmUgPSB0aGlzLnBlbmRpbmdGb2xkZXJzVG9SZW1vdmUuc2xpY2UoMCk7XG5cblx0XHR0aGlzLnBlbmRpbmdGb2xkZXJzVG9BZGQgPSBbXTtcblx0XHR0aGlzLnBlbmRpbmdGb2xkZXJzVG9SZW1vdmUgPSBbXTtcblxuXHRcdGlmIChmb2xkZXJzVG9BZGQubGVuZ3RoKSB7XG5cdFx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZUVkaXRpbmdTZXJ2aWNlLmFkZEZvbGRlcnMoZm9sZGVyc1RvQWRkKTtcblx0XHR9XG5cblx0XHRpZiAoZm9sZGVyc1RvUmVtb3ZlLmxlbmd0aCkge1xuXHRcdFx0YXdhaXQgdGhpcy53b3Jrc3BhY2VFZGl0aW5nU2VydmljZS5yZW1vdmVGb2xkZXJzKGZvbGRlcnNUb1JlbW92ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbk9wZW5GaWxlcyhyZXF1ZXN0OiBJTmF0aXZlT3BlbkZpbGVSZXF1ZXN0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGlmZk1vZGUgPSAhIShyZXF1ZXN0LmZpbGVzVG9EaWZmICYmIChyZXF1ZXN0LmZpbGVzVG9EaWZmLmxlbmd0aCA9PT0gMikpO1xuXHRcdGNvbnN0IG1lcmdlTW9kZSA9ICEhKHJlcXVlc3QuZmlsZXNUb01lcmdlICYmIChyZXF1ZXN0LmZpbGVzVG9NZXJnZS5sZW5ndGggPT09IDQpKTtcblxuXHRcdGNvbnN0IGlucHV0cyA9IGNvYWxlc2NlKGF3YWl0IHBhdGhzVG9FZGl0b3JzKG1lcmdlTW9kZSA/IHJlcXVlc3QuZmlsZXNUb01lcmdlIDogZGlmZk1vZGUgPyByZXF1ZXN0LmZpbGVzVG9EaWZmIDogcmVxdWVzdC5maWxlc1RvT3Blbk9yQ3JlYXRlLCB0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UpKTtcblx0XHRpZiAoaW5wdXRzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3Qgb3BlbmVkRWRpdG9yUGFuZXMgPSBhd2FpdCB0aGlzLm9wZW5SZXNvdXJjZXMoaW5wdXRzLCBkaWZmTW9kZSwgbWVyZ2VNb2RlKTtcblxuXHRcdFx0aWYgKHJlcXVlc3QuZmlsZXNUb1dhaXQpIHtcblxuXHRcdFx0XHQvLyBJbiB3YWl0IG1vZGUsIGxpc3RlbiB0byBjaGFuZ2VzIHRvIHRoZSBlZGl0b3JzIGFuZCB3YWl0IHVudGlsIHRoZSBmaWxlc1xuXHRcdFx0XHQvLyBhcmUgY2xvc2VkIHRoYXQgdGhlIHVzZXIgd2FudHMgdG8gd2FpdCBmb3IuIFdoZW4gdGhpcyBoYXBwZW5zIHdlIGRlbGV0ZVxuXHRcdFx0XHQvLyB0aGUgd2FpdCBtYXJrZXIgZmlsZSB0byBzaWduYWwgdG8gdGhlIG91dHNpZGUgdGhhdCBlZGl0aW5nIGlzIGRvbmUuXG5cdFx0XHRcdC8vIEhvd2V2ZXIsIGl0IGlzIHBvc3NpYmxlIHRoYXQgb3BlbmluZyBvZiB0aGUgZWRpdG9ycyBmYWlsZWQsIGFzIHN1Y2ggd2Vcblx0XHRcdFx0Ly8gY2hlY2sgZm9yIHdoZXRoZXIgZWRpdG9yIHBhbmVzIGdvdCBvcGVuZWQgYW5kIG90aGVyd2lzZSBkZWxldGUgdGhlIG1hcmtlclxuXHRcdFx0XHQvLyByaWdodCBhd2F5LlxuXG5cdFx0XHRcdGlmIChvcGVuZWRFZGl0b3JQYW5lcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy50cmFja0Nsb3NlZFdhaXRGaWxlcyhVUkkucmV2aXZlKHJlcXVlc3QuZmlsZXNUb1dhaXQud2FpdE1hcmtlckZpbGVVcmkpLCBjb2FsZXNjZShyZXF1ZXN0LmZpbGVzVG9XYWl0LnBhdGhzLm1hcChwYXRoID0+IFVSSS5yZXZpdmUocGF0aC5maWxlVXJpKSkpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5maWxlU2VydmljZS5kZWwoVVJJLnJldml2ZShyZXF1ZXN0LmZpbGVzVG9XYWl0LndhaXRNYXJrZXJGaWxlVXJpKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHRyYWNrQ2xvc2VkV2FpdEZpbGVzKHdhaXRNYXJrZXJGaWxlOiBVUkksIHJlc291cmNlc1RvV2FpdEZvcjogVVJJW10pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFdhaXQgZm9yIHRoZSByZXNvdXJjZXMgdG8gYmUgY2xvc2VkIGluIHRoZSB0ZXh0IGVkaXRvci4uLlxuXHRcdGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gd2hlbkVkaXRvckNsb3NlZChhY2Nlc3NvciwgcmVzb3VyY2VzVG9XYWl0Rm9yKSk7XG5cblx0XHQvLyAuLi5iZWZvcmUgZGVsZXRpbmcgdGhlIHdhaXQgbWFya2VyIGZpbGVcblx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmRlbCh3YWl0TWFya2VyRmlsZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW5SZXNvdXJjZXMocmVzb3VyY2VzOiBBcnJheTxJUmVzb3VyY2VFZGl0b3JJbnB1dCB8IElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0PiwgZGlmZk1vZGU6IGJvb2xlYW4sIG1lcmdlTW9kZTogYm9vbGVhbik6IFByb21pc2U8cmVhZG9ubHkgSUVkaXRvclBhbmVbXT4ge1xuXHRcdGNvbnN0IGVkaXRvcnM6IElVbnR5cGVkRWRpdG9ySW5wdXRbXSA9IFtdO1xuXG5cdFx0aWYgKG1lcmdlTW9kZSAmJiBpc1Jlc291cmNlRWRpdG9ySW5wdXQocmVzb3VyY2VzWzBdKSAmJiBpc1Jlc291cmNlRWRpdG9ySW5wdXQocmVzb3VyY2VzWzFdKSAmJiBpc1Jlc291cmNlRWRpdG9ySW5wdXQocmVzb3VyY2VzWzJdKSAmJiBpc1Jlc291cmNlRWRpdG9ySW5wdXQocmVzb3VyY2VzWzNdKSkge1xuXHRcdFx0Y29uc3QgbWVyZ2VFZGl0b3I6IElSZXNvdXJjZU1lcmdlRWRpdG9ySW5wdXQgPSB7XG5cdFx0XHRcdGlucHV0MTogeyByZXNvdXJjZTogcmVzb3VyY2VzWzBdLnJlc291cmNlIH0sXG5cdFx0XHRcdGlucHV0MjogeyByZXNvdXJjZTogcmVzb3VyY2VzWzFdLnJlc291cmNlIH0sXG5cdFx0XHRcdGJhc2U6IHsgcmVzb3VyY2U6IHJlc291cmNlc1syXS5yZXNvdXJjZSB9LFxuXHRcdFx0XHRyZXN1bHQ6IHsgcmVzb3VyY2U6IHJlc291cmNlc1szXS5yZXNvdXJjZSB9LFxuXHRcdFx0XHRvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9XG5cdFx0XHR9O1xuXHRcdFx0ZWRpdG9ycy5wdXNoKG1lcmdlRWRpdG9yKTtcblx0XHR9IGVsc2UgaWYgKGRpZmZNb2RlICYmIGlzUmVzb3VyY2VFZGl0b3JJbnB1dChyZXNvdXJjZXNbMF0pICYmIGlzUmVzb3VyY2VFZGl0b3JJbnB1dChyZXNvdXJjZXNbMV0pKSB7XG5cdFx0XHRjb25zdCBkaWZmRWRpdG9yOiBJUmVzb3VyY2VEaWZmRWRpdG9ySW5wdXQgPSB7XG5cdFx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiByZXNvdXJjZXNbMF0ucmVzb3VyY2UgfSxcblx0XHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IHJlc291cmNlc1sxXS5yZXNvdXJjZSB9LFxuXHRcdFx0XHRvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9XG5cdFx0XHR9O1xuXHRcdFx0ZWRpdG9ycy5wdXNoKGRpZmZFZGl0b3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRlZGl0b3JzLnB1c2goLi4ucmVzb3VyY2VzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3JzKGVkaXRvcnMsIHVuZGVmaW5lZCwgeyB2YWxpZGF0ZVRydXN0OiB0cnVlIH0pO1xuXHR9XG5cblx0Ly8jcmVnaW9uIFdpbmRvdyBab29tXG5cblx0cHJpdmF0ZSByZWFkb25seSBtYXBXaW5kb3dJZFRvWm9vbVN0YXR1c0VudHJ5ID0gbmV3IE1hcDxudW1iZXIsIFpvb21TdGF0dXNFbnRyeT4oKTtcblxuXHRwcml2YXRlIGNvbmZpZ3VyZWRXaW5kb3dab29tTGV2ZWw6IG51bWJlcjtcblxuXHRwcml2YXRlIHJlc29sdmVDb25maWd1cmVkV2luZG93Wm9vbUxldmVsKCk6IG51bWJlciB7XG5cdFx0Y29uc3Qgd2luZG93Wm9vbUxldmVsID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnd2luZG93Lnpvb21MZXZlbCcpO1xuXG5cdFx0cmV0dXJuIHR5cGVvZiB3aW5kb3dab29tTGV2ZWwgPT09ICdudW1iZXInID8gd2luZG93Wm9vbUxldmVsIDogMDtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlT25EaWRDaGFuZ2Vab29tTGV2ZWwodGFyZ2V0V2luZG93SWQ6IG51bWJlcik6IHZvaWQge1xuXG5cdFx0Ly8gWm9vbSBzdGF0dXMgZW50cnlcblx0XHR0aGlzLnVwZGF0ZVdpbmRvd1pvb21TdGF0dXNFbnRyeSh0YXJnZXRXaW5kb3dJZCk7XG5cblx0XHQvLyBOb3RpZnkgbWFpbiBwcm9jZXNzIGFib3V0IGEgY3VzdG9tIHpvb20gbGV2ZWxcblx0XHRpZiAodGFyZ2V0V2luZG93SWQgPT09IG1haW5XaW5kb3cudnNjb2RlV2luZG93SWQpIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRXaW5kb3dab29tTGV2ZWwgPSBnZXRab29tTGV2ZWwobWFpbldpbmRvdyk7XG5cblx0XHRcdGxldCBub3RpZnlab29tTGV2ZWw6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0aGlzLmNvbmZpZ3VyZWRXaW5kb3dab29tTGV2ZWwgIT09IGN1cnJlbnRXaW5kb3dab29tTGV2ZWwpIHtcblx0XHRcdFx0bm90aWZ5Wm9vbUxldmVsID0gY3VycmVudFdpbmRvd1pvb21MZXZlbDtcblx0XHRcdH1cblxuXHRcdFx0aXBjUmVuZGVyZXIuaW52b2tlKCd2c2NvZGU6bm90aWZ5Wm9vbUxldmVsJywgbm90aWZ5Wm9vbUxldmVsKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVdpbmRvd1pvb21TdGF0dXNFbnRyeShwYXJ0OiBJRWRpdG9yUGFydCk6IHZvaWQge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdEV2ZW50Lm9uY2UocGFydC5vbldpbGxEaXNwb3NlKSgoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpO1xuXG5cdFx0Y29uc3Qgc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UgPSB0aGlzLmVkaXRvckdyb3VwU2VydmljZS5nZXRTY29wZWRJbnN0YW50aWF0aW9uU2VydmljZShwYXJ0KTtcblx0XHR0aGlzLm1hcFdpbmRvd0lkVG9ab29tU3RhdHVzRW50cnkuc2V0KHBhcnQud2luZG93SWQsIGRpc3Bvc2FibGVzLmFkZChzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShab29tU3RhdHVzRW50cnkpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLm1hcFdpbmRvd0lkVG9ab29tU3RhdHVzRW50cnkuZGVsZXRlKHBhcnQud2luZG93SWQpKSk7XG5cblx0XHR0aGlzLnVwZGF0ZVdpbmRvd1pvb21TdGF0dXNFbnRyeShwYXJ0LndpbmRvd0lkKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlV2luZG93Wm9vbVN0YXR1c0VudHJ5KHRhcmdldFdpbmRvd0lkOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCB0YXJnZXRXaW5kb3cgPSBnZXRXaW5kb3dCeUlkKHRhcmdldFdpbmRvd0lkKTtcblx0XHRjb25zdCBlbnRyeSA9IHRoaXMubWFwV2luZG93SWRUb1pvb21TdGF0dXNFbnRyeS5nZXQodGFyZ2V0V2luZG93SWQpO1xuXHRcdGlmIChlbnRyeSAmJiB0YXJnZXRXaW5kb3cpIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRab29tTGV2ZWwgPSBnZXRab29tTGV2ZWwodGFyZ2V0V2luZG93LndpbmRvdyk7XG5cblx0XHRcdGxldCB0ZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoY3VycmVudFpvb21MZXZlbCA8IHRoaXMuY29uZmlndXJlZFdpbmRvd1pvb21MZXZlbCkge1xuXHRcdFx0XHR0ZXh0ID0gJyQoem9vbS1vdXQpJztcblx0XHRcdH0gZWxzZSBpZiAoY3VycmVudFpvb21MZXZlbCA+IHRoaXMuY29uZmlndXJlZFdpbmRvd1pvb21MZXZlbCkge1xuXHRcdFx0XHR0ZXh0ID0gJyQoem9vbS1pbiknO1xuXHRcdFx0fVxuXG5cdFx0XHRlbnRyeS51cGRhdGVab29tRW50cnkodGV4dCA/PyBmYWxzZSwgdGFyZ2V0V2luZG93SWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VDb25maWd1cmVkV2luZG93Wm9vbUxldmVsKCk6IHZvaWQge1xuXHRcdHRoaXMuY29uZmlndXJlZFdpbmRvd1pvb21MZXZlbCA9IHRoaXMucmVzb2x2ZUNvbmZpZ3VyZWRXaW5kb3dab29tTGV2ZWwoKTtcblxuXHRcdGxldCBhcHBseVpvb21MZXZlbCA9IGZhbHNlO1xuXHRcdGZvciAoY29uc3QgeyB3aW5kb3cgfSBvZiBnZXRXaW5kb3dzKCkpIHtcblx0XHRcdGlmIChnZXRab29tTGV2ZWwod2luZG93KSAhPT0gdGhpcy5jb25maWd1cmVkV2luZG93Wm9vbUxldmVsKSB7XG5cdFx0XHRcdGFwcGx5Wm9vbUxldmVsID0gdHJ1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGFwcGx5Wm9vbUxldmVsKSB7XG5cdFx0XHRhcHBseVpvb20odGhpcy5jb25maWd1cmVkV2luZG93Wm9vbUxldmVsLCBBcHBseVpvb21UYXJnZXQuQUxMX1dJTkRPV1MpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgW3dpbmRvd0lkXSBvZiB0aGlzLm1hcFdpbmRvd0lkVG9ab29tU3RhdHVzRW50cnkpIHtcblx0XHRcdHRoaXMudXBkYXRlV2luZG93Wm9vbVN0YXR1c0VudHJ5KHdpbmRvd0lkKTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdGZvciAoY29uc3QgWywgZW50cnldIG9mIHRoaXMubWFwV2luZG93SWRUb1pvb21TdGF0dXNFbnRyeSkge1xuXHRcdFx0ZW50cnkuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBab29tU3RhdHVzRW50cnkgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8RGlzcG9zYWJsZVN0b3JlPigpKTtcblxuXHRwcml2YXRlIHpvb21MZXZlbExhYmVsOiBBY3Rpb24gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTdGF0dXNiYXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RhdHVzYmFyU2VydmljZTogSVN0YXR1c2JhclNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHVwZGF0ZVpvb21FbnRyeSh2aXNpYmxlT3JUZXh0OiBmYWxzZSB8IHN0cmluZywgdGFyZ2V0V2luZG93SWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0eXBlb2YgdmlzaWJsZU9yVGV4dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGlmICghdGhpcy5kaXNwb3NhYmxlLnZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuY3JlYXRlWm9vbUVudHJ5KHZpc2libGVPclRleHQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnVwZGF0ZVpvb21MZXZlbExhYmVsKHRhcmdldFdpbmRvd0lkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVab29tRW50cnkodmlzaWJsZU9yVGV4dDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlLnZhbHVlID0gZGlzcG9zYWJsZXM7XG5cblx0XHRjb25zdCBjb250YWluZXIgPSAkKCcuem9vbS1zdGF0dXMnKTtcblxuXHRcdGNvbnN0IGxlZnQgPSAkKCcuem9vbS1zdGF0dXMtbGVmdCcpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChsZWZ0KTtcblxuXHRcdGNvbnN0IHpvb21PdXRBY3Rpb246IEFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKCd3b3JrYmVuY2guYWN0aW9uLnpvb21PdXQnLCBsb2NhbGl6ZSgnem9vbU91dCcsIFwiWm9vbSBPdXRcIiksIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnJlbW92ZSksIHRydWUsICgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoem9vbU91dEFjdGlvbi5pZCkpKTtcblx0XHRjb25zdCB6b29tSW5BY3Rpb246IEFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKCd3b3JrYmVuY2guYWN0aW9uLnpvb21JbicsIGxvY2FsaXplKCd6b29tSW4nLCBcIlpvb20gSW5cIiksIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnBsdXMpLCB0cnVlLCAoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHpvb21JbkFjdGlvbi5pZCkpKTtcblx0XHRjb25zdCB6b29tUmVzZXRBY3Rpb246IEFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKCd3b3JrYmVuY2guYWN0aW9uLnpvb21SZXNldCcsIGxvY2FsaXplKCd6b29tUmVzZXQnLCBcIlJlc2V0XCIpLCB1bmRlZmluZWQsIHRydWUsICgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoem9vbVJlc2V0QWN0aW9uLmlkKSkpO1xuXHRcdHpvb21SZXNldEFjdGlvbi50b29sdGlwID0gbG9jYWxpemUoJ3pvb21SZXNldExhYmVsJywgXCJ7MH0gKHsxfSlcIiwgem9vbVJlc2V0QWN0aW9uLmxhYmVsLCB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoem9vbVJlc2V0QWN0aW9uLmlkKT8uZ2V0TGFiZWwoKSk7XG5cdFx0Y29uc3Qgem9vbVNldHRpbmdzQWN0aW9uOiBBY3Rpb24gPSBkaXNwb3NhYmxlcy5hZGQobmV3IEFjdGlvbignd29ya2JlbmNoLmFjdGlvbi5vcGVuU2V0dGluZ3MnLCBsb2NhbGl6ZSgnem9vbVNldHRpbmdzJywgXCJTZXR0aW5nc1wiKSwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uc2V0dGluZ3NHZWFyKSwgdHJ1ZSwgKCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCh6b29tU2V0dGluZ3NBY3Rpb24uaWQsICd3aW5kb3cuem9vbScpKSk7XG5cdFx0Y29uc3Qgem9vbUxldmVsTGFiZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEFjdGlvbignem9vbUxhYmVsJywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlKSk7XG5cblx0XHR0aGlzLnpvb21MZXZlbExhYmVsID0gem9vbUxldmVsTGFiZWw7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLnpvb21MZXZlbExhYmVsID0gdW5kZWZpbmVkKSk7XG5cblx0XHRjb25zdCBhY3Rpb25CYXJMZWZ0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBBY3Rpb25CYXIobGVmdCwgeyBob3ZlckRlbGVnYXRlOiBuYXRpdmVIb3ZlckRlbGVnYXRlIH0pKTtcblx0XHRhY3Rpb25CYXJMZWZ0LnB1c2goem9vbU91dEFjdGlvbiwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UsIGtleWJpbmRpbmc6IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyh6b29tT3V0QWN0aW9uLmlkKT8uZ2V0TGFiZWwoKSB9KTtcblx0XHRhY3Rpb25CYXJMZWZ0LnB1c2godGhpcy56b29tTGV2ZWxMYWJlbCwgeyBpY29uOiBmYWxzZSwgbGFiZWw6IHRydWUgfSk7XG5cdFx0YWN0aW9uQmFyTGVmdC5wdXNoKHpvb21JbkFjdGlvbiwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UsIGtleWJpbmRpbmc6IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyh6b29tSW5BY3Rpb24uaWQpPy5nZXRMYWJlbCgpIH0pO1xuXG5cdFx0Y29uc3QgcmlnaHQgPSAkKCcuem9vbS1zdGF0dXMtcmlnaHQnKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQocmlnaHQpO1xuXG5cdFx0Y29uc3QgYWN0aW9uQmFyUmlnaHQgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEFjdGlvbkJhcihyaWdodCwgeyBob3ZlckRlbGVnYXRlOiBuYXRpdmVIb3ZlckRlbGVnYXRlIH0pKTtcblxuXHRcdGFjdGlvbkJhclJpZ2h0LnB1c2goem9vbVJlc2V0QWN0aW9uLCB7IGljb246IGZhbHNlLCBsYWJlbDogdHJ1ZSB9KTtcblx0XHRhY3Rpb25CYXJSaWdodC5wdXNoKHpvb21TZXR0aW5nc0FjdGlvbiwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UsIGtleWJpbmRpbmc6IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyh6b29tU2V0dGluZ3NBY3Rpb24uaWQpPy5nZXRMYWJlbCgpIH0pO1xuXG5cdFx0Y29uc3QgbmFtZSA9IGxvY2FsaXplKCdzdGF0dXMud2luZG93Wm9vbScsIFwiV2luZG93IFpvb21cIik7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMuc3RhdHVzYmFyU2VydmljZS5hZGRFbnRyeSh7XG5cdFx0XHRuYW1lLFxuXHRcdFx0dGV4dDogdmlzaWJsZU9yVGV4dCxcblx0XHRcdHRvb2x0aXA6IGNvbnRhaW5lcixcblx0XHRcdGFyaWFMYWJlbDogbmFtZSxcblx0XHRcdGNvbW1hbmQ6IFNob3dUb29sdGlwQ29tbWFuZCxcblx0XHRcdGtpbmQ6ICdwcm9taW5lbnQnXG5cdFx0fSwgJ3N0YXR1cy53aW5kb3dab29tJywgU3RhdHVzYmFyQWxpZ25tZW50LlJJR0hULCAxMDIpKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlWm9vbUxldmVsTGFiZWwodGFyZ2V0V2luZG93SWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLnpvb21MZXZlbExhYmVsKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRXaW5kb3cgPSBnZXRXaW5kb3dCeUlkKHRhcmdldFdpbmRvd0lkLCB0cnVlKS53aW5kb3c7XG5cdFx0XHRjb25zdCB6b29tRmFjdG9yID0gTWF0aC5yb3VuZChnZXRab29tRmFjdG9yKHRhcmdldFdpbmRvdykgKiAxMDApO1xuXHRcdFx0Y29uc3Qgem9vbUxldmVsID0gZ2V0Wm9vbUxldmVsKHRhcmdldFdpbmRvdyk7XG5cblx0XHRcdHRoaXMuem9vbUxldmVsTGFiZWwubGFiZWwgPSBgJHt6b29tTGV2ZWx9YDtcblx0XHRcdHRoaXMuem9vbUxldmVsTGFiZWwudG9vbHRpcCA9IGxvY2FsaXplKCd6b29tTnVtYmVyJywgXCJab29tIExldmVsOiB7MH0gKHsxfSUpXCIsIHpvb21MZXZlbCwgem9vbUZhY3Rvcik7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsV0FBVyxhQUFhLHVCQUF1QixvQkFBb0Isa0JBQWtCLFdBQVcsZUFBZSxZQUFZLFNBQVM7QUFDN0ksU0FBUyxRQUFRLGlCQUFzRjtBQUN2RyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHdCQUEwRCxrQkFBa0IsZ0JBQTRFLDZCQUF3RDtBQUN6TixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHlC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
