import { asArray } from "../../../../base/common/arrays.js";
import * as Async from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { isUNC } from "../../../../base/common/extpath.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { LinkedMap, Touch } from "../../../../base/common/map.js";
import * as Objects from "../../../../base/common/objects.js";
import * as path from "../../../../base/common/path.js";
import * as Platform from "../../../../base/common/platform.js";
import * as resources from "../../../../base/common/resources.js";
import Severity from "../../../../base/common/severity.js";
import * as Types from "../../../../base/common/types.js";
import * as nls from "../../../../nls.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { Markers } from "../../markers/common/markers.js";
import { ProblemMatcherRegistry } from "../common/problemMatcher.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Schemas } from "../../../../base/common/network.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { formatMessageForTerminal } from "../../../../platform/terminal/common/terminalStrings.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { TaskTerminalStatus } from "./taskTerminalStatus.js";
import { ProblemCollectorEventKind, ProblemHandlingStrategy, StartStopProblemCollector, WatchingProblemCollector } from "../common/problemCollectors.js";
import { GroupKind } from "../common/taskConfiguration.js";
import { TaskError, TaskErrors, TaskExecuteKind, Triggers } from "../common/taskSystem.js";
import { CommandString, ContributedTask, CustomTask, DependsOrder, InMemoryTask, PanelKind, RevealKind, RevealProblemKind, RuntimeType, ShellQuoting, TASK_TERMINAL_ACTIVE, TaskEvent, TaskEventKind, TaskScope, TaskSourceKind } from "../common/tasks.js";
import { VSCodeOscProperty, VSCodeOscPt, VSCodeSequence } from "../../terminal/browser/terminalEscapeSequences.js";
import { TerminalProcessExtHostProxy } from "../../terminal/browser/terminalProcessExtHostProxy.js";
import { TERMINAL_VIEW_ID } from "../../terminal/common/terminal.js";
import { RerunForActiveTerminalCommandId, rerunTaskIcon } from "./task.contribution.js";
const ReconnectionType = "Task";
const _VariableResolver = class _VariableResolver {
  constructor(workspaceFolder, taskSystemInfo, values, _service) {
    this.workspaceFolder = workspaceFolder;
    this.taskSystemInfo = taskSystemInfo;
    this.values = values;
    this._service = _service;
  }
  async resolve(value) {
    const replacers = [];
    value.replace(_VariableResolver._regex, (match, ...args) => {
      replacers.push(this._replacer(match, args));
      return match;
    });
    const resolvedReplacers = await Promise.all(replacers);
    return value.replace(_VariableResolver._regex, () => resolvedReplacers.shift());
  }
  async _replacer(match, args) {
    const result = this.values.get(match.substring(2, match.length - 1));
    if (result !== void 0 && result !== null) {
      return result;
    }
    if (this._service) {
      return this._service.resolveAsync(this.workspaceFolder, match);
    }
    return match;
  }
};
_VariableResolver._regex = /\$\{(.*?)\}/g;
let VariableResolver = _VariableResolver;
class VerifiedTask {
  constructor(task, resolver, trigger) {
    this.task = task;
    this.resolver = resolver;
    this.trigger = trigger;
  }
  verify() {
    let verified = false;
    if (this.trigger && this.resolvedVariables && this.workspaceFolder && this.shellLaunchConfig !== void 0) {
      verified = true;
    }
    return verified;
  }
  getVerifiedTask() {
    if (this.verify()) {
      return { task: this.task, resolver: this.resolver, trigger: this.trigger, resolvedVariables: this.resolvedVariables, systemInfo: this.systemInfo, workspaceFolder: this.workspaceFolder, shellLaunchConfig: this.shellLaunchConfig };
    } else {
      throw new Error("VerifiedTask was not checked. verify must be checked before getVerifiedTask.");
    }
  }
}
const _TerminalTaskSystem = class _TerminalTaskSystem extends Disposable {
  constructor(_terminalService, _terminalGroupService, _outputService, _paneCompositeService, _viewsService, _markerService, _modelService, _configurationResolverService, _contextService, _environmentService, _outputChannelId, _fileService, _terminalProfileResolverService, _pathService, _viewDescriptorService, _logService, _notificationService, contextKeyService, instantiationService, taskSystemInfoResolver) {
    super();
    this._terminalService = _terminalService;
    this._terminalGroupService = _terminalGroupService;
    this._outputService = _outputService;
    this._paneCompositeService = _paneCompositeService;
    this._viewsService = _viewsService;
    this._markerService = _markerService;
    this._modelService = _modelService;
    this._configurationResolverService = _configurationResolverService;
    this._contextService = _contextService;
    this._environmentService = _environmentService;
    this._outputChannelId = _outputChannelId;
    this._fileService = _fileService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._pathService = _pathService;
    this._viewDescriptorService = _viewDescriptorService;
    this._logService = _logService;
    this._notificationService = _notificationService;
    this._isRerun = false;
    this._terminalCreationQueue = Promise.resolve();
    this._hasReconnected = false;
    this._terminalTabActions = [{ id: RerunForActiveTerminalCommandId, label: nls.localize("rerunTask", "Rerun Task"), icon: rerunTaskIcon }];
    this._activeTasks = /* @__PURE__ */ Object.create(null);
    this._busyTasks = /* @__PURE__ */ Object.create(null);
    this._terminals = /* @__PURE__ */ Object.create(null);
    this._idleTaskTerminals = new LinkedMap();
    this._sameTaskTerminals = /* @__PURE__ */ Object.create(null);
    this._onDidStateChange = new Emitter();
    this._taskSystemInfoResolver = taskSystemInfoResolver;
    this._register(this._terminalStatusManager = instantiationService.createInstance(TaskTerminalStatus));
    this._taskTerminalActive = TASK_TERMINAL_ACTIVE.bindTo(contextKeyService);
    this._register(this._terminalService.onDidChangeActiveInstance((e) => this._taskTerminalActive.set(e?.shellLaunchConfig.type === "Task")));
  }
  taskShellIntegrationStartSequence(cwd) {
    return VSCodeSequence(VSCodeOscPt.PromptStart) + VSCodeSequence(VSCodeOscPt.Property, `${VSCodeOscProperty.Task}=True`) + (cwd ? VSCodeSequence(VSCodeOscPt.Property, `${VSCodeOscProperty.Cwd}=${typeof cwd === "string" ? cwd : cwd.fsPath}`) : "") + VSCodeSequence(VSCodeOscPt.CommandStart);
  }
  get taskShellIntegrationOutputSequence() {
    return VSCodeSequence(VSCodeOscPt.CommandExecuted);
  }
  get onDidStateChange() {
    return this._onDidStateChange.event;
  }
  _log(value) {
    this._appendOutput(value + "\n");
  }
  _showOutput() {
    this._outputService.showChannel(this._outputChannelId, true);
  }
  reconnect(task, resolver) {
    this._reconnectToTerminals();
    return this.run(task, resolver, Triggers.reconnect);
  }
  run(task, resolver, trigger = Triggers.command) {
    task = task.clone();
    const instances = InMemoryTask.is(task) || this._isTaskEmpty(task) ? [] : this._getInstances(task);
    const validInstance = instances.length < ((task.runOptions && task.runOptions.instanceLimit) ?? 1);
    const instance = instances[0]?.count?.count ?? 0;
    this._currentTask = new VerifiedTask(task, resolver, trigger);
    if (instance > 0) {
      task.instance = instance;
    }
    if (!validInstance) {
      const terminalData = instances[instances.length - 1];
      this._lastTask = this._currentTask;
      return { kind: TaskExecuteKind.Active, task: terminalData.task, active: { same: true, background: task.configurationProperties.isBackground }, promise: terminalData.promise };
    }
    try {
      const executeResult = { kind: TaskExecuteKind.Started, task, started: {}, promise: this._executeTask(task, resolver, trigger, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Map(), void 0) };
      executeResult.promise.then((summary) => {
        this._lastTask = this._currentTask;
      });
      return executeResult;
    } catch (error) {
      if (error instanceof TaskError) {
        throw error;
      } else if (error instanceof Error) {
        this._log(error.message);
        throw new TaskError(Severity.Error, error.message, TaskErrors.UnknownError);
      } else {
        this._log(error.toString());
        throw new TaskError(Severity.Error, nls.localize("TerminalTaskSystem.unknownError", "A unknown error has occurred while executing a task. See task output log for details."), TaskErrors.UnknownError);
      }
    }
  }
  rerun() {
    if (this._lastTask && this._lastTask.verify()) {
      if (this._lastTask.task.runOptions.reevaluateOnRerun !== void 0 && !this._lastTask.task.runOptions.reevaluateOnRerun) {
        this._isRerun = true;
      }
      const result = this.run(this._lastTask.task, this._lastTask.resolver);
      result.promise.then((summary) => {
        this._isRerun = false;
      });
      return result;
    } else {
      return void 0;
    }
  }
  _showTaskLoadErrors(task) {
    if (task.taskLoadMessages && task.taskLoadMessages.length > 0) {
      task.taskLoadMessages.forEach((loadMessage) => {
        this._log(loadMessage + "\n");
      });
      const openOutput = "Show Output";
      this._notificationService.prompt(
        Severity.Warning,
        nls.localize(
          "TerminalTaskSystem.taskLoadReporting",
          'There are issues with task "{0}". See the output for more details.',
          task._label
        ),
        [{
          label: openOutput,
          run: () => this._showOutput()
        }]
      );
    }
  }
  isTaskVisible(task) {
    const terminalData = this._activeTasks[task.getMapKey()];
    if (!terminalData?.terminal) {
      return false;
    }
    const activeTerminalInstance = this._terminalService.activeInstance;
    const isPanelShowingTerminal = !!this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
    return isPanelShowingTerminal && activeTerminalInstance?.instanceId === terminalData.terminal.instanceId;
  }
  revealTask(task) {
    const terminalData = this._activeTasks[task.getMapKey()];
    if (!terminalData?.terminal) {
      return false;
    }
    const isTerminalInPanel = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID) === ViewContainerLocation.Panel;
    if (isTerminalInPanel && this.isTaskVisible(task)) {
      if (this._previousPanelId) {
        if (this._previousTerminalInstance) {
          this._terminalService.setActiveInstance(this._previousTerminalInstance);
        }
        this._paneCompositeService.openPaneComposite(this._previousPanelId, ViewContainerLocation.Panel);
      } else {
        this._paneCompositeService.hideActivePaneComposite(ViewContainerLocation.Panel);
      }
      this._previousPanelId = void 0;
      this._previousTerminalInstance = void 0;
    } else {
      if (isTerminalInPanel) {
        this._previousPanelId = this._paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel)?.getId();
        if (this._previousPanelId === TERMINAL_VIEW_ID) {
          this._previousTerminalInstance = this._terminalService.activeInstance ?? void 0;
        }
      }
      this._terminalService.setActiveInstance(terminalData.terminal);
      if (CustomTask.is(task) || ContributedTask.is(task)) {
        this._terminalGroupService.showPanel(task.command.presentation.focus);
      }
    }
    return true;
  }
  isActive() {
    return Promise.resolve(this.isActiveSync());
  }
  isActiveSync() {
    return Object.values(this._activeTasks).some((value) => !!value.terminal);
  }
  canAutoTerminate() {
    return Object.values(this._activeTasks).every((value) => !value.task.configurationProperties.promptOnClose);
  }
  getActiveTasks() {
    return Object.values(this._activeTasks).flatMap((value) => value.terminal ? value.task : []);
  }
  getLastInstance(task) {
    const recentKey = task.getKey();
    return Object.values(this._activeTasks).reverse().find(
      (value) => recentKey && recentKey === value.task.getKey()
    )?.task;
  }
  getBusyTasks() {
    return Object.keys(this._busyTasks).map((key) => this._busyTasks[key]);
  }
  customExecutionComplete(task, result) {
    const activeTerminal = this._activeTasks[task.getMapKey()];
    if (!activeTerminal?.terminal) {
      return Promise.reject(new Error("Expected to have a terminal for a custom execution task"));
    }
    return new Promise((resolve) => {
      resolve();
    });
  }
  _getInstances(task) {
    const recentKey = task.getKey();
    return Object.values(this._activeTasks).filter(
      (value) => recentKey && recentKey === value.task.getKey()
    );
  }
  _removeFromActiveTasks(task) {
    const key = typeof task === "string" ? task : task.getMapKey();
    const taskToRemove = this._activeTasks[key];
    if (!taskToRemove) {
      return;
    }
    delete this._activeTasks[key];
  }
  _fireTaskEvent(event) {
    if (event.kind !== TaskEventKind.Changed) {
      const activeTask = this._activeTasks[event.__task.getMapKey()];
      if (activeTask) {
        activeTask.state = event.kind;
      }
    }
    this._onDidStateChange.fire(event);
  }
  terminate(task) {
    const activeTerminal = this._activeTasks[task.getMapKey()];
    if (!activeTerminal) {
      return Promise.resolve({ success: false, task: void 0 });
    }
    const terminal = activeTerminal.terminal;
    if (!terminal) {
      return Promise.resolve({ success: false, task: void 0 });
    }
    return new Promise((resolve, reject) => {
      terminal.onDisposed((terminal2) => {
        this._fireTaskEvent(TaskEvent.terminated(task, terminal2.instanceId, terminal2.exitReason));
      });
      const onExit = terminal.onExit(() => {
        const task2 = activeTerminal.task;
        try {
          onExit.dispose();
          this._fireTaskEvent(TaskEvent.terminated(task2, terminal.instanceId, terminal.exitReason));
        } catch (error) {
        }
        resolve({ success: true, task: task2 });
      });
      terminal.dispose();
    });
  }
  terminateAll() {
    const promises = [];
    for (const [key, terminalData] of Object.entries(this._activeTasks)) {
      const terminal = terminalData?.terminal;
      if (terminal) {
        promises.push(new Promise((resolve, reject) => {
          const onExit = terminal.onExit(() => {
            const task = terminalData.task;
            try {
              onExit.dispose();
              this._fireTaskEvent(TaskEvent.terminated(task, terminal.instanceId, terminal.exitReason));
            } catch (error) {
            }
            if (this._activeTasks[key] === terminalData) {
              delete this._activeTasks[key];
            }
            resolve({ success: true, task: terminalData.task });
          });
        }));
        terminal.dispose();
      }
    }
    return Promise.all(promises);
  }
  _showDependencyCycleMessage(task) {
    this._log(nls.localize(
      "dependencyCycle",
      'There is a dependency cycle. See task "{0}".',
      task._label
    ));
    this._showOutput();
  }
  _executeTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved) {
    this._showTaskLoadErrors(task);
    const mapKey = task.getMapKey();
    const promise = Promise.resolve().then(async () => {
      alreadyResolved = alreadyResolved ?? /* @__PURE__ */ new Map();
      const promises = [];
      if (task.configurationProperties.dependsOn) {
        const nextLiveDependencies = new Set(liveDependencies).add(task.getCommonTaskId());
        for (const dependency of task.configurationProperties.dependsOn) {
          const dependencyTask = await resolver.resolve(dependency.uri, dependency.task);
          if (dependencyTask) {
            this._adoptConfigurationForDependencyTask(dependencyTask, task);
            let taskResult;
            const commonKey = dependencyTask.getCommonTaskId();
            if (nextLiveDependencies.has(commonKey)) {
              this._showDependencyCycleMessage(dependencyTask);
              taskResult = Promise.resolve({});
            } else {
              taskResult = encounteredTasks.get(commonKey);
              if (!taskResult) {
                const activeTask2 = this._activeTasks[dependencyTask.getMapKey()] ?? this._getInstances(dependencyTask).pop();
                taskResult = activeTask2 && this._getDependencyPromise(activeTask2);
              }
            }
            if (!taskResult) {
              this._fireTaskEvent(TaskEvent.general(TaskEventKind.DependsOnStarted, task));
              taskResult = this._executeDependencyTask(dependencyTask, resolver, trigger, nextLiveDependencies, encounteredTasks, alreadyResolved);
            }
            encounteredTasks.set(commonKey, taskResult);
            promises.push(taskResult);
            if (task.configurationProperties.dependsOrder === DependsOrder.sequence) {
              const promiseResult = await taskResult;
              if (promiseResult.exitCode !== 0) {
                break;
              }
            }
          } else {
            this._log(nls.localize(
              "dependencyFailed",
              "Couldn't resolve dependent task '{0}' in workspace folder '{1}'",
              Types.isString(dependency.task) ? dependency.task : JSON.stringify(dependency.task, void 0, 0),
              dependency.uri.toString()
            ));
            this._showOutput();
          }
        }
      }
      return Promise.all(promises).then((summaries) => {
        for (const summary of summaries) {
          if (summary.exitCode !== 0) {
            return { exitCode: summary.exitCode };
          }
        }
        if ((ContributedTask.is(task) || CustomTask.is(task)) && task.command) {
          if (this._isRerun) {
            return this._reexecuteCommand(task, trigger, alreadyResolved);
          } else {
            return this._executeCommand(task, trigger, alreadyResolved);
          }
        }
        return { exitCode: 0 };
      });
    }).finally(() => {
      delete this._activeTasks[mapKey];
    });
    const lastInstance = this._getInstances(task).pop();
    const count = lastInstance?.count ?? { count: 0 };
    count.count++;
    const activeTask = { task, promise, count };
    this._activeTasks[mapKey] = activeTask;
    return promise;
  }
  _createInactiveDependencyPromise(task) {
    return new Promise((resolve) => {
      const taskInactiveDisposable = this.onDidStateChange((taskEvent) => {
        if (taskEvent.kind === TaskEventKind.Inactive && taskEvent.__task === task) {
          taskInactiveDisposable.dispose();
          resolve({ exitCode: 0 });
        }
      });
    });
  }
  _adoptConfigurationForDependencyTask(dependencyTask, task) {
    if (dependencyTask.configurationProperties.icon) {
      dependencyTask.configurationProperties.icon.id ||= task.configurationProperties.icon?.id;
      dependencyTask.configurationProperties.icon.color ||= task.configurationProperties.icon?.color;
    } else {
      dependencyTask.configurationProperties.icon = task.configurationProperties.icon;
    }
  }
  async _getDependencyPromise(task) {
    if (!task.task.configurationProperties.isBackground) {
      return task.promise;
    }
    if (!task.task.configurationProperties.problemMatchers || task.task.configurationProperties.problemMatchers.length === 0) {
      return task.promise;
    }
    if (task.state === TaskEventKind.Inactive) {
      return { exitCode: 0 };
    }
    return this._createInactiveDependencyPromise(task.task);
  }
  async _executeDependencyTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved) {
    if (!task.configurationProperties.isBackground) {
      return this._executeTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved);
    }
    const inactivePromise = this._createInactiveDependencyPromise(task);
    return Promise.race([inactivePromise, this._executeTask(task, resolver, trigger, liveDependencies, encounteredTasks, alreadyResolved)]);
  }
  async _resolveAndFindExecutable(systemInfo, workspaceFolder, task, cwd, envPath) {
    const command = await this._configurationResolverService.resolveAsync(workspaceFolder, CommandString.value(task.command.name));
    cwd = cwd ? await this._configurationResolverService.resolveAsync(workspaceFolder, cwd) : void 0;
    const delimiter = (await this._pathService.path).delimiter;
    const paths = envPath ? await Promise.all(envPath.split(delimiter).map((p) => this._configurationResolverService.resolveAsync(workspaceFolder, p))) : void 0;
    const foundExecutable = await systemInfo?.findExecutable(command, cwd, paths);
    if (foundExecutable) {
      return foundExecutable;
    }
    if (path.isAbsolute(command)) {
      return command;
    }
    return path.join(cwd ?? "", command);
  }
  _findUnresolvedVariables(variables, alreadyResolved) {
    if (alreadyResolved.size === 0) {
      return variables;
    }
    const unresolved = /* @__PURE__ */ new Set();
    for (const variable of variables) {
      if (!alreadyResolved.has(variable.substring(2, variable.length - 1))) {
        unresolved.add(variable);
      }
    }
    return unresolved;
  }
  _mergeMaps(mergeInto, mergeFrom) {
    for (const entry of mergeFrom) {
      if (!mergeInto.has(entry[0])) {
        mergeInto.set(entry[0], entry[1]);
      }
    }
  }
  async _acquireInput(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved) {
    const resolved = await this._resolveVariablesFromSet(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved);
    this._fireTaskEvent(TaskEvent.general(TaskEventKind.AcquiredInput, task));
    return resolved;
  }
  _resolveVariablesFromSet(taskSystemInfo, workspaceFolder, task, variables, alreadyResolved) {
    const isProcess = task.command && task.command.runtime === RuntimeType.Process;
    const options = task.command && task.command.options ? task.command.options : void 0;
    const cwd = options ? options.cwd : void 0;
    let envPath = void 0;
    if (options && options.env) {
      for (const key of Object.keys(options.env)) {
        if (key.toLowerCase() === "path") {
          if (Types.isString(options.env[key])) {
            envPath = options.env[key];
          }
          break;
        }
      }
    }
    const unresolved = this._findUnresolvedVariables(variables, alreadyResolved);
    let resolvedVariables;
    if (taskSystemInfo && workspaceFolder) {
      const resolveSet = {
        variables: unresolved
      };
      if (taskSystemInfo.platform === Platform.Platform.Windows && isProcess) {
        resolveSet.process = { name: CommandString.value(task.command.name) };
        if (cwd) {
          resolveSet.process.cwd = cwd;
        }
        if (envPath) {
          resolveSet.process.path = envPath;
        }
      }
      resolvedVariables = taskSystemInfo.resolveVariables(workspaceFolder, resolveSet, TaskSourceKind.toConfigurationTarget(task._source.kind)).then(async (resolved) => {
        if (!resolved) {
          return void 0;
        }
        this._mergeMaps(alreadyResolved, resolved.variables);
        resolved.variables = new Map(alreadyResolved);
        if (isProcess) {
          let process = CommandString.value(task.command.name);
          if (taskSystemInfo.platform === Platform.Platform.Windows) {
            process = await this._resolveAndFindExecutable(taskSystemInfo, workspaceFolder, task, cwd, envPath);
          }
          resolved.variables.set(_TerminalTaskSystem.ProcessVarName, process);
        }
        return resolved;
      });
      return resolvedVariables;
    } else {
      const variablesArray = new Array();
      unresolved.forEach((variable) => variablesArray.push(variable));
      return new Promise((resolve, reject) => {
        this._configurationResolverService.resolveWithInteraction(workspaceFolder, variablesArray, "tasks", void 0, TaskSourceKind.toConfigurationTarget(task._source.kind)).then(async (resolvedVariablesMap) => {
          if (resolvedVariablesMap) {
            this._mergeMaps(alreadyResolved, resolvedVariablesMap);
            resolvedVariablesMap = new Map(alreadyResolved);
            if (isProcess) {
              let processVarValue;
              if (Platform.isWindows) {
                processVarValue = await this._resolveAndFindExecutable(taskSystemInfo, workspaceFolder, task, cwd, envPath);
              } else {
                processVarValue = await this._configurationResolverService.resolveAsync(workspaceFolder, CommandString.value(task.command.name));
              }
              resolvedVariablesMap.set(_TerminalTaskSystem.ProcessVarName, processVarValue);
            }
            const resolvedVariablesResult = {
              variables: resolvedVariablesMap
            };
            resolve(resolvedVariablesResult);
          } else {
            resolve(void 0);
          }
        }, (reason) => {
          reject(reason);
        });
      });
    }
  }
  _executeCommand(task, trigger, alreadyResolved) {
    const taskWorkspaceFolder = task.getWorkspaceFolder();
    let workspaceFolder;
    if (taskWorkspaceFolder) {
      workspaceFolder = this._currentTask.workspaceFolder = taskWorkspaceFolder;
    } else {
      const folders = this._contextService.getWorkspace().folders;
      workspaceFolder = folders.length > 0 ? folders[0] : void 0;
    }
    const systemInfo = this._currentTask.systemInfo = this._taskSystemInfoResolver(workspaceFolder);
    const variables = /* @__PURE__ */ new Set();
    this._collectTaskVariables(variables, task);
    const resolvedVariables = this._acquireInput(systemInfo, workspaceFolder, task, variables, alreadyResolved);
    return resolvedVariables.then((resolvedVariables2) => {
      if (resolvedVariables2 && !this._isTaskEmpty(task)) {
        this._currentTask.resolvedVariables = resolvedVariables2;
        return this._executeInTerminal(task, trigger, new VariableResolver(workspaceFolder, systemInfo, resolvedVariables2.variables, this._configurationResolverService), workspaceFolder);
      } else {
        this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
        return Promise.resolve({ exitCode: 0 });
      }
    }, (reason) => {
      return Promise.reject(reason);
    });
  }
  _isTaskEmpty(task) {
    const isCustomExecution = task.command.runtime === RuntimeType.CustomExecution;
    return !(task.command !== void 0 && task.command.runtime && (isCustomExecution || task.command.name !== void 0));
  }
  _reexecuteCommand(task, trigger, alreadyResolved) {
    const lastTask = this._lastTask;
    if (!lastTask) {
      return Promise.reject(new Error("No task previously run"));
    }
    const workspaceFolder = this._currentTask.workspaceFolder = lastTask.workspaceFolder;
    const variables = /* @__PURE__ */ new Set();
    this._collectTaskVariables(variables, task);
    let hasAllVariables = true;
    variables.forEach((value) => {
      if (value.substring(2, value.length - 1) in lastTask.getVerifiedTask().resolvedVariables) {
        hasAllVariables = false;
      }
    });
    if (!hasAllVariables) {
      return this._acquireInput(lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().workspaceFolder, task, variables, alreadyResolved).then((resolvedVariables) => {
        if (!resolvedVariables) {
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
          return { exitCode: 0 };
        }
        this._currentTask.resolvedVariables = resolvedVariables;
        return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, resolvedVariables.variables, this._configurationResolverService), workspaceFolder);
      }, (reason) => {
        return Promise.reject(reason);
      });
    } else {
      this._currentTask.resolvedVariables = lastTask.getVerifiedTask().resolvedVariables;
      return this._executeInTerminal(task, trigger, new VariableResolver(lastTask.getVerifiedTask().workspaceFolder, lastTask.getVerifiedTask().systemInfo, lastTask.getVerifiedTask().resolvedVariables.variables, this._configurationResolverService), workspaceFolder);
    }
  }
  async _executeInTerminal(task, trigger, resolver, workspaceFolder) {
    let terminal = void 0;
    let error = void 0;
    let promise = void 0;
    if (task.configurationProperties.isBackground) {
      const problemMatchers = await this._resolveMatchers(resolver, task.configurationProperties.problemMatchers);
      const watchingProblemMatcher = new WatchingProblemCollector(problemMatchers, this._markerService, this._modelService, this._fileService);
      if (problemMatchers.length > 0 && !watchingProblemMatcher.isWatching()) {
        this._appendOutput(nls.localize("TerminalTaskSystem.nonWatchingMatcher", "Task {0} is a background task but uses a problem matcher without a background pattern", task._label));
        this._showOutput();
      }
      const toDispose = new DisposableStore();
      let eventCounter = 0;
      const mapKey = task.getMapKey();
      toDispose.add(watchingProblemMatcher.onDidStateChange((event) => {
        if (event.kind === ProblemCollectorEventKind.BackgroundProcessingBegins) {
          eventCounter++;
          this._busyTasks[mapKey] = task;
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.Active, task, terminal?.instanceId));
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherStarted, task, terminal?.instanceId));
        } else if (event.kind === ProblemCollectorEventKind.BackgroundProcessingEnds) {
          eventCounter--;
          if (this._busyTasks[mapKey]) {
            delete this._busyTasks[mapKey];
          }
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.Inactive, task, terminal?.instanceId));
          if (eventCounter === 0) {
            if (watchingProblemMatcher.numberOfMatches > 0 && watchingProblemMatcher.maxMarkerSeverity && watchingProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error) {
              this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherFoundErrors, task, terminal?.instanceId));
              const reveal = task.command.presentation.reveal;
              const revealProblems = task.command.presentation.revealProblems;
              if (revealProblems === RevealProblemKind.OnProblem) {
                this._viewsService.openView(Markers.MARKERS_VIEW_ID, true);
              } else if (reveal === RevealKind.Silent) {
                this._terminalService.setActiveInstance(terminal);
                this._terminalGroupService.showPanel(false);
              }
            } else {
              this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherEnded, task, terminal?.instanceId));
            }
          }
        }
      }));
      watchingProblemMatcher.aboutToStart();
      let delayer = void 0;
      [terminal, error] = await this._createTerminal(task, resolver, workspaceFolder);
      if (error) {
        return Promise.reject(new Error(error.message));
      }
      if (!terminal) {
        return Promise.reject(new Error(`Failed to create terminal for task ${task._label}`));
      }
      this._terminalStatusManager.addTerminal(task, terminal, watchingProblemMatcher);
      let processStartedSignaled = false;
      terminal.processReady.then(() => {
        if (!processStartedSignaled) {
          this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
          processStartedSignaled = true;
        }
      }, (_error) => {
        this._logService.error("Task terminal process never got ready");
      });
      this._fireTaskEvent(TaskEvent.start(task, terminal.instanceId, resolver.values));
      let onData;
      if (problemMatchers.length) {
        onData = terminal.onLineData((line) => {
          watchingProblemMatcher.processLine(line);
          if (!delayer) {
            delayer = new Async.Delayer(3e3);
          }
          delayer.trigger(() => {
            watchingProblemMatcher.forceDelivery();
            delayer = void 0;
          });
        });
      }
      promise = new Promise((resolve, reject) => {
        const onExit = terminal.onExit((terminalLaunchResult) => {
          const exitCode = typeof terminalLaunchResult === "number" ? terminalLaunchResult : terminalLaunchResult?.code;
          onData?.dispose();
          onExit.dispose();
          const key = task.getMapKey();
          if (this._busyTasks[mapKey]) {
            delete this._busyTasks[mapKey];
          }
          this._removeFromActiveTasks(task);
          this._fireTaskEvent(TaskEvent.changed());
          if (terminalLaunchResult !== void 0) {
            switch (task.command.presentation.panel) {
              case PanelKind.Dedicated:
                this._sameTaskTerminals[key] = terminal.instanceId.toString();
                break;
              case PanelKind.Shared:
                this._idleTaskTerminals.set(key, terminal.instanceId.toString(), Touch.AsOld);
                break;
            }
          }
          const reveal = task.command.presentation.reveal;
          if (reveal === RevealKind.Silent && (exitCode !== 0 || watchingProblemMatcher.numberOfMatches > 0 && watchingProblemMatcher.maxMarkerSeverity && watchingProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error)) {
            try {
              this._terminalService.setActiveInstance(terminal);
              this._terminalGroupService.showPanel(false);
            } catch (e) {
            }
          }
          watchingProblemMatcher.done();
          watchingProblemMatcher.dispose();
          if (!processStartedSignaled) {
            this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
            processStartedSignaled = true;
          }
          this._fireTaskEvent(TaskEvent.processEnded(task, terminal.instanceId, exitCode));
          for (let i = 0; i < eventCounter; i++) {
            this._fireTaskEvent(TaskEvent.general(TaskEventKind.Inactive, task, terminal.instanceId));
          }
          eventCounter = 0;
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task));
          toDispose.dispose();
          resolve({ exitCode: exitCode ?? void 0 });
        });
      });
      if (trigger === Triggers.reconnect && !!terminal.xterm) {
        const bufferLines = [];
        const bufferReverseIterator = terminal.xterm.getBufferReverseIterator();
        const startRegex = new RegExp(watchingProblemMatcher.beginPatterns.map((pattern) => pattern.source).join("|"));
        for (const nextLine of bufferReverseIterator) {
          bufferLines.push(nextLine);
          if (startRegex.test(nextLine)) {
            break;
          }
        }
        let delayer2 = void 0;
        for (let i = bufferLines.length - 1; i >= 0; i--) {
          watchingProblemMatcher.processLine(bufferLines[i]);
          if (!delayer2) {
            delayer2 = new Async.Delayer(3e3);
          }
          delayer2.trigger(() => {
            watchingProblemMatcher.forceDelivery();
            delayer2 = void 0;
          });
        }
      }
    } else {
      [terminal, error] = await this._createTerminal(task, resolver, workspaceFolder);
      if (error) {
        return Promise.reject(new Error(error.message));
      }
      if (!terminal) {
        return Promise.reject(new Error(`Failed to create terminal for task ${task._label}`));
      }
      this._fireTaskEvent(TaskEvent.start(task, terminal.instanceId, resolver.values));
      const mapKey = task.getMapKey();
      this._busyTasks[mapKey] = task;
      this._fireTaskEvent(TaskEvent.general(TaskEventKind.Active, task, terminal.instanceId));
      const problemMatchers = await this._resolveMatchers(resolver, task.configurationProperties.problemMatchers);
      const startStopProblemMatcher = new StartStopProblemCollector(problemMatchers, this._markerService, this._modelService, ProblemHandlingStrategy.Clean, this._fileService);
      this._terminalStatusManager.addTerminal(task, terminal, startStopProblemMatcher);
      startStopProblemMatcher.onDidStateChange((event) => {
        if (event.kind === ProblemCollectorEventKind.BackgroundProcessingBegins) {
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherStarted, task, terminal?.instanceId));
        } else if (event.kind === ProblemCollectorEventKind.BackgroundProcessingEnds) {
          if (startStopProblemMatcher.numberOfMatches && startStopProblemMatcher.maxMarkerSeverity && startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error) {
            this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherFoundErrors, task, terminal?.instanceId));
          } else {
            this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherEnded, task, terminal?.instanceId));
          }
        }
      });
      let processStartedSignaled = false;
      terminal.processReady.then(() => {
        if (!processStartedSignaled) {
          this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
          processStartedSignaled = true;
        }
      }, (_error) => {
      });
      const onData = terminal.onLineData((line) => {
        startStopProblemMatcher.processLine(line);
      });
      promise = new Promise((resolve, reject) => {
        const onExit = terminal.onExit((terminalLaunchResult) => {
          const exitCode = typeof terminalLaunchResult === "number" ? terminalLaunchResult : terminalLaunchResult?.code;
          onExit.dispose();
          const key = task.getMapKey();
          this._removeFromActiveTasks(task);
          this._fireTaskEvent(TaskEvent.changed());
          if (terminalLaunchResult !== void 0) {
            switch (task.command.presentation.panel) {
              case PanelKind.Dedicated:
                this._sameTaskTerminals[key] = terminal.instanceId.toString();
                break;
              case PanelKind.Shared:
                this._idleTaskTerminals.set(key, terminal.instanceId.toString(), Touch.AsOld);
                break;
            }
          }
          const reveal = task.command.presentation.reveal;
          const revealProblems = task.command.presentation.revealProblems;
          const revealProblemPanel = terminal && revealProblems === RevealProblemKind.OnProblem && startStopProblemMatcher.numberOfMatches > 0;
          if (revealProblemPanel) {
            this._viewsService.openView(Markers.MARKERS_VIEW_ID);
          } else if (terminal && reveal === RevealKind.Silent && (exitCode !== 0 || startStopProblemMatcher.numberOfMatches > 0 && startStopProblemMatcher.maxMarkerSeverity && startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error)) {
            try {
              this._terminalService.setActiveInstance(terminal);
              this._terminalGroupService.showPanel(false);
            } catch (e) {
            }
          }
          setTimeout(() => {
            onData.dispose();
            startStopProblemMatcher.done();
            startStopProblemMatcher.dispose();
          }, 100);
          if (!processStartedSignaled && terminal) {
            this._fireTaskEvent(TaskEvent.processStarted(task, terminal.instanceId, terminal.processId));
            processStartedSignaled = true;
          }
          this._fireTaskEvent(TaskEvent.processEnded(task, terminal?.instanceId, exitCode ?? void 0));
          if (this._busyTasks[mapKey]) {
            delete this._busyTasks[mapKey];
          }
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.Inactive, task, terminal?.instanceId));
          if (startStopProblemMatcher.numberOfMatches && startStopProblemMatcher.maxMarkerSeverity && startStopProblemMatcher.maxMarkerSeverity >= MarkerSeverity.Error) {
            this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherFoundErrors, task, terminal?.instanceId));
          } else {
            this._fireTaskEvent(TaskEvent.general(TaskEventKind.ProblemMatcherEnded, task, terminal?.instanceId));
          }
          this._fireTaskEvent(TaskEvent.general(TaskEventKind.End, task, terminal?.instanceId));
          resolve({ exitCode: exitCode ?? void 0 });
        });
      });
    }
    const showProblemPanel = task.command.presentation && task.command.presentation.revealProblems === RevealProblemKind.Always;
    if (showProblemPanel) {
      this._viewsService.openView(Markers.MARKERS_VIEW_ID);
    } else if (task.command.presentation && (task.command.presentation.focus || task.command.presentation.reveal === RevealKind.Always)) {
      this._terminalService.setActiveInstance(terminal);
      await this._terminalService.revealTerminal(terminal);
      if (task.command.presentation.focus) {
        this._terminalService.focusInstance(terminal);
      }
    }
    if (this._activeTasks[task.getMapKey()]) {
      this._activeTasks[task.getMapKey()].terminal = terminal;
    } else {
      console.warn("No active tasks found for the terminal.");
    }
    this._fireTaskEvent(TaskEvent.changed());
    return promise;
  }
  _createTerminalName(task) {
    const needsFolderQualification = this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
    return needsFolderQualification ? task.getQualifiedLabel() : task.configurationProperties.name || "";
  }
  async _createShellLaunchConfig(task, workspaceFolder, variableResolver, platform, options, command, args, waitOnExit) {
    let shellLaunchConfig;
    const isShellCommand = task.command.runtime === RuntimeType.Shell;
    const needsFolderQualification = this._contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
    const terminalName = this._createTerminalName(task);
    const type = ReconnectionType;
    const originalCommand = task.command.name;
    let cwd;
    if (options.cwd) {
      cwd = options.cwd;
      if (!path.isAbsolute(cwd)) {
        if (workspaceFolder && workspaceFolder.uri.scheme === Schemas.file) {
          cwd = path.join(workspaceFolder.uri.fsPath, cwd);
        }
      }
      cwd = isUNC(cwd) ? cwd : resources.toLocalResource(URI.from({ scheme: Schemas.file, path: cwd }), this._environmentService.remoteAuthority, this._pathService.defaultUriScheme);
    }
    if (isShellCommand) {
      let os;
      switch (platform) {
        case Platform.Platform.Windows:
          os = Platform.OperatingSystem.Windows;
          break;
        case Platform.Platform.Mac:
          os = Platform.OperatingSystem.Macintosh;
          break;
        case Platform.Platform.Linux:
        default:
          os = Platform.OperatingSystem.Linux;
          break;
      }
      const defaultProfile = await this._terminalProfileResolverService.getDefaultProfile({
        allowAutomationShell: true,
        os,
        remoteAuthority: this._environmentService.remoteAuthority
      });
      let icon;
      if (task.configurationProperties.icon?.id) {
        icon = ThemeIcon.fromId(task.configurationProperties.icon.id);
      } else {
        const taskGroupKind = task.configurationProperties.group ? GroupKind.to(task.configurationProperties.group) : void 0;
        const kindId = typeof taskGroupKind === "string" ? taskGroupKind : taskGroupKind?.kind;
        icon = kindId === "test" ? ThemeIcon.fromId(Codicon.beaker.id) : defaultProfile.icon;
      }
      shellLaunchConfig = {
        name: terminalName,
        type,
        executable: defaultProfile.path,
        args: defaultProfile.args,
        env: { ...defaultProfile.env },
        icon,
        color: task.configurationProperties.icon?.color || void 0,
        waitOnExit
      };
      let shellSpecified = false;
      const shellOptions = task.command.options && task.command.options.shell;
      if (shellOptions) {
        if (shellOptions.executable) {
          if (shellOptions.executable !== shellLaunchConfig.executable) {
            shellLaunchConfig.args = void 0;
          }
          shellLaunchConfig.executable = await this._resolveVariable(variableResolver, shellOptions.executable);
          shellSpecified = true;
        }
        if (shellOptions.args) {
          shellLaunchConfig.args = await this._resolveVariables(variableResolver, shellOptions.args.slice());
        }
      }
      if (shellLaunchConfig.args === void 0) {
        shellLaunchConfig.args = [];
      }
      const shellArgs = Array.isArray(shellLaunchConfig.args) ? shellLaunchConfig.args.slice(0) : [shellLaunchConfig.args];
      const toAdd = [];
      const basename = path.posix.basename((await this._pathService.fileURI(shellLaunchConfig.executable)).path).toLowerCase();
      const commandLine = this._buildShellCommandLine(platform, basename, shellOptions, command, originalCommand, args);
      let windowsShellArgs = false;
      if (platform === Platform.Platform.Windows) {
        windowsShellArgs = true;
        const userHome = await this._pathService.userHome();
        if (basename === "cmd.exe" && (options.cwd && isUNC(options.cwd) || !options.cwd && isUNC(userHome.fsPath))) {
          return void 0;
        }
        if (basename === "powershell.exe" || basename === "pwsh.exe") {
          if (!shellSpecified) {
            toAdd.push("-Command");
          }
        } else if (basename === "bash.exe" || basename === "zsh.exe") {
          windowsShellArgs = false;
          if (!shellSpecified) {
            toAdd.push("-c");
          }
        } else if (basename === "wsl.exe") {
          if (!shellSpecified) {
            toAdd.push("-e");
          }
        } else {
          if (!shellSpecified) {
            toAdd.push("/d", "/c");
          }
        }
      } else {
        if (!shellSpecified) {
          if (platform === Platform.Platform.Mac) {
          }
          toAdd.push("-c");
        }
      }
      const combinedShellArgs = this._addAllArgument(toAdd, shellArgs);
      combinedShellArgs.push(commandLine);
      shellLaunchConfig.args = windowsShellArgs ? combinedShellArgs.join(" ") : combinedShellArgs;
      if (task.command.presentation && task.command.presentation.echo) {
        if (needsFolderQualification && workspaceFolder) {
          const folder = cwd && typeof cwd === "object" && "path" in cwd ? path.basename(cwd.path) : workspaceFolder.name;
          shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
            key: "task.executingInFolder",
            comment: ["The workspace folder the task is running in", "The task command line or label"]
          }, "Executing task in folder {0}: {1}", folder, commandLine), { excludeLeadingNewLine: true }) + this.taskShellIntegrationOutputSequence;
        } else {
          shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
            key: "task.executing.shellIntegration",
            comment: ["The task command line or label"]
          }, "Executing task: {0}", commandLine), { excludeLeadingNewLine: true }) + this.taskShellIntegrationOutputSequence;
        }
      } else {
        shellLaunchConfig.initialText = {
          text: this.taskShellIntegrationStartSequence(cwd) + this.taskShellIntegrationOutputSequence,
          trailingNewLine: false
        };
      }
    } else {
      const commandExecutable = task.command.runtime !== RuntimeType.CustomExecution ? CommandString.value(command) : void 0;
      const executable = !isShellCommand ? await this._resolveVariable(variableResolver, await this._resolveVariable(variableResolver, "${" + _TerminalTaskSystem.ProcessVarName + "}")) : commandExecutable;
      shellLaunchConfig = {
        name: terminalName,
        type,
        icon: task.configurationProperties.icon?.id ? ThemeIcon.fromId(task.configurationProperties.icon.id) : void 0,
        color: task.configurationProperties.icon?.color || void 0,
        executable,
        args: args.map((a) => Types.isString(a) ? a : a.value),
        waitOnExit
      };
      if (task.command.presentation && task.command.presentation.echo) {
        const getArgsToEcho = (args2) => {
          if (!args2 || args2.length === 0) {
            return "";
          }
          if (Types.isString(args2)) {
            return args2;
          }
          return args2.join(" ");
        };
        if (needsFolderQualification && workspaceFolder) {
          shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
            key: "task.executingInFolder",
            comment: ["The workspace folder the task is running in", "The task command line or label"]
          }, "Executing task in folder {0}: {1}", workspaceFolder.name, `${shellLaunchConfig.executable} ${getArgsToEcho(shellLaunchConfig.args)}`), { excludeLeadingNewLine: true }) + this.taskShellIntegrationOutputSequence;
        } else {
          shellLaunchConfig.initialText = this.taskShellIntegrationStartSequence(cwd) + formatMessageForTerminal(nls.localize({
            key: "task.executing.shell-integration",
            comment: ["The task command line or label"]
          }, "Executing task: {0}", `${shellLaunchConfig.executable} ${getArgsToEcho(shellLaunchConfig.args)}`), { excludeLeadingNewLine: true }) + this.taskShellIntegrationOutputSequence;
        }
      } else {
        shellLaunchConfig.initialText = {
          text: this.taskShellIntegrationStartSequence(cwd) + this.taskShellIntegrationOutputSequence,
          trailingNewLine: false
        };
      }
    }
    if (cwd) {
      shellLaunchConfig.cwd = cwd;
    }
    if (options.env) {
      if (shellLaunchConfig.env) {
        shellLaunchConfig.env = { ...shellLaunchConfig.env, ...options.env };
      } else {
        shellLaunchConfig.env = options.env;
      }
    }
    shellLaunchConfig.isFeatureTerminal = true;
    shellLaunchConfig.useShellEnvironment = true;
    shellLaunchConfig.tabActions = this._terminalTabActions;
    return shellLaunchConfig;
  }
  _addAllArgument(shellCommandArgs, configuredShellArgs) {
    const combinedShellArgs = Objects.deepClone(configuredShellArgs);
    shellCommandArgs.forEach((element) => {
      const shouldAddShellCommandArg = configuredShellArgs.every((arg, index) => {
        if (arg.toLowerCase() === element && configuredShellArgs.length > index + 1) {
          return !configuredShellArgs.slice(index + 1).every((testArg) => testArg.startsWith("-"));
        } else {
          return arg.toLowerCase() !== element;
        }
      });
      if (shouldAddShellCommandArg) {
        combinedShellArgs.push(element);
      }
    });
    return combinedShellArgs;
  }
  async _reconnectToTerminal(task) {
    if (!this._reconnectedTerminals) {
      return;
    }
    for (let i = 0; i < this._reconnectedTerminals.length; i++) {
      const terminal = this._reconnectedTerminals[i];
      if (getReconnectionData(terminal)?.lastTask === task.getCommonTaskId()) {
        this._reconnectedTerminals.splice(i, 1);
        return terminal;
      }
    }
    return void 0;
  }
  async _doCreateTerminal(task, group, launchConfigs) {
    const reconnectedTerminal = await this._reconnectToTerminal(task);
    const onDisposed = (terminal) => this._fireTaskEvent(TaskEvent.terminated(task, terminal.instanceId, terminal.exitReason));
    if (reconnectedTerminal) {
      if ("command" in task && task.command.presentation) {
        reconnectedTerminal.waitOnExit = getWaitOnExitValue(task.command.presentation, task.configurationProperties);
      }
      reconnectedTerminal.onDisposed(onDisposed);
      this._logService.trace("reconnected to task and terminal", task._id);
      return reconnectedTerminal;
    }
    if (group) {
      for (const terminal of Object.values(this._terminals)) {
        if (terminal.group === group) {
          this._logService.trace(`Found terminal to split for group ${group}`);
          const originalInstance = terminal.terminal;
          const result = await this._terminalService.createTerminal({ location: { parentTerminal: originalInstance }, config: launchConfigs });
          result.onDisposed(onDisposed);
          if (result) {
            return result;
          }
        }
      }
      this._logService.trace(`No terminal found to split for group ${group}`);
    }
    const createdTerminal = await this._terminalService.createTerminal({ config: launchConfigs });
    createdTerminal.onDisposed(onDisposed);
    return createdTerminal;
  }
  _reconnectToTerminals() {
    if (this._hasReconnected) {
      this._logService.trace(`Already reconnected, to ${this._reconnectedTerminals?.length} terminals so returning`);
      return;
    }
    this._reconnectedTerminals = this._terminalService.getReconnectedTerminals(ReconnectionType)?.filter((t) => !t.isDisposed && getReconnectionData(t)) || [];
    this._logService.trace(`Attempting reconnection of ${this._reconnectedTerminals?.length} terminals`);
    if (!this._reconnectedTerminals?.length) {
      this._logService.trace(`No terminals to reconnect to so returning`);
    } else {
      for (const terminal of this._reconnectedTerminals) {
        const data = getReconnectionData(terminal);
        if (data) {
          const terminalData = { lastTask: data.lastTask, group: data.group, terminal };
          this._terminals[terminal.instanceId] = terminalData;
          this._logService.trace("Reconnecting to task terminal", terminalData.lastTask, terminal.instanceId);
        }
      }
    }
    this._hasReconnected = true;
  }
  _deleteTaskAndTerminal(terminal, terminalData) {
    delete this._terminals[terminal.instanceId];
    delete this._sameTaskTerminals[terminalData.lastTask];
    this._idleTaskTerminals.delete(terminalData.lastTask);
    const mapKey = terminalData.lastTask;
    this._removeFromActiveTasks(mapKey);
    if (this._busyTasks[mapKey]) {
      delete this._busyTasks[mapKey];
    }
  }
  async _createTerminal(task, resolver, workspaceFolder) {
    const platform = resolver.taskSystemInfo ? resolver.taskSystemInfo.platform : Platform.platform;
    const options = await this._resolveOptions(resolver, task.command.options);
    const presentationOptions = task.command.presentation;
    if (!presentationOptions) {
      throw new Error("Task presentation options should not be undefined here.");
    }
    const waitOnExit = getWaitOnExitValue(presentationOptions, task.configurationProperties);
    let command;
    let args;
    let launchConfigs;
    if (task.command.runtime === RuntimeType.CustomExecution) {
      this._currentTask.shellLaunchConfig = launchConfigs = {
        customPtyImplementation: (id, cols, rows) => new TerminalProcessExtHostProxy(id, cols, rows, this._terminalService),
        waitOnExit,
        name: this._createTerminalName(task),
        initialText: task.command.presentation && task.command.presentation.echo ? formatMessageForTerminal(nls.localize({
          key: "task.executing",
          comment: ["The task command line or label"]
        }, "Executing task: {0}", task._label), { excludeLeadingNewLine: true }) : void 0,
        isFeatureTerminal: true,
        icon: task.configurationProperties.icon?.id ? ThemeIcon.fromId(task.configurationProperties.icon.id) : void 0,
        color: task.configurationProperties.icon?.color || void 0
      };
    } else {
      const resolvedResult = await this._resolveCommandAndArgs(resolver, task.command);
      command = resolvedResult.command;
      args = resolvedResult.args;
      this._currentTask.shellLaunchConfig = launchConfigs = await this._createShellLaunchConfig(task, workspaceFolder, resolver, platform, options, command, args, waitOnExit);
      if (launchConfigs === void 0) {
        return [void 0, new TaskError(Severity.Error, nls.localize("TerminalTaskSystem", "Can't execute a shell command on an UNC drive using cmd.exe."), TaskErrors.UnknownError)];
      }
    }
    const prefersSameTerminal = presentationOptions.panel === PanelKind.Dedicated;
    const allowsSharedTerminal = presentationOptions.panel === PanelKind.Shared;
    const group = presentationOptions.group;
    const taskKey = task.getMapKey();
    let terminalToReuse;
    if (prefersSameTerminal) {
      const terminalId = this._sameTaskTerminals[taskKey];
      if (terminalId) {
        terminalToReuse = this._terminals[terminalId];
        delete this._sameTaskTerminals[taskKey];
      }
    } else if (allowsSharedTerminal) {
      let terminalId = this._idleTaskTerminals.remove(taskKey);
      if (!terminalId) {
        for (const taskId of this._idleTaskTerminals.keys()) {
          const idleTerminalId = this._idleTaskTerminals.get(taskId);
          if (idleTerminalId && this._terminals[idleTerminalId] && this._terminals[idleTerminalId].group === group) {
            terminalId = this._idleTaskTerminals.remove(taskId);
            break;
          }
        }
      }
      if (terminalId) {
        terminalToReuse = this._terminals[terminalId];
      }
    }
    if (terminalToReuse) {
      if (!launchConfigs) {
        throw new Error("Task shell launch configuration should not be undefined here.");
      }
      terminalToReuse.terminal.scrollToBottom();
      if (task.configurationProperties.isBackground) {
        launchConfigs.reconnectionProperties = { ownerId: ReconnectionType, data: { lastTask: task.getCommonTaskId(), group, label: task._label, id: task._id } };
      }
      await terminalToReuse.terminal.reuseTerminal(launchConfigs);
      if (task.command.presentation && task.command.presentation.clear) {
        terminalToReuse.terminal.clearBuffer();
      }
      this._terminals[terminalToReuse.terminal.instanceId.toString()].lastTask = taskKey;
      return [terminalToReuse.terminal, void 0];
    }
    this._terminalCreationQueue = this._terminalCreationQueue.then(() => this._doCreateTerminal(task, group, launchConfigs));
    const terminal = await this._terminalCreationQueue;
    if (task.configurationProperties.isBackground) {
      terminal.shellLaunchConfig.reconnectionProperties = { ownerId: ReconnectionType, data: { lastTask: task.getCommonTaskId(), group, label: task._label, id: task._id } };
    }
    const terminalKey = terminal.instanceId.toString();
    const terminalData = { terminal, lastTask: taskKey, group };
    terminal.onDisposed(() => this._deleteTaskAndTerminal(terminal, terminalData));
    this._terminals[terminalKey] = terminalData;
    terminal.shellLaunchConfig.tabActions = this._terminalTabActions;
    return [terminal, void 0];
  }
  _buildShellCommandLine(platform, shellExecutable, shellOptions, command, originalCommand, args) {
    const basename = path.parse(shellExecutable).name.toLowerCase();
    const shellQuoteOptions = this._getQuotingOptions(basename, shellOptions, platform);
    function needsQuotes(value2) {
      if (value2.length >= 2) {
        const first = value2[0] === shellQuoteOptions.strong ? shellQuoteOptions.strong : value2[0] === shellQuoteOptions.weak ? shellQuoteOptions.weak : void 0;
        if (first === value2[value2.length - 1]) {
          return false;
        }
      }
      let quote2;
      for (let i = 0; i < value2.length; i++) {
        const ch = value2[i];
        if (ch === quote2) {
          quote2 = void 0;
        } else if (quote2 !== void 0) {
          continue;
        } else if (ch === shellQuoteOptions.escape) {
          i++;
        } else if (ch === shellQuoteOptions.strong || ch === shellQuoteOptions.weak) {
          quote2 = ch;
        } else if (ch === " ") {
          return true;
        }
      }
      return false;
    }
    function quote(value2, kind) {
      if (kind === ShellQuoting.Strong && shellQuoteOptions.strong) {
        return [shellQuoteOptions.strong + value2 + shellQuoteOptions.strong, true];
      } else if (kind === ShellQuoting.Weak && shellQuoteOptions.weak) {
        return [shellQuoteOptions.weak + value2 + shellQuoteOptions.weak, true];
      } else if (kind === ShellQuoting.Escape && shellQuoteOptions.escape) {
        if (Types.isString(shellQuoteOptions.escape)) {
          return [value2.replace(/ /g, shellQuoteOptions.escape + " "), true];
        } else {
          const buffer = [];
          for (const ch of shellQuoteOptions.escape.charsToEscape) {
            buffer.push(`\\${ch}`);
          }
          const regexp = new RegExp("[" + buffer.join(",") + "]", "g");
          const escapeChar = shellQuoteOptions.escape.escapeChar;
          return [value2.replace(regexp, (match) => escapeChar + match), true];
        }
      }
      return [value2, false];
    }
    function quoteIfNecessary(value2) {
      if (Types.isString(value2)) {
        if (needsQuotes(value2)) {
          return quote(value2, ShellQuoting.Strong);
        } else {
          return [value2, false];
        }
      } else {
        return quote(value2.value, value2.quoting);
      }
    }
    if ((!args || args.length === 0) && Types.isString(command) && (command === originalCommand || needsQuotes(originalCommand))) {
      return command;
    }
    const result = [];
    let commandQuoted = false;
    let argQuoted = false;
    let value;
    let quoted;
    [value, quoted] = quoteIfNecessary(command);
    result.push(value);
    commandQuoted = quoted;
    for (const arg of args) {
      [value, quoted] = quoteIfNecessary(arg);
      result.push(value);
      argQuoted = argQuoted || quoted;
    }
    let commandLine = result.join(" ");
    if (platform === Platform.Platform.Windows) {
      if (basename === "cmd" && commandQuoted && argQuoted) {
        commandLine = '"' + commandLine + '"';
      } else if ((basename === "powershell" || basename === "pwsh") && commandQuoted) {
        commandLine = "& " + commandLine;
      }
    }
    return commandLine;
  }
  _getQuotingOptions(shellBasename, shellOptions, platform) {
    if (shellOptions && shellOptions.quoting) {
      return shellOptions.quoting;
    }
    return _TerminalTaskSystem._shellQuotes[shellBasename] || _TerminalTaskSystem._osShellQuotes[Platform.PlatformToString(platform)];
  }
  _collectTaskVariables(variables, task) {
    if (task.command && task.command.name) {
      this._collectCommandVariables(variables, task.command, task);
    }
    this._collectMatcherVariables(variables, task.configurationProperties.problemMatchers);
    if (task.command.runtime === RuntimeType.CustomExecution && (CustomTask.is(task) || ContributedTask.is(task))) {
      let definition;
      if (CustomTask.is(task)) {
        definition = task._source.config.element;
      } else {
        definition = Objects.deepClone(task.defines);
        delete definition._key;
        delete definition.type;
      }
      this._collectDefinitionVariables(variables, definition);
    }
  }
  _collectDefinitionVariables(variables, definition) {
    if (Types.isString(definition)) {
      this._collectVariables(variables, definition);
    } else if (Array.isArray(definition)) {
      definition.forEach((element) => this._collectDefinitionVariables(variables, element));
    } else if (Types.isObject(definition)) {
      for (const key in definition) {
        this._collectDefinitionVariables(variables, definition[key]);
      }
    }
  }
  _collectCommandVariables(variables, command, task) {
    if (command.runtime === RuntimeType.CustomExecution) {
      return;
    }
    if (command.name === void 0) {
      throw new Error("Command name should never be undefined here.");
    }
    this._collectVariables(variables, command.name);
    command.args?.forEach((arg) => this._collectVariables(variables, arg));
    const scope = task._source.scope;
    if (scope !== TaskScope.Global) {
      variables.add("${workspaceFolder}");
    }
    if (command.options) {
      const options = command.options;
      if (options.cwd) {
        this._collectVariables(variables, options.cwd);
      }
      const optionsEnv = options.env;
      if (optionsEnv) {
        Object.keys(optionsEnv).forEach((key) => {
          const value = optionsEnv[key];
          if (Types.isString(value)) {
            this._collectVariables(variables, value);
          }
        });
      }
      if (options.shell) {
        if (options.shell.executable) {
          this._collectVariables(variables, options.shell.executable);
        }
        options.shell.args?.forEach((arg) => this._collectVariables(variables, arg));
      }
    }
  }
  _collectMatcherVariables(variables, values) {
    if (values === void 0 || values === null || values.length === 0) {
      return;
    }
    values.forEach((value) => {
      let matcher;
      if (Types.isString(value)) {
        if (value[0] === "$") {
          matcher = ProblemMatcherRegistry.get(value.substring(1));
        } else {
          matcher = ProblemMatcherRegistry.get(value);
        }
      } else {
        matcher = value;
      }
      if (matcher && matcher.filePrefix) {
        if (Types.isString(matcher.filePrefix)) {
          this._collectVariables(variables, matcher.filePrefix);
        } else {
          for (const fp of [...asArray(matcher.filePrefix.include || []), ...asArray(matcher.filePrefix.exclude || [])]) {
            this._collectVariables(variables, fp);
          }
        }
      }
    });
  }
  _collectVariables(variables, value) {
    const string = Types.isString(value) ? value : value.value;
    const r = /\$\{(.*?)\}/g;
    let matches;
    do {
      matches = r.exec(string);
      if (matches) {
        variables.add(matches[0]);
      }
    } while (matches);
  }
  async _resolveCommandAndArgs(resolver, commandConfig) {
    let args = commandConfig.args ? commandConfig.args.slice() : [];
    args = await this._resolveVariables(resolver, args);
    const command = await this._resolveVariable(resolver, commandConfig.name);
    return { command, args };
  }
  async _resolveVariables(resolver, value) {
    return Promise.all(value.map((s) => this._resolveVariable(resolver, s)));
  }
  async _resolveMatchers(resolver, values) {
    if (values === void 0 || values === null || values.length === 0) {
      return [];
    }
    const result = [];
    for (const value of values) {
      let matcher;
      if (Types.isString(value)) {
        if (value[0] === "$") {
          matcher = ProblemMatcherRegistry.get(value.substring(1));
        } else {
          matcher = ProblemMatcherRegistry.get(value);
        }
      } else {
        matcher = value;
      }
      if (!matcher) {
        this._appendOutput(nls.localize("unknownProblemMatcher", "Problem matcher {0} can't be resolved. The matcher will be ignored"));
        continue;
      }
      const taskSystemInfo = resolver.taskSystemInfo;
      const hasFilePrefix = matcher.filePrefix !== void 0;
      const hasUriProvider = taskSystemInfo !== void 0 && taskSystemInfo.uriProvider !== void 0;
      if (!hasFilePrefix && !hasUriProvider) {
        result.push(matcher);
      } else {
        const copy = Objects.deepClone(matcher);
        if (hasUriProvider && taskSystemInfo !== void 0) {
          copy.uriProvider = taskSystemInfo.uriProvider;
        }
        if (hasFilePrefix) {
          const filePrefix = copy.filePrefix;
          if (Types.isString(filePrefix)) {
            copy.filePrefix = await this._resolveVariable(resolver, filePrefix);
          } else if (filePrefix !== void 0) {
            if (filePrefix.include) {
              filePrefix.include = Array.isArray(filePrefix.include) ? await Promise.all(filePrefix.include.map((x) => this._resolveVariable(resolver, x))) : await this._resolveVariable(resolver, filePrefix.include);
            }
            if (filePrefix.exclude) {
              filePrefix.exclude = Array.isArray(filePrefix.exclude) ? await Promise.all(filePrefix.exclude.map((x) => this._resolveVariable(resolver, x))) : await this._resolveVariable(resolver, filePrefix.exclude);
            }
          }
        }
        result.push(copy);
      }
    }
    return result;
  }
  async _resolveVariable(resolver, value) {
    if (Types.isString(value)) {
      return resolver.resolve(value);
    } else if (value !== void 0) {
      return {
        value: await resolver.resolve(value.value),
        quoting: value.quoting
      };
    } else {
      throw new Error("Should never try to resolve undefined.");
    }
  }
  async _resolveOptions(resolver, options) {
    if (options === void 0 || options === null) {
      let cwd;
      try {
        cwd = await this._resolveVariable(resolver, "${workspaceFolder}");
      } catch (e) {
      }
      return { cwd };
    }
    const result = Types.isString(options.cwd) ? { cwd: await this._resolveVariable(resolver, options.cwd) } : { cwd: await this._resolveVariable(resolver, "${workspaceFolder}") };
    if (options.env) {
      result.env = /* @__PURE__ */ Object.create(null);
      for (const key of Object.keys(options.env)) {
        const value = options.env[key];
        if (Types.isString(value)) {
          result.env[key] = await this._resolveVariable(resolver, value);
        } else {
          result.env[key] = value.toString();
        }
      }
    }
    return result;
  }
  getSanitizedCommand(cmd) {
    let result = cmd.toLowerCase();
    const index = result.lastIndexOf(path.sep);
    if (index !== -1) {
      result = result.substring(index + 1);
    }
    if (_TerminalTaskSystem.WellKnownCommands[result]) {
      return result;
    }
    return "other";
  }
  getTaskForTerminal(instanceId) {
    for (const key in this._activeTasks) {
      const activeTask = this._activeTasks[key];
      if (activeTask.terminal?.instanceId === instanceId) {
        return activeTask.task;
      }
    }
    return void 0;
  }
  _appendOutput(output) {
    const outputChannel = this._outputService.getChannel(this._outputChannelId);
    outputChannel?.append(output);
  }
};
_TerminalTaskSystem.TelemetryEventName = "taskService";
_TerminalTaskSystem.ProcessVarName = "__process__";
_TerminalTaskSystem._shellQuotes = {
  "cmd": {
    strong: '"'
  },
  "powershell": {
    escape: {
      escapeChar: "`",
      charsToEscape: ` "'()`
    },
    strong: "'",
    weak: '"'
  },
  "bash": {
    escape: {
      escapeChar: "\\",
      charsToEscape: ` "'`
    },
    strong: "'",
    weak: '"'
  },
  "zsh": {
    escape: {
      escapeChar: "\\",
      charsToEscape: ` "'`
    },
    strong: "'",
    weak: '"'
  }
};
_TerminalTaskSystem._osShellQuotes = {
  "Linux": _TerminalTaskSystem._shellQuotes["bash"],
  "Mac": _TerminalTaskSystem._shellQuotes["bash"],
  "Windows": _TerminalTaskSystem._shellQuotes["powershell"]
};
_TerminalTaskSystem.WellKnownCommands = {
  "ant": true,
  "cmake": true,
  "eslint": true,
  "gradle": true,
  "grunt": true,
  "gulp": true,
  "jake": true,
  "jenkins": true,
  "jshint": true,
  "make": true,
  "maven": true,
  "msbuild": true,
  "msc": true,
  "nmake": true,
  "npm": true,
  "rake": true,
  "tsc": true,
  "xbuild": true
};
let TerminalTaskSystem = _TerminalTaskSystem;
function getWaitOnExitValue(presentationOptions, configurationProperties) {
  if (presentationOptions.close === void 0 || presentationOptions.close === false) {
    if (presentationOptions.reveal !== RevealKind.Never || !configurationProperties.isBackground || presentationOptions.close === false) {
      if (presentationOptions.panel === PanelKind.New) {
        return taskShellIntegrationWaitOnExitSequence(nls.localize("closeTerminal", "Press any key to close the terminal."));
      } else if (presentationOptions.showReuseMessage) {
        return taskShellIntegrationWaitOnExitSequence(nls.localize("reuseTerminal", "Terminal will be reused by tasks, press any key to close it."));
      } else {
        return true;
      }
    }
  }
  return !presentationOptions.close;
}
function taskShellIntegrationWaitOnExitSequence(message) {
  return (exitCode) => {
    return `${VSCodeSequence(VSCodeOscPt.CommandFinished, exitCode.toString())}${message}`;
  };
}
function getReconnectionData(terminal) {
  return terminal.shellLaunchConfig.attachPersistentProcess?.reconnectionProperties?.data;
}
export {
  TerminalTaskSystem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9icm93c2VyL3Rlcm1pbmFsVGFza1N5c3RlbS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGFzQXJyYXkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0ICogYXMgQXN5bmMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGlzVU5DIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IExpbmtlZE1hcCwgVG91Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0ICogYXMgT2JqZWN0cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgKiBhcyBQbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgKiBhcyBUeXBlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcblxuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElNYXJrZXJTZXJ2aWNlLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBJV29ya3NwYWNlRm9sZGVyLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IE1hcmtlcnMgfSBmcm9tICcuLi8uLi9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IFByb2JsZW1NYXRjaGVyLCBQcm9ibGVtTWF0Y2hlclJlZ2lzdHJ5IC8qLCBQcm9ibGVtUGF0dGVybiwgZ2V0UmVzb3VyY2UgKi8gfSBmcm9tICcuLi9jb21tb24vcHJvYmxlbU1hdGNoZXIuanMnO1xuXG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU2hlbGxMYXVuY2hDb25maWcsIFdhaXRPbkV4aXRWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBmb3JtYXRNZXNzYWdlRm9yVGVybWluYWwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxTdHJpbmdzLmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUYXNrVGVybWluYWxTdGF0dXMgfSBmcm9tICcuL3Rhc2tUZXJtaW5hbFN0YXR1cy5qcyc7XG5pbXBvcnQgeyBQcm9ibGVtQ29sbGVjdG9yRXZlbnRLaW5kLCBQcm9ibGVtSGFuZGxpbmdTdHJhdGVneSwgU3RhcnRTdG9wUHJvYmxlbUNvbGxlY3RvciwgV2F0Y2hpbmdQcm9ibGVtQ29sbGVjdG9yIH0gZnJvbSAnLi4vY29tbW9uL3Byb2JsZW1Db2xsZWN0b3JzLmpzJztcbmltcG9ydCB7IEdyb3VwS2luZCB9IGZyb20gJy4uL2NvbW1vbi90YXNrQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZVNldCwgSVJlc29sdmVkVmFyaWFibGVzLCBJVGFza0V4ZWN1dGVSZXN1bHQsIElUYXNrUmVzb2x2ZXIsIElUYXNrU3VtbWFyeSwgSVRhc2tTeXN0ZW0sIElUYXNrU3lzdGVtSW5mbywgSVRhc2tTeXN0ZW1JbmZvUmVzb2x2ZXIsIElUYXNrVGVybWluYXRlUmVzcG9uc2UsIFRhc2tFcnJvciwgVGFza0Vycm9ycywgVGFza0V4ZWN1dGVLaW5kLCBUcmlnZ2VycyB9IGZyb20gJy4uL2NvbW1vbi90YXNrU3lzdGVtLmpzJztcbmltcG9ydCB7IENvbW1hbmRPcHRpb25zLCBDb21tYW5kU3RyaW5nLCBDb250cmlidXRlZFRhc2ssIEN1c3RvbVRhc2ssIERlcGVuZHNPcmRlciwgSUNvbW1hbmRDb25maWd1cmF0aW9uLCBJQ29uZmlndXJhdGlvblByb3BlcnRpZXMsIElFeHRlbnNpb25UYXNrU291cmNlLCBJUHJlc2VudGF0aW9uT3B0aW9ucywgSVNoZWxsQ29uZmlndXJhdGlvbiwgSVNoZWxsUXVvdGluZ09wdGlvbnMsIElUYXNrRXZlbnQsIEluTWVtb3J5VGFzaywgUGFuZWxLaW5kLCBSZXZlYWxLaW5kLCBSZXZlYWxQcm9ibGVtS2luZCwgUnVudGltZVR5cGUsIFNoZWxsUXVvdGluZywgVEFTS19URVJNSU5BTF9BQ1RJVkUsIFRhc2ssIFRhc2tFdmVudCwgVGFza0V2ZW50S2luZCwgVGFza1Njb3BlLCBUYXNrU291cmNlS2luZCB9IGZyb20gJy4uL2NvbW1vbi90YXNrcy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxHcm91cFNlcnZpY2UsIElUZXJtaW5hbEluc3RhbmNlLCBJVGVybWluYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBWU0NvZGVPc2NQcm9wZXJ0eSwgVlNDb2RlT3NjUHQsIFZTQ29kZVNlcXVlbmNlIH0gZnJvbSAnLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEVzY2FwZVNlcXVlbmNlcy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFByb2Nlc3NFeHRIb3N0UHJveHkgfSBmcm9tICcuLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsUHJvY2Vzc0V4dEhvc3RQcm94eS5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLCBURVJNSU5BTF9WSUVXX0lEIH0gZnJvbSAnLi4vLi4vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU91dHB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9vdXRwdXQvY29tbW9uL291dHB1dC5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcGFuZWNvbXBvc2l0ZS9icm93c2VyL3BhbmVjb21wb3NpdGUuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVydW5Gb3JBY3RpdmVUZXJtaW5hbENvbW1hbmRJZCwgcmVydW5UYXNrSWNvbiB9IGZyb20gJy4vdGFzay5jb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuXG5pbnRlcmZhY2UgSVRlcm1pbmFsRGF0YSB7XG5cdHRlcm1pbmFsOiBJVGVybWluYWxJbnN0YW5jZTtcblx0bGFzdFRhc2s6IHN0cmluZztcblx0Z3JvdXA/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJSW5zdGFuY2VDb3VudCB7XG5cdGNvdW50OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBJQWN0aXZlVGVybWluYWxEYXRhIHtcblx0dGVybWluYWw/OiBJVGVybWluYWxJbnN0YW5jZTtcblx0dGFzazogVGFzaztcblx0cHJvbWlzZTogUHJvbWlzZTxJVGFza1N1bW1hcnk+O1xuXHRzdGF0ZT86IFRhc2tFdmVudEtpbmQ7XG5cdGNvdW50OiBJSW5zdGFuY2VDb3VudDtcbn1cblxuaW50ZXJmYWNlIElSZWNvbm5lY3Rpb25UYXNrRGF0YSB7XG5cdGxhYmVsOiBzdHJpbmc7XG5cdGlkOiBzdHJpbmc7XG5cdGxhc3RUYXNrOiBzdHJpbmc7XG5cdGdyb3VwPzogc3RyaW5nO1xufVxuXG5jb25zdCBSZWNvbm5lY3Rpb25UeXBlID0gJ1Rhc2snO1xuXG5jbGFzcyBWYXJpYWJsZVJlc29sdmVyIHtcblx0cHJpdmF0ZSBzdGF0aWMgX3JlZ2V4ID0gL1xcJFxceyguKj8pXFx9L2c7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyB3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQsIHB1YmxpYyB0YXNrU3lzdGVtSW5mbzogSVRhc2tTeXN0ZW1JbmZvIHwgdW5kZWZpbmVkLCBwdWJsaWMgcmVhZG9ubHkgdmFsdWVzOiBNYXA8c3RyaW5nLCBzdHJpbmc+LCBwcml2YXRlIF9zZXJ2aWNlOiBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSB8IHVuZGVmaW5lZCkge1xuXHR9XG5cdGFzeW5jIHJlc29sdmUodmFsdWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgcmVwbGFjZXJzOiBQcm9taXNlPHN0cmluZz5bXSA9IFtdO1xuXHRcdHZhbHVlLnJlcGxhY2UoVmFyaWFibGVSZXNvbHZlci5fcmVnZXgsIChtYXRjaCwgLi4uYXJncykgPT4ge1xuXHRcdFx0cmVwbGFjZXJzLnB1c2godGhpcy5fcmVwbGFjZXIobWF0Y2gsIGFyZ3MpKTtcblx0XHRcdHJldHVybiBtYXRjaDtcblx0XHR9KTtcblx0XHRjb25zdCByZXNvbHZlZFJlcGxhY2VycyA9IGF3YWl0IFByb21pc2UuYWxsKHJlcGxhY2Vycyk7XG5cdFx0cmV0dXJuIHZhbHVlLnJlcGxhY2UoVmFyaWFibGVSZXNvbHZlci5fcmVnZXgsICgpID0+IHJlc29sdmVkUmVwbGFjZXJzLnNoaWZ0KCkhKTtcblxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVwbGFjZXIobWF0Y2g6IHN0cmluZywgYXJnczogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdC8vIFN0cmlwIG91dCB0aGUgJHt9IGJlY2F1c2UgdGhlIG1hcCBjb250YWlucyB0aGVtIHZhcmlhYmxlcyB3aXRob3V0IHRob3NlIGNoYXJhY3RlcnMuXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy52YWx1ZXMuZ2V0KG1hdGNoLnN1YnN0cmluZygyLCBtYXRjaC5sZW5ndGggLSAxKSk7XG5cdFx0aWYgKChyZXN1bHQgIT09IHVuZGVmaW5lZCkgJiYgKHJlc3VsdCAhPT0gbnVsbCkpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9zZXJ2aWNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2VydmljZS5yZXNvbHZlQXN5bmModGhpcy53b3Jrc3BhY2VGb2xkZXIsIG1hdGNoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1hdGNoO1xuXHR9XG59XG5cbmNsYXNzIFZlcmlmaWVkVGFzayB7XG5cdHJlYWRvbmx5IHRhc2s6IFRhc2s7XG5cdHJlYWRvbmx5IHJlc29sdmVyOiBJVGFza1Jlc29sdmVyO1xuXHRyZWFkb25seSB0cmlnZ2VyOiBzdHJpbmc7XG5cdHJlc29sdmVkVmFyaWFibGVzPzogSVJlc29sdmVkVmFyaWFibGVzO1xuXHRzeXN0ZW1JbmZvPzogSVRhc2tTeXN0ZW1JbmZvO1xuXHR3b3Jrc3BhY2VGb2xkZXI/OiBJV29ya3NwYWNlRm9sZGVyO1xuXHRzaGVsbExhdW5jaENvbmZpZz86IElTaGVsbExhdW5jaENvbmZpZztcblxuXHRjb25zdHJ1Y3Rvcih0YXNrOiBUYXNrLCByZXNvbHZlcjogSVRhc2tSZXNvbHZlciwgdHJpZ2dlcjogc3RyaW5nKSB7XG5cdFx0dGhpcy50YXNrID0gdGFzaztcblx0XHR0aGlzLnJlc29sdmVyID0gcmVzb2x2ZXI7XG5cdFx0dGhpcy50cmlnZ2VyID0gdHJpZ2dlcjtcblx0fVxuXG5cdHB1YmxpYyB2ZXJpZnkoKTogYm9vbGVhbiB7XG5cdFx0bGV0IHZlcmlmaWVkID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMudHJpZ2dlciAmJiB0aGlzLnJlc29sdmVkVmFyaWFibGVzICYmIHRoaXMud29ya3NwYWNlRm9sZGVyICYmICh0aGlzLnNoZWxsTGF1bmNoQ29uZmlnICE9PSB1bmRlZmluZWQpKSB7XG5cdFx0XHR2ZXJpZmllZCA9IHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiB2ZXJpZmllZDtcblx0fVxuXG5cdHB1YmxpYyBnZXRWZXJpZmllZFRhc2soKTogeyB0YXNrOiBUYXNrOyByZXNvbHZlcjogSVRhc2tSZXNvbHZlcjsgdHJpZ2dlcjogc3RyaW5nOyByZXNvbHZlZFZhcmlhYmxlczogSVJlc29sdmVkVmFyaWFibGVzOyBzeXN0ZW1JbmZvOiBJVGFza1N5c3RlbUluZm87IHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlcjsgc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyB9IHtcblx0XHRpZiAodGhpcy52ZXJpZnkoKSkge1xuXHRcdFx0cmV0dXJuIHsgdGFzazogdGhpcy50YXNrLCByZXNvbHZlcjogdGhpcy5yZXNvbHZlciwgdHJpZ2dlcjogdGhpcy50cmlnZ2VyLCByZXNvbHZlZFZhcmlhYmxlczogdGhpcy5yZXNvbHZlZFZhcmlhYmxlcyEsIHN5c3RlbUluZm86IHRoaXMuc3lzdGVtSW5mbyEsIHdvcmtzcGFjZUZvbGRlcjogdGhpcy53b3Jrc3BhY2VGb2xkZXIhLCBzaGVsbExhdW5jaENvbmZpZzogdGhpcy5zaGVsbExhdW5jaENvbmZpZyEgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdWZXJpZmllZFRhc2sgd2FzIG5vdCBjaGVja2VkLiB2ZXJpZnkgbXVzdCBiZSBjaGVja2VkIGJlZm9yZSBnZXRWZXJpZmllZFRhc2suJyk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbFRhc2tTeXN0ZW0gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRhc2tTeXN0ZW0ge1xuXG5cdHB1YmxpYyBzdGF0aWMgVGVsZW1ldHJ5RXZlbnROYW1lOiBzdHJpbmcgPSAndGFza1NlcnZpY2UnO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFByb2Nlc3NWYXJOYW1lID0gJ19fcHJvY2Vzc19fJztcblxuXHRwcml2YXRlIHN0YXRpYyBfc2hlbGxRdW90ZXM6IElTdHJpbmdEaWN0aW9uYXJ5PElTaGVsbFF1b3RpbmdPcHRpb25zPiA9IHtcblx0XHQnY21kJzoge1xuXHRcdFx0c3Ryb25nOiAnXCInXG5cdFx0fSxcblx0XHQncG93ZXJzaGVsbCc6IHtcblx0XHRcdGVzY2FwZToge1xuXHRcdFx0XHRlc2NhcGVDaGFyOiAnYCcsXG5cdFx0XHRcdGNoYXJzVG9Fc2NhcGU6ICcgXCJcXCcoKSdcblx0XHRcdH0sXG5cdFx0XHRzdHJvbmc6ICdcXCcnLFxuXHRcdFx0d2VhazogJ1wiJ1xuXHRcdH0sXG5cdFx0J2Jhc2gnOiB7XG5cdFx0XHRlc2NhcGU6IHtcblx0XHRcdFx0ZXNjYXBlQ2hhcjogJ1xcXFwnLFxuXHRcdFx0XHRjaGFyc1RvRXNjYXBlOiAnIFwiXFwnJ1xuXHRcdFx0fSxcblx0XHRcdHN0cm9uZzogJ1xcJycsXG5cdFx0XHR3ZWFrOiAnXCInXG5cdFx0fSxcblx0XHQnenNoJzoge1xuXHRcdFx0ZXNjYXBlOiB7XG5cdFx0XHRcdGVzY2FwZUNoYXI6ICdcXFxcJyxcblx0XHRcdFx0Y2hhcnNUb0VzY2FwZTogJyBcIlxcJydcblx0XHRcdH0sXG5cdFx0XHRzdHJvbmc6ICdcXCcnLFxuXHRcdFx0d2VhazogJ1wiJ1xuXHRcdH1cblx0fTtcblxuXHRwcml2YXRlIHN0YXRpYyBfb3NTaGVsbFF1b3RlczogSVN0cmluZ0RpY3Rpb25hcnk8SVNoZWxsUXVvdGluZ09wdGlvbnM+ID0ge1xuXHRcdCdMaW51eCc6IFRlcm1pbmFsVGFza1N5c3RlbS5fc2hlbGxRdW90ZXNbJ2Jhc2gnXSxcblx0XHQnTWFjJzogVGVybWluYWxUYXNrU3lzdGVtLl9zaGVsbFF1b3Rlc1snYmFzaCddLFxuXHRcdCdXaW5kb3dzJzogVGVybWluYWxUYXNrU3lzdGVtLl9zaGVsbFF1b3Rlc1sncG93ZXJzaGVsbCddXG5cdH07XG5cblx0cHJpdmF0ZSBfYWN0aXZlVGFza3M6IElTdHJpbmdEaWN0aW9uYXJ5PElBY3RpdmVUZXJtaW5hbERhdGE+O1xuXHRwcml2YXRlIF9idXN5VGFza3M6IElTdHJpbmdEaWN0aW9uYXJ5PFRhc2s+O1xuXHRwcml2YXRlIF90ZXJtaW5hbHM6IElTdHJpbmdEaWN0aW9uYXJ5PElUZXJtaW5hbERhdGE+O1xuXHRwcml2YXRlIF9pZGxlVGFza1Rlcm1pbmFsczogTGlua2VkTWFwPHN0cmluZywgc3RyaW5nPjtcblx0cHJpdmF0ZSBfc2FtZVRhc2tUZXJtaW5hbHM6IElTdHJpbmdEaWN0aW9uYXJ5PHN0cmluZz47XG5cdHByaXZhdGUgX3Rhc2tTeXN0ZW1JbmZvUmVzb2x2ZXI6IElUYXNrU3lzdGVtSW5mb1Jlc29sdmVyO1xuXHRwcml2YXRlIF9sYXN0VGFzazogVmVyaWZpZWRUYXNrIHwgdW5kZWZpbmVkO1xuXHQvLyBTaG91bGQgYWx3YXlzIGJlIHNldCBpbiBydW5cblx0cHJpdmF0ZSBfY3VycmVudFRhc2shOiBWZXJpZmllZFRhc2s7XG5cdHByaXZhdGUgX2lzUmVydW46IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfcHJldmlvdXNQYW5lbElkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3ByZXZpb3VzVGVybWluYWxJbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Rlcm1pbmFsU3RhdHVzTWFuYWdlcjogVGFza1Rlcm1pbmFsU3RhdHVzO1xuXHRwcml2YXRlIF90ZXJtaW5hbENyZWF0aW9uUXVldWU6IFByb21pc2U8SVRlcm1pbmFsSW5zdGFuY2UgfCB2b2lkPiA9IFByb21pc2UucmVzb2x2ZSgpO1xuXHRwcml2YXRlIF9oYXNSZWNvbm5lY3RlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFN0YXRlQ2hhbmdlOiBFbWl0dGVyPElUYXNrRXZlbnQ+O1xuXHRwcml2YXRlIF9yZWNvbm5lY3RlZFRlcm1pbmFsczogSVRlcm1pbmFsSW5zdGFuY2VbXSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfdGVybWluYWxUYWJBY3Rpb25zID0gW3sgaWQ6IFJlcnVuRm9yQWN0aXZlVGVybWluYWxDb21tYW5kSWQsIGxhYmVsOiBubHMubG9jYWxpemUoJ3JlcnVuVGFzaycsICdSZXJ1biBUYXNrJyksIGljb246IHJlcnVuVGFza0ljb24gfV07XG5cdHByaXZhdGUgX3Rhc2tUZXJtaW5hbEFjdGl2ZTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0dGFza1NoZWxsSW50ZWdyYXRpb25TdGFydFNlcXVlbmNlKGN3ZDogc3RyaW5nIHwgVVJJIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gKFxuXHRcdFx0VlNDb2RlU2VxdWVuY2UoVlNDb2RlT3NjUHQuUHJvbXB0U3RhcnQpICtcblx0XHRcdFZTQ29kZVNlcXVlbmNlKFZTQ29kZU9zY1B0LlByb3BlcnR5LCBgJHtWU0NvZGVPc2NQcm9wZXJ0eS5UYXNrfT1UcnVlYCkgK1xuXHRcdFx0KGN3ZFxuXHRcdFx0XHQ/IFZTQ29kZVNlcXVlbmNlKFZTQ29kZU9zY1B0LlByb3BlcnR5LCBgJHtWU0NvZGVPc2NQcm9wZXJ0eS5Dd2R9PSR7dHlwZW9mIGN3ZCA9PT0gJ3N0cmluZycgPyBjd2QgOiBjd2QuZnNQYXRofWApXG5cdFx0XHRcdDogJydcblx0XHRcdCkgK1xuXHRcdFx0VlNDb2RlU2VxdWVuY2UoVlNDb2RlT3NjUHQuQ29tbWFuZFN0YXJ0KVxuXHRcdCk7XG5cdH1cblx0Z2V0IHRhc2tTaGVsbEludGVncmF0aW9uT3V0cHV0U2VxdWVuY2UoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gVlNDb2RlU2VxdWVuY2UoVlNDb2RlT3NjUHQuQ29tbWFuZEV4ZWN1dGVkKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX3Rlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZSxcblx0XHRwcml2YXRlIF90ZXJtaW5hbEdyb3VwU2VydmljZTogSVRlcm1pbmFsR3JvdXBTZXJ2aWNlLFxuXHRcdHByaXZhdGUgX291dHB1dFNlcnZpY2U6IElPdXRwdXRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgX3BhbmVDb21wb3NpdGVTZXJ2aWNlOiBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgX3ZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0XHRwcml2YXRlIF9tYXJrZXJTZXJ2aWNlOiBJTWFya2VyU2VydmljZSxcblx0XHRwcml2YXRlIF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBfY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZTogSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBfY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRwcml2YXRlIF9lbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBfb3V0cHV0Q2hhbm5lbElkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRwcml2YXRlIF90ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2U6IElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBfcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRwcml2YXRlIF92aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0Y29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdHRhc2tTeXN0ZW1JbmZvUmVzb2x2ZXI6IElUYXNrU3lzdGVtSW5mb1Jlc29sdmVyLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fYWN0aXZlVGFza3MgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMuX2J1c3lUYXNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0dGhpcy5fdGVybWluYWxzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLl9pZGxlVGFza1Rlcm1pbmFscyA9IG5ldyBMaW5rZWRNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0dGhpcy5fc2FtZVRhc2tUZXJtaW5hbHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMuX29uRGlkU3RhdGVDaGFuZ2UgPSBuZXcgRW1pdHRlcigpO1xuXHRcdHRoaXMuX3Rhc2tTeXN0ZW1JbmZvUmVzb2x2ZXIgPSB0YXNrU3lzdGVtSW5mb1Jlc29sdmVyO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsU3RhdHVzTWFuYWdlciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRhc2tUZXJtaW5hbFN0YXR1cykpO1xuXHRcdHRoaXMuX3Rhc2tUZXJtaW5hbEFjdGl2ZSA9IFRBU0tfVEVSTUlOQUxfQUNUSVZFLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWxTZXJ2aWNlLm9uRGlkQ2hhbmdlQWN0aXZlSW5zdGFuY2UoKGUpID0+IHRoaXMuX3Rhc2tUZXJtaW5hbEFjdGl2ZS5zZXQoZT8uc2hlbGxMYXVuY2hDb25maWcudHlwZSA9PT0gJ1Rhc2snKSkpO1xuXHR9XG5cblx0cHVibGljIGdldCBvbkRpZFN0YXRlQ2hhbmdlKCk6IEV2ZW50PElUYXNrRXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRTdGF0ZUNoYW5nZS5ldmVudDtcblx0fVxuXG5cdHByaXZhdGUgX2xvZyh2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fYXBwZW5kT3V0cHV0KHZhbHVlICsgJ1xcbicpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9zaG93T3V0cHV0KCk6IHZvaWQge1xuXHRcdHRoaXMuX291dHB1dFNlcnZpY2Uuc2hvd0NoYW5uZWwodGhpcy5fb3V0cHV0Q2hhbm5lbElkLCB0cnVlKTtcblx0fVxuXG5cdHB1YmxpYyByZWNvbm5lY3QodGFzazogVGFzaywgcmVzb2x2ZXI6IElUYXNrUmVzb2x2ZXIpOiBJVGFza0V4ZWN1dGVSZXN1bHQge1xuXHRcdHRoaXMuX3JlY29ubmVjdFRvVGVybWluYWxzKCk7XG5cdFx0cmV0dXJuIHRoaXMucnVuKHRhc2ssIHJlc29sdmVyLCBUcmlnZ2Vycy5yZWNvbm5lY3QpO1xuXHR9XG5cblx0cHVibGljIHJ1bih0YXNrOiBUYXNrLCByZXNvbHZlcjogSVRhc2tSZXNvbHZlciwgdHJpZ2dlcjogc3RyaW5nID0gVHJpZ2dlcnMuY29tbWFuZCk6IElUYXNrRXhlY3V0ZVJlc3VsdCB7XG5cdFx0dGFzayA9IHRhc2suY2xvbmUoKTsgLy8gQSBzbWFsbCBhbW91bnQgb2YgdGFzayBzdGF0ZSBpcyBzdG9yZWQgaW4gdGhlIHRhc2sgKGluc3RhbmNlKSBhbmQgdGFza3MgcGFzc2VkIGluIHRvIHJ1biBtYXkgaGF2ZSB0aGF0IHNldCBhbHJlYWR5LlxuXHRcdGNvbnN0IGluc3RhbmNlcyA9IEluTWVtb3J5VGFzay5pcyh0YXNrKSB8fCB0aGlzLl9pc1Rhc2tFbXB0eSh0YXNrKSA/IFtdIDogdGhpcy5fZ2V0SW5zdGFuY2VzKHRhc2spO1xuXHRcdGNvbnN0IHZhbGlkSW5zdGFuY2UgPSBpbnN0YW5jZXMubGVuZ3RoIDwgKCh0YXNrLnJ1bk9wdGlvbnMgJiYgdGFzay5ydW5PcHRpb25zLmluc3RhbmNlTGltaXQpID8/IDEpO1xuXHRcdGNvbnN0IGluc3RhbmNlID0gaW5zdGFuY2VzWzBdPy5jb3VudD8uY291bnQgPz8gMDtcblx0XHR0aGlzLl9jdXJyZW50VGFzayA9IG5ldyBWZXJpZmllZFRhc2sodGFzaywgcmVzb2x2ZXIsIHRyaWdnZXIpO1xuXHRcdGlmIChpbnN0YW5jZSA+IDApIHtcblx0XHRcdHRhc2suaW5zdGFuY2UgPSBpbnN0YW5jZTtcblx0XHR9XG5cdFx0aWYgKCF2YWxpZEluc3RhbmNlKSB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbERhdGEgPSBpbnN0YW5jZXNbaW5zdGFuY2VzLmxlbmd0aCAtIDFdO1xuXHRcdFx0dGhpcy5fbGFzdFRhc2sgPSB0aGlzLl9jdXJyZW50VGFzaztcblx0XHRcdHJldHVybiB7IGtpbmQ6IFRhc2tFeGVjdXRlS2luZC5BY3RpdmUsIHRhc2s6IHRlcm1pbmFsRGF0YS50YXNrLCBhY3RpdmU6IHsgc2FtZTogdHJ1ZSwgYmFja2dyb3VuZDogdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pc0JhY2tncm91bmQhIH0sIHByb21pc2U6IHRlcm1pbmFsRGF0YS5wcm9taXNlIH07XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGV4ZWN1dGVSZXN1bHQgPSB7IGtpbmQ6IFRhc2tFeGVjdXRlS2luZC5TdGFydGVkLCB0YXNrLCBzdGFydGVkOiB7fSwgcHJvbWlzZTogdGhpcy5fZXhlY3V0ZVRhc2sodGFzaywgcmVzb2x2ZXIsIHRyaWdnZXIsIG5ldyBTZXQoKSwgbmV3IE1hcCgpLCB1bmRlZmluZWQpIH07XG5cdFx0XHRleGVjdXRlUmVzdWx0LnByb21pc2UudGhlbihzdW1tYXJ5ID0+IHtcblx0XHRcdFx0dGhpcy5fbGFzdFRhc2sgPSB0aGlzLl9jdXJyZW50VGFzaztcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGV4ZWN1dGVSZXN1bHQ7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmIChlcnJvciBpbnN0YW5jZW9mIFRhc2tFcnJvcikge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH0gZWxzZSBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuXHRcdFx0XHR0aGlzLl9sb2coZXJyb3IubWVzc2FnZSk7XG5cdFx0XHRcdHRocm93IG5ldyBUYXNrRXJyb3IoU2V2ZXJpdHkuRXJyb3IsIGVycm9yLm1lc3NhZ2UsIFRhc2tFcnJvcnMuVW5rbm93bkVycm9yKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2xvZyhlcnJvci50b1N0cmluZygpKTtcblx0XHRcdFx0dGhyb3cgbmV3IFRhc2tFcnJvcihTZXZlcml0eS5FcnJvciwgbmxzLmxvY2FsaXplKCdUZXJtaW5hbFRhc2tTeXN0ZW0udW5rbm93bkVycm9yJywgJ0EgdW5rbm93biBlcnJvciBoYXMgb2NjdXJyZWQgd2hpbGUgZXhlY3V0aW5nIGEgdGFzay4gU2VlIHRhc2sgb3V0cHV0IGxvZyBmb3IgZGV0YWlscy4nKSwgVGFza0Vycm9ycy5Vbmtub3duRXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyByZXJ1bigpOiBJVGFza0V4ZWN1dGVSZXN1bHQgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl9sYXN0VGFzayAmJiB0aGlzLl9sYXN0VGFzay52ZXJpZnkoKSkge1xuXHRcdFx0aWYgKCh0aGlzLl9sYXN0VGFzay50YXNrLnJ1bk9wdGlvbnMucmVldmFsdWF0ZU9uUmVydW4gIT09IHVuZGVmaW5lZCkgJiYgIXRoaXMuX2xhc3RUYXNrLnRhc2sucnVuT3B0aW9ucy5yZWV2YWx1YXRlT25SZXJ1bikge1xuXHRcdFx0XHR0aGlzLl9pc1JlcnVuID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMucnVuKHRoaXMuX2xhc3RUYXNrLnRhc2ssIHRoaXMuX2xhc3RUYXNrLnJlc29sdmVyKTtcblx0XHRcdHJlc3VsdC5wcm9taXNlLnRoZW4oc3VtbWFyeSA9PiB7XG5cdFx0XHRcdHRoaXMuX2lzUmVydW4gPSBmYWxzZTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zaG93VGFza0xvYWRFcnJvcnModGFzazogVGFzaykge1xuXHRcdGlmICh0YXNrLnRhc2tMb2FkTWVzc2FnZXMgJiYgdGFzay50YXNrTG9hZE1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRhc2sudGFza0xvYWRNZXNzYWdlcy5mb3JFYWNoKGxvYWRNZXNzYWdlID0+IHtcblx0XHRcdFx0dGhpcy5fbG9nKGxvYWRNZXNzYWdlICsgJ1xcbicpO1xuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBvcGVuT3V0cHV0ID0gJ1Nob3cgT3V0cHV0Jztcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnVGVybWluYWxUYXNrU3lzdGVtLnRhc2tMb2FkUmVwb3J0aW5nJywgXCJUaGVyZSBhcmUgaXNzdWVzIHdpdGggdGFzayBcXFwiezB9XFxcIi4gU2VlIHRoZSBvdXRwdXQgZm9yIG1vcmUgZGV0YWlscy5cIixcblx0XHRcdFx0XHR0YXNrLl9sYWJlbCksIFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogb3Blbk91dHB1dCxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5fc2hvd091dHB1dCgpXG5cdFx0XHRcdFx0fV0pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBpc1Rhc2tWaXNpYmxlKHRhc2s6IFRhc2spOiBib29sZWFuIHtcblx0XHRjb25zdCB0ZXJtaW5hbERhdGEgPSB0aGlzLl9hY3RpdmVUYXNrc1t0YXNrLmdldE1hcEtleSgpXTtcblx0XHRpZiAoIXRlcm1pbmFsRGF0YT8udGVybWluYWwpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgYWN0aXZlVGVybWluYWxJbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5hY3RpdmVJbnN0YW5jZTtcblx0XHRjb25zdCBpc1BhbmVsU2hvd2luZ1Rlcm1pbmFsID0gISF0aGlzLl92aWV3c1NlcnZpY2UuZ2V0QWN0aXZlVmlld1dpdGhJZChURVJNSU5BTF9WSUVXX0lEKTtcblx0XHRyZXR1cm4gaXNQYW5lbFNob3dpbmdUZXJtaW5hbCAmJiAoYWN0aXZlVGVybWluYWxJbnN0YW5jZT8uaW5zdGFuY2VJZCA9PT0gdGVybWluYWxEYXRhLnRlcm1pbmFsLmluc3RhbmNlSWQpO1xuXHR9XG5cblxuXHRwdWJsaWMgcmV2ZWFsVGFzayh0YXNrOiBUYXNrKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgdGVybWluYWxEYXRhID0gdGhpcy5fYWN0aXZlVGFza3NbdGFzay5nZXRNYXBLZXkoKV07XG5cdFx0aWYgKCF0ZXJtaW5hbERhdGE/LnRlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IGlzVGVybWluYWxJblBhbmVsOiBib29sZWFuID0gdGhpcy5fdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdMb2NhdGlvbkJ5SWQoVEVSTUlOQUxfVklFV19JRCkgPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbDtcblx0XHRpZiAoaXNUZXJtaW5hbEluUGFuZWwgJiYgdGhpcy5pc1Rhc2tWaXNpYmxlKHRhc2spKSB7XG5cdFx0XHRpZiAodGhpcy5fcHJldmlvdXNQYW5lbElkKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9wcmV2aW91c1Rlcm1pbmFsSW5zdGFuY2UpIHtcblx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UodGhpcy5fcHJldmlvdXNUZXJtaW5hbEluc3RhbmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9wYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZSh0aGlzLl9wcmV2aW91c1BhbmVsSWQsIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9wYW5lQ29tcG9zaXRlU2VydmljZS5oaWRlQWN0aXZlUGFuZUNvbXBvc2l0ZShWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fcHJldmlvdXNQYW5lbElkID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fcHJldmlvdXNUZXJtaW5hbEluc3RhbmNlID0gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoaXNUZXJtaW5hbEluUGFuZWwpIHtcblx0XHRcdFx0dGhpcy5fcHJldmlvdXNQYW5lbElkID0gdGhpcy5fcGFuZUNvbXBvc2l0ZVNlcnZpY2UuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZShWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwpPy5nZXRJZCgpO1xuXHRcdFx0XHRpZiAodGhpcy5fcHJldmlvdXNQYW5lbElkID09PSBURVJNSU5BTF9WSUVXX0lEKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJldmlvdXNUZXJtaW5hbEluc3RhbmNlID0gdGhpcy5fdGVybWluYWxTZXJ2aWNlLmFjdGl2ZUluc3RhbmNlID8/IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKHRlcm1pbmFsRGF0YS50ZXJtaW5hbCk7XG5cdFx0XHRpZiAoQ3VzdG9tVGFzay5pcyh0YXNrKSB8fCBDb250cmlidXRlZFRhc2suaXModGFzaykpIHtcblx0XHRcdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2Uuc2hvd1BhbmVsKHRhc2suY29tbWFuZC5wcmVzZW50YXRpb24hLmZvY3VzKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgaXNBY3RpdmUoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLmlzQWN0aXZlU3luYygpKTtcblx0fVxuXG5cdHB1YmxpYyBpc0FjdGl2ZVN5bmMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5fYWN0aXZlVGFza3MpLnNvbWUodmFsdWUgPT4gISF2YWx1ZS50ZXJtaW5hbCk7XG5cdH1cblxuXHRwdWJsaWMgY2FuQXV0b1Rlcm1pbmF0ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9hY3RpdmVUYXNrcykuZXZlcnkodmFsdWUgPT4gIXZhbHVlLnRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvbXB0T25DbG9zZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWN0aXZlVGFza3MoKTogVGFza1tdIHtcblx0XHRyZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9hY3RpdmVUYXNrcykuZmxhdE1hcCh2YWx1ZSA9PiB2YWx1ZS50ZXJtaW5hbCA/IHZhbHVlLnRhc2sgOiBbXSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGFzdEluc3RhbmNlKHRhc2s6IFRhc2spOiBUYXNrIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZWNlbnRLZXkgPSB0YXNrLmdldEtleSgpO1xuXHRcdHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX2FjdGl2ZVRhc2tzKS5yZXZlcnNlKCkuZmluZChcblx0XHRcdCh2YWx1ZSkgPT4gcmVjZW50S2V5ICYmIHJlY2VudEtleSA9PT0gdmFsdWUudGFzay5nZXRLZXkoKSk/LnRhc2s7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QnVzeVRhc2tzKCk6IFRhc2tbXSB7XG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2J1c3lUYXNrcykubWFwKGtleSA9PiB0aGlzLl9idXN5VGFza3Nba2V5XSk7XG5cdH1cblxuXHRwdWJsaWMgY3VzdG9tRXhlY3V0aW9uQ29tcGxldGUodGFzazogVGFzaywgcmVzdWx0OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBhY3RpdmVUZXJtaW5hbCA9IHRoaXMuX2FjdGl2ZVRhc2tzW3Rhc2suZ2V0TWFwS2V5KCldO1xuXHRcdGlmICghYWN0aXZlVGVybWluYWw/LnRlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdFeHBlY3RlZCB0byBoYXZlIGEgdGVybWluYWwgZm9yIGEgY3VzdG9tIGV4ZWN1dGlvbiB0YXNrJykpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuXHRcdFx0Ly8gYWN0aXZlVGVybWluYWwudGVybWluYWwucmVuZGVyZXJFeGl0KHJlc3VsdCk7XG5cdFx0XHRyZXNvbHZlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRJbnN0YW5jZXModGFzazogVGFzayk6IElBY3RpdmVUZXJtaW5hbERhdGFbXSB7XG5cdFx0Y29uc3QgcmVjZW50S2V5ID0gdGFzay5nZXRLZXkoKTtcblx0XHRyZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9hY3RpdmVUYXNrcykuZmlsdGVyKFxuXHRcdFx0KHZhbHVlKSA9PiByZWNlbnRLZXkgJiYgcmVjZW50S2V5ID09PSB2YWx1ZS50YXNrLmdldEtleSgpKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbW92ZUZyb21BY3RpdmVUYXNrcyh0YXNrOiBUYXNrIHwgc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3Qga2V5ID0gdHlwZW9mIHRhc2sgPT09ICdzdHJpbmcnID8gdGFzayA6IHRhc2suZ2V0TWFwS2V5KCk7XG5cdFx0Y29uc3QgdGFza1RvUmVtb3ZlID0gdGhpcy5fYWN0aXZlVGFza3Nba2V5XTtcblx0XHRpZiAoIXRhc2tUb1JlbW92ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRkZWxldGUgdGhpcy5fYWN0aXZlVGFza3Nba2V5XTtcblx0fVxuXG5cdHByaXZhdGUgX2ZpcmVUYXNrRXZlbnQoZXZlbnQ6IElUYXNrRXZlbnQpIHtcblx0XHRpZiAoZXZlbnQua2luZCAhPT0gVGFza0V2ZW50S2luZC5DaGFuZ2VkKSB7XG5cdFx0XHRjb25zdCBhY3RpdmVUYXNrID0gdGhpcy5fYWN0aXZlVGFza3NbZXZlbnQuX190YXNrLmdldE1hcEtleSgpXTtcblx0XHRcdGlmIChhY3RpdmVUYXNrKSB7XG5cdFx0XHRcdGFjdGl2ZVRhc2suc3RhdGUgPSBldmVudC5raW5kO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9vbkRpZFN0YXRlQ2hhbmdlLmZpcmUoZXZlbnQpO1xuXHR9XG5cblx0cHVibGljIHRlcm1pbmF0ZSh0YXNrOiBUYXNrKTogUHJvbWlzZTxJVGFza1Rlcm1pbmF0ZVJlc3BvbnNlPiB7XG5cdFx0Y29uc3QgYWN0aXZlVGVybWluYWwgPSB0aGlzLl9hY3RpdmVUYXNrc1t0YXNrLmdldE1hcEtleSgpXTtcblx0XHRpZiAoIWFjdGl2ZVRlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlPElUYXNrVGVybWluYXRlUmVzcG9uc2U+KHsgc3VjY2VzczogZmFsc2UsIHRhc2s6IHVuZGVmaW5lZCB9KTtcblx0XHR9XG5cdFx0Y29uc3QgdGVybWluYWwgPSBhY3RpdmVUZXJtaW5hbC50ZXJtaW5hbDtcblx0XHRpZiAoIXRlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlPElUYXNrVGVybWluYXRlUmVzcG9uc2U+KHsgc3VjY2VzczogZmFsc2UsIHRhc2s6IHVuZGVmaW5lZCB9KTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPElUYXNrVGVybWluYXRlUmVzcG9uc2U+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHRlcm1pbmFsLm9uRGlzcG9zZWQodGVybWluYWwgPT4ge1xuXHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC50ZXJtaW5hdGVkKHRhc2ssIHRlcm1pbmFsLmluc3RhbmNlSWQsIHRlcm1pbmFsLmV4aXRSZWFzb24pKTtcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3Qgb25FeGl0ID0gdGVybWluYWwub25FeGl0KCgpID0+IHtcblx0XHRcdFx0Y29uc3QgdGFzayA9IGFjdGl2ZVRlcm1pbmFsLnRhc2s7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0b25FeGl0LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC50ZXJtaW5hdGVkKHRhc2ssIHRlcm1pbmFsLmluc3RhbmNlSWQsIHRlcm1pbmFsLmV4aXRSZWFzb24pKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHQvLyBEbyBub3RoaW5nLlxuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlLCB0YXNrOiB0YXNrIH0pO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXJtaW5hbC5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgdGVybWluYXRlQWxsKCk6IFByb21pc2U8SVRhc2tUZXJtaW5hdGVSZXNwb25zZVtdPiB7XG5cdFx0Y29uc3QgcHJvbWlzZXM6IFByb21pc2U8SVRhc2tUZXJtaW5hdGVSZXNwb25zZT5bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW2tleSwgdGVybWluYWxEYXRhXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hY3RpdmVUYXNrcykpIHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsID0gdGVybWluYWxEYXRhPy50ZXJtaW5hbDtcblx0XHRcdGlmICh0ZXJtaW5hbCkge1xuXHRcdFx0XHRwcm9taXNlcy5wdXNoKG5ldyBQcm9taXNlPElUYXNrVGVybWluYXRlUmVzcG9uc2U+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0XHRjb25zdCBvbkV4aXQgPSB0ZXJtaW5hbC5vbkV4aXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgdGFzayA9IHRlcm1pbmFsRGF0YS50YXNrO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0b25FeGl0LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQudGVybWluYXRlZCh0YXNrLCB0ZXJtaW5hbC5pbnN0YW5jZUlkLCB0ZXJtaW5hbC5leGl0UmVhc29uKSk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0XHQvLyBEbyBub3RoaW5nLlxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX2FjdGl2ZVRhc2tzW2tleV0gPT09IHRlcm1pbmFsRGF0YSkge1xuXHRcdFx0XHRcdFx0XHRkZWxldGUgdGhpcy5fYWN0aXZlVGFza3Nba2V5XTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlLCB0YXNrOiB0ZXJtaW5hbERhdGEudGFzayB9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHR0ZXJtaW5hbC5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLmFsbDxJVGFza1Rlcm1pbmF0ZVJlc3BvbnNlPihwcm9taXNlcyk7XG5cdH1cblxuXHRwcml2YXRlIF9zaG93RGVwZW5kZW5jeUN5Y2xlTWVzc2FnZSh0YXNrOiBUYXNrKSB7XG5cdFx0dGhpcy5fbG9nKG5scy5sb2NhbGl6ZSgnZGVwZW5kZW5jeUN5Y2xlJyxcblx0XHRcdCdUaGVyZSBpcyBhIGRlcGVuZGVuY3kgY3ljbGUuIFNlZSB0YXNrIFwiezB9XCIuJyxcblx0XHRcdHRhc2suX2xhYmVsXG5cdFx0KSk7XG5cdFx0dGhpcy5fc2hvd091dHB1dCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZXhlY3V0ZVRhc2sodGFzazogVGFzaywgcmVzb2x2ZXI6IElUYXNrUmVzb2x2ZXIsIHRyaWdnZXI6IHN0cmluZywgbGl2ZURlcGVuZGVuY2llczogU2V0PHN0cmluZz4sIGVuY291bnRlcmVkVGFza3M6IE1hcDxzdHJpbmcsIFByb21pc2U8SVRhc2tTdW1tYXJ5Pj4sIGFscmVhZHlSZXNvbHZlZD86IE1hcDxzdHJpbmcsIHN0cmluZz4pOiBQcm9taXNlPElUYXNrU3VtbWFyeT4ge1xuXHRcdHRoaXMuX3Nob3dUYXNrTG9hZEVycm9ycyh0YXNrKTtcblxuXHRcdGNvbnN0IG1hcEtleSA9IHRhc2suZ2V0TWFwS2V5KCk7XG5cblx0XHQvLyBJdCdzIGltcG9ydGFudCB0aGF0IHdlIGFkZCB0aGlzIHRhc2sncyBlbnRyeSB0byBfYWN0aXZlVGFza3MgYmVmb3JlXG5cdFx0Ly8gYW55IG9mIHRoZSBjb2RlIGluIHRoZSB0aGVuIHJ1bnMgKHNlZSAjMTgwNTQxIGFuZCAjMTgwNTc4KS4gV3JhcHBpbmdcblx0XHQvLyBpdCBpbiBQcm9taXNlLnJlc29sdmUoKS50aGVuKCkgZW5zdXJlcyB0aGF0LlxuXHRcdGNvbnN0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKS50aGVuKGFzeW5jICgpID0+IHtcblx0XHRcdGFscmVhZHlSZXNvbHZlZCA9IGFscmVhZHlSZXNvbHZlZCA/PyBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXHRcdFx0Y29uc3QgcHJvbWlzZXM6IFByb21pc2U8SVRhc2tTdW1tYXJ5PltdID0gW107XG5cdFx0XHRpZiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5kZXBlbmRzT24pIHtcblx0XHRcdFx0Y29uc3QgbmV4dExpdmVEZXBlbmRlbmNpZXMgPSBuZXcgU2V0KGxpdmVEZXBlbmRlbmNpZXMpLmFkZCh0YXNrLmdldENvbW1vblRhc2tJZCgpKTtcblx0XHRcdFx0Zm9yIChjb25zdCBkZXBlbmRlbmN5IG9mIHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZGVwZW5kc09uKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGVwZW5kZW5jeVRhc2sgPSBhd2FpdCByZXNvbHZlci5yZXNvbHZlKGRlcGVuZGVuY3kudXJpLCBkZXBlbmRlbmN5LnRhc2spO1xuXHRcdFx0XHRcdGlmIChkZXBlbmRlbmN5VGFzaykge1xuXHRcdFx0XHRcdFx0dGhpcy5fYWRvcHRDb25maWd1cmF0aW9uRm9yRGVwZW5kZW5jeVRhc2soZGVwZW5kZW5jeVRhc2ssIHRhc2spO1xuXHRcdFx0XHRcdFx0bGV0IHRhc2tSZXN1bHQ7XG5cdFx0XHRcdFx0XHRjb25zdCBjb21tb25LZXkgPSBkZXBlbmRlbmN5VGFzay5nZXRDb21tb25UYXNrSWQoKTtcblx0XHRcdFx0XHRcdGlmIChuZXh0TGl2ZURlcGVuZGVuY2llcy5oYXMoY29tbW9uS2V5KSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zaG93RGVwZW5kZW5jeUN5Y2xlTWVzc2FnZShkZXBlbmRlbmN5VGFzayk7XG5cdFx0XHRcdFx0XHRcdHRhc2tSZXN1bHQgPSBQcm9taXNlLnJlc29sdmU8SVRhc2tTdW1tYXJ5Pih7fSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0YXNrUmVzdWx0ID0gZW5jb3VudGVyZWRUYXNrcy5nZXQoY29tbW9uS2V5KTtcblx0XHRcdFx0XHRcdFx0aWYgKCF0YXNrUmVzdWx0KSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgYWN0aXZlVGFzayA9IHRoaXMuX2FjdGl2ZVRhc2tzW2RlcGVuZGVuY3lUYXNrLmdldE1hcEtleSgpXSA/PyB0aGlzLl9nZXRJbnN0YW5jZXMoZGVwZW5kZW5jeVRhc2spLnBvcCgpO1xuXHRcdFx0XHRcdFx0XHRcdHRhc2tSZXN1bHQgPSBhY3RpdmVUYXNrICYmIHRoaXMuX2dldERlcGVuZGVuY3lQcm9taXNlKGFjdGl2ZVRhc2spO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIXRhc2tSZXN1bHQpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQuZ2VuZXJhbChUYXNrRXZlbnRLaW5kLkRlcGVuZHNPblN0YXJ0ZWQsIHRhc2spKTtcblx0XHRcdFx0XHRcdFx0dGFza1Jlc3VsdCA9IHRoaXMuX2V4ZWN1dGVEZXBlbmRlbmN5VGFzayhkZXBlbmRlbmN5VGFzaywgcmVzb2x2ZXIsIHRyaWdnZXIsIG5leHRMaXZlRGVwZW5kZW5jaWVzLCBlbmNvdW50ZXJlZFRhc2tzLCBhbHJlYWR5UmVzb2x2ZWQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZW5jb3VudGVyZWRUYXNrcy5zZXQoY29tbW9uS2V5LCB0YXNrUmVzdWx0KTtcblx0XHRcdFx0XHRcdHByb21pc2VzLnB1c2godGFza1Jlc3VsdCk7XG5cdFx0XHRcdFx0XHRpZiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5kZXBlbmRzT3JkZXIgPT09IERlcGVuZHNPcmRlci5zZXF1ZW5jZSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBwcm9taXNlUmVzdWx0ID0gYXdhaXQgdGFza1Jlc3VsdDtcblx0XHRcdFx0XHRcdFx0aWYgKHByb21pc2VSZXN1bHQuZXhpdENvZGUgIT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sb2cobmxzLmxvY2FsaXplKCdkZXBlbmRlbmN5RmFpbGVkJyxcblx0XHRcdFx0XHRcdFx0J0NvdWxkblxcJ3QgcmVzb2x2ZSBkZXBlbmRlbnQgdGFzayBcXCd7MH1cXCcgaW4gd29ya3NwYWNlIGZvbGRlciBcXCd7MX1cXCcnLFxuXHRcdFx0XHRcdFx0XHRUeXBlcy5pc1N0cmluZyhkZXBlbmRlbmN5LnRhc2spID8gZGVwZW5kZW5jeS50YXNrIDogSlNPTi5zdHJpbmdpZnkoZGVwZW5kZW5jeS50YXNrLCB1bmRlZmluZWQsIDApLFxuXHRcdFx0XHRcdFx0XHRkZXBlbmRlbmN5LnVyaS50b1N0cmluZygpXG5cdFx0XHRcdFx0XHQpKTtcblx0XHRcdFx0XHRcdHRoaXMuX3Nob3dPdXRwdXQoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKChzdW1tYXJpZXMpOiBQcm9taXNlPElUYXNrU3VtbWFyeT4gfCBJVGFza1N1bW1hcnkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHN1bW1hcnkgb2Ygc3VtbWFyaWVzKSB7XG5cdFx0XHRcdFx0aWYgKHN1bW1hcnkuZXhpdENvZGUgIT09IDApIHtcblx0XHRcdFx0XHRcdHJldHVybiB7IGV4aXRDb2RlOiBzdW1tYXJ5LmV4aXRDb2RlIH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICgoQ29udHJpYnV0ZWRUYXNrLmlzKHRhc2spIHx8IEN1c3RvbVRhc2suaXModGFzaykpICYmICh0YXNrLmNvbW1hbmQpKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2lzUmVydW4pIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLl9yZWV4ZWN1dGVDb21tYW5kKHRhc2ssIHRyaWdnZXIsIGFscmVhZHlSZXNvbHZlZCEpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fZXhlY3V0ZUNvbW1hbmQodGFzaywgdHJpZ2dlciwgYWxyZWFkeVJlc29sdmVkISk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7IGV4aXRDb2RlOiAwIH07XG5cdFx0XHR9KTtcblx0XHR9KS5maW5hbGx5KCgpID0+IHtcblx0XHRcdGRlbGV0ZSB0aGlzLl9hY3RpdmVUYXNrc1ttYXBLZXldO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGxhc3RJbnN0YW5jZSA9IHRoaXMuX2dldEluc3RhbmNlcyh0YXNrKS5wb3AoKTtcblx0XHRjb25zdCBjb3VudCA9IGxhc3RJbnN0YW5jZT8uY291bnQgPz8geyBjb3VudDogMCB9O1xuXHRcdGNvdW50LmNvdW50Kys7XG5cdFx0Y29uc3QgYWN0aXZlVGFzayA9IHsgdGFzaywgcHJvbWlzZSwgY291bnQgfTtcblx0XHR0aGlzLl9hY3RpdmVUYXNrc1ttYXBLZXldID0gYWN0aXZlVGFzaztcblx0XHRyZXR1cm4gcHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUluYWN0aXZlRGVwZW5kZW5jeVByb21pc2UodGFzazogVGFzayk6IFByb21pc2U8SVRhc2tTdW1tYXJ5PiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPElUYXNrU3VtbWFyeT4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRjb25zdCB0YXNrSW5hY3RpdmVEaXNwb3NhYmxlID0gdGhpcy5vbkRpZFN0YXRlQ2hhbmdlKHRhc2tFdmVudCA9PiB7XG5cdFx0XHRcdGlmICgodGFza0V2ZW50LmtpbmQgPT09IFRhc2tFdmVudEtpbmQuSW5hY3RpdmUpICYmICh0YXNrRXZlbnQuX190YXNrID09PSB0YXNrKSkge1xuXHRcdFx0XHRcdHRhc2tJbmFjdGl2ZURpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHJlc29sdmUoeyBleGl0Q29kZTogMCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9hZG9wdENvbmZpZ3VyYXRpb25Gb3JEZXBlbmRlbmN5VGFzayhkZXBlbmRlbmN5VGFzazogVGFzaywgdGFzazogVGFzayk6IHZvaWQge1xuXHRcdGlmIChkZXBlbmRlbmN5VGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pY29uKSB7XG5cdFx0XHRkZXBlbmRlbmN5VGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pY29uLmlkIHx8PSB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmljb24/LmlkO1xuXHRcdFx0ZGVwZW5kZW5jeVRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWNvbi5jb2xvciB8fD0gdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pY29uPy5jb2xvcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGVwZW5kZW5jeVRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWNvbiA9IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWNvbjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXREZXBlbmRlbmN5UHJvbWlzZSh0YXNrOiBJQWN0aXZlVGVybWluYWxEYXRhKTogUHJvbWlzZTxJVGFza1N1bW1hcnk+IHtcblx0XHRpZiAoIXRhc2sudGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pc0JhY2tncm91bmQpIHtcblx0XHRcdHJldHVybiB0YXNrLnByb21pc2U7XG5cdFx0fVxuXHRcdGlmICghdGFzay50YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyB8fCB0YXNrLnRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvYmxlbU1hdGNoZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHRhc2sucHJvbWlzZTtcblx0XHR9XG5cdFx0aWYgKHRhc2suc3RhdGUgPT09IFRhc2tFdmVudEtpbmQuSW5hY3RpdmUpIHtcblx0XHRcdHJldHVybiB7IGV4aXRDb2RlOiAwIH07XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVJbmFjdGl2ZURlcGVuZGVuY3lQcm9taXNlKHRhc2sudGFzayk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9leGVjdXRlRGVwZW5kZW5jeVRhc2sodGFzazogVGFzaywgcmVzb2x2ZXI6IElUYXNrUmVzb2x2ZXIsIHRyaWdnZXI6IHN0cmluZywgbGl2ZURlcGVuZGVuY2llczogU2V0PHN0cmluZz4sIGVuY291bnRlcmVkVGFza3M6IE1hcDxzdHJpbmcsIFByb21pc2U8SVRhc2tTdW1tYXJ5Pj4sIGFscmVhZHlSZXNvbHZlZD86IE1hcDxzdHJpbmcsIHN0cmluZz4pOiBQcm9taXNlPElUYXNrU3VtbWFyeT4ge1xuXHRcdC8vIElmIHRoZSB0YXNrIGlzIGEgYmFja2dyb3VuZCB0YXNrIHdpdGggYSB3YXRjaGluZyBwcm9ibGVtIG1hdGNoZXIsIHdlIGRvbid0IHdhaXQgZm9yIHRoZSB3aG9sZSB0YXNrIHRvIGZpbmlzaCxcblx0XHQvLyBqdXN0IGZvciB0aGUgcHJvYmxlbSBtYXRjaGVyIHRvIGdvIGluYWN0aXZlLlxuXHRcdGlmICghdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pc0JhY2tncm91bmQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9leGVjdXRlVGFzayh0YXNrLCByZXNvbHZlciwgdHJpZ2dlciwgbGl2ZURlcGVuZGVuY2llcywgZW5jb3VudGVyZWRUYXNrcywgYWxyZWFkeVJlc29sdmVkKTtcblx0XHR9XG5cblx0XHRjb25zdCBpbmFjdGl2ZVByb21pc2UgPSB0aGlzLl9jcmVhdGVJbmFjdGl2ZURlcGVuZGVuY3lQcm9taXNlKHRhc2spO1xuXHRcdHJldHVybiBQcm9taXNlLnJhY2UoW2luYWN0aXZlUHJvbWlzZSwgdGhpcy5fZXhlY3V0ZVRhc2sodGFzaywgcmVzb2x2ZXIsIHRyaWdnZXIsIGxpdmVEZXBlbmRlbmNpZXMsIGVuY291bnRlcmVkVGFza3MsIGFscmVhZHlSZXNvbHZlZCldKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVBbmRGaW5kRXhlY3V0YWJsZShzeXN0ZW1JbmZvOiBJVGFza1N5c3RlbUluZm8gfCB1bmRlZmluZWQsIHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCwgdGFzazogQ3VzdG9tVGFzayB8IENvbnRyaWJ1dGVkVGFzaywgY3dkOiBzdHJpbmcgfCB1bmRlZmluZWQsIGVudlBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgY29tbWFuZCA9IGF3YWl0IHRoaXMuX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZUZvbGRlciwgQ29tbWFuZFN0cmluZy52YWx1ZSh0YXNrLmNvbW1hbmQubmFtZSEpKTtcblx0XHRjd2QgPSBjd2QgPyBhd2FpdCB0aGlzLl9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVBc3luYyh3b3Jrc3BhY2VGb2xkZXIsIGN3ZCkgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgZGVsaW1pdGVyID0gKGF3YWl0IHRoaXMuX3BhdGhTZXJ2aWNlLnBhdGgpLmRlbGltaXRlcjtcblx0XHRjb25zdCBwYXRocyA9IGVudlBhdGggPyBhd2FpdCBQcm9taXNlLmFsbChlbnZQYXRoLnNwbGl0KGRlbGltaXRlcikubWFwKHAgPT4gdGhpcy5fY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZS5yZXNvbHZlQXN5bmMod29ya3NwYWNlRm9sZGVyLCBwKSkpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGZvdW5kRXhlY3V0YWJsZSA9IGF3YWl0IHN5c3RlbUluZm8/LmZpbmRFeGVjdXRhYmxlKGNvbW1hbmQsIGN3ZCwgcGF0aHMpO1xuXHRcdGlmIChmb3VuZEV4ZWN1dGFibGUpIHtcblx0XHRcdHJldHVybiBmb3VuZEV4ZWN1dGFibGU7XG5cdFx0fVxuXHRcdGlmIChwYXRoLmlzQWJzb2x1dGUoY29tbWFuZCkpIHtcblx0XHRcdHJldHVybiBjb21tYW5kO1xuXHRcdH1cblx0XHRyZXR1cm4gcGF0aC5qb2luKGN3ZCA/PyAnJywgY29tbWFuZCk7XG5cdH1cblxuXHRwcml2YXRlIF9maW5kVW5yZXNvbHZlZFZhcmlhYmxlcyh2YXJpYWJsZXM6IFNldDxzdHJpbmc+LCBhbHJlYWR5UmVzb2x2ZWQ6IE1hcDxzdHJpbmcsIHN0cmluZz4pOiBTZXQ8c3RyaW5nPiB7XG5cdFx0aWYgKGFscmVhZHlSZXNvbHZlZC5zaXplID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdmFyaWFibGVzO1xuXHRcdH1cblx0XHRjb25zdCB1bnJlc29sdmVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Zm9yIChjb25zdCB2YXJpYWJsZSBvZiB2YXJpYWJsZXMpIHtcblx0XHRcdGlmICghYWxyZWFkeVJlc29sdmVkLmhhcyh2YXJpYWJsZS5zdWJzdHJpbmcoMiwgdmFyaWFibGUubGVuZ3RoIC0gMSkpKSB7XG5cdFx0XHRcdHVucmVzb2x2ZWQuYWRkKHZhcmlhYmxlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVucmVzb2x2ZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9tZXJnZU1hcHMobWVyZ2VJbnRvOiBNYXA8c3RyaW5nLCBzdHJpbmc+LCBtZXJnZUZyb206IE1hcDxzdHJpbmcsIHN0cmluZz4pIHtcblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIG1lcmdlRnJvbSkge1xuXHRcdFx0aWYgKCFtZXJnZUludG8uaGFzKGVudHJ5WzBdKSkge1xuXHRcdFx0XHRtZXJnZUludG8uc2V0KGVudHJ5WzBdLCBlbnRyeVsxXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfYWNxdWlyZUlucHV0KHRhc2tTeXN0ZW1JbmZvOiBJVGFza1N5c3RlbUluZm8gfCB1bmRlZmluZWQsIHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCwgdGFzazogQ3VzdG9tVGFzayB8IENvbnRyaWJ1dGVkVGFzaywgdmFyaWFibGVzOiBTZXQ8c3RyaW5nPiwgYWxyZWFkeVJlc29sdmVkOiBNYXA8c3RyaW5nLCBzdHJpbmc+KTogUHJvbWlzZTxJUmVzb2x2ZWRWYXJpYWJsZXMgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCByZXNvbHZlZCA9IGF3YWl0IHRoaXMuX3Jlc29sdmVWYXJpYWJsZXNGcm9tU2V0KHRhc2tTeXN0ZW1JbmZvLCB3b3Jrc3BhY2VGb2xkZXIsIHRhc2ssIHZhcmlhYmxlcywgYWxyZWFkeVJlc29sdmVkKTtcblx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5nZW5lcmFsKFRhc2tFdmVudEtpbmQuQWNxdWlyZWRJbnB1dCwgdGFzaykpO1xuXHRcdHJldHVybiByZXNvbHZlZDtcblx0fVxuXG5cdHByaXZhdGUgX3Jlc29sdmVWYXJpYWJsZXNGcm9tU2V0KHRhc2tTeXN0ZW1JbmZvOiBJVGFza1N5c3RlbUluZm8gfCB1bmRlZmluZWQsIHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCwgdGFzazogQ3VzdG9tVGFzayB8IENvbnRyaWJ1dGVkVGFzaywgdmFyaWFibGVzOiBTZXQ8c3RyaW5nPiwgYWxyZWFkeVJlc29sdmVkOiBNYXA8c3RyaW5nLCBzdHJpbmc+KTogUHJvbWlzZTxJUmVzb2x2ZWRWYXJpYWJsZXMgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBpc1Byb2Nlc3MgPSB0YXNrLmNvbW1hbmQgJiYgdGFzay5jb21tYW5kLnJ1bnRpbWUgPT09IFJ1bnRpbWVUeXBlLlByb2Nlc3M7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRhc2suY29tbWFuZCAmJiB0YXNrLmNvbW1hbmQub3B0aW9ucyA/IHRhc2suY29tbWFuZC5vcHRpb25zIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGN3ZCA9IG9wdGlvbnMgPyBvcHRpb25zLmN3ZCA6IHVuZGVmaW5lZDtcblx0XHRsZXQgZW52UGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmIChvcHRpb25zICYmIG9wdGlvbnMuZW52KSB7XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvcHRpb25zLmVudikpIHtcblx0XHRcdFx0aWYgKGtleS50b0xvd2VyQ2FzZSgpID09PSAncGF0aCcpIHtcblx0XHRcdFx0XHRpZiAoVHlwZXMuaXNTdHJpbmcob3B0aW9ucy5lbnZba2V5XSkpIHtcblx0XHRcdFx0XHRcdGVudlBhdGggPSBvcHRpb25zLmVudltrZXldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCB1bnJlc29sdmVkID0gdGhpcy5fZmluZFVucmVzb2x2ZWRWYXJpYWJsZXModmFyaWFibGVzLCBhbHJlYWR5UmVzb2x2ZWQpO1xuXHRcdGxldCByZXNvbHZlZFZhcmlhYmxlczogUHJvbWlzZTxJUmVzb2x2ZWRWYXJpYWJsZXMgfCB1bmRlZmluZWQ+O1xuXHRcdGlmICh0YXNrU3lzdGVtSW5mbyAmJiB3b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdGNvbnN0IHJlc29sdmVTZXQ6IElSZXNvbHZlU2V0ID0ge1xuXHRcdFx0XHR2YXJpYWJsZXM6IHVucmVzb2x2ZWRcblx0XHRcdH07XG5cblx0XHRcdGlmICh0YXNrU3lzdGVtSW5mby5wbGF0Zm9ybSA9PT0gUGxhdGZvcm0uUGxhdGZvcm0uV2luZG93cyAmJiBpc1Byb2Nlc3MpIHtcblx0XHRcdFx0cmVzb2x2ZVNldC5wcm9jZXNzID0geyBuYW1lOiBDb21tYW5kU3RyaW5nLnZhbHVlKHRhc2suY29tbWFuZC5uYW1lISkgfTtcblx0XHRcdFx0aWYgKGN3ZCkge1xuXHRcdFx0XHRcdHJlc29sdmVTZXQucHJvY2Vzcy5jd2QgPSBjd2Q7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGVudlBhdGgpIHtcblx0XHRcdFx0XHRyZXNvbHZlU2V0LnByb2Nlc3MucGF0aCA9IGVudlBhdGg7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJlc29sdmVkVmFyaWFibGVzID0gdGFza1N5c3RlbUluZm8ucmVzb2x2ZVZhcmlhYmxlcyh3b3Jrc3BhY2VGb2xkZXIsIHJlc29sdmVTZXQsIFRhc2tTb3VyY2VLaW5kLnRvQ29uZmlndXJhdGlvblRhcmdldCh0YXNrLl9zb3VyY2Uua2luZCkpLnRoZW4oYXN5bmMgKHJlc29sdmVkKSA9PiB7XG5cdFx0XHRcdGlmICghcmVzb2x2ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5fbWVyZ2VNYXBzKGFscmVhZHlSZXNvbHZlZCwgcmVzb2x2ZWQudmFyaWFibGVzKTtcblx0XHRcdFx0cmVzb2x2ZWQudmFyaWFibGVzID0gbmV3IE1hcChhbHJlYWR5UmVzb2x2ZWQpO1xuXHRcdFx0XHRpZiAoaXNQcm9jZXNzKSB7XG5cdFx0XHRcdFx0bGV0IHByb2Nlc3MgPSBDb21tYW5kU3RyaW5nLnZhbHVlKHRhc2suY29tbWFuZC5uYW1lISk7XG5cdFx0XHRcdFx0aWYgKHRhc2tTeXN0ZW1JbmZvLnBsYXRmb3JtID09PSBQbGF0Zm9ybS5QbGF0Zm9ybS5XaW5kb3dzKSB7XG5cdFx0XHRcdFx0XHRwcm9jZXNzID0gYXdhaXQgdGhpcy5fcmVzb2x2ZUFuZEZpbmRFeGVjdXRhYmxlKHRhc2tTeXN0ZW1JbmZvLCB3b3Jrc3BhY2VGb2xkZXIsIHRhc2ssIGN3ZCwgZW52UGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJlc29sdmVkLnZhcmlhYmxlcy5zZXQoVGVybWluYWxUYXNrU3lzdGVtLlByb2Nlc3NWYXJOYW1lLCBwcm9jZXNzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZWQ7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiByZXNvbHZlZFZhcmlhYmxlcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdmFyaWFibGVzQXJyYXkgPSBuZXcgQXJyYXk8c3RyaW5nPigpO1xuXHRcdFx0dW5yZXNvbHZlZC5mb3JFYWNoKHZhcmlhYmxlID0+IHZhcmlhYmxlc0FycmF5LnB1c2godmFyaWFibGUpKTtcblxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPElSZXNvbHZlZFZhcmlhYmxlcyB8IHVuZGVmaW5lZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVXaXRoSW50ZXJhY3Rpb24od29ya3NwYWNlRm9sZGVyLCB2YXJpYWJsZXNBcnJheSwgJ3Rhc2tzJywgdW5kZWZpbmVkLCBUYXNrU291cmNlS2luZC50b0NvbmZpZ3VyYXRpb25UYXJnZXQodGFzay5fc291cmNlLmtpbmQpKS50aGVuKGFzeW5jIChyZXNvbHZlZFZhcmlhYmxlc01hcDogTWFwPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0XHRcdGlmIChyZXNvbHZlZFZhcmlhYmxlc01hcCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fbWVyZ2VNYXBzKGFscmVhZHlSZXNvbHZlZCwgcmVzb2x2ZWRWYXJpYWJsZXNNYXApO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZWRWYXJpYWJsZXNNYXAgPSBuZXcgTWFwKGFscmVhZHlSZXNvbHZlZCk7XG5cdFx0XHRcdFx0XHRpZiAoaXNQcm9jZXNzKSB7XG5cdFx0XHRcdFx0XHRcdGxldCBwcm9jZXNzVmFyVmFsdWU6IHN0cmluZztcblx0XHRcdFx0XHRcdFx0aWYgKFBsYXRmb3JtLmlzV2luZG93cykge1xuXHRcdFx0XHRcdFx0XHRcdHByb2Nlc3NWYXJWYWx1ZSA9IGF3YWl0IHRoaXMuX3Jlc29sdmVBbmRGaW5kRXhlY3V0YWJsZSh0YXNrU3lzdGVtSW5mbywgd29ya3NwYWNlRm9sZGVyLCB0YXNrLCBjd2QsIGVudlBhdGgpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHByb2Nlc3NWYXJWYWx1ZSA9IGF3YWl0IHRoaXMuX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UucmVzb2x2ZUFzeW5jKHdvcmtzcGFjZUZvbGRlciwgQ29tbWFuZFN0cmluZy52YWx1ZSh0YXNrLmNvbW1hbmQubmFtZSEpKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXNvbHZlZFZhcmlhYmxlc01hcC5zZXQoVGVybWluYWxUYXNrU3lzdGVtLlByb2Nlc3NWYXJOYW1lLCBwcm9jZXNzVmFyVmFsdWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRWYXJpYWJsZXNSZXN1bHQ6IElSZXNvbHZlZFZhcmlhYmxlcyA9IHtcblx0XHRcdFx0XHRcdFx0dmFyaWFibGVzOiByZXNvbHZlZFZhcmlhYmxlc01hcCxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRyZXNvbHZlKHJlc29sdmVkVmFyaWFibGVzUmVzdWx0KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgcmVhc29uID0+IHtcblx0XHRcdFx0XHRyZWplY3QocmVhc29uKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9leGVjdXRlQ29tbWFuZCh0YXNrOiBDdXN0b21UYXNrIHwgQ29udHJpYnV0ZWRUYXNrLCB0cmlnZ2VyOiBzdHJpbmcsIGFscmVhZHlSZXNvbHZlZDogTWFwPHN0cmluZywgc3RyaW5nPik6IFByb21pc2U8SVRhc2tTdW1tYXJ5PiB7XG5cdFx0Y29uc3QgdGFza1dvcmtzcGFjZUZvbGRlciA9IHRhc2suZ2V0V29ya3NwYWNlRm9sZGVyKCk7XG5cdFx0bGV0IHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGFza1dvcmtzcGFjZUZvbGRlcikge1xuXHRcdFx0d29ya3NwYWNlRm9sZGVyID0gdGhpcy5fY3VycmVudFRhc2sud29ya3NwYWNlRm9sZGVyID0gdGFza1dvcmtzcGFjZUZvbGRlcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZm9sZGVycyA9IHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnM7XG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXIgPSBmb2xkZXJzLmxlbmd0aCA+IDAgPyBmb2xkZXJzWzBdIDogdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBzeXN0ZW1JbmZvOiBJVGFza1N5c3RlbUluZm8gfCB1bmRlZmluZWQgPSB0aGlzLl9jdXJyZW50VGFzay5zeXN0ZW1JbmZvID0gdGhpcy5fdGFza1N5c3RlbUluZm9SZXNvbHZlcih3b3Jrc3BhY2VGb2xkZXIpO1xuXG5cdFx0Y29uc3QgdmFyaWFibGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0dGhpcy5fY29sbGVjdFRhc2tWYXJpYWJsZXModmFyaWFibGVzLCB0YXNrKTtcblx0XHRjb25zdCByZXNvbHZlZFZhcmlhYmxlcyA9IHRoaXMuX2FjcXVpcmVJbnB1dChzeXN0ZW1JbmZvLCB3b3Jrc3BhY2VGb2xkZXIsIHRhc2ssIHZhcmlhYmxlcywgYWxyZWFkeVJlc29sdmVkKTtcblxuXHRcdHJldHVybiByZXNvbHZlZFZhcmlhYmxlcy50aGVuKChyZXNvbHZlZFZhcmlhYmxlcykgPT4ge1xuXHRcdFx0aWYgKHJlc29sdmVkVmFyaWFibGVzICYmICF0aGlzLl9pc1Rhc2tFbXB0eSh0YXNrKSkge1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50VGFzay5yZXNvbHZlZFZhcmlhYmxlcyA9IHJlc29sdmVkVmFyaWFibGVzO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fZXhlY3V0ZUluVGVybWluYWwodGFzaywgdHJpZ2dlciwgbmV3IFZhcmlhYmxlUmVzb2x2ZXIod29ya3NwYWNlRm9sZGVyLCBzeXN0ZW1JbmZvLCByZXNvbHZlZFZhcmlhYmxlcy52YXJpYWJsZXMsIHRoaXMuX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UpLCB3b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gQWxsb3dzIHRoZSB0YXNrRXhlY3V0aW9ucyBhcnJheSB0byBiZSB1cGRhdGVkIGluIHRoZSBleHRlbnNpb24gaG9zdFxuXHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5nZW5lcmFsKFRhc2tFdmVudEtpbmQuRW5kLCB0YXNrKSk7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoeyBleGl0Q29kZTogMCB9KTtcblx0XHRcdH1cblx0XHR9LCByZWFzb24gPT4ge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KHJlYXNvbik7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9pc1Rhc2tFbXB0eSh0YXNrOiBDdXN0b21UYXNrIHwgQ29udHJpYnV0ZWRUYXNrKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgaXNDdXN0b21FeGVjdXRpb24gPSAodGFzay5jb21tYW5kLnJ1bnRpbWUgPT09IFJ1bnRpbWVUeXBlLkN1c3RvbUV4ZWN1dGlvbik7XG5cdFx0cmV0dXJuICEoKHRhc2suY29tbWFuZCAhPT0gdW5kZWZpbmVkKSAmJiB0YXNrLmNvbW1hbmQucnVudGltZSAmJiAoaXNDdXN0b21FeGVjdXRpb24gfHwgKHRhc2suY29tbWFuZC5uYW1lICE9PSB1bmRlZmluZWQpKSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWV4ZWN1dGVDb21tYW5kKHRhc2s6IEN1c3RvbVRhc2sgfCBDb250cmlidXRlZFRhc2ssIHRyaWdnZXI6IHN0cmluZywgYWxyZWFkeVJlc29sdmVkOiBNYXA8c3RyaW5nLCBzdHJpbmc+KTogUHJvbWlzZTxJVGFza1N1bW1hcnk+IHtcblx0XHRjb25zdCBsYXN0VGFzayA9IHRoaXMuX2xhc3RUYXNrO1xuXHRcdGlmICghbGFzdFRhc2spIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ05vIHRhc2sgcHJldmlvdXNseSBydW4nKSk7XG5cdFx0fVxuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHRoaXMuX2N1cnJlbnRUYXNrLndvcmtzcGFjZUZvbGRlciA9IGxhc3RUYXNrLndvcmtzcGFjZUZvbGRlcjtcblx0XHRjb25zdCB2YXJpYWJsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHR0aGlzLl9jb2xsZWN0VGFza1ZhcmlhYmxlcyh2YXJpYWJsZXMsIHRhc2spO1xuXG5cdFx0Ly8gQ2hlY2sgdGhhdCB0aGUgdGFzayBoYXNuJ3QgY2hhbmdlZCB0byBpbmNsdWRlIG5ldyB2YXJpYWJsZXNcblx0XHRsZXQgaGFzQWxsVmFyaWFibGVzID0gdHJ1ZTtcblx0XHR2YXJpYWJsZXMuZm9yRWFjaCh2YWx1ZSA9PiB7XG5cdFx0XHRpZiAodmFsdWUuc3Vic3RyaW5nKDIsIHZhbHVlLmxlbmd0aCAtIDEpIGluIGxhc3RUYXNrLmdldFZlcmlmaWVkVGFzaygpLnJlc29sdmVkVmFyaWFibGVzKSB7XG5cdFx0XHRcdGhhc0FsbFZhcmlhYmxlcyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKCFoYXNBbGxWYXJpYWJsZXMpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hY3F1aXJlSW5wdXQobGFzdFRhc2suZ2V0VmVyaWZpZWRUYXNrKCkuc3lzdGVtSW5mbywgbGFzdFRhc2suZ2V0VmVyaWZpZWRUYXNrKCkud29ya3NwYWNlRm9sZGVyLCB0YXNrLCB2YXJpYWJsZXMsIGFscmVhZHlSZXNvbHZlZCkudGhlbigocmVzb2x2ZWRWYXJpYWJsZXMpID0+IHtcblx0XHRcdFx0aWYgKCFyZXNvbHZlZFZhcmlhYmxlcykge1xuXHRcdFx0XHRcdC8vIEFsbG93cyB0aGUgdGFza0V4ZWN1dGlvbnMgYXJyYXkgdG8gYmUgdXBkYXRlZCBpbiB0aGUgZXh0ZW5zaW9uIGhvc3Rcblx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5nZW5lcmFsKFRhc2tFdmVudEtpbmQuRW5kLCB0YXNrKSk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgZXhpdENvZGU6IDAgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9jdXJyZW50VGFzay5yZXNvbHZlZFZhcmlhYmxlcyA9IHJlc29sdmVkVmFyaWFibGVzO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fZXhlY3V0ZUluVGVybWluYWwodGFzaywgdHJpZ2dlciwgbmV3IFZhcmlhYmxlUmVzb2x2ZXIobGFzdFRhc2suZ2V0VmVyaWZpZWRUYXNrKCkud29ya3NwYWNlRm9sZGVyLCBsYXN0VGFzay5nZXRWZXJpZmllZFRhc2soKS5zeXN0ZW1JbmZvLCByZXNvbHZlZFZhcmlhYmxlcy52YXJpYWJsZXMsIHRoaXMuX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UpLCB3b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdFx0fSwgcmVhc29uID0+IHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KHJlYXNvbik7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY3VycmVudFRhc2sucmVzb2x2ZWRWYXJpYWJsZXMgPSBsYXN0VGFzay5nZXRWZXJpZmllZFRhc2soKS5yZXNvbHZlZFZhcmlhYmxlcztcblx0XHRcdHJldHVybiB0aGlzLl9leGVjdXRlSW5UZXJtaW5hbCh0YXNrLCB0cmlnZ2VyLCBuZXcgVmFyaWFibGVSZXNvbHZlcihsYXN0VGFzay5nZXRWZXJpZmllZFRhc2soKS53b3Jrc3BhY2VGb2xkZXIsIGxhc3RUYXNrLmdldFZlcmlmaWVkVGFzaygpLnN5c3RlbUluZm8sIGxhc3RUYXNrLmdldFZlcmlmaWVkVGFzaygpLnJlc29sdmVkVmFyaWFibGVzLnZhcmlhYmxlcywgdGhpcy5fY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSksIHdvcmtzcGFjZUZvbGRlcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZXhlY3V0ZUluVGVybWluYWwodGFzazogQ3VzdG9tVGFzayB8IENvbnRyaWJ1dGVkVGFzaywgdHJpZ2dlcjogc3RyaW5nLCByZXNvbHZlcjogVmFyaWFibGVSZXNvbHZlciwgd29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJVGFza1N1bW1hcnk+IHtcblx0XHRsZXQgdGVybWluYWw6IElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBlcnJvcjogVGFza0Vycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBwcm9taXNlOiBQcm9taXNlPElUYXNrU3VtbWFyeT4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kKSB7XG5cdFx0XHRjb25zdCBwcm9ibGVtTWF0Y2hlcnMgPSBhd2FpdCB0aGlzLl9yZXNvbHZlTWF0Y2hlcnMocmVzb2x2ZXIsIHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvYmxlbU1hdGNoZXJzKTtcblx0XHRcdGNvbnN0IHdhdGNoaW5nUHJvYmxlbU1hdGNoZXIgPSBuZXcgV2F0Y2hpbmdQcm9ibGVtQ29sbGVjdG9yKHByb2JsZW1NYXRjaGVycywgdGhpcy5fbWFya2VyU2VydmljZSwgdGhpcy5fbW9kZWxTZXJ2aWNlLCB0aGlzLl9maWxlU2VydmljZSk7XG5cdFx0XHRpZiAoKHByb2JsZW1NYXRjaGVycy5sZW5ndGggPiAwKSAmJiAhd2F0Y2hpbmdQcm9ibGVtTWF0Y2hlci5pc1dhdGNoaW5nKCkpIHtcblx0XHRcdFx0dGhpcy5fYXBwZW5kT3V0cHV0KG5scy5sb2NhbGl6ZSgnVGVybWluYWxUYXNrU3lzdGVtLm5vbldhdGNoaW5nTWF0Y2hlcicsICdUYXNrIHswfSBpcyBhIGJhY2tncm91bmQgdGFzayBidXQgdXNlcyBhIHByb2JsZW0gbWF0Y2hlciB3aXRob3V0IGEgYmFja2dyb3VuZCBwYXR0ZXJuJywgdGFzay5fbGFiZWwpKTtcblx0XHRcdFx0dGhpcy5fc2hvd091dHB1dCgpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdG9EaXNwb3NlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0bGV0IGV2ZW50Q291bnRlcjogbnVtYmVyID0gMDtcblx0XHRcdGNvbnN0IG1hcEtleSA9IHRhc2suZ2V0TWFwS2V5KCk7XG5cdFx0XHR0b0Rpc3Bvc2UuYWRkKHdhdGNoaW5nUHJvYmxlbU1hdGNoZXIub25EaWRTdGF0ZUNoYW5nZSgoZXZlbnQpID0+IHtcblx0XHRcdFx0aWYgKGV2ZW50LmtpbmQgPT09IFByb2JsZW1Db2xsZWN0b3JFdmVudEtpbmQuQmFja2dyb3VuZFByb2Nlc3NpbmdCZWdpbnMpIHtcblx0XHRcdFx0XHRldmVudENvdW50ZXIrKztcblx0XHRcdFx0XHR0aGlzLl9idXN5VGFza3NbbWFwS2V5XSA9IHRhc2s7XG5cdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQuZ2VuZXJhbChUYXNrRXZlbnRLaW5kLkFjdGl2ZSwgdGFzaywgdGVybWluYWw/Lmluc3RhbmNlSWQpKTtcblx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5nZW5lcmFsKFRhc2tFdmVudEtpbmQuUHJvYmxlbU1hdGNoZXJTdGFydGVkLCB0YXNrLCB0ZXJtaW5hbD8uaW5zdGFuY2VJZCkpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmtpbmQgPT09IFByb2JsZW1Db2xsZWN0b3JFdmVudEtpbmQuQmFja2dyb3VuZFByb2Nlc3NpbmdFbmRzKSB7XG5cdFx0XHRcdFx0ZXZlbnRDb3VudGVyLS07XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2J1c3lUYXNrc1ttYXBLZXldKSB7XG5cdFx0XHRcdFx0XHRkZWxldGUgdGhpcy5fYnVzeVRhc2tzW21hcEtleV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuX2ZpcmVUYXNrRXZlbnQoVGFza0V2ZW50LmdlbmVyYWwoVGFza0V2ZW50S2luZC5JbmFjdGl2ZSwgdGFzaywgdGVybWluYWw/Lmluc3RhbmNlSWQpKTtcblx0XHRcdFx0XHRpZiAoZXZlbnRDb3VudGVyID09PSAwKSB7XG5cdFx0XHRcdFx0XHRpZiAoKHdhdGNoaW5nUHJvYmxlbU1hdGNoZXIubnVtYmVyT2ZNYXRjaGVzID4gMCkgJiYgd2F0Y2hpbmdQcm9ibGVtTWF0Y2hlci5tYXhNYXJrZXJTZXZlcml0eSAmJlxuXHRcdFx0XHRcdFx0XHQod2F0Y2hpbmdQcm9ibGVtTWF0Y2hlci5tYXhNYXJrZXJTZXZlcml0eSA+PSBNYXJrZXJTZXZlcml0eS5FcnJvcikpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQuZ2VuZXJhbChUYXNrRXZlbnRLaW5kLlByb2JsZW1NYXRjaGVyRm91bmRFcnJvcnMsIHRhc2ssIHRlcm1pbmFsPy5pbnN0YW5jZUlkKSk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHJldmVhbCA9IHRhc2suY29tbWFuZC5wcmVzZW50YXRpb24hLnJldmVhbDtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcmV2ZWFsUHJvYmxlbXMgPSB0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uIS5yZXZlYWxQcm9ibGVtcztcblx0XHRcdFx0XHRcdFx0aWYgKHJldmVhbFByb2JsZW1zID09PSBSZXZlYWxQcm9ibGVtS2luZC5PblByb2JsZW0pIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLl92aWV3c1NlcnZpY2Uub3BlblZpZXcoTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQsIHRydWUpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHJldmVhbCA9PT0gUmV2ZWFsS2luZC5TaWxlbnQpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UodGVybWluYWwhKTtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5zaG93UGFuZWwoZmFsc2UpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5nZW5lcmFsKFRhc2tFdmVudEtpbmQuUHJvYmxlbU1hdGNoZXJFbmRlZCwgdGFzaywgdGVybWluYWw/Lmluc3RhbmNlSWQpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdHdhdGNoaW5nUHJvYmxlbU1hdGNoZXIuYWJvdXRUb1N0YXJ0KCk7XG5cdFx0XHRsZXQgZGVsYXllcjogQXN5bmMuRGVsYXllcjxhbnk+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0W3Rlcm1pbmFsLCBlcnJvcl0gPSBhd2FpdCB0aGlzLl9jcmVhdGVUZXJtaW5hbCh0YXNrLCByZXNvbHZlciwgd29ya3NwYWNlRm9sZGVyKTtcblxuXHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoKDxUYXNrRXJyb3I+ZXJyb3IpLm1lc3NhZ2UpKTtcblx0XHRcdH1cblx0XHRcdGlmICghdGVybWluYWwpIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSB0ZXJtaW5hbCBmb3IgdGFzayAke3Rhc2suX2xhYmVsfWApKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3Rlcm1pbmFsU3RhdHVzTWFuYWdlci5hZGRUZXJtaW5hbCh0YXNrLCB0ZXJtaW5hbCwgd2F0Y2hpbmdQcm9ibGVtTWF0Y2hlcik7XG5cblx0XHRcdGxldCBwcm9jZXNzU3RhcnRlZFNpZ25hbGVkID0gZmFsc2U7XG5cdFx0XHR0ZXJtaW5hbC5wcm9jZXNzUmVhZHkudGhlbigoKSA9PiB7XG5cdFx0XHRcdGlmICghcHJvY2Vzc1N0YXJ0ZWRTaWduYWxlZCkge1xuXHRcdFx0XHRcdHRoaXMuX2ZpcmVUYXNrRXZlbnQoVGFza0V2ZW50LnByb2Nlc3NTdGFydGVkKHRhc2ssIHRlcm1pbmFsIS5pbnN0YW5jZUlkLCB0ZXJtaW5hbCEucHJvY2Vzc0lkISkpO1xuXHRcdFx0XHRcdHByb2Nlc3NTdGFydGVkU2lnbmFsZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCAoX2Vycm9yKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoJ1Rhc2sgdGVybWluYWwgcHJvY2VzcyBuZXZlciBnb3QgcmVhZHknKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQuc3RhcnQodGFzaywgdGVybWluYWwuaW5zdGFuY2VJZCwgcmVzb2x2ZXIudmFsdWVzKSk7XG5cdFx0XHRsZXQgb25EYXRhOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChwcm9ibGVtTWF0Y2hlcnMubGVuZ3RoKSB7XG5cdFx0XHRcdC8vIHByZXZlbnQgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE3NDUxMSBmcm9tIGhhcHBlbmluZ1xuXHRcdFx0XHRvbkRhdGEgPSB0ZXJtaW5hbC5vbkxpbmVEYXRhKChsaW5lKSA9PiB7XG5cdFx0XHRcdFx0d2F0Y2hpbmdQcm9ibGVtTWF0Y2hlci5wcm9jZXNzTGluZShsaW5lKTtcblx0XHRcdFx0XHRpZiAoIWRlbGF5ZXIpIHtcblx0XHRcdFx0XHRcdGRlbGF5ZXIgPSBuZXcgQXN5bmMuRGVsYXllcigzMDAwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZGVsYXllci50cmlnZ2VyKCgpID0+IHtcblx0XHRcdFx0XHRcdHdhdGNoaW5nUHJvYmxlbU1hdGNoZXIuZm9yY2VEZWxpdmVyeSgpO1xuXHRcdFx0XHRcdFx0ZGVsYXllciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdHByb21pc2UgPSBuZXcgUHJvbWlzZTxJVGFza1N1bW1hcnk+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0Y29uc3Qgb25FeGl0ID0gdGVybWluYWwhLm9uRXhpdCgodGVybWluYWxMYXVuY2hSZXN1bHQpID0+IHtcblx0XHRcdFx0XHRjb25zdCBleGl0Q29kZSA9IHR5cGVvZiB0ZXJtaW5hbExhdW5jaFJlc3VsdCA9PT0gJ251bWJlcicgPyB0ZXJtaW5hbExhdW5jaFJlc3VsdCA6IHRlcm1pbmFsTGF1bmNoUmVzdWx0Py5jb2RlO1xuXHRcdFx0XHRcdG9uRGF0YT8uZGlzcG9zZSgpO1xuXHRcdFx0XHRcdG9uRXhpdC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0Y29uc3Qga2V5ID0gdGFzay5nZXRNYXBLZXkoKTtcblx0XHRcdFx0XHRpZiAodGhpcy5fYnVzeVRhc2tzW21hcEtleV0pIHtcblx0XHRcdFx0XHRcdGRlbGV0ZSB0aGlzLl9idXN5VGFza3NbbWFwS2V5XTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5fcmVtb3ZlRnJvbUFjdGl2ZVRhc2tzKHRhc2spO1xuXHRcdFx0XHRcdHRoaXMuX2ZpcmVUYXNrRXZlbnQoVGFza0V2ZW50LmNoYW5nZWQoKSk7XG5cdFx0XHRcdFx0aWYgKHRlcm1pbmFsTGF1bmNoUmVzdWx0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdC8vIE9ubHkga2VlcCBhIHJlZmVyZW5jZSB0byB0aGUgdGVybWluYWwgaWYgaXQgaXMgbm90IGJlaW5nIGRpc3Bvc2VkLlxuXHRcdFx0XHRcdFx0c3dpdGNoICh0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uIS5wYW5lbCkge1xuXHRcdFx0XHRcdFx0XHRjYXNlIFBhbmVsS2luZC5EZWRpY2F0ZWQ6XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fc2FtZVRhc2tUZXJtaW5hbHNba2V5XSA9IHRlcm1pbmFsIS5pbnN0YW5jZUlkLnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdGNhc2UgUGFuZWxLaW5kLlNoYXJlZDpcblx0XHRcdFx0XHRcdFx0XHR0aGlzLl9pZGxlVGFza1Rlcm1pbmFscy5zZXQoa2V5LCB0ZXJtaW5hbCEuaW5zdGFuY2VJZC50b1N0cmluZygpLCBUb3VjaC5Bc09sZCk7XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHJldmVhbCA9IHRhc2suY29tbWFuZC5wcmVzZW50YXRpb24hLnJldmVhbDtcblx0XHRcdFx0XHRpZiAoKHJldmVhbCA9PT0gUmV2ZWFsS2luZC5TaWxlbnQpICYmICgoZXhpdENvZGUgIT09IDApIHx8ICh3YXRjaGluZ1Byb2JsZW1NYXRjaGVyLm51bWJlck9mTWF0Y2hlcyA+IDApICYmIHdhdGNoaW5nUHJvYmxlbU1hdGNoZXIubWF4TWFya2VyU2V2ZXJpdHkgJiZcblx0XHRcdFx0XHRcdCh3YXRjaGluZ1Byb2JsZW1NYXRjaGVyLm1heE1hcmtlclNldmVyaXR5ID49IE1hcmtlclNldmVyaXR5LkVycm9yKSkpIHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZS5zZXRBY3RpdmVJbnN0YW5jZSh0ZXJtaW5hbCEpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5zaG93UGFuZWwoZmFsc2UpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0XHQvLyBJZiB0aGUgdGVybWluYWwgaGFzIGFscmVhZHkgYmVlbiBkaXNwb3NlZCwgdGhlbiBzZXR0aW5nIHRoZSBhY3RpdmUgaW5zdGFuY2Ugd2lsbCBmYWlsLiAjOTk4Mjhcblx0XHRcdFx0XHRcdFx0Ly8gVGhlcmUgaXMgbm90aGluZyBlbHNlIHRvIGRvIGhlcmUuXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHdhdGNoaW5nUHJvYmxlbU1hdGNoZXIuZG9uZSgpO1xuXHRcdFx0XHRcdHdhdGNoaW5nUHJvYmxlbU1hdGNoZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdGlmICghcHJvY2Vzc1N0YXJ0ZWRTaWduYWxlZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQucHJvY2Vzc1N0YXJ0ZWQodGFzaywgdGVybWluYWwhLmluc3RhbmNlSWQsIHRlcm1pbmFsIS5wcm9jZXNzSWQhKSk7XG5cdFx0XHRcdFx0XHRwcm9jZXNzU3RhcnRlZFNpZ25hbGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQucHJvY2Vzc0VuZGVkKHRhc2ssIHRlcm1pbmFsIS5pbnN0YW5jZUlkLCBleGl0Q29kZSkpO1xuXG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBldmVudENvdW50ZXI7IGkrKykge1xuXHRcdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQuZ2VuZXJhbChUYXNrRXZlbnRLaW5kLkluYWN0aXZlLCB0YXNrLCB0ZXJtaW5hbCEuaW5zdGFuY2VJZCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRldmVudENvdW50ZXIgPSAwO1xuXHRcdFx0XHRcdHRoaXMuX2ZpcmVUYXNrRXZlbnQoVGFza0V2ZW50LmdlbmVyYWwoVGFza0V2ZW50S2luZC5FbmQsIHRhc2spKTtcblx0XHRcdFx0XHR0b0Rpc3Bvc2UuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHJlc29sdmUoeyBleGl0Q29kZTogZXhpdENvZGUgPz8gdW5kZWZpbmVkIH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0aWYgKHRyaWdnZXIgPT09IFRyaWdnZXJzLnJlY29ubmVjdCAmJiAhIXRlcm1pbmFsLnh0ZXJtKSB7XG5cdFx0XHRcdGNvbnN0IGJ1ZmZlckxpbmVzID0gW107XG5cdFx0XHRcdGNvbnN0IGJ1ZmZlclJldmVyc2VJdGVyYXRvciA9IHRlcm1pbmFsLnh0ZXJtLmdldEJ1ZmZlclJldmVyc2VJdGVyYXRvcigpO1xuXHRcdFx0XHRjb25zdCBzdGFydFJlZ2V4ID0gbmV3IFJlZ0V4cCh3YXRjaGluZ1Byb2JsZW1NYXRjaGVyLmJlZ2luUGF0dGVybnMubWFwKHBhdHRlcm4gPT4gcGF0dGVybi5zb3VyY2UpLmpvaW4oJ3wnKSk7XG5cdFx0XHRcdGZvciAoY29uc3QgbmV4dExpbmUgb2YgYnVmZmVyUmV2ZXJzZUl0ZXJhdG9yKSB7XG5cdFx0XHRcdFx0YnVmZmVyTGluZXMucHVzaChuZXh0TGluZSk7XG5cdFx0XHRcdFx0aWYgKHN0YXJ0UmVnZXgudGVzdChuZXh0TGluZSkpIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRsZXQgZGVsYXllcjogQXN5bmMuRGVsYXllcjxhbnk+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gYnVmZmVyTGluZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHR3YXRjaGluZ1Byb2JsZW1NYXRjaGVyLnByb2Nlc3NMaW5lKGJ1ZmZlckxpbmVzW2ldKTtcblx0XHRcdFx0XHRpZiAoIWRlbGF5ZXIpIHtcblx0XHRcdFx0XHRcdGRlbGF5ZXIgPSBuZXcgQXN5bmMuRGVsYXllcigzMDAwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZGVsYXllci50cmlnZ2VyKCgpID0+IHtcblx0XHRcdFx0XHRcdHdhdGNoaW5nUHJvYmxlbU1hdGNoZXIuZm9yY2VEZWxpdmVyeSgpO1xuXHRcdFx0XHRcdFx0ZGVsYXllciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRbdGVybWluYWwsIGVycm9yXSA9IGF3YWl0IHRoaXMuX2NyZWF0ZVRlcm1pbmFsKHRhc2ssIHJlc29sdmVyLCB3b3Jrc3BhY2VGb2xkZXIpO1xuXG5cdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcigoPFRhc2tFcnJvcj5lcnJvcikubWVzc2FnZSkpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0ZXJtaW5hbCkge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIHRlcm1pbmFsIGZvciB0YXNrICR7dGFzay5fbGFiZWx9YCkpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5zdGFydCh0YXNrLCB0ZXJtaW5hbC5pbnN0YW5jZUlkLCByZXNvbHZlci52YWx1ZXMpKTtcblx0XHRcdGNvbnN0IG1hcEtleSA9IHRhc2suZ2V0TWFwS2V5KCk7XG5cdFx0XHR0aGlzLl9idXN5VGFza3NbbWFwS2V5XSA9IHRhc2s7XG5cdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5nZW5lcmFsKFRhc2tFdmVudEtpbmQuQWN0aXZlLCB0YXNrLCB0ZXJtaW5hbC5pbnN0YW5jZUlkKSk7XG5cblx0XHRcdGNvbnN0IHByb2JsZW1NYXRjaGVycyA9IGF3YWl0IHRoaXMuX3Jlc29sdmVNYXRjaGVycyhyZXNvbHZlciwgdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlcnMpO1xuXHRcdFx0Y29uc3Qgc3RhcnRTdG9wUHJvYmxlbU1hdGNoZXIgPSBuZXcgU3RhcnRTdG9wUHJvYmxlbUNvbGxlY3Rvcihwcm9ibGVtTWF0Y2hlcnMsIHRoaXMuX21hcmtlclNlcnZpY2UsIHRoaXMuX21vZGVsU2VydmljZSwgUHJvYmxlbUhhbmRsaW5nU3RyYXRlZ3kuQ2xlYW4sIHRoaXMuX2ZpbGVTZXJ2aWNlKTtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsU3RhdHVzTWFuYWdlci5hZGRUZXJtaW5hbCh0YXNrLCB0ZXJtaW5hbCwgc3RhcnRTdG9wUHJvYmxlbU1hdGNoZXIpO1xuXHRcdFx0c3RhcnRTdG9wUHJvYmxlbU1hdGNoZXIub25EaWRTdGF0ZUNoYW5nZSgoZXZlbnQpID0+IHtcblx0XHRcdFx0aWYgKGV2ZW50LmtpbmQgPT09IFByb2JsZW1Db2xsZWN0b3JFdmVudEtpbmQuQmFja2dyb3VuZFByb2Nlc3NpbmdCZWdpbnMpIHtcblx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5nZW5lcmFsKFRhc2tFdmVudEtpbmQuUHJvYmxlbU1hdGNoZXJTdGFydGVkLCB0YXNrLCB0ZXJtaW5hbD8uaW5zdGFuY2VJZCkpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmtpbmQgPT09IFByb2JsZW1Db2xsZWN0b3JFdmVudEtpbmQuQmFja2dyb3VuZFByb2Nlc3NpbmdFbmRzKSB7XG5cdFx0XHRcdFx0aWYgKHN0YXJ0U3RvcFByb2JsZW1NYXRjaGVyLm51bWJlck9mTWF0Y2hlcyAmJiBzdGFydFN0b3BQcm9ibGVtTWF0Y2hlci5tYXhNYXJrZXJTZXZlcml0eSAmJiBzdGFydFN0b3BQcm9ibGVtTWF0Y2hlci5tYXhNYXJrZXJTZXZlcml0eSA+PSBNYXJrZXJTZXZlcml0eS5FcnJvcikge1xuXHRcdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQuZ2VuZXJhbChUYXNrRXZlbnRLaW5kLlByb2JsZW1NYXRjaGVyRm91bmRFcnJvcnMsIHRhc2ssIHRlcm1pbmFsPy5pbnN0YW5jZUlkKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX2ZpcmVUYXNrRXZlbnQoVGFza0V2ZW50LmdlbmVyYWwoVGFza0V2ZW50S2luZC5Qcm9ibGVtTWF0Y2hlckVuZGVkLCB0YXNrLCB0ZXJtaW5hbD8uaW5zdGFuY2VJZCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRsZXQgcHJvY2Vzc1N0YXJ0ZWRTaWduYWxlZCA9IGZhbHNlO1xuXHRcdFx0dGVybWluYWwucHJvY2Vzc1JlYWR5LnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRpZiAoIXByb2Nlc3NTdGFydGVkU2lnbmFsZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5wcm9jZXNzU3RhcnRlZCh0YXNrLCB0ZXJtaW5hbCEuaW5zdGFuY2VJZCwgdGVybWluYWwhLnByb2Nlc3NJZCEpKTtcblx0XHRcdFx0XHRwcm9jZXNzU3RhcnRlZFNpZ25hbGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgKF9lcnJvcikgPT4ge1xuXHRcdFx0XHQvLyBUaGUgcHJvY2VzcyBuZXZlciBnb3QgcmVhZHkuIE5lZWQgdG8gdGhpbmsgaG93IHRvIGhhbmRsZSB0aGlzLlxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IG9uRGF0YSA9IHRlcm1pbmFsLm9uTGluZURhdGEoKGxpbmUpID0+IHtcblx0XHRcdFx0c3RhcnRTdG9wUHJvYmxlbU1hdGNoZXIucHJvY2Vzc0xpbmUobGluZSk7XG5cdFx0XHR9KTtcblx0XHRcdHByb21pc2UgPSBuZXcgUHJvbWlzZTxJVGFza1N1bW1hcnk+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0Y29uc3Qgb25FeGl0ID0gdGVybWluYWwhLm9uRXhpdCgodGVybWluYWxMYXVuY2hSZXN1bHQpID0+IHtcblx0XHRcdFx0XHRjb25zdCBleGl0Q29kZSA9IHR5cGVvZiB0ZXJtaW5hbExhdW5jaFJlc3VsdCA9PT0gJ251bWJlcicgPyB0ZXJtaW5hbExhdW5jaFJlc3VsdCA6IHRlcm1pbmFsTGF1bmNoUmVzdWx0Py5jb2RlO1xuXHRcdFx0XHRcdG9uRXhpdC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0Y29uc3Qga2V5ID0gdGFzay5nZXRNYXBLZXkoKTtcblx0XHRcdFx0XHR0aGlzLl9yZW1vdmVGcm9tQWN0aXZlVGFza3ModGFzayk7XG5cdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQuY2hhbmdlZCgpKTtcblx0XHRcdFx0XHRpZiAodGVybWluYWxMYXVuY2hSZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0Ly8gT25seSBrZWVwIGEgcmVmZXJlbmNlIHRvIHRoZSB0ZXJtaW5hbCBpZiBpdCBpcyBub3QgYmVpbmcgZGlzcG9zZWQuXG5cdFx0XHRcdFx0XHRzd2l0Y2ggKHRhc2suY29tbWFuZC5wcmVzZW50YXRpb24hLnBhbmVsKSB7XG5cdFx0XHRcdFx0XHRcdGNhc2UgUGFuZWxLaW5kLkRlZGljYXRlZDpcblx0XHRcdFx0XHRcdFx0XHR0aGlzLl9zYW1lVGFza1Rlcm1pbmFsc1trZXldID0gdGVybWluYWwhLmluc3RhbmNlSWQudG9TdHJpbmcoKTtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0Y2FzZSBQYW5lbEtpbmQuU2hhcmVkOlxuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX2lkbGVUYXNrVGVybWluYWxzLnNldChrZXksIHRlcm1pbmFsIS5pbnN0YW5jZUlkLnRvU3RyaW5nKCksIFRvdWNoLkFzT2xkKTtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgcmV2ZWFsID0gdGFzay5jb21tYW5kLnByZXNlbnRhdGlvbiEucmV2ZWFsO1xuXHRcdFx0XHRcdGNvbnN0IHJldmVhbFByb2JsZW1zID0gdGFzay5jb21tYW5kLnByZXNlbnRhdGlvbiEucmV2ZWFsUHJvYmxlbXM7XG5cdFx0XHRcdFx0Y29uc3QgcmV2ZWFsUHJvYmxlbVBhbmVsID0gdGVybWluYWwgJiYgKHJldmVhbFByb2JsZW1zID09PSBSZXZlYWxQcm9ibGVtS2luZC5PblByb2JsZW0pICYmIChzdGFydFN0b3BQcm9ibGVtTWF0Y2hlci5udW1iZXJPZk1hdGNoZXMgPiAwKTtcblx0XHRcdFx0XHRpZiAocmV2ZWFsUHJvYmxlbVBhbmVsKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl92aWV3c1NlcnZpY2Uub3BlblZpZXcoTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAodGVybWluYWwgJiYgKHJldmVhbCA9PT0gUmV2ZWFsS2luZC5TaWxlbnQpICYmICgoZXhpdENvZGUgIT09IDApIHx8IChzdGFydFN0b3BQcm9ibGVtTWF0Y2hlci5udW1iZXJPZk1hdGNoZXMgPiAwKSAmJiBzdGFydFN0b3BQcm9ibGVtTWF0Y2hlci5tYXhNYXJrZXJTZXZlcml0eSAmJlxuXHRcdFx0XHRcdFx0KHN0YXJ0U3RvcFByb2JsZW1NYXRjaGVyLm1heE1hcmtlclNldmVyaXR5ID49IE1hcmtlclNldmVyaXR5LkVycm9yKSkpIHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZS5zZXRBY3RpdmVJbnN0YW5jZSh0ZXJtaW5hbCk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnNob3dQYW5lbChmYWxzZSk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRcdC8vIElmIHRoZSB0ZXJtaW5hbCBoYXMgYWxyZWFkeSBiZWVuIGRpc3Bvc2VkLCB0aGVuIHNldHRpbmcgdGhlIGFjdGl2ZSBpbnN0YW5jZSB3aWxsIGZhaWwuICM5OTgyOFxuXHRcdFx0XHRcdFx0XHQvLyBUaGVyZSBpcyBub3RoaW5nIGVsc2UgdG8gZG8gaGVyZS5cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gSGFjayB0byB3b3JrIGFyb3VuZCAjOTI4NjggdW50aWwgdGVybWluYWwgaXMgZml4ZWQuXG5cdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRvbkRhdGEuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0c3RhcnRTdG9wUHJvYmxlbU1hdGNoZXIuZG9uZSgpO1xuXHRcdFx0XHRcdFx0c3RhcnRTdG9wUHJvYmxlbU1hdGNoZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdH0sIDEwMCk7XG5cdFx0XHRcdFx0aWYgKCFwcm9jZXNzU3RhcnRlZFNpZ25hbGVkICYmIHRlcm1pbmFsKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5wcm9jZXNzU3RhcnRlZCh0YXNrLCB0ZXJtaW5hbC5pbnN0YW5jZUlkLCB0ZXJtaW5hbC5wcm9jZXNzSWQhKSk7XG5cdFx0XHRcdFx0XHRwcm9jZXNzU3RhcnRlZFNpZ25hbGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5wcm9jZXNzRW5kZWQodGFzaywgdGVybWluYWw/Lmluc3RhbmNlSWQsIGV4aXRDb2RlID8/IHVuZGVmaW5lZCkpO1xuXHRcdFx0XHRcdGlmICh0aGlzLl9idXN5VGFza3NbbWFwS2V5XSkge1xuXHRcdFx0XHRcdFx0ZGVsZXRlIHRoaXMuX2J1c3lUYXNrc1ttYXBLZXldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5nZW5lcmFsKFRhc2tFdmVudEtpbmQuSW5hY3RpdmUsIHRhc2ssIHRlcm1pbmFsPy5pbnN0YW5jZUlkKSk7XG5cdFx0XHRcdFx0aWYgKHN0YXJ0U3RvcFByb2JsZW1NYXRjaGVyLm51bWJlck9mTWF0Y2hlcyAmJiBzdGFydFN0b3BQcm9ibGVtTWF0Y2hlci5tYXhNYXJrZXJTZXZlcml0eSAmJiBzdGFydFN0b3BQcm9ibGVtTWF0Y2hlci5tYXhNYXJrZXJTZXZlcml0eSA+PSBNYXJrZXJTZXZlcml0eS5FcnJvcikge1xuXHRcdFx0XHRcdFx0dGhpcy5fZmlyZVRhc2tFdmVudChUYXNrRXZlbnQuZ2VuZXJhbChUYXNrRXZlbnRLaW5kLlByb2JsZW1NYXRjaGVyRm91bmRFcnJvcnMsIHRhc2ssIHRlcm1pbmFsPy5pbnN0YW5jZUlkKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX2ZpcmVUYXNrRXZlbnQoVGFza0V2ZW50LmdlbmVyYWwoVGFza0V2ZW50S2luZC5Qcm9ibGVtTWF0Y2hlckVuZGVkLCB0YXNrLCB0ZXJtaW5hbD8uaW5zdGFuY2VJZCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5nZW5lcmFsKFRhc2tFdmVudEtpbmQuRW5kLCB0YXNrLCB0ZXJtaW5hbD8uaW5zdGFuY2VJZCkpO1xuXHRcdFx0XHRcdHJlc29sdmUoeyBleGl0Q29kZTogZXhpdENvZGUgPz8gdW5kZWZpbmVkIH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNob3dQcm9ibGVtUGFuZWwgPSB0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uICYmICh0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uLnJldmVhbFByb2JsZW1zID09PSBSZXZlYWxQcm9ibGVtS2luZC5BbHdheXMpO1xuXHRcdGlmIChzaG93UHJvYmxlbVBhbmVsKSB7XG5cdFx0XHR0aGlzLl92aWV3c1NlcnZpY2Uub3BlblZpZXcoTWFya2Vycy5NQVJLRVJTX1ZJRVdfSUQpO1xuXHRcdH0gZWxzZSBpZiAodGFzay5jb21tYW5kLnByZXNlbnRhdGlvbiAmJiAodGFzay5jb21tYW5kLnByZXNlbnRhdGlvbi5mb2N1cyB8fCB0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uLnJldmVhbCA9PT0gUmV2ZWFsS2luZC5BbHdheXMpKSB7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uuc2V0QWN0aXZlSW5zdGFuY2UodGVybWluYWwpO1xuXHRcdFx0YXdhaXQgdGhpcy5fdGVybWluYWxTZXJ2aWNlLnJldmVhbFRlcm1pbmFsKHRlcm1pbmFsKTtcblx0XHRcdGlmICh0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uLmZvY3VzKSB7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZS5mb2N1c0luc3RhbmNlKHRlcm1pbmFsKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHRoaXMuX2FjdGl2ZVRhc2tzW3Rhc2suZ2V0TWFwS2V5KCldKSB7XG5cdFx0XHR0aGlzLl9hY3RpdmVUYXNrc1t0YXNrLmdldE1hcEtleSgpXS50ZXJtaW5hbCA9IHRlcm1pbmFsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ05vIGFjdGl2ZSB0YXNrcyBmb3VuZCBmb3IgdGhlIHRlcm1pbmFsLicpO1xuXHRcdH1cblx0XHR0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC5jaGFuZ2VkKCkpO1xuXHRcdHJldHVybiBwcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlVGVybWluYWxOYW1lKHRhc2s6IEN1c3RvbVRhc2sgfCBDb250cmlidXRlZFRhc2spOiBzdHJpbmcge1xuXHRcdGNvbnN0IG5lZWRzRm9sZGVyUXVhbGlmaWNhdGlvbiA9IHRoaXMuX2NvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRTtcblx0XHRyZXR1cm4gbmVlZHNGb2xkZXJRdWFsaWZpY2F0aW9uID8gdGFzay5nZXRRdWFsaWZpZWRMYWJlbCgpIDogKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSB8fCAnJyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVTaGVsbExhdW5jaENvbmZpZyh0YXNrOiBDdXN0b21UYXNrIHwgQ29udHJpYnV0ZWRUYXNrLCB3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQsIHZhcmlhYmxlUmVzb2x2ZXI6IFZhcmlhYmxlUmVzb2x2ZXIsIHBsYXRmb3JtOiBQbGF0Zm9ybS5QbGF0Zm9ybSwgb3B0aW9uczogQ29tbWFuZE9wdGlvbnMsIGNvbW1hbmQ6IENvbW1hbmRTdHJpbmcsIGFyZ3M6IENvbW1hbmRTdHJpbmdbXSwgd2FpdE9uRXhpdDogV2FpdE9uRXhpdFZhbHVlKTogUHJvbWlzZTxJU2hlbGxMYXVuY2hDb25maWcgfCB1bmRlZmluZWQ+IHtcblx0XHRsZXQgc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZztcblx0XHRjb25zdCBpc1NoZWxsQ29tbWFuZCA9IHRhc2suY29tbWFuZC5ydW50aW1lID09PSBSdW50aW1lVHlwZS5TaGVsbDtcblx0XHRjb25zdCBuZWVkc0ZvbGRlclF1YWxpZmljYXRpb24gPSB0aGlzLl9jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0U7XG5cdFx0Y29uc3QgdGVybWluYWxOYW1lID0gdGhpcy5fY3JlYXRlVGVybWluYWxOYW1lKHRhc2spO1xuXHRcdGNvbnN0IHR5cGUgPSBSZWNvbm5lY3Rpb25UeXBlO1xuXHRcdGNvbnN0IG9yaWdpbmFsQ29tbWFuZCA9IHRhc2suY29tbWFuZC5uYW1lO1xuXHRcdGxldCBjd2Q6IHN0cmluZyB8IFVSSSB8IHVuZGVmaW5lZDtcblx0XHRpZiAob3B0aW9ucy5jd2QpIHtcblx0XHRcdGN3ZCA9IG9wdGlvbnMuY3dkO1xuXHRcdFx0aWYgKCFwYXRoLmlzQWJzb2x1dGUoY3dkKSkge1xuXHRcdFx0XHRpZiAod29ya3NwYWNlRm9sZGVyICYmICh3b3Jrc3BhY2VGb2xkZXIudXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSkge1xuXHRcdFx0XHRcdGN3ZCA9IHBhdGguam9pbih3b3Jrc3BhY2VGb2xkZXIudXJpLmZzUGF0aCwgY3dkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gVGhpcyBtdXN0IGJlIG5vcm1hbGl6ZWQgdG8gdGhlIE9TXG5cdFx0XHRjd2QgPSBpc1VOQyhjd2QpID8gY3dkIDogcmVzb3VyY2VzLnRvTG9jYWxSZXNvdXJjZShVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBwYXRoOiBjd2QgfSksIHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHksIHRoaXMuX3BhdGhTZXJ2aWNlLmRlZmF1bHRVcmlTY2hlbWUpO1xuXHRcdH1cblx0XHRpZiAoaXNTaGVsbENvbW1hbmQpIHtcblx0XHRcdGxldCBvczogUGxhdGZvcm0uT3BlcmF0aW5nU3lzdGVtO1xuXHRcdFx0c3dpdGNoIChwbGF0Zm9ybSkge1xuXHRcdFx0XHRjYXNlIFBsYXRmb3JtLlBsYXRmb3JtLldpbmRvd3M6IG9zID0gUGxhdGZvcm0uT3BlcmF0aW5nU3lzdGVtLldpbmRvd3M7IGJyZWFrO1xuXHRcdFx0XHRjYXNlIFBsYXRmb3JtLlBsYXRmb3JtLk1hYzogb3MgPSBQbGF0Zm9ybS5PcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoOyBicmVhaztcblx0XHRcdFx0Y2FzZSBQbGF0Zm9ybS5QbGF0Zm9ybS5MaW51eDpcblx0XHRcdFx0ZGVmYXVsdDogb3MgPSBQbGF0Zm9ybS5PcGVyYXRpbmdTeXN0ZW0uTGludXg7IGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGVmYXVsdFByb2ZpbGUgPSBhd2FpdCB0aGlzLl90ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UuZ2V0RGVmYXVsdFByb2ZpbGUoe1xuXHRcdFx0XHRhbGxvd0F1dG9tYXRpb25TaGVsbDogdHJ1ZSxcblx0XHRcdFx0b3MsXG5cdFx0XHRcdHJlbW90ZUF1dGhvcml0eTogdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eVxuXHRcdFx0fSk7XG5cdFx0XHRsZXQgaWNvbjogVVJJIHwgVGhlbWVJY29uIHwgeyBsaWdodDogVVJJOyBkYXJrOiBVUkkgfSB8IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmljb24/LmlkKSB7XG5cdFx0XHRcdGljb24gPSBUaGVtZUljb24uZnJvbUlkKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWNvbi5pZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCB0YXNrR3JvdXBLaW5kID0gdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCA/IEdyb3VwS2luZC50byh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0Y29uc3Qga2luZElkID0gdHlwZW9mIHRhc2tHcm91cEtpbmQgPT09ICdzdHJpbmcnID8gdGFza0dyb3VwS2luZCA6IHRhc2tHcm91cEtpbmQ/LmtpbmQ7XG5cdFx0XHRcdGljb24gPSBraW5kSWQgPT09ICd0ZXN0JyA/IFRoZW1lSWNvbi5mcm9tSWQoQ29kaWNvbi5iZWFrZXIuaWQpIDogZGVmYXVsdFByb2ZpbGUuaWNvbjtcblx0XHRcdH1cblx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnID0ge1xuXHRcdFx0XHRuYW1lOiB0ZXJtaW5hbE5hbWUsXG5cdFx0XHRcdHR5cGUsXG5cdFx0XHRcdGV4ZWN1dGFibGU6IGRlZmF1bHRQcm9maWxlLnBhdGgsXG5cdFx0XHRcdGFyZ3M6IGRlZmF1bHRQcm9maWxlLmFyZ3MsXG5cdFx0XHRcdGVudjogeyAuLi5kZWZhdWx0UHJvZmlsZS5lbnYgfSxcblx0XHRcdFx0aWNvbixcblx0XHRcdFx0Y29sb3I6IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWNvbj8uY29sb3IgfHwgdW5kZWZpbmVkLFxuXHRcdFx0XHR3YWl0T25FeGl0XG5cdFx0XHR9O1xuXHRcdFx0bGV0IHNoZWxsU3BlY2lmaWVkOiBib29sZWFuID0gZmFsc2U7XG5cdFx0XHRjb25zdCBzaGVsbE9wdGlvbnM6IElTaGVsbENvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQgPSB0YXNrLmNvbW1hbmQub3B0aW9ucyAmJiB0YXNrLmNvbW1hbmQub3B0aW9ucy5zaGVsbDtcblx0XHRcdGlmIChzaGVsbE9wdGlvbnMpIHtcblx0XHRcdFx0aWYgKHNoZWxsT3B0aW9ucy5leGVjdXRhYmxlKSB7XG5cdFx0XHRcdFx0Ly8gQ2xlYXIgb3V0IHRoZSBhcmdzIHNvIHRoYXQgd2UgZG9uJ3QgZW5kIHVwIHdpdGggbWlzbWF0Y2hlZCBhcmdzLlxuXHRcdFx0XHRcdGlmIChzaGVsbE9wdGlvbnMuZXhlY3V0YWJsZSAhPT0gc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSkge1xuXHRcdFx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuYXJncyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSA9IGF3YWl0IHRoaXMuX3Jlc29sdmVWYXJpYWJsZSh2YXJpYWJsZVJlc29sdmVyLCBzaGVsbE9wdGlvbnMuZXhlY3V0YWJsZSk7XG5cdFx0XHRcdFx0c2hlbGxTcGVjaWZpZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChzaGVsbE9wdGlvbnMuYXJncykge1xuXHRcdFx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MgPSBhd2FpdCB0aGlzLl9yZXNvbHZlVmFyaWFibGVzKHZhcmlhYmxlUmVzb2x2ZXIsIHNoZWxsT3B0aW9ucy5hcmdzLnNsaWNlKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2hlbGxMYXVuY2hDb25maWcuYXJncyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MgPSBbXTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHNoZWxsQXJncyA9IEFycmF5LmlzQXJyYXkoc2hlbGxMYXVuY2hDb25maWcuYXJncykgPyA8c3RyaW5nW10+c2hlbGxMYXVuY2hDb25maWcuYXJncy5zbGljZSgwKSA6IFtzaGVsbExhdW5jaENvbmZpZy5hcmdzXTtcblx0XHRcdGNvbnN0IHRvQWRkOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0Y29uc3QgYmFzZW5hbWUgPSBwYXRoLnBvc2l4LmJhc2VuYW1lKChhd2FpdCB0aGlzLl9wYXRoU2VydmljZS5maWxlVVJJKHNoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGUhKSkucGF0aCkudG9Mb3dlckNhc2UoKTtcblx0XHRcdGNvbnN0IGNvbW1hbmRMaW5lID0gdGhpcy5fYnVpbGRTaGVsbENvbW1hbmRMaW5lKHBsYXRmb3JtLCBiYXNlbmFtZSwgc2hlbGxPcHRpb25zLCBjb21tYW5kLCBvcmlnaW5hbENvbW1hbmQsIGFyZ3MpO1xuXHRcdFx0bGV0IHdpbmRvd3NTaGVsbEFyZ3M6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRcdGlmIChwbGF0Zm9ybSA9PT0gUGxhdGZvcm0uUGxhdGZvcm0uV2luZG93cykge1xuXHRcdFx0XHR3aW5kb3dzU2hlbGxBcmdzID0gdHJ1ZTtcblx0XHRcdFx0Ly8gSWYgd2UgZG9uJ3QgaGF2ZSBhIGN3ZCwgdGhlbiB0aGUgdGVybWluYWwgdXNlcyB0aGUgaG9tZSBkaXIuXG5cdFx0XHRcdGNvbnN0IHVzZXJIb21lID0gYXdhaXQgdGhpcy5fcGF0aFNlcnZpY2UudXNlckhvbWUoKTtcblx0XHRcdFx0aWYgKGJhc2VuYW1lID09PSAnY21kLmV4ZScgJiYgKChvcHRpb25zLmN3ZCAmJiBpc1VOQyhvcHRpb25zLmN3ZCkpIHx8ICghb3B0aW9ucy5jd2QgJiYgaXNVTkModXNlckhvbWUuZnNQYXRoKSkpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoKGJhc2VuYW1lID09PSAncG93ZXJzaGVsbC5leGUnKSB8fCAoYmFzZW5hbWUgPT09ICdwd3NoLmV4ZScpKSB7XG5cdFx0XHRcdFx0aWYgKCFzaGVsbFNwZWNpZmllZCkge1xuXHRcdFx0XHRcdFx0dG9BZGQucHVzaCgnLUNvbW1hbmQnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoKGJhc2VuYW1lID09PSAnYmFzaC5leGUnKSB8fCAoYmFzZW5hbWUgPT09ICd6c2guZXhlJykpIHtcblx0XHRcdFx0XHR3aW5kb3dzU2hlbGxBcmdzID0gZmFsc2U7XG5cdFx0XHRcdFx0aWYgKCFzaGVsbFNwZWNpZmllZCkge1xuXHRcdFx0XHRcdFx0dG9BZGQucHVzaCgnLWMnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoYmFzZW5hbWUgPT09ICd3c2wuZXhlJykge1xuXHRcdFx0XHRcdGlmICghc2hlbGxTcGVjaWZpZWQpIHtcblx0XHRcdFx0XHRcdHRvQWRkLnB1c2goJy1lJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICghc2hlbGxTcGVjaWZpZWQpIHtcblx0XHRcdFx0XHRcdHRvQWRkLnB1c2goJy9kJywgJy9jJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoIXNoZWxsU3BlY2lmaWVkKSB7XG5cdFx0XHRcdFx0Ly8gVW5kZXIgTWFjIHJlbW92ZSAtbCB0byBub3Qgc3RhcnQgaXQgYXMgYSBsb2dpbiBzaGVsbC5cblx0XHRcdFx0XHRpZiAocGxhdGZvcm0gPT09IFBsYXRmb3JtLlBsYXRmb3JtLk1hYykge1xuXHRcdFx0XHRcdFx0Ly8gQmFja2dyb3VuZCBvbiAtbCBvbiBvc3ggaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwNzU2M1xuXHRcdFx0XHRcdFx0Ly8gVE9ETzogSGFuZGxlIGJ5IHB1bGxpbmcgdGhlIGRlZmF1bHQgdGVybWluYWwgcHJvZmlsZT9cblx0XHRcdFx0XHRcdC8vIGNvbnN0IG9zeFNoZWxsQXJncyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3QoVGVybWluYWxTZXR0aW5nSWQuU2hlbGxBcmdzTWFjT3MpO1xuXHRcdFx0XHRcdFx0Ly8gaWYgKChvc3hTaGVsbEFyZ3MudXNlciA9PT0gdW5kZWZpbmVkKSAmJiAob3N4U2hlbGxBcmdzLnVzZXJMb2NhbCA9PT0gdW5kZWZpbmVkKSAmJiAob3N4U2hlbGxBcmdzLnVzZXJMb2NhbFZhbHVlID09PSB1bmRlZmluZWQpXG5cdFx0XHRcdFx0XHQvLyBcdCYmIChvc3hTaGVsbEFyZ3MudXNlclJlbW90ZSA9PT0gdW5kZWZpbmVkKSAmJiAob3N4U2hlbGxBcmdzLnVzZXJSZW1vdGVWYWx1ZSA9PT0gdW5kZWZpbmVkKVxuXHRcdFx0XHRcdFx0Ly8gXHQmJiAob3N4U2hlbGxBcmdzLnVzZXJWYWx1ZSA9PT0gdW5kZWZpbmVkKSAmJiAob3N4U2hlbGxBcmdzLndvcmtzcGFjZSA9PT0gdW5kZWZpbmVkKVxuXHRcdFx0XHRcdFx0Ly8gXHQmJiAob3N4U2hlbGxBcmdzLndvcmtzcGFjZUZvbGRlciA9PT0gdW5kZWZpbmVkKSAmJiAob3N4U2hlbGxBcmdzLndvcmtzcGFjZUZvbGRlclZhbHVlID09PSB1bmRlZmluZWQpXG5cdFx0XHRcdFx0XHQvLyBcdCYmIChvc3hTaGVsbEFyZ3Mud29ya3NwYWNlVmFsdWUgPT09IHVuZGVmaW5lZCkpIHtcblx0XHRcdFx0XHRcdC8vIFx0Y29uc3QgaW5kZXggPSBzaGVsbEFyZ3MuaW5kZXhPZignLWwnKTtcblx0XHRcdFx0XHRcdC8vIFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0Ly8gXHRcdHNoZWxsQXJncy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHRcdFx0Ly8gXHR9XG5cdFx0XHRcdFx0XHQvLyB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRvQWRkLnB1c2goJy1jJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNvbnN0IGNvbWJpbmVkU2hlbGxBcmdzID0gdGhpcy5fYWRkQWxsQXJndW1lbnQodG9BZGQsIHNoZWxsQXJncyk7XG5cdFx0XHRjb21iaW5lZFNoZWxsQXJncy5wdXNoKGNvbW1hbmRMaW5lKTtcblx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MgPSB3aW5kb3dzU2hlbGxBcmdzID8gY29tYmluZWRTaGVsbEFyZ3Muam9pbignICcpIDogY29tYmluZWRTaGVsbEFyZ3M7XG5cdFx0XHRpZiAodGFzay5jb21tYW5kLnByZXNlbnRhdGlvbiAmJiB0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uLmVjaG8pIHtcblx0XHRcdFx0aWYgKG5lZWRzRm9sZGVyUXVhbGlmaWNhdGlvbiAmJiB3b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdFx0XHRjb25zdCBmb2xkZXIgPSBjd2QgJiYgdHlwZW9mIGN3ZCA9PT0gJ29iamVjdCcgJiYgJ3BhdGgnIGluIGN3ZCA/IHBhdGguYmFzZW5hbWUoY3dkLnBhdGgpIDogd29ya3NwYWNlRm9sZGVyLm5hbWU7XG5cdFx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuaW5pdGlhbFRleHQgPSB0aGlzLnRhc2tTaGVsbEludGVncmF0aW9uU3RhcnRTZXF1ZW5jZShjd2QpICsgZm9ybWF0TWVzc2FnZUZvclRlcm1pbmFsKG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdFx0XHRrZXk6ICd0YXNrLmV4ZWN1dGluZ0luRm9sZGVyJyxcblx0XHRcdFx0XHRcdGNvbW1lbnQ6IFsnVGhlIHdvcmtzcGFjZSBmb2xkZXIgdGhlIHRhc2sgaXMgcnVubmluZyBpbicsICdUaGUgdGFzayBjb21tYW5kIGxpbmUgb3IgbGFiZWwnXVxuXG5cdFx0XHRcdFx0fSwgJ0V4ZWN1dGluZyB0YXNrIGluIGZvbGRlciB7MH06IHsxfScsIGZvbGRlciwgY29tbWFuZExpbmUpLCB7IGV4Y2x1ZGVMZWFkaW5nTmV3TGluZTogdHJ1ZSB9KSArIHRoaXMudGFza1NoZWxsSW50ZWdyYXRpb25PdXRwdXRTZXF1ZW5jZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzaGVsbExhdW5jaENvbmZpZy5pbml0aWFsVGV4dCA9IHRoaXMudGFza1NoZWxsSW50ZWdyYXRpb25TdGFydFNlcXVlbmNlKGN3ZCkgKyBmb3JtYXRNZXNzYWdlRm9yVGVybWluYWwobmxzLmxvY2FsaXplKHtcblx0XHRcdFx0XHRcdGtleTogJ3Rhc2suZXhlY3V0aW5nLnNoZWxsSW50ZWdyYXRpb24nLFxuXHRcdFx0XHRcdFx0Y29tbWVudDogWydUaGUgdGFzayBjb21tYW5kIGxpbmUgb3IgbGFiZWwnXVxuXHRcdFx0XHRcdH0sICdFeGVjdXRpbmcgdGFzazogezB9JywgY29tbWFuZExpbmUpLCB7IGV4Y2x1ZGVMZWFkaW5nTmV3TGluZTogdHJ1ZSB9KSArIHRoaXMudGFza1NoZWxsSW50ZWdyYXRpb25PdXRwdXRTZXF1ZW5jZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuaW5pdGlhbFRleHQgPSB7XG5cdFx0XHRcdFx0dGV4dDogdGhpcy50YXNrU2hlbGxJbnRlZ3JhdGlvblN0YXJ0U2VxdWVuY2UoY3dkKSArIHRoaXMudGFza1NoZWxsSW50ZWdyYXRpb25PdXRwdXRTZXF1ZW5jZSxcblx0XHRcdFx0XHR0cmFpbGluZ05ld0xpbmU6IGZhbHNlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGNvbW1hbmRFeGVjdXRhYmxlID0gKHRhc2suY29tbWFuZC5ydW50aW1lICE9PSBSdW50aW1lVHlwZS5DdXN0b21FeGVjdXRpb24pID8gQ29tbWFuZFN0cmluZy52YWx1ZShjb21tYW5kKSA6IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGV4ZWN1dGFibGUgPSAhaXNTaGVsbENvbW1hbmRcblx0XHRcdFx0PyBhd2FpdCB0aGlzLl9yZXNvbHZlVmFyaWFibGUodmFyaWFibGVSZXNvbHZlciwgYXdhaXQgdGhpcy5fcmVzb2x2ZVZhcmlhYmxlKHZhcmlhYmxlUmVzb2x2ZXIsICckeycgKyBUZXJtaW5hbFRhc2tTeXN0ZW0uUHJvY2Vzc1Zhck5hbWUgKyAnfScpKVxuXHRcdFx0XHQ6IGNvbW1hbmRFeGVjdXRhYmxlO1xuXG5cdFx0XHQvLyBXaGVuIHdlIGhhdmUgYSBwcm9jZXNzIHRhc2sgdGhlcmUgaXMgbm8gbmVlZCB0byBxdW90ZSBhcmd1bWVudHMuIFNvIHdlIGdvIGFoZWFkIGFuZCB0YWtlIHRoZSBzdHJpbmcgdmFsdWUuXG5cdFx0XHRzaGVsbExhdW5jaENvbmZpZyA9IHtcblx0XHRcdFx0bmFtZTogdGVybWluYWxOYW1lLFxuXHRcdFx0XHR0eXBlLFxuXHRcdFx0XHRpY29uOiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmljb24/LmlkID8gVGhlbWVJY29uLmZyb21JZCh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmljb24uaWQpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRjb2xvcjogdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pY29uPy5jb2xvciB8fCB1bmRlZmluZWQsXG5cdFx0XHRcdGV4ZWN1dGFibGU6IGV4ZWN1dGFibGUsXG5cdFx0XHRcdGFyZ3M6IGFyZ3MubWFwKGEgPT4gVHlwZXMuaXNTdHJpbmcoYSkgPyBhIDogYS52YWx1ZSksXG5cdFx0XHRcdHdhaXRPbkV4aXRcblx0XHRcdH07XG5cdFx0XHRpZiAodGFzay5jb21tYW5kLnByZXNlbnRhdGlvbiAmJiB0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uLmVjaG8pIHtcblx0XHRcdFx0Y29uc3QgZ2V0QXJnc1RvRWNobyA9IChhcmdzOiBzdHJpbmcgfCBzdHJpbmdbXSB8IHVuZGVmaW5lZCk6IHN0cmluZyA9PiB7XG5cdFx0XHRcdFx0aWYgKCFhcmdzIHx8IGFyZ3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyhhcmdzKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGFyZ3M7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBhcmdzLmpvaW4oJyAnKTtcblx0XHRcdFx0fTtcblx0XHRcdFx0aWYgKG5lZWRzRm9sZGVyUXVhbGlmaWNhdGlvbiAmJiB3b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdFx0XHRzaGVsbExhdW5jaENvbmZpZy5pbml0aWFsVGV4dCA9IHRoaXMudGFza1NoZWxsSW50ZWdyYXRpb25TdGFydFNlcXVlbmNlKGN3ZCkgKyBmb3JtYXRNZXNzYWdlRm9yVGVybWluYWwobmxzLmxvY2FsaXplKHtcblx0XHRcdFx0XHRcdGtleTogJ3Rhc2suZXhlY3V0aW5nSW5Gb2xkZXInLFxuXHRcdFx0XHRcdFx0Y29tbWVudDogWydUaGUgd29ya3NwYWNlIGZvbGRlciB0aGUgdGFzayBpcyBydW5uaW5nIGluJywgJ1RoZSB0YXNrIGNvbW1hbmQgbGluZSBvciBsYWJlbCddXG5cdFx0XHRcdFx0fSwgJ0V4ZWN1dGluZyB0YXNrIGluIGZvbGRlciB7MH06IHsxfScsIHdvcmtzcGFjZUZvbGRlci5uYW1lLCBgJHtzaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlfSAke2dldEFyZ3NUb0VjaG8oc2hlbGxMYXVuY2hDb25maWcuYXJncyl9YCksIHsgZXhjbHVkZUxlYWRpbmdOZXdMaW5lOiB0cnVlIH0pICsgdGhpcy50YXNrU2hlbGxJbnRlZ3JhdGlvbk91dHB1dFNlcXVlbmNlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNoZWxsTGF1bmNoQ29uZmlnLmluaXRpYWxUZXh0ID0gdGhpcy50YXNrU2hlbGxJbnRlZ3JhdGlvblN0YXJ0U2VxdWVuY2UoY3dkKSArIGZvcm1hdE1lc3NhZ2VGb3JUZXJtaW5hbChubHMubG9jYWxpemUoe1xuXHRcdFx0XHRcdFx0a2V5OiAndGFzay5leGVjdXRpbmcuc2hlbGwtaW50ZWdyYXRpb24nLFxuXHRcdFx0XHRcdFx0Y29tbWVudDogWydUaGUgdGFzayBjb21tYW5kIGxpbmUgb3IgbGFiZWwnXVxuXHRcdFx0XHRcdH0sICdFeGVjdXRpbmcgdGFzazogezB9JywgYCR7c2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZX0gJHtnZXRBcmdzVG9FY2hvKHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MpfWApLCB7IGV4Y2x1ZGVMZWFkaW5nTmV3TGluZTogdHJ1ZSB9KSArIHRoaXMudGFza1NoZWxsSW50ZWdyYXRpb25PdXRwdXRTZXF1ZW5jZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuaW5pdGlhbFRleHQgPSB7XG5cdFx0XHRcdFx0dGV4dDogdGhpcy50YXNrU2hlbGxJbnRlZ3JhdGlvblN0YXJ0U2VxdWVuY2UoY3dkKSArIHRoaXMudGFza1NoZWxsSW50ZWdyYXRpb25PdXRwdXRTZXF1ZW5jZSxcblx0XHRcdFx0XHR0cmFpbGluZ05ld0xpbmU6IGZhbHNlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGN3ZCkge1xuXHRcdFx0c2hlbGxMYXVuY2hDb25maWcuY3dkID0gY3dkO1xuXHRcdH1cblx0XHRpZiAob3B0aW9ucy5lbnYpIHtcblx0XHRcdGlmIChzaGVsbExhdW5jaENvbmZpZy5lbnYpIHtcblx0XHRcdFx0c2hlbGxMYXVuY2hDb25maWcuZW52ID0geyAuLi5zaGVsbExhdW5jaENvbmZpZy5lbnYsIC4uLm9wdGlvbnMuZW52IH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzaGVsbExhdW5jaENvbmZpZy5lbnYgPSBvcHRpb25zLmVudjtcblx0XHRcdH1cblx0XHR9XG5cdFx0c2hlbGxMYXVuY2hDb25maWcuaXNGZWF0dXJlVGVybWluYWwgPSB0cnVlO1xuXHRcdHNoZWxsTGF1bmNoQ29uZmlnLnVzZVNoZWxsRW52aXJvbm1lbnQgPSB0cnVlO1xuXHRcdHNoZWxsTGF1bmNoQ29uZmlnLnRhYkFjdGlvbnMgPSB0aGlzLl90ZXJtaW5hbFRhYkFjdGlvbnM7XG5cdFx0cmV0dXJuIHNoZWxsTGF1bmNoQ29uZmlnO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWRkQWxsQXJndW1lbnQoc2hlbGxDb21tYW5kQXJnczogc3RyaW5nW10sIGNvbmZpZ3VyZWRTaGVsbEFyZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IGNvbWJpbmVkU2hlbGxBcmdzOiBzdHJpbmdbXSA9IE9iamVjdHMuZGVlcENsb25lKGNvbmZpZ3VyZWRTaGVsbEFyZ3MpO1xuXHRcdHNoZWxsQ29tbWFuZEFyZ3MuZm9yRWFjaChlbGVtZW50ID0+IHtcblx0XHRcdGNvbnN0IHNob3VsZEFkZFNoZWxsQ29tbWFuZEFyZyA9IGNvbmZpZ3VyZWRTaGVsbEFyZ3MuZXZlcnkoKGFyZywgaW5kZXgpID0+IHtcblx0XHRcdFx0aWYgKChhcmcudG9Mb3dlckNhc2UoKSA9PT0gZWxlbWVudCkgJiYgKGNvbmZpZ3VyZWRTaGVsbEFyZ3MubGVuZ3RoID4gaW5kZXggKyAxKSkge1xuXHRcdFx0XHRcdC8vIFdlIGNhbiBzdGlsbCBhZGQgdGhlIGFyZ3VtZW50LCBidXQgb25seSBpZiBub3QgYWxsIG9mIHRoZSBmb2xsb3dpbmcgYXJndW1lbnRzIGJlZ2luIHdpdGggXCItXCIuXG5cdFx0XHRcdFx0cmV0dXJuICFjb25maWd1cmVkU2hlbGxBcmdzLnNsaWNlKGluZGV4ICsgMSkuZXZlcnkodGVzdEFyZyA9PiB0ZXN0QXJnLnN0YXJ0c1dpdGgoJy0nKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIGFyZy50b0xvd2VyQ2FzZSgpICE9PSBlbGVtZW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGlmIChzaG91bGRBZGRTaGVsbENvbW1hbmRBcmcpIHtcblx0XHRcdFx0Y29tYmluZWRTaGVsbEFyZ3MucHVzaChlbGVtZW50KTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gY29tYmluZWRTaGVsbEFyZ3M7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZWNvbm5lY3RUb1Rlcm1pbmFsKHRhc2s6IFRhc2spOiBQcm9taXNlPElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLl9yZWNvbm5lY3RlZFRlcm1pbmFscykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3JlY29ubmVjdGVkVGVybWluYWxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCB0ZXJtaW5hbCA9IHRoaXMuX3JlY29ubmVjdGVkVGVybWluYWxzW2ldO1xuXHRcdFx0aWYgKGdldFJlY29ubmVjdGlvbkRhdGEodGVybWluYWwpPy5sYXN0VGFzayA9PT0gdGFzay5nZXRDb21tb25UYXNrSWQoKSkge1xuXHRcdFx0XHR0aGlzLl9yZWNvbm5lY3RlZFRlcm1pbmFscy5zcGxpY2UoaSwgMSk7XG5cdFx0XHRcdHJldHVybiB0ZXJtaW5hbDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2RvQ3JlYXRlVGVybWluYWwodGFzazogVGFzaywgZ3JvdXA6IHN0cmluZyB8IHVuZGVmaW5lZCwgbGF1bmNoQ29uZmlnczogSVNoZWxsTGF1bmNoQ29uZmlnKTogUHJvbWlzZTxJVGVybWluYWxJbnN0YW5jZT4ge1xuXHRcdGNvbnN0IHJlY29ubmVjdGVkVGVybWluYWwgPSBhd2FpdCB0aGlzLl9yZWNvbm5lY3RUb1Rlcm1pbmFsKHRhc2spO1xuXHRcdGNvbnN0IG9uRGlzcG9zZWQgPSAodGVybWluYWw6IElUZXJtaW5hbEluc3RhbmNlKSA9PiB0aGlzLl9maXJlVGFza0V2ZW50KFRhc2tFdmVudC50ZXJtaW5hdGVkKHRhc2ssIHRlcm1pbmFsLmluc3RhbmNlSWQsIHRlcm1pbmFsLmV4aXRSZWFzb24pKTtcblx0XHRpZiAocmVjb25uZWN0ZWRUZXJtaW5hbCkge1xuXHRcdFx0aWYgKCdjb21tYW5kJyBpbiB0YXNrICYmIHRhc2suY29tbWFuZC5wcmVzZW50YXRpb24pIHtcblx0XHRcdFx0cmVjb25uZWN0ZWRUZXJtaW5hbC53YWl0T25FeGl0ID0gZ2V0V2FpdE9uRXhpdFZhbHVlKHRhc2suY29tbWFuZC5wcmVzZW50YXRpb24sIHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMpO1xuXHRcdFx0fVxuXHRcdFx0cmVjb25uZWN0ZWRUZXJtaW5hbC5vbkRpc3Bvc2VkKG9uRGlzcG9zZWQpO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgncmVjb25uZWN0ZWQgdG8gdGFzayBhbmQgdGVybWluYWwnLCB0YXNrLl9pZCk7XG5cdFx0XHRyZXR1cm4gcmVjb25uZWN0ZWRUZXJtaW5hbDtcblx0XHR9XG5cdFx0aWYgKGdyb3VwKSB7XG5cdFx0XHQvLyBUcnkgdG8gZmluZCBhbiBleGlzdGluZyB0ZXJtaW5hbCB0byBzcGxpdC5cblx0XHRcdC8vIEV2ZW4gaWYgYW4gZXhpc3RpbmcgdGVybWluYWwgaXMgZm91bmQsIHRoZSBzcGxpdCBjYW4gZmFpbCBpZiB0aGUgdGVybWluYWwgd2lkdGggaXMgdG9vIHNtYWxsLlxuXHRcdFx0Zm9yIChjb25zdCB0ZXJtaW5hbCBvZiBPYmplY3QudmFsdWVzKHRoaXMuX3Rlcm1pbmFscykpIHtcblx0XHRcdFx0aWYgKHRlcm1pbmFsLmdyb3VwID09PSBncm91cCkge1xuXHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYEZvdW5kIHRlcm1pbmFsIHRvIHNwbGl0IGZvciBncm91cCAke2dyb3VwfWApO1xuXHRcdFx0XHRcdGNvbnN0IG9yaWdpbmFsSW5zdGFuY2UgPSB0ZXJtaW5hbC50ZXJtaW5hbDtcblx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl90ZXJtaW5hbFNlcnZpY2UuY3JlYXRlVGVybWluYWwoeyBsb2NhdGlvbjogeyBwYXJlbnRUZXJtaW5hbDogb3JpZ2luYWxJbnN0YW5jZSB9LCBjb25maWc6IGxhdW5jaENvbmZpZ3MgfSk7XG5cdFx0XHRcdFx0cmVzdWx0Lm9uRGlzcG9zZWQob25EaXNwb3NlZCk7XG5cdFx0XHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYE5vIHRlcm1pbmFsIGZvdW5kIHRvIHNwbGl0IGZvciBncm91cCAke2dyb3VwfWApO1xuXHRcdH1cblx0XHQvLyBFaXRoZXIgbm8gZ3JvdXAgaXMgdXNlZCwgbm8gdGVybWluYWwgd2l0aCB0aGUgZ3JvdXAgZXhpc3RzIG9yIHNwbGl0dGluZyBhbiBleGlzdGluZyB0ZXJtaW5hbCBmYWlsZWQuXG5cdFx0Y29uc3QgY3JlYXRlZFRlcm1pbmFsID0gYXdhaXQgdGhpcy5fdGVybWluYWxTZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHsgY29uZmlnOiBsYXVuY2hDb25maWdzIH0pO1xuXHRcdGNyZWF0ZWRUZXJtaW5hbC5vbkRpc3Bvc2VkKG9uRGlzcG9zZWQpO1xuXHRcdHJldHVybiBjcmVhdGVkVGVybWluYWw7XG5cdH1cblxuXHRwcml2YXRlIF9yZWNvbm5lY3RUb1Rlcm1pbmFscygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faGFzUmVjb25uZWN0ZWQpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYEFscmVhZHkgcmVjb25uZWN0ZWQsIHRvICR7dGhpcy5fcmVjb25uZWN0ZWRUZXJtaW5hbHM/Lmxlbmd0aH0gdGVybWluYWxzIHNvIHJldHVybmluZ2ApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9yZWNvbm5lY3RlZFRlcm1pbmFscyA9IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5nZXRSZWNvbm5lY3RlZFRlcm1pbmFscyhSZWNvbm5lY3Rpb25UeXBlKT8uZmlsdGVyKHQgPT4gIXQuaXNEaXNwb3NlZCAmJiBnZXRSZWNvbm5lY3Rpb25EYXRhKHQpKSB8fCBbXTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBBdHRlbXB0aW5nIHJlY29ubmVjdGlvbiBvZiAke3RoaXMuX3JlY29ubmVjdGVkVGVybWluYWxzPy5sZW5ndGh9IHRlcm1pbmFsc2ApO1xuXHRcdGlmICghdGhpcy5fcmVjb25uZWN0ZWRUZXJtaW5hbHM/Lmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgTm8gdGVybWluYWxzIHRvIHJlY29ubmVjdCB0byBzbyByZXR1cm5pbmdgKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yIChjb25zdCB0ZXJtaW5hbCBvZiB0aGlzLl9yZWNvbm5lY3RlZFRlcm1pbmFscykge1xuXHRcdFx0XHRjb25zdCBkYXRhID0gZ2V0UmVjb25uZWN0aW9uRGF0YSh0ZXJtaW5hbCkgYXMgSVJlY29ubmVjdGlvblRhc2tEYXRhIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoZGF0YSkge1xuXHRcdFx0XHRcdGNvbnN0IHRlcm1pbmFsRGF0YSA9IHsgbGFzdFRhc2s6IGRhdGEubGFzdFRhc2ssIGdyb3VwOiBkYXRhLmdyb3VwLCB0ZXJtaW5hbCB9O1xuXHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsc1t0ZXJtaW5hbC5pbnN0YW5jZUlkXSA9IHRlcm1pbmFsRGF0YTtcblx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdSZWNvbm5lY3RpbmcgdG8gdGFzayB0ZXJtaW5hbCcsIHRlcm1pbmFsRGF0YS5sYXN0VGFzaywgdGVybWluYWwuaW5zdGFuY2VJZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5faGFzUmVjb25uZWN0ZWQgPSB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGVsZXRlVGFza0FuZFRlcm1pbmFsKHRlcm1pbmFsOiBJVGVybWluYWxJbnN0YW5jZSwgdGVybWluYWxEYXRhOiBJVGVybWluYWxEYXRhKTogdm9pZCB7XG5cdFx0ZGVsZXRlIHRoaXMuX3Rlcm1pbmFsc1t0ZXJtaW5hbC5pbnN0YW5jZUlkXTtcblx0XHRkZWxldGUgdGhpcy5fc2FtZVRhc2tUZXJtaW5hbHNbdGVybWluYWxEYXRhLmxhc3RUYXNrXTtcblx0XHR0aGlzLl9pZGxlVGFza1Rlcm1pbmFscy5kZWxldGUodGVybWluYWxEYXRhLmxhc3RUYXNrKTtcblx0XHQvLyBEZWxldGUgdGhlIHRhc2sgbm93IGFzIGEgd29yayBhcm91bmQgZm9yIGNhc2VzIHdoZW4gdGhlIG9uRXhpdCBpc24ndCBmaXJlZC5cblx0XHQvLyBUaGlzIGNhbiBoYXBwZW4gaWYgdGhlIHRlcm1pbmFsIHdhc24ndCBzaHV0ZG93biB3aXRoIGFuIFwiaW1tZWRpYXRlXCIgZmxhZyBhbmQgaXMgZXhwZWN0ZWQuXG5cdFx0Ly8gRm9yIGNvcnJlY3QgdGVybWluYWwgcmUtdXNlLCB0aGUgdGFzayBuZWVkcyB0byBiZSBkZWxldGVkIGltbWVkaWF0ZWx5LlxuXHRcdC8vIE5vdGUgdGhhdCB0aGlzIHNob3VsZG4ndCBiZSBhIHByb2JsZW0gYW55bW9yZSBzaW5jZSB1c2VyIGluaXRpYXRlZCB0ZXJtaW5hbCBraWxscyBhcmUgbm93IGltbWVkaWF0ZS5cblx0XHRjb25zdCBtYXBLZXkgPSB0ZXJtaW5hbERhdGEubGFzdFRhc2s7XG5cdFx0dGhpcy5fcmVtb3ZlRnJvbUFjdGl2ZVRhc2tzKG1hcEtleSk7XG5cdFx0aWYgKHRoaXMuX2J1c3lUYXNrc1ttYXBLZXldKSB7XG5cdFx0XHRkZWxldGUgdGhpcy5fYnVzeVRhc2tzW21hcEtleV07XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfY3JlYXRlVGVybWluYWwodGFzazogQ3VzdG9tVGFzayB8IENvbnRyaWJ1dGVkVGFzaywgcmVzb2x2ZXI6IFZhcmlhYmxlUmVzb2x2ZXIsIHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCk6IFByb21pc2U8W0lUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkLCBUYXNrRXJyb3IgfCB1bmRlZmluZWRdPiB7XG5cdFx0Y29uc3QgcGxhdGZvcm0gPSByZXNvbHZlci50YXNrU3lzdGVtSW5mbyA/IHJlc29sdmVyLnRhc2tTeXN0ZW1JbmZvLnBsYXRmb3JtIDogUGxhdGZvcm0ucGxhdGZvcm07XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMuX3Jlc29sdmVPcHRpb25zKHJlc29sdmVyLCB0YXNrLmNvbW1hbmQub3B0aW9ucyk7XG5cdFx0Y29uc3QgcHJlc2VudGF0aW9uT3B0aW9ucyA9IHRhc2suY29tbWFuZC5wcmVzZW50YXRpb247XG5cblx0XHRpZiAoIXByZXNlbnRhdGlvbk9wdGlvbnMpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVGFzayBwcmVzZW50YXRpb24gb3B0aW9ucyBzaG91bGQgbm90IGJlIHVuZGVmaW5lZCBoZXJlLicpO1xuXHRcdH1cblx0XHRjb25zdCB3YWl0T25FeGl0ID0gZ2V0V2FpdE9uRXhpdFZhbHVlKHByZXNlbnRhdGlvbk9wdGlvbnMsIHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMpO1xuXG5cdFx0bGV0IGNvbW1hbmQ6IENvbW1hbmRTdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGFyZ3M6IENvbW1hbmRTdHJpbmdbXSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgbGF1bmNoQ29uZmlnczogSVNoZWxsTGF1bmNoQ29uZmlnIHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKHRhc2suY29tbWFuZC5ydW50aW1lID09PSBSdW50aW1lVHlwZS5DdXN0b21FeGVjdXRpb24pIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRUYXNrLnNoZWxsTGF1bmNoQ29uZmlnID0gbGF1bmNoQ29uZmlncyA9IHtcblx0XHRcdFx0Y3VzdG9tUHR5SW1wbGVtZW50YXRpb246IChpZCwgY29scywgcm93cykgPT4gbmV3IFRlcm1pbmFsUHJvY2Vzc0V4dEhvc3RQcm94eShpZCwgY29scywgcm93cywgdGhpcy5fdGVybWluYWxTZXJ2aWNlKSxcblx0XHRcdFx0d2FpdE9uRXhpdCxcblx0XHRcdFx0bmFtZTogdGhpcy5fY3JlYXRlVGVybWluYWxOYW1lKHRhc2spLFxuXHRcdFx0XHRpbml0aWFsVGV4dDogdGFzay5jb21tYW5kLnByZXNlbnRhdGlvbiAmJiB0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uLmVjaG8gPyBmb3JtYXRNZXNzYWdlRm9yVGVybWluYWwobmxzLmxvY2FsaXplKHtcblx0XHRcdFx0XHRrZXk6ICd0YXNrLmV4ZWN1dGluZycsXG5cdFx0XHRcdFx0Y29tbWVudDogWydUaGUgdGFzayBjb21tYW5kIGxpbmUgb3IgbGFiZWwnXVxuXHRcdFx0XHR9LCAnRXhlY3V0aW5nIHRhc2s6IHswfScsIHRhc2suX2xhYmVsKSwgeyBleGNsdWRlTGVhZGluZ05ld0xpbmU6IHRydWUgfSkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdGlzRmVhdHVyZVRlcm1pbmFsOiB0cnVlLFxuXHRcdFx0XHRpY29uOiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmljb24/LmlkID8gVGhlbWVJY29uLmZyb21JZCh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmljb24uaWQpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRjb2xvcjogdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pY29uPy5jb2xvciB8fCB1bmRlZmluZWRcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHJlc29sdmVkUmVzdWx0OiB7IGNvbW1hbmQ6IENvbW1hbmRTdHJpbmc7IGFyZ3M6IENvbW1hbmRTdHJpbmdbXSB9ID0gYXdhaXQgdGhpcy5fcmVzb2x2ZUNvbW1hbmRBbmRBcmdzKHJlc29sdmVyLCB0YXNrLmNvbW1hbmQpO1xuXHRcdFx0Y29tbWFuZCA9IHJlc29sdmVkUmVzdWx0LmNvbW1hbmQ7XG5cdFx0XHRhcmdzID0gcmVzb2x2ZWRSZXN1bHQuYXJncztcblxuXHRcdFx0dGhpcy5fY3VycmVudFRhc2suc2hlbGxMYXVuY2hDb25maWcgPSBsYXVuY2hDb25maWdzID0gYXdhaXQgdGhpcy5fY3JlYXRlU2hlbGxMYXVuY2hDb25maWcodGFzaywgd29ya3NwYWNlRm9sZGVyLCByZXNvbHZlciwgcGxhdGZvcm0sIG9wdGlvbnMsIGNvbW1hbmQsIGFyZ3MsIHdhaXRPbkV4aXQpO1xuXHRcdFx0aWYgKGxhdW5jaENvbmZpZ3MgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXR1cm4gW3VuZGVmaW5lZCwgbmV3IFRhc2tFcnJvcihTZXZlcml0eS5FcnJvciwgbmxzLmxvY2FsaXplKCdUZXJtaW5hbFRhc2tTeXN0ZW0nLCAnQ2FuXFwndCBleGVjdXRlIGEgc2hlbGwgY29tbWFuZCBvbiBhbiBVTkMgZHJpdmUgdXNpbmcgY21kLmV4ZS4nKSwgVGFza0Vycm9ycy5Vbmtub3duRXJyb3IpXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgcHJlZmVyc1NhbWVUZXJtaW5hbCA9IHByZXNlbnRhdGlvbk9wdGlvbnMucGFuZWwgPT09IFBhbmVsS2luZC5EZWRpY2F0ZWQ7XG5cdFx0Y29uc3QgYWxsb3dzU2hhcmVkVGVybWluYWwgPSBwcmVzZW50YXRpb25PcHRpb25zLnBhbmVsID09PSBQYW5lbEtpbmQuU2hhcmVkO1xuXHRcdGNvbnN0IGdyb3VwID0gcHJlc2VudGF0aW9uT3B0aW9ucy5ncm91cDtcblxuXHRcdGNvbnN0IHRhc2tLZXkgPSB0YXNrLmdldE1hcEtleSgpO1xuXHRcdGxldCB0ZXJtaW5hbFRvUmV1c2U6IElUZXJtaW5hbERhdGEgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHByZWZlcnNTYW1lVGVybWluYWwpIHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsSWQgPSB0aGlzLl9zYW1lVGFza1Rlcm1pbmFsc1t0YXNrS2V5XTtcblx0XHRcdGlmICh0ZXJtaW5hbElkKSB7XG5cdFx0XHRcdHRlcm1pbmFsVG9SZXVzZSA9IHRoaXMuX3Rlcm1pbmFsc1t0ZXJtaW5hbElkXTtcblx0XHRcdFx0ZGVsZXRlIHRoaXMuX3NhbWVUYXNrVGVybWluYWxzW3Rhc2tLZXldO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoYWxsb3dzU2hhcmVkVGVybWluYWwpIHtcblx0XHRcdC8vIEFsd2F5cyBhbGxvdyB0byByZXVzZSB0aGUgdGVybWluYWwgcHJldmlvdXNseSB1c2VkIGJ5IHRoZSBzYW1lIHRhc2suXG5cdFx0XHRsZXQgdGVybWluYWxJZCA9IHRoaXMuX2lkbGVUYXNrVGVybWluYWxzLnJlbW92ZSh0YXNrS2V5KTtcblx0XHRcdGlmICghdGVybWluYWxJZCkge1xuXHRcdFx0XHQvLyBUaGVyZSBpcyBubyBpZGxlIHRlcm1pbmFsIHdoaWNoIHdhcyB1c2VkIGJ5IHRoZSBzYW1lIHRhc2suXG5cdFx0XHRcdC8vIFNlYXJjaCBmb3IgYW55IGlkbGUgdGVybWluYWwgdXNlZCBwcmV2aW91c2x5IGJ5IGEgdGFzayBvZiB0aGUgc2FtZSBncm91cFxuXHRcdFx0XHQvLyAob3IsIGlmIHRoZSB0YXNrIGhhcyBubyBncm91cCwgYSB0ZXJtaW5hbCB1c2VkIGJ5IGEgdGFzayB3aXRob3V0IGdyb3VwKS5cblx0XHRcdFx0Zm9yIChjb25zdCB0YXNrSWQgb2YgdGhpcy5faWRsZVRhc2tUZXJtaW5hbHMua2V5cygpKSB7XG5cdFx0XHRcdFx0Y29uc3QgaWRsZVRlcm1pbmFsSWQgPSB0aGlzLl9pZGxlVGFza1Rlcm1pbmFscy5nZXQodGFza0lkKSE7XG5cdFx0XHRcdFx0aWYgKGlkbGVUZXJtaW5hbElkICYmIHRoaXMuX3Rlcm1pbmFsc1tpZGxlVGVybWluYWxJZF0gJiYgdGhpcy5fdGVybWluYWxzW2lkbGVUZXJtaW5hbElkXS5ncm91cCA9PT0gZ3JvdXApIHtcblx0XHRcdFx0XHRcdHRlcm1pbmFsSWQgPSB0aGlzLl9pZGxlVGFza1Rlcm1pbmFscy5yZW1vdmUodGFza0lkKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHRlcm1pbmFsSWQpIHtcblx0XHRcdFx0dGVybWluYWxUb1JldXNlID0gdGhpcy5fdGVybWluYWxzW3Rlcm1pbmFsSWRdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGVybWluYWxUb1JldXNlKSB7XG5cdFx0XHRpZiAoIWxhdW5jaENvbmZpZ3MpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdUYXNrIHNoZWxsIGxhdW5jaCBjb25maWd1cmF0aW9uIHNob3VsZCBub3QgYmUgdW5kZWZpbmVkIGhlcmUuJyk7XG5cdFx0XHR9XG5cblx0XHRcdHRlcm1pbmFsVG9SZXVzZS50ZXJtaW5hbC5zY3JvbGxUb0JvdHRvbSgpO1xuXHRcdFx0aWYgKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kKSB7XG5cdFx0XHRcdGxhdW5jaENvbmZpZ3MucmVjb25uZWN0aW9uUHJvcGVydGllcyA9IHsgb3duZXJJZDogUmVjb25uZWN0aW9uVHlwZSwgZGF0YTogeyBsYXN0VGFzazogdGFzay5nZXRDb21tb25UYXNrSWQoKSwgZ3JvdXAsIGxhYmVsOiB0YXNrLl9sYWJlbCwgaWQ6IHRhc2suX2lkIH0gfTtcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRlcm1pbmFsVG9SZXVzZS50ZXJtaW5hbC5yZXVzZVRlcm1pbmFsKGxhdW5jaENvbmZpZ3MpO1xuXG5cdFx0XHRpZiAodGFzay5jb21tYW5kLnByZXNlbnRhdGlvbiAmJiB0YXNrLmNvbW1hbmQucHJlc2VudGF0aW9uLmNsZWFyKSB7XG5cdFx0XHRcdHRlcm1pbmFsVG9SZXVzZS50ZXJtaW5hbC5jbGVhckJ1ZmZlcigpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fdGVybWluYWxzW3Rlcm1pbmFsVG9SZXVzZS50ZXJtaW5hbC5pbnN0YW5jZUlkLnRvU3RyaW5nKCldLmxhc3RUYXNrID0gdGFza0tleTtcblx0XHRcdHJldHVybiBbdGVybWluYWxUb1JldXNlLnRlcm1pbmFsLCB1bmRlZmluZWRdO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Rlcm1pbmFsQ3JlYXRpb25RdWV1ZSA9IHRoaXMuX3Rlcm1pbmFsQ3JlYXRpb25RdWV1ZS50aGVuKCgpID0+IHRoaXMuX2RvQ3JlYXRlVGVybWluYWwodGFzaywgZ3JvdXAsIGxhdW5jaENvbmZpZ3MpKTtcblx0XHRjb25zdCB0ZXJtaW5hbDogSVRlcm1pbmFsSW5zdGFuY2UgPSAoYXdhaXQgdGhpcy5fdGVybWluYWxDcmVhdGlvblF1ZXVlKSE7XG5cdFx0aWYgKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kKSB7XG5cdFx0XHR0ZXJtaW5hbC5zaGVsbExhdW5jaENvbmZpZy5yZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzID0geyBvd25lcklkOiBSZWNvbm5lY3Rpb25UeXBlLCBkYXRhOiB7IGxhc3RUYXNrOiB0YXNrLmdldENvbW1vblRhc2tJZCgpLCBncm91cCwgbGFiZWw6IHRhc2suX2xhYmVsLCBpZDogdGFzay5faWQgfSB9O1xuXHRcdH1cblx0XHRjb25zdCB0ZXJtaW5hbEtleSA9IHRlcm1pbmFsLmluc3RhbmNlSWQudG9TdHJpbmcoKTtcblx0XHRjb25zdCB0ZXJtaW5hbERhdGEgPSB7IHRlcm1pbmFsOiB0ZXJtaW5hbCwgbGFzdFRhc2s6IHRhc2tLZXksIGdyb3VwIH07XG5cdFx0dGVybWluYWwub25EaXNwb3NlZCgoKSA9PiB0aGlzLl9kZWxldGVUYXNrQW5kVGVybWluYWwodGVybWluYWwsIHRlcm1pbmFsRGF0YSkpO1xuXHRcdHRoaXMuX3Rlcm1pbmFsc1t0ZXJtaW5hbEtleV0gPSB0ZXJtaW5hbERhdGE7XG5cdFx0dGVybWluYWwuc2hlbGxMYXVuY2hDb25maWcudGFiQWN0aW9ucyA9IHRoaXMuX3Rlcm1pbmFsVGFiQWN0aW9ucztcblx0XHRyZXR1cm4gW3Rlcm1pbmFsLCB1bmRlZmluZWRdO1xuXHR9XG5cblx0cHJpdmF0ZSBfYnVpbGRTaGVsbENvbW1hbmRMaW5lKHBsYXRmb3JtOiBQbGF0Zm9ybS5QbGF0Zm9ybSwgc2hlbGxFeGVjdXRhYmxlOiBzdHJpbmcsIHNoZWxsT3B0aW9uczogSVNoZWxsQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZCwgY29tbWFuZDogQ29tbWFuZFN0cmluZywgb3JpZ2luYWxDb21tYW5kOiBDb21tYW5kU3RyaW5nIHwgdW5kZWZpbmVkLCBhcmdzOiBDb21tYW5kU3RyaW5nW10pOiBzdHJpbmcge1xuXHRcdGNvbnN0IGJhc2VuYW1lID0gcGF0aC5wYXJzZShzaGVsbEV4ZWN1dGFibGUpLm5hbWUudG9Mb3dlckNhc2UoKTtcblx0XHRjb25zdCBzaGVsbFF1b3RlT3B0aW9ucyA9IHRoaXMuX2dldFF1b3RpbmdPcHRpb25zKGJhc2VuYW1lLCBzaGVsbE9wdGlvbnMsIHBsYXRmb3JtKTtcblxuXHRcdGZ1bmN0aW9uIG5lZWRzUXVvdGVzKHZhbHVlOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRcdGlmICh2YWx1ZS5sZW5ndGggPj0gMikge1xuXHRcdFx0XHRjb25zdCBmaXJzdCA9IHZhbHVlWzBdID09PSBzaGVsbFF1b3RlT3B0aW9ucy5zdHJvbmcgPyBzaGVsbFF1b3RlT3B0aW9ucy5zdHJvbmcgOiB2YWx1ZVswXSA9PT0gc2hlbGxRdW90ZU9wdGlvbnMud2VhayA/IHNoZWxsUXVvdGVPcHRpb25zLndlYWsgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChmaXJzdCA9PT0gdmFsdWVbdmFsdWUubGVuZ3RoIC0gMV0pIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGxldCBxdW90ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHQvLyBXZSBmb3VuZCB0aGUgZW5kIHF1b3RlLlxuXHRcdFx0XHRjb25zdCBjaCA9IHZhbHVlW2ldO1xuXHRcdFx0XHRpZiAoY2ggPT09IHF1b3RlKSB7XG5cdFx0XHRcdFx0cXVvdGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH0gZWxzZSBpZiAocXVvdGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdC8vIHNraXAgdGhlIGNoYXJhY3Rlci4gV2UgYXJlIHF1b3RlZC5cblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fSBlbHNlIGlmIChjaCA9PT0gc2hlbGxRdW90ZU9wdGlvbnMuZXNjYXBlKSB7XG5cdFx0XHRcdFx0Ly8gU2tpcCB0aGUgbmV4dCBjaGFyYWN0ZXJcblx0XHRcdFx0XHRpKys7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2ggPT09IHNoZWxsUXVvdGVPcHRpb25zLnN0cm9uZyB8fCBjaCA9PT0gc2hlbGxRdW90ZU9wdGlvbnMud2Vhaykge1xuXHRcdFx0XHRcdHF1b3RlID0gY2g7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2ggPT09ICcgJykge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcXVvdGUodmFsdWU6IHN0cmluZywga2luZDogU2hlbGxRdW90aW5nKTogW3N0cmluZywgYm9vbGVhbl0ge1xuXHRcdFx0aWYgKGtpbmQgPT09IFNoZWxsUXVvdGluZy5TdHJvbmcgJiYgc2hlbGxRdW90ZU9wdGlvbnMuc3Ryb25nKSB7XG5cdFx0XHRcdHJldHVybiBbc2hlbGxRdW90ZU9wdGlvbnMuc3Ryb25nICsgdmFsdWUgKyBzaGVsbFF1b3RlT3B0aW9ucy5zdHJvbmcsIHRydWVdO1xuXHRcdFx0fSBlbHNlIGlmIChraW5kID09PSBTaGVsbFF1b3RpbmcuV2VhayAmJiBzaGVsbFF1b3RlT3B0aW9ucy53ZWFrKSB7XG5cdFx0XHRcdHJldHVybiBbc2hlbGxRdW90ZU9wdGlvbnMud2VhayArIHZhbHVlICsgc2hlbGxRdW90ZU9wdGlvbnMud2VhaywgdHJ1ZV07XG5cdFx0XHR9IGVsc2UgaWYgKGtpbmQgPT09IFNoZWxsUXVvdGluZy5Fc2NhcGUgJiYgc2hlbGxRdW90ZU9wdGlvbnMuZXNjYXBlKSB7XG5cdFx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyhzaGVsbFF1b3RlT3B0aW9ucy5lc2NhcGUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFt2YWx1ZS5yZXBsYWNlKC8gL2csIHNoZWxsUXVvdGVPcHRpb25zLmVzY2FwZSArICcgJyksIHRydWVdO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGJ1ZmZlcjogc3RyaW5nW10gPSBbXTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoIG9mIHNoZWxsUXVvdGVPcHRpb25zLmVzY2FwZS5jaGFyc1RvRXNjYXBlKSB7XG5cdFx0XHRcdFx0XHRidWZmZXIucHVzaChgXFxcXCR7Y2h9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHJlZ2V4cDogUmVnRXhwID0gbmV3IFJlZ0V4cCgnWycgKyBidWZmZXIuam9pbignLCcpICsgJ10nLCAnZycpO1xuXHRcdFx0XHRcdGNvbnN0IGVzY2FwZUNoYXIgPSBzaGVsbFF1b3RlT3B0aW9ucy5lc2NhcGUuZXNjYXBlQ2hhcjtcblx0XHRcdFx0XHRyZXR1cm4gW3ZhbHVlLnJlcGxhY2UocmVnZXhwLCAobWF0Y2gpID0+IGVzY2FwZUNoYXIgKyBtYXRjaCksIHRydWVdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gW3ZhbHVlLCBmYWxzZV07XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcXVvdGVJZk5lY2Vzc2FyeSh2YWx1ZTogQ29tbWFuZFN0cmluZyk6IFtzdHJpbmcsIGJvb2xlYW5dIHtcblx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyh2YWx1ZSkpIHtcblx0XHRcdFx0aWYgKG5lZWRzUXVvdGVzKHZhbHVlKSkge1xuXHRcdFx0XHRcdHJldHVybiBxdW90ZSh2YWx1ZSwgU2hlbGxRdW90aW5nLlN0cm9uZyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIFt2YWx1ZSwgZmFsc2VdO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gcXVvdGUodmFsdWUudmFsdWUsIHZhbHVlLnF1b3RpbmcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIElmIHdlIGhhdmUgbm8gYXJncyBhbmQgdGhlIGNvbW1hbmQgaXMgYSBzdHJpbmcgdGhlbiB1c2UgdGhlIGNvbW1hbmQgdG8gc3RheSBiYWNrd2FyZHMgY29tcGF0aWJsZSB3aXRoIHRoZSBvbGQgY29tbWFuZCBsaW5lXG5cdFx0Ly8gbW9kZWwuIFRvIGFsbG93IHZhcmlhYmxlIHJlc29sdmluZyB3aXRoIHNwYWNlcyB3ZSBkbyBjb250aW51ZSBpZiB0aGUgcmVzb2x2ZWQgdmFsdWUgaXMgZGlmZmVyZW50IHRoYW4gdGhlIG9yaWdpbmFsIG9uZVxuXHRcdC8vIGFuZCB0aGUgcmVzb2x2ZWQgb25lIG5lZWRzIHF1b3RpbmcuXG5cdFx0aWYgKCghYXJncyB8fCBhcmdzLmxlbmd0aCA9PT0gMCkgJiYgVHlwZXMuaXNTdHJpbmcoY29tbWFuZCkgJiYgKGNvbW1hbmQgPT09IG9yaWdpbmFsQ29tbWFuZCBhcyBzdHJpbmcgfHwgbmVlZHNRdW90ZXMob3JpZ2luYWxDb21tYW5kIGFzIHN0cmluZykpKSB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZDtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG5cdFx0bGV0IGNvbW1hbmRRdW90ZWQgPSBmYWxzZTtcblx0XHRsZXQgYXJnUXVvdGVkID0gZmFsc2U7XG5cdFx0bGV0IHZhbHVlOiBzdHJpbmc7XG5cdFx0bGV0IHF1b3RlZDogYm9vbGVhbjtcblx0XHRbdmFsdWUsIHF1b3RlZF0gPSBxdW90ZUlmTmVjZXNzYXJ5KGNvbW1hbmQpO1xuXHRcdHJlc3VsdC5wdXNoKHZhbHVlKTtcblx0XHRjb21tYW5kUXVvdGVkID0gcXVvdGVkO1xuXHRcdGZvciAoY29uc3QgYXJnIG9mIGFyZ3MpIHtcblx0XHRcdFt2YWx1ZSwgcXVvdGVkXSA9IHF1b3RlSWZOZWNlc3NhcnkoYXJnKTtcblx0XHRcdHJlc3VsdC5wdXNoKHZhbHVlKTtcblx0XHRcdGFyZ1F1b3RlZCA9IGFyZ1F1b3RlZCB8fCBxdW90ZWQ7XG5cdFx0fVxuXG5cdFx0bGV0IGNvbW1hbmRMaW5lID0gcmVzdWx0LmpvaW4oJyAnKTtcblx0XHQvLyBUaGVyZSBhcmUgc3BlY2lhbCBydWxlcyBxdW90ZWQgY29tbWFuZCBsaW5lIGluIGNtZC5leGVcblx0XHRpZiAocGxhdGZvcm0gPT09IFBsYXRmb3JtLlBsYXRmb3JtLldpbmRvd3MpIHtcblx0XHRcdGlmIChiYXNlbmFtZSA9PT0gJ2NtZCcgJiYgY29tbWFuZFF1b3RlZCAmJiBhcmdRdW90ZWQpIHtcblx0XHRcdFx0Y29tbWFuZExpbmUgPSAnXCInICsgY29tbWFuZExpbmUgKyAnXCInO1xuXHRcdFx0fSBlbHNlIGlmICgoYmFzZW5hbWUgPT09ICdwb3dlcnNoZWxsJyB8fCBiYXNlbmFtZSA9PT0gJ3B3c2gnKSAmJiBjb21tYW5kUXVvdGVkKSB7XG5cdFx0XHRcdGNvbW1hbmRMaW5lID0gJyYgJyArIGNvbW1hbmRMaW5lO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBjb21tYW5kTGluZTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFF1b3RpbmdPcHRpb25zKHNoZWxsQmFzZW5hbWU6IHN0cmluZywgc2hlbGxPcHRpb25zOiBJU2hlbGxDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkLCBwbGF0Zm9ybTogUGxhdGZvcm0uUGxhdGZvcm0pOiBJU2hlbGxRdW90aW5nT3B0aW9ucyB7XG5cdFx0aWYgKHNoZWxsT3B0aW9ucyAmJiBzaGVsbE9wdGlvbnMucXVvdGluZykge1xuXHRcdFx0cmV0dXJuIHNoZWxsT3B0aW9ucy5xdW90aW5nO1xuXHRcdH1cblx0XHRyZXR1cm4gVGVybWluYWxUYXNrU3lzdGVtLl9zaGVsbFF1b3Rlc1tzaGVsbEJhc2VuYW1lXSB8fCBUZXJtaW5hbFRhc2tTeXN0ZW0uX29zU2hlbGxRdW90ZXNbUGxhdGZvcm0uUGxhdGZvcm1Ub1N0cmluZyhwbGF0Zm9ybSldO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29sbGVjdFRhc2tWYXJpYWJsZXModmFyaWFibGVzOiBTZXQ8c3RyaW5nPiwgdGFzazogQ3VzdG9tVGFzayB8IENvbnRyaWJ1dGVkVGFzayk6IHZvaWQge1xuXHRcdGlmICh0YXNrLmNvbW1hbmQgJiYgdGFzay5jb21tYW5kLm5hbWUpIHtcblx0XHRcdHRoaXMuX2NvbGxlY3RDb21tYW5kVmFyaWFibGVzKHZhcmlhYmxlcywgdGFzay5jb21tYW5kLCB0YXNrKTtcblx0XHR9XG5cdFx0dGhpcy5fY29sbGVjdE1hdGNoZXJWYXJpYWJsZXModmFyaWFibGVzLCB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyk7XG5cblx0XHRpZiAodGFzay5jb21tYW5kLnJ1bnRpbWUgPT09IFJ1bnRpbWVUeXBlLkN1c3RvbUV4ZWN1dGlvbiAmJiAoQ3VzdG9tVGFzay5pcyh0YXNrKSB8fCBDb250cmlidXRlZFRhc2suaXModGFzaykpKSB7XG5cdFx0XHRsZXQgZGVmaW5pdGlvbjogYW55O1xuXHRcdFx0aWYgKEN1c3RvbVRhc2suaXModGFzaykpIHtcblx0XHRcdFx0ZGVmaW5pdGlvbiA9IHRhc2suX3NvdXJjZS5jb25maWcuZWxlbWVudDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRlZmluaXRpb24gPSBPYmplY3RzLmRlZXBDbG9uZSh0YXNrLmRlZmluZXMpO1xuXHRcdFx0XHRkZWxldGUgZGVmaW5pdGlvbi5fa2V5O1xuXHRcdFx0XHRkZWxldGUgZGVmaW5pdGlvbi50eXBlO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fY29sbGVjdERlZmluaXRpb25WYXJpYWJsZXModmFyaWFibGVzLCBkZWZpbml0aW9uKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jb2xsZWN0RGVmaW5pdGlvblZhcmlhYmxlcyh2YXJpYWJsZXM6IFNldDxzdHJpbmc+LCBkZWZpbml0aW9uOiBhbnkpOiB2b2lkIHtcblx0XHRpZiAoVHlwZXMuaXNTdHJpbmcoZGVmaW5pdGlvbikpIHtcblx0XHRcdHRoaXMuX2NvbGxlY3RWYXJpYWJsZXModmFyaWFibGVzLCBkZWZpbml0aW9uKTtcblx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZGVmaW5pdGlvbikpIHtcblx0XHRcdGRlZmluaXRpb24uZm9yRWFjaCgoZWxlbWVudDogYW55KSA9PiB0aGlzLl9jb2xsZWN0RGVmaW5pdGlvblZhcmlhYmxlcyh2YXJpYWJsZXMsIGVsZW1lbnQpKTtcblx0XHR9IGVsc2UgaWYgKFR5cGVzLmlzT2JqZWN0KGRlZmluaXRpb24pKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0XHRcdHRoaXMuX2NvbGxlY3REZWZpbml0aW9uVmFyaWFibGVzKHZhcmlhYmxlcywgZGVmaW5pdGlvbltrZXldKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jb2xsZWN0Q29tbWFuZFZhcmlhYmxlcyh2YXJpYWJsZXM6IFNldDxzdHJpbmc+LCBjb21tYW5kOiBJQ29tbWFuZENvbmZpZ3VyYXRpb24sIHRhc2s6IEN1c3RvbVRhc2sgfCBDb250cmlidXRlZFRhc2spOiB2b2lkIHtcblx0XHQvLyBUaGUgY3VzdG9tIGV4ZWN1dGlvbiBzaG91bGQgaGF2ZSBldmVyeXRoaW5nIGl0IG5lZWRzIGFscmVhZHkgYXMgaXQgcHJvdmlkZWRcblx0XHQvLyB0aGUgY2FsbGJhY2suXG5cdFx0aWYgKGNvbW1hbmQucnVudGltZSA9PT0gUnVudGltZVR5cGUuQ3VzdG9tRXhlY3V0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGNvbW1hbmQubmFtZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvbW1hbmQgbmFtZSBzaG91bGQgbmV2ZXIgYmUgdW5kZWZpbmVkIGhlcmUuJyk7XG5cdFx0fVxuXHRcdHRoaXMuX2NvbGxlY3RWYXJpYWJsZXModmFyaWFibGVzLCBjb21tYW5kLm5hbWUpO1xuXHRcdGNvbW1hbmQuYXJncz8uZm9yRWFjaChhcmcgPT4gdGhpcy5fY29sbGVjdFZhcmlhYmxlcyh2YXJpYWJsZXMsIGFyZykpO1xuXHRcdC8vIFRyeSB0byBnZXQgYSBzY29wZS5cblx0XHRjb25zdCBzY29wZSA9ICg8SUV4dGVuc2lvblRhc2tTb3VyY2U+dGFzay5fc291cmNlKS5zY29wZTtcblx0XHRpZiAoc2NvcGUgIT09IFRhc2tTY29wZS5HbG9iYWwpIHtcblx0XHRcdHZhcmlhYmxlcy5hZGQoJyR7d29ya3NwYWNlRm9sZGVyfScpO1xuXHRcdH1cblx0XHRpZiAoY29tbWFuZC5vcHRpb25zKSB7XG5cdFx0XHRjb25zdCBvcHRpb25zID0gY29tbWFuZC5vcHRpb25zO1xuXHRcdFx0aWYgKG9wdGlvbnMuY3dkKSB7XG5cdFx0XHRcdHRoaXMuX2NvbGxlY3RWYXJpYWJsZXModmFyaWFibGVzLCBvcHRpb25zLmN3ZCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBvcHRpb25zRW52ID0gb3B0aW9ucy5lbnY7XG5cdFx0XHRpZiAob3B0aW9uc0Vudikge1xuXHRcdFx0XHRPYmplY3Qua2V5cyhvcHRpb25zRW52KS5mb3JFYWNoKChrZXkpID0+IHtcblx0XHRcdFx0XHRjb25zdCB2YWx1ZTogYW55ID0gb3B0aW9uc0VudltrZXldO1xuXHRcdFx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyh2YWx1ZSkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2NvbGxlY3RWYXJpYWJsZXModmFyaWFibGVzLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGlmIChvcHRpb25zLnNoZWxsKSB7XG5cdFx0XHRcdGlmIChvcHRpb25zLnNoZWxsLmV4ZWN1dGFibGUpIHtcblx0XHRcdFx0XHR0aGlzLl9jb2xsZWN0VmFyaWFibGVzKHZhcmlhYmxlcywgb3B0aW9ucy5zaGVsbC5leGVjdXRhYmxlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRvcHRpb25zLnNoZWxsLmFyZ3M/LmZvckVhY2goYXJnID0+IHRoaXMuX2NvbGxlY3RWYXJpYWJsZXModmFyaWFibGVzLCBhcmcpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9jb2xsZWN0TWF0Y2hlclZhcmlhYmxlcyh2YXJpYWJsZXM6IFNldDxzdHJpbmc+LCB2YWx1ZXM6IEFycmF5PHN0cmluZyB8IFByb2JsZW1NYXRjaGVyPiB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICh2YWx1ZXMgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZXMgPT09IG51bGwgfHwgdmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YWx1ZXMuZm9yRWFjaCgodmFsdWUpID0+IHtcblx0XHRcdGxldCBtYXRjaGVyOiBQcm9ibGVtTWF0Y2hlcjtcblx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyh2YWx1ZSkpIHtcblx0XHRcdFx0aWYgKHZhbHVlWzBdID09PSAnJCcpIHtcblx0XHRcdFx0XHRtYXRjaGVyID0gUHJvYmxlbU1hdGNoZXJSZWdpc3RyeS5nZXQodmFsdWUuc3Vic3RyaW5nKDEpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtYXRjaGVyID0gUHJvYmxlbU1hdGNoZXJSZWdpc3RyeS5nZXQodmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtYXRjaGVyID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAobWF0Y2hlciAmJiBtYXRjaGVyLmZpbGVQcmVmaXgpIHtcblx0XHRcdFx0aWYgKFR5cGVzLmlzU3RyaW5nKG1hdGNoZXIuZmlsZVByZWZpeCkpIHtcblx0XHRcdFx0XHR0aGlzLl9jb2xsZWN0VmFyaWFibGVzKHZhcmlhYmxlcywgbWF0Y2hlci5maWxlUHJlZml4KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGZwIG9mIFsuLi5hc0FycmF5KG1hdGNoZXIuZmlsZVByZWZpeC5pbmNsdWRlIHx8IFtdKSwgLi4uYXNBcnJheShtYXRjaGVyLmZpbGVQcmVmaXguZXhjbHVkZSB8fCBbXSldKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9jb2xsZWN0VmFyaWFibGVzKHZhcmlhYmxlcywgZnApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29sbGVjdFZhcmlhYmxlcyh2YXJpYWJsZXM6IFNldDxzdHJpbmc+LCB2YWx1ZTogc3RyaW5nIHwgQ29tbWFuZFN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHN0cmluZzogc3RyaW5nID0gVHlwZXMuaXNTdHJpbmcodmFsdWUpID8gdmFsdWUgOiB2YWx1ZS52YWx1ZTtcblx0XHRjb25zdCByID0gL1xcJFxceyguKj8pXFx9L2c7XG5cdFx0bGV0IG1hdGNoZXM6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG5cdFx0ZG8ge1xuXHRcdFx0bWF0Y2hlcyA9IHIuZXhlYyhzdHJpbmcpO1xuXHRcdFx0aWYgKG1hdGNoZXMpIHtcblx0XHRcdFx0dmFyaWFibGVzLmFkZChtYXRjaGVzWzBdKTtcblx0XHRcdH1cblx0XHR9IHdoaWxlIChtYXRjaGVzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVDb21tYW5kQW5kQXJncyhyZXNvbHZlcjogVmFyaWFibGVSZXNvbHZlciwgY29tbWFuZENvbmZpZzogSUNvbW1hbmRDb25maWd1cmF0aW9uKTogUHJvbWlzZTx7IGNvbW1hbmQ6IENvbW1hbmRTdHJpbmc7IGFyZ3M6IENvbW1hbmRTdHJpbmdbXSB9PiB7XG5cdFx0Ly8gRmlyc3Qgd2UgbmVlZCB0byB1c2UgdGhlIGNvbW1hbmQgYXJnczpcblx0XHRsZXQgYXJnczogQ29tbWFuZFN0cmluZ1tdID0gY29tbWFuZENvbmZpZy5hcmdzID8gY29tbWFuZENvbmZpZy5hcmdzLnNsaWNlKCkgOiBbXTtcblx0XHRhcmdzID0gYXdhaXQgdGhpcy5fcmVzb2x2ZVZhcmlhYmxlcyhyZXNvbHZlciwgYXJncyk7XG5cdFx0Y29uc3QgY29tbWFuZDogQ29tbWFuZFN0cmluZyA9IGF3YWl0IHRoaXMuX3Jlc29sdmVWYXJpYWJsZShyZXNvbHZlciwgY29tbWFuZENvbmZpZy5uYW1lKTtcblx0XHRyZXR1cm4geyBjb21tYW5kLCBhcmdzIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXNvbHZlVmFyaWFibGVzKHJlc29sdmVyOiBWYXJpYWJsZVJlc29sdmVyLCB2YWx1ZTogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZ1tdPjtcblx0cHJpdmF0ZSBhc3luYyBfcmVzb2x2ZVZhcmlhYmxlcyhyZXNvbHZlcjogVmFyaWFibGVSZXNvbHZlciwgdmFsdWU6IENvbW1hbmRTdHJpbmdbXSk6IFByb21pc2U8Q29tbWFuZFN0cmluZ1tdPjtcblx0cHJpdmF0ZSBhc3luYyBfcmVzb2x2ZVZhcmlhYmxlcyhyZXNvbHZlcjogVmFyaWFibGVSZXNvbHZlciwgdmFsdWU6IENvbW1hbmRTdHJpbmdbXSk6IFByb21pc2U8Q29tbWFuZFN0cmluZ1tdPiB7XG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKHZhbHVlLm1hcChzID0+IHRoaXMuX3Jlc29sdmVWYXJpYWJsZShyZXNvbHZlciwgcykpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVNYXRjaGVycyhyZXNvbHZlcjogVmFyaWFibGVSZXNvbHZlciwgdmFsdWVzOiBBcnJheTxzdHJpbmcgfCBQcm9ibGVtTWF0Y2hlcj4gfCB1bmRlZmluZWQpOiBQcm9taXNlPFByb2JsZW1NYXRjaGVyW10+IHtcblx0XHRpZiAodmFsdWVzID09PSB1bmRlZmluZWQgfHwgdmFsdWVzID09PSBudWxsIHx8IHZhbHVlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiBQcm9ibGVtTWF0Y2hlcltdID0gW107XG5cdFx0Zm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcblx0XHRcdGxldCBtYXRjaGVyOiBQcm9ibGVtTWF0Y2hlcjtcblx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyh2YWx1ZSkpIHtcblx0XHRcdFx0aWYgKHZhbHVlWzBdID09PSAnJCcpIHtcblx0XHRcdFx0XHRtYXRjaGVyID0gUHJvYmxlbU1hdGNoZXJSZWdpc3RyeS5nZXQodmFsdWUuc3Vic3RyaW5nKDEpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtYXRjaGVyID0gUHJvYmxlbU1hdGNoZXJSZWdpc3RyeS5nZXQodmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtYXRjaGVyID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIW1hdGNoZXIpIHtcblx0XHRcdFx0dGhpcy5fYXBwZW5kT3V0cHV0KG5scy5sb2NhbGl6ZSgndW5rbm93blByb2JsZW1NYXRjaGVyJywgJ1Byb2JsZW0gbWF0Y2hlciB7MH0gY2FuXFwndCBiZSByZXNvbHZlZC4gVGhlIG1hdGNoZXIgd2lsbCBiZSBpZ25vcmVkJykpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHRhc2tTeXN0ZW1JbmZvOiBJVGFza1N5c3RlbUluZm8gfCB1bmRlZmluZWQgPSByZXNvbHZlci50YXNrU3lzdGVtSW5mbztcblx0XHRcdGNvbnN0IGhhc0ZpbGVQcmVmaXggPSBtYXRjaGVyLmZpbGVQcmVmaXggIT09IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGhhc1VyaVByb3ZpZGVyID0gdGFza1N5c3RlbUluZm8gIT09IHVuZGVmaW5lZCAmJiB0YXNrU3lzdGVtSW5mby51cmlQcm92aWRlciAhPT0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKCFoYXNGaWxlUHJlZml4ICYmICFoYXNVcmlQcm92aWRlcikge1xuXHRcdFx0XHRyZXN1bHQucHVzaChtYXRjaGVyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGNvcHkgPSBPYmplY3RzLmRlZXBDbG9uZShtYXRjaGVyKTtcblx0XHRcdFx0aWYgKGhhc1VyaVByb3ZpZGVyICYmICh0YXNrU3lzdGVtSW5mbyAhPT0gdW5kZWZpbmVkKSkge1xuXHRcdFx0XHRcdGNvcHkudXJpUHJvdmlkZXIgPSB0YXNrU3lzdGVtSW5mby51cmlQcm92aWRlcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaGFzRmlsZVByZWZpeCkge1xuXHRcdFx0XHRcdGNvbnN0IGZpbGVQcmVmaXggPSBjb3B5LmZpbGVQcmVmaXg7XG5cdFx0XHRcdFx0aWYgKFR5cGVzLmlzU3RyaW5nKGZpbGVQcmVmaXgpKSB7XG5cdFx0XHRcdFx0XHRjb3B5LmZpbGVQcmVmaXggPSBhd2FpdCB0aGlzLl9yZXNvbHZlVmFyaWFibGUocmVzb2x2ZXIsIGZpbGVQcmVmaXgpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoZmlsZVByZWZpeCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRpZiAoZmlsZVByZWZpeC5pbmNsdWRlKSB7XG5cdFx0XHRcdFx0XHRcdGZpbGVQcmVmaXguaW5jbHVkZSA9IEFycmF5LmlzQXJyYXkoZmlsZVByZWZpeC5pbmNsdWRlKVxuXHRcdFx0XHRcdFx0XHRcdD8gYXdhaXQgUHJvbWlzZS5hbGwoZmlsZVByZWZpeC5pbmNsdWRlLm1hcCh4ID0+IHRoaXMuX3Jlc29sdmVWYXJpYWJsZShyZXNvbHZlciwgeCkpKVxuXHRcdFx0XHRcdFx0XHRcdDogYXdhaXQgdGhpcy5fcmVzb2x2ZVZhcmlhYmxlKHJlc29sdmVyLCBmaWxlUHJlZml4LmluY2x1ZGUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGZpbGVQcmVmaXguZXhjbHVkZSkge1xuXHRcdFx0XHRcdFx0XHRmaWxlUHJlZml4LmV4Y2x1ZGUgPSBBcnJheS5pc0FycmF5KGZpbGVQcmVmaXguZXhjbHVkZSlcblx0XHRcdFx0XHRcdFx0XHQ/IGF3YWl0IFByb21pc2UuYWxsKGZpbGVQcmVmaXguZXhjbHVkZS5tYXAoeCA9PiB0aGlzLl9yZXNvbHZlVmFyaWFibGUocmVzb2x2ZXIsIHgpKSlcblx0XHRcdFx0XHRcdFx0XHQ6IGF3YWl0IHRoaXMuX3Jlc29sdmVWYXJpYWJsZShyZXNvbHZlciwgZmlsZVByZWZpeC5leGNsdWRlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzdWx0LnB1c2goY29weSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXNvbHZlVmFyaWFibGUocmVzb2x2ZXI6IFZhcmlhYmxlUmVzb2x2ZXIsIHZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPHN0cmluZz47XG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVWYXJpYWJsZShyZXNvbHZlcjogVmFyaWFibGVSZXNvbHZlciwgdmFsdWU6IENvbW1hbmRTdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPENvbW1hbmRTdHJpbmc+O1xuXHRwcml2YXRlIGFzeW5jIF9yZXNvbHZlVmFyaWFibGUocmVzb2x2ZXI6IFZhcmlhYmxlUmVzb2x2ZXIsIHZhbHVlOiBDb21tYW5kU3RyaW5nIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxDb21tYW5kU3RyaW5nPiB7XG5cdFx0Ly8gVE9ET0BEaXJrIFRhc2suZ2V0V29ya3NwYWNlRm9sZGVyIHNob3VsZCByZXR1cm4gYSBXb3Jrc3BhY2VGb2xkZXIgdGhhdCBpcyBkZWZpbmVkIGluIHdvcmtzcGFjZS50c1xuXHRcdGlmIChUeXBlcy5pc1N0cmluZyh2YWx1ZSkpIHtcblx0XHRcdHJldHVybiByZXNvbHZlci5yZXNvbHZlKHZhbHVlKTtcblx0XHR9IGVsc2UgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHZhbHVlOiBhd2FpdCByZXNvbHZlci5yZXNvbHZlKHZhbHVlLnZhbHVlKSxcblx0XHRcdFx0cXVvdGluZzogdmFsdWUucXVvdGluZ1xuXHRcdFx0fTtcblx0XHR9IGVsc2UgeyAvLyBUaGlzIHNob3VsZCBuZXZlciBoYXBwZW5cblx0XHRcdHRocm93IG5ldyBFcnJvcignU2hvdWxkIG5ldmVyIHRyeSB0byByZXNvbHZlIHVuZGVmaW5lZC4nKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXNvbHZlT3B0aW9ucyhyZXNvbHZlcjogVmFyaWFibGVSZXNvbHZlciwgb3B0aW9uczogQ29tbWFuZE9wdGlvbnMgfCB1bmRlZmluZWQpOiBQcm9taXNlPENvbW1hbmRPcHRpb25zPiB7XG5cdFx0aWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZCB8fCBvcHRpb25zID09PSBudWxsKSB7XG5cdFx0XHRsZXQgY3dkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjd2QgPSBhd2FpdCB0aGlzLl9yZXNvbHZlVmFyaWFibGUocmVzb2x2ZXIsICcke3dvcmtzcGFjZUZvbGRlcn0nKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Ly8gTm8gd29ya3NwYWNlXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4geyBjd2QgfTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiBDb21tYW5kT3B0aW9ucyA9IFR5cGVzLmlzU3RyaW5nKG9wdGlvbnMuY3dkKVxuXHRcdFx0PyB7IGN3ZDogYXdhaXQgdGhpcy5fcmVzb2x2ZVZhcmlhYmxlKHJlc29sdmVyLCBvcHRpb25zLmN3ZCkgfVxuXHRcdFx0OiB7IGN3ZDogYXdhaXQgdGhpcy5fcmVzb2x2ZVZhcmlhYmxlKHJlc29sdmVyLCAnJHt3b3Jrc3BhY2VGb2xkZXJ9JykgfTtcblx0XHRpZiAob3B0aW9ucy5lbnYpIHtcblx0XHRcdHJlc3VsdC5lbnYgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob3B0aW9ucy5lbnYpKSB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlOiBhbnkgPSBvcHRpb25zLmVudltrZXldO1xuXHRcdFx0XHRpZiAoVHlwZXMuaXNTdHJpbmcodmFsdWUpKSB7XG5cdFx0XHRcdFx0cmVzdWx0LmVudiFba2V5XSA9IGF3YWl0IHRoaXMuX3Jlc29sdmVWYXJpYWJsZShyZXNvbHZlciwgdmFsdWUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdC5lbnYhW2tleV0gPSB2YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRzdGF0aWMgV2VsbEtub3duQ29tbWFuZHM6IElTdHJpbmdEaWN0aW9uYXJ5PGJvb2xlYW4+ID0ge1xuXHRcdCdhbnQnOiB0cnVlLFxuXHRcdCdjbWFrZSc6IHRydWUsXG5cdFx0J2VzbGludCc6IHRydWUsXG5cdFx0J2dyYWRsZSc6IHRydWUsXG5cdFx0J2dydW50JzogdHJ1ZSxcblx0XHQnZ3VscCc6IHRydWUsXG5cdFx0J2pha2UnOiB0cnVlLFxuXHRcdCdqZW5raW5zJzogdHJ1ZSxcblx0XHQnanNoaW50JzogdHJ1ZSxcblx0XHQnbWFrZSc6IHRydWUsXG5cdFx0J21hdmVuJzogdHJ1ZSxcblx0XHQnbXNidWlsZCc6IHRydWUsXG5cdFx0J21zYyc6IHRydWUsXG5cdFx0J25tYWtlJzogdHJ1ZSxcblx0XHQnbnBtJzogdHJ1ZSxcblx0XHQncmFrZSc6IHRydWUsXG5cdFx0J3RzYyc6IHRydWUsXG5cdFx0J3hidWlsZCc6IHRydWVcblx0fTtcblxuXHRwdWJsaWMgZ2V0U2FuaXRpemVkQ29tbWFuZChjbWQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0bGV0IHJlc3VsdCA9IGNtZC50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IGluZGV4ID0gcmVzdWx0Lmxhc3RJbmRleE9mKHBhdGguc2VwKTtcblx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRyZXN1bHQgPSByZXN1bHQuc3Vic3RyaW5nKGluZGV4ICsgMSk7XG5cdFx0fVxuXHRcdGlmIChUZXJtaW5hbFRhc2tTeXN0ZW0uV2VsbEtub3duQ29tbWFuZHNbcmVzdWx0XSkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cdFx0cmV0dXJuICdvdGhlcic7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VGFza0ZvclRlcm1pbmFsKGluc3RhbmNlSWQ6IG51bWJlcik6IFRhc2sgfCB1bmRlZmluZWQge1xuXHRcdGZvciAoY29uc3Qga2V5IGluIHRoaXMuX2FjdGl2ZVRhc2tzKSB7XG5cdFx0XHRjb25zdCBhY3RpdmVUYXNrID0gdGhpcy5fYWN0aXZlVGFza3Nba2V5XTtcblx0XHRcdGlmIChhY3RpdmVUYXNrLnRlcm1pbmFsPy5pbnN0YW5jZUlkID09PSBpbnN0YW5jZUlkKSB7XG5cdFx0XHRcdHJldHVybiBhY3RpdmVUYXNrLnRhc2s7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9hcHBlbmRPdXRwdXQob3V0cHV0OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBvdXRwdXRDaGFubmVsID0gdGhpcy5fb3V0cHV0U2VydmljZS5nZXRDaGFubmVsKHRoaXMuX291dHB1dENoYW5uZWxJZCk7XG5cdFx0b3V0cHV0Q2hhbm5lbD8uYXBwZW5kKG91dHB1dCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0V2FpdE9uRXhpdFZhbHVlKHByZXNlbnRhdGlvbk9wdGlvbnM6IElQcmVzZW50YXRpb25PcHRpb25zLCBjb25maWd1cmF0aW9uUHJvcGVydGllczogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKSB7XG5cdGlmICgocHJlc2VudGF0aW9uT3B0aW9ucy5jbG9zZSA9PT0gdW5kZWZpbmVkKSB8fCAocHJlc2VudGF0aW9uT3B0aW9ucy5jbG9zZSA9PT0gZmFsc2UpKSB7XG5cdFx0aWYgKChwcmVzZW50YXRpb25PcHRpb25zLnJldmVhbCAhPT0gUmV2ZWFsS2luZC5OZXZlcikgfHwgIWNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlzQmFja2dyb3VuZCB8fCAocHJlc2VudGF0aW9uT3B0aW9ucy5jbG9zZSA9PT0gZmFsc2UpKSB7XG5cdFx0XHRpZiAocHJlc2VudGF0aW9uT3B0aW9ucy5wYW5lbCA9PT0gUGFuZWxLaW5kLk5ldykge1xuXHRcdFx0XHRyZXR1cm4gdGFza1NoZWxsSW50ZWdyYXRpb25XYWl0T25FeGl0U2VxdWVuY2UobmxzLmxvY2FsaXplKCdjbG9zZVRlcm1pbmFsJywgJ1ByZXNzIGFueSBrZXkgdG8gY2xvc2UgdGhlIHRlcm1pbmFsLicpKTtcblx0XHRcdH0gZWxzZSBpZiAocHJlc2VudGF0aW9uT3B0aW9ucy5zaG93UmV1c2VNZXNzYWdlKSB7XG5cdFx0XHRcdHJldHVybiB0YXNrU2hlbGxJbnRlZ3JhdGlvbldhaXRPbkV4aXRTZXF1ZW5jZShubHMubG9jYWxpemUoJ3JldXNlVGVybWluYWwnLCAnVGVybWluYWwgd2lsbCBiZSByZXVzZWQgYnkgdGFza3MsIHByZXNzIGFueSBrZXkgdG8gY2xvc2UgaXQuJykpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiAhcHJlc2VudGF0aW9uT3B0aW9ucy5jbG9zZTtcbn1cblxuZnVuY3Rpb24gdGFza1NoZWxsSW50ZWdyYXRpb25XYWl0T25FeGl0U2VxdWVuY2UobWVzc2FnZTogc3RyaW5nKTogKGV4aXRDb2RlOiBudW1iZXIpID0+IHN0cmluZyB7XG5cdHJldHVybiAoZXhpdENvZGUpID0+IHtcblx0XHRyZXR1cm4gYCR7VlNDb2RlU2VxdWVuY2UoVlNDb2RlT3NjUHQuQ29tbWFuZEZpbmlzaGVkLCBleGl0Q29kZS50b1N0cmluZygpKX0ke21lc3NhZ2V9YDtcblx0fTtcbn1cblxuZnVuY3Rpb24gZ2V0UmVjb25uZWN0aW9uRGF0YSh0ZXJtaW5hbDogSVRlcm1pbmFsSW5zdGFuY2UpOiBJUmVjb25uZWN0aW9uVGFza0RhdGEgfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gdGVybWluYWwuc2hlbGxMYXVuY2hDb25maWcuYXR0YWNoUGVyc2lzdGVudFByb2Nlc3M/LnJlY29ubmVjdGlvblByb3BlcnRpZXM/LmRhdGEgYXMgSVJlY29ubmVjdGlvblRhc2tEYXRhIHwgdW5kZWZpbmVkO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxlQUFlO0FBQ3hCLFlBQVksV0FBVztBQUV2QixTQUFTLGVBQXNCO0FBQy9CLFNBQVMsYUFB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
