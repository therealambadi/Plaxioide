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
import * as nls from "../../../nls.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import * as Types from "../../../base/common/types.js";
import * as Platform from "../../../base/common/platform.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IWorkspaceContextService } from "../../../platform/workspace/common/workspace.js";
import {
  ContributedTask,
  ConfiguringTask,
  CommandOptions,
  RuntimeType,
  CustomTask,
  TaskScope,
  TaskSourceKind,
  TaskDefinition,
  PresentationOptions,
  RunOptions
} from "../../contrib/tasks/common/tasks.js";
import { ITaskService } from "../../contrib/tasks/common/taskService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import {
  TaskEventKind
} from "../common/shared/tasks.js";
import { IConfigurationResolverService } from "../../services/configurationResolver/common/configurationResolver.js";
import { ErrorNoTelemetry } from "../../../base/common/errors.js";
import { ConfigurationResolverExpression } from "../../services/configurationResolver/common/configurationResolverExpression.js";
var TaskExecutionDTO;
((TaskExecutionDTO2) => {
  function from(value) {
    return {
      id: value.id,
      task: TaskDTO.from(value.task)
    };
  }
  TaskExecutionDTO2.from = from;
})(TaskExecutionDTO || (TaskExecutionDTO = {}));
var TaskProblemMatcherStartedDto;
((TaskProblemMatcherStartedDto2) => {
  function from(value) {
    return {
      execution: {
        id: value.execution.id,
        task: TaskDTO.from(value.execution.task)
      }
    };
  }
  TaskProblemMatcherStartedDto2.from = from;
})(TaskProblemMatcherStartedDto || (TaskProblemMatcherStartedDto = {}));
var TaskProblemMatcherEndedDto;
((TaskProblemMatcherEndedDto2) => {
  function from(value) {
    return {
      execution: {
        id: value.execution.id,
        task: TaskDTO.from(value.execution.task)
      },
      hasErrors: value.hasErrors
    };
  }
  TaskProblemMatcherEndedDto2.from = from;
})(TaskProblemMatcherEndedDto || (TaskProblemMatcherEndedDto = {}));
var TaskProcessStartedDTO;
((TaskProcessStartedDTO2) => {
  function from(value, processId) {
    return {
      id: value.id,
      processId
    };
  }
  TaskProcessStartedDTO2.from = from;
})(TaskProcessStartedDTO || (TaskProcessStartedDTO = {}));
var TaskProcessEndedDTO;
((TaskProcessEndedDTO2) => {
  function from(value, exitCode) {
    return {
      id: value.id,
      exitCode
    };
  }
  TaskProcessEndedDTO2.from = from;
})(TaskProcessEndedDTO || (TaskProcessEndedDTO = {}));
var TaskDefinitionDTO;
((TaskDefinitionDTO2) => {
  function from(value) {
    const result = Object.assign(/* @__PURE__ */ Object.create(null), value);
    delete result._key;
    return result;
  }
  TaskDefinitionDTO2.from = from;
  function to(value, executeOnly) {
    let result = TaskDefinition.createTaskIdentifier(value, console);
    if (result === void 0 && executeOnly) {
      result = {
        _key: generateUuid(),
        type: "$executeOnly"
      };
    }
    return result;
  }
  TaskDefinitionDTO2.to = to;
})(TaskDefinitionDTO || (TaskDefinitionDTO = {}));
var TaskPresentationOptionsDTO;
((TaskPresentationOptionsDTO2) => {
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return Object.assign(/* @__PURE__ */ Object.create(null), value);
  }
  TaskPresentationOptionsDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null) {
      return PresentationOptions.defaults;
    }
    return Object.assign(/* @__PURE__ */ Object.create(null), PresentationOptions.defaults, value);
  }
  TaskPresentationOptionsDTO2.to = to;
})(TaskPresentationOptionsDTO || (TaskPresentationOptionsDTO = {}));
var RunOptionsDTO;
((RunOptionsDTO2) => {
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return Object.assign(/* @__PURE__ */ Object.create(null), value);
  }
  RunOptionsDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null) {
      return RunOptions.defaults;
    }
    return Object.assign(/* @__PURE__ */ Object.create(null), RunOptions.defaults, value);
  }
  RunOptionsDTO2.to = to;
})(RunOptionsDTO || (RunOptionsDTO = {}));
var ProcessExecutionOptionsDTO;
((ProcessExecutionOptionsDTO2) => {
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    return {
      cwd: value.cwd,
      env: value.env
    };
  }
  ProcessExecutionOptionsDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null) {
      return CommandOptions.defaults;
    }
    return {
      cwd: value.cwd || CommandOptions.defaults.cwd,
      env: value.env
    };
  }
  ProcessExecutionOptionsDTO2.to = to;
})(ProcessExecutionOptionsDTO || (ProcessExecutionOptionsDTO = {}));
var ProcessExecutionDTO;
((ProcessExecutionDTO2) => {
  function is(value) {
    const candidate = value;
    return candidate && !!candidate.process;
  }
  ProcessExecutionDTO2.is = is;
  function from(value) {
    const process = Types.isString(value.name) ? value.name : value.name.value;
    const args = value.args ? value.args.map((value2) => Types.isString(value2) ? value2 : value2.value) : [];
    const result = {
      process,
      args
    };
    if (value.options) {
      result.options = ProcessExecutionOptionsDTO.from(value.options);
    }
    return result;
  }
  ProcessExecutionDTO2.from = from;
  function to(value) {
    const result = {
      runtime: RuntimeType.Process,
      name: value.process,
      args: value.args,
      presentation: void 0
    };
    result.options = ProcessExecutionOptionsDTO.to(value.options);
    return result;
  }
  ProcessExecutionDTO2.to = to;
})(ProcessExecutionDTO || (ProcessExecutionDTO = {}));
var ShellExecutionOptionsDTO;
((ShellExecutionOptionsDTO2) => {
  function from(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    const result = {
      cwd: value.cwd || CommandOptions.defaults.cwd,
      env: value.env
    };
    if (value.shell) {
      result.executable = value.shell.executable;
      result.shellArgs = value.shell.args;
      result.shellQuoting = value.shell.quoting;
    }
    return result;
  }
  ShellExecutionOptionsDTO2.from = from;
  function to(value) {
    if (value === void 0 || value === null) {
      return void 0;
    }
    const result = {
      cwd: value.cwd,
      env: value.env
    };
    if (value.executable) {
      result.shell = {
        executable: value.executable
      };
      if (value.shellArgs) {
        result.shell.args = value.shellArgs;
      }
      if (value.shellQuoting) {
        result.shell.quoting = value.shellQuoting;
      }
    }
    return result;
  }
  ShellExecutionOptionsDTO2.to = to;
})(ShellExecutionOptionsDTO || (ShellExecutionOptionsDTO = {}));
var ShellExecutionDTO;
((ShellExecutionDTO2) => {
  function is(value) {
    const candidate = value;
    return candidate && (!!candidate.commandLine || !!candidate.command);
  }
  ShellExecutionDTO2.is = is;
  function from(value) {
    const result = {};
    if (value.name && Types.isString(value.name) && (value.args === void 0 || value.args === null || value.args.length === 0)) {
      result.commandLine = value.name;
    } else {
      result.command = value.name;
      result.args = value.args;
    }
    if (value.options) {
      result.options = ShellExecutionOptionsDTO.from(value.options);
    }
    return result;
  }
  ShellExecutionDTO2.from = from;
  function to(value) {
    const result = {
      runtime: RuntimeType.Shell,
      name: value.commandLine ? value.commandLine : value.command,
      args: value.args,
      presentation: void 0
    };
    if (value.options) {
      result.options = ShellExecutionOptionsDTO.to(value.options);
    }
    return result;
  }
  ShellExecutionDTO2.to = to;
})(ShellExecutionDTO || (ShellExecutionDTO = {}));
var CustomExecutionDTO;
((CustomExecutionDTO2) => {
  function is(value) {
    const candidate = value;
    return candidate && candidate.customExecution === "customExecution";
  }
  CustomExecutionDTO2.is = is;
  function from(value) {
    return {
      customExecution: "customExecution"
    };
  }
  CustomExecutionDTO2.from = from;
  function to(value) {
    return {
      runtime: RuntimeType.CustomExecution,
      presentation: void 0
    };
  }
  CustomExecutionDTO2.to = to;
})(CustomExecutionDTO || (CustomExecutionDTO = {}));
var TaskSourceDTO;
((TaskSourceDTO2) => {
  function from(value) {
    const result = {
      label: value.label
    };
    if (value.kind === TaskSourceKind.Extension) {
      result.extensionId = value.extension;
      if (value.workspaceFolder) {
        result.scope = value.workspaceFolder.uri;
      } else {
        result.scope = value.scope;
      }
    } else if (value.kind === TaskSourceKind.Workspace) {
      result.extensionId = "$core";
      result.scope = value.config.workspaceFolder ? value.config.workspaceFolder.uri : TaskScope.Global;
    }
    return result;
  }
  TaskSourceDTO2.from = from;
  function to(value, workspace) {
    let scope;
    let workspaceFolder;
    if (value.scope === void 0 || typeof value.scope === "number" && value.scope !== TaskScope.Global) {
      if (workspace.getWorkspace().folders.length === 0) {
        scope = TaskScope.Global;
        workspaceFolder = void 0;
      } else {
        scope = TaskScope.Folder;
        workspaceFolder = workspace.getWorkspace().folders[0];
      }
    } else if (typeof value.scope === "number") {
      scope = value.scope;
    } else {
      scope = TaskScope.Folder;
      workspaceFolder = workspace.getWorkspaceFolder(URI.revive(value.scope)) ?? void 0;
    }
    const result = {
      kind: TaskSourceKind.Extension,
      label: value.label,
      extension: value.extensionId,
      scope,
      workspaceFolder
    };
    return result;
  }
  TaskSourceDTO2.to = to;
})(TaskSourceDTO || (TaskSourceDTO = {}));
var TaskHandleDTO;
((TaskHandleDTO2) => {
  function is(value) {
    const candidate = value;
    return candidate && Types.isString(candidate.id) && !!candidate.workspaceFolder;
  }
  TaskHandleDTO2.is = is;
})(TaskHandleDTO || (TaskHandleDTO = {}));
var TaskDTO;
((TaskDTO2) => {
  function from(task) {
    if (task === void 0 || task === null || !CustomTask.is(task) && !ContributedTask.is(task) && !ConfiguringTask.is(task)) {
      return void 0;
    }
    const result = {
      _id: task._id,
      name: task.configurationProperties.name,
      definition: TaskDefinitionDTO.from(task.getDefinition(true)),
      source: TaskSourceDTO.from(task._source),
      execution: void 0,
      presentationOptions: !ConfiguringTask.is(task) && task.command ? TaskPresentationOptionsDTO.from(task.command.presentation) : void 0,
      isBackground: task.configurationProperties.isBackground,
      problemMatchers: [],
      hasDefinedMatchers: ContributedTask.is(task) ? task.hasDefinedMatchers : false,
      runOptions: RunOptionsDTO.from(task.runOptions)
    };
    result.group = TaskGroupDTO.from(task.configurationProperties.group);
    if (task.configurationProperties.detail) {
      result.detail = task.configurationProperties.detail;
    }
    if (!ConfiguringTask.is(task) && task.command) {
      switch (task.command.runtime) {
        case RuntimeType.Process:
          result.execution = ProcessExecutionDTO.from(task.command);
          break;
        case RuntimeType.Shell:
          result.execution = ShellExecutionDTO.from(task.command);
          break;
        case RuntimeType.CustomExecution:
          result.execution = CustomExecutionDTO.from(task.command);
          break;
      }
    }
    if (task.configurationProperties.problemMatchers) {
      for (const matcher of task.configurationProperties.problemMatchers) {
        if (Types.isString(matcher)) {
          result.problemMatchers.push(matcher);
        }
      }
    }
    return result;
  }
  TaskDTO2.from = from;
  function to(task, workspace, executeOnly, icon, hide) {
    if (!task || typeof task.name !== "string") {
      return void 0;
    }
    let command;
    if (task.execution) {
      if (ShellExecutionDTO.is(task.execution)) {
        command = ShellExecutionDTO.to(task.execution);
      } else if (ProcessExecutionDTO.is(task.execution)) {
        command = ProcessExecutionDTO.to(task.execution);
      } else if (CustomExecutionDTO.is(task.execution)) {
        command = CustomExecutionDTO.to(task.execution);
      }
    }
    if (!command) {
      return void 0;
    }
    command.presentation = TaskPresentationOptionsDTO.to(task.presentationOptions);
    const source = TaskSourceDTO.to(task.source, workspace);
    const label = nls.localize("task.label", "{0}: {1}", source.label, task.name);
    const definition = TaskDefinitionDTO.to(task.definition, executeOnly);
    const id = CustomExecutionDTO.is(task.execution) && task._id ? task._id : `${task.source.extensionId}.${definition._key}`;
    const result = new ContributedTask(
      id,
      // uuidMap.getUUID(identifier)
      source,
      label,
      definition.type,
      definition,
      command,
      task.hasDefinedMatchers,
      RunOptionsDTO.to(task.runOptions),
      {
        name: task.name,
        identifier: label,
        group: task.group,
        isBackground: !!task.isBackground,
        problemMatchers: task.problemMatchers.slice(),
        detail: task.detail,
        icon,
        hide
      }
    );
    return result;
  }
  TaskDTO2.to = to;
})(TaskDTO || (TaskDTO = {}));
var TaskGroupDTO;
((TaskGroupDTO2) => {
  function from(value) {
    if (value === void 0) {
      return void 0;
    }
    return {
      _id: typeof value === "string" ? value : value._id,
      isDefault: typeof value === "string" ? false : typeof value.isDefault === "string" ? false : value.isDefault
    };
  }
  TaskGroupDTO2.from = from;
})(TaskGroupDTO || (TaskGroupDTO = {}));
var TaskFilterDTO;
((TaskFilterDTO2) => {
  function from(value) {
    return value;
  }
  TaskFilterDTO2.from = from;
  function to(value) {
    return value;
  }
  TaskFilterDTO2.to = to;
})(TaskFilterDTO || (TaskFilterDTO = {}));
let MainThreadTask = class extends Disposable {
  constructor(extHostContext, _taskService, _workspaceContextServer, _configurationResolverService) {
    super();
    this._taskService = _taskService;
    this._workspaceContextServer = _workspaceContextServer;
    this._configurationResolverService = _configurationResolverService;
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostTask);
    this._providers = /* @__PURE__ */ new Map();
    this._register(this._taskService.onDidStateChange(async (event) => {
      if (event.kind === TaskEventKind.Changed) {
        return;
      }
      const task = event.__task;
      if (event.kind === TaskEventKind.Start) {
        const execution = TaskExecutionDTO.from(task.getTaskExecution());
        let resolvedDefinition = execution.task.definition;
        if (execution.task?.execution && CustomExecutionDTO.is(execution.task.execution) && event.resolvedVariables) {
          const expr = ConfigurationResolverExpression.parse(execution.task.definition);
          for (const replacement of expr.unresolved()) {
            const value = event.resolvedVariables.get(replacement.inner);
            if (value !== void 0) {
              expr.resolve(replacement, value);
            }
          }
          resolvedDefinition = await this._configurationResolverService.resolveAsync(task.getWorkspaceFolder(), expr);
        }
        this._proxy.$onDidStartTask(execution, event.terminalId, resolvedDefinition);
      } else if (event.kind === TaskEventKind.ProcessStarted) {
        this._proxy.$onDidStartTaskProcess(TaskProcessStartedDTO.from(task.getTaskExecution(), event.processId));
      } else if (event.kind === TaskEventKind.ProcessEnded) {
        this._proxy.$onDidEndTaskProcess(TaskProcessEndedDTO.from(task.getTaskExecution(), event.exitCode));
      } else if (event.kind === TaskEventKind.End) {
        this._proxy.$OnDidEndTask(TaskExecutionDTO.from(task.getTaskExecution()));
      } else if (event.kind === TaskEventKind.ProblemMatcherStarted) {
        this._proxy.$onDidStartTaskProblemMatchers(TaskProblemMatcherStartedDto.from({ execution: task.getTaskExecution() }));
      } else if (event.kind === TaskEventKind.ProblemMatcherEnded) {
        this._proxy.$onDidEndTaskProblemMatchers(TaskProblemMatcherEndedDto.from({ execution: task.getTaskExecution(), hasErrors: false }));
      } else if (event.kind === TaskEventKind.ProblemMatcherFoundErrors) {
        this._proxy.$onDidEndTaskProblemMatchers(TaskProblemMatcherEndedDto.from({ execution: task.getTaskExecution(), hasErrors: true }));
      }
    }));
  }
  dispose() {
    for (const value of this._providers.values()) {
      value.disposable.dispose();
    }
    this._providers.clear();
    super.dispose();
  }
  $createTaskId(taskDTO) {
    return new Promise((resolve, reject) => {
      const task = TaskDTO.to(taskDTO, this._workspaceContextServer, true);
      if (task) {
        resolve(task._id);
      } else {
        reject(new Error("Task could not be created from DTO"));
      }
    });
  }
  $registerTaskProvider(handle, type) {
    const provider = {
      provideTasks: (validTypes) => {
        return Promise.resolve(this._proxy.$provideTasks(handle, validTypes)).then((value) => {
          const tasks = [];
          for (const dto of value.tasks) {
            const task = TaskDTO.to(dto, this._workspaceContextServer, true);
            if (task) {
              tasks.push(task);
            } else {
              console.error(`Task System: can not convert task: ${JSON.stringify(dto.definition, void 0, 0)}. Task will be dropped`);
            }
          }
          const processedExtension = {
            ...value.extension,
            extensionLocation: URI.revive(value.extension.extensionLocation)
          };
          return {
            tasks,
            extension: processedExtension
          };
        });
      },
      resolveTask: (task) => {
        const dto = TaskDTO.from(task);
        if (dto) {
          dto.name = dto.name === void 0 ? "" : dto.name;
          return Promise.resolve(this._proxy.$resolveTask(handle, dto)).then((resolvedTask) => {
            if (resolvedTask) {
              return TaskDTO.to(resolvedTask, this._workspaceContextServer, true, task.configurationProperties.icon, task.configurationProperties.hide);
            }
            return void 0;
          });
        }
        return Promise.resolve(void 0);
      }
    };
    const disposable = this._taskService.registerTaskProvider(provider, type);
    this._providers.set(handle, { disposable, provider });
    return Promise.resolve(void 0);
  }
  $unregisterTaskProvider(handle) {
    const provider = this._providers.get(handle);
    if (provider) {
      provider.disposable.dispose();
      this._providers.delete(handle);
    }
    return Promise.resolve(void 0);
  }
  $fetchTasks(filter) {
    return this._taskService.tasks(TaskFilterDTO.to(filter)).then((tasks) => {
      const result = [];
      for (const task of tasks) {
        const item = TaskDTO.from(task);
        if (item) {
          result.push(item);
        }
      }
      return result;
    });
  }
  getWorkspace(value) {
    let workspace;
    if (typeof value === "string") {
      workspace = value;
    } else {
      const workspaceObject = this._workspaceContextServer.getWorkspace();
      const uri = URI.revive(value);
      if (workspaceObject.configuration?.toString() === uri.toString()) {
        workspace = workspaceObject;
      } else {
        workspace = this._workspaceContextServer.getWorkspaceFolder(uri);
      }
    }
    return workspace;
  }
  async $getTaskExecution(value) {
    if (TaskHandleDTO.is(value)) {
      const workspace = this.getWorkspace(value.workspaceFolder);
      if (workspace) {
        const task = await this._taskService.getTask(workspace, value.id, true);
        if (task) {
          return {
            id: task._id,
            task: TaskDTO.from(task)
          };
        }
        throw new Error("Task not found");
      } else {
        throw new Error("No workspace folder");
      }
    } else {
      const task = TaskDTO.to(value, this._workspaceContextServer, true);
      return {
        id: task._id,
        task: TaskDTO.from(task)
      };
    }
  }
  // Passing in a TaskHandleDTO will cause the task to get re-resolved, which is important for tasks are coming from the core,
  // such as those gotten from a fetchTasks, since they can have missing configuration properties.
  $executeTask(value) {
    return new Promise((resolve, reject) => {
      if (TaskHandleDTO.is(value)) {
        const workspace = this.getWorkspace(value.workspaceFolder);
        if (workspace) {
          this._taskService.getTask(workspace, value.id, true).then((task) => {
            if (!task) {
              reject(new Error("Task not found"));
            } else {
              const result = {
                id: value.id,
                task: TaskDTO.from(task)
              };
              this._taskService.run(task).then((summary) => {
                if (summary?.exitCode === void 0 || summary.exitCode !== 0) {
                  this._proxy.$OnDidEndTask(result);
                }
              }, (reason) => {
              });
              resolve(result);
            }
          }, (_error) => {
            reject(new Error("Task not found"));
          });
        } else {
          reject(new Error("No workspace folder"));
        }
      } else {
        const task = TaskDTO.to(value, this._workspaceContextServer, true);
        this._taskService.run(task).then(void 0, (reason) => {
        });
        const result = {
          id: task._id,
          task: TaskDTO.from(task)
        };
        resolve(result);
      }
    });
  }
  $customExecutionComplete(id, result) {
    return new Promise((resolve, reject) => {
      this._taskService.getActiveTasks().then((tasks) => {
        for (const task of tasks) {
          if (id === task._id) {
            this._taskService.extensionCallbackTaskComplete(task, result).then((value) => {
              resolve(void 0);
            }, (error) => {
              reject(error);
            });
            return;
          }
        }
        reject(new Error("Task to mark as complete not found"));
      });
    });
  }
  $terminateTask(id) {
    return new Promise((resolve, reject) => {
      this._taskService.getActiveTasks().then((tasks) => {
        for (const task of tasks) {
          if (id === task._id) {
            this._taskService.terminate(task).then((value) => {
              resolve(void 0);
            }, (error) => {
              reject(void 0);
            });
            return;
          }
        }
        reject(new ErrorNoTelemetry("Task to terminate not found"));
      });
    });
  }
  $registerTaskSystem(key, info) {
    let platform;
    switch (info.platform) {
      case "Web":
        platform = Platform.Platform.Web;
        break;
      case "win32":
        platform = Platform.Platform.Windows;
        break;
      case "darwin":
        platform = Platform.Platform.Mac;
        break;
      case "linux":
        platform = Platform.Platform.Linux;
        break;
      default:
        platform = Platform.platform;
    }
    this._taskService.registerTaskSystem(key, {
      platform,
      uriProvider: (path) => {
        return URI.from({ scheme: info.scheme, authority: info.authority, path });
      },
      context: this._extHostContext,
      resolveVariables: (workspaceFolder, toResolve, target) => {
        const vars = [];
        toResolve.variables.forEach((item) => vars.push(item));
        return Promise.resolve(this._proxy.$resolveVariables(workspaceFolder.uri, { process: toResolve.process, variables: vars })).then((values) => {
          const partiallyResolvedVars = Array.from(Object.values(values.variables));
          return new Promise((resolve, reject) => {
            this._configurationResolverService.resolveWithInteraction(workspaceFolder, partiallyResolvedVars, "tasks", void 0, target).then((resolvedVars) => {
              if (!resolvedVars) {
                resolve(void 0);
              }
              const result = {
                process: void 0,
                variables: /* @__PURE__ */ new Map()
              };
              for (let i = 0; i < partiallyResolvedVars.length; i++) {
                const variableName = vars[i].substring(2, vars[i].length - 1);
                if (resolvedVars && values.variables[vars[i]] === vars[i]) {
                  const resolved = resolvedVars.get(variableName);
                  if (typeof resolved === "string") {
                    result.variables.set(variableName, resolved);
                  }
                } else {
                  result.variables.set(variableName, partiallyResolvedVars[i]);
                }
              }
              if (Types.isString(values.process)) {
                result.process = values.process;
              }
              resolve(result);
            }, (reason) => {
              reject(reason);
            });
          });
        });
      },
      findExecutable: (command, cwd, paths) => {
        return this._proxy.$findExecutable(command, cwd, paths);
      }
    });
  }
  async $registerSupportedExecutions(custom, shell, process) {
    return this._taskService.registerSupportedExecutions(custom, shell, process);
  }
};
MainThreadTask = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadTask),
  __decorateParam(1, ITaskService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IConfigurationResolverService)
], MainThreadTask);
export {
  MainThreadTask,
  TaskProblemMatcherEndedDto,
  TaskProblemMatcherStartedDto
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFRhc2sudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcblxuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0ICogYXMgUGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmltcG9ydCB7IElXb3Jrc3BhY2UsIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgSVdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcblxuaW1wb3J0IHtcblx0Q29udHJpYnV0ZWRUYXNrLCBDb25maWd1cmluZ1Rhc2ssIEtleWVkVGFza0lkZW50aWZpZXIsIElUYXNrRXhlY3V0aW9uLCBUYXNrLCBJVGFza0V2ZW50LFxuXHRJUHJlc2VudGF0aW9uT3B0aW9ucywgQ29tbWFuZE9wdGlvbnMsIElDb21tYW5kQ29uZmlndXJhdGlvbiwgUnVudGltZVR5cGUsIEN1c3RvbVRhc2ssIFRhc2tTY29wZSwgVGFza1NvdXJjZSxcblx0VGFza1NvdXJjZUtpbmQsIElFeHRlbnNpb25UYXNrU291cmNlLCBJUnVuT3B0aW9ucywgSVRhc2tTZXQsIFRhc2tHcm91cCwgVGFza0RlZmluaXRpb24sIFByZXNlbnRhdGlvbk9wdGlvbnMsIFJ1bk9wdGlvbnNcbn0gZnJvbSAnLi4vLi4vY29udHJpYi90YXNrcy9jb21tb24vdGFza3MuanMnO1xuXG5cbmltcG9ydCB7IElSZXNvbHZlU2V0LCBJUmVzb2x2ZWRWYXJpYWJsZXMgfSBmcm9tICcuLi8uLi9jb250cmliL3Rhc2tzL2NvbW1vbi90YXNrU3lzdGVtLmpzJztcbmltcG9ydCB7IElUYXNrU2VydmljZSwgSVRhc2tGaWx0ZXIsIElUYXNrUHJvdmlkZXIgfSBmcm9tICcuLi8uLi9jb250cmliL3Rhc2tzL2NvbW1vbi90YXNrU2VydmljZS5qcyc7XG5cbmltcG9ydCB7IGV4dEhvc3ROYW1lZEN1c3RvbWVyLCBJRXh0SG9zdENvbnRleHQgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRIb3N0Q3VzdG9tZXJzLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb250ZXh0LCBNYWluVGhyZWFkVGFza1NoYXBlLCBFeHRIb3N0VGFza1NoYXBlLCBNYWluQ29udGV4dCB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7XG5cdElUYXNrRGVmaW5pdGlvbkRUTywgSVRhc2tFeGVjdXRpb25EVE8sIElQcm9jZXNzRXhlY3V0aW9uT3B0aW9uc0RUTywgSVRhc2tQcmVzZW50YXRpb25PcHRpb25zRFRPLFxuXHRJUHJvY2Vzc0V4ZWN1dGlvbkRUTywgSVNoZWxsRXhlY3V0aW9uRFRPLCBJU2hlbGxFeGVjdXRpb25PcHRpb25zRFRPLCBJQ3VzdG9tRXhlY3V0aW9uRFRPLCBJVGFza0RUTywgSVRhc2tTb3VyY2VEVE8sIElUYXNrSGFuZGxlRFRPLCBJVGFza0ZpbHRlckRUTywgSVRhc2tQcm9jZXNzU3RhcnRlZERUTywgSVRhc2tQcm9jZXNzRW5kZWREVE8sIElUYXNrU3lzdGVtSW5mb0RUTyxcblx0SVJ1bk9wdGlvbnNEVE8sIElUYXNrR3JvdXBEVE8sXG5cdElUYXNrUHJvYmxlbU1hdGNoZXJTdGFydGVkLFxuXHRJVGFza1Byb2JsZW1NYXRjaGVyRW5kZWQsXG5cdFRhc2tFdmVudEtpbmRcbn0gZnJvbSAnLi4vY29tbW9uL3NoYXJlZC90YXNrcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25UYXJnZXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEVycm9yTm9UZWxlbWV0cnkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uLmpzJztcblxubmFtZXNwYWNlIFRhc2tFeGVjdXRpb25EVE8ge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogSVRhc2tFeGVjdXRpb24pOiBJVGFza0V4ZWN1dGlvbkRUTyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiB2YWx1ZS5pZCxcblx0XHRcdHRhc2s6IFRhc2tEVE8uZnJvbSh2YWx1ZS50YXNrKVxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFza1Byb2JsZW1NYXRjaGVyU3RhcnRlZER0byB7XG5cdGV4ZWN1dGlvbjogSVRhc2tFeGVjdXRpb25EVE87XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVGFza1Byb2JsZW1NYXRjaGVyU3RhcnRlZER0byB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiBJVGFza1Byb2JsZW1NYXRjaGVyU3RhcnRlZCk6IElUYXNrUHJvYmxlbU1hdGNoZXJTdGFydGVkRHRvIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZXhlY3V0aW9uOiB7XG5cdFx0XHRcdGlkOiB2YWx1ZS5leGVjdXRpb24uaWQsXG5cdFx0XHRcdHRhc2s6IFRhc2tEVE8uZnJvbSh2YWx1ZS5leGVjdXRpb24udGFzaylcblx0XHRcdH0sXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUYXNrUHJvYmxlbU1hdGNoZXJFbmRlZER0byB7XG5cdGV4ZWN1dGlvbjogSVRhc2tFeGVjdXRpb25EVE87XG5cdGhhc0Vycm9yczogYm9vbGVhbjtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUYXNrUHJvYmxlbU1hdGNoZXJFbmRlZER0byB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiBJVGFza1Byb2JsZW1NYXRjaGVyRW5kZWQpOiBJVGFza1Byb2JsZW1NYXRjaGVyRW5kZWREdG8ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRleGVjdXRpb246IHtcblx0XHRcdFx0aWQ6IHZhbHVlLmV4ZWN1dGlvbi5pZCxcblx0XHRcdFx0dGFzazogVGFza0RUTy5mcm9tKHZhbHVlLmV4ZWN1dGlvbi50YXNrKVxuXHRcdFx0fSxcblx0XHRcdGhhc0Vycm9yczogdmFsdWUuaGFzRXJyb3JzXG5cdFx0fTtcblx0fVxufVxuXG5cblxubmFtZXNwYWNlIFRhc2tQcm9jZXNzU3RhcnRlZERUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiBJVGFza0V4ZWN1dGlvbiwgcHJvY2Vzc0lkOiBudW1iZXIpOiBJVGFza1Byb2Nlc3NTdGFydGVkRFRPIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IHZhbHVlLmlkLFxuXHRcdFx0cHJvY2Vzc0lkXG5cdFx0fTtcblx0fVxufVxuXG5uYW1lc3BhY2UgVGFza1Byb2Nlc3NFbmRlZERUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiBJVGFza0V4ZWN1dGlvbiwgZXhpdENvZGU6IG51bWJlciB8IHVuZGVmaW5lZCk6IElUYXNrUHJvY2Vzc0VuZGVkRFRPIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IHZhbHVlLmlkLFxuXHRcdFx0ZXhpdENvZGVcblx0XHR9O1xuXHR9XG59XG5cbm5hbWVzcGFjZSBUYXNrRGVmaW5pdGlvbkRUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiBLZXllZFRhc2tJZGVudGlmaWVyKTogSVRhc2tEZWZpbml0aW9uRFRPIHtcblx0XHRjb25zdCByZXN1bHQgPSBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIHZhbHVlKTtcblx0XHRkZWxldGUgcmVzdWx0Ll9rZXk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG8odmFsdWU6IElUYXNrRGVmaW5pdGlvbkRUTywgZXhlY3V0ZU9ubHk6IGJvb2xlYW4pOiBLZXllZFRhc2tJZGVudGlmaWVyIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgcmVzdWx0ID0gVGFza0RlZmluaXRpb24uY3JlYXRlVGFza0lkZW50aWZpZXIodmFsdWUsIGNvbnNvbGUpO1xuXHRcdGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCAmJiBleGVjdXRlT25seSkge1xuXHRcdFx0cmVzdWx0ID0ge1xuXHRcdFx0XHRfa2V5OiBnZW5lcmF0ZVV1aWQoKSxcblx0XHRcdFx0dHlwZTogJyRleGVjdXRlT25seSdcblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxubmFtZXNwYWNlIFRhc2tQcmVzZW50YXRpb25PcHRpb25zRFRPIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odmFsdWU6IElQcmVzZW50YXRpb25PcHRpb25zIHwgdW5kZWZpbmVkKTogSVRhc2tQcmVzZW50YXRpb25PcHRpb25zRFRPIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwgdmFsdWUpO1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byh2YWx1ZTogSVRhc2tQcmVzZW50YXRpb25PcHRpb25zRFRPIHwgdW5kZWZpbmVkKTogSVByZXNlbnRhdGlvbk9wdGlvbnMge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gUHJlc2VudGF0aW9uT3B0aW9ucy5kZWZhdWx0cztcblx0XHR9XG5cdFx0cmV0dXJuIE9iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwgUHJlc2VudGF0aW9uT3B0aW9ucy5kZWZhdWx0cywgdmFsdWUpO1xuXHR9XG59XG5cbm5hbWVzcGFjZSBSdW5PcHRpb25zRFRPIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odmFsdWU6IElSdW5PcHRpb25zKTogSVJ1bk9wdGlvbnNEVE8gfCB1bmRlZmluZWQge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCB2YWx1ZSk7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiBJUnVuT3B0aW9uc0RUTyB8IHVuZGVmaW5lZCk6IElSdW5PcHRpb25zIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIFJ1bk9wdGlvbnMuZGVmYXVsdHM7XG5cdFx0fVxuXHRcdHJldHVybiBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUobnVsbCksIFJ1bk9wdGlvbnMuZGVmYXVsdHMsIHZhbHVlKTtcblx0fVxufVxuXG5uYW1lc3BhY2UgUHJvY2Vzc0V4ZWN1dGlvbk9wdGlvbnNEVE8ge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogQ29tbWFuZE9wdGlvbnMpOiBJUHJvY2Vzc0V4ZWN1dGlvbk9wdGlvbnNEVE8gfCB1bmRlZmluZWQge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y3dkOiB2YWx1ZS5jd2QsXG5cdFx0XHRlbnY6IHZhbHVlLmVudlxuXHRcdH07XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiBJUHJvY2Vzc0V4ZWN1dGlvbk9wdGlvbnNEVE8gfCB1bmRlZmluZWQpOiBDb21tYW5kT3B0aW9ucyB7XG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiBDb21tYW5kT3B0aW9ucy5kZWZhdWx0cztcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdGN3ZDogdmFsdWUuY3dkIHx8IENvbW1hbmRPcHRpb25zLmRlZmF1bHRzLmN3ZCxcblx0XHRcdGVudjogdmFsdWUuZW52XG5cdFx0fTtcblx0fVxufVxuXG5uYW1lc3BhY2UgUHJvY2Vzc0V4ZWN1dGlvbkRUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBpcyh2YWx1ZTogSVNoZWxsRXhlY3V0aW9uRFRPIHwgSVByb2Nlc3NFeGVjdXRpb25EVE8gfCBJQ3VzdG9tRXhlY3V0aW9uRFRPKTogdmFsdWUgaXMgSVByb2Nlc3NFeGVjdXRpb25EVE8ge1xuXHRcdGNvbnN0IGNhbmRpZGF0ZSA9IHZhbHVlIGFzIElQcm9jZXNzRXhlY3V0aW9uRFRPO1xuXHRcdHJldHVybiBjYW5kaWRhdGUgJiYgISFjYW5kaWRhdGUucHJvY2Vzcztcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogSUNvbW1hbmRDb25maWd1cmF0aW9uKTogSVByb2Nlc3NFeGVjdXRpb25EVE8ge1xuXHRcdGNvbnN0IHByb2Nlc3M6IHN0cmluZyA9IFR5cGVzLmlzU3RyaW5nKHZhbHVlLm5hbWUpID8gdmFsdWUubmFtZSA6IHZhbHVlLm5hbWUhLnZhbHVlO1xuXHRcdGNvbnN0IGFyZ3M6IHN0cmluZ1tdID0gdmFsdWUuYXJncyA/IHZhbHVlLmFyZ3MubWFwKHZhbHVlID0+IFR5cGVzLmlzU3RyaW5nKHZhbHVlKSA/IHZhbHVlIDogdmFsdWUudmFsdWUpIDogW107XG5cdFx0Y29uc3QgcmVzdWx0OiBJUHJvY2Vzc0V4ZWN1dGlvbkRUTyA9IHtcblx0XHRcdHByb2Nlc3M6IHByb2Nlc3MsXG5cdFx0XHRhcmdzOiBhcmdzXG5cdFx0fTtcblx0XHRpZiAodmFsdWUub3B0aW9ucykge1xuXHRcdFx0cmVzdWx0Lm9wdGlvbnMgPSBQcm9jZXNzRXhlY3V0aW9uT3B0aW9uc0RUTy5mcm9tKHZhbHVlLm9wdGlvbnMpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byh2YWx1ZTogSVByb2Nlc3NFeGVjdXRpb25EVE8pOiBJQ29tbWFuZENvbmZpZ3VyYXRpb24ge1xuXHRcdGNvbnN0IHJlc3VsdDogSUNvbW1hbmRDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0cnVudGltZTogUnVudGltZVR5cGUuUHJvY2Vzcyxcblx0XHRcdG5hbWU6IHZhbHVlLnByb2Nlc3MsXG5cdFx0XHRhcmdzOiB2YWx1ZS5hcmdzLFxuXHRcdFx0cHJlc2VudGF0aW9uOiB1bmRlZmluZWRcblx0XHR9O1xuXHRcdHJlc3VsdC5vcHRpb25zID0gUHJvY2Vzc0V4ZWN1dGlvbk9wdGlvbnNEVE8udG8odmFsdWUub3B0aW9ucyk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5uYW1lc3BhY2UgU2hlbGxFeGVjdXRpb25PcHRpb25zRFRPIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odmFsdWU6IENvbW1hbmRPcHRpb25zKTogSVNoZWxsRXhlY3V0aW9uT3B0aW9uc0RUTyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdDogSVNoZWxsRXhlY3V0aW9uT3B0aW9uc0RUTyA9IHtcblx0XHRcdGN3ZDogdmFsdWUuY3dkIHx8IENvbW1hbmRPcHRpb25zLmRlZmF1bHRzLmN3ZCxcblx0XHRcdGVudjogdmFsdWUuZW52XG5cdFx0fTtcblx0XHRpZiAodmFsdWUuc2hlbGwpIHtcblx0XHRcdHJlc3VsdC5leGVjdXRhYmxlID0gdmFsdWUuc2hlbGwuZXhlY3V0YWJsZTtcblx0XHRcdHJlc3VsdC5zaGVsbEFyZ3MgPSB2YWx1ZS5zaGVsbC5hcmdzO1xuXHRcdFx0cmVzdWx0LnNoZWxsUXVvdGluZyA9IHZhbHVlLnNoZWxsLnF1b3Rpbmc7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiBJU2hlbGxFeGVjdXRpb25PcHRpb25zRFRPKTogQ29tbWFuZE9wdGlvbnMgfCB1bmRlZmluZWQge1xuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQ6IENvbW1hbmRPcHRpb25zID0ge1xuXHRcdFx0Y3dkOiB2YWx1ZS5jd2QsXG5cdFx0XHRlbnY6IHZhbHVlLmVudlxuXHRcdH07XG5cdFx0aWYgKHZhbHVlLmV4ZWN1dGFibGUpIHtcblx0XHRcdHJlc3VsdC5zaGVsbCA9IHtcblx0XHRcdFx0ZXhlY3V0YWJsZTogdmFsdWUuZXhlY3V0YWJsZVxuXHRcdFx0fTtcblx0XHRcdGlmICh2YWx1ZS5zaGVsbEFyZ3MpIHtcblx0XHRcdFx0cmVzdWx0LnNoZWxsLmFyZ3MgPSB2YWx1ZS5zaGVsbEFyZ3M7XG5cdFx0XHR9XG5cdFx0XHRpZiAodmFsdWUuc2hlbGxRdW90aW5nKSB7XG5cdFx0XHRcdHJlc3VsdC5zaGVsbC5xdW90aW5nID0gdmFsdWUuc2hlbGxRdW90aW5nO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbm5hbWVzcGFjZSBTaGVsbEV4ZWN1dGlvbkRUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBpcyh2YWx1ZTogSVNoZWxsRXhlY3V0aW9uRFRPIHwgSVByb2Nlc3NFeGVjdXRpb25EVE8gfCBJQ3VzdG9tRXhlY3V0aW9uRFRPKTogdmFsdWUgaXMgSVNoZWxsRXhlY3V0aW9uRFRPIHtcblx0XHRjb25zdCBjYW5kaWRhdGUgPSB2YWx1ZSBhcyBJU2hlbGxFeGVjdXRpb25EVE87XG5cdFx0cmV0dXJuIGNhbmRpZGF0ZSAmJiAoISFjYW5kaWRhdGUuY29tbWFuZExpbmUgfHwgISFjYW5kaWRhdGUuY29tbWFuZCk7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odmFsdWU6IElDb21tYW5kQ29uZmlndXJhdGlvbik6IElTaGVsbEV4ZWN1dGlvbkRUTyB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJU2hlbGxFeGVjdXRpb25EVE8gPSB7fTtcblx0XHRpZiAodmFsdWUubmFtZSAmJiBUeXBlcy5pc1N0cmluZyh2YWx1ZS5uYW1lKSAmJiAodmFsdWUuYXJncyA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlLmFyZ3MgPT09IG51bGwgfHwgdmFsdWUuYXJncy5sZW5ndGggPT09IDApKSB7XG5cdFx0XHRyZXN1bHQuY29tbWFuZExpbmUgPSB2YWx1ZS5uYW1lO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQuY29tbWFuZCA9IHZhbHVlLm5hbWU7XG5cdFx0XHRyZXN1bHQuYXJncyA9IHZhbHVlLmFyZ3M7XG5cdFx0fVxuXHRcdGlmICh2YWx1ZS5vcHRpb25zKSB7XG5cdFx0XHRyZXN1bHQub3B0aW9ucyA9IFNoZWxsRXhlY3V0aW9uT3B0aW9uc0RUTy5mcm9tKHZhbHVlLm9wdGlvbnMpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byh2YWx1ZTogSVNoZWxsRXhlY3V0aW9uRFRPKTogSUNvbW1hbmRDb25maWd1cmF0aW9uIHtcblx0XHRjb25zdCByZXN1bHQ6IElDb21tYW5kQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHJ1bnRpbWU6IFJ1bnRpbWVUeXBlLlNoZWxsLFxuXHRcdFx0bmFtZTogdmFsdWUuY29tbWFuZExpbmUgPyB2YWx1ZS5jb21tYW5kTGluZSA6IHZhbHVlLmNvbW1hbmQsXG5cdFx0XHRhcmdzOiB2YWx1ZS5hcmdzLFxuXHRcdFx0cHJlc2VudGF0aW9uOiB1bmRlZmluZWRcblx0XHR9O1xuXHRcdGlmICh2YWx1ZS5vcHRpb25zKSB7XG5cdFx0XHRyZXN1bHQub3B0aW9ucyA9IFNoZWxsRXhlY3V0aW9uT3B0aW9uc0RUTy50byh2YWx1ZS5vcHRpb25zKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5uYW1lc3BhY2UgQ3VzdG9tRXhlY3V0aW9uRFRPIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGlzKHZhbHVlOiBJU2hlbGxFeGVjdXRpb25EVE8gfCBJUHJvY2Vzc0V4ZWN1dGlvbkRUTyB8IElDdXN0b21FeGVjdXRpb25EVE8pOiB2YWx1ZSBpcyBJQ3VzdG9tRXhlY3V0aW9uRFRPIHtcblx0XHRjb25zdCBjYW5kaWRhdGUgPSB2YWx1ZSBhcyBJQ3VzdG9tRXhlY3V0aW9uRFRPO1xuXHRcdHJldHVybiBjYW5kaWRhdGUgJiYgY2FuZGlkYXRlLmN1c3RvbUV4ZWN1dGlvbiA9PT0gJ2N1c3RvbUV4ZWN1dGlvbic7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogSUNvbW1hbmRDb25maWd1cmF0aW9uKTogSUN1c3RvbUV4ZWN1dGlvbkRUTyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGN1c3RvbUV4ZWN1dGlvbjogJ2N1c3RvbUV4ZWN1dGlvbidcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiBJQ3VzdG9tRXhlY3V0aW9uRFRPKTogSUNvbW1hbmRDb25maWd1cmF0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cnVudGltZTogUnVudGltZVR5cGUuQ3VzdG9tRXhlY3V0aW9uLFxuXHRcdFx0cHJlc2VudGF0aW9uOiB1bmRlZmluZWRcblx0XHR9O1xuXHR9XG59XG5cbm5hbWVzcGFjZSBUYXNrU291cmNlRFRPIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odmFsdWU6IFRhc2tTb3VyY2UpOiBJVGFza1NvdXJjZURUTyB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJVGFza1NvdXJjZURUTyA9IHtcblx0XHRcdGxhYmVsOiB2YWx1ZS5sYWJlbFxuXHRcdH07XG5cdFx0aWYgKHZhbHVlLmtpbmQgPT09IFRhc2tTb3VyY2VLaW5kLkV4dGVuc2lvbikge1xuXHRcdFx0cmVzdWx0LmV4dGVuc2lvbklkID0gdmFsdWUuZXh0ZW5zaW9uO1xuXHRcdFx0aWYgKHZhbHVlLndvcmtzcGFjZUZvbGRlcikge1xuXHRcdFx0XHRyZXN1bHQuc2NvcGUgPSB2YWx1ZS53b3Jrc3BhY2VGb2xkZXIudXJpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnNjb3BlID0gdmFsdWUuc2NvcGU7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh2YWx1ZS5raW5kID09PSBUYXNrU291cmNlS2luZC5Xb3Jrc3BhY2UpIHtcblx0XHRcdHJlc3VsdC5leHRlbnNpb25JZCA9ICckY29yZSc7XG5cdFx0XHRyZXN1bHQuc2NvcGUgPSB2YWx1ZS5jb25maWcud29ya3NwYWNlRm9sZGVyID8gdmFsdWUuY29uZmlnLndvcmtzcGFjZUZvbGRlci51cmkgOiBUYXNrU2NvcGUuR2xvYmFsO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiB0byh2YWx1ZTogSVRhc2tTb3VyY2VEVE8sIHdvcmtzcGFjZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTogSUV4dGVuc2lvblRhc2tTb3VyY2Uge1xuXHRcdGxldCBzY29wZTogVGFza1Njb3BlO1xuXHRcdGxldCB3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKCh2YWx1ZS5zY29wZSA9PT0gdW5kZWZpbmVkKSB8fCAoKHR5cGVvZiB2YWx1ZS5zY29wZSA9PT0gJ251bWJlcicpICYmICh2YWx1ZS5zY29wZSAhPT0gVGFza1Njb3BlLkdsb2JhbCkpKSB7XG5cdFx0XHRpZiAod29ya3NwYWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHNjb3BlID0gVGFza1Njb3BlLkdsb2JhbDtcblx0XHRcdFx0d29ya3NwYWNlRm9sZGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c2NvcGUgPSBUYXNrU2NvcGUuRm9sZGVyO1xuXHRcdFx0XHR3b3Jrc3BhY2VGb2xkZXIgPSB3b3Jrc3BhY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVyc1swXTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZS5zY29wZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdHNjb3BlID0gdmFsdWUuc2NvcGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNjb3BlID0gVGFza1Njb3BlLkZvbGRlcjtcblx0XHRcdHdvcmtzcGFjZUZvbGRlciA9IHdvcmtzcGFjZS5nZXRXb3Jrc3BhY2VGb2xkZXIoVVJJLnJldml2ZSh2YWx1ZS5zY29wZSkpID8/IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiBJRXh0ZW5zaW9uVGFza1NvdXJjZSA9IHtcblx0XHRcdGtpbmQ6IFRhc2tTb3VyY2VLaW5kLkV4dGVuc2lvbixcblx0XHRcdGxhYmVsOiB2YWx1ZS5sYWJlbCxcblx0XHRcdGV4dGVuc2lvbjogdmFsdWUuZXh0ZW5zaW9uSWQsXG5cdFx0XHRzY29wZSxcblx0XHRcdHdvcmtzcGFjZUZvbGRlclxuXHRcdH07XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5uYW1lc3BhY2UgVGFza0hhbmRsZURUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBpcyh2YWx1ZTogYW55KTogdmFsdWUgaXMgSVRhc2tIYW5kbGVEVE8ge1xuXHRcdGNvbnN0IGNhbmRpZGF0ZTogSVRhc2tIYW5kbGVEVE8gPSB2YWx1ZTtcblx0XHRyZXR1cm4gY2FuZGlkYXRlICYmIFR5cGVzLmlzU3RyaW5nKGNhbmRpZGF0ZS5pZCkgJiYgISFjYW5kaWRhdGUud29ya3NwYWNlRm9sZGVyO1xuXHR9XG59XG5cbm5hbWVzcGFjZSBUYXNrRFRPIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odGFzazogVGFzayB8IENvbmZpZ3VyaW5nVGFzayk6IElUYXNrRFRPIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGFzayA9PT0gdW5kZWZpbmVkIHx8IHRhc2sgPT09IG51bGwgfHwgKCFDdXN0b21UYXNrLmlzKHRhc2spICYmICFDb250cmlidXRlZFRhc2suaXModGFzaykgJiYgIUNvbmZpZ3VyaW5nVGFzay5pcyh0YXNrKSkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdDogSVRhc2tEVE8gPSB7XG5cdFx0XHRfaWQ6IHRhc2suX2lkLFxuXHRcdFx0bmFtZTogdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lLFxuXHRcdFx0ZGVmaW5pdGlvbjogVGFza0RlZmluaXRpb25EVE8uZnJvbSh0YXNrLmdldERlZmluaXRpb24odHJ1ZSkpLFxuXHRcdFx0c291cmNlOiBUYXNrU291cmNlRFRPLmZyb20odGFzay5fc291cmNlKSxcblx0XHRcdGV4ZWN1dGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0cHJlc2VudGF0aW9uT3B0aW9uczogIUNvbmZpZ3VyaW5nVGFzay5pcyh0YXNrKSAmJiB0YXNrLmNvbW1hbmQgPyBUYXNrUHJlc2VudGF0aW9uT3B0aW9uc0RUTy5mcm9tKHRhc2suY29tbWFuZC5wcmVzZW50YXRpb24pIDogdW5kZWZpbmVkLFxuXHRcdFx0aXNCYWNrZ3JvdW5kOiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlzQmFja2dyb3VuZCxcblx0XHRcdHByb2JsZW1NYXRjaGVyczogW10sXG5cdFx0XHRoYXNEZWZpbmVkTWF0Y2hlcnM6IENvbnRyaWJ1dGVkVGFzay5pcyh0YXNrKSA/IHRhc2suaGFzRGVmaW5lZE1hdGNoZXJzIDogZmFsc2UsXG5cdFx0XHRydW5PcHRpb25zOiBSdW5PcHRpb25zRFRPLmZyb20odGFzay5ydW5PcHRpb25zKSxcblx0XHR9O1xuXHRcdHJlc3VsdC5ncm91cCA9IFRhc2tHcm91cERUTy5mcm9tKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXApO1xuXG5cdFx0aWYgKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZGV0YWlsKSB7XG5cdFx0XHRyZXN1bHQuZGV0YWlsID0gdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5kZXRhaWw7XG5cdFx0fVxuXHRcdGlmICghQ29uZmlndXJpbmdUYXNrLmlzKHRhc2spICYmIHRhc2suY29tbWFuZCkge1xuXHRcdFx0c3dpdGNoICh0YXNrLmNvbW1hbmQucnVudGltZSkge1xuXHRcdFx0XHRjYXNlIFJ1bnRpbWVUeXBlLlByb2Nlc3M6IHJlc3VsdC5leGVjdXRpb24gPSBQcm9jZXNzRXhlY3V0aW9uRFRPLmZyb20odGFzay5jb21tYW5kKTsgYnJlYWs7XG5cdFx0XHRcdGNhc2UgUnVudGltZVR5cGUuU2hlbGw6IHJlc3VsdC5leGVjdXRpb24gPSBTaGVsbEV4ZWN1dGlvbkRUTy5mcm9tKHRhc2suY29tbWFuZCk7IGJyZWFrO1xuXHRcdFx0XHRjYXNlIFJ1bnRpbWVUeXBlLkN1c3RvbUV4ZWN1dGlvbjogcmVzdWx0LmV4ZWN1dGlvbiA9IEN1c3RvbUV4ZWN1dGlvbkRUTy5mcm9tKHRhc2suY29tbWFuZCk7IGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlcnMpIHtcblx0XHRcdGZvciAoY29uc3QgbWF0Y2hlciBvZiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycykge1xuXHRcdFx0XHRpZiAoVHlwZXMuaXNTdHJpbmcobWF0Y2hlcikpIHtcblx0XHRcdFx0XHRyZXN1bHQucHJvYmxlbU1hdGNoZXJzLnB1c2gobWF0Y2hlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byh0YXNrOiBJVGFza0RUTyB8IHVuZGVmaW5lZCwgd29ya3NwYWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIGV4ZWN1dGVPbmx5OiBib29sZWFuLCBpY29uPzogeyBpZD86IHN0cmluZzsgY29sb3I/OiBzdHJpbmcgfSwgaGlkZT86IGJvb2xlYW4pOiBDb250cmlidXRlZFRhc2sgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGFzayB8fCAodHlwZW9mIHRhc2submFtZSAhPT0gJ3N0cmluZycpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGxldCBjb21tYW5kOiBJQ29tbWFuZENvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHRhc2suZXhlY3V0aW9uKSB7XG5cdFx0XHRpZiAoU2hlbGxFeGVjdXRpb25EVE8uaXModGFzay5leGVjdXRpb24pKSB7XG5cdFx0XHRcdGNvbW1hbmQgPSBTaGVsbEV4ZWN1dGlvbkRUTy50byh0YXNrLmV4ZWN1dGlvbik7XG5cdFx0XHR9IGVsc2UgaWYgKFByb2Nlc3NFeGVjdXRpb25EVE8uaXModGFzay5leGVjdXRpb24pKSB7XG5cdFx0XHRcdGNvbW1hbmQgPSBQcm9jZXNzRXhlY3V0aW9uRFRPLnRvKHRhc2suZXhlY3V0aW9uKTtcblx0XHRcdH0gZWxzZSBpZiAoQ3VzdG9tRXhlY3V0aW9uRFRPLmlzKHRhc2suZXhlY3V0aW9uKSkge1xuXHRcdFx0XHRjb21tYW5kID0gQ3VzdG9tRXhlY3V0aW9uRFRPLnRvKHRhc2suZXhlY3V0aW9uKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWNvbW1hbmQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbW1hbmQucHJlc2VudGF0aW9uID0gVGFza1ByZXNlbnRhdGlvbk9wdGlvbnNEVE8udG8odGFzay5wcmVzZW50YXRpb25PcHRpb25zKTtcblx0XHRjb25zdCBzb3VyY2UgPSBUYXNrU291cmNlRFRPLnRvKHRhc2suc291cmNlLCB3b3Jrc3BhY2UpO1xuXG5cdFx0Y29uc3QgbGFiZWwgPSBubHMubG9jYWxpemUoJ3Rhc2subGFiZWwnLCAnezB9OiB7MX0nLCBzb3VyY2UubGFiZWwsIHRhc2submFtZSk7XG5cdFx0Y29uc3QgZGVmaW5pdGlvbiA9IFRhc2tEZWZpbml0aW9uRFRPLnRvKHRhc2suZGVmaW5pdGlvbiwgZXhlY3V0ZU9ubHkpITtcblx0XHRjb25zdCBpZCA9IChDdXN0b21FeGVjdXRpb25EVE8uaXModGFzay5leGVjdXRpb24hKSAmJiB0YXNrLl9pZCkgPyB0YXNrLl9pZCA6IGAke3Rhc2suc291cmNlLmV4dGVuc2lvbklkfS4ke2RlZmluaXRpb24uX2tleX1gO1xuXHRcdGNvbnN0IHJlc3VsdDogQ29udHJpYnV0ZWRUYXNrID0gbmV3IENvbnRyaWJ1dGVkVGFzayhcblx0XHRcdGlkLCAvLyB1dWlkTWFwLmdldFVVSUQoaWRlbnRpZmllcilcblx0XHRcdHNvdXJjZSxcblx0XHRcdGxhYmVsLFxuXHRcdFx0ZGVmaW5pdGlvbi50eXBlLFxuXHRcdFx0ZGVmaW5pdGlvbixcblx0XHRcdGNvbW1hbmQsXG5cdFx0XHR0YXNrLmhhc0RlZmluZWRNYXRjaGVycyxcblx0XHRcdFJ1bk9wdGlvbnNEVE8udG8odGFzay5ydW5PcHRpb25zKSxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogdGFzay5uYW1lLFxuXHRcdFx0XHRpZGVudGlmaWVyOiBsYWJlbCxcblx0XHRcdFx0Z3JvdXA6IHRhc2suZ3JvdXAsXG5cdFx0XHRcdGlzQmFja2dyb3VuZDogISF0YXNrLmlzQmFja2dyb3VuZCxcblx0XHRcdFx0cHJvYmxlbU1hdGNoZXJzOiB0YXNrLnByb2JsZW1NYXRjaGVycy5zbGljZSgpLFxuXHRcdFx0XHRkZXRhaWw6IHRhc2suZGV0YWlsLFxuXHRcdFx0XHRpY29uLFxuXHRcdFx0XHRoaWRlXG5cdFx0XHR9XG5cdFx0KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbm5hbWVzcGFjZSBUYXNrR3JvdXBEVE8ge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogc3RyaW5nIHwgVGFza0dyb3VwIHwgdW5kZWZpbmVkKTogSVRhc2tHcm91cERUTyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRfaWQ6ICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSA/IHZhbHVlIDogdmFsdWUuX2lkLFxuXHRcdFx0aXNEZWZhdWx0OiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgPyBmYWxzZSA6ICgodHlwZW9mIHZhbHVlLmlzRGVmYXVsdCA9PT0gJ3N0cmluZycpID8gZmFsc2UgOiB2YWx1ZS5pc0RlZmF1bHQpXG5cdFx0fTtcblx0fVxufVxuXG5uYW1lc3BhY2UgVGFza0ZpbHRlckRUTyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiBJVGFza0ZpbHRlcik6IElUYXNrRmlsdGVyRFRPIHtcblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvKHZhbHVlOiBJVGFza0ZpbHRlckRUTyB8IHVuZGVmaW5lZCk6IElUYXNrRmlsdGVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cbn1cblxuQGV4dEhvc3ROYW1lZEN1c3RvbWVyKE1haW5Db250ZXh0Lk1haW5UaHJlYWRUYXNrKVxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWRUYXNrIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIE1haW5UaHJlYWRUYXNrU2hhcGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2V4dEhvc3RDb250ZXh0OiBJRXh0SG9zdENvbnRleHQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0VGFza1NoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcnM6IE1hcDxudW1iZXIsIHsgZGlzcG9zYWJsZTogSURpc3Bvc2FibGU7IHByb3ZpZGVyOiBJVGFza1Byb3ZpZGVyIH0+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGV4dEhvc3RDb250ZXh0OiBJRXh0SG9zdENvbnRleHQsXG5cdFx0QElUYXNrU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90YXNrU2VydmljZTogSVRhc2tTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlQ29udGV4dFNlcnZlcjogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdENvbnRleHQuZ2V0UHJveHkoRXh0SG9zdENvbnRleHQuRXh0SG9zdFRhc2spO1xuXHRcdHRoaXMuX3Byb3ZpZGVycyA9IG5ldyBNYXAoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90YXNrU2VydmljZS5vbkRpZFN0YXRlQ2hhbmdlKGFzeW5jIChldmVudDogSVRhc2tFdmVudCkgPT4ge1xuXHRcdFx0aWYgKGV2ZW50LmtpbmQgPT09IFRhc2tFdmVudEtpbmQuQ2hhbmdlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRhc2sgPSBldmVudC5fX3Rhc2s7XG5cdFx0XHRpZiAoZXZlbnQua2luZCA9PT0gVGFza0V2ZW50S2luZC5TdGFydCkge1xuXHRcdFx0XHRjb25zdCBleGVjdXRpb24gPSBUYXNrRXhlY3V0aW9uRFRPLmZyb20odGFzay5nZXRUYXNrRXhlY3V0aW9uKCkpO1xuXHRcdFx0XHRsZXQgcmVzb2x2ZWREZWZpbml0aW9uOiBJVGFza0RlZmluaXRpb25EVE8gPSBleGVjdXRpb24udGFzayEuZGVmaW5pdGlvbjtcblx0XHRcdFx0aWYgKGV4ZWN1dGlvbi50YXNrPy5leGVjdXRpb24gJiYgQ3VzdG9tRXhlY3V0aW9uRFRPLmlzKGV4ZWN1dGlvbi50YXNrLmV4ZWN1dGlvbikgJiYgZXZlbnQucmVzb2x2ZWRWYXJpYWJsZXMpIHtcblx0XHRcdFx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZShleGVjdXRpb24udGFzay5kZWZpbml0aW9uKTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHJlcGxhY2VtZW50IG9mIGV4cHIudW5yZXNvbHZlZCgpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB2YWx1ZSA9IGV2ZW50LnJlc29sdmVkVmFyaWFibGVzLmdldChyZXBsYWNlbWVudC5pbm5lcik7XG5cdFx0XHRcdFx0XHRpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRleHByLnJlc29sdmUocmVwbGFjZW1lbnQsIHZhbHVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXNvbHZlZERlZmluaXRpb24gPSBhd2FpdCB0aGlzLl9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVBc3luYyh0YXNrLmdldFdvcmtzcGFjZUZvbGRlcigpLCBleHByKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9wcm94eS4kb25EaWRTdGFydFRhc2soZXhlY3V0aW9uLCBldmVudC50ZXJtaW5hbElkLCByZXNvbHZlZERlZmluaXRpb24pO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5raW5kID09PSBUYXNrRXZlbnRLaW5kLlByb2Nlc3NTdGFydGVkKSB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZFN0YXJ0VGFza1Byb2Nlc3MoVGFza1Byb2Nlc3NTdGFydGVkRFRPLmZyb20odGFzay5nZXRUYXNrRXhlY3V0aW9uKCksIGV2ZW50LnByb2Nlc3NJZCkpO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5raW5kID09PSBUYXNrRXZlbnRLaW5kLlByb2Nlc3NFbmRlZCkge1xuXHRcdFx0XHR0aGlzLl9wcm94eS4kb25EaWRFbmRUYXNrUHJvY2VzcyhUYXNrUHJvY2Vzc0VuZGVkRFRPLmZyb20odGFzay5nZXRUYXNrRXhlY3V0aW9uKCksIGV2ZW50LmV4aXRDb2RlKSk7XG5cdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmtpbmQgPT09IFRhc2tFdmVudEtpbmQuRW5kKSB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRPbkRpZEVuZFRhc2soVGFza0V4ZWN1dGlvbkRUTy5mcm9tKHRhc2suZ2V0VGFza0V4ZWN1dGlvbigpKSk7XG5cdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmtpbmQgPT09IFRhc2tFdmVudEtpbmQuUHJvYmxlbU1hdGNoZXJTdGFydGVkKSB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZFN0YXJ0VGFza1Byb2JsZW1NYXRjaGVycyhUYXNrUHJvYmxlbU1hdGNoZXJTdGFydGVkRHRvLmZyb20oeyBleGVjdXRpb246IHRhc2suZ2V0VGFza0V4ZWN1dGlvbigpIH0pKTtcblx0XHRcdH0gZWxzZSBpZiAoZXZlbnQua2luZCA9PT0gVGFza0V2ZW50S2luZC5Qcm9ibGVtTWF0Y2hlckVuZGVkKSB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZEVuZFRhc2tQcm9ibGVtTWF0Y2hlcnMoVGFza1Byb2JsZW1NYXRjaGVyRW5kZWREdG8uZnJvbSh7IGV4ZWN1dGlvbjogdGFzay5nZXRUYXNrRXhlY3V0aW9uKCksIGhhc0Vycm9yczogZmFsc2UgfSkpO1xuXHRcdFx0fSBlbHNlIGlmIChldmVudC5raW5kID09PSBUYXNrRXZlbnRLaW5kLlByb2JsZW1NYXRjaGVyRm91bmRFcnJvcnMpIHtcblx0XHRcdFx0dGhpcy5fcHJveHkuJG9uRGlkRW5kVGFza1Byb2JsZW1NYXRjaGVycyhUYXNrUHJvYmxlbU1hdGNoZXJFbmRlZER0by5mcm9tKHsgZXhlY3V0aW9uOiB0YXNrLmdldFRhc2tFeGVjdXRpb24oKSwgaGFzRXJyb3JzOiB0cnVlIH0pKTtcblx0XHRcdH1cblxuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy5fcHJvdmlkZXJzLnZhbHVlcygpKSB7XG5cdFx0XHR2YWx1ZS5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0dGhpcy5fcHJvdmlkZXJzLmNsZWFyKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0JGNyZWF0ZVRhc2tJZCh0YXNrRFRPOiBJVGFza0RUTyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdGNvbnN0IHRhc2sgPSBUYXNrRFRPLnRvKHRhc2tEVE8sIHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2ZXIsIHRydWUpO1xuXHRcdFx0aWYgKHRhc2spIHtcblx0XHRcdFx0cmVzb2x2ZSh0YXNrLl9pZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZWplY3QobmV3IEVycm9yKCdUYXNrIGNvdWxkIG5vdCBiZSBjcmVhdGVkIGZyb20gRFRPJykpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljICRyZWdpc3RlclRhc2tQcm92aWRlcihoYW5kbGU6IG51bWJlciwgdHlwZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXI6IElUYXNrUHJvdmlkZXIgPSB7XG5cdFx0XHRwcm92aWRlVGFza3M6ICh2YWxpZFR5cGVzOiBJU3RyaW5nRGljdGlvbmFyeTxib29sZWFuPikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX3Byb3h5LiRwcm92aWRlVGFza3MoaGFuZGxlLCB2YWxpZFR5cGVzKSkudGhlbigodmFsdWUpID0+IHtcblx0XHRcdFx0XHRjb25zdCB0YXNrczogVGFza1tdID0gW107XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBkdG8gb2YgdmFsdWUudGFza3MpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHRhc2sgPSBUYXNrRFRPLnRvKGR0bywgdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZlciwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRpZiAodGFzaykge1xuXHRcdFx0XHRcdFx0XHR0YXNrcy5wdXNoKHRhc2spO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihgVGFzayBTeXN0ZW06IGNhbiBub3QgY29udmVydCB0YXNrOiAke0pTT04uc3RyaW5naWZ5KGR0by5kZWZpbml0aW9uLCB1bmRlZmluZWQsIDApfS4gVGFzayB3aWxsIGJlIGRyb3BwZWRgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgcHJvY2Vzc2VkRXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gPSB7XG5cdFx0XHRcdFx0XHQuLi52YWx1ZS5leHRlbnNpb24sXG5cdFx0XHRcdFx0XHRleHRlbnNpb25Mb2NhdGlvbjogVVJJLnJldml2ZSh2YWx1ZS5leHRlbnNpb24uZXh0ZW5zaW9uTG9jYXRpb24pXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0dGFza3MsXG5cdFx0XHRcdFx0XHRleHRlbnNpb246IHByb2Nlc3NlZEV4dGVuc2lvblxuXHRcdFx0XHRcdH0gc2F0aXNmaWVzIElUYXNrU2V0O1xuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0XHRyZXNvbHZlVGFzazogKHRhc2s6IENvbmZpZ3VyaW5nVGFzaykgPT4ge1xuXHRcdFx0XHRjb25zdCBkdG8gPSBUYXNrRFRPLmZyb20odGFzayk7XG5cblx0XHRcdFx0aWYgKGR0bykge1xuXHRcdFx0XHRcdGR0by5uYW1lID0gKChkdG8ubmFtZSA9PT0gdW5kZWZpbmVkKSA/ICcnIDogZHRvLm5hbWUpOyAvLyBVc2luZyBhbiBlbXB0eSBuYW1lIGNhdXNlcyB0aGUgbmFtZSB0byBkZWZhdWx0IHRvIHRoZSBvbmUgZ2l2ZW4gYnkgdGhlIHByb3ZpZGVyLlxuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fcHJveHkuJHJlc29sdmVUYXNrKGhhbmRsZSwgZHRvKSkudGhlbihyZXNvbHZlZFRhc2sgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHJlc29sdmVkVGFzaykge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gVGFza0RUTy50byhyZXNvbHZlZFRhc2ssIHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2ZXIsIHRydWUsIHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWNvbiwgdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5oaWRlKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlPENvbnRyaWJ1dGVkVGFzayB8IHVuZGVmaW5lZD4odW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzLl90YXNrU2VydmljZS5yZWdpc3RlclRhc2tQcm92aWRlcihwcm92aWRlciwgdHlwZSk7XG5cdFx0dGhpcy5fcHJvdmlkZXJzLnNldChoYW5kbGUsIHsgZGlzcG9zYWJsZSwgcHJvdmlkZXIgfSk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHVibGljICR1bnJlZ2lzdGVyVGFza1Byb3ZpZGVyKGhhbmRsZTogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9wcm92aWRlcnMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKHByb3ZpZGVyKSB7XG5cdFx0XHRwcm92aWRlci5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX3Byb3ZpZGVycy5kZWxldGUoaGFuZGxlKTtcblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHVibGljICRmZXRjaFRhc2tzKGZpbHRlcj86IElUYXNrRmlsdGVyRFRPKTogUHJvbWlzZTxJVGFza0RUT1tdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rhc2tTZXJ2aWNlLnRhc2tzKFRhc2tGaWx0ZXJEVE8udG8oZmlsdGVyKSkudGhlbigodGFza3MpID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdDogSVRhc2tEVE9bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIHRhc2tzKSB7XG5cdFx0XHRcdGNvbnN0IGl0ZW0gPSBUYXNrRFRPLmZyb20odGFzayk7XG5cdFx0XHRcdGlmIChpdGVtKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goaXRlbSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldFdvcmtzcGFjZSh2YWx1ZTogVXJpQ29tcG9uZW50cyB8IHN0cmluZyk6IHN0cmluZyB8IElXb3Jrc3BhY2UgfCBJV29ya3NwYWNlRm9sZGVyIHwgbnVsbCB7XG5cdFx0bGV0IHdvcmtzcGFjZTtcblx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuXHRcdFx0d29ya3NwYWNlID0gdmFsdWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZU9iamVjdCA9IHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2ZXIuZ2V0V29ya3NwYWNlKCk7XG5cdFx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKHZhbHVlKTtcblx0XHRcdGlmICh3b3Jrc3BhY2VPYmplY3QuY29uZmlndXJhdGlvbj8udG9TdHJpbmcoKSA9PT0gdXJpLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0d29ya3NwYWNlID0gd29ya3NwYWNlT2JqZWN0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0d29ya3NwYWNlID0gdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZlci5nZXRXb3Jrc3BhY2VGb2xkZXIodXJpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHdvcmtzcGFjZTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkZ2V0VGFza0V4ZWN1dGlvbih2YWx1ZTogSVRhc2tIYW5kbGVEVE8gfCBJVGFza0RUTyk6IFByb21pc2U8SVRhc2tFeGVjdXRpb25EVE8+IHtcblx0XHRpZiAoVGFza0hhbmRsZURUTy5pcyh2YWx1ZSkpIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMuZ2V0V29ya3NwYWNlKHZhbHVlLndvcmtzcGFjZUZvbGRlcik7XG5cdFx0XHRpZiAod29ya3NwYWNlKSB7XG5cdFx0XHRcdGNvbnN0IHRhc2sgPSBhd2FpdCB0aGlzLl90YXNrU2VydmljZS5nZXRUYXNrKHdvcmtzcGFjZSwgdmFsdWUuaWQsIHRydWUpO1xuXHRcdFx0XHRpZiAodGFzaykge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRpZDogdGFzay5faWQsXG5cdFx0XHRcdFx0XHR0YXNrOiBUYXNrRFRPLmZyb20odGFzaylcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignVGFzayBub3QgZm91bmQnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gd29ya3NwYWNlIGZvbGRlcicpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB0YXNrID0gVGFza0RUTy50byh2YWx1ZSwgdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZlciwgdHJ1ZSkhO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWQ6IHRhc2suX2lkLFxuXHRcdFx0XHR0YXNrOiBUYXNrRFRPLmZyb20odGFzaylcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0Ly8gUGFzc2luZyBpbiBhIFRhc2tIYW5kbGVEVE8gd2lsbCBjYXVzZSB0aGUgdGFzayB0byBnZXQgcmUtcmVzb2x2ZWQsIHdoaWNoIGlzIGltcG9ydGFudCBmb3IgdGFza3MgYXJlIGNvbWluZyBmcm9tIHRoZSBjb3JlLFxuXHQvLyBzdWNoIGFzIHRob3NlIGdvdHRlbiBmcm9tIGEgZmV0Y2hUYXNrcywgc2luY2UgdGhleSBjYW4gaGF2ZSBtaXNzaW5nIGNvbmZpZ3VyYXRpb24gcHJvcGVydGllcy5cblx0cHVibGljICRleGVjdXRlVGFzayh2YWx1ZTogSVRhc2tIYW5kbGVEVE8gfCBJVGFza0RUTyk6IFByb21pc2U8SVRhc2tFeGVjdXRpb25EVE8+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8SVRhc2tFeGVjdXRpb25EVE8+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdGlmIChUYXNrSGFuZGxlRFRPLmlzKHZhbHVlKSkge1xuXHRcdFx0XHRjb25zdCB3b3Jrc3BhY2UgPSB0aGlzLmdldFdvcmtzcGFjZSh2YWx1ZS53b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdFx0XHRpZiAod29ya3NwYWNlKSB7XG5cdFx0XHRcdFx0dGhpcy5fdGFza1NlcnZpY2UuZ2V0VGFzayh3b3Jrc3BhY2UsIHZhbHVlLmlkLCB0cnVlKS50aGVuKCh0YXNrOiBUYXNrIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRhc2spIHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcignVGFzayBub3QgZm91bmQnKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRjb25zdCByZXN1bHQ6IElUYXNrRXhlY3V0aW9uRFRPID0ge1xuXHRcdFx0XHRcdFx0XHRcdGlkOiB2YWx1ZS5pZCxcblx0XHRcdFx0XHRcdFx0XHR0YXNrOiBUYXNrRFRPLmZyb20odGFzaylcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0dGhpcy5fdGFza1NlcnZpY2UucnVuKHRhc2spLnRoZW4oc3VtbWFyeSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gRW5zdXJlIHRoYXQgdGhlIHRhc2sgZXhlY3V0aW9uIGdldHMgY2xlYW5lZCB1cCBpZiB0aGUgZXhpdCBjb2RlIGlzIHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0XHRcdC8vIFRoaXMgY2FuIGhhcHBlbiB3aGVuIHRoZSB0YXNrIGhhcyBkZXBlbmRlbnQgdGFza3MgYW5kIG9uZSBvZiB0aGVtIGZhaWxlZFxuXHRcdFx0XHRcdFx0XHRcdGlmICgoc3VtbWFyeT8uZXhpdENvZGUgPT09IHVuZGVmaW5lZCkgfHwgKHN1bW1hcnkuZXhpdENvZGUgIT09IDApKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl9wcm94eS4kT25EaWRFbmRUYXNrKHJlc3VsdCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LCByZWFzb24gPT4ge1xuXHRcdFx0XHRcdFx0XHRcdC8vIGVhdCB0aGUgZXJyb3IsIGl0IGhhcyBhbHJlYWR5IGJlZW4gc3VyZmFjZWQgdG8gdGhlIHVzZXIgYW5kIHdlIGRvbid0IGNhcmUgYWJvdXQgaXQgaGVyZVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0cmVzb2x2ZShyZXN1bHQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIChfZXJyb3IpID0+IHtcblx0XHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoJ1Rhc2sgbm90IGZvdW5kJykpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoJ05vIHdvcmtzcGFjZSBmb2xkZXInKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHRhc2sgPSBUYXNrRFRPLnRvKHZhbHVlLCB0aGlzLl93b3Jrc3BhY2VDb250ZXh0U2VydmVyLCB0cnVlKSE7XG5cdFx0XHRcdHRoaXMuX3Rhc2tTZXJ2aWNlLnJ1bih0YXNrKS50aGVuKHVuZGVmaW5lZCwgcmVhc29uID0+IHtcblx0XHRcdFx0XHQvLyBlYXQgdGhlIGVycm9yLCBpdCBoYXMgYWxyZWFkeSBiZWVuIHN1cmZhY2VkIHRvIHRoZSB1c2VyIGFuZCB3ZSBkb24ndCBjYXJlIGFib3V0IGl0IGhlcmVcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdDogSVRhc2tFeGVjdXRpb25EVE8gPSB7XG5cdFx0XHRcdFx0aWQ6IHRhc2suX2lkLFxuXHRcdFx0XHRcdHRhc2s6IFRhc2tEVE8uZnJvbSh0YXNrKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRyZXNvbHZlKHJlc3VsdCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXG5cdHB1YmxpYyAkY3VzdG9tRXhlY3V0aW9uQ29tcGxldGUoaWQ6IHN0cmluZywgcmVzdWx0PzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHRoaXMuX3Rhc2tTZXJ2aWNlLmdldEFjdGl2ZVRhc2tzKCkudGhlbigodGFza3MpID0+IHtcblx0XHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIHRhc2tzKSB7XG5cdFx0XHRcdFx0aWYgKGlkID09PSB0YXNrLl9pZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fdGFza1NlcnZpY2UuZXh0ZW5zaW9uQ2FsbGJhY2tUYXNrQ29tcGxldGUodGFzaywgcmVzdWx0KS50aGVuKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0XHR9LCAoZXJyb3IpID0+IHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KGVycm9yKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZWplY3QobmV3IEVycm9yKCdUYXNrIHRvIG1hcmsgYXMgY29tcGxldGUgbm90IGZvdW5kJykpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgJHRlcm1pbmF0ZVRhc2soaWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHR0aGlzLl90YXNrU2VydmljZS5nZXRBY3RpdmVUYXNrcygpLnRoZW4oKHRhc2tzKSA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0XHRcdGlmIChpZCA9PT0gdGFzay5faWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3Rhc2tTZXJ2aWNlLnRlcm1pbmF0ZSh0YXNrKS50aGVuKCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0XHR9LCAoZXJyb3IpID0+IHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvck5vVGVsZW1ldHJ5KCdUYXNrIHRvIHRlcm1pbmF0ZSBub3QgZm91bmQnKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyAkcmVnaXN0ZXJUYXNrU3lzdGVtKGtleTogc3RyaW5nLCBpbmZvOiBJVGFza1N5c3RlbUluZm9EVE8pOiB2b2lkIHtcblx0XHRsZXQgcGxhdGZvcm06IFBsYXRmb3JtLlBsYXRmb3JtO1xuXHRcdHN3aXRjaCAoaW5mby5wbGF0Zm9ybSkge1xuXHRcdFx0Y2FzZSAnV2ViJzpcblx0XHRcdFx0cGxhdGZvcm0gPSBQbGF0Zm9ybS5QbGF0Zm9ybS5XZWI7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnd2luMzInOlxuXHRcdFx0XHRwbGF0Zm9ybSA9IFBsYXRmb3JtLlBsYXRmb3JtLldpbmRvd3M7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnZGFyd2luJzpcblx0XHRcdFx0cGxhdGZvcm0gPSBQbGF0Zm9ybS5QbGF0Zm9ybS5NYWM7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbGludXgnOlxuXHRcdFx0XHRwbGF0Zm9ybSA9IFBsYXRmb3JtLlBsYXRmb3JtLkxpbnV4O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHBsYXRmb3JtID0gUGxhdGZvcm0ucGxhdGZvcm07XG5cdFx0fVxuXHRcdHRoaXMuX3Rhc2tTZXJ2aWNlLnJlZ2lzdGVyVGFza1N5c3RlbShrZXksIHtcblx0XHRcdHBsYXRmb3JtOiBwbGF0Zm9ybSxcblx0XHRcdHVyaVByb3ZpZGVyOiAocGF0aDogc3RyaW5nKTogVVJJID0+IHtcblx0XHRcdFx0cmV0dXJuIFVSSS5mcm9tKHsgc2NoZW1lOiBpbmZvLnNjaGVtZSwgYXV0aG9yaXR5OiBpbmZvLmF1dGhvcml0eSwgcGF0aCB9KTtcblx0XHRcdH0sXG5cdFx0XHRjb250ZXh0OiB0aGlzLl9leHRIb3N0Q29udGV4dCxcblx0XHRcdHJlc29sdmVWYXJpYWJsZXM6ICh3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIsIHRvUmVzb2x2ZTogSVJlc29sdmVTZXQsIHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldCk6IFByb21pc2U8SVJlc29sdmVkVmFyaWFibGVzIHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRcdGNvbnN0IHZhcnM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRcdHRvUmVzb2x2ZS52YXJpYWJsZXMuZm9yRWFjaChpdGVtID0+IHZhcnMucHVzaChpdGVtKSk7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fcHJveHkuJHJlc29sdmVWYXJpYWJsZXMod29ya3NwYWNlRm9sZGVyLnVyaSwgeyBwcm9jZXNzOiB0b1Jlc29sdmUucHJvY2VzcywgdmFyaWFibGVzOiB2YXJzIH0pKS50aGVuKHZhbHVlcyA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcGFydGlhbGx5UmVzb2x2ZWRWYXJzID0gQXJyYXkuZnJvbShPYmplY3QudmFsdWVzKHZhbHVlcy52YXJpYWJsZXMpKTtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2U8SVJlc29sdmVkVmFyaWFibGVzIHwgdW5kZWZpbmVkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVXaXRoSW50ZXJhY3Rpb24od29ya3NwYWNlRm9sZGVyLCBwYXJ0aWFsbHlSZXNvbHZlZFZhcnMsICd0YXNrcycsIHVuZGVmaW5lZCwgdGFyZ2V0KS50aGVuKHJlc29sdmVkVmFycyA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmICghcmVzb2x2ZWRWYXJzKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzdWx0OiBJUmVzb2x2ZWRWYXJpYWJsZXMgPSB7XG5cdFx0XHRcdFx0XHRcdFx0cHJvY2VzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdHZhcmlhYmxlczogbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKVxuXHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRpYWxseVJlc29sdmVkVmFycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHZhcmlhYmxlTmFtZSA9IHZhcnNbaV0uc3Vic3RyaW5nKDIsIHZhcnNbaV0ubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHJlc29sdmVkVmFycyAmJiB2YWx1ZXMudmFyaWFibGVzW3ZhcnNbaV1dID09PSB2YXJzW2ldKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCByZXNvbHZlZCA9IHJlc29sdmVkVmFycy5nZXQodmFyaWFibGVOYW1lKTtcblx0XHRcdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcmVzb2x2ZWQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJlc3VsdC52YXJpYWJsZXMuc2V0KHZhcmlhYmxlTmFtZSwgcmVzb2x2ZWQpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXN1bHQudmFyaWFibGVzLnNldCh2YXJpYWJsZU5hbWUsIHBhcnRpYWxseVJlc29sdmVkVmFyc1tpXSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyh2YWx1ZXMucHJvY2VzcykpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXN1bHQucHJvY2VzcyA9IHZhbHVlcy5wcm9jZXNzO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJlc29sdmUocmVzdWx0KTtcblx0XHRcdFx0XHRcdH0sIHJlYXNvbiA9PiB7XG5cdFx0XHRcdFx0XHRcdHJlamVjdChyZWFzb24pO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHRcdGZpbmRFeGVjdXRhYmxlOiAoY29tbWFuZDogc3RyaW5nLCBjd2Q/OiBzdHJpbmcsIHBhdGhzPzogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJGZpbmRFeGVjdXRhYmxlKGNvbW1hbmQsIGN3ZCwgcGF0aHMpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgJHJlZ2lzdGVyU3VwcG9ydGVkRXhlY3V0aW9ucyhjdXN0b20/OiBib29sZWFuLCBzaGVsbD86IGJvb2xlYW4sIHByb2Nlc3M/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rhc2tTZXJ2aWNlLnJlZ2lzdGVyU3VwcG9ydGVkRXhlY3V0aW9ucyhjdXN0b20sIHNoZWxsLCBwcm9jZXNzKTtcblx0fVxuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUVyQixTQUFTLFdBQTBCO0FBQ25DLFNBQVMsb0JBQW9CO0FBQzdCLFlBQVksV0FBVztBQUN2QixZQUFZLGNBQWM7QUFFMUIsU0FBUyxrQkFBK0I7QUFFeEMsU0FBcUIsZ0NBQWtEO0FBRXZFO0FBQUEsRUFDQztBQUFBLEVBQWlCO0FBQUEsRUFDSztBQUFBLEVBQXVDO0FBQUEsRUFBYTtBQUFBLEVBQVk7QUFBQSxFQUN0RjtBQUFBLEVBQXdFO0FBQUEsRUFBZ0I7QUFBQSxFQUFxQjtBQUFBLE9BQ3ZHO0FBSVAsU0FBUyxvQkFBZ0Q7QUFFekQsU0FBUyw0QkFBNkM7QUFDdEQsU0FBUyxnQkFBdUQsbUJBQW1CO0FBQ25GO0FBQUEsRUFNQztBQUFBLE9BQ007QUFDUCxTQUFTLHFDQUFxQztBQUU5QyxTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLHVDQUF1QztBQUVoRCxJQUFVO0FBQUEsQ0FBVixDQUFVQSxzQkFBVjtBQUNRLFdBQVMsS0FBSyxPQUEwQztBQUM5RCxXQUFPO0FBQUEsTUFDTixJQUFJLE1BQU07QUFBQSxNQUNWLE1BQU0sUUFBUSxLQUFLLE1BQU0sSUFBSTtBQUFBLElBQzlCO0FBQUEsRUFDRDtBQUxPLEVBQUFBLGtCQUFTO0FBQUEsR0FEUDtBQWFILElBQVU7QUFBQSxDQUFWLENBQVVDLGtDQUFWO0FBQ0MsV0FBUyxLQUFLLE9BQWtFO0FBQ3RGLFdBQU87QUFBQSxNQUNOLFdBQVc7QUFBQSxRQUNWLElBQUksTUFBTSxVQUFVO0FBQUEsUUFDcEIsTUFBTSxRQUFRLEtBQUssTUFBTSxVQUFVLElBQUk7QUFBQSxNQUN4QztBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBUE8sRUFBQUEsOEJBQVM7QUFBQSxHQURBO0FBZ0JWLElBQVU7QUFBQSxDQUFWLENBQVVDLGdDQUFWO0FBQ0MsV0FBUyxLQUFLLE9BQThEO0FBQ2xGLFdBQU87QUFBQSxNQUNOLFdBQVc7QUFBQSxRQUNWLElBQUksTUFBTSxVQUFVO0FBQUEsUUFDcEIsTUFBTSxRQUFRLEtBQUssTUFBTSxVQUFVLElBQUk7QUFBQSxNQUN4QztBQUFBLE1BQ0EsV0FBVyxNQUFNO0FBQUEsSUFDbEI7QUFBQSxFQUNEO0FBUk8sRUFBQUEsNEJBQVM7QUFBQSxHQURBO0FBY2pCLElBQVU7QUFBQSxDQUFWLENBQVVDLDJCQUFWO0FBQ1EsV0FBUyxLQUFLLE9BQXVCLFdBQTJDO0FBQ3RGLFdBQU87QUFBQSxNQUNOLElBQUksTUFBTTtBQUFBLE1BQ1Y7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUxPLEVBQUFBLHVCQUFTO0FBQUEsR0FEUDtBQVNWLElBQVU7QUFBQSxDQUFWLENBQVVDLHlCQUFWO0FBQ1EsV0FBUyxLQUFLLE9BQXVCLFVBQW9EO0FBQy9GLFdBQU87QUFBQSxNQUNOLElBQUksTUFBTTtBQUFBLE1BQ1Y7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUxPLEVBQUFBLHFCQUFTO0FBQUEsR0FEUDtBQVNWLElBQVU7QUFBQSxDQUFWLENBQVVDLHVCQUFWO0FBQ1EsV0FBUyxLQUFLLE9BQWdEO0FBQ3BFLFVBQU0sU0FBUyxPQUFPLE9BQU8sdUJBQU8sT0FBTyxJQUFJLEdBQUcsS0FBSztBQUN2RCxXQUFPLE9BQU87QUFDZCxXQUFPO0FBQUEsRUFDUjtBQUpPLEVBQUFBLG1CQUFTO0FBS1QsV0FBUyxHQUFHLE9BQTJCLGFBQXVEO0FBQ3BHLFFBQUksU0FBUyxlQUFlLHFCQUFxQixPQUFPLE9BQU87QUFDL0QsUUFBSSxXQUFXLFVBQWEsYUFBYTtBQUN4QyxlQUFTO0FBQUEsUUFDUixNQUFNLGFBQWE7QUFBQSxRQUNuQixNQUFNO0FBQUEsTUFDUDtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQVRPLEVBQUFBLG1CQUFTO0FBQUEsR0FOUDtBQWtCVixJQUFVO0FBQUEsQ0FBVixDQUFVQyxnQ0FBVjtBQUNRLFdBQVMsS0FBSyxPQUFrRjtBQUN0RyxRQUFJLFVBQVUsVUFBYSxVQUFVLE1BQU07QUFDMUMsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLE9BQU8sT0FBTyx1QkFBTyxPQUFPLElBQUksR0FBRyxLQUFLO0FBQUEsRUFDaEQ7QUFMTyxFQUFBQSw0QkFBUztBQU1ULFdBQVMsR0FBRyxPQUFzRTtBQUN4RixRQUFJLFVBQVUsVUFBYSxVQUFVLE1BQU07QUFDMUMsYUFBTyxvQkFBb0I7QUFBQSxJQUM1QjtBQUNBLFdBQU8sT0FBTyxPQUFPLHVCQUFPLE9BQU8sSUFBSSxHQUFHLG9CQUFvQixVQUFVLEtBQUs7QUFBQSxFQUM5RTtBQUxPLEVBQUFBLDRCQUFTO0FBQUEsR0FQUDtBQWVWLElBQVU7QUFBQSxDQUFWLENBQVVDLG1CQUFWO0FBQ1EsV0FBUyxLQUFLLE9BQWdEO0FBQ3BFLFFBQUksVUFBVSxVQUFhLFVBQVUsTUFBTTtBQUMxQyxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sT0FBTyxPQUFPLHVCQUFPLE9BQU8sSUFBSSxHQUFHLEtBQUs7QUFBQSxFQUNoRDtBQUxPLEVBQUFBLGVBQVM7QUFNVCxXQUFTLEdBQUcsT0FBZ0Q7QUFDbEUsUUFBSSxVQUFVLFVBQWEsVUFBVSxNQUFNO0FBQzFDLGFBQU8sV0FBVztBQUFBLElBQ25CO0FBQ0EsV0FBTyxPQUFPLE9BQU8sdUJBQU8sT0FBTyxJQUFJLEdBQUcsV0FBVyxVQUFVLEtBQUs7QUFBQSxFQUNyRTtBQUxPLEVBQUFBLGVBQVM7QUFBQSxHQVBQO0FBZVYsSUFBVTtBQUFBLENBQVYsQ0FBVUMsZ0NBQVY7QUFDUSxXQUFTLEtBQUssT0FBZ0U7QUFDcEYsUUFBSSxVQUFVLFVBQWEsVUFBVSxNQUFNO0FBQzFDLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTztBQUFBLE1BQ04sS0FBSyxNQUFNO0FBQUEsTUFDWCxLQUFLLE1BQU07QUFBQSxJQUNaO0FBQUEsRUFDRDtBQVJPLEVBQUFBLDRCQUFTO0FBU1QsV0FBUyxHQUFHLE9BQWdFO0FBQ2xGLFFBQUksVUFBVSxVQUFhLFVBQVUsTUFBTTtBQUMxQyxhQUFPLGVBQWU7QUFBQSxJQUN2QjtBQUNBLFdBQU87QUFBQSxNQUNOLEtBQUssTUFBTSxPQUFPLGVBQWUsU0FBUztBQUFBLE1BQzFDLEtBQUssTUFBTTtBQUFBLElBQ1o7QUFBQSxFQUNEO0FBUk8sRUFBQUEsNEJBQVM7QUFBQSxHQVZQO0FBcUJWLElBQVU7QUFBQSxDQUFWLENBQVVDLHlCQUFWO0FBQ1EsV0FBUyxHQUFHLE9BQXVHO0FBQ3pILFVBQU0sWUFBWTtBQUNsQixXQUFPLGFBQWEsQ0FBQyxDQUFDLFVBQVU7QUFBQSxFQUNqQztBQUhPLEVBQUFBLHFCQUFTO0FBSVQsV0FBUyxLQUFLLE9BQW9EO0FBQ3hFLFVBQU0sVUFBa0IsTUFBTSxTQUFTLE1BQU0sSUFBSSxJQUFJLE1BQU0sT0FBTyxNQUFNLEtBQU07QUFDOUUsVUFBTSxPQUFpQixNQUFNLE9BQU8sTUFBTSxLQUFLLElBQUksQ0FBQUMsV0FBUyxNQUFNLFNBQVNBLE1BQUssSUFBSUEsU0FBUUEsT0FBTSxLQUFLLElBQUksQ0FBQztBQUM1RyxVQUFNLFNBQStCO0FBQUEsTUFDcEM7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFFBQUksTUFBTSxTQUFTO0FBQ2xCLGFBQU8sVUFBVSwyQkFBMkIsS0FBSyxNQUFNLE9BQU87QUFBQSxJQUMvRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBWE8sRUFBQUQscUJBQVM7QUFZVCxXQUFTLEdBQUcsT0FBb0Q7QUFDdEUsVUFBTSxTQUFnQztBQUFBLE1BQ3JDLFNBQVMsWUFBWTtBQUFBLE1BQ3JCLE1BQU0sTUFBTTtBQUFBLE1BQ1osTUFBTSxNQUFNO0FBQUEsTUFDWixjQUFjO0FBQUEsSUFDZjtBQUNBLFdBQU8sVUFBVSwyQkFBMkIsR0FBRyxNQUFNLE9BQU87QUFDNUQsV0FBTztBQUFBLEVBQ1I7QUFUTyxFQUFBQSxxQkFBUztBQUFBLEdBakJQO0FBNkJWLElBQVU7QUFBQSxDQUFWLENBQVVFLDhCQUFWO0FBQ1EsV0FBUyxLQUFLLE9BQThEO0FBQ2xGLFFBQUksVUFBVSxVQUFhLFVBQVUsTUFBTTtBQUMxQyxhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sU0FBb0M7QUFBQSxNQUN6QyxLQUFLLE1BQU0sT0FBTyxlQUFlLFNBQVM7QUFBQSxNQUMxQyxLQUFLLE1BQU07QUFBQSxJQUNaO0FBQ0EsUUFBSSxNQUFNLE9BQU87QUFDaEIsYUFBTyxhQUFhLE1BQU0sTUFBTTtBQUNoQyxhQUFPLFlBQVksTUFBTSxNQUFNO0FBQy9CLGFBQU8sZUFBZSxNQUFNLE1BQU07QUFBQSxJQUNuQztBQUNBLFdBQU87QUFBQSxFQUNSO0FBZE8sRUFBQUEsMEJBQVM7QUFlVCxXQUFTLEdBQUcsT0FBOEQ7QUFDaEYsUUFBSSxVQUFVLFVBQWEsVUFBVSxNQUFNO0FBQzFDLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxTQUF5QjtBQUFBLE1BQzlCLEtBQUssTUFBTTtBQUFBLE1BQ1gsS0FBSyxNQUFNO0FBQUEsSUFDWjtBQUNBLFFBQUksTUFBTSxZQUFZO0FBQ3JCLGFBQU8sUUFBUTtBQUFBLFFBQ2QsWUFBWSxNQUFNO0FBQUEsTUFDbkI7QUFDQSxVQUFJLE1BQU0sV0FBVztBQUNwQixlQUFPLE1BQU0sT0FBTyxNQUFNO0FBQUEsTUFDM0I7QUFDQSxVQUFJLE1BQU0sY0FBYztBQUN2QixlQUFPLE1BQU0sVUFBVSxNQUFNO0FBQUEsTUFDOUI7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFwQk8sRUFBQUEsMEJBQVM7QUFBQSxHQWhCUDtBQXVDVixJQUFVO0FBQUEsQ0FBVixDQUFVQyx1QkFBVjtBQUNRLFdBQVMsR0FBRyxPQUFxRztBQUN2SCxVQUFNLFlBQVk7QUFDbEIsV0FBTyxjQUFjLENBQUMsQ0FBQyxVQUFVLGVBQWUsQ0FBQyxDQUFDLFVBQVU7QUFBQSxFQUM3RDtBQUhPLEVBQUFBLG1CQUFTO0FBSVQsV0FBUyxLQUFLLE9BQWtEO0FBQ3RFLFVBQU0sU0FBNkIsQ0FBQztBQUNwQyxRQUFJLE1BQU0sUUFBUSxNQUFNLFNBQVMsTUFBTSxJQUFJLE1BQU0sTUFBTSxTQUFTLFVBQWEsTUFBTSxTQUFTLFFBQVEsTUFBTSxLQUFLLFdBQVcsSUFBSTtBQUM3SCxhQUFPLGNBQWMsTUFBTTtBQUFBLElBQzVCLE9BQU87QUFDTixhQUFPLFVBQVUsTUFBTTtBQUN2QixhQUFPLE9BQU8sTUFBTTtBQUFBLElBQ3JCO0FBQ0EsUUFBSSxNQUFNLFNBQVM7QUFDbEIsYUFBTyxVQUFVLHlCQUF5QixLQUFLLE1BQU0sT0FBTztBQUFBLElBQzdEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFaTyxFQUFBQSxtQkFBUztBQWFULFdBQVMsR0FBRyxPQUFrRDtBQUNwRSxVQUFNLFNBQWdDO0FBQUEsTUFDckMsU0FBUyxZQUFZO0FBQUEsTUFDckIsTUFBTSxNQUFNLGNBQWMsTUFBTSxjQUFjLE1BQU07QUFBQSxNQUNwRCxNQUFNLE1BQU07QUFBQSxNQUNaLGNBQWM7QUFBQSxJQUNmO0FBQ0EsUUFBSSxNQUFNLFNBQVM7QUFDbEIsYUFBTyxVQUFVLHlCQUF5QixHQUFHLE1BQU0sT0FBTztBQUFBLElBQzNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFYTyxFQUFBQSxtQkFBUztBQUFBLEdBbEJQO0FBZ0NWLElBQVU7QUFBQSxDQUFWLENBQVVDLHdCQUFWO0FBQ1EsV0FBUyxHQUFHLE9BQXNHO0FBQ3hILFVBQU0sWUFBWTtBQUNsQixXQUFPLGFBQWEsVUFBVSxvQkFBb0I7QUFBQSxFQUNuRDtBQUhPLEVBQUFBLG9CQUFTO0FBS1QsV0FBUyxLQUFLLE9BQW1EO0FBQ3ZFLFdBQU87QUFBQSxNQUNOLGlCQUFpQjtBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUpPLEVBQUFBLG9CQUFTO0FBTVQsV0FBUyxHQUFHLE9BQW1EO0FBQ3JFLFdBQU87QUFBQSxNQUNOLFNBQVMsWUFBWTtBQUFBLE1BQ3JCLGNBQWM7QUFBQSxJQUNmO0FBQUEsRUFDRDtBQUxPLEVBQUFBLG9CQUFTO0FBQUEsR0FaUDtBQW9CVixJQUFVO0FBQUEsQ0FBVixDQUFVQyxtQkFBVjtBQUNRLFdBQVMsS0FBSyxPQUFtQztBQUN2RCxVQUFNLFNBQXlCO0FBQUEsTUFDOUIsT0FBTyxNQUFNO0FBQUEsSUFDZDtBQUNBLFFBQUksTUFBTSxTQUFTLGVBQWUsV0FBVztBQUM1QyxhQUFPLGNBQWMsTUFBTTtBQUMzQixVQUFJLE1BQU0saUJBQWlCO0FBQzFCLGVBQU8sUUFBUSxNQUFNLGdCQUFnQjtBQUFBLE1BQ3RDLE9BQU87QUFDTixlQUFPLFFBQVEsTUFBTTtBQUFBLE1BQ3RCO0FBQUEsSUFDRCxXQUFXLE1BQU0sU0FBUyxlQUFlLFdBQVc7QUFDbkQsYUFBTyxjQUFjO0FBQ3JCLGFBQU8sUUFBUSxNQUFNLE9BQU8sa0JBQWtCLE1BQU0sT0FBTyxnQkFBZ0IsTUFBTSxVQUFVO0FBQUEsSUFDNUY7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQWhCTyxFQUFBQSxlQUFTO0FBaUJULFdBQVMsR0FBRyxPQUF1QixXQUEyRDtBQUNwRyxRQUFJO0FBQ0osUUFBSTtBQUNKLFFBQUssTUFBTSxVQUFVLFVBQWdCLE9BQU8sTUFBTSxVQUFVLFlBQWMsTUFBTSxVQUFVLFVBQVUsUUFBVTtBQUM3RyxVQUFJLFVBQVUsYUFBYSxFQUFFLFFBQVEsV0FBVyxHQUFHO0FBQ2xELGdCQUFRLFVBQVU7QUFDbEIsMEJBQWtCO0FBQUEsTUFDbkIsT0FBTztBQUNOLGdCQUFRLFVBQVU7QUFDbEIsMEJBQWtCLFVBQVUsYUFBYSxFQUFFLFFBQVEsQ0FBQztBQUFBLE1BQ3JEO0FBQUEsSUFDRCxXQUFXLE9BQU8sTUFBTSxVQUFVLFVBQVU7QUFDM0MsY0FBUSxNQUFNO0FBQUEsSUFDZixPQUFPO0FBQ04sY0FBUSxVQUFVO0FBQ2xCLHdCQUFrQixVQUFVLG1CQUFtQixJQUFJLE9BQU8sTUFBTSxLQUFLLENBQUMsS0FBSztBQUFBLElBQzVFO0FBQ0EsVUFBTSxTQUErQjtBQUFBLE1BQ3BDLE1BQU0sZUFBZTtBQUFBLE1BQ3JCLE9BQU8sTUFBTTtBQUFBLE1BQ2IsV0FBVyxNQUFNO0FBQUEsTUFDakI7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBekJPLEVBQUFBLGVBQVM7QUFBQSxHQWxCUDtBQThDVixJQUFVO0FBQUEsQ0FBVixDQUFVQyxtQkFBVjtBQUNRLFdBQVMsR0FBRyxPQUFxQztBQUN2RCxVQUFNLFlBQTRCO0FBQ2xDLFdBQU8sYUFBYSxNQUFNLFNBQVMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDLFVBQVU7QUFBQSxFQUNqRTtBQUhPLEVBQUFBLGVBQVM7QUFBQSxHQURQO0FBT1YsSUFBVTtBQUFBLENBQVYsQ0FBVUMsYUFBVjtBQUNRLFdBQVMsS0FBSyxNQUFvRDtBQUN4RSxRQUFJLFNBQVMsVUFBYSxTQUFTLFFBQVMsQ0FBQyxXQUFXLEdBQUcsSUFBSSxLQUFLLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxLQUFLLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxHQUFJO0FBQzVILGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxTQUFtQjtBQUFBLE1BQ3hCLEtBQUssS0FBSztBQUFBLE1BQ1YsTUFBTSxLQUFLLHdCQUF3QjtBQUFBLE1BQ25DLFlBQVksa0JBQWtCLEtBQUssS0FBSyxjQUFjLElBQUksQ0FBQztBQUFBLE1BQzNELFFBQVEsY0FBYyxLQUFLLEtBQUssT0FBTztBQUFBLE1BQ3ZDLFdBQVc7QUFBQSxNQUNYLHFCQUFxQixDQUFDLGdCQUFnQixHQUFHLElBQUksS0FBSyxLQUFLLFVBQVUsMkJBQTJCLEtBQUssS0FBSyxRQUFRLFlBQVksSUFBSTtBQUFBLE1BQzlILGNBQWMsS0FBSyx3QkFBd0I7QUFBQSxNQUMzQyxpQkFBaUIsQ0FBQztBQUFBLE1BQ2xCLG9CQUFvQixnQkFBZ0IsR0FBRyxJQUFJLElBQUksS0FBSyxxQkFBcUI7QUFBQSxNQUN6RSxZQUFZLGNBQWMsS0FBSyxLQUFLLFVBQVU7QUFBQSxJQUMvQztBQUNBLFdBQU8sUUFBUSxhQUFhLEtBQUssS0FBSyx3QkFBd0IsS0FBSztBQUVuRSxRQUFJLEtBQUssd0JBQXdCLFFBQVE7QUFDeEMsYUFBTyxTQUFTLEtBQUssd0JBQXdCO0FBQUEsSUFDOUM7QUFDQSxRQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxLQUFLLEtBQUssU0FBUztBQUM5QyxjQUFRLEtBQUssUUFBUSxTQUFTO0FBQUEsUUFDN0IsS0FBSyxZQUFZO0FBQVMsaUJBQU8sWUFBWSxvQkFBb0IsS0FBSyxLQUFLLE9BQU87QUFBRztBQUFBLFFBQ3JGLEtBQUssWUFBWTtBQUFPLGlCQUFPLFlBQVksa0JBQWtCLEtBQUssS0FBSyxPQUFPO0FBQUc7QUFBQSxRQUNqRixLQUFLLFlBQVk7QUFBaUIsaUJBQU8sWUFBWSxtQkFBbUIsS0FBSyxLQUFLLE9BQU87QUFBRztBQUFBLE1BQzdGO0FBQUEsSUFDRDtBQUNBLFFBQUksS0FBSyx3QkFBd0IsaUJBQWlCO0FBQ2pELGlCQUFXLFdBQVcsS0FBSyx3QkFBd0IsaUJBQWlCO0FBQ25FLFlBQUksTUFBTSxTQUFTLE9BQU8sR0FBRztBQUM1QixpQkFBTyxnQkFBZ0IsS0FBSyxPQUFPO0FBQUEsUUFDcEM7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBcENPLEVBQUFBLFNBQVM7QUFzQ1QsV0FBUyxHQUFHLE1BQTRCLFdBQXFDLGFBQXNCLE1BQXdDLE1BQTZDO0FBQzlMLFFBQUksQ0FBQyxRQUFTLE9BQU8sS0FBSyxTQUFTLFVBQVc7QUFDN0MsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJO0FBQ0osUUFBSSxLQUFLLFdBQVc7QUFDbkIsVUFBSSxrQkFBa0IsR0FBRyxLQUFLLFNBQVMsR0FBRztBQUN6QyxrQkFBVSxrQkFBa0IsR0FBRyxLQUFLLFNBQVM7QUFBQSxNQUM5QyxXQUFXLG9CQUFvQixHQUFHLEtBQUssU0FBUyxHQUFHO0FBQ2xELGtCQUFVLG9CQUFvQixHQUFHLEtBQUssU0FBUztBQUFBLE1BQ2hELFdBQVcsbUJBQW1CLEdBQUcsS0FBSyxTQUFTLEdBQUc7QUFDakQsa0JBQVUsbUJBQW1CLEdBQUcsS0FBSyxTQUFTO0FBQUEsTUFDL0M7QUFBQSxJQUNEO0FBRUEsUUFBSSxDQUFDLFNBQVM7QUFDYixhQUFPO0FBQUEsSUFDUjtBQUNBLFlBQVEsZUFBZSwyQkFBMkIsR0FBRyxLQUFLLG1CQUFtQjtBQUM3RSxVQUFNLFNBQVMsY0FBYyxHQUFHLEtBQUssUUFBUSxTQUFTO0FBRXRELFVBQU0sUUFBUSxJQUFJLFNBQVMsY0FBYyxZQUFZLE9BQU8sT0FBTyxLQUFLLElBQUk7QUFDNUUsVUFBTSxhQUFhLGtCQUFrQixHQUFHLEtBQUssWUFBWSxXQUFXO0FBQ3BFLFVBQU0sS0FBTSxtQkFBbUIsR0FBRyxLQUFLLFNBQVUsS0FBSyxLQUFLLE1BQU8sS0FBSyxNQUFNLEdBQUcsS0FBSyxPQUFPLFdBQVcsSUFBSSxXQUFXLElBQUk7QUFDMUgsVUFBTSxTQUEwQixJQUFJO0FBQUEsTUFDbkM7QUFBQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxXQUFXO0FBQUEsTUFDWDtBQUFBLE1BQ0E7QUFBQSxNQUNBLEtBQUs7QUFBQSxNQUNMLGNBQWMsR0FBRyxLQUFLLFVBQVU7QUFBQSxNQUNoQztBQUFBLFFBQ0MsTUFBTSxLQUFLO0FBQUEsUUFDWCxZQUFZO0FBQUEsUUFDWixPQUFPLEtBQUs7QUFBQSxRQUNaLGNBQWMsQ0FBQyxDQUFDLEtBQUs7QUFBQSxRQUNyQixpQkFBaUIsS0FBSyxnQkFBZ0IsTUFBTTtBQUFBLFFBQzVDLFFBQVEsS0FBSztBQUFBLFFBQ2I7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQTlDTyxFQUFBQSxTQUFTO0FBQUEsR0F2Q1A7QUF3RlYsSUFBVTtBQUFBLENBQVYsQ0FBVUMsa0JBQVY7QUFDUSxXQUFTLEtBQUssT0FBa0U7QUFDdEYsUUFBSSxVQUFVLFFBQVc7QUFDeEIsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPO0FBQUEsTUFDTixLQUFNLE9BQU8sVUFBVSxXQUFZLFFBQVEsTUFBTTtBQUFBLE1BQ2pELFdBQVksT0FBTyxVQUFVLFdBQVksUUFBVSxPQUFPLE1BQU0sY0FBYyxXQUFZLFFBQVEsTUFBTTtBQUFBLElBQ3pHO0FBQUEsRUFDRDtBQVJPLEVBQUFBLGNBQVM7QUFBQSxHQURQO0FBWVYsSUFBVTtBQUFBLENBQVYsQ0FBVUMsbUJBQVY7QUFDUSxXQUFTLEtBQUssT0FBb0M7QUFDeEQsV0FBTztBQUFBLEVBQ1I7QUFGTyxFQUFBQSxlQUFTO0FBR1QsV0FBUyxHQUFHLE9BQTREO0FBQzlFLFdBQU87QUFBQSxFQUNSO0FBRk8sRUFBQUEsZUFBUztBQUFBLEdBSlA7QUFVSCxJQUFNLGlCQUFOLGNBQTZCLFdBQTBDO0FBQUEsRUFNN0UsWUFDQyxnQkFDK0IsY0FDWSx5QkFDSywrQkFDL0M7QUFDRCxVQUFNO0FBSnlCO0FBQ1k7QUFDSztBQUdoRCxTQUFLLFNBQVMsZUFBZSxTQUFTLGVBQWUsV0FBVztBQUNoRSxTQUFLLGFBQWEsb0JBQUksSUFBSTtBQUMxQixTQUFLLFVBQVUsS0FBSyxhQUFhLGlCQUFpQixPQUFPLFVBQXNCO0FBQzlFLFVBQUksTUFBTSxTQUFTLGNBQWMsU0FBUztBQUN6QztBQUFBLE1BQ0Q7QUFFQSxZQUFNLE9BQU8sTUFBTTtBQUNuQixVQUFJLE1BQU0sU0FBUyxjQUFjLE9BQU87QUFDdkMsY0FBTSxZQUFZLGlCQUFpQixLQUFLLEtBQUssaUJBQWlCLENBQUM7QUFDL0QsWUFBSSxxQkFBeUMsVUFBVSxLQUFNO0FBQzdELFlBQUksVUFBVSxNQUFNLGFBQWEsbUJBQW1CLEdBQUcsVUFBVSxLQUFLLFNBQVMsS0FBSyxNQUFNLG1CQUFtQjtBQUM1RyxnQkFBTSxPQUFPLGdDQUFnQyxNQUFNLFVBQVUsS0FBSyxVQUFVO0FBQzVFLHFCQUFXLGVBQWUsS0FBSyxXQUFXLEdBQUc7QUFDNUMsa0JBQU0sUUFBUSxNQUFNLGtCQUFrQixJQUFJLFlBQVksS0FBSztBQUMzRCxnQkFBSSxVQUFVLFFBQVc7QUFDeEIsbUJBQUssUUFBUSxhQUFhLEtBQUs7QUFBQSxZQUNoQztBQUFBLFVBQ0Q7QUFFQSwrQkFBcUIsTUFBTSxLQUFLLDhCQUE4QixhQUFhLEtBQUssbUJBQW1CLEdBQUcsSUFBSTtBQUFBLFFBQzNHO0FBQ0EsYUFBSyxPQUFPLGdCQUFnQixXQUFXLE1BQU0sWUFBWSxrQkFBa0I7QUFBQSxNQUM1RSxXQUFXLE1BQU0sU0FBUyxjQUFjLGdCQUFnQjtBQUN2RCxhQUFLLE9BQU8sdUJBQXVCLHNCQUFzQixLQUFLLEtBQUssaUJBQWlCLEdBQUcsTUFBTSxTQUFTLENBQUM7QUFBQSxNQUN4RyxXQUFXLE1BQU0sU0FBUyxjQUFjLGNBQWM7QUFDckQsYUFBSyxPQUFPLHFCQUFxQixvQkFBb0IsS0FBSyxLQUFLLGlCQUFpQixHQUFHLE1BQU0sUUFBUSxDQUFDO0FBQUEsTUFDbkcsV0FBVyxNQUFNLFNBQVMsY0FBYyxLQUFLO0FBQzVDLGFBQUssT0FBTyxjQUFjLGlCQUFpQixLQUFLLEtBQUssaUJBQWlCLENBQUMsQ0FBQztBQUFBLE1BQ3pFLFdBQVcsTUFBTSxTQUFTLGNBQWMsdUJBQXVCO0FBQzlELGFBQUssT0FBTywrQkFBK0IsNkJBQTZCLEtBQUssRUFBRSxXQUFXLEtBQUssaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO0FBQUEsTUFDckgsV0FBVyxNQUFNLFNBQVMsY0FBYyxxQkFBcUI7QUFDNUQsYUFBSyxPQUFPLDZCQUE2QiwyQkFBMkIsS0FBSyxFQUFFLFdBQVcsS0FBSyxpQkFBaUIsR0FBRyxXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBQUEsTUFDbkksV0FBVyxNQUFNLFNBQVMsY0FBYywyQkFBMkI7QUFDbEUsYUFBSyxPQUFPLDZCQUE2QiwyQkFBMkIsS0FBSyxFQUFFLFdBQVcsS0FBSyxpQkFBaUIsR0FBRyxXQUFXLEtBQUssQ0FBQyxDQUFDO0FBQUEsTUFDbEk7QUFBQSxJQUVELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVnQixVQUFnQjtBQUMvQixlQUFXLFNBQVMsS0FBSyxXQUFXLE9BQU8sR0FBRztBQUM3QyxZQUFNLFdBQVcsUUFBUTtBQUFBLElBQzFCO0FBQ0EsU0FBSyxXQUFXLE1BQU07QUFDdEIsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUFBLEVBRUEsY0FBYyxTQUFvQztBQUNqRCxXQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUN2QyxZQUFNLE9BQU8sUUFBUSxHQUFHLFNBQVMsS0FBSyx5QkFBeUIsSUFBSTtBQUNuRSxVQUFJLE1BQU07QUFDVCxnQkFBUSxLQUFLLEdBQUc7QUFBQSxNQUNqQixPQUFPO0FBQ04sZUFBTyxJQUFJLE1BQU0sb0NBQW9DLENBQUM7QUFBQSxNQUN2RDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVPLHNCQUFzQixRQUFnQixNQUE2QjtBQUN6RSxVQUFNLFdBQTBCO0FBQUEsTUFDL0IsY0FBYyxDQUFDLGVBQTJDO0FBQ3pELGVBQU8sUUFBUSxRQUFRLEtBQUssT0FBTyxjQUFjLFFBQVEsVUFBVSxDQUFDLEVBQUUsS0FBSyxDQUFDLFVBQVU7QUFDckYsZ0JBQU0sUUFBZ0IsQ0FBQztBQUN2QixxQkFBVyxPQUFPLE1BQU0sT0FBTztBQUM5QixrQkFBTSxPQUFPLFFBQVEsR0FBRyxLQUFLLEtBQUsseUJBQXlCLElBQUk7QUFDL0QsZ0JBQUksTUFBTTtBQUNULG9CQUFNLEtBQUssSUFBSTtBQUFBLFlBQ2hCLE9BQU87QUFDTixzQkFBUSxNQUFNLHNDQUFzQyxLQUFLLFVBQVUsSUFBSSxZQUFZLFFBQVcsQ0FBQyxDQUFDLHdCQUF3QjtBQUFBLFlBQ3pIO0FBQUEsVUFDRDtBQUNBLGdCQUFNLHFCQUE0QztBQUFBLFlBQ2pELEdBQUcsTUFBTTtBQUFBLFlBQ1QsbUJBQW1CLElBQUksT0FBTyxNQUFNLFVBQVUsaUJBQWlCO0FBQUEsVUFDaEU7QUFDQSxpQkFBTztBQUFBLFlBQ047QUFBQSxZQUNBLFdBQVc7QUFBQSxVQUNaO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsYUFBYSxDQUFDLFNBQTBCO0FBQ3ZDLGNBQU0sTUFBTSxRQUFRLEtBQUssSUFBSTtBQUU3QixZQUFJLEtBQUs7QUFDUixjQUFJLE9BQVMsSUFBSSxTQUFTLFNBQWEsS0FBSyxJQUFJO0FBQ2hELGlCQUFPLFFBQVEsUUFBUSxLQUFLLE9BQU8sYUFBYSxRQUFRLEdBQUcsQ0FBQyxFQUFFLEtBQUssa0JBQWdCO0FBQ2xGLGdCQUFJLGNBQWM7QUFDakIscUJBQU8sUUFBUSxHQUFHLGNBQWMsS0FBSyx5QkFBeUIsTUFBTSxLQUFLLHdCQUF3QixNQUFNLEtBQUssd0JBQXdCLElBQUk7QUFBQSxZQUN6STtBQUVBLG1CQUFPO0FBQUEsVUFDUixDQUFDO0FBQUEsUUFDRjtBQUNBLGVBQU8sUUFBUSxRQUFxQyxNQUFTO0FBQUEsTUFDOUQ7QUFBQSxJQUNEO0FBQ0EsVUFBTSxhQUFhLEtBQUssYUFBYSxxQkFBcUIsVUFBVSxJQUFJO0FBQ3hFLFNBQUssV0FBVyxJQUFJLFFBQVEsRUFBRSxZQUFZLFNBQVMsQ0FBQztBQUNwRCxXQUFPLFFBQVEsUUFBUSxNQUFTO0FBQUEsRUFDakM7QUFBQSxFQUVPLHdCQUF3QixRQUErQjtBQUM3RCxVQUFNLFdBQVcsS0FBSyxXQUFXLElBQUksTUFBTTtBQUMzQyxRQUFJLFVBQVU7QUFDYixlQUFTLFdBQVcsUUFBUTtBQUM1QixXQUFLLFdBQVcsT0FBTyxNQUFNO0FBQUEsSUFDOUI7QUFDQSxXQUFPLFFBQVEsUUFBUSxNQUFTO0FBQUEsRUFDakM7QUFBQSxFQUVPLFlBQVksUUFBOEM7QUFDaEUsV0FBTyxLQUFLLGFBQWEsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUFDLEVBQUUsS0FBSyxDQUFDLFVBQVU7QUFDeEUsWUFBTSxTQUFxQixDQUFDO0FBQzVCLGlCQUFXLFFBQVEsT0FBTztBQUN6QixjQUFNLE9BQU8sUUFBUSxLQUFLLElBQUk7QUFDOUIsWUFBSSxNQUFNO0FBQ1QsaUJBQU8sS0FBSyxJQUFJO0FBQUEsUUFDakI7QUFBQSxNQUNEO0FBQ0EsYUFBTztBQUFBLElBQ1IsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLGFBQWEsT0FBOEU7QUFDbEcsUUFBSTtBQUNKLFFBQUksT0FBTyxVQUFVLFVBQVU7QUFDOUIsa0JBQVk7QUFBQSxJQUNiLE9BQU87QUFDTixZQUFNLGtCQUFrQixLQUFLLHdCQUF3QixhQUFhO0FBQ2xFLFlBQU0sTUFBTSxJQUFJLE9BQU8sS0FBSztBQUM1QixVQUFJLGdCQUFnQixlQUFlLFNBQVMsTUFBTSxJQUFJLFNBQVMsR0FBRztBQUNqRSxvQkFBWTtBQUFBLE1BQ2IsT0FBTztBQUNOLG9CQUFZLEtBQUssd0JBQXdCLG1CQUFtQixHQUFHO0FBQUEsTUFDaEU7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWEsa0JBQWtCLE9BQThEO0FBQzVGLFFBQUksY0FBYyxHQUFHLEtBQUssR0FBRztBQUM1QixZQUFNLFlBQVksS0FBSyxhQUFhLE1BQU0sZUFBZTtBQUN6RCxVQUFJLFdBQVc7QUFDZCxjQUFNLE9BQU8sTUFBTSxLQUFLLGFBQWEsUUFBUSxXQUFXLE1BQU0sSUFBSSxJQUFJO0FBQ3RFLFlBQUksTUFBTTtBQUNULGlCQUFPO0FBQUEsWUFDTixJQUFJLEtBQUs7QUFBQSxZQUNULE1BQU0sUUFBUSxLQUFLLElBQUk7QUFBQSxVQUN4QjtBQUFBLFFBQ0Q7QUFDQSxjQUFNLElBQUksTUFBTSxnQkFBZ0I7QUFBQSxNQUNqQyxPQUFPO0FBQ04sY0FBTSxJQUFJLE1BQU0scUJBQXFCO0FBQUEsTUFDdEM7QUFBQSxJQUNELE9BQU87QUFDTixZQUFNLE9BQU8sUUFBUSxHQUFHLE9BQU8sS0FBSyx5QkFBeUIsSUFBSTtBQUNqRSxhQUFPO0FBQUEsUUFDTixJQUFJLEtBQUs7QUFBQSxRQUNULE1BQU0sUUFBUSxLQUFLLElBQUk7QUFBQSxNQUN4QjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUE7QUFBQTtBQUFBLEVBSU8sYUFBYSxPQUE4RDtBQUNqRixXQUFPLElBQUksUUFBMkIsQ0FBQyxTQUFTLFdBQVc7QUFDMUQsVUFBSSxjQUFjLEdBQUcsS0FBSyxHQUFHO0FBQzVCLGNBQU0sWUFBWSxLQUFLLGFBQWEsTUFBTSxlQUFlO0FBQ3pELFlBQUksV0FBVztBQUNkLGVBQUssYUFBYSxRQUFRLFdBQVcsTUFBTSxJQUFJLElBQUksRUFBRSxLQUFLLENBQUMsU0FBMkI7QUFDckYsZ0JBQUksQ0FBQyxNQUFNO0FBQ1YscUJBQU8sSUFBSSxNQUFNLGdCQUFnQixDQUFDO0FBQUEsWUFDbkMsT0FBTztBQUNOLG9CQUFNLFNBQTRCO0FBQUEsZ0JBQ2pDLElBQUksTUFBTTtBQUFBLGdCQUNWLE1BQU0sUUFBUSxLQUFLLElBQUk7QUFBQSxjQUN4QjtBQUNBLG1CQUFLLGFBQWEsSUFBSSxJQUFJLEVBQUUsS0FBSyxhQUFXO0FBRzNDLG9CQUFLLFNBQVMsYUFBYSxVQUFlLFFBQVEsYUFBYSxHQUFJO0FBQ2xFLHVCQUFLLE9BQU8sY0FBYyxNQUFNO0FBQUEsZ0JBQ2pDO0FBQUEsY0FDRCxHQUFHLFlBQVU7QUFBQSxjQUViLENBQUM7QUFDRCxzQkFBUSxNQUFNO0FBQUEsWUFDZjtBQUFBLFVBQ0QsR0FBRyxDQUFDLFdBQVc7QUFDZCxtQkFBTyxJQUFJLE1BQU0sZ0JBQWdCLENBQUM7QUFBQSxVQUNuQyxDQUFDO0FBQUEsUUFDRixPQUFPO0FBQ04saUJBQU8sSUFBSSxNQUFNLHFCQUFxQixDQUFDO0FBQUEsUUFDeEM7QUFBQSxNQUNELE9BQU87QUFDTixjQUFNLE9BQU8sUUFBUSxHQUFHLE9BQU8sS0FBSyx5QkFBeUIsSUFBSTtBQUNqRSxhQUFLLGFBQWEsSUFBSSxJQUFJLEVBQUUsS0FBSyxRQUFXLFlBQVU7QUFBQSxRQUV0RCxDQUFDO0FBQ0QsY0FBTSxTQUE0QjtBQUFBLFVBQ2pDLElBQUksS0FBSztBQUFBLFVBQ1QsTUFBTSxRQUFRLEtBQUssSUFBSTtBQUFBLFFBQ3hCO0FBQ0EsZ0JBQVEsTUFBTTtBQUFBLE1BQ2Y7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFHTyx5QkFBeUIsSUFBWSxRQUFnQztBQUMzRSxXQUFPLElBQUksUUFBYyxDQUFDLFNBQVMsV0FBVztBQUM3QyxXQUFLLGFBQWEsZUFBZSxFQUFFLEtBQUssQ0FBQyxVQUFVO0FBQ2xELG1CQUFXLFFBQVEsT0FBTztBQUN6QixjQUFJLE9BQU8sS0FBSyxLQUFLO0FBQ3BCLGlCQUFLLGFBQWEsOEJBQThCLE1BQU0sTUFBTSxFQUFFLEtBQUssQ0FBQyxVQUFVO0FBQzdFLHNCQUFRLE1BQVM7QUFBQSxZQUNsQixHQUFHLENBQUMsVUFBVTtBQUNiLHFCQUFPLEtBQUs7QUFBQSxZQUNiLENBQUM7QUFDRDtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQ0EsZUFBTyxJQUFJLE1BQU0sb0NBQW9DLENBQUM7QUFBQSxNQUN2RCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRU8sZUFBZSxJQUEyQjtBQUNoRCxXQUFPLElBQUksUUFBYyxDQUFDLFNBQVMsV0FBVztBQUM3QyxXQUFLLGFBQWEsZUFBZSxFQUFFLEtBQUssQ0FBQyxVQUFVO0FBQ2xELG1CQUFXLFFBQVEsT0FBTztBQUN6QixjQUFJLE9BQU8sS0FBSyxLQUFLO0FBQ3BCLGlCQUFLLGFBQWEsVUFBVSxJQUFJLEVBQUUsS0FBSyxDQUFDLFVBQVU7QUFDakQsc0JBQVEsTUFBUztBQUFBLFlBQ2xCLEdBQUcsQ0FBQyxVQUFVO0FBQ2IscUJBQU8sTUFBUztBQUFBLFlBQ2pCLENBQUM7QUFDRDtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQ0EsZUFBTyxJQUFJLGlCQUFpQiw2QkFBNkIsQ0FBQztBQUFBLE1BQzNELENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFTyxvQkFBb0IsS0FBYSxNQUFnQztBQUN2RSxRQUFJO0FBQ0osWUFBUSxLQUFLLFVBQVU7QUFBQSxNQUN0QixLQUFLO0FBQ0osbUJBQVcsU0FBUyxTQUFTO0FBQzdCO0FBQUEsTUFDRCxLQUFLO0FBQ0osbUJBQVcsU0FBUyxTQUFTO0FBQzdCO0FBQUEsTUFDRCxLQUFLO0FBQ0osbUJBQVcsU0FBUyxTQUFTO0FBQzdCO0FBQUEsTUFDRCxLQUFLO0FBQ0osbUJBQVcsU0FBUyxTQUFTO0FBQzdCO0FBQUEsTUFDRDtBQUNDLG1CQUFXLFNBQVM7QUFBQSxJQUN0QjtBQUNBLFNBQUssYUFBYSxtQkFBbUIsS0FBSztBQUFBLE1BQ3pDO0FBQUEsTUFDQSxhQUFhLENBQUMsU0FBc0I7QUFDbkMsZUFBTyxJQUFJLEtBQUssRUFBRSxRQUFRLEtBQUssUUFBUSxXQUFXLEtBQUssV0FBVyxLQUFLLENBQUM7QUFBQSxNQUN6RTtBQUFBLE1BQ0EsU0FBUyxLQUFLO0FBQUEsTUFDZCxrQkFBa0IsQ0FBQyxpQkFBbUMsV0FBd0IsV0FBeUU7QUFDdEosY0FBTSxPQUFpQixDQUFDO0FBQ3hCLGtCQUFVLFVBQVUsUUFBUSxVQUFRLEtBQUssS0FBSyxJQUFJLENBQUM7QUFDbkQsZUFBTyxRQUFRLFFBQVEsS0FBSyxPQUFPLGtCQUFrQixnQkFBZ0IsS0FBSyxFQUFFLFNBQVMsVUFBVSxTQUFTLFdBQVcsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLFlBQVU7QUFDMUksZ0JBQU0sd0JBQXdCLE1BQU0sS0FBSyxPQUFPLE9BQU8sT0FBTyxTQUFTLENBQUM7QUFDeEUsaUJBQU8sSUFBSSxRQUF3QyxDQUFDLFNBQVMsV0FBVztBQUN2RSxpQkFBSyw4QkFBOEIsdUJBQXVCLGlCQUFpQix1QkFBdUIsU0FBUyxRQUFXLE1BQU0sRUFBRSxLQUFLLGtCQUFnQjtBQUNsSixrQkFBSSxDQUFDLGNBQWM7QUFDbEIsd0JBQVEsTUFBUztBQUFBLGNBQ2xCO0FBRUEsb0JBQU0sU0FBNkI7QUFBQSxnQkFDbEMsU0FBUztBQUFBLGdCQUNULFdBQVcsb0JBQUksSUFBb0I7QUFBQSxjQUNwQztBQUNBLHVCQUFTLElBQUksR0FBRyxJQUFJLHNCQUFzQixRQUFRLEtBQUs7QUFDdEQsc0JBQU0sZUFBZSxLQUFLLENBQUMsRUFBRSxVQUFVLEdBQUcsS0FBSyxDQUFDLEVBQUUsU0FBUyxDQUFDO0FBQzVELG9CQUFJLGdCQUFnQixPQUFPLFVBQVUsS0FBSyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsR0FBRztBQUMxRCx3QkFBTSxXQUFXLGFBQWEsSUFBSSxZQUFZO0FBQzlDLHNCQUFJLE9BQU8sYUFBYSxVQUFVO0FBQ2pDLDJCQUFPLFVBQVUsSUFBSSxjQUFjLFFBQVE7QUFBQSxrQkFDNUM7QUFBQSxnQkFDRCxPQUFPO0FBQ04seUJBQU8sVUFBVSxJQUFJLGNBQWMsc0JBQXNCLENBQUMsQ0FBQztBQUFBLGdCQUM1RDtBQUFBLGNBQ0Q7QUFDQSxrQkFBSSxNQUFNLFNBQVMsT0FBTyxPQUFPLEdBQUc7QUFDbkMsdUJBQU8sVUFBVSxPQUFPO0FBQUEsY0FDekI7QUFDQSxzQkFBUSxNQUFNO0FBQUEsWUFDZixHQUFHLFlBQVU7QUFDWixxQkFBTyxNQUFNO0FBQUEsWUFDZCxDQUFDO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsZ0JBQWdCLENBQUMsU0FBaUIsS0FBYyxVQUFrRDtBQUNqRyxlQUFPLEtBQUssT0FBTyxnQkFBZ0IsU0FBUyxLQUFLLEtBQUs7QUFBQSxNQUN2RDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sNkJBQTZCLFFBQWtCLE9BQWlCLFNBQWtDO0FBQ3ZHLFdBQU8sS0FBSyxhQUFhLDRCQUE0QixRQUFRLE9BQU8sT0FBTztBQUFBLEVBQzVFO0FBRUQ7QUEzVWEsaUJBQU47QUFBQSxFQUROLHFCQUFxQixZQUFZLGNBQWM7QUFBQSxFQVM3QztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FWVTsiLAogICJuYW1lcyI6IFsiVGFza0V4ZWN1dGlvbkRUTyIsICJUYXNrUHJvYmxlbU1hdGNoZXJTdGFydGVkRHRvIiwgIlRhc2tQcm9ibGVtTWF0Y2hlckVuZGVkRHRvIiwgIlRhc2tQcm9jZXNzU3RhcnRlZERUTyIsICJUYXNrUHJvY2Vzc0VuZGVkRFRPIiwgIlRhc2tEZWZpbml0aW9uRFRPIiwgIlRhc2tQcmVzZW50YXRpb25PcHRpb25zRFRPIiwgIlJ1bk9wdGlvbnNEVE8iLCAiUHJvY2Vzc0V4ZWN1dGlvbk9wdGlvbnNEVE8iLCAiUHJvY2Vzc0V4ZWN1dGlvbkRUTyIsICJ2YWx1ZSIsICJTaGVsbEV4ZWN1dGlvbk9wdGlvbnNEVE8iLCAiU2hlbGxFeGVjdXRpb25EVE8iLCAiQ3VzdG9tRXhlY3V0aW9uRFRPIiwgIlRhc2tTb3VyY2VEVE8iLCAiVGFza0hhbmRsZURUTyIsICJUYXNrRFRPIiwgIlRhc2tHcm91cERUTyIsICJUYXNrRmlsdGVyRFRPIl0KfQo=
