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
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { Action } from "../../../../base/common/actions.js";
import { distinct } from "../../../../base/common/arrays.js";
import { RunOnceScheduler, raceTimeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { isErrorWithActions } from "../../../../base/common/errorMessage.js";
import * as errors from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { deepClone, equals } from "../../../../base/common/objects.js";
import severity from "../../../../base/common/severity.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import * as nls from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IExtensionHostDebugService } from "../../../../platform/debug/common/extensionHostDebug.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { FileChangeType, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { EditorsOrder } from "../../../common/editor.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IActivityService, NumberBadge } from "../../../services/activity/common/activity.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { VIEWLET_ID as EXPLORER_VIEWLET_ID } from "../../files/common/files.js";
import { ITestService } from "../../testing/common/testService.js";
import { CALLSTACK_VIEW_ID, CONTEXT_BREAKPOINTS_EXIST, CONTEXT_DEBUG_STATE, CONTEXT_DEBUG_TYPE, CONTEXT_DEBUG_UX, CONTEXT_DISASSEMBLY_VIEW_FOCUS, CONTEXT_HAS_DEBUGGED, CONTEXT_IN_DEBUG_MODE, DEBUG_MEMORY_SCHEME, DEBUG_SCHEME, REPL_VIEW_ID, State, VIEWLET_ID, debuggerDisabledMessage, getStateLabel } from "../common/debug.js";
import { DebugCompoundRoot } from "../common/debugCompoundRoot.js";
import { Breakpoint, DataBreakpoint, DebugModel, FunctionBreakpoint, InstructionBreakpoint } from "../common/debugModel.js";
import { Source } from "../common/debugSource.js";
import { DebugStorage } from "../common/debugStorage.js";
import { DebugTelemetry } from "../common/debugTelemetry.js";
import { getExtensionHostDebugSession, saveAllBeforeDebugStart } from "../common/debugUtils.js";
import { ViewModel } from "../common/debugViewModel.js";
import { DisassemblyViewInput } from "../common/disassemblyViewInput.js";
import { AdapterManager } from "./debugAdapterManager.js";
import { DEBUG_CONFIGURE_COMMAND_ID, DEBUG_CONFIGURE_LABEL } from "./debugCommands.js";
import { ConfigurationManager } from "./debugConfigurationManager.js";
import { DebugMemoryFileSystemProvider } from "./debugMemory.js";
import { DebugSession } from "./debugSession.js";
import { DebugTaskRunner, TaskRunResult } from "./debugTaskRunner.js";
let DebugService = class {
  constructor(editorService, paneCompositeService, viewsService, viewDescriptorService, notificationService, dialogService, layoutService, contextService, contextKeyService, lifecycleService, instantiationService, extensionService, fileService, configurationService, extensionHostDebugService, activityService, commandService, quickInputService, workspaceTrustRequestService, uriIdentityService, testService) {
    this.editorService = editorService;
    this.paneCompositeService = paneCompositeService;
    this.viewsService = viewsService;
    this.viewDescriptorService = viewDescriptorService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.layoutService = layoutService;
    this.contextService = contextService;
    this.contextKeyService = contextKeyService;
    this.lifecycleService = lifecycleService;
    this.instantiationService = instantiationService;
    this.extensionService = extensionService;
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.extensionHostDebugService = extensionHostDebugService;
    this.activityService = activityService;
    this.commandService = commandService;
    this.quickInputService = quickInputService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.uriIdentityService = uriIdentityService;
    this.testService = testService;
    this.restartingSessions = /* @__PURE__ */ new Set();
    this.disposables = new DisposableStore();
    this.initializing = false;
    this.sessionCancellationTokens = /* @__PURE__ */ new Map();
    this.haveDoneLazySetup = false;
    this.breakpointsToSendOnResourceSaved = /* @__PURE__ */ new Set();
    this._onDidChangeState = new Emitter();
    this._onDidNewSession = new Emitter();
    this._onWillNewSession = new Emitter();
    this._onDidEndSession = new Emitter();
    this.adapterManager = this.instantiationService.createInstance(AdapterManager, {
      onDidNewSession: this.onDidNewSession,
      configurationManager: () => this.configurationManager
    });
    this.disposables.add(this.adapterManager);
    this.configurationManager = this.instantiationService.createInstance(ConfigurationManager, this.adapterManager);
    this.disposables.add(this.configurationManager);
    this.debugStorage = this.disposables.add(this.instantiationService.createInstance(DebugStorage));
    this.chosenEnvironments = this.debugStorage.loadChosenEnvironments();
    this.model = this.instantiationService.createInstance(DebugModel, this.debugStorage);
    this.telemetry = this.instantiationService.createInstance(DebugTelemetry, this.model);
    this.viewModel = new ViewModel(contextKeyService);
    this.taskRunner = this.instantiationService.createInstance(DebugTaskRunner);
    this.disposables.add(this.fileService.onDidFilesChange((e) => this.onFileChanges(e)));
    this.disposables.add(this.lifecycleService.onWillShutdown(this.dispose, this));
    this.disposables.add(this.extensionHostDebugService.onAttachSession((event) => {
      const session = this.model.getSession(event.sessionId, true);
      if (session) {
        session.configuration.request = "attach";
        session.configuration.port = event.port;
        session.setSubId(event.subId);
        this.launchOrAttachToSession(session);
      }
    }));
    this.disposables.add(this.extensionHostDebugService.onTerminateSession((event) => {
      const session = this.model.getSession(event.sessionId);
      if (session && session.subId === event.subId) {
        session.disconnect();
      }
    }));
    this.disposables.add(this.viewModel.onDidFocusStackFrame(() => {
      this.onStateChange();
    }));
    this.disposables.add(this.viewModel.onDidFocusSession((session) => {
      this.onStateChange();
      if (session) {
        this.setExceptionBreakpointFallbackSession(session.getId());
      }
    }));
    this.disposables.add(Event.any(this.adapterManager.onDidRegisterDebugger, this.configurationManager.onDidSelectConfiguration)(() => {
      const debugUxValue = this.state !== State.Inactive || this.configurationManager.getAllConfigurations().length > 0 && this.adapterManager.hasEnabledDebuggers() ? "default" : "simple";
      this.debugUx.set(debugUxValue);
      this.debugStorage.storeDebugUxState(debugUxValue);
    }));
    this.disposables.add(this.model.onDidChangeCallStack(() => {
      const numberOfSessions = this.model.getSessions().filter((s) => !s.parentSession).length;
      this.activity?.dispose();
      if (numberOfSessions > 0) {
        const viewContainer = this.viewDescriptorService.getViewContainerByViewId(CALLSTACK_VIEW_ID);
        if (viewContainer) {
          this.activity = this.activityService.showViewContainerActivity(viewContainer.id, { badge: new NumberBadge(numberOfSessions, (n) => n === 1 ? nls.localize("1activeSession", "1 active session") : nls.localize("nActiveSessions", "{0} active sessions", n)) });
        }
      }
    }));
    this.disposables.add(editorService.onDidActiveEditorChange(() => {
      this.contextKeyService.bufferChangeEvents(() => {
        if (editorService.activeEditor === DisassemblyViewInput.instance) {
          this.disassemblyViewFocus.set(true);
        } else {
          this.disassemblyViewFocus?.reset();
        }
      });
    }));
    this.disposables.add(this.lifecycleService.onBeforeShutdown(() => {
      for (const editor of editorService.editors) {
        if (editor.resource?.scheme === DEBUG_MEMORY_SCHEME) {
          editor.dispose();
        }
      }
    }));
    this.disposables.add(extensionService.onWillStop((evt) => {
      evt.veto(
        this.model.getSessions().length > 0,
        nls.localize("active debug session", "A debug session is still running that would terminate.")
      );
    }));
    this.initContextKeys(contextKeyService);
  }
  initContextKeys(contextKeyService) {
    queueMicrotask(() => {
      contextKeyService.bufferChangeEvents(() => {
        this.debugType = CONTEXT_DEBUG_TYPE.bindTo(contextKeyService);
        this.debugState = CONTEXT_DEBUG_STATE.bindTo(contextKeyService);
        this.hasDebugged = CONTEXT_HAS_DEBUGGED.bindTo(contextKeyService);
        this.inDebugMode = CONTEXT_IN_DEBUG_MODE.bindTo(contextKeyService);
        this.debugUx = CONTEXT_DEBUG_UX.bindTo(contextKeyService);
        this.debugUx.set(this.debugStorage.loadDebugUxState());
        this.breakpointsExist = CONTEXT_BREAKPOINTS_EXIST.bindTo(contextKeyService);
        this.disassemblyViewFocus = CONTEXT_DISASSEMBLY_VIEW_FOCUS.bindTo(contextKeyService);
      });
      const setBreakpointsExistContext = () => this.breakpointsExist.set(!!(this.model.getBreakpoints().length || this.model.getDataBreakpoints().length || this.model.getFunctionBreakpoints().length));
      setBreakpointsExistContext();
      this.disposables.add(this.model.onDidChangeBreakpoints(() => setBreakpointsExistContext()));
    });
  }
  getModel() {
    return this.model;
  }
  getViewModel() {
    return this.viewModel;
  }
  getConfigurationManager() {
    return this.configurationManager;
  }
  getAdapterManager() {
    return this.adapterManager;
  }
  sourceIsNotAvailable(uri2) {
    this.model.sourceIsNotAvailable(uri2);
  }
  dispose() {
    this.disposables.dispose();
  }
  //---- state management
  get state() {
    const focusedSession = this.viewModel.focusedSession;
    if (focusedSession) {
      return focusedSession.state;
    }
    return this.initializing ? State.Initializing : State.Inactive;
  }
  get initializingOptions() {
    return this._initializingOptions;
  }
  startInitializingState(options) {
    if (!this.initializing) {
      this.initializing = true;
      this._initializingOptions = options;
      this.onStateChange();
    }
  }
  endInitializingState() {
    if (this.initializing) {
      this.initializing = false;
      this._initializingOptions = void 0;
      this.onStateChange();
    }
  }
  cancelTokens(id) {
    if (id) {
      const token = this.sessionCancellationTokens.get(id);
      if (token) {
        token.cancel();
        this.sessionCancellationTokens.delete(id);
      }
    } else {
      this.sessionCancellationTokens.forEach((t) => t.cancel());
      this.sessionCancellationTokens.clear();
    }
  }
  onStateChange() {
    const state = this.state;
    if (this.previousState !== state) {
      this.contextKeyService.bufferChangeEvents(() => {
        this.debugState.set(getStateLabel(state));
        this.inDebugMode.set(state !== State.Inactive);
        const debugUxValue = state !== State.Inactive && state !== State.Initializing || this.adapterManager.hasEnabledDebuggers() && this.configurationManager.selectedConfiguration.name ? "default" : "simple";
        this.debugUx.set(debugUxValue);
        this.debugStorage.storeDebugUxState(debugUxValue);
      });
      this.previousState = state;
      this._onDidChangeState.fire(state);
    }
  }
  get onDidChangeState() {
    return this._onDidChangeState.event;
  }
  get onDidNewSession() {
    return this._onDidNewSession.event;
  }
  get onWillNewSession() {
    return this._onWillNewSession.event;
  }
  get onDidEndSession() {
    return this._onDidEndSession.event;
  }
  lazySetup() {
    if (!this.haveDoneLazySetup) {
      this.disposables.add(this.fileService.registerProvider(DEBUG_MEMORY_SCHEME, this.disposables.add(new DebugMemoryFileSystemProvider(this))));
      this.haveDoneLazySetup = true;
    }
  }
  //---- life cycle management
  /**
   * main entry point
   * properly manages compounds, checks for errors and handles the initializing state.
   */
  async startDebugging(launch, configOrName, options, saveBeforeStart = !options?.parentSession) {
    const message = options && options.noDebug ? nls.localize("runTrust", "Running executes build tasks and program code from your workspace.") : nls.localize("debugTrust", "Debugging executes build tasks and program code from your workspace.");
    const trust = await this.workspaceTrustRequestService.requestWorkspaceTrust({ message });
    if (!trust) {
      return false;
    }
    this.lazySetup();
    this.startInitializingState(options);
    this.hasDebugged.set(true);
    try {
      await this.extensionService.activateByEvent("onDebug");
      if (saveBeforeStart) {
        await saveAllBeforeDebugStart(this.configurationService, this.editorService);
      }
      await this.extensionService.whenInstalledExtensionsRegistered();
      let config;
      let compound;
      if (!configOrName) {
        configOrName = this.configurationManager.selectedConfiguration.name;
      }
      if (typeof configOrName === "string" && launch) {
        config = launch.getConfiguration(configOrName);
        compound = launch.getCompound(configOrName);
      } else if (typeof configOrName !== "string") {
        config = configOrName;
      }
      if (compound) {
        if (!compound.configurations) {
          throw new Error(nls.localize(
            { key: "compoundMustHaveConfigurations", comment: ['compound indicates a "compounds" configuration item', '"configurations" is an attribute and should not be localized'] },
            'Compound must have "configurations" attribute set in order to start multiple configurations.'
          ));
        }
        if (compound.preLaunchTask) {
          const taskResult = await this.taskRunner.runTaskAndCheckErrors(launch?.workspace || this.contextService.getWorkspace(), compound.preLaunchTask);
          if (taskResult === TaskRunResult.Failure) {
            this.endInitializingState();
            return false;
          }
        }
        if (compound.stopAll) {
          options = { ...options, compoundRoot: new DebugCompoundRoot() };
        }
        const values = await Promise.all(compound.configurations.map((configData) => {
          const name = typeof configData === "string" ? configData : configData.name;
          if (name === compound.name) {
            return Promise.resolve(false);
          }
          let launchForName;
          if (typeof configData === "string") {
            const launchesContainingName = this.configurationManager.getLaunches().filter((l) => !!l.getConfiguration(name));
            if (launchesContainingName.length === 1) {
              launchForName = launchesContainingName[0];
            } else if (launch && launchesContainingName.length > 1 && launchesContainingName.indexOf(launch) >= 0) {
              launchForName = launch;
            } else {
              throw new Error(launchesContainingName.length === 0 ? nls.localize("noConfigurationNameInWorkspace", "Could not find launch configuration '{0}' in the workspace.", name) : nls.localize("multipleConfigurationNamesInWorkspace", "There are multiple launch configurations '{0}' in the workspace. Use folder name to qualify the configuration.", name));
            }
          } else if (configData.folder) {
            const launchesMatchingConfigData = this.configurationManager.getLaunches().filter((l) => l.workspace && l.workspace.name === configData.folder && !!l.getConfiguration(configData.name));
            if (launchesMatchingConfigData.length === 1) {
              launchForName = launchesMatchingConfigData[0];
            } else {
              throw new Error(nls.localize("noFolderWithName", "Can not find folder with name '{0}' for configuration '{1}' in compound '{2}'.", configData.folder, configData.name, compound.name));
            }
          }
          return this.createSession(launchForName, launchForName.getConfiguration(name), options);
        }));
        const result2 = values.every((success) => !!success);
        this.endInitializingState();
        return result2;
      }
      if (configOrName && !config) {
        const message2 = !!launch ? nls.localize("configMissing", "Configuration '{0}' is missing in 'launch.json'.", typeof configOrName === "string" ? configOrName : configOrName.name) : nls.localize("launchJsonDoesNotExist", "'launch.json' does not exist for passed workspace folder.");
        throw new Error(message2);
      }
      const result = await this.createSession(launch, config, options);
      this.endInitializingState();
      return result;
    } catch (err) {
      this.notificationService.error(err);
      this.endInitializingState();
      return Promise.reject(err);
    }
  }
  /**
   * gets the debugger for the type, resolves configurations by providers, substitutes variables and runs prelaunch tasks
   */
  async createSession(launch, config, options) {
    let type;
    if (config) {
      type = config.type;
    } else {
      config = /* @__PURE__ */ Object.create(null);
    }
    if (options && options.noDebug) {
      config.noDebug = true;
    } else if (options && typeof options.noDebug === "undefined" && options.parentSession && options.parentSession.configuration.noDebug) {
      config.noDebug = true;
    }
    const unresolvedConfig = deepClone(config);
    let guess;
    let activeEditor;
    if (!type) {
      activeEditor = this.editorService.activeEditor;
      if (activeEditor && activeEditor.resource) {
        const chosen = this.chosenEnvironments[activeEditor.resource.toString()];
        if (chosen) {
          type = chosen.type;
          if (chosen.dynamicLabel) {
            const dyn = await this.configurationManager.getDynamicConfigurationsByType(chosen.type);
            const found = dyn.find((d) => d.label === chosen.dynamicLabel);
            if (found) {
              launch = found.launch;
              Object.assign(config, found.config);
            }
          }
        }
      }
      if (!type) {
        guess = await this.adapterManager.guessDebugger(false);
        if (guess) {
          type = guess.debugger.type;
          if (guess.withConfig) {
            launch = guess.withConfig.launch;
            Object.assign(config, guess.withConfig.config);
          }
        }
      }
    }
    const initCancellationToken = new CancellationTokenSource();
    const sessionId = generateUuid();
    this.sessionCancellationTokens.set(sessionId, initCancellationToken);
    const configByProviders = await this.configurationManager.resolveConfigurationByProviders(launch && launch.workspace ? launch.workspace.uri : void 0, type, config, initCancellationToken.token);
    if (configByProviders && configByProviders.type) {
      try {
        let resolvedConfig = await this.substituteVariables(launch, configByProviders);
        if (!resolvedConfig) {
          return false;
        }
        if (initCancellationToken.token.isCancellationRequested) {
          return false;
        }
        const workspace = launch?.workspace || this.contextService.getWorkspace();
        const taskResult = await this.taskRunner.runTaskAndCheckErrors(workspace, resolvedConfig.preLaunchTask);
        if (taskResult === TaskRunResult.Failure) {
          return false;
        }
        const cfg = await this.configurationManager.resolveDebugConfigurationWithSubstitutedVariables(launch && launch.workspace ? launch.workspace.uri : void 0, resolvedConfig.type, resolvedConfig, initCancellationToken.token);
        if (!cfg) {
          if (launch && type && cfg === null && !initCancellationToken.token.isCancellationRequested) {
            await launch.openConfigFile({ preserveFocus: true, type }, initCancellationToken.token);
          }
          return false;
        }
        resolvedConfig = cfg;
        const dbg = this.adapterManager.getDebugger(resolvedConfig.type);
        if (!dbg || configByProviders.request !== "attach" && configByProviders.request !== "launch") {
          let message;
          if (configByProviders.request !== "attach" && configByProviders.request !== "launch") {
            message = configByProviders.request ? nls.localize("debugRequestNotSupported", "Attribute '{0}' has an unsupported value '{1}' in the chosen debug configuration.", "request", configByProviders.request) : nls.localize("debugRequesMissing", "Attribute '{0}' is missing from the chosen debug configuration.", "request");
          } else {
            message = resolvedConfig.type ? nls.localize("debugTypeNotSupported", "Configured debug type '{0}' is not supported.", resolvedConfig.type) : nls.localize("debugTypeMissing", "Missing property 'type' for the chosen launch configuration.");
          }
          const actionList = [];
          actionList.push(new Action(
            "installAdditionalDebuggers",
            nls.localize({ key: "installAdditionalDebuggers", comment: ['Placeholder is the debug type, so for example "node", "python"'] }, "Install {0} Extension", resolvedConfig.type),
            void 0,
            true,
            async () => this.commandService.executeCommand("debug.installAdditionalDebuggers", resolvedConfig?.type)
          ));
          await this.showError(message, actionList);
          return false;
        }
        if (!dbg.enabled) {
          await this.showError(debuggerDisabledMessage(dbg.type), []);
          return false;
        }
        const result = await this.doCreateSession(sessionId, launch?.workspace, { resolved: resolvedConfig, unresolved: unresolvedConfig }, options);
        if (result && guess && activeEditor && activeEditor.resource) {
          this.chosenEnvironments[activeEditor.resource.toString()] = { type: guess.debugger.type, dynamicLabel: guess.withConfig?.label };
          this.debugStorage.storeChosenEnvironments(this.chosenEnvironments);
        }
        return result;
      } catch (err) {
        if (err && err.message) {
          await this.showError(err.message);
        } else if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
          await this.showError(nls.localize("noFolderWorkspaceDebugError", "The active file can not be debugged. Make sure it is saved and that you have a debug extension installed for that file type."));
        }
        if (launch && !initCancellationToken.token.isCancellationRequested) {
          await launch.openConfigFile({ preserveFocus: true }, initCancellationToken.token);
        }
        return false;
      }
    }
    if (launch && type && configByProviders === null && !initCancellationToken.token.isCancellationRequested) {
      await launch.openConfigFile({ preserveFocus: true, type }, initCancellationToken.token);
    }
    return false;
  }
  /**
   * instantiates the new session, initializes the session, registers session listeners and reports telemetry
   */
  async doCreateSession(sessionId, root, configuration, options) {
    const session = this.instantiationService.createInstance(DebugSession, sessionId, configuration, root, this.model, options);
    if (options?.startedByUser && this.model.getSessions().some((s) => s.getLabel() === session.getLabel()) && configuration.resolved.suppressMultipleSessionWarning !== true) {
      const result = await this.dialogService.confirm({ message: nls.localize("multipleSession", "'{0}' is already running. Do you want to start another instance?", session.getLabel()) });
      if (!result.confirmed) {
        return false;
      }
    }
    this.model.addSession(session);
    this._onWillNewSession.fire(session);
    const openDebug = this.configurationService.getValue("debug").openDebug;
    if (!configuration.resolved.noDebug && (openDebug === "openOnSessionStart" || openDebug !== "neverOpen" && this.viewModel.firstSessionStart) && !session.suppressDebugView) {
      await this.paneCompositeService.openPaneComposite(VIEWLET_ID, ViewContainerLocation.Sidebar);
    }
    try {
      await this.launchOrAttachToSession(session);
      const internalConsoleOptions = session.configuration.internalConsoleOptions || this.configurationService.getValue("debug").internalConsoleOptions;
      if (internalConsoleOptions === "openOnSessionStart" || this.viewModel.firstSessionStart && internalConsoleOptions === "openOnFirstSessionStart") {
        this.viewsService.openView(REPL_VIEW_ID, false);
      }
      this.viewModel.firstSessionStart = false;
      const showSubSessions = this.configurationService.getValue("debug").showSubSessionsInToolBar;
      const sessions = this.model.getSessions();
      const shownSessions = showSubSessions ? sessions : sessions.filter((s) => !s.parentSession);
      if (shownSessions.length > 1) {
        this.viewModel.setMultiSessionView(true);
      }
      this._onDidNewSession.fire(session);
      return true;
    } catch (error) {
      if (errors.isCancellationError(error)) {
        return false;
      }
      if (session && session.getReplElements().length > 0) {
        this.viewsService.openView(REPL_VIEW_ID, false);
      }
      if (session.configuration && session.configuration.request === "attach" && session.configuration.__autoAttach) {
        return false;
      }
      const errorMessage = error instanceof Error ? error.message : error;
      if (error.showUser !== false) {
        await this.showError(errorMessage, isErrorWithActions(error) ? error.actions : []);
      }
      return false;
    }
  }
  async launchOrAttachToSession(session, forceFocus = false) {
    this.registerSessionListeners(session);
    const dbgr = this.adapterManager.getDebugger(session.configuration.type);
    try {
      await session.initialize(dbgr);
      await session.launchOrAttach(session.configuration);
      const launchJsonExists = !!session.root && !!this.configurationService.getValue("launch", { resource: session.root.uri });
      await this.telemetry.logDebugSessionStart(dbgr, launchJsonExists);
      if (forceFocus || !this.viewModel.focusedSession || session.parentSession === this.viewModel.focusedSession && session.compact) {
        await this.focusStackFrame(void 0, void 0, session);
      }
    } catch (err) {
      if (this.viewModel.focusedSession === session) {
        await this.focusStackFrame(void 0);
      }
      return Promise.reject(err);
    }
  }
  registerSessionListeners(session) {
    const listenerDisposables = new DisposableStore();
    this.disposables.add(listenerDisposables);
    const sessionRunningScheduler = listenerDisposables.add(new RunOnceScheduler(() => {
      if (session.state === State.Running && this.viewModel.focusedSession === session) {
        this.viewModel.setFocus(void 0, this.viewModel.focusedThread, session, false);
      }
    }, 200));
    listenerDisposables.add(session.onDidChangeState(() => {
      if (session.state === State.Running && this.viewModel.focusedSession === session) {
        sessionRunningScheduler.schedule();
      }
      if (session === this.viewModel.focusedSession) {
        this.onStateChange();
      }
    }));
    listenerDisposables.add(this.onDidEndSession((e) => {
      if (e.session === session) {
        this.disposables.delete(listenerDisposables);
      }
    }));
    listenerDisposables.add(session.onDidEndAdapter(async (adapterExitEvent) => {
      if (adapterExitEvent) {
        if (adapterExitEvent.error) {
          this.notificationService.error(nls.localize("debugAdapterCrash", "Debug adapter process has terminated unexpectedly ({0})", adapterExitEvent.error.message || adapterExitEvent.error.toString()));
        }
        this.telemetry.logDebugSessionStop(session, adapterExitEvent);
      }
      const extensionDebugSession = getExtensionHostDebugSession(session);
      if (extensionDebugSession && extensionDebugSession.state === State.Running && extensionDebugSession.configuration.noDebug) {
        this.extensionHostDebugService.close(extensionDebugSession.getId());
      }
      if (session.configuration.postDebugTask) {
        const root = session.root ?? this.contextService.getWorkspace();
        try {
          await this.taskRunner.runTask(root, session.configuration.postDebugTask);
        } catch (err) {
          this.notificationService.error(err);
        }
      }
      this.endInitializingState();
      this.cancelTokens(session.getId());
      if (this.configurationService.getValue("debug").closeReadonlyTabsOnEnd) {
        const editorsToClose = this.editorService.getEditors(EditorsOrder.SEQUENTIAL).filter(({ editor }) => {
          return editor.resource?.scheme === DEBUG_SCHEME && session.getId() === Source.getEncodedDebugData(editor.resource).sessionId;
        });
        this.editorService.closeEditors(editorsToClose);
      }
      this._onDidEndSession.fire({ session, restart: this.restartingSessions.has(session) });
      const focusedSession = this.viewModel.focusedSession;
      if (focusedSession && focusedSession.getId() === session.getId()) {
        const { session: session2, thread, stackFrame } = getStackFrameThreadAndSessionToFocus(this.model, void 0, void 0, void 0, focusedSession);
        this.viewModel.setFocus(stackFrame, thread, session2, false);
      }
      if (this.model.getSessions().length === 0) {
        this.viewModel.setMultiSessionView(false);
        if (this.layoutService.isVisible(Parts.SIDEBAR_PART) && this.configurationService.getValue("debug").openExplorerOnEnd) {
          this.paneCompositeService.openPaneComposite(EXPLORER_VIEWLET_ID, ViewContainerLocation.Sidebar);
        }
        const dataBreakpoints = this.model.getDataBreakpoints().filter((dbp) => !dbp.canPersist);
        dataBreakpoints.forEach((dbp) => this.model.removeDataBreakpoints(dbp.getId()));
        if (this.configurationService.getValue("debug").console.closeOnEnd) {
          const debugConsoleContainer = this.viewDescriptorService.getViewContainerByViewId(REPL_VIEW_ID);
          if (debugConsoleContainer && this.viewsService.isViewContainerVisible(debugConsoleContainer.id)) {
            this.viewsService.closeViewContainer(debugConsoleContainer.id);
          }
        }
      }
      this.model.removeExceptionBreakpointsForSession(session.getId());
    }));
  }
  async restartSession(session, restartData) {
    if (session.saveBeforeRestart) {
      await saveAllBeforeDebugStart(this.configurationService, this.editorService);
    }
    const isAutoRestart = !!restartData;
    const runTasks = async () => {
      if (isAutoRestart) {
        return Promise.resolve(TaskRunResult.Success);
      }
      const root = session.root || this.contextService.getWorkspace();
      await this.taskRunner.runTask(root, session.configuration.preRestartTask);
      await this.taskRunner.runTask(root, session.configuration.postDebugTask);
      const taskResult1 = await this.taskRunner.runTaskAndCheckErrors(root, session.configuration.preLaunchTask);
      if (taskResult1 !== TaskRunResult.Success) {
        return taskResult1;
      }
      return this.taskRunner.runTaskAndCheckErrors(root, session.configuration.postRestartTask);
    };
    const extensionDebugSession = getExtensionHostDebugSession(session);
    if (extensionDebugSession) {
      const taskResult = await runTasks();
      if (taskResult === TaskRunResult.Success) {
        this.extensionHostDebugService.reload(extensionDebugSession.getId());
      }
      return;
    }
    let needsToSubstitute = false;
    let unresolved;
    const launch = session.root ? this.configurationManager.getLaunch(session.root.uri) : void 0;
    if (launch) {
      unresolved = launch.getConfiguration(session.configuration.name);
      if (unresolved && !equals(unresolved, session.unresolvedConfiguration)) {
        unresolved.noDebug = session.configuration.noDebug;
        needsToSubstitute = true;
      }
    }
    let resolved = session.configuration;
    if (launch && needsToSubstitute && unresolved) {
      const initCancellationToken = new CancellationTokenSource();
      this.sessionCancellationTokens.set(session.getId(), initCancellationToken);
      const resolvedByProviders = await this.configurationManager.resolveConfigurationByProviders(launch.workspace ? launch.workspace.uri : void 0, unresolved.type, unresolved, initCancellationToken.token);
      if (resolvedByProviders) {
        resolved = await this.substituteVariables(launch, resolvedByProviders);
        if (resolved && !initCancellationToken.token.isCancellationRequested) {
          resolved = await this.configurationManager.resolveDebugConfigurationWithSubstitutedVariables(launch && launch.workspace ? launch.workspace.uri : void 0, resolved.type, resolved, initCancellationToken.token);
        }
      } else {
        resolved = resolvedByProviders;
      }
    }
    if (resolved) {
      session.setConfiguration({ resolved, unresolved });
    }
    session.configuration.__restart = restartData;
    const doRestart = async (fn) => {
      this.restartingSessions.add(session);
      let didRestart = false;
      try {
        didRestart = await fn() !== false;
      } catch (e) {
        didRestart = false;
        throw e;
      } finally {
        this.restartingSessions.delete(session);
        if (!didRestart) {
          this._onDidEndSession.fire({ session, restart: false });
        }
      }
    };
    for (const breakpoint of this.model.getBreakpoints({ triggeredOnly: true })) {
      breakpoint.setSessionDidTrigger(session.getId(), false);
    }
    if (session.correlatedTestRun) {
      if (!session.correlatedTestRun.completedAt) {
        session.cancelCorrelatedTestRun();
        await Event.toPromise(session.correlatedTestRun.onComplete);
      }
      this.testService.runResolvedTests(session.correlatedTestRun.request);
      return;
    }
    if (session.capabilities.supportsRestartRequest) {
      const taskResult = await runTasks();
      if (taskResult === TaskRunResult.Success) {
        await doRestart(async () => {
          await session.restart();
          return true;
        });
      }
      return;
    }
    const shouldFocus = !!this.viewModel.focusedSession && session.getId() === this.viewModel.focusedSession.getId();
    return doRestart(async () => {
      if (isAutoRestart) {
        await session.disconnect(true);
      } else {
        await session.terminate(true);
      }
      return new Promise((c, e) => {
        setTimeout(async () => {
          const taskResult = await runTasks();
          if (taskResult !== TaskRunResult.Success) {
            return c(false);
          }
          if (!resolved) {
            return c(false);
          }
          try {
            await this.launchOrAttachToSession(session, shouldFocus);
            this._onDidNewSession.fire(session);
            c(true);
          } catch (error) {
            e(error);
          }
        }, 300);
      });
    });
  }
  async stopSession(session, disconnect = false, suspend = false) {
    if (session) {
      return disconnect ? session.disconnect(void 0, suspend) : session.terminate();
    }
    const sessions = this.model.getSessions();
    if (sessions.length === 0) {
      this.taskRunner.cancel();
      await this.quickInputService.cancel();
      this.endInitializingState();
      this.cancelTokens(void 0);
    }
    return Promise.all(sessions.map((s) => disconnect ? s.disconnect(void 0, suspend) : s.terminate()));
  }
  async substituteVariables(launch, config) {
    const dbg = this.adapterManager.getDebugger(config.type);
    if (dbg) {
      let folder = void 0;
      if (launch && launch.workspace) {
        folder = launch.workspace;
      } else {
        const folders = this.contextService.getWorkspace().folders;
        if (folders.length === 1) {
          folder = folders[0];
        }
      }
      try {
        return await dbg.substituteVariables(folder, config);
      } catch (err) {
        this.showError(err.message, void 0, !!launch?.getConfiguration(config.name));
        return void 0;
      }
    }
    return Promise.resolve(config);
  }
  async showError(message, errorActions = [], promptLaunchJson = true) {
    const configureAction = new Action(DEBUG_CONFIGURE_COMMAND_ID, DEBUG_CONFIGURE_LABEL, void 0, true, () => this.commandService.executeCommand(DEBUG_CONFIGURE_COMMAND_ID));
    const actions = errorActions.filter((action) => action.id.endsWith(".command")).length > 0 ? errorActions : [...errorActions, ...promptLaunchJson ? [configureAction] : []];
    await this.dialogService.prompt({
      type: severity.Error,
      message,
      buttons: actions.map((action) => ({
        label: action.label,
        run: () => action.run()
      })),
      cancelButton: true
    });
  }
  //---- focus management
  async focusStackFrame(_stackFrame, _thread, _session, options) {
    const { stackFrame, thread, session } = getStackFrameThreadAndSessionToFocus(this.model, _stackFrame, _thread, _session);
    if (stackFrame) {
      const editor = await stackFrame.openInEditor(this.editorService, options?.preserveFocus ?? true, options?.sideBySide, options?.pinned);
      if (editor) {
        if (editor.input === DisassemblyViewInput.instance) {
        } else {
          const control = editor.getControl();
          if (stackFrame && isCodeEditor(control) && control.hasModel()) {
            const model = control.getModel();
            const lineNumber = stackFrame.range.startLineNumber;
            if (lineNumber >= 1 && lineNumber <= model.getLineCount()) {
              const lineContent = control.getModel().getLineContent(lineNumber);
              aria.alert(nls.localize(
                { key: "debuggingPaused", comment: ['First placeholder is the file line content, second placeholder is the reason why debugging is stopped, for example "breakpoint", third is the stack frame name, and last is the line number.'] },
                "{0}, debugging paused {1}, {2}:{3}",
                lineContent,
                thread && thread.stoppedDetails ? `, reason ${thread.stoppedDetails.reason}` : "",
                stackFrame.source ? stackFrame.source.name : "",
                stackFrame.range.startLineNumber
              ));
            }
          }
        }
      }
    }
    if (session) {
      this.debugType.set(session.configuration.type);
    } else {
      this.debugType.reset();
    }
    this.viewModel.setFocus(stackFrame, thread, session, !!options?.explicit);
  }
  //---- watches
  addWatchExpression(name) {
    const we = this.model.addWatchExpression(name);
    if (!name) {
      this.viewModel.setSelectedExpression(we, false);
    }
    this.debugStorage.storeWatchExpressions(this.model.getWatchExpressions());
  }
  renameWatchExpression(id, newName) {
    this.model.renameWatchExpression(id, newName);
    this.debugStorage.storeWatchExpressions(this.model.getWatchExpressions());
  }
  moveWatchExpression(id, position) {
    this.model.moveWatchExpression(id, position);
    this.debugStorage.storeWatchExpressions(this.model.getWatchExpressions());
  }
  removeWatchExpressions(id) {
    this.model.removeWatchExpressions(id);
    this.debugStorage.storeWatchExpressions(this.model.getWatchExpressions());
  }
  //---- breakpoints
  canSetBreakpointsIn(model) {
    return this.adapterManager.canSetBreakpointsIn(model);
  }
  async enableOrDisableBreakpoints(enable, breakpoint) {
    if (breakpoint) {
      this.model.setEnablement(breakpoint, enable);
      this.debugStorage.storeBreakpoints(this.model);
      if (breakpoint instanceof Breakpoint) {
        await this.makeTriggeredBreakpointsMatchEnablement(enable, breakpoint);
        await this.sendBreakpoints(breakpoint.originalUri);
      } else if (breakpoint instanceof FunctionBreakpoint) {
        await this.sendFunctionBreakpoints();
      } else if (breakpoint instanceof DataBreakpoint) {
        await this.sendDataBreakpoints();
      } else if (breakpoint instanceof InstructionBreakpoint) {
        await this.sendInstructionBreakpoints();
      } else {
        await this.sendExceptionBreakpoints();
      }
    } else {
      this.model.enableOrDisableAllBreakpoints(enable);
      this.debugStorage.storeBreakpoints(this.model);
      await this.sendAllBreakpoints();
    }
    this.debugStorage.storeBreakpoints(this.model);
  }
  async addBreakpoints(uri2, rawBreakpoints, ariaAnnounce = true) {
    const breakpoints = this.model.addBreakpoints(uri2, rawBreakpoints);
    if (ariaAnnounce) {
      breakpoints.forEach((bp) => aria.status(nls.localize("breakpointAdded", "Added breakpoint, line {0}, file {1}", bp.lineNumber, uri2.fsPath)));
    }
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendBreakpoints(uri2);
    this.debugStorage.storeBreakpoints(this.model);
    return breakpoints;
  }
  async updateBreakpoints(uri2, data, sendOnResourceSaved) {
    this.model.updateBreakpoints(data);
    this.debugStorage.storeBreakpoints(this.model);
    if (sendOnResourceSaved) {
      this.breakpointsToSendOnResourceSaved.add(uri2);
    } else {
      await this.sendBreakpoints(uri2);
      this.debugStorage.storeBreakpoints(this.model);
    }
  }
  async removeBreakpoints(id) {
    const breakpoints = this.model.getBreakpoints();
    const toRemove = breakpoints.filter((bp) => !id || bp.getId() === id);
    toRemove.forEach((bp) => aria.status(nls.localize("breakpointRemoved", "Removed breakpoint, line {0}, file {1}", bp.lineNumber, bp.uri.fsPath)));
    const urisToClear = new Set(toRemove.map((bp) => bp.originalUri.toString()));
    this.model.removeBreakpoints(toRemove);
    this.unlinkTriggeredBreakpoints(breakpoints, toRemove).forEach((uri2) => urisToClear.add(uri2.toString()));
    this.debugStorage.storeBreakpoints(this.model);
    await Promise.all([...urisToClear].map((uri2) => this.sendBreakpoints(URI.parse(uri2))));
  }
  setBreakpointsActivated(activated) {
    this.model.setBreakpointsActivated(activated);
    return this.sendAllBreakpoints();
  }
  async addFunctionBreakpoint(opts, id) {
    this.model.addFunctionBreakpoint(opts ?? { name: "" }, id);
    if (opts) {
      this.debugStorage.storeBreakpoints(this.model);
      await this.sendFunctionBreakpoints();
      this.debugStorage.storeBreakpoints(this.model);
    }
  }
  async updateFunctionBreakpoint(id, update) {
    this.model.updateFunctionBreakpoint(id, update);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendFunctionBreakpoints();
  }
  async removeFunctionBreakpoints(id) {
    this.model.removeFunctionBreakpoints(id);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendFunctionBreakpoints();
  }
  async addDataBreakpoint(opts) {
    this.model.addDataBreakpoint(opts);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendDataBreakpoints();
    this.debugStorage.storeBreakpoints(this.model);
  }
  async updateDataBreakpoint(id, update) {
    this.model.updateDataBreakpoint(id, update);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendDataBreakpoints();
  }
  async removeDataBreakpoints(id) {
    this.model.removeDataBreakpoints(id);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendDataBreakpoints();
  }
  async addInstructionBreakpoint(opts) {
    this.model.addInstructionBreakpoint(opts);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendInstructionBreakpoints();
    this.debugStorage.storeBreakpoints(this.model);
  }
  async removeInstructionBreakpoints(instructionReference, offset) {
    this.model.removeInstructionBreakpoints(instructionReference, offset);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendInstructionBreakpoints();
  }
  setExceptionBreakpointFallbackSession(sessionId) {
    this.model.setExceptionBreakpointFallbackSession(sessionId);
    this.debugStorage.storeBreakpoints(this.model);
  }
  setExceptionBreakpointsForSession(session, filters) {
    this.model.setExceptionBreakpointsForSession(session.getId(), filters);
    this.debugStorage.storeBreakpoints(this.model);
  }
  async setExceptionBreakpointCondition(exceptionBreakpoint, condition) {
    this.model.setExceptionBreakpointCondition(exceptionBreakpoint, condition);
    this.debugStorage.storeBreakpoints(this.model);
    await this.sendExceptionBreakpoints();
  }
  async sendAllBreakpoints(session) {
    const setBreakpointsPromises = distinct(this.model.getBreakpoints(), (bp) => bp.originalUri.toString()).map((bp) => this.sendBreakpoints(bp.originalUri, false, session));
    if (session?.capabilities.supportsConfigurationDoneRequest) {
      await Promise.all([
        ...setBreakpointsPromises,
        this.sendFunctionBreakpoints(session),
        this.sendDataBreakpoints(session),
        this.sendInstructionBreakpoints(session),
        this.sendExceptionBreakpoints(session)
      ]);
    } else {
      await Promise.all(setBreakpointsPromises);
      await this.sendFunctionBreakpoints(session);
      await this.sendDataBreakpoints(session);
      await this.sendInstructionBreakpoints(session);
      await this.sendExceptionBreakpoints(session);
    }
  }
  /**
   * Removes the condition of triggered breakpoints that depended on
   * breakpoints in `removedBreakpoints`. Returns the URIs of resources that
   * had their breakpoints changed in this way.
   */
  unlinkTriggeredBreakpoints(allBreakpoints, removedBreakpoints) {
    const affectedUris = [];
    for (const removed of removedBreakpoints) {
      for (const existing of allBreakpoints) {
        if (!removedBreakpoints.includes(existing) && existing.triggeredBy === removed.getId()) {
          this.model.updateBreakpoints(/* @__PURE__ */ new Map([[existing.getId(), { triggeredBy: void 0 }]]));
          affectedUris.push(existing.originalUri);
        }
      }
    }
    return affectedUris;
  }
  async makeTriggeredBreakpointsMatchEnablement(enable, breakpoint) {
    if (enable) {
      if (breakpoint.triggeredBy) {
        const trigger = this.model.getBreakpoints().find((bp) => breakpoint.triggeredBy === bp.getId());
        if (trigger && !trigger.enabled) {
          await this.enableOrDisableBreakpoints(enable, trigger);
        }
      }
    }
    await Promise.all(
      this.model.getBreakpoints().filter((bp) => bp.triggeredBy === breakpoint.getId() && bp.enabled !== enable).map((bp) => this.enableOrDisableBreakpoints(enable, bp))
    );
  }
  async sendBreakpoints(modelUri, sourceModified = false, session) {
    const breakpointsToSend = this.model.getBreakpoints({ originalUri: modelUri, enabledOnly: true });
    await sendToOneOrAllSessions(this.model, session, async (s) => {
      if (!s.configuration.noDebug) {
        const sessionBps = breakpointsToSend.filter((bp) => !bp.triggeredBy || bp.getSessionDidTrigger(s.getId()));
        await s.sendBreakpoints(modelUri, sessionBps, sourceModified);
      }
    });
  }
  async sendFunctionBreakpoints(session) {
    const breakpointsToSend = this.model.getFunctionBreakpoints().filter((fbp) => fbp.enabled && this.model.areBreakpointsActivated());
    await sendToOneOrAllSessions(this.model, session, async (s) => {
      if (s.capabilities.supportsFunctionBreakpoints && !s.configuration.noDebug) {
        await s.sendFunctionBreakpoints(breakpointsToSend);
      }
    });
  }
  async sendDataBreakpoints(session) {
    const breakpointsToSend = this.model.getDataBreakpoints().filter((fbp) => fbp.enabled && this.model.areBreakpointsActivated());
    await sendToOneOrAllSessions(this.model, session, async (s) => {
      if (s.capabilities.supportsDataBreakpoints && !s.configuration.noDebug) {
        await s.sendDataBreakpoints(breakpointsToSend);
      }
    });
  }
  async sendInstructionBreakpoints(session) {
    const breakpointsToSend = this.model.getInstructionBreakpoints().filter((fbp) => fbp.enabled && this.model.areBreakpointsActivated());
    await sendToOneOrAllSessions(this.model, session, async (s) => {
      if (s.capabilities.supportsInstructionBreakpoints && !s.configuration.noDebug) {
        await s.sendInstructionBreakpoints(breakpointsToSend);
      }
    });
  }
  sendExceptionBreakpoints(session) {
    return sendToOneOrAllSessions(this.model, session, async (s) => {
      const enabledExceptionBps = this.model.getExceptionBreakpointsForSession(s.getId()).filter((exb) => exb.enabled);
      if (s.capabilities.supportsConfigurationDoneRequest && (!s.capabilities.exceptionBreakpointFilters || s.capabilities.exceptionBreakpointFilters.length === 0)) {
        return;
      }
      if (!s.configuration.noDebug) {
        await s.sendExceptionBreakpoints(enabledExceptionBps);
      }
    });
  }
  onFileChanges(fileChangesEvent) {
    const toRemove = this.model.getBreakpoints().filter((bp) => fileChangesEvent.contains(bp.originalUri, FileChangeType.DELETED));
    if (toRemove.length) {
      this.model.removeBreakpoints(toRemove);
    }
    const toSend = [];
    for (const uri2 of this.breakpointsToSendOnResourceSaved) {
      if (fileChangesEvent.contains(uri2, FileChangeType.UPDATED)) {
        toSend.push(uri2);
      }
    }
    for (const uri2 of toSend) {
      this.breakpointsToSendOnResourceSaved.delete(uri2);
      this.sendBreakpoints(uri2, true);
    }
  }
  async runTo(uri2, lineNumber, column) {
    let breakpointToRemove;
    let threadToContinue = this.getViewModel().focusedThread;
    const addTempBreakPoint = async () => {
      const bpExists = !!this.getModel().getBreakpoints({ column, lineNumber, uri: uri2 }).length;
      if (!bpExists) {
        const addResult = await this.addAndValidateBreakpoints(uri2, lineNumber, column);
        if (addResult.thread) {
          threadToContinue = addResult.thread;
        }
        if (addResult.breakpoint) {
          breakpointToRemove = addResult.breakpoint;
        }
      }
      return { threadToContinue, breakpointToRemove };
    };
    const removeTempBreakPoint = (state) => {
      if (state === State.Stopped || state === State.Inactive) {
        if (breakpointToRemove) {
          this.removeBreakpoints(breakpointToRemove.getId());
        }
        return true;
      }
      return false;
    };
    await addTempBreakPoint();
    if (this.state === State.Inactive) {
      const { launch, name, getConfig } = this.getConfigurationManager().selectedConfiguration;
      const config = await getConfig();
      const configOrName = config ? Object.assign(deepClone(config), {}) : name;
      const listener = this.onDidChangeState((state) => {
        if (removeTempBreakPoint(state)) {
          listener.dispose();
        }
      });
      await this.startDebugging(launch, configOrName, void 0, true);
    }
    if (this.state === State.Stopped) {
      const focusedSession = this.getViewModel().focusedSession;
      if (!focusedSession || !threadToContinue) {
        return;
      }
      const listener = threadToContinue.session.onDidChangeState(() => {
        if (removeTempBreakPoint(focusedSession.state)) {
          listener.dispose();
        }
      });
      await threadToContinue.continue();
    }
  }
  async addAndValidateBreakpoints(uri2, lineNumber, column) {
    const debugModel = this.getModel();
    const viewModel = this.getViewModel();
    const breakpoints = await this.addBreakpoints(uri2, [{ lineNumber, column }], false);
    const breakpoint = breakpoints?.[0];
    if (!breakpoint) {
      return { breakpoint: void 0, thread: viewModel.focusedThread };
    }
    if (!breakpoint.verified) {
      let listener;
      await raceTimeout(new Promise((resolve) => {
        listener = debugModel.onDidChangeBreakpoints(() => {
          if (breakpoint.verified) {
            resolve();
          }
        });
      }), 2e3);
      listener.dispose();
    }
    let Score;
    ((Score2) => {
      Score2[Score2["Focused"] = 0] = "Focused";
      Score2[Score2["Verified"] = 1] = "Verified";
      Score2[Score2["VerifiedAndPausedInFile"] = 2] = "VerifiedAndPausedInFile";
      Score2[Score2["VerifiedAndFocused"] = 3] = "VerifiedAndFocused";
    })(Score || (Score = {}));
    let bestThread = viewModel.focusedThread;
    let bestScore = 0 /* Focused */;
    for (const sessionId of breakpoint.sessionsThatVerified) {
      const session = debugModel.getSession(sessionId);
      if (!session) {
        continue;
      }
      const threads = session.getAllThreads().filter((t) => t.stopped);
      if (bestScore < 3 /* VerifiedAndFocused */) {
        if (viewModel.focusedThread && threads.includes(viewModel.focusedThread)) {
          bestThread = viewModel.focusedThread;
          bestScore = 3 /* VerifiedAndFocused */;
        }
      }
      if (bestScore < 2 /* VerifiedAndPausedInFile */) {
        const pausedInThisFile = threads.find((t) => {
          const top = t.getTopStackFrame();
          return top && this.uriIdentityService.extUri.isEqual(top.source.uri, uri2);
        });
        if (pausedInThisFile) {
          bestThread = pausedInThisFile;
          bestScore = 2 /* VerifiedAndPausedInFile */;
        }
      }
      if (bestScore < 1 /* Verified */) {
        bestThread = threads[0];
        bestScore = 2 /* VerifiedAndPausedInFile */;
      }
    }
    return { thread: bestThread, breakpoint };
  }
};
DebugService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IPaneCompositePartService),
  __decorateParam(2, IViewsService),
  __decorateParam(3, IViewDescriptorService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IWorkbenchLayoutService),
  __decorateParam(7, IWorkspaceContextService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, ILifecycleService),
  __decorateParam(10, IInstantiationService),
  __decorateParam(11, IExtensionService),
  __decorateParam(12, IFileService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IExtensionHostDebugService),
  __decorateParam(15, IActivityService),
  __decorateParam(16, ICommandService),
  __decorateParam(17, IQuickInputService),
  __decorateParam(18, IWorkspaceTrustRequestService),
  __decorateParam(19, IUriIdentityService),
  __decorateParam(20, ITestService)
], DebugService);
function getStackFrameThreadAndSessionToFocus(model, stackFrame, thread, session, avoidSession) {
  if (!session) {
    if (stackFrame || thread) {
      session = stackFrame ? stackFrame.thread.session : thread.session;
    } else {
      const sessions = model.getSessions();
      const stoppedSession = sessions.find((s) => s.state === State.Stopped);
      session = stoppedSession || sessions.find((s) => s !== avoidSession && s !== avoidSession?.parentSession) || (sessions.length ? sessions[0] : void 0);
    }
  }
  if (!thread) {
    if (stackFrame) {
      thread = stackFrame.thread;
    } else {
      const threads = session ? session.getAllThreads() : void 0;
      const stoppedThread = threads && threads.find((t) => t.stopped);
      thread = stoppedThread || (threads && threads.length ? threads[0] : void 0);
    }
  }
  if (!stackFrame && thread) {
    stackFrame = thread.getTopStackFrame();
  }
  return { session, thread, stackFrame };
}
async function sendToOneOrAllSessions(model, session, send) {
  if (session) {
    await send(session);
  } else {
    await Promise.all(model.getSessions().map((s) => send(s)));
  }
}
export {
  DebugService,
  getStackFrameThreadAndSessionToFocus
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGFyaWEgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IGRpc3RpbmN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIsIHJhY2VUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgaXNFcnJvcldpdGhBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCAqIGFzIGVycm9ycyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGRlZXBDbG9uZSwgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgc2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgVVJJLCBVUkkgYXMgdXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgaXNDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25Ib3N0RGVidWdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGVidWcvY29tbW9uL2V4dGVuc2lvbkhvc3REZWJ1Zy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgRmlsZUNoYW5nZVR5cGUsIEZpbGVDaGFuZ2VzRXZlbnQsIElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgSVdvcmtzcGFjZUZvbGRlciwgV29ya2JlbmNoU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgRWRpdG9yc09yZGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElBY3Rpdml0eVNlcnZpY2UsIE51bWJlckJhZGdlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYWN0aXZpdHkvY29tbW9uL2FjdGl2aXR5LmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgUGFydHMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhbmVjb21wb3NpdGUvYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFZJRVdMRVRfSUQgYXMgRVhQTE9SRVJfVklFV0xFVF9JRCB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJVGVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZXN0aW5nL2NvbW1vbi90ZXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDQUxMU1RBQ0tfVklFV19JRCwgQ09OVEVYVF9CUkVBS1BPSU5UU19FWElTVCwgQ09OVEVYVF9ERUJVR19TVEFURSwgQ09OVEVYVF9ERUJVR19UWVBFLCBDT05URVhUX0RFQlVHX1VYLCBDT05URVhUX0RJU0FTU0VNQkxZX1ZJRVdfRk9DVVMsIENPTlRFWFRfSEFTX0RFQlVHR0VELCBDT05URVhUX0lOX0RFQlVHX01PREUsIERFQlVHX01FTU9SWV9TQ0hFTUUsIERFQlVHX1NDSEVNRSwgSUFkYXB0ZXJNYW5hZ2VyLCBJQnJlYWtwb2ludCwgSUJyZWFrcG9pbnREYXRhLCBJQnJlYWtwb2ludFVwZGF0ZURhdGEsIElDb21wb3VuZCwgSUNvbmZpZywgSUNvbmZpZ3VyYXRpb25NYW5hZ2VyLCBJRGVidWdDb25maWd1cmF0aW9uLCBJRGVidWdNb2RlbCwgSURlYnVnU2VydmljZSwgSURlYnVnU2Vzc2lvbiwgSURlYnVnU2Vzc2lvbk9wdGlvbnMsIElFbmFibGVtZW50LCBJRXhjZXB0aW9uQnJlYWtwb2ludCwgSUdsb2JhbENvbmZpZywgSUd1ZXNzZWREZWJ1Z2dlciwgSUxhdW5jaCwgSVN0YWNrRnJhbWUsIElUaHJlYWQsIElWaWV3TW9kZWwsIFJFUExfVklFV19JRCwgU3RhdGUsIFZJRVdMRVRfSUQsIGRlYnVnZ2VyRGlzYWJsZWRNZXNzYWdlLCBnZXRTdGF0ZUxhYmVsIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IERlYnVnQ29tcG91bmRSb290IH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnQ29tcG91bmRSb290LmpzJztcbmltcG9ydCB7IEJyZWFrcG9pbnQsIERhdGFCcmVha3BvaW50LCBEZWJ1Z01vZGVsLCBGdW5jdGlvbkJyZWFrcG9pbnQsIElEYXRhQnJlYWtwb2ludE9wdGlvbnMsIElGdW5jdGlvbkJyZWFrcG9pbnRPcHRpb25zLCBJSW5zdHJ1Y3Rpb25CcmVha3BvaW50T3B0aW9ucywgSW5zdHJ1Y3Rpb25CcmVha3BvaW50IH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnTW9kZWwuanMnO1xuaW1wb3J0IHsgU291cmNlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnU291cmNlLmpzJztcbmltcG9ydCB7IERlYnVnU3RvcmFnZSwgSUNob3NlbkVudmlyb25tZW50IH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnU3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBEZWJ1Z1RlbGVtZXRyeSB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z1RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBnZXRFeHRlbnNpb25Ib3N0RGVidWdTZXNzaW9uLCBzYXZlQWxsQmVmb3JlRGVidWdTdGFydCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z1V0aWxzLmpzJztcbmltcG9ydCB7IFZpZXdNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Z1ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBEaXNhc3NlbWJseVZpZXdJbnB1dCB9IGZyb20gJy4uL2NvbW1vbi9kaXNhc3NlbWJseVZpZXdJbnB1dC5qcyc7XG5pbXBvcnQgeyBBZGFwdGVyTWFuYWdlciB9IGZyb20gJy4vZGVidWdBZGFwdGVyTWFuYWdlci5qcyc7XG5pbXBvcnQgeyBERUJVR19DT05GSUdVUkVfQ09NTUFORF9JRCwgREVCVUdfQ09ORklHVVJFX0xBQkVMIH0gZnJvbSAnLi9kZWJ1Z0NvbW1hbmRzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25NYW5hZ2VyIH0gZnJvbSAnLi9kZWJ1Z0NvbmZpZ3VyYXRpb25NYW5hZ2VyLmpzJztcbmltcG9ydCB7IERlYnVnTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi9kZWJ1Z01lbW9yeS5qcyc7XG5pbXBvcnQgeyBEZWJ1Z1Nlc3Npb24gfSBmcm9tICcuL2RlYnVnU2Vzc2lvbi5qcyc7XG5pbXBvcnQgeyBEZWJ1Z1Rhc2tSdW5uZXIsIFRhc2tSdW5SZXN1bHQgfSBmcm9tICcuL2RlYnVnVGFza1J1bm5lci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEZWJ1Z1NlcnZpY2UgaW1wbGVtZW50cyBJRGVidWdTZXJ2aWNlIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTdGF0ZTogRW1pdHRlcjxTdGF0ZT47XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkTmV3U2Vzc2lvbjogRW1pdHRlcjxJRGVidWdTZXNzaW9uPjtcblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsTmV3U2Vzc2lvbjogRW1pdHRlcjxJRGVidWdTZXNzaW9uPjtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRFbmRTZXNzaW9uOiBFbWl0dGVyPHsgc2Vzc2lvbjogSURlYnVnU2Vzc2lvbjsgcmVzdGFydDogYm9vbGVhbiB9Pjtcblx0cHJpdmF0ZSByZWFkb25seSByZXN0YXJ0aW5nU2Vzc2lvbnMgPSBuZXcgU2V0PElEZWJ1Z1Nlc3Npb24+KCk7XG5cdHByaXZhdGUgZGVidWdTdG9yYWdlOiBEZWJ1Z1N0b3JhZ2U7XG5cdHByaXZhdGUgbW9kZWw6IERlYnVnTW9kZWw7XG5cdHByaXZhdGUgdmlld01vZGVsOiBWaWV3TW9kZWw7XG5cdHByaXZhdGUgdGVsZW1ldHJ5OiBEZWJ1Z1RlbGVtZXRyeTtcblx0cHJpdmF0ZSB0YXNrUnVubmVyOiBEZWJ1Z1Rhc2tSdW5uZXI7XG5cdHByaXZhdGUgY29uZmlndXJhdGlvbk1hbmFnZXI6IENvbmZpZ3VyYXRpb25NYW5hZ2VyO1xuXHRwcml2YXRlIGFkYXB0ZXJNYW5hZ2VyOiBBZGFwdGVyTWFuYWdlcjtcblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBkZWJ1Z1R5cGUhOiBJQ29udGV4dEtleTxzdHJpbmc+O1xuXHRwcml2YXRlIGRlYnVnU3RhdGUhOiBJQ29udGV4dEtleTxzdHJpbmc+O1xuXHRwcml2YXRlIGluRGVidWdNb2RlITogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgZGVidWdVeCE6IElDb250ZXh0S2V5PHN0cmluZz47XG5cdHByaXZhdGUgaGFzRGVidWdnZWQhOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBicmVha3BvaW50c0V4aXN0ITogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgZGlzYXNzZW1ibHlWaWV3Rm9jdXMhOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBicmVha3BvaW50c1RvU2VuZE9uUmVzb3VyY2VTYXZlZDogU2V0PFVSST47XG5cdHByaXZhdGUgaW5pdGlhbGl6aW5nID0gZmFsc2U7XG5cdHByaXZhdGUgX2luaXRpYWxpemluZ09wdGlvbnM6IElEZWJ1Z1Nlc3Npb25PcHRpb25zIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHByZXZpb3VzU3RhdGU6IFN0YXRlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHNlc3Npb25DYW5jZWxsYXRpb25Ub2tlbnMgPSBuZXcgTWFwPHN0cmluZywgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U+KCk7XG5cdHByaXZhdGUgYWN0aXZpdHk6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNob3NlbkVudmlyb25tZW50czogUmVjb3JkPHN0cmluZywgSUNob3NlbkVudmlyb25tZW50Pjtcblx0cHJpdmF0ZSBoYXZlRG9uZUxhenlTZXR1cCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcGFuZUNvbXBvc2l0ZVNlcnZpY2U6IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UsXG5cdFx0QElWaWV3c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3c1NlcnZpY2U6IElWaWV3c1NlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25Ib3N0RGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uSG9zdERlYnVnU2VydmljZTogSUV4dGVuc2lvbkhvc3REZWJ1Z1NlcnZpY2UsXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZTogSVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElUZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlc3RTZXJ2aWNlOiBJVGVzdFNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuYnJlYWtwb2ludHNUb1NlbmRPblJlc291cmNlU2F2ZWQgPSBuZXcgU2V0PFVSST4oKTtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUgPSBuZXcgRW1pdHRlcjxTdGF0ZT4oKTtcblx0XHR0aGlzLl9vbkRpZE5ld1Nlc3Npb24gPSBuZXcgRW1pdHRlcjxJRGVidWdTZXNzaW9uPigpO1xuXHRcdHRoaXMuX29uV2lsbE5ld1Nlc3Npb24gPSBuZXcgRW1pdHRlcjxJRGVidWdTZXNzaW9uPigpO1xuXHRcdHRoaXMuX29uRGlkRW5kU2Vzc2lvbiA9IG5ldyBFbWl0dGVyKCk7XG5cblx0XHR0aGlzLmFkYXB0ZXJNYW5hZ2VyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShBZGFwdGVyTWFuYWdlciwge1xuXHRcdFx0b25EaWROZXdTZXNzaW9uOiB0aGlzLm9uRGlkTmV3U2Vzc2lvbixcblx0XHRcdGNvbmZpZ3VyYXRpb25NYW5hZ2VyOiAoKSA9PiB0aGlzLmNvbmZpZ3VyYXRpb25NYW5hZ2VyLFxuXHRcdH0pO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuYWRhcHRlck1hbmFnZXIpO1xuXHRcdHRoaXMuY29uZmlndXJhdGlvbk1hbmFnZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbmZpZ3VyYXRpb25NYW5hZ2VyLCB0aGlzLmFkYXB0ZXJNYW5hZ2VyKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmNvbmZpZ3VyYXRpb25NYW5hZ2VyKTtcblx0XHR0aGlzLmRlYnVnU3RvcmFnZSA9IHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGVidWdTdG9yYWdlKSk7XG5cblx0XHR0aGlzLmNob3NlbkVudmlyb25tZW50cyA9IHRoaXMuZGVidWdTdG9yYWdlLmxvYWRDaG9zZW5FbnZpcm9ubWVudHMoKTtcblxuXHRcdHRoaXMubW9kZWwgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlYnVnTW9kZWwsIHRoaXMuZGVidWdTdG9yYWdlKTtcblx0XHR0aGlzLnRlbGVtZXRyeSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGVidWdUZWxlbWV0cnksIHRoaXMubW9kZWwpO1xuXG5cdFx0dGhpcy52aWV3TW9kZWwgPSBuZXcgVmlld01vZGVsKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnRhc2tSdW5uZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlYnVnVGFza1J1bm5lcik7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UoZSA9PiB0aGlzLm9uRmlsZUNoYW5nZXMoZSkpKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmxpZmVjeWNsZVNlcnZpY2Uub25XaWxsU2h1dGRvd24odGhpcy5kaXNwb3NlLCB0aGlzKSk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmV4dGVuc2lvbkhvc3REZWJ1Z1NlcnZpY2Uub25BdHRhY2hTZXNzaW9uKGV2ZW50ID0+IHtcblx0XHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLm1vZGVsLmdldFNlc3Npb24oZXZlbnQuc2Vzc2lvbklkLCB0cnVlKTtcblx0XHRcdGlmIChzZXNzaW9uKSB7XG5cdFx0XHRcdC8vIEVIIHdhcyBzdGFydGVkIGluIGRlYnVnIG1vZGUgLT4gYXR0YWNoIHRvIGl0XG5cdFx0XHRcdHNlc3Npb24uY29uZmlndXJhdGlvbi5yZXF1ZXN0ID0gJ2F0dGFjaCc7XG5cdFx0XHRcdHNlc3Npb24uY29uZmlndXJhdGlvbi5wb3J0ID0gZXZlbnQucG9ydDtcblx0XHRcdFx0c2Vzc2lvbi5zZXRTdWJJZChldmVudC5zdWJJZCk7XG5cdFx0XHRcdHRoaXMubGF1bmNoT3JBdHRhY2hUb1Nlc3Npb24oc2Vzc2lvbik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuZXh0ZW5zaW9uSG9zdERlYnVnU2VydmljZS5vblRlcm1pbmF0ZVNlc3Npb24oZXZlbnQgPT4ge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMubW9kZWwuZ2V0U2Vzc2lvbihldmVudC5zZXNzaW9uSWQpO1xuXHRcdFx0aWYgKHNlc3Npb24gJiYgc2Vzc2lvbi5zdWJJZCA9PT0gZXZlbnQuc3ViSWQpIHtcblx0XHRcdFx0c2Vzc2lvbi5kaXNjb25uZWN0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy52aWV3TW9kZWwub25EaWRGb2N1c1N0YWNrRnJhbWUoKCkgPT4ge1xuXHRcdFx0dGhpcy5vblN0YXRlQ2hhbmdlKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMudmlld01vZGVsLm9uRGlkRm9jdXNTZXNzaW9uKChzZXNzaW9uOiBJRGVidWdTZXNzaW9uIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0XHR0aGlzLm9uU3RhdGVDaGFuZ2UoKTtcblxuXHRcdFx0aWYgKHNlc3Npb24pIHtcblx0XHRcdFx0dGhpcy5zZXRFeGNlcHRpb25CcmVha3BvaW50RmFsbGJhY2tTZXNzaW9uKHNlc3Npb24uZ2V0SWQoKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKEV2ZW50LmFueSh0aGlzLmFkYXB0ZXJNYW5hZ2VyLm9uRGlkUmVnaXN0ZXJEZWJ1Z2dlciwgdGhpcy5jb25maWd1cmF0aW9uTWFuYWdlci5vbkRpZFNlbGVjdENvbmZpZ3VyYXRpb24pKCgpID0+IHtcblx0XHRcdGNvbnN0IGRlYnVnVXhWYWx1ZSA9ICh0aGlzLnN0YXRlICE9PSBTdGF0ZS5JbmFjdGl2ZSB8fCAodGhpcy5jb25maWd1cmF0aW9uTWFuYWdlci5nZXRBbGxDb25maWd1cmF0aW9ucygpLmxlbmd0aCA+IDAgJiYgdGhpcy5hZGFwdGVyTWFuYWdlci5oYXNFbmFibGVkRGVidWdnZXJzKCkpKSA/ICdkZWZhdWx0JyA6ICdzaW1wbGUnO1xuXHRcdFx0dGhpcy5kZWJ1Z1V4LnNldChkZWJ1Z1V4VmFsdWUpO1xuXHRcdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVEZWJ1Z1V4U3RhdGUoZGVidWdVeFZhbHVlKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5tb2RlbC5vbkRpZENoYW5nZUNhbGxTdGFjaygoKSA9PiB7XG5cdFx0XHRjb25zdCBudW1iZXJPZlNlc3Npb25zID0gdGhpcy5tb2RlbC5nZXRTZXNzaW9ucygpLmZpbHRlcihzID0+ICFzLnBhcmVudFNlc3Npb24pLmxlbmd0aDtcblx0XHRcdHRoaXMuYWN0aXZpdHk/LmRpc3Bvc2UoKTtcblx0XHRcdGlmIChudW1iZXJPZlNlc3Npb25zID4gMCkge1xuXHRcdFx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKENBTExTVEFDS19WSUVXX0lEKTtcblx0XHRcdFx0aWYgKHZpZXdDb250YWluZXIpIHtcblx0XHRcdFx0XHR0aGlzLmFjdGl2aXR5ID0gdGhpcy5hY3Rpdml0eVNlcnZpY2Uuc2hvd1ZpZXdDb250YWluZXJBY3Rpdml0eSh2aWV3Q29udGFpbmVyLmlkLCB7IGJhZGdlOiBuZXcgTnVtYmVyQmFkZ2UobnVtYmVyT2ZTZXNzaW9ucywgbiA9PiBuID09PSAxID8gbmxzLmxvY2FsaXplKCcxYWN0aXZlU2Vzc2lvbicsIFwiMSBhY3RpdmUgc2Vzc2lvblwiKSA6IG5scy5sb2NhbGl6ZSgnbkFjdGl2ZVNlc3Npb25zJywgXCJ7MH0gYWN0aXZlIHNlc3Npb25zXCIsIG4pKSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGVkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZS5idWZmZXJDaGFuZ2VFdmVudHMoKCkgPT4ge1xuXHRcdFx0XHRpZiAoZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IgPT09IERpc2Fzc2VtYmx5Vmlld0lucHV0Lmluc3RhbmNlKSB7XG5cdFx0XHRcdFx0dGhpcy5kaXNhc3NlbWJseVZpZXdGb2N1cy5zZXQodHJ1ZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gVGhpcyBrZXkgY2FuIGJlIGluaXRpYWxpemVkIGEgdGljayBhZnRlciB0aGlzIGV2ZW50IGlzIGZpcmVkXG5cdFx0XHRcdFx0dGhpcy5kaXNhc3NlbWJseVZpZXdGb2N1cz8ucmVzZXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5saWZlY3ljbGVTZXJ2aWNlLm9uQmVmb3JlU2h1dGRvd24oKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZWRpdG9yU2VydmljZS5lZGl0b3JzKSB7XG5cdFx0XHRcdC8vIEVkaXRvcnMgd2lsbCBub3QgYmUgdmFsaWQgb24gd2luZG93IHJlbG9hZCwgc28gY2xvc2UgdGhlbS5cblx0XHRcdFx0aWYgKGVkaXRvci5yZXNvdXJjZT8uc2NoZW1lID09PSBERUJVR19NRU1PUllfU0NIRU1FKSB7XG5cdFx0XHRcdFx0ZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGV4dGVuc2lvblNlcnZpY2Uub25XaWxsU3RvcChldnQgPT4ge1xuXHRcdFx0ZXZ0LnZldG8oXG5cdFx0XHRcdHRoaXMubW9kZWwuZ2V0U2Vzc2lvbnMoKS5sZW5ndGggPiAwLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2FjdGl2ZSBkZWJ1ZyBzZXNzaW9uJywgJ0EgZGVidWcgc2Vzc2lvbiBpcyBzdGlsbCBydW5uaW5nIHRoYXQgd291bGQgdGVybWluYXRlLicpLFxuXHRcdFx0KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLmluaXRDb250ZXh0S2V5cyhjb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHRwcml2YXRlIGluaXRDb250ZXh0S2V5cyhjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlKTogdm9pZCB7XG5cdFx0cXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuXHRcdFx0Y29udGV4dEtleVNlcnZpY2UuYnVmZmVyQ2hhbmdlRXZlbnRzKCgpID0+IHtcblx0XHRcdFx0dGhpcy5kZWJ1Z1R5cGUgPSBDT05URVhUX0RFQlVHX1RZUEUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdFx0dGhpcy5kZWJ1Z1N0YXRlID0gQ09OVEVYVF9ERUJVR19TVEFURS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0XHR0aGlzLmhhc0RlYnVnZ2VkID0gQ09OVEVYVF9IQVNfREVCVUdHRUQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdFx0dGhpcy5pbkRlYnVnTW9kZSA9IENPTlRFWFRfSU5fREVCVUdfTU9ERS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0XHR0aGlzLmRlYnVnVXggPSBDT05URVhUX0RFQlVHX1VYLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHRcdHRoaXMuZGVidWdVeC5zZXQodGhpcy5kZWJ1Z1N0b3JhZ2UubG9hZERlYnVnVXhTdGF0ZSgpKTtcblx0XHRcdFx0dGhpcy5icmVha3BvaW50c0V4aXN0ID0gQ09OVEVYVF9CUkVBS1BPSU5UU19FWElTVC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0XHQvLyBOZWVkIHRvIHNldCBkaXNhc3NlbWJseVZpZXdGb2N1cyBoZXJlIHRvIG1ha2UgaXQgaW4gdGhlIHNhbWUgY29udGV4dCBhcyB0aGUgZGVidWcgZXZlbnQgaGFuZGxlcnNcblx0XHRcdFx0dGhpcy5kaXNhc3NlbWJseVZpZXdGb2N1cyA9IENPTlRFWFRfRElTQVNTRU1CTFlfVklFV19GT0NVUy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHNldEJyZWFrcG9pbnRzRXhpc3RDb250ZXh0ID0gKCkgPT4gdGhpcy5icmVha3BvaW50c0V4aXN0LnNldCghISh0aGlzLm1vZGVsLmdldEJyZWFrcG9pbnRzKCkubGVuZ3RoIHx8IHRoaXMubW9kZWwuZ2V0RGF0YUJyZWFrcG9pbnRzKCkubGVuZ3RoIHx8IHRoaXMubW9kZWwuZ2V0RnVuY3Rpb25CcmVha3BvaW50cygpLmxlbmd0aCkpO1xuXHRcdFx0c2V0QnJlYWtwb2ludHNFeGlzdENvbnRleHQoKTtcblx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMubW9kZWwub25EaWRDaGFuZ2VCcmVha3BvaW50cygoKSA9PiBzZXRCcmVha3BvaW50c0V4aXN0Q29udGV4dCgpKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXRNb2RlbCgpOiBJRGVidWdNb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWw7XG5cdH1cblxuXHRnZXRWaWV3TW9kZWwoKTogSVZpZXdNb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsO1xuXHR9XG5cblx0Z2V0Q29uZmlndXJhdGlvbk1hbmFnZXIoKTogSUNvbmZpZ3VyYXRpb25NYW5hZ2VyIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uTWFuYWdlcjtcblx0fVxuXG5cdGdldEFkYXB0ZXJNYW5hZ2VyKCk6IElBZGFwdGVyTWFuYWdlciB7XG5cdFx0cmV0dXJuIHRoaXMuYWRhcHRlck1hbmFnZXI7XG5cdH1cblxuXHRzb3VyY2VJc05vdEF2YWlsYWJsZSh1cmk6IHVyaSk6IHZvaWQge1xuXHRcdHRoaXMubW9kZWwuc291cmNlSXNOb3RBdmFpbGFibGUodXJpKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHQvLy0tLS0gc3RhdGUgbWFuYWdlbWVudFxuXG5cdGdldCBzdGF0ZSgpOiBTdGF0ZSB7XG5cdFx0Y29uc3QgZm9jdXNlZFNlc3Npb24gPSB0aGlzLnZpZXdNb2RlbC5mb2N1c2VkU2Vzc2lvbjtcblx0XHRpZiAoZm9jdXNlZFNlc3Npb24pIHtcblx0XHRcdHJldHVybiBmb2N1c2VkU2Vzc2lvbi5zdGF0ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5pbml0aWFsaXppbmcgPyBTdGF0ZS5Jbml0aWFsaXppbmcgOiBTdGF0ZS5JbmFjdGl2ZTtcblx0fVxuXG5cdGdldCBpbml0aWFsaXppbmdPcHRpb25zKCk6IElEZWJ1Z1Nlc3Npb25PcHRpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5faW5pdGlhbGl6aW5nT3B0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgc3RhcnRJbml0aWFsaXppbmdTdGF0ZShvcHRpb25zPzogSURlYnVnU2Vzc2lvbk9wdGlvbnMpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaW5pdGlhbGl6aW5nKSB7XG5cdFx0XHR0aGlzLmluaXRpYWxpemluZyA9IHRydWU7XG5cdFx0XHR0aGlzLl9pbml0aWFsaXppbmdPcHRpb25zID0gb3B0aW9ucztcblx0XHRcdHRoaXMub25TdGF0ZUNoYW5nZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZW5kSW5pdGlhbGl6aW5nU3RhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaW5pdGlhbGl6aW5nKSB7XG5cdFx0XHR0aGlzLmluaXRpYWxpemluZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5faW5pdGlhbGl6aW5nT3B0aW9ucyA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMub25TdGF0ZUNoYW5nZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY2FuY2VsVG9rZW5zKGlkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoaWQpIHtcblx0XHRcdGNvbnN0IHRva2VuID0gdGhpcy5zZXNzaW9uQ2FuY2VsbGF0aW9uVG9rZW5zLmdldChpZCk7XG5cdFx0XHRpZiAodG9rZW4pIHtcblx0XHRcdFx0dG9rZW4uY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMuc2Vzc2lvbkNhbmNlbGxhdGlvblRva2Vucy5kZWxldGUoaWQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNlc3Npb25DYW5jZWxsYXRpb25Ub2tlbnMuZm9yRWFjaCh0ID0+IHQuY2FuY2VsKCkpO1xuXHRcdFx0dGhpcy5zZXNzaW9uQ2FuY2VsbGF0aW9uVG9rZW5zLmNsZWFyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblN0YXRlQ2hhbmdlKCk6IHZvaWQge1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZTtcblx0XHRpZiAodGhpcy5wcmV2aW91c1N0YXRlICE9PSBzdGF0ZSkge1xuXHRcdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZS5idWZmZXJDaGFuZ2VFdmVudHMoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRlYnVnU3RhdGUuc2V0KGdldFN0YXRlTGFiZWwoc3RhdGUpKTtcblx0XHRcdFx0dGhpcy5pbkRlYnVnTW9kZS5zZXQoc3RhdGUgIT09IFN0YXRlLkluYWN0aXZlKTtcblx0XHRcdFx0Ly8gT25seSBzaG93IHRoZSBzaW1wbGUgdXggaWYgZGVidWcgaXMgbm90IHlldCBzdGFydGVkIGFuZCBpZiBubyBsYXVuY2guanNvbiBleGlzdHNcblx0XHRcdFx0Y29uc3QgZGVidWdVeFZhbHVlID0gKChzdGF0ZSAhPT0gU3RhdGUuSW5hY3RpdmUgJiYgc3RhdGUgIT09IFN0YXRlLkluaXRpYWxpemluZykgfHwgKHRoaXMuYWRhcHRlck1hbmFnZXIuaGFzRW5hYmxlZERlYnVnZ2VycygpICYmIHRoaXMuY29uZmlndXJhdGlvbk1hbmFnZXIuc2VsZWN0ZWRDb25maWd1cmF0aW9uLm5hbWUpKSA/ICdkZWZhdWx0JyA6ICdzaW1wbGUnO1xuXHRcdFx0XHR0aGlzLmRlYnVnVXguc2V0KGRlYnVnVXhWYWx1ZSk7XG5cdFx0XHRcdHRoaXMuZGVidWdTdG9yYWdlLnN0b3JlRGVidWdVeFN0YXRlKGRlYnVnVXhWYWx1ZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMucHJldmlvdXNTdGF0ZSA9IHN0YXRlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKHN0YXRlKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgb25EaWRDaGFuZ2VTdGF0ZSgpOiBFdmVudDxTdGF0ZT4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmV2ZW50O1xuXHR9XG5cblx0Z2V0IG9uRGlkTmV3U2Vzc2lvbigpOiBFdmVudDxJRGVidWdTZXNzaW9uPiB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkTmV3U2Vzc2lvbi5ldmVudDtcblx0fVxuXG5cdGdldCBvbldpbGxOZXdTZXNzaW9uKCk6IEV2ZW50PElEZWJ1Z1Nlc3Npb24+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25XaWxsTmV3U2Vzc2lvbi5ldmVudDtcblx0fVxuXG5cdGdldCBvbkRpZEVuZFNlc3Npb24oKTogRXZlbnQ8eyBzZXNzaW9uOiBJRGVidWdTZXNzaW9uOyByZXN0YXJ0OiBib29sZWFuIH0+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRFbmRTZXNzaW9uLmV2ZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBsYXp5U2V0dXAoKSB7XG5cdFx0aWYgKCF0aGlzLmhhdmVEb25lTGF6eVNldHVwKSB7XG5cdFx0XHQvLyBSZWdpc3RlcmluZyBmcyBwcm92aWRlcnMgaXMgc2xvd1xuXHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE1OTg4NlxuXHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5maWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKERFQlVHX01FTU9SWV9TQ0hFTUUsIHRoaXMuZGlzcG9zYWJsZXMuYWRkKG5ldyBEZWJ1Z01lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlcih0aGlzKSkpKTtcblx0XHRcdHRoaXMuaGF2ZURvbmVMYXp5U2V0dXAgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdC8vLS0tLSBsaWZlIGN5Y2xlIG1hbmFnZW1lbnRcblxuXHQvKipcblx0ICogbWFpbiBlbnRyeSBwb2ludFxuXHQgKiBwcm9wZXJseSBtYW5hZ2VzIGNvbXBvdW5kcywgY2hlY2tzIGZvciBlcnJvcnMgYW5kIGhhbmRsZXMgdGhlIGluaXRpYWxpemluZyBzdGF0ZS5cblx0ICovXG5cdGFzeW5jIHN0YXJ0RGVidWdnaW5nKGxhdW5jaDogSUxhdW5jaCB8IHVuZGVmaW5lZCwgY29uZmlnT3JOYW1lPzogSUNvbmZpZyB8IHN0cmluZywgb3B0aW9ucz86IElEZWJ1Z1Nlc3Npb25PcHRpb25zLCBzYXZlQmVmb3JlU3RhcnQgPSAhb3B0aW9ucz8ucGFyZW50U2Vzc2lvbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IG1lc3NhZ2UgPSBvcHRpb25zICYmIG9wdGlvbnMubm9EZWJ1ZyA/IG5scy5sb2NhbGl6ZSgncnVuVHJ1c3QnLCBcIlJ1bm5pbmcgZXhlY3V0ZXMgYnVpbGQgdGFza3MgYW5kIHByb2dyYW0gY29kZSBmcm9tIHlvdXIgd29ya3NwYWNlLlwiKSA6IG5scy5sb2NhbGl6ZSgnZGVidWdUcnVzdCcsIFwiRGVidWdnaW5nIGV4ZWN1dGVzIGJ1aWxkIHRhc2tzIGFuZCBwcm9ncmFtIGNvZGUgZnJvbSB5b3VyIHdvcmtzcGFjZS5cIik7XG5cdFx0Y29uc3QgdHJ1c3QgPSBhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UucmVxdWVzdFdvcmtzcGFjZVRydXN0KHsgbWVzc2FnZSB9KTtcblx0XHRpZiAoIXRydXN0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXp5U2V0dXAoKTtcblx0XHR0aGlzLnN0YXJ0SW5pdGlhbGl6aW5nU3RhdGUob3B0aW9ucyk7XG5cdFx0dGhpcy5oYXNEZWJ1Z2dlZC5zZXQodHJ1ZSk7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIG1ha2Ugc3VyZSB0byBzYXZlIGFsbCBmaWxlcyBhbmQgdGhhdCB0aGUgY29uZmlndXJhdGlvbiBpcyB1cCB0byBkYXRlXG5cdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGVCeUV2ZW50KCdvbkRlYnVnJyk7XG5cdFx0XHRpZiAoc2F2ZUJlZm9yZVN0YXJ0KSB7XG5cdFx0XHRcdGF3YWl0IHNhdmVBbGxCZWZvcmVEZWJ1Z1N0YXJ0KHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMuZWRpdG9yU2VydmljZSk7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cblx0XHRcdGxldCBjb25maWc6IElDb25maWcgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgY29tcG91bmQ6IElDb21wb3VuZCB8IHVuZGVmaW5lZDtcblx0XHRcdGlmICghY29uZmlnT3JOYW1lKSB7XG5cdFx0XHRcdGNvbmZpZ09yTmFtZSA9IHRoaXMuY29uZmlndXJhdGlvbk1hbmFnZXIuc2VsZWN0ZWRDb25maWd1cmF0aW9uLm5hbWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZW9mIGNvbmZpZ09yTmFtZSA9PT0gJ3N0cmluZycgJiYgbGF1bmNoKSB7XG5cdFx0XHRcdGNvbmZpZyA9IGxhdW5jaC5nZXRDb25maWd1cmF0aW9uKGNvbmZpZ09yTmFtZSk7XG5cdFx0XHRcdGNvbXBvdW5kID0gbGF1bmNoLmdldENvbXBvdW5kKGNvbmZpZ09yTmFtZSk7XG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBjb25maWdPck5hbWUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGNvbmZpZyA9IGNvbmZpZ09yTmFtZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNvbXBvdW5kKSB7XG5cdFx0XHRcdC8vIHdlIGFyZSBzdGFydGluZyBhIGNvbXBvdW5kIGRlYnVnLCBmaXJzdCBkbyBzb21lIGVycm9yIGNoZWNraW5nIGFuZCB0aGFuIHN0YXJ0IGVhY2ggY29uZmlndXJhdGlvbiBpbiB0aGUgY29tcG91bmRcblx0XHRcdFx0aWYgKCFjb21wb3VuZC5jb25maWd1cmF0aW9ucykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihubHMubG9jYWxpemUoeyBrZXk6ICdjb21wb3VuZE11c3RIYXZlQ29uZmlndXJhdGlvbnMnLCBjb21tZW50OiBbJ2NvbXBvdW5kIGluZGljYXRlcyBhIFwiY29tcG91bmRzXCIgY29uZmlndXJhdGlvbiBpdGVtJywgJ1wiY29uZmlndXJhdGlvbnNcIiBpcyBhbiBhdHRyaWJ1dGUgYW5kIHNob3VsZCBub3QgYmUgbG9jYWxpemVkJ10gfSxcblx0XHRcdFx0XHRcdFwiQ29tcG91bmQgbXVzdCBoYXZlIFxcXCJjb25maWd1cmF0aW9uc1xcXCIgYXR0cmlidXRlIHNldCBpbiBvcmRlciB0byBzdGFydCBtdWx0aXBsZSBjb25maWd1cmF0aW9ucy5cIikpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChjb21wb3VuZC5wcmVMYXVuY2hUYXNrKSB7XG5cdFx0XHRcdFx0Y29uc3QgdGFza1Jlc3VsdCA9IGF3YWl0IHRoaXMudGFza1J1bm5lci5ydW5UYXNrQW5kQ2hlY2tFcnJvcnMobGF1bmNoPy53b3Jrc3BhY2UgfHwgdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKSwgY29tcG91bmQucHJlTGF1bmNoVGFzayk7XG5cdFx0XHRcdFx0aWYgKHRhc2tSZXN1bHQgPT09IFRhc2tSdW5SZXN1bHQuRmFpbHVyZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5lbmRJbml0aWFsaXppbmdTdGF0ZSgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoY29tcG91bmQuc3RvcEFsbCkge1xuXHRcdFx0XHRcdG9wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIGNvbXBvdW5kUm9vdDogbmV3IERlYnVnQ29tcG91bmRSb290KCkgfTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHZhbHVlcyA9IGF3YWl0IFByb21pc2UuYWxsKGNvbXBvdW5kLmNvbmZpZ3VyYXRpb25zLm1hcChjb25maWdEYXRhID0+IHtcblx0XHRcdFx0XHRjb25zdCBuYW1lID0gdHlwZW9mIGNvbmZpZ0RhdGEgPT09ICdzdHJpbmcnID8gY29uZmlnRGF0YSA6IGNvbmZpZ0RhdGEubmFtZTtcblx0XHRcdFx0XHRpZiAobmFtZSA9PT0gY29tcG91bmQubmFtZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bGV0IGxhdW5jaEZvck5hbWU6IElMYXVuY2ggfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBjb25maWdEYXRhID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGF1bmNoZXNDb250YWluaW5nTmFtZSA9IHRoaXMuY29uZmlndXJhdGlvbk1hbmFnZXIuZ2V0TGF1bmNoZXMoKS5maWx0ZXIobCA9PiAhIWwuZ2V0Q29uZmlndXJhdGlvbihuYW1lKSk7XG5cdFx0XHRcdFx0XHRpZiAobGF1bmNoZXNDb250YWluaW5nTmFtZS5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHRcdFx0bGF1bmNoRm9yTmFtZSA9IGxhdW5jaGVzQ29udGFpbmluZ05hbWVbMF07XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGxhdW5jaCAmJiBsYXVuY2hlc0NvbnRhaW5pbmdOYW1lLmxlbmd0aCA+IDEgJiYgbGF1bmNoZXNDb250YWluaW5nTmFtZS5pbmRleE9mKGxhdW5jaCkgPj0gMCkge1xuXHRcdFx0XHRcdFx0XHQvLyBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgbGF1bmNoZXMgY29udGFpbmluZyB0aGUgY29uZmlndXJhdGlvbiBnaXZlIHByaW9yaXR5IHRvIHRoZSBjb25maWd1cmF0aW9uIGluIHRoZSBjdXJyZW50IGxhdW5jaFxuXHRcdFx0XHRcdFx0XHRsYXVuY2hGb3JOYW1lID0gbGF1bmNoO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGxhdW5jaGVzQ29udGFpbmluZ05hbWUubGVuZ3RoID09PSAwID8gbmxzLmxvY2FsaXplKCdub0NvbmZpZ3VyYXRpb25OYW1lSW5Xb3Jrc3BhY2UnLCBcIkNvdWxkIG5vdCBmaW5kIGxhdW5jaCBjb25maWd1cmF0aW9uICd7MH0nIGluIHRoZSB3b3Jrc3BhY2UuXCIsIG5hbWUpXG5cdFx0XHRcdFx0XHRcdFx0OiBubHMubG9jYWxpemUoJ211bHRpcGxlQ29uZmlndXJhdGlvbk5hbWVzSW5Xb3Jrc3BhY2UnLCBcIlRoZXJlIGFyZSBtdWx0aXBsZSBsYXVuY2ggY29uZmlndXJhdGlvbnMgJ3swfScgaW4gdGhlIHdvcmtzcGFjZS4gVXNlIGZvbGRlciBuYW1lIHRvIHF1YWxpZnkgdGhlIGNvbmZpZ3VyYXRpb24uXCIsIG5hbWUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2UgaWYgKGNvbmZpZ0RhdGEuZm9sZGVyKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBsYXVuY2hlc01hdGNoaW5nQ29uZmlnRGF0YSA9IHRoaXMuY29uZmlndXJhdGlvbk1hbmFnZXIuZ2V0TGF1bmNoZXMoKS5maWx0ZXIobCA9PiBsLndvcmtzcGFjZSAmJiBsLndvcmtzcGFjZS5uYW1lID09PSBjb25maWdEYXRhLmZvbGRlciAmJiAhIWwuZ2V0Q29uZmlndXJhdGlvbihjb25maWdEYXRhLm5hbWUpKTtcblx0XHRcdFx0XHRcdGlmIChsYXVuY2hlc01hdGNoaW5nQ29uZmlnRGF0YS5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHRcdFx0bGF1bmNoRm9yTmFtZSA9IGxhdW5jaGVzTWF0Y2hpbmdDb25maWdEYXRhWzBdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnbm9Gb2xkZXJXaXRoTmFtZScsIFwiQ2FuIG5vdCBmaW5kIGZvbGRlciB3aXRoIG5hbWUgJ3swfScgZm9yIGNvbmZpZ3VyYXRpb24gJ3sxfScgaW4gY29tcG91bmQgJ3syfScuXCIsIGNvbmZpZ0RhdGEuZm9sZGVyLCBjb25maWdEYXRhLm5hbWUsIGNvbXBvdW5kLm5hbWUpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVTZXNzaW9uKGxhdW5jaEZvck5hbWUsIGxhdW5jaEZvck5hbWUhLmdldENvbmZpZ3VyYXRpb24obmFtZSksIG9wdGlvbnMpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gdmFsdWVzLmV2ZXJ5KHN1Y2Nlc3MgPT4gISFzdWNjZXNzKTsgLy8gQ29tcG91bmQgbGF1bmNoIGlzIGEgc3VjY2VzcyBvbmx5IGlmIGVhY2ggY29uZmlndXJhdGlvbiBsYXVuY2hlZCBzdWNjZXNzZnVsbHlcblx0XHRcdFx0dGhpcy5lbmRJbml0aWFsaXppbmdTdGF0ZSgpO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY29uZmlnT3JOYW1lICYmICFjb25maWcpIHtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9ICEhbGF1bmNoID8gbmxzLmxvY2FsaXplKCdjb25maWdNaXNzaW5nJywgXCJDb25maWd1cmF0aW9uICd7MH0nIGlzIG1pc3NpbmcgaW4gJ2xhdW5jaC5qc29uJy5cIiwgdHlwZW9mIGNvbmZpZ09yTmFtZSA9PT0gJ3N0cmluZycgPyBjb25maWdPck5hbWUgOiBjb25maWdPck5hbWUubmFtZSkgOlxuXHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnbGF1bmNoSnNvbkRvZXNOb3RFeGlzdCcsIFwiJ2xhdW5jaC5qc29uJyBkb2VzIG5vdCBleGlzdCBmb3IgcGFzc2VkIHdvcmtzcGFjZSBmb2xkZXIuXCIpO1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY3JlYXRlU2Vzc2lvbihsYXVuY2gsIGNvbmZpZywgb3B0aW9ucyk7XG5cdFx0XHR0aGlzLmVuZEluaXRpYWxpemluZ1N0YXRlKCk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0Ly8gbWFrZSBzdXJlIHRvIGdldCBvdXQgb2YgaW5pdGlhbGl6aW5nIHN0YXRlLCBhbmQgcHJvcGFnYXRlIHRoZSByZXN1bHRcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0dGhpcy5lbmRJbml0aWFsaXppbmdTdGF0ZSgpO1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIGdldHMgdGhlIGRlYnVnZ2VyIGZvciB0aGUgdHlwZSwgcmVzb2x2ZXMgY29uZmlndXJhdGlvbnMgYnkgcHJvdmlkZXJzLCBzdWJzdGl0dXRlcyB2YXJpYWJsZXMgYW5kIHJ1bnMgcHJlbGF1bmNoIHRhc2tzXG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZVNlc3Npb24obGF1bmNoOiBJTGF1bmNoIHwgdW5kZWZpbmVkLCBjb25maWc6IElDb25maWcgfCB1bmRlZmluZWQsIG9wdGlvbnM/OiBJRGVidWdTZXNzaW9uT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdC8vIFdlIGtlZXAgdGhlIGRlYnVnIHR5cGUgaW4gYSBzZXBhcmF0ZSB2YXJpYWJsZSAndHlwZScgc28gdGhhdCBhIG5vLWZvbGRlciBjb25maWcgaGFzIG5vIGF0dHJpYnV0ZXMuXG5cdFx0Ly8gU3RvcmluZyB0aGUgdHlwZSBpbiB0aGUgY29uZmlnIHdvdWxkIGJyZWFrIGV4dGVuc2lvbnMgdGhhdCBhc3N1bWUgdGhhdCB0aGUgbm8tZm9sZGVyIGNhc2UgaXMgaW5kaWNhdGVkIGJ5IGFuIGVtcHR5IGNvbmZpZy5cblx0XHRsZXQgdHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChjb25maWcpIHtcblx0XHRcdHR5cGUgPSBjb25maWcudHlwZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gYSBuby1mb2xkZXIgd29ya3NwYWNlIGhhcyBubyBsYXVuY2guY29uZmlnXG5cdFx0XHRjb25maWcgPSBPYmplY3QuY3JlYXRlKG51bGwpIGFzIElDb25maWc7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zICYmIG9wdGlvbnMubm9EZWJ1Zykge1xuXHRcdFx0Y29uZmlnLm5vRGVidWcgPSB0cnVlO1xuXHRcdH0gZWxzZSBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5ub0RlYnVnID09PSAndW5kZWZpbmVkJyAmJiBvcHRpb25zLnBhcmVudFNlc3Npb24gJiYgb3B0aW9ucy5wYXJlbnRTZXNzaW9uLmNvbmZpZ3VyYXRpb24ubm9EZWJ1Zykge1xuXHRcdFx0Y29uZmlnLm5vRGVidWcgPSB0cnVlO1xuXHRcdH1cblx0XHRjb25zdCB1bnJlc29sdmVkQ29uZmlnID0gZGVlcENsb25lKGNvbmZpZyk7XG5cblx0XHRsZXQgZ3Vlc3M6IElHdWVzc2VkRGVidWdnZXIgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGFjdGl2ZUVkaXRvcjogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKCF0eXBlKSB7XG5cdFx0XHRhY3RpdmVFZGl0b3IgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yO1xuXHRcdFx0aWYgKGFjdGl2ZUVkaXRvciAmJiBhY3RpdmVFZGl0b3IucmVzb3VyY2UpIHtcblx0XHRcdFx0Y29uc3QgY2hvc2VuID0gdGhpcy5jaG9zZW5FbnZpcm9ubWVudHNbYWN0aXZlRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCldO1xuXHRcdFx0XHRpZiAoY2hvc2VuKSB7XG5cdFx0XHRcdFx0dHlwZSA9IGNob3Nlbi50eXBlO1xuXHRcdFx0XHRcdGlmIChjaG9zZW4uZHluYW1pY0xhYmVsKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBkeW4gPSBhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25NYW5hZ2VyLmdldER5bmFtaWNDb25maWd1cmF0aW9uc0J5VHlwZShjaG9zZW4udHlwZSk7XG5cdFx0XHRcdFx0XHRjb25zdCBmb3VuZCA9IGR5bi5maW5kKGQgPT4gZC5sYWJlbCA9PT0gY2hvc2VuLmR5bmFtaWNMYWJlbCk7XG5cdFx0XHRcdFx0XHRpZiAoZm91bmQpIHtcblx0XHRcdFx0XHRcdFx0bGF1bmNoID0gZm91bmQubGF1bmNoO1xuXHRcdFx0XHRcdFx0XHRPYmplY3QuYXNzaWduKGNvbmZpZywgZm91bmQuY29uZmlnKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0eXBlKSB7XG5cdFx0XHRcdGd1ZXNzID0gYXdhaXQgdGhpcy5hZGFwdGVyTWFuYWdlci5ndWVzc0RlYnVnZ2VyKGZhbHNlKTtcblx0XHRcdFx0aWYgKGd1ZXNzKSB7XG5cdFx0XHRcdFx0dHlwZSA9IGd1ZXNzLmRlYnVnZ2VyLnR5cGU7XG5cdFx0XHRcdFx0aWYgKGd1ZXNzLndpdGhDb25maWcpIHtcblx0XHRcdFx0XHRcdGxhdW5jaCA9IGd1ZXNzLndpdGhDb25maWcubGF1bmNoO1xuXHRcdFx0XHRcdFx0T2JqZWN0LmFzc2lnbihjb25maWcsIGd1ZXNzLndpdGhDb25maWcuY29uZmlnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBpbml0Q2FuY2VsbGF0aW9uVG9rZW4gPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBnZW5lcmF0ZVV1aWQoKTtcblx0XHR0aGlzLnNlc3Npb25DYW5jZWxsYXRpb25Ub2tlbnMuc2V0KHNlc3Npb25JZCwgaW5pdENhbmNlbGxhdGlvblRva2VuKTtcblxuXHRcdGNvbnN0IGNvbmZpZ0J5UHJvdmlkZXJzID0gYXdhaXQgdGhpcy5jb25maWd1cmF0aW9uTWFuYWdlci5yZXNvbHZlQ29uZmlndXJhdGlvbkJ5UHJvdmlkZXJzKGxhdW5jaCAmJiBsYXVuY2gud29ya3NwYWNlID8gbGF1bmNoLndvcmtzcGFjZS51cmkgOiB1bmRlZmluZWQsIHR5cGUsIGNvbmZpZywgaW5pdENhbmNlbGxhdGlvblRva2VuLnRva2VuKTtcblx0XHQvLyBhIGZhbHN5IGNvbmZpZyBpbmRpY2F0ZXMgYW4gYWJvcnRlZCBsYXVuY2hcblx0XHRpZiAoY29uZmlnQnlQcm92aWRlcnMgJiYgY29uZmlnQnlQcm92aWRlcnMudHlwZSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bGV0IHJlc29sdmVkQ29uZmlnID0gYXdhaXQgdGhpcy5zdWJzdGl0dXRlVmFyaWFibGVzKGxhdW5jaCwgY29uZmlnQnlQcm92aWRlcnMpO1xuXHRcdFx0XHRpZiAoIXJlc29sdmVkQ29uZmlnKSB7XG5cdFx0XHRcdFx0Ly8gVXNlciBjYW5jZWxsZWQgcmVzb2x2aW5nIG9mIGludGVyYWN0aXZlIHZhcmlhYmxlcywgc2lsZW50bHkgcmV0dXJuXG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGluaXRDYW5jZWxsYXRpb25Ub2tlbi50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdC8vIFVzZXIgY2FuY2VsbGVkLCBzaWxlbnRseSByZXR1cm5cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB3b3Jrc3BhY2UgPSBsYXVuY2g/LndvcmtzcGFjZSB8fCB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXHRcdFx0XHRjb25zdCB0YXNrUmVzdWx0ID0gYXdhaXQgdGhpcy50YXNrUnVubmVyLnJ1blRhc2tBbmRDaGVja0Vycm9ycyh3b3Jrc3BhY2UsIHJlc29sdmVkQ29uZmlnLnByZUxhdW5jaFRhc2spO1xuXHRcdFx0XHRpZiAodGFza1Jlc3VsdCA9PT0gVGFza1J1blJlc3VsdC5GYWlsdXJlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY2ZnID0gYXdhaXQgdGhpcy5jb25maWd1cmF0aW9uTWFuYWdlci5yZXNvbHZlRGVidWdDb25maWd1cmF0aW9uV2l0aFN1YnN0aXR1dGVkVmFyaWFibGVzKGxhdW5jaCAmJiBsYXVuY2gud29ya3NwYWNlID8gbGF1bmNoLndvcmtzcGFjZS51cmkgOiB1bmRlZmluZWQsIHJlc29sdmVkQ29uZmlnLnR5cGUsIHJlc29sdmVkQ29uZmlnLCBpbml0Q2FuY2VsbGF0aW9uVG9rZW4udG9rZW4pO1xuXHRcdFx0XHRpZiAoIWNmZykge1xuXHRcdFx0XHRcdGlmIChsYXVuY2ggJiYgdHlwZSAmJiBjZmcgPT09IG51bGwgJiYgIWluaXRDYW5jZWxsYXRpb25Ub2tlbi50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1x0Ly8gc2hvdyBsYXVuY2guanNvbiBvbmx5IGZvciBcImNvbmZpZ1wiIGJlaW5nIFwibnVsbFwiLlxuXHRcdFx0XHRcdFx0YXdhaXQgbGF1bmNoLm9wZW5Db25maWdGaWxlKHsgcHJlc2VydmVGb2N1czogdHJ1ZSwgdHlwZSB9LCBpbml0Q2FuY2VsbGF0aW9uVG9rZW4udG9rZW4pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzb2x2ZWRDb25maWcgPSBjZmc7XG5cblx0XHRcdFx0Y29uc3QgZGJnID0gdGhpcy5hZGFwdGVyTWFuYWdlci5nZXREZWJ1Z2dlcihyZXNvbHZlZENvbmZpZy50eXBlKTtcblx0XHRcdFx0aWYgKCFkYmcgfHwgKGNvbmZpZ0J5UHJvdmlkZXJzLnJlcXVlc3QgIT09ICdhdHRhY2gnICYmIGNvbmZpZ0J5UHJvdmlkZXJzLnJlcXVlc3QgIT09ICdsYXVuY2gnKSkge1xuXHRcdFx0XHRcdGxldCBtZXNzYWdlOiBzdHJpbmc7XG5cdFx0XHRcdFx0aWYgKGNvbmZpZ0J5UHJvdmlkZXJzLnJlcXVlc3QgIT09ICdhdHRhY2gnICYmIGNvbmZpZ0J5UHJvdmlkZXJzLnJlcXVlc3QgIT09ICdsYXVuY2gnKSB7XG5cdFx0XHRcdFx0XHRtZXNzYWdlID0gY29uZmlnQnlQcm92aWRlcnMucmVxdWVzdCA/IG5scy5sb2NhbGl6ZSgnZGVidWdSZXF1ZXN0Tm90U3VwcG9ydGVkJywgXCJBdHRyaWJ1dGUgJ3swfScgaGFzIGFuIHVuc3VwcG9ydGVkIHZhbHVlICd7MX0nIGluIHRoZSBjaG9zZW4gZGVidWcgY29uZmlndXJhdGlvbi5cIiwgJ3JlcXVlc3QnLCBjb25maWdCeVByb3ZpZGVycy5yZXF1ZXN0KVxuXHRcdFx0XHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSgnZGVidWdSZXF1ZXNNaXNzaW5nJywgXCJBdHRyaWJ1dGUgJ3swfScgaXMgbWlzc2luZyBmcm9tIHRoZSBjaG9zZW4gZGVidWcgY29uZmlndXJhdGlvbi5cIiwgJ3JlcXVlc3QnKTtcblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRtZXNzYWdlID0gcmVzb2x2ZWRDb25maWcudHlwZSA/IG5scy5sb2NhbGl6ZSgnZGVidWdUeXBlTm90U3VwcG9ydGVkJywgXCJDb25maWd1cmVkIGRlYnVnIHR5cGUgJ3swfScgaXMgbm90IHN1cHBvcnRlZC5cIiwgcmVzb2x2ZWRDb25maWcudHlwZSkgOlxuXHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2RlYnVnVHlwZU1pc3NpbmcnLCBcIk1pc3NpbmcgcHJvcGVydHkgJ3R5cGUnIGZvciB0aGUgY2hvc2VuIGxhdW5jaCBjb25maWd1cmF0aW9uLlwiKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBhY3Rpb25MaXN0OiBJQWN0aW9uW10gPSBbXTtcblxuXHRcdFx0XHRcdGFjdGlvbkxpc3QucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHRcdFx0J2luc3RhbGxBZGRpdGlvbmFsRGVidWdnZXJzJyxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSh7IGtleTogJ2luc3RhbGxBZGRpdGlvbmFsRGVidWdnZXJzJywgY29tbWVudDogWydQbGFjZWhvbGRlciBpcyB0aGUgZGVidWcgdHlwZSwgc28gZm9yIGV4YW1wbGUgXCJub2RlXCIsIFwicHl0aG9uXCInXSB9LCBcIkluc3RhbGwgezB9IEV4dGVuc2lvblwiLCByZXNvbHZlZENvbmZpZy50eXBlKSxcblx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdHRydWUsXG5cdFx0XHRcdFx0XHRhc3luYyAoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdkZWJ1Zy5pbnN0YWxsQWRkaXRpb25hbERlYnVnZ2VycycsIHJlc29sdmVkQ29uZmlnPy50eXBlKVxuXHRcdFx0XHRcdCkpO1xuXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5zaG93RXJyb3IobWVzc2FnZSwgYWN0aW9uTGlzdCk7XG5cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWRiZy5lbmFibGVkKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5zaG93RXJyb3IoZGVidWdnZXJEaXNhYmxlZE1lc3NhZ2UoZGJnLnR5cGUpLCBbXSk7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kb0NyZWF0ZVNlc3Npb24oc2Vzc2lvbklkLCBsYXVuY2g/LndvcmtzcGFjZSwgeyByZXNvbHZlZDogcmVzb2x2ZWRDb25maWcsIHVucmVzb2x2ZWQ6IHVucmVzb2x2ZWRDb25maWcgfSwgb3B0aW9ucyk7XG5cdFx0XHRcdGlmIChyZXN1bHQgJiYgZ3Vlc3MgJiYgYWN0aXZlRWRpdG9yICYmIGFjdGl2ZUVkaXRvci5yZXNvdXJjZSkge1xuXHRcdFx0XHRcdC8vIFJlbWViZXIgdXNlciBjaG9pY2Ugb2YgZW52aXJvbm1lbnQgcGVyIGFjdGl2ZSBlZGl0b3IgdG8gbWFrZSBzdGFydGluZyBkZWJ1Z2dpbmcgc21vb3RoZXIgIzEyNDc3MFxuXHRcdFx0XHRcdHRoaXMuY2hvc2VuRW52aXJvbm1lbnRzW2FjdGl2ZUVkaXRvci5yZXNvdXJjZS50b1N0cmluZygpXSA9IHsgdHlwZTogZ3Vlc3MuZGVidWdnZXIudHlwZSwgZHluYW1pY0xhYmVsOiBndWVzcy53aXRoQ29uZmlnPy5sYWJlbCB9O1xuXHRcdFx0XHRcdHRoaXMuZGVidWdTdG9yYWdlLnN0b3JlQ2hvc2VuRW52aXJvbm1lbnRzKHRoaXMuY2hvc2VuRW52aXJvbm1lbnRzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGlmIChlcnIgJiYgZXJyLm1lc3NhZ2UpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnNob3dFcnJvcihlcnIubWVzc2FnZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuc2hvd0Vycm9yKG5scy5sb2NhbGl6ZSgnbm9Gb2xkZXJXb3Jrc3BhY2VEZWJ1Z0Vycm9yJywgXCJUaGUgYWN0aXZlIGZpbGUgY2FuIG5vdCBiZSBkZWJ1Z2dlZC4gTWFrZSBzdXJlIGl0IGlzIHNhdmVkIGFuZCB0aGF0IHlvdSBoYXZlIGEgZGVidWcgZXh0ZW5zaW9uIGluc3RhbGxlZCBmb3IgdGhhdCBmaWxlIHR5cGUuXCIpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobGF1bmNoICYmICFpbml0Q2FuY2VsbGF0aW9uVG9rZW4udG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRhd2FpdCBsYXVuY2gub3BlbkNvbmZpZ0ZpbGUoeyBwcmVzZXJ2ZUZvY3VzOiB0cnVlIH0sIGluaXRDYW5jZWxsYXRpb25Ub2tlbi50b2tlbik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGxhdW5jaCAmJiB0eXBlICYmIGNvbmZpZ0J5UHJvdmlkZXJzID09PSBudWxsICYmICFpbml0Q2FuY2VsbGF0aW9uVG9rZW4udG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcdC8vIHNob3cgbGF1bmNoLmpzb24gb25seSBmb3IgXCJjb25maWdcIiBiZWluZyBcIm51bGxcIi5cblx0XHRcdGF3YWl0IGxhdW5jaC5vcGVuQ29uZmlnRmlsZSh7IHByZXNlcnZlRm9jdXM6IHRydWUsIHR5cGUgfSwgaW5pdENhbmNlbGxhdGlvblRva2VuLnRva2VuKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHQvKipcblx0ICogaW5zdGFudGlhdGVzIHRoZSBuZXcgc2Vzc2lvbiwgaW5pdGlhbGl6ZXMgdGhlIHNlc3Npb24sIHJlZ2lzdGVycyBzZXNzaW9uIGxpc3RlbmVycyBhbmQgcmVwb3J0cyB0ZWxlbWV0cnlcblx0ICovXG5cdHByaXZhdGUgYXN5bmMgZG9DcmVhdGVTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nLCByb290OiBJV29ya3NwYWNlRm9sZGVyIHwgdW5kZWZpbmVkLCBjb25maWd1cmF0aW9uOiB7IHJlc29sdmVkOiBJQ29uZmlnOyB1bnJlc29sdmVkOiBJQ29uZmlnIHwgdW5kZWZpbmVkIH0sIG9wdGlvbnM/OiBJRGVidWdTZXNzaW9uT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGVidWdTZXNzaW9uLCBzZXNzaW9uSWQsIGNvbmZpZ3VyYXRpb24sIHJvb3QsIHRoaXMubW9kZWwsIG9wdGlvbnMpO1xuXHRcdGlmIChvcHRpb25zPy5zdGFydGVkQnlVc2VyICYmIHRoaXMubW9kZWwuZ2V0U2Vzc2lvbnMoKS5zb21lKHMgPT4gcy5nZXRMYWJlbCgpID09PSBzZXNzaW9uLmdldExhYmVsKCkpICYmIGNvbmZpZ3VyYXRpb24ucmVzb2x2ZWQuc3VwcHJlc3NNdWx0aXBsZVNlc3Npb25XYXJuaW5nICE9PSB0cnVlKSB7XG5cdFx0XHQvLyBUaGVyZSBpcyBhbHJlYWR5IGEgc2Vzc2lvbiB3aXRoIHRoZSBzYW1lIG5hbWUsIHByb21wdCB1c2VyICMxMjc3MjFcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5jb25maXJtKHsgbWVzc2FnZTogbmxzLmxvY2FsaXplKCdtdWx0aXBsZVNlc3Npb24nLCBcIid7MH0nIGlzIGFscmVhZHkgcnVubmluZy4gRG8geW91IHdhbnQgdG8gc3RhcnQgYW5vdGhlciBpbnN0YW5jZT9cIiwgc2Vzc2lvbi5nZXRMYWJlbCgpKSB9KTtcblx0XHRcdGlmICghcmVzdWx0LmNvbmZpcm1lZCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5tb2RlbC5hZGRTZXNzaW9uKHNlc3Npb24pO1xuXG5cdFx0Ly8gc2luY2UgdGhlIFNlc3Npb24gaXMgbm93IHByb3Blcmx5IHJlZ2lzdGVyZWQgdW5kZXIgaXRzIElEIGFuZCBob29rZWQsIHdlIGNhbiBhbm5vdW5jZSBpdFxuXHRcdC8vIHRoaXMgZXZlbnQgZG9lc24ndCBnbyB0byBleHRlbnNpb25zXG5cdFx0dGhpcy5fb25XaWxsTmV3U2Vzc2lvbi5maXJlKHNlc3Npb24pO1xuXG5cdFx0Y29uc3Qgb3BlbkRlYnVnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKS5vcGVuRGVidWc7XG5cdFx0Ly8gT3BlbiBkZWJ1ZyB2aWV3bGV0IGJhc2VkIG9uIHRoZSB2aXNpYmlsaXR5IG9mIHRoZSBzaWRlIGJhciBhbmQgb3BlbkRlYnVnIHNldHRpbmcuIERvIG5vdCBvcGVuIGZvciAncnVuIHdpdGhvdXQgZGVidWcnXG5cdFx0aWYgKCFjb25maWd1cmF0aW9uLnJlc29sdmVkLm5vRGVidWcgJiYgKG9wZW5EZWJ1ZyA9PT0gJ29wZW5PblNlc3Npb25TdGFydCcgfHwgKG9wZW5EZWJ1ZyAhPT0gJ25ldmVyT3BlbicgJiYgdGhpcy52aWV3TW9kZWwuZmlyc3RTZXNzaW9uU3RhcnQpKSAmJiAhc2Vzc2lvbi5zdXBwcmVzc0RlYnVnVmlldykge1xuXHRcdFx0YXdhaXQgdGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZShWSUVXTEVUX0lELCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMubGF1bmNoT3JBdHRhY2hUb1Nlc3Npb24oc2Vzc2lvbik7XG5cblx0XHRcdGNvbnN0IGludGVybmFsQ29uc29sZU9wdGlvbnMgPSBzZXNzaW9uLmNvbmZpZ3VyYXRpb24uaW50ZXJuYWxDb25zb2xlT3B0aW9ucyB8fCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLmludGVybmFsQ29uc29sZU9wdGlvbnM7XG5cdFx0XHRpZiAoaW50ZXJuYWxDb25zb2xlT3B0aW9ucyA9PT0gJ29wZW5PblNlc3Npb25TdGFydCcgfHwgKHRoaXMudmlld01vZGVsLmZpcnN0U2Vzc2lvblN0YXJ0ICYmIGludGVybmFsQ29uc29sZU9wdGlvbnMgPT09ICdvcGVuT25GaXJzdFNlc3Npb25TdGFydCcpKSB7XG5cdFx0XHRcdHRoaXMudmlld3NTZXJ2aWNlLm9wZW5WaWV3KFJFUExfVklFV19JRCwgZmFsc2UpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnZpZXdNb2RlbC5maXJzdFNlc3Npb25TdGFydCA9IGZhbHNlO1xuXHRcdFx0Y29uc3Qgc2hvd1N1YlNlc3Npb25zID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKS5zaG93U3ViU2Vzc2lvbnNJblRvb2xCYXI7XG5cdFx0XHRjb25zdCBzZXNzaW9ucyA9IHRoaXMubW9kZWwuZ2V0U2Vzc2lvbnMoKTtcblx0XHRcdGNvbnN0IHNob3duU2Vzc2lvbnMgPSBzaG93U3ViU2Vzc2lvbnMgPyBzZXNzaW9ucyA6IHNlc3Npb25zLmZpbHRlcihzID0+ICFzLnBhcmVudFNlc3Npb24pO1xuXHRcdFx0aWYgKHNob3duU2Vzc2lvbnMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHR0aGlzLnZpZXdNb2RlbC5zZXRNdWx0aVNlc3Npb25WaWV3KHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBzaW5jZSB0aGUgaW5pdGlhbGl6ZWQgcmVzcG9uc2UgaGFzIGFycml2ZWQgYW5ub3VuY2UgdGhlIG5ldyBTZXNzaW9uIChpbmNsdWRpbmcgZXh0ZW5zaW9ucylcblx0XHRcdHRoaXMuX29uRGlkTmV3U2Vzc2lvbi5maXJlKHNlc3Npb24pO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXG5cdFx0XHRpZiAoZXJyb3JzLmlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRcdC8vIGRvbid0IHNob3cgJ2NhbmNlbGVkJyBlcnJvciBtZXNzYWdlcyB0byB0aGUgdXNlciAjNzkwNlxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNob3cgdGhlIHJlcGwgaWYgc29tZSBlcnJvciBnb3QgbG9nZ2VkIHRoZXJlICM1ODcwXG5cdFx0XHRpZiAoc2Vzc2lvbiAmJiBzZXNzaW9uLmdldFJlcGxFbGVtZW50cygpLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy52aWV3c1NlcnZpY2Uub3BlblZpZXcoUkVQTF9WSUVXX0lELCBmYWxzZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzZXNzaW9uLmNvbmZpZ3VyYXRpb24gJiYgc2Vzc2lvbi5jb25maWd1cmF0aW9uLnJlcXVlc3QgPT09ICdhdHRhY2gnICYmIHNlc3Npb24uY29uZmlndXJhdGlvbi5fX2F1dG9BdHRhY2gpIHtcblx0XHRcdFx0Ly8gaWdub3JlIGF0dGFjaCB0aW1lb3V0cyBpbiBhdXRvIGF0dGFjaCBtb2RlXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvcjtcblx0XHRcdGlmIChlcnJvci5zaG93VXNlciAhPT0gZmFsc2UpIHtcblx0XHRcdFx0Ly8gT25seSBzaG93IHRoZSBlcnJvciB3aGVuIHNob3dVc2VyIGlzIGVpdGhlciBub3QgZGVmaW5lZCwgb3IgaXMgdHJ1ZSAjMTI4NDg0XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2hvd0Vycm9yKGVycm9yTWVzc2FnZSwgaXNFcnJvcldpdGhBY3Rpb25zKGVycm9yKSA/IGVycm9yLmFjdGlvbnMgOiBbXSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBsYXVuY2hPckF0dGFjaFRvU2Vzc2lvbihzZXNzaW9uOiBJRGVidWdTZXNzaW9uLCBmb3JjZUZvY3VzID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyByZWdpc3RlciBsaXN0ZW5lcnMgYXMgdGhlIHZlcnkgZmlyc3QgdGhpbmchXG5cdFx0dGhpcy5yZWdpc3RlclNlc3Npb25MaXN0ZW5lcnMoc2Vzc2lvbik7XG5cblx0XHRjb25zdCBkYmdyID0gdGhpcy5hZGFwdGVyTWFuYWdlci5nZXREZWJ1Z2dlcihzZXNzaW9uLmNvbmZpZ3VyYXRpb24udHlwZSk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHNlc3Npb24uaW5pdGlhbGl6ZShkYmdyISk7XG5cdFx0XHRhd2FpdCBzZXNzaW9uLmxhdW5jaE9yQXR0YWNoKHNlc3Npb24uY29uZmlndXJhdGlvbik7XG5cdFx0XHRjb25zdCBsYXVuY2hKc29uRXhpc3RzID0gISFzZXNzaW9uLnJvb3QgJiYgISF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElHbG9iYWxDb25maWc+KCdsYXVuY2gnLCB7IHJlc291cmNlOiBzZXNzaW9uLnJvb3QudXJpIH0pO1xuXHRcdFx0YXdhaXQgdGhpcy50ZWxlbWV0cnkubG9nRGVidWdTZXNzaW9uU3RhcnQoZGJnciEsIGxhdW5jaEpzb25FeGlzdHMpO1xuXG5cdFx0XHRpZiAoZm9yY2VGb2N1cyB8fCAhdGhpcy52aWV3TW9kZWwuZm9jdXNlZFNlc3Npb24gfHwgKHNlc3Npb24ucGFyZW50U2Vzc2lvbiA9PT0gdGhpcy52aWV3TW9kZWwuZm9jdXNlZFNlc3Npb24gJiYgc2Vzc2lvbi5jb21wYWN0KSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmZvY3VzU3RhY2tGcmFtZSh1bmRlZmluZWQsIHVuZGVmaW5lZCwgc2Vzc2lvbik7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRpZiAodGhpcy52aWV3TW9kZWwuZm9jdXNlZFNlc3Npb24gPT09IHNlc3Npb24pIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5mb2N1c1N0YWNrRnJhbWUodW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJTZXNzaW9uTGlzdGVuZXJzKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24pOiB2b2lkIHtcblx0XHRjb25zdCBsaXN0ZW5lckRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGxpc3RlbmVyRGlzcG9zYWJsZXMpO1xuXG5cdFx0Y29uc3Qgc2Vzc2lvblJ1bm5pbmdTY2hlZHVsZXIgPSBsaXN0ZW5lckRpc3Bvc2FibGVzLmFkZChuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHQvLyBEbyBub3QgaW1tZWRpYXRseSBkZWZvY3VzIHRoZSBzdGFjayBmcmFtZSBpZiB0aGUgc2Vzc2lvbiBpcyBydW5uaW5nXG5cdFx0XHRpZiAoc2Vzc2lvbi5zdGF0ZSA9PT0gU3RhdGUuUnVubmluZyAmJiB0aGlzLnZpZXdNb2RlbC5mb2N1c2VkU2Vzc2lvbiA9PT0gc2Vzc2lvbikge1xuXHRcdFx0XHR0aGlzLnZpZXdNb2RlbC5zZXRGb2N1cyh1bmRlZmluZWQsIHRoaXMudmlld01vZGVsLmZvY3VzZWRUaHJlYWQsIHNlc3Npb24sIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9LCAyMDApKTtcblx0XHRsaXN0ZW5lckRpc3Bvc2FibGVzLmFkZChzZXNzaW9uLm9uRGlkQ2hhbmdlU3RhdGUoKCkgPT4ge1xuXHRcdFx0aWYgKHNlc3Npb24uc3RhdGUgPT09IFN0YXRlLlJ1bm5pbmcgJiYgdGhpcy52aWV3TW9kZWwuZm9jdXNlZFNlc3Npb24gPT09IHNlc3Npb24pIHtcblx0XHRcdFx0c2Vzc2lvblJ1bm5pbmdTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHRcdGlmIChzZXNzaW9uID09PSB0aGlzLnZpZXdNb2RlbC5mb2N1c2VkU2Vzc2lvbikge1xuXHRcdFx0XHR0aGlzLm9uU3RhdGVDaGFuZ2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0bGlzdGVuZXJEaXNwb3NhYmxlcy5hZGQodGhpcy5vbkRpZEVuZFNlc3Npb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5zZXNzaW9uID09PSBzZXNzaW9uKSB7XG5cdFx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuZGVsZXRlKGxpc3RlbmVyRGlzcG9zYWJsZXMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRsaXN0ZW5lckRpc3Bvc2FibGVzLmFkZChzZXNzaW9uLm9uRGlkRW5kQWRhcHRlcihhc3luYyBhZGFwdGVyRXhpdEV2ZW50ID0+IHtcblxuXHRcdFx0aWYgKGFkYXB0ZXJFeGl0RXZlbnQpIHtcblx0XHRcdFx0aWYgKGFkYXB0ZXJFeGl0RXZlbnQuZXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobmxzLmxvY2FsaXplKCdkZWJ1Z0FkYXB0ZXJDcmFzaCcsIFwiRGVidWcgYWRhcHRlciBwcm9jZXNzIGhhcyB0ZXJtaW5hdGVkIHVuZXhwZWN0ZWRseSAoezB9KVwiLCBhZGFwdGVyRXhpdEV2ZW50LmVycm9yLm1lc3NhZ2UgfHwgYWRhcHRlckV4aXRFdmVudC5lcnJvci50b1N0cmluZygpKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy50ZWxlbWV0cnkubG9nRGVidWdTZXNzaW9uU3RvcChzZXNzaW9uLCBhZGFwdGVyRXhpdEV2ZW50KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gJ1J1biB3aXRob3V0IGRlYnVnZ2luZycgbW9kZSBWU0NvZGUgbXVzdCB0ZXJtaW5hdGUgdGhlIGV4dGVuc2lvbiBob3N0LiBNb3JlIGRldGFpbHM6ICMzOTA1XG5cdFx0XHRjb25zdCBleHRlbnNpb25EZWJ1Z1Nlc3Npb24gPSBnZXRFeHRlbnNpb25Ib3N0RGVidWdTZXNzaW9uKHNlc3Npb24pO1xuXHRcdFx0aWYgKGV4dGVuc2lvbkRlYnVnU2Vzc2lvbiAmJiBleHRlbnNpb25EZWJ1Z1Nlc3Npb24uc3RhdGUgPT09IFN0YXRlLlJ1bm5pbmcgJiYgZXh0ZW5zaW9uRGVidWdTZXNzaW9uLmNvbmZpZ3VyYXRpb24ubm9EZWJ1Zykge1xuXHRcdFx0XHR0aGlzLmV4dGVuc2lvbkhvc3REZWJ1Z1NlcnZpY2UuY2xvc2UoZXh0ZW5zaW9uRGVidWdTZXNzaW9uLmdldElkKCkpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc2Vzc2lvbi5jb25maWd1cmF0aW9uLnBvc3REZWJ1Z1Rhc2spIHtcblx0XHRcdFx0Y29uc3Qgcm9vdCA9IHNlc3Npb24ucm9vdCA/PyB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudGFza1J1bm5lci5ydW5UYXNrKHJvb3QsIHNlc3Npb24uY29uZmlndXJhdGlvbi5wb3N0RGVidWdUYXNrKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuZW5kSW5pdGlhbGl6aW5nU3RhdGUoKTtcblx0XHRcdHRoaXMuY2FuY2VsVG9rZW5zKHNlc3Npb24uZ2V0SWQoKSk7XG5cblx0XHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLmNsb3NlUmVhZG9ubHlUYWJzT25FbmQpIHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yc1RvQ2xvc2UgPSB0aGlzLmVkaXRvclNlcnZpY2UuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkuZmlsdGVyKCh7IGVkaXRvciB9KSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGVkaXRvci5yZXNvdXJjZT8uc2NoZW1lID09PSBERUJVR19TQ0hFTUUgJiYgc2Vzc2lvbi5nZXRJZCgpID09PSBTb3VyY2UuZ2V0RW5jb2RlZERlYnVnRGF0YShlZGl0b3IucmVzb3VyY2UpLnNlc3Npb25JZDtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuZWRpdG9yU2VydmljZS5jbG9zZUVkaXRvcnMoZWRpdG9yc1RvQ2xvc2UpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb25EaWRFbmRTZXNzaW9uLmZpcmUoeyBzZXNzaW9uLCByZXN0YXJ0OiB0aGlzLnJlc3RhcnRpbmdTZXNzaW9ucy5oYXMoc2Vzc2lvbikgfSk7XG5cblx0XHRcdGNvbnN0IGZvY3VzZWRTZXNzaW9uID0gdGhpcy52aWV3TW9kZWwuZm9jdXNlZFNlc3Npb247XG5cdFx0XHRpZiAoZm9jdXNlZFNlc3Npb24gJiYgZm9jdXNlZFNlc3Npb24uZ2V0SWQoKSA9PT0gc2Vzc2lvbi5nZXRJZCgpKSB7XG5cdFx0XHRcdGNvbnN0IHsgc2Vzc2lvbiwgdGhyZWFkLCBzdGFja0ZyYW1lIH0gPSBnZXRTdGFja0ZyYW1lVGhyZWFkQW5kU2Vzc2lvblRvRm9jdXModGhpcy5tb2RlbCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZm9jdXNlZFNlc3Npb24pO1xuXHRcdFx0XHR0aGlzLnZpZXdNb2RlbC5zZXRGb2N1cyhzdGFja0ZyYW1lLCB0aHJlYWQsIHNlc3Npb24sIGZhbHNlKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMubW9kZWwuZ2V0U2Vzc2lvbnMoKS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0dGhpcy52aWV3TW9kZWwuc2V0TXVsdGlTZXNzaW9uVmlldyhmYWxzZSk7XG5cblx0XHRcdFx0aWYgKHRoaXMubGF5b3V0U2VydmljZS5pc1Zpc2libGUoUGFydHMuU0lERUJBUl9QQVJUKSAmJiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElEZWJ1Z0NvbmZpZ3VyYXRpb24+KCdkZWJ1ZycpLm9wZW5FeHBsb3Jlck9uRW5kKSB7XG5cdFx0XHRcdFx0dGhpcy5wYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZShFWFBMT1JFUl9WSUVXTEVUX0lELCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBEYXRhIGJyZWFrcG9pbnRzIHRoYXQgY2FuIG5vdCBiZSBwZXJzaXN0ZWQgc2hvdWxkIGJlIGNsZWFyZWQgd2hlbiBhIHNlc3Npb24gZW5kc1xuXHRcdFx0XHRjb25zdCBkYXRhQnJlYWtwb2ludHMgPSB0aGlzLm1vZGVsLmdldERhdGFCcmVha3BvaW50cygpLmZpbHRlcihkYnAgPT4gIWRicC5jYW5QZXJzaXN0KTtcblx0XHRcdFx0ZGF0YUJyZWFrcG9pbnRzLmZvckVhY2goZGJwID0+IHRoaXMubW9kZWwucmVtb3ZlRGF0YUJyZWFrcG9pbnRzKGRicC5nZXRJZCgpKSk7XG5cblx0XHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJykuY29uc29sZS5jbG9zZU9uRW5kKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGVidWdDb25zb2xlQ29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKFJFUExfVklFV19JRCk7XG5cdFx0XHRcdFx0aWYgKGRlYnVnQ29uc29sZUNvbnRhaW5lciAmJiB0aGlzLnZpZXdzU2VydmljZS5pc1ZpZXdDb250YWluZXJWaXNpYmxlKGRlYnVnQ29uc29sZUNvbnRhaW5lci5pZCkpIHtcblx0XHRcdFx0XHRcdHRoaXMudmlld3NTZXJ2aWNlLmNsb3NlVmlld0NvbnRhaW5lcihkZWJ1Z0NvbnNvbGVDb250YWluZXIuaWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm1vZGVsLnJlbW92ZUV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbihzZXNzaW9uLmdldElkKCkpO1xuXHRcdFx0Ly8gc2Vzc2lvbi5kaXNwb3NlKCk7IFRPRE9Acm9ibG91cmVuc1xuXHRcdH0pKTtcblx0fVxuXG5cdGFzeW5jIHJlc3RhcnRTZXNzaW9uKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24sIHJlc3RhcnREYXRhPzogYW55KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHNlc3Npb24uc2F2ZUJlZm9yZVJlc3RhcnQpIHtcblx0XHRcdGF3YWl0IHNhdmVBbGxCZWZvcmVEZWJ1Z1N0YXJ0KHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMuZWRpdG9yU2VydmljZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNBdXRvUmVzdGFydCA9ICEhcmVzdGFydERhdGE7XG5cblx0XHRjb25zdCBydW5UYXNrczogKCkgPT4gUHJvbWlzZTxUYXNrUnVuUmVzdWx0PiA9IGFzeW5jICgpID0+IHtcblx0XHRcdGlmIChpc0F1dG9SZXN0YXJ0KSB7XG5cdFx0XHRcdC8vIERvIG5vdCBydW4gcHJlTGF1bmNoIGFuZCBwb3N0RGVidWcgdGFza3MgZm9yIGF1dG9tYXRpYyByZXN0YXJ0c1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFRhc2tSdW5SZXN1bHQuU3VjY2Vzcyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJvb3QgPSBzZXNzaW9uLnJvb3QgfHwgdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKTtcblx0XHRcdGF3YWl0IHRoaXMudGFza1J1bm5lci5ydW5UYXNrKHJvb3QsIHNlc3Npb24uY29uZmlndXJhdGlvbi5wcmVSZXN0YXJ0VGFzayk7XG5cdFx0XHRhd2FpdCB0aGlzLnRhc2tSdW5uZXIucnVuVGFzayhyb290LCBzZXNzaW9uLmNvbmZpZ3VyYXRpb24ucG9zdERlYnVnVGFzayk7XG5cblx0XHRcdGNvbnN0IHRhc2tSZXN1bHQxID0gYXdhaXQgdGhpcy50YXNrUnVubmVyLnJ1blRhc2tBbmRDaGVja0Vycm9ycyhyb290LCBzZXNzaW9uLmNvbmZpZ3VyYXRpb24ucHJlTGF1bmNoVGFzayk7XG5cdFx0XHRpZiAodGFza1Jlc3VsdDEgIT09IFRhc2tSdW5SZXN1bHQuU3VjY2Vzcykge1xuXHRcdFx0XHRyZXR1cm4gdGFza1Jlc3VsdDE7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLnRhc2tSdW5uZXIucnVuVGFza0FuZENoZWNrRXJyb3JzKHJvb3QsIHNlc3Npb24uY29uZmlndXJhdGlvbi5wb3N0UmVzdGFydFRhc2spO1xuXHRcdH07XG5cblx0XHRjb25zdCBleHRlbnNpb25EZWJ1Z1Nlc3Npb24gPSBnZXRFeHRlbnNpb25Ib3N0RGVidWdTZXNzaW9uKHNlc3Npb24pO1xuXHRcdGlmIChleHRlbnNpb25EZWJ1Z1Nlc3Npb24pIHtcblx0XHRcdGNvbnN0IHRhc2tSZXN1bHQgPSBhd2FpdCBydW5UYXNrcygpO1xuXHRcdFx0aWYgKHRhc2tSZXN1bHQgPT09IFRhc2tSdW5SZXN1bHQuU3VjY2Vzcykge1xuXHRcdFx0XHR0aGlzLmV4dGVuc2lvbkhvc3REZWJ1Z1NlcnZpY2UucmVsb2FkKGV4dGVuc2lvbkRlYnVnU2Vzc2lvbi5nZXRJZCgpKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJlYWQgdGhlIGNvbmZpZ3VyYXRpb24gYWdhaW4gaWYgYSBsYXVuY2guanNvbiBoYXMgYmVlbiBjaGFuZ2VkLCBpZiBub3QganVzdCB1c2UgdGhlIGlubWVtb3J5IGNvbmZpZ3VyYXRpb25cblx0XHRsZXQgbmVlZHNUb1N1YnN0aXR1dGUgPSBmYWxzZTtcblx0XHRsZXQgdW5yZXNvbHZlZDogSUNvbmZpZyB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBsYXVuY2ggPSBzZXNzaW9uLnJvb3QgPyB0aGlzLmNvbmZpZ3VyYXRpb25NYW5hZ2VyLmdldExhdW5jaChzZXNzaW9uLnJvb3QudXJpKSA6IHVuZGVmaW5lZDtcblx0XHRpZiAobGF1bmNoKSB7XG5cdFx0XHR1bnJlc29sdmVkID0gbGF1bmNoLmdldENvbmZpZ3VyYXRpb24oc2Vzc2lvbi5jb25maWd1cmF0aW9uLm5hbWUpO1xuXHRcdFx0aWYgKHVucmVzb2x2ZWQgJiYgIWVxdWFscyh1bnJlc29sdmVkLCBzZXNzaW9uLnVucmVzb2x2ZWRDb25maWd1cmF0aW9uKSkge1xuXHRcdFx0XHR1bnJlc29sdmVkLm5vRGVidWcgPSBzZXNzaW9uLmNvbmZpZ3VyYXRpb24ubm9EZWJ1Zztcblx0XHRcdFx0bmVlZHNUb1N1YnN0aXR1dGUgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCByZXNvbHZlZDogSUNvbmZpZyB8IHVuZGVmaW5lZCB8IG51bGwgPSBzZXNzaW9uLmNvbmZpZ3VyYXRpb247XG5cdFx0aWYgKGxhdW5jaCAmJiBuZWVkc1RvU3Vic3RpdHV0ZSAmJiB1bnJlc29sdmVkKSB7XG5cdFx0XHRjb25zdCBpbml0Q2FuY2VsbGF0aW9uVG9rZW4gPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdHRoaXMuc2Vzc2lvbkNhbmNlbGxhdGlvblRva2Vucy5zZXQoc2Vzc2lvbi5nZXRJZCgpLCBpbml0Q2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRCeVByb3ZpZGVycyA9IGF3YWl0IHRoaXMuY29uZmlndXJhdGlvbk1hbmFnZXIucmVzb2x2ZUNvbmZpZ3VyYXRpb25CeVByb3ZpZGVycyhsYXVuY2gud29ya3NwYWNlID8gbGF1bmNoLndvcmtzcGFjZS51cmkgOiB1bmRlZmluZWQsIHVucmVzb2x2ZWQudHlwZSwgdW5yZXNvbHZlZCwgaW5pdENhbmNlbGxhdGlvblRva2VuLnRva2VuKTtcblx0XHRcdGlmIChyZXNvbHZlZEJ5UHJvdmlkZXJzKSB7XG5cdFx0XHRcdHJlc29sdmVkID0gYXdhaXQgdGhpcy5zdWJzdGl0dXRlVmFyaWFibGVzKGxhdW5jaCwgcmVzb2x2ZWRCeVByb3ZpZGVycyk7XG5cdFx0XHRcdGlmIChyZXNvbHZlZCAmJiAhaW5pdENhbmNlbGxhdGlvblRva2VuLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZWQgPSBhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25NYW5hZ2VyLnJlc29sdmVEZWJ1Z0NvbmZpZ3VyYXRpb25XaXRoU3Vic3RpdHV0ZWRWYXJpYWJsZXMobGF1bmNoICYmIGxhdW5jaC53b3Jrc3BhY2UgPyBsYXVuY2gud29ya3NwYWNlLnVyaSA6IHVuZGVmaW5lZCwgcmVzb2x2ZWQudHlwZSwgcmVzb2x2ZWQsIGluaXRDYW5jZWxsYXRpb25Ub2tlbi50b2tlbik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc29sdmVkID0gcmVzb2x2ZWRCeVByb3ZpZGVycztcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHJlc29sdmVkKSB7XG5cdFx0XHRzZXNzaW9uLnNldENvbmZpZ3VyYXRpb24oeyByZXNvbHZlZCwgdW5yZXNvbHZlZCB9KTtcblx0XHR9XG5cdFx0c2Vzc2lvbi5jb25maWd1cmF0aW9uLl9fcmVzdGFydCA9IHJlc3RhcnREYXRhO1xuXG5cdFx0Y29uc3QgZG9SZXN0YXJ0ID0gYXN5bmMgKGZuOiAoKSA9PiBQcm9taXNlPGJvb2xlYW4gfCB1bmRlZmluZWQ+KSA9PiB7XG5cdFx0XHR0aGlzLnJlc3RhcnRpbmdTZXNzaW9ucy5hZGQoc2Vzc2lvbik7XG5cdFx0XHRsZXQgZGlkUmVzdGFydCA9IGZhbHNlO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0ZGlkUmVzdGFydCA9IChhd2FpdCBmbigpKSAhPT0gZmFsc2U7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGRpZFJlc3RhcnQgPSBmYWxzZTtcblx0XHRcdFx0dGhyb3cgZTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMucmVzdGFydGluZ1Nlc3Npb25zLmRlbGV0ZShzZXNzaW9uKTtcblx0XHRcdFx0Ly8gd2UgcHJldmlvdXNseSBtYXkgaGF2ZSBpc3N1ZWQgYW4gb25EaWRFbmRTZXNzaW9uIHdpdGggcmVzdGFydDogdHJ1ZSxcblx0XHRcdFx0Ly8gYXNzdW1pbmcgdGhlIGFkYXB0ZXIgZXhpdGVkIChpbiBgcmVnaXN0ZXJTZXNzaW9uTGlzdGVuZXJzYCkuIEJ1dCB0aGVcblx0XHRcdFx0Ly8gcmVzdGFydCBmYWlsZWQsIHNvIGVtaXQgdGhlIGZpbmFsIHRlcm1pbmF0aW9uIG5vdy5cblx0XHRcdFx0aWYgKCFkaWRSZXN0YXJ0KSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRFbmRTZXNzaW9uLmZpcmUoeyBzZXNzaW9uLCByZXN0YXJ0OiBmYWxzZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmb3IgKGNvbnN0IGJyZWFrcG9pbnQgb2YgdGhpcy5tb2RlbC5nZXRCcmVha3BvaW50cyh7IHRyaWdnZXJlZE9ubHk6IHRydWUgfSkpIHtcblx0XHRcdGJyZWFrcG9pbnQuc2V0U2Vzc2lvbkRpZFRyaWdnZXIoc2Vzc2lvbi5nZXRJZCgpLCBmYWxzZSk7XG5cdFx0fVxuXG5cdFx0Ly8gRm9yIGRlYnVnIHNlc3Npb25zIHNwYXduZWQgYnkgdGVzdCBydW5zLCBjYW5jZWwgdGhlIHRlc3QgcnVuIGFuZCBzdG9wXG5cdFx0Ly8gdGhlIHNlc3Npb24sIHRoZW4gc3RhcnQgdGhlIHRlc3QgcnVuIGFnYWluOyB0ZXN0cyBoYXZlIG5vIG5vdGlvbiBvZiByZXN0YXJ0cy5cblx0XHRpZiAoc2Vzc2lvbi5jb3JyZWxhdGVkVGVzdFJ1bikge1xuXHRcdFx0aWYgKCFzZXNzaW9uLmNvcnJlbGF0ZWRUZXN0UnVuLmNvbXBsZXRlZEF0KSB7XG5cdFx0XHRcdHNlc3Npb24uY2FuY2VsQ29ycmVsYXRlZFRlc3RSdW4oKTtcblx0XHRcdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKHNlc3Npb24uY29ycmVsYXRlZFRlc3RSdW4ub25Db21wbGV0ZSk7XG5cdFx0XHRcdC8vIHRvZG9AY29ubm9yNDMxMiBpcyB0aGVyZSBhbnkgcmVhc29uIHRvIHdhaXQgZm9yIHRoZSBkZWJ1ZyBzZXNzaW9uIHRvXG5cdFx0XHRcdC8vIHRlcm1pbmF0ZT8gSSBkb24ndCB0aGluayBzbywgdGVzdCBleHRlbnNpb24gc2hvdWxkIGFscmVhZHkgaGFuZGxlIGFueVxuXHRcdFx0XHQvLyBzdGF0ZSBjb25mbGljdHMuLi5cblx0XHRcdH1cblxuXHRcdFx0dGhpcy50ZXN0U2VydmljZS5ydW5SZXNvbHZlZFRlc3RzKHNlc3Npb24uY29ycmVsYXRlZFRlc3RSdW4ucmVxdWVzdCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHNlc3Npb24uY2FwYWJpbGl0aWVzLnN1cHBvcnRzUmVzdGFydFJlcXVlc3QpIHtcblx0XHRcdGNvbnN0IHRhc2tSZXN1bHQgPSBhd2FpdCBydW5UYXNrcygpO1xuXHRcdFx0aWYgKHRhc2tSZXN1bHQgPT09IFRhc2tSdW5SZXN1bHQuU3VjY2Vzcykge1xuXHRcdFx0XHRhd2FpdCBkb1Jlc3RhcnQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGF3YWl0IHNlc3Npb24ucmVzdGFydCgpO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNob3VsZEZvY3VzID0gISF0aGlzLnZpZXdNb2RlbC5mb2N1c2VkU2Vzc2lvbiAmJiBzZXNzaW9uLmdldElkKCkgPT09IHRoaXMudmlld01vZGVsLmZvY3VzZWRTZXNzaW9uLmdldElkKCk7XG5cdFx0cmV0dXJuIGRvUmVzdGFydChhc3luYyAoKSA9PiB7XG5cdFx0XHQvLyBJZiB0aGUgcmVzdGFydCBpcyBhdXRvbWF0aWMgIC0+IGRpc2Nvbm5lY3QsIG90aGVyd2lzZSAtPiB0ZXJtaW5hdGUgIzU1MDY0XG5cdFx0XHRpZiAoaXNBdXRvUmVzdGFydCkge1xuXHRcdFx0XHRhd2FpdCBzZXNzaW9uLmRpc2Nvbm5lY3QodHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCBzZXNzaW9uLnRlcm1pbmF0ZSh0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KChjLCBlKSA9PiB7XG5cdFx0XHRcdHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRhc2tSZXN1bHQgPSBhd2FpdCBydW5UYXNrcygpO1xuXHRcdFx0XHRcdGlmICh0YXNrUmVzdWx0ICE9PSBUYXNrUnVuUmVzdWx0LlN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdHJldHVybiBjKGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIXJlc29sdmVkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYyhmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMubGF1bmNoT3JBdHRhY2hUb1Nlc3Npb24oc2Vzc2lvbiwgc2hvdWxkRm9jdXMpO1xuXHRcdFx0XHRcdFx0dGhpcy5fb25EaWROZXdTZXNzaW9uLmZpcmUoc2Vzc2lvbik7XG5cdFx0XHRcdFx0XHRjKHRydWUpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRlKGVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIDMwMCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHN0b3BTZXNzaW9uKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQsIGRpc2Nvbm5lY3QgPSBmYWxzZSwgc3VzcGVuZCA9IGZhbHNlKTogUHJvbWlzZTxhbnk+IHtcblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0cmV0dXJuIGRpc2Nvbm5lY3QgPyBzZXNzaW9uLmRpc2Nvbm5lY3QodW5kZWZpbmVkLCBzdXNwZW5kKSA6IHNlc3Npb24udGVybWluYXRlKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Vzc2lvbnMgPSB0aGlzLm1vZGVsLmdldFNlc3Npb25zKCk7XG5cdFx0aWYgKHNlc3Npb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy50YXNrUnVubmVyLmNhbmNlbCgpO1xuXHRcdFx0Ly8gVXNlciBtaWdodCBoYXZlIGNhbmNlbGxlZCBzdGFydGluZyBvZiBhIGRlYnVnIHNlc3Npb24sIGFuZCBpbiBzb21lIGNhc2VzIHRoZSBxdWljayBwaWNrIGlzIGxlZnQgb3BlblxuXHRcdFx0YXdhaXQgdGhpcy5xdWlja0lucHV0U2VydmljZS5jYW5jZWwoKTtcblx0XHRcdHRoaXMuZW5kSW5pdGlhbGl6aW5nU3RhdGUoKTtcblx0XHRcdHRoaXMuY2FuY2VsVG9rZW5zKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKHNlc3Npb25zLm1hcChzID0+IGRpc2Nvbm5lY3QgPyBzLmRpc2Nvbm5lY3QodW5kZWZpbmVkLCBzdXNwZW5kKSA6IHMudGVybWluYXRlKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3Vic3RpdHV0ZVZhcmlhYmxlcyhsYXVuY2g6IElMYXVuY2ggfCB1bmRlZmluZWQsIGNvbmZpZzogSUNvbmZpZyk6IFByb21pc2U8SUNvbmZpZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGRiZyA9IHRoaXMuYWRhcHRlck1hbmFnZXIuZ2V0RGVidWdnZXIoY29uZmlnLnR5cGUpO1xuXHRcdGlmIChkYmcpIHtcblx0XHRcdGxldCBmb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAobGF1bmNoICYmIGxhdW5jaC53b3Jrc3BhY2UpIHtcblx0XHRcdFx0Zm9sZGVyID0gbGF1bmNoLndvcmtzcGFjZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGZvbGRlcnMgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnM7XG5cdFx0XHRcdGlmIChmb2xkZXJzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdGZvbGRlciA9IGZvbGRlcnNbMF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJldHVybiBhd2FpdCBkYmcuc3Vic3RpdHV0ZVZhcmlhYmxlcyhmb2xkZXIsIGNvbmZpZyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0dGhpcy5zaG93RXJyb3IoZXJyLm1lc3NhZ2UsIHVuZGVmaW5lZCwgISFsYXVuY2g/LmdldENvbmZpZ3VyYXRpb24oY29uZmlnLm5hbWUpKTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcdC8vIGJhaWwgb3V0XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoY29uZmlnKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2hvd0Vycm9yKG1lc3NhZ2U6IHN0cmluZywgZXJyb3JBY3Rpb25zOiBSZWFkb25seUFycmF5PElBY3Rpb24+ID0gW10sIHByb21wdExhdW5jaEpzb24gPSB0cnVlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJlQWN0aW9uID0gbmV3IEFjdGlvbihERUJVR19DT05GSUdVUkVfQ09NTUFORF9JRCwgREVCVUdfQ09ORklHVVJFX0xBQkVMLCB1bmRlZmluZWQsIHRydWUsICgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoREVCVUdfQ09ORklHVVJFX0NPTU1BTkRfSUQpKTtcblx0XHQvLyBEb24ndCBhcHBlbmQgdGhlIHN0YW5kYXJkIGNvbW1hbmQgaWYgaWQgb2YgYW55IHByb3ZpZGVkIGFjdGlvbiBpbmRpY2F0ZXMgaXQgaXMgYSBjb21tYW5kXG5cdFx0Y29uc3QgYWN0aW9ucyA9IGVycm9yQWN0aW9ucy5maWx0ZXIoKGFjdGlvbikgPT4gYWN0aW9uLmlkLmVuZHNXaXRoKCcuY29tbWFuZCcpKS5sZW5ndGggPiAwID9cblx0XHRcdGVycm9yQWN0aW9ucyA6XG5cdFx0XHRbLi4uZXJyb3JBY3Rpb25zLCAuLi4ocHJvbXB0TGF1bmNoSnNvbiA/IFtjb25maWd1cmVBY3Rpb25dIDogW10pXTtcblx0XHRhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdHR5cGU6IHNldmVyaXR5LkVycm9yLFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdGJ1dHRvbnM6IGFjdGlvbnMubWFwKGFjdGlvbiA9PiAoe1xuXHRcdFx0XHRsYWJlbDogYWN0aW9uLmxhYmVsLFxuXHRcdFx0XHRydW46ICgpID0+IGFjdGlvbi5ydW4oKVxuXHRcdFx0fSkpLFxuXHRcdFx0Y2FuY2VsQnV0dG9uOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHQvLy0tLS0gZm9jdXMgbWFuYWdlbWVudFxuXG5cdGFzeW5jIGZvY3VzU3RhY2tGcmFtZShfc3RhY2tGcmFtZTogSVN0YWNrRnJhbWUgfCB1bmRlZmluZWQsIF90aHJlYWQ/OiBJVGhyZWFkLCBfc2Vzc2lvbj86IElEZWJ1Z1Nlc3Npb24sIG9wdGlvbnM/OiB7IGV4cGxpY2l0PzogYm9vbGVhbjsgcHJlc2VydmVGb2N1cz86IGJvb2xlYW47IHNpZGVCeVNpZGU/OiBib29sZWFuOyBwaW5uZWQ/OiBib29sZWFuIH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB7IHN0YWNrRnJhbWUsIHRocmVhZCwgc2Vzc2lvbiB9ID0gZ2V0U3RhY2tGcmFtZVRocmVhZEFuZFNlc3Npb25Ub0ZvY3VzKHRoaXMubW9kZWwsIF9zdGFja0ZyYW1lLCBfdGhyZWFkLCBfc2Vzc2lvbik7XG5cblx0XHRpZiAoc3RhY2tGcmFtZSkge1xuXHRcdFx0Y29uc3QgZWRpdG9yID0gYXdhaXQgc3RhY2tGcmFtZS5vcGVuSW5FZGl0b3IodGhpcy5lZGl0b3JTZXJ2aWNlLCBvcHRpb25zPy5wcmVzZXJ2ZUZvY3VzID8/IHRydWUsIG9wdGlvbnM/LnNpZGVCeVNpZGUsIG9wdGlvbnM/LnBpbm5lZCk7XG5cdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdGlmIChlZGl0b3IuaW5wdXQgPT09IERpc2Fzc2VtYmx5Vmlld0lucHV0Lmluc3RhbmNlKSB7XG5cdFx0XHRcdFx0Ly8gR28gdG8gYWRkcmVzcyBpcyBpbnZva2VkIHZpYSBzZXRGb2N1c1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGNvbnRyb2wgPSBlZGl0b3IuZ2V0Q29udHJvbCgpO1xuXHRcdFx0XHRcdGlmIChzdGFja0ZyYW1lICYmIGlzQ29kZUVkaXRvcihjb250cm9sKSAmJiBjb250cm9sLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gY29udHJvbC5nZXRNb2RlbCgpO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHN0YWNrRnJhbWUucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0aWYgKGxpbmVOdW1iZXIgPj0gMSAmJiBsaW5lTnVtYmVyIDw9IG1vZGVsLmdldExpbmVDb3VudCgpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxpbmVDb250ZW50ID0gY29udHJvbC5nZXRNb2RlbCgpLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdFx0XHRhcmlhLmFsZXJ0KG5scy5sb2NhbGl6ZSh7IGtleTogJ2RlYnVnZ2luZ1BhdXNlZCcsIGNvbW1lbnQ6IFsnRmlyc3QgcGxhY2Vob2xkZXIgaXMgdGhlIGZpbGUgbGluZSBjb250ZW50LCBzZWNvbmQgcGxhY2Vob2xkZXIgaXMgdGhlIHJlYXNvbiB3aHkgZGVidWdnaW5nIGlzIHN0b3BwZWQsIGZvciBleGFtcGxlIFwiYnJlYWtwb2ludFwiLCB0aGlyZCBpcyB0aGUgc3RhY2sgZnJhbWUgbmFtZSwgYW5kIGxhc3QgaXMgdGhlIGxpbmUgbnVtYmVyLiddIH0sXG5cdFx0XHRcdFx0XHRcdFx0XCJ7MH0sIGRlYnVnZ2luZyBwYXVzZWQgezF9LCB7Mn06ezN9XCIsIGxpbmVDb250ZW50LCB0aHJlYWQgJiYgdGhyZWFkLnN0b3BwZWREZXRhaWxzID8gYCwgcmVhc29uICR7dGhyZWFkLnN0b3BwZWREZXRhaWxzLnJlYXNvbn1gIDogJycsIHN0YWNrRnJhbWUuc291cmNlID8gc3RhY2tGcmFtZS5zb3VyY2UubmFtZSA6ICcnLCBzdGFja0ZyYW1lLnJhbmdlLnN0YXJ0TGluZU51bWJlcikpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0dGhpcy5kZWJ1Z1R5cGUuc2V0KHNlc3Npb24uY29uZmlndXJhdGlvbi50eXBlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kZWJ1Z1R5cGUucmVzZXQoKTtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXdNb2RlbC5zZXRGb2N1cyhzdGFja0ZyYW1lLCB0aHJlYWQsIHNlc3Npb24sICEhb3B0aW9ucz8uZXhwbGljaXQpO1xuXHR9XG5cblx0Ly8tLS0tIHdhdGNoZXNcblxuXHRhZGRXYXRjaEV4cHJlc3Npb24obmFtZT86IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHdlID0gdGhpcy5tb2RlbC5hZGRXYXRjaEV4cHJlc3Npb24obmFtZSk7XG5cdFx0aWYgKCFuYW1lKSB7XG5cdFx0XHR0aGlzLnZpZXdNb2RlbC5zZXRTZWxlY3RlZEV4cHJlc3Npb24od2UsIGZhbHNlKTtcblx0XHR9XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVXYXRjaEV4cHJlc3Npb25zKHRoaXMubW9kZWwuZ2V0V2F0Y2hFeHByZXNzaW9ucygpKTtcblx0fVxuXG5cdHJlbmFtZVdhdGNoRXhwcmVzc2lvbihpZDogc3RyaW5nLCBuZXdOYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLm1vZGVsLnJlbmFtZVdhdGNoRXhwcmVzc2lvbihpZCwgbmV3TmFtZSk7XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVXYXRjaEV4cHJlc3Npb25zKHRoaXMubW9kZWwuZ2V0V2F0Y2hFeHByZXNzaW9ucygpKTtcblx0fVxuXG5cdG1vdmVXYXRjaEV4cHJlc3Npb24oaWQ6IHN0cmluZywgcG9zaXRpb246IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMubW9kZWwubW92ZVdhdGNoRXhwcmVzc2lvbihpZCwgcG9zaXRpb24pO1xuXHRcdHRoaXMuZGVidWdTdG9yYWdlLnN0b3JlV2F0Y2hFeHByZXNzaW9ucyh0aGlzLm1vZGVsLmdldFdhdGNoRXhwcmVzc2lvbnMoKSk7XG5cdH1cblxuXHRyZW1vdmVXYXRjaEV4cHJlc3Npb25zKGlkPzogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbC5yZW1vdmVXYXRjaEV4cHJlc3Npb25zKGlkKTtcblx0XHR0aGlzLmRlYnVnU3RvcmFnZS5zdG9yZVdhdGNoRXhwcmVzc2lvbnModGhpcy5tb2RlbC5nZXRXYXRjaEV4cHJlc3Npb25zKCkpO1xuXHR9XG5cblx0Ly8tLS0tIGJyZWFrcG9pbnRzXG5cblx0Y2FuU2V0QnJlYWtwb2ludHNJbihtb2RlbDogSVRleHRNb2RlbCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmFkYXB0ZXJNYW5hZ2VyLmNhblNldEJyZWFrcG9pbnRzSW4obW9kZWwpO1xuXHR9XG5cblx0YXN5bmMgZW5hYmxlT3JEaXNhYmxlQnJlYWtwb2ludHMoZW5hYmxlOiBib29sZWFuLCBicmVha3BvaW50PzogSUVuYWJsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoYnJlYWtwb2ludCkge1xuXHRcdFx0dGhpcy5tb2RlbC5zZXRFbmFibGVtZW50KGJyZWFrcG9pbnQsIGVuYWJsZSk7XG5cdFx0XHR0aGlzLmRlYnVnU3RvcmFnZS5zdG9yZUJyZWFrcG9pbnRzKHRoaXMubW9kZWwpO1xuXHRcdFx0aWYgKGJyZWFrcG9pbnQgaW5zdGFuY2VvZiBCcmVha3BvaW50KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMubWFrZVRyaWdnZXJlZEJyZWFrcG9pbnRzTWF0Y2hFbmFibGVtZW50KGVuYWJsZSwgYnJlYWtwb2ludCk7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2VuZEJyZWFrcG9pbnRzKGJyZWFrcG9pbnQub3JpZ2luYWxVcmkpO1xuXHRcdFx0fSBlbHNlIGlmIChicmVha3BvaW50IGluc3RhbmNlb2YgRnVuY3Rpb25CcmVha3BvaW50KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2VuZEZ1bmN0aW9uQnJlYWtwb2ludHMoKTtcblx0XHRcdH0gZWxzZSBpZiAoYnJlYWtwb2ludCBpbnN0YW5jZW9mIERhdGFCcmVha3BvaW50KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2VuZERhdGFCcmVha3BvaW50cygpO1xuXHRcdFx0fSBlbHNlIGlmIChicmVha3BvaW50IGluc3RhbmNlb2YgSW5zdHJ1Y3Rpb25CcmVha3BvaW50KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2VuZEluc3RydWN0aW9uQnJlYWtwb2ludHMoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2VuZEV4Y2VwdGlvbkJyZWFrcG9pbnRzKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubW9kZWwuZW5hYmxlT3JEaXNhYmxlQWxsQnJlYWtwb2ludHMoZW5hYmxlKTtcblx0XHRcdHRoaXMuZGVidWdTdG9yYWdlLnN0b3JlQnJlYWtwb2ludHModGhpcy5tb2RlbCk7XG5cdFx0XHRhd2FpdCB0aGlzLnNlbmRBbGxCcmVha3BvaW50cygpO1xuXHRcdH1cblx0XHR0aGlzLmRlYnVnU3RvcmFnZS5zdG9yZUJyZWFrcG9pbnRzKHRoaXMubW9kZWwpO1xuXHR9XG5cblx0YXN5bmMgYWRkQnJlYWtwb2ludHModXJpOiB1cmksIHJhd0JyZWFrcG9pbnRzOiBJQnJlYWtwb2ludERhdGFbXSwgYXJpYUFubm91bmNlID0gdHJ1ZSk6IFByb21pc2U8SUJyZWFrcG9pbnRbXT4ge1xuXHRcdGNvbnN0IGJyZWFrcG9pbnRzID0gdGhpcy5tb2RlbC5hZGRCcmVha3BvaW50cyh1cmksIHJhd0JyZWFrcG9pbnRzKTtcblx0XHRpZiAoYXJpYUFubm91bmNlKSB7XG5cdFx0XHRicmVha3BvaW50cy5mb3JFYWNoKGJwID0+IGFyaWEuc3RhdHVzKG5scy5sb2NhbGl6ZSgnYnJlYWtwb2ludEFkZGVkJywgXCJBZGRlZCBicmVha3BvaW50LCBsaW5lIHswfSwgZmlsZSB7MX1cIiwgYnAubGluZU51bWJlciwgdXJpLmZzUGF0aCkpKTtcblx0XHR9XG5cblx0XHQvLyBJbiBzb21lIGNhc2VzIHdlIG5lZWQgdG8gc3RvcmUgYnJlYWtwb2ludHMgYmVmb3JlIHdlIHNlbmQgdGhlbSBiZWNhdXNlIHNlbmRpbmcgdGhlbSBjYW4gdGFrZSBhIGxvbmcgdGltZVxuXHRcdC8vIEFuZCBhZnRlciBzZW5kaW5nIHRoZW0gYmVjYXVzZSB0aGUgZGVidWcgYWRhcHRlciBjYW4gYXR0YWNoIGFkYXB0ZXIgZGF0YSB0byBhIGJyZWFrcG9pbnRcblx0XHR0aGlzLmRlYnVnU3RvcmFnZS5zdG9yZUJyZWFrcG9pbnRzKHRoaXMubW9kZWwpO1xuXHRcdGF3YWl0IHRoaXMuc2VuZEJyZWFrcG9pbnRzKHVyaSk7XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVCcmVha3BvaW50cyh0aGlzLm1vZGVsKTtcblx0XHRyZXR1cm4gYnJlYWtwb2ludHM7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVCcmVha3BvaW50cyh1cmk6IHVyaSwgZGF0YTogTWFwPHN0cmluZywgSUJyZWFrcG9pbnRVcGRhdGVEYXRhPiwgc2VuZE9uUmVzb3VyY2VTYXZlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubW9kZWwudXBkYXRlQnJlYWtwb2ludHMoZGF0YSk7XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVCcmVha3BvaW50cyh0aGlzLm1vZGVsKTtcblx0XHRpZiAoc2VuZE9uUmVzb3VyY2VTYXZlZCkge1xuXHRcdFx0dGhpcy5icmVha3BvaW50c1RvU2VuZE9uUmVzb3VyY2VTYXZlZC5hZGQodXJpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgdGhpcy5zZW5kQnJlYWtwb2ludHModXJpKTtcblx0XHRcdHRoaXMuZGVidWdTdG9yYWdlLnN0b3JlQnJlYWtwb2ludHModGhpcy5tb2RlbCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVtb3ZlQnJlYWtwb2ludHMoaWQ/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBicmVha3BvaW50cyA9IHRoaXMubW9kZWwuZ2V0QnJlYWtwb2ludHMoKTtcblx0XHRjb25zdCB0b1JlbW92ZSA9IGJyZWFrcG9pbnRzLmZpbHRlcihicCA9PiAhaWQgfHwgYnAuZ2V0SWQoKSA9PT0gaWQpO1xuXHRcdC8vIG5vdGU6IHVzaW5nIHRoZSBkZWJ1Z2dlci1yZXNvbHZlZCB1cmkgZm9yIGFyaWEgdG8gcmVmbGVjdCBVSSBzdGF0ZVxuXHRcdHRvUmVtb3ZlLmZvckVhY2goYnAgPT4gYXJpYS5zdGF0dXMobmxzLmxvY2FsaXplKCdicmVha3BvaW50UmVtb3ZlZCcsIFwiUmVtb3ZlZCBicmVha3BvaW50LCBsaW5lIHswfSwgZmlsZSB7MX1cIiwgYnAubGluZU51bWJlciwgYnAudXJpLmZzUGF0aCkpKTtcblx0XHRjb25zdCB1cmlzVG9DbGVhciA9IG5ldyBTZXQodG9SZW1vdmUubWFwKGJwID0+IGJwLm9yaWdpbmFsVXJpLnRvU3RyaW5nKCkpKTtcblxuXHRcdHRoaXMubW9kZWwucmVtb3ZlQnJlYWtwb2ludHModG9SZW1vdmUpO1xuXHRcdHRoaXMudW5saW5rVHJpZ2dlcmVkQnJlYWtwb2ludHMoYnJlYWtwb2ludHMsIHRvUmVtb3ZlKS5mb3JFYWNoKHVyaSA9PiB1cmlzVG9DbGVhci5hZGQodXJpLnRvU3RyaW5nKCkpKTtcblxuXHRcdHRoaXMuZGVidWdTdG9yYWdlLnN0b3JlQnJlYWtwb2ludHModGhpcy5tb2RlbCk7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoWy4uLnVyaXNUb0NsZWFyXS5tYXAodXJpID0+IHRoaXMuc2VuZEJyZWFrcG9pbnRzKFVSSS5wYXJzZSh1cmkpKSkpO1xuXHR9XG5cblx0c2V0QnJlYWtwb2ludHNBY3RpdmF0ZWQoYWN0aXZhdGVkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5tb2RlbC5zZXRCcmVha3BvaW50c0FjdGl2YXRlZChhY3RpdmF0ZWQpO1xuXHRcdHJldHVybiB0aGlzLnNlbmRBbGxCcmVha3BvaW50cygpO1xuXHR9XG5cblx0YXN5bmMgYWRkRnVuY3Rpb25CcmVha3BvaW50KG9wdHM/OiBJRnVuY3Rpb25CcmVha3BvaW50T3B0aW9ucywgaWQ/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLm1vZGVsLmFkZEZ1bmN0aW9uQnJlYWtwb2ludChvcHRzID8/IHsgbmFtZTogJycgfSwgaWQpO1xuXHRcdC8vIElmIG9wdHMgbm90IHByb3ZpZGVkLCBzZW5kaW5nIHRoZSBicmVha3BvaW50IGlzIGhhbmRsZWQgYnkgYSBsYXRlciB0byBjYWxsIHRvIGB1cGRhdGVGdW5jdGlvbkJyZWFrcG9pbnRgXG5cdFx0aWYgKG9wdHMpIHtcblx0XHRcdHRoaXMuZGVidWdTdG9yYWdlLnN0b3JlQnJlYWtwb2ludHModGhpcy5tb2RlbCk7XG5cdFx0XHRhd2FpdCB0aGlzLnNlbmRGdW5jdGlvbkJyZWFrcG9pbnRzKCk7XG5cdFx0XHR0aGlzLmRlYnVnU3RvcmFnZS5zdG9yZUJyZWFrcG9pbnRzKHRoaXMubW9kZWwpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHVwZGF0ZUZ1bmN0aW9uQnJlYWtwb2ludChpZDogc3RyaW5nLCB1cGRhdGU6IHsgbmFtZT86IHN0cmluZzsgaGl0Q29uZGl0aW9uPzogc3RyaW5nOyBjb25kaXRpb24/OiBzdHJpbmcgfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubW9kZWwudXBkYXRlRnVuY3Rpb25CcmVha3BvaW50KGlkLCB1cGRhdGUpO1xuXHRcdHRoaXMuZGVidWdTdG9yYWdlLnN0b3JlQnJlYWtwb2ludHModGhpcy5tb2RlbCk7XG5cdFx0YXdhaXQgdGhpcy5zZW5kRnVuY3Rpb25CcmVha3BvaW50cygpO1xuXHR9XG5cblx0YXN5bmMgcmVtb3ZlRnVuY3Rpb25CcmVha3BvaW50cyhpZD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubW9kZWwucmVtb3ZlRnVuY3Rpb25CcmVha3BvaW50cyhpZCk7XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVCcmVha3BvaW50cyh0aGlzLm1vZGVsKTtcblx0XHRhd2FpdCB0aGlzLnNlbmRGdW5jdGlvbkJyZWFrcG9pbnRzKCk7XG5cdH1cblxuXHRhc3luYyBhZGREYXRhQnJlYWtwb2ludChvcHRzOiBJRGF0YUJyZWFrcG9pbnRPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5tb2RlbC5hZGREYXRhQnJlYWtwb2ludChvcHRzKTtcblx0XHR0aGlzLmRlYnVnU3RvcmFnZS5zdG9yZUJyZWFrcG9pbnRzKHRoaXMubW9kZWwpO1xuXHRcdGF3YWl0IHRoaXMuc2VuZERhdGFCcmVha3BvaW50cygpO1xuXHRcdHRoaXMuZGVidWdTdG9yYWdlLnN0b3JlQnJlYWtwb2ludHModGhpcy5tb2RlbCk7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVEYXRhQnJlYWtwb2ludChpZDogc3RyaW5nLCB1cGRhdGU6IHsgaGl0Q29uZGl0aW9uPzogc3RyaW5nOyBjb25kaXRpb24/OiBzdHJpbmcgfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubW9kZWwudXBkYXRlRGF0YUJyZWFrcG9pbnQoaWQsIHVwZGF0ZSk7XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVCcmVha3BvaW50cyh0aGlzLm1vZGVsKTtcblx0XHRhd2FpdCB0aGlzLnNlbmREYXRhQnJlYWtwb2ludHMoKTtcblx0fVxuXG5cdGFzeW5jIHJlbW92ZURhdGFCcmVha3BvaW50cyhpZD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubW9kZWwucmVtb3ZlRGF0YUJyZWFrcG9pbnRzKGlkKTtcblx0XHR0aGlzLmRlYnVnU3RvcmFnZS5zdG9yZUJyZWFrcG9pbnRzKHRoaXMubW9kZWwpO1xuXHRcdGF3YWl0IHRoaXMuc2VuZERhdGFCcmVha3BvaW50cygpO1xuXHR9XG5cblx0YXN5bmMgYWRkSW5zdHJ1Y3Rpb25CcmVha3BvaW50KG9wdHM6IElJbnN0cnVjdGlvbkJyZWFrcG9pbnRPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5tb2RlbC5hZGRJbnN0cnVjdGlvbkJyZWFrcG9pbnQob3B0cyk7XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVCcmVha3BvaW50cyh0aGlzLm1vZGVsKTtcblx0XHRhd2FpdCB0aGlzLnNlbmRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKCk7XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVCcmVha3BvaW50cyh0aGlzLm1vZGVsKTtcblx0fVxuXG5cdGFzeW5jIHJlbW92ZUluc3RydWN0aW9uQnJlYWtwb2ludHMoaW5zdHJ1Y3Rpb25SZWZlcmVuY2U/OiBzdHJpbmcsIG9mZnNldD86IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubW9kZWwucmVtb3ZlSW5zdHJ1Y3Rpb25CcmVha3BvaW50cyhpbnN0cnVjdGlvblJlZmVyZW5jZSwgb2Zmc2V0KTtcblx0XHR0aGlzLmRlYnVnU3RvcmFnZS5zdG9yZUJyZWFrcG9pbnRzKHRoaXMubW9kZWwpO1xuXHRcdGF3YWl0IHRoaXMuc2VuZEluc3RydWN0aW9uQnJlYWtwb2ludHMoKTtcblx0fVxuXG5cdHNldEV4Y2VwdGlvbkJyZWFrcG9pbnRGYWxsYmFja1Nlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcpIHtcblx0XHR0aGlzLm1vZGVsLnNldEV4Y2VwdGlvbkJyZWFrcG9pbnRGYWxsYmFja1Nlc3Npb24oc2Vzc2lvbklkKTtcblx0XHR0aGlzLmRlYnVnU3RvcmFnZS5zdG9yZUJyZWFrcG9pbnRzKHRoaXMubW9kZWwpO1xuXHR9XG5cblx0c2V0RXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24sIGZpbHRlcnM6IERlYnVnUHJvdG9jb2wuRXhjZXB0aW9uQnJlYWtwb2ludHNGaWx0ZXJbXSk6IHZvaWQge1xuXHRcdHRoaXMubW9kZWwuc2V0RXhjZXB0aW9uQnJlYWtwb2ludHNGb3JTZXNzaW9uKHNlc3Npb24uZ2V0SWQoKSwgZmlsdGVycyk7XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVCcmVha3BvaW50cyh0aGlzLm1vZGVsKTtcblx0fVxuXG5cdGFzeW5jIHNldEV4Y2VwdGlvbkJyZWFrcG9pbnRDb25kaXRpb24oZXhjZXB0aW9uQnJlYWtwb2ludDogSUV4Y2VwdGlvbkJyZWFrcG9pbnQsIGNvbmRpdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5tb2RlbC5zZXRFeGNlcHRpb25CcmVha3BvaW50Q29uZGl0aW9uKGV4Y2VwdGlvbkJyZWFrcG9pbnQsIGNvbmRpdGlvbik7XG5cdFx0dGhpcy5kZWJ1Z1N0b3JhZ2Uuc3RvcmVCcmVha3BvaW50cyh0aGlzLm1vZGVsKTtcblx0XHRhd2FpdCB0aGlzLnNlbmRFeGNlcHRpb25CcmVha3BvaW50cygpO1xuXHR9XG5cblx0YXN5bmMgc2VuZEFsbEJyZWFrcG9pbnRzKHNlc3Npb24/OiBJRGVidWdTZXNzaW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc2V0QnJlYWtwb2ludHNQcm9taXNlcyA9IGRpc3RpbmN0KHRoaXMubW9kZWwuZ2V0QnJlYWtwb2ludHMoKSwgYnAgPT4gYnAub3JpZ2luYWxVcmkudG9TdHJpbmcoKSlcblx0XHRcdC5tYXAoYnAgPT4gdGhpcy5zZW5kQnJlYWtwb2ludHMoYnAub3JpZ2luYWxVcmksIGZhbHNlLCBzZXNzaW9uKSk7XG5cblx0XHQvLyBJZiBzZW5kaW5nIGJyZWFrcG9pbnRzIHRvIG9uZSBzZXNzaW9uIHdoaWNoIHdlIGtub3cgc3VwcG9ydHMgdGhlIGNvbmZpZ3VyYXRpb25Eb25lIHJlcXVlc3QsIGNhbiBtYWtlIGFsbCByZXF1ZXN0cyBpbiBwYXJhbGxlbFxuXHRcdGlmIChzZXNzaW9uPy5jYXBhYmlsaXRpZXMuc3VwcG9ydHNDb25maWd1cmF0aW9uRG9uZVJlcXVlc3QpIHtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdFx0Li4uc2V0QnJlYWtwb2ludHNQcm9taXNlcyxcblx0XHRcdFx0dGhpcy5zZW5kRnVuY3Rpb25CcmVha3BvaW50cyhzZXNzaW9uKSxcblx0XHRcdFx0dGhpcy5zZW5kRGF0YUJyZWFrcG9pbnRzKHNlc3Npb24pLFxuXHRcdFx0XHR0aGlzLnNlbmRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKHNlc3Npb24pLFxuXHRcdFx0XHR0aGlzLnNlbmRFeGNlcHRpb25CcmVha3BvaW50cyhzZXNzaW9uKSxcblx0XHRcdF0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChzZXRCcmVha3BvaW50c1Byb21pc2VzKTtcblx0XHRcdGF3YWl0IHRoaXMuc2VuZEZ1bmN0aW9uQnJlYWtwb2ludHMoc2Vzc2lvbik7XG5cdFx0XHRhd2FpdCB0aGlzLnNlbmREYXRhQnJlYWtwb2ludHMoc2Vzc2lvbik7XG5cdFx0XHRhd2FpdCB0aGlzLnNlbmRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKHNlc3Npb24pO1xuXHRcdFx0Ly8gc2VuZCBleGNlcHRpb24gYnJlYWtwb2ludHMgYXQgdGhlIGVuZCBzaW5jZSBzb21lIGRlYnVnIGFkYXB0ZXJzIG1heSByZWx5IG9uIHRoZSBvcmRlciAtIHRoaXMgd2FzIHRoZSBjYXNlIGJlZm9yZVxuXHRcdFx0Ly8gdGhlIGNvbmZpZ3VyYXRpb25Eb25lIHJlcXVlc3Qgd2FzIGludHJvZHVjZWQuXG5cdFx0XHRhd2FpdCB0aGlzLnNlbmRFeGNlcHRpb25CcmVha3BvaW50cyhzZXNzaW9uKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVtb3ZlcyB0aGUgY29uZGl0aW9uIG9mIHRyaWdnZXJlZCBicmVha3BvaW50cyB0aGF0IGRlcGVuZGVkIG9uXG5cdCAqIGJyZWFrcG9pbnRzIGluIGByZW1vdmVkQnJlYWtwb2ludHNgLiBSZXR1cm5zIHRoZSBVUklzIG9mIHJlc291cmNlcyB0aGF0XG5cdCAqIGhhZCB0aGVpciBicmVha3BvaW50cyBjaGFuZ2VkIGluIHRoaXMgd2F5LlxuXHQgKi9cblx0cHJpdmF0ZSB1bmxpbmtUcmlnZ2VyZWRCcmVha3BvaW50cyhhbGxCcmVha3BvaW50czogcmVhZG9ubHkgSUJyZWFrcG9pbnRbXSwgcmVtb3ZlZEJyZWFrcG9pbnRzOiByZWFkb25seSBJQnJlYWtwb2ludFtdKTogdXJpW10ge1xuXHRcdGNvbnN0IGFmZmVjdGVkVXJpczogdXJpW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHJlbW92ZWQgb2YgcmVtb3ZlZEJyZWFrcG9pbnRzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGV4aXN0aW5nIG9mIGFsbEJyZWFrcG9pbnRzKSB7XG5cdFx0XHRcdGlmICghcmVtb3ZlZEJyZWFrcG9pbnRzLmluY2x1ZGVzKGV4aXN0aW5nKSAmJiBleGlzdGluZy50cmlnZ2VyZWRCeSA9PT0gcmVtb3ZlZC5nZXRJZCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5tb2RlbC51cGRhdGVCcmVha3BvaW50cyhuZXcgTWFwKFtbZXhpc3RpbmcuZ2V0SWQoKSwgeyB0cmlnZ2VyZWRCeTogdW5kZWZpbmVkIH1dXSkpO1xuXHRcdFx0XHRcdGFmZmVjdGVkVXJpcy5wdXNoKGV4aXN0aW5nLm9yaWdpbmFsVXJpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBhZmZlY3RlZFVyaXM7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG1ha2VUcmlnZ2VyZWRCcmVha3BvaW50c01hdGNoRW5hYmxlbWVudChlbmFibGU6IGJvb2xlYW4sIGJyZWFrcG9pbnQ6IEJyZWFrcG9pbnQpIHtcblx0XHRpZiAoZW5hYmxlKSB7XG5cdFx0XHQvKiogSWYgdGhlIGJyZWFrcG9pbnQgaXMgYmVpbmcgZW5hYmxlZCwgYWxzbyBlbnN1cmUgaXRzIHRyaWdnZXJlciBpcyBlbmFibGVkICovXG5cdFx0XHRpZiAoYnJlYWtwb2ludC50cmlnZ2VyZWRCeSkge1xuXHRcdFx0XHRjb25zdCB0cmlnZ2VyID0gdGhpcy5tb2RlbC5nZXRCcmVha3BvaW50cygpLmZpbmQoYnAgPT4gYnJlYWtwb2ludC50cmlnZ2VyZWRCeSA9PT0gYnAuZ2V0SWQoKSk7XG5cdFx0XHRcdGlmICh0cmlnZ2VyICYmICF0cmlnZ2VyLmVuYWJsZWQpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmVuYWJsZU9yRGlzYWJsZUJyZWFrcG9pbnRzKGVuYWJsZSwgdHJpZ2dlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdC8qKiBNYWtlcyBpdHMgdHJpZ2dlcmVlIHN0YXRlcyBtYXRjaCB0aGUgc3RhdGUgb2YgdGhpcyBicmVha3BvaW50ICovXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwodGhpcy5tb2RlbC5nZXRCcmVha3BvaW50cygpXG5cdFx0XHQuZmlsdGVyKGJwID0+IGJwLnRyaWdnZXJlZEJ5ID09PSBicmVha3BvaW50LmdldElkKCkgJiYgYnAuZW5hYmxlZCAhPT0gZW5hYmxlKVxuXHRcdFx0Lm1hcChicCA9PiB0aGlzLmVuYWJsZU9yRGlzYWJsZUJyZWFrcG9pbnRzKGVuYWJsZSwgYnApKVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc2VuZEJyZWFrcG9pbnRzKG1vZGVsVXJpOiB1cmksIHNvdXJjZU1vZGlmaWVkID0gZmFsc2UsIHNlc3Npb24/OiBJRGVidWdTZXNzaW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgYnJlYWtwb2ludHNUb1NlbmQgPSB0aGlzLm1vZGVsLmdldEJyZWFrcG9pbnRzKHsgb3JpZ2luYWxVcmk6IG1vZGVsVXJpLCBlbmFibGVkT25seTogdHJ1ZSB9KTtcblx0XHRhd2FpdCBzZW5kVG9PbmVPckFsbFNlc3Npb25zKHRoaXMubW9kZWwsIHNlc3Npb24sIGFzeW5jIHMgPT4ge1xuXHRcdFx0aWYgKCFzLmNvbmZpZ3VyYXRpb24ubm9EZWJ1Zykge1xuXHRcdFx0XHRjb25zdCBzZXNzaW9uQnBzID0gYnJlYWtwb2ludHNUb1NlbmQuZmlsdGVyKGJwID0+ICFicC50cmlnZ2VyZWRCeSB8fCBicC5nZXRTZXNzaW9uRGlkVHJpZ2dlcihzLmdldElkKCkpKTtcblx0XHRcdFx0YXdhaXQgcy5zZW5kQnJlYWtwb2ludHMobW9kZWxVcmksIHNlc3Npb25CcHMsIHNvdXJjZU1vZGlmaWVkKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2VuZEZ1bmN0aW9uQnJlYWtwb2ludHMoc2Vzc2lvbj86IElEZWJ1Z1Nlc3Npb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBicmVha3BvaW50c1RvU2VuZCA9IHRoaXMubW9kZWwuZ2V0RnVuY3Rpb25CcmVha3BvaW50cygpLmZpbHRlcihmYnAgPT4gZmJwLmVuYWJsZWQgJiYgdGhpcy5tb2RlbC5hcmVCcmVha3BvaW50c0FjdGl2YXRlZCgpKTtcblxuXHRcdGF3YWl0IHNlbmRUb09uZU9yQWxsU2Vzc2lvbnModGhpcy5tb2RlbCwgc2Vzc2lvbiwgYXN5bmMgcyA9PiB7XG5cdFx0XHRpZiAocy5jYXBhYmlsaXRpZXMuc3VwcG9ydHNGdW5jdGlvbkJyZWFrcG9pbnRzICYmICFzLmNvbmZpZ3VyYXRpb24ubm9EZWJ1Zykge1xuXHRcdFx0XHRhd2FpdCBzLnNlbmRGdW5jdGlvbkJyZWFrcG9pbnRzKGJyZWFrcG9pbnRzVG9TZW5kKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2VuZERhdGFCcmVha3BvaW50cyhzZXNzaW9uPzogSURlYnVnU2Vzc2lvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGJyZWFrcG9pbnRzVG9TZW5kID0gdGhpcy5tb2RlbC5nZXREYXRhQnJlYWtwb2ludHMoKS5maWx0ZXIoZmJwID0+IGZicC5lbmFibGVkICYmIHRoaXMubW9kZWwuYXJlQnJlYWtwb2ludHNBY3RpdmF0ZWQoKSk7XG5cblx0XHRhd2FpdCBzZW5kVG9PbmVPckFsbFNlc3Npb25zKHRoaXMubW9kZWwsIHNlc3Npb24sIGFzeW5jIHMgPT4ge1xuXHRcdFx0aWYgKHMuY2FwYWJpbGl0aWVzLnN1cHBvcnRzRGF0YUJyZWFrcG9pbnRzICYmICFzLmNvbmZpZ3VyYXRpb24ubm9EZWJ1Zykge1xuXHRcdFx0XHRhd2FpdCBzLnNlbmREYXRhQnJlYWtwb2ludHMoYnJlYWtwb2ludHNUb1NlbmQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZW5kSW5zdHJ1Y3Rpb25CcmVha3BvaW50cyhzZXNzaW9uPzogSURlYnVnU2Vzc2lvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGJyZWFrcG9pbnRzVG9TZW5kID0gdGhpcy5tb2RlbC5nZXRJbnN0cnVjdGlvbkJyZWFrcG9pbnRzKCkuZmlsdGVyKGZicCA9PiBmYnAuZW5hYmxlZCAmJiB0aGlzLm1vZGVsLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCkpO1xuXG5cdFx0YXdhaXQgc2VuZFRvT25lT3JBbGxTZXNzaW9ucyh0aGlzLm1vZGVsLCBzZXNzaW9uLCBhc3luYyBzID0+IHtcblx0XHRcdGlmIChzLmNhcGFiaWxpdGllcy5zdXBwb3J0c0luc3RydWN0aW9uQnJlYWtwb2ludHMgJiYgIXMuY29uZmlndXJhdGlvbi5ub0RlYnVnKSB7XG5cdFx0XHRcdGF3YWl0IHMuc2VuZEluc3RydWN0aW9uQnJlYWtwb2ludHMoYnJlYWtwb2ludHNUb1NlbmQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZW5kRXhjZXB0aW9uQnJlYWtwb2ludHMoc2Vzc2lvbj86IElEZWJ1Z1Nlc3Npb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gc2VuZFRvT25lT3JBbGxTZXNzaW9ucyh0aGlzLm1vZGVsLCBzZXNzaW9uLCBhc3luYyBzID0+IHtcblx0XHRcdGNvbnN0IGVuYWJsZWRFeGNlcHRpb25CcHMgPSB0aGlzLm1vZGVsLmdldEV4Y2VwdGlvbkJyZWFrcG9pbnRzRm9yU2Vzc2lvbihzLmdldElkKCkpLmZpbHRlcihleGIgPT4gZXhiLmVuYWJsZWQpO1xuXHRcdFx0aWYgKHMuY2FwYWJpbGl0aWVzLnN1cHBvcnRzQ29uZmlndXJhdGlvbkRvbmVSZXF1ZXN0ICYmICghcy5jYXBhYmlsaXRpZXMuZXhjZXB0aW9uQnJlYWtwb2ludEZpbHRlcnMgfHwgcy5jYXBhYmlsaXRpZXMuZXhjZXB0aW9uQnJlYWtwb2ludEZpbHRlcnMubGVuZ3RoID09PSAwKSkge1xuXHRcdFx0XHQvLyBPbmx5IGNhbGwgYHNldEV4Y2VwdGlvbkJyZWFrcG9pbnRzYCBhcyBzcGVjaWZpZWQgaW4gZGFwIHByb3RvY29sICM5MDAwMVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXMuY29uZmlndXJhdGlvbi5ub0RlYnVnKSB7XG5cdFx0XHRcdGF3YWl0IHMuc2VuZEV4Y2VwdGlvbkJyZWFrcG9pbnRzKGVuYWJsZWRFeGNlcHRpb25CcHMpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkZpbGVDaGFuZ2VzKGZpbGVDaGFuZ2VzRXZlbnQ6IEZpbGVDaGFuZ2VzRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCB0b1JlbW92ZSA9IHRoaXMubW9kZWwuZ2V0QnJlYWtwb2ludHMoKS5maWx0ZXIoYnAgPT5cblx0XHRcdGZpbGVDaGFuZ2VzRXZlbnQuY29udGFpbnMoYnAub3JpZ2luYWxVcmksIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpKTtcblx0XHRpZiAodG9SZW1vdmUubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLm1vZGVsLnJlbW92ZUJyZWFrcG9pbnRzKHRvUmVtb3ZlKTtcblx0XHR9XG5cblx0XHRjb25zdCB0b1NlbmQ6IFVSSVtdID0gW107XG5cdFx0Zm9yIChjb25zdCB1cmkgb2YgdGhpcy5icmVha3BvaW50c1RvU2VuZE9uUmVzb3VyY2VTYXZlZCkge1xuXHRcdFx0aWYgKGZpbGVDaGFuZ2VzRXZlbnQuY29udGFpbnModXJpLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEKSkge1xuXHRcdFx0XHR0b1NlbmQucHVzaCh1cmkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgdXJpIG9mIHRvU2VuZCkge1xuXHRcdFx0dGhpcy5icmVha3BvaW50c1RvU2VuZE9uUmVzb3VyY2VTYXZlZC5kZWxldGUodXJpKTtcblx0XHRcdHRoaXMuc2VuZEJyZWFrcG9pbnRzKHVyaSwgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcnVuVG8odXJpOiB1cmksIGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uPzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IGJyZWFrcG9pbnRUb1JlbW92ZTogSUJyZWFrcG9pbnQgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHRocmVhZFRvQ29udGludWUgPSB0aGlzLmdldFZpZXdNb2RlbCgpLmZvY3VzZWRUaHJlYWQ7XG5cdFx0Y29uc3QgYWRkVGVtcEJyZWFrUG9pbnQgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBicEV4aXN0cyA9ICEhKHRoaXMuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50cyh7IGNvbHVtbiwgbGluZU51bWJlciwgdXJpIH0pLmxlbmd0aCk7XG5cblx0XHRcdGlmICghYnBFeGlzdHMpIHtcblx0XHRcdFx0Y29uc3QgYWRkUmVzdWx0ID0gYXdhaXQgdGhpcy5hZGRBbmRWYWxpZGF0ZUJyZWFrcG9pbnRzKHVyaSwgbGluZU51bWJlciwgY29sdW1uKTtcblx0XHRcdFx0aWYgKGFkZFJlc3VsdC50aHJlYWQpIHtcblx0XHRcdFx0XHR0aHJlYWRUb0NvbnRpbnVlID0gYWRkUmVzdWx0LnRocmVhZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChhZGRSZXN1bHQuYnJlYWtwb2ludCkge1xuXHRcdFx0XHRcdGJyZWFrcG9pbnRUb1JlbW92ZSA9IGFkZFJlc3VsdC5icmVha3BvaW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4geyB0aHJlYWRUb0NvbnRpbnVlLCBicmVha3BvaW50VG9SZW1vdmUgfTtcblx0XHR9O1xuXHRcdGNvbnN0IHJlbW92ZVRlbXBCcmVha1BvaW50ID0gKHN0YXRlOiBTdGF0ZSk6IGJvb2xlYW4gPT4ge1xuXHRcdFx0aWYgKHN0YXRlID09PSBTdGF0ZS5TdG9wcGVkIHx8IHN0YXRlID09PSBTdGF0ZS5JbmFjdGl2ZSkge1xuXHRcdFx0XHRpZiAoYnJlYWtwb2ludFRvUmVtb3ZlKSB7XG5cdFx0XHRcdFx0dGhpcy5yZW1vdmVCcmVha3BvaW50cyhicmVha3BvaW50VG9SZW1vdmUuZ2V0SWQoKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fTtcblxuXHRcdGF3YWl0IGFkZFRlbXBCcmVha1BvaW50KCk7XG5cdFx0aWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkluYWN0aXZlKSB7XG5cdFx0XHQvLyBJZiBubyBzZXNzaW9uIGV4aXN0cyBzdGFydCB0aGUgZGVidWdnZXJcblx0XHRcdGNvbnN0IHsgbGF1bmNoLCBuYW1lLCBnZXRDb25maWcgfSA9IHRoaXMuZ2V0Q29uZmlndXJhdGlvbk1hbmFnZXIoKS5zZWxlY3RlZENvbmZpZ3VyYXRpb247XG5cdFx0XHRjb25zdCBjb25maWcgPSBhd2FpdCBnZXRDb25maWcoKTtcblx0XHRcdGNvbnN0IGNvbmZpZ09yTmFtZSA9IGNvbmZpZyA/IE9iamVjdC5hc3NpZ24oZGVlcENsb25lKGNvbmZpZyksIHt9KSA6IG5hbWU7XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IHRoaXMub25EaWRDaGFuZ2VTdGF0ZShzdGF0ZSA9PiB7XG5cdFx0XHRcdGlmIChyZW1vdmVUZW1wQnJlYWtQb2ludChzdGF0ZSkpIHtcblx0XHRcdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGhpcy5zdGFydERlYnVnZ2luZyhsYXVuY2gsIGNvbmZpZ09yTmFtZSwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlN0b3BwZWQpIHtcblx0XHRcdGNvbnN0IGZvY3VzZWRTZXNzaW9uID0gdGhpcy5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRcdGlmICghZm9jdXNlZFNlc3Npb24gfHwgIXRocmVhZFRvQ29udGludWUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IHRocmVhZFRvQ29udGludWUuc2Vzc2lvbi5vbkRpZENoYW5nZVN0YXRlKCgpID0+IHtcblx0XHRcdFx0aWYgKHJlbW92ZVRlbXBCcmVha1BvaW50KGZvY3VzZWRTZXNzaW9uLnN0YXRlKSkge1xuXHRcdFx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aHJlYWRUb0NvbnRpbnVlLmNvbnRpbnVlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhZGRBbmRWYWxpZGF0ZUJyZWFrcG9pbnRzKHVyaTogVVJJLCBsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbj86IG51bWJlcikge1xuXHRcdGNvbnN0IGRlYnVnTW9kZWwgPSB0aGlzLmdldE1vZGVsKCk7XG5cdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5nZXRWaWV3TW9kZWwoKTtcblxuXHRcdGNvbnN0IGJyZWFrcG9pbnRzID0gYXdhaXQgdGhpcy5hZGRCcmVha3BvaW50cyh1cmksIFt7IGxpbmVOdW1iZXIsIGNvbHVtbiB9XSwgZmFsc2UpO1xuXHRcdGNvbnN0IGJyZWFrcG9pbnQgPSBicmVha3BvaW50cz8uWzBdO1xuXHRcdGlmICghYnJlYWtwb2ludCkge1xuXHRcdFx0cmV0dXJuIHsgYnJlYWtwb2ludDogdW5kZWZpbmVkLCB0aHJlYWQ6IHZpZXdNb2RlbC5mb2N1c2VkVGhyZWFkIH07XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIGJyZWFrcG9pbnQgd2FzIG5vdCBpbml0aWFsbHkgdmVyaWZpZWQsIHdhaXQgdXAgdG8gMnMgZm9yIGl0IHRvIGJlY29tZSBzby5cblx0XHQvLyBJbmhlcmVudGx5IHJhY2V5IGlmIG11bHRpcGxlIHNlc3Npb25zIGNhbiB2ZXJpZnkgYXN5bmMsIGJ1dCBub3Qgc29sdmFibGUuLi5cblx0XHRpZiAoIWJyZWFrcG9pbnQudmVyaWZpZWQpIHtcblx0XHRcdGxldCBsaXN0ZW5lcjogSURpc3Bvc2FibGU7XG5cdFx0XHRhd2FpdCByYWNlVGltZW91dChuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdFx0bGlzdGVuZXIgPSBkZWJ1Z01vZGVsLm9uRGlkQ2hhbmdlQnJlYWtwb2ludHMoKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChicmVha3BvaW50LnZlcmlmaWVkKSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pLCAyMDAwKTtcblx0XHRcdGxpc3RlbmVyIS5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0Ly8gTG9vayBhdCBwYXVzZWQgdGhyZWFkcyBmb3Igc2Vzc2lvbnMgdGhhdCB2ZXJpZmllZCB0aGlzIGJwLiBQcmVmZXIsIGluIG9yZGVyOlxuXHRcdGNvbnN0IGVudW0gU2NvcmUge1xuXHRcdFx0LyoqIFRoZSBmb2N1c2VkIHRocmVhZCAqL1xuXHRcdFx0Rm9jdXNlZCxcblx0XHRcdC8qKiBBbnkgb3RoZXIgc3RvcHBlZCB0aHJlYWQgb2YgYSBzZXNzaW9uIHRoYXQgdmVyaWZpZWQgdGhlIGJwICovXG5cdFx0XHRWZXJpZmllZCxcblx0XHRcdC8qKiBBbnkgdGhyZWFkIHRoYXQgdmVyaWZpZWQgYW5kIHBhdXNlZCBpbiB0aGUgc2FtZSBmaWxlICovXG5cdFx0XHRWZXJpZmllZEFuZFBhdXNlZEluRmlsZSxcblx0XHRcdC8qKiBUaGUgZm9jdXNlZCB0aHJlYWQgaWYgaXQgdmVyaWZpZWQgdGhlIGJyZWFrcG9pbnQgKi9cblx0XHRcdFZlcmlmaWVkQW5kRm9jdXNlZCxcblx0XHR9XG5cblx0XHRsZXQgYmVzdFRocmVhZCA9IHZpZXdNb2RlbC5mb2N1c2VkVGhyZWFkO1xuXHRcdGxldCBiZXN0U2NvcmUgPSBTY29yZS5Gb2N1c2VkO1xuXHRcdGZvciAoY29uc3Qgc2Vzc2lvbklkIG9mIGJyZWFrcG9pbnQuc2Vzc2lvbnNUaGF0VmVyaWZpZWQpIHtcblx0XHRcdGNvbnN0IHNlc3Npb24gPSBkZWJ1Z01vZGVsLmdldFNlc3Npb24oc2Vzc2lvbklkKTtcblx0XHRcdGlmICghc2Vzc2lvbikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdGhyZWFkcyA9IHNlc3Npb24uZ2V0QWxsVGhyZWFkcygpLmZpbHRlcih0ID0+IHQuc3RvcHBlZCk7XG5cdFx0XHRpZiAoYmVzdFNjb3JlIDwgU2NvcmUuVmVyaWZpZWRBbmRGb2N1c2VkKSB7XG5cdFx0XHRcdGlmICh2aWV3TW9kZWwuZm9jdXNlZFRocmVhZCAmJiB0aHJlYWRzLmluY2x1ZGVzKHZpZXdNb2RlbC5mb2N1c2VkVGhyZWFkKSkge1xuXHRcdFx0XHRcdGJlc3RUaHJlYWQgPSB2aWV3TW9kZWwuZm9jdXNlZFRocmVhZDtcblx0XHRcdFx0XHRiZXN0U2NvcmUgPSBTY29yZS5WZXJpZmllZEFuZEZvY3VzZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGJlc3RTY29yZSA8IFNjb3JlLlZlcmlmaWVkQW5kUGF1c2VkSW5GaWxlKSB7XG5cdFx0XHRcdGNvbnN0IHBhdXNlZEluVGhpc0ZpbGUgPSB0aHJlYWRzLmZpbmQodCA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgdG9wID0gdC5nZXRUb3BTdGFja0ZyYW1lKCk7XG5cdFx0XHRcdFx0cmV0dXJuIHRvcCAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbCh0b3Auc291cmNlLnVyaSwgdXJpKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0aWYgKHBhdXNlZEluVGhpc0ZpbGUpIHtcblx0XHRcdFx0XHRiZXN0VGhyZWFkID0gcGF1c2VkSW5UaGlzRmlsZTtcblx0XHRcdFx0XHRiZXN0U2NvcmUgPSBTY29yZS5WZXJpZmllZEFuZFBhdXNlZEluRmlsZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYmVzdFNjb3JlIDwgU2NvcmUuVmVyaWZpZWQpIHtcblx0XHRcdFx0YmVzdFRocmVhZCA9IHRocmVhZHNbMF07XG5cdFx0XHRcdGJlc3RTY29yZSA9IFNjb3JlLlZlcmlmaWVkQW5kUGF1c2VkSW5GaWxlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7IHRocmVhZDogYmVzdFRocmVhZCwgYnJlYWtwb2ludCB9O1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdGFja0ZyYW1lVGhyZWFkQW5kU2Vzc2lvblRvRm9jdXMobW9kZWw6IElEZWJ1Z01vZGVsLCBzdGFja0ZyYW1lOiBJU3RhY2tGcmFtZSB8IHVuZGVmaW5lZCwgdGhyZWFkPzogSVRocmVhZCwgc2Vzc2lvbj86IElEZWJ1Z1Nlc3Npb24sIGF2b2lkU2Vzc2lvbj86IElEZWJ1Z1Nlc3Npb24pOiB7IHN0YWNrRnJhbWU6IElTdGFja0ZyYW1lIHwgdW5kZWZpbmVkOyB0aHJlYWQ6IElUaHJlYWQgfCB1bmRlZmluZWQ7IHNlc3Npb246IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQgfSB7XG5cdGlmICghc2Vzc2lvbikge1xuXHRcdGlmIChzdGFja0ZyYW1lIHx8IHRocmVhZCkge1xuXHRcdFx0c2Vzc2lvbiA9IHN0YWNrRnJhbWUgPyBzdGFja0ZyYW1lLnRocmVhZC5zZXNzaW9uIDogdGhyZWFkIS5zZXNzaW9uO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBzZXNzaW9ucyA9IG1vZGVsLmdldFNlc3Npb25zKCk7XG5cdFx0XHRjb25zdCBzdG9wcGVkU2Vzc2lvbiA9IHNlc3Npb25zLmZpbmQocyA9PiBzLnN0YXRlID09PSBTdGF0ZS5TdG9wcGVkKTtcblx0XHRcdC8vIE1ha2Ugc3VyZSB0byBub3QgZm9jdXMgc2Vzc2lvbiB0aGF0IGlzIGdvaW5nIGRvd25cblx0XHRcdHNlc3Npb24gPSBzdG9wcGVkU2Vzc2lvbiB8fCBzZXNzaW9ucy5maW5kKHMgPT4gcyAhPT0gYXZvaWRTZXNzaW9uICYmIHMgIT09IGF2b2lkU2Vzc2lvbj8ucGFyZW50U2Vzc2lvbikgfHwgKHNlc3Npb25zLmxlbmd0aCA/IHNlc3Npb25zWzBdIDogdW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRpZiAoIXRocmVhZCkge1xuXHRcdGlmIChzdGFja0ZyYW1lKSB7XG5cdFx0XHR0aHJlYWQgPSBzdGFja0ZyYW1lLnRocmVhZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdGhyZWFkcyA9IHNlc3Npb24gPyBzZXNzaW9uLmdldEFsbFRocmVhZHMoKSA6IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IHN0b3BwZWRUaHJlYWQgPSB0aHJlYWRzICYmIHRocmVhZHMuZmluZCh0ID0+IHQuc3RvcHBlZCk7XG5cdFx0XHR0aHJlYWQgPSBzdG9wcGVkVGhyZWFkIHx8ICh0aHJlYWRzICYmIHRocmVhZHMubGVuZ3RoID8gdGhyZWFkc1swXSA6IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFzdGFja0ZyYW1lICYmIHRocmVhZCkge1xuXHRcdHN0YWNrRnJhbWUgPSB0aHJlYWQuZ2V0VG9wU3RhY2tGcmFtZSgpO1xuXHR9XG5cblx0cmV0dXJuIHsgc2Vzc2lvbiwgdGhyZWFkLCBzdGFja0ZyYW1lIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRUb09uZU9yQWxsU2Vzc2lvbnMobW9kZWw6IERlYnVnTW9kZWwsIHNlc3Npb246IElEZWJ1Z1Nlc3Npb24gfCB1bmRlZmluZWQsIHNlbmQ6IChzZXNzaW9uOiBJRGVidWdTZXNzaW9uKSA9PiBQcm9taXNlPHZvaWQ+KTogUHJvbWlzZTx2b2lkPiB7XG5cdGlmIChzZXNzaW9uKSB7XG5cdFx0YXdhaXQgc2VuZChzZXNzaW9uKTtcblx0fSBlbHNlIHtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChtb2RlbC5nZXRTZXNzaW9ucygpLm1hcChzID0+IHNlbmQocykpKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFVBQVU7QUFDdEIsU0FBUyxjQUF1QjtBQUNoQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGtCQUFrQixtQkFBbUI7QUFDOUMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywwQkFBMEI7QUFDbkMsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsdUJBQW9DO0FBQzdDLFNBQVMsV0FBVyxjQUFjO0FBQ2xDLE9BQU8sY0FBYztBQUNyQixTQUFTLFdBQXVCO0FBQ2hDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsb0JBQW9CO0FBRTdCLFlBQVksU0FBUztBQUNyQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBa0Msb0JBQW9CO0FBQy9ELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMEJBQTRDLHNCQUFzQjtBQUMzRSxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLG9CQUFvQjtBQUU3QixTQUFTLHdCQUF3Qiw2QkFBNkI7QUFDOUQsU0FBUyxrQkFBa0IsbUJBQW1CO0FBQzlDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMseUJBQXlCLGFBQWE7QUFDL0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxjQUFjLDJCQUEyQjtBQUNsRCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQiwyQkFBMkIscUJBQXFCLG9CQUFvQixrQkFBa0IsZ0NBQWdDLHNCQUFzQix1QkFBdUIscUJBQXFCLGNBQW9VLGNBQWMsT0FBTyxZQUFZLHlCQUF5QixxQkFBcUI7QUFDdm1CLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsWUFBWSxnQkFBZ0IsWUFBWSxvQkFBdUcsNkJBQTZCO0FBQ3JMLFNBQVMsY0FBYztBQUN2QixTQUFTLG9CQUF3QztBQUNqRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDhCQUE4QiwrQkFBK0I7QUFDdEUsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw0QkFBNEIsNkJBQTZCO0FBQ2xFLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsaUJBQWlCLHFCQUFxQjtBQUV4QyxJQUFNLGVBQU4sTUFBNEM7QUFBQSxFQWdDbEQsWUFDa0MsZUFDVyxzQkFDWixjQUNTLHVCQUNGLHFCQUNOLGVBQ1MsZUFDQyxnQkFDTixtQkFDRCxrQkFDSSxzQkFDSixrQkFDTCxhQUNTLHNCQUNLLDJCQUNWLGlCQUNELGdCQUNHLG1CQUNXLDhCQUNWLG9CQUNQLGFBQzlCO0FBckJnQztBQUNXO0FBQ1o7QUFDUztBQUNGO0FBQ047QUFDUztBQUNDO0FBQ047QUFDRDtBQUNJO0FBQ0o7QUFDTDtBQUNTO0FBQ0s7QUFDVjtBQUNEO0FBQ0c7QUFDVztBQUNWO0FBQ1A7QUE5Q2hDLFNBQWlCLHFCQUFxQixvQkFBSSxJQUFtQjtBQVE3RCxTQUFpQixjQUFjLElBQUksZ0JBQWdCO0FBU25ELFNBQVEsZUFBZTtBQUd2QixTQUFRLDRCQUE0QixvQkFBSSxJQUFxQztBQUc3RSxTQUFRLG9CQUFvQjtBQXlCM0IsU0FBSyxtQ0FBbUMsb0JBQUksSUFBUztBQUVyRCxTQUFLLG9CQUFvQixJQUFJLFFBQWU7QUFDNUMsU0FBSyxtQkFBbUIsSUFBSSxRQUF1QjtBQUNuRCxTQUFLLG9CQUFvQixJQUFJLFFBQXVCO0FBQ3BELFNBQUssbUJBQW1CLElBQUksUUFBUTtBQUVwQyxTQUFLLGlCQUFpQixLQUFLLHFCQUFxQixlQUFlLGdCQUFnQjtBQUFBLE1BQzlFLGlCQUFpQixLQUFLO0FBQUEsTUFDdEIsc0JBQXNCLE1BQU0sS0FBSztBQUFBLElBQ2xDLENBQUM7QUFDRCxTQUFLLFlBQVksSUFBSSxLQUFLLGNBQWM7QUFDeEMsU0FBSyx1QkFBdUIsS0FBSyxxQkFBcUIsZUFBZSxzQkFBc0IsS0FBSyxjQUFjO0FBQzlHLFNBQUssWUFBWSxJQUFJLEtBQUssb0JBQW9CO0FBQzlDLFNBQUssZUFBZSxLQUFLLFlBQVksSUFBSSxLQUFLLHFCQUFxQixlQUFlLFlBQVksQ0FBQztBQUUvRixTQUFLLHFCQUFxQixLQUFLLGFBQWEsdUJBQXVCO0FBRW5FLFNBQUssUUFBUSxLQUFLLHFCQUFxQixlQUFlLFlBQVksS0FBSyxZQUFZO0FBQ25GLFNBQUssWUFBWSxLQUFLLHFCQUFxQixlQUFlLGdCQUFnQixLQUFLLEtBQUs7QUFFcEYsU0FBSyxZQUFZLElBQUksVUFBVSxpQkFBaUI7QUFDaEQsU0FBSyxhQUFhLEtBQUsscUJBQXFCLGVBQWUsZUFBZTtBQUUxRSxTQUFLLFlBQVksSUFBSSxLQUFLLFlBQVksaUJBQWlCLE9BQUssS0FBSyxjQUFjLENBQUMsQ0FBQyxDQUFDO0FBQ2xGLFNBQUssWUFBWSxJQUFJLEtBQUssaUJBQWlCLGVBQWUsS0FBSyxTQUFTLElBQUksQ0FBQztBQUU3RSxTQUFLLFlBQVksSUFBSSxLQUFLLDBCQUEwQixnQkFBZ0IsV0FBUztBQUM1RSxZQUFNLFVBQVUsS0FBSyxNQUFNLFdBQVcsTUFBTSxXQUFXLElBQUk7QUFDM0QsVUFBSSxTQUFTO0FBRVosZ0JBQVEsY0FBYyxVQUFVO0FBQ2hDLGdCQUFRLGNBQWMsT0FBTyxNQUFNO0FBQ25DLGdCQUFRLFNBQVMsTUFBTSxLQUFLO0FBQzVCLGFBQUssd0JBQXdCLE9BQU87QUFBQSxNQUNyQztBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQ0YsU0FBSyxZQUFZLElBQUksS0FBSywwQkFBMEIsbUJBQW1CLFdBQVM7QUFDL0UsWUFBTSxVQUFVLEtBQUssTUFBTSxXQUFXLE1BQU0sU0FBUztBQUNyRCxVQUFJLFdBQVcsUUFBUSxVQUFVLE1BQU0sT0FBTztBQUM3QyxnQkFBUSxXQUFXO0FBQUEsTUFDcEI7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssWUFBWSxJQUFJLEtBQUssVUFBVSxxQkFBcUIsTUFBTTtBQUM5RCxXQUFLLGNBQWM7QUFBQSxJQUNwQixDQUFDLENBQUM7QUFDRixTQUFLLFlBQVksSUFBSSxLQUFLLFVBQVUsa0JBQWtCLENBQUMsWUFBdUM7QUFDN0YsV0FBSyxjQUFjO0FBRW5CLFVBQUksU0FBUztBQUNaLGFBQUssc0NBQXNDLFFBQVEsTUFBTSxDQUFDO0FBQUEsTUFDM0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLFNBQUssWUFBWSxJQUFJLE1BQU0sSUFBSSxLQUFLLGVBQWUsdUJBQXVCLEtBQUsscUJBQXFCLHdCQUF3QixFQUFFLE1BQU07QUFDbkksWUFBTSxlQUFnQixLQUFLLFVBQVUsTUFBTSxZQUFhLEtBQUsscUJBQXFCLHFCQUFxQixFQUFFLFNBQVMsS0FBSyxLQUFLLGVBQWUsb0JBQW9CLElBQU0sWUFBWTtBQUNqTCxXQUFLLFFBQVEsSUFBSSxZQUFZO0FBQzdCLFdBQUssYUFBYSxrQkFBa0IsWUFBWTtBQUFBLElBQ2pELENBQUMsQ0FBQztBQUNGLFNBQUssWUFBWSxJQUFJLEtBQUssTUFBTSxxQkFBcUIsTUFBTTtBQUMxRCxZQUFNLG1CQUFtQixLQUFLLE1BQU0sWUFBWSxFQUFFLE9BQU8sT0FBSyxDQUFDLEVBQUUsYUFBYSxFQUFFO0FBQ2hGLFdBQUssVUFBVSxRQUFRO0FBQ3ZCLFVBQUksbUJBQW1CLEdBQUc7QUFDekIsY0FBTSxnQkFBZ0IsS0FBSyxzQkFBc0IseUJBQXlCLGlCQUFpQjtBQUMzRixZQUFJLGVBQWU7QUFDbEIsZUFBSyxXQUFXLEtBQUssZ0JBQWdCLDBCQUEwQixjQUFjLElBQUksRUFBRSxPQUFPLElBQUksWUFBWSxrQkFBa0IsT0FBSyxNQUFNLElBQUksSUFBSSxTQUFTLGtCQUFrQixrQkFBa0IsSUFBSSxJQUFJLFNBQVMsbUJBQW1CLHVCQUF1QixDQUFDLENBQUMsRUFBRSxDQUFDO0FBQUEsUUFDN1A7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLFlBQVksSUFBSSxjQUFjLHdCQUF3QixNQUFNO0FBQ2hFLFdBQUssa0JBQWtCLG1CQUFtQixNQUFNO0FBQy9DLFlBQUksY0FBYyxpQkFBaUIscUJBQXFCLFVBQVU7QUFDakUsZUFBSyxxQkFBcUIsSUFBSSxJQUFJO0FBQUEsUUFDbkMsT0FBTztBQUVOLGVBQUssc0JBQXNCLE1BQU07QUFBQSxRQUNsQztBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQyxDQUFDO0FBRUYsU0FBSyxZQUFZLElBQUksS0FBSyxpQkFBaUIsaUJBQWlCLE1BQU07QUFDakUsaUJBQVcsVUFBVSxjQUFjLFNBQVM7QUFFM0MsWUFBSSxPQUFPLFVBQVUsV0FBVyxxQkFBcUI7QUFDcEQsaUJBQU8sUUFBUTtBQUFBLFFBQ2hCO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxZQUFZLElBQUksaUJBQWlCLFdBQVcsU0FBTztBQUN2RCxVQUFJO0FBQUEsUUFDSCxLQUFLLE1BQU0sWUFBWSxFQUFFLFNBQVM7QUFBQSxRQUNsQyxJQUFJLFNBQVMsd0JBQXdCLHdEQUF3RDtBQUFBLE1BQzlGO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixTQUFLLGdCQUFnQixpQkFBaUI7QUFBQSxFQUN2QztBQUFBLEVBRVEsZ0JBQWdCLG1CQUE2QztBQUNwRSxtQkFBZSxNQUFNO0FBQ3BCLHdCQUFrQixtQkFBbUIsTUFBTTtBQUMxQyxhQUFLLFlBQVksbUJBQW1CLE9BQU8saUJBQWlCO0FBQzVELGFBQUssYUFBYSxvQkFBb0IsT0FBTyxpQkFBaUI7QUFDOUQsYUFBSyxjQUFjLHFCQUFxQixPQUFPLGlCQUFpQjtBQUNoRSxhQUFLLGNBQWMsc0JBQXNCLE9BQU8saUJBQWlCO0FBQ2pFLGFBQUssVUFBVSxpQkFBaUIsT0FBTyxpQkFBaUI7QUFDeEQsYUFBSyxRQUFRLElBQUksS0FBSyxhQUFhLGlCQUFpQixDQUFDO0FBQ3JELGFBQUssbUJBQW1CLDBCQUEwQixPQUFPLGlCQUFpQjtBQUUxRSxhQUFLLHVCQUF1QiwrQkFBK0IsT0FBTyxpQkFBaUI7QUFBQSxNQUNwRixDQUFDO0FBRUQsWUFBTSw2QkFBNkIsTUFBTSxLQUFLLGlCQUFpQixJQUFJLENBQUMsRUFBRSxLQUFLLE1BQU0sZUFBZSxFQUFFLFVBQVUsS0FBSyxNQUFNLG1CQUFtQixFQUFFLFVBQVUsS0FBSyxNQUFNLHVCQUF1QixFQUFFLE9BQU87QUFDak0saUNBQTJCO0FBQzNCLFdBQUssWUFBWSxJQUFJLEtBQUssTUFBTSx1QkFBdUIsTUFBTSwyQkFBMkIsQ0FBQyxDQUFDO0FBQUEsSUFDM0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLFdBQXdCO0FBQ3ZCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLGVBQTJCO0FBQzFCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLDBCQUFpRDtBQUNoRCxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxvQkFBcUM7QUFDcEMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEscUJBQXFCQSxNQUFnQjtBQUNwQyxTQUFLLE1BQU0scUJBQXFCQSxJQUFHO0FBQUEsRUFDcEM7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsU0FBSyxZQUFZLFFBQVE7QUFBQSxFQUMxQjtBQUFBO0FBQUEsRUFJQSxJQUFJLFFBQWU7QUFDbEIsVUFBTSxpQkFBaUIsS0FBSyxVQUFVO0FBQ3RDLFFBQUksZ0JBQWdCO0FBQ25CLGFBQU8sZUFBZTtBQUFBLElBQ3ZCO0FBRUEsV0FBTyxLQUFLLGVBQWUsTUFBTSxlQUFlLE1BQU07QUFBQSxFQUN2RDtBQUFBLEVBRUEsSUFBSSxzQkFBd0Q7QUFDM0QsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRVEsdUJBQXVCLFNBQXNDO0FBQ3BFLFFBQUksQ0FBQyxLQUFLLGNBQWM7QUFDdkIsV0FBSyxlQUFlO0FBQ3BCLFdBQUssdUJBQXVCO0FBQzVCLFdBQUssY0FBYztBQUFBLElBQ3BCO0FBQUEsRUFDRDtBQUFBLEVBRVEsdUJBQTZCO0FBQ3BDLFFBQUksS0FBSyxjQUFjO0FBQ3RCLFdBQUssZUFBZTtBQUNwQixXQUFLLHVCQUF1QjtBQUM1QixXQUFLLGNBQWM7QUFBQSxJQUNwQjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGFBQWEsSUFBOEI7QUFDbEQsUUFBSSxJQUFJO0FBQ1AsWUFBTSxRQUFRLEtBQUssMEJBQTBCLElBQUksRUFBRTtBQUNuRCxVQUFJLE9BQU87QUFDVixjQUFNLE9BQU87QUFDYixhQUFLLDBCQUEwQixPQUFPLEVBQUU7QUFBQSxNQUN6QztBQUFBLElBQ0QsT0FBTztBQUNOLFdBQUssMEJBQTBCLFFBQVEsT0FBSyxFQUFFLE9BQU8sQ0FBQztBQUN0RCxXQUFLLDBCQUEwQixNQUFNO0FBQUEsSUFDdEM7QUFBQSxFQUNEO0FBQUEsRUFFUSxnQkFBc0I7QUFDN0IsVUFBTSxRQUFRLEtBQUs7QUFDbkIsUUFBSSxLQUFLLGtCQUFrQixPQUFPO0FBQ2pDLFdBQUssa0JBQWtCLG1CQUFtQixNQUFNO0FBQy9DLGFBQUssV0FBVyxJQUFJLGNBQWMsS0FBSyxDQUFDO0FBQ3hDLGFBQUssWUFBWSxJQUFJLFVBQVUsTUFBTSxRQUFRO0FBRTdDLGNBQU0sZUFBaUIsVUFBVSxNQUFNLFlBQVksVUFBVSxNQUFNLGdCQUFrQixLQUFLLGVBQWUsb0JBQW9CLEtBQUssS0FBSyxxQkFBcUIsc0JBQXNCLE9BQVMsWUFBWTtBQUN2TSxhQUFLLFFBQVEsSUFBSSxZQUFZO0FBQzdCLGFBQUssYUFBYSxrQkFBa0IsWUFBWTtBQUFBLE1BQ2pELENBQUM7QUFDRCxXQUFLLGdCQUFnQjtBQUNyQixXQUFLLGtCQUFrQixLQUFLLEtBQUs7QUFBQSxJQUNsQztBQUFBLEVBQ0Q7QUFBQSxFQUVBLElBQUksbUJBQWlDO0FBQ3BDLFdBQU8sS0FBSyxrQkFBa0I7QUFBQSxFQUMvQjtBQUFBLEVBRUEsSUFBSSxrQkFBd0M7QUFDM0MsV0FBTyxLQUFLLGlCQUFpQjtBQUFBLEVBQzlCO0FBQUEsRUFFQSxJQUFJLG1CQUF5QztBQUM1QyxXQUFPLEtBQUssa0JBQWtCO0FBQUEsRUFDL0I7QUFBQSxFQUVBLElBQUksa0JBQXVFO0FBQzFFLFdBQU8sS0FBSyxpQkFBaUI7QUFBQSxFQUM5QjtBQUFBLEVBRVEsWUFBWTtBQUNuQixRQUFJLENBQUMsS0FBSyxtQkFBbUI7QUFHNUIsV0FBSyxZQUFZLElBQUksS0FBSyxZQUFZLGlCQUFpQixxQkFBcUIsS0FBSyxZQUFZLElBQUksSUFBSSw4QkFBOEIsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMxSSxXQUFLLG9CQUFvQjtBQUFBLElBQzFCO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVFBLE1BQU0sZUFBZSxRQUE2QixjQUFpQyxTQUFnQyxrQkFBa0IsQ0FBQyxTQUFTLGVBQWlDO0FBQy9LLFVBQU0sVUFBVSxXQUFXLFFBQVEsVUFBVSxJQUFJLFNBQVMsWUFBWSxvRUFBb0UsSUFBSSxJQUFJLFNBQVMsY0FBYyxzRUFBc0U7QUFDL08sVUFBTSxRQUFRLE1BQU0sS0FBSyw2QkFBNkIsc0JBQXNCLEVBQUUsUUFBUSxDQUFDO0FBQ3ZGLFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTztBQUFBLElBQ1I7QUFFQSxTQUFLLFVBQVU7QUFDZixTQUFLLHVCQUF1QixPQUFPO0FBQ25DLFNBQUssWUFBWSxJQUFJLElBQUk7QUFDekIsUUFBSTtBQUVILFlBQU0sS0FBSyxpQkFBaUIsZ0JBQWdCLFNBQVM7QUFDckQsVUFBSSxpQkFBaUI7QUFDcEIsY0FBTSx3QkFBd0IsS0FBSyxzQkFBc0IsS0FBSyxhQUFhO0FBQUEsTUFDNUU7QUFDQSxZQUFNLEtBQUssaUJBQWlCLGtDQUFrQztBQUU5RCxVQUFJO0FBQ0osVUFBSTtBQUNKLFVBQUksQ0FBQyxjQUFjO0FBQ2xCLHVCQUFlLEtBQUsscUJBQXFCLHNCQUFzQjtBQUFBLE1BQ2hFO0FBQ0EsVUFBSSxPQUFPLGlCQUFpQixZQUFZLFFBQVE7QUFDL0MsaUJBQVMsT0FBTyxpQkFBaUIsWUFBWTtBQUM3QyxtQkFBVyxPQUFPLFlBQVksWUFBWTtBQUFBLE1BQzNDLFdBQVcsT0FBTyxpQkFBaUIsVUFBVTtBQUM1QyxpQkFBUztBQUFBLE1BQ1Y7QUFFQSxVQUFJLFVBQVU7QUFFYixZQUFJLENBQUMsU0FBUyxnQkFBZ0I7QUFDN0IsZ0JBQU0sSUFBSSxNQUFNLElBQUk7QUFBQSxZQUFTLEVBQUUsS0FBSyxrQ0FBa0MsU0FBUyxDQUFDLHVEQUF1RCw4REFBOEQsRUFBRTtBQUFBLFlBQ3RNO0FBQUEsVUFBZ0csQ0FBQztBQUFBLFFBQ25HO0FBQ0EsWUFBSSxTQUFTLGVBQWU7QUFDM0IsZ0JBQU0sYUFBYSxNQUFNLEtBQUssV0FBVyxzQkFBc0IsUUFBUSxhQUFhLEtBQUssZUFBZSxhQUFhLEdBQUcsU0FBUyxhQUFhO0FBQzlJLGNBQUksZUFBZSxjQUFjLFNBQVM7QUFDekMsaUJBQUsscUJBQXFCO0FBQzFCLG1CQUFPO0FBQUEsVUFDUjtBQUFBLFFBQ0Q7QUFDQSxZQUFJLFNBQVMsU0FBUztBQUNyQixvQkFBVSxFQUFFLEdBQUcsU0FBUyxjQUFjLElBQUksa0JBQWtCLEVBQUU7QUFBQSxRQUMvRDtBQUVBLGNBQU0sU0FBUyxNQUFNLFFBQVEsSUFBSSxTQUFTLGVBQWUsSUFBSSxnQkFBYztBQUMxRSxnQkFBTSxPQUFPLE9BQU8sZUFBZSxXQUFXLGFBQWEsV0FBVztBQUN0RSxjQUFJLFNBQVMsU0FBUyxNQUFNO0FBQzNCLG1CQUFPLFFBQVEsUUFBUSxLQUFLO0FBQUEsVUFDN0I7QUFFQSxjQUFJO0FBQ0osY0FBSSxPQUFPLGVBQWUsVUFBVTtBQUNuQyxrQkFBTSx5QkFBeUIsS0FBSyxxQkFBcUIsWUFBWSxFQUFFLE9BQU8sT0FBSyxDQUFDLENBQUMsRUFBRSxpQkFBaUIsSUFBSSxDQUFDO0FBQzdHLGdCQUFJLHVCQUF1QixXQUFXLEdBQUc7QUFDeEMsOEJBQWdCLHVCQUF1QixDQUFDO0FBQUEsWUFDekMsV0FBVyxVQUFVLHVCQUF1QixTQUFTLEtBQUssdUJBQXVCLFFBQVEsTUFBTSxLQUFLLEdBQUc7QUFFdEcsOEJBQWdCO0FBQUEsWUFDakIsT0FBTztBQUNOLG9CQUFNLElBQUksTUFBTSx1QkFBdUIsV0FBVyxJQUFJLElBQUksU0FBUyxrQ0FBa0MsK0RBQStELElBQUksSUFDckssSUFBSSxTQUFTLHlDQUF5QyxrSEFBa0gsSUFBSSxDQUFDO0FBQUEsWUFDakw7QUFBQSxVQUNELFdBQVcsV0FBVyxRQUFRO0FBQzdCLGtCQUFNLDZCQUE2QixLQUFLLHFCQUFxQixZQUFZLEVBQUUsT0FBTyxPQUFLLEVBQUUsYUFBYSxFQUFFLFVBQVUsU0FBUyxXQUFXLFVBQVUsQ0FBQyxDQUFDLEVBQUUsaUJBQWlCLFdBQVcsSUFBSSxDQUFDO0FBQ3JMLGdCQUFJLDJCQUEyQixXQUFXLEdBQUc7QUFDNUMsOEJBQWdCLDJCQUEyQixDQUFDO0FBQUEsWUFDN0MsT0FBTztBQUNOLG9CQUFNLElBQUksTUFBTSxJQUFJLFNBQVMsb0JBQW9CLGtGQUFrRixXQUFXLFFBQVEsV0FBVyxNQUFNLFNBQVMsSUFBSSxDQUFDO0FBQUEsWUFDdEw7QUFBQSxVQUNEO0FBRUEsaUJBQU8sS0FBSyxjQUFjLGVBQWUsY0FBZSxpQkFBaUIsSUFBSSxHQUFHLE9BQU87QUFBQSxRQUN4RixDQUFDLENBQUM7QUFFRixjQUFNQyxVQUFTLE9BQU8sTUFBTSxhQUFXLENBQUMsQ0FBQyxPQUFPO0FBQ2hELGFBQUsscUJBQXFCO0FBQzFCLGVBQU9BO0FBQUEsTUFDUjtBQUVBLFVBQUksZ0JBQWdCLENBQUMsUUFBUTtBQUM1QixjQUFNQyxXQUFVLENBQUMsQ0FBQyxTQUFTLElBQUksU0FBUyxpQkFBaUIsb0RBQW9ELE9BQU8saUJBQWlCLFdBQVcsZUFBZSxhQUFhLElBQUksSUFDL0ssSUFBSSxTQUFTLDBCQUEwQiwyREFBMkQ7QUFDbkcsY0FBTSxJQUFJLE1BQU1BLFFBQU87QUFBQSxNQUN4QjtBQUVBLFlBQU0sU0FBUyxNQUFNLEtBQUssY0FBYyxRQUFRLFFBQVEsT0FBTztBQUMvRCxXQUFLLHFCQUFxQjtBQUMxQixhQUFPO0FBQUEsSUFDUixTQUFTLEtBQUs7QUFFYixXQUFLLG9CQUFvQixNQUFNLEdBQUc7QUFDbEMsV0FBSyxxQkFBcUI7QUFDMUIsYUFBTyxRQUFRLE9BQU8sR0FBRztBQUFBLElBQzFCO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsTUFBYyxjQUFjLFFBQTZCLFFBQTZCLFNBQWtEO0FBR3ZJLFFBQUk7QUFDSixRQUFJLFFBQVE7QUFDWCxhQUFPLE9BQU87QUFBQSxJQUNmLE9BQU87QUFFTixlQUFTLHVCQUFPLE9BQU8sSUFBSTtBQUFBLElBQzVCO0FBQ0EsUUFBSSxXQUFXLFFBQVEsU0FBUztBQUMvQixhQUFPLFVBQVU7QUFBQSxJQUNsQixXQUFXLFdBQVcsT0FBTyxRQUFRLFlBQVksZUFBZSxRQUFRLGlCQUFpQixRQUFRLGNBQWMsY0FBYyxTQUFTO0FBQ3JJLGFBQU8sVUFBVTtBQUFBLElBQ2xCO0FBQ0EsVUFBTSxtQkFBbUIsVUFBVSxNQUFNO0FBRXpDLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSSxDQUFDLE1BQU07QUFDVixxQkFBZSxLQUFLLGNBQWM7QUFDbEMsVUFBSSxnQkFBZ0IsYUFBYSxVQUFVO0FBQzFDLGNBQU0sU0FBUyxLQUFLLG1CQUFtQixhQUFhLFNBQVMsU0FBUyxDQUFDO0FBQ3ZFLFlBQUksUUFBUTtBQUNYLGlCQUFPLE9BQU87QUFDZCxjQUFJLE9BQU8sY0FBYztBQUN4QixrQkFBTSxNQUFNLE1BQU0sS0FBSyxxQkFBcUIsK0JBQStCLE9BQU8sSUFBSTtBQUN0RixrQkFBTSxRQUFRLElBQUksS0FBSyxPQUFLLEVBQUUsVUFBVSxPQUFPLFlBQVk7QUFDM0QsZ0JBQUksT0FBTztBQUNWLHVCQUFTLE1BQU07QUFDZixxQkFBTyxPQUFPLFFBQVEsTUFBTSxNQUFNO0FBQUEsWUFDbkM7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFFQSxVQUFJLENBQUMsTUFBTTtBQUNWLGdCQUFRLE1BQU0sS0FBSyxlQUFlLGNBQWMsS0FBSztBQUNyRCxZQUFJLE9BQU87QUFDVixpQkFBTyxNQUFNLFNBQVM7QUFDdEIsY0FBSSxNQUFNLFlBQVk7QUFDckIscUJBQVMsTUFBTSxXQUFXO0FBQzFCLG1CQUFPLE9BQU8sUUFBUSxNQUFNLFdBQVcsTUFBTTtBQUFBLFVBQzlDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsVUFBTSx3QkFBd0IsSUFBSSx3QkFBd0I7QUFDMUQsVUFBTSxZQUFZLGFBQWE7QUFDL0IsU0FBSywwQkFBMEIsSUFBSSxXQUFXLHFCQUFxQjtBQUVuRSxVQUFNLG9CQUFvQixNQUFNLEtBQUsscUJBQXFCLGdDQUFnQyxVQUFVLE9BQU8sWUFBWSxPQUFPLFVBQVUsTUFBTSxRQUFXLE1BQU0sUUFBUSxzQkFBc0IsS0FBSztBQUVsTSxRQUFJLHFCQUFxQixrQkFBa0IsTUFBTTtBQUNoRCxVQUFJO0FBQ0gsWUFBSSxpQkFBaUIsTUFBTSxLQUFLLG9CQUFvQixRQUFRLGlCQUFpQjtBQUM3RSxZQUFJLENBQUMsZ0JBQWdCO0FBRXBCLGlCQUFPO0FBQUEsUUFDUjtBQUVBLFlBQUksc0JBQXNCLE1BQU0seUJBQXlCO0FBRXhELGlCQUFPO0FBQUEsUUFDUjtBQUVBLGNBQU0sWUFBWSxRQUFRLGFBQWEsS0FBSyxlQUFlLGFBQWE7QUFDeEUsY0FBTSxhQUFhLE1BQU0sS0FBSyxXQUFXLHNCQUFzQixXQUFXLGVBQWUsYUFBYTtBQUN0RyxZQUFJLGVBQWUsY0FBYyxTQUFTO0FBQ3pDLGlCQUFPO0FBQUEsUUFDUjtBQUVBLGNBQU0sTUFBTSxNQUFNLEtBQUsscUJBQXFCLGtEQUFrRCxVQUFVLE9BQU8sWUFBWSxPQUFPLFVBQVUsTUFBTSxRQUFXLGVBQWUsTUFBTSxnQkFBZ0Isc0JBQXNCLEtBQUs7QUFDN04sWUFBSSxDQUFDLEtBQUs7QUFDVCxjQUFJLFVBQVUsUUFBUSxRQUFRLFFBQVEsQ0FBQyxzQkFBc0IsTUFBTSx5QkFBeUI7QUFDM0Ysa0JBQU0sT0FBTyxlQUFlLEVBQUUsZUFBZSxNQUFNLEtBQUssR0FBRyxzQkFBc0IsS0FBSztBQUFBLFVBQ3ZGO0FBQ0EsaUJBQU87QUFBQSxRQUNSO0FBQ0EseUJBQWlCO0FBRWpCLGNBQU0sTUFBTSxLQUFLLGVBQWUsWUFBWSxlQUFlLElBQUk7QUFDL0QsWUFBSSxDQUFDLE9BQVEsa0JBQWtCLFlBQVksWUFBWSxrQkFBa0IsWUFBWSxVQUFXO0FBQy9GLGNBQUk7QUFDSixjQUFJLGtCQUFrQixZQUFZLFlBQVksa0JBQWtCLFlBQVksVUFBVTtBQUNyRixzQkFBVSxrQkFBa0IsVUFBVSxJQUFJLFNBQVMsNEJBQTRCLHFGQUFxRixXQUFXLGtCQUFrQixPQUFPLElBQ3JNLElBQUksU0FBUyxzQkFBc0IsbUVBQW1FLFNBQVM7QUFBQSxVQUVuSCxPQUFPO0FBQ04sc0JBQVUsZUFBZSxPQUFPLElBQUksU0FBUyx5QkFBeUIsaURBQWlELGVBQWUsSUFBSSxJQUN6SSxJQUFJLFNBQVMsb0JBQW9CLDhEQUE4RDtBQUFBLFVBQ2pHO0FBRUEsZ0JBQU0sYUFBd0IsQ0FBQztBQUUvQixxQkFBVyxLQUFLLElBQUk7QUFBQSxZQUNuQjtBQUFBLFlBQ0EsSUFBSSxTQUFTLEVBQUUsS0FBSyw4QkFBOEIsU0FBUyxDQUFDLGdFQUFnRSxFQUFFLEdBQUcseUJBQXlCLGVBQWUsSUFBSTtBQUFBLFlBQzdLO0FBQUEsWUFDQTtBQUFBLFlBQ0EsWUFBWSxLQUFLLGVBQWUsZUFBZSxvQ0FBb0MsZ0JBQWdCLElBQUk7QUFBQSxVQUN4RyxDQUFDO0FBRUQsZ0JBQU0sS0FBSyxVQUFVLFNBQVMsVUFBVTtBQUV4QyxpQkFBTztBQUFBLFFBQ1I7QUFFQSxZQUFJLENBQUMsSUFBSSxTQUFTO0FBQ2pCLGdCQUFNLEtBQUssVUFBVSx3QkFBd0IsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQzFELGlCQUFPO0FBQUEsUUFDUjtBQUVBLGNBQU0sU0FBUyxNQUFNLEtBQUssZ0JBQWdCLFdBQVcsUUFBUSxXQUFXLEVBQUUsVUFBVSxnQkFBZ0IsWUFBWSxpQkFBaUIsR0FBRyxPQUFPO0FBQzNJLFlBQUksVUFBVSxTQUFTLGdCQUFnQixhQUFhLFVBQVU7QUFFN0QsZUFBSyxtQkFBbUIsYUFBYSxTQUFTLFNBQVMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxNQUFNLFNBQVMsTUFBTSxjQUFjLE1BQU0sWUFBWSxNQUFNO0FBQy9ILGVBQUssYUFBYSx3QkFBd0IsS0FBSyxrQkFBa0I7QUFBQSxRQUNsRTtBQUNBLGVBQU87QUFBQSxNQUNSLFNBQVMsS0FBSztBQUNiLFlBQUksT0FBTyxJQUFJLFNBQVM7QUFDdkIsZ0JBQU0sS0FBSyxVQUFVLElBQUksT0FBTztBQUFBLFFBQ2pDLFdBQVcsS0FBSyxlQUFlLGtCQUFrQixNQUFNLGVBQWUsT0FBTztBQUM1RSxnQkFBTSxLQUFLLFVBQVUsSUFBSSxTQUFTLCtCQUErQiw4SEFBOEgsQ0FBQztBQUFBLFFBQ2pNO0FBQ0EsWUFBSSxVQUFVLENBQUMsc0JBQXNCLE1BQU0seUJBQXlCO0FBQ25FLGdCQUFNLE9BQU8sZUFBZSxFQUFFLGVBQWUsS0FBSyxHQUFHLHNCQUFzQixLQUFLO0FBQUEsUUFDakY7QUFFQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFFQSxRQUFJLFVBQVUsUUFBUSxzQkFBc0IsUUFBUSxDQUFDLHNCQUFzQixNQUFNLHlCQUF5QjtBQUN6RyxZQUFNLE9BQU8sZUFBZSxFQUFFLGVBQWUsTUFBTSxLQUFLLEdBQUcsc0JBQXNCLEtBQUs7QUFBQSxJQUN2RjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxNQUFjLGdCQUFnQixXQUFtQixNQUFvQyxlQUF1RSxTQUFrRDtBQUU3TSxVQUFNLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSxjQUFjLFdBQVcsZUFBZSxNQUFNLEtBQUssT0FBTyxPQUFPO0FBQzFILFFBQUksU0FBUyxpQkFBaUIsS0FBSyxNQUFNLFlBQVksRUFBRSxLQUFLLE9BQUssRUFBRSxTQUFTLE1BQU0sUUFBUSxTQUFTLENBQUMsS0FBSyxjQUFjLFNBQVMsbUNBQW1DLE1BQU07QUFFeEssWUFBTSxTQUFTLE1BQU0sS0FBSyxjQUFjLFFBQVEsRUFBRSxTQUFTLElBQUksU0FBUyxtQkFBbUIsb0VBQW9FLFFBQVEsU0FBUyxDQUFDLEVBQUUsQ0FBQztBQUNwTCxVQUFJLENBQUMsT0FBTyxXQUFXO0FBQ3RCLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUVBLFNBQUssTUFBTSxXQUFXLE9BQU87QUFJN0IsU0FBSyxrQkFBa0IsS0FBSyxPQUFPO0FBRW5DLFVBQU0sWUFBWSxLQUFLLHFCQUFxQixTQUE4QixPQUFPLEVBQUU7QUFFbkYsUUFBSSxDQUFDLGNBQWMsU0FBUyxZQUFZLGNBQWMsd0JBQXlCLGNBQWMsZUFBZSxLQUFLLFVBQVUsc0JBQXVCLENBQUMsUUFBUSxtQkFBbUI7QUFDN0ssWUFBTSxLQUFLLHFCQUFxQixrQkFBa0IsWUFBWSxzQkFBc0IsT0FBTztBQUFBLElBQzVGO0FBRUEsUUFBSTtBQUNILFlBQU0sS0FBSyx3QkFBd0IsT0FBTztBQUUxQyxZQUFNLHlCQUF5QixRQUFRLGNBQWMsMEJBQTBCLEtBQUsscUJBQXFCLFNBQThCLE9BQU8sRUFBRTtBQUNoSixVQUFJLDJCQUEyQix3QkFBeUIsS0FBSyxVQUFVLHFCQUFxQiwyQkFBMkIsMkJBQTRCO0FBQ2xKLGFBQUssYUFBYSxTQUFTLGNBQWMsS0FBSztBQUFBLE1BQy9DO0FBRUEsV0FBSyxVQUFVLG9CQUFvQjtBQUNuQyxZQUFNLGtCQUFrQixLQUFLLHFCQUFxQixTQUE4QixPQUFPLEVBQUU7QUFDekYsWUFBTSxXQUFXLEtBQUssTUFBTSxZQUFZO0FBQ3hDLFlBQU0sZ0JBQWdCLGtCQUFrQixXQUFXLFNBQVMsT0FBTyxPQUFLLENBQUMsRUFBRSxhQUFhO0FBQ3hGLFVBQUksY0FBYyxTQUFTLEdBQUc7QUFDN0IsYUFBSyxVQUFVLG9CQUFvQixJQUFJO0FBQUEsTUFDeEM7QUFHQSxXQUFLLGlCQUFpQixLQUFLLE9BQU87QUFFbEMsYUFBTztBQUFBLElBQ1IsU0FBUyxPQUFPO0FBRWYsVUFBSSxPQUFPLG9CQUFvQixLQUFLLEdBQUc7QUFFdEMsZUFBTztBQUFBLE1BQ1I7QUFHQSxVQUFJLFdBQVcsUUFBUSxnQkFBZ0IsRUFBRSxTQUFTLEdBQUc7QUFDcEQsYUFBSyxhQUFhLFNBQVMsY0FBYyxLQUFLO0FBQUEsTUFDL0M7QUFFQSxVQUFJLFFBQVEsaUJBQWlCLFFBQVEsY0FBYyxZQUFZLFlBQVksUUFBUSxjQUFjLGNBQWM7QUFFOUcsZUFBTztBQUFBLE1BQ1I7QUFFQSxZQUFNLGVBQWUsaUJBQWlCLFFBQVEsTUFBTSxVQUFVO0FBQzlELFVBQUksTUFBTSxhQUFhLE9BQU87QUFFN0IsY0FBTSxLQUFLLFVBQVUsY0FBYyxtQkFBbUIsS0FBSyxJQUFJLE1BQU0sVUFBVSxDQUFDLENBQUM7QUFBQSxNQUNsRjtBQUNBLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyx3QkFBd0IsU0FBd0IsYUFBYSxPQUFzQjtBQUVoRyxTQUFLLHlCQUF5QixPQUFPO0FBRXJDLFVBQU0sT0FBTyxLQUFLLGVBQWUsWUFBWSxRQUFRLGNBQWMsSUFBSTtBQUN2RSxRQUFJO0FBQ0gsWUFBTSxRQUFRLFdBQVcsSUFBSztBQUM5QixZQUFNLFFBQVEsZUFBZSxRQUFRLGFBQWE7QUFDbEQsWUFBTSxtQkFBbUIsQ0FBQyxDQUFDLFFBQVEsUUFBUSxDQUFDLENBQUMsS0FBSyxxQkFBcUIsU0FBd0IsVUFBVSxFQUFFLFVBQVUsUUFBUSxLQUFLLElBQUksQ0FBQztBQUN2SSxZQUFNLEtBQUssVUFBVSxxQkFBcUIsTUFBTyxnQkFBZ0I7QUFFakUsVUFBSSxjQUFjLENBQUMsS0FBSyxVQUFVLGtCQUFtQixRQUFRLGtCQUFrQixLQUFLLFVBQVUsa0JBQWtCLFFBQVEsU0FBVTtBQUNqSSxjQUFNLEtBQUssZ0JBQWdCLFFBQVcsUUFBVyxPQUFPO0FBQUEsTUFDekQ7QUFBQSxJQUNELFNBQVMsS0FBSztBQUNiLFVBQUksS0FBSyxVQUFVLG1CQUFtQixTQUFTO0FBQzlDLGNBQU0sS0FBSyxnQkFBZ0IsTUFBUztBQUFBLE1BQ3JDO0FBQ0EsYUFBTyxRQUFRLE9BQU8sR0FBRztBQUFBLElBQzFCO0FBQUEsRUFDRDtBQUFBLEVBRVEseUJBQXlCLFNBQThCO0FBQzlELFVBQU0sc0JBQXNCLElBQUksZ0JBQWdCO0FBQ2hELFNBQUssWUFBWSxJQUFJLG1CQUFtQjtBQUV4QyxVQUFNLDBCQUEwQixvQkFBb0IsSUFBSSxJQUFJLGlCQUFpQixNQUFNO0FBRWxGLFVBQUksUUFBUSxVQUFVLE1BQU0sV0FBVyxLQUFLLFVBQVUsbUJBQW1CLFNBQVM7QUFDakYsYUFBSyxVQUFVLFNBQVMsUUFBVyxLQUFLLFVBQVUsZUFBZSxTQUFTLEtBQUs7QUFBQSxNQUNoRjtBQUFBLElBQ0QsR0FBRyxHQUFHLENBQUM7QUFDUCx3QkFBb0IsSUFBSSxRQUFRLGlCQUFpQixNQUFNO0FBQ3RELFVBQUksUUFBUSxVQUFVLE1BQU0sV0FBVyxLQUFLLFVBQVUsbUJBQW1CLFNBQVM7QUFDakYsZ0NBQXdCLFNBQVM7QUFBQSxNQUNsQztBQUNBLFVBQUksWUFBWSxLQUFLLFVBQVUsZ0JBQWdCO0FBQzlDLGFBQUssY0FBYztBQUFBLE1BQ3BCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRix3QkFBb0IsSUFBSSxLQUFLLGdCQUFnQixPQUFLO0FBQ2pELFVBQUksRUFBRSxZQUFZLFNBQVM7QUFDMUIsYUFBSyxZQUFZLE9BQU8sbUJBQW1CO0FBQUEsTUFDNUM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLHdCQUFvQixJQUFJLFFBQVEsZ0JBQWdCLE9BQU0scUJBQW9CO0FBRXpFLFVBQUksa0JBQWtCO0FBQ3JCLFlBQUksaUJBQWlCLE9BQU87QUFDM0IsZUFBSyxvQkFBb0IsTUFBTSxJQUFJLFNBQVMscUJBQXFCLDJEQUEyRCxpQkFBaUIsTUFBTSxXQUFXLGlCQUFpQixNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQUEsUUFDak07QUFDQSxhQUFLLFVBQVUsb0JBQW9CLFNBQVMsZ0JBQWdCO0FBQUEsTUFDN0Q7QUFHQSxZQUFNLHdCQUF3Qiw2QkFBNkIsT0FBTztBQUNsRSxVQUFJLHlCQUF5QixzQkFBc0IsVUFBVSxNQUFNLFdBQVcsc0JBQXNCLGNBQWMsU0FBUztBQUMxSCxhQUFLLDBCQUEwQixNQUFNLHNCQUFzQixNQUFNLENBQUM7QUFBQSxNQUNuRTtBQUVBLFVBQUksUUFBUSxjQUFjLGVBQWU7QUFDeEMsY0FBTSxPQUFPLFFBQVEsUUFBUSxLQUFLLGVBQWUsYUFBYTtBQUM5RCxZQUFJO0FBQ0gsZ0JBQU0sS0FBSyxXQUFXLFFBQVEsTUFBTSxRQUFRLGNBQWMsYUFBYTtBQUFBLFFBQ3hFLFNBQVMsS0FBSztBQUNiLGVBQUssb0JBQW9CLE1BQU0sR0FBRztBQUFBLFFBQ25DO0FBQUEsTUFDRDtBQUNBLFdBQUsscUJBQXFCO0FBQzFCLFdBQUssYUFBYSxRQUFRLE1BQU0sQ0FBQztBQUVqQyxVQUFJLEtBQUsscUJBQXFCLFNBQThCLE9BQU8sRUFBRSx3QkFBd0I7QUFDNUYsY0FBTSxpQkFBaUIsS0FBSyxjQUFjLFdBQVcsYUFBYSxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUUsT0FBTyxNQUFNO0FBQ3BHLGlCQUFPLE9BQU8sVUFBVSxXQUFXLGdCQUFnQixRQUFRLE1BQU0sTUFBTSxPQUFPLG9CQUFvQixPQUFPLFFBQVEsRUFBRTtBQUFBLFFBQ3BILENBQUM7QUFDRCxhQUFLLGNBQWMsYUFBYSxjQUFjO0FBQUEsTUFDL0M7QUFDQSxXQUFLLGlCQUFpQixLQUFLLEVBQUUsU0FBUyxTQUFTLEtBQUssbUJBQW1CLElBQUksT0FBTyxFQUFFLENBQUM7QUFFckYsWUFBTSxpQkFBaUIsS0FBSyxVQUFVO0FBQ3RDLFVBQUksa0JBQWtCLGVBQWUsTUFBTSxNQUFNLFFBQVEsTUFBTSxHQUFHO0FBQ2pFLGNBQU0sRUFBRSxTQUFBQyxVQUFTLFFBQVEsV0FBVyxJQUFJLHFDQUFxQyxLQUFLLE9BQU8sUUFBVyxRQUFXLFFBQVcsY0FBYztBQUN4SSxhQUFLLFVBQVUsU0FBUyxZQUFZLFFBQVFBLFVBQVMsS0FBSztBQUFBLE1BQzNEO0FBRUEsVUFBSSxLQUFLLE1BQU0sWUFBWSxFQUFFLFdBQVcsR0FBRztBQUMxQyxhQUFLLFVBQVUsb0JBQW9CLEtBQUs7QUFFeEMsWUFBSSxLQUFLLGNBQWMsVUFBVSxNQUFNLFlBQVksS0FBSyxLQUFLLHFCQUFxQixTQUE4QixPQUFPLEVBQUUsbUJBQW1CO0FBQzNJLGVBQUsscUJBQXFCLGtCQUFrQixxQkFBcUIsc0JBQXNCLE9BQU87QUFBQSxRQUMvRjtBQUdBLGNBQU0sa0JBQWtCLEtBQUssTUFBTSxtQkFBbUIsRUFBRSxPQUFPLFNBQU8sQ0FBQyxJQUFJLFVBQVU7QUFDckYsd0JBQWdCLFFBQVEsU0FBTyxLQUFLLE1BQU0sc0JBQXNCLElBQUksTUFBTSxDQUFDLENBQUM7QUFFNUUsWUFBSSxLQUFLLHFCQUFxQixTQUE4QixPQUFPLEVBQUUsUUFBUSxZQUFZO0FBQ3hGLGdCQUFNLHdCQUF3QixLQUFLLHNCQUFzQix5QkFBeUIsWUFBWTtBQUM5RixjQUFJLHlCQUF5QixLQUFLLGFBQWEsdUJBQXVCLHNCQUFzQixFQUFFLEdBQUc7QUFDaEcsaUJBQUssYUFBYSxtQkFBbUIsc0JBQXNCLEVBQUU7QUFBQSxVQUM5RDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsV0FBSyxNQUFNLHFDQUFxQyxRQUFRLE1BQU0sQ0FBQztBQUFBLElBRWhFLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLE1BQU0sZUFBZSxTQUF3QixhQUFrQztBQUM5RSxRQUFJLFFBQVEsbUJBQW1CO0FBQzlCLFlBQU0sd0JBQXdCLEtBQUssc0JBQXNCLEtBQUssYUFBYTtBQUFBLElBQzVFO0FBRUEsVUFBTSxnQkFBZ0IsQ0FBQyxDQUFDO0FBRXhCLFVBQU0sV0FBeUMsWUFBWTtBQUMxRCxVQUFJLGVBQWU7QUFFbEIsZUFBTyxRQUFRLFFBQVEsY0FBYyxPQUFPO0FBQUEsTUFDN0M7QUFFQSxZQUFNLE9BQU8sUUFBUSxRQUFRLEtBQUssZUFBZSxhQUFhO0FBQzlELFlBQU0sS0FBSyxXQUFXLFFBQVEsTUFBTSxRQUFRLGNBQWMsY0FBYztBQUN4RSxZQUFNLEtBQUssV0FBVyxRQUFRLE1BQU0sUUFBUSxjQUFjLGFBQWE7QUFFdkUsWUFBTSxjQUFjLE1BQU0sS0FBSyxXQUFXLHNCQUFzQixNQUFNLFFBQVEsY0FBYyxhQUFhO0FBQ3pHLFVBQUksZ0JBQWdCLGNBQWMsU0FBUztBQUMxQyxlQUFPO0FBQUEsTUFDUjtBQUVBLGFBQU8sS0FBSyxXQUFXLHNCQUFzQixNQUFNLFFBQVEsY0FBYyxlQUFlO0FBQUEsSUFDekY7QUFFQSxVQUFNLHdCQUF3Qiw2QkFBNkIsT0FBTztBQUNsRSxRQUFJLHVCQUF1QjtBQUMxQixZQUFNLGFBQWEsTUFBTSxTQUFTO0FBQ2xDLFVBQUksZUFBZSxjQUFjLFNBQVM7QUFDekMsYUFBSywwQkFBMEIsT0FBTyxzQkFBc0IsTUFBTSxDQUFDO0FBQUEsTUFDcEU7QUFFQTtBQUFBLElBQ0Q7QUFHQSxRQUFJLG9CQUFvQjtBQUN4QixRQUFJO0FBQ0osVUFBTSxTQUFTLFFBQVEsT0FBTyxLQUFLLHFCQUFxQixVQUFVLFFBQVEsS0FBSyxHQUFHLElBQUk7QUFDdEYsUUFBSSxRQUFRO0FBQ1gsbUJBQWEsT0FBTyxpQkFBaUIsUUFBUSxjQUFjLElBQUk7QUFDL0QsVUFBSSxjQUFjLENBQUMsT0FBTyxZQUFZLFFBQVEsdUJBQXVCLEdBQUc7QUFDdkUsbUJBQVcsVUFBVSxRQUFRLGNBQWM7QUFDM0MsNEJBQW9CO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBRUEsUUFBSSxXQUF1QyxRQUFRO0FBQ25ELFFBQUksVUFBVSxxQkFBcUIsWUFBWTtBQUM5QyxZQUFNLHdCQUF3QixJQUFJLHdCQUF3QjtBQUMxRCxXQUFLLDBCQUEwQixJQUFJLFFBQVEsTUFBTSxHQUFHLHFCQUFxQjtBQUN6RSxZQUFNLHNCQUFzQixNQUFNLEtBQUsscUJBQXFCLGdDQUFnQyxPQUFPLFlBQVksT0FBTyxVQUFVLE1BQU0sUUFBVyxXQUFXLE1BQU0sWUFBWSxzQkFBc0IsS0FBSztBQUN6TSxVQUFJLHFCQUFxQjtBQUN4QixtQkFBVyxNQUFNLEtBQUssb0JBQW9CLFFBQVEsbUJBQW1CO0FBQ3JFLFlBQUksWUFBWSxDQUFDLHNCQUFzQixNQUFNLHlCQUF5QjtBQUNyRSxxQkFBVyxNQUFNLEtBQUsscUJBQXFCLGtEQUFrRCxVQUFVLE9BQU8sWUFBWSxPQUFPLFVBQVUsTUFBTSxRQUFXLFNBQVMsTUFBTSxVQUFVLHNCQUFzQixLQUFLO0FBQUEsUUFDak47QUFBQSxNQUNELE9BQU87QUFDTixtQkFBVztBQUFBLE1BQ1o7QUFBQSxJQUNEO0FBQ0EsUUFBSSxVQUFVO0FBQ2IsY0FBUSxpQkFBaUIsRUFBRSxVQUFVLFdBQVcsQ0FBQztBQUFBLElBQ2xEO0FBQ0EsWUFBUSxjQUFjLFlBQVk7QUFFbEMsVUFBTSxZQUFZLE9BQU8sT0FBMkM7QUFDbkUsV0FBSyxtQkFBbUIsSUFBSSxPQUFPO0FBQ25DLFVBQUksYUFBYTtBQUNqQixVQUFJO0FBQ0gscUJBQWMsTUFBTSxHQUFHLE1BQU87QUFBQSxNQUMvQixTQUFTLEdBQUc7QUFDWCxxQkFBYTtBQUNiLGNBQU07QUFBQSxNQUNQLFVBQUU7QUFDRCxhQUFLLG1CQUFtQixPQUFPLE9BQU87QUFJdEMsWUFBSSxDQUFDLFlBQVk7QUFDaEIsZUFBSyxpQkFBaUIsS0FBSyxFQUFFLFNBQVMsU0FBUyxNQUFNLENBQUM7QUFBQSxRQUN2RDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsZUFBVyxjQUFjLEtBQUssTUFBTSxlQUFlLEVBQUUsZUFBZSxLQUFLLENBQUMsR0FBRztBQUM1RSxpQkFBVyxxQkFBcUIsUUFBUSxNQUFNLEdBQUcsS0FBSztBQUFBLElBQ3ZEO0FBSUEsUUFBSSxRQUFRLG1CQUFtQjtBQUM5QixVQUFJLENBQUMsUUFBUSxrQkFBa0IsYUFBYTtBQUMzQyxnQkFBUSx3QkFBd0I7QUFDaEMsY0FBTSxNQUFNLFVBQVUsUUFBUSxrQkFBa0IsVUFBVTtBQUFBLE1BSTNEO0FBRUEsV0FBSyxZQUFZLGlCQUFpQixRQUFRLGtCQUFrQixPQUFPO0FBQ25FO0FBQUEsSUFDRDtBQUVBLFFBQUksUUFBUSxhQUFhLHdCQUF3QjtBQUNoRCxZQUFNLGFBQWEsTUFBTSxTQUFTO0FBQ2xDLFVBQUksZUFBZSxjQUFjLFNBQVM7QUFDekMsY0FBTSxVQUFVLFlBQVk7QUFDM0IsZ0JBQU0sUUFBUSxRQUFRO0FBQ3RCLGlCQUFPO0FBQUEsUUFDUixDQUFDO0FBQUEsTUFDRjtBQUVBO0FBQUEsSUFDRDtBQUVBLFVBQU0sY0FBYyxDQUFDLENBQUMsS0FBSyxVQUFVLGtCQUFrQixRQUFRLE1BQU0sTUFBTSxLQUFLLFVBQVUsZUFBZSxNQUFNO0FBQy9HLFdBQU8sVUFBVSxZQUFZO0FBRTVCLFVBQUksZUFBZTtBQUNsQixjQUFNLFFBQVEsV0FBVyxJQUFJO0FBQUEsTUFDOUIsT0FBTztBQUNOLGNBQU0sUUFBUSxVQUFVLElBQUk7QUFBQSxNQUM3QjtBQUVBLGFBQU8sSUFBSSxRQUFpQixDQUFDLEdBQUcsTUFBTTtBQUNyQyxtQkFBVyxZQUFZO0FBQ3RCLGdCQUFNLGFBQWEsTUFBTSxTQUFTO0FBQ2xDLGNBQUksZUFBZSxjQUFjLFNBQVM7QUFDekMsbUJBQU8sRUFBRSxLQUFLO0FBQUEsVUFDZjtBQUVBLGNBQUksQ0FBQyxVQUFVO0FBQ2QsbUJBQU8sRUFBRSxLQUFLO0FBQUEsVUFDZjtBQUVBLGNBQUk7QUFDSCxrQkFBTSxLQUFLLHdCQUF3QixTQUFTLFdBQVc7QUFDdkQsaUJBQUssaUJBQWlCLEtBQUssT0FBTztBQUNsQyxjQUFFLElBQUk7QUFBQSxVQUNQLFNBQVMsT0FBTztBQUNmLGNBQUUsS0FBSztBQUFBLFVBQ1I7QUFBQSxRQUNELEdBQUcsR0FBRztBQUFBLE1BQ1AsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sWUFBWSxTQUFvQyxhQUFhLE9BQU8sVUFBVSxPQUFxQjtBQUN4RyxRQUFJLFNBQVM7QUFDWixhQUFPLGFBQWEsUUFBUSxXQUFXLFFBQVcsT0FBTyxJQUFJLFFBQVEsVUFBVTtBQUFBLElBQ2hGO0FBRUEsVUFBTSxXQUFXLEtBQUssTUFBTSxZQUFZO0FBQ3hDLFFBQUksU0FBUyxXQUFXLEdBQUc7QUFDMUIsV0FBSyxXQUFXLE9BQU87QUFFdkIsWUFBTSxLQUFLLGtCQUFrQixPQUFPO0FBQ3BDLFdBQUsscUJBQXFCO0FBQzFCLFdBQUssYUFBYSxNQUFTO0FBQUEsSUFDNUI7QUFFQSxXQUFPLFFBQVEsSUFBSSxTQUFTLElBQUksT0FBSyxhQUFhLEVBQUUsV0FBVyxRQUFXLE9BQU8sSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQUEsRUFDcEc7QUFBQSxFQUVBLE1BQWMsb0JBQW9CLFFBQTZCLFFBQStDO0FBQzdHLFVBQU0sTUFBTSxLQUFLLGVBQWUsWUFBWSxPQUFPLElBQUk7QUFDdkQsUUFBSSxLQUFLO0FBQ1IsVUFBSSxTQUF1QztBQUMzQyxVQUFJLFVBQVUsT0FBTyxXQUFXO0FBQy9CLGlCQUFTLE9BQU87QUFBQSxNQUNqQixPQUFPO0FBQ04sY0FBTSxVQUFVLEtBQUssZUFBZSxhQUFhLEVBQUU7QUFDbkQsWUFBSSxRQUFRLFdBQVcsR0FBRztBQUN6QixtQkFBUyxRQUFRLENBQUM7QUFBQSxRQUNuQjtBQUFBLE1BQ0Q7QUFDQSxVQUFJO0FBQ0gsZUFBTyxNQUFNLElBQUksb0JBQW9CLFFBQVEsTUFBTTtBQUFBLE1BQ3BELFNBQVMsS0FBSztBQUNiLGFBQUssVUFBVSxJQUFJLFNBQVMsUUFBVyxDQUFDLENBQUMsUUFBUSxpQkFBaUIsT0FBTyxJQUFJLENBQUM7QUFDOUUsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQ0EsV0FBTyxRQUFRLFFBQVEsTUFBTTtBQUFBLEVBQzlCO0FBQUEsRUFFQSxNQUFjLFVBQVUsU0FBaUIsZUFBdUMsQ0FBQyxHQUFHLG1CQUFtQixNQUFxQjtBQUMzSCxVQUFNLGtCQUFrQixJQUFJLE9BQU8sNEJBQTRCLHVCQUF1QixRQUFXLE1BQU0sTUFBTSxLQUFLLGVBQWUsZUFBZSwwQkFBMEIsQ0FBQztBQUUzSyxVQUFNLFVBQVUsYUFBYSxPQUFPLENBQUMsV0FBVyxPQUFPLEdBQUcsU0FBUyxVQUFVLENBQUMsRUFBRSxTQUFTLElBQ3hGLGVBQ0EsQ0FBQyxHQUFHLGNBQWMsR0FBSSxtQkFBbUIsQ0FBQyxlQUFlLElBQUksQ0FBQyxDQUFFO0FBQ2pFLFVBQU0sS0FBSyxjQUFjLE9BQU87QUFBQSxNQUMvQixNQUFNLFNBQVM7QUFBQSxNQUNmO0FBQUEsTUFDQSxTQUFTLFFBQVEsSUFBSSxhQUFXO0FBQUEsUUFDL0IsT0FBTyxPQUFPO0FBQUEsUUFDZCxLQUFLLE1BQU0sT0FBTyxJQUFJO0FBQUEsTUFDdkIsRUFBRTtBQUFBLE1BQ0YsY0FBYztBQUFBLElBQ2YsQ0FBQztBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBSUEsTUFBTSxnQkFBZ0IsYUFBc0MsU0FBbUIsVUFBMEIsU0FBa0g7QUFDMU4sVUFBTSxFQUFFLFlBQVksUUFBUSxRQUFRLElBQUkscUNBQXFDLEtBQUssT0FBTyxhQUFhLFNBQVMsUUFBUTtBQUV2SCxRQUFJLFlBQVk7QUFDZixZQUFNLFNBQVMsTUFBTSxXQUFXLGFBQWEsS0FBSyxlQUFlLFNBQVMsaUJBQWlCLE1BQU0sU0FBUyxZQUFZLFNBQVMsTUFBTTtBQUNySSxVQUFJLFFBQVE7QUFDWCxZQUFJLE9BQU8sVUFBVSxxQkFBcUIsVUFBVTtBQUFBLFFBRXBELE9BQU87QUFDTixnQkFBTSxVQUFVLE9BQU8sV0FBVztBQUNsQyxjQUFJLGNBQWMsYUFBYSxPQUFPLEtBQUssUUFBUSxTQUFTLEdBQUc7QUFDOUQsa0JBQU0sUUFBUSxRQUFRLFNBQVM7QUFDL0Isa0JBQU0sYUFBYSxXQUFXLE1BQU07QUFDcEMsZ0JBQUksY0FBYyxLQUFLLGNBQWMsTUFBTSxhQUFhLEdBQUc7QUFDMUQsb0JBQU0sY0FBYyxRQUFRLFNBQVMsRUFBRSxlQUFlLFVBQVU7QUFDaEUsbUJBQUssTUFBTSxJQUFJO0FBQUEsZ0JBQVMsRUFBRSxLQUFLLG1CQUFtQixTQUFTLENBQUMsOExBQThMLEVBQUU7QUFBQSxnQkFDM1A7QUFBQSxnQkFBc0M7QUFBQSxnQkFBYSxVQUFVLE9BQU8saUJBQWlCLFlBQVksT0FBTyxlQUFlLE1BQU0sS0FBSztBQUFBLGdCQUFJLFdBQVcsU0FBUyxXQUFXLE9BQU8sT0FBTztBQUFBLGdCQUFJLFdBQVcsTUFBTTtBQUFBLGNBQWUsQ0FBQztBQUFBLFlBQzFOO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFFBQUksU0FBUztBQUNaLFdBQUssVUFBVSxJQUFJLFFBQVEsY0FBYyxJQUFJO0FBQUEsSUFDOUMsT0FBTztBQUNOLFdBQUssVUFBVSxNQUFNO0FBQUEsSUFDdEI7QUFFQSxTQUFLLFVBQVUsU0FBUyxZQUFZLFFBQVEsU0FBUyxDQUFDLENBQUMsU0FBUyxRQUFRO0FBQUEsRUFDekU7QUFBQTtBQUFBLEVBSUEsbUJBQW1CLE1BQXFCO0FBQ3ZDLFVBQU0sS0FBSyxLQUFLLE1BQU0sbUJBQW1CLElBQUk7QUFDN0MsUUFBSSxDQUFDLE1BQU07QUFDVixXQUFLLFVBQVUsc0JBQXNCLElBQUksS0FBSztBQUFBLElBQy9DO0FBQ0EsU0FBSyxhQUFhLHNCQUFzQixLQUFLLE1BQU0sb0JBQW9CLENBQUM7QUFBQSxFQUN6RTtBQUFBLEVBRUEsc0JBQXNCLElBQVksU0FBdUI7QUFDeEQsU0FBSyxNQUFNLHNCQUFzQixJQUFJLE9BQU87QUFDNUMsU0FBSyxhQUFhLHNCQUFzQixLQUFLLE1BQU0sb0JBQW9CLENBQUM7QUFBQSxFQUN6RTtBQUFBLEVBRUEsb0JBQW9CLElBQVksVUFBd0I7QUFDdkQsU0FBSyxNQUFNLG9CQUFvQixJQUFJLFFBQVE7QUFDM0MsU0FBSyxhQUFhLHNCQUFzQixLQUFLLE1BQU0sb0JBQW9CLENBQUM7QUFBQSxFQUN6RTtBQUFBLEVBRUEsdUJBQXVCLElBQW1CO0FBQ3pDLFNBQUssTUFBTSx1QkFBdUIsRUFBRTtBQUNwQyxTQUFLLGFBQWEsc0JBQXNCLEtBQUssTUFBTSxvQkFBb0IsQ0FBQztBQUFBLEVBQ3pFO0FBQUE7QUFBQSxFQUlBLG9CQUFvQixPQUE0QjtBQUMvQyxXQUFPLEtBQUssZUFBZSxvQkFBb0IsS0FBSztBQUFBLEVBQ3JEO0FBQUEsRUFFQSxNQUFNLDJCQUEyQixRQUFpQixZQUF5QztBQUMxRixRQUFJLFlBQVk7QUFDZixXQUFLLE1BQU0sY0FBYyxZQUFZLE1BQU07QUFDM0MsV0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFDN0MsVUFBSSxzQkFBc0IsWUFBWTtBQUNyQyxjQUFNLEtBQUssd0NBQXdDLFFBQVEsVUFBVTtBQUNyRSxjQUFNLEtBQUssZ0JBQWdCLFdBQVcsV0FBVztBQUFBLE1BQ2xELFdBQVcsc0JBQXNCLG9CQUFvQjtBQUNwRCxjQUFNLEtBQUssd0JBQXdCO0FBQUEsTUFDcEMsV0FBVyxzQkFBc0IsZ0JBQWdCO0FBQ2hELGNBQU0sS0FBSyxvQkFBb0I7QUFBQSxNQUNoQyxXQUFXLHNCQUFzQix1QkFBdUI7QUFDdkQsY0FBTSxLQUFLLDJCQUEyQjtBQUFBLE1BQ3ZDLE9BQU87QUFDTixjQUFNLEtBQUsseUJBQXlCO0FBQUEsTUFDckM7QUFBQSxJQUNELE9BQU87QUFDTixXQUFLLE1BQU0sOEJBQThCLE1BQU07QUFDL0MsV0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFDN0MsWUFBTSxLQUFLLG1CQUFtQjtBQUFBLElBQy9CO0FBQ0EsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFBQSxFQUM5QztBQUFBLEVBRUEsTUFBTSxlQUFlSCxNQUFVLGdCQUFtQyxlQUFlLE1BQThCO0FBQzlHLFVBQU0sY0FBYyxLQUFLLE1BQU0sZUFBZUEsTUFBSyxjQUFjO0FBQ2pFLFFBQUksY0FBYztBQUNqQixrQkFBWSxRQUFRLFFBQU0sS0FBSyxPQUFPLElBQUksU0FBUyxtQkFBbUIsd0NBQXdDLEdBQUcsWUFBWUEsS0FBSSxNQUFNLENBQUMsQ0FBQztBQUFBLElBQzFJO0FBSUEsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFDN0MsVUFBTSxLQUFLLGdCQUFnQkEsSUFBRztBQUM5QixTQUFLLGFBQWEsaUJBQWlCLEtBQUssS0FBSztBQUM3QyxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBTSxrQkFBa0JBLE1BQVUsTUFBMEMscUJBQTZDO0FBQ3hILFNBQUssTUFBTSxrQkFBa0IsSUFBSTtBQUNqQyxTQUFLLGFBQWEsaUJBQWlCLEtBQUssS0FBSztBQUM3QyxRQUFJLHFCQUFxQjtBQUN4QixXQUFLLGlDQUFpQyxJQUFJQSxJQUFHO0FBQUEsSUFDOUMsT0FBTztBQUNOLFlBQU0sS0FBSyxnQkFBZ0JBLElBQUc7QUFDOUIsV0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFBQSxJQUM5QztBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sa0JBQWtCLElBQTRCO0FBQ25ELFVBQU0sY0FBYyxLQUFLLE1BQU0sZUFBZTtBQUM5QyxVQUFNLFdBQVcsWUFBWSxPQUFPLFFBQU0sQ0FBQyxNQUFNLEdBQUcsTUFBTSxNQUFNLEVBQUU7QUFFbEUsYUFBUyxRQUFRLFFBQU0sS0FBSyxPQUFPLElBQUksU0FBUyxxQkFBcUIsMENBQTBDLEdBQUcsWUFBWSxHQUFHLElBQUksTUFBTSxDQUFDLENBQUM7QUFDN0ksVUFBTSxjQUFjLElBQUksSUFBSSxTQUFTLElBQUksUUFBTSxHQUFHLFlBQVksU0FBUyxDQUFDLENBQUM7QUFFekUsU0FBSyxNQUFNLGtCQUFrQixRQUFRO0FBQ3JDLFNBQUssMkJBQTJCLGFBQWEsUUFBUSxFQUFFLFFBQVEsQ0FBQUEsU0FBTyxZQUFZLElBQUlBLEtBQUksU0FBUyxDQUFDLENBQUM7QUFFckcsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFDN0MsVUFBTSxRQUFRLElBQUksQ0FBQyxHQUFHLFdBQVcsRUFBRSxJQUFJLENBQUFBLFNBQU8sS0FBSyxnQkFBZ0IsSUFBSSxNQUFNQSxJQUFHLENBQUMsQ0FBQyxDQUFDO0FBQUEsRUFDcEY7QUFBQSxFQUVBLHdCQUF3QixXQUFtQztBQUMxRCxTQUFLLE1BQU0sd0JBQXdCLFNBQVM7QUFDNUMsV0FBTyxLQUFLLG1CQUFtQjtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxNQUFNLHNCQUFzQixNQUFtQyxJQUE0QjtBQUMxRixTQUFLLE1BQU0sc0JBQXNCLFFBQVEsRUFBRSxNQUFNLEdBQUcsR0FBRyxFQUFFO0FBRXpELFFBQUksTUFBTTtBQUNULFdBQUssYUFBYSxpQkFBaUIsS0FBSyxLQUFLO0FBQzdDLFlBQU0sS0FBSyx3QkFBd0I7QUFDbkMsV0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFBQSxJQUM5QztBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0seUJBQXlCLElBQVksUUFBcUY7QUFDL0gsU0FBSyxNQUFNLHlCQUF5QixJQUFJLE1BQU07QUFDOUMsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFDN0MsVUFBTSxLQUFLLHdCQUF3QjtBQUFBLEVBQ3BDO0FBQUEsRUFFQSxNQUFNLDBCQUEwQixJQUE0QjtBQUMzRCxTQUFLLE1BQU0sMEJBQTBCLEVBQUU7QUFDdkMsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFDN0MsVUFBTSxLQUFLLHdCQUF3QjtBQUFBLEVBQ3BDO0FBQUEsRUFFQSxNQUFNLGtCQUFrQixNQUE2QztBQUNwRSxTQUFLLE1BQU0sa0JBQWtCLElBQUk7QUFDakMsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFDN0MsVUFBTSxLQUFLLG9CQUFvQjtBQUMvQixTQUFLLGFBQWEsaUJBQWlCLEtBQUssS0FBSztBQUFBLEVBQzlDO0FBQUEsRUFFQSxNQUFNLHFCQUFxQixJQUFZLFFBQXNFO0FBQzVHLFNBQUssTUFBTSxxQkFBcUIsSUFBSSxNQUFNO0FBQzFDLFNBQUssYUFBYSxpQkFBaUIsS0FBSyxLQUFLO0FBQzdDLFVBQU0sS0FBSyxvQkFBb0I7QUFBQSxFQUNoQztBQUFBLEVBRUEsTUFBTSxzQkFBc0IsSUFBNEI7QUFDdkQsU0FBSyxNQUFNLHNCQUFzQixFQUFFO0FBQ25DLFNBQUssYUFBYSxpQkFBaUIsS0FBSyxLQUFLO0FBQzdDLFVBQU0sS0FBSyxvQkFBb0I7QUFBQSxFQUNoQztBQUFBLEVBRUEsTUFBTSx5QkFBeUIsTUFBb0Q7QUFDbEYsU0FBSyxNQUFNLHlCQUF5QixJQUFJO0FBQ3hDLFNBQUssYUFBYSxpQkFBaUIsS0FBSyxLQUFLO0FBQzdDLFVBQU0sS0FBSywyQkFBMkI7QUFDdEMsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFBQSxFQUM5QztBQUFBLEVBRUEsTUFBTSw2QkFBNkIsc0JBQStCLFFBQWdDO0FBQ2pHLFNBQUssTUFBTSw2QkFBNkIsc0JBQXNCLE1BQU07QUFDcEUsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFDN0MsVUFBTSxLQUFLLDJCQUEyQjtBQUFBLEVBQ3ZDO0FBQUEsRUFFQSxzQ0FBc0MsV0FBbUI7QUFDeEQsU0FBSyxNQUFNLHNDQUFzQyxTQUFTO0FBQzFELFNBQUssYUFBYSxpQkFBaUIsS0FBSyxLQUFLO0FBQUEsRUFDOUM7QUFBQSxFQUVBLGtDQUFrQyxTQUF3QixTQUEyRDtBQUNwSCxTQUFLLE1BQU0sa0NBQWtDLFFBQVEsTUFBTSxHQUFHLE9BQU87QUFDckUsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFBQSxFQUM5QztBQUFBLEVBRUEsTUFBTSxnQ0FBZ0MscUJBQTJDLFdBQThDO0FBQzlILFNBQUssTUFBTSxnQ0FBZ0MscUJBQXFCLFNBQVM7QUFDekUsU0FBSyxhQUFhLGlCQUFpQixLQUFLLEtBQUs7QUFDN0MsVUFBTSxLQUFLLHlCQUF5QjtBQUFBLEVBQ3JDO0FBQUEsRUFFQSxNQUFNLG1CQUFtQixTQUF3QztBQUNoRSxVQUFNLHlCQUF5QixTQUFTLEtBQUssTUFBTSxlQUFlLEdBQUcsUUFBTSxHQUFHLFlBQVksU0FBUyxDQUFDLEVBQ2xHLElBQUksUUFBTSxLQUFLLGdCQUFnQixHQUFHLGFBQWEsT0FBTyxPQUFPLENBQUM7QUFHaEUsUUFBSSxTQUFTLGFBQWEsa0NBQWtDO0FBQzNELFlBQU0sUUFBUSxJQUFJO0FBQUEsUUFDakIsR0FBRztBQUFBLFFBQ0gsS0FBSyx3QkFBd0IsT0FBTztBQUFBLFFBQ3BDLEtBQUssb0JBQW9CLE9BQU87QUFBQSxRQUNoQyxLQUFLLDJCQUEyQixPQUFPO0FBQUEsUUFDdkMsS0FBSyx5QkFBeUIsT0FBTztBQUFBLE1BQ3RDLENBQUM7QUFBQSxJQUNGLE9BQU87QUFDTixZQUFNLFFBQVEsSUFBSSxzQkFBc0I7QUFDeEMsWUFBTSxLQUFLLHdCQUF3QixPQUFPO0FBQzFDLFlBQU0sS0FBSyxvQkFBb0IsT0FBTztBQUN0QyxZQUFNLEtBQUssMkJBQTJCLE9BQU87QUFHN0MsWUFBTSxLQUFLLHlCQUF5QixPQUFPO0FBQUEsSUFDNUM7QUFBQSxFQUNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBT1EsMkJBQTJCLGdCQUF3QyxvQkFBbUQ7QUFDN0gsVUFBTSxlQUFzQixDQUFDO0FBQzdCLGVBQVcsV0FBVyxvQkFBb0I7QUFDekMsaUJBQVcsWUFBWSxnQkFBZ0I7QUFDdEMsWUFBSSxDQUFDLG1CQUFtQixTQUFTLFFBQVEsS0FBSyxTQUFTLGdCQUFnQixRQUFRLE1BQU0sR0FBRztBQUN2RixlQUFLLE1BQU0sa0JBQWtCLG9CQUFJLElBQUksQ0FBQyxDQUFDLFNBQVMsTUFBTSxHQUFHLEVBQUUsYUFBYSxPQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEYsdUJBQWEsS0FBSyxTQUFTLFdBQVc7QUFBQSxRQUN2QztBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsd0NBQXdDLFFBQWlCLFlBQXdCO0FBQzlGLFFBQUksUUFBUTtBQUVYLFVBQUksV0FBVyxhQUFhO0FBQzNCLGNBQU0sVUFBVSxLQUFLLE1BQU0sZUFBZSxFQUFFLEtBQUssUUFBTSxXQUFXLGdCQUFnQixHQUFHLE1BQU0sQ0FBQztBQUM1RixZQUFJLFdBQVcsQ0FBQyxRQUFRLFNBQVM7QUFDaEMsZ0JBQU0sS0FBSywyQkFBMkIsUUFBUSxPQUFPO0FBQUEsUUFDdEQ7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUlBLFVBQU0sUUFBUTtBQUFBLE1BQUksS0FBSyxNQUFNLGVBQWUsRUFDMUMsT0FBTyxRQUFNLEdBQUcsZ0JBQWdCLFdBQVcsTUFBTSxLQUFLLEdBQUcsWUFBWSxNQUFNLEVBQzNFLElBQUksUUFBTSxLQUFLLDJCQUEyQixRQUFRLEVBQUUsQ0FBQztBQUFBLElBQ3ZEO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYSxnQkFBZ0IsVUFBZSxpQkFBaUIsT0FBTyxTQUF3QztBQUMzRyxVQUFNLG9CQUFvQixLQUFLLE1BQU0sZUFBZSxFQUFFLGFBQWEsVUFBVSxhQUFhLEtBQUssQ0FBQztBQUNoRyxVQUFNLHVCQUF1QixLQUFLLE9BQU8sU0FBUyxPQUFNLE1BQUs7QUFDNUQsVUFBSSxDQUFDLEVBQUUsY0FBYyxTQUFTO0FBQzdCLGNBQU0sYUFBYSxrQkFBa0IsT0FBTyxRQUFNLENBQUMsR0FBRyxlQUFlLEdBQUcscUJBQXFCLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDdkcsY0FBTSxFQUFFLGdCQUFnQixVQUFVLFlBQVksY0FBYztBQUFBLE1BQzdEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBYyx3QkFBd0IsU0FBd0M7QUFDN0UsVUFBTSxvQkFBb0IsS0FBSyxNQUFNLHVCQUF1QixFQUFFLE9BQU8sU0FBTyxJQUFJLFdBQVcsS0FBSyxNQUFNLHdCQUF3QixDQUFDO0FBRS9ILFVBQU0sdUJBQXVCLEtBQUssT0FBTyxTQUFTLE9BQU0sTUFBSztBQUM1RCxVQUFJLEVBQUUsYUFBYSwrQkFBK0IsQ0FBQyxFQUFFLGNBQWMsU0FBUztBQUMzRSxjQUFNLEVBQUUsd0JBQXdCLGlCQUFpQjtBQUFBLE1BQ2xEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBYyxvQkFBb0IsU0FBd0M7QUFDekUsVUFBTSxvQkFBb0IsS0FBSyxNQUFNLG1CQUFtQixFQUFFLE9BQU8sU0FBTyxJQUFJLFdBQVcsS0FBSyxNQUFNLHdCQUF3QixDQUFDO0FBRTNILFVBQU0sdUJBQXVCLEtBQUssT0FBTyxTQUFTLE9BQU0sTUFBSztBQUM1RCxVQUFJLEVBQUUsYUFBYSwyQkFBMkIsQ0FBQyxFQUFFLGNBQWMsU0FBUztBQUN2RSxjQUFNLEVBQUUsb0JBQW9CLGlCQUFpQjtBQUFBLE1BQzlDO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBYywyQkFBMkIsU0FBd0M7QUFDaEYsVUFBTSxvQkFBb0IsS0FBSyxNQUFNLDBCQUEwQixFQUFFLE9BQU8sU0FBTyxJQUFJLFdBQVcsS0FBSyxNQUFNLHdCQUF3QixDQUFDO0FBRWxJLFVBQU0sdUJBQXVCLEtBQUssT0FBTyxTQUFTLE9BQU0sTUFBSztBQUM1RCxVQUFJLEVBQUUsYUFBYSxrQ0FBa0MsQ0FBQyxFQUFFLGNBQWMsU0FBUztBQUM5RSxjQUFNLEVBQUUsMkJBQTJCLGlCQUFpQjtBQUFBLE1BQ3JEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEseUJBQXlCLFNBQXdDO0FBQ3hFLFdBQU8sdUJBQXVCLEtBQUssT0FBTyxTQUFTLE9BQU0sTUFBSztBQUM3RCxZQUFNLHNCQUFzQixLQUFLLE1BQU0sa0NBQWtDLEVBQUUsTUFBTSxDQUFDLEVBQUUsT0FBTyxTQUFPLElBQUksT0FBTztBQUM3RyxVQUFJLEVBQUUsYUFBYSxxQ0FBcUMsQ0FBQyxFQUFFLGFBQWEsOEJBQThCLEVBQUUsYUFBYSwyQkFBMkIsV0FBVyxJQUFJO0FBRTlKO0FBQUEsTUFDRDtBQUNBLFVBQUksQ0FBQyxFQUFFLGNBQWMsU0FBUztBQUM3QixjQUFNLEVBQUUseUJBQXlCLG1CQUFtQjtBQUFBLE1BQ3JEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsY0FBYyxrQkFBMEM7QUFDL0QsVUFBTSxXQUFXLEtBQUssTUFBTSxlQUFlLEVBQUUsT0FBTyxRQUNuRCxpQkFBaUIsU0FBUyxHQUFHLGFBQWEsZUFBZSxPQUFPLENBQUM7QUFDbEUsUUFBSSxTQUFTLFFBQVE7QUFDcEIsV0FBSyxNQUFNLGtCQUFrQixRQUFRO0FBQUEsSUFDdEM7QUFFQSxVQUFNLFNBQWdCLENBQUM7QUFDdkIsZUFBV0EsUUFBTyxLQUFLLGtDQUFrQztBQUN4RCxVQUFJLGlCQUFpQixTQUFTQSxNQUFLLGVBQWUsT0FBTyxHQUFHO0FBQzNELGVBQU8sS0FBS0EsSUFBRztBQUFBLE1BQ2hCO0FBQUEsSUFDRDtBQUVBLGVBQVdBLFFBQU8sUUFBUTtBQUN6QixXQUFLLGlDQUFpQyxPQUFPQSxJQUFHO0FBQ2hELFdBQUssZ0JBQWdCQSxNQUFLLElBQUk7QUFBQSxJQUMvQjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sTUFBTUEsTUFBVSxZQUFvQixRQUFnQztBQUN6RSxRQUFJO0FBQ0osUUFBSSxtQkFBbUIsS0FBSyxhQUFhLEVBQUU7QUFDM0MsVUFBTSxvQkFBb0IsWUFBWTtBQUNyQyxZQUFNLFdBQVcsQ0FBQyxDQUFFLEtBQUssU0FBUyxFQUFFLGVBQWUsRUFBRSxRQUFRLFlBQVksS0FBQUEsS0FBSSxDQUFDLEVBQUU7QUFFaEYsVUFBSSxDQUFDLFVBQVU7QUFDZCxjQUFNLFlBQVksTUFBTSxLQUFLLDBCQUEwQkEsTUFBSyxZQUFZLE1BQU07QUFDOUUsWUFBSSxVQUFVLFFBQVE7QUFDckIsNkJBQW1CLFVBQVU7QUFBQSxRQUM5QjtBQUVBLFlBQUksVUFBVSxZQUFZO0FBQ3pCLCtCQUFxQixVQUFVO0FBQUEsUUFDaEM7QUFBQSxNQUNEO0FBQ0EsYUFBTyxFQUFFLGtCQUFrQixtQkFBbUI7QUFBQSxJQUMvQztBQUNBLFVBQU0sdUJBQXVCLENBQUMsVUFBMEI7QUFDdkQsVUFBSSxVQUFVLE1BQU0sV0FBVyxVQUFVLE1BQU0sVUFBVTtBQUN4RCxZQUFJLG9CQUFvQjtBQUN2QixlQUFLLGtCQUFrQixtQkFBbUIsTUFBTSxDQUFDO0FBQUEsUUFDbEQ7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUNBLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxrQkFBa0I7QUFDeEIsUUFBSSxLQUFLLFVBQVUsTUFBTSxVQUFVO0FBRWxDLFlBQU0sRUFBRSxRQUFRLE1BQU0sVUFBVSxJQUFJLEtBQUssd0JBQXdCLEVBQUU7QUFDbkUsWUFBTSxTQUFTLE1BQU0sVUFBVTtBQUMvQixZQUFNLGVBQWUsU0FBUyxPQUFPLE9BQU8sVUFBVSxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUk7QUFDckUsWUFBTSxXQUFXLEtBQUssaUJBQWlCLFdBQVM7QUFDL0MsWUFBSSxxQkFBcUIsS0FBSyxHQUFHO0FBQ2hDLG1CQUFTLFFBQVE7QUFBQSxRQUNsQjtBQUFBLE1BQ0QsQ0FBQztBQUNELFlBQU0sS0FBSyxlQUFlLFFBQVEsY0FBYyxRQUFXLElBQUk7QUFBQSxJQUNoRTtBQUNBLFFBQUksS0FBSyxVQUFVLE1BQU0sU0FBUztBQUNqQyxZQUFNLGlCQUFpQixLQUFLLGFBQWEsRUFBRTtBQUMzQyxVQUFJLENBQUMsa0JBQWtCLENBQUMsa0JBQWtCO0FBQ3pDO0FBQUEsTUFDRDtBQUVBLFlBQU0sV0FBVyxpQkFBaUIsUUFBUSxpQkFBaUIsTUFBTTtBQUNoRSxZQUFJLHFCQUFxQixlQUFlLEtBQUssR0FBRztBQUMvQyxtQkFBUyxRQUFRO0FBQUEsUUFDbEI7QUFBQSxNQUNELENBQUM7QUFDRCxZQUFNLGlCQUFpQixTQUFTO0FBQUEsSUFDakM7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLDBCQUEwQkEsTUFBVSxZQUFvQixRQUFpQjtBQUN0RixVQUFNLGFBQWEsS0FBSyxTQUFTO0FBQ2pDLFVBQU0sWUFBWSxLQUFLLGFBQWE7QUFFcEMsVUFBTSxjQUFjLE1BQU0sS0FBSyxlQUFlQSxNQUFLLENBQUMsRUFBRSxZQUFZLE9BQU8sQ0FBQyxHQUFHLEtBQUs7QUFDbEYsVUFBTSxhQUFhLGNBQWMsQ0FBQztBQUNsQyxRQUFJLENBQUMsWUFBWTtBQUNoQixhQUFPLEVBQUUsWUFBWSxRQUFXLFFBQVEsVUFBVSxjQUFjO0FBQUEsSUFDakU7QUFJQSxRQUFJLENBQUMsV0FBVyxVQUFVO0FBQ3pCLFVBQUk7QUFDSixZQUFNLFlBQVksSUFBSSxRQUFjLGFBQVc7QUFDOUMsbUJBQVcsV0FBVyx1QkFBdUIsTUFBTTtBQUNsRCxjQUFJLFdBQVcsVUFBVTtBQUN4QixvQkFBUTtBQUFBLFVBQ1Q7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGLENBQUMsR0FBRyxHQUFJO0FBQ1IsZUFBVSxRQUFRO0FBQUEsSUFDbkI7QUFHQSxRQUFXO0FBQVgsTUFBV0ksV0FBWDtBQUVDLE1BQUFBLGNBQUE7QUFFQSxNQUFBQSxjQUFBO0FBRUEsTUFBQUEsY0FBQTtBQUVBLE1BQUFBLGNBQUE7QUFBQSxPQVJVO0FBV1gsUUFBSSxhQUFhLFVBQVU7QUFDM0IsUUFBSSxZQUFZO0FBQ2hCLGVBQVcsYUFBYSxXQUFXLHNCQUFzQjtBQUN4RCxZQUFNLFVBQVUsV0FBVyxXQUFXLFNBQVM7QUFDL0MsVUFBSSxDQUFDLFNBQVM7QUFDYjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLFVBQVUsUUFBUSxjQUFjLEVBQUUsT0FBTyxPQUFLLEVBQUUsT0FBTztBQUM3RCxVQUFJLFlBQVksNEJBQTBCO0FBQ3pDLFlBQUksVUFBVSxpQkFBaUIsUUFBUSxTQUFTLFVBQVUsYUFBYSxHQUFHO0FBQ3pFLHVCQUFhLFVBQVU7QUFDdkIsc0JBQVk7QUFBQSxRQUNiO0FBQUEsTUFDRDtBQUVBLFVBQUksWUFBWSxpQ0FBK0I7QUFDOUMsY0FBTSxtQkFBbUIsUUFBUSxLQUFLLE9BQUs7QUFDMUMsZ0JBQU0sTUFBTSxFQUFFLGlCQUFpQjtBQUMvQixpQkFBTyxPQUFPLEtBQUssbUJBQW1CLE9BQU8sUUFBUSxJQUFJLE9BQU8sS0FBS0osSUFBRztBQUFBLFFBQ3pFLENBQUM7QUFFRCxZQUFJLGtCQUFrQjtBQUNyQix1QkFBYTtBQUNiLHNCQUFZO0FBQUEsUUFDYjtBQUFBLE1BQ0Q7QUFFQSxVQUFJLFlBQVksa0JBQWdCO0FBQy9CLHFCQUFhLFFBQVEsQ0FBQztBQUN0QixvQkFBWTtBQUFBLE1BQ2I7QUFBQSxJQUNEO0FBRUEsV0FBTyxFQUFFLFFBQVEsWUFBWSxXQUFXO0FBQUEsRUFDekM7QUFDRDtBQXgyQ2EsZUFBTjtBQUFBLEVBaUNKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXJEVTtBQTAyQ04sU0FBUyxxQ0FBcUMsT0FBb0IsWUFBcUMsUUFBa0IsU0FBeUIsY0FBd0k7QUFDaFMsTUFBSSxDQUFDLFNBQVM7QUFDYixRQUFJLGNBQWMsUUFBUTtBQUN6QixnQkFBVSxhQUFhLFdBQVcsT0FBTyxVQUFVLE9BQVE7QUFBQSxJQUM1RCxPQUFPO0FBQ04sWUFBTSxXQUFXLE1BQU0sWUFBWTtBQUNuQyxZQUFNLGlCQUFpQixTQUFTLEtBQUssT0FBSyxFQUFFLFVBQVUsTUFBTSxPQUFPO0FBRW5FLGdCQUFVLGtCQUFrQixTQUFTLEtBQUssT0FBSyxNQUFNLGdCQUFnQixNQUFNLGNBQWMsYUFBYSxNQUFNLFNBQVMsU0FBUyxTQUFTLENBQUMsSUFBSTtBQUFBLElBQzdJO0FBQUEsRUFDRDtBQUVBLE1BQUksQ0FBQyxRQUFRO0FBQ1osUUFBSSxZQUFZO0FBQ2YsZUFBUyxXQUFXO0FBQUEsSUFDckIsT0FBTztBQUNOLFlBQU0sVUFBVSxVQUFVLFFBQVEsY0FBYyxJQUFJO0FBQ3BELFlBQU0sZ0JBQWdCLFdBQVcsUUFBUSxLQUFLLE9BQUssRUFBRSxPQUFPO0FBQzVELGVBQVMsa0JBQWtCLFdBQVcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxJQUFJO0FBQUEsSUFDckU7QUFBQSxFQUNEO0FBRUEsTUFBSSxDQUFDLGNBQWMsUUFBUTtBQUMxQixpQkFBYSxPQUFPLGlCQUFpQjtBQUFBLEVBQ3RDO0FBRUEsU0FBTyxFQUFFLFNBQVMsUUFBUSxXQUFXO0FBQ3RDO0FBRUEsZUFBZSx1QkFBdUIsT0FBbUIsU0FBb0MsTUFBZ0U7QUFDNUosTUFBSSxTQUFTO0FBQ1osVUFBTSxLQUFLLE9BQU87QUFBQSxFQUNuQixPQUFPO0FBQ04sVUFBTSxRQUFRLElBQUksTUFBTSxZQUFZLEVBQUUsSUFBSSxPQUFLLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUN4RDtBQUNEOyIsCiAgIm5hbWVzIjogWyJ1cmkiLCAicmVzdWx0IiwgIm1lc3NhZ2UiLCAic2Vzc2lvbiIsICJTY29yZSJdCn0K
