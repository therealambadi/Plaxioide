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
import { URI } from "../../../base/common/uri.js";
import { asPromise } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { MainContext } from "./extHost.protocol.js";
import * as types from "./extHostTypes.js";
import { IExtHostWorkspace } from "./extHostWorkspace.js";
import { IExtHostDocumentsAndEditors } from "./extHostDocumentsAndEditors.js";
import { IExtHostConfiguration } from "./extHostConfiguration.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { IExtHostTerminalService } from "./extHostTerminalService.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { Schemas } from "../../../base/common/network.js";
import * as Platform from "../../../base/common/platform.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IExtHostApiDeprecationService } from "./extHostApiDeprecationService.js";
import { USER_TASKS_GROUP_KEY } from "../../contrib/tasks/common/tasks.js";
import { ErrorNoTelemetry, NotSupportedError } from "../../../base/common/errors.js";
import { asArray } from "../../../base/common/arrays.js";
var TaskDefinitionDTO;
((TaskDefinitionDTO2) => {
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return value;
  }
  TaskDefinitionDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return value;
  }
  TaskDefinitionDTO2.to = to;
})(TaskDefinitionDTO || (TaskDefinitionDTO = {}));
var TaskPresentationOptionsDTO;
((TaskPresentationOptionsDTO2) => {
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return value;
  }
  TaskPresentationOptionsDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return value;
  }
  TaskPresentationOptionsDTO2.to = to;
})(TaskPresentationOptionsDTO || (TaskPresentationOptionsDTO = {}));
var ProcessExecutionOptionsDTO;
((ProcessExecutionOptionsDTO2) => {
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return value;
  }
  ProcessExecutionOptionsDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return value;
  }
  ProcessExecutionOptionsDTO2.to = to;
})(ProcessExecutionOptionsDTO || (ProcessExecutionOptionsDTO = {}));
var ProcessExecutionDTO;
((ProcessExecutionDTO2) => {
  function is(value) {
    if (value) {
      const candidate = value;
      return candidate && !!candidate.process;
    } else {
      return false;
    }
  }
  ProcessExecutionDTO2.is = is;
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    const result = {
      process: value.process,
      args: value.args
    };
    if (value.options) {
      result.options = ProcessExecutionOptionsDTO.from(value.options);
    }
    return result;
  }
  ProcessExecutionDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return new types.ProcessExecution(value.process, value.args, value.options);
  }
  ProcessExecutionDTO2.to = to;
})(ProcessExecutionDTO || (ProcessExecutionDTO = {}));
var ShellExecutionOptionsDTO;
((ShellExecutionOptionsDTO2) => {
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return value;
  }
  ShellExecutionOptionsDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return value;
  }
  ShellExecutionOptionsDTO2.to = to;
})(ShellExecutionOptionsDTO || (ShellExecutionOptionsDTO = {}));
var ShellExecutionDTO;
((ShellExecutionDTO2) => {
  function is(value) {
    if (value) {
      const candidate = value;
      return candidate && (!!candidate.commandLine || !!candidate.command);
    } else {
      return false;
    }
  }
  ShellExecutionDTO2.is = is;
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    const result = {};
    if (value.commandLine !== void 0) {
      result.commandLine = value.commandLine;
    } else {
      result.command = value.command;
      result.args = value.args;
    }
    if (value.options) {
      result.options = ShellExecutionOptionsDTO.from(value.options);
    }
    return result;
  }
  ShellExecutionDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null || value.command === void 0 && value.commandLine === void 0) {
      return void 0;
    }
    if (value.commandLine) {
      return new types.ShellExecution(value.commandLine, value.options);
    } else {
      return new types.ShellExecution(value.command, value.args ? value.args : [], value.options);
    }
  }
  ShellExecutionDTO2.to = to;
})(ShellExecutionDTO || (ShellExecutionDTO = {}));
var CustomExecutionDTO;
((CustomExecutionDTO2) => {
  function is(value) {
    if (value) {
      const candidate = value;
      return candidate && candidate.customExecution === "customExecution";
    } else {
      return false;
    }
  }
  CustomExecutionDTO2.is = is;
  function from(value) {
    return {
      customExecution: "customExecution"
    };
  }
  CustomExecutionDTO2.from = from;
  function to(taskId, providedCustomExeutions) {
    return providedCustomExeutions.get(taskId);
  }
  CustomExecutionDTO2.to = to;
})(CustomExecutionDTO || (CustomExecutionDTO = {}));
var TaskHandleDTO;
((TaskHandleDTO2) => {
  function from(value, workspaceService) {
    let folder;
    if (value.scope !== void 0 && typeof value.scope !== "number") {
      folder = value.scope.uri;
    } else if (value.scope !== void 0 && typeof value.scope === "number") {
      if (value.scope === types.TaskScope.Workspace && workspaceService && workspaceService.workspaceFile) {
        folder = workspaceService.workspaceFile;
      } else {
        folder = USER_TASKS_GROUP_KEY;
      }
    }
    return {
      id: value._id,
      workspaceFolder: folder
    };
  }
  TaskHandleDTO2.from = from;
})(TaskHandleDTO || (TaskHandleDTO = {}));
var TaskGroupDTO;
((TaskGroupDTO2) => {
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return { _id: value.id, isDefault: value.isDefault };
  }
  TaskGroupDTO2.from = from;
})(TaskGroupDTO || (TaskGroupDTO = {}));
var TaskDTO;
((TaskDTO2) => {
  function fromMany(tasks2, extension) {
    if (tasks2 === void 0 || tasks2 === null) {
      return [];
    }
    const result = [];
    for (const task of tasks2) {
      const converted = from(task, extension);
      if (converted) {
        result.push(converted);
      }
    }
    return result;
  }
  TaskDTO2.fromMany = fromMany;
  function from(value, extension) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    let execution;
    if (value.execution instanceof types.ProcessExecution) {
      execution = ProcessExecutionDTO.from(value.execution);
    } else if (value.execution instanceof types.ShellExecution) {
      execution = ShellExecutionDTO.from(value.execution);
    } else if (value.execution && value.execution instanceof types.CustomExecution) {
      execution = CustomExecutionDTO.from(value.execution);
    }
    const definition = TaskDefinitionDTO.from(value.definition);
    let scope;
    if (value.scope) {
      if (typeof value.scope === "number") {
        scope = value.scope;
      } else {
        scope = value.scope.uri;
      }
    } else {
      scope = types.TaskScope.Workspace;
    }
    if (!definition || !scope) {
      return void 0;
    }
    const result = {
      _id: value._id,
      definition,
      name: value.name,
      source: {
        extensionId: extension.identifier.value,
        label: value.source,
        scope
      },
      execution,
      isBackground: value.isBackground,
      group: TaskGroupDTO.from(value.group),
      presentationOptions: TaskPresentationOptionsDTO.from(value.presentationOptions),
      problemMatchers: asArray(value.problemMatchers),
      hasDefinedMatchers: value.hasDefinedMatchers,
      runOptions: value.runOptions ? value.runOptions : { reevaluateOnRerun: true },
      detail: value.detail
    };
    return result;
  }
  TaskDTO2.from = from;
  async function to(value, workspace, providedCustomExeutions) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    let execution;
    if (ProcessExecutionDTO.is(value.execution)) {
      execution = ProcessExecutionDTO.to(value.execution);
    } else if (ShellExecutionDTO.is(value.execution)) {
      execution = ShellExecutionDTO.to(value.execution);
    } else if (CustomExecutionDTO.is(value.execution)) {
      execution = CustomExecutionDTO.to(value._id, providedCustomExeutions);
    }
    const definition = TaskDefinitionDTO.to(value.definition);
    let scope;
    if (value.source) {
      if (value.source.scope !== void 0) {
        if (typeof value.source.scope === "number") {
          scope = value.source.scope;
        } else {
          scope = await workspace.resolveWorkspaceFolder(URI.revive(value.source.scope));
        }
      } else {
        scope = types.TaskScope.Workspace;
      }
    }
    if (!definition || !scope) {
      return void 0;
    }
    const result = new types.Task(definition, scope, value.name, value.source.label, execution, value.problemMatchers);
    if (value.isBackground !== void 0) {
      result.isBackground = value.isBackground;
    }
    if (value.group !== void 0) {
      result.group = types.TaskGroup.from(value.group._id);
      if (result.group && value.group.isDefault) {
        result.group = new types.TaskGroup(result.group.id, result.group.label);
        if (value.group.isDefault === true) {
          result.group.isDefault = value.group.isDefault;
        }
      }
    }
    if (value.presentationOptions) {
      result.presentationOptions = TaskPresentationOptionsDTO.to(value.presentationOptions);
    }
    if (value._id) {
      result._id = value._id;
    }
    if (value.detail) {
      result.detail = value.detail;
    }
    return result;
  }
  TaskDTO2.to = to;
})(TaskDTO || (TaskDTO = {}));
var TaskFilterDTO;
((TaskFilterDTO2) => {
  function from(value) {
    return value;
  }
  TaskFilterDTO2.from = from;
  function to(value) {
    if (!value) {
      return void 0;
    }
    return Object.assign(/* @__PURE__ */ Object.create(null), value);
  }
  TaskFilterDTO2.to = to;
})(TaskFilterDTO || (TaskFilterDTO = {}));
class TaskExecutionImpl {
  constructor(tasks2, _id, _task) {
    this._id = _id;
    this._task = _task;
    this.#tasks = tasks2;
  }
  #tasks;
  get task() {
    return this._task;
  }
  terminate() {
    this.#tasks.terminateTask(this);
  }
  fireDidStartProcess(value) {
  }
  fireDidEndProcess(value) {
  }
}
let ExtHostTaskBase = class {
  constructor(extHostRpc, initData, workspaceService, editorService, configurationService, extHostTerminalService, logService, deprecationService) {
    this._onDidExecuteTask = new Emitter();
    this._onDidTerminateTask = new Emitter();
    this._onDidTaskProcessStarted = new Emitter();
    this._onDidTaskProcessEnded = new Emitter();
    this._onDidStartTaskProblemMatchers = new Emitter();
    this._onDidEndTaskProblemMatchers = new Emitter();
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadTask);
    this._workspaceProvider = workspaceService;
    this._editorService = editorService;
    this._configurationService = configurationService;
    this._terminalService = extHostTerminalService;
    this._handleCounter = 0;
    this._handlers = /* @__PURE__ */ new Map();
    this._taskExecutions = /* @__PURE__ */ new Map();
    this._taskExecutionPromises = /* @__PURE__ */ new Map();
    this._providedCustomExecutions2 = /* @__PURE__ */ new Map();
    this._notProvidedCustomExecutions = /* @__PURE__ */ new Set();
    this._activeCustomExecutions2 = /* @__PURE__ */ new Map();
    this._logService = logService;
    this._deprecationService = deprecationService;
    this._proxy.$registerSupportedExecutions(true);
  }
  registerTaskProvider(extension, type, provider) {
    if (!provider) {
      return new types.Disposable(() => {
      });
    }
    const handle = this.nextHandle();
    this._handlers.set(handle, { type, provider, extension });
    this._proxy.$registerTaskProvider(handle, type);
    return new types.Disposable(() => {
      this._handlers.delete(handle);
      this._proxy.$unregisterTaskProvider(handle);
    });
  }
  registerTaskSystem(scheme, info) {
    this._proxy.$registerTaskSystem(scheme, info);
  }
  fetchTasks(filter) {
    return this._proxy.$fetchTasks(TaskFilterDTO.from(filter)).then(async (values) => {
      const result = [];
      for (const value of values) {
        const task = await TaskDTO.to(value, this._workspaceProvider, this._providedCustomExecutions2);
        if (task) {
          result.push(task);
        }
      }
      return result;
    });
  }
  get taskExecutions() {
    const result = [];
    this._taskExecutions.forEach((value) => result.push(value));
    return result;
  }
  terminateTask(execution) {
    if (!(execution instanceof TaskExecutionImpl)) {
      throw new Error("No valid task execution provided");
    }
    return this._proxy.$terminateTask(execution._id);
  }
  get onDidStartTask() {
    return this._onDidExecuteTask.event;
  }
  async $onDidStartTask(execution, terminalId, resolvedDefinition) {
    const customExecution = this._providedCustomExecutions2.get(execution.id);
    if (customExecution) {
      this._activeCustomExecutions2.set(execution.id, customExecution);
      this._terminalService.attachPtyToTerminal(terminalId, await customExecution.callback(resolvedDefinition));
    }
    this._lastStartedTask = execution.id;
    this._onDidExecuteTask.fire({
      execution: await this.getTaskExecution(execution)
    });
  }
  get onDidEndTask() {
    return this._onDidTerminateTask.event;
  }
  async $OnDidEndTask(execution) {
    if (!this._taskExecutionPromises.has(execution.id)) {
      return;
    }
    const _execution = await this.getTaskExecution(execution);
    this._taskExecutionPromises.delete(execution.id);
    this._taskExecutions.delete(execution.id);
    this.customExecutionComplete(execution);
    this._onDidTerminateTask.fire({
      execution: _execution
    });
  }
  get onDidStartTaskProcess() {
    return this._onDidTaskProcessStarted.event;
  }
  async $onDidStartTaskProcess(value) {
    const execution = await this.getTaskExecution(value.id);
    this._onDidTaskProcessStarted.fire({
      execution,
      processId: value.processId
    });
  }
  get onDidEndTaskProcess() {
    return this._onDidTaskProcessEnded.event;
  }
  async $onDidEndTaskProcess(value) {
    const execution = await this.getTaskExecution(value.id);
    this._onDidTaskProcessEnded.fire({
      execution,
      exitCode: value.exitCode
    });
  }
  get onDidStartTaskProblemMatchers() {
    return this._onDidStartTaskProblemMatchers.event;
  }
  async $onDidStartTaskProblemMatchers(value) {
    let execution;
    try {
      execution = await this.getTaskExecution(value.execution.id);
    } catch (error) {
      return;
    }
    this._onDidStartTaskProblemMatchers.fire({ execution });
  }
  get onDidEndTaskProblemMatchers() {
    return this._onDidEndTaskProblemMatchers.event;
  }
  async $onDidEndTaskProblemMatchers(value) {
    let execution;
    try {
      execution = await this.getTaskExecution(value.execution.id);
    } catch (error) {
      return;
    }
    this._onDidEndTaskProblemMatchers.fire({ execution, hasErrors: value.hasErrors });
  }
  $provideTasks(handle, validTypes) {
    const handler = this._handlers.get(handle);
    if (!handler) {
      return Promise.reject(new Error("no handler found"));
    }
    const taskIdPromises = [];
    const fetchPromise = asPromise(() => handler.provider.provideTasks(CancellationToken.None)).then((value) => {
      return this.provideTasksInternal(validTypes, taskIdPromises, handler, value);
    });
    return new Promise((resolve) => {
      fetchPromise.then((result) => {
        Promise.all(taskIdPromises).then(() => {
          resolve(result);
        });
      });
    });
  }
  async $resolveTask(handle, taskDTO) {
    const handler = this._handlers.get(handle);
    if (!handler) {
      return Promise.reject(new Error("no handler found"));
    }
    if (taskDTO.definition.type !== handler.type) {
      throw new Error(`Unexpected: Task of type [${taskDTO.definition.type}] cannot be resolved by provider of type [${handler.type}].`);
    }
    const task = await TaskDTO.to(taskDTO, this._workspaceProvider, this._providedCustomExecutions2);
    if (!task) {
      throw new Error("Unexpected: Task cannot be resolved.");
    }
    const resolvedTask = await handler.provider.resolveTask(task, CancellationToken.None);
    if (!resolvedTask) {
      return;
    }
    this.checkDeprecation(resolvedTask, handler);
    const resolvedTaskDTO = TaskDTO.from(resolvedTask, handler.extension);
    if (!resolvedTaskDTO) {
      throw new Error("Unexpected: Task cannot be resolved.");
    }
    if (resolvedTask.definition !== task.definition) {
      throw new Error("Unexpected: The resolved task definition must be the same object as the original task definition. The task definition cannot be changed.");
    }
    if (CustomExecutionDTO.is(resolvedTaskDTO.execution)) {
      await this.addCustomExecution(resolvedTaskDTO, resolvedTask, true);
    }
    return await this.resolveTaskInternal(resolvedTaskDTO);
  }
  nextHandle() {
    return this._handleCounter++;
  }
  async addCustomExecution(taskDTO, task, isProvided) {
    const taskId = await this._proxy.$createTaskId(taskDTO);
    if (!isProvided && !this._providedCustomExecutions2.has(taskId)) {
      this._notProvidedCustomExecutions.add(taskId);
      this._activeCustomExecutions2.set(taskId, task.execution);
    }
    this._providedCustomExecutions2.set(taskId, task.execution);
  }
  async getTaskExecution(execution, task) {
    if (typeof execution === "string") {
      const taskExecution = this._taskExecutionPromises.get(execution);
      if (!taskExecution) {
        throw new ErrorNoTelemetry("Unexpected: The specified task is missing an execution");
      }
      return taskExecution;
    }
    const result = this._taskExecutionPromises.get(execution.id);
    if (result) {
      return result;
    }
    let executionPromise;
    if (!task) {
      executionPromise = TaskDTO.to(execution.task, this._workspaceProvider, this._providedCustomExecutions2).then((t) => {
        if (!t) {
          throw new ErrorNoTelemetry("Unexpected: Task does not exist.");
        }
        return new TaskExecutionImpl(this, execution.id, t);
      });
    } else {
      executionPromise = Promise.resolve(new TaskExecutionImpl(this, execution.id, task));
    }
    this._taskExecutionPromises.set(execution.id, executionPromise);
    return executionPromise.then((taskExecution) => {
      this._taskExecutions.set(execution.id, taskExecution);
      return taskExecution;
    });
  }
  checkDeprecation(task, handler) {
    const tTask = task;
    if (tTask._deprecated) {
      this._deprecationService.report("Task.constructor", handler.extension, "Use the Task constructor that takes a `scope` instead.");
    }
  }
  customExecutionComplete(execution) {
    const extensionCallback2 = this._activeCustomExecutions2.get(execution.id);
    if (extensionCallback2) {
      this._activeCustomExecutions2.delete(execution.id);
    }
    if (this._notProvidedCustomExecutions.has(execution.id) && this._lastStartedTask !== execution.id) {
      this._providedCustomExecutions2.delete(execution.id);
      this._notProvidedCustomExecutions.delete(execution.id);
    }
    const iterator = this._notProvidedCustomExecutions.values();
    let iteratorResult = iterator.next();
    while (!iteratorResult.done) {
      if (!this._activeCustomExecutions2.has(iteratorResult.value) && this._lastStartedTask !== iteratorResult.value) {
        this._providedCustomExecutions2.delete(iteratorResult.value);
        this._notProvidedCustomExecutions.delete(iteratorResult.value);
      }
      iteratorResult = iterator.next();
    }
  }
};
ExtHostTaskBase = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService),
  __decorateParam(2, IExtHostWorkspace),
  __decorateParam(3, IExtHostDocumentsAndEditors),
  __decorateParam(4, IExtHostConfiguration),
  __decorateParam(5, IExtHostTerminalService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IExtHostApiDeprecationService)
], ExtHostTaskBase);
let WorkerExtHostTask = class extends ExtHostTaskBase {
  constructor(extHostRpc, initData, workspaceService, editorService, configurationService, extHostTerminalService, logService, deprecationService) {
    super(extHostRpc, initData, workspaceService, editorService, configurationService, extHostTerminalService, logService, deprecationService);
    this.registerTaskSystem(Schemas.vscodeRemote, {
      scheme: Schemas.vscodeRemote,
      authority: "",
      platform: Platform.PlatformToString(Platform.Platform.Web)
    });
  }
  async executeTask(extension, task) {
    if (!task.execution) {
      throw new Error("Tasks to execute must include an execution");
    }
    const dto = TaskDTO.from(task, extension);
    if (dto === void 0) {
      throw new Error("Task is not valid");
    }
    if (CustomExecutionDTO.is(dto.execution)) {
      await this.addCustomExecution(dto, task, false);
    } else {
      throw new NotSupportedError();
    }
    const execution = await this.getTaskExecution(await this._proxy.$getTaskExecution(dto), task);
    this._proxy.$executeTask(dto).catch((error) => {
      throw new Error(error);
    });
    return execution;
  }
  provideTasksInternal(validTypes, taskIdPromises, handler, value) {
    const taskDTOs = [];
    if (value) {
      for (const task of value) {
        this.checkDeprecation(task, handler);
        if (!task.definition || !validTypes[task.definition.type]) {
          const source = task.source ? task.source : "No task source";
          this._logService.warn(`The task [${source}, ${task.name}] uses an undefined task type. The task will be ignored in the future.`);
        }
        const taskDTO = TaskDTO.from(task, handler.extension);
        if (taskDTO && CustomExecutionDTO.is(taskDTO.execution)) {
          taskDTOs.push(taskDTO);
          taskIdPromises.push(this.addCustomExecution(taskDTO, task, true));
        } else {
          this._logService.warn("Only custom execution tasks supported.");
        }
      }
    }
    return {
      tasks: taskDTOs,
      extension: handler.extension
    };
  }
  async resolveTaskInternal(resolvedTaskDTO) {
    if (CustomExecutionDTO.is(resolvedTaskDTO.execution)) {
      return resolvedTaskDTO;
    } else {
      this._logService.warn("Only custom execution tasks supported.");
    }
    return void 0;
  }
  async $resolveVariables(uriComponents, toResolve) {
    const result = {
      process: void 0,
      variables: /* @__PURE__ */ Object.create(null)
    };
    return result;
  }
  async $jsonTasksSupported() {
    return false;
  }
  async $findExecutable(command, cwd, paths) {
    return void 0;
  }
};
WorkerExtHostTask = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService),
  __decorateParam(2, IExtHostWorkspace),
  __decorateParam(3, IExtHostDocumentsAndEditors),
  __decorateParam(4, IExtHostConfiguration),
  __decorateParam(5, IExtHostTerminalService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IExtHostApiDeprecationService)
], WorkerExtHostTask);
const IExtHostTask = createDecorator("IExtHostTask");
export {
  CustomExecutionDTO,
  ExtHostTaskBase,
  IExtHostTask,
  TaskDTO,
  TaskHandleDTO,
  WorkerExtHostTask
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VGFzay50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbi8qIGVzbGludC1kaXNhYmxlIGxvY2FsL2NvZGUtbm8tbmF0aXZlLXByaXZhdGUgKi9cblxuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGFzUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuXG5pbXBvcnQgeyBNYWluQ29udGV4dCwgTWFpblRocmVhZFRhc2tTaGFwZSwgRXh0SG9zdFRhc2tTaGFwZSB9IGZyb20gJy4vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFdvcmtzcGFjZVByb3ZpZGVyLCBJRXh0SG9zdFdvcmtzcGFjZSB9IGZyb20gJy4vZXh0SG9zdFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0ICogYXMgdGFza3MgZnJvbSAnLi9zaGFyZWQvdGFza3MuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzIH0gZnJvbSAnLi9leHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuL2V4dEhvc3RDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RUZXJtaW5hbFNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RUZXJtaW5hbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RScGNTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0UnBjU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdEluaXREYXRhU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdEluaXREYXRhU2VydmljZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAqIGFzIFBsYXRmb3JtIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RBcGlEZXByZWNhdGlvblNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RBcGlEZXByZWNhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVVNFUl9UQVNLU19HUk9VUF9LRVkgfSBmcm9tICcuLi8uLi9jb250cmliL3Rhc2tzL2NvbW1vbi90YXNrcy5qcyc7XG5pbXBvcnQgeyBFcnJvck5vVGVsZW1ldHJ5LCBOb3RTdXBwb3J0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBhc0FycmF5IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IElUYXNrUHJvYmxlbU1hdGNoZXJTdGFydGVkRHRvLCBJVGFza1Byb2JsZW1NYXRjaGVyRW5kZWREdG8gfSBmcm9tICcuL3NoYXJlZC90YXNrcy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dEhvc3RUYXNrIGV4dGVuZHMgRXh0SG9zdFRhc2tTaGFwZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHRhc2tFeGVjdXRpb25zOiB2c2NvZGUuVGFza0V4ZWN1dGlvbltdO1xuXHRvbkRpZFN0YXJ0VGFzazogRXZlbnQ8dnNjb2RlLlRhc2tTdGFydEV2ZW50Pjtcblx0b25EaWRFbmRUYXNrOiBFdmVudDx2c2NvZGUuVGFza0VuZEV2ZW50Pjtcblx0b25EaWRTdGFydFRhc2tQcm9jZXNzOiBFdmVudDx2c2NvZGUuVGFza1Byb2Nlc3NTdGFydEV2ZW50Pjtcblx0b25EaWRFbmRUYXNrUHJvY2VzczogRXZlbnQ8dnNjb2RlLlRhc2tQcm9jZXNzRW5kRXZlbnQ+O1xuXHRvbkRpZFN0YXJ0VGFza1Byb2JsZW1NYXRjaGVyczogRXZlbnQ8dnNjb2RlLlRhc2tQcm9ibGVtTWF0Y2hlclN0YXJ0ZWRFdmVudD47XG5cdG9uRGlkRW5kVGFza1Byb2JsZW1NYXRjaGVyczogRXZlbnQ8dnNjb2RlLlRhc2tQcm9ibGVtTWF0Y2hlckVuZGVkRXZlbnQ+O1xuXG5cdHJlZ2lzdGVyVGFza1Byb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCB0eXBlOiBzdHJpbmcsIHByb3ZpZGVyOiB2c2NvZGUuVGFza1Byb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGU7XG5cdHJlZ2lzdGVyVGFza1N5c3RlbShzY2hlbWU6IHN0cmluZywgaW5mbzogdGFza3MuSVRhc2tTeXN0ZW1JbmZvRFRPKTogdm9pZDtcblx0ZmV0Y2hUYXNrcyhmaWx0ZXI/OiB2c2NvZGUuVGFza0ZpbHRlcik6IFByb21pc2U8dnNjb2RlLlRhc2tbXT47XG5cdGV4ZWN1dGVUYXNrKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCB0YXNrOiB2c2NvZGUuVGFzayk6IFByb21pc2U8dnNjb2RlLlRhc2tFeGVjdXRpb24+O1xuXHR0ZXJtaW5hdGVUYXNrKGV4ZWN1dGlvbjogdnNjb2RlLlRhc2tFeGVjdXRpb24pOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5uYW1lc3BhY2UgVGFza0RlZmluaXRpb25EVE8ge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogdnNjb2RlLlRhc2tEZWZpbml0aW9uKTogdGFza3MuSVRhc2tEZWZpbml0aW9uRFRPIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byh2YWx1ZTogdGFza3MuSVRhc2tEZWZpbml0aW9uRFRPKTogdnNjb2RlLlRhc2tEZWZpbml0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG59XG5cbm5hbWVzcGFjZSBUYXNrUHJlc2VudGF0aW9uT3B0aW9uc0RUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB2c2NvZGUuVGFza1ByZXNlbnRhdGlvbk9wdGlvbnMpOiB0YXNrcy5JVGFza1ByZXNlbnRhdGlvbk9wdGlvbnNEVE8gfCB1bmRlZmluZWQge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiB0YXNrcy5JVGFza1ByZXNlbnRhdGlvbk9wdGlvbnNEVE8pOiB2c2NvZGUuVGFza1ByZXNlbnRhdGlvbk9wdGlvbnMgfCB1bmRlZmluZWQge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cbn1cblxubmFtZXNwYWNlIFByb2Nlc3NFeGVjdXRpb25PcHRpb25zRFRPIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odmFsdWU6IHZzY29kZS5Qcm9jZXNzRXhlY3V0aW9uT3B0aW9ucyk6IHRhc2tzLklQcm9jZXNzRXhlY3V0aW9uT3B0aW9uc0RUTyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFsdWU6IHRhc2tzLklQcm9jZXNzRXhlY3V0aW9uT3B0aW9uc0RUTyk6IHZzY29kZS5Qcm9jZXNzRXhlY3V0aW9uT3B0aW9ucyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxufVxuXG5uYW1lc3BhY2UgUHJvY2Vzc0V4ZWN1dGlvbkRUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBpcyh2YWx1ZTogdGFza3MuSVNoZWxsRXhlY3V0aW9uRFRPIHwgdGFza3MuSVByb2Nlc3NFeGVjdXRpb25EVE8gfCB0YXNrcy5JQ3VzdG9tRXhlY3V0aW9uRFRPIHwgdW5kZWZpbmVkKTogdmFsdWUgaXMgdGFza3MuSVByb2Nlc3NFeGVjdXRpb25EVE8ge1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlID0gdmFsdWUgYXMgdGFza3MuSVByb2Nlc3NFeGVjdXRpb25EVE87XG5cdFx0XHRyZXR1cm4gY2FuZGlkYXRlICYmICEhY2FuZGlkYXRlLnByb2Nlc3M7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odmFsdWU6IHZzY29kZS5Qcm9jZXNzRXhlY3V0aW9uKTogdGFza3MuSVByb2Nlc3NFeGVjdXRpb25EVE8gfCB1bmRlZmluZWQge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQ6IHRhc2tzLklQcm9jZXNzRXhlY3V0aW9uRFRPID0ge1xuXHRcdFx0cHJvY2VzczogdmFsdWUucHJvY2Vzcyxcblx0XHRcdGFyZ3M6IHZhbHVlLmFyZ3Ncblx0XHR9O1xuXHRcdGlmICh2YWx1ZS5vcHRpb25zKSB7XG5cdFx0XHRyZXN1bHQub3B0aW9ucyA9IFByb2Nlc3NFeGVjdXRpb25PcHRpb25zRFRPLmZyb20odmFsdWUub3B0aW9ucyk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiB0YXNrcy5JUHJvY2Vzc0V4ZWN1dGlvbkRUTyk6IHR5cGVzLlByb2Nlc3NFeGVjdXRpb24gfCB1bmRlZmluZWQge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IHR5cGVzLlByb2Nlc3NFeGVjdXRpb24odmFsdWUucHJvY2VzcywgdmFsdWUuYXJncywgdmFsdWUub3B0aW9ucyk7XG5cdH1cbn1cblxubmFtZXNwYWNlIFNoZWxsRXhlY3V0aW9uT3B0aW9uc0RUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB2c2NvZGUuU2hlbGxFeGVjdXRpb25PcHRpb25zKTogdGFza3MuSVNoZWxsRXhlY3V0aW9uT3B0aW9uc0RUTyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFsdWU6IHRhc2tzLklTaGVsbEV4ZWN1dGlvbk9wdGlvbnNEVE8pOiB2c2NvZGUuU2hlbGxFeGVjdXRpb25PcHRpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG59XG5cbm5hbWVzcGFjZSBTaGVsbEV4ZWN1dGlvbkRUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBpcyh2YWx1ZTogdGFza3MuSVNoZWxsRXhlY3V0aW9uRFRPIHwgdGFza3MuSVByb2Nlc3NFeGVjdXRpb25EVE8gfCB0YXNrcy5JQ3VzdG9tRXhlY3V0aW9uRFRPIHwgdW5kZWZpbmVkKTogdmFsdWUgaXMgdGFza3MuSVNoZWxsRXhlY3V0aW9uRFRPIHtcblx0XHRpZiAodmFsdWUpIHtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IHZhbHVlIGFzIHRhc2tzLklTaGVsbEV4ZWN1dGlvbkRUTztcblx0XHRcdHJldHVybiBjYW5kaWRhdGUgJiYgKCEhY2FuZGlkYXRlLmNvbW1hbmRMaW5lIHx8ICEhY2FuZGlkYXRlLmNvbW1hbmQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB2c2NvZGUuU2hlbGxFeGVjdXRpb24pOiB0YXNrcy5JU2hlbGxFeGVjdXRpb25EVE8gfCB1bmRlZmluZWQge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQ6IHRhc2tzLklTaGVsbEV4ZWN1dGlvbkRUTyA9IHtcblx0XHR9O1xuXHRcdGlmICh2YWx1ZS5jb21tYW5kTGluZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXN1bHQuY29tbWFuZExpbmUgPSB2YWx1ZS5jb21tYW5kTGluZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0LmNvbW1hbmQgPSB2YWx1ZS5jb21tYW5kO1xuXHRcdFx0cmVzdWx0LmFyZ3MgPSB2YWx1ZS5hcmdzO1xuXHRcdH1cblx0XHRpZiAodmFsdWUub3B0aW9ucykge1xuXHRcdFx0cmVzdWx0Lm9wdGlvbnMgPSBTaGVsbEV4ZWN1dGlvbk9wdGlvbnNEVE8uZnJvbSh2YWx1ZS5vcHRpb25zKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFsdWU6IHRhc2tzLklTaGVsbEV4ZWN1dGlvbkRUTyk6IHR5cGVzLlNoZWxsRXhlY3V0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCB8fCAodmFsdWUuY29tbWFuZCA9PT0gdW5kZWZpbmVkICYmIHZhbHVlLmNvbW1hbmRMaW5lID09PSB1bmRlZmluZWQpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAodmFsdWUuY29tbWFuZExpbmUpIHtcblx0XHRcdHJldHVybiBuZXcgdHlwZXMuU2hlbGxFeGVjdXRpb24odmFsdWUuY29tbWFuZExpbmUsIHZhbHVlLm9wdGlvbnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbmV3IHR5cGVzLlNoZWxsRXhlY3V0aW9uKHZhbHVlLmNvbW1hbmQhLCB2YWx1ZS5hcmdzID8gdmFsdWUuYXJncyA6IFtdLCB2YWx1ZS5vcHRpb25zKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDdXN0b21FeGVjdXRpb25EVE8ge1xuXHRleHBvcnQgZnVuY3Rpb24gaXModmFsdWU6IHRhc2tzLklTaGVsbEV4ZWN1dGlvbkRUTyB8IHRhc2tzLklQcm9jZXNzRXhlY3V0aW9uRFRPIHwgdGFza3MuSUN1c3RvbUV4ZWN1dGlvbkRUTyB8IHVuZGVmaW5lZCk6IHZhbHVlIGlzIHRhc2tzLklDdXN0b21FeGVjdXRpb25EVE8ge1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlID0gdmFsdWUgYXMgdGFza3MuSUN1c3RvbUV4ZWN1dGlvbkRUTztcblx0XHRcdHJldHVybiBjYW5kaWRhdGUgJiYgY2FuZGlkYXRlLmN1c3RvbUV4ZWN1dGlvbiA9PT0gJ2N1c3RvbUV4ZWN1dGlvbic7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogdnNjb2RlLkN1c3RvbUV4ZWN1dGlvbik6IHRhc2tzLklDdXN0b21FeGVjdXRpb25EVE8ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRjdXN0b21FeGVjdXRpb246ICdjdXN0b21FeGVjdXRpb24nXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byh0YXNrSWQ6IHN0cmluZywgcHJvdmlkZWRDdXN0b21FeGV1dGlvbnM6IE1hcDxzdHJpbmcsIHR5cGVzLkN1c3RvbUV4ZWN1dGlvbj4pOiB0eXBlcy5DdXN0b21FeGVjdXRpb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBwcm92aWRlZEN1c3RvbUV4ZXV0aW9ucy5nZXQodGFza0lkKTtcblx0fVxufVxuXG5cbmV4cG9ydCBuYW1lc3BhY2UgVGFza0hhbmRsZURUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiB0eXBlcy5UYXNrLCB3b3Jrc3BhY2VTZXJ2aWNlPzogSUV4dEhvc3RXb3Jrc3BhY2UpOiB0YXNrcy5JVGFza0hhbmRsZURUTyB7XG5cdFx0bGV0IGZvbGRlcjogVXJpQ29tcG9uZW50cyB8IHN0cmluZztcblx0XHRpZiAodmFsdWUuc2NvcGUgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgdmFsdWUuc2NvcGUgIT09ICdudW1iZXInKSB7XG5cdFx0XHRmb2xkZXIgPSB2YWx1ZS5zY29wZS51cmk7XG5cdFx0fSBlbHNlIGlmICh2YWx1ZS5zY29wZSAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiB2YWx1ZS5zY29wZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdGlmICgodmFsdWUuc2NvcGUgPT09IHR5cGVzLlRhc2tTY29wZS5Xb3Jrc3BhY2UpICYmIHdvcmtzcGFjZVNlcnZpY2UgJiYgd29ya3NwYWNlU2VydmljZS53b3Jrc3BhY2VGaWxlKSB7XG5cdFx0XHRcdGZvbGRlciA9IHdvcmtzcGFjZVNlcnZpY2Uud29ya3NwYWNlRmlsZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvbGRlciA9IFVTRVJfVEFTS1NfR1JPVVBfS0VZO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IHZhbHVlLl9pZCEsXG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXI6IGZvbGRlciFcblx0XHR9O1xuXHR9XG59XG5uYW1lc3BhY2UgVGFza0dyb3VwRFRPIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odmFsdWU6IHZzY29kZS5UYXNrR3JvdXApOiB0YXNrcy5JVGFza0dyb3VwRFRPIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHsgX2lkOiB2YWx1ZS5pZCwgaXNEZWZhdWx0OiB2YWx1ZS5pc0RlZmF1bHQgfTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRhc2tEVE8ge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbU1hbnkodGFza3M6IHZzY29kZS5UYXNrW10sIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogdGFza3MuSVRhc2tEVE9bXSB7XG5cdFx0aWYgKHRhc2tzID09PSB1bmRlZmluZWQgfHwgdGFza3MgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiB0YXNrcy5JVGFza0RUT1tdID0gW107XG5cdFx0Zm9yIChjb25zdCB0YXNrIG9mIHRhc2tzKSB7XG5cdFx0XHRjb25zdCBjb252ZXJ0ZWQgPSBmcm9tKHRhc2ssIGV4dGVuc2lvbik7XG5cdFx0XHRpZiAoY29udmVydGVkKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGNvbnZlcnRlZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogdnNjb2RlLlRhc2ssIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogdGFza3MuSVRhc2tEVE8gfCB1bmRlZmluZWQge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgZXhlY3V0aW9uOiB0YXNrcy5JU2hlbGxFeGVjdXRpb25EVE8gfCB0YXNrcy5JUHJvY2Vzc0V4ZWN1dGlvbkRUTyB8IHRhc2tzLklDdXN0b21FeGVjdXRpb25EVE8gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHZhbHVlLmV4ZWN1dGlvbiBpbnN0YW5jZW9mIHR5cGVzLlByb2Nlc3NFeGVjdXRpb24pIHtcblx0XHRcdGV4ZWN1dGlvbiA9IFByb2Nlc3NFeGVjdXRpb25EVE8uZnJvbSh2YWx1ZS5leGVjdXRpb24pO1xuXHRcdH0gZWxzZSBpZiAodmFsdWUuZXhlY3V0aW9uIGluc3RhbmNlb2YgdHlwZXMuU2hlbGxFeGVjdXRpb24pIHtcblx0XHRcdGV4ZWN1dGlvbiA9IFNoZWxsRXhlY3V0aW9uRFRPLmZyb20odmFsdWUuZXhlY3V0aW9uKTtcblx0XHR9IGVsc2UgaWYgKHZhbHVlLmV4ZWN1dGlvbiAmJiB2YWx1ZS5leGVjdXRpb24gaW5zdGFuY2VvZiB0eXBlcy5DdXN0b21FeGVjdXRpb24pIHtcblx0XHRcdGV4ZWN1dGlvbiA9IEN1c3RvbUV4ZWN1dGlvbkRUTy5mcm9tKDx0eXBlcy5DdXN0b21FeGVjdXRpb24+dmFsdWUuZXhlY3V0aW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCBkZWZpbml0aW9uOiB0YXNrcy5JVGFza0RlZmluaXRpb25EVE8gfCB1bmRlZmluZWQgPSBUYXNrRGVmaW5pdGlvbkRUTy5mcm9tKHZhbHVlLmRlZmluaXRpb24pO1xuXHRcdGxldCBzY29wZTogbnVtYmVyIHwgVXJpQ29tcG9uZW50cztcblx0XHRpZiAodmFsdWUuc2NvcGUpIHtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUuc2NvcGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdHNjb3BlID0gdmFsdWUuc2NvcGU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzY29wZSA9IHZhbHVlLnNjb3BlLnVyaTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gVG8gY29udGludWUgdG8gc3VwcG9ydCB0aGUgZGVwcmVjYXRlZCB0YXNrIGNvbnN0cnVjdG9yIHRoYXQgZG9lc24ndCB0YWtlIGEgc2NvcGUsIHdlIG11c3QgYWRkIGEgc2NvcGUgaGVyZTpcblx0XHRcdHNjb3BlID0gdHlwZXMuVGFza1Njb3BlLldvcmtzcGFjZTtcblx0XHR9XG5cdFx0aWYgKCFkZWZpbml0aW9uIHx8ICFzY29wZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiB0YXNrcy5JVGFza0RUTyA9IHtcblx0XHRcdF9pZDogKHZhbHVlIGFzIHR5cGVzLlRhc2spLl9pZCEsXG5cdFx0XHRkZWZpbml0aW9uLFxuXHRcdFx0bmFtZTogdmFsdWUubmFtZSxcblx0XHRcdHNvdXJjZToge1xuXHRcdFx0XHRleHRlbnNpb25JZDogZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUsXG5cdFx0XHRcdGxhYmVsOiB2YWx1ZS5zb3VyY2UsXG5cdFx0XHRcdHNjb3BlOiBzY29wZVxuXHRcdFx0fSxcblx0XHRcdGV4ZWN1dGlvbjogZXhlY3V0aW9uISxcblx0XHRcdGlzQmFja2dyb3VuZDogdmFsdWUuaXNCYWNrZ3JvdW5kLFxuXHRcdFx0Z3JvdXA6IFRhc2tHcm91cERUTy5mcm9tKHZhbHVlLmdyb3VwIGFzIHZzY29kZS5UYXNrR3JvdXApLFxuXHRcdFx0cHJlc2VudGF0aW9uT3B0aW9uczogVGFza1ByZXNlbnRhdGlvbk9wdGlvbnNEVE8uZnJvbSh2YWx1ZS5wcmVzZW50YXRpb25PcHRpb25zKSxcblx0XHRcdHByb2JsZW1NYXRjaGVyczogYXNBcnJheSh2YWx1ZS5wcm9ibGVtTWF0Y2hlcnMpLFxuXHRcdFx0aGFzRGVmaW5lZE1hdGNoZXJzOiAodmFsdWUgYXMgdHlwZXMuVGFzaykuaGFzRGVmaW5lZE1hdGNoZXJzLFxuXHRcdFx0cnVuT3B0aW9uczogdmFsdWUucnVuT3B0aW9ucyA/IHZhbHVlLnJ1bk9wdGlvbnMgOiB7IHJlZXZhbHVhdGVPblJlcnVuOiB0cnVlIH0sXG5cdFx0XHRkZXRhaWw6IHZhbHVlLmRldGFpbFxuXHRcdH07XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXHRleHBvcnQgYXN5bmMgZnVuY3Rpb24gdG8odmFsdWU6IHRhc2tzLklUYXNrRFRPIHwgdW5kZWZpbmVkLCB3b3Jrc3BhY2U6IElFeHRIb3N0V29ya3NwYWNlUHJvdmlkZXIsIHByb3ZpZGVkQ3VzdG9tRXhldXRpb25zOiBNYXA8c3RyaW5nLCB0eXBlcy5DdXN0b21FeGVjdXRpb24+KTogUHJvbWlzZTx0eXBlcy5UYXNrIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGxldCBleGVjdXRpb246IHR5cGVzLlNoZWxsRXhlY3V0aW9uIHwgdHlwZXMuUHJvY2Vzc0V4ZWN1dGlvbiB8IHR5cGVzLkN1c3RvbUV4ZWN1dGlvbiB8IHVuZGVmaW5lZDtcblx0XHRpZiAoUHJvY2Vzc0V4ZWN1dGlvbkRUTy5pcyh2YWx1ZS5leGVjdXRpb24pKSB7XG5cdFx0XHRleGVjdXRpb24gPSBQcm9jZXNzRXhlY3V0aW9uRFRPLnRvKHZhbHVlLmV4ZWN1dGlvbik7XG5cdFx0fSBlbHNlIGlmIChTaGVsbEV4ZWN1dGlvbkRUTy5pcyh2YWx1ZS5leGVjdXRpb24pKSB7XG5cdFx0XHRleGVjdXRpb24gPSBTaGVsbEV4ZWN1dGlvbkRUTy50byh2YWx1ZS5leGVjdXRpb24pO1xuXHRcdH0gZWxzZSBpZiAoQ3VzdG9tRXhlY3V0aW9uRFRPLmlzKHZhbHVlLmV4ZWN1dGlvbikpIHtcblx0XHRcdGV4ZWN1dGlvbiA9IEN1c3RvbUV4ZWN1dGlvbkRUTy50byh2YWx1ZS5faWQsIHByb3ZpZGVkQ3VzdG9tRXhldXRpb25zKTtcblx0XHR9XG5cdFx0Y29uc3QgZGVmaW5pdGlvbjogdnNjb2RlLlRhc2tEZWZpbml0aW9uIHwgdW5kZWZpbmVkID0gVGFza0RlZmluaXRpb25EVE8udG8odmFsdWUuZGVmaW5pdGlvbik7XG5cdFx0bGV0IHNjb3BlOiB2c2NvZGUuVGFza1Njb3BlLkdsb2JhbCB8IHZzY29kZS5UYXNrU2NvcGUuV29ya3NwYWNlIHwgdnNjb2RlLldvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZDtcblx0XHRpZiAodmFsdWUuc291cmNlKSB7XG5cdFx0XHRpZiAodmFsdWUuc291cmNlLnNjb3BlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0aWYgKHR5cGVvZiB2YWx1ZS5zb3VyY2Uuc2NvcGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0c2NvcGUgPSB2YWx1ZS5zb3VyY2Uuc2NvcGU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2NvcGUgPSBhd2FpdCB3b3Jrc3BhY2UucmVzb2x2ZVdvcmtzcGFjZUZvbGRlcihVUkkucmV2aXZlKHZhbHVlLnNvdXJjZS5zY29wZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzY29wZSA9IHR5cGVzLlRhc2tTY29wZS5Xb3Jrc3BhY2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICghZGVmaW5pdGlvbiB8fCAhc2NvcGUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyB0eXBlcy5UYXNrKGRlZmluaXRpb24sIHNjb3BlLCB2YWx1ZS5uYW1lISwgdmFsdWUuc291cmNlLmxhYmVsLCBleGVjdXRpb24sIHZhbHVlLnByb2JsZW1NYXRjaGVycyk7XG5cdFx0aWYgKHZhbHVlLmlzQmFja2dyb3VuZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXN1bHQuaXNCYWNrZ3JvdW5kID0gdmFsdWUuaXNCYWNrZ3JvdW5kO1xuXHRcdH1cblx0XHRpZiAodmFsdWUuZ3JvdXAgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmVzdWx0Lmdyb3VwID0gdHlwZXMuVGFza0dyb3VwLmZyb20odmFsdWUuZ3JvdXAuX2lkKTtcblx0XHRcdGlmIChyZXN1bHQuZ3JvdXAgJiYgdmFsdWUuZ3JvdXAuaXNEZWZhdWx0KSB7XG5cdFx0XHRcdHJlc3VsdC5ncm91cCA9IG5ldyB0eXBlcy5UYXNrR3JvdXAocmVzdWx0Lmdyb3VwLmlkLCByZXN1bHQuZ3JvdXAubGFiZWwpO1xuXHRcdFx0XHRpZiAodmFsdWUuZ3JvdXAuaXNEZWZhdWx0ID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0cmVzdWx0Lmdyb3VwLmlzRGVmYXVsdCA9IHZhbHVlLmdyb3VwLmlzRGVmYXVsdDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodmFsdWUucHJlc2VudGF0aW9uT3B0aW9ucykge1xuXHRcdFx0cmVzdWx0LnByZXNlbnRhdGlvbk9wdGlvbnMgPSBUYXNrUHJlc2VudGF0aW9uT3B0aW9uc0RUTy50byh2YWx1ZS5wcmVzZW50YXRpb25PcHRpb25zKSE7XG5cdFx0fVxuXHRcdGlmICh2YWx1ZS5faWQpIHtcblx0XHRcdHJlc3VsdC5faWQgPSB2YWx1ZS5faWQ7XG5cdFx0fVxuXHRcdGlmICh2YWx1ZS5kZXRhaWwpIHtcblx0XHRcdHJlc3VsdC5kZXRhaWwgPSB2YWx1ZS5kZXRhaWw7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxubmFtZXNwYWNlIFRhc2tGaWx0ZXJEVE8ge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogdnNjb2RlLlRhc2tGaWx0ZXIgfCB1bmRlZmluZWQpOiB0YXNrcy5JVGFza0ZpbHRlckRUTyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiB0YXNrcy5JVGFza0ZpbHRlckRUTyk6IHZzY29kZS5UYXNrRmlsdGVyIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB2YWx1ZSk7XG5cdH1cbn1cblxuY2xhc3MgVGFza0V4ZWN1dGlvbkltcGwgaW1wbGVtZW50cyB2c2NvZGUuVGFza0V4ZWN1dGlvbiB7XG5cblx0cmVhZG9ubHkgI3Rhc2tzOiBFeHRIb3N0VGFza0Jhc2U7XG5cblx0Y29uc3RydWN0b3IodGFza3M6IEV4dEhvc3RUYXNrQmFzZSwgcmVhZG9ubHkgX2lkOiBzdHJpbmcsIHByaXZhdGUgcmVhZG9ubHkgX3Rhc2s6IHZzY29kZS5UYXNrKSB7XG5cdFx0dGhpcy4jdGFza3MgPSB0YXNrcztcblx0fVxuXG5cdHB1YmxpYyBnZXQgdGFzaygpOiB2c2NvZGUuVGFzayB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rhc2s7XG5cdH1cblxuXHRwdWJsaWMgdGVybWluYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuI3Rhc2tzLnRlcm1pbmF0ZVRhc2sodGhpcyk7XG5cdH1cblxuXHRwdWJsaWMgZmlyZURpZFN0YXJ0UHJvY2Vzcyh2YWx1ZTogdGFza3MuSVRhc2tQcm9jZXNzU3RhcnRlZERUTyk6IHZvaWQge1xuXHR9XG5cblx0cHVibGljIGZpcmVEaWRFbmRQcm9jZXNzKHZhbHVlOiB0YXNrcy5JVGFza1Byb2Nlc3NFbmRlZERUTyk6IHZvaWQge1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGFuZGxlckRhdGEge1xuXHR0eXBlOiBzdHJpbmc7XG5cdHByb3ZpZGVyOiB2c2NvZGUuVGFza1Byb3ZpZGVyO1xuXHRleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbjtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEV4dEhvc3RUYXNrQmFzZSBpbXBsZW1lbnRzIEV4dEhvc3RUYXNrU2hhcGUsIElFeHRIb3N0VGFzayB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX3Byb3h5OiBNYWluVGhyZWFkVGFza1NoYXBlO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX3dvcmtzcGFjZVByb3ZpZGVyOiBJRXh0SG9zdFdvcmtzcGFjZVByb3ZpZGVyO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycztcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUV4dEhvc3RDb25maWd1cmF0aW9uO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX3Rlcm1pbmFsU2VydmljZTogSUV4dEhvc3RUZXJtaW5hbFNlcnZpY2U7XG5cdHByb3RlY3RlZCByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2U7XG5cdHByb3RlY3RlZCByZWFkb25seSBfZGVwcmVjYXRpb25TZXJ2aWNlOiBJRXh0SG9zdEFwaURlcHJlY2F0aW9uU2VydmljZTtcblx0cHJvdGVjdGVkIF9oYW5kbGVDb3VudGVyOiBudW1iZXI7XG5cdHByb3RlY3RlZCBfaGFuZGxlcnM6IE1hcDxudW1iZXIsIEhhbmRsZXJEYXRhPjtcblx0cHJvdGVjdGVkIF90YXNrRXhlY3V0aW9uczogTWFwPHN0cmluZywgVGFza0V4ZWN1dGlvbkltcGw+O1xuXHRwcm90ZWN0ZWQgX3Rhc2tFeGVjdXRpb25Qcm9taXNlczogTWFwPHN0cmluZywgUHJvbWlzZTxUYXNrRXhlY3V0aW9uSW1wbD4+O1xuXHRwcm90ZWN0ZWQgX3Byb3ZpZGVkQ3VzdG9tRXhlY3V0aW9uczI6IE1hcDxzdHJpbmcsIHR5cGVzLkN1c3RvbUV4ZWN1dGlvbj47XG5cdHByaXZhdGUgX25vdFByb3ZpZGVkQ3VzdG9tRXhlY3V0aW9uczogU2V0PHN0cmluZz47IC8vIFVzZWQgZm9yIGN1c3RvbSBleGVjdXRpb25zIHRhc2tzIHRoYXQgYXJlIGNyZWF0ZWQgYW5kIHJ1biB0aHJvdWdoIGV4ZWN1dGVUYXNrLlxuXHRwcm90ZWN0ZWQgX2FjdGl2ZUN1c3RvbUV4ZWN1dGlvbnMyOiBNYXA8c3RyaW5nLCB0eXBlcy5DdXN0b21FeGVjdXRpb24+O1xuXHRwcml2YXRlIF9sYXN0U3RhcnRlZFRhc2s6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZEV4ZWN1dGVUYXNrOiBFbWl0dGVyPHZzY29kZS5UYXNrU3RhcnRFdmVudD4gPSBuZXcgRW1pdHRlcjx2c2NvZGUuVGFza1N0YXJ0RXZlbnQ+KCk7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRUZXJtaW5hdGVUYXNrOiBFbWl0dGVyPHZzY29kZS5UYXNrRW5kRXZlbnQ+ID0gbmV3IEVtaXR0ZXI8dnNjb2RlLlRhc2tFbmRFdmVudD4oKTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkVGFza1Byb2Nlc3NTdGFydGVkOiBFbWl0dGVyPHZzY29kZS5UYXNrUHJvY2Vzc1N0YXJ0RXZlbnQ+ID0gbmV3IEVtaXR0ZXI8dnNjb2RlLlRhc2tQcm9jZXNzU3RhcnRFdmVudD4oKTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFRhc2tQcm9jZXNzRW5kZWQ6IEVtaXR0ZXI8dnNjb2RlLlRhc2tQcm9jZXNzRW5kRXZlbnQ+ID0gbmV3IEVtaXR0ZXI8dnNjb2RlLlRhc2tQcm9jZXNzRW5kRXZlbnQ+KCk7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRTdGFydFRhc2tQcm9ibGVtTWF0Y2hlcnM6IEVtaXR0ZXI8dnNjb2RlLlRhc2tQcm9ibGVtTWF0Y2hlclN0YXJ0ZWRFdmVudD4gPSBuZXcgRW1pdHRlcjx2c2NvZGUuVGFza1Byb2JsZW1NYXRjaGVyU3RhcnRlZEV2ZW50PigpO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkRW5kVGFza1Byb2JsZW1NYXRjaGVyczogRW1pdHRlcjx2c2NvZGUuVGFza1Byb2JsZW1NYXRjaGVyRW5kZWRFdmVudD4gPSBuZXcgRW1pdHRlcjx2c2NvZGUuVGFza1Byb2JsZW1NYXRjaGVyRW5kZWRFdmVudD4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dEhvc3RScGNTZXJ2aWNlIGV4dEhvc3RScGM6IElFeHRIb3N0UnBjU2VydmljZSxcblx0XHRASUV4dEhvc3RJbml0RGF0YVNlcnZpY2UgaW5pdERhdGE6IElFeHRIb3N0SW5pdERhdGFTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdFdvcmtzcGFjZSB3b3Jrc3BhY2VTZXJ2aWNlOiBJRXh0SG9zdFdvcmtzcGFjZSxcblx0XHRASUV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzIGVkaXRvclNlcnZpY2U6IElFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyxcblx0XHRASUV4dEhvc3RDb25maWd1cmF0aW9uIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJRXh0SG9zdENvbmZpZ3VyYXRpb24sXG5cdFx0QElFeHRIb3N0VGVybWluYWxTZXJ2aWNlIGV4dEhvc3RUZXJtaW5hbFNlcnZpY2U6IElFeHRIb3N0VGVybWluYWxTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUV4dEhvc3RBcGlEZXByZWNhdGlvblNlcnZpY2UgZGVwcmVjYXRpb25TZXJ2aWNlOiBJRXh0SG9zdEFwaURlcHJlY2F0aW9uU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLl9wcm94eSA9IGV4dEhvc3RScGMuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZFRhc2spO1xuXHRcdHRoaXMuX3dvcmtzcGFjZVByb3ZpZGVyID0gd29ya3NwYWNlU2VydmljZTtcblx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlID0gZWRpdG9yU2VydmljZTtcblx0XHR0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZSA9IGV4dEhvc3RUZXJtaW5hbFNlcnZpY2U7XG5cdFx0dGhpcy5faGFuZGxlQ291bnRlciA9IDA7XG5cdFx0dGhpcy5faGFuZGxlcnMgPSBuZXcgTWFwPG51bWJlciwgSGFuZGxlckRhdGE+KCk7XG5cdFx0dGhpcy5fdGFza0V4ZWN1dGlvbnMgPSBuZXcgTWFwPHN0cmluZywgVGFza0V4ZWN1dGlvbkltcGw+KCk7XG5cdFx0dGhpcy5fdGFza0V4ZWN1dGlvblByb21pc2VzID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8VGFza0V4ZWN1dGlvbkltcGw+PigpO1xuXHRcdHRoaXMuX3Byb3ZpZGVkQ3VzdG9tRXhlY3V0aW9uczIgPSBuZXcgTWFwPHN0cmluZywgdHlwZXMuQ3VzdG9tRXhlY3V0aW9uPigpO1xuXHRcdHRoaXMuX25vdFByb3ZpZGVkQ3VzdG9tRXhlY3V0aW9ucyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRoaXMuX2FjdGl2ZUN1c3RvbUV4ZWN1dGlvbnMyID0gbmV3IE1hcDxzdHJpbmcsIHR5cGVzLkN1c3RvbUV4ZWN1dGlvbj4oKTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlID0gbG9nU2VydmljZTtcblx0XHR0aGlzLl9kZXByZWNhdGlvblNlcnZpY2UgPSBkZXByZWNhdGlvblNlcnZpY2U7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyU3VwcG9ydGVkRXhlY3V0aW9ucyh0cnVlKTtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlclRhc2tQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgdHlwZTogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLlRhc2tQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkRpc3Bvc2FibGUoKCkgPT4geyB9KTtcblx0XHR9XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5uZXh0SGFuZGxlKCk7XG5cdFx0dGhpcy5faGFuZGxlcnMuc2V0KGhhbmRsZSwgeyB0eXBlLCBwcm92aWRlciwgZXh0ZW5zaW9uIH0pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlclRhc2tQcm92aWRlcihoYW5kbGUsIHR5cGUpO1xuXHRcdHJldHVybiBuZXcgdHlwZXMuRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9oYW5kbGVycy5kZWxldGUoaGFuZGxlKTtcblx0XHRcdHRoaXMuX3Byb3h5LiR1bnJlZ2lzdGVyVGFza1Byb3ZpZGVyKGhhbmRsZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJUYXNrU3lzdGVtKHNjaGVtZTogc3RyaW5nLCBpbmZvOiB0YXNrcy5JVGFza1N5c3RlbUluZm9EVE8pOiB2b2lkIHtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJUYXNrU3lzdGVtKHNjaGVtZSwgaW5mbyk7XG5cdH1cblxuXHRwdWJsaWMgZmV0Y2hUYXNrcyhmaWx0ZXI/OiB2c2NvZGUuVGFza0ZpbHRlcik6IFByb21pc2U8dnNjb2RlLlRhc2tbXT4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kZmV0Y2hUYXNrcyhUYXNrRmlsdGVyRFRPLmZyb20oZmlsdGVyKSkudGhlbihhc3luYyAodmFsdWVzKSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IHZzY29kZS5UYXNrW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG5cdFx0XHRcdGNvbnN0IHRhc2sgPSBhd2FpdCBUYXNrRFRPLnRvKHZhbHVlLCB0aGlzLl93b3Jrc3BhY2VQcm92aWRlciwgdGhpcy5fcHJvdmlkZWRDdXN0b21FeGVjdXRpb25zMik7XG5cdFx0XHRcdGlmICh0YXNrKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2godGFzayk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYWJzdHJhY3QgZXhlY3V0ZVRhc2soZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHRhc2s6IHZzY29kZS5UYXNrKTogUHJvbWlzZTx2c2NvZGUuVGFza0V4ZWN1dGlvbj47XG5cblx0cHVibGljIGdldCB0YXNrRXhlY3V0aW9ucygpOiB2c2NvZGUuVGFza0V4ZWN1dGlvbltdIHtcblx0XHRjb25zdCByZXN1bHQ6IHZzY29kZS5UYXNrRXhlY3V0aW9uW10gPSBbXTtcblx0XHR0aGlzLl90YXNrRXhlY3V0aW9ucy5mb3JFYWNoKHZhbHVlID0+IHJlc3VsdC5wdXNoKHZhbHVlKSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyB0ZXJtaW5hdGVUYXNrKGV4ZWN1dGlvbjogdnNjb2RlLlRhc2tFeGVjdXRpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIShleGVjdXRpb24gaW5zdGFuY2VvZiBUYXNrRXhlY3V0aW9uSW1wbCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gdmFsaWQgdGFzayBleGVjdXRpb24gcHJvdmlkZWQnKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiR0ZXJtaW5hdGVUYXNrKChleGVjdXRpb24gYXMgVGFza0V4ZWN1dGlvbkltcGwpLl9pZCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uRGlkU3RhcnRUYXNrKCk6IEV2ZW50PHZzY29kZS5UYXNrU3RhcnRFdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZEV4ZWN1dGVUYXNrLmV2ZW50O1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRvbkRpZFN0YXJ0VGFzayhleGVjdXRpb246IHRhc2tzLklUYXNrRXhlY3V0aW9uRFRPLCB0ZXJtaW5hbElkOiBudW1iZXIsIHJlc29sdmVkRGVmaW5pdGlvbjogdGFza3MuSVRhc2tEZWZpbml0aW9uRFRPKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY3VzdG9tRXhlY3V0aW9uOiB0eXBlcy5DdXN0b21FeGVjdXRpb24gfCB1bmRlZmluZWQgPSB0aGlzLl9wcm92aWRlZEN1c3RvbUV4ZWN1dGlvbnMyLmdldChleGVjdXRpb24uaWQpO1xuXHRcdGlmIChjdXN0b21FeGVjdXRpb24pIHtcblx0XHRcdC8vIENsb25lIHRoZSBjdXN0b20gZXhlY3V0aW9uIHRvIGtlZXAgdGhlIG9yaWdpbmFsIHVudG91Y2hlZC4gVGhpcyBpcyBpbXBvcnRhbnQgZm9yIG11bHRpcGxlIHJ1bnMgb2YgdGhlIHNhbWUgdGFzay5cblx0XHRcdHRoaXMuX2FjdGl2ZUN1c3RvbUV4ZWN1dGlvbnMyLnNldChleGVjdXRpb24uaWQsIGN1c3RvbUV4ZWN1dGlvbik7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2UuYXR0YWNoUHR5VG9UZXJtaW5hbCh0ZXJtaW5hbElkLCBhd2FpdCBjdXN0b21FeGVjdXRpb24uY2FsbGJhY2socmVzb2x2ZWREZWZpbml0aW9uKSk7XG5cdFx0fVxuXHRcdHRoaXMuX2xhc3RTdGFydGVkVGFzayA9IGV4ZWN1dGlvbi5pZDtcblxuXHRcdHRoaXMuX29uRGlkRXhlY3V0ZVRhc2suZmlyZSh7XG5cdFx0XHRleGVjdXRpb246IGF3YWl0IHRoaXMuZ2V0VGFza0V4ZWN1dGlvbihleGVjdXRpb24pXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uRGlkRW5kVGFzaygpOiBFdmVudDx2c2NvZGUuVGFza0VuZEV2ZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkVGVybWluYXRlVGFzay5ldmVudDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkT25EaWRFbmRUYXNrKGV4ZWN1dGlvbjogdGFza3MuSVRhc2tFeGVjdXRpb25EVE8pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX3Rhc2tFeGVjdXRpb25Qcm9taXNlcy5oYXMoZXhlY3V0aW9uLmlkKSkge1xuXHRcdFx0Ly8gRXZlbnQgYWxyZWFkeSBmaXJlZCBieSB0aGUgbWFpbiB0aHJlYWRcblx0XHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9jb21taXQvYWFmNzM5MjBhZWFlMTcxMDk2ZDIwNWVmYjJjNTg4MDRhMzJiNjg0NlxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBfZXhlY3V0aW9uID0gYXdhaXQgdGhpcy5nZXRUYXNrRXhlY3V0aW9uKGV4ZWN1dGlvbik7XG5cdFx0dGhpcy5fdGFza0V4ZWN1dGlvblByb21pc2VzLmRlbGV0ZShleGVjdXRpb24uaWQpO1xuXHRcdHRoaXMuX3Rhc2tFeGVjdXRpb25zLmRlbGV0ZShleGVjdXRpb24uaWQpO1xuXHRcdHRoaXMuY3VzdG9tRXhlY3V0aW9uQ29tcGxldGUoZXhlY3V0aW9uKTtcblx0XHR0aGlzLl9vbkRpZFRlcm1pbmF0ZVRhc2suZmlyZSh7XG5cdFx0XHRleGVjdXRpb246IF9leGVjdXRpb25cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgb25EaWRTdGFydFRhc2tQcm9jZXNzKCk6IEV2ZW50PHZzY29kZS5UYXNrUHJvY2Vzc1N0YXJ0RXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRUYXNrUHJvY2Vzc1N0YXJ0ZWQuZXZlbnQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJG9uRGlkU3RhcnRUYXNrUHJvY2Vzcyh2YWx1ZTogdGFza3MuSVRhc2tQcm9jZXNzU3RhcnRlZERUTyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGV4ZWN1dGlvbiA9IGF3YWl0IHRoaXMuZ2V0VGFza0V4ZWN1dGlvbih2YWx1ZS5pZCk7XG5cdFx0dGhpcy5fb25EaWRUYXNrUHJvY2Vzc1N0YXJ0ZWQuZmlyZSh7XG5cdFx0XHRleGVjdXRpb246IGV4ZWN1dGlvbixcblx0XHRcdHByb2Nlc3NJZDogdmFsdWUucHJvY2Vzc0lkXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uRGlkRW5kVGFza1Byb2Nlc3MoKTogRXZlbnQ8dnNjb2RlLlRhc2tQcm9jZXNzRW5kRXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRUYXNrUHJvY2Vzc0VuZGVkLmV2ZW50O1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRvbkRpZEVuZFRhc2tQcm9jZXNzKHZhbHVlOiB0YXNrcy5JVGFza1Byb2Nlc3NFbmRlZERUTyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGV4ZWN1dGlvbiA9IGF3YWl0IHRoaXMuZ2V0VGFza0V4ZWN1dGlvbih2YWx1ZS5pZCk7XG5cdFx0dGhpcy5fb25EaWRUYXNrUHJvY2Vzc0VuZGVkLmZpcmUoe1xuXHRcdFx0ZXhlY3V0aW9uOiBleGVjdXRpb24sXG5cdFx0XHRleGl0Q29kZTogdmFsdWUuZXhpdENvZGVcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgb25EaWRTdGFydFRhc2tQcm9ibGVtTWF0Y2hlcnMoKTogRXZlbnQ8dnNjb2RlLlRhc2tQcm9ibGVtTWF0Y2hlclN0YXJ0ZWRFdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZFN0YXJ0VGFza1Byb2JsZW1NYXRjaGVycy5ldmVudDtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkb25EaWRTdGFydFRhc2tQcm9ibGVtTWF0Y2hlcnModmFsdWU6IElUYXNrUHJvYmxlbU1hdGNoZXJTdGFydGVkRHRvKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IGV4ZWN1dGlvbjtcblx0XHR0cnkge1xuXHRcdFx0ZXhlY3V0aW9uID0gYXdhaXQgdGhpcy5nZXRUYXNrRXhlY3V0aW9uKHZhbHVlLmV4ZWN1dGlvbi5pZCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIFRoZSB0YXNrIGV4ZWN1dGlvbiBpcyBub3QgYXZhaWxhYmxlIGFueW1vcmVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZFN0YXJ0VGFza1Byb2JsZW1NYXRjaGVycy5maXJlKHsgZXhlY3V0aW9uIH0pO1xuXHR9XG5cblx0cHVibGljIGdldCBvbkRpZEVuZFRhc2tQcm9ibGVtTWF0Y2hlcnMoKTogRXZlbnQ8dnNjb2RlLlRhc2tQcm9ibGVtTWF0Y2hlckVuZGVkRXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRFbmRUYXNrUHJvYmxlbU1hdGNoZXJzLmV2ZW50O1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRvbkRpZEVuZFRhc2tQcm9ibGVtTWF0Y2hlcnModmFsdWU6IElUYXNrUHJvYmxlbU1hdGNoZXJFbmRlZER0byk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBleGVjdXRpb247XG5cdFx0dHJ5IHtcblx0XHRcdGV4ZWN1dGlvbiA9IGF3YWl0IHRoaXMuZ2V0VGFza0V4ZWN1dGlvbih2YWx1ZS5leGVjdXRpb24uaWQpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHQvLyBUaGUgdGFzayBleGVjdXRpb24gaXMgbm90IGF2YWlsYWJsZSBhbnltb3JlXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRFbmRUYXNrUHJvYmxlbU1hdGNoZXJzLmZpcmUoeyBleGVjdXRpb24sIGhhc0Vycm9yczogdmFsdWUuaGFzRXJyb3JzIH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IHByb3ZpZGVUYXNrc0ludGVybmFsKHZhbGlkVHlwZXM6IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9LCB0YXNrSWRQcm9taXNlczogUHJvbWlzZTx2b2lkPltdLCBoYW5kbGVyOiBIYW5kbGVyRGF0YSwgdmFsdWU6IHZzY29kZS5UYXNrW10gfCBudWxsIHwgdW5kZWZpbmVkKTogeyB0YXNrczogdGFza3MuSVRhc2tEVE9bXTsgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfTtcblxuXHRwdWJsaWMgJHByb3ZpZGVUYXNrcyhoYW5kbGU6IG51bWJlciwgdmFsaWRUeXBlczogeyBba2V5OiBzdHJpbmddOiBib29sZWFuIH0pOiBQcm9taXNlPHRhc2tzLklUYXNrU2V0RFRPPiB7XG5cdFx0Y29uc3QgaGFuZGxlciA9IHRoaXMuX2hhbmRsZXJzLmdldChoYW5kbGUpO1xuXHRcdGlmICghaGFuZGxlcikge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignbm8gaGFuZGxlciBmb3VuZCcpKTtcblx0XHR9XG5cblx0XHQvLyBTZXQgdXAgYSBsaXN0IG9mIHRhc2sgSUQgcHJvbWlzZXMgdGhhdCB3ZSBjYW4gd2FpdCBvblxuXHRcdC8vIGJlZm9yZSByZXR1cm5pbmcgdGhlIHByb3ZpZGVkIHRhc2tzLiBUaGUgZW5zdXJlcyB0aGF0XG5cdFx0Ly8gb3VyIHRhc2sgSURzIGFyZSBjYWxjdWxhdGVkIGZvciBhbnkgY3VzdG9tIGV4ZWN1dGlvbiB0YXNrcy5cblx0XHQvLyBLbm93aW5nIHRoaXMgSUQgYWhlYWQgb2YgdGltZSBpcyBuZWVkZWQgYmVjYXVzZSB3aGVuIGEgdGFza1xuXHRcdC8vIHN0YXJ0IGV2ZW50IGlzIGZpcmVkIHRoaXMgaXMgd2hlbiB0aGUgY3VzdG9tIGV4ZWN1dGlvbiBpcyBjYWxsZWQuXG5cdFx0Ly8gVGhlIHRhc2sgc3RhcnQgZXZlbnQgaXMgYWxzbyB0aGUgZmlyc3QgdGltZSB3ZSBzZWUgdGhlIElEIGZyb20gdGhlIG1haW5cblx0XHQvLyB0aHJlYWQsIHdoaWNoIGlzIHRvbyBsYXRlIGZvciB1cyBiZWNhdXNlIHdlIG5lZWQgdG8gc2F2ZSBhbiBtYXBcblx0XHQvLyBmcm9tIGFuIElEIHRvIHRoZSBjdXN0b20gZXhlY3V0aW9uIGZ1bmN0aW9uLiAoS2luZCBvZiBhIGNhcnQgYmVmb3JlIHRoZSBob3JzZSBwcm9ibGVtKS5cblx0XHRjb25zdCB0YXNrSWRQcm9taXNlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cdFx0Y29uc3QgZmV0Y2hQcm9taXNlID0gYXNQcm9taXNlKCgpID0+IGhhbmRsZXIucHJvdmlkZXIucHJvdmlkZVRhc2tzKENhbmNlbGxhdGlvblRva2VuLk5vbmUpKS50aGVuKHZhbHVlID0+IHtcblx0XHRcdHJldHVybiB0aGlzLnByb3ZpZGVUYXNrc0ludGVybmFsKHZhbGlkVHlwZXMsIHRhc2tJZFByb21pc2VzLCBoYW5kbGVyLCB2YWx1ZSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRcdGZldGNoUHJvbWlzZS50aGVuKChyZXN1bHQpID0+IHtcblx0XHRcdFx0UHJvbWlzZS5hbGwodGFza0lkUHJvbWlzZXMpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdHJlc29sdmUocmVzdWx0KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCByZXNvbHZlVGFza0ludGVybmFsKHJlc29sdmVkVGFza0RUTzogdGFza3MuSVRhc2tEVE8pOiBQcm9taXNlPHRhc2tzLklUYXNrRFRPIHwgdW5kZWZpbmVkPjtcblxuXHRwdWJsaWMgYXN5bmMgJHJlc29sdmVUYXNrKGhhbmRsZTogbnVtYmVyLCB0YXNrRFRPOiB0YXNrcy5JVGFza0RUTyk6IFByb21pc2U8dGFza3MuSVRhc2tEVE8gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBoYW5kbGVyID0gdGhpcy5faGFuZGxlcnMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFoYW5kbGVyKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdubyBoYW5kbGVyIGZvdW5kJykpO1xuXHRcdH1cblxuXHRcdGlmICh0YXNrRFRPLmRlZmluaXRpb24udHlwZSAhPT0gaGFuZGxlci50eXBlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQ6IFRhc2sgb2YgdHlwZSBbJHt0YXNrRFRPLmRlZmluaXRpb24udHlwZX1dIGNhbm5vdCBiZSByZXNvbHZlZCBieSBwcm92aWRlciBvZiB0eXBlIFske2hhbmRsZXIudHlwZX1dLmApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRhc2sgPSBhd2FpdCBUYXNrRFRPLnRvKHRhc2tEVE8sIHRoaXMuX3dvcmtzcGFjZVByb3ZpZGVyLCB0aGlzLl9wcm92aWRlZEN1c3RvbUV4ZWN1dGlvbnMyKTtcblx0XHRpZiAoIXRhc2spIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZDogVGFzayBjYW5ub3QgYmUgcmVzb2x2ZWQuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzb2x2ZWRUYXNrID0gYXdhaXQgaGFuZGxlci5wcm92aWRlci5yZXNvbHZlVGFzayh0YXNrLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRpZiAoIXJlc29sdmVkVGFzaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuY2hlY2tEZXByZWNhdGlvbihyZXNvbHZlZFRhc2ssIGhhbmRsZXIpO1xuXG5cdFx0Y29uc3QgcmVzb2x2ZWRUYXNrRFRPOiB0YXNrcy5JVGFza0RUTyB8IHVuZGVmaW5lZCA9IFRhc2tEVE8uZnJvbShyZXNvbHZlZFRhc2ssIGhhbmRsZXIuZXh0ZW5zaW9uKTtcblx0XHRpZiAoIXJlc29sdmVkVGFza0RUTykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkOiBUYXNrIGNhbm5vdCBiZSByZXNvbHZlZC4nKTtcblx0XHR9XG5cblx0XHRpZiAocmVzb2x2ZWRUYXNrLmRlZmluaXRpb24gIT09IHRhc2suZGVmaW5pdGlvbikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkOiBUaGUgcmVzb2x2ZWQgdGFzayBkZWZpbml0aW9uIG11c3QgYmUgdGhlIHNhbWUgb2JqZWN0IGFzIHRoZSBvcmlnaW5hbCB0YXNrIGRlZmluaXRpb24uIFRoZSB0YXNrIGRlZmluaXRpb24gY2Fubm90IGJlIGNoYW5nZWQuJyk7XG5cdFx0fVxuXG5cdFx0aWYgKEN1c3RvbUV4ZWN1dGlvbkRUTy5pcyhyZXNvbHZlZFRhc2tEVE8uZXhlY3V0aW9uKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5hZGRDdXN0b21FeGVjdXRpb24ocmVzb2x2ZWRUYXNrRFRPLCByZXNvbHZlZFRhc2ssIHRydWUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBhd2FpdCB0aGlzLnJlc29sdmVUYXNrSW50ZXJuYWwocmVzb2x2ZWRUYXNrRFRPKTtcblx0fVxuXG5cdHB1YmxpYyBhYnN0cmFjdCAkcmVzb2x2ZVZhcmlhYmxlcyh1cmlDb21wb25lbnRzOiBVcmlDb21wb25lbnRzLCB0b1Jlc29sdmU6IHsgcHJvY2Vzcz86IHsgbmFtZTogc3RyaW5nOyBjd2Q/OiBzdHJpbmc7IHBhdGg/OiBzdHJpbmcgfTsgdmFyaWFibGVzOiBzdHJpbmdbXSB9KTogUHJvbWlzZTx7IHByb2Nlc3M/OiBzdHJpbmc7IHZhcmlhYmxlczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSB9PjtcblxuXHRwcml2YXRlIG5leHRIYW5kbGUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5faGFuZGxlQ291bnRlcisrO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGFkZEN1c3RvbUV4ZWN1dGlvbih0YXNrRFRPOiB0YXNrcy5JVGFza0RUTywgdGFzazogdnNjb2RlLlRhc2ssIGlzUHJvdmlkZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0YXNrSWQgPSBhd2FpdCB0aGlzLl9wcm94eS4kY3JlYXRlVGFza0lkKHRhc2tEVE8pO1xuXHRcdGlmICghaXNQcm92aWRlZCAmJiAhdGhpcy5fcHJvdmlkZWRDdXN0b21FeGVjdXRpb25zMi5oYXModGFza0lkKSkge1xuXHRcdFx0dGhpcy5fbm90UHJvdmlkZWRDdXN0b21FeGVjdXRpb25zLmFkZCh0YXNrSWQpO1xuXHRcdFx0Ly8gQWxzbyBhZGQgdG8gYWN0aXZlIGV4ZWN1dGlvbnMgd2hlbiBub3QgY29taW5nIGZyb20gYSBwcm92aWRlciB0byBwcmV2ZW50IHRpbWluZyBpc3N1ZS5cblx0XHRcdHRoaXMuX2FjdGl2ZUN1c3RvbUV4ZWN1dGlvbnMyLnNldCh0YXNrSWQsIDx0eXBlcy5DdXN0b21FeGVjdXRpb24+dGFzay5leGVjdXRpb24pO1xuXHRcdH1cblx0XHR0aGlzLl9wcm92aWRlZEN1c3RvbUV4ZWN1dGlvbnMyLnNldCh0YXNrSWQsIDx0eXBlcy5DdXN0b21FeGVjdXRpb24+dGFzay5leGVjdXRpb24pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGdldFRhc2tFeGVjdXRpb24oZXhlY3V0aW9uOiB0YXNrcy5JVGFza0V4ZWN1dGlvbkRUTyB8IHN0cmluZywgdGFzaz86IHZzY29kZS5UYXNrKTogUHJvbWlzZTxUYXNrRXhlY3V0aW9uSW1wbD4ge1xuXHRcdGlmICh0eXBlb2YgZXhlY3V0aW9uID09PSAnc3RyaW5nJykge1xuXHRcdFx0Y29uc3QgdGFza0V4ZWN1dGlvbiA9IHRoaXMuX3Rhc2tFeGVjdXRpb25Qcm9taXNlcy5nZXQoZXhlY3V0aW9uKTtcblx0XHRcdGlmICghdGFza0V4ZWN1dGlvbikge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3JOb1RlbGVtZXRyeSgnVW5leHBlY3RlZDogVGhlIHNwZWNpZmllZCB0YXNrIGlzIG1pc3NpbmcgYW4gZXhlY3V0aW9uJyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGFza0V4ZWN1dGlvbjtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IFByb21pc2U8VGFza0V4ZWN1dGlvbkltcGw+IHwgdW5kZWZpbmVkID0gdGhpcy5fdGFza0V4ZWN1dGlvblByb21pc2VzLmdldChleGVjdXRpb24uaWQpO1xuXHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0bGV0IGV4ZWN1dGlvblByb21pc2U6IFByb21pc2U8VGFza0V4ZWN1dGlvbkltcGw+O1xuXHRcdGlmICghdGFzaykge1xuXHRcdFx0ZXhlY3V0aW9uUHJvbWlzZSA9IFRhc2tEVE8udG8oZXhlY3V0aW9uLnRhc2ssIHRoaXMuX3dvcmtzcGFjZVByb3ZpZGVyLCB0aGlzLl9wcm92aWRlZEN1c3RvbUV4ZWN1dGlvbnMyKS50aGVuKHQgPT4ge1xuXHRcdFx0XHRpZiAoIXQpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3JOb1RlbGVtZXRyeSgnVW5leHBlY3RlZDogVGFzayBkb2VzIG5vdCBleGlzdC4nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbmV3IFRhc2tFeGVjdXRpb25JbXBsKHRoaXMsIGV4ZWN1dGlvbi5pZCwgdCk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZXhlY3V0aW9uUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZShuZXcgVGFza0V4ZWN1dGlvbkltcGwodGhpcywgZXhlY3V0aW9uLmlkLCB0YXNrKSk7XG5cdFx0fVxuXHRcdHRoaXMuX3Rhc2tFeGVjdXRpb25Qcm9taXNlcy5zZXQoZXhlY3V0aW9uLmlkLCBleGVjdXRpb25Qcm9taXNlKTtcblx0XHRyZXR1cm4gZXhlY3V0aW9uUHJvbWlzZS50aGVuKHRhc2tFeGVjdXRpb24gPT4ge1xuXHRcdFx0dGhpcy5fdGFza0V4ZWN1dGlvbnMuc2V0KGV4ZWN1dGlvbi5pZCwgdGFza0V4ZWN1dGlvbik7XG5cdFx0XHRyZXR1cm4gdGFza0V4ZWN1dGlvbjtcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBjaGVja0RlcHJlY2F0aW9uKHRhc2s6IHZzY29kZS5UYXNrLCBoYW5kbGVyOiBIYW5kbGVyRGF0YSkge1xuXHRcdGNvbnN0IHRUYXNrID0gKHRhc2sgYXMgdHlwZXMuVGFzayk7XG5cdFx0aWYgKHRUYXNrLl9kZXByZWNhdGVkKSB7XG5cdFx0XHR0aGlzLl9kZXByZWNhdGlvblNlcnZpY2UucmVwb3J0KCdUYXNrLmNvbnN0cnVjdG9yJywgaGFuZGxlci5leHRlbnNpb24sICdVc2UgdGhlIFRhc2sgY29uc3RydWN0b3IgdGhhdCB0YWtlcyBhIGBzY29wZWAgaW5zdGVhZC4nKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGN1c3RvbUV4ZWN1dGlvbkNvbXBsZXRlKGV4ZWN1dGlvbjogdGFza3MuSVRhc2tFeGVjdXRpb25EVE8pOiB2b2lkIHtcblx0XHRjb25zdCBleHRlbnNpb25DYWxsYmFjazI6IHZzY29kZS5DdXN0b21FeGVjdXRpb24gfCB1bmRlZmluZWQgPSB0aGlzLl9hY3RpdmVDdXN0b21FeGVjdXRpb25zMi5nZXQoZXhlY3V0aW9uLmlkKTtcblx0XHRpZiAoZXh0ZW5zaW9uQ2FsbGJhY2syKSB7XG5cdFx0XHR0aGlzLl9hY3RpdmVDdXN0b21FeGVjdXRpb25zMi5kZWxldGUoZXhlY3V0aW9uLmlkKTtcblx0XHR9XG5cblx0XHQvLyBUZWNobmljYWxseSB3ZSBkb24ndCByZWFsbHkgbmVlZCB0byBkbyB0aGlzLCBob3dldmVyLCBpZiBhbiBleHRlbnNpb25cblx0XHQvLyBpcyBleGVjdXRpbmcgYSB0YXNrIHRocm91Z2ggXCJleGVjdXRlVGFza1wiIG92ZXIgYW5kIG92ZXIgYWdhaW5cblx0XHQvLyB3aXRoIGRpZmZlcmVudCBwcm9wZXJ0aWVzIGluIHRoZSB0YXNrIGRlZmluaXRpb24sIHRoZW4gdGhlIG1hcCBvZiBleGVjdXRpb25zXG5cdFx0Ly8gY291bGQgZ3JvdyBpbmRlZmluaXRlbHksIHNvbWV0aGluZyB3ZSBkb24ndCB3YW50LlxuXHRcdGlmICh0aGlzLl9ub3RQcm92aWRlZEN1c3RvbUV4ZWN1dGlvbnMuaGFzKGV4ZWN1dGlvbi5pZCkgJiYgKHRoaXMuX2xhc3RTdGFydGVkVGFzayAhPT0gZXhlY3V0aW9uLmlkKSkge1xuXHRcdFx0dGhpcy5fcHJvdmlkZWRDdXN0b21FeGVjdXRpb25zMi5kZWxldGUoZXhlY3V0aW9uLmlkKTtcblx0XHRcdHRoaXMuX25vdFByb3ZpZGVkQ3VzdG9tRXhlY3V0aW9ucy5kZWxldGUoZXhlY3V0aW9uLmlkKTtcblx0XHR9XG5cdFx0Y29uc3QgaXRlcmF0b3IgPSB0aGlzLl9ub3RQcm92aWRlZEN1c3RvbUV4ZWN1dGlvbnMudmFsdWVzKCk7XG5cdFx0bGV0IGl0ZXJhdG9yUmVzdWx0ID0gaXRlcmF0b3IubmV4dCgpO1xuXHRcdHdoaWxlICghaXRlcmF0b3JSZXN1bHQuZG9uZSkge1xuXHRcdFx0aWYgKCF0aGlzLl9hY3RpdmVDdXN0b21FeGVjdXRpb25zMi5oYXMoaXRlcmF0b3JSZXN1bHQudmFsdWUpICYmICh0aGlzLl9sYXN0U3RhcnRlZFRhc2sgIT09IGl0ZXJhdG9yUmVzdWx0LnZhbHVlKSkge1xuXHRcdFx0XHR0aGlzLl9wcm92aWRlZEN1c3RvbUV4ZWN1dGlvbnMyLmRlbGV0ZShpdGVyYXRvclJlc3VsdC52YWx1ZSk7XG5cdFx0XHRcdHRoaXMuX25vdFByb3ZpZGVkQ3VzdG9tRXhlY3V0aW9ucy5kZWxldGUoaXRlcmF0b3JSZXN1bHQudmFsdWUpO1xuXHRcdFx0fVxuXHRcdFx0aXRlcmF0b3JSZXN1bHQgPSBpdGVyYXRvci5uZXh0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFic3RyYWN0ICRqc29uVGFza3NTdXBwb3J0ZWQoKTogUHJvbWlzZTxib29sZWFuPjtcblxuXHRwdWJsaWMgYWJzdHJhY3QgJGZpbmRFeGVjdXRhYmxlKGNvbW1hbmQ6IHN0cmluZywgY3dkPzogc3RyaW5nIHwgdW5kZWZpbmVkLCBwYXRocz86IHN0cmluZ1tdIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+O1xufVxuXG5leHBvcnQgY2xhc3MgV29ya2VyRXh0SG9zdFRhc2sgZXh0ZW5kcyBFeHRIb3N0VGFza0Jhc2Uge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dEhvc3RScGNTZXJ2aWNlIGV4dEhvc3RScGM6IElFeHRIb3N0UnBjU2VydmljZSxcblx0XHRASUV4dEhvc3RJbml0RGF0YVNlcnZpY2UgaW5pdERhdGE6IElFeHRIb3N0SW5pdERhdGFTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdFdvcmtzcGFjZSB3b3Jrc3BhY2VTZXJ2aWNlOiBJRXh0SG9zdFdvcmtzcGFjZSxcblx0XHRASUV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzIGVkaXRvclNlcnZpY2U6IElFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyxcblx0XHRASUV4dEhvc3RDb25maWd1cmF0aW9uIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJRXh0SG9zdENvbmZpZ3VyYXRpb24sXG5cdFx0QElFeHRIb3N0VGVybWluYWxTZXJ2aWNlIGV4dEhvc3RUZXJtaW5hbFNlcnZpY2U6IElFeHRIb3N0VGVybWluYWxTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUV4dEhvc3RBcGlEZXByZWNhdGlvblNlcnZpY2UgZGVwcmVjYXRpb25TZXJ2aWNlOiBJRXh0SG9zdEFwaURlcHJlY2F0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihleHRIb3N0UnBjLCBpbml0RGF0YSwgd29ya3NwYWNlU2VydmljZSwgZWRpdG9yU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGV4dEhvc3RUZXJtaW5hbFNlcnZpY2UsIGxvZ1NlcnZpY2UsIGRlcHJlY2F0aW9uU2VydmljZSk7XG5cdFx0dGhpcy5yZWdpc3RlclRhc2tTeXN0ZW0oU2NoZW1hcy52c2NvZGVSZW1vdGUsIHtcblx0XHRcdHNjaGVtZTogU2NoZW1hcy52c2NvZGVSZW1vdGUsXG5cdFx0XHRhdXRob3JpdHk6ICcnLFxuXHRcdFx0cGxhdGZvcm06IFBsYXRmb3JtLlBsYXRmb3JtVG9TdHJpbmcoUGxhdGZvcm0uUGxhdGZvcm0uV2ViKVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGV4ZWN1dGVUYXNrKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCB0YXNrOiB2c2NvZGUuVGFzayk6IFByb21pc2U8dnNjb2RlLlRhc2tFeGVjdXRpb24+IHtcblx0XHRpZiAoIXRhc2suZXhlY3V0aW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Rhc2tzIHRvIGV4ZWN1dGUgbXVzdCBpbmNsdWRlIGFuIGV4ZWN1dGlvbicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGR0byA9IFRhc2tEVE8uZnJvbSh0YXNrLCBleHRlbnNpb24pO1xuXHRcdGlmIChkdG8gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdUYXNrIGlzIG5vdCB2YWxpZCcpO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoaXMgdGFzayBpcyBhIGN1c3RvbSBleGVjdXRpb24sIHRoZW4gd2UgbmVlZCB0byBzYXZlIGl0IGF3YXlcblx0XHQvLyBpbiB0aGUgcHJvdmlkZWQgY3VzdG9tIGV4ZWN1dGlvbiBtYXAgdGhhdCBpcyBjbGVhbmVkIHVwIGFmdGVyIHRoZVxuXHRcdC8vIHRhc2sgaXMgZXhlY3V0ZWQuXG5cdFx0aWYgKEN1c3RvbUV4ZWN1dGlvbkRUTy5pcyhkdG8uZXhlY3V0aW9uKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5hZGRDdXN0b21FeGVjdXRpb24oZHRvLCB0YXNrLCBmYWxzZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBOb3RTdXBwb3J0ZWRFcnJvcigpO1xuXHRcdH1cblxuXHRcdC8vIEFsd2F5cyBnZXQgdGhlIHRhc2sgZXhlY3V0aW9uIGZpcnN0IHRvIHByZXZlbnQgdGltaW5nIGlzc3VlcyB3aGVuIHJldHJpZXZpbmcgaXQgbGF0ZXJcblx0XHRjb25zdCBleGVjdXRpb24gPSBhd2FpdCB0aGlzLmdldFRhc2tFeGVjdXRpb24oYXdhaXQgdGhpcy5fcHJveHkuJGdldFRhc2tFeGVjdXRpb24oZHRvKSwgdGFzayk7XG5cdFx0dGhpcy5fcHJveHkuJGV4ZWN1dGVUYXNrKGR0bykuY2F0Y2goZXJyb3IgPT4geyB0aHJvdyBuZXcgRXJyb3IoZXJyb3IpOyB9KTtcblx0XHRyZXR1cm4gZXhlY3V0aW9uO1xuXHR9XG5cblx0cHJvdGVjdGVkIHByb3ZpZGVUYXNrc0ludGVybmFsKHZhbGlkVHlwZXM6IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9LCB0YXNrSWRQcm9taXNlczogUHJvbWlzZTx2b2lkPltdLCBoYW5kbGVyOiBIYW5kbGVyRGF0YSwgdmFsdWU6IHZzY29kZS5UYXNrW10gfCBudWxsIHwgdW5kZWZpbmVkKTogeyB0YXNrczogdGFza3MuSVRhc2tEVE9bXTsgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSB7XG5cdFx0Y29uc3QgdGFza0RUT3M6IHRhc2tzLklUYXNrRFRPW10gPSBbXTtcblx0XHRpZiAodmFsdWUpIHtcblx0XHRcdGZvciAoY29uc3QgdGFzayBvZiB2YWx1ZSkge1xuXHRcdFx0XHR0aGlzLmNoZWNrRGVwcmVjYXRpb24odGFzaywgaGFuZGxlcik7XG5cdFx0XHRcdGlmICghdGFzay5kZWZpbml0aW9uIHx8ICF2YWxpZFR5cGVzW3Rhc2suZGVmaW5pdGlvbi50eXBlXSkge1xuXHRcdFx0XHRcdGNvbnN0IHNvdXJjZSA9IHRhc2suc291cmNlID8gdGFzay5zb3VyY2UgOiAnTm8gdGFzayBzb3VyY2UnO1xuXHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgVGhlIHRhc2sgWyR7c291cmNlfSwgJHt0YXNrLm5hbWV9XSB1c2VzIGFuIHVuZGVmaW5lZCB0YXNrIHR5cGUuIFRoZSB0YXNrIHdpbGwgYmUgaWdub3JlZCBpbiB0aGUgZnV0dXJlLmApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdGFza0RUTzogdGFza3MuSVRhc2tEVE8gfCB1bmRlZmluZWQgPSBUYXNrRFRPLmZyb20odGFzaywgaGFuZGxlci5leHRlbnNpb24pO1xuXHRcdFx0XHRpZiAodGFza0RUTyAmJiBDdXN0b21FeGVjdXRpb25EVE8uaXModGFza0RUTy5leGVjdXRpb24pKSB7XG5cdFx0XHRcdFx0dGFza0RUT3MucHVzaCh0YXNrRFRPKTtcblx0XHRcdFx0XHQvLyBUaGUgSUQgaXMgY2FsY3VsYXRlZCBvbiB0aGUgbWFpbiB0aHJlYWQgdGFzayBzaWRlLCBzbywgbGV0J3MgY2FsbCBpbnRvIGl0IGhlcmUuXG5cdFx0XHRcdFx0Ly8gV2UgbmVlZCB0aGUgdGFzayBpZCdzIHByZS1jb21wdXRlZCBmb3IgY3VzdG9tIHRhc2sgZXhlY3V0aW9ucyBiZWNhdXNlIHdoZW4gT25EaWRTdGFydFRhc2tcblx0XHRcdFx0XHQvLyBpcyBpbnZva2VkLCB3ZSBoYXZlIHRvIGJlIGFibGUgdG8gbWFwIGl0IGJhY2sgdG8gb3VyIGRhdGEuXG5cdFx0XHRcdFx0dGFza0lkUHJvbWlzZXMucHVzaCh0aGlzLmFkZEN1c3RvbUV4ZWN1dGlvbih0YXNrRFRPLCB0YXNrLCB0cnVlKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdPbmx5IGN1c3RvbSBleGVjdXRpb24gdGFza3Mgc3VwcG9ydGVkLicpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHR0YXNrczogdGFza0RUT3MsXG5cdFx0XHRleHRlbnNpb246IGhhbmRsZXIuZXh0ZW5zaW9uXG5cdFx0fTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyByZXNvbHZlVGFza0ludGVybmFsKHJlc29sdmVkVGFza0RUTzogdGFza3MuSVRhc2tEVE8pOiBQcm9taXNlPHRhc2tzLklUYXNrRFRPIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKEN1c3RvbUV4ZWN1dGlvbkRUTy5pcyhyZXNvbHZlZFRhc2tEVE8uZXhlY3V0aW9uKSkge1xuXHRcdFx0cmV0dXJuIHJlc29sdmVkVGFza0RUTztcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdPbmx5IGN1c3RvbSBleGVjdXRpb24gdGFza3Mgc3VwcG9ydGVkLicpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRyZXNvbHZlVmFyaWFibGVzKHVyaUNvbXBvbmVudHM6IFVyaUNvbXBvbmVudHMsIHRvUmVzb2x2ZTogeyBwcm9jZXNzPzogeyBuYW1lOiBzdHJpbmc7IGN3ZD86IHN0cmluZzsgcGF0aD86IHN0cmluZyB9OyB2YXJpYWJsZXM6IHN0cmluZ1tdIH0pOiBQcm9taXNlPHsgcHJvY2Vzcz86IHN0cmluZzsgdmFyaWFibGVzOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9IH0+IHtcblx0XHRjb25zdCByZXN1bHQgPSB7XG5cdFx0XHRwcm9jZXNzOiA8dW5rbm93bj51bmRlZmluZWQgYXMgc3RyaW5nLFxuXHRcdFx0dmFyaWFibGVzOiBPYmplY3QuY3JlYXRlKG51bGwpXG5cdFx0fTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRqc29uVGFza3NTdXBwb3J0ZWQoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRmaW5kRXhlY3V0YWJsZShjb21tYW5kOiBzdHJpbmcsIGN3ZD86IHN0cmluZyB8IHVuZGVmaW5lZCwgcGF0aHM/OiBzdHJpbmdbXSB8IHVuZGVmaW5lZCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgSUV4dEhvc3RUYXNrID0gY3JlYXRlRGVjb3JhdG9yPElFeHRIb3N0VGFzaz4oJ0lFeHRIb3N0VGFzaycpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7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QU87QUFDTixlQUFLLFlBQVksS0FBSyx3Q0FBd0M7QUFBQSxRQUMvRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsV0FBVyxRQUFRO0FBQUEsSUFDcEI7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFnQixvQkFBb0IsaUJBQXNFO0FBQ3pHLFFBQUksbUJBQW1CLEdBQUcsZ0JBQWdCLFNBQVMsR0FBRztBQUNyRCxhQUFPO0FBQUEsSUFDUixPQUFPO0FBQ04sV0FBSyxZQUFZLEtBQUssd0NBQXdDO0FBQUEsSUFDL0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYSxrQkFBa0IsZUFBOEIsV0FBa0s7QUFDOU4sVUFBTSxTQUFTO0FBQUEsTUFDZCxTQUFrQjtBQUFBLE1BQ2xCLFdBQVcsdUJBQU8sT0FBTyxJQUFJO0FBQUEsSUFDOUI7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYSxzQkFBd0M7QUFDcEQsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWEsZ0JBQWdCLFNBQWlCLEtBQTBCLE9BQTJEO0FBQ2xJLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFoR2Esb0JBQU47QUFBQSxFQUVKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBVFU7QUFrR04sTUFBTSxlQUFlLGdCQUE4QixjQUFjOyIsCiAgIm5hbWVzIjogWyJUYXNrRGVmaW5pdGlvbkRUTyIsICJUYXNrUHJlc2VudGF0aW9uT3B0aW9uc0RUTyIsICJQcm9jZXNzRXhlY3V0aW9uT3B0aW9uc0RUTyIsICJQcm9jZXNzRXhlY3V0aW9uRFRPIiwgIlNoZWxsRXhlY3V0aW9uT3B0aW9uc0RUTyIsICJTaGVsbEV4ZWN1dGlvbkRUTyIsICJDdXN0b21FeGVjdXRpb25EVE8iLCAiVGFza0hhbmRsZURUTyIsICJUYXNrR3JvdXBEVE8iLCAiVGFza0RUTyIsICJ0YXNrcyIsICJUYXNrRmlsdGVyRFRPIl0KfQo=
