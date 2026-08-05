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
import * as domStylesheets from "../../../../base/browser/domStylesheets.js";
import * as cssValue from "../../../../base/browser/cssValue.js";
import { DeferredPromise, timeout } from "../../../../base/common/async.js";
import { debounce, memoize } from "../../../../base/common/decorators.js";
import { DynamicListEventMultiplexer, Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isMacintosh, isWeb } from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import * as nls from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ITerminalLogService, TerminalExitReason, TerminalLocation, TerminalLocationString, TitleEventSource } from "../../../../platform/terminal/common/terminal.js";
import { formatMessageForTerminal } from "../../../../platform/terminal/common/terminalStrings.js";
import { iconForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { getIconRegistry } from "../../../../platform/theme/common/iconRegistry.js";
import { ColorScheme } from "../../../../platform/theme/common/theme.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { VirtualWorkspaceContext } from "../../../common/contextkeys.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { ITerminalConfigurationService, ITerminalEditorService, ITerminalGroupService, ITerminalInstanceService, ITerminalService, TerminalConnectionState } from "./terminal.js";
import { getCwdForSplit } from "./terminalActions.js";
import { TerminalEditorInput } from "./terminalEditorInput.js";
import { getColorStyleContent, getUriClasses } from "./terminalIcon.js";
import { TerminalProfileQuickpick } from "./terminalProfileQuickpick.js";
import { getInstanceFromResource, getTerminalUri, parseTerminalUri } from "./terminalUri.js";
import { ITerminalProfileService, TERMINAL_VIEW_ID } from "../common/terminal.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { columnToEditorGroup } from "../../../services/editor/common/editorGroupColumn.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { AUX_WINDOW_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ILifecycleService, ShutdownReason, StartupKind } from "../../../services/lifecycle/common/lifecycle.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { XtermTerminal } from "./xterm/xtermTerminal.js";
import { TerminalInstance } from "./terminalInstance.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { TerminalCapabilityStore } from "../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
import { mark } from "../../../../base/common/performance.js";
import { DetachedTerminal } from "./detachedTerminal.js";
import { createInstanceCapabilityEventMultiplexer } from "./terminalEvents.js";
import { mainWindow } from "../../../../base/browser/window.js";
let TerminalService = class extends Disposable {
  constructor(_contextKeyService, _lifecycleService, _logService, _dialogService, _instantiationService, _remoteAgentService, _viewsService, _configurationService, _terminalConfigService, _environmentService, _terminalConfigurationService, _terminalEditorService, _terminalGroupService, _terminalInstanceService, _editorGroupsService, _terminalProfileService, _extensionService, _notificationService, _workspaceContextService, _commandService, _keybindingService, _timerService) {
    super();
    this._contextKeyService = _contextKeyService;
    this._lifecycleService = _lifecycleService;
    this._logService = _logService;
    this._dialogService = _dialogService;
    this._instantiationService = _instantiationService;
    this._remoteAgentService = _remoteAgentService;
    this._viewsService = _viewsService;
    this._configurationService = _configurationService;
    this._terminalConfigService = _terminalConfigService;
    this._environmentService = _environmentService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalEditorService = _terminalEditorService;
    this._terminalGroupService = _terminalGroupService;
    this._terminalInstanceService = _terminalInstanceService;
    this._editorGroupsService = _editorGroupsService;
    this._terminalProfileService = _terminalProfileService;
    this._extensionService = _extensionService;
    this._notificationService = _notificationService;
    this._workspaceContextService = _workspaceContextService;
    this._commandService = _commandService;
    this._keybindingService = _keybindingService;
    this._timerService = _timerService;
    this._hostActiveTerminals = /* @__PURE__ */ new Map();
    this._detachedXterms = /* @__PURE__ */ new Set();
    this._isShuttingDown = false;
    this._backgroundedTerminalInstances = [];
    this._backgroundedTerminalDisposables = /* @__PURE__ */ new Map();
    this._connectionState = TerminalConnectionState.Connecting;
    this._whenConnected = new DeferredPromise();
    this._restoredGroupCount = 0;
    this._reconnectedTerminals = /* @__PURE__ */ new Map();
    this._onDidCreateInstance = this._register(new Emitter());
    this._onDidChangeInstanceDimensions = this._register(new Emitter());
    this._onDidRegisterProcessSupport = this._register(new Emitter());
    this._onDidChangeConnectionState = this._register(new Emitter());
    this._onDidRequestStartExtensionTerminal = this._register(new Emitter());
    // ITerminalInstanceHost events
    this._onDidDisposeInstance = this._register(new Emitter());
    this._onDidFocusInstance = this._register(new Emitter());
    this._onDidChangeActiveInstance = this._register(new Emitter());
    this._onDidChangeInstances = this._register(new Emitter());
    this._onDidChangeInstanceCapability = this._register(new Emitter());
    // Terminal view events
    this._onDidChangeActiveGroup = this._register(new Emitter());
    this._register(this.onDidCreateInstance(() => this._terminalProfileService.refreshAvailableProfiles()));
    this._forwardInstanceHostEvents(this._terminalGroupService);
    this._forwardInstanceHostEvents(this._terminalEditorService);
    this._register(this._terminalGroupService.onDidChangeActiveGroup(this._onDidChangeActiveGroup.fire, this._onDidChangeActiveGroup));
    this._register(this._terminalInstanceService.onDidCreateInstance((instance) => {
      this._initInstanceListeners(instance);
      this._onDidCreateInstance.fire(instance);
    }));
    this._register(this._terminalGroupService.onDidChangeActiveInstance((instance) => {
      if (!instance && !this._isShuttingDown && this._terminalConfigService.config.hideOnLastClosed) {
        this._terminalGroupService.hidePanel();
      }
      if (instance?.shellType) {
        this._terminalShellTypeContextKey.set(instance.shellType.toString());
      } else if (!instance || !instance.shellType) {
        this._terminalShellTypeContextKey.reset();
      }
    }));
    this._handleInstanceContextKeys();
    this._terminalShellTypeContextKey = TerminalContextKeys.shellType.bindTo(this._contextKeyService);
    this._processSupportContextKey = TerminalContextKeys.processSupported.bindTo(this._contextKeyService);
    this._processSupportContextKey.set(!isWeb || this._remoteAgentService.getConnection() !== null);
    this._terminalHasBeenCreated = TerminalContextKeys.terminalHasBeenCreated.bindTo(this._contextKeyService);
    this._terminalCountContextKey = TerminalContextKeys.count.bindTo(this._contextKeyService);
    this._terminalEditorActive = TerminalContextKeys.terminalEditorActive.bindTo(this._contextKeyService);
    this._register(this.onDidChangeActiveInstance((instance) => {
      this._terminalEditorActive.set(!!instance?.target && instance.target === TerminalLocation.Editor);
    }));
    this._register(_lifecycleService.onBeforeShutdown(async (e) => e.veto(this._onBeforeShutdown(e.reason), "veto.terminal")));
    this._register(_lifecycleService.onWillShutdown((e) => this._onWillShutdown(e)));
    this._initializePrimaryBackend();
    timeout(0).then(() => this._register(this._instantiationService.createInstance(TerminalEditorStyle, mainWindow.document.head)));
  }
  get isProcessSupportRegistered() {
    return !!this._processSupportContextKey.get();
  }
  get connectionState() {
    return this._connectionState;
  }
  get whenConnected() {
    return this._whenConnected.p;
  }
  get restoredGroupCount() {
    return this._restoredGroupCount;
  }
  get instances() {
    return this._terminalGroupService.instances.concat(this._terminalEditorService.instances).concat(this._backgroundedTerminalInstances);
  }
  /** Gets all non-background terminals. */
  get foregroundInstances() {
    return this._terminalGroupService.instances.concat(this._terminalEditorService.instances);
  }
  get detachedInstances() {
    return this._detachedXterms;
  }
  getReconnectedTerminals(reconnectionOwner) {
    return this._reconnectedTerminals.get(reconnectionOwner);
  }
  get defaultLocation() {
    return this._terminalConfigurationService.config.defaultLocation === TerminalLocationString.Editor ? TerminalLocation.Editor : TerminalLocation.Panel;
  }
  get activeInstance() {
    for (const activeHostTerminal of this._hostActiveTerminals.values()) {
      if (activeHostTerminal?.hasFocus) {
        return activeHostTerminal;
      }
    }
    return this._activeInstance;
  }
  get onDidCreateInstance() {
    return this._onDidCreateInstance.event;
  }
  get onDidChangeInstanceDimensions() {
    return this._onDidChangeInstanceDimensions.event;
  }
  get onDidRegisterProcessSupport() {
    return this._onDidRegisterProcessSupport.event;
  }
  get onDidChangeConnectionState() {
    return this._onDidChangeConnectionState.event;
  }
  get onDidRequestStartExtensionTerminal() {
    return this._onDidRequestStartExtensionTerminal.event;
  }
  get onDidDisposeInstance() {
    return this._onDidDisposeInstance.event;
  }
  get onDidFocusInstance() {
    return this._onDidFocusInstance.event;
  }
  get onDidChangeActiveInstance() {
    return this._onDidChangeActiveInstance.event;
  }
  get onDidChangeInstances() {
    return this._onDidChangeInstances.event;
  }
  get onDidChangeInstanceCapability() {
    return this._onDidChangeInstanceCapability.event;
  }
  get onDidChangeActiveGroup() {
    return this._onDidChangeActiveGroup.event;
  }
  get onAnyInstanceData() {
    return this._register(this.createOnInstanceEvent((instance) => Event.map(instance.onData, (data) => ({ instance, data })))).event;
  }
  get onAnyInstanceDataInput() {
    return this._register(this.createOnInstanceEvent((e) => Event.map(e.onDidInputData, () => e, e.store))).event;
  }
  get onAnyInstanceIconChange() {
    return this._register(this.createOnInstanceEvent((e) => e.onIconChanged)).event;
  }
  get onAnyInstanceMaximumDimensionsChange() {
    return this._register(this.createOnInstanceEvent((e) => Event.map(e.onMaximumDimensionsChanged, () => e, e.store))).event;
  }
  get onAnyInstancePrimaryStatusChange() {
    return this._register(this.createOnInstanceEvent((e) => Event.map(e.statusList.onDidChangePrimaryStatus, () => e, e.store))).event;
  }
  get onAnyInstanceProcessIdReady() {
    return this._register(this.createOnInstanceEvent((e) => e.onProcessIdReady)).event;
  }
  get onAnyInstanceSelectionChange() {
    return this._register(this.createOnInstanceEvent((e) => e.onDidChangeSelection)).event;
  }
  get onAnyInstanceTitleChange() {
    return this._register(this.createOnInstanceEvent((e) => e.onTitleChanged)).event;
  }
  get onAnyInstanceShellTypeChanged() {
    return this._register(this.createOnInstanceEvent((e) => Event.map(e.onDidChangeShellType, () => e))).event;
  }
  get onAnyInstanceAddedCapabilityType() {
    return this._register(this.createOnInstanceEvent((e) => e.capabilities.onDidAddCapabilityType)).event;
  }
  async showProfileQuickPick(type, cwd) {
    const quickPick = this._instantiationService.createInstance(TerminalProfileQuickpick);
    const result = await quickPick.showAndGetResult(type);
    if (!result) {
      return;
    }
    if (typeof result === "string") {
      return;
    }
    const keyMods = result.keyMods;
    if (type === "createInstance") {
      const activeInstance = this.getDefaultInstanceHost().activeInstance;
      let instance;
      if (result.config && "id" in result?.config) {
        await this.createContributedTerminalProfile(result.config.extensionIdentifier, result.config.id, {
          icon: result.config.options?.icon,
          color: result.config.options?.color,
          location: !!(keyMods?.alt && activeInstance) ? { splitActiveTerminal: true } : this.defaultLocation
        });
        return;
      } else if (result.config && "profileName" in result.config) {
        if (keyMods?.alt && activeInstance) {
          instance = await this.createTerminal({ location: { parentTerminal: activeInstance }, config: result.config, cwd });
        } else {
          instance = await this.createTerminal({ location: this.defaultLocation, config: result.config, cwd });
        }
      }
      if (instance && this.defaultLocation !== TerminalLocation.Editor) {
        this._terminalGroupService.showPanel(true);
        this.setActiveInstance(instance);
        return instance;
      }
    }
    return void 0;
  }
  async _initializePrimaryBackend() {
    mark("code/terminal/willGetTerminalBackend");
    this._primaryBackend = await this._terminalInstanceService.getBackend(this._environmentService.remoteAuthority);
    mark("code/terminal/didGetTerminalBackend");
    const enableTerminalReconnection = this._terminalConfigurationService.config.enablePersistentSessions;
    this._connectionState = TerminalConnectionState.Connecting;
    const isPersistentRemote = !!this._environmentService.remoteAuthority && enableTerminalReconnection;
    if (this._primaryBackend) {
      this._register(this._primaryBackend.onDidRequestDetach(async (e) => {
        const instanceToDetach = this.getInstanceFromResource(getTerminalUri(e.workspaceId, e.instanceId));
        if (instanceToDetach) {
          const persistentProcessId = instanceToDetach?.persistentProcessId;
          if (persistentProcessId && !instanceToDetach.shellLaunchConfig.isFeatureTerminal && !instanceToDetach.shellLaunchConfig.customPtyImplementation) {
            if (instanceToDetach.target === TerminalLocation.Editor) {
              this._terminalEditorService.detachInstance(instanceToDetach);
            } else {
              this._terminalGroupService.getGroupForInstance(instanceToDetach)?.removeInstance(instanceToDetach);
            }
            await instanceToDetach.detachProcessAndDispose(TerminalExitReason.User);
            await this._primaryBackend?.acceptDetachInstanceReply(e.requestId, persistentProcessId);
          } else {
            await this._primaryBackend?.acceptDetachInstanceReply(e.requestId, void 0);
          }
        }
      }));
    }
    mark("code/terminal/willReconnect");
    let reconnectedPromise;
    if (isPersistentRemote) {
      reconnectedPromise = this._reconnectToRemoteTerminals();
    } else if (enableTerminalReconnection) {
      reconnectedPromise = this._reconnectToLocalTerminals();
    } else {
      reconnectedPromise = Promise.resolve();
    }
    reconnectedPromise.then(async () => {
      this._setConnected();
      mark("code/terminal/didReconnect");
      mark("code/terminal/willReplay");
      const instances = await this._reconnectedTerminalGroups?.then((groups) => groups.map((e) => e.terminalInstances).flat()) ?? [];
      await Promise.all(instances.map((e) => new Promise((r) => Event.once(e.onProcessReplayComplete)(r))));
      mark("code/terminal/didReplay");
      mark("code/terminal/willGetPerformanceMarks");
      await Promise.all(Array.from(this._terminalInstanceService.getRegisteredBackends()).map(async (backend) => {
        this._timerService.setPerformanceMarks(backend.remoteAuthority === void 0 ? "localPtyHost" : "remotePtyHost", await backend.getPerformanceMarks());
        backend.setReady();
      }));
      mark("code/terminal/didGetPerformanceMarks");
      this._whenConnected.complete();
    });
  }
  getPrimaryBackend() {
    return this._primaryBackend;
  }
  _forwardInstanceHostEvents(host) {
    this._register(host.onDidChangeInstances(this._onDidChangeInstances.fire, this._onDidChangeInstances));
    this._register(host.onDidDisposeInstance(this._onDidDisposeInstance.fire, this._onDidDisposeInstance));
    this._register(host.onDidChangeActiveInstance((instance) => this._evaluateActiveInstance(host, instance)));
    this._register(host.onDidFocusInstance((instance) => {
      this._onDidFocusInstance.fire(instance);
      this._evaluateActiveInstance(host, instance);
    }));
    this._register(host.onDidChangeInstanceCapability((instance) => {
      this._onDidChangeInstanceCapability.fire(instance);
    }));
    this._hostActiveTerminals.set(host, void 0);
  }
  _evaluateActiveInstance(host, instance) {
    this._hostActiveTerminals.set(host, instance);
    if (instance === void 0) {
      for (const active of this._hostActiveTerminals.values()) {
        if (active) {
          instance = active;
        }
      }
    }
    this._activeInstance = instance;
    this._onDidChangeActiveInstance.fire(instance);
  }
  setActiveInstance(value) {
    if (value.shellLaunchConfig.hideFromUser) {
      this._showBackgroundTerminal(value);
    }
    if (value.target === TerminalLocation.Editor) {
      this._terminalEditorService.setActiveInstance(value);
    } else {
      this._terminalGroupService.setActiveInstance(value);
    }
  }
  async focusInstance(instance) {
    if (instance.target === TerminalLocation.Editor) {
      return this._terminalEditorService.focusInstance(instance);
    }
    return this._terminalGroupService.focusInstance(instance);
  }
  async focusActiveInstance() {
    if (!this._activeInstance) {
      return;
    }
    return this.focusInstance(this._activeInstance);
  }
  async createContributedTerminalProfile(extensionIdentifier, id, options) {
    await this._extensionService.activateByEvent(`onTerminalProfile:${id}`);
    const profileProvider = this._terminalProfileService.getContributedProfileProvider(extensionIdentifier, id);
    if (!profileProvider) {
      this._notificationService.error(`No terminal profile provider registered for id "${id}"`);
      return;
    }
    try {
      await profileProvider.createContributedTerminalProfile(options);
      this._terminalGroupService.setActiveInstanceByIndex(this._terminalGroupService.instances.length - 1);
      await this._terminalGroupService.activeInstance?.focusWhenReady();
    } catch (e) {
      this._notificationService.error(e.message);
    }
  }
  async safeDisposeTerminal(instance) {
    if (instance.target !== TerminalLocation.Editor && instance.hasChildProcesses && (this._terminalConfigurationService.config.confirmOnKill === "panel" || this._terminalConfigurationService.config.confirmOnKill === "always")) {
      const veto = await this._showTerminalCloseConfirmation(true);
      if (veto) {
        return;
      }
    }
    return new Promise((r) => {
      Event.once(instance.onExit)(() => r());
      instance.dispose(TerminalExitReason.User);
    });
  }
  _setConnected() {
    this._connectionState = TerminalConnectionState.Connected;
    this._onDidChangeConnectionState.fire();
    this._logService.trace("Pty host ready");
  }
  async _reconnectToRemoteTerminals() {
    const remoteAuthority = this._environmentService.remoteAuthority;
    if (!remoteAuthority) {
      return;
    }
    const backend = await this._terminalInstanceService.getBackend(remoteAuthority);
    if (!backend) {
      return;
    }
    mark("code/terminal/willGetTerminalLayoutInfo");
    const layoutInfo = await backend.getTerminalLayoutInfo();
    mark("code/terminal/didGetTerminalLayoutInfo");
    backend.reduceConnectionGraceTime();
    mark("code/terminal/willRecreateTerminalGroups");
    await this._recreateTerminalGroups(layoutInfo);
    mark("code/terminal/didRecreateTerminalGroups");
    this._attachProcessLayoutListeners();
    this._logService.trace("Reconnected to remote terminals");
  }
  async _reconnectToLocalTerminals() {
    const localBackend = await this._terminalInstanceService.getBackend();
    if (!localBackend) {
      return;
    }
    mark("code/terminal/willGetTerminalLayoutInfo");
    const layoutInfo = await localBackend.getTerminalLayoutInfo();
    mark("code/terminal/didGetTerminalLayoutInfo");
    if (layoutInfo && layoutInfo.tabs.length > 0) {
      mark("code/terminal/willRecreateTerminalGroups");
      this._reconnectedTerminalGroups = this._recreateTerminalGroups(layoutInfo);
      mark("code/terminal/didRecreateTerminalGroups");
    }
    this._attachProcessLayoutListeners();
    this._logService.trace("Reconnected to local terminals");
  }
  _recreateTerminalGroups(layoutInfo) {
    const groupPromises = [];
    let activeGroup;
    if (layoutInfo) {
      for (const tabLayout of layoutInfo.tabs) {
        const terminalLayouts = tabLayout.terminals.filter((t) => t.terminal && t.terminal.isOrphan);
        if (terminalLayouts.length) {
          this._restoredGroupCount += terminalLayouts.length;
          const promise = this._recreateTerminalGroup(tabLayout, terminalLayouts);
          groupPromises.push(promise);
          if (tabLayout.isActive) {
            activeGroup = promise;
          }
          const activeInstance = this.instances.find((t) => t.shellLaunchConfig.attachPersistentProcess?.id === tabLayout.activePersistentProcessId);
          if (activeInstance) {
            this.setActiveInstance(activeInstance);
          }
        }
      }
      if (layoutInfo.tabs.length) {
        activeGroup?.then((group) => this._terminalGroupService.activeGroup = group);
      }
    }
    return Promise.all(groupPromises).then((result) => result.filter((e) => !!e));
  }
  async _recreateTerminalGroup(tabLayout, terminalLayouts) {
    let lastInstance;
    for (const terminalLayout of terminalLayouts) {
      const attachPersistentProcess = terminalLayout.terminal;
      if (this._lifecycleService.startupKind !== StartupKind.ReloadedWindow && attachPersistentProcess.type === "Task") {
        continue;
      }
      mark(`code/terminal/willRecreateTerminal/${attachPersistentProcess.id}-${attachPersistentProcess.pid}`);
      lastInstance = this.createTerminal({
        config: { attachPersistentProcess },
        location: lastInstance ? { parentTerminal: lastInstance } : TerminalLocation.Panel
      });
      lastInstance.then(() => mark(`code/terminal/didRecreateTerminal/${attachPersistentProcess.id}-${attachPersistentProcess.pid}`));
    }
    const group = lastInstance?.then((instance) => {
      const g = this._terminalGroupService.getGroupForInstance(instance);
      g?.resizePanes(tabLayout.terminals.map((terminal) => terminal.relativeSize));
      return g;
    });
    return group;
  }
  _attachProcessLayoutListeners() {
    this._register(this.onDidChangeActiveGroup(() => this._saveState()));
    this._register(this.onDidChangeActiveInstance(() => this._saveState()));
    this._register(this.onDidChangeInstances(() => this._saveState()));
    this._register(this.onAnyInstanceProcessIdReady(() => this._saveState()));
    this._register(this.onAnyInstanceTitleChange((instance) => this._updateTitle(instance)));
    this._register(this.onAnyInstanceIconChange((e) => this._updateIcon(e.instance, e.userInitiated)));
  }
  _handleInstanceContextKeys() {
    const terminalIsOpenContext = TerminalContextKeys.isOpen.bindTo(this._contextKeyService);
    const updateTerminalContextKeys = () => {
      terminalIsOpenContext.set(this.instances.length > 0);
      this._terminalCountContextKey.set(this.instances.length);
    };
    this._register(this.onDidChangeInstances(() => updateTerminalContextKeys()));
  }
  async getActiveOrCreateInstance(options) {
    const activeInstance = this.activeInstance;
    if (!activeInstance) {
      return this.createTerminal();
    }
    if (!options?.acceptsInput || activeInstance.xterm?.isStdinDisabled !== true) {
      return activeInstance;
    }
    const instance = await this.createTerminal();
    this.setActiveInstance(instance);
    await this.revealActiveTerminal();
    return instance;
  }
  async revealTerminal(source, preserveFocus) {
    if (source.target === TerminalLocation.Editor) {
      await this._terminalEditorService.revealActiveEditor(preserveFocus);
    } else {
      await this._terminalGroupService.showPanel();
    }
  }
  async revealActiveTerminal(preserveFocus) {
    const instance = this.activeInstance;
    if (!instance) {
      return;
    }
    await this.revealTerminal(instance, preserveFocus);
  }
  setEditable(instance, data) {
    if (!data) {
      this._editable = void 0;
    } else {
      this._editable = { instance, data };
    }
    const pane = this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
    const isEditing = this.isEditable(instance);
    pane?.terminalTabbedView?.setEditable(isEditing);
  }
  isEditable(instance) {
    return !!this._editable && (this._editable.instance === instance || !instance);
  }
  getEditableData(instance) {
    return this._editable && this._editable.instance === instance ? this._editable.data : void 0;
  }
  requestStartExtensionTerminal(proxy, cols, rows) {
    return new Promise((callback) => {
      this._onDidRequestStartExtensionTerminal.fire({ proxy, cols, rows, callback });
    });
  }
  _onBeforeShutdown(reason) {
    if (isWeb) {
      this._isShuttingDown = true;
      return false;
    }
    return this._onBeforeShutdownAsync(reason);
  }
  async _onBeforeShutdownAsync(reason) {
    if (this.instances.length === 0) {
      return false;
    }
    try {
      this._shutdownWindowCount = await this._nativeDelegate?.getWindowCount();
      const shouldReviveProcesses = this._shouldReviveProcesses(reason);
      if (shouldReviveProcesses) {
        await Promise.race([
          this._primaryBackend?.persistTerminalState(),
          timeout(2e3)
        ]);
      }
      const shouldPersistProcesses = this._terminalConfigurationService.config.enablePersistentSessions && reason === ShutdownReason.RELOAD;
      if (!shouldPersistProcesses) {
        const hasDirtyInstances = this._terminalConfigurationService.config.confirmOnExit === "always" && this.foregroundInstances.length > 0 || this._terminalConfigurationService.config.confirmOnExit === "hasChildProcesses" && this.foregroundInstances.some((e) => e.hasChildProcesses);
        if (hasDirtyInstances) {
          return this._onBeforeShutdownConfirmation(reason);
        }
      }
    } catch (err) {
      this._logService.warn("Exception occurred during terminal shutdown", err);
    }
    this._isShuttingDown = true;
    return false;
  }
  setNativeDelegate(nativeDelegate) {
    this._nativeDelegate = nativeDelegate;
  }
  _shouldReviveProcesses(reason) {
    if (!this._terminalConfigurationService.config.enablePersistentSessions) {
      return false;
    }
    switch (this._terminalConfigurationService.config.persistentSessionReviveProcess) {
      case "onExit": {
        if (reason === ShutdownReason.CLOSE && (this._shutdownWindowCount === 1 && !isMacintosh)) {
          return true;
        }
        return reason === ShutdownReason.LOAD || reason === ShutdownReason.QUIT;
      }
      case "onExitAndWindowClose":
        return reason !== ShutdownReason.RELOAD;
      default:
        return false;
    }
  }
  async _onBeforeShutdownConfirmation(reason) {
    const veto = await this._showTerminalCloseConfirmation();
    if (!veto) {
      this._isShuttingDown = true;
    }
    return veto;
  }
  _onWillShutdown(e) {
    const shouldPersistTerminals = this._terminalConfigurationService.config.enablePersistentSessions && e.reason === ShutdownReason.RELOAD;
    for (const instance of [...this._terminalGroupService.instances, ...this._backgroundedTerminalInstances]) {
      if (shouldPersistTerminals && instance.shouldPersist) {
        instance.detachProcessAndDispose(TerminalExitReason.Shutdown);
      } else {
        instance.dispose(TerminalExitReason.Shutdown);
      }
    }
    if (!shouldPersistTerminals && !this._shouldReviveProcesses(e.reason)) {
      this._primaryBackend?.setTerminalLayoutInfo(void 0);
    }
  }
  _saveState() {
    if (this._isShuttingDown) {
      return;
    }
    if (!this._terminalConfigurationService.config.enablePersistentSessions) {
      return;
    }
    const tabs = this._terminalGroupService.groups.map((g) => g.getLayoutInfo(g === this._terminalGroupService.activeGroup));
    const state = { tabs };
    this._primaryBackend?.setTerminalLayoutInfo(state);
  }
  _updateTitle(instance) {
    if (!this._terminalConfigurationService.config.enablePersistentSessions || !instance || !instance.persistentProcessId || !instance.title || instance.isDisposed) {
      return;
    }
    if (instance.staticTitle) {
      this._primaryBackend?.updateTitle(instance.persistentProcessId, instance.staticTitle, TitleEventSource.Api);
    } else {
      this._primaryBackend?.updateTitle(instance.persistentProcessId, instance.title, instance.titleSource);
    }
  }
  _updateIcon(instance, userInitiated) {
    if (!this._terminalConfigurationService.config.enablePersistentSessions || !instance || !instance.persistentProcessId || !instance.icon || instance.isDisposed) {
      return;
    }
    this._primaryBackend?.updateIcon(instance.persistentProcessId, userInitiated, instance.icon, instance.color);
  }
  refreshActiveGroup() {
    this._onDidChangeActiveGroup.fire(this._terminalGroupService.activeGroup);
  }
  getInstanceFromId(terminalId) {
    let bgIndex = -1;
    this._backgroundedTerminalInstances.forEach((terminalInstance, i) => {
      if (terminalInstance.instanceId === terminalId) {
        bgIndex = i;
      }
    });
    if (bgIndex !== -1) {
      return this._backgroundedTerminalInstances[bgIndex];
    }
    try {
      return this.instances[this._getIndexFromId(terminalId)];
    } catch {
      return void 0;
    }
  }
  getInstanceFromIndex(terminalIndex) {
    return this.instances[terminalIndex];
  }
  getInstanceFromResource(resource) {
    return getInstanceFromResource(this.instances, resource);
  }
  isAttachedToTerminal(remoteTerm) {
    return this.instances.some((term) => term.processId === remoteTerm.pid);
  }
  moveToEditor(source, group) {
    if (source.target === TerminalLocation.Editor) {
      return;
    }
    const sourceGroup = this._terminalGroupService.getGroupForInstance(source);
    if (!sourceGroup) {
      return;
    }
    sourceGroup.removeInstance(source);
    this._terminalEditorService.openEditor(source, group ? { viewColumn: group } : void 0);
  }
  moveIntoNewEditor(source) {
    this.moveToEditor(source, AUX_WINDOW_GROUP);
  }
  async moveToTerminalView(source, target, side) {
    if (URI.isUri(source)) {
      source = this.getInstanceFromResource(source);
    }
    if (!source) {
      return;
    }
    this._terminalEditorService.detachInstance(source);
    if (source.target !== TerminalLocation.Editor) {
      await this._terminalGroupService.showPanel(true);
      return;
    }
    source.target = TerminalLocation.Panel;
    let group;
    if (target) {
      group = this._terminalGroupService.getGroupForInstance(target);
    }
    if (!group) {
      group = this._terminalGroupService.createGroup();
    }
    group.addInstance(source);
    this.setActiveInstance(source);
    await this._terminalGroupService.showPanel(true);
    if (target && side) {
      const index = group.terminalInstances.indexOf(target) + (side === "after" ? 1 : 0);
      group.moveInstance(source, index, side);
    }
    this._onDidChangeInstances.fire();
    this._onDidChangeActiveGroup.fire(this._terminalGroupService.activeGroup);
  }
  _initInstanceListeners(instance) {
    const instanceDisposables = new DisposableStore();
    instanceDisposables.add(instance.onDimensionsChanged(() => {
      this._onDidChangeInstanceDimensions.fire(instance);
      if (this._terminalConfigurationService.config.enablePersistentSessions && this.isProcessSupportRegistered) {
        this._saveState();
      }
    }));
    instanceDisposables.add(instance.onDidFocus(this._onDidChangeActiveInstance.fire, this._onDidChangeActiveInstance));
    instanceDisposables.add(instance.onRequestAddInstanceToGroup(async (e) => await this._addInstanceToGroup(instance, e)));
    const disposeListener = this._register(instance.onDisposed(() => {
      instanceDisposables.dispose();
      this._store.delete(disposeListener);
    }));
  }
  async _addInstanceToGroup(instance, e) {
    const terminalIdentifier = parseTerminalUri(e.uri);
    if (terminalIdentifier.instanceId === void 0) {
      return;
    }
    let sourceInstance = this.getInstanceFromResource(e.uri);
    if (!sourceInstance) {
      const attachPersistentProcess = await this._primaryBackend?.requestDetachInstance(terminalIdentifier.workspaceId, terminalIdentifier.instanceId);
      if (attachPersistentProcess) {
        sourceInstance = await this.createTerminal({ config: { attachPersistentProcess }, resource: e.uri });
        this._terminalGroupService.moveInstance(sourceInstance, instance, e.side);
        return;
      }
    }
    sourceInstance = this._terminalGroupService.getInstanceFromResource(e.uri);
    if (sourceInstance) {
      this._terminalGroupService.moveInstance(sourceInstance, instance, e.side);
      return;
    }
    sourceInstance = this._terminalEditorService.getInstanceFromResource(e.uri);
    if (sourceInstance) {
      this.moveToTerminalView(sourceInstance, instance, e.side);
      return;
    }
    return;
  }
  registerProcessSupport(isSupported) {
    if (!isSupported) {
      return;
    }
    this._processSupportContextKey.set(isSupported);
    this._onDidRegisterProcessSupport.fire();
  }
  // TODO: Remove this, it should live in group/editor servioce
  _getIndexFromId(terminalId) {
    let terminalIndex = -1;
    this.instances.forEach((terminalInstance, i) => {
      if (terminalInstance.instanceId === terminalId) {
        terminalIndex = i;
      }
    });
    if (terminalIndex === -1) {
      throw new Error(`Terminal with ID ${terminalId} does not exist (has it already been disposed?)`);
    }
    return terminalIndex;
  }
  async _showTerminalCloseConfirmation(singleTerminal) {
    let message;
    const foregroundInstances = this.foregroundInstances;
    if (foregroundInstances.length === 1 || singleTerminal) {
      message = nls.localize("terminalService.terminalCloseConfirmationSingular", "Do you want to terminate the active terminal session?");
    } else {
      message = nls.localize("terminalService.terminalCloseConfirmationPlural", "Do you want to terminate the {0} active terminal sessions?", foregroundInstances.length);
    }
    const { confirmed } = await this._dialogService.confirm({
      type: "warning",
      message,
      primaryButton: nls.localize({ key: "terminate", comment: ["&& denotes a mnemonic"] }, "&&Terminate")
    });
    return !confirmed;
  }
  getDefaultInstanceHost() {
    if (this.defaultLocation === TerminalLocation.Editor) {
      return this._terminalEditorService;
    }
    return this._terminalGroupService;
  }
  async getInstanceHost(location) {
    if (location) {
      if (location === TerminalLocation.Editor) {
        return this._terminalEditorService;
      } else if (typeof location === "object") {
        if ("viewColumn" in location) {
          return this._terminalEditorService;
        } else if ("parentTerminal" in location) {
          return (await location.parentTerminal).target === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
        }
      } else {
        return this._terminalGroupService;
      }
    }
    return this;
  }
  async createTerminal(options) {
    if (this._terminalProfileService.availableProfiles.length === 0) {
      const isPtyTerminal = options?.config && "customPtyImplementation" in options.config;
      const isLocalInRemoteTerminal = this._remoteAgentService.getConnection() && URI.isUri(options?.cwd) && options?.cwd.scheme === Schemas.vscodeFileResource;
      if (!isPtyTerminal && !isLocalInRemoteTerminal) {
        if (this._connectionState === TerminalConnectionState.Connecting) {
          mark(`code/terminal/willGetProfiles`);
        }
        await this._terminalProfileService.profilesReady;
        if (this._connectionState === TerminalConnectionState.Connecting) {
          mark(`code/terminal/didGetProfiles`);
        }
      }
    }
    const config = options?.config || this._terminalProfileService.getDefaultProfile();
    const shellLaunchConfig = config && "extensionIdentifier" in config ? {} : this._terminalInstanceService.convertProfileToShellLaunchConfig(config || {});
    const contributedProfile = options?.skipContributedProfileCheck ? void 0 : await this._getContributedProfile(shellLaunchConfig, options);
    const splitActiveTerminal = typeof options?.location === "object" && "splitActiveTerminal" in options.location ? options.location.splitActiveTerminal : typeof options?.location === "object" ? "parentTerminal" in options.location : false;
    await this._resolveCwd(shellLaunchConfig, splitActiveTerminal, options);
    if (!shellLaunchConfig.customPtyImplementation && contributedProfile) {
      const resolvedLocation = await this.resolveLocation(options?.location);
      let location2;
      if (splitActiveTerminal) {
        location2 = resolvedLocation === TerminalLocation.Editor ? { viewColumn: SIDE_GROUP } : { splitActiveTerminal: true };
      } else {
        location2 = typeof options?.location === "object" && "viewColumn" in options.location ? options.location : resolvedLocation;
      }
      await this.createContributedTerminalProfile(contributedProfile.extensionIdentifier, contributedProfile.id, {
        icon: contributedProfile.icon,
        color: contributedProfile.color,
        location: location2,
        cwd: shellLaunchConfig.cwd
      });
      const instanceHost = resolvedLocation === TerminalLocation.Editor ? this._terminalEditorService : this._terminalGroupService;
      const instance = instanceHost.instances[instanceHost.instances.length - 1];
      await instance?.focusWhenReady();
      this._terminalHasBeenCreated.set(true);
      return instance;
    }
    if (!shellLaunchConfig.customPtyImplementation && !this.isProcessSupportRegistered) {
      throw new Error("Could not create terminal when process support is not registered");
    }
    if (shellLaunchConfig.hideFromUser) {
      const instance = this._terminalInstanceService.createInstance(shellLaunchConfig, TerminalLocation.Panel);
      this._backgroundedTerminalInstances.push(instance);
      this._backgroundedTerminalDisposables.set(instance.instanceId, [
        instance.onDisposed(this._onDidDisposeInstance.fire, this._onDidDisposeInstance)
      ]);
      this._terminalHasBeenCreated.set(true);
      return instance;
    }
    this._evaluateLocalCwd(shellLaunchConfig);
    const location = await this.resolveLocation(options?.location) || this.defaultLocation;
    const parent = await this._getSplitParent(options?.location);
    this._terminalHasBeenCreated.set(true);
    if (parent) {
      return this._splitTerminal(shellLaunchConfig, location, parent);
    }
    return this._createTerminal(shellLaunchConfig, location, options);
  }
  async _getContributedProfile(shellLaunchConfig, options) {
    if (options?.config && "extensionIdentifier" in options.config) {
      return options.config;
    }
    return this._terminalProfileService.getContributedDefaultProfile(shellLaunchConfig);
  }
  async createDetachedTerminal(options) {
    const ctor = await TerminalInstance.getXtermConstructor(this._keybindingService, this._contextKeyService);
    const xterm = this._instantiationService.createInstance(XtermTerminal, ctor, {
      cols: options.cols,
      rows: options.rows,
      xtermColorProvider: options.colorProvider,
      capabilities: options.capabilities || new TerminalCapabilityStore()
    });
    if (options.readonly) {
      xterm.raw.attachCustomKeyEventHandler(() => false);
    }
    const instance = new DetachedTerminal(xterm, options, this._instantiationService);
    this._detachedXterms.add(instance);
    const l = xterm.onDidDispose(() => {
      this._detachedXterms.delete(instance);
      l.dispose();
    });
    return instance;
  }
  async _resolveCwd(shellLaunchConfig, splitActiveTerminal, options) {
    const cwd = shellLaunchConfig.cwd;
    if (!cwd) {
      if (options?.cwd) {
        shellLaunchConfig.cwd = options.cwd;
      } else if (splitActiveTerminal && options?.location) {
        let parent = this.activeInstance;
        if (typeof options.location === "object" && "parentTerminal" in options.location) {
          parent = await options.location.parentTerminal;
        }
        if (!parent) {
          throw new Error("Cannot split without an active instance");
        }
        shellLaunchConfig.cwd = await getCwdForSplit(parent, this._workspaceContextService.getWorkspace().folders, this._commandService, this._terminalConfigService);
      }
    }
  }
  _splitTerminal(shellLaunchConfig, location, parent) {
    let instance;
    if (typeof shellLaunchConfig.cwd !== "object" && typeof parent.shellLaunchConfig.cwd === "object") {
      shellLaunchConfig.cwd = URI.from({
        scheme: parent.shellLaunchConfig.cwd.scheme,
        authority: parent.shellLaunchConfig.cwd.authority,
        path: shellLaunchConfig.cwd || parent.shellLaunchConfig.cwd.path
      });
    }
    if (location === TerminalLocation.Editor || parent.target === TerminalLocation.Editor) {
      instance = this._terminalEditorService.splitInstance(parent, shellLaunchConfig);
    } else {
      const group = this._terminalGroupService.getGroupForInstance(parent);
      if (!group) {
        throw new Error(`Cannot split a terminal without a group (instanceId: ${parent.instanceId}, title: ${parent.title})`);
      }
      shellLaunchConfig.parentTerminalId = parent.instanceId;
      instance = group.split(shellLaunchConfig);
    }
    this._addToReconnected(instance);
    return instance;
  }
  _addToReconnected(instance) {
    if (!instance.reconnectionProperties?.ownerId) {
      return;
    }
    const reconnectedTerminals = this._reconnectedTerminals.get(instance.reconnectionProperties.ownerId);
    if (reconnectedTerminals) {
      reconnectedTerminals.push(instance);
    } else {
      this._reconnectedTerminals.set(instance.reconnectionProperties.ownerId, [instance]);
    }
  }
  _createTerminal(shellLaunchConfig, location, options) {
    let instance;
    const editorOptions = this._getEditorOptions(options?.location);
    if (location === TerminalLocation.Editor) {
      instance = this._terminalInstanceService.createInstance(shellLaunchConfig, TerminalLocation.Editor);
      this._terminalEditorService.openEditor(instance, editorOptions);
    } else {
      const group = this._terminalGroupService.createGroup(shellLaunchConfig);
      instance = group.terminalInstances[0];
    }
    this._addToReconnected(instance);
    return instance;
  }
  async resolveLocation(location) {
    if (location && typeof location === "object") {
      if ("parentTerminal" in location) {
        const parentTerminal = await location.parentTerminal;
        return !parentTerminal.target ? TerminalLocation.Panel : parentTerminal.target;
      } else if ("viewColumn" in location) {
        return TerminalLocation.Editor;
      } else if ("splitActiveTerminal" in location) {
        return !this._activeInstance?.target ? TerminalLocation.Panel : this._activeInstance?.target;
      }
    }
    return location;
  }
  async _getSplitParent(location) {
    if (location && typeof location === "object" && "parentTerminal" in location) {
      return location.parentTerminal;
    } else if (location && typeof location === "object" && "splitActiveTerminal" in location) {
      return this.activeInstance;
    }
    return void 0;
  }
  _getEditorOptions(location) {
    if (location && typeof location === "object" && "viewColumn" in location) {
      location.viewColumn = columnToEditorGroup(this._editorGroupsService, this._configurationService, location.viewColumn);
      return location;
    }
    return void 0;
  }
  _evaluateLocalCwd(shellLaunchConfig) {
    if (typeof shellLaunchConfig.cwd !== "string" && shellLaunchConfig.cwd?.scheme === Schemas.file) {
      if (VirtualWorkspaceContext.getValue(this._contextKeyService)) {
        shellLaunchConfig.initialText = formatMessageForTerminal(nls.localize("localTerminalVirtualWorkspace", "This shell is open to a {0}local{1} folder, NOT to the virtual folder", "\x1B[3m", "\x1B[23m"), { excludeLeadingNewLine: true, loudFormatting: true });
        shellLaunchConfig.type = "Local";
      } else if (this._remoteAgentService.getConnection()) {
        shellLaunchConfig.initialText = formatMessageForTerminal(nls.localize("localTerminalRemote", "This shell is running on your {0}local{1} machine, NOT on the connected remote machine", "\x1B[3m", "\x1B[23m"), { excludeLeadingNewLine: true, loudFormatting: true });
        shellLaunchConfig.type = "Local";
      }
    }
  }
  _showBackgroundTerminal(instance) {
    const index = this._backgroundedTerminalInstances.indexOf(instance);
    if (index === -1) {
      return;
    }
    this._backgroundedTerminalInstances.splice(this._backgroundedTerminalInstances.indexOf(instance), 1);
    const disposables = this._backgroundedTerminalDisposables.get(instance.instanceId);
    if (disposables) {
      dispose(disposables);
    }
    this._backgroundedTerminalDisposables.delete(instance.instanceId);
    this._terminalGroupService.createGroup(instance);
    if (this.instances.length === 1) {
      this._terminalGroupService.setActiveInstanceByIndex(0);
    }
    this._onDidChangeInstances.fire();
  }
  async setContainers(panelContainer, terminalContainer) {
    this._terminalConfigurationService.setPanelContainer(panelContainer);
    this._terminalGroupService.setContainer(terminalContainer);
  }
  getEditingTerminal() {
    return this._editingTerminal;
  }
  setEditingTerminal(instance) {
    this._editingTerminal = instance;
  }
  createOnInstanceEvent(getEvent) {
    return new DynamicListEventMultiplexer(this.instances, this.onDidCreateInstance, this.onDidDisposeInstance, getEvent);
  }
  createOnInstanceCapabilityEvent(capabilityId, getEvent) {
    return createInstanceCapabilityEventMultiplexer(this.instances, this.onDidCreateInstance, this.onDidDisposeInstance, capabilityId, getEvent);
  }
};
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceData", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceDataInput", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceIconChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceMaximumDimensionsChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstancePrimaryStatusChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceProcessIdReady", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceSelectionChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceTitleChange", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceShellTypeChanged", 1);
__decorateClass([
  memoize
], TerminalService.prototype, "onAnyInstanceAddedCapabilityType", 1);
__decorateClass([
  debounce(500)
], TerminalService.prototype, "_saveState", 1);
__decorateClass([
  debounce(500)
], TerminalService.prototype, "_updateTitle", 1);
__decorateClass([
  debounce(500)
], TerminalService.prototype, "_updateIcon", 1);
TerminalService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ILifecycleService),
  __decorateParam(2, ITerminalLogService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IRemoteAgentService),
  __decorateParam(6, IViewsService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ITerminalConfigurationService),
  __decorateParam(9, IWorkbenchEnvironmentService),
  __decorateParam(10, ITerminalConfigurationService),
  __decorateParam(11, ITerminalEditorService),
  __decorateParam(12, ITerminalGroupService),
  __decorateParam(13, ITerminalInstanceService),
  __decorateParam(14, IEditorGroupsService),
  __decorateParam(15, ITerminalProfileService),
  __decorateParam(16, IExtensionService),
  __decorateParam(17, INotificationService),
  __decorateParam(18, IWorkspaceContextService),
  __decorateParam(19, ICommandService),
  __decorateParam(20, IKeybindingService),
  __decorateParam(21, ITimerService)
], TerminalService);
let TerminalEditorStyle = class extends Themable {
  constructor(container, _terminalService, _themeService, _terminalProfileService, _editorService) {
    super(_themeService);
    this._terminalService = _terminalService;
    this._themeService = _themeService;
    this._terminalProfileService = _terminalProfileService;
    this._editorService = _editorService;
    this._registerListeners();
    this._styleElement = domStylesheets.createStyleSheet(container);
    this._register(toDisposable(() => this._styleElement.remove()));
    this.updateStyles();
  }
  _registerListeners() {
    this._register(this._terminalService.onAnyInstanceIconChange(() => this.updateStyles()));
    this._register(this._terminalService.onDidCreateInstance(() => this.updateStyles()));
    this._register(this._editorService.onDidActiveEditorChange(() => {
      if (this._editorService.activeEditor instanceof TerminalEditorInput) {
        this.updateStyles();
      }
    }));
    this._register(this._editorService.onDidCloseEditor(() => {
      if (this._editorService.activeEditor instanceof TerminalEditorInput) {
        this.updateStyles();
      }
    }));
    this._register(this._terminalProfileService.onDidChangeAvailableProfiles(() => this.updateStyles()));
  }
  updateStyles() {
    super.updateStyles();
    const colorTheme = this._themeService.getColorTheme();
    let css = "";
    const productIconTheme = this._themeService.getProductIconTheme();
    for (const instance of this._terminalService.instances) {
      const icon = instance.icon;
      if (!icon) {
        continue;
      }
      let uri = void 0;
      if (icon instanceof URI) {
        uri = icon;
      } else if (icon instanceof Object && "light" in icon && "dark" in icon) {
        uri = colorTheme.type === ColorScheme.LIGHT ? icon.light : icon.dark;
      }
      const iconClasses = getUriClasses(instance, colorTheme.type);
      if (uri instanceof URI && iconClasses && iconClasses.length > 1) {
        css += cssValue.inline`.monaco-workbench .terminal-tab.${cssValue.className(iconClasses[0])}::before
					{content: ''; background-image: ${cssValue.asCSSUrl(uri)};}`;
      }
      if (ThemeIcon.isThemeIcon(icon)) {
        const iconRegistry = getIconRegistry();
        const iconContribution = iconRegistry.getIcon(icon.id);
        if (iconContribution) {
          const def = productIconTheme.getIcon(iconContribution);
          if (def) {
            css += cssValue.inline`.monaco-workbench .terminal-tab.codicon-${cssValue.className(icon.id)}::before
							{content: ${cssValue.stringValue(def.fontCharacter)} !important; font-family: ${cssValue.stringValue(def.font?.id ?? "codicon")} !important;}`;
          }
        }
      }
    }
    const iconForegroundColor = colorTheme.getColor(iconForeground);
    if (iconForegroundColor) {
      css += cssValue.inline`.monaco-workbench .show-file-icons .file-icon.terminal-tab::before { color: ${iconForegroundColor}; }`;
    }
    css += getColorStyleContent(colorTheme, true);
    this._styleElement.textContent = css;
  }
};
TerminalEditorStyle = __decorateClass([
  __decorateParam(1, ITerminalService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, ITerminalProfileService),
  __decorateParam(4, IEditorService)
], TerminalEditorStyle);
export {
  TerminalService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbVN0eWxlc2hlZXRzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgKiBhcyBjc3NWYWx1ZSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY3NzVmFsdWUuanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZGVib3VuY2UsIG1lbW9pemUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IER5bmFtaWNMaXN0RXZlbnRNdWx0aXBsZXhlciwgRW1pdHRlciwgRXZlbnQsIElEeW5hbWljTGlzdEV2ZW50TXVsdGlwbGV4ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElLZXlNb2RzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUNyZWF0ZUNvbnRyaWJ1dGVkVGVybWluYWxQcm9maWxlT3B0aW9ucywgSUV4dGVuc2lvblRlcm1pbmFsUHJvZmlsZSwgSVB0eUhvc3RBdHRhY2hUYXJnZXQsIElSYXdUZXJtaW5hbEluc3RhbmNlTGF5b3V0SW5mbywgSVJhd1Rlcm1pbmFsVGFiTGF5b3V0SW5mbywgSVNoZWxsTGF1bmNoQ29uZmlnLCBJVGVybWluYWxCYWNrZW5kLCBJVGVybWluYWxMYXVuY2hFcnJvciwgSVRlcm1pbmFsTG9nU2VydmljZSwgSVRlcm1pbmFsc0xheW91dEluZm8sIElUZXJtaW5hbHNMYXlvdXRJbmZvQnlJZCwgVGVybWluYWxFeGl0UmVhc29uLCBUZXJtaW5hbExvY2F0aW9uLCBUZXJtaW5hbExvY2F0aW9uU3RyaW5nLCBUaXRsZUV2ZW50U291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IGZvcm1hdE1lc3NhZ2VGb3JUZXJtaW5hbCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbFN0cmluZ3MuanMnO1xuaW1wb3J0IHsgaWNvbkZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBnZXRJY29uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbG9yU2NoZW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UsIFRoZW1hYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgVmlydHVhbFdvcmtzcGFjZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSUVkaXRhYmxlRGF0YSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ3JlYXRlVGVybWluYWxPcHRpb25zLCBJRGV0YWNoZWRUZXJtaW5hbEluc3RhbmNlLCBJRGV0YWNoZWRYVGVybU9wdGlvbnMsIElSZXF1ZXN0QWRkSW5zdGFuY2VUb0dyb3VwRXZlbnQsIElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJVGVybWluYWxFZGl0b3JTZXJ2aWNlLCBJVGVybWluYWxHcm91cCwgSVRlcm1pbmFsR3JvdXBTZXJ2aWNlLCBJVGVybWluYWxJbnN0YW5jZSwgSVRlcm1pbmFsSW5zdGFuY2VIb3N0LCBJVGVybWluYWxJbnN0YW5jZVNlcnZpY2UsIElUZXJtaW5hbExvY2F0aW9uT3B0aW9ucywgSVRlcm1pbmFsU2VydmljZSwgSVRlcm1pbmFsU2VydmljZU5hdGl2ZURlbGVnYXRlLCBUZXJtaW5hbENvbm5lY3Rpb25TdGF0ZSwgVGVybWluYWxFZGl0b3JMb2NhdGlvbiB9IGZyb20gJy4vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgZ2V0Q3dkRm9yU3BsaXQgfSBmcm9tICcuL3Rlcm1pbmFsQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbEVkaXRvcklucHV0IH0gZnJvbSAnLi90ZXJtaW5hbEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IGdldENvbG9yU3R5bGVDb250ZW50LCBnZXRVcmlDbGFzc2VzIH0gZnJvbSAnLi90ZXJtaW5hbEljb24uanMnO1xuaW1wb3J0IHsgVGVybWluYWxQcm9maWxlUXVpY2twaWNrIH0gZnJvbSAnLi90ZXJtaW5hbFByb2ZpbGVRdWlja3BpY2suanMnO1xuaW1wb3J0IHsgZ2V0SW5zdGFuY2VGcm9tUmVzb3VyY2UsIGdldFRlcm1pbmFsVXJpLCBwYXJzZVRlcm1pbmFsVXJpIH0gZnJvbSAnLi90ZXJtaW5hbFVyaS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFZpZXdQYW5lIH0gZnJvbSAnLi90ZXJtaW5hbFZpZXcuanMnO1xuaW1wb3J0IHsgSVJlbW90ZVRlcm1pbmFsQXR0YWNoVGFyZ2V0LCBJU3RhcnRFeHRlbnNpb25UZXJtaW5hbFJlcXVlc3QsIElUZXJtaW5hbFByb2Nlc3NFeHRIb3N0UHJveHksIElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLCBURVJNSU5BTF9WSUVXX0lEIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxDb250ZXh0S2V5LmpzJztcbmltcG9ydCB7IGNvbHVtblRvRWRpdG9yR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3VwQ29sdW1uLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFDVElWRV9HUk9VUF9UWVBFLCBBVVhfV0lORE9XX0dST1VQLCBBVVhfV0lORE9XX0dST1VQX1RZUEUsIElFZGl0b3JTZXJ2aWNlLCBTSURFX0dST1VQLCBTSURFX0dST1VQX1RZUEUgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlLCBTaHV0ZG93blJlYXNvbiwgU3RhcnR1cEtpbmQsIFdpbGxTaHV0ZG93bkV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFh0ZXJtVGVybWluYWwgfSBmcm9tICcuL3h0ZXJtL3h0ZXJtVGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxJbnN0YW5jZSB9IGZyb20gJy4vdGVybWluYWxJbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy90ZXJtaW5hbENhcGFiaWxpdHlTdG9yZS5qcyc7XG5pbXBvcnQgeyBJVGltZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdGltZXIvYnJvd3Nlci90aW1lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbWFyayB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BlcmZvcm1hbmNlLmpzJztcbmltcG9ydCB7IERldGFjaGVkVGVybWluYWwgfSBmcm9tICcuL2RldGFjaGVkVGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ2FwYWJpbGl0eUltcGxNYXAsIFRlcm1pbmFsQ2FwYWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY2FwYWJpbGl0aWVzLmpzJztcbmltcG9ydCB7IGNyZWF0ZUluc3RhbmNlQ2FwYWJpbGl0eUV2ZW50TXVsdGlwbGV4ZXIgfSBmcm9tICcuL3Rlcm1pbmFsRXZlbnRzLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IEdyb3VwSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuXG5leHBvcnQgY2xhc3MgVGVybWluYWxTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXJtaW5hbFNlcnZpY2Uge1xuXHRkZWNsYXJlIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9ob3N0QWN0aXZlVGVybWluYWxzOiBNYXA8SVRlcm1pbmFsSW5zdGFuY2VIb3N0LCBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZD4gPSBuZXcgTWFwKCk7XG5cblx0cHJpdmF0ZSBfZGV0YWNoZWRYdGVybXMgPSBuZXcgU2V0PElEZXRhY2hlZFRlcm1pbmFsSW5zdGFuY2U+KCk7XG5cdHByaXZhdGUgX3Rlcm1pbmFsRWRpdG9yQWN0aXZlOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxTaGVsbFR5cGVDb250ZXh0S2V5OiBJQ29udGV4dEtleTxzdHJpbmc+O1xuXG5cdHByaXZhdGUgX2lzU2h1dHRpbmdEb3duOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2JhY2tncm91bmRlZFRlcm1pbmFsSW5zdGFuY2VzOiBJVGVybWluYWxJbnN0YW5jZVtdID0gW107XG5cdHByaXZhdGUgX2JhY2tncm91bmRlZFRlcm1pbmFsRGlzcG9zYWJsZXM6IE1hcDxudW1iZXIsIElEaXNwb3NhYmxlW10+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIF9wcm9jZXNzU3VwcG9ydENvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgX3ByaW1hcnlCYWNrZW5kPzogSVRlcm1pbmFsQmFja2VuZDtcblx0cHJpdmF0ZSBfdGVybWluYWxIYXNCZWVuQ3JlYXRlZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgX3Rlcm1pbmFsQ291bnRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxudW1iZXI+O1xuXHRwcml2YXRlIF9uYXRpdmVEZWxlZ2F0ZT86IElUZXJtaW5hbFNlcnZpY2VOYXRpdmVEZWxlZ2F0ZTtcblx0cHJpdmF0ZSBfc2h1dGRvd25XaW5kb3dDb3VudD86IG51bWJlcjtcblxuXHRwcml2YXRlIF9lZGl0YWJsZTogeyBpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2U7IGRhdGE6IElFZGl0YWJsZURhdGEgfSB8IHVuZGVmaW5lZDtcblxuXHRnZXQgaXNQcm9jZXNzU3VwcG9ydFJlZ2lzdGVyZWQoKTogYm9vbGVhbiB7IHJldHVybiAhIXRoaXMuX3Byb2Nlc3NTdXBwb3J0Q29udGV4dEtleS5nZXQoKTsgfVxuXG5cdHByaXZhdGUgX2Nvbm5lY3Rpb25TdGF0ZTogVGVybWluYWxDb25uZWN0aW9uU3RhdGUgPSBUZXJtaW5hbENvbm5lY3Rpb25TdGF0ZS5Db25uZWN0aW5nO1xuXHRnZXQgY29ubmVjdGlvblN0YXRlKCk6IFRlcm1pbmFsQ29ubmVjdGlvblN0YXRlIHsgcmV0dXJuIHRoaXMuX2Nvbm5lY3Rpb25TdGF0ZTsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3doZW5Db25uZWN0ZWQgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdGdldCB3aGVuQ29ubmVjdGVkKCk6IFByb21pc2U8dm9pZD4geyByZXR1cm4gdGhpcy5fd2hlbkNvbm5lY3RlZC5wOyB9XG5cblx0cHJpdmF0ZSBfcmVzdG9yZWRHcm91cENvdW50OiBudW1iZXIgPSAwO1xuXHRnZXQgcmVzdG9yZWRHcm91cENvdW50KCk6IG51bWJlciB7IHJldHVybiB0aGlzLl9yZXN0b3JlZEdyb3VwQ291bnQ7IH1cblxuXHRnZXQgaW5zdGFuY2VzKCk6IElUZXJtaW5hbEluc3RhbmNlW10ge1xuXHRcdHJldHVybiB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5pbnN0YW5jZXMuY29uY2F0KHRoaXMuX3Rlcm1pbmFsRWRpdG9yU2VydmljZS5pbnN0YW5jZXMpLmNvbmNhdCh0aGlzLl9iYWNrZ3JvdW5kZWRUZXJtaW5hbEluc3RhbmNlcyk7XG5cdH1cblx0LyoqIEdldHMgYWxsIG5vbi1iYWNrZ3JvdW5kIHRlcm1pbmFscy4gKi9cblx0Z2V0IGZvcmVncm91bmRJbnN0YW5jZXMoKTogSVRlcm1pbmFsSW5zdGFuY2VbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmluc3RhbmNlcy5jb25jYXQodGhpcy5fdGVybWluYWxFZGl0b3JTZXJ2aWNlLmluc3RhbmNlcyk7XG5cdH1cblx0Z2V0IGRldGFjaGVkSW5zdGFuY2VzKCk6IEl0ZXJhYmxlPElEZXRhY2hlZFRlcm1pbmFsSW5zdGFuY2U+IHtcblx0XHRyZXR1cm4gdGhpcy5fZGV0YWNoZWRYdGVybXM7XG5cdH1cblxuXHRwcml2YXRlIF9yZWNvbm5lY3RlZFRlcm1pbmFsR3JvdXBzOiBQcm9taXNlPElUZXJtaW5hbEdyb3VwW10+IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX3JlY29ubmVjdGVkVGVybWluYWxzOiBNYXA8c3RyaW5nLCBJVGVybWluYWxJbnN0YW5jZVtdPiA9IG5ldyBNYXAoKTtcblx0Z2V0UmVjb25uZWN0ZWRUZXJtaW5hbHMocmVjb25uZWN0aW9uT3duZXI6IHN0cmluZyk6IElUZXJtaW5hbEluc3RhbmNlW10gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9yZWNvbm5lY3RlZFRlcm1pbmFscy5nZXQocmVjb25uZWN0aW9uT3duZXIpO1xuXHR9XG5cblx0Z2V0IGRlZmF1bHRMb2NhdGlvbigpOiBUZXJtaW5hbExvY2F0aW9uIHsgcmV0dXJuIHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLmRlZmF1bHRMb2NhdGlvbiA9PT0gVGVybWluYWxMb2NhdGlvblN0cmluZy5FZGl0b3IgPyBUZXJtaW5hbExvY2F0aW9uLkVkaXRvciA6IFRlcm1pbmFsTG9jYXRpb24uUGFuZWw7IH1cblxuXHRwcml2YXRlIF9hY3RpdmVJbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQ7XG5cdGdldCBhY3RpdmVJbnN0YW5jZSgpOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCB7XG5cdFx0Ly8gQ2hlY2sgaWYgZWl0aGVyIGFuIGVkaXRvciBvciBwYW5lbCB0ZXJtaW5hbCBoYXMgZm9jdXMgYW5kIHJldHVybiB0aGF0LCByZWdhcmRsZXNzIG9mIHRoZVxuXHRcdC8vIHZhbHVlIG9mIF9hY3RpdmVJbnN0YW5jZS4gVGhpcyBhdm9pZHMgdGVybWluYWxzIGNyZWF0ZWQgaW4gdGhlIHBhbmVsIGZvciBleGFtcGxlIHN0ZWFsaW5nXG5cdFx0Ly8gdGhlIGFjdGl2ZSBzdGF0dXMgZXZlbiB3aGVuIGl0J3Mgbm90IGZvY3VzZWQuXG5cdFx0Zm9yIChjb25zdCBhY3RpdmVIb3N0VGVybWluYWwgb2YgdGhpcy5faG9zdEFjdGl2ZVRlcm1pbmFscy52YWx1ZXMoKSkge1xuXHRcdFx0aWYgKGFjdGl2ZUhvc3RUZXJtaW5hbD8uaGFzRm9jdXMpIHtcblx0XHRcdFx0cmV0dXJuIGFjdGl2ZUhvc3RUZXJtaW5hbDtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gRmFsbGJhY2sgdG8gdGhlIGxhc3QgcmVjb3JkZWQgYWN0aXZlIHRlcm1pbmFsIGlmIG5laXRoZXIgaGF2ZSBmb2N1c1xuXHRcdHJldHVybiB0aGlzLl9hY3RpdmVJbnN0YW5jZTtcblx0fVxuXG5cdHByaXZhdGUgX2VkaXRpbmdUZXJtaW5hbDogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDcmVhdGVJbnN0YW5jZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXJtaW5hbEluc3RhbmNlPigpKTtcblx0Z2V0IG9uRGlkQ3JlYXRlSW5zdGFuY2UoKTogRXZlbnQ8SVRlcm1pbmFsSW5zdGFuY2U+IHsgcmV0dXJuIHRoaXMuX29uRGlkQ3JlYXRlSW5zdGFuY2UuZXZlbnQ7IH1cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VJbnN0YW5jZURpbWVuc2lvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdGdldCBvbkRpZENoYW5nZUluc3RhbmNlRGltZW5zaW9ucygpOiBFdmVudDxJVGVybWluYWxJbnN0YW5jZT4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VJbnN0YW5jZURpbWVuc2lvbnMuZXZlbnQ7IH1cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZWdpc3RlclByb2Nlc3NTdXBwb3J0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdGdldCBvbkRpZFJlZ2lzdGVyUHJvY2Vzc1N1cHBvcnQoKTogRXZlbnQ8dm9pZD4geyByZXR1cm4gdGhpcy5fb25EaWRSZWdpc3RlclByb2Nlc3NTdXBwb3J0LmV2ZW50OyB9XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29ubmVjdGlvblN0YXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdGdldCBvbkRpZENoYW5nZUNvbm5lY3Rpb25TdGF0ZSgpOiBFdmVudDx2b2lkPiB7IHJldHVybiB0aGlzLl9vbkRpZENoYW5nZUNvbm5lY3Rpb25TdGF0ZS5ldmVudDsgfVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlcXVlc3RTdGFydEV4dGVuc2lvblRlcm1pbmFsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVN0YXJ0RXh0ZW5zaW9uVGVybWluYWxSZXF1ZXN0PigpKTtcblx0Z2V0IG9uRGlkUmVxdWVzdFN0YXJ0RXh0ZW5zaW9uVGVybWluYWwoKTogRXZlbnQ8SVN0YXJ0RXh0ZW5zaW9uVGVybWluYWxSZXF1ZXN0PiB7IHJldHVybiB0aGlzLl9vbkRpZFJlcXVlc3RTdGFydEV4dGVuc2lvblRlcm1pbmFsLmV2ZW50OyB9XG5cblx0Ly8gSVRlcm1pbmFsSW5zdGFuY2VIb3N0IGV2ZW50c1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZERpc3Bvc2VJbnN0YW5jZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXJtaW5hbEluc3RhbmNlPigpKTtcblx0Z2V0IG9uRGlkRGlzcG9zZUluc3RhbmNlKCk6IEV2ZW50PElUZXJtaW5hbEluc3RhbmNlPiB7IHJldHVybiB0aGlzLl9vbkRpZERpc3Bvc2VJbnN0YW5jZS5ldmVudDsgfVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZvY3VzSW5zdGFuY2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdGdldCBvbkRpZEZvY3VzSW5zdGFuY2UoKTogRXZlbnQ8SVRlcm1pbmFsSW5zdGFuY2U+IHsgcmV0dXJuIHRoaXMuX29uRGlkRm9jdXNJbnN0YW5jZS5ldmVudDsgfVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUFjdGl2ZUluc3RhbmNlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQ+KCkpO1xuXHRnZXQgb25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZSgpOiBFdmVudDxJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZD4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZS5ldmVudDsgfVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUluc3RhbmNlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRnZXQgb25EaWRDaGFuZ2VJbnN0YW5jZXMoKTogRXZlbnQ8dm9pZD4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VJbnN0YW5jZXMuZXZlbnQ7IH1cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VJbnN0YW5jZUNhcGFiaWxpdHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVGVybWluYWxJbnN0YW5jZT4oKSk7XG5cdGdldCBvbkRpZENoYW5nZUluc3RhbmNlQ2FwYWJpbGl0eSgpOiBFdmVudDxJVGVybWluYWxJbnN0YW5jZT4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VJbnN0YW5jZUNhcGFiaWxpdHkuZXZlbnQ7IH1cblxuXHQvLyBUZXJtaW5hbCB2aWV3IGV2ZW50c1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUFjdGl2ZUdyb3VwID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVRlcm1pbmFsR3JvdXAgfCB1bmRlZmluZWQ+KCkpO1xuXHRnZXQgb25EaWRDaGFuZ2VBY3RpdmVHcm91cCgpOiBFdmVudDxJVGVybWluYWxHcm91cCB8IHVuZGVmaW5lZD4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVHcm91cC5ldmVudDsgfVxuXG5cdC8vIExhemlseSBpbml0aWFsaXplZCBldmVudHMgdGhhdCBmaXJlIHdoZW4gdGhlIHNwZWNpZmllZCBldmVudCBmaXJlcyBvbiBfYW55XyB0ZXJtaW5hbFxuXHQvLyBUT0RPOiBCYXRjaCBldmVudHNcblx0QG1lbW9pemUgZ2V0IG9uQW55SW5zdGFuY2VEYXRhKCkgeyByZXR1cm4gdGhpcy5fcmVnaXN0ZXIodGhpcy5jcmVhdGVPbkluc3RhbmNlRXZlbnQoaW5zdGFuY2UgPT4gRXZlbnQubWFwKGluc3RhbmNlLm9uRGF0YSwgZGF0YSA9PiAoeyBpbnN0YW5jZSwgZGF0YSB9KSkpKS5ldmVudDsgfVxuXHRAbWVtb2l6ZSBnZXQgb25BbnlJbnN0YW5jZURhdGFJbnB1dCgpIHsgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3JlYXRlT25JbnN0YW5jZUV2ZW50KGUgPT4gRXZlbnQubWFwKGUub25EaWRJbnB1dERhdGEsICgpID0+IGUsIGUuc3RvcmUpKSkuZXZlbnQ7IH1cblx0QG1lbW9pemUgZ2V0IG9uQW55SW5zdGFuY2VJY29uQ2hhbmdlKCkgeyByZXR1cm4gdGhpcy5fcmVnaXN0ZXIodGhpcy5jcmVhdGVPbkluc3RhbmNlRXZlbnQoZSA9PiBlLm9uSWNvbkNoYW5nZWQpKS5ldmVudDsgfVxuXHRAbWVtb2l6ZSBnZXQgb25BbnlJbnN0YW5jZU1heGltdW1EaW1lbnNpb25zQ2hhbmdlKCkgeyByZXR1cm4gdGhpcy5fcmVnaXN0ZXIodGhpcy5jcmVhdGVPbkluc3RhbmNlRXZlbnQoZSA9PiBFdmVudC5tYXAoZS5vbk1heGltdW1EaW1lbnNpb25zQ2hhbmdlZCwgKCkgPT4gZSwgZS5zdG9yZSkpKS5ldmVudDsgfVxuXHRAbWVtb2l6ZSBnZXQgb25BbnlJbnN0YW5jZVByaW1hcnlTdGF0dXNDaGFuZ2UoKSB7IHJldHVybiB0aGlzLl9yZWdpc3Rlcih0aGlzLmNyZWF0ZU9uSW5zdGFuY2VFdmVudChlID0+IEV2ZW50Lm1hcChlLnN0YXR1c0xpc3Qub25EaWRDaGFuZ2VQcmltYXJ5U3RhdHVzLCAoKSA9PiBlLCBlLnN0b3JlKSkpLmV2ZW50OyB9XG5cdEBtZW1vaXplIGdldCBvbkFueUluc3RhbmNlUHJvY2Vzc0lkUmVhZHkoKSB7IHJldHVybiB0aGlzLl9yZWdpc3Rlcih0aGlzLmNyZWF0ZU9uSW5zdGFuY2VFdmVudChlID0+IGUub25Qcm9jZXNzSWRSZWFkeSkpLmV2ZW50OyB9XG5cdEBtZW1vaXplIGdldCBvbkFueUluc3RhbmNlU2VsZWN0aW9uQ2hhbmdlKCkgeyByZXR1cm4gdGhpcy5fcmVnaXN0ZXIodGhpcy5jcmVhdGVPbkluc3RhbmNlRXZlbnQoZSA9PiBlLm9uRGlkQ2hhbmdlU2VsZWN0aW9uKSkuZXZlbnQ7IH1cblx0QG1lbW9pemUgZ2V0IG9uQW55SW5zdGFuY2VUaXRsZUNoYW5nZSgpIHsgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3JlYXRlT25JbnN0YW5jZUV2ZW50KGUgPT4gZS5vblRpdGxlQ2hhbmdlZCkpLmV2ZW50OyB9XG5cdEBtZW1vaXplIGdldCBvbkFueUluc3RhbmNlU2hlbGxUeXBlQ2hhbmdlZCgpIHsgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3JlYXRlT25JbnN0YW5jZUV2ZW50KGUgPT4gRXZlbnQubWFwKGUub25EaWRDaGFuZ2VTaGVsbFR5cGUsICgpID0+IGUpKSkuZXZlbnQ7IH1cblx0QG1lbW9pemUgZ2V0IG9uQW55SW5zdGFuY2VBZGRlZENhcGFiaWxpdHlUeXBlKCkgeyByZXR1cm4gdGhpcy5fcmVnaXN0ZXIodGhpcy5jcmVhdGVPbkluc3RhbmNlRXZlbnQoZSA9PiBlLmNhcGFiaWxpdGllcy5vbkRpZEFkZENhcGFiaWxpdHlUeXBlKSkuZXZlbnQ7IH1cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9saWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASVRlcm1pbmFsTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJVGVybWluYWxMb2dTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIF9kaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcHJpdmF0ZSBfcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJVmlld3NTZXJ2aWNlIHByaXZhdGUgX3ZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsQ29uZmlnU2VydmljZTogSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRlcm1pbmFsRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbEVkaXRvclNlcnZpY2U6IElUZXJtaW5hbEVkaXRvclNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbEdyb3VwU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbEdyb3VwU2VydmljZTogSVRlcm1pbmFsR3JvdXBTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxJbnN0YW5jZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxJbnN0YW5jZVNlcnZpY2U6IElUZXJtaW5hbEluc3RhbmNlU2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yR3JvdXBzU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2U6IElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElUaW1lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGltZXJTZXJ2aWNlOiBJVGltZXJTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvLyB0aGUgYmVsb3cgYXZvaWRzIGhhdmluZyB0byBwb2xsIHJvdXRpbmVseS5cblx0XHQvLyB3ZSB1cGRhdGUgZGV0ZWN0ZWQgcHJvZmlsZXMgd2hlbiBhbiBpbnN0YW5jZSBpcyBjcmVhdGVkIHNvIHRoYXQsXG5cdFx0Ly8gZm9yIGV4YW1wbGUsIHdlIGRldGVjdCBpZiB5b3UndmUgaW5zdGFsbGVkIGEgcHdzaFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDcmVhdGVJbnN0YW5jZSgoKSA9PiB0aGlzLl90ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLnJlZnJlc2hBdmFpbGFibGVQcm9maWxlcygpKSk7XG5cdFx0dGhpcy5fZm9yd2FyZEluc3RhbmNlSG9zdEV2ZW50cyh0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZSk7XG5cdFx0dGhpcy5fZm9yd2FyZEluc3RhbmNlSG9zdEV2ZW50cyh0aGlzLl90ZXJtaW5hbEVkaXRvclNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLm9uRGlkQ2hhbmdlQWN0aXZlR3JvdXAodGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVHcm91cC5maXJlLCB0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZUdyb3VwKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWxJbnN0YW5jZVNlcnZpY2Uub25EaWRDcmVhdGVJbnN0YW5jZShpbnN0YW5jZSA9PiB7XG5cdFx0XHR0aGlzLl9pbml0SW5zdGFuY2VMaXN0ZW5lcnMoaW5zdGFuY2UpO1xuXHRcdFx0dGhpcy5fb25EaWRDcmVhdGVJbnN0YW5jZS5maXJlKGluc3RhbmNlKTtcblx0XHR9KSk7XG5cblx0XHQvLyBIaWRlIHRoZSBwYW5lbCBpZiB0aGVyZSBhcmUgbm8gbW9yZSBpbnN0YW5jZXMsIHByb3ZpZGVkIHRoYXQgVlMgQ29kZSBpcyBub3Qgc2h1dHRpbmdcblx0XHQvLyBkb3duLiBXaGVuIHNodXR0aW5nIGRvd24gdGhlIHBhbmVsIGlzIGxvY2tlZCBpbiBwbGFjZSBzbyB0aGF0IGl0IGlzIHJlc3RvcmVkIHVwb24gbmV4dFxuXHRcdC8vIGxhdW5jaC5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5vbkRpZENoYW5nZUFjdGl2ZUluc3RhbmNlKGluc3RhbmNlID0+IHtcblx0XHRcdGlmICghaW5zdGFuY2UgJiYgIXRoaXMuX2lzU2h1dHRpbmdEb3duICYmIHRoaXMuX3Rlcm1pbmFsQ29uZmlnU2VydmljZS5jb25maWcuaGlkZU9uTGFzdENsb3NlZCkge1xuXHRcdFx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5oaWRlUGFuZWwoKTtcblx0XHRcdH1cblx0XHRcdGlmIChpbnN0YW5jZT8uc2hlbGxUeXBlKSB7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsU2hlbGxUeXBlQ29udGV4dEtleS5zZXQoaW5zdGFuY2Uuc2hlbGxUeXBlLnRvU3RyaW5nKCkpO1xuXHRcdFx0fSBlbHNlIGlmICghaW5zdGFuY2UgfHwgIShpbnN0YW5jZS5zaGVsbFR5cGUpKSB7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsU2hlbGxUeXBlQ29udGV4dEtleS5yZXNldCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2hhbmRsZUluc3RhbmNlQ29udGV4dEtleXMoKTtcblx0XHR0aGlzLl90ZXJtaW5hbFNoZWxsVHlwZUNvbnRleHRLZXkgPSBUZXJtaW5hbENvbnRleHRLZXlzLnNoZWxsVHlwZS5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3Byb2Nlc3NTdXBwb3J0Q29udGV4dEtleSA9IFRlcm1pbmFsQ29udGV4dEtleXMucHJvY2Vzc1N1cHBvcnRlZC5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3Byb2Nlc3NTdXBwb3J0Q29udGV4dEtleS5zZXQoIWlzV2ViIHx8IHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCkgIT09IG51bGwpO1xuXHRcdHRoaXMuX3Rlcm1pbmFsSGFzQmVlbkNyZWF0ZWQgPSBUZXJtaW5hbENvbnRleHRLZXlzLnRlcm1pbmFsSGFzQmVlbkNyZWF0ZWQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl90ZXJtaW5hbENvdW50Q29udGV4dEtleSA9IFRlcm1pbmFsQ29udGV4dEtleXMuY291bnQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl90ZXJtaW5hbEVkaXRvckFjdGl2ZSA9IFRlcm1pbmFsQ29udGV4dEtleXMudGVybWluYWxFZGl0b3JBY3RpdmUuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZShpbnN0YW5jZSA9PiB7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbEVkaXRvckFjdGl2ZS5zZXQoISFpbnN0YW5jZT8udGFyZ2V0ICYmIGluc3RhbmNlLnRhcmdldCA9PT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKF9saWZlY3ljbGVTZXJ2aWNlLm9uQmVmb3JlU2h1dGRvd24oYXN5bmMgZSA9PiBlLnZldG8odGhpcy5fb25CZWZvcmVTaHV0ZG93bihlLnJlYXNvbiksICd2ZXRvLnRlcm1pbmFsJykpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfbGlmZWN5Y2xlU2VydmljZS5vbldpbGxTaHV0ZG93bihlID0+IHRoaXMuX29uV2lsbFNodXRkb3duKGUpKSk7XG5cblx0XHR0aGlzLl9pbml0aWFsaXplUHJpbWFyeUJhY2tlbmQoKTtcblxuXHRcdC8vIENyZWF0ZSBhc3luYyBhcyB0aGUgY2xhc3MgZGVwZW5kcyBvbiBgdGhpc2Bcblx0XHR0aW1lb3V0KDApLnRoZW4oKCkgPT4gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxFZGl0b3JTdHlsZSwgbWFpbldpbmRvdy5kb2N1bWVudC5oZWFkKSkpO1xuXHR9XG5cblx0YXN5bmMgc2hvd1Byb2ZpbGVRdWlja1BpY2sodHlwZTogJ3NldERlZmF1bHQnIHwgJ2NyZWF0ZUluc3RhbmNlJywgY3dkPzogc3RyaW5nIHwgVVJJKTogUHJvbWlzZTxJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHF1aWNrUGljayA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsUHJvZmlsZVF1aWNrcGljayk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcXVpY2tQaWNrLnNob3dBbmRHZXRSZXN1bHQodHlwZSk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiByZXN1bHQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGtleU1vZHM6IElLZXlNb2RzIHwgdW5kZWZpbmVkID0gcmVzdWx0LmtleU1vZHM7XG5cdFx0aWYgKHR5cGUgPT09ICdjcmVhdGVJbnN0YW5jZScpIHtcblx0XHRcdGNvbnN0IGFjdGl2ZUluc3RhbmNlID0gdGhpcy5nZXREZWZhdWx0SW5zdGFuY2VIb3N0KCkuYWN0aXZlSW5zdGFuY2U7XG5cdFx0XHRsZXQgaW5zdGFuY2U7XG5cblx0XHRcdGlmIChyZXN1bHQuY29uZmlnICYmICdpZCcgaW4gcmVzdWx0Py5jb25maWcpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jcmVhdGVDb250cmlidXRlZFRlcm1pbmFsUHJvZmlsZShyZXN1bHQuY29uZmlnLmV4dGVuc2lvbklkZW50aWZpZXIsIHJlc3VsdC5jb25maWcuaWQsIHtcblx0XHRcdFx0XHRpY29uOiByZXN1bHQuY29uZmlnLm9wdGlvbnM/Lmljb24sXG5cdFx0XHRcdFx0Y29sb3I6IHJlc3VsdC5jb25maWcub3B0aW9ucz8uY29sb3IsXG5cdFx0XHRcdFx0bG9jYXRpb246ICEhKGtleU1vZHM/LmFsdCAmJiBhY3RpdmVJbnN0YW5jZSkgPyB7IHNwbGl0QWN0aXZlVGVybWluYWw6IHRydWUgfSA6IHRoaXMuZGVmYXVsdExvY2F0aW9uXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3VsdC5jb25maWcgJiYgJ3Byb2ZpbGVOYW1lJyBpbiByZXN1bHQuY29uZmlnKSB7XG5cdFx0XHRcdGlmIChrZXlNb2RzPy5hbHQgJiYgYWN0aXZlSW5zdGFuY2UpIHtcblx0XHRcdFx0XHQvLyBjcmVhdGUgc3BsaXQsIG9ubHkgdmFsaWQgaWYgdGhlcmUncyBhbiBhY3RpdmUgaW5zdGFuY2Vcblx0XHRcdFx0XHRpbnN0YW5jZSA9IGF3YWl0IHRoaXMuY3JlYXRlVGVybWluYWwoeyBsb2NhdGlvbjogeyBwYXJlbnRUZXJtaW5hbDogYWN0aXZlSW5zdGFuY2UgfSwgY29uZmlnOiByZXN1bHQuY29uZmlnLCBjd2QgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW5zdGFuY2UgPSBhd2FpdCB0aGlzLmNyZWF0ZVRlcm1pbmFsKHsgbG9jYXRpb246IHRoaXMuZGVmYXVsdExvY2F0aW9uLCBjb25maWc6IHJlc3VsdC5jb25maWcsIGN3ZCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5zdGFuY2UgJiYgdGhpcy5kZWZhdWx0TG9jYXRpb24gIT09IFRlcm1pbmFsTG9jYXRpb24uRWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnNob3dQYW5lbCh0cnVlKTtcblx0XHRcdFx0dGhpcy5zZXRBY3RpdmVJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0XHRcdHJldHVybiBpbnN0YW5jZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2luaXRpYWxpemVQcmltYXJ5QmFja2VuZCgpIHtcblx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL3dpbGxHZXRUZXJtaW5hbEJhY2tlbmQnKTtcblx0XHR0aGlzLl9wcmltYXJ5QmFja2VuZCA9IGF3YWl0IHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmdldEJhY2tlbmQodGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSk7XG5cdFx0bWFyaygnY29kZS90ZXJtaW5hbC9kaWRHZXRUZXJtaW5hbEJhY2tlbmQnKTtcblx0XHRjb25zdCBlbmFibGVUZXJtaW5hbFJlY29ubmVjdGlvbiA9IHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLmVuYWJsZVBlcnNpc3RlbnRTZXNzaW9ucztcblxuXHRcdC8vIENvbm5lY3QgdG8gdGhlIGV4dGVuc2lvbiBob3N0IGlmIGl0J3MgdGhlcmUsIHNldCB0aGUgY29ubmVjdGlvbiBzdGF0ZSB0byBjb25uZWN0ZWQgd2hlblxuXHRcdC8vIGl0J3MgZG9uZS4gVGhpcyBzaG91bGQgaGFwcGVuIGV2ZW4gd2hlbiB0aGVyZSBpcyBubyBleHRlbnNpb24gaG9zdC5cblx0XHR0aGlzLl9jb25uZWN0aW9uU3RhdGUgPSBUZXJtaW5hbENvbm5lY3Rpb25TdGF0ZS5Db25uZWN0aW5nO1xuXG5cdFx0Y29uc3QgaXNQZXJzaXN0ZW50UmVtb3RlID0gISF0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5ICYmIGVuYWJsZVRlcm1pbmFsUmVjb25uZWN0aW9uO1xuXG5cdFx0aWYgKHRoaXMuX3ByaW1hcnlCYWNrZW5kKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9wcmltYXJ5QmFja2VuZC5vbkRpZFJlcXVlc3REZXRhY2goYXN5bmMgKGUpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5zdGFuY2VUb0RldGFjaCA9IHRoaXMuZ2V0SW5zdGFuY2VGcm9tUmVzb3VyY2UoZ2V0VGVybWluYWxVcmkoZS53b3Jrc3BhY2VJZCwgZS5pbnN0YW5jZUlkKSk7XG5cdFx0XHRcdGlmIChpbnN0YW5jZVRvRGV0YWNoKSB7XG5cdFx0XHRcdFx0Y29uc3QgcGVyc2lzdGVudFByb2Nlc3NJZCA9IGluc3RhbmNlVG9EZXRhY2g/LnBlcnNpc3RlbnRQcm9jZXNzSWQ7XG5cdFx0XHRcdFx0aWYgKHBlcnNpc3RlbnRQcm9jZXNzSWQgJiYgIWluc3RhbmNlVG9EZXRhY2guc2hlbGxMYXVuY2hDb25maWcuaXNGZWF0dXJlVGVybWluYWwgJiYgIWluc3RhbmNlVG9EZXRhY2guc2hlbGxMYXVuY2hDb25maWcuY3VzdG9tUHR5SW1wbGVtZW50YXRpb24pIHtcblx0XHRcdFx0XHRcdGlmIChpbnN0YW5jZVRvRGV0YWNoLnRhcmdldCA9PT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fdGVybWluYWxFZGl0b3JTZXJ2aWNlLmRldGFjaEluc3RhbmNlKGluc3RhbmNlVG9EZXRhY2gpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuZ2V0R3JvdXBGb3JJbnN0YW5jZShpbnN0YW5jZVRvRGV0YWNoKT8ucmVtb3ZlSW5zdGFuY2UoaW5zdGFuY2VUb0RldGFjaCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRhd2FpdCBpbnN0YW5jZVRvRGV0YWNoLmRldGFjaFByb2Nlc3NBbmREaXNwb3NlKFRlcm1pbmFsRXhpdFJlYXNvbi5Vc2VyKTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX3ByaW1hcnlCYWNrZW5kPy5hY2NlcHREZXRhY2hJbnN0YW5jZVJlcGx5KGUucmVxdWVzdElkLCBwZXJzaXN0ZW50UHJvY2Vzc0lkKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gd2lsbCBnZXQgcmVqZWN0ZWQgd2l0aG91dCBhIHBlcnNpc3RlbnRQcm9jZXNzSWQgdG8gYXR0YWNoIHRvXG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLl9wcmltYXJ5QmFja2VuZD8uYWNjZXB0RGV0YWNoSW5zdGFuY2VSZXBseShlLnJlcXVlc3RJZCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL3dpbGxSZWNvbm5lY3QnKTtcblx0XHRsZXQgcmVjb25uZWN0ZWRQcm9taXNlOiBQcm9taXNlPGFueT47XG5cdFx0aWYgKGlzUGVyc2lzdGVudFJlbW90ZSkge1xuXHRcdFx0cmVjb25uZWN0ZWRQcm9taXNlID0gdGhpcy5fcmVjb25uZWN0VG9SZW1vdGVUZXJtaW5hbHMoKTtcblx0XHR9IGVsc2UgaWYgKGVuYWJsZVRlcm1pbmFsUmVjb25uZWN0aW9uKSB7XG5cdFx0XHRyZWNvbm5lY3RlZFByb21pc2UgPSB0aGlzLl9yZWNvbm5lY3RUb0xvY2FsVGVybWluYWxzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlY29ubmVjdGVkUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblx0XHRyZWNvbm5lY3RlZFByb21pc2UudGhlbihhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLl9zZXRDb25uZWN0ZWQoKTtcblx0XHRcdG1hcmsoJ2NvZGUvdGVybWluYWwvZGlkUmVjb25uZWN0Jyk7XG5cdFx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL3dpbGxSZXBsYXknKTtcblx0XHRcdGNvbnN0IGluc3RhbmNlcyA9IGF3YWl0IHRoaXMuX3JlY29ubmVjdGVkVGVybWluYWxHcm91cHM/LnRoZW4oZ3JvdXBzID0+IGdyb3Vwcy5tYXAoZSA9PiBlLnRlcm1pbmFsSW5zdGFuY2VzKS5mbGF0KCkpID8/IFtdO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoaW5zdGFuY2VzLm1hcChlID0+IG5ldyBQcm9taXNlPHZvaWQ+KHIgPT4gRXZlbnQub25jZShlLm9uUHJvY2Vzc1JlcGxheUNvbXBsZXRlKShyKSkpKTtcblx0XHRcdG1hcmsoJ2NvZGUvdGVybWluYWwvZGlkUmVwbGF5Jyk7XG5cdFx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL3dpbGxHZXRQZXJmb3JtYW5jZU1hcmtzJyk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChBcnJheS5mcm9tKHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmdldFJlZ2lzdGVyZWRCYWNrZW5kcygpKS5tYXAoYXN5bmMgYmFja2VuZCA9PiB7XG5cdFx0XHRcdHRoaXMuX3RpbWVyU2VydmljZS5zZXRQZXJmb3JtYW5jZU1hcmtzKGJhY2tlbmQucmVtb3RlQXV0aG9yaXR5ID09PSB1bmRlZmluZWQgPyAnbG9jYWxQdHlIb3N0JyA6ICdyZW1vdGVQdHlIb3N0JywgYXdhaXQgYmFja2VuZC5nZXRQZXJmb3JtYW5jZU1hcmtzKCkpO1xuXHRcdFx0XHRiYWNrZW5kLnNldFJlYWR5KCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL2RpZEdldFBlcmZvcm1hbmNlTWFya3MnKTtcblx0XHRcdHRoaXMuX3doZW5Db25uZWN0ZWQuY29tcGxldGUoKTtcblx0XHR9KTtcblx0fVxuXG5cdGdldFByaW1hcnlCYWNrZW5kKCk6IElUZXJtaW5hbEJhY2tlbmQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9wcmltYXJ5QmFja2VuZDtcblx0fVxuXG5cdHByaXZhdGUgX2ZvcndhcmRJbnN0YW5jZUhvc3RFdmVudHMoaG9zdDogSVRlcm1pbmFsSW5zdGFuY2VIb3N0KSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoaG9zdC5vbkRpZENoYW5nZUluc3RhbmNlcyh0aGlzLl9vbkRpZENoYW5nZUluc3RhbmNlcy5maXJlLCB0aGlzLl9vbkRpZENoYW5nZUluc3RhbmNlcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGhvc3Qub25EaWREaXNwb3NlSW5zdGFuY2UodGhpcy5fb25EaWREaXNwb3NlSW5zdGFuY2UuZmlyZSwgdGhpcy5fb25EaWREaXNwb3NlSW5zdGFuY2UpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihob3N0Lm9uRGlkQ2hhbmdlQWN0aXZlSW5zdGFuY2UoaW5zdGFuY2UgPT4gdGhpcy5fZXZhbHVhdGVBY3RpdmVJbnN0YW5jZShob3N0LCBpbnN0YW5jZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihob3N0Lm9uRGlkRm9jdXNJbnN0YW5jZShpbnN0YW5jZSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZEZvY3VzSW5zdGFuY2UuZmlyZShpbnN0YW5jZSk7XG5cdFx0XHR0aGlzLl9ldmFsdWF0ZUFjdGl2ZUluc3RhbmNlKGhvc3QsIGluc3RhbmNlKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoaG9zdC5vbkRpZENoYW5nZUluc3RhbmNlQ2FwYWJpbGl0eSgoaW5zdGFuY2UpID0+IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlSW5zdGFuY2VDYXBhYmlsaXR5LmZpcmUoaW5zdGFuY2UpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9ob3N0QWN0aXZlVGVybWluYWxzLnNldChob3N0LCB1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZXZhbHVhdGVBY3RpdmVJbnN0YW5jZShob3N0OiBJVGVybWluYWxJbnN0YW5jZUhvc3QsIGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCkge1xuXHRcdC8vIFRyYWNrIHRoZSBsYXRlc3QgYWN0aXZlIHRlcm1pbmFsIGZvciBlYWNoIGhvc3Qgc28gdGhhdCB3aGVuIG9uZSBiZWNvbWVzIHVuZGVmaW5lZCwgdGhlXG5cdFx0Ly8gVGVybWluYWxTZXJ2aWNlJ3MgYWN0aXZlIHRlcm1pbmFsIGlzIHNldCB0byB0aGUgbGFzdCBhY3RpdmUgdGVybWluYWwgZnJvbSB0aGUgb3RoZXIgaG9zdC5cblx0XHQvLyBUaGlzIG1lYW5zIGlmIHRoZSBsYXN0IHRlcm1pbmFsIGVkaXRvciBpcyBjbG9zZWQgc3VjaCB0aGF0IGl0IGJlY29tZXMgdW5kZWZpbmVkLCB0aGUgbGFzdFxuXHRcdC8vIGFjdGl2ZSBncm91cCdzIHRlcm1pbmFsIHdpbGwgYmUgdXNlZCBhcyB0aGUgYWN0aXZlIHRlcm1pbmFsIGlmIGF2YWlsYWJsZS5cblx0XHR0aGlzLl9ob3N0QWN0aXZlVGVybWluYWxzLnNldChob3N0LCBpbnN0YW5jZSk7XG5cdFx0aWYgKGluc3RhbmNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGZvciAoY29uc3QgYWN0aXZlIG9mIHRoaXMuX2hvc3RBY3RpdmVUZXJtaW5hbHMudmFsdWVzKCkpIHtcblx0XHRcdFx0aWYgKGFjdGl2ZSkge1xuXHRcdFx0XHRcdGluc3RhbmNlID0gYWN0aXZlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2FjdGl2ZUluc3RhbmNlID0gaW5zdGFuY2U7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZS5maXJlKGluc3RhbmNlKTtcblx0fVxuXG5cdHNldEFjdGl2ZUluc3RhbmNlKHZhbHVlOiBJVGVybWluYWxJbnN0YW5jZSkge1xuXHRcdC8vIElmIHRoaXMgd2FzIGEgaGlkZUZyb21Vc2VyIHRlcm1pbmFsIGNyZWF0ZWQgYnkgdGhlIEFQSSB0aGlzIHdhcyB0cmlnZ2VyZWQgYnkgc2hvdyxcblx0XHQvLyBpbiB3aGljaCBjYXNlIHdlIG5lZWQgdG8gY3JlYXRlIHRoZSB0ZXJtaW5hbCBncm91cFxuXHRcdGlmICh2YWx1ZS5zaGVsbExhdW5jaENvbmZpZy5oaWRlRnJvbVVzZXIpIHtcblx0XHRcdHRoaXMuX3Nob3dCYWNrZ3JvdW5kVGVybWluYWwodmFsdWUpO1xuXHRcdH1cblx0XHRpZiAodmFsdWUudGFyZ2V0ID09PSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvcikge1xuXHRcdFx0dGhpcy5fdGVybWluYWxFZGl0b3JTZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKHZhbHVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UodmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGZvY3VzSW5zdGFuY2UoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGluc3RhbmNlLnRhcmdldCA9PT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdHJldHVybiB0aGlzLl90ZXJtaW5hbEVkaXRvclNlcnZpY2UuZm9jdXNJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5mb2N1c0luc3RhbmNlKGluc3RhbmNlKTtcblx0fVxuXG5cdGFzeW5jIGZvY3VzQWN0aXZlSW5zdGFuY2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl9hY3RpdmVJbnN0YW5jZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5mb2N1c0luc3RhbmNlKHRoaXMuX2FjdGl2ZUluc3RhbmNlKTtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZUNvbnRyaWJ1dGVkVGVybWluYWxQcm9maWxlKGV4dGVuc2lvbklkZW50aWZpZXI6IHN0cmluZywgaWQ6IHN0cmluZywgb3B0aW9uczogSUNyZWF0ZUNvbnRyaWJ1dGVkVGVybWluYWxQcm9maWxlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX2V4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGVCeUV2ZW50KGBvblRlcm1pbmFsUHJvZmlsZToke2lkfWApO1xuXG5cdFx0Y29uc3QgcHJvZmlsZVByb3ZpZGVyID0gdGhpcy5fdGVybWluYWxQcm9maWxlU2VydmljZS5nZXRDb250cmlidXRlZFByb2ZpbGVQcm92aWRlcihleHRlbnNpb25JZGVudGlmaWVyLCBpZCk7XG5cdFx0aWYgKCFwcm9maWxlUHJvdmlkZXIpIHtcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoYE5vIHRlcm1pbmFsIHByb2ZpbGUgcHJvdmlkZXIgcmVnaXN0ZXJlZCBmb3IgaWQgXCIke2lkfVwiYCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBwcm9maWxlUHJvdmlkZXIuY3JlYXRlQ29udHJpYnV0ZWRUZXJtaW5hbFByb2ZpbGUob3B0aW9ucyk7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5zZXRBY3RpdmVJbnN0YW5jZUJ5SW5kZXgodGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuaW5zdGFuY2VzLmxlbmd0aCAtIDEpO1xuXHRcdFx0YXdhaXQgdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuYWN0aXZlSW5zdGFuY2U/LmZvY3VzV2hlblJlYWR5KCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlLm1lc3NhZ2UpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNhZmVEaXNwb3NlVGVybWluYWwoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gQ29uZmlybSBvbiBraWxsIGluIHRoZSBlZGl0b3IgaXMgaGFuZGxlZCBieSB0aGUgZWRpdG9yIGlucHV0XG5cdFx0aWYgKGluc3RhbmNlLnRhcmdldCAhPT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IgJiZcblx0XHRcdGluc3RhbmNlLmhhc0NoaWxkUHJvY2Vzc2VzICYmXG5cdFx0XHQodGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuY29uZmlybU9uS2lsbCA9PT0gJ3BhbmVsJyB8fCB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5jb25maXJtT25LaWxsID09PSAnYWx3YXlzJykpIHtcblx0XHRcdGNvbnN0IHZldG8gPSBhd2FpdCB0aGlzLl9zaG93VGVybWluYWxDbG9zZUNvbmZpcm1hdGlvbih0cnVlKTtcblx0XHRcdGlmICh2ZXRvKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHIgPT4ge1xuXHRcdFx0RXZlbnQub25jZShpbnN0YW5jZS5vbkV4aXQpKCgpID0+IHIoKSk7XG5cdFx0XHRpbnN0YW5jZS5kaXNwb3NlKFRlcm1pbmFsRXhpdFJlYXNvbi5Vc2VyKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3NldENvbm5lY3RlZCgpIHtcblx0XHR0aGlzLl9jb25uZWN0aW9uU3RhdGUgPSBUZXJtaW5hbENvbm5lY3Rpb25TdGF0ZS5Db25uZWN0ZWQ7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb25uZWN0aW9uU3RhdGUuZmlyZSgpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1B0eSBob3N0IHJlYWR5Jyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZWNvbm5lY3RUb1JlbW90ZVRlcm1pbmFscygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5O1xuXHRcdGlmICghcmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGJhY2tlbmQgPSBhd2FpdCB0aGlzLl90ZXJtaW5hbEluc3RhbmNlU2VydmljZS5nZXRCYWNrZW5kKHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0aWYgKCFiYWNrZW5kKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdG1hcmsoJ2NvZGUvdGVybWluYWwvd2lsbEdldFRlcm1pbmFsTGF5b3V0SW5mbycpO1xuXHRcdGNvbnN0IGxheW91dEluZm8gPSBhd2FpdCBiYWNrZW5kLmdldFRlcm1pbmFsTGF5b3V0SW5mbygpO1xuXHRcdG1hcmsoJ2NvZGUvdGVybWluYWwvZGlkR2V0VGVybWluYWxMYXlvdXRJbmZvJyk7XG5cdFx0YmFja2VuZC5yZWR1Y2VDb25uZWN0aW9uR3JhY2VUaW1lKCk7XG5cdFx0bWFyaygnY29kZS90ZXJtaW5hbC93aWxsUmVjcmVhdGVUZXJtaW5hbEdyb3VwcycpO1xuXHRcdGF3YWl0IHRoaXMuX3JlY3JlYXRlVGVybWluYWxHcm91cHMobGF5b3V0SW5mbyk7XG5cdFx0bWFyaygnY29kZS90ZXJtaW5hbC9kaWRSZWNyZWF0ZVRlcm1pbmFsR3JvdXBzJyk7XG5cdFx0Ly8gbm93IHRoYXQgdGVybWluYWxzIGhhdmUgYmVlbiByZXN0b3JlZCxcblx0XHQvLyBhdHRhY2ggbGlzdGVuZXJzIHRvIHVwZGF0ZSByZW1vdGUgd2hlbiB0ZXJtaW5hbHMgYXJlIGNoYW5nZWRcblx0XHR0aGlzLl9hdHRhY2hQcm9jZXNzTGF5b3V0TGlzdGVuZXJzKCk7XG5cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdSZWNvbm5lY3RlZCB0byByZW1vdGUgdGVybWluYWxzJyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZWNvbm5lY3RUb0xvY2FsVGVybWluYWxzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGxvY2FsQmFja2VuZCA9IGF3YWl0IHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmdldEJhY2tlbmQoKTtcblx0XHRpZiAoIWxvY2FsQmFja2VuZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRtYXJrKCdjb2RlL3Rlcm1pbmFsL3dpbGxHZXRUZXJtaW5hbExheW91dEluZm8nKTtcblx0XHRjb25zdCBsYXlvdXRJbmZvID0gYXdhaXQgbG9jYWxCYWNrZW5kLmdldFRlcm1pbmFsTGF5b3V0SW5mbygpO1xuXHRcdG1hcmsoJ2NvZGUvdGVybWluYWwvZGlkR2V0VGVybWluYWxMYXlvdXRJbmZvJyk7XG5cdFx0aWYgKGxheW91dEluZm8gJiYgbGF5b3V0SW5mby50YWJzLmxlbmd0aCA+IDApIHtcblx0XHRcdG1hcmsoJ2NvZGUvdGVybWluYWwvd2lsbFJlY3JlYXRlVGVybWluYWxHcm91cHMnKTtcblx0XHRcdHRoaXMuX3JlY29ubmVjdGVkVGVybWluYWxHcm91cHMgPSB0aGlzLl9yZWNyZWF0ZVRlcm1pbmFsR3JvdXBzKGxheW91dEluZm8pO1xuXHRcdFx0bWFyaygnY29kZS90ZXJtaW5hbC9kaWRSZWNyZWF0ZVRlcm1pbmFsR3JvdXBzJyk7XG5cdFx0fVxuXHRcdC8vIG5vdyB0aGF0IHRlcm1pbmFscyBoYXZlIGJlZW4gcmVzdG9yZWQsXG5cdFx0Ly8gYXR0YWNoIGxpc3RlbmVycyB0byB1cGRhdGUgbG9jYWwgc3RhdGUgd2hlbiB0ZXJtaW5hbHMgYXJlIGNoYW5nZWRcblx0XHR0aGlzLl9hdHRhY2hQcm9jZXNzTGF5b3V0TGlzdGVuZXJzKCk7XG5cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdSZWNvbm5lY3RlZCB0byBsb2NhbCB0ZXJtaW5hbHMnKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlY3JlYXRlVGVybWluYWxHcm91cHMobGF5b3V0SW5mbz86IElUZXJtaW5hbHNMYXlvdXRJbmZvKTogUHJvbWlzZTxJVGVybWluYWxHcm91cFtdPiB7XG5cdFx0Y29uc3QgZ3JvdXBQcm9taXNlczogUHJvbWlzZTxJVGVybWluYWxHcm91cCB8IHVuZGVmaW5lZD5bXSA9IFtdO1xuXHRcdGxldCBhY3RpdmVHcm91cDogUHJvbWlzZTxJVGVybWluYWxHcm91cCB8IHVuZGVmaW5lZD4gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGxheW91dEluZm8pIHtcblx0XHRcdGZvciAoY29uc3QgdGFiTGF5b3V0IG9mIGxheW91dEluZm8udGFicykge1xuXHRcdFx0XHRjb25zdCB0ZXJtaW5hbExheW91dHMgPSB0YWJMYXlvdXQudGVybWluYWxzLmZpbHRlcih0ID0+IHQudGVybWluYWwgJiYgdC50ZXJtaW5hbC5pc09ycGhhbik7XG5cdFx0XHRcdGlmICh0ZXJtaW5hbExheW91dHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5fcmVzdG9yZWRHcm91cENvdW50ICs9IHRlcm1pbmFsTGF5b3V0cy5sZW5ndGg7XG5cdFx0XHRcdFx0Y29uc3QgcHJvbWlzZSA9IHRoaXMuX3JlY3JlYXRlVGVybWluYWxHcm91cCh0YWJMYXlvdXQsIHRlcm1pbmFsTGF5b3V0cyk7XG5cdFx0XHRcdFx0Z3JvdXBQcm9taXNlcy5wdXNoKHByb21pc2UpO1xuXHRcdFx0XHRcdGlmICh0YWJMYXlvdXQuaXNBY3RpdmUpIHtcblx0XHRcdFx0XHRcdGFjdGl2ZUdyb3VwID0gcHJvbWlzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgYWN0aXZlSW5zdGFuY2UgPSB0aGlzLmluc3RhbmNlcy5maW5kKHQgPT4gdC5zaGVsbExhdW5jaENvbmZpZy5hdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcz8uaWQgPT09IHRhYkxheW91dC5hY3RpdmVQZXJzaXN0ZW50UHJvY2Vzc0lkKTtcblx0XHRcdFx0XHRpZiAoYWN0aXZlSW5zdGFuY2UpIHtcblx0XHRcdFx0XHRcdHRoaXMuc2V0QWN0aXZlSW5zdGFuY2UoYWN0aXZlSW5zdGFuY2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGxheW91dEluZm8udGFicy5sZW5ndGgpIHtcblx0XHRcdFx0YWN0aXZlR3JvdXA/LnRoZW4oZ3JvdXAgPT4gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAgPSBncm91cCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLmFsbChncm91cFByb21pc2VzKS50aGVuKHJlc3VsdCA9PiByZXN1bHQuZmlsdGVyKGUgPT4gISFlKSBhcyBJVGVybWluYWxHcm91cFtdKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JlY3JlYXRlVGVybWluYWxHcm91cCh0YWJMYXlvdXQ6IElSYXdUZXJtaW5hbFRhYkxheW91dEluZm88SVB0eUhvc3RBdHRhY2hUYXJnZXQgfCBudWxsPiwgdGVybWluYWxMYXlvdXRzOiBJUmF3VGVybWluYWxJbnN0YW5jZUxheW91dEluZm88SVB0eUhvc3RBdHRhY2hUYXJnZXQgfCBudWxsPltdKTogUHJvbWlzZTxJVGVybWluYWxHcm91cCB8IHVuZGVmaW5lZD4ge1xuXHRcdGxldCBsYXN0SW5zdGFuY2U6IFByb21pc2U8SVRlcm1pbmFsSW5zdGFuY2U+IHwgdW5kZWZpbmVkO1xuXHRcdGZvciAoY29uc3QgdGVybWluYWxMYXlvdXQgb2YgdGVybWluYWxMYXlvdXRzKSB7XG5cdFx0XHRjb25zdCBhdHRhY2hQZXJzaXN0ZW50UHJvY2VzcyA9IHRlcm1pbmFsTGF5b3V0LnRlcm1pbmFsITtcblx0XHRcdGlmICh0aGlzLl9saWZlY3ljbGVTZXJ2aWNlLnN0YXJ0dXBLaW5kICE9PSBTdGFydHVwS2luZC5SZWxvYWRlZFdpbmRvdyAmJiBhdHRhY2hQZXJzaXN0ZW50UHJvY2Vzcy50eXBlID09PSAnVGFzaycpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRtYXJrKGBjb2RlL3Rlcm1pbmFsL3dpbGxSZWNyZWF0ZVRlcm1pbmFsLyR7YXR0YWNoUGVyc2lzdGVudFByb2Nlc3MuaWR9LSR7YXR0YWNoUGVyc2lzdGVudFByb2Nlc3MucGlkfWApO1xuXHRcdFx0bGFzdEluc3RhbmNlID0gdGhpcy5jcmVhdGVUZXJtaW5hbCh7XG5cdFx0XHRcdGNvbmZpZzogeyBhdHRhY2hQZXJzaXN0ZW50UHJvY2VzcyB9LFxuXHRcdFx0XHRsb2NhdGlvbjogbGFzdEluc3RhbmNlID8geyBwYXJlbnRUZXJtaW5hbDogbGFzdEluc3RhbmNlIH0gOiBUZXJtaW5hbExvY2F0aW9uLlBhbmVsXG5cdFx0XHR9KTtcblx0XHRcdGxhc3RJbnN0YW5jZS50aGVuKCgpID0+IG1hcmsoYGNvZGUvdGVybWluYWwvZGlkUmVjcmVhdGVUZXJtaW5hbC8ke2F0dGFjaFBlcnNpc3RlbnRQcm9jZXNzLmlkfS0ke2F0dGFjaFBlcnNpc3RlbnRQcm9jZXNzLnBpZH1gKSk7XG5cdFx0fVxuXHRcdGNvbnN0IGdyb3VwID0gbGFzdEluc3RhbmNlPy50aGVuKGluc3RhbmNlID0+IHtcblx0XHRcdGNvbnN0IGcgPSB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5nZXRHcm91cEZvckluc3RhbmNlKGluc3RhbmNlKTtcblx0XHRcdGc/LnJlc2l6ZVBhbmVzKHRhYkxheW91dC50ZXJtaW5hbHMubWFwKHRlcm1pbmFsID0+IHRlcm1pbmFsLnJlbGF0aXZlU2l6ZSkpO1xuXHRcdFx0cmV0dXJuIGc7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGdyb3VwO1xuXHR9XG5cblx0cHJpdmF0ZSBfYXR0YWNoUHJvY2Vzc0xheW91dExpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlQWN0aXZlR3JvdXAoKCkgPT4gdGhpcy5fc2F2ZVN0YXRlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlQWN0aXZlSW5zdGFuY2UoKCkgPT4gdGhpcy5fc2F2ZVN0YXRlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlSW5zdGFuY2VzKCgpID0+IHRoaXMuX3NhdmVTdGF0ZSgpKSk7XG5cdFx0Ly8gVGhlIHN0YXRlIG11c3QgYmUgdXBkYXRlZCB3aGVuIHRoZSB0ZXJtaW5hbCBpcyByZWxhdW5jaGVkLCBvdGhlcndpc2UgdGhlIHBlcnNpc3RlbnRcblx0XHQvLyB0ZXJtaW5hbCBJRCB3aWxsIGJlIHN0YWxlIGFuZCB0aGUgcHJvY2VzcyB3aWxsIGJlIGxlYWtlZC5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uQW55SW5zdGFuY2VQcm9jZXNzSWRSZWFkeSgoKSA9PiB0aGlzLl9zYXZlU3RhdGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25BbnlJbnN0YW5jZVRpdGxlQ2hhbmdlKGluc3RhbmNlID0+IHRoaXMuX3VwZGF0ZVRpdGxlKGluc3RhbmNlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25BbnlJbnN0YW5jZUljb25DaGFuZ2UoZSA9PiB0aGlzLl91cGRhdGVJY29uKGUuaW5zdGFuY2UsIGUudXNlckluaXRpYXRlZCkpKTtcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZUluc3RhbmNlQ29udGV4dEtleXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgdGVybWluYWxJc09wZW5Db250ZXh0ID0gVGVybWluYWxDb250ZXh0S2V5cy5pc09wZW4uYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCB1cGRhdGVUZXJtaW5hbENvbnRleHRLZXlzID0gKCkgPT4ge1xuXHRcdFx0dGVybWluYWxJc09wZW5Db250ZXh0LnNldCh0aGlzLmluc3RhbmNlcy5sZW5ndGggPiAwKTtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsQ291bnRDb250ZXh0S2V5LnNldCh0aGlzLmluc3RhbmNlcy5sZW5ndGgpO1xuXHRcdH07XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZUluc3RhbmNlcygoKSA9PiB1cGRhdGVUZXJtaW5hbENvbnRleHRLZXlzKCkpKTtcblx0fVxuXG5cdGFzeW5jIGdldEFjdGl2ZU9yQ3JlYXRlSW5zdGFuY2Uob3B0aW9ucz86IHsgYWNjZXB0c0lucHV0PzogYm9vbGVhbiB9KTogUHJvbWlzZTxJVGVybWluYWxJbnN0YW5jZT4ge1xuXHRcdGNvbnN0IGFjdGl2ZUluc3RhbmNlID0gdGhpcy5hY3RpdmVJbnN0YW5jZTtcblx0XHQvLyBObyBpbnN0YW5jZSwgY3JlYXRlXG5cdFx0aWYgKCFhY3RpdmVJbnN0YW5jZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlVGVybWluYWwoKTtcblx0XHR9XG5cdFx0Ly8gQWN0aXZlIGluc3RhbmNlLCBlbnN1cmUgYWNjZXB0cyBpbnB1dFxuXHRcdGlmICghb3B0aW9ucz8uYWNjZXB0c0lucHV0IHx8IGFjdGl2ZUluc3RhbmNlLnh0ZXJtPy5pc1N0ZGluRGlzYWJsZWQgIT09IHRydWUpIHtcblx0XHRcdHJldHVybiBhY3RpdmVJbnN0YW5jZTtcblx0XHR9XG5cdFx0Ly8gQWN0aXZlIGluc3RhbmNlIGRvZXNuJ3QgYWNjZXB0IGlucHV0LCBjcmVhdGUgYW5kIGZvY3VzXG5cdFx0Y29uc3QgaW5zdGFuY2UgPSBhd2FpdCB0aGlzLmNyZWF0ZVRlcm1pbmFsKCk7XG5cdFx0dGhpcy5zZXRBY3RpdmVJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0YXdhaXQgdGhpcy5yZXZlYWxBY3RpdmVUZXJtaW5hbCgpO1xuXHRcdHJldHVybiBpbnN0YW5jZTtcblx0fVxuXG5cdGFzeW5jIHJldmVhbFRlcm1pbmFsKHNvdXJjZTogSVRlcm1pbmFsSW5zdGFuY2UsIHByZXNlcnZlRm9jdXM/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHNvdXJjZS50YXJnZXQgPT09IFRlcm1pbmFsTG9jYXRpb24uRWRpdG9yKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl90ZXJtaW5hbEVkaXRvclNlcnZpY2UucmV2ZWFsQWN0aXZlRWRpdG9yKHByZXNlcnZlRm9jdXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5zaG93UGFuZWwoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZXZlYWxBY3RpdmVUZXJtaW5hbChwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5hY3RpdmVJbnN0YW5jZTtcblx0XHRpZiAoIWluc3RhbmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMucmV2ZWFsVGVybWluYWwoaW5zdGFuY2UsIHByZXNlcnZlRm9jdXMpO1xuXHR9XG5cblx0c2V0RWRpdGFibGUoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLCBkYXRhPzogSUVkaXRhYmxlRGF0YSB8IG51bGwpOiB2b2lkIHtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHRoaXMuX2VkaXRhYmxlID0gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9lZGl0YWJsZSA9IHsgaW5zdGFuY2U6IGluc3RhbmNlLCBkYXRhIH07XG5cdFx0fVxuXHRcdGNvbnN0IHBhbmUgPSB0aGlzLl92aWV3c1NlcnZpY2UuZ2V0QWN0aXZlVmlld1dpdGhJZDxUZXJtaW5hbFZpZXdQYW5lPihURVJNSU5BTF9WSUVXX0lEKTtcblx0XHRjb25zdCBpc0VkaXRpbmcgPSB0aGlzLmlzRWRpdGFibGUoaW5zdGFuY2UpO1xuXHRcdHBhbmU/LnRlcm1pbmFsVGFiYmVkVmlldz8uc2V0RWRpdGFibGUoaXNFZGl0aW5nKTtcblx0fVxuXG5cdGlzRWRpdGFibGUoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5fZWRpdGFibGUgJiYgKHRoaXMuX2VkaXRhYmxlLmluc3RhbmNlID09PSBpbnN0YW5jZSB8fCAhaW5zdGFuY2UpO1xuXHR9XG5cblx0Z2V0RWRpdGFibGVEYXRhKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IElFZGl0YWJsZURhdGEgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0YWJsZSAmJiB0aGlzLl9lZGl0YWJsZS5pbnN0YW5jZSA9PT0gaW5zdGFuY2UgPyB0aGlzLl9lZGl0YWJsZS5kYXRhIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cmVxdWVzdFN0YXJ0RXh0ZW5zaW9uVGVybWluYWwocHJveHk6IElUZXJtaW5hbFByb2Nlc3NFeHRIb3N0UHJveHksIGNvbHM6IG51bWJlciwgcm93czogbnVtYmVyKTogUHJvbWlzZTxJVGVybWluYWxMYXVuY2hFcnJvciB8IHVuZGVmaW5lZD4ge1xuXHRcdC8vIFRoZSBpbml0aWFsIHJlcXVlc3QgY2FtZSBmcm9tIHRoZSBleHRlbnNpb24gaG9zdCwgbm8gbmVlZCB0byB3YWl0IGZvciBpdFxuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxJVGVybWluYWxMYXVuY2hFcnJvciB8IHVuZGVmaW5lZD4oY2FsbGJhY2sgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRSZXF1ZXN0U3RhcnRFeHRlbnNpb25UZXJtaW5hbC5maXJlKHsgcHJveHksIGNvbHMsIHJvd3MsIGNhbGxiYWNrIH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25CZWZvcmVTaHV0ZG93bihyZWFzb246IFNodXRkb3duUmVhc29uKTogYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdC8vIE5ldmVyIHZldG8gb24gd2ViIGFzIHRoaXMgd291bGQgYmxvY2sgYWxsIHdpbmRvd3MgZnJvbSBiZWluZyBjbG9zZWQuIFRoaXMgZGlzYWJsZXNcblx0XHQvLyBwcm9jZXNzIHJldml2ZSBhcyB3ZSBjYW4ndCBoYW5kbGUgaXQgb24gc2h1dGRvd24uXG5cdFx0aWYgKGlzV2ViKSB7XG5cdFx0XHR0aGlzLl9pc1NodXR0aW5nRG93biA9IHRydWU7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9vbkJlZm9yZVNodXRkb3duQXN5bmMocmVhc29uKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX29uQmVmb3JlU2h1dGRvd25Bc3luYyhyZWFzb246IFNodXRkb3duUmVhc29uKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKHRoaXMuaW5zdGFuY2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gTm8gdGVybWluYWwgaW5zdGFuY2VzLCBkb24ndCB2ZXRvXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gUGVyc2lzdCB0ZXJtaW5hbCBfYnVmZmVyIHN0YXRlXywgbm90ZSB0aGF0IGV2ZW4gaWYgdGhpcyBoYXBwZW5zIHRoZSBkaXJ0eSB0ZXJtaW5hbCBwcm9tcHRcblx0XHQvLyBzdGlsbCBzaG93cyBhcyB0aGF0IGNhbm5vdCBiZSByZXZpdmVkXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX3NodXRkb3duV2luZG93Q291bnQgPSBhd2FpdCB0aGlzLl9uYXRpdmVEZWxlZ2F0ZT8uZ2V0V2luZG93Q291bnQoKTtcblx0XHRcdGNvbnN0IHNob3VsZFJldml2ZVByb2Nlc3NlcyA9IHRoaXMuX3Nob3VsZFJldml2ZVByb2Nlc3NlcyhyZWFzb24pO1xuXHRcdFx0aWYgKHNob3VsZFJldml2ZVByb2Nlc3Nlcykge1xuXHRcdFx0XHQvLyBBdHRlbXB0IHRvIHBlcnNpc3QgdGhlIHRlcm1pbmFsIHN0YXRlIGJ1dCBvbmx5IGFsbG93IDIwMDBtcyBhcyB3ZSBjYW4ndCBibG9ja1xuXHRcdFx0XHQvLyBzaHV0ZG93bi4gVGhpcyBjYW4gaGFwcGVuIHdoZW4gaW4gYSByZW1vdGUgd29ya3NwYWNlIGJ1dCB0aGUgb3RoZXIgc2lkZSBoYXMgYmVlblxuXHRcdFx0XHQvLyBzdXNwZW5kZWQgYW5kIGlzIGluIHRoZSBwcm9jZXNzIG9mIHJlY29ubmVjdGluZywgdGhlIG1lc3NhZ2Ugd2lsbCBiZSBwdXQgaW4gYVxuXHRcdFx0XHQvLyBxdWV1ZSBpbiB0aGlzIGNhc2UgZm9yIHdoZW4gdGhlIGNvbm5lY3Rpb24gaXMgYmFjayB1cCBhbmQgcnVubmluZy4gQWJvcnRpbmcgdGhlXG5cdFx0XHRcdC8vIHByb2Nlc3MgaXMgcHJlZmVyYWJsZSBpbiB0aGlzIGNhc2UuXG5cdFx0XHRcdGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHRcdFx0dGhpcy5fcHJpbWFyeUJhY2tlbmQ/LnBlcnNpc3RUZXJtaW5hbFN0YXRlKCksXG5cdFx0XHRcdFx0dGltZW91dCgyMDAwKVxuXHRcdFx0XHRdKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUGVyc2lzdCB0ZXJtaW5hbCBfcHJvY2Vzc2VzX1xuXHRcdFx0Y29uc3Qgc2hvdWxkUGVyc2lzdFByb2Nlc3NlcyA9IHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLmVuYWJsZVBlcnNpc3RlbnRTZXNzaW9ucyAmJiByZWFzb24gPT09IFNodXRkb3duUmVhc29uLlJFTE9BRDtcblx0XHRcdGlmICghc2hvdWxkUGVyc2lzdFByb2Nlc3Nlcykge1xuXHRcdFx0XHRjb25zdCBoYXNEaXJ0eUluc3RhbmNlcyA9IChcblx0XHRcdFx0XHQodGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuY29uZmlybU9uRXhpdCA9PT0gJ2Fsd2F5cycgJiYgdGhpcy5mb3JlZ3JvdW5kSW5zdGFuY2VzLmxlbmd0aCA+IDApIHx8XG5cdFx0XHRcdFx0KHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLmNvbmZpcm1PbkV4aXQgPT09ICdoYXNDaGlsZFByb2Nlc3NlcycgJiYgdGhpcy5mb3JlZ3JvdW5kSW5zdGFuY2VzLnNvbWUoZSA9PiBlLmhhc0NoaWxkUHJvY2Vzc2VzKSlcblx0XHRcdFx0KTtcblx0XHRcdFx0aWYgKGhhc0RpcnR5SW5zdGFuY2VzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX29uQmVmb3JlU2h1dGRvd25Db25maXJtYXRpb24ocmVhc29uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycjogdW5rbm93bikge1xuXHRcdFx0Ly8gU3dhbGxvdyBhcyBleGNlcHRpb25zIHNob3VsZCBub3QgY2F1c2UgYSB2ZXRvIHRvIHByZXZlbnQgc2h1dGRvd25cblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybignRXhjZXB0aW9uIG9jY3VycmVkIGR1cmluZyB0ZXJtaW5hbCBzaHV0ZG93bicsIGVycik7XG5cdFx0fVxuXG5cdFx0dGhpcy5faXNTaHV0dGluZ0Rvd24gPSB0cnVlO1xuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0c2V0TmF0aXZlRGVsZWdhdGUobmF0aXZlRGVsZWdhdGU6IElUZXJtaW5hbFNlcnZpY2VOYXRpdmVEZWxlZ2F0ZSk6IHZvaWQge1xuXHRcdHRoaXMuX25hdGl2ZURlbGVnYXRlID0gbmF0aXZlRGVsZWdhdGU7XG5cdH1cblxuXHRwcml2YXRlIF9zaG91bGRSZXZpdmVQcm9jZXNzZXMocmVhc29uOiBTaHV0ZG93blJlYXNvbik6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZW5hYmxlUGVyc2lzdGVudFNlc3Npb25zKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHN3aXRjaCAodGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcucGVyc2lzdGVudFNlc3Npb25SZXZpdmVQcm9jZXNzKSB7XG5cdFx0XHRjYXNlICdvbkV4aXQnOiB7XG5cdFx0XHRcdC8vIEFsbG93IG9uIGNsb3NlIGlmIGl0J3MgdGhlIGxhc3Qgd2luZG93IG9uIFdpbmRvd3Mgb3IgTGludXhcblx0XHRcdFx0aWYgKHJlYXNvbiA9PT0gU2h1dGRvd25SZWFzb24uQ0xPU0UgJiYgKHRoaXMuX3NodXRkb3duV2luZG93Q291bnQgPT09IDEgJiYgIWlzTWFjaW50b3NoKSkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZWFzb24gPT09IFNodXRkb3duUmVhc29uLkxPQUQgfHwgcmVhc29uID09PSBTaHV0ZG93blJlYXNvbi5RVUlUO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnb25FeGl0QW5kV2luZG93Q2xvc2UnOiByZXR1cm4gcmVhc29uICE9PSBTaHV0ZG93blJlYXNvbi5SRUxPQUQ7XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfb25CZWZvcmVTaHV0ZG93bkNvbmZpcm1hdGlvbihyZWFzb246IFNodXRkb3duUmVhc29uKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Ly8gdmV0byBpZiBjb25maWd1cmVkIHRvIHNob3cgY29uZmlybWF0aW9uIGFuZCB0aGUgdXNlciBjaG9zZSBub3QgdG8gZXhpdFxuXHRcdGNvbnN0IHZldG8gPSBhd2FpdCB0aGlzLl9zaG93VGVybWluYWxDbG9zZUNvbmZpcm1hdGlvbigpO1xuXHRcdGlmICghdmV0bykge1xuXHRcdFx0dGhpcy5faXNTaHV0dGluZ0Rvd24gPSB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiB2ZXRvO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25XaWxsU2h1dGRvd24oZTogV2lsbFNodXRkb3duRXZlbnQpOiB2b2lkIHtcblx0XHQvLyBEb24ndCB0b3VjaCBwcm9jZXNzZXMgaWYgdGhlIHNodXRkb3duIHdhcyBhIHJlc3VsdCBvZiByZWxvYWQgYXMgdGhleSB3aWxsIGJlIHJlYXR0YWNoZWRcblx0XHRjb25zdCBzaG91bGRQZXJzaXN0VGVybWluYWxzID0gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZW5hYmxlUGVyc2lzdGVudFNlc3Npb25zICYmIGUucmVhc29uID09PSBTaHV0ZG93blJlYXNvbi5SRUxPQUQ7XG5cblx0XHRmb3IgKGNvbnN0IGluc3RhbmNlIG9mIFsuLi50aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5pbnN0YW5jZXMsIC4uLnRoaXMuX2JhY2tncm91bmRlZFRlcm1pbmFsSW5zdGFuY2VzXSkge1xuXHRcdFx0aWYgKHNob3VsZFBlcnNpc3RUZXJtaW5hbHMgJiYgaW5zdGFuY2Uuc2hvdWxkUGVyc2lzdCkge1xuXHRcdFx0XHRpbnN0YW5jZS5kZXRhY2hQcm9jZXNzQW5kRGlzcG9zZShUZXJtaW5hbEV4aXRSZWFzb24uU2h1dGRvd24pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aW5zdGFuY2UuZGlzcG9zZShUZXJtaW5hbEV4aXRSZWFzb24uU2h1dGRvd24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENsZWFyIHRlcm1pbmFsIGxheW91dCBpbmZvIG9ubHkgd2hlbiBub3QgcGVyc2lzdGluZ1xuXHRcdGlmICghc2hvdWxkUGVyc2lzdFRlcm1pbmFscyAmJiAhdGhpcy5fc2hvdWxkUmV2aXZlUHJvY2Vzc2VzKGUucmVhc29uKSkge1xuXHRcdFx0dGhpcy5fcHJpbWFyeUJhY2tlbmQ/LnNldFRlcm1pbmFsTGF5b3V0SW5mbyh1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdEBkZWJvdW5jZSg1MDApXG5cdHByaXZhdGUgX3NhdmVTdGF0ZSgpOiB2b2lkIHtcblx0XHQvLyBBdm9pZCBzYXZpbmcgc3RhdGUgd2hlbiBzaHV0dGluZyBkb3duIGFzIHRoYXQgd291bGQgb3ZlcnJpZGUgcHJvY2VzcyBzdGF0ZSB0byBiZSByZXZpdmVkXG5cdFx0aWYgKHRoaXMuX2lzU2h1dHRpbmdEb3duKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZW5hYmxlUGVyc2lzdGVudFNlc3Npb25zKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHRhYnMgPSB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5ncm91cHMubWFwKGcgPT4gZy5nZXRMYXlvdXRJbmZvKGcgPT09IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwKSk7XG5cdFx0Y29uc3Qgc3RhdGU6IElUZXJtaW5hbHNMYXlvdXRJbmZvQnlJZCA9IHsgdGFicyB9O1xuXHRcdHRoaXMuX3ByaW1hcnlCYWNrZW5kPy5zZXRUZXJtaW5hbExheW91dEluZm8oc3RhdGUpO1xuXHR9XG5cblx0QGRlYm91bmNlKDUwMClcblx0cHJpdmF0ZSBfdXBkYXRlVGl0bGUoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5lbmFibGVQZXJzaXN0ZW50U2Vzc2lvbnMgfHwgIWluc3RhbmNlIHx8ICFpbnN0YW5jZS5wZXJzaXN0ZW50UHJvY2Vzc0lkIHx8ICFpbnN0YW5jZS50aXRsZSB8fCBpbnN0YW5jZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChpbnN0YW5jZS5zdGF0aWNUaXRsZSkge1xuXHRcdFx0dGhpcy5fcHJpbWFyeUJhY2tlbmQ/LnVwZGF0ZVRpdGxlKGluc3RhbmNlLnBlcnNpc3RlbnRQcm9jZXNzSWQsIGluc3RhbmNlLnN0YXRpY1RpdGxlLCBUaXRsZUV2ZW50U291cmNlLkFwaSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3ByaW1hcnlCYWNrZW5kPy51cGRhdGVUaXRsZShpbnN0YW5jZS5wZXJzaXN0ZW50UHJvY2Vzc0lkLCBpbnN0YW5jZS50aXRsZSwgaW5zdGFuY2UudGl0bGVTb3VyY2UpO1xuXHRcdH1cblx0fVxuXG5cdEBkZWJvdW5jZSg1MDApXG5cdHByaXZhdGUgX3VwZGF0ZUljb24oaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLCB1c2VySW5pdGlhdGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5lbmFibGVQZXJzaXN0ZW50U2Vzc2lvbnMgfHwgIWluc3RhbmNlIHx8ICFpbnN0YW5jZS5wZXJzaXN0ZW50UHJvY2Vzc0lkIHx8ICFpbnN0YW5jZS5pY29uIHx8IGluc3RhbmNlLmlzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fcHJpbWFyeUJhY2tlbmQ/LnVwZGF0ZUljb24oaW5zdGFuY2UucGVyc2lzdGVudFByb2Nlc3NJZCwgdXNlckluaXRpYXRlZCwgaW5zdGFuY2UuaWNvbiwgaW5zdGFuY2UuY29sb3IpO1xuXHR9XG5cblx0cmVmcmVzaEFjdGl2ZUdyb3VwKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlR3JvdXAuZmlyZSh0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5hY3RpdmVHcm91cCk7XG5cdH1cblxuXHRnZXRJbnN0YW5jZUZyb21JZCh0ZXJtaW5hbElkOiBudW1iZXIpOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IGJnSW5kZXggPSAtMTtcblx0XHR0aGlzLl9iYWNrZ3JvdW5kZWRUZXJtaW5hbEluc3RhbmNlcy5mb3JFYWNoKCh0ZXJtaW5hbEluc3RhbmNlLCBpKSA9PiB7XG5cdFx0XHRpZiAodGVybWluYWxJbnN0YW5jZS5pbnN0YW5jZUlkID09PSB0ZXJtaW5hbElkKSB7XG5cdFx0XHRcdGJnSW5kZXggPSBpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGlmIChiZ0luZGV4ICE9PSAtMSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2JhY2tncm91bmRlZFRlcm1pbmFsSW5zdGFuY2VzW2JnSW5kZXhdO1xuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFuY2VzW3RoaXMuX2dldEluZGV4RnJvbUlkKHRlcm1pbmFsSWQpXTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0Z2V0SW5zdGFuY2VGcm9tSW5kZXgodGVybWluYWxJbmRleDogbnVtYmVyKTogSVRlcm1pbmFsSW5zdGFuY2Uge1xuXHRcdHJldHVybiB0aGlzLmluc3RhbmNlc1t0ZXJtaW5hbEluZGV4XTtcblx0fVxuXG5cdGdldEluc3RhbmNlRnJvbVJlc291cmNlKHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQpOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGdldEluc3RhbmNlRnJvbVJlc291cmNlKHRoaXMuaW5zdGFuY2VzLCByZXNvdXJjZSk7XG5cdH1cblxuXHRpc0F0dGFjaGVkVG9UZXJtaW5hbChyZW1vdGVUZXJtOiBJUmVtb3RlVGVybWluYWxBdHRhY2hUYXJnZXQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pbnN0YW5jZXMuc29tZSh0ZXJtID0+IHRlcm0ucHJvY2Vzc0lkID09PSByZW1vdGVUZXJtLnBpZCk7XG5cdH1cblxuXHRtb3ZlVG9FZGl0b3Ioc291cmNlOiBJVGVybWluYWxJbnN0YW5jZSwgZ3JvdXA/OiBHcm91cElkZW50aWZpZXIgfCBTSURFX0dST1VQX1RZUEUgfCBBQ1RJVkVfR1JPVVBfVFlQRSB8IEFVWF9XSU5ET1dfR1JPVVBfVFlQRSk6IHZvaWQge1xuXHRcdGlmIChzb3VyY2UudGFyZ2V0ID09PSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBzb3VyY2VHcm91cCA9IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmdldEdyb3VwRm9ySW5zdGFuY2Uoc291cmNlKTtcblx0XHRpZiAoIXNvdXJjZUdyb3VwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHNvdXJjZUdyb3VwLnJlbW92ZUluc3RhbmNlKHNvdXJjZSk7XG5cdFx0dGhpcy5fdGVybWluYWxFZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioc291cmNlLCBncm91cCA/IHsgdmlld0NvbHVtbjogZ3JvdXAgfSA6IHVuZGVmaW5lZCk7XG5cblx0fVxuXG5cdG1vdmVJbnRvTmV3RWRpdG9yKHNvdXJjZTogSVRlcm1pbmFsSW5zdGFuY2UpOiB2b2lkIHtcblx0XHR0aGlzLm1vdmVUb0VkaXRvcihzb3VyY2UsIEFVWF9XSU5ET1dfR1JPVVApO1xuXHR9XG5cblx0YXN5bmMgbW92ZVRvVGVybWluYWxWaWV3KHNvdXJjZT86IElUZXJtaW5hbEluc3RhbmNlIHwgVVJJLCB0YXJnZXQ/OiBJVGVybWluYWxJbnN0YW5jZSwgc2lkZT86ICdiZWZvcmUnIHwgJ2FmdGVyJyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChVUkkuaXNVcmkoc291cmNlKSkge1xuXHRcdFx0c291cmNlID0gdGhpcy5nZXRJbnN0YW5jZUZyb21SZXNvdXJjZShzb3VyY2UpO1xuXHRcdH1cblxuXHRcdGlmICghc291cmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fdGVybWluYWxFZGl0b3JTZXJ2aWNlLmRldGFjaEluc3RhbmNlKHNvdXJjZSk7XG5cblx0XHRpZiAoc291cmNlLnRhcmdldCAhPT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdGF3YWl0IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnNob3dQYW5lbCh0cnVlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c291cmNlLnRhcmdldCA9IFRlcm1pbmFsTG9jYXRpb24uUGFuZWw7XG5cblx0XHRsZXQgZ3JvdXA6IElUZXJtaW5hbEdyb3VwIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0YXJnZXQpIHtcblx0XHRcdGdyb3VwID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuZ2V0R3JvdXBGb3JJbnN0YW5jZSh0YXJnZXQpO1xuXHRcdH1cblxuXHRcdGlmICghZ3JvdXApIHtcblx0XHRcdGdyb3VwID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuY3JlYXRlR3JvdXAoKTtcblx0XHR9XG5cblx0XHRncm91cC5hZGRJbnN0YW5jZShzb3VyY2UpO1xuXHRcdHRoaXMuc2V0QWN0aXZlSW5zdGFuY2Uoc291cmNlKTtcblx0XHRhd2FpdCB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5zaG93UGFuZWwodHJ1ZSk7XG5cblx0XHRpZiAodGFyZ2V0ICYmIHNpZGUpIHtcblx0XHRcdGNvbnN0IGluZGV4ID0gZ3JvdXAudGVybWluYWxJbnN0YW5jZXMuaW5kZXhPZih0YXJnZXQpICsgKHNpZGUgPT09ICdhZnRlcicgPyAxIDogMCk7XG5cdFx0XHRncm91cC5tb3ZlSW5zdGFuY2Uoc291cmNlLCBpbmRleCwgc2lkZSk7XG5cdFx0fVxuXG5cdFx0Ly8gRmlyZSBldmVudHNcblx0XHR0aGlzLl9vbkRpZENoYW5nZUluc3RhbmNlcy5maXJlKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVHcm91cC5maXJlKHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfaW5pdEluc3RhbmNlTGlzdGVuZXJzKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IHZvaWQge1xuXHRcdGNvbnN0IGluc3RhbmNlRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0aW5zdGFuY2VEaXNwb3NhYmxlcy5hZGQoaW5zdGFuY2Uub25EaW1lbnNpb25zQ2hhbmdlZCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUluc3RhbmNlRGltZW5zaW9ucy5maXJlKGluc3RhbmNlKTtcblx0XHRcdGlmICh0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5lbmFibGVQZXJzaXN0ZW50U2Vzc2lvbnMgJiYgdGhpcy5pc1Byb2Nlc3NTdXBwb3J0UmVnaXN0ZXJlZCkge1xuXHRcdFx0XHR0aGlzLl9zYXZlU3RhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0aW5zdGFuY2VEaXNwb3NhYmxlcy5hZGQoaW5zdGFuY2Uub25EaWRGb2N1cyh0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZUluc3RhbmNlLmZpcmUsIHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlSW5zdGFuY2UpKTtcblx0XHRpbnN0YW5jZURpc3Bvc2FibGVzLmFkZChpbnN0YW5jZS5vblJlcXVlc3RBZGRJbnN0YW5jZVRvR3JvdXAoYXN5bmMgZSA9PiBhd2FpdCB0aGlzLl9hZGRJbnN0YW5jZVRvR3JvdXAoaW5zdGFuY2UsIGUpKSk7XG5cdFx0Y29uc3QgZGlzcG9zZUxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFuY2Uub25EaXNwb3NlZCgoKSA9PiB7XG5cdFx0XHRpbnN0YW5jZURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX3N0b3JlLmRlbGV0ZShkaXNwb3NlTGlzdGVuZXIpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2FkZEluc3RhbmNlVG9Hcm91cChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UsIGU6IElSZXF1ZXN0QWRkSW5zdGFuY2VUb0dyb3VwRXZlbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0ZXJtaW5hbElkZW50aWZpZXIgPSBwYXJzZVRlcm1pbmFsVXJpKGUudXJpKTtcblx0XHRpZiAodGVybWluYWxJZGVudGlmaWVyLmluc3RhbmNlSWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBzb3VyY2VJbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQgPSB0aGlzLmdldEluc3RhbmNlRnJvbVJlc291cmNlKGUudXJpKTtcblxuXHRcdC8vIFRlcm1pbmFsIGZyb20gYSBkaWZmZXJlbnQgd2luZG93XG5cdFx0aWYgKCFzb3VyY2VJbnN0YW5jZSkge1xuXHRcdFx0Y29uc3QgYXR0YWNoUGVyc2lzdGVudFByb2Nlc3MgPSBhd2FpdCB0aGlzLl9wcmltYXJ5QmFja2VuZD8ucmVxdWVzdERldGFjaEluc3RhbmNlKHRlcm1pbmFsSWRlbnRpZmllci53b3Jrc3BhY2VJZCwgdGVybWluYWxJZGVudGlmaWVyLmluc3RhbmNlSWQpO1xuXHRcdFx0aWYgKGF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzKSB7XG5cdFx0XHRcdHNvdXJjZUluc3RhbmNlID0gYXdhaXQgdGhpcy5jcmVhdGVUZXJtaW5hbCh7IGNvbmZpZzogeyBhdHRhY2hQZXJzaXN0ZW50UHJvY2VzcyB9LCByZXNvdXJjZTogZS51cmkgfSk7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLm1vdmVJbnN0YW5jZShzb3VyY2VJbnN0YW5jZSwgaW5zdGFuY2UsIGUuc2lkZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBWaWV3IHRlcm1pbmFsc1xuXHRcdHNvdXJjZUluc3RhbmNlID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuZ2V0SW5zdGFuY2VGcm9tUmVzb3VyY2UoZS51cmkpO1xuXHRcdGlmIChzb3VyY2VJbnN0YW5jZSkge1xuXHRcdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UubW92ZUluc3RhbmNlKHNvdXJjZUluc3RhbmNlLCBpbnN0YW5jZSwgZS5zaWRlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBUZXJtaW5hbCBlZGl0b3JzXG5cdFx0c291cmNlSW5zdGFuY2UgPSB0aGlzLl90ZXJtaW5hbEVkaXRvclNlcnZpY2UuZ2V0SW5zdGFuY2VGcm9tUmVzb3VyY2UoZS51cmkpO1xuXHRcdGlmIChzb3VyY2VJbnN0YW5jZSkge1xuXHRcdFx0dGhpcy5tb3ZlVG9UZXJtaW5hbFZpZXcoc291cmNlSW5zdGFuY2UsIGluc3RhbmNlLCBlLnNpZGUpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm47XG5cdH1cblxuXHRyZWdpc3RlclByb2Nlc3NTdXBwb3J0KGlzU3VwcG9ydGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKCFpc1N1cHBvcnRlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9wcm9jZXNzU3VwcG9ydENvbnRleHRLZXkuc2V0KGlzU3VwcG9ydGVkKTtcblx0XHR0aGlzLl9vbkRpZFJlZ2lzdGVyUHJvY2Vzc1N1cHBvcnQuZmlyZSgpO1xuXHR9XG5cblx0Ly8gVE9ETzogUmVtb3ZlIHRoaXMsIGl0IHNob3VsZCBsaXZlIGluIGdyb3VwL2VkaXRvciBzZXJ2aW9jZVxuXHRwcml2YXRlIF9nZXRJbmRleEZyb21JZCh0ZXJtaW5hbElkOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGxldCB0ZXJtaW5hbEluZGV4ID0gLTE7XG5cdFx0dGhpcy5pbnN0YW5jZXMuZm9yRWFjaCgodGVybWluYWxJbnN0YW5jZSwgaSkgPT4ge1xuXHRcdFx0aWYgKHRlcm1pbmFsSW5zdGFuY2UuaW5zdGFuY2VJZCA9PT0gdGVybWluYWxJZCkge1xuXHRcdFx0XHR0ZXJtaW5hbEluZGV4ID0gaTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZiAodGVybWluYWxJbmRleCA9PT0gLTEpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVGVybWluYWwgd2l0aCBJRCAke3Rlcm1pbmFsSWR9IGRvZXMgbm90IGV4aXN0IChoYXMgaXQgYWxyZWFkeSBiZWVuIGRpc3Bvc2VkPylgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRlcm1pbmFsSW5kZXg7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgX3Nob3dUZXJtaW5hbENsb3NlQ29uZmlybWF0aW9uKHNpbmdsZVRlcm1pbmFsPzogYm9vbGVhbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGxldCBtZXNzYWdlOiBzdHJpbmc7XG5cdFx0Y29uc3QgZm9yZWdyb3VuZEluc3RhbmNlcyA9IHRoaXMuZm9yZWdyb3VuZEluc3RhbmNlcztcblx0XHRpZiAoZm9yZWdyb3VuZEluc3RhbmNlcy5sZW5ndGggPT09IDEgfHwgc2luZ2xlVGVybWluYWwpIHtcblx0XHRcdG1lc3NhZ2UgPSBubHMubG9jYWxpemUoJ3Rlcm1pbmFsU2VydmljZS50ZXJtaW5hbENsb3NlQ29uZmlybWF0aW9uU2luZ3VsYXInLCBcIkRvIHlvdSB3YW50IHRvIHRlcm1pbmF0ZSB0aGUgYWN0aXZlIHRlcm1pbmFsIHNlc3Npb24/XCIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCd0ZXJtaW5hbFNlcnZpY2UudGVybWluYWxDbG9zZUNvbmZpcm1hdGlvblBsdXJhbCcsIFwiRG8geW91IHdhbnQgdG8gdGVybWluYXRlIHRoZSB7MH0gYWN0aXZlIHRlcm1pbmFsIHNlc3Npb25zP1wiLCBmb3JlZ3JvdW5kSW5zdGFuY2VzLmxlbmd0aCk7XG5cdFx0fVxuXHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCB0aGlzLl9kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdHByaW1hcnlCdXR0b246IG5scy5sb2NhbGl6ZSh7IGtleTogJ3Rlcm1pbmF0ZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlRlcm1pbmF0ZVwiKVxuXHRcdH0pO1xuXHRcdHJldHVybiAhY29uZmlybWVkO1xuXHR9XG5cblx0Z2V0RGVmYXVsdEluc3RhbmNlSG9zdCgpOiBJVGVybWluYWxJbnN0YW5jZUhvc3Qge1xuXHRcdGlmICh0aGlzLmRlZmF1bHRMb2NhdGlvbiA9PT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdHJldHVybiB0aGlzLl90ZXJtaW5hbEVkaXRvclNlcnZpY2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZTtcblx0fVxuXG5cdGFzeW5jIGdldEluc3RhbmNlSG9zdChsb2NhdGlvbjogSVRlcm1pbmFsTG9jYXRpb25PcHRpb25zIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJVGVybWluYWxJbnN0YW5jZUhvc3Q+IHtcblx0XHRpZiAobG9jYXRpb24pIHtcblx0XHRcdGlmIChsb2NhdGlvbiA9PT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3Rlcm1pbmFsRWRpdG9yU2VydmljZTtcblx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIGxvY2F0aW9uID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRpZiAoJ3ZpZXdDb2x1bW4nIGluIGxvY2F0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX3Rlcm1pbmFsRWRpdG9yU2VydmljZTtcblx0XHRcdFx0fSBlbHNlIGlmICgncGFyZW50VGVybWluYWwnIGluIGxvY2F0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIChhd2FpdCBsb2NhdGlvbi5wYXJlbnRUZXJtaW5hbCkudGFyZ2V0ID09PSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvciA/IHRoaXMuX3Rlcm1pbmFsRWRpdG9yU2VydmljZSA6IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlVGVybWluYWwob3B0aW9ucz86IElDcmVhdGVUZXJtaW5hbE9wdGlvbnMpOiBQcm9taXNlPElUZXJtaW5hbEluc3RhbmNlPiB7XG5cdFx0Ly8gQXdhaXQgdGhlIGluaXRpYWxpemF0aW9uIG9mIGF2YWlsYWJsZSBwcm9maWxlcyBhcyBsb25nIGFzIHRoaXMgaXMgbm90IGEgcHR5IHRlcm1pbmFsIG9yIGFcblx0XHQvLyBsb2NhbCB0ZXJtaW5hbCBpbiBhIHJlbW90ZSB3b3Jrc3BhY2UgYXMgcHJvZmlsZSB3b24ndCBiZSB1c2VkIGluIHRob3NlIGNhc2VzIGFuZCB0aGVzZVxuXHRcdC8vIHRlcm1pbmFscyBuZWVkIHRvIGJlIGxhdW5jaGVkIGJlZm9yZSByZW1vdGUgY29ubmVjdGlvbnMgYXJlIGVzdGFibGlzaGVkLlxuXHRcdGlmICh0aGlzLl90ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmF2YWlsYWJsZVByb2ZpbGVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Y29uc3QgaXNQdHlUZXJtaW5hbCA9IG9wdGlvbnM/LmNvbmZpZyAmJiAnY3VzdG9tUHR5SW1wbGVtZW50YXRpb24nIGluIG9wdGlvbnMuY29uZmlnO1xuXHRcdFx0Y29uc3QgaXNMb2NhbEluUmVtb3RlVGVybWluYWwgPSB0aGlzLl9yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0Q29ubmVjdGlvbigpICYmIFVSSS5pc1VyaShvcHRpb25zPy5jd2QpICYmIG9wdGlvbnM/LmN3ZC5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlRmlsZVJlc291cmNlO1xuXHRcdFx0aWYgKCFpc1B0eVRlcm1pbmFsICYmICFpc0xvY2FsSW5SZW1vdGVUZXJtaW5hbCkge1xuXHRcdFx0XHRpZiAodGhpcy5fY29ubmVjdGlvblN0YXRlID09PSBUZXJtaW5hbENvbm5lY3Rpb25TdGF0ZS5Db25uZWN0aW5nKSB7XG5cdFx0XHRcdFx0bWFyayhgY29kZS90ZXJtaW5hbC93aWxsR2V0UHJvZmlsZXNgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhd2FpdCB0aGlzLl90ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLnByb2ZpbGVzUmVhZHk7XG5cdFx0XHRcdGlmICh0aGlzLl9jb25uZWN0aW9uU3RhdGUgPT09IFRlcm1pbmFsQ29ubmVjdGlvblN0YXRlLkNvbm5lY3RpbmcpIHtcblx0XHRcdFx0XHRtYXJrKGBjb2RlL3Rlcm1pbmFsL2RpZEdldFByb2ZpbGVzYCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjb25maWcgPSBvcHRpb25zPy5jb25maWcgfHwgdGhpcy5fdGVybWluYWxQcm9maWxlU2VydmljZS5nZXREZWZhdWx0UHJvZmlsZSgpO1xuXHRcdGNvbnN0IHNoZWxsTGF1bmNoQ29uZmlnID0gY29uZmlnICYmICdleHRlbnNpb25JZGVudGlmaWVyJyBpbiBjb25maWcgPyB7fSA6IHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmNvbnZlcnRQcm9maWxlVG9TaGVsbExhdW5jaENvbmZpZyhjb25maWcgfHwge30pO1xuXG5cdFx0Ly8gR2V0IHRoZSBjb250cmlidXRlZCBwcm9maWxlIGlmIGl0IHdhcyBwcm92aWRlZFxuXHRcdGNvbnN0IGNvbnRyaWJ1dGVkUHJvZmlsZSA9IG9wdGlvbnM/LnNraXBDb250cmlidXRlZFByb2ZpbGVDaGVjayA/IHVuZGVmaW5lZCA6IGF3YWl0IHRoaXMuX2dldENvbnRyaWJ1dGVkUHJvZmlsZShzaGVsbExhdW5jaENvbmZpZywgb3B0aW9ucyk7XG5cblx0XHRjb25zdCBzcGxpdEFjdGl2ZVRlcm1pbmFsID0gdHlwZW9mIG9wdGlvbnM/LmxvY2F0aW9uID09PSAnb2JqZWN0JyAmJiAnc3BsaXRBY3RpdmVUZXJtaW5hbCcgaW4gb3B0aW9ucy5sb2NhdGlvbiA/IG9wdGlvbnMubG9jYXRpb24uc3BsaXRBY3RpdmVUZXJtaW5hbCA6IHR5cGVvZiBvcHRpb25zPy5sb2NhdGlvbiA9PT0gJ29iamVjdCcgPyAncGFyZW50VGVybWluYWwnIGluIG9wdGlvbnMubG9jYXRpb24gOiBmYWxzZTtcblxuXHRcdGF3YWl0IHRoaXMuX3Jlc29sdmVDd2Qoc2hlbGxMYXVuY2hDb25maWcsIHNwbGl0QWN0aXZlVGVybWluYWwsIG9wdGlvbnMpO1xuXG5cdFx0Ly8gTGF1bmNoIHRoZSBjb250cmlidXRlZCBwcm9maWxlXG5cdFx0Ly8gSWYgaXQncyBhIGN1c3RvbSBwdHkgaW1wbGVtZW50YXRpb24sIHdlIGRpZCBub3QgYXdhaXQgdGhlIHByb2ZpbGVzIHJlYWR5LCBzb1xuXHRcdC8vIHdlIGNhbm5vdCBsYXVuY2ggdGhlIGNvbnRyaWJ1dGVkIHByb2ZpbGUgYW5kIGRvaW5nIHNvIHdvdWxkIGNhdXNlIGFuIGVycm9yXG5cdFx0aWYgKCFzaGVsbExhdW5jaENvbmZpZy5jdXN0b21QdHlJbXBsZW1lbnRhdGlvbiAmJiBjb250cmlidXRlZFByb2ZpbGUpIHtcblx0XHRcdGNvbnN0IHJlc29sdmVkTG9jYXRpb24gPSBhd2FpdCB0aGlzLnJlc29sdmVMb2NhdGlvbihvcHRpb25zPy5sb2NhdGlvbik7XG5cdFx0XHRsZXQgbG9jYXRpb246IFRlcm1pbmFsTG9jYXRpb24gfCB7IHZpZXdDb2x1bW46IG51bWJlcjsgcHJlc2VydmVTdGF0ZT86IGJvb2xlYW4gfSB8IHsgc3BsaXRBY3RpdmVUZXJtaW5hbDogYm9vbGVhbiB9IHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHNwbGl0QWN0aXZlVGVybWluYWwpIHtcblx0XHRcdFx0bG9jYXRpb24gPSByZXNvbHZlZExvY2F0aW9uID09PSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvciA/IHsgdmlld0NvbHVtbjogU0lERV9HUk9VUCB9IDogeyBzcGxpdEFjdGl2ZVRlcm1pbmFsOiB0cnVlIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsb2NhdGlvbiA9IHR5cGVvZiBvcHRpb25zPy5sb2NhdGlvbiA9PT0gJ29iamVjdCcgJiYgJ3ZpZXdDb2x1bW4nIGluIG9wdGlvbnMubG9jYXRpb24gPyBvcHRpb25zLmxvY2F0aW9uIDogcmVzb2x2ZWRMb2NhdGlvbjtcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMuY3JlYXRlQ29udHJpYnV0ZWRUZXJtaW5hbFByb2ZpbGUoY29udHJpYnV0ZWRQcm9maWxlLmV4dGVuc2lvbklkZW50aWZpZXIsIGNvbnRyaWJ1dGVkUHJvZmlsZS5pZCwge1xuXHRcdFx0XHRpY29uOiBjb250cmlidXRlZFByb2ZpbGUuaWNvbixcblx0XHRcdFx0Y29sb3I6IGNvbnRyaWJ1dGVkUHJvZmlsZS5jb2xvcixcblx0XHRcdFx0bG9jYXRpb24sXG5cdFx0XHRcdGN3ZDogc2hlbGxMYXVuY2hDb25maWcuY3dkLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBpbnN0YW5jZUhvc3QgPSByZXNvbHZlZExvY2F0aW9uID09PSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvciA/IHRoaXMuX3Rlcm1pbmFsRWRpdG9yU2VydmljZSA6IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlO1xuXHRcdFx0Y29uc3QgaW5zdGFuY2UgPSBpbnN0YW5jZUhvc3QuaW5zdGFuY2VzW2luc3RhbmNlSG9zdC5pbnN0YW5jZXMubGVuZ3RoIC0gMV07XG5cdFx0XHRhd2FpdCBpbnN0YW5jZT8uZm9jdXNXaGVuUmVhZHkoKTtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsSGFzQmVlbkNyZWF0ZWQuc2V0KHRydWUpO1xuXHRcdFx0cmV0dXJuIGluc3RhbmNlO1xuXHRcdH1cblxuXHRcdGlmICghc2hlbGxMYXVuY2hDb25maWcuY3VzdG9tUHR5SW1wbGVtZW50YXRpb24gJiYgIXRoaXMuaXNQcm9jZXNzU3VwcG9ydFJlZ2lzdGVyZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGNyZWF0ZSB0ZXJtaW5hbCB3aGVuIHByb2Nlc3Mgc3VwcG9ydCBpcyBub3QgcmVnaXN0ZXJlZCcpO1xuXHRcdH1cblx0XHRpZiAoc2hlbGxMYXVuY2hDb25maWcuaGlkZUZyb21Vc2VyKSB7XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKHNoZWxsTGF1bmNoQ29uZmlnLCBUZXJtaW5hbExvY2F0aW9uLlBhbmVsKTtcblx0XHRcdHRoaXMuX2JhY2tncm91bmRlZFRlcm1pbmFsSW5zdGFuY2VzLnB1c2goaW5zdGFuY2UpO1xuXHRcdFx0dGhpcy5fYmFja2dyb3VuZGVkVGVybWluYWxEaXNwb3NhYmxlcy5zZXQoaW5zdGFuY2UuaW5zdGFuY2VJZCwgW1xuXHRcdFx0XHRpbnN0YW5jZS5vbkRpc3Bvc2VkKHRoaXMuX29uRGlkRGlzcG9zZUluc3RhbmNlLmZpcmUsIHRoaXMuX29uRGlkRGlzcG9zZUluc3RhbmNlKVxuXHRcdFx0XSk7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbEhhc0JlZW5DcmVhdGVkLnNldCh0cnVlKTtcblx0XHRcdHJldHVybiBpbnN0YW5jZTtcblx0XHR9XG5cblx0XHR0aGlzLl9ldmFsdWF0ZUxvY2FsQ3dkKHNoZWxsTGF1bmNoQ29uZmlnKTtcblx0XHRjb25zdCBsb2NhdGlvbiA9IGF3YWl0IHRoaXMucmVzb2x2ZUxvY2F0aW9uKG9wdGlvbnM/LmxvY2F0aW9uKSB8fCB0aGlzLmRlZmF1bHRMb2NhdGlvbjtcblx0XHRjb25zdCBwYXJlbnQgPSBhd2FpdCB0aGlzLl9nZXRTcGxpdFBhcmVudChvcHRpb25zPy5sb2NhdGlvbik7XG5cdFx0dGhpcy5fdGVybWluYWxIYXNCZWVuQ3JlYXRlZC5zZXQodHJ1ZSk7XG5cdFx0aWYgKHBhcmVudCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3NwbGl0VGVybWluYWwoc2hlbGxMYXVuY2hDb25maWcsIGxvY2F0aW9uLCBwYXJlbnQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlVGVybWluYWwoc2hlbGxMYXVuY2hDb25maWcsIGxvY2F0aW9uLCBvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2dldENvbnRyaWJ1dGVkUHJvZmlsZShzaGVsbExhdW5jaENvbmZpZzogSVNoZWxsTGF1bmNoQ29uZmlnLCBvcHRpb25zPzogSUNyZWF0ZVRlcm1pbmFsT3B0aW9ucyk6IFByb21pc2U8SUV4dGVuc2lvblRlcm1pbmFsUHJvZmlsZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmIChvcHRpb25zPy5jb25maWcgJiYgJ2V4dGVuc2lvbklkZW50aWZpZXInIGluIG9wdGlvbnMuY29uZmlnKSB7XG5cdFx0XHRyZXR1cm4gb3B0aW9ucy5jb25maWc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UuZ2V0Q29udHJpYnV0ZWREZWZhdWx0UHJvZmlsZShzaGVsbExhdW5jaENvbmZpZyk7XG5cdH1cblxuXHRhc3luYyBjcmVhdGVEZXRhY2hlZFRlcm1pbmFsKG9wdGlvbnM6IElEZXRhY2hlZFhUZXJtT3B0aW9ucyk6IFByb21pc2U8SURldGFjaGVkVGVybWluYWxJbnN0YW5jZT4ge1xuXHRcdGNvbnN0IGN0b3IgPSBhd2FpdCBUZXJtaW5hbEluc3RhbmNlLmdldFh0ZXJtQ29uc3RydWN0b3IodGhpcy5fa2V5YmluZGluZ1NlcnZpY2UsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCB4dGVybSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFh0ZXJtVGVybWluYWwsIGN0b3IsIHtcblx0XHRcdGNvbHM6IG9wdGlvbnMuY29scyxcblx0XHRcdHJvd3M6IG9wdGlvbnMucm93cyxcblx0XHRcdHh0ZXJtQ29sb3JQcm92aWRlcjogb3B0aW9ucy5jb2xvclByb3ZpZGVyLFxuXHRcdFx0Y2FwYWJpbGl0aWVzOiBvcHRpb25zLmNhcGFiaWxpdGllcyB8fCBuZXcgVGVybWluYWxDYXBhYmlsaXR5U3RvcmUoKSxcblx0XHR9KTtcblxuXHRcdGlmIChvcHRpb25zLnJlYWRvbmx5KSB7XG5cdFx0XHR4dGVybS5yYXcuYXR0YWNoQ3VzdG9tS2V5RXZlbnRIYW5kbGVyKCgpID0+IGZhbHNlKTtcblx0XHR9XG5cblx0XHRjb25zdCBpbnN0YW5jZSA9IG5ldyBEZXRhY2hlZFRlcm1pbmFsKHh0ZXJtLCBvcHRpb25zLCB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0dGhpcy5fZGV0YWNoZWRYdGVybXMuYWRkKGluc3RhbmNlKTtcblx0XHRjb25zdCBsID0geHRlcm0ub25EaWREaXNwb3NlKCgpID0+IHtcblx0XHRcdHRoaXMuX2RldGFjaGVkWHRlcm1zLmRlbGV0ZShpbnN0YW5jZSk7XG5cdFx0XHRsLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBpbnN0YW5jZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVDd2Qoc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZywgc3BsaXRBY3RpdmVUZXJtaW5hbDogYm9vbGVhbiwgb3B0aW9ucz86IElDcmVhdGVUZXJtaW5hbE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjd2QgPSBzaGVsbExhdW5jaENvbmZpZy5jd2Q7XG5cdFx0aWYgKCFjd2QpIHtcblx0XHRcdGlmIChvcHRpb25zPy5jd2QpIHtcblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuY3dkID0gb3B0aW9ucy5jd2Q7XG5cdFx0XHR9IGVsc2UgaWYgKHNwbGl0QWN0aXZlVGVybWluYWwgJiYgb3B0aW9ucz8ubG9jYXRpb24pIHtcblx0XHRcdFx0bGV0IHBhcmVudCA9IHRoaXMuYWN0aXZlSW5zdGFuY2U7XG5cdFx0XHRcdGlmICh0eXBlb2Ygb3B0aW9ucy5sb2NhdGlvbiA9PT0gJ29iamVjdCcgJiYgJ3BhcmVudFRlcm1pbmFsJyBpbiBvcHRpb25zLmxvY2F0aW9uKSB7XG5cdFx0XHRcdFx0cGFyZW50ID0gYXdhaXQgb3B0aW9ucy5sb2NhdGlvbi5wYXJlbnRUZXJtaW5hbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXBhcmVudCkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHNwbGl0IHdpdGhvdXQgYW4gYWN0aXZlIGluc3RhbmNlJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuY3dkID0gYXdhaXQgZ2V0Q3dkRm9yU3BsaXQocGFyZW50LCB0aGlzLl93b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLCB0aGlzLl9jb21tYW5kU2VydmljZSwgdGhpcy5fdGVybWluYWxDb25maWdTZXJ2aWNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zcGxpdFRlcm1pbmFsKHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcsIGxvY2F0aW9uOiBUZXJtaW5hbExvY2F0aW9uLCBwYXJlbnQ6IElUZXJtaW5hbEluc3RhbmNlKTogSVRlcm1pbmFsSW5zdGFuY2Uge1xuXHRcdGxldCBpbnN0YW5jZTtcblx0XHQvLyBVc2UgdGhlIFVSSSBmcm9tIHRoZSBiYXNlIGluc3RhbmNlIGlmIGl0IGV4aXN0cywgdGhpcyB3aWxsIGNvcnJlY3RseSBzcGxpdCBsb2NhbCB0ZXJtaW5hbHNcblx0XHRpZiAodHlwZW9mIHNoZWxsTGF1bmNoQ29uZmlnLmN3ZCAhPT0gJ29iamVjdCcgJiYgdHlwZW9mIHBhcmVudC5zaGVsbExhdW5jaENvbmZpZy5jd2QgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRzaGVsbExhdW5jaENvbmZpZy5jd2QgPSBVUkkuZnJvbSh7XG5cdFx0XHRcdHNjaGVtZTogcGFyZW50LnNoZWxsTGF1bmNoQ29uZmlnLmN3ZC5zY2hlbWUsXG5cdFx0XHRcdGF1dGhvcml0eTogcGFyZW50LnNoZWxsTGF1bmNoQ29uZmlnLmN3ZC5hdXRob3JpdHksXG5cdFx0XHRcdHBhdGg6IHNoZWxsTGF1bmNoQ29uZmlnLmN3ZCB8fCBwYXJlbnQuc2hlbGxMYXVuY2hDb25maWcuY3dkLnBhdGhcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRpZiAobG9jYXRpb24gPT09IFRlcm1pbmFsTG9jYXRpb24uRWRpdG9yIHx8IHBhcmVudC50YXJnZXQgPT09IFRlcm1pbmFsTG9jYXRpb24uRWRpdG9yKSB7XG5cdFx0XHRpbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsRWRpdG9yU2VydmljZS5zcGxpdEluc3RhbmNlKHBhcmVudCwgc2hlbGxMYXVuY2hDb25maWcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmdldEdyb3VwRm9ySW5zdGFuY2UocGFyZW50KTtcblx0XHRcdGlmICghZ3JvdXApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3Qgc3BsaXQgYSB0ZXJtaW5hbCB3aXRob3V0IGEgZ3JvdXAgKGluc3RhbmNlSWQ6ICR7cGFyZW50Lmluc3RhbmNlSWR9LCB0aXRsZTogJHtwYXJlbnQudGl0bGV9KWApO1xuXHRcdFx0fVxuXHRcdFx0c2hlbGxMYXVuY2hDb25maWcucGFyZW50VGVybWluYWxJZCA9IHBhcmVudC5pbnN0YW5jZUlkO1xuXHRcdFx0aW5zdGFuY2UgPSBncm91cC5zcGxpdChzaGVsbExhdW5jaENvbmZpZyk7XG5cdFx0fVxuXHRcdHRoaXMuX2FkZFRvUmVjb25uZWN0ZWQoaW5zdGFuY2UpO1xuXHRcdHJldHVybiBpbnN0YW5jZTtcblx0fVxuXG5cdHByaXZhdGUgX2FkZFRvUmVjb25uZWN0ZWQoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogdm9pZCB7XG5cdFx0aWYgKCFpbnN0YW5jZS5yZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzPy5vd25lcklkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHJlY29ubmVjdGVkVGVybWluYWxzID0gdGhpcy5fcmVjb25uZWN0ZWRUZXJtaW5hbHMuZ2V0KGluc3RhbmNlLnJlY29ubmVjdGlvblByb3BlcnRpZXMub3duZXJJZCk7XG5cdFx0aWYgKHJlY29ubmVjdGVkVGVybWluYWxzKSB7XG5cdFx0XHRyZWNvbm5lY3RlZFRlcm1pbmFscy5wdXNoKGluc3RhbmNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVjb25uZWN0ZWRUZXJtaW5hbHMuc2V0KGluc3RhbmNlLnJlY29ubmVjdGlvblByb3BlcnRpZXMub3duZXJJZCwgW2luc3RhbmNlXSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlVGVybWluYWwoc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZywgbG9jYXRpb246IFRlcm1pbmFsTG9jYXRpb24sIG9wdGlvbnM/OiBJQ3JlYXRlVGVybWluYWxPcHRpb25zKTogSVRlcm1pbmFsSW5zdGFuY2Uge1xuXHRcdGxldCBpbnN0YW5jZTtcblx0XHRjb25zdCBlZGl0b3JPcHRpb25zID0gdGhpcy5fZ2V0RWRpdG9yT3B0aW9ucyhvcHRpb25zPy5sb2NhdGlvbik7XG5cdFx0aWYgKGxvY2F0aW9uID09PSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvcikge1xuXHRcdFx0aW5zdGFuY2UgPSB0aGlzLl90ZXJtaW5hbEluc3RhbmNlU2VydmljZS5jcmVhdGVJbnN0YW5jZShzaGVsbExhdW5jaENvbmZpZywgVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpO1xuXHRcdFx0dGhpcy5fdGVybWluYWxFZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoaW5zdGFuY2UsIGVkaXRvck9wdGlvbnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBUT0RPOiBwYXNzIHJlc291cmNlP1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5jcmVhdGVHcm91cChzaGVsbExhdW5jaENvbmZpZyk7XG5cdFx0XHRpbnN0YW5jZSA9IGdyb3VwLnRlcm1pbmFsSW5zdGFuY2VzWzBdO1xuXHRcdH1cblx0XHR0aGlzLl9hZGRUb1JlY29ubmVjdGVkKGluc3RhbmNlKTtcblx0XHRyZXR1cm4gaW5zdGFuY2U7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlTG9jYXRpb24obG9jYXRpb24/OiBJVGVybWluYWxMb2NhdGlvbk9wdGlvbnMpOiBQcm9taXNlPFRlcm1pbmFsTG9jYXRpb24gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAobG9jYXRpb24gJiYgdHlwZW9mIGxvY2F0aW9uID09PSAnb2JqZWN0Jykge1xuXHRcdFx0aWYgKCdwYXJlbnRUZXJtaW5hbCcgaW4gbG9jYXRpb24pIHtcblx0XHRcdFx0Ly8gc2luY2Ugd2UgZG9uJ3Qgc2V0IHRoZSB0YXJnZXQgdW5sZXNzIGl0J3MgYW4gZWRpdG9yIHRlcm1pbmFsLCB0aGlzIGlzIG5lY2Vzc2FyeVxuXHRcdFx0XHRjb25zdCBwYXJlbnRUZXJtaW5hbCA9IGF3YWl0IGxvY2F0aW9uLnBhcmVudFRlcm1pbmFsO1xuXHRcdFx0XHRyZXR1cm4gIXBhcmVudFRlcm1pbmFsLnRhcmdldCA/IFRlcm1pbmFsTG9jYXRpb24uUGFuZWwgOiBwYXJlbnRUZXJtaW5hbC50YXJnZXQ7XG5cdFx0XHR9IGVsc2UgaWYgKCd2aWV3Q29sdW1uJyBpbiBsb2NhdGlvbikge1xuXHRcdFx0XHRyZXR1cm4gVGVybWluYWxMb2NhdGlvbi5FZGl0b3I7XG5cdFx0XHR9IGVsc2UgaWYgKCdzcGxpdEFjdGl2ZVRlcm1pbmFsJyBpbiBsb2NhdGlvbikge1xuXHRcdFx0XHQvLyBzaW5jZSB3ZSBkb24ndCBzZXQgdGhlIHRhcmdldCB1bmxlc3MgaXQncyBhbiBlZGl0b3IgdGVybWluYWwsIHRoaXMgaXMgbmVjZXNzYXJ5XG5cdFx0XHRcdHJldHVybiAhdGhpcy5fYWN0aXZlSW5zdGFuY2U/LnRhcmdldCA/IFRlcm1pbmFsTG9jYXRpb24uUGFuZWwgOiB0aGlzLl9hY3RpdmVJbnN0YW5jZT8udGFyZ2V0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbG9jYXRpb247XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRTcGxpdFBhcmVudChsb2NhdGlvbj86IElUZXJtaW5hbExvY2F0aW9uT3B0aW9ucyk6IFByb21pc2U8SVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAobG9jYXRpb24gJiYgdHlwZW9mIGxvY2F0aW9uID09PSAnb2JqZWN0JyAmJiAncGFyZW50VGVybWluYWwnIGluIGxvY2F0aW9uKSB7XG5cdFx0XHRyZXR1cm4gbG9jYXRpb24ucGFyZW50VGVybWluYWw7XG5cdFx0fSBlbHNlIGlmIChsb2NhdGlvbiAmJiB0eXBlb2YgbG9jYXRpb24gPT09ICdvYmplY3QnICYmICdzcGxpdEFjdGl2ZVRlcm1pbmFsJyBpbiBsb2NhdGlvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMuYWN0aXZlSW5zdGFuY2U7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRFZGl0b3JPcHRpb25zKGxvY2F0aW9uPzogSVRlcm1pbmFsTG9jYXRpb25PcHRpb25zKTogVGVybWluYWxFZGl0b3JMb2NhdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGxvY2F0aW9uICYmIHR5cGVvZiBsb2NhdGlvbiA9PT0gJ29iamVjdCcgJiYgJ3ZpZXdDb2x1bW4nIGluIGxvY2F0aW9uKSB7XG5cdFx0XHRsb2NhdGlvbi52aWV3Q29sdW1uID0gY29sdW1uVG9FZGl0b3JHcm91cCh0aGlzLl9lZGl0b3JHcm91cHNTZXJ2aWNlLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSwgbG9jYXRpb24udmlld0NvbHVtbik7XG5cdFx0XHRyZXR1cm4gbG9jYXRpb247XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9ldmFsdWF0ZUxvY2FsQ3dkKHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcpIHtcblx0XHQvLyBBZGQgd2VsY29tZSBtZXNzYWdlIGFuZCB0aXRsZSBhbm5vdGF0aW9uIGZvciBsb2NhbCB0ZXJtaW5hbHMgbGF1bmNoZWQgd2l0aGluIHJlbW90ZSBvclxuXHRcdC8vIHZpcnR1YWwgd29ya3NwYWNlc1xuXHRcdGlmICh0eXBlb2Ygc2hlbGxMYXVuY2hDb25maWcuY3dkICE9PSAnc3RyaW5nJyAmJiBzaGVsbExhdW5jaENvbmZpZy5jd2Q/LnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRpZiAoVmlydHVhbFdvcmtzcGFjZUNvbnRleHQuZ2V0VmFsdWUodGhpcy5fY29udGV4dEtleVNlcnZpY2UpKSB7XG5cdFx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnLmluaXRpYWxUZXh0ID0gZm9ybWF0TWVzc2FnZUZvclRlcm1pbmFsKG5scy5sb2NhbGl6ZSgnbG9jYWxUZXJtaW5hbFZpcnR1YWxXb3Jrc3BhY2UnLCBcIlRoaXMgc2hlbGwgaXMgb3BlbiB0byBhIHswfWxvY2FsezF9IGZvbGRlciwgTk9UIHRvIHRoZSB2aXJ0dWFsIGZvbGRlclwiLCAnXFx4MWJbM20nLCAnXFx4MWJbMjNtJyksIHsgZXhjbHVkZUxlYWRpbmdOZXdMaW5lOiB0cnVlLCBsb3VkRm9ybWF0dGluZzogdHJ1ZSB9KTtcblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcudHlwZSA9ICdMb2NhbCc7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCkpIHtcblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuaW5pdGlhbFRleHQgPSBmb3JtYXRNZXNzYWdlRm9yVGVybWluYWwobmxzLmxvY2FsaXplKCdsb2NhbFRlcm1pbmFsUmVtb3RlJywgXCJUaGlzIHNoZWxsIGlzIHJ1bm5pbmcgb24geW91ciB7MH1sb2NhbHsxfSBtYWNoaW5lLCBOT1Qgb24gdGhlIGNvbm5lY3RlZCByZW1vdGUgbWFjaGluZVwiLCAnXFx4MWJbM20nLCAnXFx4MWJbMjNtJyksIHsgZXhjbHVkZUxlYWRpbmdOZXdMaW5lOiB0cnVlLCBsb3VkRm9ybWF0dGluZzogdHJ1ZSB9KTtcblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcudHlwZSA9ICdMb2NhbCc7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIF9zaG93QmFja2dyb3VuZFRlcm1pbmFsKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IHZvaWQge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fYmFja2dyb3VuZGVkVGVybWluYWxJbnN0YW5jZXMuaW5kZXhPZihpbnN0YW5jZSk7XG5cdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9iYWNrZ3JvdW5kZWRUZXJtaW5hbEluc3RhbmNlcy5zcGxpY2UodGhpcy5fYmFja2dyb3VuZGVkVGVybWluYWxJbnN0YW5jZXMuaW5kZXhPZihpbnN0YW5jZSksIDEpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gdGhpcy5fYmFja2dyb3VuZGVkVGVybWluYWxEaXNwb3NhYmxlcy5nZXQoaW5zdGFuY2UuaW5zdGFuY2VJZCk7XG5cdFx0aWYgKGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGVzKTtcblx0XHR9XG5cdFx0dGhpcy5fYmFja2dyb3VuZGVkVGVybWluYWxEaXNwb3NhYmxlcy5kZWxldGUoaW5zdGFuY2UuaW5zdGFuY2VJZCk7XG5cdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuY3JlYXRlR3JvdXAoaW5zdGFuY2UpO1xuXG5cdFx0Ly8gTWFrZSBhY3RpdmUgYXV0b21hdGljYWxseSBpZiBpdCdzIHRoZSBmaXJzdCBpbnN0YW5jZVxuXHRcdGlmICh0aGlzLmluc3RhbmNlcy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlQnlJbmRleCgwKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZUluc3RhbmNlcy5maXJlKCk7XG5cdH1cblxuXHRhc3luYyBzZXRDb250YWluZXJzKHBhbmVsQ29udGFpbmVyOiBIVE1MRWxlbWVudCwgdGVybWluYWxDb250YWluZXI6IEhUTUxFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5zZXRQYW5lbENvbnRhaW5lcihwYW5lbENvbnRhaW5lcik7XG5cdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2Uuc2V0Q29udGFpbmVyKHRlcm1pbmFsQ29udGFpbmVyKTtcblx0fVxuXG5cdGdldEVkaXRpbmdUZXJtaW5hbCgpOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRpbmdUZXJtaW5hbDtcblx0fVxuXG5cdHNldEVkaXRpbmdUZXJtaW5hbChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9lZGl0aW5nVGVybWluYWwgPSBpbnN0YW5jZTtcblx0fVxuXG5cdGNyZWF0ZU9uSW5zdGFuY2VFdmVudDxUPihnZXRFdmVudDogKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSkgPT4gRXZlbnQ8VD4pOiBEeW5hbWljTGlzdEV2ZW50TXVsdGlwbGV4ZXI8SVRlcm1pbmFsSW5zdGFuY2UsIFQ+IHtcblx0XHRyZXR1cm4gbmV3IER5bmFtaWNMaXN0RXZlbnRNdWx0aXBsZXhlcih0aGlzLmluc3RhbmNlcywgdGhpcy5vbkRpZENyZWF0ZUluc3RhbmNlLCB0aGlzLm9uRGlkRGlzcG9zZUluc3RhbmNlLCBnZXRFdmVudCk7XG5cdH1cblxuXHRjcmVhdGVPbkluc3RhbmNlQ2FwYWJpbGl0eUV2ZW50PFQgZXh0ZW5kcyBUZXJtaW5hbENhcGFiaWxpdHksIEs+KGNhcGFiaWxpdHlJZDogVCwgZ2V0RXZlbnQ6IChjYXBhYmlsaXR5OiBJVGVybWluYWxDYXBhYmlsaXR5SW1wbE1hcFtUXSkgPT4gRXZlbnQ8Sz4pOiBJRHluYW1pY0xpc3RFdmVudE11bHRpcGxleGVyPHsgaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlOyBkYXRhOiBLIH0+IHtcblx0XHRyZXR1cm4gY3JlYXRlSW5zdGFuY2VDYXBhYmlsaXR5RXZlbnRNdWx0aXBsZXhlcih0aGlzLmluc3RhbmNlcywgdGhpcy5vbkRpZENyZWF0ZUluc3RhbmNlLCB0aGlzLm9uRGlkRGlzcG9zZUluc3RhbmNlLCBjYXBhYmlsaXR5SWQsIGdldEV2ZW50KTtcblx0fVxufVxuXG5jbGFzcyBUZXJtaW5hbEVkaXRvclN0eWxlIGV4dGVuZHMgVGhlbWFibGUge1xuXHRwcml2YXRlIF9zdHlsZUVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0QElUZXJtaW5hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxTZXJ2aWNlOiBJVGVybWluYWxTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxQcm9maWxlU2VydmljZTogSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKF90aGVtZVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50ID0gZG9tU3R5bGVzaGVldHMuY3JlYXRlU3R5bGVTaGVldChjb250YWluZXIpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9zdHlsZUVsZW1lbnQucmVtb3ZlKCkpKTtcblx0XHR0aGlzLnVwZGF0ZVN0eWxlcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWxTZXJ2aWNlLm9uQW55SW5zdGFuY2VJY29uQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlU3R5bGVzKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbFNlcnZpY2Uub25EaWRDcmVhdGVJbnN0YW5jZSgoKSA9PiB0aGlzLnVwZGF0ZVN0eWxlcygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IgaW5zdGFuY2VvZiBUZXJtaW5hbEVkaXRvcklucHV0KSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3R5bGVzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvclNlcnZpY2Uub25EaWRDbG9zZUVkaXRvcigoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IgaW5zdGFuY2VvZiBUZXJtaW5hbEVkaXRvcklucHV0KSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3R5bGVzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VBdmFpbGFibGVQcm9maWxlcygoKSA9PiB0aGlzLnVwZGF0ZVN0eWxlcygpKSk7XG5cdH1cblxuXHRvdmVycmlkZSB1cGRhdGVTdHlsZXMoKTogdm9pZCB7XG5cdFx0c3VwZXIudXBkYXRlU3R5bGVzKCk7XG5cdFx0Y29uc3QgY29sb3JUaGVtZSA9IHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cblx0XHQvLyBUT0RPOiBhZGQgYSBydWxlIGNvbGxlY3RvciB0byBhdm9pZCBkdXBsaWNhdGlvblxuXHRcdGxldCBjc3MgPSAnJztcblxuXHRcdGNvbnN0IHByb2R1Y3RJY29uVGhlbWUgPSB0aGlzLl90aGVtZVNlcnZpY2UuZ2V0UHJvZHVjdEljb25UaGVtZSgpO1xuXG5cdFx0Ly8gQWRkIGljb25zXG5cdFx0Zm9yIChjb25zdCBpbnN0YW5jZSBvZiB0aGlzLl90ZXJtaW5hbFNlcnZpY2UuaW5zdGFuY2VzKSB7XG5cdFx0XHRjb25zdCBpY29uID0gaW5zdGFuY2UuaWNvbjtcblx0XHRcdGlmICghaWNvbikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGxldCB1cmkgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoaWNvbiBpbnN0YW5jZW9mIFVSSSkge1xuXHRcdFx0XHR1cmkgPSBpY29uO1xuXHRcdFx0fSBlbHNlIGlmIChpY29uIGluc3RhbmNlb2YgT2JqZWN0ICYmICdsaWdodCcgaW4gaWNvbiAmJiAnZGFyaycgaW4gaWNvbikge1xuXHRcdFx0XHR1cmkgPSBjb2xvclRoZW1lLnR5cGUgPT09IENvbG9yU2NoZW1lLkxJR0hUID8gaWNvbi5saWdodCA6IGljb24uZGFyaztcblx0XHRcdH1cblx0XHRcdGNvbnN0IGljb25DbGFzc2VzID0gZ2V0VXJpQ2xhc3NlcyhpbnN0YW5jZSwgY29sb3JUaGVtZS50eXBlKTtcblx0XHRcdGlmICh1cmkgaW5zdGFuY2VvZiBVUkkgJiYgaWNvbkNsYXNzZXMgJiYgaWNvbkNsYXNzZXMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRjc3MgKz0gKFxuXHRcdFx0XHRcdGNzc1ZhbHVlLmlubGluZWAubW9uYWNvLXdvcmtiZW5jaCAudGVybWluYWwtdGFiLiR7Y3NzVmFsdWUuY2xhc3NOYW1lKGljb25DbGFzc2VzWzBdKX06OmJlZm9yZVxuXHRcdFx0XHRcdHtjb250ZW50OiAnJzsgYmFja2dyb3VuZC1pbWFnZTogJHtjc3NWYWx1ZS5hc0NTU1VybCh1cmkpfTt9YFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihpY29uKSkge1xuXHRcdFx0XHRjb25zdCBpY29uUmVnaXN0cnkgPSBnZXRJY29uUmVnaXN0cnkoKTtcblx0XHRcdFx0Y29uc3QgaWNvbkNvbnRyaWJ1dGlvbiA9IGljb25SZWdpc3RyeS5nZXRJY29uKGljb24uaWQpO1xuXHRcdFx0XHRpZiAoaWNvbkNvbnRyaWJ1dGlvbikge1xuXHRcdFx0XHRcdGNvbnN0IGRlZiA9IHByb2R1Y3RJY29uVGhlbWUuZ2V0SWNvbihpY29uQ29udHJpYnV0aW9uKTtcblx0XHRcdFx0XHRpZiAoZGVmKSB7XG5cdFx0XHRcdFx0XHRjc3MgKz0gY3NzVmFsdWUuaW5saW5lYC5tb25hY28td29ya2JlbmNoIC50ZXJtaW5hbC10YWIuY29kaWNvbi0ke2Nzc1ZhbHVlLmNsYXNzTmFtZShpY29uLmlkKX06OmJlZm9yZVxuXHRcdFx0XHRcdFx0XHR7Y29udGVudDogJHtjc3NWYWx1ZS5zdHJpbmdWYWx1ZShkZWYuZm9udENoYXJhY3Rlcil9ICFpbXBvcnRhbnQ7IGZvbnQtZmFtaWx5OiAke2Nzc1ZhbHVlLnN0cmluZ1ZhbHVlKGRlZi5mb250Py5pZCA/PyAnY29kaWNvbicpfSAhaW1wb3J0YW50O31gO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFkZCBjb2xvcnNcblx0XHRjb25zdCBpY29uRm9yZWdyb3VuZENvbG9yID0gY29sb3JUaGVtZS5nZXRDb2xvcihpY29uRm9yZWdyb3VuZCk7XG5cdFx0aWYgKGljb25Gb3JlZ3JvdW5kQ29sb3IpIHtcblx0XHRcdGNzcyArPSBjc3NWYWx1ZS5pbmxpbmVgLm1vbmFjby13b3JrYmVuY2ggLnNob3ctZmlsZS1pY29ucyAuZmlsZS1pY29uLnRlcm1pbmFsLXRhYjo6YmVmb3JlIHsgY29sb3I6ICR7aWNvbkZvcmVncm91bmRDb2xvcn07IH1gO1xuXHRcdH1cblxuXHRcdGNzcyArPSBnZXRDb2xvclN0eWxlQ29udGVudChjb2xvclRoZW1lLCB0cnVlKTtcblx0XHR0aGlzLl9zdHlsZUVsZW1lbnQudGV4dENvbnRlbnQgPSBjc3M7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxvQkFBb0I7QUFDaEMsWUFBWSxjQUFjO0FBQzFCLFNBQVMsaUJBQWlCLGVBQWU7QUFDekMsU0FBUyxVQUFVLGVBQWU7QUFDbEMsU0FBUyw2QkFBNkIsU0FBUyxhQUEyQztBQUMxRixTQUFTLFlBQVksaUJBQWlCLFNBQXNCLG9CQUFvQjtBQUNoRixTQUFTLGVBQWU7QUFDeEIsU0FBUyxhQUFhLGFBQWE7QUFDbkMsU0FBUyxXQUFXO0FBRXBCLFlBQVksU0FBUztBQUNyQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBMk4scUJBQXFFLG9CQUFvQixrQkFBa0Isd0JBQXdCLHdCQUF3QjtBQUN0WCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGVBQWUsZ0JBQWdCO0FBQ3hDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0JBQStCO0FBRXhDLFNBQVMscUJBQXFCO0FBQzlCLFNBQW9ILCtCQUErQix3QkFBd0MsdUJBQWlFLDBCQUFvRCxrQkFBa0QsK0JBQXVEO0FBQ3paLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCO0FB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
