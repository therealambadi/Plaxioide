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
import { Action } from "../../../../base/common/actions.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import * as glob from "../../../../base/common/glob.js";
import * as json from "../../../../base/common/json.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import { LRUCache, Touch } from "../../../../base/common/map.js";
import * as Objects from "../../../../base/common/objects.js";
import { ValidationState, ValidationStatus } from "../../../../base/common/parsers.js";
import * as Platform from "../../../../base/common/platform.js";
import { TerminateResponseCode } from "../../../../base/common/processes.js";
import * as resources from "../../../../base/common/resources.js";
import Severity from "../../../../base/common/severity.js";
import * as Types from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import * as UUID from "../../../../base/common/uuid.js";
import * as nls from "../../../../nls.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IMarkerService } from "../../../../platform/markers/common/markers.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ProblemMatcherRegistry } from "../common/problemMatcher.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { IWorkspaceContextService, WorkbenchState, WorkspaceFolder } from "../../../../platform/workspace/common/workspace.js";
import { Markers } from "../../markers/common/markers.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { ITerminalGroupService, ITerminalService } from "../../terminal/browser/terminal.js";
import { ITerminalProfileResolverService } from "../../terminal/common/terminal.js";
import { ConfiguringTask, ContributedTask, CustomTask, ExecutionEngine, InMemoryTask, JsonSchemaVersion, KeyedTaskIdentifier, RuntimeType, TASK_RUNNING_STATE, TaskDefinition, TaskGroup, TaskRunSource, TaskSettingId, TaskSorter, TaskSourceKind, TasksSchemaProperties, USER_TASKS_GROUP_KEY, TaskEventKind } from "../common/tasks.js";
import { CustomExecutionSupportedContext, ProcessExecutionSupportedContext, ServerlessWebContext, ShellExecutionSupportedContext, TaskCommandsRegistered, TaskExecutionSupportedContext } from "../common/taskService.js";
import { TaskError, TaskErrors, TaskExecuteKind } from "../common/taskSystem.js";
import { getTemplates as getTaskTemplates } from "../common/taskTemplates.js";
import * as TaskConfig from "../common/taskConfiguration.js";
import { TerminalTaskSystem } from "./terminalTaskSystem.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { TaskDefinitionRegistry } from "../common/taskDefinitionRegistry.js";
import { raceTimeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { toFormattedString } from "../../../../base/common/jsonFormatter.js";
import { Schemas } from "../../../../base/common/network.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { TextEditorSelectionRevealType } from "../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { TerminalExitReason } from "../../../../platform/terminal/common/terminal.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { VirtualWorkspaceContext } from "../../../common/contextkeys.js";
import { EditorResourceAccessor, SaveReason } from "../../../common/editor.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { configureTaskIcon, isWorkspaceFolder, QUICKOPEN_DETAIL_CONFIG, QUICKOPEN_SKIP_CONFIG, TaskQuickPick } from "./taskQuickPick.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { ILifecycleService, ShutdownReason, StartupKind } from "../../../services/lifecycle/common/lifecycle.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { isCancellationError } from "../../../../base/common/errors.js";
const QUICKOPEN_HISTORY_LIMIT_CONFIG = "task.quickOpen.history";
const PROBLEM_MATCHER_NEVER_CONFIG = "task.problemMatchers.neverPrompt";
const USE_SLOW_PICKER = "task.quickOpen.showAll";
var ConfigureTaskAction;
((ConfigureTaskAction2) => {
  ConfigureTaskAction2.ID = "workbench.action.tasks.configureTaskRunner";
  ConfigureTaskAction2.TEXT = nls.localize2("ConfigureTaskRunnerAction.label", "Configure Task");
})(ConfigureTaskAction || (ConfigureTaskAction = {}));
class ProblemReporter {
  constructor(_outputChannel) {
    this._outputChannel = _outputChannel;
    this._validationStatus = new ValidationStatus();
  }
  info(message) {
    this._validationStatus.state = ValidationState.Info;
    this._outputChannel.append(message + "\n");
  }
  warn(message) {
    this._validationStatus.state = ValidationState.Warning;
    this._outputChannel.append(message + "\n");
  }
  error(message) {
    this._validationStatus.state = ValidationState.Error;
    this._outputChannel.append(message + "\n");
  }
  fatal(message) {
    this._validationStatus.state = ValidationState.Fatal;
    this._outputChannel.append(message + "\n");
  }
  get status() {
    return this._validationStatus;
  }
}
class TaskMap {
  constructor() {
    this._store = /* @__PURE__ */ new Map();
  }
  forEach(callback) {
    this._store.forEach(callback);
  }
  static getKey(workspaceFolder) {
    let key;
    if (Types.isString(workspaceFolder)) {
      key = workspaceFolder;
    } else {
      const uri = isWorkspaceFolder(workspaceFolder) ? workspaceFolder.uri : workspaceFolder.configuration;
      key = uri ? uri.toString() : "";
    }
    return key;
  }
  get(workspaceFolder) {
    const key = TaskMap.getKey(workspaceFolder);
    let result = this._store.get(key);
    if (!result) {
      result = [];
      this._store.set(key, result);
    }
    return result;
  }
  add(workspaceFolder, ...task) {
    const key = TaskMap.getKey(workspaceFolder);
    let values = this._store.get(key);
    if (!values) {
      values = [];
      this._store.set(key, values);
    }
    values.push(...task);
  }
  all() {
    const result = [];
    this._store.forEach((values) => result.push(...values));
    return result;
  }
}
let AbstractTaskService = class extends Disposable {
  constructor(_configurationService, _markerService, _outputService, _paneCompositeService, _viewsService, _commandService, _editorService, _fileService, _contextService, _telemetryService, _textFileService, _modelService, _extensionService, _quickInputService, _configurationResolverService, _terminalService, _terminalGroupService, _storageService, _progressService, _openerService, _dialogService, _notificationService, _contextKeyService, _environmentService, _terminalProfileResolverService, _pathService, _textModelResolverService, _preferencesService, _viewDescriptorService, _workspaceTrustRequestService, _workspaceTrustManagementService, _logService, _themeService, _lifecycleService, remoteAgentService, _instantiationService) {
    super();
    this._configurationService = _configurationService;
    this._markerService = _markerService;
    this._outputService = _outputService;
    this._paneCompositeService = _paneCompositeService;
    this._viewsService = _viewsService;
    this._commandService = _commandService;
    this._editorService = _editorService;
    this._fileService = _fileService;
    this._contextService = _contextService;
    this._telemetryService = _telemetryService;
    this._textFileService = _textFileService;
    this._modelService = _modelService;
    this._extensionService = _extensionService;
    this._quickInputService = _quickInputService;
    this._configurationResolverService = _configurationResolverService;
    this._terminalService = _terminalService;
    this._terminalGroupService = _terminalGroupService;
    this._storageService = _storageService;
    this._progressService = _progressService;
    this._openerService = _openerService;
    this._dialogService = _dialogService;
    this._notificationService = _notificationService;
    this._contextKeyService = _contextKeyService;
    this._environmentService = _environmentService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._pathService = _pathService;
    this._textModelResolverService = _textModelResolverService;
    this._preferencesService = _preferencesService;
    this._viewDescriptorService = _viewDescriptorService;
    this._workspaceTrustRequestService = _workspaceTrustRequestService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._logService = _logService;
    this._themeService = _themeService;
    this._lifecycleService = _lifecycleService;
    this._instantiationService = _instantiationService;
    this._tasksReconnected = false;
    this._taskSystemListeners = [];
    this._onDidRegisterSupportedExecutions = new Emitter();
    this._onDidRegisterAllSupportedExecutions = new Emitter();
    this._onDidChangeTaskSystemInfo = new Emitter();
    this._willRestart = false;
    this.onDidChangeTaskSystemInfo = this._onDidChangeTaskSystemInfo.event;
    this._onDidReconnectToTasks = new Emitter();
    this.onDidReconnectToTasks = this._onDidReconnectToTasks.event;
    this._onDidChangeTaskConfig = new Emitter();
    this.onDidChangeTaskConfig = this._onDidChangeTaskConfig.event;
    this._onDidChangeTaskProviders = this._register(new Emitter());
    this.onDidChangeTaskProviders = this._onDidChangeTaskProviders.event;
    this._activatedTaskProviders = /* @__PURE__ */ new Set();
    this._whenTaskSystemReady = Event.toPromise(this.onDidChangeTaskSystemInfo);
    this._workspaceTasksPromise = void 0;
    this._taskSystem = void 0;
    this._taskSystemListeners = void 0;
    this._outputChannel = this._outputService.getChannel(AbstractTaskService.OutputChannelId);
    this._providers = /* @__PURE__ */ new Map();
    this._providerTypes = /* @__PURE__ */ new Map();
    this._taskSystemInfos = /* @__PURE__ */ new Map();
    this._register(this._contextService.onDidChangeWorkspaceFolders(() => {
      const folderSetup = this._computeWorkspaceFolderSetup();
      if (this.executionEngine !== folderSetup[2]) {
        this._disposeTaskSystemListeners();
        this._taskSystem = void 0;
      }
      this._updateSetup(folderSetup);
      return this._updateWorkspaceTasks(TaskRunSource.FolderOpen);
    }));
    this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
      if (!e.affectsConfiguration("tasks") || !this._taskSystem && !this._workspaceTasksPromise) {
        return;
      }
      if (!this._taskSystem || this._taskSystem instanceof TerminalTaskSystem) {
        this._outputChannel.clear();
      }
      if (e.affectsConfiguration(TaskSettingId.Reconnection)) {
        if (!this._configurationService.getValue(TaskSettingId.Reconnection)) {
          this._persistentTasks?.clear();
          this._storageService.remove(AbstractTaskService.PersistentTasks_Key, StorageScope.WORKSPACE);
        }
      }
      this._setTaskLRUCacheLimit();
      await this._updateWorkspaceTasks(TaskRunSource.ConfigurationChange);
      this._onDidChangeTaskConfig.fire();
    }));
    this._taskRunningState = TASK_RUNNING_STATE.bindTo(_contextKeyService);
    this._onDidStateChange = this._register(new Emitter());
    this._registerCommands().then(() => TaskCommandsRegistered.bindTo(this._contextKeyService).set(true));
    ServerlessWebContext.bindTo(this._contextKeyService).set(Platform.isWeb && !remoteAgentService.getConnection()?.remoteAuthority);
    this._configurationResolverService.contributeVariable("defaultBuildTask", async () => {
      let tasks = await this._getTasksForGroup(TaskGroup.Build, true);
      if (tasks.length > 0) {
        const defaults2 = this._getDefaultTasks(tasks);
        if (defaults2.length === 1) {
          return defaults2[0]._label;
        }
      }
      tasks = await this._getTasksForGroup(TaskGroup.Build);
      const defaults = this._getDefaultTasks(tasks);
      if (defaults.length === 1) {
        return defaults[0]._label;
      } else if (defaults.length) {
        tasks = defaults;
      }
      let entry;
      if (tasks && tasks.length > 0) {
        entry = await this._showQuickPick(tasks, nls.localize("TaskService.pickBuildTaskForLabel", "Select the build task (there is no default build task defined)"));
      }
      const task = entry ? entry.task : void 0;
      if (!task) {
        return void 0;
      }
      return task._label;
    });
    this._register(this._lifecycleService.onBeforeShutdown((e) => {
      this._willRestart = e.reason !== ShutdownReason.RELOAD;
    }));
    this._register(this.onDidStateChange((e) => {
      this._log(nls.localize("taskEvent", "Task Event kind: {0}", e.kind), true);
      if (e.kind === TaskEventKind.Changed) {
      } else if ((this._willRestart || e.kind === TaskEventKind.Terminated && e.exitReason === TerminalExitReason.User) && e.taskId) {
        const key = e.__task.getKey();
        if (key) {
          this.removePersistentTask(key);
        }
      } else if (e.kind === TaskEventKind.Start && e.__task && e.__task.getWorkspaceFolder()) {
        this._setPersistentTask(e.__task);
      }
    }));
    this._waitForAllSupportedExecutions = new Promise((resolve) => {
      Event.once(this._onDidRegisterAllSupportedExecutions.event)(() => resolve());
    });
    if (this._terminalService.getReconnectedTerminals("Task")?.length) {
      this._attemptTaskReconnection();
    } else {
      this._terminalService.whenConnected.then(() => {
        if (this._terminalService.getReconnectedTerminals("Task")?.length) {
          this._attemptTaskReconnection();
        } else {
          this._tasksReconnected = true;
          this._onDidReconnectToTasks.fire();
        }
      });
    }
    this._upgrade();
  }
  get isReconnected() {
    return this._tasksReconnected;
  }
  registerSupportedExecutions(custom, shell, process) {
    if (custom !== void 0) {
      const customContext = CustomExecutionSupportedContext.bindTo(this._contextKeyService);
      customContext.set(custom);
    }
    const isVirtual = !!VirtualWorkspaceContext.getValue(this._contextKeyService);
    if (shell !== void 0) {
      const shellContext = ShellExecutionSupportedContext.bindTo(this._contextKeyService);
      shellContext.set(shell && !isVirtual);
    }
    if (process !== void 0) {
      const processContext = ProcessExecutionSupportedContext.bindTo(this._contextKeyService);
      processContext.set(process && !isVirtual);
    }
    this._workspaceTasksPromise = void 0;
    this._onDidRegisterSupportedExecutions.fire();
    if (Platform.isWeb || custom && shell && process) {
      this._onDidRegisterAllSupportedExecutions.fire();
    }
  }
  _attemptTaskReconnection() {
    if (this._lifecycleService.startupKind !== StartupKind.ReloadedWindow) {
      this._log(nls.localize("TaskService.skippingReconnection", "Startup kind not window reload, setting connected and removing persistent tasks"), true);
      this._tasksReconnected = true;
      this._storageService.remove(AbstractTaskService.PersistentTasks_Key, StorageScope.WORKSPACE);
    }
    if (!this._configurationService.getValue(TaskSettingId.Reconnection) || this._tasksReconnected) {
      this._log(nls.localize("TaskService.notConnecting", "Setting tasks connected configured value {0}, tasks were already reconnected {1}", this._configurationService.getValue(TaskSettingId.Reconnection), this._tasksReconnected), true);
      this._tasksReconnected = true;
      return;
    }
    this._log(nls.localize("TaskService.reconnecting", "Reconnecting to running tasks..."), true);
    this.getWorkspaceTasks(TaskRunSource.Reconnect).then(async () => {
      this._tasksReconnected = await this._reconnectTasks();
      this._log(nls.localize("TaskService.reconnected", "Reconnected to running tasks."), true);
      this._onDidReconnectToTasks.fire();
    });
  }
  async _reconnectTasks() {
    const tasks = await this.getSavedTasks("persistent");
    if (!tasks.length) {
      this._log(nls.localize("TaskService.noTasks", "No persistent tasks to reconnect."), true);
      return true;
    }
    const taskLabels = tasks.map((task) => task._label).join(", ");
    this._log(nls.localize("TaskService.reconnectingTasks", "Reconnecting to {0} tasks...", taskLabels), true);
    for (const task of tasks) {
      if (ConfiguringTask.is(task)) {
        const resolved = await this.tryResolveTask(task);
        if (resolved) {
          this.run(resolved, void 0, TaskRunSource.Reconnect);
        }
      } else {
        this.run(task, void 0, TaskRunSource.Reconnect);
      }
    }
    return true;
  }
  get onDidStateChange() {
    return this._onDidStateChange.event;
  }
  get supportsMultipleTaskExecutions() {
    return this.inTerminal();
  }
  async _registerCommands() {
    CommandsRegistry.registerCommand({
      id: "workbench.action.tasks.runTask",
      handler: async (accessor, arg) => {
        if (await this._trust()) {
          await this._runTaskCommand(arg);
        }
      },
      metadata: {
        description: "Run Task",
        args: [{
          name: "args",
          isOptional: true,
          description: nls.localize("runTask.arg", "Filters the tasks shown in the quickpick"),
          schema: {
            anyOf: [
              {
                type: "string",
                description: nls.localize("runTask.label", "The task's label or a term to filter by")
              },
              {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    description: nls.localize("runTask.type", "The contributed task type")
                  },
                  task: {
                    type: "string",
                    description: nls.localize("runTask.task", "The task's label or a term to filter by")
                  }
                }
              }
            ]
          }
        }]
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.reRunTask", async (accessor, arg) => {
      if (await this._trust()) {
        this._reRunTaskCommand();
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.restartTask", async (accessor, arg) => {
      if (await this._trust()) {
        this._runRestartTaskCommand(arg);
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.terminate", async (accessor, arg) => {
      if (await this._trust()) {
        this._runTerminateCommand(arg);
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.showLog", () => {
      this._showOutput(void 0, true);
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.build", async () => {
      if (await this._trust()) {
        this._runBuildCommand();
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.test", async () => {
      if (await this._trust()) {
        this._runTestCommand();
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.configureTaskRunner", async () => {
      if (await this._trust()) {
        this._runConfigureTasks();
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.configureDefaultBuildTask", async () => {
      if (await this._trust()) {
        this._runConfigureDefaultBuildTask();
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.configureDefaultTestTask", async () => {
      if (await this._trust()) {
        this._runConfigureDefaultTestTask();
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.showTasks", async () => {
      if (await this._trust()) {
        return this.runShowTasks();
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.toggleProblems", () => this._commandService.executeCommand(Markers.TOGGLE_MARKERS_VIEW_ACTION_ID));
    CommandsRegistry.registerCommand("workbench.action.tasks.openUserTasks", async () => {
      const resource = this._getResourceForKind(TaskSourceKind.User);
      if (resource) {
        this._openTaskFile(resource, TaskSourceKind.User);
      }
    });
    CommandsRegistry.registerCommand("workbench.action.tasks.openWorkspaceFileTasks", async () => {
      const resource = this._getResourceForKind(TaskSourceKind.WorkspaceFile);
      if (resource) {
        this._openTaskFile(resource, TaskSourceKind.WorkspaceFile);
      }
    });
  }
  get workspaceFolders() {
    if (!this._workspaceFolders) {
      this._updateSetup();
    }
    return this._workspaceFolders;
  }
  get ignoredWorkspaceFolders() {
    if (!this._ignoredWorkspaceFolders) {
      this._updateSetup();
    }
    return this._ignoredWorkspaceFolders;
  }
  get executionEngine() {
    if (this._executionEngine === void 0) {
      this._updateSetup();
    }
    return this._executionEngine;
  }
  get schemaVersion() {
    if (this._schemaVersion === void 0) {
      this._updateSetup();
    }
    return this._schemaVersion;
  }
  get showIgnoreMessage() {
    if (this._showIgnoreMessage === void 0) {
      this._showIgnoreMessage = !this._storageService.getBoolean(AbstractTaskService.IgnoreTask010DonotShowAgain_key, StorageScope.WORKSPACE, false);
    }
    return this._showIgnoreMessage;
  }
  _getActivationEvents(type) {
    const result = [];
    result.push("onCommand:workbench.action.tasks.runTask");
    if (type) {
      result.push(`onTaskType:${type}`);
    } else {
      for (const definition of TaskDefinitionRegistry.all()) {
        result.push(`onTaskType:${definition.taskType}`);
      }
    }
    return result;
  }
  async _activateTaskProviders(type) {
    await this._extensionService.whenInstalledExtensionsRegistered();
    const hasLoggedActivation = this._activatedTaskProviders.has(type ?? "all");
    if (!hasLoggedActivation) {
      this._log("Activating task providers " + (type ?? "all"));
    }
    const result = await raceTimeout(
      Promise.all(this._getActivationEvents(type).map((activationEvent) => this._extensionService.activateByEvent(activationEvent))),
      5e3,
      () => console.warn("Timed out activating extensions for task providers")
    );
    if (result) {
      this._activatedTaskProviders.add(type ?? "all");
    }
  }
  _updateSetup(setup) {
    if (!setup) {
      setup = this._computeWorkspaceFolderSetup();
    }
    this._workspaceFolders = setup[0];
    if (this._ignoredWorkspaceFolders) {
      if (this._ignoredWorkspaceFolders.length !== setup[1].length) {
        this._showIgnoreMessage = void 0;
      } else {
        const set = /* @__PURE__ */ new Set();
        this._ignoredWorkspaceFolders.forEach((folder) => set.add(folder.uri.toString()));
        for (const folder of setup[1]) {
          if (!set.has(folder.uri.toString())) {
            this._showIgnoreMessage = void 0;
            break;
          }
        }
      }
    }
    this._ignoredWorkspaceFolders = setup[1];
    this._executionEngine = setup[2];
    this._schemaVersion = setup[3];
    this._workspace = setup[4];
  }
  _showOutput(runSource = TaskRunSource.User, userRequested) {
    if (!VirtualWorkspaceContext.getValue(this._contextKeyService) && (runSource === TaskRunSource.User || runSource === TaskRunSource.ConfigurationChange)) {
      if (userRequested) {
        this._outputService.showChannel(this._outputChannel.id, true);
      } else {
        this._notificationService.prompt(
          Severity.Warning,
          nls.localize("taskServiceOutputPrompt", "There are task errors. See the output for details."),
          [{
            label: nls.localize("showOutput", "Show output"),
            run: () => {
              this._outputService.showChannel(this._outputChannel.id, true);
            }
          }]
        );
      }
    }
  }
  _disposeTaskSystemListeners() {
    if (this._taskSystemListeners) {
      dispose(this._taskSystemListeners);
      this._taskSystemListeners = void 0;
    }
  }
  registerTaskProvider(provider, type) {
    if (!provider) {
      return {
        dispose: () => {
        }
      };
    }
    const handle = AbstractTaskService._nextHandle++;
    this._providers.set(handle, provider);
    this._providerTypes.set(handle, type);
    this._onDidChangeTaskProviders.fire();
    return {
      dispose: () => {
        this._providers.delete(handle);
        this._providerTypes.delete(handle);
        this._onDidChangeTaskProviders.fire();
      }
    };
  }
  get hasTaskSystemInfo() {
    const infosCount = Array.from(this._taskSystemInfos.values()).flat().length;
    if (this._environmentService.remoteAuthority) {
      return infosCount > 1;
    }
    return infosCount > 0;
  }
  registerTaskSystem(key, info) {
    if (info.platform === Platform.Platform.Web) {
      key = this.workspaceFolders.length ? this.workspaceFolders[0].uri.scheme : key;
    }
    if (!this._taskSystemInfos.has(key)) {
      this._taskSystemInfos.set(key, [info]);
    } else {
      const infos = this._taskSystemInfos.get(key);
      if (info.platform === Platform.Platform.Web) {
        infos.push(info);
      } else {
        infos.unshift(info);
      }
    }
    if (this.hasTaskSystemInfo) {
      this._onDidChangeTaskSystemInfo.fire();
    }
  }
  _getTaskSystemInfo(key) {
    const infos = this._taskSystemInfos.get(key);
    return infos && infos.length ? infos[0] : void 0;
  }
  extensionCallbackTaskComplete(task, result) {
    if (!this._taskSystem) {
      return Promise.resolve();
    }
    return this._taskSystem.customExecutionComplete(task, result);
  }
  /**
   * Get a subset of workspace tasks that match a certain predicate.
   */
  async _findWorkspaceTasks(predicate) {
    const result = [];
    const tasks = await this.getWorkspaceTasks();
    for (const [, workspaceTasks] of tasks) {
      if (workspaceTasks.configurations) {
        for (const taskName in workspaceTasks.configurations.byIdentifier) {
          const task = workspaceTasks.configurations.byIdentifier[taskName];
          if (predicate(task, workspaceTasks.workspaceFolder)) {
            result.push(task);
          }
        }
      }
      if (workspaceTasks.set) {
        for (const task of workspaceTasks.set.tasks) {
          if (predicate(task, workspaceTasks.workspaceFolder)) {
            result.push(task);
          }
        }
      }
    }
    return result;
  }
  async _findWorkspaceTasksInGroup(group, isDefault) {
    return this._findWorkspaceTasks((task) => {
      const taskGroup = task.configurationProperties.group;
      if (taskGroup && typeof taskGroup !== "string") {
        return taskGroup._id === group._id && (!isDefault || !!taskGroup.isDefault);
      }
      return false;
    });
  }
  async getTask(folder, identifier, compareId = false, type = void 0) {
    if (!await this._trust()) {
      return;
    }
    const name = Types.isString(folder) ? folder : isWorkspaceFolder(folder) ? folder.name : folder.configuration ? resources.basename(folder.configuration) : void 0;
    if (this.ignoredWorkspaceFolders.some((ignored) => ignored.name === name)) {
      return Promise.reject(new Error(nls.localize("TaskServer.folderIgnored", "The folder {0} is ignored since it uses task version 0.1.0", name)));
    }
    const key = !Types.isString(identifier) ? TaskDefinition.createTaskIdentifier(identifier, console) : identifier;
    if (key === void 0) {
      return Promise.resolve(void 0);
    }
    const requestedFolder = TaskMap.getKey(folder);
    const matchedTasks = await this._findWorkspaceTasks((task, workspaceFolder) => {
      const taskFolder = TaskMap.getKey(workspaceFolder);
      if (taskFolder !== requestedFolder && taskFolder !== USER_TASKS_GROUP_KEY) {
        return false;
      }
      return task.matches(key, compareId);
    });
    matchedTasks.sort((task) => task._source.kind === TaskSourceKind.Extension ? 1 : -1);
    if (matchedTasks.length > 0) {
      const task = matchedTasks[0];
      if (ConfiguringTask.is(task)) {
        return this.tryResolveTask(task);
      } else {
        return task;
      }
    }
    const map = await this._getGroupedTasks({ type });
    let values = map.get(folder);
    values = values.concat(map.get(USER_TASKS_GROUP_KEY));
    if (!values) {
      return void 0;
    }
    values = values.filter((task) => task.matches(key, compareId)).sort((task) => task._source.kind === TaskSourceKind.Extension ? 1 : -1);
    return values.length > 0 ? values[0] : void 0;
  }
  async tryResolveTask(configuringTask) {
    if (!await this._trust()) {
      return;
    }
    await this._activateTaskProviders(configuringTask.type);
    let matchingProvider;
    let matchingProviderUnavailable = false;
    for (const [handle, provider] of this._providers) {
      const providerType = this._providerTypes.get(handle);
      if (configuringTask.type === providerType) {
        if (providerType && !this._isTaskProviderEnabled(providerType)) {
          matchingProviderUnavailable = true;
          continue;
        }
        matchingProvider = provider;
        break;
      }
    }
    if (!matchingProvider) {
      if (matchingProviderUnavailable) {
        this._log(nls.localize(
          "TaskService.providerUnavailable",
          "Warning: {0} tasks are unavailable in the current environment.",
          configuringTask.configures.type
        ));
      }
      return;
    }
    try {
      const resolvedTask = await matchingProvider.resolveTask(configuringTask);
      if (resolvedTask && resolvedTask._id === configuringTask._id) {
        return TaskConfig.createCustomTask(resolvedTask, configuringTask);
      }
    } catch (error) {
    }
    const tasks = await this.tasks({ type: configuringTask.type });
    for (const task of tasks) {
      if (task._id === configuringTask._id) {
        return TaskConfig.createCustomTask(task, configuringTask);
      }
    }
    return;
  }
  async tasks(filter) {
    if (!await this._trust()) {
      return [];
    }
    if (!this._versionAndEngineCompatible(filter)) {
      return Promise.resolve([]);
    }
    return this._getGroupedTasks(filter).then((map) => this.applyFilterToTaskMap(filter, map));
  }
  async getKnownTasks(filter) {
    if (!this._versionAndEngineCompatible(filter)) {
      return Promise.resolve([]);
    }
    return this._getGroupedTasks(filter, true, true).then((map) => this.applyFilterToTaskMap(filter, map));
  }
  taskTypes() {
    const types = [];
    if (this._isProvideTasksEnabled()) {
      for (const definition of TaskDefinitionRegistry.all()) {
        if (this._isTaskProviderEnabled(definition.taskType)) {
          types.push(definition.taskType);
        }
      }
    }
    return types;
  }
  createSorter() {
    return new TaskSorter(this._contextService.getWorkspace() ? this._contextService.getWorkspace().folders : []);
  }
  _isActive() {
    if (!this._taskSystem) {
      return Promise.resolve(false);
    }
    return this._taskSystem.isActive();
  }
  async getActiveTasks() {
    if (!this._taskSystem) {
      return [];
    }
    return this._taskSystem.getActiveTasks();
  }
  async getBusyTasks() {
    if (!this._taskSystem) {
      return [];
    }
    return this._taskSystem.getBusyTasks();
  }
  getRecentlyUsedTasksV1() {
    if (this._recentlyUsedTasksV1) {
      return this._recentlyUsedTasksV1;
    }
    const quickOpenHistoryLimit = this._configurationService.getValue(QUICKOPEN_HISTORY_LIMIT_CONFIG);
    this._recentlyUsedTasksV1 = new LRUCache(quickOpenHistoryLimit);
    const storageValue = this._storageService.get(AbstractTaskService.RecentlyUsedTasks_Key, StorageScope.WORKSPACE);
    if (storageValue) {
      try {
        const values = JSON.parse(storageValue);
        if (Array.isArray(values)) {
          for (const value of values) {
            this._recentlyUsedTasksV1.set(value, value);
          }
        }
      } catch (error) {
      }
    }
    return this._recentlyUsedTasksV1;
  }
  applyFilterToTaskMap(filter, map) {
    if (!filter || !filter.type) {
      return map.all();
    }
    const result = [];
    map.forEach((tasks) => {
      for (const task of tasks) {
        if (ContributedTask.is(task) && (task.defines.type === filter.type || task._source.label === filter.type)) {
          result.push(task);
        } else if (CustomTask.is(task)) {
          if (task.type === filter.type) {
            result.push(task);
          } else {
            const customizes = task.customizes();
            if (customizes && customizes.type === filter.type) {
              result.push(task);
            }
          }
        }
      }
    });
    return result;
  }
  _getTasksFromStorage(type) {
    return type === "persistent" ? this._getPersistentTasks() : this._getRecentTasks();
  }
  _getRecentTasks() {
    if (this._recentlyUsedTasks) {
      return this._recentlyUsedTasks;
    }
    const quickOpenHistoryLimit = this._configurationService.getValue(QUICKOPEN_HISTORY_LIMIT_CONFIG);
    this._recentlyUsedTasks = new LRUCache(quickOpenHistoryLimit);
    const storageValue = this._storageService.get(AbstractTaskService.RecentlyUsedTasks_KeyV2, StorageScope.WORKSPACE);
    if (storageValue) {
      try {
        const values = JSON.parse(storageValue);
        if (Array.isArray(values)) {
          for (const value of values) {
            this._recentlyUsedTasks.set(value[0], value[1]);
          }
        }
      } catch (error) {
      }
    }
    return this._recentlyUsedTasks;
  }
  _getPersistentTasks() {
    if (this._persistentTasks) {
      this._log(nls.localize("taskService.gettingCachedTasks", "Returning cached tasks {0}", this._persistentTasks.size), true);
      return this._persistentTasks;
    }
    this._persistentTasks = new LRUCache(10);
    const storageValue = this._storageService.get(AbstractTaskService.PersistentTasks_Key, StorageScope.WORKSPACE);
    if (storageValue) {
      try {
        const values = JSON.parse(storageValue);
        if (Array.isArray(values)) {
          for (const value of values) {
            this._persistentTasks.set(value[0], value[1]);
          }
        }
      } catch (error) {
      }
    }
    return this._persistentTasks;
  }
  _getFolderFromTaskKey(key) {
    const keyValue = JSON.parse(key);
    return {
      folder: keyValue.folder,
      isWorkspaceFile: keyValue.id?.endsWith(TaskSourceKind.WorkspaceFile)
    };
  }
  async getSavedTasks(type) {
    const folderMap = /* @__PURE__ */ Object.create(null);
    this.workspaceFolders.forEach((folder) => {
      folderMap[folder.uri.toString()] = folder;
    });
    const folderToTasksMap = /* @__PURE__ */ new Map();
    const workspaceToTaskMap = /* @__PURE__ */ new Map();
    const storedTasks = this._getTasksFromStorage(type);
    const tasks = [];
    this._log(nls.localize("taskService.getSavedTasks", "Fetching tasks from task storage."), true);
    function addTaskToMap(map, folder, task) {
      if (folder && !map.has(folder)) {
        map.set(folder, []);
      }
      if (folder && (folderMap[folder] || folder === USER_TASKS_GROUP_KEY) && task) {
        map.get(folder).push(task);
      }
    }
    for (const entry of storedTasks.entries()) {
      try {
        const key = entry[0];
        const task = JSON.parse(entry[1]);
        const folderInfo = this._getFolderFromTaskKey(key);
        this._log(nls.localize("taskService.getSavedTasks.reading", "Reading tasks from task storage, {0}, {1}, {2}", key, task, folderInfo.folder), true);
        addTaskToMap(folderInfo.isWorkspaceFile ? workspaceToTaskMap : folderToTasksMap, folderInfo.folder, task);
      } catch (error) {
        this._log(nls.localize("taskService.getSavedTasks.error", "Fetching a task from task storage failed: {0}.", error), true);
      }
    }
    const readTasksMap = /* @__PURE__ */ new Map();
    async function readTasks(that, map, isWorkspaceFile) {
      for (const key of map.keys()) {
        const custom = [];
        const customized = /* @__PURE__ */ Object.create(null);
        const taskConfigSource = folderMap[key] ? isWorkspaceFile ? TaskConfig.TaskConfigSource.WorkspaceFile : TaskConfig.TaskConfigSource.TasksJson : TaskConfig.TaskConfigSource.User;
        await that._computeTasksForSingleConfig(folderMap[key] ?? await that._getAFolder(), {
          version: "2.0.0",
          tasks: map.get(key)
        }, TaskRunSource.System, custom, customized, taskConfigSource, true);
        custom.forEach((task) => {
          const taskKey = task.getKey();
          if (taskKey) {
            readTasksMap.set(taskKey, task);
          }
        });
        for (const configuration in customized) {
          const taskKey = customized[configuration].getKey();
          if (taskKey) {
            readTasksMap.set(taskKey, customized[configuration]);
          }
        }
      }
    }
    await readTasks(this, folderToTasksMap, false);
    await readTasks(this, workspaceToTaskMap, true);
    for (const key of storedTasks.keys()) {
      if (readTasksMap.has(key)) {
        tasks.push(readTasksMap.get(key));
        this._log(nls.localize("taskService.getSavedTasks.resolved", "Resolved task {0}", key), true);
      } else {
        this._log(nls.localize("taskService.getSavedTasks.unresolved", "Unable to resolve task {0} ", key), true);
      }
    }
    return tasks;
  }
  removeRecentlyUsedTask(taskRecentlyUsedKey) {
    if (this._getTasksFromStorage("historical").has(taskRecentlyUsedKey)) {
      this._getTasksFromStorage("historical").delete(taskRecentlyUsedKey);
      this._saveRecentlyUsedTasks();
    }
  }
  removePersistentTask(key) {
    this._log(nls.localize("taskService.removePersistentTask", "Removing persistent task {0}", key), true);
    if (this._getTasksFromStorage("persistent").has(key)) {
      this._getTasksFromStorage("persistent").delete(key);
      this._savePersistentTasks();
    }
  }
  _setTaskLRUCacheLimit() {
    const quickOpenHistoryLimit = this._configurationService.getValue(QUICKOPEN_HISTORY_LIMIT_CONFIG);
    if (this._recentlyUsedTasks) {
      this._recentlyUsedTasks.limit = quickOpenHistoryLimit;
    }
  }
  async _setRecentlyUsedTask(task) {
    let key = task.getKey();
    if (!InMemoryTask.is(task) && key) {
      const customizations = this._createCustomizableTask(task);
      if (ContributedTask.is(task) && customizations) {
        const custom = [];
        const customized = /* @__PURE__ */ Object.create(null);
        await this._computeTasksForSingleConfig(task._source.workspaceFolder ?? this.workspaceFolders[0], {
          version: "2.0.0",
          tasks: [customizations]
        }, TaskRunSource.System, custom, customized, TaskConfig.TaskConfigSource.TasksJson, true);
        for (const configuration in customized) {
          key = customized[configuration].getKey();
        }
      }
      this._getTasksFromStorage("historical").set(key, JSON.stringify(customizations));
      this._saveRecentlyUsedTasks();
    }
  }
  _saveRecentlyUsedTasks() {
    if (!this._recentlyUsedTasks) {
      return;
    }
    const quickOpenHistoryLimit = this._configurationService.getValue(QUICKOPEN_HISTORY_LIMIT_CONFIG);
    if (quickOpenHistoryLimit === 0) {
      return;
    }
    let keys = [...this._recentlyUsedTasks.keys()];
    if (keys.length > quickOpenHistoryLimit) {
      keys = keys.slice(0, quickOpenHistoryLimit);
    }
    const keyValues = [];
    for (const key of keys) {
      keyValues.push([key, this._recentlyUsedTasks.get(key, Touch.None)]);
    }
    this._storageService.store(AbstractTaskService.RecentlyUsedTasks_KeyV2, JSON.stringify(keyValues), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  async _setPersistentTask(task) {
    if (!this._configurationService.getValue(TaskSettingId.Reconnection)) {
      return;
    }
    let key = task.getKey();
    if (!InMemoryTask.is(task) && key) {
      const customizations = this._createCustomizableTask(task);
      if (ContributedTask.is(task) && customizations) {
        const custom = [];
        const customized = /* @__PURE__ */ Object.create(null);
        await this._computeTasksForSingleConfig(task._source.workspaceFolder ?? this.workspaceFolders[0], {
          version: "2.0.0",
          tasks: [customizations]
        }, TaskRunSource.System, custom, customized, TaskConfig.TaskConfigSource.TasksJson, true);
        for (const configuration in customized) {
          key = customized[configuration].getKey();
        }
      }
      if (!task.configurationProperties.isBackground) {
        return;
      }
      this._log(nls.localize("taskService.setPersistentTask", "Setting persistent task {0}", key), true);
      this._getTasksFromStorage("persistent").set(key, JSON.stringify(customizations));
      this._savePersistentTasks();
    }
  }
  _savePersistentTasks() {
    this._persistentTasks = this._getTasksFromStorage("persistent");
    const keys = [...this._persistentTasks.keys()];
    const keyValues = [];
    for (const key of keys) {
      keyValues.push([key, this._persistentTasks.get(key, Touch.None)]);
    }
    this._log(nls.localize("savePersistentTask", "Saving persistent tasks: {0}", keys.join(", ")), true);
    this._storageService.store(AbstractTaskService.PersistentTasks_Key, JSON.stringify(keyValues), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  _openDocumentation() {
    this._openerService.open(URI.parse("https://code.visualstudio.com/docs/editor/tasks#_defining-a-problem-matcher"));
  }
  async _findSingleWorkspaceTaskOfGroup(group) {
    const tasksOfGroup = await this._findWorkspaceTasksInGroup(group, true);
    if (tasksOfGroup.length === 1 && typeof tasksOfGroup[0].configurationProperties.group !== "string" && tasksOfGroup[0].configurationProperties.group?.isDefault) {
      let resolvedTask;
      if (ConfiguringTask.is(tasksOfGroup[0])) {
        resolvedTask = await this.tryResolveTask(tasksOfGroup[0]);
      } else {
        resolvedTask = tasksOfGroup[0];
      }
      if (resolvedTask) {
        return this.run(resolvedTask, void 0, TaskRunSource.User);
      }
    }
    return void 0;
  }
  async _build() {
    const tryBuildShortcut = await this._findSingleWorkspaceTaskOfGroup(TaskGroup.Build);
    if (tryBuildShortcut) {
      return tryBuildShortcut;
    }
    return this._getGroupedTasksAndExecute();
  }
  async _runTest() {
    const tryTestShortcut = await this._findSingleWorkspaceTaskOfGroup(TaskGroup.Test);
    if (tryTestShortcut) {
      return tryTestShortcut;
    }
    return this._getGroupedTasksAndExecute(true);
  }
  async _getGroupedTasksAndExecute(test) {
    const tasks = await this._getGroupedTasks();
    const runnable = this._createRunnableTask(tasks, test ? TaskGroup.Test : TaskGroup.Build);
    if (!runnable || !runnable.task) {
      if (test) {
        if (this.schemaVersion === JsonSchemaVersion.V0_1_0) {
          throw new TaskError(Severity.Info, nls.localize("TaskService.noTestTask1", "No test task defined. Mark a task with 'isTestCommand' in the tasks.json file."), TaskErrors.NoTestTask);
        } else {
          throw new TaskError(Severity.Info, nls.localize("TaskService.noTestTask2", "No test task defined. Mark a task with as a 'test' group in the tasks.json file."), TaskErrors.NoTestTask);
        }
      } else {
        if (this.schemaVersion === JsonSchemaVersion.V0_1_0) {
          throw new TaskError(Severity.Info, nls.localize("TaskService.noBuildTask1", "No build task defined. Mark a task with 'isBuildCommand' in the tasks.json file."), TaskErrors.NoBuildTask);
        } else {
          throw new TaskError(Severity.Info, nls.localize("TaskService.noBuildTask2", "No build task defined. Mark a task with as a 'build' group in the tasks.json file."), TaskErrors.NoBuildTask);
        }
      }
    }
    let executeTaskResult;
    try {
      executeTaskResult = await this._executeTask(runnable.task, runnable.resolver, TaskRunSource.User);
    } catch (error) {
      this._handleError(error);
      return Promise.reject(error);
    }
    return executeTaskResult;
  }
  async run(task, options, runSource = TaskRunSource.System) {
    if (!await this._trust()) {
      return;
    }
    if (!task) {
      throw new TaskError(Severity.Info, nls.localize("TaskServer.noTask", "Task to execute is undefined"), TaskErrors.TaskNotFound);
    }
    const resolver = this._createResolver();
    let executeTaskResult;
    try {
      if (options && options.attachProblemMatcher && this._shouldAttachProblemMatcher(task) && !InMemoryTask.is(task)) {
        const taskToExecute = await this._attachProblemMatcher(task);
        if (taskToExecute) {
          executeTaskResult = await this._executeTask(taskToExecute, resolver, runSource);
        }
      } else {
        executeTaskResult = await this._executeTask(task, resolver, runSource);
      }
      return executeTaskResult;
    } catch (error) {
      this._handleError(error);
      return Promise.reject(error);
    }
  }
  _isProvideTasksEnabled() {
    const settingValue = this._configurationService.getValue(TaskSettingId.AutoDetect);
    return settingValue === "on";
  }
  _isProblemMatcherPromptEnabled(type) {
    const settingValue = this._configurationService.getValue(PROBLEM_MATCHER_NEVER_CONFIG);
    if (Types.isBoolean(settingValue)) {
      return !settingValue;
    }
    if (type === void 0) {
      return true;
    }
    const settingValueMap = settingValue;
    return !settingValueMap[type];
  }
  _getTypeForTask(task) {
    let type;
    if (CustomTask.is(task)) {
      const configProperties = task._source.config.element;
      type = configProperties.type;
    } else {
      type = task.getDefinition().type;
    }
    return type;
  }
  _shouldAttachProblemMatcher(task) {
    const enabled = this._isProblemMatcherPromptEnabled(this._getTypeForTask(task));
    if (enabled === false) {
      return false;
    }
    if (!this._canCustomize(task)) {
      return false;
    }
    if (task.configurationProperties.group !== void 0 && task.configurationProperties.group !== TaskGroup.Build) {
      return false;
    }
    if (task.configurationProperties.problemMatchers !== void 0 && task.configurationProperties.problemMatchers.length > 0) {
      return false;
    }
    if (ContributedTask.is(task)) {
      return !task.hasDefinedMatchers && !!task.configurationProperties.problemMatchers && task.configurationProperties.problemMatchers.length === 0;
    }
    if (CustomTask.is(task)) {
      const configProperties = task._source.config.element;
      return configProperties.problemMatcher === void 0 && !task.hasDefinedMatchers;
    }
    return false;
  }
  async _updateNeverProblemMatcherSetting(type) {
    const current = this._configurationService.getValue(PROBLEM_MATCHER_NEVER_CONFIG);
    if (current === true) {
      return;
    }
    let newValue;
    if (current !== false) {
      newValue = current;
    } else {
      newValue = /* @__PURE__ */ Object.create(null);
    }
    newValue[type] = true;
    return this._configurationService.updateValue(PROBLEM_MATCHER_NEVER_CONFIG, newValue);
  }
  async _attachProblemMatcher(task) {
    let entries = [];
    for (const key of ProblemMatcherRegistry.keys()) {
      const matcher = ProblemMatcherRegistry.get(key);
      if (matcher.deprecated) {
        continue;
      }
      if (matcher.name === matcher.label) {
        entries.push({ label: matcher.name, matcher });
      } else {
        entries.push({
          label: matcher.label,
          description: `$${matcher.name}`,
          matcher
        });
      }
    }
    if (entries.length === 0) {
      return;
    }
    entries = entries.sort((a, b) => {
      if (a.label && b.label) {
        return a.label.localeCompare(b.label);
      } else {
        return 0;
      }
    });
    entries.unshift({ type: "separator", label: nls.localize("TaskService.associate", "associate") });
    let taskType;
    if (CustomTask.is(task)) {
      const configProperties = task._source.config.element;
      taskType = configProperties.type;
    } else {
      taskType = task.getDefinition().type;
    }
    entries.unshift(
      { label: nls.localize("TaskService.attachProblemMatcher.continueWithout", "Continue without scanning the task output"), matcher: void 0 },
      { label: nls.localize("TaskService.attachProblemMatcher.never", "Never scan the task output for this task"), matcher: void 0, never: true },
      { label: nls.localize("TaskService.attachProblemMatcher.neverType", "Never scan the task output for {0} tasks", taskType), matcher: void 0, setting: taskType },
      { label: nls.localize("TaskService.attachProblemMatcher.learnMoreAbout", "Learn more about scanning the task output"), matcher: void 0, learnMore: true }
    );
    const problemMatcher = await this._quickInputService.pick(entries, { placeHolder: nls.localize("selectProblemMatcher", "Select for which kind of errors and warnings to scan the task output") });
    if (!problemMatcher) {
      return task;
    }
    if (problemMatcher.learnMore) {
      this._openDocumentation();
      return void 0;
    }
    if (problemMatcher.never) {
      this.customize(task, { problemMatcher: [] }, true);
      return task;
    }
    if (problemMatcher.matcher) {
      const newTask = task.clone();
      const matcherReference = `$${problemMatcher.matcher.name}`;
      const properties = { problemMatcher: [matcherReference] };
      newTask.configurationProperties.problemMatchers = [matcherReference];
      const matcher = ProblemMatcherRegistry.get(problemMatcher.matcher.name);
      if (matcher && matcher.watching !== void 0) {
        properties.isBackground = true;
        newTask.configurationProperties.isBackground = true;
      }
      this.customize(task, properties, true);
      return newTask;
    }
    if (problemMatcher.setting) {
      await this._updateNeverProblemMatcherSetting(problemMatcher.setting);
    }
    return task;
  }
  async _getTasksForGroup(group, waitToActivate) {
    const groups = await this._getGroupedTasks(void 0, waitToActivate);
    const result = [];
    groups.forEach((tasks) => {
      for (const task of tasks) {
        const configTaskGroup = TaskGroup.from(task.configurationProperties.group);
        if (configTaskGroup?._id === group._id) {
          result.push(task);
        }
      }
    });
    return result;
  }
  needsFolderQualification() {
    return this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
  }
  _canCustomize(task) {
    if (this.schemaVersion !== JsonSchemaVersion.V2_0_0) {
      return false;
    }
    if (CustomTask.is(task)) {
      return true;
    }
    if (ContributedTask.is(task)) {
      return !!task.getWorkspaceFolder();
    }
    return false;
  }
  async _formatTaskForJson(resource, task) {
    let reference;
    let stringValue = "";
    try {
      reference = await this._textModelResolverService.createModelReference(resource);
      const model = reference.object.textEditorModel;
      const { tabSize, insertSpaces } = model.getOptions();
      const eol = model.getEOL();
      let stringified = toFormattedString(task, { eol, tabSize, insertSpaces });
      const regex = new RegExp(eol + (insertSpaces ? " ".repeat(tabSize) : "\\t"), "g");
      stringified = stringified.replace(regex, eol + (insertSpaces ? " ".repeat(tabSize * 3) : "			"));
      const twoTabs = insertSpaces ? " ".repeat(tabSize * 2) : "		";
      stringValue = twoTabs + stringified.slice(0, stringified.length - 1) + twoTabs + stringified.slice(stringified.length - 1);
    } finally {
      reference?.dispose();
    }
    return stringValue;
  }
  async _openEditorAtTask(resource, task, configIndex = -1) {
    if (resource === void 0) {
      return Promise.resolve(false);
    }
    const fileContent = await this._fileService.readFile(resource);
    const content = fileContent.value;
    if (!content || !task) {
      return false;
    }
    const contentValue = content.toString();
    let stringValue;
    if (configIndex !== -1) {
      const json2 = this._configurationService.getValue("tasks", { resource });
      if (json2.tasks && json2.tasks.length > configIndex) {
        stringValue = await this._formatTaskForJson(resource, json2.tasks[configIndex]);
      }
    }
    if (!stringValue) {
      if (typeof task === "string") {
        stringValue = task;
      } else {
        stringValue = await this._formatTaskForJson(resource, task);
      }
    }
    const index = contentValue.indexOf(stringValue);
    let startLineNumber = 1;
    for (let i = 0; i < index; i++) {
      if (contentValue.charAt(i) === "\n") {
        startLineNumber++;
      }
    }
    let endLineNumber = startLineNumber;
    for (let i = 0; i < stringValue.length; i++) {
      if (stringValue.charAt(i) === "\n") {
        endLineNumber++;
      }
    }
    const selection = startLineNumber > 1 ? { startLineNumber, startColumn: startLineNumber === endLineNumber ? 4 : 3, endLineNumber, endColumn: startLineNumber === endLineNumber ? void 0 : 4 } : void 0;
    await this._editorService.openEditor({
      resource,
      options: {
        pinned: false,
        forceReload: true,
        // because content might have changed
        selection,
        selectionRevealType: TextEditorSelectionRevealType.CenterIfOutsideViewport
      }
    });
    return !!selection;
  }
  _createCustomizableTask(task) {
    let toCustomize;
    const taskConfig = CustomTask.is(task) || ConfiguringTask.is(task) ? task._source.config : void 0;
    if (taskConfig && taskConfig.element) {
      toCustomize = { ...taskConfig.element };
    } else if (ContributedTask.is(task)) {
      toCustomize = {};
      const identifier = Object.assign(/* @__PURE__ */ Object.create(null), task.defines);
      delete identifier["_key"];
      Object.keys(identifier).forEach((key) => toCustomize[key] = identifier[key]);
      if (task.configurationProperties.problemMatchers && task.configurationProperties.problemMatchers.length > 0 && Types.isStringArray(task.configurationProperties.problemMatchers)) {
        toCustomize.problemMatcher = task.configurationProperties.problemMatchers;
      }
      if (task.configurationProperties.group) {
        toCustomize.group = TaskConfig.GroupKind.to(task.configurationProperties.group);
      }
    }
    if (!toCustomize) {
      return void 0;
    }
    if (toCustomize.problemMatcher === void 0 && task.configurationProperties.problemMatchers === void 0 || task.configurationProperties.problemMatchers && task.configurationProperties.problemMatchers.length === 0) {
      toCustomize.problemMatcher = [];
    }
    if (task._source.label !== "Workspace") {
      toCustomize.label = task.configurationProperties.identifier;
    } else {
      toCustomize.label = task._label;
    }
    toCustomize.detail = task.configurationProperties.detail;
    return toCustomize;
  }
  async customize(task, properties, openConfig) {
    if (!await this._trust()) {
      return;
    }
    const workspaceFolder = task.getWorkspaceFolder();
    if (!workspaceFolder) {
      return Promise.resolve(void 0);
    }
    const configuration = this._getConfiguration(workspaceFolder, task._source.kind);
    if (configuration.hasParseErrors) {
      this._notificationService.warn(nls.localize("customizeParseErrors", "The current task configuration has errors. Please fix the errors first before customizing a task."));
      return Promise.resolve(void 0);
    }
    const fileConfig = configuration.config;
    const toCustomize = this._createCustomizableTask(task);
    if (!toCustomize) {
      return Promise.resolve(void 0);
    }
    const index = CustomTask.is(task) ? task._source.config.index : void 0;
    if (properties) {
      for (const property of Object.getOwnPropertyNames(properties)) {
        const value = properties[property];
        if (value !== void 0 && value !== null) {
          toCustomize[property] = value;
        }
      }
    }
    if (!fileConfig) {
      const value = {
        version: "2.0.0",
        tasks: [toCustomize]
      };
      let content = [
        "{",
        nls.localize("tasksJsonComment", "	// See https://go.microsoft.com/fwlink/?LinkId=733558 \n	// for the documentation about the tasks.json format")
      ].join("\n") + JSON.stringify(value, null, "	").substr(1);
      const editorConfig = this._configurationService.getValue();
      if (editorConfig.editor.insertSpaces) {
        content = content.replace(/(\n)(\t+)/g, (_, s1, s2) => s1 + " ".repeat(s2.length * editorConfig.editor.tabSize));
      }
      await this._textFileService.create([{ resource: workspaceFolder.toResource(".vscode/tasks.json"), value: content }]);
    } else {
      if (index === -1 && properties) {
        if (properties.problemMatcher !== void 0) {
          fileConfig.problemMatcher = properties.problemMatcher;
          await this._writeConfiguration(workspaceFolder, "tasks.problemMatchers", fileConfig.problemMatcher, task._source.kind);
        } else if (properties.group !== void 0) {
          fileConfig.group = properties.group;
          await this._writeConfiguration(workspaceFolder, "tasks.group", fileConfig.group, task._source.kind);
        }
      } else {
        if (!Array.isArray(fileConfig.tasks)) {
          fileConfig.tasks = [];
        }
        if (index === void 0) {
          fileConfig.tasks.push(toCustomize);
        } else {
          fileConfig.tasks[index] = toCustomize;
        }
        await this._writeConfiguration(workspaceFolder, "tasks.tasks", fileConfig.tasks, task._source.kind);
      }
    }
    if (openConfig) {
      this._openEditorAtTask(this._getResourceForTask(task), toCustomize);
    }
  }
  _writeConfiguration(workspaceFolder, key, value, source) {
    let target = void 0;
    switch (source) {
      case TaskSourceKind.User:
        target = ConfigurationTarget.USER;
        break;
      case TaskSourceKind.WorkspaceFile:
        target = ConfigurationTarget.WORKSPACE;
        break;
      default:
        if (this._contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
          target = ConfigurationTarget.WORKSPACE;
        } else if (this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
          target = ConfigurationTarget.WORKSPACE_FOLDER;
        }
    }
    if (target) {
      return this._configurationService.updateValue(key, value, { resource: workspaceFolder.uri }, target);
    } else {
      return void 0;
    }
  }
  _getResourceForKind(kind) {
    this._updateSetup();
    switch (kind) {
      case TaskSourceKind.User: {
        return resources.joinPath(resources.dirname(this._preferencesService.userSettingsResource), "tasks.json");
      }
      case TaskSourceKind.WorkspaceFile: {
        if (this._workspace && this._workspace.configuration) {
          return this._workspace.configuration;
        }
      }
      default: {
        return void 0;
      }
    }
  }
  _getResourceForTask(task) {
    if (CustomTask.is(task)) {
      let uri = this._getResourceForKind(task._source.kind);
      if (!uri) {
        const taskFolder = task.getWorkspaceFolder();
        if (taskFolder) {
          uri = taskFolder.toResource(task._source.config.file);
        } else {
          uri = this.workspaceFolders[0].uri;
        }
      }
      return uri;
    } else {
      return task.getWorkspaceFolder().toResource(".vscode/tasks.json");
    }
  }
  async openConfig(task) {
    let resource;
    if (task) {
      resource = this._getResourceForTask(task);
    } else {
      resource = this._workspaceFolders && this._workspaceFolders.length > 0 ? this._workspaceFolders[0].toResource(".vscode/tasks.json") : void 0;
    }
    return this._openEditorAtTask(resource, task ? task._label : void 0, task ? task._source.config.index : -1);
  }
  _createRunnableTask(tasks, group) {
    const resolverData = /* @__PURE__ */ new Map();
    const workspaceTasks = [];
    const extensionTasks = [];
    tasks.forEach((tasks2, folder) => {
      let data = resolverData.get(folder);
      if (!data) {
        data = {
          id: /* @__PURE__ */ new Map(),
          label: /* @__PURE__ */ new Map(),
          identifier: /* @__PURE__ */ new Map()
        };
        resolverData.set(folder, data);
      }
      for (const task of tasks2) {
        data.id.set(task._id, task);
        data.label.set(task._label, task);
        if (task.configurationProperties.identifier) {
          data.identifier.set(task.configurationProperties.identifier, task);
        }
        if (group && task.configurationProperties.group === group) {
          if (task._source.kind === TaskSourceKind.Workspace) {
            workspaceTasks.push(task);
          } else {
            extensionTasks.push(task);
          }
        }
      }
    });
    const resolver = {
      resolve: async (uri, alias) => {
        const data = resolverData.get(typeof uri === "string" ? uri : uri.toString());
        if (!data) {
          return void 0;
        }
        return data.id.get(alias) || data.label.get(alias) || data.identifier.get(alias);
      }
    };
    if (workspaceTasks.length > 0) {
      if (workspaceTasks.length > 1) {
        this._log(nls.localize("moreThanOneBuildTask", "There are many build tasks defined in the tasks.json. Executing the first one."));
      }
      return { task: workspaceTasks[0], resolver };
    }
    if (extensionTasks.length === 0) {
      return void 0;
    }
    if (extensionTasks.length === 1) {
      return { task: extensionTasks[0], resolver };
    } else {
      const id = UUID.generateUuid();
      const task = new InMemoryTask(
        id,
        { kind: TaskSourceKind.InMemory, label: "inMemory" },
        id,
        "inMemory",
        { reevaluateOnRerun: true },
        {
          identifier: id,
          dependsOn: extensionTasks.map((extensionTask) => {
            return { uri: extensionTask.getWorkspaceFolder().uri, task: extensionTask._id };
          }),
          name: id
        }
      );
      return { task, resolver };
    }
  }
  _createResolver(grouped) {
    let resolverData;
    async function quickResolve(that, uri, identifier) {
      const foundTasks = await that._findWorkspaceTasks((task2) => {
        const taskUri = ConfiguringTask.is(task2) || CustomTask.is(task2) ? task2._source.config.workspaceFolder?.uri : void 0;
        const originalUri = typeof uri === "string" ? uri : uri.toString();
        if (taskUri?.toString() !== originalUri) {
          return false;
        }
        if (Types.isString(identifier)) {
          return task2._label === identifier || task2.configurationProperties.identifier === identifier;
        } else {
          const keyedIdentifier = task2.getDefinition(true);
          const searchIdentifier = TaskDefinition.createTaskIdentifier(identifier, console);
          return searchIdentifier && keyedIdentifier ? searchIdentifier._key === keyedIdentifier._key : false;
        }
      });
      if (foundTasks.length === 0) {
        return void 0;
      }
      const task = foundTasks[0];
      if (ConfiguringTask.is(task)) {
        return that.tryResolveTask(task);
      }
      return task;
    }
    async function getResolverData(that) {
      if (resolverData === void 0) {
        resolverData = /* @__PURE__ */ new Map();
        (grouped || await that._getGroupedTasks()).forEach((tasks, folder) => {
          let data = resolverData.get(folder);
          if (!data) {
            data = { label: /* @__PURE__ */ new Map(), identifier: /* @__PURE__ */ new Map(), taskIdentifier: /* @__PURE__ */ new Map() };
            resolverData.set(folder, data);
          }
          for (const task of tasks) {
            data.label.set(task._label, task);
            if (task.configurationProperties.identifier) {
              data.identifier.set(task.configurationProperties.identifier, task);
            }
            const keyedIdentifier = task.getDefinition(true);
            if (keyedIdentifier !== void 0) {
              data.taskIdentifier.set(keyedIdentifier._key, task);
            }
          }
        });
      }
      return resolverData;
    }
    async function fullResolve(that, uri, identifier) {
      const allResolverData = await getResolverData(that);
      const data = allResolverData.get(typeof uri === "string" ? uri : uri.toString());
      if (!data) {
        return void 0;
      }
      if (Types.isString(identifier)) {
        return data.label.get(identifier) || data.identifier.get(identifier);
      } else {
        const key = TaskDefinition.createTaskIdentifier(identifier, console);
        return key !== void 0 ? data.taskIdentifier.get(key._key) : void 0;
      }
    }
    return {
      resolve: async (uri, identifier) => {
        if (!identifier) {
          return void 0;
        }
        if (resolverData === void 0 && grouped === void 0) {
          return await quickResolve(this, uri, identifier) ?? fullResolve(this, uri, identifier);
        } else {
          return fullResolve(this, uri, identifier);
        }
      }
    };
  }
  async _saveBeforeRun() {
    let SaveBeforeRunConfigOptions;
    ((SaveBeforeRunConfigOptions2) => {
      SaveBeforeRunConfigOptions2["Always"] = "always";
      SaveBeforeRunConfigOptions2["Never"] = "never";
      SaveBeforeRunConfigOptions2["Prompt"] = "prompt";
    })(SaveBeforeRunConfigOptions || (SaveBeforeRunConfigOptions = {}));
    const saveBeforeRunTaskConfig = this._configurationService.getValue(TaskSettingId.SaveBeforeRun);
    if (saveBeforeRunTaskConfig === "never" /* Never */) {
      return false;
    } else if (saveBeforeRunTaskConfig === "prompt" /* Prompt */ && this._editorService.editors.some((e) => e.isDirty())) {
      const { confirmed } = await this._dialogService.confirm({
        message: nls.localize("TaskSystem.saveBeforeRun.prompt.title", "Save all editors?"),
        detail: nls.localize("detail", "Do you want to save all editors before running the task?"),
        primaryButton: nls.localize({ key: "saveBeforeRun.save", comment: ["&& denotes a mnemonic"] }, "&&Save"),
        cancelButton: nls.localize({ key: "saveBeforeRun.dontSave", comment: ["&& denotes a mnemonic"] }, "Do&&n't Save")
      });
      if (!confirmed) {
        return false;
      }
    }
    await this._editorService.saveAll({ reason: SaveReason.AUTO });
    return true;
  }
  async _executeTask(task, resolver, runSource) {
    let taskToRun = task;
    if (await this._saveBeforeRun()) {
      await this._configurationService.reloadConfiguration();
      await this._updateWorkspaceTasks();
      const taskFolder = task.getWorkspaceFolder();
      const taskIdentifier = task.configurationProperties.identifier;
      const taskType = CustomTask.is(task) ? task.customizes()?.type : ContributedTask.is(task) ? task.type : void 0;
      taskToRun = (taskFolder && taskIdentifier && runSource === TaskRunSource.User ? await this.getTask(taskFolder, taskIdentifier, false, taskType) : task) ?? task;
    }
    await ProblemMatcherRegistry.onReady();
    const executeResult = runSource === TaskRunSource.Reconnect ? this._getTaskSystem().reconnect(taskToRun, resolver) : this._getTaskSystem().run(taskToRun, resolver);
    if (executeResult) {
      return this._handleExecuteResult(executeResult, runSource);
    }
    return { exitCode: 0 };
  }
  async _handleExecuteResult(executeResult, runSource) {
    if (runSource === TaskRunSource.User) {
      await this._setRecentlyUsedTask(executeResult.task);
    }
    if (executeResult.kind === TaskExecuteKind.Active) {
      const active = executeResult.active;
      if (active && active.same && runSource === TaskRunSource.FolderOpen || runSource === TaskRunSource.Reconnect) {
        this._logService.debug("Ignoring task that is already active", executeResult.task);
        return executeResult.promise;
      }
      if (active && active.same) {
        if (this._taskSystem?.isTaskVisible(executeResult.task)) {
          const message = nls.localize("TaskSystem.activeSame.noBackground", "The task '{0}' is already active.", executeResult.task.getQualifiedLabel());
          const lastInstance = this._getTaskSystem().getLastInstance(executeResult.task) ?? executeResult.task;
          this._notificationService.prompt(
            Severity.Warning,
            message,
            [
              {
                label: nls.localize("terminateTask", "Terminate Task"),
                run: () => this.terminate(lastInstance)
              },
              {
                label: nls.localize("restartTask", "Restart Task"),
                run: () => this._restart(lastInstance)
              }
            ],
            { sticky: true }
          );
        } else {
          this._taskSystem?.revealTask(executeResult.task);
        }
      } else {
        throw new TaskError(Severity.Warning, nls.localize("TaskSystem.active", "There is already a task running. Terminate it first before executing another task."), TaskErrors.RunningTask);
      }
    }
    this._setRecentlyUsedTask(executeResult.task);
    return executeResult.promise;
  }
  async _restart(task) {
    if (!this._taskSystem) {
      return;
    }
    const response = await this._taskSystem.terminate(task);
    if (response.success) {
      try {
        await this.run(task);
      } catch {
      }
    } else {
      this._notificationService.warn(nls.localize("TaskSystem.restartFailed", "Failed to terminate and restart task {0}", Types.isString(task) ? task : task.configurationProperties.name));
    }
  }
  async terminate(task) {
    if (!await this._trust()) {
      return { success: true, task: void 0 };
    }
    if (!this._taskSystem) {
      return { success: true, task: void 0 };
    }
    return this._taskSystem.terminate(task);
  }
  _terminateAll() {
    if (!this._taskSystem) {
      return Promise.resolve([]);
    }
    return this._taskSystem.terminateAll();
  }
  _createTerminalTaskSystem() {
    return new TerminalTaskSystem(
      this._terminalService,
      this._terminalGroupService,
      this._outputService,
      this._paneCompositeService,
      this._viewsService,
      this._markerService,
      this._modelService,
      this._configurationResolverService,
      this._contextService,
      this._environmentService,
      AbstractTaskService.OutputChannelId,
      this._fileService,
      this._terminalProfileResolverService,
      this._pathService,
      this._viewDescriptorService,
      this._logService,
      this._notificationService,
      this._contextKeyService,
      this._instantiationService,
      (workspaceFolder) => {
        if (workspaceFolder) {
          return this._getTaskSystemInfo(workspaceFolder.uri.scheme);
        } else if (this._taskSystemInfos.size > 0) {
          const infos = Array.from(this._taskSystemInfos.entries());
          const notFile = infos.filter((info) => info[0] !== Schemas.file);
          if (notFile.length > 0) {
            return notFile[0][1][0];
          }
          return infos[0][1][0];
        } else {
          return void 0;
        }
      }
    );
  }
  _isTaskProviderEnabled(type) {
    const definition = TaskDefinitionRegistry.get(type);
    return !definition || !definition.when || this._contextKeyService.contextMatchesRules(definition.when);
  }
  async _getGroupedTasks(filter, waitToActivate, knownOnlyOrTrusted) {
    await this._waitForAllSupportedExecutions;
    const type = filter?.type;
    const needsRecentTasksMigration = this._needsRecentTasksMigration();
    if (!waitToActivate) {
      await this._activateTaskProviders(filter?.type);
    }
    const validTypes = /* @__PURE__ */ Object.create(null);
    TaskDefinitionRegistry.all().forEach((definition) => validTypes[definition.taskType] = true);
    validTypes["shell"] = true;
    validTypes["process"] = true;
    const contributedTaskSets = await new Promise((resolve) => {
      const result2 = [];
      let counter = 0;
      const done = (value) => {
        if (value) {
          result2.push(value);
        }
        if (--counter === 0) {
          resolve(result2);
        }
      };
      const error = (error2) => {
        try {
          if (!isCancellationError(error2)) {
            if (error2 && Types.isString(error2.message)) {
              this._log(`Error: ${error2.message}
`);
              this._showOutput();
            } else {
              this._log("Unknown error received while collecting tasks from providers.");
              this._showOutput();
            }
          }
        } finally {
          if (--counter === 0) {
            resolve(result2);
          }
        }
      };
      if (this._isProvideTasksEnabled() && this.schemaVersion === JsonSchemaVersion.V2_0_0 && this._providers.size > 0) {
        let foundAnyProviders = false;
        for (const [handle, provider] of this._providers) {
          const providerType = this._providerTypes.get(handle);
          if (type === void 0 || type === providerType) {
            if (providerType && !this._isTaskProviderEnabled(providerType)) {
              continue;
            }
            foundAnyProviders = true;
            counter++;
            raceTimeout(provider.provideTasks(validTypes).then((taskSet) => {
              for (const task of taskSet.tasks) {
                if (task.type !== this._providerTypes.get(handle)) {
                  this._log(nls.localize("unexpectedTaskType", 'The task provider for "{0}" tasks unexpectedly provided a task of type "{1}".\n', this._providerTypes.get(handle), task.type));
                  if (task.type !== "shell" && task.type !== "process") {
                    this._showOutput();
                  }
                  break;
                }
              }
              return done(taskSet);
            }, error), 5e3, () => {
              console.error("Timed out getting tasks from ", providerType);
              done(void 0);
            });
          }
        }
        if (!foundAnyProviders) {
          resolve(result2);
        }
      } else {
        resolve(result2);
      }
    });
    const result = new TaskMap();
    const contributedTasks = new TaskMap();
    for (const set of contributedTaskSets) {
      for (const task of set.tasks) {
        const workspaceFolder = task.getWorkspaceFolder();
        if (workspaceFolder) {
          contributedTasks.add(workspaceFolder, task);
        }
      }
    }
    try {
      let tasks = [];
      if (!knownOnlyOrTrusted || this._workspaceTrustManagementService.isWorkspaceTrusted()) {
        tasks = Array.from(await this.getWorkspaceTasks());
      }
      await Promise.all(this._getCustomTaskPromises(tasks, filter, result, contributedTasks, waitToActivate));
      if (needsRecentTasksMigration) {
        await this._migrateRecentTasks(result.all());
      }
      return result;
    } catch {
      const result2 = new TaskMap();
      for (const set of contributedTaskSets) {
        for (const task of set.tasks) {
          const folder = task.getWorkspaceFolder();
          if (folder) {
            result2.add(folder, task);
          }
        }
      }
      return result2;
    }
  }
  _getCustomTaskPromises(customTasksKeyValuePairs, filter, result, contributedTasks, waitToActivate) {
    return customTasksKeyValuePairs.map(async ([key, folderTasks]) => {
      const contributed = contributedTasks.get(key);
      if (!folderTasks.set) {
        if (contributed) {
          result.add(key, ...contributed);
        }
        return;
      }
      if (this._contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
        result.add(key, ...folderTasks.set.tasks);
      } else {
        const configurations = folderTasks.configurations;
        const legacyTaskConfigurations = folderTasks.set ? this._getLegacyTaskConfigurations(folderTasks.set) : void 0;
        const customTasksToDelete = [];
        if (configurations || legacyTaskConfigurations) {
          const unUsedConfigurations = /* @__PURE__ */ new Set();
          if (configurations) {
            Object.keys(configurations.byIdentifier).forEach((key2) => unUsedConfigurations.add(key2));
          }
          for (const task of contributed) {
            if (!ContributedTask.is(task)) {
              continue;
            }
            if (configurations) {
              const configuringTask = configurations.byIdentifier[task.defines._key];
              if (configuringTask) {
                unUsedConfigurations.delete(task.defines._key);
                result.add(key, TaskConfig.createCustomTask(task, configuringTask));
              } else {
                result.add(key, task);
              }
            } else if (legacyTaskConfigurations) {
              const configuringTask = legacyTaskConfigurations[task.defines._key];
              if (configuringTask) {
                result.add(key, TaskConfig.createCustomTask(task, configuringTask));
                customTasksToDelete.push(configuringTask);
              } else {
                result.add(key, task);
              }
            } else {
              result.add(key, task);
            }
          }
          if (customTasksToDelete.length > 0) {
            const toDelete = customTasksToDelete.reduce((map, task) => {
              map[task._id] = true;
              return map;
            }, /* @__PURE__ */ Object.create(null));
            for (const task of folderTasks.set.tasks) {
              if (toDelete[task._id]) {
                continue;
              }
              result.add(key, task);
            }
          } else {
            result.add(key, ...folderTasks.set.tasks);
          }
          const unUsedConfigurationsAsArray = Array.from(unUsedConfigurations);
          const unUsedConfigurationPromises = unUsedConfigurationsAsArray.map(async (value) => {
            const configuringTask = configurations.byIdentifier[value];
            if (filter?.type && filter.type !== configuringTask.configures.type) {
              return;
            }
            let requiredTaskProviderUnavailable = false;
            for (const [handle, provider] of this._providers) {
              const providerType = this._providerTypes.get(handle);
              if (configuringTask.type === providerType) {
                if (providerType && !this._isTaskProviderEnabled(providerType)) {
                  requiredTaskProviderUnavailable = true;
                  continue;
                }
                try {
                  const resolvedTask = await provider.resolveTask(configuringTask);
                  if (resolvedTask && resolvedTask._id === configuringTask._id) {
                    result.add(key, TaskConfig.createCustomTask(resolvedTask, configuringTask));
                    return;
                  }
                } catch (error) {
                }
              }
            }
            if (requiredTaskProviderUnavailable) {
              this._log(nls.localize(
                "TaskService.providerUnavailable",
                "Warning: {0} tasks are unavailable in the current environment.",
                configuringTask.configures.type
              ));
            } else if (!waitToActivate) {
              this._log(nls.localize(
                "TaskService.noConfiguration",
                "Error: The {0} task detection didn't contribute a task for the following configuration:\n{1}\nThe task will be ignored.",
                configuringTask.configures.type,
                JSON.stringify(configuringTask._source.config.element, void 0, 4)
              ));
              this._showOutput();
            }
          });
          await Promise.all(unUsedConfigurationPromises);
        } else {
          result.add(key, ...folderTasks.set.tasks);
          result.add(key, ...contributed);
        }
      }
    });
  }
  _getLegacyTaskConfigurations(workspaceTasks) {
    let result;
    function getResult() {
      if (result) {
        return result;
      }
      result = /* @__PURE__ */ Object.create(null);
      return result;
    }
    for (const task of workspaceTasks.tasks) {
      if (CustomTask.is(task)) {
        const commandName = task.command && task.command.name;
        if (commandName === "gulp" || commandName === "grunt" || commandName === "jake") {
          const identifier = KeyedTaskIdentifier.create({
            type: commandName,
            task: task.configurationProperties.name
          });
          getResult()[identifier._key] = task;
        }
      }
    }
    return result;
  }
  async getWorkspaceTasks(runSource = TaskRunSource.User) {
    if (!await this._trust()) {
      return /* @__PURE__ */ new Map();
    }
    await raceTimeout(this._waitForAllSupportedExecutions, 2e3, () => {
      this._logService.warn("Timed out waiting for all supported executions");
    });
    await this._whenTaskSystemReady;
    if (this._workspaceTasksPromise) {
      return this._workspaceTasksPromise;
    }
    return this._updateWorkspaceTasks(runSource);
  }
  _updateWorkspaceTasks(runSource = TaskRunSource.User) {
    this._workspaceTasksPromise = this._computeWorkspaceTasks(runSource);
    return this._workspaceTasksPromise;
  }
  async _getAFolder() {
    let folder = this.workspaceFolders.length > 0 ? this.workspaceFolders[0] : void 0;
    if (!folder) {
      const userhome = await this._pathService.userHome();
      folder = new WorkspaceFolder({ uri: userhome, name: resources.basename(userhome), index: 0 });
    }
    return folder;
  }
  async _computeWorkspaceTasks(runSource = TaskRunSource.User) {
    const promises = [];
    for (const folder2 of this.workspaceFolders) {
      promises.push(this._computeWorkspaceFolderTasks(folder2, runSource));
    }
    const values = await Promise.all(promises);
    const result = /* @__PURE__ */ new Map();
    for (const value of values) {
      if (value) {
        result.set(value.workspaceFolder.uri.toString(), value);
      }
    }
    const folder = await this._getAFolder();
    if (this._contextService.getWorkbenchState() !== WorkbenchState.EMPTY) {
      const workspaceFileTasks = await this._computeWorkspaceFileTasks(folder, runSource);
      if (workspaceFileTasks && this._workspace && this._workspace.configuration) {
        result.set(this._workspace.configuration.toString(), workspaceFileTasks);
      }
    }
    const userTasks = await this._computeUserTasks(folder, runSource);
    if (userTasks) {
      result.set(USER_TASKS_GROUP_KEY, userTasks);
    }
    return result;
  }
  get _jsonTasksSupported() {
    return ShellExecutionSupportedContext.getValue(this._contextKeyService) === true && ProcessExecutionSupportedContext.getValue(this._contextKeyService) === true;
  }
  async _computeWorkspaceFolderTasks(workspaceFolder, runSource = TaskRunSource.User) {
    const workspaceFolderConfiguration = this._executionEngine === ExecutionEngine.Process ? await this._computeLegacyConfiguration(workspaceFolder) : await this._computeConfiguration(workspaceFolder);
    if (!workspaceFolderConfiguration || !workspaceFolderConfiguration.config || workspaceFolderConfiguration.hasErrors) {
      return Promise.resolve({ workspaceFolder, set: void 0, configurations: void 0, hasErrors: workspaceFolderConfiguration ? workspaceFolderConfiguration.hasErrors : false });
    }
    await ProblemMatcherRegistry.onReady();
    const taskSystemInfo = this._getTaskSystemInfo(workspaceFolder.uri.scheme);
    const problemReporter = new ProblemReporter(this._outputChannel);
    const parseResult = TaskConfig.parse(workspaceFolder, void 0, taskSystemInfo ? taskSystemInfo.platform : Platform.platform, workspaceFolderConfiguration.config, problemReporter, TaskConfig.TaskConfigSource.TasksJson, this._contextKeyService);
    let hasErrors = false;
    if (!parseResult.validationStatus.isOK() && parseResult.validationStatus.state !== ValidationState.Info) {
      hasErrors = true;
      this._showOutput(runSource);
    }
    if (problemReporter.status.isFatal()) {
      problemReporter.fatal(nls.localize("TaskSystem.configurationErrors", "Error: the provided task configuration has validation errors and can't not be used. Please correct the errors first."));
      return { workspaceFolder, set: void 0, configurations: void 0, hasErrors };
    }
    let customizedTasks;
    if (parseResult.configured && parseResult.configured.length > 0) {
      customizedTasks = {
        byIdentifier: /* @__PURE__ */ Object.create(null)
      };
      for (const task of parseResult.configured) {
        customizedTasks.byIdentifier[task.configures._key] = task;
      }
    }
    if (!this._jsonTasksSupported && parseResult.custom.length > 0) {
      console.warn("Custom workspace tasks are not supported.");
    }
    return { workspaceFolder, set: { tasks: this._jsonTasksSupported ? parseResult.custom : [] }, configurations: customizedTasks, hasErrors };
  }
  _testParseExternalConfig(config, location) {
    if (!config) {
      return { config: void 0, hasParseErrors: false };
    }
    const parseErrors = config.$parseErrors;
    if (parseErrors) {
      let isAffected = false;
      for (const parseError of parseErrors) {
        if (/tasks\.json$/.test(parseError)) {
          isAffected = true;
          break;
        }
      }
      if (isAffected) {
        this._log(nls.localize({ key: "TaskSystem.invalidTaskJsonOther", comment: ["Message notifies of an error in one of several places there is tasks related json, not necessarily in a file named tasks.json"] }, "Error: The content of the tasks json in {0} has syntax errors. Please correct them before executing a task.", location));
        this._showOutput();
        return { config, hasParseErrors: true };
      }
    }
    return { config, hasParseErrors: false };
  }
  _log(value, verbose) {
    if (!verbose || this._configurationService.getValue(TaskSettingId.VerboseLogging)) {
      this._outputChannel.append(value + "\n");
    }
  }
  async _computeWorkspaceFileTasks(workspaceFolder, runSource = TaskRunSource.User) {
    if (this._executionEngine === ExecutionEngine.Process) {
      return this._emptyWorkspaceTaskResults(workspaceFolder);
    }
    const workspaceFileConfig = this._getConfiguration(workspaceFolder, TaskSourceKind.WorkspaceFile);
    const configuration = this._testParseExternalConfig(workspaceFileConfig.config, nls.localize("TasksSystem.locationWorkspaceConfig", "workspace file"));
    const customizedTasks = {
      byIdentifier: /* @__PURE__ */ Object.create(null)
    };
    const custom = [];
    await this._computeTasksForSingleConfig(workspaceFolder, configuration.config, runSource, custom, customizedTasks.byIdentifier, TaskConfig.TaskConfigSource.WorkspaceFile);
    const engine = configuration.config ? TaskConfig.ExecutionEngine.from(configuration.config) : ExecutionEngine.Terminal;
    if (engine === ExecutionEngine.Process) {
      this._notificationService.warn(nls.localize("TaskSystem.versionWorkspaceFile", "Only tasks version 2.0.0 permitted in workspace configuration files."));
      return this._emptyWorkspaceTaskResults(workspaceFolder);
    }
    return { workspaceFolder, set: { tasks: custom }, configurations: customizedTasks, hasErrors: configuration.hasParseErrors };
  }
  async _computeUserTasks(workspaceFolder, runSource = TaskRunSource.User) {
    if (this._executionEngine === ExecutionEngine.Process) {
      return this._emptyWorkspaceTaskResults(workspaceFolder);
    }
    const userTasksConfig = this._getConfiguration(workspaceFolder, TaskSourceKind.User);
    const configuration = this._testParseExternalConfig(userTasksConfig.config, nls.localize("TasksSystem.locationUserConfig", "user settings"));
    const customizedTasks = {
      byIdentifier: /* @__PURE__ */ Object.create(null)
    };
    const custom = [];
    await this._computeTasksForSingleConfig(workspaceFolder, configuration.config, runSource, custom, customizedTasks.byIdentifier, TaskConfig.TaskConfigSource.User);
    const engine = configuration.config ? TaskConfig.ExecutionEngine.from(configuration.config) : ExecutionEngine.Terminal;
    if (engine === ExecutionEngine.Process) {
      this._notificationService.warn(nls.localize("TaskSystem.versionSettings", "Only tasks version 2.0.0 permitted in user settings."));
      return this._emptyWorkspaceTaskResults(workspaceFolder);
    }
    return { workspaceFolder, set: { tasks: custom }, configurations: customizedTasks, hasErrors: configuration.hasParseErrors };
  }
  _emptyWorkspaceTaskResults(workspaceFolder) {
    return { workspaceFolder, set: void 0, configurations: void 0, hasErrors: false };
  }
  async _computeTasksForSingleConfig(workspaceFolder, config, runSource, custom, customized, source, isRecentTask = false) {
    if (!config) {
      return false;
    } else if (!workspaceFolder) {
      this._logService.trace("TaskService.computeTasksForSingleConfig: no workspace folder for worskspace", this._workspace?.id);
      return false;
    }
    const taskSystemInfo = this._getTaskSystemInfo(workspaceFolder.uri.scheme);
    const problemReporter = new ProblemReporter(this._outputChannel);
    const parseResult = TaskConfig.parse(workspaceFolder, this._workspace, taskSystemInfo ? taskSystemInfo.platform : Platform.platform, config, problemReporter, source, this._contextKeyService, isRecentTask);
    let hasErrors = false;
    if (!parseResult.validationStatus.isOK() && parseResult.validationStatus.state !== ValidationState.Info) {
      this._showOutput(runSource);
      hasErrors = true;
    }
    if (problemReporter.status.isFatal()) {
      problemReporter.fatal(nls.localize("TaskSystem.configurationErrors", "Error: the provided task configuration has validation errors and can't not be used. Please correct the errors first."));
      return hasErrors;
    }
    if (parseResult.configured && parseResult.configured.length > 0) {
      for (const task of parseResult.configured) {
        customized[task.configures._key] = task;
      }
    }
    if (!this._jsonTasksSupported && parseResult.custom.length > 0) {
      console.warn("Custom workspace tasks are not supported.");
    } else {
      for (const task of parseResult.custom) {
        custom.push(task);
      }
    }
    return hasErrors;
  }
  _computeConfiguration(workspaceFolder) {
    const { config, hasParseErrors } = this._getConfiguration(workspaceFolder);
    return Promise.resolve({ workspaceFolder, config, hasErrors: hasParseErrors });
  }
  _computeWorkspaceFolderSetup() {
    const workspaceFolders = [];
    const ignoredWorkspaceFolders = [];
    let executionEngine = ExecutionEngine.Terminal;
    let schemaVersion = JsonSchemaVersion.V2_0_0;
    let workspace;
    if (this._contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
      const workspaceFolder = this._contextService.getWorkspace().folders[0];
      workspaceFolders.push(workspaceFolder);
      executionEngine = this._computeExecutionEngine(workspaceFolder);
      schemaVersion = this._computeJsonSchemaVersion(workspaceFolder);
    } else if (this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      workspace = this._contextService.getWorkspace();
      for (const workspaceFolder of this._contextService.getWorkspace().folders) {
        if (schemaVersion === this._computeJsonSchemaVersion(workspaceFolder)) {
          workspaceFolders.push(workspaceFolder);
        } else {
          ignoredWorkspaceFolders.push(workspaceFolder);
          this._log(nls.localize(
            "taskService.ignoringFolder",
            "Ignoring task configurations for workspace folder {0}. Multi folder workspace task support requires that all folders use task version 2.0.0",
            workspaceFolder.uri.fsPath
          ));
        }
      }
    }
    return [workspaceFolders, ignoredWorkspaceFolders, executionEngine, schemaVersion, workspace];
  }
  _computeExecutionEngine(workspaceFolder) {
    const { config } = this._getConfiguration(workspaceFolder);
    if (!config) {
      return ExecutionEngine._default;
    }
    return TaskConfig.ExecutionEngine.from(config);
  }
  _computeJsonSchemaVersion(workspaceFolder) {
    const { config } = this._getConfiguration(workspaceFolder);
    if (!config) {
      return JsonSchemaVersion.V2_0_0;
    }
    return TaskConfig.JsonSchemaVersion.from(config);
  }
  _getConfiguration(workspaceFolder, source) {
    let result;
    if (source !== TaskSourceKind.User && this._contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
      result = void 0;
    } else {
      const wholeConfig = this._configurationService.inspect("tasks", { resource: workspaceFolder.uri });
      switch (source) {
        case TaskSourceKind.User: {
          if (wholeConfig.userValue !== wholeConfig.workspaceFolderValue) {
            result = Objects.deepClone(wholeConfig.userValue);
          }
          break;
        }
        case TaskSourceKind.Workspace:
          result = Objects.deepClone(wholeConfig.workspaceFolderValue);
          break;
        case TaskSourceKind.WorkspaceFile: {
          if (this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE && wholeConfig.workspaceFolderValue !== wholeConfig.workspaceValue) {
            result = Objects.deepClone(wholeConfig.workspaceValue);
          }
          break;
        }
        default:
          result = Objects.deepClone(wholeConfig.workspaceFolderValue);
      }
    }
    if (!result) {
      return { config: void 0, hasParseErrors: false };
    }
    const parseErrors = result.$parseErrors;
    if (parseErrors) {
      let isAffected = false;
      for (const parseError of parseErrors) {
        if (/tasks\.json$/.test(parseError)) {
          isAffected = true;
          break;
        }
      }
      if (isAffected) {
        this._log(nls.localize("TaskSystem.invalidTaskJson", "Error: The content of the tasks.json file has syntax errors. Please correct them before executing a task."));
        this._showOutput();
        return { config: void 0, hasParseErrors: true };
      }
    }
    return { config: result, hasParseErrors: false };
  }
  inTerminal() {
    if (this._taskSystem) {
      return this._taskSystem instanceof TerminalTaskSystem;
    }
    return this._executionEngine === ExecutionEngine.Terminal;
  }
  configureAction() {
    const thisCapture = this;
    return new class extends Action {
      constructor() {
        super(ConfigureTaskAction.ID, ConfigureTaskAction.TEXT.value, void 0, true, () => {
          thisCapture._runConfigureTasks();
          return Promise.resolve(void 0);
        });
      }
    }();
  }
  _handleError(err) {
    let showOutput = true;
    if (err instanceof TaskError) {
      const buildError = err;
      const needsConfig = buildError.code === TaskErrors.NotConfigured || buildError.code === TaskErrors.NoBuildTask || buildError.code === TaskErrors.NoTestTask;
      const needsTerminate = buildError.code === TaskErrors.RunningTask;
      if (needsConfig || needsTerminate) {
        this._notificationService.prompt(buildError.severity, buildError.message, [{
          label: needsConfig ? ConfigureTaskAction.TEXT.value : nls.localize("TerminateAction.label", "Terminate Task"),
          run: () => {
            if (needsConfig) {
              this._runConfigureTasks();
            } else {
              this._runTerminateCommand();
            }
          }
        }]);
      } else {
        this._notificationService.notify({ severity: buildError.severity, message: buildError.message });
      }
    } else if (err instanceof Error) {
      const error = err;
      this._notificationService.error(error.message);
      showOutput = false;
    } else if (Types.isString(err)) {
      this._notificationService.error(err);
    } else {
      this._notificationService.error(nls.localize("TaskSystem.unknownError", "An error has occurred while running a task. See task log for details."));
    }
    if (showOutput) {
      this._showOutput();
    }
  }
  _showDetail() {
    return this._configurationService.getValue(QUICKOPEN_DETAIL_CONFIG);
  }
  async _createTaskQuickPickEntries(tasks, group = false, sort = false, selectedEntry, includeRecents = true) {
    let encounteredTasks = {};
    if (tasks === void 0 || tasks === null || tasks.length === 0) {
      return [];
    }
    const TaskQuickPickEntry = (task) => {
      const newEntry = { label: task._label, description: this.getTaskDescription(task), task, detail: this._showDetail() ? task.configurationProperties.detail : void 0 };
      if (encounteredTasks[task._id]) {
        if (encounteredTasks[task._id].length === 1) {
          encounteredTasks[task._id][0].label += " (1)";
        }
        newEntry.label = newEntry.label + " (" + (encounteredTasks[task._id].length + 1).toString() + ")";
      } else {
        encounteredTasks[task._id] = [];
      }
      encounteredTasks[task._id].push(newEntry);
      return newEntry;
    };
    function fillEntries(entries2, tasks2, groupLabel) {
      if (tasks2.length) {
        entries2.push({ type: "separator", label: groupLabel });
      }
      for (const task of tasks2) {
        const entry = TaskQuickPickEntry(task);
        entry.buttons = [{ iconClass: ThemeIcon.asClassName(configureTaskIcon), tooltip: nls.localize("configureTask", "Configure Task") }];
        if (selectedEntry && task === selectedEntry.task) {
          entries2.unshift(selectedEntry);
        } else {
          entries2.push(entry);
        }
      }
    }
    let entries;
    if (group) {
      entries = [];
      if (tasks.length === 1) {
        entries.push(TaskQuickPickEntry(tasks[0]));
      } else {
        const recentlyUsedTasks = await this.getSavedTasks("historical");
        const recent = [];
        const recentSet = /* @__PURE__ */ new Set();
        let configured = [];
        let detected = [];
        const taskMap = /* @__PURE__ */ Object.create(null);
        tasks.forEach((task) => {
          const key = task.getCommonTaskId();
          if (key) {
            taskMap[key] = task;
          }
        });
        recentlyUsedTasks.reverse().forEach((recentTask) => {
          const key = recentTask.getCommonTaskId();
          if (key) {
            recentSet.add(key);
            const task = taskMap[key];
            if (task) {
              recent.push(task);
            }
          }
        });
        for (const task of tasks) {
          const key = task.getCommonTaskId();
          if (!key || !recentSet.has(key)) {
            if (task._source.kind === TaskSourceKind.Workspace || task._source.kind === TaskSourceKind.User) {
              configured.push(task);
            } else {
              detected.push(task);
            }
          }
        }
        const sorter = this.createSorter();
        if (includeRecents) {
          fillEntries(entries, recent, nls.localize("recentlyUsed", "recently used tasks"));
        }
        configured = configured.sort((a, b) => sorter.compare(a, b));
        fillEntries(entries, configured, nls.localize("configured", "configured tasks"));
        detected = detected.sort((a, b) => sorter.compare(a, b));
        fillEntries(entries, detected, nls.localize("detected", "detected tasks"));
      }
    } else {
      if (sort) {
        const sorter = this.createSorter();
        tasks = tasks.sort((a, b) => sorter.compare(a, b));
      }
      entries = tasks.map((task) => TaskQuickPickEntry(task));
    }
    encounteredTasks = {};
    return entries;
  }
  async _showTwoLevelQuickPick(placeHolder, defaultEntry, type, name) {
    return this._instantiationService.createInstance(TaskQuickPick).show(placeHolder, defaultEntry, type, name);
  }
  async _showQuickPick(tasks, placeHolder, defaultEntry, group = false, sort = false, selectedEntry, additionalEntries, name) {
    const resolvedTasks = await tasks;
    const entries = await raceTimeout(this._createTaskQuickPickEntries(resolvedTasks, group, sort, selectedEntry), 200, () => void 0);
    if (!entries) {
      return void 0;
    }
    if (entries.length === 1 && this._configurationService.getValue(QUICKOPEN_SKIP_CONFIG)) {
      return entries[0];
    } else if (entries.length === 0 && defaultEntry) {
      entries.push(defaultEntry);
    } else if (entries.length > 1 && additionalEntries && additionalEntries.length > 0) {
      entries.push({ type: "separator", label: "" });
      entries.push(additionalEntries[0]);
    }
    return this._quickInputService.pick(
      entries,
      {
        value: name,
        placeHolder,
        matchOnDescription: true,
        onDidTriggerItemButton: (context) => {
          const task = context.item.task;
          this._quickInputService.cancel();
          if (ContributedTask.is(task)) {
            this.customize(task, void 0, true);
          } else if (CustomTask.is(task)) {
            this.openConfig(task);
          }
        }
      }
    );
  }
  _needsRecentTasksMigration() {
    return this.getRecentlyUsedTasksV1().size > 0 && this._getTasksFromStorage("historical").size === 0;
  }
  async _migrateRecentTasks(tasks) {
    if (!this._needsRecentTasksMigration()) {
      return;
    }
    const recentlyUsedTasks = this.getRecentlyUsedTasksV1();
    const taskMap = /* @__PURE__ */ Object.create(null);
    tasks.forEach((task) => {
      const key = task.getKey();
      if (key) {
        taskMap[key] = task;
      }
    });
    const reversed = [...recentlyUsedTasks.keys()].reverse();
    for (const key in reversed) {
      const task = taskMap[key];
      if (task) {
        await this._setRecentlyUsedTask(task);
      }
    }
    this._storageService.remove(AbstractTaskService.RecentlyUsedTasks_Key, StorageScope.WORKSPACE);
  }
  _showIgnoredFoldersMessage() {
    if (this.ignoredWorkspaceFolders.length === 0 || !this.showIgnoreMessage) {
      return Promise.resolve(void 0);
    }
    this._notificationService.prompt(
      Severity.Info,
      nls.localize("TaskService.ignoredFolder", "The following workspace folders are ignored since they use task version 0.1.0: {0}", this.ignoredWorkspaceFolders.map((f) => f.name).join(", ")),
      [{
        label: nls.localize("TaskService.notAgain", "Don't Show Again"),
        isSecondary: true,
        run: () => {
          this._storageService.store(AbstractTaskService.IgnoreTask010DonotShowAgain_key, true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
          this._showIgnoreMessage = false;
        }
      }]
    );
    return Promise.resolve(void 0);
  }
  async _trust() {
    if (ServerlessWebContext && !TaskExecutionSupportedContext) {
      return false;
    }
    await this._workspaceTrustManagementService.workspaceTrustInitialized;
    if (!this._workspaceTrustManagementService.isWorkspaceTrusted()) {
      return await this._workspaceTrustRequestService.requestWorkspaceTrust(
        {
          message: nls.localize("TaskService.requestTrust", "Listing and running tasks requires that some of the files in this workspace be executed as code.")
        }
      ) === true;
    }
    return true;
  }
  async _runTaskCommand(filter) {
    if (!this._tasksReconnected) {
      return;
    }
    if (!filter) {
      return this._doRunTaskCommand();
    }
    const type = typeof filter === "string" ? void 0 : filter.type;
    const taskName = typeof filter === "string" ? filter : filter.task;
    const grouped = await this._getGroupedTasks({ type });
    const identifier = this._getTaskIdentifier(filter);
    const tasks = grouped.all();
    const resolver = this._createResolver(grouped);
    const folderURIs = this._contextService.getWorkspace().folders.map((folder) => folder.uri);
    if (this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      folderURIs.push(this._contextService.getWorkspace().configuration);
    }
    folderURIs.push(USER_TASKS_GROUP_KEY);
    if (identifier) {
      for (const uri of folderURIs) {
        const task = await resolver.resolve(uri, identifier);
        if (task) {
          this.run(task);
          return;
        }
      }
    }
    const exactMatchTask = !taskName ? void 0 : tasks.find((t) => t.configurationProperties.identifier === taskName || t.getDefinition(true)?.configurationProperties?.identifier === taskName);
    if (!exactMatchTask) {
      return this._doRunTaskCommand(tasks, type, taskName);
    }
    for (const uri of folderURIs) {
      const task = await resolver.resolve(uri, taskName);
      if (task) {
        await this.run(task, { attachProblemMatcher: true }, TaskRunSource.User);
        return;
      }
    }
  }
  _tasksAndGroupedTasks(filter) {
    if (!this._versionAndEngineCompatible(filter)) {
      return { tasks: Promise.resolve([]), grouped: Promise.resolve(new TaskMap()) };
    }
    const grouped = this._getGroupedTasks(filter);
    const tasks = grouped.then((map) => {
      if (!filter || !filter.type) {
        return map.all();
      }
      const result = [];
      map.forEach((tasks2) => {
        for (const task of tasks2) {
          if (ContributedTask.is(task) && task.defines.type === filter.type) {
            result.push(task);
          } else if (CustomTask.is(task)) {
            if (task.type === filter.type) {
              result.push(task);
            } else {
              const customizes = task.customizes();
              if (customizes && customizes.type === filter.type) {
                result.push(task);
              }
            }
          }
        }
      });
      return result;
    });
    return { tasks, grouped };
  }
  _doRunTaskCommand(tasks, type, name) {
    const pickThen = (task) => {
      if (task === void 0) {
        return;
      }
      if (task === null) {
        this._runConfigureTasks();
      } else {
        this.run(task, { attachProblemMatcher: true }, TaskRunSource.User).then(void 0, (reason) => {
        });
      }
    };
    const placeholder = nls.localize("TaskService.pickRunTask", "Select the task to run");
    this._showIgnoredFoldersMessage().then(() => {
      if (this._configurationService.getValue(USE_SLOW_PICKER)) {
        let taskResult = void 0;
        if (!tasks) {
          taskResult = this._tasksAndGroupedTasks();
        }
        this._showQuickPick(
          tasks ? tasks : taskResult.tasks,
          placeholder,
          {
            label: "$(plus) " + nls.localize("TaskService.noEntryToRun", "Configure a Task"),
            task: null
          },
          true,
          void 0,
          void 0,
          void 0,
          name
        ).then((entry) => {
          return pickThen(entry ? entry.task : void 0);
        });
      } else {
        this._showTwoLevelQuickPick(
          placeholder,
          {
            label: "$(plus) " + nls.localize("TaskService.noEntryToRun", "Configure a Task"),
            task: null
          },
          type,
          name
        ).then(pickThen);
      }
    });
  }
  rerun(terminalInstanceId) {
    const task = this._taskSystem?.getTaskForTerminal(terminalInstanceId);
    if (task) {
      this._restart(task);
    } else {
      this._reRunTaskCommand(true);
    }
  }
  _reRunTaskCommand(onlyRerun) {
    ProblemMatcherRegistry.onReady().then(() => {
      return this._editorService.saveAll({ reason: SaveReason.AUTO }).then(() => {
        const executeResult = this._getTaskSystem().rerun();
        if (executeResult) {
          return this._handleExecuteResult(executeResult);
        } else {
          if (!onlyRerun && !this._taskRunningState.get()) {
            this._doRunTaskCommand();
          }
          return Promise.resolve(void 0);
        }
      });
    });
  }
  /**
   *
   * @param tasks - The tasks which need to be filtered
   * @param tasksInList - This tells splitPerGroupType to filter out globbed tasks (into defaults)
   * @returns
   */
  _getDefaultTasks(tasks, taskGlobsInList = false) {
    const defaults = [];
    for (const task of tasks.filter((t) => !!t.configurationProperties.group)) {
      if (taskGlobsInList && typeof task.configurationProperties.group.isDefault === "string") {
        defaults.push(task);
      } else if (!taskGlobsInList && task.configurationProperties.group.isDefault === true) {
        defaults.push(task);
      }
    }
    return defaults;
  }
  _runTaskGroupCommand(taskGroup, strings, configure, legacyCommand) {
    if (this.schemaVersion === JsonSchemaVersion.V0_1_0) {
      legacyCommand();
      return;
    }
    const options = {
      location: ProgressLocation.Window,
      title: strings.fetching
    };
    const promise = (async () => {
      async function runSingleTask(task, problemMatcherOptions, that) {
        that.run(task, problemMatcherOptions, TaskRunSource.User).then(void 0, (reason) => {
        });
      }
      const chooseAndRunTask = (tasks) => {
        this._showIgnoredFoldersMessage().then(() => {
          this._showQuickPick(
            tasks,
            strings.select,
            {
              label: strings.notFoundConfigure,
              task: null
            },
            true
          ).then((entry) => {
            const task = entry ? entry.task : void 0;
            if (task === void 0) {
              return;
            }
            if (task === null) {
              configure.apply(this);
              return;
            }
            runSingleTask(task, { attachProblemMatcher: true }, this);
          });
        });
      };
      let groupTasks = [];
      const { globGroupTasks, globTasksDetected } = await this._getGlobTasks(taskGroup._id);
      groupTasks = [...globGroupTasks];
      if (!globTasksDetected && groupTasks.length === 0) {
        groupTasks = await this._findWorkspaceTasksInGroup(taskGroup, true);
      }
      const handleMultipleTasks = (areGlobTasks) => {
        return this._getTasksForGroup(taskGroup).then((tasks) => {
          if (tasks.length > 0) {
            const defaults = this._getDefaultTasks(tasks, areGlobTasks);
            if (defaults.length === 1) {
              runSingleTask(defaults[0], void 0, this);
              return;
            } else if (defaults.length > 0) {
              tasks = defaults;
            }
          }
          chooseAndRunTask(tasks);
        });
      };
      const resolveTaskAndRun = (taskGroupTask) => {
        if (ConfiguringTask.is(taskGroupTask)) {
          this.tryResolveTask(taskGroupTask).then((resolvedTask) => {
            runSingleTask(resolvedTask, void 0, this);
          });
        } else {
          runSingleTask(taskGroupTask, void 0, this);
        }
      };
      if (groupTasks.length === 1) {
        return resolveTaskAndRun(groupTasks[0]);
      }
      if (globTasksDetected && groupTasks.length > 1) {
        return handleMultipleTasks(true);
      }
      if (!groupTasks.length) {
        groupTasks = await this._findWorkspaceTasksInGroup(taskGroup, true);
      }
      if (groupTasks.length === 1) {
        return resolveTaskAndRun(groupTasks[0]);
      }
      return handleMultipleTasks(false);
    })();
    this._progressService.withProgress(options, () => promise);
  }
  async _getGlobTasks(taskGroupId) {
    let globTasksDetected = false;
    const absoluteURI = EditorResourceAccessor.getOriginalUri(this._editorService.activeEditor);
    if (absoluteURI) {
      const workspaceFolder = this._contextService.getWorkspaceFolder(absoluteURI);
      if (workspaceFolder) {
        const configuredTasks = this._getConfiguration(workspaceFolder)?.config?.tasks;
        if (configuredTasks) {
          globTasksDetected = configuredTasks.filter((task) => task.group && typeof task.group !== "string" && typeof task.group.isDefault === "string").length > 0;
          if (globTasksDetected) {
            const relativePath = workspaceFolder?.uri ? resources.relativePath(workspaceFolder.uri, absoluteURI) ?? absoluteURI.path : absoluteURI.path;
            const globGroupTasks = await this._findWorkspaceTasks((task) => {
              const currentTaskGroup = task.configurationProperties.group;
              if (currentTaskGroup && typeof currentTaskGroup !== "string" && typeof currentTaskGroup.isDefault === "string") {
                return currentTaskGroup._id === taskGroupId && glob.match(currentTaskGroup.isDefault, relativePath);
              }
              globTasksDetected = false;
              return false;
            });
            return { globGroupTasks, globTasksDetected };
          }
        }
      }
    }
    return { globGroupTasks: [], globTasksDetected };
  }
  _runBuildCommand() {
    if (!this._tasksReconnected) {
      return;
    }
    return this._runTaskGroupCommand(TaskGroup.Build, {
      fetching: nls.localize("TaskService.fetchingBuildTasks", "Fetching build tasks..."),
      select: nls.localize("TaskService.pickBuildTask", "Select the build task to run"),
      notFoundConfigure: nls.localize("TaskService.noBuildTask", "No build task to run found. Configure Build Task...")
    }, this._runConfigureDefaultBuildTask, this._build);
  }
  _runTestCommand() {
    return this._runTaskGroupCommand(TaskGroup.Test, {
      fetching: nls.localize("TaskService.fetchingTestTasks", "Fetching test tasks..."),
      select: nls.localize("TaskService.pickTestTask", "Select the test task to run"),
      notFoundConfigure: nls.localize("TaskService.noTestTaskTerminal", "No test task to run found. Configure Tasks...")
    }, this._runConfigureDefaultTestTask, this._runTest);
  }
  _runTerminateCommand(arg) {
    if (arg === "terminateAll") {
      this._terminateAll();
      return;
    }
    const runQuickPick = (promise) => {
      this._showQuickPick(
        promise || this.getActiveTasks(),
        nls.localize("TaskService.taskToTerminate", "Select a task to terminate"),
        {
          label: nls.localize("TaskService.noTaskRunning", "No task is currently running"),
          task: void 0
        },
        false,
        true,
        void 0,
        [{
          label: nls.localize("TaskService.terminateAllRunningTasks", "All Running Tasks"),
          id: "terminateAll",
          task: void 0
        }]
      ).then((entry) => {
        if (entry && entry.id === "terminateAll") {
          this._terminateAll();
        }
        const task = entry ? entry.task : void 0;
        if (task === void 0 || task === null) {
          return;
        }
        this.terminate(task);
      });
    };
    if (this.inTerminal()) {
      const identifier = this._getTaskIdentifier(arg);
      let promise;
      if (identifier !== void 0) {
        promise = this.getActiveTasks();
        promise.then((tasks) => {
          for (const task of tasks) {
            if (task.matches(identifier)) {
              this.terminate(task);
              return;
            }
          }
          runQuickPick(promise);
        });
      } else {
        runQuickPick();
      }
    } else {
      this._isActive().then((active) => {
        if (active) {
          this._terminateAll().then((responses) => {
            const response = responses[0];
            if (response.success) {
              return;
            }
            if (response.code && response.code === TerminateResponseCode.ProcessNotFound) {
              this._notificationService.error(nls.localize("TerminateAction.noProcess", "The launched process doesn't exist anymore. If the task spawned background tasks exiting VS Code might result in orphaned processes."));
            } else {
              this._notificationService.error(nls.localize("TerminateAction.failed", "Failed to terminate running task"));
            }
          });
        }
      });
    }
  }
  async _runRestartTaskCommand(arg) {
    const activeTasks = await this.getActiveTasks();
    if (activeTasks.length === 1) {
      this._restart(activeTasks[0]);
      return;
    }
    if (this.inTerminal()) {
      const identifier = this._getTaskIdentifier(arg);
      if (identifier !== void 0) {
        for (const task of activeTasks) {
          if (task.matches(identifier)) {
            this._restart(task);
            return;
          }
        }
      }
      const entry = await this._showQuickPick(
        activeTasks,
        nls.localize("TaskService.taskToRestart", "Select the task to restart"),
        {
          label: nls.localize("TaskService.noTaskToRestart", "No task to restart"),
          task: null
        },
        false,
        true
      );
      if (entry && entry.task) {
        this._restart(entry.task);
      }
    } else {
      if (activeTasks.length > 0) {
        this._restart(activeTasks[0]);
      }
    }
  }
  _getTaskIdentifier(filter) {
    let result = void 0;
    if (Types.isString(filter)) {
      result = filter;
    } else if (filter && Types.isString(filter.type)) {
      result = TaskDefinition.createTaskIdentifier(filter, console);
    }
    return result;
  }
  _configHasTasks(taskConfig) {
    return !!taskConfig && !!taskConfig.tasks && taskConfig.tasks.length > 0;
  }
  _openTaskFile(resource, taskSource) {
    let configFileCreated = false;
    this._fileService.stat(resource).then((stat) => stat, () => void 0).then(async (stat) => {
      const fileExists = !!stat;
      const configValue = this._configurationService.inspect("tasks", { resource });
      let tasksExistInFile;
      let target;
      switch (taskSource) {
        case TaskSourceKind.User:
          tasksExistInFile = this._configHasTasks(configValue.userValue);
          target = ConfigurationTarget.USER;
          break;
        case TaskSourceKind.WorkspaceFile:
          tasksExistInFile = this._configHasTasks(configValue.workspaceValue);
          target = ConfigurationTarget.WORKSPACE;
          break;
        default:
          tasksExistInFile = this._configHasTasks(configValue.workspaceFolderValue);
          target = ConfigurationTarget.WORKSPACE_FOLDER;
      }
      let content;
      if (!tasksExistInFile) {
        const pickTemplateResult = await this._quickInputService.pick(getTaskTemplates(), { placeHolder: nls.localize("TaskService.template", "Select a Task Template") });
        if (!pickTemplateResult) {
          return Promise.resolve(void 0);
        }
        content = pickTemplateResult.content;
        const editorConfig = this._configurationService.getValue();
        if (editorConfig.editor.insertSpaces) {
          content = content.replace(/(\n)(\t+)/g, (_, s1, s2) => s1 + " ".repeat(s2.length * editorConfig.editor.tabSize));
        }
        configFileCreated = true;
      }
      if (!fileExists && content) {
        return this._textFileService.create([{ resource, value: content }]).then((result) => {
          return result[0].resource;
        });
      } else if (fileExists && (tasksExistInFile || content)) {
        const statResource = stat?.resource;
        if (content && statResource) {
          this._configurationService.updateValue("tasks", json.parse(content), { resource: statResource }, target);
        }
        return statResource;
      }
      return void 0;
    }).then((resource2) => {
      if (!resource2) {
        return;
      }
      this._editorService.openEditor({
        resource: resource2,
        options: {
          pinned: configFileCreated
          // pin only if config file is created #8727
        }
      });
    });
  }
  _isTaskEntry(value) {
    const candidate = value;
    return candidate && !!candidate.task;
  }
  _isSettingEntry(value) {
    const candidate = value;
    return candidate && !!candidate.settingType;
  }
  _configureTask(task) {
    if (ContributedTask.is(task)) {
      this.customize(task, void 0, true);
    } else if (CustomTask.is(task)) {
      this.openConfig(task);
    } else if (ConfiguringTask.is(task)) {
    }
  }
  _handleSelection(selection) {
    if (!selection) {
      return;
    }
    if (this._isTaskEntry(selection)) {
      this._configureTask(selection.task);
    } else if (this._isSettingEntry(selection)) {
      const taskQuickPick = this._instantiationService.createInstance(TaskQuickPick);
      taskQuickPick.handleSettingOption(selection.settingType);
    } else if (selection.folder && this._contextService.getWorkbenchState() !== WorkbenchState.EMPTY) {
      this._openTaskFile(selection.folder.toResource(".vscode/tasks.json"), TaskSourceKind.Workspace);
    } else {
      const resource = this._getResourceForKind(TaskSourceKind.User);
      if (resource) {
        this._openTaskFile(resource, TaskSourceKind.User);
      }
    }
  }
  getTaskDescription(task) {
    let description;
    if (task._source.kind === TaskSourceKind.User) {
      description = nls.localize("taskQuickPick.userSettings", "User");
    } else if (task._source.kind === TaskSourceKind.WorkspaceFile) {
      description = task.getWorkspaceFileName();
    } else if (this.needsFolderQualification()) {
      const workspaceFolder = task.getWorkspaceFolder();
      if (workspaceFolder) {
        description = workspaceFolder.name;
      }
    }
    return description;
  }
  async _runConfigureTasks() {
    if (!await this._trust()) {
      return;
    }
    let taskPromise;
    if (this.schemaVersion === JsonSchemaVersion.V2_0_0) {
      taskPromise = this._getGroupedTasks();
    } else {
      taskPromise = Promise.resolve(new TaskMap());
    }
    const stats = this._contextService.getWorkspace().folders.map((folder) => {
      return this._fileService.stat(folder.toResource(".vscode/tasks.json")).then((stat) => stat, () => void 0);
    });
    const createLabel = nls.localize("TaskService.createJsonFile", "Create tasks.json file from template");
    const openLabel = nls.localize("TaskService.openJsonFile", "Open tasks.json file");
    const tokenSource = new CancellationTokenSource();
    const cancellationToken = tokenSource.token;
    const entries = Promise.all(stats).then((stats2) => {
      return taskPromise.then((taskMap) => {
        const entries2 = [];
        let configuredCount = 0;
        let tasks = taskMap.all();
        if (tasks.length > 0) {
          tasks = tasks.sort((a, b) => a._label.localeCompare(b._label));
          for (const task of tasks) {
            const entry = { label: TaskQuickPick.getTaskLabelWithIcon(task), task, description: this.getTaskDescription(task), detail: this._showDetail() ? task.configurationProperties.detail : void 0 };
            TaskQuickPick.applyColorStyles(task, entry, this._themeService);
            entries2.push(entry);
            if (!ContributedTask.is(task)) {
              configuredCount++;
            }
          }
        }
        const needsCreateOrOpen = configuredCount === 0;
        if (needsCreateOrOpen || taskMap.get(USER_TASKS_GROUP_KEY).length === configuredCount) {
          const label = stats2[0] !== void 0 ? openLabel : createLabel;
          if (entries2.length) {
            entries2.push({ type: "separator" });
          }
          entries2.push({ label, folder: this._contextService.getWorkspace().folders[0] });
        }
        if (entries2.length === 1 && !needsCreateOrOpen) {
          tokenSource.cancel();
        }
        return entries2;
      });
    });
    const timeout = await Promise.race([new Promise((resolve) => {
      entries.then(() => resolve(false));
    }), new Promise((resolve) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        resolve(true);
      }, 200);
    })]);
    if (!timeout && (await entries).length === 1 && this._configurationService.getValue(QUICKOPEN_SKIP_CONFIG)) {
      const entry = (await entries)[0];
      if (entry.task) {
        this._handleSelection(entry);
        return;
      }
    }
    const entriesWithSettings = entries.then((resolvedEntries) => {
      resolvedEntries.push(...TaskQuickPick.allSettingEntries(this._configurationService));
      return resolvedEntries;
    });
    this._quickInputService.pick(
      entriesWithSettings,
      { placeHolder: nls.localize("TaskService.pickTask", "Select a task to configure") },
      cancellationToken
    ).then(async (selection) => {
      if (cancellationToken.isCancellationRequested) {
        const task = (await entries)[0];
        if (task.task) {
          selection = task;
        }
      }
      this._handleSelection(selection);
    });
  }
  _runConfigureDefaultBuildTask() {
    if (this.schemaVersion === JsonSchemaVersion.V2_0_0) {
      this.tasks().then((tasks) => {
        if (tasks.length === 0) {
          this._runConfigureTasks();
          return;
        }
        const entries = [];
        let selectedTask;
        let selectedEntry;
        this._showIgnoredFoldersMessage().then(async () => {
          const { globGroupTasks } = await this._getGlobTasks(TaskGroup.Build._id);
          let defaultTasks = globGroupTasks;
          if (!defaultTasks?.length) {
            defaultTasks = this._getDefaultTasks(tasks, false);
          }
          let defaultBuildTask;
          if (defaultTasks.length === 1) {
            const group = defaultTasks[0].configurationProperties.group;
            if (group) {
              if (typeof group === "string" && group === TaskGroup.Build._id) {
                defaultBuildTask = defaultTasks[0];
              } else {
                defaultBuildTask = defaultTasks[0];
              }
            }
          }
          for (const task of tasks) {
            if (task === defaultBuildTask) {
              const label = nls.localize("TaskService.defaultBuildTaskExists", "{0} is already marked as the default build task", TaskQuickPick.getTaskLabelWithIcon(task, task.getQualifiedLabel()));
              selectedTask = task;
              selectedEntry = { label, task, description: this.getTaskDescription(task), detail: this._showDetail() ? task.configurationProperties.detail : void 0 };
              TaskQuickPick.applyColorStyles(task, selectedEntry, this._themeService);
            } else {
              const entry = { label: TaskQuickPick.getTaskLabelWithIcon(task), task, description: this.getTaskDescription(task), detail: this._showDetail() ? task.configurationProperties.detail : void 0 };
              TaskQuickPick.applyColorStyles(task, entry, this._themeService);
              entries.push(entry);
            }
          }
          if (selectedEntry) {
            entries.unshift(selectedEntry);
          }
          const tokenSource = new CancellationTokenSource();
          const cancellationToken = tokenSource.token;
          this._quickInputService.pick(
            entries,
            { placeHolder: nls.localize("TaskService.pickTask", "Select a task to configure") },
            cancellationToken
          ).then(async (entry) => {
            if (cancellationToken.isCancellationRequested) {
              const task2 = (await entries)[0];
              if (task2.task) {
                entry = task2;
              }
            }
            const task = entry && "task" in entry ? entry.task : void 0;
            if (task === void 0 || task === null) {
              return;
            }
            if (task === selectedTask && CustomTask.is(task)) {
              this.openConfig(task);
            }
            if (!InMemoryTask.is(task)) {
              this.customize(task, { group: { kind: "build", isDefault: true } }, true).then(() => {
                if (selectedTask && task !== selectedTask && !InMemoryTask.is(selectedTask)) {
                  this.customize(selectedTask, { group: "build" }, false);
                }
              });
            }
          });
          this._quickInputService.pick(entries, {
            placeHolder: nls.localize("TaskService.pickDefaultBuildTask", "Select the task to be used as the default build task")
          }).then((entry) => {
            const task = entry && "task" in entry ? entry.task : void 0;
            if (task === void 0 || task === null) {
              return;
            }
            if (task === selectedTask && CustomTask.is(task)) {
              this.openConfig(task);
            }
            if (!InMemoryTask.is(task)) {
              this.customize(task, { group: { kind: "build", isDefault: true } }, true).then(() => {
                if (selectedTask && task !== selectedTask && !InMemoryTask.is(selectedTask)) {
                  this.customize(selectedTask, { group: "build" }, false);
                }
              });
            }
          });
        });
      });
    } else {
      this._runConfigureTasks();
    }
  }
  _runConfigureDefaultTestTask() {
    if (this.schemaVersion === JsonSchemaVersion.V2_0_0) {
      this.tasks().then((tasks) => {
        if (tasks.length === 0) {
          this._runConfigureTasks();
          return;
        }
        let selectedTask;
        let selectedEntry;
        for (const task of tasks) {
          const taskGroup = TaskGroup.from(task.configurationProperties.group);
          if (taskGroup && taskGroup.isDefault && taskGroup._id === TaskGroup.Test._id) {
            selectedTask = task;
            break;
          }
        }
        if (selectedTask) {
          selectedEntry = {
            label: nls.localize("TaskService.defaultTestTaskExists", "{0} is already marked as the default test task.", selectedTask.getQualifiedLabel()),
            task: selectedTask,
            detail: this._showDetail() ? selectedTask.configurationProperties.detail : void 0
          };
        }
        this._showIgnoredFoldersMessage().then(() => {
          this._showQuickPick(
            tasks,
            nls.localize("TaskService.pickDefaultTestTask", "Select the task to be used as the default test task"),
            void 0,
            true,
            false,
            selectedEntry
          ).then((entry) => {
            const task = entry ? entry.task : void 0;
            if (!task) {
              return;
            }
            if (task === selectedTask && CustomTask.is(task)) {
              this.openConfig(task);
            }
            if (!InMemoryTask.is(task)) {
              this.customize(task, { group: { kind: "test", isDefault: true } }, true).then(() => {
                if (selectedTask && task !== selectedTask && !InMemoryTask.is(selectedTask)) {
                  this.customize(selectedTask, { group: "test" }, false);
                }
              });
            }
          });
        });
      });
    } else {
      this._runConfigureTasks();
    }
  }
  async runShowTasks() {
    const activeTasksPromise = this.getActiveTasks();
    const activeTasks = await activeTasksPromise;
    let group;
    if (activeTasks.length === 1) {
      this._taskSystem.revealTask(activeTasks[0]);
    } else if (activeTasks.length && activeTasks.every((task) => {
      if (InMemoryTask.is(task)) {
        return false;
      }
      if (!group) {
        group = task.command.presentation?.group;
      }
      return task.command.presentation?.group && task.command.presentation.group === group;
    })) {
      this._taskSystem.revealTask(activeTasks[0]);
    } else {
      this._showQuickPick(
        activeTasksPromise,
        nls.localize("TaskService.pickShowTask", "Select the task to show its output"),
        {
          label: nls.localize("TaskService.noTaskIsRunning", "No task is running"),
          task: null
        },
        false,
        true
      ).then((entry) => {
        const task = entry ? entry.task : void 0;
        if (task === void 0 || task === null) {
          return;
        }
        this._taskSystem.revealTask(task);
      });
    }
  }
  async _createTasksDotOld(folder) {
    const tasksFile = folder.toResource(".vscode/tasks.json");
    if (await this._fileService.exists(tasksFile)) {
      const oldFile = tasksFile.with({ path: `${tasksFile.path}.old` });
      await this._fileService.copy(tasksFile, oldFile, true);
      return [oldFile, tasksFile];
    }
    return void 0;
  }
  _upgradeTask(task, suppressTaskName, globalConfig) {
    if (!CustomTask.is(task)) {
      return;
    }
    const configElement = {
      label: task._label
    };
    const oldTaskTypes = /* @__PURE__ */ new Set(["gulp", "jake", "grunt"]);
    if (Types.isString(task.command.name) && oldTaskTypes.has(task.command.name)) {
      configElement.type = task.command.name;
      configElement.task = task.command.args[0];
    } else {
      if (task.command.runtime === RuntimeType.Shell) {
        configElement.type = RuntimeType.toString(RuntimeType.Shell);
      }
      if (task.command.name && !suppressTaskName && !globalConfig.windows?.command && !globalConfig.osx?.command && !globalConfig.linux?.command) {
        configElement.command = task.command.name;
      } else if (suppressTaskName) {
        configElement.command = task._source.config.element.command;
      }
      if (task.command.args && (!Array.isArray(task.command.args) || task.command.args.length > 0)) {
        if (!globalConfig.windows?.args && !globalConfig.osx?.args && !globalConfig.linux?.args) {
          configElement.args = task.command.args;
        } else {
          configElement.args = task._source.config.element.args;
        }
      }
    }
    if (task.configurationProperties.presentation) {
      configElement.presentation = task.configurationProperties.presentation;
    }
    if (task.configurationProperties.isBackground) {
      configElement.isBackground = task.configurationProperties.isBackground;
    }
    if (task.configurationProperties.problemMatchers) {
      configElement.problemMatcher = task._source.config.element.problemMatcher;
    }
    if (task.configurationProperties.group) {
      configElement.group = task.configurationProperties.group;
    }
    task._source.config.element = configElement;
    const tempTask = new CustomTask(task._id, task._source, task._label, task.type, task.command, task.hasDefinedMatchers, task.runOptions, task.configurationProperties);
    const configTask = this._createCustomizableTask(tempTask);
    if (configTask) {
      return configTask;
    }
    return;
  }
  async _upgrade() {
    if (this.schemaVersion === JsonSchemaVersion.V2_0_0) {
      return;
    }
    if (!this._workspaceTrustManagementService.isWorkspaceTrusted()) {
      this._register(Event.once(this._workspaceTrustManagementService.onDidChangeTrust)((isTrusted) => {
        if (isTrusted) {
          this._upgrade();
        }
      }));
      return;
    }
    const tasks = await this._getGroupedTasks();
    const fileDiffs = [];
    for (const folder of this.workspaceFolders) {
      const diff = await this._createTasksDotOld(folder);
      if (diff) {
        fileDiffs.push(diff);
      }
      if (!diff) {
        continue;
      }
      const configTasks = [];
      const suppressTaskName = !!this._configurationService.getValue(TasksSchemaProperties.SuppressTaskName, { resource: folder.uri });
      const globalConfig = {
        windows: this._configurationService.getValue(TasksSchemaProperties.Windows, { resource: folder.uri }),
        osx: this._configurationService.getValue(TasksSchemaProperties.Osx, { resource: folder.uri }),
        linux: this._configurationService.getValue(TasksSchemaProperties.Linux, { resource: folder.uri })
      };
      tasks.get(folder).forEach((task) => {
        const configTask = this._upgradeTask(task, suppressTaskName, globalConfig);
        if (configTask) {
          configTasks.push(configTask);
        }
      });
      this._taskSystem = void 0;
      this._workspaceTasksPromise = void 0;
      await this._writeConfiguration(folder, "tasks.tasks", configTasks);
      await this._writeConfiguration(folder, "tasks.version", "2.0.0");
      if (this._configurationService.getValue(TasksSchemaProperties.ShowOutput, { resource: folder.uri })) {
        await this._configurationService.updateValue(TasksSchemaProperties.ShowOutput, void 0, { resource: folder.uri });
      }
      if (this._configurationService.getValue(TasksSchemaProperties.IsShellCommand, { resource: folder.uri })) {
        await this._configurationService.updateValue(TasksSchemaProperties.IsShellCommand, void 0, { resource: folder.uri });
      }
      if (this._configurationService.getValue(TasksSchemaProperties.SuppressTaskName, { resource: folder.uri })) {
        await this._configurationService.updateValue(TasksSchemaProperties.SuppressTaskName, void 0, { resource: folder.uri });
      }
    }
    this._updateSetup();
    this._notificationService.prompt(
      Severity.Warning,
      fileDiffs.length === 1 ? nls.localize("taskService.upgradeVersion", "The deprecated tasks version 0.1.0 has been removed. Your tasks have been upgraded to version 2.0.0. Open the diff to review the upgrade.") : nls.localize("taskService.upgradeVersionPlural", "The deprecated tasks version 0.1.0 has been removed. Your tasks have been upgraded to version 2.0.0. Open the diffs to review the upgrade."),
      [{
        label: fileDiffs.length === 1 ? nls.localize("taskService.openDiff", "Open diff") : nls.localize("taskService.openDiffs", "Open diffs"),
        run: async () => {
          for (const upgrade of fileDiffs) {
            await this._editorService.openEditor({
              original: { resource: upgrade[0] },
              modified: { resource: upgrade[1] }
            });
          }
        }
      }]
    );
  }
};
// private static autoDetectTelemetryName: string = 'taskServer.autoDetect';
AbstractTaskService.RecentlyUsedTasks_Key = "workbench.tasks.recentlyUsedTasks";
AbstractTaskService.RecentlyUsedTasks_KeyV2 = "workbench.tasks.recentlyUsedTasks2";
AbstractTaskService.PersistentTasks_Key = "workbench.tasks.persistentTasks";
AbstractTaskService.IgnoreTask010DonotShowAgain_key = "workbench.tasks.ignoreTask010Shown";
AbstractTaskService.OutputChannelId = "tasks";
AbstractTaskService.OutputChannelLabel = nls.localize("tasks", "Tasks");
AbstractTaskService._nextHandle = 0;
AbstractTaskService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IMarkerService),
  __decorateParam(2, IOutputService),
  __decorateParam(3, IPaneCompositePartService),
  __decorateParam(4, IViewsService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, ITextFileService),
  __decorateParam(11, IModelService),
  __decorateParam(12, IExtensionService),
  __decorateParam(13, IQuickInputService),
  __decorateParam(14, IConfigurationResolverService),
  __decorateParam(15, ITerminalService),
  __decorateParam(16, ITerminalGroupService),
  __decorateParam(17, IStorageService),
  __decorateParam(18, IProgressService),
  __decorateParam(19, IOpenerService),
  __decorateParam(20, IDialogService),
  __decorateParam(21, INotificationService),
  __decorateParam(22, IContextKeyService),
  __decorateParam(23, IWorkbenchEnvironmentService),
  __decorateParam(24, ITerminalProfileResolverService),
  __decorateParam(25, IPathService),
  __decorateParam(26, ITextModelService),
  __decorateParam(27, IPreferencesService),
  __decorateParam(28, IViewDescriptorService),
  __decorateParam(29, IWorkspaceTrustRequestService),
  __decorateParam(30, IWorkspaceTrustManagementService),
  __decorateParam(31, ILogService),
  __decorateParam(32, IThemeService),
  __decorateParam(33, ILifecycleService),
  __decorateParam(34, IRemoteAgentService),
  __decorateParam(35, IInstantiationService)
], AbstractTaskService);
export {
  AbstractTaskService,
  ConfigureTaskAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9icm93c2VyL2Fic3RyYWN0VGFza1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0ICogYXMganNvbiBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCBJUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IExSVUNhY2hlLCBUb3VjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgKiBhcyBPYmplY3RzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgVmFsaWRhdGlvblN0YXRlLCBWYWxpZGF0aW9uU3RhdHVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGFyc2Vycy5qcyc7XG5pbXBvcnQgKiBhcyBQbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hdGVSZXNwb25zZUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzZXMuanMnO1xuaW1wb3J0ICogYXMgcmVzb3VyY2VzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIFVVSUQgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnksIElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgSUZpbGVTdGF0V2l0aFBhcnRpYWxNZXRhZGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTWFya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzT3B0aW9ucywgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJTmFtZWRQcm9ibGVtTWF0Y2hlciwgUHJvYmxlbU1hdGNoZXJSZWdpc3RyeSB9IGZyb20gJy4uL2NvbW1vbi9wcm9ibGVtTWF0Y2hlci5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuXG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcblxuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuXG5pbXBvcnQgeyBJV29ya3NwYWNlLCBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIsIFdvcmtiZW5jaFN0YXRlLCBXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBNYXJrZXJzIH0gZnJvbSAnLi4vLi4vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcblxuaW1wb3J0IHsgSU91dHB1dENoYW5uZWwsIElPdXRwdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvb3V0cHV0L2NvbW1vbi9vdXRwdXQuanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuXG5pbXBvcnQgeyBJVGVybWluYWxHcm91cFNlcnZpY2UsIElUZXJtaW5hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuXG5pbXBvcnQgeyBDb25maWd1cmluZ1Rhc2ssIENvbnRyaWJ1dGVkVGFzaywgQ3VzdG9tVGFzaywgRXhlY3V0aW9uRW5naW5lLCBJbk1lbW9yeVRhc2ssIElUYXNrRXZlbnQsIElUYXNrSWRlbnRpZmllciwgSVRhc2tTZXQsIEpzb25TY2hlbWFWZXJzaW9uLCBLZXllZFRhc2tJZGVudGlmaWVyLCBSdW50aW1lVHlwZSwgVGFzaywgVEFTS19SVU5OSU5HX1NUQVRFLCBUYXNrRGVmaW5pdGlvbiwgVGFza0dyb3VwLCBUYXNrUnVuU291cmNlLCBUYXNrU2V0dGluZ0lkLCBUYXNrU29ydGVyLCBUYXNrU291cmNlS2luZCwgVGFza3NTY2hlbWFQcm9wZXJ0aWVzLCBVU0VSX1RBU0tTX0dST1VQX0tFWSwgVGFza0V2ZW50S2luZCB9IGZyb20gJy4uL2NvbW1vbi90YXNrcy5qcyc7XG5pbXBvcnQgeyBDdXN0b21FeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0LCBJQ3VzdG9taXphdGlvblByb3BlcnRpZXMsIElQcm9ibGVtTWF0Y2hlclJ1bk9wdGlvbnMsIElUYXNrRmlsdGVyLCBJVGFza1Byb3ZpZGVyLCBJVGFza1NlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXJUYXNrUmVzdWx0LCBQcm9jZXNzRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dCwgU2VydmVybGVzc1dlYkNvbnRleHQsIFNoZWxsRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dCwgVGFza0NvbW1hbmRzUmVnaXN0ZXJlZCwgVGFza0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHQgfSBmcm9tICcuLi9jb21tb24vdGFza1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRhc2tFeGVjdXRlUmVzdWx0LCBJVGFza1Jlc29sdmVyLCBJVGFza1N1bW1hcnksIElUYXNrU3lzdGVtLCBJVGFza1N5c3RlbUluZm8sIElUYXNrVGVybWluYXRlUmVzcG9uc2UsIFRhc2tFcnJvciwgVGFza0Vycm9ycywgVGFza0V4ZWN1dGVLaW5kIH0gZnJvbSAnLi4vY29tbW9uL3Rhc2tTeXN0ZW0uanMnO1xuaW1wb3J0IHsgZ2V0VGVtcGxhdGVzIGFzIGdldFRhc2tUZW1wbGF0ZXMgfSBmcm9tICcuLi9jb21tb24vdGFza1RlbXBsYXRlcy5qcyc7XG5cbmltcG9ydCAqIGFzIFRhc2tDb25maWcgZnJvbSAnLi4vY29tbW9uL3Rhc2tDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsVGFza1N5c3RlbSB9IGZyb20gJy4vdGVybWluYWxUYXNrU3lzdGVtLmpzJztcblxuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrUGlja1NlcGFyYXRvciwgUXVpY2tQaWNrSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcblxuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgVGFza0RlZmluaXRpb25SZWdpc3RyeSB9IGZyb20gJy4uL2NvbW1vbi90YXNrRGVmaW5pdGlvblJlZ2lzdHJ5LmpzJztcblxuaW1wb3J0IHsgcmFjZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgdG9Gb3JtYXR0ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uRm9ybWF0dGVyLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGV4dEVkaXRvclNlbGVjdGlvblJldmVhbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgVGVybWluYWxFeGl0UmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLCBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgVmlydHVhbFdvcmtzcGFjZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgRWRpdG9yUmVzb3VyY2VBY2Nlc3NvciwgU2F2ZVJlYXNvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBjb25maWd1cmVUYXNrSWNvbiwgaXNXb3Jrc3BhY2VGb2xkZXIsIElUYXNrUXVpY2tQaWNrRW50cnksIFFVSUNLT1BFTl9ERVRBSUxfQ09ORklHLCBRVUlDS09QRU5fU0tJUF9DT05GSUcsIFRhc2tRdWlja1BpY2sgfSBmcm9tICcuL3Rhc2tRdWlja1BpY2suanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIFNodXRkb3duUmVhc29uLCBTdGFydHVwS2luZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYW5lY29tcG9zaXRlL2Jyb3dzZXIvcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJlZmVyZW5jZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcblxuXG5jb25zdCBRVUlDS09QRU5fSElTVE9SWV9MSU1JVF9DT05GSUcgPSAndGFzay5xdWlja09wZW4uaGlzdG9yeSc7XG5jb25zdCBQUk9CTEVNX01BVENIRVJfTkVWRVJfQ09ORklHID0gJ3Rhc2sucHJvYmxlbU1hdGNoZXJzLm5ldmVyUHJvbXB0JztcbmNvbnN0IFVTRV9TTE9XX1BJQ0tFUiA9ICd0YXNrLnF1aWNrT3Blbi5zaG93QWxsJztcblxuZXhwb3J0IG5hbWVzcGFjZSBDb25maWd1cmVUYXNrQWN0aW9uIHtcblx0ZXhwb3J0IGNvbnN0IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24udGFza3MuY29uZmlndXJlVGFza1J1bm5lcic7XG5cdGV4cG9ydCBjb25zdCBURVhUID0gbmxzLmxvY2FsaXplMignQ29uZmlndXJlVGFza1J1bm5lckFjdGlvbi5sYWJlbCcsIFwiQ29uZmlndXJlIFRhc2tcIik7XG59XG5cbmV4cG9ydCB0eXBlIFRhc2tRdWlja1BpY2tFbnRyeVR5cGUgPSAoSVF1aWNrUGlja0l0ZW0gJiB7IHRhc2s6IFRhc2sgfSkgfCAoSVF1aWNrUGlja0l0ZW0gJiB7IGZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciB9KSB8IChJUXVpY2tQaWNrSXRlbSAmIHsgc2V0dGluZ1R5cGU6IHN0cmluZyB9KTtcblxuY2xhc3MgUHJvYmxlbVJlcG9ydGVyIGltcGxlbWVudHMgVGFza0NvbmZpZy5JUHJvYmxlbVJlcG9ydGVyIHtcblxuXHRwcml2YXRlIF92YWxpZGF0aW9uU3RhdHVzOiBWYWxpZGF0aW9uU3RhdHVzO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgX291dHB1dENoYW5uZWw6IElPdXRwdXRDaGFubmVsKSB7XG5cdFx0dGhpcy5fdmFsaWRhdGlvblN0YXR1cyA9IG5ldyBWYWxpZGF0aW9uU3RhdHVzKCk7XG5cdH1cblxuXHRwdWJsaWMgaW5mbyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl92YWxpZGF0aW9uU3RhdHVzLnN0YXRlID0gVmFsaWRhdGlvblN0YXRlLkluZm87XG5cdFx0dGhpcy5fb3V0cHV0Q2hhbm5lbC5hcHBlbmQobWVzc2FnZSArICdcXG4nKTtcblx0fVxuXG5cdHB1YmxpYyB3YXJuKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3ZhbGlkYXRpb25TdGF0dXMuc3RhdGUgPSBWYWxpZGF0aW9uU3RhdGUuV2FybmluZztcblx0XHR0aGlzLl9vdXRwdXRDaGFubmVsLmFwcGVuZChtZXNzYWdlICsgJ1xcbicpO1xuXHR9XG5cblx0cHVibGljIGVycm9yKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3ZhbGlkYXRpb25TdGF0dXMuc3RhdGUgPSBWYWxpZGF0aW9uU3RhdGUuRXJyb3I7XG5cdFx0dGhpcy5fb3V0cHV0Q2hhbm5lbC5hcHBlbmQobWVzc2FnZSArICdcXG4nKTtcblx0fVxuXG5cdHB1YmxpYyBmYXRhbChtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl92YWxpZGF0aW9uU3RhdHVzLnN0YXRlID0gVmFsaWRhdGlvblN0YXRlLkZhdGFsO1xuXHRcdHRoaXMuX291dHB1dENoYW5uZWwuYXBwZW5kKG1lc3NhZ2UgKyAnXFxuJyk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHN0YXR1cygpOiBWYWxpZGF0aW9uU3RhdHVzIHtcblx0XHRyZXR1cm4gdGhpcy5fdmFsaWRhdGlvblN0YXR1cztcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXb3Jrc3BhY2VGb2xkZXJDb25maWd1cmF0aW9uUmVzdWx0IHtcblx0d29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyO1xuXHRjb25maWc6IFRhc2tDb25maWcuSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQ7XG5cdGhhc0Vycm9yczogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIElDb21tYW5kVXBncmFkZSB7XG5cdGNvbW1hbmQ/OiBzdHJpbmc7XG5cdGFyZ3M/OiBzdHJpbmdbXTtcbn1cblxuY2xhc3MgVGFza01hcCB7XG5cdHByaXZhdGUgX3N0b3JlOiBNYXA8c3RyaW5nLCBUYXNrW10+ID0gbmV3IE1hcCgpO1xuXG5cdHB1YmxpYyBmb3JFYWNoKGNhbGxiYWNrOiAodmFsdWU6IFRhc2tbXSwgZm9sZGVyOiBzdHJpbmcpID0+IHZvaWQpOiB2b2lkIHtcblx0XHR0aGlzLl9zdG9yZS5mb3JFYWNoKGNhbGxiYWNrKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0S2V5KHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZSB8IElXb3Jrc3BhY2VGb2xkZXIgfCBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGxldCBrZXk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoVHlwZXMuaXNTdHJpbmcod29ya3NwYWNlRm9sZGVyKSkge1xuXHRcdFx0a2V5ID0gd29ya3NwYWNlRm9sZGVyO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB1cmk6IFVSSSB8IG51bGwgfCB1bmRlZmluZWQgPSBpc1dvcmtzcGFjZUZvbGRlcih3b3Jrc3BhY2VGb2xkZXIpID8gd29ya3NwYWNlRm9sZGVyLnVyaSA6IHdvcmtzcGFjZUZvbGRlci5jb25maWd1cmF0aW9uO1xuXHRcdFx0a2V5ID0gdXJpID8gdXJpLnRvU3RyaW5nKCkgOiAnJztcblx0XHR9XG5cdFx0cmV0dXJuIGtleTtcblx0fVxuXG5cdHB1YmxpYyBnZXQod29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlIHwgSVdvcmtzcGFjZUZvbGRlciB8IHN0cmluZyk6IFRhc2tbXSB7XG5cdFx0Y29uc3Qga2V5ID0gVGFza01hcC5nZXRLZXkod29ya3NwYWNlRm9sZGVyKTtcblx0XHRsZXQgcmVzdWx0OiBUYXNrW10gfCB1bmRlZmluZWQgPSB0aGlzLl9zdG9yZS5nZXQoa2V5KTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmVzdWx0ID0gW107XG5cdFx0XHR0aGlzLl9zdG9yZS5zZXQoa2V5LCByZXN1bHQpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGFkZCh3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2UgfCBJV29ya3NwYWNlRm9sZGVyIHwgc3RyaW5nLCAuLi50YXNrOiBUYXNrW10pOiB2b2lkIHtcblx0XHRjb25zdCBrZXkgPSBUYXNrTWFwLmdldEtleSh3b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdGxldCB2YWx1ZXMgPSB0aGlzLl9zdG9yZS5nZXQoa2V5KTtcblx0XHRpZiAoIXZhbHVlcykge1xuXHRcdFx0dmFsdWVzID0gW107XG5cdFx0XHR0aGlzLl9zdG9yZS5zZXQoa2V5LCB2YWx1ZXMpO1xuXHRcdH1cblx0XHR2YWx1ZXMucHVzaCguLi50YXNrKTtcblx0fVxuXG5cdHB1YmxpYyBhbGwoKTogVGFza1tdIHtcblx0XHRjb25zdCByZXN1bHQ6IFRhc2tbXSA9IFtdO1xuXHRcdHRoaXMuX3N0b3JlLmZvckVhY2goKHZhbHVlcykgPT4gcmVzdWx0LnB1c2goLi4udmFsdWVzKSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RUYXNrU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGFza1NlcnZpY2Uge1xuXG5cdC8vIHByaXZhdGUgc3RhdGljIGF1dG9EZXRlY3RUZWxlbWV0cnlOYW1lOiBzdHJpbmcgPSAndGFza1NlcnZlci5hdXRvRGV0ZWN0Jztcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUmVjZW50bHlVc2VkVGFza3NfS2V5ID0gJ3dvcmtiZW5jaC50YXNrcy5yZWNlbnRseVVzZWRUYXNrcyc7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFJlY2VudGx5VXNlZFRhc2tzX0tleVYyID0gJ3dvcmtiZW5jaC50YXNrcy5yZWNlbnRseVVzZWRUYXNrczInO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBQZXJzaXN0ZW50VGFza3NfS2V5ID0gJ3dvcmtiZW5jaC50YXNrcy5wZXJzaXN0ZW50VGFza3MnO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBJZ25vcmVUYXNrMDEwRG9ub3RTaG93QWdhaW5fa2V5ID0gJ3dvcmtiZW5jaC50YXNrcy5pZ25vcmVUYXNrMDEwU2hvd24nO1xuXG5cdHB1YmxpYyBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHB1YmxpYyBzdGF0aWMgT3V0cHV0Q2hhbm5lbElkOiBzdHJpbmcgPSAndGFza3MnO1xuXHRwdWJsaWMgc3RhdGljIE91dHB1dENoYW5uZWxMYWJlbDogc3RyaW5nID0gbmxzLmxvY2FsaXplKCd0YXNrcycsIFwiVGFza3NcIik7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX25leHRIYW5kbGU6IG51bWJlciA9IDA7XG5cblx0cHJpdmF0ZSBfdGFza3NSZWNvbm5lY3RlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9zY2hlbWFWZXJzaW9uOiBKc29uU2NoZW1hVmVyc2lvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZXhlY3V0aW9uRW5naW5lOiBFeGVjdXRpb25FbmdpbmUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3dvcmtzcGFjZUZvbGRlcnM6IElXb3Jrc3BhY2VGb2xkZXJbXSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfd29ya3NwYWNlOiBJV29ya3NwYWNlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9pZ25vcmVkV29ya3NwYWNlRm9sZGVyczogSVdvcmtzcGFjZUZvbGRlcltdIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9zaG93SWdub3JlTWVzc2FnZT86IGJvb2xlYW47XG5cdHByaXZhdGUgX3Byb3ZpZGVyczogTWFwPG51bWJlciwgSVRhc2tQcm92aWRlcj47XG5cdHByaXZhdGUgX3Byb3ZpZGVyVHlwZXM6IE1hcDxudW1iZXIsIHN0cmluZz47XG5cdHByb3RlY3RlZCBfdGFza1N5c3RlbUluZm9zOiBNYXA8c3RyaW5nLCBJVGFza1N5c3RlbUluZm9bXT47XG5cblx0cHJvdGVjdGVkIF93b3Jrc3BhY2VUYXNrc1Byb21pc2U/OiBQcm9taXNlPE1hcDxzdHJpbmcsIElXb3Jrc3BhY2VGb2xkZXJUYXNrUmVzdWx0Pj47XG5cdHByb3RlY3RlZCByZWFkb25seSBfd2hlblRhc2tTeXN0ZW1SZWFkeTogUHJvbWlzZTx2b2lkPjtcblxuXHRwcm90ZWN0ZWQgX3Rhc2tTeXN0ZW0/OiBJVGFza1N5c3RlbTtcblx0cHJvdGVjdGVkIF90YXNrU3lzdGVtTGlzdGVuZXJzPzogSURpc3Bvc2FibGVbXSA9IFtdO1xuXHRwcml2YXRlIF9yZWNlbnRseVVzZWRUYXNrc1YxOiBMUlVDYWNoZTxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3JlY2VudGx5VXNlZFRhc2tzOiBMUlVDYWNoZTxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfcGVyc2lzdGVudFRhc2tzOiBMUlVDYWNoZTxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIF90YXNrUnVubmluZ1N0YXRlOiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcm90ZWN0ZWQgX291dHB1dENoYW5uZWw6IElPdXRwdXRDaGFubmVsO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkU3RhdGVDaGFuZ2U6IEVtaXR0ZXI8SVRhc2tFdmVudD47XG5cdHByaXZhdGUgX3dhaXRGb3JBbGxTdXBwb3J0ZWRFeGVjdXRpb25zOiBQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIF9vbkRpZFJlZ2lzdGVyU3VwcG9ydGVkRXhlY3V0aW9uczogRW1pdHRlcjx2b2lkPiA9IG5ldyBFbWl0dGVyKCk7XG5cdHByaXZhdGUgX29uRGlkUmVnaXN0ZXJBbGxTdXBwb3J0ZWRFeGVjdXRpb25zOiBFbWl0dGVyPHZvaWQ+ID0gbmV3IEVtaXR0ZXIoKTtcblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VUYXNrU3lzdGVtSW5mbzogRW1pdHRlcjx2b2lkPiA9IG5ldyBFbWl0dGVyKCk7XG5cdHByaXZhdGUgX3dpbGxSZXN0YXJ0OiBib29sZWFuID0gZmFsc2U7XG5cdHB1YmxpYyBvbkRpZENoYW5nZVRhc2tTeXN0ZW1JbmZvOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlVGFza1N5c3RlbUluZm8uZXZlbnQ7XG5cdHByaXZhdGUgX29uRGlkUmVjb25uZWN0VG9UYXNrczogRW1pdHRlcjx2b2lkPiA9IG5ldyBFbWl0dGVyKCk7XG5cdHB1YmxpYyBvbkRpZFJlY29ubmVjdFRvVGFza3M6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRSZWNvbm5lY3RUb1Rhc2tzLmV2ZW50O1xuXHRwcml2YXRlIF9vbkRpZENoYW5nZVRhc2tDb25maWc6IEVtaXR0ZXI8dm9pZD4gPSBuZXcgRW1pdHRlcigpO1xuXHRwdWJsaWMgb25EaWRDaGFuZ2VUYXNrQ29uZmlnOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlVGFza0NvbmZpZy5ldmVudDtcblx0cHVibGljIGdldCBpc1JlY29ubmVjdGVkKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fdGFza3NSZWNvbm5lY3RlZDsgfVxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVRhc2tQcm92aWRlcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHVibGljIG9uRGlkQ2hhbmdlVGFza1Byb3ZpZGVycyA9IHRoaXMuX29uRGlkQ2hhbmdlVGFza1Byb3ZpZGVycy5ldmVudDtcblxuXHRwcml2YXRlIF9hY3RpdmF0ZWRUYXNrUHJvdmlkZXJzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsXG5cdFx0QElPdXRwdXRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfb3V0cHV0U2VydmljZTogSU91dHB1dFNlcnZpY2UsXG5cdFx0QElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcGFuZUNvbXBvc2l0ZVNlcnZpY2U6IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UsXG5cdFx0QElWaWV3c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdmlld3NTZXJ2aWNlOiBJVmlld3NTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2ZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2NvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3F1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZTogSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxTZXJ2aWNlOiBJVGVybWluYWxTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxHcm91cFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxHcm91cFNlcnZpY2U6IElUZXJtaW5hbEdyb3VwU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9kaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZTogSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3BhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RleHRNb2RlbFJlc29sdmVyU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElQcmVmZXJlbmNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcHJlZmVyZW5jZXNTZXJ2aWNlOiBJUHJlZmVyZW5jZXNTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZTogSVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl93aGVuVGFza1N5c3RlbVJlYWR5ID0gRXZlbnQudG9Qcm9taXNlKHRoaXMub25EaWRDaGFuZ2VUYXNrU3lzdGVtSW5mbyk7XG5cdFx0dGhpcy5fd29ya3NwYWNlVGFza3NQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Rhc2tTeXN0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fdGFza1N5c3RlbUxpc3RlbmVycyA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9vdXRwdXRDaGFubmVsID0gdGhpcy5fb3V0cHV0U2VydmljZS5nZXRDaGFubmVsKEFic3RyYWN0VGFza1NlcnZpY2UuT3V0cHV0Q2hhbm5lbElkKSE7XG5cdFx0dGhpcy5fcHJvdmlkZXJzID0gbmV3IE1hcDxudW1iZXIsIElUYXNrUHJvdmlkZXI+KCk7XG5cdFx0dGhpcy5fcHJvdmlkZXJUeXBlcyA9IG5ldyBNYXA8bnVtYmVyLCBzdHJpbmc+KCk7XG5cdFx0dGhpcy5fdGFza1N5c3RlbUluZm9zID0gbmV3IE1hcDxzdHJpbmcsIElUYXNrU3lzdGVtSW5mb1tdPigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycygoKSA9PiB7XG5cdFx0XHRjb25zdCBmb2xkZXJTZXR1cCA9IHRoaXMuX2NvbXB1dGVXb3Jrc3BhY2VGb2xkZXJTZXR1cCgpO1xuXHRcdFx0aWYgKHRoaXMuZXhlY3V0aW9uRW5naW5lICE9PSBmb2xkZXJTZXR1cFsyXSkge1xuXHRcdFx0XHR0aGlzLl9kaXNwb3NlVGFza1N5c3RlbUxpc3RlbmVycygpO1xuXHRcdFx0XHR0aGlzLl90YXNrU3lzdGVtID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fdXBkYXRlU2V0dXAoZm9sZGVyU2V0dXApO1xuXHRcdFx0cmV0dXJuIHRoaXMuX3VwZGF0ZVdvcmtzcGFjZVRhc2tzKFRhc2tSdW5Tb3VyY2UuRm9sZGVyT3Blbik7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihhc3luYyAoZSkgPT4ge1xuXHRcdFx0aWYgKCFlLmFmZmVjdHNDb25maWd1cmF0aW9uKCd0YXNrcycpIHx8ICghdGhpcy5fdGFza1N5c3RlbSAmJiAhdGhpcy5fd29ya3NwYWNlVGFza3NQcm9taXNlKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5fdGFza1N5c3RlbSB8fCB0aGlzLl90YXNrU3lzdGVtIGluc3RhbmNlb2YgVGVybWluYWxUYXNrU3lzdGVtKSB7XG5cdFx0XHRcdHRoaXMuX291dHB1dENoYW5uZWwuY2xlYXIoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGFza1NldHRpbmdJZC5SZWNvbm5lY3Rpb24pKSB7XG5cdFx0XHRcdGlmICghdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGFza1NldHRpbmdJZC5SZWNvbm5lY3Rpb24pKSB7XG5cdFx0XHRcdFx0dGhpcy5fcGVyc2lzdGVudFRhc2tzPy5jbGVhcigpO1xuXHRcdFx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnJlbW92ZShBYnN0cmFjdFRhc2tTZXJ2aWNlLlBlcnNpc3RlbnRUYXNrc19LZXksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3NldFRhc2tMUlVDYWNoZUxpbWl0KCk7XG5cdFx0XHRhd2FpdCB0aGlzLl91cGRhdGVXb3Jrc3BhY2VUYXNrcyhUYXNrUnVuU291cmNlLkNvbmZpZ3VyYXRpb25DaGFuZ2UpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VUYXNrQ29uZmlnLmZpcmUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fdGFza1J1bm5pbmdTdGF0ZSA9IFRBU0tfUlVOTklOR19TVEFURS5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9vbkRpZFN0YXRlQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXIoKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXJDb21tYW5kcygpLnRoZW4oKCkgPT4gVGFza0NvbW1hbmRzUmVnaXN0ZXJlZC5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpLnNldCh0cnVlKSk7XG5cdFx0U2VydmVybGVzc1dlYkNvbnRleHQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKS5zZXQoUGxhdGZvcm0uaXNXZWIgJiYgIXJlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCk/LnJlbW90ZUF1dGhvcml0eSk7XG5cdFx0dGhpcy5fY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZS5jb250cmlidXRlVmFyaWFibGUoJ2RlZmF1bHRCdWlsZFRhc2snLCBhc3luYyAoKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+ID0+IHtcblx0XHRcdC8vIGRlbGF5IHByb3ZpZGVyIGFjdGl2YXRpb24sIHdlIG1pZ2h0IGZpbmQgYSBzaW5nbGUgZGVmYXVsdCBidWlsZCB0YXNrIGluIHRoZSB0YXNrcy5qc29uIGZpbGVcblx0XHRcdGxldCB0YXNrcyA9IGF3YWl0IHRoaXMuX2dldFRhc2tzRm9yR3JvdXAoVGFza0dyb3VwLkJ1aWxkLCB0cnVlKTtcblx0XHRcdGlmICh0YXNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IGRlZmF1bHRzID0gdGhpcy5fZ2V0RGVmYXVsdFRhc2tzKHRhc2tzKTtcblx0XHRcdFx0aWYgKGRlZmF1bHRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdHJldHVybiBkZWZhdWx0c1swXS5fbGFiZWw7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIGFjdGl2YXRlIGFsbCBwcm92aWRlcnMsIHdlIGhhdmVuJ3QgZm91bmQgdGhlIGRlZmF1bHQgYnVpbGQgdGFzayBpbiB0aGUgdGFza3MuanNvbiBmaWxlXG5cdFx0XHR0YXNrcyA9IGF3YWl0IHRoaXMuX2dldFRhc2tzRm9yR3JvdXAoVGFza0dyb3VwLkJ1aWxkKTtcblx0XHRcdGNvbnN0IGRlZmF1bHRzID0gdGhpcy5fZ2V0RGVmYXVsdFRhc2tzKHRhc2tzKTtcblx0XHRcdGlmIChkZWZhdWx0cy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0cmV0dXJuIGRlZmF1bHRzWzBdLl9sYWJlbDtcblx0XHRcdH0gZWxzZSBpZiAoZGVmYXVsdHMubGVuZ3RoKSB7XG5cdFx0XHRcdHRhc2tzID0gZGVmYXVsdHM7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBlbnRyeTogSVRhc2tRdWlja1BpY2tFbnRyeSB8IG51bGwgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodGFza3MgJiYgdGFza3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRlbnRyeSA9IGF3YWl0IHRoaXMuX3Nob3dRdWlja1BpY2sodGFza3MsIG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2UucGlja0J1aWxkVGFza0ZvckxhYmVsJywgJ1NlbGVjdCB0aGUgYnVpbGQgdGFzayAodGhlcmUgaXMgbm8gZGVmYXVsdCBidWlsZCB0YXNrIGRlZmluZWQpJykpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0YXNrOiBUYXNrIHwgdW5kZWZpbmVkIHwgbnVsbCA9IGVudHJ5ID8gZW50cnkudGFzayA6IHVuZGVmaW5lZDtcblx0XHRcdGlmICghdGFzaykge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRhc2suX2xhYmVsO1xuXHRcdH0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2xpZmVjeWNsZVNlcnZpY2Uub25CZWZvcmVTaHV0ZG93bihlID0+IHtcblx0XHRcdHRoaXMuX3dpbGxSZXN0YXJ0ID0gZS5yZWFzb24gIT09IFNodXRkb3duUmVhc29uLlJFTE9BRDtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZFN0YXRlQ2hhbmdlKGUgPT4ge1xuXHRcdFx0dGhpcy5fbG9nKG5scy5sb2NhbGl6ZSgndGFza0V2ZW50JywgJ1Rhc2sgRXZlbnQga2luZDogezB9JywgZS5raW5kKSwgdHJ1ZSk7XG5cdFx0XHRpZiAoZS5raW5kID09PSBUYXNrRXZlbnRLaW5kLkNoYW5nZWQpIHtcblx0XHRcdFx0Ly8gbm8tb3Bcblx0XHRcdH0gZWxzZSBpZiAoKHRoaXMuX3dpbGxSZXN0YXJ0IHx8IChlLmtpbmQgPT09IFRhc2tFdmVudEtpbmQuVGVybWluYXRlZCAmJiBlLmV4aXRSZWFzb24gPT09IFRlcm1pbmFsRXhpdFJlYXNvbi5Vc2VyKSkgJiYgZS50YXNrSWQpIHtcblx0XHRcdFx0Y29uc3Qga2V5ID0gZS5fX3Rhc2suZ2V0S2V5KCk7XG5cdFx0XHRcdGlmIChrZXkpIHtcblx0XHRcdFx0XHR0aGlzLnJlbW92ZVBlcnNpc3RlbnRUYXNrKGtleSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoZS5raW5kID09PSBUYXNrRXZlbnRLaW5kLlN0YXJ0ICYmIGUuX190YXNrICYmIGUuX190YXNrLmdldFdvcmtzcGFjZUZvbGRlcigpKSB7XG5cdFx0XHRcdHRoaXMuX3NldFBlcnNpc3RlbnRUYXNrKGUuX190YXNrKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fd2FpdEZvckFsbFN1cHBvcnRlZEV4ZWN1dGlvbnMgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdEV2ZW50Lm9uY2UodGhpcy5fb25EaWRSZWdpc3RlckFsbFN1cHBvcnRlZEV4ZWN1dGlvbnMuZXZlbnQpKCgpID0+IHJlc29sdmUoKSk7XG5cdFx0fSk7XG5cdFx0aWYgKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5nZXRSZWNvbm5lY3RlZFRlcm1pbmFscygnVGFzaycpPy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX2F0dGVtcHRUYXNrUmVjb25uZWN0aW9uKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZS53aGVuQ29ubmVjdGVkLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fdGVybWluYWxTZXJ2aWNlLmdldFJlY29ubmVjdGVkVGVybWluYWxzKCdUYXNrJyk/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMuX2F0dGVtcHRUYXNrUmVjb25uZWN0aW9uKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fdGFza3NSZWNvbm5lY3RlZCA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRSZWNvbm5lY3RUb1Rhc2tzLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHRoaXMuX3VwZ3JhZGUoKTtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlclN1cHBvcnRlZEV4ZWN1dGlvbnMoY3VzdG9tPzogYm9vbGVhbiwgc2hlbGw/OiBib29sZWFuLCBwcm9jZXNzPzogYm9vbGVhbikge1xuXHRcdGlmIChjdXN0b20gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3QgY3VzdG9tQ29udGV4dCA9IEN1c3RvbUV4ZWN1dGlvblN1cHBvcnRlZENvbnRleHQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdGN1c3RvbUNvbnRleHQuc2V0KGN1c3RvbSk7XG5cdFx0fVxuXHRcdGNvbnN0IGlzVmlydHVhbCA9ICEhVmlydHVhbFdvcmtzcGFjZUNvbnRleHQuZ2V0VmFsdWUodGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGlmIChzaGVsbCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBzaGVsbENvbnRleHQgPSBTaGVsbEV4ZWN1dGlvblN1cHBvcnRlZENvbnRleHQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdHNoZWxsQ29udGV4dC5zZXQoc2hlbGwgJiYgIWlzVmlydHVhbCk7XG5cdFx0fVxuXHRcdGlmIChwcm9jZXNzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IHByb2Nlc3NDb250ZXh0ID0gUHJvY2Vzc0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdHByb2Nlc3NDb250ZXh0LnNldChwcm9jZXNzICYmICFpc1ZpcnR1YWwpO1xuXHRcdH1cblx0XHQvLyB1cGRhdGUgdGFza3Mgc28gYW4gaW5jb21wbGV0ZSBsaXN0IGlzbid0IHJldHVybmVkIHdoZW4gZ2V0V29ya3NwYWNlVGFza3MgaXMgY2FsbGVkXG5cdFx0dGhpcy5fd29ya3NwYWNlVGFza3NQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX29uRGlkUmVnaXN0ZXJTdXBwb3J0ZWRFeGVjdXRpb25zLmZpcmUoKTtcblx0XHRpZiAoUGxhdGZvcm0uaXNXZWIgfHwgKGN1c3RvbSAmJiBzaGVsbCAmJiBwcm9jZXNzKSkge1xuXHRcdFx0dGhpcy5fb25EaWRSZWdpc3RlckFsbFN1cHBvcnRlZEV4ZWN1dGlvbnMuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2F0dGVtcHRUYXNrUmVjb25uZWN0aW9uKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9saWZlY3ljbGVTZXJ2aWNlLnN0YXJ0dXBLaW5kICE9PSBTdGFydHVwS2luZC5SZWxvYWRlZFdpbmRvdykge1xuXHRcdFx0dGhpcy5fbG9nKG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2Uuc2tpcHBpbmdSZWNvbm5lY3Rpb24nLCAnU3RhcnR1cCBraW5kIG5vdCB3aW5kb3cgcmVsb2FkLCBzZXR0aW5nIGNvbm5lY3RlZCBhbmQgcmVtb3ZpbmcgcGVyc2lzdGVudCB0YXNrcycpLCB0cnVlKTtcblx0XHRcdHRoaXMuX3Rhc2tzUmVjb25uZWN0ZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2UucmVtb3ZlKEFic3RyYWN0VGFza1NlcnZpY2UuUGVyc2lzdGVudFRhc2tzX0tleSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGFza1NldHRpbmdJZC5SZWNvbm5lY3Rpb24pIHx8IHRoaXMuX3Rhc2tzUmVjb25uZWN0ZWQpIHtcblx0XHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLm5vdENvbm5lY3RpbmcnLCAnU2V0dGluZyB0YXNrcyBjb25uZWN0ZWQgY29uZmlndXJlZCB2YWx1ZSB7MH0sIHRhc2tzIHdlcmUgYWxyZWFkeSByZWNvbm5lY3RlZCB7MX0nLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUYXNrU2V0dGluZ0lkLlJlY29ubmVjdGlvbiksIHRoaXMuX3Rhc2tzUmVjb25uZWN0ZWQpLCB0cnVlKTtcblx0XHRcdHRoaXMuX3Rhc2tzUmVjb25uZWN0ZWQgPSB0cnVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5yZWNvbm5lY3RpbmcnLCAnUmVjb25uZWN0aW5nIHRvIHJ1bm5pbmcgdGFza3MuLi4nKSwgdHJ1ZSk7XG5cdFx0dGhpcy5nZXRXb3Jrc3BhY2VUYXNrcyhUYXNrUnVuU291cmNlLlJlY29ubmVjdCkudGhlbihhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLl90YXNrc1JlY29ubmVjdGVkID0gYXdhaXQgdGhpcy5fcmVjb25uZWN0VGFza3MoKTtcblx0XHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLnJlY29ubmVjdGVkJywgJ1JlY29ubmVjdGVkIHRvIHJ1bm5pbmcgdGFza3MuJyksIHRydWUpO1xuXHRcdFx0dGhpcy5fb25EaWRSZWNvbm5lY3RUb1Rhc2tzLmZpcmUoKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JlY29ubmVjdFRhc2tzKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHRhc2tzID0gYXdhaXQgdGhpcy5nZXRTYXZlZFRhc2tzKCdwZXJzaXN0ZW50Jyk7XG5cdFx0aWYgKCF0YXNrcy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLm5vVGFza3MnLCAnTm8gcGVyc2lzdGVudCB0YXNrcyB0byByZWNvbm5lY3QuJyksIHRydWUpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGNvbnN0IHRhc2tMYWJlbHMgPSB0YXNrcy5tYXAodGFzayA9PiB0YXNrLl9sYWJlbCkuam9pbignLCAnKTtcblx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5yZWNvbm5lY3RpbmdUYXNrcycsICdSZWNvbm5lY3RpbmcgdG8gezB9IHRhc2tzLi4uJywgdGFza0xhYmVscyksIHRydWUpO1xuXHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0aWYgKENvbmZpZ3VyaW5nVGFzay5pcyh0YXNrKSkge1xuXHRcdFx0XHRjb25zdCByZXNvbHZlZCA9IGF3YWl0IHRoaXMudHJ5UmVzb2x2ZVRhc2sodGFzayk7XG5cdFx0XHRcdGlmIChyZXNvbHZlZCkge1xuXHRcdFx0XHRcdHRoaXMucnVuKHJlc29sdmVkLCB1bmRlZmluZWQsIFRhc2tSdW5Tb3VyY2UuUmVjb25uZWN0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5ydW4odGFzaywgdW5kZWZpbmVkLCBUYXNrUnVuU291cmNlLlJlY29ubmVjdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIGdldCBvbkRpZFN0YXRlQ2hhbmdlKCk6IEV2ZW50PElUYXNrRXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRTdGF0ZUNoYW5nZS5ldmVudDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgc3VwcG9ydHNNdWx0aXBsZVRhc2tFeGVjdXRpb25zKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmluVGVybWluYWwoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JlZ2lzdGVyQ29tbWFuZHMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnJ1blRhc2snLFxuXHRcdFx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yLCBhcmcpID0+IHtcblx0XHRcdFx0aWYgKGF3YWl0IHRoaXMuX3RydXN0KCkpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9ydW5UYXNrQ29tbWFuZChhcmcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246ICdSdW4gVGFzaycsXG5cdFx0XHRcdGFyZ3M6IFt7XG5cdFx0XHRcdFx0bmFtZTogJ2FyZ3MnLFxuXHRcdFx0XHRcdGlzT3B0aW9uYWw6IHRydWUsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncnVuVGFzay5hcmcnLCBcIkZpbHRlcnMgdGhlIHRhc2tzIHNob3duIGluIHRoZSBxdWlja3BpY2tcIiksXG5cdFx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncnVuVGFzay5sYWJlbCcsIFwiVGhlIHRhc2sncyBsYWJlbCBvciBhIHRlcm0gdG8gZmlsdGVyIGJ5XCIpXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdydW5UYXNrLnR5cGUnLCBcIlRoZSBjb250cmlidXRlZCB0YXNrIHR5cGVcIilcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR0YXNrOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdydW5UYXNrLnRhc2snLCBcIlRoZSB0YXNrJ3MgbGFiZWwgb3IgYSB0ZXJtIHRvIGZpbHRlciBieVwiKVxuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnJlUnVuVGFzaycsIGFzeW5jIChhY2Nlc3NvciwgYXJnKSA9PiB7XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5fdHJ1c3QoKSkge1xuXHRcdFx0XHR0aGlzLl9yZVJ1blRhc2tDb21tYW5kKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5yZXN0YXJ0VGFzaycsIGFzeW5jIChhY2Nlc3NvciwgYXJnKSA9PiB7XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5fdHJ1c3QoKSkge1xuXHRcdFx0XHR0aGlzLl9ydW5SZXN0YXJ0VGFza0NvbW1hbmQoYXJnKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnRlcm1pbmF0ZScsIGFzeW5jIChhY2Nlc3NvciwgYXJnKSA9PiB7XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5fdHJ1c3QoKSkge1xuXHRcdFx0XHR0aGlzLl9ydW5UZXJtaW5hdGVDb21tYW5kKGFyZyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3dvcmtiZW5jaC5hY3Rpb24udGFza3Muc2hvd0xvZycsICgpID0+IHtcblx0XHRcdHRoaXMuX3Nob3dPdXRwdXQodW5kZWZpbmVkLCB0cnVlKTtcblx0XHR9KTtcblxuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLmJ1aWxkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKGF3YWl0IHRoaXMuX3RydXN0KCkpIHtcblx0XHRcdFx0dGhpcy5fcnVuQnVpbGRDb21tYW5kKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi50YXNrcy50ZXN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKGF3YWl0IHRoaXMuX3RydXN0KCkpIHtcblx0XHRcdFx0dGhpcy5fcnVuVGVzdENvbW1hbmQoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLmNvbmZpZ3VyZVRhc2tSdW5uZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5fdHJ1c3QoKSkge1xuXHRcdFx0XHR0aGlzLl9ydW5Db25maWd1cmVUYXNrcygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3dvcmtiZW5jaC5hY3Rpb24udGFza3MuY29uZmlndXJlRGVmYXVsdEJ1aWxkVGFzaycsIGFzeW5jICgpID0+IHtcblx0XHRcdGlmIChhd2FpdCB0aGlzLl90cnVzdCgpKSB7XG5cdFx0XHRcdHRoaXMuX3J1bkNvbmZpZ3VyZURlZmF1bHRCdWlsZFRhc2soKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLmNvbmZpZ3VyZURlZmF1bHRUZXN0VGFzaycsIGFzeW5jICgpID0+IHtcblx0XHRcdGlmIChhd2FpdCB0aGlzLl90cnVzdCgpKSB7XG5cdFx0XHRcdHRoaXMuX3J1bkNvbmZpZ3VyZURlZmF1bHRUZXN0VGFzaygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3dvcmtiZW5jaC5hY3Rpb24udGFza3Muc2hvd1Rhc2tzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKGF3YWl0IHRoaXMuX3RydXN0KCkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucnVuU2hvd1Rhc2tzKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi50YXNrcy50b2dnbGVQcm9ibGVtcycsICgpID0+IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKE1hcmtlcnMuVE9HR0xFX01BUktFUlNfVklFV19BQ1RJT05fSUQpKTtcblxuXHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLm9wZW5Vc2VyVGFza3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMuX2dldFJlc291cmNlRm9yS2luZChUYXNrU291cmNlS2luZC5Vc2VyKTtcblx0XHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0XHR0aGlzLl9vcGVuVGFza0ZpbGUocmVzb3VyY2UsIFRhc2tTb3VyY2VLaW5kLlVzZXIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ3dvcmtiZW5jaC5hY3Rpb24udGFza3Mub3BlbldvcmtzcGFjZUZpbGVUYXNrcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc291cmNlID0gdGhpcy5fZ2V0UmVzb3VyY2VGb3JLaW5kKFRhc2tTb3VyY2VLaW5kLldvcmtzcGFjZUZpbGUpO1xuXHRcdFx0aWYgKHJlc291cmNlKSB7XG5cdFx0XHRcdHRoaXMuX29wZW5UYXNrRmlsZShyZXNvdXJjZSwgVGFza1NvdXJjZUtpbmQuV29ya3NwYWNlRmlsZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldCB3b3Jrc3BhY2VGb2xkZXJzKCk6IElXb3Jrc3BhY2VGb2xkZXJbXSB7XG5cdFx0aWYgKCF0aGlzLl93b3Jrc3BhY2VGb2xkZXJzKSB7XG5cdFx0XHR0aGlzLl91cGRhdGVTZXR1cCgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fd29ya3NwYWNlRm9sZGVycyE7XG5cdH1cblxuXHRwcml2YXRlIGdldCBpZ25vcmVkV29ya3NwYWNlRm9sZGVycygpOiBJV29ya3NwYWNlRm9sZGVyW10ge1xuXHRcdGlmICghdGhpcy5faWdub3JlZFdvcmtzcGFjZUZvbGRlcnMpIHtcblx0XHRcdHRoaXMuX3VwZGF0ZVNldHVwKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9pZ25vcmVkV29ya3NwYWNlRm9sZGVycyE7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IGV4ZWN1dGlvbkVuZ2luZSgpOiBFeGVjdXRpb25FbmdpbmUge1xuXHRcdGlmICh0aGlzLl9leGVjdXRpb25FbmdpbmUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fdXBkYXRlU2V0dXAoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2V4ZWN1dGlvbkVuZ2luZSE7XG5cdH1cblxuXHRwcml2YXRlIGdldCBzY2hlbWFWZXJzaW9uKCk6IEpzb25TY2hlbWFWZXJzaW9uIHtcblx0XHRpZiAodGhpcy5fc2NoZW1hVmVyc2lvbiA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl91cGRhdGVTZXR1cCgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fc2NoZW1hVmVyc2lvbiE7XG5cdH1cblxuXHRwcml2YXRlIGdldCBzaG93SWdub3JlTWVzc2FnZSgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fc2hvd0lnbm9yZU1lc3NhZ2UgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fc2hvd0lnbm9yZU1lc3NhZ2UgPSAhdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbihBYnN0cmFjdFRhc2tTZXJ2aWNlLklnbm9yZVRhc2swMTBEb25vdFNob3dBZ2Fpbl9rZXksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIGZhbHNlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Nob3dJZ25vcmVNZXNzYWdlO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0QWN0aXZhdGlvbkV2ZW50cyh0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdHJlc3VsdC5wdXNoKCdvbkNvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi50YXNrcy5ydW5UYXNrJyk7XG5cdFx0aWYgKHR5cGUpIHtcblx0XHRcdC8vIHNlbmQgYSBzcGVjaWZpYyBhY3RpdmF0aW9uIGV2ZW50IGZvciB0aGlzIHRhc2sgdHlwZVxuXHRcdFx0cmVzdWx0LnB1c2goYG9uVGFza1R5cGU6JHt0eXBlfWApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBzZW5kIGFjdGl2YXRpb24gZXZlbnRzIGZvciBhbGwgdGFzayB0eXBlc1xuXHRcdFx0Zm9yIChjb25zdCBkZWZpbml0aW9uIG9mIFRhc2tEZWZpbml0aW9uUmVnaXN0cnkuYWxsKCkpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goYG9uVGFza1R5cGU6JHtkZWZpbml0aW9uLnRhc2tUeXBlfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfYWN0aXZhdGVUYXNrUHJvdmlkZXJzKHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIFdlIG5lZWQgdG8gZmlyc3Qgd2FpdCBmb3IgZXh0ZW5zaW9ucyB0byBiZSByZWdpc3RlcmVkIGJlY2F1c2Ugd2UgbWlnaHQgcmVhZFxuXHRcdC8vIHRoZSBgVGFza0RlZmluaXRpb25SZWdpc3RyeWAgaW4gY2FzZSBgdHlwZWAgaXMgYHVuZGVmaW5lZGBcblx0XHRhd2FpdCB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXHRcdGNvbnN0IGhhc0xvZ2dlZEFjdGl2YXRpb24gPSB0aGlzLl9hY3RpdmF0ZWRUYXNrUHJvdmlkZXJzLmhhcyh0eXBlID8/ICdhbGwnKTtcblx0XHRpZiAoIWhhc0xvZ2dlZEFjdGl2YXRpb24pIHtcblx0XHRcdHRoaXMuX2xvZygnQWN0aXZhdGluZyB0YXNrIHByb3ZpZGVycyAnICsgKHR5cGUgPz8gJ2FsbCcpKTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcmFjZVRpbWVvdXQoXG5cdFx0XHRQcm9taXNlLmFsbCh0aGlzLl9nZXRBY3RpdmF0aW9uRXZlbnRzKHR5cGUpLm1hcChhY3RpdmF0aW9uRXZlbnQgPT4gdGhpcy5fZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoYWN0aXZhdGlvbkV2ZW50KSkpLFxuXHRcdFx0NTAwMCxcblx0XHRcdCgpID0+IGNvbnNvbGUud2FybignVGltZWQgb3V0IGFjdGl2YXRpbmcgZXh0ZW5zaW9ucyBmb3IgdGFzayBwcm92aWRlcnMnKVxuXHRcdCk7XG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0dGhpcy5fYWN0aXZhdGVkVGFza1Byb3ZpZGVycy5hZGQodHlwZSA/PyAnYWxsJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlU2V0dXAoc2V0dXA/OiBbSVdvcmtzcGFjZUZvbGRlcltdLCBJV29ya3NwYWNlRm9sZGVyW10sIEV4ZWN1dGlvbkVuZ2luZSwgSnNvblNjaGVtYVZlcnNpb24sIElXb3Jrc3BhY2UgfCB1bmRlZmluZWRdKTogdm9pZCB7XG5cdFx0aWYgKCFzZXR1cCkge1xuXHRcdFx0c2V0dXAgPSB0aGlzLl9jb21wdXRlV29ya3NwYWNlRm9sZGVyU2V0dXAoKTtcblx0XHR9XG5cdFx0dGhpcy5fd29ya3NwYWNlRm9sZGVycyA9IHNldHVwWzBdO1xuXHRcdGlmICh0aGlzLl9pZ25vcmVkV29ya3NwYWNlRm9sZGVycykge1xuXHRcdFx0aWYgKHRoaXMuX2lnbm9yZWRXb3Jrc3BhY2VGb2xkZXJzLmxlbmd0aCAhPT0gc2V0dXBbMV0ubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuX3Nob3dJZ25vcmVNZXNzYWdlID0gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3Qgc2V0OiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblx0XHRcdFx0dGhpcy5faWdub3JlZFdvcmtzcGFjZUZvbGRlcnMuZm9yRWFjaChmb2xkZXIgPT4gc2V0LmFkZChmb2xkZXIudXJpLnRvU3RyaW5nKCkpKTtcblx0XHRcdFx0Zm9yIChjb25zdCBmb2xkZXIgb2Ygc2V0dXBbMV0pIHtcblx0XHRcdFx0XHRpZiAoIXNldC5oYXMoZm9sZGVyLnVyaS50b1N0cmluZygpKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fc2hvd0lnbm9yZU1lc3NhZ2UgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5faWdub3JlZFdvcmtzcGFjZUZvbGRlcnMgPSBzZXR1cFsxXTtcblx0XHR0aGlzLl9leGVjdXRpb25FbmdpbmUgPSBzZXR1cFsyXTtcblx0XHR0aGlzLl9zY2hlbWFWZXJzaW9uID0gc2V0dXBbM107XG5cdFx0dGhpcy5fd29ya3NwYWNlID0gc2V0dXBbNF07XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3Nob3dPdXRwdXQocnVuU291cmNlOiBUYXNrUnVuU291cmNlID0gVGFza1J1blNvdXJjZS5Vc2VyLCB1c2VyUmVxdWVzdGVkPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghVmlydHVhbFdvcmtzcGFjZUNvbnRleHQuZ2V0VmFsdWUodGhpcy5fY29udGV4dEtleVNlcnZpY2UpICYmICgocnVuU291cmNlID09PSBUYXNrUnVuU291cmNlLlVzZXIpIHx8IChydW5Tb3VyY2UgPT09IFRhc2tSdW5Tb3VyY2UuQ29uZmlndXJhdGlvbkNoYW5nZSkpKSB7XG5cdFx0XHRpZiAodXNlclJlcXVlc3RlZCkge1xuXHRcdFx0XHR0aGlzLl9vdXRwdXRTZXJ2aWNlLnNob3dDaGFubmVsKHRoaXMuX291dHB1dENoYW5uZWwuaWQsIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoU2V2ZXJpdHkuV2FybmluZywgbmxzLmxvY2FsaXplKCd0YXNrU2VydmljZU91dHB1dFByb21wdCcsICdUaGVyZSBhcmUgdGFzayBlcnJvcnMuIFNlZSB0aGUgb3V0cHV0IGZvciBkZXRhaWxzLicpLFxuXHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdzaG93T3V0cHV0JywgXCJTaG93IG91dHB1dFwiKSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9vdXRwdXRTZXJ2aWNlLnNob3dDaGFubmVsKHRoaXMuX291dHB1dENoYW5uZWwuaWQsIHRydWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1dKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2Rpc3Bvc2VUYXNrU3lzdGVtTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl90YXNrU3lzdGVtTGlzdGVuZXJzKSB7XG5cdFx0XHRkaXNwb3NlKHRoaXMuX3Rhc2tTeXN0ZW1MaXN0ZW5lcnMpO1xuXHRcdFx0dGhpcy5fdGFza1N5c3RlbUxpc3RlbmVycyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJUYXNrUHJvdmlkZXIocHJvdmlkZXI6IElUYXNrUHJvdmlkZXIsIHR5cGU6IHN0cmluZyk6IElEaXNwb3NhYmxlIHtcblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHRcdH07XG5cdFx0fVxuXHRcdGNvbnN0IGhhbmRsZSA9IEFic3RyYWN0VGFza1NlcnZpY2UuX25leHRIYW5kbGUrKztcblx0XHR0aGlzLl9wcm92aWRlcnMuc2V0KGhhbmRsZSwgcHJvdmlkZXIpO1xuXHRcdHRoaXMuX3Byb3ZpZGVyVHlwZXMuc2V0KGhhbmRsZSwgdHlwZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VUYXNrUHJvdmlkZXJzLmZpcmUoKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9wcm92aWRlcnMuZGVsZXRlKGhhbmRsZSk7XG5cdFx0XHRcdHRoaXMuX3Byb3ZpZGVyVHlwZXMuZGVsZXRlKGhhbmRsZSk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVGFza1Byb3ZpZGVycy5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGdldCBoYXNUYXNrU3lzdGVtSW5mbygpOiBib29sZWFuIHtcblx0XHRjb25zdCBpbmZvc0NvdW50ID0gQXJyYXkuZnJvbSh0aGlzLl90YXNrU3lzdGVtSW5mb3MudmFsdWVzKCkpLmZsYXQoKS5sZW5ndGg7XG5cdFx0Ly8gSWYgdGhlcmUncyBhIHJlbW90ZUF1dGhvcml0eSwgdGhlbiB3ZSBlbmQgdXAgd2l0aCAyIHRhc2tTeXN0ZW1JbmZvcyxcblx0XHQvLyBvbmUgZm9yIGVhY2ggZXh0ZW5zaW9uIGhvc3QuXG5cdFx0aWYgKHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdHJldHVybiBpbmZvc0NvdW50ID4gMTtcblx0XHR9XG5cdFx0cmV0dXJuIGluZm9zQ291bnQgPiAwO1xuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyVGFza1N5c3RlbShrZXk6IHN0cmluZywgaW5mbzogSVRhc2tTeXN0ZW1JbmZvKTogdm9pZCB7XG5cdFx0Ly8gSWRlYWxseSB0aGUgV2ViIGNhbGxlciBvZiByZWdpc3RlclJlZ2lzdGVyVGFza1N5c3RlbSB3b3VsZCB1c2UgdGhlIGNvcnJlY3Qga2V5LlxuXHRcdC8vIEhvd2V2ZXIsIHRoZSBjYWxsZXIgZG9lc24ndCBrbm93IGFib3V0IHRoZSB3b3Jrc3BhY2UgZm9sZGVycyBhdCB0aGUgdGltZSBvZiB0aGUgY2FsbCwgZXZlbiB0aG91Z2ggd2Uga25vdyBhYm91dCB0aGVtIGhlcmUuXG5cdFx0aWYgKGluZm8ucGxhdGZvcm0gPT09IFBsYXRmb3JtLlBsYXRmb3JtLldlYikge1xuXHRcdFx0a2V5ID0gdGhpcy53b3Jrc3BhY2VGb2xkZXJzLmxlbmd0aCA/IHRoaXMud29ya3NwYWNlRm9sZGVyc1swXS51cmkuc2NoZW1lIDoga2V5O1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX3Rhc2tTeXN0ZW1JbmZvcy5oYXMoa2V5KSkge1xuXHRcdFx0dGhpcy5fdGFza1N5c3RlbUluZm9zLnNldChrZXksIFtpbmZvXSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGluZm9zID0gdGhpcy5fdGFza1N5c3RlbUluZm9zLmdldChrZXkpITtcblx0XHRcdGlmIChpbmZvLnBsYXRmb3JtID09PSBQbGF0Zm9ybS5QbGF0Zm9ybS5XZWIpIHtcblx0XHRcdFx0Ly8gV2ViIGluZm9zIHNob3VsZCBiZSBwdXNoZWQgbGFzdC5cblx0XHRcdFx0aW5mb3MucHVzaChpbmZvKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGluZm9zLnVuc2hpZnQoaW5mbyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaGFzVGFza1N5c3RlbUluZm8pIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVGFza1N5c3RlbUluZm8uZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldFRhc2tTeXN0ZW1JbmZvKGtleTogc3RyaW5nKTogSVRhc2tTeXN0ZW1JbmZvIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBpbmZvcyA9IHRoaXMuX3Rhc2tTeXN0ZW1JbmZvcy5nZXQoa2V5KTtcblx0XHRyZXR1cm4gKGluZm9zICYmIGluZm9zLmxlbmd0aCkgPyBpbmZvc1swXSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyBleHRlbnNpb25DYWxsYmFja1Rhc2tDb21wbGV0ZSh0YXNrOiBUYXNrLCByZXN1bHQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fdGFza1N5c3RlbSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdGFza1N5c3RlbS5jdXN0b21FeGVjdXRpb25Db21wbGV0ZSh0YXNrLCByZXN1bHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCBhIHN1YnNldCBvZiB3b3Jrc3BhY2UgdGFza3MgdGhhdCBtYXRjaCBhIGNlcnRhaW4gcHJlZGljYXRlLlxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBfZmluZFdvcmtzcGFjZVRhc2tzKHByZWRpY2F0ZTogKHRhc2s6IENvbmZpZ3VyaW5nVGFzayB8IFRhc2ssIHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlcikgPT4gYm9vbGVhbik6IFByb21pc2U8KENvbmZpZ3VyaW5nVGFzayB8IFRhc2spW10+IHtcblx0XHRjb25zdCByZXN1bHQ6IChDb25maWd1cmluZ1Rhc2sgfCBUYXNrKVtdID0gW107XG5cblx0XHRjb25zdCB0YXNrcyA9IGF3YWl0IHRoaXMuZ2V0V29ya3NwYWNlVGFza3MoKTtcblx0XHRmb3IgKGNvbnN0IFssIHdvcmtzcGFjZVRhc2tzXSBvZiB0YXNrcykge1xuXHRcdFx0aWYgKHdvcmtzcGFjZVRhc2tzLmNvbmZpZ3VyYXRpb25zKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgdGFza05hbWUgaW4gd29ya3NwYWNlVGFza3MuY29uZmlndXJhdGlvbnMuYnlJZGVudGlmaWVyKSB7XG5cdFx0XHRcdFx0Y29uc3QgdGFzayA9IHdvcmtzcGFjZVRhc2tzLmNvbmZpZ3VyYXRpb25zLmJ5SWRlbnRpZmllclt0YXNrTmFtZV07XG5cdFx0XHRcdFx0aWYgKHByZWRpY2F0ZSh0YXNrLCB3b3Jrc3BhY2VUYXNrcy53b3Jrc3BhY2VGb2xkZXIpKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaCh0YXNrKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICh3b3Jrc3BhY2VUYXNrcy5zZXQpIHtcblx0XHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIHdvcmtzcGFjZVRhc2tzLnNldC50YXNrcykge1xuXHRcdFx0XHRcdGlmIChwcmVkaWNhdGUodGFzaywgd29ya3NwYWNlVGFza3Mud29ya3NwYWNlRm9sZGVyKSkge1xuXHRcdFx0XHRcdFx0cmVzdWx0LnB1c2godGFzayk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9maW5kV29ya3NwYWNlVGFza3NJbkdyb3VwKGdyb3VwOiBUYXNrR3JvdXAsIGlzRGVmYXVsdDogYm9vbGVhbik6IFByb21pc2U8KENvbmZpZ3VyaW5nVGFzayB8IFRhc2spW10+IHtcblx0XHRyZXR1cm4gdGhpcy5fZmluZFdvcmtzcGFjZVRhc2tzKCh0YXNrKSA9PiB7XG5cdFx0XHRjb25zdCB0YXNrR3JvdXAgPSB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwO1xuXHRcdFx0aWYgKHRhc2tHcm91cCAmJiB0eXBlb2YgdGFza0dyb3VwICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRyZXR1cm4gKHRhc2tHcm91cC5faWQgPT09IGdyb3VwLl9pZCAmJiAoIWlzRGVmYXVsdCB8fCAhIXRhc2tHcm91cC5pc0RlZmF1bHQpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRUYXNrKGZvbGRlcjogSVdvcmtzcGFjZSB8IElXb3Jrc3BhY2VGb2xkZXIgfCBzdHJpbmcsIGlkZW50aWZpZXI6IHN0cmluZyB8IElUYXNrSWRlbnRpZmllciwgY29tcGFyZUlkOiBib29sZWFuID0gZmFsc2UsIHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCk6IFByb21pc2U8VGFzayB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghKGF3YWl0IHRoaXMuX3RydXN0KCkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG5hbWUgPSBUeXBlcy5pc1N0cmluZyhmb2xkZXIpID8gZm9sZGVyIDogaXNXb3Jrc3BhY2VGb2xkZXIoZm9sZGVyKSA/IGZvbGRlci5uYW1lIDogZm9sZGVyLmNvbmZpZ3VyYXRpb24gPyByZXNvdXJjZXMuYmFzZW5hbWUoZm9sZGVyLmNvbmZpZ3VyYXRpb24pIDogdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLmlnbm9yZWRXb3Jrc3BhY2VGb2xkZXJzLnNvbWUoaWdub3JlZCA9PiBpZ25vcmVkLm5hbWUgPT09IG5hbWUpKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnVGFza1NlcnZlci5mb2xkZXJJZ25vcmVkJywgJ1RoZSBmb2xkZXIgezB9IGlzIGlnbm9yZWQgc2luY2UgaXQgdXNlcyB0YXNrIHZlcnNpb24gMC4xLjAnLCBuYW1lKSkpO1xuXHRcdH1cblx0XHRjb25zdCBrZXk6IHN0cmluZyB8IEtleWVkVGFza0lkZW50aWZpZXIgfCB1bmRlZmluZWQgPSAhVHlwZXMuaXNTdHJpbmcoaWRlbnRpZmllcilcblx0XHRcdD8gVGFza0RlZmluaXRpb24uY3JlYXRlVGFza0lkZW50aWZpZXIoaWRlbnRpZmllciwgY29uc29sZSlcblx0XHRcdDogaWRlbnRpZmllcjtcblxuXHRcdGlmIChrZXkgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdC8vIFRyeSB0byBmaW5kIHRoZSB0YXNrIGluIHRoZSB3b3Jrc3BhY2Vcblx0XHRjb25zdCByZXF1ZXN0ZWRGb2xkZXIgPSBUYXNrTWFwLmdldEtleShmb2xkZXIpO1xuXHRcdGNvbnN0IG1hdGNoZWRUYXNrcyA9IGF3YWl0IHRoaXMuX2ZpbmRXb3Jrc3BhY2VUYXNrcygodGFzaywgd29ya3NwYWNlRm9sZGVyKSA9PiB7XG5cdFx0XHRjb25zdCB0YXNrRm9sZGVyID0gVGFza01hcC5nZXRLZXkod29ya3NwYWNlRm9sZGVyKTtcblx0XHRcdGlmICh0YXNrRm9sZGVyICE9PSByZXF1ZXN0ZWRGb2xkZXIgJiYgdGFza0ZvbGRlciAhPT0gVVNFUl9UQVNLU19HUk9VUF9LRVkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRhc2subWF0Y2hlcyhrZXksIGNvbXBhcmVJZCk7XG5cdFx0fSk7XG5cdFx0bWF0Y2hlZFRhc2tzLnNvcnQodGFzayA9PiB0YXNrLl9zb3VyY2Uua2luZCA9PT0gVGFza1NvdXJjZUtpbmQuRXh0ZW5zaW9uID8gMSA6IC0xKTtcblx0XHRpZiAobWF0Y2hlZFRhc2tzLmxlbmd0aCA+IDApIHtcblx0XHRcdC8vIE5pY2UsIHdlIGZvdW5kIGEgY29uZmlndXJlZCB0YXNrIVxuXHRcdFx0Y29uc3QgdGFzayA9IG1hdGNoZWRUYXNrc1swXTtcblx0XHRcdGlmIChDb25maWd1cmluZ1Rhc2suaXModGFzaykpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudHJ5UmVzb2x2ZVRhc2sodGFzayk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdGFzaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBXZSBkaWRuJ3QgZmluZCB0aGUgdGFzaywgc28gd2UgbmVlZCB0byBhc2sgYWxsIHJlc29sdmVycyBhYm91dCBpdFxuXHRcdGNvbnN0IG1hcCA9IGF3YWl0IHRoaXMuX2dldEdyb3VwZWRUYXNrcyh7IHR5cGUgfSk7XG5cdFx0bGV0IHZhbHVlcyA9IG1hcC5nZXQoZm9sZGVyKTtcblx0XHR2YWx1ZXMgPSB2YWx1ZXMuY29uY2F0KG1hcC5nZXQoVVNFUl9UQVNLU19HUk9VUF9LRVkpKTtcblxuXHRcdGlmICghdmFsdWVzKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR2YWx1ZXMgPSB2YWx1ZXMuZmlsdGVyKHRhc2sgPT4gdGFzay5tYXRjaGVzKGtleSwgY29tcGFyZUlkKSkuc29ydCh0YXNrID0+IHRhc2suX3NvdXJjZS5raW5kID09PSBUYXNrU291cmNlS2luZC5FeHRlbnNpb24gPyAxIDogLTEpO1xuXHRcdHJldHVybiB2YWx1ZXMubGVuZ3RoID4gMCA/IHZhbHVlc1swXSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyB0cnlSZXNvbHZlVGFzayhjb25maWd1cmluZ1Rhc2s6IENvbmZpZ3VyaW5nVGFzayk6IFByb21pc2U8VGFzayB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghKGF3YWl0IHRoaXMuX3RydXN0KCkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuX2FjdGl2YXRlVGFza1Byb3ZpZGVycyhjb25maWd1cmluZ1Rhc2sudHlwZSk7XG5cdFx0bGV0IG1hdGNoaW5nUHJvdmlkZXI6IElUYXNrUHJvdmlkZXIgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IG1hdGNoaW5nUHJvdmlkZXJVbmF2YWlsYWJsZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdGZvciAoY29uc3QgW2hhbmRsZSwgcHJvdmlkZXJdIG9mIHRoaXMuX3Byb3ZpZGVycykge1xuXHRcdFx0Y29uc3QgcHJvdmlkZXJUeXBlID0gdGhpcy5fcHJvdmlkZXJUeXBlcy5nZXQoaGFuZGxlKTtcblx0XHRcdGlmIChjb25maWd1cmluZ1Rhc2sudHlwZSA9PT0gcHJvdmlkZXJUeXBlKSB7XG5cdFx0XHRcdGlmIChwcm92aWRlclR5cGUgJiYgIXRoaXMuX2lzVGFza1Byb3ZpZGVyRW5hYmxlZChwcm92aWRlclR5cGUpKSB7XG5cdFx0XHRcdFx0bWF0Y2hpbmdQcm92aWRlclVuYXZhaWxhYmxlID0gdHJ1ZTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXRjaGluZ1Byb3ZpZGVyID0gcHJvdmlkZXI7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghbWF0Y2hpbmdQcm92aWRlcikge1xuXHRcdFx0aWYgKG1hdGNoaW5nUHJvdmlkZXJVbmF2YWlsYWJsZSkge1xuXHRcdFx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKFxuXHRcdFx0XHRcdCdUYXNrU2VydmljZS5wcm92aWRlclVuYXZhaWxhYmxlJyxcblx0XHRcdFx0XHQnV2FybmluZzogezB9IHRhc2tzIGFyZSB1bmF2YWlsYWJsZSBpbiB0aGUgY3VycmVudCBlbnZpcm9ubWVudC4nLFxuXHRcdFx0XHRcdGNvbmZpZ3VyaW5nVGFzay5jb25maWd1cmVzLnR5cGVcblx0XHRcdFx0KSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gVHJ5IHRvIHJlc29sdmUgdGhlIHRhc2sgZmlyc3Rcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRUYXNrID0gYXdhaXQgbWF0Y2hpbmdQcm92aWRlci5yZXNvbHZlVGFzayhjb25maWd1cmluZ1Rhc2spO1xuXHRcdFx0aWYgKHJlc29sdmVkVGFzayAmJiAocmVzb2x2ZWRUYXNrLl9pZCA9PT0gY29uZmlndXJpbmdUYXNrLl9pZCkpIHtcblx0XHRcdFx0cmV0dXJuIFRhc2tDb25maWcuY3JlYXRlQ3VzdG9tVGFzayhyZXNvbHZlZFRhc2ssIGNvbmZpZ3VyaW5nVGFzayk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIElnbm9yZSBlcnJvcnMuIFRoZSB0YXNrIGNvdWxkIG5vdCBiZSBwcm92aWRlZCBieSBhbnkgb2YgdGhlIHByb3ZpZGVycy5cblx0XHR9XG5cblx0XHQvLyBUaGUgdGFzayBjb3VsZG4ndCBiZSByZXNvbHZlZC4gSW5zdGVhZCwgdXNlIHRoZSBsZXNzIGVmZmljaWVudCBwcm92aWRlVGFzay5cblx0XHRjb25zdCB0YXNrcyA9IGF3YWl0IHRoaXMudGFza3MoeyB0eXBlOiBjb25maWd1cmluZ1Rhc2sudHlwZSB9KTtcblx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgdGFza3MpIHtcblx0XHRcdGlmICh0YXNrLl9pZCA9PT0gY29uZmlndXJpbmdUYXNrLl9pZCkge1xuXHRcdFx0XHRyZXR1cm4gVGFza0NvbmZpZy5jcmVhdGVDdXN0b21UYXNrKDxDb250cmlidXRlZFRhc2s+dGFzaywgY29uZmlndXJpbmdUYXNrKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm47XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX3ZlcnNpb25BbmRFbmdpbmVDb21wYXRpYmxlKGZpbHRlcj86IElUYXNrRmlsdGVyKTogYm9vbGVhbjtcblxuXHRwdWJsaWMgYXN5bmMgdGFza3MoZmlsdGVyPzogSVRhc2tGaWx0ZXIpOiBQcm9taXNlPFRhc2tbXT4ge1xuXHRcdGlmICghKGF3YWl0IHRoaXMuX3RydXN0KCkpKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fdmVyc2lvbkFuZEVuZ2luZUNvbXBhdGlibGUoZmlsdGVyKSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZTxUYXNrW10+KFtdKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2dldEdyb3VwZWRUYXNrcyhmaWx0ZXIpLnRoZW4oKG1hcCkgPT4gdGhpcy5hcHBseUZpbHRlclRvVGFza01hcChmaWx0ZXIsIG1hcCkpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGdldEtub3duVGFza3MoZmlsdGVyPzogSVRhc2tGaWx0ZXIpOiBQcm9taXNlPFRhc2tbXT4ge1xuXHRcdGlmICghdGhpcy5fdmVyc2lvbkFuZEVuZ2luZUNvbXBhdGlibGUoZmlsdGVyKSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZTxUYXNrW10+KFtdKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZ2V0R3JvdXBlZFRhc2tzKGZpbHRlciwgdHJ1ZSwgdHJ1ZSkudGhlbigobWFwKSA9PiB0aGlzLmFwcGx5RmlsdGVyVG9UYXNrTWFwKGZpbHRlciwgbWFwKSk7XG5cdH1cblxuXHRwdWJsaWMgdGFza1R5cGVzKCk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCB0eXBlczogc3RyaW5nW10gPSBbXTtcblx0XHRpZiAodGhpcy5faXNQcm92aWRlVGFza3NFbmFibGVkKCkpIHtcblx0XHRcdGZvciAoY29uc3QgZGVmaW5pdGlvbiBvZiBUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5LmFsbCgpKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9pc1Rhc2tQcm92aWRlckVuYWJsZWQoZGVmaW5pdGlvbi50YXNrVHlwZSkpIHtcblx0XHRcdFx0XHR0eXBlcy5wdXNoKGRlZmluaXRpb24udGFza1R5cGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0eXBlcztcblx0fVxuXG5cdHB1YmxpYyBjcmVhdGVTb3J0ZXIoKTogVGFza1NvcnRlciB7XG5cdFx0cmV0dXJuIG5ldyBUYXNrU29ydGVyKHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpID8gdGhpcy5fY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycyA6IFtdKTtcblx0fVxuXG5cdHByaXZhdGUgX2lzQWN0aXZlKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICghdGhpcy5fdGFza1N5c3RlbSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90YXNrU3lzdGVtLmlzQWN0aXZlKCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgZ2V0QWN0aXZlVGFza3MoKTogUHJvbWlzZTxUYXNrW10+IHtcblx0XHRpZiAoIXRoaXMuX3Rhc2tTeXN0ZW0pIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Rhc2tTeXN0ZW0uZ2V0QWN0aXZlVGFza3MoKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRCdXN5VGFza3MoKTogUHJvbWlzZTxUYXNrW10+IHtcblx0XHRpZiAoIXRoaXMuX3Rhc2tTeXN0ZW0pIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Rhc2tTeXN0ZW0uZ2V0QnVzeVRhc2tzKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UmVjZW50bHlVc2VkVGFza3NWMSgpOiBMUlVDYWNoZTxzdHJpbmcsIHN0cmluZz4ge1xuXHRcdGlmICh0aGlzLl9yZWNlbnRseVVzZWRUYXNrc1YxKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVjZW50bHlVc2VkVGFza3NWMTtcblx0XHR9XG5cdFx0Y29uc3QgcXVpY2tPcGVuSGlzdG9yeUxpbWl0ID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihRVUlDS09QRU5fSElTVE9SWV9MSU1JVF9DT05GSUcpO1xuXHRcdHRoaXMuX3JlY2VudGx5VXNlZFRhc2tzVjEgPSBuZXcgTFJVQ2FjaGU8c3RyaW5nLCBzdHJpbmc+KHF1aWNrT3Blbkhpc3RvcnlMaW1pdCk7XG5cblx0XHRjb25zdCBzdG9yYWdlVmFsdWUgPSB0aGlzLl9zdG9yYWdlU2VydmljZS5nZXQoQWJzdHJhY3RUYXNrU2VydmljZS5SZWNlbnRseVVzZWRUYXNrc19LZXksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdGlmIChzdG9yYWdlVmFsdWUpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlczogc3RyaW5nW10gPSBKU09OLnBhcnNlKHN0b3JhZ2VWYWx1ZSk7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlcykpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuXHRcdFx0XHRcdFx0dGhpcy5fcmVjZW50bHlVc2VkVGFza3NWMS5zZXQodmFsdWUsIHZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIElnbm9yZS4gV2UgdXNlIHRoZSBlbXB0eSByZXN1bHRcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3JlY2VudGx5VXNlZFRhc2tzVjE7XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5RmlsdGVyVG9UYXNrTWFwKGZpbHRlcjogSVRhc2tGaWx0ZXIgfCB1bmRlZmluZWQsIG1hcDogVGFza01hcCk6IFRhc2tbXSB7XG5cdFx0aWYgKCFmaWx0ZXIgfHwgIWZpbHRlci50eXBlKSB7XG5cdFx0XHRyZXR1cm4gbWFwLmFsbCgpO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQ6IFRhc2tbXSA9IFtdO1xuXHRcdG1hcC5mb3JFYWNoKCh0YXNrcykgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIHRhc2tzKSB7XG5cdFx0XHRcdGlmIChDb250cmlidXRlZFRhc2suaXModGFzaykgJiYgKCh0YXNrLmRlZmluZXMudHlwZSA9PT0gZmlsdGVyLnR5cGUpIHx8ICh0YXNrLl9zb3VyY2UubGFiZWwgPT09IGZpbHRlci50eXBlKSkpIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaCh0YXNrKTtcblx0XHRcdFx0fSBlbHNlIGlmIChDdXN0b21UYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRcdFx0aWYgKHRhc2sudHlwZSA9PT0gZmlsdGVyLnR5cGUpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKHRhc2spO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjdXN0b21pemVzID0gdGFzay5jdXN0b21pemVzKCk7XG5cdFx0XHRcdFx0XHRpZiAoY3VzdG9taXplcyAmJiBjdXN0b21pemVzLnR5cGUgPT09IGZpbHRlci50eXBlKSB7XG5cdFx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKHRhc2spO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRUYXNrc0Zyb21TdG9yYWdlKHR5cGU6ICdwZXJzaXN0ZW50JyB8ICdoaXN0b3JpY2FsJyk6IExSVUNhY2hlPHN0cmluZywgc3RyaW5nPiB7XG5cdFx0cmV0dXJuIHR5cGUgPT09ICdwZXJzaXN0ZW50JyA/IHRoaXMuX2dldFBlcnNpc3RlbnRUYXNrcygpIDogdGhpcy5fZ2V0UmVjZW50VGFza3MoKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFJlY2VudFRhc2tzKCk6IExSVUNhY2hlPHN0cmluZywgc3RyaW5nPiB7XG5cdFx0aWYgKHRoaXMuX3JlY2VudGx5VXNlZFRhc2tzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcmVjZW50bHlVc2VkVGFza3M7XG5cdFx0fVxuXHRcdGNvbnN0IHF1aWNrT3Blbkhpc3RvcnlMaW1pdCA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oUVVJQ0tPUEVOX0hJU1RPUllfTElNSVRfQ09ORklHKTtcblx0XHR0aGlzLl9yZWNlbnRseVVzZWRUYXNrcyA9IG5ldyBMUlVDYWNoZTxzdHJpbmcsIHN0cmluZz4ocXVpY2tPcGVuSGlzdG9yeUxpbWl0KTtcblxuXHRcdGNvbnN0IHN0b3JhZ2VWYWx1ZSA9IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldChBYnN0cmFjdFRhc2tTZXJ2aWNlLlJlY2VudGx5VXNlZFRhc2tzX0tleVYyLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRpZiAoc3RvcmFnZVZhbHVlKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCB2YWx1ZXM6IFtzdHJpbmcsIHN0cmluZ11bXSA9IEpTT04ucGFyc2Uoc3RvcmFnZVZhbHVlKTtcblx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWVzKSkge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9yZWNlbnRseVVzZWRUYXNrcy5zZXQodmFsdWVbMF0sIHZhbHVlWzFdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIElnbm9yZS4gV2UgdXNlIHRoZSBlbXB0eSByZXN1bHRcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3JlY2VudGx5VXNlZFRhc2tzO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0UGVyc2lzdGVudFRhc2tzKCk6IExSVUNhY2hlPHN0cmluZywgc3RyaW5nPiB7XG5cdFx0aWYgKHRoaXMuX3BlcnNpc3RlbnRUYXNrcykge1xuXHRcdFx0dGhpcy5fbG9nKG5scy5sb2NhbGl6ZSgndGFza1NlcnZpY2UuZ2V0dGluZ0NhY2hlZFRhc2tzJywgJ1JldHVybmluZyBjYWNoZWQgdGFza3MgezB9JywgdGhpcy5fcGVyc2lzdGVudFRhc2tzLnNpemUpLCB0cnVlKTtcblx0XHRcdHJldHVybiB0aGlzLl9wZXJzaXN0ZW50VGFza3M7XG5cdFx0fVxuXHRcdC8vVE9ETzogc2hvdWxkIHRoaXMgIyBiZSBjb25maWd1cmFibGU/XG5cdFx0dGhpcy5fcGVyc2lzdGVudFRhc2tzID0gbmV3IExSVUNhY2hlPHN0cmluZywgc3RyaW5nPigxMCk7XG5cdFx0Y29uc3Qgc3RvcmFnZVZhbHVlID0gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0KEFic3RyYWN0VGFza1NlcnZpY2UuUGVyc2lzdGVudFRhc2tzX0tleSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0aWYgKHN0b3JhZ2VWYWx1ZSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgdmFsdWVzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBKU09OLnBhcnNlKHN0b3JhZ2VWYWx1ZSk7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlcykpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuXHRcdFx0XHRcdFx0dGhpcy5fcGVyc2lzdGVudFRhc2tzLnNldCh2YWx1ZVswXSwgdmFsdWVbMV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0Ly8gSWdub3JlLiBXZSB1c2UgdGhlIGVtcHR5IHJlc3VsdFxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcGVyc2lzdGVudFRhc2tzO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Rm9sZGVyRnJvbVRhc2tLZXkoa2V5OiBzdHJpbmcpOiB7IGZvbGRlcjogc3RyaW5nIHwgdW5kZWZpbmVkOyBpc1dvcmtzcGFjZUZpbGU6IGJvb2xlYW4gfCB1bmRlZmluZWQgfSB7XG5cdFx0Y29uc3Qga2V5VmFsdWU6IHsgZm9sZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7IGlkOiBzdHJpbmcgfCB1bmRlZmluZWQgfSA9IEpTT04ucGFyc2Uoa2V5KTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Zm9sZGVyOiBrZXlWYWx1ZS5mb2xkZXIsIGlzV29ya3NwYWNlRmlsZToga2V5VmFsdWUuaWQ/LmVuZHNXaXRoKFRhc2tTb3VyY2VLaW5kLldvcmtzcGFjZUZpbGUpXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRTYXZlZFRhc2tzKHR5cGU6ICdwZXJzaXN0ZW50JyB8ICdoaXN0b3JpY2FsJyk6IFByb21pc2U8KFRhc2sgfCBDb25maWd1cmluZ1Rhc2spW10+IHtcblx0XHRjb25zdCBmb2xkZXJNYXA6IElTdHJpbmdEaWN0aW9uYXJ5PElXb3Jrc3BhY2VGb2xkZXI+ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLndvcmtzcGFjZUZvbGRlcnMuZm9yRWFjaChmb2xkZXIgPT4ge1xuXHRcdFx0Zm9sZGVyTWFwW2ZvbGRlci51cmkudG9TdHJpbmcoKV0gPSBmb2xkZXI7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZm9sZGVyVG9UYXNrc01hcDogTWFwPHN0cmluZywgYW55PiA9IG5ldyBNYXAoKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VUb1Rhc2tNYXA6IE1hcDxzdHJpbmcsIGFueT4gPSBuZXcgTWFwKCk7XG5cdFx0Y29uc3Qgc3RvcmVkVGFza3MgPSB0aGlzLl9nZXRUYXNrc0Zyb21TdG9yYWdlKHR5cGUpO1xuXHRcdGNvbnN0IHRhc2tzOiAoVGFzayB8IENvbmZpZ3VyaW5nVGFzaylbXSA9IFtdO1xuXHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ3Rhc2tTZXJ2aWNlLmdldFNhdmVkVGFza3MnLCAnRmV0Y2hpbmcgdGFza3MgZnJvbSB0YXNrIHN0b3JhZ2UuJyksIHRydWUpO1xuXHRcdGZ1bmN0aW9uIGFkZFRhc2tUb01hcChtYXA6IE1hcDxzdHJpbmcsIGFueT4sIGZvbGRlcjogc3RyaW5nIHwgdW5kZWZpbmVkLCB0YXNrOiBhbnkpIHtcblx0XHRcdGlmIChmb2xkZXIgJiYgIW1hcC5oYXMoZm9sZGVyKSkge1xuXHRcdFx0XHRtYXAuc2V0KGZvbGRlciwgW10pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGZvbGRlciAmJiAoZm9sZGVyTWFwW2ZvbGRlcl0gfHwgKGZvbGRlciA9PT0gVVNFUl9UQVNLU19HUk9VUF9LRVkpKSAmJiB0YXNrKSB7XG5cdFx0XHRcdG1hcC5nZXQoZm9sZGVyKS5wdXNoKHRhc2spO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHN0b3JlZFRhc2tzLmVudHJpZXMoKSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3Qga2V5ID0gZW50cnlbMF07XG5cdFx0XHRcdGNvbnN0IHRhc2sgPSBKU09OLnBhcnNlKGVudHJ5WzFdKTtcblx0XHRcdFx0Y29uc3QgZm9sZGVySW5mbyA9IHRoaXMuX2dldEZvbGRlckZyb21UYXNrS2V5KGtleSk7XG5cdFx0XHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ3Rhc2tTZXJ2aWNlLmdldFNhdmVkVGFza3MucmVhZGluZycsICdSZWFkaW5nIHRhc2tzIGZyb20gdGFzayBzdG9yYWdlLCB7MH0sIHsxfSwgezJ9Jywga2V5LCB0YXNrLCBmb2xkZXJJbmZvLmZvbGRlciksIHRydWUpO1xuXHRcdFx0XHRhZGRUYXNrVG9NYXAoZm9sZGVySW5mby5pc1dvcmtzcGFjZUZpbGUgPyB3b3Jrc3BhY2VUb1Rhc2tNYXAgOiBmb2xkZXJUb1Rhc2tzTWFwLCBmb2xkZXJJbmZvLmZvbGRlciwgdGFzayk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKCd0YXNrU2VydmljZS5nZXRTYXZlZFRhc2tzLmVycm9yJywgJ0ZldGNoaW5nIGEgdGFzayBmcm9tIHRhc2sgc3RvcmFnZSBmYWlsZWQ6IHswfS4nLCBlcnJvciksIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlYWRUYXNrc01hcDogTWFwPHN0cmluZywgKFRhc2sgfCBDb25maWd1cmluZ1Rhc2spPiA9IG5ldyBNYXAoKTtcblxuXHRcdGFzeW5jIGZ1bmN0aW9uIHJlYWRUYXNrcyh0aGF0OiBBYnN0cmFjdFRhc2tTZXJ2aWNlLCBtYXA6IE1hcDxzdHJpbmcsIGFueT4sIGlzV29ya3NwYWNlRmlsZTogYm9vbGVhbikge1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgb2YgbWFwLmtleXMoKSkge1xuXHRcdFx0XHRjb25zdCBjdXN0b206IEN1c3RvbVRhc2tbXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBjdXN0b21pemVkOiBJU3RyaW5nRGljdGlvbmFyeTxDb25maWd1cmluZ1Rhc2s+ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdFx0Y29uc3QgdGFza0NvbmZpZ1NvdXJjZSA9IChmb2xkZXJNYXBba2V5XVxuXHRcdFx0XHRcdD8gKGlzV29ya3NwYWNlRmlsZVxuXHRcdFx0XHRcdFx0PyBUYXNrQ29uZmlnLlRhc2tDb25maWdTb3VyY2UuV29ya3NwYWNlRmlsZSA6IFRhc2tDb25maWcuVGFza0NvbmZpZ1NvdXJjZS5UYXNrc0pzb24pXG5cdFx0XHRcdFx0OiBUYXNrQ29uZmlnLlRhc2tDb25maWdTb3VyY2UuVXNlcik7XG5cdFx0XHRcdGF3YWl0IHRoYXQuX2NvbXB1dGVUYXNrc0ZvclNpbmdsZUNvbmZpZyhmb2xkZXJNYXBba2V5XSA/PyBhd2FpdCB0aGF0Ll9nZXRBRm9sZGVyKCksIHtcblx0XHRcdFx0XHR2ZXJzaW9uOiAnMi4wLjAnLFxuXHRcdFx0XHRcdHRhc2tzOiBtYXAuZ2V0KGtleSlcblx0XHRcdFx0fSwgVGFza1J1blNvdXJjZS5TeXN0ZW0sIGN1c3RvbSwgY3VzdG9taXplZCwgdGFza0NvbmZpZ1NvdXJjZSwgdHJ1ZSk7XG5cdFx0XHRcdGN1c3RvbS5mb3JFYWNoKHRhc2sgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRhc2tLZXkgPSB0YXNrLmdldEtleSgpO1xuXHRcdFx0XHRcdGlmICh0YXNrS2V5KSB7XG5cdFx0XHRcdFx0XHRyZWFkVGFza3NNYXAuc2V0KHRhc2tLZXksIHRhc2spO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGZvciAoY29uc3QgY29uZmlndXJhdGlvbiBpbiBjdXN0b21pemVkKSB7XG5cdFx0XHRcdFx0Y29uc3QgdGFza0tleSA9IGN1c3RvbWl6ZWRbY29uZmlndXJhdGlvbl0uZ2V0S2V5KCk7XG5cdFx0XHRcdFx0aWYgKHRhc2tLZXkpIHtcblx0XHRcdFx0XHRcdHJlYWRUYXNrc01hcC5zZXQodGFza0tleSwgY3VzdG9taXplZFtjb25maWd1cmF0aW9uXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGF3YWl0IHJlYWRUYXNrcyh0aGlzLCBmb2xkZXJUb1Rhc2tzTWFwLCBmYWxzZSk7XG5cdFx0YXdhaXQgcmVhZFRhc2tzKHRoaXMsIHdvcmtzcGFjZVRvVGFza01hcCwgdHJ1ZSk7XG5cdFx0Zm9yIChjb25zdCBrZXkgb2Ygc3RvcmVkVGFza3Mua2V5cygpKSB7XG5cdFx0XHRpZiAocmVhZFRhc2tzTWFwLmhhcyhrZXkpKSB7XG5cdFx0XHRcdHRhc2tzLnB1c2gocmVhZFRhc2tzTWFwLmdldChrZXkpISk7XG5cdFx0XHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ3Rhc2tTZXJ2aWNlLmdldFNhdmVkVGFza3MucmVzb2x2ZWQnLCAnUmVzb2x2ZWQgdGFzayB7MH0nLCBrZXkpLCB0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ3Rhc2tTZXJ2aWNlLmdldFNhdmVkVGFza3MudW5yZXNvbHZlZCcsICdVbmFibGUgdG8gcmVzb2x2ZSB0YXNrIHswfSAnLCBrZXkpLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRhc2tzO1xuXHR9XG5cblx0cHVibGljIHJlbW92ZVJlY2VudGx5VXNlZFRhc2sodGFza1JlY2VudGx5VXNlZEtleTogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMuX2dldFRhc2tzRnJvbVN0b3JhZ2UoJ2hpc3RvcmljYWwnKS5oYXModGFza1JlY2VudGx5VXNlZEtleSkpIHtcblx0XHRcdHRoaXMuX2dldFRhc2tzRnJvbVN0b3JhZ2UoJ2hpc3RvcmljYWwnKS5kZWxldGUodGFza1JlY2VudGx5VXNlZEtleSk7XG5cdFx0XHR0aGlzLl9zYXZlUmVjZW50bHlVc2VkVGFza3MoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlUGVyc2lzdGVudFRhc2soa2V5OiBzdHJpbmcpIHtcblx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKCd0YXNrU2VydmljZS5yZW1vdmVQZXJzaXN0ZW50VGFzaycsICdSZW1vdmluZyBwZXJzaXN0ZW50IHRhc2sgezB9Jywga2V5KSwgdHJ1ZSk7XG5cdFx0aWYgKHRoaXMuX2dldFRhc2tzRnJvbVN0b3JhZ2UoJ3BlcnNpc3RlbnQnKS5oYXMoa2V5KSkge1xuXHRcdFx0dGhpcy5fZ2V0VGFza3NGcm9tU3RvcmFnZSgncGVyc2lzdGVudCcpLmRlbGV0ZShrZXkpO1xuXHRcdFx0dGhpcy5fc2F2ZVBlcnNpc3RlbnRUYXNrcygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NldFRhc2tMUlVDYWNoZUxpbWl0KCkge1xuXHRcdGNvbnN0IHF1aWNrT3Blbkhpc3RvcnlMaW1pdCA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oUVVJQ0tPUEVOX0hJU1RPUllfTElNSVRfQ09ORklHKTtcblx0XHRpZiAodGhpcy5fcmVjZW50bHlVc2VkVGFza3MpIHtcblx0XHRcdHRoaXMuX3JlY2VudGx5VXNlZFRhc2tzLmxpbWl0ID0gcXVpY2tPcGVuSGlzdG9yeUxpbWl0O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3NldFJlY2VudGx5VXNlZFRhc2sodGFzazogVGFzayk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBrZXkgPSB0YXNrLmdldEtleSgpO1xuXHRcdGlmICghSW5NZW1vcnlUYXNrLmlzKHRhc2spICYmIGtleSkge1xuXHRcdFx0Y29uc3QgY3VzdG9taXphdGlvbnMgPSB0aGlzLl9jcmVhdGVDdXN0b21pemFibGVUYXNrKHRhc2spO1xuXHRcdFx0aWYgKENvbnRyaWJ1dGVkVGFzay5pcyh0YXNrKSAmJiBjdXN0b21pemF0aW9ucykge1xuXHRcdFx0XHRjb25zdCBjdXN0b206IEN1c3RvbVRhc2tbXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBjdXN0b21pemVkOiBJU3RyaW5nRGljdGlvbmFyeTxDb25maWd1cmluZ1Rhc2s+ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5fY29tcHV0ZVRhc2tzRm9yU2luZ2xlQ29uZmlnKHRhc2suX3NvdXJjZS53b3Jrc3BhY2VGb2xkZXIgPz8gdGhpcy53b3Jrc3BhY2VGb2xkZXJzWzBdLCB7XG5cdFx0XHRcdFx0dmVyc2lvbjogJzIuMC4wJyxcblx0XHRcdFx0XHR0YXNrczogW2N1c3RvbWl6YXRpb25zXVxuXHRcdFx0XHR9LCBUYXNrUnVuU291cmNlLlN5c3RlbSwgY3VzdG9tLCBjdXN0b21pemVkLCBUYXNrQ29uZmlnLlRhc2tDb25maWdTb3VyY2UuVGFza3NKc29uLCB0cnVlKTtcblx0XHRcdFx0Zm9yIChjb25zdCBjb25maWd1cmF0aW9uIGluIGN1c3RvbWl6ZWQpIHtcblx0XHRcdFx0XHRrZXkgPSBjdXN0b21pemVkW2NvbmZpZ3VyYXRpb25dLmdldEtleSgpITtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fZ2V0VGFza3NGcm9tU3RvcmFnZSgnaGlzdG9yaWNhbCcpLnNldChrZXksIEpTT04uc3RyaW5naWZ5KGN1c3RvbWl6YXRpb25zKSk7XG5cdFx0XHR0aGlzLl9zYXZlUmVjZW50bHlVc2VkVGFza3MoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zYXZlUmVjZW50bHlVc2VkVGFza3MoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9yZWNlbnRseVVzZWRUYXNrcykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBxdWlja09wZW5IaXN0b3J5TGltaXQgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KFFVSUNLT1BFTl9ISVNUT1JZX0xJTUlUX0NPTkZJRyk7XG5cdFx0Ly8gc2V0dGluZyBoaXN0b3J5IGxpbWl0IHRvIDAgbWVhbnMgbm8gTFJVIHNvcnRpbmdcblx0XHRpZiAocXVpY2tPcGVuSGlzdG9yeUxpbWl0ID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxldCBrZXlzID0gWy4uLnRoaXMuX3JlY2VudGx5VXNlZFRhc2tzLmtleXMoKV07XG5cdFx0aWYgKGtleXMubGVuZ3RoID4gcXVpY2tPcGVuSGlzdG9yeUxpbWl0KSB7XG5cdFx0XHRrZXlzID0ga2V5cy5zbGljZSgwLCBxdWlja09wZW5IaXN0b3J5TGltaXQpO1xuXHRcdH1cblx0XHRjb25zdCBrZXlWYWx1ZXM6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcblx0XHRcdGtleVZhbHVlcy5wdXNoKFtrZXksIHRoaXMuX3JlY2VudGx5VXNlZFRhc2tzLmdldChrZXksIFRvdWNoLk5vbmUpIV0pO1xuXHRcdH1cblx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZShBYnN0cmFjdFRhc2tTZXJ2aWNlLlJlY2VudGx5VXNlZFRhc2tzX0tleVYyLCBKU09OLnN0cmluZ2lmeShrZXlWYWx1ZXMpLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc2V0UGVyc2lzdGVudFRhc2sodGFzazogVGFzayk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGFza1NldHRpbmdJZC5SZWNvbm5lY3Rpb24pKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxldCBrZXkgPSB0YXNrLmdldEtleSgpO1xuXHRcdGlmICghSW5NZW1vcnlUYXNrLmlzKHRhc2spICYmIGtleSkge1xuXHRcdFx0Y29uc3QgY3VzdG9taXphdGlvbnMgPSB0aGlzLl9jcmVhdGVDdXN0b21pemFibGVUYXNrKHRhc2spO1xuXHRcdFx0aWYgKENvbnRyaWJ1dGVkVGFzay5pcyh0YXNrKSAmJiBjdXN0b21pemF0aW9ucykge1xuXHRcdFx0XHRjb25zdCBjdXN0b206IEN1c3RvbVRhc2tbXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBjdXN0b21pemVkOiBJU3RyaW5nRGljdGlvbmFyeTxDb25maWd1cmluZ1Rhc2s+ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5fY29tcHV0ZVRhc2tzRm9yU2luZ2xlQ29uZmlnKHRhc2suX3NvdXJjZS53b3Jrc3BhY2VGb2xkZXIgPz8gdGhpcy53b3Jrc3BhY2VGb2xkZXJzWzBdLCB7XG5cdFx0XHRcdFx0dmVyc2lvbjogJzIuMC4wJyxcblx0XHRcdFx0XHR0YXNrczogW2N1c3RvbWl6YXRpb25zXVxuXHRcdFx0XHR9LCBUYXNrUnVuU291cmNlLlN5c3RlbSwgY3VzdG9tLCBjdXN0b21pemVkLCBUYXNrQ29uZmlnLlRhc2tDb25maWdTb3VyY2UuVGFza3NKc29uLCB0cnVlKTtcblx0XHRcdFx0Zm9yIChjb25zdCBjb25maWd1cmF0aW9uIGluIGN1c3RvbWl6ZWQpIHtcblx0XHRcdFx0XHRrZXkgPSBjdXN0b21pemVkW2NvbmZpZ3VyYXRpb25dLmdldEtleSgpITtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCF0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlzQmFja2dyb3VuZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKCd0YXNrU2VydmljZS5zZXRQZXJzaXN0ZW50VGFzaycsICdTZXR0aW5nIHBlcnNpc3RlbnQgdGFzayB7MH0nLCBrZXkpLCB0cnVlKTtcblx0XHRcdHRoaXMuX2dldFRhc2tzRnJvbVN0b3JhZ2UoJ3BlcnNpc3RlbnQnKS5zZXQoa2V5LCBKU09OLnN0cmluZ2lmeShjdXN0b21pemF0aW9ucykpO1xuXHRcdFx0dGhpcy5fc2F2ZVBlcnNpc3RlbnRUYXNrcygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NhdmVQZXJzaXN0ZW50VGFza3MoKTogdm9pZCB7XG5cdFx0dGhpcy5fcGVyc2lzdGVudFRhc2tzID0gdGhpcy5fZ2V0VGFza3NGcm9tU3RvcmFnZSgncGVyc2lzdGVudCcpO1xuXHRcdGNvbnN0IGtleXMgPSBbLi4udGhpcy5fcGVyc2lzdGVudFRhc2tzLmtleXMoKV07XG5cdFx0Y29uc3Qga2V5VmFsdWVzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG5cdFx0XHRrZXlWYWx1ZXMucHVzaChba2V5LCB0aGlzLl9wZXJzaXN0ZW50VGFza3MuZ2V0KGtleSwgVG91Y2guTm9uZSkhXSk7XG5cdFx0fVxuXHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ3NhdmVQZXJzaXN0ZW50VGFzaycsICdTYXZpbmcgcGVyc2lzdGVudCB0YXNrczogezB9Jywga2V5cy5qb2luKCcsICcpKSwgdHJ1ZSk7XG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoQWJzdHJhY3RUYXNrU2VydmljZS5QZXJzaXN0ZW50VGFza3NfS2V5LCBKU09OLnN0cmluZ2lmeShrZXlWYWx1ZXMpLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb3BlbkRvY3VtZW50YXRpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5fb3BlbmVyU2VydmljZS5vcGVuKFVSSS5wYXJzZSgnaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy9lZGl0b3IvdGFza3MjX2RlZmluaW5nLWEtcHJvYmxlbS1tYXRjaGVyJykpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZmluZFNpbmdsZVdvcmtzcGFjZVRhc2tPZkdyb3VwKGdyb3VwOiBUYXNrR3JvdXApOiBQcm9taXNlPElUYXNrU3VtbWFyeSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHRhc2tzT2ZHcm91cCA9IGF3YWl0IHRoaXMuX2ZpbmRXb3Jrc3BhY2VUYXNrc0luR3JvdXAoZ3JvdXAsIHRydWUpO1xuXHRcdGlmICgodGFza3NPZkdyb3VwLmxlbmd0aCA9PT0gMSkgJiYgKHR5cGVvZiB0YXNrc09mR3JvdXBbMF0uY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAgIT09ICdzdHJpbmcnKSAmJiB0YXNrc09mR3JvdXBbMF0uY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXA/LmlzRGVmYXVsdCkge1xuXHRcdFx0bGV0IHJlc29sdmVkVGFzazogVGFzayB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChDb25maWd1cmluZ1Rhc2suaXModGFza3NPZkdyb3VwWzBdKSkge1xuXHRcdFx0XHRyZXNvbHZlZFRhc2sgPSBhd2FpdCB0aGlzLnRyeVJlc29sdmVUYXNrKHRhc2tzT2ZHcm91cFswXSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXNvbHZlZFRhc2sgPSB0YXNrc09mR3JvdXBbMF07XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzb2x2ZWRUYXNrKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnJ1bihyZXNvbHZlZFRhc2ssIHVuZGVmaW5lZCwgVGFza1J1blNvdXJjZS5Vc2VyKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2J1aWxkKCk6IFByb21pc2U8SVRhc2tTdW1tYXJ5PiB7XG5cdFx0Y29uc3QgdHJ5QnVpbGRTaG9ydGN1dCA9IGF3YWl0IHRoaXMuX2ZpbmRTaW5nbGVXb3Jrc3BhY2VUYXNrT2ZHcm91cChUYXNrR3JvdXAuQnVpbGQpO1xuXHRcdGlmICh0cnlCdWlsZFNob3J0Y3V0KSB7XG5cdFx0XHRyZXR1cm4gdHJ5QnVpbGRTaG9ydGN1dDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2dldEdyb3VwZWRUYXNrc0FuZEV4ZWN1dGUoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3J1blRlc3QoKTogUHJvbWlzZTxJVGFza1N1bW1hcnk+IHtcblx0XHRjb25zdCB0cnlUZXN0U2hvcnRjdXQgPSBhd2FpdCB0aGlzLl9maW5kU2luZ2xlV29ya3NwYWNlVGFza09mR3JvdXAoVGFza0dyb3VwLlRlc3QpO1xuXHRcdGlmICh0cnlUZXN0U2hvcnRjdXQpIHtcblx0XHRcdHJldHVybiB0cnlUZXN0U2hvcnRjdXQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2dldEdyb3VwZWRUYXNrc0FuZEV4ZWN1dGUodHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRHcm91cGVkVGFza3NBbmRFeGVjdXRlKHRlc3Q/OiBib29sZWFuKTogUHJvbWlzZTxJVGFza1N1bW1hcnk+IHtcblx0XHRjb25zdCB0YXNrcyA9IGF3YWl0IHRoaXMuX2dldEdyb3VwZWRUYXNrcygpO1xuXHRcdGNvbnN0IHJ1bm5hYmxlID0gdGhpcy5fY3JlYXRlUnVubmFibGVUYXNrKHRhc2tzLCB0ZXN0ID8gVGFza0dyb3VwLlRlc3QgOiBUYXNrR3JvdXAuQnVpbGQpO1xuXHRcdGlmICghcnVubmFibGUgfHwgIXJ1bm5hYmxlLnRhc2spIHtcblx0XHRcdGlmICh0ZXN0KSB7XG5cdFx0XHRcdGlmICh0aGlzLnNjaGVtYVZlcnNpb24gPT09IEpzb25TY2hlbWFWZXJzaW9uLlYwXzFfMCkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBUYXNrRXJyb3IoU2V2ZXJpdHkuSW5mbywgbmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5ub1Rlc3RUYXNrMScsICdObyB0ZXN0IHRhc2sgZGVmaW5lZC4gTWFyayBhIHRhc2sgd2l0aCBcXCdpc1Rlc3RDb21tYW5kXFwnIGluIHRoZSB0YXNrcy5qc29uIGZpbGUuJyksIFRhc2tFcnJvcnMuTm9UZXN0VGFzayk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IFRhc2tFcnJvcihTZXZlcml0eS5JbmZvLCBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLm5vVGVzdFRhc2syJywgJ05vIHRlc3QgdGFzayBkZWZpbmVkLiBNYXJrIGEgdGFzayB3aXRoIGFzIGEgXFwndGVzdFxcJyBncm91cCBpbiB0aGUgdGFza3MuanNvbiBmaWxlLicpLCBUYXNrRXJyb3JzLk5vVGVzdFRhc2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAodGhpcy5zY2hlbWFWZXJzaW9uID09PSBKc29uU2NoZW1hVmVyc2lvbi5WMF8xXzApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgVGFza0Vycm9yKFNldmVyaXR5LkluZm8sIG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2Uubm9CdWlsZFRhc2sxJywgJ05vIGJ1aWxkIHRhc2sgZGVmaW5lZC4gTWFyayBhIHRhc2sgd2l0aCBcXCdpc0J1aWxkQ29tbWFuZFxcJyBpbiB0aGUgdGFza3MuanNvbiBmaWxlLicpLCBUYXNrRXJyb3JzLk5vQnVpbGRUYXNrKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgVGFza0Vycm9yKFNldmVyaXR5LkluZm8sIG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2Uubm9CdWlsZFRhc2syJywgJ05vIGJ1aWxkIHRhc2sgZGVmaW5lZC4gTWFyayBhIHRhc2sgd2l0aCBhcyBhIFxcJ2J1aWxkXFwnIGdyb3VwIGluIHRoZSB0YXNrcy5qc29uIGZpbGUuJyksIFRhc2tFcnJvcnMuTm9CdWlsZFRhc2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGxldCBleGVjdXRlVGFza1Jlc3VsdDogSVRhc2tTdW1tYXJ5O1xuXHRcdHRyeSB7XG5cdFx0XHRleGVjdXRlVGFza1Jlc3VsdCA9IGF3YWl0IHRoaXMuX2V4ZWN1dGVUYXNrKHJ1bm5hYmxlLnRhc2ssIHJ1bm5hYmxlLnJlc29sdmVyLCBUYXNrUnVuU291cmNlLlVzZXIpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLl9oYW5kbGVFcnJvcihlcnJvcik7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXhlY3V0ZVRhc2tSZXN1bHQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKHRhc2s6IFRhc2sgfCB1bmRlZmluZWQsIG9wdGlvbnM/OiBJUHJvYmxlbU1hdGNoZXJSdW5PcHRpb25zLCBydW5Tb3VyY2U6IFRhc2tSdW5Tb3VyY2UgPSBUYXNrUnVuU291cmNlLlN5c3RlbSk6IFByb21pc2U8SVRhc2tTdW1tYXJ5IHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCEoYXdhaXQgdGhpcy5fdHJ1c3QoKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0YXNrKSB7XG5cdFx0XHR0aHJvdyBuZXcgVGFza0Vycm9yKFNldmVyaXR5LkluZm8sIG5scy5sb2NhbGl6ZSgnVGFza1NlcnZlci5ub1Rhc2snLCAnVGFzayB0byBleGVjdXRlIGlzIHVuZGVmaW5lZCcpLCBUYXNrRXJyb3JzLlRhc2tOb3RGb3VuZCk7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc29sdmVyID0gdGhpcy5fY3JlYXRlUmVzb2x2ZXIoKTtcblx0XHRsZXQgZXhlY3V0ZVRhc2tSZXN1bHQ6IElUYXNrU3VtbWFyeSB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0aWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5hdHRhY2hQcm9ibGVtTWF0Y2hlciAmJiB0aGlzLl9zaG91bGRBdHRhY2hQcm9ibGVtTWF0Y2hlcih0YXNrKSAmJiAhSW5NZW1vcnlUYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRcdGNvbnN0IHRhc2tUb0V4ZWN1dGUgPSBhd2FpdCB0aGlzLl9hdHRhY2hQcm9ibGVtTWF0Y2hlcih0YXNrKTtcblx0XHRcdFx0aWYgKHRhc2tUb0V4ZWN1dGUpIHtcblx0XHRcdFx0XHRleGVjdXRlVGFza1Jlc3VsdCA9IGF3YWl0IHRoaXMuX2V4ZWN1dGVUYXNrKHRhc2tUb0V4ZWN1dGUsIHJlc29sdmVyLCBydW5Tb3VyY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRleGVjdXRlVGFza1Jlc3VsdCA9IGF3YWl0IHRoaXMuX2V4ZWN1dGVUYXNrKHRhc2ssIHJlc29sdmVyLCBydW5Tb3VyY2UpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGV4ZWN1dGVUYXNrUmVzdWx0O1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLl9oYW5kbGVFcnJvcihlcnJvcik7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2lzUHJvdmlkZVRhc2tzRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBzZXR0aW5nVmFsdWUgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUYXNrU2V0dGluZ0lkLkF1dG9EZXRlY3QpO1xuXHRcdHJldHVybiBzZXR0aW5nVmFsdWUgPT09ICdvbic7XG5cdH1cblxuXHRwcml2YXRlIF9pc1Byb2JsZW1NYXRjaGVyUHJvbXB0RW5hYmxlZCh0eXBlPzogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgc2V0dGluZ1ZhbHVlID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoUFJPQkxFTV9NQVRDSEVSX05FVkVSX0NPTkZJRyk7XG5cdFx0aWYgKFR5cGVzLmlzQm9vbGVhbihzZXR0aW5nVmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gIXNldHRpbmdWYWx1ZTtcblx0XHR9XG5cdFx0aWYgKHR5cGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGNvbnN0IHNldHRpbmdWYWx1ZU1hcDogSVN0cmluZ0RpY3Rpb25hcnk8Ym9vbGVhbj4gPSBzZXR0aW5nVmFsdWUgYXMgYW55O1xuXHRcdHJldHVybiAhc2V0dGluZ1ZhbHVlTWFwW3R5cGVdO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VHlwZUZvclRhc2sodGFzazogVGFzayk6IHN0cmluZyB7XG5cdFx0bGV0IHR5cGU6IHN0cmluZztcblx0XHRpZiAoQ3VzdG9tVGFzay5pcyh0YXNrKSkge1xuXHRcdFx0Y29uc3QgY29uZmlnUHJvcGVydGllczogVGFza0NvbmZpZy5JQ29uZmlndXJhdGlvblByb3BlcnRpZXMgPSB0YXNrLl9zb3VyY2UuY29uZmlnLmVsZW1lbnQ7XG5cdFx0XHR0eXBlID0gKDxhbnk+Y29uZmlnUHJvcGVydGllcykudHlwZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dHlwZSA9IHRhc2suZ2V0RGVmaW5pdGlvbigpIS50eXBlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHlwZTtcblx0fVxuXG5cdHByaXZhdGUgX3Nob3VsZEF0dGFjaFByb2JsZW1NYXRjaGVyKHRhc2s6IFRhc2spOiBib29sZWFuIHtcblx0XHRjb25zdCBlbmFibGVkID0gdGhpcy5faXNQcm9ibGVtTWF0Y2hlclByb21wdEVuYWJsZWQodGhpcy5fZ2V0VHlwZUZvclRhc2sodGFzaykpO1xuXHRcdGlmIChlbmFibGVkID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2NhbkN1c3RvbWl6ZSh0YXNrKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCAhPT0gdW5kZWZpbmVkICYmIHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAgIT09IFRhc2tHcm91cC5CdWlsZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlcnMgIT09IHVuZGVmaW5lZCAmJiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChDb250cmlidXRlZFRhc2suaXModGFzaykpIHtcblx0XHRcdHJldHVybiAhdGFzay5oYXNEZWZpbmVkTWF0Y2hlcnMgJiYgISF0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyAmJiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlcnMubGVuZ3RoID09PSAwKTtcblx0XHR9XG5cdFx0aWYgKEN1c3RvbVRhc2suaXModGFzaykpIHtcblx0XHRcdGNvbnN0IGNvbmZpZ1Byb3BlcnRpZXM6IFRhc2tDb25maWcuSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzID0gdGFzay5fc291cmNlLmNvbmZpZy5lbGVtZW50O1xuXHRcdFx0cmV0dXJuIGNvbmZpZ1Byb3BlcnRpZXMucHJvYmxlbU1hdGNoZXIgPT09IHVuZGVmaW5lZCAmJiAhdGFzay5oYXNEZWZpbmVkTWF0Y2hlcnM7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3VwZGF0ZU5ldmVyUHJvYmxlbU1hdGNoZXJTZXR0aW5nKHR5cGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShQUk9CTEVNX01BVENIRVJfTkVWRVJfQ09ORklHKTtcblx0XHRpZiAoY3VycmVudCA9PT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRsZXQgbmV3VmFsdWU6IElTdHJpbmdEaWN0aW9uYXJ5PGJvb2xlYW4+O1xuXHRcdGlmIChjdXJyZW50ICE9PSBmYWxzZSkge1xuXHRcdFx0bmV3VmFsdWUgPSA8YW55PmN1cnJlbnQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ld1ZhbHVlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR9XG5cdFx0bmV3VmFsdWVbdHlwZV0gPSB0cnVlO1xuXHRcdHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShQUk9CTEVNX01BVENIRVJfTkVWRVJfQ09ORklHLCBuZXdWYWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9hdHRhY2hQcm9ibGVtTWF0Y2hlcih0YXNrOiBDb250cmlidXRlZFRhc2sgfCBDdXN0b21UYXNrKTogUHJvbWlzZTxUYXNrIHwgdW5kZWZpbmVkPiB7XG5cdFx0aW50ZXJmYWNlIElQcm9ibGVtTWF0Y2hlclBpY2tFbnRyeSBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0XHRcdG1hdGNoZXI6IElOYW1lZFByb2JsZW1NYXRjaGVyIHwgdW5kZWZpbmVkO1xuXHRcdFx0bmV2ZXI/OiBib29sZWFuO1xuXHRcdFx0bGVhcm5Nb3JlPzogYm9vbGVhbjtcblx0XHRcdHNldHRpbmc/OiBzdHJpbmc7XG5cdFx0fVxuXHRcdGxldCBlbnRyaWVzOiBRdWlja1BpY2tJbnB1dDxJUHJvYmxlbU1hdGNoZXJQaWNrRW50cnk+W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBQcm9ibGVtTWF0Y2hlclJlZ2lzdHJ5LmtleXMoKSkge1xuXHRcdFx0Y29uc3QgbWF0Y2hlciA9IFByb2JsZW1NYXRjaGVyUmVnaXN0cnkuZ2V0KGtleSk7XG5cdFx0XHRpZiAobWF0Y2hlci5kZXByZWNhdGVkKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG1hdGNoZXIubmFtZSA9PT0gbWF0Y2hlci5sYWJlbCkge1xuXHRcdFx0XHRlbnRyaWVzLnB1c2goeyBsYWJlbDogbWF0Y2hlci5uYW1lLCBtYXRjaGVyOiBtYXRjaGVyIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZW50cmllcy5wdXNoKHtcblx0XHRcdFx0XHRsYWJlbDogbWF0Y2hlci5sYWJlbCxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogYCQke21hdGNoZXIubmFtZX1gLFxuXHRcdFx0XHRcdG1hdGNoZXI6IG1hdGNoZXJcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRlbnRyaWVzID0gZW50cmllcy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRpZiAoYS5sYWJlbCAmJiBiLmxhYmVsKSB7XG5cdFx0XHRcdHJldHVybiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRlbnRyaWVzLnVuc2hpZnQoeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2UuYXNzb2NpYXRlJywgJ2Fzc29jaWF0ZScpIH0pO1xuXHRcdGxldCB0YXNrVHlwZTogc3RyaW5nO1xuXHRcdGlmIChDdXN0b21UYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRjb25zdCBjb25maWdQcm9wZXJ0aWVzOiBUYXNrQ29uZmlnLklDb25maWd1cmF0aW9uUHJvcGVydGllcyA9IHRhc2suX3NvdXJjZS5jb25maWcuZWxlbWVudDtcblx0XHRcdHRhc2tUeXBlID0gKDxhbnk+Y29uZmlnUHJvcGVydGllcykudHlwZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGFza1R5cGUgPSB0YXNrLmdldERlZmluaXRpb24oKS50eXBlO1xuXHRcdH1cblx0XHRlbnRyaWVzLnVuc2hpZnQoXG5cdFx0XHR7IGxhYmVsOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLmF0dGFjaFByb2JsZW1NYXRjaGVyLmNvbnRpbnVlV2l0aG91dCcsICdDb250aW51ZSB3aXRob3V0IHNjYW5uaW5nIHRoZSB0YXNrIG91dHB1dCcpLCBtYXRjaGVyOiB1bmRlZmluZWQgfSxcblx0XHRcdHsgbGFiZWw6IG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2UuYXR0YWNoUHJvYmxlbU1hdGNoZXIubmV2ZXInLCAnTmV2ZXIgc2NhbiB0aGUgdGFzayBvdXRwdXQgZm9yIHRoaXMgdGFzaycpLCBtYXRjaGVyOiB1bmRlZmluZWQsIG5ldmVyOiB0cnVlIH0sXG5cdFx0XHR7IGxhYmVsOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLmF0dGFjaFByb2JsZW1NYXRjaGVyLm5ldmVyVHlwZScsICdOZXZlciBzY2FuIHRoZSB0YXNrIG91dHB1dCBmb3IgezB9IHRhc2tzJywgdGFza1R5cGUpLCBtYXRjaGVyOiB1bmRlZmluZWQsIHNldHRpbmc6IHRhc2tUeXBlIH0sXG5cdFx0XHR7IGxhYmVsOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLmF0dGFjaFByb2JsZW1NYXRjaGVyLmxlYXJuTW9yZUFib3V0JywgJ0xlYXJuIG1vcmUgYWJvdXQgc2Nhbm5pbmcgdGhlIHRhc2sgb3V0cHV0JyksIG1hdGNoZXI6IHVuZGVmaW5lZCwgbGVhcm5Nb3JlOiB0cnVlIH1cblx0XHQpO1xuXHRcdGNvbnN0IHByb2JsZW1NYXRjaGVyID0gYXdhaXQgdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UucGljayhlbnRyaWVzLCB7IHBsYWNlSG9sZGVyOiBubHMubG9jYWxpemUoJ3NlbGVjdFByb2JsZW1NYXRjaGVyJywgJ1NlbGVjdCBmb3Igd2hpY2gga2luZCBvZiBlcnJvcnMgYW5kIHdhcm5pbmdzIHRvIHNjYW4gdGhlIHRhc2sgb3V0cHV0JykgfSk7XG5cdFx0aWYgKCFwcm9ibGVtTWF0Y2hlcikge1xuXHRcdFx0cmV0dXJuIHRhc2s7XG5cdFx0fVxuXHRcdGlmIChwcm9ibGVtTWF0Y2hlci5sZWFybk1vcmUpIHtcblx0XHRcdHRoaXMuX29wZW5Eb2N1bWVudGF0aW9uKCk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAocHJvYmxlbU1hdGNoZXIubmV2ZXIpIHtcblx0XHRcdHRoaXMuY3VzdG9taXplKHRhc2ssIHsgcHJvYmxlbU1hdGNoZXI6IFtdIH0sIHRydWUpO1xuXHRcdFx0cmV0dXJuIHRhc2s7XG5cdFx0fVxuXHRcdGlmIChwcm9ibGVtTWF0Y2hlci5tYXRjaGVyKSB7XG5cdFx0XHRjb25zdCBuZXdUYXNrID0gdGFzay5jbG9uZSgpO1xuXHRcdFx0Y29uc3QgbWF0Y2hlclJlZmVyZW5jZSA9IGAkJHtwcm9ibGVtTWF0Y2hlci5tYXRjaGVyLm5hbWV9YDtcblx0XHRcdGNvbnN0IHByb3BlcnRpZXM6IElDdXN0b21pemF0aW9uUHJvcGVydGllcyA9IHsgcHJvYmxlbU1hdGNoZXI6IFttYXRjaGVyUmVmZXJlbmNlXSB9O1xuXHRcdFx0bmV3VGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlcnMgPSBbbWF0Y2hlclJlZmVyZW5jZV07XG5cdFx0XHRjb25zdCBtYXRjaGVyID0gUHJvYmxlbU1hdGNoZXJSZWdpc3RyeS5nZXQocHJvYmxlbU1hdGNoZXIubWF0Y2hlci5uYW1lKTtcblx0XHRcdGlmIChtYXRjaGVyICYmIG1hdGNoZXIud2F0Y2hpbmcgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRwcm9wZXJ0aWVzLmlzQmFja2dyb3VuZCA9IHRydWU7XG5cdFx0XHRcdG5ld1Rhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuY3VzdG9taXplKHRhc2ssIHByb3BlcnRpZXMsIHRydWUpO1xuXHRcdFx0cmV0dXJuIG5ld1Rhc2s7XG5cdFx0fVxuXHRcdGlmIChwcm9ibGVtTWF0Y2hlci5zZXR0aW5nKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl91cGRhdGVOZXZlclByb2JsZW1NYXRjaGVyU2V0dGluZyhwcm9ibGVtTWF0Y2hlci5zZXR0aW5nKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRhc2s7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRUYXNrc0Zvckdyb3VwKGdyb3VwOiBUYXNrR3JvdXAsIHdhaXRUb0FjdGl2YXRlPzogYm9vbGVhbik6IFByb21pc2U8VGFza1tdPiB7XG5cdFx0Y29uc3QgZ3JvdXBzID0gYXdhaXQgdGhpcy5fZ2V0R3JvdXBlZFRhc2tzKHVuZGVmaW5lZCwgd2FpdFRvQWN0aXZhdGUpO1xuXHRcdGNvbnN0IHJlc3VsdDogVGFza1tdID0gW107XG5cdFx0Z3JvdXBzLmZvckVhY2godGFza3MgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIHRhc2tzKSB7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZ1Rhc2tHcm91cCA9IFRhc2tHcm91cC5mcm9tKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXApO1xuXHRcdFx0XHRpZiAoY29uZmlnVGFza0dyb3VwPy5faWQgPT09IGdyb3VwLl9pZCkge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKHRhc2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBuZWVkc0ZvbGRlclF1YWxpZmljYXRpb24oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRTtcblx0fVxuXG5cdHByaXZhdGUgX2NhbkN1c3RvbWl6ZSh0YXNrOiBUYXNrKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuc2NoZW1hVmVyc2lvbiAhPT0gSnNvblNjaGVtYVZlcnNpb24uVjJfMF8wKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChDdXN0b21UYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKENvbnRyaWJ1dGVkVGFzay5pcyh0YXNrKSkge1xuXHRcdFx0cmV0dXJuICEhdGFzay5nZXRXb3Jrc3BhY2VGb2xkZXIoKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZm9ybWF0VGFza0Zvckpzb24ocmVzb3VyY2U6IFVSSSwgdGFzazogVGFza0NvbmZpZy5JQ3VzdG9tVGFzayB8IFRhc2tDb25maWcuSUNvbmZpZ3VyaW5nVGFzayk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0bGV0IHJlZmVyZW5jZTogSVJlZmVyZW5jZTxJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWw+IHwgdW5kZWZpbmVkO1xuXHRcdGxldCBzdHJpbmdWYWx1ZTogc3RyaW5nID0gJyc7XG5cdFx0dHJ5IHtcblx0XHRcdHJlZmVyZW5jZSA9IGF3YWl0IHRoaXMuX3RleHRNb2RlbFJlc29sdmVyU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShyZXNvdXJjZSk7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHJlZmVyZW5jZS5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXHRcdFx0Y29uc3QgeyB0YWJTaXplLCBpbnNlcnRTcGFjZXMgfSA9IG1vZGVsLmdldE9wdGlvbnMoKTtcblx0XHRcdGNvbnN0IGVvbCA9IG1vZGVsLmdldEVPTCgpO1xuXHRcdFx0bGV0IHN0cmluZ2lmaWVkID0gdG9Gb3JtYXR0ZWRTdHJpbmcodGFzaywgeyBlb2wsIHRhYlNpemUsIGluc2VydFNwYWNlcyB9KTtcblx0XHRcdGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChlb2wgKyAoaW5zZXJ0U3BhY2VzID8gJyAnLnJlcGVhdCh0YWJTaXplKSA6ICdcXFxcdCcpLCAnZycpO1xuXHRcdFx0c3RyaW5naWZpZWQgPSBzdHJpbmdpZmllZC5yZXBsYWNlKHJlZ2V4LCBlb2wgKyAoaW5zZXJ0U3BhY2VzID8gJyAnLnJlcGVhdCh0YWJTaXplICogMykgOiAnXFx0XFx0XFx0JykpO1xuXHRcdFx0Y29uc3QgdHdvVGFicyA9IGluc2VydFNwYWNlcyA/ICcgJy5yZXBlYXQodGFiU2l6ZSAqIDIpIDogJ1xcdFxcdCc7XG5cdFx0XHRzdHJpbmdWYWx1ZSA9IHR3b1RhYnMgKyBzdHJpbmdpZmllZC5zbGljZSgwLCBzdHJpbmdpZmllZC5sZW5ndGggLSAxKSArIHR3b1RhYnMgKyBzdHJpbmdpZmllZC5zbGljZShzdHJpbmdpZmllZC5sZW5ndGggLSAxKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cmVmZXJlbmNlPy5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHJldHVybiBzdHJpbmdWYWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX29wZW5FZGl0b3JBdFRhc2socmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgdGFzazogVGFza0NvbmZpZy5JQ3VzdG9tVGFzayB8IFRhc2tDb25maWcuSUNvbmZpZ3VyaW5nVGFzayB8IHN0cmluZyB8IHVuZGVmaW5lZCwgY29uZmlnSW5kZXg6IG51bWJlciA9IC0xKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKHJlc291cmNlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xuXHRcdH1cblx0XHRjb25zdCBmaWxlQ29udGVudCA9IGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLnJlYWRGaWxlKHJlc291cmNlKTtcblx0XHRjb25zdCBjb250ZW50ID0gZmlsZUNvbnRlbnQudmFsdWU7XG5cdFx0aWYgKCFjb250ZW50IHx8ICF0YXNrKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IGNvbnRlbnRWYWx1ZSA9IGNvbnRlbnQudG9TdHJpbmcoKTtcblx0XHRsZXQgc3RyaW5nVmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoY29uZmlnSW5kZXggIT09IC0xKSB7XG5cdFx0XHRjb25zdCBqc29uOiBUYXNrQ29uZmlnLklFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8VGFza0NvbmZpZy5JRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbj4oJ3Rhc2tzJywgeyByZXNvdXJjZSB9KTtcblx0XHRcdGlmIChqc29uLnRhc2tzICYmIChqc29uLnRhc2tzLmxlbmd0aCA+IGNvbmZpZ0luZGV4KSkge1xuXHRcdFx0XHRzdHJpbmdWYWx1ZSA9IGF3YWl0IHRoaXMuX2Zvcm1hdFRhc2tGb3JKc29uKHJlc291cmNlLCBqc29uLnRhc2tzW2NvbmZpZ0luZGV4XSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICghc3RyaW5nVmFsdWUpIHtcblx0XHRcdGlmICh0eXBlb2YgdGFzayA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0c3RyaW5nVmFsdWUgPSB0YXNrO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3RyaW5nVmFsdWUgPSBhd2FpdCB0aGlzLl9mb3JtYXRUYXNrRm9ySnNvbihyZXNvdXJjZSwgdGFzayk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5kZXggPSBjb250ZW50VmFsdWUuaW5kZXhPZihzdHJpbmdWYWx1ZSk7XG5cdFx0bGV0IHN0YXJ0TGluZU51bWJlciA9IDE7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpbmRleDsgaSsrKSB7XG5cdFx0XHRpZiAoY29udGVudFZhbHVlLmNoYXJBdChpKSA9PT0gJ1xcbicpIHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyKys7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGxldCBlbmRMaW5lTnVtYmVyID0gc3RhcnRMaW5lTnVtYmVyO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaW5nVmFsdWUubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChzdHJpbmdWYWx1ZS5jaGFyQXQoaSkgPT09ICdcXG4nKSB7XG5cdFx0XHRcdGVuZExpbmVOdW1iZXIrKztcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gc3RhcnRMaW5lTnVtYmVyID4gMSA/IHsgc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbjogc3RhcnRMaW5lTnVtYmVyID09PSBlbmRMaW5lTnVtYmVyID8gNCA6IDMsIGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbjogc3RhcnRMaW5lTnVtYmVyID09PSBlbmRMaW5lTnVtYmVyID8gdW5kZWZpbmVkIDogNCB9IDogdW5kZWZpbmVkO1xuXG5cdFx0YXdhaXQgdGhpcy5fZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRwaW5uZWQ6IGZhbHNlLFxuXHRcdFx0XHRmb3JjZVJlbG9hZDogdHJ1ZSwgLy8gYmVjYXVzZSBjb250ZW50IG1pZ2h0IGhhdmUgY2hhbmdlZFxuXHRcdFx0XHRzZWxlY3Rpb24sXG5cdFx0XHRcdHNlbGVjdGlvblJldmVhbFR5cGU6IFRleHRFZGl0b3JTZWxlY3Rpb25SZXZlYWxUeXBlLkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuICEhc2VsZWN0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlQ3VzdG9taXphYmxlVGFzayh0YXNrOiBDb250cmlidXRlZFRhc2sgfCBDdXN0b21UYXNrIHwgQ29uZmlndXJpbmdUYXNrKTogVGFza0NvbmZpZy5JQ3VzdG9tVGFzayB8IFRhc2tDb25maWcuSUNvbmZpZ3VyaW5nVGFzayB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IHRvQ3VzdG9taXplOiBUYXNrQ29uZmlnLklDdXN0b21UYXNrIHwgVGFza0NvbmZpZy5JQ29uZmlndXJpbmdUYXNrIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHRhc2tDb25maWcgPSBDdXN0b21UYXNrLmlzKHRhc2spIHx8IENvbmZpZ3VyaW5nVGFzay5pcyh0YXNrKSA/IHRhc2suX3NvdXJjZS5jb25maWcgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKHRhc2tDb25maWcgJiYgdGFza0NvbmZpZy5lbGVtZW50KSB7XG5cdFx0XHR0b0N1c3RvbWl6ZSA9IHsgLi4uKHRhc2tDb25maWcuZWxlbWVudCkgfTtcblx0XHR9IGVsc2UgaWYgKENvbnRyaWJ1dGVkVGFzay5pcyh0YXNrKSkge1xuXHRcdFx0dG9DdXN0b21pemUgPSB7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgaWRlbnRpZmllcjogVGFza0NvbmZpZy5JVGFza0lkZW50aWZpZXIgPSBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHRhc2suZGVmaW5lcyk7XG5cdFx0XHRkZWxldGUgaWRlbnRpZmllclsnX2tleSddO1xuXHRcdFx0T2JqZWN0LmtleXMoaWRlbnRpZmllcikuZm9yRWFjaChrZXkgPT4gKDxhbnk+dG9DdXN0b21pemUpIVtrZXldID0gaWRlbnRpZmllcltrZXldKTtcblx0XHRcdGlmICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyAmJiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycy5sZW5ndGggPiAwICYmIFR5cGVzLmlzU3RyaW5nQXJyYXkodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlcnMpKSB7XG5cdFx0XHRcdHRvQ3VzdG9taXplLnByb2JsZW1NYXRjaGVyID0gdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlcnM7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCkge1xuXHRcdFx0XHR0b0N1c3RvbWl6ZS5ncm91cCA9IFRhc2tDb25maWcuR3JvdXBLaW5kLnRvKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIXRvQ3VzdG9taXplKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAodG9DdXN0b21pemUucHJvYmxlbU1hdGNoZXIgPT09IHVuZGVmaW5lZCAmJiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyA9PT0gdW5kZWZpbmVkIHx8ICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyAmJiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycy5sZW5ndGggPT09IDApKSB7XG5cdFx0XHR0b0N1c3RvbWl6ZS5wcm9ibGVtTWF0Y2hlciA9IFtdO1xuXHRcdH1cblx0XHRpZiAodGFzay5fc291cmNlLmxhYmVsICE9PSAnV29ya3NwYWNlJykge1xuXHRcdFx0dG9DdXN0b21pemUubGFiZWwgPSB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlkZW50aWZpZXI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRvQ3VzdG9taXplLmxhYmVsID0gdGFzay5fbGFiZWw7XG5cdFx0fVxuXHRcdHRvQ3VzdG9taXplLmRldGFpbCA9IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZGV0YWlsO1xuXHRcdHJldHVybiB0b0N1c3RvbWl6ZTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBjdXN0b21pemUodGFzazogQ29udHJpYnV0ZWRUYXNrIHwgQ3VzdG9tVGFzayB8IENvbmZpZ3VyaW5nVGFzaywgcHJvcGVydGllcz86IElDdXN0b21pemF0aW9uUHJvcGVydGllcywgb3BlbkNvbmZpZz86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIShhd2FpdCB0aGlzLl90cnVzdCgpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHRhc2suZ2V0V29ya3NwYWNlRm9sZGVyKCk7XG5cdFx0aWYgKCF3b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbiA9IHRoaXMuX2dldENvbmZpZ3VyYXRpb24od29ya3NwYWNlRm9sZGVyLCB0YXNrLl9zb3VyY2Uua2luZCk7XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb24uaGFzUGFyc2VFcnJvcnMpIHtcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2Uud2FybihubHMubG9jYWxpemUoJ2N1c3RvbWl6ZVBhcnNlRXJyb3JzJywgJ1RoZSBjdXJyZW50IHRhc2sgY29uZmlndXJhdGlvbiBoYXMgZXJyb3JzLiBQbGVhc2UgZml4IHRoZSBlcnJvcnMgZmlyc3QgYmVmb3JlIGN1c3RvbWl6aW5nIGEgdGFzay4nKSk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlPHZvaWQ+KHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsZUNvbmZpZyA9IGNvbmZpZ3VyYXRpb24uY29uZmlnO1xuXHRcdGNvbnN0IHRvQ3VzdG9taXplID0gdGhpcy5fY3JlYXRlQ3VzdG9taXphYmxlVGFzayh0YXNrKTtcblx0XHRpZiAoIXRvQ3VzdG9taXplKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdGNvbnN0IGluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQgPSBDdXN0b21UYXNrLmlzKHRhc2spID8gdGFzay5fc291cmNlLmNvbmZpZy5pbmRleCA6IHVuZGVmaW5lZDtcblx0XHRpZiAocHJvcGVydGllcykge1xuXHRcdFx0Zm9yIChjb25zdCBwcm9wZXJ0eSBvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhwcm9wZXJ0aWVzKSkge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9ICg8YW55PnByb3BlcnRpZXMpW3Byb3BlcnR5XTtcblx0XHRcdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwpIHtcblx0XHRcdFx0XHQoPGFueT50b0N1c3RvbWl6ZSlbcHJvcGVydHldID0gdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWZpbGVDb25maWcpIHtcblx0XHRcdGNvbnN0IHZhbHVlID0ge1xuXHRcdFx0XHR2ZXJzaW9uOiAnMi4wLjAnLFxuXHRcdFx0XHR0YXNrczogW3RvQ3VzdG9taXplXVxuXHRcdFx0fTtcblx0XHRcdGxldCBjb250ZW50ID0gW1xuXHRcdFx0XHQneycsXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgndGFza3NKc29uQ29tbWVudCcsICdcXHQvLyBTZWUgaHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/TGlua0lkPTczMzU1OCBcXG5cXHQvLyBmb3IgdGhlIGRvY3VtZW50YXRpb24gYWJvdXQgdGhlIHRhc2tzLmpzb24gZm9ybWF0JyksXG5cdFx0XHRdLmpvaW4oJ1xcbicpICsgSlNPTi5zdHJpbmdpZnkodmFsdWUsIG51bGwsICdcXHQnKS5zdWJzdHIoMSk7XG5cdFx0XHRjb25zdCBlZGl0b3JDb25maWcgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxhbnk+KCk7XG5cdFx0XHRpZiAoZWRpdG9yQ29uZmlnLmVkaXRvci5pbnNlcnRTcGFjZXMpIHtcblx0XHRcdFx0Y29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvKFxcbikoXFx0KykvZywgKF8sIHMxLCBzMikgPT4gczEgKyAnICcucmVwZWF0KHMyLmxlbmd0aCAqIGVkaXRvckNvbmZpZy5lZGl0b3IudGFiU2l6ZSkpO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5fdGV4dEZpbGVTZXJ2aWNlLmNyZWF0ZShbeyByZXNvdXJjZTogd29ya3NwYWNlRm9sZGVyLnRvUmVzb3VyY2UoJy52c2NvZGUvdGFza3MuanNvbicpLCB2YWx1ZTogY29udGVudCB9XSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFdlIGhhdmUgYSBnbG9iYWwgdGFzayBjb25maWd1cmF0aW9uXG5cdFx0XHRpZiAoKGluZGV4ID09PSAtMSkgJiYgcHJvcGVydGllcykge1xuXHRcdFx0XHRpZiAocHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0ZmlsZUNvbmZpZy5wcm9ibGVtTWF0Y2hlciA9IHByb3BlcnRpZXMucHJvYmxlbU1hdGNoZXI7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fd3JpdGVDb25maWd1cmF0aW9uKHdvcmtzcGFjZUZvbGRlciwgJ3Rhc2tzLnByb2JsZW1NYXRjaGVycycsIGZpbGVDb25maWcucHJvYmxlbU1hdGNoZXIsIHRhc2suX3NvdXJjZS5raW5kKTtcblx0XHRcdFx0fSBlbHNlIGlmIChwcm9wZXJ0aWVzLmdyb3VwICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRmaWxlQ29uZmlnLmdyb3VwID0gcHJvcGVydGllcy5ncm91cDtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl93cml0ZUNvbmZpZ3VyYXRpb24od29ya3NwYWNlRm9sZGVyLCAndGFza3MuZ3JvdXAnLCBmaWxlQ29uZmlnLmdyb3VwLCB0YXNrLl9zb3VyY2Uua2luZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICghQXJyYXkuaXNBcnJheShmaWxlQ29uZmlnLnRhc2tzKSkge1xuXHRcdFx0XHRcdGZpbGVDb25maWcudGFza3MgPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaW5kZXggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGZpbGVDb25maWcudGFza3MucHVzaCh0b0N1c3RvbWl6ZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZmlsZUNvbmZpZy50YXNrc1tpbmRleF0gPSB0b0N1c3RvbWl6ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhd2FpdCB0aGlzLl93cml0ZUNvbmZpZ3VyYXRpb24od29ya3NwYWNlRm9sZGVyLCAndGFza3MudGFza3MnLCBmaWxlQ29uZmlnLnRhc2tzLCB0YXNrLl9zb3VyY2Uua2luZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKG9wZW5Db25maWcpIHtcblx0XHRcdHRoaXMuX29wZW5FZGl0b3JBdFRhc2sodGhpcy5fZ2V0UmVzb3VyY2VGb3JUYXNrKHRhc2spLCB0b0N1c3RvbWl6ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfd3JpdGVDb25maWd1cmF0aW9uKHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciwga2V5OiBzdHJpbmcsIHZhbHVlOiBhbnksIHNvdXJjZT86IHN0cmluZyk6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQge1xuXHRcdGxldCB0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0c3dpdGNoIChzb3VyY2UpIHtcblx0XHRcdGNhc2UgVGFza1NvdXJjZUtpbmQuVXNlcjogdGFyZ2V0ID0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSOyBicmVhaztcblx0XHRcdGNhc2UgVGFza1NvdXJjZUtpbmQuV29ya3NwYWNlRmlsZTogdGFyZ2V0ID0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0U7IGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDogaWYgKHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkZPTERFUikge1xuXHRcdFx0XHR0YXJnZXQgPSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5fY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFKSB7XG5cdFx0XHRcdHRhcmdldCA9IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUjtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHRhcmdldCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGtleSwgdmFsdWUsIHsgcmVzb3VyY2U6IHdvcmtzcGFjZUZvbGRlci51cmkgfSwgdGFyZ2V0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRSZXNvdXJjZUZvcktpbmQoa2luZDogc3RyaW5nKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0XHR0aGlzLl91cGRhdGVTZXR1cCgpO1xuXHRcdHN3aXRjaCAoa2luZCkge1xuXHRcdFx0Y2FzZSBUYXNrU291cmNlS2luZC5Vc2VyOiB7XG5cdFx0XHRcdHJldHVybiByZXNvdXJjZXMuam9pblBhdGgocmVzb3VyY2VzLmRpcm5hbWUodGhpcy5fcHJlZmVyZW5jZXNTZXJ2aWNlLnVzZXJTZXR0aW5nc1Jlc291cmNlKSwgJ3Rhc2tzLmpzb24nKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgVGFza1NvdXJjZUtpbmQuV29ya3NwYWNlRmlsZToge1xuXHRcdFx0XHRpZiAodGhpcy5fd29ya3NwYWNlICYmIHRoaXMuX3dvcmtzcGFjZS5jb25maWd1cmF0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX3dvcmtzcGFjZS5jb25maWd1cmF0aW9uO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0UmVzb3VyY2VGb3JUYXNrKHRhc2s6IEN1c3RvbVRhc2sgfCBDb25maWd1cmluZ1Rhc2sgfCBDb250cmlidXRlZFRhc2spOiBVUkkge1xuXHRcdGlmIChDdXN0b21UYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRsZXQgdXJpID0gdGhpcy5fZ2V0UmVzb3VyY2VGb3JLaW5kKHRhc2suX3NvdXJjZS5raW5kKTtcblx0XHRcdGlmICghdXJpKSB7XG5cdFx0XHRcdGNvbnN0IHRhc2tGb2xkZXIgPSB0YXNrLmdldFdvcmtzcGFjZUZvbGRlcigpO1xuXHRcdFx0XHRpZiAodGFza0ZvbGRlcikge1xuXHRcdFx0XHRcdHVyaSA9IHRhc2tGb2xkZXIudG9SZXNvdXJjZSh0YXNrLl9zb3VyY2UuY29uZmlnLmZpbGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHVyaSA9IHRoaXMud29ya3NwYWNlRm9sZGVyc1swXS51cmk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB1cmk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0YXNrLmdldFdvcmtzcGFjZUZvbGRlcigpIS50b1Jlc291cmNlKCcudnNjb2RlL3Rhc2tzLmpzb24nKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgb3BlbkNvbmZpZyh0YXNrOiBDdXN0b21UYXNrIHwgQ29uZmlndXJpbmdUYXNrIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0bGV0IHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHRhc2spIHtcblx0XHRcdHJlc291cmNlID0gdGhpcy5fZ2V0UmVzb3VyY2VGb3JUYXNrKHRhc2spO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXNvdXJjZSA9ICh0aGlzLl93b3Jrc3BhY2VGb2xkZXJzICYmICh0aGlzLl93b3Jrc3BhY2VGb2xkZXJzLmxlbmd0aCA+IDApKSA/IHRoaXMuX3dvcmtzcGFjZUZvbGRlcnNbMF0udG9SZXNvdXJjZSgnLnZzY29kZS90YXNrcy5qc29uJykgOiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9vcGVuRWRpdG9yQXRUYXNrKHJlc291cmNlLCB0YXNrID8gdGFzay5fbGFiZWwgOiB1bmRlZmluZWQsIHRhc2sgPyB0YXNrLl9zb3VyY2UuY29uZmlnLmluZGV4IDogLTEpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlUnVubmFibGVUYXNrKHRhc2tzOiBUYXNrTWFwLCBncm91cDogVGFza0dyb3VwKTogeyB0YXNrOiBUYXNrOyByZXNvbHZlcjogSVRhc2tSZXNvbHZlciB9IHwgdW5kZWZpbmVkIHtcblx0XHRpbnRlcmZhY2UgSVJlc29sdmVyRGF0YSB7XG5cdFx0XHRpZDogTWFwPHN0cmluZywgVGFzaz47XG5cdFx0XHRsYWJlbDogTWFwPHN0cmluZywgVGFzaz47XG5cdFx0XHRpZGVudGlmaWVyOiBNYXA8c3RyaW5nLCBUYXNrPjtcblx0XHR9XG5cblx0XHRjb25zdCByZXNvbHZlckRhdGE6IE1hcDxzdHJpbmcsIElSZXNvbHZlckRhdGE+ID0gbmV3IE1hcCgpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZVRhc2tzOiBUYXNrW10gPSBbXTtcblx0XHRjb25zdCBleHRlbnNpb25UYXNrczogVGFza1tdID0gW107XG5cdFx0dGFza3MuZm9yRWFjaCgodGFza3MsIGZvbGRlcikgPT4ge1xuXHRcdFx0bGV0IGRhdGEgPSByZXNvbHZlckRhdGEuZ2V0KGZvbGRlcik7XG5cdFx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdFx0ZGF0YSA9IHtcblx0XHRcdFx0XHRpZDogbmV3IE1hcDxzdHJpbmcsIFRhc2s+KCksXG5cdFx0XHRcdFx0bGFiZWw6IG5ldyBNYXA8c3RyaW5nLCBUYXNrPigpLFxuXHRcdFx0XHRcdGlkZW50aWZpZXI6IG5ldyBNYXA8c3RyaW5nLCBUYXNrPigpXG5cdFx0XHRcdH07XG5cdFx0XHRcdHJlc29sdmVyRGF0YS5zZXQoZm9sZGVyLCBkYXRhKTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0XHRkYXRhLmlkLnNldCh0YXNrLl9pZCwgdGFzayk7XG5cdFx0XHRcdGRhdGEubGFiZWwuc2V0KHRhc2suX2xhYmVsLCB0YXNrKTtcblx0XHRcdFx0aWYgKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWRlbnRpZmllcikge1xuXHRcdFx0XHRcdGRhdGEuaWRlbnRpZmllci5zZXQodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pZGVudGlmaWVyLCB0YXNrKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZ3JvdXAgJiYgdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCA9PT0gZ3JvdXApIHtcblx0XHRcdFx0XHRpZiAodGFzay5fc291cmNlLmtpbmQgPT09IFRhc2tTb3VyY2VLaW5kLldvcmtzcGFjZSkge1xuXHRcdFx0XHRcdFx0d29ya3NwYWNlVGFza3MucHVzaCh0YXNrKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZXh0ZW5zaW9uVGFza3MucHVzaCh0YXNrKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRjb25zdCByZXNvbHZlcjogSVRhc2tSZXNvbHZlciA9IHtcblx0XHRcdHJlc29sdmU6IGFzeW5jICh1cmk6IFVSSSB8IHN0cmluZywgYWxpYXM6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBkYXRhID0gcmVzb2x2ZXJEYXRhLmdldCh0eXBlb2YgdXJpID09PSAnc3RyaW5nJyA/IHVyaSA6IHVyaS50b1N0cmluZygpKTtcblx0XHRcdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZGF0YS5pZC5nZXQoYWxpYXMpIHx8IGRhdGEubGFiZWwuZ2V0KGFsaWFzKSB8fCBkYXRhLmlkZW50aWZpZXIuZ2V0KGFsaWFzKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGlmICh3b3Jrc3BhY2VUYXNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRpZiAod29ya3NwYWNlVGFza3MubGVuZ3RoID4gMSkge1xuXHRcdFx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKCdtb3JlVGhhbk9uZUJ1aWxkVGFzaycsICdUaGVyZSBhcmUgbWFueSBidWlsZCB0YXNrcyBkZWZpbmVkIGluIHRoZSB0YXNrcy5qc29uLiBFeGVjdXRpbmcgdGhlIGZpcnN0IG9uZS4nKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4geyB0YXNrOiB3b3Jrc3BhY2VUYXNrc1swXSwgcmVzb2x2ZXIgfTtcblx0XHR9XG5cdFx0aWYgKGV4dGVuc2lvblRhc2tzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBXZSBjYW4gb25seSBoYXZlIGV4dGVuc2lvbiB0YXNrcyBpZiB3ZSBhcmUgaW4gdmVyc2lvbiAyLjAuMC4gVGhlbiB3ZSBjYW4gZXZlbiBydW5cblx0XHQvLyBtdWx0aXBsZSBidWlsZCB0YXNrcy5cblx0XHRpZiAoZXh0ZW5zaW9uVGFza3MubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4geyB0YXNrOiBleHRlbnNpb25UYXNrc1swXSwgcmVzb2x2ZXIgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgaWQ6IHN0cmluZyA9IFVVSUQuZ2VuZXJhdGVVdWlkKCk7XG5cdFx0XHRjb25zdCB0YXNrOiBJbk1lbW9yeVRhc2sgPSBuZXcgSW5NZW1vcnlUYXNrKFxuXHRcdFx0XHRpZCxcblx0XHRcdFx0eyBraW5kOiBUYXNrU291cmNlS2luZC5Jbk1lbW9yeSwgbGFiZWw6ICdpbk1lbW9yeScgfSxcblx0XHRcdFx0aWQsXG5cdFx0XHRcdCdpbk1lbW9yeScsXG5cdFx0XHRcdHsgcmVldmFsdWF0ZU9uUmVydW46IHRydWUgfSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkZW50aWZpZXI6IGlkLFxuXHRcdFx0XHRcdGRlcGVuZHNPbjogZXh0ZW5zaW9uVGFza3MubWFwKChleHRlbnNpb25UYXNrKSA9PiB7IHJldHVybiB7IHVyaTogZXh0ZW5zaW9uVGFzay5nZXRXb3Jrc3BhY2VGb2xkZXIoKSEudXJpLCB0YXNrOiBleHRlbnNpb25UYXNrLl9pZCB9OyB9KSxcblx0XHRcdFx0XHRuYW1lOiBpZFxuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdFx0cmV0dXJuIHsgdGFzaywgcmVzb2x2ZXIgfTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVSZXNvbHZlcihncm91cGVkPzogVGFza01hcCk6IElUYXNrUmVzb2x2ZXIge1xuXHRcdGludGVyZmFjZSBSZXNvbHZlckRhdGEge1xuXHRcdFx0bGFiZWw6IE1hcDxzdHJpbmcsIFRhc2s+O1xuXHRcdFx0aWRlbnRpZmllcjogTWFwPHN0cmluZywgVGFzaz47XG5cdFx0XHR0YXNrSWRlbnRpZmllcjogTWFwPHN0cmluZywgVGFzaz47XG5cdFx0fVxuXG5cdFx0bGV0IHJlc29sdmVyRGF0YTogTWFwPHN0cmluZywgUmVzb2x2ZXJEYXRhPiB8IHVuZGVmaW5lZDtcblxuXHRcdGFzeW5jIGZ1bmN0aW9uIHF1aWNrUmVzb2x2ZSh0aGF0OiBBYnN0cmFjdFRhc2tTZXJ2aWNlLCB1cmk6IFVSSSB8IHN0cmluZywgaWRlbnRpZmllcjogc3RyaW5nIHwgSVRhc2tJZGVudGlmaWVyKSB7XG5cdFx0XHRjb25zdCBmb3VuZFRhc2tzID0gYXdhaXQgdGhhdC5fZmluZFdvcmtzcGFjZVRhc2tzKCh0YXNrOiBUYXNrIHwgQ29uZmlndXJpbmdUYXNrKTogYm9vbGVhbiA9PiB7XG5cdFx0XHRcdGNvbnN0IHRhc2tVcmkgPSAoKENvbmZpZ3VyaW5nVGFzay5pcyh0YXNrKSB8fCBDdXN0b21UYXNrLmlzKHRhc2spKSA/IHRhc2suX3NvdXJjZS5jb25maWcud29ya3NwYWNlRm9sZGVyPy51cmkgOiB1bmRlZmluZWQpO1xuXHRcdFx0XHRjb25zdCBvcmlnaW5hbFVyaSA9ICh0eXBlb2YgdXJpID09PSAnc3RyaW5nJyA/IHVyaSA6IHVyaS50b1N0cmluZygpKTtcblx0XHRcdFx0aWYgKHRhc2tVcmk/LnRvU3RyaW5nKCkgIT09IG9yaWdpbmFsVXJpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyhpZGVudGlmaWVyKSkge1xuXHRcdFx0XHRcdHJldHVybiAoKHRhc2suX2xhYmVsID09PSBpZGVudGlmaWVyKSB8fCAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pZGVudGlmaWVyID09PSBpZGVudGlmaWVyKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3Qga2V5ZWRJZGVudGlmaWVyID0gdGFzay5nZXREZWZpbml0aW9uKHRydWUpO1xuXHRcdFx0XHRcdGNvbnN0IHNlYXJjaElkZW50aWZpZXIgPSBUYXNrRGVmaW5pdGlvbi5jcmVhdGVUYXNrSWRlbnRpZmllcihpZGVudGlmaWVyLCBjb25zb2xlKTtcblx0XHRcdFx0XHRyZXR1cm4gKHNlYXJjaElkZW50aWZpZXIgJiYga2V5ZWRJZGVudGlmaWVyKSA/IChzZWFyY2hJZGVudGlmaWVyLl9rZXkgPT09IGtleWVkSWRlbnRpZmllci5fa2V5KSA6IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGlmIChmb3VuZFRhc2tzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdGFzayA9IGZvdW5kVGFza3NbMF07XG5cdFx0XHRpZiAoQ29uZmlndXJpbmdUYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRcdHJldHVybiB0aGF0LnRyeVJlc29sdmVUYXNrKHRhc2spO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRhc2s7XG5cdFx0fVxuXG5cdFx0YXN5bmMgZnVuY3Rpb24gZ2V0UmVzb2x2ZXJEYXRhKHRoYXQ6IEFic3RyYWN0VGFza1NlcnZpY2UpIHtcblx0XHRcdGlmIChyZXNvbHZlckRhdGEgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXNvbHZlckRhdGEgPSBuZXcgTWFwKCk7XG5cdFx0XHRcdChncm91cGVkIHx8IGF3YWl0IHRoYXQuX2dldEdyb3VwZWRUYXNrcygpKS5mb3JFYWNoKCh0YXNrcywgZm9sZGVyKSA9PiB7XG5cdFx0XHRcdFx0bGV0IGRhdGEgPSByZXNvbHZlckRhdGEhLmdldChmb2xkZXIpO1xuXHRcdFx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRcdFx0ZGF0YSA9IHsgbGFiZWw6IG5ldyBNYXA8c3RyaW5nLCBUYXNrPigpLCBpZGVudGlmaWVyOiBuZXcgTWFwPHN0cmluZywgVGFzaz4oKSwgdGFza0lkZW50aWZpZXI6IG5ldyBNYXA8c3RyaW5nLCBUYXNrPigpIH07XG5cdFx0XHRcdFx0XHRyZXNvbHZlckRhdGEhLnNldChmb2xkZXIsIGRhdGEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgdGFza3MpIHtcblx0XHRcdFx0XHRcdGRhdGEubGFiZWwuc2V0KHRhc2suX2xhYmVsLCB0YXNrKTtcblx0XHRcdFx0XHRcdGlmICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlkZW50aWZpZXIpIHtcblx0XHRcdFx0XHRcdFx0ZGF0YS5pZGVudGlmaWVyLnNldCh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlkZW50aWZpZXIsIHRhc2spO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29uc3Qga2V5ZWRJZGVudGlmaWVyID0gdGFzay5nZXREZWZpbml0aW9uKHRydWUpO1xuXHRcdFx0XHRcdFx0aWYgKGtleWVkSWRlbnRpZmllciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRcdGRhdGEudGFza0lkZW50aWZpZXIuc2V0KGtleWVkSWRlbnRpZmllci5fa2V5LCB0YXNrKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc29sdmVyRGF0YTtcblx0XHR9XG5cblx0XHRhc3luYyBmdW5jdGlvbiBmdWxsUmVzb2x2ZSh0aGF0OiBBYnN0cmFjdFRhc2tTZXJ2aWNlLCB1cmk6IFVSSSB8IHN0cmluZywgaWRlbnRpZmllcjogc3RyaW5nIHwgSVRhc2tJZGVudGlmaWVyKSB7XG5cdFx0XHRjb25zdCBhbGxSZXNvbHZlckRhdGEgPSBhd2FpdCBnZXRSZXNvbHZlckRhdGEodGhhdCk7XG5cdFx0XHRjb25zdCBkYXRhID0gYWxsUmVzb2x2ZXJEYXRhLmdldCh0eXBlb2YgdXJpID09PSAnc3RyaW5nJyA/IHVyaSA6IHVyaS50b1N0cmluZygpKTtcblx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0aWYgKFR5cGVzLmlzU3RyaW5nKGlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdHJldHVybiBkYXRhLmxhYmVsLmdldChpZGVudGlmaWVyKSB8fCBkYXRhLmlkZW50aWZpZXIuZ2V0KGlkZW50aWZpZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3Qga2V5ID0gVGFza0RlZmluaXRpb24uY3JlYXRlVGFza0lkZW50aWZpZXIoaWRlbnRpZmllciwgY29uc29sZSk7XG5cdFx0XHRcdHJldHVybiBrZXkgIT09IHVuZGVmaW5lZCA/IGRhdGEudGFza0lkZW50aWZpZXIuZ2V0KGtleS5fa2V5KSA6IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzb2x2ZTogYXN5bmMgKHVyaTogVVJJIHwgc3RyaW5nLCBpZGVudGlmaWVyOiBzdHJpbmcgfCBJVGFza0lkZW50aWZpZXIgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdFx0aWYgKCFpZGVudGlmaWVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoKHJlc29sdmVyRGF0YSA9PT0gdW5kZWZpbmVkKSAmJiAoZ3JvdXBlZCA9PT0gdW5kZWZpbmVkKSkge1xuXHRcdFx0XHRcdHJldHVybiAoYXdhaXQgcXVpY2tSZXNvbHZlKHRoaXMsIHVyaSwgaWRlbnRpZmllcikpID8/IGZ1bGxSZXNvbHZlKHRoaXMsIHVyaSwgaWRlbnRpZmllcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZ1bGxSZXNvbHZlKHRoaXMsIHVyaSwgaWRlbnRpZmllcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc2F2ZUJlZm9yZVJ1bigpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRlbnVtIFNhdmVCZWZvcmVSdW5Db25maWdPcHRpb25zIHtcblx0XHRcdEFsd2F5cyA9ICdhbHdheXMnLFxuXHRcdFx0TmV2ZXIgPSAnbmV2ZXInLFxuXHRcdFx0UHJvbXB0ID0gJ3Byb21wdCdcblx0XHR9XG5cblx0XHRjb25zdCBzYXZlQmVmb3JlUnVuVGFza0NvbmZpZzogU2F2ZUJlZm9yZVJ1bkNvbmZpZ09wdGlvbnMgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUYXNrU2V0dGluZ0lkLlNhdmVCZWZvcmVSdW4pO1xuXG5cdFx0aWYgKHNhdmVCZWZvcmVSdW5UYXNrQ29uZmlnID09PSBTYXZlQmVmb3JlUnVuQ29uZmlnT3B0aW9ucy5OZXZlcikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gZWxzZSBpZiAoc2F2ZUJlZm9yZVJ1blRhc2tDb25maWcgPT09IFNhdmVCZWZvcmVSdW5Db25maWdPcHRpb25zLlByb21wdCAmJiB0aGlzLl9lZGl0b3JTZXJ2aWNlLmVkaXRvcnMuc29tZShlID0+IGUuaXNEaXJ0eSgpKSkge1xuXHRcdFx0Y29uc3QgeyBjb25maXJtZWQgfSA9IGF3YWl0IHRoaXMuX2RpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnVGFza1N5c3RlbS5zYXZlQmVmb3JlUnVuLnByb21wdC50aXRsZScsIFwiU2F2ZSBhbGwgZWRpdG9ycz9cIiksXG5cdFx0XHRcdGRldGFpbDogbmxzLmxvY2FsaXplKCdkZXRhaWwnLCBcIkRvIHlvdSB3YW50IHRvIHNhdmUgYWxsIGVkaXRvcnMgYmVmb3JlIHJ1bm5pbmcgdGhlIHRhc2s/XCIpLFxuXHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBubHMubG9jYWxpemUoeyBrZXk6ICdzYXZlQmVmb3JlUnVuLnNhdmUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sICcmJlNhdmUnKSxcblx0XHRcdFx0Y2FuY2VsQnV0dG9uOiBubHMubG9jYWxpemUoeyBrZXk6ICdzYXZlQmVmb3JlUnVuLmRvbnRTYXZlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkRvJiZuJ3QgU2F2ZVwiKSxcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIWNvbmZpcm1lZCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuX2VkaXRvclNlcnZpY2Uuc2F2ZUFsbCh7IHJlYXNvbjogU2F2ZVJlYXNvbi5BVVRPIH0pO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZXhlY3V0ZVRhc2sodGFzazogVGFzaywgcmVzb2x2ZXI6IElUYXNrUmVzb2x2ZXIsIHJ1blNvdXJjZTogVGFza1J1blNvdXJjZSk6IFByb21pc2U8SVRhc2tTdW1tYXJ5PiB7XG5cdFx0bGV0IHRhc2tUb1J1bjogVGFzayA9IHRhc2s7XG5cdFx0aWYgKGF3YWl0IHRoaXMuX3NhdmVCZWZvcmVSdW4oKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UucmVsb2FkQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0YXdhaXQgdGhpcy5fdXBkYXRlV29ya3NwYWNlVGFza3MoKTtcblx0XHRcdGNvbnN0IHRhc2tGb2xkZXIgPSB0YXNrLmdldFdvcmtzcGFjZUZvbGRlcigpO1xuXHRcdFx0Y29uc3QgdGFza0lkZW50aWZpZXIgPSB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlkZW50aWZpZXI7XG5cdFx0XHRjb25zdCB0YXNrVHlwZSA9IEN1c3RvbVRhc2suaXModGFzaykgPyB0YXNrLmN1c3RvbWl6ZXMoKT8udHlwZSA6IChDb250cmlidXRlZFRhc2suaXModGFzaykgPyB0YXNrLnR5cGUgOiB1bmRlZmluZWQpO1xuXHRcdFx0Ly8gU2luY2Ugd2Ugc2F2ZSBiZWZvcmUgcnVubmluZyB0YXNrcywgdGhlIHRhc2sgbWF5IGhhdmUgY2hhbmdlZCBhcyBwYXJ0IG9mIHRoZSBzYXZlLlxuXHRcdFx0Ly8gSG93ZXZlciwgaWYgdGhlIFRhc2tSdW5Tb3VyY2UgaXMgbm90IFVzZXIsIHRoZW4gd2Ugc2hvdWxkbid0IHRyeSB0byBmZXRjaCB0aGUgdGFzayBhZ2FpblxuXHRcdFx0Ly8gc2luY2UgdGhpcyBjYW4gY2F1c2UgYSBuZXcnZCB0YXNrIHRvIGdldCBvdmVyd3JpdHRlbiB3aXRoIGEgcHJvdmlkZWQgdGFzay5cblx0XHRcdHRhc2tUb1J1biA9ICgodGFza0ZvbGRlciAmJiB0YXNrSWRlbnRpZmllciAmJiAocnVuU291cmNlID09PSBUYXNrUnVuU291cmNlLlVzZXIpKVxuXHRcdFx0XHQ/IGF3YWl0IHRoaXMuZ2V0VGFzayh0YXNrRm9sZGVyLCB0YXNrSWRlbnRpZmllciwgZmFsc2UsIHRhc2tUeXBlKSA6IHRhc2spID8/IHRhc2s7XG5cdFx0fVxuXHRcdGF3YWl0IFByb2JsZW1NYXRjaGVyUmVnaXN0cnkub25SZWFkeSgpO1xuXHRcdGNvbnN0IGV4ZWN1dGVSZXN1bHQgPSBydW5Tb3VyY2UgPT09IFRhc2tSdW5Tb3VyY2UuUmVjb25uZWN0ID8gdGhpcy5fZ2V0VGFza1N5c3RlbSgpLnJlY29ubmVjdCh0YXNrVG9SdW4sIHJlc29sdmVyKSA6IHRoaXMuX2dldFRhc2tTeXN0ZW0oKS5ydW4odGFza1RvUnVuLCByZXNvbHZlcik7XG5cdFx0aWYgKGV4ZWN1dGVSZXN1bHQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9oYW5kbGVFeGVjdXRlUmVzdWx0KGV4ZWN1dGVSZXN1bHQsIHJ1blNvdXJjZSk7XG5cdFx0fVxuXHRcdHJldHVybiB7IGV4aXRDb2RlOiAwIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9oYW5kbGVFeGVjdXRlUmVzdWx0KGV4ZWN1dGVSZXN1bHQ6IElUYXNrRXhlY3V0ZVJlc3VsdCwgcnVuU291cmNlPzogVGFza1J1blNvdXJjZSk6IFByb21pc2U8SVRhc2tTdW1tYXJ5PiB7XG5cdFx0aWYgKHJ1blNvdXJjZSA9PT0gVGFza1J1blNvdXJjZS5Vc2VyKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9zZXRSZWNlbnRseVVzZWRUYXNrKGV4ZWN1dGVSZXN1bHQudGFzayk7XG5cdFx0fVxuXHRcdGlmIChleGVjdXRlUmVzdWx0LmtpbmQgPT09IFRhc2tFeGVjdXRlS2luZC5BY3RpdmUpIHtcblx0XHRcdGNvbnN0IGFjdGl2ZSA9IGV4ZWN1dGVSZXN1bHQuYWN0aXZlO1xuXHRcdFx0aWYgKGFjdGl2ZSAmJiBhY3RpdmUuc2FtZSAmJiBydW5Tb3VyY2UgPT09IFRhc2tSdW5Tb3VyY2UuRm9sZGVyT3BlbiB8fCBydW5Tb3VyY2UgPT09IFRhc2tSdW5Tb3VyY2UuUmVjb25uZWN0KSB7XG5cdFx0XHRcdC8vIGlnbm9yZSwgdGhlIHRhc2sgaXMgYWxyZWFkeSBhY3RpdmUsIGxpa2VseSBmcm9tIGJlaW5nIHJlY29ubmVjdGVkIG9yIGZyb20gZm9sZGVyIG9wZW4uXG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoJ0lnbm9yaW5nIHRhc2sgdGhhdCBpcyBhbHJlYWR5IGFjdGl2ZScsIGV4ZWN1dGVSZXN1bHQudGFzayk7XG5cdFx0XHRcdHJldHVybiBleGVjdXRlUmVzdWx0LnByb21pc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYWN0aXZlICYmIGFjdGl2ZS5zYW1lKSB7XG5cdFx0XHRcdGlmICh0aGlzLl90YXNrU3lzdGVtPy5pc1Rhc2tWaXNpYmxlKGV4ZWN1dGVSZXN1bHQudGFzaykpIHtcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdUYXNrU3lzdGVtLmFjdGl2ZVNhbWUubm9CYWNrZ3JvdW5kJywgJ1RoZSB0YXNrIFxcJ3swfVxcJyBpcyBhbHJlYWR5IGFjdGl2ZS4nLCBleGVjdXRlUmVzdWx0LnRhc2suZ2V0UXVhbGlmaWVkTGFiZWwoKSk7XG5cdFx0XHRcdFx0Y29uc3QgbGFzdEluc3RhbmNlID0gdGhpcy5fZ2V0VGFza1N5c3RlbSgpLmdldExhc3RJbnN0YW5jZShleGVjdXRlUmVzdWx0LnRhc2spID8/IGV4ZWN1dGVSZXN1bHQudGFzaztcblx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChTZXZlcml0eS5XYXJuaW5nLCBtZXNzYWdlLFxuXHRcdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgndGVybWluYXRlVGFzaycsIFwiVGVybWluYXRlIFRhc2tcIiksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy50ZXJtaW5hdGUobGFzdEluc3RhbmNlKVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncmVzdGFydFRhc2snLCBcIlJlc3RhcnQgVGFza1wiKSxcblx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9yZXN0YXJ0KGxhc3RJbnN0YW5jZSlcblx0XHRcdFx0XHRcdH1dLFxuXHRcdFx0XHRcdFx0eyBzdGlja3k6IHRydWUgfVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fdGFza1N5c3RlbT8ucmV2ZWFsVGFzayhleGVjdXRlUmVzdWx0LnRhc2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBuZXcgVGFza0Vycm9yKFNldmVyaXR5Lldhcm5pbmcsIG5scy5sb2NhbGl6ZSgnVGFza1N5c3RlbS5hY3RpdmUnLCAnVGhlcmUgaXMgYWxyZWFkeSBhIHRhc2sgcnVubmluZy4gVGVybWluYXRlIGl0IGZpcnN0IGJlZm9yZSBleGVjdXRpbmcgYW5vdGhlciB0YXNrLicpLCBUYXNrRXJyb3JzLlJ1bm5pbmdUYXNrKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fc2V0UmVjZW50bHlVc2VkVGFzayhleGVjdXRlUmVzdWx0LnRhc2spO1xuXHRcdHJldHVybiBleGVjdXRlUmVzdWx0LnByb21pc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXN0YXJ0KHRhc2s6IFRhc2spOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX3Rhc2tTeXN0ZW0pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLl90YXNrU3lzdGVtLnRlcm1pbmF0ZSh0YXNrKTtcblx0XHRpZiAocmVzcG9uc2Uuc3VjY2Vzcykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5ydW4odGFzayk7XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0Ly8gZWF0IHRoZSBlcnJvciwgd2UgZG9uJ3QgY2FyZSBhYm91dCBpdCBoZXJlXG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2Uud2FybihubHMubG9jYWxpemUoJ1Rhc2tTeXN0ZW0ucmVzdGFydEZhaWxlZCcsICdGYWlsZWQgdG8gdGVybWluYXRlIGFuZCByZXN0YXJ0IHRhc2sgezB9JywgVHlwZXMuaXNTdHJpbmcodGFzaykgPyB0YXNrIDogdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lKSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jIHRlcm1pbmF0ZSh0YXNrOiBUYXNrKTogUHJvbWlzZTxJVGFza1Rlcm1pbmF0ZVJlc3BvbnNlPiB7XG5cdFx0aWYgKCEoYXdhaXQgdGhpcy5fdHJ1c3QoKSkpIHtcblx0XHRcdHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIHRhc2s6IHVuZGVmaW5lZCB9O1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fdGFza1N5c3RlbSkge1xuXHRcdFx0cmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgdGFzazogdW5kZWZpbmVkIH07XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90YXNrU3lzdGVtLnRlcm1pbmF0ZSh0YXNrKTtcblx0fVxuXG5cdHByaXZhdGUgX3Rlcm1pbmF0ZUFsbCgpOiBQcm9taXNlPElUYXNrVGVybWluYXRlUmVzcG9uc2VbXT4ge1xuXHRcdGlmICghdGhpcy5fdGFza1N5c3RlbSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZTxJVGFza1Rlcm1pbmF0ZVJlc3BvbnNlW10+KFtdKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Rhc2tTeXN0ZW0udGVybWluYXRlQWxsKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2NyZWF0ZVRlcm1pbmFsVGFza1N5c3RlbSgpOiBJVGFza1N5c3RlbSB7XG5cdFx0cmV0dXJuIG5ldyBUZXJtaW5hbFRhc2tTeXN0ZW0oXG5cdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2UsIHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLCB0aGlzLl9vdXRwdXRTZXJ2aWNlLCB0aGlzLl9wYW5lQ29tcG9zaXRlU2VydmljZSwgdGhpcy5fdmlld3NTZXJ2aWNlLCB0aGlzLl9tYXJrZXJTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fbW9kZWxTZXJ2aWNlLCB0aGlzLl9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fY29udGV4dFNlcnZpY2UsIHRoaXMuX2Vudmlyb25tZW50U2VydmljZSxcblx0XHRcdEFic3RyYWN0VGFza1NlcnZpY2UuT3V0cHV0Q2hhbm5lbElkLCB0aGlzLl9maWxlU2VydmljZSwgdGhpcy5fdGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdFx0dGhpcy5fcGF0aFNlcnZpY2UsIHRoaXMuX3ZpZXdEZXNjcmlwdG9yU2VydmljZSwgdGhpcy5fbG9nU2VydmljZSwgdGhpcy5fbm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdCh3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdFx0aWYgKHdvcmtzcGFjZUZvbGRlcikge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9nZXRUYXNrU3lzdGVtSW5mbyh3b3Jrc3BhY2VGb2xkZXIudXJpLnNjaGVtZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5fdGFza1N5c3RlbUluZm9zLnNpemUgPiAwKSB7XG5cdFx0XHRcdFx0Y29uc3QgaW5mb3MgPSBBcnJheS5mcm9tKHRoaXMuX3Rhc2tTeXN0ZW1JbmZvcy5lbnRyaWVzKCkpO1xuXHRcdFx0XHRcdGNvbnN0IG5vdEZpbGUgPSBpbmZvcy5maWx0ZXIoaW5mbyA9PiBpbmZvWzBdICE9PSBTY2hlbWFzLmZpbGUpO1xuXHRcdFx0XHRcdGlmIChub3RGaWxlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdHJldHVybiBub3RGaWxlWzBdWzFdWzBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gaW5mb3NbMF1bMV1bMF07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2dldFRhc2tTeXN0ZW0oKTogSVRhc2tTeXN0ZW07XG5cblx0cHJpdmF0ZSBfaXNUYXNrUHJvdmlkZXJFbmFibGVkKHR5cGU6IHN0cmluZykge1xuXHRcdGNvbnN0IGRlZmluaXRpb24gPSBUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5LmdldCh0eXBlKTtcblx0XHRyZXR1cm4gIWRlZmluaXRpb24gfHwgIWRlZmluaXRpb24ud2hlbiB8fCB0aGlzLl9jb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKGRlZmluaXRpb24ud2hlbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRHcm91cGVkVGFza3MoZmlsdGVyPzogSVRhc2tGaWx0ZXIsIHdhaXRUb0FjdGl2YXRlPzogYm9vbGVhbiwga25vd25Pbmx5T3JUcnVzdGVkPzogYm9vbGVhbik6IFByb21pc2U8VGFza01hcD4ge1xuXHRcdGF3YWl0IHRoaXMuX3dhaXRGb3JBbGxTdXBwb3J0ZWRFeGVjdXRpb25zO1xuXHRcdGNvbnN0IHR5cGUgPSBmaWx0ZXI/LnR5cGU7XG5cdFx0Y29uc3QgbmVlZHNSZWNlbnRUYXNrc01pZ3JhdGlvbiA9IHRoaXMuX25lZWRzUmVjZW50VGFza3NNaWdyYXRpb24oKTtcblx0XHRpZiAoIXdhaXRUb0FjdGl2YXRlKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9hY3RpdmF0ZVRhc2tQcm92aWRlcnMoZmlsdGVyPy50eXBlKTtcblx0XHR9XG5cdFx0Y29uc3QgdmFsaWRUeXBlczogSVN0cmluZ0RpY3Rpb25hcnk8Ym9vbGVhbj4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdFRhc2tEZWZpbml0aW9uUmVnaXN0cnkuYWxsKCkuZm9yRWFjaChkZWZpbml0aW9uID0+IHZhbGlkVHlwZXNbZGVmaW5pdGlvbi50YXNrVHlwZV0gPSB0cnVlKTtcblx0XHR2YWxpZFR5cGVzWydzaGVsbCddID0gdHJ1ZTtcblx0XHR2YWxpZFR5cGVzWydwcm9jZXNzJ10gPSB0cnVlO1xuXHRcdGNvbnN0IGNvbnRyaWJ1dGVkVGFza1NldHMgPSBhd2FpdCBuZXcgUHJvbWlzZTxJVGFza1NldFtdPihyZXNvbHZlID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdDogSVRhc2tTZXRbXSA9IFtdO1xuXHRcdFx0bGV0IGNvdW50ZXI6IG51bWJlciA9IDA7XG5cdFx0XHRjb25zdCBkb25lID0gKHZhbHVlOiBJVGFza1NldCB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0XHRpZiAodmFsdWUpIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKC0tY291bnRlciA9PT0gMCkge1xuXHRcdFx0XHRcdHJlc29sdmUocmVzdWx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGVycm9yID0gKGVycm9yOiBhbnkpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRcdFx0XHRpZiAoZXJyb3IgJiYgVHlwZXMuaXNTdHJpbmcoZXJyb3IubWVzc2FnZSkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fbG9nKGBFcnJvcjogJHtlcnJvci5tZXNzYWdlfVxcbmApO1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zaG93T3V0cHV0KCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9sb2coJ1Vua25vd24gZXJyb3IgcmVjZWl2ZWQgd2hpbGUgY29sbGVjdGluZyB0YXNrcyBmcm9tIHByb3ZpZGVycy4nKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5fc2hvd091dHB1dCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRpZiAoLS1jb3VudGVyID09PSAwKSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKHJlc3VsdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0aWYgKHRoaXMuX2lzUHJvdmlkZVRhc2tzRW5hYmxlZCgpICYmICh0aGlzLnNjaGVtYVZlcnNpb24gPT09IEpzb25TY2hlbWFWZXJzaW9uLlYyXzBfMCkgJiYgKHRoaXMuX3Byb3ZpZGVycy5zaXplID4gMCkpIHtcblx0XHRcdFx0bGV0IGZvdW5kQW55UHJvdmlkZXJzID0gZmFsc2U7XG5cdFx0XHRcdGZvciAoY29uc3QgW2hhbmRsZSwgcHJvdmlkZXJdIG9mIHRoaXMuX3Byb3ZpZGVycykge1xuXHRcdFx0XHRcdGNvbnN0IHByb3ZpZGVyVHlwZSA9IHRoaXMuX3Byb3ZpZGVyVHlwZXMuZ2V0KGhhbmRsZSk7XG5cdFx0XHRcdFx0aWYgKCh0eXBlID09PSB1bmRlZmluZWQpIHx8ICh0eXBlID09PSBwcm92aWRlclR5cGUpKSB7XG5cdFx0XHRcdFx0XHRpZiAocHJvdmlkZXJUeXBlICYmICF0aGlzLl9pc1Rhc2tQcm92aWRlckVuYWJsZWQocHJvdmlkZXJUeXBlKSkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGZvdW5kQW55UHJvdmlkZXJzID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGNvdW50ZXIrKztcblx0XHRcdFx0XHRcdHJhY2VUaW1lb3V0KHByb3ZpZGVyLnByb3ZpZGVUYXNrcyh2YWxpZFR5cGVzKS50aGVuKCh0YXNrU2V0OiBJVGFza1NldCkgPT4ge1xuXHRcdFx0XHRcdFx0XHQvLyBDaGVjayB0aGF0IHRoZSB0YXNrcyBwcm92aWRlZCBhcmUgb2YgdGhlIGNvcnJlY3QgdHlwZVxuXHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgdGFza1NldC50YXNrcykge1xuXHRcdFx0XHRcdFx0XHRcdGlmICh0YXNrLnR5cGUgIT09IHRoaXMuX3Byb3ZpZGVyVHlwZXMuZ2V0KGhhbmRsZSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ3VuZXhwZWN0ZWRUYXNrVHlwZScsIFwiVGhlIHRhc2sgcHJvdmlkZXIgZm9yIFxcXCJ7MH1cXFwiIHRhc2tzIHVuZXhwZWN0ZWRseSBwcm92aWRlZCBhIHRhc2sgb2YgdHlwZSBcXFwiezF9XFxcIi5cXG5cIiwgdGhpcy5fcHJvdmlkZXJUeXBlcy5nZXQoaGFuZGxlKSwgdGFzay50eXBlKSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoKHRhc2sudHlwZSAhPT0gJ3NoZWxsJykgJiYgKHRhc2sudHlwZSAhPT0gJ3Byb2Nlc3MnKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl9zaG93T3V0cHV0KCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGRvbmUodGFza1NldCk7XG5cdFx0XHRcdFx0XHR9LCBlcnJvciksIDUwMDAsICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Ly8gb25UaW1lb3V0XG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ1RpbWVkIG91dCBnZXR0aW5nIHRhc2tzIGZyb20gJywgcHJvdmlkZXJUeXBlKTtcblx0XHRcdFx0XHRcdFx0ZG9uZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghZm91bmRBbnlQcm92aWRlcnMpIHtcblx0XHRcdFx0XHRyZXNvbHZlKHJlc3VsdCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc29sdmUocmVzdWx0KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHJlc3VsdDogVGFza01hcCA9IG5ldyBUYXNrTWFwKCk7XG5cdFx0Y29uc3QgY29udHJpYnV0ZWRUYXNrczogVGFza01hcCA9IG5ldyBUYXNrTWFwKCk7XG5cblx0XHRmb3IgKGNvbnN0IHNldCBvZiBjb250cmlidXRlZFRhc2tTZXRzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2Ygc2V0LnRhc2tzKSB7XG5cdFx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHRhc2suZ2V0V29ya3NwYWNlRm9sZGVyKCk7XG5cdFx0XHRcdGlmICh3b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdFx0XHRjb250cmlidXRlZFRhc2tzLmFkZCh3b3Jrc3BhY2VGb2xkZXIsIHRhc2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGxldCB0YXNrczogW3N0cmluZywgSVdvcmtzcGFjZUZvbGRlclRhc2tSZXN1bHRdW10gPSBbXTtcblx0XHRcdC8vIHByZXZlbnQgd29ya3NwYWNlIHRydXN0IGRpYWxvZyBmcm9tIGJlaW5nIHNob3duIGluIHVuZXhwZWN0ZWQgY2FzZXMgIzIyNDg4MVxuXHRcdFx0aWYgKCFrbm93bk9ubHlPclRydXN0ZWQgfHwgdGhpcy5fd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSkge1xuXHRcdFx0XHR0YXNrcyA9IEFycmF5LmZyb20oYXdhaXQgdGhpcy5nZXRXb3Jrc3BhY2VUYXNrcygpKTtcblx0XHRcdH1cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKHRoaXMuX2dldEN1c3RvbVRhc2tQcm9taXNlcyh0YXNrcywgZmlsdGVyLCByZXN1bHQsIGNvbnRyaWJ1dGVkVGFza3MsIHdhaXRUb0FjdGl2YXRlKSk7XG5cdFx0XHRpZiAobmVlZHNSZWNlbnRUYXNrc01pZ3JhdGlvbikge1xuXHRcdFx0XHQvLyBBdCB0aGlzIHBvaW50IHdlIGhhdmUgYWxsIHRoZSB0YXNrcyBhbmQgY2FuIG1pZ3JhdGUgdGhlIHJlY2VudGx5IHVzZWQgdGFza3MuXG5cdFx0XHRcdGF3YWl0IHRoaXMuX21pZ3JhdGVSZWNlbnRUYXNrcyhyZXN1bHQuYWxsKCkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIElmIHdlIGNhbid0IHJlYWQgdGhlIHRhc2tzLmpzb24gZmlsZSBwcm92aWRlIGF0IGxlYXN0IHRoZSBjb250cmlidXRlZCB0YXNrc1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBUYXNrTWFwID0gbmV3IFRhc2tNYXAoKTtcblx0XHRcdGZvciAoY29uc3Qgc2V0IG9mIGNvbnRyaWJ1dGVkVGFza1NldHMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIHNldC50YXNrcykge1xuXHRcdFx0XHRcdGNvbnN0IGZvbGRlciA9IHRhc2suZ2V0V29ya3NwYWNlRm9sZGVyKCk7XG5cdFx0XHRcdFx0aWYgKGZvbGRlcikge1xuXHRcdFx0XHRcdFx0cmVzdWx0LmFkZChmb2xkZXIsIHRhc2spO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdH1cblx0cHJpdmF0ZSBfZ2V0Q3VzdG9tVGFza1Byb21pc2VzKGN1c3RvbVRhc2tzS2V5VmFsdWVQYWlyczogW3N0cmluZywgSVdvcmtzcGFjZUZvbGRlclRhc2tSZXN1bHRdW10sIGZpbHRlcjogSVRhc2tGaWx0ZXIgfCB1bmRlZmluZWQsIHJlc3VsdDogVGFza01hcCwgY29udHJpYnV0ZWRUYXNrczogVGFza01hcCwgd2FpdFRvQWN0aXZhdGU6IGJvb2xlYW4gfCB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY3VzdG9tVGFza3NLZXlWYWx1ZVBhaXJzLm1hcChhc3luYyAoW2tleSwgZm9sZGVyVGFza3NdKSA9PiB7XG5cdFx0XHRjb25zdCBjb250cmlidXRlZCA9IGNvbnRyaWJ1dGVkVGFza3MuZ2V0KGtleSk7XG5cdFx0XHRpZiAoIWZvbGRlclRhc2tzLnNldCkge1xuXHRcdFx0XHRpZiAoY29udHJpYnV0ZWQpIHtcblx0XHRcdFx0XHRyZXN1bHQuYWRkKGtleSwgLi4uY29udHJpYnV0ZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZKSB7XG5cdFx0XHRcdHJlc3VsdC5hZGQoa2V5LCAuLi5mb2xkZXJUYXNrcy5zZXQudGFza3MpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbnMgPSBmb2xkZXJUYXNrcy5jb25maWd1cmF0aW9ucztcblx0XHRcdFx0Y29uc3QgbGVnYWN5VGFza0NvbmZpZ3VyYXRpb25zID0gZm9sZGVyVGFza3Muc2V0ID8gdGhpcy5fZ2V0TGVnYWN5VGFza0NvbmZpZ3VyYXRpb25zKGZvbGRlclRhc2tzLnNldCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IGN1c3RvbVRhc2tzVG9EZWxldGU6IFRhc2tbXSA9IFtdO1xuXHRcdFx0XHRpZiAoY29uZmlndXJhdGlvbnMgfHwgbGVnYWN5VGFza0NvbmZpZ3VyYXRpb25zKSB7XG5cdFx0XHRcdFx0Y29uc3QgdW5Vc2VkQ29uZmlndXJhdGlvbnM6IFNldDxzdHJpbmc+ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0XHRcdFx0aWYgKGNvbmZpZ3VyYXRpb25zKSB7XG5cdFx0XHRcdFx0XHRPYmplY3Qua2V5cyhjb25maWd1cmF0aW9ucy5ieUlkZW50aWZpZXIpLmZvckVhY2goa2V5ID0+IHVuVXNlZENvbmZpZ3VyYXRpb25zLmFkZChrZXkpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIGNvbnRyaWJ1dGVkKSB7XG5cdFx0XHRcdFx0XHRpZiAoIUNvbnRyaWJ1dGVkVGFzay5pcyh0YXNrKSkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChjb25maWd1cmF0aW9ucykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBjb25maWd1cmluZ1Rhc2sgPSBjb25maWd1cmF0aW9ucy5ieUlkZW50aWZpZXJbdGFzay5kZWZpbmVzLl9rZXldO1xuXHRcdFx0XHRcdFx0XHRpZiAoY29uZmlndXJpbmdUYXNrKSB7XG5cdFx0XHRcdFx0XHRcdFx0dW5Vc2VkQ29uZmlndXJhdGlvbnMuZGVsZXRlKHRhc2suZGVmaW5lcy5fa2V5KTtcblx0XHRcdFx0XHRcdFx0XHRyZXN1bHQuYWRkKGtleSwgVGFza0NvbmZpZy5jcmVhdGVDdXN0b21UYXNrKHRhc2ssIGNvbmZpZ3VyaW5nVGFzaykpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHJlc3VsdC5hZGQoa2V5LCB0YXNrKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChsZWdhY3lUYXNrQ29uZmlndXJhdGlvbnMpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY29uZmlndXJpbmdUYXNrID0gbGVnYWN5VGFza0NvbmZpZ3VyYXRpb25zW3Rhc2suZGVmaW5lcy5fa2V5XTtcblx0XHRcdFx0XHRcdFx0aWYgKGNvbmZpZ3VyaW5nVGFzaykge1xuXHRcdFx0XHRcdFx0XHRcdHJlc3VsdC5hZGQoa2V5LCBUYXNrQ29uZmlnLmNyZWF0ZUN1c3RvbVRhc2sodGFzaywgY29uZmlndXJpbmdUYXNrKSk7XG5cdFx0XHRcdFx0XHRcdFx0Y3VzdG9tVGFza3NUb0RlbGV0ZS5wdXNoKGNvbmZpZ3VyaW5nVGFzayk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cmVzdWx0LmFkZChrZXksIHRhc2spO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZXN1bHQuYWRkKGtleSwgdGFzayk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChjdXN0b21UYXNrc1RvRGVsZXRlLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdGNvbnN0IHRvRGVsZXRlID0gY3VzdG9tVGFza3NUb0RlbGV0ZS5yZWR1Y2U8SVN0cmluZ0RpY3Rpb25hcnk8Ym9vbGVhbj4+KChtYXAsIHRhc2spID0+IHtcblx0XHRcdFx0XHRcdFx0bWFwW3Rhc2suX2lkXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBtYXA7XG5cdFx0XHRcdFx0XHR9LCBPYmplY3QuY3JlYXRlKG51bGwpKTtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgdGFzayBvZiBmb2xkZXJUYXNrcy5zZXQudGFza3MpIHtcblx0XHRcdFx0XHRcdFx0aWYgKHRvRGVsZXRlW3Rhc2suX2lkXSkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJlc3VsdC5hZGQoa2V5LCB0YXNrKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVzdWx0LmFkZChrZXksIC4uLmZvbGRlclRhc2tzLnNldC50YXNrcyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgdW5Vc2VkQ29uZmlndXJhdGlvbnNBc0FycmF5ID0gQXJyYXkuZnJvbSh1blVzZWRDb25maWd1cmF0aW9ucyk7XG5cblx0XHRcdFx0XHRjb25zdCB1blVzZWRDb25maWd1cmF0aW9uUHJvbWlzZXMgPSB1blVzZWRDb25maWd1cmF0aW9uc0FzQXJyYXkubWFwKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgY29uZmlndXJpbmdUYXNrID0gY29uZmlndXJhdGlvbnMhLmJ5SWRlbnRpZmllclt2YWx1ZV07XG5cdFx0XHRcdFx0XHRpZiAoZmlsdGVyPy50eXBlICYmIChmaWx0ZXIudHlwZSAhPT0gY29uZmlndXJpbmdUYXNrLmNvbmZpZ3VyZXMudHlwZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRsZXQgcmVxdWlyZWRUYXNrUHJvdmlkZXJVbmF2YWlsYWJsZTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IFtoYW5kbGUsIHByb3ZpZGVyXSBvZiB0aGlzLl9wcm92aWRlcnMpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcHJvdmlkZXJUeXBlID0gdGhpcy5fcHJvdmlkZXJUeXBlcy5nZXQoaGFuZGxlKTtcblx0XHRcdFx0XHRcdFx0aWYgKGNvbmZpZ3VyaW5nVGFzay50eXBlID09PSBwcm92aWRlclR5cGUpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAocHJvdmlkZXJUeXBlICYmICF0aGlzLl9pc1Rhc2tQcm92aWRlckVuYWJsZWQocHJvdmlkZXJUeXBlKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmVxdWlyZWRUYXNrUHJvdmlkZXJVbmF2YWlsYWJsZSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRUYXNrID0gYXdhaXQgcHJvdmlkZXIucmVzb2x2ZVRhc2soY29uZmlndXJpbmdUYXNrKTtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChyZXNvbHZlZFRhc2sgJiYgKHJlc29sdmVkVGFzay5faWQgPT09IGNvbmZpZ3VyaW5nVGFzay5faWQpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJlc3VsdC5hZGQoa2V5LCBUYXNrQ29uZmlnLmNyZWF0ZUN1c3RvbVRhc2socmVzb2x2ZWRUYXNrLCBjb25maWd1cmluZ1Rhc2spKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBJZ25vcmUgZXJyb3JzLiBUaGUgdGFzayBjb3VsZCBub3QgYmUgcHJvdmlkZWQgYnkgYW55IG9mIHRoZSBwcm92aWRlcnMuXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAocmVxdWlyZWRUYXNrUHJvdmlkZXJVbmF2YWlsYWJsZSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKFxuXHRcdFx0XHRcdFx0XHRcdCdUYXNrU2VydmljZS5wcm92aWRlclVuYXZhaWxhYmxlJyxcblx0XHRcdFx0XHRcdFx0XHQnV2FybmluZzogezB9IHRhc2tzIGFyZSB1bmF2YWlsYWJsZSBpbiB0aGUgY3VycmVudCBlbnZpcm9ubWVudC4nLFxuXHRcdFx0XHRcdFx0XHRcdGNvbmZpZ3VyaW5nVGFzay5jb25maWd1cmVzLnR5cGVcblx0XHRcdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCF3YWl0VG9BY3RpdmF0ZSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKFxuXHRcdFx0XHRcdFx0XHRcdCdUYXNrU2VydmljZS5ub0NvbmZpZ3VyYXRpb24nLFxuXHRcdFx0XHRcdFx0XHRcdCdFcnJvcjogVGhlIHswfSB0YXNrIGRldGVjdGlvbiBkaWRuXFwndCBjb250cmlidXRlIGEgdGFzayBmb3IgdGhlIGZvbGxvd2luZyBjb25maWd1cmF0aW9uOlxcbnsxfVxcblRoZSB0YXNrIHdpbGwgYmUgaWdub3JlZC4nLFxuXHRcdFx0XHRcdFx0XHRcdGNvbmZpZ3VyaW5nVGFzay5jb25maWd1cmVzLnR5cGUsXG5cdFx0XHRcdFx0XHRcdFx0SlNPTi5zdHJpbmdpZnkoY29uZmlndXJpbmdUYXNrLl9zb3VyY2UuY29uZmlnLmVsZW1lbnQsIHVuZGVmaW5lZCwgNClcblx0XHRcdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3Nob3dPdXRwdXQoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsKHVuVXNlZENvbmZpZ3VyYXRpb25Qcm9taXNlcyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0LmFkZChrZXksIC4uLmZvbGRlclRhc2tzLnNldC50YXNrcyk7XG5cdFx0XHRcdFx0cmVzdWx0LmFkZChrZXksIC4uLmNvbnRyaWJ1dGVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0TGVnYWN5VGFza0NvbmZpZ3VyYXRpb25zKHdvcmtzcGFjZVRhc2tzOiBJVGFza1NldCk6IElTdHJpbmdEaWN0aW9uYXJ5PEN1c3RvbVRhc2s+IHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgcmVzdWx0OiBJU3RyaW5nRGljdGlvbmFyeTxDdXN0b21UYXNrPiB8IHVuZGVmaW5lZDtcblx0XHRmdW5jdGlvbiBnZXRSZXN1bHQoKTogSVN0cmluZ0RpY3Rpb25hcnk8Q3VzdG9tVGFzaz4ge1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdHJldHVybiByZXN1bHQhO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IHRhc2sgb2Ygd29ya3NwYWNlVGFza3MudGFza3MpIHtcblx0XHRcdGlmIChDdXN0b21UYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRcdGNvbnN0IGNvbW1hbmROYW1lID0gdGFzay5jb21tYW5kICYmIHRhc2suY29tbWFuZC5uYW1lO1xuXHRcdFx0XHQvLyBUaGlzIGlzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIHRoZSAwLjEuMCB0YXNrIGFubm90YXRpb24gY29kZVxuXHRcdFx0XHQvLyBpZiB3ZSBoYWQgYSBndWxwLCBqYWtlIG9yIGdydW50IGNvbW1hbmQgYSB0YXNrIHNwZWNpZmljYXRpb24gd2FzIGEgYW5ub3RhdGlvblxuXHRcdFx0XHRpZiAoY29tbWFuZE5hbWUgPT09ICdndWxwJyB8fCBjb21tYW5kTmFtZSA9PT0gJ2dydW50JyB8fCBjb21tYW5kTmFtZSA9PT0gJ2pha2UnKSB7XG5cdFx0XHRcdFx0Y29uc3QgaWRlbnRpZmllciA9IEtleWVkVGFza0lkZW50aWZpZXIuY3JlYXRlKHtcblx0XHRcdFx0XHRcdHR5cGU6IGNvbW1hbmROYW1lLFxuXHRcdFx0XHRcdFx0dGFzazogdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Z2V0UmVzdWx0KClbaWRlbnRpZmllci5fa2V5XSA9IHRhc2s7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBnZXRXb3Jrc3BhY2VUYXNrcyhydW5Tb3VyY2U6IFRhc2tSdW5Tb3VyY2UgPSBUYXNrUnVuU291cmNlLlVzZXIpOiBQcm9taXNlPE1hcDxzdHJpbmcsIElXb3Jrc3BhY2VGb2xkZXJUYXNrUmVzdWx0Pj4ge1xuXHRcdGlmICghKGF3YWl0IHRoaXMuX3RydXN0KCkpKSB7XG5cdFx0XHRyZXR1cm4gbmV3IE1hcCgpO1xuXHRcdH1cblx0XHRhd2FpdCByYWNlVGltZW91dCh0aGlzLl93YWl0Rm9yQWxsU3VwcG9ydGVkRXhlY3V0aW9ucywgMjAwMCwgKCkgPT4ge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdUaW1lZCBvdXQgd2FpdGluZyBmb3IgYWxsIHN1cHBvcnRlZCBleGVjdXRpb25zJyk7XG5cdFx0fSk7XG5cdFx0YXdhaXQgdGhpcy5fd2hlblRhc2tTeXN0ZW1SZWFkeTtcblx0XHRpZiAodGhpcy5fd29ya3NwYWNlVGFza3NQcm9taXNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fd29ya3NwYWNlVGFza3NQcm9taXNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdXBkYXRlV29ya3NwYWNlVGFza3MocnVuU291cmNlKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVdvcmtzcGFjZVRhc2tzKHJ1blNvdXJjZTogVGFza1J1blNvdXJjZSA9IFRhc2tSdW5Tb3VyY2UuVXNlcik6IFByb21pc2U8TWFwPHN0cmluZywgSVdvcmtzcGFjZUZvbGRlclRhc2tSZXN1bHQ+PiB7XG5cdFx0dGhpcy5fd29ya3NwYWNlVGFza3NQcm9taXNlID0gdGhpcy5fY29tcHV0ZVdvcmtzcGFjZVRhc2tzKHJ1blNvdXJjZSk7XG5cdFx0cmV0dXJuIHRoaXMuX3dvcmtzcGFjZVRhc2tzUHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2dldEFGb2xkZXIoKTogUHJvbWlzZTxJV29ya3NwYWNlRm9sZGVyPiB7XG5cdFx0bGV0IGZvbGRlciA9IHRoaXMud29ya3NwYWNlRm9sZGVycy5sZW5ndGggPiAwID8gdGhpcy53b3Jrc3BhY2VGb2xkZXJzWzBdIDogdW5kZWZpbmVkO1xuXHRcdGlmICghZm9sZGVyKSB7XG5cdFx0XHRjb25zdCB1c2VyaG9tZSA9IGF3YWl0IHRoaXMuX3BhdGhTZXJ2aWNlLnVzZXJIb21lKCk7XG5cdFx0XHRmb2xkZXIgPSBuZXcgV29ya3NwYWNlRm9sZGVyKHsgdXJpOiB1c2VyaG9tZSwgbmFtZTogcmVzb3VyY2VzLmJhc2VuYW1lKHVzZXJob21lKSwgaW5kZXg6IDAgfSk7XG5cdFx0fVxuXHRcdHJldHVybiBmb2xkZXI7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgX2NvbXB1dGVXb3Jrc3BhY2VUYXNrcyhydW5Tb3VyY2U6IFRhc2tSdW5Tb3VyY2UgPSBUYXNrUnVuU291cmNlLlVzZXIpOiBQcm9taXNlPE1hcDxzdHJpbmcsIElXb3Jrc3BhY2VGb2xkZXJUYXNrUmVzdWx0Pj4ge1xuXHRcdGNvbnN0IHByb21pc2VzOiBQcm9taXNlPElXb3Jrc3BhY2VGb2xkZXJUYXNrUmVzdWx0IHwgdW5kZWZpbmVkPltdID0gW107XG5cdFx0Zm9yIChjb25zdCBmb2xkZXIgb2YgdGhpcy53b3Jrc3BhY2VGb2xkZXJzKSB7XG5cdFx0XHRwcm9taXNlcy5wdXNoKHRoaXMuX2NvbXB1dGVXb3Jrc3BhY2VGb2xkZXJUYXNrcyhmb2xkZXIsIHJ1blNvdXJjZSkpO1xuXHRcdH1cblx0XHRjb25zdCB2YWx1ZXMgPSBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIElXb3Jrc3BhY2VGb2xkZXJUYXNrUmVzdWx0PigpO1xuXHRcdGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG5cdFx0XHRpZiAodmFsdWUpIHtcblx0XHRcdFx0cmVzdWx0LnNldCh2YWx1ZS53b3Jrc3BhY2VGb2xkZXIudXJpLnRvU3RyaW5nKCksIHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBmb2xkZXIgPSBhd2FpdCB0aGlzLl9nZXRBRm9sZGVyKCk7XG5cdFx0aWYgKHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgIT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZKSB7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VGaWxlVGFza3MgPSBhd2FpdCB0aGlzLl9jb21wdXRlV29ya3NwYWNlRmlsZVRhc2tzKGZvbGRlciwgcnVuU291cmNlKTtcblx0XHRcdGlmICh3b3Jrc3BhY2VGaWxlVGFza3MgJiYgdGhpcy5fd29ya3NwYWNlICYmIHRoaXMuX3dvcmtzcGFjZS5jb25maWd1cmF0aW9uKSB7XG5cdFx0XHRcdHJlc3VsdC5zZXQodGhpcy5fd29ya3NwYWNlLmNvbmZpZ3VyYXRpb24udG9TdHJpbmcoKSwgd29ya3NwYWNlRmlsZVRhc2tzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCB1c2VyVGFza3MgPSBhd2FpdCB0aGlzLl9jb21wdXRlVXNlclRhc2tzKGZvbGRlciwgcnVuU291cmNlKTtcblx0XHRpZiAodXNlclRhc2tzKSB7XG5cdFx0XHRyZXN1bHQuc2V0KFVTRVJfVEFTS1NfR1JPVVBfS0VZLCB1c2VyVGFza3MpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgX2pzb25UYXNrc1N1cHBvcnRlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gU2hlbGxFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0LmdldFZhbHVlKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKSA9PT0gdHJ1ZSAmJiBQcm9jZXNzRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dC5nZXRWYWx1ZSh0aGlzLl9jb250ZXh0S2V5U2VydmljZSkgPT09IHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jb21wdXRlV29ya3NwYWNlRm9sZGVyVGFza3Mod29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyLCBydW5Tb3VyY2U6IFRhc2tSdW5Tb3VyY2UgPSBUYXNrUnVuU291cmNlLlVzZXIpOiBQcm9taXNlPElXb3Jrc3BhY2VGb2xkZXJUYXNrUmVzdWx0PiB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVyQ29uZmlndXJhdGlvbiA9ICh0aGlzLl9leGVjdXRpb25FbmdpbmUgPT09IEV4ZWN1dGlvbkVuZ2luZS5Qcm9jZXNzID8gYXdhaXQgdGhpcy5fY29tcHV0ZUxlZ2FjeUNvbmZpZ3VyYXRpb24od29ya3NwYWNlRm9sZGVyKSA6IGF3YWl0IHRoaXMuX2NvbXB1dGVDb25maWd1cmF0aW9uKHdvcmtzcGFjZUZvbGRlcikpO1xuXHRcdGlmICghd29ya3NwYWNlRm9sZGVyQ29uZmlndXJhdGlvbiB8fCAhd29ya3NwYWNlRm9sZGVyQ29uZmlndXJhdGlvbi5jb25maWcgfHwgd29ya3NwYWNlRm9sZGVyQ29uZmlndXJhdGlvbi5oYXNFcnJvcnMpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoeyB3b3Jrc3BhY2VGb2xkZXIsIHNldDogdW5kZWZpbmVkLCBjb25maWd1cmF0aW9uczogdW5kZWZpbmVkLCBoYXNFcnJvcnM6IHdvcmtzcGFjZUZvbGRlckNvbmZpZ3VyYXRpb24gPyB3b3Jrc3BhY2VGb2xkZXJDb25maWd1cmF0aW9uLmhhc0Vycm9ycyA6IGZhbHNlIH0pO1xuXHRcdH1cblx0XHRhd2FpdCBQcm9ibGVtTWF0Y2hlclJlZ2lzdHJ5Lm9uUmVhZHkoKTtcblx0XHRjb25zdCB0YXNrU3lzdGVtSW5mbzogSVRhc2tTeXN0ZW1JbmZvIHwgdW5kZWZpbmVkID0gdGhpcy5fZ2V0VGFza1N5c3RlbUluZm8od29ya3NwYWNlRm9sZGVyLnVyaS5zY2hlbWUpO1xuXHRcdGNvbnN0IHByb2JsZW1SZXBvcnRlciA9IG5ldyBQcm9ibGVtUmVwb3J0ZXIodGhpcy5fb3V0cHV0Q2hhbm5lbCk7XG5cdFx0Y29uc3QgcGFyc2VSZXN1bHQgPSBUYXNrQ29uZmlnLnBhcnNlKHdvcmtzcGFjZUZvbGRlciwgdW5kZWZpbmVkLCB0YXNrU3lzdGVtSW5mbyA/IHRhc2tTeXN0ZW1JbmZvLnBsYXRmb3JtIDogUGxhdGZvcm0ucGxhdGZvcm0sIHdvcmtzcGFjZUZvbGRlckNvbmZpZ3VyYXRpb24uY29uZmlnLCBwcm9ibGVtUmVwb3J0ZXIsIFRhc2tDb25maWcuVGFza0NvbmZpZ1NvdXJjZS5UYXNrc0pzb24sIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRsZXQgaGFzRXJyb3JzID0gZmFsc2U7XG5cdFx0aWYgKCFwYXJzZVJlc3VsdC52YWxpZGF0aW9uU3RhdHVzLmlzT0soKSAmJiAocGFyc2VSZXN1bHQudmFsaWRhdGlvblN0YXR1cy5zdGF0ZSAhPT0gVmFsaWRhdGlvblN0YXRlLkluZm8pKSB7XG5cdFx0XHRoYXNFcnJvcnMgPSB0cnVlO1xuXHRcdFx0dGhpcy5fc2hvd091dHB1dChydW5Tb3VyY2UpO1xuXHRcdH1cblx0XHRpZiAocHJvYmxlbVJlcG9ydGVyLnN0YXR1cy5pc0ZhdGFsKCkpIHtcblx0XHRcdHByb2JsZW1SZXBvcnRlci5mYXRhbChubHMubG9jYWxpemUoJ1Rhc2tTeXN0ZW0uY29uZmlndXJhdGlvbkVycm9ycycsICdFcnJvcjogdGhlIHByb3ZpZGVkIHRhc2sgY29uZmlndXJhdGlvbiBoYXMgdmFsaWRhdGlvbiBlcnJvcnMgYW5kIGNhblxcJ3Qgbm90IGJlIHVzZWQuIFBsZWFzZSBjb3JyZWN0IHRoZSBlcnJvcnMgZmlyc3QuJykpO1xuXHRcdFx0cmV0dXJuIHsgd29ya3NwYWNlRm9sZGVyLCBzZXQ6IHVuZGVmaW5lZCwgY29uZmlndXJhdGlvbnM6IHVuZGVmaW5lZCwgaGFzRXJyb3JzIH07XG5cdFx0fVxuXHRcdGxldCBjdXN0b21pemVkVGFza3M6IHsgYnlJZGVudGlmaWVyOiBJU3RyaW5nRGljdGlvbmFyeTxDb25maWd1cmluZ1Rhc2s+IH0gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHBhcnNlUmVzdWx0LmNvbmZpZ3VyZWQgJiYgcGFyc2VSZXN1bHQuY29uZmlndXJlZC5sZW5ndGggPiAwKSB7XG5cdFx0XHRjdXN0b21pemVkVGFza3MgPSB7XG5cdFx0XHRcdGJ5SWRlbnRpZmllcjogT2JqZWN0LmNyZWF0ZShudWxsKVxuXHRcdFx0fTtcblx0XHRcdGZvciAoY29uc3QgdGFzayBvZiBwYXJzZVJlc3VsdC5jb25maWd1cmVkKSB7XG5cdFx0XHRcdGN1c3RvbWl6ZWRUYXNrcy5ieUlkZW50aWZpZXJbdGFzay5jb25maWd1cmVzLl9rZXldID0gdGFzaztcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCF0aGlzLl9qc29uVGFza3NTdXBwb3J0ZWQgJiYgKHBhcnNlUmVzdWx0LmN1c3RvbS5sZW5ndGggPiAwKSkge1xuXHRcdFx0Y29uc29sZS53YXJuKCdDdXN0b20gd29ya3NwYWNlIHRhc2tzIGFyZSBub3Qgc3VwcG9ydGVkLicpO1xuXHRcdH1cblx0XHRyZXR1cm4geyB3b3Jrc3BhY2VGb2xkZXIsIHNldDogeyB0YXNrczogdGhpcy5fanNvblRhc2tzU3VwcG9ydGVkID8gcGFyc2VSZXN1bHQuY3VzdG9tIDogW10gfSwgY29uZmlndXJhdGlvbnM6IGN1c3RvbWl6ZWRUYXNrcywgaGFzRXJyb3JzIH07XG5cdH1cblxuXHRwcml2YXRlIF90ZXN0UGFyc2VFeHRlcm5hbENvbmZpZyhjb25maWc6IFRhc2tDb25maWcuSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQsIGxvY2F0aW9uOiBzdHJpbmcpOiB7IGNvbmZpZzogVGFza0NvbmZpZy5JRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZDsgaGFzUGFyc2VFcnJvcnM6IGJvb2xlYW4gfSB7XG5cdFx0aWYgKCFjb25maWcpIHtcblx0XHRcdHJldHVybiB7IGNvbmZpZzogdW5kZWZpbmVkLCBoYXNQYXJzZUVycm9yczogZmFsc2UgfTtcblx0XHR9XG5cdFx0Y29uc3QgcGFyc2VFcnJvcnM6IHN0cmluZ1tdID0gKGNvbmZpZyBhcyBhbnkpLiRwYXJzZUVycm9ycztcblx0XHRpZiAocGFyc2VFcnJvcnMpIHtcblx0XHRcdGxldCBpc0FmZmVjdGVkID0gZmFsc2U7XG5cdFx0XHRmb3IgKGNvbnN0IHBhcnNlRXJyb3Igb2YgcGFyc2VFcnJvcnMpIHtcblx0XHRcdFx0aWYgKC90YXNrc1xcLmpzb24kLy50ZXN0KHBhcnNlRXJyb3IpKSB7XG5cdFx0XHRcdFx0aXNBZmZlY3RlZCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChpc0FmZmVjdGVkKSB7XG5cdFx0XHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoeyBrZXk6ICdUYXNrU3lzdGVtLmludmFsaWRUYXNrSnNvbk90aGVyJywgY29tbWVudDogWydNZXNzYWdlIG5vdGlmaWVzIG9mIGFuIGVycm9yIGluIG9uZSBvZiBzZXZlcmFsIHBsYWNlcyB0aGVyZSBpcyB0YXNrcyByZWxhdGVkIGpzb24sIG5vdCBuZWNlc3NhcmlseSBpbiBhIGZpbGUgbmFtZWQgdGFza3MuanNvbiddIH0sICdFcnJvcjogVGhlIGNvbnRlbnQgb2YgdGhlIHRhc2tzIGpzb24gaW4gezB9IGhhcyBzeW50YXggZXJyb3JzLiBQbGVhc2UgY29ycmVjdCB0aGVtIGJlZm9yZSBleGVjdXRpbmcgYSB0YXNrLicsIGxvY2F0aW9uKSk7XG5cdFx0XHRcdHRoaXMuX3Nob3dPdXRwdXQoKTtcblx0XHRcdFx0cmV0dXJuIHsgY29uZmlnLCBoYXNQYXJzZUVycm9yczogdHJ1ZSB9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4geyBjb25maWcsIGhhc1BhcnNlRXJyb3JzOiBmYWxzZSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfbG9nKHZhbHVlOiBzdHJpbmcsIHZlcmJvc2U/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKCF2ZXJib3NlIHx8IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRhc2tTZXR0aW5nSWQuVmVyYm9zZUxvZ2dpbmcpKSB7XG5cdFx0XHR0aGlzLl9vdXRwdXRDaGFubmVsLmFwcGVuZCh2YWx1ZSArICdcXG4nKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jb21wdXRlV29ya3NwYWNlRmlsZVRhc2tzKHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciwgcnVuU291cmNlOiBUYXNrUnVuU291cmNlID0gVGFza1J1blNvdXJjZS5Vc2VyKTogUHJvbWlzZTxJV29ya3NwYWNlRm9sZGVyVGFza1Jlc3VsdD4ge1xuXHRcdGlmICh0aGlzLl9leGVjdXRpb25FbmdpbmUgPT09IEV4ZWN1dGlvbkVuZ2luZS5Qcm9jZXNzKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZW1wdHlXb3Jrc3BhY2VUYXNrUmVzdWx0cyh3b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdH1cblx0XHRjb25zdCB3b3Jrc3BhY2VGaWxlQ29uZmlnID0gdGhpcy5fZ2V0Q29uZmlndXJhdGlvbih3b3Jrc3BhY2VGb2xkZXIsIFRhc2tTb3VyY2VLaW5kLldvcmtzcGFjZUZpbGUpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB0aGlzLl90ZXN0UGFyc2VFeHRlcm5hbENvbmZpZyh3b3Jrc3BhY2VGaWxlQ29uZmlnLmNvbmZpZywgbmxzLmxvY2FsaXplKCdUYXNrc1N5c3RlbS5sb2NhdGlvbldvcmtzcGFjZUNvbmZpZycsICd3b3Jrc3BhY2UgZmlsZScpKTtcblx0XHRjb25zdCBjdXN0b21pemVkVGFza3M6IHsgYnlJZGVudGlmaWVyOiBJU3RyaW5nRGljdGlvbmFyeTxDb25maWd1cmluZ1Rhc2s+IH0gPSB7XG5cdFx0XHRieUlkZW50aWZpZXI6IE9iamVjdC5jcmVhdGUobnVsbClcblx0XHR9O1xuXG5cdFx0Y29uc3QgY3VzdG9tOiBDdXN0b21UYXNrW10gPSBbXTtcblx0XHRhd2FpdCB0aGlzLl9jb21wdXRlVGFza3NGb3JTaW5nbGVDb25maWcod29ya3NwYWNlRm9sZGVyLCBjb25maWd1cmF0aW9uLmNvbmZpZywgcnVuU291cmNlLCBjdXN0b20sIGN1c3RvbWl6ZWRUYXNrcy5ieUlkZW50aWZpZXIsIFRhc2tDb25maWcuVGFza0NvbmZpZ1NvdXJjZS5Xb3Jrc3BhY2VGaWxlKTtcblx0XHRjb25zdCBlbmdpbmUgPSBjb25maWd1cmF0aW9uLmNvbmZpZyA/IFRhc2tDb25maWcuRXhlY3V0aW9uRW5naW5lLmZyb20oY29uZmlndXJhdGlvbi5jb25maWcpIDogRXhlY3V0aW9uRW5naW5lLlRlcm1pbmFsO1xuXHRcdGlmIChlbmdpbmUgPT09IEV4ZWN1dGlvbkVuZ2luZS5Qcm9jZXNzKSB7XG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLndhcm4obmxzLmxvY2FsaXplKCdUYXNrU3lzdGVtLnZlcnNpb25Xb3Jrc3BhY2VGaWxlJywgJ09ubHkgdGFza3MgdmVyc2lvbiAyLjAuMCBwZXJtaXR0ZWQgaW4gd29ya3NwYWNlIGNvbmZpZ3VyYXRpb24gZmlsZXMuJykpO1xuXHRcdFx0cmV0dXJuIHRoaXMuX2VtcHR5V29ya3NwYWNlVGFza1Jlc3VsdHMod29ya3NwYWNlRm9sZGVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHsgd29ya3NwYWNlRm9sZGVyLCBzZXQ6IHsgdGFza3M6IGN1c3RvbSB9LCBjb25maWd1cmF0aW9uczogY3VzdG9taXplZFRhc2tzLCBoYXNFcnJvcnM6IGNvbmZpZ3VyYXRpb24uaGFzUGFyc2VFcnJvcnMgfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NvbXB1dGVVc2VyVGFza3Mod29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyLCBydW5Tb3VyY2U6IFRhc2tSdW5Tb3VyY2UgPSBUYXNrUnVuU291cmNlLlVzZXIpOiBQcm9taXNlPElXb3Jrc3BhY2VGb2xkZXJUYXNrUmVzdWx0PiB7XG5cdFx0aWYgKHRoaXMuX2V4ZWN1dGlvbkVuZ2luZSA9PT0gRXhlY3V0aW9uRW5naW5lLlByb2Nlc3MpIHtcblx0XHRcdHJldHVybiB0aGlzLl9lbXB0eVdvcmtzcGFjZVRhc2tSZXN1bHRzKHdvcmtzcGFjZUZvbGRlcik7XG5cdFx0fVxuXHRcdGNvbnN0IHVzZXJUYXNrc0NvbmZpZyA9IHRoaXMuX2dldENvbmZpZ3VyYXRpb24od29ya3NwYWNlRm9sZGVyLCBUYXNrU291cmNlS2luZC5Vc2VyKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uID0gdGhpcy5fdGVzdFBhcnNlRXh0ZXJuYWxDb25maWcodXNlclRhc2tzQ29uZmlnLmNvbmZpZywgbmxzLmxvY2FsaXplKCdUYXNrc1N5c3RlbS5sb2NhdGlvblVzZXJDb25maWcnLCAndXNlciBzZXR0aW5ncycpKTtcblx0XHRjb25zdCBjdXN0b21pemVkVGFza3M6IHsgYnlJZGVudGlmaWVyOiBJU3RyaW5nRGljdGlvbmFyeTxDb25maWd1cmluZ1Rhc2s+IH0gPSB7XG5cdFx0XHRieUlkZW50aWZpZXI6IE9iamVjdC5jcmVhdGUobnVsbClcblx0XHR9O1xuXG5cdFx0Y29uc3QgY3VzdG9tOiBDdXN0b21UYXNrW10gPSBbXTtcblx0XHRhd2FpdCB0aGlzLl9jb21wdXRlVGFza3NGb3JTaW5nbGVDb25maWcod29ya3NwYWNlRm9sZGVyLCBjb25maWd1cmF0aW9uLmNvbmZpZywgcnVuU291cmNlLCBjdXN0b20sIGN1c3RvbWl6ZWRUYXNrcy5ieUlkZW50aWZpZXIsIFRhc2tDb25maWcuVGFza0NvbmZpZ1NvdXJjZS5Vc2VyKTtcblx0XHRjb25zdCBlbmdpbmUgPSBjb25maWd1cmF0aW9uLmNvbmZpZyA/IFRhc2tDb25maWcuRXhlY3V0aW9uRW5naW5lLmZyb20oY29uZmlndXJhdGlvbi5jb25maWcpIDogRXhlY3V0aW9uRW5naW5lLlRlcm1pbmFsO1xuXHRcdGlmIChlbmdpbmUgPT09IEV4ZWN1dGlvbkVuZ2luZS5Qcm9jZXNzKSB7XG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLndhcm4obmxzLmxvY2FsaXplKCdUYXNrU3lzdGVtLnZlcnNpb25TZXR0aW5ncycsICdPbmx5IHRhc2tzIHZlcnNpb24gMi4wLjAgcGVybWl0dGVkIGluIHVzZXIgc2V0dGluZ3MuJykpO1xuXHRcdFx0cmV0dXJuIHRoaXMuX2VtcHR5V29ya3NwYWNlVGFza1Jlc3VsdHMod29ya3NwYWNlRm9sZGVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHsgd29ya3NwYWNlRm9sZGVyLCBzZXQ6IHsgdGFza3M6IGN1c3RvbSB9LCBjb25maWd1cmF0aW9uczogY3VzdG9taXplZFRhc2tzLCBoYXNFcnJvcnM6IGNvbmZpZ3VyYXRpb24uaGFzUGFyc2VFcnJvcnMgfTtcblx0fVxuXG5cdHByaXZhdGUgX2VtcHR5V29ya3NwYWNlVGFza1Jlc3VsdHMod29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyKTogSVdvcmtzcGFjZUZvbGRlclRhc2tSZXN1bHQge1xuXHRcdHJldHVybiB7IHdvcmtzcGFjZUZvbGRlciwgc2V0OiB1bmRlZmluZWQsIGNvbmZpZ3VyYXRpb25zOiB1bmRlZmluZWQsIGhhc0Vycm9yczogZmFsc2UgfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NvbXB1dGVUYXNrc0ZvclNpbmdsZUNvbmZpZyh3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIsIGNvbmZpZzogVGFza0NvbmZpZy5JRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZCwgcnVuU291cmNlOiBUYXNrUnVuU291cmNlLCBjdXN0b206IEN1c3RvbVRhc2tbXSwgY3VzdG9taXplZDogSVN0cmluZ0RpY3Rpb25hcnk8Q29uZmlndXJpbmdUYXNrPiwgc291cmNlOiBUYXNrQ29uZmlnLlRhc2tDb25maWdTb3VyY2UsIGlzUmVjZW50VGFzazogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKCFjb25maWcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9IGVsc2UgaWYgKCF3b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1Rhc2tTZXJ2aWNlLmNvbXB1dGVUYXNrc0ZvclNpbmdsZUNvbmZpZzogbm8gd29ya3NwYWNlIGZvbGRlciBmb3Igd29yc2tzcGFjZScsIHRoaXMuX3dvcmtzcGFjZT8uaWQpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCB0YXNrU3lzdGVtSW5mbzogSVRhc2tTeXN0ZW1JbmZvIHwgdW5kZWZpbmVkID0gdGhpcy5fZ2V0VGFza1N5c3RlbUluZm8od29ya3NwYWNlRm9sZGVyLnVyaS5zY2hlbWUpO1xuXHRcdGNvbnN0IHByb2JsZW1SZXBvcnRlciA9IG5ldyBQcm9ibGVtUmVwb3J0ZXIodGhpcy5fb3V0cHV0Q2hhbm5lbCk7XG5cdFx0Y29uc3QgcGFyc2VSZXN1bHQgPSBUYXNrQ29uZmlnLnBhcnNlKHdvcmtzcGFjZUZvbGRlciwgdGhpcy5fd29ya3NwYWNlLCB0YXNrU3lzdGVtSW5mbyA/IHRhc2tTeXN0ZW1JbmZvLnBsYXRmb3JtIDogUGxhdGZvcm0ucGxhdGZvcm0sIGNvbmZpZywgcHJvYmxlbVJlcG9ydGVyLCBzb3VyY2UsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLCBpc1JlY2VudFRhc2spO1xuXHRcdGxldCBoYXNFcnJvcnMgPSBmYWxzZTtcblx0XHRpZiAoIXBhcnNlUmVzdWx0LnZhbGlkYXRpb25TdGF0dXMuaXNPSygpICYmIChwYXJzZVJlc3VsdC52YWxpZGF0aW9uU3RhdHVzLnN0YXRlICE9PSBWYWxpZGF0aW9uU3RhdGUuSW5mbykpIHtcblx0XHRcdHRoaXMuX3Nob3dPdXRwdXQocnVuU291cmNlKTtcblx0XHRcdGhhc0Vycm9ycyA9IHRydWU7XG5cdFx0fVxuXHRcdGlmIChwcm9ibGVtUmVwb3J0ZXIuc3RhdHVzLmlzRmF0YWwoKSkge1xuXHRcdFx0cHJvYmxlbVJlcG9ydGVyLmZhdGFsKG5scy5sb2NhbGl6ZSgnVGFza1N5c3RlbS5jb25maWd1cmF0aW9uRXJyb3JzJywgJ0Vycm9yOiB0aGUgcHJvdmlkZWQgdGFzayBjb25maWd1cmF0aW9uIGhhcyB2YWxpZGF0aW9uIGVycm9ycyBhbmQgY2FuXFwndCBub3QgYmUgdXNlZC4gUGxlYXNlIGNvcnJlY3QgdGhlIGVycm9ycyBmaXJzdC4nKSk7XG5cdFx0XHRyZXR1cm4gaGFzRXJyb3JzO1xuXHRcdH1cblx0XHRpZiAocGFyc2VSZXN1bHQuY29uZmlndXJlZCAmJiBwYXJzZVJlc3VsdC5jb25maWd1cmVkLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgdGFzayBvZiBwYXJzZVJlc3VsdC5jb25maWd1cmVkKSB7XG5cdFx0XHRcdGN1c3RvbWl6ZWRbdGFzay5jb25maWd1cmVzLl9rZXldID0gdGFzaztcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCF0aGlzLl9qc29uVGFza3NTdXBwb3J0ZWQgJiYgKHBhcnNlUmVzdWx0LmN1c3RvbS5sZW5ndGggPiAwKSkge1xuXHRcdFx0Y29uc29sZS53YXJuKCdDdXN0b20gd29ya3NwYWNlIHRhc2tzIGFyZSBub3Qgc3VwcG9ydGVkLicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgcGFyc2VSZXN1bHQuY3VzdG9tKSB7XG5cdFx0XHRcdGN1c3RvbS5wdXNoKHRhc2spO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gaGFzRXJyb3JzO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZUNvbmZpZ3VyYXRpb24od29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyKTogUHJvbWlzZTxJV29ya3NwYWNlRm9sZGVyQ29uZmlndXJhdGlvblJlc3VsdD4ge1xuXHRcdGNvbnN0IHsgY29uZmlnLCBoYXNQYXJzZUVycm9ycyB9ID0gdGhpcy5fZ2V0Q29uZmlndXJhdGlvbih3b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmU8SVdvcmtzcGFjZUZvbGRlckNvbmZpZ3VyYXRpb25SZXN1bHQ+KHsgd29ya3NwYWNlRm9sZGVyLCBjb25maWcsIGhhc0Vycm9yczogaGFzUGFyc2VFcnJvcnMgfSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2NvbXB1dGVMZWdhY3lDb25maWd1cmF0aW9uKHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlcik6IFByb21pc2U8SVdvcmtzcGFjZUZvbGRlckNvbmZpZ3VyYXRpb25SZXN1bHQ+O1xuXG5cdHByaXZhdGUgX2NvbXB1dGVXb3Jrc3BhY2VGb2xkZXJTZXR1cCgpOiBbSVdvcmtzcGFjZUZvbGRlcltdLCBJV29ya3NwYWNlRm9sZGVyW10sIEV4ZWN1dGlvbkVuZ2luZSwgSnNvblNjaGVtYVZlcnNpb24sIElXb3Jrc3BhY2UgfCB1bmRlZmluZWRdIHtcblx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXJzOiBJV29ya3NwYWNlRm9sZGVyW10gPSBbXTtcblx0XHRjb25zdCBpZ25vcmVkV29ya3NwYWNlRm9sZGVyczogSVdvcmtzcGFjZUZvbGRlcltdID0gW107XG5cdFx0bGV0IGV4ZWN1dGlvbkVuZ2luZSA9IEV4ZWN1dGlvbkVuZ2luZS5UZXJtaW5hbDtcblx0XHRsZXQgc2NoZW1hVmVyc2lvbiA9IEpzb25TY2hlbWFWZXJzaW9uLlYyXzBfMDtcblx0XHRsZXQgd29ya3NwYWNlOiBJV29ya3NwYWNlIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLl9jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5GT0xERVIpIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciA9IHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnNbMF07XG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXJzLnB1c2god29ya3NwYWNlRm9sZGVyKTtcblx0XHRcdGV4ZWN1dGlvbkVuZ2luZSA9IHRoaXMuX2NvbXB1dGVFeGVjdXRpb25FbmdpbmUod29ya3NwYWNlRm9sZGVyKTtcblx0XHRcdHNjaGVtYVZlcnNpb24gPSB0aGlzLl9jb21wdXRlSnNvblNjaGVtYVZlcnNpb24od29ya3NwYWNlRm9sZGVyKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSkge1xuXHRcdFx0d29ya3NwYWNlID0gdGhpcy5fY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0XHRmb3IgKGNvbnN0IHdvcmtzcGFjZUZvbGRlciBvZiB0aGlzLl9jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzKSB7XG5cdFx0XHRcdGlmIChzY2hlbWFWZXJzaW9uID09PSB0aGlzLl9jb21wdXRlSnNvblNjaGVtYVZlcnNpb24od29ya3NwYWNlRm9sZGVyKSkge1xuXHRcdFx0XHRcdHdvcmtzcGFjZUZvbGRlcnMucHVzaCh3b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlnbm9yZWRXb3Jrc3BhY2VGb2xkZXJzLnB1c2god29ya3NwYWNlRm9sZGVyKTtcblx0XHRcdFx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKFxuXHRcdFx0XHRcdFx0J3Rhc2tTZXJ2aWNlLmlnbm9yaW5nRm9sZGVyJyxcblx0XHRcdFx0XHRcdCdJZ25vcmluZyB0YXNrIGNvbmZpZ3VyYXRpb25zIGZvciB3b3Jrc3BhY2UgZm9sZGVyIHswfS4gTXVsdGkgZm9sZGVyIHdvcmtzcGFjZSB0YXNrIHN1cHBvcnQgcmVxdWlyZXMgdGhhdCBhbGwgZm9sZGVycyB1c2UgdGFzayB2ZXJzaW9uIDIuMC4wJyxcblx0XHRcdFx0XHRcdHdvcmtzcGFjZUZvbGRlci51cmkuZnNQYXRoKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFt3b3Jrc3BhY2VGb2xkZXJzLCBpZ25vcmVkV29ya3NwYWNlRm9sZGVycywgZXhlY3V0aW9uRW5naW5lLCBzY2hlbWFWZXJzaW9uLCB3b3Jrc3BhY2VdO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZUV4ZWN1dGlvbkVuZ2luZSh3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIpOiBFeGVjdXRpb25FbmdpbmUge1xuXHRcdGNvbnN0IHsgY29uZmlnIH0gPSB0aGlzLl9nZXRDb25maWd1cmF0aW9uKHdvcmtzcGFjZUZvbGRlcik7XG5cdFx0aWYgKCFjb25maWcpIHtcblx0XHRcdHJldHVybiBFeGVjdXRpb25FbmdpbmUuX2RlZmF1bHQ7XG5cdFx0fVxuXHRcdHJldHVybiBUYXNrQ29uZmlnLkV4ZWN1dGlvbkVuZ2luZS5mcm9tKGNvbmZpZyk7XG5cdH1cblxuXHRwcml2YXRlIF9jb21wdXRlSnNvblNjaGVtYVZlcnNpb24od29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyKTogSnNvblNjaGVtYVZlcnNpb24ge1xuXHRcdGNvbnN0IHsgY29uZmlnIH0gPSB0aGlzLl9nZXRDb25maWd1cmF0aW9uKHdvcmtzcGFjZUZvbGRlcik7XG5cdFx0aWYgKCFjb25maWcpIHtcblx0XHRcdHJldHVybiBKc29uU2NoZW1hVmVyc2lvbi5WMl8wXzA7XG5cdFx0fVxuXHRcdHJldHVybiBUYXNrQ29uZmlnLkpzb25TY2hlbWFWZXJzaW9uLmZyb20oY29uZmlnKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0Q29uZmlndXJhdGlvbih3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIsIHNvdXJjZT86IHN0cmluZyk6IHsgY29uZmlnOiBUYXNrQ29uZmlnLklFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkOyBoYXNQYXJzZUVycm9yczogYm9vbGVhbiB9IHtcblx0XHRsZXQgcmVzdWx0O1xuXHRcdGlmICgoc291cmNlICE9PSBUYXNrU291cmNlS2luZC5Vc2VyKSAmJiAodGhpcy5fY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpKSB7XG5cdFx0XHRyZXN1bHQgPSB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHdob2xlQ29uZmlnID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDxUYXNrQ29uZmlnLklFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uPigndGFza3MnLCB7IHJlc291cmNlOiB3b3Jrc3BhY2VGb2xkZXIudXJpIH0pO1xuXHRcdFx0c3dpdGNoIChzb3VyY2UpIHtcblx0XHRcdFx0Y2FzZSBUYXNrU291cmNlS2luZC5Vc2VyOiB7XG5cdFx0XHRcdFx0aWYgKHdob2xlQ29uZmlnLnVzZXJWYWx1ZSAhPT0gd2hvbGVDb25maWcud29ya3NwYWNlRm9sZGVyVmFsdWUpIHtcblx0XHRcdFx0XHRcdHJlc3VsdCA9IE9iamVjdHMuZGVlcENsb25lKHdob2xlQ29uZmlnLnVzZXJWYWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgVGFza1NvdXJjZUtpbmQuV29ya3NwYWNlOiByZXN1bHQgPSBPYmplY3RzLmRlZXBDbG9uZSh3aG9sZUNvbmZpZy53b3Jrc3BhY2VGb2xkZXJWYWx1ZSk7IGJyZWFrO1xuXHRcdFx0XHRjYXNlIFRhc2tTb3VyY2VLaW5kLldvcmtzcGFjZUZpbGU6IHtcblx0XHRcdFx0XHRpZiAoKHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSlcblx0XHRcdFx0XHRcdCYmICh3aG9sZUNvbmZpZy53b3Jrc3BhY2VGb2xkZXJWYWx1ZSAhPT0gd2hvbGVDb25maWcud29ya3NwYWNlVmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQgPSBPYmplY3RzLmRlZXBDbG9uZSh3aG9sZUNvbmZpZy53b3Jrc3BhY2VWYWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRlZmF1bHQ6IHJlc3VsdCA9IE9iamVjdHMuZGVlcENsb25lKHdob2xlQ29uZmlnLndvcmtzcGFjZUZvbGRlclZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybiB7IGNvbmZpZzogdW5kZWZpbmVkLCBoYXNQYXJzZUVycm9yczogZmFsc2UgfTtcblx0XHR9XG5cdFx0Y29uc3QgcGFyc2VFcnJvcnM6IHN0cmluZ1tdID0gKHJlc3VsdCBhcyBhbnkpLiRwYXJzZUVycm9ycztcblx0XHRpZiAocGFyc2VFcnJvcnMpIHtcblx0XHRcdGxldCBpc0FmZmVjdGVkID0gZmFsc2U7XG5cdFx0XHRmb3IgKGNvbnN0IHBhcnNlRXJyb3Igb2YgcGFyc2VFcnJvcnMpIHtcblx0XHRcdFx0aWYgKC90YXNrc1xcLmpzb24kLy50ZXN0KHBhcnNlRXJyb3IpKSB7XG5cdFx0XHRcdFx0aXNBZmZlY3RlZCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChpc0FmZmVjdGVkKSB7XG5cdFx0XHRcdHRoaXMuX2xvZyhubHMubG9jYWxpemUoJ1Rhc2tTeXN0ZW0uaW52YWxpZFRhc2tKc29uJywgJ0Vycm9yOiBUaGUgY29udGVudCBvZiB0aGUgdGFza3MuanNvbiBmaWxlIGhhcyBzeW50YXggZXJyb3JzLiBQbGVhc2UgY29ycmVjdCB0aGVtIGJlZm9yZSBleGVjdXRpbmcgYSB0YXNrLicpKTtcblx0XHRcdFx0dGhpcy5fc2hvd091dHB1dCgpO1xuXHRcdFx0XHRyZXR1cm4geyBjb25maWc6IHVuZGVmaW5lZCwgaGFzUGFyc2VFcnJvcnM6IHRydWUgfTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHsgY29uZmlnOiByZXN1bHQsIGhhc1BhcnNlRXJyb3JzOiBmYWxzZSB9O1xuXHR9XG5cblx0cHVibGljIGluVGVybWluYWwoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX3Rhc2tTeXN0ZW0pIHtcblx0XHRcdHJldHVybiB0aGlzLl90YXNrU3lzdGVtIGluc3RhbmNlb2YgVGVybWluYWxUYXNrU3lzdGVtO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZXhlY3V0aW9uRW5naW5lID09PSBFeGVjdXRpb25FbmdpbmUuVGVybWluYWw7XG5cdH1cblxuXHRwdWJsaWMgY29uZmlndXJlQWN0aW9uKCk6IEFjdGlvbiB7XG5cdFx0Y29uc3QgdGhpc0NhcHR1cmU6IEFic3RyYWN0VGFza1NlcnZpY2UgPSB0aGlzO1xuXHRcdHJldHVybiBuZXcgY2xhc3MgZXh0ZW5kcyBBY3Rpb24ge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKENvbmZpZ3VyZVRhc2tBY3Rpb24uSUQsIENvbmZpZ3VyZVRhc2tBY3Rpb24uVEVYVC52YWx1ZSwgdW5kZWZpbmVkLCB0cnVlLCAoKSA9PiB7IHRoaXNDYXB0dXJlLl9ydW5Db25maWd1cmVUYXNrcygpOyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7IH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVFcnJvcihlcnI6IGFueSk6IHZvaWQge1xuXHRcdGxldCBzaG93T3V0cHV0ID0gdHJ1ZTtcblx0XHRpZiAoZXJyIGluc3RhbmNlb2YgVGFza0Vycm9yKSB7XG5cdFx0XHRjb25zdCBidWlsZEVycm9yID0gZXJyO1xuXHRcdFx0Y29uc3QgbmVlZHNDb25maWcgPSBidWlsZEVycm9yLmNvZGUgPT09IFRhc2tFcnJvcnMuTm90Q29uZmlndXJlZCB8fCBidWlsZEVycm9yLmNvZGUgPT09IFRhc2tFcnJvcnMuTm9CdWlsZFRhc2sgfHwgYnVpbGRFcnJvci5jb2RlID09PSBUYXNrRXJyb3JzLk5vVGVzdFRhc2s7XG5cdFx0XHRjb25zdCBuZWVkc1Rlcm1pbmF0ZSA9IGJ1aWxkRXJyb3IuY29kZSA9PT0gVGFza0Vycm9ycy5SdW5uaW5nVGFzaztcblx0XHRcdGlmIChuZWVkc0NvbmZpZyB8fCBuZWVkc1Rlcm1pbmF0ZSkge1xuXHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChidWlsZEVycm9yLnNldmVyaXR5LCBidWlsZEVycm9yLm1lc3NhZ2UsIFt7XG5cdFx0XHRcdFx0bGFiZWw6IG5lZWRzQ29uZmlnID8gQ29uZmlndXJlVGFza0FjdGlvbi5URVhULnZhbHVlIDogbmxzLmxvY2FsaXplKCdUZXJtaW5hdGVBY3Rpb24ubGFiZWwnLCBcIlRlcm1pbmF0ZSBUYXNrXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKG5lZWRzQ29uZmlnKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3J1bkNvbmZpZ3VyZVRhc2tzKCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9ydW5UZXJtaW5hdGVDb21tYW5kKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7IHNldmVyaXR5OiBidWlsZEVycm9yLnNldmVyaXR5LCBtZXNzYWdlOiBidWlsZEVycm9yLm1lc3NhZ2UgfSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuXHRcdFx0Y29uc3QgZXJyb3IgPSBlcnI7XG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0c2hvd091dHB1dCA9IGZhbHNlO1xuXHRcdH0gZWxzZSBpZiAoVHlwZXMuaXNTdHJpbmcoZXJyKSkge1xuXHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5lcnJvcig8c3RyaW5nPmVycik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobmxzLmxvY2FsaXplKCdUYXNrU3lzdGVtLnVua25vd25FcnJvcicsICdBbiBlcnJvciBoYXMgb2NjdXJyZWQgd2hpbGUgcnVubmluZyBhIHRhc2suIFNlZSB0YXNrIGxvZyBmb3IgZGV0YWlscy4nKSk7XG5cdFx0fVxuXHRcdGlmIChzaG93T3V0cHV0KSB7XG5cdFx0XHR0aGlzLl9zaG93T3V0cHV0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2hvd0RldGFpbCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oUVVJQ0tPUEVOX0RFVEFJTF9DT05GSUcpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfY3JlYXRlVGFza1F1aWNrUGlja0VudHJpZXModGFza3M6IFRhc2tbXSwgZ3JvdXA6IGJvb2xlYW4gPSBmYWxzZSwgc29ydDogYm9vbGVhbiA9IGZhbHNlLCBzZWxlY3RlZEVudHJ5PzogSVRhc2tRdWlja1BpY2tFbnRyeSwgaW5jbHVkZVJlY2VudHM6IGJvb2xlYW4gPSB0cnVlKTogUHJvbWlzZTxJVGFza1F1aWNrUGlja0VudHJ5W10+IHtcblx0XHRsZXQgZW5jb3VudGVyZWRUYXNrczogeyBba2V5OiBzdHJpbmddOiBJVGFza1F1aWNrUGlja0VudHJ5W10gfSA9IHt9O1xuXHRcdGlmICh0YXNrcyA9PT0gdW5kZWZpbmVkIHx8IHRhc2tzID09PSBudWxsIHx8IHRhc2tzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRjb25zdCBUYXNrUXVpY2tQaWNrRW50cnkgPSAodGFzazogVGFzayk6IElUYXNrUXVpY2tQaWNrRW50cnkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3RW50cnkgPSB7IGxhYmVsOiB0YXNrLl9sYWJlbCwgZGVzY3JpcHRpb246IHRoaXMuZ2V0VGFza0Rlc2NyaXB0aW9uKHRhc2spLCB0YXNrLCBkZXRhaWw6IHRoaXMuX3Nob3dEZXRhaWwoKSA/IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZGV0YWlsIDogdW5kZWZpbmVkIH07XG5cdFx0XHRpZiAoZW5jb3VudGVyZWRUYXNrc1t0YXNrLl9pZF0pIHtcblx0XHRcdFx0aWYgKGVuY291bnRlcmVkVGFza3NbdGFzay5faWRdLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdGVuY291bnRlcmVkVGFza3NbdGFzay5faWRdWzBdLmxhYmVsICs9ICcgKDEpJztcblx0XHRcdFx0fVxuXHRcdFx0XHRuZXdFbnRyeS5sYWJlbCA9IG5ld0VudHJ5LmxhYmVsICsgJyAoJyArIChlbmNvdW50ZXJlZFRhc2tzW3Rhc2suX2lkXS5sZW5ndGggKyAxKS50b1N0cmluZygpICsgJyknO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZW5jb3VudGVyZWRUYXNrc1t0YXNrLl9pZF0gPSBbXTtcblx0XHRcdH1cblx0XHRcdGVuY291bnRlcmVkVGFza3NbdGFzay5faWRdLnB1c2gobmV3RW50cnkpO1xuXHRcdFx0cmV0dXJuIG5ld0VudHJ5O1xuXG5cdFx0fTtcblx0XHRmdW5jdGlvbiBmaWxsRW50cmllcyhlbnRyaWVzOiBRdWlja1BpY2tJbnB1dDxJVGFza1F1aWNrUGlja0VudHJ5PltdLCB0YXNrczogVGFza1tdLCBncm91cExhYmVsOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdGlmICh0YXNrcy5sZW5ndGgpIHtcblx0XHRcdFx0ZW50cmllcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBncm91cExhYmVsIH0pO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIHRhc2tzKSB7XG5cdFx0XHRcdGNvbnN0IGVudHJ5OiBJVGFza1F1aWNrUGlja0VudHJ5ID0gVGFza1F1aWNrUGlja0VudHJ5KHRhc2spO1xuXHRcdFx0XHRlbnRyeS5idXR0b25zID0gW3sgaWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoY29uZmlndXJlVGFza0ljb24pLCB0b29sdGlwOiBubHMubG9jYWxpemUoJ2NvbmZpZ3VyZVRhc2snLCBcIkNvbmZpZ3VyZSBUYXNrXCIpIH1dO1xuXHRcdFx0XHRpZiAoc2VsZWN0ZWRFbnRyeSAmJiAodGFzayA9PT0gc2VsZWN0ZWRFbnRyeS50YXNrKSkge1xuXHRcdFx0XHRcdGVudHJpZXMudW5zaGlmdChzZWxlY3RlZEVudHJ5KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlbnRyaWVzLnB1c2goZW50cnkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGxldCBlbnRyaWVzOiBJVGFza1F1aWNrUGlja0VudHJ5W107XG5cdFx0aWYgKGdyb3VwKSB7XG5cdFx0XHRlbnRyaWVzID0gW107XG5cdFx0XHRpZiAodGFza3MubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdGVudHJpZXMucHVzaChUYXNrUXVpY2tQaWNrRW50cnkodGFza3NbMF0pKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHJlY2VudGx5VXNlZFRhc2tzID0gYXdhaXQgdGhpcy5nZXRTYXZlZFRhc2tzKCdoaXN0b3JpY2FsJyk7XG5cdFx0XHRcdGNvbnN0IHJlY2VudDogVGFza1tdID0gW107XG5cdFx0XHRcdGNvbnN0IHJlY2VudFNldDogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG5cdFx0XHRcdGxldCBjb25maWd1cmVkOiBUYXNrW10gPSBbXTtcblx0XHRcdFx0bGV0IGRldGVjdGVkOiBUYXNrW10gPSBbXTtcblx0XHRcdFx0Y29uc3QgdGFza01hcDogSVN0cmluZ0RpY3Rpb25hcnk8VGFzaz4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdFx0XHR0YXNrcy5mb3JFYWNoKHRhc2sgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGtleSA9IHRhc2suZ2V0Q29tbW9uVGFza0lkKCk7XG5cdFx0XHRcdFx0aWYgKGtleSkge1xuXHRcdFx0XHRcdFx0dGFza01hcFtrZXldID0gdGFzaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZWNlbnRseVVzZWRUYXNrcy5yZXZlcnNlKCkuZm9yRWFjaChyZWNlbnRUYXNrID0+IHtcblx0XHRcdFx0XHRjb25zdCBrZXkgPSByZWNlbnRUYXNrLmdldENvbW1vblRhc2tJZCgpO1xuXHRcdFx0XHRcdGlmIChrZXkpIHtcblx0XHRcdFx0XHRcdHJlY2VudFNldC5hZGQoa2V5KTtcblx0XHRcdFx0XHRcdGNvbnN0IHRhc2sgPSB0YXNrTWFwW2tleV07XG5cdFx0XHRcdFx0XHRpZiAodGFzaykge1xuXHRcdFx0XHRcdFx0XHRyZWNlbnQucHVzaCh0YXNrKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgdGFza3MpIHtcblx0XHRcdFx0XHRjb25zdCBrZXkgPSB0YXNrLmdldENvbW1vblRhc2tJZCgpO1xuXHRcdFx0XHRcdGlmICgha2V5IHx8ICFyZWNlbnRTZXQuaGFzKGtleSkpIHtcblx0XHRcdFx0XHRcdGlmICgodGFzay5fc291cmNlLmtpbmQgPT09IFRhc2tTb3VyY2VLaW5kLldvcmtzcGFjZSkgfHwgKHRhc2suX3NvdXJjZS5raW5kID09PSBUYXNrU291cmNlS2luZC5Vc2VyKSkge1xuXHRcdFx0XHRcdFx0XHRjb25maWd1cmVkLnB1c2godGFzayk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRkZXRlY3RlZC5wdXNoKHRhc2spO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBzb3J0ZXIgPSB0aGlzLmNyZWF0ZVNvcnRlcigpO1xuXHRcdFx0XHRpZiAoaW5jbHVkZVJlY2VudHMpIHtcblx0XHRcdFx0XHRmaWxsRW50cmllcyhlbnRyaWVzLCByZWNlbnQsIG5scy5sb2NhbGl6ZSgncmVjZW50bHlVc2VkJywgJ3JlY2VudGx5IHVzZWQgdGFza3MnKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uZmlndXJlZCA9IGNvbmZpZ3VyZWQuc29ydCgoYSwgYikgPT4gc29ydGVyLmNvbXBhcmUoYSwgYikpO1xuXHRcdFx0XHRmaWxsRW50cmllcyhlbnRyaWVzLCBjb25maWd1cmVkLCBubHMubG9jYWxpemUoJ2NvbmZpZ3VyZWQnLCAnY29uZmlndXJlZCB0YXNrcycpKTtcblx0XHRcdFx0ZGV0ZWN0ZWQgPSBkZXRlY3RlZC5zb3J0KChhLCBiKSA9PiBzb3J0ZXIuY29tcGFyZShhLCBiKSk7XG5cdFx0XHRcdGZpbGxFbnRyaWVzKGVudHJpZXMsIGRldGVjdGVkLCBubHMubG9jYWxpemUoJ2RldGVjdGVkJywgJ2RldGVjdGVkIHRhc2tzJykpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoc29ydCkge1xuXHRcdFx0XHRjb25zdCBzb3J0ZXIgPSB0aGlzLmNyZWF0ZVNvcnRlcigpO1xuXHRcdFx0XHR0YXNrcyA9IHRhc2tzLnNvcnQoKGEsIGIpID0+IHNvcnRlci5jb21wYXJlKGEsIGIpKTtcblx0XHRcdH1cblx0XHRcdGVudHJpZXMgPSB0YXNrcy5tYXA8SVRhc2tRdWlja1BpY2tFbnRyeT4odGFzayA9PiBUYXNrUXVpY2tQaWNrRW50cnkodGFzaykpO1xuXHRcdH1cblx0XHRlbmNvdW50ZXJlZFRhc2tzID0ge307XG5cdFx0cmV0dXJuIGVudHJpZXM7XG5cdH1cblx0cHJpdmF0ZSBhc3luYyBfc2hvd1R3b0xldmVsUXVpY2tQaWNrKHBsYWNlSG9sZGVyOiBzdHJpbmcsIGRlZmF1bHRFbnRyeT86IElUYXNrUXVpY2tQaWNrRW50cnksIHR5cGU/OiBzdHJpbmcsIG5hbWU/OiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGFza1F1aWNrUGljaykuc2hvdyhwbGFjZUhvbGRlciwgZGVmYXVsdEVudHJ5LCB0eXBlLCBuYW1lKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Nob3dRdWlja1BpY2sodGFza3M6IFByb21pc2U8VGFza1tdPiB8IFRhc2tbXSwgcGxhY2VIb2xkZXI6IHN0cmluZywgZGVmYXVsdEVudHJ5PzogSVRhc2tRdWlja1BpY2tFbnRyeSwgZ3JvdXA6IGJvb2xlYW4gPSBmYWxzZSwgc29ydDogYm9vbGVhbiA9IGZhbHNlLCBzZWxlY3RlZEVudHJ5PzogSVRhc2tRdWlja1BpY2tFbnRyeSwgYWRkaXRpb25hbEVudHJpZXM/OiBJVGFza1F1aWNrUGlja0VudHJ5W10sIG5hbWU/OiBzdHJpbmcpOiBQcm9taXNlPElUYXNrUXVpY2tQaWNrRW50cnkgfCB1bmRlZmluZWQgfCBudWxsPiB7XG5cdFx0Y29uc3QgcmVzb2x2ZWRUYXNrcyA9IGF3YWl0IHRhc2tzO1xuXHRcdGNvbnN0IGVudHJpZXM6IChJVGFza1F1aWNrUGlja0VudHJ5IHwgSVF1aWNrUGlja1NlcGFyYXRvcilbXSB8IHVuZGVmaW5lZCA9IGF3YWl0IHJhY2VUaW1lb3V0KHRoaXMuX2NyZWF0ZVRhc2tRdWlja1BpY2tFbnRyaWVzKHJlc29sdmVkVGFza3MsIGdyb3VwLCBzb3J0LCBzZWxlY3RlZEVudHJ5KSwgMjAwLCAoKSA9PiB1bmRlZmluZWQpO1xuXHRcdGlmICghZW50cmllcykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKGVudHJpZXMubGVuZ3RoID09PSAxICYmIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KFFVSUNLT1BFTl9TS0lQX0NPTkZJRykpIHtcblx0XHRcdHJldHVybiAoPElUYXNrUXVpY2tQaWNrRW50cnk+ZW50cmllc1swXSk7XG5cdFx0fSBlbHNlIGlmICgoZW50cmllcy5sZW5ndGggPT09IDApICYmIGRlZmF1bHRFbnRyeSkge1xuXHRcdFx0ZW50cmllcy5wdXNoKGRlZmF1bHRFbnRyeSk7XG5cdFx0fSBlbHNlIGlmIChlbnRyaWVzLmxlbmd0aCA+IDEgJiYgYWRkaXRpb25hbEVudHJpZXMgJiYgYWRkaXRpb25hbEVudHJpZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0ZW50cmllcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiAnJyB9KTtcblx0XHRcdGVudHJpZXMucHVzaChhZGRpdGlvbmFsRW50cmllc1swXSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLnBpY2s8SVRhc2tRdWlja1BpY2tFbnRyeT4oXG5cdFx0XHRlbnRyaWVzLFxuXHRcdFx0e1xuXHRcdFx0XHR2YWx1ZTogbmFtZSxcblx0XHRcdFx0cGxhY2VIb2xkZXIsXG5cdFx0XHRcdG1hdGNoT25EZXNjcmlwdGlvbjogdHJ1ZSxcblx0XHRcdFx0b25EaWRUcmlnZ2VySXRlbUJ1dHRvbjogY29udGV4dCA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgdGFzayA9IGNvbnRleHQuaXRlbS50YXNrO1xuXHRcdFx0XHRcdHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLmNhbmNlbCgpO1xuXHRcdFx0XHRcdGlmIChDb250cmlidXRlZFRhc2suaXModGFzaykpIHtcblx0XHRcdFx0XHRcdHRoaXMuY3VzdG9taXplKHRhc2ssIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChDdXN0b21UYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm9wZW5Db25maWcodGFzayk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9uZWVkc1JlY2VudFRhc2tzTWlncmF0aW9uKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5nZXRSZWNlbnRseVVzZWRUYXNrc1YxKCkuc2l6ZSA+IDApICYmICh0aGlzLl9nZXRUYXNrc0Zyb21TdG9yYWdlKCdoaXN0b3JpY2FsJykuc2l6ZSA9PT0gMCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9taWdyYXRlUmVjZW50VGFza3ModGFza3M6IFRhc2tbXSkge1xuXHRcdGlmICghdGhpcy5fbmVlZHNSZWNlbnRUYXNrc01pZ3JhdGlvbigpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHJlY2VudGx5VXNlZFRhc2tzID0gdGhpcy5nZXRSZWNlbnRseVVzZWRUYXNrc1YxKCk7XG5cdFx0Y29uc3QgdGFza01hcDogSVN0cmluZ0RpY3Rpb25hcnk8VGFzaz4gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRhc2tzLmZvckVhY2godGFzayA9PiB7XG5cdFx0XHRjb25zdCBrZXkgPSB0YXNrLmdldEtleSgpO1xuXHRcdFx0aWYgKGtleSkge1xuXHRcdFx0XHR0YXNrTWFwW2tleV0gPSB0YXNrO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IHJldmVyc2VkID0gWy4uLnJlY2VudGx5VXNlZFRhc2tzLmtleXMoKV0ucmV2ZXJzZSgpO1xuXHRcdGZvciAoY29uc3Qga2V5IGluIHJldmVyc2VkKSB7XG5cdFx0XHRjb25zdCB0YXNrID0gdGFza01hcFtrZXldO1xuXHRcdFx0aWYgKHRhc2spIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fc2V0UmVjZW50bHlVc2VkVGFzayh0YXNrKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2UucmVtb3ZlKEFic3RyYWN0VGFza1NlcnZpY2UuUmVjZW50bHlVc2VkVGFza3NfS2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0fVxuXG5cdHByaXZhdGUgX3Nob3dJZ25vcmVkRm9sZGVyc01lc3NhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuaWdub3JlZFdvcmtzcGFjZUZvbGRlcnMubGVuZ3RoID09PSAwIHx8ICF0aGlzLnNob3dJZ25vcmVNZXNzYWdlKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRTZXZlcml0eS5JbmZvLFxuXHRcdFx0bmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5pZ25vcmVkRm9sZGVyJywgJ1RoZSBmb2xsb3dpbmcgd29ya3NwYWNlIGZvbGRlcnMgYXJlIGlnbm9yZWQgc2luY2UgdGhleSB1c2UgdGFzayB2ZXJzaW9uIDAuMS4wOiB7MH0nLCB0aGlzLmlnbm9yZWRXb3Jrc3BhY2VGb2xkZXJzLm1hcChmID0+IGYubmFtZSkuam9pbignLCAnKSksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5ub3RBZ2FpbicsIFwiRG9uJ3QgU2hvdyBBZ2FpblwiKSxcblx0XHRcdFx0aXNTZWNvbmRhcnk6IHRydWUsXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKEFic3RyYWN0VGFza1NlcnZpY2UuSWdub3JlVGFzazAxMERvbm90U2hvd0FnYWluX2tleSwgdHJ1ZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRcdFx0XHR0aGlzLl9zaG93SWdub3JlTWVzc2FnZSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XVxuXHRcdCk7XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF90cnVzdCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoU2VydmVybGVzc1dlYkNvbnRleHQgJiYgIVRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuX3dvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uud29ya3NwYWNlVHJ1c3RJbml0aWFsaXplZDtcblx0XHRpZiAoIXRoaXMuX3dvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkpIHtcblx0XHRcdHJldHVybiAoYXdhaXQgdGhpcy5fd29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5yZXF1ZXN0V29ya3NwYWNlVHJ1c3QoXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLnJlcXVlc3RUcnVzdCcsIFwiTGlzdGluZyBhbmQgcnVubmluZyB0YXNrcyByZXF1aXJlcyB0aGF0IHNvbWUgb2YgdGhlIGZpbGVzIGluIHRoaXMgd29ya3NwYWNlIGJlIGV4ZWN1dGVkIGFzIGNvZGUuXCIpXG5cdFx0XHRcdH0pKSA9PT0gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9ydW5UYXNrQ29tbWFuZChmaWx0ZXI/OiBzdHJpbmcgfCBJVGFza0lkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX3Rhc2tzUmVjb25uZWN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCFmaWx0ZXIpIHtcblx0XHRcdHJldHVybiB0aGlzLl9kb1J1blRhc2tDb21tYW5kKCk7XG5cdFx0fVxuXHRcdGNvbnN0IHR5cGUgPSB0eXBlb2YgZmlsdGVyID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IGZpbHRlci50eXBlO1xuXHRcdGNvbnN0IHRhc2tOYW1lID0gdHlwZW9mIGZpbHRlciA9PT0gJ3N0cmluZycgPyBmaWx0ZXIgOiBmaWx0ZXIudGFzaztcblx0XHRjb25zdCBncm91cGVkID0gYXdhaXQgdGhpcy5fZ2V0R3JvdXBlZFRhc2tzKHsgdHlwZSB9KTtcblx0XHRjb25zdCBpZGVudGlmaWVyID0gdGhpcy5fZ2V0VGFza0lkZW50aWZpZXIoZmlsdGVyKTtcblx0XHRjb25zdCB0YXNrcyA9IGdyb3VwZWQuYWxsKCk7XG5cdFx0Y29uc3QgcmVzb2x2ZXIgPSB0aGlzLl9jcmVhdGVSZXNvbHZlcihncm91cGVkKTtcblx0XHRjb25zdCBmb2xkZXJVUklzOiAoVVJJIHwgc3RyaW5nKVtdID0gdGhpcy5fY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5tYXAoZm9sZGVyID0+IGZvbGRlci51cmkpO1xuXHRcdGlmICh0aGlzLl9jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0UpIHtcblx0XHRcdGZvbGRlclVSSXMucHVzaCh0aGlzLl9jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5jb25maWd1cmF0aW9uISk7XG5cdFx0fVxuXHRcdGZvbGRlclVSSXMucHVzaChVU0VSX1RBU0tTX0dST1VQX0tFWSk7XG5cdFx0aWYgKGlkZW50aWZpZXIpIHtcblx0XHRcdGZvciAoY29uc3QgdXJpIG9mIGZvbGRlclVSSXMpIHtcblx0XHRcdFx0Y29uc3QgdGFzayA9IGF3YWl0IHJlc29sdmVyLnJlc29sdmUodXJpLCBpZGVudGlmaWVyKTtcblx0XHRcdFx0aWYgKHRhc2spIHtcblx0XHRcdFx0XHR0aGlzLnJ1bih0YXNrKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgZXhhY3RNYXRjaFRhc2sgPSAhdGFza05hbWUgPyB1bmRlZmluZWQgOiB0YXNrcy5maW5kKHQgPT4gdC5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pZGVudGlmaWVyID09PSB0YXNrTmFtZSB8fCB0LmdldERlZmluaXRpb24odHJ1ZSk/LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzPy5pZGVudGlmaWVyID09PSB0YXNrTmFtZSk7XG5cdFx0aWYgKCFleGFjdE1hdGNoVGFzaykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2RvUnVuVGFza0NvbW1hbmQodGFza3MsIHR5cGUsIHRhc2tOYW1lKTtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCB1cmkgb2YgZm9sZGVyVVJJcykge1xuXHRcdFx0Y29uc3QgdGFzayA9IGF3YWl0IHJlc29sdmVyLnJlc29sdmUodXJpLCB0YXNrTmFtZSk7XG5cdFx0XHRpZiAodGFzaykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJ1bih0YXNrLCB7IGF0dGFjaFByb2JsZW1NYXRjaGVyOiB0cnVlIH0sIFRhc2tSdW5Tb3VyY2UuVXNlcik7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF90YXNrc0FuZEdyb3VwZWRUYXNrcyhmaWx0ZXI/OiBJVGFza0ZpbHRlcik6IHsgdGFza3M6IFByb21pc2U8VGFza1tdPjsgZ3JvdXBlZDogUHJvbWlzZTxUYXNrTWFwPiB9IHtcblx0XHRpZiAoIXRoaXMuX3ZlcnNpb25BbmRFbmdpbmVDb21wYXRpYmxlKGZpbHRlcikpIHtcblx0XHRcdHJldHVybiB7IHRhc2tzOiBQcm9taXNlLnJlc29sdmU8VGFza1tdPihbXSksIGdyb3VwZWQ6IFByb21pc2UucmVzb2x2ZShuZXcgVGFza01hcCgpKSB9O1xuXHRcdH1cblx0XHRjb25zdCBncm91cGVkID0gdGhpcy5fZ2V0R3JvdXBlZFRhc2tzKGZpbHRlcik7XG5cdFx0Y29uc3QgdGFza3MgPSBncm91cGVkLnRoZW4oKG1hcCkgPT4ge1xuXHRcdFx0aWYgKCFmaWx0ZXIgfHwgIWZpbHRlci50eXBlKSB7XG5cdFx0XHRcdHJldHVybiBtYXAuYWxsKCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXN1bHQ6IFRhc2tbXSA9IFtdO1xuXHRcdFx0bWFwLmZvckVhY2goKHRhc2tzKSA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0XHRcdGlmIChDb250cmlidXRlZFRhc2suaXModGFzaykgJiYgdGFzay5kZWZpbmVzLnR5cGUgPT09IGZpbHRlci50eXBlKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaCh0YXNrKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKEN1c3RvbVRhc2suaXModGFzaykpIHtcblx0XHRcdFx0XHRcdGlmICh0YXNrLnR5cGUgPT09IGZpbHRlci50eXBlKSB7XG5cdFx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKHRhc2spO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY3VzdG9taXplcyA9IHRhc2suY3VzdG9taXplcygpO1xuXHRcdFx0XHRcdFx0XHRpZiAoY3VzdG9taXplcyAmJiBjdXN0b21pemVzLnR5cGUgPT09IGZpbHRlci50eXBlKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmVzdWx0LnB1c2godGFzayk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9KTtcblx0XHRyZXR1cm4geyB0YXNrcywgZ3JvdXBlZCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfZG9SdW5UYXNrQ29tbWFuZCh0YXNrcz86IFRhc2tbXSwgdHlwZT86IHN0cmluZywgbmFtZT86IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHBpY2tUaGVuID0gKHRhc2s6IFRhc2sgfCB1bmRlZmluZWQgfCBudWxsKSA9PiB7XG5cdFx0XHRpZiAodGFzayA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICh0YXNrID09PSBudWxsKSB7XG5cdFx0XHRcdHRoaXMuX3J1bkNvbmZpZ3VyZVRhc2tzKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnJ1bih0YXNrLCB7IGF0dGFjaFByb2JsZW1NYXRjaGVyOiB0cnVlIH0sIFRhc2tSdW5Tb3VyY2UuVXNlcikudGhlbih1bmRlZmluZWQsIHJlYXNvbiA9PiB7XG5cdFx0XHRcdFx0Ly8gZWF0IHRoZSBlcnJvciwgaXQgaGFzIGFscmVhZHkgYmVlbiBzdXJmYWNlZCB0byB0aGUgdXNlciBhbmQgd2UgZG9uJ3QgY2FyZSBhYm91dCBpdCBoZXJlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBwbGFjZWhvbGRlciA9IG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2UucGlja1J1blRhc2snLCAnU2VsZWN0IHRoZSB0YXNrIHRvIHJ1bicpO1xuXG5cdFx0dGhpcy5fc2hvd0lnbm9yZWRGb2xkZXJzTWVzc2FnZSgpLnRoZW4oKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFVTRV9TTE9XX1BJQ0tFUikpIHtcblx0XHRcdFx0bGV0IHRhc2tSZXN1bHQ6IHsgdGFza3M6IFByb21pc2U8VGFza1tdPjsgZ3JvdXBlZDogUHJvbWlzZTxUYXNrTWFwPiB9IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoIXRhc2tzKSB7XG5cdFx0XHRcdFx0dGFza1Jlc3VsdCA9IHRoaXMuX3Rhc2tzQW5kR3JvdXBlZFRhc2tzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fc2hvd1F1aWNrUGljayh0YXNrcyA/IHRhc2tzIDogdGFza1Jlc3VsdCEudGFza3MsIHBsYWNlaG9sZGVyLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnJChwbHVzKSAnICsgbmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5ub0VudHJ5VG9SdW4nLCAnQ29uZmlndXJlIGEgVGFzaycpLFxuXHRcdFx0XHRcdFx0dGFzazogbnVsbFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dHJ1ZSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgbmFtZSkuXG5cdFx0XHRcdFx0dGhlbigoZW50cnkpID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiBwaWNrVGhlbihlbnRyeSA/IGVudHJ5LnRhc2sgOiB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fc2hvd1R3b0xldmVsUXVpY2tQaWNrKHBsYWNlaG9sZGVyLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnJChwbHVzKSAnICsgbmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5ub0VudHJ5VG9SdW4nLCAnQ29uZmlndXJlIGEgVGFzaycpLFxuXHRcdFx0XHRcdFx0dGFzazogbnVsbFxuXHRcdFx0XHRcdH0sIHR5cGUsIG5hbWUpLlxuXHRcdFx0XHRcdHRoZW4ocGlja1RoZW4pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblxuXHRyZXJ1bih0ZXJtaW5hbEluc3RhbmNlSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHRhc2sgPSB0aGlzLl90YXNrU3lzdGVtPy5nZXRUYXNrRm9yVGVybWluYWwodGVybWluYWxJbnN0YW5jZUlkKTtcblx0XHRpZiAodGFzaykge1xuXHRcdFx0dGhpcy5fcmVzdGFydCh0YXNrKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVSdW5UYXNrQ29tbWFuZCh0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9yZVJ1blRhc2tDb21tYW5kKG9ubHlSZXJ1bj86IGJvb2xlYW4pOiB2b2lkIHtcblxuXHRcdFByb2JsZW1NYXRjaGVyUmVnaXN0cnkub25SZWFkeSgpLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2VkaXRvclNlcnZpY2Uuc2F2ZUFsbCh7IHJlYXNvbjogU2F2ZVJlYXNvbi5BVVRPIH0pLnRoZW4oKCkgPT4geyAvLyBtYWtlIHN1cmUgYWxsIGRpcnR5IGVkaXRvcnMgYXJlIHNhdmVkXG5cdFx0XHRcdGNvbnN0IGV4ZWN1dGVSZXN1bHQgPSB0aGlzLl9nZXRUYXNrU3lzdGVtKCkucmVydW4oKTtcblx0XHRcdFx0aWYgKGV4ZWN1dGVSZXN1bHQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5faGFuZGxlRXhlY3V0ZVJlc3VsdChleGVjdXRlUmVzdWx0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoIW9ubHlSZXJ1biAmJiAhdGhpcy5fdGFza1J1bm5pbmdTdGF0ZS5nZXQoKSkge1xuXHRcdFx0XHRcdFx0Ly8gTm8gdGFzayBydW5uaW5nLCBwcm9tcHQgdG8gYXNrIHdoaWNoIHRvIHJ1blxuXHRcdFx0XHRcdFx0dGhpcy5fZG9SdW5UYXNrQ29tbWFuZCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB0YXNrcyAtIFRoZSB0YXNrcyB3aGljaCBuZWVkIHRvIGJlIGZpbHRlcmVkXG5cdCAqIEBwYXJhbSB0YXNrc0luTGlzdCAtIFRoaXMgdGVsbHMgc3BsaXRQZXJHcm91cFR5cGUgdG8gZmlsdGVyIG91dCBnbG9iYmVkIHRhc2tzIChpbnRvIGRlZmF1bHRzKVxuXHQgKiBAcmV0dXJuc1xuXHQgKi9cblx0cHJpdmF0ZSBfZ2V0RGVmYXVsdFRhc2tzKHRhc2tzOiBUYXNrW10sIHRhc2tHbG9ic0luTGlzdDogYm9vbGVhbiA9IGZhbHNlKTogVGFza1tdIHtcblx0XHRjb25zdCBkZWZhdWx0czogVGFza1tdID0gW107XG5cdFx0Zm9yIChjb25zdCB0YXNrIG9mIHRhc2tzLmZpbHRlcih0ID0+ICEhdC5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCkpIHtcblx0XHRcdC8vIEF0IHRoaXMgcG9pbnQgKGFzc3VtaW5nIHRhc2tHbG9ic0luTGlzdCBpcyB0cnVlKSB0aGVyZSBhcmUgdGFza3Mgd2l0aCBtYXRjaGluZyBnbG9icywgc28gb25seSBwdXQgdGhvc2UgaW4gZGVmYXVsdHNcblx0XHRcdGlmICh0YXNrR2xvYnNJbkxpc3QgJiYgdHlwZW9mICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwIGFzIFRhc2tHcm91cCkuaXNEZWZhdWx0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRkZWZhdWx0cy5wdXNoKHRhc2spO1xuXHRcdFx0fSBlbHNlIGlmICghdGFza0dsb2JzSW5MaXN0ICYmICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwIGFzIFRhc2tHcm91cCkuaXNEZWZhdWx0ID09PSB0cnVlKSB7XG5cdFx0XHRcdGRlZmF1bHRzLnB1c2godGFzayk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBkZWZhdWx0cztcblx0fVxuXG5cdHByaXZhdGUgX3J1blRhc2tHcm91cENvbW1hbmQodGFza0dyb3VwOiBUYXNrR3JvdXAsIHN0cmluZ3M6IHtcblx0XHRmZXRjaGluZzogc3RyaW5nO1xuXHRcdHNlbGVjdDogc3RyaW5nO1xuXHRcdG5vdEZvdW5kQ29uZmlndXJlOiBzdHJpbmc7XG5cdH0sIGNvbmZpZ3VyZTogKCkgPT4gdm9pZCwgbGVnYWN5Q29tbWFuZDogKCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnNjaGVtYVZlcnNpb24gPT09IEpzb25TY2hlbWFWZXJzaW9uLlYwXzFfMCkge1xuXHRcdFx0bGVnYWN5Q29tbWFuZCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBvcHRpb25zOiBJUHJvZ3Jlc3NPcHRpb25zID0ge1xuXHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uV2luZG93LFxuXHRcdFx0dGl0bGU6IHN0cmluZ3MuZmV0Y2hpbmdcblx0XHR9O1xuXHRcdGNvbnN0IHByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuXG5cdFx0XHRhc3luYyBmdW5jdGlvbiBydW5TaW5nbGVUYXNrKHRhc2s6IFRhc2sgfCB1bmRlZmluZWQsIHByb2JsZW1NYXRjaGVyT3B0aW9uczogSVByb2JsZW1NYXRjaGVyUnVuT3B0aW9ucyB8IHVuZGVmaW5lZCwgdGhhdDogQWJzdHJhY3RUYXNrU2VydmljZSkge1xuXHRcdFx0XHR0aGF0LnJ1bih0YXNrLCBwcm9ibGVtTWF0Y2hlck9wdGlvbnMsIFRhc2tSdW5Tb3VyY2UuVXNlcikudGhlbih1bmRlZmluZWQsIHJlYXNvbiA9PiB7XG5cdFx0XHRcdFx0Ly8gZWF0IHRoZSBlcnJvciwgaXQgaGFzIGFscmVhZHkgYmVlbiBzdXJmYWNlZCB0byB0aGUgdXNlciBhbmQgd2UgZG9uJ3QgY2FyZSBhYm91dCBpdCBoZXJlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY2hvb3NlQW5kUnVuVGFzayA9ICh0YXNrczogVGFza1tdKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3Nob3dJZ25vcmVkRm9sZGVyc01lc3NhZ2UoKS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9zaG93UXVpY2tQaWNrKHRhc2tzLFxuXHRcdFx0XHRcdFx0c3RyaW5ncy5zZWxlY3QsXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBzdHJpbmdzLm5vdEZvdW5kQ29uZmlndXJlLFxuXHRcdFx0XHRcdFx0XHR0YXNrOiBudWxsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0dHJ1ZSkudGhlbigoZW50cnkpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdGFzazogVGFzayB8IHVuZGVmaW5lZCB8IG51bGwgPSBlbnRyeSA/IGVudHJ5LnRhc2sgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdGlmICh0YXNrID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKHRhc2sgPT09IG51bGwpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25maWd1cmUuYXBwbHkodGhpcyk7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJ1blNpbmdsZVRhc2sodGFzaywgeyBhdHRhY2hQcm9ibGVtTWF0Y2hlcjogdHJ1ZSB9LCB0aGlzKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH07XG5cdFx0XHRsZXQgZ3JvdXBUYXNrczogKFRhc2sgfCBDb25maWd1cmluZ1Rhc2spW10gPSBbXTtcblx0XHRcdGNvbnN0IHsgZ2xvYkdyb3VwVGFza3MsIGdsb2JUYXNrc0RldGVjdGVkIH0gPSBhd2FpdCB0aGlzLl9nZXRHbG9iVGFza3ModGFza0dyb3VwLl9pZCk7XG5cdFx0XHRncm91cFRhc2tzID0gWy4uLmdsb2JHcm91cFRhc2tzXTtcblx0XHRcdGlmICghZ2xvYlRhc2tzRGV0ZWN0ZWQgJiYgZ3JvdXBUYXNrcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Z3JvdXBUYXNrcyA9IGF3YWl0IHRoaXMuX2ZpbmRXb3Jrc3BhY2VUYXNrc0luR3JvdXAodGFza0dyb3VwLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaGFuZGxlTXVsdGlwbGVUYXNrcyA9IChhcmVHbG9iVGFza3M6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2dldFRhc2tzRm9yR3JvdXAodGFza0dyb3VwKS50aGVuKCh0YXNrcykgPT4ge1xuXHRcdFx0XHRcdGlmICh0YXNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHQvLyBJZiB3ZSdyZSBkZWFsaW5nIHdpdGggdGFza3MgdGhhdCB3ZXJlIGNob3NlbiBiZWNhdXNlIG9mIGEgZ2xvYiBtYXRjaCxcblx0XHRcdFx0XHRcdC8vIHRoZW4gcHV0IGdsb2JzIGluIHRoZSBkZWZhdWx0cyBhbmQgZXZlcnl0aGluZyBlbHNlIGluIG5vbmVcblx0XHRcdFx0XHRcdGNvbnN0IGRlZmF1bHRzID0gdGhpcy5fZ2V0RGVmYXVsdFRhc2tzKHRhc2tzLCBhcmVHbG9iVGFza3MpO1xuXHRcdFx0XHRcdFx0aWYgKGRlZmF1bHRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdFx0XHRydW5TaW5nbGVUYXNrKGRlZmF1bHRzWzBdLCB1bmRlZmluZWQsIHRoaXMpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGRlZmF1bHRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdFx0dGFza3MgPSBkZWZhdWx0cztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBBdCB0aGlzIHRoaXMgcG9pbnQgdGhlcmUgYXJlIG11bHRpcGxlIHRhc2tzLlxuXHRcdFx0XHRcdGNob29zZUFuZFJ1blRhc2sodGFza3MpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc29sdmVUYXNrQW5kUnVuID0gKHRhc2tHcm91cFRhc2s6IFRhc2sgfCBDb25maWd1cmluZ1Rhc2spID0+IHtcblx0XHRcdFx0aWYgKENvbmZpZ3VyaW5nVGFzay5pcyh0YXNrR3JvdXBUYXNrKSkge1xuXHRcdFx0XHRcdHRoaXMudHJ5UmVzb2x2ZVRhc2sodGFza0dyb3VwVGFzaykudGhlbihyZXNvbHZlZFRhc2sgPT4ge1xuXHRcdFx0XHRcdFx0cnVuU2luZ2xlVGFzayhyZXNvbHZlZFRhc2ssIHVuZGVmaW5lZCwgdGhpcyk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cnVuU2luZ2xlVGFzayh0YXNrR3JvdXBUYXNrLCB1bmRlZmluZWQsIHRoaXMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHQvLyBBIHNpbmdsZSBkZWZhdWx0IGdsb2IgdGFzayB3YXMgcmV0dXJuZWQsIGp1c3QgcnVuIGl0IGRpcmVjdGx5XG5cdFx0XHRpZiAoZ3JvdXBUYXNrcy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0cmV0dXJuIHJlc29sdmVUYXNrQW5kUnVuKGdyb3VwVGFza3NbMF0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiB0aGVyZSdzIG11bHRpcGxlIGdsb2JzIHRoYXQgbWF0Y2ggd2Ugd2FudCB0byBzaG93IHRoZSBxdWljayBwaWNrZXIgZm9yIHRob3NlIHRhc2tzXG5cdFx0XHQvLyBXZSB3aWxsIG5lZWQgdG8gY2FsbCBzcGxpdFBlckdyb3VwVHlwZSBwdXR0aW5nIGdsb2JzIGluIGRlZmF1bHRzIGFuZCB0aGUgcmVtYWluaW5nIHRhc2tzIGluIG5vbmUuXG5cdFx0XHQvLyBXZSBkb24ndCBuZWVkIHRvIGNhcnJ5IG9uIGFmdGVyIGhlcmVcblx0XHRcdGlmIChnbG9iVGFza3NEZXRlY3RlZCAmJiBncm91cFRhc2tzLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0cmV0dXJuIGhhbmRsZU11bHRpcGxlVGFza3ModHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIG5vIGdsb2JzIGFyZSBmb3VuZCBvciBtYXRjaGVkIGZhbGxiYWNrIHRvIGNoZWNraW5nIGZvciBkZWZhdWx0IHRhc2tzIG9mIHRoZSB0YXNrIGdyb3VwXG5cdFx0XHRpZiAoIWdyb3VwVGFza3MubGVuZ3RoKSB7XG5cdFx0XHRcdGdyb3VwVGFza3MgPSBhd2FpdCB0aGlzLl9maW5kV29ya3NwYWNlVGFza3NJbkdyb3VwKHRhc2tHcm91cCwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChncm91cFRhc2tzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHQvLyBBIHNpbmdsZSBkZWZhdWx0IHRhc2sgd2FzIHJldHVybmVkLCBqdXN0IHJ1biBpdCBkaXJlY3RseVxuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZVRhc2tBbmRSdW4oZ3JvdXBUYXNrc1swXSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBNdWx0aXBsZSBkZWZhdWx0IHRhc2tzIHJldHVybmVkLCBzaG93IHRoZSBxdWlja1BpY2tlclxuXHRcdFx0cmV0dXJuIGhhbmRsZU11bHRpcGxlVGFza3MoZmFsc2UpO1xuXHRcdH0pKCk7XG5cdFx0dGhpcy5fcHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyhvcHRpb25zLCAoKSA9PiBwcm9taXNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2dldEdsb2JUYXNrcyh0YXNrR3JvdXBJZDogc3RyaW5nKTogUHJvbWlzZTx7IGdsb2JHcm91cFRhc2tzOiAoVGFzayB8IENvbmZpZ3VyaW5nVGFzaylbXTsgZ2xvYlRhc2tzRGV0ZWN0ZWQ6IGJvb2xlYW4gfT4ge1xuXHRcdGxldCBnbG9iVGFza3NEZXRlY3RlZCA9IGZhbHNlO1xuXHRcdC8vIEZpcnN0IGNoZWNrIGZvciBnbG9icyBiZWZvcmUgY2hlY2tpbmcgZm9yIHRoZSBkZWZhdWx0IHRhc2tzIG9mIHRoZSB0YXNrIGdyb3VwXG5cdFx0Y29uc3QgYWJzb2x1dGVVUkkgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yKTtcblx0XHRpZiAoYWJzb2x1dGVVUkkpIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihhYnNvbHV0ZVVSSSk7XG5cdFx0XHRpZiAod29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZ3VyZWRUYXNrcyA9IHRoaXMuX2dldENvbmZpZ3VyYXRpb24od29ya3NwYWNlRm9sZGVyKT8uY29uZmlnPy50YXNrcztcblx0XHRcdFx0aWYgKGNvbmZpZ3VyZWRUYXNrcykge1xuXHRcdFx0XHRcdGdsb2JUYXNrc0RldGVjdGVkID0gY29uZmlndXJlZFRhc2tzLmZpbHRlcih0YXNrID0+IHRhc2suZ3JvdXAgJiYgdHlwZW9mIHRhc2suZ3JvdXAgIT09ICdzdHJpbmcnICYmIHR5cGVvZiB0YXNrLmdyb3VwLmlzRGVmYXVsdCA9PT0gJ3N0cmluZycpLmxlbmd0aCA+IDA7XG5cdFx0XHRcdFx0Ly8gVGhpcyB3aWxsIGFjdGl2YXRlIGV4dGVuc2lvbnMsIHNvIG9ubHkgZG8gc28gaWYgbmVjZXNzYXJ5ICMxODU5NjBcblx0XHRcdFx0XHRpZiAoZ2xvYlRhc2tzRGV0ZWN0ZWQpIHtcblx0XHRcdFx0XHRcdC8vIEZhbGxiYWNrIHRvIGFic29sdXRlIHBhdGggb2YgdGhlIGZpbGUgaWYgaXQgaXMgbm90IGluIGEgd29ya3NwYWNlIG9yIHJlbGF0aXZlIHBhdGggY2Fubm90IGJlIGZvdW5kXG5cdFx0XHRcdFx0XHRjb25zdCByZWxhdGl2ZVBhdGggPSB3b3Jrc3BhY2VGb2xkZXI/LnVyaSA/IChyZXNvdXJjZXMucmVsYXRpdmVQYXRoKHdvcmtzcGFjZUZvbGRlci51cmksIGFic29sdXRlVVJJKSA/PyBhYnNvbHV0ZVVSSS5wYXRoKSA6IGFic29sdXRlVVJJLnBhdGg7XG5cblx0XHRcdFx0XHRcdGNvbnN0IGdsb2JHcm91cFRhc2tzID0gYXdhaXQgdGhpcy5fZmluZFdvcmtzcGFjZVRhc2tzKCh0YXNrKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGN1cnJlbnRUYXNrR3JvdXAgPSB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwO1xuXHRcdFx0XHRcdFx0XHRpZiAoY3VycmVudFRhc2tHcm91cCAmJiB0eXBlb2YgY3VycmVudFRhc2tHcm91cCAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIGN1cnJlbnRUYXNrR3JvdXAuaXNEZWZhdWx0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiAoY3VycmVudFRhc2tHcm91cC5faWQgPT09IHRhc2tHcm91cElkICYmIGdsb2IubWF0Y2goY3VycmVudFRhc2tHcm91cC5pc0RlZmF1bHQsIHJlbGF0aXZlUGF0aCkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0Z2xvYlRhc2tzRGV0ZWN0ZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4geyBnbG9iR3JvdXBUYXNrcywgZ2xvYlRhc2tzRGV0ZWN0ZWQgfTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHsgZ2xvYkdyb3VwVGFza3M6IFtdLCBnbG9iVGFza3NEZXRlY3RlZCB9O1xuXG5cdH1cblxuXHRwcml2YXRlIF9ydW5CdWlsZENvbW1hbmQoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90YXNrc1JlY29ubmVjdGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9ydW5UYXNrR3JvdXBDb21tYW5kKFRhc2tHcm91cC5CdWlsZCwge1xuXHRcdFx0ZmV0Y2hpbmc6IG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2UuZmV0Y2hpbmdCdWlsZFRhc2tzJywgJ0ZldGNoaW5nIGJ1aWxkIHRhc2tzLi4uJyksXG5cdFx0XHRzZWxlY3Q6IG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2UucGlja0J1aWxkVGFzaycsICdTZWxlY3QgdGhlIGJ1aWxkIHRhc2sgdG8gcnVuJyksXG5cdFx0XHRub3RGb3VuZENvbmZpZ3VyZTogbmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5ub0J1aWxkVGFzaycsICdObyBidWlsZCB0YXNrIHRvIHJ1biBmb3VuZC4gQ29uZmlndXJlIEJ1aWxkIFRhc2suLi4nKVxuXHRcdH0sIHRoaXMuX3J1bkNvbmZpZ3VyZURlZmF1bHRCdWlsZFRhc2ssIHRoaXMuX2J1aWxkKTtcblx0fVxuXG5cdHByaXZhdGUgX3J1blRlc3RDb21tYW5kKCk6IHZvaWQge1xuXHRcdHJldHVybiB0aGlzLl9ydW5UYXNrR3JvdXBDb21tYW5kKFRhc2tHcm91cC5UZXN0LCB7XG5cdFx0XHRmZXRjaGluZzogbmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5mZXRjaGluZ1Rlc3RUYXNrcycsICdGZXRjaGluZyB0ZXN0IHRhc2tzLi4uJyksXG5cdFx0XHRzZWxlY3Q6IG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2UucGlja1Rlc3RUYXNrJywgJ1NlbGVjdCB0aGUgdGVzdCB0YXNrIHRvIHJ1bicpLFxuXHRcdFx0bm90Rm91bmRDb25maWd1cmU6IG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2Uubm9UZXN0VGFza1Rlcm1pbmFsJywgJ05vIHRlc3QgdGFzayB0byBydW4gZm91bmQuIENvbmZpZ3VyZSBUYXNrcy4uLicpXG5cdFx0fSwgdGhpcy5fcnVuQ29uZmlndXJlRGVmYXVsdFRlc3RUYXNrLCB0aGlzLl9ydW5UZXN0KTtcblx0fVxuXG5cdHByaXZhdGUgX3J1blRlcm1pbmF0ZUNvbW1hbmQoYXJnPzogYW55KTogdm9pZCB7XG5cdFx0aWYgKGFyZyA9PT0gJ3Rlcm1pbmF0ZUFsbCcpIHtcblx0XHRcdHRoaXMuX3Rlcm1pbmF0ZUFsbCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBydW5RdWlja1BpY2sgPSAocHJvbWlzZT86IFByb21pc2U8VGFza1tdPikgPT4ge1xuXHRcdFx0dGhpcy5fc2hvd1F1aWNrUGljayhwcm9taXNlIHx8IHRoaXMuZ2V0QWN0aXZlVGFza3MoKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS50YXNrVG9UZXJtaW5hdGUnLCAnU2VsZWN0IGEgdGFzayB0byB0ZXJtaW5hdGUnKSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLm5vVGFza1J1bm5pbmcnLCAnTm8gdGFzayBpcyBjdXJyZW50bHkgcnVubmluZycpLFxuXHRcdFx0XHRcdHRhc2s6IHVuZGVmaW5lZFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmYWxzZSwgdHJ1ZSxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRbe1xuXHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLnRlcm1pbmF0ZUFsbFJ1bm5pbmdUYXNrcycsICdBbGwgUnVubmluZyBUYXNrcycpLFxuXHRcdFx0XHRcdGlkOiAndGVybWluYXRlQWxsJyxcblx0XHRcdFx0XHR0YXNrOiB1bmRlZmluZWRcblx0XHRcdFx0fV1cblx0XHRcdCkudGhlbihlbnRyeSA9PiB7XG5cdFx0XHRcdGlmIChlbnRyeSAmJiBlbnRyeS5pZCA9PT0gJ3Rlcm1pbmF0ZUFsbCcpIHtcblx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hdGVBbGwoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB0YXNrOiBUYXNrIHwgdW5kZWZpbmVkIHwgbnVsbCA9IGVudHJ5ID8gZW50cnkudGFzayA6IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKHRhc2sgPT09IHVuZGVmaW5lZCB8fCB0YXNrID09PSBudWxsKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudGVybWluYXRlKHRhc2spO1xuXHRcdFx0fSk7XG5cdFx0fTtcblx0XHRpZiAodGhpcy5pblRlcm1pbmFsKCkpIHtcblx0XHRcdGNvbnN0IGlkZW50aWZpZXIgPSB0aGlzLl9nZXRUYXNrSWRlbnRpZmllcihhcmcpO1xuXHRcdFx0bGV0IHByb21pc2U6IFByb21pc2U8VGFza1tdPjtcblx0XHRcdGlmIChpZGVudGlmaWVyICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cHJvbWlzZSA9IHRoaXMuZ2V0QWN0aXZlVGFza3MoKTtcblx0XHRcdFx0cHJvbWlzZS50aGVuKCh0YXNrcykgPT4ge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0XHRcdFx0aWYgKHRhc2subWF0Y2hlcyhpZGVudGlmaWVyKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnRlcm1pbmF0ZSh0YXNrKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRydW5RdWlja1BpY2socHJvbWlzZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cnVuUXVpY2tQaWNrKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2lzQWN0aXZlKCkudGhlbigoYWN0aXZlKSA9PiB7XG5cdFx0XHRcdGlmIChhY3RpdmUpIHtcblx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hdGVBbGwoKS50aGVuKChyZXNwb25zZXMpID0+IHtcblx0XHRcdFx0XHRcdC8vIHRoZSBvdXRwdXQgcnVubmVyIGhhcyBvbmx5IG9uZSB0YXNrXG5cdFx0XHRcdFx0XHRjb25zdCByZXNwb25zZSA9IHJlc3BvbnNlc1swXTtcblx0XHRcdFx0XHRcdGlmIChyZXNwb25zZS5zdWNjZXNzKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChyZXNwb25zZS5jb2RlICYmIHJlc3BvbnNlLmNvZGUgPT09IFRlcm1pbmF0ZVJlc3BvbnNlQ29kZS5Qcm9jZXNzTm90Rm91bmQpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihubHMubG9jYWxpemUoJ1Rlcm1pbmF0ZUFjdGlvbi5ub1Byb2Nlc3MnLCAnVGhlIGxhdW5jaGVkIHByb2Nlc3MgZG9lc25cXCd0IGV4aXN0IGFueW1vcmUuIElmIHRoZSB0YXNrIHNwYXduZWQgYmFja2dyb3VuZCB0YXNrcyBleGl0aW5nIFZTIENvZGUgbWlnaHQgcmVzdWx0IGluIG9ycGhhbmVkIHByb2Nlc3Nlcy4nKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKG5scy5sb2NhbGl6ZSgnVGVybWluYXRlQWN0aW9uLmZhaWxlZCcsICdGYWlsZWQgdG8gdGVybWluYXRlIHJ1bm5pbmcgdGFzaycpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcnVuUmVzdGFydFRhc2tDb21tYW5kKGFyZz86IGFueSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgYWN0aXZlVGFza3MgPSBhd2FpdCB0aGlzLmdldEFjdGl2ZVRhc2tzKCk7XG5cblx0XHRpZiAoYWN0aXZlVGFza3MubGVuZ3RoID09PSAxKSB7XG5cdFx0XHR0aGlzLl9yZXN0YXJ0KGFjdGl2ZVRhc2tzWzBdKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pblRlcm1pbmFsKCkpIHtcblx0XHRcdC8vIHRyeSBkaXNwYXRjaGluZyB1c2luZyB0YXNrIGlkZW50aWZpZXJcblx0XHRcdGNvbnN0IGlkZW50aWZpZXIgPSB0aGlzLl9nZXRUYXNrSWRlbnRpZmllcihhcmcpO1xuXHRcdFx0aWYgKGlkZW50aWZpZXIgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgYWN0aXZlVGFza3MpIHtcblx0XHRcdFx0XHRpZiAodGFzay5tYXRjaGVzKGlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9yZXN0YXJ0KHRhc2spO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gc2hvdyBxdWljayBwaWNrIHdpdGggYWN0aXZlIHRhc2tzXG5cdFx0XHRjb25zdCBlbnRyeSA9IGF3YWl0IHRoaXMuX3Nob3dRdWlja1BpY2soXG5cdFx0XHRcdGFjdGl2ZVRhc2tzLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLnRhc2tUb1Jlc3RhcnQnLCAnU2VsZWN0IHRoZSB0YXNrIHRvIHJlc3RhcnQnKSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLm5vVGFza1RvUmVzdGFydCcsICdObyB0YXNrIHRvIHJlc3RhcnQnKSxcblx0XHRcdFx0XHR0YXNrOiBudWxsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHR0cnVlXG5cdFx0XHQpO1xuXHRcdFx0aWYgKGVudHJ5ICYmIGVudHJ5LnRhc2spIHtcblx0XHRcdFx0dGhpcy5fcmVzdGFydChlbnRyeS50YXNrKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGFjdGl2ZVRhc2tzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy5fcmVzdGFydChhY3RpdmVUYXNrc1swXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VGFza0lkZW50aWZpZXIoZmlsdGVyPzogc3RyaW5nIHwgSVRhc2tJZGVudGlmaWVyKTogc3RyaW5nIHwgS2V5ZWRUYXNrSWRlbnRpZmllciB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IHJlc3VsdDogc3RyaW5nIHwgS2V5ZWRUYXNrSWRlbnRpZmllciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAoVHlwZXMuaXNTdHJpbmcoZmlsdGVyKSkge1xuXHRcdFx0cmVzdWx0ID0gZmlsdGVyO1xuXHRcdH0gZWxzZSBpZiAoZmlsdGVyICYmIFR5cGVzLmlzU3RyaW5nKGZpbHRlci50eXBlKSkge1xuXHRcdFx0cmVzdWx0ID0gVGFza0RlZmluaXRpb24uY3JlYXRlVGFza0lkZW50aWZpZXIoZmlsdGVyLCBjb25zb2xlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2NvbmZpZ0hhc1Rhc2tzKHRhc2tDb25maWc/OiBUYXNrQ29uZmlnLklFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGFza0NvbmZpZyAmJiAhIXRhc2tDb25maWcudGFza3MgJiYgdGFza0NvbmZpZy50YXNrcy5sZW5ndGggPiAwO1xuXHR9XG5cblx0cHJpdmF0ZSBfb3BlblRhc2tGaWxlKHJlc291cmNlOiBVUkksIHRhc2tTb3VyY2U6IHN0cmluZykge1xuXHRcdGxldCBjb25maWdGaWxlQ3JlYXRlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX2ZpbGVTZXJ2aWNlLnN0YXQocmVzb3VyY2UpLnRoZW4oKHN0YXQpID0+IHN0YXQsICgpID0+IHVuZGVmaW5lZCkudGhlbihhc3luYyAoc3RhdCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZUV4aXN0czogYm9vbGVhbiA9ICEhc3RhdDtcblx0XHRcdGNvbnN0IGNvbmZpZ1ZhbHVlID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDxUYXNrQ29uZmlnLklFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uPigndGFza3MnLCB7IHJlc291cmNlIH0pO1xuXHRcdFx0bGV0IHRhc2tzRXhpc3RJbkZpbGU6IGJvb2xlYW47XG5cdFx0XHRsZXQgdGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0O1xuXHRcdFx0c3dpdGNoICh0YXNrU291cmNlKSB7XG5cdFx0XHRcdGNhc2UgVGFza1NvdXJjZUtpbmQuVXNlcjogdGFza3NFeGlzdEluRmlsZSA9IHRoaXMuX2NvbmZpZ0hhc1Rhc2tzKGNvbmZpZ1ZhbHVlLnVzZXJWYWx1ZSk7IHRhcmdldCA9IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUjsgYnJlYWs7XG5cdFx0XHRcdGNhc2UgVGFza1NvdXJjZUtpbmQuV29ya3NwYWNlRmlsZTogdGFza3NFeGlzdEluRmlsZSA9IHRoaXMuX2NvbmZpZ0hhc1Rhc2tzKGNvbmZpZ1ZhbHVlLndvcmtzcGFjZVZhbHVlKTsgdGFyZ2V0ID0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0U7IGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OiB0YXNrc0V4aXN0SW5GaWxlID0gdGhpcy5fY29uZmlnSGFzVGFza3MoY29uZmlnVmFsdWUud29ya3NwYWNlRm9sZGVyVmFsdWUpOyB0YXJnZXQgPSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVI7XG5cdFx0XHR9XG5cdFx0XHRsZXQgY29udGVudDtcblx0XHRcdGlmICghdGFza3NFeGlzdEluRmlsZSkge1xuXHRcdFx0XHRjb25zdCBwaWNrVGVtcGxhdGVSZXN1bHQgPSBhd2FpdCB0aGlzLl9xdWlja0lucHV0U2VydmljZS5waWNrKGdldFRhc2tUZW1wbGF0ZXMoKSwgeyBwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS50ZW1wbGF0ZScsICdTZWxlY3QgYSBUYXNrIFRlbXBsYXRlJykgfSk7XG5cdFx0XHRcdGlmICghcGlja1RlbXBsYXRlUmVzdWx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnRlbnQgPSBwaWNrVGVtcGxhdGVSZXN1bHQuY29udGVudDtcblx0XHRcdFx0Y29uc3QgZWRpdG9yQ29uZmlnID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoKSBhcyBhbnk7XG5cdFx0XHRcdGlmIChlZGl0b3JDb25maWcuZWRpdG9yLmluc2VydFNwYWNlcykge1xuXHRcdFx0XHRcdGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoLyhcXG4pKFxcdCspL2csIChfLCBzMSwgczIpID0+IHMxICsgJyAnLnJlcGVhdChzMi5sZW5ndGggKiBlZGl0b3JDb25maWcuZWRpdG9yLnRhYlNpemUpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25maWdGaWxlQ3JlYXRlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghZmlsZUV4aXN0cyAmJiBjb250ZW50KSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl90ZXh0RmlsZVNlcnZpY2UuY3JlYXRlKFt7IHJlc291cmNlLCB2YWx1ZTogY29udGVudCB9XSkudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHRbMF0ucmVzb3VyY2U7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmIChmaWxlRXhpc3RzICYmICh0YXNrc0V4aXN0SW5GaWxlIHx8IGNvbnRlbnQpKSB7XG5cdFx0XHRcdGNvbnN0IHN0YXRSZXNvdXJjZSA9IHN0YXQ/LnJlc291cmNlO1xuXHRcdFx0XHRpZiAoY29udGVudCAmJiBzdGF0UmVzb3VyY2UpIHtcblx0XHRcdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZSgndGFza3MnLCBqc29uLnBhcnNlKGNvbnRlbnQpLCB7IHJlc291cmNlOiBzdGF0UmVzb3VyY2UgfSwgdGFyZ2V0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gc3RhdFJlc291cmNlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9KS50aGVuKChyZXNvdXJjZSkgPT4ge1xuXHRcdFx0aWYgKCFyZXNvdXJjZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdHBpbm5lZDogY29uZmlnRmlsZUNyZWF0ZWQgLy8gcGluIG9ubHkgaWYgY29uZmlnIGZpbGUgaXMgY3JlYXRlZCAjODcyN1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX2lzVGFza0VudHJ5KHZhbHVlOiBJUXVpY2tQaWNrSXRlbSk6IHZhbHVlIGlzIElRdWlja1BpY2tJdGVtICYgeyB0YXNrOiBUYXNrIH0ge1xuXHRcdGNvbnN0IGNhbmRpZGF0ZTogSVF1aWNrUGlja0l0ZW0gJiB7IHRhc2s6IFRhc2sgfSA9IHZhbHVlIGFzIGFueTtcblx0XHRyZXR1cm4gY2FuZGlkYXRlICYmICEhY2FuZGlkYXRlLnRhc2s7XG5cdH1cblxuXHRwcml2YXRlIF9pc1NldHRpbmdFbnRyeSh2YWx1ZTogSVF1aWNrUGlja0l0ZW0pOiB2YWx1ZSBpcyBJUXVpY2tQaWNrSXRlbSAmIHsgc2V0dGluZ1R5cGU6IHN0cmluZyB9IHtcblx0XHRjb25zdCBjYW5kaWRhdGU6IElRdWlja1BpY2tJdGVtICYgeyBzZXR0aW5nVHlwZTogc3RyaW5nIH0gPSB2YWx1ZSBhcyBhbnk7XG5cdFx0cmV0dXJuIGNhbmRpZGF0ZSAmJiAhIWNhbmRpZGF0ZS5zZXR0aW5nVHlwZTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbmZpZ3VyZVRhc2sodGFzazogVGFzaykge1xuXHRcdGlmIChDb250cmlidXRlZFRhc2suaXModGFzaykpIHtcblx0XHRcdHRoaXMuY3VzdG9taXplKHRhc2ssIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0fSBlbHNlIGlmIChDdXN0b21UYXNrLmlzKHRhc2spKSB7XG5cdFx0XHR0aGlzLm9wZW5Db25maWcodGFzayk7XG5cdFx0fSBlbHNlIGlmIChDb25maWd1cmluZ1Rhc2suaXModGFzaykpIHtcblx0XHRcdC8vIERvIG5vdGhpbmcuXG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlU2VsZWN0aW9uKHNlbGVjdGlvbjogVGFza1F1aWNrUGlja0VudHJ5VHlwZSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICghc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9pc1Rhc2tFbnRyeShzZWxlY3Rpb24pKSB7XG5cdFx0XHR0aGlzLl9jb25maWd1cmVUYXNrKHNlbGVjdGlvbi50YXNrKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2lzU2V0dGluZ0VudHJ5KHNlbGVjdGlvbikpIHtcblx0XHRcdGNvbnN0IHRhc2tRdWlja1BpY2sgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUYXNrUXVpY2tQaWNrKTtcblx0XHRcdHRhc2tRdWlja1BpY2suaGFuZGxlU2V0dGluZ09wdGlvbihzZWxlY3Rpb24uc2V0dGluZ1R5cGUpO1xuXHRcdH0gZWxzZSBpZiAoc2VsZWN0aW9uLmZvbGRlciAmJiAodGhpcy5fY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSAhPT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpKSB7XG5cdFx0XHR0aGlzLl9vcGVuVGFza0ZpbGUoc2VsZWN0aW9uLmZvbGRlci50b1Jlc291cmNlKCcudnNjb2RlL3Rhc2tzLmpzb24nKSwgVGFza1NvdXJjZUtpbmQuV29ya3NwYWNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLl9nZXRSZXNvdXJjZUZvcktpbmQoVGFza1NvdXJjZUtpbmQuVXNlcik7XG5cdFx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdFx0dGhpcy5fb3BlblRhc2tGaWxlKHJlc291cmNlLCBUYXNrU291cmNlS2luZC5Vc2VyKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0VGFza0Rlc2NyaXB0aW9uKHRhc2s6IFRhc2sgfCBDb25maWd1cmluZ1Rhc2spOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGxldCBkZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0YXNrLl9zb3VyY2Uua2luZCA9PT0gVGFza1NvdXJjZUtpbmQuVXNlcikge1xuXHRcdFx0ZGVzY3JpcHRpb24gPSBubHMubG9jYWxpemUoJ3Rhc2tRdWlja1BpY2sudXNlclNldHRpbmdzJywgJ1VzZXInKTtcblx0XHR9IGVsc2UgaWYgKHRhc2suX3NvdXJjZS5raW5kID09PSBUYXNrU291cmNlS2luZC5Xb3Jrc3BhY2VGaWxlKSB7XG5cdFx0XHRkZXNjcmlwdGlvbiA9IHRhc2suZ2V0V29ya3NwYWNlRmlsZU5hbWUoKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMubmVlZHNGb2xkZXJRdWFsaWZpY2F0aW9uKCkpIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHRhc2suZ2V0V29ya3NwYWNlRm9sZGVyKCk7XG5cdFx0XHRpZiAod29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uID0gd29ya3NwYWNlRm9sZGVyLm5hbWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBkZXNjcmlwdGlvbjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3J1bkNvbmZpZ3VyZVRhc2tzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghKGF3YWl0IHRoaXMuX3RydXN0KCkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHRhc2tQcm9taXNlOiBQcm9taXNlPFRhc2tNYXA+O1xuXHRcdGlmICh0aGlzLnNjaGVtYVZlcnNpb24gPT09IEpzb25TY2hlbWFWZXJzaW9uLlYyXzBfMCkge1xuXHRcdFx0dGFza1Byb21pc2UgPSB0aGlzLl9nZXRHcm91cGVkVGFza3MoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGFza1Byb21pc2UgPSBQcm9taXNlLnJlc29sdmUobmV3IFRhc2tNYXAoKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhdHMgPSB0aGlzLl9jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLm1hcDxQcm9taXNlPElGaWxlU3RhdFdpdGhQYXJ0aWFsTWV0YWRhdGEgfCB1bmRlZmluZWQ+PigoZm9sZGVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZmlsZVNlcnZpY2Uuc3RhdChmb2xkZXIudG9SZXNvdXJjZSgnLnZzY29kZS90YXNrcy5qc29uJykpLnRoZW4oc3RhdCA9PiBzdGF0LCAoKSA9PiB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY3JlYXRlTGFiZWwgPSBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLmNyZWF0ZUpzb25GaWxlJywgJ0NyZWF0ZSB0YXNrcy5qc29uIGZpbGUgZnJvbSB0ZW1wbGF0ZScpO1xuXHRcdGNvbnN0IG9wZW5MYWJlbCA9IG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2Uub3Blbkpzb25GaWxlJywgJ09wZW4gdGFza3MuanNvbiBmaWxlJyk7XG5cdFx0Y29uc3QgdG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRjb25zdCBjYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gPSB0b2tlblNvdXJjZS50b2tlbjtcblx0XHRjb25zdCBlbnRyaWVzID0gUHJvbWlzZS5hbGwoc3RhdHMpLnRoZW4oKHN0YXRzKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGFza1Byb21pc2UudGhlbigodGFza01hcCkgPT4ge1xuXHRcdFx0XHRjb25zdCBlbnRyaWVzOiBRdWlja1BpY2tJbnB1dDxUYXNrUXVpY2tQaWNrRW50cnlUeXBlPltdID0gW107XG5cdFx0XHRcdGxldCBjb25maWd1cmVkQ291bnQgPSAwO1xuXHRcdFx0XHRsZXQgdGFza3MgPSB0YXNrTWFwLmFsbCgpO1xuXHRcdFx0XHRpZiAodGFza3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdHRhc2tzID0gdGFza3Muc29ydCgoYSwgYikgPT4gYS5fbGFiZWwubG9jYWxlQ29tcGFyZShiLl9sYWJlbCkpO1xuXHRcdFx0XHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0XHRcdFx0Y29uc3QgZW50cnkgPSB7IGxhYmVsOiBUYXNrUXVpY2tQaWNrLmdldFRhc2tMYWJlbFdpdGhJY29uKHRhc2spLCB0YXNrLCBkZXNjcmlwdGlvbjogdGhpcy5nZXRUYXNrRGVzY3JpcHRpb24odGFzayksIGRldGFpbDogdGhpcy5fc2hvd0RldGFpbCgpID8gdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5kZXRhaWwgOiB1bmRlZmluZWQgfTtcblx0XHRcdFx0XHRcdFRhc2tRdWlja1BpY2suYXBwbHlDb2xvclN0eWxlcyh0YXNrLCBlbnRyeSwgdGhpcy5fdGhlbWVTZXJ2aWNlKTtcblx0XHRcdFx0XHRcdGVudHJpZXMucHVzaChlbnRyeSk7XG5cdFx0XHRcdFx0XHRpZiAoIUNvbnRyaWJ1dGVkVGFzay5pcyh0YXNrKSkge1xuXHRcdFx0XHRcdFx0XHRjb25maWd1cmVkQ291bnQrKztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgbmVlZHNDcmVhdGVPck9wZW4gPSAoY29uZmlndXJlZENvdW50ID09PSAwKTtcblx0XHRcdFx0Ly8gSWYgdGhlIG9ubHkgY29uZmlndXJlZCB0YXNrcyBhcmUgdXNlciB0YXNrcywgdGhlbiB3ZSBzaG91bGQgYWxzbyBzaG93IHRoZSBvcHRpb24gdG8gY3JlYXRlIGZyb20gYSB0ZW1wbGF0ZS5cblx0XHRcdFx0aWYgKG5lZWRzQ3JlYXRlT3JPcGVuIHx8ICh0YXNrTWFwLmdldChVU0VSX1RBU0tTX0dST1VQX0tFWSkubGVuZ3RoID09PSBjb25maWd1cmVkQ291bnQpKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSBzdGF0c1swXSAhPT0gdW5kZWZpbmVkID8gb3BlbkxhYmVsIDogY3JlYXRlTGFiZWw7XG5cdFx0XHRcdFx0aWYgKGVudHJpZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRlbnRyaWVzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJyB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZW50cmllcy5wdXNoKHsgbGFiZWwsIGZvbGRlcjogdGhpcy5fY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVyc1swXSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoKGVudHJpZXMubGVuZ3RoID09PSAxKSAmJiAhbmVlZHNDcmVhdGVPck9wZW4pIHtcblx0XHRcdFx0XHR0b2tlblNvdXJjZS5jYW5jZWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZW50cmllcztcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdGltZW91dDogYm9vbGVhbiA9IGF3YWl0IFByb21pc2UucmFjZShbbmV3IFByb21pc2U8Ym9vbGVhbj4oKHJlc29sdmUpID0+IHtcblx0XHRcdGVudHJpZXMudGhlbigoKSA9PiByZXNvbHZlKGZhbHNlKSk7XG5cdFx0fSksIG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlKSA9PiB7XG5cdFx0XHRjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQodGltZXIpO1xuXHRcdFx0XHRyZXNvbHZlKHRydWUpO1xuXHRcdFx0fSwgMjAwKTtcblx0XHR9KV0pO1xuXG5cdFx0aWYgKCF0aW1lb3V0ICYmICgoYXdhaXQgZW50cmllcykubGVuZ3RoID09PSAxKSAmJiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihRVUlDS09QRU5fU0tJUF9DT05GSUcpKSB7XG5cdFx0XHRjb25zdCBlbnRyeTogYW55ID0gKGF3YWl0IGVudHJpZXMpWzBdO1xuXHRcdFx0aWYgKGVudHJ5LnRhc2spIHtcblx0XHRcdFx0dGhpcy5faGFuZGxlU2VsZWN0aW9uKGVudHJ5KTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGVudHJpZXNXaXRoU2V0dGluZ3MgPSBlbnRyaWVzLnRoZW4ocmVzb2x2ZWRFbnRyaWVzID0+IHtcblx0XHRcdHJlc29sdmVkRW50cmllcy5wdXNoKC4uLlRhc2tRdWlja1BpY2suYWxsU2V0dGluZ0VudHJpZXModGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblx0XHRcdHJldHVybiByZXNvbHZlZEVudHJpZXM7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9xdWlja0lucHV0U2VydmljZS5waWNrKGVudHJpZXNXaXRoU2V0dGluZ3MsXG5cdFx0XHR7IHBsYWNlSG9sZGVyOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLnBpY2tUYXNrJywgJ1NlbGVjdCBhIHRhc2sgdG8gY29uZmlndXJlJykgfSwgY2FuY2VsbGF0aW9uVG9rZW4pLlxuXHRcdFx0dGhlbihhc3luYyAoc2VsZWN0aW9uKSA9PiB7XG5cdFx0XHRcdGlmIChjYW5jZWxsYXRpb25Ub2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdC8vIGNhbmNlbGVkIHdoZW4gdGhlcmUncyBvbmx5IG9uZSB0YXNrXG5cdFx0XHRcdFx0Y29uc3QgdGFzayA9IChhd2FpdCBlbnRyaWVzKVswXTtcblx0XHRcdFx0XHRpZiAoKDxhbnk+dGFzaykudGFzaykge1xuXHRcdFx0XHRcdFx0c2VsZWN0aW9uID0gPFRhc2tRdWlja1BpY2tFbnRyeVR5cGU+dGFzaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5faGFuZGxlU2VsZWN0aW9uKHNlbGVjdGlvbik7XG5cdFx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3J1bkNvbmZpZ3VyZURlZmF1bHRCdWlsZFRhc2soKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuc2NoZW1hVmVyc2lvbiA9PT0gSnNvblNjaGVtYVZlcnNpb24uVjJfMF8wKSB7XG5cdFx0XHR0aGlzLnRhc2tzKCkudGhlbigodGFza3MgPT4ge1xuXHRcdFx0XHRpZiAodGFza3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fcnVuQ29uZmlndXJlVGFza3MoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZW50cmllczogUXVpY2tQaWNrSW5wdXQ8VGFza1F1aWNrUGlja0VudHJ5VHlwZT5bXSA9IFtdO1xuXHRcdFx0XHRsZXQgc2VsZWN0ZWRUYXNrOiBUYXNrIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRsZXQgc2VsZWN0ZWRFbnRyeTogVGFza1F1aWNrUGlja0VudHJ5VHlwZSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fc2hvd0lnbm9yZWRGb2xkZXJzTWVzc2FnZSgpLnRoZW4oYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHsgZ2xvYkdyb3VwVGFza3MgfSA9IGF3YWl0IHRoaXMuX2dldEdsb2JUYXNrcyhUYXNrR3JvdXAuQnVpbGQuX2lkKTtcblx0XHRcdFx0XHRsZXQgZGVmYXVsdFRhc2tzID0gZ2xvYkdyb3VwVGFza3M7XG5cdFx0XHRcdFx0aWYgKCFkZWZhdWx0VGFza3M/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0ZGVmYXVsdFRhc2tzID0gdGhpcy5fZ2V0RGVmYXVsdFRhc2tzKHRhc2tzLCBmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGxldCBkZWZhdWx0QnVpbGRUYXNrO1xuXHRcdFx0XHRcdGlmIChkZWZhdWx0VGFza3MubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBncm91cDogc3RyaW5nIHwgVGFza0dyb3VwIHwgdW5kZWZpbmVkID0gZGVmYXVsdFRhc2tzWzBdLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwO1xuXHRcdFx0XHRcdFx0aWYgKGdyb3VwKSB7XG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgZ3JvdXAgPT09ICdzdHJpbmcnICYmIGdyb3VwID09PSBUYXNrR3JvdXAuQnVpbGQuX2lkKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdEJ1aWxkVGFzayA9IGRlZmF1bHRUYXNrc1swXTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRkZWZhdWx0QnVpbGRUYXNrID0gZGVmYXVsdFRhc2tzWzBdO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0XHRcdFx0aWYgKHRhc2sgPT09IGRlZmF1bHRCdWlsZFRhc2spIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLmRlZmF1bHRCdWlsZFRhc2tFeGlzdHMnLCAnezB9IGlzIGFscmVhZHkgbWFya2VkIGFzIHRoZSBkZWZhdWx0IGJ1aWxkIHRhc2snLCBUYXNrUXVpY2tQaWNrLmdldFRhc2tMYWJlbFdpdGhJY29uKHRhc2ssIHRhc2suZ2V0UXVhbGlmaWVkTGFiZWwoKSkpO1xuXHRcdFx0XHRcdFx0XHRzZWxlY3RlZFRhc2sgPSB0YXNrO1xuXHRcdFx0XHRcdFx0XHRzZWxlY3RlZEVudHJ5ID0geyBsYWJlbCwgdGFzaywgZGVzY3JpcHRpb246IHRoaXMuZ2V0VGFza0Rlc2NyaXB0aW9uKHRhc2spLCBkZXRhaWw6IHRoaXMuX3Nob3dEZXRhaWwoKSA/IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZGV0YWlsIDogdW5kZWZpbmVkIH07XG5cdFx0XHRcdFx0XHRcdFRhc2tRdWlja1BpY2suYXBwbHlDb2xvclN0eWxlcyh0YXNrLCBzZWxlY3RlZEVudHJ5LCB0aGlzLl90aGVtZVNlcnZpY2UpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZW50cnkgPSB7IGxhYmVsOiBUYXNrUXVpY2tQaWNrLmdldFRhc2tMYWJlbFdpdGhJY29uKHRhc2spLCB0YXNrLCBkZXNjcmlwdGlvbjogdGhpcy5nZXRUYXNrRGVzY3JpcHRpb24odGFzayksIGRldGFpbDogdGhpcy5fc2hvd0RldGFpbCgpID8gdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5kZXRhaWwgOiB1bmRlZmluZWQgfTtcblx0XHRcdFx0XHRcdFx0VGFza1F1aWNrUGljay5hcHBseUNvbG9yU3R5bGVzKHRhc2ssIGVudHJ5LCB0aGlzLl90aGVtZVNlcnZpY2UpO1xuXHRcdFx0XHRcdFx0XHRlbnRyaWVzLnB1c2goZW50cnkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoc2VsZWN0ZWRFbnRyeSkge1xuXHRcdFx0XHRcdFx0ZW50cmllcy51bnNoaWZ0KHNlbGVjdGVkRW50cnkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCB0b2tlblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdFx0XHRcdGNvbnN0IGNhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiA9IHRva2VuU291cmNlLnRva2VuO1xuXHRcdFx0XHRcdHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLnBpY2soZW50cmllcyxcblx0XHRcdFx0XHRcdHsgcGxhY2VIb2xkZXI6IG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2UucGlja1Rhc2snLCAnU2VsZWN0IGEgdGFzayB0byBjb25maWd1cmUnKSB9LCBjYW5jZWxsYXRpb25Ub2tlbikuXG5cdFx0XHRcdFx0XHR0aGVuKGFzeW5jIChlbnRyeSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoY2FuY2VsbGF0aW9uVG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBjYW5jZWxlZCB3aGVuIHRoZXJlJ3Mgb25seSBvbmUgdGFza1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHRhc2sgPSAoYXdhaXQgZW50cmllcylbMF07XG5cdFx0XHRcdFx0XHRcdFx0aWYgKCg8YW55PnRhc2spLnRhc2spIHtcblx0XHRcdFx0XHRcdFx0XHRcdGVudHJ5ID0gPFRhc2tRdWlja1BpY2tFbnRyeVR5cGU+dGFzaztcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0Y29uc3QgdGFzazogVGFzayB8IHVuZGVmaW5lZCB8IG51bGwgPSBlbnRyeSAmJiAndGFzaycgaW4gZW50cnkgPyBlbnRyeS50YXNrIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRpZiAoKHRhc2sgPT09IHVuZGVmaW5lZCkgfHwgKHRhc2sgPT09IG51bGwpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmICh0YXNrID09PSBzZWxlY3RlZFRhc2sgJiYgQ3VzdG9tVGFzay5pcyh0YXNrKSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMub3BlbkNvbmZpZyh0YXNrKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoIUluTWVtb3J5VGFzay5pcyh0YXNrKSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuY3VzdG9taXplKHRhc2ssIHsgZ3JvdXA6IHsga2luZDogJ2J1aWxkJywgaXNEZWZhdWx0OiB0cnVlIH0gfSwgdHJ1ZSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoc2VsZWN0ZWRUYXNrICYmICh0YXNrICE9PSBzZWxlY3RlZFRhc2spICYmICFJbk1lbW9yeVRhc2suaXMoc2VsZWN0ZWRUYXNrKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmN1c3RvbWl6ZShzZWxlY3RlZFRhc2ssIHsgZ3JvdXA6ICdidWlsZCcgfSwgZmFsc2UpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR0aGlzLl9xdWlja0lucHV0U2VydmljZS5waWNrKGVudHJpZXMsIHtcblx0XHRcdFx0XHRcdHBsYWNlSG9sZGVyOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLnBpY2tEZWZhdWx0QnVpbGRUYXNrJywgJ1NlbGVjdCB0aGUgdGFzayB0byBiZSB1c2VkIGFzIHRoZSBkZWZhdWx0IGJ1aWxkIHRhc2snKVxuXHRcdFx0XHRcdH0pLlxuXHRcdFx0XHRcdFx0dGhlbigoZW50cnkpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdGFzazogVGFzayB8IHVuZGVmaW5lZCB8IG51bGwgPSBlbnRyeSAmJiAndGFzaycgaW4gZW50cnkgPyBlbnRyeS50YXNrIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRpZiAoKHRhc2sgPT09IHVuZGVmaW5lZCkgfHwgKHRhc2sgPT09IG51bGwpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmICh0YXNrID09PSBzZWxlY3RlZFRhc2sgJiYgQ3VzdG9tVGFzay5pcyh0YXNrKSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMub3BlbkNvbmZpZyh0YXNrKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoIUluTWVtb3J5VGFzay5pcyh0YXNrKSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuY3VzdG9taXplKHRhc2ssIHsgZ3JvdXA6IHsga2luZDogJ2J1aWxkJywgaXNEZWZhdWx0OiB0cnVlIH0gfSwgdHJ1ZSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoc2VsZWN0ZWRUYXNrICYmICh0YXNrICE9PSBzZWxlY3RlZFRhc2spICYmICFJbk1lbW9yeVRhc2suaXMoc2VsZWN0ZWRUYXNrKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmN1c3RvbWl6ZShzZWxlY3RlZFRhc2ssIHsgZ3JvdXA6ICdidWlsZCcgfSwgZmFsc2UpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3J1bkNvbmZpZ3VyZVRhc2tzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcnVuQ29uZmlndXJlRGVmYXVsdFRlc3RUYXNrKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnNjaGVtYVZlcnNpb24gPT09IEpzb25TY2hlbWFWZXJzaW9uLlYyXzBfMCkge1xuXHRcdFx0dGhpcy50YXNrcygpLnRoZW4oKHRhc2tzID0+IHtcblx0XHRcdFx0aWYgKHRhc2tzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHRoaXMuX3J1bkNvbmZpZ3VyZVRhc2tzKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxldCBzZWxlY3RlZFRhc2s6IFRhc2sgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGxldCBzZWxlY3RlZEVudHJ5OiBJVGFza1F1aWNrUGlja0VudHJ5O1xuXG5cdFx0XHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0XHRcdGNvbnN0IHRhc2tHcm91cDogVGFza0dyb3VwIHwgdW5kZWZpbmVkID0gVGFza0dyb3VwLmZyb20odGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCk7XG5cdFx0XHRcdFx0aWYgKHRhc2tHcm91cCAmJiB0YXNrR3JvdXAuaXNEZWZhdWx0ICYmIHRhc2tHcm91cC5faWQgPT09IFRhc2tHcm91cC5UZXN0Ll9pZCkge1xuXHRcdFx0XHRcdFx0c2VsZWN0ZWRUYXNrID0gdGFzaztcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoc2VsZWN0ZWRUYXNrKSB7XG5cdFx0XHRcdFx0c2VsZWN0ZWRFbnRyeSA9IHtcblx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLmRlZmF1bHRUZXN0VGFza0V4aXN0cycsICd7MH0gaXMgYWxyZWFkeSBtYXJrZWQgYXMgdGhlIGRlZmF1bHQgdGVzdCB0YXNrLicsIHNlbGVjdGVkVGFzay5nZXRRdWFsaWZpZWRMYWJlbCgpKSxcblx0XHRcdFx0XHRcdHRhc2s6IHNlbGVjdGVkVGFzayxcblx0XHRcdFx0XHRcdGRldGFpbDogdGhpcy5fc2hvd0RldGFpbCgpID8gc2VsZWN0ZWRUYXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmRldGFpbCA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9zaG93SWdub3JlZEZvbGRlcnNNZXNzYWdlKCkudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fc2hvd1F1aWNrUGljayh0YXNrcyxcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnVGFza1NlcnZpY2UucGlja0RlZmF1bHRUZXN0VGFzaycsICdTZWxlY3QgdGhlIHRhc2sgdG8gYmUgdXNlZCBhcyB0aGUgZGVmYXVsdCB0ZXN0IHRhc2snKSwgdW5kZWZpbmVkLCB0cnVlLCBmYWxzZSwgc2VsZWN0ZWRFbnRyeSkudGhlbigoZW50cnkpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdGFzazogVGFzayB8IHVuZGVmaW5lZCB8IG51bGwgPSBlbnRyeSA/IGVudHJ5LnRhc2sgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdGlmICghdGFzaykge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAodGFzayA9PT0gc2VsZWN0ZWRUYXNrICYmIEN1c3RvbVRhc2suaXModGFzaykpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLm9wZW5Db25maWcodGFzayk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKCFJbk1lbW9yeVRhc2suaXModGFzaykpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmN1c3RvbWl6ZSh0YXNrLCB7IGdyb3VwOiB7IGtpbmQ6ICd0ZXN0JywgaXNEZWZhdWx0OiB0cnVlIH0gfSwgdHJ1ZSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoc2VsZWN0ZWRUYXNrICYmICh0YXNrICE9PSBzZWxlY3RlZFRhc2spICYmICFJbk1lbW9yeVRhc2suaXMoc2VsZWN0ZWRUYXNrKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmN1c3RvbWl6ZShzZWxlY3RlZFRhc2ssIHsgZ3JvdXA6ICd0ZXN0JyB9LCBmYWxzZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcnVuQ29uZmlndXJlVGFza3MoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuU2hvd1Rhc2tzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGFjdGl2ZVRhc2tzUHJvbWlzZTogUHJvbWlzZTxUYXNrW10+ID0gdGhpcy5nZXRBY3RpdmVUYXNrcygpO1xuXHRcdGNvbnN0IGFjdGl2ZVRhc2tzOiBUYXNrW10gPSBhd2FpdCBhY3RpdmVUYXNrc1Byb21pc2U7XG5cdFx0bGV0IGdyb3VwOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGFjdGl2ZVRhc2tzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0dGhpcy5fdGFza1N5c3RlbSEucmV2ZWFsVGFzayhhY3RpdmVUYXNrc1swXSk7XG5cdFx0fSBlbHNlIGlmIChhY3RpdmVUYXNrcy5sZW5ndGggJiYgYWN0aXZlVGFza3MuZXZlcnkoKHRhc2spID0+IHtcblx0XHRcdGlmIChJbk1lbW9yeVRhc2suaXModGFzaykpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHRcdGdyb3VwID0gdGFzay5jb21tYW5kLnByZXNlbnRhdGlvbj8uZ3JvdXA7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGFzay5jb21tYW5kLnByZXNlbnRhdGlvbj8uZ3JvdXAgJiYgKHRhc2suY29tbWFuZC5wcmVzZW50YXRpb24uZ3JvdXAgPT09IGdyb3VwKTtcblx0XHR9KSkge1xuXHRcdFx0dGhpcy5fdGFza1N5c3RlbSEucmV2ZWFsVGFzayhhY3RpdmVUYXNrc1swXSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3Nob3dRdWlja1BpY2soYWN0aXZlVGFza3NQcm9taXNlLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLnBpY2tTaG93VGFzaycsICdTZWxlY3QgdGhlIHRhc2sgdG8gc2hvdyBpdHMgb3V0cHV0JyksXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdUYXNrU2VydmljZS5ub1Rhc2tJc1J1bm5pbmcnLCAnTm8gdGFzayBpcyBydW5uaW5nJyksXG5cdFx0XHRcdFx0dGFzazogbnVsbFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmYWxzZSwgdHJ1ZVxuXHRcdFx0KS50aGVuKChlbnRyeSkgPT4ge1xuXHRcdFx0XHRjb25zdCB0YXNrOiBUYXNrIHwgdW5kZWZpbmVkIHwgbnVsbCA9IGVudHJ5ID8gZW50cnkudGFzayA6IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKHRhc2sgPT09IHVuZGVmaW5lZCB8fCB0YXNrID09PSBudWxsKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3Rhc2tTeXN0ZW0hLnJldmVhbFRhc2sodGFzayk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVUYXNrc0RvdE9sZChmb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIpOiBQcm9taXNlPFtVUkksIFVSSV0gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB0YXNrc0ZpbGUgPSBmb2xkZXIudG9SZXNvdXJjZSgnLnZzY29kZS90YXNrcy5qc29uJyk7XG5cdFx0aWYgKGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLmV4aXN0cyh0YXNrc0ZpbGUpKSB7XG5cdFx0XHRjb25zdCBvbGRGaWxlID0gdGFza3NGaWxlLndpdGgoeyBwYXRoOiBgJHt0YXNrc0ZpbGUucGF0aH0ub2xkYCB9KTtcblx0XHRcdGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLmNvcHkodGFza3NGaWxlLCBvbGRGaWxlLCB0cnVlKTtcblx0XHRcdHJldHVybiBbb2xkRmlsZSwgdGFza3NGaWxlXTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgX3VwZ3JhZGVUYXNrKHRhc2s6IFRhc2ssIHN1cHByZXNzVGFza05hbWU6IGJvb2xlYW4sIGdsb2JhbENvbmZpZzogeyB3aW5kb3dzPzogSUNvbW1hbmRVcGdyYWRlOyBvc3g/OiBJQ29tbWFuZFVwZ3JhZGU7IGxpbnV4PzogSUNvbW1hbmRVcGdyYWRlIH0pOiBUYXNrQ29uZmlnLklDdXN0b21UYXNrIHwgVGFza0NvbmZpZy5JQ29uZmlndXJpbmdUYXNrIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIUN1c3RvbVRhc2suaXModGFzaykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgY29uZmlnRWxlbWVudDogYW55ID0ge1xuXHRcdFx0bGFiZWw6IHRhc2suX2xhYmVsXG5cdFx0fTtcblx0XHRjb25zdCBvbGRUYXNrVHlwZXMgPSBuZXcgU2V0KFsnZ3VscCcsICdqYWtlJywgJ2dydW50J10pO1xuXHRcdGlmIChUeXBlcy5pc1N0cmluZyh0YXNrLmNvbW1hbmQubmFtZSkgJiYgb2xkVGFza1R5cGVzLmhhcyh0YXNrLmNvbW1hbmQubmFtZSkpIHtcblx0XHRcdGNvbmZpZ0VsZW1lbnQudHlwZSA9IHRhc2suY29tbWFuZC5uYW1lO1xuXHRcdFx0Y29uZmlnRWxlbWVudC50YXNrID0gdGFzay5jb21tYW5kLmFyZ3MhWzBdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodGFzay5jb21tYW5kLnJ1bnRpbWUgPT09IFJ1bnRpbWVUeXBlLlNoZWxsKSB7XG5cdFx0XHRcdGNvbmZpZ0VsZW1lbnQudHlwZSA9IFJ1bnRpbWVUeXBlLnRvU3RyaW5nKFJ1bnRpbWVUeXBlLlNoZWxsKTtcblx0XHRcdH1cblx0XHRcdGlmICh0YXNrLmNvbW1hbmQubmFtZSAmJiAhc3VwcHJlc3NUYXNrTmFtZSAmJiAhZ2xvYmFsQ29uZmlnLndpbmRvd3M/LmNvbW1hbmQgJiYgIWdsb2JhbENvbmZpZy5vc3g/LmNvbW1hbmQgJiYgIWdsb2JhbENvbmZpZy5saW51eD8uY29tbWFuZCkge1xuXHRcdFx0XHRjb25maWdFbGVtZW50LmNvbW1hbmQgPSB0YXNrLmNvbW1hbmQubmFtZTtcblx0XHRcdH0gZWxzZSBpZiAoc3VwcHJlc3NUYXNrTmFtZSkge1xuXHRcdFx0XHRjb25maWdFbGVtZW50LmNvbW1hbmQgPSB0YXNrLl9zb3VyY2UuY29uZmlnLmVsZW1lbnQuY29tbWFuZDtcblx0XHRcdH1cblx0XHRcdGlmICh0YXNrLmNvbW1hbmQuYXJncyAmJiAoIUFycmF5LmlzQXJyYXkodGFzay5jb21tYW5kLmFyZ3MpIHx8ICh0YXNrLmNvbW1hbmQuYXJncy5sZW5ndGggPiAwKSkpIHtcblx0XHRcdFx0aWYgKCFnbG9iYWxDb25maWcud2luZG93cz8uYXJncyAmJiAhZ2xvYmFsQ29uZmlnLm9zeD8uYXJncyAmJiAhZ2xvYmFsQ29uZmlnLmxpbnV4Py5hcmdzKSB7XG5cdFx0XHRcdFx0Y29uZmlnRWxlbWVudC5hcmdzID0gdGFzay5jb21tYW5kLmFyZ3M7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uZmlnRWxlbWVudC5hcmdzID0gdGFzay5fc291cmNlLmNvbmZpZy5lbGVtZW50LmFyZ3M7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcmVzZW50YXRpb24pIHtcblx0XHRcdGNvbmZpZ0VsZW1lbnQucHJlc2VudGF0aW9uID0gdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcmVzZW50YXRpb247XG5cdFx0fVxuXHRcdGlmICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlzQmFja2dyb3VuZCkge1xuXHRcdFx0Y29uZmlnRWxlbWVudC5pc0JhY2tncm91bmQgPSB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlzQmFja2dyb3VuZDtcblx0XHR9XG5cdFx0aWYgKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvYmxlbU1hdGNoZXJzKSB7XG5cdFx0XHRjb25maWdFbGVtZW50LnByb2JsZW1NYXRjaGVyID0gdGFzay5fc291cmNlLmNvbmZpZy5lbGVtZW50LnByb2JsZW1NYXRjaGVyO1xuXHRcdH1cblx0XHRpZiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCkge1xuXHRcdFx0Y29uZmlnRWxlbWVudC5ncm91cCA9IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXA7XG5cdFx0fVxuXG5cdFx0dGFzay5fc291cmNlLmNvbmZpZy5lbGVtZW50ID0gY29uZmlnRWxlbWVudDtcblx0XHRjb25zdCB0ZW1wVGFzayA9IG5ldyBDdXN0b21UYXNrKHRhc2suX2lkLCB0YXNrLl9zb3VyY2UsIHRhc2suX2xhYmVsLCB0YXNrLnR5cGUsIHRhc2suY29tbWFuZCwgdGFzay5oYXNEZWZpbmVkTWF0Y2hlcnMsIHRhc2sucnVuT3B0aW9ucywgdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcyk7XG5cdFx0Y29uc3QgY29uZmlnVGFzayA9IHRoaXMuX2NyZWF0ZUN1c3RvbWl6YWJsZVRhc2sodGVtcFRhc2spO1xuXHRcdGlmIChjb25maWdUYXNrKSB7XG5cdFx0XHRyZXR1cm4gY29uZmlnVGFzaztcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfdXBncmFkZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5zY2hlbWFWZXJzaW9uID09PSBKc29uU2NoZW1hVmVyc2lvbi5WMl8wXzApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX3dvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50Lm9uY2UodGhpcy5fd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZVRydXN0KShpc1RydXN0ZWQgPT4ge1xuXHRcdFx0XHRpZiAoaXNUcnVzdGVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fdXBncmFkZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFza3MgPSBhd2FpdCB0aGlzLl9nZXRHcm91cGVkVGFza3MoKTtcblx0XHRjb25zdCBmaWxlRGlmZnM6IFtVUkksIFVSSV1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIHRoaXMud29ya3NwYWNlRm9sZGVycykge1xuXHRcdFx0Y29uc3QgZGlmZiA9IGF3YWl0IHRoaXMuX2NyZWF0ZVRhc2tzRG90T2xkKGZvbGRlcik7XG5cdFx0XHRpZiAoZGlmZikge1xuXHRcdFx0XHRmaWxlRGlmZnMucHVzaChkaWZmKTtcblx0XHRcdH1cblx0XHRcdGlmICghZGlmZikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY29uZmlnVGFza3M6IChUYXNrQ29uZmlnLklDdXN0b21UYXNrIHwgVGFza0NvbmZpZy5JQ29uZmlndXJpbmdUYXNrKVtdID0gW107XG5cdFx0XHRjb25zdCBzdXBwcmVzc1Rhc2tOYW1lID0gISF0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUYXNrc1NjaGVtYVByb3BlcnRpZXMuU3VwcHJlc3NUYXNrTmFtZSwgeyByZXNvdXJjZTogZm9sZGVyLnVyaSB9KTtcblx0XHRcdGNvbnN0IGdsb2JhbENvbmZpZyA9IHtcblx0XHRcdFx0d2luZG93czogPElDb21tYW5kVXBncmFkZT50aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUYXNrc1NjaGVtYVByb3BlcnRpZXMuV2luZG93cywgeyByZXNvdXJjZTogZm9sZGVyLnVyaSB9KSxcblx0XHRcdFx0b3N4OiA8SUNvbW1hbmRVcGdyYWRlPnRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRhc2tzU2NoZW1hUHJvcGVydGllcy5Pc3gsIHsgcmVzb3VyY2U6IGZvbGRlci51cmkgfSksXG5cdFx0XHRcdGxpbnV4OiA8SUNvbW1hbmRVcGdyYWRlPnRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRhc2tzU2NoZW1hUHJvcGVydGllcy5MaW51eCwgeyByZXNvdXJjZTogZm9sZGVyLnVyaSB9KVxuXHRcdFx0fTtcblx0XHRcdHRhc2tzLmdldChmb2xkZXIpLmZvckVhY2godGFzayA9PiB7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZ1Rhc2sgPSB0aGlzLl91cGdyYWRlVGFzayh0YXNrLCBzdXBwcmVzc1Rhc2tOYW1lLCBnbG9iYWxDb25maWcpO1xuXHRcdFx0XHRpZiAoY29uZmlnVGFzaykge1xuXHRcdFx0XHRcdGNvbmZpZ1Rhc2tzLnB1c2goY29uZmlnVGFzayk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fdGFza1N5c3RlbSA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3dvcmtzcGFjZVRhc2tzUHJvbWlzZSA9IHVuZGVmaW5lZDtcblx0XHRcdGF3YWl0IHRoaXMuX3dyaXRlQ29uZmlndXJhdGlvbihmb2xkZXIsICd0YXNrcy50YXNrcycsIGNvbmZpZ1Rhc2tzKTtcblx0XHRcdGF3YWl0IHRoaXMuX3dyaXRlQ29uZmlndXJhdGlvbihmb2xkZXIsICd0YXNrcy52ZXJzaW9uJywgJzIuMC4wJyk7XG5cdFx0XHRpZiAodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGFza3NTY2hlbWFQcm9wZXJ0aWVzLlNob3dPdXRwdXQsIHsgcmVzb3VyY2U6IGZvbGRlci51cmkgfSkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoVGFza3NTY2hlbWFQcm9wZXJ0aWVzLlNob3dPdXRwdXQsIHVuZGVmaW5lZCwgeyByZXNvdXJjZTogZm9sZGVyLnVyaSB9KTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUYXNrc1NjaGVtYVByb3BlcnRpZXMuSXNTaGVsbENvbW1hbmQsIHsgcmVzb3VyY2U6IGZvbGRlci51cmkgfSkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoVGFza3NTY2hlbWFQcm9wZXJ0aWVzLklzU2hlbGxDb21tYW5kLCB1bmRlZmluZWQsIHsgcmVzb3VyY2U6IGZvbGRlci51cmkgfSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGFza3NTY2hlbWFQcm9wZXJ0aWVzLlN1cHByZXNzVGFza05hbWUsIHsgcmVzb3VyY2U6IGZvbGRlci51cmkgfSkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoVGFza3NTY2hlbWFQcm9wZXJ0aWVzLlN1cHByZXNzVGFza05hbWUsIHVuZGVmaW5lZCwgeyByZXNvdXJjZTogZm9sZGVyLnVyaSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fdXBkYXRlU2V0dXAoKTtcblxuXHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRmaWxlRGlmZnMubGVuZ3RoID09PSAxID9cblx0XHRcdFx0bmxzLmxvY2FsaXplKCd0YXNrU2VydmljZS51cGdyYWRlVmVyc2lvbicsIFwiVGhlIGRlcHJlY2F0ZWQgdGFza3MgdmVyc2lvbiAwLjEuMCBoYXMgYmVlbiByZW1vdmVkLiBZb3VyIHRhc2tzIGhhdmUgYmVlbiB1cGdyYWRlZCB0byB2ZXJzaW9uIDIuMC4wLiBPcGVuIHRoZSBkaWZmIHRvIHJldmlldyB0aGUgdXBncmFkZS5cIilcblx0XHRcdFx0OiBubHMubG9jYWxpemUoJ3Rhc2tTZXJ2aWNlLnVwZ3JhZGVWZXJzaW9uUGx1cmFsJywgXCJUaGUgZGVwcmVjYXRlZCB0YXNrcyB2ZXJzaW9uIDAuMS4wIGhhcyBiZWVuIHJlbW92ZWQuIFlvdXIgdGFza3MgaGF2ZSBiZWVuIHVwZ3JhZGVkIHRvIHZlcnNpb24gMi4wLjAuIE9wZW4gdGhlIGRpZmZzIHRvIHJldmlldyB0aGUgdXBncmFkZS5cIiksXG5cdFx0XHRbe1xuXHRcdFx0XHRsYWJlbDogZmlsZURpZmZzLmxlbmd0aCA9PT0gMSA/IG5scy5sb2NhbGl6ZSgndGFza1NlcnZpY2Uub3BlbkRpZmYnLCBcIk9wZW4gZGlmZlwiKSA6IG5scy5sb2NhbGl6ZSgndGFza1NlcnZpY2Uub3BlbkRpZmZzJywgXCJPcGVuIGRpZmZzXCIpLFxuXHRcdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHVwZ3JhZGUgb2YgZmlsZURpZmZzKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRcdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogdXBncmFkZVswXSB9LFxuXHRcdFx0XHRcdFx0XHRtb2RpZmllZDogeyByZXNvdXJjZTogdXBncmFkZVsxXSB9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1dXG5cdFx0KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGNBQWM7QUFFdkIsU0FBUyxTQUFTLGFBQWE7QUFDL0IsWUFBWSxVQUFVO0FBQ3RCLFlBQVksVUFBVTtBQUN0QixTQUFTLFlBQVksZUFBd0M7QUFDN0QsU0FBUyxVQUFVLGFBQWE7QUFDaEMsWUFBWSxhQUFhO0FBQ3pCLFNBQVMsaUJBQWlCLHdCQUF3QjtBQUNsRCxZQUFZLGNBQWM7QUFDMUIsU0FBUyw2QkFBNkI7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O0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNEO0FBQ0Q7QUFBQTtBQTkvR3NCLG9CQUdHLHdCQUF3QjtBQUgzQixvQkFJRywwQkFBMEI7QUFKN0Isb0JBS0csc0JBQXNCO0FBTHpCLG9CQU1HLGtDQUFrQztBQU5yQyxvQkFTUCxrQkFBMEI7QUFUbkIsb0JBVVAscUJBQTZCLElBQUksU0FBUyxTQUFTLE9BQU87QUFWbkQsb0JBWU4sY0FBc0I7QUFaaEIsc0JBQWY7QUFBQSxFQXdESjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0EzRm1COyIsCiAgIm5hbWVzIjogWyJDb25maWd1cmVUYXNrQWN0aW9uIiwgImRlZmF1bHRzIiwgImpzb24iLCAidGFza3MiLCAidGFzayIsICJTYXZlQmVmb3JlUnVuQ29uZmlnT3B0aW9ucyIsICJyZXN1bHQiLCAiZXJyb3IiLCAia2V5IiwgImZvbGRlciIsICJlbnRyaWVzIiwgInJlc291cmNlIiwgInN0YXRzIl0KfQo=
