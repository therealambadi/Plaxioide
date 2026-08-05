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
import { BrowserFeatures } from "../../../../base/browser/canIUse.js";
import { DataTransfers } from "../../../../base/browser/dnd.js";
import * as dom from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { Orientation } from "../../../../base/browser/ui/sash/sash.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { AutoOpenBarrier, Promises, disposableTimeout, timeout } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { debounce } from "../../../../base/common/decorators.js";
import { BugIndicatingError, onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { template } from "../../../../base/common/labels.js";
import { Disposable, DisposableMap, DisposableStore, ImmortalReference, MutableDisposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import * as path from "../../../../base/common/path.js";
import { OS, OperatingSystem, isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { URI } from "../../../../base/common/uri.js";
import { TabFocus } from "../../../../editor/browser/config/tabFocus.js";
import * as nls from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { CodeDataTransfers, containsDragType, getPathForFile } from "../../../../platform/dnd/browser/dnd.js";
import { FileSystemProviderCapabilities, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ResultKind } from "../../../../platform/keybinding/common/keybindingResolver.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalCapabilityStoreMultiplexer } from "../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { deserializeEnvironmentVariableCollections } from "../../../../platform/terminal/common/environmentVariableShared.js";
import { GeneralShellType, ITerminalLogService, PosixShellType, ProcessPropertyType, ShellIntegrationStatus, TerminalExitReason, TerminalLocation, TerminalSettingId, TitleEventSource, WindowsShellType } from "../../../../platform/terminal/common/terminal.js";
import { formatMessageForTerminal } from "../../../../platform/terminal/common/terminalStrings.js";
import { editorBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { getIconRegistry } from "../../../../platform/theme/common/iconRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { PANEL_BACKGROUND, SIDE_BAR_BACKGROUND } from "../../../common/theme.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { ITerminalConfigurationService, TerminalDataTransfers } from "./terminal.js";
import { TerminalLaunchHelpAction } from "./terminalActions.js";
import { TerminalEditorInput } from "./terminalEditorInput.js";
import { TerminalExtensionsRegistry } from "./terminalExtensions.js";
import { getColorClass, createColorStyleElement, getStandardColors } from "./terminalIcon.js";
import { TerminalProcessManager } from "./terminalProcessManager.js";
import { TerminalStatus, TerminalStatusList } from "./terminalStatusList.js";
import { getTerminalResourcesFromDragEvent, getTerminalUri } from "./terminalUri.js";
import { TerminalWidgetManager } from "./widgets/widgetManager.js";
import { LineDataEventAddon } from "./xterm/lineDataEventAddon.js";
import { XtermTerminal, getXtermScaledDimensions } from "./xterm/xtermTerminal.js";
import { DEFAULT_COMMANDS_TO_SKIP_SHELL, ITerminalProfileResolverService, ProcessState, TERMINAL_CREATION_COMMANDS, TERMINAL_VIEW_ID, TerminalCommandId } from "../common/terminal.js";
import { TERMINAL_BACKGROUND_COLOR } from "../common/terminalColorRegistry.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { getWorkspaceForTerminal, preparePathForShell } from "../common/terminalEnvironment.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { isHorizontal, IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { importAMDNodeModule } from "../../../../amdX.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { terminalStrings } from "../common/terminalStrings.js";
import { TerminalIconPicker } from "./terminalIconPicker.js";
import { TerminalResizeDebouncer } from "./terminalResizeDebouncer.js";
import { openContextMenu } from "./terminalContextMenu.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { TerminalContribCommandId } from "../terminalContribExports.js";
import { refreshShellIntegrationInfoStatus } from "./terminalTooltip.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["WaitForContainerThreshold"] = 100] = "WaitForContainerThreshold";
  Constants2[Constants2["DefaultCols"] = 80] = "DefaultCols";
  Constants2[Constants2["DefaultRows"] = 30] = "DefaultRows";
  Constants2[Constants2["MaxCanvasWidth"] = 4096] = "MaxCanvasWidth";
  return Constants2;
})(Constants || {});
let xtermConstructor;
const shellIntegrationSupportedShellTypes = [
  PosixShellType.Bash,
  PosixShellType.Zsh,
  GeneralShellType.PowerShell,
  GeneralShellType.Python
];
let TerminalInstance = class extends Disposable {
  constructor(_terminalShellTypeContextKey, _shellLaunchConfig, _contextKeyService, _contextMenuService, instantiationService, _terminalConfigurationService, _terminalProfileResolverService, _pathService, _keybindingService, _notificationService, _preferencesService, _viewsService, _themeService, _configurationService, _logService, _storageService, _accessibilityService, _productService, _quickInputService, workbenchEnvironmentService, _workspaceContextService, _editorService, _workspaceTrustRequestService, _historyService, _telemetryService, _openerService, _commandService, _accessibilitySignalService, _viewDescriptorService) {
    super();
    this._terminalShellTypeContextKey = _terminalShellTypeContextKey;
    this._shellLaunchConfig = _shellLaunchConfig;
    this._contextKeyService = _contextKeyService;
    this._contextMenuService = _contextMenuService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._pathService = _pathService;
    this._keybindingService = _keybindingService;
    this._notificationService = _notificationService;
    this._preferencesService = _preferencesService;
    this._viewsService = _viewsService;
    this._themeService = _themeService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._storageService = _storageService;
    this._accessibilityService = _accessibilityService;
    this._productService = _productService;
    this._quickInputService = _quickInputService;
    this._workspaceContextService = _workspaceContextService;
    this._editorService = _editorService;
    this._workspaceTrustRequestService = _workspaceTrustRequestService;
    this._historyService = _historyService;
    this._telemetryService = _telemetryService;
    this._openerService = _openerService;
    this._commandService = _commandService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._viewDescriptorService = _viewDescriptorService;
    this._contributions = /* @__PURE__ */ new Map();
    this._latestXtermWriteData = 0;
    this._latestXtermParseData = 0;
    this._title = "";
    this._titleSource = TitleEventSource.Process;
    this._cols = 0;
    this._rows = 0;
    this._cwd = void 0;
    this._initialCwd = void 0;
    this._injectedArgs = void 0;
    this._layoutSettingsChanged = true;
    this._areLinksReady = false;
    this._initialDataEventsListener = this._register(new MutableDisposable());
    this._initialDataEvents = [];
    this._messageTitleDisposable = this._register(new MutableDisposable());
    this._dndObserver = this._register(new MutableDisposable());
    this._processName = "";
    this._usedShellIntegrationInjection = false;
    this.capabilities = this._register(new TerminalCapabilityStoreMultiplexer());
    this.disableLayout = false;
    this._targetRef = new ImmortalReference(void 0);
    // The onExit event is special in that it fires and is disposed after the terminal instance
    // itself is disposed
    this._onExit = new Emitter();
    this.onExit = this._onExit.event;
    this._onDisposed = this._register(new Emitter());
    this.onDisposed = this._onDisposed.event;
    this._onProcessIdReady = this._register(new Emitter());
    this.onProcessIdReady = this._onProcessIdReady.event;
    this._onProcessReplayComplete = this._register(new Emitter());
    this.onProcessReplayComplete = this._onProcessReplayComplete.event;
    this._onTitleChanged = this._register(new Emitter());
    this.onTitleChanged = this._onTitleChanged.event;
    this._onIconChanged = this._register(new Emitter());
    this.onIconChanged = this._onIconChanged.event;
    this._onWillData = this._register(new Emitter());
    this.onWillData = this._onWillData.event;
    this._onData = this._register(new Emitter());
    this.onData = this._onData.event;
    this._onBinary = this._register(new Emitter());
    this.onBinary = this._onBinary.event;
    this._onRequestExtHostProcess = this._register(new Emitter());
    this.onRequestExtHostProcess = this._onRequestExtHostProcess.event;
    this._onDimensionsChanged = this._register(new Emitter());
    this.onDimensionsChanged = this._onDimensionsChanged.event;
    this._onMaximumDimensionsChanged = this._register(new Emitter());
    this.onMaximumDimensionsChanged = this._onMaximumDimensionsChanged.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidRequestFocus = this._register(new Emitter());
    this.onDidRequestFocus = this._onDidRequestFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._onDidInputData = this._register(new Emitter());
    this.onDidInputData = this._onDidInputData.event;
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._onRequestAddInstanceToGroup = this._register(new Emitter());
    this.onRequestAddInstanceToGroup = this._onRequestAddInstanceToGroup.event;
    this._onDidChangeHasChildProcesses = this._register(new Emitter());
    this.onDidChangeHasChildProcesses = this._onDidChangeHasChildProcesses.event;
    this._onDidExecuteText = this._register(new Emitter());
    this.onDidExecuteText = this._onDidExecuteText.event;
    this._onDidChangeTarget = this._register(new Emitter());
    this.onDidChangeTarget = this._onDidChangeTarget.event;
    this._onDidSendText = this._register(new Emitter());
    this.onDidSendText = this._onDidSendText.event;
    this._onDidChangeShellType = this._register(new Emitter());
    this.onDidChangeShellType = this._onDidChangeShellType.event;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.onDidChangeVisibility = this._onDidChangeVisibility.event;
    this._onLineData = this._register(new Emitter({
      onDidAddFirstListener: async () => (this.xterm ?? await this._xtermReadyPromise)?.raw.loadAddon(this._lineDataEventAddon)
    }));
    this.onLineData = this._onLineData.event;
    this._wrapperElement = document.createElement("div");
    this._wrapperElement.classList.add("terminal-wrapper");
    this._widgetManager = this._register(instantiationService.createInstance(TerminalWidgetManager));
    this._skipTerminalCommands = [];
    this._isExiting = false;
    this._hadFocusOnExit = false;
    this._isVisible = false;
    this._instanceId = TerminalInstance._instanceIdCounter++;
    this._hasHadInput = false;
    this._fixedRows = _shellLaunchConfig.attachPersistentProcess?.fixedDimensions?.rows;
    this._fixedCols = _shellLaunchConfig.attachPersistentProcess?.fixedDimensions?.cols;
    this._shellLaunchConfig.shellIntegrationEnvironmentReporting = this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnvironmentReporting);
    this._resource = getTerminalUri(this._workspaceContextService.getWorkspace().id, this.instanceId, this.title);
    if (this._shellLaunchConfig.attachPersistentProcess?.hideFromUser) {
      this._shellLaunchConfig.hideFromUser = this._shellLaunchConfig.attachPersistentProcess.hideFromUser;
    }
    if (this._shellLaunchConfig.attachPersistentProcess?.isFeatureTerminal) {
      this._shellLaunchConfig.isFeatureTerminal = this._shellLaunchConfig.attachPersistentProcess.isFeatureTerminal;
    }
    if (this._shellLaunchConfig.attachPersistentProcess?.type) {
      this._shellLaunchConfig.type = this._shellLaunchConfig.attachPersistentProcess.type;
    }
    if (this._shellLaunchConfig.attachPersistentProcess?.tabActions) {
      this._shellLaunchConfig.tabActions = this._shellLaunchConfig.attachPersistentProcess.tabActions;
    }
    if (this.shellLaunchConfig.cwd) {
      const cwdUri = typeof this._shellLaunchConfig.cwd === "string" ? URI.from({
        scheme: Schemas.file,
        path: this._shellLaunchConfig.cwd
      }) : this._shellLaunchConfig.cwd;
      if (cwdUri) {
        this._workspaceFolder = this._workspaceContextService.getWorkspaceFolder(cwdUri) ?? void 0;
      }
    }
    if (!this._workspaceFolder) {
      const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot();
      this._workspaceFolder = activeWorkspaceRootUri ? this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri) ?? void 0 : void 0;
    }
    const scopedContextKeyService = this._register(_contextKeyService.createScoped(this._wrapperElement));
    this._scopedContextKeyService = scopedContextKeyService;
    this._scopedInstantiationService = this._register(instantiationService.createChild(new ServiceCollection(
      [IContextKeyService, scopedContextKeyService]
    )));
    this._terminalFocusContextKey = TerminalContextKeys.focus.bindTo(scopedContextKeyService);
    this._terminalHasFixedWidth = TerminalContextKeys.terminalHasFixedWidth.bindTo(scopedContextKeyService);
    this._terminalHasTextContextKey = TerminalContextKeys.textSelected.bindTo(scopedContextKeyService);
    this._terminalAltBufferActiveContextKey = TerminalContextKeys.altBufferActive.bindTo(scopedContextKeyService);
    this._terminalShellIntegrationEnabledContextKey = TerminalContextKeys.terminalShellIntegrationEnabled.bindTo(scopedContextKeyService);
    this._logService.trace(`terminalInstance#ctor (instanceId: ${this.instanceId})`, this._shellLaunchConfig);
    this._register(this.capabilities.onDidAddCapabilityType((e) => this._logService.debug("terminalInstance added capability", e)));
    this._register(this.capabilities.onDidRemoveCapabilityType((e) => this._logService.debug("terminalInstance removed capability", e)));
    const capabilityListeners = this._register(new DisposableMap());
    this._register(this.capabilities.onDidAddCapabilityType((capability) => {
      capabilityListeners.get(capability)?.dispose();
      if (capability === TerminalCapability.CwdDetection) {
        const cwdDetection = this.capabilities.get(capability);
        if (cwdDetection) {
          capabilityListeners.set(capability, cwdDetection.onDidChangeCwd((e) => {
            this._cwd = e;
            this._setTitle(this.title, TitleEventSource.Config);
          }));
        }
      }
      if (capability === TerminalCapability.CommandDetection) {
        const commandDetection = this.capabilities.get(capability);
        if (commandDetection) {
          commandDetection.promptInputModel.setShellType(this.shellType);
          capabilityListeners.set(capability, Event.any(
            commandDetection.promptInputModel.onDidStartInput,
            commandDetection.promptInputModel.onDidChangeInput,
            commandDetection.promptInputModel.onDidFinishInput
          )(() => {
            this._labelComputer?.refreshLabel(this);
            refreshShellIntegrationInfoStatus(this);
          }));
        }
      }
    }));
    this._register(this.capabilities.onDidRemoveCapabilityType((capability) => {
      capabilityListeners.get(capability)?.dispose();
    }));
    if (!this.shellLaunchConfig.executable && !workbenchEnvironmentService.remoteAuthority) {
      this._terminalProfileResolverService.resolveIcon(this._shellLaunchConfig, OS);
    }
    this._icon = _shellLaunchConfig.attachPersistentProcess?.icon || _shellLaunchConfig.icon;
    if (this.shellLaunchConfig.customPtyImplementation) {
      this._setTitle(this._shellLaunchConfig.name, TitleEventSource.Api);
    }
    this.statusList = this._register(this._scopedInstantiationService.createInstance(TerminalStatusList));
    this._initDimensions();
    this._processManager = this._createProcessManager();
    this._containerReadyBarrier = new AutoOpenBarrier(100 /* WaitForContainerThreshold */);
    this._attachBarrier = new AutoOpenBarrier(1e3);
    this._xtermReadyPromise = this._createXterm();
    this._xtermReadyPromise.then(async () => {
      await this._containerReadyBarrier.wait();
      let os;
      if (!this.shellLaunchConfig.customPtyImplementation && this._terminalConfigurationService.config.shellIntegration?.enabled && !this.shellLaunchConfig.executable) {
        os = await this._processManager.getBackendOS();
        const defaultProfile = await this._terminalProfileResolverService.getDefaultProfile({ remoteAuthority: this.remoteAuthority, os });
        this.shellLaunchConfig.executable = defaultProfile.path;
        this.shellLaunchConfig.args = defaultProfile.args;
        if (this.shellLaunchConfig.isExtensionOwnedTerminal) {
          this.shellLaunchConfig.icon ??= defaultProfile.icon;
          this.shellLaunchConfig.color ??= defaultProfile.color;
          this.shellLaunchConfig.env ??= defaultProfile.env;
        } else {
          this.shellLaunchConfig.icon = defaultProfile.icon;
          this.shellLaunchConfig.color = defaultProfile.color;
          this.shellLaunchConfig.env = defaultProfile.env;
        }
      }
      if (os && this.shellLaunchConfig.executable) {
        this.setShellType(guessShellTypeFromExecutable(os, this.shellLaunchConfig.executable));
      }
      await this._createProcess();
      if (this.shellLaunchConfig.attachPersistentProcess) {
        this._cwd = this.shellLaunchConfig.attachPersistentProcess.cwd;
        this._setTitle(this.shellLaunchConfig.attachPersistentProcess.title, this.shellLaunchConfig.attachPersistentProcess.titleSource);
        this.setShellType(this.shellType);
      }
      if (this._fixedCols) {
        await this._addScrollbar();
      }
    }).catch((err) => {
      if (!this.isDisposed) {
        throw err;
      }
    });
    this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration(AccessibilityVerbositySettingId.Terminal)) {
        this._setAriaLabel(this.xterm?.raw, this._instanceId, this.title);
      }
      if (e.affectsConfiguration("terminal.integrated")) {
        this.updateConfig();
        this.setVisible(this._isVisible);
      }
      const layoutSettings = [
        TerminalSettingId.FontSize,
        TerminalSettingId.FontFamily,
        TerminalSettingId.FontWeight,
        TerminalSettingId.FontWeightBold,
        TerminalSettingId.LetterSpacing,
        TerminalSettingId.LineHeight,
        "editor.fontFamily"
      ];
      if (layoutSettings.some((id) => e.affectsConfiguration(id))) {
        this._layoutSettingsChanged = true;
        await this._resize();
      }
      if (e.affectsConfiguration(TerminalSettingId.UnicodeVersion)) {
        this._updateUnicodeVersion();
      }
      if (e.affectsConfiguration("editor.accessibilitySupport")) {
        this.updateAccessibilitySupport();
      }
      if (e.affectsConfiguration(TerminalSettingId.TerminalTitle) || e.affectsConfiguration(TerminalSettingId.TerminalTitleSeparator) || e.affectsConfiguration(TerminalSettingId.TerminalDescription)) {
        this._labelComputer?.refreshLabel(this);
      }
    }));
    this._register(this._workspaceContextService.onDidChangeWorkspaceFolders(() => this._labelComputer?.refreshLabel(this)));
    let initialDataEventsTimeout = dom.getWindow(this._container).setTimeout(() => {
      initialDataEventsTimeout = void 0;
      this._initialDataEvents = void 0;
      this._initialDataEventsListener.clear();
    }, 1e4);
    this._register(toDisposable(() => {
      if (initialDataEventsTimeout) {
        dom.getWindow(this._container).clearTimeout(initialDataEventsTimeout);
      }
    }));
    const contributionDescs = TerminalExtensionsRegistry.getTerminalContributions();
    for (const desc of contributionDescs) {
      if (this._contributions.has(desc.id)) {
        onUnexpectedError(new Error(`Cannot have two terminal contributions with the same id ${desc.id}`));
        continue;
      }
      let contribution;
      try {
        contribution = this._register(this._scopedInstantiationService.createInstance(desc.ctor, {
          instance: this,
          processManager: this._processManager,
          widgetManager: this._widgetManager
        }));
        this._contributions.set(desc.id, contribution);
      } catch (err) {
        onUnexpectedError(err);
      }
      this._xtermReadyPromise.then((xterm) => {
        if (xterm) {
          contribution.xtermReady?.(xterm);
        }
      });
      this._register(this.onDisposed(() => {
        contribution.dispose();
        this._contributions.delete(desc.id);
        if ("instance" in contribution) {
          delete contribution.instance;
        }
        if ("_instance" in contribution) {
          delete contribution._instance;
        }
      }));
    }
  }
  get domElement() {
    return this._wrapperElement;
  }
  get usedShellIntegrationInjection() {
    return this._usedShellIntegrationInjection;
  }
  pauseInputEvents(barrier) {
    this._pauseInputEventBarrier = barrier;
  }
  get store() {
    return this._store;
  }
  get extEnvironmentVariableCollection() {
    return this._processManager.extEnvironmentVariableCollection;
  }
  get waitOnExit() {
    return this._shellLaunchConfig.attachPersistentProcess?.waitOnExit || this._shellLaunchConfig.waitOnExit;
  }
  set waitOnExit(value) {
    this._shellLaunchConfig.waitOnExit = value;
  }
  get targetRef() {
    return this._targetRef;
  }
  get target() {
    return this._targetRef.object;
  }
  set target(value) {
    this._targetRef.object = value;
    this._onDidChangeTarget.fire(value);
  }
  get instanceId() {
    return this._instanceId;
  }
  get resource() {
    return this._resource;
  }
  get cols() {
    if (this._fixedCols !== void 0) {
      return this._fixedCols;
    }
    if (this._dimensionsOverride && this._dimensionsOverride.cols) {
      if (this._dimensionsOverride.forceExactSize) {
        return this._dimensionsOverride.cols;
      }
      return Math.min(Math.max(this._dimensionsOverride.cols, 2), this._cols);
    }
    return this._cols;
  }
  get rows() {
    if (this._fixedRows !== void 0) {
      return this._fixedRows;
    }
    if (this._dimensionsOverride && this._dimensionsOverride.rows) {
      if (this._dimensionsOverride.forceExactSize) {
        return this._dimensionsOverride.rows;
      }
      return Math.min(Math.max(this._dimensionsOverride.rows, 2), this._rows);
    }
    return this._rows;
  }
  get isDisposed() {
    return this._store.isDisposed;
  }
  get fixedCols() {
    return this._fixedCols;
  }
  get fixedRows() {
    return this._fixedRows;
  }
  get maxCols() {
    return this._cols;
  }
  get maxRows() {
    return this._rows;
  }
  // TODO: Ideally processId would be merged into processReady
  get processId() {
    return this._processManager.shellProcessId;
  }
  // TODO: How does this work with detached processes?
  // TODO: Should this be an event as it can fire twice?
  get processReady() {
    return this._processManager.ptyProcessReady;
  }
  get hasChildProcesses() {
    return this.shellLaunchConfig.attachPersistentProcess?.hasChildProcesses || this._processManager.hasChildProcesses;
  }
  get reconnectionProperties() {
    return this.shellLaunchConfig.attachPersistentProcess?.reconnectionProperties || this.shellLaunchConfig.reconnectionProperties;
  }
  get areLinksReady() {
    return this._areLinksReady;
  }
  get initialDataEvents() {
    return this._initialDataEvents;
  }
  get exitCode() {
    return this._exitCode;
  }
  get exitReason() {
    return this._exitReason;
  }
  get hadFocusOnExit() {
    return this._hadFocusOnExit;
  }
  get isTitleSetByProcess() {
    return !!this._messageTitleDisposable.value;
  }
  get shellLaunchConfig() {
    return this._shellLaunchConfig;
  }
  get shellType() {
    return this._shellType;
  }
  get os() {
    return this._processManager.os;
  }
  get isRemote() {
    return this._processManager.remoteAuthority !== void 0;
  }
  get remoteAuthority() {
    return this._processManager.remoteAuthority;
  }
  get hasFocus() {
    return dom.isAncestorOfActiveElement(this._wrapperElement);
  }
  get title() {
    return this._title;
  }
  get titleSource() {
    return this._titleSource;
  }
  get icon() {
    return this._getIcon();
  }
  get color() {
    return this._getColor();
  }
  get processName() {
    return this._processName;
  }
  get sequence() {
    return this._sequence;
  }
  get staticTitle() {
    return this._staticTitle;
  }
  get progressState() {
    return this.xterm?.progressState;
  }
  get workspaceFolder() {
    return this._workspaceFolder;
  }
  get cwd() {
    return this._cwd;
  }
  get initialCwd() {
    return this._initialCwd;
  }
  get description() {
    if (this._description) {
      return this._description;
    }
    const type = this.shellLaunchConfig.attachPersistentProcess?.type || this.shellLaunchConfig.type;
    switch (type) {
      case "Task":
        return terminalStrings.typeTask;
      case "Local":
        return terminalStrings.typeLocal;
      default:
        return void 0;
    }
  }
  get userHome() {
    return this._userHome;
  }
  get shellIntegrationNonce() {
    return this._processManager.shellIntegrationNonce;
  }
  get injectedArgs() {
    return this._injectedArgs;
  }
  getContribution(id) {
    return this._contributions.get(id);
  }
  _getIcon() {
    if (!this._icon) {
      this._icon = this._processManager.processState >= ProcessState.Launching ? getIconRegistry().getIcon(this._configurationService.getValue(TerminalSettingId.TabsDefaultIcon)) : void 0;
    }
    return this._icon;
  }
  _getColor() {
    if (this.shellLaunchConfig.color) {
      return this.shellLaunchConfig.color;
    }
    if (this.shellLaunchConfig?.attachPersistentProcess?.color) {
      return this.shellLaunchConfig.attachPersistentProcess.color;
    }
    if (this._processManager.processState >= ProcessState.Launching) {
      return void 0;
    }
    return void 0;
  }
  _initDimensions() {
    if (!this._container) {
      this._cols = 80 /* DefaultCols */;
      this._rows = 30 /* DefaultRows */;
      return;
    }
    const computedStyle = dom.getWindow(this._container).getComputedStyle(this._container);
    const width = parseInt(computedStyle.width);
    const height = parseInt(computedStyle.height);
    this._evaluateColsAndRows(width, height);
  }
  /**
   * Evaluates and sets the cols and rows of the terminal if possible.
   * @param width The width of the container.
   * @param height The height of the container.
   * @return The terminal's width if it requires a layout.
   */
  _evaluateColsAndRows(width, height) {
    if (!width || !height) {
      this._setLastKnownColsAndRows();
      return null;
    }
    const dimension = this._getDimension(width, height);
    if (!dimension) {
      this._setLastKnownColsAndRows();
      return null;
    }
    const font = this.xterm ? this.xterm.getFont() : this._terminalConfigurationService.getFont(dom.getWindow(this.domElement));
    const newRC = getXtermScaledDimensions(dom.getWindow(this.domElement), font, dimension.width, dimension.height);
    if (!newRC) {
      this._setLastKnownColsAndRows();
      return null;
    }
    if (this._cols !== newRC.cols || this._rows !== newRC.rows) {
      this._cols = newRC.cols;
      this._rows = newRC.rows;
      this._fireMaximumDimensionsChanged();
    }
    return dimension.width;
  }
  _setLastKnownColsAndRows() {
    if (TerminalInstance._lastKnownGridDimensions) {
      this._cols = TerminalInstance._lastKnownGridDimensions.cols;
      this._rows = TerminalInstance._lastKnownGridDimensions.rows;
    }
  }
  _fireMaximumDimensionsChanged() {
    this._onMaximumDimensionsChanged.fire();
  }
  _getDimension(width, height) {
    const font = this.xterm ? this.xterm.getFont() : this._terminalConfigurationService.getFont(dom.getWindow(this.domElement));
    if (!font || !font.charWidth || !font.charHeight) {
      return void 0;
    }
    if (!this.xterm?.raw.element) {
      return void 0;
    }
    const computedStyle = dom.getWindow(this.xterm.raw.element).getComputedStyle(this.xterm.raw.element);
    const horizontalPadding = parseInt(computedStyle.paddingLeft) + parseInt(computedStyle.paddingRight) + 14;
    const verticalPadding = parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);
    TerminalInstance._lastKnownCanvasDimensions = new dom.Dimension(
      Math.min(4096 /* MaxCanvasWidth */, width - horizontalPadding),
      height - verticalPadding + (this._hasScrollBar && this._horizontalScrollbar ? -5 : 0)
    );
    return TerminalInstance._lastKnownCanvasDimensions;
  }
  get persistentProcessId() {
    return this._processManager.persistentProcessId;
  }
  get shouldPersist() {
    return this._processManager.shouldPersist && !this.shellLaunchConfig.isTransient && (!this.reconnectionProperties || this._configurationService.getValue("task.reconnection") === true);
  }
  static getXtermConstructor(keybindingService, contextKeyService) {
    const keybinding = keybindingService.lookupKeybinding(TerminalContribCommandId.A11yFocusAccessibleBuffer, contextKeyService);
    if (xtermConstructor) {
      return xtermConstructor;
    }
    xtermConstructor = Promises.withAsyncBody(async (resolve) => {
      const Terminal = (await importAMDNodeModule("@xterm/xterm", "lib/xterm.js")).Terminal;
      Terminal.strings.promptLabel = nls.localize("terminal.integrated.a11yPromptLabel", "Terminal input");
      Terminal.strings.tooMuchOutput = keybinding ? nls.localize("terminal.integrated.useAccessibleBuffer", "Use the accessible buffer {0} to manually review output", keybinding.getLabel()) : nls.localize("terminal.integrated.useAccessibleBufferNoKb", "Use the Terminal: Focus Accessible Buffer command to manually review output");
      resolve(Terminal);
    });
    return xtermConstructor;
  }
  /**
   * Create xterm.js instance and attach data listeners.
   */
  async _createXterm() {
    const Terminal = await TerminalInstance.getXtermConstructor(this._keybindingService, this._contextKeyService);
    if (this.isDisposed) {
      return void 0;
    }
    const disableShellIntegrationReporting = this.shellLaunchConfig.executable === void 0 || this.shellType === void 0 || !shellIntegrationSupportedShellTypes.includes(this.shellType);
    const xterm = this._scopedInstantiationService.createInstance(XtermTerminal, Terminal, {
      cols: this._cols,
      rows: this._rows,
      xtermColorProvider: this._scopedInstantiationService.createInstance(TerminalInstanceColorProvider, this._targetRef),
      capabilities: this.capabilities,
      shellIntegrationNonce: this._processManager.shellIntegrationNonce,
      disableShellIntegrationReporting
    });
    this.xterm = xterm;
    this._resizeDebouncer = this._register(new TerminalResizeDebouncer(
      () => this._isVisible,
      () => xterm,
      async (cols, rows) => {
        xterm.raw.resize(cols, rows);
        await this._updatePtyDimensions(xterm.raw);
      },
      async (cols) => {
        xterm.raw.resize(cols, xterm.raw.rows);
        await this._updatePtyDimensions(xterm.raw);
      },
      async (rows) => {
        xterm.raw.resize(xterm.raw.cols, rows);
        await this._updatePtyDimensions(xterm.raw);
      }
    ));
    this._register(toDisposable(() => this._resizeDebouncer = void 0));
    this.updateAccessibilitySupport();
    this._register(this.xterm.onDidRequestRunCommand((e) => {
      this.sendText(e.command.command, e.noNewLine ? false : true);
    }));
    this._register(this.xterm.onDidRequestRefreshDimensions(() => {
      if (this._lastLayoutDimensions) {
        this.layout(this._lastLayoutDimensions);
      }
    }));
    const initialTextWrittenPromise = this._shellLaunchConfig.initialText ? new Promise((r) => this._writeInitialText(xterm, r)) : void 0;
    const lineDataEventAddon = this._register(new LineDataEventAddon(initialTextWrittenPromise));
    this._register(lineDataEventAddon.onLineData((e) => this._onLineData.fire(e)));
    this._lineDataEventAddon = lineDataEventAddon;
    disposableTimeout(() => {
      this._register(xterm.raw.onBell(() => {
        if (this._configurationService.getValue(TerminalSettingId.EnableBell) || this._configurationService.getValue(TerminalSettingId.EnableVisualBell)) {
          this.statusList.add({
            id: TerminalStatus.Bell,
            severity: Severity.Warning,
            icon: Codicon.bell,
            tooltip: nls.localize("bellStatus", "Bell")
          }, this._terminalConfigurationService.config.bellDuration);
        }
        this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalBell);
      }));
    }, 1e3, this._store);
    this._register(xterm.raw.onSelectionChange(() => this._onDidChangeSelection.fire(this)));
    this._register(xterm.raw.buffer.onBufferChange(() => this._refreshAltBufferContextKey()));
    this._register(this._processManager.onProcessData((e) => this._onProcessData(e)));
    this._register(xterm.raw.onData(async (data) => {
      await this._pauseInputEventBarrier?.wait();
      await this._processManager.write(data);
      this._onDidInputData.fire(data);
    }));
    this._register(xterm.raw.onBinary((data) => this._processManager.processBinary(data)));
    this._register(this._processManager.onProcessReady(async (processTraits) => {
      if (processTraits?.windowsPty?.backend === "conpty") {
        this._register(xterm.raw.parser.registerCsiHandler({ final: "c" }, (params) => {
          if (params.length === 0 || params.length === 1 && params[0] === 0) {
            this._processManager.write("\x1B[?61;4c");
            return true;
          }
          return false;
        }));
      }
      if (this._processManager.os) {
        lineDataEventAddon.setOperatingSystem(this._processManager.os);
      }
      xterm.raw.options.windowsPty = processTraits.windowsPty;
    }));
    this._register(this._processManager.onRestoreCommands((e) => this.xterm?.shellIntegration.deserialize(e)));
    this._register(this._viewDescriptorService.onDidChangeLocation(({ views }) => {
      if (views.some((v) => v.id === TERMINAL_VIEW_ID)) {
        xterm.refresh();
      }
    }));
    this._register(xterm.onDidChangeProgress(() => this._labelComputer?.refreshLabel(this)));
    this._register(Event.runAndSubscribe(xterm.shellIntegration.onDidChangeSeenSequences, () => {
      if (xterm.shellIntegration.seenSequences.size > 0) {
        refreshShellIntegrationInfoStatus(this);
      }
    }));
    if (!this.capabilities.has(TerminalCapability.CwdDetection)) {
      let onKeyListener = xterm.raw.onKey((e) => {
        const event = new StandardKeyboardEvent(e.domEvent);
        if (event.equals(KeyCode.Enter)) {
          this._updateProcessCwd();
        }
      });
      this._register(this.capabilities.onDidAddCapabilityType((e) => {
        if (e === TerminalCapability.CwdDetection) {
          onKeyListener?.dispose();
          onKeyListener = void 0;
        }
      }));
    }
    this._pathService.userHome().then((userHome) => {
      this._userHome = userHome.fsPath;
    });
    if (this._isVisible) {
      this._open();
    }
    return xterm;
  }
  async runCommand(commandLine, shouldExecute) {
    let commandDetection = this.capabilities.get(TerminalCapability.CommandDetection);
    if (!commandDetection && (this._processManager.processState === ProcessState.Uninitialized || this._processManager.processState === ProcessState.Launching)) {
      const store = new DisposableStore();
      await Promise.race([
        new Promise((r) => {
          store.add(this.capabilities.onDidAddCapabilityType((e) => {
            if (e === TerminalCapability.CommandDetection) {
              commandDetection = this.capabilities.get(TerminalCapability.CommandDetection);
              r();
            }
          }));
        }),
        timeout(2e3)
      ]);
      store.dispose();
    }
    if (!commandDetection || commandDetection.promptInputModel.value.length > 0) {
      await this.sendText("", false);
      await timeout(100);
    }
    await this.sendText(commandLine, shouldExecute, !shouldExecute);
  }
  detachFromElement() {
    this._wrapperElement.remove();
    this._container = void 0;
  }
  attachToElement(container) {
    if (this._container === container) {
      return;
    }
    if (!this._attachBarrier.isOpen()) {
      this._attachBarrier.open();
    }
    this._container = container;
    this._container.appendChild(this._wrapperElement);
    if (this.xterm?.raw.element) {
      this.xterm.raw.open(this.xterm.raw.element);
    }
    this.xterm?.refresh();
    setTimeout(() => {
      if (this._store.isDisposed) {
        return;
      }
      this._initDragAndDrop(container);
    }, 0);
  }
  /**
   * Opens the terminal instance inside the parent DOM element previously set with
   * `attachToElement`, you must ensure the parent DOM element is explicitly visible before
   * invoking this function as it performs some DOM calculations internally
   */
  _open() {
    if (!this.xterm || this.xterm.raw.element) {
      return;
    }
    if (!this._container || !this._container.isConnected) {
      throw new Error("A container element needs to be set with `attachToElement` and be part of the DOM before calling `_open`");
    }
    const xtermElement = document.createElement("div");
    this._wrapperElement.appendChild(xtermElement);
    this._container.appendChild(this._wrapperElement);
    const xterm = this.xterm;
    this._wrapperElement.xterm = xterm.raw;
    const screenElement = xterm.attachToElement(xtermElement);
    for (const contribution of this._contributions.values()) {
      if (!this.xterm) {
        this._xtermReadyPromise.then((xterm2) => {
          if (xterm2) {
            contribution.xtermOpen?.(xterm2);
          }
        });
      } else {
        contribution.xtermOpen?.(this.xterm);
      }
    }
    this._register(xterm.shellIntegration.onDidChangeStatus(() => {
      if (this.hasFocus) {
        this._setShellIntegrationContextKey();
      } else {
        this._terminalShellIntegrationEnabledContextKey.reset();
      }
    }));
    if (!xterm.raw.element || !xterm.raw.textarea) {
      throw new Error("xterm elements not set after open");
    }
    this._setAriaLabel(xterm.raw, this._instanceId, this._title);
    xterm.raw.attachCustomKeyEventHandler((event) => {
      if (this._isExiting) {
        return false;
      }
      const standardKeyboardEvent = new StandardKeyboardEvent(event);
      const resolveResult = this._keybindingService.softDispatch(standardKeyboardEvent, standardKeyboardEvent.target);
      const isValidChord = resolveResult.kind === ResultKind.MoreChordsNeeded && this._terminalConfigurationService.config.allowChords && event.key !== "Escape";
      if (this._keybindingService.inChordMode || isValidChord) {
        event.preventDefault();
        return false;
      }
      const SHOW_TERMINAL_CONFIG_PROMPT_KEY = "terminal.integrated.showTerminalConfigPrompt";
      const EXCLUDED_KEYS = ["RightArrow", "LeftArrow", "UpArrow", "DownArrow", "Space", "Meta", "Control", "Shift", "Alt", "", "Delete", "Backspace", "Tab"];
      if (this._storageService.getBoolean(SHOW_TERMINAL_CONFIG_PROMPT_KEY, StorageScope.APPLICATION, true) && !EXCLUDED_KEYS.includes(event.key) && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        this._hasHadInput = true;
      }
      if (resolveResult.kind === ResultKind.KbFound && resolveResult.commandId && this._skipTerminalCommands.some((k) => k === resolveResult.commandId) && !this._terminalConfigurationService.config.sendKeybindingsToShell) {
        if (this._storageService.getBoolean(SHOW_TERMINAL_CONFIG_PROMPT_KEY, StorageScope.APPLICATION, true) && this._hasHadInput && !TERMINAL_CREATION_COMMANDS.includes(resolveResult.commandId)) {
          this._notificationService.prompt(
            Severity.Info,
            nls.localize("keybindingHandling", "Some keybindings don't go to the terminal by default and are handled by {0} instead.", this._productService.nameLong),
            [
              {
                label: nls.localize("configureTerminalSettings", "Configure Terminal Settings"),
                run: () => {
                  this._preferencesService.openSettings({ jsonEditor: false, query: `@id:${TerminalSettingId.CommandsToSkipShell},${TerminalSettingId.SendKeybindingsToShell},${TerminalSettingId.AllowChords}` });
                }
              }
            ]
          );
          this._storageService.store(SHOW_TERMINAL_CONFIG_PROMPT_KEY, false, StorageScope.APPLICATION, StorageTarget.USER);
        }
        event.preventDefault();
        return false;
      }
      if (this._terminalConfigurationService.config.allowMnemonics && !isMacintosh && event.altKey) {
        return false;
      }
      if (TabFocus.getTabFocusMode() && event.key === "Tab") {
        return false;
      }
      if (event.key === "Tab" && event.shiftKey) {
        event.preventDefault();
        return true;
      }
      if (isWindows && event.altKey && event.key === "F4" && !event.ctrlKey) {
        return false;
      }
      if (!BrowserFeatures.clipboard.readText && event.key === "v" && event.ctrlKey) {
        return false;
      }
      return true;
    });
    this._register(dom.addDisposableListener(xterm.raw.element, "mousedown", () => {
      const listener = dom.addDisposableListener(xterm.raw.element.ownerDocument, "mouseup", () => {
        setTimeout(() => this._refreshSelectionContextKey(), 0);
        listener.dispose();
      });
    }));
    this._register(dom.addDisposableListener(xterm.raw.element, "touchstart", () => {
      xterm.raw.focus();
    }));
    this._register(dom.addDisposableListener(xterm.raw.element, "keyup", () => {
      setTimeout(() => this._refreshSelectionContextKey(), 0);
    }));
    this._register(dom.addDisposableListener(xterm.raw.textarea, "focus", () => this._setFocus(true)));
    this._register(dom.addDisposableListener(xterm.raw.textarea, "blur", () => this._setFocus(false)));
    this._register(dom.addDisposableListener(xterm.raw.textarea, "focusout", () => this._setFocus(false)));
    this._initDragAndDrop(this._container);
    this._widgetManager.attachToElement(screenElement);
    if (this._lastLayoutDimensions) {
      this.layout(this._lastLayoutDimensions);
    }
    this.updateConfig();
    if (xterm.raw.options.disableStdin) {
      this._attachPressAnyKeyToCloseListener(xterm.raw);
    }
  }
  _setFocus(focused) {
    if (focused) {
      this._terminalFocusContextKey.set(true);
      this._setShellIntegrationContextKey();
      this._onDidFocus.fire(this);
    } else {
      this.resetFocusContextKey();
      this._onDidBlur.fire(this);
      this._refreshSelectionContextKey();
    }
  }
  _setShellIntegrationContextKey() {
    if (this.xterm) {
      this._terminalShellIntegrationEnabledContextKey.set(this.xterm.shellIntegration.status === ShellIntegrationStatus.VSCode);
    }
  }
  resetFocusContextKey() {
    this._terminalFocusContextKey.reset();
    this._terminalShellIntegrationEnabledContextKey.reset();
  }
  _initDragAndDrop(container) {
    const store = new DisposableStore();
    const dndController = store.add(this._scopedInstantiationService.createInstance(TerminalInstanceDragAndDropController, container));
    store.add(dndController.onDropTerminal((e) => this._onRequestAddInstanceToGroup.fire(e)));
    store.add(dndController.onDropFile(async (path2) => {
      this.focus();
      await this.sendPath(path2, false);
    }));
    store.add(new dom.DragAndDropObserver(container, dndController));
    this._dndObserver.value = store;
  }
  hasSelection() {
    return this.xterm ? this.xterm.raw.hasSelection() : false;
  }
  get selection() {
    return this.xterm && this.hasSelection() ? this.xterm.raw.getSelection() : void 0;
  }
  clearSelection() {
    this.xterm?.raw.clearSelection();
  }
  _refreshAltBufferContextKey() {
    this._terminalAltBufferActiveContextKey.set(!!(this.xterm && this.xterm.raw.buffer.active === this.xterm.raw.buffer.alternate));
  }
  dispose(reason) {
    if (this.shellLaunchConfig.type === "Task" && reason === TerminalExitReason.Process && this._exitCode !== 0 && !this.shellLaunchConfig.waitOnExit) {
      return;
    }
    if (this.isDisposed) {
      return;
    }
    this._logService.trace(`terminalInstance#dispose (instanceId: ${this.instanceId})`);
    dispose(this._widgetManager);
    if (this.xterm?.raw.element) {
      this._hadFocusOnExit = this.hasFocus;
    }
    if (this._wrapperElement.xterm) {
      this._wrapperElement.xterm = void 0;
    }
    if (this._horizontalScrollbar) {
      this._horizontalScrollbar.dispose();
      this._horizontalScrollbar = void 0;
    }
    try {
      this.xterm?.dispose();
    } catch (err) {
      this._logService.error("Exception occurred during xterm disposal", err);
    }
    if (isFirefox) {
      this.resetFocusContextKey();
      this._terminalHasTextContextKey.reset();
      this._onDidBlur.fire(this);
    }
    if (this._pressAnyKeyToCloseListener) {
      this._pressAnyKeyToCloseListener.dispose();
      this._pressAnyKeyToCloseListener = void 0;
    }
    if (this._exitReason === void 0) {
      this._exitReason = reason ?? TerminalExitReason.Unknown;
    }
    this._processManager.dispose();
    this._onProcessExit(void 0);
    this._onDisposed.fire(this);
    super.dispose();
  }
  async detachProcessAndDispose(reason) {
    await this._processManager.detachFromProcess(reason === TerminalExitReason.User);
    this.dispose(reason);
  }
  focus(force) {
    this._refreshAltBufferContextKey();
    if (!this.xterm) {
      return;
    }
    if (force || !dom.getActiveWindow().getSelection()?.toString()) {
      this.xterm.raw.focus();
      this._onDidRequestFocus.fire();
    }
  }
  async focusWhenReady(force) {
    await this._xtermReadyPromise;
    await this._attachBarrier.wait();
    this.focus(force);
  }
  async sendText(text, shouldExecute, bracketedPasteMode) {
    if (bracketedPasteMode && this.xterm?.raw.modes.bracketedPasteMode) {
      text = `\x1B[200~${text}\x1B[201~`;
    }
    text = text.replace(/\r?\n/g, "\r");
    if (shouldExecute && !text.endsWith("\r")) {
      text += "\r";
    }
    this._logService.debug("sending data (vscode)", text);
    await this._processManager.write(text);
    this._onDidInputData.fire(text);
    this._onDidSendText.fire(text);
    this.xterm?.scrollToBottom();
    if (shouldExecute) {
      this._onDidExecuteText.fire();
    }
  }
  async sendPath(originalPath, shouldExecute) {
    return this.sendText(await this.preparePathForShell(originalPath), shouldExecute);
  }
  async preparePathForShell(originalPath) {
    await this.processReady;
    return preparePathForShell(originalPath, this.shellLaunchConfig.executable, this.title, this.shellType, this._processManager.backend, this._processManager.os);
  }
  setVisible(visible) {
    const didChange = this._isVisible !== visible;
    this._isVisible = visible;
    this._wrapperElement.classList.toggle("active", visible);
    if (visible && this.xterm) {
      this._open();
      this._resizeDebouncer?.flush();
      this._resize();
    }
    if (didChange) {
      this._onDidChangeVisibility.fire(visible);
    }
  }
  scrollDownLine() {
    this.xterm?.scrollDownLine();
  }
  scrollDownPage() {
    this.xterm?.scrollDownPage();
  }
  scrollToBottom() {
    this.xterm?.scrollToBottom();
  }
  scrollUpLine() {
    this.xterm?.scrollUpLine();
  }
  scrollUpPage() {
    this.xterm?.scrollUpPage();
  }
  scrollToTop() {
    this.xterm?.scrollToTop();
  }
  clearBuffer() {
    this._processManager.clearBuffer();
    this.xterm?.clearBuffer();
  }
  _refreshSelectionContextKey() {
    const isActive = !!this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
    let isEditorActive = false;
    const editor = this._editorService.activeEditor;
    if (editor) {
      isEditorActive = editor instanceof TerminalEditorInput;
    }
    this._terminalHasTextContextKey.set((isActive || isEditorActive) && this.hasSelection());
  }
  _createProcessManager() {
    let deserializedCollections;
    if (this.shellLaunchConfig.attachPersistentProcess?.environmentVariableCollections) {
      deserializedCollections = deserializeEnvironmentVariableCollections(this.shellLaunchConfig.attachPersistentProcess.environmentVariableCollections);
    }
    const processManager = this._scopedInstantiationService.createInstance(
      TerminalProcessManager,
      this._instanceId,
      this.shellLaunchConfig?.cwd,
      deserializedCollections,
      this.shellLaunchConfig.attachPersistentProcess?.shellIntegrationNonce
    );
    this.capabilities.add(processManager.capabilities);
    this._register(processManager.onProcessReady(async (e) => {
      this._onProcessIdReady.fire(this);
      this._initialCwd = await this.getInitialCwd();
      if (!this._labelComputer) {
        this._labelComputer = this._register(this._scopedInstantiationService.createInstance(TerminalLabelComputer));
        this._register(this._labelComputer.onDidChangeLabel((e2) => {
          const wasChanged = this._title !== e2.title || this._description !== e2.description;
          if (wasChanged) {
            this._title = e2.title;
            this._description = e2.description;
            this._onTitleChanged.fire(this);
          }
        }));
      }
      if (this._shellLaunchConfig.name) {
        this._setTitle(this._shellLaunchConfig.name, TitleEventSource.Api);
      } else {
        setTimeout(() => {
          this._xtermReadyPromise.then((xterm) => {
            if (xterm) {
              this._messageTitleDisposable.value = xterm.raw.onTitleChange((e2) => this._onTitleChange(e2));
            }
          });
        });
        this._setTitle(this._shellLaunchConfig.executable, TitleEventSource.Process);
      }
    }));
    this._register(processManager.onProcessExit((exitCode) => this._onProcessExit(exitCode)));
    this._register(processManager.onDidChangeProperty(({ type, value }) => {
      switch (type) {
        case ProcessPropertyType.Cwd:
          this._cwd = value;
          this._labelComputer?.refreshLabel(this);
          break;
        case ProcessPropertyType.InitialCwd:
          this._initialCwd = value;
          this._cwd = this._initialCwd;
          this._setTitle(this.title, TitleEventSource.Config);
          this._icon = this._shellLaunchConfig.attachPersistentProcess?.icon || this._shellLaunchConfig.icon;
          this._onIconChanged.fire({ instance: this, userInitiated: false });
          break;
        case ProcessPropertyType.Title:
          this._setTitle(value ?? "", TitleEventSource.Process);
          break;
        case ProcessPropertyType.OverrideDimensions:
          this.setOverrideDimensions(value, true);
          break;
        case ProcessPropertyType.ResolvedShellLaunchConfig:
          this._setResolvedShellLaunchConfig(value);
          break;
        case ProcessPropertyType.ShellType:
          this.setShellType(value);
          break;
        case ProcessPropertyType.HasChildProcesses:
          this._onDidChangeHasChildProcesses.fire(value);
          break;
        case ProcessPropertyType.UsedShellIntegrationInjection:
          this._usedShellIntegrationInjection = true;
          break;
      }
    }));
    this._initialDataEventsListener.value = processManager.onProcessData((ev) => this._initialDataEvents?.push(ev.data));
    this._register(processManager.onProcessReplayComplete(() => this._onProcessReplayComplete.fire()));
    this._register(processManager.onEnvironmentVariableInfoChanged((e) => this._onEnvironmentVariableInfoChanged(e)));
    this._register(processManager.onPtyDisconnect(() => {
      if (this.xterm) {
        this.xterm.raw.options.disableStdin = true;
      }
      this.statusList.add({
        id: TerminalStatus.Disconnected,
        severity: Severity.Error,
        icon: Codicon.debugDisconnect,
        tooltip: nls.localize("disconnectStatus", "Lost connection to process")
      });
    }));
    this._register(processManager.onPtyReconnect(() => {
      if (this.xterm) {
        this.xterm.raw.options.disableStdin = false;
      }
      this.statusList.remove(TerminalStatus.Disconnected);
    }));
    return processManager;
  }
  async _createProcess() {
    if (this.isDisposed) {
      return;
    }
    const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(Schemas.file);
    if (activeWorkspaceRootUri) {
      const trusted = await this._trust();
      if (!trusted) {
        this._onProcessExit({ message: nls.localize("workspaceNotTrustedCreateTerminal", "Cannot launch a terminal process in an untrusted workspace") });
      }
    } else if (this._cwd && this._userHome && this._cwd !== this._userHome) {
      this._onProcessExit({
        message: nls.localize("workspaceNotTrustedCreateTerminalCwd", "Cannot launch a terminal process in an untrusted workspace with cwd {0} and userHome {1}", this._cwd, this._userHome)
      });
    }
    if (this._container && this._cols === 0 && this._rows === 0) {
      this._initDimensions();
      this.xterm?.raw.resize(this._cols || 80 /* DefaultCols */, this._rows || 30 /* DefaultRows */);
    }
    const originalIcon = this.shellLaunchConfig.icon;
    await this._processManager.createProcess(this._shellLaunchConfig, this._cols || 80 /* DefaultCols */, this._rows || 30 /* DefaultRows */).then((result) => {
      if (result) {
        if ("message" in result) {
          this._onProcessExit(result);
        } else if ("injectedArgs" in result) {
          this._injectedArgs = result.injectedArgs;
        }
      }
    });
    if (this.isDisposed) {
      return;
    }
    if (this.xterm?.shellIntegration) {
      this.capabilities.add(this.xterm.shellIntegration.capabilities);
    }
    if (originalIcon !== this.shellLaunchConfig.icon || this.shellLaunchConfig.color) {
      this._icon = this._shellLaunchConfig.attachPersistentProcess?.icon || this._shellLaunchConfig.icon;
      this._onIconChanged.fire({ instance: this, userInitiated: false });
    }
  }
  registerMarker(offset) {
    return this.xterm?.raw.registerMarker(offset);
  }
  addBufferMarker(properties) {
    this.capabilities.get(TerminalCapability.BufferMarkDetection)?.addMark(properties);
  }
  scrollToMark(startMarkId, endMarkId, highlight) {
    this.xterm?.markTracker.scrollToClosestMarker(startMarkId, endMarkId, highlight);
  }
  async freePortKillProcess(port, command) {
    await this._processManager?.freePortKillProcess(port);
    this.runCommand(command, false);
  }
  _onProcessData(ev) {
    const leadingSegmentedData = [];
    const matches = ev.data.matchAll(/(?<seq>\x1b\][16]33;(?:C|D(?:;\d+)?)\x07)/g);
    let i = 0;
    for (const match of matches) {
      if (match.groups?.seq === void 0) {
        throw new BugIndicatingError("seq must be defined");
      }
      leadingSegmentedData.push(ev.data.substring(i, match.index));
      leadingSegmentedData.push(match.groups?.seq ?? "");
      i = match.index + match[0].length;
    }
    const lastData = ev.data.substring(i);
    for (let i2 = 0; i2 < leadingSegmentedData.length; i2++) {
      this._writeProcessData(leadingSegmentedData[i2]);
    }
    if (ev.trackCommit) {
      ev.writePromise = new Promise((r) => this._writeProcessData(lastData, r));
    } else {
      this._writeProcessData(lastData);
    }
  }
  _writeProcessData(data, cb) {
    this._onWillData.fire(data);
    const messageId = ++this._latestXtermWriteData;
    this.xterm?.raw.write(data, () => {
      this._latestXtermParseData = messageId;
      this._processManager.acknowledgeDataEvent(data.length);
      cb?.();
      this._onData.fire(data);
    });
  }
  /**
   * Called when either a process tied to a terminal has exited or when a terminal renderer
   * simulates a process exiting (e.g. custom execution task).
   * @param exitCode The exit code of the process, this is undefined when the terminal was exited
   * through user action.
   */
  async _onProcessExit(exitCodeOrError) {
    if (this._isExiting) {
      return;
    }
    const parsedExitResult = parseExitResult(exitCodeOrError, this.shellLaunchConfig, this._processManager.processState, this._initialCwd);
    if (this._usedShellIntegrationInjection && this._processManager.processState === ProcessState.KilledDuringLaunch && parsedExitResult?.code !== 0) {
      this._relaunchWithShellIntegrationDisabled(parsedExitResult?.message);
      this._onExit.fire(exitCodeOrError);
      return;
    }
    this._isExiting = true;
    await this._flushXtermData();
    this._exitCode = parsedExitResult?.code;
    const exitMessage = parsedExitResult?.message;
    this._logService.debug("Terminal process exit", "instanceId", this.instanceId, "code", this._exitCode, "processState", this._processManager.processState);
    const waitOnExit = this.waitOnExit;
    if (waitOnExit && this._processManager.processState !== ProcessState.KilledByUser) {
      this._xtermReadyPromise.then((xterm) => {
        if (!xterm) {
          return;
        }
        if (exitMessage) {
          xterm.raw.write(formatMessageForTerminal(exitMessage));
        }
        switch (typeof waitOnExit) {
          case "string":
            xterm.raw.write(formatMessageForTerminal(waitOnExit, { excludeLeadingNewLine: true }));
            break;
          case "function":
            if (this.exitCode !== void 0) {
              xterm.raw.write(formatMessageForTerminal(waitOnExit(this.exitCode), { excludeLeadingNewLine: true }));
            }
            break;
        }
        xterm.raw.options.disableStdin = true;
        if (xterm.raw.textarea) {
          this._attachPressAnyKeyToCloseListener(xterm.raw);
        }
      });
    } else {
      if (exitMessage) {
        const failedDuringLaunch = this._processManager.processState === ProcessState.KilledDuringLaunch;
        if (failedDuringLaunch || this._terminalConfigurationService.config.showExitAlert && this.xterm?.lastInputEvent !== /*Ctrl+D*/
        "") {
          this._notificationService.notify({
            message: exitMessage,
            severity: Severity.Error,
            actions: { primary: [this._scopedInstantiationService.createInstance(TerminalLaunchHelpAction)] }
          });
        } else {
          this._logService.warn(exitMessage);
        }
      }
      this.dispose(TerminalExitReason.Process);
    }
    this._onExit.fire(exitCodeOrError);
    if (this.isDisposed) {
      this._onExit.dispose();
    }
  }
  _relaunchWithShellIntegrationDisabled(exitMessage) {
    this._shellLaunchConfig.ignoreShellIntegration = true;
    this.relaunch();
    this.statusList.add({
      id: TerminalStatus.ShellIntegrationAttentionNeeded,
      severity: Severity.Warning,
      icon: Codicon.warning,
      tooltip: `${exitMessage} ` + nls.localize("launchFailed.exitCodeOnlyShellIntegration", "Disabling shell integration in user settings might help."),
      hoverActions: [{
        commandId: TerminalCommandId.ShellIntegrationLearnMore,
        label: nls.localize("shellIntegration.learnMore", "Learn more about shell integration"),
        run: () => {
          this._openerService.open("https://code.visualstudio.com/docs/editor/integrated-terminal#_shell-integration");
        }
      }, {
        commandId: "workbench.action.openSettings",
        label: nls.localize("shellIntegration.openSettings", "Open user settings"),
        run: () => {
          this._commandService.executeCommand("workbench.action.openSettings", "terminal.integrated.shellIntegration.enabled");
        }
      }]
    });
    this._telemetryService.publicLog2("terminal/shellIntegrationFailureProcessExit");
  }
  /**
   * Ensure write calls to xterm.js have finished before resolving.
   */
  _flushXtermData() {
    if (this._latestXtermWriteData === this._latestXtermParseData) {
      return Promise.resolve();
    }
    let retries = 0;
    return new Promise((r) => {
      const interval = dom.disposableWindowInterval(dom.getActiveWindow().window, () => {
        if (this._latestXtermWriteData === this._latestXtermParseData || ++retries === 5) {
          interval.dispose();
          r();
        }
      }, 20);
    });
  }
  _attachPressAnyKeyToCloseListener(xterm) {
    if (xterm.textarea && !this._pressAnyKeyToCloseListener) {
      this._pressAnyKeyToCloseListener = dom.addDisposableListener(xterm.textarea, "keypress", (event) => {
        if (this._pressAnyKeyToCloseListener) {
          this._pressAnyKeyToCloseListener.dispose();
          this._pressAnyKeyToCloseListener = void 0;
          this.dispose(TerminalExitReason.Process);
          event.preventDefault();
        }
      });
    }
  }
  _writeInitialText(xterm, callback) {
    if (!this._shellLaunchConfig.initialText) {
      callback?.();
      return;
    }
    const text = typeof this._shellLaunchConfig.initialText === "string" ? this._shellLaunchConfig.initialText : this._shellLaunchConfig.initialText?.text;
    if (typeof this._shellLaunchConfig.initialText === "string") {
      xterm.raw.writeln(text, callback);
    } else {
      if (this._shellLaunchConfig.initialText.trailingNewLine) {
        xterm.raw.writeln(text, callback);
      } else {
        xterm.raw.write(text, callback);
      }
    }
  }
  async reuseTerminal(shell, reset = false) {
    this._pressAnyKeyToCloseListener?.dispose();
    this._pressAnyKeyToCloseListener = void 0;
    const xterm = this.xterm;
    if (xterm) {
      if (!reset) {
        await new Promise((r) => xterm.raw.write("\n\x1B[G", r));
      }
      if (shell.initialText) {
        this._shellLaunchConfig.initialText = shell.initialText;
        await new Promise((r) => this._writeInitialText(xterm, r));
      }
      if (this._isExiting && this._shellLaunchConfig.waitOnExit) {
        xterm.raw.options.disableStdin = false;
        this._isExiting = false;
      }
      if (reset) {
        xterm.clearDecorations();
      }
    }
    this.statusList.remove(TerminalStatus.RelaunchNeeded);
    if (!reset) {
      shell.initialText = " ";
    }
    this._shellLaunchConfig = shell;
    await this._processManager.relaunch(this._shellLaunchConfig, this._cols || 80 /* DefaultCols */, this._rows || 30 /* DefaultRows */, reset).then((result) => {
      if (result) {
        if ("message" in result) {
          this._onProcessExit(result);
        } else if ("injectedArgs" in result) {
          this._injectedArgs = result.injectedArgs;
        }
      }
    });
  }
  relaunch() {
    this.reuseTerminal(this._shellLaunchConfig, true);
  }
  _onTitleChange(title) {
    if (this.isTitleSetByProcess) {
      this._setTitle(title, TitleEventSource.Sequence);
    }
  }
  async _trust() {
    return await this._workspaceTrustRequestService.requestWorkspaceTrust(
      {
        message: nls.localize("terminal.requestTrust", "Creating a terminal process requires executing code")
      }
    ) === true;
  }
  async _updateProcessCwd() {
    if (this.isDisposed || this.shellLaunchConfig.customPtyImplementation) {
      return;
    }
    try {
      const cwd = await this._refreshProperty(ProcessPropertyType.Cwd);
      if (typeof cwd !== "string") {
        throw new Error(`cwd is not a string ${cwd}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "Cannot refresh property when process is not set") {
        return;
      }
      throw e;
    }
  }
  updateConfig() {
    this._setCommandsToSkipShell(this._terminalConfigurationService.config.commandsToSkipShell);
    this._refreshEnvironmentVariableInfoWidgetState(this._processManager.environmentVariableInfo);
  }
  async _updateUnicodeVersion() {
    this._processManager.setUnicodeVersion(this._terminalConfigurationService.config.unicodeVersion);
  }
  updateAccessibilitySupport() {
    this.xterm.raw.options.screenReaderMode = this._accessibilityService.isScreenReaderOptimized();
  }
  _setCommandsToSkipShell(commands) {
    const excludeCommands = commands.filter((command) => command[0] === "-").map((command) => command.slice(1));
    this._skipTerminalCommands = DEFAULT_COMMANDS_TO_SKIP_SHELL.filter((defaultCommand) => {
      return !excludeCommands.includes(defaultCommand);
    }).concat(commands);
  }
  layout(dimension) {
    this._lastLayoutDimensions = dimension;
    if (this.disableLayout) {
      return;
    }
    if (dimension.width <= 0 || dimension.height <= 0) {
      return;
    }
    const terminalWidth = this._evaluateColsAndRows(dimension.width, dimension.height);
    if (!terminalWidth) {
      return;
    }
    this._resize();
    if (!this._containerReadyBarrier.isOpen()) {
      this._containerReadyBarrier.open();
    }
    for (const contribution of this._contributions.values()) {
      if (!this.xterm) {
        this._xtermReadyPromise.then((xterm) => {
          if (xterm) {
            contribution.layout?.(xterm, dimension);
          }
        });
      } else {
        contribution.layout?.(this.xterm, dimension);
      }
    }
  }
  async _resize(immediate) {
    if (!this.xterm) {
      return;
    }
    let cols = this.cols;
    let rows = this.rows;
    if (this._isVisible && this._layoutSettingsChanged) {
      const font = this.xterm.getFont();
      const config = this._terminalConfigurationService.config;
      this.xterm.raw.options.letterSpacing = font.letterSpacing;
      this.xterm.raw.options.lineHeight = font.lineHeight;
      this.xterm.raw.options.fontSize = font.fontSize;
      this.xterm.raw.options.fontFamily = font.fontFamily;
      this.xterm.raw.options.fontWeight = config.fontWeight;
      this.xterm.raw.options.fontWeightBold = config.fontWeightBold;
      this._initDimensions();
      cols = this.cols;
      rows = this.rows;
      this._layoutSettingsChanged = false;
    }
    if (isNaN(cols) || isNaN(rows)) {
      return;
    }
    if (cols !== this.xterm.raw.cols || rows !== this.xterm.raw.rows) {
      if (this._fixedRows || this._fixedCols) {
        await this._updateProperty(ProcessPropertyType.FixedDimensions, { cols: this._fixedCols, rows: this._fixedRows });
      }
      this._onDimensionsChanged.fire();
    }
    TerminalInstance._lastKnownGridDimensions = { cols, rows };
    this._resizeDebouncer.resize(cols, rows, immediate ?? false);
  }
  async _updatePtyDimensions(rawXterm) {
    await this._processManager.setDimensions(rawXterm.cols, rawXterm.rows);
  }
  setShellType(shellType) {
    if (this._shellType === shellType) {
      return;
    }
    if (shellType) {
      this._shellType = shellType;
      this._terminalShellTypeContextKey.set(shellType?.toString());
      this._onDidChangeShellType.fire(shellType);
    }
  }
  _setAriaLabel(xterm, terminalId, title) {
    const labelParts = [];
    if (xterm && xterm.textarea) {
      if (title && title.length > 0) {
        labelParts.push(nls.localize("terminalTextBoxAriaLabelNumberAndTitle", "Terminal {0}, {1}", terminalId, title));
      } else {
        labelParts.push(nls.localize("terminalTextBoxAriaLabel", "Terminal {0}", terminalId));
      }
      const screenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
      if (!screenReaderOptimized) {
        labelParts.push(nls.localize("terminalScreenReaderMode", "Run the command: Toggle Screen Reader Accessibility Mode for an optimized screen reader experience"));
      }
      const accessibilityHelpKeybinding = this._keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
      if (this._configurationService.getValue(AccessibilityVerbositySettingId.Terminal) && accessibilityHelpKeybinding) {
        labelParts.push(nls.localize("terminalHelpAriaLabel", "Use {0} for terminal accessibility help", accessibilityHelpKeybinding));
      }
      xterm.textarea.setAttribute("aria-label", labelParts.join("\n"));
    }
  }
  _updateTitleProperties(title, eventSource) {
    if (!title) {
      return this._processName;
    }
    switch (eventSource) {
      case TitleEventSource.Process:
        if (this._processManager.os === OperatingSystem.Windows) {
          title = path.win32.parse(title).name;
        } else {
          const firstSpaceIndex = title.indexOf(" ");
          if (title.startsWith("/")) {
            title = path.basename(title);
          } else if (firstSpaceIndex > -1) {
            title = title.substring(0, firstSpaceIndex);
          }
        }
        this._processName = title;
        break;
      case TitleEventSource.Api:
        this._staticTitle = title;
        this._messageTitleDisposable.value = void 0;
        break;
      case TitleEventSource.Sequence:
        this._sequence = title;
        if (this._processManager.os === OperatingSystem.Windows && title.match(/^[a-zA-Z]:\\.+\.[a-zA-Z]{1,3}/)) {
          this._sequence = path.win32.parse(title).name;
        }
        break;
    }
    this._titleSource = eventSource;
    return title;
  }
  setOverrideDimensions(dimensions, immediate = false) {
    if (this._dimensionsOverride && this._dimensionsOverride.forceExactSize && !dimensions && this._rows === 0 && this._cols === 0) {
      this._cols = this._dimensionsOverride.cols;
      this._rows = this._dimensionsOverride.rows;
    }
    this._dimensionsOverride = dimensions;
    if (immediate) {
      this._resize(true);
    } else {
      this._resize();
    }
  }
  async setFixedDimensions() {
    const cols = await this._quickInputService.input({
      title: nls.localize("setTerminalDimensionsColumn", "Set Fixed Dimensions: Column"),
      placeHolder: "Enter a number of columns or leave empty for automatic width",
      validateInput: async (text) => text.length > 0 && !text.match(/^\d+$/) ? { content: "Enter a number or leave empty size automatically", severity: Severity.Error } : void 0
    });
    if (cols === void 0) {
      return;
    }
    this._fixedCols = this._parseFixedDimension(cols);
    this._labelComputer?.refreshLabel(this);
    this._terminalHasFixedWidth.set(!!this._fixedCols);
    const rows = await this._quickInputService.input({
      title: nls.localize("setTerminalDimensionsRow", "Set Fixed Dimensions: Row"),
      placeHolder: "Enter a number of rows or leave empty for automatic height",
      validateInput: async (text) => text.length > 0 && !text.match(/^\d+$/) ? { content: "Enter a number or leave empty size automatically", severity: Severity.Error } : void 0
    });
    if (rows === void 0) {
      return;
    }
    this._fixedRows = this._parseFixedDimension(rows);
    this._labelComputer?.refreshLabel(this);
    await this._refreshScrollbar();
    this._resize();
    this.focus();
  }
  _parseFixedDimension(value) {
    if (value === "") {
      return void 0;
    }
    const parsed = parseInt(value);
    if (parsed <= 0) {
      throw new Error(`Could not parse dimension "${value}"`);
    }
    return parsed;
  }
  async toggleSizeToContentWidth() {
    if (!this.xterm?.raw.buffer.active) {
      return;
    }
    if (this._hasScrollBar) {
      this._terminalHasFixedWidth.set(false);
      this._fixedCols = void 0;
      this._fixedRows = void 0;
      this._hasScrollBar = false;
      this._initDimensions();
      await this._resize();
    } else {
      const font = this.xterm ? this.xterm.getFont() : this._terminalConfigurationService.getFont(dom.getWindow(this.domElement));
      const maxColsForTexture = Math.floor(4096 /* MaxCanvasWidth */ / (font.charWidth ?? 20));
      const proposedCols = Math.max(this.maxCols, Math.min(this.xterm.getLongestViewportWrappedLineLength(), maxColsForTexture));
      if (proposedCols > this.xterm.raw.cols) {
        this._fixedCols = proposedCols;
      }
    }
    await this._refreshScrollbar();
    this._labelComputer?.refreshLabel(this);
    this.focus();
  }
  _refreshScrollbar() {
    if (this._fixedCols || this._fixedRows) {
      return this._addScrollbar();
    }
    return this._removeScrollbar();
  }
  async _addScrollbar() {
    const charWidth = (this.xterm ? this.xterm.getFont() : this._terminalConfigurationService.getFont(dom.getWindow(this.domElement))).charWidth;
    if (!this.xterm?.raw.element || !this._container || !charWidth || !this._fixedCols) {
      return;
    }
    this._wrapperElement.classList.add("fixed-dims");
    this._hasScrollBar = true;
    this._initDimensions();
    await this._resize();
    this._terminalHasFixedWidth.set(true);
    if (!this._horizontalScrollbar) {
      this._horizontalScrollbar = this._register(new DomScrollableElement(this._wrapperElement, {
        vertical: ScrollbarVisibility.Hidden,
        horizontal: ScrollbarVisibility.Auto,
        useShadows: false,
        scrollYToX: false,
        consumeMouseWheelIfScrollbarIsNeeded: false
      }));
      this._container.appendChild(this._horizontalScrollbar.getDomNode());
    }
    this._horizontalScrollbar.setScrollDimensions({
      width: this.xterm.raw.element.clientWidth,
      scrollWidth: this._fixedCols * charWidth + 40
      // Padding + scroll bar
    });
    this._horizontalScrollbar.getDomNode().style.paddingBottom = "16px";
    if (isWindows) {
      for (let i = this.xterm.raw.buffer.active.viewportY; i < this.xterm.raw.buffer.active.length; i++) {
        const line = this.xterm.raw.buffer.active.getLine(i);
        line._line.isWrapped = false;
      }
    }
  }
  async _removeScrollbar() {
    if (!this._container || !this._horizontalScrollbar) {
      return;
    }
    this._horizontalScrollbar.getDomNode().remove();
    this._horizontalScrollbar.dispose();
    this._horizontalScrollbar = void 0;
    this._wrapperElement.remove();
    this._wrapperElement.classList.remove("fixed-dims");
    this._container.appendChild(this._wrapperElement);
  }
  _setResolvedShellLaunchConfig(shellLaunchConfig) {
    this._shellLaunchConfig.args = shellLaunchConfig.args;
    this._shellLaunchConfig.cwd = shellLaunchConfig.cwd;
    this._shellLaunchConfig.executable = shellLaunchConfig.executable;
    this._shellLaunchConfig.env = shellLaunchConfig.env;
  }
  _onEnvironmentVariableInfoChanged(info) {
    if (info.requiresAction) {
      this.xterm?.raw.textarea?.setAttribute("aria-label", nls.localize("terminalStaleTextBoxAriaLabel", "Terminal {0} environment is stale, run the 'Show Environment Information' command for more information", this._instanceId));
    }
    this._refreshEnvironmentVariableInfoWidgetState(info);
  }
  async _refreshEnvironmentVariableInfoWidgetState(info) {
    if (!info) {
      this.statusList.remove(TerminalStatus.RelaunchNeeded);
      this.statusList.remove(TerminalStatus.EnvironmentVariableInfoChangesActive);
      return;
    }
    if (
      // The change requires a relaunch
      info.requiresAction && // The feature is enabled
      this._terminalConfigurationService.config.environmentChangesRelaunch && // Has not been interacted with
      !this._processManager.hasWrittenData && // Not a feature terminal or is a reconnecting task terminal (TODO: Need to explain the latter case)
      (!this._shellLaunchConfig.isFeatureTerminal || this.reconnectionProperties && this._configurationService.getValue("task.reconnection") === true) && // Not a custom pty
      !this._shellLaunchConfig.customPtyImplementation && // Not an extension owned terminal
      !this._shellLaunchConfig.isExtensionOwnedTerminal && // Not a reconnected or revived terminal
      !this._shellLaunchConfig.attachPersistentProcess && // Not a Windows remote using ConPTY (#187084)
      !(this._processManager.remoteAuthority && this._terminalConfigurationService.config.windowsEnableConpty && await this._processManager.getBackendOS() === OperatingSystem.Windows)
    ) {
      this.relaunch();
      return;
    }
    const workspaceFolder = getWorkspaceForTerminal(this.shellLaunchConfig.cwd, this._workspaceContextService, this._historyService);
    this.statusList.add(info.getStatus({ workspaceFolder }));
  }
  async getInitialCwd() {
    if (!this._initialCwd) {
      this._initialCwd = this._processManager.initialCwd;
    }
    return this._initialCwd;
  }
  async getCwd() {
    if (this.capabilities.has(TerminalCapability.CwdDetection)) {
      return this.capabilities.get(TerminalCapability.CwdDetection).getCwd();
    } else if (this.capabilities.has(TerminalCapability.NaiveCwdDetection)) {
      return this.capabilities.get(TerminalCapability.NaiveCwdDetection).getCwd();
    }
    return this._processManager.initialCwd;
  }
  async _refreshProperty(type) {
    await this.processReady;
    return this._processManager.refreshProperty(type);
  }
  async _updateProperty(type, value) {
    return this._processManager.updateProperty(type, value);
  }
  async rename(title) {
    this._setTitle(title, TitleEventSource.Api);
  }
  _setTitle(title, eventSource) {
    const reset = !title;
    title = this._updateTitleProperties(title, eventSource);
    const titleChanged = title !== this._title;
    this._title = title;
    this._labelComputer?.refreshLabel(this, reset);
    this._setAriaLabel(this.xterm?.raw, this._instanceId, this._title);
    if (titleChanged) {
      this._onTitleChanged.fire(this);
    }
  }
  async changeIcon(icon) {
    if (icon) {
      this._icon = icon;
      this._onIconChanged.fire({ instance: this, userInitiated: true });
      return icon;
    }
    const iconPicker = this._scopedInstantiationService.createInstance(TerminalIconPicker);
    const pickedIcon = await iconPicker.pickIcons();
    iconPicker.dispose();
    if (!pickedIcon) {
      return void 0;
    }
    this._icon = pickedIcon;
    this._onIconChanged.fire({ instance: this, userInitiated: true });
    return pickedIcon;
  }
  async changeColor(color, skipQuickPick) {
    if (color) {
      this.shellLaunchConfig.color = color;
      this._onIconChanged.fire({ instance: this, userInitiated: true });
      return color;
    } else if (skipQuickPick) {
      this.shellLaunchConfig.color = "";
      this._onIconChanged.fire({ instance: this, userInitiated: true });
      return;
    }
    const icon = this._getIcon();
    if (!icon) {
      return;
    }
    const colorTheme = this._themeService.getColorTheme();
    const standardColors = getStandardColors(colorTheme);
    const colorStyleDisposable = createColorStyleElement(colorTheme);
    const items = [];
    for (const colorKey of standardColors) {
      const colorClass = getColorClass(colorKey);
      items.push({
        label: `$(${Codicon.circleFilled.id}) ${colorKey.replace("terminal.ansi", "")}`,
        id: colorKey,
        description: colorKey,
        iconClasses: [colorClass]
      });
    }
    items.push({ type: "separator" });
    const showAllColorsItem = { label: "Reset to default" };
    items.push(showAllColorsItem);
    const disposables = [];
    const quickPick = this._quickInputService.createQuickPick({ useSeparators: true });
    disposables.push(quickPick);
    quickPick.items = items;
    quickPick.matchOnDescription = true;
    quickPick.placeholder = nls.localize("changeColor", "Select a color for the terminal");
    quickPick.show();
    const result = await new Promise((r) => {
      disposables.push(quickPick.onDidHide(() => r(void 0)));
      disposables.push(quickPick.onDidAccept(() => r(quickPick.selectedItems[0])));
    });
    dispose(disposables);
    if (result) {
      this.shellLaunchConfig.color = result.id;
      this._onIconChanged.fire({ instance: this, userInitiated: true });
    }
    quickPick.hide();
    colorStyleDisposable.dispose();
    return result?.id;
  }
  forceScrollbarVisibility() {
    this._wrapperElement.classList.add("force-scrollbar");
  }
  resetScrollbarVisibility() {
    this._wrapperElement.classList.remove("force-scrollbar");
  }
  setParentContextKeyService(parentContextKeyService) {
    this._scopedContextKeyService.updateParent(parentContextKeyService);
  }
  async handleMouseEvent(event, contextMenu) {
    if (dom.isHTMLElement(event.target) && (event.target.classList.contains("scrollbar") || event.target.classList.contains("slider"))) {
      return { cancelContextMenu: true };
    }
    for (const contrib of this._contributions.values()) {
      const result = await contrib.handleMouseEvent?.(event);
      if (result?.handled) {
        return { cancelContextMenu: true };
      }
    }
    if (event.which === 2) {
      switch (this._terminalConfigurationService.config.middleClickBehavior) {
        case "default":
        default:
          this.focus();
          break;
      }
      return;
    }
    if (event.which === 3) {
      if (event.shiftKey) {
        openContextMenu(dom.getActiveWindow(), event, this, contextMenu, this._contextMenuService);
        return;
      }
      const rightClickBehavior = this._terminalConfigurationService.config.rightClickBehavior;
      if (rightClickBehavior === "nothing") {
        if (!event.shiftKey) {
          return { cancelContextMenu: true };
        }
        return;
      }
    }
  }
};
TerminalInstance._instanceIdCounter = 1;
__decorateClass([
  debounce(50)
], TerminalInstance.prototype, "_fireMaximumDimensionsChanged", 1);
__decorateClass([
  debounce(1e3)
], TerminalInstance.prototype, "relaunch", 1);
__decorateClass([
  debounce(2e3)
], TerminalInstance.prototype, "_updateProcessCwd", 1);
TerminalInstance = __decorateClass([
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ITerminalConfigurationService),
  __decorateParam(6, ITerminalProfileResolverService),
  __decorateParam(7, IPathService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IPreferencesService),
  __decorateParam(11, IViewsService),
  __decorateParam(12, IThemeService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, ITerminalLogService),
  __decorateParam(15, IStorageService),
  __decorateParam(16, IAccessibilityService),
  __decorateParam(17, IProductService),
  __decorateParam(18, IQuickInputService),
  __decorateParam(19, IWorkbenchEnvironmentService),
  __decorateParam(20, IWorkspaceContextService),
  __decorateParam(21, IEditorService),
  __decorateParam(22, IWorkspaceTrustRequestService),
  __decorateParam(23, IHistoryService),
  __decorateParam(24, ITelemetryService),
  __decorateParam(25, IOpenerService),
  __decorateParam(26, ICommandService),
  __decorateParam(27, IAccessibilitySignalService),
  __decorateParam(28, IViewDescriptorService)
], TerminalInstance);
let TerminalInstanceDragAndDropController = class extends Disposable {
  constructor(_container, _layoutService, _viewDescriptorService) {
    super();
    this._container = _container;
    this._layoutService = _layoutService;
    this._viewDescriptorService = _viewDescriptorService;
    this._onDropFile = this._register(new Emitter());
    this._onDropTerminal = this._register(new Emitter());
    this._register(toDisposable(() => this._clearDropOverlay()));
  }
  get onDropFile() {
    return this._onDropFile.event;
  }
  get onDropTerminal() {
    return this._onDropTerminal.event;
  }
  _clearDropOverlay() {
    this._dropOverlay?.remove();
    this._dropOverlay = void 0;
  }
  onDragEnter(e) {
    if (!containsDragType(e, DataTransfers.FILES, DataTransfers.RESOURCES, TerminalDataTransfers.Terminals, CodeDataTransfers.FILES)) {
      return;
    }
    if (!this._dropOverlay) {
      this._dropOverlay = document.createElement("div");
      this._dropOverlay.classList.add("terminal-drop-overlay");
    }
    if (containsDragType(e, TerminalDataTransfers.Terminals)) {
      const side = this._getDropSide(e);
      this._dropOverlay.classList.toggle("drop-before", side === "before");
      this._dropOverlay.classList.toggle("drop-after", side === "after");
    }
    if (!this._dropOverlay.parentElement) {
      this._container.appendChild(this._dropOverlay);
    }
  }
  onDragLeave(e) {
    this._clearDropOverlay();
  }
  onDragEnd(e) {
    this._clearDropOverlay();
  }
  onDragOver(e) {
    if (!e.dataTransfer || !this._dropOverlay) {
      return;
    }
    if (containsDragType(e, TerminalDataTransfers.Terminals)) {
      const side = this._getDropSide(e);
      this._dropOverlay.classList.toggle("drop-before", side === "before");
      this._dropOverlay.classList.toggle("drop-after", side === "after");
    }
    this._dropOverlay.style.opacity = "1";
  }
  async onDrop(e) {
    this._clearDropOverlay();
    if (!e.dataTransfer) {
      return;
    }
    const terminalResources = getTerminalResourcesFromDragEvent(e);
    if (terminalResources) {
      for (const uri of terminalResources) {
        const side = this._getDropSide(e);
        this._onDropTerminal.fire({ uri, side });
      }
      return;
    }
    let path2;
    const rawResources = e.dataTransfer.getData(DataTransfers.RESOURCES);
    if (rawResources) {
      path2 = URI.parse(JSON.parse(rawResources)[0]);
    }
    const rawCodeFiles = e.dataTransfer.getData(CodeDataTransfers.FILES);
    if (!path2 && rawCodeFiles) {
      path2 = URI.file(JSON.parse(rawCodeFiles)[0]);
    }
    if (!path2 && e.dataTransfer.files.length > 0 && getPathForFile(e.dataTransfer.files[0])) {
      path2 = URI.file(getPathForFile(e.dataTransfer.files[0]));
    }
    if (!path2) {
      return;
    }
    this._onDropFile.fire(path2);
  }
  _getDropSide(e) {
    const target = this._container;
    if (!target) {
      return "after";
    }
    const rect = target.getBoundingClientRect();
    return this._getViewOrientation() === Orientation.HORIZONTAL ? e.clientX - rect.left < rect.width / 2 ? "before" : "after" : e.clientY - rect.top < rect.height / 2 ? "before" : "after";
  }
  _getViewOrientation() {
    const panelPosition = this._layoutService.getPanelPosition();
    const terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);
    return terminalLocation === ViewContainerLocation.Panel && isHorizontal(panelPosition) ? Orientation.HORIZONTAL : Orientation.VERTICAL;
  }
};
TerminalInstanceDragAndDropController = __decorateClass([
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, IViewDescriptorService)
], TerminalInstanceDragAndDropController);
var TerminalLabelType = /* @__PURE__ */ ((TerminalLabelType2) => {
  TerminalLabelType2["Title"] = "title";
  TerminalLabelType2["Description"] = "description";
  return TerminalLabelType2;
})(TerminalLabelType || {});
let TerminalLabelComputer = class extends Disposable {
  constructor(_fileService, _terminalConfigurationService, _workspaceContextService) {
    super();
    this._fileService = _fileService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._workspaceContextService = _workspaceContextService;
    this._title = "";
    this._description = "";
    this._onDidChangeLabel = this._register(new Emitter());
    this.onDidChangeLabel = this._onDidChangeLabel.event;
  }
  get title() {
    return this._title;
  }
  get description() {
    return this._description;
  }
  refreshLabel(instance, reset) {
    this._title = this.computeLabel(instance, this._terminalConfigurationService.config.tabs.title, "title" /* Title */, reset);
    this._description = this.computeLabel(instance, this._terminalConfigurationService.config.tabs.description, "description" /* Description */);
    if (this._title !== instance.title || this._description !== instance.description || reset) {
      this._onDidChangeLabel.fire({ title: this._title, description: this._description });
    }
  }
  computeLabel(instance, labelTemplate, labelType, reset) {
    const type = instance.shellLaunchConfig.attachPersistentProcess?.type || instance.shellLaunchConfig.type;
    const commandDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
    const promptInputModel = commandDetection?.promptInputModel;
    const nonTaskSpinner = type === "Task" ? "" : " $(loading~spin)";
    const templateProperties = {
      cwd: instance.cwd || instance.initialCwd || "",
      cwdFolder: "",
      workspaceFolderName: instance.workspaceFolder?.name,
      workspaceFolder: instance.workspaceFolder ? path.basename(instance.workspaceFolder.uri.fsPath) : void 0,
      local: type === "Local" ? terminalStrings.typeLocal : void 0,
      process: instance.processName,
      sequence: instance.sequence,
      task: type === "Task" ? terminalStrings.typeTask : void 0,
      fixedDimensions: instance.fixedCols ? instance.fixedRows ? `\u2194${instance.fixedCols} \u2195${instance.fixedRows}` : `\u2194${instance.fixedCols}` : instance.fixedRows ? `\u2195${instance.fixedRows}` : "",
      separator: { label: this._terminalConfigurationService.config.tabs.separator },
      shellType: instance.shellType,
      // Shell command requires high confidence
      shellCommand: commandDetection?.executingCommand && commandDetection.executingCommandConfidence === "high" && promptInputModel ? promptInputModel.value + nonTaskSpinner : void 0,
      // Shell prompt input does not require high confidence as it's largely for VS Code developers
      shellPromptInput: commandDetection?.executingCommand && promptInputModel ? promptInputModel.getCombinedString(true) + nonTaskSpinner : promptInputModel?.getCombinedString(true),
      progress: this._getProgressStateString(instance.progressState)
    };
    templateProperties.workspaceFolderName = instance.workspaceFolder?.name ?? templateProperties.workspaceFolder;
    labelTemplate = labelTemplate.trim();
    if (!labelTemplate) {
      return labelType === "title" /* Title */ ? instance.processName || "" : "";
    }
    if (!reset && instance.staticTitle && labelType === "title" /* Title */) {
      return instance.staticTitle.replace(/[\n\r\t]/g, "") || templateProperties.process?.replace(/[\n\r\t]/g, "") || "";
    }
    const detection = instance.capabilities.has(TerminalCapability.CwdDetection) || instance.capabilities.has(TerminalCapability.NaiveCwdDetection);
    const folders = this._workspaceContextService.getWorkspace().folders;
    const multiRootWorkspace = folders.length > 1;
    if (templateProperties.cwd && detection && (!instance.shellLaunchConfig.isFeatureTerminal || labelType === "title" /* Title */)) {
      const cwdUri = URI.from({
        scheme: instance.workspaceFolder?.uri.scheme || Schemas.file,
        path: instance.cwd ? path.resolve(instance.cwd) : void 0
      });
      let showCwd = false;
      if (multiRootWorkspace) {
        showCwd = true;
      } else if (instance.workspaceFolder?.uri) {
        const caseSensitive = this._fileService.hasCapability(instance.workspaceFolder.uri, FileSystemProviderCapabilities.PathCaseSensitive);
        showCwd = cwdUri.fsPath.localeCompare(instance.workspaceFolder.uri.fsPath, void 0, { sensitivity: caseSensitive ? "case" : "base" }) !== 0;
      }
      if (showCwd) {
        templateProperties.cwdFolder = path.basename(templateProperties.cwd);
      }
    }
    const label = template(labelTemplate, templateProperties).replace(/[\n\r\t]/g, "").trim();
    return label === "" && labelType === "title" /* Title */ ? instance.processName || "" : label;
  }
  _getProgressStateString(progressState) {
    if (!progressState) {
      return "";
    }
    switch (progressState.state) {
      case 0:
        return "";
      case 1:
        return `${Math.round(progressState.value)}%`;
      case 2:
        return "$(error)";
      case 3:
        return "$(loading~spin)";
      case 4:
        return "$(alert)";
    }
  }
};
TerminalLabelComputer = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ITerminalConfigurationService),
  __decorateParam(2, IWorkspaceContextService)
], TerminalLabelComputer);
function parseExitResult(exitCodeOrError, shellLaunchConfig, processState, initialCwd) {
  if (exitCodeOrError === void 0 || exitCodeOrError === 0) {
    return { code: exitCodeOrError, message: void 0 };
  }
  const code = typeof exitCodeOrError === "number" ? exitCodeOrError : exitCodeOrError.code;
  let message = void 0;
  switch (typeof exitCodeOrError) {
    case "number": {
      let commandLine = void 0;
      if (shellLaunchConfig.executable) {
        commandLine = shellLaunchConfig.executable;
        if (typeof shellLaunchConfig.args === "string") {
          commandLine += ` ${shellLaunchConfig.args}`;
        } else if (shellLaunchConfig.args && shellLaunchConfig.args.length) {
          commandLine += shellLaunchConfig.args.map((a) => ` '${a}'`).join();
        }
      }
      if (processState === ProcessState.KilledDuringLaunch) {
        if (commandLine) {
          message = nls.localize("launchFailed.exitCodeAndCommandLine", 'The terminal process "{0}" failed to launch (exit code: {1}).', commandLine, code);
        } else {
          message = nls.localize("launchFailed.exitCodeOnly", "The terminal process failed to launch (exit code: {0}).", code);
        }
      } else {
        if (commandLine) {
          message = nls.localize("terminated.exitCodeAndCommandLine", 'The terminal process "{0}" terminated with exit code: {1}.', commandLine, code);
        } else {
          message = nls.localize("terminated.exitCodeOnly", "The terminal process terminated with exit code: {0}.", code);
        }
      }
      break;
    }
    case "object": {
      if (exitCodeOrError.message.toString().includes("Could not find pty with id")) {
        break;
      }
      let innerMessage = exitCodeOrError.message;
      const conptyError = exitCodeOrError.message.match(/.*error code:\s*(\d+).*$/);
      if (conptyError) {
        const errorCode = conptyError.length > 1 ? parseInt(conptyError[1]) : void 0;
        switch (errorCode) {
          case 5:
            innerMessage = `Access was denied to the path containing your executable "${shellLaunchConfig.executable}". Manage and change your permissions to get this to work`;
            break;
          case 267:
            innerMessage = `Invalid starting directory "${initialCwd}", review your terminal.integrated.cwd setting`;
            break;
          case 1260:
            innerMessage = `Windows cannot open this program because it has been prevented by a software restriction policy. For more information, open Event Viewer or contact your system Administrator`;
            break;
        }
      }
      message = nls.localize("launchFailed.errorMessage", "The terminal process failed to launch: {0}.", innerMessage);
      break;
    }
  }
  return { code, message };
}
let TerminalInstanceColorProvider = class {
  constructor(_target, _viewDescriptorService) {
    this._target = _target;
    this._viewDescriptorService = _viewDescriptorService;
  }
  getBackgroundColor(theme) {
    const terminalBackground = theme.getColor(TERMINAL_BACKGROUND_COLOR);
    if (terminalBackground) {
      return terminalBackground;
    }
    if (this._target.object === TerminalLocation.Editor) {
      return theme.getColor(editorBackground);
    }
    const location = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);
    if (location === ViewContainerLocation.Panel) {
      return theme.getColor(PANEL_BACKGROUND);
    }
    return theme.getColor(SIDE_BAR_BACKGROUND);
  }
};
TerminalInstanceColorProvider = __decorateClass([
  __decorateParam(1, IViewDescriptorService)
], TerminalInstanceColorProvider);
function guessShellTypeFromExecutable(os, executable) {
  const exeBasename = path.basename(executable);
  const generalShellTypeMap = /* @__PURE__ */ new Map([
    [GeneralShellType.Julia, /^julia$/],
    [GeneralShellType.Node, /^node$/],
    [GeneralShellType.NuShell, /^nu$/],
    [GeneralShellType.PowerShell, /^pwsh(-preview)?|powershell$/],
    [GeneralShellType.Python, /^py(?:thon)?$/]
  ]);
  for (const [shellType, pattern] of generalShellTypeMap) {
    if (exeBasename.match(pattern)) {
      return shellType;
    }
  }
  if (os === OperatingSystem.Windows) {
    const windowsShellTypeMap = /* @__PURE__ */ new Map([
      [WindowsShellType.CommandPrompt, /^cmd$/],
      [WindowsShellType.GitBash, /^bash$/],
      [WindowsShellType.Wsl, /^wsl$/]
    ]);
    for (const [shellType, pattern] of windowsShellTypeMap) {
      if (exeBasename.match(pattern)) {
        return shellType;
      }
    }
  } else {
    const posixShellTypes = [
      PosixShellType.Bash,
      PosixShellType.Csh,
      PosixShellType.Fish,
      PosixShellType.Ksh,
      PosixShellType.Sh,
      PosixShellType.Zsh
    ];
    for (const type of posixShellTypes) {
      if (exeBasename === type) {
        return type;
      }
    }
  }
  return void 0;
}
export {
  TerminalInstance,
  TerminalInstanceColorProvider,
  TerminalLabelComputer,
  parseExitResult
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsSW5zdGFuY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc0ZpcmVmb3ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvYnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBCcm93c2VyRmVhdHVyZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY2FuSVVzZS5qcyc7XG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBPcmllbnRhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zYXNoL3Nhc2guanMnO1xuaW1wb3J0IHsgRG9tU2Nyb2xsYWJsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50LmpzJztcbmltcG9ydCB7IEF1dG9PcGVuQmFycmllciwgQmFycmllciwgUHJvbWlzZXMsIGRpc3Bvc2FibGVUaW1lb3V0LCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IGRlYm91bmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBCdWdJbmRpY2F0aW5nRXJyb3IsIG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IElTZXBhcmF0b3IsIHRlbXBsYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGFiZWxzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIEltbW9ydGFsUmVmZXJlbmNlLCBNdXRhYmxlRGlzcG9zYWJsZSwgZGlzcG9zZSwgdG9EaXNwb3NhYmxlLCB0eXBlIElSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IE9TLCBPcGVyYXRpbmdTeXN0ZW0sIGlzTWFjaW50b3NoLCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTY3JvbGxiYXJWaXNpYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgVGFiRm9jdXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9jb25maWcvdGFiRm9jdXMuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlTaWduYWwsIElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHlTaWduYWwvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBDb2RlRGF0YVRyYW5zZmVycywgY29udGFpbnNEcmFnVHlwZSwgZ2V0UGF0aEZvckZpbGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kbmQvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLCBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgUmVzdWx0S2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgSVByb21wdENob2ljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0sIFF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElNYXJrUHJvcGVydGllcywgVGVybWluYWxDYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDYXBhYmlsaXR5U3RvcmVNdWx0aXBsZXhlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvdGVybWluYWxDYXBhYmlsaXR5U3RvcmUuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uLCBJTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZS5qcyc7XG5pbXBvcnQgeyBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlU2hhcmVkLmpzJztcbmltcG9ydCB7IEdlbmVyYWxTaGVsbFR5cGUsIElQcm9jZXNzRGF0YUV2ZW50LCBJUHJvY2Vzc1Byb3BlcnR5TWFwLCBJUmVjb25uZWN0aW9uUHJvcGVydGllcywgSVNoZWxsTGF1bmNoQ29uZmlnLCBJVGVybWluYWxEaW1lbnNpb25zT3ZlcnJpZGUsIElUZXJtaW5hbExhdW5jaEVycm9yLCBJVGVybWluYWxMb2dTZXJ2aWNlLCBQb3NpeFNoZWxsVHlwZSwgUHJvY2Vzc1Byb3BlcnR5VHlwZSwgU2hlbGxJbnRlZ3JhdGlvblN0YXR1cywgVGVybWluYWxFeGl0UmVhc29uLCBUZXJtaW5hbEljb24sIFRlcm1pbmFsTG9jYXRpb24sIFRlcm1pbmFsU2V0dGluZ0lkLCBUZXJtaW5hbFNoZWxsVHlwZSwgVGl0bGVFdmVudFNvdXJjZSwgV2luZG93c1NoZWxsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBmb3JtYXRNZXNzYWdlRm9yVGVybWluYWwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxTdHJpbmdzLmpzJztcbmltcG9ydCB7IGVkaXRvckJhY2tncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBnZXRJY29uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElDb2xvclRoZW1lLCBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgUEFORUxfQkFDS0dST1VORCwgU0lERV9CQVJfQkFDS0dST1VORCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmVxdWVzdEFkZEluc3RhbmNlVG9Hcm91cEV2ZW50LCBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSwgSVRlcm1pbmFsQ29udHJpYnV0aW9uLCBJVGVybWluYWxJbnN0YW5jZSwgSVh0ZXJtQ29sb3JQcm92aWRlciwgVGVybWluYWxEYXRhVHJhbnNmZXJzIH0gZnJvbSAnLi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbExhdW5jaEhlbHBBY3Rpb24gfSBmcm9tICcuL3Rlcm1pbmFsQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbEVkaXRvcklucHV0IH0gZnJvbSAnLi90ZXJtaW5hbEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IFRlcm1pbmFsRXh0ZW5zaW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi90ZXJtaW5hbEV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZ2V0Q29sb3JDbGFzcywgY3JlYXRlQ29sb3JTdHlsZUVsZW1lbnQsIGdldFN0YW5kYXJkQ29sb3JzIH0gZnJvbSAnLi90ZXJtaW5hbEljb24uanMnO1xuaW1wb3J0IHsgVGVybWluYWxQcm9jZXNzTWFuYWdlciB9IGZyb20gJy4vdGVybWluYWxQcm9jZXNzTWFuYWdlci5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxTdGF0dXNMaXN0LCBUZXJtaW5hbFN0YXR1cywgVGVybWluYWxTdGF0dXNMaXN0IH0gZnJvbSAnLi90ZXJtaW5hbFN0YXR1c0xpc3QuanMnO1xuaW1wb3J0IHsgZ2V0VGVybWluYWxSZXNvdXJjZXNGcm9tRHJhZ0V2ZW50LCBnZXRUZXJtaW5hbFVyaSB9IGZyb20gJy4vdGVybWluYWxVcmkuanMnO1xuaW1wb3J0IHsgVGVybWluYWxXaWRnZXRNYW5hZ2VyIH0gZnJvbSAnLi93aWRnZXRzL3dpZGdldE1hbmFnZXIuanMnO1xuaW1wb3J0IHsgTGluZURhdGFFdmVudEFkZG9uIH0gZnJvbSAnLi94dGVybS9saW5lRGF0YUV2ZW50QWRkb24uanMnO1xuaW1wb3J0IHsgWHRlcm1UZXJtaW5hbCwgZ2V0WHRlcm1TY2FsZWREaW1lbnNpb25zIH0gZnJvbSAnLi94dGVybS94dGVybVRlcm1pbmFsLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFZhcmlhYmxlSW5mbyB9IGZyb20gJy4uL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlLmpzJztcbmltcG9ydCB7IERFRkFVTFRfQ09NTUFORFNfVE9fU0tJUF9TSEVMTCwgSVRlcm1pbmFsUHJvY2Vzc01hbmFnZXIsIElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UsIFByb2Nlc3NTdGF0ZSwgVEVSTUlOQUxfQ1JFQVRJT05fQ09NTUFORFMsIFRFUk1JTkFMX1ZJRVdfSUQsIFRlcm1pbmFsQ29tbWFuZElkIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IFRFUk1JTkFMX0JBQ0tHUk9VTkRfQ09MT1IgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxDb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxDb250ZXh0S2V5LmpzJztcbmltcG9ydCB7IGdldFdvcmtzcGFjZUZvclRlcm1pbmFsLCBwcmVwYXJlUGF0aEZvclNoZWxsIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsRW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaGlzdG9yeS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBpc0hvcml6b250YWwsIElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJlZmVyZW5jZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IGltcG9ydEFNRE5vZGVNb2R1bGUgfSBmcm9tICcuLi8uLi8uLi8uLi9hbWRYLmpzJztcbmltcG9ydCB0eXBlIHsgSU1hcmtlciwgVGVybWluYWwgYXMgWFRlcm1UZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5Q29tbWFuZElkIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eUNvbW1hbmRzLmpzJztcbmltcG9ydCB7IHRlcm1pbmFsU3RyaW5ncyB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbFN0cmluZ3MuanMnO1xuaW1wb3J0IHsgVGVybWluYWxJY29uUGlja2VyIH0gZnJvbSAnLi90ZXJtaW5hbEljb25QaWNrZXIuanMnO1xuaW1wb3J0IHsgVGVybWluYWxSZXNpemVEZWJvdW5jZXIgfSBmcm9tICcuL3Rlcm1pbmFsUmVzaXplRGVib3VuY2VyLmpzJztcbmltcG9ydCB7IG9wZW5Db250ZXh0TWVudSB9IGZyb20gJy4vdGVybWluYWxDb250ZXh0TWVudS5qcyc7XG5pbXBvcnQgdHlwZSB7IElNZW51IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENvbnRyaWJDb21tYW5kSWQgfSBmcm9tICcuLi90ZXJtaW5hbENvbnRyaWJFeHBvcnRzLmpzJztcbmltcG9ydCB0eXBlIHsgSVByb2dyZXNzU3RhdGUgfSBmcm9tICdAeHRlcm0vYWRkb24tcHJvZ3Jlc3MnO1xuaW1wb3J0IHsgcmVmcmVzaFNoZWxsSW50ZWdyYXRpb25JbmZvU3RhdHVzIH0gZnJvbSAnLi90ZXJtaW5hbFRvb2x0aXAuanMnO1xuXG5jb25zdCBlbnVtIENvbnN0YW50cyB7XG5cdC8qKlxuXHQgKiBUaGUgbWF4aW11bSBhbW91bnQgb2YgbWlsbGlzZWNvbmRzIHRvIHdhaXQgZm9yIGEgY29udGFpbmVyIGJlZm9yZSBzdGFydGluZyB0byBjcmVhdGUgdGhlXG5cdCAqIHRlcm1pbmFsIHByb2Nlc3MuIFRoaXMgcGVyaW9kIGhlbHBzIGVuc3VyZSB0aGUgdGVybWluYWwgaGFzIGdvb2QgaW5pdGlhbCBkaW1lbnNpb25zIHRvIHdvcmtcblx0ICogd2l0aCBpZiBpdCdzIGdvaW5nIHRvIGJlIGEgZm9yZWdyb3VuZCB0ZXJtaW5hbC5cblx0ICovXG5cdFdhaXRGb3JDb250YWluZXJUaHJlc2hvbGQgPSAxMDAsXG5cblx0RGVmYXVsdENvbHMgPSA4MCxcblx0RGVmYXVsdFJvd3MgPSAzMCxcblx0TWF4Q2FudmFzV2lkdGggPSA0MDk2XG59XG5cbmxldCB4dGVybUNvbnN0cnVjdG9yOiBQcm9taXNlPHR5cGVvZiBYVGVybVRlcm1pbmFsPiB8IHVuZGVmaW5lZDtcblxuaW50ZXJmYWNlIElDYW52YXNEaW1lbnNpb25zIHtcblx0d2lkdGg6IG51bWJlcjtcblx0aGVpZ2h0OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBJR3JpZERpbWVuc2lvbnMge1xuXHRjb2xzOiBudW1iZXI7XG5cdHJvd3M6IG51bWJlcjtcbn1cblxuY29uc3Qgc2hlbGxJbnRlZ3JhdGlvblN1cHBvcnRlZFNoZWxsVHlwZXM6IChQb3NpeFNoZWxsVHlwZSB8IEdlbmVyYWxTaGVsbFR5cGUgfCBXaW5kb3dzU2hlbGxUeXBlKVtdID0gW1xuXHRQb3NpeFNoZWxsVHlwZS5CYXNoLFxuXHRQb3NpeFNoZWxsVHlwZS5ac2gsXG5cdEdlbmVyYWxTaGVsbFR5cGUuUG93ZXJTaGVsbCxcblx0R2VuZXJhbFNoZWxsVHlwZS5QeXRob24sXG5dO1xuXG5leHBvcnQgY2xhc3MgVGVybWluYWxJbnN0YW5jZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGVybWluYWxJbnN0YW5jZSB7XG5cdHByaXZhdGUgc3RhdGljIF9sYXN0S25vd25DYW52YXNEaW1lbnNpb25zOiBJQ2FudmFzRGltZW5zaW9ucyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzdGF0aWMgX2xhc3RLbm93bkdyaWREaW1lbnNpb25zOiBJR3JpZERpbWVuc2lvbnMgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgc3RhdGljIF9pbnN0YW5jZUlkQ291bnRlciA9IDE7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm9jZXNzTWFuYWdlcjogSVRlcm1pbmFsUHJvY2Vzc01hbmFnZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRyaWJ1dGlvbnM6IE1hcDxzdHJpbmcsIElUZXJtaW5hbENvbnRyaWJ1dGlvbj4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Jlc291cmNlOiBVUkk7XG5cblx0LyoqXG5cdCAqIFJlc29sdmVzIHdoZW4geHRlcm0uanMgaXMgcmVhZHksIHRoaXMgd2lsbCBiZSB1bmRlZmluZWQgaWYgdGhlIHRlcm1pbmFsIGluc3RhbmNlIGlzIGRpc3Bvc2VkXG5cdCAqIGJlZm9yZSB4dGVybS5qcyBjb3VsZCBiZSBjcmVhdGVkLlxuXHQgKi9cblx0cHJpdmF0ZSBfeHRlcm1SZWFkeVByb21pc2U6IFByb21pc2U8WHRlcm1UZXJtaW5hbCB8IHVuZGVmaW5lZD47XG5cblx0cHJpdmF0ZSBfcHJlc3NBbnlLZXlUb0Nsb3NlTGlzdGVuZXI6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9pbnN0YW5jZUlkOiBudW1iZXI7XG5cdHByaXZhdGUgX2xhdGVzdFh0ZXJtV3JpdGVEYXRhOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF9sYXRlc3RYdGVybVBhcnNlRGF0YTogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfaXNFeGl0aW5nOiBib29sZWFuO1xuXHRwcml2YXRlIF9oYWRGb2N1c09uRXhpdDogYm9vbGVhbjtcblx0cHJpdmF0ZSBfaXNWaXNpYmxlOiBib29sZWFuO1xuXHRwcml2YXRlIF9leGl0Q29kZTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9leGl0UmVhc29uOiBUZXJtaW5hbEV4aXRSZWFzb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3NraXBUZXJtaW5hbENvbW1hbmRzOiBzdHJpbmdbXTtcblx0cHJpdmF0ZSBfc2hlbGxUeXBlOiBUZXJtaW5hbFNoZWxsVHlwZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfdGl0bGU6IHN0cmluZyA9ICcnO1xuXHRwcml2YXRlIF90aXRsZVNvdXJjZTogVGl0bGVFdmVudFNvdXJjZSA9IFRpdGxlRXZlbnRTb3VyY2UuUHJvY2Vzcztcblx0cHJpdmF0ZSBfY29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfd3JhcHBlckVsZW1lbnQ6IChIVE1MRWxlbWVudCAmIHsgeHRlcm0/OiBYVGVybVRlcm1pbmFsIH0pO1xuXHRnZXQgZG9tRWxlbWVudCgpOiBIVE1MRWxlbWVudCB7IHJldHVybiB0aGlzLl93cmFwcGVyRWxlbWVudDsgfVxuXHRwcml2YXRlIF9ob3Jpem9udGFsU2Nyb2xsYmFyOiBEb21TY3JvbGxhYmxlRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfdGVybWluYWxGb2N1c0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF90ZXJtaW5hbEhhc0ZpeGVkV2lkdGg6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF90ZXJtaW5hbEhhc1RleHRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfdGVybWluYWxBbHRCdWZmZXJBY3RpdmVDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfdGVybWluYWxTaGVsbEludGVncmF0aW9uRW5hYmxlZENvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF9jb2xzOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF9yb3dzOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF9maXhlZENvbHM6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZml4ZWRSb3dzOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2N3ZDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9pbml0aWFsQ3dkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2luamVjdGVkQXJnczogc3RyaW5nW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2xheW91dFNldHRpbmdzQ2hhbmdlZDogYm9vbGVhbiA9IHRydWU7XG5cdHByaXZhdGUgX2RpbWVuc2lvbnNPdmVycmlkZTogSVRlcm1pbmFsRGltZW5zaW9uc092ZXJyaWRlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9hcmVMaW5rc1JlYWR5OiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2luaXRpYWxEYXRhRXZlbnRzTGlzdGVuZXI6IE11dGFibGVEaXNwb3NhYmxlPElEaXNwb3NhYmxlPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSBfaW5pdGlhbERhdGFFdmVudHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkID0gW107XG5cdHByaXZhdGUgX2NvbnRhaW5lclJlYWR5QmFycmllcjogQXV0b09wZW5CYXJyaWVyO1xuXHRwcml2YXRlIF9hdHRhY2hCYXJyaWVyOiBBdXRvT3BlbkJhcnJpZXI7XG5cdHByaXZhdGUgX2ljb246IFRlcm1pbmFsSWNvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfbWVzc2FnZVRpdGxlRGlzcG9zYWJsZTogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIF93aWRnZXRNYW5hZ2VyOiBUZXJtaW5hbFdpZGdldE1hbmFnZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RuZE9ic2VydmVyOiBNdXRhYmxlRGlzcG9zYWJsZTxJRGlzcG9zYWJsZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgX2xhc3RMYXlvdXREaW1lbnNpb25zOiBkb20uRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9oYXNIYWRJbnB1dDogYm9vbGVhbjtcblx0cHJpdmF0ZSBfZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdHByaXZhdGUgX3Byb2Nlc3NOYW1lOiBzdHJpbmcgPSAnJztcblx0cHJpdmF0ZSBfc2VxdWVuY2U/OiBzdHJpbmc7XG5cdHByaXZhdGUgX3N0YXRpY1RpdGxlPzogc3RyaW5nO1xuXHRwcml2YXRlIF93b3Jrc3BhY2VGb2xkZXI/OiBJV29ya3NwYWNlRm9sZGVyO1xuXHRwcml2YXRlIF9sYWJlbENvbXB1dGVyPzogVGVybWluYWxMYWJlbENvbXB1dGVyO1xuXHRwcml2YXRlIF91c2VySG9tZT86IHN0cmluZztcblx0cHJpdmF0ZSBfaGFzU2Nyb2xsQmFyPzogYm9vbGVhbjtcblx0cHJpdmF0ZSBfdXNlZFNoZWxsSW50ZWdyYXRpb25JbmplY3Rpb246IGJvb2xlYW4gPSBmYWxzZTtcblx0Z2V0IHVzZWRTaGVsbEludGVncmF0aW9uSW5qZWN0aW9uKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fdXNlZFNoZWxsSW50ZWdyYXRpb25JbmplY3Rpb247IH1cblx0cHJpdmF0ZSBfbGluZURhdGFFdmVudEFkZG9uOiBMaW5lRGF0YUV2ZW50QWRkb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cdHByaXZhdGUgX3Jlc2l6ZURlYm91bmNlcj86IFRlcm1pbmFsUmVzaXplRGVib3VuY2VyO1xuXHRwcml2YXRlIF9wYXVzZUlucHV0RXZlbnRCYXJyaWVyOiBCYXJyaWVyIHwgdW5kZWZpbmVkO1xuXHRwYXVzZUlucHV0RXZlbnRzKGJhcnJpZXI6IEJhcnJpZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9wYXVzZUlucHV0RXZlbnRCYXJyaWVyID0gYmFycmllcjtcblx0fVxuXG5cdHJlYWRvbmx5IGNhcGFiaWxpdGllcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUZXJtaW5hbENhcGFiaWxpdHlTdG9yZU11bHRpcGxleGVyKCkpO1xuXHRyZWFkb25seSBzdGF0dXNMaXN0OiBJVGVybWluYWxTdGF0dXNMaXN0O1xuXG5cdGdldCBzdG9yZSgpOiBEaXNwb3NhYmxlU3RvcmUge1xuXHRcdHJldHVybiB0aGlzLl9zdG9yZTtcblx0fVxuXG5cdGdldCBleHRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbigpOiBJTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fcHJvY2Vzc01hbmFnZXIuZXh0RW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb247IH1cblxuXHR4dGVybT86IFh0ZXJtVGVybWluYWw7XG5cdGRpc2FibGVMYXlvdXQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRnZXQgd2FpdE9uRXhpdCgpOiBJVGVybWluYWxJbnN0YW5jZVsnd2FpdE9uRXhpdCddIHsgcmV0dXJuIHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzPy53YWl0T25FeGl0IHx8IHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLndhaXRPbkV4aXQ7IH1cblx0c2V0IHdhaXRPbkV4aXQodmFsdWU6IElUZXJtaW5hbEluc3RhbmNlWyd3YWl0T25FeGl0J10pIHtcblx0XHR0aGlzLl9zaGVsbExhdW5jaENvbmZpZy53YWl0T25FeGl0ID0gdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIF90YXJnZXRSZWY6IEltbW9ydGFsUmVmZXJlbmNlPFRlcm1pbmFsTG9jYXRpb24gfCB1bmRlZmluZWQ+ID0gbmV3IEltbW9ydGFsUmVmZXJlbmNlKHVuZGVmaW5lZCk7XG5cdGdldCB0YXJnZXRSZWYoKTogSVJlZmVyZW5jZTxUZXJtaW5hbExvY2F0aW9uIHwgdW5kZWZpbmVkPiB7IHJldHVybiB0aGlzLl90YXJnZXRSZWY7IH1cblxuXHRnZXQgdGFyZ2V0KCk6IFRlcm1pbmFsTG9jYXRpb24gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fdGFyZ2V0UmVmLm9iamVjdDsgfVxuXHRzZXQgdGFyZ2V0KHZhbHVlOiBUZXJtaW5hbExvY2F0aW9uIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fdGFyZ2V0UmVmLm9iamVjdCA9IHZhbHVlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVGFyZ2V0LmZpcmUodmFsdWUpO1xuXHR9XG5cblx0Z2V0IGluc3RhbmNlSWQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX2luc3RhbmNlSWQ7IH1cblx0Z2V0IHJlc291cmNlKCk6IFVSSSB7IHJldHVybiB0aGlzLl9yZXNvdXJjZTsgfVxuXHRnZXQgY29scygpOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLl9maXhlZENvbHMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2ZpeGVkQ29scztcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2RpbWVuc2lvbnNPdmVycmlkZSAmJiB0aGlzLl9kaW1lbnNpb25zT3ZlcnJpZGUuY29scykge1xuXHRcdFx0aWYgKHRoaXMuX2RpbWVuc2lvbnNPdmVycmlkZS5mb3JjZUV4YWN0U2l6ZSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fZGltZW5zaW9uc092ZXJyaWRlLmNvbHM7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgodGhpcy5fZGltZW5zaW9uc092ZXJyaWRlLmNvbHMsIDIpLCB0aGlzLl9jb2xzKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NvbHM7XG5cdH1cblx0Z2V0IHJvd3MoKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5fZml4ZWRSb3dzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9maXhlZFJvd3M7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9kaW1lbnNpb25zT3ZlcnJpZGUgJiYgdGhpcy5fZGltZW5zaW9uc092ZXJyaWRlLnJvd3MpIHtcblx0XHRcdGlmICh0aGlzLl9kaW1lbnNpb25zT3ZlcnJpZGUuZm9yY2VFeGFjdFNpemUpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2RpbWVuc2lvbnNPdmVycmlkZS5yb3dzO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIE1hdGgubWluKE1hdGgubWF4KHRoaXMuX2RpbWVuc2lvbnNPdmVycmlkZS5yb3dzLCAyKSwgdGhpcy5fcm93cyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9yb3dzO1xuXHR9XG5cdGdldCBpc0Rpc3Bvc2VkKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fc3RvcmUuaXNEaXNwb3NlZDsgfVxuXHRnZXQgZml4ZWRDb2xzKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9maXhlZENvbHM7IH1cblx0Z2V0IGZpeGVkUm93cygpOiBudW1iZXIgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fZml4ZWRSb3dzOyB9XG5cdGdldCBtYXhDb2xzKCk6IG51bWJlciB7IHJldHVybiB0aGlzLl9jb2xzOyB9XG5cdGdldCBtYXhSb3dzKCk6IG51bWJlciB7IHJldHVybiB0aGlzLl9yb3dzOyB9XG5cdC8vIFRPRE86IElkZWFsbHkgcHJvY2Vzc0lkIHdvdWxkIGJlIG1lcmdlZCBpbnRvIHByb2Nlc3NSZWFkeVxuXHRnZXQgcHJvY2Vzc0lkKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9wcm9jZXNzTWFuYWdlci5zaGVsbFByb2Nlc3NJZDsgfVxuXHQvLyBUT0RPOiBIb3cgZG9lcyB0aGlzIHdvcmsgd2l0aCBkZXRhY2hlZCBwcm9jZXNzZXM/XG5cdC8vIFRPRE86IFNob3VsZCB0aGlzIGJlIGFuIGV2ZW50IGFzIGl0IGNhbiBmaXJlIHR3aWNlP1xuXHRnZXQgcHJvY2Vzc1JlYWR5KCk6IFByb21pc2U8dm9pZD4geyByZXR1cm4gdGhpcy5fcHJvY2Vzc01hbmFnZXIucHR5UHJvY2Vzc1JlYWR5OyB9XG5cdGdldCBoYXNDaGlsZFByb2Nlc3NlcygpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3M/Lmhhc0NoaWxkUHJvY2Vzc2VzIHx8IHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLmhhc0NoaWxkUHJvY2Vzc2VzOyB9XG5cdGdldCByZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzKCk6IElSZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3M/LnJlY29ubmVjdGlvblByb3BlcnRpZXMgfHwgdGhpcy5zaGVsbExhdW5jaENvbmZpZy5yZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzOyB9XG5cdGdldCBhcmVMaW5rc1JlYWR5KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fYXJlTGlua3NSZWFkeTsgfVxuXHRnZXQgaW5pdGlhbERhdGFFdmVudHMoKTogc3RyaW5nW10gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5faW5pdGlhbERhdGFFdmVudHM7IH1cblx0Z2V0IGV4aXRDb2RlKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9leGl0Q29kZTsgfVxuXHRnZXQgZXhpdFJlYXNvbigpOiBUZXJtaW5hbEV4aXRSZWFzb24gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fZXhpdFJlYXNvbjsgfVxuXHRnZXQgaGFkRm9jdXNPbkV4aXQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9oYWRGb2N1c09uRXhpdDsgfVxuXHRnZXQgaXNUaXRsZVNldEJ5UHJvY2VzcygpOiBib29sZWFuIHsgcmV0dXJuICEhdGhpcy5fbWVzc2FnZVRpdGxlRGlzcG9zYWJsZS52YWx1ZTsgfVxuXHRnZXQgc2hlbGxMYXVuY2hDb25maWcoKTogSVNoZWxsTGF1bmNoQ29uZmlnIHsgcmV0dXJuIHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnOyB9XG5cdGdldCBzaGVsbFR5cGUoKTogVGVybWluYWxTaGVsbFR5cGUgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fc2hlbGxUeXBlOyB9XG5cdGdldCBvcygpOiBPcGVyYXRpbmdTeXN0ZW0gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fcHJvY2Vzc01hbmFnZXIub3M7IH1cblx0Z2V0IGlzUmVtb3RlKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fcHJvY2Vzc01hbmFnZXIucmVtb3RlQXV0aG9yaXR5ICE9PSB1bmRlZmluZWQ7IH1cblx0Z2V0IHJlbW90ZUF1dGhvcml0eSgpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fcHJvY2Vzc01hbmFnZXIucmVtb3RlQXV0aG9yaXR5OyB9XG5cdGdldCBoYXNGb2N1cygpOiBib29sZWFuIHsgcmV0dXJuIGRvbS5pc0FuY2VzdG9yT2ZBY3RpdmVFbGVtZW50KHRoaXMuX3dyYXBwZXJFbGVtZW50KTsgfVxuXHRnZXQgdGl0bGUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuX3RpdGxlOyB9XG5cdGdldCB0aXRsZVNvdXJjZSgpOiBUaXRsZUV2ZW50U291cmNlIHsgcmV0dXJuIHRoaXMuX3RpdGxlU291cmNlOyB9XG5cdGdldCBpY29uKCk6IFRlcm1pbmFsSWNvbiB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9nZXRJY29uKCk7IH1cblx0Z2V0IGNvbG9yKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9nZXRDb2xvcigpOyB9XG5cdGdldCBwcm9jZXNzTmFtZSgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5fcHJvY2Vzc05hbWU7IH1cblx0Z2V0IHNlcXVlbmNlKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9zZXF1ZW5jZTsgfVxuXHRnZXQgc3RhdGljVGl0bGUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3N0YXRpY1RpdGxlOyB9XG5cdGdldCBwcm9ncmVzc1N0YXRlKCk6IElQcm9ncmVzc1N0YXRlIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMueHRlcm0/LnByb2dyZXNzU3RhdGU7IH1cblx0Z2V0IHdvcmtzcGFjZUZvbGRlcigpOiBJV29ya3NwYWNlRm9sZGVyIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3dvcmtzcGFjZUZvbGRlcjsgfVxuXHRnZXQgY3dkKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9jd2Q7IH1cblx0Z2V0IGluaXRpYWxDd2QoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2luaXRpYWxDd2Q7IH1cblx0Z2V0IGRlc2NyaXB0aW9uKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX2Rlc2NyaXB0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZGVzY3JpcHRpb247XG5cdFx0fVxuXHRcdGNvbnN0IHR5cGUgPSB0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzPy50eXBlIHx8IHRoaXMuc2hlbGxMYXVuY2hDb25maWcudHlwZTtcblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdGNhc2UgJ1Rhc2snOiByZXR1cm4gdGVybWluYWxTdHJpbmdzLnR5cGVUYXNrO1xuXHRcdFx0Y2FzZSAnTG9jYWwnOiByZXR1cm4gdGVybWluYWxTdHJpbmdzLnR5cGVMb2NhbDtcblx0XHRcdGRlZmF1bHQ6IHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cdGdldCB1c2VySG9tZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fdXNlckhvbWU7IH1cblx0Z2V0IHNoZWxsSW50ZWdyYXRpb25Ob25jZSgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5fcHJvY2Vzc01hbmFnZXIuc2hlbGxJbnRlZ3JhdGlvbk5vbmNlOyB9XG5cdGdldCBpbmplY3RlZEFyZ3MoKTogc3RyaW5nW10gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5faW5qZWN0ZWRBcmdzOyB9XG5cblx0Ly8gVGhlIG9uRXhpdCBldmVudCBpcyBzcGVjaWFsIGluIHRoYXQgaXQgZmlyZXMgYW5kIGlzIGRpc3Bvc2VkIGFmdGVyIHRoZSB0ZXJtaW5hbCBpbnN0YW5jZVxuXHQvLyBpdHNlbGYgaXMgZGlzcG9zZWRcblx0cHJpdmF0ZSByZWFkb25seSBfb25FeGl0ID0gbmV3IEVtaXR0ZXI8bnVtYmVyIHwgSVRlcm1pbmFsTGF1bmNoRXJyb3IgfCB1bmRlZmluZWQ+KCk7XG5cdHJlYWRvbmx5IG9uRXhpdCA9IHRoaXMuX29uRXhpdC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaXNwb3NlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXJtaW5hbEluc3RhbmNlPigpKTtcblx0cmVhZG9ubHkgb25EaXNwb3NlZCA9IHRoaXMuX29uRGlzcG9zZWQuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUHJvY2Vzc0lkUmVhZHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdHJlYWRvbmx5IG9uUHJvY2Vzc0lkUmVhZHkgPSB0aGlzLl9vblByb2Nlc3NJZFJlYWR5LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblByb2Nlc3NSZXBsYXlDb21wbGV0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvblByb2Nlc3NSZXBsYXlDb21wbGV0ZSA9IHRoaXMuX29uUHJvY2Vzc1JlcGxheUNvbXBsZXRlLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vblRpdGxlQ2hhbmdlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXJtaW5hbEluc3RhbmNlPigpKTtcblx0cmVhZG9ubHkgb25UaXRsZUNoYW5nZWQgPSB0aGlzLl9vblRpdGxlQ2hhbmdlZC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25JY29uQ2hhbmdlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlOyB1c2VySW5pdGlhdGVkOiBib29sZWFuIH0+KCkpO1xuXHRyZWFkb25seSBvbkljb25DaGFuZ2VkID0gdGhpcy5fb25JY29uQ2hhbmdlZC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsRGF0YSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uV2lsbERhdGEgPSB0aGlzLl9vbldpbGxEYXRhLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRhdGEgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRyZWFkb25seSBvbkRhdGEgPSB0aGlzLl9vbkRhdGEuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uQmluYXJ5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0cmVhZG9ubHkgb25CaW5hcnkgPSB0aGlzLl9vbkJpbmFyeS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25SZXF1ZXN0RXh0SG9zdFByb2Nlc3MgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdHJlYWRvbmx5IG9uUmVxdWVzdEV4dEhvc3RQcm9jZXNzID0gdGhpcy5fb25SZXF1ZXN0RXh0SG9zdFByb2Nlc3MuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGltZW5zaW9uc0NoYW5nZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaW1lbnNpb25zQ2hhbmdlZCA9IHRoaXMuX29uRGltZW5zaW9uc0NoYW5nZWQuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uTWF4aW11bURpbWVuc2lvbnNDaGFuZ2VkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uTWF4aW11bURpbWVuc2lvbnNDaGFuZ2VkID0gdGhpcy5fb25NYXhpbXVtRGltZW5zaW9uc0NoYW5nZWQuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRm9jdXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXMgPSB0aGlzLl9vbkRpZEZvY3VzLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlcXVlc3RGb2N1cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlcXVlc3RGb2N1cyA9IHRoaXMuX29uRGlkUmVxdWVzdEZvY3VzLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEJsdXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQmx1ciA9IHRoaXMuX29uRGlkQmx1ci5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRJbnB1dERhdGEgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRyZWFkb25seSBvbkRpZElucHV0RGF0YSA9IHRoaXMuX29uRGlkSW5wdXREYXRhLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVNlbGVjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXJtaW5hbEluc3RhbmNlPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSB0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25SZXF1ZXN0QWRkSW5zdGFuY2VUb0dyb3VwID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVJlcXVlc3RBZGRJbnN0YW5jZVRvR3JvdXBFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uUmVxdWVzdEFkZEluc3RhbmNlVG9Hcm91cCA9IHRoaXMuX29uUmVxdWVzdEFkZEluc3RhbmNlVG9Hcm91cC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VIYXNDaGlsZFByb2Nlc3NlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUhhc0NoaWxkUHJvY2Vzc2VzID0gdGhpcy5fb25EaWRDaGFuZ2VIYXNDaGlsZFByb2Nlc3Nlcy5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRFeGVjdXRlVGV4dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEV4ZWN1dGVUZXh0ID0gdGhpcy5fb25EaWRFeGVjdXRlVGV4dC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VUYXJnZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxUZXJtaW5hbExvY2F0aW9uIHwgdW5kZWZpbmVkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VUYXJnZXQgPSB0aGlzLl9vbkRpZENoYW5nZVRhcmdldC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTZW5kVGV4dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU2VuZFRleHQgPSB0aGlzLl9vbkRpZFNlbmRUZXh0LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVNoZWxsVHlwZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFRlcm1pbmFsU2hlbGxUeXBlPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTaGVsbFR5cGUgPSB0aGlzLl9vbkRpZENoYW5nZVNoZWxsVHlwZS5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VWaXNpYmlsaXR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eSA9IHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkxpbmVEYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nPih7XG5cdFx0b25EaWRBZGRGaXJzdExpc3RlbmVyOiBhc3luYyAoKSA9PiAodGhpcy54dGVybSA/PyBhd2FpdCB0aGlzLl94dGVybVJlYWR5UHJvbWlzZSk/LnJhdy5sb2FkQWRkb24odGhpcy5fbGluZURhdGFFdmVudEFkZG9uISlcblx0fSkpO1xuXHRyZWFkb25seSBvbkxpbmVEYXRhID0gdGhpcy5fb25MaW5lRGF0YS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFNoZWxsVHlwZUNvbnRleHRLZXk6IElDb250ZXh0S2V5PHN0cmluZz4sXG5cdFx0cHJpdmF0ZSBfc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZTogSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlOiBJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJUGF0aFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJUHJlZmVyZW5jZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3ByZWZlcmVuY2VzU2VydmljZTogSVByZWZlcmVuY2VzU2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF92aWV3c1NlcnZpY2U6IElWaWV3c1NlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRlcm1pbmFsTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJVGVybWluYWxMb2dTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB3b3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZTogSVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UsXG5cdFx0QElIaXN0b3J5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9oaXN0b3J5U2VydmljZTogSUhpc3RvcnlTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSxcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF92aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl93cmFwcGVyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX3dyYXBwZXJFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3Rlcm1pbmFsLXdyYXBwZXInKTtcblxuXHRcdHRoaXMuX3dpZGdldE1hbmFnZXIgPSB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbFdpZGdldE1hbmFnZXIpKTtcblxuXHRcdHRoaXMuX3NraXBUZXJtaW5hbENvbW1hbmRzID0gW107XG5cdFx0dGhpcy5faXNFeGl0aW5nID0gZmFsc2U7XG5cdFx0dGhpcy5faGFkRm9jdXNPbkV4aXQgPSBmYWxzZTtcblx0XHR0aGlzLl9pc1Zpc2libGUgPSBmYWxzZTtcblx0XHR0aGlzLl9pbnN0YW5jZUlkID0gVGVybWluYWxJbnN0YW5jZS5faW5zdGFuY2VJZENvdW50ZXIrKztcblx0XHR0aGlzLl9oYXNIYWRJbnB1dCA9IGZhbHNlO1xuXHRcdHRoaXMuX2ZpeGVkUm93cyA9IF9zaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcz8uZml4ZWREaW1lbnNpb25zPy5yb3dzO1xuXHRcdHRoaXMuX2ZpeGVkQ29scyA9IF9zaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcz8uZml4ZWREaW1lbnNpb25zPy5jb2xzO1xuXHRcdHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLnNoZWxsSW50ZWdyYXRpb25FbnZpcm9ubWVudFJlcG9ydGluZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLlNoZWxsSW50ZWdyYXRpb25FbnZpcm9ubWVudFJlcG9ydGluZyk7XG5cblx0XHR0aGlzLl9yZXNvdXJjZSA9IGdldFRlcm1pbmFsVXJpKHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmlkLCB0aGlzLmluc3RhbmNlSWQsIHRoaXMudGl0bGUpO1xuXG5cdFx0aWYgKHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzPy5oaWRlRnJvbVVzZXIpIHtcblx0XHRcdHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmhpZGVGcm9tVXNlciA9IHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzLmhpZGVGcm9tVXNlcjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3M/LmlzRmVhdHVyZVRlcm1pbmFsKSB7XG5cdFx0XHR0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5pc0ZlYXR1cmVUZXJtaW5hbCA9IHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzLmlzRmVhdHVyZVRlcm1pbmFsO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcz8udHlwZSkge1xuXHRcdFx0dGhpcy5fc2hlbGxMYXVuY2hDb25maWcudHlwZSA9IHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzLnR5cGU7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzPy50YWJBY3Rpb25zKSB7XG5cdFx0XHR0aGlzLl9zaGVsbExhdW5jaENvbmZpZy50YWJBY3Rpb25zID0gdGhpcy5fc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3MudGFiQWN0aW9ucztcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zaGVsbExhdW5jaENvbmZpZy5jd2QpIHtcblx0XHRcdGNvbnN0IGN3ZFVyaSA9IHR5cGVvZiB0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5jd2QgPT09ICdzdHJpbmcnID8gVVJJLmZyb20oe1xuXHRcdFx0XHRzY2hlbWU6IFNjaGVtYXMuZmlsZSxcblx0XHRcdFx0cGF0aDogdGhpcy5fc2hlbGxMYXVuY2hDb25maWcuY3dkXG5cdFx0XHR9KSA6IHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmN3ZDtcblx0XHRcdGlmIChjd2RVcmkpIHtcblx0XHRcdFx0dGhpcy5fd29ya3NwYWNlRm9sZGVyID0gdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKGN3ZFVyaSkgPz8gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIXRoaXMuX3dvcmtzcGFjZUZvbGRlcikge1xuXHRcdFx0Y29uc3QgYWN0aXZlV29ya3NwYWNlUm9vdFVyaSA9IHRoaXMuX2hpc3RvcnlTZXJ2aWNlLmdldExhc3RBY3RpdmVXb3Jrc3BhY2VSb290KCk7XG5cdFx0XHR0aGlzLl93b3Jrc3BhY2VGb2xkZXIgPSBhY3RpdmVXb3Jrc3BhY2VSb290VXJpID8gdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKGFjdGl2ZVdvcmtzcGFjZVJvb3RVcmkpID8/IHVuZGVmaW5lZCA6IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBzY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKF9jb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQodGhpcy5fd3JhcHBlckVsZW1lbnQpKTtcblx0XHR0aGlzLl9zY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlO1xuXHRcdHRoaXMuX3Njb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lDb250ZXh0S2V5U2VydmljZSwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2VdXG5cdFx0KSkpO1xuXG5cdFx0dGhpcy5fdGVybWluYWxGb2N1c0NvbnRleHRLZXkgPSBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fdGVybWluYWxIYXNGaXhlZFdpZHRoID0gVGVybWluYWxDb250ZXh0S2V5cy50ZXJtaW5hbEhhc0ZpeGVkV2lkdGguYmluZFRvKHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl90ZXJtaW5hbEhhc1RleHRDb250ZXh0S2V5ID0gVGVybWluYWxDb250ZXh0S2V5cy50ZXh0U2VsZWN0ZWQuYmluZFRvKHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl90ZXJtaW5hbEFsdEJ1ZmZlckFjdGl2ZUNvbnRleHRLZXkgPSBUZXJtaW5hbENvbnRleHRLZXlzLmFsdEJ1ZmZlckFjdGl2ZS5iaW5kVG8oc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3Rlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbkVuYWJsZWRDb250ZXh0S2V5ID0gVGVybWluYWxDb250ZXh0S2V5cy50ZXJtaW5hbFNoZWxsSW50ZWdyYXRpb25FbmFibGVkLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGB0ZXJtaW5hbEluc3RhbmNlI2N0b3IgKGluc3RhbmNlSWQ6ICR7dGhpcy5pbnN0YW5jZUlkfSlgLCB0aGlzLl9zaGVsbExhdW5jaENvbmZpZyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jYXBhYmlsaXRpZXMub25EaWRBZGRDYXBhYmlsaXR5VHlwZShlID0+IHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ3Rlcm1pbmFsSW5zdGFuY2UgYWRkZWQgY2FwYWJpbGl0eScsIGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jYXBhYmlsaXRpZXMub25EaWRSZW1vdmVDYXBhYmlsaXR5VHlwZShlID0+IHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ3Rlcm1pbmFsSW5zdGFuY2UgcmVtb3ZlZCBjYXBhYmlsaXR5JywgZSkpKTtcblxuXHRcdGNvbnN0IGNhcGFiaWxpdHlMaXN0ZW5lcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcDxUZXJtaW5hbENhcGFiaWxpdHksIElEaXNwb3NhYmxlPigpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNhcGFiaWxpdGllcy5vbkRpZEFkZENhcGFiaWxpdHlUeXBlKGNhcGFiaWxpdHkgPT4ge1xuXHRcdFx0Y2FwYWJpbGl0eUxpc3RlbmVycy5nZXQoY2FwYWJpbGl0eSk/LmRpc3Bvc2UoKTtcblx0XHRcdGlmIChjYXBhYmlsaXR5ID09PSBUZXJtaW5hbENhcGFiaWxpdHkuQ3dkRGV0ZWN0aW9uKSB7XG5cdFx0XHRcdGNvbnN0IGN3ZERldGVjdGlvbiA9IHRoaXMuY2FwYWJpbGl0aWVzLmdldChjYXBhYmlsaXR5KTtcblx0XHRcdFx0aWYgKGN3ZERldGVjdGlvbikge1xuXHRcdFx0XHRcdGNhcGFiaWxpdHlMaXN0ZW5lcnMuc2V0KGNhcGFiaWxpdHksIGN3ZERldGVjdGlvbi5vbkRpZENoYW5nZUN3ZChlID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuX2N3ZCA9IGU7XG5cdFx0XHRcdFx0XHR0aGlzLl9zZXRUaXRsZSh0aGlzLnRpdGxlLCBUaXRsZUV2ZW50U291cmNlLkNvbmZpZyk7XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoY2FwYWJpbGl0eSA9PT0gVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pIHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZERldGVjdGlvbiA9IHRoaXMuY2FwYWJpbGl0aWVzLmdldChjYXBhYmlsaXR5KTtcblx0XHRcdFx0aWYgKGNvbW1hbmREZXRlY3Rpb24pIHtcblx0XHRcdFx0XHRjb21tYW5kRGV0ZWN0aW9uLnByb21wdElucHV0TW9kZWwuc2V0U2hlbGxUeXBlKHRoaXMuc2hlbGxUeXBlKTtcblx0XHRcdFx0XHRjYXBhYmlsaXR5TGlzdGVuZXJzLnNldChjYXBhYmlsaXR5LCBFdmVudC5hbnkoXG5cdFx0XHRcdFx0XHRjb21tYW5kRGV0ZWN0aW9uLnByb21wdElucHV0TW9kZWwub25EaWRTdGFydElucHV0LFxuXHRcdFx0XHRcdFx0Y29tbWFuZERldGVjdGlvbi5wcm9tcHRJbnB1dE1vZGVsLm9uRGlkQ2hhbmdlSW5wdXQsXG5cdFx0XHRcdFx0XHRjb21tYW5kRGV0ZWN0aW9uLnByb21wdElucHV0TW9kZWwub25EaWRGaW5pc2hJbnB1dFxuXHRcdFx0XHRcdCkoKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5fbGFiZWxDb21wdXRlcj8ucmVmcmVzaExhYmVsKHRoaXMpO1xuXHRcdFx0XHRcdFx0cmVmcmVzaFNoZWxsSW50ZWdyYXRpb25JbmZvU3RhdHVzKHRoaXMpO1xuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNhcGFiaWxpdGllcy5vbkRpZFJlbW92ZUNhcGFiaWxpdHlUeXBlKGNhcGFiaWxpdHkgPT4ge1xuXHRcdFx0Y2FwYWJpbGl0eUxpc3RlbmVycy5nZXQoY2FwYWJpbGl0eSk/LmRpc3Bvc2UoKTtcblx0XHR9KSk7XG5cblx0XHQvLyBSZXNvbHZlIGp1c3QgdGhlIGljb24gYWhlYWQgb2YgdGltZSBzbyB0aGF0IGl0IHNob3dzIHVwIGltbWVkaWF0ZWx5IGluIHRoZSB0YWJzLiBUaGlzIGlzXG5cdFx0Ly8gZGlzYWJsZWQgaW4gcmVtb3RlIGJlY2F1c2UgdGhpcyBuZWVkcyB0byBiZSBzeW5jIGFuZCB0aGUgT1MgbWF5IGRpZmZlciBvbiB0aGUgcmVtb3RlXG5cdFx0Ly8gd2hpY2ggd291bGQgcmVzdWx0IGluIHRoZSB3cm9uZyBwcm9maWxlIGJlaW5nIHNlbGVjdGVkIGFuZCB0aGUgd3JvbmcgaWNvbiBiZWluZ1xuXHRcdC8vIHBlcm1hbmVudGx5IGF0dGFjaGVkIHRvIHRoZSB0ZXJtaW5hbC4gVGhpcyBhbHNvIGRvZXNuJ3Qgd29yayB3aGVuIHRoZSBkZWZhdWx0IHByb2ZpbGVcblx0XHQvLyBzZXR0aW5nIGlzIHNldCB0byBudWxsLCB0aGF0J3MgaGFuZGxlZCBhZnRlciB0aGUgcHJvY2VzcyBpcyBjcmVhdGVkLlxuXHRcdGlmICghdGhpcy5zaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlICYmICF3b3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UucmVzb2x2ZUljb24odGhpcy5fc2hlbGxMYXVuY2hDb25maWcsIE9TKTtcblx0XHR9XG5cdFx0dGhpcy5faWNvbiA9IF9zaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcz8uaWNvbiB8fCBfc2hlbGxMYXVuY2hDb25maWcuaWNvbjtcblxuXHRcdC8vIFdoZW4gYSBjdXN0b20gcHR5IGlzIHVzZWQgc2V0IHRoZSBuYW1lIGltbWVkaWF0ZWx5IHNvIGl0IGdldHMgcGFzc2VkIG92ZXIgdG8gdGhlIGV4dGhvc3Rcblx0XHQvLyBhbmQgaXMgYXZhaWxhYmxlIHdoZW4gUHNldWRvdGVybWluYWwub3BlbiBmaXJlcy5cblx0XHRpZiAodGhpcy5zaGVsbExhdW5jaENvbmZpZy5jdXN0b21QdHlJbXBsZW1lbnRhdGlvbikge1xuXHRcdFx0dGhpcy5fc2V0VGl0bGUodGhpcy5fc2hlbGxMYXVuY2hDb25maWcubmFtZSwgVGl0bGVFdmVudFNvdXJjZS5BcGkpO1xuXHRcdH1cblxuXHRcdHRoaXMuc3RhdHVzTGlzdCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Njb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsU3RhdHVzTGlzdCkpO1xuXHRcdHRoaXMuX2luaXREaW1lbnNpb25zKCk7XG5cdFx0dGhpcy5fcHJvY2Vzc01hbmFnZXIgPSB0aGlzLl9jcmVhdGVQcm9jZXNzTWFuYWdlcigpO1xuXG5cdFx0dGhpcy5fY29udGFpbmVyUmVhZHlCYXJyaWVyID0gbmV3IEF1dG9PcGVuQmFycmllcihDb25zdGFudHMuV2FpdEZvckNvbnRhaW5lclRocmVzaG9sZCk7XG5cdFx0dGhpcy5fYXR0YWNoQmFycmllciA9IG5ldyBBdXRvT3BlbkJhcnJpZXIoMTAwMCk7XG5cdFx0dGhpcy5feHRlcm1SZWFkeVByb21pc2UgPSB0aGlzLl9jcmVhdGVYdGVybSgpO1xuXHRcdHRoaXMuX3h0ZXJtUmVhZHlQcm9taXNlLnRoZW4oYXN5bmMgKCkgPT4ge1xuXHRcdFx0Ly8gV2FpdCBmb3IgYSBwZXJpb2QgdG8gYWxsb3cgYSBjb250YWluZXIgdG8gYmUgcmVhZHlcblx0XHRcdGF3YWl0IHRoaXMuX2NvbnRhaW5lclJlYWR5QmFycmllci53YWl0KCk7XG5cblx0XHRcdC8vIFJlc29sdmUgdGhlIGV4ZWN1dGFibGUgYWhlYWQgb2YgdGltZSBpZiBzaGVsbCBpbnRlZ3JhdGlvbiBpcyBlbmFibGVkLCB0aGlzIHNob3VsZCBub3Rcblx0XHRcdC8vIGJlIGRvbmUgZm9yIGN1c3RvbSBQVFlzIGFzIHRoYXQgd291bGQgY2F1c2UgZXh0ZW5zaW9uIFBzZXVkb3Rlcm1pbmFsLWJhc2VkIHRlcm1pbmFsc1xuXHRcdFx0Ly8gdG8gaGFuZyBpbiByZXNvbHZlciBleHRlbnNpb25zXG5cdFx0XHRsZXQgb3M6IE9wZXJhdGluZ1N5c3RlbSB8IHVuZGVmaW5lZDtcblx0XHRcdGlmICghdGhpcy5zaGVsbExhdW5jaENvbmZpZy5jdXN0b21QdHlJbXBsZW1lbnRhdGlvbiAmJiB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5zaGVsbEludGVncmF0aW9uPy5lbmFibGVkICYmICF0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGUpIHtcblx0XHRcdFx0b3MgPSBhd2FpdCB0aGlzLl9wcm9jZXNzTWFuYWdlci5nZXRCYWNrZW5kT1MoKTtcblx0XHRcdFx0Y29uc3QgZGVmYXVsdFByb2ZpbGUgPSAoYXdhaXQgdGhpcy5fdGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLmdldERlZmF1bHRQcm9maWxlKHsgcmVtb3RlQXV0aG9yaXR5OiB0aGlzLnJlbW90ZUF1dGhvcml0eSwgb3MgfSkpO1xuXHRcdFx0XHR0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGUgPSBkZWZhdWx0UHJvZmlsZS5wYXRoO1xuXHRcdFx0XHR0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MgPSBkZWZhdWx0UHJvZmlsZS5hcmdzO1xuXHRcdFx0XHRpZiAodGhpcy5zaGVsbExhdW5jaENvbmZpZy5pc0V4dGVuc2lvbk93bmVkVGVybWluYWwpIHtcblx0XHRcdFx0XHQvLyBPbmx5IHVzZSBkZWZhdWx0IGljb24gYW5kIGNvbG9yIGFuZCBlbnYgaWYgdGhleSBhcmUgdW5kZWZpbmVkIGluIHRoZSBTTENcblx0XHRcdFx0XHR0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmljb24gPz89IGRlZmF1bHRQcm9maWxlLmljb247XG5cdFx0XHRcdFx0dGhpcy5zaGVsbExhdW5jaENvbmZpZy5jb2xvciA/Pz0gZGVmYXVsdFByb2ZpbGUuY29sb3I7XG5cdFx0XHRcdFx0dGhpcy5zaGVsbExhdW5jaENvbmZpZy5lbnYgPz89IGRlZmF1bHRQcm9maWxlLmVudjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmljb24gPSBkZWZhdWx0UHJvZmlsZS5pY29uO1xuXHRcdFx0XHRcdHRoaXMuc2hlbGxMYXVuY2hDb25maWcuY29sb3IgPSBkZWZhdWx0UHJvZmlsZS5jb2xvcjtcblx0XHRcdFx0XHR0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmVudiA9IGRlZmF1bHRQcm9maWxlLmVudjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXNvbHZlIHRoZSBzaGVsbCB0eXBlIGFoZWFkIG9mIHRpbWUgdG8gYWxsb3cgZmVhdHVyZXMgdGhhdCBkZXBlbmQgdXBvbiBpdCB0byB3b3JrXG5cdFx0XHQvLyBiZWZvcmUgdGhlIHByb2Nlc3MgaXMgYWN0dWFsbHkgY3JlYXRlZCAobGlrZSB0ZXJtaW5hbCBzdWdnZXN0IG1hbnVhbCByZXF1ZXN0KVxuXHRcdFx0aWYgKG9zICYmIHRoaXMuc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSkge1xuXHRcdFx0XHR0aGlzLnNldFNoZWxsVHlwZShndWVzc1NoZWxsVHlwZUZyb21FeGVjdXRhYmxlKG9zLCB0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGUpKTtcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdGhpcy5fY3JlYXRlUHJvY2VzcygpO1xuXG5cdFx0XHQvLyBSZS1lc3RhYmxpc2ggdGhlIHRpdGxlIGFmdGVyIHJlY29ubmVjdFxuXHRcdFx0aWYgKHRoaXMuc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3MpIHtcblx0XHRcdFx0dGhpcy5fY3dkID0gdGhpcy5zaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcy5jd2Q7XG5cdFx0XHRcdHRoaXMuX3NldFRpdGxlKHRoaXMuc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3MudGl0bGUsIHRoaXMuc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3MudGl0bGVTb3VyY2UpO1xuXHRcdFx0XHR0aGlzLnNldFNoZWxsVHlwZSh0aGlzLnNoZWxsVHlwZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9maXhlZENvbHMpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fYWRkU2Nyb2xsYmFyKCk7XG5cdFx0XHR9XG5cdFx0fSkuY2F0Y2goKGVycikgPT4ge1xuXHRcdFx0Ly8gSWdub3JlIGV4Y2VwdGlvbnMgaWYgdGhlIHRlcm1pbmFsIGlzIGFscmVhZHkgZGlzcG9zZWRcblx0XHRcdGlmICghdGhpcy5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHRocm93IGVycjtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihhc3luYyBlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuVGVybWluYWwpKSB7XG5cdFx0XHRcdHRoaXMuX3NldEFyaWFMYWJlbCh0aGlzLnh0ZXJtPy5yYXcsIHRoaXMuX2luc3RhbmNlSWQsIHRoaXMudGl0bGUpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3Rlcm1pbmFsLmludGVncmF0ZWQnKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNvbmZpZygpO1xuXHRcdFx0XHR0aGlzLnNldFZpc2libGUodGhpcy5faXNWaXNpYmxlKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGxheW91dFNldHRpbmdzOiBzdHJpbmdbXSA9IFtcblx0XHRcdFx0VGVybWluYWxTZXR0aW5nSWQuRm9udFNpemUsXG5cdFx0XHRcdFRlcm1pbmFsU2V0dGluZ0lkLkZvbnRGYW1pbHksXG5cdFx0XHRcdFRlcm1pbmFsU2V0dGluZ0lkLkZvbnRXZWlnaHQsXG5cdFx0XHRcdFRlcm1pbmFsU2V0dGluZ0lkLkZvbnRXZWlnaHRCb2xkLFxuXHRcdFx0XHRUZXJtaW5hbFNldHRpbmdJZC5MZXR0ZXJTcGFjaW5nLFxuXHRcdFx0XHRUZXJtaW5hbFNldHRpbmdJZC5MaW5lSGVpZ2h0LFxuXHRcdFx0XHQnZWRpdG9yLmZvbnRGYW1pbHknXG5cdFx0XHRdO1xuXHRcdFx0aWYgKGxheW91dFNldHRpbmdzLnNvbWUoaWQgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihpZCkpKSB7XG5cdFx0XHRcdHRoaXMuX2xheW91dFNldHRpbmdzQ2hhbmdlZCA9IHRydWU7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3Jlc2l6ZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuVW5pY29kZVZlcnNpb24pKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZVVuaWNvZGVWZXJzaW9uKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZWRpdG9yLmFjY2Vzc2liaWxpdHlTdXBwb3J0JykpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVBY2Nlc3NpYmlsaXR5U3VwcG9ydCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKFxuXHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsU2V0dGluZ0lkLlRlcm1pbmFsVGl0bGUpIHx8XG5cdFx0XHRcdGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuVGVybWluYWxUaXRsZVNlcGFyYXRvcikgfHxcblx0XHRcdFx0ZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFNldHRpbmdJZC5UZXJtaW5hbERlc2NyaXB0aW9uKSkge1xuXHRcdFx0XHR0aGlzLl9sYWJlbENvbXB1dGVyPy5yZWZyZXNoTGFiZWwodGhpcyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycygoKSA9PiB0aGlzLl9sYWJlbENvbXB1dGVyPy5yZWZyZXNoTGFiZWwodGhpcykpKTtcblxuXHRcdC8vIENsZWFyIG91dCBpbml0aWFsIGRhdGEgZXZlbnRzIGFmdGVyIDEwIHNlY29uZHMsIGhvcGVmdWxseSBleHRlbnNpb24gaG9zdHMgYXJlIHVwIGFuZFxuXHRcdC8vIHJ1bm5pbmcgYXQgdGhhdCBwb2ludC5cblx0XHRsZXQgaW5pdGlhbERhdGFFdmVudHNUaW1lb3V0OiBudW1iZXIgfCB1bmRlZmluZWQgPSBkb20uZ2V0V2luZG93KHRoaXMuX2NvbnRhaW5lcikuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRpbml0aWFsRGF0YUV2ZW50c1RpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLl9pbml0aWFsRGF0YUV2ZW50cyA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX2luaXRpYWxEYXRhRXZlbnRzTGlzdGVuZXIuY2xlYXIoKTtcblx0XHR9LCAxMDAwMCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGlmIChpbml0aWFsRGF0YUV2ZW50c1RpbWVvdXQpIHtcblx0XHRcdFx0ZG9tLmdldFdpbmRvdyh0aGlzLl9jb250YWluZXIpLmNsZWFyVGltZW91dChpbml0aWFsRGF0YUV2ZW50c1RpbWVvdXQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIEluaXRpYWxpemUgY29udHJpYnV0aW9uc1xuXHRcdGNvbnN0IGNvbnRyaWJ1dGlvbkRlc2NzID0gVGVybWluYWxFeHRlbnNpb25zUmVnaXN0cnkuZ2V0VGVybWluYWxDb250cmlidXRpb25zKCk7XG5cdFx0Zm9yIChjb25zdCBkZXNjIG9mIGNvbnRyaWJ1dGlvbkRlc2NzKSB7XG5cdFx0XHRpZiAodGhpcy5fY29udHJpYnV0aW9ucy5oYXMoZGVzYy5pZCkpIHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IobmV3IEVycm9yKGBDYW5ub3QgaGF2ZSB0d28gdGVybWluYWwgY29udHJpYnV0aW9ucyB3aXRoIHRoZSBzYW1lIGlkICR7ZGVzYy5pZH1gKSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0bGV0IGNvbnRyaWJ1dGlvbjogSVRlcm1pbmFsQ29udHJpYnV0aW9uO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29udHJpYnV0aW9uID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5fc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoZGVzYy5jdG9yLCB7XG5cdFx0XHRcdFx0aW5zdGFuY2U6IHRoaXMsXG5cdFx0XHRcdFx0cHJvY2Vzc01hbmFnZXI6IHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLFxuXHRcdFx0XHRcdHdpZGdldE1hbmFnZXI6IHRoaXMuX3dpZGdldE1hbmFnZXJcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHR0aGlzLl9jb250cmlidXRpb25zLnNldChkZXNjLmlkLCBjb250cmlidXRpb24pO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl94dGVybVJlYWR5UHJvbWlzZS50aGVuKHh0ZXJtID0+IHtcblx0XHRcdFx0aWYgKHh0ZXJtKSB7XG5cdFx0XHRcdFx0Y29udHJpYnV0aW9uLnh0ZXJtUmVhZHk/Lih4dGVybSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpc3Bvc2VkKCgpID0+IHtcblx0XHRcdFx0Y29udHJpYnV0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5fY29udHJpYnV0aW9ucy5kZWxldGUoZGVzYy5pZCk7XG5cdFx0XHRcdC8vIEp1c3QgaW4gY2FzZSB0byBwcmV2ZW50IHBvdGVudGlhbCBmdXR1cmUgbWVtb3J5IGxlYWtzIGR1ZSB0byBjeWNsaWMgZGVwZW5kZW5jeS5cblx0XHRcdFx0aWYgKCdpbnN0YW5jZScgaW4gY29udHJpYnV0aW9uKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIGNvbnRyaWJ1dGlvbi5pbnN0YW5jZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoJ19pbnN0YW5jZScgaW4gY29udHJpYnV0aW9uKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIGNvbnRyaWJ1dGlvbi5faW5zdGFuY2U7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q29udHJpYnV0aW9uPFQgZXh0ZW5kcyBJVGVybWluYWxDb250cmlidXRpb24+KGlkOiBzdHJpbmcpOiBUIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRyaWJ1dGlvbnMuZ2V0KGlkKSBhcyBUIHwgbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgX2dldEljb24oKTogVGVybWluYWxJY29uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuX2ljb24pIHtcblx0XHRcdHRoaXMuX2ljb24gPSB0aGlzLl9wcm9jZXNzTWFuYWdlci5wcm9jZXNzU3RhdGUgPj0gUHJvY2Vzc1N0YXRlLkxhdW5jaGluZ1xuXHRcdFx0XHQ/IGdldEljb25SZWdpc3RyeSgpLmdldEljb24odGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxTZXR0aW5nSWQuVGFic0RlZmF1bHRJY29uKSlcblx0XHRcdFx0OiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9pY29uO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Q29sb3IoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5zaGVsbExhdW5jaENvbmZpZy5jb2xvcikge1xuXHRcdFx0cmV0dXJuIHRoaXMuc2hlbGxMYXVuY2hDb25maWcuY29sb3I7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnNoZWxsTGF1bmNoQ29uZmlnPy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcz8uY29sb3IpIHtcblx0XHRcdHJldHVybiB0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzLmNvbG9yO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9wcm9jZXNzTWFuYWdlci5wcm9jZXNzU3RhdGUgPj0gUHJvY2Vzc1N0YXRlLkxhdW5jaGluZykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgX2luaXREaW1lbnNpb25zKCk6IHZvaWQge1xuXHRcdC8vIFRoZSB0ZXJtaW5hbCBwYW5lbCBuZWVkcyB0byBoYXZlIGJlZW4gY3JlYXRlZCB0byBnZXQgdGhlIHJlYWwgdmlldyBkaW1lbnNpb25zXG5cdFx0aWYgKCF0aGlzLl9jb250YWluZXIpIHtcblx0XHRcdC8vIFNldCB0aGUgZmFsbGJhY2sgZGltZW5zaW9ucyBpZiBub3Rcblx0XHRcdHRoaXMuX2NvbHMgPSBDb25zdGFudHMuRGVmYXVsdENvbHM7XG5cdFx0XHR0aGlzLl9yb3dzID0gQ29uc3RhbnRzLkRlZmF1bHRSb3dzO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbXB1dGVkU3R5bGUgPSBkb20uZ2V0V2luZG93KHRoaXMuX2NvbnRhaW5lcikuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLl9jb250YWluZXIpO1xuXHRcdGNvbnN0IHdpZHRoID0gcGFyc2VJbnQoY29tcHV0ZWRTdHlsZS53aWR0aCk7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gcGFyc2VJbnQoY29tcHV0ZWRTdHlsZS5oZWlnaHQpO1xuXG5cdFx0dGhpcy5fZXZhbHVhdGVDb2xzQW5kUm93cyh3aWR0aCwgaGVpZ2h0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFdmFsdWF0ZXMgYW5kIHNldHMgdGhlIGNvbHMgYW5kIHJvd3Mgb2YgdGhlIHRlcm1pbmFsIGlmIHBvc3NpYmxlLlxuXHQgKiBAcGFyYW0gd2lkdGggVGhlIHdpZHRoIG9mIHRoZSBjb250YWluZXIuXG5cdCAqIEBwYXJhbSBoZWlnaHQgVGhlIGhlaWdodCBvZiB0aGUgY29udGFpbmVyLlxuXHQgKiBAcmV0dXJuIFRoZSB0ZXJtaW5hbCdzIHdpZHRoIGlmIGl0IHJlcXVpcmVzIGEgbGF5b3V0LlxuXHQgKi9cblx0cHJpdmF0ZSBfZXZhbHVhdGVDb2xzQW5kUm93cyh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IG51bWJlciB8IG51bGwge1xuXHRcdC8vIElnbm9yZSBpZiBkaW1lbnNpb25zIGFyZSB1bmRlZmluZWQgb3IgMFxuXHRcdGlmICghd2lkdGggfHwgIWhlaWdodCkge1xuXHRcdFx0dGhpcy5fc2V0TGFzdEtub3duQ29sc0FuZFJvd3MoKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpbWVuc2lvbiA9IHRoaXMuX2dldERpbWVuc2lvbih3aWR0aCwgaGVpZ2h0KTtcblx0XHRpZiAoIWRpbWVuc2lvbikge1xuXHRcdFx0dGhpcy5fc2V0TGFzdEtub3duQ29sc0FuZFJvd3MoKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvbnQgPSB0aGlzLnh0ZXJtID8gdGhpcy54dGVybS5nZXRGb250KCkgOiB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEZvbnQoZG9tLmdldFdpbmRvdyh0aGlzLmRvbUVsZW1lbnQpKTtcblx0XHRjb25zdCBuZXdSQyA9IGdldFh0ZXJtU2NhbGVkRGltZW5zaW9ucyhkb20uZ2V0V2luZG93KHRoaXMuZG9tRWxlbWVudCksIGZvbnQsIGRpbWVuc2lvbi53aWR0aCwgZGltZW5zaW9uLmhlaWdodCk7XG5cdFx0aWYgKCFuZXdSQykge1xuXHRcdFx0dGhpcy5fc2V0TGFzdEtub3duQ29sc0FuZFJvd3MoKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jb2xzICE9PSBuZXdSQy5jb2xzIHx8IHRoaXMuX3Jvd3MgIT09IG5ld1JDLnJvd3MpIHtcblx0XHRcdHRoaXMuX2NvbHMgPSBuZXdSQy5jb2xzO1xuXHRcdFx0dGhpcy5fcm93cyA9IG5ld1JDLnJvd3M7XG5cdFx0XHR0aGlzLl9maXJlTWF4aW11bURpbWVuc2lvbnNDaGFuZ2VkKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRpbWVuc2lvbi53aWR0aDtcblx0fVxuXG5cdHByaXZhdGUgX3NldExhc3RLbm93bkNvbHNBbmRSb3dzKCk6IHZvaWQge1xuXHRcdGlmIChUZXJtaW5hbEluc3RhbmNlLl9sYXN0S25vd25HcmlkRGltZW5zaW9ucykge1xuXHRcdFx0dGhpcy5fY29scyA9IFRlcm1pbmFsSW5zdGFuY2UuX2xhc3RLbm93bkdyaWREaW1lbnNpb25zLmNvbHM7XG5cdFx0XHR0aGlzLl9yb3dzID0gVGVybWluYWxJbnN0YW5jZS5fbGFzdEtub3duR3JpZERpbWVuc2lvbnMucm93cztcblx0XHR9XG5cdH1cblxuXHRAZGVib3VuY2UoNTApXG5cdHByaXZhdGUgX2ZpcmVNYXhpbXVtRGltZW5zaW9uc0NoYW5nZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5fb25NYXhpbXVtRGltZW5zaW9uc0NoYW5nZWQuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RGltZW5zaW9uKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKTogSUNhbnZhc0RpbWVuc2lvbnMgfCB1bmRlZmluZWQge1xuXHRcdC8vIFRoZSBmb250IG5lZWRzIHRvIGhhdmUgYmVlbiBpbml0aWFsaXplZFxuXHRcdGNvbnN0IGZvbnQgPSB0aGlzLnh0ZXJtID8gdGhpcy54dGVybS5nZXRGb250KCkgOiB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEZvbnQoZG9tLmdldFdpbmRvdyh0aGlzLmRvbUVsZW1lbnQpKTtcblx0XHRpZiAoIWZvbnQgfHwgIWZvbnQuY2hhcldpZHRoIHx8ICFmb250LmNoYXJIZWlnaHQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnh0ZXJtPy5yYXcuZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgY29tcHV0ZWRTdHlsZSA9IGRvbS5nZXRXaW5kb3codGhpcy54dGVybS5yYXcuZWxlbWVudCkuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLnh0ZXJtLnJhdy5lbGVtZW50KTtcblx0XHRjb25zdCBob3Jpem9udGFsUGFkZGluZyA9IHBhcnNlSW50KGNvbXB1dGVkU3R5bGUucGFkZGluZ0xlZnQpICsgcGFyc2VJbnQoY29tcHV0ZWRTdHlsZS5wYWRkaW5nUmlnaHQpICsgMTQvKnNjcm9sbCBiYXIgcGFkZGluZyovO1xuXHRcdGNvbnN0IHZlcnRpY2FsUGFkZGluZyA9IHBhcnNlSW50KGNvbXB1dGVkU3R5bGUucGFkZGluZ1RvcCkgKyBwYXJzZUludChjb21wdXRlZFN0eWxlLnBhZGRpbmdCb3R0b20pO1xuXHRcdFRlcm1pbmFsSW5zdGFuY2UuX2xhc3RLbm93bkNhbnZhc0RpbWVuc2lvbnMgPSBuZXcgZG9tLkRpbWVuc2lvbihcblx0XHRcdE1hdGgubWluKENvbnN0YW50cy5NYXhDYW52YXNXaWR0aCwgd2lkdGggLSBob3Jpem9udGFsUGFkZGluZyksXG5cdFx0XHRoZWlnaHQgLSB2ZXJ0aWNhbFBhZGRpbmcgKyAodGhpcy5faGFzU2Nyb2xsQmFyICYmIHRoaXMuX2hvcml6b250YWxTY3JvbGxiYXIgPyAtNS8qIHNjcm9sbCBiYXIgaGVpZ2h0ICovIDogMCkpO1xuXHRcdHJldHVybiBUZXJtaW5hbEluc3RhbmNlLl9sYXN0S25vd25DYW52YXNEaW1lbnNpb25zO1xuXHR9XG5cblx0Z2V0IHBlcnNpc3RlbnRQcm9jZXNzSWQoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLnBlcnNpc3RlbnRQcm9jZXNzSWQ7IH1cblx0Z2V0IHNob3VsZFBlcnNpc3QoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9wcm9jZXNzTWFuYWdlci5zaG91bGRQZXJzaXN0ICYmICF0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmlzVHJhbnNpZW50ICYmICghdGhpcy5yZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzIHx8IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCd0YXNrLnJlY29ubmVjdGlvbicpID09PSB0cnVlKTsgfVxuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0WHRlcm1Db25zdHJ1Y3RvcihrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlKSB7XG5cdFx0Y29uc3Qga2V5YmluZGluZyA9IGtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoVGVybWluYWxDb250cmliQ29tbWFuZElkLkExMXlGb2N1c0FjY2Vzc2libGVCdWZmZXIsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpZiAoeHRlcm1Db25zdHJ1Y3Rvcikge1xuXHRcdFx0cmV0dXJuIHh0ZXJtQ29uc3RydWN0b3I7XG5cdFx0fVxuXHRcdHh0ZXJtQ29uc3RydWN0b3IgPSBQcm9taXNlcy53aXRoQXN5bmNCb2R5PHR5cGVvZiBYVGVybVRlcm1pbmFsPihhc3luYyAocmVzb2x2ZSkgPT4ge1xuXHRcdFx0Y29uc3QgVGVybWluYWwgPSAoYXdhaXQgaW1wb3J0QU1ETm9kZU1vZHVsZTx0eXBlb2YgaW1wb3J0KCdAeHRlcm0veHRlcm0nKT4oJ0B4dGVybS94dGVybScsICdsaWIveHRlcm0uanMnKSkuVGVybWluYWw7XG5cdFx0XHQvLyBMb2NhbGl6ZSBzdHJpbmdzXG5cdFx0XHRUZXJtaW5hbC5zdHJpbmdzLnByb21wdExhYmVsID0gbmxzLmxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmExMXlQcm9tcHRMYWJlbCcsICdUZXJtaW5hbCBpbnB1dCcpO1xuXHRcdFx0VGVybWluYWwuc3RyaW5ncy50b29NdWNoT3V0cHV0ID0ga2V5YmluZGluZyA/IG5scy5sb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC51c2VBY2Nlc3NpYmxlQnVmZmVyJywgJ1VzZSB0aGUgYWNjZXNzaWJsZSBidWZmZXIgezB9IHRvIG1hbnVhbGx5IHJldmlldyBvdXRwdXQnLCBrZXliaW5kaW5nLmdldExhYmVsKCkpIDogbmxzLmxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnVzZUFjY2Vzc2libGVCdWZmZXJOb0tiJywgJ1VzZSB0aGUgVGVybWluYWw6IEZvY3VzIEFjY2Vzc2libGUgQnVmZmVyIGNvbW1hbmQgdG8gbWFudWFsbHkgcmV2aWV3IG91dHB1dCcpO1xuXHRcdFx0cmVzb2x2ZShUZXJtaW5hbCk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHh0ZXJtQ29uc3RydWN0b3I7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIHh0ZXJtLmpzIGluc3RhbmNlIGFuZCBhdHRhY2ggZGF0YSBsaXN0ZW5lcnMuXG5cdCAqL1xuXHRwcm90ZWN0ZWQgYXN5bmMgX2NyZWF0ZVh0ZXJtKCk6IFByb21pc2U8WHRlcm1UZXJtaW5hbCB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IFRlcm1pbmFsID0gYXdhaXQgVGVybWluYWxJbnN0YW5jZS5nZXRYdGVybUNvbnN0cnVjdG9yKHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0aWYgKHRoaXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBkaXNhYmxlU2hlbGxJbnRlZ3JhdGlvblJlcG9ydGluZyA9ICh0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGUgPT09IHVuZGVmaW5lZCB8fCB0aGlzLnNoZWxsVHlwZSA9PT0gdW5kZWZpbmVkKSB8fCAhc2hlbGxJbnRlZ3JhdGlvblN1cHBvcnRlZFNoZWxsVHlwZXMuaW5jbHVkZXModGhpcy5zaGVsbFR5cGUpO1xuXHRcdGNvbnN0IHh0ZXJtID0gdGhpcy5fc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoWHRlcm1UZXJtaW5hbCwgVGVybWluYWwsIHtcblx0XHRcdGNvbHM6IHRoaXMuX2NvbHMsXG5cdFx0XHRyb3dzOiB0aGlzLl9yb3dzLFxuXHRcdFx0eHRlcm1Db2xvclByb3ZpZGVyOiB0aGlzLl9zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbEluc3RhbmNlQ29sb3JQcm92aWRlciwgdGhpcy5fdGFyZ2V0UmVmKSxcblx0XHRcdGNhcGFiaWxpdGllczogdGhpcy5jYXBhYmlsaXRpZXMsXG5cdFx0XHRzaGVsbEludGVncmF0aW9uTm9uY2U6IHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLnNoZWxsSW50ZWdyYXRpb25Ob25jZSxcblx0XHRcdGRpc2FibGVTaGVsbEludGVncmF0aW9uUmVwb3J0aW5nLFxuXHRcdH0pO1xuXHRcdHRoaXMueHRlcm0gPSB4dGVybTtcblx0XHR0aGlzLl9yZXNpemVEZWJvdW5jZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGVybWluYWxSZXNpemVEZWJvdW5jZXIoXG5cdFx0XHQoKSA9PiB0aGlzLl9pc1Zpc2libGUsXG5cdFx0XHQoKSA9PiB4dGVybSxcblx0XHRcdGFzeW5jIChjb2xzLCByb3dzKSA9PiB7XG5cdFx0XHRcdHh0ZXJtLnJhdy5yZXNpemUoY29scywgcm93cyk7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3VwZGF0ZVB0eURpbWVuc2lvbnMoeHRlcm0ucmF3KTtcblx0XHRcdH0sXG5cdFx0XHRhc3luYyAoY29scykgPT4ge1xuXHRcdFx0XHR4dGVybS5yYXcucmVzaXplKGNvbHMsIHh0ZXJtLnJhdy5yb3dzKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5fdXBkYXRlUHR5RGltZW5zaW9ucyh4dGVybS5yYXcpO1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIChyb3dzKSA9PiB7XG5cdFx0XHRcdHh0ZXJtLnJhdy5yZXNpemUoeHRlcm0ucmF3LmNvbHMsIHJvd3MpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLl91cGRhdGVQdHlEaW1lbnNpb25zKHh0ZXJtLnJhdyk7XG5cdFx0XHR9XG5cdFx0KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuX3Jlc2l6ZURlYm91bmNlciA9IHVuZGVmaW5lZCkpO1xuXHRcdHRoaXMudXBkYXRlQWNjZXNzaWJpbGl0eVN1cHBvcnQoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnh0ZXJtLm9uRGlkUmVxdWVzdFJ1bkNvbW1hbmQoZSA9PiB7XG5cdFx0XHR0aGlzLnNlbmRUZXh0KGUuY29tbWFuZC5jb21tYW5kLCBlLm5vTmV3TGluZSA/IGZhbHNlIDogdHJ1ZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMueHRlcm0ub25EaWRSZXF1ZXN0UmVmcmVzaERpbWVuc2lvbnMoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2xhc3RMYXlvdXREaW1lbnNpb25zKSB7XG5cdFx0XHRcdHRoaXMubGF5b3V0KHRoaXMuX2xhc3RMYXlvdXREaW1lbnNpb25zKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0Ly8gV3JpdGUgaW5pdGlhbCB0ZXh0LCBkZWZlcnJpbmcgb25MaW5lRmVlZCBsaXN0ZW5lciB3aGVuIGFwcGxpY2FibGUgdG8gYXZvaWQgZmlyaW5nXG5cdFx0Ly8gb25MaW5lRGF0YSBldmVudHMgY29udGFpbmluZyBpbml0aWFsVGV4dFxuXHRcdGNvbnN0IGluaXRpYWxUZXh0V3JpdHRlblByb21pc2UgPSB0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5pbml0aWFsVGV4dCA/IG5ldyBQcm9taXNlPHZvaWQ+KHIgPT4gdGhpcy5fd3JpdGVJbml0aWFsVGV4dCh4dGVybSwgcikpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGxpbmVEYXRhRXZlbnRBZGRvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBMaW5lRGF0YUV2ZW50QWRkb24oaW5pdGlhbFRleHRXcml0dGVuUHJvbWlzZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGxpbmVEYXRhRXZlbnRBZGRvbi5vbkxpbmVEYXRhKGUgPT4gdGhpcy5fb25MaW5lRGF0YS5maXJlKGUpKSk7XG5cdFx0dGhpcy5fbGluZURhdGFFdmVudEFkZG9uID0gbGluZURhdGFFdmVudEFkZG9uO1xuXHRcdC8vIERlbGF5IHRoZSBjcmVhdGlvbiBvZiB0aGUgYmVsbCBsaXN0ZW5lciB0byBhdm9pZCBzaG93aW5nIHRoZSBiZWxsIHdoZW4gdGhlIHRlcm1pbmFsXG5cdFx0Ly8gc3RhcnRzIHVwIG9yIHJlY29ubmVjdHNcblx0XHRkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih4dGVybS5yYXcub25CZWxsKCgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLkVuYWJsZUJlbGwpIHx8IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLkVuYWJsZVZpc3VhbEJlbGwpKSB7XG5cdFx0XHRcdFx0dGhpcy5zdGF0dXNMaXN0LmFkZCh7XG5cdFx0XHRcdFx0XHRpZDogVGVybWluYWxTdGF0dXMuQmVsbCxcblx0XHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5iZWxsLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogbmxzLmxvY2FsaXplKCdiZWxsU3RhdHVzJywgXCJCZWxsXCIpXG5cdFx0XHRcdFx0fSwgdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuYmVsbER1cmF0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwudGVybWluYWxCZWxsKTtcblx0XHRcdH0pKTtcblx0XHR9LCAxMDAwLCB0aGlzLl9zdG9yZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoeHRlcm0ucmF3Lm9uU2VsZWN0aW9uQ2hhbmdlKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlU2VsZWN0aW9uLmZpcmUodGhpcykpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih4dGVybS5yYXcuYnVmZmVyLm9uQnVmZmVyQ2hhbmdlKCgpID0+IHRoaXMuX3JlZnJlc2hBbHRCdWZmZXJDb250ZXh0S2V5KCkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLm9uUHJvY2Vzc0RhdGEoZSA9PiB0aGlzLl9vblByb2Nlc3NEYXRhKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoeHRlcm0ucmF3Lm9uRGF0YShhc3luYyBkYXRhID0+IHtcblx0XHRcdGF3YWl0IHRoaXMuX3BhdXNlSW5wdXRFdmVudEJhcnJpZXI/LndhaXQoKTtcblx0XHRcdGF3YWl0IHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLndyaXRlKGRhdGEpO1xuXHRcdFx0dGhpcy5fb25EaWRJbnB1dERhdGEuZmlyZShkYXRhKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoeHRlcm0ucmF3Lm9uQmluYXJ5KGRhdGEgPT4gdGhpcy5fcHJvY2Vzc01hbmFnZXIucHJvY2Vzc0JpbmFyeShkYXRhKSkpO1xuXHRcdC8vIEluaXQgd2lucHR5IGNvbXBhdCBhbmQgbGluayBoYW5kbGVyIGFmdGVyIHByb2Nlc3MgY3JlYXRpb24gYXMgdGhleSByZWx5IG9uIHRoZVxuXHRcdC8vIHVuZGVybHlpbmcgcHJvY2VzcyBPU1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLm9uUHJvY2Vzc1JlYWR5KGFzeW5jIChwcm9jZXNzVHJhaXRzKSA9PiB7XG5cdFx0XHQvLyBSZXNwb25kIHRvIERBMSB3aXRoIGJhc2ljIGNvbmZvcm1hbmNlLiBOb3RlIHRoYXQgaW5jbHVkaW5nIHRoaXMgaXMgcmVxdWlyZWQgdG8gYXZvaWRcblx0XHRcdC8vIGEgbG9uZyBkZWxheSBpbiBjb25wdHkgMS4yMisgd2hlcmUgaXQgd2FpdHMgZm9yIHRoZSByZXNwb25zZS5cblx0XHRcdC8vIFJlZmVyZW5jZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC90ZXJtaW5hbC9ibG9iLzM3NjBjYWVkOTdmYTkxNDBhNDA3NzdhOGZiYzFjOTU3ODVlNmQyYWIvc3JjL3Rlcm1pbmFsL2FkYXB0ZXIvYWRhcHREaXNwYXRjaC5jcHAjTDE0NzEtTDE0OTVcblx0XHRcdGlmIChwcm9jZXNzVHJhaXRzPy53aW5kb3dzUHR5Py5iYWNrZW5kID09PSAnY29ucHR5Jykge1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih4dGVybS5yYXcucGFyc2VyLnJlZ2lzdGVyQ3NpSGFuZGxlcih7IGZpbmFsOiAnYycgfSwgcGFyYW1zID0+IHtcblx0XHRcdFx0XHRpZiAocGFyYW1zLmxlbmd0aCA9PT0gMCB8fCBwYXJhbXMubGVuZ3RoID09PSAxICYmIHBhcmFtc1swXSA9PT0gMCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fcHJvY2Vzc01hbmFnZXIud3JpdGUoJ1xceDFiWz82MTs0YycpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLm9zKSB7XG5cdFx0XHRcdGxpbmVEYXRhRXZlbnRBZGRvbi5zZXRPcGVyYXRpbmdTeXN0ZW0odGhpcy5fcHJvY2Vzc01hbmFnZXIub3MpO1xuXHRcdFx0fVxuXHRcdFx0eHRlcm0ucmF3Lm9wdGlvbnMud2luZG93c1B0eSA9IHByb2Nlc3NUcmFpdHMud2luZG93c1B0eTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcHJvY2Vzc01hbmFnZXIub25SZXN0b3JlQ29tbWFuZHMoZSA9PiB0aGlzLnh0ZXJtPy5zaGVsbEludGVncmF0aW9uLmRlc2VyaWFsaXplKGUpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl92aWV3RGVzY3JpcHRvclNlcnZpY2Uub25EaWRDaGFuZ2VMb2NhdGlvbigoeyB2aWV3cyB9KSA9PiB7XG5cdFx0XHRpZiAodmlld3Muc29tZSh2ID0+IHYuaWQgPT09IFRFUk1JTkFMX1ZJRVdfSUQpKSB7XG5cdFx0XHRcdHh0ZXJtLnJlZnJlc2goKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoeHRlcm0ub25EaWRDaGFuZ2VQcm9ncmVzcygoKSA9PiB0aGlzLl9sYWJlbENvbXB1dGVyPy5yZWZyZXNoTGFiZWwodGhpcykpKTtcblxuXHRcdC8vIFJlZ2lzdGVyIGFuZCB1cGRhdGUgdGhlIHRlcm1pbmFsJ3Mgc2hlbGwgaW50ZWdyYXRpb24gc3RhdHVzXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKHh0ZXJtLnNoZWxsSW50ZWdyYXRpb24ub25EaWRDaGFuZ2VTZWVuU2VxdWVuY2VzLCAoKSA9PiB7XG5cdFx0XHRpZiAoeHRlcm0uc2hlbGxJbnRlZ3JhdGlvbi5zZWVuU2VxdWVuY2VzLnNpemUgPiAwKSB7XG5cdFx0XHRcdHJlZnJlc2hTaGVsbEludGVncmF0aW9uSW5mb1N0YXR1cyh0aGlzKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBTZXQgdXAgdXBkYXRpbmcgb2YgdGhlIHByb2Nlc3MgY3dkIG9uIGtleSBwcmVzcywgdGhpcyBpcyBvbmx5IG5lZWRlZCB3aGVuIHRoZSBjd2Rcblx0XHQvLyBkZXRlY3Rpb24gY2FwYWJpbGl0eSBoYXMgbm90IGJlZW4gcmVnaXN0ZXJlZFxuXHRcdGlmICghdGhpcy5jYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Dd2REZXRlY3Rpb24pKSB7XG5cdFx0XHRsZXQgb25LZXlMaXN0ZW5lcjogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQgPSB4dGVybS5yYXcub25LZXkoZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlLmRvbUV2ZW50KTtcblx0XHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0XHRcdHRoaXMuX3VwZGF0ZVByb2Nlc3NDd2QoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNhcGFiaWxpdGllcy5vbkRpZEFkZENhcGFiaWxpdHlUeXBlKGUgPT4ge1xuXHRcdFx0XHRpZiAoZSA9PT0gVGVybWluYWxDYXBhYmlsaXR5LkN3ZERldGVjdGlvbikge1xuXHRcdFx0XHRcdG9uS2V5TGlzdGVuZXI/LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRvbktleUxpc3RlbmVyID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcGF0aFNlcnZpY2UudXNlckhvbWUoKS50aGVuKHVzZXJIb21lID0+IHtcblx0XHRcdHRoaXMuX3VzZXJIb21lID0gdXNlckhvbWUuZnNQYXRoO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0dGhpcy5fb3BlbigpO1xuXHRcdH1cblxuXHRcdHJldHVybiB4dGVybTtcblx0fVxuXG5cdGFzeW5jIHJ1bkNvbW1hbmQoY29tbWFuZExpbmU6IHN0cmluZywgc2hvdWxkRXhlY3V0ZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBjb21tYW5kRGV0ZWN0aW9uID0gdGhpcy5jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKTtcblxuXHRcdC8vIEF3YWl0IGNvbW1hbmQgZGV0ZWN0aW9uIGlmIHRoZSB0ZXJtaW5hbCBpcyBzdGFydGluZyB1cFxuXHRcdGlmICghY29tbWFuZERldGVjdGlvbiAmJiAodGhpcy5fcHJvY2Vzc01hbmFnZXIucHJvY2Vzc1N0YXRlID09PSBQcm9jZXNzU3RhdGUuVW5pbml0aWFsaXplZCB8fCB0aGlzLl9wcm9jZXNzTWFuYWdlci5wcm9jZXNzU3RhdGUgPT09IFByb2Nlc3NTdGF0ZS5MYXVuY2hpbmcpKSB7XG5cdFx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHRcdG5ldyBQcm9taXNlPHZvaWQ+KHIgPT4ge1xuXHRcdFx0XHRcdHN0b3JlLmFkZCh0aGlzLmNhcGFiaWxpdGllcy5vbkRpZEFkZENhcGFiaWxpdHlUeXBlKGUgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGUgPT09IFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSB7XG5cdFx0XHRcdFx0XHRcdGNvbW1hbmREZXRlY3Rpb24gPSB0aGlzLmNhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pO1xuXHRcdFx0XHRcdFx0XHRyKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9KSxcblx0XHRcdFx0dGltZW91dCgyMDAwKSxcblx0XHRcdF0pO1xuXHRcdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdC8vIERldGVybWluZSB3aGV0aGVyIHRvIHNlbmQgRVRYIChjdHJsK2MpIGJlZm9yZSBydW5uaW5nIHRoZSBjb21tYW5kLiBUaGlzIHNob3VsZCBhbHdheXNcblx0XHQvLyBoYXBwZW4gdW5sZXNzIGNvbW1hbmQgZGV0ZWN0aW9uIGNhbiByZWxpYWJseSBzYXkgdGhhdCBhIGNvbW1hbmQgaXMgYmVpbmcgZW50ZXJlZCBhbmRcblx0XHQvLyB0aGVyZSBpcyBubyBjb250ZW50IGluIHRoZSBwcm9tcHRcblx0XHRpZiAoIWNvbW1hbmREZXRlY3Rpb24gfHwgY29tbWFuZERldGVjdGlvbi5wcm9tcHRJbnB1dE1vZGVsLnZhbHVlLmxlbmd0aCA+IDApIHtcblx0XHRcdGF3YWl0IHRoaXMuc2VuZFRleHQoJ1xceDAzJywgZmFsc2UpO1xuXHRcdFx0Ly8gV2FpdCBhIGxpdHRsZSBiZWZvcmUgcnVubmluZyB0aGUgY29tbWFuZCB0byBhdm9pZCB0aGUgc2VxdWVuY2VzIGJlaW5nIGVjaG9lZCB3aGlsZSB0aGUgXkNcblx0XHRcdC8vIGlzIGJlaW5nIGV2YWx1YXRlZFxuXHRcdFx0YXdhaXQgdGltZW91dCgxMDApO1xuXHRcdH1cblx0XHQvLyBVc2UgYnJhY2tldGVkIHBhc3RlIG1vZGUgb25seSB3aGVuIG5vdCBydW5uaW5nIHRoZSBjb21tYW5kXG5cdFx0YXdhaXQgdGhpcy5zZW5kVGV4dChjb21tYW5kTGluZSwgc2hvdWxkRXhlY3V0ZSwgIXNob3VsZEV4ZWN1dGUpO1xuXHR9XG5cblx0ZGV0YWNoRnJvbUVsZW1lbnQoKTogdm9pZCB7XG5cdFx0dGhpcy5fd3JhcHBlckVsZW1lbnQucmVtb3ZlKCk7XG5cdFx0dGhpcy5fY29udGFpbmVyID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0YXR0YWNoVG9FbGVtZW50KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHQvLyBUaGUgY29udGFpbmVyIGRpZCBub3QgY2hhbmdlLCBkbyBub3RoaW5nXG5cdFx0aWYgKHRoaXMuX2NvbnRhaW5lciA9PT0gY29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9hdHRhY2hCYXJyaWVyLmlzT3BlbigpKSB7XG5cdFx0XHR0aGlzLl9hdHRhY2hCYXJyaWVyLm9wZW4oKTtcblx0XHR9XG5cblx0XHQvLyBUaGUgY29udGFpbmVyIGNoYW5nZWQsIHJlYXR0YWNoXG5cdFx0dGhpcy5fY29udGFpbmVyID0gY29udGFpbmVyO1xuXHRcdHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl93cmFwcGVyRWxlbWVudCk7XG5cblx0XHQvLyBJZiB4dGVybSBpcyBhbHJlYWR5IGF0dGFjaGVkLCBjYWxsIG9wZW4gYWdhaW4gdG8gcGljayB1cCBhbnkgY2hhbmdlcyB0byB0aGUgd2luZG93LlxuXHRcdGlmICh0aGlzLnh0ZXJtPy5yYXcuZWxlbWVudCkge1xuXHRcdFx0dGhpcy54dGVybS5yYXcub3Blbih0aGlzLnh0ZXJtLnJhdy5lbGVtZW50KTtcblx0XHR9XG5cblx0XHR0aGlzLnh0ZXJtPy5yZWZyZXNoKCk7XG5cblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2luaXREcmFnQW5kRHJvcChjb250YWluZXIpO1xuXHRcdH0sIDApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE9wZW5zIHRoZSB0ZXJtaW5hbCBpbnN0YW5jZSBpbnNpZGUgdGhlIHBhcmVudCBET00gZWxlbWVudCBwcmV2aW91c2x5IHNldCB3aXRoXG5cdCAqIGBhdHRhY2hUb0VsZW1lbnRgLCB5b3UgbXVzdCBlbnN1cmUgdGhlIHBhcmVudCBET00gZWxlbWVudCBpcyBleHBsaWNpdGx5IHZpc2libGUgYmVmb3JlXG5cdCAqIGludm9raW5nIHRoaXMgZnVuY3Rpb24gYXMgaXQgcGVyZm9ybXMgc29tZSBET00gY2FsY3VsYXRpb25zIGludGVybmFsbHlcblx0ICovXG5cdHByaXZhdGUgX29wZW4oKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnh0ZXJtIHx8IHRoaXMueHRlcm0ucmF3LmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2NvbnRhaW5lciB8fCAhdGhpcy5fY29udGFpbmVyLmlzQ29ubmVjdGVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0EgY29udGFpbmVyIGVsZW1lbnQgbmVlZHMgdG8gYmUgc2V0IHdpdGggYGF0dGFjaFRvRWxlbWVudGAgYW5kIGJlIHBhcnQgb2YgdGhlIERPTSBiZWZvcmUgY2FsbGluZyBgX29wZW5gJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeHRlcm1FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5fd3JhcHBlckVsZW1lbnQuYXBwZW5kQ2hpbGQoeHRlcm1FbGVtZW50KTtcblxuXHRcdHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl93cmFwcGVyRWxlbWVudCk7XG5cblx0XHRjb25zdCB4dGVybSA9IHRoaXMueHRlcm07XG5cblx0XHQvLyBBdHRhY2ggdGhlIHh0ZXJtIG9iamVjdCB0byB0aGUgRE9NLCBleHBvc2luZyBpdCB0byB0aGUgc21va2UgdGVzdHNcblx0XHR0aGlzLl93cmFwcGVyRWxlbWVudC54dGVybSA9IHh0ZXJtLnJhdztcblxuXHRcdGNvbnN0IHNjcmVlbkVsZW1lbnQgPSB4dGVybS5hdHRhY2hUb0VsZW1lbnQoeHRlcm1FbGVtZW50KTtcblxuXHRcdC8vIEZpcmUgeHRlcm1PcGVuIG9uIGFsbCBjb250cmlidXRpb25zXG5cdFx0Zm9yIChjb25zdCBjb250cmlidXRpb24gb2YgdGhpcy5fY29udHJpYnV0aW9ucy52YWx1ZXMoKSkge1xuXHRcdFx0aWYgKCF0aGlzLnh0ZXJtKSB7XG5cdFx0XHRcdHRoaXMuX3h0ZXJtUmVhZHlQcm9taXNlLnRoZW4oeHRlcm0gPT4ge1xuXHRcdFx0XHRcdGlmICh4dGVybSkge1xuXHRcdFx0XHRcdFx0Y29udHJpYnV0aW9uLnh0ZXJtT3Blbj8uKHh0ZXJtKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udHJpYnV0aW9uLnh0ZXJtT3Blbj8uKHRoaXMueHRlcm0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHh0ZXJtLnNoZWxsSW50ZWdyYXRpb24ub25EaWRDaGFuZ2VTdGF0dXMoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaGFzRm9jdXMpIHtcblx0XHRcdFx0dGhpcy5fc2V0U2hlbGxJbnRlZ3JhdGlvbkNvbnRleHRLZXkoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbkVuYWJsZWRDb250ZXh0S2V5LnJlc2V0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKCF4dGVybS5yYXcuZWxlbWVudCB8fCAheHRlcm0ucmF3LnRleHRhcmVhKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3h0ZXJtIGVsZW1lbnRzIG5vdCBzZXQgYWZ0ZXIgb3BlbicpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3NldEFyaWFMYWJlbCh4dGVybS5yYXcsIHRoaXMuX2luc3RhbmNlSWQsIHRoaXMuX3RpdGxlKTtcblxuXHRcdHh0ZXJtLnJhdy5hdHRhY2hDdXN0b21LZXlFdmVudEhhbmRsZXIoKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogYm9vbGVhbiA9PiB7XG5cdFx0XHQvLyBEaXNhYmxlIGFsbCBpbnB1dCBpZiB0aGUgdGVybWluYWwgaXMgZXhpdGluZ1xuXHRcdFx0aWYgKHRoaXMuX2lzRXhpdGluZykge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN0YW5kYXJkS2V5Ym9hcmRFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZXZlbnQpO1xuXHRcdFx0Y29uc3QgcmVzb2x2ZVJlc3VsdCA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLnNvZnREaXNwYXRjaChzdGFuZGFyZEtleWJvYXJkRXZlbnQsIHN0YW5kYXJkS2V5Ym9hcmRFdmVudC50YXJnZXQpO1xuXG5cdFx0XHQvLyBSZXNwZWN0IGNob3JkcyBpZiB0aGUgYWxsb3dDaG9yZHMgc2V0dGluZyBpcyBzZXQgYW5kIGl0J3Mgbm90IEVzY2FwZS4gRXNjYXBlIGlzXG5cdFx0XHQvLyBoYW5kbGVkIHNwZWNpYWxseSBmb3IgWmVuIE1vZGUncyBFc2NhcGUsIEVzY2FwZSBjaG9yZCwgcGx1cyBpdCdzIGltcG9ydGFudCBpblxuXHRcdFx0Ly8gdGVybWluYWxzIGdlbmVyYWxseVxuXHRcdFx0Y29uc3QgaXNWYWxpZENob3JkID0gcmVzb2x2ZVJlc3VsdC5raW5kID09PSBSZXN1bHRLaW5kLk1vcmVDaG9yZHNOZWVkZWQgJiYgdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuYWxsb3dDaG9yZHMgJiYgZXZlbnQua2V5ICE9PSAnRXNjYXBlJztcblx0XHRcdGlmICh0aGlzLl9rZXliaW5kaW5nU2VydmljZS5pbkNob3JkTW9kZSB8fCBpc1ZhbGlkQ2hvcmQpIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBTSE9XX1RFUk1JTkFMX0NPTkZJR19QUk9NUFRfS0VZID0gJ3Rlcm1pbmFsLmludGVncmF0ZWQuc2hvd1Rlcm1pbmFsQ29uZmlnUHJvbXB0Jztcblx0XHRcdGNvbnN0IEVYQ0xVREVEX0tFWVMgPSBbJ1JpZ2h0QXJyb3cnLCAnTGVmdEFycm93JywgJ1VwQXJyb3cnLCAnRG93bkFycm93JywgJ1NwYWNlJywgJ01ldGEnLCAnQ29udHJvbCcsICdTaGlmdCcsICdBbHQnLCAnJywgJ0RlbGV0ZScsICdCYWNrc3BhY2UnLCAnVGFiJ107XG5cblx0XHRcdC8vIG9ubHkga2VlcCB0cmFjayBvZiBpbnB1dCBpZiBwcm9tcHQgaGFzbid0IGFscmVhZHkgYmVlbiBzaG93blxuXHRcdFx0aWYgKHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oU0hPV19URVJNSU5BTF9DT05GSUdfUFJPTVBUX0tFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCB0cnVlKSAmJlxuXHRcdFx0XHQhRVhDTFVERURfS0VZUy5pbmNsdWRlcyhldmVudC5rZXkpICYmXG5cdFx0XHRcdCFldmVudC5jdHJsS2V5ICYmXG5cdFx0XHRcdCFldmVudC5zaGlmdEtleSAmJlxuXHRcdFx0XHQhZXZlbnQuYWx0S2V5KSB7XG5cdFx0XHRcdHRoaXMuX2hhc0hhZElucHV0ID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gZm9yIGtleWJvYXJkIGV2ZW50cyB0aGF0IHJlc29sdmUgdG8gY29tbWFuZHMgZGVzY3JpYmVkXG5cdFx0XHQvLyB3aXRoaW4gY29tbWFuZHNUb1NraXBTaGVsbCwgZWl0aGVyIGFsZXJ0IG9yIHNraXAgcHJvY2Vzc2luZyBieSB4dGVybS5qc1xuXHRcdFx0aWYgKHJlc29sdmVSZXN1bHQua2luZCA9PT0gUmVzdWx0S2luZC5LYkZvdW5kICYmIHJlc29sdmVSZXN1bHQuY29tbWFuZElkICYmIHRoaXMuX3NraXBUZXJtaW5hbENvbW1hbmRzLnNvbWUoayA9PiBrID09PSByZXNvbHZlUmVzdWx0LmNvbW1hbmRJZCkgJiYgIXRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLnNlbmRLZXliaW5kaW5nc1RvU2hlbGwpIHtcblx0XHRcdFx0Ly8gZG9uJ3QgYWxlcnQgd2hlbiB0ZXJtaW5hbCBpcyBvcGVuZWQgb3IgY2xvc2VkXG5cdFx0XHRcdGlmICh0aGlzLl9zdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKFNIT1dfVEVSTUlOQUxfQ09ORklHX1BST01QVF9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgdHJ1ZSkgJiZcblx0XHRcdFx0XHR0aGlzLl9oYXNIYWRJbnB1dCAmJlxuXHRcdFx0XHRcdCFURVJNSU5BTF9DUkVBVElPTl9DT01NQU5EUy5pbmNsdWRlcyhyZXNvbHZlUmVzdWx0LmNvbW1hbmRJZCkpIHtcblx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChcblx0XHRcdFx0XHRcdFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2tleWJpbmRpbmdIYW5kbGluZycsIFwiU29tZSBrZXliaW5kaW5ncyBkb24ndCBnbyB0byB0aGUgdGVybWluYWwgYnkgZGVmYXVsdCBhbmQgYXJlIGhhbmRsZWQgYnkgezB9IGluc3RlYWQuXCIsIHRoaXMuX3Byb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2NvbmZpZ3VyZVRlcm1pbmFsU2V0dGluZ3MnLCBcIkNvbmZpZ3VyZSBUZXJtaW5hbCBTZXR0aW5nc1wiKSxcblx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuX3ByZWZlcmVuY2VzU2VydmljZS5vcGVuU2V0dGluZ3MoeyBqc29uRWRpdG9yOiBmYWxzZSwgcXVlcnk6IGBAaWQ6JHtUZXJtaW5hbFNldHRpbmdJZC5Db21tYW5kc1RvU2tpcFNoZWxsfSwke1Rlcm1pbmFsU2V0dGluZ0lkLlNlbmRLZXliaW5kaW5nc1RvU2hlbGx9LCR7VGVybWluYWxTZXR0aW5nSWQuQWxsb3dDaG9yZHN9YCB9KTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0gc2F0aXNmaWVzIElQcm9tcHRDaG9pY2Vcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKFNIT1dfVEVSTUlOQUxfQ09ORklHX1BST01QVF9LRVksIGZhbHNlLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTa2lwIHByb2Nlc3NpbmcgYnkgeHRlcm0uanMgb2Yga2V5Ym9hcmQgZXZlbnRzIHRoYXQgbWF0Y2ggbWVudSBiYXIgbW5lbW9uaWNzXG5cdFx0XHRpZiAodGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuYWxsb3dNbmVtb25pY3MgJiYgIWlzTWFjaW50b3NoICYmIGV2ZW50LmFsdEtleSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIHRhYiBmb2N1cyBtb2RlIGlzIG9uLCB0YWIgaXMgbm90IHBhc3NlZCB0byB0aGUgdGVybWluYWxcblx0XHRcdGlmIChUYWJGb2N1cy5nZXRUYWJGb2N1c01vZGUoKSAmJiBldmVudC5rZXkgPT09ICdUYWInKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUHJldmVudCBkZWZhdWx0IHdoZW4gc2hpZnQrdGFiIGlzIGJlaW5nIHNlbnQgdG8gdGhlIHRlcm1pbmFsIHRvIGF2b2lkIGl0IGJ1YmJsaW5nIHVwXG5cdFx0XHQvLyBhbmQgY2hhbmdpbmcgZm9jdXMgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE4ODMyOVxuXHRcdFx0aWYgKGV2ZW50LmtleSA9PT0gJ1RhYicgJiYgZXZlbnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFsd2F5cyBoYXZlIGFsdCtGNCBza2lwIHRoZSB0ZXJtaW5hbCBvbiBXaW5kb3dzIGFuZCBhbGxvdyBpdCB0byBiZSBoYW5kbGVkIGJ5IHRoZVxuXHRcdFx0Ly8gc3lzdGVtXG5cdFx0XHRpZiAoaXNXaW5kb3dzICYmIGV2ZW50LmFsdEtleSAmJiBldmVudC5rZXkgPT09ICdGNCcgJiYgIWV2ZW50LmN0cmxLZXkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBGYWxsYmFjayB0byBmb3JjZSBjdHJsK3YgdG8gcGFzdGUgb24gYnJvd3NlcnMgdGhhdCBkbyBub3Qgc3VwcG9ydFxuXHRcdFx0Ly8gbmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dFxuXHRcdFx0aWYgKCFCcm93c2VyRmVhdHVyZXMuY2xpcGJvYXJkLnJlYWRUZXh0ICYmIGV2ZW50LmtleSA9PT0gJ3YnICYmIGV2ZW50LmN0cmxLZXkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHh0ZXJtLnJhdy5lbGVtZW50LCAnbW91c2Vkb3duJywgKCkgPT4ge1xuXHRcdFx0Ly8gV2UgbmVlZCB0byBsaXN0ZW4gdG8gdGhlIG1vdXNldXAgZXZlbnQgb24gdGhlIGRvY3VtZW50IHNpbmNlIHRoZSB1c2VyIG1heSByZWxlYXNlXG5cdFx0XHQvLyB0aGUgbW91c2UgYnV0dG9uIGFueXdoZXJlIG91dHNpZGUgb2YgX3h0ZXJtLmVsZW1lbnQuXG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoeHRlcm0ucmF3LmVsZW1lbnQhLm93bmVyRG9jdW1lbnQsICdtb3VzZXVwJywgKCkgPT4ge1xuXHRcdFx0XHQvLyBEZWxheSB3aXRoIGEgc2V0VGltZW91dCB0byBhbGxvdyB0aGUgbW91c2V1cCB0byBwcm9wYWdhdGUgdGhyb3VnaCB0aGUgRE9NXG5cdFx0XHRcdC8vIGJlZm9yZSBldmFsdWF0aW5nIHRoZSBuZXcgc2VsZWN0aW9uIHN0YXRlLlxuXHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3JlZnJlc2hTZWxlY3Rpb25Db250ZXh0S2V5KCksIDApO1xuXHRcdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih4dGVybS5yYXcuZWxlbWVudCwgJ3RvdWNoc3RhcnQnLCAoKSA9PiB7XG5cdFx0XHR4dGVybS5yYXcuZm9jdXMoKTtcblx0XHR9KSk7XG5cblx0XHQvLyB4dGVybS5qcyBjdXJyZW50bHkgZHJvcHMgc2VsZWN0aW9uIG9uIGtleXVwIGFzIHdlIG5lZWQgdG8gaGFuZGxlIHRoaXMgY2FzZS5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHh0ZXJtLnJhdy5lbGVtZW50LCAna2V5dXAnLCAoKSA9PiB7XG5cdFx0XHQvLyBXYWl0IHVudGlsIGtleXVwIGhhcyBwcm9wYWdhdGVkIHRocm91Z2ggdGhlIERPTSBiZWZvcmUgZXZhbHVhdGluZ1xuXHRcdFx0Ly8gdGhlIG5ldyBzZWxlY3Rpb24gc3RhdGUuXG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3JlZnJlc2hTZWxlY3Rpb25Db250ZXh0S2V5KCksIDApO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoeHRlcm0ucmF3LnRleHRhcmVhLCAnZm9jdXMnLCAoKSA9PiB0aGlzLl9zZXRGb2N1cyh0cnVlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoeHRlcm0ucmF3LnRleHRhcmVhLCAnYmx1cicsICgpID0+IHRoaXMuX3NldEZvY3VzKGZhbHNlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoeHRlcm0ucmF3LnRleHRhcmVhLCAnZm9jdXNvdXQnLCAoKSA9PiB0aGlzLl9zZXRGb2N1cyhmYWxzZSkpKTtcblxuXHRcdHRoaXMuX2luaXREcmFnQW5kRHJvcCh0aGlzLl9jb250YWluZXIpO1xuXG5cdFx0dGhpcy5fd2lkZ2V0TWFuYWdlci5hdHRhY2hUb0VsZW1lbnQoc2NyZWVuRWxlbWVudCk7XG5cblx0XHRpZiAodGhpcy5fbGFzdExheW91dERpbWVuc2lvbnMpIHtcblx0XHRcdHRoaXMubGF5b3V0KHRoaXMuX2xhc3RMYXlvdXREaW1lbnNpb25zKTtcblx0XHR9XG5cdFx0dGhpcy51cGRhdGVDb25maWcoKTtcblxuXHRcdC8vIElmIElTaGVsbExhdW5jaENvbmZpZy53YWl0T25FeGl0IHdhcyB0cnVlIGFuZCB0aGUgcHJvY2VzcyBmaW5pc2hlZCBiZWZvcmUgdGhlIHRlcm1pbmFsXG5cdFx0Ly8gcGFuZWwgd2FzIGluaXRpYWxpemVkLlxuXHRcdGlmICh4dGVybS5yYXcub3B0aW9ucy5kaXNhYmxlU3RkaW4pIHtcblx0XHRcdHRoaXMuX2F0dGFjaFByZXNzQW55S2V5VG9DbG9zZUxpc3RlbmVyKHh0ZXJtLnJhdyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2V0Rm9jdXMoZm9jdXNlZD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoZm9jdXNlZCkge1xuXHRcdFx0dGhpcy5fdGVybWluYWxGb2N1c0NvbnRleHRLZXkuc2V0KHRydWUpO1xuXHRcdFx0dGhpcy5fc2V0U2hlbGxJbnRlZ3JhdGlvbkNvbnRleHRLZXkoKTtcblx0XHRcdHRoaXMuX29uRGlkRm9jdXMuZmlyZSh0aGlzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yZXNldEZvY3VzQ29udGV4dEtleSgpO1xuXHRcdFx0dGhpcy5fb25EaWRCbHVyLmZpcmUodGhpcyk7XG5cdFx0XHR0aGlzLl9yZWZyZXNoU2VsZWN0aW9uQ29udGV4dEtleSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NldFNoZWxsSW50ZWdyYXRpb25Db250ZXh0S2V5KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnh0ZXJtKSB7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbFNoZWxsSW50ZWdyYXRpb25FbmFibGVkQ29udGV4dEtleS5zZXQodGhpcy54dGVybS5zaGVsbEludGVncmF0aW9uLnN0YXR1cyA9PT0gU2hlbGxJbnRlZ3JhdGlvblN0YXR1cy5WU0NvZGUpO1xuXHRcdH1cblx0fVxuXG5cdHJlc2V0Rm9jdXNDb250ZXh0S2V5KCk6IHZvaWQge1xuXHRcdHRoaXMuX3Rlcm1pbmFsRm9jdXNDb250ZXh0S2V5LnJlc2V0KCk7XG5cdFx0dGhpcy5fdGVybWluYWxTaGVsbEludGVncmF0aW9uRW5hYmxlZENvbnRleHRLZXkucmVzZXQoKTtcblx0fVxuXG5cdHByaXZhdGUgX2luaXREcmFnQW5kRHJvcChjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZG5kQ29udHJvbGxlciA9IHN0b3JlLmFkZCh0aGlzLl9zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbEluc3RhbmNlRHJhZ0FuZERyb3BDb250cm9sbGVyLCBjb250YWluZXIpKTtcblx0XHRzdG9yZS5hZGQoZG5kQ29udHJvbGxlci5vbkRyb3BUZXJtaW5hbChlID0+IHRoaXMuX29uUmVxdWVzdEFkZEluc3RhbmNlVG9Hcm91cC5maXJlKGUpKSk7XG5cdFx0c3RvcmUuYWRkKGRuZENvbnRyb2xsZXIub25Ecm9wRmlsZShhc3luYyBwYXRoID0+IHtcblx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdGF3YWl0IHRoaXMuc2VuZFBhdGgocGF0aCwgZmFsc2UpO1xuXHRcdH0pKTtcblx0XHRzdG9yZS5hZGQobmV3IGRvbS5EcmFnQW5kRHJvcE9ic2VydmVyKGNvbnRhaW5lciwgZG5kQ29udHJvbGxlcikpO1xuXHRcdHRoaXMuX2RuZE9ic2VydmVyLnZhbHVlID0gc3RvcmU7XG5cdH1cblxuXHRoYXNTZWxlY3Rpb24oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMueHRlcm0gPyB0aGlzLnh0ZXJtLnJhdy5oYXNTZWxlY3Rpb24oKSA6IGZhbHNlO1xuXHR9XG5cblx0Z2V0IHNlbGVjdGlvbigpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnh0ZXJtICYmIHRoaXMuaGFzU2VsZWN0aW9uKCkgPyB0aGlzLnh0ZXJtLnJhdy5nZXRTZWxlY3Rpb24oKSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdGNsZWFyU2VsZWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMueHRlcm0/LnJhdy5jbGVhclNlbGVjdGlvbigpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVmcmVzaEFsdEJ1ZmZlckNvbnRleHRLZXkoKSB7XG5cdFx0dGhpcy5fdGVybWluYWxBbHRCdWZmZXJBY3RpdmVDb250ZXh0S2V5LnNldCghISh0aGlzLnh0ZXJtICYmIHRoaXMueHRlcm0ucmF3LmJ1ZmZlci5hY3RpdmUgPT09IHRoaXMueHRlcm0ucmF3LmJ1ZmZlci5hbHRlcm5hdGUpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UocmVhc29uPzogVGVybWluYWxFeGl0UmVhc29uKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuc2hlbGxMYXVuY2hDb25maWcudHlwZSA9PT0gJ1Rhc2snICYmIHJlYXNvbiA9PT0gVGVybWluYWxFeGl0UmVhc29uLlByb2Nlc3MgJiYgdGhpcy5fZXhpdENvZGUgIT09IDAgJiYgIXRoaXMuc2hlbGxMYXVuY2hDb25maWcud2FpdE9uRXhpdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYHRlcm1pbmFsSW5zdGFuY2UjZGlzcG9zZSAoaW5zdGFuY2VJZDogJHt0aGlzLmluc3RhbmNlSWR9KWApO1xuXHRcdGRpc3Bvc2UodGhpcy5fd2lkZ2V0TWFuYWdlcik7XG5cblx0XHRpZiAodGhpcy54dGVybT8ucmF3LmVsZW1lbnQpIHtcblx0XHRcdHRoaXMuX2hhZEZvY3VzT25FeGl0ID0gdGhpcy5oYXNGb2N1cztcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3dyYXBwZXJFbGVtZW50Lnh0ZXJtKSB7XG5cdFx0XHR0aGlzLl93cmFwcGVyRWxlbWVudC54dGVybSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2hvcml6b250YWxTY3JvbGxiYXIpIHtcblx0XHRcdHRoaXMuX2hvcml6b250YWxTY3JvbGxiYXIuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5faG9yaXpvbnRhbFNjcm9sbGJhciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy54dGVybT8uZGlzcG9zZSgpO1xuXHRcdH0gY2F0Y2ggKGVycjogdW5rbm93bikge1xuXHRcdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNTM0ODZcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoJ0V4Y2VwdGlvbiBvY2N1cnJlZCBkdXJpbmcgeHRlcm0gZGlzcG9zYWwnLCBlcnIpO1xuXHRcdH1cblxuXHRcdC8vIEhBQ0s6IFdvcmthcm91bmQgZm9yIEZpcmVmb3ggYnVnIGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTU1OTU2MSxcblx0XHQvLyBhcyAnYmx1cicgZXZlbnQgaW4geHRlcm0ucmF3LnRleHRhcmVhIGlzIG5vdCB0cmlnZ2VyZWQgb24geHRlcm0uZGlzcG9zZSgpXG5cdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMzgzNThcblx0XHRpZiAoaXNGaXJlZm94KSB7XG5cdFx0XHR0aGlzLnJlc2V0Rm9jdXNDb250ZXh0S2V5KCk7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbEhhc1RleHRDb250ZXh0S2V5LnJlc2V0KCk7XG5cdFx0XHR0aGlzLl9vbkRpZEJsdXIuZmlyZSh0aGlzKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcHJlc3NBbnlLZXlUb0Nsb3NlTGlzdGVuZXIpIHtcblx0XHRcdHRoaXMuX3ByZXNzQW55S2V5VG9DbG9zZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX3ByZXNzQW55S2V5VG9DbG9zZUxpc3RlbmVyID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9leGl0UmVhc29uID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX2V4aXRSZWFzb24gPSByZWFzb24gPz8gVGVybWluYWxFeGl0UmVhc29uLlVua25vd247XG5cdFx0fVxuXG5cdFx0dGhpcy5fcHJvY2Vzc01hbmFnZXIuZGlzcG9zZSgpO1xuXHRcdC8vIFByb2Nlc3MgbWFuYWdlciBkaXNwb3NlL3NodXRkb3duIGRvZXNuJ3QgZmlyZSBwcm9jZXNzIGV4aXQsIHRyaWdnZXIgd2l0aCB1bmRlZmluZWQgaWYgaXRcblx0XHQvLyBoYXNuJ3QgaGFwcGVuZWQgeWV0XG5cdFx0dGhpcy5fb25Qcm9jZXNzRXhpdCh1bmRlZmluZWQpO1xuXG5cdFx0dGhpcy5fb25EaXNwb3NlZC5maXJlKHRoaXMpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0YXN5bmMgZGV0YWNoUHJvY2Vzc0FuZERpc3Bvc2UocmVhc29uOiBUZXJtaW5hbEV4aXRSZWFzb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBEZXRhY2ggdGhlIHByb2Nlc3MgYW5kIGRpc3Bvc2UgdGhlIGluc3RhbmNlLCB3aXRob3V0IHRoZSBpbnN0YW5jZSBkaXNwb3NlIHRoZSB0ZXJtaW5hbFxuXHRcdC8vIHdvbid0IGdvIGF3YXkuIEZvcmNlIHBlcnNpc3QgaWYgdGhlIGRldGFjaCB3YXMgcmVxdWVzdGVkIGJ5IHRoZSB1c2VyIChub3Qgc2h1dGRvd24pLlxuXHRcdGF3YWl0IHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLmRldGFjaEZyb21Qcm9jZXNzKHJlYXNvbiA9PT0gVGVybWluYWxFeGl0UmVhc29uLlVzZXIpO1xuXHRcdHRoaXMuZGlzcG9zZShyZWFzb24pO1xuXHR9XG5cblx0Zm9jdXMoZm9yY2U/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVmcmVzaEFsdEJ1ZmZlckNvbnRleHRLZXkoKTtcblx0XHRpZiAoIXRoaXMueHRlcm0pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKGZvcmNlIHx8ICFkb20uZ2V0QWN0aXZlV2luZG93KCkuZ2V0U2VsZWN0aW9uKCk/LnRvU3RyaW5nKCkpIHtcblx0XHRcdHRoaXMueHRlcm0ucmF3LmZvY3VzKCk7XG5cdFx0XHR0aGlzLl9vbkRpZFJlcXVlc3RGb2N1cy5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZm9jdXNXaGVuUmVhZHkoZm9yY2U/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5feHRlcm1SZWFkeVByb21pc2U7XG5cdFx0YXdhaXQgdGhpcy5fYXR0YWNoQmFycmllci53YWl0KCk7XG5cdFx0dGhpcy5mb2N1cyhmb3JjZSk7XG5cdH1cblxuXHRhc3luYyBzZW5kVGV4dCh0ZXh0OiBzdHJpbmcsIHNob3VsZEV4ZWN1dGU6IGJvb2xlYW4sIGJyYWNrZXRlZFBhc3RlTW9kZT86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBBcHBseSBicmFja2V0ZWQgcGFzdGUgc2VxdWVuY2VzIGlmIHRoZSB0ZXJtaW5hbCBoYXMgdGhlIG1vZGUgZW5hYmxlZCwgdGhpcyB3aWxsIHByZXZlbnRcblx0XHQvLyB0aGUgdGV4dCBmcm9tIHRyaWdnZXJpbmcga2V5YmluZGluZ3MgYW5kIGVuc3VyZSBuZXcgbGluZXMgYXJlIGhhbmRsZWQgcHJvcGVybHlcblx0XHRpZiAoYnJhY2tldGVkUGFzdGVNb2RlICYmIHRoaXMueHRlcm0/LnJhdy5tb2Rlcy5icmFja2V0ZWRQYXN0ZU1vZGUpIHtcblx0XHRcdHRleHQgPSBgXFx4MWJbMjAwfiR7dGV4dH1cXHgxYlsyMDF+YDtcblx0XHR9XG5cblx0XHQvLyBOb3JtYWxpemUgbGluZSBlbmRpbmdzIHRvICdlbnRlcicgcHJlc3MuXG5cdFx0dGV4dCA9IHRleHQucmVwbGFjZSgvXFxyP1xcbi9nLCAnXFxyJyk7XG5cdFx0aWYgKHNob3VsZEV4ZWN1dGUgJiYgIXRleHQuZW5kc1dpdGgoJ1xccicpKSB7XG5cdFx0XHR0ZXh0ICs9ICdcXHInO1xuXHRcdH1cblxuXHRcdC8vIFNlbmQgaXQgdG8gdGhlIHByb2Nlc3Ncblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKCdzZW5kaW5nIGRhdGEgKHZzY29kZSknLCB0ZXh0KTtcblx0XHRhd2FpdCB0aGlzLl9wcm9jZXNzTWFuYWdlci53cml0ZSh0ZXh0KTtcblx0XHR0aGlzLl9vbkRpZElucHV0RGF0YS5maXJlKHRleHQpO1xuXHRcdHRoaXMuX29uRGlkU2VuZFRleHQuZmlyZSh0ZXh0KTtcblx0XHR0aGlzLnh0ZXJtPy5zY3JvbGxUb0JvdHRvbSgpO1xuXHRcdGlmIChzaG91bGRFeGVjdXRlKSB7XG5cdFx0XHR0aGlzLl9vbkRpZEV4ZWN1dGVUZXh0LmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzZW5kUGF0aChvcmlnaW5hbFBhdGg6IHN0cmluZyB8IFVSSSwgc2hvdWxkRXhlY3V0ZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLnNlbmRUZXh0KGF3YWl0IHRoaXMucHJlcGFyZVBhdGhGb3JTaGVsbChvcmlnaW5hbFBhdGgpLCBzaG91bGRFeGVjdXRlKTtcblx0fVxuXG5cdGFzeW5jIHByZXBhcmVQYXRoRm9yU2hlbGwob3JpZ2luYWxQYXRoOiBzdHJpbmcgfCBVUkkpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdC8vIFdhaXQgZm9yIHNoZWxsIHR5cGUgdG8gYmUgcmVhZHlcblx0XHRhd2FpdCB0aGlzLnByb2Nlc3NSZWFkeTtcblx0XHRyZXR1cm4gcHJlcGFyZVBhdGhGb3JTaGVsbChvcmlnaW5hbFBhdGgsIHRoaXMuc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSwgdGhpcy50aXRsZSwgdGhpcy5zaGVsbFR5cGUsIHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLmJhY2tlbmQsIHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLm9zKTtcblx0fVxuXG5cdHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IGRpZENoYW5nZSA9IHRoaXMuX2lzVmlzaWJsZSAhPT0gdmlzaWJsZTtcblx0XHR0aGlzLl9pc1Zpc2libGUgPSB2aXNpYmxlO1xuXHRcdHRoaXMuX3dyYXBwZXJFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIHZpc2libGUpO1xuXHRcdGlmICh2aXNpYmxlICYmIHRoaXMueHRlcm0pIHtcblx0XHRcdHRoaXMuX29wZW4oKTtcblx0XHRcdC8vIEZsdXNoIGFueSBwZW5kaW5nIHJlc2l6ZXNcblx0XHRcdHRoaXMuX3Jlc2l6ZURlYm91bmNlcj8uZmx1c2goKTtcblx0XHRcdC8vIFJlc2l6ZSB0byByZS1ldmFsdWF0ZSBkaW1lbnNpb25zLCB0aGlzIHdpbGwgZW5zdXJlIHdoZW4gc3dpdGNoaW5nIHRvIGEgdGVybWluYWwgaXQgaXNcblx0XHRcdC8vIHVzaW5nIHRoZSBtb3N0IHVwIHRvIGRhdGUgZGltZW5zaW9ucyAoZWcuIHdoZW4gdGVybWluYWwgaXMgY3JlYXRlZCBpbiB0aGUgYmFja2dyb3VuZFxuXHRcdFx0Ly8gdXNpbmcgY2FjaGVkIGRpbWVuc2lvbnMgb2YgYSBzcGxpdCB0ZXJtaW5hbCkuXG5cdFx0XHR0aGlzLl9yZXNpemUoKTtcblx0XHR9XG5cdFx0aWYgKGRpZENoYW5nZSkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmZpcmUodmlzaWJsZSk7XG5cdFx0fVxuXHR9XG5cblx0c2Nyb2xsRG93bkxpbmUoKTogdm9pZCB7XG5cdFx0dGhpcy54dGVybT8uc2Nyb2xsRG93bkxpbmUoKTtcblx0fVxuXG5cdHNjcm9sbERvd25QYWdlKCk6IHZvaWQge1xuXHRcdHRoaXMueHRlcm0/LnNjcm9sbERvd25QYWdlKCk7XG5cdH1cblxuXHRzY3JvbGxUb0JvdHRvbSgpOiB2b2lkIHtcblx0XHR0aGlzLnh0ZXJtPy5zY3JvbGxUb0JvdHRvbSgpO1xuXHR9XG5cblx0c2Nyb2xsVXBMaW5lKCk6IHZvaWQge1xuXHRcdHRoaXMueHRlcm0/LnNjcm9sbFVwTGluZSgpO1xuXHR9XG5cblx0c2Nyb2xsVXBQYWdlKCk6IHZvaWQge1xuXHRcdHRoaXMueHRlcm0/LnNjcm9sbFVwUGFnZSgpO1xuXHR9XG5cblx0c2Nyb2xsVG9Ub3AoKTogdm9pZCB7XG5cdFx0dGhpcy54dGVybT8uc2Nyb2xsVG9Ub3AoKTtcblx0fVxuXG5cdGNsZWFyQnVmZmVyKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLmNsZWFyQnVmZmVyKCk7XG5cdFx0dGhpcy54dGVybT8uY2xlYXJCdWZmZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZnJlc2hTZWxlY3Rpb25Db250ZXh0S2V5KCkge1xuXHRcdGNvbnN0IGlzQWN0aXZlID0gISF0aGlzLl92aWV3c1NlcnZpY2UuZ2V0QWN0aXZlVmlld1dpdGhJZChURVJNSU5BTF9WSUVXX0lEKTtcblx0XHRsZXQgaXNFZGl0b3JBY3RpdmUgPSBmYWxzZTtcblx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLl9lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcjtcblx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRpc0VkaXRvckFjdGl2ZSA9IGVkaXRvciBpbnN0YW5jZW9mIFRlcm1pbmFsRWRpdG9ySW5wdXQ7XG5cdFx0fVxuXHRcdHRoaXMuX3Rlcm1pbmFsSGFzVGV4dENvbnRleHRLZXkuc2V0KChpc0FjdGl2ZSB8fCBpc0VkaXRvckFjdGl2ZSkgJiYgdGhpcy5oYXNTZWxlY3Rpb24oKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2NyZWF0ZVByb2Nlc3NNYW5hZ2VyKCk6IFRlcm1pbmFsUHJvY2Vzc01hbmFnZXIge1xuXHRcdGxldCBkZXNlcmlhbGl6ZWRDb2xsZWN0aW9uczogUmVhZG9ubHlNYXA8c3RyaW5nLCBJRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24+IHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzPy5lbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnMpIHtcblx0XHRcdGRlc2VyaWFsaXplZENvbGxlY3Rpb25zID0gZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnModGhpcy5zaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcy5lbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbnMpO1xuXHRcdH1cblx0XHRjb25zdCBwcm9jZXNzTWFuYWdlciA9IHRoaXMuX3Njb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0VGVybWluYWxQcm9jZXNzTWFuYWdlcixcblx0XHRcdHRoaXMuX2luc3RhbmNlSWQsXG5cdFx0XHR0aGlzLnNoZWxsTGF1bmNoQ29uZmlnPy5jd2QsXG5cdFx0XHRkZXNlcmlhbGl6ZWRDb2xsZWN0aW9ucyxcblx0XHRcdHRoaXMuc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3M/LnNoZWxsSW50ZWdyYXRpb25Ob25jZVxuXHRcdCk7XG5cdFx0dGhpcy5jYXBhYmlsaXRpZXMuYWRkKHByb2Nlc3NNYW5hZ2VyLmNhcGFiaWxpdGllcyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocHJvY2Vzc01hbmFnZXIub25Qcm9jZXNzUmVhZHkoYXN5bmMgKGUpID0+IHtcblx0XHRcdHRoaXMuX29uUHJvY2Vzc0lkUmVhZHkuZmlyZSh0aGlzKTtcblx0XHRcdHRoaXMuX2luaXRpYWxDd2QgPSBhd2FpdCB0aGlzLmdldEluaXRpYWxDd2QoKTtcblx0XHRcdC8vIFNldCB0aGUgaW5pdGlhbCBuYW1lIGJhc2VkIG9uIHRoZSBfcmVzb2x2ZWRfIHNoZWxsIGxhdW5jaCBjb25maWcsIHRoaXMgd2lsbCBhbHNvXG5cdFx0XHQvLyBlbnN1cmUgdGhlIHJlc29sdmVkIGljb24gZ2V0cyBzaG93blxuXHRcdFx0aWYgKCF0aGlzLl9sYWJlbENvbXB1dGVyKSB7XG5cdFx0XHRcdHRoaXMuX2xhYmVsQ29tcHV0ZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9zY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExhYmVsQ29tcHV0ZXIpKTtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGFiZWxDb21wdXRlci5vbkRpZENoYW5nZUxhYmVsKGUgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHdhc0NoYW5nZWQgPSB0aGlzLl90aXRsZSAhPT0gZS50aXRsZSB8fCB0aGlzLl9kZXNjcmlwdGlvbiAhPT0gZS5kZXNjcmlwdGlvbjtcblx0XHRcdFx0XHRpZiAod2FzQ2hhbmdlZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fdGl0bGUgPSBlLnRpdGxlO1xuXHRcdFx0XHRcdFx0dGhpcy5fZGVzY3JpcHRpb24gPSBlLmRlc2NyaXB0aW9uO1xuXHRcdFx0XHRcdFx0dGhpcy5fb25UaXRsZUNoYW5nZWQuZmlyZSh0aGlzKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5uYW1lKSB7XG5cdFx0XHRcdHRoaXMuX3NldFRpdGxlKHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLm5hbWUsIFRpdGxlRXZlbnRTb3VyY2UuQXBpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIExpc3RlbiB0byB4dGVybS5qcycgc2VxdWVuY2UgdGl0bGUgY2hhbmdlIGV2ZW50LCB0cmlnZ2VyIHRoaXMgYXN5bmMgdG8gZW5zdXJlXG5cdFx0XHRcdC8vIF94dGVybVJlYWR5UHJvbWlzZSBpcyByZWFkeSBjb25zdHJ1Y3RlZCBzaW5jZSB0aGlzIGlzIGNhbGxlZCBmcm9tIHRoZSBjdG9yXG5cdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX3h0ZXJtUmVhZHlQcm9taXNlLnRoZW4oeHRlcm0gPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHh0ZXJtKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX21lc3NhZ2VUaXRsZURpc3Bvc2FibGUudmFsdWUgPSB4dGVybS5yYXcub25UaXRsZUNoYW5nZShlID0+IHRoaXMuX29uVGl0bGVDaGFuZ2UoZSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5fc2V0VGl0bGUodGhpcy5fc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSwgVGl0bGVFdmVudFNvdXJjZS5Qcm9jZXNzKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocHJvY2Vzc01hbmFnZXIub25Qcm9jZXNzRXhpdChleGl0Q29kZSA9PiB0aGlzLl9vblByb2Nlc3NFeGl0KGV4aXRDb2RlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHByb2Nlc3NNYW5hZ2VyLm9uRGlkQ2hhbmdlUHJvcGVydHkoKHsgdHlwZSwgdmFsdWUgfSkgPT4ge1xuXHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdGNhc2UgUHJvY2Vzc1Byb3BlcnR5VHlwZS5Dd2Q6XG5cdFx0XHRcdFx0dGhpcy5fY3dkID0gdmFsdWU7XG5cdFx0XHRcdFx0dGhpcy5fbGFiZWxDb21wdXRlcj8ucmVmcmVzaExhYmVsKHRoaXMpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFByb2Nlc3NQcm9wZXJ0eVR5cGUuSW5pdGlhbEN3ZDpcblx0XHRcdFx0XHR0aGlzLl9pbml0aWFsQ3dkID0gdmFsdWU7XG5cdFx0XHRcdFx0dGhpcy5fY3dkID0gdGhpcy5faW5pdGlhbEN3ZDtcblx0XHRcdFx0XHR0aGlzLl9zZXRUaXRsZSh0aGlzLnRpdGxlLCBUaXRsZUV2ZW50U291cmNlLkNvbmZpZyk7XG5cdFx0XHRcdFx0dGhpcy5faWNvbiA9IHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzPy5pY29uIHx8IHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmljb247XG5cdFx0XHRcdFx0dGhpcy5fb25JY29uQ2hhbmdlZC5maXJlKHsgaW5zdGFuY2U6IHRoaXMsIHVzZXJJbml0aWF0ZWQ6IGZhbHNlIH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFByb2Nlc3NQcm9wZXJ0eVR5cGUuVGl0bGU6XG5cdFx0XHRcdFx0dGhpcy5fc2V0VGl0bGUodmFsdWUgPz8gJycsIFRpdGxlRXZlbnRTb3VyY2UuUHJvY2Vzcyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgUHJvY2Vzc1Byb3BlcnR5VHlwZS5PdmVycmlkZURpbWVuc2lvbnM6XG5cdFx0XHRcdFx0dGhpcy5zZXRPdmVycmlkZURpbWVuc2lvbnModmFsdWUsIHRydWUpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFByb2Nlc3NQcm9wZXJ0eVR5cGUuUmVzb2x2ZWRTaGVsbExhdW5jaENvbmZpZzpcblx0XHRcdFx0XHR0aGlzLl9zZXRSZXNvbHZlZFNoZWxsTGF1bmNoQ29uZmlnKHZhbHVlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBQcm9jZXNzUHJvcGVydHlUeXBlLlNoZWxsVHlwZTpcblx0XHRcdFx0XHR0aGlzLnNldFNoZWxsVHlwZSh2YWx1ZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgUHJvY2Vzc1Byb3BlcnR5VHlwZS5IYXNDaGlsZFByb2Nlc3Nlczpcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUhhc0NoaWxkUHJvY2Vzc2VzLmZpcmUodmFsdWUpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFByb2Nlc3NQcm9wZXJ0eVR5cGUuVXNlZFNoZWxsSW50ZWdyYXRpb25JbmplY3Rpb246XG5cdFx0XHRcdFx0dGhpcy5fdXNlZFNoZWxsSW50ZWdyYXRpb25JbmplY3Rpb24gPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2luaXRpYWxEYXRhRXZlbnRzTGlzdGVuZXIudmFsdWUgPSBwcm9jZXNzTWFuYWdlci5vblByb2Nlc3NEYXRhKGV2ID0+IHRoaXMuX2luaXRpYWxEYXRhRXZlbnRzPy5wdXNoKGV2LmRhdGEpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihwcm9jZXNzTWFuYWdlci5vblByb2Nlc3NSZXBsYXlDb21wbGV0ZSgoKSA9PiB0aGlzLl9vblByb2Nlc3NSZXBsYXlDb21wbGV0ZS5maXJlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihwcm9jZXNzTWFuYWdlci5vbkVudmlyb25tZW50VmFyaWFibGVJbmZvQ2hhbmdlZChlID0+IHRoaXMuX29uRW52aXJvbm1lbnRWYXJpYWJsZUluZm9DaGFuZ2VkKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocHJvY2Vzc01hbmFnZXIub25QdHlEaXNjb25uZWN0KCgpID0+IHtcblx0XHRcdGlmICh0aGlzLnh0ZXJtKSB7XG5cdFx0XHRcdHRoaXMueHRlcm0ucmF3Lm9wdGlvbnMuZGlzYWJsZVN0ZGluID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuc3RhdHVzTGlzdC5hZGQoe1xuXHRcdFx0XHRpZDogVGVybWluYWxTdGF0dXMuRGlzY29ubmVjdGVkLFxuXHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdGljb246IENvZGljb24uZGVidWdEaXNjb25uZWN0LFxuXHRcdFx0XHR0b29sdGlwOiBubHMubG9jYWxpemUoJ2Rpc2Nvbm5lY3RTdGF0dXMnLCBcIkxvc3QgY29ubmVjdGlvbiB0byBwcm9jZXNzXCIpXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocHJvY2Vzc01hbmFnZXIub25QdHlSZWNvbm5lY3QoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMueHRlcm0pIHtcblx0XHRcdFx0dGhpcy54dGVybS5yYXcub3B0aW9ucy5kaXNhYmxlU3RkaW4gPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuc3RhdHVzTGlzdC5yZW1vdmUoVGVybWluYWxTdGF0dXMuRGlzY29ubmVjdGVkKTtcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcHJvY2Vzc01hbmFnZXI7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVQcm9jZXNzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmlzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgYWN0aXZlV29ya3NwYWNlUm9vdFVyaSA9IHRoaXMuX2hpc3RvcnlTZXJ2aWNlLmdldExhc3RBY3RpdmVXb3Jrc3BhY2VSb290KFNjaGVtYXMuZmlsZSk7XG5cdFx0aWYgKGFjdGl2ZVdvcmtzcGFjZVJvb3RVcmkpIHtcblx0XHRcdGNvbnN0IHRydXN0ZWQgPSBhd2FpdCB0aGlzLl90cnVzdCgpO1xuXHRcdFx0aWYgKCF0cnVzdGVkKSB7XG5cdFx0XHRcdHRoaXMuX29uUHJvY2Vzc0V4aXQoeyBtZXNzYWdlOiBubHMubG9jYWxpemUoJ3dvcmtzcGFjZU5vdFRydXN0ZWRDcmVhdGVUZXJtaW5hbCcsIFwiQ2Fubm90IGxhdW5jaCBhIHRlcm1pbmFsIHByb2Nlc3MgaW4gYW4gdW50cnVzdGVkIHdvcmtzcGFjZVwiKSB9KTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHRoaXMuX2N3ZCAmJiB0aGlzLl91c2VySG9tZSAmJiB0aGlzLl9jd2QgIT09IHRoaXMuX3VzZXJIb21lKSB7XG5cdFx0XHQvLyBzb21ldGhpbmcgc3RyYW5nZSBpcyBnb2luZyBvbiBpZiBjd2QgaXMgbm90IHVzZXJIb21lIGluIGFuIGVtcHR5IHdvcmtzcGFjZVxuXHRcdFx0dGhpcy5fb25Qcm9jZXNzRXhpdCh7XG5cdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnd29ya3NwYWNlTm90VHJ1c3RlZENyZWF0ZVRlcm1pbmFsQ3dkJywgXCJDYW5ub3QgbGF1bmNoIGEgdGVybWluYWwgcHJvY2VzcyBpbiBhbiB1bnRydXN0ZWQgd29ya3NwYWNlIHdpdGggY3dkIHswfSBhbmQgdXNlckhvbWUgezF9XCIsIHRoaXMuX2N3ZCwgdGhpcy5fdXNlckhvbWUpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBSZS1ldmFsdWF0ZSBkaW1lbnNpb25zIGlmIHRoZSBjb250YWluZXIgaGFzIGJlZW4gc2V0IHNpbmNlIHRoZSB4dGVybSBpbnN0YW5jZSB3YXMgY3JlYXRlZFxuXHRcdGlmICh0aGlzLl9jb250YWluZXIgJiYgdGhpcy5fY29scyA9PT0gMCAmJiB0aGlzLl9yb3dzID09PSAwKSB7XG5cdFx0XHR0aGlzLl9pbml0RGltZW5zaW9ucygpO1xuXHRcdFx0dGhpcy54dGVybT8ucmF3LnJlc2l6ZSh0aGlzLl9jb2xzIHx8IENvbnN0YW50cy5EZWZhdWx0Q29scywgdGhpcy5fcm93cyB8fCBDb25zdGFudHMuRGVmYXVsdFJvd3MpO1xuXHRcdH1cblx0XHRjb25zdCBvcmlnaW5hbEljb24gPSB0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmljb247XG5cdFx0YXdhaXQgdGhpcy5fcHJvY2Vzc01hbmFnZXIuY3JlYXRlUHJvY2Vzcyh0aGlzLl9zaGVsbExhdW5jaENvbmZpZywgdGhpcy5fY29scyB8fCBDb25zdGFudHMuRGVmYXVsdENvbHMsIHRoaXMuX3Jvd3MgfHwgQ29uc3RhbnRzLkRlZmF1bHRSb3dzKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGlmICgnbWVzc2FnZScgaW4gcmVzdWx0KSB7XG5cdFx0XHRcdFx0dGhpcy5fb25Qcm9jZXNzRXhpdChyZXN1bHQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCdpbmplY3RlZEFyZ3MnIGluIHJlc3VsdCkge1xuXHRcdFx0XHRcdHRoaXMuX2luamVjdGVkQXJncyA9IHJlc3VsdC5pbmplY3RlZEFyZ3M7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZiAodGhpcy5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLnh0ZXJtPy5zaGVsbEludGVncmF0aW9uKSB7XG5cdFx0XHR0aGlzLmNhcGFiaWxpdGllcy5hZGQodGhpcy54dGVybS5zaGVsbEludGVncmF0aW9uLmNhcGFiaWxpdGllcyk7XG5cdFx0fVxuXHRcdGlmIChvcmlnaW5hbEljb24gIT09IHRoaXMuc2hlbGxMYXVuY2hDb25maWcuaWNvbiB8fCB0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmNvbG9yKSB7XG5cdFx0XHR0aGlzLl9pY29uID0gdGhpcy5fc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3M/Lmljb24gfHwgdGhpcy5fc2hlbGxMYXVuY2hDb25maWcuaWNvbjtcblx0XHRcdHRoaXMuX29uSWNvbkNoYW5nZWQuZmlyZSh7IGluc3RhbmNlOiB0aGlzLCB1c2VySW5pdGlhdGVkOiBmYWxzZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJNYXJrZXIob2Zmc2V0PzogbnVtYmVyKTogSU1hcmtlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMueHRlcm0/LnJhdy5yZWdpc3Rlck1hcmtlcihvZmZzZXQpO1xuXHR9XG5cblx0cHVibGljIGFkZEJ1ZmZlck1hcmtlcihwcm9wZXJ0aWVzOiBJTWFya1Byb3BlcnRpZXMpOiB2b2lkIHtcblx0XHR0aGlzLmNhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24pPy5hZGRNYXJrKHByb3BlcnRpZXMpO1xuXHR9XG5cblx0cHVibGljIHNjcm9sbFRvTWFyayhzdGFydE1hcmtJZDogc3RyaW5nLCBlbmRNYXJrSWQ/OiBzdHJpbmcsIGhpZ2hsaWdodD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnh0ZXJtPy5tYXJrVHJhY2tlci5zY3JvbGxUb0Nsb3Nlc3RNYXJrZXIoc3RhcnRNYXJrSWQsIGVuZE1hcmtJZCwgaGlnaGxpZ2h0KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBmcmVlUG9ydEtpbGxQcm9jZXNzKHBvcnQ6IHN0cmluZywgY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcHJvY2Vzc01hbmFnZXI/LmZyZWVQb3J0S2lsbFByb2Nlc3MocG9ydCk7XG5cdFx0dGhpcy5ydW5Db21tYW5kKGNvbW1hbmQsIGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgX29uUHJvY2Vzc0RhdGEoZXY6IElQcm9jZXNzRGF0YUV2ZW50KTogdm9pZCB7XG5cdFx0Ly8gRW5zdXJlIGV2ZW50cyBhcmUgc3BsaXQgYnkgU0kgY29tbWFuZCBleGVjdXRlIGFuZCBjb21tYW5kIGZpbmlzaGVkIHNlcXVlbmNlIHRvIGVuc3VyZSB0aGVcblx0XHQvLyBvdXRwdXQgb2YgdGhlIGNvbW1hbmQgY2FuIGJlIHJlYWQgYnkgZXh0ZW5zaW9ucyBhbmQgdGhlIG91dHB1dCBvZiB0aGUgY29tbWFuZCBpcyBvZiBhXG5cdFx0Ly8gY29uc2lzdGVudCBmb3JtIHJlc3BlY3RpdmVseS4gVGhpcyBtdXN0IGJlIGRvbmUgaGVyZSBhcyB4dGVybS5qcyBkb2VzIG5vdCBjdXJyZW50bHkgaGF2ZVxuXHRcdC8vIGEgbGlzdGVuZXIgZm9yIHdoZW4gaW5kaXZpZHVhbCBkYXRhIGV2ZW50cyBhcmUgcGFyc2VkLCBvbmx5IGBvbldyaXRlUGFyc2VkYCB3aGljaCBmaXJlc1xuXHRcdC8vIHdoZW4gdGhlIHdyaXRlIGJ1ZmZlciBpcyBmbHVzaGVkLlxuXHRcdGNvbnN0IGxlYWRpbmdTZWdtZW50ZWREYXRhOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IG1hdGNoZXMgPSBldi5kYXRhLm1hdGNoQWxsKC8oPzxzZXE+XFx4MWJcXF1bMTZdMzM7KD86Q3xEKD86O1xcZCspPylcXHgwNykvZyk7XG5cdFx0bGV0IGkgPSAwO1xuXHRcdGZvciAoY29uc3QgbWF0Y2ggb2YgbWF0Y2hlcykge1xuXHRcdFx0aWYgKG1hdGNoLmdyb3Vwcz8uc2VxID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignc2VxIG11c3QgYmUgZGVmaW5lZCcpO1xuXHRcdFx0fVxuXHRcdFx0bGVhZGluZ1NlZ21lbnRlZERhdGEucHVzaChldi5kYXRhLnN1YnN0cmluZyhpLCBtYXRjaC5pbmRleCkpO1xuXHRcdFx0bGVhZGluZ1NlZ21lbnRlZERhdGEucHVzaChtYXRjaC5ncm91cHM/LnNlcSA/PyAnJyk7XG5cdFx0XHRpID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG5cdFx0fVxuXHRcdGNvbnN0IGxhc3REYXRhID0gZXYuZGF0YS5zdWJzdHJpbmcoaSk7XG5cblx0XHQvLyBXcml0ZSBhbGwgbGVhZGluZyBzZWdtZW50ZWQgZGF0YSBmaXJzdCwgZm9sbG93ZWQgYnkgdGhlIGxhc3QgZGF0YSwgdHJhY2tpbmcgY29tbWl0IGlmXG5cdFx0Ly8gbmVjZXNzYXJ5XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZWFkaW5nU2VnbWVudGVkRGF0YS5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5fd3JpdGVQcm9jZXNzRGF0YShsZWFkaW5nU2VnbWVudGVkRGF0YVtpXSk7XG5cdFx0fVxuXHRcdGlmIChldi50cmFja0NvbW1pdCkge1xuXHRcdFx0ZXYud3JpdGVQcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4ociA9PiB0aGlzLl93cml0ZVByb2Nlc3NEYXRhKGxhc3REYXRhLCByKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3dyaXRlUHJvY2Vzc0RhdGEobGFzdERhdGEpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3dyaXRlUHJvY2Vzc0RhdGEoZGF0YTogc3RyaW5nLCBjYj86ICgpID0+IHZvaWQpIHtcblx0XHR0aGlzLl9vbldpbGxEYXRhLmZpcmUoZGF0YSk7XG5cdFx0Y29uc3QgbWVzc2FnZUlkID0gKyt0aGlzLl9sYXRlc3RYdGVybVdyaXRlRGF0YTtcblx0XHR0aGlzLnh0ZXJtPy5yYXcud3JpdGUoZGF0YSwgKCkgPT4ge1xuXHRcdFx0dGhpcy5fbGF0ZXN0WHRlcm1QYXJzZURhdGEgPSBtZXNzYWdlSWQ7XG5cdFx0XHR0aGlzLl9wcm9jZXNzTWFuYWdlci5hY2tub3dsZWRnZURhdGFFdmVudChkYXRhLmxlbmd0aCk7XG5cdFx0XHRjYj8uKCk7XG5cdFx0XHR0aGlzLl9vbkRhdGEuZmlyZShkYXRhKTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2hlbiBlaXRoZXIgYSBwcm9jZXNzIHRpZWQgdG8gYSB0ZXJtaW5hbCBoYXMgZXhpdGVkIG9yIHdoZW4gYSB0ZXJtaW5hbCByZW5kZXJlclxuXHQgKiBzaW11bGF0ZXMgYSBwcm9jZXNzIGV4aXRpbmcgKGUuZy4gY3VzdG9tIGV4ZWN1dGlvbiB0YXNrKS5cblx0ICogQHBhcmFtIGV4aXRDb2RlIFRoZSBleGl0IGNvZGUgb2YgdGhlIHByb2Nlc3MsIHRoaXMgaXMgdW5kZWZpbmVkIHdoZW4gdGhlIHRlcm1pbmFsIHdhcyBleGl0ZWRcblx0ICogdGhyb3VnaCB1c2VyIGFjdGlvbi5cblx0ICovXG5cdHByaXZhdGUgYXN5bmMgX29uUHJvY2Vzc0V4aXQoZXhpdENvZGVPckVycm9yPzogbnVtYmVyIHwgSVRlcm1pbmFsTGF1bmNoRXJyb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBQcmV2ZW50IGRpc3Bvc2UgZnVuY3Rpb25zIGJlaW5nIHRyaWdnZXJlZCBtdWx0aXBsZSB0aW1lc1xuXHRcdGlmICh0aGlzLl9pc0V4aXRpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcGFyc2VkRXhpdFJlc3VsdCA9IHBhcnNlRXhpdFJlc3VsdChleGl0Q29kZU9yRXJyb3IsIHRoaXMuc2hlbGxMYXVuY2hDb25maWcsIHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLnByb2Nlc3NTdGF0ZSwgdGhpcy5faW5pdGlhbEN3ZCk7XG5cblx0XHRpZiAodGhpcy5fdXNlZFNoZWxsSW50ZWdyYXRpb25JbmplY3Rpb24gJiYgdGhpcy5fcHJvY2Vzc01hbmFnZXIucHJvY2Vzc1N0YXRlID09PSBQcm9jZXNzU3RhdGUuS2lsbGVkRHVyaW5nTGF1bmNoICYmIHBhcnNlZEV4aXRSZXN1bHQ/LmNvZGUgIT09IDApIHtcblx0XHRcdHRoaXMuX3JlbGF1bmNoV2l0aFNoZWxsSW50ZWdyYXRpb25EaXNhYmxlZChwYXJzZWRFeGl0UmVzdWx0Py5tZXNzYWdlKTtcblx0XHRcdHRoaXMuX29uRXhpdC5maXJlKGV4aXRDb2RlT3JFcnJvcik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5faXNFeGl0aW5nID0gdHJ1ZTtcblxuXHRcdGF3YWl0IHRoaXMuX2ZsdXNoWHRlcm1EYXRhKCk7XG5cblx0XHR0aGlzLl9leGl0Q29kZSA9IHBhcnNlZEV4aXRSZXN1bHQ/LmNvZGU7XG5cdFx0Y29uc3QgZXhpdE1lc3NhZ2UgPSBwYXJzZWRFeGl0UmVzdWx0Py5tZXNzYWdlO1xuXG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnVGVybWluYWwgcHJvY2VzcyBleGl0JywgJ2luc3RhbmNlSWQnLCB0aGlzLmluc3RhbmNlSWQsICdjb2RlJywgdGhpcy5fZXhpdENvZGUsICdwcm9jZXNzU3RhdGUnLCB0aGlzLl9wcm9jZXNzTWFuYWdlci5wcm9jZXNzU3RhdGUpO1xuXG5cdFx0Ly8gT25seSB0cmlnZ2VyIHdhaXQgb24gZXhpdCB3aGVuIHRoZSBleGl0IHdhcyAqbm90KiB0cmlnZ2VyZWQgYnkgdGhlXG5cdFx0Ly8gdXNlciAodmlhIHRoZSBgd29ya2JlbmNoLmFjdGlvbi50ZXJtaW5hbC5raWxsYCBjb21tYW5kKS5cblx0XHRjb25zdCB3YWl0T25FeGl0ID0gdGhpcy53YWl0T25FeGl0O1xuXHRcdGlmICh3YWl0T25FeGl0ICYmIHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLnByb2Nlc3NTdGF0ZSAhPT0gUHJvY2Vzc1N0YXRlLktpbGxlZEJ5VXNlcikge1xuXHRcdFx0dGhpcy5feHRlcm1SZWFkeVByb21pc2UudGhlbih4dGVybSA9PiB7XG5cdFx0XHRcdGlmICgheHRlcm0pIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGV4aXRNZXNzYWdlKSB7XG5cdFx0XHRcdFx0eHRlcm0ucmF3LndyaXRlKGZvcm1hdE1lc3NhZ2VGb3JUZXJtaW5hbChleGl0TWVzc2FnZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN3aXRjaCAodHlwZW9mIHdhaXRPbkV4aXQpIHtcblx0XHRcdFx0XHRjYXNlICdzdHJpbmcnOlxuXHRcdFx0XHRcdFx0eHRlcm0ucmF3LndyaXRlKGZvcm1hdE1lc3NhZ2VGb3JUZXJtaW5hbCh3YWl0T25FeGl0LCB7IGV4Y2x1ZGVMZWFkaW5nTmV3TGluZTogdHJ1ZSB9KSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdmdW5jdGlvbic6XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5leGl0Q29kZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRcdHh0ZXJtLnJhdy53cml0ZShmb3JtYXRNZXNzYWdlRm9yVGVybWluYWwod2FpdE9uRXhpdCh0aGlzLmV4aXRDb2RlKSwgeyBleGNsdWRlTGVhZGluZ05ld0xpbmU6IHRydWUgfSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gRGlzYWJsZSBhbGwgaW5wdXQgaWYgdGhlIHRlcm1pbmFsIGlzIGV4aXRpbmcgYW5kIGxpc3RlbiBmb3IgbmV4dCBrZXlwcmVzc1xuXHRcdFx0XHR4dGVybS5yYXcub3B0aW9ucy5kaXNhYmxlU3RkaW4gPSB0cnVlO1xuXHRcdFx0XHRpZiAoeHRlcm0ucmF3LnRleHRhcmVhKSB7XG5cdFx0XHRcdFx0dGhpcy5fYXR0YWNoUHJlc3NBbnlLZXlUb0Nsb3NlTGlzdGVuZXIoeHRlcm0ucmF3KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChleGl0TWVzc2FnZSkge1xuXHRcdFx0XHRjb25zdCBmYWlsZWREdXJpbmdMYXVuY2ggPSB0aGlzLl9wcm9jZXNzTWFuYWdlci5wcm9jZXNzU3RhdGUgPT09IFByb2Nlc3NTdGF0ZS5LaWxsZWREdXJpbmdMYXVuY2g7XG5cdFx0XHRcdGlmIChmYWlsZWREdXJpbmdMYXVuY2ggfHwgKHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLnNob3dFeGl0QWxlcnQgJiYgdGhpcy54dGVybT8ubGFzdElucHV0RXZlbnQgIT09IC8qQ3RybCtEKi8nXFx4MDQnKSkge1xuXHRcdFx0XHRcdC8vIEFsd2F5cyBzaG93IGxhdW5jaCBmYWlsdXJlc1xuXHRcdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IGV4aXRNZXNzYWdlLFxuXHRcdFx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRcdFx0YWN0aW9uczogeyBwcmltYXJ5OiBbdGhpcy5fc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMYXVuY2hIZWxwQWN0aW9uKV0gfVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIExvZyB0byBoZWxwIHN1cmZhY2UgdGhlIGVycm9yIGluIGNhc2UgdXNlcnMgcmVwb3J0IGlzc3VlcyB3aXRoIHNob3dFeGl0QWxlcnRcblx0XHRcdFx0XHQvLyBkaXNhYmxlZFxuXHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihleGl0TWVzc2FnZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuZGlzcG9zZShUZXJtaW5hbEV4aXRSZWFzb24uUHJvY2Vzcyk7XG5cdFx0fVxuXG5cdFx0Ly8gRmlyc3Qgb25FeGl0IHRvIGNvbnN1bWVycywgdGhpcyBjYW4gaGFwcGVuIGFmdGVyIHRoZSB0ZXJtaW5hbCBoYXMgYWxyZWFkeSBiZWVuIGRpc3Bvc2VkLlxuXHRcdHRoaXMuX29uRXhpdC5maXJlKGV4aXRDb2RlT3JFcnJvcik7XG5cblx0XHQvLyBEaXNwb3NlIG9mIHRoZSBvbkV4aXQgZXZlbnQgaWYgdGhlIHRlcm1pbmFsIHdpbGwgbm90IGJlIHJldXNlZCBhZ2FpblxuXHRcdGlmICh0aGlzLmlzRGlzcG9zZWQpIHtcblx0XHRcdHRoaXMuX29uRXhpdC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVsYXVuY2hXaXRoU2hlbGxJbnRlZ3JhdGlvbkRpc2FibGVkKGV4aXRNZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5pZ25vcmVTaGVsbEludGVncmF0aW9uID0gdHJ1ZTtcblx0XHR0aGlzLnJlbGF1bmNoKCk7XG5cdFx0dGhpcy5zdGF0dXNMaXN0LmFkZCh7XG5cdFx0XHRpZDogVGVybWluYWxTdGF0dXMuU2hlbGxJbnRlZ3JhdGlvbkF0dGVudGlvbk5lZWRlZCxcblx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0aWNvbjogQ29kaWNvbi53YXJuaW5nLFxuXHRcdFx0dG9vbHRpcDogYCR7ZXhpdE1lc3NhZ2V9IGAgKyBubHMubG9jYWxpemUoJ2xhdW5jaEZhaWxlZC5leGl0Q29kZU9ubHlTaGVsbEludGVncmF0aW9uJywgJ0Rpc2FibGluZyBzaGVsbCBpbnRlZ3JhdGlvbiBpbiB1c2VyIHNldHRpbmdzIG1pZ2h0IGhlbHAuJyksXG5cdFx0XHRob3ZlckFjdGlvbnM6IFt7XG5cdFx0XHRcdGNvbW1hbmRJZDogVGVybWluYWxDb21tYW5kSWQuU2hlbGxJbnRlZ3JhdGlvbkxlYXJuTW9yZSxcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnc2hlbGxJbnRlZ3JhdGlvbi5sZWFybk1vcmUnLCBcIkxlYXJuIG1vcmUgYWJvdXQgc2hlbGwgaW50ZWdyYXRpb25cIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX29wZW5lclNlcnZpY2Uub3BlbignaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy9lZGl0b3IvaW50ZWdyYXRlZC10ZXJtaW5hbCNfc2hlbGwtaW50ZWdyYXRpb24nKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwge1xuXHRcdFx0XHRjb21tYW5kSWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5TZXR0aW5ncycsXG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3NoZWxsSW50ZWdyYXRpb24ub3BlblNldHRpbmdzJywgXCJPcGVuIHVzZXIgc2V0dGluZ3NcIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLm9wZW5TZXR0aW5ncycsICd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnNoZWxsSW50ZWdyYXRpb24uZW5hYmxlZCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XVxuXHRcdH0pO1xuXHRcdHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjx7fSwgeyBvd25lcjogJ21lZ2Fucm9nZ2UnOyBjb21tZW50OiAnSW5kaWNhdGVzIHRoZSBwcm9jZXNzIGV4aXRlZCB3aGVuIGNyZWF0ZWQgd2l0aCBzaGVsbCBpbnRlZ3JhdGlvbiBhcmdzJyB9PigndGVybWluYWwvc2hlbGxJbnRlZ3JhdGlvbkZhaWx1cmVQcm9jZXNzRXhpdCcpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEVuc3VyZSB3cml0ZSBjYWxscyB0byB4dGVybS5qcyBoYXZlIGZpbmlzaGVkIGJlZm9yZSByZXNvbHZpbmcuXG5cdCAqL1xuXHRwcml2YXRlIF9mbHVzaFh0ZXJtRGF0YSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5fbGF0ZXN0WHRlcm1Xcml0ZURhdGEgPT09IHRoaXMuX2xhdGVzdFh0ZXJtUGFyc2VEYXRhKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXHRcdGxldCByZXRyaWVzID0gMDtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4ociA9PiB7XG5cdFx0XHRjb25zdCBpbnRlcnZhbCA9IGRvbS5kaXNwb3NhYmxlV2luZG93SW50ZXJ2YWwoZG9tLmdldEFjdGl2ZVdpbmRvdygpLndpbmRvdywgKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fbGF0ZXN0WHRlcm1Xcml0ZURhdGEgPT09IHRoaXMuX2xhdGVzdFh0ZXJtUGFyc2VEYXRhIHx8ICsrcmV0cmllcyA9PT0gNSkge1xuXHRcdFx0XHRcdGludGVydmFsLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDIwKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX2F0dGFjaFByZXNzQW55S2V5VG9DbG9zZUxpc3RlbmVyKHh0ZXJtOiBYVGVybVRlcm1pbmFsKSB7XG5cdFx0aWYgKHh0ZXJtLnRleHRhcmVhICYmICF0aGlzLl9wcmVzc0FueUtleVRvQ2xvc2VMaXN0ZW5lcikge1xuXHRcdFx0dGhpcy5fcHJlc3NBbnlLZXlUb0Nsb3NlTGlzdGVuZXIgPSBkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHh0ZXJtLnRleHRhcmVhLCAna2V5cHJlc3MnLCAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX3ByZXNzQW55S2V5VG9DbG9zZUxpc3RlbmVyKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJlc3NBbnlLZXlUb0Nsb3NlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMuX3ByZXNzQW55S2V5VG9DbG9zZUxpc3RlbmVyID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHRoaXMuZGlzcG9zZShUZXJtaW5hbEV4aXRSZWFzb24uUHJvY2Vzcyk7XG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfd3JpdGVJbml0aWFsVGV4dCh4dGVybTogWHRlcm1UZXJtaW5hbCwgY2FsbGJhY2s/OiAoKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5pbml0aWFsVGV4dCkge1xuXHRcdFx0Y2FsbGJhY2s/LigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB0ZXh0ID0gdHlwZW9mIHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmluaXRpYWxUZXh0ID09PSAnc3RyaW5nJ1xuXHRcdFx0PyB0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5pbml0aWFsVGV4dFxuXHRcdFx0OiB0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5pbml0aWFsVGV4dD8udGV4dDtcblx0XHRpZiAodHlwZW9mIHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmluaXRpYWxUZXh0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0eHRlcm0ucmF3LndyaXRlbG4odGV4dCwgY2FsbGJhY2spO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodGhpcy5fc2hlbGxMYXVuY2hDb25maWcuaW5pdGlhbFRleHQudHJhaWxpbmdOZXdMaW5lKSB7XG5cdFx0XHRcdHh0ZXJtLnJhdy53cml0ZWxuKHRleHQsIGNhbGxiYWNrKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHh0ZXJtLnJhdy53cml0ZSh0ZXh0LCBjYWxsYmFjayk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmV1c2VUZXJtaW5hbChzaGVsbDogSVNoZWxsTGF1bmNoQ29uZmlnLCByZXNldDogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gVW5zdWJzY3JpYmUgYW55IGtleSBsaXN0ZW5lciB3ZSBtYXkgaGF2ZS5cblx0XHR0aGlzLl9wcmVzc0FueUtleVRvQ2xvc2VMaXN0ZW5lcj8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3ByZXNzQW55S2V5VG9DbG9zZUxpc3RlbmVyID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgeHRlcm0gPSB0aGlzLnh0ZXJtO1xuXHRcdGlmICh4dGVybSkge1xuXHRcdFx0aWYgKCFyZXNldCkge1xuXHRcdFx0XHQvLyBFbnN1cmUgbmV3IHByb2Nlc3Nlcycgb3V0cHV0IHN0YXJ0cyBhdCBzdGFydCBvZiBuZXcgbGluZVxuXHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyID0+IHh0ZXJtLnJhdy53cml0ZSgnXFxuXFx4MWJbRycsIHIpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUHJpbnQgaW5pdGlhbFRleHQgaWYgc3BlY2lmaWVkXG5cdFx0XHRpZiAoc2hlbGwuaW5pdGlhbFRleHQpIHtcblx0XHRcdFx0dGhpcy5fc2hlbGxMYXVuY2hDb25maWcuaW5pdGlhbFRleHQgPSBzaGVsbC5pbml0aWFsVGV4dDtcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ociA9PiB0aGlzLl93cml0ZUluaXRpYWxUZXh0KHh0ZXJtLCByKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENsZWFuIHVwIHdhaXRPbkV4aXQgc3RhdGVcblx0XHRcdGlmICh0aGlzLl9pc0V4aXRpbmcgJiYgdGhpcy5fc2hlbGxMYXVuY2hDb25maWcud2FpdE9uRXhpdCkge1xuXHRcdFx0XHR4dGVybS5yYXcub3B0aW9ucy5kaXNhYmxlU3RkaW4gPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5faXNFeGl0aW5nID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzZXQpIHtcblx0XHRcdFx0eHRlcm0uY2xlYXJEZWNvcmF0aW9ucygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIERpc3Bvc2UgdGhlIGVudmlyb25tZW50IGluZm8gd2lkZ2V0IGlmIGl0IGV4aXN0c1xuXHRcdHRoaXMuc3RhdHVzTGlzdC5yZW1vdmUoVGVybWluYWxTdGF0dXMuUmVsYXVuY2hOZWVkZWQpO1xuXG5cdFx0aWYgKCFyZXNldCkge1xuXHRcdFx0Ly8gSEFDSzogRm9yY2UgaW5pdGlhbFRleHQgdG8gYmUgbm9uLWZhbHN5IGZvciByZXVzZWQgdGVybWluYWxzIHN1Y2ggdGhhdCB0aGVcblx0XHRcdC8vIGNvbnB0eUluaGVyaXRDdXJzb3IgZmxhZyBpcyBwYXNzZWQgdG8gdGhlIG5vZGUtcHR5LCB0aGlzIGZsYWcgY2FuIGNhdXNlIGEgV2luZG93IHRvIHN0b3Bcblx0XHRcdC8vIHJlc3BvbmRpbmcgaW4gV2luZG93cyAxMCAxOTAzIHNvIHdlIG9ubHkgd2FudCB0byB1c2UgaXQgd2hlbiBzb21ldGhpbmcgaXMgZGVmaW5pdGVseSB3cml0dGVuXG5cdFx0XHQvLyB0byB0aGUgdGVybWluYWwuXG5cdFx0XHRzaGVsbC5pbml0aWFsVGV4dCA9ICcgJztcblx0XHR9XG5cblx0XHQvLyBTZXQgdGhlIG5ldyBzaGVsbCBsYXVuY2ggY29uZmlnXG5cdFx0dGhpcy5fc2hlbGxMYXVuY2hDb25maWcgPSBzaGVsbDsgLy8gTXVzdCBiZSBkb25lIGJlZm9yZSBjYWxsaW5nIF9jcmVhdGVQcm9jZXNzKClcblx0XHRhd2FpdCB0aGlzLl9wcm9jZXNzTWFuYWdlci5yZWxhdW5jaCh0aGlzLl9zaGVsbExhdW5jaENvbmZpZywgdGhpcy5fY29scyB8fCBDb25zdGFudHMuRGVmYXVsdENvbHMsIHRoaXMuX3Jvd3MgfHwgQ29uc3RhbnRzLkRlZmF1bHRSb3dzLCByZXNldCkudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRpZiAoJ21lc3NhZ2UnIGluIHJlc3VsdCkge1xuXHRcdFx0XHRcdHRoaXMuX29uUHJvY2Vzc0V4aXQocmVzdWx0KTtcblx0XHRcdFx0fSBlbHNlIGlmICgnaW5qZWN0ZWRBcmdzJyBpbiByZXN1bHQpIHtcblx0XHRcdFx0XHR0aGlzLl9pbmplY3RlZEFyZ3MgPSByZXN1bHQuaW5qZWN0ZWRBcmdzO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRAZGVib3VuY2UoMTAwMClcblx0cmVsYXVuY2goKTogdm9pZCB7XG5cdFx0dGhpcy5yZXVzZVRlcm1pbmFsKHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLCB0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgX29uVGl0bGVDaGFuZ2UodGl0bGU6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzVGl0bGVTZXRCeVByb2Nlc3MpIHtcblx0XHRcdHRoaXMuX3NldFRpdGxlKHRpdGxlLCBUaXRsZUV2ZW50U291cmNlLlNlcXVlbmNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF90cnVzdCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gKGF3YWl0IHRoaXMuX3dvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UucmVxdWVzdFdvcmtzcGFjZVRydXN0KFxuXHRcdFx0e1xuXHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ3Rlcm1pbmFsLnJlcXVlc3RUcnVzdCcsIFwiQ3JlYXRpbmcgYSB0ZXJtaW5hbCBwcm9jZXNzIHJlcXVpcmVzIGV4ZWN1dGluZyBjb2RlXCIpXG5cdFx0XHR9KSkgPT09IHRydWU7XG5cdH1cblxuXHRAZGVib3VuY2UoMjAwMClcblx0cHJpdmF0ZSBhc3luYyBfdXBkYXRlUHJvY2Vzc0N3ZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5pc0Rpc3Bvc2VkIHx8IHRoaXMuc2hlbGxMYXVuY2hDb25maWcuY3VzdG9tUHR5SW1wbGVtZW50YXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gcmVzZXQgY3dkIGlmIGl0IGhhcyBjaGFuZ2VkLCBzbyBmaWxlIGJhc2VkIHVybCBwYXRocyBjYW4gYmUgcmVzb2x2ZWRcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY3dkID0gYXdhaXQgdGhpcy5fcmVmcmVzaFByb3BlcnR5KFByb2Nlc3NQcm9wZXJ0eVR5cGUuQ3dkKTtcblx0XHRcdGlmICh0eXBlb2YgY3dkICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGN3ZCBpcyBub3QgYSBzdHJpbmcgJHtjd2R9YCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZTogdW5rbm93bikge1xuXHRcdFx0Ly8gU3dhbGxvdyB0aGlzIGFzIGl0IG1lYW5zIHRoZSBwcm9jZXNzIGhhcyBiZWVuIGtpbGxlZFxuXHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm1lc3NhZ2UgPT09ICdDYW5ub3QgcmVmcmVzaCBwcm9wZXJ0eSB3aGVuIHByb2Nlc3MgaXMgbm90IHNldCcpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH1cblxuXHR1cGRhdGVDb25maWcoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2V0Q29tbWFuZHNUb1NraXBTaGVsbCh0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5jb21tYW5kc1RvU2tpcFNoZWxsKTtcblx0XHR0aGlzLl9yZWZyZXNoRW52aXJvbm1lbnRWYXJpYWJsZUluZm9XaWRnZXRTdGF0ZSh0aGlzLl9wcm9jZXNzTWFuYWdlci5lbnZpcm9ubWVudFZhcmlhYmxlSW5mbyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVVbmljb2RlVmVyc2lvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9wcm9jZXNzTWFuYWdlci5zZXRVbmljb2RlVmVyc2lvbih0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy51bmljb2RlVmVyc2lvbik7XG5cdH1cblxuXHR1cGRhdGVBY2Nlc3NpYmlsaXR5U3VwcG9ydCgpOiB2b2lkIHtcblx0XHR0aGlzLnh0ZXJtIS5yYXcub3B0aW9ucy5zY3JlZW5SZWFkZXJNb2RlID0gdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldENvbW1hbmRzVG9Ta2lwU2hlbGwoY29tbWFuZHM6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0Y29uc3QgZXhjbHVkZUNvbW1hbmRzID0gY29tbWFuZHMuZmlsdGVyKGNvbW1hbmQgPT4gY29tbWFuZFswXSA9PT0gJy0nKS5tYXAoY29tbWFuZCA9PiBjb21tYW5kLnNsaWNlKDEpKTtcblx0XHR0aGlzLl9za2lwVGVybWluYWxDb21tYW5kcyA9IERFRkFVTFRfQ09NTUFORFNfVE9fU0tJUF9TSEVMTC5maWx0ZXIoZGVmYXVsdENvbW1hbmQgPT4ge1xuXHRcdFx0cmV0dXJuICFleGNsdWRlQ29tbWFuZHMuaW5jbHVkZXMoZGVmYXVsdENvbW1hbmQpO1xuXHRcdH0pLmNvbmNhdChjb21tYW5kcyk7XG5cdH1cblxuXHRsYXlvdXQoZGltZW5zaW9uOiBkb20uRGltZW5zaW9uKTogdm9pZCB7XG5cdFx0dGhpcy5fbGFzdExheW91dERpbWVuc2lvbnMgPSBkaW1lbnNpb247XG5cdFx0aWYgKHRoaXMuZGlzYWJsZUxheW91dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIERvbid0IGxheW91dCBpZiBkaW1lbnNpb25zIGFyZSBpbnZhbGlkIChlZy4gdGhlIGNvbnRhaW5lciBpcyBub3QgYXR0YWNoZWQgdG8gdGhlIERPTSBvclxuXHRcdC8vIGlmIGRpc3BsYXk6IG5vbmVcblx0XHRpZiAoZGltZW5zaW9uLndpZHRoIDw9IDAgfHwgZGltZW5zaW9uLmhlaWdodCA8PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRXZhbHVhdGUgY29sdW1ucyBhbmQgcm93cywgZXhjbHVkZSB0aGUgd3JhcHBlciBlbGVtZW50J3MgbWFyZ2luXG5cdFx0Y29uc3QgdGVybWluYWxXaWR0aCA9IHRoaXMuX2V2YWx1YXRlQ29sc0FuZFJvd3MoZGltZW5zaW9uLndpZHRoLCBkaW1lbnNpb24uaGVpZ2h0KTtcblx0XHRpZiAoIXRlcm1pbmFsV2lkdGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9yZXNpemUoKTtcblxuXHRcdC8vIFNpZ25hbCB0aGUgY29udGFpbmVyIGlzIHJlYWR5XG5cdFx0aWYgKCF0aGlzLl9jb250YWluZXJSZWFkeUJhcnJpZXIuaXNPcGVuKCkpIHtcblx0XHRcdHRoaXMuX2NvbnRhaW5lclJlYWR5QmFycmllci5vcGVuKCk7XG5cdFx0fVxuXG5cdFx0Ly8gTGF5b3V0IGFsbCBjb250cmlidXRpb25zXG5cdFx0Zm9yIChjb25zdCBjb250cmlidXRpb24gb2YgdGhpcy5fY29udHJpYnV0aW9ucy52YWx1ZXMoKSkge1xuXHRcdFx0aWYgKCF0aGlzLnh0ZXJtKSB7XG5cdFx0XHRcdHRoaXMuX3h0ZXJtUmVhZHlQcm9taXNlLnRoZW4oeHRlcm0gPT4ge1xuXHRcdFx0XHRcdGlmICh4dGVybSkge1xuXHRcdFx0XHRcdFx0Y29udHJpYnV0aW9uLmxheW91dD8uKHh0ZXJtLCBkaW1lbnNpb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250cmlidXRpb24ubGF5b3V0Py4odGhpcy54dGVybSwgZGltZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXNpemUoaW1tZWRpYXRlPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy54dGVybSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBjb2xzID0gdGhpcy5jb2xzO1xuXHRcdGxldCByb3dzID0gdGhpcy5yb3dzO1xuXG5cdFx0Ly8gT25seSBhcHBseSB0aGVzZSBzZXR0aW5ncyB3aGVuIHRoZSB0ZXJtaW5hbCBpcyB2aXNpYmxlIHNvIHRoYXRcblx0XHQvLyB0aGUgY2hhcmFjdGVycyBhcmUgbWVhc3VyZWQgY29ycmVjdGx5LlxuXHRcdGlmICh0aGlzLl9pc1Zpc2libGUgJiYgdGhpcy5fbGF5b3V0U2V0dGluZ3NDaGFuZ2VkKSB7XG5cdFx0XHRjb25zdCBmb250ID0gdGhpcy54dGVybS5nZXRGb250KCk7XG5cdFx0XHRjb25zdCBjb25maWcgPSB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZztcblx0XHRcdHRoaXMueHRlcm0ucmF3Lm9wdGlvbnMubGV0dGVyU3BhY2luZyA9IGZvbnQubGV0dGVyU3BhY2luZztcblx0XHRcdHRoaXMueHRlcm0ucmF3Lm9wdGlvbnMubGluZUhlaWdodCA9IGZvbnQubGluZUhlaWdodDtcblx0XHRcdHRoaXMueHRlcm0ucmF3Lm9wdGlvbnMuZm9udFNpemUgPSBmb250LmZvbnRTaXplO1xuXHRcdFx0dGhpcy54dGVybS5yYXcub3B0aW9ucy5mb250RmFtaWx5ID0gZm9udC5mb250RmFtaWx5O1xuXHRcdFx0dGhpcy54dGVybS5yYXcub3B0aW9ucy5mb250V2VpZ2h0ID0gY29uZmlnLmZvbnRXZWlnaHQ7XG5cdFx0XHR0aGlzLnh0ZXJtLnJhdy5vcHRpb25zLmZvbnRXZWlnaHRCb2xkID0gY29uZmlnLmZvbnRXZWlnaHRCb2xkO1xuXG5cdFx0XHQvLyBBbnkgb2YgdGhlIGFib3ZlIHNldHRpbmcgY2hhbmdlcyBjb3VsZCBoYXZlIGNoYW5nZWQgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG5cdFx0XHQvLyB0ZXJtaW5hbCwgcmUtZXZhbHVhdGUgbm93LlxuXHRcdFx0dGhpcy5faW5pdERpbWVuc2lvbnMoKTtcblx0XHRcdGNvbHMgPSB0aGlzLmNvbHM7XG5cdFx0XHRyb3dzID0gdGhpcy5yb3dzO1xuXG5cdFx0XHR0aGlzLl9sYXlvdXRTZXR0aW5nc0NoYW5nZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoaXNOYU4oY29scykgfHwgaXNOYU4ocm93cykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoY29scyAhPT0gdGhpcy54dGVybS5yYXcuY29scyB8fCByb3dzICE9PSB0aGlzLnh0ZXJtLnJhdy5yb3dzKSB7XG5cdFx0XHRpZiAodGhpcy5fZml4ZWRSb3dzIHx8IHRoaXMuX2ZpeGVkQ29scykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl91cGRhdGVQcm9wZXJ0eShQcm9jZXNzUHJvcGVydHlUeXBlLkZpeGVkRGltZW5zaW9ucywgeyBjb2xzOiB0aGlzLl9maXhlZENvbHMsIHJvd3M6IHRoaXMuX2ZpeGVkUm93cyB9KTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX29uRGltZW5zaW9uc0NoYW5nZWQuZmlyZSgpO1xuXHRcdH1cblxuXHRcdFRlcm1pbmFsSW5zdGFuY2UuX2xhc3RLbm93bkdyaWREaW1lbnNpb25zID0geyBjb2xzLCByb3dzIH07XG5cdFx0dGhpcy5fcmVzaXplRGVib3VuY2VyIS5yZXNpemUoY29scywgcm93cywgaW1tZWRpYXRlID8/IGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3VwZGF0ZVB0eURpbWVuc2lvbnMocmF3WHRlcm06IFhUZXJtVGVybWluYWwpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9wcm9jZXNzTWFuYWdlci5zZXREaW1lbnNpb25zKHJhd1h0ZXJtLmNvbHMsIHJhd1h0ZXJtLnJvd3MpO1xuXHR9XG5cblx0c2V0U2hlbGxUeXBlKHNoZWxsVHlwZTogVGVybWluYWxTaGVsbFR5cGUgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5fc2hlbGxUeXBlID09PSBzaGVsbFR5cGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHNoZWxsVHlwZSkge1xuXHRcdFx0dGhpcy5fc2hlbGxUeXBlID0gc2hlbGxUeXBlO1xuXHRcdFx0dGhpcy5fdGVybWluYWxTaGVsbFR5cGVDb250ZXh0S2V5LnNldChzaGVsbFR5cGU/LnRvU3RyaW5nKCkpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTaGVsbFR5cGUuZmlyZShzaGVsbFR5cGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NldEFyaWFMYWJlbCh4dGVybTogWFRlcm1UZXJtaW5hbCB8IHVuZGVmaW5lZCwgdGVybWluYWxJZDogbnVtYmVyLCB0aXRsZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgbGFiZWxQYXJ0czogc3RyaW5nW10gPSBbXTtcblx0XHRpZiAoeHRlcm0gJiYgeHRlcm0udGV4dGFyZWEpIHtcblx0XHRcdGlmICh0aXRsZSAmJiB0aXRsZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGxhYmVsUGFydHMucHVzaChubHMubG9jYWxpemUoJ3Rlcm1pbmFsVGV4dEJveEFyaWFMYWJlbE51bWJlckFuZFRpdGxlJywgXCJUZXJtaW5hbCB7MH0sIHsxfVwiLCB0ZXJtaW5hbElkLCB0aXRsZSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGFiZWxQYXJ0cy5wdXNoKG5scy5sb2NhbGl6ZSgndGVybWluYWxUZXh0Qm94QXJpYUxhYmVsJywgXCJUZXJtaW5hbCB7MH1cIiwgdGVybWluYWxJZCkpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc2NyZWVuUmVhZGVyT3B0aW1pemVkID0gdGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKTtcblx0XHRcdGlmICghc2NyZWVuUmVhZGVyT3B0aW1pemVkKSB7XG5cdFx0XHRcdGxhYmVsUGFydHMucHVzaChubHMubG9jYWxpemUoJ3Rlcm1pbmFsU2NyZWVuUmVhZGVyTW9kZScsIFwiUnVuIHRoZSBjb21tYW5kOiBUb2dnbGUgU2NyZWVuIFJlYWRlciBBY2Nlc3NpYmlsaXR5IE1vZGUgZm9yIGFuIG9wdGltaXplZCBzY3JlZW4gcmVhZGVyIGV4cGVyaWVuY2VcIikpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWNjZXNzaWJpbGl0eUhlbHBLZXliaW5kaW5nID0gdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhBY2Nlc3NpYmlsaXR5Q29tbWFuZElkLk9wZW5BY2Nlc3NpYmlsaXR5SGVscCk/LmdldExhYmVsKCk7XG5cdFx0XHRpZiAodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5UZXJtaW5hbCkgJiYgYWNjZXNzaWJpbGl0eUhlbHBLZXliaW5kaW5nKSB7XG5cdFx0XHRcdGxhYmVsUGFydHMucHVzaChubHMubG9jYWxpemUoJ3Rlcm1pbmFsSGVscEFyaWFMYWJlbCcsIFwiVXNlIHswfSBmb3IgdGVybWluYWwgYWNjZXNzaWJpbGl0eSBoZWxwXCIsIGFjY2Vzc2liaWxpdHlIZWxwS2V5YmluZGluZykpO1xuXHRcdFx0fVxuXHRcdFx0eHRlcm0udGV4dGFyZWEuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgbGFiZWxQYXJ0cy5qb2luKCdcXG4nKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlVGl0bGVQcm9wZXJ0aWVzKHRpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQsIGV2ZW50U291cmNlOiBUaXRsZUV2ZW50U291cmNlKTogc3RyaW5nIHtcblx0XHRpZiAoIXRpdGxlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcHJvY2Vzc05hbWU7XG5cdFx0fVxuXHRcdHN3aXRjaCAoZXZlbnRTb3VyY2UpIHtcblx0XHRcdGNhc2UgVGl0bGVFdmVudFNvdXJjZS5Qcm9jZXNzOlxuXHRcdFx0XHRpZiAodGhpcy5fcHJvY2Vzc01hbmFnZXIub3MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKSB7XG5cdFx0XHRcdFx0Ly8gRXh0cmFjdCB0aGUgZmlsZSBuYW1lIHdpdGhvdXQgZXh0ZW5zaW9uXG5cdFx0XHRcdFx0dGl0bGUgPSBwYXRoLndpbjMyLnBhcnNlKHRpdGxlKS5uYW1lO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGZpcnN0U3BhY2VJbmRleCA9IHRpdGxlLmluZGV4T2YoJyAnKTtcblx0XHRcdFx0XHRpZiAodGl0bGUuc3RhcnRzV2l0aCgnLycpKSB7XG5cdFx0XHRcdFx0XHR0aXRsZSA9IHBhdGguYmFzZW5hbWUodGl0bGUpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoZmlyc3RTcGFjZUluZGV4ID4gLTEpIHtcblx0XHRcdFx0XHRcdHRpdGxlID0gdGl0bGUuc3Vic3RyaW5nKDAsIGZpcnN0U3BhY2VJbmRleCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3Byb2Nlc3NOYW1lID0gdGl0bGU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBUaXRsZUV2ZW50U291cmNlLkFwaTpcblx0XHRcdFx0Ly8gSWYgdGhlIHRpdGxlIGhhcyBub3QgYmVlbiBzZXQgYnkgdGhlIEFQSSBvciB0aGUgcmVuYW1lIGNvbW1hbmQsIHVucmVnaXN0ZXIgdGhlIGhhbmRsZXIgdGhhdFxuXHRcdFx0XHQvLyBhdXRvbWF0aWNhbGx5IHVwZGF0ZXMgdGhlIHRlcm1pbmFsIG5hbWVcblx0XHRcdFx0dGhpcy5fc3RhdGljVGl0bGUgPSB0aXRsZTtcblx0XHRcdFx0dGhpcy5fbWVzc2FnZVRpdGxlRGlzcG9zYWJsZS52YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFRpdGxlRXZlbnRTb3VyY2UuU2VxdWVuY2U6XG5cdFx0XHRcdC8vIE9uIFdpbmRvd3MsIHNvbWUgc2hlbGxzIHdpbGwgZmlyZSB0aGlzIHdpdGggdGhlIGZ1bGwgcGF0aCB3aGljaCB3ZSB3YW50IHRvIHRyaW1cblx0XHRcdFx0Ly8gdG8gc2hvdyBqdXN0IHRoZSBmaWxlIG5hbWUuIFRoaXMgc2hvdWxkIG9ubHkgaGFwcGVuIGlmIHRoZSB0aXRsZSBsb29rcyBsaWtlIGFuXG5cdFx0XHRcdC8vIGFic29sdXRlIFdpbmRvd3MgZmlsZSBwYXRoXG5cdFx0XHRcdHRoaXMuX3NlcXVlbmNlID0gdGl0bGU7XG5cdFx0XHRcdGlmICh0aGlzLl9wcm9jZXNzTWFuYWdlci5vcyA9PT0gT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MgJiZcblx0XHRcdFx0XHR0aXRsZS5tYXRjaCgvXlthLXpBLVpdOlxcXFwuK1xcLlthLXpBLVpdezEsM30vKSkge1xuXHRcdFx0XHRcdHRoaXMuX3NlcXVlbmNlID0gcGF0aC53aW4zMi5wYXJzZSh0aXRsZSkubmFtZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdFx0dGhpcy5fdGl0bGVTb3VyY2UgPSBldmVudFNvdXJjZTtcblx0XHRyZXR1cm4gdGl0bGU7XG5cdH1cblxuXHRzZXRPdmVycmlkZURpbWVuc2lvbnMoZGltZW5zaW9uczogSVRlcm1pbmFsRGltZW5zaW9uc092ZXJyaWRlIHwgdW5kZWZpbmVkLCBpbW1lZGlhdGU6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9kaW1lbnNpb25zT3ZlcnJpZGUgJiYgdGhpcy5fZGltZW5zaW9uc092ZXJyaWRlLmZvcmNlRXhhY3RTaXplICYmICFkaW1lbnNpb25zICYmIHRoaXMuX3Jvd3MgPT09IDAgJiYgdGhpcy5fY29scyA9PT0gMCkge1xuXHRcdFx0Ly8gdGhpcyB0ZXJtaW5hbCBuZXZlciBoYWQgYSByZWFsIHNpemUgPT4ga2VlcCB0aGUgbGFzdCBkaW1lbnNpb25zIG92ZXJyaWRlIGV4YWN0IHNpemVcblx0XHRcdHRoaXMuX2NvbHMgPSB0aGlzLl9kaW1lbnNpb25zT3ZlcnJpZGUuY29scztcblx0XHRcdHRoaXMuX3Jvd3MgPSB0aGlzLl9kaW1lbnNpb25zT3ZlcnJpZGUucm93cztcblx0XHR9XG5cdFx0dGhpcy5fZGltZW5zaW9uc092ZXJyaWRlID0gZGltZW5zaW9ucztcblx0XHRpZiAoaW1tZWRpYXRlKSB7XG5cdFx0XHR0aGlzLl9yZXNpemUodHJ1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3Jlc2l6ZSgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNldEZpeGVkRGltZW5zaW9ucygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb2xzID0gYXdhaXQgdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UuaW5wdXQoe1xuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2V0VGVybWluYWxEaW1lbnNpb25zQ29sdW1uJywgXCJTZXQgRml4ZWQgRGltZW5zaW9uczogQ29sdW1uXCIpLFxuXHRcdFx0cGxhY2VIb2xkZXI6ICdFbnRlciBhIG51bWJlciBvZiBjb2x1bW5zIG9yIGxlYXZlIGVtcHR5IGZvciBhdXRvbWF0aWMgd2lkdGgnLFxuXHRcdFx0dmFsaWRhdGVJbnB1dDogYXN5bmMgKHRleHQpID0+IHRleHQubGVuZ3RoID4gMCAmJiAhdGV4dC5tYXRjaCgvXlxcZCskLykgPyB7IGNvbnRlbnQ6ICdFbnRlciBhIG51bWJlciBvciBsZWF2ZSBlbXB0eSBzaXplIGF1dG9tYXRpY2FsbHknLCBzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IgfSA6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHRcdGlmIChjb2xzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fZml4ZWRDb2xzID0gdGhpcy5fcGFyc2VGaXhlZERpbWVuc2lvbihjb2xzKTtcblx0XHR0aGlzLl9sYWJlbENvbXB1dGVyPy5yZWZyZXNoTGFiZWwodGhpcyk7XG5cdFx0dGhpcy5fdGVybWluYWxIYXNGaXhlZFdpZHRoLnNldCghIXRoaXMuX2ZpeGVkQ29scyk7XG5cdFx0Y29uc3Qgcm93cyA9IGF3YWl0IHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLmlucHV0KHtcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3NldFRlcm1pbmFsRGltZW5zaW9uc1JvdycsIFwiU2V0IEZpeGVkIERpbWVuc2lvbnM6IFJvd1wiKSxcblx0XHRcdHBsYWNlSG9sZGVyOiAnRW50ZXIgYSBudW1iZXIgb2Ygcm93cyBvciBsZWF2ZSBlbXB0eSBmb3IgYXV0b21hdGljIGhlaWdodCcsXG5cdFx0XHR2YWxpZGF0ZUlucHV0OiBhc3luYyAodGV4dCkgPT4gdGV4dC5sZW5ndGggPiAwICYmICF0ZXh0Lm1hdGNoKC9eXFxkKyQvKSA/IHsgY29udGVudDogJ0VudGVyIGEgbnVtYmVyIG9yIGxlYXZlIGVtcHR5IHNpemUgYXV0b21hdGljYWxseScsIHNldmVyaXR5OiBTZXZlcml0eS5FcnJvciB9IDogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdFx0aWYgKHJvd3MgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9maXhlZFJvd3MgPSB0aGlzLl9wYXJzZUZpeGVkRGltZW5zaW9uKHJvd3MpO1xuXHRcdHRoaXMuX2xhYmVsQ29tcHV0ZXI/LnJlZnJlc2hMYWJlbCh0aGlzKTtcblx0XHRhd2FpdCB0aGlzLl9yZWZyZXNoU2Nyb2xsYmFyKCk7XG5cdFx0dGhpcy5fcmVzaXplKCk7XG5cdFx0dGhpcy5mb2N1cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcGFyc2VGaXhlZERpbWVuc2lvbih2YWx1ZTogc3RyaW5nKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodmFsdWUgPT09ICcnKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZUludCh2YWx1ZSk7XG5cdFx0aWYgKHBhcnNlZCA8PSAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBwYXJzZSBkaW1lbnNpb24gXCIke3ZhbHVlfVwiYCk7XG5cdFx0fVxuXHRcdHJldHVybiBwYXJzZWQ7XG5cdH1cblxuXHRhc3luYyB0b2dnbGVTaXplVG9Db250ZW50V2lkdGgoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnh0ZXJtPy5yYXcuYnVmZmVyLmFjdGl2ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5faGFzU2Nyb2xsQmFyKSB7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbEhhc0ZpeGVkV2lkdGguc2V0KGZhbHNlKTtcblx0XHRcdHRoaXMuX2ZpeGVkQ29scyA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX2ZpeGVkUm93cyA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX2hhc1Njcm9sbEJhciA9IGZhbHNlO1xuXHRcdFx0dGhpcy5faW5pdERpbWVuc2lvbnMoKTtcblx0XHRcdGF3YWl0IHRoaXMuX3Jlc2l6ZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBmb250ID0gdGhpcy54dGVybSA/IHRoaXMueHRlcm0uZ2V0Rm9udCgpIDogdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5nZXRGb250KGRvbS5nZXRXaW5kb3codGhpcy5kb21FbGVtZW50KSk7XG5cdFx0XHRjb25zdCBtYXhDb2xzRm9yVGV4dHVyZSA9IE1hdGguZmxvb3IoQ29uc3RhbnRzLk1heENhbnZhc1dpZHRoIC8gKGZvbnQuY2hhcldpZHRoID8/IDIwKSk7XG5cdFx0XHQvLyBGaXhlZCBjb2x1bW5zIHNob3VsZCBiZSBhdCBsZWFzdCB4dGVybS5qcycgcmVndWxhciBjb2x1bW4gY291bnRcblx0XHRcdGNvbnN0IHByb3Bvc2VkQ29scyA9IE1hdGgubWF4KHRoaXMubWF4Q29scywgTWF0aC5taW4odGhpcy54dGVybS5nZXRMb25nZXN0Vmlld3BvcnRXcmFwcGVkTGluZUxlbmd0aCgpLCBtYXhDb2xzRm9yVGV4dHVyZSkpO1xuXHRcdFx0Ly8gRG9uJ3Qgc3dpdGNoIHRvIGZpeGVkIGRpbWVuc2lvbnMgaWYgdGhlIGNvbnRlbnQgYWxyZWFkeSBmaXRzIGFzIGl0IG1ha2VzIHRoZSBzY3JvbGxcblx0XHRcdC8vIGJhciBsb29rIGJhZCBiZWluZyBvZmYgdGhlIGVkZ2Vcblx0XHRcdGlmIChwcm9wb3NlZENvbHMgPiB0aGlzLnh0ZXJtLnJhdy5jb2xzKSB7XG5cdFx0XHRcdHRoaXMuX2ZpeGVkQ29scyA9IHByb3Bvc2VkQ29scztcblx0XHRcdH1cblx0XHR9XG5cdFx0YXdhaXQgdGhpcy5fcmVmcmVzaFNjcm9sbGJhcigpO1xuXHRcdHRoaXMuX2xhYmVsQ29tcHV0ZXI/LnJlZnJlc2hMYWJlbCh0aGlzKTtcblx0XHR0aGlzLmZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWZyZXNoU2Nyb2xsYmFyKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl9maXhlZENvbHMgfHwgdGhpcy5fZml4ZWRSb3dzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYWRkU2Nyb2xsYmFyKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9yZW1vdmVTY3JvbGxiYXIoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2FkZFNjcm9sbGJhcigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjaGFyV2lkdGggPSAodGhpcy54dGVybSA/IHRoaXMueHRlcm0uZ2V0Rm9udCgpIDogdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5nZXRGb250KGRvbS5nZXRXaW5kb3codGhpcy5kb21FbGVtZW50KSkpLmNoYXJXaWR0aDtcblx0XHRpZiAoIXRoaXMueHRlcm0/LnJhdy5lbGVtZW50IHx8ICF0aGlzLl9jb250YWluZXIgfHwgIWNoYXJXaWR0aCB8fCAhdGhpcy5fZml4ZWRDb2xzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3dyYXBwZXJFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2ZpeGVkLWRpbXMnKTtcblx0XHR0aGlzLl9oYXNTY3JvbGxCYXIgPSB0cnVlO1xuXHRcdHRoaXMuX2luaXREaW1lbnNpb25zKCk7XG5cdFx0YXdhaXQgdGhpcy5fcmVzaXplKCk7XG5cdFx0dGhpcy5fdGVybWluYWxIYXNGaXhlZFdpZHRoLnNldCh0cnVlKTtcblx0XHRpZiAoIXRoaXMuX2hvcml6b250YWxTY3JvbGxiYXIpIHtcblx0XHRcdHRoaXMuX2hvcml6b250YWxTY3JvbGxiYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tU2Nyb2xsYWJsZUVsZW1lbnQodGhpcy5fd3JhcHBlckVsZW1lbnQsIHtcblx0XHRcdFx0dmVydGljYWw6IFNjcm9sbGJhclZpc2liaWxpdHkuSGlkZGVuLFxuXHRcdFx0XHRob3Jpem9udGFsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkF1dG8sXG5cdFx0XHRcdHVzZVNoYWRvd3M6IGZhbHNlLFxuXHRcdFx0XHRzY3JvbGxZVG9YOiBmYWxzZSxcblx0XHRcdFx0Y29uc3VtZU1vdXNlV2hlZWxJZlNjcm9sbGJhcklzTmVlZGVkOiBmYWxzZVxuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2hvcml6b250YWxTY3JvbGxiYXIuZ2V0RG9tTm9kZSgpKTtcblx0XHR9XG5cdFx0dGhpcy5faG9yaXpvbnRhbFNjcm9sbGJhci5zZXRTY3JvbGxEaW1lbnNpb25zKHtcblx0XHRcdHdpZHRoOiB0aGlzLnh0ZXJtLnJhdy5lbGVtZW50LmNsaWVudFdpZHRoLFxuXHRcdFx0c2Nyb2xsV2lkdGg6IHRoaXMuX2ZpeGVkQ29scyAqIGNoYXJXaWR0aCArIDQwIC8vIFBhZGRpbmcgKyBzY3JvbGwgYmFyXG5cdFx0fSk7XG5cdFx0dGhpcy5faG9yaXpvbnRhbFNjcm9sbGJhci5nZXREb21Ob2RlKCkuc3R5bGUucGFkZGluZ0JvdHRvbSA9ICcxNnB4JztcblxuXHRcdC8vIHdvcmsgYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20veHRlcm1qcy94dGVybS5qcy9pc3N1ZXMvMzQ4MlxuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGZvciAobGV0IGkgPSB0aGlzLnh0ZXJtLnJhdy5idWZmZXIuYWN0aXZlLnZpZXdwb3J0WTsgaSA8IHRoaXMueHRlcm0ucmF3LmJ1ZmZlci5hY3RpdmUubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgbGluZSA9IHRoaXMueHRlcm0ucmF3LmJ1ZmZlci5hY3RpdmUuZ2V0TGluZShpKTtcblx0XHRcdFx0KGxpbmUgYXMgYW55KS5fbGluZS5pc1dyYXBwZWQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZW1vdmVTY3JvbGxiYXIoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl9jb250YWluZXIgfHwgIXRoaXMuX2hvcml6b250YWxTY3JvbGxiYXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5faG9yaXpvbnRhbFNjcm9sbGJhci5nZXREb21Ob2RlKCkucmVtb3ZlKCk7XG5cdFx0dGhpcy5faG9yaXpvbnRhbFNjcm9sbGJhci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5faG9yaXpvbnRhbFNjcm9sbGJhciA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl93cmFwcGVyRWxlbWVudC5yZW1vdmUoKTtcblx0XHR0aGlzLl93cmFwcGVyRWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdmaXhlZC1kaW1zJyk7XG5cdFx0dGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3dyYXBwZXJFbGVtZW50KTtcblx0fVxuXG5cdHByaXZhdGUgX3NldFJlc29sdmVkU2hlbGxMYXVuY2hDb25maWcoc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyk6IHZvaWQge1xuXHRcdHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmFyZ3MgPSBzaGVsbExhdW5jaENvbmZpZy5hcmdzO1xuXHRcdHRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmN3ZCA9IHNoZWxsTGF1bmNoQ29uZmlnLmN3ZDtcblx0XHR0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlID0gc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZTtcblx0XHR0aGlzLl9zaGVsbExhdW5jaENvbmZpZy5lbnYgPSBzaGVsbExhdW5jaENvbmZpZy5lbnY7XG5cdH1cblxuXHRwcml2YXRlIF9vbkVudmlyb25tZW50VmFyaWFibGVJbmZvQ2hhbmdlZChpbmZvOiBJRW52aXJvbm1lbnRWYXJpYWJsZUluZm8pOiB2b2lkIHtcblx0XHRpZiAoaW5mby5yZXF1aXJlc0FjdGlvbikge1xuXHRcdFx0dGhpcy54dGVybT8ucmF3LnRleHRhcmVhPy5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBubHMubG9jYWxpemUoJ3Rlcm1pbmFsU3RhbGVUZXh0Qm94QXJpYUxhYmVsJywgXCJUZXJtaW5hbCB7MH0gZW52aXJvbm1lbnQgaXMgc3RhbGUsIHJ1biB0aGUgJ1Nob3cgRW52aXJvbm1lbnQgSW5mb3JtYXRpb24nIGNvbW1hbmQgZm9yIG1vcmUgaW5mb3JtYXRpb25cIiwgdGhpcy5faW5zdGFuY2VJZCkpO1xuXHRcdH1cblx0XHR0aGlzLl9yZWZyZXNoRW52aXJvbm1lbnRWYXJpYWJsZUluZm9XaWRnZXRTdGF0ZShpbmZvKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JlZnJlc2hFbnZpcm9ubWVudFZhcmlhYmxlSW5mb1dpZGdldFN0YXRlKGluZm8/OiBJRW52aXJvbm1lbnRWYXJpYWJsZUluZm8pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBDaGVjayBpZiB0aGUgc3RhdHVzIHNob3VsZCBleGlzdFxuXHRcdGlmICghaW5mbykge1xuXHRcdFx0dGhpcy5zdGF0dXNMaXN0LnJlbW92ZShUZXJtaW5hbFN0YXR1cy5SZWxhdW5jaE5lZWRlZCk7XG5cdFx0XHR0aGlzLnN0YXR1c0xpc3QucmVtb3ZlKFRlcm1pbmFsU3RhdHVzLkVudmlyb25tZW50VmFyaWFibGVJbmZvQ2hhbmdlc0FjdGl2ZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gUmVjcmVhdGUgdGhlIHByb2Nlc3Mgc2VhbWxlc3NseSB3aXRob3V0IGluZm9ybWluZyB0aGUgdXNlIGlmIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcblx0XHQvLyBtZXQuXG5cdFx0aWYgKFxuXHRcdFx0Ly8gVGhlIGNoYW5nZSByZXF1aXJlcyBhIHJlbGF1bmNoXG5cdFx0XHRpbmZvLnJlcXVpcmVzQWN0aW9uICYmXG5cdFx0XHQvLyBUaGUgZmVhdHVyZSBpcyBlbmFibGVkXG5cdFx0XHR0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5lbnZpcm9ubWVudENoYW5nZXNSZWxhdW5jaCAmJlxuXHRcdFx0Ly8gSGFzIG5vdCBiZWVuIGludGVyYWN0ZWQgd2l0aFxuXHRcdFx0IXRoaXMuX3Byb2Nlc3NNYW5hZ2VyLmhhc1dyaXR0ZW5EYXRhICYmXG5cdFx0XHQvLyBOb3QgYSBmZWF0dXJlIHRlcm1pbmFsIG9yIGlzIGEgcmVjb25uZWN0aW5nIHRhc2sgdGVybWluYWwgKFRPRE86IE5lZWQgdG8gZXhwbGFpbiB0aGUgbGF0dGVyIGNhc2UpXG5cdFx0XHQoIXRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmlzRmVhdHVyZVRlcm1pbmFsIHx8ICh0aGlzLnJlY29ubmVjdGlvblByb3BlcnRpZXMgJiYgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3Rhc2sucmVjb25uZWN0aW9uJykgPT09IHRydWUpKSAmJlxuXHRcdFx0Ly8gTm90IGEgY3VzdG9tIHB0eVxuXHRcdFx0IXRoaXMuX3NoZWxsTGF1bmNoQ29uZmlnLmN1c3RvbVB0eUltcGxlbWVudGF0aW9uICYmXG5cdFx0XHQvLyBOb3QgYW4gZXh0ZW5zaW9uIG93bmVkIHRlcm1pbmFsXG5cdFx0XHQhdGhpcy5fc2hlbGxMYXVuY2hDb25maWcuaXNFeHRlbnNpb25Pd25lZFRlcm1pbmFsICYmXG5cdFx0XHQvLyBOb3QgYSByZWNvbm5lY3RlZCBvciByZXZpdmVkIHRlcm1pbmFsXG5cdFx0XHQhdGhpcy5fc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3MgJiZcblx0XHRcdC8vIE5vdCBhIFdpbmRvd3MgcmVtb3RlIHVzaW5nIENvblBUWSAoIzE4NzA4NClcblx0XHRcdCEodGhpcy5fcHJvY2Vzc01hbmFnZXIucmVtb3RlQXV0aG9yaXR5ICYmIHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLndpbmRvd3NFbmFibGVDb25wdHkgJiYgKGF3YWl0IHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLmdldEJhY2tlbmRPUygpKSA9PT0gT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MpXG5cdFx0KSB7XG5cdFx0XHR0aGlzLnJlbGF1bmNoKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIFJlLWNyZWF0ZSBzdGF0dXNlc1xuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IGdldFdvcmtzcGFjZUZvclRlcm1pbmFsKHRoaXMuc2hlbGxMYXVuY2hDb25maWcuY3dkLCB0aGlzLl93b3Jrc3BhY2VDb250ZXh0U2VydmljZSwgdGhpcy5faGlzdG9yeVNlcnZpY2UpO1xuXHRcdHRoaXMuc3RhdHVzTGlzdC5hZGQoaW5mby5nZXRTdGF0dXMoeyB3b3Jrc3BhY2VGb2xkZXIgfSkpO1xuXHR9XG5cblx0YXN5bmMgZ2V0SW5pdGlhbEN3ZCgpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGlmICghdGhpcy5faW5pdGlhbEN3ZCkge1xuXHRcdFx0dGhpcy5faW5pdGlhbEN3ZCA9IHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLmluaXRpYWxDd2Q7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9pbml0aWFsQ3dkO1xuXHR9XG5cblx0YXN5bmMgZ2V0Q3dkKCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKHRoaXMuY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQ3dkRGV0ZWN0aW9uKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ3dkRGV0ZWN0aW9uKSEuZ2V0Q3dkKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmNhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5Lk5haXZlQ3dkRGV0ZWN0aW9uKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuTmFpdmVDd2REZXRlY3Rpb24pIS5nZXRDd2QoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLmluaXRpYWxDd2Q7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZWZyZXNoUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KHR5cGU6IFQpOiBQcm9taXNlPElQcm9jZXNzUHJvcGVydHlNYXBbVF0+IHtcblx0XHRhd2FpdCB0aGlzLnByb2Nlc3NSZWFkeTtcblx0XHRyZXR1cm4gdGhpcy5fcHJvY2Vzc01hbmFnZXIucmVmcmVzaFByb3BlcnR5KHR5cGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfdXBkYXRlUHJvcGVydHk8VCBleHRlbmRzIFByb2Nlc3NQcm9wZXJ0eVR5cGU+KHR5cGU6IFQsIHZhbHVlOiBJUHJvY2Vzc1Byb3BlcnR5TWFwW1RdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLnVwZGF0ZVByb3BlcnR5KHR5cGUsIHZhbHVlKTtcblx0fVxuXG5cdGFzeW5jIHJlbmFtZSh0aXRsZT86IHN0cmluZykge1xuXHRcdHRoaXMuX3NldFRpdGxlKHRpdGxlLCBUaXRsZUV2ZW50U291cmNlLkFwaSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRUaXRsZSh0aXRsZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBldmVudFNvdXJjZTogVGl0bGVFdmVudFNvdXJjZSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlc2V0ID0gIXRpdGxlO1xuXHRcdHRpdGxlID0gdGhpcy5fdXBkYXRlVGl0bGVQcm9wZXJ0aWVzKHRpdGxlLCBldmVudFNvdXJjZSk7XG5cdFx0Y29uc3QgdGl0bGVDaGFuZ2VkID0gdGl0bGUgIT09IHRoaXMuX3RpdGxlO1xuXHRcdHRoaXMuX3RpdGxlID0gdGl0bGU7XG5cdFx0dGhpcy5fbGFiZWxDb21wdXRlcj8ucmVmcmVzaExhYmVsKHRoaXMsIHJlc2V0KTtcblx0XHR0aGlzLl9zZXRBcmlhTGFiZWwodGhpcy54dGVybT8ucmF3LCB0aGlzLl9pbnN0YW5jZUlkLCB0aGlzLl90aXRsZSk7XG5cblx0XHRpZiAodGl0bGVDaGFuZ2VkKSB7XG5cdFx0XHR0aGlzLl9vblRpdGxlQ2hhbmdlZC5maXJlKHRoaXMpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGNoYW5nZUljb24oaWNvbj86IFRlcm1pbmFsSWNvbik6IFByb21pc2U8VGVybWluYWxJY29uIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKGljb24pIHtcblx0XHRcdHRoaXMuX2ljb24gPSBpY29uO1xuXHRcdFx0dGhpcy5fb25JY29uQ2hhbmdlZC5maXJlKHsgaW5zdGFuY2U6IHRoaXMsIHVzZXJJbml0aWF0ZWQ6IHRydWUgfSk7XG5cdFx0XHRyZXR1cm4gaWNvbjtcblx0XHR9XG5cdFx0Y29uc3QgaWNvblBpY2tlciA9IHRoaXMuX3Njb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsSWNvblBpY2tlcik7XG5cdFx0Y29uc3QgcGlja2VkSWNvbiA9IGF3YWl0IGljb25QaWNrZXIucGlja0ljb25zKCk7XG5cdFx0aWNvblBpY2tlci5kaXNwb3NlKCk7XG5cdFx0aWYgKCFwaWNrZWRJY29uKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl9pY29uID0gcGlja2VkSWNvbjtcblx0XHR0aGlzLl9vbkljb25DaGFuZ2VkLmZpcmUoeyBpbnN0YW5jZTogdGhpcywgdXNlckluaXRpYXRlZDogdHJ1ZSB9KTtcblx0XHRyZXR1cm4gcGlja2VkSWNvbjtcblx0fVxuXG5cdGFzeW5jIGNoYW5nZUNvbG9yKGNvbG9yPzogc3RyaW5nLCBza2lwUXVpY2tQaWNrPzogYm9vbGVhbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKGNvbG9yKSB7XG5cdFx0XHR0aGlzLnNoZWxsTGF1bmNoQ29uZmlnLmNvbG9yID0gY29sb3I7XG5cdFx0XHR0aGlzLl9vbkljb25DaGFuZ2VkLmZpcmUoeyBpbnN0YW5jZTogdGhpcywgdXNlckluaXRpYXRlZDogdHJ1ZSB9KTtcblx0XHRcdHJldHVybiBjb2xvcjtcblx0XHR9IGVsc2UgaWYgKHNraXBRdWlja1BpY2spIHtcblx0XHRcdC8vIFJlc2V0IHRoaXMgdGFiJ3MgY29sb3Jcblx0XHRcdHRoaXMuc2hlbGxMYXVuY2hDb25maWcuY29sb3IgPSAnJztcblx0XHRcdHRoaXMuX29uSWNvbkNoYW5nZWQuZmlyZSh7IGluc3RhbmNlOiB0aGlzLCB1c2VySW5pdGlhdGVkOiB0cnVlIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpY29uID0gdGhpcy5fZ2V0SWNvbigpO1xuXHRcdGlmICghaWNvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjb2xvclRoZW1lID0gdGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKTtcblx0XHRjb25zdCBzdGFuZGFyZENvbG9yczogc3RyaW5nW10gPSBnZXRTdGFuZGFyZENvbG9ycyhjb2xvclRoZW1lKTtcblx0XHRjb25zdCBjb2xvclN0eWxlRGlzcG9zYWJsZSA9IGNyZWF0ZUNvbG9yU3R5bGVFbGVtZW50KGNvbG9yVGhlbWUpO1xuXHRcdGNvbnN0IGl0ZW1zOiBRdWlja1BpY2tJdGVtW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGNvbG9yS2V5IG9mIHN0YW5kYXJkQ29sb3JzKSB7XG5cdFx0XHRjb25zdCBjb2xvckNsYXNzID0gZ2V0Q29sb3JDbGFzcyhjb2xvcktleSk7XG5cdFx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGAkKCR7Q29kaWNvbi5jaXJjbGVGaWxsZWQuaWR9KSAke2NvbG9yS2V5LnJlcGxhY2UoJ3Rlcm1pbmFsLmFuc2knLCAnJyl9YCwgaWQ6IGNvbG9yS2V5LCBkZXNjcmlwdGlvbjogY29sb3JLZXksIGljb25DbGFzc2VzOiBbY29sb3JDbGFzc11cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRpdGVtcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicgfSk7XG5cdFx0Y29uc3Qgc2hvd0FsbENvbG9yc0l0ZW0gPSB7IGxhYmVsOiAnUmVzZXQgdG8gZGVmYXVsdCcgfTtcblx0XHRpdGVtcy5wdXNoKHNob3dBbGxDb2xvcnNJdGVtKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZVtdID0gW107XG5cdFx0Y29uc3QgcXVpY2tQaWNrID0gdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrKHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9KTtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKHF1aWNrUGljayk7XG5cdFx0cXVpY2tQaWNrLml0ZW1zID0gaXRlbXM7XG5cdFx0cXVpY2tQaWNrLm1hdGNoT25EZXNjcmlwdGlvbiA9IHRydWU7XG5cdFx0cXVpY2tQaWNrLnBsYWNlaG9sZGVyID0gbmxzLmxvY2FsaXplKCdjaGFuZ2VDb2xvcicsICdTZWxlY3QgYSBjb2xvciBmb3IgdGhlIHRlcm1pbmFsJyk7XG5cdFx0cXVpY2tQaWNrLnNob3coKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZTxJUXVpY2tQaWNrSXRlbSB8IHVuZGVmaW5lZD4ociA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5wdXNoKHF1aWNrUGljay5vbkRpZEhpZGUoKCkgPT4gcih1bmRlZmluZWQpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5wdXNoKHF1aWNrUGljay5vbkRpZEFjY2VwdCgoKSA9PiByKHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zWzBdKSkpO1xuXHRcdH0pO1xuXHRcdGRpc3Bvc2UoZGlzcG9zYWJsZXMpO1xuXG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0dGhpcy5zaGVsbExhdW5jaENvbmZpZy5jb2xvciA9IHJlc3VsdC5pZDtcblx0XHRcdHRoaXMuX29uSWNvbkNoYW5nZWQuZmlyZSh7IGluc3RhbmNlOiB0aGlzLCB1c2VySW5pdGlhdGVkOiB0cnVlIH0pO1xuXHRcdH1cblxuXHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0Y29sb3JTdHlsZURpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdHJldHVybiByZXN1bHQ/LmlkO1xuXHR9XG5cblx0Zm9yY2VTY3JvbGxiYXJWaXNpYmlsaXR5KCk6IHZvaWQge1xuXHRcdHRoaXMuX3dyYXBwZXJFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2ZvcmNlLXNjcm9sbGJhcicpO1xuXHR9XG5cblx0cmVzZXRTY3JvbGxiYXJWaXNpYmlsaXR5KCk6IHZvaWQge1xuXHRcdHRoaXMuX3dyYXBwZXJFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2ZvcmNlLXNjcm9sbGJhcicpO1xuXHR9XG5cblx0c2V0UGFyZW50Q29udGV4dEtleVNlcnZpY2UocGFyZW50Q29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSk6IHZvaWQge1xuXHRcdHRoaXMuX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlLnVwZGF0ZVBhcmVudChwYXJlbnRDb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHRhc3luYyBoYW5kbGVNb3VzZUV2ZW50KGV2ZW50OiBNb3VzZUV2ZW50LCBjb250ZXh0TWVudTogSU1lbnUpOiBQcm9taXNlPHsgY2FuY2VsQ29udGV4dE1lbnU6IGJvb2xlYW4gfSB8IHZvaWQ+IHtcblx0XHQvLyBEb24ndCBoYW5kbGUgbW91c2UgZXZlbnQgaWYgaXQgd2FzIG9uIHRoZSBzY3JvbGwgYmFyXG5cdFx0aWYgKGRvbS5pc0hUTUxFbGVtZW50KGV2ZW50LnRhcmdldCkgJiYgKGV2ZW50LnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ3Njcm9sbGJhcicpIHx8IGV2ZW50LnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ3NsaWRlcicpKSkge1xuXHRcdFx0cmV0dXJuIHsgY2FuY2VsQ29udGV4dE1lbnU6IHRydWUgfTtcblx0XHR9XG5cblx0XHQvLyBBbGxvdyBjb250cmlidXRpb25zIHRvIGhhbmRsZSB0aGUgbW91c2UgZXZlbnQgZmlyc3Rcblx0XHRmb3IgKGNvbnN0IGNvbnRyaWIgb2YgdGhpcy5fY29udHJpYnV0aW9ucy52YWx1ZXMoKSkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgY29udHJpYi5oYW5kbGVNb3VzZUV2ZW50Py4oZXZlbnQpO1xuXHRcdFx0aWYgKHJlc3VsdD8uaGFuZGxlZCkge1xuXHRcdFx0XHRyZXR1cm4geyBjYW5jZWxDb250ZXh0TWVudTogdHJ1ZSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE1pZGRsZSBjbGlja1xuXHRcdGlmIChldmVudC53aGljaCA9PT0gMikge1xuXHRcdFx0c3dpdGNoICh0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5taWRkbGVDbGlja0JlaGF2aW9yKSB7XG5cdFx0XHRcdGNhc2UgJ2RlZmF1bHQnOlxuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdC8vIERyb3Agc2VsZWN0aW9uIGFuZCBmb2N1cyB0ZXJtaW5hbCBvbiBMaW51eCB0byBlbmFibGUgbWlkZGxlIGJ1dHRvbiBwYXN0ZVxuXHRcdFx0XHRcdC8vIHdoZW4gY2xpY2sgb2NjdXJzIG9uIHRoZSBzZWxlY3Rpb24gaXRzZWxmLlxuXHRcdFx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBSaWdodCBjbGlja1xuXHRcdGlmIChldmVudC53aGljaCA9PT0gMykge1xuXHRcdFx0Ly8gU2hpZnQgY2xpY2sgZm9yY2VzIHRoZSBjb250ZXh0IG1lbnVcblx0XHRcdGlmIChldmVudC5zaGlmdEtleSkge1xuXHRcdFx0XHRvcGVuQ29udGV4dE1lbnUoZG9tLmdldEFjdGl2ZVdpbmRvdygpLCBldmVudCwgdGhpcywgY29udGV4dE1lbnUsIHRoaXMuX2NvbnRleHRNZW51U2VydmljZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmlnaHRDbGlja0JlaGF2aW9yID0gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcucmlnaHRDbGlja0JlaGF2aW9yO1xuXHRcdFx0aWYgKHJpZ2h0Q2xpY2tCZWhhdmlvciA9PT0gJ25vdGhpbmcnKSB7XG5cdFx0XHRcdGlmICghZXZlbnQuc2hpZnRLZXkpIHtcblx0XHRcdFx0XHRyZXR1cm4geyBjYW5jZWxDb250ZXh0TWVudTogdHJ1ZSB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgVGVybWluYWxJbnN0YW5jZURyYWdBbmREcm9wQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBkb20uSURyYWdBbmREcm9wT2JzZXJ2ZXJDYWxsYmFja3Mge1xuXHRwcml2YXRlIF9kcm9wT3ZlcmxheT86IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRHJvcEZpbGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxzdHJpbmcgfCBVUkk+KCkpO1xuXHRnZXQgb25Ecm9wRmlsZSgpOiBFdmVudDxzdHJpbmcgfCBVUkk+IHsgcmV0dXJuIHRoaXMuX29uRHJvcEZpbGUuZXZlbnQ7IH1cblx0cHJpdmF0ZSByZWFkb25seSBfb25Ecm9wVGVybWluYWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUmVxdWVzdEFkZEluc3RhbmNlVG9Hcm91cEV2ZW50PigpKTtcblx0Z2V0IG9uRHJvcFRlcm1pbmFsKCk6IEV2ZW50PElSZXF1ZXN0QWRkSW5zdGFuY2VUb0dyb3VwRXZlbnQ+IHsgcmV0dXJuIHRoaXMuX29uRHJvcFRlcm1pbmFsLmV2ZW50OyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9jbGVhckRyb3BPdmVybGF5KCkpKTtcblx0fVxuXG5cdHByaXZhdGUgX2NsZWFyRHJvcE92ZXJsYXkoKSB7XG5cdFx0dGhpcy5fZHJvcE92ZXJsYXk/LnJlbW92ZSgpO1xuXHRcdHRoaXMuX2Ryb3BPdmVybGF5ID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0b25EcmFnRW50ZXIoZTogRHJhZ0V2ZW50KSB7XG5cdFx0aWYgKCFjb250YWluc0RyYWdUeXBlKGUsIERhdGFUcmFuc2ZlcnMuRklMRVMsIERhdGFUcmFuc2ZlcnMuUkVTT1VSQ0VTLCBUZXJtaW5hbERhdGFUcmFuc2ZlcnMuVGVybWluYWxzLCBDb2RlRGF0YVRyYW5zZmVycy5GSUxFUykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2Ryb3BPdmVybGF5KSB7XG5cdFx0XHR0aGlzLl9kcm9wT3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0dGhpcy5fZHJvcE92ZXJsYXkuY2xhc3NMaXN0LmFkZCgndGVybWluYWwtZHJvcC1vdmVybGF5Jyk7XG5cdFx0fVxuXG5cdFx0Ly8gRHJhZ2dpbmcgdGVybWluYWxzXG5cdFx0aWYgKGNvbnRhaW5zRHJhZ1R5cGUoZSwgVGVybWluYWxEYXRhVHJhbnNmZXJzLlRlcm1pbmFscykpIHtcblx0XHRcdGNvbnN0IHNpZGUgPSB0aGlzLl9nZXREcm9wU2lkZShlKTtcblx0XHRcdHRoaXMuX2Ryb3BPdmVybGF5LmNsYXNzTGlzdC50b2dnbGUoJ2Ryb3AtYmVmb3JlJywgc2lkZSA9PT0gJ2JlZm9yZScpO1xuXHRcdFx0dGhpcy5fZHJvcE92ZXJsYXkuY2xhc3NMaXN0LnRvZ2dsZSgnZHJvcC1hZnRlcicsIHNpZGUgPT09ICdhZnRlcicpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fZHJvcE92ZXJsYXkucGFyZW50RWxlbWVudCkge1xuXHRcdFx0dGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2Ryb3BPdmVybGF5KTtcblx0XHR9XG5cdH1cblx0b25EcmFnTGVhdmUoZTogRHJhZ0V2ZW50KSB7XG5cdFx0dGhpcy5fY2xlYXJEcm9wT3ZlcmxheSgpO1xuXHR9XG5cblx0b25EcmFnRW5kKGU6IERyYWdFdmVudCkge1xuXHRcdHRoaXMuX2NsZWFyRHJvcE92ZXJsYXkoKTtcblx0fVxuXG5cdG9uRHJhZ092ZXIoZTogRHJhZ0V2ZW50KSB7XG5cdFx0aWYgKCFlLmRhdGFUcmFuc2ZlciB8fCAhdGhpcy5fZHJvcE92ZXJsYXkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBEcmFnZ2luZyB0ZXJtaW5hbHNcblx0XHRpZiAoY29udGFpbnNEcmFnVHlwZShlLCBUZXJtaW5hbERhdGFUcmFuc2ZlcnMuVGVybWluYWxzKSkge1xuXHRcdFx0Y29uc3Qgc2lkZSA9IHRoaXMuX2dldERyb3BTaWRlKGUpO1xuXHRcdFx0dGhpcy5fZHJvcE92ZXJsYXkuY2xhc3NMaXN0LnRvZ2dsZSgnZHJvcC1iZWZvcmUnLCBzaWRlID09PSAnYmVmb3JlJyk7XG5cdFx0XHR0aGlzLl9kcm9wT3ZlcmxheS5jbGFzc0xpc3QudG9nZ2xlKCdkcm9wLWFmdGVyJywgc2lkZSA9PT0gJ2FmdGVyJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZHJvcE92ZXJsYXkuc3R5bGUub3BhY2l0eSA9ICcxJztcblx0fVxuXG5cdGFzeW5jIG9uRHJvcChlOiBEcmFnRXZlbnQpIHtcblx0XHR0aGlzLl9jbGVhckRyb3BPdmVybGF5KCk7XG5cblx0XHRpZiAoIWUuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGVybWluYWxSZXNvdXJjZXMgPSBnZXRUZXJtaW5hbFJlc291cmNlc0Zyb21EcmFnRXZlbnQoZSk7XG5cdFx0aWYgKHRlcm1pbmFsUmVzb3VyY2VzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHVyaSBvZiB0ZXJtaW5hbFJlc291cmNlcykge1xuXHRcdFx0XHRjb25zdCBzaWRlID0gdGhpcy5fZ2V0RHJvcFNpZGUoZSk7XG5cdFx0XHRcdHRoaXMuX29uRHJvcFRlcm1pbmFsLmZpcmUoeyB1cmksIHNpZGUgfSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgaWYgZmlsZXMgd2VyZSBkcmFnZ2VkIGZyb20gdGhlIHRyZWUgZXhwbG9yZXJcblx0XHRsZXQgcGF0aDogVVJJIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHJhd1Jlc291cmNlcyA9IGUuZGF0YVRyYW5zZmVyLmdldERhdGEoRGF0YVRyYW5zZmVycy5SRVNPVVJDRVMpO1xuXHRcdGlmIChyYXdSZXNvdXJjZXMpIHtcblx0XHRcdHBhdGggPSBVUkkucGFyc2UoSlNPTi5wYXJzZShyYXdSZXNvdXJjZXMpWzBdKTtcblx0XHR9XG5cblx0XHRjb25zdCByYXdDb2RlRmlsZXMgPSBlLmRhdGFUcmFuc2Zlci5nZXREYXRhKENvZGVEYXRhVHJhbnNmZXJzLkZJTEVTKTtcblx0XHRpZiAoIXBhdGggJiYgcmF3Q29kZUZpbGVzKSB7XG5cdFx0XHRwYXRoID0gVVJJLmZpbGUoSlNPTi5wYXJzZShyYXdDb2RlRmlsZXMpWzBdKTtcblx0XHR9XG5cblx0XHRpZiAoIXBhdGggJiYgZS5kYXRhVHJhbnNmZXIuZmlsZXMubGVuZ3RoID4gMCAmJiBnZXRQYXRoRm9yRmlsZShlLmRhdGFUcmFuc2Zlci5maWxlc1swXSkpIHtcblx0XHRcdC8vIENoZWNrIGlmIHRoZSBmaWxlIHdhcyBkcmFnZ2VkIGZyb20gdGhlIGZpbGVzeXN0ZW1cblx0XHRcdHBhdGggPSBVUkkuZmlsZShnZXRQYXRoRm9yRmlsZShlLmRhdGFUcmFuc2Zlci5maWxlc1swXSkhKTtcblx0XHR9XG5cblx0XHRpZiAoIXBhdGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRyb3BGaWxlLmZpcmUocGF0aCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXREcm9wU2lkZShlOiBEcmFnRXZlbnQpOiAnYmVmb3JlJyB8ICdhZnRlcicge1xuXHRcdGNvbnN0IHRhcmdldCA9IHRoaXMuX2NvbnRhaW5lcjtcblx0XHRpZiAoIXRhcmdldCkge1xuXHRcdFx0cmV0dXJuICdhZnRlcic7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRyZXR1cm4gdGhpcy5fZ2V0Vmlld09yaWVudGF0aW9uKCkgPT09IE9yaWVudGF0aW9uLkhPUklaT05UQUxcblx0XHRcdD8gKGUuY2xpZW50WCAtIHJlY3QubGVmdCA8IHJlY3Qud2lkdGggLyAyID8gJ2JlZm9yZScgOiAnYWZ0ZXInKVxuXHRcdFx0OiAoZS5jbGllbnRZIC0gcmVjdC50b3AgPCByZWN0LmhlaWdodCAvIDIgPyAnYmVmb3JlJyA6ICdhZnRlcicpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Vmlld09yaWVudGF0aW9uKCk6IE9yaWVudGF0aW9uIHtcblx0XHRjb25zdCBwYW5lbFBvc2l0aW9uID0gdGhpcy5fbGF5b3V0U2VydmljZS5nZXRQYW5lbFBvc2l0aW9uKCk7XG5cdFx0Y29uc3QgdGVybWluYWxMb2NhdGlvbiA9IHRoaXMuX3ZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3TG9jYXRpb25CeUlkKFRFUk1JTkFMX1ZJRVdfSUQpO1xuXHRcdHJldHVybiB0ZXJtaW5hbExvY2F0aW9uID09PSBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwgJiYgaXNIb3Jpem9udGFsKHBhbmVsUG9zaXRpb24pXG5cdFx0XHQ/IE9yaWVudGF0aW9uLkhPUklaT05UQUxcblx0XHRcdDogT3JpZW50YXRpb24uVkVSVElDQUw7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElUZXJtaW5hbExhYmVsVGVtcGxhdGVQcm9wZXJ0aWVzIHtcblx0Y3dkPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZDtcblx0Y3dkRm9sZGVyPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZDtcblx0d29ya3NwYWNlRm9sZGVyTmFtZT86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQ7XG5cdHdvcmtzcGFjZUZvbGRlcj86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQ7XG5cdGxvY2FsPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZDtcblx0cHJvY2Vzcz86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQ7XG5cdHNlcXVlbmNlPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZDtcblx0cHJvZ3Jlc3M/OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkO1xuXHR0YXNrPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZDtcblx0Zml4ZWREaW1lbnNpb25zPzogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZDtcblx0c2VwYXJhdG9yPzogc3RyaW5nIHwgSVNlcGFyYXRvciB8IG51bGwgfCB1bmRlZmluZWQ7XG5cdHNoZWxsVHlwZT86IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0c2hlbGxDb21tYW5kPzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRzaGVsbFByb21wdElucHV0Pzogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5jb25zdCBlbnVtIFRlcm1pbmFsTGFiZWxUeXBlIHtcblx0VGl0bGUgPSAndGl0bGUnLFxuXHREZXNjcmlwdGlvbiA9ICdkZXNjcmlwdGlvbidcbn1cblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsTGFiZWxDb21wdXRlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF90aXRsZTogc3RyaW5nID0gJyc7XG5cdHByaXZhdGUgX2Rlc2NyaXB0aW9uOiBzdHJpbmcgPSAnJztcblx0Z2V0IHRpdGxlKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl90aXRsZTsgfVxuXHRnZXQgZGVzY3JpcHRpb24oKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuX2Rlc2NyaXB0aW9uOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VMYWJlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgdGl0bGU6IHN0cmluZzsgZGVzY3JpcHRpb246IHN0cmluZyB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VMYWJlbCA9IHRoaXMuX29uRGlkQ2hhbmdlTGFiZWwuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHJlZnJlc2hMYWJlbChpbnN0YW5jZTogUGljazxJVGVybWluYWxJbnN0YW5jZSwgJ3NoZWxsTGF1bmNoQ29uZmlnJyB8ICdzaGVsbFR5cGUnIHwgJ2N3ZCcgfCAnZml4ZWRDb2xzJyB8ICdmaXhlZFJvd3MnIHwgJ2luaXRpYWxDd2QnIHwgJ3Byb2Nlc3NOYW1lJyB8ICdzZXF1ZW5jZScgfCAndXNlckhvbWUnIHwgJ3dvcmtzcGFjZUZvbGRlcicgfCAnc3RhdGljVGl0bGUnIHwgJ2NhcGFiaWxpdGllcycgfCAndGl0bGUnIHwgJ2Rlc2NyaXB0aW9uJz4sIHJlc2V0PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3RpdGxlID0gdGhpcy5jb21wdXRlTGFiZWwoaW5zdGFuY2UsIHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLnRhYnMudGl0bGUsIFRlcm1pbmFsTGFiZWxUeXBlLlRpdGxlLCByZXNldCk7XG5cdFx0dGhpcy5fZGVzY3JpcHRpb24gPSB0aGlzLmNvbXB1dGVMYWJlbChpbnN0YW5jZSwgdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcudGFicy5kZXNjcmlwdGlvbiwgVGVybWluYWxMYWJlbFR5cGUuRGVzY3JpcHRpb24pO1xuXHRcdGlmICh0aGlzLl90aXRsZSAhPT0gaW5zdGFuY2UudGl0bGUgfHwgdGhpcy5fZGVzY3JpcHRpb24gIT09IGluc3RhbmNlLmRlc2NyaXB0aW9uIHx8IHJlc2V0KSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUxhYmVsLmZpcmUoeyB0aXRsZTogdGhpcy5fdGl0bGUsIGRlc2NyaXB0aW9uOiB0aGlzLl9kZXNjcmlwdGlvbiB9KTtcblx0XHR9XG5cdH1cblxuXHRjb21wdXRlTGFiZWwoXG5cdFx0aW5zdGFuY2U6IFBpY2s8SVRlcm1pbmFsSW5zdGFuY2UsICdzaGVsbExhdW5jaENvbmZpZycgfCAnc2hlbGxUeXBlJyB8ICdjd2QnIHwgJ2ZpeGVkQ29scycgfCAnZml4ZWRSb3dzJyB8ICdpbml0aWFsQ3dkJyB8ICdwcm9jZXNzTmFtZScgfCAnc2VxdWVuY2UnIHwgJ3VzZXJIb21lJyB8ICd3b3Jrc3BhY2VGb2xkZXInIHwgJ3N0YXRpY1RpdGxlJyB8ICdjYXBhYmlsaXRpZXMnIHwgJ3RpdGxlJyB8ICdkZXNjcmlwdGlvbicgfCAncHJvZ3Jlc3NTdGF0ZSc+LFxuXHRcdGxhYmVsVGVtcGxhdGU6IHN0cmluZyxcblx0XHRsYWJlbFR5cGU6IFRlcm1pbmFsTGFiZWxUeXBlLFxuXHRcdHJlc2V0PzogYm9vbGVhblxuXHQpIHtcblx0XHRjb25zdCB0eXBlID0gaW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3M/LnR5cGUgfHwgaW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcudHlwZTtcblx0XHRjb25zdCBjb21tYW5kRGV0ZWN0aW9uID0gaW5zdGFuY2UuY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbik7XG5cdFx0Y29uc3QgcHJvbXB0SW5wdXRNb2RlbCA9IGNvbW1hbmREZXRlY3Rpb24/LnByb21wdElucHV0TW9kZWw7XG5cdFx0Y29uc3Qgbm9uVGFza1NwaW5uZXIgPSB0eXBlID09PSAnVGFzaycgPyAnJyA6ICcgJChsb2FkaW5nfnNwaW4pJztcblx0XHRjb25zdCB0ZW1wbGF0ZVByb3BlcnRpZXM6IElUZXJtaW5hbExhYmVsVGVtcGxhdGVQcm9wZXJ0aWVzID0ge1xuXHRcdFx0Y3dkOiBpbnN0YW5jZS5jd2QgfHwgaW5zdGFuY2UuaW5pdGlhbEN3ZCB8fCAnJyxcblx0XHRcdGN3ZEZvbGRlcjogJycsXG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXJOYW1lOiBpbnN0YW5jZS53b3Jrc3BhY2VGb2xkZXI/Lm5hbWUsXG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXI6IGluc3RhbmNlLndvcmtzcGFjZUZvbGRlciA/IHBhdGguYmFzZW5hbWUoaW5zdGFuY2Uud29ya3NwYWNlRm9sZGVyLnVyaS5mc1BhdGgpIDogdW5kZWZpbmVkLFxuXHRcdFx0bG9jYWw6IHR5cGUgPT09ICdMb2NhbCcgPyB0ZXJtaW5hbFN0cmluZ3MudHlwZUxvY2FsIDogdW5kZWZpbmVkLFxuXHRcdFx0cHJvY2VzczogaW5zdGFuY2UucHJvY2Vzc05hbWUsXG5cdFx0XHRzZXF1ZW5jZTogaW5zdGFuY2Uuc2VxdWVuY2UsXG5cdFx0XHR0YXNrOiB0eXBlID09PSAnVGFzaycgPyB0ZXJtaW5hbFN0cmluZ3MudHlwZVRhc2sgOiB1bmRlZmluZWQsXG5cdFx0XHRmaXhlZERpbWVuc2lvbnM6IGluc3RhbmNlLmZpeGVkQ29sc1xuXHRcdFx0XHQ/IChpbnN0YW5jZS5maXhlZFJvd3MgPyBgXFx1MjE5NCR7aW5zdGFuY2UuZml4ZWRDb2xzfSBcXHUyMTk1JHtpbnN0YW5jZS5maXhlZFJvd3N9YCA6IGBcXHUyMTk0JHtpbnN0YW5jZS5maXhlZENvbHN9YClcblx0XHRcdFx0OiAoaW5zdGFuY2UuZml4ZWRSb3dzID8gYFxcdTIxOTUke2luc3RhbmNlLmZpeGVkUm93c31gIDogJycpLFxuXHRcdFx0c2VwYXJhdG9yOiB7IGxhYmVsOiB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy50YWJzLnNlcGFyYXRvciB9LFxuXHRcdFx0c2hlbGxUeXBlOiBpbnN0YW5jZS5zaGVsbFR5cGUsXG5cdFx0XHQvLyBTaGVsbCBjb21tYW5kIHJlcXVpcmVzIGhpZ2ggY29uZmlkZW5jZVxuXHRcdFx0c2hlbGxDb21tYW5kOiBjb21tYW5kRGV0ZWN0aW9uPy5leGVjdXRpbmdDb21tYW5kICYmIGNvbW1hbmREZXRlY3Rpb24uZXhlY3V0aW5nQ29tbWFuZENvbmZpZGVuY2UgPT09ICdoaWdoJyAmJiBwcm9tcHRJbnB1dE1vZGVsXG5cdFx0XHRcdD8gcHJvbXB0SW5wdXRNb2RlbC52YWx1ZSArIG5vblRhc2tTcGlubmVyXG5cdFx0XHRcdDogdW5kZWZpbmVkLFxuXHRcdFx0Ly8gU2hlbGwgcHJvbXB0IGlucHV0IGRvZXMgbm90IHJlcXVpcmUgaGlnaCBjb25maWRlbmNlIGFzIGl0J3MgbGFyZ2VseSBmb3IgVlMgQ29kZSBkZXZlbG9wZXJzXG5cdFx0XHRzaGVsbFByb21wdElucHV0OiBjb21tYW5kRGV0ZWN0aW9uPy5leGVjdXRpbmdDb21tYW5kICYmIHByb21wdElucHV0TW9kZWxcblx0XHRcdFx0PyBwcm9tcHRJbnB1dE1vZGVsLmdldENvbWJpbmVkU3RyaW5nKHRydWUpICsgbm9uVGFza1NwaW5uZXJcblx0XHRcdFx0OiBwcm9tcHRJbnB1dE1vZGVsPy5nZXRDb21iaW5lZFN0cmluZyh0cnVlKSxcblx0XHRcdHByb2dyZXNzOiB0aGlzLl9nZXRQcm9ncmVzc1N0YXRlU3RyaW5nKGluc3RhbmNlLnByb2dyZXNzU3RhdGUpXG5cdFx0fTtcblx0XHR0ZW1wbGF0ZVByb3BlcnRpZXMud29ya3NwYWNlRm9sZGVyTmFtZSA9IGluc3RhbmNlLndvcmtzcGFjZUZvbGRlcj8ubmFtZSA/PyB0ZW1wbGF0ZVByb3BlcnRpZXMud29ya3NwYWNlRm9sZGVyO1xuXHRcdGxhYmVsVGVtcGxhdGUgPSBsYWJlbFRlbXBsYXRlLnRyaW0oKTtcblx0XHRpZiAoIWxhYmVsVGVtcGxhdGUpIHtcblx0XHRcdHJldHVybiBsYWJlbFR5cGUgPT09IFRlcm1pbmFsTGFiZWxUeXBlLlRpdGxlID8gKGluc3RhbmNlLnByb2Nlc3NOYW1lIHx8ICcnKSA6ICcnO1xuXHRcdH1cblx0XHRpZiAoIXJlc2V0ICYmIGluc3RhbmNlLnN0YXRpY1RpdGxlICYmIGxhYmVsVHlwZSA9PT0gVGVybWluYWxMYWJlbFR5cGUuVGl0bGUpIHtcblx0XHRcdHJldHVybiBpbnN0YW5jZS5zdGF0aWNUaXRsZS5yZXBsYWNlKC9bXFxuXFxyXFx0XS9nLCAnJykgfHwgdGVtcGxhdGVQcm9wZXJ0aWVzLnByb2Nlc3M/LnJlcGxhY2UoL1tcXG5cXHJcXHRdL2csICcnKSB8fCAnJztcblx0XHR9XG5cdFx0Y29uc3QgZGV0ZWN0aW9uID0gaW5zdGFuY2UuY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQ3dkRGV0ZWN0aW9uKSB8fCBpbnN0YW5jZS5jYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5OYWl2ZUN3ZERldGVjdGlvbik7XG5cdFx0Y29uc3QgZm9sZGVycyA9IHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnM7XG5cdFx0Y29uc3QgbXVsdGlSb290V29ya3NwYWNlID0gZm9sZGVycy5sZW5ndGggPiAxO1xuXG5cdFx0Ly8gT25seSBzZXQgY3dkRm9sZGVyIGlmIGRldGVjdGlvbiBpcyBvblxuXHRcdGlmICh0ZW1wbGF0ZVByb3BlcnRpZXMuY3dkICYmIGRldGVjdGlvbiAmJiAoIWluc3RhbmNlLnNoZWxsTGF1bmNoQ29uZmlnLmlzRmVhdHVyZVRlcm1pbmFsIHx8IGxhYmVsVHlwZSA9PT0gVGVybWluYWxMYWJlbFR5cGUuVGl0bGUpKSB7XG5cdFx0XHRjb25zdCBjd2RVcmkgPSBVUkkuZnJvbSh7XG5cdFx0XHRcdHNjaGVtZTogaW5zdGFuY2Uud29ya3NwYWNlRm9sZGVyPy51cmkuc2NoZW1lIHx8IFNjaGVtYXMuZmlsZSxcblx0XHRcdFx0cGF0aDogaW5zdGFuY2UuY3dkID8gcGF0aC5yZXNvbHZlKGluc3RhbmNlLmN3ZCkgOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXHRcdFx0Ly8gTXVsdGktcm9vdCB3b3Jrc3BhY2VzIGFsd2F5cyBzaG93IGN3ZEZvbGRlciB0byBkaXNhbWJpZ3VhdGUgdGhlbSwgb3RoZXJ3aXNlIG9ubHkgc2hvd1xuXHRcdFx0Ly8gd2hlbiBpdCBkaWZmZXJzIGZyb20gdGhlIHdvcmtzcGFjZSBmb2xkZXIgaW4gd2hpY2ggaXQgd2FzIGxhdW5jaGVkIGZyb21cblx0XHRcdGxldCBzaG93Q3dkID0gZmFsc2U7XG5cdFx0XHRpZiAobXVsdGlSb290V29ya3NwYWNlKSB7XG5cdFx0XHRcdHNob3dDd2QgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmIChpbnN0YW5jZS53b3Jrc3BhY2VGb2xkZXI/LnVyaSkge1xuXHRcdFx0XHRjb25zdCBjYXNlU2Vuc2l0aXZlID0gdGhpcy5fZmlsZVNlcnZpY2UuaGFzQ2FwYWJpbGl0eShpbnN0YW5jZS53b3Jrc3BhY2VGb2xkZXIudXJpLCBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUGF0aENhc2VTZW5zaXRpdmUpO1xuXHRcdFx0XHRzaG93Q3dkID0gY3dkVXJpLmZzUGF0aC5sb2NhbGVDb21wYXJlKGluc3RhbmNlLndvcmtzcGFjZUZvbGRlci51cmkuZnNQYXRoLCB1bmRlZmluZWQsIHsgc2Vuc2l0aXZpdHk6IGNhc2VTZW5zaXRpdmUgPyAnY2FzZScgOiAnYmFzZScgfSkgIT09IDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2hvd0N3ZCkge1xuXHRcdFx0XHR0ZW1wbGF0ZVByb3BlcnRpZXMuY3dkRm9sZGVyID0gcGF0aC5iYXNlbmFtZSh0ZW1wbGF0ZVByb3BlcnRpZXMuY3dkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZW1vdmUgc3BlY2lhbCBjaGFyYWN0ZXJzIHRoYXQgY291bGQgbWVzcyB3aXRoIHJlbmRlcmluZ1xuXHRcdGNvbnN0IGxhYmVsID0gdGVtcGxhdGUobGFiZWxUZW1wbGF0ZSwgKHRlbXBsYXRlUHJvcGVydGllcyBhcyB1bmtub3duKSBhcyB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB8IElTZXBhcmF0b3IgfCB1bmRlZmluZWQgfCBudWxsIH0pLnJlcGxhY2UoL1tcXG5cXHJcXHRdL2csICcnKS50cmltKCk7XG5cdFx0cmV0dXJuIGxhYmVsID09PSAnJyAmJiBsYWJlbFR5cGUgPT09IFRlcm1pbmFsTGFiZWxUeXBlLlRpdGxlID8gKGluc3RhbmNlLnByb2Nlc3NOYW1lIHx8ICcnKSA6IGxhYmVsO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0UHJvZ3Jlc3NTdGF0ZVN0cmluZyhwcm9ncmVzc1N0YXRlPzogSVByb2dyZXNzU3RhdGUpOiBzdHJpbmcge1xuXHRcdGlmICghcHJvZ3Jlc3NTdGF0ZSkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRzd2l0Y2ggKHByb2dyZXNzU3RhdGUuc3RhdGUpIHtcblx0XHRcdGNhc2UgMDogcmV0dXJuICcnO1xuXHRcdFx0Y2FzZSAxOiByZXR1cm4gYCR7TWF0aC5yb3VuZChwcm9ncmVzc1N0YXRlLnZhbHVlKX0lYDtcblx0XHRcdGNhc2UgMjogcmV0dXJuICckKGVycm9yKSc7XG5cdFx0XHRjYXNlIDM6IHJldHVybiAnJChsb2FkaW5nfnNwaW4pJztcblx0XHRcdGNhc2UgNDogcmV0dXJuICckKGFsZXJ0KSc7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUV4aXRSZXN1bHQoXG5cdGV4aXRDb2RlT3JFcnJvcjogSVRlcm1pbmFsTGF1bmNoRXJyb3IgfCBudW1iZXIgfCB1bmRlZmluZWQsXG5cdHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcsXG5cdHByb2Nlc3NTdGF0ZTogUHJvY2Vzc1N0YXRlLFxuXHRpbml0aWFsQ3dkOiBzdHJpbmcgfCB1bmRlZmluZWRcbik6IHsgY29kZTogbnVtYmVyIHwgdW5kZWZpbmVkOyBtZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZCB7XG5cdC8vIE9ubHkgcmV0dXJuIGEgbWVzc2FnZSBpZiB0aGUgZXhpdCBjb2RlIGlzIG5vbi16ZXJvXG5cdGlmIChleGl0Q29kZU9yRXJyb3IgPT09IHVuZGVmaW5lZCB8fCBleGl0Q29kZU9yRXJyb3IgPT09IDApIHtcblx0XHRyZXR1cm4geyBjb2RlOiBleGl0Q29kZU9yRXJyb3IsIG1lc3NhZ2U6IHVuZGVmaW5lZCB9O1xuXHR9XG5cblx0Y29uc3QgY29kZSA9IHR5cGVvZiBleGl0Q29kZU9yRXJyb3IgPT09ICdudW1iZXInID8gZXhpdENvZGVPckVycm9yIDogZXhpdENvZGVPckVycm9yLmNvZGU7XG5cblx0Ly8gQ3JlYXRlIGV4aXQgY29kZSBtZXNzYWdlXG5cdGxldCBtZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHN3aXRjaCAodHlwZW9mIGV4aXRDb2RlT3JFcnJvcikge1xuXHRcdGNhc2UgJ251bWJlcic6IHtcblx0XHRcdGxldCBjb21tYW5kTGluZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHNoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGUpIHtcblx0XHRcdFx0Y29tbWFuZExpbmUgPSBzaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlO1xuXHRcdFx0XHRpZiAodHlwZW9mIHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0Y29tbWFuZExpbmUgKz0gYCAke3NoZWxsTGF1bmNoQ29uZmlnLmFyZ3N9YDtcblx0XHRcdFx0fSBlbHNlIGlmIChzaGVsbExhdW5jaENvbmZpZy5hcmdzICYmIHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29tbWFuZExpbmUgKz0gc2hlbGxMYXVuY2hDb25maWcuYXJncy5tYXAoYSA9PiBgICcke2F9J2ApLmpvaW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHByb2Nlc3NTdGF0ZSA9PT0gUHJvY2Vzc1N0YXRlLktpbGxlZER1cmluZ0xhdW5jaCkge1xuXHRcdFx0XHRpZiAoY29tbWFuZExpbmUpIHtcblx0XHRcdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdsYXVuY2hGYWlsZWQuZXhpdENvZGVBbmRDb21tYW5kTGluZScsIFwiVGhlIHRlcm1pbmFsIHByb2Nlc3MgXFxcInswfVxcXCIgZmFpbGVkIHRvIGxhdW5jaCAoZXhpdCBjb2RlOiB7MX0pLlwiLCBjb21tYW5kTGluZSwgY29kZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnbGF1bmNoRmFpbGVkLmV4aXRDb2RlT25seScsIFwiVGhlIHRlcm1pbmFsIHByb2Nlc3MgZmFpbGVkIHRvIGxhdW5jaCAoZXhpdCBjb2RlOiB7MH0pLlwiLCBjb2RlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGNvbW1hbmRMaW5lKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgndGVybWluYXRlZC5leGl0Q29kZUFuZENvbW1hbmRMaW5lJywgXCJUaGUgdGVybWluYWwgcHJvY2VzcyBcXFwiezB9XFxcIiB0ZXJtaW5hdGVkIHdpdGggZXhpdCBjb2RlOiB7MX0uXCIsIGNvbW1hbmRMaW5lLCBjb2RlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCd0ZXJtaW5hdGVkLmV4aXRDb2RlT25seScsIFwiVGhlIHRlcm1pbmFsIHByb2Nlc3MgdGVybWluYXRlZCB3aXRoIGV4aXQgY29kZTogezB9LlwiLCBjb2RlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdGNhc2UgJ29iamVjdCc6IHtcblx0XHRcdC8vIElnbm9yZSBpbnRlcm5hbCBlcnJvcnNcblx0XHRcdGlmIChleGl0Q29kZU9yRXJyb3IubWVzc2FnZS50b1N0cmluZygpLmluY2x1ZGVzKCdDb3VsZCBub3QgZmluZCBwdHkgd2l0aCBpZCcpKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Ly8gQ29udmVydCBjb25wdHkgY29kZS1iYXNlZCBmYWlsdXJlcyBpbnRvIGh1bWFuIGZyaWVuZGx5IG1lc3NhZ2VzXG5cdFx0XHRsZXQgaW5uZXJNZXNzYWdlID0gZXhpdENvZGVPckVycm9yLm1lc3NhZ2U7XG5cdFx0XHRjb25zdCBjb25wdHlFcnJvciA9IGV4aXRDb2RlT3JFcnJvci5tZXNzYWdlLm1hdGNoKC8uKmVycm9yIGNvZGU6XFxzKihcXGQrKS4qJC8pO1xuXHRcdFx0aWYgKGNvbnB0eUVycm9yKSB7XG5cdFx0XHRcdGNvbnN0IGVycm9yQ29kZSA9IGNvbnB0eUVycm9yLmxlbmd0aCA+IDEgPyBwYXJzZUludChjb25wdHlFcnJvclsxXSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdHN3aXRjaCAoZXJyb3JDb2RlKSB7XG5cdFx0XHRcdFx0Y2FzZSA1OlxuXHRcdFx0XHRcdFx0aW5uZXJNZXNzYWdlID0gYEFjY2VzcyB3YXMgZGVuaWVkIHRvIHRoZSBwYXRoIGNvbnRhaW5pbmcgeW91ciBleGVjdXRhYmxlIFwiJHtzaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlfVwiLiBNYW5hZ2UgYW5kIGNoYW5nZSB5b3VyIHBlcm1pc3Npb25zIHRvIGdldCB0aGlzIHRvIHdvcmtgO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAyNjc6XG5cdFx0XHRcdFx0XHRpbm5lck1lc3NhZ2UgPSBgSW52YWxpZCBzdGFydGluZyBkaXJlY3RvcnkgXCIke2luaXRpYWxDd2R9XCIsIHJldmlldyB5b3VyIHRlcm1pbmFsLmludGVncmF0ZWQuY3dkIHNldHRpbmdgO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAxMjYwOlxuXHRcdFx0XHRcdFx0aW5uZXJNZXNzYWdlID0gYFdpbmRvd3MgY2Fubm90IG9wZW4gdGhpcyBwcm9ncmFtIGJlY2F1c2UgaXQgaGFzIGJlZW4gcHJldmVudGVkIGJ5IGEgc29mdHdhcmUgcmVzdHJpY3Rpb24gcG9saWN5LiBGb3IgbW9yZSBpbmZvcm1hdGlvbiwgb3BlbiBFdmVudCBWaWV3ZXIgb3IgY29udGFjdCB5b3VyIHN5c3RlbSBBZG1pbmlzdHJhdG9yYDtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdsYXVuY2hGYWlsZWQuZXJyb3JNZXNzYWdlJywgXCJUaGUgdGVybWluYWwgcHJvY2VzcyBmYWlsZWQgdG8gbGF1bmNoOiB7MH0uXCIsIGlubmVyTWVzc2FnZSk7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4geyBjb2RlLCBtZXNzYWdlIH07XG59XG5cblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsSW5zdGFuY2VDb2xvclByb3ZpZGVyIGltcGxlbWVudHMgSVh0ZXJtQ29sb3JQcm92aWRlciB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3RhcmdldDogSVJlZmVyZW5jZTxUZXJtaW5hbExvY2F0aW9uIHwgdW5kZWZpbmVkPixcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF92aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdCkge1xuXHR9XG5cblx0Z2V0QmFja2dyb3VuZENvbG9yKHRoZW1lOiBJQ29sb3JUaGVtZSkge1xuXHRcdGNvbnN0IHRlcm1pbmFsQmFja2dyb3VuZCA9IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX0JBQ0tHUk9VTkRfQ09MT1IpO1xuXHRcdGlmICh0ZXJtaW5hbEJhY2tncm91bmQpIHtcblx0XHRcdHJldHVybiB0ZXJtaW5hbEJhY2tncm91bmQ7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl90YXJnZXQub2JqZWN0ID09PSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvcikge1xuXHRcdFx0cmV0dXJuIHRoZW1lLmdldENvbG9yKGVkaXRvckJhY2tncm91bmQpO1xuXHRcdH1cblx0XHRjb25zdCBsb2NhdGlvbiA9IHRoaXMuX3ZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3TG9jYXRpb25CeUlkKFRFUk1JTkFMX1ZJRVdfSUQpITtcblx0XHRpZiAobG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCkge1xuXHRcdFx0cmV0dXJuIHRoZW1lLmdldENvbG9yKFBBTkVMX0JBQ0tHUk9VTkQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhlbWUuZ2V0Q29sb3IoU0lERV9CQVJfQkFDS0dST1VORCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ3Vlc3NTaGVsbFR5cGVGcm9tRXhlY3V0YWJsZShvczogT3BlcmF0aW5nU3lzdGVtLCBleGVjdXRhYmxlOiBzdHJpbmcpOiBUZXJtaW5hbFNoZWxsVHlwZSB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGV4ZUJhc2VuYW1lID0gcGF0aC5iYXNlbmFtZShleGVjdXRhYmxlKTtcblx0Y29uc3QgZ2VuZXJhbFNoZWxsVHlwZU1hcDogTWFwPFRlcm1pbmFsU2hlbGxUeXBlLCBSZWdFeHA+ID0gbmV3IE1hcChbXG5cdFx0W0dlbmVyYWxTaGVsbFR5cGUuSnVsaWEsIC9eanVsaWEkL10sXG5cdFx0W0dlbmVyYWxTaGVsbFR5cGUuTm9kZSwgL15ub2RlJC9dLFxuXHRcdFtHZW5lcmFsU2hlbGxUeXBlLk51U2hlbGwsIC9ebnUkL10sXG5cdFx0W0dlbmVyYWxTaGVsbFR5cGUuUG93ZXJTaGVsbCwgL15wd3NoKC1wcmV2aWV3KT98cG93ZXJzaGVsbCQvXSxcblx0XHRbR2VuZXJhbFNoZWxsVHlwZS5QeXRob24sIC9ecHkoPzp0aG9uKT8kL11cblx0XSk7XG5cdGZvciAoY29uc3QgW3NoZWxsVHlwZSwgcGF0dGVybl0gb2YgZ2VuZXJhbFNoZWxsVHlwZU1hcCkge1xuXHRcdGlmIChleGVCYXNlbmFtZS5tYXRjaChwYXR0ZXJuKSkge1xuXHRcdFx0cmV0dXJuIHNoZWxsVHlwZTtcblx0XHR9XG5cdH1cblxuXHRpZiAob3MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKSB7XG5cdFx0Y29uc3Qgd2luZG93c1NoZWxsVHlwZU1hcDogTWFwPFRlcm1pbmFsU2hlbGxUeXBlLCBSZWdFeHA+ID0gbmV3IE1hcChbXG5cdFx0XHRbV2luZG93c1NoZWxsVHlwZS5Db21tYW5kUHJvbXB0LCAvXmNtZCQvXSxcblx0XHRcdFtXaW5kb3dzU2hlbGxUeXBlLkdpdEJhc2gsIC9eYmFzaCQvXSxcblx0XHRcdFtXaW5kb3dzU2hlbGxUeXBlLldzbCwgL153c2wkL11cblx0XHRdKTtcblx0XHRmb3IgKGNvbnN0IFtzaGVsbFR5cGUsIHBhdHRlcm5dIG9mIHdpbmRvd3NTaGVsbFR5cGVNYXApIHtcblx0XHRcdGlmIChleGVCYXNlbmFtZS5tYXRjaChwYXR0ZXJuKSkge1xuXHRcdFx0XHRyZXR1cm4gc2hlbGxUeXBlO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRjb25zdCBwb3NpeFNoZWxsVHlwZXM6IFBvc2l4U2hlbGxUeXBlW10gPSBbXG5cdFx0XHRQb3NpeFNoZWxsVHlwZS5CYXNoLFxuXHRcdFx0UG9zaXhTaGVsbFR5cGUuQ3NoLFxuXHRcdFx0UG9zaXhTaGVsbFR5cGUuRmlzaCxcblx0XHRcdFBvc2l4U2hlbGxUeXBlLktzaCxcblx0XHRcdFBvc2l4U2hlbGxUeXBlLlNoLFxuXHRcdFx0UG9zaXhTaGVsbFR5cGUuWnNoLFxuXHRcdF07XG5cdFx0Zm9yIChjb25zdCB0eXBlIG9mIHBvc2l4U2hlbGxUeXBlcykge1xuXHRcdFx0aWYgKGV4ZUJhc2VuYW1lID09PSB0eXBlKSB7XG5cdFx0XHRcdHJldHVybiB0eXBlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHFCQUFxQjtBQUM5QixZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxpQkFBMEIsVUFBVSxtQkFBbUIsZUFBZTtBQUMvRSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxvQkFBb0IseUJBQXlCO0FBQ3RELFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsZUFBZTtBQUN4QixTQUFxQixnQkFBZ0I7QUFDckMsU0FBUyxZQUFZLGVBQWUsaUJBQThCLG1CQUFtQixtQkFBbUIsU0FBUyxvQkFBcUM7QUFDdEosU0FBUyxlQUFlO0FBQ3hCLFlBQVksVUFBVTtBQUN0QixTQUFTLElBQUksaUJBQWlCLGFBQWEsaUJBQWlCO0FBQzVELFNBQVMs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QXNELG9CQUFJLElBQUk7QUFBQSxNQUNuRSxDQUFDLGlCQUFpQixlQUFlLE9BQU87QUFBQSxNQUN4QyxDQUFDLGlCQUFpQixTQUFTLFFBQVE7QUFBQSxNQUNuQyxDQUFDLGlCQUFpQixLQUFLLE9BQU87QUFBQSxJQUMvQixDQUFDO0FBQ0QsZUFBVyxDQUFDLFdBQVcsT0FBTyxLQUFLLHFCQUFxQjtBQUN2RCxVQUFJLFlBQVksTUFBTSxPQUFPLEdBQUc7QUFDL0IsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQUEsRUFDRCxPQUFPO0FBQ04sVUFBTSxrQkFBb0M7QUFBQSxNQUN6QyxlQUFlO0FBQUEsTUFDZixlQUFlO0FBQUEsTUFDZixlQUFlO0FBQUEsTUFDZixlQUFlO0FBQUEsTUFDZixlQUFlO0FBQUEsTUFDZixlQUFlO0FBQUEsSUFDaEI7QUFDQSxlQUFXLFFBQVEsaUJBQWlCO0FBQ25DLFVBQUksZ0JBQWdCLE1BQU07QUFDekIsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNBLFNBQU87QUFDUjsiLAogICJuYW1lcyI6IFsiQ29uc3RhbnRzIiwgInh0ZXJtIiwgInBhdGgiLCAiZSIsICJpIiwgIlRlcm1pbmFsTGFiZWxUeXBlIl0KfQo=
